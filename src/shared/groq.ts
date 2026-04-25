export interface GroqSettings {
    transcriptionPrompt: string
    modelPriority: string[]
}

export const DEFAULT_GROQ_MODEL_PRIORITY = [
    'whisper-large-v3-turbo',
    'whisper-large-v3'
]

const LEGACY_GROQ_MODEL_PRIORITY_WITH_DISTIL = [
    'whisper-large-v3-turbo',
    'whisper-large-v3',
    'distil-whisper-large-v3-en'
]

export const DEFAULT_GROQ_TRANSCRIPTION_PROMPT = ''

export const DEFAULT_GROQ_SETTINGS: GroqSettings = {
    transcriptionPrompt: DEFAULT_GROQ_TRANSCRIPTION_PROMPT,
    modelPriority: [...DEFAULT_GROQ_MODEL_PRIORITY]
}

export function cloneGroqSettings(settings: GroqSettings): GroqSettings {
    return {
        transcriptionPrompt: settings.transcriptionPrompt,
        modelPriority: [...settings.modelPriority]
    }
}

function stripGroqContext(prompt: string): string {
    if (/\bhaume(?:a|ia)\b|\bhalmeia\b|\braumea\b/i.test(prompt)) {
        return DEFAULT_GROQ_TRANSCRIPTION_PROMPT
    }

    return prompt
        .split('\n')
        .filter(line => {
            const normalized = line.toLowerCase()
            return !normalized.includes('haumea') &&
                !normalized.includes('haumeia') &&
                !normalized.includes('halmeia') &&
                !normalized.includes('raumea') &&
                !normalized.includes('contexto anterior') &&
                !normalized.includes('glossario de grafia') &&
                !normalized.includes('glossário de grafia') &&
                !normalized.includes('-> groq') &&
                !normalized.includes('escreva sempre "groq"')
        })
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
}

export function normalizeGroqSettings(
    settings?: Partial<GroqSettings> | null
): GroqSettings {
    const seen = new Set<string>()
    const transcriptionPrompt = settings?.transcriptionPrompt?.trim()
    const baseTranscriptionPrompt =
        !transcriptionPrompt
            ? DEFAULT_GROQ_TRANSCRIPTION_PROMPT
            : transcriptionPrompt
    const normalizedTranscriptionPrompt = stripGroqContext(baseTranscriptionPrompt)

    const cleaned = (settings?.modelPriority ?? [])
        .map(m => m.trim())
        .filter(m => {
            if (!m) return false
            const norm = m.toLowerCase()
            if (seen.has(norm)) return false
            seen.add(norm)
            return true
        })

    const normalizedModelPriority =
        cleaned.length > 0 ? cleaned : [...DEFAULT_GROQ_MODEL_PRIORITY]
    const isLegacyDefault =
        normalizedModelPriority.length === LEGACY_GROQ_MODEL_PRIORITY_WITH_DISTIL.length &&
        normalizedModelPriority.every((model, index) =>
            model === LEGACY_GROQ_MODEL_PRIORITY_WITH_DISTIL[index]
        )

    return {
        transcriptionPrompt: normalizedTranscriptionPrompt,
        modelPriority: isLegacyDefault ? [...DEFAULT_GROQ_MODEL_PRIORITY] : normalizedModelPriority
    }
}
