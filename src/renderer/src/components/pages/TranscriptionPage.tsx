import { useState, useEffect, useRef, useCallback } from 'react'
import {
    Download,
    Trash2,
    Loader2,
    FileAudio,
    X,
    Languages,
    Play,
    Square,
    CheckCircle,
    AlertTriangle,
    HardDrive,
    FolderOpen,
    Copy,
    Info
} from 'lucide-react'
import type {
    WhisperModel,
    ModelState,
    DownloadProgress,
    TranscriptionProgress,
    TranscriptionResult,
    SystemCheck
} from '../../../../shared/whisper'
import { WHISPER_LANGUAGES } from '../../../../shared/whisper'
import { cleanTranscriptionArtifacts } from '../../services/postprocess'

type ModelWithState = WhisperModel & { state: ModelState }

function fmt(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`
    if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`
    return `${(bytes / 1073741824).toFixed(2)} GB`
}

function StatusBadge({ status }: { status: ModelState['status'] }) {
    const map = {
        ready: { label: 'Pronto', color: 'text-success border-success/30' },
        downloading: { label: 'Baixando...', color: 'text-accent border-accent/30' },
        absent: { label: 'Não baixado', color: 'text-text-sec/60 border-border' },
        error: { label: 'Erro', color: 'text-[#c42b1c] border-[#c42b1c]/30' }
    }
    const { label, color } = map[status]
    return (
        <span className={`font-mono text-[9px] uppercase tracking-wider border px-1.5 py-0.5 ${color}`}>
            {label}
        </span>
    )
}

export default function TranscriptionPage() {
    const [models, setModels] = useState<ModelWithState[]>([])
    const [selectedModel, setSelectedModel] = useState('')
    const [language, setLanguage] = useState('auto')
    const [audioPath, setAudioPath] = useState<string | null>(null)
    const [modelsPath, setModelsPath] = useState('')
    const [systemCheck, setSystemCheck] = useState<SystemCheck | null>(null)
    const [downloadProgress, setDownloadProgress] = useState<Record<string, DownloadProgress>>({})
    const [transcribing, setTranscribing] = useState(false)
    const [transProgress, setTransProgress] = useState(0)
    const [result, setResult] = useState<TranscriptionResult | null>(null)
    const [error, setError] = useState('')
    const [copied, setCopied] = useState(false)

    const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const loadModels = useCallback(async () => {
        const list = await window.api.whisperListModels()
        setModels(list)
    }, [])

    useEffect(() => {
        loadModels()
        window.api.whisperGetSettings().then(s => {
            setSelectedModel(s.selectedModel)
            setLanguage(s.language)
        })
        window.api.whisperGetModelsPath().then(setModelsPath)
        window.api.whisperCheckSystem().then(setSystemCheck)

        const unsubDl = window.api.onWhisperDownloadProgress((p) => {
            setDownloadProgress(prev => ({ ...prev, [p.modelId]: p }))
            if (p.percent >= 100) {
                setTimeout(loadModels, 300)
            }
        })

        const unsubTp = window.api.onWhisperTranscriptionProgress((p: TranscriptionProgress) => {
            setTransProgress(p.percent)
        })

        return () => {
            unsubDl()
            unsubTp()
            if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
        }
    }, [loadModels])

    const handleDownload = async (modelId: string) => {
        setError('')
        setDownloadProgress(prev => ({ ...prev, [modelId]: { modelId, percent: 0, bytesDownloaded: 0, bytesTotal: 0, speed: 0 } }))
        setModels(prev => prev.map(m => m.id === modelId ? { ...m, state: { ...m.state, status: 'downloading' as const, progress: 0 } } : m))

        const res = await window.api.whisperDownloadModel(modelId)

        if (res && !res.ok && !res.cancelled) {
            setError(res.error || 'Erro ao baixar modelo')
        }

        setDownloadProgress(prev => {
            const next = { ...prev }
            delete next[modelId]
            return next
        })
        loadModels()
    }

    const handleCancelDownload = async (modelId: string) => {
        await window.api.whisperCancelDownload(modelId)
        setDownloadProgress(prev => {
            const next = { ...prev }
            delete next[modelId]
            return next
        })
        loadModels()
    }

    const handleDelete = async (modelId: string) => {
        await window.api.whisperDeleteModel(modelId)
        setDownloadProgress(prev => {
            const next = { ...prev }
            delete next[modelId]
            return next
        })
        loadModels()
    }

    const handleSelectFile = async () => {
        const path = await window.api.whisperSelectAudioFile()
        if (path) setAudioPath(path)
    }

    const handleTranscribe = async () => {
        if (!audioPath || !selectedModel) return

        const modelState = models.find(m => m.id === selectedModel)
        if (!modelState || modelState.state.status !== 'ready') {
            setError('Modelo selecionado não está pronto. Baixe-o primeiro.')
            return
        }

        setTranscribing(true)
        setTransProgress(0)
        setResult(null)
        setError('')

        await window.api.whisperSaveSettings({ selectedModel, language })

        try {
            const res = await window.api.whisperTranscribe({
                audioPath,
                modelId: selectedModel,
                language,
                temperature: 0.1
            })

            if (res.ok && res.result) {
                setResult({
                    ...res.result,
                    text: cleanTranscriptionArtifacts(res.result.text)
                })
            } else {
                setError(res.error || 'Erro desconhecido na transcrição')
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro na transcrição')
        } finally {
            setTranscribing(false)
            setTransProgress(0)
        }
    }

    const handleCancel = () => {
        window.api.whisperCancelTranscription()
        setTranscribing(false)
        setTransProgress(0)
    }

    const handleCopy = () => {
        if (!result?.text) return
        window.api.copyToClipboard(result.text)
        setCopied(true)
        if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
        copyTimerRef.current = setTimeout(() => setCopied(false), 2000)
    }

    const handleChangeModelsPath = async () => {
        const newPath = await window.api.whisperSetModelsPath()
        if (newPath) {
            setModelsPath(newPath)
            loadModels()
        }
    }

    const fileName = audioPath?.split(/[\\/]/).pop() ?? null
    const readyModels = models.filter(m => m.state.status === 'ready')

    const systemOk = systemCheck?.python && systemCheck?.ffmpeg
    const checkingSystem = systemCheck === null

    return (
        <div className="flex flex-col h-full overflow-y-auto p-6">
            <div className="mb-5">
                <h1 className="font-display text-lg font-bold tracking-tight text-text-main">
                    Transcrição Offline
                </h1>
                <p className="font-mono text-[10px] text-text-sec tracking-wider mt-0.5">
                    Faster-Whisper — transcreva áudios localmente, sem internet
                </p>
            </div>

            {/* System check */}
            {!checkingSystem && !systemOk && (
                <div className="bg-[#c42b1c]/8 border border-[#c42b1c]/20 p-4 mb-3">
                    <div className="flex items-start gap-2">
                        <AlertTriangle size={15} strokeWidth={1.8} className="text-[#c42b1c] shrink-0 mt-0.5" />
                        <div className="flex flex-col gap-1">
                            <span className="text-[13px] font-medium text-text-main">
                                Dependências ausentes
                            </span>
                            <div className="font-mono text-[10px] text-text-sec leading-relaxed">
                                {!systemCheck?.python && (
                                    <p>• Python não encontrado. Instale o Python 3.10+ e adicione ao PATH.</p>
                                )}
                                {!systemCheck?.ffmpeg && (
                                    <p>• ffmpeg não encontrado. Instale o ffmpeg e adicione ao PATH.</p>
                                )}
                                {systemCheck?.python && (
                                    <p className="mt-1">Execute: <code className="bg-sidebar px-1">pip install faster-whisper</code></p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Models */}
            <div className="bg-surface border border-border p-5 mb-3">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <HardDrive size={15} strokeWidth={1.8} className="text-accent" />
                        <span className="font-mono text-[11px] font-bold text-text-sec uppercase tracking-wider">
                            Modelos
                        </span>
                    </div>
                    <button
                        onClick={handleChangeModelsPath}
                        title={modelsPath}
                        className="flex items-center gap-1.5 font-mono text-[10px] text-text-sec hover:text-text-main transition-colors"
                    >
                        <FolderOpen size={12} />
                        {modelsPath.length > 40 ? `...${modelsPath.slice(-35)}` : modelsPath}
                    </button>
                </div>

                <div className="flex flex-col gap-2">
                    {models.map(m => {
                        const dl = downloadProgress[m.id]
                        const isDownloading = m.state.status === 'downloading'
                        const isReady = m.state.status === 'ready'

                        return (
                            <div
                                key={m.id}
                                className={`
                                    relative bg-bg border px-4 py-3 transition-colors
                                    ${selectedModel === m.id && isReady
                                        ? 'border-accent/40'
                                        : 'border-border'
                                    }
                                `}
                            >
                                <div className="flex items-center gap-3">
                                    {/* Selection radio */}
                                    <button
                                        onClick={() => {
                                            if (!isReady) return
                                            setSelectedModel(m.id)
                                            window.api.whisperSaveSettings({ selectedModel: m.id })
                                        }}
                                        disabled={!isReady}
                                        className={`
                                            w-4 h-4 border-2 shrink-0 flex items-center justify-center transition-colors
                                            ${selectedModel === m.id && isReady
                                                ? 'border-accent'
                                                : 'border-border'
                                            }
                                            ${!isReady ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}
                                        `}
                                    >
                                        {selectedModel === m.id && isReady && (
                                            <div className="w-2 h-2 bg-accent" />
                                        )}
                                    </button>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-[13px] font-medium text-text-main">
                                                {m.name}
                                            </span>
                                            <span className="font-mono text-[10px] text-text-sec/60">
                                                {m.sizeLabel}
                                            </span>
                                            <StatusBadge status={m.state.status} />
                                        </div>
                                        <p className="font-mono text-[10px] text-text-sec/60 mt-0.5 leading-relaxed">
                                            {m.description}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                        {isDownloading ? (
                                            <button
                                                onClick={() => handleCancelDownload(m.id)}
                                                className="w-8 h-8 border border-border text-text-sec hover:text-[#c42b1c] hover:border-[#c42b1c] transition-all inline-flex items-center justify-center"
                                                title="Cancelar download"
                                            >
                                                <X size={14} />
                                            </button>
                                        ) : isReady ? (
                                            <button
                                                onClick={() => handleDelete(m.id)}
                                                className="w-8 h-8 border border-border text-text-sec hover:text-[#c42b1c] hover:border-[#c42b1c] transition-all inline-flex items-center justify-center"
                                                title="Remover modelo"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleDownload(m.id)}
                                                className="h-8 px-3 border border-border text-text-sec hover:text-accent hover:border-accent transition-all inline-flex items-center gap-1.5"
                                                title="Baixar modelo"
                                            >
                                                <Download size={13} />
                                                <span className="text-[11px] font-medium">Baixar</span>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Download progress bar */}
                                {isDownloading && dl && (
                                    <div className="mt-2 flex items-center gap-2">
                                        <div className="flex-1 h-1.5 bg-border overflow-hidden">
                                            <div
                                                className="h-full bg-accent transition-all duration-300"
                                                style={{ width: `${dl.percent}%` }}
                                            />
                                        </div>
                                        <span className="font-mono text-[10px] text-text-sec tabular-nums w-14 text-right">
                                            {dl.percent}% — {fmt(dl.bytesDownloaded)}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Transcription panel */}
            <div className="bg-surface border border-border p-5 mb-3">
                <div className="flex items-center gap-2 mb-4">
                    <FileAudio size={15} strokeWidth={1.8} className="text-accent" />
                    <span className="font-mono text-[11px] font-bold text-text-sec uppercase tracking-wider">
                        Transcrever
                    </span>
                </div>

                <div className="flex flex-col gap-3">
                    {/* File selector */}
                    <div className="flex flex-col gap-1">
                        <span className="text-[13px] font-medium text-text-main">Arquivo de áudio</span>
                        <div className="flex gap-2">
                            <div
                                className={`
                                    flex-1 h-10 px-3 bg-bg border border-border flex items-center transition-colors cursor-pointer hover:border-accent
                                `}
                                onClick={handleSelectFile}
                            >
                                {fileName ? (
                                    <span className="font-mono text-[12px] text-text-main truncate">{fileName}</span>
                                ) : (
                                    <span className="font-mono text-[12px] text-text-sec/40">Clique para selecionar...</span>
                                )}
                            </div>
                            {audioPath && (
                                <button
                                    onClick={() => setAudioPath(null)}
                                    className="w-10 h-10 border border-border text-text-sec hover:text-[#c42b1c] hover:border-[#c42b1c] transition-all inline-flex items-center justify-center"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Language + model selectors */}
                    <div className="flex gap-3">
                        <div className="flex flex-col gap-1 flex-1">
                            <span className="text-[13px] font-medium text-text-main">Modelo</span>
                            <select
                                value={selectedModel}
                                onChange={e => setSelectedModel(e.target.value)}
                                className="h-10 px-3 bg-bg border border-border text-sm text-text-main font-mono focus:outline-none focus:border-accent transition-colors appearance-none cursor-pointer"
                            >
                                {readyModels.length === 0 && (
                                    <option value="">Nenhum modelo baixado</option>
                                )}
                                {readyModels.map(m => (
                                    <option key={m.id} value={m.id}>{m.name} ({m.sizeLabel})</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex flex-col gap-1 flex-1">
                            <span className="text-[13px] font-medium text-text-main">
                                <Languages size={13} className="inline mr-1 -mt-0.5" />
                                Idioma
                            </span>
                            <select
                                value={language}
                                onChange={e => {
                                    setLanguage(e.target.value)
                                    window.api.whisperSaveSettings({ language: e.target.value })
                                }}
                                className="h-10 px-3 bg-bg border border-border text-sm text-text-main font-mono focus:outline-none focus:border-accent transition-colors appearance-none cursor-pointer"
                            >
                                {WHISPER_LANGUAGES.map(l => (
                                    <option key={l.code} value={l.code}>{l.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 mt-1">
                        {transcribing ? (
                            <>
                                <div className="flex-1 flex items-center gap-2">
                                    <Loader2 size={14} className="animate-spin text-accent shrink-0" />
                                    <div className="flex-1 h-1.5 bg-border overflow-hidden">
                                        <div
                                            className="h-full bg-accent transition-all duration-300"
                                            style={{ width: `${transProgress}%` }}
                                        />
                                    </div>
                                    <span className="font-mono text-[10px] text-text-sec tabular-nums w-8 text-right">
                                        {transProgress}%
                                    </span>
                                </div>
                                <button
                                    onClick={handleCancel}
                                    className="h-10 px-4 border border-border text-text-sec hover:text-[#c42b1c] hover:border-[#c42b1c] transition-all inline-flex items-center gap-1.5"
                                >
                                    <Square size={12} />
                                    <span className="text-[13px] font-medium">Cancelar</span>
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={handleTranscribe}
                                disabled={!audioPath || !selectedModel || !systemOk || readyModels.length === 0}
                                className="h-10 px-5 bg-accent text-surface text-[13px] font-semibold hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all inline-flex items-center gap-2"
                            >
                                <Play size={14} />
                                Transcrever
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="bg-[#c42b1c]/8 border border-[#c42b1c]/20 p-4 mb-3">
                    <div className="flex items-start gap-2">
                        <AlertTriangle size={14} className="text-[#c42b1c] shrink-0 mt-0.5" />
                        <span className="font-mono text-[11px] text-[#c42b1c] leading-relaxed">{error}</span>
                    </div>
                </div>
            )}

            {/* Result */}
            {result && (
                <div className="bg-surface border border-border p-5">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <CheckCircle size={15} strokeWidth={1.8} className="text-success" />
                            <span className="font-mono text-[11px] font-bold text-text-sec uppercase tracking-wider">
                                Resultado
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="font-mono text-[10px] text-text-sec/60">
                                {result.segments.length} segmentos — {result.duration.toFixed(1)}s — {result.language}
                            </span>
                            <button
                                onClick={handleCopy}
                                className="h-7 px-3 border border-border text-text-sec hover:text-text-main hover:border-text-sec transition-all inline-flex items-center gap-1.5"
                            >
                                <Copy size={12} />
                                <span className="text-[10px] font-medium">{copied ? 'Copiado!' : 'Copiar'}</span>
                            </button>
                        </div>
                    </div>

                    <div className="bg-bg border border-border p-4 max-h-[320px] overflow-y-auto">
                        <p className="text-[13px] leading-relaxed text-text-main whitespace-pre-wrap select-text">
                            {result.text}
                        </p>
                    </div>

                    {/* Segments with timestamps */}
                    {result.segments.length > 1 && (
                        <details className="mt-3">
                            <summary className="font-mono text-[10px] text-text-sec/60 cursor-pointer hover:text-text-sec transition-colors">
                                <Info size={11} className="inline mr-1 -mt-0.5" />
                                Ver segmentos com timestamps
                            </summary>
                            <div className="mt-2 flex flex-col gap-1 max-h-[240px] overflow-y-auto">
                                {result.segments.map((seg, i) => (
                                    <div key={i} className="flex gap-3 py-1 border-b border-border/50 last:border-0">
                                        <span className="font-mono text-[10px] text-text-sec/60 tabular-nums shrink-0 w-24">
                                            {fmtTime(seg.start)} → {fmtTime(seg.end)}
                                        </span>
                                        <span className="text-[12px] text-text-main select-text">{seg.text}</span>
                                    </div>
                                ))}
                            </div>
                        </details>
                    )}
                </div>
            )}
        </div>
    )
}

function fmtTime(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    const ms = Math.round((seconds % 1) * 10)
    return `${m}:${s.toString().padStart(2, '0')}.${ms}`
}
