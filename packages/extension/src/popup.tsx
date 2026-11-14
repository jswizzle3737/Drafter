import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  DESIGN_THEMES,
  getDesignTheme,
  rankPrecedents,
  type ThemeMode,
} from '@drafter/shared';
import {
  captureActiveTabContext,
  closeSidePanelWindow,
  createInitialState,
  loadAppState,
  saveAppState,
  setQuickInstruction,
  type DrafterAppState,
} from './lib/storage.js';
import './styles/app.css';

const PopupApp: React.FC = () => {
  const [state, setState] = useState<DrafterAppState>(createInitialState);
  const [instruction, setInstruction] = useState('');
  const activeTabRef = React.useRef<{ id?: number; windowId?: number }>({});

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const active = tabs?.[0];
        if (active) {
          activeTabRef.current = { id: active.id, windowId: active.windowId };
        }
      });
    }
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

  const handleThemeChange = async (themeId: ThemeMode) => {
    const meta = getDesignTheme(themeId);
    const nextState: DrafterAppState = { ...state, theme: meta.id };
    setState(nextState);
    document.documentElement.setAttribute('data-theme', meta.id);
    await saveAppState(nextState);
  };

  const openSidePanel = () => {
    const { id: tabId, windowId } = activeTabRef.current;
    if (typeof chrome !== 'undefined' && chrome.sidePanel?.open && (tabId || windowId)) {
      const target = tabId ? { tabId } : { windowId: windowId! };
      void chrome.sidePanel.open(target).catch(() => {
        chrome.runtime?.sendMessage?.({ type: 'DRAFTER_OPEN_SIDEPANEL', tabId });
      });
      void setQuickInstruction(instruction).finally(() => window.close());
      return;
    }
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      void setQuickInstruction(instruction).finally(() => {
        chrome.runtime.sendMessage({ type: 'DRAFTER_OPEN_SIDEPANEL', tabId });
        window.close();
      });
    } else {
      void setQuickInstruction(instruction).finally(() => {
        window.open('./sidepanel.html', '_blank', 'noopener');
      });
    }
  };

  const closeSidePanel = async () => {
    await closeSidePanelWindow();
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

        <div className="row" style={{ gap: '6px' }}>
          <select
            aria-label="Interface Design"
            className="select"
            style={{ width: 'auto', padding: '4px 8px', fontSize: '12px' }}
            value={state.theme}
            onChange={(e) => void handleThemeChange(e.target.value as ThemeMode)}
          >
            {DESIGN_THEMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.mode === 'dark' ? 'Dark' : 'Light'})
              </option>
            ))}
          </select>
        </div>
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
          onClick={() => void openFullStudio('studio')}
        >
          Full Studio ↗
        </button>
      </div>

      <div className="row-between">
        <button
          type="button"
          className="btn btn-sm"
          style={{ width: '100%' }}
          onClick={() => void closeSidePanel()}
        >
          ✕ Close Side Panel
        </button>
      </div>

      <div
        className="row-between"
        style={{ borderTop: '1px solid var(--border)', paddingTop: '10px' }}
      >
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => void openFullStudio('precedents')}
        >
          Precedents ({state.precedents.length})
        </button>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => void openFullStudio('voice')}
        >
          Voice ({activeSamplesCount})
        </button>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => void openFullStudio('models')}
        >
          Settings &amp; Themes
        </button>
      </div>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(<PopupApp />);
