# Haumea Voice

Haumea Voice é um aplicativo desktop para gravação de áudio, transcrição e análise de comunicação. Ele é construído com Electron, React, TypeScript e Electron Vite, com suporte a transcrição por serviços externos e por Whisper local via Python.

## Recursos

- Gravação de áudio pelo microfone com visualização em tempo real.
- Histórico de transcrições com estatísticas de uso.
- Modo widget/overlay para gravações rápidas.
- Configuração de atalho global.
- Seleção de microfone.
- Transcrição com Gemini, Groq ou Whisper local.
- Gerenciamento de modelos Whisper e idioma de transcrição.
- Builds empacotados para Windows, macOS e Linux via Electron Builder.

## Requisitos

- Node.js 20 ou superior.
- npm.
- Python 3.10 ou superior para o Whisper local.
- FFmpeg disponível no `PATH` para conversão de áudio usada pelo Whisper local.

## Instalação

```bash
npm install
```

Para usar o Whisper local, instale também as dependências Python:

```bash
pip install -r python/requirements.txt
```

## Desenvolvimento

```bash
npm run dev
```

## Build

Gerar os arquivos compilados:

```bash
npm run build
```

Gerar instaladores por plataforma:

```bash
npm run build:win
npm run build:mac
npm run build:linux
```

Os artefatos de build são gerados em `dist/` e não são versionados.

## Configuração

As chaves de API e preferências são salvas localmente pelo aplicativo usando `electron-store`. Não coloque chaves de API em arquivos versionados.

Para transcrição local com Whisper:

1. Instale Python e FFmpeg.
2. Instale `python/requirements.txt`.
3. Baixe ou selecione um modelo Whisper pela tela de configurações do aplicativo.

## Estrutura

```text
src/main       Processo principal do Electron e integrações nativas
src/preload    API segura exposta ao renderer
src/renderer   Interface React
src/shared     Tipos e configurações compartilhadas
python         Servidor Python de transcrição com faster-whisper
resources      Recursos do aplicativo
```

## Licença

Este projeto ainda não declara uma licença.
