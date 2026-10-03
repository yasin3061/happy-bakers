/*
 * The self-check of SPEC section 11 (SCOPE section 7). Run it after any change to the data layer:
 *   node tools/check.js            every part: the whole self-check (parts b and c take about two minutes)
 *   node tools/check.js a          one part (a, s, b or c; several may be named: `a s` is the quick half)
 *   node tools/check.js b -v       with the figures of a part that prints them (every band, the build times)
 * One summary, and exit code 1 on any failure, with a readable list.
 *
 * Part (a), here: a tiny company (tools/fixture-tiny.js) and three dozen operations through HB.engine.act, as
 * the personas who may do them. Every expected figure was worked out by hand from the fixture - the arithmetic
 * is in the comments - and typed in; none was copied from a run. Then, on the same book: every refusal code,
 * what preview returns, post-then-cancel for every type that can be cancelled, master changes and the audit
 * trail, and persistence (save, rebuild and replay under another persona; a skipped entry; the seed version;
 * a fresh copy). Then, each on a new copy: the rules two reviews found broken, each on the smallest case that
 * shows it (a.15), what the screens reported (a.16), the seven warnings on unusual figures at their thresholds
 * (a.17) and the cancellation of a posted dispatch sheet (a.18).
 * Part (s): the selectors of js/data/data.js on the same tiny company - each against a straight pass over the
 * raw documents and ledger rows, also after cancellations, and the views by role.
 * Parts (b) and (c): the full company (js/data/config.js, js/data/seed.js), written in tools/check-seed.js and
 * run from here - (b) the seed reconciled, (c) the stories and the guide journeys on it.
 */
'use strict';

var path = require('path');
var ROOT = path.join(__dirname, '..');
var HB = require(path.join(ROOT, 'js', 'core', 'kernel.js'));

/* ====================================================== the assert kit */

var results = [];   /* one per part: { key, title, sections: [{ title, checks, failures, lines }] } */
var part = null;    /* the part being run */
var sec = null;     /* the section being run */

/** A named group of checks. Something thrown inside it is one more failure, not the end of the run. */
function section(title, fn) {
  sec = { title: title, checks: 0, failures: [] };
  part.sections.push(sec);
  try { fn(); }
  catch (e) { sec.failures.push('stopped by an error: ' + (e && e.stack ? e.stack.split('\n').slice(0, 4).join(' | ') : String(e))); }
}

function fail(message) { sec.failures.push(message); }

/** Through JSON: what is compared is data, and a missing value is the same as null. */
function plain(x) { return x === undefined ? null : JSON.parse(JSON.stringify(x)); }

/** Where two plain values first differ, as "path: expected x, got y"; null when they are equal. */
function firstDiff(got, want, at) {
  if (got === want) return null;
  if (got === null || want === null || typeof got !== 'object' || typeof want !== 'object') {
    return (at || 'value') + ': expected ' + JSON.stringify(want) + ', got ' + JSON.stringify(got);
  }
  var keys = {}, k, list;
  for (k in got) keys[k] = 1;
  for (k in want) keys[k] = 1;
  list = Object.keys(keys).sort();
  for (var i = 0; i < list.length; i++) {
    var d = firstDiff(got[list[i]] === undefined ? null : got[list[i]], want[list[i]] === undefined ? null : want[list[i]], at ? at + '.' + list[i] : list[i]);
    if (d) return d;
  }
  return null;
}

/** The one assertion: equal to the paisa, the unit and the letter. */
function eq(label, actual, expected) {
  sec.checks++;
  var d = firstDiff(plain(actual), plain(expected), '');
  if (d) fail(label + ' - ' + d);
}

/** The operation must go through; returns its result. */
function ok(label, res) {
  sec.checks++;
  if (!res || !res.ok) fail(label + ': refused - ' + (res && res.error ? res.error.code + ': ' + res.error.message : 'no result'));
  return res || {};
}

/** The operation must be refused with this code and, when given, mark this field and name this document. */
function refused(label, res, code, want) {
  sec.checks++;
  if (!res || res.ok) { fail(label + ': expected the refusal ' + code + ', but it went through'); return res || {}; }
  var e = res.error || {};
  if (e.code !== code) fail(label + ': expected the refusal ' + code + ', got ' + e.code + ' - ' + e.message);
  if (!e.message || typeof e.message !== 'string') fail(label + ': the refusal has no message');
  if (want && want.field !== undefined && e.field !== want.field) fail(label + ': expected field ' + want.field + ', got ' + e.field);
  if (want && want.docId !== undefined && e.docId !== want.docId) fail(label + ': expected docId ' + want.docId + ', got ' + e.docId);
  return res;
}

/* ================================================ helpers for the book */

/** Switch persona, as the role switcher does. */
function as(role) {
  var u = HB.session.set('u_' + role);
  if (!u) throw new Error('no persona for the role ' + role);
  return u;
}

function act(role, op, args) { as(role); return HB.engine.act(op, args); }

function post(role, type, payload) { return act(role, 'post', { type: type, payload: payload }); }

/** What must not move when an operation is refused or only previewed. */
function mark() { return [HB.book.seq, HB.book.docList.length, HB.engine.log().length]; }

/** act as `role`, expect the refusal, and see that neither the book nor the log moved. */
function refusal(label, role, op, args, code, want) {
  as(role);
  var before = mark();
  var res = refused(label, HB.engine.act(op, args), code, want);
  eq(label + ': nothing moved', mark(), before);
  return res;
}

function lastOf(list) { return list[list.length - 1]; }

function lots(locId, itemId) {
  return ((HB.book.lots[locId] || {})[itemId] || []).map(function (l) { return [l.batchId, l.qty, l.reserved]; });
}

/** Zeros and empty lists are the same as nothing: a balance that came back to nothing was never there. */
function prune(x) {
  if (x === 0 || x === null || x === undefined) return undefined;
  if (typeof x !== 'object') return x;
  if (Array.isArray(x)) return x.length ? x : undefined;
  var out = {}, any = false;
  Object.keys(x).sort().forEach(function (k) {
    var v = prune(x[k]);
    if (v !== undefined) { out[k] = v; any = true; }
  });
  return any ? out : undefined;
}

/**
 * Every balance a cancellation must put back, in one comparable object, and the state of the documents that
 * existed when the first snapshot was taken (pass its ids to the second).
 */
function snapshot(ids) {
  var b = HB.book, E = HB.engine;
  var track = ids || b.docList.map(function (d) { return d.id; });
  var lotMap = {}, open = {}, apOpen = {}, gst = {}, items = {}, prices = {}, costs = {};
  Object.keys(b.lots).forEach(function (loc) {
    lotMap[loc] = {};
    Object.keys(b.lots[loc]).forEach(function (it) { lotMap[loc][it] = lots(loc, it); });
  });
  Object.keys(b.ar.open).forEach(function (c) { open[c] = b.ar.open[c].map(function (d) { return [d.id, E.openAmount(d)]; }); });
  Object.keys(b.ap.open).forEach(function (k) { apOpen[k] = b.ap.open[k].map(function (d) { return [d.id, d.total - d.paid]; }); });
  b.gst.forEach(function (g) {
    var k = g.dir + ' ' + g.gstRate, c = gst[k] || (gst[k] = { taxable: 0, cgst: 0, sgst: 0 });
    c.taxable += g.taxable; c.cgst += g.cgst; c.sgst += g.sgst;
  });
  /* the item figures move on the date of whatever moves them, so it is their sum over the days that comes back */
  Object.keys(b.days).forEach(function (d) {
    var byUnit = b.days[d].items;
    Object.keys(byUnit).forEach(function (u) { Object.keys(byUnit[u]).forEach(function (ch) { Object.keys(byUnit[u][ch]).forEach(function (it) {
      var c = byUnit[u][ch][it], k = u + '|' + ch + '|' + it, t = items[k] || (items[k] = { qty: 0, sales: 0, cogs: 0, returnQty: 0, returns: 0 });
      t.qty += c.qty; t.sales += c.sales; t.cogs += c.cogs; t.returnQty += c.returnQty; t.returns += c.returns;
    }); }); });
  });
  Object.keys(b.prices).forEach(function (k) { prices[k] = b.prices[k].rate; });
  HB.masters.items.forEach(function (it) { if (it.kind === 'fg') costs[it.id] = E.unitCost(it.id); });
  return {
    ids: track,
    state: plain(prune({
      stock: b.stock, lots: lotMap, reserved: b.reserved,
      ar: b.ar.balance, arTotal: b.ar.total, credit: b.ar.credit, open: open,
      ap: b.ap.balance, apTotal: b.ap.total, apOpen: apOpen,
      cash: b.cash.balance, pnl: b.pnlMonth, gst: gst, items: items, prices: prices, costs: costs,
      pending: Object.keys(b.pending).filter(function (id) { return track.indexOf(id) !== -1; }),
      unbilled: Object.keys(b.unbilled).map(function (v) { return b.unbilled[v].map(function (g) { return g.id; }); }),
      docs: track.map(function (id) {
        var d = b.docs[id];
        return [d.id, d.status, d.paid, d.received, d.credited, d.creditApplied, d.billId, d.invId, d.woId, d.type === 'PO' ? d.lines.map(function (l) { return l.received; }) : null];
      })
    }))
  };
}

/** Cancel `id` as `role` and see every balance return to `before`. Returns the result of the cancellation. */
function cancelBack(label, before, id, role, reason) {
  var res = ok(label + ': cancel', act(role, 'cancel', { id: id, reason: reason || 'post-then-cancel check' }));
  var target = HB.book.docs[id], cxl = res.doc || {};
  eq(label + ': the cancellation', [target.status, target.cancelled && target.cancelled.docId, cxl.type, cxl.date, cxl.targetId, cxl.createdBy], ['CANCELLED', cxl.id, 'CXL', HB.calendar.today, id, 'u_' + role]);
  eq(label + ': every balance is back', snapshot(before.ids).state, before.state);
  return res;
}

/** A fingerprint of every ledger, the documents, the balances and the masters: one hash each, so a difference names its ledger. */
function bookHash() {
  var b = HB.book, m = HB.masters, out = {};
  var image = {
    docs: b.docList, moves: b.moves, ar: b.ar.entries, ap: b.ap.entries, cash: b.cash.entries, pnl: b.pnl, gst: b.gst,
    audit: b.audit, stock: b.stock, lots: b.lots, reserved: b.reserved, batches: b.batches,
    arBalance: b.ar.balance, credit: b.ar.credit, apBalance: b.ap.balance, cashBalance: b.cash.balance,
    pnlMonth: b.pnlMonth, prices: b.prices, pending: Object.keys(b.pending), seq: b.seq,
    masters: [m.items, m.recipes, m.customers, m.vendors, m.employees, m.expenseCategories, m.units, m.locations, m.accounts, m.routes, m.changes]
  };
  Object.keys(image).forEach(function (k) { var s = JSON.stringify(image[k]); out[k] = HB.hash(s) + ':' + s.length; });
  return out;
}

function gstTotals() {
  var out = {};
  HB.book.gst.forEach(function (g) {
    var k = g.dir + ' ' + g.gstRate, c = out[k] || (out[k] = { taxable: 0, cgst: 0, sgst: 0 });
    c.taxable += g.taxable; c.cgst += g.cgst; c.sgst += g.sgst;
  });
  return out;
}

/* ============================================= part (a): the tiny company */

var T = '2026-03-10';      /* the business date of the copy: a Tuesday. January is locked, February is open */
var Y1 = '2026-03-09';     /* the day before: the last day of history */
var Y2 = '2026-03-08';

/*
 * The opening entries of the tiny company, dated go-live (1 Jan 2026). Rates in paise: maida Rs 36.00 a kg,
 * shortening Rs 120.00 a kg, a bag Rs 0.80. The 60 loaves were made on 31 Dec 2025 and so expired on 4 Jan: by
 * the business date they are stock that can only be written off.
 */
function tinyOpening() {
  return {
    stock: [
      { locId: 'fac_rm', itemId: 'maida', qty: 200, rate: 3600 },
      { locId: 'fac_rm', itemId: 'fat', qty: 50, rate: 12000 },
      { locId: 'fac_rm', itemId: 'bag', qty: 1000, rate: 80 },
      { locId: 'fac_fg', itemId: 'bread', qty: 60, mfgDate: '2025-12-31' }
    ],
    cash: [{ accountId: 'cash_factory', amount: 5000000 }, { accountId: 'cash_st_vvn', amount: 200000 }, { accountId: 'bank', amount: 30000000 }],
    receivables: [{ customerId: 'c_corp', total: 1000000, dueDate: '2026-01-15' }],
    payables: [{ vendorId: 'v_stock', total: 2000000, dueDate: '2026-01-10' }]
  };
}

function partA() {
  require(path.join(__dirname, 'fixture-tiny.js'));
  HB.config.opening = tinyOpening();
  require(path.join(ROOT, 'js', 'data', 'engine.js'));

  var E = HB.engine, book, r;
  var po, grn1, grn2, bill, pay1, prodBread, prodPuff, inv1, inv2, so, inv3, xfer, dayEnd, wo1, rcpt1, cn, inv4, wo2, adj, claim, pay2, sal, pay3, dep1, dep2, ebill, rcpt2, cxl;

  section('a.1 boot: the opening entries and nothing else', function () {
    HB.calendar.set(T);
    E.boot();
    book = HB.book;
    eq('the calendar of the copy', [HB.calendar.today, HB.calendar.dataEnd, HB.calendar.lockBefore], [T, Y1, '2026-02-01']);
    eq('the opening documents', book.docList.map(function (d) { return [d.id, d.status, d.seed]; }),
      [['OPENSTOCK-260101-001', 'POSTED', true], ['OPENCASH-260101-001', 'POSTED', true], ['INV-260101-001', 'POSTED', true], ['VBILL-260101-001', 'POSTED', true]]);
    eq('no log, nothing skipped, no notice', [E.log().length, E.skipped, E.notice], [0, [], '']);
    eq('opening stock', book.stock, { fac_rm: { maida: 200, fat: 50, bag: 1000 }, fac_fg: { bread: 60 }, st_vvn: {}, transit_st_vvn: {} });
    /* best before = 31 Dec + 4 days */
    eq('opening batch', lots('fac_fg', 'bread'), [['B-251231-BRD', 60, 0]]);
    eq('it is past its date: nothing to dispatch', E.available('fac_fg', 'bread', T), 0);
    eq('opening cash', book.cash.balance, { cash_factory: 5000000, cash_st_vvn: 200000, bank: 30000000 });
    eq('opening receivable and payable', [book.ar.balance, book.ap.balance], [{ c_corp: 1000000 }, { 'vendor:v_stock': 2000000 }]);
    /* bread (10 x 3600 + 0.5 x 12000) / 40 + 80 = 42000 / 40 + 80 = 1130
       puff  (4 x 3600 + 2 x 12000) / 100 + 80 = 38400 / 100 + 80 = 464 */
    eq('unit costs at the opening rates', [E.unitCost('bread'), E.unitCost('puff')], [1130, 464]);
  });

  section('a.2 buy: order, part receipt, a bill held by the three-way check, payment', function () {
    /* 1. PO. maida 500 x 3800 = 1900000; shortening 20 x 12500 = 250000; total 2150000 <= the limit 5000000 */
    po = ok('PO', post('stores', 'PO', { date: T, vendorId: 'v_stock', expectedDate: '2026-03-12', lines: [{ itemId: 'maida', qty: 500, rate: 3800 }, { itemId: 'fat', qty: 20, rate: 12500 }] })).doc;
    eq('the order is approved as it is submitted', [po.id, po.status, po.approval.state, po.total, po.lines.map(function (l) { return [l.amount, l.gstRate, l.received]; }), po.createdBy, po.createdAt, po.seed],
      ['PO-U-0001', 'APPROVED', 'none', 2150000, [[1900000, 0, 0], [250000, 5, 0]], 'u_stores', T + 'T09:01', false]);
    eq('and the audit trail says so', (function (a) { return [a.action, a.docId, a.userId, a.role, a.at, a.note, a.after]; })(lastOf(book.audit)), ['post', 'PO-U-0001', 'u_stores', 'stores', T + 'T09:01', 'within limit', 'APPROVED']);
    eq('the log entry', E.log()[0], { n: 1, at: T + 'T09:01', userId: 'u_stores', role: 'stores', op: 'post',
      args: { type: 'PO', payload: { date: T, vendorId: 'v_stock', expectedDate: '2026-03-12', lines: [{ itemId: 'maida', qty: 500, rate: 3800 }, { itemId: 'fat', qty: 20, rate: 12500 }] } },
      out: { ids: ['PO-U-0001'], batchId: null } });

    /* 2. GRN, a part receipt: 300 kg of maida accepted and 10 kg sent back, all 20 kg of shortening.
       Raw stock: maida 200 + 300 = 500; shortening 50 + 20 = 70. The receipt sets the purchase price:
       bread (10 x 3800 + 0.5 x 12500) / 40 + 80 = 44250 / 40 + 80 = 1106.25 + 80 = 1186.25
       puff  (4 x 3800 + 2 x 12500) / 100 + 80 = 40200 / 100 + 80 = 402 + 80 = 482 */
    grn1 = ok('GRN part', post('stores', 'GRN', { date: T, poId: po.id, lines: [{ itemId: 'maida', qty: 300, rejectedQty: 10 }, { itemId: 'fat', qty: 20 }] })).doc;
    eq('part receipt', [grn1.id, grn1.lines, po.status, po.lines.map(function (l) { return l.received; })],
      ['GRN-U-0001', [{ itemId: 'maida', qty: 300, rejectedQty: 10, rate: 3800 }, { itemId: 'fat', qty: 20, rejectedQty: 0, rate: 12500 }], 'PART_RECEIVED', [300, 20]]);
    eq('raw stock after it', book.stock.fac_rm, { maida: 500, fat: 70, bag: 1000 });
    eq('the receipt sets the latest purchase price', [E.price('maida'), E.price('fat'), E.price('bag')], [3800, 12500, 80]);
    eq('and with it the cost of both products', [E.unitCost('bread'), E.unitCost('puff')], [1186.25, 482]);

    /* 3. GRN, the rest: maida 500 + 200 = 700 */
    grn2 = ok('GRN rest', post('stores', 'GRN', { date: T, poId: po.id, lines: [{ itemId: 'maida', qty: 200 }] })).doc;
    eq('order received in full', [grn2.id, po.status, po.lines[0].received, book.stock.fac_rm.maida], ['GRN-U-0002', 'RECEIVED', 500, 700]);

    /* 4. VBILL for both receipts, the shortening billed at Rs 130 instead of Rs 125.
       maida: expected 300 x 3800 + 200 x 3800 = 1140000 + 760000 = 1900000; billed 500 x 3800 = 1900000: no difference
       shortening: expected 20 x 12500 = 250000; billed 20 x 13000 = 260000; 10000 off, and 2% of 250000 is 5000: held
       GST: maida Nil; shortening 5%: CGST = SGST = round(260000 x 5 / 200) = 6500
       taxable 1900000 + 260000 = 2160000; GST 13000; total 2173000; due 10 Mar + 15 days = 25 Mar */
    var billPayload = { date: T, vendorId: 'v_stock', billNo: 'CF/501', grnIds: [grn1.id, grn2.id], lines: [{ itemId: 'maida', qty: 500, rate: 3800 }, { itemId: 'fat', qty: 20, rate: 13000 }] };
    as('accounts');
    var before = mark(), pv = E.preview('VBILL', billPayload);
    eq('preview: the three-way result before anything is posted', [pv.ok, pv.preview, pv.doc.id, pv.doc.status, pv.doc.total, pv.doc.match, pv.outcome, mark()],
      [true, true, '', 'HELD', 2173000, {
        ok: false, diffs: [
          { itemId: 'maida', orderedRate: 3800, acceptedQty: 500, billedQty: 500, billedRate: 3800, expected: 1900000, billed: 1900000, diff: 0, ok: true },
          { itemId: 'fat', orderedRate: 12500, acceptedQty: 20, billedQty: 20, billedRate: 13000, expected: 250000, billed: 260000, diff: 10000, ok: false }]
      }, { status: 'HELD', waits: true, self: false }, before]);
    bill = ok('VBILL', post('accounts', 'VBILL', billPayload)).doc;
    eq('the bill is held', [bill.id, bill.status, bill.match.ok, bill.taxable, bill.gst, bill.total, bill.dueDate, bill.lines.map(function (l) { return [l.taxable, l.cgst, l.sgst]; }), bill.approval.state, grn1.billId, grn2.billId],
      ['VBILL-U-0001', 'HELD', false, 2160000, 13000, 2173000, '2026-03-25', [[1900000, 0, 0], [260000, 6500, 6500]], 'pending', 'VBILL-U-0001', 'VBILL-U-0001']);
    eq('a held bill is not yet owed and claims no GST', [book.ap.balance['vendor:v_stock'], book.gst.length, Object.keys(book.pending)], [2000000, 0, ['VBILL-U-0001']]);

    /* 5. the Owner approves it: payable 2000000 + 2173000 = 4173000 */
    ok('approve the bill', act('owner', 'approve', { id: bill.id }));
    eq('posted on approval', [bill.status, bill.approval, book.ap.balance['vendor:v_stock']], ['POSTED', { state: 'approved', by: 'u_owner', at: T + 'T09:05', reason: '', self: false }, 4173000]);
    eq('the approval in the audit trail', (function (a) { return [a.action, a.docId, a.userId, a.role, a.at, a.before, a.after]; })(lastOf(book.audit)), ['approve', 'VBILL-U-0001', 'u_owner', 'owner', T + 'T09:05', 'HELD', 'POSTED']);
    eq('the bill does not move the purchase price', E.price('fat'), 12500);

    /* 6. PAY from the bank: the opening bill in full (2000000) and 1000000 of the new one.
       bank 30000000 - 3000000 = 27000000; payable 4173000 - 3000000 = 1173000 */
    pay1 = ok('PAY', post('accounts', 'PAY', { date: T, payeeType: 'vendor', payeeId: 'v_stock', account: 'bank', amount: 3000000, ref: 'NEFT 4471', allocations: [{ docId: 'VBILL-260101-001', amount: 2000000 }, { docId: bill.id, amount: 1000000 }] })).doc;
    eq('payment', [pay1.id, pay1.amount, book.cash.balance.bank, book.ap.balance['vendor:v_stock'], book.docs['VBILL-260101-001'].paid, bill.paid], ['PAY-U-0001', 3000000, 27000000, 1173000, 2000000, 1000000]);
  });

  section('a.3 make: two production entries, back-dated one day', function () {
    /* 7. PROD bread, dated yesterday (the supervisor may go back three days), 3 mixes, 117 good, 3 rejected.
       maida 3 x 10 = 30 kg x 3800 = 114000; shortening 3 x 0.5 = 1.5 kg x 12500 = 18750; bags 117 x 80 = 9360
       expected 3 x 40 = 120; loss (120 - 117) x 1186.25 = 3558.75 -> 3559; best before 9 Mar + 4 = 13 Mar */
    prodBread = ok('PROD bread', post('production', 'PROD', { date: Y1, itemId: 'bread', mixes: 3, goodUnits: 117, rejectedUnits: 3 })).doc;
    eq('bread run', [prodBread.id, prodBread.date, prodBread.createdAt, prodBread.batchId, prodBread.bestBefore, prodBread.expectedUnits, prodBread.unitCost, prodBread.lossValue, prodBread.consumption],
      ['PROD-U-0001', Y1, T + 'T09:07', 'B-260309-BRD', '2026-03-13', 120, 1186.25, 3559,
        [{ itemId: 'maida', qty: 30, rate: 3800, value: 114000 }, { itemId: 'fat', qty: 1.5, rate: 12500, value: 18750 }, { itemId: 'bag', qty: 117, rate: 80, value: 9360 }]]);
    eq('the batch id is fixed in the log entry', E.log()[6].out, { ids: ['PROD-U-0001'], batchId: 'B-260309-BRD' });
    eq('its rows carry its own date', E.rowsOf(prodBread.id).pnl.map(function (x) { return [x.date, x.line, x.itemId, x.amount, x.qty]; }), [[Y1, 'prodLoss', 'bread', 3559, 3]]);

    /* 8. PROD puff, dated yesterday, 1 mix, all 100 good: maida 4 x 3800 = 15200; shortening 2 x 12500 = 25000;
       bags 100 x 80 = 8000; no loss; best before 9 Mar + 1 = 10 Mar, the business date */
    prodPuff = ok('PROD puff', post('production', 'PROD', { date: Y1, itemId: 'puff', mixes: 1, goodUnits: 100 })).doc;
    eq('puff run', [prodPuff.id, prodPuff.batchId, prodPuff.bestBefore, prodPuff.unitCost, prodPuff.lossValue, prodPuff.consumption, E.rowsOf(prodPuff.id).pnl.length],
      ['PROD-U-0002', 'B-260309-PUF', T, 482, 0, [{ itemId: 'maida', qty: 4, rate: 3800, value: 15200 }, { itemId: 'fat', qty: 2, rate: 12500, value: 25000 }, { itemId: 'bag', qty: 100, rate: 80, value: 8000 }], 0]);
    /* maida 700 - 30 - 4 = 666; shortening 70 - 1.5 - 2 = 66.5; bags 1000 - 117 - 100 = 783 */
    eq('raw stock after production', book.stock.fac_rm, { maida: 666, fat: 66.5, bag: 783 });
    eq('finished stock by batch', [lots('fac_fg', 'bread'), lots('fac_fg', 'puff')], [[['B-251231-BRD', 60, 0], ['B-260309-BRD', 117, 0]], [['B-260309-PUF', 100, 0]]]);
    eq('what can be dispatched today', [E.available('fac_fg', 'bread', T), E.available('fac_fg', 'puff', T)], [117, 100]);
  });

  section('a.4 sell: dispatch sheet, corporate order and invoice', function () {
    var sheet = E.dispatchSheet('r1', T);
    eq('the prefilled sheet', [sheet.sheetId, sheet.posted, sheet.items], ['DS-r1-260310', false, [{ itemId: 'bread', total: 50, available: 117, short: false }, { itemId: 'puff', total: 30, available: 100, short: false }]]);
    as('sales');
    var before = mark(), pv = E.preview('DISPATCH', { routeId: 'r1', date: T, outlets: sheet.outlets });
    eq('preview of the sheet', [pv.ok, pv.sheetId, pv.totals, pv.docs.map(function (d) { return [d.customerId, d.total, d.paidNow]; }), pv.stock, mark()],
      [true, 'DS-r1-260310', { bread: 50, puff: 30 }, [['c_cash', 75550, 75550], ['c_week', 119100, 0]],
        [{ index: null, itemId: 'bread', batchId: null, locId: 'fac_fg', wanted: 50, available: 117, short: false }, { index: null, itemId: 'puff', batchId: null, locId: 'fac_fg', wanted: 30, available: 100, short: false }], before]);

    /* 9. the sheet, as prefilled. Two invoices, one log entry.
       cash outlet:   bread 20 x 3200 = 64000 (Nil); puff 10 x 1100 = 11000, CGST = SGST = round(11000 x 5 / 200) = 275
                      taxable 75000, GST 550, total 75550, all collected into factory cash
                      cost: 20 x 1186.25 = 23725; 10 x 482 = 4820
       weekly outlet: bread 30 x 3200 = 96000; puff 20 x 1100 = 22000, CGST = SGST = 550
                      taxable 118000, GST 1100, total 119100, due 10 Mar + 7 = 17 Mar
                      cost: 30 x 1186.25 = 35587.5 -> 35588; 20 x 482 = 9640 */
    r = ok('dispatch sheet', act('sales', 'postDispatch', { routeId: 'r1', date: T, outlets: sheet.outlets }));
    inv1 = r.docs[0]; inv2 = r.docs[1];
    eq('one log entry, two ids', (function (e) { return [e.n, e.op, e.out.ids]; })(lastOf(E.log())), [9, 'postDispatch', ['INV-U-0001', 'INV-U-0002']]);
    eq('cash outlet invoice', [inv1.id, inv1.customerId, inv1.channel, inv1.routeId, inv1.sheetId, inv1.terms, inv1.dueDate, inv1.taxable, inv1.gst, inv1.total, inv1.creditApplied, inv1.paidNow, inv1.cost],
      ['INV-U-0001', 'c_cash', 'retail', 'r1', 'DS-r1-260310', 'cash', T, 75000, 550, 75550, 0, 75550, 28545]);
    /* the expired opening batch is passed over: the bread comes from yesterday's batch */
    eq('its lines', inv1.lines, [
      { itemId: 'bread', qty: 20, price: 3200, gstRate: 0, taxable: 64000, cgst: 0, sgst: 0, unitCost: 1186.25, cost: 23725, batches: [{ batchId: 'B-260309-BRD', qty: 20 }] },
      { itemId: 'puff', qty: 10, price: 1100, gstRate: 5, taxable: 11000, cgst: 275, sgst: 275, unitCost: 482, cost: 4820, batches: [{ batchId: 'B-260309-PUF', qty: 10 }] }]);
    eq('weekly outlet invoice', [inv2.id, inv2.customerId, inv2.dueDate, inv2.taxable, inv2.gst, inv2.total, inv2.paidNow, inv2.lines.map(function (l) { return [l.taxable, l.cgst, l.cost]; }), inv2.cost],
      ['INV-U-0002', 'c_week', '2026-03-17', 118000, 1100, 119100, 0, [[96000, 0, 35588], [22000, 550, 9640]], 45228]);
    /* factory cash 5000000 + 75550 */
    eq('cash and balances after the sheet', [book.cash.balance.cash_factory, book.ar.balance.c_cash, book.ar.balance.c_week], [5075550, 0, 119100]);

    /* 10. SO for the hostel mess: 15 loaves at the corporate price, Rs 30.00 */
    so = ok('SO', post('sales', 'SO', { date: T, customerId: 'c_corp', deliveryDate: T, poRef: 'HM/77', lines: [{ itemId: 'bread', qty: 15 }] })).doc;
    eq('order', [so.id, so.status, so.lines], ['SO-U-0001', 'OPEN', [{ itemId: 'bread', qty: 15, price: 3000 }]]);

    /* 11. INV for the order: 15 x 3000 = 45000, Nil; cost 15 x 1186.25 = 17793.75 -> 17794; due 10 Mar + 15 = 25 Mar.
       The mess already owes its opening 1000000, which is its credit limit: 1045000 is above it - a warning. */
    as('sales');
    pv = E.preview('INV', { date: T, customerId: 'c_corp', soId: so.id });
    eq('preview: the credit-limit warning and the stock behind the line', [pv.ok, pv.doc.total, pv.warnings.map(function (w) { return w.code; }), pv.credit, pv.stock, pv.outcome],
      [true, 45000, ['credit_limit'], { limit: 1000000, owes: 1000000, after: 1045000, over: true },
        [{ index: 0, itemId: 'bread', batchId: null, locId: 'fac_fg', wanted: 15, available: 67, short: false }], { status: 'POSTED', waits: false, self: false }]);
    r = ok('INV from the order', post('sales', 'INV', { date: T, customerId: 'c_corp', soId: so.id }));
    inv3 = r.doc;
    eq('corporate invoice', [inv3.id, inv3.channel, inv3.terms, inv3.dueDate, inv3.total, inv3.gst, inv3.paidNow, inv3.lines[0].cost, inv3.lines[0].batches, r.warnings.map(function (w) { return w.code; }), so.status, so.invId],
      ['INV-U-0003', 'corporate', 'credit', '2026-03-25', 45000, 0, 0, 17794, [{ batchId: 'B-260309-BRD', qty: 15 }], ['credit_limit'], 'INVOICED', 'INV-U-0003']);
  });

  section('a.5 store: transfer, confirmation, day-end with expired units and a cash shortage', function () {
    /* bread 117 - 50 - 15 = 52 available; puff 100 - 30 = 70 */
    eq('the prefilled transfer', E.transferSheet('st_vvn', T).lines, [{ itemId: 'bread', standing: 20, atStore: 0, inTransit: 0, qty: 20, available: 52 }, { itemId: 'puff', standing: 50, atStore: 0, inTransit: 0, qty: 50, available: 70 }]);
    /* 12. XFER as prefilled */
    xfer = ok('XFER', post('stores', 'XFER', { date: T, toStoreId: 'st_vvn', lines: [{ itemId: 'bread', qty: 20 }, { itemId: 'puff', qty: 50 }] })).doc;
    eq('on its way', [xfer.id, xfer.status, book.stock.transit_st_vvn, book.stock.st_vvn, E.available('st_vvn', 'bread', T)], ['XFER-U-0001', 'SENT', { bread: 20, puff: 50 }, {}, 0]);
    /* 13. the store manager confirms it */
    ok('receive', act('store_mgr', 'receiveTransfer', { id: xfer.id }));
    eq('at the store', [xfer.status, xfer.receivedBy, xfer.receivedAt, book.stock.transit_st_vvn, book.stock.st_vvn], ['RECEIVED', 'u_store_mgr', T + 'T09:13', { bread: 0, puff: 0 }, { bread: 20, puff: 50 }]);

    /* 14. DAYEND: 12 loaves and 40 puffs sold, 10 puffs unsold on their best-before date; cash 700.00, UPI 375.00.
       bread: 12 x 4000 = 48000, Nil, taxable 48000; cost 12 x 1186.25 = 14235
       puff:  40 x 1500 = 60000 with GST inside: CGST = SGST = round(60000 x 5 / (2 x 105)) = round(1428.57) = 1429
              taxable 60000 - 2858 = 57142; cost 40 x 482 = 19280
       gross 108000; taxable 105142; GST 2858; cash + UPI = 70000 + 37500 = 107500: 500 short, a cost of the store
       expired: 10 puffs of the batch x 482 = 4820, a write-off that waits for the Owner */
    var payload = { date: T, storeId: 'st_vvn', lines: [{ itemId: 'bread', sold: 12, expired: 0 }, { itemId: 'puff', sold: 40, expired: 10 }], cash: 70000, upi: 37500 };
    as('store_mgr');
    var pv = E.preview('DAYEND', payload);
    eq('preview: stock behind each line and what may be entered as expired', [pv.ok, pv.docs.length, pv.doc.shortExcess, pv.stock], [true, 2, -500, [
      { index: 0, itemId: 'bread', batchId: null, locId: 'st_vvn', wanted: 12, available: 20, short: false, expired: 0, expirable: 0, expiredShort: false },
      { index: 1, itemId: 'puff', batchId: null, locId: 'st_vvn', wanted: 40, available: 50, short: false, expired: 10, expirable: 10, expiredShort: false }]]);
    r = ok('DAYEND', post('store_mgr', 'DAYEND', payload));
    dayEnd = r.doc; wo1 = r.docs[1];
    eq('one log entry, the day-end and its write-off', lastOf(E.log()).out.ids, ['DAYEND-U-0001', 'WO-U-0001']);
    eq('day-end totals', [dayEnd.id, dayEnd.gross, dayEnd.taxable, dayEnd.gst, dayEnd.cash, dayEnd.upi, dayEnd.shortExcess, dayEnd.cost, dayEnd.woId], ['DAYEND-U-0001', 108000, 105142, 2858, 70000, 37500, -500, 33515, 'WO-U-0001']);
    eq('day-end lines', dayEnd.lines, [
      { itemId: 'bread', sold: 12, expired: 0, mrp: 4000, gstRate: 0, gross: 48000, taxable: 48000, cgst: 0, sgst: 0, unitCost: 1186.25, cost: 14235, batches: [{ batchId: 'B-260309-BRD', qty: 12 }] },
      { itemId: 'puff', sold: 40, expired: 10, mrp: 1500, gstRate: 5, gross: 60000, taxable: 57142, cgst: 1429, sgst: 1429, unitCost: 482, cost: 19280, batches: [{ batchId: 'B-260309-PUF', qty: 40 }] }]);
    eq('the write-off it raises', [wo1.id, wo1.type, wo1.status, wo1.reason, wo1.sourceDocId, wo1.date, wo1.createdBy, wo1.locId, wo1.lines],
      ['WO-U-0001', 'WO', 'PENDING', 'expired', 'DAYEND-U-0001', T, 'u_store_mgr', 'st_vvn', [{ itemId: 'puff', batchId: 'B-260309-PUF', qty: 10, rate: 482, value: 4820 }]]);
    eq('the expired units are held back, not gone', [book.stock.st_vvn, book.reserved.st_vvn.puff, E.available('st_vvn', 'puff', T)], [{ bread: 8, puff: 10 }, 10, 0]);
    /* store cash 200000 + 70000; bank 27000000 + 37500 */
    eq('cash of the day-end', [book.cash.balance.cash_st_vvn, book.cash.balance.bank], [270000, 27037500]);
    eq('its P&L rows', E.rowsOf(dayEnd.id).pnl.map(function (x) { return [x.line, x.channel, x.categoryId, x.unitId, x.amount, x.qty]; }),
      [['sales', 'store', null, 'st_vvn', 105142, 52], ['cogs', 'store', null, 'st_vvn', 33515, 52], ['expense', null, 'cash_short', 'st_vvn', 500, 0]]);

    /* 15. the Owner approves the write-off: the 10 puffs leave the store, 4820 to write-offs */
    ok('approve the write-off', act('owner', 'approve', { id: wo1.id }));
    eq('written off', [wo1.status, book.stock.st_vvn, book.reserved.st_vvn.puff, E.rowsOf(wo1.id).pnl.map(function (x) { return [x.date, x.line, x.itemId, x.unitId, x.amount, x.qty]; })],
      ['POSTED', { bread: 8, puff: 0 }, 0, [[T, 'writeoff', 'puff', 'st_vvn', 4820, 10]]]);
  });

  section('a.6 collect: receipt with an on-account remainder, a stale return above the limit, credit applied', function () {
    /* 16. RCPT from the mess into the bank, 1200000: the opening invoice 1000000 and INV-U-0003 45000;
       1200000 - 1045000 = 155000 stays on account. Balance 1000000 + 45000 - 1200000 = -155000.
       bank 27037500 + 1200000 = 28237500 */
    r = ok('RCPT', post('accounts', 'RCPT', { date: T, customerId: 'c_corp', account: 'bank', amount: 1200000, mode: 'neft', allocations: [{ docId: 'INV-260101-001', amount: 1000000 }, { docId: inv3.id, amount: 45000 }] }));
    rcpt1 = r.doc;
    /* 1200000 is more than the 1045000 the mess owes: posted all the same, with the warning that says what stays on account (a.17 has all seven) */
    eq('more than the mess owes: a warning, not a refusal', [r.warnings, rcpt1.warned, rcpt1.status],
      [[{ code: 'over_owed', message: HB.fmt.inr2(1200000) + ' is more than the ' + HB.fmt.inr2(1045000) + ' Sardar Hostel Mess owes. ' + HB.fmt.inr2(155000) + ' will stay on account', field: 'amount' }], ['over_owed'], 'POSTED']);
    eq('receipt with a remainder', [rcpt1.id, rcpt1.onAccount, book.ar.balance.c_corp, book.ar.credit.c_corp, (book.ar.open.c_corp || []).length, E.openAmount(inv3), book.cash.balance.bank],
      ['RCPT-U-0001', 155000, -155000, 155000, 0, 0, 28237500]);

    /* 17. CN: the cash outlet returns 3 stale loaves: 3 x 3200 = 9600. Supplied to it in the seven days to
       10 Mar: 75000. Share = 9600 / 75000 = 12.8%, above 8%: held. */
    var payload = { date: T, customerId: 'c_cash', lines: [{ itemId: 'bread', qty: 3 }] };
    as('sales');
    var pv = E.preview('CN', payload);
    eq('preview: the share of returns', [pv.ok, pv.doc.status, pv.returns, pv.outcome],
      [true, 'HELD', { from: '2026-03-04', to: T, supply: 75000, returned: 0, thisReturn: 9600, sharePct: 12.8, limitPct: 8, held: true, reason: 'returns are above 8% of the supply of the last seven days' }, { status: 'HELD', waits: true, self: false }]);
    cn = ok('CN', post('sales', 'CN', payload)).doc;
    eq('return held', [cn.id, cn.status, cn.sharePct, cn.taxable, cn.gst, cn.total, book.ar.balance.c_cash, (book.pnlMonth['2026-03'].returns.retail || 0)], ['CN-U-0001', 'HELD', 12.8, 9600, 0, 9600, 0, 0]);

    /* 18. the Owner approves it. The outlet paid cash, so no invoice is open: all 9600 becomes its credit. */
    ok('approve the return', act('owner', 'approve', { id: cn.id }));
    eq('return posted as credit', [cn.status, cn.allocations, cn.onAccount, book.ar.credit.c_cash, book.ar.balance.c_cash, book.pnlMonth['2026-03'].returns.retail], ['POSTED', [], 9600, 9600, -9600, -9600]);

    /* 19. INV, a further supply to the cash outlet the same day: 5 x 3200 = 16000, Nil.
       The credit is applied first: 9600; the rest, 6400, is collected in cash. Cost 5 x 1186.25 = 5931.25 -> 5931.
       factory cash 5075550 + 6400 = 5081950 */
    inv4 = ok('INV cash with credit', post('sales', 'INV', { date: T, customerId: 'c_cash', lines: [{ itemId: 'bread', qty: 5 }], sheetId: 'DS-r1-260310', routeId: 'r9' })).doc;
    eq('credit applied, the rest collected', [inv4.id, inv4.total, inv4.creditApplied, inv4.paidNow, inv4.lines[0].cost, book.ar.credit.c_cash, book.ar.balance.c_cash, book.cash.balance.cash_factory],
      ['INV-U-0004', 16000, 9600, 6400, 5931, 0, 0, 5081950]);
    eq('a typed sheet id or route is not taken', [inv4.sheetId, inv4.routeId, E.dispatchSheet('r1', T).invoiceIds], [null, 'r1', ['INV-U-0001', 'INV-U-0002']]);
  });

  section('a.7 stock: a write-off and a stock count', function () {
    /* 20. WO: the 60 opening loaves, long past their date: 60 x 1186.25 = 71175 at today's recipe cost */
    wo2 = ok('WO', post('stores', 'WO', { date: T, locId: 'fac_fg', reason: 'expired', lines: [{ itemId: 'bread', batchId: 'B-251231-BRD', qty: 60 }] })).doc;
    eq('write-off waits and holds its stock', [wo2.id, wo2.status, wo2.lines, wo2.value, wo2.sourceDocId, book.stock.fac_fg.bread, book.reserved.fac_fg.bread],
      ['WO-U-0002', 'PENDING', [{ itemId: 'bread', batchId: 'B-251231-BRD', qty: 60, rate: 1186.25, value: 71175 }], 71175, null, 87, 60]);
    /* 21. approved: finished bread 87 - 60 = 27, all of yesterday's batch (117 - 20 - 30 - 15 - 20 - 5) */
    ok('approve it', act('owner', 'approve', { id: wo2.id }));
    eq('gone from stock', [wo2.status, book.stock.fac_fg.bread, lots('fac_fg', 'bread')], ['POSTED', 27, [['B-260309-BRD', 27, 0]]]);

    /* 22. ADJ: the raw store is counted: maida 664 against 666 in the books, bags 785 against 783.
       maida -2 x 3800 = -7600; bags +2 x 80 = +160; net -7440 */
    adj = ok('ADJ', post('stores', 'ADJ', { date: T, locId: 'fac_rm', reason: 'weekly count', lines: [{ itemId: 'maida', countedQty: 664 }, { itemId: 'bag', countedQty: 785 }] })).doc;
    eq('count waits', [adj.id, adj.status, adj.value, adj.lines, book.stock.fac_rm.maida],
      ['ADJ-U-0001', 'PENDING', -7440, [{ itemId: 'maida', batchId: null, systemQty: 666, countedQty: 664, diff: -2, rate: 3800, value: -7600 }, { itemId: 'bag', batchId: null, systemQty: 783, countedQty: 785, diff: 2, rate: 80, value: 160 }], 666]);
    /* 23. approved: the stock moves, a shortage is a cost and a surplus the opposite */
    ok('approve it', act('owner', 'approve', { id: adj.id }));
    eq('count posted', [adj.status, book.stock.fac_rm, E.rowsOf(adj.id).pnl.map(function (x) { return [x.line, x.itemId, x.amount]; })],
      ['POSTED', { maida: 664, fat: 66.5, bag: 785 }, [['countDiff', 'maida', 7600], ['countDiff', 'bag', -160]]]);
  });

  section('a.8 spend: a claim paid, the salary bill, deposits, an expense bill, a cancellation', function () {
    /* 24. EXP claim by the store manager: Rs 350.00 of travel for her store; no GST on a claim */
    claim = ok('claim', post('store_mgr', 'EXP', { kind: 'claim', date: T, categoryId: 'travel', unitId: 'st_vvn', amount: 35000, billRef: 'auto fare' })).doc;
    eq('claim waits', [claim.id, claim.status, claim.payeeType, claim.payeeId, claim.total, claim.gst, claim.dueDate, book.ap.balance['employee:E004'] || 0], ['EXP-U-0001', 'PENDING', 'employee', 'E004', 35000, 0, T, 0]);
    /* 25, 26. approved, then reimbursed from factory cash: 5081950 - 35000 = 5046950 */
    ok('approve the claim', act('owner', 'approve', { id: claim.id }));
    eq('claim owed', [claim.status, book.ap.balance['employee:E004']], ['APPROVED', 35000]);
    pay2 = ok('reimburse', post('accounts', 'PAY', { date: T, payeeType: 'employee', payeeId: 'E004', account: 'cash_factory', allocations: [{ docId: claim.id, amount: 35000 }] })).doc;
    eq('claim paid', [pay2.id, pay2.amount, claim.status, claim.paid, book.ap.balance['employee:E004'], book.cash.balance.cash_factory], ['PAY-U-0002', 35000, 'PAID', 35000, 0, 5046950]);

    /* 27. the salary bill for February (the month before the business date; its last day, 28 Feb, is in an
       open month). On the rolls that day: factory E001 5000000 + E002 2500000 + E003 1800000 (joined 10 Feb)
       = 9300000, three people; store E004 1600000, one. Total 10900000. */
    eq('the proposal', (function (p) { return [p.ok, p.date, p.total]; })(E.salaryBill('2026-02')), [true, '2026-02-28', 10900000]);
    sal = ok('salary bill', post('accounts', 'EXP', { kind: 'salary', monthKey: '2026-02' })).doc;
    eq('salary bill', [sal.id, sal.date, sal.status, sal.payeeType, sal.payeeId, sal.categoryId, sal.lines, sal.total, sal.dueDate],
      ['EXP-U-0002', '2026-02-28', 'PENDING', 'vendor', 'v_staff', 'salaries', [{ unitId: 'factory', headcount: 3, amount: 9300000 }, { unitId: 'st_vvn', headcount: 1, amount: 1600000 }], 10900000, '2026-02-28']);
    /* 28. approved on 10 Mar, but its rows carry 28 Feb: the cost is February's */
    ok('approve the salary bill', act('owner', 'approve', { id: sal.id }));
    eq('salaries are a cost of February', [sal.approval.at, book.pnlMonth['2026-02'].expense, book.ap.balance['vendor:v_staff']], [T + 'T09:28', { 'salaries|factory': 9300000, 'salaries|st_vvn': 1600000 }, 10900000]);
    /* 29. paid from the bank: 28237500 - 10900000 = 17337500 */
    pay3 = ok('pay salaries', post('accounts', 'PAY', { date: T, payeeType: 'vendor', payeeId: 'v_staff', account: 'bank', allocations: [{ docId: sal.id, amount: 10900000 }] })).doc;
    eq('salaries paid', [pay3.id, sal.status, book.ap.balance['vendor:v_staff'], book.cash.balance.bank], ['PAY-U-0003', 'PAID', 0, 17337500]);

    /* 30, 31. DEP: 100000 of factory cash and 50000 of store cash go to the bank.
       factory cash 5046950 - 100000 = 4946950; store cash 270000 - 50000 = 220000; bank 17337500 + 150000 = 17487500 */
    dep1 = ok('DEP factory', post('accounts', 'DEP', { date: T, fromAccount: 'cash_factory', amount: 100000, slipRef: 'S-11' })).doc;
    dep2 = ok('DEP store', post('store_mgr', 'DEP', { date: T, fromAccount: 'cash_st_vvn', amount: 50000, slipRef: 'S-12' })).doc;
    eq('deposits', [dep1.id, dep2.id, book.cash.balance], ['DEP-U-0001', 'DEP-U-0002', { cash_factory: 4946950, cash_st_vvn: 220000, bank: 17487500 }]);
    eq('a deposit is neither income nor expense', [E.rowsOf(dep1.id).pnl.length, E.rowsOf(dep1.id).cash.map(function (c) { return [c.accountId, c.amount]; })], [0, [['cash_factory', -100000], ['bank', 100000]]]);

    /* 32, 33. EXP bill: electricity 1000000 + 18% GST: CGST = SGST = round(1000000 x 18 / 200) = 90000;
       total 1180000; due 10 Mar + 10 days = 20 Mar */
    ebill = ok('expense bill', post('accounts', 'EXP', { kind: 'bill', date: T, payeeId: 'v_power', categoryId: 'electricity', unitId: 'factory', amount: 1000000, gstRate: 18, billRef: 'MG/5521' })).doc;
    eq('expense bill', [ebill.id, ebill.status, ebill.cgst, ebill.sgst, ebill.gst, ebill.total, ebill.dueDate], ['EXP-U-0003', 'PENDING', 90000, 90000, 180000, 1180000, '2026-03-20']);
    ok('approve the expense bill', act('owner', 'approve', { id: ebill.id }));
    eq('expense bill owed', [ebill.status, book.ap.balance['vendor:v_power']], ['APPROVED', 1180000]);

    /* 34, 35. a receipt from the weekly outlet, then cancelled: the invoice reopens and the cash goes back out.
       open 119100 - 100000 = 19100, then 119100 again; factory cash 4946950 + 100000 - 100000 */
    rcpt2 = ok('RCPT to cancel', post('sales', 'RCPT', { date: T, customerId: 'c_week', account: 'cash_factory', amount: 100000, allocations: [{ docId: inv2.id, amount: 100000 }] })).doc;
    eq('part paid', [rcpt2.id, E.openAmount(inv2), book.ar.balance.c_week, book.cash.balance.cash_factory], ['RCPT-U-0002', 19100, 19100, 5046950]);
    r = ok('cancel it', act('accounts', 'cancel', { id: rcpt2.id, reason: 'entered against the wrong outlet' }));
    cxl = r.doc;
    eq('the cancellation is a document', [cxl.id, cxl.type, cxl.date, cxl.status, cxl.targetId, cxl.reason, cxl.createdBy, r.target.id], ['CXL-U-0001', 'CXL', T, 'POSTED', 'RCPT-U-0002', 'entered against the wrong outlet', 'u_accounts', 'RCPT-U-0002']);
    eq('the receipt keeps its rows and is marked', [rcpt2.status, rcpt2.cancelled, E.rowsOf(rcpt2.id).cash.length], ['CANCELLED', { by: 'u_accounts', at: T + 'T09:35', reason: 'entered against the wrong outlet', docId: 'CXL-U-0001' }, 1]);
    eq('equal and opposite rows under the id of the cancellation', (function (x) { return [x.cash.map(function (c) { return [c.docId, c.accountId, c.amount, c.kind, c.reversal]; }), x.ar.map(function (a) { return [a.docId, a.customerId, a.amount, a.kind, a.reversal]; })]; })(E.rowsOf(cxl.id)),
      [[['CXL-U-0001', 'cash_factory', -100000, 'receipt', true]], [['CXL-U-0001', 'c_week', 100000, 'receipt', true]]]);
    eq('the invoice is open again', [E.openAmount(inv2), book.ar.balance.c_week, book.cash.balance.cash_factory], [119100, 119100, 4946950]);
  });

  section('a.9 the books, to the paisa', function () {
    eq('35 operations in the log, numbered and timed', [E.log().length, E.log().map(function (e) { return e.n; }).join(' '), E.log()[0].at, lastOf(E.log()).at],
      [35, '1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35', T + 'T09:01', T + 'T09:35']);
    var count = {};
    book.docList.forEach(function (d) { count[d.type] = (count[d.type] || 0) + 1; });
    eq('documents by type', count, { OPENSTOCK: 1, OPENCASH: 1, INV: 5, VBILL: 2, PO: 1, GRN: 2, PAY: 3, PROD: 2, SO: 1, XFER: 1, DAYEND: 1, WO: 2, RCPT: 2, CN: 1, ADJ: 1, EXP: 3, DEP: 2, CXL: 1 });
    eq('nothing waits for approval', Object.keys(book.pending), []);

    /* --- stock, by location and by batch
       raw:      maida 200 + 300 + 200 - 30 - 4 - 2 = 664; shortening 50 + 20 - 1.5 - 2 = 66.5; bags 1000 - 117 - 100 + 2 = 785
       finished: bread, opening batch 60 - 60 = 0; batch of 9 Mar 117 - 20 - 30 - 15 - 20 - 5 = 27
                 puff, batch of 9 Mar 100 - 10 - 20 - 50 = 20
       store:    bread 20 - 12 = 8; puff 50 - 40 - 10 = 0;  nothing in transit */
    eq('stock', book.stock, { fac_rm: { maida: 664, fat: 66.5, bag: 785 }, fac_fg: { bread: 27, puff: 20 }, st_vvn: { bread: 8, puff: 0 }, transit_st_vvn: { bread: 0, puff: 0 } });
    eq('stock by batch', [lots('fac_fg', 'bread'), lots('fac_fg', 'puff'), lots('st_vvn', 'bread'), lots('st_vvn', 'puff'), lots('transit_st_vvn', 'bread')],
      [[['B-260309-BRD', 27, 0]], [['B-260309-PUF', 20, 0]], [['B-260309-BRD', 8, 0]], [], []]);
    eq('the batches ever made', Object.keys(book.batches).map(function (id) { var b = book.batches[id]; return [b.id, b.itemId, b.mfgDate, b.bestBefore, b.qty]; }),
      [['B-251231-BRD', 'bread', '2025-12-31', '2026-01-04', 60], ['B-260309-BRD', 'bread', Y1, '2026-03-13', 117], ['B-260309-PUF', 'puff', Y1, T, 100]]);
    eq('nothing is reserved', [book.reserved.fac_fg.bread, book.reserved.st_vvn.puff], [0, 0]);
    var moved = {};
    book.moves.forEach(function (m) { var k = m.locId + '|' + m.itemId; moved[k] = HB.q3((moved[k] || 0) + m.qty); });
    eq('the movement ledger adds up to the stock', moved, { 'fac_rm|maida': 664, 'fac_rm|fat': 66.5, 'fac_rm|bag': 785, 'fac_fg|bread': 27, 'fac_fg|puff': 20, 'transit_st_vvn|bread': 0, 'transit_st_vvn|puff': 0, 'st_vvn|bread': 8, 'st_vvn|puff': 0 });

    /* --- unit costs and the value of stock at today's cost
       maida 664 x 3800 = 2523200; shortening 66.5 x 12500 = 831250; bags 785 x 80 = 62800
       bread 27 x 1186.25 = 32028.75 -> 32029; puff 20 x 482 = 9640; store bread 8 x 1186.25 = 9490 */
    eq('latest prices and unit costs', [E.price('maida'), E.price('fat'), E.price('bag'), E.unitCost('bread'), E.unitCost('puff')], [3800, 12500, 80, 1186.25, 482]);
    eq('price history of maida', book.prices.maida.history.map(function (h) { return [h.docId, h.rate, h.cancelled]; }), [['OPENSTOCK-260101-001', 3600, false], ['GRN-U-0001', 3800, false], ['GRN-U-0002', 3800, false]]);
    eq('stock value', [['fac_rm', 'maida'], ['fac_rm', 'fat'], ['fac_rm', 'bag'], ['fac_fg', 'bread'], ['fac_fg', 'puff'], ['st_vvn', 'bread']].map(function (x) { return HB.money.amount(book.stock[x[0]][x[1]], E.unitCost(x[1])); }),
      [2523200, 831250, 62800, 32029, 9640, 9490]);
    eq('the cost sheet of bread', (function (s) { return [s.mixCost, s.materialPerUnit, s.packingPerUnit, s.unitCost]; })(E.costSheet('bread')), [44250, 1106.25, 80, 1186.25]);

    /* --- GST
       input:  Nil 1900000 (maida); 5% 260000 with 6500 + 6500 (shortening); 18% 1000000 with 90000 + 90000 (electricity)
       output: Nil 64000 + 96000 + 45000 + 48000 + 16000 - 9600 (the return) = 259400
               5%  11000 + 22000 + 57142 = 90142; CGST = SGST = 275 + 550 + 1429 = 2254 */
    eq('GST by direction and rate', gstTotals(), {
      'input 0': { taxable: 1900000, cgst: 0, sgst: 0 }, 'input 5': { taxable: 260000, cgst: 6500, sgst: 6500 }, 'input 18': { taxable: 1000000, cgst: 90000, sgst: 90000 },
      'output 0': { taxable: 259400, cgst: 0, sgst: 0 }, 'output 5': { taxable: 90142, cgst: 2254, sgst: 2254 }
    });

    /* --- customers
       cash outlet:   75550 - 75550 - 9600 + 16000 - 6400 = 0; its credit used up
       weekly outlet: 119100 - 100000 + 100000 = 119100, all on INV-U-0002
       hostel mess:   1000000 + 45000 - 1200000 = -155000: nothing open, 155000 on account */
    eq('customer balances', [book.ar.balance, book.ar.total], [{ c_corp: -155000, c_cash: 0, c_week: 119100 }, -35900]);
    eq('unapplied credit', ['c_cash', 'c_week', 'c_corp'].map(function (c) { return book.ar.credit[c] || 0; }), [0, 0, 155000]);
    eq('open invoices', ['c_cash', 'c_week', 'c_corp'].map(function (c) { return (book.ar.open[c] || []).map(function (d) { return [d.id, E.openAmount(d)]; }); }), [[], [['INV-U-0002', 119100]], []]);
    eq('receivable entries add up to the balances', book.ar.entries.reduce(function (s, x) { return s + x.amount; }, 0), -35900);

    /* --- vendors and other payees
       flour vendor: 2000000 + 2173000 - 3000000 = 1173000, all on VBILL-U-0001
       power: 1180000; staff salaries: 10900000 - 10900000 = 0; the store manager's claim: 35000 - 35000 = 0 */
    eq('payee balances', [book.ap.balance, book.ap.total], [{ 'vendor:v_stock': 1173000, 'employee:E004': 0, 'vendor:v_staff': 0, 'vendor:v_power': 1180000 }, 2353000]);
    eq('open bills', ['vendor:v_stock', 'vendor:v_power', 'vendor:v_staff', 'employee:E004'].map(function (k) { return (book.ap.open[k] || []).map(function (d) { return [d.id, d.total - d.paid]; }); }),
      [[['VBILL-U-0001', 1173000]], [['EXP-U-0003', 1180000]], [], []]);
    eq('payable entries add up to the balances', book.ap.entries.reduce(function (s, x) { return s + x.amount; }, 0), 2353000);

    /* --- cash and bank
       factory cash: 5000000 + 75550 + 6400 - 35000 - 100000 + 100000 - 100000 = 4946950
       store cash:   200000 + 70000 - 50000 = 220000
       bank:         30000000 - 3000000 + 37500 + 1200000 - 10900000 + 100000 + 50000 = 17487500 */
    eq('cash and bank', book.cash.balance, { cash_factory: 4946950, cash_st_vvn: 220000, bank: 17487500 });
    eq('each cash book adds up to its balance', ['cash_factory', 'cash_st_vvn', 'bank'].map(function (a) { return book.cash.byAccount[a].reduce(function (s, x) { return s + x.amount; }, 0); }), [4946950, 220000, 17487500]);
    eq('the factory cash book, row by row', book.cash.byAccount.cash_factory.map(function (x) { return [x.docId, x.amount]; }),
      [['OPENCASH-260101-001', 5000000], ['INV-U-0001', 75550], ['INV-U-0004', 6400], ['PAY-U-0002', -35000], ['DEP-U-0001', -100000], ['RCPT-U-0002', 100000], ['CXL-U-0001', -100000]]);

    /* --- P&L, March
       sales:   retail 75000 + 118000 + 16000 = 209000; corporate 45000; store 105142
       returns: retail -9600
       cost of goods sold: retail 28545 + 45228 + 5931 = 79704; corporate 17794; store 14235 + 19280 = 33515
       production loss 3559; write-offs 4820 + 71175 = 75995; count differences 7600 - 160 = 7440
       expenses: store cash short 500; travel 35000 (store); electricity 1000000 (factory)
       February: salaries 9300000 (factory) + 1600000 (store) */
    eq('P&L of March', book.pnlMonth['2026-03'], {
      sales: { retail: 209000, corporate: 45000, store: 105142 },
      returns: { retail: -9600 },
      cogs: { retail: 79704, corporate: 17794, store: 33515 },
      prodLoss: { all: 3559 },
      writeoff: { all: 75995 },
      countDiff: { all: 7440 },
      expense: { 'cash_short|st_vvn': 500, 'travel|st_vvn': 35000, 'electricity|factory': 1000000 }
    });
    eq('P&L of February', book.pnlMonth['2026-02'], { sales: {}, returns: {}, cogs: {}, prodLoss: {}, writeoff: {}, countDiff: {}, expense: { 'salaries|factory': 9300000, 'salaries|st_vvn': 1600000 } });
    eq('no other month has a P&L', Object.keys(book.pnlMonth).sort(), ['2026-02', '2026-03']);
    /* net sales 209000 + 45000 + 105142 - 9600 = 349542
       material cost 131013 + 3559 + 75995 + 7440 = 218007; gross margin 349542 - 218007 = 131535
       expenses 1035500; operating result 131535 - 1035500 = -903965 */
    var line = {};
    book.pnl.forEach(function (x) { if (x.date.slice(0, 7) === '2026-03') line[x.line] = (line[x.line] || 0) + x.amount; });
    eq('the P&L rows of March, line by line', line, { sales: 359142, returns: -9600, cogs: 131013, prodLoss: 3559, writeoff: 75995, countDiff: 7440, expense: 1035500 });
    eq('operating result of March', line.sales + line.returns - line.cogs - line.prodLoss - line.writeoff - line.countDiff - line.expense, -903965);
    /* sales by item, from the figures kept per day: 10 Mar, factory, retail: bread 20 + 30 + 5 sold, 3 returned */
    eq('item figures of 10 Mar', book.days[T].items, {
      factory: {
        retail: { bread: { qty: 55, sales: 176000, cogs: 65244, returnQty: 3, returns: -9600 }, puff: { qty: 30, sales: 33000, cogs: 14460, returnQty: 0, returns: 0 } },
        corporate: { bread: { qty: 15, sales: 45000, cogs: 17794, returnQty: 0, returns: 0 } }
      },
      st_vvn: { store: { bread: { qty: 12, sales: 48000, cogs: 14235, returnQty: 0, returns: 0 }, puff: { qty: 40, sales: 57142, cogs: 19280, returnQty: 0, returns: 0 } } }
    });

    /* --- the audit trail: every operation, who, in which role, when */
    eq('every log entry left an audit entry with its user, role and time', E.log().filter(function (e) {
      return !book.audit.some(function (a) { return a.at === e.at && a.userId === e.userId && a.role === e.role; });
    }).map(function (e) { return e.n; }), []);
    eq('every row of every ledger has its own posting sequence', (function (rows) {
      var seen = {};
      rows.forEach(function (x) { seen[x.seq] = 1; });
      return rows.length - Object.keys(seen).length;
    })(book.moves.concat(book.cash.entries, book.ar.entries, book.ap.entries, book.pnl, book.gst)), 0);
  });

  section('a.10 every refusal, once', function () {
    var poLines = [{ itemId: 'bag', qty: 100, rate: 80 }];
    /* role */
    refusal('role: sales raises a purchase order', 'sales', 'post', { type: 'PO', payload: { date: T, vendorId: 'v_stock', lines: poLines } }, 'role');
    refusal('role: the store manager deposits factory cash', 'store_mgr', 'post', { type: 'DEP', payload: { date: T, fromAccount: 'cash_factory', amount: 100 } }, 'role');
    refusal('role: stores counts a store', 'stores', 'post', { type: 'ADJ', payload: { date: T, locId: 'st_vvn', reason: 'count', lines: [{ itemId: 'bread', batchId: 'B-260309-BRD', countedQty: 8 }] } }, 'role');
    refusal('role: stores cancels a receipt of money', 'stores', 'cancel', { id: 'RCPT-U-0001', reason: 'test' }, 'role', { docId: 'RCPT-U-0001' });
    refusal('role: production confirms a transfer', 'production', 'receiveTransfer', { id: 'XFER-U-0001' }, 'role');
    refusal('role: sales changes a master', 'sales', 'master', { entity: 'items', record: { id: 'bread', price: { retail: 1 } } }, 'role');
    /* the scope is read from the field the document is posted for, and that input is the one a form marks;
       a payload that also names the persona's own store under other keys is refused all the same */
    refusal('role: the store manager enters the day-end of another store', 'store_mgr', 'post', { type: 'DAYEND', payload: { date: T, storeId: 'st_other', lines: [], cash: 0, upi: 0 } }, 'role', { field: 'storeId' });
    refusal('role: and cannot pass by naming its own store in another field', 'store_mgr', 'post', { type: 'DAYEND', payload: { date: T, storeId: 'st_other', unitId: 'st_vvn', toStoreId: 'st_vvn', lines: [], cash: 0, upi: 0 } }, 'role', { field: 'storeId' });
    refusal('role: a deposit marks the account', 'store_mgr', 'post', { type: 'DEP', payload: { date: T, fromAccount: 'cash_factory', accountId: 'cash_st_vvn', amount: 100 } }, 'role', { field: 'fromAccount' });
    refusal('role: a count marks the location', 'stores', 'post', { type: 'ADJ', payload: { date: T, locId: 'st_vvn', unitId: 'factory', reason: 'count', lines: [{ itemId: 'bread', batchId: 'B-260309-BRD', countedQty: 8 }] } }, 'role', { field: 'locId' });
    /* own approval, tested before the role */
    var own = ok('a count raised by stores', post('stores', 'ADJ', { date: T, locId: 'fac_rm', reason: 'recount', lines: [{ itemId: 'fat', countedQty: 66 }] })).doc;
    eq('it waits', [own.id, own.status], ['ADJ-U-0002', 'PENDING']);
    refusal('own_approval: whoever raised it cannot approve it', 'stores', 'approve', { id: own.id }, 'own_approval', { docId: own.id });
    refusal('own_approval: nor reject it', 'stores', 'reject', { id: own.id, reason: 'test' }, 'own_approval');
    refusal('role: accounts sees approvals but cannot give them', 'accounts', 'approve', { id: own.id }, 'role');
    refusal('invalid_input: a rejection needs a reason', 'owner', 'reject', { id: own.id, reason: '  ' }, 'invalid_input', { field: 'reason' });
    ok('the Owner rejects it', act('owner', 'reject', { id: own.id, reason: 'counted before the delivery' }));
    eq('rejected, with the reason', [own.status, own.approval.state, own.approval.reason, book.stock.fac_rm.fat], ['REJECTED', 'rejected', 'counted before the delivery', 66.5]);
    refusal('wrong_state: a rejected document cannot be cancelled', 'stores', 'cancel', { id: own.id, reason: 'test' }, 'wrong_state');

    /* dates */
    refusal('future_date', 'stores', 'post', { type: 'PO', payload: { date: '2026-03-11', vendorId: 'v_stock', lines: poLines } }, 'future_date', { field: 'date' });
    refusal('future_date: even for the Owner', 'owner', 'post', { type: 'DEP', payload: { date: '2026-03-11', fromAccount: 'cash_factory', amount: 100 } }, 'future_date', { field: 'date' });
    refusal('backdate_limit: an operator four days back', 'stores', 'post', { type: 'PO', payload: { date: '2026-03-06', vendorId: 'v_stock', lines: poLines } }, 'backdate_limit', { field: 'date' });
    refusal('backdate_limit: a dispatch sheet too', 'sales', 'postDispatch', { routeId: 'r1', date: '2026-03-06', outlets: [{ customerId: 'c_cash', lines: [{ itemId: 'bread', qty: 1 }] }] }, 'backdate_limit', { field: 'date' });
    as('stores');
    eq('three days back is within the limit', E.preview('PO', { date: '2026-03-07', vendorId: 'v_stock', lines: poLines }).ok, true);
    as('accounts');
    eq('accounts may go back to the first day of last month', [E.preview('DEP', { date: '2026-02-01', fromAccount: 'cash_factory', amount: 100 }).ok, E.preview('DEP', { date: '2026-03-06', fromAccount: 'cash_factory', amount: 100 }).ok], [true, true]);
    refusal('locked_month: accounts, the day before that', 'accounts', 'post', { type: 'DEP', payload: { date: '2026-01-31', fromAccount: 'cash_factory', amount: 100 } }, 'locked_month', { field: 'date' });
    refusal('locked_month: the Owner too', 'owner', 'post', { type: 'DEP', payload: { date: '2026-01-31', fromAccount: 'cash_factory', amount: 100 } }, 'locked_month', { field: 'date' });
    refusal('locked_month: the salary bill of January', 'accounts', 'post', { type: 'EXP', payload: { kind: 'salary', monthKey: '2026-01' } }, 'locked_month', { field: 'monthKey' });
    refusal('future_date: the salary bill of a month that is not over', 'accounts', 'post', { type: 'EXP', payload: { kind: 'salary', monthKey: '2026-03' } }, 'future_date', { field: 'monthKey' });

    /* stock */
    refusal('stock_short: an invoice above the unexpired stock', 'sales', 'post', { type: 'INV', payload: { date: T, customerId: 'c_corp', lines: [{ itemId: 'bread', qty: 28 }] } }, 'stock_short', { field: 'lines[0].qty' });
    refusal('stock_short: production without the material', 'production', 'post', { type: 'PROD', payload: { date: T, itemId: 'bread', mixes: 100, goodUnits: 4000 } }, 'stock_short', { field: 'mixes' });
    refusal('stock_short: more expired than is past its date', 'store_mgr', 'post', { type: 'DAYEND', payload: { date: Y1, storeId: 'st_vvn', lines: [{ itemId: 'bread', sold: 0, expired: 1 }], cash: 0, upi: 0 } }, 'stock_short', { field: 'lines[0].expired' });
    refusal('stock_short: a transfer above the stock', 'stores', 'post', { type: 'XFER', payload: { date: T, toStoreId: 'st_vvn', lines: [{ itemId: 'puff', qty: 21 }] } }, 'stock_short', { field: 'lines[0].qty' });
    r = refusal('stock_short: a sheet posts nothing and lists what is short', 'sales', 'postDispatch', { routeId: 'r1', date: Y1, outlets: [{ customerId: 'c_cash', lines: [{ itemId: 'bread', qty: 20 }] }, { customerId: 'c_week', lines: [{ itemId: 'bread', qty: 8 }] }] }, 'stock_short', { field: 'outlets' });
    eq('the list', r.error && r.error.short, [{ itemId: 'bread', wanted: 28, available: 27 }]);
    /* (a cancellation that would take stock below zero is stock_short as well: a.15, a receipt whose goods were used) */

    /* cash */
    refusal('cash_short: a deposit above the cash in hand', 'store_mgr', 'post', { type: 'DEP', payload: { date: T, fromAccount: 'cash_st_vvn', amount: 220001 } }, 'cash_short', { field: 'amount' });

    /* dependants: each names what must be cancelled first */
    refusal('has_dependants: a billed receipt', 'stores', 'cancel', { id: 'GRN-U-0001', reason: 'test' }, 'has_dependants', { docId: 'VBILL-U-0001' });
    refusal('has_dependants: an order with receipts', 'stores', 'cancel', { id: 'PO-U-0001', reason: 'test' }, 'has_dependants', { docId: 'GRN-U-0002' });
    refusal('has_dependants: a bill with a payment', 'accounts', 'cancel', { id: 'VBILL-U-0001', reason: 'test' }, 'has_dependants', { docId: 'PAY-U-0001' });
    refusal('has_dependants: an invoiced order', 'sales', 'cancel', { id: 'SO-U-0001', reason: 'test' }, 'has_dependants', { docId: 'INV-U-0003' });
    refusal('has_dependants: an invoice with a receipt', 'sales', 'cancel', { id: 'INV-U-0003', reason: 'test' }, 'has_dependants', { docId: 'RCPT-U-0001' });
    refusal('has_dependants: a paid claim', 'store_mgr', 'cancel', { id: 'EXP-U-0001', reason: 'test' }, 'has_dependants', { docId: 'PAY-U-0002' });
    refusal('has_dependants: a day-end whose write-off is approved', 'store_mgr', 'cancel', { id: 'DAYEND-U-0001', reason: 'test' }, 'has_dependants', { docId: 'WO-U-0001' });
    /* the batch of 9 Mar went out on INV-U-0001, -0002 and -0003, XFER-U-0001 and, last of all, INV-U-0004 */
    refusal('has_dependants: a production entry whose batch was dispatched names what took it last', 'production', 'cancel', { id: 'PROD-U-0001', reason: 'test' }, 'has_dependants', { docId: 'INV-U-0004' });
    refusal('has_dependants: a store that holds stock', 'accounts', 'setActive', { entity: 'locations', id: 'st_vvn', active: false }, 'has_dependants');

    /* duplicates */
    refusal('duplicate: the bill number again', 'accounts', 'post', { type: 'VBILL', payload: { date: T, vendorId: 'v_stock', billNo: 'cf/501', grnIds: ['GRN-U-0001'], lines: [{ itemId: 'maida', qty: 1, rate: 1 }] } }, 'duplicate', { field: 'billNo', docId: 'VBILL-U-0001' });
    refusal('duplicate: the sheet again', 'sales', 'postDispatch', { routeId: 'r1', date: T, outlets: [{ customerId: 'c_cash', lines: [{ itemId: 'bread', qty: 1 }] }] }, 'duplicate', { docId: 'INV-U-0001' });
    refusal('duplicate: a second day-end', 'store_mgr', 'post', { type: 'DAYEND', payload: { date: T, storeId: 'st_vvn', lines: [], cash: 0, upi: 0 } }, 'duplicate', { docId: 'DAYEND-U-0001' });
    refusal('duplicate: a second salary bill for the month', 'accounts', 'post', { type: 'EXP', payload: { kind: 'salary', monthKey: '2026-02' } }, 'duplicate', { field: 'monthKey', docId: 'EXP-U-0002' });

    /* input and state */
    refusal('invalid_input: an order with no lines', 'stores', 'post', { type: 'PO', payload: { date: T, vendorId: 'v_stock', lines: [] } }, 'invalid_input', { field: 'lines' });
    refusal('invalid_input: a day-end with nothing sold, nothing expired and no money', 'store_mgr', 'post', { type: 'DAYEND', payload: { date: Y1, storeId: 'st_vvn', lines: [{ itemId: 'bread', sold: 0, expired: 0 }], cash: 0, upi: 0 } }, 'invalid_input', { field: 'lines' });
    eq('a day-end with money and no units still posts (dry run)', E.preview('DAYEND', { date: Y1, storeId: 'st_vvn', lines: [], cash: 500, upi: 0 }).ok, true);
    refusal('invalid_input: on a sheet, the outlet and the line are named', 'sales', 'postDispatch', { routeId: 'r1', date: Y1, outlets: [{ customerId: 'c_cash', lines: [{ itemId: 'bread', qty: 1 }] }, { customerId: 'c_week', lines: [{ itemId: 'bread', qty: 1 }, { itemId: 'puff', qty: 1.5 }] }] }, 'invalid_input', { field: 'outlets[1].lines[1].qty' });
    refusal('invalid_input: a payment that is not the sum of its bills', 'accounts', 'post', { type: 'PAY', payload: { date: T, payeeType: 'vendor', payeeId: 'v_stock', account: 'bank', amount: 5, allocations: [{ docId: 'VBILL-U-0001', amount: 1000 }] } }, 'invalid_input', { field: 'amount' });
    refusal('invalid_input: a cancellation needs a reason', 'accounts', 'cancel', { id: 'DEP-U-0001', reason: '' }, 'invalid_input', { field: 'reason' });
    refusal('invalid_input: opening entries have no form', 'accounts', 'post', { type: 'OPENCASH', payload: { date: T, lines: [{ accountId: 'bank', amount: 1 }] } }, 'invalid_input');
    refusal('invalid_input: an opening invoice cannot be typed in', 'sales', 'post', { type: 'INV', payload: { date: T, customerId: 'c_corp', total: 5, opening: true } }, 'invalid_input');
    refusal('invalid_input: an unknown operation', 'owner', 'erase', { id: 'DEP-U-0001' }, 'invalid_input', { field: 'op' });
    refusal('not_found: no such document', 'owner', 'approve', { id: 'PO-U-9999' }, 'not_found');
    refusal('wrong_state: nothing to approve', 'owner', 'approve', { id: 'VBILL-U-0001' }, 'wrong_state', { docId: 'VBILL-U-0001' });
    refusal('wrong_state: a cancellation cannot be cancelled', 'owner', 'cancel', { id: 'CXL-U-0001', reason: 'test' }, 'wrong_state');
    refusal('wrong_state: opening entries are never cancelled', 'owner', 'cancel', { id: 'INV-260101-001', reason: 'test' }, 'wrong_state');
    refusal('wrong_state: cancelled twice', 'accounts', 'cancel', { id: 'RCPT-U-0002', reason: 'test' }, 'wrong_state', { docId: 'CXL-U-0001' });
    refusal('wrong_state: a confirmed transfer', 'stores', 'cancel', { id: 'XFER-U-0001', reason: 'test' }, 'wrong_state');
    eq('the log grew only by the count and its rejection', [E.log().length, lastOf(E.log()).n], [37, 37]);
  });

  section('a.11 preview and check: everything a form needs, nothing posted', function () {
    var before = mark(), pv;
    as('sales');
    /* the mess has 155000 on account. bread 10 x 3000 = 30000 (Nil); puff 10 x 1050 = 10500, CGST = SGST =
       round(10500 x 5 / 200) = round(262.5) = 263; total 30000 + 10500 + 526 = 41026, all of it covered by the credit */
    pv = E.preview('INV', { date: T, customerId: 'c_corp', lines: [{ itemId: 'bread', qty: 10 }, { itemId: 'puff', qty: 10 }] });
    eq('an invoice: lines, GST, totals, credit, stock', [pv.ok, pv.preview, pv.doc.id, pv.doc.lines.map(function (l) { return [l.taxable, l.cgst, l.sgst, l.cost]; }), pv.doc.taxable, pv.doc.gst, pv.doc.total, pv.doc.creditApplied, pv.doc.paidNow, pv.warnings, pv.credit, pv.stock],
      [true, true, '', [[30000, 0, 0, 11863], [10500, 263, 263, 4820]], 40500, 526, 41026, 41026, 0, [], { limit: 1000000, owes: -155000, after: -113974, over: false },
        [{ index: 0, itemId: 'bread', batchId: null, locId: 'fac_fg', wanted: 10, available: 27, short: false }, { index: 1, itemId: 'puff', batchId: null, locId: 'fac_fg', wanted: 10, available: 20, short: false }]]);
    pv = E.preview('INV', { date: T, customerId: 'c_corp', lines: [{ itemId: 'bread', qty: 10 }, { itemId: 'puff', qty: 30 }, { itemId: '', qty: 1 }] });
    eq('the refusal it would get, with the stock all the same', [pv.ok, pv.preview, pv.error.code, pv.error.field, pv.stock],
      [false, true, 'stock_short', 'lines[1].qty', [{ index: 0, itemId: 'bread', batchId: null, locId: 'fac_fg', wanted: 10, available: 27, short: false }, { index: 1, itemId: 'puff', batchId: null, locId: 'fac_fg', wanted: 30, available: 20, short: true }, null]]);
    pv = E.preview('PO', { date: T, vendorId: 'v_stock', lines: [{ itemId: 'bag', qty: 100, rate: 80 }] });
    eq('a preview is refused like the real thing', [pv.ok, pv.error.code], [false, 'role']);
    as('production');
    /* one mix of bread, 40 good: maida 10 of 664, shortening 0.5 of 66.5, bags 40 of 785 */
    pv = E.preview('PROD', { date: T, itemId: 'bread', mixes: 1, goodUnits: 40 });
    eq('production: what the recipe draws and what there is', [pv.ok, pv.doc.batchId, pv.doc.unitCost, pv.doc.lossValue, pv.stock],
      [true, 'B-260310-BRD', 1186.25, 0, [
        { index: null, itemId: 'maida', batchId: null, locId: 'fac_rm', wanted: 10, available: 664, short: false },
        { index: null, itemId: 'fat', batchId: null, locId: 'fac_rm', wanted: 0.5, available: 66.5, short: false },
        { index: null, itemId: 'bag', batchId: null, locId: 'fac_rm', wanted: 40, available: 785, short: false }]]);
    as('stores');
    /* 1500 x 3800 = 5700000, above the limit of 5000000 */
    pv = E.preview('PO', { date: T, vendorId: 'v_stock', lines: [{ itemId: 'maida', qty: 1500, rate: 3800 }] });
    eq('an order above the limit will wait', [pv.doc.total, pv.outcome], [5700000, { status: 'PENDING', waits: true, self: false }]);
    pv = E.preview('WO', { date: T, locId: 'fac_fg', reason: 'damaged', lines: [{ itemId: 'bread', batchId: 'B-260309-BRD', qty: 30 }] });
    eq('a write-off above the batch', [pv.ok, pv.error.code, pv.stock], [false, 'stock_short', [{ index: 0, itemId: 'bread', batchId: 'B-260309-BRD', locId: 'fac_fg', wanted: 30, available: 27, short: true }]]);
    pv = E.preview('ADJ', { date: T, locId: 'fac_rm', reason: 'count', lines: [{ itemId: 'fat', countedQty: 66 }] });
    eq('a count: the quantity in the books', [pv.ok, pv.doc.lines[0].diff, pv.stock[0].available], [true, -0.5, 66.5]);
    as('owner');
    pv = E.preview('PO', { date: T, vendorId: 'v_stock', lines: [{ itemId: 'maida', qty: 1500, rate: 3800 }] });
    eq('the same order raised by the Owner is approved in the same operation', pv.outcome, { status: 'APPROVED', waits: false, self: true });
    pv = E.preview('EXP', { kind: 'claim', date: T, categoryId: 'travel', unitId: 'factory', amount: 100 });
    eq('and so is the Owner\'s own claim', [pv.doc.payeeId, pv.outcome], ['E001', { status: 'APPROVED', waits: false, self: true }]);

    /* check: would an action go through? */
    as('stores');
    eq('check: a billed receipt cannot be cancelled, and why', (function (c) { return [c.ok, c.error.code, c.error.docId]; })(E.check('cancel', { id: 'GRN-U-0001' })), [false, 'has_dependants', 'VBILL-U-0001']);
    eq('check: rights are part of it', E.check('cancel', { id: 'DEP-U-0001' }).error.code, 'role');
    as('accounts');
    eq('check: a deposit can be cancelled at any time', E.check('cancel', { id: 'DEP-U-0001' }).ok, true);
    eq('nothing was posted by any of this', mark(), before);
  });

  section('a.12 post, then cancel: every balance returns, for each type that can be cancelled', function () {
    var before, d, res;

    /* PO: approved as submitted, and one that waits */
    before = snapshot();
    d = ok('PO', post('stores', 'PO', { date: T, vendorId: 'v_stock', lines: [{ itemId: 'bag', qty: 100, rate: 90 }] })).doc;
    res = cancelBack('PO approved', before, d.id, 'stores');
    eq('a document that wrote no rows still gets its cancellation, with none', (function (x) { return x.moves.length + x.ar.length + x.ap.length + x.cash.length + x.pnl.length + x.gst.length; })(E.rowsOf(res.doc.id)), 0);
    d = ok('PO above the limit', post('stores', 'PO', { date: T, vendorId: 'v_stock', lines: [{ itemId: 'maida', qty: 1500, rate: 3800 }] })).doc;
    eq('it waits', [d.status, !!book.pending[d.id]], ['PENDING', true]);
    cancelBack('PO pending', before, d.id, 'stores');
    eq('and no longer waits', !!book.pending[d.id], false);

    /* GRN: the order reopens and the price goes back. bags at 90: bread 1106.25 + 90 = 1196.25; puff 402 + 90 = 492 */
    var poBag = ok('PO for the receipts', post('stores', 'PO', { date: T, vendorId: 'v_stock', lines: [{ itemId: 'bag', qty: 100, rate: 90 }] })).doc;
    before = snapshot();
    d = ok('GRN', post('stores', 'GRN', { date: T, poId: poBag.id, lines: [{ itemId: 'bag', qty: 100 }] })).doc;
    eq('receipt in', [poBag.status, book.stock.fac_rm.bag, E.price('bag'), E.unitCost('bread'), E.unitCost('puff')], ['RECEIVED', 885, 90, 1196.25, 492]);
    cancelBack('GRN', before, d.id, 'stores');
    eq('order open again, price back', [poBag.status, poBag.lines[0].received, E.price('bag'), E.unitCost('bread'), book.prices.bag.history.map(function (h) { return [h.rate, h.cancelled]; })], ['APPROVED', 0, 80, 1186.25, [[80, false], [90, true]]]);

    /* VBILL: posted and unpaid, then held. 100 x 90 = 9000 + 18%: 810 + 810 = 10620. At Rs 1.00: 10000 against 9000 expected - held */
    var grnBag = ok('GRN to bill', post('stores', 'GRN', { date: T, poId: poBag.id, lines: [{ itemId: 'bag', qty: 100 }] })).doc;
    before = snapshot();
    d = ok('VBILL', post('accounts', 'VBILL', { date: T, vendorId: 'v_stock', billNo: 'CF/601', grnIds: [grnBag.id], lines: [{ itemId: 'bag', qty: 100, rate: 90 }] })).doc;
    eq('bill posted', [d.status, d.total, d.lines[0].cgst, grnBag.billId, book.ap.balance['vendor:v_stock']], ['POSTED', 10620, 810, d.id, 1183620]);
    cancelBack('VBILL posted', before, d.id, 'accounts');
    eq('the receipt is free again', [grnBag.billId, book.unbilled.v_stock.map(function (g) { return g.id; })], [null, [grnBag.id]]);
    d = ok('VBILL held, the same number again', post('accounts', 'VBILL', { date: T, vendorId: 'v_stock', billNo: 'CF/601', grnIds: [grnBag.id], lines: [{ itemId: 'bag', qty: 100, rate: 100 }] })).doc;
    eq('bill held', [d.status, d.match.diffs[0].diff, grnBag.billId], ['HELD', 1000, d.id]);
    cancelBack('VBILL held', before, d.id, 'accounts');

    /* EXP: a claim that waits, the Owner's own claim (approved in the same operation), an approved bill */
    before = snapshot();
    d = ok('claim', post('stores', 'EXP', { kind: 'claim', date: T, categoryId: 'repairs', unitId: 'factory', amount: 5000 })).doc;
    cancelBack('EXP pending', before, d.id, 'stores');
    d = ok('claim by the Owner', post('owner', 'EXP', { kind: 'claim', date: T, categoryId: 'repairs', unitId: 'factory', amount: 5000 })).doc;
    eq('approved in the same operation, and logged as the Owner\'s own', [d.status, d.approval.self, d.approval.by, book.ap.balance['employee:E001'], lastOf(book.audit).note, lastOf(E.log()).op, lastOf(E.log()).role], ['APPROVED', true, 'u_owner', 5000, 'own document', 'post', 'owner']);
    cancelBack('EXP approved', before, d.id, 'owner');
    d = ok('expense bill', post('accounts', 'EXP', { kind: 'bill', date: T, payeeId: 'v_power', categoryId: 'repairs', unitId: 'factory', amount: 20000, gstRate: 18 })).doc;
    ok('approve it', act('owner', 'approve', { id: d.id }));
    cancelBack('EXP bill approved', before, d.id, 'accounts');

    /* PAY: in part, and in full (the expense goes to PAID and back) */
    before = snapshot();
    d = ok('PAY in part', post('accounts', 'PAY', { date: T, payeeType: 'vendor', payeeId: 'v_power', account: 'bank', allocations: [{ docId: 'EXP-U-0003', amount: 500000 }] })).doc;
    eq('part paid', [book.docs['EXP-U-0003'].status, book.docs['EXP-U-0003'].paid, book.ap.balance['vendor:v_power']], ['APPROVED', 500000, 680000]);
    cancelBack('PAY in part', before, d.id, 'accounts');
    d = ok('PAY in full', post('accounts', 'PAY', { date: T, payeeType: 'vendor', payeeId: 'v_power', account: 'bank', allocations: [{ docId: 'EXP-U-0003', amount: 1180000 }] })).doc;
    eq('paid', [book.docs['EXP-U-0003'].status, book.ap.balance['vendor:v_power']], ['PAID', 0]);
    cancelBack('PAY in full', before, d.id, 'accounts');
    eq('the expense is owed again', [book.docs['EXP-U-0003'].status, book.docs['EXP-U-0003'].paid], ['APPROVED', 0]);

    /* SO */
    before = snapshot();
    d = ok('SO', post('sales', 'SO', { date: T, customerId: 'c_corp', lines: [{ itemId: 'bread', qty: 2 }] })).doc;
    cancelBack('SO', before, d.id, 'sales');

    /* INV: on credit, and cash on delivery with credit applied (10000 of credit, 16000 invoiced, 6000 collected) */
    before = snapshot();
    d = ok('INV', post('sales', 'INV', { date: T, customerId: 'c_week', lines: [{ itemId: 'bread', qty: 4 }, { itemId: 'puff', qty: 2 }] })).doc;
    cancelBack('INV on credit', before, d.id, 'sales');
    var adv = ok('RCPT on account', post('sales', 'RCPT', { date: T, customerId: 'c_cash', account: 'cash_factory', amount: 10000 })).doc;
    eq('all of it on account', [adv.onAccount, book.ar.credit.c_cash], [10000, 10000]);
    var mid = snapshot();
    d = ok('INV cash with credit', post('sales', 'INV', { date: T, customerId: 'c_cash', lines: [{ itemId: 'bread', qty: 5 }] })).doc;
    eq('credit first, then cash', [d.creditApplied, d.paidNow, book.ar.credit.c_cash], [10000, 6000, 0]);
    cancelBack('INV cash with credit', mid, d.id, 'sales');
    eq('the credit is the customer\'s again', book.ar.credit.c_cash, 10000);
    cancelBack('RCPT on account', before, adv.id, 'sales');

    /* RCPT: against an invoice, with a remainder on account */
    before = snapshot();
    d = ok('RCPT', post('accounts', 'RCPT', { date: T, customerId: 'c_week', account: 'bank', amount: 60000, allocations: [{ docId: 'INV-U-0002', amount: 50000 }] })).doc;
    eq('part on account', [d.onAccount, E.openAmount(book.docs['INV-U-0002']), book.ar.credit.c_week], [10000, 69100, 10000]);
    cancelBack('RCPT', before, d.id, 'accounts');

    /* CN: posted (2 x 3200 = 6400 of 118000 supplied = 5.42%) and held
       (the cash outlet: 9600 + 9600 returned of 75000 + 16000 supplied = 19200 / 91000 = 21.1%) */
    before = snapshot();
    d = ok('CN', post('sales', 'CN', { date: T, customerId: 'c_week', lines: [{ itemId: 'bread', qty: 2 }] })).doc;
    eq('posted against the open invoice', [d.status, d.sharePct, d.allocations, d.onAccount, book.ar.balance.c_week], ['POSTED', 5.42, [{ docId: 'INV-U-0002', amount: 6400 }], 0, 112700]);
    cancelBack('CN posted', before, d.id, 'sales');
    d = ok('CN held', post('sales', 'CN', { date: T, customerId: 'c_cash', lines: [{ itemId: 'bread', qty: 3 }] })).doc;
    eq('held', [d.status, d.sharePct], ['HELD', 21.1]);
    cancelBack('CN held', before, d.id, 'sales');
    as('sales');
    eq('a cancelled return no longer counts towards the share', E.preview('CN', { date: T, customerId: 'c_cash', lines: [{ itemId: 'bread', qty: 3 }] }).doc.sharePct, 21.1);

    /* PROD: materials return (bags now cost 90: puff 402 + 90 = 492; loss 5 x 492 = 2460) */
    before = snapshot();
    d = ok('PROD', post('production', 'PROD', { date: T, itemId: 'puff', mixes: 1, goodUnits: 95, rejectedUnits: 5 })).doc;
    eq('run', [d.batchId, d.unitCost, d.lossValue, book.stock.fac_rm.bag, book.stock.fac_fg.puff], ['B-260310-PUF', 492, 2460, 790, 115]);
    cancelBack('PROD', before, d.id, 'production');

    /* XFER, not yet confirmed */
    before = snapshot();
    d = ok('XFER', post('stores', 'XFER', { date: T, toStoreId: 'st_vvn', lines: [{ itemId: 'bread', qty: 5 }] })).doc;
    cancelBack('XFER', before, d.id, 'stores');

    /* DAYEND with a write-off that still waits: the same cancellation takes both.
       Stock for it: puffs made on 8 Mar (best before 9 Mar), 8 sent to the store dated 9 Mar and confirmed.
       Day-end of 9 Mar: bread 2 x 4000 = 8000; puff 3 x 1500 = 4500, CGST = SGST = round(4500 x 5 / 210) = 107,
       taxable 4286; gross 12500 = cash 12000 + UPI 500; 5 puffs expired x 492 = 2460 */
    ok('PROD two days back', post('production', 'PROD', { date: Y2, itemId: 'puff', mixes: 1, goodUnits: 100 }));
    d = ok('XFER dated yesterday', post('stores', 'XFER', { date: Y1, toStoreId: 'st_vvn', lines: [{ itemId: 'puff', qty: 8 }] })).doc;
    eq('oldest unexpired first, on the date of the document', d.lines[0].batches, [{ batchId: 'B-260308-PUF', qty: 8 }]);
    ok('confirm it', act('store_mgr', 'receiveTransfer', { id: d.id }));
    before = snapshot();
    res = ok('DAYEND', post('store_mgr', 'DAYEND', { date: Y1, storeId: 'st_vvn', lines: [{ itemId: 'bread', sold: 2 }, { itemId: 'puff', sold: 3, expired: 5 }], cash: 12000, upi: 500 }));
    eq('day-end and its write-off', [res.doc.gross, res.doc.taxable, res.doc.shortExcess, res.docs[1].status, res.docs[1].value, book.reserved.st_vvn.puff], [12500, 12286, 0, 'PENDING', 2460, 5]);
    var woId = res.docs[1].id;
    res = cancelBack('DAYEND', before, res.doc.id, 'store_mgr');
    eq('the waiting write-off went with it', [book.docs[woId].status, book.docs[woId].cancelled.docId, !!book.pending[woId], book.reserved.st_vvn.puff], ['CANCELLED', res.doc.id, false, 0]);
    as('store_mgr');
    eq('and the day can be entered again', E.preview('DAYEND', { date: Y1, storeId: 'st_vvn', lines: [{ itemId: 'bread', sold: 1 }], cash: 4000, upi: 0 }).ok, true);

    /* ADJ: waiting, and posted. The puffs made above for the day-end took 2 kg of shortening: 66.5 - 2 = 64.5 in
       the books. The Owner's own count finds 70: +5.5 x 12500 = 68750 */
    before = snapshot();
    d = ok('ADJ', post('stores', 'ADJ', { date: T, locId: 'fac_rm', reason: 'count', lines: [{ itemId: 'fat', countedQty: 60 }] })).doc;
    cancelBack('ADJ pending', before, d.id, 'stores');
    d = ok('ADJ by the Owner', post('owner', 'ADJ', { date: T, locId: 'fac_rm', reason: 'recount', lines: [{ itemId: 'fat', countedQty: 70 }] })).doc;
    eq('posted at once', [d.status, d.approval.self, d.lines[0].systemQty, d.lines[0].diff, d.value, book.stock.fac_rm.fat], ['POSTED', true, 64.5, 5.5, 68750, 70]);
    cancelBack('ADJ posted', before, d.id, 'owner');

    /* WO: waiting (its stock held back), and posted. 3 x 1196.25 = 3588.75 -> 3589 */
    before = snapshot();
    d = ok('WO', post('stores', 'WO', { date: T, locId: 'fac_fg', reason: 'damaged', lines: [{ itemId: 'bread', batchId: 'B-260309-BRD', qty: 3 }] })).doc;
    eq('held back', [d.status, d.value, E.available('fac_fg', 'bread', T)], ['PENDING', 3589, 24]);
    cancelBack('WO pending', before, d.id, 'stores');
    eq('let go', E.available('fac_fg', 'bread', T), 27);
    d = ok('WO by the Owner', post('owner', 'WO', { date: T, locId: 'fac_fg', reason: 'damaged', lines: [{ itemId: 'bread', batchId: 'B-260309-BRD', qty: 3 }] })).doc;
    eq('posted at once', [d.status, book.stock.fac_fg.bread], ['POSTED', 24]);
    cancelBack('WO posted', before, d.id, 'owner');

    /* DEP */
    before = snapshot();
    d = ok('DEP', post('accounts', 'DEP', { date: T, fromAccount: 'cash_factory', amount: 30000 })).doc;
    cancelBack('DEP', before, d.id, 'accounts');

    /* what a cancellation is not tested against: cash. The salary payment can be cancelled at any time. */
    eq('ledgers still add up', [book.cash.entries.reduce(function (s, x) { return s + x.amount; }, 0), book.ar.entries.reduce(function (s, x) { return s + x.amount; }, 0) - book.ar.total, book.ap.entries.reduce(function (s, x) { return s + x.amount; }, 0) - book.ap.total],
      [book.cash.balance.cash_factory + book.cash.balance.cash_st_vvn + book.cash.balance.bank, 0, 0]);
  });

  section('a.13 master changes, their audit entries, and the event on the bus', function () {
    var events = [], off = HB.bus.on('store:changed', function (p) { events.push(p.key + (p.op ? ':' + p.op : '')); });
    var changes = HB.masters.changes.length, n = E.log().length;
    r = ok('price change', act('accounts', 'master', { entity: 'items', record: { id: 'bread', price: { retail: 3300 } } }));
    eq('an operation announces itself: the log was written, the book changed', events, ['prefs', 'log', 'book:master']);
    events.length = 0;
    refused('a refused one', E.act('master', { entity: 'items', record: { id: 'bread', gstRate: 40 } }), 'invalid_input');
    off();
    eq('a refusal announces nothing', events, []);
    eq('the audit entry carries who, role, when, what, before and after', (function (a) { return [a.action, a.type, a.docId, a.userId, a.role, a.at, a.before.price, a.after.price]; })(lastOf(book.audit)),
      ['master', 'items', 'bread', 'u_accounts', 'accounts', lastOf(E.log()).at, { mrp: 4000, retail: 3200, corporate: 3000 }, { mrp: 4000, retail: 3300, corporate: 3000 }]);
    eq('it is in the list of master changes and in the log', [HB.masters.changes.length - changes, E.log().length - n, lastOf(E.log()).op], [1, 1, 'master']);
    eq('a posted invoice keeps the price it was posted with', inv1.lines[0].price, 3200);
    as('sales');
    eq('a new one takes the new price', E.preview('INV', { date: T, customerId: 'c_week', lines: [{ itemId: 'bread', qty: 1 }] }).doc.taxable, 3300);
    refusal('bad master input', 'accounts', 'master', { entity: 'items', record: { id: 'bread', gstRate: 40 } }, 'invalid_input', { field: 'gstRate' });
    refusal('the directory is not for stores', 'stores', 'master', { entity: 'employees', record: { name: 'Someone', unitId: 'factory', doj: T } }, 'role');

    r = ok('add an employee', act('accounts', 'master', { entity: 'employees', record: { name: 'Kiran Solanki', dept: 'Stores', designation: 'Helper', unitId: 'factory', doj: T, salary: 1400000 } }));
    eq('the id of a new record is fixed in the log entry', [r.record.id, lastOf(E.log()).out.ids, lastOf(book.audit).before, lastOf(book.audit).after.name], ['emp_005', ['emp_005'], null, 'Kiran Solanki']);
    r = ok('add an outlet', act('accounts', 'master', { entity: 'customers', record: { name: 'New Tea Stall', channel: 'retail', routeId: 'r1', terms: 'cash', standing: { bread: 4 } } }));
    eq('it is the last stop of its route', [r.record.id, HB.masters.routeById.r1.stops], ['cus_004', ['c_cash', 'c_week', 'cus_004']]);
    r = ok('add a store', act('accounts', 'master', { entity: 'locations', record: { name: 'Nadiad', standing: { bread: 10 } } }));
    eq('a store brings its unit, its two locations and its cash', [r.unit.id, lastOf(E.log()).out.ids, !!HB.masters.locationById.st_nadiad, !!HB.masters.locationById.transit_st_nadiad, HB.masters.accountById.cash_st_nadiad.kind, book.cash.balance.cash_st_nadiad],
      ['st_nadiad', ['st_nadiad'], true, true, 'cash', 0]);
    ok('deactivate it', act('accounts', 'setActive', { entity: 'locations', id: 'st_nadiad', active: false }));
    eq('deactivation is logged with before and after', (function (a) { return [a.action, a.type, a.docId, a.before, a.after]; })(lastOf(book.audit)), ['setActive', 'locations', 'st_nadiad', { active: true }, { active: false }]);
    refusal('no transfer to an inactive store', 'stores', 'post', { type: 'XFER', payload: { date: T, toStoreId: 'st_nadiad', lines: [{ itemId: 'bread', qty: 1 }] } }, 'invalid_input', { field: 'toStoreId' });
    ok('recipe change', act('accounts', 'master', { entity: 'recipes', record: { itemId: 'bread', expectedUnits: 42 } }));
    /* bags are at 90 since the receipt of a.12: (38000 + 6250) / 42 + 90 = 1053.5714 + 90 = 1143.5714 */
    eq('the cost follows the recipe', E.unitCost('bread'), 1143.5714);

    /* guardrails of the master forms: one name one record, a unit that stays once the item has stock, figures within reason */
    refusal('a second item of the same name', 'accounts', 'master', { entity: 'items', record: { kind: 'rm', name: ' MAIDA ', unit: 'kg' } }, 'duplicate', { field: 'name' });
    refusal('a second customer of the same name', 'accounts', 'master', { entity: 'customers', record: { name: 'new tea stall', channel: 'corporate', terms: 'credit' } }, 'duplicate', { field: 'name' });
    refusal('a second vendor of the same name', 'accounts', 'master', { entity: 'vendors', record: { name: 'Staff salaries', kind: 'expense' } }, 'duplicate', { field: 'name' });
    refusal('a second category of the same name', 'accounts', 'master', { entity: 'expenseCategories', record: { name: 'Electricity', mode: 'claim' } }, 'duplicate', { field: 'name' });
    refusal('a second store of the same name', 'accounts', 'master', { entity: 'locations', record: { name: 'Vidyanagar store' } }, 'duplicate', { field: 'name' });
    refusal('a store named like the factory', 'accounts', 'master', { entity: 'locations', record: { name: 'factory' } }, 'duplicate', { field: 'name' });
    refusal('a store renamed to another store\'s name', 'accounts', 'master', { entity: 'locations', record: { id: 'st_nadiad', name: 'Vidyanagar store' } }, 'duplicate', { field: 'name' });
    refusal('the unit of an item with stock', 'accounts', 'master', { entity: 'items', record: { id: 'maida', unit: 'g' } }, 'invalid_input', { field: 'unit' });
    refusal('an MRP beyond reason', 'accounts', 'master', { entity: 'items', record: { id: 'bread', price: { mrp: 99999999999999 } } }, 'invalid_input', { field: 'price.mrp' });
    refusal('a retailer price of zero', 'accounts', 'master', { entity: 'items', record: { id: 'bread', price: { retail: 0 } } }, 'invalid_input', { field: 'price.retail' });
    refusal('a credit limit beyond reason', 'accounts', 'master', { entity: 'customers', record: { id: 'c_corp', creditLimit: 9999999999999900 } }, 'invalid_input', { field: 'creditLimit' });
    refusal('credit days beyond a year', 'accounts', 'master', { entity: 'customers', record: { id: 'c_corp', creditDays: 99999 } }, 'invalid_input', { field: 'creditDays' });
    refusal('a standing quantity beyond reason', 'accounts', 'master', { entity: 'customers', record: { id: 'c_cash', standing: { bread: 999999999 } } }, 'invalid_input', { field: 'standing' });
    refusal('a GSTIN that is not one', 'accounts', 'master', { entity: 'vendors', record: { id: 'v_power', gstin: 'not a gstin' } }, 'invalid_input', { field: 'gstin' });
    eq('an edit that leaves the name alone is not a duplicate of itself', E.check('master', { entity: 'vendors', record: { id: 'v_power', name: 'Madhya Gujarat Power', termsDays: 12 } }).ok, true);
    eq('the unit of an item never in stock can change', (function () {
      var made = act('accounts', 'master', { entity: 'items', record: { kind: 'pk', name: 'Cake box', unit: 'pcs' } });
      return made.ok && act('accounts', 'master', { entity: 'items', record: { id: made.record.id, unit: 'box' } }).ok;
    })(), true);

    /* a change that changes nothing is refused and writes no history: the same price again, a vendor saved as it stands,
       a store under its own name, a recipe as it stands, a store deactivated twice */
    var history = [book.audit.length, HB.masters.changes.length, E.log().length];
    r = refusal('the same price again', 'accounts', 'master', { entity: 'items', record: { id: 'bread', price: { retail: 3300 } } }, 'invalid_input', { field: null });
    eq('and it says so', r.error.message, 'Nothing was changed');
    eq('nor does its preview pass', E.check('master', { entity: 'items', record: { id: 'bread', price: { retail: 3300 } } }).ok, false);
    refusal('a vendor saved as it stands', 'accounts', 'master', { entity: 'vendors', record: { id: 'v_power', name: 'Madhya Gujarat Power', termsDays: 10 } }, 'invalid_input', { field: null });
    refusal('a store under its own name', 'accounts', 'master', { entity: 'locations', record: { id: 'st_nadiad', name: 'Nadiad' } }, 'invalid_input', { field: null });
    refusal('a recipe as it stands', 'owner', 'master', { entity: 'recipes', record: { itemId: 'bread', expectedUnits: 42 } }, 'invalid_input', { field: null });
    refusal('a store deactivated twice', 'accounts', 'setActive', { entity: 'locations', id: 'st_nadiad', active: false }, 'invalid_input', { field: 'id' });
    eq('none of them wrote an audit entry, a master change or a log entry', [book.audit.length, HB.masters.changes.length, E.log().length], history);
  });

  section('a.14 persistence: replay, a skipped entry, the seed version, a fresh copy', function () {
    var image = bookHash(), log = E.log(), saved = JSON.stringify(log), n = log.length, i;
    eq('the log is plain data, numbered without a gap', [log.map(function (e) { return e.n; }).join(), Object.keys(log[0]).sort()], [log.map(function (e, k) { return k + 1; }).join(), ['args', 'at', 'n', 'op', 'out', 'role', 'userId']]);
    var seenIds = {}, twice = [];
    log.forEach(function (e) { e.out.ids.forEach(function (id) { if (seenIds[id]) twice.push(id); seenIds[id] = 1; }); });
    eq('no id is given twice', twice, []);

    /* save, rebuild and replay under another persona */
    HB.store.set('log', JSON.parse(saved));
    as('sales');
    E.boot();
    book = HB.book;
    eq('replayed as sales: nothing skipped', [HB.session.current().role, E.skipped, E.log().length], ['sales', [], n]);
    eq('and the book is the same, ledger by ledger', bookHash(), image);
    as('store_mgr');
    E.boot();
    eq('and again as the store manager', bookHash(), image);
    book = HB.book;

    /* entries that no longer apply. Entry 1, the purchase order, now names a vendor that does not exist: it is
       skipped, and so are its two receipts, the bill for them, the approval of that bill and the payment that
       settled it. The last deposit of a.12 is now for more cash than there is: it is skipped, and so is its
       cancellation. Every other entry keeps its ids. */
    var broken = JSON.parse(saved), depAt = -1;
    broken[0].args.payload.vendorId = 'v_gone';
    broken.forEach(function (x, k) { if (x.out.ids[0] === 'DEP-U-0003') depAt = k; });
    broken[depAt].args.payload.amount = 99999999900;
    var depN = broken[depAt].n;
    HB.store.set('log', broken);
    as('production');
    E.boot();
    book = HB.book;
    eq('skipped, never thrown: the entry and what rested on it', E.skipped.map(function (s) { return [s.n, s.op, s.code]; }),
      [[1, 'post', 'invalid_input'], [2, 'post', 'not_found'], [3, 'post', 'not_found'], [4, 'post', 'not_found'], [5, 'approve', 'not_found'], [6, 'post', 'not_found'],
        [depN, 'post', 'cash_short'], [depN + 1, 'cancel', 'not_found']]);
    eq('a skipped entry says what it was and why', (function (s) { return [s.args.type, s.out.ids, typeof s.reason, s.userId, s.role, s.at]; })(E.skipped[0]), ['PO', ['PO-U-0001'], 'string', 'u_stores', 'stores', T + 'T09:01']);
    eq('their documents are not in the book', ['PO-U-0001', 'GRN-U-0001', 'GRN-U-0002', 'VBILL-U-0001', 'PAY-U-0001', 'DEP-U-0003'].filter(function (id) { return !!book.docs[id]; }), []);
    var moved = [], gone = {};
    E.skipped.forEach(function (x) { gone[x.n] = 1; });
    for (i = 0; i < broken.length; i++) {
      var e = broken[i];
      if (gone[e.n] || (e.op !== 'post' && e.op !== 'postDispatch' && e.op !== 'cancel')) continue;
      for (var j = 0; j < e.out.ids.length; j++) {
        var doc = book.docs[e.out.ids[j]];
        if (!doc || doc.createdAt !== e.at || doc.createdBy !== e.userId) moved.push(e.n + ' ' + e.out.ids[j]);
      }
    }
    eq('every later entry made its documents under the ids it was given', moved, []);
    eq('for instance', ['PROD-U-0001', 'INV-U-0004', 'CXL-U-0001', 'PAY-U-0002'].map(function (id) { return book.docs[id].type; }), ['PROD', 'INV', 'CXL', 'PAY']);
    /* without the receipts the materials are still at their opening rates */
    eq('the book is the one those entries make', [E.price('maida'), book.docs['PROD-U-0001'].unitCost, book.cash.balance.bank - 17487500], [3600, 1130, 3000000]);
    /* DEP-U-0003 is in the log but not in the book: its number is still taken */
    r = ok('a new deposit after the rebuild', post('accounts', 'DEP', { date: T, fromAccount: 'cash_factory', amount: 100 }));
    eq('is numbered after the highest in the log, skipped entries included', [r.doc.id, r.n, r.doc.createdAt.slice(0, 10)], ['DEP-U-0004', n + 1, T]);
    r = ok('and a new order', post('stores', 'PO', { date: T, vendorId: 'v_stock', lines: [{ itemId: 'bag', qty: 10, rate: 80 }] }));
    eq('likewise', [r.doc.id, r.n], ['PO-U-0005', n + 2]);

    /* the saved log again: the same book as before */
    HB.store.set('log', JSON.parse(saved));
    as('owner');
    E.boot();
    book = HB.book;
    eq('the saved log gives the saved book again', [E.skipped, bookHash()], [[], image]);

    /* the seed version. A stand-in seed that posts the same opening entries. */
    var ranTo = [];
    HB.seed = { VERSION: 'check-1', run: function (toDate) { ranTo.push(toDate); E.postOpening(); } };
    E.boot();
    eq('a copy with no version yet is a new copy: the version is recorded, the log kept', [HB.store.get('meta').seedVersion, HB.store.get('meta').businessDate, ranTo, E.log().length, E.notice, bookHash()], ['check-1', T, [Y1], n, '', image]);
    E.boot();
    eq('the same version again changes nothing', [E.log().length, E.notice, bookHash()], [n, '', image]);
    HB.seed.VERSION = 'check-2';
    E.boot();
    book = HB.book;
    var realDay = HB.calendar.clamp(HB.calendar.realToday());
    eq('another version: the log is discarded and a fresh copy starts', [HB.store.get('meta').seedVersion, E.log().length, HB.calendar.today, typeof E.notice, E.notice.length > 0, E.skipped, book.docList.length, ranTo.length],
      ['check-2', 0, realDay, 'string', true, [], 4, 3]);
    eq('the seed was asked for history up to the day before the new business date', ranTo[2], HB.dates.addDays(realDay, -1));
    delete HB.seed;

    /* a fresh copy */
    HB.calendar.set(T);
    E.boot();
    ok('an entry in the new copy', post('accounts', 'DEP', { date: T, fromAccount: 'cash_factory', amount: 100000 }));
    eq('it is there', [E.log().length, HB.book.cash.balance.cash_factory, HB.book.docs['DEP-U-0001'].type], [1, 4900000, 'DEP']);
    E.freshCopy();
    book = HB.book;
    eq('fresh copy: no log, the device\'s date, the opening book', [E.log().length, HB.calendar.today, book.docList.length, book.cash.balance.cash_factory, E.skipped, HB.session.current().role],
      [0, realDay, 4, 5000000, [], 'accounts']);
    as('owner');
  });

  /*
   * a.15: the rules two reviews found broken, each on the smallest case that shows it, on a new copy of the tiny
   * company dated 10 Mar. 32 operations; the figures are worked out in the comments.
   */
  section('a.15 review findings: order prices, held stock, what to cancel first, the 8% limit, scope, dates, empty lines', function () {
    var pv, d, wo, sheet, forged, cut;
    HB.store.remove('log');
    HB.calendar.set(T);
    E.boot();
    book = HB.book;

    /* 1, 2. PROD: bread 3 mixes, 120 good (maida 200 - 30 = 170); puff 1 mix, 100 good (maida 170 - 4 = 166) */
    ok('PROD bread', post('production', 'PROD', { date: T, itemId: 'bread', mixes: 3, goodUnits: 120 }));
    ok('PROD puff', post('production', 'PROD', { date: T, itemId: 'puff', mixes: 1, goodUnits: 100 }));
    eq('two batches, raw stock after them', [lots('fac_fg', 'bread')[1], lots('fac_fg', 'puff'), book.stock.fac_rm], [['B-260310-BRD', 120, 0], [['B-260310-PUF', 100, 0]], { maida: 166, fat: 46.5, bag: 780 }]);

    /* --- the price agreed on an order holds for a part delivery (the price list says 3000)
       3. SO: the mess orders 10 loaves at Rs 28.00. Invoicing 6 of them: 6 x 2800 = 16800, not 6 x 3000 */
    var so2 = ok('SO at an agreed price', post('sales', 'SO', { date: T, customerId: 'c_corp', lines: [{ itemId: 'bread', qty: 10, price: 2800 }] })).doc;
    as('sales');
    pv = E.preview('INV', { date: T, customerId: 'c_corp', soId: so2.id, lines: [{ itemId: 'bread', qty: 6 }] });
    eq('a part of the order, sent without a price, takes the order\'s', [pv.ok, pv.doc.lines[0].price, pv.doc.total], [true, 2800, 16800]);
    pv = E.preview('INV', { date: T, customerId: 'c_corp', soId: so2.id });
    eq('the whole order, as before: 10 x 2800', [pv.doc.lines[0].price, pv.doc.total], [2800, 28000]);
    pv = E.preview('INV', { date: T, customerId: 'c_corp', soId: so2.id, lines: [{ itemId: 'bread', qty: 6, price: 2900 }] });
    eq('a price typed on the invoice still wins: 6 x 2900', pv.doc.total, 17400);
    /* puffs are not on the order: the corporate price list, 10 x 1050 = 10500 */
    pv = E.preview('INV', { date: T, customerId: 'c_corp', soId: so2.id, lines: [{ itemId: 'bread', qty: 6 }, { itemId: 'puff', qty: 10 }] });
    eq('an item the order does not have takes the price list', pv.doc.lines.map(function (l) { return [l.price, l.taxable]; }), [[2800, 16800], [1050, 10500]]);
    /* 4. the part delivery is invoiced */
    d = ok('INV for 6 of the 10', post('sales', 'INV', { date: T, customerId: 'c_corp', soId: so2.id, lines: [{ itemId: 'bread', qty: 6 }] })).doc;
    eq('posted at the order\'s price', [d.id, d.lines[0].price, d.total, so2.status, so2.invId, book.ar.balance.c_corp], ['INV-U-0001', 2800, 16800, 'INVOICED', 'INV-U-0001', 1016800]);

    /* --- a production entry whose batch is no longer whole names the document that took it last */
    refusal('PROD: the invoice took 6 of the batch', 'production', 'cancel', { id: 'PROD-U-0001', reason: 'test' }, 'has_dependants', { docId: 'INV-U-0001' });
    /* 5. XFER of 3 loaves: now the transfer is the last to have taken from the batch */
    ok('XFER', post('stores', 'XFER', { date: T, toStoreId: 'st_vvn', lines: [{ itemId: 'bread', qty: 3 }] }));
    refusal('PROD: then the transfer', 'production', 'cancel', { id: 'PROD-U-0001', reason: 'test' }, 'has_dependants', { docId: 'XFER-U-0001' });
    /* 6. the transfer is cancelled: a cancelled document is passed over, the invoice is named again */
    ok('cancel the transfer', act('stores', 'cancel', { id: 'XFER-U-0001', reason: 'not sent' }));
    refusal('PROD: the invoice again', 'production', 'cancel', { id: 'PROD-U-0001', reason: 'test' }, 'has_dependants', { docId: 'INV-U-0001' });
    /* 7. the invoice is cancelled: the batch is whole (120) and the entry could go */
    ok('cancel the invoice', act('sales', 'cancel', { id: 'INV-U-0001', reason: 'not delivered' }));
    as('production');
    eq('with the batch whole again the production entry can be cancelled', [lots('fac_fg', 'bread')[1], E.check('cancel', { id: 'PROD-U-0001' }).ok, so2.status], [['B-260310-BRD', 120, 0], true, 'OPEN']);
    /* 8, 9. a write-off waiting on the batch is named too; it is then cancelled */
    wo = ok('WO on the batch', post('stores', 'WO', { date: T, locId: 'fac_fg', reason: 'damaged', lines: [{ itemId: 'bread', batchId: 'B-260310-BRD', qty: 2 }] })).doc;
    refusal('PROD: a write-off waits on the batch', 'production', 'cancel', { id: 'PROD-U-0001', reason: 'test' }, 'has_dependants', { docId: wo.id });
    ok('cancel that write-off', act('stores', 'cancel', { id: wo.id, reason: 'not damaged' }));

    /* --- stale returns: exactly 8% of supply posts, anything above it waits - decided on the exact ratio
       10. INV: 100 loaves to the weekly outlet, 100 x 3200 = 320000 supplied in the window; 8% of it is 25600 */
    ok('INV weekly outlet', post('sales', 'INV', { date: T, customerId: 'c_week', lines: [{ itemId: 'bread', qty: 100 }] }));
    as('sales');
    pv = E.preview('CN', { date: T, customerId: 'c_week', lines: [{ itemId: 'bread', qty: 8 }] });
    eq('8 x 3200 = 25600 is exactly 8%: it posts', [pv.doc.taxable, pv.doc.sharePct, pv.doc.status], [25600, 8, 'POSTED']);
    /* 8 x 3201 = 25608; 25608 / 320000 = 8.0025%: above the limit, though it rounds to 8.00 */
    pv = E.preview('CN', { date: T, customerId: 'c_week', lines: [{ itemId: 'bread', qty: 8, price: 3201 }] });
    eq('25608 is 8.0025%: it waits, and the stored share does not read as within the limit', [pv.doc.taxable, pv.doc.status, pv.doc.sharePct, pv.returns.held, pv.outcome.waits], [25608, 'HELD', 8.01, true, true]);
    /* 8 x 3202 = 25616; 8.005% */
    pv = E.preview('CN', { date: T, customerId: 'c_week', lines: [{ itemId: 'bread', qty: 8, price: 3202 }] });
    eq('25616 is 8.005%: it waits', [pv.doc.status, pv.doc.sharePct], ['HELD', 8.01]);
    /* 11, 12. the 8.0025% return is entered and held; the Owner rejects it */
    d = ok('CN just above the limit', post('sales', 'CN', { date: T, customerId: 'c_week', lines: [{ itemId: 'bread', qty: 8, price: 3201 }] })).doc;
    eq('held for the Owner', [d.id, d.status, d.approval.state, d.holdReason, !!book.pending[d.id], book.ar.balance.c_week], ['CN-U-0001', 'HELD', 'pending', 'returns are above 8% of the supply of the last seven days', true, 320000]);
    ok('reject it', act('owner', 'reject', { id: d.id, reason: 'recounted at the outlet' }));
    /* 13. exactly 8%: posts at once against the open invoice. 320000 - 25600 = 294400 */
    d = ok('CN at exactly the limit', post('sales', 'CN', { date: T, customerId: 'c_week', lines: [{ itemId: 'bread', qty: 8 }] })).doc;
    eq('posted at once', [d.id, d.status, d.sharePct, d.allocations, book.ar.balance.c_week], ['CN-U-0002', 'POSTED', 8, [{ docId: 'INV-U-0002', amount: 25600 }], 294400]);

    /* --- what a write-off holds while it waits is safe from a cancellation and from a count
       14, 15. PO and GRN: 300 kg of maida at Rs 38.00 (300 x 3800 = 1140000, within the limit); maida 166 + 300 = 466
       16. WO: 450 kg of it, waiting: 450 held, 16 available */
    d = ok('PO maida', post('stores', 'PO', { date: T, vendorId: 'v_stock', lines: [{ itemId: 'maida', qty: 300, rate: 3800 }] })).doc;
    ok('GRN maida', post('stores', 'GRN', { date: T, poId: d.id, lines: [{ itemId: 'maida', qty: 300 }] }));
    wo = ok('WO of 450 kg', post('stores', 'WO', { date: T, locId: 'fac_rm', reason: 'damaged', lines: [{ itemId: 'maida', qty: 450 }] })).doc;
    eq('held, not gone', [wo.id, wo.status, wo.value, book.stock.fac_rm.maida, book.reserved.fac_rm.maida, E.available('fac_rm', 'maida')], ['WO-U-0002', 'PENDING', 1710000, 466, 450, 16]);
    /* cancelling the receipt would leave 166 kg under a write-off of 450 */
    refusal('GRN: its goods are held by a waiting write-off', 'stores', 'cancel', { id: 'GRN-U-0001', reason: 'test' }, 'has_dependants', { docId: 'WO-U-0002' });
    eq('nothing moved, and stock available is not below zero', [book.stock.fac_rm.maida, book.reserved.fac_rm.maida, E.available('fac_rm', 'maida'), book.docs['GRN-U-0001'].status], [466, 450, 16, 'POSTED']);
    as('production');
    /* one mix needs 10 kg of the 16 available; two need 20 */
    eq('production draws on what is not held', [E.preview('PROD', { date: T, itemId: 'bread', mixes: 1, goodUnits: 40 }).ok, (E.preview('PROD', { date: T, itemId: 'bread', mixes: 2, goodUnits: 80 }).error || {}).code], [true, 'stock_short']);
    /* 17. approved: maida 466 - 450 = 16. The receipt brought in 300 and 16 is left: its goods were used */
    ok('approve the write-off', act('owner', 'approve', { id: wo.id }));
    eq('written off', [wo.status, book.stock.fac_rm.maida, book.reserved.fac_rm.maida, E.available('fac_rm', 'maida')], ['POSTED', 16, 0, 16]);
    refusal('stock_short: a cancellation that would take stock below zero', 'stores', 'cancel', { id: 'GRN-U-0001', reason: 'test' }, 'stock_short', { docId: 'GRN-U-0001' });
    /* 18, 19. WO: 90 of the 100 puffs, waiting. ADJ by stores: counted 20, so the count would take off 80 */
    wo = ok('WO of 90 puffs', post('stores', 'WO', { date: T, locId: 'fac_fg', reason: 'damaged', lines: [{ itemId: 'puff', batchId: 'B-260310-PUF', qty: 90 }] })).doc;
    d = ok('ADJ counted 20', post('stores', 'ADJ', { date: T, locId: 'fac_fg', reason: 'count', lines: [{ itemId: 'puff', batchId: 'B-260310-PUF', countedQty: 20 }] })).doc;
    eq('both wait', [wo.id, wo.status, d.id, d.status, d.lines[0].diff, lots('fac_fg', 'puff')], ['WO-U-0003', 'PENDING', 'ADJ-U-0001', 'PENDING', -80, [['B-260310-PUF', 100, 90]]]);
    /* 100 on hand, 90 held: a count may take off 10 at most */
    refusal('stock_short: a count cannot take what a waiting write-off holds', 'owner', 'approve', { id: d.id }, 'stock_short', { docId: 'WO-U-0003' });
    refusal('stock_short: nor the Owner\'s own count, approved in the same operation', 'owner', 'post', { type: 'ADJ', payload: { date: T, locId: 'fac_fg', reason: 'count', lines: [{ itemId: 'puff', batchId: 'B-260310-PUF', countedQty: 20 }] } }, 'stock_short', { field: 'lines[0].countedQty', docId: 'WO-U-0003' });
    as('owner');
    eq('a count that leaves the held units is fine: 100 - 90 - 5 = 5', E.preview('ADJ', { date: T, locId: 'fac_fg', reason: 'count', lines: [{ itemId: 'puff', batchId: 'B-260310-PUF', countedQty: 95 }] }).ok, true);
    eq('the lot is as it was', lots('fac_fg', 'puff'), [['B-260310-PUF', 100, 90]]);
    /* 20, 21. the write-off is approved: 10 puffs left. The count still takes off 80: refused as plain short stock; rejected */
    ok('approve the write-off', act('owner', 'approve', { id: wo.id }));
    refusal('stock_short: the count now exceeds the stock', 'owner', 'approve', { id: d.id }, 'stock_short', { docId: 'ADJ-U-0001' });
    ok('reject the count', act('owner', 'reject', { id: d.id, reason: 'counted before the write-off' }));
    eq('finished puffs', [lots('fac_fg', 'puff'), E.available('fac_fg', 'puff', T)], [[['B-260310-PUF', 10, 0]], 10]);

    /* --- an expense claim is for any location, whoever raises it (SCOPE 4.6)
       22, 23. sales claims for the store, the store manager for the factory */
    d = ok('claim by sales for the store', post('sales', 'EXP', { kind: 'claim', date: T, categoryId: 'travel', unitId: 'st_vvn', amount: 5000 })).doc;
    eq('it waits, payable to the claimant', [d.id, d.status, d.unitId, d.payeeType, d.payeeId, d.createdBy], ['EXP-U-0001', 'PENDING', 'st_vvn', 'employee', 'E003', 'u_sales']);
    eq('and whoever raised it may cancel it', HB.session.can('cancel.exp', { doc: d }).ok, true);
    d = ok('claim by the store manager for the factory', post('store_mgr', 'EXP', { kind: 'claim', date: T, categoryId: 'travel', unitId: 'factory', amount: 7000 })).doc;
    eq('likewise', [d.id, d.status, d.unitId, d.payeeId], ['EXP-U-0002', 'PENDING', 'factory', 'E004']);

    /* --- an expense bill with no GST writes no GST entry: it is outside GST, not a Nil-rated purchase
       24. the Owner's bill for repairs, Rs 500.00, no GST: approved in the same operation */
    d = ok('expense bill without GST', post('owner', 'EXP', { kind: 'bill', date: T, payeeId: 'v_power', categoryId: 'repairs', unitId: 'factory', amount: 50000, gstRate: 0 })).doc;
    eq('payable and expense, no GST entry', (function (x) { return [d.id, d.status, d.gst, d.total, x.gst, x.ap.map(function (a) { return [a.payeeId, a.amount]; }), x.pnl.map(function (p) { return [p.line, p.categoryId, p.unitId, p.amount]; })]; })(E.rowsOf(d.id)),
      ['EXP-U-0003', 'APPROVED', 0, 50000, [], [['v_power', 50000]], [['expense', 'repairs', 'factory', 50000]]]);
    eq('so the Nil-rated input line holds stock purchases only: none here', gstTotals()['input 0'], null);

    /* --- the store manager's scope cannot be moved by a field of the payload
       25. a second store; 26, 27. 5 loaves sent to it and confirmed by the Owner (bread at the factory 20 - 5 = 15) */
    r = ok('add a store', act('accounts', 'master', { entity: 'locations', record: { name: 'Nadiad', standing: { bread: 10 } } }));
    d = ok('XFER to it', post('stores', 'XFER', { date: T, toStoreId: r.unit.id, lines: [{ itemId: 'bread', qty: 5 }] })).doc;
    refusal('role: the store manager confirms a transfer to another store', 'store_mgr', 'receiveTransfer', { id: d.id }, 'role', { docId: 'XFER-U-0002' });
    ok('the Owner confirms it', act('owner', 'receiveTransfer', { id: d.id }));
    forged = { date: T, storeId: 'st_nadiad', unitId: 'st_vvn', toStoreId: 'st_vvn', lines: [{ itemId: 'bread', sold: 1 }], cash: 4000, upi: 0 };
    refusal('role: the day-end of another store', 'store_mgr', 'post', { type: 'DAYEND', payload: { date: T, storeId: 'st_nadiad', lines: [{ itemId: 'bread', sold: 1 }], cash: 4000, upi: 0 } }, 'role', { field: 'storeId' });
    refusal('role: the same day-end with its own store named in other fields', 'store_mgr', 'post', { type: 'DAYEND', payload: forged }, 'role', { field: 'storeId' });
    eq('the other store did not move', [book.stock.st_nadiad, book.cash.balance.cash_st_nadiad, book.index.dayEnd['st_nadiad|' + T]], [{ bread: 5 }, 0, null]);
    as('store_mgr');
    eq('a page asking the session gets the same answer', (function (c) { return [c.ok, c.code, c.field]; })(HB.session.can('dayend.create', { doc: forged })), [false, 'role', 'storeId']);
    eq('and its own store is its own, whatever else the payload says', HB.session.can('dayend.create', { doc: { storeId: 'st_vvn', unitId: 'st_nadiad' } }).ok, true);
    refusal('role: a deposit of another store\'s cash', 'store_mgr', 'post', { type: 'DEP', payload: { date: T, fromAccount: 'cash_st_nadiad', accountId: 'cash_st_vvn', unitId: 'st_vvn', amount: 100 } }, 'role', { field: 'fromAccount' });
    refusal('role: a write-off at another store', 'store_mgr', 'post', { type: 'WO', payload: { date: T, locId: 'st_nadiad', unitId: 'st_vvn', reason: 'damaged', lines: [{ itemId: 'bread', batchId: 'B-260310-BRD', qty: 1 }] } }, 'role', { field: 'locId' });
    /* 28. the Owner enters that day-end: 1 x 4000, all in cash. The store manager cannot cancel it either */
    d = ok('the Owner enters it', post('owner', 'DAYEND', { date: T, storeId: 'st_nadiad', lines: [{ itemId: 'bread', sold: 1 }], cash: 4000, upi: 0 })).doc;
    eq('posted for that store', [d.id, d.storeId, d.gross, d.shortExcess, book.stock.st_nadiad.bread, book.cash.balance.cash_st_nadiad], ['DAYEND-U-0001', 'st_nadiad', 4000, 0, 4, 4000]);
    refusal('role: nor cancel it', 'store_mgr', 'cancel', { id: d.id, reason: 'test' }, 'role', { docId: 'DAYEND-U-0001' });

    /* --- a date is text: an array of one day must not slip past the date rules
       29. an order with an expected date in the future is fine, and makes the engine remember that day */
    ok('PO expected on 20 Mar', post('stores', 'PO', { date: T, vendorId: 'v_stock', expectedDate: '2026-03-20', lines: [{ itemId: 'bag', qty: 100, rate: 80 }] }));
    cut = [{ itemId: 'bag', qty: 100, rate: 80 }];
    refusal('future_date: an order dated 20 Mar', 'stores', 'post', { type: 'PO', payload: { date: '2026-03-20', vendorId: 'v_stock', lines: cut } }, 'future_date', { field: 'date' });
    refusal('invalid_input: the same day as an array', 'stores', 'post', { type: 'PO', payload: { date: ['2026-03-20'], vendorId: 'v_stock', lines: cut } }, 'invalid_input', { field: 'date' });
    refusal('invalid_input: a locked day as an array (the opening entries carry it)', 'stores', 'post', { type: 'PO', payload: { date: ['2026-01-01'], vendorId: 'v_stock', lines: cut } }, 'invalid_input', { field: 'date' });
    refusal('invalid_input: for the Owner too', 'owner', 'post', { type: 'EXP', payload: { kind: 'claim', date: ['2026-01-01'], categoryId: 'travel', unitId: 'factory', amount: 77700 } }, 'invalid_input', { field: 'date' });
    refusal('invalid_input: even the business date as an array', 'accounts', 'post', { type: 'DEP', payload: { date: [T], fromAccount: 'cash_factory', amount: 100 } }, 'invalid_input', { field: 'date' });
    refusal('invalid_input: on a dispatch sheet', 'sales', 'postDispatch', { routeId: 'r1', date: [T], outlets: [{ customerId: 'c_cash', lines: [{ itemId: 'bread', qty: 1 }] }] }, 'invalid_input', { field: 'date' });
    refusal('invalid_input: an expected date as an array', 'stores', 'post', { type: 'PO', payload: { date: T, expectedDate: ['2026-03-20'], vendorId: 'v_stock', lines: cut } }, 'invalid_input', { field: 'expectedDate' });
    refusal('invalid_input: a batch id as an array', 'stores', 'post', { type: 'WO', payload: { date: T, locId: 'fac_fg', reason: 'damaged', lines: [{ itemId: 'puff', batchId: ['B-260310-PUF'], qty: 1 }] } }, 'invalid_input', { field: 'lines[0].batchId' });
    eq('every document carries a date that is text, and March is the only month with a P&L', [book.docList.filter(function (x) { return typeof x.date !== 'string'; }).length, Object.keys(book.pnlMonth)], [0, ['2026-03']]);

    /* --- the prefilled transfer counts what is at the store, held by a write-off or not
       30, 31. 12 loaves sent to the store and confirmed (factory 15 - 12 = 3): standing 20 - 12 = 8 to send */
    d = ok('XFER 12 loaves', post('stores', 'XFER', { date: T, toStoreId: 'st_vvn', lines: [{ itemId: 'bread', qty: 12 }] })).doc;
    ok('confirmed', act('store_mgr', 'receiveTransfer', { id: d.id }));
    sheet = [{ itemId: 'bread', standing: 20, atStore: 12, inTransit: 0, qty: 8, available: 3 }, { itemId: 'puff', standing: 50, atStore: 0, inTransit: 0, qty: 50, available: 10 }];
    eq('the prefilled transfer', E.transferSheet('st_vvn', T).lines, sheet);
    /* 32. 5 of the 12 on a write-off that waits: they are still at the store, so the sheet does not change */
    wo = ok('WO of 5 loaves at the store', post('store_mgr', 'WO', { date: T, locId: 'st_vvn', reason: 'damaged', lines: [{ itemId: 'bread', batchId: 'B-260310-BRD', qty: 5 }] })).doc;
    eq('held units are at the store all the same; only 7 can be sold', [wo.id, wo.status, E.transferSheet('st_vvn', T).lines, E.available('st_vvn', 'bread', T)], ['WO-U-0004', 'PENDING', sheet, 7]);

    /* --- salaries are returned to the Owner and accounts only: the proposed salary bill too.
       On the rolls on 28 Feb: factory 5000000 + 2500000 + 1800000 = 9300000; the store 1600000 - one person's salary */
    eq('the proposal is refused to the other roles', ['stores', 'production', 'sales', 'store_mgr'].map(function (role) {
      as(role);
      var x = E.salaryBill('2026-02');
      return [x.ok, x.error && x.error.code, x.lines === undefined, x.total === undefined];
    }), [[false, 'role', true, true], [false, 'role', true, true], [false, 'role', true, true], [false, 'role', true, true]]);
    eq('and given to accounts and the Owner', ['accounts', 'owner'].map(function (role) { as(role); var x = E.salaryBill('2026-02'); return [x.ok, x.total, x.lines[1]]; }),
      [[true, 10900000, { unitId: 'st_vvn', headcount: 1, amount: 1600000 }], [true, 10900000, { unitId: 'st_vvn', headcount: 1, amount: 1600000 }]]);

    /* --- an empty line (a hole in a grid arrives as null) is a refusal with its field, never an exception */
    var holed = [];
    holed[1] = { itemId: 'maida', qty: 1, rate: 3600 };
    function empty(label, role, op, args, field) {
      try { refusal('invalid_input: ' + label, role, op, args, 'invalid_input', { field: field }); }
      catch (e) { sec.checks++; fail('invalid_input: ' + label + ': threw ' + (e && e.message ? e.message : e)); }
    }
    empty('PO, the first row removed', 'stores', 'post', { type: 'PO', payload: { date: T, vendorId: 'v_stock', lines: holed } }, 'lines[0].itemId');
    empty('GRN', 'stores', 'post', { type: 'GRN', payload: { date: T, poId: 'PO-U-0002', lines: [null] } }, 'lines[0].itemId');
    empty('VBILL', 'accounts', 'post', { type: 'VBILL', payload: { date: T, vendorId: 'v_stock', billNo: 'CF/9', grnIds: ['GRN-U-0001'], lines: [null] } }, 'lines[0].itemId');
    empty('PAY', 'accounts', 'post', { type: 'PAY', payload: { date: T, payeeType: 'vendor', payeeId: 'v_stock', account: 'bank', allocations: [null] } }, 'allocations[0].docId');
    empty('SO', 'sales', 'post', { type: 'SO', payload: { date: T, customerId: 'c_corp', lines: [null] } }, 'lines[0].itemId');
    empty('INV', 'sales', 'post', { type: 'INV', payload: { date: T, customerId: 'c_corp', lines: [null] } }, 'lines[0].itemId');
    empty('INV, the second line', 'sales', 'post', { type: 'INV', payload: { date: T, customerId: 'c_corp', lines: [{ itemId: 'bread', qty: 1 }, null] } }, 'lines[1].itemId');
    empty('RCPT', 'accounts', 'post', { type: 'RCPT', payload: { date: T, customerId: 'c_corp', account: 'bank', amount: 100, allocations: [null] } }, 'allocations[0].docId');
    empty('CN', 'sales', 'post', { type: 'CN', payload: { date: T, customerId: 'c_week', lines: [null] } }, 'lines[0].itemId');
    empty('XFER', 'stores', 'post', { type: 'XFER', payload: { date: T, toStoreId: 'st_vvn', lines: [null] } }, 'lines[0].itemId');
    empty('DAYEND, with expired units on the next line', 'store_mgr', 'post', { type: 'DAYEND', payload: { date: T, storeId: 'st_vvn', lines: [null, { itemId: 'bread', sold: 0, expired: 1 }], cash: 0, upi: 0 } }, 'lines[0].itemId');
    empty('ADJ', 'stores', 'post', { type: 'ADJ', payload: { date: T, locId: 'fac_rm', reason: 'count', lines: [null] } }, 'lines[0].itemId');
    empty('WO', 'stores', 'post', { type: 'WO', payload: { date: T, locId: 'fac_rm', reason: 'damaged', lines: [null] } }, 'lines[0].itemId');
    empty('a dispatch sheet, an empty outlet', 'sales', 'postDispatch', { routeId: 'r1', date: T, outlets: [null] }, 'outlets[0].customerId');
    empty('a dispatch sheet, an empty line', 'sales', 'postDispatch', { routeId: 'r1', date: T, outlets: [{ customerId: 'c_cash', lines: [null, { itemId: 'bread', qty: 1 }] }] }, 'outlets[0].lines[0].itemId');
    empty('a recipe, an empty material', 'accounts', 'master', { entity: 'recipes', record: { itemId: 'bread', materials: [null] } }, 'materials[0].itemId');
    empty('a recipe, an empty packing row', 'accounts', 'master', { entity: 'recipes', record: { itemId: 'bread', packing: [null] } }, 'packing[0].itemId');
    refused('a recipe made on chosen weekdays with no weekday ticked', act('accounts', 'master', { entity: 'recipes', record: { itemId: 'bread', rhythm: [] } }), 'invalid_input', { field: 'rhythm' });
    eq('a receipt with no order chosen is refused in words, with no dangling id', (function () { var x = post('stores', 'GRN', { date: T, lines: [] }); return [x.ok, x.error.field, x.error.message]; })(), [false, 'poId', 'Choose the purchase order']);
    as('sales');
    eq('a preview of a draft with an empty line is a refusal too', (function () {
      try { var x = E.preview('INV', { date: T, customerId: 'c_corp', lines: [null] }); return [x.ok, x.error.code, x.error.field, x.stock]; }
      catch (e) { return 'threw ' + e.message; }
    })(), [false, 'invalid_input', 'lines[0].itemId', [null]]);

    /* --- and the copy still rebuilds to the same book under another persona */
    eq('32 operations in the log', [E.log().length, lastOf(E.log()).out.ids], [32, ['WO-U-0004']]);
    var image = bookHash();
    as('store_mgr');
    E.boot();
    book = HB.book;
    eq('replayed as the store manager: nothing skipped, the same book', [E.skipped, E.log().length, bookHash()], [[], 32, image]);
    as('owner');
  });

  section('a.16 reported by the screens: a receipt before its order, an order for an outlet, the credit warning, statuses in words, the total of a sheet', function () {
    var pv, d, po2, bill, claim, sheet, said = [];
    function message(res) { var m = res && res.error ? res.error.message : ''; said.push(m); return m; }
    HB.store.remove('log');
    HB.calendar.set(T);
    E.boot();
    book = HB.book;

    /* 1, 2. PROD: bread 3 mixes, 120 good; puff 1 mix, 100 good */
    ok('PROD bread', post('production', 'PROD', { date: T, itemId: 'bread', mixes: 3, goodUnits: 120 }));
    ok('PROD puff', post('production', 'PROD', { date: T, itemId: 'puff', mixes: 1, goodUnits: 100 }));

    /* --- the preview of a sheet states the sheet as a whole
       cash outlet: 20 x 3200 + 10 x 1100 = 75000, GST 550, total 75550, collected; weekly outlet: 30 x 3200 + 20 x 1100 = 118000, GST 1100, total 119100
       together: 2 invoices, 80 units, 193000 before GST, GST 1650, total 194650, 75550 collected */
    sheet = E.dispatchSheet('r1', T);
    as('sales');
    pv = E.preview('DISPATCH', { routeId: 'r1', date: T, outlets: sheet.outlets });
    eq('preview of a sheet: the invoices added up', [pv.ok, pv.summary, pv.docs.length, pv.warnings], [true, { invoices: 2, units: 80, taxable: 193000, gst: 1650, total: 194650, collected: 75550 }, 2, []]);

    /* --- the credit-limit warning is for corporates (SCOPE 4.5): an outlet with a limit in its master is not warned about
       3. the weekly outlet gets a limit of Rs 100.00; 10 loaves are 10 x 3200 = 32000, far above it */
    ok('a credit limit for the weekly outlet', act('accounts', 'master', { entity: 'customers', record: { id: 'c_week', creditLimit: 10000 } }));
    as('sales');
    pv = E.preview('INV', { date: T, customerId: 'c_week', lines: [{ itemId: 'bread', qty: 10 }] });
    eq('an outlet above its limit: no warning; where it stands against the limit is still stated', [pv.ok, pv.doc.total, pv.warnings, pv.credit], [true, 32000, [], { limit: 10000, owes: 0, after: 32000, over: true }]);
    /* 4. the invoice; 5. the sheet as prefilled (the weekly outlet then owes 32000 + 119100) */
    r = ok('INV to the outlet', post('sales', 'INV', { date: T, customerId: 'c_week', lines: [{ itemId: 'bread', qty: 10 }] }));
    eq('posted without a warning', [r.doc.id, r.warnings, book.ar.balance.c_week], ['INV-U-0001', [], 32000]);
    r = ok('the sheet', act('sales', 'postDispatch', { routeId: 'r1', date: T, outlets: sheet.outlets }));
    eq('a sheet with an outlet above its limit posts without a warning', [r.docs.map(function (x) { return x.id; }), r.warnings, book.ar.balance.c_week], [['INV-U-0002', 'INV-U-0003'], [], 151100]);
    /* the mess owes its opening 1000000, which is its limit: one loaf at 3000 takes it above */
    as('sales');
    pv = E.preview('INV', { date: T, customerId: 'c_corp', lines: [{ itemId: 'bread', qty: 1 }] });
    eq('a corporate above its limit is warned about, as before', [pv.ok, pv.warnings.map(function (w) { return w.code; }), pv.credit], [true, ['credit_limit'], { limit: 1000000, owes: 1000000, after: 1003000, over: true }]);

    /* --- a sales order is for a corporate customer (SCOPE 4.5): an outlet is supplied from its route's sheet */
    d = refusal('SO: for a weekly outlet', 'sales', 'post', { type: 'SO', payload: { date: T, customerId: 'c_week', lines: [{ itemId: 'bread', qty: 5 }] } }, 'invalid_input', { field: 'customerId' });
    eq('and it says so', message(d), 'Amul Parlour, Station Road is not a corporate customer; a sales order is for a corporate customer');
    refusal('SO: for a cash outlet, raised by the Owner', 'owner', 'post', { type: 'SO', payload: { date: T, customerId: 'c_cash', lines: [{ itemId: 'bread', qty: 5 }] } }, 'invalid_input', { field: 'customerId' });
    as('sales');
    eq('an order for the mess is accepted', E.preview('SO', { date: T, customerId: 'c_corp', lines: [{ itemId: 'bread', qty: 5 }] }).ok, true);

    /* --- a goods receipt cannot be dated before its order
       6. PO today: 100 kg of maida at Rs 38.00 = 380000, within the limit. Stores may go back three days, so the date rules let 9 Mar through */
    d = ok('PO maida', post('stores', 'PO', { date: T, vendorId: 'v_stock', lines: [{ itemId: 'maida', qty: 100, rate: 3800 }] })).doc;
    r = refusal('GRN: dated the day before its order', 'stores', 'post', { type: 'GRN', payload: { date: Y1, poId: d.id, lines: [{ itemId: 'maida', qty: 100 }] } }, 'invalid_input', { field: 'date' });
    eq('and it says so', message(r), 'A receipt cannot be dated before its order');
    refusal('GRN: nor for the Owner, who may back-date further', 'owner', 'post', { type: 'GRN', payload: { date: '2026-02-20', poId: d.id, lines: [{ itemId: 'maida', qty: 100 }] } }, 'invalid_input', { field: 'date' });
    /* 7. on the order's own date it is received: maida 200 - 30 - 4 + 100 = 266 */
    ok('GRN on the date of the order', post('stores', 'GRN', { date: T, poId: d.id, lines: [{ itemId: 'maida', qty: 100 }] }));
    eq('received', [d.status, book.stock.fac_rm.maida], ['RECEIVED', 266]);

    /* --- a refusal names a status in the words of the screens, never by its code
       8. the bill at Rs 40.00: 400000 against 380000, 5.3% away: held. 9. an order above the limit (2000 x 3800 = 7600000): pending. 10. a claim: pending */
    bill = ok('VBILL held', post('accounts', 'VBILL', { date: T, vendorId: 'v_stock', billNo: 'CF/16', grnIds: ['GRN-U-0001'], lines: [{ itemId: 'maida', qty: 100, rate: 4000 }] })).doc;
    po2 = ok('PO above the limit', post('stores', 'PO', { date: T, vendorId: 'v_stock', lines: [{ itemId: 'maida', qty: 2000, rate: 3800 }] })).doc;
    claim = ok('claim by sales', post('sales', 'EXP', { kind: 'claim', date: T, categoryId: 'travel', unitId: 'factory', amount: 5000 })).doc;
    eq('one held, two pending', [bill.status, po2.status, claim.status], ['HELD', 'PENDING', 'PENDING']);
    r = refusal('wrong_state: a receipt against an order that waits', 'stores', 'post', { type: 'GRN', payload: { date: T, poId: po2.id, lines: [{ itemId: 'maida', qty: 10 }] } }, 'wrong_state', { field: 'poId', docId: po2.id });
    eq('waiting for approval, not "pending"', message(r), po2.id + ' is waiting for approval; goods are received only against an approved order');
    r = refusal('wrong_state: a payment of a held bill', 'accounts', 'post', { type: 'PAY', payload: { date: T, payeeType: 'vendor', payeeId: 'v_stock', account: 'bank', allocations: [{ docId: bill.id, amount: 1000 }] } }, 'wrong_state', { field: 'allocations[0].docId', docId: bill.id });
    eq('held for approval, not "held"', message(r), bill.id + ' is held for approval and cannot be paid');
    r = refusal('wrong_state: a payment of a claim that waits', 'accounts', 'post', { type: 'PAY', payload: { date: T, payeeType: 'employee', payeeId: claim.payeeId, account: 'bank', allocations: [{ docId: claim.id, amount: 5000 }] } }, 'wrong_state', { field: 'allocations[0].docId', docId: claim.id });
    eq('waiting for approval', message(r), claim.id + ' is waiting for approval and cannot be paid');
    /* --- nothing is paid before it is owed: a payment cannot be dated before the latest of the bills and claims it pays
       11. a second claim by sales, dated two days back; the Owner approves both */
    var older = ok('claim by sales, two days back', post('sales', 'EXP', { kind: 'claim', date: Y2, categoryId: 'travel', unitId: 'factory', amount: 3000 })).doc;
    ok('approve the claim of today', act('owner', 'approve', { id: claim.id }));
    ok('approve the older claim', act('owner', 'approve', { id: older.id }));
    r = refusal('PAY: dated before the later of its two claims', 'accounts', 'post', { type: 'PAY', payload: { date: Y1, payeeType: 'employee', payeeId: claim.payeeId, account: 'bank',
      allocations: [{ docId: older.id, amount: 3000 }, { docId: claim.id, amount: 5000 }] } }, 'invalid_input', { field: 'date', docId: claim.id });
    eq('and it names the later one', message(r), 'A payment cannot be dated before the bills and claims it pays: ' + claim.id + ' is dated 10 Mar 2026');
    refusal('PAY: nor for the Owner, who may back-date further', 'owner', 'post', { type: 'PAY', payload: { date: '2026-02-20', payeeType: 'employee', payeeId: claim.payeeId, account: 'bank',
      allocations: [{ docId: older.id, amount: 3000 }] } }, 'invalid_input', { field: 'date', docId: older.id });
    /* 12. on the date of the older claim it is paid */
    eq('a payment on the date of the claim it pays goes through', ok('PAY the older claim on its date', post('accounts', 'PAY', { date: Y2, payeeType: 'employee', payeeId: claim.payeeId, account: 'bank',
      allocations: [{ docId: older.id, amount: 3000 }] })).doc.date, Y2);
    /* the other states keep their plain words: an invoice against a cancelled order, a second confirmation of a transfer */
    d = ok('SO', post('sales', 'SO', { date: T, customerId: 'c_corp', lines: [{ itemId: 'bread', qty: 2 }] })).doc;
    ok('cancel it', act('sales', 'cancel', { id: d.id, reason: 'ordered twice' }));
    r = refusal('wrong_state: an invoice for a cancelled order', 'sales', 'post', { type: 'INV', payload: { date: T, customerId: 'c_corp', soId: d.id } }, 'wrong_state', { field: 'soId' });
    eq('cancelled', message(r), d.id + ' is cancelled');
    d = ok('XFER', post('stores', 'XFER', { date: T, toStoreId: 'st_vvn', lines: [{ itemId: 'bread', qty: 5 }] })).doc;
    ok('confirmed', act('store_mgr', 'receiveTransfer', { id: d.id }));
    r = refusal('wrong_state: confirmed twice', 'store_mgr', 'receiveTransfer', { id: d.id }, 'wrong_state', { docId: d.id });
    eq('received', message(r), d.id + ' is received; only a transfer on its way can be confirmed');
    r = refusal('wrong_state: an approval of something posted', 'owner', 'approve', { id: 'INV-U-0001' }, 'wrong_state', { docId: 'INV-U-0001' });
    eq('posted', message(r), 'INV-U-0001 is posted; it is not waiting for approval');
    eq('no refusal shows a status code', said.filter(function (m) { return !m || /\b(PENDING|HELD|APPROVED|PART_RECEIVED|RECEIVED|REJECTED|CANCELLED|POSTED|OPEN|INVOICED|SENT|PAID)\b/.test(m); }), []);

    /* --- and the copy still rebuilds to the same book under another persona */
    var image = bookHash(), n = E.log().length;
    as('stores');
    E.boot();
    book = HB.book;
    eq('replayed as stores: nothing skipped, the same book', [E.skipped, E.log().length, bookHash()], [[], n, image]);
    as('owner');
  });

  /*
   * a.17: the seven warnings on unusual figures (SCOPE decision 18), on a new copy of the tiny company dated 10 Mar.
   * For each: silent at the threshold, raised just beyond it, on both sides where it has two; then one entry posted
   * with the warning - it is not refused, the code is kept on the document and the audit entry says so. The
   * thresholds are those of the fixture: 80% and 105% of the expected units, 20% of the books and Rs 500, the
   * quantity ordered, everything the customer owes, Rs 5,000 for a claim, 25% of the latest price, 10% of the sales.
   */
  section('a.17 warnings on unusual figures: each at its threshold, never a refusal, kept on the document and in its audit entry, never for the seed', function () {
    var pv, d, so, R = HB.fmt.rupee;
    function codes(res) { return (res.warnings || []).map(function (w) { return w.code; }); }
    function said(res) { return (res.warnings || []).map(function (w) { return [w.code, w.field, w.message]; }); }
    function note(id) { var a = book.audit.filter(function (x) { return x.docId === id && x.action === 'post'; })[0]; return a ? a.note : null; }
    HB.store.remove('log');
    HB.calendar.set(T);
    E.boot();
    book = HB.book;

    /* --- 1. production: good units against what the recipe expects for the mixes
       1. PROD puff, 1 mix, all 100 good: an ordinary entry. maida 200 - 4 = 196; shortening 50 - 2 = 48; bags 1000 - 100 = 900 */
    r = ok('PROD puff, an ordinary run', post('production', 'PROD', { date: T, itemId: 'puff', mixes: 1, goodUnits: 100 }));
    eq('an ordinary entry raises nothing and carries no list', [r.warnings, 'warned' in r.doc, note(r.doc.id)], [[], false, '']);
    /* one mix of bread is expected to give 40: 80% of it is 32, 105% is 42 */
    as('production');
    eq('yield: 32 of 40 is exactly 80% and 42 exactly 105%: silent; 31 and 43 are not', [32, 31, 42, 43].map(function (good) { return codes(E.preview('PROD', { date: T, itemId: 'bread', mixes: 1, goodUnits: good })); }),
      [[], ['yield_unusual'], [], ['yield_unusual']]);
    eq('the warning names the figure and its input', [said(E.preview('PROD', { date: T, itemId: 'bread', mixes: 1, goodUnits: 31 })), said(E.preview('PROD', { date: T, itemId: 'bread', mixes: 1, goodUnits: 43 }))],
      [[['yield_unusual', 'goodUnits', 'Sandwich bread: 31 pcs good is 77.5% of the 40 pcs the recipe expects for 1 mix. A run normally gives 80% to 105%']],
        [['yield_unusual', 'goodUnits', 'Sandwich bread: 43 pcs good is 107.5% of the 40 pcs the recipe expects for 1 mix. A run normally gives 80% to 105%']]]);
    /* a figure just beyond a bound is not printed as the bound. A mix of puffs is expected to give 100: 9.99 mixes 999, of
       which 799 is 79.98% (one decimal would say 80.0%); 1.19 mixes 119, of which 125 is 105.04% (105.0%) */
    eq('just beyond a bound the sentence shows the figure that broke it, with a second decimal', [said(E.preview('PROD', { date: T, itemId: 'puff', mixes: 9.99, goodUnits: 799 })), said(E.preview('PROD', { date: T, itemId: 'puff', mixes: 1.19, goodUnits: 125 }))],
      [[['yield_unusual', 'goodUnits', 'Veg puff: 799 pcs good is 79.98% of the 999 pcs the recipe expects for 9.99 mixes. A run normally gives 80% to 105%']],
        [['yield_unusual', 'goodUnits', 'Veg puff: 125 pcs good is 105.04% of the 119 pcs the recipe expects for 1.19 mixes. A run normally gives 80% to 105%']]]);
    /* mixes are rounded to three decimals before they are tested: 0.0004 is no mix (it was posted as a run of 0 mixes
       expecting 0 units, warned about with "is - of the 0 pcs"); 0.0005 is 0.001 mix, 0.04 loaves expected */
    refusal('invalid_input: mixes that round to none are no run', 'production', 'post', { type: 'PROD', payload: { date: T, itemId: 'bread', mixes: 0.0004, goodUnits: 25 } }, 'invalid_input', { field: 'mixes' });
    eq('the least that is a run: 0.0005 mixes is 0.001, and the yield is measured against what that expects', (function (p) { return [p.ok, p.doc.mixes, p.doc.expectedUnits, /^Sandwich bread: 25 pcs good is \d[\d,.]*% of the 0\.04 pcs the recipe expects for 0\.001 mixes/.test(p.warnings[0].message)]; })(E.preview('PROD', { date: T, itemId: 'bread', mixes: 0.0005, goodUnits: 25 })),
      [true, 0.001, 0.04, true]);
    /* 2. PROD bread, 3 mixes, expected 120, 95 good: 95 / 120 = 79.2%, under 80% (96). It is posted all the same.
       maida 196 - 30 = 166; shortening 48 - 1.5 = 46.5; bags 900 - 95 = 805; loss (120 - 95) x 1130 = 28250 */
    r = ok('PROD bread at 79.2%', post('production', 'PROD', { date: T, itemId: 'bread', mixes: 3, goodUnits: 95, rejectedUnits: 25 }));
    eq('posted with the warning: the batch is in stock, the code on the entry, the sentence in its audit entry',
      [r.doc.id, r.doc.status, r.doc.warned, r.doc.lossValue, lots('fac_fg', 'bread')[1], book.stock.fac_rm, said(r), note(r.doc.id)],
      ['PROD-U-0002', 'POSTED', ['yield_unusual'], 28250, ['B-260310-BRD', 95, 0], { maida: 166, fat: 46.5, bag: 805 },
        [['yield_unusual', 'goodUnits', 'Sandwich bread: 95 pcs good is 79.2% of the 120 pcs the recipe expects for 3 mixes. A run normally gives 80% to 105%']],
        'Entered with a warning: Sandwich bread: 95 pcs good is 79.2% of the 120 pcs the recipe expects for 3 mixes. A run normally gives 80% to 105%']);

    /* --- 6. purchase order: the rate against the latest purchase price. Maida stands at 3600: a quarter of it is 900 */
    as('stores');
    eq('rate: 4500 and 2700 are exactly 25% away: silent; 4501 and 2699 are not', [4500, 4501, 2700, 2699].map(function (rate) { return codes(E.preview('PO', { date: T, vendorId: 'v_stock', lines: [{ itemId: 'maida', qty: 10, rate: rate }] })); }),
      [[], ['rate_far'], [], ['rate_far']]);
    /* 3. PO: maida 10 x 5000 = 50000 (38.9% above 3600); shortening 5 x 12000 = 60000 (the latest price); bags 100 x 200 = 20000 (80 is the latest).
       Total 130000, within the limit: approved as submitted. Two lines are far off: one code, both sentences */
    r = ok('PO with two rates far off', post('stores', 'PO', { date: T, vendorId: 'v_stock', lines: [{ itemId: 'maida', qty: 10, rate: 5000 }, { itemId: 'fat', qty: 5, rate: 12000 }, { itemId: 'bag', qty: 100, rate: 200 }] }));
    eq('approved as submitted, with one warning per line that is off, each at its own rate', [r.doc.id, r.doc.status, r.doc.total, r.doc.warned, said(r)],
      ['PO-U-0001', 'APPROVED', 130000, ['rate_far'],
        [['rate_far', 'lines[0].rate', 'Maida: ' + R + '50.00 against the latest purchase price of ' + R + '36.00, more than 25% away'],
          ['rate_far', 'lines[2].rate', 'Poly bag: ' + R + '2.00 against the latest purchase price of ' + R + '0.80, more than 25% away']]]);
    eq('the audit entry keeps what it said before and adds the warnings', note('PO-U-0001'),
      'within limit. Entered with warnings: Maida: ' + R + '50.00 against the latest purchase price of ' + R + '36.00, more than 25% away; Poly bag: ' + R + '2.00 against the latest purchase price of ' + R + '0.80, more than 25% away');

    /* --- 2. stock count: the counted quantity against the books. Maida: 166 kg in the books, a fifth of it is 33.2 kg;
       33.201 kg x 3600 = 119523.6 -> 119524, far above Rs 500. Bags: 805 in the books at 80 paise: 624 short is 49920, 625 short is 50000 */
    eq('count: 132.8 and 199.2 kg are exactly 20% away: silent; 132.799 and 199.201 are not', [132.8, 132.799, 199.2, 199.201].map(function (q) { return codes(E.preview('ADJ', { date: T, locId: 'fac_rm', reason: 'count', lines: [{ itemId: 'maida', countedQty: q }] })); }),
      [[], ['count_far'], [], ['count_far']]);
    eq('a difference worth less than Rs 500 is let through, however far off: 181 bags (49920) silent, 180 (50000) not', [181, 180].map(function (q) { return codes(E.preview('ADJ', { date: T, locId: 'fac_rm', reason: 'count', lines: [{ itemId: 'bag', countedQty: q }] })); }),
      [[], ['count_far']]);
    /* 4. ADJ: maida counted 16 for 166 (a digit dropped): -150 x 3600 = -540000; bags 200 for 805: -605 x 80 = -48400, under Rs 500. Net -588400 */
    r = ok('ADJ with a digit dropped', post('stores', 'ADJ', { date: T, locId: 'fac_rm', reason: 'spot check', lines: [{ itemId: 'maida', countedQty: 16 }, { itemId: 'bag', countedQty: 200 }] }));
    d = r.doc;
    eq('it waits for the Owner like any count, with the warning on the one line', [d.id, d.status, d.value, d.warned, said(r), note(d.id), book.stock.fac_rm.maida],
      ['ADJ-U-0001', 'PENDING', -588400, ['count_far'], [['count_far', 'lines[0].countedQty', 'Maida: 16 kg counted against 166 kg in the books, more than 20% away']],
        'Entered with a warning: Maida: 16 kg counted against 166 kg in the books, more than 20% away', 166]);
    /* 5. the Owner rejects it */
    ok('the Owner rejects it', act('owner', 'reject', { id: d.id, reason: 'one bay was counted' }));

    /* --- 3. an invoice from a corporate order: delivered against ordered
       6. SO: the mess orders 10 loaves at the corporate price, 3000. It owes its opening 1000000, which is its credit limit */
    so = ok('SO', post('sales', 'SO', { date: T, customerId: 'c_corp', lines: [{ itemId: 'bread', qty: 10 }] })).doc;
    as('sales');
    eq('delivered as ordered, in part, or the whole order: the credit-limit warning alone; one loaf more: the new warning after it',
      [codes(E.preview('INV', { date: T, customerId: 'c_corp', soId: so.id, lines: [{ itemId: 'bread', qty: 10 }] })), codes(E.preview('INV', { date: T, customerId: 'c_corp', soId: so.id, lines: [{ itemId: 'bread', qty: 6 }] })),
        codes(E.preview('INV', { date: T, customerId: 'c_corp', soId: so.id })), said(E.preview('INV', { date: T, customerId: 'c_corp', soId: so.id, lines: [{ itemId: 'bread', qty: 11 }] })).slice(1)],
      [['credit_limit'], ['credit_limit'], ['credit_limit'], [['over_order', 'lines[0].qty', 'Sandwich bread: 11 pcs on the invoice, 10 pcs on the order SO-U-0001']]]);
    eq('an invoice with no order has nothing to be measured against', codes(E.preview('INV', { date: T, customerId: 'c_week', lines: [{ itemId: 'bread', qty: 50 }] })), []);
    /* 7. INV: 12 loaves for the 10 ordered, and 5 puffs the order does not have.
       bread 12 x 3000 = 36000 (Nil); puff 5 x 1050 = 5250, CGST = SGST = round(5250 x 5 / 200) = round(131.25) = 131; total 36000 + 5250 + 262 = 41512.
       The mess then owes 1041512, above its limit: the credit-limit warning comes as it always did, and is not kept */
    r = ok('INV above the order', post('sales', 'INV', { date: T, customerId: 'c_corp', soId: so.id, lines: [{ itemId: 'bread', qty: 12 }, { itemId: 'puff', qty: 5 }] }));
    eq('posted for what was delivered: the order is invoiced, the credit-limit warning first and unchanged, the new one kept', [r.doc.id, r.doc.status, r.doc.total, so.status, book.ar.balance.c_corp, r.doc.warned, said(r), note(r.doc.id)],
      ['INV-U-0001', 'POSTED', 41512, 'INVOICED', 1041512, ['over_order'],
        [['credit_limit', null, 'Sardar Hostel Mess will owe ' + R + '10,415.12, above its credit limit of ' + R + '10,000.00'],
          ['over_order', 'lines[0].qty', 'Sandwich bread: 12 pcs on the invoice, 10 pcs on the order SO-U-0001'],
          ['over_order', 'lines[1].qty', 'Veg puff: 5 pcs on the invoice, none on the order SO-U-0001']],
        'Entered with warnings: Sandwich bread: 12 pcs on the invoice, 10 pcs on the order SO-U-0001; Veg puff: 5 pcs on the invoice, none on the order SO-U-0001']);

    /* --- 4. a receipt: the amount against everything the customer owes. The mess owes 1000000 + 41512 = 1041512 on two invoices */
    as('accounts');
    eq('receipt: exactly what is owed is silent, also when none of it is set against an invoice; one paisa more is not',
      [codes(E.preview('RCPT', { date: T, customerId: 'c_corp', account: 'bank', amount: 1041512 })), codes(E.preview('RCPT', { date: T, customerId: 'c_corp', account: 'bank', amount: 500000 })),
        said(E.preview('RCPT', { date: T, customerId: 'c_corp', account: 'bank', amount: 1041513 })), said(E.preview('RCPT', { date: T, customerId: 'c_cash', account: 'cash_factory', amount: 10000 }))],
      [[], [], [['over_owed', 'amount', R + '10,415.13 is more than the ' + R + '10,415.12 Sardar Hostel Mess owes. ' + R + '10,415.13 will stay on account']],
        [['over_owed', 'amount', 'Shree Ganesh Provision owes nothing. ' + R + '100.00 will stay on account']]]);
    /* 8. RCPT: 1100000 into the bank, both invoices settled in full: 1100000 - 1041512 = 58488 stays on account. bank 30000000 + 1100000 */
    r = ok('RCPT above what is owed', post('accounts', 'RCPT', { date: T, customerId: 'c_corp', account: 'bank', amount: 1100000, allocations: [{ docId: 'INV-260101-001', amount: 1000000 }, { docId: 'INV-U-0001', amount: 41512 }] }));
    eq('posted: the message says what stays on account', [r.doc.id, r.doc.onAccount, r.doc.warned, said(r), note(r.doc.id), book.ar.credit.c_corp, book.cash.balance.bank],
      ['RCPT-U-0001', 58488, ['over_owed'], [['over_owed', 'amount', R + '11,000.00 is more than the ' + R + '10,415.12 Sardar Hostel Mess owes. ' + R + '584.88 will stay on account']],
        'Entered with a warning: ' + R + '11,000.00 is more than the ' + R + '10,415.12 Sardar Hostel Mess owes. ' + R + '584.88 will stay on account', 58488, 31100000]);

    /* --- 5. an expense claim: Rs 5,000 is the most a claim normally is. An expense bill is not a claim */
    as('store_mgr');
    eq('claim: 500000 is silent, 500001 is not', [codes(E.preview('EXP', { kind: 'claim', date: T, categoryId: 'travel', unitId: 'st_vvn', amount: 500000 })), said(E.preview('EXP', { kind: 'claim', date: T, categoryId: 'travel', unitId: 'st_vvn', amount: 500001 }))],
      [[], [['claim_high', 'amount', 'A claim of ' + R + '5,000.01 is well above what a claim normally is, ' + R + '5,000.00 or less']]]);
    as('accounts');
    eq('an expense bill of any size is not warned about', codes(E.preview('EXP', { kind: 'bill', date: T, payeeId: 'v_power', categoryId: 'electricity', unitId: 'factory', amount: 5000000 })), []);
    /* 9. the store manager claims Rs 8,000: it waits for the Owner like any claim. 10. the Owner's own claim of Rs 6,000 is approved in the same operation */
    r = ok('claim of Rs 8,000', post('store_mgr', 'EXP', { kind: 'claim', date: T, categoryId: 'travel', unitId: 'st_vvn', amount: 800000 }));
    eq('it waits, with the warning', [r.doc.id, r.doc.status, r.doc.warned, codes(r), note(r.doc.id)],
      ['EXP-U-0001', 'PENDING', ['claim_high'], ['claim_high'], 'Entered with a warning: A claim of ' + R + '8,000.00 is well above what a claim normally is, ' + R + '5,000.00 or less']);
    r = ok('the Owner\'s own claim of Rs 6,000', post('owner', 'EXP', { kind: 'claim', date: T, categoryId: 'repairs', unitId: 'factory', amount: 600000 }));
    eq('approved in the same operation all the same: the warning on the entry of the posting, "own document" on the approval', [r.doc.id, r.doc.status, r.doc.approval.self, r.doc.warned, codes(r), note(r.doc.id), lastOf(book.audit).action, lastOf(book.audit).note],
      ['EXP-U-0002', 'APPROVED', true, ['claim_high'], ['claim_high'], 'Entered with a warning: A claim of ' + R + '6,000.00 is well above what a claim normally is, ' + R + '5,000.00 or less', 'approve', 'own document']);

    /* --- 7. a store day-end: cash and UPI against the sales at MRP
       11, 12. 20 loaves and 50 puffs sent to the store and confirmed. Sold: 10 loaves x 4000 = 40000, 20 puffs x 1500 = 30000: 70000, a tenth is 7000 */
    d = ok('XFER', post('stores', 'XFER', { date: T, toStoreId: 'st_vvn', lines: [{ itemId: 'bread', qty: 20 }, { itemId: 'puff', qty: 50 }] })).doc;
    ok('confirmed', act('store_mgr', 'receiveTransfer', { id: d.id }));
    as('store_mgr');
    function dayEnd(cash) { return { date: T, storeId: 'st_vvn', lines: [{ itemId: 'bread', sold: 10 }, { itemId: 'puff', sold: 20 }], cash: cash, upi: 20000 }; }
    eq('day-end: 63000 and 77000 are exactly 10% away: silent; 62999 and 77001 are not', [43000, 42999, 57000, 57001].map(function (cash) { return codes(E.preview('DAYEND', dayEnd(cash))); }),
      [[], ['cash_far'], [], ['cash_far']]);
    eq('it names the two figures', said(E.preview('DAYEND', dayEnd(42999))), [['cash_far', 'cash', 'Cash and UPI come to ' + R + '629.99 against sales of ' + R + '700.00 at MRP, more than 10% away']]);
    /* 13. DAYEND: cash 30000 and UPI 20000 against 70000: 20000 short, posted as an expense of the store. store cash 200000 + 30000; bank 31100000 + 20000 */
    r = ok('DAYEND 20000 short', post('store_mgr', 'DAYEND', dayEnd(30000)));
    eq('posted: the shortage is an expense of the store as before, and the day-end carries the warning', [r.doc.id, r.doc.status, r.doc.gross, r.doc.shortExcess, book.pnlMonth['2026-03'].expense['cash_short|st_vvn'], book.cash.balance.cash_st_vvn, book.cash.balance.bank, r.doc.warned, said(r), note(r.doc.id)],
      ['DAYEND-U-0001', 'POSTED', 70000, -20000, 20000, 230000, 31120000, ['cash_far'], [['cash_far', 'cash', 'Cash and UPI come to ' + R + '500.00 against sales of ' + R + '700.00 at MRP, more than 10% away']],
        'Entered with a warning: Cash and UPI come to ' + R + '500.00 against sales of ' + R + '700.00 at MRP, more than 10% away']);

    /* --- none of the thirteen was refused; a refusal carries no warning; what was entered without one carries no list */
    eq('13 operations in the log, each warned document with its code, the others with no list', [E.log().length, book.docList.filter(function (x) { return !x.seed; }).map(function (x) { return x.id + (x.warned ? ' ' + x.warned.join() : ''); })],
      [13, ['PROD-U-0001', 'PROD-U-0002 yield_unusual', 'PO-U-0001 rate_far', 'ADJ-U-0001 count_far', 'SO-U-0001', 'INV-U-0001 over_order', 'RCPT-U-0001 over_owed', 'EXP-U-0001 claim_high', 'EXP-U-0002 claim_high', 'XFER-U-0001', 'DAYEND-U-0001 cash_far']]);
    r = refusal('a refused entry returns no warning: the same order, dated tomorrow', 'stores', 'post', { type: 'PO', payload: { date: '2026-03-11', vendorId: 'v_stock', lines: [{ itemId: 'maida', qty: 10, rate: 5000 }] } }, 'future_date', { field: 'date' });
    eq('none', r.warnings, []);

    /* --- never for the seed: the opening entries carry nothing, and the core raises nothing in the seed's name.
       14. a second order of the mess, for the dry runs below */
    so = ok('SO for the dry runs', post('sales', 'SO', { date: T, customerId: 'c_corp', lines: [{ itemId: 'bread', qty: 5 }] })).doc;
    eq('the seeded documents carry no list, and no audit entry of theirs mentions a warning', [book.docList.filter(function (x) { return x.seed; }).length, book.docList.filter(function (x) { return x.seed && 'warned' in x; }).length,
      book.audit.filter(function (a) { return book.docs[a.docId] && book.docs[a.docId].seed && /warning/.test(a.note); }).length], [4, 0, 0]);
    var far = [
      ['prod', 'u_production', 'production', { date: T, itemId: 'bread', mixes: 1, goodUnits: 31 }, 'yield_unusual'],
      ['adj', 'u_stores', 'stores', { date: T, locId: 'fac_rm', reason: 'count', lines: [{ itemId: 'maida', countedQty: 16 }] }, 'count_far'],
      ['inv', 'u_sales', 'sales', { date: T, customerId: 'c_corp', soId: so.id, lines: [{ itemId: 'bread', qty: 6 }] }, 'over_order'],
      ['rcpt', 'u_accounts', 'accounts', { date: T, customerId: 'c_cash', account: 'cash_factory', amount: 10000 }, 'over_owed'],
      ['exp', 'u_store_mgr', 'store_mgr', { kind: 'claim', date: T, categoryId: 'travel', unitId: 'st_vvn', amount: 800000 }, 'claim_high'],
      ['po', 'u_stores', 'stores', { date: T, vendorId: 'v_stock', lines: [{ itemId: 'maida', qty: 10, rate: 5000 }] }, 'rate_far'],
      ['dayend', 'u_store_mgr', 'store_mgr', { date: Y1, storeId: 'st_vvn', lines: [], cash: 500, upi: 0 }, 'cash_far']
    ];
    var before = mark();
    eq('the seven, through the core as a dry run: each raised for a user, by its code (the credit-limit warning rides along on the invoice)', far.map(function (f) {
      var res = E.core[f[0]](f[3], { userId: f[1], role: f[2], at: T + 'T12:00', dryRun: true });
      return [res.ok, codes(res).filter(function (c) { return c !== 'credit_limit'; })];
    }), far.map(function (f) { return [true, [f[4]]]; }));
    eq('and none of them for the seed', far.map(function (f) {
      var res = E.core[f[0]](f[3], { userId: f[1], role: f[2], at: T + 'T12:00', dryRun: true, seed: true });
      return [res.ok, codes(res).filter(function (c) { return c !== 'credit_limit'; })];
    }), far.map(function () { return [true, []]; }));
    eq('a dry run posts nothing', mark(), before);

    /* --- the thresholds are the masters' and nobody else's: another value moves the line, and with none the warning is off.
       The two that compare with a document - the order, what is owed - have no threshold and stay */
    var kept = HB.masters.limits.warn;
    as('stores');
    HB.masters.limits.warn = { rateAwayPct: 50 };
    eq('at 50%: maida at 5000 is within it (5400 is exactly half as much again), 5401 is not, and the sentence says 50%',
      [codes(E.preview('PO', { date: T, vendorId: 'v_stock', lines: [{ itemId: 'maida', qty: 10, rate: 5000 }] })), codes(E.preview('PO', { date: T, vendorId: 'v_stock', lines: [{ itemId: 'maida', qty: 10, rate: 5400 }] })),
        said(E.preview('PO', { date: T, vendorId: 'v_stock', lines: [{ itemId: 'maida', qty: 10, rate: 5401 }] }))],
      [[], [], [['rate_far', 'lines[0].rate', 'Maida: ' + R + '54.01 against the latest purchase price of ' + R + '36.00, more than 50% away']]]);
    delete HB.masters.limits.warn;
    eq('with no thresholds in the masters the five that have one never fire; the two that have none still do', far.map(function (f) {
      return codes(E.core[f[0]](f[3], { userId: f[1], role: f[2], at: T + 'T12:00', dryRun: true })).filter(function (c) { return c !== 'credit_limit'; });
    }), [[], [], ['over_order'], ['over_owed'], [], [], []]);
    HB.masters.limits.warn = kept;
    eq('the engine carries no value of its own: the masters hold a copy of the config\'s', [kept, kept === HB.config.limits.warn], [HB.config.limits.warn, false]);

    /* --- and the copy rebuilds to the same book under another persona: the lists and the audit sentences are part of it */
    var image = bookHash();
    as('production');
    E.boot();
    book = HB.book;
    eq('replayed as the production supervisor: nothing skipped, the same book, the warnings where they were', [E.skipped, E.log().length, bookHash(), book.docs['PO-U-0001'].warned, note('DAYEND-U-0001')],
      [[], 14, image, ['rate_far'], 'Entered with a warning: Cash and UPI come to ' + R + '500.00 against sales of ' + R + '700.00 at MRP, more than 10% away']);
    as('owner');
  });

  /*
   * a.18: one action to cancel a posted dispatch sheet (SCOPE decision 15), on a new copy of the tiny company dated
   * 10 Mar. The sheet of route r1 as prefilled is two invoices: the cash outlet 75550 (collected), the weekly outlet
   * 119100 (on credit) - the arithmetic is in a.4.
   */
  section('a.18 cancelling a dispatch sheet: all or nothing, one reason, one log entry, every figure back, the sheet to post again, by role, replayed', function () {
    var DS = 'DS-r1-260310', sheet, before, d, why = 'the van broke down';
    function ids(list) { return (list || []).map(function (x) { return x.id; }); }
    HB.store.remove('log');
    HB.calendar.set(T);
    E.boot();
    book = HB.book;

    /* 1, 2. PROD: bread 3 mixes, 120 good; puff 1 mix, 100 good */
    ok('PROD bread', post('production', 'PROD', { date: T, itemId: 'bread', mixes: 3, goodUnits: 120 }));
    ok('PROD puff', post('production', 'PROD', { date: T, itemId: 'puff', mixes: 1, goodUnits: 100 }));
    sheet = E.dispatchSheet('r1', T);
    before = snapshot();

    /* 3. the sheet as prefilled: factory cash 5000000 + 75550; the weekly outlet owes 119100; bread 120 - 50, puff 100 - 30 */
    r = ok('the sheet', act('sales', 'postDispatch', { routeId: 'r1', date: T, outlets: sheet.outlets }));
    eq('posted: two invoices', [ids(r.docs), book.cash.balance.cash_factory, book.ar.balance.c_week, E.available('fac_fg', 'bread', T), E.available('fac_fg', 'puff', T), E.dispatchSheet('r1', T).posted],
      [['INV-U-0001', 'INV-U-0002'], 5075550, 119100, 70, 70, true]);

    /* --- all or nothing. 4. accounts receives 19100 in cash against the invoice of the weekly outlet */
    ok('RCPT against the second invoice', post('accounts', 'RCPT', { date: T, customerId: 'c_week', account: 'cash_factory', amount: 19100, allocations: [{ docId: 'INV-U-0002', amount: 19100 }] }));
    r = refusal('has_dependants: one invoice of the sheet has a receipt against it', 'sales', 'cancelDispatch', { sheetId: DS, reason: why }, 'has_dependants', { field: null, docId: 'RCPT-U-0001' });
    eq('the refusal names the invoice and the document that rests on it', r.error.message, 'The sheet cannot be cancelled: INV-U-0002 has a receipt or a credit note against it. Cancel RCPT-U-0001 first');
    eq('and the invoice before it was not cancelled either', [book.docs['INV-U-0001'].status, book.docs['INV-U-0002'].status, book.cash.balance.cash_factory, ids(book.byType.CXL)], ['POSTED', 'POSTED', 5094650, []]);
    as('sales');
    eq('check says the same before anything is asked', (function (c) { return [c.ok, c.error.code, c.error.docId]; })(E.check('cancelDispatch', { sheetId: DS })), [false, 'has_dependants', 'RCPT-U-0001']);

    /* --- by role: as for posting a sheet, sales and the Owner. The right is tested before anything else */
    eq('refused for every other role', ['accounts', 'stores', 'production', 'store_mgr'].map(function (role) {
      as(role);
      var m = mark(), res = E.act('cancelDispatch', { sheetId: DS, reason: why });
      return [res.ok, res.error && res.error.code, /cannot cancel a dispatch sheet: that is for Sales and dispatch or the Owner$/.test(res.error ? res.error.message : ''), JSON.stringify(mark()) === JSON.stringify(m)];
    }), [0, 1, 2, 3].map(function () { return [false, 'role', true, true]; }));
    eq('the session says so too', [HB.session.can('dispatch.cancel', { user: 'u_sales' }).ok, HB.session.can('dispatch.cancel', { user: 'u_owner' }).ok, HB.session.can('dispatch.cancel', { user: 'u_accounts' }).code, HB.session.rolesFor('dispatch.cancel')],
      [true, true, 'role', ['owner', 'sales']]);

    /* 5. the receipt is cancelled: factory cash 5094650 - 19100. Now the sheet can go */
    ok('cancel the receipt', act('accounts', 'cancel', { id: 'RCPT-U-0001', reason: 'received for another outlet' }));
    refusal('invalid_input: a sheet is cancelled with a reason', 'sales', 'cancelDispatch', { sheetId: DS, reason: '  ' }, 'invalid_input', { field: 'reason' });
    as('sales');
    eq('check: it would go through, and says which invoices would be cancelled; nothing is posted by asking', (function (m, c) { return [c.ok, c.preview, c.sheetId, ids(c.targets), c.docs, JSON.stringify(mark()) === JSON.stringify(m)]; })(mark(), E.check('cancelDispatch', { sheetId: DS })),
      [true, true, DS, ['INV-U-0001', 'INV-U-0002'], [], true]);

    /* --- 6. sales cancels the sheet: one operation, one reason, one log entry, one cancellation per invoice */
    r = ok('cancel the sheet', act('sales', 'cancelDispatch', { sheetId: DS, reason: why }));
    eq('the result: the sheet, its cancellations in the order of the invoices, the invoices', [r.sheetId, ids(r.docs), ids(r.targets), r.doc === r.docs[0], r.warnings, r.n], [DS, ['CXL-U-0002', 'CXL-U-0003'], ['INV-U-0001', 'INV-U-0002'], true, [], 6]);
    eq('one log entry, with the ids of both cancellations fixed in it', lastOf(E.log()), { n: 6, at: T + 'T09:06', userId: 'u_sales', role: 'sales', op: 'cancelDispatch', args: { sheetId: DS, reason: why }, out: { ids: ['CXL-U-0002', 'CXL-U-0003'], batchId: null } });
    eq('each cancellation is a document like any other, and knows its sheet', r.docs.map(function (c) { return [c.id, c.type, c.date, c.status, c.targetId, c.targetType, c.reason, c.sheetId, c.createdBy, c.createdAt]; }),
      [['CXL-U-0002', 'CXL', T, 'POSTED', 'INV-U-0001', 'INV', why, DS, 'u_sales', T + 'T09:06'], ['CXL-U-0003', 'CXL', T, 'POSTED', 'INV-U-0002', 'INV', why, DS, 'u_sales', T + 'T09:06']]);
    eq('each invoice is marked with the one reason', ['INV-U-0001', 'INV-U-0002'].map(function (id) { return [book.docs[id].status, book.docs[id].cancelled]; }),
      [['CANCELLED', { by: 'u_sales', at: T + 'T09:06', reason: why, docId: 'CXL-U-0002' }], ['CANCELLED', { by: 'u_sales', at: T + 'T09:06', reason: why, docId: 'CXL-U-0003' }]]);
    eq('and has its entry in the audit trail', book.audit.slice(-2).map(function (a) { return [a.action, a.docId, a.userId, a.role, a.at, a.note, a.before, a.after]; }),
      [['cancel', 'INV-U-0001', 'u_sales', 'sales', T + 'T09:06', why, 'POSTED', 'CANCELLED'], ['cancel', 'INV-U-0002', 'u_sales', 'sales', T + 'T09:06', why, 'POSTED', 'CANCELLED']]);
    /* the cash outlet's invoice wrote 75550 owed, 75550 collected into factory cash, 20 loaves and 10 puffs out: the opposite of each, under the cancellation */
    eq('equal and opposite rows under the id of the cancellation', (function (x) { return [x.cash.map(function (c) { return [c.accountId, c.amount, c.kind, c.reversal]; }), x.ar.map(function (a) { return [a.customerId, a.amount, a.kind, a.reversal]; }),
      x.moves.map(function (m) { return [m.locId, m.itemId, m.batchId, m.qty, m.reversal]; }), x.pnl.map(function (p) { return [p.line, p.channel, p.amount]; })]; })(E.rowsOf('CXL-U-0002')),
    [[['cash_factory', -75550, 'collected', true]], [['c_cash', -75550, 'invoice', true], ['c_cash', 75550, 'collected', true]],
      [['fac_fg', 'bread', 'B-260310-BRD', 20, true], ['fac_fg', 'puff', 'B-260310-PUF', 10, true]], [['sales', 'retail', -75000], ['cogs', 'retail', -27240]]]);
    eq('every figure is back where it was before the sheet was posted: stock by batch, cash, what is owed, sales, cost, GST', snapshot(before.ids).state, before.state);
    eq('for instance', [book.cash.balance.cash_factory, book.ar.balance.c_week, book.ar.total, lots('fac_fg', 'bread')[1], lots('fac_fg', 'puff'), book.pnlMonth['2026-03'].sales.retail], [5000000, 0, 1000000, ['B-260310-BRD', 120, 0], [['B-260310-PUF', 100, 0]], 0]);
    eq('the sheet is to post again, as prefilled', (function (s) { return [s.posted, s.invoiceIds, s.items]; })(E.dispatchSheet('r1', T)), [false, [], sheet.items]);

    /* --- 7. the Owner posts it again; 8. sales cancels one of its invoices alone; 9. the Owner cancels the sheet: the one invoice left */
    r = ok('the Owner posts the sheet again', act('owner', 'postDispatch', { routeId: 'r1', date: T, outlets: sheet.outlets }));
    eq('new invoices, numbered on', ids(r.docs), ['INV-U-0003', 'INV-U-0004']);
    ok('one invoice cancelled alone', act('sales', 'cancel', { id: 'INV-U-0004', reason: 'the outlet was closed' }));
    r = ok('the Owner cancels the sheet', act('owner', 'cancelDispatch', { sheetId: DS, reason: 'posted for the wrong day' }));
    eq('only the invoice that still stood is cancelled, by the Owner', [ids(r.docs), ids(r.targets), r.docs[0].createdBy, lastOf(E.log()).out.ids, lastOf(E.log()).role, book.docs['INV-U-0004'].cancelled.docId],
      [['CXL-U-0005'], ['INV-U-0003'], 'u_owner', ['CXL-U-0005'], 'owner', 'CXL-U-0004']);
    eq('and every figure is back again', snapshot(before.ids).state, before.state);

    /* --- what there is nothing to cancel of */
    refusal('not_found: the sheet is no longer posted', 'sales', 'cancelDispatch', { sheetId: DS, reason: why }, 'not_found', { field: 'sheetId' });
    refusal('not_found: a sheet that was never posted', 'owner', 'cancelDispatch', { sheetId: 'DS-r1-260309', reason: why }, 'not_found', { field: 'sheetId' });
    refusal('invalid_input: no sheet named', 'sales', 'cancelDispatch', { reason: why }, 'invalid_input', { field: 'sheetId' });
    refusal('invalid_input: a sheet id is text', 'sales', 'cancelDispatch', { sheetId: [DS], reason: why }, 'invalid_input', { field: 'sheetId' });
    refusal('not_found: a word that is no sheet is a refusal, not an exception', 'sales', 'cancelDispatch', { sheetId: 'constructor', reason: why }, 'not_found', { field: 'sheetId' });

    /* --- 10. and it posts a third time */
    r = ok('sales posts the sheet a third time', act('sales', 'postDispatch', { routeId: 'r1', date: T, outlets: sheet.outlets }));
    eq('posted', [ids(r.docs), E.dispatchSheet('r1', T).posted, E.log().length], [['INV-U-0005', 'INV-U-0006'], true, 10]);

    /* --- persistence: the same book under another persona, every cancellation under the id its entry gave it */
    var saved = JSON.stringify(E.log()), image = bookHash();
    as('store_mgr');
    E.boot();
    book = HB.book;
    eq('replayed as the store manager: nothing skipped, the same book', [E.skipped, E.log().length, bookHash()], [[], 10, image]);
    eq('the cancellations under their ids', ['CXL-U-0001', 'CXL-U-0002', 'CXL-U-0003', 'CXL-U-0004', 'CXL-U-0005'].map(function (id) { return book.docs[id].targetId; }), ['RCPT-U-0001', 'INV-U-0001', 'INV-U-0002', 'INV-U-0004', 'INV-U-0003']);

    /* a skipped earlier entry. Entry 3, the first posting of the sheet, now names a route that does not exist: it is
       skipped, and so are the receipt against its invoice, the cancellation of that receipt and the cancellation of
       the sheet. Entries 7 to 10 keep their ids */
    var broken = JSON.parse(saved);
    broken[2].args.routeId = 'r_gone';
    HB.store.set('log', broken);
    as('accounts');
    E.boot();
    book = HB.book;
    eq('skipped, never thrown: the sheet and what rested on it', E.skipped.map(function (s) { return [s.n, s.op, s.code]; }), [[3, 'postDispatch', 'invalid_input'], [4, 'post', 'not_found'], [5, 'cancel', 'not_found'], [6, 'cancelDispatch', 'not_found']]);
    eq('their documents are not in the book; the later ones are, under the ids they were given', [['INV-U-0001', 'INV-U-0002', 'RCPT-U-0001', 'CXL-U-0001', 'CXL-U-0002', 'CXL-U-0003'].filter(function (id) { return !!book.docs[id]; }),
      ['INV-U-0003', 'INV-U-0004', 'CXL-U-0004', 'CXL-U-0005', 'INV-U-0005', 'INV-U-0006'].map(function (id) { return book.docs[id] ? book.docs[id].status : 'missing'; }), book.docs['CXL-U-0005'].targetId, book.docs['CXL-U-0005'].createdBy],
    [[], ['CANCELLED', 'CANCELLED', 'POSTED', 'POSTED', 'POSTED', 'POSTED'], 'INV-U-0003', 'u_owner']);

    /* a sheet that is no longer the sheet the entry cancelled. Entry 3 now posts the cash outlet alone: one invoice,
       where entry 6 fixed two cancellation ids. Entry 6 is skipped rather than given an id the log does not hold;
       entry 7 then finds the sheet still posted. Entry 9 fixed one id, for one invoice, and one invoice is what the
       sheet has: it applies, under its own id */
    broken = JSON.parse(saved);
    broken[2].args.outlets = broken[2].args.outlets.slice(0, 1);
    HB.store.set('log', broken);
    E.boot();
    book = HB.book;
    eq('skipped: the cancellation whose ids no longer fit, and what followed from it', E.skipped.map(function (s) { return [s.n, s.op, s.code]; }),
      [[4, 'post', 'not_found'], [5, 'cancel', 'not_found'], [6, 'cancelDispatch', 'wrong_state'], [7, 'postDispatch', 'duplicate'], [8, 'cancel', 'not_found']]);
    eq('no document was made under an id the log does not hold', [book.docList.filter(function (x) { return !x.seed && !/^[A-Z]+-U-\d{4}$/.test(x.id); }).length, book.docs['INV-U-0001'].cancelled.docId, book.docs['CXL-U-0005'].targetId, !!book.docs['CXL-U-0002']], [0, 'CXL-U-0005', 'INV-U-0001', false]);

    /* the saved log again: the same book as before */
    HB.store.set('log', JSON.parse(saved));
    as('owner');
    E.boot();
    book = HB.book;
    eq('the saved log gives the saved book again', [E.skipped, bookHash()], [[], image]);

    /* --- the date rules outlive the sheet. Cancelling is not dated in the past, so a sheet of any day can be cancelled
       (SCOPE 4.9: whoever may post may cancel); whether it can then be posted again is the date rules' to say, and
       E.dateCheck says it beforehand, for the screens. Five days on, 10 Mar is further back than sales may go */
    HB.calendar.set('2026-03-15');
    E.boot();
    book = HB.book;
    function said(res) { return res.ok ? 'ok' : [res.error.code, res.error.field, res.error.message]; }
    as('sales');
    eq('on 15 Mar: 10 Mar is too far back for sales, not for the Owner or accounts; the 12th is not; nobody goes into January or the future',
      [said(E.dateCheck(T)), said(E.dateCheck(T, 'owner')), said(E.dateCheck(T, 'accounts')), said(E.dateCheck('2026-03-12')), said(E.dateCheck('2026-01-31', 'owner')), said(E.dateCheck('2026-03-16', 'owner')), said(E.dateCheck('10 Mar')), said(E.dateCheck(null))],
      [['backdate_limit', 'date', 'This role can go back 3 days at most, to 12 Mar 2026. Accounts and the Owner can enter an earlier date in an open month'], 'ok', 'ok', 'ok',
        ['locked_month', 'date', 'Jan 2026 is a locked month: entries can be dated from 1 Feb 2026'], ['future_date', 'date', 'The date cannot be after the business date, 15 Mar 2026'],
        ['invalid_input', 'date', 'Enter the date as a calendar day'], ['invalid_input', 'date', 'Enter the date as a calendar day']]);
    eq('it is the rule a posting meets: postDispatch for 10 Mar is refused to sales with the same words', said(E.check('postDispatch', { routeId: 'r1', date: T, outlets: sheet.outlets })), said(E.dateCheck(T)));
    as('owner');
    eq('the persona in use is the default', said(E.dateCheck(T)), 'ok');

    /* in May, March is locked: the sheet of 10 Mar (INV-U-0005, INV-U-0006, posted a third time) is still cancelled in one
       action, dated 2 May, every figure back in the books; and nobody, the Owner included, can post it again */
    HB.calendar.set('2026-05-02');
    E.boot();
    book = HB.book;
    as('sales');
    eq('in May no date of March can be entered, by anybody', [said(E.dateCheck(T)), said(E.dateCheck(T, 'owner'))].map(function (x) { return x[0]; }), ['locked_month', 'locked_month']);
    var cash0 = book.cash.balance.cash_factory, owed0 = book.ar.balance.c_week || 0;
    r = ok('a sheet of a locked month is cancelled all the same', act('sales', 'cancelDispatch', { sheetId: DS, reason: 'never left the factory' }));
    eq('dated today: the cash collected goes back out, what the weekly outlet owes, the stock back in its batches', [r.docs.map(function (c) { return [c.targetId, c.date]; }), book.cash.balance.cash_factory, book.ar.balance.c_week || 0, lots('fac_fg', 'bread')[1], lots('fac_fg', 'puff')],
      [[['INV-U-0005', '2026-05-02'], ['INV-U-0006', '2026-05-02']], cash0 - 75550, owed0 - 119100, ['B-260310-BRD', 120, 0], [['B-260310-PUF', 100, 0]]]);
    refusal('locked_month: and it cannot be posted again, not even by the Owner', 'owner', 'postDispatch', { routeId: 'r1', date: T, outlets: sheet.outlets }, 'locked_month', { field: 'date' });

    HB.store.set('log', JSON.parse(saved));
    HB.calendar.set(T);
    as('owner');
    E.boot();
    book = HB.book;
  });
}

/* ============================== part (s): the selectors (js/data/data.js) */
/*
 * The tiny company and the 35 operations of part (a) again, then a dozen more on the same day (things that
 * wait, a back-dated invoice and bill, cancellations) and six on the next business date, after a rebuild. For
 * every selector of HB.data, what it returns is compared with a straight pass that never touches a running
 * balance or an index: over the raw documents - a document that wrote rows counts on its date and, cancelled,
 * once more as its negative on the date of its cancellation (SPEC section 11) - or over the raw ledger rows.
 * A few figures are also typed in from the arithmetic of part (a). Then the views by role. Then, on the same
 * book, the rules two reviews of the selectors found broken, each on the smallest case that shows it (s.5), and
 * what the screens reported (s.6). Last, on a new copy, a warning and a cancelled dispatch sheet as the screens
 * read them (s.7).
 */

var T1 = '2026-03-11';     /* the next business date */

/* Journeys in the shape of HB.config.journeys (SPEC 8.1, docs/API.md 4.21), to see the steps tick from the log. */
var TEST_JOURNEYS = [
  { id: 'bill', title: 'A held bill, approved and paid', steps: [
    { text: 'Enter a bill that fails the three-way check', route: '#/buy/bills', role: 'accounts', match: { op: 'post', type: 'VBILL', test: function (e, docs) { return docs[0].match.ok === false; } } },
    { text: 'Approve it', route: '#/approvals', role: 'owner', match: { op: 'approve', type: 'VBILL' } },
    { text: 'Pay it', route: '#/buy/payments', role: 'accounts', match: { op: 'post', type: 'PAY', test: function (e, docs, env) { return docs[0].allocations.some(function (a) { return env.book.docs[a.docId].type === 'VBILL'; }); } } }
  ], links: [{ text: 'Payables', route: '#/accounts/payables' }] },
  { id: 'store', title: 'Send, confirm, day-end, write-off', steps: [
    { text: 'Send stock to the store', route: '#/stores/transfers', role: 'stores', match: { op: 'post', type: 'XFER', test: function (e, docs) { return docs[0].toStoreId === 'st_vvn'; } } },
    { text: 'Confirm it', route: '#/stores/transfers', role: 'store_mgr', match: { op: 'receiveTransfer', type: 'XFER' } },
    { text: 'Enter the day-end with expired units', route: '#/stores/dayend', role: 'store_mgr', match: { op: 'post', type: 'DAYEND', test: function (e, docs) { return docs[0].lines.some(function (l) { return l.expired > 0; }); } } },
    { text: 'Approve the write-off', route: '#/approvals', role: 'owner', match: { op: 'approve', type: 'WO', test: function (e, docs, env) { var s = env.book.docs[docs[0].sourceDocId]; return !!s && s.type === 'DAYEND'; } } }
  ], links: [] },
  { id: 'damaged', title: 'A write-off for damage, approved', steps: [
    { text: 'Ask for a write-off of damaged stock', route: '#/stock/batches', role: 'stores', match: { op: 'post', type: 'WO', test: function (e, docs) { return docs[0].reason === 'damaged'; } } },
    { text: 'Approve it', route: '#/approvals', role: 'owner', match: { op: 'approve', type: 'WO' } }
  ], links: [] },
  { id: 'order', title: 'A deposit, then an order', steps: [
    { text: 'Deposit cash', route: '#/accounts/cash', role: 'accounts', match: { op: 'post', type: 'DEP' } },
    { text: 'Raise an order', route: '#/buy/orders', role: 'stores', match: { op: 'post', type: 'PO' } }
  ], links: [] }
];

/** The 35 operations of part (a), sections a.2 to a.8, without their assertions. Returns the documents by name. */
function handWorked() {
  var E = HB.engine, x = {}, r;
  function go(label, res) { return ok(label, res); }
  x.po = go('1 PO', post('stores', 'PO', { date: T, vendorId: 'v_stock', expectedDate: '2026-03-12', lines: [{ itemId: 'maida', qty: 500, rate: 3800 }, { itemId: 'fat', qty: 20, rate: 12500 }] })).doc;
  x.grn1 = go('2 GRN', post('stores', 'GRN', { date: T, poId: x.po.id, lines: [{ itemId: 'maida', qty: 300, rejectedQty: 10 }, { itemId: 'fat', qty: 20 }] })).doc;
  x.grn2 = go('3 GRN', post('stores', 'GRN', { date: T, poId: x.po.id, lines: [{ itemId: 'maida', qty: 200 }] })).doc;
  x.bill = go('4 VBILL', post('accounts', 'VBILL', { date: T, vendorId: 'v_stock', billNo: 'CF/501', grnIds: [x.grn1.id, x.grn2.id], lines: [{ itemId: 'maida', qty: 500, rate: 3800 }, { itemId: 'fat', qty: 20, rate: 13000 }] })).doc;
  go('5 approve', act('owner', 'approve', { id: x.bill.id }));
  x.pay1 = go('6 PAY', post('accounts', 'PAY', { date: T, payeeType: 'vendor', payeeId: 'v_stock', account: 'bank', amount: 3000000, ref: 'NEFT 4471', allocations: [{ docId: 'VBILL-260101-001', amount: 2000000 }, { docId: x.bill.id, amount: 1000000 }] })).doc;
  x.prodBread = go('7 PROD', post('production', 'PROD', { date: Y1, itemId: 'bread', mixes: 3, goodUnits: 117, rejectedUnits: 3 })).doc;
  x.prodPuff = go('8 PROD', post('production', 'PROD', { date: Y1, itemId: 'puff', mixes: 1, goodUnits: 100 })).doc;
  r = go('9 sheet', act('sales', 'postDispatch', { routeId: 'r1', date: T, outlets: E.dispatchSheet('r1', T).outlets }));
  x.inv1 = r.docs[0]; x.inv2 = r.docs[1];
  x.so = go('10 SO', post('sales', 'SO', { date: T, customerId: 'c_corp', deliveryDate: T, poRef: 'HM/77', lines: [{ itemId: 'bread', qty: 15 }] })).doc;
  x.inv3 = go('11 INV', post('sales', 'INV', { date: T, customerId: 'c_corp', soId: x.so.id })).doc;
  x.xfer = go('12 XFER', post('stores', 'XFER', { date: T, toStoreId: 'st_vvn', lines: [{ itemId: 'bread', qty: 20 }, { itemId: 'puff', qty: 50 }] })).doc;
  go('13 receive', act('store_mgr', 'receiveTransfer', { id: x.xfer.id }));
  r = go('14 DAYEND', post('store_mgr', 'DAYEND', { date: T, storeId: 'st_vvn', lines: [{ itemId: 'bread', sold: 12, expired: 0 }, { itemId: 'puff', sold: 40, expired: 10 }], cash: 70000, upi: 37500 }));
  x.dayEnd = r.doc; x.wo1 = r.docs[1];
  go('15 approve', act('owner', 'approve', { id: x.wo1.id }));
  x.rcpt1 = go('16 RCPT', post('accounts', 'RCPT', { date: T, customerId: 'c_corp', account: 'bank', amount: 1200000, mode: 'neft', allocations: [{ docId: 'INV-260101-001', amount: 1000000 }, { docId: x.inv3.id, amount: 45000 }] })).doc;
  x.cn = go('17 CN', post('sales', 'CN', { date: T, customerId: 'c_cash', lines: [{ itemId: 'bread', qty: 3 }] })).doc;
  go('18 approve', act('owner', 'approve', { id: x.cn.id }));
  x.inv4 = go('19 INV', post('sales', 'INV', { date: T, customerId: 'c_cash', lines: [{ itemId: 'bread', qty: 5 }] })).doc;
  x.wo2 = go('20 WO', post('stores', 'WO', { date: T, locId: 'fac_fg', reason: 'expired', lines: [{ itemId: 'bread', batchId: 'B-251231-BRD', qty: 60 }] })).doc;
  go('21 approve', act('owner', 'approve', { id: x.wo2.id }));
  x.adj = go('22 ADJ', post('stores', 'ADJ', { date: T, locId: 'fac_rm', reason: 'weekly count', lines: [{ itemId: 'maida', countedQty: 664 }, { itemId: 'bag', countedQty: 785 }] })).doc;
  go('23 approve', act('owner', 'approve', { id: x.adj.id }));
  x.claim = go('24 claim', post('store_mgr', 'EXP', { kind: 'claim', date: T, categoryId: 'travel', unitId: 'st_vvn', amount: 35000, billRef: 'auto fare' })).doc;
  go('25 approve', act('owner', 'approve', { id: x.claim.id }));
  x.pay2 = go('26 PAY', post('accounts', 'PAY', { date: T, payeeType: 'employee', payeeId: 'E004', account: 'cash_factory', allocations: [{ docId: x.claim.id, amount: 35000 }] })).doc;
  x.sal = go('27 salary', post('accounts', 'EXP', { kind: 'salary', monthKey: '2026-02' })).doc;
  go('28 approve', act('owner', 'approve', { id: x.sal.id }));
  x.pay3 = go('29 PAY', post('accounts', 'PAY', { date: T, payeeType: 'vendor', payeeId: 'v_staff', account: 'bank', allocations: [{ docId: x.sal.id, amount: 10900000 }] })).doc;
  x.dep1 = go('30 DEP', post('accounts', 'DEP', { date: T, fromAccount: 'cash_factory', amount: 100000, slipRef: 'S-11' })).doc;
  x.dep2 = go('31 DEP', post('store_mgr', 'DEP', { date: T, fromAccount: 'cash_st_vvn', amount: 50000, slipRef: 'S-12' })).doc;
  x.ebill = go('32 bill', post('accounts', 'EXP', { kind: 'bill', date: T, payeeId: 'v_power', categoryId: 'electricity', unitId: 'factory', amount: 1000000, gstRate: 18, billRef: 'MG/5521' })).doc;
  go('33 approve', act('owner', 'approve', { id: x.ebill.id }));
  x.rcpt2 = go('34 RCPT', post('sales', 'RCPT', { date: T, customerId: 'c_week', account: 'cash_factory', amount: 100000, allocations: [{ docId: x.inv2.id, amount: 100000 }] })).doc;
  x.cxl = go('35 cancel', act('accounts', 'cancel', { id: x.rcpt2.id, reason: 'entered against the wrong outlet' })).doc;
  return x;
}

/* ----- the straight pass */

function addTo(map, key, n) { map[key] = (map[key] || 0) + n; }
function cellOf(map, key, make) { return map[key] || (map[key] = make()); }

/** Every document that wrote rows: once on its date and, cancelled, once more as its negative on the date of the cancellation. */
function postings() {
  var out = [];
  HB.book.docList.forEach(function (d) {
    if (d.type === 'CXL') return;
    var r = HB.engine.rowsOf(d.id);
    if (!(r.moves.length + r.ar.length + r.ap.length + r.cash.length + r.pnl.length + r.gst.length)) return;
    out.push({ date: d.date, sign: 1, doc: d });
    if (d.cancelled) out.push({ date: HB.book.docs[d.cancelled.docId].date, sign: -1, doc: d });
  });
  return out;
}

/** What flowed between two dates, from the documents alone. */
function straightFlows(from, to) {
  var out = { sales: {}, items: {}, customers: {}, collections: 0, register: { units: 0, taxable: 0, gst: 0, total: 0 }, returns: { units: 0, taxable: 0 },
    purchases: { taxable: 0, gst: 0, total: 0 }, production: {}, gst: {}, expenses: {} };
  function ch(k) { return cellOf(out.sales, k, function () { return { sales: 0, returns: 0, cogs: 0, units: 0, returnUnits: 0 }; }); }
  function item(k) { return cellOf(out.items, k, function () { return { units: 0, sales: 0, cogs: 0, returnUnits: 0, returns: 0 }; }); }
  function tax(dir, rate, taxable, cgst, sgst) {
    var t = cellOf(out.gst, dir + ' ' + rate, function () { return { taxable: 0, cgst: 0, sgst: 0 }; });
    t.taxable += taxable; t.cgst += cgst; t.sgst += sgst;
  }
  function reg(units, taxable, gst, total) { out.register.units += units; out.register.taxable += taxable; out.register.gst += gst; out.register.total += total; }
  postings().forEach(function (p) {
    if (p.date < from || p.date > to) return;
    var d = p.doc, s = p.sign, c;
    switch (d.type) {
      case 'INV':
        if (d.opening) return;
        c = ch(d.channel); c.sales += s * d.taxable; c.cogs += s * d.cost; c.units += s * d.units;
        d.lines.forEach(function (l) { var i = item(l.itemId); i.units += s * l.qty; i.sales += s * l.taxable; i.cogs += s * l.cost; tax('output', l.gstRate, s * l.taxable, s * l.cgst, s * l.sgst); });
        addTo(out.customers, d.customerId, s * d.taxable);
        out.collections += s * d.paidNow;
        reg(s * d.units, s * d.taxable, s * d.gst, s * d.total);
        break;
      case 'DAYEND':
        c = ch('store'); c.sales += s * d.taxable; c.cogs += s * d.cost; c.units += s * d.units;
        d.lines.forEach(function (l) { var i = item(l.itemId); i.units += s * l.sold; i.sales += s * l.taxable; i.cogs += s * l.cost; tax('output', l.gstRate, s * l.taxable, s * l.cgst, s * l.sgst); });
        addTo(out.customers, 'store:' + d.storeId, s * d.taxable);
        reg(s * d.units, s * d.taxable, s * d.gst, s * d.gross);
        addTo(out.expenses, 'cash_short|' + d.storeId, -s * d.shortExcess);
        break;
      case 'CN':
        c = ch(d.channel); c.returns -= s * d.taxable; c.returnUnits += s * d.units;
        d.lines.forEach(function (l) { var i = item(l.itemId); i.returnUnits += s * l.qty; i.returns -= s * l.taxable; tax('output', l.gstRate, -s * l.taxable, -s * l.cgst, -s * l.sgst); });
        addTo(out.customers, d.customerId, -s * d.taxable);
        reg(-s * d.units, -s * d.taxable, -s * d.gst, -s * d.total);
        out.returns.units += s * d.units; out.returns.taxable += s * d.taxable;
        break;
      case 'RCPT': out.collections += s * d.amount; break;
      case 'VBILL':
        if (d.opening) return;
        out.purchases.taxable += s * d.taxable; out.purchases.gst += s * d.gst; out.purchases.total += s * d.total;
        d.lines.forEach(function (l) { tax('input', l.gstRate, s * l.taxable, s * l.cgst, s * l.sgst); });
        break;
      case 'EXP':
        if (d.gst > 0) tax('input', d.gstRate, s * d.amount, s * d.cgst, s * d.sgst);
        if (d.kind === 'salary') d.lines.forEach(function (l) { addTo(out.expenses, d.categoryId + '|' + l.unitId, s * l.amount); });
        else addTo(out.expenses, d.categoryId + '|' + d.unitId, s * d.amount);
        break;
      case 'PROD':
        c = cellOf(out.production, d.itemId, function () { return { runs: 0, mixes: 0, expected: 0, good: 0, rejected: 0, loss: 0 }; });
        c.runs += s; c.mixes += s * d.mixes; c.expected += s * d.expectedUnits; c.good += s * d.goodUnits; c.rejected += s * d.rejectedUnits; c.loss += s * d.lossValue;
        break;
    }
  });
  return plain(prune(out)) || {};
}

/** The same figures, from the selectors. */
function selectedFlows(from, to) {
  var S = HB.data, f = { from: from, to: to }, out = { sales: {}, items: {}, customers: {}, production: {}, gst: {}, expenses: {} };
  var sum = S.sell.summary(f), reg = S.sell.register(f), ret = S.sell.returns(f), pur = S.buy.register(f), g = S.gst.summary(f);
  sum.byChannel.forEach(function (x) { out.sales[x.channel] = { sales: x.sales, returns: x.returns, cogs: x.cogs, units: x.units, returnUnits: x.returnUnits }; });
  S.sell.by('item', f).rows.forEach(function (x) { out.items[x.key] = { units: x.units, sales: x.sales, cogs: x.cogs, returnUnits: x.returnUnits, returns: x.returns }; });
  S.sell.by('customer', f).rows.forEach(function (x) { out.customers[x.key] = x.net; });
  out.collections = sum.collections.total;
  out.register = { units: reg.totals.units, taxable: reg.totals.taxable, gst: reg.totals.gst, total: reg.totals.total };
  out.returns = { units: ret.totals.units, taxable: ret.totals.taxable };
  out.purchases = { taxable: pur.totals.taxable, gst: pur.totals.gst, total: pur.totals.total };
  S.make.yieldByItem(f).rows.forEach(function (x) { out.production[x.itemId] = { runs: x.runs, mixes: x.mixes, expected: x.expectedUnits, good: x.goodUnits, rejected: x.rejectedUnits, loss: x.lossValue }; });
  g.output.forEach(function (x) { out.gst['output ' + x.gstRate] = { taxable: x.taxable, cgst: x.cgst, sgst: x.sgst }; });
  g.input.forEach(function (x) { out.gst['input ' + x.gstRate] = { taxable: x.taxable, cgst: x.cgst, sgst: x.sgst }; });
  S.exp.byCategory(f).rows.forEach(function (x) { Object.keys(x.byUnit).forEach(function (u) { out.expenses[x.categoryId + '|' + u] = x.byUnit[u]; }); });
  return plain(prune(out)) || {};
}

/** The P&L by month, from the documents alone. */
function straightPnl() {
  var out = {};
  function m(date) { return cellOf(out, date.slice(0, 7), function () { return { netSales: 0, cogs: 0, prodLoss: 0, writeoff: 0, countDiff: 0, expenses: 0 }; }); }
  postings().forEach(function (p) {
    var d = p.doc, s = p.sign, x = m(p.date);
    if (d.type === 'INV' && !d.opening) { x.netSales += s * d.taxable; x.cogs += s * d.cost; }
    else if (d.type === 'DAYEND') { x.netSales += s * d.taxable; x.cogs += s * d.cost; x.expenses -= s * d.shortExcess; }
    else if (d.type === 'CN') x.netSales -= s * d.taxable;
    else if (d.type === 'PROD') x.prodLoss += s * d.lossValue;
    else if (d.type === 'WO') x.writeoff += s * d.value;
    else if (d.type === 'ADJ') x.countDiff -= s * d.value;
    else if (d.type === 'EXP') x.expenses += s * d.amount;
  });
  Object.keys(out).forEach(function (k) { var x = out[k]; x.profit = x.netSales - x.cogs - x.prodLoss - x.writeoff - x.countDiff - x.expenses; });
  return plain(prune(out)) || {};
}

function selectedPnl() {
  var out = {};
  HB.data.pnl.months().forEach(function (x) {
    out[x.monthKey] = { netSales: x.netSales, cogs: x.cogs, prodLoss: x.prodLoss, writeoff: x.writeoff, countDiff: x.countDiff, expenses: x.expenses, profit: x.operatingProfit };
  });
  return plain(prune(out)) || {};
}

/** What stands now: cash, receivables, payables, stock, open documents - from the ledger rows and the documents alone. */
function straightBalances() {
  var b = HB.book, out = { cash: {}, ar: {}, ap: {}, stock: {}, batches: {}, open: {}, credit: {}, apOpen: {} };
  var received = {}, credited = {}, paid = {};
  b.cash.entries.forEach(function (x) { addTo(out.cash, x.accountId, x.amount); });
  /* SPEC section 11: receivables = invoices - cash collected with them - receipts - credit notes; payables likewise */
  postings().forEach(function (p) {
    var d = p.doc, s = p.sign;
    if (d.type === 'INV') addTo(out.ar, d.customerId, s * (d.total - d.paidNow));
    else if (d.type === 'RCPT') addTo(out.ar, d.customerId, -s * d.amount);
    else if (d.type === 'CN') addTo(out.ar, d.customerId, -s * d.total);
    else if (d.type === 'VBILL') addTo(out.ap, 'vendor:' + d.vendorId, s * d.total);
    else if (d.type === 'EXP') addTo(out.ap, d.payeeType + ':' + d.payeeId, s * d.total);
    else if (d.type === 'PAY') addTo(out.ap, d.payeeType + ':' + d.payeeId, -s * d.amount);
  });
  b.moves.forEach(function (m) {
    out.stock[m.locId + '|' + m.itemId] = HB.q3((out.stock[m.locId + '|' + m.itemId] || 0) + m.qty);
    if (m.batchId) addTo(out.batches, m.locId + '|' + m.batchId, m.qty);
  });
  /* open amounts document by document: what standing receipts, credit notes and payments have settled is taken off */
  b.docList.forEach(function (d) {
    if (d.status !== 'POSTED' || !d.allocations) return;
    d.allocations.forEach(function (a) { addTo(d.type === 'RCPT' ? received : (d.type === 'CN' ? credited : paid), a.docId, a.amount); });
  });
  b.docList.forEach(function (d) {
    if (d.type === 'INV' && d.status === 'POSTED') {
      out.open[d.id] = d.total - d.creditApplied - d.paidNow - (received[d.id] || 0) - (credited[d.id] || 0);
      addTo(out.credit, d.customerId, -d.creditApplied);
    }
    if (d.status === 'POSTED' && (d.type === 'RCPT' || d.type === 'CN')) addTo(out.credit, d.customerId, d.onAccount);
    if ((d.type === 'VBILL' && d.status === 'POSTED') || (d.type === 'EXP' && (d.status === 'APPROVED' || d.status === 'PAID'))) out.apOpen[d.id] = d.total - (paid[d.id] || 0);
  });
  return plain(prune(out)) || {};
}

function selectedBalances() {
  var S = HB.data, out = { cash: {}, ar: {}, ap: {}, stock: {}, batches: {}, open: {}, credit: {}, apOpen: {} };
  S.cash.balances().rows.forEach(function (x) { out.cash[x.accountId] = x.balance; });
  S.ar.balances().rows.forEach(function (x) { out.ar[x.customerId] = x.balance; out.credit[x.customerId] = x.credit; });
  S.ar.openInvoices().forEach(function (x) { out.open[x.id] = x.open; });
  S.ap.balances().rows.forEach(function (x) { out.ap['vendor:' + x.vendorId] = x.balance; });
  HB.masters.vendors.forEach(function (v) { S.ap.openItems('vendor', v.id).forEach(function (x) { out.apOpen[x.id] = x.open; }); });
  S.ap.toReimburse().forEach(function (x) { addTo(out.ap, 'employee:' + x.employeeId, x.open); out.apOpen[x.id] = x.open; });
  S.stock.onHand().forEach(function (x) { out.stock[x.locId + '|' + x.itemId] = x.qty; });
  S.stock.batches().forEach(function (x) { out.batches[x.locId + '|' + x.batchId] = x.qty; });
  return plain(prune(out)) || {};
}

/** Opening, in, out and closing of the rows of a ledger that pass `pick`, for a range: a plain loop over the whole ledger. */
function straightLedger(rows, pick, from, to, field) {
  var x = { opening: 0, 'in': 0, out: 0, closing: 0, count: 0 };
  rows.forEach(function (r) {
    if (!pick(r)) return;
    var v = r[field];
    if (r.date < from) x.opening = HB.q3(x.opening + v);
    else if (r.date <= to) { x.count++; if (v > 0) x['in'] = HB.q3(x['in'] + v); else x.out = HB.q3(x.out - v); }
  });
  x.closing = HB.q3(x.opening + x['in'] - x.out);
  return x;
}

/** Every selector against the straight pass, as the Owner, for the ranges given. */
function reconcile(label, ranges) {
  var S = HB.data, b = HB.book, E = HB.engine, M = HB.masters, today = HB.calendar.today, go = HB.calendar.goLive;
  as('owner');
  ranges.forEach(function (r) {
    var tag = label + ' ' + r[0] + '..' + r[1] + ': ', f = { from: r[0], to: r[1] };
    eq(tag + 'sales, items, customers, collections, registers, production, GST and spend', selectedFlows(r[0], r[1]), straightFlows(r[0], r[1]));
    /* whatever the dimension, the rows add up to the summary, and the register to P&L sales net of returns */
    var sum = S.sell.summary(f), net = 0;
    b.pnl.forEach(function (x) { if ((x.line === 'sales' || x.line === 'returns') && x.date >= r[0] && x.date <= r[1]) net += x.amount; });
    eq(tag + 'every dimension adds up to the summary', ['item', 'customer', 'route', 'channel', 'unit', 'day', 'month'].map(function (dim) {
      var x = S.sell.by(dim, f);
      return [x.totals.net, x.totals.cogs, x.totals.units, x.rows.reduce(function (s, g) { return s + g.net; }, 0)];
    }), [0, 1, 2, 3, 4, 5, 6].map(function () { return [sum.net, sum.cogs, sum.units, sum.net]; }));
    eq(tag + 'the register is P&L sales net of returns, row by row', (function (x) { return [x.totals.taxable, x.rows.reduce(function (s, row) { return s + row.taxable; }, 0), x.rows.reduce(function (s, row) { return s + row.total; }, 0)]; })(S.sell.register(f)), [net, net, S.sell.register(f).totals.total]);
    eq(tag + 'margin by item and by channel are the same sales', [S.margin.byItem(f).totals.margin, S.margin.byChannel(f).totals.margin, S.margin.byItem(f).rows.length], [sum.margin, sum.margin, S.sell.by('item', f).rows.length]);
    /* stock: the statement and the ledger against the raw movement rows */
    var want = {}, got = {};
    b.moves.forEach(function (m) { want[m.locId + '|' + m.itemId] = 1; });
    Object.keys(want).forEach(function (k) {
      var x = straightLedger(b.moves, function (m) { return m.locId + '|' + m.itemId === k; }, r[0], r[1], 'qty');
      want[k] = [x.opening, x['in'], x.out, x.closing];
    });
    S.stock.statement(f).rows.forEach(function (x) { got[x.locId + '|' + x.itemId] = [x.opening, x.qtyIn, x.qtyOut, x.closing]; });
    Object.keys(want).forEach(function (k) { if (!got[k] && want[k].join() === '0,0,0,0') delete want[k]; });
    eq(tag + 'stock statement: opening, in, out and closing per location and item', got, want);
    var all = straightLedger(b.moves, function () { return true; }, r[0], r[1], 'qty'), led = S.stock.ledger(f);
    eq(tag + 'stock ledger: every row of the range', [led.count, led.rows.length, led.qtyIn, led.qtyOut, led.truncated], [all.count, all.count, all['in'], all.out, false]);
    var one = straightLedger(b.moves, function (m) { return m.locId === 'fac_rm' && m.itemId === 'maida'; }, r[0], r[1], 'qty');
    led = S.stock.ledger({ from: r[0], to: r[1], locId: 'fac_rm', itemId: 'maida' });
    eq(tag + 'stock ledger of maida in the raw store: the running balance', [led.opening, led.closing, led.count, led.rows.length ? lastOf(led.rows).balance : led.opening], [one.opening, one.closing, one.count, one.closing]);
    /* the cash books and the statements of account */
    M.accounts.forEach(function (a) {
      var x = straightLedger(b.cash.entries, function (c) { return c.accountId === a.id; }, r[0], r[1], 'amount'), bk = S.cash.book(a.id, f);
      eq(tag + 'cash book of ' + a.id, [bk.opening, bk.totalIn, bk.totalOut, bk.closing, bk.rows.length, bk.rows.length ? lastOf(bk.rows).balance : bk.opening], [x.opening, x['in'], x.out, x.closing, x.count, x.closing]);
    });
    var posts = postings();
    M.customers.forEach(function (c) {
      var x = straightLedger(b.ar.entries, function (e) { return e.customerId === c.id; }, r[0], r[1], 'amount'), st = S.ar.statement(c.id, f);
      eq(tag + 'statement of ' + c.id, [st.opening, st.debit, st.credit, st.closing, st.rows.length], [x.opening, x['in'], x.out, x.closing, x.count]);
      /* what was invoiced and what was paid or credited, from the documents: a cancelled one counts on its date and
         as its negative on the date of its cancellation, so one posted and cancelled in the range is in neither */
      var y = { invoiced: 0, settled: 0 };
      posts.forEach(function (p) {
        var d = p.doc, s = p.sign;
        if (d.customerId !== c.id || p.date < r[0] || p.date > r[1]) return;
        if (d.type === 'INV') { y.invoiced += s * d.total; y.settled += s * d.paidNow; }
        else if (d.type === 'RCPT') y.settled += s * d.amount;
        else if (d.type === 'CN') y.settled += s * d.total;
      });
      eq(tag + 'statement of ' + c.id + ': invoiced and settled from the documents, each the sum of its column, and the balance they leave',
        [st.invoiced, st.settled, st.rows.reduce(function (n, q) { return n + q.invoiced; }, 0), st.rows.reduce(function (n, q) { return n + q.settled; }, 0), st.opening + st.invoiced - st.settled],
        [y.invoiced, y.settled, y.invoiced, y.settled, st.closing]);
    });
    /* a product, customer, route or unit whose rows cancel out in the range is not listed with zeros (as a GST rate is not) */
    function blank(g) { return !(g.units || g.sales || g.returns || g.returnUnits || g.cogs); }
    eq(tag + 'no product, customer, route or unit with nothing in it is listed, nor a margin row', ['item', 'customer', 'route', 'unit'].map(function (dim) { return S.sell.by(dim, f).rows.filter(blank).length; }).concat([S.margin.byItem(f).rows.filter(blank).length]),
      [0, 0, 0, 0, 0]);
    /* document lists: every document of the type dated in the range, newest first */
    function ids(type) { return b.docList.filter(function (d) { return d.type === type && d.date >= r[0] && d.date <= r[1]; }).sort(function (x, y) { return x.date === y.date ? y.seq - x.seq : (x.date < y.date ? 1 : -1); }).map(function (d) { return d.id; }); }
    function listed(rows) { return rows.map(function (x) { return x.id; }); }
    eq(tag + 'document lists', [listed(S.buy.orders(f)), listed(S.buy.receipts(f)), listed(S.buy.bills(f)), listed(S.buy.payments(f)), listed(S.make.entries(f)), listed(S.sell.invoices(f)), listed(S.sell.orders(f)),
      listed(S.sell.creditNotes(f)), listed(S.sell.receipts(f)), listed(S.stores.transfers(f)), listed(S.stores.dayEnds(f)), listed(S.exp.list(f))],
    ['PO', 'GRN', 'VBILL', 'PAY', 'PROD', 'INV', 'SO', 'CN', 'RCPT', 'XFER', 'DAYEND', 'EXP'].map(ids));
    eq(tag + 'a cancelled document is in its list, under its status', S.sell.receipts(f).filter(function (x) { return x.cancelled; }).map(function (x) { return x.id; }), b.byType.RCPT.filter(function (d) { return d.status === 'CANCELLED' && d.date >= r[0] && d.date <= r[1]; }).map(function (d) { return d.id; }).reverse());
    /* the production register and the audit log by date */
    eq(tag + 'production register adds up to the yield', (function (x) { return [x.totals.goodUnits, x.totals.expectedUnits, x.totals.lossValue, x.rows.reduce(function (s, row) { return s + row.lossValue; }, 0)]; })(S.make.register(f)),
      (function (y) { return [y.totals.goodUnits, y.totals.expectedUnits, y.totals.lossValue, y.totals.lossValue]; })(S.make.yieldByItem(f)));
    eq(tag + 'audit log', [S.audit.list(f).count, S.audit.list(f).rows.length], (function (n) { return [n, n]; })(b.audit.filter(function (a) { return a.at.slice(0, 10) >= r[0] && a.at.slice(0, 10) <= r[1]; }).length));
  });

  /* ----- what stands now */
  eq(label + ': cash, customer and payee balances, open documents, credit, stock and batches', selectedBalances(), straightBalances());
  eq(label + ': P&L month by month', selectedPnl(), straightPnl());
  var months = {};
  b.pnl.forEach(function (x) {
    var m = cellOf(months, x.date.slice(0, 7), function () { return {}; });
    addTo(m, x.line === 'expense' ? 'expense.' + x.categoryId : (x.line === 'sales' || x.line === 'returns' ? 'netSales.' + x.channel : x.line), x.amount);
    if (x.line === 'returns') addTo(m, 'returns', x.amount);
  });
  eq(label + ': every line of every month is the sum of its ledger rows, and of pnl.entries', Object.keys(months).sort().map(function (mk) {
    var p = S.pnl.month(mk), bad = [];
    p.lines.forEach(function (l) {
      if (!l.drill) return;
      var rows = S.pnl.entries(l.drill).reduce(function (s, e) { return s + e.amount; }, 0);
      if (rows !== l.amount) bad.push(l.key + ' drill ' + rows + ' line ' + l.amount);
      if (months[mk][l.key] !== undefined && months[mk][l.key] !== l.amount) bad.push(l.key + ' ledger ' + months[mk][l.key] + ' line ' + l.amount);
    });
    return bad;
  }), Object.keys(months).map(function () { return []; }));

  /* receivables: balance = open - credit, the buckets add up to what is open, each invoice in the bucket of its due date */
  var late = function (due) { var n = due < today ? HB.dates.diffDays(due, today) : 0; return n <= 0 ? 'notDue' : (n <= 15 ? 'd1_15' : (n <= 30 ? 'd16_30' : (n <= 60 ? 'd31_60' : 'd60p'))); };
  var buckets = {}, apBuckets = {}, sb = straightBalances();
  Object.keys(sb.open || {}).forEach(function (id) { var d = b.docs[id]; addTo(cellOf(buckets, d.customerId, function () { return {}; }), late(d.dueDate), sb.open[id]); });
  Object.keys(sb.apOpen || {}).forEach(function (id) { var d = b.docs[id]; if (d.type === 'VBILL' || d.payeeType === 'vendor') addTo(cellOf(apBuckets, d.vendorId || d.payeeId, function () { return {}; }), late(d.dueDate), sb.apOpen[id]); });
  function aged(x, idKey) {
    var out = {};
    x.rows.forEach(function (row) { var t = {}; x.buckets.forEach(function (k) { if (row[k.key]) t[k.key] = row[k.key]; }); if (Object.keys(t).length) out[row[idKey]] = t; });
    return out;
  }
  eq(label + ': receivables ageing by due date', aged(S.ar.ageing(), 'customerId'), buckets);
  eq(label + ': payables ageing by due date', aged(S.ap.ageing(), 'vendorId'), apBuckets);
  eq(label + ': a customer\'s balance is its open invoices less its unapplied credit, and the totals add up', S.ar.balances().rows.filter(function (x) { return x.balance !== x.open - x.credit; }).length +
    (S.ar.balances().totals.balance === b.ar.entries.reduce(function (s, x) { return s + x.amount; }, 0) ? 0 : 1) + (S.ap.balances().totals.balance + S.ap.toReimburse().reduce(function (s, x) { return s + x.open; }, 0) === b.ap.entries.reduce(function (s, x) { return s + x.amount; }, 0) ? 0 : 1), 0);
  var soon = HB.dates.addDays(today, M.limits.dueSoonDays);
  eq(label + ': bills due within the week, soonest first; claims to reimburse', [S.ap.dueWithin().map(function (x) { return x.id; }), S.ap.toReimburse().map(function (x) { return x.id; })],
    [Object.keys(sb.apOpen || {}).filter(function (id) { var d = b.docs[id]; return (d.type === 'VBILL' || d.payeeType === 'vendor') && d.dueDate <= soon; }).sort(function (x, y) { return b.docs[x].dueDate === b.docs[y].dueDate ? b.docs[x].seq - b.docs[y].seq : (b.docs[x].dueDate < b.docs[y].dueDate ? -1 : 1); }),
      Object.keys(sb.apOpen || {}).filter(function (id) { return b.docs[id].payeeType === 'employee'; })]);

  /* stock: value at today's cost, what is low, what is about to expire */
  var value = 0, low = [], nearUntil = HB.dates.addDays(today, M.limits.nearExpiryDays), expiring = {};
  Object.keys(sb.stock || {}).forEach(function (k) { value += HB.money.amount(sb.stock[k], E.unitCost(k.split('|')[1])); });
  M.items.forEach(function (it) {
    if (it.kind === 'fg' || !(it.reorderLevel > 0)) return;
    var held = 0;
    b.docList.forEach(function (d) { if (d.type === 'WO' && d.status === 'PENDING' && d.locId === 'fac_rm') d.lines.forEach(function (l) { if (l.itemId === it.id) held += l.qty; }); });
    if (HB.q3(((sb.stock || {})['fac_rm|' + it.id] || 0) - held) <= it.reorderLevel) low.push(it.id);
  });
  Object.keys(sb.batches || {}).forEach(function (k) { var id = k.split('|')[1]; if (b.batches[id].bestBefore <= nearUntil) expiring[k] = [sb.batches[k], b.batches[id].bestBefore < today ? 'expired' : 'near']; });
  eq(label + ': stock value, low stock, expiring batches', [S.stock.value().total, S.stock.value().rows.reduce(function (s, x) { return s + x.value; }, 0), S.stock.lowStock().map(function (x) { return x.itemId; }),
    (function (o) { S.stock.expiring().forEach(function (x) { o[x.locId + '|' + x.batchId] = [x.qty, x.flag]; }); return o; })({})], [value, value, low, expiring]);
  eq(label + ': the cost sheet and the recipes carry the unit cost of the engine', [S.make.costSheet('bread').unitCost, S.make.costSheet('bread').channels.map(function (c) { return [c.channel, c.price, c.margin]; }), S.make.recipes().map(function (x) { return [x.itemId, x.unitCost]; })],
    [E.unitCost('bread'), [['retail', 3200, HB.q3(3200 - E.unitCost('bread'))], ['corporate', 3000, HB.q3(3000 - E.unitCost('bread'))], ['store', 4000, HB.q3(4000 - E.unitCost('bread'))]], [['bread', E.unitCost('bread')], ['puff', E.unitCost('puff')]]]);

  /* to do and waiting: straight filters over the documents */
  var waiting = b.docList.filter(function (d) { return d.status === 'PENDING' || d.status === 'HELD'; }).map(function (d) { return d.id; });
  var due = b.byType.PO.filter(function (d) { return (d.status === 'APPROVED' || d.status === 'PART_RECEIVED') && d.expectedDate <= today; }).map(function (d) { return d.id; });
  var unbilled = b.byType.GRN.filter(function (d) { return d.status === 'POSTED' && !d.billId && d.lines.some(function (l) { return l.qty > 0; }); }).map(function (d) { return d.id; });
  var made = {};
  b.byType.PROD.forEach(function (d) { if (d.date === today && d.status !== 'CANCELLED') made[d.itemId] = 1; });
  var sent = b.byType.XFER.filter(function (d) { return d.status === 'SENT'; }).map(function (d) { return d.id; });
  eq(label + ': approvals, orders due, receipts to bill, production to record, transfers on their way, sheets, day-ends',
    [S.approvals.pending().items.map(function (x) { return x.id; }), S.approvals.pending().count, S.buy.dueForReceipt().map(function (x) { return x.id; }), S.buy.openReceipts().map(function (x) { return x.id; }),
      S.make.todo().map(function (x) { return [x.itemId, x.mixLabel, x.standardMixes, x.expectedUnitsPerMix]; }), S.stores.pending().map(function (x) { return [x.storeId, x.transfersSent.map(function (t) { return t.id; }), x.dayEndMissing, x.toSend]; }),
      S.sell.sheets().map(function (x) { return [x.sheetId, x.toPost, x.invoiceIds]; })],
    [waiting, waiting.length, due, unbilled, M.recipes.filter(function (x) { return !made[x.itemId]; }).map(function (x) { return [x.itemId, x.mixLabel, x.standardMixes, x.expectedUnits]; }),
      [['st_vvn', sent, !b.docList.some(function (d) { return d.type === 'DAYEND' && d.storeId === 'st_vvn' && d.date === today && d.status !== 'CANCELLED'; }), E.transferSheet('st_vvn', today).lines.some(function (l) { return l.qty > 0; })]],
      [['DS-r1-' + today.slice(2, 4) + today.slice(5, 7) + today.slice(8), !b.byType.INV.some(function (d) { return d.sheetId === E.sheetId('r1', today) && d.status !== 'CANCELLED'; }), b.byType.INV.filter(function (d) { return d.sheetId === E.sheetId('r1', today) && d.status !== 'CANCELLED'; }).map(function (d) { return d.id; })]]]);

  /* people: the directory and the salary cost, from the masters */
  var rolls = M.employees.filter(function (e) { return e.doj <= today && (!e.dol || e.dol >= today); });
  eq(label + ': headcount and salary cost', [S.people.list().length, S.people.headcount().headcount, S.people.headcount().salary, S.people.headcount().byUnit.map(function (x) { return [x.unitId, x.headcount, x.salary]; })],
    [M.employees.length, rolls.length, rolls.reduce(function (s, e) { return s + e.salary; }, 0), M.units.map(function (u) { var l = rolls.filter(function (e) { return e.unitId === u.id; }); return [u.id, l.length, l.reduce(function (s, e) { return s + e.salary; }, 0)]; })]);

  /* every report: well formed, and its totals those of the selector behind it */
  var formats = ['text', 'date', 'inr', 'inrFull', 'inr2', 'rate', 'num', 'num1', 'pct', 'qty'], whole = { from: go, to: today }, badReports = [];
  S.reports.list().forEach(function (def) {
    var x = S.reports.run(def.id, whole);
    if (x.id !== def.id || !x.title || !Array.isArray(x.rows) || !x.columns.length) badReports.push(def.id + ': shape');
    x.columns.forEach(function (c) {
      if (!c.key || !c.label || formats.indexOf(c.format) === -1 || (c.align !== 'left' && c.align !== 'right')) badReports.push(def.id + ': column ' + c.key);
      if (x.rows.length && !x.rows.some(function (row) { return row[c.key] !== undefined; })) badReports.push(def.id + ': no row has ' + c.key);
      x.rows.forEach(function (row) { if (typeof S.reports.cell(c, row) !== 'string') badReports.push(def.id + ': cell ' + c.key); });
    });
    if (S.reports.csvColumns(x).length !== x.columns.length) badReports.push(def.id + ': csv');
  });
  eq(label + ': the twenty registers of SCOPE 4.10, each well formed', [S.reports.list().length, badReports], [20, []]);
  var sw = straightFlows(go, today);
  eq(label + ': report totals', [S.reports.run('sales_register', whole).totals.taxable, S.reports.run('purchase_register', whole).totals.taxable, S.reports.run('stock_statement', whole).totals.value, S.reports.run('expiry', {}).totals.value,
    S.reports.run('ar_ageing', {}).totals.balance, S.reports.run('ap_ageing', {}).totals.open, S.reports.run('cash_book', whole).rows.filter(function (x) { return x.kindLabel !== 'Balance brought forward'; }).length,
    S.reports.run('expenses', whole).totals.amount, S.reports.run('product_margin', whole).totals.margin, lastOf(S.reports.run('pnl_monthly', whole).rows).total, lastOf(S.reports.run('gst_summary', whole).rows).tax,
    S.reports.run('audit_log', whole).rows.length, S.reports.run('order_status', whole).totals.amount, S.reports.run('production_register', whole).totals.lossValue, S.reports.run('returns', whole).totals.taxable,
    S.reports.run('sales_by_channel', whole).totals.net, S.reports.run('stock_ledger', whole).rows.length],
  [(sw.register || {}).taxable || 0, (sw.purchases || {}).taxable || 0, value, Object.keys(sb.batches || {}).reduce(function (s, k) { return s + HB.money.amount(sb.batches[k], E.unitCost(b.batches[k.split('|')[1]].itemId)); }, 0),
    b.ar.entries.reduce(function (s, x) { return s + x.amount; }, 0), Object.keys(sb.apOpen || {}).reduce(function (s, id) { return s + (b.docs[id].payeeType === 'employee' ? 0 : sb.apOpen[id]); }, 0), b.cash.entries.length,
    b.pnl.reduce(function (s, x) { return s + (x.line === 'expense' ? x.amount : 0); }, 0), S.sell.summary(whole).margin, Object.keys(straightPnl()).reduce(function (s, k) { return s + (straightPnl()[k].profit || 0); }, 0),
    b.gst.reduce(function (s, x) { return s + (x.dir === 'output' ? 1 : -1) * (x.cgst + x.sgst); }, 0), b.audit.length, b.byType.PO.reduce(function (s, d) { return s + (d.status === 'CANCELLED' || d.status === 'REJECTED' ? 0 : d.total); }, 0),
    b.pnl.reduce(function (s, x) { return s + (x.line === 'prodLoss' ? x.amount : 0); }, 0), (sw.returns || {}).taxable || 0, S.sell.summary(whole).net, b.moves.length]);
}

/** One call of every selector, by name: for the sweeps by role. */
function everySelector() {
  var S = HB.data, f = { from: HB.calendar.goLive, to: HB.calendar.today }, out = {};
  out['stock.onHand'] = S.stock.onHand(); out['stock.batches'] = S.stock.batches(); out['stock.ledger'] = S.stock.ledger(f); out['stock.statement'] = S.stock.statement(f);
  out['stock.lowStock'] = S.stock.lowStock(); out['stock.expiring'] = S.stock.expiring(); out['stock.value'] = S.stock.value();
  out['stock.counts'] = S.stock.counts(f); out['stock.writeOffs'] = S.stock.writeOffs(f);
  out['buy.orders'] = S.buy.orders(f); out['buy.receipts'] = S.buy.receipts(f); out['buy.bills'] = S.buy.bills(f); out['buy.payments'] = S.buy.payments(f);
  out['buy.dueForReceipt'] = S.buy.dueForReceipt(); out['buy.openReceipts'] = S.buy.openReceipts(); out['buy.register'] = S.buy.register(f);
  out['make.entries'] = S.make.entries(f); out['make.yieldByItem'] = S.make.yieldByItem(f); out['make.register'] = S.make.register(f); out['make.todo'] = S.make.todo();
  out['make.costSheet'] = S.make.costSheet('bread'); out['make.recipes'] = S.make.recipes();
  out['sell.invoices'] = S.sell.invoices(f); out['sell.orders'] = S.sell.orders(f); out['sell.creditNotes'] = S.sell.creditNotes(f); out['sell.receipts'] = S.sell.receipts(f);
  out['sell.sheets'] = S.sell.sheets(); out['sell.summary'] = S.sell.summary(f); out['sell.returns'] = S.sell.returns(f); out['sell.register'] = S.sell.register(f);
  ['item', 'customer', 'route', 'channel', 'unit', 'day', 'month'].forEach(function (dim) { out['sell.by ' + dim] = S.sell.by(dim, dim === 'day' ? { from: HB.dates.monthStart(f.to), to: f.to } : f); });
  out['stores.transfers'] = S.stores.transfers(f); out['stores.dayEnds'] = S.stores.dayEnds(f); out['stores.pending'] = S.stores.pending();
  out['ar.balances'] = S.ar.balances(); out['ar.ageing'] = S.ar.ageing(); out['ar.openInvoices'] = S.ar.openInvoices();
  HB.masters.customers.forEach(function (c) { out['ar.statement ' + c.id] = S.ar.statement(c.id, f); });
  out['ap.balances'] = S.ap.balances(); out['ap.ageing'] = S.ap.ageing(); out['ap.dueWithin'] = S.ap.dueWithin(); out['ap.toReimburse'] = S.ap.toReimburse();
  HB.masters.vendors.forEach(function (v) { out['ap.openItems ' + v.id] = S.ap.openItems('vendor', v.id); });
  HB.masters.employees.forEach(function (e) { out['ap.openItems ' + e.id] = S.ap.openItems('employee', e.id); });
  out['cash.balances'] = S.cash.balances();
  HB.masters.accounts.forEach(function (a) { out['cash.book ' + a.id] = S.cash.book(a.id, f); });
  out['pnl.months'] = S.pnl.months();
  ['2026-02', '2026-03'].forEach(function (mk) { out['pnl.month ' + mk] = S.pnl.month(mk); out['pnl.entries ' + mk] = S.pnl.entries({ monthKey: mk, line: 'expense' }); });
  out['margin.byItem'] = S.margin.byItem(f); out['margin.byChannel'] = S.margin.byChannel(f); out['gst.summary'] = S.gst.summary(f);
  out['exp.list'] = S.exp.list(f); out['exp.byCategory'] = S.exp.byCategory(f); out['exp.byUnit'] = S.exp.byUnit(f);
  out['people.list'] = S.people.list(); out['people.headcount'] = S.people.headcount();
  out['approvals.pending'] = S.approvals.pending(); out['audit.list'] = S.audit.list(f); out['notify.list'] = S.notify.list();
  out['dash.today'] = S.dash.today(); out['dash.monthToDate'] = S.dash.monthToDate(); out['dash.work'] = S.dash.work(); out['guide.journeys'] = S.guide.journeys();
  HB.book.docList.forEach(function (d) { out['doc ' + d.id] = [S.doc.get(d.id), S.doc.view(d.id), S.doc.timeline(d.id), S.doc.related(d.id)]; });
  out['reports.list'] = S.reports.list();
  ['sales_register', 'sales_by_item', 'sales_by_customer', 'sales_by_route', 'sales_by_channel', 'returns', 'production_register', 'stock_statement', 'stock_ledger', 'expiry', 'purchase_register', 'order_status',
    'ar_ageing', 'ap_ageing', 'cash_book', 'expenses', 'product_margin', 'pnl_monthly', 'gst_summary', 'audit_log'].forEach(function (id) { out['reports.run ' + id] = S.reports.run(id, f); });
  out['lookup'] = [S.lookup.items(), S.lookup.customers(), S.lookup.vendors(), S.lookup.units(), S.lookup.stores(), S.lookup.locations(), S.lookup.accounts(), S.lookup.categories(), S.lookup.routes(), S.lookup.users(),
    HB.masters.employees.map(function (e) { return S.lookup.employee(e.id); }), HB.masters.items.map(function (i) { return S.lookup.item(i.id); }), HB.masters.customers.map(function (c) { return S.lookup.customer(c.id); })];
  return out;
}

/** Does a selector's result hold anything? */
function filled(o) {
  if (!o) return false;
  if (Array.isArray(o)) return o.some(function (x) { return Array.isArray(x) ? x.length > 0 : (x && x.monthKey ? x.netSales !== 0 || x.expenses !== 0 || x.materialCost !== 0 : !!x); });
  if (o.dim) return o.rows.some(function (r) { return r.units !== 0 || r.sales !== 0 || r.returns !== 0 || r.cogs !== 0; });
  if (o.rows) return o.rows.length > 0;
  if (o.items) return o.items.length > 0;
  if (o.groups) return o.groups.length > 0;
  if (o.output) return o.output.length + o.input.length > 0;
  if (o.lines) return o.lines.some(function (l) { return l.amount !== 0; });
  if (o.byDept) return o.headcount > 0;
  if (o.byChannel) return o.sales !== 0 || o.returns !== 0;
  return true;
}

function partS() {
  var fixture = path.join(__dirname, 'fixture-tiny.js');
  delete require.cache[require.resolve(fixture)]; /* a fresh HB.config, whatever another part loaded */
  require(fixture);
  HB.config.opening = tinyOpening();
  HB.config.journeys = TEST_JOURNEYS;
  require(path.join(ROOT, 'js', 'data', 'engine.js'));
  require(path.join(ROOT, 'js', 'data', 'data.js'));
  var keptSeed = HB.seed;
  delete HB.seed; /* the tiny company has no seed: its history is its opening entries */

  var E = HB.engine, S = HB.data, book, x, r, GO = '2026-01-01';

  section('s.1 the 35 operations of part (a): every selector against a straight pass over the documents and the ledgers', function () {
    HB.store.remove('log');
    HB.calendar.set(T);
    as('owner');
    E.boot();
    x = handWorked();
    book = HB.book;
    eq('the hand-worked case stands', [E.log().length, book.docList.length, Object.keys(book.pending)], [35, 32, []]);
    reconcile('after 35 operations', [[T, T], [Y1, Y1], [GO, T], ['2026-02-01', '2026-02-28'], ['2026-03-01', T]]);
  });

  section('s.2 the same figures, typed in from the arithmetic of part (a)', function () {
    as('owner');
    var f = { from: T, to: T }, sum = S.sell.summary(f), p = S.pnl.month('2026-03'), g = S.gst.summary({ from: GO, to: T });
    /* a.9: sales 209000 + 45000 + 105142 = 359142; returns 9600; cost of goods sold 131013
       collections: 75550 + 6400 collected at the drop, 1200000 from the mess, 100000 received and cancelled the same day */
    eq('sales of 10 Mar', [sum.sales, sum.returns, sum.net, sum.cogs, sum.margin, sum.units, sum.collections], [359142, -9600, 349542, 131013, 218529, 152, { total: 1281950, cash: 81950, bank: 1200000 }]);
    eq('by channel', sum.byChannel.map(function (c) { return [c.channel, c.sales, c.returns, c.cogs, c.units]; }), [['retail', 209000, -9600, 79704, 85], ['corporate', 45000, 0, 17794, 15], ['store', 105142, 0, 33515, 52]]);
    /* bread: 20 + 30 + 5 + 15 + 12 = 82 sold, 3 returned; puff: 10 + 20 + 40 = 70 */
    eq('by item', S.sell.by('item', f).rows.map(function (i) { return [i.key, i.units, i.sales, i.returnUnits, i.returns, i.cogs]; }),
      [['bread', 82, 269000, 3, -9600, 97273], ['puff', 70, 90142, 0, 0, 33740]]);
    eq('by route: the two outlets of the route, the corporate and the store apart', S.sell.by('route', f).rows.map(function (i) { return [i.key, i.net]; }), [['r1', 199400], ['corporate', 45000], ['stores', 105142]]);
    eq('by day and by month: every day and month of the range', [S.sell.by('day', { from: Y2, to: T }).rows.map(function (i) { return [i.key, i.net]; }), S.sell.by('month', { from: GO, to: T }).rows.map(function (i) { return [i.key, i.net]; })],
      [[[Y2, 0], [Y1, 0], [T, 349542]], [['2026-01', 0], ['2026-02', 0], ['2026-03', 349542]]]);
    /* a.9: net sales 349542, material cost 218007, gross margin 131535, expenses 1035500, result -903965 */
    eq('P&L of March', [p.netSales, p.cogs.total, p.prodLoss, p.writeoff, p.countDiff, p.materialCost, p.grossMargin, p.expenseTotal, p.operatingProfit],
      [{ retail: 199400, corporate: 45000, store: 105142, total: 349542 }, 131013, 3559, 75995, 7440, 218007, 131535, 1035500, -903965]);
    eq('its expenses by category and location', p.expenses.map(function (e) { return [e.categoryId, e.amount, e.byUnit]; }), [['electricity', 1000000, { factory: 1000000 }], ['travel', 35000, { st_vvn: 35000 }], ['cash_short', 500, { st_vvn: 500 }]]);
    eq('P&L of February: the salary bill, dated the last day of its month', [S.pnl.month('2026-02').expenseTotal, S.pnl.month('2026-02').operatingProfit, S.pnl.months().map(function (m) { return [m.monthKey, m.operatingProfit]; })],
      [10900000, -10900000, [['2026-01', 0], ['2026-02', -10900000], ['2026-03', -903965]]]);
    eq('the documents behind the travel cell', S.pnl.entries({ monthKey: '2026-03', line: 'expense', categoryId: 'travel' }).map(function (e) { return [e.docId, e.date, e.amount, e.unitId]; }), [['EXP-U-0001', T, 35000, 'st_vvn']]);
    /* a.9: output Nil 259400, 5% 90142 with 2254 + 2254; input Nil 1900000, 5% 260000 with 13000, 18% 1000000 with 180000 */
    eq('GST: Nil-rated stands outside the taxable turnover', [g.outputTotals, g.inputTotals, g.net, g.output.map(function (o) { return o.label; })],
      [{ taxable: 90142, nilRated: 259400, cgst: 2254, sgst: 2254, tax: 4508 }, { taxable: 1260000, nilRated: 1900000, cgst: 96500, sgst: 96500, tax: 193000 }, { cgst: -94246, sgst: -94246, tax: -188492 }, ['Nil-rated', '5%']]);
    /* a.9: 2523200 + 831250 + 62800 + 32029 + 9640 + 9490 = 3468409 */
    eq('stock value at today\'s cost', (function (v) { return [v.total, v.materials, v.packing, v.finished, v.rows.map(function (l) { return [l.locId, l.value]; })]; })(S.stock.value()),
      [3468409, 3354450, 62800, 51159, [['fac_rm', 3417250], ['fac_fg', 41669], ['st_vvn', 9490]]]);
    eq('the puffs of 9 Mar reach their best-before date today: near expiry', S.stock.expiring().map(function (e) { return [e.batchId, e.locId, e.qty, e.daysLeft, e.flag, e.available]; }), [['B-260309-PUF', 'fac_fg', 20, 0, 'near', 20]]);
    /* a.9: factory cash 4946950, store cash 220000, bank 17487500 */
    eq('cash and bank', (function (c) { return [c.total, c.cashTotal, c.bankTotal]; })(S.cash.balances()), [22654450, 5166950, 17487500]);
    eq('the factory cash book: a cancellation is a row of its own', S.cash.book('cash_factory', { from: T, to: T }).rows.map(function (c) { return [c.docId, c.refId, c.kind, c.amount, c.balance, c.reversal, c.note]; }).slice(-2),
      [['RCPT-U-0002', 'RCPT-U-0002', 'receipt', 100000, 5046950, false, ''], ['CXL-U-0001', 'RCPT-U-0002', 'receipt', -100000, 4946950, true, 'Cancellation of RCPT-U-0002: entered against the wrong outlet']]);
    /* a.9: the weekly outlet owes 119100 (due 17 Mar); the mess has 155000 on account; flour 1173000 (due 25 Mar), power 1180000 (due 20 Mar) */
    eq('receivables', (function (a) { return [a.totals.open, a.totals.credit, a.totals.balance, a.totals.overdue, a.rows.map(function (c) { return [c.customerId, c.notDue, c.credit, c.balance]; })]; })(S.ar.ageing()),
      [119100, 155000, -35900, 0, [['c_week', 119100, 0, 119100], ['c_corp', 0, 155000, -155000]]]);
    eq('payables', (function (a) { return [a.totals.open, a.totals.overdue, a.totals.dueSoon, a.rows.map(function (v) { return [v.vendorId, v.notDue, v.balance]; })]; })(S.ap.ageing()), [2353000, 0, 0, [['v_stock', 1173000, 1173000], ['v_power', 1180000, 1180000]]]);
    /* a.3: bread 120 expected, 117 good: 97.5%, loss 3559; puff 100 of 100 */
    eq('yield of 9 Mar', S.make.yieldByItem({ from: Y1, to: Y1 }).rows.map(function (y) { return [y.itemId, y.runs, y.expectedUnits, y.goodUnits, y.rejectedUnits, y['yield'], y.lossValue]; }), [['bread', 1, 120, 117, 3, 0.975, 3559], ['puff', 1, 100, 100, 0, 1, 0]]);
    /* filters: one outlet (75000 + 16000 sold, 9600 returned, 75550 + 6400 collected), one channel, one batch */
    eq('a summary narrowed to a customer and to a channel', [(function (c) { return [c.sales, c.returns, c.units, c.collections.total]; })(S.sell.summary({ from: T, to: T, customerId: 'c_cash' })),
      (function (c) { return [c.sales, c.byChannel.map(function (b) { return b.channel; }), c.collections.total]; })(S.sell.summary({ from: T, to: T, channel: 'retail' })), S.sell.summary({ from: T, to: T, unitIds: ['st_vvn'] }).sales],
    [[91000, -9600, 35, 81950], [209000, ['retail'], 81950], 105142]);
    /* the return of 3 loaves, 9600, against the 91000 supplied to that outlet on the day; 70 loaves sold to outlets and the mess for 221000 */
    eq('returns: the rows, by outlet with its supply, by item with its sales', (function (x) { return [x.rows.map(function (row) { return [row.cnId, row.units, row.taxable, row.total, row.sharePct]; }), x.totals,
      x.byCustomer.map(function (c) { return [c.customerId, c.supply, c.returns, c.units, c.share === 9600 / 91000]; }), x.byItem]; })(S.sell.returns({ from: T, to: T })),
    [[['CN-U-0001', 3, 9600, 9600, 12.8]], { units: 3, taxable: 9600, gst: 0, total: 9600 }, [['c_cash', 91000, 9600, 3, true]],
      [{ itemId: 'bread', itemName: 'Sandwich bread', unit: 'pcs', returnUnits: 3, returns: 9600, soldUnits: 70, sales: 221000, share: 9600 / 221000 }]]);
    /* the bread of 9 Mar in the finished store: 117 made, then 20 + 30 + 15 dispatched, 20 transferred, 5 dispatched */
    eq('the ledger of one batch, with its running balance', (function (l) { return [l.opening, l.closing, l.rows.map(function (m) { return [m.docId, m.kind, m.qty, m.balance]; })]; })(S.stock.ledger({ from: T, to: T, locId: 'fac_fg', itemId: 'bread', batchId: 'B-260309-BRD' })),
      [117, 27, [['INV-U-0001', 'dispatch', -20, 97], ['INV-U-0002', 'dispatch', -30, 67], ['INV-U-0003', 'dispatch', -15, 52], ['XFER-U-0001', 'transfer', -20, 32], ['INV-U-0004', 'dispatch', -5, 27]]]);
    eq('lookups: by id with a display name, by kind, by channel, by route in stop order', [S.lookup.item('bread').display, S.lookup.item('nope'), S.lookup.customer('c_week').routeName, S.lookup.vendor('v_stock').display, S.lookup.user('u_store_mgr').display,
      S.lookup.items({ kind: 'material' }).map(function (i) { return i.id; }), S.lookup.items({ kind: 'fg' }).map(function (i) { return i.id; }), S.lookup.customers({ routeId: 'r1' }).map(function (c) { return c.id; }), S.lookup.customers({ channel: 'corporate' }).map(function (c) { return c.id; }),
      S.lookup.categories({ mode: 'claim' }).map(function (c) { return c.id; }), S.lookup.categories({ mode: 'bill' }).map(function (c) { return c.id; }), S.lookup.stores().map(function (u) { return u.id; }), S.lookup.locations({ kind: 'transit' }).map(function (l) { return l.id; }),
      S.lookup.name('account', 'bank'), Object.keys(S.lookup.item('maida')).filter(function (k) { return k === 'orderQty' || k === 'leadDays' || k === 'vendorId'; }), Object.keys(S.lookup.customer('c_corp')).indexOf('pattern')],
    ['Sandwich bread, 400 g', { id: 'nope', name: 'nope', display: 'nope', unknown: true }, 'Anand town', 'Charotar Flour and Fats, Anand', 'Nisha Desai (Store manager)', ['maida', 'fat', 'bag'], ['bread', 'puff'], ['c_cash', 'c_week'], ['c_corp'],
      ['travel', 'repairs'], ['electricity', 'repairs'], ['st_vvn'], ['transit_st_vvn'], 'Bank account', [], -1]);
    eq('a register for the generic page: columns with formats, cells as text, values for a CSV in rupees', (function (x) {
      var row = x.rows[0], csv = S.reports.csvColumns(x);
      return [x.title, x.columns.map(function (c) { return c.key + ':' + c.format + ':' + c.align; }).slice(0, 7), x.columns.slice(0, 7).map(function (c) { return S.reports.cell(c, row); }), csv[6].value(row), x.totals.taxable];
    })(S.reports.run('sales_register', { from: T, to: T })),
    ['Sales register', ['date:date:left', 'docId:text:left', 'typeLabel:text:left', 'party:text:left', 'channelLabel:text:left', 'units:num:right', 'taxable:inr2:right'],
      ['10 Mar 2026', 'INV-U-0001', 'Invoice', 'Shree Ganesh Provision', 'Retail outlets', '30', HB.fmt.inr2(75000)], 750, 349542]);
    eq('the journeys tick from the log: a done journey, one that waits, one whose steps came in the wrong order', S.guide.journeys().map(function (j) { return [j.id, j.done, j.doneSteps, j.next, j.steps.map(function (s) { return s.n; })]; }),
      [['bill', true, 3, null, [4, 5, 6]], ['store', true, 4, null, [12, 13, 14, 15]], ['damaged', false, 0, 0, [null, null]], ['order', false, 1, 1, [30, null]]]);
  });

  section('s.3 things that wait, back-dated entries, cancellations on the day and on the next business date', function () {
    /* 36. the Owner writes off 40 kg of shortening as damaged, approved in the same operation: 66.5 - 40 = 26.5 kg, under the level of 30 */
    ok('36 WO by the Owner', post('owner', 'WO', { date: T, locId: 'fac_rm', reason: 'damaged', lines: [{ itemId: 'fat', qty: 40 }] }));
    /* 37, 38. an order within the limit, expected tomorrow (30 x 12500 = 375000), and one above it (2000 x 3800 = 7600000) */
    ok('37 PO within the limit', post('stores', 'PO', { date: T, vendorId: 'v_stock', expectedDate: T1, lines: [{ itemId: 'fat', qty: 30, rate: 12500 }] }));
    ok('38 PO above the limit', post('stores', 'PO', { date: T, vendorId: 'v_stock', expectedDate: '2026-03-14', lines: [{ itemId: 'maida', qty: 2000, rate: 3800 }] }));
    /* 39. a return of 10 loaves by the weekly outlet: 32000 against 118000 supplied, 27.12%: held */
    ok('39 CN held', post('sales', 'CN', { date: T, customerId: 'c_week', lines: [{ itemId: 'bread', qty: 10 }] }));
    ok('40 claim by sales', post('sales', 'EXP', { kind: 'claim', date: T, categoryId: 'travel', unitId: 'factory', amount: 8000 }));
    ok('41 claim by the store manager for the factory', post('store_mgr', 'EXP', { kind: 'claim', date: T, categoryId: 'repairs', unitId: 'factory', amount: 9000 }));
    ok('42 XFER on its way', post('stores', 'XFER', { date: T, toStoreId: 'st_vvn', lines: [{ itemId: 'bread', qty: 5 }] }));
    ok('43 cancel the factory deposit', act('accounts', 'cancel', { id: x.dep1.id, reason: 'slip not stamped' }));
    ok('44 cancel the electricity bill', act('accounts', 'cancel', { id: x.ebill.id, reason: 'billed twice' }));
    /* 45, 46. an electricity bill dated 2 Mar, 200000 + 18%: total 236000, due 12 Mar; approved today, a cost of 2 Mar */
    r = ok('45 a back-dated expense bill', post('accounts', 'EXP', { kind: 'bill', date: '2026-03-02', payeeId: 'v_power', categoryId: 'electricity', unitId: 'factory', amount: 200000, gstRate: 18, billRef: 'MG/5530' }));
    ok('46 approve it', act('owner', 'approve', { id: r.doc.id }));
    /* 47. the Owner back-dates an invoice to 20 Feb for the weekly outlet: 4 x 3200 = 12800, due 27 Feb, so overdue */
    ok('47 a back-dated invoice', post('owner', 'INV', { date: '2026-02-20', customerId: 'c_week', lines: [{ itemId: 'bread', qty: 4 }] }));
    book = HB.book;
    eq('47 operations; four documents wait', [E.log().length, Object.keys(book.pending)], [47, ['PO-U-0003', 'CN-U-0002', 'EXP-U-0004', 'EXP-U-0005']]);
    reconcile('after 47 operations', [[T, T], [GO, T], ['2026-02-01', '2026-02-28'], ['2026-03-01', '2026-03-09']]);
    /* a bill posted and cancelled in the range (44): its rate leaves the GST summary with it, it is not listed with zeros */
    eq('no rate with nothing in it stays in the GST summary', [[T, T], [GO, T]].map(function (rg) { var g = S.gst.summary({ from: rg[0], to: rg[1] }); return g.output.concat(g.input).filter(function (t) { return !t.taxable && !t.cgst && !t.sgst; }).length; }), [0, 0]);
    as('owner');
    /* February now has a sale: 12800 less 4 x 1186.25 = 4745; 2 Mar has the electricity bill */
    eq('a back-dated document carries its own date in every figure', [S.pnl.month('2026-02').netSales.retail, S.pnl.month('2026-02').cogs.retail, S.sell.by('day', { from: '2026-03-02', to: '2026-03-02' }).rows[0].net, S.exp.byCategory({ from: '2026-03-02', to: '2026-03-02' }).totals.amount,
      S.exp.byCategory({ from: T, to: T }).rows.map(function (c) { return [c.categoryId, c.amount]; })],
    [12800, 4745, 0, 200000, [['electricity', 0], ['travel', 35000], ['cash_short', 500]]]);
    eq('the two journeys that waited are done: the Owner\'s own write-off ticks both of its steps', S.guide.journeys().slice(2).map(function (j) { return [j.id, j.done, j.steps.map(function (s) { return [s.n, s.userId]; })]; }),
      [['damaged', true, [[36, 'u_owner'], [36, 'u_owner']]], ['order', true, [[30, 'u_accounts'], [37, 'u_stores']]]]);

    /* ----- the next business date: the copy is rebuilt and the log replayed */
    HB.calendar.set(T1);
    E.boot();
    book = HB.book;
    eq('rebuilt on 11 Mar: nothing skipped', [HB.calendar.today, E.skipped, E.log().length], [T1, [], 47]);
    /* 48. the sheet invoice of the weekly outlet (119100) is cancelled: its sale of 10 Mar stays, the negative is dated 11 Mar */
    ok('48 cancel INV-U-0002', act('sales', 'cancel', { id: 'INV-U-0002', reason: 'delivered to the wrong parlour' }));
    /* 49. the payment of 3000000 is cancelled: the opening bill (due 10 Jan) and the flour bill are open again */
    ok('49 cancel PAY-U-0001', act('accounts', 'cancel', { id: 'PAY-U-0001', reason: 'transfer returned by the bank' }));
    /* 50. the return of 10 Mar is cancelled: the 9600 of credit it gave was used by INV-U-0004, which is open again */
    ok('50 cancel CN-U-0001', act('sales', 'cancel', { id: 'CN-U-0001', reason: 'loaves were not stale' }));
    /* 51. puffs: 1 mix, 95 good, 5 rejected: loss 5 x 482 = 2410. 52, 53. a bread run entered and cancelled */
    ok('51 PROD puff', post('production', 'PROD', { date: T1, itemId: 'puff', mixes: 1, goodUnits: 95, rejectedUnits: 5 }));
    r = ok('52 PROD bread', post('production', 'PROD', { date: T1, itemId: 'bread', mixes: 1, goodUnits: 40 }));
    ok('53 cancel it', act('production', 'cancel', { id: r.doc.id, reason: 'entered twice' }));
    reconcile('after 53 operations', [[T, T], [T1, T1], [GO, T1], ['2026-03-01', T1]]);

    as('owner');
    /* 11 Mar: -118000 (the invoice) + 9600 (the return taken back) = -108400; GST -1100; total -119100 + 9600 = -109500 */
    eq('the register of 11 Mar holds the two cancellations as rows of their own', S.sell.register({ from: T1, to: T1 }).rows.map(function (row) { return [row.docId, row.refId, row.type, row.units, row.taxable, row.gst, row.total, row.reversal]; }),
      [['CXL-U-0004', 'INV-U-0002', 'INV', -50, -118000, -1100, -119100, true], ['CXL-U-0006', 'CN-U-0001', 'CN', 3, 9600, 0, 9600, true]]);
    eq('and its totals', [S.sell.register({ from: T1, to: T1 }).totals, S.sell.summary({ from: T1, to: T1 }).net, S.sell.summary({ from: T, to: T }).net, S.sell.summary({ from: T, to: T1 }).net],
      [{ units: -47, taxable: -108400, cgst: -550, sgst: -550, gst: -1100, total: -109500 }, -108400, 349542, 241142]);
    eq('the invoice list shows it under Cancelled; open balances leave it out', [S.sell.invoices({ status: 'CANCELLED' }).map(function (i) { return i.id; }), S.ar.openInvoices('c_week').map(function (i) { return [i.id, i.open, i.overdue, i.daysOverdue]; }),
      S.ar.openInvoices('c_cash').map(function (i) { return [i.id, i.open, i.daysOverdue]; })], [['INV-U-0002'], [['INV-U-0005', 12800, true, 12]], [['INV-U-0004', 9600, 1]]]);
    /* the weekly outlet 12800 (12 days) and the cash outlet 9600 (1 day) are overdue; the mess has 155000 on account */
    eq('receivables ageing', (function (a) { return [a.totals.open, a.totals.overdue, a.totals.credit, a.totals.balance, a.rows.map(function (c) { return [c.customerId, c.d1_15, c.credit]; })]; })(S.ar.ageing()),
      [22400, 22400, 155000, -132600, [['c_cash', 9600, 0], ['c_week', 12800, 0], ['c_corp', 0, 155000]]]);
    /* flour: the opening bill 2000000 was due 10 Jan, 60 days ago; the bill of 10 Mar 2173000 is due 25 Mar. Power: 236000 due 12 Mar */
    eq('payables ageing', (function (a) { return [a.totals.open, a.totals.overdue, a.totals.dueSoon, a.rows.map(function (v) { return [v.vendorId, v.notDue, v.d31_60, v.dueSoon]; })]; })(S.ap.ageing()),
      [4409000, 2000000, 236000, [['v_stock', 2173000, 2000000, 0], ['v_power', 236000, 0, 236000]]]);
    eq('bills due this week: the overdue one first', S.ap.dueWithin().map(function (i) { return [i.id, i.open, i.overdue, i.daysToDue]; }), [['VBILL-260101-001', 2000000, true, -60], ['EXP-U-0006', 236000, false, 1]]);
    /* bank 17487500 - 100000 (the deposit taken back) + 3000000 (the payment taken back) */
    eq('cash and bank', S.cash.balances().rows.map(function (a) { return [a.accountId, a.balance]; }), [['cash_factory', 5046950], ['cash_st_vvn', 220000], ['bank', 20387500]]);
    /* shortening 26.5 - 2 = 24.5 kg against a level of 30, with 30 kg on order */
    eq('low stock: an alert with what is on order, and no quantity to order', S.stock.lowStock(), [{ itemId: 'fat', itemName: 'Bakery shortening', code: 'FAT', kind: 'rm', unit: 'kg', qty: 24.5, reserved: 0, available: 24.5, reorderLevel: 30, onOrder: 30, orderIds: ['PO-U-0002'] }]);
    eq('expiry flags against the business date', S.stock.expiring().map(function (e) { return [e.batchId, e.locId, e.qty, e.flag, e.available]; }), [['B-260309-PUF', 'fac_fg', 40, 'expired', 0], ['B-260311-PUF', 'fac_fg', 95, 'near', 95]]);
    eq('production of 11 Mar: the cancelled run is taken back on its own date', [S.make.yieldByItem({ from: T1, to: T1 }).totals, S.make.register({ from: T1, to: T1 }).rows.map(function (p) { return [p.docId, p.goodUnits, p.reversal]; }), S.make.todo().map(function (t) { return t.itemId; })],
      [{ runs: 1, mixes: 1, expectedUnits: 100, goodUnits: 95, rejectedUnits: 5, lossValue: 2410, 'yield': 0.95 }, [['PROD-U-0003', 95, false], ['PROD-U-0004', 40, false], ['CXL-U-0007', -40, true]], ['bread']]);

    /* ----- approvals: the evidence, and who may approve */
    var w = S.approvals.pending();
    eq('approvals by type', w.groups.map(function (g) { return [g.type, g.count, g.items.map(function (i) { return i.id; })]; }), [['PO', 1, ['PO-U-0003']], ['CN', 1, ['CN-U-0002']], ['EXP', 2, ['EXP-U-0004', 'EXP-U-0005']]]);
    eq('an order above the limit: by how much, and each rate beside the latest price', (function (e) { return [e.total, e.limit, e.over, e.lines.map(function (l) { return [l.itemName, l.qty, l.rate, l.latestRate, l.amount]; })]; })(w.items[0].evidence), [7600000, 5000000, 2600000, [['Maida', 2000, 3800, 3800, 7600000]]]);
    /* the outlet's invoice of 10 Mar is cancelled, so its supply of the week is now nil: the note was held at 27.12% */
    eq('a held return: its share when raised, the limit, the week as it stands now', (function (e) { return [e.sharePct, e.limitPct, e.from, e.to, e.supply, e.otherReturns, e.thisReturn]; })(w.items[1].evidence), [27.12, 8, '2026-03-04', T, 0, 0, 32000]);
    eq('a claim: who, what for, where', (function (e) { return [e.kind, e.payeeName, e.categoryName, e.unitName, e.total]; })(w.items[3].evidence), ['claim', 'Nisha Desai', 'Repairs', 'Factory', 9000]);
    eq('the Owner may approve them all', w.items.map(function (i) { return [i.canApprove.ok, i.canReject.ok]; }), [[true, true], [true, true], [true, true], [true, true]]);
    as('accounts');
    eq('accounts sees them with the reason it may not', S.approvals.pending().items.map(function (i) { return [i.id, i.canApprove.ok, i.canApprove.code, i.canApprove.reason]; }),
      w.items.map(function (i) { return [i.id, false, 'role', 'Only the Owner approves documents']; }));
    as('sales');
    eq('and whoever raised a document, the same list of nothing: approvals are for the Owner and accounts', [S.approvals.pending().count, S.doc.view('CN-U-0002').actions.map(function (a) { return [a.op, a.ok, a.code]; })], [0, [['approve', false, 'own_approval'], ['reject', false, 'own_approval'], ['cancel', true, '']]]);

    /* ----- today's work and the notification log */
    as('owner');
    eq('today\'s work, 11 Mar', (function (k) { return [k.count, k.groups.map(function (g) { return [g.kind, g.items.map(function (i) { return i.id; })]; })]; })(S.dash.work()),
      [10, [['sheet', ['DS-r1-260311']], ['transfer_send', ['send:st_vvn']], ['transfer_confirm', ['XFER-U-0002']], ['receipt', ['PO-U-0002']], ['production', ['prod:bread']], ['dayend', ['dayend:st_vvn']],
        ['approval', ['PO-U-0003', 'CN-U-0002', 'EXP-U-0004', 'EXP-U-0005']]]]);
    eq('the notification log: what, to whom, about which document', S.notify.list().map(function (n) { return [n.kind, n.date, n.toRole, n.to, n.docId]; }), [
      ['expiry', T1, 'stores', 'imran.vohra@example.com', 'PROD-U-0002'], ['expiry', T1, 'stores', 'imran.vohra@example.com', 'PROD-U-0003'], ['low_stock', T1, 'stores', 'imran.vohra@example.com', null],
      ['overdue', T1, 'accounts', 'falguni.shah@example.com', 'INV-U-0004'],
      ['approval', T, 'owner', 'nilesh.patel@example.com', 'CN-U-0002'], ['approval', T, 'owner', 'nilesh.patel@example.com', 'EXP-U-0004'], ['approval', T, 'owner', 'nilesh.patel@example.com', 'EXP-U-0005'], ['approval', T, 'owner', 'nilesh.patel@example.com', 'PO-U-0003'],
      ['due', '2026-03-05', 'accounts', 'falguni.shah@example.com', 'EXP-U-0006'], ['overdue', '2026-02-28', 'accounts', 'falguni.shah@example.com', 'INV-U-0005'], ['due', '2026-01-11', 'accounts', 'falguni.shah@example.com', 'VBILL-260101-001']]);
    /* found by reading the screens: "2 packs ... reaches", "189 pack of Sandwich bread" */
    eq('an expiry notice agrees with its quantity: one pack reaches, two packs reach, any number passed', S.notify.list().filter(function (n) { return n.kind === 'expiry'; })
      .map(function (n) { return n.text; }).filter(function (t) { return !/^(?:1 \S+ of .+ (?:reaches|passed)|(?!1 )[\d,.]+ \S+ of .+ (?:reach|passed)) the best-before date of /.test(t); }), []);
    eq('a unit reads as it would in a sentence: a word takes its plural, kg never changes, one of pcs is a pc',
      [HB.fmt.qty(189, 'pack'), HB.fmt.qty(1, 'pack'), HB.fmt.qty(0, 'pack'), HB.fmt.qty(1.5, 'litre'), HB.fmt.qty(1, 'litre'), HB.fmt.qty(1, 'pcs'), HB.fmt.qty(240, 'pcs'), HB.fmt.qty(12.5, 'kg'), HB.fmt.qty(1, 'kg'), HB.fmt.qty(3), HB.fmt.unitFor(2, 'pack'), HB.fmt.unitFor(1, 'pcs')],
      ['189 packs', '1 pack', '0 packs', '1.5 litres', '1 litre', '1 pc', '240 pcs', '12.5 kg', '1 kg', '3', 'packs', 'pc']);
    HB.masters.company.emailDomain = 'happybakers.example';
    S.reset();
    eq('with a domain in the company master the addresses are at it', (function (n) { return [n.to, n.placeholder]; })(S.notify.list()[0]), ['imran.vohra@happybakers.example', false]);
    delete HB.masters.company.emailDomain;
    S.reset();

    /* ----- documents: the view, the timeline from the audit trail, what hangs together */
    eq('doc.get is the document itself; an unknown id is null', [S.doc.get('INV-U-0002') === book.docs['INV-U-0002'], S.doc.get('INV-U-9999'), S.doc.view('INV-U-9999'), S.doc.timeline('INV-U-9999'), S.doc.related('INV-U-9999')], [true, null, null, [], []]);
    eq('timeline of the held bill: raised, approved', S.doc.timeline('VBILL-U-0001').map(function (t) { return [t.at, t.userName, t.roleLabel, t.label, t.after, t.note]; }),
      [[T + 'T09:04', 'Falguni Shah', 'Accounts and admin', 'Raised', 'HELD', 'the bill is more than 2% away from its order and receipts'], [T + 'T09:05', 'Nilesh Patel', 'Owner', 'Approved', 'POSTED', '']]);
    eq('timeline of the cancelled invoice', S.doc.timeline('INV-U-0002').map(function (t) { return [t.at.slice(0, 10), t.userId, t.label, t.after, t.note]; }), [[T, 'u_sales', 'Raised', 'POSTED', ''], [T1, 'u_sales', 'Cancelled', 'CANCELLED', 'delivered to the wrong parlour']]);
    function rel(id) { return S.doc.related(id).map(function (k) { return [k.relation, k.id, k.amount]; }); }
    eq('the order of a receipt and its bill', rel('GRN-U-0001'), [['order', 'PO-U-0001', 2150000], ['bill', 'VBILL-U-0001', 2173000]]);
    eq('the receipts and the bill of an order', rel('PO-U-0001'), [['receipt', 'GRN-U-0001', 1390000], ['receipt', 'GRN-U-0002', 760000], ['bill', 'VBILL-U-0001', 2173000]]);
    eq('the receipts, the order and the payments of a bill - a cancelled payment too', [rel('VBILL-U-0001'), S.doc.related('VBILL-U-0001')[3].label], [[['receipt', 'GRN-U-0001', 1390000], ['receipt', 'GRN-U-0002', 760000], ['order', 'PO-U-0001', 2150000], ['settlement', 'PAY-U-0001', 1000000]], 'Payment (cancelled)']);
    eq('the invoice of an order, and the order and the receipt of an invoice', [rel('SO-U-0001'), rel('INV-U-0003')], [[['invoice', 'INV-U-0003', 45000]], [['order', 'SO-U-0001', 45000], ['settlement', 'RCPT-U-0001', 45000]]]);
    eq('the write-off of a day-end, and the day-end of a write-off', [rel('DAYEND-U-0001'), rel('WO-U-0001')], [[['writeoff', 'WO-U-0001', 4820]], [['source', 'DAYEND-U-0001', 108000]]]);
    eq('the cancellation of a document, and the document of a cancellation', [rel('PAY-U-0001'), rel('CXL-U-0005')], [[['paid', 'VBILL-260101-001', 2000000], ['paid', 'VBILL-U-0001', 1000000], ['cancellation', 'CXL-U-0005', null]], [['target', 'PAY-U-0001', 3000000]]]);
    eq('a cancelled return names the invoice its credit was taken back from', rel('CXL-U-0006'), [['target', 'CN-U-0001', 9600], ['credit', 'INV-U-0004', 9600]]);
    eq('the view: party, amount, lines with names, actions with the engine\'s reason', (function (v) { return [v.typeLabel, v.statusLabel, v.party, v.amount, v.lines.map(function (l) { return [l.itemName, l.unit, l.qty]; }), v.actions]; })(S.doc.view('INV-U-0003')),
      ['Invoice', 'Posted', { kind: 'customer', id: 'c_corp', name: 'Sardar Hostel Mess' }, 45000, [['Sandwich bread', 'pcs', 15]],
        [{ op: 'cancel', label: 'Cancel', ok: false, code: 'has_dependants', reason: 'INV-U-0003 has a receipt or a credit note against it. Cancel RCPT-U-0001 first', docId: 'RCPT-U-0001' }]]);
    eq('a transfer on its way: the Owner may confirm or cancel it', S.doc.view('XFER-U-0002').actions.map(function (a) { return [a.op, a.ok]; }), [['receiveTransfer', true], ['cancel', true]]);

    /* ----- the cache: one result per state of the book and persona */
    var before = S.pnl.month('2026-03'), sameAgain = S.pnl.month('2026-03') === before, seq = book.seq;
    ok('54 a claim by production', post('production', 'EXP', { kind: 'claim', date: T1, categoryId: 'travel', unitId: 'factory', amount: 100 }));
    as('owner');
    eq('a result is remembered until the book moves, then worked out again', [sameAgain, book.seq > seq, S.pnl.month('2026-03') === before, S.approvals.pending().count, S.exp.list({ status: 'PENDING' }).map(function (e) { return e.id; })],
      [true, true, false, 5, ['EXP-U-0007', 'EXP-U-0005', 'EXP-U-0004']]);

    /* 55. with its payment taken back, the flour bill of 10 Mar (taxable 2160000, total 2173000) can be cancelled: its purchase of
       10 Mar stays in the register, the negative is dated 11 Mar, and its two receipts are once more waiting for a bill */
    ok('55 cancel VBILL-U-0001', act('accounts', 'cancel', { id: 'VBILL-U-0001', reason: 'vendor sent a corrected bill' }));
    reconcile('after 55 operations', [[T, T], [T1, T1], [GO, T1]]);
    as('owner');
    eq('the purchase register by date, and the receipts that wait for a bill', [S.buy.register({ from: T, to: T }).totals, S.buy.register({ from: T1, to: T1 }).rows.map(function (row) { return [row.docId, row.billId, row.taxable, row.gst, row.total, row.reversal]; }),
      S.buy.register({ from: GO, to: T1 }).totals.total, S.buy.openReceipts('v_stock').map(function (g) { return [g.id, g.value, g.lines.map(function (l) { return [l.itemId, l.qty, l.rate, l.gstRate, l.amount]; })]; }), S.buy.bills({ status: 'CANCELLED' }).map(function (v) { return v.id; })],
    [{ taxable: 2160000, cgst: 6500, sgst: 6500, gst: 13000, total: 2173000 }, [['CXL-U-0008', 'VBILL-U-0001', -2160000, -13000, -2173000, true]], 0,
      [['GRN-U-0001', 1390000, [['maida', 300, 3800, 0, 1140000], ['fat', 20, 12500, 5, 250000]]], ['GRN-U-0002', 760000, [['maida', 200, 3800, 0, 760000]]]], ['VBILL-U-0001']]);
  });

  section('s.4 by role: one store for the store manager, no payables for sales, salaries for the Owner and accounts only', function () {
    var whole = { from: GO, to: T1 }, sw, all, raw;
    function count(o) { return Array.isArray(o) ? o.length : (o && o.rows ? o.rows.length : (o && o.items ? o.items.length : 0)); }

    /* ----- the store manager */
    as('store_mgr');
    sw = S.sell.summary(whole);
    eq('stock: the store and what is on its way, nothing else', [S.stock.onHand().map(function (s) { return [s.locId, s.itemId, s.qty]; }), S.stock.onHand('fac_fg'), S.stock.onHand('fac_rm'), S.stock.lowStock(), S.stock.value().total,
      S.stock.ledger(whole).rows.filter(function (m) { return m.locId !== 'st_vvn' && m.locId !== 'transit_st_vvn'; }).length, S.stock.statement(whole).rows.filter(function (m) { return m.locId !== 'st_vvn' && m.locId !== 'transit_st_vvn'; }).length],
    [[['st_vvn', 'bread', 8], ['st_vvn', 'puff', 0], ['transit_st_vvn', 'bread', 5]], [], [], [], HB.money.amount(13, E.unitCost('bread')), 0, 0]);
    /* a.5: the day-end sold 105142 before GST at a cost of 33515 */
    eq('sales: the counter sales of the store', [sw.sales, sw.returns, sw.cogs, sw.byChannel.map(function (c) { return c.channel; }), sw.collections, S.sell.by('customer', whole).rows.map(function (c) { return c.key; }), S.sell.register(whole).rows.map(function (row) { return row.refId; }),
      S.sell.invoices(whole), S.sell.creditNotes(whole), S.sell.sheets()], [105142, 0, 33515, ['store'], null, ['store:st_vvn'], ['DAYEND-U-0001'], [], [], []]);
    eq('transfers, day-ends, cash: its own', [S.stores.transfers(whole).map(function (t) { return [t.id, t.toStoreId]; }), S.stores.dayEnds(whole).map(function (d) { return [d.id, d.storeId]; }), S.cash.balances(), S.cash.book('bank', whole).rows.length, S.cash.book('bank', whole).opening,
      S.cash.book('cash_factory', whole).closing, S.cash.book('cash_st_vvn', whole).closing],
    [[['XFER-U-0002', 'st_vvn'], ['XFER-U-0001', 'st_vvn']], [['DAYEND-U-0001', 'st_vvn']], { rows: [{ accountId: 'cash_st_vvn', name: 'Vidyanagar store cash', kind: 'cash', unitId: 'st_vvn', balance: 220000 }], total: 220000, cashTotal: 220000, bankTotal: 0 }, 0, 0, 0, 220000]);
    /* her claim for the store, her claim for the factory; never the salary bill, nor the claim of sales. Spend: travel 35000 + cash short 500 */
    eq('expenses: the claims and bills of her store and her own claims; spend of the store without salaries', [S.exp.list(whole).map(function (e) { return [e.id, e.kind, e.unitId, e.mine]; }), S.exp.byUnit(whole).rows.map(function (u) { return [u.unitId, u.amount]; }),
      S.exp.byCategory(whole).rows.map(function (c) { return [c.categoryId, c.amount]; })],
    [[['EXP-U-0005', 'claim', 'factory', true], ['EXP-U-0001', 'claim', 'st_vvn', true]], [['st_vvn', 35500]], [['travel', 35000], ['cash_short', 500]]]);
    /* the seed raises every store's claims under the one store-manager persona: one of another unit is not hers to see */
    book.docs['EXP-U-0005'].seed = true; S.reset();
    eq('a seeded claim under her name for another unit is outside her store: not listed, not opened', [S.exp.list(whole).map(function (e) { return e.id; }), !!S.doc.get('EXP-U-0005'), !!S.doc.get('EXP-U-0001')], [['EXP-U-0001'], false, true]);
    book.docs['EXP-U-0005'].seed = false; S.reset();
    eq('entered by her in this copy, it is hers again', S.exp.list(whole).map(function (e) { return e.id; }), ['EXP-U-0005', 'EXP-U-0001']);
    eq('the dashboard blocks of a store manager', [S.dash.today().blocks, S.dash.monthToDate().blocks, S.dash.monthToDate().sales.net, S.dash.monthToDate().spend, S.dash.monthToDate().cash.total],
      [['sales', 'cash', 'spend', 'nearExpiry'], ['sales', 'cash', 'spend', 'nearExpiry'], 105142, { total: 35500, byUnit: [{ unitId: 'st_vvn', unitName: 'Vidyanagar store', amount: 35500 }] }, 220000]);
    eq('her work: the transfer to confirm and the day-end to enter', S.dash.work().groups.map(function (g) { return [g.kind, g.items.map(function (i) { return [i.id, i.can.ok]; })]; }), [['transfer_confirm', [['XFER-U-0002', true]]], ['dayend', [['dayend:st_vvn', true]]]]);
    eq('documents: her store\'s and her own, no other', ['DAYEND-U-0001', 'XFER-U-0002', 'WO-U-0001', 'DEP-U-0002', 'EXP-U-0001', 'EXP-U-0005', 'PAY-U-0002', 'INV-U-0001', 'PO-U-0001', 'VBILL-U-0001', 'EXP-U-0002', 'EXP-U-0004', 'PAY-U-0003', 'DEP-U-0001', 'WO-U-0002', 'PROD-U-0001', 'OPENCASH-260101-001'].map(function (id) { return !!S.doc.get(id); }),
      [true, true, true, true, true, true, true, false, false, false, false, false, false, false, false, false, false]);
    eq('a related document she may not see is left out', [S.doc.related('EXP-U-0001').map(function (k) { return k.id; }), S.doc.related('XFER-U-0001')], [['PAY-U-0002'], []]);
    all = everySelector();
    eq('and everything else is empty for her', ['buy.orders', 'buy.receipts', 'buy.bills', 'buy.payments', 'buy.dueForReceipt', 'buy.openReceipts', 'buy.register', 'make.entries', 'make.todo', 'make.recipes', 'sell.receipts', 'ar.balances', 'ar.openInvoices', 'ap.balances', 'ap.dueWithin',
      'ap.toReimburse', 'people.list', 'approvals.pending', 'audit.list', 'notify.list', 'reports.list', 'pnl.entries 2026-03', 'margin.byItem', 'gst.summary'].filter(function (k) { return count(all[k]) > 0 || (all[k] && all[k].output && all[k].output.length); }), []);
    eq('P&L, receivables and payables answer with nothing', [S.pnl.month('2026-03').operatingProfit, S.pnl.month('2026-02').expenseTotal, S.ar.balances().totals.open, S.ap.balances().totals.open, S.make.costSheet('bread'), S.reports.run('pnl_monthly', whole).rows], [0, 0, 0, 0, null, []]);

    /* ----- sales */
    as('sales');
    sw = S.sell.summary({ from: T, to: T });
    eq('sales sees no payables', [S.ap.balances(), S.ap.ageing().rows, S.ap.openItems('vendor', 'v_stock'), S.ap.openItems('vendor', 'v_power'), S.ap.dueWithin(), S.ap.toReimburse(), S.buy.bills(whole), S.buy.payments(whole), S.buy.register(whole).rows,
      S.buy.orders(whole), S.lookup.vendors(), S.doc.get('VBILL-U-0001'), S.doc.get('PAY-U-0001'), S.doc.get('EXP-U-0006'), S.doc.view('VBILL-260101-001'), S.dash.today().payables, S.dash.monthToDate().blocks, S.notify.list(), S.reports.run('ap_ageing', {}).rows],
    [{ rows: [], totals: { notDue: 0, d1_15: 0, d16_30: 0, d31_60: 0, d60p: 0, open: 0, overdue: 0, items: 0, overdueItems: 0, oldestDue: null, dueSoon: 0, balance: 0, vendors: 0 } }, [], [], [], [], [], [], [], [], [], [], null, null, null, null, null,
      ['sales', 'collections', 'receivables', 'nearExpiry'], [], []]);
    /* retail 209000 - 9600 and corporate 45000 on 10 Mar; nothing of the store */
    eq('but it sees what it sells and what it is owed', [sw.byChannel.map(function (c) { return [c.channel, c.net]; }), sw.collections.total, S.ar.balances().totals.open, S.dash.today().receivables.overdueRows.map(function (o) { return [o.customerId, o.overdue]; }),
      S.stock.onHand().map(function (s) { return s.locId; }).filter(function (l) { return l !== 'fac_fg'; }), S.cash.balances().rows, S.exp.list(whole).map(function (e) { return e.id; }), S.exp.byUnit(whole).totals.amount, S.stores.dayEnds(whole), S.lookup.customers().length],
    [[['retail', 199400], ['corporate', 45000]], 1281950, 22400, [['c_week', 12800], ['c_cash', 9600]], [], [], ['EXP-U-0004'], 0, [], 3]);

    /* ----- salaries: February's bill is 9300000 for the factory and 1600000 for the store, 10900000 in all */
    var salaryFigures = /[^0-9](1600000|1800000|2500000|9300000|10900000)[^0-9]/;
    eq('for the four other roles no selector returns a salary, under any name', ['stores', 'production', 'sales', 'store_mgr'].map(function (role) {
      as(role);
      all = everySelector();
      raw = JSON.stringify(all);
      return [role, /"salary"/.test(raw), salaryFigures.test(raw), /"kind":"salary"/.test(raw), S.people.list(), S.people.headcount(), Object.keys(S.lookup.employee('E004')).indexOf('salary'), S.doc.get('EXP-U-0002'), S.doc.view('EXP-U-0002'),
        S.exp.list({ kind: 'salary' }), S.exp.byCategory({ from: '2026-02-01', to: '2026-02-28' }).totals.amount, S.pnl.entries({ monthKey: '2026-02', line: 'expense' }), E.salaryBill('2026-02').ok];
    }), ['stores', 'production', 'sales', 'store_mgr'].map(function (role) { return [role, false, false, false, [], { asOf: T1, headcount: 0, byDept: [], byUnit: [] }, -1, null, null, [], 0, [], false]; }));
    eq('the Owner and accounts see them', ['owner', 'accounts'].map(function (role) {
      as(role);
      raw = JSON.stringify(everySelector());
      return [/"salary"/.test(raw), salaryFigures.test(raw), S.people.list().map(function (e) { return e.salary; }), S.people.headcount().salary, S.lookup.employee('E004').salary, S.exp.list({ kind: 'salary' }).map(function (e) { return [e.id, e.total]; }),
        S.exp.byCategory({ from: '2026-02-01', to: '2026-02-28' }).rows.map(function (c) { return [c.categoryId, c.byUnit]; })];
    }), [0, 1].map(function () { return [true, true, [5000000, 2500000, 1800000, 1600000], 10900000, 1600000, [['EXP-U-0002', 10900000]], [['salaries', { factory: 9300000, st_vvn: 1600000 }]]]; }));

    /* ----- the other two roles, and the dashboard of each */
    eq('the dashboard blocks of every role', ['owner', 'accounts', 'stores', 'production', 'sales', 'store_mgr'].map(function (role) { as(role); return [role, S.dash.today().blocks.join(' ')]; }), [
      ['owner', 'sales collections cash spend production receivables payables approvals lowStock nearExpiry'], ['accounts', 'sales collections cash spend production receivables payables approvals lowStock nearExpiry'],
      ['stores', 'lowStock nearExpiry'], ['production', 'production lowStock nearExpiry'], ['sales', 'sales collections receivables nearExpiry'], ['store_mgr', 'sales cash spend nearExpiry']]);
    eq('today\'s work of every role: only what it may act on', ['accounts', 'stores', 'production', 'sales'].map(function (role) { as(role); return [role, S.dash.work().groups.map(function (g) { return g.kind + ' ' + g.items.filter(function (i) { return i.can.ok; }).length + '/' + g.count; })]; }), [
      ['accounts', ['sheet 0/1', 'transfer_send 0/1', 'transfer_confirm 0/1', 'receipt 0/1', 'production 0/1', 'dayend 0/1', 'approval 0/5']],
      ['stores', ['transfer_send 1/1', 'receipt 1/1']], ['production', ['production 1/1']], ['sales', ['sheet 1/1']]]);
    as('stores');
    eq('stores: orders, receipts and factory stock; no bills, no sales, no cash', [S.buy.orders(whole).length, S.buy.receipts(whole).length, S.buy.bills(whole).length, S.sell.summary(whole).sales, S.cash.balances().rows.length, S.stock.onHand().filter(function (s) { return s.locId === 'st_vvn'; }).length,
      S.stock.lowStock().map(function (l) { return [l.itemId, l.orderIds]; }), S.stores.transfers(whole).length, S.stores.dayEnds(whole).length, S.doc.related('GRN-U-0001').map(function (k) { return k.id; }), S.exp.list(whole).length],
    [3, 2, 0, 0, 0, 0, [['fat', ['PO-U-0002']]], 2, 0, ['PO-U-0001'], 0]);
    as('production');
    eq('production: entries, recipes and the two factory stores', [S.make.entries(whole).length, S.make.recipes().length, S.make.costSheet('puff').unitCost, S.stock.lowStock().map(function (l) { return [l.itemId, l.onOrder, l.orderIds]; }), S.buy.orders(whole).length, S.sell.summary(whole).sales,
      S.exp.list(whole).map(function (e) { return e.id; }), S.dash.today().production.goodUnits], [4, 2, E.unitCost('puff'), [['fat', 30, []]], 0, 0, ['EXP-U-0007'], 95]);
    as('owner');
    /* ----- which selectors answer to which role at all, and which documents each may open */
    var answers = {
      stores: 'stock.onHand stock.batches stock.ledger stock.statement stock.lowStock stock.expiring stock.value stock.counts stock.writeOffs buy.orders buy.receipts buy.dueForReceipt buy.openReceipts stores.transfers stores.pending',
      production: 'stock.onHand stock.batches stock.ledger stock.statement stock.lowStock stock.expiring stock.value stock.writeOffs make.entries make.yieldByItem make.register make.todo make.costSheet make.recipes exp.list',
      /* sales has no stock-ledger page: no ledger and no statement (SPEC 7, API 4.1) */
      sales: 'stock.onHand stock.batches stock.expiring stock.value stock.writeOffs sell.invoices sell.orders sell.creditNotes sell.receipts sell.sheets sell.summary sell.returns sell.register ' +
        'sell.by item sell.by customer sell.by route sell.by channel sell.by unit sell.by day sell.by month ar.balances ar.ageing ar.openInvoices ar.statement c_cash ar.statement c_week ar.statement c_corp exp.list',
      store_mgr: 'stock.onHand stock.batches stock.ledger stock.statement stock.value stock.writeOffs sell.summary sell.register sell.by item sell.by customer sell.by route sell.by channel sell.by unit sell.by day sell.by month ' +
        'stores.transfers stores.dayEnds stores.pending cash.balances cash.book cash_st_vvn exp.list exp.byCategory exp.byUnit'
    };
    var opens = {
      stores: 'PO-U-0001 GRN-U-0001 GRN-U-0002 XFER-U-0001 WO-U-0002 ADJ-U-0001 WO-U-0003 PO-U-0002 PO-U-0003 XFER-U-0002',
      production: 'PROD-U-0001 PROD-U-0002 WO-U-0002 WO-U-0003 PROD-U-0003 PROD-U-0004 CXL-U-0007 EXP-U-0007', /* no stock-counts page: no count */
      sales: 'INV-260101-001 INV-U-0001 INV-U-0002 SO-U-0001 INV-U-0003 RCPT-U-0001 CN-U-0001 INV-U-0004 WO-U-0002 RCPT-U-0002 CXL-U-0001 CN-U-0002 EXP-U-0004 INV-U-0005 CXL-U-0004 CXL-U-0006',
      store_mgr: 'XFER-U-0001 DAYEND-U-0001 WO-U-0001 EXP-U-0001 PAY-U-0002 DEP-U-0002 EXP-U-0005 XFER-U-0002'
    };
    /* the dashboard, the guide and the lookups answer to everybody; the rest only to a role that has a page for it */
    var forAll = { 'dash.today': 1, 'dash.monthToDate': 1, 'dash.work': 1, 'guide.journeys': 1, lookup: 1 };
    eq('the selectors that return anything, role by role', ['stores', 'production', 'sales', 'store_mgr'].map(function (role) {
      as(role);
      all = everySelector();
      return [role, Object.keys(all).filter(function (k) { return k.indexOf('doc ') !== 0 && !forAll[k] && filled(all[k]); }).join(' '), Object.keys(all).filter(function (k) { return k.indexOf('doc ') === 0 && all[k][0]; }).map(function (k) { return k.slice(4); }).join(' ')];
    }), ['stores', 'production', 'sales', 'store_mgr'].map(function (role) { return [role, answers[role], opens[role]]; }));
    eq('the Owner and accounts get every one, and every document', ['owner', 'accounts'].map(function (role) {
      as(role);
      all = everySelector();
      return [Object.keys(all).filter(function (k) { return k.indexOf('doc ') !== 0 && !filled(all[k]); }), Object.keys(all).filter(function (k) { return k.indexOf('doc ') === 0 && !all[k][0]; })];
    }), [[['ap.toReimburse', 'ap.openItems v_staff', 'ap.openItems E001', 'ap.openItems E002', 'ap.openItems E003', 'ap.openItems E004'], []], [['ap.toReimburse', 'ap.openItems v_staff', 'ap.openItems E001', 'ap.openItems E002', 'ap.openItems E003', 'ap.openItems E004'], []]]);
    as('owner');
  });

  section('s.5 review findings: no-filter values, lists of locations, returns by item, routes that stay put, report footers, a closed store, who sees what', function () {
    var W = { from: GO, to: T1 }, locs = HB.masters.locations.map(function (l) { return l.id; }), all = straightLedger(book.moves, function () { return true; }, GO, T1, 'qty');
    as('owner');

    /* ----- '', 'all' and null are no filter in every field (API 4.1): no running balance across items, every row */
    eq('ledger: \'\', \'all\' and null in every field are no filter', ['', 'all', null].map(function (v) {
      var l = S.stock.ledger({ from: GO, to: T1, locId: v, itemId: v, batchId: v, kind: v, docId: v });
      return [l.opening, l.closing, l.count, l.rows.every(function (m) { return m.balance === null; })];
    }), [0, 1, 2].map(function () { return [null, null, all.count, true]; }));
    var one = straightLedger(book.moves, function (m) { return m.locId === 'fac_fg' && m.itemId === 'bread'; }, T, T1, 'qty');
    var lot = straightLedger(book.moves, function (m) { return m.locId === 'fac_fg' && m.itemId === 'bread' && m.batchId === 'B-260309-BRD'; }, T, T1, 'qty');
    eq('ledger: a batch of \'\' or \'all\' is the whole item; one batch is that batch\'s balance; \'all\', a list of locations or a kind gives no balance',
      [['', 'all', undefined].map(function (v) { var l = S.stock.ledger({ from: T, to: T1, locId: 'fac_fg', itemId: 'bread', batchId: v }); return [l.opening, l.closing]; }),
        (function (l) { return [l.opening, l.closing, lastOf(l.rows).balance, l.count]; })(S.stock.ledger({ from: T, to: T1, locId: 'fac_fg', itemId: 'bread', batchId: 'B-260309-BRD' })),
        S.stock.ledger({ from: T, to: T1, locId: 'all', itemId: 'bread' }).opening, S.stock.ledger({ from: T, to: T1, locId: ['fac_fg', 'st_vvn'], itemId: 'bread' }).opening, S.stock.ledger({ from: T, to: T1, locId: 'fac_fg', itemId: 'bread', kind: 'dispatch' }).opening],
      [[0, 1, 2].map(function () { return [one.opening, one.closing]; }), [lot.opening, lot.closing, lot.closing, lot.count], null, null, null]);
    eq('ledger and audit log: a document filter of \'all\' is no filter; one document gives its rows alone, with no balance', [S.stock.ledger({ from: GO, to: T1, docId: 'all', kind: 'all' }).count, S.audit.list({ from: GO, to: T1, docId: 'all' }).count,
      (function (l) { return [l.count, l.opening, l.rows.map(function (m) { return [m.docId, m.qty]; })]; })(S.stock.ledger({ from: GO, to: T1, locId: 'fac_rm', itemId: 'maida', docId: 'PROD-U-0001' }))],
      [all.count, book.audit.length, [1, null, [['PROD-U-0001', -30]]]]);

    /* ----- 'all' and a list of locations cover every location asked for */
    var st = S.stock.statement(W).rows.length, bt = S.stock.batches().length, oh = S.stock.onHand().length;
    eq('statement, batches, on hand and the two stock reports take \'all\' or a list of locations', [st > 0 && bt > 0 && oh > 0,
      S.stock.statement({ from: GO, to: T1, locId: 'all' }).rows.length, S.stock.statement({ from: GO, to: T1, locId: locs }).rows.length,
      S.stock.batches({ locId: 'all' }).length, S.stock.batches({ locId: locs }).length, S.stock.batches({ locId: ['fac_fg', 'st_vvn'] }).map(function (b) { return b.locId; }),
      S.stock.onHand('all').length, S.stock.onHand(locs).length, S.stock.onHand(['fac_fg', 'st_vvn']).map(function (s) { return s.locId; }),
      S.reports.run('expiry', { locId: 'all', itemId: 'all' }).rows.length, S.reports.run('stock_statement', { from: GO, to: T1, locId: 'all' }).rows.length],
      [true, st, st, bt, bt, S.stock.batches().filter(function (b) { return b.locId === 'fac_fg' || b.locId === 'st_vvn'; }).map(function (b) { return b.locId; }), oh, oh,
        S.stock.onHand().filter(function (s) { return s.locId === 'fac_fg' || s.locId === 'st_vvn'; }).map(function (s) { return s.locId; }), bt, st]);

    /* ----- returns by item come from the lines of the documents the filter kept, so the parts add up whatever the filter */
    function straightReturnsByItem(from, to, test) {
      var items = {};
      postings().forEach(function (p) {
        var d = p.doc, s = p.sign;
        if (p.date < from || p.date > to || (d.type !== 'INV' && d.type !== 'CN') || d.opening || !test(d)) return;
        d.lines.forEach(function (l) {
          var i = cellOf(items, l.itemId, function () { return { returnUnits: 0, returns: 0, soldUnits: 0, sales: 0 }; });
          if (d.type === 'INV') { i.soldUnits += s * l.qty; i.sales += s * l.taxable; } else { i.returnUnits += s * l.qty; i.returns += s * l.taxable; }
        });
      });
      Object.keys(items).forEach(function (k) { if (items[k].returnUnits === 0 && items[k].returns === 0) delete items[k]; });
      return items;
    }
    function selectedReturnsByItem(f) {
      var out = {};
      S.sell.returns(f).byItem.forEach(function (g) { out[g.itemId] = { returnUnits: g.returnUnits, returns: g.returns, soldUnits: g.soldUnits, sales: g.sales }; });
      return out;
    }
    /* every retail outlet of the tiny company is on route r1, so to a straight pass "route r1" is "channel retail" */
    var cuts = [[{ customerId: 'c_cash' }, function (d) { return d.customerId === 'c_cash'; }], [{ customerId: 'c_week' }, function (d) { return d.customerId === 'c_week'; }],
      [{ routeId: 'r1' }, function (d) { return d.channel === 'retail'; }], [{ channel: 'corporate' }, function (d) { return d.channel === 'corporate'; }], [{ channel: 'all' }, function () { return true; }],
      [{ unitIds: ['st_vvn'] }, function () { return false; }], [{ routeId: 'nope' }, function () { return false; }], [{}, function () { return true; }]];
    function cut(rg, i) { var f = { from: rg[0], to: rg[1] }, k; for (k in cuts[i][0]) f[k] = cuts[i][0][k]; return f; }
    [[GO, T1], [T, T], [T1, T1]].forEach(function (rg) {
      eq('returns by item against the documents, ' + rg[0] + '..' + rg[1], cuts.map(function (c2, i) { return selectedReturnsByItem(cut(rg, i)); }), cuts.map(function (c2) { return straightReturnsByItem(rg[0], rg[1], c2[1]); }));
      eq('and by item and by customer add up to the totals, ' + rg[0] + '..' + rg[1], cuts.map(function (c2, i) {
        var x = S.sell.returns(cut(rg, i));
        return [x.byItem.reduce(function (s, g) { return s + g.returns; }, 0), x.byItem.reduce(function (s, g) { return s + g.returnUnits; }, 0), x.byCustomer.reduce(function (s, a) { return s + a.returns; }, 0), x.rows.reduce(function (s, q) { return s + q.taxable; }, 0)];
      }), cuts.map(function (c2, i) { var t = S.sell.returns(cut(rg, i)).totals; return [t.taxable, t.units, t.taxable, t.taxable]; }));
    });

    /* ----- every row of a dimension carries the same fields */
    eq('rows of sales by customer and by route carry their fields, null where there is no customer or no route',
      [S.sell.by('customer', W).rows.map(function (g) { return [g.key, g.customerId, g.channel, g.unitId]; }).sort(), S.sell.by('route', W).rows.map(function (g) { return [g.key, g.routeId]; })],
      [[['c_cash', 'c_cash', 'retail', 'factory'], ['c_corp', 'c_corp', 'corporate', 'factory'], ['c_week', 'c_week', 'retail', 'factory'], ['store:st_vvn', null, 'store', 'st_vvn']], [['r1', 'r1'], ['corporate', null], ['stores', null]]]);

    /* ----- report footers: the stock ledger adds quantities for one item only; order status adds the orders that stand */
    var maida = straightLedger(book.moves, function (m) { return m.locId === 'fac_rm' && m.itemId === 'maida'; }, GO, T1, 'qty');
    eq('stock ledger report: a quantity total for one item only, with its unit', [S.reports.run('stock_ledger', W).totals, S.reports.run('stock_ledger', { from: GO, to: T1, locId: 'all', itemId: 'all' }).totals, S.reports.run('stock_ledger', { from: GO, to: T1, locId: 'fac_rm', itemId: 'maida' }).totals],
      [null, null, { qtyIn: maida['in'], qtyOut: maida.out, unit: 'kg' }]);
    /* 56. the order within the limit is cancelled: it stays in the report under Cancelled and leaves the footer */
    ok('56 cancel PO-U-0002', act('stores', 'cancel', { id: 'PO-U-0002', reason: 'not needed' }));
    as('owner');
    eq('order status: the footer is the value of the orders that stand, and of what is still to come', (function (o) { return [o.totals, o.rows.map(function (q) { return [q.docId, q.statusLabel, q.amount, q.toCome, q.toComeValue]; })]; })(S.reports.run('order_status', { from: T, to: T1 })),
      [{ amount: 7600000 + 1900000 + 250000, toComeValue: 0 }, [['PO-U-0003', 'Waiting for approval', 7600000, 0, 0], ['PO-U-0002', 'Cancelled', 375000, 0, 0], ['PO-U-0001', 'Received', 1900000, 0, 0], ['PO-U-0001', 'Received', 250000, 0, 0]]]);
    reconcile('after 56 operations', [[T, T1], [GO, T1]]);

    /* ----- the route of a return or a receipt is the outlet's route when it was raised: moving the outlet does not rewrite history */
    /* 57. a receipt from the weekly outlet; then a second route (routes have no form) is added to the masters by hand */
    ok('57 RCPT from the weekly outlet', post('accounts', 'RCPT', { date: T1, customerId: 'c_week', account: 'cash_factory', amount: 10000 }));
    HB.masters.routes.push({ id: 'r2', name: 'Vidyanagar', stops: [], active: true });
    HB.masters.routeById.r2 = lastOf(HB.masters.routes);
    S.reset();
    as('owner');
    function byRoute() {
      return [S.sell.by('route', W).rows.map(function (g) { return [g.key, g.sales, g.returns, g.net]; }), ['r1', 'r2'].map(function (rt) { return [rt, S.sell.summary({ from: GO, to: T1, routeId: rt }).collections.total, S.sell.register({ from: GO, to: T1, routeId: rt }).totals.taxable]; }),
        S.sell.returns(W).rows.map(function (q) { return [q.cnId, q.routeId]; }), S.sell.returns(W).byCustomer.map(function (a) { return [a.customerId, a.routeId]; }), S.doc.view('CN-U-0002').doc.customerId];
    }
    var before = byRoute();
    /* 58. the weekly outlet moves to the new route */
    ok('58 the weekly outlet moves to route r2', act('accounts', 'master', { entity: 'customers', record: { id: 'c_week', routeId: 'r2' } }));
    as('owner');
    eq('the outlet is on the new route now', [HB.masters.customerById.c_week.routeId, HB.masters.routeById.r2.stops, before[0].map(function (g) { return g[0]; }), before[1][0][1] > 0 && before[1][0][2] > 0], ['r2', ['c_week'], ['r1', 'corporate', 'stores'], true]);
    eq('sales, returns, collections and the register by route are as before the move', byRoute(), before);
    /* 59. an invoice raised after the move carries the new route; what was raised before stays on the old one */
    ok('59 INV for the weekly outlet on its new route', post('sales', 'INV', { date: T1, customerId: 'c_week', lines: [{ itemId: 'bread', qty: 1 }] }));
    as('owner');
    eq('a document raised after the move is on the new route, the old ones stay', [S.sell.by('route', W).rows.map(function (g) { return [g.key, g.sales]; }), S.sell.register({ from: GO, to: T1, routeId: 'r2' }).rows.map(function (q) { return [q.refId, q.routeId]; }), S.sell.register({ from: GO, to: T1, routeId: 'r1' }).totals.taxable, S.sell.summary({ from: GO, to: T1, routeId: 'r1' }).collections.total],
      [[[before[0][0][0], before[0][0][1]], ['r2', 3200], [before[0][1][0], before[0][1][1]], [before[0][2][0], before[0][2][1]]], [['INV-U-0006', 'r2']], before[1][0][2], before[1][0][1]]);

    /* ----- stock counts and write-off requests have lists of their own, cut like their documents */
    function ids(rows) { return rows.map(function (q) { return q.id; }); }
    eq('counts and write-offs by role: the locations the role has, and counts only with the stock-counts page', ['owner', 'stores', 'production', 'sales', 'store_mgr'].map(function (role) { as(role); return [role, ids(S.stock.counts(W)), ids(S.stock.writeOffs(W))]; }),
      [['owner', ['ADJ-U-0001'], ['WO-U-0003', 'WO-U-0002', 'WO-U-0001']], ['stores', ['ADJ-U-0001'], ['WO-U-0003', 'WO-U-0002']], ['production', [], ['WO-U-0003', 'WO-U-0002']], ['sales', [], ['WO-U-0002']], ['store_mgr', [], ['WO-U-0001']]]);
    /* 60, 61. a count by stores (five bags short) and a write-off by the store manager wait; 62. the count is rejected: each stays in its raiser's list */
    r = ok('60 ADJ by stores', post('stores', 'ADJ', { date: T1, locId: 'fac_rm', reason: 'spot check', lines: [{ itemId: 'bag', countedQty: HB.book.stock.fac_rm.bag - 5 }] }));
    var adjId = r.doc.id;
    r = ok('61 WO by the store manager', post('store_mgr', 'WO', { date: T1, locId: 'st_vvn', reason: 'damaged', lines: [{ itemId: 'bread', batchId: 'B-260309-BRD', qty: 1 }] }));
    var woId = r.doc.id;
    as('stores');
    eq('the raiser sees its waiting count in its list, with what a page needs', S.stock.counts({ from: T1, to: T1 }).map(function (q) { return [q.id, q.status, q.waiting, q.locId, q.locName, q.unitId, q.reason, q.lineCount, q.value, q.sourceDocId, q.rejectReason, q.createdBy]; }),
      [[adjId, 'PENDING', true, 'fac_rm', 'Raw material store', 'factory', 'spot check', 1, HB.money.amount(-5, E.price('bag')), null, '', 'u_stores']]);
    eq('and nothing else lists it for her: it is not an approval, not a ledger row', [S.approvals.pending().count, S.stock.ledger({ from: T1, to: T1 }).rows.filter(function (m) { return m.refId === adjId; }).length, !!S.doc.get(adjId)], [0, 0, true]);
    as('store_mgr');
    eq('the store manager sees her write-off beside the one her day-end made', S.stock.writeOffs(W).map(function (q) { return [q.id, q.waiting, q.locId, q.reason, q.sourceDocId]; }), [[woId, true, 'st_vvn', 'damaged', null], ['WO-U-0001', false, 'st_vvn', 'expired', 'DAYEND-U-0001']]);
    ok('62 the count is rejected', act('owner', 'reject', { id: adjId, reason: 'count it again with the supervisor' }));
    as('stores');
    eq('a rejected count stays in its raiser\'s list with the reason', S.stock.counts({ status: 'REJECTED' }).map(function (q) { return [q.id, q.statusLabel, q.waiting, q.rejectReason]; }), [[adjId, 'Rejected', false, 'count it again with the supervisor']]);

    /* ----- a document id handed to a page says whether the persona may open it; the stock selectors follow the pages */
    eq('canOpen on ledger, batch and register rows is doc.get\'s answer, and false somewhere for every restricted role', ['owner', 'stores', 'production', 'sales', 'store_mgr'].map(function (role) {
      as(role);
      var led = S.stock.ledger(W).rows, bts = S.stock.batches(), reg = S.sell.register(W).rows;
      return [role, led.every(function (m) { return m.canOpen === !!S.doc.get(m.docId); }), bts.every(function (b) { return b.canOpen === !!S.doc.get(b.prodId); }), reg.every(function (q) { return q.canOpen === !!S.doc.get(q.docId); }),
        led.some(function (m) { return !m.canOpen; }) || bts.some(function (b) { return !b.canOpen; })];
    }), [['owner', true, true, true, false], ['stores', true, true, true, true], ['production', true, true, true, true], ['sales', true, true, true, true], ['store_mgr', true, true, true, true]]);
    as('sales');
    eq('sales has no stock-ledger page: no ledger, no statement, no balance; production has no stock-counts page: no count', [S.stock.ledger(W).count, S.stock.ledger(W).rows, S.stock.ledger({ from: GO, to: T1, locId: 'fac_fg', itemId: 'bread' }).opening, S.stock.statement(W), S.doc.get('ADJ-U-0001'), S.stock.counts(W), S.stock.writeOffs(W).length,
      (function () { as('production'); return [S.doc.get('ADJ-U-0001'), S.doc.view('ADJ-U-0001'), S.doc.related('ADJ-U-0001'), S.stock.counts(W), S.stock.ledger(W).count > 0, S.stock.statement(W).rows.length > 0]; })(),
      (function () { as('stores'); return [!!S.doc.get('ADJ-U-0001'), S.stock.counts(W).length, S.stock.ledger(W).count > 0]; })()],
      [0, [], null, { from: GO, to: T1, rows: [], totals: { value: 0 } }, null, [], 1, [null, null, [], [], true, true], [true, 2, true]]);

    /* ----- a doc column holds document ids or nothing */
    as('owner');
    var bad = [];
    S.reports.list().forEach(function (def) {
      var o = S.reports.run(def.id, W);
      o.columns.forEach(function (cl) {
        if (!cl.doc) return;
        o.rows.forEach(function (row) { var v = row[cl.key]; if (v !== null && v !== undefined && v !== '' && !S.doc.get(v)) bad.push(def.id + ' ' + cl.key + ' ' + v); });
      });
    });
    eq('every non-empty cell of a doc column opens a document: the audit log\'s master rows and the cash book\'s brought-forward rows carry none', [bad, S.reports.run('audit_log', W).rows.filter(function (q) { return q.isMaster; }).map(function (q) { return [q.docId, q.record, q.typeLabel]; }),
      S.reports.run('cash_book', W).rows.filter(function (q) { return q.kindLabel === 'Balance brought forward'; }).map(function (q) { return q.docId; })], [[], [[null, 'c_week', 'Customer']], [null, null, null]]);

    /* ----- what a role is told beyond its pages: nothing */
    eq('stores is told nothing of a day-end; the store manager and the Owner are', ['stores', 'store_mgr', 'owner'].map(function (role) { as(role); return [role, S.stores.pending().map(function (p) { return [p.storeId, p.dayEndMissing, p.dayEndId]; })]; }),
      [['stores', [['st_vvn', null, null]]], ['store_mgr', [['st_vvn', true, null]]], ['owner', [['st_vvn', true, null]]]]);
    eq('a role outside the customers or vendors it deals with gets a name, not the terms, the limit or the GSTIN', [
      ['stores', 'production', 'store_mgr'].map(function (role) { as(role); return S.lookup.customer('c_corp'); }), ['sales', 'production', 'store_mgr'].map(function (role) { as(role); return S.lookup.vendor('v_stock'); }),
      (function () { as('sales'); return [S.lookup.customer('c_corp').creditLimit, S.lookup.customer('c_corp').gstin]; })(), (function () { as('stores'); return [S.lookup.vendor('v_stock').gstin, S.lookup.vendor('v_stock').termsDays, S.lookup.customer('nobody')]; })()],
      [[0, 1, 2].map(function () { return { id: 'c_corp', name: 'Sardar Hostel Mess', display: 'Sardar Hostel Mess, Vallabh Vidyanagar' }; }), [0, 1, 2].map(function () { return { id: 'v_stock', name: 'Charotar Flour and Fats', display: 'Charotar Flour and Fats, Anand' }; }),
        [1000000, '24BBBBB0000B1Z4'], ['24CCCCC0000C1Z3', 15, { id: 'nobody', name: 'nobody', display: 'nobody', unknown: true }]]);

    /* ----- the monthly P&L report: whole months, never past the business date, and it says when it widened the range */
    as('owner');
    eq('the monthly P&L report never runs past the business date, and says when it widened the range to whole months', [S.reports.run('pnl_monthly', { from: GO, to: T1 }), S.reports.run('pnl_monthly', { from: '2026-02-15', to: '2026-02-20' }), S.reports.run('pnl_monthly', { from: '2026-03-05', to: T1 })].map(function (o) { return [o.from, o.to, o.note, o.columns.map(function (cl) { return cl.key; })]; }),
      [[GO, T1, '', ['label', 'm_2026-01', 'm_2026-02', 'm_2026-03', 'total']], ['2026-02-01', '2026-02-28', 'The P&L is by month: the figures cover 1 Feb 2026 to 28 Feb 2026.', ['label', 'm_2026-02', 'total']], ['2026-03-01', T1, 'The P&L is by month: the figures cover 1 Mar 2026 to 11 Mar 2026.', ['label', 'm_2026-03', 'total']]]);

    /* ----- a closed store keeps its history in the cash book report */
    /* 63-67. a second store opens, sells ten loaves across the counter and banks its cash; 68. it closes (nothing in stock, no cash) */
    r = ok('63 a store is added', act('owner', 'master', { entity: 'locations', record: { name: 'Karamsad' } }));
    var kStore = r.unit.id, kCash = HB.masters.unitById[kStore].cashAccountId;
    r = ok('64 XFER to it', post('owner', 'XFER', { date: T1, toStoreId: kStore, lines: [{ itemId: 'bread', qty: 10 }] }));
    ok('65 received', act('owner', 'receiveTransfer', { id: r.doc.id }));
    ok('66 its day-end', post('owner', 'DAYEND', { date: T1, storeId: kStore, lines: [{ itemId: 'bread', sold: 10 }], cash: 30000, upi: 9000 }));
    ok('67 its cash banked', post('owner', 'DEP', { date: T1, fromAccount: kCash, amount: 30000 }));
    as('owner');
    function cashBook(f) { var o = S.reports.run('cash_book', f); return [o.totals, o.rows.filter(function (q) { return q.kindLabel === 'Balance brought forward'; }).map(function (q) { return q.accountName; })]; }
    function straightCash(from, to) { var o = { 'in': 0, out: 0 }; HB.book.cash.entries.forEach(function (e) { if (e.date < from || e.date > to) return; if (e.amount > 0) o['in'] += e.amount; else o.out -= e.amount; }); return o; }
    var kName = HB.masters.accountById[kCash].name, open = cashBook({ from: T1, to: T1 });
    eq('the cash book report with the new store adds up to the cash rows of the day', [open[0], open[1].length, open[1].indexOf(kName) !== -1], [straightCash(T1, T1), 4, true]);
    ok('68 the store closes', act('owner', 'setActive', { entity: 'locations', id: kStore, active: false }));
    as('owner');
    eq('after the closing the report still adds up and still lists the closed account; a range before it existed leaves it out',
      [cashBook({ from: T1, to: T1 }), S.lookup.account(kCash).active, S.lookup.accounts().length, S.cash.book(kCash, { from: T1, to: T1 }).totalIn, S.cash.book(kCash, { from: T1, to: T1 }).totalOut, cashBook({ from: GO, to: Y1 })[1].length],
      [open, false, 3, 30000, 30000, 3]);
    as('owner');
  });

  section('s.6 reported by the screens: the cost on an invoice by role, a dispatch sheet by its id, entered or raised', function () {
    var W = { from: GO, to: HB.calendar.today }, DS = 'DS-r1-260310', OTHERS = ['stores', 'production', 'store_mgr'];
    function costKeys(o) { return Object.keys(o).filter(function (k) { return k === 'cost' || k === 'unitCost'; }); }

    /* ----- cost and margin of an invoice: the Owner and accounts. For sales the fields are absent, not zero.
       a.4: INV-U-0001 is 20 loaves at a cost of 1186.25 (23725) and 10 puffs at 482 (4820): 28545 */
    eq('the Owner and accounts: the cost on the row, on the lines of the view, and the costing', ['owner', 'accounts'].map(function (role) {
      as(role);
      var row = S.sell.invoices(W).filter(function (i) { return i.id === 'INV-U-0001'; })[0], v = S.doc.view('INV-U-0001');
      return [row.cost, v.lines.map(function (l) { return [l.itemId, l.unitCost, l.cost]; }), v.costing.cost, S.sell.invoices(W).every(function (i) { return i.cost === i.doc.cost; })];
    }), [0, 1].map(function () { return [28545, [['bread', 1186.25, 23725], ['puff', 482, 4820]], 28545, true]; }));
    as('sales');
    x = S.doc.view('INV-U-0001');
    eq('sales: no cost on any invoice row, none on the lines of any invoice view, no costing', [S.sell.invoices(W).length > 5, S.sell.invoices(W).filter(function (i) { return costKeys(i).length; }).map(function (i) { return i.id; }),
      book.byType.INV.filter(function (d) { var v = S.doc.view(d.id); return !v || v.costing !== null || v.lines.some(function (l) { return costKeys(l).length; }); }).map(function (d) { return d.id; }),
      x.lines.map(function (l) { return [l.itemName, l.unit, l.qty, l.price, l.taxable, l.batches.length]; }), 'cost' in S.sell.invoices(W)[0]],
    [true, [], [], [['Sandwich bread', 'pcs', 20, 3200, 64000, 1], ['Veg puff', 'pcs', 10, 1100, 11000, 1]], false]);
    as('owner');
    eq('and the Owner, asked after sales, gets the cost again: one result per persona', [S.sell.invoices(W).filter(function (i) { return i.id === 'INV-U-0001'; })[0].cost, costKeys(S.doc.view('INV-U-0001').lines[0])], [28545, ['unitCost', 'cost']]);

    /* ----- a dispatch sheet by its id. a.4 posted the sheet of route r1 on 10 Mar as INV-U-0001 (cash outlet, 75550 collected) and
       INV-U-0002 (weekly outlet), which s.3 cancelled the next day: the sheet stays posted on the one invoice left */
    as('sales');
    x = S.sell.sheet(DS);
    eq('the sheet: route, date, posted, its invoices in the order posted - the cancelled one too', [x.id, x.type, x.typeLabel, x.sheetId, x.routeId, x.routeName, x.date, x.posted, x.invoiceIds, x.invoices.map(function (i) { return [i.id, i.customerId, i.total, i.cancelled]; }), x.units, x.total, x.collected],
      [DS, 'DS', 'Dispatch sheet', DS, 'r1', 'Anand town', T, true, ['INV-U-0001'], [['INV-U-0001', 'c_cash', 75550, false], ['INV-U-0002', 'c_week', 119100, true]], 30, 75550, 75550]);
    eq('it agrees with the row of sell.sheets for that day', (function (row) { return [row.sheetId, row.posted, row.invoiceIds, row.units, row.total, row.collected]; })(S.sell.sheets(T)[0]), [x.sheetId, x.posted, x.invoiceIds, x.units, x.total, x.collected]);
    eq('doc.get answers with the same record, of type DS: what the router reads to find the page', [S.doc.get(DS) === x, String(S.doc.get(DS).type).toUpperCase(), HB.engine.sheetId(x.routeId, x.date)], [true, 'DS', DS]);
    eq('doc.view: the route as the party, the quantities by product of the invoice that stands, its one action', (function (v) { return [v.id, v.type, v.typeLabel, v.date, v.status, v.statusLabel, v.cancelled, v.createdBy, v.party, v.amount, v.lines, v.approval.state, v.cancellation, v.actions, v.doc === x]; })(S.doc.view(DS)),
      [DS, 'DS', 'Dispatch sheet', T, 'POSTED', 'Posted', false, 'u_sales', { kind: 'route', id: 'r1', name: 'Anand town' }, 75550,
        [{ itemId: 'bread', itemName: 'Sandwich bread', unit: 'pcs', qty: 20, taxable: 64000 }, { itemId: 'puff', itemName: 'Veg puff', unit: 'pcs', qty: 10, taxable: 11000 }], 'none', null,
        [{ op: 'cancelDispatch', label: 'Cancel the sheet', ok: true, code: '', reason: '', docId: null }], true]);
    eq('its related documents are its invoices; it has no history of its own', [S.doc.related(DS).map(function (k) { return [k.relation, k.label, k.id, k.amount]; }), S.doc.timeline(DS)],
      [[['invoice', 'Invoice', 'INV-U-0001', 75550], ['invoice', 'Invoice (cancelled)', 'INV-U-0002', 119100]], []]);
    eq('a sheet that was never posted is a sheet all the same, with nothing to cancel', (function (s, v) { return [s.posted, s.invoiceIds, s.invoices, s.total, v.status, v.statusLabel, v.createdBy, v.lines, v.actions]; })(S.sell.sheet('DS-r1-260309'), S.doc.view('DS-r1-260309')), [false, [], [], 0, '', 'Not posted', null, [], []]);
    eq('an id that names no route or no day is nothing', ['DS-zz-260310', 'DS-r1-261310', 'DS-r1-260230', 'DS-r1-2603', 'DS-r1', 'DS--260310', '', null, undefined].map(function (id) { return [S.sell.sheet(id), S.doc.get(id), S.doc.view(id)]; }),
      [0, 1, 2, 3, 4, 5, 6, 7, 8].map(function () { return [null, null, null]; }));
    eq('the roles without the sales documents get no sheet', OTHERS.map(function (role) { as(role); return [S.sell.sheet(DS), S.doc.get(DS), S.doc.view(DS), S.doc.related(DS)]; }), OTHERS.map(function () { return [null, null, null, []]; }));

    /* ----- the first line of a history: a record of what happened is "Entered", a request or a claim on someone is "Raised" */
    as('owner');
    function first(id) { var t = S.doc.timeline(id)[0]; return t ? [t.type, t.label] : [id, 'no history']; }
    eq('entered: goods receipt, production entry, receipt, payment, deposit, day-end, transfer', ['GRN-U-0001', 'PROD-U-0001', 'RCPT-U-0001', 'PAY-U-0001', 'DEP-U-0001', 'DAYEND-U-0001', 'XFER-U-0001'].map(first),
      [['GRN', 'Entered'], ['PROD', 'Entered'], ['RCPT', 'Entered'], ['PAY', 'Entered'], ['DEP', 'Entered'], ['DAYEND', 'Entered'], ['XFER', 'Entered']]);
    eq('raised: order, bill, sales order, invoice, return, count, write-off, expense', ['PO-U-0001', 'VBILL-U-0001', 'SO-U-0001', 'INV-U-0001', 'CN-U-0001', 'ADJ-U-0001', 'WO-U-0001', 'EXP-U-0001'].map(first),
      [['PO', 'Raised'], ['VBILL', 'Raised'], ['SO', 'Raised'], ['INV', 'Raised'], ['CN', 'Raised'], ['ADJ', 'Raised'], ['WO', 'Raised'], ['EXP', 'Raised']]);
    eq('what follows keeps its own words', [S.doc.timeline('XFER-U-0001').map(function (t) { return t.label; }), S.doc.timeline('PAY-U-0001').map(function (t) { return t.label; })], [['Entered', 'Received by the store'], ['Entered', 'Cancelled']]);

    /* ----- reported by the audit log and the reports screen: a note as a sentence, what was done to a master record and to
       which by name, an in or out column that stays empty at zero, a rate in a CSV without a tail of binary noise */
    as('owner');
    eq('the note of an order approved as submitted is a sentence, in the timeline and in the audit log',
      [S.doc.timeline('PO-U-0001')[0].note, S.audit.list({ from: GO, to: HB.calendar.today, docId: 'PO-U-0001' }).rows.map(function (q) { return q.note; }).indexOf('within limit')], ['Within the limit, approved as submitted', -1]);
    x = S.audit.list({ from: GO, to: HB.calendar.today, masters: true, limit: 0 }).rows;
    eq('a master change says what was done, and names the record', [x.length > 0, x.filter(function (q) { return ['Added', 'Changed', 'Deactivated', 'Activated'].indexOf(q.actionLabel) === -1 || !q.recordName || q.text.indexOf(q.recordName) === -1; }).length,
      x.filter(function (q) { return q.action === 'setActive' && q.type === 'locations'; }).map(function (q) { return [q.actionLabel, q.recordName, q.text]; })[0]], [true, 0, ['Deactivated', 'Karamsad', 'Location Karamsad: deactivated']]);
    x = S.reports.run('audit_log', W);
    eq('the audit log report: date and time apart, the status before and after, the record by name', [x.columns.map(function (cl) { return cl.key; }), x.rows.filter(function (q) { return q.docId === 'PAY-U-0001'; }).map(function (q) { return [q.beforeLabel, q.afterLabel]; }),
      x.rows.filter(function (q) { return q.isMaster && q.action === 'setActive' && q.type === 'locations'; }).map(function (q) { return [q.recordName, q.beforeLabel, q.afterLabel]; })[0]],
    [['date', 'time', 'userName', 'roleLabel', 'actionLabel', 'typeLabel', 'docId', 'recordName', 'beforeLabel', 'afterLabel', 'note'], [['Posted', 'Cancelled'], ['', 'Posted']], ['Karamsad', 'Active', 'Inactive']]);
    x = S.reports.run('cash_book', W);
    var inCol = x.columns.filter(function (cl) { return cl.key === 'in'; })[0], paid = x.rows.filter(function (q) { return q.out > 0 && q['in'] === 0; })[0];
    eq('in the cash book a payment leaves Money in empty, on screen and in the CSV, as on the cash screen', [S.reports.cell(inCol, paid), S.reports.csvColumns(x).filter(function (cl) { return cl.key === 'in'; })[0].value(paid)], ['', '']);
    x = S.reports.run('stock_ledger', W);
    eq('the stock ledger report: an issue leaves In empty, and it says how to get the running balance', [S.reports.cell(x.columns.filter(function (cl) { return cl.key === 'qtyIn'; })[0], x.rows.filter(function (q) { return q.qtyOut > 0; })[0]), /one stock location and one item/.test(x.note),
      /one stock location and one item/.test(S.reports.run('stock_ledger', { from: GO, to: HB.calendar.today, locId: 'fac_rm', itemId: 'maida' }).note)], ['', true, false]);
    x = S.reports.run('production_register', W);
    eq('a rate in a CSV carries four decimals of a rupee at most, a money amount two', [S.reports.csvColumns(x).filter(function (cl) { return cl.key === 'unitCost' || cl.key === 'lossValue'; }).map(function (cl) {
      return x.rows.filter(function (q) { var v = cl.value(q), d = cl.key === 'unitCost' ? 10000 : 100; return v !== '' && Math.abs(v * d - Math.round(v * d)) > 1e-6 || String(v).length > 12; }).length;
    }), x.rows.length > 0], [[0, 0], true]);

    /* ----- a P&L line whose rows net to zero in the month is not listed: the Owner's repairs claim for the store, approved
       as it is raised and cancelled on the same day, leaves two rows of 4400 and -4400 and no line at 0.00 */
    as('owner');
    var mk = HB.calendar.today.slice(0, 7), keysOf = function () { return S.pnl.month(mk).lines.map(function (l) { return [l.key, l.amount]; }); }, was = keysOf();
    x = ok('a repairs claim by the Owner', post('owner', 'EXP', { kind: 'claim', date: HB.calendar.today, categoryId: 'repairs', unitId: 'st_vvn', amount: 4400 })).doc;
    eq('it is a line of the month while it stands', S.pnl.month(mk).lines.filter(function (l) { return l.key === 'expense.repairs'; }).map(function (l) { return l.amount; }), [4400]);
    ok('cancel it', act('owner', 'cancel', { id: x.id, reason: 'raised for the wrong store' }));
    eq('cancelled the same month: the statement is as it was, with no line at zero, and the two rows are still behind the month',
      [was.some(function (l) { return l[0] === 'expense.repairs'; }), keysOf(), S.pnl.entries({ monthKey: mk, line: 'expense', categoryId: 'repairs' }).map(function (e) { return e.amount; })],
      [false, was, [4400, -4400]]);
    as('owner');
  });

  /*
   * s.7: what the screens read of the two additions of 3 October 2026, on a new copy of the tiny company dated 10 Mar:
   * a document entered with a warning, and a dispatch sheet cancelled in one action. The arithmetic is in a.17 and a.18.
   */
  section('s.7 a warning as the screens read it; a posted sheet and its one action, by role, before and after it is cancelled', function () {
    var DS = 'DS-r1-260310', R = HB.fmt.rupee, why = 'the van broke down', held = 'The sheet cannot be cancelled: INV-U-0002 has a receipt or a credit note against it. Cancel RCPT-U-0001 first';
    var warned = 'Entered with a warning: Maida: ' + R + '50.00 against the latest purchase price of ' + R + '36.00, more than 25% away';
    function action(role) { as(role); return S.doc.view(DS).actions; }
    HB.store.remove('log');
    HB.calendar.set(T);
    as('owner');
    E.boot();
    book = HB.book;
    /* 1, 2. PROD: bread 3 mixes, 120 good; puff 1 mix, 100 good. 3. PO: 10 kg of maida at 5000, within the limit, 38.9% above the latest price */
    ok('PROD bread', post('production', 'PROD', { date: T, itemId: 'bread', mixes: 3, goodUnits: 120 }));
    ok('PROD puff', post('production', 'PROD', { date: T, itemId: 'puff', mixes: 1, goodUnits: 100 }));
    ok('PO at a rate far off', post('stores', 'PO', { date: T, vendorId: 'v_stock', lines: [{ itemId: 'maida', qty: 10, rate: 5000 }] }));
    /* 4, 5. two claims by the store manager: Rs 8,000, above what a claim normally is, and Rs 350 */
    ok('claim of Rs 8,000', post('store_mgr', 'EXP', { kind: 'claim', date: T, categoryId: 'travel', unitId: 'st_vvn', amount: 800000 }));
    ok('claim of Rs 350', post('store_mgr', 'EXP', { kind: 'claim', date: T, categoryId: 'travel', unitId: 'st_vvn', amount: 35000 }));
    as('owner');
    eq('the view carries the codes of the warnings and what they said; nothing for a document entered without one',
      [S.doc.view('PO-U-0001').warned, S.doc.view('PO-U-0001').warning, S.doc.view('PROD-U-0001').warned, S.doc.view('PROD-U-0001').warning, S.doc.view('INV-260101-001').warned],
      [['rate_far'], 'Maida: ' + R + '50.00 against the latest purchase price of ' + R + '36.00, more than 25% away', [], '', []]);
    eq('what waits for the Owner says what it was warned about, so that the decision is taken knowing it', S.approvals.pending().items.map(function (i) { return [i.id, i.warning]; }),
      [['EXP-U-0001', 'A claim of ' + R + '8,000.00 is well above what a claim normally is, ' + R + '5,000.00 or less'], ['EXP-U-0002', '']]);
    eq('the history and the audit log say it in a sentence, after what the entry said already', [S.doc.timeline('PO-U-0001')[0].note, S.audit.list({ from: T, to: T, docId: 'PO-U-0001' }).rows.map(function (q) { return [q.note, q.text]; })],
      ['Within the limit, approved as submitted. ' + warned, [['Within the limit, approved as submitted. ' + warned, 'Purchase order PO-U-0001: entered, approved (Within the limit, approved as submitted. ' + warned + ')']]]);

    /* 6. the sheet as prefilled: INV-U-0001 (cash outlet, 75550 collected) and INV-U-0002 (weekly outlet, 119100). 7. 19100 received against the second */
    ok('the sheet', act('sales', 'postDispatch', { routeId: 'r1', date: T, outlets: E.dispatchSheet('r1', T).outlets }));
    ok('RCPT', post('accounts', 'RCPT', { date: T, customerId: 'c_week', account: 'cash_factory', amount: 19100, allocations: [{ docId: 'INV-U-0002', amount: 19100 }] }));
    eq('a posted sheet has one action. With a receipt against one of its invoices it is locked, with the reason and the document to cancel first; for accounts it is locked by role',
      [action('sales'), action('owner'), action('accounts')],
      [[{ op: 'cancelDispatch', label: 'Cancel the sheet', ok: false, code: 'has_dependants', reason: held, docId: 'RCPT-U-0001' }],
        [{ op: 'cancelDispatch', label: 'Cancel the sheet', ok: false, code: 'has_dependants', reason: held, docId: 'RCPT-U-0001' }],
        [{ op: 'cancelDispatch', label: 'Cancel the sheet', ok: false, code: 'role', reason: 'Accounts and admin cannot cancel a dispatch sheet: that is for Sales and dispatch or the Owner', docId: null }]]);
    /* 8. the receipt is cancelled: the action is free for sales and the Owner */
    ok('cancel the receipt', act('accounts', 'cancel', { id: 'RCPT-U-0001', reason: 'received for another outlet' }));
    eq('free for sales and the Owner, still locked for accounts', [action('sales'), action('owner'), action('accounts').map(function (a) { return [a.ok, a.code]; })],
      [[{ op: 'cancelDispatch', label: 'Cancel the sheet', ok: true, code: '', reason: '', docId: null }], [{ op: 'cancelDispatch', label: 'Cancel the sheet', ok: true, code: '', reason: '', docId: null }], [[false, 'role']]]);
    as('sales');
    eq('today\'s work has no sheet to post while it stands', S.dash.work().groups.filter(function (g) { return g.kind === 'sheet'; }).length, 0);

    /* what the day's sales are listed by, while the sheet stands: two products, two outlets, one route, one unit */
    function listed() {
      var f = { from: T, to: T };
      return [['item', 'customer', 'route', 'unit'].map(function (dim) { return S.sell.by(dim, f).rows.map(function (g) { return g.key; }); }), S.margin.byItem(f).rows.length,
        ['sales_by_item', 'sales_by_customer', 'sales_by_route', 'product_margin'].map(function (k) { return S.reports.run(k, f).rows.length; }), S.sell.by('day', f).rows.length, S.sell.by('channel', f).rows.length];
    }
    as('owner');
    eq('while the sheet stands, the day is listed by what was sold', listed(), [[['bread', 'puff'], ['c_week', 'c_cash'], ['r1'], ['factory']], 2, [2, 2, 1, 2], 1, 3]);
    as('sales');
    eq('a sheet of today can be posted again once cancelled, and the screens say so beforehand', S.sell.sheet(DS).repost, { ok: true, code: '', reason: '', owner: true });

    /* 9. sales cancels the sheet */
    ok('cancel the sheet', act('sales', 'cancelDispatch', { sheetId: DS, reason: why }));
    as('owner');
    eq('cancelled the same day, nothing of it is listed with zeros: no product, outlet, route or unit, no margin row, no report row; the day and the channels are still bars',
      listed(), [[[], [], [], []], 0, [0, 0, 0, 0], 1, 3]);
    /* the outlets' statements: the cash outlet was invoiced 75550 and paid it at the drop, the weekly outlet invoiced 119100
       and paid 19100 by a receipt since cancelled; every row has its opposite, so what was invoiced and what was paid or
       credited come to nothing, each cancellation a negative figure in the column of what it cancels. Added up by sign,
       debit and credit carry both */
    eq('the statements of the day: invoiced and paid come to nothing; debit and credit add the rows up by sign',
      ['c_cash', 'c_week'].map(function (id) { var s = S.ar.statement(id, { from: T, to: T }); return [s.opening, s.invoiced, s.settled, s.closing, s.debit, s.credit, s.rows.map(function (q) { return [q.docId, q.kind, q.invoiced, q.settled]; })]; }),
      [[0, 0, 0, 0, 151100, 151100, [['INV-U-0001', 'invoice', 75550, 0], ['INV-U-0001', 'collected', 0, 75550], ['CXL-U-0002', 'invoice', -75550, 0], ['CXL-U-0002', 'collected', 0, -75550]]],
        [0, 0, 0, 0, 138200, 138200, [['INV-U-0002', 'invoice', 119100, 0], ['RCPT-U-0001', 'receipt', 0, 19100], ['CXL-U-0001', 'receipt', 0, -19100], ['CXL-U-0003', 'invoice', -119100, 0]]]]);
    as('sales');
    x = S.sell.sheet(DS);
    eq('the sheet is to post again: no invoice stands, both are listed as cancelled, and it has no action', [(function (row) { return [row.posted, row.toPost, row.invoices, row.invoiceIds, row.units, row.total, row.collected]; })(S.sell.sheets(T)[0]),
      x.posted, x.invoices.map(function (i) { return [i.id, i.cancelled]; }), x.total, (function (v) { return [v.status, v.statusLabel, v.lines, v.actions]; })(S.doc.view(DS)),
      S.doc.related(DS).map(function (k) { return [k.label, k.id]; })],
    [[false, true, 0, [], 0, 0, 0], false, [['INV-U-0001', true], ['INV-U-0002', true]], 0, ['', 'Not posted', [], []], [['Invoice (cancelled)', 'INV-U-0001'], ['Invoice (cancelled)', 'INV-U-0002']]]);
    eq('and it is back on today\'s work', S.dash.work().groups.filter(function (g) { return g.kind === 'sheet'; }).map(function (g) { return g.items.map(function (i) { return [i.id, i.can.ok]; }); }), [[[DS, true]]]);
    eq('each invoice says who cancelled it and why, and leads to its own cancellation', ['INV-U-0001', 'INV-U-0002'].map(function (id) { var v = S.doc.view(id); return [v.status, v.cancellation.byName, v.cancellation.reason, v.cancellation.docId, S.doc.timeline(id).map(function (t) { return t.label; }), v.actions]; }),
      [['CANCELLED', 'Imran Vohra', why, 'CXL-U-0002', ['Raised', 'Cancelled'], []], ['CANCELLED', 'Imran Vohra', why, 'CXL-U-0003', ['Raised', 'Cancelled'], []]]);
    eq('a cancellation leads back to its invoice', S.doc.related('CXL-U-0003').map(function (k) { return [k.relation, k.label, k.id]; }), [['target', 'Cancellation of', 'INV-U-0002']]);
    /* rows, not statuses: the day's sales are the two invoices and their two reversals, and come to nothing */
    as('owner');
    eq('the sales of the day come to nothing, row by row; the cash collected went back out', [(function (m) { return [m.sales, m.net, m.cogs, m.units]; })(S.sell.summary({ from: T, to: T })),
      S.sell.register({ from: T, to: T }).rows.map(function (q) { return [q.docId, q.taxable]; }), S.cash.book('cash_factory', { from: T, to: T }).rows.slice(-2).map(function (c) { return [c.docId, c.refId, c.amount, c.reversal]; }), S.cash.balances().rows.filter(function (c) { return c.accountId === 'cash_factory'; })[0].balance],
    [[0, 0, 0, 0], [['INV-U-0001', 75000], ['INV-U-0002', 118000], ['CXL-U-0002', -75000], ['CXL-U-0003', -118000]], [['CXL-U-0001', 'RCPT-U-0001', -19100, true], ['CXL-U-0002', 'INV-U-0001', -75550, true]], 5000000]);
    reconcile('after the sheet and its cancellation', [[T, T], [GO, T]]);

    /* whether a sheet can be posted again is the date rules' to say, for the persona that would post it: what the dispatch
       screen tells before "Cancel the sheet" (the dialog, the toast, the callout). Five days on, sales may not go back to
       10 Mar and the Owner may; in May, March is locked for everybody */
    function repost(role) { as(role); return S.sell.sheet(DS).repost; }
    HB.calendar.set('2026-03-15');
    E.boot();
    book = HB.book;
    eq('on 15 Mar: only the Owner can post the sheet of 10 Mar; accounts may date it, but does not post sheets', [repost('sales'), repost('owner'), repost('accounts').ok],
      [{ ok: false, code: 'backdate_limit', reason: 'This role can go back 3 days at most, to 12 Mar 2026. Accounts and the Owner can enter an earlier date in an open month', owner: true }, { ok: true, code: '', reason: '', owner: true }, true]);
    HB.calendar.set('2026-05-02');
    E.boot();
    book = HB.book;
    eq('on 2 May: nobody can, March being locked', [repost('sales'), repost('owner')],
      [0, 1].map(function () { return { ok: false, code: 'locked_month', reason: 'Mar 2026 is a locked month: entries can be dated from 1 Apr 2026', owner: false }; }));
    HB.calendar.set(T);
    as('owner');
    E.boot();
    book = HB.book;
  });

  if (keptSeed) HB.seed = keptSeed;
}

/* ================================================ parts (b) and (c) */
/*
 * (b) the full seed: the calendar, build time for the three business dates, reconciliations by a straight pass
 *     over the raw documents, determinism and prefix stability on seq, the dated master changes, the hand-over
 *     and the material cover of every simulated day, the calibration bands.
 * (c) behaviour on the full seed, on nine business dates over the two years: the stories of RESEARCH 12, the
 *     guide journeys as the personas and as the Owner, a refusal by role, save-rebuild-replay.
 * Both live in tools/check-seed.js, which loads the full config and the seed in place of the tiny company and
 * puts back what was there when it is done; its sections are taken over as they are.
 */

function seedPart(which) {
  return function () {
    var res = require(path.join(__dirname, 'check-seed.js')).run({ part: which });
    res.sections.forEach(function (s) { part.sections.push({ title: s.title, checks: s.checks, failures: s.failures.slice(), lines: s.lines.slice() }); });
  };
}

var PARTS = [
  { key: 'a', title: 'the hand-worked tiny company (tools/fixture-tiny.js)', run: partA },
  { key: 's', title: 'the selectors on the tiny company (js/data/data.js)', run: partS },
  { key: 'b', title: 'the full seed, reconciled (tools/check-seed.js)', run: seedPart('b') },
  { key: 'c', title: 'behaviour on the full seed (tools/check-seed.js)', run: seedPart('c') }
];

/* ================================================================ run */

function main() {
  var args = process.argv.slice(2);
  var wanted = args.filter(function (a) { return a.charAt(0) !== '-'; }).map(function (a) { return a.toLowerCase(); });
  var verbose = args.indexOf('-v') !== -1 || args.indexOf('--verbose') !== -1;
  var checks = 0, failed = 0;
  var unknown = wanted.filter(function (w) { return !PARTS.some(function (p) { return p.key === w; }); });
  if (unknown.length) {
    /* a mistyped part must not read as "0 checks, all passed" */
    console.log('No such part: ' + unknown.join(', ') + '. The parts are ' + PARTS.map(function (p) { return p.key; }).join(', ') + '.');
    process.exit(1);
  }

  PARTS.forEach(function (p) {
    if (wanted.length && wanted.indexOf(p.key) === -1) return;
    part = { key: p.key, title: p.title, sections: [] };
    results.push(part);
    try { p.run(); }
    catch (e) {
      sec = { title: 'part (' + p.key + ') could not run', checks: 0, failures: ['stopped by an error: ' + (e && e.stack ? e.stack.split('\n').slice(0, 4).join(' | ') : String(e))] };
      part.sections.push(sec);
    }
    /* a part that ran nothing has checked nothing: that is a failure, not a pass */
    if (!part.sections.length) part.sections.push({ title: 'part (' + p.key + ') ran no checks', checks: 0, failures: ['no section was run'] });
  });

  results.forEach(function (p) {
    console.log('\nPart (' + p.key + ') ' + p.title);
    p.sections.forEach(function (s) {
      checks += s.checks;
      failed += s.failures.length;
      console.log('  ' + (s.failures.length ? 'FAIL  ' : 'ok    ') + s.title + '  (' + s.checks + ' checks' + (s.failures.length ? ', ' + s.failures.length + ' failed' : '') + ')');
      if (verbose) (s.lines || []).forEach(function (l) { console.log('      ' + l); });
      s.failures.forEach(function (f) { console.log('          - ' + f); });
    });
  });

  console.log('\n' + checks + ' checks, ' + failed + ' failed' + (failed ? '' : ' - all passed'));
  process.exit(failed ? 1 : 0);
}

main();
