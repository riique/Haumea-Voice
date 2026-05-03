import type { PrepareMicrophoneResult } from '../../../shared/microphone'

export interface MicrophonePreparationResult {
    deviceId: string
    label: string
    system: PrepareMicrophoneResult
}

const PREFERRED_MIC_LABELS = ['Logitech G733', 'G733', 'Logitech']

function isPreferredMic(label: string): boolean {
    const normalized = label.toLowerCase()
    return PREFERRED_MIC_LABELS.some((candidate) => normalized.includes(candidate.toLowerCase()))
}

function usableAudioInputs(devices: MediaDeviceInfo[]): MediaDeviceInfo[] {
    return devices.filter((device) => device.kind === 'audioinput')
}

export async function prepareMicrophoneForTranscription(): Promise<MicrophonePreparationResult> {
    const devices = usableAudioInputs(await navigator.mediaDevices.enumerateDevices())
    const preferredDevice = devices.find((device) => isPreferredMic(device.label))
    const preferredLabels = [
        ...PREFERRED_MIC_LABELS,
        ...devices.map((device) => device.label).filter(Boolean)
    ]

    const system = await window.api.prepareMicrophoneForTranscription({ preferredLabels })

    for (const warning of system.warnings) {
        console.warn('[microphone]', warning)
    }

    return {
        deviceId: preferredDevice?.deviceId ?? '',
        label: preferredDevice?.label ?? system.selectedDescription ?? 'Microfone padrao do sistema',
        system
    }
}
