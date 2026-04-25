import { useState, useEffect, useCallback, useRef } from 'react'
import Sidebar, { type Route } from './components/Sidebar'
import OverviewPage from './components/pages/OverviewPage'
import HistoryPage from './components/pages/HistoryPage'
import ShortcutsPage from './components/pages/ShortcutsPage'
import SettingsPage from './components/pages/SettingsPage'
import TranscriptionPage from './components/pages/TranscriptionPage'
import WidgetView from './components/WidgetView'
import WidgetOverlay from './components/WidgetOverlay'
import {
    transcribeWithNonEmptyRetry,
    type TranscriptionEngine
} from './services/transcription'

const IS_OVERLAY = window.location.hash === '#overlay'

function blobToB64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const r = new FileReader()
        r.onloadend = () => resolve((r.result as string).split(',')[1])
        r.onerror = reject
        r.readAsDataURL(blob)
    })
}

async function saveAudioForHistory(blob: Blob): Promise<string> {
    const b64 = await blobToB64(blob)
    return window.api.saveHistoryAudio(b64)
}

// Persists error to history so the user always sees what happened
async function logError(msg: string, opts: { blob?: Blob | null; audioId?: string } = {}) {
    try {
        let audioId = opts.audioId

        if (!audioId && opts.blob && opts.blob.size > 0) {
            audioId = await saveAudioForHistory(opts.blob)
        }

        await window.api.addHistory({ text: '', date: new Date().toISOString(), error: msg, audioId })
    } catch {
        await window.api.addHistory({ text: '', date: new Date().toISOString(), error: msg })
    }
}

function emptyTranscriptionMessage(text: string): string | null {
    const trimmed = text.trim()
    if (!trimmed) return 'A transcrição voltou vazia: nenhuma palavra foi detectada.'
    if (trimmed.toLowerCase() === '[silencio]') {
        return 'Áudio sem fala detectável: o motor retornou [silencio].'
    }
    return null
}

export default function App() {
    if (IS_OVERLAY) return <WidgetOverlay />

    const [route, setRoute] = useState<Route>('overview')
    const [isWidget, setIsWidget] = useState(false)
    const [isRecording, setIsRecording] = useState(false)
    const [elapsed, setElapsed] = useState(0)
    const [transcript, setTranscript] = useState('')
    const [transcribing, setTranscribing] = useState(false)
    const [error, setError] = useState('')
    const [shortcut, setShortcut] = useState('CmdOrCtrl+Shift+R')
    const [micDeviceId, setMicDeviceId] = useState('')
    const [activeStream, setActiveStream] = useState<MediaStream | null>(null)

    const transcribingRef = useRef(false)
    const cancelledRef = useRef(false)
    const sessionRef = useRef(0)
    const recorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<Blob[]>([])
    const streamRef = useRef<MediaStream | null>(null)
    const engineRef = useRef<TranscriptionEngine>('gemini')

    useEffect(() => {
        window.api.getShortcut().then(setShortcut)
        window.api.getSelectedMic().then(setMicDeviceId)
        window.api.getTranscriptionEngine().then(e => { engineRef.current = e })

        const unsub = window.api.onTranscriptionEngineChanged((e) => { engineRef.current = e })
        return unsub
    }, [])

    useEffect(() => {
        const unsub = window.api.onWidgetModeChanged((val) => setIsWidget(val))
        return unsub
    }, [])

    useEffect(() => {
        const unsub = window.api.onSetRecording((val, wasCancelled) => {
            setIsRecording(val)
            if (!val && wasCancelled) {
                cancelledRef.current = true
                setElapsed(0)
            }
        })
        return unsub
    }, [])

    // ── Timer ──
    useEffect(() => {
        if (!isRecording) return
        setElapsed(0)
        const id = setInterval(() => setElapsed((p) => p + 1), 1000)
        return () => clearInterval(id)
    }, [isRecording])

    // ── MediaRecorder — lives at App level, survives route/widget changes ──
    useEffect(() => {
        if (!isRecording) {
            const recorder = recorderRef.current
            if (recorder && recorder.state !== 'inactive') {
                try { recorder.requestData() } catch { /* noop */ }
                recorder.stop()
            }
            return
        }

        // Reset state for new session
        sessionRef.current++
        setTranscript('')
        setError('')
        setElapsed(0)
        cancelledRef.current = false
        transcribingRef.current = false

        let cancelled = false

        const start = async () => {
            const audioConstraints: MediaTrackConstraints = {
                autoGainControl: false,
                noiseSuppression: false,
                echoCancellation: false,
                channelCount: 1,
                sampleRate: 48000
            }
            if (micDeviceId) {
                audioConstraints.deviceId = { exact: micDeviceId }
            }

            let stream: MediaStream
            try {
                stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints })
            } catch (firstErr) {
                // Selected mic unavailable — fall back to default
                if (micDeviceId) {
                    try {
                        stream = await navigator.mediaDevices.getUserMedia({
                            audio: {
                                autoGainControl: false,
                                noiseSuppression: false,
                                echoCancellation: false,
                                channelCount: 1,
                                sampleRate: 48000
                            }
                        })
                    } catch (fallbackErr) {
                        const msg = `Microfone indisponível: ${fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)}`
                        await logError(msg)
                        window.api.broadcastError(msg)
                        window.api.requestStopRecording()
                        return
                    }
                } else {
                    const msg = `Erro ao acessar microfone: ${firstErr instanceof Error ? firstErr.message : String(firstErr)}`
                    await logError(msg)
                    window.api.broadcastError(msg)
                    window.api.requestStopRecording()
                    return
                }
            }

            if (cancelled) {
                stream.getTracks().forEach((t) => t.stop())
                return
            }

            streamRef.current = stream
            setActiveStream(stream)

            const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
            recorderRef.current = recorder
            chunksRef.current = []

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data)
            }

            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
                stream.getTracks().forEach((t) => t.stop())
                streamRef.current = null
                setActiveStream(null)

                if (blob.size > 0 && !cancelledRef.current) {
                    handleAudioReady(blob)
                }
            }

            recorder.onerror = async (ev) => {
                const msg = `Erro no MediaRecorder: ${(ev as ErrorEvent).message || 'desconhecido'}`
                await logError(msg)
                window.api.broadcastError(msg)
                stream.getTracks().forEach((t) => t.stop())
                streamRef.current = null
                setActiveStream(null)
                window.api.requestStopRecording()
            }

            recorder.start(250)
        }

        start()

        return () => { cancelled = true }
    }, [isRecording, micDeviceId])

    // Unmount-only: release hardware
    useEffect(() => {
        return () => {
            const rec = recorderRef.current
            if (rec && rec.state !== 'inactive') {
                try { rec.requestData() } catch { /* noop */ }
                rec.stop()
            }
            const s = streamRef.current
            if (s) {
                s.getTracks().forEach((t) => t.stop())
                streamRef.current = null
            }
        }
    }, [])

    const toggleRecording = useCallback(() => {
        window.api.requestToggleRecording()
    }, [])

    const stopRecording = useCallback(() => {
        window.api.requestStopRecording()
    }, [])

    const cancelRecording = useCallback(() => {
        window.api.requestCancelRecording()
    }, [])

    const handleAudioReady = useCallback(async (blob: Blob) => {
        if (blob.size < 1000) {
            await logError(`Gravação muito curta (${blob.size} bytes) — nenhum áudio capturado`)
            return
        }

        const sid = sessionRef.current

        if (cancelledRef.current) return
        if (transcribingRef.current) return
        transcribingRef.current = true
        setTranscribing(true)
        setError('')
        window.api.broadcastTranscribing(true)

        try {
            const text = await transcribeWithNonEmptyRetry(blob, engineRef.current, 2)

            if (sessionRef.current !== sid) return

            const emptyMessage = emptyTranscriptionMessage(text)
            if (emptyMessage) {
                setError(emptyMessage)
                window.api.broadcastError(emptyMessage)
                await logError(emptyMessage, { blob })
                return
            }

            const audioId = await saveAudioForHistory(blob).catch((saveErr) => {
                console.warn('Não foi possível salvar o áudio da transcrição:', saveErr)
                return undefined
            })

            if (sessionRef.current !== sid) return

            setTranscript(text)
            await window.api.copyToClipboard(text)
            await window.api.copyAndPaste(text)
            await window.api.addHistory({ text, date: new Date().toISOString(), audioId })
        } catch (err) {
            if (sessionRef.current !== sid) return

            const msg = err instanceof Error ? err.message : 'Erro na transcrição'
            setError(msg)
            window.api.broadcastError(msg)
            await logError(msg, { blob })
        } finally {
            setTranscribing(false)
            transcribingRef.current = false
            setElapsed(0)
            window.api.broadcastTranscribing(false)
        }
    }, [])

    if (isWidget) {
        return (
            <WidgetView
                isRecording={isRecording}
                elapsed={elapsed}
                onToggle={toggleRecording}
                onStop={stopRecording}
                onCancel={cancelRecording}
                shortcut={shortcut}
            />
        )
    }

    return (
        <div className="h-screen flex bg-bg overflow-hidden">
            <Sidebar active={route} onChange={setRoute} />

            <main className="flex-1 flex flex-col min-h-0 min-w-0">
                {/* Titlebar drag area */}
                <div
                    className="h-8 shrink-0"
                    style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
                />

                {/* Page content */}
                <div className="flex-1 min-h-0">
                    {route === 'overview' && (
                        <OverviewPage
                            isRecording={isRecording}
                            elapsed={elapsed}
                            onToggle={toggleRecording}
                            onStop={stopRecording}
                            onCancel={cancelRecording}
                            transcribing={transcribing}
                            shortcut={shortcut}
                            transcript={transcript}
                            activeStream={activeStream}
                        />
                    )}
                    {route === 'history' && <HistoryPage />}
                    {route === 'transcription' && <TranscriptionPage />}
                    {route === 'shortcuts' && (
                        <ShortcutsPage shortcut={shortcut} onShortcutChange={setShortcut} />
                    )}
                    {route === 'settings' && <SettingsPage />}
                </div>
            </main>
        </div>
    )
}
