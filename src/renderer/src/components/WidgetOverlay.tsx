import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Square, X, AlertTriangle } from 'lucide-react'
import HaumeaIcon from './HaumeaIcon'

function pad(n: number): string {
    return String(n).padStart(2, '0')
}

function fmt(secs: number): string {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${pad(m)}:${pad(s)}`
}

type Phase = 'idle' | 'recording' | 'loading' | 'error'
const WIDGET_HEIGHT = 34

export default function WidgetOverlay() {
    const [recording, setRecording] = useState(false)
    const [transcribing, setTranscribing] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')
    const [elapsed, setElapsed] = useState(0)
    const [iconOnly, setIconOnly] = useState(false)

    useEffect(() => {
        document.documentElement.classList.add('overlay-mode')
        return () => document.documentElement.classList.remove('overlay-mode')
    }, [])

    useEffect(() => {
        window.api.getWidgetIconOnly().then(setIconOnly)
        const unsub = window.api.onWidgetIconOnlyChanged(setIconOnly)
        return unsub
    }, [])

    useEffect(() => {
        const unsub = window.api.onSetRecording((val, _cancelled) => {
            setRecording(val)
            if (val) {
                setElapsed(0)
                setErrorMsg('')
            }
        })
        return unsub
    }, [])

    useEffect(() => {
        const unsub = window.api.onTranscribing((val) => {
            setTranscribing(val)
            if (val) setErrorMsg('')
        })
        return unsub
    }, [])

    useEffect(() => {
        const unsub = window.api.onError((msg) => {
            setErrorMsg(msg)
            // auto-dismiss after 4s
            setTimeout(() => setErrorMsg(''), 4000)
        })
        return unsub
    }, [])

    useEffect(() => {
        if (!recording) return
        const id = setInterval(() => setElapsed((p) => p + 1), 1000)
        return () => clearInterval(id)
    }, [recording])

    const stop = useCallback(() => {
        window.api.requestStopRecording()
    }, [])

    const cancel = useCallback(() => {
        window.api.requestCancelRecording()
    }, [])

    const phase: Phase = recording
        ? 'recording'
        : transcribing
            ? 'loading'
            : errorMsg
                ? 'error'
                : 'idle'

    const widthMap: Record<Phase, number> = {
        idle: iconOnly ? 42 : 155,
        recording: 200,
        loading: iconOnly ? 42 : 130,
        error: iconOnly ? 42 : 150
    }

    const contentWidth = widthMap[phase]

    useEffect(() => {
        void window.api.setOverlaySize(contentWidth, WIDGET_HEIGHT)
    }, [contentWidth])

    return (
        <div className="w-full h-full flex items-center justify-center p-1">
            <motion.div
                className="h-[34px] rounded-[10px] flex items-center overflow-hidden cursor-default"
                style={{
                    width: contentWidth,
                    WebkitAppRegion: 'drag',
                    background: phase === 'error'
                        ? 'rgba(180, 30, 20, 0.92)'
                        : 'rgba(24, 24, 27, 0.92)',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.25), 0 0 0 0.5px rgba(255,255,255,0.06) inset'
                } as React.CSSProperties}
            >
                <AnimatePresence mode="wait">
                    {phase === 'recording' && (
                        <motion.div
                            key="rec"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="flex items-center gap-2.5 w-full px-3"
                        >
                            {/* Pulse dot */}
                            <div className="relative flex items-center justify-center shrink-0">
                                <motion.div
                                    animate={{
                                        scale: [1, 1.9, 1],
                                        opacity: [0.4, 0, 0.4]
                                    }}
                                    transition={{
                                        repeat: Infinity,
                                        duration: 1.5,
                                        ease: 'easeInOut'
                                    }}
                                    className="absolute w-2 h-2 rounded-full bg-accent/50"
                                />
                                <motion.div
                                    animate={{ opacity: [0.8, 1, 0.8] }}
                                    transition={{ repeat: Infinity, duration: 1 }}
                                    className="w-2 h-2 rounded-full bg-accent"
                                />
                            </div>

                            {/* Timer */}
                            <span
                                className="font-mono text-[11px] font-semibold tabular-nums tracking-wider flex-1"
                                style={{ color: 'rgba(255,255,255,0.9)' }}
                            >
                                {fmt(elapsed)}
                            </span>

                            {/* Stop */}
                            <button
                                onClick={stop}
                                className="p-1 rounded-md transition-colors"
                                style={{
                                    WebkitAppRegion: 'no-drag',
                                    color: 'rgba(255,255,255,0.7)'
                                } as React.CSSProperties}
                                title="Parar e transcrever"
                            >
                                <Square size={9} fill="currentColor" strokeWidth={0} />
                            </button>

                            {/* Cancel */}
                            <button
                                onClick={cancel}
                                className="p-1 rounded-md transition-colors"
                                style={{
                                    WebkitAppRegion: 'no-drag',
                                    color: 'rgba(255,255,255,0.4)'
                                } as React.CSSProperties}
                                title="Cancelar (sem transcrever)"
                            >
                                <X size={11} strokeWidth={2} />
                            </button>
                        </motion.div>
                    )}

                    {phase === 'loading' && (
                        <motion.div
                            key="loading"
                            initial={{ opacity: 0, scale: 0.85 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.85 }}
                            transition={{ duration: 0.12 }}
                            className="flex items-center gap-2 w-full justify-center px-3"
                        >
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{
                                    repeat: Infinity,
                                    duration: 2,
                                    ease: 'linear'
                                }}
                                className="shrink-0"
                            >
                                <HaumeaIcon size={16} className="text-accent" />
                            </motion.div>

                            {!iconOnly && (
                                <motion.span
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: [0.5, 1, 0.5] }}
                                    transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
                                    className="font-mono text-[10px] font-semibold tracking-wider"
                                    style={{ color: 'rgba(255,255,255,0.6)' }}
                                >
                                    Transcrevendo…
                                </motion.span>
                            )}
                        </motion.div>
                    )}

                    {phase === 'error' && (
                        <motion.div
                            key="error"
                            initial={{ opacity: 0, scale: 0.85 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.85 }}
                            transition={{ duration: 0.12 }}
                            className={`flex items-center gap-2 w-full ${iconOnly ? 'justify-center' : 'px-3'}`}
                        >
                            <AlertTriangle
                                size={iconOnly ? 16 : 13}
                                strokeWidth={2}
                                className="shrink-0"
                                style={{ color: 'rgba(255,255,255,0.9)' }}
                            />
                            {!iconOnly && (
                                <span
                                    className="font-mono text-[10px] font-semibold tracking-wider truncate"
                                    style={{ color: 'rgba(255,255,255,0.9)' }}
                                >
                                    Erro
                                </span>
                            )}
                        </motion.div>
                    )}

                    {phase === 'idle' && (
                        <motion.div
                            key="idle"
                            initial={{ opacity: 0, scale: 0.85 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.85 }}
                            transition={{ duration: 0.12 }}
                            className={`flex items-center gap-2 w-full ${iconOnly ? 'justify-center' : 'px-3'}`}
                        >
                            <HaumeaIcon
                                size={iconOnly ? 18 : 14}
                                className="shrink-0 text-accent"
                            />
                            {!iconOnly && (
                                <span
                                    className="font-sans text-[11.5px] font-semibold tracking-tight"
                                    style={{ color: 'rgba(255,255,255,0.92)' }}
                                >
                                    Haumea Voice
                                </span>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    )
}
