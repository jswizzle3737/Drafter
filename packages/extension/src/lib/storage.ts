import {
  DEFAULT_PRECEDENTS,
  DEFAULT_PREFERENCES,
  DEFAULT_VOICE_PROFILE,
  DEFAULT_WRITING_SAMPLES,
  extractTextFromDocxBytes,
  extractTextFromEml,
  extractTextFromHtml,
  type ApiKeysConfig,
  type DraftSession,
  type ExtensionPreferences,
  type ManagedUser,
  type PageContext,
  type PrecedentDocument,
  type ProviderId,
  type ThemeMode,
  type VoiceProfile,
  type WritingSample,
} from '@drafter/shared';
import * as pdfjsLib from 'pdfjs-dist';

if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      typeof chrome !== 'undefined' && chrome.runtime?.getURL
        ? chrome.runtime.getURL('pdf.worker.min.mjs')
        : './pdf.worker.min.mjs';
  } catch {
    // Ignore in non-DOM test contexts
  }
}

export interface DrafterAppState {
  theme: ThemeMode;
  precedents: PrecedentDocument[];
  writingSamples: WritingSample[];
  voiceProfile: VoiceProfile;
  provider: ProviderId;
  model: string;
  compareModel: string;
  apiKeys: ApiKeysConfig;
  companionUrl: string;
  companionToken: string;
  companionUser: ManagedUser | null;
  preferences: ExtensionPreferences;
  sessions: DraftSession[];
  activeSessionId: string;
  capturedContext: PageContext;
  pendingQuickInstruction: string;
}

const STORAGE_KEYS = {
  STATE: 'drafter.appState.v1',
  CAPTURED_CONTEXT: 'drafter.capturedContext',
  PREFERENCES: 'drafter.preferences',
  QUICK_INSTRUCTION: 'drafter.quickInstruction',
} as const;

export function createEmptyContext(): PageContext {
  return {
    kind: 'webpage',
    title: '',
    subject: '',
    recipient: '',
    threadText: '',
    url: '',
    hostname: '',
    capturedAt: new Date().toISOString(),
  };
}

export function isExtensionRuntime(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    Boolean(chrome.runtime?.id) &&
    Boolean(chrome.runtime?.sendMessage)
  );
}

export function createInitialState(): DrafterAppState {
  return {
    theme: 'light',
    precedents: DEFAULT_PRECEDENTS,
    writingSamples: DEFAULT_WRITING_SAMPLES,
    voiceProfile: DEFAULT_VOICE_PROFILE,
    provider: 'openrouter',
    model: 'anthropic/claude-sonnet-4.5',
    compareModel: 'openai/gpt-4.1',
    apiKeys: {
      openrouter: '',
      openai: '',
      anthropic: '',
      gemini: '',
      ollamaUrl: 'http://127.0.0.1:11434',
      ollamaModel: 'llama3.1:8b',
    },
    companionUrl: 'http://127.0.0.1:4318',
    companionToken: '',
    companionUser: null,
    preferences: DEFAULT_PREFERENCES,
    sessions: [],
    activeSessionId: '',
    capturedContext: createEmptyContext(),
    pendingQuickInstruction: '',
  };
}

function hasChromeStorage(): boolean {
  return (
    isExtensionRuntime() &&
    Boolean(chrome.storage?.local?.get) &&
    Boolean(chrome.storage?.local?.set)
  );
}

export async function loadAppState(): Promise<DrafterAppState> {
  const defaults = createInitialState();
  if (hasChromeStorage()) {
    const raw = await chrome.storage.local.get([
      STORAGE_KEYS.STATE,
      STORAGE_KEYS.CAPTURED_CONTEXT,
      STORAGE_KEYS.PREFERENCES,
      STORAGE_KEYS.QUICK_INSTRUCTION,
    ]);
    const saved = (raw[STORAGE_KEYS.STATE] ?? {}) as Partial<DrafterAppState>;
    const merged: DrafterAppState = {
      ...defaults,
      ...saved,
      apiKeys: { ...defaults.apiKeys, ...(saved.apiKeys ?? {}) },
      voiceProfile: {
        ...defaults.voiceProfile,
        ...(saved.voiceProfile ?? {}),
        dimensions: {
          ...defaults.voiceProfile.dimensions,
          ...(saved.voiceProfile?.dimensions ?? {}),
        },
      },
      preferences: {
        ...defaults.preferences,
        ...(saved.preferences ?? {}),
        ...((raw[STORAGE_KEYS.PREFERENCES] as Partial<ExtensionPreferences>) ??
          {}),
      },
      capturedContext:
        (raw[STORAGE_KEYS.CAPTURED_CONTEXT] as PageContext | undefined) ??
        saved.capturedContext ??
        defaults.capturedContext,
      pendingQuickInstruction:
        (raw[STORAGE_KEYS.QUICK_INSTRUCTION] as string | undefined) ??
        saved.pendingQuickInstruction ??
        '',
    };
    return merged;
  }

  try {
    const json = window.localStorage.getItem(STORAGE_KEYS.STATE);
    if (!json) return defaults;
    const saved = JSON.parse(json) as Partial<DrafterAppState>;
    return {
      ...defaults,
      ...saved,
      apiKeys: { ...defaults.apiKeys, ...(saved.apiKeys ?? {}) },
      preferences: { ...defaults.preferences, ...(saved.preferences ?? {}) },
      capturedContext: saved.capturedContext
        ? { ...defaults.capturedContext, ...saved.capturedContext }
        : defaults.capturedContext,
      voiceProfile: {
        ...defaults.voiceProfile,
        ...(saved.voiceProfile ?? {}),
        dimensions: {
          ...defaults.voiceProfile.dimensions,
          ...(saved.voiceProfile?.dimensions ?? {}),
        },
      },
    };
  } catch {
    return defaults;
  }
}

export async function saveAppState(state: DrafterAppState): Promise<void> {
  if (hasChromeStorage()) {
    await chrome.storage.local.set({
      [STORAGE_KEYS.STATE]: state,
      [STORAGE_KEYS.CAPTURED_CONTEXT]: state.capturedContext,
      [STORAGE_KEYS.PREFERENCES]: state.preferences,
      [STORAGE_KEYS.QUICK_INSTRUCTION]: state.pendingQuickInstruction,
    });
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEYS.STATE, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors in restricted frames
  }
}

export async function setQuickInstruction(instruction: string): Promise<void> {
  if (hasChromeStorage()) {
    await chrome.storage.local.set({
      [STORAGE_KEYS.QUICK_INSTRUCTION]: instruction,
    });
    return;
  }
  const state = await loadAppState();
  state.pendingQuickInstruction = instruction;
  await saveAppState(state);
}

export async function captureActiveTabContext(): Promise<PageContext | null> {
  if (isExtensionRuntime()) {
    try {
      const resp = await chrome.runtime.sendMessage({
        type: 'DRAFTER_CAPTURE_ACTIVE_TAB',
      });
      if (resp?.ok && resp.context) {
        return resp.context as PageContext;
      }
    } catch {
      // Ignore if background worker unavailable
    }
  }
  return null;
}

export async function insertDraftIntoActiveTab(
  subject: string,
  body: string
): Promise<{ ok: boolean; targetLabel?: string; error?: string }> {
  if (isExtensionRuntime()) {
    try {
      const resp = await chrome.runtime.sendMessage({
        type: 'DRAFTER_INSERT_INTO_ACTIVE_TAB',
        subject,
        body,
      });
      return resp ?? { ok: false, error: 'No response from target tab.' };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Insert failed',
      };
    }
  }
  return { ok: false, error: 'Chrome runtime unavailable outside extension.' };
}

export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const loadingTask = pdfjsLib.getDocument({ data: bytes });
  const pdf = await loadingTask.promise;
  const pageTexts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .filter(Boolean);
    pageTexts.push(strings.join(' '));
  }
  return pageTexts.join('\n\n').trim();
}

export async function parseUploadedDocument(file: File): Promise<{
  title: string;
  content: string;
}> {
  const lower = file.name.toLowerCase();
  const baseTitle = file.name.replace(/\.[^.]+$/, '');

  if (lower.endsWith('.docx')) {
    const buf = new Uint8Array(await file.arrayBuffer());
    return { title: baseTitle, content: extractTextFromDocxBytes(buf) };
  }

  if (lower.endsWith('.pdf')) {
    const buf = new Uint8Array(await file.arrayBuffer());
    return { title: baseTitle, content: await extractPdfText(buf) };
  }

  const rawText = await file.text();
  if (lower.endsWith('.html') || lower.endsWith('.htm')) {
    return { title: baseTitle, content: extractTextFromHtml(rawText) };
  }
  if (lower.endsWith('.eml')) {
    const parsed = extractTextFromEml(rawText);
    return { title: parsed.subject || baseTitle, content: parsed.body };
  }
  if (lower.endsWith('.json')) {
    try {
      const formatted = JSON.stringify(JSON.parse(rawText), null, 2);
      return { title: baseTitle, content: formatted };
    } catch {
      return { title: baseTitle, content: rawText };
    }
  }

  return { title: baseTitle, content: rawText.trim() };
}
