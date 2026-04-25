import { useState, useEffect } from 'react'
import { FileText, MessageSquare, Clock, Loader2, Sparkles, Copy, Trash2 } from 'lucide-react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { generateFeedback } from '../services/gemini'

interface HistoryEntry {
    text: string
    date: string
}

interface Props {
    transcript: string
    setTranscript: (v: string) => void
    feedback: string
    setFeedback: (v: string) => void
    audioBlob: Blob | null
    transcribing: boolean
    error: string
}

type Tab = 'transcript' | 'feedback' | 'history'

function timeAgo(isoDate: string): string {
    const diff = Date.now() - new Date(isoDate).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'agora'
    if (mins < 60) return `${mins}min`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h`
    const days = Math.floor(hrs / 24)
    return `${days}d`
}

function truncate(text: string, max: number): string {
    if (text.length <= max) return text
    return text.slice(0, max) + '\u2026'
}

export default function ContentTabs({
    transcript,
    setTranscript,
    feedback,
    setFeedback,
    audioBlob,
    transcribing,
    error
}: Props) {
    const [tab, setTab] = useState<Tab>('transcript')
    const [generatingFb, setGeneratingFb] = useState(false)
    const [localError, setLocalError] = useState('')
    const [history, setHistory] = useState<HistoryEntry[]>([])
    const [copied, setCopied] = useState<number | null>(null)

    useEffect(() => {
        if (tab === 'history') {
            window.api.getHistory().then(setHistory)
        }
    }, [tab, transcript])

    const handleFeedback = async () => {
        if (!audioBlob) return
        setGeneratingFb(true)
        setLocalError('')
        try {
            const fb = await generateFeedback(audioBlob)
            setFeedback(fb)
        } catch (err) {
            setLocalError(err instanceof Error ? err.message : 'Erro ao gerar feedback')
        } finally {
            setGeneratingFb(false)
        }
    }

    const copyEntry = async (text: string, idx: number) => {
        await window.api.copyToClipboard(text)
        setCopied(idx)
        setTimeout(() => setCopied(null), 1500)
    }

    const clearHistory = async () => {
        await window.api.clearHistory()
        setHistory([])
    }

    const displayError = error || localError

    return (
        <div className="flex flex-col h-full">
            <div className="flex border-b border-border bg-sidebar shrink-0">
                <button
                    onClick={() => setTab('transcript')}
                    className={`flex items-center gap-1.5 px-4 h-10 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 ${tab === 'transcript'
                        ? 'border-accent text-accent'
                        : 'border-transparent text-text-sec hover:text-text-main'
                        }`}
                >
                    <FileText size={13} />
                    Transcri\u00e7\u00e3o
                </button>
                <button
                    onClick={() => setTab('feedback')}
                    className={`flex items-center gap-1.5 px-4 h-10 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 ${tab === 'feedback'
                        ? 'border-accent text-accent'
                        : 'border-transparent text-text-sec hover:text-text-main'
                        }`}
                >
                    <MessageSquare size={13} />
                    Feedback IA
                </button>
                <button
                    onClick={() => setTab('history')}
                    className={`flex items-center gap-1.5 px-4 h-10 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 ${tab === 'history'
                        ? 'border-accent text-accent'
                        : 'border-transparent text-text-sec hover:text-text-main'
                        }`}
                >
                    <Clock size={13} />
                    Hist\u00f3rico
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
                {displayError && (
                    <div className="mb-4 p-3 bg-accent/10 border border-accent/30 text-accent text-xs font-mono">
                        {displayError}
                    </div>
                )}

                {tab === 'transcript' && (
                    <div>
                        {transcribing && (
                            <div className="flex items-center gap-2 py-16 justify-center text-accent">
                                <Loader2 size={18} className="animate-spin" />
                                <span className="text-sm font-semibold">Transcrevendo...</span>
                            </div>
                        )}

                        {!transcribing && !transcript && (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <FileText size={28} className="text-border mb-3" />
                                <p className="text-sm text-text-sec">
                                    Grave um \u00e1udio para transcrever
                                </p>
                                <p className="text-[10px] font-mono text-text-sec/60 mt-1 tracking-wider">
                                    A transcri\u00e7\u00e3o ser\u00e1 feita automaticamente
                                </p>
                            </div>
                        )}

                        {!transcribing && transcript && (
                            <div className="prose-custom text-sm leading-relaxed text-text-main select-text">
                                <Markdown remarkPlugins={[remarkGfm]}>{transcript}</Markdown>
                            </div>
                        )}
                    </div>
                )}

                {tab === 'feedback' && (
                    <div>
                        {!audioBlob && !feedback && (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <MessageSquare size={28} className="text-border mb-3" />
                                <p className="text-sm text-text-sec">
                                    Grave um \u00e1udio para receber feedback
                                </p>
                            </div>
                        )}

                        {audioBlob && !feedback && (
                            <button
                                onClick={handleFeedback}
                                disabled={generatingFb}
                                className="flex items-center gap-2 h-9 px-4 bg-text-main text-bg text-sm font-semibold hover:bg-text-sec disabled:opacity-50 transition-all mb-4"
                            >
                                {generatingFb ? (
                                    <Loader2 size={14} className="animate-spin" />
                                ) : (
                                    <Sparkles size={14} />
                                )}
                                {generatingFb ? 'Analisando...' : 'Gerar Feedback'}
                            </button>
                        )}

                        {feedback && (
                            <div className="prose-custom text-sm leading-relaxed text-text-main select-text">
                                <Markdown remarkPlugins={[remarkGfm]}>{feedback}</Markdown>
                            </div>
                        )}
                    </div>
                )}

                {tab === 'history' && (
                    <div>
                        {history.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <Clock size={28} className="text-border mb-3" />
                                <p className="text-sm text-text-sec">
                                    Nenhuma transcri\u00e7\u00e3o no hist\u00f3rico
                                </p>
                                <p className="text-[10px] font-mono text-text-sec/60 mt-1 tracking-wider">
                                    As transcri\u00e7\u00f5es ser\u00e3o salvas automaticamente
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center justify-between mb-4">
                                    <span className="font-mono text-[10px] text-text-sec uppercase tracking-wider">
                                        {history.length} transcri\u00e7\u00e3o{history.length !== 1 ? '\u00f5es' : ''}
                                    </span>
                                    <button
                                        onClick={clearHistory}
                                        className="flex items-center gap-1 text-[10px] font-mono text-text-sec hover:text-accent transition-colors uppercase tracking-wider"
                                    >
                                        <Trash2 size={11} />
                                        Limpar
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    {history.map((entry, i) => (
                                        <div
                                            key={`${entry.date}-${i}`}
                                            className="group p-3 border border-border hover:border-accent/30 transition-colors"
                                        >
                                            <div className="flex items-start justify-between gap-2 mb-1.5">
                                                <span className="font-mono text-[10px] text-text-sec tracking-wider">
                                                    {timeAgo(entry.date)}
                                                </span>
                                                <button
                                                    onClick={() => copyEntry(entry.text, i)}
                                                    className="opacity-0 group-hover:opacity-100 p-0.5 text-text-sec hover:text-accent transition-all"
                                                    title="Copiar"
                                                >
                                                    <Copy size={12} />
                                                </button>
                                            </div>
                                            <p className="text-xs text-text-main leading-relaxed select-text">
                                                {truncate(entry.text, 200)}
                                            </p>
                                            {copied === i && (
                                                <span className="font-mono text-[9px] text-success tracking-wider">
                                                    \u2713 copiado
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
