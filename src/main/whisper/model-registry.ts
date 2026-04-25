import type { WhisperModel } from '../../shared/whisper'

// CTranslate2-format repos on Hugging Face (Systran org)
// sizes are approximate download sizes for all model files

export const WHISPER_MODELS: WhisperModel[] = [
    {
        id: 'large-v3-turbo',
        name: 'Large V3 Turbo',
        repo: 'deepdml/faster-whisper-large-v3-turbo-ct2',
        sizeLabel: '~1.6 GB',
        sizeBytes: 1_617_884_929,
        description: 'Melhor custo-beneficio. Velocidade alta, qualidade proxima ao large-v3.'
    },
    {
        id: 'large-v3',
        name: 'Large V3',
        repo: 'Systran/faster-whisper-large-v3',
        sizeLabel: '~3.1 GB',
        sizeBytes: 3_100_000_000,
        description: 'Maior precisao possivel. Mais lento em CPU.'
    },
    {
        id: 'medium',
        name: 'Medium',
        repo: 'Systran/faster-whisper-medium',
        sizeLabel: '~1.5 GB',
        sizeBytes: 1_500_000_000,
        description: 'Equilibrio entre velocidade e qualidade.'
    },
    {
        id: 'small',
        name: 'Small',
        repo: 'Systran/faster-whisper-small',
        sizeLabel: '~460 MB',
        sizeBytes: 460_000_000,
        description: 'Rapido. Bom para audios limpos e claros.'
    },
    {
        id: 'base',
        name: 'Base',
        repo: 'Systran/faster-whisper-base',
        sizeLabel: '~145 MB',
        sizeBytes: 145_000_000,
        description: 'Muito rapido. Qualidade limitada.'
    },
    {
        id: 'tiny',
        name: 'Tiny',
        repo: 'Systran/faster-whisper-tiny',
        sizeLabel: '~75 MB',
        sizeBytes: 75_000_000,
        description: 'Menor e mais rapido. Ideal para testes.'
    }
]

export function getModelById(id: string): WhisperModel | undefined {
    return WHISPER_MODELS.find(m => m.id === id)
}

// HF API: list files in a repo
export function hfApiUrl(repo: string): string {
    return `https://huggingface.co/api/models/${repo}`
}

// HF: raw file download URL
export function hfFileUrl(repo: string, filename: string): string {
    return `https://huggingface.co/${repo}/resolve/main/${filename}`
}
