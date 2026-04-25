import { useState, useEffect, useRef } from 'react'
import { X, Eye, EyeOff, Loader2, Keyboard } from 'lucide-react'

interface Props {
    onClose: () => void
    shortcut: string
    onShortcutChange: (s: string) => void
}

const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta'])

function keysToElectron(keys: Set<string>): string {
    const parts: string[] = []
    if (keys.has('Control') || keys.has('Meta')) parts.push('CmdOrCtrl')
    if (keys.has('Alt')) parts.push('Alt')
    if (keys.has('Shift')) parts.push('Shift')

    for (const k of keys) {
        if (!MODIFIER_KEYS.has(k)) {
            parts.push(k.length === 1 ? k.toUpperCase() : k)
        }
    }
    return parts.join('+')
}

function displayShortcut(raw: string): string {
    return raw
        .replace('CmdOrCtrl', 'Ctrl')
        .replace('CommandOrControl', 'Ctrl')
        .replace(/\+/g, ' + ')
}

export default function SettingsModal({ onClose, shortcut, onShortcutChange }: Props) {
    const [key, setKey] = useState('')
    const [show, setShow] = useState(false)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)

    const [recording, setRecording] = useState(false)
    const [pendingShortcut, setPendingShortcut] = useState('')
    const [shortcutSaved, setShortcutSaved] = useState(false)
    const [shortcutError, setShortcutError] = useState('')
    const pressedRef = useRef(new Set<string>())

    useEffect(() => {
        window.api.getApiKey().then((k) => setKey(k))
    }, [])

    const save = async () => {
        setSaving(true)
        await window.api.saveApiKey(key.trim())
        setSaving(false)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
    }

    // Shortcut recording handlers
    useEffect(() => {
        if (!recording) return

        const onKeyDown = (e: KeyboardEvent) => {
            e.preventDefault()
            e.stopPropagation()
            pressedRef.current.add(e.key)

            const hasModifier = [...pressedRef.current].some(k => MODIFIER_KEYS.has(k))
            const hasRegular = [...pressedRef.current].some(k => !MODIFIER_KEYS.has(k))

            if (hasModifier && hasRegular) {
                const combo = keysToElectron(pressedRef.current)
                setPendingShortcut(combo)
                setRecording(false)
                pressedRef.current.clear()
            }
        }

        const onKeyUp = () => {
            // If released without complete combo, reset
        }

        window.addEventListener('keydown', onKeyDown, true)
        window.addEventListener('keyup', onKeyUp, true)
        return () => {
            window.removeEventListener('keydown', onKeyDown, true)
            window.removeEventListener('keyup', onKeyUp, true)
        }
    }, [recording])

    const saveShortcut = async () => {
        if (!pendingShortcut) return
        setShortcutError('')
        const ok = await window.api.saveShortcut(pendingShortcut)
        if (ok) {
            onShortcutChange(pendingShortcut)
            setShortcutSaved(true)
            setPendingShortcut('')
            setTimeout(() => setShortcutSaved(false), 2000)
        } else {
            setShortcutError('Atalho inválido. Tente outra combinação.')
        }
    }

    const startRecording = () => {
        pressedRef.current.clear()
        setPendingShortcut('')
        setShortcutError('')
        setRecording(true)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
                className="absolute inset-0 bg-text-main/20"
                onClick={onClose}
            />

            <div className="relative w-[440px] bg-surface border border-border p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="font-display text-lg font-bold tracking-tight">
                        Configurações
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1 text-text-sec hover:text-text-main transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="space-y-5">
                    {/* API Key */}
                    <div>
                        <label className="block font-mono text-[11px] font-bold text-text-sec uppercase tracking-wider mb-2">
                            Google AI Studio — API Key
                        </label>
                        <div className="flex gap-2">
                            <div className="flex-1 relative">
                                <input
                                    type={show ? 'text' : 'password'}
                                    value={key}
                                    onChange={(e) => setKey(e.target.value)}
                                    placeholder="AIza..."
                                    className="w-full h-9 px-3 pr-9 bg-bg border border-border text-sm text-text-main placeholder:text-text-sec/40 font-mono focus:outline-none focus:border-accent transition-colors"
                                />
                                <button
                                    onClick={() => setShow(!show)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-text-sec hover:text-text-main"
                                >
                                    {show ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                            </div>
                            <button
                                onClick={save}
                                disabled={saving || !key.trim()}
                                className="h-9 px-4 bg-accent text-surface text-sm font-semibold tracking-tight hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            >
                                {saving ? <Loader2 size={14} className="animate-spin" /> : 'Salvar'}
                            </button>
                        </div>
                    </div>

                    {saved && (
                        <p className="font-mono text-[11px] text-success tracking-wider">
                            ✓ API Key salva com sucesso
                        </p>
                    )}

                    {/* Shortcut */}
                    <div className="pt-4 border-t border-border">
                        <label className="block font-mono text-[11px] font-bold text-text-sec uppercase tracking-wider mb-2">
                            <span className="flex items-center gap-1.5">
                                <Keyboard size={12} />
                                Atalho de Gravação
                            </span>
                        </label>

                        <div className="flex items-center gap-2">
                            <div className="flex-1 h-9 px-3 bg-bg border border-border flex items-center">
                                {recording ? (
                                    <span className="text-sm text-accent font-mono animate-pulse">
                                        Pressione o atalho...
                                    </span>
                                ) : (
                                    <span className="text-sm font-mono text-text-main">
                                        {pendingShortcut
                                            ? displayShortcut(pendingShortcut)
                                            : displayShortcut(shortcut)}
                                    </span>
                                )}
                            </div>

                            {!pendingShortcut ? (
                                <button
                                    onClick={startRecording}
                                    className="h-9 px-4 border border-border text-sm font-semibold text-text-sec hover:text-text-main hover:border-text-sec transition-all"
                                >
                                    {recording ? 'Aguardando...' : 'Alterar'}
                                </button>
                            ) : (
                                <button
                                    onClick={saveShortcut}
                                    className="h-9 px-4 bg-accent text-surface text-sm font-semibold hover:brightness-110 transition-all"
                                >
                                    Salvar
                                </button>
                            )}
                        </div>

                        {shortcutError && (
                            <p className="font-mono text-[10px] text-accent mt-1.5 tracking-wider">
                                {shortcutError}
                            </p>
                        )}

                        {shortcutSaved && (
                            <p className="font-mono text-[11px] text-success mt-1.5 tracking-wider">
                                ✓ Atalho salvo com sucesso
                            </p>
                        )}
                    </div>

                    <div className="pt-4 border-t border-border">
                        <p className="font-mono text-[10px] text-text-sec leading-relaxed">
                            A chave é armazenada localmente no seu computador via electron-store.
                            Nunca é enviada a terceiros — apenas diretamente para a Google AI API.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
