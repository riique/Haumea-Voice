import { GoogleGenAI } from '@google/genai'
import { buildFeedbackPrompt, normalizeGeminiSettings } from '../../../shared/gemini'
import { KeyPool } from './key-pool'

const pool = new KeyPool({ provider: 'gemini' })

async function refreshPool(): Promise<void> {
    const stored = await window.api.getApiKey()
    if (!stored?.trim()) {
        throw new Error('API Key não configurada. Acesse Configurações.')
    }
    pool.load(stored)
}

function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
            const result = reader.result as string
            resolve(result.split(',')[1])
        }
        reader.onerror = reject
        reader.readAsDataURL(blob)
    })
}

interface GenerateOpts {
    prompt: string
    audioData: string
    mimeType: string
    modelPriority: string[]
}

async function generateWithStrategy(opts: GenerateOpts): Promise<string> {
    await refreshPool()

    let lastErr: Error | null = null

    for (const model of opts.modelPriority) {
        // retry across available keys for each model
        const keysToTry = Math.max(1, pool.available)

        for (let k = 0; k < keysToTry; k++) {
            let apiKey: string
            try {
                apiKey = pool.next()
            } catch {
                break // no keys left, try next model
            }

            try {
                const ai = new GoogleGenAI({ apiKey })
                const config = buildConfig(model)

                const response = await ai.models.generateContent({
                    model,
                    config,
                    contents: [
                        {
                            role: 'user',
                            parts: [
                                { inlineData: { mimeType: opts.mimeType, data: opts.audioData } },
                                { text: opts.prompt }
                            ]
                        }
                    ]
                })

                const text = response.text
                if (!text) throw new Error('Resposta vazia da API')

                if (model !== opts.modelPriority[0]) {
                    console.info(`[gemini] fallback ativo -> ${model}`)
                }

                return text
            } catch (err) {
                lastErr = err instanceof Error ? err : new Error(String(err))

                const status = KeyPool.extractStatus(err)
                if (status) pool.reportError(apiKey!, status)

                console.warn(`[gemini] ${model} falhou:`, lastErr.message)

                // 401/403 = bad key, try another key on same model
                // 429 = rate limit, try another key on same model
                // anything else = model-level failure, skip to next model
                if (status !== 429 && status !== 401 && status !== 403) break
            }
        }
    }

    throw lastErr ?? new Error('Todos os modelos falharam')
}

function buildConfig(_model: string): Record<string, unknown> {
    return { temperature: 0.2, maxOutputTokens: 8192 }
}

export async function transcribeAudio(audioBlob: Blob): Promise<string> {
    const b64 = await blobToBase64(audioBlob)
    const settings = normalizeGeminiSettings(await window.api.getGeminiSettings())

    return generateWithStrategy({
        audioData: b64,
        mimeType: 'audio/webm',
        modelPriority: settings.modelPriority,
        prompt: settings.transcriptionPrompt
    })
}

export async function generateFeedback(audioBlob: Blob, transcript?: string): Promise<string> {
    const b64 = await blobToBase64(audioBlob)
    const settings = normalizeGeminiSettings(await window.api.getGeminiSettings())

    return generateWithStrategy({
        audioData: b64,
        mimeType: 'audio/webm',
        modelPriority: settings.modelPriority,
        prompt: buildFeedbackPrompt(settings.feedbackPrompt, transcript)
    })
}
