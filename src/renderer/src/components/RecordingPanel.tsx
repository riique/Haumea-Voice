import { useCallback } from 'react'
import { Mic, Square, Circle, Loader2, X } from 'lucide-react'
import AudioVisualizer from './AudioVisualizer'

interface Props {
    isRecording: boolean
    elapsed: number
    onToggle: () => void
    onStop: () => void
    onCancel: () => void
    transcribing: boolean
    shortcut: string
    activeStream: MediaStream | null
}

function pad(n: number): string {
    return String(n).padStart(2, '0')
}

function formatTime(secs: number): string {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

function shortcutLabel(raw: string): string {
    return raw
        .replace('CmdOrCtrl', 'Ctrl')
        .replace('CommandOrControl', 'Ctrl')
        .replace(/\+/g, ' + ')
}

export default function RecordingPanel({
    isRecording,
    elapsed,
    onToggle,
    onStop,
    onCancel,
    transcribing,
    shortcut,
    activeStream
}: Props) {
    const handleStop = useCallback(() => {
        onStop()
    }, [onStop])

    return (
        <div className="flex flex-col items-center gap-8">
            <div className="font-mono text-5xl font-bold tracking-widest text-text-main tabular-nums">
                {formatTime(elapsed)}
            </div>

            <div className="w-[320px] h-[80px] bg-sidebar border border-border flex items-center justify-center">
                {isRecording ? (
                    <AudioVisualizer isRecording={isRecording} stream={activeStream} width={300} height={70} />
                ) : transcribing ? (
                    <div className="flex items-center gap-2 text-accent">
                        <Loader2 size={14} className="animate-spin" />
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider">
                            Transcrevendo...
                        </span>
                    </div>
                ) : (
                    <span className="font-mono text-[10px] text-text-sec uppercase tracking-widest">
                        aguardando gravação
                    </span>
                )}
            </div>

            <div className="flex items-center gap-4">
                {!isRecording ? (
                    <button
                        onClick={onToggle}
                        disabled={transcribing}
                        className="group flex items-center gap-2.5 h-11 px-6 bg-accent text-surface font-semibold text-sm tracking-tight hover:brightness-110 disabled:opacity-50 transition-all"
                        title={`Iniciar grava\u00e7\u00e3o (${shortcutLabel(shortcut)})`}
                    >
                        <Circle size={10} fill="currentColor" strokeWidth={0} />
                        Gravar
                    </button>
                ) : (
                    <>
                        <button
                            onClick={handleStop}
                            className="flex items-center gap-2.5 h-11 px-6 bg-text-main text-bg font-semibold text-sm tracking-tight hover:bg-text-sec transition-colors"
                        >
                            <Square size={10} fill="currentColor" strokeWidth={0} />
                            Parar
                        </button>
                        <button
                            onClick={onCancel}
                            className="flex items-center gap-2 h-11 px-4 border border-border text-text-sec text-sm font-semibold hover:text-text-main hover:border-text-sec transition-colors"
                            title="Cancelar grava\u00e7\u00e3o (sem transcrever)"
                        >
                            <X size={12} strokeWidth={2.5} />
                            Cancelar
                        </button>
                        <div className="flex items-center gap-1.5 text-accent">
                            <Mic size={13} className="animate-pulse" />
                            <span className="font-mono text-[10px] font-bold uppercase tracking-wider">
                                Gravando
                            </span>
                        </div>
                    </>
                )}
            </div>

            <p className="font-mono text-[10px] text-text-sec tracking-wider">
                Atalho: {shortcutLabel(shortcut)}
            </p>
        </div>
    )
}
