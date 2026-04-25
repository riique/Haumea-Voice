import { contextBridge, ipcRenderer } from 'electron'
import type { GeminiSettings } from '../shared/gemini'
import type { GroqSettings } from '../shared/groq'
import type {
    TranscriptionRequest,
    TranscriptionResult,
    TranscriptionProgress,
    DownloadProgress,
    ModelState,
    WhisperSettings,
    SystemCheck
} from '../shared/whisper'

export interface HistoryEntry {
    text: string
    date: string
    error?: string
    audioId?: string
    feedback?: string
    feedbackCreatedAt?: string
}

const api = {
    getApiKey: (): Promise<string> => ipcRenderer.invoke('get-api-key'),
    saveApiKey: (key: string): Promise<boolean> => ipcRenderer.invoke('save-api-key', key),
    getGroqApiKeys: (): Promise<string> => ipcRenderer.invoke('get-groq-api-keys'),
    saveGroqApiKeys: (keys: string): Promise<boolean> => ipcRenderer.invoke('save-groq-api-keys', keys),
    getGeminiSettings: (): Promise<GeminiSettings> => ipcRenderer.invoke('get-gemini-settings'),
    saveGeminiSettings: (settings: GeminiSettings): Promise<GeminiSettings> =>
        ipcRenderer.invoke('save-gemini-settings', settings),
    getGroqSettings: (): Promise<GroqSettings> => ipcRenderer.invoke('get-groq-settings'),
    saveGroqSettings: (settings: GroqSettings): Promise<GroqSettings> =>
        ipcRenderer.invoke('save-groq-settings', settings),

    getShortcut: (): Promise<string> => ipcRenderer.invoke('get-shortcut'),
    saveShortcut: (shortcut: string): Promise<boolean> => ipcRenderer.invoke('save-shortcut', shortcut),

    requestToggleRecording: (): Promise<boolean> => ipcRenderer.invoke('request-toggle-recording'),
    requestStopRecording: (): Promise<boolean> => ipcRenderer.invoke('request-stop-recording'),
    requestCancelRecording: (): Promise<boolean> => ipcRenderer.invoke('request-cancel-recording'),

    onSetRecording: (cb: (isRecording: boolean, cancelled: boolean) => void) => {
        const handler = (_e: Electron.IpcRendererEvent, val: boolean, cancelled: boolean) => cb(val, cancelled ?? false)
        ipcRenderer.on('set-recording', handler)
        return () => { ipcRenderer.removeListener('set-recording', handler) }
    },

    copyAndPaste: (text: string): Promise<boolean> => ipcRenderer.invoke('copy-and-paste', text),
    copyToClipboard: (text: string): Promise<boolean> => ipcRenderer.invoke('copy-to-clipboard', text),

    getHistory: (): Promise<HistoryEntry[]> => ipcRenderer.invoke('get-history'),
    addHistory: (entry: HistoryEntry): Promise<boolean> => ipcRenderer.invoke('add-history', entry),
    clearHistory: (): Promise<boolean> => ipcRenderer.invoke('clear-history'),
    removeHistoryEntry: (date: string): Promise<boolean> => ipcRenderer.invoke('remove-history-entry', date),
    updateHistoryEntry: (date: string, update: Partial<HistoryEntry>): Promise<boolean> =>
        ipcRenderer.invoke('update-history-entry', date, update),

    saveHistoryAudio: (b64: string): Promise<string> => ipcRenderer.invoke('save-history-audio', b64),
    getHistoryAudio: (audioId: string): Promise<string | null> => ipcRenderer.invoke('get-history-audio', audioId),
    deleteHistoryAudio: (audioId: string): Promise<boolean> => ipcRenderer.invoke('delete-history-audio', audioId),

    setIgnoreMouseEvents: (ignore: boolean, opts?: { forward: boolean }): Promise<void> =>
        ipcRenderer.invoke('set-ignore-mouse-events', ignore, opts),
    setOverlaySize: (width: number, height: number): Promise<boolean> =>
        ipcRenderer.invoke('set-overlay-size', width, height),

    toggleWidgetMode: (): Promise<boolean> => ipcRenderer.invoke('toggle-widget-mode'),
    getWidgetMode: (): Promise<boolean> => ipcRenderer.invoke('get-widget-mode'),

    onWidgetModeChanged: (cb: (isWidget: boolean) => void) => {
        const handler = (_e: Electron.IpcRendererEvent, val: boolean) => cb(val)
        ipcRenderer.on('widget-mode-changed', handler)
        return () => { ipcRenderer.removeListener('widget-mode-changed', handler) }
    },

    getSidebarCompact: (): Promise<boolean> => ipcRenderer.invoke('get-sidebar-compact'),
    saveSidebarCompact: (val: boolean): Promise<boolean> => ipcRenderer.invoke('save-sidebar-compact', val),

    onSidebarCompactChanged: (cb: (compact: boolean) => void) => {
        const handler = (_e: Electron.IpcRendererEvent, val: boolean) => cb(val)
        ipcRenderer.on('sidebar-compact-changed', handler)
        return () => { ipcRenderer.removeListener('sidebar-compact-changed', handler) }
    },

    getWidgetIconOnly: (): Promise<boolean> => ipcRenderer.invoke('get-widget-icon-only'),
    saveWidgetIconOnly: (val: boolean): Promise<boolean> => ipcRenderer.invoke('save-widget-icon-only', val),

    onWidgetIconOnlyChanged: (cb: (iconOnly: boolean) => void) => {
        const handler = (_e: Electron.IpcRendererEvent, val: boolean) => cb(val)
        ipcRenderer.on('widget-icon-only-changed', handler)
        return () => { ipcRenderer.removeListener('widget-icon-only-changed', handler) }
    },

    broadcastTranscribing: (val: boolean): Promise<void> => ipcRenderer.invoke('broadcast-transcribing', val),

    onTranscribing: (cb: (val: boolean) => void) => {
        const handler = (_e: Electron.IpcRendererEvent, val: boolean) => cb(val)
        ipcRenderer.on('set-transcribing', handler)
        return () => { ipcRenderer.removeListener('set-transcribing', handler) }
    },

    broadcastError: (msg: string): Promise<void> => ipcRenderer.invoke('broadcast-error', msg),

    onError: (cb: (msg: string) => void) => {
        const handler = (_e: Electron.IpcRendererEvent, msg: string) => cb(msg)
        ipcRenderer.on('set-error', handler)
        return () => { ipcRenderer.removeListener('set-error', handler) }
    },

    getAutoLaunch: (): Promise<boolean> => ipcRenderer.invoke('get-auto-launch'),
    saveAutoLaunch: (val: boolean): Promise<boolean> => ipcRenderer.invoke('save-auto-launch', val),


    getSelectedMic: (): Promise<string> => ipcRenderer.invoke('get-selected-mic'),
    saveSelectedMic: (deviceId: string): Promise<boolean> => ipcRenderer.invoke('save-selected-mic', deviceId),

    getTranscriptionEngine: (): Promise<'gemini' | 'whisper' | 'groq'> => ipcRenderer.invoke('get-transcription-engine'),
    saveTranscriptionEngine: (engine: 'gemini' | 'whisper' | 'groq'): Promise<boolean> => ipcRenderer.invoke('save-transcription-engine', engine),

    onTranscriptionEngineChanged: (cb: (engine: 'gemini' | 'whisper' | 'groq') => void) => {
        const handler = (_e: Electron.IpcRendererEvent, engine: 'gemini' | 'whisper' | 'groq') => cb(engine)
        ipcRenderer.on('transcription-engine-changed', handler)
        return () => { ipcRenderer.removeListener('transcription-engine-changed', handler) }
    },

    saveTempAudio: (b64: string, ext: string): Promise<string> => ipcRenderer.invoke('save-temp-audio', b64, ext),
    deleteTempAudio: (filePath: string): Promise<boolean> => ipcRenderer.invoke('delete-temp-audio', filePath),

    // ── Whisper (offline transcription) ──

    whisperListModels: () => ipcRenderer.invoke('whisper:list-models'),
    whisperModelStates: (): Promise<ModelState[]> => ipcRenderer.invoke('whisper:model-states'),
    whisperDownloadModel: (modelId: string) => ipcRenderer.invoke('whisper:download-model', modelId),
    whisperCancelDownload: (modelId: string) => ipcRenderer.invoke('whisper:cancel-download', modelId),
    whisperDeleteModel: (modelId: string) => ipcRenderer.invoke('whisper:delete-model', modelId),
    whisperTranscribe: (req: TranscriptionRequest) => ipcRenderer.invoke('whisper:transcribe', req),
    whisperCancelTranscription: () => ipcRenderer.invoke('whisper:cancel-transcription'),
    whisperCheckSystem: (): Promise<SystemCheck> => ipcRenderer.invoke('whisper:check-system'),
    whisperGetSettings: (): Promise<WhisperSettings> => ipcRenderer.invoke('whisper:get-settings'),
    whisperSaveSettings: (partial: Partial<WhisperSettings>) => ipcRenderer.invoke('whisper:save-settings', partial),
    whisperGetModelsPath: (): Promise<string> => ipcRenderer.invoke('whisper:get-models-path'),
    whisperSetModelsPath: (): Promise<string | null> => ipcRenderer.invoke('whisper:set-models-path'),
    whisperSelectAudioFile: (): Promise<string | null> => ipcRenderer.invoke('whisper:select-audio-file'),

    onWhisperDownloadProgress: (cb: (p: DownloadProgress) => void) => {
        const handler = (_e: Electron.IpcRendererEvent, p: DownloadProgress) => cb(p)
        ipcRenderer.on('whisper:download-progress', handler)
        return () => { ipcRenderer.removeListener('whisper:download-progress', handler) }
    },

    onWhisperTranscriptionProgress: (cb: (p: TranscriptionProgress) => void) => {
        const handler = (_e: Electron.IpcRendererEvent, p: TranscriptionProgress) => cb(p)
        ipcRenderer.on('whisper:transcription-progress', handler)
        return () => { ipcRenderer.removeListener('whisper:transcription-progress', handler) }
    },

    onWhisperTranscriptionResult: (cb: (r: { ok: boolean; result?: TranscriptionResult; error?: string }) => void) => {
        const handler = (_e: Electron.IpcRendererEvent, r: { ok: boolean; result?: TranscriptionResult; error?: string }) => cb(r)
        ipcRenderer.on('whisper:transcription-result', handler)
        return () => { ipcRenderer.removeListener('whisper:transcription-result', handler) }
    }
}

export type ElectronAPI = typeof api

contextBridge.exposeInMainWorld('api', api)
