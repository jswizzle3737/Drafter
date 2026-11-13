# Drafter — AI Writing Studio

A Chrome Extension (Manifest V3) + local/managed Companion Server monorepo for drafting emails, replies, and web responses grounded in your **Precedent Library** and **Personal Voice DNA**.

## Architecture

- [`packages/shared`](packages/shared) (`@drafter/shared`):
  - **Precedent Engine**: Section-aware document chunker and inverted-index similarity ranker (`chunkPrecedentDocument`, `buildPrecedentIndex`, `rankPrecedents`) with pin/exclude overrides.
  - **Voice & Style Engine**: Stylometric analyzer (`analyzeWritingSamples`, `selectVoiceSamples`) measuring sentence length, contraction rate, question rate, openings, and closings.
  - **Prompt Compiler & Diffing**: Deterministic prompt compiler (`compileDraftPrompt`), subject/body splitter (`splitSubjectAndBody`), and LCS line diffing (`computeLineDiff`).
  - **Document Parsing & Security**: Pure-TypeScript DOCX ZIP/XML parser (`extractTextFromDocxBytes`), HTML/EML extractors, and strict loopback URL validation (`isLoopbackHostname`).
- [`packages/server`](packages/server) (`@drafter/server`):
  - Companion Server handling scrypt/HMAC user auth, Stripe-compatible checkout & sandbox simulator (`/checkout-sandbox`), HMAC-SHA256 webhook verification (`/api/billing/webhook`), managed AI generation with OpenRouter passthrough or sandbox fallback (`/api/ai/draft`), and cloud vault sync (`/api/vault`).
- [`packages/extension`](packages/extension) (`@drafter/extension`):
  - MV3 Chrome Extension with inline webmail `✦ Draft` trigger, quick launcher Popup, Side Panel, and Full Studio (Light/Dark themes, Precedents Library & Similarity Radar, Voice & Style studio, A/B model comparison, V1/V2/V3 versioning & diffs, History, and Backup JSON export/import).
  - Supports **Drafter Managed Subscription**, **OpenRouter**, **OpenAI**, **Anthropic**, **Google Gemini**, and **Local Ollama** (`127.0.0.1` / `localhost`).

## Quick Start

```bash
npm install
npm run verify          # Builds all packages, runs unit + server tests + Chromium E2E
npm run pack:extension  # Packages release/drafter-chrome-extension-v1.0.0.zip
```

To run the Companion Server locally:

```bash
npm run dev:server
```

Load the unpacked extension in Chrome from `packages/extension/dist` via `chrome://extensions` (Developer Mode → Load unpacked).
