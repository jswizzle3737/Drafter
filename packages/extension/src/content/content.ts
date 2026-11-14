import type { PageContext } from '@drafter/shared';

const TRIGGER_ATTR = 'data-drafter-trigger-attached';
const TRIGGER_HOST_ID = 'drafter-inline-trigger-host';
const PREF_KEY = 'drafter.preferences';

let activeTargetEl: HTMLElement | null = null;
let triggerHost: HTMLElement | null = null;
let inlineTriggerEnabled = true;

function isEditableComposeField(el: Element | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  if (el.id === TRIGGER_HOST_ID) return false;
  if (el.tagName === 'TEXTAREA') {
    const ta = el as HTMLTextAreaElement;
    if (ta.readOnly || ta.disabled) return false;
    const nameId = `${ta.name} ${ta.id} ${ta.placeholder}`.toLowerCase();
    // Skip tiny subject inputs
    if (nameId.includes('subject') && ta.rows <= 2) return false;
    return true;
  }
  if (el.isContentEditable) {
    return true;
  }
  return false;
}

function findPrimaryComposeField(): HTMLElement | null {
  if (activeTargetEl && document.contains(activeTargetEl)) {
    return activeTargetEl;
  }
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      'textarea:not([readonly]):not([disabled]), [contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"], [role="textbox"]'
    )
  ).filter((el) => {
    if (!isEditableComposeField(el)) return false;
    const rect = el.getBoundingClientRect();
    return rect.width >= 160 && rect.height >= 60;
  });

  if (candidates.length === 0) return null;
  // Prefer largest compose area
  candidates.sort((a, b) => {
    const ra = a.getBoundingClientRect();
    const rb = b.getBoundingClientRect();
    return rb.width * rb.height - ra.width * ra.height;
  });
  return candidates[0];
}

function findSubjectInput(): HTMLInputElement | null {
  const inputs = Array.from(
    document.querySelectorAll<HTMLInputElement>(
      'input[type="text"], input:not([type])'
    )
  );
  return (
    inputs.find((inp) => {
      const hint = `${inp.name} ${inp.id} ${inp.placeholder} ${inp.getAttribute('aria-label') ?? ''}`.toLowerCase();
      return hint.includes('subject');
    }) ?? null
  );
}

function extractRecipient(): string {
  const toInput = document.querySelector<HTMLInputElement>(
    'input[name*="to" i], input[aria-label*="to" i], input[type="email"]'
  );
  if (toInput?.value?.includes('@')) return toInput.value.trim();

  const bodyText = document.body?.innerText ?? '';
  const emailMatch = bodyText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return emailMatch ? emailMatch[0] : '';
}

function extractSubject(): string {
  const subjInput = findSubjectInput();
  if (subjInput?.value?.trim()) {
    return subjInput.value.trim();
  }
  const heading = document.querySelector('h1, h2, [data-subject]');
  const headingText = heading?.textContent?.trim() ?? '';
  if (headingText) return headingText;
  return document.title.trim();
}

function extractThreadText(): string {
  const blocks: string[] = [];
  const selectors = [
    '[data-thread]',
    '[data-message-body]',
    '.email-body',
    '.message-body',
    'article',
    'blockquote',
  ];
  for (const sel of selectors) {
    for (const node of Array.from(document.querySelectorAll(sel))) {
      const txt = (node as HTMLElement).innerText?.trim();
      if (txt && txt.length > 12 && !blocks.includes(txt)) {
        blocks.push(txt);
      }
    }
  }
  if (blocks.length > 0) {
    return blocks.join('\n\n').slice(0, 4000);
  }

  // Fallback: collect visible paragraph/div text excluding input fields
  const compose = findPrimaryComposeField();
  const lines = (document.body?.innerText ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && l !== '✦ Draft' && l !== '+ Draft');
  const composeVal =
    compose instanceof HTMLTextAreaElement
      ? compose.value
      : compose?.innerText ?? '';
  const filtered = composeVal
    ? lines.filter((l) => !composeVal.includes(l))
    : lines;
  return filtered.slice(0, 40).join('\n').slice(0, 4000);
}

function captureContext(selectionOverride = ''): PageContext {
  const subject = extractSubject();
  const recipient = extractRecipient();
  const isEmailPage =
    Boolean(findSubjectInput()) ||
    Boolean(recipient) ||
    /mail|inbox|compose/i.test(location.href + ' ' + document.title);

  const threadText = selectionOverride.trim() || extractThreadText();

  return {
    kind: isEmailPage ? 'email' : 'webpage',
    title: document.title || location.hostname,
    subject,
    recipient,
    threadText,
    url: location.href,
    hostname: location.hostname,
    capturedAt: new Date().toISOString(),
  };
}

function positionTrigger(target: HTMLElement): void {
  if (!triggerHost || !inlineTriggerEnabled) return;
  const rect = target.getBoundingClientRect();
  if (rect.width < 120 || rect.height < 48) {
    triggerHost.style.display = 'none';
    return;
  }
  triggerHost.style.display = 'block';
  triggerHost.style.top = `${Math.max(8, rect.bottom + window.scrollY - 38)}px`;
  triggerHost.style.left = `${Math.max(8, rect.right + window.scrollX - 88)}px`;
}

function ensureInlineTrigger(target: HTMLElement): void {
  if (!inlineTriggerEnabled) return;
  activeTargetEl = target;
  if (!triggerHost) {
    triggerHost = document.createElement('div');
    triggerHost.id = TRIGGER_HOST_ID;
    triggerHost.style.position = 'absolute';
    triggerHost.style.zIndex = '2147483646';
    const shadow = triggerHost.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        button {
          all: unset;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 11px;
          border-radius: 999px;
          background: #ffffff;
          color: #0b8043;
          border: 1px solid #9ad9b6;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.12s ease, background 0.12s ease;
        }
        button:hover {
          background: #eefbf4;
          transform: translateY(-1px);
        }
      </style>
      <button type="button" aria-label="Draft with Drafter">✦ Draft</button>
    `;
    const btn = shadow.querySelector('button');
    btn?.addEventListener('mousedown', (e) => e.preventDefault());
    btn?.addEventListener('click', () => {
      const ctx = captureContext();
      chrome.runtime.sendMessage({
        type: 'DRAFTER_OPEN_WITH_CONTEXT',
        context: ctx,
      });
    });
    document.body.appendChild(triggerHost);
  }
  positionTrigger(target);
}

function scanAndAttach(): void {
  if (!inlineTriggerEnabled) {
    if (triggerHost) triggerHost.style.display = 'none';
    return;
  }
  const fields = document.querySelectorAll<HTMLElement>(
    'textarea, [contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"], [role="textbox"]'
  );
  fields.forEach((el) => {
    if (!isEditableComposeField(el)) return;
    if (!el.hasAttribute(TRIGGER_ATTR)) {
      el.setAttribute(TRIGGER_ATTR, 'true');
      el.addEventListener('focus', () => ensureInlineTrigger(el));
    }
  });
  const primary = findPrimaryComposeField();
  if (primary) {
    ensureInlineTrigger(primary);
  }
}

function insertIntoCompose(subject: string, body: string): {
  ok: boolean;
  targetLabel: string;
} {
  const subjInput = findSubjectInput();
  if (subjInput && subject.trim()) {
    subjInput.value = subject.trim();
    subjInput.dispatchEvent(new Event('input', { bubbles: true }));
    subjInput.dispatchEvent(new Event('change', { bubbles: true }));
  }

  const target = findPrimaryComposeField();
  if (!target) {
    return { ok: false, targetLabel: '' };
  }

  if (target instanceof HTMLTextAreaElement) {
    target.focus();
    target.value = body;
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
  } else if (target.isContentEditable) {
    target.focus();
    target.innerText = body;
    try {
      target.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          inputType: 'insertText',
          data: body,
        })
      );
    } catch {
      target.dispatchEvent(new Event('input', { bubbles: true }));
    }
    target.dispatchEvent(new Event('change', { bubbles: true }));
  }

  const aria = target.getAttribute('aria-label');
  const label = aria || 'Message Body';
  return { ok: true, targetLabel: label };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'CAPTURE_PAGE_CONTEXT') {
    const context = captureContext(message.selectionText ?? '');
    sendResponse({ ok: true, context });
    return true;
  }
  if (message?.type === 'INSERT_DRAFT_TEXT') {
    const result = insertIntoCompose(
      String(message.subject ?? ''),
      String(message.body ?? '')
    );
    sendResponse(result);
    return true;
  }
  return false;
});

try {
  chrome.storage?.local?.get(PREF_KEY, (res) => {
    const prefs = res?.[PREF_KEY];
    if (prefs && typeof prefs.inlineWebmailTrigger === 'boolean') {
      inlineTriggerEnabled = prefs.inlineWebmailTrigger;
    }
    scanAndAttach();
  });
  chrome.storage?.onChanged?.addListener((changes) => {
    if (changes[PREF_KEY]?.newValue) {
      inlineTriggerEnabled = Boolean(
        changes[PREF_KEY].newValue.inlineWebmailTrigger
      );
      scanAndAttach();
    }
  });
} catch {
  scanAndAttach();
}

const repositionActive = () => {
  if (activeTargetEl && document.contains(activeTargetEl)) {
    positionTrigger(activeTargetEl);
  }
};
window.addEventListener('resize', repositionActive, { passive: true });
window.addEventListener('scroll', repositionActive, {
  passive: true,
  capture: true,
});

const observer = new MutationObserver(() => {
  scanAndAttach();
});
if (document.body) {
  observer.observe(document.body, { childList: true, subtree: true });
}
