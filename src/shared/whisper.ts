export interface WhisperModel {
    id: string
    name: string
    repo: string
    sizeLabel: string
    sizeBytes: number
    description: string
}

export type ModelStatus = 'absent' | 'downloading' | 'ready' | 'error'

export interface ModelState {
    id: string
    status: ModelStatus
    progress: number
    error?: string
}

export interface DownloadProgress {
    modelId: string
    percent: number
    bytesDownloaded: number
    bytesTotal: number
    speed: number
}

export interface TranscriptionRequest {
    audioPath: string
    modelId: string
    language: string
}

export interface TranscriptionSegment {
    start: number
    end: number
    text: string
}

export interface TranscriptionResult {
    text: string
    segments: TranscriptionSegment[]
    language: string
    duration: number
}

export interface TranscriptionProgress {
    percent: number
}

export interface WhisperSettings {
    modelsPath: string
    selectedModel: string
    language: string
    downloadedModels: string[]
}

export interface SystemCheck {
    python: boolean
    pythonVersion: string
    ffmpeg: boolean
    ffmpegVersion: string
}

export const WHISPER_LANGUAGES = [
    { code: 'auto', label: 'Detectar automaticamente' },
    { code: 'pt', label: 'Português' },
    { code: 'en', label: 'English' },
    { code: 'es', label: 'Español' },
    { code: 'fr', label: 'Français' },
    { code: 'de', label: 'Deutsch' },
    { code: 'it', label: 'Italiano' },
    { code: 'ja', label: '日本語' },
    { code: 'ko', label: '한국어' },
    { code: 'zh', label: '中文' },
    { code: 'ru', label: 'Русский' },
    { code: 'ar', label: 'العربية' },
    { code: 'nl', label: 'Nederlands' },
    { code: 'pl', label: 'Polski' },
    { code: 'tr', label: 'Türkçe' },
    { code: 'sv', label: 'Svenska' },
    { code: 'uk', label: 'Українська' }
] as const
