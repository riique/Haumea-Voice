import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, BookOpenText, Check, Plus, Trash2 } from 'lucide-react'
import type { DictionaryEntry } from '../../../../shared/dictionary'

function createId(): string {
    if (crypto.randomUUID) return crypto.randomUUID()
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

function normalize(entries: DictionaryEntry[]): DictionaryEntry[] {
    const seen = new Set<string>()
    return entries
        .map(entry => ({
            ...entry,
            from: entry.from.trim(),
            to: entry.to.trim(),
            caseSensitive: Boolean(entry.caseSensitive),
            wholeWord: entry.wholeWord !== false
        }))
        .filter(entry => {
            if (!entry.from || !entry.to) return false
            const key = `${entry.caseSensitive ? '1' : '0'}:${entry.wholeWord ? '1' : '0'}:${entry.from.toLowerCase()}`
            if (seen.has(key)) return false
            seen.add(key)
            return true
        })
}

export default function DictionaryPage() {
    const [entries, setEntries] = useState<DictionaryEntry[]>([])
    const [from, setFrom] = useState('')
    const [to, setTo] = useState('')
    const [wholeWord, setWholeWord] = useState(true)
    const [caseSensitive, setCaseSensitive] = useState(false)
    const [saved, setSaved] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        window.api.getDictionary().then(items => setEntries(normalize(items)))
    }, [])

    const canSave = from.trim().length > 0 && to.trim().length > 0
    const sortedEntries = useMemo(
        () => [...entries].sort((a, b) => a.from.localeCompare(b.from, 'pt-BR')),
        [entries]
    )

    const persist = async (nextEntries: DictionaryEntry[]) => {
        const normalized = normalize(nextEntries)
        setEntries(normalized)
        await window.api.saveDictionary(normalized)
        setSaved(true)
        window.setTimeout(() => setSaved(false), 1600)
    }

    const addEntry = async () => {
        if (!canSave) {
            setError('Preencha os dois campos.')
            return
        }

        const next: DictionaryEntry = {
            id: createId(),
            from: from.trim(),
            to: to.trim(),
            wholeWord,
            caseSensitive,
            createdAt: new Date().toISOString()
        }

        const duplicate = entries.some(entry =>
            entry.from.trim().toLowerCase() === next.from.toLowerCase() &&
            entry.caseSensitive === next.caseSensitive &&
            entry.wholeWord === next.wholeWord
        )

        if (duplicate) {
            setError('Essa entrada ja existe.')
            return
        }

        setError('')
        setFrom('')
        setTo('')
        await persist([next, ...entries])
    }

    const removeEntry = async (id: string) => {
        await persist(entries.filter(entry => entry.id !== id))
    }

    return (
        <div className="h-full overflow-y-auto px-5 py-5 md:px-6">
            <div className="mx-auto flex w-full max-w-[980px] flex-col gap-4">
                <div className="flex items-end justify-between gap-3">
                    <div>
                        <h1 className="font-display text-lg font-bold tracking-tight text-text-main">
                            Dicionario
                        </h1>
                        <p className="font-mono text-[10px] text-text-sec tracking-wider mt-0.5">
                            Substituicoes automaticas
                        </p>
                    </div>
                    {saved && (
                        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-wider text-success">
                            <Check size={12} />
                            Salvo
                        </span>
                    )}
                </div>

                <section className="bg-surface border border-border rounded-lg p-4 shadow-[0_8px_24px_rgba(31,33,28,0.04)]">
                    <div className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] lg:items-end">
                        <label className="flex min-w-0 flex-col gap-1">
                            <span className="text-[12px] font-semibold text-text-main">Transcrito</span>
                            <input
                                value={from}
                                onChange={event => {
                                    setFrom(event.target.value)
                                    if (error) setError('')
                                }}
                                onKeyDown={event => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault()
                                        addEntry()
                                    }
                                }}
                                className="h-10 min-w-0 border border-border bg-bg px-3 font-mono text-[12px] text-text-main outline-none transition-colors placeholder:text-text-sec/40 focus:border-accent"
                                placeholder="haumeia"
                            />
                        </label>

                        <ArrowRight size={16} className="hidden text-accent lg:block lg:mb-3" />

                        <label className="flex min-w-0 flex-col gap-1">
                            <span className="text-[12px] font-semibold text-text-main">Correto</span>
                            <input
                                value={to}
                                onChange={event => {
                                    setTo(event.target.value)
                                    if (error) setError('')
                                }}
                                onKeyDown={event => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault()
                                        addEntry()
                                    }
                                }}
                                className="h-10 min-w-0 border border-border bg-bg px-3 font-mono text-[12px] text-text-main outline-none transition-colors placeholder:text-text-sec/40 focus:border-accent"
                                placeholder="Haumea"
                            />
                        </label>

                        <button
                            onClick={addEntry}
                            disabled={!canSave}
                            className="inline-flex h-10 items-center justify-center gap-2 bg-accent px-4 text-[13px] font-semibold text-surface transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <Plus size={14} />
                            Adicionar
                        </button>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                        <label className="inline-flex h-8 items-center gap-2 border border-border bg-bg px-3 text-[12px] font-medium text-text-sec">
                            <input
                                type="checkbox"
                                checked={wholeWord}
                                onChange={event => setWholeWord(event.target.checked)}
                                className="accent-[var(--color-accent)]"
                            />
                            Palavra inteira
                        </label>
                        <label className="inline-flex h-8 items-center gap-2 border border-border bg-bg px-3 text-[12px] font-medium text-text-sec">
                            <input
                                type="checkbox"
                                checked={caseSensitive}
                                onChange={event => setCaseSensitive(event.target.checked)}
                                className="accent-[var(--color-accent)]"
                            />
                            Maiusculas
                        </label>
                        {error && (
                            <span className="inline-flex h-8 items-center font-mono text-[10px] tracking-wider text-[#c42b1c]">
                                {error}
                            </span>
                        )}
                    </div>
                </section>

                <section className="min-h-0 rounded-lg border border-border bg-surface shadow-[0_8px_24px_rgba(31,33,28,0.04)]">
                    <div className="flex items-center justify-between border-b border-border px-4 py-3">
                        <div className="flex items-center gap-2">
                            <BookOpenText size={15} strokeWidth={1.8} className="text-accent" />
                            <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-text-sec">
                                Entradas
                            </span>
                        </div>
                        <span className="font-mono text-[10px] text-text-sec/60">
                            {entries.length.toLocaleString('pt-BR')}
                        </span>
                    </div>

                    {sortedEntries.length === 0 ? (
                        <div className="flex h-40 items-center justify-center px-4 text-center font-mono text-[11px] tracking-wider text-text-sec/50">
                            Nenhuma substituicao cadastrada
                        </div>
                    ) : (
                        <div className="max-h-[420px] overflow-y-auto">
                            {sortedEntries.map(entry => (
                                <div
                                    key={entry.id}
                                    className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-3 last:border-0"
                                >
                                    <span className="min-w-0 truncate font-mono text-[12px] text-text-main">
                                        {entry.from}
                                    </span>
                                    <ArrowRight size={14} className="text-accent" />
                                    <div className="min-w-0">
                                        <span className="block truncate font-mono text-[12px] font-semibold text-text-main">
                                            {entry.to}
                                        </span>
                                        <span className="font-mono text-[9px] uppercase tracking-wider text-text-sec/55">
                                            {entry.wholeWord ? 'palavra inteira' : 'trecho'} / {entry.caseSensitive ? 'sensivel' : 'sem caixa'}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => removeEntry(entry.id)}
                                        className="inline-flex h-8 w-8 items-center justify-center border border-border text-text-sec transition-all hover:border-[#c42b1c] hover:text-[#c42b1c]"
                                        title="Remover"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    )
}
