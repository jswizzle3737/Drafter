import React, { useMemo, useRef, useState } from 'react';
import {
  analyzePageForDraftSuggestions,
  compileDraftPrompt,
  computeLineDiff,
  getModelsForProvider,
  INTENT_PRESETS,
  isLoopbackHostname,
  PROVIDER_CATALOG,
  REFINEMENT_CHIPS,
  TONE_PRESETS,
  VOICE_INSTRUCTION_PRESETS,
  type DraftIntent,
  type DraftSuggestion,
  type DraftVersion,
  type PageContext,
  type PrecedentDocument,
  type ProviderId,
  type WritingSample,
} from '@drafter/shared';
import { parseUploadedDocument, type DrafterAppState } from '../lib/storage.js';
import type { StudioTabId } from './Header.js';

interface DraftStudioTabProps {
  state: DrafterAppState;
  intent: DraftIntent;
  instruction: string;
  voiceToneOverride: string;
  customVoiceInstruction: string;
  pinnedIds: string[];
  excludedIds: string[];
  versions: DraftVersion[];
  activeVersionIndex: number;
  abCompare: boolean;
  isGenerating: boolean;
  onIntentChange: (intent: DraftIntent) => void;
  onInstructionChange: (val: string) => void;
  onVoiceToneOverrideChange: (val: string) => void;
  onCustomVoiceInstructionChange: (val: string) => void;
  onSamplesChange: (next: WritingSample[]) => void;
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
  onOllamaModelChange: (m: string) => void;
  onOllamaUrlChange: (url: string) => void;
  onAbCompareChange: (val: boolean) => void;
  onGenerate: () => void;
  onDraftSuggestion: (suggestion: DraftSuggestion) => void;
  onIterate: (refinement: string) => void;
  onSelectVersion: (idx: number) => void;
  onInsertIntoTab: (subject: string, body: string) => void;
  onNavigateTab: (tab: StudioTabId) => void;
  onOpenModelsSubtab: (sub: 'byok' | 'account') => void;
  onNotify: (msg: string) => void;
}

export const DraftStudioTab: React.FC<DraftStudioTabProps> = ({
  state,
  intent,
  instruction,
  voiceToneOverride,
  customVoiceInstruction,
  pinnedIds,
  excludedIds,
  versions,
  activeVersionIndex,
  abCompare,
  isGenerating,
  onIntentChange,
  onInstructionChange,
  onVoiceToneOverrideChange,
  onCustomVoiceInstructionChange,
  onSamplesChange,
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
  onOllamaModelChange,
  onOllamaUrlChange,
  onAbCompareChange,
  onGenerate,
  onDraftSuggestion,
  onIterate,
  onSelectVersion,
  onInsertIntoTab,
  onNavigateTab,
  onOpenModelsSubtab,
  onNotify,
}) => {
  const [contextCollapsed, setContextCollapsed] = useState(false);
  const [viewMode, setViewMode] = useState<'rendered' | 'source' | 'diff'>(
    'rendered'
  );
  const [refinementInput, setRefinementInput] = useState('');
  const [promptExpanded, setPromptExpanded] = useState(false);
  const essayFileInputRef = useRef<HTMLInputElement | null>(null);

  const activeVersion = versions[activeVersionIndex] ?? null;
  const previousVersion =
    activeVersionIndex > 0 ? versions[activeVersionIndex - 1] : null;
  const eligibleModels = getModelsForProvider(state.provider);

  const missingProviderNotice = useMemo((): {
    tone: 'info' | 'warn';
    message: string;
    targetSubtab: 'byok' | 'account';
    ctaLabel: string;
  } | null => {
    if (state.provider === 'sandbox' || state.provider === 'managed') {
      return {
        tone: 'info',
        message:
          'Demo Sandbox is active — test voice- and reference-grounded drafting offline without an API key.',
        targetSubtab: 'byok',
        ctaLabel: 'Configure API Key',
      };
    }
    if (state.provider === 'ollama') {
      if (!isLoopbackHostname(state.apiKeys.ollamaUrl)) {
        return {
          tone: 'warn',
          message: 'Ollama URL must target localhost or 127.0.0.1.',
          targetSubtab: 'byok',
          ctaLabel: 'Fix Endpoint',
        };
      }
      return null;
    }
    const keyMap: Record<
      'openrouter' | 'openai' | 'anthropic' | 'gemini',
      { value: string; label: string }
    > = {
      openrouter: { value: state.apiKeys.openrouter, label: 'OpenRouter' },
      openai: { value: state.apiKeys.openai, label: 'OpenAI' },
      anthropic: { value: state.apiKeys.anthropic, label: 'Anthropic' },
      gemini: { value: state.apiKeys.gemini, label: 'Google Gemini' },
    };
    const cfg = keyMap[state.provider];
    if (cfg && !cfg.value.trim()) {
      return {
        tone: 'warn',
        message: `Add your ${cfg.label} API key under Settings & Themes, or switch to Demo Sandbox.`,
        targetSubtab: 'byok',
        ctaLabel: 'Add API Key',
      };
    }
    return null;
  }, [state.provider, state.apiKeys]);


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
        customVoiceInstruction,
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
      customVoiceInstruction,
      activeVersion?.rawText,
      refinementInput,
      state.preferences,
    ]
  );

  const handleQuickUploadEssays = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const added: WritingSample[] = [];
    for (const file of Array.from(files)) {
      try {
        const parsed = await parseUploadedDocument(file);
        added.push({
          id: `voice-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title: parsed.title || file.name,
          contextTag: 'Essay / Article',
          voiceInstructions: customVoiceInstruction.trim() || undefined,
          content: parsed.content,
          active: true,
          createdAt: new Date().toISOString(),
        });
      } catch (err) {
        onNotify(
          `Could not read ${file.name}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
    if (added.length > 0) {
      onSamplesChange([...added, ...state.writingSamples]);
      onNotify(
        `Uploaded ${added.length} essay/writing sample(s) into your active Voice DNA.`
      );
    }
  };

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

  const pageAnalysis = useMemo(
    () => analyzePageForDraftSuggestions(state.capturedContext),
    [state.capturedContext]
  );

  return (
    <div className="split-grid">
      {/* Left Column: Inputs & Controls */}
      <div className="stack">
        {/* Context & Briefing */}
        <section className="card stack">
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

          {/* Page-Aware Document Offers */}
          <div className="subcard stack">
            <div className="row-between">
              <div className="row" style={{ gap: '8px' }}>
                <span style={{ fontWeight: 700, fontSize: '12.5px' }}>
                  Suggested Documents for This Page
                </span>
                <span className="badge badge-accent">
                  {pageAnalysis.pageBadge}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-sm"
                onClick={onCaptureTab}
              >
                Re-read Page
              </button>
            </div>
            <div className="muted" style={{ fontSize: '12px' }}>
              {pageAnalysis.summaryLine}
            </div>
            {pageAnalysis.suggestions.length > 0 && (
              <div className="stack" style={{ gap: '6px' }}>
                {pageAnalysis.suggestions.map((sug) => (
                  <div
                    key={sug.id}
                    className="list-item row-between"
                    style={{ cursor: 'pointer', gap: '10px' }}
                    onClick={() => !isGenerating && onDraftSuggestion(sug)}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '12.5px' }}>
                        {sug.label}
                      </div>
                      <div className="muted" style={{ fontSize: '11.5px' }}>
                        {sug.description}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={isGenerating}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDraftSuggestion(sug);
                      }}
                    >
                      Draft This →
                    </button>
                  </div>
                ))}
              </div>
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
              {TONE_PRESETS.filter((t) => t !== 'Default Personal Voice').map(
                (t) => (
                  <option key={t} value={t}>
                    Voice: {t}
                  </option>
                )
              )}
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
            placeholder="e.g. Write a cover letter for the Product Engineer role, draft an essay on remote collaboration, or send a quick project update to the team..."
            value={instruction}
            onChange={(e) => onInstructionChange(e.target.value)}
          />

          <div className="subcard stack">
            <div className="row-between">
              <label
                className="field-label"
                htmlFor="studio-voice-instructions"
                style={{ margin: 0 }}
              >
                Voice Instructions (how the voice should sound)
              </label>
              {customVoiceInstruction && (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => onCustomVoiceInstructionChange('')}
                >
                  Clear
                </button>
              )}
            </div>
            <input
              id="studio-voice-instructions"
              className="input"
              aria-label="Voice Instructions"
              placeholder="e.g. Match my uploaded essays — thoughtful, conversational, zero AI clichés, and concrete examples..."
              value={customVoiceInstruction}
              onChange={(e) => onCustomVoiceInstructionChange(e.target.value)}
            />
            <div className="row">
              {VOICE_INSTRUCTION_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`pill-btn ${customVoiceInstruction === preset ? 'active' : ''}`}
                  onClick={() => onCustomVoiceInstructionChange(preset)}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Matched Precedents & Playbooks */}
        <section className="card stack">
          <div className="row-between">
            <div className="card-title">
              Matched Reference Playbooks &amp; Precedents ({compiled.appliedPrecedents.length})
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
              No reference playbook matched yet. Add details to your instruction or
              pin a guide from your library.
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

        {/* Voice DNA & Uploaded Essays */}
        <section className="card stack">
          <div className="row-between">
            <div className="card-title">
              Voice DNA &amp; Essays ({compiled.attachedVoiceSamples.length} examples attached)
            </div>
            <div className="row">
              <input
                ref={essayFileInputRef}
                type="file"
                multiple
                accept=".txt,.md,.docx,.pdf,.eml,.html,.htm"
                aria-label="Quick Upload Essay"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const files = e.target.files;
                  void handleQuickUploadEssays(files).finally(() => {
                    e.target.value = '';
                  });
                }}
              />
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => essayFileInputRef.current?.click()}
              >
                + Upload Essay / Sample
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => onNavigateTab('voice')}
              >
                Edit Voice
              </button>
            </div>
          </div>
          <div className="muted">{compiled.voiceAnalysis.summary}</div>
          <div className="row">
            {compiled.attachedVoiceSamples.map((s) => (
              <span key={s.id} className="badge" title={s.voiceInstructions || s.title}>
                {s.title} ({s.contextTag || 'General'})
                {s.voiceInstructions ? ' · ★ Voice Rules' : ''}
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
            {state.provider === 'ollama' ? (
              <input
                className="input mono"
                aria-label="Drafting Model"
                placeholder="llama3.1:8b"
                value={state.apiKeys.ollamaModel}
                onChange={(e) => onOllamaModelChange(e.target.value)}
              />
            ) : (
              <select
                className="select"
                aria-label="Drafting Model"
                value={state.model}
                onChange={(e) => onModelChange(e.target.value)}
              >
                {eligibleModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          {state.provider === 'ollama' && (
            <div className="field">
              <label className="field-label" htmlFor="studio-ollama-url">
                Local Ollama Base URL
              </label>
              <input
                id="studio-ollama-url"
                className="input mono"
                value={state.apiKeys.ollamaUrl}
                onChange={(e) => onOllamaUrlChange(e.target.value)}
              />
            </div>
          )}

          {eligibleModels.length > 1 && (
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
                  {eligibleModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      Compare: {m.shortLabel}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {missingProviderNotice && (
            <div
              className={`subcard row-between provider-hint-bar ${missingProviderNotice.tone === 'warn' ? 'warn' : ''}`}
            >
              <span className="muted" style={{ flex: 1 }}>
                {missingProviderNotice.message}
              </span>
              <div className="row">
                {state.provider !== 'sandbox' && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => onProviderChange('sandbox')}
                  >
                    Use Demo Sandbox
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() =>
                    onOpenModelsSubtab(missingProviderNotice.targetSubtab)
                  }
                >
                  {missingProviderNotice.ctaLabel}
                </button>
              </div>
            </div>
          )}

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
