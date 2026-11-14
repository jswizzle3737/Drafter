import React, { useEffect, useState } from 'react';
import {
  DESIGN_THEMES,
  getCompatibleModelForProvider,
  getDesignTheme,
  getModelsForProvider,
  isLoopbackHostname,
  PROVIDER_CATALOG,
  type ApiKeysConfig,
  type ExtensionPreferences,
  type ProviderId,
  type ThemeMode,
} from '@drafter/shared';
import type { DrafterAppState } from '../lib/storage.js';
import { ThemeSwatchDots } from './Header.js';

export type SettingsSubtabId = 'design' | 'byok' | 'prefs';

interface ModelsPlansTabProps {
  state: DrafterAppState;
  initialSubtab?: SettingsSubtabId | 'account';
  requestedSubtab?: { tab: SettingsSubtabId | 'account'; nonce: number };
  onUpdateState: (updater: (prev: DrafterAppState) => DrafterAppState) => void;
  onNotify: (msg: string) => void;
}

function normalizeSubtab(
  tab?: SettingsSubtabId | 'account'
): SettingsSubtabId {
  if (tab === 'byok' || tab === 'prefs' || tab === 'design') return tab;
  return 'design';
}

export const ModelsPlansTab: React.FC<ModelsPlansTabProps> = ({
  state,
  initialSubtab = 'design',
  requestedSubtab,
  onUpdateState,
  onNotify,
}) => {
  const [subtab, setSubtab] = useState<SettingsSubtabId>(
    normalizeSubtab(requestedSubtab?.tab ?? initialSubtab)
  );
  const [filterMode, setFilterMode] = useState<'all' | 'dark' | 'light'>('all');

  useEffect(() => {
    if (requestedSubtab) {
      setSubtab(normalizeSubtab(requestedSubtab.tab));
    }
  }, [requestedSubtab?.nonce, requestedSubtab?.tab]);

  const activeProviderMeta =
    PROVIDER_CATALOG.find((p) => p.id === state.provider) ??
    PROVIDER_CATALOG[0];
  const eligibleModels = getModelsForProvider(state.provider);
  const currentDesign = getDesignTheme(state.theme);

  const visibleThemes = DESIGN_THEMES.filter((t) =>
    filterMode === 'all' ? true : t.mode === filterMode
  );

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

  const handleSelectTheme = (themeId: ThemeMode) => {
    const meta = getDesignTheme(themeId);
    onUpdateState((prev) => ({ ...prev, theme: meta.id }));
    onNotify(`Applied "${meta.name}" interface design (${meta.desc}).`);
  };

  const handleProviderChange = (provider: ProviderId) => {
    onUpdateState((prev) => {
      const nextModel = getCompatibleModelForProvider(provider, prev.model);
      const nextCompare = getCompatibleModelForProvider(
        provider,
        prev.compareModel,
        nextModel
      );
      return {
        ...prev,
        provider,
        model: nextModel,
        compareModel: nextCompare,
      };
    });
  };

  const ollamaLoopbackValid = isLoopbackHostname(state.apiKeys.ollamaUrl);

  return (
    <div className="stack">
      <div className="card">
        <div className="row-between">
          <div>
            <div className="card-title">
              Personal Studio Settings &amp; Interface Designs
            </div>
            <div className="muted">
              100% personal &amp; local-first — customize your interface design,
              personal API keys, and drafting preferences.
            </div>
          </div>

          <div className="nav-pills" role="tablist" aria-label="Settings Sections">
            <button
              type="button"
              role="tab"
              aria-selected={subtab === 'design'}
              className={`nav-pill ${subtab === 'design' ? 'active' : ''}`}
              onClick={() => setSubtab('design')}
            >
              Interface Designs (15)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={subtab === 'byok'}
              className={`nav-pill ${subtab === 'byok' ? 'active' : ''}`}
              onClick={() => setSubtab('byok')}
            >
              AI Engine &amp; API Keys
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={subtab === 'prefs'}
              className={`nav-pill ${subtab === 'prefs' ? 'active' : ''}`}
              onClick={() => setSubtab('prefs')}
            >
              Extension Preferences
            </button>
          </div>
        </div>
      </div>

      {subtab === 'design' && (
        <div className="card stack">
          <div className="row-between">
            <div>
              <div className="card-title">
                Interface Design
                <span className="badge badge-accent">
                  Active: {currentDesign.name}
                </span>
              </div>
              <div className="muted">
                Fifteen complete designs from PromptOptimizer — each with its
                own palette, typography, and corner geometry. Applies
                immediately across the Popup, Side Panel, and Full Studio.
              </div>
            </div>

            <div className="row">
              <button
                type="button"
                className={`pill-btn ${filterMode === 'all' ? 'active' : ''}`}
                onClick={() => setFilterMode('all')}
              >
                All (15)
              </button>
              <button
                type="button"
                className={`pill-btn ${filterMode === 'dark' ? 'active' : ''}`}
                onClick={() => setFilterMode('dark')}
              >
                Dark (8)
              </button>
              <button
                type="button"
                className={`pill-btn ${filterMode === 'light' ? 'active' : ''}`}
                onClick={() => setFilterMode('light')}
              >
                Light (7)
              </button>
            </div>
          </div>

          <div className="design-gallery-grid">
            {visibleThemes.map((item) => {
              const isSelected = item.id === currentDesign.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`design-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelectTheme(item.id)}
                  aria-pressed={isSelected}
                >
                  <div
                    className="design-card-preview"
                    style={{
                      background: item.swatch[0],
                      borderColor: item.swatch[2],
                    }}
                  >
                    <div
                      className="design-card-surface"
                      style={{ background: item.swatch[1] }}
                    >
                      <span
                        className="design-card-accent-bar"
                        style={{ background: item.swatch[2] }}
                      />
                      <span
                        className="design-card-accent-pill"
                        style={{ background: item.swatch[2] }}
                      />
                    </div>
                  </div>

                  <div className="design-card-body">
                    <div className="row-between" style={{ width: '100%' }}>
                      <div className="row" style={{ gap: '7px' }}>
                        <ThemeSwatchDots swatch={item.swatch} />
                        <span className="design-card-title">{item.name}</span>
                      </div>
                      <span className={`badge ${isSelected ? 'badge-accent' : ''}`}>
                        {isSelected ? '✓ Active' : item.mode}
                      </span>
                    </div>
                    <div className="design-card-desc">{item.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {subtab === 'byok' && (
        <div className="split-grid">
          <div className="card stack">
            <div className="card-header">
              <div className="card-title">Default AI Engine &amp; Models</div>
              <span className="badge badge-accent">
                {activeProviderMeta.shortLabel}
              </span>
            </div>

            <div className="subcard provider-hint-bar">
              <div style={{ fontWeight: 600, fontSize: '12.5px' }}>
                Private by default
              </div>
              <div className="muted" style={{ marginTop: '2px' }}>
                Keys, Precedent Library documents, Voice DNA samples, and draft
                history stay in local extension storage on your machine.
                Demo Sandbox and Local Ollama require no API key.
              </div>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="settings-provider-select">
                Active AI Provider
              </label>
              <select
                id="settings-provider-select"
                aria-label="Active AI Provider"
                className="select"
                value={state.provider}
                onChange={(e) =>
                  handleProviderChange(e.target.value as ProviderId)
                }
              >
                {PROVIDER_CATALOG.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <span className="muted">{activeProviderMeta.description}</span>
            </div>

            {state.provider !== 'ollama' ? (
              <div className="grid-2">
                <div className="field">
                  <label
                    className="field-label"
                    htmlFor="settings-primary-model"
                  >
                    Default Primary Model
                  </label>
                  <select
                    id="settings-primary-model"
                    aria-label="Default Primary Model"
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

                <div className="field">
                  <label
                    className="field-label"
                    htmlFor="settings-compare-model"
                  >
                    A/B Comparison Model (Model B)
                  </label>
                  <select
                    id="settings-compare-model"
                    aria-label="A/B Comparison Model"
                    className="select"
                    value={state.compareModel}
                    onChange={(e) =>
                      onUpdateState((prev) => ({
                        ...prev,
                        compareModel: e.target.value,
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
              </div>
            ) : (
              <div className="grid-2">
                <div className="field">
                  <label className="field-label" htmlFor="ollama-url-input">
                    Local Ollama Base URL
                  </label>
                  <input
                    id="ollama-url-input"
                    aria-label="Local Ollama Base URL"
                    type="text"
                    className="input mono"
                    value={state.apiKeys.ollamaUrl}
                    onChange={(e) =>
                      updateKeys({ ollamaUrl: e.target.value })
                    }
                    placeholder="http://127.0.0.1:11434"
                  />
                  {!ollamaLoopbackValid && (
                    <span style={{ color: 'var(--danger)', fontSize: '12px' }}>
                      Must be a loopback address (127.0.0.1 or localhost).
                    </span>
                  )}
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="ollama-model-input">
                    Ollama Model Tag
                  </label>
                  <input
                    id="ollama-model-input"
                    aria-label="Ollama Model Tag"
                    type="text"
                    className="input mono"
                    value={state.apiKeys.ollamaModel}
                    onChange={(e) =>
                      updateKeys({ ollamaModel: e.target.value })
                    }
                    placeholder="llama3.1:8b"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="card stack">
            <div className="card-header">
              <div className="card-title">Personal API Keys (Stored Locally)</div>
              <span className="badge">chrome.storage.local</span>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="key-openrouter">
                OpenRouter API Key (Recommended — All Models)
              </label>
              <input
                id="key-openrouter"
                aria-label="OpenRouter API Key"
                type="password"
                className="input mono"
                placeholder="sk-or-v1-..."
                value={state.apiKeys.openrouter}
                onChange={(e) => updateKeys({ openrouter: e.target.value })}
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="key-anthropic">
                Anthropic API Key (Direct Claude)
              </label>
              <input
                id="key-anthropic"
                aria-label="Anthropic API Key"
                type="password"
                className="input mono"
                placeholder="sk-ant-..."
                value={state.apiKeys.anthropic}
                onChange={(e) => updateKeys({ anthropic: e.target.value })}
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="key-openai">
                OpenAI API Key (Direct GPT-4.1 / GPT-4o)
              </label>
              <input
                id="key-openai"
                aria-label="OpenAI API Key"
                type="password"
                className="input mono"
                placeholder="sk-proj-..."
                value={state.apiKeys.openai}
                onChange={(e) => updateKeys({ openai: e.target.value })}
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="key-gemini">
                Google Gemini API Key (Direct Gemini 2.5)
              </label>
              <input
                id="key-gemini"
                aria-label="Google Gemini API Key"
                type="password"
                className="input mono"
                placeholder="AIzaSy..."
                value={state.apiKeys.gemini}
                onChange={(e) => updateKeys({ gemini: e.target.value })}
              />
            </div>

            <div className="row-between" style={{ paddingTop: '4px' }}>
              <span className="muted">
                Changes save automatically to local browser storage.
              </span>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => onNotify('Personal API key settings saved locally.')}
              >
                Save Keys
              </button>
            </div>
          </div>
        </div>
      )}

      {subtab === 'prefs' && (
        <div className="card stack">
          <div className="card-header">
            <div className="card-title">
              Extension Behavior &amp; Grounding Thresholds
            </div>
          </div>

          <div className="grid-2">
            <label className="subcard row-between" style={{ cursor: 'pointer' }}>
              <div>
                <div style={{ fontWeight: 600 }}>
                  Inline Webmail &ldquo;✦ Draft&rdquo; Button
                </div>
                <div className="muted">
                  Show floating ✦ Draft trigger inside Gmail, Outlook, and web
                  compose boxes.
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

            <label className="subcard row-between" style={{ cursor: 'pointer' }}>
              <div>
                <div style={{ fontWeight: 600 }}>
                  Auto-Capture Active Tab on Open
                </div>
                <div className="muted">
                  Automatically read email subject and thread context when
                  opening Popup or Side Panel.
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
          </div>

          <div className="grid-2">
            <div className="field">
              <label className="field-label" htmlFor="pref-max-precedents">
                Max Matched Precedents in Prompt (
                {state.preferences.maxPrecedentsInPrompt})
              </label>
              <input
                id="pref-max-precedents"
                type="range"
                min={1}
                max={8}
                className="range-slider"
                value={state.preferences.maxPrecedentsInPrompt}
                onChange={(e) =>
                  updatePrefs({
                    maxPrecedentsInPrompt: Number(e.target.value),
                  })
                }
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="pref-min-score">
                Minimum Precedent Match Score (
                {state.preferences.minPrecedentMatchScore}%)
              </label>
              <input
                id="pref-min-score"
                type="range"
                min={5}
                max={60}
                step={5}
                className="range-slider"
                value={state.preferences.minPrecedentMatchScore}
                onChange={(e) =>
                  updatePrefs({
                    minPrecedentMatchScore: Number(e.target.value),
                  })
                }
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
