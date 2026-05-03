import { useEffect, useState } from 'react'
import { DownloadCloud, Loader2, RefreshCw, ShieldCheck } from 'lucide-react'
import type { UpdateStatus } from '../../../shared/update'

function formatPercent(value?: number): string {
    if (typeof value !== 'number' || Number.isNaN(value)) return '0%'
    return `${Math.round(value)}%`
}

function titleFor(status: UpdateStatus): string {
    if (status.status === 'downloaded') return 'Instalando atualizacao'
    if (status.status === 'error') return 'Atualizacao obrigatoria'
    return 'Atualizacao obrigatoria'
}

export default function UpdateGate() {
    const [status, setStatus] = useState<UpdateStatus | null>(null)

    useEffect(() => {
        window.api.getUpdateStatus().then(setStatus)
        const unsub = window.api.onUpdateStatus(setStatus)
        return unsub
    }, [])

    if (!status?.mandatory) return null

    const isError = status.status === 'error'
    const isDownloaded = status.status === 'downloaded'
    const isDownloading = status.status === 'downloading'

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/95 px-5 backdrop-blur-sm">
            <div className="w-full max-w-[440px] border border-border bg-surface p-5 shadow-[0_18px_60px_rgba(31,33,28,0.16)]">
                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-border bg-bg text-accent">
                        {isDownloaded ? (
                            <ShieldCheck size={18} strokeWidth={1.8} />
                        ) : isError ? (
                            <RefreshCw size={18} strokeWidth={1.8} />
                        ) : (
                            <DownloadCloud size={18} strokeWidth={1.8} />
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <h2 className="font-display text-lg font-bold tracking-tight text-text-main">
                            {titleFor(status)}
                        </h2>
                        <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-text-sec">
                            v{status.currentVersion}
                            {status.latestVersion ? ` -> v${status.latestVersion}` : ''}
                        </p>
                    </div>
                </div>

                <p className="mt-4 text-[13px] leading-relaxed text-text-sec">
                    {status.message || 'Baixando a versao mais recente do Haumea Voice.'}
                </p>

                {(isDownloading || isDownloaded) && (
                    <div className="mt-4 flex items-center gap-3">
                        <div className="h-2 flex-1 overflow-hidden bg-sidebar">
                            <div
                                className="h-full bg-accent transition-all duration-300"
                                style={{ width: isDownloaded ? '100%' : formatPercent(status.percent) }}
                            />
                        </div>
                        <span className="w-10 text-right font-mono text-[10px] text-text-sec tabular-nums">
                            {isDownloaded ? '100%' : formatPercent(status.percent)}
                        </span>
                    </div>
                )}

                <div className="mt-5 flex items-center justify-end gap-2">
                    {isError ? (
                        <button
                            onClick={() => window.api.checkForUpdates()}
                            className="inline-flex h-10 items-center gap-2 bg-accent px-4 text-[13px] font-semibold text-surface transition-all hover:brightness-110"
                        >
                            <RefreshCw size={14} />
                            Tentar novamente
                        </button>
                    ) : isDownloaded ? (
                        <button
                            onClick={() => window.api.installUpdate()}
                            className="inline-flex h-10 items-center gap-2 bg-accent px-4 text-[13px] font-semibold text-surface transition-all hover:brightness-110"
                        >
                            <ShieldCheck size={14} />
                            Instalar agora
                        </button>
                    ) : (
                        <div className="inline-flex h-10 items-center gap-2 px-4 font-mono text-[10px] uppercase tracking-wider text-accent">
                            <Loader2 size={14} className="animate-spin" />
                            Aguarde
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

