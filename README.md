# Haumea Voice

Transforme fala em texto sem interromper o que você está fazendo — com atalho global, widget flutuante e escolha entre transcrição na nuvem ou local.

Haumea Voice é um aplicativo desktop para gravação, transcrição e análise de comunicação. Ele combina uma interface Electron com três motores de transcrição: Gemini, Groq Whisper e Faster Whisper local.

## Principais recursos

- Grave pelo microfone selecionado com visualização do nível de áudio.
- Inicie e cancele gravações por atalhos globais configuráveis.
- Use um widget compacto ou um overlay sempre visível.
- Cole automaticamente a transcrição na janela que estava ativa.
- Escolha Gemini, Groq ou Whisper local, com fallback entre motores quando configurados.
- Organize um dicionário pessoal para corrigir nomes e termos recorrentes.
- Consulte, edite, copie e remova itens do histórico, incluindo o áudio salvo.
- Configure idioma, modelo e diretório dos modelos locais do Whisper.
- Baixe ou exclua modelos Whisper pela interface.
- Ajuste prompts e prioridade de modelos para Gemini e Groq.
- Receba atualizações do aplicativo por GitHub Releases.
- Inicie o aplicativo com o sistema quando desejar.

## Escolha do motor

| Motor | Quando usar | Requisitos |
| --- | --- | --- |
| Gemini | Transcrição e análise multimodal em nuvem | Chave da API Google Gemini e internet |
| Groq Whisper | Transcrição rápida em nuvem | Uma ou mais chaves Groq e internet |
| Whisper local | Processamento offline e maior controle sobre o áudio | Python, `faster-whisper`, FFmpeg e um modelo baixado |

As chaves e preferências são armazenadas localmente pelo `electron-store`. Elas ainda são credenciais sensíveis: proteja sua conta do sistema e nunca as versione.

## Tecnologias

- Electron 40 e Electron Vite
- React 19, TypeScript, Tailwind CSS e Framer Motion
- Gemini por `@google/genai`
- Groq pela API de transcrição compatível
- Python e Faster Whisper para execução local
- Electron Builder e Electron Updater

## Requisitos

- Node.js 20 ou superior
- npm
- Python 3.10 ou superior para Whisper local
- FFmpeg disponível no `PATH` para Whisper local
- Microfone liberado nas permissões do sistema

No Windows, o aplicativo também possui uma rotina opcional de preparação do microfone baseada em `pycaw`.

## Instalação

```bash
git clone https://github.com/riique/HaumeaVoice-electron.git
cd HaumeaVoice-electron
npm install
```

Para habilitar o Whisper local:

```bash
python -m pip install -r python/requirements.txt
```

Confirme também:

```bash
python --version
ffmpeg -version
```

## Desenvolvimento

```bash
npm run dev
```

O Electron abre a janela do aplicativo e recarrega o renderer durante o desenvolvimento.

## Uso

1. Abra **Configurações** e escolha o microfone.
2. Selecione Gemini, Groq ou Whisper local.
3. Informe as credenciais exigidas pelo motor em nuvem ou baixe um modelo local.
4. Configure os atalhos de iniciar e cancelar.
5. Grave pelo painel principal, widget ou atalho global.
6. Revise a transcrição no histórico ou envie o texto para a janela ativa.

O fallback tenta outros motores disponíveis quando o preferido falha ou devolve texto vazio. Para que ele funcione, cada alternativa precisa estar corretamente configurada.

## Build

Compile o aplicativo:

```bash
npm run build
```

Gere o instalador da plataforma desejada:

```bash
npm run build:win
npm run build:mac
npm run build:linux
```

Os artefatos são gerados em `dist/`. O projeto configura NSIS no Windows, AppImage e DEB no Linux e pacote para macOS. Assinatura e notarização precisam ser configuradas separadamente para distribuição confiável.

## Atualizações

O atualizador consulta as releases de `riique/HaumeaVoice-electron`. Para publicar uma atualização:

1. ajuste a versão em `package.json`;
2. gere e teste os artefatos;
3. publique uma GitHub Release com os arquivos esperados pelo Electron Updater.

O código suporta uma tela de bloqueio para atualizações obrigatórias, mas o comportamento final depende dos metadados e artefatos publicados.

## Estrutura

```text
src/main/       processo Electron, janelas, atalhos, armazenamento e atualizador
src/preload/    ponte IPC exposta ao renderer
src/renderer/   interface React e serviços de transcrição
src/shared/     contratos compartilhados
python/         worker Faster Whisper e preparação de microfone
build/          recursos usados no empacotamento
resources/      recursos incluídos no aplicativo
```

## Privacidade e limitações

- Gemini e Groq enviam o áudio aos respectivos serviços; consulte os termos e políticas desses provedores.
- O Whisper local evita o envio do áudio a esses serviços, mas exige armazenamento para modelos e capacidade de CPU/GPU.
- O histórico e as chaves ficam no perfil local do aplicativo, não em um cofre dedicado.
- Colagem automática e atalhos globais dependem das permissões e restrições do sistema operacional.
- Builds para macOS não estão notarizadas pela configuração atual.

## Contribuição

Abra uma issue com sistema operacional, versão do aplicativo, motor selecionado e mensagem de erro. Pull requests devem manter a separação entre processo principal, preload e renderer e não devem incluir chaves, áudios pessoais ou modelos binários.

## Licença

Distribuído sob a licença MIT. Consulte [LICENSE](LICENSE).
