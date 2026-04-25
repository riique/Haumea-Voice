import { Settings, Minimize2 } from 'lucide-react'

interface Props {
    onOpenSettings: () => void
    onToggleWidget: () => void
}

export default function Header({ onOpenSettings, onToggleWidget }: Props) {
    return (
        <header
            className="h-11 flex items-center justify-between px-5 shrink-0 border-b border-border bg-sidebar"
            style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
            <span className="font-display text-[13px] font-bold tracking-[0.04em] text-text-main uppercase">
                Haumea Voice
            </span>

            <div
                className="flex items-center gap-1 mr-[138px]"
                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
                <button
                    onClick={onToggleWidget}
                    className="p-1.5 rounded-sm text-text-sec hover:text-text-main hover:bg-border/50 transition-colors"
                    title="Modo Widget"
                >
                    <Minimize2 size={15} strokeWidth={2} />
                </button>
                <button
                    onClick={onOpenSettings}
                    className="p-1.5 rounded-sm text-text-sec hover:text-text-main hover:bg-border/50 transition-colors"
                    title="Configurações"
                >
                    <Settings size={15} strokeWidth={2} />
                </button>
            </div>
        </header>
    )
}
