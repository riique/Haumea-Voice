interface Props {
    size?: number
    className?: string
}

export default function HaumeaIcon({ size = 24, className = '' }: Props) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
        >
            {/* Left vertical bar of H */}
            <rect x="12" y="10" width="10" height="44" rx="1" fill="currentColor" />
            {/* Right vertical bar of H */}
            <rect x="42" y="10" width="10" height="44" rx="1" fill="currentColor" />
            {/* Waveform crossbar connecting the H */}
            <path
                d="M12 32 L18 32 L21 22 L25 42 L29 18 L33 44 L37 24 L41 38 L44 32 L52 32"
                stroke="currentColor"
                strokeWidth="3.5"
                strokeLinecap="square"
                strokeLinejoin="miter"
                fill="none"
            />
        </svg>
    )
}
