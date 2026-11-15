import React, { useMemo, useState } from 'react';
import {
  analyzeWritingSamples,
  SAMPLE_CATEGORY_PRESETS,
  TONE_PRESETS,
  VOICE_INSTRUCTION_PRESETS,
  type VoiceProfile,
  type WritingSample,
} from '@drafter/shared';
import { parseUploadedDocument } from '../lib/storage.js';

interface VoiceStyleTabProps {
  voiceProfile: VoiceProfile;
  writingSamples: WritingSample[];
  onProfileChange: (next: VoiceProfile) => void;
  onSamplesChange: (next: WritingSample[]) => void;
  onDistillWithAi: () => void;
  onNotify: (msg: string) => void;
}

const SLIDER_LABELS = {
  formality: (v: number) => `Casual (${v}/5) Formal`,
  directness: (v: number) => `Diplomatic (${v}/5) Direct`,
  warmth: (v: number) => `Matter-of-fact (${v}/5) Warm`,
  conciseness: (v: number) => `Thorough (${v}/5) Ultra-brief`,
};

export const VoiceStyleTab: React.FC<VoiceStyleTabProps> = ({
  voiceProfile,
  writingSamples,
  onProfileChange,
  onSamplesChange,
  onDistillWithAi,
  onNotify,
}) => {
  const [selectedId, setSelectedId] = useState<string>(
    writingSamples[0]?.id ?? ''
  );

  const analysis = useMemo(
    () => analyzeWritingSamples(writingSamples),
    [writingSamples]
  );

  const selectedSample =
    writingSamples.find((s) => s.id === selectedId) ??
    writingSamples[0] ??
    null;

  const updateSelectedSample = (patch: Partial<WritingSample>) => {
    if (!selectedSample) return;
    onSamplesChange(
      writingSamples.map((s) =>
        s.id === selectedSample.id ? { ...s, ...patch } : s
      )
    );
  };

  const handlePasteNew = () => {
    const nextSample: WritingSample = {
      id: `voice-${Date.now()}`,
      title: 'New Essay or Writing Sample',
      contextTag: 'Essay / Article',
      voiceInstructions: '',
      content: '',
      active: true,
      createdAt: new Date().toISOString(),
    };
    onSamplesChange([nextSample, ...writingSamples]);
    setSelectedId(nextSample.id);
    onNotify('Added new essay / writing sample.');
  };

  const handleDeleteSample = () => {
    if (!selectedSample) return;
    const next = writingSamples.filter((s) => s.id !== selectedSample.id);
    onSamplesChange(next);
    setSelectedId(next[0]?.id ?? '');
    onNotify(`Removed "${selectedSample.title}".`);
  };

  const handleUploadSamples = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const added: WritingSample[] = [];
    for (const file of Array.from(files)) {
      try {
        const parsed = await parseUploadedDocument(file);
        added.push({
          id: `voice-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title: parsed.title || file.name,
          contextTag: 'Essay / Article',
          voiceInstructions:
            'Match the natural cadence, vocabulary, and paragraph flow from this uploaded piece.',
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
      onSamplesChange([...added, ...writingSamples]);
      setSelectedId(added[0].id);
      onNotify(`Uploaded ${added.length} essay/writing sample(s).`);
    }
  };

  return (
    <div className="stack">
      {/* Personal Voice Fingerprint */}
      <section className="card stack">
        <div className="row-between">
          <div className="card-title">
            <span>Personal Voice Fingerprint</span>
            <span className="badge badge-accent">
              {analysis.activeCount} active samples · {analysis.totalWords} words
            </span>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onDistillWithAi}
          >
            Distill Voice DNA with AI
          </button>
        </div>

        <div style={{ fontWeight: 600 }}>
          {voiceProfile.distilledSummary || analysis.summary}
        </div>

        <div className="row">
          <span className="badge">
            Avg Sentence: {analysis.avgSentenceLength} words
          </span>
          <span className="badge">
            Contractions: {analysis.contractionRate}%
          </span>
          <span className="badge">Questions: {analysis.questionRate}%</span>
          {analysis.commonOpenings.length > 0 && (
            <span className="badge badge-accent">
              Openings: {analysis.commonOpenings.join(', ')}
            </span>
          )}
          {analysis.commonClosings.length > 0 && (
            <span className="badge badge-accent">
              Closings: {analysis.commonClosings.join(', ')}
            </span>
          )}
        </div>
      </section>

      {/* Split Controls & Examples */}
      <div className="split-grid voice-grid">
        <section className="card stack">
          <div className="card-title">Voice Instructions &amp; Style Controls</div>

          <div className="grid-2">
            <div className="field">
              <label className="field-label" htmlFor="vp-name">
                Your Name (for sign-offs)
              </label>
              <input
                id="vp-name"
                className="input"
                value={voiceProfile.displayName}
                onChange={(e) =>
                  onProfileChange({
                    ...voiceProfile,
                    displayName: e.target.value,
                  })
                }
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="vp-role">
                Role / Context (optional)
              </label>
              <input
                id="vp-role"
                className="input"
                placeholder="e.g. Product Manager, Software Engineer, Writer, Student"
                value={voiceProfile.roleContext}
                onChange={(e) =>
                  onProfileChange({
                    ...voiceProfile,
                    roleContext: e.target.value,
                  })
                }
              />
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="vp-tone">
              Default Tone Preset
            </label>
            <select
              id="vp-tone"
              className="select"
              value={voiceProfile.defaultTonePreset}
              onChange={(e) =>
                onProfileChange({
                  ...voiceProfile,
                  defaultTonePreset: e.target.value,
                })
              }
            >
              {TONE_PRESETS.map((preset) => (
                <option key={preset} value={preset}>
                  {preset}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="vp-rules">
              Instructions on the Voice Used (Global Voice Rules)
            </label>
            <textarea
              id="vp-rules"
              className="textarea"
              aria-label="Global Voice Instructions"
              rows={3}
              placeholder="Describe how your voice should sound across day-to-day work, job applications, and essays..."
              value={voiceProfile.guidanceRules}
              onChange={(e) =>
                onProfileChange({
                  ...voiceProfile,
                  guidanceRules: e.target.value,
                })
              }
            />
            <div className="row" style={{ marginTop: '6px' }}>
              {VOICE_INSTRUCTION_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className="pill-btn"
                  onClick={() =>
                    onProfileChange({
                      ...voiceProfile,
                      guidanceRules: voiceProfile.guidanceRules.trim()
                        ? `${voiceProfile.guidanceRules.trim()}\n• ${preset}`
                        : preset,
                    })
                  }
                >
                  + {preset}
                </button>
              ))}
            </div>
          </div>

          <div className="subcard stack">
            <div className="field-label">Voice Dimensions</div>
            {(
              ['formality', 'directness', 'warmth', 'conciseness'] as const
            ).map((dim) => {
              const val = voiceProfile.dimensions[dim];
              const title = dim.charAt(0).toUpperCase() + dim.slice(1);
              return (
                <div key={dim} className="field">
                  <div className="row-between">
                    <span style={{ fontWeight: 700, fontSize: '12.5px' }}>
                      {title}
                    </span>
                    <span className="muted">{SLIDER_LABELS[dim](val)}</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    step={1}
                    className="range-slider"
                    aria-label={title}
                    value={val}
                    onChange={(e) =>
                      onProfileChange({
                        ...voiceProfile,
                        dimensions: {
                          ...voiceProfile.dimensions,
                          [dim]: Number(e.target.value),
                        },
                      })
                    }
                  />
                </div>
              );
            })}
          </div>

          <div className="grid-2">
            <div className="field">
              <label className="field-label" htmlFor="vp-greet">
                Preferred Greeting
              </label>
              <input
                id="vp-greet"
                className="input"
                value={voiceProfile.preferredGreeting}
                onChange={(e) =>
                  onProfileChange({
                    ...voiceProfile,
                    preferredGreeting: e.target.value,
                  })
                }
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="vp-signoff">
                Preferred Sign-Off
              </label>
              <textarea
                id="vp-signoff"
                className="textarea"
                rows={2}
                style={{ minHeight: '42px' }}
                value={voiceProfile.preferredSignOff}
                onChange={(e) =>
                  onProfileChange({
                    ...voiceProfile,
                    preferredSignOff: e.target.value,
                  })
                }
              />
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="vp-sig">
              Signature Block (optional)
            </label>
            <textarea
              id="vp-sig"
              className="textarea"
              rows={2}
              placeholder="Role, portfolio/LinkedIn link, phone..."
              value={voiceProfile.signatureBlock}
              onChange={(e) =>
                onProfileChange({
                  ...voiceProfile,
                  signatureBlock: e.target.value,
                })
              }
            />
          </div>
        </section>

        <section className="card stack">
          <div className="row-between">
            <div className="card-title">
              Uploaded Essays &amp; Writing Samples ({writingSamples.length})
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handlePasteNew}
            >
              + New Essay / Sample
            </button>
          </div>

          <div className="upload-zone stack">
            <div style={{ fontWeight: 700, fontSize: '12.5px' }}>
              Upload Essays, Cover Letters, Articles, or Work Notes
            </div>
            <div className="muted">
              Supports .txt, .md, .docx, .pdf, .eml, .html — automatically extracts your voice &amp; style
            </div>
            <input
              type="file"
              multiple
              accept=".txt,.md,.docx,.pdf,.eml,.html,.htm"
              aria-label="Upload Writing Examples"
              onChange={(e) => {
                const files = e.target.files;
                void handleUploadSamples(files).finally(() => {
                  e.target.value = '';
                });
              }}
            />
          </div>

          <div className="stack">
            {writingSamples.map((s) => (
              <div
                key={s.id}
                className={`list-item row-between ${selectedSample?.id === s.id ? 'selected' : ''}`}
                onClick={() => setSelectedId(s.id)}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{s.title}</div>
                  {s.voiceInstructions && (
                    <div className="muted" style={{ fontSize: '11.5px' }}>
                      Voice instruction: {s.voiceInstructions.slice(0, 80)}
                    </div>
                  )}
                  <div className="muted">
                    {s.content.replace(/\s+/g, ' ').slice(0, 74)}...
                  </div>
                </div>
                <span className="badge">{s.contextTag || 'General'}</span>
              </div>
            ))}
          </div>

          {selectedSample && (
            <div className="subcard stack">
              <div className="row-between">
                <div className="card-title">Edit Essay / Writing Sample</div>
                <div className="row">
                  <label className="row" style={{ cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selectedSample.active}
                      onChange={(e) =>
                        updateSelectedSample({ active: e.target.checked })
                      }
                    />
                    <span>Active</span>
                  </label>
                  <button
                    type="button"
                    className="btn btn-danger-link btn-sm"
                    onClick={handleDeleteSample}
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="grid-2">
                <div className="field">
                  <label className="field-label" htmlFor="sample-title">
                    Essay / Sample Title
                  </label>
                  <input
                    id="sample-title"
                    className="input"
                    value={selectedSample.title}
                    onChange={(e) =>
                      updateSelectedSample({ title: e.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="sample-tag">
                    Category / Context Tag
                  </label>
                  <input
                    id="sample-tag"
                    className="input"
                    value={selectedSample.contextTag}
                    onChange={(e) =>
                      updateSelectedSample({ contextTag: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="row">
                {SAMPLE_CATEGORY_PRESETS.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`pill-btn ${selectedSample.contextTag === cat ? 'active' : ''}`}
                    onClick={() => updateSelectedSample({ contextTag: cat })}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="field">
                <label
                  className="field-label"
                  htmlFor="sample-voice-instructions"
                >
                  Voice Instructions for This Essay / Sample (optional)
                </label>
                <input
                  id="sample-voice-instructions"
                  className="input"
                  aria-label="Sample Voice Instructions"
                  placeholder="e.g. Use the narrative hook and analytical rhythm from this essay, while keeping sentences crisp..."
                  value={selectedSample.voiceInstructions ?? ''}
                  onChange={(e) =>
                    updateSelectedSample({ voiceInstructions: e.target.value })
                  }
                />
              </div>

              <div className="field">
                <label className="field-label" htmlFor="sample-body">
                  Essay or Writing Sample Content
                </label>
                <textarea
                  id="sample-body"
                  className="textarea"
                  rows={8}
                  placeholder="Paste your essay, cover letter, article, or work note here..."
                  value={selectedSample.content}
                  onChange={(e) =>
                    updateSelectedSample({ content: e.target.value })
                  }
                />
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
