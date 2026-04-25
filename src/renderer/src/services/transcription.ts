import { transcribeAudio } from './gemini'
import { transcribe as groqTranscribe, loadGroqKeys } from './groq'
import { normalizeGroqSettings } from './groq-settings'

export type TranscriptionEngine = 'gemini' | 'whisper' | 'groq'

const EMPTY_RETRY_DELAY_MS = 700

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
    if (!trimmed) return 'A transcrição voltou vazia: nenhuma palavra foi detectada.'
    if (trimmed.toLowerCase() === '[silencio]') {
        return 'Áudio sem fala detectável: o motor retornou [silencio].'
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
                language: settings.language
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
            prompt: groqSettings.transcriptionPrompt
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
    let lastEmpty: string | null = null

    for (let attempt = 1; attempt <= attempts; attempt++) {
        const text = await transcribeWithEngine(blob, engine)
        const emptyMessage = emptyTranscriptionMessage(text)

        if (!emptyMessage) return text
        lastEmpty = emptyMessage

        if (attempt < attempts) {
            await sleep(EMPTY_RETRY_DELAY_MS)
        }
    }

    throw new EmptyTranscriptionError(lastEmpty || 'A transcrição voltou vazia.')
}
