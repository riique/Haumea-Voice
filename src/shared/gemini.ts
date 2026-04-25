export interface GeminiSettings {
    transcriptionPrompt: string
    feedbackPrompt: string
    modelPriority: string[]
}

export const DEFAULT_GEMINI_MODEL_PRIORITY = [
    'gemini-3.1-flash-lite-preview',
    'gemini-2.5-flash',
    'gemini-3.0-flash',
    'gemini-2.5-flash-lite'
]

const LEGACY_TRANSCRIPTION_PROMPT = `Transcreva o audio a seguir.

Regras:
1. Saida = APENAS o texto transcrito, sem introducoes, comentarios ou metadados.
2. Se o audio estiver vazio, inaudivel ou contiver apenas ruido, responda exatamente: [silencio]
3. Idioma: o mesmo falado no audio.
4. Limpeza: remova hesitacoes (uhm, e..., ne, tipo), repeticoes involuntarias e falsos inicios.
5. Manter: o significado, a intencao e o registro (formal/informal) do falante.
6. Pontuacao: adicione pontuacao natural, incluindo virgulas, pontos e interrogacoes/exclamacoes quando fizer sentido.
7. Paragrafos: quebre em paragrafos quando houver mudanca clara de assunto.
8. Numeros: transcreva por extenso se falados informalmente ("uns duzentos"), em algarismos se precisos ("R$ 5.000", "15h30").
9. Multiplos falantes: rotule apenas se houver 2+ vozes distintas ([Falante 1]: ...).
10. Grafias especiais: Se ouvir palavras soando como "Haumeia", "Halmeia" ou "Haumeia", escreva SEMPRE "Haumea".`

const LEGACY_FEEDBACK_PROMPT = `Analise o audio como um avaliador internacional de proficiencia oral e comunicacao.

Responda em portugues do Brasil, em Markdown, sem introducoes fora da estrutura pedida.

Objetivo da avaliacao:
- medir inteligibilidade, pronuncia, fluencia, ritmo, entonacao, gramatica oral, vocabulario, coesao, naturalidade, seguranca e adequacao ao contexto;
- dar uma nota geral;
- classificar o desempenho na escala internacional CEFR (A1, A2, B1, B2, C1, C2);
- indicar o quao proximo o desempenho esta de uma fala nativa, sem exagerar a conclusao.

Escalas obrigatorias:
- Nota geral: 0 a 10, com 1 casa decimal.
- CEFR estimado: A1, A2, B1, B2, C1 ou C2.
- Referencia internacional de fala: Basico em desenvolvimento, Intermediario funcional, Fluente profissional, Quase nativo ou Nativo.
- Proximidade de fala nativa: 0 a 100.
- Confianca da avaliacao: baixa, media ou alta.

Regras:
1. Priorize o audio como fonte principal.
2. Use a transcricao apenas como apoio, porque ela pode ter sido limpa automaticamente.
3. Se o audio estiver curto demais, ruim, com ruido forte, silencio ou material insuficiente, diga isso explicitamente e reduza a confianca.
4. Nao invente palavras, contexto, sotaque, nacionalidade ou nivel que o audio nao sustente.
5. A avaliacao deve equilibrar pontos fortes e pontos fracos.
6. Diferencie com rigor:
   - fluencia funcional;
   - fluencia avancada;
   - quase nativo;
   - nativo.
7. So use "Nativo" se houver evidencia muito forte e consistente. Na duvida, use uma classificacao abaixo.
8. Se o audio estiver em outro idioma, avalie no idioma falado, mas mantenha a resposta em portugues.
9. Quando citar evidencias, prefira trechos curtos ou parafrases claramente reconheciveis do proprio audio.
10. Seja especifico, direto, tecnico e construtivo.

Estrutura obrigatoria da resposta:
## Resumo Executivo
Escreva de 2 a 4 frases com o diagnostico principal.

## Placar
- Nota geral: X/10
- CEFR estimado: ...
- Referencia internacional de fala: ...
- Proximidade de fala nativa: X/100
- Confianca da avaliacao: ...

## Forcas
Liste de 3 a 5 pontos fortes objetivos.

## Pontos de Atencao
Liste de 3 a 5 pontos que mais limitam a performance.

## Pronuncia e Inteligibilidade
Avalie articulacao, sons, sotaque, compreensao e inteligibilidade geral.

## Fluencia e Ritmo
Avalie pausas, velocidade, hesitacoes, continuidade e naturalidade do fluxo.

## Gramatica Oral e Estrutura
Avalie construcao de frases, concordancia, precisao e organizacao das ideias ao falar.

## Vocabulario e Adequacao
Avalie variedade lexical, precisao vocabular, repeticoes e adequacao ao contexto.

## Naturalidade e Registro
Avalie seguranca, espontaneidade, entonacao, registro e o quanto a fala soa natural.

## Evidencias do Audio
Liste de 3 a 5 evidencias curtas do audio que sustentam a avaliacao.

## Plano de Melhoria
- Traga 5 acoes praticas e priorizadas.
- Traga 3 exercicios especificos para subir um nivel.

## Veredito Final
Feche com 1 paragrafo explicando por que essa foi a nota geral, qual o nivel internacional mais provavel e o que falta para chegar ao proximo patamar.`

export const DEFAULT_TRANSCRIPTION_PROMPT = `Transcreva o \u00e1udio a seguir.

Regras:
1. Sa\u00edda = APENAS o texto transcrito, sem introdu\u00e7\u00f5es, coment\u00e1rios ou metadados.
2. Se o \u00e1udio estiver vazio, inaud\u00edvel ou contiver apenas ru\u00eddo, responda exatamente: [silencio]
3. Idioma: transcreva SEMPRE no idioma original falado no \u00e1udio.
4. N\u00e3o traduza, n\u00e3o localize, n\u00e3o reescreva e n\u00e3o responda em portugu\u00eas por padr\u00e3o. Se o \u00e1udio estiver em ingl\u00eas, a sa\u00edda deve ficar em ingl\u00eas; se estiver em espanhol, a sa\u00edda deve ficar em espanhol; se estiver em portugu\u00eas, a sa\u00edda deve ficar em portugu\u00eas.
5. Se houver mistura de idiomas, preserve cada trecho no idioma em que foi falado.
6. Limpeza: remova hesita\u00e7\u00f5es (uhm, e..., n\u00e9, tipo), repeti\u00e7\u00f5es involunt\u00e1rias e falsos in\u00edcios.
7. Manter: o significado, a inten\u00e7\u00e3o e o registro (formal/informal) do falante.
8. Pontua\u00e7\u00e3o: adicione pontua\u00e7\u00e3o natural, incluindo v\u00edrgulas, pontos e interroga\u00e7\u00f5es/exclama\u00e7\u00f5es quando fizer sentido.
9. Par\u00e1grafos: quebre em par\u00e1grafos quando houver mudan\u00e7a clara de assunto.
10. N\u00fameros: transcreva por extenso se falados informalmente ("uns duzentos"), em algarismos se precisos ("R$ 5.000", "15h30").
11. M\u00faltiplos falantes: rotule apenas se houver 2+ vozes distintas ([Falante 1]: ...).
12. Grafias especiais: se ouvir palavras soando como "Haumeia", "Halmeia" ou "Haumeia", escreva SEMPRE "Haumea".`

export const DEFAULT_FEEDBACK_PROMPT = `Analise o \u00e1udio como um avaliador internacional de profici\u00eancia oral e comunica\u00e7\u00e3o.

Responda em portugu\u00eas do Brasil, em Markdown, sem introdu\u00e7\u00f5es fora da estrutura pedida.

Objetivo da avalia\u00e7\u00e3o:
- medir inteligibilidade, pron\u00fancia, flu\u00eancia, ritmo, entona\u00e7\u00e3o, gram\u00e1tica oral, vocabul\u00e1rio, coes\u00e3o, naturalidade, seguran\u00e7a e adequa\u00e7\u00e3o ao contexto;
- dar uma nota geral;
- classificar o desempenho na escala internacional CEFR (A1, A2, B1, B2, C1, C2);
- indicar o qu\u00e3o pr\u00f3ximo o desempenho est\u00e1 de uma fala nativa, sem exagerar a conclus\u00e3o.

Escalas obrigat\u00f3rias:
- Nota geral: 0 a 10, com 1 casa decimal.
- CEFR estimado: A1, A2, B1, B2, C1 ou C2.
- Refer\u00eancia internacional de fala: B\u00e1sico em desenvolvimento, Intermedi\u00e1rio funcional, Fluente profissional, Quase nativo ou Nativo.
- Proximidade de fala nativa: 0 a 100.
- Confian\u00e7a da avalia\u00e7\u00e3o: baixa, m\u00e9dia ou alta.

Regras:
1. Priorize o \u00e1udio como fonte principal.
2. Use a transcri\u00e7\u00e3o apenas como apoio, porque ela pode ter sido limpa automaticamente.
3. Se o \u00e1udio estiver curto demais, ruim, com ru\u00eddo forte, sil\u00eancio ou material insuficiente, diga isso explicitamente e reduza a confian\u00e7a.
4. N\u00e3o invente palavras, contexto, sotaque, nacionalidade ou n\u00edvel que o \u00e1udio n\u00e3o sustente.
5. A avalia\u00e7\u00e3o deve equilibrar pontos fortes e pontos fracos.
6. Diferencie com rigor:
   - flu\u00eancia funcional;
   - flu\u00eancia avan\u00e7ada;
   - quase nativo;
   - nativo.
7. S\u00f3 use "Nativo" se houver evid\u00eancia muito forte e consistente. Na d\u00favida, use uma classifica\u00e7\u00e3o abaixo.
8. Se o \u00e1udio estiver em outro idioma, avalie no idioma falado, mas mantenha a resposta em portugu\u00eas.
9. Quando citar evid\u00eancias, prefira trechos curtos ou par\u00e1frases claramente reconhec\u00edveis do pr\u00f3prio \u00e1udio.
10. Seja espec\u00edfico, direto, t\u00e9cnico e construtivo.

Estrutura obrigat\u00f3ria da resposta:
## Resumo Executivo
Escreva de 2 a 4 frases com o diagn\u00f3stico principal.

## Placar
- Nota geral: X/10
- CEFR estimado: ...
- Refer\u00eancia internacional de fala: ...
- Proximidade de fala nativa: X/100
- Confian\u00e7a da avalia\u00e7\u00e3o: ...

## For\u00e7as
Liste de 3 a 5 pontos fortes objetivos.

## Pontos de Aten\u00e7\u00e3o
Liste de 3 a 5 pontos que mais limitam a performance.

## Pron\u00fancia e Inteligibilidade
Avalie articula\u00e7\u00e3o, sons, sotaque, compreens\u00e3o e inteligibilidade geral.

## Flu\u00eancia e Ritmo
Avalie pausas, velocidade, hesita\u00e7\u00f5es, continuidade e naturalidade do fluxo.

## Gram\u00e1tica Oral e Estrutura
Avalie constru\u00e7\u00e3o de frases, concord\u00e2ncia, precis\u00e3o e organiza\u00e7\u00e3o das ideias ao falar.

## Vocabul\u00e1rio e Adequa\u00e7\u00e3o
Avalie variedade lexical, precis\u00e3o vocabular, repeti\u00e7\u00f5es e adequa\u00e7\u00e3o ao contexto.

## Naturalidade e Registro
Avalie seguran\u00e7a, espontaneidade, entona\u00e7\u00e3o, registro e o quanto a fala soa natural.

## Evid\u00eancias do \u00c1udio
Liste de 3 a 5 evid\u00eancias curtas do \u00e1udio que sustentam a avalia\u00e7\u00e3o.

## Plano de Melhoria
- Traga 5 a\u00e7\u00f5es pr\u00e1ticas e priorizadas.
- Traga 3 exerc\u00edcios espec\u00edficos para subir um n\u00edvel.

## Veredito Final
Feche com 1 par\u00e1grafo explicando por que essa foi a nota geral, qual o n\u00edvel internacional mais prov\u00e1vel e o que falta para chegar ao pr\u00f3ximo patamar.`

export const DEFAULT_GEMINI_SETTINGS: GeminiSettings = {
    transcriptionPrompt: DEFAULT_TRANSCRIPTION_PROMPT,
    feedbackPrompt: DEFAULT_FEEDBACK_PROMPT,
    modelPriority: [...DEFAULT_GEMINI_MODEL_PRIORITY]
}

export function cloneGeminiSettings(settings: GeminiSettings): GeminiSettings {
    return {
        transcriptionPrompt: settings.transcriptionPrompt,
        feedbackPrompt: settings.feedbackPrompt,
        modelPriority: [...settings.modelPriority]
    }
}

export function normalizeGeminiSettings(
    settings?: Partial<GeminiSettings> | null
): GeminiSettings {
    const seen = new Set<string>()
    const transcriptionPrompt = settings?.transcriptionPrompt?.trim()
    const normalizedTranscriptionPrompt =
        !transcriptionPrompt || transcriptionPrompt === LEGACY_TRANSCRIPTION_PROMPT
            ? DEFAULT_TRANSCRIPTION_PROMPT
            : transcriptionPrompt

    const feedbackPrompt = settings?.feedbackPrompt?.trim()
    const normalizedFeedbackPrompt =
        !feedbackPrompt || feedbackPrompt === LEGACY_FEEDBACK_PROMPT
            ? DEFAULT_FEEDBACK_PROMPT
            : feedbackPrompt

    const cleanedModels = (settings?.modelPriority ?? [])
        .map((model) => model.trim())
        .filter((model) => {
            if (!model) return false
            const normalized = model.toLowerCase()
            if (seen.has(normalized)) return false
            seen.add(normalized)
            return true
        })

    return {
        transcriptionPrompt: normalizedTranscriptionPrompt,
        feedbackPrompt: normalizedFeedbackPrompt,
        modelPriority: cleanedModels.length > 0 ? cleanedModels : [...DEFAULT_GEMINI_MODEL_PRIORITY]
    }
}

export function buildFeedbackPrompt(feedbackPrompt: string, transcript?: string): string {
    const basePrompt = feedbackPrompt.trim()
    const transcriptText = transcript?.trim()

    if (!transcriptText) {
        return basePrompt
    }

    return `${basePrompt}

Transcri\u00e7\u00e3o de apoio (pode conter limpeza autom\u00e1tica; use o \u00e1udio como fonte principal):
<transcricao>
${transcriptText}
</transcricao>`
}
