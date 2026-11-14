# Drafter — AI Writing Studio

A **Chrome Extension (Manifest V3)** and optional local **Companion Server** monorepo for drafting emails, replies, and web responses grounded in your **Precedent Library** and **Personal Voice DNA**.

## Architecture

- [`packages/extension`](packages/extension) (`@drafter/extension`):
  - **Chrome Extension (MV3)**: Injects an inline `✦ Draft` trigger pill into email compose windows and `[contenteditable]` / `textarea` fields, provides a quick launcher **Popup** (`popup.html`), active-tab **Side Panel** (`sidepanel.html`), and full **Studio** page (`studio.html`) with Light/Dark themes, **Precedents Library & Similarity Radar** (TXT/MD/DOCX/PDF/EML/HTML/JSON/CSV upload), **Voice & Style** studio, A/B model comparison, V1/V2/V3 versioning & line diffs, History, and Backup JSON export/import.
  - Supports **Demo Sandbox (Offline · No API Key)**, **Drafter Managed Subscription**, **OpenRouter**, **OpenAI**, **Anthropic**, **Google Gemini**, and **Local Ollama** (`127.0.0.1` / `localhost`).
- [`packages/shared`](packages/shared) (`@drafter/shared`):
  - Section-aware precedent chunker and inverted-index similarity ranker (`chunkPrecedentDocument`, `buildPrecedentIndex`, `rankPrecedents`), stylometric voice analyzer (`analyzeWritingSamples`, `selectVoiceSamples`), deterministic prompt compiler (`compileDraftPrompt`), offline demo draft engine (`buildSandboxDraft`), DOCX/HTML/EML extractors, LCS line diffing, and strict loopback URL validation (`isLoopbackHostname`).
- [`packages/server`](packages/server) (`@drafter/server`):
  - Local Companion Server API for Managed Subscriptions: scrypt/HMAC user auth, Stripe-compatible checkout sandbox (`/checkout-sandbox`), HMAC-SHA256 webhook verification (`/api/billing/webhook`), quota-metered OpenRouter or sandbox drafting (`/api/ai/draft`), and cloud vault sync (`/api/vault`).

## Install as Chrome Extension (MV3)

1. Install dependencies and build the extension:

   ```bash
   npm install
   npm run build:extension
   ```

2. Open `chrome://extensions` in Google Chrome.
3. Toggle **Developer mode** ON (top right).
4. Click **Load unpacked** and select `packages/extension/dist` (or run `npm run pack:extension`, unzip `release/drafter-chrome-extension-v1.0.0.zip`, and select the folder containing `manifest.json`).

Or launch a fresh local Chrome profile with the extension preloaded in one step:

```bash
npm run chrome
```

### Optional: Managed Companion Server

If you want to use **Drafter Managed Subscription** or **Cloud Vault Sync** (otherwise Demo Sandbox, BYOK API keys, and Local Ollama work purely inside the Chrome extension):

```bash
npm run dev:server      # Starts companion API at http://127.0.0.1:4318
```

## Verify Everything

```bash
npm run verify          # Builds all packages, runs unit + server tests, and runs Chromium MV3 E2E tests
npm run pack:extension  # Packages release/drafter-chrome-extension-v1.0.0.zip
```

