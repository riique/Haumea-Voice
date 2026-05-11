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

function uniqueLabels(labels: string[]): string[] {
    const seen = new Set<string>()
    const unique: string[] = []

    for (const label of labels) {
        const normalized = label.trim()
        const key = normalized.toLowerCase()
        if (!normalized || seen.has(key)) continue
        seen.add(key)
        unique.push(normalized)
    }

    return unique
}

export async function prepareMicrophoneForTranscription(
    selectedDeviceId = ''
): Promise<MicrophonePreparationResult> {
    const devices = usableAudioInputs(await navigator.mediaDevices.enumerateDevices())
    const selectedDevice = selectedDeviceId
        ? devices.find((device) => device.deviceId === selectedDeviceId)
        : undefined
    const preferredDevice = selectedDevice ?? devices.find((device) => isPreferredMic(device.label))
    const preferredLabels = [
        preferredDevice?.label ?? '',
        ...PREFERRED_MIC_LABELS,
        ...devices.map((device) => device.label).filter(Boolean)
    ]

    const system = await window.api.prepareMicrophoneForTranscription({
        preferredLabels: uniqueLabels(preferredLabels),
        targetLabel: preferredDevice?.label
    })

    for (const warning of system.warnings) {
        console.warn('[microphone]', warning)
    }

    return {
        deviceId: preferredDevice?.deviceId ?? '',
        label: preferredDevice?.label ?? system.selectedDescription ?? 'Microfone padrao do sistema',
        system
    }
}
