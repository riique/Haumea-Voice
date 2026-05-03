import { useState, useEffect } from 'react'
import { LayoutDashboard, Clock, Keyboard, Settings, FileAudio, BookOpenText } from 'lucide-react'
import HaumeaIcon from './HaumeaIcon'

export type Route = 'overview' | 'transcription' | 'history' | 'dictionary' | 'shortcuts' | 'settings'

interface Props {
    active: Route
    onChange: (route: Route) => void
}

const nav: { id: Route; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'overview', label: 'In\u00edcio', icon: LayoutDashboard },
    { id: 'transcription', label: 'Transcri\u00e7\u00e3o', icon: FileAudio },
    { id: 'history', label: 'Hist\u00f3rico', icon: Clock },
    { id: 'dictionary', label: 'Dicion\u00e1rio', icon: BookOpenText },
    { id: 'shortcuts', label: 'Atalhos', icon: Keyboard },
    { id: 'settings', label: 'Configura\u00e7\u00f5es', icon: Settings }
]

export default function Sidebar({ active, onChange }: Props) {
    const [compact, setCompact] = useState(false)

    useEffect(() => {
        window.api.getSidebarCompact().then(setCompact)
        const unsub = window.api.onSidebarCompactChanged(setCompact)
        return unsub
    }, [])

    return (
        <aside
            className={`${compact ? 'w-[60px]' : 'w-[200px]'} shrink-0 h-full flex flex-col bg-sidebar border-r border-border transition-all duration-200`}
            style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
            <div className={`h-14 flex items-center ${compact ? 'justify-center' : 'px-5'}`}>
                {compact ? (
                    <HaumeaIcon size={26} className="text-accent" />
                ) : (
                    <div className="flex items-center gap-2">
                        <HaumeaIcon size={22} className="text-accent" />
                        <span className="font-display text-[13px] font-bold tracking-[0.04em] text-text-main uppercase">
                            Haumea Voice
                        </span>
                    </div>
                )}
            </div>

            <nav
                className={`flex-1 flex flex-col gap-0.5 ${compact ? 'px-1.5' : 'px-2.5'} pt-1`}
                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
                {nav.map(({ id, label, icon: Icon }) => {
                    const isActive = active === id
                    return (
                        <button
                            key={id}
                            onClick={() => onChange(id)}
                            title={compact ? label : undefined}
                            className={`
                                group flex items-center ${compact ? 'justify-center' : ''} gap-2.5 h-9 ${compact ? 'px-0' : 'px-3'} text-[13px] font-medium tracking-tight transition-all
                                ${isActive
                                    ? 'bg-surface text-accent border border-border'
                                    : 'text-text-sec hover:text-text-main hover:bg-surface/50 border border-transparent'
                                }
                            `}
                        >
                            <Icon
                                size={15}
                                strokeWidth={isActive ? 2.2 : 1.8}
                                className={isActive ? 'text-accent' : 'text-text-sec group-hover:text-text-main'}
                            />
                            {!compact && label}
                        </button>
                    )
                })}
            </nav>

            {!compact && (
                <div className="px-5 pb-4">
                    <span className="font-mono text-[9px] text-text-sec/50 tracking-wider uppercase">
                        v1.0.1 - local
                    </span>
                </div>
            )}
        </aside>
    )
}
