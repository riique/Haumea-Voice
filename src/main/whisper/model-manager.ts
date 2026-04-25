import { app, net } from 'electron'
import { join } from 'path'
import {
    existsSync,
    mkdirSync,
    readdirSync,
    rmSync,
    createWriteStream,
    unlinkSync
} from 'fs'
import Store from 'electron-store'
import { getModelById, hfApiUrl, hfFileUrl, WHISPER_MODELS } from './model-registry'
import type { ModelState, DownloadProgress, WhisperSettings } from '../../shared/whisper'

const store = new Store()
const DEFAULT_MODELS_DIR = join(app.getPath('userData'), 'whisper-models')

const activeDownloads = new Map<string, AbortController>()
const modelStates = new Map<string, ModelState>()

// ── paths ──

export function modelsDir(): string {
    const custom = store.get('whisperModelsPath', '') as string
    const dir = custom || DEFAULT_MODELS_DIR
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    return dir
}

export function modelDir(modelId: string): string {
    return join(modelsDir(), modelId)
}

// ── settings ──

export function getWhisperSettings(): WhisperSettings {
    return {
        modelsPath: (store.get('whisperModelsPath', '') as string) || DEFAULT_MODELS_DIR,
        selectedModel: store.get('whisperSelectedModel', 'large-v3-turbo') as string,
        language: store.get('whisperLanguage', 'auto') as string,
        downloadedModels: store.get('whisperDownloadedModels', []) as string[]
    }
}

export function saveWhisperSettings(partial: Partial<WhisperSettings>): WhisperSettings {
    if (partial.modelsPath !== undefined) store.set('whisperModelsPath', partial.modelsPath)
    if (partial.selectedModel !== undefined) store.set('whisperSelectedModel', partial.selectedModel)
    if (partial.language !== undefined) store.set('whisperLanguage', partial.language)
    if (partial.downloadedModels !== undefined) store.set('whisperDownloadedModels', partial.downloadedModels)
    return getWhisperSettings()
}

// ── state ──

function markDownloaded(modelId: string) {
    const downloaded = new Set(store.get('whisperDownloadedModels', []) as string[])
    downloaded.add(modelId)
    store.set('whisperDownloadedModels', Array.from(downloaded))
}

function markRemoved(modelId: string) {
    const downloaded = new Set(store.get('whisperDownloadedModels', []) as string[])
    downloaded.delete(modelId)
    store.set('whisperDownloadedModels', Array.from(downloaded))
}

export function listModelStates(): ModelState[] {
    const downloaded = new Set(store.get('whisperDownloadedModels', []) as string[])

    return WHISPER_MODELS.map(m => {
        const cached = modelStates.get(m.id)
        if (cached && cached.status === 'downloading') return cached

        const dir = modelDir(m.id)
        const ready = downloaded.has(m.id) && existsSync(dir) && readdirSync(dir).length > 0

        const state: ModelState = {
            id: m.id,
            status: ready ? 'ready' : 'absent',
            progress: ready ? 100 : 0
        }
        modelStates.set(m.id, state)
        return state
    })
}

// ── download via Electron net (handles redirects, TLS, proxies) ──

interface HFSibling { rfilename: string }
interface HFModelInfo { siblings: HFSibling[] }

async function listRepoFiles(repo: string): Promise<string[]> {
    const url = hfApiUrl(repo)
    console.log('[whisper] listing files from:', url)

    const res = await net.fetch(url, {
        credentials: 'omit',
        headers: { 'User-Agent': 'HaumeaVoice/1.0' }
    })

    if (!res.ok) {
        throw new Error(`HuggingFace API retornou ${res.status}: ${res.statusText}`)
    }

    const info = (await res.json()) as HFModelInfo

    if (!info.siblings || !Array.isArray(info.siblings)) {
        throw new Error('Resposta inesperada da API do HuggingFace')
    }

    const files = info.siblings
        .map(s => s.rfilename)
        .filter(f => !f.startsWith('.') && f !== 'README.md')

    console.log(`[whisper] found ${files.length} files in ${repo}`)
    return files
}

async function downloadFile(
    url: string,
    dest: string,
    signal: AbortSignal,
    onBytes: (bytes: number) => void
): Promise<void> {
    const res = await net.fetch(url, {
        signal: signal as any,
        credentials: 'omit',
        headers: { 'User-Agent': 'HaumeaVoice/1.0' }
    })

    if (!res.ok) {
        throw new Error(`Download falhou: ${res.status} ${res.statusText} — ${url}`)
    }

    const body = res.body
    if (!body) throw new Error('Resposta sem corpo')

    const reader = body.getReader()
    const ws = createWriteStream(dest)

    try {
        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            if (signal.aborted) throw new Error('aborted')

            ws.write(Buffer.from(value))
            onBytes(value.byteLength)
        }
        ws.end()
        await new Promise<void>((resolve, reject) => {
            ws.on('finish', resolve)
            ws.on('error', reject)
        })
    } catch (err) {
        ws.destroy()
        if (existsSync(dest)) unlinkSync(dest)
        throw err
    }
}

// ── public API ──

export async function downloadModel(
    modelId: string,
    onProgress: (p: DownloadProgress) => void
): Promise<void> {
    const model = getModelById(modelId)
    if (!model) throw new Error(`Modelo desconhecido: ${modelId}`)

    const dir = modelDir(modelId)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

    const controller = new AbortController()
    activeDownloads.set(modelId, controller)

    modelStates.set(modelId, { id: modelId, status: 'downloading', progress: 0 })

    try {
        const files = await listRepoFiles(model.repo)
        const totalSize = model.sizeBytes
        let totalDownloaded = 0
        let lastReport = 0

        for (const file of files) {
            if (controller.signal.aborted) throw new Error('aborted')

            const url = hfFileUrl(model.repo, file)
            const dest = join(dir, file)

            // create subdirs if needed
            const parts = file.split('/')
            if (parts.length > 1) {
                const fileDir = join(dir, ...parts.slice(0, -1))
                if (!existsSync(fileDir)) mkdirSync(fileDir, { recursive: true })
            }

            console.log(`[whisper] downloading ${file}...`)

            await downloadFile(url, dest, controller.signal, (bytes) => {
                totalDownloaded += bytes
                const now = Date.now()
                if (now - lastReport < 300) return
                lastReport = now

                const percent = Math.min(99, Math.round((totalDownloaded / totalSize) * 100))
                modelStates.set(modelId, { id: modelId, status: 'downloading', progress: percent })
                onProgress({
                    modelId,
                    percent,
                    bytesDownloaded: totalDownloaded,
                    bytesTotal: totalSize,
                    speed: 0
                })
            })
        }

        markDownloaded(modelId)
        modelStates.set(modelId, { id: modelId, status: 'ready', progress: 100 })
        onProgress({
            modelId,
            percent: 100,
            bytesDownloaded: totalSize,
            bytesTotal: totalSize,
            speed: 0
        })
    } catch (err) {
        console.error('[whisper] download error:', (err as Error).message)
        if ((err as Error).message === 'aborted') {
            if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
            modelStates.set(modelId, { id: modelId, status: 'absent', progress: 0 })
        } else {
            // cleanup empty dir on error
            if (existsSync(dir) && readdirSync(dir).length === 0) {
                rmSync(dir, { recursive: true, force: true })
            }
            modelStates.set(modelId, {
                id: modelId,
                status: 'error',
                progress: 0,
                error: (err as Error).message
            })
        }
        throw err
    } finally {
        activeDownloads.delete(modelId)
    }
}

export function cancelDownload(modelId: string): boolean {
    const controller = activeDownloads.get(modelId)
    if (!controller) return false
    controller.abort()
    return true
}

export function deleteModel(modelId: string): boolean {
    cancelDownload(modelId)
    const dir = modelDir(modelId)
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
    markRemoved(modelId)
    modelStates.set(modelId, { id: modelId, status: 'absent', progress: 0 })
    return true
}
