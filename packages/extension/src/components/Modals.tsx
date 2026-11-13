import React, { useState } from 'react';
import type { DraftSession, PrecedentDocument } from '@drafter/shared';
import type { DrafterAppState } from '../lib/storage.js';

interface InspectPrecedentModalProps {
  precedent: PrecedentDocument | null;
  onClose: () => void;
}

export const InspectPrecedentModal: React.FC<InspectPrecedentModalProps> = ({
  precedent,
  onClose,
}) => {
  if (!precedent) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card stack" onClick={(e) => e.stopPropagation()}>
        <div className="row-between">
          <div>
            <div className="card-title">{precedent.title}</div>
            <div className="muted">{precedent.category}</div>
          </div>
          <button type="button" className="btn btn-sm" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="row">
          {precedent.tags.map((t) => (
            <span key={t} className="badge">
              {t}
            </span>
          ))}
        </div>

        {precedent.whenToUse && (
          <div className="subcard">
            <div className="field-label">When the AI Should Take Note</div>
            <div>{precedent.whenToUse}</div>
          </div>
        )}

        {precedent.guidance && (
          <div className="subcard">
            <div className="field-label">Guardrail Notes</div>
            <div>{precedent.guidance}</div>
          </div>
        )}

        <div className="field">
          <div className="field-label">Document Body</div>
          <pre className="prompt-pre">{precedent.body}</pre>
        </div>
      </div>
    </div>
  );
};

interface HistoryModalProps {
  open: boolean;
  sessions: DraftSession[];
  onClose: () => void;
  onRestoreSession: (session: DraftSession) => void;
  onDeleteSession: (sessionId: string) => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  open,
  sessions,
  onClose,
  onRestoreSession,
  onDeleteSession,
}) => {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card stack" onClick={(e) => e.stopPropagation()}>
        <div className="row-between">
          <div className="card-title">Draft History ({sessions.length})</div>
          <button type="button" className="btn btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
        {sessions.length === 0 ? (
          <div className="muted">No saved drafts yet. Generate a draft to save it here.</div>
        ) : (
          <div className="stack">
            {sessions.map((s) => {
              const latest = s.versions[s.versions.length - 1];
              return (
                <div key={s.id} className="subcard row-between">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>
                      {latest?.subject || s.context.subject || s.intent}
                    </div>
                    <div className="muted">
                      {s.intent} · {s.versions.length} version(s) ·{' '}
                      {new Date(s.updatedAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="row">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        onRestoreSession(s);
                        onClose();
                      }}
                    >
                      Load
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger-link btn-sm"
                      onClick={() => onDeleteSession(s.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

interface BackupModalProps {
  open: boolean;
  state: DrafterAppState;
  onClose: () => void;
  onImportBackup: (data: Partial<DrafterAppState>) => void;
  onNotify: (msg: string) => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  open,
  state,
  onClose,
  onImportBackup,
  onNotify,
}) => {
  const [rawJson, setRawJson] = useState('');
  if (!open) return null;

  const exportPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    precedents: state.precedents,
    writingSamples: state.writingSamples,
    voiceProfile: state.voiceProfile,
    sessions: state.sessions,
    preferences: state.preferences,
  };

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `drafter-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify('Backup JSON downloaded.');
  };

  const handleImport = () => {
    try {
      const parsed = JSON.parse(rawJson);
      onImportBackup(parsed);
      setRawJson('');
      onClose();
    } catch {
      onNotify('Invalid backup JSON.');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card stack" onClick={(e) => e.stopPropagation()}>
        <div className="row-between">
          <div className="card-title">Backup &amp; Restore Workspace</div>
          <button type="button" className="btn btn-sm" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="subcard row-between">
          <div>
            <div style={{ fontWeight: 700 }}>Export Full Vault &amp; History</div>
            <div className="muted">
              {state.precedents.length} precedents, {state.writingSamples.length}{' '}
              voice samples, {state.sessions.length} draft sessions.
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleDownload}
          >
            Download JSON
          </button>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="backup-import-textarea">
            Restore from JSON Backup
          </label>
          <textarea
            id="backup-import-textarea"
            className="textarea mono"
            rows={6}
            value={rawJson}
            onChange={(e) => setRawJson(e.target.value)}
            placeholder="Paste previously exported Drafter JSON backup..."
          />
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!rawJson.trim()}
              onClick={handleImport}
            >
              Import Backup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
