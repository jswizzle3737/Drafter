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

    // 3. Check Popup & SidePanel pages load cleanly and SidePanel Close button closes it
    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extId}/popup.html`, {
      waitUntil: 'domcontentloaded',
    });
    await popupPage.getByText('Open Side Panel').waitFor({ timeout: 5000 });
    await popupPage.getByText('✕ Close Side Panel').waitFor({ timeout: 5000 });
    await popupPage.getByLabel('Interface Design').selectOption('terminal');
    await popupPage.close();

    const sidepanelPage = await context.newPage();
    await sidepanelPage.goto(`chrome-extension://${extId}/sidepanel.html`, {
      waitUntil: 'domcontentloaded',
    });
    await sidepanelPage.getByText('Context & Briefing').waitFor({ timeout: 5000 });
    await sidepanelPage
      .getByRole('button', { name: 'Close Side Panel' })
      .waitFor({ timeout: 5000 });
    await Promise.all([
      sidepanelPage.waitForEvent('close', { timeout: 5000 }),
      sidepanelPage.getByRole('button', { name: 'Close Side Panel' }).click(),
    ]);

    // 4. Settings & Themes: verify 15 interface designs, pricing removed, and theme switching
    await studioPage.getByRole('button', { name: 'Settings & Themes' }).click();
    await studioPage
      .getByText('Fifteen complete designs from PromptOptimizer')
      .waitFor({ timeout: 5000 });

    await studioPage.getByRole('button', { name: /Manuscript/ }).click();
    await studioPage.waitForFunction(
      () => document.documentElement.getAttribute('data-theme') === 'manuscript'
    );

    await studioPage
      .getByRole('tab', { name: 'AI Engine & API Keys' })
      .click();
    await studioPage
      .getByText('Personal API Keys (Stored Locally)')
      .waitFor({ timeout: 5000 });

    // 5. Check Precedents & Voice tabs, upload an essay, and input instructions on the voice used
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

    const sampleEssayPath = path.join(tmpDir, 'my-personal-essay.md');
    fs.writeFileSync(
      sampleEssayPath,
      '# Designing Calm Workdays\n\nGood tools respect human attention. When we write clearly, our teammates spend less time decoding what we mean and more time building what matters.\n'
    );
    await studioPage
      .getByLabel('Upload Writing Examples')
      .setInputFiles(sampleEssayPath);
    await studioPage
      .getByText('Designing Calm Workdays')
      .first()
      .waitFor({ timeout: 5000 });
    await studioPage
      .getByLabel('Sample Voice Instructions')
      .fill('Use the calm, reflective cadence and clear sentence structure from this essay.');

    // 6. Draft Studio: input custom voice instructions, generate V1, iterate V2, check Diff, switch design via Header menu, Insert into textarea webmail
    await studioPage.getByRole('button', { name: 'Draft Studio' }).click();
    await studioPage
      .getByLabel('Voice Instructions')
      .fill('Conversational and human — match my uploaded essay cadence.');
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

    await studioPage.getByRole('button', { name: /Design:/ }).click();
    await studioPage.getByRole('option', { name: /Midnight/ }).click();
    await studioPage.waitForFunction(
      () => document.documentElement.getAttribute('data-theme') === 'midnight'
    );


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
