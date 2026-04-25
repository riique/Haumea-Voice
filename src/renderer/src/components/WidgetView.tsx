import { Square, Circle, X } from 'lucide-react'
import AudioVisualizer from './AudioVisualizer'

interface Props {
    isRecording: boolean
    elapsed: number
    onToggle: () => void
    onStop: () => void
    onCancel: () => void
    shortcut: string
}

function pad(n: number): string {
    return String(n).padStart(2, '0')
}

function formatTime(secs: number): string {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${pad(m)}:${pad(s)}`
}

export default function WidgetView({ isRecording, elapsed, onToggle, onStop, onCancel }: Props) {
    return (
        <div
            className="h-screen w-screen flex flex-col items-center justify-center gap-3 bg-sidebar/95 select-none"
            style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
            {/* Timer */}
            <span className="font-mono text-xl font-bold tracking-widest text-text-main tabular-nums">
                {formatTime(elapsed)}
            </span>

            {/* Mini visualizer */}
            <AudioVisualizer isRecording={isRecording} width={260} height={36} />

            {/* Controls */}
            <div
                className="flex items-center gap-2"
                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
                {!isRecording ? (
                    <button
                        onClick={onToggle}
                        className="flex items-center gap-1.5 h-7 px-3 bg-accent text-surface text-[11px] font-bold tracking-tight"
                    >
                        <Circle size={8} fill="currentColor" strokeWidth={0} />
                        REC
                    </button>
                ) : (
                    <button
                        onClick={onStop}
                        className="flex items-center gap-1.5 h-7 px-3 bg-text-main text-bg text-[11px] font-bold tracking-tight"
                    >
                        <Square size={8} fill="currentColor" strokeWidth={0} />
                        PARAR
                    </button>
                )}

                <button
                    onClick={() => window.api.toggleWidgetMode()}
                    className="h-7 px-3 border border-border text-[11px] font-bold text-text-sec hover:text-text-main tracking-tight transition-colors"
                >
                    EXPANDIR
                </button>
            </div>
        </div>
    )
}
