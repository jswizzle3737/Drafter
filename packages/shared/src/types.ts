export type ThemeMode =
  | 'dark'
  | 'terminal'
  | 'ember'
  | 'harbor'
  | 'contrast'
  | 'amethyst'
  | 'midnight'
  | 'aurora'
  | 'light'
  | 'manuscript'
  | 'sand'
  | 'glacier'
  | 'meadow'
  | 'rose'
  | 'ochre';

export interface DesignThemeMeta {
  id: ThemeMode;
  name: string;
  desc: string;
  mode: 'dark' | 'light';
  swatch: [string, string, string];
}


export type ProviderId =
  | 'sandbox'
  | 'managed'
  | 'openrouter'
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'ollama';

export type SubscriptionTierId = 'starter' | 'pro' | 'team';

export type DraftIntent =
  | 'Email Reply'
  | 'Work Update / Slack'
  | 'Job Application / Cover Letter'
  | 'Essay / Long-Form'
  | 'Cold Outreach'
  | 'Follow-Up'
  | 'Negotiate / Pushback'
  | 'Decline Politely'
  | 'Status Update'
  | 'Web Form / Comment'
  | 'General / Anything';

export interface PrecedentDocument {
  id: string;
  title: string;
  category: string;
  tags: string[];
  whenToUse: string;
  guidance: string;
  body: string;
  enabled: boolean;
  pinned: boolean;
  updatedAt: string;
}

export interface PrecedentChunk {
  docId: string;
  chunkIndex: number;
  heading: string;
  text: string;
}

export interface RankedPrecedent {
  document: PrecedentDocument;
  score: number; // 0..100 integer percentage
  rawScore: number;
  matchedTerms: string[];
  matchedTags: string[];
  bestChunk: PrecedentChunk | null;
  pinned: boolean;
}

export interface WritingSample {
  id: string;
  title: string;
  contextTag: string;
  voiceInstructions?: string;
  content: string;
  active: boolean;
  createdAt: string;
}

export interface VoiceDimensions {
  formality: number; // 1..5
  directness: number; // 1..5
  warmth: number; // 1..5
  conciseness: number; // 1..5
}

export interface VoiceProfile {
  displayName: string;
  roleContext: string;
  defaultTonePreset: string;
  dimensions: VoiceDimensions;
  preferredGreeting: string;
  preferredSignOff: string;
  signatureBlock: string;
  guidanceRules: string;
  distilledSummary?: string;
}

export interface VoiceAnalysis {
  activeCount: number;
  totalWords: number;
  avgSentenceLength: number;
  contractionRate: number; // 0..100
  questionRate: number; // 0..100
  commonOpenings: string[];
  commonClosings: string[];
  summary: string;
}

export interface PageContext {
  kind: 'email' | 'webpage';
  title: string;
  subject: string;
  recipient: string;
  threadText: string;
  url: string;
  hostname: string;
  capturedAt: string;
}

export interface DraftVersion {
  version: number;
  subject: string;
  body: string;
  rawText: string;
  provider: ProviderId;
  providerLabel: string;
  model: string;
  latencyMs: number;
  totalTokens: number;
  instruction: string;
  appliedPrecedents: Array<{ id: string; title: string; score: number }>;
  createdAt: string;
  compareVariant?: {
    providerLabel: string;
    model: string;
    subject: string;
    body: string;
    latencyMs: number;
    totalTokens: number;
  };
}

export interface DraftSession {
  id: string;
  context: PageContext;
  intent: DraftIntent;
  instruction: string;
  voiceToneOverride: string;
  customVoiceInstruction?: string;
  versions: DraftVersion[];
  pinnedPrecedentIds: string[];
  excludedPrecedentIds: string[];
  updatedAt: string;
}

export interface CompiledDraftPrompt {
  systemPrompt: string;
  userPrompt: string;
  fullText: string;
  appliedPrecedents: RankedPrecedent[];
  attachedVoiceSamples: WritingSample[];
  voiceAnalysis: VoiceAnalysis;
}

export interface DiffLine {
  type: 'unchanged' | 'removed' | 'added';
  text: string;
}

export interface ModelOption {
  id: string;
  label: string;
  shortLabel: string;
  providerHints: ProviderId[];
  reasoningTier?: boolean;
}

export interface ProviderMeta {
  id: ProviderId;
  label: string;
  shortLabel: string;
  requiresKey: boolean;
  description: string;
}

export interface SubscriptionPlan {
  id: SubscriptionTierId;
  name: string;
  priceLabel: string;
  priceMonthlyUsd: number;
  monthlyQuotaTokens: number;
  tagline: string;
  features: string[];
}

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  tier: SubscriptionTierId;
  status: 'active' | 'pending' | 'canceled' | 'inactive';
  monthlyQuotaTokens: number;
  usedTokens: number;
  pendingCheckoutUrl?: string;
  pendingSessionId?: string;
}

export interface ExtensionPreferences {
  inlineWebmailTrigger: boolean;
  autoCaptureOnOpen: boolean;
  maxPrecedentsInPrompt: number;
  minPrecedentMatchScore: number;
  maxVoiceExamplesInPrompt: number;
}

export interface ApiKeysConfig {
  openrouter: string;
  openai: string;
  anthropic: string;
  gemini: string;
  ollamaUrl: string;
  ollamaModel: string;
}

export interface VaultPayload {
  precedents: PrecedentDocument[];
  writingSamples: WritingSample[];
  voiceProfile: VoiceProfile;
  sessions?: DraftSession[];
  updatedAt: string;
}
