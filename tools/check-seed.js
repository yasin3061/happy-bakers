/*
 * Part (b) of SPEC section 11 and the behaviour of the seed (SCOPE section 7): the full seed reconciled by a
 * separate straight pass over the raw documents, determinism and prefix stability on seq, the hand-over of
 * SPEC 6 for every simulated day, the guide journeys of SPEC 8.1 through HB.engine.act on business dates spread
 * over the two years, the calibration bands of RESEARCH 13 (HB.config.calibration) each with its figure, the
 * eight stories of RESEARCH 12 on each business date, and the build time for the three dates.
 *   node tools/check-seed.js            every section
 *   node tools/check-seed.js quick      the sections that need one run only (no journeys, no prefix pairs)
 *   node tools/check-seed.js b | c      one part of SPEC 11: (b) the seed reconciled, (c) the stories and journeys on it
 * Exit code 1 on any failure. tools/check.js runs the two parts through the exported function, run({ part }),
 * which returns the sections; `node tools/check.js` is the whole self-check.
 * Nothing here reads HB.data or engine balances for a reconciliation: the straight pass works on
 * HB.book.docList and compares with the ledgers and the running balances the engine keeps.
 */
'use strict';

var path = require('path');
var ROOT = path.join(__dirname, '..');

/* ====================================================== the assert kit */

var sections = [], sec = null, out = [];
var onlyPart = null, partNow = 'b'; /* run({ part: 'b' | 'c' }) keeps the sections of that part; partNow is the part of the sections that follow */

function say(line) { out.push(line); if (sec) sec.lines.push(line); }

function section(title, fn) {
  if (onlyPart && onlyPart !== partNow) return;
  sec = { title: title, checks: 0, failures: [], lines: [] };
  sections.push(sec);
  var t0 = Date.now();
  try { fn(); }
  catch (e) { sec.failures.push('stopped by an error: ' + (e && e.stack ? e.stack.split('\n').slice(0, 5).join(' | ') : String(e))); }
  sec.ms = Date.now() - t0;
}

function fail(message) { sec.failures.push(message); }

/** The one assertion. */
function check(label, cond, detail) {
  sec.checks++;
  if (!cond) fail(label + (detail !== undefined ? ' - ' + detail : ''));
  return !!cond;
}

function eq(label, got, want) {
  return check(label, got === want, 'expected ' + JSON.stringify(want) + ', got ' + JSON.stringify(got));
}

/** A band: the figure must lie in [min, max] (either end may be missing); the figure is always reported. */
function band(n, label, value, min, max, unit) {
  var okv = typeof value === 'number' && isFinite(value) && (min === undefined || min === null || value >= min - 1e-9) && (max === undefined || max === null || value <= max + 1e-9);
  var text = 'band ' + n + ' ' + label + ': ' + show(value, unit) + ' [' + (min === undefined || min === null ? '' : show(min, unit)) + ' .. ' + (max === undefined || max === null ? '' : show(max, unit)) + ']';
  say((okv ? '    ok   ' : '    FAIL ') + text);
  sec.checks++;
  if (!okv) fail(text);
  return okv;
}

function show(v, unit) {
  if (typeof v !== 'number' || !isFinite(v)) return String(v);
  if (unit === 'paise') return 'Rs ' + (Math.abs(v) >= 1e7 ? (v / 1e7).toFixed(2) + ' lakh' : (v / 100).toFixed(0));
  if (unit === 'pct') return (v * 100).toFixed(2) + '%';
  if (unit === 'int') return String(v);
  return (Math.round(v * 1000) / 1000).toString();
}

function lakh(p) { return (p / 1e7).toFixed(2); }

/* ================================================================ load */

var HB = null, cfg = null, sim = null, E = null, core = null, D = null, money = null, q3 = null;
var previous = null; /* what HB.config and HB.seed were before this check ran, for the caller */

function fresh(file) {
  var full = path.join(ROOT, file);
  delete require.cache[require.resolve(full)];
  return require(full);
}

function load() {
  HB = require(path.join(ROOT, 'js', 'core', 'kernel.js'));
  previous = { config: HB.config, seed: HB.seed };
  fresh('js/data/config.js');
  require(path.join(ROOT, 'js', 'data', 'engine.js'));
  fresh('js/data/seed.js');
  cfg = HB.config; sim = cfg.sim; E = HB.engine; core = E.core; D = HB.dates; money = HB.money; q3 = HB.q3;
  HB.engine.reset();
}

function restore() {
  if (!previous) return;
  HB.config = previous.config;
  HB.seed = previous.seed;
  HB.store.resetAll();
  if (HB.config) HB.engine.reset();
}

/** Boot a copy for a business date with no user log, and return the book. */
function bootAt(date) {
  HB.store.remove('log');
  HB.calendar.set(date);
  return HB.engine.boot();
}

/** The seed alone, run through `toDate` (included) on a fresh book, with an optional per-day hook. */
function runTo(toDate, hooks) {
  HB.engine.reset();
  return HB.seed.run(toDate, hooks);
}

/* =========================================================== hashing */

/** A hash of the first n rows of a ledger (all of it when n is left out): the figures and ids, not the object identity. */
function hashRows(rows, n) {
  var h = 2166136261 >>> 0, i, r, k, keys = null, s;
  n = n === undefined ? rows.length : n;
  for (i = 0; i < n; i++) {
    r = rows[i];
    if (!keys) keys = Object.keys(r);
    s = '';
    for (k = 0; k < keys.length; k++) s += '|' + r[keys[k]];
    h = (Math.imul(h ^ HB.hash(s), 16777619) + i) >>> 0;
  }
  return h + ':' + n;
}

/** The ledgers hashed (their rows never change once written); the documents by id, seq, type and date (a status moves on). */
function ledgerHashes(book, lengths) {
  var L = lengths || {};
  return {
    docs: hashRows(book.docList.map(function (d) { return { id: d.id, seq: d.seq, type: d.type, date: d.date }; }), L.docs),
    moves: hashRows(book.moves, L.moves), ar: hashRows(book.ar.entries, L.ar), ap: hashRows(book.ap.entries, L.ap),
    cash: hashRows(book.cash.entries, L.cash), pnl: hashRows(book.pnl, L.pnl), gst: hashRows(book.gst, L.gst),
    audit: hashRows(book.audit, L.audit)
  };
}

function ledgerLengths(book) {
  return { docs: book.docList.length, moves: book.moves.length, ar: book.ar.entries.length, ap: book.ap.entries.length,
    cash: book.cash.entries.length, pnl: book.pnl.length, gst: book.gst.length, audit: book.audit.length };
}

/* ============================================ the straight pass (b) */

function add(map, key, v) { map[key] = (map[key] || 0) + v; }

/**
 * Everything recomputed from the raw documents alone, then compared with the ledgers and the running balances.
 * A cancelled document counts on its date and its negative on the date of its CXL; for the balances as they
 * stand now the two net to nothing, so a cancelled document is left out of a balance and put into the months.
 */
function reconcile(book) {
  var M = HB.masters, docs = book.docList, i, j, k, doc, l, b, key, mk;
  var stock = {}, lots = {}, ar = { total: 0, byCustomer: {} }, cash = {}, pnl = {}, gst = {}, apTotal = 0, apBy = {};
  var invRecv = {}, invCred = {}, credit = {}, billPaid = {}, cxlOf = {};
  var channelOf = {};
  for (i = 0; i < M.customers.length; i++) channelOf[M.customers[i].id] = M.customers[i].channel;
  var unitOfLoc = {};
  for (i = 0; i < M.locations.length; i++) unitOfLoc[M.locations[i].id] = M.locations[i].unitId;
  var storeUnit = {};
  for (i = 0; i < M.units.length; i++) if (M.units[i].kind === 'store') storeUnit[M.units[i].id] = M.units[i];

  function mv(loc, item, batch, qty) {
    key = loc + '|' + item;
    stock[key] = q3((stock[key] || 0) + qty);
    if (batch) add(lots, key + '|' + batch, qty);
  }
  function pl(date, line, k2, amount) {
    mk = date.slice(0, 7);
    add(pnl, mk + '|' + line + '|' + k2, amount);
  }
  function tax(date, dir, rate, taxable, cgst, sgst, sign) {
    mk = date.slice(0, 7);
    key = mk + '|' + dir + '|' + rate;
    var g = gst[key] || (gst[key] = { taxable: 0, cgst: 0, sgst: 0 });
    g.taxable += sign * taxable; g.cgst += sign * cgst; g.sgst += sign * sgst;
  }
  /* what a document wrote, by its own figures */
  function apply(doc, sign, date) {
    var st = doc.status, cust = doc.customerId, lines = doc.lines || [];
    switch (doc.type) {
      case 'OPENSTOCK':
        for (j = 0; j < lines.length; j++) mv(lines[j].locId, lines[j].itemId, lines[j].batchId, sign * lines[j].qty);
        break;
      case 'OPENCASH':
        for (j = 0; j < lines.length; j++) add(cash, lines[j].accountId, sign * lines[j].amount);
        break;
      case 'GRN':
        for (j = 0; j < lines.length; j++) if (lines[j].qty > 0) mv('fac_rm', lines[j].itemId, null, sign * lines[j].qty);
        break;
      case 'VBILL':
        if (st === 'POSTED' || (st === 'CANCELLED' && doc.cancelledFrom === 'POSTED')) {
          apTotal += sign * doc.total; add(apBy, 'vendor:' + doc.vendorId, sign * doc.total);
          for (j = 0; j < lines.length; j++) tax(date, 'input', lines[j].gstRate, lines[j].taxable, lines[j].cgst, lines[j].sgst, sign);
        }
        break;
      case 'PAY':
        add(cash, doc.account, -sign * doc.amount);
        apTotal -= sign * doc.amount; add(apBy, doc.payeeType + ':' + doc.payeeId, -sign * doc.amount);
        for (j = 0; j < doc.allocations.length; j++) add(billPaid, doc.allocations[j].docId, sign * doc.allocations[j].amount);
        break;
      case 'PROD':
        for (j = 0; j < doc.consumption.length; j++) mv('fac_rm', doc.consumption[j].itemId, null, -sign * doc.consumption[j].qty);
        mv('fac_fg', doc.itemId, doc.batchId, sign * doc.goodUnits);
        if (doc.lossValue !== 0) pl(date, 'prodLoss', 'all', sign * doc.lossValue);
        break;
      case 'INV':
        ar.total += sign * doc.total; add(ar.byCustomer, cust, sign * doc.total);
        if (doc.opening) break;
        for (j = 0; j < lines.length; j++) {
          l = lines[j];
          for (k = 0; k < l.batches.length; k++) mv('fac_fg', l.itemId, l.batches[k].batchId, -sign * l.batches[k].qty);
          tax(date, 'output', l.gstRate, l.taxable, l.cgst, l.sgst, sign);
        }
        if (doc.paidNow > 0) { ar.total -= sign * doc.paidNow; add(ar.byCustomer, cust, -sign * doc.paidNow); add(cash, 'cash_factory', sign * doc.paidNow); }
        add(credit, cust, -sign * doc.creditApplied);
        pl(date, 'sales', doc.channel, sign * doc.taxable);
        pl(date, 'cogs', doc.channel, sign * doc.cost);
        break;
      case 'RCPT':
        add(cash, doc.account, sign * doc.amount);
        ar.total -= sign * doc.amount; add(ar.byCustomer, cust, -sign * doc.amount);
        for (j = 0; j < doc.allocations.length; j++) add(invRecv, doc.allocations[j].docId, sign * doc.allocations[j].amount);
        add(credit, cust, sign * doc.onAccount);
        break;
      case 'CN':
        if (st === 'POSTED' || (st === 'CANCELLED' && doc.cancelledFrom === 'POSTED')) {
          ar.total -= sign * doc.total; add(ar.byCustomer, cust, -sign * doc.total);
          for (j = 0; j < doc.allocations.length; j++) add(invCred, doc.allocations[j].docId, sign * doc.allocations[j].amount);
          add(credit, cust, sign * doc.onAccount);
          pl(date, 'returns', doc.channel, -sign * doc.taxable);
          for (j = 0; j < lines.length; j++) tax(date, 'output', lines[j].gstRate, lines[j].taxable, lines[j].cgst, lines[j].sgst, -sign);
        }
        break;
      case 'XFER':
        var u = storeUnit[doc.toStoreId];
        for (j = 0; j < lines.length; j++) for (k = 0; k < lines[j].batches.length; k++) {
          b = lines[j].batches[k];
          mv('fac_fg', lines[j].itemId, b.batchId, -sign * b.qty);
          mv(st === 'RECEIVED' ? u.locId : u.transitLocId, lines[j].itemId, b.batchId, sign * b.qty);
        }
        break;
      case 'DAYEND':
        for (j = 0; j < lines.length; j++) {
          l = lines[j];
          for (k = 0; k < l.batches.length; k++) mv(storeUnit[doc.storeId].locId, l.itemId, l.batches[k].batchId, -sign * l.batches[k].qty);
          if (l.sold > 0) tax(date, 'output', l.gstRate, l.taxable, l.cgst, l.sgst, sign);
        }
        if (doc.cash > 0) add(cash, storeUnit[doc.storeId].cashAccountId, sign * doc.cash);
        if (doc.upi > 0) add(cash, 'bank', sign * doc.upi);
        if (doc.units > 0) { pl(date, 'sales', 'store', sign * doc.taxable); pl(date, 'cogs', 'store', sign * doc.cost); }
        if (doc.shortExcess !== 0) pl(date, 'expense', M.shortExcessCategoryId + '|' + doc.storeId, -sign * doc.shortExcess);
        break;
      case 'DEP':
        add(cash, doc.fromAccount, -sign * doc.amount); add(cash, 'bank', sign * doc.amount);
        break;
      case 'ADJ':
        if (st === 'POSTED' || (st === 'CANCELLED' && doc.cancelledFrom === 'POSTED')) {
          for (j = 0; j < lines.length; j++) {
            if (lines[j].diff === 0) continue;
            mv(doc.locId, lines[j].itemId, lines[j].batchId, sign * lines[j].diff);
            if (lines[j].value !== 0) pl(date, 'countDiff', 'all', -sign * lines[j].value);
          }
        }
        break;
      case 'WO':
        if (st === 'POSTED' || (st === 'CANCELLED' && doc.cancelledFrom === 'POSTED')) {
          for (j = 0; j < lines.length; j++) {
            mv(doc.locId, lines[j].itemId, lines[j].batchId, -sign * lines[j].qty);
            pl(date, 'writeoff', 'all', sign * lines[j].value);
          }
        }
        break;
      case 'EXP':
        if (st === 'APPROVED' || st === 'PAID' || (st === 'CANCELLED' && doc.cancelledFrom === 'APPROVED')) {
          apTotal += sign * doc.total; add(apBy, doc.payeeType + ':' + doc.payeeId, sign * doc.total);
          if (doc.kind === 'salary') for (j = 0; j < lines.length; j++) pl(date, 'expense', doc.categoryId + '|' + lines[j].unitId, sign * lines[j].amount);
          else pl(date, 'expense', doc.categoryId + '|' + doc.unitId, sign * doc.amount);
          if (doc.gst > 0) tax(date, 'input', doc.gstRate, doc.amount, doc.cgst, doc.sgst, sign);
        }
        break;
    }
  }
  /* a cancelled document: its rows on its date, the opposite on the day of its CXL; nothing in the balances */
  for (i = 0; i < docs.length; i++) if (docs[i].type === 'CXL') cxlOf[docs[i].targetId] = docs[i];
  var cancelledCount = 0;
  for (i = 0; i < docs.length; i++) {
    doc = docs[i];
    if (doc.type === 'CXL') continue;
    if (doc.status === 'CANCELLED') {
      cancelledCount++;
      var cx = cxlOf[doc.id];
      if (!cx) { fail(doc.id + ' is cancelled but has no cancellation document'); continue; }
      /* the status it was cancelled from: the audit row of the cancellation says */
      for (j = book.audit.length - 1; j >= 0; j--) if (book.audit[j].action === 'cancel' && book.audit[j].docId === doc.id) { doc.cancelledFrom = book.audit[j].before; break; }
      var pnlBefore = pnl, gstBefore = gst;
      /* rows into the months, and the same rows negated on the CXL date; balances untouched */
      pnl = {}; gst = {};
      var stockBefore = stock, lotsBefore = lots, arBefore = ar, cashBefore = cash, apBefore = apTotal, apByBefore = apBy, creditBefore = credit, recvBefore = invRecv, credBefore = invCred, paidBefore = billPaid;
      stock = {}; lots = {}; ar = { total: 0, byCustomer: {} }; cash = {}; apTotal = 0; apBy = {}; credit = {}; invRecv = {}; invCred = {}; billPaid = {};
      apply(doc, 1, doc.date);
      apply(doc, -1, cx.date);
      for (k in pnl) if (Object.prototype.hasOwnProperty.call(pnl, k)) add(pnlBefore, k, pnl[k]);
      for (k in gst) if (Object.prototype.hasOwnProperty.call(gst, k)) { var g0 = gstBefore[k] || (gstBefore[k] = { taxable: 0, cgst: 0, sgst: 0 }); g0.taxable += gst[k].taxable; g0.cgst += gst[k].cgst; g0.sgst += gst[k].sgst; }
      pnl = pnlBefore; gst = gstBefore; stock = stockBefore; lots = lotsBefore; ar = arBefore; cash = cashBefore; apTotal = apBefore; apBy = apByBefore; credit = creditBefore; invRecv = recvBefore; invCred = credBefore; billPaid = paidBefore;
      continue;
    }
    apply(doc, 1, doc.date);
  }

  /* ---- stock: the documents, the ledger and the balances agree; the ledger never goes below zero */
  var moves = book.moves, run = {}, runBatch = {}, negative = 0, ledger = {}, ledgerLots = {}, r, kb, prev = 0;
  for (i = 0; i < moves.length; i++) {
    r = moves[i];
    if (r.seq <= prev) negative += 1000000; /* out of order */
    prev = r.seq;
    key = r.locId + '|' + r.itemId;
    run[key] = q3((run[key] || 0) + r.qty);
    if (run[key] < 0) negative++;
    if (r.batchId) { kb = key + '|' + r.batchId; runBatch[kb] = (runBatch[kb] || 0) + r.qty; if (runBatch[kb] < 0) negative++; }
  }
  ledger = run; ledgerLots = runBatch;
  var stockDiff = 0, lotDiff = 0, n = 0;
  var keys = {};
  for (k in stock) keys[k] = 1;
  for (k in ledger) keys[k] = 1;
  for (k in book.stock) for (j in book.stock[k]) keys[k + '|' + j] = 1;
  for (k in keys) {
    var parts = k.split('|'), onBook = (book.stock[parts[0]] || {})[parts[1]] || 0;
    n++;
    if (Math.abs((stock[k] || 0) - onBook) > 1e-9) stockDiff++;
    if (Math.abs((ledger[k] || 0) - onBook) > 1e-9) stockDiff++;
  }
  for (k in lots) {
    parts = k.split('|');
    var lotList = (book.lots[parts[0]] || {})[parts[1]] || [], onHand = 0;
    for (j = 0; j < lotList.length; j++) if (lotList[j].batchId === parts[2]) onHand = lotList[j].qty;
    if (Math.abs((lots[k] || 0) - onHand) > 1e-9 || Math.abs((ledgerLots[k] || 0) - onHand) > 1e-9) lotDiff++;
  }
  check('stock from the documents = the movement ledger = the balances, every location and item (' + n + ' pairs)', stockDiff === 0, stockDiff + ' differ');
  check('every batch from the documents = the ledger = the lots on hand', lotDiff === 0, lotDiff + ' differ');
  check('the movement ledger never goes below zero in posting order, by item and by batch (' + moves.length + ' rows)', negative === 0, negative + ' rows below zero or out of order');

  /* ---- receivables */
  var arRows = 0;
  for (i = 0; i < book.ar.entries.length; i++) arRows += book.ar.entries[i].amount;
  eq('receivables = invoices (opening included) - collected at the drop - receipts - credit notes = the ledger', ar.total, arRows);
  eq('receivables = the running total', ar.total, book.ar.total);
  var custDiff = 0, custN = 0, openDiff = 0, creditNeg = 0;
  var openSum = {}, creditOf = {};
  for (i = 0; i < docs.length; i++) {
    doc = docs[i];
    if (doc.type !== 'INV' || doc.status !== 'POSTED') continue;
    var open = doc.total - doc.creditApplied - doc.paidNow - (invRecv[doc.id] || 0) - (invCred[doc.id] || 0);
    if (open < 0) openDiff++;
    if (doc.received !== (invRecv[doc.id] || 0) || doc.credited !== (invCred[doc.id] || 0)) openDiff++;
    add(openSum, doc.customerId, open);
  }
  for (k in credit) if (credit[k] < 0) creditNeg++;
  for (i = 0; i < M.customers.length; i++) {
    k = M.customers[i].id; custN++;
    var bal = (openSum[k] || 0) - (credit[k] || 0);
    if (bal !== (book.ar.balance[k] || 0) || bal !== (ar.byCustomer[k] || 0)) custDiff++;
    if ((credit[k] || 0) !== (book.ar.credit[k] || 0)) custDiff++;
  }
  check('per customer: open invoices less unapplied credit = the receivable entries = the running balance (' + custN + ' customers)', custDiff === 0, custDiff + ' differ');
  check('invoice open amounts from the allocations are never below zero and equal received and credited on the invoice', openDiff === 0, openDiff + ' differ');
  check('unapplied credit never below zero', creditNeg === 0, creditNeg + ' customers');

  /* ---- payables */
  var apRows = 0;
  for (i = 0; i < book.ap.entries.length; i++) apRows += book.ap.entries[i].amount;
  eq('payables = posted bills (opening included) + approved expenses - payments = the ledger', apTotal, apRows);
  eq('payables = the running total', apTotal, book.ap.total);
  var payeeDiff = 0, payeeN = 0, paidDiff = 0;
  for (k in book.ap.balance) { payeeN++; if ((apBy[k] || 0) !== book.ap.balance[k]) payeeDiff++; }
  for (k in apBy) if (book.ap.balance[k] === undefined && apBy[k] !== 0) payeeDiff++;
  for (i = 0; i < docs.length; i++) {
    doc = docs[i];
    if ((doc.type === 'VBILL' || doc.type === 'EXP') && doc.paid !== (billPaid[doc.id] || 0)) paidDiff++;
    if ((doc.type === 'VBILL' || doc.type === 'EXP') && doc.paid > doc.total) paidDiff++;
  }
  check('per payee: the documents = the running balance (' + payeeN + ' payees)', payeeDiff === 0, payeeDiff + ' differ');
  check('paid on every bill and expense = its payment allocations, never above the total', paidDiff === 0, paidDiff + ' differ');

  /* ---- cash and bank */
  var cashDiff = 0, cashNeg = 0, runCash = {}, cashRows = {};
  for (i = 0; i < book.cash.entries.length; i++) {
    r = book.cash.entries[i];
    runCash[r.accountId] = (runCash[r.accountId] || 0) + r.amount;
    if (runCash[r.accountId] < 0) cashNeg++;
  }
  cashRows = runCash;
  for (i = 0; i < M.accounts.length; i++) {
    k = M.accounts[i].id;
    if ((cash[k] || 0) !== (book.cash.balance[k] || 0) || (cashRows[k] || 0) !== (book.cash.balance[k] || 0)) cashDiff++;
  }
  check('cash and bank from the documents = the cash book = the balances (' + M.accounts.length + ' accounts)', cashDiff === 0, cashDiff + ' differ');
  check('no cash account and not the bank ever below zero in posting order (' + book.cash.entries.length + ' rows)', cashNeg === 0, cashNeg + ' rows below zero');

  /* ---- P&L: every line of every month from the documents behind it, against the month totals and the rows */
  var rowsByCell = {}, pnlDiff = 0, cellN = 0;
  for (i = 0; i < book.pnl.length; i++) {
    r = book.pnl[i];
    key = r.date.slice(0, 7) + '|' + r.line + '|' + (r.line === 'expense' ? r.categoryId + '|' + r.unitId : (r.channel || 'all'));
    add(rowsByCell, key, r.amount);
  }
  keys = {};
  for (k in pnl) keys[k] = 1;
  for (k in rowsByCell) keys[k] = 1;
  for (mk in book.pnlMonth) for (var line in book.pnlMonth[mk]) for (k in book.pnlMonth[mk][line]) keys[mk + '|' + line + '|' + k] = 1;
  for (k in keys) {
    parts = k.split('|');
    var cell = (book.pnlMonth[parts[0]] && book.pnlMonth[parts[0]][parts[1]]) ? book.pnlMonth[parts[0]][parts[1]][parts.slice(2).join('|')] || 0 : 0;
    cellN++;
    if ((pnl[k] || 0) !== cell || (rowsByCell[k] || 0) !== cell) { pnlDiff++; if (pnlDiff <= 3) say('      P&L differs at ' + k + ': documents ' + (pnl[k] || 0) + ', rows ' + (rowsByCell[k] || 0) + ', month total ' + cell); }
  }
  check('every P&L cell of every month from the documents = the rows = the month total (' + cellN + ' cells)', pnlDiff === 0, pnlDiff + ' differ');

  /* ---- GST from the lines */
  var gstRows = {}, gstDiff = 0, gstN = 0;
  for (i = 0; i < book.gst.length; i++) {
    r = book.gst[i];
    key = r.date.slice(0, 7) + '|' + r.dir + '|' + r.gstRate;
    var g = gstRows[key] || (gstRows[key] = { taxable: 0, cgst: 0, sgst: 0 });
    g.taxable += r.taxable; g.cgst += r.cgst; g.sgst += r.sgst;
  }
  keys = {};
  for (k in gst) keys[k] = 1;
  for (k in gstRows) keys[k] = 1;
  for (k in keys) {
    var a = gst[k] || { taxable: 0, cgst: 0, sgst: 0 }, b2 = gstRows[k] || { taxable: 0, cgst: 0, sgst: 0 };
    gstN++;
    if (a.taxable !== b2.taxable || a.cgst !== b2.cgst || a.sgst !== b2.sgst) gstDiff++;
  }
  check('GST by month, direction and rate from the lines = the GST rows (' + gstN + ' cells)', gstDiff === 0, gstDiff + ' differ');

  /* ---- the arithmetic of the lines, recomputed with the kernel's one money function */
  var lineBad = 0, lineN = 0;
  function tx(taxable, rate) { return Math.round(taxable * rate / 200); }
  for (i = 0; i < docs.length; i++) {
    doc = docs[i];
    var sumTx = 0, sumGst = 0, sumCost = 0, sumUnits = 0, sumGross = 0;
    if (doc.type === 'INV' && !doc.opening) {
      for (j = 0; j < doc.lines.length; j++) {
        l = doc.lines[j]; lineN++;
        if (l.taxable !== money.amount(l.qty, l.price) || l.cgst !== tx(l.taxable, l.gstRate) || l.sgst !== l.cgst || l.cost !== money.amount(l.qty, l.unitCost)) lineBad++;
        sumTx += l.taxable; sumGst += l.cgst + l.sgst; sumCost += l.cost; sumUnits += l.qty;
      }
      if (doc.taxable !== sumTx || doc.gst !== sumGst || doc.total !== sumTx + sumGst || doc.cost !== sumCost || doc.units !== sumUnits) lineBad++;
      if (doc.paidNow !== (doc.terms === 'cash' ? doc.total - doc.creditApplied : 0)) lineBad++;
    } else if (doc.type === 'CN') {
      for (j = 0; j < doc.lines.length; j++) {
        l = doc.lines[j]; lineN++;
        if (l.taxable !== money.amount(l.qty, l.price) || l.cgst !== tx(l.taxable, l.gstRate) || l.sgst !== l.cgst) lineBad++;
        sumTx += l.taxable; sumGst += l.cgst + l.sgst;
      }
      if (doc.taxable !== sumTx || doc.gst !== sumGst || doc.total !== sumTx + sumGst) lineBad++;
    } else if (doc.type === 'DAYEND') {
      for (j = 0; j < doc.lines.length; j++) {
        l = doc.lines[j]; lineN++;
        var cg = Math.round(l.gross * l.gstRate / (2 * (100 + l.gstRate)));
        if (l.gross !== money.amount(l.sold, l.mrp) || l.cgst !== cg || l.sgst !== cg || l.taxable !== l.gross - cg - cg || l.cost !== money.amount(l.sold, l.unitCost)) lineBad++;
        sumGross += l.gross; sumTx += l.taxable; sumGst += l.cgst + l.sgst; sumCost += l.cost; sumUnits += l.sold;
      }
      if (doc.gross !== sumGross || doc.taxable !== sumTx || doc.gst !== sumGst || doc.cost !== sumCost || doc.units !== sumUnits || doc.shortExcess !== doc.cash + doc.upi - doc.gross) lineBad++;
    } else if (doc.type === 'VBILL' && !doc.opening) {
      for (j = 0; j < doc.lines.length; j++) {
        l = doc.lines[j]; lineN++;
        if (l.taxable !== money.amount(l.qty, l.rate) || l.cgst !== tx(l.taxable, l.gstRate) || l.sgst !== l.cgst) lineBad++;
        sumTx += l.taxable; sumGst += l.cgst + l.sgst;
      }
      if (doc.taxable !== sumTx || doc.gst !== sumGst || doc.total !== sumTx + sumGst) lineBad++;
    } else if (doc.type === 'PO') {
      for (j = 0; j < doc.lines.length; j++) { l = doc.lines[j]; lineN++; if (l.amount !== money.amount(l.qty, l.rate)) lineBad++; sumTx += l.amount; }
      if (doc.total !== sumTx) lineBad++;
    } else if (doc.type === 'PROD') {
      lineN++;
      if (doc.lossValue !== money.amount(q3(doc.expectedUnits - doc.goodUnits), doc.unitCost)) lineBad++;
      for (j = 0; j < doc.consumption.length; j++) if (doc.consumption[j].value !== money.amount(doc.consumption[j].qty, doc.consumption[j].rate)) lineBad++;
    } else if (doc.type === 'EXP') {
      lineN++;
      if (doc.cgst !== tx(doc.amount, doc.gstRate) || doc.sgst !== doc.cgst || doc.gst !== doc.cgst + doc.sgst || doc.total !== doc.amount + doc.gst) lineBad++;
    } else if (doc.type === 'WO' || doc.type === 'ADJ') {
      for (j = 0; j < doc.lines.length; j++) { l = doc.lines[j]; lineN++; if (l.value !== money.amount(doc.type === 'WO' ? l.qty : l.diff, l.rate)) lineBad++; }
    } else if (doc.type === 'PAY' || doc.type === 'RCPT') {
      lineN++; var sa = 0;
      for (j = 0; j < doc.allocations.length; j++) sa += doc.allocations[j].amount;
      if (doc.type === 'PAY' ? doc.amount !== sa : doc.onAccount !== doc.amount - sa) lineBad++;
    }
  }
  check('every line value and total is the kernel arithmetic of its quantity and rate (' + lineN + ' lines)', lineBad === 0, lineBad + ' differ');
  return { cancelled: cancelledCount, docs: docs.length };
}

/* =================================================== daily statistics */
/* Collected through the seed's per-day hook, for the bands that are read on every day or at month ends. */

function dayStats(stats, date, dayIdx) {
  var b = HB.book, M = HB.masters, i, j, k, c, lim = M.limits, d1 = D.addDays(date, 1), nearDays = lim.nearExpiryDays;
  var closedNext = sim.calendar.isClosed(d1), closed = sim.calendar.isClosed(date);
  var s = { date: date, open: !closed };
  /* receivables: overdue above zero, C06 above its limit, the others within */
  var overdue = 0, within = true, c06 = 0;
  for (i = 0; i < M.customers.length; i++) {
    c = M.customers[i];
    var list = b.ar.open[c.id] || [];
    for (j = 0; j < list.length; j++) if (list[j].dueDate < date) overdue += E.openAmount(list[j]);
    var bal = b.ar.balance[c.id] || 0;
    if (c.id === 'C06') c06 = bal;
    else if (c.channel === 'corporate' && c.creditLimit > 0 && bal > c.creditLimit) within = false;
  }
  s.overdue = overdue; s.c06 = c06; s.within = within;
  /* payables overdue to the late payers */
  var late = 0;
  ['VM08', 'VM13'].forEach(function (v) {
    var list = b.ap.open['vendor:' + v] || [];
    for (j = 0; j < list.length; j++) if (list[j].dueDate < date) late += list[j].total - list[j].paid;
  });
  s.latePayables = late;
  /* held vendor bills, low stock, factory cash */
  var held = 0, low = 0, id, mat;
  for (id in b.pending) if (b.pending[id].type === 'VBILL') held++;
  s.held = held;
  for (i = 0; i < M.items.length; i++) {
    mat = M.items[i];
    if (mat.kind === 'fg') continue;
    if ((b.stock.fac_rm[mat.id] || 0) <= mat.reorderLevel) low++;
  }
  s.low = low;
  s.cash = b.cash.balance.cash_factory || 0;
  /* near-expiry at each store at the start of the next day: a batch unexpired on d1 whose best-before is within nearExpiryDays of it */
  var near = [], stores = M.units.filter(function (u) { return u.kind === 'store' && u.active !== false; });
  var limitDate = D.addDays(d1, nearDays);
  for (i = 0; i < stores.length; i++) {
    var count = 0, lots = b.lots[stores[i].locId] || {};
    /* a batch on the shelf, a waiting write-off on it or not: the stock page flags it either way */
    for (k in lots) for (j = 0; j < lots[k].length; j++) if (lots[k][j].qty > 0 && lots[k][j].bestBefore >= d1 && lots[k][j].bestBefore <= limitDate) count++;
    near.push(count);
  }
  s.near = near;
  /* net sales of the day, from the day's rows */
  var dayRec = b.days[date], net = 0;
  if (dayRec) for (i = 0; i < dayRec.pnl.length; i++) if (dayRec.pnl[i].line === 'sales' || dayRec.pnl[i].line === 'returns') net += dayRec.pnl[i].amount;
  s.netSales = net;
  /* the material cover: the standard day plan of the next three days against the stock now */
  var need = {}, ok = true, dd = d1, dayN;
  for (dayN = 0; dayN < 3; dayN++) {
    var dow = D.dow(dd);
    for (i = 0; i < M.recipes.length; i++) {
      var rec = M.recipes[i];
      if (!(rec.rhythm === 'daily' || (Array.isArray(rec.rhythm) && rec.rhythm.indexOf(dow) !== -1))) continue;
      for (j = 0; j < rec.materials.length; j++) add(need, rec.materials[j].itemId, rec.materials[j].qty * rec.standardMixes);
      for (j = 0; j < (rec.packing || []).length; j++) add(need, rec.packing[j].itemId, rec.packing[j].qtyPerUnit * rec.expectedUnits * rec.standardMixes);
    }
    dd = D.addDays(dd, 1);
  }
  var shortMat = [];
  for (k in need) if ((b.stock.fac_rm[k] || 0) < need[k] - 1e-9) shortMat.push(k + ' ' + (b.stock.fac_rm[k] || 0) + '<' + need[k].toFixed(1));
  s.cover = shortMat.length === 0; s.coverShort = shortMat;
  /* the hand-over: tomorrow's sheets and transfers as prefilled, the open corporate orders, against the stock unexpired tomorrow */
  s.handOver = true; s.handOverWhy = null;
  if (!closedNext) {
    var want = {}, routes = M.routes, sheet, t, line;
    for (i = 0; i < routes.length; i++) {
      sheet = E.dispatchSheet(routes[i].id, d1);
      for (j = 0; j < sheet.items.length; j++) add(want, sheet.items[j].itemId, sheet.items[j].total);
      if (sheet.outlets.length) {
        t = core.postDispatch({ routeId: routes[i].id, date: d1, outlets: sheet.outlets }, { userId: 'u_sales', role: 'sales', at: d1 + 'T05:30', date: d1, dryRun: true });
        if (!t.ok) { s.handOver = false; s.handOverWhy = routes[i].id + ': ' + t.error.message; }
      }
    }
    for (i = 0; i < stores.length; i++) {
      sheet = E.transferSheet(stores[i].id, d1);
      var lines = [];
      for (j = 0; j < sheet.lines.length; j++) if (sheet.lines[j].qty > 0) { lines.push({ itemId: sheet.lines[j].itemId, qty: sheet.lines[j].qty }); add(want, sheet.lines[j].itemId, sheet.lines[j].qty); }
      if (lines.length) {
        t = core.xfer({ date: d1, toStoreId: stores[i].id, lines: lines }, { userId: 'u_stores', role: 'stores', at: d1 + 'T06:00', date: d1, dryRun: true });
        if (!t.ok) { s.handOver = false; s.handOverWhy = stores[i].id + ': ' + t.error.message; }
      }
    }
    var sos = b.byType.SO;
    for (i = sos.length - 1; i >= 0 && sos[i].date >= D.addDays(date, -6); i--) {
      if (sos[i].status !== 'OPEN' || sos[i].deliveryDate !== d1) continue;
      for (j = 0; j < sos[i].lines.length; j++) add(want, sos[i].lines[j].itemId, sos[i].lines[j].qty);
    }
    for (k in want) if (want[k] > E.available('fac_fg', k, d1)) { s.handOver = false; s.handOverWhy = s.handOverWhy || (k + ': ' + want[k] + ' wanted, ' + E.available('fac_fg', k, d1) + ' available on ' + d1); }
    /* a standard day's production tomorrow, each recipe due */
    var dow1 = D.dow(d1);
    for (i = 0; i < M.recipes.length; i++) {
      rec = M.recipes[i];
      if (!(rec.rhythm === 'daily' || (Array.isArray(rec.rhythm) && rec.rhythm.indexOf(dow1) !== -1)) || !(rec.standardMixes > 0)) continue;
      t = core.prod({ date: d1, itemId: rec.itemId, mixes: rec.standardMixes, goodUnits: Math.round(rec.expectedUnits * rec.standardMixes) }, { userId: 'u_production', role: 'production', at: d1 + 'T16:00', date: d1, dryRun: true });
      if (!t.ok) { s.handOver = false; s.handOverWhy = s.handOverWhy || (rec.itemId + ': ' + t.error.message); }
    }
  }
  /* month-end figures */
  if (D.monthEnd(date) === date) {
    var mk = date.slice(0, 7), m = { date: date, mk: mk };
    m.receivables = b.ar.total;
    var corpAr = 0, corpSales = 0, salesGst = 0, purchases = 0, consumption = 0;
    for (i = 0; i < M.customers.length; i++) if (M.customers[i].channel === 'corporate') corpAr += b.ar.balance[M.customers[i].id] || 0;
    m.corporateReceivables = corpAr;
    /* "days of sales", "of purchases", "of consumption": at the daily rate of the month that ends */
    var days = D.range(mk + '-01', date);
    for (i = 0; i < days.length; i++) {
      var dr = b.days[days[i]];
      if (!dr) continue;
      for (j = 0; j < dr.docs.length; j++) {
        var doc = dr.docs[j];
        if (doc.type === 'INV' && !doc.opening && doc.status !== 'CANCELLED') { salesGst += doc.total; if (doc.channel === 'corporate') corpSales += doc.taxable; }
        else if (doc.type === 'DAYEND' && doc.status !== 'CANCELLED') salesGst += doc.gross;
        else if (doc.type === 'CN' && doc.status === 'POSTED') salesGst -= doc.total;
        else if (doc.type === 'VBILL' && !doc.opening && (doc.status === 'POSTED' || doc.status === 'HELD')) purchases += doc.total;
        else if (doc.type === 'PROD') for (k = 0; k < doc.consumption.length; k++) consumption += doc.consumption[k].value;
      }
    }
    m.days = days.length; m.salesGst = salesGst; m.corporateSales = corpSales; m.purchases = purchases; m.consumption = consumption;
    var stockPay = 0;
    for (i = 0; i < M.vendors.length; i++) if (M.vendors[i].kind === 'stock') stockPay += b.ap.balance['vendor:' + M.vendors[i].id] || 0;
    m.stockPayables = stockPay;
    var rmv = 0, fgv = 0, stv = 0;
    for (k in b.stock.fac_rm) rmv += money.amount(b.stock.fac_rm[k], E.price(k));
    for (k in b.stock.fac_fg) fgv += money.amount(b.stock.fac_fg[k], E.unitCost(k));
    for (i = 0; i < stores.length; i++) for (k in b.stock[stores[i].locId]) stv += money.amount(b.stock[stores[i].locId][k], E.unitCost(k));
    m.materialStock = rmv; m.factoryFinished = fgv; m.storeFinished = stv;
    stats.months.push(m);
  }
  stats.days.push(s);
}

/* ====================================================== the bands (13) */

function bands(book, stats, runEnd) {
  var M = HB.masters, cal = cfg.calibration, docs = book.docList, i, j, k, doc, l;
  var years = {}, months = {}, mk, y;
  function Y(key, store) { return store[key] || (store[key] = { net: 0, sales: 0, retail: 0, corporate: 0, store: 0, byStore: {}, returns: 0, returnsFresh: 0, retailFresh: 0, cogs: 0, prodLoss: 0, writeoff: 0, countDiff: 0, salaries: 0, otherExp: 0, flour: 0, good: 0, expected: 0, dipGood: 0, dipExpected: 0, puffsIn: 0, puffsExpired: 0, po: 0, poAbove: 0, cnHeldOthers: 0, days: 0 }); }
  var groupOf = sim.demand.groupOf, puffs = {};
  for (i = 0; i < M.items.length; i++) if (groupOf[M.items[i].id] === 'PF') puffs[M.items[i].id] = 1;
  var o19 = 0, o19Held = 0, s3Short = [], mixesBad = 0, prodN = 0;
  for (i = 0; i < docs.length; i++) {
    doc = docs[i];
    if (doc.status === 'CANCELLED' || doc.status === 'REJECTED') continue;
    mk = doc.date.slice(0, 7); y = doc.date.slice(0, 4);
    var ym = Y(mk, months), yy = Y(y, years);
    switch (doc.type) {
      case 'INV':
        if (doc.opening) break;
        ym.sales += doc.taxable; yy.sales += doc.taxable;
        ym[doc.channel] += doc.taxable; yy[doc.channel] += doc.taxable;
        if (doc.channel === 'retail') for (j = 0; j < doc.lines.length; j++) { l = doc.lines[j]; if (groupOf[l.itemId] === 'BR' || groupOf[l.itemId] === 'BN') { ym.retailFresh += l.taxable; yy.retailFresh += l.taxable; } }
        ym.cogs += doc.cost; yy.cogs += doc.cost;
        break;
      case 'DAYEND':
        ym.sales += doc.taxable; yy.sales += doc.taxable; ym.store += doc.taxable; yy.store += doc.taxable;
        add(ym.byStore, doc.storeId, doc.taxable); add(yy.byStore, doc.storeId, doc.taxable);
        ym.cogs += doc.cost; yy.cogs += doc.cost;
        ym.otherExp -= doc.shortExcess; yy.otherExp -= doc.shortExcess;
        for (j = 0; j < doc.lines.length; j++) if (puffs[doc.lines[j].itemId]) { ym.puffsExpired += doc.lines[j].expired; yy.puffsExpired += doc.lines[j].expired; }
        break;
      case 'XFER':
        for (j = 0; j < doc.lines.length; j++) if (puffs[doc.lines[j].itemId]) { ym.puffsIn += doc.lines[j].qty; yy.puffsIn += doc.lines[j].qty; }
        break;
      case 'CN':
        ym.returns += doc.taxable; yy.returns += doc.taxable;
        for (j = 0; j < doc.lines.length; j++) { l = doc.lines[j]; if (groupOf[l.itemId] === 'BR' || groupOf[l.itemId] === 'BN') { ym.returnsFresh += l.taxable; yy.returnsFresh += l.taxable; } }
        if (doc.customerId === 'O19') { if (doc.date >= '2026-02-01') { o19++; if (doc.approval.state !== 'none') o19Held++; } }
        else if (doc.approval.state !== 'none') ym.cnHeldOthers++;
        break;
      case 'PROD':
        ym.prodLoss += doc.lossValue; yy.prodLoss += doc.lossValue;
        ym.good += doc.goodUnits; ym.expected += doc.expectedUnits; yy.good += doc.goodUnits; yy.expected += doc.expectedUnits;
        var dip = sim.stories.yieldDip.on(doc.date);
        if (dip && dip.itemId === doc.itemId) { ym.dipGood += doc.goodUnits; ym.dipExpected += doc.expectedUnits; }
        for (j = 0; j < doc.consumption.length; j++) if (doc.consumption[j].itemId === 'RM01' || doc.consumption[j].itemId === 'RM02') { ym.flour += doc.consumption[j].qty; yy.flour += doc.consumption[j].qty; }
        var p = sim.production.byItem[doc.itemId]; prodN++;
        if (p && (doc.mixes < p.smallestRun - p.step - 1e-9 || doc.mixes > p.largestRun + p.step + 1e-9)) mixesBad++;
        break;
      case 'WO':
        for (j = 0; j < doc.lines.length; j++) { ym.writeoff += doc.lines[j].value; yy.writeoff += doc.lines[j].value; }
        break;
      case 'ADJ':
        for (j = 0; j < doc.lines.length; j++) { ym.countDiff -= doc.lines[j].value; yy.countDiff -= doc.lines[j].value; }
        break;
      case 'EXP':
        if (doc.kind === 'salary') { ym.salaries += doc.amount; yy.salaries += doc.amount; }
        else { ym.otherExp += doc.amount; yy.otherExp += doc.amount; }
        break;
      case 'PO':
        if (!/safety/i.test(doc.note || '')) { ym.po++; yy.po++; if (doc.total > M.limits.poAutoApprove) { ym.poAbove++; yy.poAbove++; } }
        break;
    }
    if (doc.type === 'DAYEND' && doc.storeId === 'st_nadiad' && doc.shortExcess < 0) s3Short.push(doc.date);
  }
  var yearList = Object.keys(years).sort().filter(function (yk) { return runEnd >= yk + '-12-31'; });
  var monthList = Object.keys(months).sort().filter(function (mk2) { return runEnd >= D.monthEnd(mk2 + '-01'); });
  function net(x) { return x.sales - x.returns; }
  function mat(x) { return x.cogs + x.prodLoss + x.writeoff + x.countDiff; }
  function profit(x) { return net(x) - mat(x) - x.salaries - x.otherExp; }
  var pct = 'pct', paise = 'paise';

  if (years['2026'] && yearList.indexOf('2026') !== -1) band(1, 'net sales 2026', net(years['2026']), cal.bands[0].min, cal.bands[0].max, paise);
  if (years['2027'] && yearList.indexOf('2027') !== -1) band(2, 'net sales 2027', net(years['2027']), cal.bands[1].min, cal.bands[1].max, paise);
  if (runEnd >= '2026-10-01') {
    var toOct = 0;
    Object.keys(months).forEach(function (m2) { if (m2 <= '2026-09') toOct += net(months[m2]); });
    var oct1 = book.days['2026-10-01'];
    if (oct1) for (i = 0; i < oct1.pnl.length; i++) if (oct1.pnl[i].line === 'sales' || oct1.pnl[i].line === 'returns') toOct += oct1.pnl[i].amount;
    band(3, 'net sales 2026-01-01..2026-10-01', toOct, cal.bands[2].min, cal.bands[2].max, paise);
  }
  var worst = 0, worstMk = '';
  monthList.forEach(function (m2) {
    var exp = cal.months[m2];
    if (!exp) return;
    var dev = Math.abs(net(months[m2]) - exp.netSales) / exp.netSales;
    if (dev > worst) { worst = dev; worstMk = m2; }
  });
  band(4, 'net sales of each month within 3% of RESEARCH 11.6 (worst ' + worstMk + ')', worst, 0, cal.bands[3].tolerance, pct);
  yearList.forEach(function (yk) {
    var yr = years[yk], ndays = D.diffDays(yk + '-01-01', yk + '-12-31') + 1;
    band(5, 'average net sales a day, ' + yk, net(yr) / ndays, cal.bands[4].min, cal.bands[4].max, paise);
  });
  var minDay = Infinity, maxDay = 0, minDate = '', maxDate = '';
  stats.days.forEach(function (s) { if (!s.open) return; if (s.netSales < minDay) { minDay = s.netSales; minDate = s.date; } if (s.netSales > maxDay) { maxDay = s.netSales; maxDate = s.date; } });
  band(6, 'net sales on an open day, lowest (' + minDate + ')', minDay, cal.bands[5].min, cal.bands[5].max, paise);
  band(6, 'net sales on an open day, highest (' + maxDate + ')', maxDay, cal.bands[5].min, cal.bands[5].max, paise);
  yearList.forEach(function (yk) {
    var yr = years[yk], n2 = net(yr), parts = cal.bands[6].parts, sp = cal.bands[7].parts, st2 = yr.store;
    band(7, 'retail share ' + yk, (yr.retail - yr.returns) / n2, parts.retail[0], parts.retail[1], pct);
    band(7, 'corporate share ' + yk, yr.corporate / n2, parts.corporate[0], parts.corporate[1], pct);
    band(7, 'store share ' + yk, yr.store / n2, parts.store[0], parts.store[1], pct);
    ['st_anand', 'st_vvn', 'st_nadiad'].forEach(function (sid) { band(8, sid + ' share of store sales ' + yk, (yr.byStore[sid] || 0) / st2, sp[sid][0], sp[sid][1], pct); });
    band(9, 'stale returns, share of retail supply ' + yk, yr.returns / yr.retail, cal.bands[8].min, cal.bands[8].max, pct);
    band(10, 'stale returns on the fresh lines ' + yk, yr.returnsFresh / yr.retailFresh, cal.bands[9].min, cal.bands[9].max, pct);
  });
  if (o19 > 0) band(11, 'O19 credit notes held, share from February 2026 (' + o19Held + ' of ' + o19 + ')', o19Held / o19, cal.bands[10].min, null, pct);
  var heldMax = 0, heldMk = '';
  monthList.forEach(function (m2) { var mo = +m2.slice(5, 7); if (cal.bands[11].exceptMonths.indexOf(mo) !== -1) return; if (months[m2].cnHeldOthers > heldMax) { heldMax = months[m2].cnHeldOthers; heldMk = m2; } });
  band(12, 'held credit notes of the other outlets in a month outside July-September, most (' + heldMk + ')', heldMax, 0, cal.bands[11].max, 'int');
  yearList.forEach(function (yk) {
    var yr = years[yk], n2 = net(yr);
    if (cal.bands[12].parts[yk]) band(13, 'recipe cost of goods sold, share of net sales ' + yk, yr.cogs / n2, cal.bands[12].parts[yk][0], cal.bands[12].parts[yk][1], pct);
    if (cal.bands[13].parts[yk]) band(14, 'material cost, share of net sales ' + yk, mat(yr) / n2, cal.bands[13].parts[yk][0], cal.bands[13].parts[yk][1], pct);
  });
  var matMin = Infinity, matMax = 0, matMinMk = '', matMaxMk = '';
  monthList.forEach(function (m2) { var v = mat(months[m2]) / net(months[m2]); if (v < matMin) { matMin = v; matMinMk = m2; } if (v > matMax) { matMax = v; matMaxMk = m2; } });
  band(15, 'material cost in a month, lowest (' + matMinMk + ')', matMin, cal.bands[14].min, cal.bands[14].max, pct);
  band(15, 'material cost in a month, highest (' + matMaxMk + ')', matMax, cal.bands[14].min, cal.bands[14].max, pct);
  /* 16: retailer price less recipe cost at the month's purchase prices, every product and month */
  var marginMin = Infinity, marginAt = '';
  monthList.forEach(function (m2) {
    var list = sim.priceListOn(D.monthEnd(m2 + '-01'));
    for (i = 0; i < M.recipes.length; i++) {
      var rec = M.recipes[i], cost = 0;
      for (j = 0; j < rec.materials.length; j++) cost += rec.materials[j].qty * sim.prices.inMonth(rec.materials[j].itemId, m2);
      cost /= rec.expectedUnits;
      for (j = 0; j < (rec.packing || []).length; j++) cost += rec.packing[j].qtyPerUnit * sim.prices.inMonth(rec.packing[j].itemId, m2);
      var margin = list[rec.itemId].retail - cost;
      if (margin < marginMin) { marginMin = margin; marginAt = rec.itemId + ' ' + m2; }
    }
  });
  band(16, 'product margin to retailers, lowest (' + marginAt + ')', marginMin, 0.01, null, paise);
  yearList.forEach(function (yk) {
    var yr = years[yk], n2 = net(yr), ndays = D.diffDays(yk + '-01-01', yk + '-12-31') + 1;
    band(17, 'production loss, share of sales ' + yk, yr.prodLoss / n2, cal.bands[16].min, cal.bands[16].max, pct);
    band(18, 'write-offs, share of sales ' + yk, yr.writeoff / n2, cal.bands[17].min, cal.bands[17].max, pct);
    band(19, 'count differences, share of sales ' + yk, yr.countDiff / n2, cal.bands[18].min, cal.bands[18].max, pct);
    band(22, 'store puffs expired, share of puffs received ' + yk, yr.puffsExpired / yr.puffsIn, cal.bands[21].min, cal.bands[21].max, pct);
    band(23, 'salaries, share of sales ' + yk, yr.salaries / n2, cal.bands[22].min, cal.bands[22].max, pct);
    band(24, 'expenses other than salaries, share of sales ' + yk, yr.otherExp / n2, cal.bands[23].min, cal.bands[23].max, pct);
    if (yk === '2026') band(25, 'operating profit 2026', profit(yr) / n2, cal.bands[24].min, cal.bands[24].max, pct);
    if (yk === '2027') band(26, 'operating profit 2027', profit(yr) / n2, cal.bands[25].min, cal.bands[25].max, pct);
    band(51, 'flour consumed a day ' + yk, yr.flour / ndays, cal.bands[50].min, cal.bands[50].max, 'kg');
  });
  var yMin = Infinity, yMax = 0, yMinMk = '', yMaxMk = '', dipMin = Infinity, dipMax = 0, dipMinMk = '', dipMaxMk = '';
  monthList.forEach(function (m2) {
    var mo = months[m2], v = mo.good / mo.expected;
    if (v < yMin) { yMin = v; yMinMk = m2; } if (v > yMax) { yMax = v; yMaxMk = m2; }
    if (mo.dipExpected > 0) { v = mo.dipGood / mo.dipExpected; if (v < dipMin) { dipMin = v; dipMinMk = m2; } if (v > dipMax) { dipMax = v; dipMaxMk = m2; } }
  });
  band(20, 'yield of a month, lowest (' + yMinMk + ')', yMin, cal.bands[19].min, cal.bands[19].max, pct);
  band(20, 'yield of a month, highest (' + yMaxMk + ')', yMax, cal.bands[19].min, cal.bands[19].max, pct);
  band(21, 'yield of the dip product on the 5th to 18th, lowest month (' + dipMinMk + ')', dipMin, cal.bands[20].min, cal.bands[20].max, pct);
  band(21, 'yield of the dip product on the 5th to 18th, highest month (' + dipMaxMk + ')', dipMax, cal.bands[20].min, cal.bands[20].max, pct);
  var pMin = Infinity, pMax = -Infinity, pMinMk = '', pMaxMk = '', quarters = {};
  monthList.forEach(function (m2) {
    var mo = months[m2], v = profit(mo) / net(mo);
    if (v < pMin) { pMin = v; pMinMk = m2; } if (v > pMax) { pMax = v; pMaxMk = m2; }
    var qk = m2.slice(0, 4) + 'Q' + Math.ceil(+m2.slice(5, 7) / 3), q = quarters[qk] || (quarters[qk] = { net: 0, profit: 0, months: 0 });
    q.net += net(mo); q.profit += profit(mo); q.months++;
  });
  band(27, 'operating profit in a month, lowest (' + pMinMk + ')', pMin, cal.bands[26].min, cal.bands[26].max, pct);
  band(27, 'operating profit in a month, highest (' + pMaxMk + ')', pMax, cal.bands[26].min, cal.bands[26].max, pct);
  var qMin = Infinity, qMinK = '';
  Object.keys(quarters).forEach(function (qk) { if (quarters[qk].months < 3) return; var v = quarters[qk].profit / quarters[qk].net; if (v < qMin) { qMin = v; qMinK = qk; } });
  if (qMin < Infinity) band(28, 'operating profit of a calendar quarter, lowest (' + qMinK + ')', qMin, cal.bands[27].above, null, pct);
  /* month ends */
  var mm = stats.months, mins = {}, maxs = {}, atMin = {}, atMax = {};
  function track(key, v, m2) { if (mins[key] === undefined || v < mins[key]) { mins[key] = v; atMin[key] = m2; } if (maxs[key] === undefined || v > maxs[key]) { maxs[key] = v; atMax[key] = m2; } }
  mm.forEach(function (m2) {
    if (m2.mk >= '2026-02') { track('recv', m2.receivables, m2.mk); track('recvDays', m2.receivables / (m2.salesGst / m2.days), m2.mk); }
    track('corpDays', m2.corporateReceivables / (m2.corporateSales / m2.days), m2.mk);
    track('pay', m2.stockPayables, m2.mk); track('payDays', m2.stockPayables / (m2.purchases / m2.days), m2.mk);
    track('rm', m2.materialStock, m2.mk); track('rmDays', m2.materialStock / (m2.consumption / m2.days), m2.mk);
    track('fg', m2.factoryFinished, m2.mk); track('st', m2.storeFinished, m2.mk);
  });
  if (mins.recv !== undefined) {
    band(29, 'receivables at a month end, lowest (' + atMin.recv + ')', mins.recv, cal.bands[28].min, cal.bands[28].max, paise);
    band(29, 'receivables at a month end, highest (' + atMax.recv + ')', maxs.recv, cal.bands[28].min, cal.bands[28].max, paise);
    band(29, 'receivables in days of sales with GST, lowest (' + atMin.recvDays + ')', mins.recvDays, cal.bands[28].days[0], cal.bands[28].days[1], 'days');
    band(29, 'receivables in days of sales with GST, highest (' + atMax.recvDays + ')', maxs.recvDays, cal.bands[28].days[0], cal.bands[28].days[1], 'days');
  }
  if (mins.corpDays !== undefined) {
    band(30, 'corporate receivables in days of corporate sales, lowest (' + atMin.corpDays + ')', mins.corpDays, cal.bands[29].days[0], cal.bands[29].days[1], 'days');
    band(30, 'corporate receivables in days of corporate sales, highest (' + atMax.corpDays + ')', maxs.corpDays, cal.bands[29].days[0], cal.bands[29].days[1], 'days');
    band(34, 'payables to stock vendors at a month end, lowest (' + atMin.pay + ')', mins.pay, cal.bands[33].min, cal.bands[33].max, paise);
    band(34, 'payables to stock vendors at a month end, highest (' + atMax.pay + ')', maxs.pay, cal.bands[33].min, cal.bands[33].max, paise);
    band(34, 'payables in days of purchases with GST, lowest (' + atMin.payDays + ')', mins.payDays, cal.bands[33].days[0], cal.bands[33].days[1], 'days');
    band(34, 'payables in days of purchases with GST, highest (' + atMax.payDays + ')', maxs.payDays, cal.bands[33].days[0], cal.bands[33].days[1], 'days');
    band(36, 'material stock at a month end, lowest (' + atMin.rm + ')', mins.rm, cal.bands[35].min, cal.bands[35].max, paise);
    band(36, 'material stock at a month end, highest (' + atMax.rm + ')', maxs.rm, cal.bands[35].min, cal.bands[35].max, paise);
    band(36, 'material stock in days of consumption, lowest (' + atMin.rmDays + ')', mins.rmDays, cal.bands[35].days[0], cal.bands[35].days[1], 'days');
    band(36, 'material stock in days of consumption, highest (' + atMax.rmDays + ')', maxs.rmDays, cal.bands[35].days[0], cal.bands[35].days[1], 'days');
    band(37, 'finished stock at the factory at a month end, lowest (' + atMin.fg + ')', mins.fg, cal.bands[36].min, cal.bands[36].max, paise);
    band(37, 'finished stock at the factory at a month end, highest (' + atMax.fg + ')', maxs.fg, cal.bands[36].min, cal.bands[36].max, paise);
    band(38, 'finished stock at the three stores at a month end, lowest (' + atMin.st + ')', mins.st, cal.bands[37].min, cal.bands[37].max, paise);
    band(38, 'finished stock at the three stores at a month end, highest (' + atMax.st + ')', maxs.st, cal.bands[37].min, cal.bands[37].max, paise);
  }
  /* every day */
  var ds = stats.days, overdueMin = Infinity, overdueAt = '', c06Min = Infinity, c06At = '', withinBad = 0, lateDays = 0, lateHeld = 0, lateGaps = [], coverBad = [], lowMin = Infinity, lowAt = '', heldMin = Infinity, heldAt = '', nearMin = Infinity, nearAt = '', hoBad = [], cashMin = Infinity, cashMax = 0, cashMinAt = '', cashMaxAt = '';
  var lowByMonth = {}, lowDaysByMonth = {};
  /* bands 33, 35 and 39 are read from the earliest business date a copy can have: January 2026 follows from the opening position */
  var from33 = cal.bands[32].from, from35 = cal.bands[34].from, from39 = cal.bands[38].from;
  ds.forEach(function (s, idx) {
    if (s.overdue < overdueMin) { overdueMin = s.overdue; overdueAt = s.date; }
    if (s.c06 < c06Min) { c06Min = s.c06; c06At = s.date; }
    if (s.date >= from33 && !s.within) withinBad++;
    if (s.date >= from35) { lateDays++; if (s.latePayables > 0) lateHeld++; else lateGaps.push(s.date); }
    if (s.date >= from39 && !s.cover) coverBad.push(s.date + ' (' + s.coverShort.slice(0, 2).join(', ') + ')');
    if (s.date >= cal.bands[40].from) { if (s.low < lowMin) { lowMin = s.low; lowAt = s.date; } add(lowByMonth, s.date.slice(0, 7), s.low); add(lowDaysByMonth, s.date.slice(0, 7), 1); }
    if (s.date > cal.bands[42].after && s.held < heldMin) { heldMin = s.held; heldAt = s.date; }
    var next = ds[idx + 1];
    if (s.open && next && next.open) for (i = 0; i < s.near.length; i++) if (s.near[i] < nearMin) { nearMin = s.near[i]; nearAt = D.addDays(s.date, 1) + ' store ' + i; }
    if (!s.handOver) hoBad.push(s.date + ': ' + s.handOverWhy);
    if (s.cash < cashMin) { cashMin = s.cash; cashMinAt = s.date; }
    if (s.cash > cashMax) { cashMax = s.cash; cashMaxAt = s.date; }
  });
  band(31, 'overdue receivables on every day, lowest (' + overdueAt + ')', overdueMin, 0.01, null, paise);
  band(32, 'C06 balance on every day, lowest (' + c06At + ')', c06Min, cal.bands[31].above + 0.01, null, paise);
  band(33, 'days from ' + from33 + ' on which another corporate was above its credit limit', withinBad, 0, 0, 'int');
  band(35, 'days from ' + from35 + ' with an overdue payable to VM08 or VM13, share (' + lateHeld + ' of ' + lateDays + (lateGaps.length ? '; none on ' + lateGaps.slice(0, 6).join(', ') : '') + ')', lateDays ? lateHeld / lateDays : NaN, cal.bands[34].min, null, pct);
  band(39, 'days from ' + from39 + ' on which a material did not cover the standard day plan of the next three days' + (coverBad.length ? ' (first ' + coverBad.slice(0, 3).join('; ') + ')' : ''), coverBad.length, 0, 0, 'int');
  band(40, 'safety-net orders', HB.seed.stats.safetyNet, cal.bands[39].min, cal.bands[39].max, 'int');
  band(41, 'materials at or under their reorder level at a day-end, fewest (' + lowAt + ')', lowMin, cal.bands[40].min, null, 'int');
  var avgMin = Infinity, avgMax = 0, avgMinMk = '', avgMaxMk = '';
  Object.keys(lowByMonth).forEach(function (m2) { if (!monthList.length || monthList.indexOf(m2) === -1) return; var v = lowByMonth[m2] / lowDaysByMonth[m2]; if (v < avgMin) { avgMin = v; avgMinMk = m2; } if (v > avgMax) { avgMax = v; avgMaxMk = m2; } });
  band(41, 'materials at or under their reorder level, month average, lowest (' + avgMinMk + ')', avgMin, cal.bands[40].monthAverage[0], cal.bands[40].monthAverage[1], 'count');
  band(41, 'materials at or under their reorder level, month average, highest (' + avgMaxMk + ')', avgMax, cal.bands[40].monthAverage[0], cal.bands[40].monthAverage[1], 'count');
  var poMin = Infinity, poMax = 0, poMinMk = '', poMaxMk = '', abMin = Infinity, abMax = 0, abMinMk = '', abMaxMk = '';
  monthList.forEach(function (m2) { var mo = months[m2]; if (mo.po < poMin) { poMin = mo.po; poMinMk = m2; } if (mo.po > poMax) { poMax = mo.po; poMaxMk = m2; } if (mo.poAbove < abMin) { abMin = mo.poAbove; abMinMk = m2; } if (mo.poAbove > abMax) { abMax = mo.poAbove; abMaxMk = m2; } });
  band(42, 'purchase orders in a month, fewest (' + poMinMk + ')', poMin, cal.bands[41].min, cal.bands[41].max, 'int');
  band(42, 'purchase orders in a month, most (' + poMaxMk + ')', poMax, cal.bands[41].min, cal.bands[41].max, 'int');
  band(42, 'orders above the limit in a month, fewest (' + abMinMk + ')', abMin, cal.bands[41].aboveLimit[0], cal.bands[41].aboveLimit[1], 'int');
  band(42, 'orders above the limit in a month, most (' + abMaxMk + ')', abMax, cal.bands[41].aboveLimit[0], cal.bands[41].aboveLimit[1], 'int');
  band(43, 'held vendor bills at a day-end after 2026-01-05, fewest (' + heldAt + ')', heldMin, cal.bands[42].min, null, 'int');
  var winMin = Infinity, winMax = 0, winAt = '', winMaxAt = '';
  if (s3Short.length) {
    var first = s3Short[0], last = runEnd;
    for (var d0 = D.addDays(first, 0); D.addDays(d0, 29) <= last; d0 = D.addDays(d0, 1)) {
      var d29 = D.addDays(d0, 29), nIn = 0;
      for (i = 0; i < s3Short.length; i++) if (s3Short[i] >= d0 && s3Short[i] <= d29) nIn++;
      if (nIn < winMin) { winMin = nIn; winAt = d0; } if (nIn > winMax) { winMax = nIn; winMaxAt = d0; }
    }
    band(44, 'S3 cash shortages in a 30-day window, fewest (from ' + winAt + ')', winMin, cal.bands[43].min, cal.bands[43].max, 'int');
    band(44, 'S3 cash shortages in a 30-day window, most (from ' + winMaxAt + ')', winMax, cal.bands[43].min, cal.bands[43].max, 'int');
  }
  band(45, 'near-expiry batches at a store at the start of an open day after a normal day, fewest (' + nearAt + ')', nearMin, cal.bands[44].min, null, 'int');
  band(46, 'days whose hand-over (sheets, transfers, open corporate orders, a standard day of production) does not hold' + (hoBad.length ? ' (first ' + hoBad.slice(0, 2).join('; ') + ')' : ''), hoBad.length, 0, 0, 'int');
  band(48, 'factory cash at a day-end, lowest (' + cashMinAt + ')', cashMin, cal.bands[47].min, cal.bands[47].max, paise);
  band(48, 'factory cash at a day-end, highest (' + cashMaxAt + ')', cashMax, cal.bands[47].min, cal.bands[47].max, paise);
  if (runEnd >= '2027-12-31') band(49, 'bank balance on 2027-12-31', book.cash.balance.bank, cal.bands[48].min, cal.bands[48].max, paise);
  band(50, 'production entries outside smallest-largest run plus one step (of ' + prodN + ')', mixesBad, 0, 0, 'int');
}

/* ====================================================== journeys (c) */

function as(userId) { var u = HB.session.set(userId); if (!u) throw new Error('no persona ' + userId); return u; }

var raised = []; /* the warnings HB.engine.act returned since this was last emptied: 'code on TYPE' */

function act(userId, op, args) {
  as(userId);
  var res = HB.engine.act(op, args);
  (res && res.warnings ? res.warnings : []).forEach(function (w) { raised.push(w.code + ' on ' + (op === 'post' ? args.type : op)); });
  return res;
}

function post(userId, type, payload) { return act(userId, 'post', { type: type, payload: payload }); }

/** The eight journeys as the personas the guide suggests (owner: true runs every step as the Owner). */
function journeys(date, owner, label) {
  var M = HB.masters, b = HB.book, log, i, j, res, who = function (role) { return owner ? 'u_owner' : 'u_' + role; };
  var ticked = [], entriesBefore = HB.engine.log().length;
  raised = [];
  function step(journeyId, stepIdx, res) {
    if (!check(label + ' ' + journeyId + ' step ' + (stepIdx + 1) + ': went through', res.ok, res.error && (res.error.code + ': ' + res.error.message))) return null;
    var e = HB.engine.log()[HB.engine.log().length - 1], jr = null;
    for (i = 0; i < cfg.journeys.length; i++) if (cfg.journeys[i].id === journeyId) jr = cfg.journeys[i];
    var st = jr.steps[stepIdx];
    check(label + ' ' + journeyId + ' step ' + (stepIdx + 1) + ' ticks by HB.config.guide.stepMatches', cfg.guide.stepMatches(st, e), 'the entry ' + e.n + ' (' + e.op + ') does not match');
    ticked.push(journeyId + '.' + (stepIdx + 1));
    return res;
  }
  /* 1: the sheets of today, every route as prefilled (the first one is the journey; the rest prove the hand-over) */
  var routes = M.routes, firstSheet = true;
  for (i = 0; i < routes.length; i++) {
    var sheet = E.dispatchSheet(routes[i].id, date);
    res = act(who('sales'), 'postDispatch', { routeId: routes[i].id, date: date, outlets: sheet.outlets });
    if (firstSheet) { step('dispatch', 0, res); firstSheet = false; }
    else check(label + ' sheet ' + routes[i].id + ' as prefilled', res.ok, res.error && res.error.message);
  }
  /* 5a: every store's transfer as prefilled, the store manager's store first */
  var stores = M.units.filter(function (u) { return u.kind === 'store' && u.active !== false; }), mgrStore = 'st_vvn', xferId = null;
  for (i = 0; i < M.users.length; i++) if (M.users[i].role === 'store_mgr' && M.users[i].unitId) mgrStore = M.users[i].unitId;
  stores.sort(function (a, b2) { return (a.id === mgrStore ? 0 : 1) - (b2.id === mgrStore ? 0 : 1); });
  for (i = 0; i < stores.length; i++) {
    var ts = E.transferSheet(stores[i].id, date), lines = [];
    for (j = 0; j < ts.lines.length; j++) if (ts.lines[j].qty > 0) lines.push({ itemId: ts.lines[j].itemId, qty: ts.lines[j].qty });
    check(label + ' transfer sheet of ' + stores[i].id + ' proposes something', lines.length > 0);
    res = post(who('stores'), 'XFER', { date: date, toStoreId: stores[i].id, lines: lines });
    if (stores[i].id === mgrStore) { if (step('store', 0, res)) xferId = res.doc.id; }
    else check(label + ' transfer to ' + stores[i].id + ' as prefilled', res.ok, res.error && res.error.message);
  }
  /* 4: a standard day's production, one entry with rejects */
  var dow = D.dow(date), firstProd = true;
  for (i = 0; i < M.recipes.length; i++) {
    var rec = M.recipes[i];
    if (!(rec.rhythm === 'daily' || (Array.isArray(rec.rhythm) && rec.rhythm.indexOf(dow) !== -1)) || !(rec.standardMixes > 0)) continue;
    var expected = Math.round(rec.expectedUnits * rec.standardMixes);
    res = post(who('production'), 'PROD', { date: date, itemId: rec.itemId, mixes: rec.standardMixes, goodUnits: firstProd ? expected - 3 : expected, rejectedUnits: firstProd ? 3 : 0 });
    if (firstProd) { step('production', 0, res); firstProd = false; }
    else check(label + ' standard production of ' + rec.itemId, res.ok, res.error && res.error.message);
  }
  /* 2: a flour order above the latest price, within the limit, and its receipt */
  var price = E.price('RM01'), poRes = step('flour', 0, post(who('stores'), 'PO', { date: date, vendorId: M.itemById.RM01.vendorId, lines: [{ itemId: 'RM01', qty: 100, rate: price + 100 }] }));
  var grnRes = poRes ? step('flour', 1, post(who('stores'), 'GRN', { date: date, poId: poRes.doc.id, lines: [{ itemId: 'RM01', qty: 100 }] })) : null;
  if (poRes) check(label + ' the order was approved as submitted', poRes.doc.status === 'APPROVED' || poRes.doc.status === 'RECEIVED', poRes.doc.status);
  /* 3: the bill at another rate, held; approved; paid */
  if (grnRes) {
    var billRes = step('bill', 0, post(who('accounts'), 'VBILL', { date: date, vendorId: grnRes.doc.vendorId, billNo: 'J3/' + date, grnIds: [grnRes.doc.id], lines: [{ itemId: 'RM01', qty: 100, rate: Math.round((price + 100) * 1.05 * 100) / 100 }] }));
    if (billRes) {
      if (owner) check(label + ' the Owner\'s held bill is approved in the same operation', billRes.doc.status === 'POSTED' && billRes.doc.approval.self === true, billRes.doc.status);
      else { check(label + ' the bill is held', billRes.doc.status === 'HELD', billRes.doc.status); step('bill', 1, act('u_owner', 'approve', { id: billRes.doc.id })); }
      step('bill', 2, post(who('accounts'), 'PAY', { date: date, payeeType: 'vendor', payeeId: billRes.doc.vendorId, account: 'bank', allocations: [{ docId: billRes.doc.id, amount: billRes.doc.total }] }));
    }
  }
  /* 5b: confirm, day-end with expired puffs, approve the write-off */
  if (xferId) {
    step('store', 1, act(who('store_mgr'), 'receiveTransfer', { id: xferId }));
    var xf = b.docs[xferId], deLines = [], expiredAny = false;
    for (i = 0; i < xf.lines.length; i++) {
      var it = M.itemById[xf.lines[i].itemId], onHand = E.available(mgrStore, it.id, date), exp2 = E.available(mgrStore, it.id, D.addDays(date, 1));
      var expirable = onHand - exp2; /* unexpired today but not tomorrow: past best-before at the day-end (sold first, being the oldest) */
      if (expirable > 0) { deLines.push({ itemId: it.id, sold: 0, expired: expirable }); expiredAny = true; }
      else if (onHand > 0) deLines.push({ itemId: it.id, sold: 1, expired: 0 });
    }
    check(label + ' the day-end can carry expired units', expiredAny);
    var gross = 0;
    for (i = 0; i < deLines.length; i++) gross += money.amount(deLines[i].sold, M.itemById[deLines[i].itemId].price.mrp);
    var deRes = step('store', 2, post(who('store_mgr'), 'DAYEND', { date: date, storeId: mgrStore, cash: Math.round(gross / 2), upi: gross - Math.round(gross / 2), lines: deLines }));
    if (deRes) {
      var wo = deRes.docs && deRes.docs[1];
      if (owner) check(label + ' the Owner\'s day-end write-off is posted in the same operation', !!wo && wo.status === 'POSTED', wo && wo.status);
      else if (check(label + ' the day-end made a write-off', !!wo)) step('store', 3, act('u_owner', 'approve', { id: wo.id }));
    }
  }
  /* 6: a stale return above the limit for an outlet with supply, approved */
  var outlet = null;
  for (i = 0; i < M.customers.length; i++) if (M.customers[i].channel === 'retail' && M.customers[i].id !== 'O19' && M.customers[i].active !== false) { outlet = M.customers[i]; break; }
  var cnLines = [];
  for (var k in outlet.standing) if (outlet.standing[k] > 0) cnLines.push({ itemId: k, qty: outlet.standing[k] * 2 });
  var cnRes = step('return', 0, post(who('sales'), 'CN', { date: date, customerId: outlet.id, lines: cnLines }));
  if (cnRes) {
    check(label + ' the return is above the limit', cnRes.doc.sharePct === null || cnRes.doc.sharePct > M.limits.returnsPct, cnRes.doc.sharePct);
    if (owner) check(label + ' the Owner\'s return is posted in the same operation', cnRes.doc.status === 'POSTED');
    else step('return', 1, act('u_owner', 'approve', { id: cnRes.doc.id }));
  }
  /* 7: a claim by the store manager, approved, reimbursed */
  var cat = null;
  for (i = 0; i < M.expenseCategories.length; i++) if (M.expenseCategories[i].mode !== 'bill') { cat = M.expenseCategories[i]; break; }
  var clRes = step('claim', 0, post(who('store_mgr'), 'EXP', { kind: 'claim', date: date, categoryId: cat.id, unitId: mgrStore, amount: 45000, billRef: 'CB-0042' }));
  if (clRes) {
    if (!owner) step('claim', 1, act('u_owner', 'approve', { id: clRes.doc.id }));
    step('claim', 2, post(who('accounts'), 'PAY', { date: date, payeeType: 'employee', payeeId: clRes.doc.payeeId, account: 'bank', allocations: [{ docId: clRes.doc.id, amount: clRes.doc.total }] }));
  }
  /* 8: a receipt from a corporate on account, in cash, and a deposit */
  var corp = null;
  for (i = 0; i < M.customers.length; i++) if (M.customers[i].channel === 'corporate') { corp = M.customers[i]; break; }
  var rcRes = step('collect', 0, post(who('accounts'), 'RCPT', { date: date, customerId: corp.id, account: 'cash_factory', amount: 500000, allocations: [] }));
  if (rcRes) step('collect', 1, post(who('accounts'), 'DEP', { date: date, fromAccount: 'cash_factory', amount: 500000 }));
  check(label + ' every step was ticked (' + ticked.length + ')', ticked.length === (owner ? 14 : 18), ticked.join(' '));
  /* SCOPE decision 18: the journeys, entered as the guide words them, are ordinary entries - none looks wrong to the engine */
  var warnedDocs = b.docList.filter(function (d) { return !!d.warned; });
  check(label + ' no entry of the journeys raised a warning, and no document carries one', raised.length === 0 && warnedDocs.length === 0, raised.concat(warnedDocs.map(function (d) { return d.id + ' ' + d.warned.join(); })).slice(0, 4).join('; '));
  /* a refusal for a persona that may not: production posting a sheet */
  var no = act('u_production', 'postDispatch', { routeId: routes[0].id, date: date, outlets: [] });
  check(label + ' the production supervisor is refused a dispatch sheet by role', !no.ok && no.error.code === 'role', no.ok ? 'went through' : no.error.code);
  log = HB.engine.log();
  check(label + ' the log holds every operation', log.length - entriesBefore >= (owner ? 14 : 18));
  /* a reload under another persona gives the same book */
  var h1 = ledgerHashes(b);
  as('u_stores');
  HB.engine.boot();
  var h2 = ledgerHashes(HB.book);
  check(label + ' save, rebuild and replay under another persona gives the same book', JSON.stringify(h1) === JSON.stringify(h2));
  check(label + ' no entry was skipped on replay', HB.engine.skipped.length === 0, HB.engine.skipped.map(function (s) { return s.n + ' ' + s.reason; }).join('; '));
}

/* ======================================================= stories (12) */

function stories(date, label) {
  var b = HB.book, M = HB.masters, i, j, k, id, d;
  var heldBill = null, heldCn = null;
  for (id in b.pending) { d = b.pending[id]; if (d.type === 'VBILL' && d.status === 'HELD') heldBill = d; if (d.type === 'CN' && d.customerId === sim.stories.highReturns.customerId) heldCn = d; }
  check(label + ' a held vendor bill is waiting (12.5)', !!heldBill && heldBill.vendorId === sim.stories.heldBill.weekly.vendorId, heldBill ? heldBill.vendorId : 'none');
  check(label + ' the high-returns outlet has a credit note waiting, raised on the last open day (12.3)', !!heldCn && heldCn.date === sim.calendar.prevOpen(date), heldCn ? heldCn.date : 'none');
  var c06 = sim.stories.lateCorporate;
  check(label + ' ' + c06.customerId + ' is above its credit limit (12.4)', (b.ar.balance[c06.customerId] || 0) > M.customerById[c06.customerId].creditLimit, lakh(b.ar.balance[c06.customerId] || 0));
  var overdueC06 = 0, list = b.ar.open[c06.customerId] || [];
  for (i = 0; i < list.length; i++) if (list[i].dueDate < date) overdueC06++;
  check(label + ' ' + c06.customerId + ' has overdue invoices', overdueC06 > 0);
  var yeast = sim.stories.lowStock.itemId;
  check(label + ' ' + yeast + ' is at or below its reorder level with an order on the way (12.7)', (b.stock.fac_rm[yeast] || 0) <= M.itemById[yeast].reorderLevel && b.byType.PO.some(function (po) { return (po.status === 'APPROVED' || po.status === 'PART_RECEIVED' || po.status === 'PENDING') && po.lines.some(function (l) { return l.itemId === yeast; }); }), b.stock.fac_rm[yeast]);
  var stores = M.units.filter(function (u) { return u.kind === 'store'; }), nearOk = true, limitDate = D.addDays(date, M.limits.nearExpiryDays);
  for (i = 0; i < stores.length; i++) {
    var count = 0, lots = b.lots[stores[i].locId] || {};
    for (k in lots) for (j = 0; j < lots[k].length; j++) if (lots[k][j].qty > 0 && lots[k][j].bestBefore >= date && lots[k][j].bestBefore <= limitDate) count++;
    if (!count) nearOk = false;
  }
  check(label + ' every store holds near-expiry stock (12.8)', nearOk);
  var expiredPending = Object.keys(b.pending).filter(function (pid) { return b.pending[pid].type === 'WO' && b.pending[pid].reason === 'expired'; }).length;
  check(label + ' expired puffs of the last day-ends wait for the Owner', expiredPending >= 1, expiredPending);
  /* the maida price: every turning point of months before this one has been received; the cost of bread has moved since go-live */
  var hist = b.prices.RM01 ? b.prices.RM01.history : [], rates = {};
  for (i = 0; i < hist.length; i++) rates[hist[i].rate] = 1;
  var flourPoints = sim.stories.flour.points.filter(function (p) { return p[0] < date.slice(0, 7); }), seen = flourPoints.every(function (p) { return rates[p[1]]; });
  check(label + ' the maida price history shows each turning point so far (12.1)', seen && (flourPoints.length === 0 || Object.keys(rates).length >= 2), Object.keys(rates).join(','));
  if (flourPoints.length) check(label + ' bread cost has moved since go-live', Math.abs(E.unitCost('FG01') - 1373) > 1, E.unitCost('FG01'));
  /* the latest complete dip fortnight */
  var m0 = date.slice(0, 7), dipMonth = +date.slice(8, 10) > 18 ? m0 : D.addDays(m0 + '-01', -1).slice(0, 7), dip = sim.stories.yieldDip.on(dipMonth + '-10'), good = 0, exp = 0;
  var prods = b.byType.PROD;
  for (i = prods.length - 1; i >= 0 && prods[i].date >= dipMonth + '-05'; i--) {
    var p = prods[i];
    if (p.itemId === dip.itemId && p.date.slice(0, 7) === dipMonth && +p.date.slice(8, 10) >= 5 && +p.date.slice(8, 10) <= 18) { good += p.goodUnits; exp += p.expectedUnits; }
  }
  check(label + ' the yield dip of ' + dip.itemId + ' in ' + dipMonth + ' shows (12.2)', exp > 0 && good / exp < 0.95 && good / exp > 0.85, exp ? (good / exp).toFixed(3) : 'no entries');
  var shorts = 0, from = D.addDays(date, -30), des = b.byType.DAYEND;
  for (i = des.length - 1; i >= 0 && des[i].date >= from; i--) if (des[i].storeId === sim.stories.cashShort.storeId && des[i].shortExcess < 0) shorts++;
  check(label + ' ' + sim.stories.cashShort.storeId + ' had cash shortages in the last 30 days (12.6)', shorts >= 2, shorts);
  /* the documents of each store name its own manager as the one who entered them; createdBy stays the store persona */
  var meEmp = null, asSeen = 0, asWrong = [];
  for (i = 0; i < cfg.users.length; i++) if (cfg.users[i].id === sim.stores.userId) meEmp = cfg.users[i].employeeId;
  for (i = b.docList.length - 1; i >= 0 && b.docList[i].date >= from; i--) {
    var dd = b.docList[i], xf = dd.type === 'XFER', by = xf ? dd.receivedBy : dd.createdBy, shownAs = xf ? dd.receivedAs : dd.createdAs;
    var sid = dd.type === 'DAYEND' ? dd.storeId : xf ? dd.toStoreId : dd.type === 'WO' ? dd.locId : dd.type === 'DEP' ? String(dd.fromAccount).replace(/^cash_/, '') : dd.type === 'EXP' ? dd.unitId : null;
    if (by !== sim.stores.userId || !sid) continue;
    asSeen++;
    var mgr = sim.stores.manager[sid];
    if ((mgr && mgr !== meEmp ? mgr : null) !== (shownAs || null)) asWrong.push(dd.id);
  }
  check(label + ' the documents of each store name its own manager as the one who entered them (' + asSeen + ' in the last 30 days)', asSeen > 0 && asWrong.length === 0, asWrong.slice(0, 3).join(' '));
  check(label + ' the retail class factors are the config\'s own (seed cache)', HB.seed.verifyClasses(HB.calendar.dataEnd) === 0);
  check(label + ' the seed refused nothing', HB.seed.stats.refusals.length === 0, HB.seed.stats.refusals.slice(0, 3).map(function (r) { return r.date + ' ' + r.what + ': ' + r.message; }).join('; '));
}

/* ================================================================ run */

function run(opts) {
  opts = opts || {};
  var quick = !!opts.quick, times = {}, dates = null, hashes = {}, stats = { days: [], months: [] }, dayLengths = {};
  sections.length = 0; out.length = 0; sec = null;
  onlyPart = opts.part === 'b' || opts.part === 'c' ? opts.part : null;
  partNow = 'b';
  load();
  dates = cfg.calibration.dates;

  section('calendar: a closed day is no business date', function () {
    HB.store.remove('log');
    eq('2026-11-09 opens on 2026-11-12', HB.calendar.set('2026-11-09'), '2026-11-12');
    eq('2027-10-31 opens on 2027-11-01', HB.calendar.set('2027-10-31'), '2027-11-01');
    eq('dataEnd follows', HB.calendar.dataEnd, '2027-10-31');
    eq('an open day stays', HB.calendar.set('2026-10-02'), '2026-10-02');
    eq('clamped into range', HB.calendar.set('2025-01-01'), '2026-02-01');
    check('movedOn compares with the clamped device date', typeof HB.calendar.movedOn() === 'boolean');
  });

  section('build time and size for the three business dates', function () {
    dates.forEach(function (date) {
      var t0 = Date.now(), b = bootAt(date), ms = Date.now() - t0, t1 = Date.now(), ms2;
      b = bootAt(date); ms2 = Date.now() - t1;
      times[date] = { first: ms, second: ms2, docs: b.docList.length, rows: b.moves.length + b.ar.entries.length + b.ap.entries.length + b.cash.entries.length + b.pnl.length + b.gst.length };
      say('    ' + date + ': ' + ms + ' ms (again ' + ms2 + ' ms), ' + b.docList.length + ' documents, ' + times[date].rows + ' ledger rows, seq ' + b.seq);
      check('seed to ' + HB.calendar.dataEnd + ' refused nothing', HB.seed.stats.refusals.length === 0, HB.seed.stats.refusals.slice(0, 3).map(function (r) { return r.date + ' ' + r.what + ': ' + r.message; }).join('; '));
      hashes[date] = ledgerHashes(b);
      dayLengths[date] = ledgerLengths(b);
    });
    /* Wall-clock time depends on what else the machine is running, so the budget is tested on the fastest of up to
       four builds: other processes can only make a build slower, never faster. */
    function fastest(date, limit) {
      var best = Math.min(times[date].first, times[date].second), t;
      for (var i = 0; i < 2 && best >= limit; i++) { t = Date.now(); bootAt(date); best = Math.min(best, Date.now() - t); }
      return best;
    }
    var fast0 = fastest(dates[0], 1000), fast2 = fastest(dates[2], 2000);
    check('a run to 2026-10-02 builds in under a second (fastest of up to four)', fast0 < 1000, fast0 + ' ms');
    check('a run to 2027-12-31 builds in under two seconds (fastest of up to four)', fast2 < 2000, fast2 + ' ms');
  });

  section('reconciliation by a straight pass over the raw documents, each business date', function () {
    dates.forEach(function (date) {
      bootAt(date);
      say('    ' + date + ': ' + HB.book.docList.length + ' documents');
      reconcile(HB.book);
    });
  });

  section('determinism and prefix stability on seq', function () {
    var b = bootAt(dates[2]), h2 = ledgerHashes(b);
    check('band 52: two runs to ' + dates[2] + ' give identical ledgers', JSON.stringify(h2) === JSON.stringify(hashes[dates[2]]));
    say('    ok   band 52 two runs identical: ' + (JSON.stringify(h2) === JSON.stringify(hashes[dates[2]])));
    /* the run to an earlier date is the beginning of this one */
    var pairs = [[dates[0], dates[2]], [dates[1], dates[2]], [dates[0], dates[1]]];
    pairs.forEach(function (pr) {
      var later = bootAt(pr[1]), early = hashes[pr[0]], prefix = ledgerHashes(later, dayLengths[pr[0]]);
      check('the run to ' + pr[0] + ' is the beginning of the run to ' + pr[1] + ' on every ledger and the document list', JSON.stringify(prefix) === JSON.stringify(early));
    });
    if (!quick) {
      var more = [['2026-02-01', '2026-02-02'], ['2026-11-09', '2026-11-13'], ['2027-07-15', '2027-10-30']];
      more.forEach(function (pr) {
        var e = bootAt(pr[0]), he = ledgerHashes(e), le = ledgerLengths(e), l = bootAt(pr[1]);
        check('the run to ' + HB.calendar.dataEnd + ' (business date ' + pr[0] + ') is the beginning of the run for ' + pr[1], JSON.stringify(ledgerHashes(l, le)) === JSON.stringify(he));
      });
    }
  });

  section('the dated master changes of a business date are in force when the copy opens (RESEARCH 2.4, 14 point 7)', function () {
    var byDate = {}, i, j, k;
    function on(date) { return byDate[date] || (byDate[date] = { prices: null, raises: [], joiners: [] }); }
    sim.priceRevisions.forEach(function (r) { on(r.date).prices = r; });
    sim.people.raises.forEach(function (r) { on(r.date).raises.push(r); });
    sim.people.joiners.forEach(function (r) { on(r.doj).joiners.push(r); });
    var outlet = cfg.customers.filter(function (c) { return c.channel === 'retail' && c.terms === 'cash' && c.active !== false; })[0];
    Object.keys(byDate).sort().forEach(function (date) {
      var b = bootAt(date), M = HB.masters, t = byDate[date], label = date + ' (' + D.label(date, 'EEE') + ')', yesterday = D.addDays(date, -1), rows, bad;
      eq(label + ': the copy opens on the date of the change', HB.calendar.today, date);
      var rowsToday = M.changes.filter(function (c) { return c.at.slice(0, 10) === date; });
      check(label + ': the change rows of the day are timed before the dispatch', rowsToday.length > 0 && rowsToday.every(function (c) { return c.at < date + 'T' + sim.clock.dispatch; }), rowsToday.length + ' rows');
      check(label + ': no change row is dated after the business date', M.changes.every(function (c) { return c.at.slice(0, 10) <= date; }));
      if (t.prices) {
        var list = sim.priceListOn(date), old = sim.priceListOn(yesterday), items = Object.keys(t.prices.prices);
        bad = items.filter(function (id) { var p = M.itemById[id].price; return p.retail !== list[id].retail || p.corporate !== list[id].corporate || p.mrp !== list[id].mrp; });
        check(label + ': the item master carries the list revised that morning (' + items.length + ' items)', bad.length === 0, bad.join(' '));
        rows = rowsToday.filter(function (c) { return c.type === 'items'; });
        check(label + ': one change row per item, by ' + t.prices.userId, rows.length === items.length && rows.every(function (c) { return c.userId === t.prices.userId; }), rows.length + ' rows');
        /* the orders placed yesterday for delivery today are at the new corporate prices; yesterday's invoices at the old list */
        var soN = 0, soBad = 0, invN = 0, invBad = 0;
        b.byType.SO.forEach(function (s) { if (s.status !== 'OPEN' || s.deliveryDate !== date) return; s.lines.forEach(function (l) { if (t.prices.prices[l.itemId]) { soN++; if (l.price !== list[l.itemId].corporate) soBad++; } }); });
        check(label + ': the open corporate orders due today carry the new corporate prices (' + soN + ' lines)', soN > 0 && soBad === 0, soBad + ' differ');
        for (i = b.byType.INV.length - 1; i >= 0 && b.byType.INV[i].date === yesterday; i--) {
          var inv = b.byType.INV[i];
          for (j = 0; j < inv.lines.length; j++) { k = inv.lines[j].itemId; if (!t.prices.prices[k]) continue; invN++; if (inv.lines[j].price !== (inv.channel === 'corporate' ? old[k].corporate : old[k].retail)) invBad++; }
        }
        check(label + ': the invoices of the day before were priced at the old list (' + invN + ' lines)', invN > 0 && invBad === 0, invBad + ' differ');
        as('u_sales');
        var pv = E.preview('INV', { date: date, customerId: outlet.id, lines: [{ itemId: items[0], qty: 1 }] });
        check(label + ': a retail invoice entered today prices ' + items[0] + ' at the new list', pv.ok && pv.doc.lines[0].price === list[items[0]].retail, pv.ok ? String(pv.doc.lines[0].price) : pv.error.message);
      }
      t.raises.forEach(function (r) {
        var ids = Object.keys(r.salary), off = ids.filter(function (id) { return !M.employeeById[id] || M.employeeById[id].salary !== r.salary[id]; });
        check(label + ': the raise is in the directory (' + ids.length + ' employees)', off.length === 0, off.join(' '));
      });
      t.joiners.forEach(function (r) {
        var e = M.employeeById[r.id];
        check(label + ': ' + r.id + ', who joins today, is in the directory', !!e && e.active !== false && e.doj === date, e ? e.doj + ' ' + e.active : 'missing');
      });
    });
  });

  var fullBook = null;
  section('every simulated day: the hand-over, the material cover and the daily figures (one run to 2027-12-31)', function () {
    var t0 = Date.now();
    fullBook = runTo('2027-12-31', { afterDay: function (date, n) { dayStats(stats, date, n); } });
    say('    ' + stats.days.length + ' days simulated and inspected in ' + (Date.now() - t0) + ' ms; ' + fullBook.docList.length + ' documents');
    check('the seed refused nothing', HB.seed.stats.refusals.length === 0, HB.seed.stats.refusals.slice(0, 5).map(function (r) { return r.date + ' ' + r.what + ': ' + r.message; }).join('; '));
    var hoBad = stats.days.filter(function (s) { return !s.handOver; });
    check('the hand-over holds on every day not followed by a closed day (' + stats.days.length + ' days)', hoBad.length === 0, hoBad.slice(0, 3).map(function (s) { return s.date + ': ' + s.handOverWhy; }).join('; '));
    /* from the earliest business date a copy can have, as band 39 says: 1 and 2 January 2026 stand on the opening stock */
    var coverFrom = cfg.calibration.bands[38].from, coverBad = stats.days.filter(function (s) { return s.date >= coverFrom && !s.cover; });
    check('every material covers the standard day plan of the next three days at every day-end from ' + coverFrom, coverBad.length === 0, coverBad.slice(0, 3).map(function (s) { return s.date + ' ' + s.coverShort.join(', '); }).join('; '));
    /* the seed's own pay days are the config's */
    var M = HB.masters, bad = 0, n = 0, pays = fullBook.byType.PAY, i, j;
    for (i = 0; i < pays.length; i++) {
      var p = pays[i];
      if (p.payeeType !== 'vendor' || !M.vendorById[p.payeeId] || M.vendorById[p.payeeId].kind !== 'stock') continue;
      for (j = 0; j < p.allocations.length; j++) {
        var bill = fullBook.docs[p.allocations[j].docId];
        if (!bill || bill.opening) continue;
        n++;
        if (sim.purchasing.payDate(p.payeeId, bill.dueDate) !== p.date) bad++;
      }
    }
    check('every vendor bill is paid on purchasing.payDate (' + n + ' allocations)', bad === 0, bad + ' differ');
    var wrongDay = 0;
    fullBook.docList.forEach(function (d) { if (sim.calendar.isClosed(d.date) && 'INV XFER DAYEND RCPT PAY DEP GRN CN'.indexOf(d.type) !== -1) wrongDay++; });
    check('nothing is dispatched, transferred, sold, received, collected, paid or deposited on a closed day', wrongDay === 0, wrongDay + ' documents');
    /* the posting order of a day follows the seed's clock: no row is timed earlier than the row before it on its date, no approval precedes its document */
    function backInTime(rows, key) { var r, t, prev = null, back = 0; for (r = 0; r < rows.length; r++) { t = rows[r][key]; if (prev && t.slice(0, 10) === prev.slice(0, 10) && t < prev) back++; prev = t; } return back; }
    var auditBack = backInTime(fullBook.audit, 'at'), docBack = backInTime(fullBook.docList, 'createdAt');
    check('the audit trail never goes back in time within a day (' + fullBook.audit.length + ' rows)', auditBack === 0, auditBack + ' rows timed earlier than the row before');
    check('the documents of a day are posted in the order of their times (' + fullBook.docList.length + ' documents)', docBack === 0, docBack + ' documents timed earlier than the one before');
    var approvedEarly = fullBook.docList.filter(function (d) { return d.approval && d.approval.at && d.approval.at < d.createdAt; });
    check('no document is approved or rejected before it was raised', approvedEarly.length === 0, approvedEarly.slice(0, 3).map(function (d) { return d.id + ' ' + d.approval.at + ' < ' + d.createdAt; }).join('; '));
    var dayTwo = D.addDays(sim.calendar.goLive, 1), goLiveAbove = fullBook.byType.PO.filter(function (p) { return p.date === sim.calendar.goLive && p.total > M.limits.poAutoApprove; });
    check('the go-live orders above the limit wait for the Owner\'s next morning (' + goLiveAbove.length + ')', goLiveAbove.length > 0 && goLiveAbove.every(function (p) { return p.approval.state === 'approved' && p.approval.at.slice(0, 10) === dayTwo && p.approval.at > p.createdAt; }), goLiveAbove.map(function (p) { return p.id + ' ' + p.approval.at; }).join(' '));
    var depPaise = fullBook.byType.DEP.filter(function (d) { return d.amount % 100 !== 0; });
    check('every deposit slip is for whole rupees (' + fullBook.byType.DEP.length + ' slips)', depPaise.length === 0, depPaise.slice(0, 3).map(function (d) { return d.id + ' ' + d.amount; }).join(' '));
    /* SCOPE decision 18: a warning is for what a user types. The history carries none, however unusual a day was */
    var seedWarned = fullBook.docList.filter(function (d) { return 'warned' in d; }), seedNotes = fullBook.audit.filter(function (a) { return /Entered with (a warning|warnings)/.test(a.note || ''); });
    check('no seeded document carries a warning and no audit entry mentions one (' + fullBook.docList.length + ' documents, ' + fullBook.audit.length + ' audit entries)', seedWarned.length === 0 && seedNotes.length === 0,
      seedWarned.slice(0, 3).map(function (d) { return d.id; }).concat(seedNotes.slice(0, 3).map(function (a) { return a.docId; })).join(' '));
    var expiredFg = 0;
    fullBook.byType.WO.forEach(function (w) { if (w.locId === 'fac_fg' && w.reason === 'expired') expiredFg++; });
    say('    ' + expiredFg + ' factory write-offs of expired batches, ' + fullBook.byType.WO.length + ' write-offs in all, ' + fullBook.byType.ADJ.length + ' month-end counts, ' + fullBook.byType.CN.length + ' credit notes');
  });

  section('the calibration bands of RESEARCH 13, each with its figure (the run to 2027-12-31)', function () {
    bands(fullBook, stats, '2027-12-31');
  });

  partNow = 'c';
  if (!quick) {
    section('the stories of RESEARCH 12 and the guide journeys of SPEC 8.1 on business dates over the two years', function () {
      var list = ['2026-02-01', '2026-03-02', '2026-10-03', '2026-11-08', '2026-11-12', '2027-01-01', '2027-04-01', '2027-11-01', '2027-12-31'];
      list.forEach(function (date) {
        var b = bootAt(date), label = date;
        say('    ' + date + ' (' + D.label(date, 'EEE') + '): ' + b.docList.length + ' documents, ' + Object.keys(b.pending).length + ' waiting for the Owner');
        stories(date, label);
        journeys(date, false, label + ' as the personas');
        bootAt(date);
        journeys(date, true, label + ' as the Owner');
      });
    });
  }

  var checks = 0, failures = 0;
  sections.forEach(function (s) { checks += s.checks; failures += s.failures.length; });
  var result = { ok: failures === 0, checks: checks, failures: failures, sections: sections, times: times, lines: out };
  restore();
  return result;
}

function print(result) {
  result.sections.forEach(function (s) {
    console.log((s.failures.length ? 'FAIL  ' : 'ok    ') + s.title + '  (' + s.checks + ' checks' + (s.failures.length ? ', ' + s.failures.length + ' failed' : '') + ', ' + s.ms + ' ms)');
    s.lines.forEach(function (l) { console.log(l); });
    s.failures.forEach(function (f) { console.log('        - ' + f); });
  });
  console.log('');
  console.log(result.checks + ' checks, ' + result.failures + ' failed' + (result.failures ? '' : ' - all passed'));
}

if (require.main === module) {
  var argv = process.argv.slice(2).map(function (a) { return a.toLowerCase(); });
  var r = run({ quick: argv.indexOf('quick') !== -1, part: argv.indexOf('b') !== -1 ? 'b' : (argv.indexOf('c') !== -1 ? 'c' : null) });
  print(r);
  process.exit(r.ok ? 0 : 1);
}

module.exports = run;
module.exports.run = run;
module.exports.print = print;
module.exports.reconcile = reconcile;
