export type UpdateStatusName =
    | 'idle'
    | 'checking'
    | 'downloading'
    | 'downloaded'
    | 'not-available'
    | 'error'

export interface UpdateStatus {
    status: UpdateStatusName
    currentVersion: string
    latestVersion?: string
    mandatory: boolean
    percent?: number
    bytesPerSecond?: number
    message?: string
}

