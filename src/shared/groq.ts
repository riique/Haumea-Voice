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

const LEGACY_GROQ_TRANSCRIPTION_PROMPT = `Transcreva o audio no idioma original falado.

Use estas dicas de vocabulario para corrigir termos que podem soar parecidos:
- Se ouvir algo como "Haumeia", "Halmeia" ou "Raumea", escreva sempre "Haumea".

Mantenha nomes proprios, nomes de produtos, termos tecnicos e siglas com a grafia indicada pelo usuario.`

const LEGACY_GROQ_TRANSCRIPTION_PROMPT_WITH_GROQ = `Transcreva o audio no idioma original falado.

Use estas dicas de vocabulario para corrigir termos que podem soar parecidos:
- Se ouvir algo como "Haumeia", "Halmeia" ou "Raumea", escreva sempre "Haumea".
- Se ouvir algo como "Grock", "Grocke", "GROCKE", "Grok" ou "Groc", escreva sempre "Groq".

Mantenha nomes proprios, nomes de produtos, termos tecnicos e siglas com a grafia indicada pelo usuario.`

const LEGACY_GROQ_CONTEXT_TRANSCRIPTION_PROMPT = `Transcreva o audio no idioma original falado.

Contexto anterior da conversa:
Os nomes corretos usados nesta conversa sao Haumea e Groq.

Glossario de grafia:
- Haumeia, Halmeia, Raumea -> Haumea
- Grock, Grocke, GROCKE, Grok, Groc, Groque, Groke -> Groq`

export const DEFAULT_GROQ_TRANSCRIPTION_PROMPT = `Transcreva o audio no idioma original falado.

Contexto anterior da conversa:
O nome correto usado nesta conversa e Haumea.

Glossario de grafia:
- Haumeia, Halmeia, Raumea -> Haumea`

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

export function normalizeGroqSettings(
    settings?: Partial<GroqSettings> | null
): GroqSettings {
    const seen = new Set<string>()
    const transcriptionPrompt = settings?.transcriptionPrompt?.trim()
    const normalizedTranscriptionPrompt =
        !transcriptionPrompt ||
            transcriptionPrompt === LEGACY_GROQ_TRANSCRIPTION_PROMPT ||
            transcriptionPrompt === LEGACY_GROQ_TRANSCRIPTION_PROMPT_WITH_GROQ ||
            transcriptionPrompt === LEGACY_GROQ_CONTEXT_TRANSCRIPTION_PROMPT
            ? DEFAULT_GROQ_TRANSCRIPTION_PROMPT
            : transcriptionPrompt

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
