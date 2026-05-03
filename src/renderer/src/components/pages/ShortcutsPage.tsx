import { useEffect, useRef, useState } from 'react'
import { Check, Circle, Keyboard, RotateCcw, Save, X } from 'lucide-react'

interface Props {
    shortcut: string
    stopShortcut: string
    onShortcutChange: (s: string) => void
    onStopShortcutChange: (s: string) => void
}

type ShortcutTarget = 'record' | 'stop'
type CaptureResult =
    | { state: 'waiting' }
    | { state: 'ready'; shortcut: string }
    | { state: 'error'; message: string }

const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta', 'AltGraph'])

const NUMPAD_KEYS: Record<string, string> = {
    Numpad0: 'num0',
    Numpad1: 'num1',
    Numpad2: 'num2',
    Numpad3: 'num3',
    Numpad4: 'num4',
    Numpad5: 'num5',
    Numpad6: 'num6',
    Numpad7: 'num7',
    Numpad8: 'num8',
    Numpad9: 'num9',
    NumpadDecimal: 'numdec',
    NumpadAdd: 'numadd',
    NumpadSubtract: 'numsub',
    NumpadMultiply: 'nummult',
    NumpadDivide: 'numdiv',
    NumpadEnter: 'Enter'
}

const SPECIAL_CODE_KEYS: Record<string, string> = {
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    Backspace: 'Backspace',
    CapsLock: 'Capslock',
    Delete: 'Delete',
    End: 'End',
    Enter: 'Enter',
    Escape: 'Escape',
    Home: 'Home',
    Insert: 'Insert',
    NumLock: 'Numlock',
    PageDown: 'PageDown',
    PageUp: 'PageUp',
    PrintScreen: 'PrintScreen',
    ScrollLock: 'Scrolllock',
    Space: 'Space',
    Tab: 'Tab'
}

const PUNCTUATION_KEYS: Record<string, string> = {
    ' ': 'Space',
    '+': 'Plus'
}

const DISPLAY_PARTS: Record<string, string> = {
    CmdOrCtrl: 'Ctrl',
    CommandOrControl: 'Ctrl',
    Control: 'Ctrl',
    num0: 'Num 0',
    num1: 'Num 1',
    num2: 'Num 2',
    num3: 'Num 3',
    num4: 'Num 4',
    num5: 'Num 5',
    num6: 'Num 6',
    num7: 'Num 7',
    num8: 'Num 8',
    num9: 'Num 9',
    numdec: 'Num .',
    numadd: 'Num +',
    numsub: 'Num -',
    nummult: 'Num *',
    numdiv: 'Num /',
    Plus: '+'
}

function keyFromEvent(event: KeyboardEvent): string | null {
    if (MODIFIER_KEYS.has(event.key)) return null
    if (NUMPAD_KEYS[event.code]) return NUMPAD_KEYS[event.code]
    if (/^Key[A-Z]$/.test(event.code)) return event.code.replace('Key', '')
    if (/^Digit[0-9]$/.test(event.code)) return event.code.replace('Digit', '')
    if (/^F([1-9]|1[0-9]|2[0-4])$/.test(event.code)) return event.code
    if (SPECIAL_CODE_KEYS[event.code]) return SPECIAL_CODE_KEYS[event.code]
    if (PUNCTUATION_KEYS[event.key]) return PUNCTUATION_KEYS[event.key]
    if (event.key.length === 1) return event.key.toUpperCase()
    return null
}

function shortcutFromEvent(event: KeyboardEvent): CaptureResult {
    if (event.repeat) return { state: 'waiting' }

    const key = keyFromEvent(event)
    if (!key) {
        if (MODIFIER_KEYS.has(event.key)) return { state: 'waiting' }
        return { state: 'error', message: 'Tecla não suportada para atalho global.' }
    }
    if (event.code === 'Unidentified') {
        return { state: 'error', message: 'Tecla não identificada pelo sistema.' }
    }

    const parts: string[] = []
    if (event.ctrlKey || event.metaKey) parts.push('CmdOrCtrl')
    if (event.altKey) parts.push('Alt')
    if (event.shiftKey) parts.push('Shift')

    if (parts.length === 0) {
        return { state: 'error', message: 'Use Ctrl, Alt ou Shift junto da tecla principal.' }
    }

    parts.push(key)
    return { state: 'ready', shortcut: parts.join('+') }
}

function displayShortcut(raw: string): string {
    return raw
        .split('+')
        .filter(Boolean)
        .map((part) => DISPLAY_PARTS[part] ?? part)
        .join(' + ')
}

function sameShortcut(a: string, b: string): boolean {
    return a.trim().toLowerCase() === b.trim().toLowerCase()
}

function ShortcutCard({
    target,
    title,
    description,
    value,
    pending,
    capturing,
    saved,
    error,
    onStart,
    onSave
}: {
    target: ShortcutTarget
    title: string
    description: string
    value: string
    pending: string
    capturing: boolean
    saved: boolean
    error: string
    onStart: (target: ShortcutTarget) => void
    onSave: (target: ShortcutTarget) => void
}) {
    const Icon = target === 'record' ? Circle : X

    return (
        <div className="bg-surface border border-border rounded-lg p-5 shadow-[0_8px_24px_rgba(31,33,28,0.04)]">
            <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-bg text-accent">
                    <Icon size={13} fill={target === 'record' ? 'currentColor' : undefined} strokeWidth={2.2} />
                </div>
                <div className="min-w-0 flex-1">
                    <h2 className="text-[13px] font-semibold text-text-main">{title}</h2>
                    <p className="mt-1 text-[12px] leading-relaxed text-text-sec">{description}</p>
                </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <div className="min-w-0 border border-border bg-bg px-3 py-2.5">
                    {capturing ? (
                        <span className="font-mono text-[12px] text-accent animate-pulse">
                            Pressione Ctrl/Alt/Shift + tecla
                        </span>
                    ) : (
                        <span className="block truncate font-mono text-[13px] font-medium text-text-main">
                            {displayShortcut(pending || value)}
                        </span>
                    )}
                </div>

                <div className="flex flex-wrap gap-2 sm:justify-end">
                    {pending ? (
                        <>
                            <button
                                onClick={() => onSave(target)}
                                className="inline-flex h-10 items-center gap-2 bg-accent px-4 text-[13px] font-semibold text-surface transition-all hover:brightness-110"
                            >
                                <Save size={14} />
                                Salvar
                            </button>
                            <button
                                onClick={() => onStart(target)}
                                className="inline-flex h-10 items-center gap-2 border border-border px-4 text-[13px] font-semibold text-text-sec transition-all hover:border-text-sec hover:text-text-main"
                            >
                                <RotateCcw size={14} />
                                Regravar
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => onStart(target)}
                            className="inline-flex h-10 items-center gap-2 border border-border px-4 text-[13px] font-semibold text-text-sec transition-all hover:border-text-sec hover:text-text-main"
                        >
                            <Keyboard size={14} />
                            {capturing ? 'Aguardando' : 'Alterar'}
                        </button>
                    )}
                </div>
            </div>

            {error && (
                <p className="mt-2 font-mono text-[10px] tracking-wider text-accent">{error}</p>
            )}
            {saved && (
                <p className="mt-2 inline-flex items-center gap-1.5 font-mono text-[11px] tracking-wider text-success">
                    <Check size={12} />
                    Atalho salvo
                </p>
            )}
        </div>
    )
}

export default function ShortcutsPage({
    shortcut,
    stopShortcut,
    onShortcutChange,
    onStopShortcutChange
}: Props) {
    const [capturing, setCapturing] = useState<ShortcutTarget | null>(null)
    const [pending, setPending] = useState<Record<ShortcutTarget, string>>({ record: '', stop: '' })
    const [saved, setSaved] = useState<ShortcutTarget | null>(null)
    const [errors, setErrors] = useState<Record<ShortcutTarget, string>>({ record: '', stop: '' })
    const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        if (!capturing) return

        const onKeyDown = (event: KeyboardEvent) => {
            event.preventDefault()
            event.stopPropagation()

            const result = shortcutFromEvent(event)
            if (result.state === 'waiting') return

            if (result.state === 'error') {
                setErrors(current => ({ ...current, [capturing]: result.message }))
                return
            }

            setPending(current => ({ ...current, [capturing]: result.shortcut }))
            setErrors(current => ({ ...current, [capturing]: '' }))
            setCapturing(null)
        }

        window.addEventListener('keydown', onKeyDown, true)
        return () => window.removeEventListener('keydown', onKeyDown, true)
    }, [capturing])

    useEffect(() => {
        return () => {
            if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
        }
    }, [])

    const startRecording = (target: ShortcutTarget) => {
        setCapturing(target)
        setPending(current => ({ ...current, [target]: '' }))
        setErrors(current => ({ ...current, [target]: '' }))
    }

    const flashSaved = (target: ShortcutTarget) => {
        setSaved(target)
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
        savedTimerRef.current = setTimeout(() => setSaved(null), 2000)
    }

    const saveShortcut = async (target: ShortcutTarget) => {
        const next = pending[target]
        if (!next) return

        const otherShortcut = target === 'record' ? stopShortcut : shortcut
        if (sameShortcut(next, otherShortcut)) {
            setErrors(current => ({
                ...current,
                [target]: 'Use uma combinação diferente do outro atalho.'
            }))
            return
        }

        const ok = target === 'record'
            ? await window.api.saveShortcut(next)
            : await window.api.saveStopShortcut(next)

        if (!ok) {
            setErrors(current => ({
                ...current,
                [target]: 'O sistema não aceitou esse atalho. Tente outra combinação.'
            }))
            return
        }

        if (target === 'record') onShortcutChange(next)
        else onStopShortcutChange(next)

        setPending(current => ({ ...current, [target]: '' }))
        setErrors(current => ({ ...current, [target]: '' }))
        flashSaved(target)
    }

    return (
        <div className="h-full overflow-y-auto px-5 py-5 md:px-6">
            <div className="mx-auto flex w-full max-w-[980px] flex-col gap-5">
                <div>
                    <h1 className="font-display text-lg font-bold tracking-tight text-text-main">
                        Atalhos
                    </h1>
                    <p className="font-mono text-[10px] text-text-sec tracking-wider mt-0.5">
                        Atalhos globais de teclado
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                    <ShortcutCard
                        target="record"
                        title="Iniciar ou alternar gravação"
                        description="Inicia a captura; ao pressionar de novo, finaliza e transcreve."
                        value={shortcut}
                        pending={pending.record}
                        capturing={capturing === 'record'}
                        saved={saved === 'record'}
                        error={errors.record}
                        onStart={startRecording}
                        onSave={saveShortcut}
                    />
                    <ShortcutCard
                        target="stop"
                        title="Cancelar gravação"
                        description="Interrompe a captura atual e descarta o audio, sem transcrever."
                        value={stopShortcut}
                        pending={pending.stop}
                        capturing={capturing === 'stop'}
                        saved={saved === 'stop'}
                        error={errors.stop}
                        onStart={startRecording}
                        onSave={saveShortcut}
                    />
                </div>
            </div>
        </div>
    )
}
