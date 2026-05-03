import { useEffect, useRef } from 'react'

interface Props {
    isRecording: boolean
    stream?: MediaStream | null
    width?: number
    height?: number
    barColor?: string
}

const MIC_CONSTRAINTS: MediaTrackConstraints = {
    autoGainControl: false,
    noiseSuppression: false,
    echoCancellation: false
}

export default function AudioVisualizer({
    isRecording,
    stream: externalStream,
    width = 320,
    height = 80,
    barColor = '#de491b'
}: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const animRef = useRef<number>(0)
    const analyserRef = useRef<AnalyserNode | null>(null)
    const ctxRef = useRef<AudioContext | null>(null)
    const ownStreamRef = useRef<MediaStream | null>(null)

    useEffect(() => {
        if (!isRecording) {
            cancelAnimationFrame(animRef.current)
            clearCanvas()

            if (ownStreamRef.current) {
                ownStreamRef.current.getTracks().forEach((t) => t.stop())
                ownStreamRef.current = null
            }
            if (ctxRef.current) {
                ctxRef.current.close().catch(() => { })
                ctxRef.current = null
            }
            analyserRef.current = null
            return
        }

        let active = true

        const init = async () => {
            try {
                let stream: MediaStream

                if (externalStream) {
                    stream = externalStream
                } else {
                    stream = await navigator.mediaDevices.getUserMedia({
                        audio: MIC_CONSTRAINTS
                    })
                    if (!active) { stream.getTracks().forEach((t) => t.stop()); return }
                    ownStreamRef.current = stream
                }

                const ctx = new AudioContext()
                ctxRef.current = ctx
                const source = ctx.createMediaStreamSource(stream)
                const analyser = ctx.createAnalyser()
                analyser.fftSize = 64
                source.connect(analyser)
                analyserRef.current = analyser

                draw()
            } catch (err) {
                console.error('Mic access denied:', err)
            }
        }

        const draw = () => {
            if (!active) return
            const canvas = canvasRef.current
            const analyser = analyserRef.current
            if (!canvas || !analyser) return

            const c = canvas.getContext('2d')!
            const data = new Uint8Array(analyser.frequencyBinCount)
            analyser.getByteFrequencyData(data)

            c.clearRect(0, 0, canvas.width, canvas.height)

            const bars = data.length
            const gap = 3
            const barW = (canvas.width - gap * (bars - 1)) / bars
            const mid = canvas.height / 2

            for (let i = 0; i < bars; i++) {
                const val = data[i] / 255
                const h = Math.max(2, val * mid * 0.9)
                const x = i * (barW + gap)

                c.fillStyle = barColor
                c.fillRect(x, mid - h, barW, h * 2)
            }

            animRef.current = requestAnimationFrame(draw)
        }

        init()

        return () => {
            active = false
            cancelAnimationFrame(animRef.current)
        }
    }, [isRecording, externalStream, barColor])

    const clearCanvas = () => {
        const canvas = canvasRef.current
        if (!canvas) return
        const c = canvas.getContext('2d')
        c?.clearRect(0, 0, canvas.width, canvas.height)
    }

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="block h-full w-full"
        />
    )
}
