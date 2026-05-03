import { useState, useEffect } from 'react'
import { Activity, FileText, LetterText, TrendingUp, Timer } from 'lucide-react'
import RecordingPanel from '../RecordingPanel'

interface HistoryEntry {
    text: string
    date: string
    error?: string
    durationSeconds?: number
}

interface Props {
    isRecording: boolean
    elapsed: number
    onToggle: () => void
    onStop: () => void
    transcribing: boolean
    shortcut: string
    stopShortcut: string
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

function wordsPerMinute(entries: HistoryEntry[]): number {
    const measured = entries.filter((entry) =>
        !entry.error &&
        entry.text.trim().length > 0 &&
        Number.isFinite(entry.durationSeconds) &&
        (entry.durationSeconds ?? 0) > 0
    )
    const seconds = measured.reduce((sum, entry) => sum + (entry.durationSeconds ?? 0), 0)
    if (seconds <= 0) return 0
    const words = measured.reduce((sum, entry) => sum + countWords(entry.text), 0)
    return (words / seconds) * 60
}

function measuredDuration(entries: HistoryEntry[]): number {
    return entries.reduce((sum, entry) => {
        if (entry.error || !entry.text.trim() || !entry.durationSeconds || entry.durationSeconds <= 0) return sum
        return sum + entry.durationSeconds
    }, 0)
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
    onToggle, onStop,
    transcribing, shortcut, stopShortcut, transcript, activeStream
}: Props) {
    const [history, setHistory] = useState<HistoryEntry[]>([])

    useEffect(() => {
        window.api.getHistory().then(setHistory)
    }, [transcript])

    const successfulHistory = history.filter(e => !e.error && e.text.trim().length > 0)
    const totalTranscriptions = successfulHistory.length
    const totalWords = successfulHistory.reduce((sum, e) => sum + countWords(e.text), 0)
    const allText = successfulHistory.map(e => e.text).join('. ')
    const avg = avgWordsPerSentence(allText)
    const wpm = wordsPerMinute(history)
    const knownAudioSeconds = measuredDuration(history)
    const estimatedSeconds = knownAudioSeconds > 0
        ? knownAudioSeconds
        : Math.round((totalWords / 130) * 60)

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
            label: 'Palavras / min',
            value: wpm.toLocaleString('pt-BR', { maximumFractionDigits: 0 }),
            suffix: 'faladas',
            icon: Activity,
        },
        {
            label: knownAudioSeconds > 0 ? 'Tempo de Audio' : 'Tempo Estimado',
            value: formatDuration(estimatedSeconds),
            suffix: knownAudioSeconds > 0 ? 'gravado' : 'de \u00e1udio',
            icon: Timer,
        },
    ]

    return (
        <div className="h-full overflow-hidden px-4 py-3 md:px-5">
            <div className="mx-auto flex h-full w-full max-w-[1480px] flex-col gap-3">
                <div className="grid grid-cols-[repeat(5,minmax(0,1fr))] gap-2">
                    {stats.map(({ label, value, suffix, icon: Icon }) => (
                        <div
                            key={label}
                            className="bg-surface border border-border border-l-2 border-l-accent p-3 flex min-h-[74px] flex-col justify-between gap-2 rounded-lg min-w-0 overflow-hidden shadow-[0_8px_24px_rgba(31,33,28,0.04)]"
                        >
                            <div className="flex items-center gap-2 min-w-0">
                                <Icon size={14} strokeWidth={1.8} className="text-accent shrink-0" />
                                <span className="font-mono text-[10px] text-text-sec uppercase tracking-wider font-medium truncate">
                                    {label}
                                </span>
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="font-display text-xl font-bold text-text-main tracking-tight leading-none truncate">
                                    {value}
                                </span>
                                <span className="mt-1 font-mono text-[10px] text-text-sec tracking-wider truncate">
                                    {suffix}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex min-h-0 flex-1 items-stretch justify-center pb-1">
                    <div className="bg-surface border border-border w-full min-h-0 flex items-center justify-center rounded-lg px-4 py-5 shadow-[0_10px_32px_rgba(31,33,28,0.05)]">
                        <RecordingPanel
                            isRecording={isRecording}
                            elapsed={elapsed}
                            onToggle={onToggle}
                            onStop={onStop}
                            transcribing={transcribing}
                            shortcut={shortcut}
                            stopShortcut={stopShortcut}
                            activeStream={activeStream}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
