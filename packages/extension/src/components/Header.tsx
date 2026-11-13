import React from 'react';
import type { ManagedUser, ThemeMode } from '@drafter/shared';

export type StudioTabId = 'studio' | 'precedents' | 'voice' | 'models';

interface HeaderProps {
  mode: 'sidepanel' | 'studio';
  activeTab: StudioTabId;
  onTabChange: (tab: StudioTabId) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  user: ManagedUser | null;
  onOpenHistory: () => void;
  onOpenBackup: () => void;
  onOpenFullStudio?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  mode,
  activeTab,
  onTabChange,
  theme,
  onToggleTheme,
  user,
  onOpenHistory,
  onOpenBackup,
  onOpenFullStudio,
}) => {
  const planBadge =
    user && user.status === 'active' && user.tier !== 'starter'
      ? `${user.tier.toUpperCase()} · active`
      : 'BYOK Starter';

  return (
    <header className="drafter-header">
      <div className="drafter-brand">
        <span className="brand-icon" aria-hidden="true">
          ✎
        </span>
        <span className="brand-title">Drafter</span>
        <span className="brand-subtitle">AI Writing Studio</span>
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
          Models &amp; Plans
        </button>
      </nav>

      <div className="header-actions">
        <button
          type="button"
          className={`badge ${user?.status === 'active' && user.tier !== 'starter' ? 'badge-accent' : ''}`}
          onClick={() => onTabChange('models')}
        >
          {planBadge}
        </button>

        <button type="button" className="btn btn-sm" onClick={onToggleTheme}>
          Theme: {theme === 'light' ? 'Light' : 'Dark'}
        </button>

        {mode === 'sidepanel' && onOpenFullStudio ? (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onOpenFullStudio}
          >
            Full Studio ↗
          </button>
        ) : (
          <>
            <button type="button" className="btn btn-sm" onClick={onOpenHistory}>
              History
            </button>
            <button type="button" className="btn btn-sm" onClick={onOpenBackup}>
              Backup
            </button>
          </>
        )}
      </div>
    </header>
  );
};
