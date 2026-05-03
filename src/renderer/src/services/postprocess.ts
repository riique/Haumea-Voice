const FINAL_CREDIT_PATTERN = new RegExp(
    String.raw`(^|[\r\n]+|[.!?;:]\s+)(?:[-*]\s*)?(?:legendad[oa]\s+por|legendas?\s+por|transcrit[oa]\s+por|transcri[cç][aã]o\s+por|subtitles\s+by|captioned\s+by|translated\s+by)(?:\s*:?\s*[\p{L}\p{N}@#][^\r\n.!?]{0,100}?)?[\s.!?…]*$`,
    'iu'
)

export function cleanTranscriptionArtifacts(text: string): string {
    let current = text.trimEnd()

    for (let i = 0; i < 4; i++) {
        const next = current.replace(FINAL_CREDIT_PATTERN, (_match, prefix: string) =>
            prefix ? prefix.trimEnd() : ''
        ).trimEnd()

        if (next === current) return current
        current = next
    }

    return current
}

export function postProcessTranscription(text: string): string {
    return cleanTranscriptionArtifacts(text)
}
