import type {
  DraftIntent,
  ExtensionPreferences,
  ModelOption,
  PrecedentDocument,
  ProviderId,
  ProviderMeta,
  SubscriptionPlan,
  VoiceProfile,
  WritingSample,
} from './types.js';

export const INTENT_PRESETS: DraftIntent[] = [
  'Email Reply',
  'Cold Outreach',
  'Follow-Up',
  'Negotiate / Pushback',
  'Decline Politely',
  'Status Update',
  'Web Form / Comment',
];

export const REFINEMENT_CHIPS: string[] = [
  'Make it shorter and punchier without losing key points',
  'Make the tone warmer while keeping boundaries clear',
  'Align closer to the matched precedent commitments',
  'Match my personal voice samples even more naturally',
];

export const TONE_PRESETS: string[] = [
  'Default Personal Voice',
  'Executive Brief',
  'Warm Client Partner',
  'Firm Negotiation',
  'Crisp Follow-Up',
];

export const PROVIDER_CATALOG: ProviderMeta[] = [
  {
    id: 'sandbox',
    label: 'Demo Sandbox (Offline · No API Key)',
    shortLabel: 'Demo Sandbox',
    requiresKey: false,
    description:
      'Runs instant precedent- and voice-grounded draft previews offline inside the extension without needing an API key.',
  },
  {
    id: 'managed',
    label: 'Drafter Managed Subscription',
    shortLabel: 'Managed',
    requiresKey: false,
    description:
      'Uses your Drafter Pro/Team managed token quota via the Companion Server.',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter (All Top Models)',
    shortLabel: 'OpenRouter',
    requiresKey: true,
    description: 'Single BYOK key for Claude, GPT, Gemini, DeepSeek, and Grok.',
  },
  {
    id: 'anthropic',
    label: 'Anthropic (Direct API)',
    shortLabel: 'Anthropic',
    requiresKey: true,
    description: 'Direct Anthropic Messages API using your personal API key.',
  },
  {
    id: 'openai',
    label: 'OpenAI (Direct API)',
    shortLabel: 'OpenAI',
    requiresKey: true,
    description: 'Direct OpenAI Chat Completions API using your personal API key.',
  },
  {
    id: 'gemini',
    label: 'Google Gemini (Direct API)',
    shortLabel: 'Gemini',
    requiresKey: true,
    description: 'Direct Google Generative Language API using your personal API key.',
  },
  {
    id: 'ollama',
    label: 'Local Ollama (Loopback)',
    shortLabel: 'Ollama',
    requiresKey: false,
    description: 'Private on-machine inference via http://127.0.0.1:11434.',
  },
];

export const MODEL_CATALOG: ModelOption[] = [
  {
    id: 'anthropic/claude-sonnet-4.5',
    label: 'Claude Sonnet 4.5 · Best Writing',
    shortLabel: 'Claude Sonnet 4.5',
    providerHints: ['sandbox', 'managed', 'openrouter', 'anthropic'],
  },
  {
    id: 'anthropic/claude-opus-4.1',
    label: 'Claude Opus 4.1 · Flagship Reasoning',
    shortLabel: 'Claude Opus 4.1',
    providerHints: ['sandbox', 'managed', 'openrouter', 'anthropic'],
    reasoningTier: true,
  },
  {
    id: 'openai/gpt-4.1',
    label: 'GPT-4.1 · Crisp Structured',
    shortLabel: 'GPT-4.1',
    providerHints: ['sandbox', 'managed', 'openrouter', 'openai'],
  },
  {
    id: 'openai/gpt-4o',
    label: 'GPT-4o · Fast Balanced',
    shortLabel: 'GPT-4o',
    providerHints: ['sandbox', 'managed', 'openrouter', 'openai'],
  },
  {
    id: 'google/gemini-2.5-pro',
    label: 'Gemini 2.5 Pro · Deep Context',
    shortLabel: 'Gemini 2.5 Pro',
    providerHints: ['sandbox', 'managed', 'openrouter', 'gemini'],
    reasoningTier: true,
  },
  {
    id: 'google/gemini-2.5-flash',
    label: 'Gemini 2.5 Flash · Ultra Fast',
    shortLabel: 'Gemini 2.5 Flash',
    providerHints: ['sandbox', 'managed', 'openrouter', 'gemini'],
  },
  {
    id: 'deepseek/deepseek-chat-v3',
    label: 'DeepSeek V3 · Cost Efficient',
    shortLabel: 'DeepSeek V3',
    providerHints: ['sandbox', 'managed', 'openrouter'],
  },
  {
    id: 'x-ai/grok-3',
    label: 'Grok 3 · Direct Tone',
    shortLabel: 'Grok 3',
    providerHints: ['sandbox', 'managed', 'openrouter'],
  },
];

export function getModelsForProvider(provider: ProviderId): ModelOption[] {
  if (provider === 'ollama') return [];
  const eligible = MODEL_CATALOG.filter((m) =>
    m.providerHints.includes(provider)
  );
  return eligible.length > 0 ? eligible : MODEL_CATALOG;
}

export function getCompatibleModelForProvider(
  provider: ProviderId,
  currentModel: string,
  excludeModel?: string
): string {
  if (provider === 'ollama') return currentModel;
  const eligible = getModelsForProvider(provider);
  if (!excludeModel && eligible.some((m) => m.id === currentModel)) {
    return currentModel;
  }
  if (excludeModel) {
    const alternate = eligible.find((m) => m.id !== excludeModel);
    if (
      currentModel !== excludeModel &&
      eligible.some((m) => m.id === currentModel)
    ) {
      return currentModel;
    }
    return alternate?.id ?? eligible[0]?.id ?? MODEL_CATALOG[0].id;
  }
  return eligible[0]?.id ?? MODEL_CATALOG[0].id;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'starter',
    name: 'BYOK Starter',
    priceLabel: '$0',
    priceMonthlyUsd: 0,
    monthlyQuotaTokens: 0,
    tagline: 'Bring your own OpenRouter, OpenAI, Anthropic, Gemini, or local Ollama keys.',
    features: [
      'Unlimited local Precedent Library & hybrid similarity matching',
      'Personal Voice & Style Studio with local stylometric DNA',
      'OpenRouter + Direct API keys + Local Ollama support',
      'Full PromptOptimizer-style draft studio, V1/V2/V3 versions & diffs',
    ],
  },
  {
    id: 'pro',
    name: 'Drafter Pro',
    priceLabel: '$19',
    priceMonthlyUsd: 19,
    monthlyQuotaTokens: 2_000_000,
    tagline: 'All-in-one managed subscription to top frontier models — zero separate API keys needed.',
    features: [
      '2,000,000 managed tokens/month across Claude, GPT, Gemini, DeepSeek & Grok',
      'Side-by-side A/B model comparison on managed credits',
      'Optional encrypted Precedent & Voice vault cloud sync',
      'Priority routing & higher rate limits',
    ],
  },
  {
    id: 'team',
    name: 'Drafter Team',
    priceLabel: '$49',
    priceMonthlyUsd: 49,
    monthlyQuotaTokens: 7_500_000,
    tagline: 'High-volume frontier drafting for executives, legal, sales & client teams.',
    features: [
      '7,500,000 managed tokens/month across all flagship & reasoning models',
      'Access to flagship Opus / Reasoning tiers',
      'Shared precedent vault export/sync workflows',
      'Dedicated team usage tracking & priority throughput',
    ],
  },
];

export const DEFAULT_PRECEDENTS: PrecedentDocument[] = [
  {
    id: 'prec-renewal-discount',
    title: 'SaaS Annual Renewal & Discount Pushback Policy',
    category: 'Commercial / Pricing',
    tags: ['renewal', 'discount', 'pricing', 'multi-year', 'contract'],
    whenToUse:
      'Use when an existing customer requests a renewal discount, price freeze, or custom concession.',
    guidance:
      'Never offer >10% discount without a 24-month commitment or upfront annual billing.',
    body: `# Standard Renewal Discount Precedent

Our standard policy for enterprise renewal discount requests:
1. Acknowledge the partnership and value delivered over the past term (cite usage or reliability wins where known).
2. Decline flat single-year discounts politely by explaining that list pricing reflects expanded platform capabilities and dedicated support SLAs.
3. Offer a structured alternative: up to 10% loyalty credit in exchange for a 2-year commitment paid annually upfront, or keep the 1-year term at standard rate with 2 complimentary onboarding seats.
4. Anchor on a decision deadline at least 10 business days before the renewal date so service continuity is uninterrupted.`,
    enabled: true,
    pinned: false,
    updatedAt: '2026-11-12T00:00:00.000Z',
  },
  {
    id: 'prec-timeline-extension',
    title: 'Project Timeline Extension & Stakeholder Notice',
    category: 'Project Delivery',
    tags: ['timeline', 'delay', 'extension', 'deadline'],
    whenToUse:
      'Use when external dependencies or scope changes require shifting a milestone or launch date.',
    guidance:
      'Own the revised date directly, identify the concrete blocker, and propose a crisp mitigation checkpoint.',
    body: `# Milestone Extension Communication

When communicating a delivery date shift:
1. Lead with the revised target date in the first two sentences.
2. State the single root cause concisely without shifting blame or writing a lengthy apology.
3. Outline the two immediate actions underway and the exact decision or sign-off needed from the stakeholder.`,
    enabled: true,
    pinned: false,
    updatedAt: '2026-11-12T00:00:00.000Z',
  },
  {
    id: 'prec-vendor-sla',
    title: 'Vendor SLA Breach / Late Deliverable Escalation',
    category: 'Operations / Vendor',
    tags: ['vendor', 'sla', 'late', 'escalation'],
    whenToUse:
      'Use when holding a vendor or contractor accountable for a missed SLA or overdue deliverable.',
    guidance:
      'Stay calm and factual, cite the contracted commitment, and require a written recovery schedule within 24 hours.',
    body: `# Vendor SLA Escalation Notice

When a supplier misses a committed deliverable:
1. Reference the specific milestone date and contractual SLA without emotional framing.
2. Document operational impact clearly in 1-2 sentences.
3. Request an owner-assigned remediation plan with confirmed delivery timestamps by end of next business day.`,
    enabled: true,
    pinned: false,
    updatedAt: '2026-11-12T00:00:00.000Z',
  },
];

export const DEFAULT_WRITING_SAMPLES: WritingSample[] = [
  {
    id: 'voice-exec-update',
    title: 'Executive Project Update & Ask',
    contextTag: 'Executive',
    content: `Hi Maya,

Quick status on the Q3 onboarding rollout: we're tracking ahead on migration (14 of 16 accounts live) and hitting one dependency snag on SSO metadata from Acme's IT team.

Two things we need from you by Thursday:
1. Sign off on the revised cutover date (Nov 18 instead of Nov 14).
2. Let me know if you want me to loop in their VP of Engineering directly.

Best,
Alex`,
    active: true,
    createdAt: '2026-11-12T00:00:00.000Z',
  },
  {
    id: 'voice-warm-client',
    title: 'Warm Client Scope Clarification',
    contextTag: 'Client',
    content: `Hey Jordan,

Great chatting earlier about the analytics dashboard Phase 2 scope. I put together the clean breakdown below so both teams stay aligned on what's included in this sprint versus next month's release.

We can lock the core cohort export now and queue custom webhook alerts for Phase 3. Let me know if Tuesday afternoon works for a quick 15-minute review.

Thanks,
Alex`,
    active: true,
    createdAt: '2026-11-12T00:00:00.000Z',
  },
];

export const DEFAULT_VOICE_PROFILE: VoiceProfile = {
  displayName: 'Alex',
  roleContext: '',
  defaultTonePreset: 'Default Personal Voice',
  dimensions: {
    formality: 3,
    directness: 4,
    warmth: 3,
    conciseness: 4,
  },
  preferredGreeting: 'Hi {{name}},',
  preferredSignOff: 'Best,\nAlex',
  signatureBlock: '',
  guidanceRules:
    'Lead with the answer or decision first. Avoid robotic filler ("I hope this email finds you well"). Use concrete dates and numbered next steps when proposing actions.',
};

export const DEFAULT_PREFERENCES: ExtensionPreferences = {
  inlineWebmailTrigger: true,
  autoCaptureOnOpen: true,
  maxPrecedentsInPrompt: 4,
  minPrecedentMatchScore: 15,
  maxVoiceExamplesInPrompt: 3,
};
