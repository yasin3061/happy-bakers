/*
 * The house rules a machine can read (docs/SPEC.md section 2, docs/PAGES.md), checked on page files:
 *
 *   node tools/harness/lint.js js/pages/buy-orders.js css/pages/p-buy-orders.css
 *
 * It prints file:line for each finding and exits 1 if there is any. It reads text, not syntax: a finding inside a
 * comment counts as well, and what it cannot see (a figure computed in the page, a rule written twice) is still
 * yours to check.
 */
'use strict';

const fs = require('fs');

const RULES = [
  { re: /#[0-9a-fA-F]{3,8}\b(?![\w/-])|\brgba?\(|\bhsla?\(/, why: 'a colour: use a token of css/tokens.css (var(--name) in CSS, a token name in JS)', css: true, js: true, skip: /['"]#\/|href|route|#mk-|&#/ },
  { re: /Math\.random|\bDate\.now\b|new Date\b|toISOString|performance\.now/, why: 'the clock or a random number: use HB.calendar and HB.rng', js: true },
  { re: /\.innerHTML|insertAdjacentHTML|document\.write|outerHTML/, why: 'HTML built from strings: use HB.ui.h() and text nodes', js: true },
  { re: /[—–]/, why: 'a dash aside: write a plain sentence', js: true },
  { re: /['"`][^'"`\n]*[A-Za-z]!(?=['"`\s])/, why: 'an exclamation mark in wording', js: true },
  { re: /(?:₹|\bRs\.?)\s?\d|\b\d{1,3}(?:,\d{2,3})+\b/, why: 'a figure typed into the page: every number comes from HB.data, HB.engine or HB.masters', js: true },
  /* an icon named 'bank' (icon: 'bank', ui.icon('bank')) is not an account id */
  { re: /(?<!icon: |icon:|icon\(|Icon: )['"](?:fac_rm|fac_fg|bank|cash_[a-z_]+|st_[a-z]+|transit_[a-z_]+)['"]/, why: 'a fixed location, unit or account id: list them with HB.data.lookup (locations, units, accounts)', js: true },
  { re: /HB\.filters\.get\(|HB\.store\.set\(|localStorage|sessionStorage/, why: 'a page reads ctx.filters and keeps its state in ctx.state; it never writes the store', js: true },
  { re: /HB\.book\b|HB\.engine\.core\b/, why: 'a page reads HB.data and acts through HB.engine.act, preview and check only', js: true },
  { re: /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u, why: 'an emoji: icons are HB.ui.icon()', js: true, css: true }
];

const files = process.argv.slice(2);
if (!files.length) { console.error('usage: node tools/harness/lint.js <file.js|file.css> ...'); process.exit(2); }

let found = 0;
files.forEach((file) => {
  if (!fs.existsSync(file)) { console.log(file + ': no such file (a page with no rules of its own has no CSS file)'); return; }
  const css = /\.css$/i.test(file);
  fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, i) => {
    RULES.forEach((rule) => {
      if (!(css ? rule.css : rule.js) || !rule.re.test(line) || (rule.skip && rule.skip.test(line))) return;
      found++;
      console.log(file + ':' + (i + 1) + '  ' + rule.why + '\n    ' + line.trim().slice(0, 140));
    });
  });
});
console.log(found ? '\n' + found + ' finding' + (found === 1 ? '' : 's') : 'clean: ' + files.join(', '));
process.exit(found ? 1 : 0);
