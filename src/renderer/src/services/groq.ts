/**
 * Groq Whisper transcription client.
 *
 * Uses the Groq REST API directly (no extra SDK) to transcribe audio
 * via OpenAI-compatible endpoint. Key pool with the same semantics
 * as the Gemini pool — round-robin, cooldown on 429, ban on 401/403.
 */

import { KeyPool, NoAvailableKeyError } from './key-pool'
import { DEFAULT_GROQ_MODEL_PRIORITY } from './groq-settings'

const GROQ_TRANSCRIPTION_ENDPOINT = 'https://api.groq.com/openai/v1/audio/transcriptions'
const MAX_FILE_BYTES = 25 * 1024 * 1024
const TRANSCRIPTION_TIMEOUT_MS = 60_000
const MAX_ATTEMPTS_PER_MODEL = 3
const RETRY_DELAY_MS = 450
const AUDIO_PROMPT_MAX_CHARS = 900

export type GroqWhisperModel = string

export interface TranscribeOptions {
    language?: string
    prompt?: string
    response_format?: 'json' | 'text' | 'verbose_json' | 'srt' | 'vtt'
    temperature?: number
}

export interface GroqTranscriptionResult {
    text: string
    [key: string]: unknown
}

const pool = new KeyPool({ provider: 'groq' })

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

function normalizeModelList(model: GroqWhisperModel | GroqWhisperModel[]): GroqWhisperModel[] {
    const raw = Array.isArray(model) ? model : [model]
    const seen = new Set<string>()
    const models = raw
        .map(item => item.trim())
        .filter(item => {
            if (!item) return false
            const key = item.toLowerCase()
            if (seen.has(key)) return false
            seen.add(key)
            return true
        })

    return models.length > 0 ? models : [...DEFAULT_GROQ_MODEL_PRIORITY]
}

async function fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs: number
): Promise<Response> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
        return await fetch(url, { ...init, signal: controller.signal })
    } catch (err) {
        const name = err && typeof err === 'object' ? (err as { name?: string }).name : ''
        if (name === 'AbortError') {
            throw new Error(`Groq API sem resposta apos ${Math.round(timeoutMs / 1000)}s`)
        }
        throw err
    } finally {
        clearTimeout(timeout)
    }
}

function compactDetail(detail: string): string {
    return detail.replace(/\s+/g, ' ').trim().slice(0, 300)
}

function buildGroqError(status: number, detail: string, model: string): Error {
    const suffix = detail.trim() ? `: ${compactDetail(detail)}` : ''
    const err = new Error(`Groq API ${status} em ${model}${suffix}`)
    ;(err as Record<string, unknown>).status = status
    ;(err as Record<string, unknown>).detail = detail
    return err
}

function isProbablyAuthError(status: number, detail: string): boolean {
    if (status === 401) return true
    if (status !== 403) return false
    return /api key|authentication|unauthorized|invalid key|forbidden key/i.test(detail)
}

function reportGroqKeyError(apiKey: string, status: number, detail: string): void {
    if (status === 429 || isProbablyAuthError(status, detail)) {
        pool.reportError(apiKey, status)
    }
}

function isRetryableStatus(status: number | null): boolean {
    return status === null || status === 408 || status === 409 || status === 425 || status === 429 || status >= 500
}

function shouldTryNextModel(status: number | null): boolean {
    return status === 400 || status === 403 || status === 404 || isRetryableStatus(status)
}

function shouldStopForKeys(status: number | null, detail: string): boolean {
    return status === 401 || (status === 403 && isProbablyAuthError(status, detail))
}

function errorDetail(err: unknown): string {
    if (!err || typeof err !== 'object') return ''
    const detail = (err as { detail?: unknown }).detail
    return typeof detail === 'string' ? detail : ''
}

function audioEndpointPrompt(prompt: string): string {
    const trimmed = prompt.trim()
    if (trimmed.length <= AUDIO_PROMPT_MAX_CHARS) return trimmed
    return trimmed.slice(0, AUDIO_PROMPT_MAX_CHARS).trimEnd()
}

function parseGroqTranscription(raw: string, model: string): GroqTranscriptionResult {
    let data: GroqTranscriptionResult

    try {
        data = JSON.parse(raw) as GroqTranscriptionResult
    } catch {
        throw new Error(`Groq retornou JSON invalido em ${model}. Resposta bruta: ${compactDetail(raw)}`)
    }

    if (typeof data.text !== 'string') {
        throw new Error(`Groq nao retornou campo text em ${model}. Resposta bruta: ${compactDetail(raw)}`)
    }

    if (!data.text.trim()) {
        throw new Error(`Groq retornou text vazio em ${model}. Resposta bruta: ${compactDetail(raw)}`)
    }

    return data
}

/**
 * Load Groq keys from comma-separated string.
 * Call once at startup or whenever settings change.
 */
export function loadGroqKeys(raw: string): void {
    pool.load(raw)
}

/**
 * Transcribe an audio file via Groq's Whisper API.
 *
 * @param file        File or Blob of audio (≤ 25 MB)
 * @param model       Whisper model variant
 * @param options     Optional language/prompt/format/temperature
 */
export async function transcribe(
    file: File | Blob,
    model: GroqWhisperModel | GroqWhisperModel[] = DEFAULT_GROQ_MODEL_PRIORITY,
    options: TranscribeOptions = {}
): Promise<GroqTranscriptionResult> {
    if (file.size > MAX_FILE_BYTES) {
        const mb = (file.size / (1024 * 1024)).toFixed(1)
        throw new Error(
            `Arquivo excede o limite de 25 MB (${mb} MB). Comprima ou recorte o áudio antes de enviar.`
        )
    }

    if (!pool.total) {
        throw new NoAvailableKeyError('groq')
    }

    let lastErr: Error | null = null
    const models = normalizeModelList(model)
    const settingsPrompt = options.prompt ?? ''
    const whisperPrompt = settingsPrompt ? audioEndpointPrompt(settingsPrompt) : ''

    for (const currentModel of models) {
        const maxAttempts = Math.max(MAX_ATTEMPTS_PER_MODEL, pool.available)
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            let apiKey: string
            try {
                apiKey = pool.next()
            } catch (err) {
                if (lastErr) throw lastErr
                throw err
            }

            try {
                const body = new FormData()
                const filename = file instanceof File ? file.name : 'audio.webm'
                body.append('file', file, filename)
                body.append('model', currentModel)

                if (options.language) body.append('language', options.language)
                if (whisperPrompt) body.append('prompt', whisperPrompt)
                if (options.response_format) body.append('response_format', options.response_format)
                if (options.temperature !== undefined) body.append('temperature', String(options.temperature))

                const resp = await fetchWithTimeout(GROQ_TRANSCRIPTION_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${apiKey}` },
                    body
                }, TRANSCRIPTION_TIMEOUT_MS)

                const raw = await resp.text().catch(() => '')
                if (!resp.ok) {
                    reportGroqKeyError(apiKey, resp.status, raw)
                    throw buildGroqError(resp.status, raw, currentModel)
                }

                const data = options.response_format === 'text'
                    ? { text: raw }
                    : parseGroqTranscription(raw, currentModel)

                if (currentModel !== models[0]) {
                    console.info(`[groq] fallback ativo -> ${currentModel}`)
                }

                return data
            } catch (err) {
                lastErr = err instanceof Error ? err : new Error(String(err))

                const status = KeyPool.extractStatus(err)
                const detail = errorDetail(err)
                console.warn(`[groq] ${currentModel} tentativa ${attempt} falhou:`, lastErr.message)

                if (shouldStopForKeys(status, detail)) {
                    if (pool.available > 0) continue
                    throw lastErr
                }

                if (!shouldTryNextModel(status)) {
                    throw lastErr
                }

                if (!isRetryableStatus(status)) {
                    break
                }

                if (status === 429 && pool.available === 0) {
                    throw lastErr
                }

                if (attempt < maxAttempts) {
                    await sleep(RETRY_DELAY_MS * attempt)
                }
            }
        }
    }

    throw lastErr ?? new NoAvailableKeyError('groq')
}
