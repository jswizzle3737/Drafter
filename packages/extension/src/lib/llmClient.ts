import {
  buildSandboxDraft,
  isLoopbackHostname,
  normalizeBaseUrl,
  PROVIDER_CATALOG,
  splitSubjectAndBody,
  type ApiKeysConfig,
  type CompiledDraftPrompt,
  type ManagedUser,
  type ProviderId,
  type SubscriptionTierId,
  type VaultPayload,
  type WritingSample,
} from '@drafter/shared';

export interface GenerateDraftParams {
  provider: ProviderId;
  model: string;
  compiled: CompiledDraftPrompt;
  subject: string;
  recipient?: string;
  instruction: string;
  intent: string;
  authorName: string;
  preferredGreeting?: string;
  preferredSignOff?: string;
  signatureBlock?: string;
  previousDraft?: string;
  refinementInstruction?: string;
  apiKeys: ApiKeysConfig;
  companionUrl: string;
  companionToken: string;
}

export interface GenerateDraftResult {
  rawText: string;
  subject: string;
  body: string;
  provider: ProviderId;
  providerLabel: string;
  model: string;
  latencyMs: number;
  totalTokens: number;
  updatedUser?: ManagedUser;
}

export interface CompanionHealthStatus {
  ok: boolean;
  mode: 'live' | 'sandbox';
  upstreamConfigured: boolean;
}

async function safeReadJson<T = Record<string, any>>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `Unexpected server response (${res.status}): ${text.slice(0, 140)}`
    );
  }
}

export function validateCompanionUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) {
    throw new Error('Companion Server URL is required.');
  }
  const parsed = new URL(trimmed);
  if (parsed.protocol !== 'https:' && !isLoopbackHostname(trimmed)) {
    throw new Error(
      'Companion Server URL must use https:// or a strict loopback host (127.0.0.1 / localhost).'
    );
  }
  return normalizeBaseUrl(trimmed);
}

export async function companionHealthCheck(
  companionUrl: string
): Promise<CompanionHealthStatus> {
  const base = validateCompanionUrl(companionUrl);
  const res = await fetch(`${base}/health`);
  const data = await safeReadJson<CompanionHealthStatus & { error?: string }>(
    res
  );
  if (!res.ok) throw new Error(data.error || 'Health check failed');
  return data;
}

export async function companionAuthRegister(params: {
  companionUrl: string;
  name: string;
  email: string;
  password: string;
}): Promise<{ token: string; user: ManagedUser }> {
  const base = validateCompanionUrl(params.companionUrl);
  const res = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: params.name,
      email: params.email,
      password: params.password,
    }),
  });
  const data = await safeReadJson<{ token: string; user: ManagedUser; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Registration failed');
  return data;
}

export async function companionAuthLogin(params: {
  companionUrl: string;
  email: string;
  password: string;
}): Promise<{ token: string; user: ManagedUser }> {
  const base = validateCompanionUrl(params.companionUrl);
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: params.email, password: params.password }),
  });
  const data = await safeReadJson<{ token: string; user: ManagedUser; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Sign in failed');
  return data;
}

export async function companionFetchMe(params: {
  companionUrl: string;
  token: string;
}): Promise<ManagedUser> {
  const base = validateCompanionUrl(params.companionUrl);
  const res = await fetch(`${base}/api/auth/me`, {
    headers: { Authorization: `Bearer ${params.token}` },
  });
  const data = await safeReadJson<{ user: ManagedUser; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Failed to refresh account');
  return data.user;
}

export async function companionCreateCheckout(params: {
  companionUrl: string;
  token: string;
  tier: Exclude<SubscriptionTierId, 'starter'>;
}): Promise<{ sessionId: string; checkoutUrl: string }> {
  const base = validateCompanionUrl(params.companionUrl);
  const res = await fetch(`${base}/api/billing/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.token}`,
    },
    body: JSON.stringify({ tier: params.tier }),
  });
  const data = await safeReadJson<{ sessionId: string; checkoutUrl: string; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Checkout session creation failed');
  return {
    sessionId: data.sessionId,
    checkoutUrl: data.sessionId
      ? `${base}/checkout-sandbox?session_id=${encodeURIComponent(data.sessionId)}`
      : data.checkoutUrl,
  };
}

export async function companionCancelPlan(params: {
  companionUrl: string;
  token: string;
}): Promise<ManagedUser> {
  const base = validateCompanionUrl(params.companionUrl);
  const res = await fetch(`${base}/api/billing/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${params.token}` },
  });
  const data = await safeReadJson<{ user: ManagedUser; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Cancel plan failed');
  return data.user;
}

export async function companionSyncVault(params: {
  companionUrl: string;
  token: string;
  vault: VaultPayload;
}): Promise<{ ok: boolean; updatedAt: string }> {
  const base = validateCompanionUrl(params.companionUrl);
  const res = await fetch(`${base}/api/vault`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.token}`,
    },
    body: JSON.stringify(params.vault),
  });
  const data = await safeReadJson<{ ok: boolean; updatedAt: string; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Vault upload failed');
  return data;
}

export async function companionRestoreVault(params: {
  companionUrl: string;
  token: string;
}): Promise<VaultPayload | null> {
  const base = validateCompanionUrl(params.companionUrl);
  const res = await fetch(`${base}/api/vault`, {
    headers: { Authorization: `Bearer ${params.token}` },
  });
  const data = await safeReadJson<{ vault?: VaultPayload | null; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Vault restore failed');
  return data.vault ?? null;
}

export async function companionDistillVoice(params: {
  companionUrl: string;
  token: string;
  samples: WritingSample[];
}): Promise<string> {
  const base = validateCompanionUrl(params.companionUrl);
  const res = await fetch(`${base}/api/ai/distill-voice`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.token}`,
    },
    body: JSON.stringify({ samples: params.samples }),
  });
  const data = await safeReadJson<{ summary?: string; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Voice distillation failed');
  return String(data.summary ?? '');
}

function getProviderLabel(id: ProviderId): string {
  return PROVIDER_CATALOG.find((p) => p.id === id)?.label ?? id;
}

function stripProviderPrefix(model: string): string {
  const idx = model.indexOf('/');
  return idx >= 0 ? model.slice(idx + 1) : model;
}

export async function generateDraft(
  params: GenerateDraftParams
): Promise<GenerateDraftResult> {
  const start = performance.now();
  const { provider, model, compiled, apiKeys } = params;
  const providerLabel = getProviderLabel(provider);

  if (provider === 'sandbox') {
    const content = buildSandboxDraft({
      subject: params.subject,
      recipient: params.recipient,
      instruction: params.instruction,
      intent: params.intent,
      model,
      refinement: params.refinementInstruction,
      previousDraft: params.previousDraft,
      authorName: params.authorName,
      preferredGreeting: params.preferredGreeting,
      preferredSignOff: params.preferredSignOff,
      signatureBlock: params.signatureBlock,
      appliedPrecedentTitles: compiled.appliedPrecedents.map(
        (p) => p.document.title
      ),
      appliedPrecedentGuidance: compiled.appliedPrecedents.map(
        (p) => p.document.guidance
      ),
      footerNote: 'Demo Sandbox (No API Key)',
    });
    const split = splitSubjectAndBody(content, params.subject);
    return {
      rawText: content,
      subject: split.subject,
      body: split.body,
      provider,
      providerLabel: 'Demo Sandbox',
      model,
      latencyMs: Math.max(12, Math.round(performance.now() - start)),
      totalTokens: Math.max(
        340,
        Math.round((compiled.fullText.length + content.length) / 3.8)
      ),
    };
  }

  if (provider === 'managed') {
    if (!params.companionToken) {
      throw new Error(
        'Sign in to your Managed Account under Models & Plans first.'
      );
    }
    const base = validateCompanionUrl(params.companionUrl);
    const res = await fetch(`${base}/api/ai/draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.companionToken}`,
      },
      body: JSON.stringify({
        model,
        systemPrompt: compiled.systemPrompt,
        userPrompt: compiled.userPrompt,
        subject: params.subject,
        recipient: params.recipient,
        instruction: params.instruction,
        intent: params.intent,
        authorName: params.authorName,
        previousDraft: params.previousDraft,
        refinementInstruction: params.refinementInstruction,
        appliedPrecedentTitles: compiled.appliedPrecedents.map(
          (p) => p.document.title
        ),
      }),
    });
    const data = await safeReadJson(res);
    if (!res.ok) throw new Error(data.error || 'Managed draft request failed');
    const split = splitSubjectAndBody(data.content, params.subject);
    return {
      rawText: data.content,
      subject: data.subject ?? split.subject,
      body: data.body ?? split.body,
      provider,
      providerLabel: 'Drafter Managed Subscription',
      model,
      latencyMs: data.latencyMs ?? Math.round(performance.now() - start),
      totalTokens: data.totalTokens ?? 0,
      updatedUser: data.user,
    };
  }

  if (provider === 'openrouter') {
    if (!apiKeys.openrouter.trim()) {
      throw new Error('Add your OpenRouter API key under Models & Plans.');
    }
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKeys.openrouter.trim()}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: compiled.systemPrompt },
          { role: 'user', content: compiled.userPrompt },
        ],
        temperature: 0.4,
      }),
    });
    const data = await safeReadJson(res);
    if (!res.ok) {
      throw new Error(data.error?.message || 'OpenRouter request failed');
    }
    const content = data.choices?.[0]?.message?.content ?? '';
    const split = splitSubjectAndBody(content, params.subject);
    return {
      rawText: content,
      subject: split.subject,
      body: split.body,
      provider,
      providerLabel,
      model,
      latencyMs: Math.round(performance.now() - start),
      totalTokens:
        data.usage?.total_tokens ??
        Math.round((compiled.fullText.length + content.length) / 4),
    };
  }

  if (provider === 'openai') {
    if (!apiKeys.openai.trim()) {
      throw new Error('Add your OpenAI API key under Models & Plans.');
    }
    const directModel = stripProviderPrefix(model);
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKeys.openai.trim()}`,
      },
      body: JSON.stringify({
        model: directModel,
        messages: [
          { role: 'system', content: compiled.systemPrompt },
          { role: 'user', content: compiled.userPrompt },
        ],
        temperature: 0.4,
      }),
    });
    const data = await safeReadJson(res);
    if (!res.ok) {
      throw new Error(data.error?.message || 'OpenAI request failed');
    }
    const content = data.choices?.[0]?.message?.content ?? '';
    const split = splitSubjectAndBody(content, params.subject);
    return {
      rawText: content,
      subject: split.subject,
      body: split.body,
      provider,
      providerLabel,
      model: directModel,
      latencyMs: Math.round(performance.now() - start),
      totalTokens:
        data.usage?.total_tokens ??
        Math.round((compiled.fullText.length + content.length) / 4),
    };
  }

  if (provider === 'anthropic') {
    if (!apiKeys.anthropic.trim()) {
      throw new Error('Add your Anthropic API key under Models & Plans.');
    }
    const directModel = stripProviderPrefix(model).replace(/\./g, '-');
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKeys.anthropic.trim(),
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: directModel,
        max_tokens: 1536,
        system: compiled.systemPrompt,
        messages: [{ role: 'user', content: compiled.userPrompt }],
      }),
    });
    const data = await safeReadJson(res);
    if (!res.ok) {
      throw new Error(data.error?.message || 'Anthropic request failed');
    }
    const content = data.content?.[0]?.text ?? '';
    const split = splitSubjectAndBody(content, params.subject);
    const totalTokens =
      (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0);
    return {
      rawText: content,
      subject: split.subject,
      body: split.body,
      provider,
      providerLabel,
      model: directModel,
      latencyMs: Math.round(performance.now() - start),
      totalTokens:
        totalTokens ||
        Math.round((compiled.fullText.length + content.length) / 4),
    };
  }

  if (provider === 'gemini') {
    if (!apiKeys.gemini.trim()) {
      throw new Error('Add your Google Gemini API key under Models & Plans.');
    }
    const directModel = stripProviderPrefix(model);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(directModel)}:generateContent?key=${encodeURIComponent(apiKeys.gemini.trim())}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: compiled.systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: compiled.userPrompt }] }],
      }),
    });
    const data = await safeReadJson(res);
    if (!res.ok) {
      throw new Error(data.error?.message || 'Gemini request failed');
    }
    const content =
      data.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text ?? '')
        .join('') ?? '';
    const split = splitSubjectAndBody(content, params.subject);
    return {
      rawText: content,
      subject: split.subject,
      body: split.body,
      provider,
      providerLabel,
      model: directModel,
      latencyMs: Math.round(performance.now() - start),
      totalTokens:
        data.usageMetadata?.totalTokenCount ??
        Math.round((compiled.fullText.length + content.length) / 4),
    };
  }

  // Local Ollama (strictly loopback-validated)
  const ollamaUrl = apiKeys.ollamaUrl.trim() || 'http://127.0.0.1:11434';
  if (!isLoopbackHostname(ollamaUrl)) {
    throw new Error(
      'Local Ollama URL must point strictly to localhost or 127.0.0.1.'
    );
  }
  const base = normalizeBaseUrl(ollamaUrl);
  const ollamaModel = apiKeys.ollamaModel.trim() || 'llama3.1:8b';
  const res = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: ollamaModel,
      stream: false,
      messages: [
        { role: 'system', content: compiled.systemPrompt },
        { role: 'user', content: compiled.userPrompt },
      ],
    }),
  });
  const data = await safeReadJson(res);
  if (!res.ok) throw new Error(data.error || 'Ollama request failed');
  const content = data.message?.content ?? '';
  const split = splitSubjectAndBody(content, params.subject);
  return {
    rawText: content,
    subject: split.subject,
    body: split.body,
    provider,
    providerLabel,
    model: ollamaModel,
    latencyMs: Math.round(performance.now() - start),
    totalTokens:
      (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0) ||
      Math.round((compiled.fullText.length + content.length) / 4),
  };
}
