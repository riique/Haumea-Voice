import { useState, useEffect, useRef } from 'react'
import { Keyboard } from 'lucide-react'

interface Props {
    shortcut: string
    onShortcutChange: (s: string) => void
}

const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta'])

function keysToElectron(keys: Set<string>): string {
    const parts: string[] = []
    if (keys.has('Control') || keys.has('Meta')) parts.push('CmdOrCtrl')
    if (keys.has('Alt')) parts.push('Alt')
    if (keys.has('Shift')) parts.push('Shift')
    for (const k of Array.from(keys)) {
        if (!MODIFIER_KEYS.has(k)) parts.push(k.length === 1 ? k.toUpperCase() : k)
    }
    return parts.join('+')
}

function displayShortcut(raw: string): string {
    return raw
        .replace('CmdOrCtrl', 'Ctrl')
        .replace('CommandOrControl', 'Ctrl')
        .replace(/\+/g, ' + ')
}

export default function ShortcutsPage({ shortcut, onShortcutChange }: Props) {
    const [recording, setRecording] = useState(false)
    const [pending, setPending] = useState('')
    const [saved, setSaved] = useState(false)
    const [error, setError] = useState('')
    const pressedRef = useRef(new Set<string>())

    useEffect(() => {
        if (!recording) return

        const onKeyDown = (e: KeyboardEvent) => {
            e.preventDefault()
            e.stopPropagation()
            pressedRef.current.add(e.key)

            const hasModifier = Array.from(pressedRef.current).some(k => MODIFIER_KEYS.has(k))
            const hasRegular = Array.from(pressedRef.current).some(k => !MODIFIER_KEYS.has(k))

            if (hasModifier && hasRegular) {
                const combo = keysToElectron(pressedRef.current)
                setPending(combo)
                setRecording(false)
                pressedRef.current.clear()
            }
        }

        window.addEventListener('keydown', onKeyDown, true)
        return () => window.removeEventListener('keydown', onKeyDown, true)
    }, [recording])

    const saveShortcut = async () => {
        if (!pending) return
        setError('')
        const ok = await window.api.saveShortcut(pending)
        if (ok) {
            onShortcutChange(pending)
            setSaved(true)
            setPending('')
            setTimeout(() => setSaved(false), 2000)
        } else {
            setError('Atalho inv\u00e1lido. Tente outra combina\u00e7\u00e3o.')
        }
    }

    const startRecording = () => {
        pressedRef.current.clear()
        setPending('')
        setError('')
        setRecording(true)
    }

    return (
        <div className="flex flex-col h-full overflow-y-auto p-6">
            <div className="mb-5">
                <h1 className="font-display text-lg font-bold tracking-tight text-text-main">
                    Atalhos
                </h1>
                <p className="font-mono text-[10px] text-text-sec tracking-wider mt-0.5">
                    Atalhos globais de teclado
                </p>
            </div>

            <div className="bg-surface border border-border p-5 rounded-xl">
                <div className="flex items-center gap-2 mb-4">
                    <Keyboard size={15} strokeWidth={1.8} className="text-accent" />
                    <span className="font-mono text-[11px] font-bold text-text-sec uppercase tracking-wider">
                        Atalho de Gravação
                    </span>
                </div>

                <p className="text-[13px] text-text-sec mb-4 leading-relaxed">
                    Pressione este atalho em qualquer lugar do sistema para iniciar/parar a gravação.
                </p>

                <div className="flex items-center gap-2">
                    <div className="flex-1 h-10 px-4 bg-bg border border-border flex items-center">
                        {recording ? (
                            <span className="text-sm text-accent font-mono animate-pulse">
                                Pressione o atalho…
                            </span>
                        ) : (
                            <span className="text-sm font-mono text-text-main font-medium">
                                {pending ? displayShortcut(pending) : displayShortcut(shortcut)}
                            </span>
                        )}
                    </div>

                    {!pending ? (
                        <button
                            onClick={startRecording}
                            className="h-10 px-5 border border-border text-[13px] font-semibold text-text-sec hover:text-text-main hover:border-text-sec transition-all"
                        >
                            {recording ? 'Aguardando\u2026' : 'Alterar'}
                        </button>
                    ) : (
                        <button
                            onClick={saveShortcut}
                            className="h-10 px-5 bg-accent text-surface text-[13px] font-semibold hover:brightness-110 transition-all"
                        >
                            Salvar
                        </button>
                    )}
                </div>

                {error && (
                    <p className="font-mono text-[10px] text-accent mt-2 tracking-wider">{error}</p>
                )}
                {saved && (
                    <p className="font-mono text-[11px] text-success mt-2 tracking-wider">✓ Atalho salvo</p>
                )}
            </div>
        </div>
    )
}
