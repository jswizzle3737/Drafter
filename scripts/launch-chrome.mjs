import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
const DIST_DIR = path.join(ROOT, 'packages/extension/dist');
const PROFILE_DIR = path.join(ROOT, '.chrome-dev-profile');

if (!fs.existsSync(path.join(DIST_DIR, 'manifest.json'))) {
  console.error(
    `Chrome Extension build not found at ${DIST_DIR}.\nRun "npm run build:extension" first.`
  );
  process.exit(1);
}

function findChromeExecutable() {
  const platform = os.platform();
  const candidates = [process.env.CHROME_PATH];

  if (platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
    );
  } else if (platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA ?? '';
    candidates.push(
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe')
    );
  } else {
    candidates.push(
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/brave-browser',
      '/snap/bin/chromium'
    );
  }

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

const chromePath = findChromeExecutable();
if (!chromePath) {
  console.error(
    'Could not find Google Chrome or Chromium automatically.\n' +
      'Set CHROME_PATH or load packages/extension/dist manually via chrome://extensions -> Load unpacked.'
  );
  process.exit(1);
}

if (
  os.platform() === 'linux' &&
  !process.env.DISPLAY &&
  !process.env.WAYLAND_DISPLAY
) {
  console.error(
    'No graphical desktop session detected (DISPLAY / WAYLAND_DISPLAY is unset).\n' +
      `To load Drafter into Chrome on your local computer:\n` +
      `  1. Open chrome://extensions in Chrome and enable Developer mode.\n` +
      `  2. Click "Load unpacked" and select ${DIST_DIR}\n` +
      `     (or run "npm run pack:extension" and unzip release/drafter-chrome-extension-v1.0.0.zip).\n` +
      'Or run "npm run test:e2e" here to verify the MV3 extension in headless Chromium.'
  );
  process.exit(1);
}

fs.mkdirSync(PROFILE_DIR, { recursive: true });

const args = [
  `--user-data-dir=${PROFILE_DIR}`,
  `--load-extension=${DIST_DIR}`,
  '--no-first-run',
  '--no-default-browser-check',
  'chrome://extensions',
];

const child = spawn(chromePath, args, {
  detached: true,
  stdio: 'ignore',
});
child.unref();

console.log(`Launched Chrome (${chromePath}) with Drafter extension loaded:`);
console.log(`  Extension dir: ${DIST_DIR}`);
console.log(`  Profile dir:   ${PROFILE_DIR}`);
console.log('Optional: run "npm run dev:server" if using Managed Subscriptions.');
