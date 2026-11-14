import type { PageContext } from '@drafter/shared';

const KEY_CAPTURED_CONTEXT = 'drafter.capturedContext';
const KEY_LAST_WEB_TAB = 'drafter.lastWebTabId';

function isWebUrl(url?: string): boolean {
  return Boolean(url && (url.startsWith('http://') || url.startsWith('https://')));
}

chrome.runtime.onInstalled.addListener(() => {
  try {
    chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: false }).catch(() => {});
  } catch {
    // Ignore if sidePanel API is unavailable
  }
  try {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: 'drafter-open-studio',
        title: 'Draft with Drafter AI Studio',
        contexts: ['page', 'selection', 'editable'],
      });
    });
  } catch {
    // Ignore in environments without contextMenus permission
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (isWebUrl(tab.url)) {
      await chrome.storage.local.set({ [KEY_LAST_WEB_TAB]: tabId });
    }
  } catch {
    // Ignore transient tab query errors
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && isWebUrl(tab.url)) {
    await chrome.storage.local.set({ [KEY_LAST_WEB_TAB]: tabId });
  }
});

chrome.contextMenus?.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'drafter-open-studio') return;
  if (tab?.id && isWebUrl(tab.url)) {
    await chrome.storage.local.set({ [KEY_LAST_WEB_TAB]: tab.id });
    try {
      const resp = await chrome.tabs.sendMessage(tab.id, {
        type: 'CAPTURE_PAGE_CONTEXT',
        selectionText: info.selectionText ?? '',
      });
      if (resp?.context) {
        await chrome.storage.local.set({ [KEY_CAPTURED_CONTEXT]: resp.context });
      }
    } catch {
      // Content script might not be active on special pages
    }
    try {
      await chrome.sidePanel.open({ tabId: tab.id });
      return;
    } catch {
      // Fallback to Studio tab
    }
  }
  await chrome.tabs.create({ url: chrome.runtime.getURL('studio.html') });
});

async function resolveTargetWebTabId(preferredTabId?: number): Promise<number | null> {
  if (preferredTabId) {
    try {
      const t = await chrome.tabs.get(preferredTabId);
      if (isWebUrl(t.url)) return preferredTabId;
    } catch {
      // Tab closed
    }
  }

  const activeTabs = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  const active = activeTabs.find((t) => t.id && isWebUrl(t.url));
  if (active?.id) return active.id;

  const stored = await chrome.storage.local.get(KEY_LAST_WEB_TAB);
  const storedId = stored[KEY_LAST_WEB_TAB];
  if (typeof storedId === 'number') {
    try {
      const t = await chrome.tabs.get(storedId);
      if (isWebUrl(t.url)) return storedId;
    } catch {
      // Tab closed
    }
  }

  const allWebTabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
  const sorted = allWebTabs
    .filter((t) => t.id !== undefined)
    .sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0));
  return sorted[0]?.id ?? null;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message?.type === 'DRAFTER_OPEN_WITH_CONTEXT') {
      const context = message.context as PageContext | undefined;
      if (context) {
        await chrome.storage.local.set({ [KEY_CAPTURED_CONTEXT]: context });
      }
      if (sender.tab?.id && isWebUrl(sender.tab.url)) {
        await chrome.storage.local.set({ [KEY_LAST_WEB_TAB]: sender.tab.id });
        try {
          await chrome.sidePanel.open({ tabId: sender.tab.id });
          sendResponse({ ok: true, target: 'sidepanel' });
          return;
        } catch {
          // Fallback to studio window tab
        }
      }
      await chrome.tabs.create({ url: chrome.runtime.getURL('studio.html') });
      sendResponse({ ok: true, target: 'studio' });
      return;
    }

    if (message?.type === 'DRAFTER_CAPTURE_ACTIVE_TAB') {
      const targetId = await resolveTargetWebTabId(message.tabId);
      if (!targetId) {
        sendResponse({ ok: false, error: 'No active web tab found.' });
        return;
      }
      await chrome.storage.local.set({ [KEY_LAST_WEB_TAB]: targetId });
      try {
        const resp = await chrome.tabs.sendMessage(targetId, {
          type: 'CAPTURE_PAGE_CONTEXT',
        });
        if (resp?.context) {
          await chrome.storage.local.set({
            [KEY_CAPTURED_CONTEXT]: resp.context,
          });
          sendResponse({ ok: true, context: resp.context, tabId: targetId });
          return;
        }
      } catch {
        // Fallback: read basic tab metadata
      }
      const tab = await chrome.tabs.get(targetId);
      const urlObj = new URL(tab.url || 'https://example.com');
      const fallbackContext: PageContext = {
        kind: 'webpage',
        title: tab.title || urlObj.hostname,
        subject: tab.title || '',
        recipient: '',
        threadText: '',
        url: tab.url || '',
        hostname: urlObj.hostname,
        capturedAt: new Date().toISOString(),
      };
      await chrome.storage.local.set({ [KEY_CAPTURED_CONTEXT]: fallbackContext });
      sendResponse({ ok: true, context: fallbackContext, tabId: targetId });
      return;
    }

    if (message?.type === 'DRAFTER_INSERT_INTO_ACTIVE_TAB') {
      const targetId = await resolveTargetWebTabId(message.tabId);
      if (!targetId) {
        sendResponse({ ok: false, error: 'No target web tab available.' });
        return;
      }
      try {
        const resp = await chrome.tabs.sendMessage(targetId, {
          type: 'INSERT_DRAFT_TEXT',
          subject: message.subject ?? '',
          body: message.body ?? '',
        });
        sendResponse(resp ?? { ok: true, targetLabel: 'Message Body' });
      } catch (err) {
        sendResponse({
          ok: false,
          error:
            err instanceof Error
              ? err.message
              : 'Unable to inject into target page.',
        });
      }
      return;
    }

    if (message?.type === 'DRAFTER_OPEN_STUDIO_TAB') {
      const query = message.tab ? `?tab=${encodeURIComponent(message.tab)}` : '';
      await chrome.tabs.create({
        url: chrome.runtime.getURL(`studio.html${query}`),
      });
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === 'DRAFTER_OPEN_SIDEPANEL') {
      const targetId = await resolveTargetWebTabId(message.tabId);
      if (targetId) {
        try {
          await chrome.sidePanel.open({ tabId: targetId });
          sendResponse({ ok: true });
          return;
        } catch {
          // Fallback to studio if sidePanel.open is blocked
        }
      }
      await chrome.tabs.create({ url: chrome.runtime.getURL('studio.html') });
      sendResponse({ ok: true, fallback: 'studio' });
      return;
    }

    sendResponse({ ok: false, error: 'Unknown message type' });
  })();
  return true;
});
