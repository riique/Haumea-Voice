import { transcribeAudio } from './gemini'
import { transcribe as groqTranscribe, loadGroqKeys } from './groq'
import { normalizeGroqSettings } from './groq-settings'
import { cleanTranscriptionArtifacts } from './postprocess'

export type TranscriptionEngine = 'gemini' | 'whisper' | 'groq'

const EMPTY_RETRY_DELAY_MS = 700
const FALLBACK_ORDER: Record<TranscriptionEngine, TranscriptionEngine[]> = {
    groq: ['groq', 'gemini', 'whisper'],
    gemini: ['gemini', 'groq', 'whisper'],
    whisper: ['whisper', 'groq', 'gemini']
}

const ENGINE_LABELS: Record<TranscriptionEngine, string> = {
    gemini: 'Gemini',
    groq: 'Groq',
    whisper: 'Whisper local'
}

function blobToB64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const r = new FileReader()
        r.onloadend = () => resolve((r.result as string).split(',')[1])
        r.onerror = reject
        r.readAsDataURL(blob)
    })
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

export function emptyTranscriptionMessage(text: string): string | null {
    const trimmed = text.trim()
    if (!trimmed) return 'A transcricao voltou vazia: nenhuma palavra foi detectada.'
    if (trimmed.toLowerCase() === '[silencio]') {
        return 'Audio sem fala detectavel: o motor retornou [silencio].'
    }
    return null
}

export class EmptyTranscriptionError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'EmptyTranscriptionError'
    }
}

export async function transcribeWithEngine(
    blob: Blob,
    engine: TranscriptionEngine
): Promise<string> {
    if (engine === 'whisper') {
        const b64 = await blobToB64(blob)
        const tempPath = await window.api.saveTempAudio(b64, 'webm')
        try {
            const settings = await window.api.whisperGetSettings()
            const res = await window.api.whisperTranscribe({
                audioPath: tempPath,
                modelId: settings.selectedModel,
                language: settings.language,
                temperature: 0.1
            })
            if (!res.ok || !res.result) throw new Error(res.error || 'Whisper retornou erro')
            return res.result.text
        } finally {
            window.api.deleteTempAudio(tempPath).catch(() => { })
        }
    }

    if (engine === 'groq') {
        const keys = await window.api.getGroqApiKeys()
        if (keys) loadGroqKeys(keys)
        const groqSettings = normalizeGroqSettings(await window.api.getGroqSettings())
        const result = await groqTranscribe(blob, groqSettings.modelPriority, {
            prompt: '',
            temperature: 0.1
        })
        return result.text
    }

    return transcribeAudio(blob)
}

export async function transcribeWithNonEmptyRetry(
    blob: Blob,
    engine: TranscriptionEngine,
    attempts = 2
): Promise<string> {
    const failures: string[] = []

    for (const currentEngine of FALLBACK_ORDER[engine]) {
        let lastEmpty: string | null = null

        for (let attempt = 1; attempt <= attempts; attempt++) {
            try {
                const text = cleanTranscriptionArtifacts(await transcribeWithEngine(blob, currentEngine))
                const emptyMessage = emptyTranscriptionMessage(text)

                if (!emptyMessage) {
                    if (currentEngine !== engine) {
                        console.info(`[transcription] fallback ativo -> ${ENGINE_LABELS[currentEngine]}`)
                    }
                    return text
                }

                lastEmpty = emptyMessage

                if (attempt < attempts) {
                    await sleep(EMPTY_RETRY_DELAY_MS)
                }
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err)
                failures.push(`${ENGINE_LABELS[currentEngine]}: ${message}`)
                break
            }
        }

        if (lastEmpty) {
            failures.push(`${ENGINE_LABELS[currentEngine]}: ${lastEmpty}`)
        }
    }

    throw new EmptyTranscriptionError(
        failures.length > 0
            ? `Todos os motores falharam. ${failures.join(' | ')}`
            : 'A transcricao voltou vazia.'
    )
}

