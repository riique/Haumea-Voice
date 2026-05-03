import { execFile } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import type { PrepareMicrophoneRequest, PrepareMicrophoneResult } from '../shared/microphone'

const COMMAND_TIMEOUT_MS = 5000

function findPython(): string {
    return 'python'
}

function scriptPath(): string {
    const devPath = join(__dirname, '../../python/prepare_microphone.py')
    if (existsSync(devPath)) return devPath

    const prodPath = join(process.resourcesPath, 'python', 'prepare_microphone.py')
    if (existsSync(prodPath)) return prodPath

    throw new Error('Script prepare_microphone.py nao encontrado')
}

function runPrepareScript(request: PrepareMicrophoneRequest): Promise<PrepareMicrophoneResult> {
    return new Promise((resolve) => {
        execFile(
            findPython(),
            [scriptPath(), JSON.stringify(request)],
            {
                timeout: COMMAND_TIMEOUT_MS,
                windowsHide: true,
                env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }
            },
            (error, stdout, stderr) => {
                const warnings: string[] = []

                if (stderr.trim()) {
                    warnings.push(stderr.trim())
                }

                if (error) {
                    warnings.push(`Falha ao preparar microfone no Windows: ${error.message}`)
                    resolve({
                        ok: false,
                        platform: process.platform,
                        warnings
                    })
                    return
                }

                try {
                    const parsed = JSON.parse(stdout.trim()) as PrepareMicrophoneResult
                    resolve({
                        ...parsed,
                        platform: parsed.platform || process.platform,
                        warnings: [...(parsed.warnings ?? []), ...warnings]
                    })
                } catch (parseErr) {
                    warnings.push(
                        `Resposta invalida do prepare_microphone.py: ${
                            parseErr instanceof Error ? parseErr.message : String(parseErr)
                        }`
                    )
                    resolve({
                        ok: false,
                        platform: process.platform,
                        warnings
                    })
                }
            }
        )
    })
}

export async function prepareSystemMicrophone(
    request: PrepareMicrophoneRequest
): Promise<PrepareMicrophoneResult> {
    if (process.platform !== 'win32') {
        return {
            ok: true,
            platform: process.platform,
            warnings: [
                `Preparacao automatica de microfone via pycaw e suportada apenas no Windows; plataforma atual: ${process.platform}.`
            ]
        }
    }

    try {
        return await runPrepareScript(request)
    } catch (error) {
        return {
            ok: false,
            platform: process.platform,
            warnings: [
                `Falha inesperada ao preparar microfone no Windows: ${
                    error instanceof Error ? error.message : String(error)
                }`
            ]
        }
    }
}
