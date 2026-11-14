import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { createDrafterServer } from '../../packages/server/dist/index.js';

const ROOT = process.cwd();
const EXTENSION_DIST = path.join(ROOT, 'packages/extension/dist');

function findChromiumExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error('Chromium executable not found for E2E test.');
}

async function startMockWebmailServer() {
  const textareaHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Annual SaaS Renewal & Discount Request</title>
  <link rel="icon" href="data:," />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 36px; color: #111827; }
    .thread { border: 1px solid #cbd5e1; padding: 12px; margin: 12px 0; border-radius: 6px; }
    input[name="subject"] { width: 320px; padding: 8px; margin-bottom: 10px; display: block; border: 1px solid #94a3b8; }
    textarea { width: 460px; height: 180px; padding: 10px; border: 2px solid #0f172a; display: block; }
  </style>
</head>
<body>
  <h1>Annual SaaS Renewal &amp; Discount Request</h1>
  <div>buyer@acme.example</div>
  <div class="thread" data-thread="true">
    Hi Alex, our finance team is reviewing our upcoming annual renewal and wants a 25% discount to renew for another 12 months. Can you send revised pricing?
  </div>
  <input type="text" name="subject" value="Re: Annual SaaS Renewal & Discount Request" aria-label="Subject" />
  <textarea id="compose-body" aria-label="Message Body"></textarea>
</body>
</html>`;

  const richComposeHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Inbox Compose — Rich Text</title>
  <link rel="icon" href="data:," />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 36px; color: #111827; }
    .thread { border: 1px solid #cbd5e1; padding: 12px; margin: 12px 0; border-radius: 6px; }
    input[name="subject"] { width: 320px; padding: 8px; margin-bottom: 10px; display: block; border: 1px solid #94a3b8; }
    #rich-compose-body { width: 480px; min-height: 180px; padding: 12px; border: 2px solid #0f172a; border-radius: 6px; }
  </style>
</head>
<body>
  <h1>Enterprise Contract Addendum Inquiry</h1>
  <div>counsel@northstar.example</div>
  <div class="thread" data-thread="true">
    Can we extend the term and review annual discount options before signing?
  </div>
  <input type="text" name="subject" value="Re: Enterprise Contract Addendum Inquiry" aria-label="Subject" />
  <div id="rich-compose-body" contenteditable="true" role="textbox" aria-label="Rich Message Body"></div>
</body>
</html>`;

  const server = http.createServer((req, res) => {
    if (req.url === '/favicon.ico') {
      res.writeHead(204);
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(req.url === '/rich-compose' ? richComposeHtml : textareaHtml);
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  return {
    baseUrl: `http://127.0.0.1:${addr.port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function runE2E() {
  for (const requiredFile of [
    'manifest.json',
    'background.js',
    'content.js',
    'popup.html',
    'sidepanel.html',
    'studio.html',
    'pdf.worker.min.mjs',
    'icons/icon-128.png',
  ]) {
    assert.ok(
      fs.existsSync(path.join(EXTENSION_DIST, requiredFile)),
      `Built extension file missing: ${requiredFile}`
    );
  }
  assert.ok(
    !fs.existsSync(path.join(EXTENSION_DIST, 'index.html')),
    'Extension dist should not contain standalone web-app index.html'
  );

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'drafter-e2e-'));
  const srv = await createDrafterServer({
    port: 0,
    host: '127.0.0.1',
    dataFile: path.join(tmpDir, 'db.json'),
  });
  const webmail = await startMockWebmailServer();

  const consoleErrors = [];
  const pageErrors = [];

  const attachErrorListeners = (page) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(`[${page.url()}] ${msg.text()}`);
      }
    });
    page.on('pageerror', (err) => {
      pageErrors.push(`[${page.url()}] ${err.message}`);
    });
  };

  let context;
  try {
    const executablePath = findChromiumExecutable();
    context = await chromium.launchPersistentContext(
      path.join(tmpDir, 'chrome-profile'),
      {
        executablePath,
        headless: true,
        args: [
          '--headless=new',
          '--no-sandbox',
          '--disable-gpu',
          `--disable-extensions-except=${EXTENSION_DIST}`,
          `--load-extension=${EXTENSION_DIST}`,
        ],
      }
    );

    context.on('page', attachErrorListeners);
    for (const p of context.pages()) attachErrorListeners(p);

    // Wait for MV3 service worker
    let [sw] = context.serviceWorkers();
    if (!sw) {
      sw = await context.waitForEvent('serviceworker', { timeout: 15000 });
    }
    const extId = new URL(sw.url()).host;
    assert.ok(extId, 'Extension ID should resolve from service worker URL');

    // 1. Open mock webmail page & verify inline + Draft trigger
    const webmailPage = await context.newPage();
    await webmailPage.goto(webmail.baseUrl, { waitUntil: 'domcontentloaded' });
    await webmailPage.waitForSelector('#drafter-inline-trigger-host', {
      timeout: 10000,
    });

    // 2. Open Studio tab, capture webmail context, and test offline Demo Sandbox mode
    const studioPage = await context.newPage();
    await studioPage.goto(`chrome-extension://${extId}/studio.html`, {
      waitUntil: 'domcontentloaded',
    });
    await studioPage.getByRole('button', { name: 'Capture Tab' }).click();
    await studioPage.waitForFunction(() => {
      const el = document.querySelector('input[aria-label="Context Subject"]');
      return el && el.value.includes('Annual SaaS Renewal');
    });

    await studioPage
      .getByLabel('Drafting Instruction')
      .fill(
        'Reply to Acme declining the 25% discount on annual renewal and offer 10% for a 24-month commitment.'
      );
    await studioPage.getByLabel('Drafting Provider').selectOption('sandbox');
    await studioPage.getByRole('button', { name: 'Generate Fresh Draft' }).click();
    await studioPage.getByRole('button', { name: 'V1' }).waitFor({ timeout: 5000 });
    await studioPage
      .locator('.draft-body-box')
      .getByText(/10% loyalty credit/)
      .waitFor({ timeout: 5000 });

    // 3. Check Popup & SidePanel pages load cleanly
    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extId}/popup.html`, {
      waitUntil: 'domcontentloaded',
    });
    await popupPage.getByText('Open Side Panel').waitFor({ timeout: 5000 });
    await popupPage.close();

    const sidepanelPage = await context.newPage();
    await sidepanelPage.goto(`chrome-extension://${extId}/sidepanel.html`, {
      waitUntil: 'domcontentloaded',
    });
    await sidepanelPage.getByText('Context & Briefing').waitFor({ timeout: 5000 });
    await sidepanelPage.close();

    // 4. Models & Plans: Check Server, register, subscribe via Stripe Checkout Simulator, auto/refresh -> PRO active
    await studioPage.getByRole('button', { name: 'Models & Plans' }).click();
    await studioPage
      .getByRole('button', { name: 'Managed Subscriptions & Account' })
      .click();

    await studioPage
      .getByLabel('Companion Server URL')
      .fill(srv.baseUrl);
    await studioPage.getByRole('button', { name: 'Check Server' }).click();
    await studioPage
      .getByText(/Server Online · Sandbox Billing & AI/)
      .waitFor({ timeout: 5000 });

    await studioPage.getByLabel('Full Name').fill('Alex Rivera');
    await studioPage.getByLabel('Email').fill('alex.e2e@example.com');
    await studioPage.getByLabel('Password').fill('password123');
    await studioPage
      .locator('form button[type="submit"]')
      .click();

    await studioPage
      .getByText('alex.e2e@example.com', { exact: true })
      .waitFor({ timeout: 5000 });

    const [checkoutPage] = await Promise.all([
      context.waitForEvent('page', { timeout: 10000 }),
      studioPage
        .getByRole('button', { name: /Subscribe to Drafter Pro/ })
        .click(),
    ]);
    await checkoutPage.waitForLoadState('domcontentloaded');
    await checkoutPage
      .getByRole('button', { name: 'Complete Subscription Payment' })
      .click();
    await checkoutPage
      .getByText('Subscription active!')
      .waitFor({ timeout: 5000 });
    await checkoutPage.close();

    await studioPage.getByRole('button', { name: 'Refresh Status' }).click();
    await studioPage.getByText('PRO · active').first().waitFor({ timeout: 5000 });

    // 5. Check Precedents & Voice tabs
    await studioPage.getByRole('button', { name: 'Precedents' }).click();
    await studioPage
      .getByText(/99% · SaaS Annual Renewal|72% · SaaS Annual Renewal|[0-9]+% · SaaS Annual Renewal/)
      .first()
      .waitFor({ timeout: 5000 });

    await studioPage.getByRole('button', { name: 'Voice & Style' }).click();
    await studioPage
      .getByText(/Avg Sentence:/)
      .first()
      .waitFor({ timeout: 5000 });

    // 6. Draft Studio: generate V1 under Managed Pro, iterate V2, check Diff, toggle Dark theme, Insert into textarea webmail
    await studioPage.getByRole('button', { name: 'Draft Studio' }).click();
    await studioPage
      .getByRole('button', { name: 'Generate Fresh Draft' })
      .click();

    await studioPage.getByRole('button', { name: 'V1' }).waitFor({ timeout: 5000 });
    await studioPage
      .getByRole('button', {
        name: 'Make it shorter and punchier without losing key points',
      })
      .click();
    await studioPage.getByRole('button', { name: 'V2' }).waitFor({ timeout: 5000 });

    await studioPage.getByRole('button', { name: 'Diff' }).click();
    await studioPage.getByText('Comparing V1 → V2').waitFor({ timeout: 5000 });

    await studioPage.getByRole('button', { name: /Theme:/ }).click();
    await studioPage.getByRole('button', { name: 'Theme: Dark' }).waitFor({ timeout: 5000 });

    await studioPage.getByRole('button', { name: 'Insert into Tab' }).click();
    await studioPage
      .getByText(/Inserted draft into/)
      .waitFor({ timeout: 5000 });

    const insertedBody = await webmailPage
      .locator('#compose-body')
      .inputValue();
    assert.ok(
      insertedBody.includes('10% loyalty credit'),
      `Expected inserted draft in webmail compose body, got: ${insertedBody}`
    );

    // 7. Verify [contenteditable="true"] compose field detection, inline trigger, capture, and insertion
    await webmailPage.goto(`${webmail.baseUrl}/rich-compose`, {
      waitUntil: 'domcontentloaded',
    });
    await webmailPage.waitForSelector('#drafter-inline-trigger-host', {
      timeout: 10000,
    });
    await studioPage.getByRole('button', { name: 'Capture Tab' }).click();
    await studioPage.waitForFunction(() => {
      const el = document.querySelector('input[aria-label="Context Subject"]');
      return el && el.value.includes('Enterprise Contract Addendum Inquiry');
    });
    await studioPage.getByRole('button', { name: 'Insert into Tab' }).click();
    await webmailPage.waitForFunction(() => {
      const el = document.getElementById('rich-compose-body');
      return el && el.innerText.includes('10% loyalty credit');
    });

    assert.equal(
      consoleErrors.length,
      0,
      `Console errors observed: ${consoleErrors.join(' | ')}`
    );
    assert.equal(
      pageErrors.length,
      0,
      `Uncaught page errors observed: ${pageErrors.join(' | ')}`
    );

    console.log(
      '✅ E2E Chrome Extension (MV3) + Companion Server verification passed with 0 console/page errors!'
    );
  } finally {
    if (context) await context.close();
    await webmail.close();
    await srv.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

runE2E().catch((err) => {
  console.error('E2E FAILED:', err);
  process.exit(1);
});
