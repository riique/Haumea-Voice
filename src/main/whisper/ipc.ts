import { ipcMain, dialog, BrowserWindow } from 'electron'
import { WHISPER_MODELS } from './model-registry'
import {
    listModelStates,
    downloadModel,
    cancelDownload,
    deleteModel,
    getWhisperSettings,
    saveWhisperSettings,
    modelsDir
} from './model-manager'
import {
    transcribe,
    cancelTranscription,
    checkSystem
} from './transcription-worker'
import type { TranscriptionRequest } from '../../shared/whisper'

export function setupWhisperIPC(getMainWindow: () => BrowserWindow | null): void {

    ipcMain.handle('whisper:list-models', () => {
        return WHISPER_MODELS.map(m => {
            const states = listModelStates()
            const state = states.find(s => s.id === m.id)
            return { ...m, state: state ?? { id: m.id, status: 'absent', progress: 0 } }
        })
    })

    ipcMain.handle('whisper:model-states', () => listModelStates())

    ipcMain.handle('whisper:download-model', async (_e, modelId: string) => {
        const win = getMainWindow()
        try {
            await downloadModel(modelId, (p) => {
                win?.webContents.send('whisper:download-progress', p)
            })
            return { ok: true }
        } catch (err) {
            const msg = (err as Error).message
            if (msg === 'aborted') return { ok: false, cancelled: true }
            return { ok: false, error: msg }
        }
    })

    ipcMain.handle('whisper:cancel-download', (_e, modelId: string) => cancelDownload(modelId))

    ipcMain.handle('whisper:delete-model', (_e, modelId: string) => deleteModel(modelId))

    ipcMain.handle('whisper:transcribe', async (_e, req: TranscriptionRequest) => {
        const win = getMainWindow()
        try {
            const result = await transcribe(req, (p) => {
                win?.webContents.send('whisper:transcription-progress', p)
            })
            win?.webContents.send('whisper:transcription-result', { ok: true, result })
            return { ok: true, result }
        } catch (err) {
            const msg = (err as Error).message
            win?.webContents.send('whisper:transcription-result', { ok: false, error: msg })
            return { ok: false, error: msg }
        }
    })

    ipcMain.handle('whisper:cancel-transcription', () => cancelTranscription())

    ipcMain.handle('whisper:check-system', () => checkSystem())

    ipcMain.handle('whisper:get-settings', () => getWhisperSettings())

    ipcMain.handle('whisper:save-settings', (_e, partial) => saveWhisperSettings(partial))

    ipcMain.handle('whisper:get-models-path', () => modelsDir())

    ipcMain.handle('whisper:set-models-path', async () => {
        const win = getMainWindow()
        if (!win) return null
        const result = await dialog.showOpenDialog(win, {
            properties: ['openDirectory'],
            title: 'Escolher diretorio para modelos Whisper'
        })
        if (result.canceled || !result.filePaths[0]) return null
        const newPath = result.filePaths[0]
        saveWhisperSettings({ modelsPath: newPath })
        return newPath
    })

    ipcMain.handle('whisper:select-audio-file', async () => {
        const win = getMainWindow()
        if (!win) return null
        const result = await dialog.showOpenDialog(win, {
            properties: ['openFile'],
            title: 'Escolher arquivo de audio',
            filters: [
                { name: 'Audio', extensions: ['mp3', 'wav', 'm4a', 'ogg', 'flac', 'webm', 'wma', 'aac'] }
            ]
        })
        if (result.canceled || !result.filePaths[0]) return null
        return result.filePaths[0]
    })
}
