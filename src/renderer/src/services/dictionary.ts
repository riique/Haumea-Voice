import type { DictionaryEntry } from '../../../shared/dictionary'

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function matchCase(source: string, replacement: string): string {
    if (!replacement) return replacement
    if (source === source.toUpperCase()) return replacement.toUpperCase()
    if (source[0] === source[0]?.toUpperCase() && source.slice(1) === source.slice(1).toLowerCase()) {
        return replacement[0].toUpperCase() + replacement.slice(1)
    }
    return replacement
}

export function applyDictionary(text: string, entries: DictionaryEntry[]): string {
    const activeEntries = entries
        .map(entry => ({
            ...entry,
            from: entry.from.trim(),
            to: entry.to.trim()
        }))
        .filter(entry => entry.from && entry.to)
        .sort((a, b) => b.from.length - a.from.length)

    return activeEntries.reduce((current, entry) => {
        const escaped = escapeRegExp(entry.from)
        const pattern = entry.wholeWord
            ? `(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`
            : escaped
        const flags = `g${entry.caseSensitive ? '' : 'i'}u`

        try {
            return current.replace(new RegExp(pattern, flags), (match: string) =>
                entry.caseSensitive ? entry.to : matchCase(match, entry.to)
            )
        } catch {
            return current
        }
    }, text)
}
