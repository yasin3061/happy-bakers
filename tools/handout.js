/*
 * Prints the handout to PDF with headless Chrome. No server, no packages.
 *
 *   node tools/handout.js
 *
 * docs/handout/handout.html  ->  docs/handout/Happy-Bakers-demo-guide.pdf  (three A4 pages)
 *
 * The handout is what is given to the people the demo is shared with: it says what the demo is, how to explore it
 * and how it differs from a live system, so that the app itself does not have to (docs/SCOPE.md, decision 19).
 * The picture on its first page is docs/handout/dashboard.png; docs/handout/dashboard-shot.js says how to take it again.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'docs', 'handout', 'handout.html');
const OUT = path.join(ROOT, 'docs', 'handout', 'Happy-Bakers-demo-guide.pdf');

function chromePath() {
  const env = process.env, list = [
    env.CHROME,
    path.join(env.PROGRAMFILES || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'
  ];
  const found = list.filter((p) => p && fs.existsSync(p))[0];
  if (!found) { console.error('Chrome was not found. Set CHROME to the path of chrome.exe.'); process.exit(2); }
  return found;
}

/* a profile of its own, in the system temp folder: the print never touches the browser the user works in */
const profile = path.join(os.tmpdir(), 'hb-handout-profile');
fs.mkdirSync(profile, { recursive: true });
fs.rmSync(OUT, { force: true });

const res = cp.spawnSync(chromePath(), [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions',
  '--user-data-dir=' + profile, '--no-pdf-header-footer', '--print-to-pdf=' + OUT, pathToFileURL(SRC).href
], { encoding: 'utf8', timeout: 120000 });

if (!fs.existsSync(OUT)) {
  console.error('The PDF was not written.');
  console.error(String(res.stderr || '').split('\n').filter((l) => /error|fail/i.test(l)).slice(0, 10).join('\n'));
  process.exit(1);
}
console.log('Written: ' + path.relative(ROOT, OUT) + ' (' + Math.round(fs.statSync(OUT).size / 1024) + ' KB)');
