/*
 * Page harness: drives the real app in headless Chrome and prints what happened. No server, no packages.
 *
 *   node tools/harness/run.js <steps.js> [--name=mine] [--date=2026-10-02] [--seed=off] [--keep] [--shot=out.png] [--size=1024x768] [--budget=60000]
 *
 * It builds a scratch copy of index.html in the system temp folder (never in the project), its css, js and vendor
 * paths made absolute, with tools/harness/driver.js and your steps file added after js/app.js, and opens it from
 * file:// in Chrome with a profile of its own:
 *
 *   <temp>/hb-harness/<name>/page.html      the scratch page
 *   <temp>/hb-harness/<name>/profile/       Chrome's --user-data-dir: this run's own localStorage
 *
 * <name> defaults to the steps file's name, so two people (or two runs) with different names never share storage.
 *   --date    the business date of the copy (default: the device's date, as for a first open)
 *   --seed=off   leave js/data/seed.js out: the book is the opening entries of 1 January 2026 plus what the steps post
 *   --keep    keep the profile from the last run of that name: the way to test that a reload keeps what was entered
 *   --shot    also save a picture of the screen as the steps left it, to look at the layout
 *   --size    the window, default 1440x1000; the sample must hold from 1024 wide (--size=1024x768). The picture of
 *             --shot is taken at exactly that size, but the steps run inside Chrome's window frame, 18 px narrower and
 *             96 px shorter: steps that measure the layout at a true 1024 wide need --size=1042x864
 *   --budget  virtual milliseconds Chrome may run (timers are fast-forwarded)
 * Exit code 1 when a check failed, the page logged an error, or the steps did not finish. A page error is an
 * uncaught exception, a console.error, or a stylesheet or script the page names that did not load.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..', '..');
const flags = {}, rest = [];
process.argv.slice(2).forEach((a) => { const m = /^--([\w-]+)(?:=(.*))?$/.exec(a); if (m) flags[m[1]] = m[2] === undefined ? true : m[2]; else rest.push(a); });
if (!rest[0]) { console.error('usage: node tools/harness/run.js <steps.js> [--name=x] [--date=YYYY-MM-DD] [--seed=off] [--keep] [--shot=out.png] [--budget=ms]'); process.exit(2); }

const steps = path.resolve(rest[0]);
const name = String(flags.name || path.basename(steps, '.js')).replace(/[^\w.-]/g, '_');
const dir = path.join(os.tmpdir(), 'hb-harness', name);
const profile = path.join(dir, 'profile');

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

if (!flags.keep) fs.rmSync(profile, { recursive: true, force: true });
fs.mkdirSync(profile, { recursive: true });

/* the first script of the page: trap errors before anything else runs, and fix the business date of a new copy */
const first = '<script>(function(){var o=window.__hbt={checks:[],notes:[],errors:[]};' +
  'window.addEventListener("error",function(e){if(e.message)o.errors.push(e.message+" @"+String(e.filename).split("/").pop()+":"+e.lineno);});' +
  /* a file that did not load raises no message: it is caught on the way down, at the element that asked for it */
  'window.addEventListener("error",function(e){var t=e.target;if(t&&t!==window&&(t.src||t.href))o.errors.push("did not load: "+String(t.src||t.href).split("/").slice(-2).join("/"));},true);' +
  'var ce=console.error;console.error=function(){o.errors.push([].map.call(arguments,function(a){return a&&a.stack?a.stack:String(a);}).join(" "));ce.apply(console,arguments);};' +
  (flags.date ? 'try{if(!localStorage.getItem("hb.v1.meta"))localStorage.setItem("hb.v1.meta",JSON.stringify({businessDate:' + JSON.stringify(String(flags.date)) + '}));}catch(e){}' : '') +
  '})();</script>';

let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
/* no <base>: it would turn every '#/route' link into a link to the project folder. The asset paths are made absolute instead. */
const base = pathToFileURL(ROOT).href + '/';
html = html.replace('<head>', '<head>\n  ' + first).replace(/(href|src)="(css|js|vendor)\//g, '$1="' + base + '$2/');
if (flags.seed === 'off') html = html.replace(/\s*<script src="[^"]*js\/data\/seed\.js"><\/script>/, '');
html = html.replace('</body>', '  <script src="' + pathToFileURL(path.join(__dirname, 'driver.js')).href + '"></script>\n' +
  '  <script src="' + pathToFileURL(steps).href + '"></script>\n</body>');
const page = path.join(dir, 'page.html');
fs.writeFileSync(page, html);

const res = cp.spawnSync(chromePath(), [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--hide-scrollbars',
  '--user-data-dir=' + profile, '--window-size=' + (/^\d+x\d+$/.test(String(flags.size)) ? String(flags.size).replace('x', ',') : '1440,1000'), '--virtual-time-budget=' + (Number(flags.budget) || 60000),
  '--dump-dom', pathToFileURL(page).href
].concat(typeof flags.shot === 'string' ? ['--screenshot=' + path.resolve(flags.shot)] : []), { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 180000 });

const m = /<pre id="hbt-out">([\s\S]*?)<\/pre>/.exec(res.stdout || '');
if (!m) {
  console.error('The steps did not finish (no results in the page). Raise --budget, or look for an error below.');
  console.error(String(res.stderr || '').split('\n').filter((l) => /error|exception/i.test(l)).slice(0, 20).join('\n'));
  process.exit(1);
}
const out = JSON.parse(m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
out.notes.forEach((n) => console.log('  note  ' + n.label + ': ' + (typeof n.value === 'string' ? n.value : JSON.stringify(n.value))));
out.checks.forEach((c) => console.log((c.ok ? '  ok    ' : '  FAIL  ') + c.label + (c.detail ? '\n          ' + c.detail : '')));
out.errors.forEach((e) => console.log('  ERROR ' + e));
const failed = out.checks.filter((c) => !c.ok).length;
console.log('\n' + name + ': ' + out.checks.length + ' checks, ' + failed + ' failed, ' + out.errors.length + ' page errors');
process.exit(failed || out.errors.length ? 1 : 0);
