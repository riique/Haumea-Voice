import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type Dispatch,
    type MutableRefObject,
    type ReactNode,
    type SetStateAction
} from 'react'
import {
    ArrowDown,
    ArrowUp,
    Bot,
    Eye,
    EyeOff,
    Loader2,
    Mic,
    Monitor,
    PanelLeft,
    Plus,
    Power,
    Settings,
    Trash2,
    AudioWaveform,
    Cloud
} from 'lucide-react'
import HaumeaIcon from '../HaumeaIcon'
import {
    DEFAULT_GEMINI_MODEL_PRIORITY,
    DEFAULT_GEMINI_SETTINGS,
    normalizeGeminiSettings
} from '../../../../shared/gemini'
import {
    DEFAULT_GROQ_MODEL_PRIORITY,
    DEFAULT_GROQ_SETTINGS,
    normalizeGroqSettings
} from '../../../../shared/groq'

interface MicDevice {
    deviceId: string
    label: string
}

function Card({
    icon,
    title,
    children
}: {
    icon: ReactNode
    title: string
    children: ReactNode
}) {
    return (
        <div className="bg-surface border border-border p-5 mb-3 rounded-xl">
            <div className="flex items-center gap-2 mb-4">
                {icon}
                <span className="font-mono text-[11px] font-bold text-text-sec uppercase tracking-wider">
                    {title}
                </span>
            </div>
            {children}
        </div>
    )
}

function Toggle({
    checked,
    onClick
}: {
    checked: boolean
    onClick: () => void
}) {
    return (
        <button
            onClick={onClick}
            className={`
                relative w-11 h-6 transition-colors duration-200 shrink-0 ml-4
                ${checked ? 'bg-accent' : 'bg-border'}
            `}
        >
            <span
                className={`
                    absolute top-0.5 left-0.5 w-5 h-5 bg-surface transition-transform duration-200
                    ${checked ? 'translate-x-5' : 'translate-x-0'}
                `}
            />
        </button>
    )
}

function flashSaved(
    setFlag: Dispatch<SetStateAction<boolean>>,
    timerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>
) {
    setFlag(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setFlag(false), 2000)
}

// ── Reusable model priority editor ──

function ModelPriorityEditor({
    models,
    setModels,
    defaults,
    newName,
    setNewName,
    error,
    setError,
    saving,
    saved,
    onSave,
    dirty,
    placeholder
}: {
    models: string[]
    setModels: Dispatch<SetStateAction<string[]>>
    defaults: string[]
    newName: string
    setNewName: Dispatch<SetStateAction<string>>
    error: string
    setError: Dispatch<SetStateAction<string>>
    saving: boolean
    saved: boolean
    onSave: () => void
    dirty: boolean
    placeholder: string
}) {
    const move = (index: number, direction: -1 | 1) => {
        setModels(current => {
            const target = index + direction
            if (target < 0 || target >= current.length) return current
            const next = [...current]
            const [model] = next.splice(index, 1)
            next.splice(target, 0, model)
            return next
        })
    }

    const remove = (index: number) => {
        if (models.length === 1) return
        setModels(current => current.filter((_, i) => i !== index))
    }

    const add = () => {
        const model = newName.trim()
        if (!model) {
            setError('Informe o nome exato do modelo.')
            return
        }
        if (models.some(item => item.toLowerCase() === model.toLowerCase())) {
            setError('Esse modelo já está na lista.')
            return
        }
        setModels(current => [...current, model])
        setNewName('')
        setError('')
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex gap-2">
                <input
                    value={newName}
                    onChange={e => {
                        setNewName(e.target.value)
                        if (error) setError('')
                    }}
                    onKeyDown={e => {
                        if (e.key === 'Enter') {
                            e.preventDefault()
                            add()
                        }
                    }}
                    placeholder={placeholder}
                    className="flex-1 h-10 px-3 bg-bg border border-border text-sm text-text-main placeholder:text-text-sec/40 font-mono focus:outline-none focus:border-accent transition-colors"
                />
                <button
                    onClick={add}
                    className="h-10 px-4 border border-border text-text-sec hover:text-text-main hover:border-text-sec transition-all inline-flex items-center gap-2 shrink-0"
                >
                    <Plus size={14} />
                    Adicionar
                </button>
            </div>

            {error && (
                <p className="font-mono text-[10px] text-[#c42b1c] tracking-wider">
                    {error}
                </p>
            )}

            <div className="flex flex-col gap-2">
                {models.map((model, index) => (
                    <div
                        key={`${model}-${index}`}
                        className="flex items-center gap-3 bg-bg border border-border px-3 py-3 rounded-lg"
                    >
                        <div className="w-7 h-7 rounded-full bg-surface border border-border flex items-center justify-center font-mono text-[10px] text-text-sec shrink-0">
                            {index + 1}
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-[12px] text-text-main break-all">
                                    {model}
                                </span>
                                {defaults.includes(model) && (
                                    <span className="font-mono text-[9px] uppercase tracking-wider text-text-sec/70 border border-border px-1.5 py-0.5 rounded">
                                        padrão
                                    </span>
                                )}
                            </div>
                            <span className="font-mono text-[10px] text-text-sec/55 leading-relaxed">
                                {index === 0 ? 'Primeira tentativa' : `Fallback ${index}`}
                            </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                            <button
                                onClick={() => move(index, -1)}
                                disabled={index === 0}
                                className="w-8 h-8 border border-border text-text-sec hover:text-text-main hover:border-text-sec disabled:opacity-30 disabled:cursor-not-allowed transition-all inline-flex items-center justify-center"
                                aria-label={`Subir ${model}`}
                            >
                                <ArrowUp size={14} />
                            </button>
                            <button
                                onClick={() => move(index, 1)}
                                disabled={index === models.length - 1}
                                className="w-8 h-8 border border-border text-text-sec hover:text-text-main hover:border-text-sec disabled:opacity-30 disabled:cursor-not-allowed transition-all inline-flex items-center justify-center"
                                aria-label={`Descer ${model}`}
                            >
                                <ArrowDown size={14} />
                            </button>
                            <button
                                onClick={() => remove(index)}
                                disabled={models.length === 1}
                                className="w-8 h-8 border border-border text-text-sec hover:text-[#c42b1c] hover:border-[#c42b1c] disabled:opacity-30 disabled:cursor-not-allowed transition-all inline-flex items-center justify-center"
                                aria-label={`Remover ${model}`}
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-[10px] text-text-sec/60 leading-relaxed">
                    Padrão: {defaults.join(', ')}.
                </span>
                <button
                    onClick={onSave}
                    disabled={saving || !dirty}
                    className="h-10 px-5 bg-accent text-surface text-[13px] font-semibold hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
                >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : 'Salvar modelos'}
                </button>
            </div>

            {saved && (
                <p className="font-mono text-[11px] text-success tracking-wider">
                    Prioridade de modelos salva com sucesso
                </p>
            )}
        </div>
    )
}

// ── Reusable API keys editor ──

function ApiKeysEditor({
    value,
    show,
    setShow,
    onChange,
    onSave,
    saving,
    saved,
    placeholder,
    hint
}: {
    value: string
    show: boolean
    setShow: Dispatch<SetStateAction<boolean>>
    onChange: (v: string) => void
    onSave: () => void
    saving: boolean
    saved: boolean
    placeholder: string
    hint: string
}) {
    return (
        <>
            <div className="flex gap-2">
                <div className="flex-1 relative">
                    <input
                        type={show ? 'text' : 'password'}
                        value={value}
                        onChange={e => onChange(e.target.value)}
                        placeholder={placeholder}
                        className="w-full h-10 px-3 pr-9 bg-bg border border-border text-sm text-text-main placeholder:text-text-sec/40 font-mono focus:outline-none focus:border-accent transition-colors"
                    />
                    <button
                        onClick={() => setShow(v => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-sec hover:text-text-main"
                    >
                        {show ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                </div>
                <button
                    onClick={onSave}
                    disabled={saving || !value.trim()}
                    className="h-10 px-5 bg-accent text-surface text-[13px] font-semibold hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : 'Salvar'}
                </button>
            </div>

            {saved && (
                <p className="font-mono text-[11px] text-success mt-2 tracking-wider">
                    API Key(s) salva(s) com sucesso
                </p>
            )}

            <p className="font-mono text-[10px] text-text-sec/60 mt-4 leading-relaxed">
                {hint}
            </p>
        </>
    )
}

export default function SettingsPage() {
    // ── Gemini state ──
    const [key, setKey] = useState('')
    const [showKey, setShowKey] = useState(false)
    const [keySaving, setKeySaving] = useState(false)
    const [keySaved, setKeySaved] = useState(false)

    // ── Groq state ──
    const [groqKeys, setGroqKeys] = useState('')
    const [showGroqKeys, setShowGroqKeys] = useState(false)
    const [groqKeysSaving, setGroqKeysSaving] = useState(false)
    const [groqKeysSaved, setGroqKeysSaved] = useState(false)

    // ── UI state ──
    const [compact, setCompact] = useState(false)
    const [widgetIconOnly, setWidgetIconOnly] = useState(false)
    const [autoLaunch, setAutoLaunch] = useState(false)
    const [mics, setMics] = useState<MicDevice[]>([])
    const [selectedMic, setSelectedMic] = useState('')
    const [testLevel, setTestLevel] = useState(0)
    const [testing, setTesting] = useState(false)
    const [engine, setEngine] = useState<'gemini' | 'whisper' | 'groq'>('gemini')

    // ── Gemini prompts ──
    const [transcriptionPrompt, setTranscriptionPrompt] = useState(DEFAULT_GEMINI_SETTINGS.transcriptionPrompt)
    const [feedbackPrompt, setFeedbackPrompt] = useState(DEFAULT_GEMINI_SETTINGS.feedbackPrompt)
    const [savedPrompts, setSavedPrompts] = useState(() => ({
        transcriptionPrompt: DEFAULT_GEMINI_SETTINGS.transcriptionPrompt,
        feedbackPrompt: DEFAULT_GEMINI_SETTINGS.feedbackPrompt
    }))
    const [promptsSaving, setPromptsSaving] = useState(false)
    const [promptsSaved, setPromptsSaved] = useState(false)

    // ── Groq prompt ──
    const [groqTranscriptionPrompt, setGroqTranscriptionPrompt] = useState(
        DEFAULT_GROQ_SETTINGS.transcriptionPrompt
    )
    const [savedGroqTranscriptionPrompt, setSavedGroqTranscriptionPrompt] = useState(
        DEFAULT_GROQ_SETTINGS.transcriptionPrompt
    )
    const [groqPromptSaving, setGroqPromptSaving] = useState(false)
    const [groqPromptSaved, setGroqPromptSaved] = useState(false)

    // ── Gemini models ──
    const [geminiModels, setGeminiModels] = useState<string[]>([...DEFAULT_GEMINI_SETTINGS.modelPriority])
    const [savedGeminiModels, setSavedGeminiModels] = useState<string[]>([...DEFAULT_GEMINI_SETTINGS.modelPriority])
    const [newGeminiModel, setNewGeminiModel] = useState('')
    const [geminiModelError, setGeminiModelError] = useState('')
    const [geminiModelsSaving, setGeminiModelsSaving] = useState(false)
    const [geminiModelsSaved, setGeminiModelsSaved] = useState(false)

    // ── Groq models ──
    const [groqModels, setGroqModels] = useState<string[]>([...DEFAULT_GROQ_SETTINGS.modelPriority])
    const [savedGroqModels, setSavedGroqModels] = useState<string[]>([...DEFAULT_GROQ_SETTINGS.modelPriority])
    const [newGroqModel, setNewGroqModel] = useState('')
    const [groqModelError, setGroqModelError] = useState('')
    const [groqModelsSaving, setGroqModelsSaving] = useState(false)
    const [groqModelsSaved, setGroqModelsSaved] = useState(false)

    // ── Refs ──
    const testStreamRef = useRef<MediaStream | null>(null)
    const testAnimRef = useRef(0)
    const testCtxRef = useRef<AudioContext | null>(null)
    const testTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const apiSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const groqSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const promptSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const groqPromptSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const geminiModelSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const groqModelSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const loadMics = useCallback(async () => {
        try {
            const tempStream = await navigator.mediaDevices.getUserMedia({
                audio: { autoGainControl: false, noiseSuppression: false, echoCancellation: false }
            })
            tempStream.getTracks().forEach((track) => track.stop())
        } catch {
            // Ignore permission errors and use generic labels.
        }

        const devices = await navigator.mediaDevices.enumerateDevices()
        setMics(
            devices
                .filter((device) => device.kind === 'audioinput')
                .map((device, index) => ({
                    deviceId: device.deviceId,
                    label: device.label || `Microfone ${index + 1}`
                }))
        )
    }, [])

    useEffect(() => {
        Promise.all([
            window.api.getApiKey(),
            window.api.getGroqApiKeys(),
            window.api.getSidebarCompact(),
            window.api.getWidgetIconOnly(),
            window.api.getAutoLaunch(),
            window.api.getSelectedMic(),
            window.api.getGeminiSettings(),
            window.api.getGroqSettings()
        ]).then(([apiKey, groqApiKeys, sidebarCompact, iconOnly, autoLaunchEnabled, micId, geminiSettings, groqSettings]) => {
            const normGemini = normalizeGeminiSettings(geminiSettings)
            const normGroq = normalizeGroqSettings(groqSettings)
            setKey(apiKey)
            setGroqKeys(groqApiKeys)
            setCompact(sidebarCompact)
            setWidgetIconOnly(iconOnly)
            setAutoLaunch(autoLaunchEnabled)
            setSelectedMic(micId)
            setTranscriptionPrompt(normGemini.transcriptionPrompt)
            setFeedbackPrompt(normGemini.feedbackPrompt)
            setSavedPrompts({
                transcriptionPrompt: normGemini.transcriptionPrompt,
                feedbackPrompt: normGemini.feedbackPrompt
            })
            setGeminiModels([...normGemini.modelPriority])
            setSavedGeminiModels([...normGemini.modelPriority])
            setGroqTranscriptionPrompt(normGroq.transcriptionPrompt)
            setSavedGroqTranscriptionPrompt(normGroq.transcriptionPrompt)
            setGroqModels([...normGroq.modelPriority])
            setSavedGroqModels([...normGroq.modelPriority])
        })

        window.api.getTranscriptionEngine().then(setEngine)
        loadMics()
    }, [loadMics])

    useEffect(() => {
        return () => {
            if (testTimerRef.current) clearTimeout(testTimerRef.current)
            if (apiSaveTimerRef.current) clearTimeout(apiSaveTimerRef.current)
            if (groqSaveTimerRef.current) clearTimeout(groqSaveTimerRef.current)
            if (promptSaveTimerRef.current) clearTimeout(promptSaveTimerRef.current)
            if (groqPromptSaveTimerRef.current) clearTimeout(groqPromptSaveTimerRef.current)
            if (geminiModelSaveTimerRef.current) clearTimeout(geminiModelSaveTimerRef.current)
            if (groqModelSaveTimerRef.current) clearTimeout(groqModelSaveTimerRef.current)
            cancelAnimationFrame(testAnimRef.current)
            if (testStreamRef.current) testStreamRef.current.getTracks().forEach((track) => track.stop())
            testCtxRef.current?.close().catch(() => { })
        }
    }, [])

    // ── Save handlers ──

    const saveApiKey = async () => {
        setKeySaving(true)
        await window.api.saveApiKey(key.trim())
        setKeySaving(false)
        flashSaved(setKeySaved, apiSaveTimerRef)
    }

    const saveGroqApiKeys = async () => {
        setGroqKeysSaving(true)
        await window.api.saveGroqApiKeys(groqKeys.trim())
        setGroqKeysSaving(false)
        flashSaved(setGroqKeysSaved, groqSaveTimerRef)
    }

    const savePrompts = async () => {
        setPromptsSaving(true)
        const stored = await window.api.saveGeminiSettings({
            transcriptionPrompt,
            feedbackPrompt,
            modelPriority: savedGeminiModels
        })
        setPromptsSaving(false)
        setTranscriptionPrompt(stored.transcriptionPrompt)
        setFeedbackPrompt(stored.feedbackPrompt)
        setSavedPrompts({
            transcriptionPrompt: stored.transcriptionPrompt,
            feedbackPrompt: stored.feedbackPrompt
        })
        flashSaved(setPromptsSaved, promptSaveTimerRef)
    }

    const saveGeminiModels = async () => {
        setGeminiModelsSaving(true)
        const stored = await window.api.saveGeminiSettings({
            transcriptionPrompt: savedPrompts.transcriptionPrompt,
            feedbackPrompt: savedPrompts.feedbackPrompt,
            modelPriority: geminiModels
        })
        setGeminiModelsSaving(false)
        setGeminiModels([...stored.modelPriority])
        setSavedGeminiModels([...stored.modelPriority])
        flashSaved(setGeminiModelsSaved, geminiModelSaveTimerRef)
    }

    const saveGroqPrompt = async () => {
        setGroqPromptSaving(true)
        const stored = await window.api.saveGroqSettings({
            transcriptionPrompt: groqTranscriptionPrompt,
            modelPriority: savedGroqModels
        })
        setGroqPromptSaving(false)
        setGroqTranscriptionPrompt(stored.transcriptionPrompt)
        setSavedGroqTranscriptionPrompt(stored.transcriptionPrompt)
        flashSaved(setGroqPromptSaved, groqPromptSaveTimerRef)
    }

    const saveGroqModels = async () => {
        setGroqModelsSaving(true)
        const stored = await window.api.saveGroqSettings({
            transcriptionPrompt: savedGroqTranscriptionPrompt,
            modelPriority: groqModels
        })
        setGroqModelsSaving(false)
        setGroqModels([...stored.modelPriority])
        setSavedGroqModels([...stored.modelPriority])
        flashSaved(setGroqModelsSaved, groqModelSaveTimerRef)
    }

    // ── Toggle helpers ──

    const toggleCompact = async () => {
        const next = !compact
        setCompact(next)
        await window.api.saveSidebarCompact(next)
    }

    const toggleWidgetIcon = async () => {
        const next = !widgetIconOnly
        setWidgetIconOnly(next)
        await window.api.saveWidgetIconOnly(next)
    }

    const toggleAutoLaunch = async () => {
        const next = !autoLaunch
        setAutoLaunch(next)
        await window.api.saveAutoLaunch(next)
    }

    const changeMic = async (deviceId: string) => {
        setSelectedMic(deviceId)
        await window.api.saveSelectedMic(deviceId)
    }

    // ── Mic test ──

    const stopTest = () => {
        if (testTimerRef.current) {
            clearTimeout(testTimerRef.current)
            testTimerRef.current = null
        }
        cancelAnimationFrame(testAnimRef.current)
        if (testStreamRef.current) {
            testStreamRef.current.getTracks().forEach((track) => track.stop())
            testStreamRef.current = null
        }
        testCtxRef.current?.close().catch(() => { })
        testCtxRef.current = null
        setTesting(false)
        setTestLevel(0)
    }

    const testMic = async () => {
        if (testing) {
            stopTest()
            return
        }

        setTesting(true)

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    ...(selectedMic ? { deviceId: { exact: selectedMic } } : {}),
                    autoGainControl: false,
                    noiseSuppression: false,
                    echoCancellation: false
                }
            })
            testStreamRef.current = stream

            const ctx = new AudioContext()
            testCtxRef.current = ctx
            const source = ctx.createMediaStreamSource(stream)
            const analyser = ctx.createAnalyser()
            analyser.fftSize = 256
            source.connect(analyser)
            const data = new Uint8Array(analyser.frequencyBinCount)

            const read = () => {
                analyser.getByteFrequencyData(data)
                let peak = 0
                for (let index = 0; index < data.length; index++) {
                    if (data[index] > peak) peak = data[index]
                }
                setTestLevel(peak / 255)
                testAnimRef.current = requestAnimationFrame(read)
            }

            read()
            testTimerRef.current = setTimeout(stopTest, 5000)
        } catch {
            setTesting(false)
            setTestLevel(0)
        }
    }

    // ── Dirty checks ──

    const promptsDirty =
        transcriptionPrompt.trim() !== savedPrompts.transcriptionPrompt ||
        feedbackPrompt.trim() !== savedPrompts.feedbackPrompt

    const geminiModelsDirty =
        geminiModels.length !== savedGeminiModels.length ||
        geminiModels.some((model, index) => model !== savedGeminiModels[index])

    const groqPromptDirty =
        groqTranscriptionPrompt.trim() !== savedGroqTranscriptionPrompt

    const groqModelsDirty =
        groqModels.length !== savedGroqModels.length ||
        groqModels.some((model, index) => model !== savedGroqModels[index])

    return (
        <div className="flex flex-col h-full overflow-y-auto p-6">
            <div className="mb-5">
                <h1 className="font-display text-lg font-bold tracking-tight text-text-main">
                    Configurações
                </h1>
                <p className="font-mono text-[10px] text-text-sec tracking-wider mt-0.5">
                    Aparência, integrações, Gemini e Groq
                </p>
            </div>

            <Card
                icon={<Power size={15} strokeWidth={1.8} className="text-accent" />}
                title="Inicialização"
            >
                <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                        <span className="text-[13px] font-medium text-text-main">
                            Iniciar com o Windows
                        </span>
                        <span className="font-mono text-[10px] text-text-sec/60 leading-relaxed">
                            Abre o Haumea Voice automaticamente quando o computador ligar.
                        </span>
                    </div>
                    <Toggle checked={autoLaunch} onClick={toggleAutoLaunch} />
                </div>
            </Card>

            {/* ── Engine selector ── */}

            <Card
                icon={<AudioWaveform size={15} strokeWidth={1.8} className="text-accent" />}
                title="Motor de transcrição"
            >
                <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                        <span className="text-[13px] font-medium text-text-main">
                            Escolha como o áudio gravado será transcrito
                        </span>
                        <span className="font-mono text-[10px] text-text-sec/60 leading-relaxed">
                            Gemini usa a Google AI API. Groq usa Whisper na nuvem via Groq. Whisper (Local) roda 100% no seu PC.
                        </span>
                    </div>

                    <div className="flex gap-2">
                        {(['gemini', 'groq', 'whisper'] as const).map(opt => {
                            const active = engine === opt
                            const labels = {
                                gemini: { name: 'Gemini', desc: 'Google AI — multimodal' },
                                groq: { name: 'Groq Whisper', desc: 'Nuvem — rápido, Whisper' },
                                whisper: { name: 'Whisper Local', desc: 'Offline — privado' }
                            }
                            return (
                                <button
                                    key={opt}
                                    onClick={async () => {
                                        setEngine(opt)
                                        await window.api.saveTranscriptionEngine(opt)
                                    }}
                                    className={`
                                        flex-1 flex flex-col gap-1 p-3 border transition-all
                                        ${active
                                            ? 'border-accent bg-accent/5'
                                            : 'border-border hover:border-text-sec/30'
                                        }
                                    `}
                                >
                                    <span className={`text-[13px] font-medium ${active ? 'text-accent' : 'text-text-main'}`}>
                                        {labels[opt].name}
                                    </span>
                                    <span className="font-mono text-[10px] text-text-sec/60 leading-relaxed">
                                        {labels[opt].desc}
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                </div>
            </Card>

            {/* ── Microphone ── */}

            <Card icon={<Mic size={15} strokeWidth={1.8} className="text-accent" />} title="Microfone">
                <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                        <span className="text-[13px] font-medium text-text-main">
                            Dispositivo de entrada
                        </span>
                        <span className="font-mono text-[10px] text-text-sec/60 leading-relaxed">
                            Escolha qual microfone usar para gravação. O processamento de áudio
                            do navegador fica desabilitado para evitar conflitos externos.
                        </span>
                    </div>

                    <div className="flex gap-2">
                        <select
                            value={selectedMic}
                            onChange={(event) => changeMic(event.target.value)}
                            className="flex-1 h-10 px-3 bg-bg border border-border text-sm text-text-main font-mono focus:outline-none focus:border-accent transition-colors appearance-none cursor-pointer"
                        >
                            <option value="">Padrão do sistema</option>
                            {mics.map((mic) => (
                                <option key={mic.deviceId} value={mic.deviceId}>
                                    {mic.label}
                                </option>
                            ))}
                        </select>

                        <button
                            onClick={testMic}
                            className={`
                                h-10 px-4 text-[13px] font-semibold transition-all shrink-0
                                ${testing
                                    ? 'bg-accent text-surface'
                                    : 'border border-border text-text-sec hover:text-text-main hover:border-text-sec'}
                            `}
                        >
                            {testing ? 'Parar' : 'Testar'}
                        </button>
                    </div>

                    {testing && (
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] text-text-sec tracking-wider shrink-0">
                                Nível
                            </span>
                            <div className="flex-1 h-2 bg-bg border border-border overflow-hidden">
                                <div
                                    className="h-full transition-all duration-75"
                                    style={{
                                        width: `${Math.round(testLevel * 100)}%`,
                                        background:
                                            testLevel > 0.8
                                                ? '#c42b1c'
                                                : testLevel > 0.4
                                                    ? '#de491b'
                                                    : '#4a9d5b'
                                    }}
                                />
                            </div>
                            <span className="font-mono text-[10px] text-text-sec tabular-nums w-8 text-right">
                                {Math.round(testLevel * 100)}%
                            </span>
                        </div>
                    )}
                </div>
            </Card>

            {/* ── Sidebar ── */}

            <Card
                icon={<PanelLeft size={15} strokeWidth={1.8} className="text-accent" />}
                title="Barra lateral"
            >
                <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                        <span className="text-[13px] font-medium text-text-main">
                            Modo compacto
                        </span>
                        <span className="font-mono text-[10px] text-text-sec/60 leading-relaxed">
                            Exibe apenas o ícone na barra lateral, ocultando os rótulos de texto.
                        </span>
                    </div>
                    <Toggle checked={compact} onClick={toggleCompact} />
                </div>

                <div className="mt-4 pt-4 border-t border-border">
                    <span className="font-mono text-[10px] text-text-sec/50 uppercase tracking-wider mb-2 block">
                        Preview
                    </span>
                    <div
                        className={`
                            flex items-center gap-2 h-9 px-3 bg-bg border border-border transition-all duration-200
                            ${compact ? 'w-10 justify-center px-0' : 'w-44'}
                        `}
                    >
                        <HaumeaIcon size={18} className="text-accent shrink-0" />
                        {!compact && (
                            <span className="font-display text-[12px] font-bold tracking-[0.04em] text-text-main uppercase">
                                Haumea
                            </span>
                        )}
                    </div>
                </div>
            </Card>

            {/* ── Widget ── */}

            <Card
                icon={<Monitor size={15} strokeWidth={1.8} className="text-accent" />}
                title="Widget flutuante"
            >
                <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                        <span className="text-[13px] font-medium text-text-main">
                            Apenas ícone
                        </span>
                        <span className="font-mono text-[10px] text-text-sec/60 leading-relaxed">
                            Mostra apenas o ícone no widget, sem o nome "Haumea Voice".
                        </span>
                    </div>
                    <Toggle checked={widgetIconOnly} onClick={toggleWidgetIcon} />
                </div>

                <div className="mt-4 pt-4 border-t border-border">
                    <span className="font-mono text-[10px] text-text-sec/50 uppercase tracking-wider mb-2 block">
                        Preview
                    </span>
                    <div
                        className={`
                            flex items-center gap-2 h-[34px] rounded-[10px] transition-all duration-200
                            ${widgetIconOnly ? 'w-[42px] justify-center' : 'w-[155px] px-3'}
                        `}
                        style={{
                            background: 'rgba(24, 24, 27, 0.92)',
                            boxShadow: '0 2px 12px rgba(0,0,0,0.12)'
                        }}
                    >
                        <HaumeaIcon size={widgetIconOnly ? 18 : 14} className="text-accent shrink-0" />
                        {!widgetIconOnly && (
                            <span className="font-sans text-[11.5px] font-semibold tracking-tight text-white/90">
                                Haumea Voice
                            </span>
                        )}
                    </div>
                </div>
            </Card>

            {/* ── Gemini API Key(s) ── */}

            <Card
                icon={<Settings size={15} strokeWidth={1.8} className="text-accent" />}
                title="Gemini — API Keys"
            >
                <div className="flex flex-col gap-1 mb-3">
                    <span className="text-[13px] font-medium text-text-main">
                        Chave(s) da Google AI Studio
                    </span>
                    <span className="font-mono text-[10px] text-text-sec/60 leading-relaxed">
                        Uma key ou múltiplas separadas por vírgula. O pool faz rotação automática e cooldown em rate limit.
                    </span>
                </div>
                <ApiKeysEditor
                    value={key}
                    show={showKey}
                    setShow={setShowKey}
                    onChange={setKey}
                    onSave={saveApiKey}
                    saving={keySaving}
                    saved={keySaved}
                    placeholder="AIza... ou AIza...,AIza...,AIza..."
                    hint="Armazenadas localmente via electron-store. Nunca enviadas a terceiros, apenas à Google AI API."
                />
            </Card>

            {/* ── Groq API Key(s) ── */}

            <Card
                icon={<Cloud size={15} strokeWidth={1.8} className="text-accent" />}
                title="Groq — API Keys"
            >
                <div className="flex flex-col gap-1 mb-3">
                    <span className="text-[13px] font-medium text-text-main">
                        Chave(s) da Groq Cloud
                    </span>
                    <span className="font-mono text-[10px] text-text-sec/60 leading-relaxed">
                        Uma key ou múltiplas separadas por vírgula. Necessárias para usar o motor Groq Whisper.
                    </span>
                </div>
                <ApiKeysEditor
                    value={groqKeys}
                    show={showGroqKeys}
                    setShow={setShowGroqKeys}
                    onChange={setGroqKeys}
                    onSave={saveGroqApiKeys}
                    saving={groqKeysSaving}
                    saved={groqKeysSaved}
                    placeholder="gsk_... ou gsk_...,gsk_...,gsk_..."
                    hint="Armazenadas localmente. Enviadas apenas à API do Groq para transcrição."
                />
            </Card>

            {/* ── Groq prompt ── */}

            <Card icon={<Cloud size={15} strokeWidth={1.8} className="text-accent" />} title="Groq — Prompt">
                <div className="flex flex-col gap-1.5">
                    <span className="text-[13px] font-medium text-text-main">
                        Prompt de transcrição opcional
                    </span>
                    <textarea
                        value={groqTranscriptionPrompt}
                        onChange={(event) => setGroqTranscriptionPrompt(event.target.value)}
                        className="w-full min-h-[170px] p-3 bg-bg border border-border text-[12px] leading-relaxed text-text-main font-mono focus:outline-none focus:border-accent transition-colors resize-y"
                    />
                    <span className="font-mono text-[10px] text-text-sec/60 leading-relaxed">
                        As transcrições da Groq agora são enviadas sem contexto por padrão, para
                        que cada áudio seja interpretado isoladamente.
                    </span>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="font-mono text-[10px] text-text-sec/60 leading-relaxed">
                        Deixe vazio para manter a transcrição sem viés de vocabulário.
                    </span>
                    <button
                        onClick={saveGroqPrompt}
                        disabled={groqPromptSaving || !groqPromptDirty}
                        className="h-10 px-5 bg-accent text-surface text-[13px] font-semibold hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
                    >
                        {groqPromptSaving ? <Loader2 size={14} className="animate-spin" /> : 'Salvar prompt'}
                    </button>
                </div>

                {groqPromptSaved && (
                    <p className="font-mono text-[11px] text-success mt-2 tracking-wider">
                        Prompt da Groq salvo com sucesso
                    </p>
                )}
            </Card>

            {/* ── Gemini prompts ── */}

            <Card icon={<Bot size={15} strokeWidth={1.8} className="text-accent" />} title="Gemini — Prompts">
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <span className="text-[13px] font-medium text-text-main">
                            Prompt de transcrição
                        </span>
                        <textarea
                            value={transcriptionPrompt}
                            onChange={(event) => setTranscriptionPrompt(event.target.value)}
                            className="w-full min-h-[210px] p-3 bg-bg border border-border text-[12px] leading-relaxed text-text-main font-mono focus:outline-none focus:border-accent transition-colors resize-y"
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <span className="text-[13px] font-medium text-text-main">
                            Prompt de avaliação
                        </span>
                        <textarea
                            value={feedbackPrompt}
                            onChange={(event) => setFeedbackPrompt(event.target.value)}
                            className="w-full min-h-[320px] p-3 bg-bg border border-border text-[12px] leading-relaxed text-text-main font-mono focus:outline-none focus:border-accent transition-colors resize-y"
                        />
                        <span className="font-mono text-[10px] text-text-sec/60 leading-relaxed">
                            A transcrição de apoio é anexada automaticamente ao prompt de
                            avaliação quando existir.
                        </span>
                    </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="font-mono text-[10px] text-text-sec/60 leading-relaxed">
                        Esses textos passam a ser usados nas próximas transcrições e avaliações.
                    </span>
                    <button
                        onClick={savePrompts}
                        disabled={promptsSaving || !transcriptionPrompt.trim() || !feedbackPrompt.trim() || !promptsDirty}
                        className="h-10 px-5 bg-accent text-surface text-[13px] font-semibold hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
                    >
                        {promptsSaving ? <Loader2 size={14} className="animate-spin" /> : 'Salvar prompts'}
                    </button>
                </div>

                {promptsSaved && (
                    <p className="font-mono text-[11px] text-success mt-2 tracking-wider">
                        Prompts do Gemini salvos com sucesso
                    </p>
                )}
            </Card>

            {/* ── Gemini models ── */}

            <Card icon={<Bot size={15} strokeWidth={1.8} className="text-accent" />} title="Gemini — Ordem de modelos">
                <div className="flex flex-col gap-1 mb-4">
                    <span className="text-[13px] font-medium text-text-main">
                        Modelos usados no fallback
                    </span>
                    <span className="font-mono text-[10px] text-text-sec/60 leading-relaxed">
                        O primeiro modelo é tentado antes. Os próximos entram como fallback na
                        ordem definida abaixo.
                    </span>
                </div>
                <ModelPriorityEditor
                    models={geminiModels}
                    setModels={setGeminiModels}
                    defaults={DEFAULT_GEMINI_MODEL_PRIORITY}
                    newName={newGeminiModel}
                    setNewName={setNewGeminiModel}
                    error={geminiModelError}
                    setError={setGeminiModelError}
                    saving={geminiModelsSaving}
                    saved={geminiModelsSaved}
                    onSave={saveGeminiModels}
                    dirty={geminiModelsDirty}
                    placeholder="Ex.: gemini-2.5-pro"
                />
            </Card>

            {/* ── Groq models ── */}

            <Card icon={<Cloud size={15} strokeWidth={1.8} className="text-accent" />} title="Groq — Ordem de modelos">
                <div className="flex flex-col gap-1 mb-4">
                    <span className="text-[13px] font-medium text-text-main">
                        Modelos Whisper usados no fallback
                    </span>
                    <span className="font-mono text-[10px] text-text-sec/60 leading-relaxed">
                        O primeiro modelo é tentado antes. Os próximos entram como fallback na
                        ordem definida abaixo.
                    </span>
                </div>
                <ModelPriorityEditor
                    models={groqModels}
                    setModels={setGroqModels}
                    defaults={DEFAULT_GROQ_MODEL_PRIORITY}
                    newName={newGroqModel}
                    setNewName={setNewGroqModel}
                    error={groqModelError}
                    setError={setGroqModelError}
                    saving={groqModelsSaving}
                    saved={groqModelsSaved}
                    onSave={saveGroqModels}
                    dirty={groqModelsDirty}
                    placeholder="Ex.: whisper-large-v3"
                />
            </Card>
        </div>
    )
}
