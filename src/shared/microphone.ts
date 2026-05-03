export interface PrepareMicrophoneRequest {
    preferredLabels: string[]
}

export interface PrepareMicrophoneResult {
    ok: boolean
    platform: string
    selectedSource?: string
    selectedDescription?: string
    warnings: string[]
}
