import { useEffect, useState } from 'react'
import { Clock, Copy, Trash2, RotateCcw, AlertCircle, Sparkles, Loader2, Search } from 'lucide-react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { generateFeedback } from '../../services/gemini'
import { transcribeWithNonEmptyRetry } from '../../services/transcription'
import { applyDictionary } from '../../services/dictionary'

interface HistoryEntry {
    text: string
    date: string
    error?: string
    audioId?: string
    feedback?: string
    feedbackCreatedAt?: string
}

function countWords(text: string): number {
    return text.trim().split(/\s+/).filter(Boolean).length
}

function formatDate(iso: string): string {
    const d = new Date(iso)
    return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })
}

function truncate(text: string, max: number): string {
    if (text.length <= max) return text
    return text.slice(0, max) + '...'
}

function b64ToBlob(b64: string, mime = 'audio/webm'): Blob {
    const bin = atob(b64)
    const arr = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
    return new Blob([arr], { type: mime })
}

export default function HistoryPage() {
    const [history, setHistory] = useState<HistoryEntry[]>([])
    const [copied, setCopied] = useState<number | null>(null)
    const [retrying, setRetrying] = useState<string | null>(null)
    const [evaluating, setEvaluating] = useState<string | null>(null)
    const [feedbackErrors, setFeedbackErrors] = useState<Record<string, string>>({})
    const [query, setQuery] = useState('')

    const load = () => window.api.getHistory().then(setHistory)

    useEffect(() => {
        load()
    }, [])

    const clearFeedbackError = (date: string) => {
        setFeedbackErrors((prev) => {
            if (!prev[date]) return prev
            const next = { ...prev }
            delete next[date]
            return next
        })
    }

    const copyEntry = async (text: string, idx: number) => {
        await window.api.copyToClipboard(text)
        setCopied(idx)
        setTimeout(() => setCopied(null), 1500)
    }

    const clearHistory = async () => {
        await window.api.clearHistory()
        setHistory([])
        setFeedbackErrors({})
    }

    const removeEntry = async (date: string) => {
        await window.api.removeHistoryEntry(date)
        clearFeedbackError(date)
        load()
    }

    const retryEntry = async (entry: HistoryEntry) => {
        if (!entry.audioId || retrying || evaluating) return
        setRetrying(entry.date)
        clearFeedbackError(entry.date)

        try {
            const b64 = await window.api.getHistoryAudio(entry.audioId)
            if (!b64) {
                throw new Error('Áudio do histórico não encontrado para nova transcrição.')
            }

            const blob = b64ToBlob(b64)
            const engine = await window.api.getTranscriptionEngine()
            const dictionary = await window.api.getDictionary()
            const text = applyDictionary(await transcribeWithNonEmptyRetry(blob, engine, 2), dictionary)
            if (!text.trim()) {
                throw new Error('A transcrição voltou vazia: nenhuma palavra foi detectada.')
            }
            if (text.trim().toLowerCase() === '[silencio]') {
                throw new Error('Áudio sem fala detectável para transcrição.')
            }

            await window.api.updateHistoryEntry(entry.date, {
                text,
                error: undefined,
                feedback: undefined,
                feedbackCreatedAt: undefined
            })

            await window.api.copyToClipboard(text)
            load()
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Erro no retry'
            await window.api.updateHistoryEntry(entry.date, { error: msg })
            load()
        } finally {
            setRetrying(null)
        }
    }

    const evaluateEntry = async (entry: HistoryEntry) => {
        if (entry.error || !entry.audioId || retrying || evaluating) return

        setEvaluating(entry.date)
        clearFeedbackError(entry.date)

        try {
            const b64 = await window.api.getHistoryAudio(entry.audioId)
            if (!b64) {
                throw new Error('Áudio desta transcrição não foi encontrado. Grave novamente para gerar a avaliação.')
            }

            const blob = b64ToBlob(b64)
            const feedback = await generateFeedback(blob, entry.text)
            const feedbackCreatedAt = new Date().toISOString()

            await window.api.updateHistoryEntry(entry.date, { feedback, feedbackCreatedAt })
            setHistory((prev) =>
                prev.map((item) => (
                    item.date === entry.date
                        ? { ...item, feedback, feedbackCreatedAt }
                        : item
                ))
            )
        } catch (err) {
            setFeedbackErrors((prev) => ({
                ...prev,
                [entry.date]: err instanceof Error ? err.message : 'Erro ao gerar avaliação'
            }))
        } finally {
            setEvaluating(null)
        }
    }

    const errorCount = history.filter((e) => e.error).length
    const successCount = history.filter((e) => !e.error).length
    const normalizedQuery = query.trim().toLowerCase()
    const filteredHistory = normalizedQuery
        ? history.filter((entry) => {
            const haystack = [
                entry.text,
                entry.error,
                entry.feedback,
                formatDate(entry.date)
            ].filter(Boolean).join(' ').toLowerCase()
            return haystack.includes(normalizedQuery)
        })
        : history

    return (
        <div className="flex flex-col h-full overflow-y-auto p-6">
            <div className="flex flex-col gap-3 mb-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <h1 className="font-display text-lg font-bold tracking-tight text-text-main">
                        Histórico
                    </h1>
                    <p className="font-mono text-[10px] text-text-sec tracking-wider mt-0.5">
                        {successCount} transcrição{successCount !== 1 ? 'ões' : ''} salva{successCount !== 1 ? 's' : ''}
                        {errorCount > 0 && (
                            <span className="text-accent ml-2">
                                · {errorCount} erro{errorCount !== 1 ? 's' : ''}
                            </span>
                        )}
                    </p>
                </div>
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="relative min-w-0 sm:w-[300px]">
                        <Search
                            size={13}
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-sec/60"
                        />
                        <input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Pesquisar historico"
                            className="h-9 w-full min-w-0 border border-border bg-surface pl-9 pr-3 font-mono text-[11px] text-text-main outline-none transition-colors placeholder:text-text-sec/40 focus:border-accent"
                        />
                    </div>
                    {history.length > 0 && (
                        <button
                            onClick={clearHistory}
                            className="flex h-9 items-center justify-center gap-1.5 border border-border px-3 text-[11px] font-semibold text-text-sec transition-colors hover:border-accent/40 hover:text-accent"
                        >
                            <Trash2 size={12} />
                            Limpar tudo
                        </button>
                    )}
                </div>
            </div>

            {history.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                    <Clock size={32} className="text-border mb-3" />
                    <p className="text-sm text-text-sec">Nenhuma transcrição no histórico</p>
                    <p className="font-mono text-[10px] text-text-sec/50 mt-1 tracking-wider">
                        As transcrições serão salvas automaticamente
                    </p>
                </div>
            ) : filteredHistory.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                    <Search size={30} className="text-border mb-3" />
                    <p className="text-sm text-text-sec">Nenhum resultado encontrado</p>
                </div>
            ) : (
                <div className="space-y-2.5">
                    {filteredHistory.map((entry, i) => {
                        const isError = !!entry.error
                        const isRetrying = retrying === entry.date
                        const isEvaluating = evaluating === entry.date
                        const hasFeedback = !!entry.feedback
                        const feedbackError = feedbackErrors[entry.date]
                        const canEvaluate = !isError && !!entry.audioId

                        return (
                            <div
                                key={`${entry.date}-${i}`}
                                className={`
                                    group border transition-colors p-4
                                    ${isError
                                        ? 'bg-accent/[0.04] border-accent/20 hover:border-accent/40'
                                        : 'bg-surface border-border hover:border-accent/30'
                                    }
                                `}
                            >
                                <div className="flex items-start justify-between gap-3 mb-2">
                                    <div className="flex items-center gap-2">
                                        {isError && (
                                            <AlertCircle size={12} className="text-accent shrink-0" />
                                        )}
                                        <span className="font-mono text-[10px] text-text-sec tracking-wider">
                                            {formatDate(entry.date)}
                                        </span>
                                        {!isError && (
                                            <span className="font-mono text-[10px] text-accent/70">
                                                {countWords(entry.text)} palavras
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-1">
                                        {!isError && (
                                            <button
                                                onClick={() => evaluateEntry(entry)}
                                                disabled={!canEvaluate || !!retrying || !!evaluating}
                                                className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold font-mono uppercase tracking-wider text-text-main hover:bg-text-main/5 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                                                title={canEvaluate ? 'Gerar avaliação do áudio' : 'Este item não possui áudio salvo'}
                                            >
                                                {isEvaluating ? (
                                                    <Loader2 size={11} className="animate-spin" />
                                                ) : (
                                                    <Sparkles size={11} />
                                                )}
                                                {isEvaluating ? 'Avaliando...' : hasFeedback ? 'Reavaliar' : 'Avaliar'}
                                            </button>
                                        )}

                                        {isError && entry.audioId && (
                                            <button
                                                onClick={() => retryEntry(entry)}
                                                disabled={isRetrying || !!evaluating}
                                                className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold font-mono uppercase tracking-wider text-accent hover:bg-accent/10 disabled:opacity-50 transition-colors"
                                                title="Tentar transcrever novamente"
                                            >
                                                <RotateCcw
                                                    size={11}
                                                    className={isRetrying ? 'animate-spin' : ''}
                                                />
                                                {isRetrying ? 'Tentando...' : 'Tentar'}
                                            </button>
                                        )}

                                        {!isError && (
                                            <button
                                                onClick={() => copyEntry(entry.text, i)}
                                                className="opacity-0 group-hover:opacity-100 p-1 text-text-sec hover:text-accent transition-all"
                                                title="Copiar"
                                            >
                                                {copied === i ? (
                                                    <span className="font-mono text-[9px] text-success tracking-wider">OK</span>
                                                ) : (
                                                    <Copy size={13} />
                                                )}
                                            </button>
                                        )}

                                        {isError && (
                                            <button
                                                onClick={() => removeEntry(entry.date)}
                                                className="opacity-0 group-hover:opacity-100 p-1 text-text-sec hover:text-accent transition-all"
                                                title="Remover"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {isError ? (
                                    <div className="flex flex-col gap-1">
                                        <p className="font-mono text-[11px] text-accent font-semibold">
                                            Falha na transcrição
                                        </p>
                                        <p className="font-mono text-[10px] text-text-sec/70 leading-relaxed">
                                            {entry.error}
                                        </p>
                                        {entry.audioId && (
                                            <p className="font-mono text-[9px] text-text-sec/40 mt-1 tracking-wider">
                                                Áudio salvo · clique em Tentar para transcrever novamente
                                            </p>
                                        )}
                                        {feedbackError && (
                                            <p className="font-mono text-[10px] text-accent/80 leading-relaxed mt-2">
                                                {feedbackError}
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        <div>
                                            <p className="text-[13px] text-text-main leading-relaxed select-text">
                                                {truncate(entry.text, 280)}
                                            </p>
                                            {!entry.audioId && (
                                                <p className="font-mono text-[9px] text-text-sec/50 mt-2 tracking-wider">
                                                    Sem áudio salvo para avaliação neste item
                                                </p>
                                            )}
                                            {feedbackError && (
                                                <p className="font-mono text-[10px] text-accent/80 leading-relaxed mt-2">
                                                    {feedbackError}
                                                </p>
                                            )}
                                        </div>

                                        {entry.feedback && (
                                            <div className="border border-border bg-bg/60 p-4 rounded-lg">
                                                <div className="flex items-center justify-between gap-3 mb-3">
                                                    <div className="flex items-center gap-2">
                                                        <Sparkles size={13} className="text-accent shrink-0" />
                                                        <span className="font-mono text-[10px] text-text-main uppercase tracking-wider">
                                                            Avaliação IA
                                                        </span>
                                                    </div>
                                                    {entry.feedbackCreatedAt && (
                                                        <span className="font-mono text-[9px] text-text-sec tracking-wider">
                                                            Gerada em {formatDate(entry.feedbackCreatedAt)}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="prose-custom text-sm leading-relaxed text-text-main select-text">
                                                    <Markdown remarkPlugins={[remarkGfm]}>{entry.feedback}</Markdown>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
