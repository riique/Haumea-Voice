import { useState, useEffect } from 'react'
import { FileText, LetterText, TrendingUp, Timer } from 'lucide-react'
import RecordingPanel from '../RecordingPanel'

interface HistoryEntry {
    text: string
    date: string
}

interface Props {
    isRecording: boolean
    elapsed: number
    onToggle: () => void
    onStop: () => void
    onCancel: () => void
    transcribing: boolean
    shortcut: string
    transcript: string
    activeStream: MediaStream | null
}

function countWords(text: string): number {
    return text.trim().split(/\s+/).filter(Boolean).length
}

function avgWordsPerSentence(text: string): number {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
    if (sentences.length === 0) return 0
    const total = sentences.reduce((sum, s) => sum + countWords(s), 0)
    return Math.round(total / sentences.length)
}

function formatDuration(secs: number): string {
    if (secs < 60) return `${secs}s`
    const m = Math.floor(secs / 60)
    const s = secs % 60
    if (m < 60) return `${m}m ${s}s`
    const h = Math.floor(m / 60)
    return `${h}h ${m % 60}m`
}

export default function OverviewPage({
    isRecording, elapsed,
    onToggle, onStop, onCancel,
    transcribing, shortcut, transcript, activeStream
}: Props) {
    const [history, setHistory] = useState<HistoryEntry[]>([])

    useEffect(() => {
        window.api.getHistory().then(setHistory)
    }, [transcript])

    const totalTranscriptions = history.length
    const totalWords = history.reduce((sum, e) => sum + countWords(e.text), 0)
    const allText = history.map(e => e.text).join('. ')
    const avg = avgWordsPerSentence(allText)
    const estimatedSeconds = Math.round((totalWords / 130) * 60)

    const stats = [
        {
            label: 'Transcri\u00e7\u00f5es',
            value: totalTranscriptions,
            suffix: 'gravadas',
            icon: FileText,
        },
        {
            label: 'Palavras',
            value: totalWords.toLocaleString('pt-BR'),
            suffix: 'transcritas',
            icon: LetterText,
        },
        {
            label: 'M\u00e9dia / Frase',
            value: avg,
            suffix: 'palavras',
            icon: TrendingUp,
        },
        {
            label: 'Tempo Estimado',
            value: formatDuration(estimatedSeconds),
            suffix: 'de \u00e1udio',
            icon: Timer,
        },
    ]

    return (
        <div className="flex flex-col h-full overflow-y-auto">
            <div className="grid grid-cols-4 gap-3 px-6 pt-6 pb-2">
                {stats.map(({ label, value, suffix, icon: Icon }) => (
                    <div
                        key={label}
                        className="bg-surface border border-border border-l-2 border-l-accent p-4 flex flex-col gap-3 rounded-xl min-w-0 overflow-hidden"
                    >
                        <div className="flex items-center gap-2 min-w-0">
                            <Icon size={14} strokeWidth={1.8} className="text-accent shrink-0" />
                            <span className="font-mono text-[10px] text-text-sec uppercase tracking-wider font-medium truncate">
                                {label}
                            </span>
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="font-display text-2xl font-bold text-text-main tracking-tight leading-none truncate">
                                {value}
                            </span>
                            <span className="mt-1 font-mono text-[10px] text-text-sec tracking-wider truncate">
                                {suffix}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex-1 flex items-center justify-center px-6 pb-6 pt-2">
                <div className="bg-surface border border-border w-full flex items-center justify-center py-12 rounded-xl">
                    <RecordingPanel
                        isRecording={isRecording}
                        elapsed={elapsed}
                        onToggle={onToggle}
                        onStop={onStop}
                        onCancel={onCancel}
                        transcribing={transcribing}
                        shortcut={shortcut}
                        activeStream={activeStream}
                    />
                </div>
            </div>
        </div>
    )
}
