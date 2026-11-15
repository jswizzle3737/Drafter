import type {
  DesignThemeMeta,
  DraftIntent,
  ExtensionPreferences,
  ModelOption,
  PrecedentDocument,
  ProviderId,
  ProviderMeta,
  SubscriptionPlan,
  ThemeMode,
  VoiceProfile,
  WritingSample,
} from './types.js';

export const DESIGN_THEMES: DesignThemeMeta[] = [
  {
    id: 'dark',
    name: 'Ink',
    desc: 'Dark · slate, steel blue',
    mode: 'dark',
    swatch: ['#0B0D12', '#12151C', '#3B72C4'],
  },
  {
    id: 'terminal',
    name: 'Terminal',
    desc: 'Dark · phosphor green, monospace',
    mode: 'dark',
    swatch: ['#080B08', '#0E130E', '#4FBF63'],
  },
  {
    id: 'ember',
    name: 'Ember',
    desc: 'Dark · warm charcoal, burnt orange',
    mode: 'dark',
    swatch: ['#110E0C', '#191512', '#B8531B'],
  },
  {
    id: 'harbor',
    name: 'Harbor',
    desc: 'Dark · deep teal, soft corners',
    mode: 'dark',
    swatch: ['#071214', '#0C1C1F', '#17807C'],
  },
  {
    id: 'contrast',
    name: 'Contrast',
    desc: 'Dark · black and white, maximum legibility',
    mode: 'dark',
    swatch: ['#000000', '#080808', '#FFFFFF'],
  },
  {
    id: 'amethyst',
    name: 'Amethyst',
    desc: 'Dark · deep violet, elegant serif',
    mode: 'dark',
    swatch: ['#0D0915', '#16101F', '#A855F7'],
  },
  {
    id: 'midnight',
    name: 'Midnight',
    desc: 'Dark · rich indigo, gold accent',
    mode: 'dark',
    swatch: ['#060915', '#0C1428', '#F59E0B'],
  },
  {
    id: 'aurora',
    name: 'Aurora',
    desc: 'Dark · teal-cyan, technical mono',
    mode: 'dark',
    swatch: ['#051014', '#0A1F26', '#06D6A0'],
  },
  {
    id: 'light',
    name: 'Paper',
    desc: 'Light · crisp white, steel blue',
    mode: 'light',
    swatch: ['#F6F7F9', '#FFFFFF', '#2F62AE'],
  },
  {
    id: 'manuscript',
    name: 'Manuscript',
    desc: 'Light · cream, serif, oxblood',
    mode: 'light',
    swatch: ['#F1EADB', '#FBF7EC', '#8C2F2B'],
  },
  {
    id: 'sand',
    name: 'Sand',
    desc: 'Light · warm stone, terracotta',
    mode: 'light',
    swatch: ['#EEE8E0', '#FAF8F4', '#A8461F'],
  },
  {
    id: 'glacier',
    name: 'Glacier',
    desc: 'Light · cool grey, deep teal',
    mode: 'light',
    swatch: ['#E9F0F4', '#F7FAFC', '#0F6483'],
  },
  {
    id: 'meadow',
    name: 'Meadow',
    desc: 'Light · pale sage, forest green',
    mode: 'light',
    swatch: ['#ECF1E7', '#F8FAF4', '#2F6B3F'],
  },
  {
    id: 'rose',
    name: 'Rose',
    desc: 'Light · blush pink, soft rounded',
    mode: 'light',
    swatch: ['#FFF1F3', '#FFFDFE', '#BE185D'],
  },
  {
    id: 'ochre',
    name: 'Ochre',
    desc: 'Light · earthy clay, slab serif',
    mode: 'light',
    swatch: ['#F5EFE6', '#FDFBF7', '#A0522D'],
  },
];

export function normalizeThemeId(id?: string): ThemeMode {
  if (!id) return 'dark';
  const found = DESIGN_THEMES.find((t) => t.id === id);
  return found ? found.id : 'dark';
}

export function getDesignTheme(id?: string): DesignThemeMeta {
  const norm = normalizeThemeId(id);
  return DESIGN_THEMES.find((t) => t.id === norm) ?? DESIGN_THEMES[0];
}

export const INTENT_PRESETS: DraftIntent[] = [
  'Email Reply',
  'Work Update / Slack',
  'Job Application / Cover Letter',
  'Essay / Long-Form',
  'Cold Outreach',
  'Follow-Up',
  'Negotiate / Pushback',
  'Decline Politely',
  'General / Anything',
];

export const REFINEMENT_CHIPS: string[] = [
  'Make it shorter and punchier without losing key points',
  'Make the tone warmer while keeping boundaries clear',
  'Match my uploaded essays and personal voice even more naturally',
  'Tighten structure with clear transitions and concrete takeaways',
  'Align closer to the matched precedent commitments',
];

export const TONE_PRESETS: string[] = [
  'Default Personal Voice',
  'Natural & Conversational',
  'Thoughtful Essay / Analytical',
  'Confident Job / Career Pitch',
  'Warm & Collaborative Teammate',
  'Crisp & Direct Work Update',
  'Executive Brief',
  'Warm Client Partner',
  'Firm Negotiation',
];

export const VOICE_INSTRUCTION_PRESETS: string[] = [
  'Conversational and human — zero AI clichés or robotic filler',
  'Reflective, narrative essay style with clear transitions and concrete examples',
  'Confident, achievement-focused voice for job applications and career outreach',
  'Warm, concise, and action-oriented for day-to-day work and Slack/email',
];

export const SAMPLE_CATEGORY_PRESETS: string[] = [
  'Essay / Article',
  'Job / Cover Letter',
  'Day-to-Day Work',
  'Email / Slack',
  'General',
];

export const PROVIDER_CATALOG: ProviderMeta[] = [
  {
    id: 'sandbox',
    label: 'Demo Sandbox (Offline · No API Key)',
    shortLabel: 'Demo Sandbox',
    requiresKey: false,
    description:
      'Runs instant reference- and voice-grounded draft previews offline inside the extension without needing an API key.',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter (All Top Models)',
    shortLabel: 'OpenRouter',
    requiresKey: true,
    description: 'Single personal API key for Claude, GPT, Gemini, DeepSeek, and Grok.',
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
    id: 'prec-job-application',
    title: 'Job Application, Cover Letter & Recruiter Outreach Playbook',
    category: 'Career & Jobs',
    tags: ['job', 'application', 'cover', 'letter', 'recruiter', 'resume', 'interview', 'role'],
    whenToUse:
      'Use when writing a cover letter, job application note, recruiter reply, or hiring manager outreach.',
    guidance:
      'Connect 2 concrete past projects/metrics directly to the role requirements; keep it under 220 words and sound genuinely human.',
    body: `# Job Application & Hiring Manager Outreach Guide

When drafting job application notes, cover letters, or recruiter replies:
1. Open with why this specific team, product, or problem genuinely excites you (skip generic "I am writing to apply for..." openings).
2. Highlight 2 concrete examples of work shipped or measurable outcomes achieved that map directly to what the role needs.
3. Keep paragraphs tight and conversational — show how you think and collaborate day to day.
4. Close with a clear, low-friction next step (e.g., happy to share a work sample or jump on a quick 15-minute intro call).`,
    enabled: true,
    pinned: false,
    updatedAt: '2026-11-12T00:00:00.000Z',
  },
  {
    id: 'prec-essay-structure',
    title: 'Thoughtful Essay, Article & Long-Form Writing Guide',
    category: 'Essays & Writing',
    tags: ['essay', 'article', 'blog', 'reflection', 'thesis', 'argument', 'writing', 'narrative'],
    whenToUse:
      'Use when drafting or refining an essay, personal statement, op-ed, post, or analytical write-up.',
    guidance:
      'Open with a vivid hook or concrete observation, build a clear central thesis, use natural transitions between paragraphs, and avoid AI filler phrases.',
    body: `# Essay & Long-Form Narrative Structure

When writing essays, personal statements, or long-form reflections:
1. Hook & Premise: Begin with a specific observation, tension, or lived moment rather than abstract generalizations.
2. Voice & Rhythm: Vary sentence length naturally. Pair analytical claims with grounded, specific examples.
3. Transitions: Connect paragraphs by evolving the core idea rather than relying on mechanical transitions ("Furthermore,", "In conclusion,").
4. Ending: Close with a resonant takeaway or forward-looking synthesis that leaves the reader with a sharp perspective.`,
    enabled: true,
    pinned: false,
    updatedAt: '2026-11-12T00:00:00.000Z',
  },
  {
    id: 'prec-timeline-extension',
    title: 'Day-to-Day Work Update, Project Handoff & Timeline Shift',
    category: 'Day-to-Day Work',
    tags: ['timeline', 'delay', 'extension', 'deadline', 'update', 'status', 'standup', 'handoff'],
    whenToUse:
      'Use for everyday team updates, project check-ins, blockers, or shifting a milestone date.',
    guidance:
      'Lead with current status or the revised date directly, identify any blocker clearly, and list concrete next steps.',
    body: `# Everyday Work Update & Milestone Check-In

When sharing a day-to-day work update or timeline adjustment:
1. Lead with the headline status or revised target date in the first two sentences.
2. State what shipped, what is in progress, and any single blocker concisely without fluff.
3. Outline the immediate next actions and any quick decision or input needed from teammates.`,
    enabled: true,
    pinned: false,
    updatedAt: '2026-11-12T00:00:00.000Z',
  },
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
    id: 'prec-vendor-sla',
    title: 'Partner Follow-Up & Overdue Deliverable Check-In',
    category: 'Day-to-Day Operations',
    tags: ['vendor', 'sla', 'late', 'escalation', 'followup', 'partner'],
    whenToUse:
      'Use when following up with an external partner, vendor, or collaborator on an overdue deliverable.',
    guidance:
      'Stay calm and factual, reference the agreed date, and ask for a confirmed delivery timestamp within 24 hours.',
    body: `# Partner Deliverable Follow-Up

When a collaborator or supplier misses an agreed milestone:
1. Reference the specific milestone date and agreed scope clearly and constructively.
2. Note the downstream impact on the team's schedule in 1-2 sentences.
3. Ask for an updated delivery plan with confirmed timestamps by end of next business day.`,
    enabled: true,
    pinned: false,
    updatedAt: '2026-11-12T00:00:00.000Z',
  },
];

export const DEFAULT_WRITING_SAMPLES: WritingSample[] = [
  {
    id: 'voice-exec-update',
    title: 'Day-to-Day Team Status Update & Ask',
    contextTag: 'Day-to-Day Work',
    voiceInstructions:
      'Crisp, direct, and friendly. Lead with progress metrics, call out blockers plainly, and use numbered asks.',
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
    title: 'Warm Project Collaboration & Career Note',
    contextTag: 'Client',
    voiceInstructions:
      'Warm, collaborative, and grounded. Keep sentences natural and conversational without corporate jargon.',
    content: `Hey Jordan,

Great chatting earlier about the analytics dashboard Phase 2 scope. I put together the clean breakdown below so both teams stay aligned on what's included in this sprint versus next month's release.

We can lock the core cohort export now and queue custom webhook alerts for Phase 3. Let me know if Tuesday afternoon works for a quick 15-minute review.

Thanks,
Alex`,
    active: true,
    createdAt: '2026-11-12T00:00:00.000Z',
  },
  {
    id: 'voice-essay-sample',
    title: 'Essay Excerpt: Building Tools People Actually Enjoy Using',
    contextTag: 'Essay / Article',
    voiceInstructions:
      'Use this essay voice for long-form writing, essays, and cover letters: opening with a concrete observation, balancing short punchy sentences with thoughtful reflection, and avoiding robotic transitions.',
    content: `Most software fails not because it lacks features, but because it forgets the rhythm of a person's actual workday. When you sit down at 9 a.m. with twelve tabs open, you don't want another dashboard to configure—you want a tool that quietly understands what you're trying to say and helps you finish it in half the time.

In my own work building product workflows, I've found that the best tools share three habits: they start from real examples rather than blank pages, they respect the author's natural voice, and they stay out of the way until needed.`,
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
    'Sound natural, human, and grounded—ready for day-to-day work, job applications, or essays. Lead with the main point first, avoid robotic AI filler ("I hope this finds you well", "delve into"), and use concrete examples.',
};

export const DEFAULT_PREFERENCES: ExtensionPreferences = {
  inlineWebmailTrigger: true,
  autoCaptureOnOpen: true,
  maxPrecedentsInPrompt: 4,
  minPrecedentMatchScore: 15,
  maxVoiceExamplesInPrompt: 3,
};
