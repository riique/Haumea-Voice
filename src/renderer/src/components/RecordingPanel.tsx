import { useCallback } from 'react'
import { Mic, Check, Circle, Loader2, X } from 'lucide-react'
import AudioVisualizer from './AudioVisualizer'

interface Props {
    isRecording: boolean
    elapsed: number
    onToggle: () => void
    onStop: () => void
    transcribing: boolean
    shortcut: string
    stopShortcut: string
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
    transcribing,
    shortcut,
    stopShortcut,
    activeStream
}: Props) {
    const handleCancel = useCallback(() => {
        onStop()
    }, [onStop])

    return (
        <div className="flex w-full max-w-[420px] flex-col items-center gap-5">
            <div className="font-mono text-4xl font-bold tracking-widest text-text-main tabular-nums">
                {formatTime(elapsed)}
            </div>

            <div className="w-full max-w-[340px] h-[76px] bg-sidebar border border-border flex items-center justify-center rounded-lg overflow-hidden">
                {isRecording ? (
                    <AudioVisualizer isRecording={isRecording} stream={activeStream} width={320} height={64} />
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

            <div className="flex flex-wrap items-center justify-center gap-3">
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
                            onClick={onToggle}
                            className="flex items-center gap-2.5 h-11 px-6 bg-text-main text-bg font-semibold text-sm tracking-tight hover:bg-text-sec transition-colors"
                            title={`Finalizar e transcrever (${shortcutLabel(shortcut)})`}
                        >
                            <Check size={14} strokeWidth={2.5} />
                            Transcrever
                        </button>
                        <button
                            onClick={handleCancel}
                            className="flex items-center gap-2 h-11 px-4 border border-border text-text-sec text-sm font-semibold hover:text-text-main hover:border-text-sec transition-colors"
                            title={`Cancelar grava\u00e7\u00e3o (${shortcutLabel(stopShortcut)})`}
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

            <p className="font-mono text-[10px] text-text-sec tracking-wider text-center leading-relaxed">
                Iniciar/transcrever: {shortcutLabel(shortcut)} <span className="text-border">/</span> Cancelar: {shortcutLabel(stopShortcut)}
            </p>
        </div>
    )
}
