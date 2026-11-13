import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  analyzeWritingSamples,
  compileDraftPrompt,
  type DraftIntent,
  type DraftSession,
  type DraftVersion,
  type PageContext,
  type PrecedentDocument,
} from '@drafter/shared';
import { companionDistillVoice, generateDraft } from '../lib/llmClient.js';
import {
  captureActiveTabContext,
  createEmptyContext,
  createInitialState,
  insertDraftIntoActiveTab,
  loadAppState,
  saveAppState,
  type DrafterAppState,
} from '../lib/storage.js';
import { DraftStudioTab } from './DraftStudioTab.js';
import { Header, type StudioTabId } from './Header.js';
import { BackupModal, HistoryModal, InspectPrecedentModal } from './Modals.js';
import { ModelsPlansTab } from './ModelsPlansTab.js';
import { PrecedentsTab } from './PrecedentsTab.js';
import { VoiceStyleTab } from './VoiceStyleTab.js';

interface DrafterAppProps {
  mode: 'sidepanel' | 'studio';
}

function getInitialTabFromQuery(): StudioTabId {
  if (typeof window === 'undefined') return 'studio';
  const param = new URLSearchParams(window.location.search).get('tab');
  if (
    param === 'precedents' ||
    param === 'voice' ||
    param === 'models' ||
    param === 'studio'
  ) {
    return param;
  }
  return 'studio';
}

function getInitialSubtabFromQuery(): 'byok' | 'account' | 'prefs' {
  if (typeof window === 'undefined') return 'account';
  const sub = new URLSearchParams(window.location.search).get('sub');
  if (sub === 'byok' || sub === 'account' || sub === 'prefs') return sub;
  return 'account';
}

export const DrafterApp: React.FC<DrafterAppProps> = ({ mode }) => {
  const [state, setState] = useState<DrafterAppState>(createInitialState);
  const [loaded, setLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<StudioTabId>(
    getInitialTabFromQuery
  );
  const [intent, setIntent] = useState<DraftIntent>('Email Reply');
  const [instruction, setInstruction] = useState('');
  const [voiceToneOverride, setVoiceToneOverride] =
    useState('Personal Default');
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [excludedIds, setExcludedIds] = useState<string[]>([]);
  const [versions, setVersions] = useState<DraftVersion[]>([]);
  const [activeVersionIndex, setActiveVersionIndex] = useState(0);
  const [abCompare, setAbCompare] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [inspectedPrecedent, setInspectedPrecedent] =
    useState<PrecedentDocument | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 3600);
  }, []);

  const persistState = useCallback(
    (updater: (prev: DrafterAppState) => DrafterAppState) => {
      setState((prev) => {
        const next = updater(prev);
        void saveAppState(next);
        return next;
      });
    },
    []
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      const initial = await loadAppState();
      if (!mounted) return;
      if (initial.pendingQuickInstruction) {
        setInstruction(initial.pendingQuickInstruction);
        initial.pendingQuickInstruction = '';
        await saveAppState(initial);
      }
      setState(initial);
      setLoaded(true);
      if (
        initial.preferences.autoCaptureOnOpen &&
        !initial.capturedContext.threadText &&
        !initial.capturedContext.subject
      ) {
        const ctx = await captureActiveTabContext();
        if (ctx && mounted) {
          persistState((prev) => ({ ...prev, capturedContext: ctx }));
        }
      }
    })();

    const onStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (area !== 'local') return;
      if (changes['drafter.capturedContext']?.newValue) {
        const ctx = changes['drafter.capturedContext'].newValue as PageContext;
        setState((prev) => ({ ...prev, capturedContext: ctx }));
      }
      if (changes['drafter.quickInstruction']?.newValue) {
        const q = String(changes['drafter.quickInstruction'].newValue);
        if (q) setInstruction(q);
      }
    };

    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener(onStorageChange);
      return () => {
        mounted = false;
        chrome.storage.onChanged.removeListener(onStorageChange);
      };
    }
    return () => {
      mounted = false;
    };
  }, [persistState]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.theme);
  }, [state.theme]);

  const handleCaptureTab = async () => {
    const ctx = await captureActiveTabContext();
    if (ctx) {
      persistState((prev) => ({ ...prev, capturedContext: ctx }));
      notify(`Captured context from ${ctx.hostname || 'active tab'}.`);
    } else {
      notify('No active web tab detected to capture.');
    }
  };

  const handleNewDraft = () => {
    setVersions([]);
    setActiveVersionIndex(0);
    setInstruction('');
    setPinnedIds([]);
    setExcludedIds([]);
    persistState((prev) => ({ ...prev, activeSessionId: '' }));
    notify('Started a fresh draft workspace.');
  };

  const saveSessionVersion = (
    nextVersions: DraftVersion[],
    currentSessionId: string
  ): string => {
    const sessionId = currentSessionId || `sess-${Date.now()}`;
    const session: DraftSession = {
      id: sessionId,
      context: state.capturedContext,
      intent,
      instruction,
      voiceToneOverride,
      versions: nextVersions,
      pinnedPrecedentIds: pinnedIds,
      excludedPrecedentIds: excludedIds,
      updatedAt: new Date().toISOString(),
    };
    persistState((prev) => {
      const rest = prev.sessions.filter((s) => s.id !== sessionId);
      return {
        ...prev,
        activeSessionId: sessionId,
        sessions: [session, ...rest].slice(0, 40),
      };
    });
    return sessionId;
  };

  const runDraftGeneration = async (refinement?: string) => {
    setIsGenerating(true);
    try {
      const currentActive = versions[activeVersionIndex];
      const compiled = compileDraftPrompt({
        context: state.capturedContext,
        intent,
        instruction,
        precedents: state.precedents,
        pinnedPrecedentIds: pinnedIds,
        excludedPrecedentIds: excludedIds,
        writingSamples: state.writingSamples,
        voiceProfile: state.voiceProfile,
        voiceToneOverride,
        previousDraft: refinement ? currentActive?.rawText : undefined,
        refinementInstruction: refinement,
        maxPrecedents: state.preferences.maxPrecedentsInPrompt,
        minPrecedentScore: state.preferences.minPrecedentMatchScore,
        maxVoiceSamples: state.preferences.maxVoiceExamplesInPrompt,
      });

      const primary = await generateDraft({
        provider: state.provider,
        model: state.model,
        compiled,
        subject: state.capturedContext.subject,
        instruction,
        intent,
        authorName: state.voiceProfile.displayName,
        previousDraft: refinement ? currentActive?.rawText : undefined,
        refinementInstruction: refinement,
        apiKeys: state.apiKeys,
        companionUrl: state.companionUrl,
        companionToken: state.companionToken,
      });

      let compareVariant: DraftVersion['compareVariant'] | undefined;
      if (abCompare && !refinement) {
        try {
          const second = await generateDraft({
            provider: state.provider,
            model: state.compareModel,
            compiled,
            subject: state.capturedContext.subject,
            instruction,
            intent,
            authorName: state.voiceProfile.displayName,
            apiKeys: state.apiKeys,
            companionUrl: state.companionUrl,
            companionToken: state.companionToken,
          });
          compareVariant = {
            providerLabel: second.providerLabel,
            model: second.model,
            subject: second.subject,
            body: second.body,
            latencyMs: second.latencyMs,
            totalTokens: second.totalTokens,
          };
          if (second.updatedUser) {
            persistState((prev) => ({
              ...prev,
              companionUser: second.updatedUser ?? prev.companionUser,
            }));
          }
        } catch (err) {
          notify(
            `Model B comparison failed: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }

      if (primary.updatedUser) {
        persistState((prev) => ({
          ...prev,
          companionUser: primary.updatedUser ?? prev.companionUser,
        }));
      }

      const nextVerNum = (refinement ? versions.length : 0) + 1;
      const newVersion: DraftVersion = {
        version: nextVerNum,
        subject: primary.subject,
        body: primary.body,
        rawText: primary.rawText,
        provider: primary.provider,
        providerLabel: primary.providerLabel,
        model: primary.model,
        latencyMs: primary.latencyMs,
        totalTokens: primary.totalTokens,
        instruction: refinement ?? instruction,
        appliedPrecedents: compiled.appliedPrecedents.map((p) => ({
          id: p.document.id,
          title: p.document.title,
          score: p.score,
        })),
        createdAt: new Date().toISOString(),
        compareVariant,
      };

      const nextVersions = refinement
        ? [...versions, newVersion]
        : [newVersion];
      setVersions(nextVersions);
      setActiveVersionIndex(nextVersions.length - 1);
      saveSessionVersion(
        nextVersions,
        refinement ? state.activeSessionId : ''
      );
      notify(`Draft V${newVersion.version} ready (${newVersion.latencyMs}ms).`);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Draft generation failed.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleInsertIntoTab = async (subject: string, body: string) => {
    const res = await insertDraftIntoActiveTab(subject, body);
    if (res.ok) {
      notify(`Inserted draft into ${res.targetLabel || 'Message Body'}.`);
    } else {
      notify(res.error || 'Could not insert draft into active tab.');
    }
  };

  const handleDistillVoice = async () => {
    if (
      state.companionToken &&
      state.companionUser?.status === 'active' &&
      state.companionUser.tier !== 'starter'
    ) {
      try {
        const summary = await companionDistillVoice({
          companionUrl: state.companionUrl,
          token: state.companionToken,
          samples: state.writingSamples,
        });
        persistState((prev) => ({
          ...prev,
          voiceProfile: { ...prev.voiceProfile, distilledSummary: summary },
        }));
        notify('Voice DNA distilled.');
        return;
      } catch {
        // Fallback to local stylometric summary
      }
    }
    const analysis = analyzeWritingSamples(state.writingSamples);
    persistState((prev) => ({
      ...prev,
      voiceProfile: {
        ...prev.voiceProfile,
        distilledSummary: analysis.summary,
      },
    }));
    notify('Voice DNA updated from your writing samples.');
  };

  const handleOpenFullStudio = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({
        type: 'DRAFTER_OPEN_STUDIO_TAB',
        tab: activeTab,
      });
    } else {
      window.open(`./studio.html?tab=${activeTab}`, '_blank', 'noopener');
    }
  };

  if (!loaded) {
    return (
      <div className={`drafter-shell mode-${mode}`}>
        <div className="drafter-main muted">Loading Drafter...</div>
      </div>
    );
  }

  return (
    <div className={`drafter-shell mode-${mode}`} data-theme={state.theme}>
      <Header
        mode={mode}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        theme={state.theme}
        onToggleTheme={() =>
          persistState((prev) => ({
            ...prev,
            theme: prev.theme === 'light' ? 'dark' : 'light',
          }))
        }
        user={state.companionUser}
        onOpenHistory={() => setHistoryOpen(true)}
        onOpenBackup={() => setBackupOpen(true)}
        onOpenFullStudio={
          mode === 'sidepanel' ? handleOpenFullStudio : undefined
        }
      />

      <main className="drafter-main">
        {activeTab === 'studio' && (
          <DraftStudioTab
            state={state}
            intent={intent}
            instruction={instruction}
            voiceToneOverride={voiceToneOverride}
            pinnedIds={pinnedIds}
            excludedIds={excludedIds}
            versions={versions}
            activeVersionIndex={activeVersionIndex}
            abCompare={abCompare}
            isGenerating={isGenerating}
            onIntentChange={setIntent}
            onInstructionChange={setInstruction}
            onVoiceToneOverrideChange={setVoiceToneOverride}
            onContextChange={(ctx) =>
              persistState((prev) => ({ ...prev, capturedContext: ctx }))
            }
            onCaptureTab={handleCaptureTab}
            onNewDraft={handleNewDraft}
            onTogglePin={(id) =>
              setPinnedIds((prev) =>
                prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
              )
            }
            onExcludePrecedent={(id) =>
              setExcludedIds((prev) =>
                prev.includes(id) ? prev : [...prev, id]
              )
            }
            onRestoreExcluded={(id) =>
              setExcludedIds((prev) => prev.filter((x) => x !== id))
            }
            onInspectPrecedent={setInspectedPrecedent}
            onProviderChange={(provider) =>
              persistState((prev) => ({ ...prev, provider }))
            }
            onModelChange={(model) =>
              persistState((prev) => ({ ...prev, model }))
            }
            onCompareModelChange={(compareModel) =>
              persistState((prev) => ({ ...prev, compareModel }))
            }
            onAbCompareChange={setAbCompare}
            onGenerate={() => runDraftGeneration()}
            onIterate={(refText) => runDraftGeneration(refText)}
            onSelectVersion={setActiveVersionIndex}
            onInsertIntoTab={handleInsertIntoTab}
            onNavigateTab={setActiveTab}
            onNotify={notify}
          />
        )}

        {activeTab === 'precedents' && (
          <PrecedentsTab
            precedents={state.precedents}
            onChange={(precedents) =>
              persistState((prev) => ({ ...prev, precedents }))
            }
            onNotify={notify}
          />
        )}

        {activeTab === 'voice' && (
          <VoiceStyleTab
            voiceProfile={state.voiceProfile}
            writingSamples={state.writingSamples}
            onProfileChange={(voiceProfile) =>
              persistState((prev) => ({ ...prev, voiceProfile }))
            }
            onSamplesChange={(writingSamples) =>
              persistState((prev) => ({ ...prev, writingSamples }))
            }
            onDistillWithAi={handleDistillVoice}
            onNotify={notify}
          />
        )}

        {activeTab === 'models' && (
          <ModelsPlansTab
            state={state}
            initialSubtab={getInitialSubtabFromQuery()}
            onUpdateState={persistState}
            onNotify={notify}
          />
        )}
      </main>

      <InspectPrecedentModal
        precedent={inspectedPrecedent}
        onClose={() => setInspectedPrecedent(null)}
      />

      <HistoryModal
        open={historyOpen}
        sessions={state.sessions}
        onClose={() => setHistoryOpen(false)}
        onRestoreSession={(session) => {
          persistState((prev) => ({
            ...prev,
            capturedContext: session.context ?? createEmptyContext(),
            activeSessionId: session.id,
          }));
          setIntent(session.intent);
          setInstruction(session.instruction);
          setVoiceToneOverride(session.voiceToneOverride || 'Personal Default');
          setPinnedIds(session.pinnedPrecedentIds ?? []);
          setExcludedIds(session.excludedPrecedentIds ?? []);
          setVersions(session.versions ?? []);
          setActiveVersionIndex(
            Math.max(0, (session.versions?.length ?? 1) - 1)
          );
          setActiveTab('studio');
          notify('Loaded draft session from history.');
        }}
        onDeleteSession={(id) => {
          persistState((prev) => ({
            ...prev,
            sessions: prev.sessions.filter((s) => s.id !== id),
          }));
        }}
      />

      <BackupModal
        open={backupOpen}
        state={state}
        onClose={() => setBackupOpen(false)}
        onImportBackup={(data) => {
          persistState((prev) => ({
            ...prev,
            precedents: data.precedents ?? prev.precedents,
            writingSamples: data.writingSamples ?? prev.writingSamples,
            voiceProfile: data.voiceProfile ?? prev.voiceProfile,
            sessions: data.sessions ?? prev.sessions,
            preferences: data.preferences ?? prev.preferences,
          }));
          notify('Imported workspace backup.');
        }}
        onNotify={notify}
      />

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </div>
  );
};
