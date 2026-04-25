import {
    app,
    BrowserWindow,
    ipcMain,
    globalShortcut,
    clipboard,
    Tray,
    Menu,
    nativeImage,
    screen,
    powerMonitor
} from 'electron'
import { join } from 'path'
import { exec } from 'child_process'
import { writeFileSync, readFileSync, unlinkSync, existsSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import Store from 'electron-store'
import {
    DEFAULT_GEMINI_SETTINGS,
    cloneGeminiSettings,
    normalizeGeminiSettings,
    type GeminiSettings
} from '../shared/gemini'
import {
    DEFAULT_GROQ_SETTINGS,
    cloneGroqSettings,
    normalizeGroqSettings,
    type GroqSettings
} from '../shared/groq'
import { setupWhisperIPC } from './whisper/ipc'

// Prevent Windows WASAPI "communications" classification that triggers
// OS ducking and Logitech G HUB automatic mic gain reduction.
// - AudioServiceOutOfProcess/Sandbox: keep audio in main process
// - WebRtcApmInAudioService: disable WebRTC audio processing module
app.commandLine.appendSwitch(
    'disable-features',
    'AudioServiceOutOfProcess,AudioServiceSandbox,WebRtcApmInAudioService'
)
app.commandLine.appendSwitch('disable-webrtc-agc')
app.commandLine.appendSwitch('disable-webrtc-hw-encoding')
app.commandLine.appendSwitch('disable-webrtc-hw-decoding')

interface HistoryEntry {
    text: string
    date: string
    error?: string
    audioId?: string
    feedback?: string
    feedbackCreatedAt?: string
}

const store = new Store({
    defaults: {
        apiKey: '',
        groqApiKeys: '',
        shortcut: 'CmdOrCtrl+Shift+R',
        history: [] as HistoryEntry[],
        overlayPos: null as { x: number; y: number } | null,
        sidebarCompact: false,
        widgetIconOnly: false,
        autoLaunch: false,
        selectedMic: '', // empty = system default
        transcriptionEngine: 'gemini' as 'gemini' | 'whisper' | 'groq',
        geminiSettings: cloneGeminiSettings(DEFAULT_GEMINI_SETTINGS),
        groqSettings: cloneGroqSettings(DEFAULT_GROQ_SETTINGS)
    }
})

function getStoredGeminiSettings(): GeminiSettings {
    return normalizeGeminiSettings(
        store.get('geminiSettings', cloneGeminiSettings(DEFAULT_GEMINI_SETTINGS)) as
        | Partial<GeminiSettings>
        | undefined
    )
}

function saveStoredGeminiSettings(settings: Partial<GeminiSettings>): GeminiSettings {
    const normalized = normalizeGeminiSettings(settings)
    store.set('geminiSettings', cloneGeminiSettings(normalized))
    return normalized
}

function getStoredGroqSettings(): GroqSettings {
    const normalized = normalizeGroqSettings(
        store.get('groqSettings', cloneGroqSettings(DEFAULT_GROQ_SETTINGS)) as
        | Partial<GroqSettings>
        | undefined
    )
    store.set('groqSettings', cloneGroqSettings(normalized))
    return normalized
}

function saveStoredGroqSettings(settings: Partial<GroqSettings>): GroqSettings {
    const normalized = normalizeGroqSettings(settings)
    store.set('groqSettings', cloneGroqSettings(normalized))
    return normalized
}

function audioDir(): string {
    const dir = join(app.getPath('userData'), 'failed-audio')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    return dir
}

function audioFilePath(audioId: string): string {
    return join(audioDir(), audioId + '.webm')
}

function deleteAudioFile(audioId?: string): void {
    if (!audioId) return
    const filePath = audioFilePath(audioId)
    if (existsSync(filePath)) unlinkSync(filePath)
}

let mainWindow: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isWidgetMode = false
let isQuitting = false
let isRecordingState = false
let currentShortcut = store.get('shortcut', 'CmdOrCtrl+Shift+R') as string

const WIN = { normal: { w: 860, h: 620 }, widget: { w: 340, h: 140 } }
const OVERLAY = { padding: 4, contentHeight: 34 }
const OVERLAY_WATCHDOG_MS = 1000

let overlayContentSize = {
    width: getInitialOverlayContentWidth(),
    height: OVERLAY.contentHeight
}
let overlayWatchdog: ReturnType<typeof setInterval> | null = null

function getInitialOverlayContentWidth(): number {
    return store.get('widgetIconOnly', false) ? 42 : 155
}

function getOverlayWindowSize(contentWidth: number, contentHeight = OVERLAY.contentHeight) {
    return {
        width: Math.max(1, Math.round(contentWidth + OVERLAY.padding * 2)),
        height: Math.max(1, Math.round(contentHeight + OVERLAY.padding * 2))
    }
}

function setOverlayHitArea(contentWidth: number, contentHeight = OVERLAY.contentHeight): void {
    if (!overlayWindow || overlayWindow.isDestroyed()) return

    overlayWindow.setShape([{
        x: OVERLAY.padding,
        y: OVERLAY.padding,
        width: Math.max(1, Math.round(contentWidth)),
        height: Math.max(1, Math.round(contentHeight))
    }])
}

function rememberOverlayContentSize(contentWidth: number, contentHeight = OVERLAY.contentHeight): void {
    overlayContentSize = {
        width: Math.max(1, Math.round(contentWidth)),
        height: Math.max(1, Math.round(contentHeight))
    }
}

function stopOverlayWatchdog(): void {
    if (!overlayWatchdog) return
    clearInterval(overlayWatchdog)
    overlayWatchdog = null
}

function startOverlayWatchdog(): void {
    stopOverlayWatchdog()

    // Windows can reorder topmost windows over time, so keep nudging the
    // overlay back to the front without stealing focus.
    if (process.platform !== 'win32') return

    overlayWatchdog = setInterval(() => {
        reassertOverlay()
    }, OVERLAY_WATCHDOG_MS)
    overlayWatchdog.unref?.()
}

// Recording state

function reassertOverlay(options: { ensureVisible?: boolean } = {}): void {
    if (!overlayWindow || overlayWindow.isDestroyed()) return

    setOverlayHitArea(overlayContentSize.width, overlayContentSize.height)
    overlayWindow.setAlwaysOnTop(true, 'screen-saver')

    if (options.ensureVisible && !overlayWindow.isVisible()) {
        overlayWindow.showInactive()
    }

    if (overlayWindow.isVisible()) {
        overlayWindow.moveTop()
    }
}

function broadcastRecording(cancelled = false): void {
    mainWindow?.webContents.send('set-recording', isRecordingState, cancelled)
    overlayWindow?.webContents.send('set-recording', isRecordingState, cancelled)
    reassertOverlay()
}

function toggleRecordingState(): void {
    isRecordingState = !isRecordingState
    broadcastRecording()
}

function stopRecordingState(): void {
    if (!isRecordingState) return
    isRecordingState = false
    broadcastRecording()
}

function cancelRecordingState(): void {
    if (!isRecordingState) return
    isRecordingState = false
    broadcastRecording(true)
}

// Windows

function createWindow(): void {
    const iconPath = join(__dirname, '../../resources/icon.png')
    mainWindow = new BrowserWindow({
        width: WIN.normal.w,
        height: WIN.normal.h,
        minWidth: 680,
        minHeight: 520,
        show: false,
        icon: iconPath,
        title: 'Haumea Voice',
        titleBarStyle: 'hidden',
        titleBarOverlay: {
            color: '#00000000',
            symbolColor: '#121214',
            height: 40
        },
        backgroundColor: '#f1ebd9',
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            sandbox: false
        }
    })

    const launchedHidden = process.argv.includes('--hidden')
    mainWindow.on('ready-to-show', () => {
        if (!launchedHidden) mainWindow?.show()
    })

    mainWindow.on('close', (e) => {
        if (!isQuitting && tray) {
            e.preventDefault()
            mainWindow?.hide()
        }
    })

    mainWindow.on('closed', () => { mainWindow = null })

    if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }
}

function createOverlay(): void {
    const initialWidth = getInitialOverlayContentWidth()
    const initialSize = getOverlayWindowSize(initialWidth)
    const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize
    const saved = store.get('overlayPos') as { x: number; y: number } | null

    let posX = saved?.x ?? sw - initialSize.width - 100
    let posY = saved?.y ?? sh - initialSize.height - 38

    // Validate saved position is within any visible display
    if (saved) {
        const visible = screen.getAllDisplays().some((d) => {
            const b = d.bounds
            return posX >= b.x && posX < b.x + b.width && posY >= b.y && posY < b.y + b.height
        })
        if (!visible) {
            posX = sw - initialSize.width - 100
            posY = sh - initialSize.height - 38
            store.set('overlayPos', { x: posX, y: posY })
        }
    }

    overlayWindow = new BrowserWindow({
        show: false,
        width: initialSize.width,
        height: initialSize.height,
        x: posX,
        y: posY,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        resizable: false,
        hasShadow: false,
        skipTaskbar: true,
        focusable: false,
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            sandbox: false
        }
    })

    rememberOverlayContentSize(initialWidth)
    startOverlayWatchdog()
    reassertOverlay()

    overlayWindow.on('moved', () => {
        if (!overlayWindow) return
        const [x, y] = overlayWindow.getPosition()
        store.set('overlayPos', { x, y })
        reassertOverlay()
    })

    overlayWindow.on('show', () => {
        reassertOverlay()
    })

    overlayWindow.on('restore', () => {
        reassertOverlay({ ensureVisible: true })
    })

    overlayWindow.on('closed', () => {
        stopOverlayWatchdog()
        overlayWindow = null
    })

    if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
        overlayWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#overlay')
    } else {
        overlayWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'overlay' })
    }

    overlayWindow.webContents.on('did-finish-load', () => {
        reassertOverlay()
    })

    overlayWindow.once('ready-to-show', () => {
        overlayWindow?.webContents.send('set-recording', isRecordingState)
        reassertOverlay({ ensureVisible: true })
    })
}

function resizeOverlayToContent(contentWidth: number, contentHeight = OVERLAY.contentHeight): boolean {
    if (!overlayWindow || overlayWindow.isDestroyed()) return false

    rememberOverlayContentSize(contentWidth, contentHeight)

    const nextSize = getOverlayWindowSize(contentWidth, contentHeight)
    const bounds = overlayWindow.getBounds()

    if (bounds.width === nextSize.width && bounds.height === nextSize.height) {
        reassertOverlay()
        return true
    }

    overlayWindow.setBounds({
        x: bounds.x,
        y: bounds.y,
        width: nextSize.width,
        height: nextSize.height
    })
    reassertOverlay()

    return true
}

// Tray

function createTray(): void {
    const iconPath = join(__dirname, '../../resources/icon.png')
    const icon = nativeImage.createFromPath(iconPath)
    if (icon.isEmpty()) return

    tray = new Tray(icon.resize({ width: 16, height: 16 }))
    tray.setToolTip('Haumea Voice')
    tray.setContextMenu(
        Menu.buildFromTemplate([
            {
                label: 'Abrir',
                click: () => { mainWindow?.show(); mainWindow?.focus() }
            },
            { type: 'separator' },
            {
                label: 'Gravar / Parar',
                click: () => toggleRecordingState()
            },
            { type: 'separator' },
            {
                label: 'Sair',
                click: () => { isQuitting = true; app.quit() }
            }
        ])
    )
    tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus() })
}

// Shortcuts

function registerShortcut(shortcut: string): boolean {
    globalShortcut.unregisterAll()
    try {
        globalShortcut.register(shortcut, toggleRecordingState)
        return true
    } catch {
        globalShortcut.register('CmdOrCtrl+Shift+R', toggleRecordingState)
        return false
    }
}

// Paste helper

function pasteToActiveWindow(text: string): void {
    clipboard.writeText(text)
    setTimeout(() => {
        exec(`powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')"`, (err) => {
            if (err) console.error('Paste failed:', err)
        })
    }, 150)
}

// IPC

function setupIPC(): void {
    ipcMain.handle('get-api-key', () => store.get('apiKey', ''))
    ipcMain.handle('save-api-key', (_e, key: string) => { store.set('apiKey', key); return true })
    ipcMain.handle('get-groq-api-keys', () => store.get('groqApiKeys', ''))
    ipcMain.handle('save-groq-api-keys', (_e, keys: string) => { store.set('groqApiKeys', keys); return true })
    ipcMain.handle('get-gemini-settings', () => getStoredGeminiSettings())
    ipcMain.handle('save-gemini-settings', (_e, settings: Partial<GeminiSettings>) =>
        saveStoredGeminiSettings(settings)
    )
    ipcMain.handle('get-groq-settings', () => getStoredGroqSettings())
    ipcMain.handle('save-groq-settings', (_e, settings: Partial<GroqSettings>) =>
        saveStoredGroqSettings(settings)
    )

    ipcMain.handle('get-shortcut', () => currentShortcut)
    ipcMain.handle('save-shortcut', (_e, s: string) => {
        const ok = registerShortcut(s)
        if (ok) { currentShortcut = s; store.set('shortcut', s) }
        return ok
    })

    ipcMain.handle('request-toggle-recording', () => { toggleRecordingState(); return isRecordingState })
    ipcMain.handle('request-stop-recording', () => { stopRecordingState(); return false })
    ipcMain.handle('request-cancel-recording', () => { cancelRecordingState(); return false })

    ipcMain.handle('copy-and-paste', (_e, text: string) => { pasteToActiveWindow(text); return true })
    ipcMain.handle('copy-to-clipboard', (_e, text: string) => { clipboard.writeText(text); return true })

    ipcMain.handle('get-history', () => store.get('history', []))
    ipcMain.handle('add-history', (_e, entry: HistoryEntry) => {
        const h = store.get('history', []) as HistoryEntry[]
        h.unshift(entry)
        store.set('history', h)
        return true
    })
    ipcMain.handle('clear-history', () => {
        const h = store.get('history', []) as HistoryEntry[]
        for (const e of h) deleteAudioFile(e.audioId)
        store.set('history', [])
        return true
    })

    ipcMain.handle('save-history-audio', (_e, b64: string) => {
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
        const filePath = audioFilePath(id)
        writeFileSync(filePath, Buffer.from(b64, 'base64'))
        return id
    })

    ipcMain.handle('get-history-audio', (_e, audioId: string) => {
        const filePath = audioFilePath(audioId)
        if (!existsSync(filePath)) return null
        return readFileSync(filePath).toString('base64')
    })

    ipcMain.handle('delete-history-audio', (_e, audioId: string) => {
        deleteAudioFile(audioId)
        return true
    })

    ipcMain.handle('remove-history-entry', (_e, date: string) => {
        const h = store.get('history', []) as HistoryEntry[]
        const idx = h.findIndex(e => e.date === date)
        if (idx >= 0) {
            deleteAudioFile(h[idx].audioId)
            h.splice(idx, 1)
            store.set('history', h)
        }
        return true
    })

    ipcMain.handle('update-history-entry', (_e, date: string, update: Partial<HistoryEntry>) => {
        const h = store.get('history', []) as HistoryEntry[]
        const idx = h.findIndex(e => e.date === date)
        if (idx >= 0) {
            h[idx] = { ...h[idx], ...update }
            store.set('history', h)
        }
        return true
    })

    ipcMain.handle('broadcast-error', (_e, msg: string) => {
        mainWindow?.webContents.send('set-error', msg)
        overlayWindow?.webContents.send('set-error', msg)
    })

    ipcMain.handle('set-ignore-mouse-events', (e, ignore: boolean, opts?: { forward: boolean }) => {
        const win = BrowserWindow.fromWebContents(e.sender)
        win?.setIgnoreMouseEvents(ignore, opts)
    })

    ipcMain.handle('set-overlay-size', (_e, width: number, height: number) =>
        resizeOverlayToContent(width, height)
    )

    ipcMain.handle('get-sidebar-compact', () => store.get('sidebarCompact', false))
    ipcMain.handle('save-sidebar-compact', (_e, val: boolean) => {
        store.set('sidebarCompact', val)
        mainWindow?.webContents.send('sidebar-compact-changed', val)
        return true
    })

    ipcMain.handle('get-widget-icon-only', () => store.get('widgetIconOnly', false))
    ipcMain.handle('save-widget-icon-only', (_e, val: boolean) => {
        store.set('widgetIconOnly', val)
        overlayWindow?.webContents.send('widget-icon-only-changed', val)
        return true
    })

    ipcMain.handle('broadcast-transcribing', (_e, val: boolean) => {
        mainWindow?.webContents.send('set-transcribing', val)
        overlayWindow?.webContents.send('set-transcribing', val)
        if (!val) reassertOverlay()
    })

    ipcMain.handle('toggle-widget-mode', () => {
        if (!mainWindow) return false
        isWidgetMode = !isWidgetMode

        if (isWidgetMode) {
            mainWindow.setMinimumSize(WIN.widget.w, WIN.widget.h)
            mainWindow.setSize(WIN.widget.w, WIN.widget.h)
            mainWindow.setAlwaysOnTop(true, 'floating')
            mainWindow.setResizable(false)
            mainWindow.setSkipTaskbar(true)
        } else {
            mainWindow.setAlwaysOnTop(false)
            mainWindow.setResizable(true)
            mainWindow.setSkipTaskbar(false)
            mainWindow.setMinimumSize(680, 520)
            mainWindow.setSize(WIN.normal.w, WIN.normal.h)
        }

        mainWindow.center()
        mainWindow.webContents.send('widget-mode-changed', isWidgetMode)
        return isWidgetMode
    })

    ipcMain.handle('get-widget-mode', () => isWidgetMode)

    ipcMain.handle('get-auto-launch', () => store.get('autoLaunch', false))
    ipcMain.handle('save-auto-launch', (_e, val: boolean) => {
        store.set('autoLaunch', val)
        app.setLoginItemSettings({
            openAtLogin: val,
            args: ['--hidden']
        })
        return true
    })

    ipcMain.handle('get-selected-mic', () => store.get('selectedMic', ''))
    ipcMain.handle('save-selected-mic', (_e, deviceId: string) => {
        store.set('selectedMic', deviceId)
        return true
    })

    ipcMain.handle('get-transcription-engine', () => store.get('transcriptionEngine', 'gemini'))
    ipcMain.handle('save-transcription-engine', (_e, engine: 'gemini' | 'whisper' | 'groq') => {
        store.set('transcriptionEngine', engine)
        mainWindow?.webContents.send('transcription-engine-changed', engine)
        overlayWindow?.webContents.send('transcription-engine-changed', engine)
        return true
    })

    // Save audio blob to temp file so Whisper can read it
    ipcMain.handle('save-temp-audio', (_e, b64: string, ext: string) => {
        const dir = join(tmpdir(), 'haumea-voice-temp')
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
        const filePath = join(dir, `${id}.${ext}`)
        writeFileSync(filePath, Buffer.from(b64, 'base64'))
        return filePath
    })

    ipcMain.handle('delete-temp-audio', (_e, filePath: string) => {
        if (filePath && existsSync(filePath)) unlinkSync(filePath)
        return true
    })
}

// Boot

app.whenReady().then(() => {
    setupIPC()
    setupWhisperIPC(() => mainWindow)
    createWindow()
    createOverlay()
    createTray()
    registerShortcut(currentShortcut)

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
        reassertOverlay({ ensureVisible: true })
    })

    app.on('browser-window-focus', () => {
        reassertOverlay()
    })

    screen.on('display-added', () => {
        reassertOverlay({ ensureVisible: true })
    })

    screen.on('display-removed', () => {
        reassertOverlay({ ensureVisible: true })
    })

    screen.on('display-metrics-changed', () => {
        reassertOverlay({ ensureVisible: true })
    })

    powerMonitor.on('resume', () => {
        reassertOverlay({ ensureVisible: true })
    })

    powerMonitor.on('unlock-screen', () => {
        reassertOverlay({ ensureVisible: true })
    })
})

app.on('before-quit', () => {
    isQuitting = true
    stopOverlayWatchdog()
})
app.on('will-quit', () => { globalShortcut.unregisterAll() })
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})
