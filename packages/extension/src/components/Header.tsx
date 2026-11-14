import React, { useEffect, useRef, useState } from 'react';
import {
  DESIGN_THEMES,
  getDesignTheme,
  PROVIDER_CATALOG,
  type ProviderId,
  type ThemeMode,
} from '@drafter/shared';

export type StudioTabId = 'studio' | 'precedents' | 'voice' | 'models';

interface HeaderProps {
  mode: 'sidepanel' | 'studio';
  activeTab: StudioTabId;
  onTabChange: (tab: StudioTabId) => void;
  theme: ThemeMode;
  onSelectTheme: (theme: ThemeMode) => void;
  provider?: ProviderId;
  onOpenHistory: () => void;
  onOpenBackup: () => void;
  onOpenFullStudio?: () => void;
  onCloseSidePanel?: () => void;
}

export const ThemeSwatchDots: React.FC<{
  swatch: [string, string, string];
}> = ({ swatch }) => (
  <span className="theme-swatch-dots" aria-hidden="true">
    <span className="swatch-dot" style={{ background: swatch[0] }} />
    <span className="swatch-dot" style={{ background: swatch[1] }} />
    <span className="swatch-dot" style={{ background: swatch[2] }} />
  </span>
);

export const Header: React.FC<HeaderProps> = ({
  mode,
  activeTab,
  onTabChange,
  theme,
  onSelectTheme,
  provider = 'sandbox',
  onOpenHistory,
  onOpenBackup,
  onOpenFullStudio,
  onCloseSidePanel,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const currentDesign = getDesignTheme(theme);
  const providerMeta =
    PROVIDER_CATALOG.find((p) => p.id === provider) ?? PROVIDER_CATALOG[0];

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [menuOpen]);

  return (
    <header className="drafter-header">
      <div className="row-between" style={{ width: mode === 'sidepanel' ? '100%' : 'auto', gap: '8px' }}>
        <div className="drafter-brand">
          <span className="brand-icon" aria-hidden="true">
            ✎
          </span>
          <span className="brand-title">Drafter</span>
          <span className="brand-subtitle">Personal AI Studio</span>
        </div>

        {mode === 'sidepanel' && (
          <div className="row" style={{ gap: '6px' }}>
            {onOpenFullStudio && (
              <button
                type="button"
                className="btn btn-sm"
                onClick={onOpenFullStudio}
                title="Open in full browser tab"
              >
                Full Studio ↗
              </button>
            )}
            {onCloseSidePanel && (
              <button
                type="button"
                className="btn btn-sm btn-close-panel"
                onClick={onCloseSidePanel}
                aria-label="Close Side Panel"
                title="Close Side Panel (Esc)"
              >
                ✕ Close
              </button>
            )}
          </div>
        )}
      </div>

      <nav className="nav-pills" aria-label="Main Navigation">
        <button
          type="button"
          className={`nav-pill ${activeTab === 'studio' ? 'active' : ''}`}
          onClick={() => onTabChange('studio')}
        >
          Draft Studio
        </button>
        <button
          type="button"
          className={`nav-pill ${activeTab === 'precedents' ? 'active' : ''}`}
          onClick={() => onTabChange('precedents')}
        >
          Precedents
        </button>
        <button
          type="button"
          className={`nav-pill ${activeTab === 'voice' ? 'active' : ''}`}
          onClick={() => onTabChange('voice')}
        >
          Voice &amp; Style
        </button>
        <button
          type="button"
          className={`nav-pill ${activeTab === 'models' ? 'active' : ''}`}
          onClick={() => onTabChange('models')}
        >
          Settings &amp; Themes
        </button>
      </nav>

      <div className="header-actions">
        <button
          type="button"
          className="badge badge-accent"
          onClick={() => onTabChange('models')}
          title="Configure AI provider and personal API keys"
        >
          {providerMeta.shortLabel}
        </button>

        <div className="theme-menu-wrap" ref={menuRef}>
          <button
            type="button"
            className="btn btn-sm theme-trigger-btn"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-haspopup="listbox"
            aria-expanded={menuOpen}
            aria-label={`Design: ${currentDesign.name}`}
          >
            <ThemeSwatchDots swatch={currentDesign.swatch} />
            <span>Design: {currentDesign.name}</span>
            <span aria-hidden="true" style={{ fontSize: '10px', opacity: 0.75 }}>
              ▾
            </span>
          </button>

          {menuOpen && (
            <div
              className="theme-dropdown-menu"
              role="listbox"
              aria-label="Interface design"
            >
              <div className="theme-dropdown-header">
                Interface Design (15 Themes)
              </div>
              <div className="theme-dropdown-list">
                {DESIGN_THEMES.map((item) => {
                  const selected = item.id === currentDesign.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={`theme-dropdown-item ${selected ? 'active' : ''}`}
                      onClick={() => {
                        onSelectTheme(item.id);
                        setMenuOpen(false);
                      }}
                    >
                      <ThemeSwatchDots swatch={item.swatch} />
                      <div className="theme-dropdown-text">
                        <span className="theme-dropdown-name">{item.name}</span>
                        <span className="theme-dropdown-desc">{item.desc}</span>
                      </div>
                      {selected && (
                        <span className="theme-dropdown-check" aria-hidden="true">
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <button type="button" className="btn btn-sm" onClick={onOpenHistory}>
          History
        </button>
        <button type="button" className="btn btn-sm" onClick={onOpenBackup}>
          Backup
        </button>
      </div>
    </header>
  );
};
