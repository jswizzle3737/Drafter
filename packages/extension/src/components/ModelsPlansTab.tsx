import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  getCompatibleModelForProvider,
  getModelsForProvider,
  isLoopbackHostname,
  PROVIDER_CATALOG,
  SUBSCRIPTION_PLANS,
  type ApiKeysConfig,
  type ExtensionPreferences,
  type ManagedUser,
  type ProviderId,
  type SubscriptionTierId,
} from '@drafter/shared';
import {
  companionAuthLogin,
  companionAuthRegister,
  companionCancelPlan,
  companionCreateCheckout,
  companionFetchMe,
  companionHealthCheck,
  companionRestoreVault,
  companionSyncVault,
  validateCompanionUrl,
  type CompanionHealthStatus,
} from '../lib/llmClient.js';
import { isExtensionRuntime, type DrafterAppState } from '../lib/storage.js';

interface ModelsPlansTabProps {
  state: DrafterAppState;
  initialSubtab?: 'byok' | 'account' | 'prefs';
  requestedSubtab?: { tab: 'byok' | 'account' | 'prefs'; nonce: number };
  onUpdateState: (updater: (prev: DrafterAppState) => DrafterAppState) => void;
  onNotify: (msg: string) => void;
}

export const ModelsPlansTab: React.FC<ModelsPlansTabProps> = ({
  state,
  initialSubtab = 'byok',
  requestedSubtab,
  onUpdateState,
  onNotify,
}) => {
  const isExtension = isExtensionRuntime();
  const [subtab, setSubtab] = useState<'byok' | 'account' | 'prefs'>(
    requestedSubtab?.tab ?? initialSubtab
  );
  const [authMode, setAuthMode] = useState<'register' | 'login'>('register');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [checkoutModalUrl, setCheckoutModalUrl] = useState<string | null>(null);
  const [healthState, setHealthState] = useState<{
    status: 'idle' | 'checking' | 'online' | 'offline';
    detail?: CompanionHealthStatus;
    error?: string;
  }>({ status: 'idle' });

  const tokenRef = useRef(state.companionToken);
  const urlRef = useRef(state.companionUrl);
  tokenRef.current = state.companionToken;
  urlRef.current = state.companionUrl;

  useEffect(() => {
    if (requestedSubtab) {
      setSubtab(requestedSubtab.tab);
    }
  }, [requestedSubtab?.nonce, requestedSubtab?.tab]);

  const activeProviderMeta =
    PROVIDER_CATALOG.find((p) => p.id === state.provider) ??
    PROVIDER_CATALOG[0];
  const eligibleModels = getModelsForProvider(state.provider);

  const checkHealth = useCallback(async (urlToCheck: string) => {
    setHealthState({ status: 'checking' });
    try {
      const detail = await companionHealthCheck(urlToCheck);
      setHealthState({ status: 'online', detail });
    } catch (err) {
      setHealthState({
        status: 'offline',
        error: err instanceof Error ? err.message : 'Server unreachable',
      });
    }
  }, []);


  const silentRefreshAccount = useCallback(async () => {
    const token = tokenRef.current;
    const url = urlRef.current;
    if (!token) return;
    try {
      const user = await companionFetchMe({
        companionUrl: url,
        token,
      });
      onUpdateState((prev) => ({
        ...prev,
        companionUser: user,
        provider:
          user.status === 'active' && user.tier !== 'starter'
            ? 'managed'
            : prev.provider,
      }));
      setCheckoutModalUrl(null);
      if (user.status === 'active' && user.tier !== 'starter') {
        onNotify(
          `Subscription active: ${user.tier.toUpperCase()} (${user.monthlyQuotaTokens.toLocaleString()} tokens/mo).`
        );
      }
    } catch {
      // Manual Refresh Status remains available if background refresh fails
    }
  }, [onUpdateState, onNotify]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type !== 'DRAFTER_BILLING_COMPLETE') return;
      try {
        const expectedOrigin = new URL(validateCompanionUrl(urlRef.current)).origin;
        if (
          event.origin !== expectedOrigin &&
          event.origin !== window.location.origin
        ) {
          return;
        }
      } catch {
        if (event.origin !== window.location.origin) return;
      }
      void silentRefreshAccount();
    };
    window.addEventListener('message', onMessage);

    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel('drafter-billing');
      channel.onmessage = (event) => {
        if (event.data?.type === 'DRAFTER_BILLING_COMPLETE') {
          void silentRefreshAccount();
        }
      };
    }

    return () => {
      window.removeEventListener('message', onMessage);
      channel?.close();
    };
  }, [silentRefreshAccount]);

  const updateKeys = (patch: Partial<ApiKeysConfig>) => {
    onUpdateState((prev) => ({
      ...prev,
      apiKeys: { ...prev.apiKeys, ...patch },
    }));
  };

  const updatePrefs = (patch: Partial<ExtensionPreferences>) => {
    onUpdateState((prev) => ({
      ...prev,
      preferences: { ...prev.preferences, ...patch },
    }));
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const result =
        authMode === 'register'
          ? await companionAuthRegister({
              companionUrl: state.companionUrl,
              name: authName,
              email: authEmail,
              password: authPassword,
            })
          : await companionAuthLogin({
              companionUrl: state.companionUrl,
              email: authEmail,
              password: authPassword,
            });
      onUpdateState((prev) => ({
        ...prev,
        companionToken: result.token,
        companionUser: result.user,
      }));
      setAuthPassword('');
      onNotify(`Signed in as ${result.user.email}.`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setBusy(false);
    }
  };

  const handleRefreshAccount = async () => {
    if (!state.companionToken) return;
    setBusy(true);
    try {
      const user = await companionFetchMe({
        companionUrl: state.companionUrl,
        token: state.companionToken,
      });
      onUpdateState((prev) => ({
        ...prev,
        companionUser: user,
        provider:
          user.status === 'active' && user.tier !== 'starter'
            ? 'managed'
            : prev.provider,
      }));
      onNotify(
        `Plan status refreshed: ${user.tier.toUpperCase()} (${user.status}).`
      );
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Refresh failed');
    } finally {
      setBusy(false);
    }
  };

  const handleSubscribe = async (tier: Exclude<SubscriptionTierId, 'starter'>) => {
    if (!state.companionToken) {
      onNotify('Create or sign in to an account on the left first.');
      return;
    }
    setBusy(true);
    try {
      const session = await companionCreateCheckout({
        companionUrl: state.companionUrl,
        token: state.companionToken,
        tier,
      });
      onUpdateState((prev) => ({
        ...prev,
        companionUser: prev.companionUser
          ? {
              ...prev.companionUser,
              pendingCheckoutUrl: session.checkoutUrl,
              pendingSessionId: session.sessionId,
            }
          : null,
      }));
      const popup = window.open(session.checkoutUrl, '_blank');
      if (popup) {
        onNotify('Opened checkout session in a new tab.');
      } else {
        setCheckoutModalUrl(session.checkoutUrl);
        onNotify('Opened inline Stripe Checkout Simulator.');
      }
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Checkout failed');
    } finally {
      setBusy(false);
    }
  };

  const handleCancelPlan = async () => {
    if (!state.companionToken) return;
    setBusy(true);
    try {
      const user = await companionCancelPlan({
        companionUrl: state.companionUrl,
        token: state.companionToken,
      });
      onUpdateState((prev) => ({ ...prev, companionUser: user }));
      onNotify('Subscription canceled.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Cancel failed');
    } finally {
      setBusy(false);
    }
  };

  const handleSyncVault = async () => {
    if (!state.companionToken) return;
    setBusy(true);
    try {
      await companionSyncVault({
        companionUrl: state.companionUrl,
        token: state.companionToken,
        vault: {
          precedents: state.precedents,
          writingSamples: state.writingSamples,
          voiceProfile: state.voiceProfile,
          sessions: state.sessions,
          updatedAt: new Date().toISOString(),
        },
      });
      onNotify('Precedent & Voice vault synced to cloud.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setBusy(false);
    }
  };

  const handleRestoreVault = async () => {
    if (!state.companionToken) return;
    setBusy(true);
    try {
      const vault = await companionRestoreVault({
        companionUrl: state.companionUrl,
        token: state.companionToken,
      });
      if (!vault) {
        onNotify('No cloud vault snapshot found yet.');
        return;
      }
      onUpdateState((prev) => ({
        ...prev,
        precedents: vault.precedents ?? prev.precedents,
        writingSamples: vault.writingSamples ?? prev.writingSamples,
        voiceProfile: vault.voiceProfile ?? prev.voiceProfile,
        sessions: vault.sessions ?? prev.sessions,
      }));
      onNotify('Restored Precedent & Voice vault from cloud.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Restore failed');
    } finally {
      setBusy(false);
    }
  };

  const user: ManagedUser | null = state.companionUser;
  const quotaPct =
    user && user.monthlyQuotaTokens > 0
      ? Math.min(
          100,
          Math.round((user.usedTokens / user.monthlyQuotaTokens) * 100)
        )
      : 0;

  return (
    <div className="stack">
      <div className="row-between">
        <div className="nav-pills">
          <button
            type="button"
            className={`nav-pill ${subtab === 'byok' ? 'active' : ''}`}
            onClick={() => setSubtab('byok')}
          >
            API Keys &amp; OpenRouter (BYOK)
          </button>
          <button
            type="button"
            className={`nav-pill ${subtab === 'account' ? 'active' : ''}`}
            onClick={() => setSubtab('account')}
          >
            Managed Subscriptions &amp; Account
          </button>
          <button
            type="button"
            className={`nav-pill ${subtab === 'prefs' ? 'active' : ''}`}
            onClick={() => setSubtab('prefs')}
          >
            Extension &amp; Retrieval Preferences
          </button>
        </div>

        <div className="muted">
          Active Drafting Provider:{' '}
          <strong style={{ color: 'var(--text-primary)' }}>
            {activeProviderMeta.label}
          </strong>
        </div>
      </div>

      {subtab === 'byok' && (
        <div className="split-grid">
          <section className="card stack">
            <div className="card-title">Default Provider &amp; Model</div>
            <div className="field">
              <label className="field-label" htmlFor="byok-provider">
                Active Provider
              </label>
              <select
                id="byok-provider"
                className="select"
                value={state.provider}
                onChange={(e) => {
                  const nextProvider = e.target.value as ProviderId;
                  onUpdateState((prev) => {
                    const nextModel = getCompatibleModelForProvider(
                      nextProvider,
                      prev.model
                    );
                    const nextCompare = getCompatibleModelForProvider(
                      nextProvider,
                      prev.compareModel,
                      nextModel
                    );
                    return {
                      ...prev,
                      provider: nextProvider,
                      model: nextModel,
                      compareModel: nextCompare,
                    };
                  });
                }}
              >
                {PROVIDER_CATALOG.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <span className="muted">{activeProviderMeta.description}</span>
            </div>

            {state.provider === 'ollama' ? (
              <div className="field">
                <label className="field-label" htmlFor="byok-model-ollama">
                  Default Ollama Model
                </label>
                <input
                  id="byok-model-ollama"
                  className="input mono"
                  value={state.apiKeys.ollamaModel}
                  onChange={(e) => updateKeys({ ollamaModel: e.target.value })}
                />
              </div>
            ) : (
              <div className="field">
                <label className="field-label" htmlFor="byok-model">
                  Default Model
                </label>
                <select
                  id="byok-model"
                  className="select"
                  value={state.model}
                  onChange={(e) =>
                    onUpdateState((prev) => ({
                      ...prev,
                      model: e.target.value,
                    }))
                  }
                >
                  {eligibleModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="subcard muted">
              Your BYOK API keys stay locally in{' '}
              <code>
                {isExtension ? 'chrome.storage.local' : 'browser localStorage'}
              </code>{' '}
              on your device and are never uploaded to Drafter servers.
            </div>
          </section>

          <section className="card stack">
            <div className="card-title">API Keys &amp; Local Endpoints</div>

            <div className="field">
              <label className="field-label" htmlFor="key-openrouter">
                OpenRouter API Key
              </label>
              <input
                id="key-openrouter"
                type="password"
                className="input mono"
                placeholder="sk-or-v1-..."
                value={state.apiKeys.openrouter}
                onChange={(e) => updateKeys({ openrouter: e.target.value })}
              />
            </div>

            <div className="grid-2">
              <div className="field">
                <label className="field-label" htmlFor="key-openai">
                  OpenAI API Key
                </label>
                <input
                  id="key-openai"
                  type="password"
                  className="input mono"
                  placeholder="sk-..."
                  value={state.apiKeys.openai}
                  onChange={(e) => updateKeys({ openai: e.target.value })}
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="key-anthropic">
                  Anthropic API Key
                </label>
                <input
                  id="key-anthropic"
                  type="password"
                  className="input mono"
                  placeholder="sk-ant-..."
                  value={state.apiKeys.anthropic}
                  onChange={(e) => updateKeys({ anthropic: e.target.value })}
                />
              </div>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="key-gemini">
                Google Gemini API Key
              </label>
              <input
                id="key-gemini"
                type="password"
                className="input mono"
                placeholder="AIza..."
                value={state.apiKeys.gemini}
                onChange={(e) => updateKeys({ gemini: e.target.value })}
              />
            </div>

            <div className="grid-2">
              <div className="field">
                <label className="field-label" htmlFor="key-ollama-url">
                  Local Ollama Base URL
                </label>
                <input
                  id="key-ollama-url"
                  className="input mono"
                  value={state.apiKeys.ollamaUrl}
                  onChange={(e) => updateKeys({ ollamaUrl: e.target.value })}
                />
                {!isLoopbackHostname(state.apiKeys.ollamaUrl) && (
                  <span style={{ color: 'var(--danger)', fontSize: '11.5px' }}>
                    Must target localhost or 127.0.0.1.
                  </span>
                )}
              </div>
              <div className="field">
                <label className="field-label" htmlFor="key-ollama-model">
                  Local Ollama Model
                </label>
                <input
                  id="key-ollama-model"
                  className="input mono"
                  value={state.apiKeys.ollamaModel}
                  onChange={(e) => updateKeys({ ollamaModel: e.target.value })}
                />
              </div>
            </div>
          </section>
        </div>
      )}

      {subtab === 'account' && (
        <div className="split-grid">
          {/* Companion Server & Account */}
          <section className="card stack">
            <div className="row-between">
              <div className="card-title">Companion Server &amp; Account</div>
              <div className="row">
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={healthState.status === 'checking'}
                  onClick={() => void checkHealth(state.companionUrl)}
                >
                  {healthState.status === 'checking'
                    ? 'Checking...'
                    : 'Check Server'}
                </button>
                {user && (
                  <>
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={busy}
                      onClick={handleRefreshAccount}
                    >
                      Refresh Status
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger-link btn-sm"
                      onClick={() =>
                        onUpdateState((prev) => ({
                          ...prev,
                          companionToken: '',
                          companionUser: null,
                        }))
                      }
                    >
                      Sign Out
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="field">
              <div className="row-between">
                <label className="field-label" htmlFor="companion-url">
                  Companion Server URL
                </label>
                {healthState.status === 'online' && healthState.detail && (
                  <span className="badge badge-accent">
                    Server Online ·{' '}
                    {healthState.detail.mode === 'live'
                      ? 'Live OpenRouter'
                      : 'Sandbox Billing & AI'}
                  </span>
                )}
                {healthState.status === 'offline' && (
                  <span className="badge badge-danger">
                    Server Offline ({healthState.error})
                  </span>
                )}
              </div>
              <input
                id="companion-url"
                className="input mono"
                value={state.companionUrl}
                onChange={(e) => {
                  setHealthState({ status: 'idle' });
                  onUpdateState((prev) => ({
                    ...prev,
                    companionUrl: e.target.value,
                  }));
                }}
              />
            </div>

            {!user ? (
              <form className="subcard stack" onSubmit={handleAuthSubmit}>
                <div className="nav-pills" style={{ alignSelf: 'flex-start' }}>
                  <button
                    type="button"
                    className={`nav-pill ${authMode === 'register' ? 'active' : ''}`}
                    onClick={() => setAuthMode('register')}
                  >
                    Create Account
                  </button>
                  <button
                    type="button"
                    className={`nav-pill ${authMode === 'login' ? 'active' : ''}`}
                    onClick={() => setAuthMode('login')}
                  >
                    Sign In
                  </button>
                </div>

                {authMode === 'register' && (
                  <div className="field">
                    <label className="field-label" htmlFor="auth-name">
                      Full Name
                    </label>
                    <input
                      id="auth-name"
                      className="input"
                      placeholder="Alex Rivera"
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                    />
                  </div>
                )}

                <div className="field">
                  <label className="field-label" htmlFor="auth-email">
                    Email
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    required
                    className="input"
                    placeholder="alex@example.com"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                  />
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="auth-password">
                    Password
                  </label>
                  <input
                    id="auth-password"
                    type="password"
                    required
                    minLength={6}
                    className="input"
                    placeholder="Min 6 characters"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={busy}
                >
                  {authMode === 'register' ? 'Create Account' : 'Sign In'}
                </button>
              </form>
            ) : (
              <div className="subcard stack">
                <div className="row-between">
                  <div>
                    <div style={{ fontWeight: 700 }}>{user.name}</div>
                    <div className="muted">{user.email}</div>
                  </div>
                  <span
                    className={`badge ${user.status === 'active' && user.tier !== 'starter' ? 'badge-accent' : ''}`}
                  >
                    {user.tier.toUpperCase()} · {user.status}
                  </span>
                </div>

                <div className="field">
                  <div className="row-between">
                    <span className="muted">Monthly Managed Quota</span>
                    <span className="muted">
                      {user.usedTokens.toLocaleString()} /{' '}
                      {user.monthlyQuotaTokens.toLocaleString()} tokens (
                      {quotaPct}%)
                    </span>
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{ width: `${quotaPct}%` }}
                    />
                  </div>
                </div>

                {user.pendingCheckoutUrl && (
                  <div className="row-between muted">
                    <span>
                      Pending checkout:{' '}
                      <a
                        href={user.pendingCheckoutUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open Checkout Page
                      </a>
                    </span>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() =>
                        setCheckoutModalUrl(user.pendingCheckoutUrl!)
                      }
                    >
                      Open Checkout Here
                    </button>
                  </div>
                )}

                <div className="row">
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={busy}
                    onClick={handleSyncVault}
                  >
                    Sync Vault to Cloud ↑
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={busy}
                    onClick={handleRestoreVault}
                  >
                    Restore Vault from Cloud ↓
                  </button>
                  {user.status === 'active' && user.tier !== 'starter' && (
                    <button
                      type="button"
                      className="btn btn-danger-link btn-sm"
                      disabled={busy}
                      onClick={handleCancelPlan}
                    >
                      Cancel Plan
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Subscription Tiers */}
          <section className="card stack">
            <div className="card-title">
              Subscription Tiers (Stripe Checkout)
            </div>

            {SUBSCRIPTION_PLANS.map((plan) => {
              const isCurrent =
                user &&
                user.tier === plan.id &&
                (plan.id === 'starter' || user.status === 'active');

              return (
                <div key={plan.id} className="subcard stack">
                  <div className="row-between">
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '14.5px' }}>
                        {plan.name}
                      </div>
                      <div className="muted">{plan.tagline}</div>
                    </div>
                    <div>
                      <span style={{ fontWeight: 800, fontSize: '18px' }}>
                        {plan.priceLabel}
                      </span>
                      <span className="muted">/mo</span>
                    </div>
                  </div>

                  <ul
                    style={{
                      margin: '4px 0 4px 18px',
                      padding: 0,
                      fontSize: '12.5px',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {plan.features.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>

                  <div>
                    {plan.id === 'starter' ? (
                      isCurrent ? (
                        <button type="button" className="btn btn-sm" disabled>
                          Current Plan
                        </button>
                      ) : null
                    ) : isCurrent ? (
                      <button type="button" className="btn btn-sm" disabled>
                        Current Plan
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={busy}
                        onClick={() => handleSubscribe(plan.id as 'pro' | 'team')}
                      >
                        Subscribe to {plan.name} →
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        </div>
      )}

      {subtab === 'prefs' && (
        <section className="card stack" style={{ maxWidth: '720px' }}>
          <div className="card-title">
            Extension &amp; Retrieval Preferences
          </div>

          <label className="row-between subcard" style={{ cursor: 'pointer' }}>
            <div>
              <div style={{ fontWeight: 700 }}>
                Inline Webmail &amp; Compose ✦ Draft Trigger
              </div>
              <div className="muted">
                Show the floating + Draft pill inside email and web textareas.
              </div>
            </div>
            <input
              type="checkbox"
              checked={state.preferences.inlineWebmailTrigger}
              onChange={(e) =>
                updatePrefs({ inlineWebmailTrigger: e.target.checked })
              }
            />
          </label>

          <label className="row-between subcard" style={{ cursor: 'pointer' }}>
            <div>
              <div style={{ fontWeight: 700 }}>
                Auto-Capture Active Tab Context on Open
              </div>
              <div className="muted">
                Automatically read page/email subject and thread when opening
                the Chrome Extension Popup or Side Panel.
              </div>
            </div>
            <input
              type="checkbox"
              checked={state.preferences.autoCaptureOnOpen}
              onChange={(e) =>
                updatePrefs({ autoCaptureOnOpen: e.target.checked })
              }
            />
          </label>

          <div className="grid-2">
            <div className="field">
              <label className="field-label" htmlFor="pref-max-prec">
                Max Precedents Injected per Draft
              </label>
              <input
                id="pref-max-prec"
                type="number"
                min={1}
                max={10}
                className="input"
                value={state.preferences.maxPrecedentsInPrompt}
                onChange={(e) =>
                  updatePrefs({
                    maxPrecedentsInPrompt: Math.max(
                      1,
                      Number(e.target.value) || 4
                    ),
                  })
                }
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="pref-min-score">
                Minimum Precedent Match Score (%)
              </label>
              <input
                id="pref-min-score"
                type="number"
                min={0}
                max={90}
                className="input"
                value={state.preferences.minPrecedentMatchScore}
                onChange={(e) =>
                  updatePrefs({
                    minPrecedentMatchScore: Math.max(
                      0,
                      Number(e.target.value) || 0
                    ),
                  })
                }
              />
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="pref-max-voice">
              Max Reference Voice Examples Attached
            </label>
            <input
              id="pref-max-voice"
              type="number"
              min={1}
              max={6}
              className="input"
              value={state.preferences.maxVoiceExamplesInPrompt}
              onChange={(e) =>
                updatePrefs({
                  maxVoiceExamplesInPrompt: Math.max(
                    1,
                    Number(e.target.value) || 3
                  ),
                })
              }
            />
          </div>
        </section>
      )}

      {checkoutModalUrl && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Stripe Checkout Simulator"
        >
          <div className="modal-card modal-card-wide stack">
            <div className="row-between">
              <div className="card-title">Stripe Checkout Simulator</div>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setCheckoutModalUrl(null)}
              >
                Close
              </button>
            </div>
            <iframe
              title="Stripe Checkout Simulator"
              src={checkoutModalUrl}
              className="checkout-iframe"
            />
          </div>
        </div>
      )}
    </div>
  );
};
