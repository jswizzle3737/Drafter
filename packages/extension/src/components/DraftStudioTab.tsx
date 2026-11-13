import React, { useMemo, useState } from 'react';
import {
  compileDraftPrompt,
  computeLineDiff,
  INTENT_PRESETS,
  MODEL_CATALOG,
  PROVIDER_CATALOG,
  REFINEMENT_CHIPS,
  TONE_PRESETS,
  type DraftIntent,
  type DraftVersion,
  type PageContext,
  type PrecedentDocument,
  type ProviderId,
} from '@drafter/shared';
import type { DrafterAppState } from '../lib/storage.js';
import type { StudioTabId } from './Header.js';

interface DraftStudioTabProps {
  state: DrafterAppState;
  intent: DraftIntent;
  instruction: string;
  voiceToneOverride: string;
  pinnedIds: string[];
  excludedIds: string[];
  versions: DraftVersion[];
  activeVersionIndex: number;
  abCompare: boolean;
  isGenerating: boolean;
  onIntentChange: (intent: DraftIntent) => void;
  onInstructionChange: (val: string) => void;
  onVoiceToneOverrideChange: (val: string) => void;
  onContextChange: (ctx: PageContext) => void;
  onCaptureTab: () => void;
  onNewDraft: () => void;
  onTogglePin: (id: string) => void;
  onExcludePrecedent: (id: string) => void;
  onRestoreExcluded: (id: string) => void;
  onInspectPrecedent: (doc: PrecedentDocument) => void;
  onProviderChange: (p: ProviderId) => void;
  onModelChange: (m: string) => void;
  onCompareModelChange: (m: string) => void;
  onAbCompareChange: (val: boolean) => void;
  onGenerate: () => void;
  onIterate: (refinement: string) => void;
  onSelectVersion: (idx: number) => void;
  onInsertIntoTab: (subject: string, body: string) => void;
  onNavigateTab: (tab: StudioTabId) => void;
  onNotify: (msg: string) => void;
}

export const DraftStudioTab: React.FC<DraftStudioTabProps> = ({
  state,
  intent,
  instruction,
  voiceToneOverride,
  pinnedIds,
  excludedIds,
  versions,
  activeVersionIndex,
  abCompare,
  isGenerating,
  onIntentChange,
  onInstructionChange,
  onVoiceToneOverrideChange,
  onContextChange,
  onCaptureTab,
  onNewDraft,
  onTogglePin,
  onExcludePrecedent,
  onRestoreExcluded,
  onInspectPrecedent,
  onProviderChange,
  onModelChange,
  onCompareModelChange,
  onAbCompareChange,
  onGenerate,
  onIterate,
  onSelectVersion,
  onInsertIntoTab,
  onNavigateTab,
  onNotify,
}) => {
  const [contextCollapsed, setContextCollapsed] = useState(false);
  const [viewMode, setViewMode] = useState<'rendered' | 'source' | 'diff'>(
    'rendered'
  );
  const [refinementInput, setRefinementInput] = useState('');
  const [promptExpanded, setPromptExpanded] = useState(false);

  const activeVersion = versions[activeVersionIndex] ?? null;
  const previousVersion =
    activeVersionIndex > 0 ? versions[activeVersionIndex - 1] : null;

  const compiled = useMemo(
    () =>
      compileDraftPrompt({
        context: state.capturedContext,
        intent,
        instruction,
        precedents: state.precedents,
        pinnedPrecedentIds: pinnedIds,
        excludedPrecedentIds: excludedIds,
        writingSamples: state.writingSamples,
        voiceProfile: state.voiceProfile,
        voiceToneOverride,
        previousDraft: activeVersion?.rawText,
        refinementInstruction: refinementInput || undefined,
        maxPrecedents: state.preferences.maxPrecedentsInPrompt,
        minPrecedentScore: state.preferences.minPrecedentMatchScore,
        maxVoiceSamples: state.preferences.maxVoiceExamplesInPrompt,
      }),
    [
      state.capturedContext,
      intent,
      instruction,
      state.precedents,
      pinnedIds,
      excludedIds,
      state.writingSamples,
      state.voiceProfile,
      voiceToneOverride,
      activeVersion?.rawText,
      refinementInput,
      state.preferences,
    ]
  );

  const diffLines = useMemo(() => {
    if (!activeVersion) return [];
    const oldText = previousVersion?.rawText ?? activeVersion.rawText;
    return computeLineDiff(oldText, activeVersion.rawText);
  }, [activeVersion, previousVersion]);

  const excludedDocs = state.precedents.filter((p) =>
    excludedIds.includes(p.id)
  );

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      onNotify(`${label} copied to clipboard.`);
    } catch {
      onNotify('Unable to write to clipboard.');
    }
  };

  const handleRunIterate = (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setRefinementInput('');
    onIterate(clean);
  };

  return (
    <div className="split-grid">
      {/* Left Column: Inputs & Controls */}
      <div className="stack">
        {/* Context & Briefing */}
        <section className="card">
          <div className="card-header">
            <div className="card-title">
              <span>Context &amp; Briefing</span>
              <span className="badge badge-accent">
                {state.capturedContext.kind === 'email' ? 'EMAIL' : 'PAGE'}
              </span>
            </div>
            <div className="row">
              <button
                type="button"
                className="btn btn-sm"
                onClick={onCaptureTab}
              >
                Capture Tab
              </button>
              <button type="button" className="btn btn-sm" onClick={onNewDraft}>
                New Draft
              </button>
            </div>
          </div>

          <div className="subcard stack">
            <div className="row-between">
              <span style={{ fontWeight: 700, fontSize: '13px' }}>
                {state.capturedContext.kind === 'email' ? 'Email: ' : 'Page: '}
                {state.capturedContext.subject ||
                  state.capturedContext.title ||
                  'Manual Context'}
              </span>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setContextCollapsed((c) => !c)}
              >
                {contextCollapsed ? 'Expand' : 'Collapse'}
              </button>
            </div>

            {!contextCollapsed && (
              <>
                <div className="grid-2">
                  <input
                    className="input"
                    aria-label="Context Subject"
                    placeholder="Subject or topic..."
                    value={state.capturedContext.subject}
                    onChange={(e) =>
                      onContextChange({
                        ...state.capturedContext,
                        subject: e.target.value,
                      })
                    }
                  />
                  <input
                    className="input"
                    aria-label="Context Recipient"
                    placeholder="Recipient or counterparty..."
                    value={state.capturedContext.recipient}
                    onChange={(e) =>
                      onContextChange({
                        ...state.capturedContext,
                        recipient: e.target.value,
                      })
                    }
                  />
                </div>
                <textarea
                  className="textarea"
                  aria-label="Context Body"
                  rows={3}
                  placeholder="Paste incoming email thread, message, or briefing notes..."
                  value={state.capturedContext.threadText}
                  onChange={(e) =>
                    onContextChange({
                      ...state.capturedContext,
                      threadText: e.target.value,
                    })
                  }
                />
                <div className="row-between">
                  <span className="muted">
                    {state.capturedContext.hostname || 'Manual input'}
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() =>
                      onContextChange({
                        kind: 'webpage',
                        title: '',
                        subject: '',
                        recipient: '',
                        threadText: '',
                        url: '',
                        hostname: '',
                        capturedAt: new Date().toISOString(),
                      })
                    }
                  >
                    Clear Context
                  </button>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Intent & Instruction */}
        <section className="card stack">
          <div className="row-between">
            <div className="card-title">What do you want to draft?</div>
            <select
              className="select"
              style={{ width: 'auto', padding: '5px 10px' }}
              aria-label="Voice Tone Override"
              value={voiceToneOverride}
              onChange={(e) => onVoiceToneOverrideChange(e.target.value)}
            >
              <option value="Personal Default">Voice: Personal Default</option>
              {TONE_PRESETS.map((t) => (
                <option key={t} value={t}>
                  Voice: {t}
                </option>
              ))}
            </select>
          </div>

          <div className="row">
            {INTENT_PRESETS.map((item) => (
              <button
                key={item}
                type="button"
                className={`pill-btn ${intent === item ? 'active' : ''}`}
                onClick={() => onIntentChange(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <textarea
            className="textarea"
            aria-label="Drafting Instruction"
            rows={3}
            placeholder="e.g. Reply to Sarah declining the 25% discount request, offer 10% for a 24-month upfront renewal, and propose a Thursday call."
            value={instruction}
            onChange={(e) => onInstructionChange(e.target.value)}
          />
        </section>

        {/* Matched Precedents */}
        <section className="card stack">
          <div className="row-between">
            <div className="card-title">
              Matched Precedents ({compiled.appliedPrecedents.length})
            </div>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => onNavigateTab('precedents')}
            >
              Manage Library
            </button>
          </div>

          {compiled.appliedPrecedents.length === 0 ? (
            <div className="muted">
              No strong precedent match yet. Add details to your instruction or
              pin a precedent from your library.
            </div>
          ) : (
            <div className="stack">
              {compiled.appliedPrecedents.map((item) => {
                const isPinned =
                  item.document.pinned || pinnedIds.includes(item.document.id);
                return (
                  <div key={item.document.id} className="subcard stack">
                    <div className="row-between">
                      <div className="row" style={{ flex: 1, minWidth: 0 }}>
                        <span className="badge badge-accent">
                          {item.score}% match
                        </span>
                        <span style={{ fontWeight: 700 }}>
                          {item.document.title}
                        </span>
                      </div>
                      <div className="row">
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => onInspectPrecedent(item.document)}
                        >
                          Inspect
                        </button>
                        <button
                          type="button"
                          className={`btn btn-sm ${isPinned ? 'btn-primary' : ''}`}
                          onClick={() => onTogglePin(item.document.id)}
                        >
                          {isPinned ? 'Pinned' : 'Pin'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger-link btn-sm"
                          onClick={() => onExcludePrecedent(item.document.id)}
                        >
                          Exclude
                        </button>
                      </div>
                    </div>
                    <div className="muted">
                      Tags:{' '}
                      {item.document.tags.slice(0, 3).join(', ') || 'none'}
                      {item.matchedTerms.length > 0
                        ? ` · Matched terms: ${item.matchedTerms.join(', ')}`
                        : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {excludedDocs.length > 0 && (
            <div className="row">
              <span className="muted">Excluded:</span>
              {excludedDocs.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className="pill-btn"
                  onClick={() => onRestoreExcluded(d.id)}
                >
                  Restore {d.title}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Voice DNA */}
        <section className="card stack">
          <div className="row-between">
            <div className="card-title">
              Voice DNA ({compiled.attachedVoiceSamples.length} examples attached)
            </div>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => onNavigateTab('voice')}
            >
              Edit Voice
            </button>
          </div>
          <div className="muted">{compiled.voiceAnalysis.summary}</div>
          <div className="row">
            {compiled.attachedVoiceSamples.map((s) => (
              <span key={s.id} className="badge">
                {s.title} ({s.contextTag || 'General'})
              </span>
            ))}
          </div>
        </section>

        {/* Provider / Model & Generate CTA */}
        <section className="card stack">
          <div className="grid-2">
            <select
              className="select"
              aria-label="Drafting Provider"
              value={state.provider}
              onChange={(e) => onProviderChange(e.target.value as ProviderId)}
            >
              {PROVIDER_CATALOG.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <select
              className="select"
              aria-label="Drafting Model"
              value={state.model}
              onChange={(e) => onModelChange(e.target.value)}
            >
              {MODEL_CATALOG.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="row-between">
            <label className="row" style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={abCompare}
                onChange={(e) => onAbCompareChange(e.target.checked)}
              />
              <span>A/B Compare</span>
            </label>
            {abCompare && (
              <select
                className="select"
                style={{ width: 'auto', minWidth: '220px' }}
                aria-label="Comparison Model B"
                value={state.compareModel}
                onChange={(e) => onCompareModelChange(e.target.value)}
              >
                {MODEL_CATALOG.map((m) => (
                  <option key={m.id} value={m.id}>
                    Compare: {m.shortLabel}
                  </option>
                ))}
              </select>
            )}
          </div>

          <button
            type="button"
            className="btn btn-primary btn-lg"
            disabled={isGenerating}
            onClick={onGenerate}
          >
            {isGenerating ? 'Drafting...' : 'Generate Fresh Draft'}
          </button>
        </section>
      </div>

      {/* Right Column: Draft Workspace */}
      <div className="stack">
        <section className="card stack">
          <div className="row-between">
            <div className="row">
              <div className="card-title">Draft Workspace</div>
              {versions.map((v, idx) => (
                <button
                  key={v.version}
                  type="button"
                  className={`pill-btn ${idx === activeVersionIndex ? 'active' : ''}`}
                  onClick={() => onSelectVersion(idx)}
                >
                  V{v.version}
                </button>
              ))}
            </div>

            <div className="row">
              <div className="nav-pills">
                <button
                  type="button"
                  className={`nav-pill ${viewMode === 'rendered' ? 'active' : ''}`}
                  onClick={() => setViewMode('rendered')}
                >
                  Rendered
                </button>
                <button
                  type="button"
                  className={`nav-pill ${viewMode === 'source' ? 'active' : ''}`}
                  onClick={() => setViewMode('source')}
                >
                  Source
                </button>
                <button
                  type="button"
                  className={`nav-pill ${viewMode === 'diff' ? 'active' : ''}`}
                  onClick={() => setViewMode('diff')}
                >
                  Diff
                </button>
              </div>
              <button
                type="button"
                className="btn btn-sm"
                disabled={!activeVersion}
                onClick={() =>
                  activeVersion &&
                  handleCopy(activeVersion.body, 'Draft body')
                }
              >
                Copy
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={!activeVersion}
                onClick={() =>
                  activeVersion &&
                  onInsertIntoTab(activeVersion.subject, activeVersion.body)
                }
              >
                Insert into Tab
              </button>
            </div>
          </div>

          {!activeVersion ? (
            <div className="subcard stack" style={{ padding: '26px 18px' }}>
              <div style={{ fontWeight: 700, fontSize: '15px' }}>
                Ready to draft in your voice
              </div>
              <div className="muted">
                Capture context from your active tab or enter instructions on
                the left, review matched precedents, and click{' '}
                <strong>Generate Fresh Draft</strong>.
              </div>
            </div>
          ) : (
            <>
              <div className="subcard row-between">
                <div>
                  <div className="muted">Suggested Subject</div>
                  <div style={{ fontWeight: 700 }}>
                    {activeVersion.subject || '(No subject line)'}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={!activeVersion.subject}
                  onClick={() =>
                    handleCopy(activeVersion.subject, 'Suggested subject')
                  }
                >
                  Copy Subject
                </button>
              </div>

              {viewMode === 'rendered' && (
                <div className="draft-body-box">{activeVersion.body}</div>
              )}

              {viewMode === 'source' && (
                <pre className="draft-body-box draft-source-box">
                  {activeVersion.rawText}
                </pre>
              )}

              {viewMode === 'diff' && (
                <div className="diff-box">
                  <div className="diff-header">
                    Comparing{' '}
                    {previousVersion
                      ? `V${previousVersion.version} → V${activeVersion.version}`
                      : `V${activeVersion.version} (initial)`}
                  </div>
                  {diffLines.map((line, idx) => (
                    <div key={idx} className={`diff-line ${line.type}`}>
                      {line.type === 'removed'
                        ? `- ${line.text}`
                        : line.type === 'added'
                          ? `+ ${line.text}`
                          : `  ${line.text}`}
                    </div>
                  ))}
                </div>
              )}

              {activeVersion.compareVariant && (
                <div className="subcard stack">
                  <div className="row-between">
                    <span className="badge badge-accent">
                      Model B · {activeVersion.compareVariant.model}
                    </span>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() =>
                        onInsertIntoTab(
                          activeVersion.compareVariant!.subject,
                          activeVersion.compareVariant!.body
                        )
                      }
                    >
                      Insert Model B
                    </button>
                  </div>
                  <div className="draft-body-box">
                    {activeVersion.compareVariant.body}
                  </div>
                </div>
              )}

              <div className="row">
                <span className="badge">{activeVersion.providerLabel}</span>
                <span className="badge">{activeVersion.model}</span>
                <span className="badge">{activeVersion.latencyMs}ms</span>
                <span className="badge">{activeVersion.totalTokens} tokens</span>
              </div>

              {activeVersion.appliedPrecedents.length > 0 && (
                <div className="muted">
                  Precedents applied:{' '}
                  {activeVersion.appliedPrecedents
                    .map((p) => `${p.title} (${p.score}%)`)
                    .join(', ')}
                </div>
              )}

              <div className="subcard stack">
                <div style={{ fontWeight: 700, fontSize: '13px' }}>
                  Iterate &amp; Refine (creates V{versions.length + 1})
                </div>
                <div className="row">
                  {REFINEMENT_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      className="pill-btn"
                      disabled={isGenerating}
                      onClick={() => handleRunIterate(chip)}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
                <div className="row" style={{ flexWrap: 'nowrap' }}>
                  <input
                    className="input"
                    aria-label="Custom refinement instruction"
                    placeholder="Custom refinement instruction (e.g. Mention Nov 18 cutover and add bulleted next steps)"
                    value={refinementInput}
                    onChange={(e) => setRefinementInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && refinementInput.trim()) {
                        handleRunIterate(refinementInput);
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={isGenerating || !refinementInput.trim()}
                    onClick={() => handleRunIterate(refinementInput)}
                  >
                    Iterate
                  </button>
                </div>
              </div>
            </>
          )}

          <div>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setPromptExpanded((v) => !v)}
            >
              Inspect Actual Compiled Prompt {promptExpanded ? '▲' : '▼'}
            </button>
            {promptExpanded && (
              <pre className="prompt-pre" style={{ marginTop: '10px' }}>
                {compiled.fullText}
              </pre>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
