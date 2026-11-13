import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { rankPrecedents } from '@drafter/shared';
import {
  captureActiveTabContext,
  createInitialState,
  loadAppState,
  setQuickInstruction,
  type DrafterAppState,
} from './lib/storage.js';
import './styles/app.css';

const PopupApp: React.FC = () => {
  const [state, setState] = useState<DrafterAppState>(createInitialState);
  const [instruction, setInstruction] = useState('');

  useEffect(() => {
    (async () => {
      const initial = await loadAppState();
      setState(initial);
      setInstruction(initial.pendingQuickInstruction || '');
      document.documentElement.setAttribute('data-theme', initial.theme);
      if (initial.preferences.autoCaptureOnOpen) {
        const ctx = await captureActiveTabContext();
        if (ctx) {
          setState((prev) => ({ ...prev, capturedContext: ctx }));
        }
      }
    })();
  }, []);

  const topMatch = useMemo(() => {
    const query = [
      state.capturedContext.subject,
      state.capturedContext.threadText,
      instruction,
    ]
      .filter(Boolean)
      .join(' ');
    if (!query.trim()) return null;
    return rankPrecedents(state.precedents, query, { limit: 1 })[0] ?? null;
  }, [state.precedents, state.capturedContext, instruction]);

  const openSidePanel = async () => {
    await setQuickInstruction(instruction);
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'DRAFTER_OPEN_SIDEPANEL' });
      window.close();
    } else {
      window.open('./sidepanel.html', '_blank', 'noopener');
    }
  };

  const openFullStudio = async (tab = 'studio') => {
    await setQuickInstruction(instruction);
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'DRAFTER_OPEN_STUDIO_TAB', tab });
      window.close();
    } else {
      window.open(`./studio.html?tab=${tab}`, '_blank', 'noopener');
    }
  };

  const activeSamplesCount = state.writingSamples.filter((s) => s.active).length;

  return (
    <div className="popup-shell" data-theme={state.theme}>
      <div className="row-between">
        <div className="drafter-brand">
          <span className="brand-icon" aria-hidden="true">
            ✎
          </span>
          <span className="brand-title">Drafter</span>
        </div>
        <span className="badge badge-accent">{state.model}</span>
      </div>

      <div className="subcard stack" style={{ gap: '6px' }}>
        <div className="row-between">
          <span className="badge">
            {state.capturedContext.kind === 'email' ? 'EMAIL' : 'PAGE'}
          </span>
          <span className="muted">
            {state.capturedContext.hostname || 'Ready'}
          </span>
        </div>
        <div style={{ fontWeight: 700, fontSize: '13px' }}>
          {state.capturedContext.subject ||
            state.capturedContext.title ||
            'No active page captured yet'}
        </div>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="popup-quick-instruction">
          Quick Draft Instruction
        </label>
        <textarea
          id="popup-quick-instruction"
          className="textarea"
          rows={3}
          placeholder="What should Drafter write for this page or email?"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
        />
      </div>

      {topMatch && (
        <div>
          <span className="badge badge-accent">
            {topMatch.score}% · {topMatch.document.title}
          </span>
        </div>
      )}

      <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <button
          type="button"
          className="btn btn-primary btn-lg"
          onClick={openSidePanel}
        >
          Open Side Panel
        </button>
        <button
          type="button"
          className="btn btn-primary btn-lg"
          onClick={() => openFullStudio('studio')}
        >
          Full Studio ↗
        </button>
      </div>

      <div
        className="row-between"
        style={{ borderTop: '1px solid var(--border)', paddingTop: '10px' }}
      >
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => openFullStudio('precedents')}
        >
          Precedents ({state.precedents.length})
        </button>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => openFullStudio('voice')}
        >
          Voice ({activeSamplesCount})
        </button>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => openFullStudio('models')}
        >
          Models / Plans
        </button>
      </div>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(<PopupApp />);
