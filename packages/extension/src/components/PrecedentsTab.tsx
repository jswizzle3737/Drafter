import React, { useMemo, useState } from 'react';
import { rankPrecedents, type PrecedentDocument } from '@drafter/shared';
import { parseUploadedDocument } from '../lib/storage.js';

interface PrecedentsTabProps {
  precedents: PrecedentDocument[];
  onChange: (next: PrecedentDocument[]) => void;
  onNotify: (msg: string) => void;
}

export const PrecedentsTab: React.FC<PrecedentsTabProps> = ({
  precedents,
  onChange,
  onNotify,
}) => {
  const [radarQuery, setRadarQuery] = useState(
    'Customer asking for a 20% discount on our annual SaaS renewal'
  );
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>(
    precedents[0]?.id ?? ''
  );

  const activeCount = precedents.filter((p) => p.enabled).length;

  const radarMatches = useMemo(() => {
    if (!radarQuery.trim()) return [];
    return rankPrecedents(precedents, radarQuery, { limit: 4 });
  }, [precedents, radarQuery]);

  const filteredList = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return precedents;
    return precedents.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q)) ||
        p.body.toLowerCase().includes(q)
    );
  }, [precedents, filterQuery]);

  const selectedDoc =
    precedents.find((p) => p.id === selectedId) ?? precedents[0] ?? null;

  const updateSelected = (patch: Partial<PrecedentDocument>) => {
    if (!selectedDoc) return;
    onChange(
      precedents.map((p) =>
        p.id === selectedDoc.id
          ? { ...p, ...patch, updatedAt: new Date().toISOString() }
          : p
      )
    );
  };

  const handleCreateNew = () => {
    const doc: PrecedentDocument = {
      id: `prec-${Date.now()}`,
      title: 'New Precedent Policy',
      category: 'General',
      tags: ['policy'],
      whenToUse: '',
      guidance: '',
      body: '',
      enabled: true,
      pinned: false,
      updatedAt: new Date().toISOString(),
    };
    onChange([doc, ...precedents]);
    setSelectedId(doc.id);
    onNotify('Created new precedent.');
  };

  const handleDeleteSelected = () => {
    if (!selectedDoc) return;
    const next = precedents.filter((p) => p.id !== selectedDoc.id);
    onChange(next);
    setSelectedId(next[0]?.id ?? '');
    onNotify(`Deleted "${selectedDoc.title}".`);
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const added: PrecedentDocument[] = [];
    for (const file of Array.from(files)) {
      try {
        const parsed = await parseUploadedDocument(file);
        added.push({
          id: `prec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title: parsed.title || file.name,
          category: 'Uploaded Document',
          tags: file.name
            .toLowerCase()
            .replace(/\.[^.]+$/, '')
            .split(/[^a-z0-9]+/)
            .filter((w) => w.length >= 3)
            .slice(0, 5),
          whenToUse: '',
          guidance: '',
          body: parsed.content,
          enabled: true,
          pinned: false,
          updatedAt: new Date().toISOString(),
        });
      } catch (err) {
        onNotify(
          `Failed to parse ${file.name}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
    if (added.length > 0) {
      onChange([...added, ...precedents]);
      setSelectedId(added[0].id);
      onNotify(`Imported ${added.length} precedent document(s).`);
    }
  };

  return (
    <div className="stack">
      {/* Precedent Similarity Radar */}
      <section className="card stack">
        <div className="row-between">
          <div className="card-title">
            <span>Precedent Similarity Radar</span>
            <span className="badge badge-accent">{activeCount} active</span>
          </div>
          <span className="muted">
            Test which precedents the AI takes note of for any drafting job
          </span>
        </div>

        <input
          className="input"
          aria-label="Precedent Similarity Radar Query"
          placeholder="Type any scenario or incoming email summary to test similarity matching..."
          value={radarQuery}
          onChange={(e) => setRadarQuery(e.target.value)}
        />

        <div className="row">
          {radarMatches.length === 0 ? (
            <span className="muted">No active precedents matched this query.</span>
          ) : (
            radarMatches.map((m) => (
              <button
                key={m.document.id}
                type="button"
                className="pill-btn active"
                onClick={() => setSelectedId(m.document.id)}
              >
                {m.score}% · {m.document.title}
              </button>
            ))
          )}
        </div>
      </section>

      {/* Library + Editor Split */}
      <div className="split-grid precedent-grid">
        <section className="card stack">
          <div className="row-between">
            <div className="card-title">Precedent Library</div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleCreateNew}
            >
              + New
            </button>
          </div>

          <div className="upload-zone stack">
            <div style={{ fontWeight: 700, fontSize: '12.5px' }}>
              Upload Precedent Documents
            </div>
            <div className="muted">
              Supports .txt, .md, .docx, .pdf, .html, .eml, .json, .csv
            </div>
            <input
              type="file"
              multiple
              accept=".txt,.md,.docx,.pdf,.html,.htm,.eml,.json,.csv"
              aria-label="Upload Precedent Documents"
              onChange={(e) => {
                const files = e.target.files;
                void handleFileUpload(files).finally(() => {
                  e.target.value = '';
                });
              }}
            />
          </div>

          <input
            className="input"
            aria-label="Filter precedents"
            placeholder="Filter precedents by title, tag, or content..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
          />

          <div className="stack">
            {filteredList.map((doc) => (
              <div
                key={doc.id}
                className={`list-item stack ${selectedDoc?.id === doc.id ? 'selected' : ''}`}
                onClick={() => setSelectedId(doc.id)}
              >
                <div style={{ fontWeight: 700, fontSize: '13px' }}>
                  {doc.title}
                </div>
                <div className="muted">
                  {doc.category || 'Uncategorized'} · {doc.body.length} chars
                </div>
                <div className="row">
                  {doc.tags.slice(0, 4).map((t) => (
                    <span key={t} className="badge">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card stack">
          {!selectedDoc ? (
            <div className="muted">
              Select a precedent or click + New to create one.
            </div>
          ) : (
            <>
              <div className="row-between">
                <div className="card-title">
                  Edit Precedent: {selectedDoc.title}
                </div>
                <div className="row">
                  <label className="row" style={{ cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selectedDoc.enabled}
                      onChange={(e) =>
                        updateSelected({ enabled: e.target.checked })
                      }
                    />
                    <span>Enabled</span>
                  </label>
                  <label className="row" style={{ cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selectedDoc.pinned}
                      onChange={(e) =>
                        updateSelected({ pinned: e.target.checked })
                      }
                    />
                    <span>Always Pin</span>
                  </label>
                  <button
                    type="button"
                    className="btn btn-danger-link btn-sm"
                    onClick={handleDeleteSelected}
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="grid-2">
                <div className="field">
                  <label className="field-label" htmlFor="prec-title">
                    Document Title
                  </label>
                  <input
                    id="prec-title"
                    className="input"
                    value={selectedDoc.title}
                    onChange={(e) => updateSelected({ title: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="prec-cat">
                    Category
                  </label>
                  <input
                    id="prec-cat"
                    className="input"
                    value={selectedDoc.category}
                    onChange={(e) =>
                      updateSelected({ category: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="field">
                <label className="field-label" htmlFor="prec-tags">
                  Tags (comma-separated — boosts similarity matching)
                </label>
                <input
                  id="prec-tags"
                  className="input"
                  value={selectedDoc.tags.join(', ')}
                  onChange={(e) =>
                    updateSelected({
                      tags: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div>

              <div className="field">
                <label className="field-label" htmlFor="prec-when">
                  When the AI Should Take Note of This Precedent
                </label>
                <input
                  id="prec-when"
                  className="input"
                  value={selectedDoc.whenToUse}
                  onChange={(e) =>
                    updateSelected({ whenToUse: e.target.value })
                  }
                />
              </div>

              <div className="field">
                <label className="field-label" htmlFor="prec-guidance">
                  Guidance / Guardrail Notes for Applying This Precedent
                </label>
                <input
                  id="prec-guidance"
                  className="input"
                  value={selectedDoc.guidance}
                  onChange={(e) => updateSelected({ guidance: e.target.value })}
                />
              </div>

              <div className="field">
                <label className="field-label" htmlFor="prec-body">
                  Precedent Document Body
                </label>
                <textarea
                  id="prec-body"
                  className="textarea"
                  rows={10}
                  value={selectedDoc.body}
                  onChange={(e) => updateSelected({ body: e.target.value })}
                />
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
};
