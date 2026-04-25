import { spawn, type ChildProcess } from 'child_process'
import { join } from 'path'
import { existsSync } from 'fs'
import { modelDir } from './model-manager'
import type {
    TranscriptionRequest,
    TranscriptionResult,
    TranscriptionProgress,
    SystemCheck
} from '../../shared/whisper'

const UTF8_ENV = { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }

let serverProcess: ChildProcess | null = null
let serverReady = false
let pendingResolve: ((r: TranscriptionResult) => void) | null = null
let pendingReject: ((e: Error) => void) | null = null
let pendingProgress: ((p: TranscriptionProgress) => void) | null = null
let stdoutBuffer = ''
let onReadyCallback: (() => void) | null = null

function findPython(): string {
    return 'python'
}

function scriptPath(): string {
    const devPath = join(__dirname, '../../python/transcribe.py')
    if (existsSync(devPath)) return devPath

    const prodPath = join(process.resourcesPath, 'python', 'transcribe.py')
    if (existsSync(prodPath)) return prodPath

    throw new Error('Script transcribe.py nao encontrado')
}

function drainLines(): void {
    const lines = stdoutBuffer.split('\n')
    stdoutBuffer = lines.pop() || ''

    for (const raw of lines) {
        const line = raw.trim()
        if (!line) continue

        if (line === 'READY' || line === 'PONG') {
            serverReady = true
            if (onReadyCallback) {
                const cb = onReadyCallback
                onReadyCallback = null
                cb()
            }
            continue
        }

        if (line.startsWith('PROGRESS:')) {
            const pct = parseInt(line.slice(9), 10)
            if (!isNaN(pct) && pendingProgress) {
                pendingProgress({ percent: pct })
            }
            continue
        }

        if (line.startsWith('RESULT:')) {
            try {
                const parsed = JSON.parse(line.slice(7)) as TranscriptionResult
                if (pendingResolve) {
                    const resolve = pendingResolve
                    pendingResolve = null
                    pendingReject = null
                    pendingProgress = null
                    resolve(parsed)
                }
            } catch {
                if (pendingReject) {
                    const reject = pendingReject
                    pendingResolve = null
                    pendingReject = null
                    pendingProgress = null
                    reject(new Error('Resultado invalido retornado pelo servidor'))
                }
            }
            continue
        }

        if (line.startsWith('ERROR:')) {
            if (pendingReject) {
                const reject = pendingReject
                pendingResolve = null
                pendingReject = null
                pendingProgress = null
                reject(new Error(line.slice(6)))
            }
            continue
        }
    }
}

function ensureServer(): Promise<void> {
    if (serverProcess && serverReady) return Promise.resolve()

    return new Promise((resolve, reject) => {
        if (serverProcess) {
            // already spawning — piggyback on READY
            onReadyCallback = resolve
            return
        }

        const script = scriptPath()
        const proc = spawn(findPython(), [script], {
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: true,
            env: UTF8_ENV
        })

        serverProcess = proc
        stdoutBuffer = ''

        proc.stdout!.on('data', (chunk: Buffer) => {
            stdoutBuffer += chunk.toString('utf-8')
            drainLines()
        })

        proc.stderr!.on('data', (chunk: Buffer) => {
            const text = chunk.toString('utf-8').trim()
            if (text) console.error('[whisper-server]', text)
        })

        proc.on('close', (code) => {
            console.log(`[whisper-server] exited with code ${code}`)
            serverProcess = null
            serverReady = false

            if (pendingReject) {
                const rej = pendingReject
                pendingResolve = null
                pendingReject = null
                pendingProgress = null
                rej(new Error(`Processo Whisper encerrou inesperadamente (code ${code})`))
            }
        })

        proc.on('error', (err) => {
            serverProcess = null
            serverReady = false
            reject(err)
        })

        const timeout = setTimeout(() => {
            if (!serverReady) {
                killServer()
                reject(new Error('Whisper server timeout — READY nao recebido'))
            }
        }, 30_000)

        onReadyCallback = () => {
            clearTimeout(timeout)
            resolve()
        }
    })
}

function killServer(): void {
    if (serverProcess) {
        try {
            serverProcess.stdin?.write(JSON.stringify({ action: 'exit' }) + '\n')
        } catch { /* already dead */ }
        setTimeout(() => {
            if (serverProcess) {
                serverProcess.kill()
                serverProcess = null
            }
        }, 1000)
        serverReady = false
        onReadyCallback = null
    }
}

// ── system check (one-shot, no server needed) ──

function runQuick(cmd: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        const proc = spawn(cmd, args, {
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true,
            timeout: 5000,
            env: UTF8_ENV
        })
        let out = ''
        proc.stdout.on('data', (d: Buffer) => { out += d.toString('utf-8') })
        proc.on('close', (code) => {
            if (code === 0) resolve(out)
            else reject(new Error(`exit ${code}`))
        })
        proc.on('error', reject)
    })
}

export async function checkSystem(): Promise<SystemCheck> {
    const result: SystemCheck = {
        python: false,
        pythonVersion: '',
        ffmpeg: false,
        ffmpegVersion: ''
    }

    try {
        const pyVer = await runQuick(findPython(), ['--version'])
        result.python = true
        result.pythonVersion = pyVer.trim()
    } catch { /* unavailable */ }

    try {
        const ffVer = await runQuick('ffmpeg', ['-version'])
        result.ffmpeg = true
        result.ffmpegVersion = ffVer.split('\n')[0].trim()
    } catch { /* unavailable */ }

    if (result.python) {
        try {
            await runQuick(findPython(), ['-c', 'import faster_whisper; print(faster_whisper.__version__)'])
        } catch {
            result.python = true
        }
    }

    return result
}

// ── transcription ──

export async function transcribe(
    req: TranscriptionRequest,
    onProgress: (p: TranscriptionProgress) => void
): Promise<TranscriptionResult> {
    if (pendingResolve) throw new Error('Transcricao ja em andamento')

    const dir = modelDir(req.modelId)
    if (!existsSync(dir)) throw new Error(`Modelo ${req.modelId} nao encontrado no disco`)

    await ensureServer()

    return new Promise((resolve, reject) => {
        pendingResolve = resolve
        pendingReject = reject
        pendingProgress = onProgress

        const cmd = {
            action: 'transcribe',
            modelPath: dir,
            audioPath: req.audioPath,
            language: req.language,
            device: 'auto',
            computeType: 'auto'
        }

        try {
            serverProcess!.stdin!.write(JSON.stringify(cmd) + '\n')
        } catch (err) {
            pendingResolve = null
            pendingReject = null
            pendingProgress = null
            reject(err)
        }
    })
}

export function cancelTranscription(): boolean {
    if (!serverProcess) return false
    killServer()
    if (pendingReject) {
        const rej = pendingReject
        pendingResolve = null
        pendingReject = null
        pendingProgress = null
        rej(new Error('Transcricao cancelada'))
    }
    return true
}

process.on('exit', () => killServer())
