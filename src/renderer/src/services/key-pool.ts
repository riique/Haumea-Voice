/**
 * Generic API key pool with round-robin rotation, cooldown on 429,
 * and permanent removal on 401/403.
 *
 * Thread-safety is irrelevant here (single-threaded renderer),
 * but the pool is concurrency-safe for overlapping async calls.
 */

export class NoAvailableKeyError extends Error {
    constructor(provider: string) {
        super(`[${provider}] Nenhuma API key disponível — todas em cooldown ou inválidas.`)
        this.name = 'NoAvailableKeyError'
    }
}

interface KeyEntry {
    raw: string
    masked: string
    invalid: boolean
    cooldownUntil: number
}

export interface KeyPoolConfig {
    provider: string
    cooldownMs?: number
}

const DEFAULT_COOLDOWN_MS = 60_000

export class KeyPool {
    private readonly keys: KeyEntry[] = []
    private readonly provider: string
    private readonly cooldownMs: number
    private cursor = 0

    constructor(config: KeyPoolConfig) {
        this.provider = config.provider
        this.cooldownMs = config.cooldownMs ?? DEFAULT_COOLDOWN_MS
    }

    /**
     * Load keys from a comma-separated string.
     * Merges with existing state: new keys are added, removed keys are pruned,
     * existing keys keep their cooldown/invalid state.
     */
    load(raw: string): void {
        const incoming = raw
            .split(',')
            .map(k => k.trim())
            .filter(Boolean)

        if (!incoming.length) {
            this.keys.length = 0
            return
        }

        const prev = new Map(this.keys.map(e => [e.raw, e]))
        this.keys.length = 0

        for (const key of incoming) {
            const existing = prev.get(key)
            if (existing) {
                this.keys.push(existing)
            } else {
                this.keys.push({
                    raw: key,
                    masked: mask(key),
                    invalid: false,
                    cooldownUntil: 0
                })
            }
        }

        if (this.cursor >= this.keys.length) this.cursor = 0
    }

    /** How many keys are currently usable (not invalid, not in cooldown). */
    get available(): number {
        const now = Date.now()
        return this.keys.filter(k => !k.invalid && k.cooldownUntil <= now).length
    }

    get total(): number {
        return this.keys.length
    }

    /**
     * Pick the next usable key via round-robin.
     * Throws NoAvailableKeyError if none qualify.
     */
    next(): string {
        const now = Date.now()
        const len = this.keys.length

        if (!len) throw new NoAvailableKeyError(this.provider)

        for (let i = 0; i < len; i++) {
            const idx = (this.cursor + i) % len
            const entry = this.keys[idx]
            if (!entry.invalid && entry.cooldownUntil <= now) {
                this.cursor = (idx + 1) % len
                return entry.raw
            }
        }

        throw new NoAvailableKeyError(this.provider)
    }

    /**
     * Report an HTTP error for a given key so the pool can react.
     * - 429: cooldown
     * - 401/403: permanent ban
     */
    reportError(key: string, status: number): void {
        const entry = this.keys.find(k => k.raw === key)
        if (!entry) return

        if (status === 429) {
            entry.cooldownUntil = Date.now() + this.cooldownMs
            console.warn(`[${this.provider}] key ${entry.masked} em cooldown por ${this.cooldownMs / 1000}s`)
        } else if (status === 401 || status === 403) {
            entry.invalid = true
            console.error(`[${this.provider}] key ${entry.masked} removida (${status})`)
        }
    }

    /**
     * Extract HTTP status from an error object.
     * Works with @google/genai errors and generic fetch errors.
     */
    static extractStatus(err: unknown): number | null {
        if (!err || typeof err !== 'object') return null

        // @google/genai wraps status in various shapes
        const e = err as Record<string, unknown>

        if (typeof e.status === 'number') return e.status
        if (typeof e.httpStatusCode === 'number') return e.httpStatusCode

        // nested response object
        if (e.response && typeof e.response === 'object') {
            const resp = e.response as Record<string, unknown>
            if (typeof resp.status === 'number') return resp.status
        }

        // parse from message — "429 …" or "RESOURCE_EXHAUSTED"
        const msg = typeof e.message === 'string' ? e.message : ''
        if (/429|RESOURCE_EXHAUSTED/i.test(msg)) return 429
        if (/401|UNAUTHENTICATED/i.test(msg)) return 401
        if (/403|PERMISSION_DENIED/i.test(msg)) return 403

        return null
    }
}

function mask(key: string): string {
    if (key.length <= 6) return '***'
    return key.slice(0, 3) + '...' + key.slice(-4)
}
