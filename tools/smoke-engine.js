/*
 * Smoke test of the posting core on the tiny fixture: one of each document type, each action, the refusals,
 * post-then-cancel, master changes and the prefilled sheets. Every expected figure below was worked out by
 * hand from tools/fixture-tiny.js (the arithmetic is in the comments), not copied from a run.
 *   node tools/smoke-engine.js            run the checks, print stock, balances and P&L
 *   node tools/smoke-engine.js --bench    also post two years of documents and print the time taken
 * Exit code 1 on any failure.
 */
'use strict';

var path = require('path');
var HB = require(path.join(__dirname, '..', 'js', 'core', 'kernel.js'));
require(path.join(__dirname, 'fixture-tiny.js'));
require(path.join(__dirname, '..', 'js', 'data', 'engine.js'));

var core = HB.engine.core;
var failures = [], checks = 0;

function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

function eq(label, actual, expected) {
  checks++;
  if (!same(actual, expected)) failures.push(label + ': expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
}

/** The operation must succeed; returns its result. */
function ok(label, res) {
  checks++;
  if (!res || !res.ok) failures.push(label + ': refused - ' + (res && res.error ? res.error.code + ': ' + res.error.message : 'no result'));
  return res || {};
}

/** The operation must be refused with this code (and, when given, name this document). */
function refused(label, res, code, docId) {
  checks++;
  if (!res || res.ok) { failures.push(label + ': expected a refusal (' + code + '), but it went through'); return; }
  if (res.error.code !== code) failures.push(label + ': expected code ' + code + ', got ' + res.error.code + ' - ' + res.error.message);
  if (docId !== undefined && res.error.docId !== docId) failures.push(label + ': expected docId ' + docId + ', got ' + res.error.docId);
  if (!res.error.message || typeof res.error.message !== 'string') failures.push(label + ': the refusal has no message');
}

/** A context: who, in which role, when. */
function as(role, at, extra) {
  var ctx = { userId: 'u_' + role, role: role, at: at };
  for (var k in extra || {}) ctx[k] = extra[k];
  return ctx;
}

/** Drop the zeros: a balance that came back to nothing is the same as one that was never there. */
function noZeros(x) {
  if (x === null || typeof x !== 'object') return x;
  if (Array.isArray(x)) return x.map(noZeros);
  var out = {};
  Object.keys(x).sort().forEach(function (k) { if (x[k] !== 0) out[k] = noZeros(x[k]); });
  return out;
}

/** Everything a cancellation must put back, in one comparable object. */
function snapshot() {
  var b = HB.book;
  return noZeros(JSON.parse(JSON.stringify({
    stock: b.stock, lots: b.lots, reserved: b.reserved,
    arBalance: b.ar.balance, arTotal: b.ar.total, credit: b.ar.credit,
    open: Object.keys(b.ar.open).map(function (c) { return b.ar.open[c].map(function (d) { return [d.id, HB.engine.openAmount(d)]; }); }),
    apBalance: b.ap.balance, apTotal: b.ap.total, cash: b.cash.balance, pnlMonth: b.pnlMonth,
    gst: b.gst.reduce(function (s, r) { return s + r.taxable + r.cgst + r.sgst; }, 0),
    prices: Object.keys(b.prices).map(function (k) { return [k, b.prices[k].rate]; })
  })));
}

function lotQty(locId, itemId, batchId) {
  var list = (HB.book.lots[locId] || {})[itemId] || [];
  for (var i = 0; i < list.length; i++) if (list[i].batchId === batchId) return list[i].qty;
  return 0;
}

function main() {
  HB.engine.reset();
  var book = HB.book, M = HB.masters, r;

  /* ------------------------------------------------ opening entries, 1 Jan */
  var seed = { seed: true };
  refused('opening stock is seed only', core.openStock({ date: '2026-01-01', lines: [{ locId: 'fac_rm', itemId: 'maida', qty: 1, rate: 100 }] }, as('owner', '2026-01-01T08:00')), 'invalid_input');
  ok('OPENSTOCK', core.openStock({
    date: '2026-01-01', lines: [
      { locId: 'fac_rm', itemId: 'maida', qty: 200, rate: 3600 },
      { locId: 'fac_rm', itemId: 'fat', qty: 50, rate: 12000 },
      { locId: 'fac_rm', itemId: 'bag', qty: 1000, rate: 80 },
      { locId: 'fac_fg', itemId: 'bread', qty: 60, mfgDate: '2025-12-31' }
    ]
  }, as('accounts', '2026-01-01T08:00', seed)));
  ok('OPENCASH', core.openCash({ date: '2026-01-01', lines: [{ accountId: 'cash_factory', amount: 5000000 }, { accountId: 'cash_st_vvn', amount: 200000 }, { accountId: 'bank', amount: 30000000 }] }, as('accounts', '2026-01-01T08:00', seed)));
  var openInv = ok('opening INV', core.openInv({ date: '2026-01-01', customerId: 'c_corp', total: 1000000, dueDate: '2026-01-15' }, as('accounts', '2026-01-01T08:00', seed))).doc;
  var openBill = ok('opening VBILL', core.openBill({ date: '2026-01-01', vendorId: 'v_stock', total: 2000000, dueDate: '2026-01-10' }, as('accounts', '2026-01-01T08:00', seed))).doc;
  eq('seeded id', openInv.id, 'INV-260101-001');
  eq('opening batch', book.lots.fac_fg.bread[0], { batchId: 'B-251231-BRD', bestBefore: '2026-01-04', mfgDate: '2025-12-31', qty: 60, reserved: 0 });
  /* bread (10 x 3600 + 0.5 x 12000) / 40 + 80 = 1130; puff (4 x 3600 + 2 x 12000) / 100 + 80 = 464 */
  eq('opening cost of bread', HB.engine.unitCost('bread'), 1130);
  eq('opening cost of puff', HB.engine.unitCost('puff'), 464);

  /* ------------------------------------------------------- buying, 2 Jan */
  var po1 = ok('PO within limit', core.po({ date: '2026-01-02', vendorId: 'v_stock', lines: [{ itemId: 'maida', qty: 500, rate: 3800 }] }, as('stores', '2026-01-02T09:00'))).doc;
  eq('PO1 total and status', [po1.total, po1.status, po1.approval.state], [1900000, 'APPROVED', 'none']);
  refused('receipt above the order', core.grn({ date: '2026-01-02', poId: po1.id, lines: [{ itemId: 'maida', qty: 501 }] }, as('stores', '2026-01-02T10:00')), 'invalid_input');
  var grn1 = ok('GRN part', core.grn({ date: '2026-01-02', poId: po1.id, lines: [{ itemId: 'maida', qty: 300, rejectedQty: 10 }] }, as('stores', '2026-01-02T10:00'))).doc;
  eq('PO1 part received', [po1.status, po1.lines[0].received], ['PART_RECEIVED', 300]);
  var grn2 = ok('GRN rest', core.grn({ date: '2026-01-02', poId: po1.id, lines: [{ itemId: 'maida', qty: 200 }] }, as('stores', '2026-01-02T10:30'))).doc;
  eq('PO1 received', po1.status, 'RECEIVED');
  eq('maida price follows the receipt', HB.engine.price('maida'), 3800);
  /* bread (38000 + 6000) / 40 + 80 = 1180; puff (15200 + 24000) / 100 + 80 = 472 */
  eq('bread cost after flour', HB.engine.unitCost('bread'), 1180);
  eq('puff cost after flour', HB.engine.unitCost('puff'), 472);

  var bill1 = ok('VBILL matches', core.vbill({ date: '2026-01-02', vendorId: 'v_stock', billNo: 'CF/101', grnIds: [grn1.id, grn2.id], lines: [{ itemId: 'maida', qty: 500, rate: 3800 }] }, as('accounts', '2026-01-02T11:00'))).doc;
  eq('bill1', [bill1.status, bill1.total, bill1.dueDate, bill1.match.ok, grn1.billId], ['POSTED', 1900000, '2026-01-17', true, bill1.id]);
  refused('duplicate bill number', core.vbill({ date: '2026-01-02', vendorId: 'v_stock', billNo: 'cf/101', grnIds: [grn1.id], lines: [{ itemId: 'maida', qty: 1, rate: 1 }] }, as('accounts', '2026-01-02T11:05')), 'duplicate', bill1.id);

  var po2 = ok('PO fat', core.po({ date: '2026-01-02', vendorId: 'v_stock', lines: [{ itemId: 'fat', qty: 20, rate: 12500 }] }, as('stores', '2026-01-02T09:10'))).doc;
  var grn3 = ok('GRN fat', core.grn({ date: '2026-01-02', poId: po2.id, lines: [{ itemId: 'fat', qty: 20 }] }, as('stores', '2026-01-02T10:40'))).doc;
  /* bread (38000 + 0.5 x 12500) / 40 + 80 = 1186.25; puff (15200 + 25000) / 100 + 80 = 482 */
  eq('bread cost after fat', HB.engine.unitCost('bread'), 1186.25);
  eq('puff cost after fat', HB.engine.unitCost('puff'), 482);
  /* billed 20 x 13000 = 260000 against 250000 expected: 10000 off, more than 2% (5000) -> held. GST 5%: 6500 + 6500 */
  var bill2 = ok('VBILL held', core.vbill({ date: '2026-01-02', vendorId: 'v_stock', billNo: 'CF/102', grnIds: [grn3.id], lines: [{ itemId: 'fat', qty: 20, rate: 13000 }] }, as('accounts', '2026-01-02T11:10'))).doc;
  eq('bill2 held', [bill2.status, bill2.match.ok, bill2.match.diffs[0].expected, bill2.match.diffs[0].billed, bill2.total, bill2.cgst, bill2.lines[0].cgst], ['HELD', false, 250000, 260000, 273000, undefined, 6500]);
  eq('a held bill writes no payable', book.ap.balance['vendor:v_stock'], 3900000);
  refused('reject needs a reason', core.reject(bill2.id, '  ', as('owner', '2026-01-02T12:00')), 'invalid_input');
  ok('approve held bill', core.approve(bill2.id, as('owner', '2026-01-02T12:00')));
  eq('bill2 posted', [bill2.status, bill2.approval.state, bill2.approval.self, book.ap.balance['vendor:v_stock']], ['POSTED', 'approved', false, 4173000]);
  refused('approve twice', core.approve(bill2.id, as('owner', '2026-01-02T12:01')), 'wrong_state');
  eq('price is not moved by a bill', HB.engine.price('fat'), 12500);

  /* above the limit: 1500 x 3800 = 5700000 > 5000000 */
  var po3 = ok('PO above limit', core.po({ date: '2026-01-02', vendorId: 'v_stock', lines: [{ itemId: 'maida', qty: 1500, rate: 3800 }] }, as('stores', '2026-01-02T09:20'))).doc;
  eq('PO3 waits', [po3.status, po3.approval.state, !!book.pending[po3.id]], ['PENDING', 'pending', true]);
  refused('no receipt against a pending order', core.grn({ date: '2026-01-02', poId: po3.id, lines: [{ itemId: 'maida', qty: 1 }] }, as('stores', '2026-01-02T10:00')), 'wrong_state');
  ok('approve PO3', core.approve(po3.id, as('owner', '2026-01-02T12:05')));
  var cxlPo = ok('cancel PO3', core.cancel(po3.id, 'ordered twice', as('stores', '2026-01-02T12:30')));
  eq('PO3 cancelled', [po3.status, po3.cancelled.docId, cxlPo.doc.type, cxlPo.doc.targetId, cxlPo.doc.id], ['CANCELLED', cxlPo.doc.id, 'CXL', po3.id, 'CXL-260102-001']);
  var poOwner = ok('PO above limit by the Owner', core.po({ date: '2026-01-02', vendorId: 'v_stock', lines: [{ itemId: 'maida', qty: 1500, rate: 3800 }] }, as('owner', '2026-01-02T12:40'))).doc;
  eq('the Owner approves own order in the same operation', [poOwner.status, poOwner.approval.state, poOwner.approval.self], ['APPROVED', 'approved', true]);
  ok('cancel the Owner order', core.cancel(poOwner.id, 'test', as('owner', '2026-01-02T12:41')));

  refused('payment not equal to its bills', core.pay({ date: '2026-01-02', payeeType: 'vendor', payeeId: 'v_stock', account: 'bank', amount: 5, allocations: [{ docId: bill1.id, amount: 1000000 }] }, as('accounts', '2026-01-02T15:00')), 'invalid_input');
  refused('payment above the open amount', core.pay({ date: '2026-01-02', payeeType: 'vendor', payeeId: 'v_stock', account: 'bank', allocations: [{ docId: bill1.id, amount: 1900001 }] }, as('accounts', '2026-01-02T15:00')), 'invalid_input');
  var pay1 = ok('PAY', core.pay({ date: '2026-01-02', payeeType: 'vendor', payeeId: 'v_stock', account: 'bank', amount: 3000000, allocations: [{ docId: openBill.id, amount: 2000000 }, { docId: bill1.id, amount: 1000000 }], ref: 'NEFT 1' }, as('accounts', '2026-01-02T15:00'))).doc;
  eq('after PAY', [book.cash.balance.bank, book.ap.balance['vendor:v_stock'], openBill.paid, bill1.paid], [27000000, 1173000, 2000000, 1000000]);

  /* ------------------------------------------------------ making, 2 Jan */
  refused('production short of material', core.prod({ date: '2026-01-02', itemId: 'bread', mixes: 100, goodUnits: 4000 }, as('production', '2026-01-02T14:00')), 'stock_short');
  var prodBread = ok('PROD bread', core.prod({ date: '2026-01-02', itemId: 'bread', mixes: 2, goodUnits: 78, rejectedUnits: 2 }, as('production', '2026-01-02T14:00'))).doc;
  /* maida 20 x 3800 = 76000; fat 1 x 12500 = 12500; bags 78 x 80 = 6240; loss 2 x 1186.25 = 2372.5 -> 2373 */
  eq('bread run', [prodBread.batchId, prodBread.bestBefore, prodBread.expectedUnits, prodBread.unitCost, prodBread.lossValue, prodBread.consumption], ['B-260102-BRD', '2026-01-06', 80, 1186.25, 2373,
    [{ itemId: 'maida', qty: 20, rate: 3800, value: 76000 }, { itemId: 'fat', qty: 1, rate: 12500, value: 12500 }, { itemId: 'bag', qty: 78, rate: 80, value: 6240 }]]);
  var prodPuff = ok('PROD puff', core.prod({ date: '2026-01-02', itemId: 'puff', mixes: 1, goodUnits: 100 }, as('production', '2026-01-02T15:00'))).doc;
  eq('puff run', [prodPuff.batchId, prodPuff.bestBefore, prodPuff.lossValue], ['B-260102-PUF', '2026-01-03', 0]);
  eq('second run of the day gets a suffix', core.nextBatchId('puff', '2026-01-02'), 'B-260102-PUF-2');
  eq('raw stock after production', book.stock.fac_rm, { maida: 676, fat: 67, bag: 822 });
  eq('finished stock after production', book.stock.fac_fg, { bread: 138, puff: 100 });

  /* ------------------------------------------------------ selling, 3 Jan */
  var sheet = HB.engine.dispatchSheet('r1', '2026-01-03');
  eq('prefilled sheet', [sheet.sheetId, sheet.posted, sheet.outlets.map(function (o) { return [o.customerId, o.lines]; }), sheet.items],
    ['DS-r1-260103', false, [['c_cash', [{ itemId: 'bread', qty: 20 }, { itemId: 'puff', qty: 10 }]], ['c_week', [{ itemId: 'bread', qty: 30 }, { itemId: 'puff', qty: 20 }]]],
      [{ itemId: 'bread', total: 50, available: 138, short: false }, { itemId: 'puff', total: 30, available: 100, short: false }]]);
  var before = snapshot();
  var tooMuch = core.postDispatch({ routeId: 'r1', date: '2026-01-03', outlets: [{ customerId: 'c_cash', lines: [{ itemId: 'bread', qty: 100 }] }, { customerId: 'c_week', lines: [{ itemId: 'bread', qty: 39 }, { itemId: 'puff', qty: 101 }] }] }, as('sales', '2026-01-03T05:30'));
  refused('a sheet above stock posts nothing', tooMuch, 'stock_short');
  eq('the refusal lists each short product', tooMuch.error.short, [{ itemId: 'bread', wanted: 139, available: 138 }, { itemId: 'puff', wanted: 101, available: 100 }]);
  eq('nothing moved', snapshot(), before);
  eq('ids the sheet will take', HB.engine.idPlan('postDispatch', { outlets: sheet.outlets }), { types: ['INV', 'INV'], batch: false });
  var disp = ok('dispatch sheet', core.postDispatch({ routeId: 'r1', date: '2026-01-03', outlets: sheet.outlets }, as('sales', '2026-01-03T05:30')));
  var invCash = disp.docs[0], invWeek = disp.docs[1];
  /* cash outlet: bread 20 x 3200 = 64000 (Nil); puff 10 x 1100 = 11000 + 275 + 275; total 75550, all collected */
  eq('cash outlet invoice', [invCash.customerId, invCash.sheetId, invCash.taxable, invCash.gst, invCash.total, invCash.paidNow, invCash.dueDate, invCash.lines[0].cost, invCash.lines[1].cost, invCash.lines[1].cgst],
    ['c_cash', 'DS-r1-260103', 75000, 550, 75550, 75550, '2026-01-03', 23725, 4820, 275]);
  /* weekly outlet: 30 x 3200 = 96000; 20 x 1100 = 22000 + 550 + 550; total 119100; cost 30 x 1186.25 = 35587.5 -> 35588 */
  eq('weekly outlet invoice', [invWeek.total, invWeek.paidNow, invWeek.dueDate, invWeek.lines[0].cost, invWeek.lines[1].cost, invWeek.lines[0].batches], [119100, 0, '2026-01-10', 35588, 9640, [{ batchId: 'B-251231-BRD', qty: 30 }]]);
  eq('factory cash after dispatch', book.cash.balance.cash_factory, 5075550);
  refused('the same sheet twice', core.postDispatch({ routeId: 'r1', date: '2026-01-03', outlets: sheet.outlets }, as('sales', '2026-01-03T05:40')), 'duplicate', invCash.id);

  var so = ok('SO', core.so({ date: '2026-01-03', customerId: 'c_corp', deliveryDate: '2026-01-03', poRef: 'HM/77', lines: [{ itemId: 'bread', qty: 15 }] }, as('sales', '2026-01-03T06:00'))).doc;
  eq('SO price list', [so.status, so.lines[0].price], ['OPEN', 3000]);
  var corpRes = ok('INV from the order', core.inv({ date: '2026-01-03', customerId: 'c_corp', soId: so.id }, as('sales', '2026-01-03T07:00')));
  var invCorp = corpRes.doc;
  /* 15 x 3000 = 45000, Nil; oldest first: 10 left of the opening batch, then 5 of the new one; cost 15 x 1186.25 = 17793.75 -> 17794 */
  eq('corporate invoice', [invCorp.total, invCorp.channel, invCorp.dueDate, invCorp.lines[0].cost, invCorp.lines[0].batches, so.status, so.invId],
    [45000, 'corporate', '2026-01-18', 17794, [{ batchId: 'B-251231-BRD', qty: 10 }, { batchId: 'B-260102-BRD', qty: 5 }], 'INVOICED', invCorp.id]);
  eq('credit limit warning', corpRes.warnings.map(function (w) { return w.code; }), ['credit_limit']);
  refused('an invoiced order cannot be cancelled', core.cancel(so.id, 'test', as('sales', '2026-01-03T07:05')), 'has_dependants', invCorp.id);
  refused('invoice above stock', core.inv({ date: '2026-01-03', customerId: 'c_corp', lines: [{ itemId: 'bread', qty: 1000 }] }, as('sales', '2026-01-03T07:10')), 'stock_short');

  /* ------------------------------------------------------- stores, 3 Jan */
  var ts = HB.engine.transferSheet('st_vvn', '2026-01-03');
  eq('prefilled transfer', ts.lines, [{ itemId: 'bread', standing: 20, atStore: 0, inTransit: 0, qty: 20, available: 73 }, { itemId: 'puff', standing: 50, atStore: 0, inTransit: 0, qty: 50, available: 70 }]);
  var xfer = ok('XFER', core.xfer({ date: '2026-01-03', toStoreId: 'st_vvn', lines: [{ itemId: 'bread', qty: 20 }, { itemId: 'puff', qty: 50 }] }, as('stores', '2026-01-03T06:00'))).doc;
  eq('in transit', [xfer.status, book.stock.transit_st_vvn, book.stock.st_vvn], ['SENT', { bread: 20, puff: 50 }, {}]);
  eq('stock in transit is not counted twice', HB.engine.transferSheet('st_vvn', '2026-01-03').lines.map(function (l) { return l.qty; }), [0, 0]);
  ok('receive transfer', core.receiveTransfer(xfer.id, as('store_mgr', '2026-01-03T07:30')));
  eq('at the store', [xfer.status, xfer.receivedBy, book.stock.transit_st_vvn, book.stock.st_vvn], ['RECEIVED', 'u_store_mgr', { bread: 0, puff: 0 }, { bread: 20, puff: 50 }]);
  refused('a confirmed transfer cannot be cancelled', core.cancel(xfer.id, 'test', as('stores', '2026-01-03T08:00')), 'wrong_state');

  refused('more expired than there is', core.dayend({ date: '2026-01-03', storeId: 'st_vvn', lines: [{ itemId: 'puff', sold: 40, expired: 11 }], cash: 0, upi: 0 }, as('store_mgr', '2026-01-03T21:00')), 'stock_short');
  refused('bread is not expired on the 3rd', core.dayend({ date: '2026-01-03', storeId: 'st_vvn', lines: [{ itemId: 'bread', sold: 0, expired: 1 }], cash: 0, upi: 0 }, as('store_mgr', '2026-01-03T21:00')), 'stock_short');
  eq('ids a day-end will take', HB.engine.idPlan('post', { type: 'DAYEND', payload: { lines: [{ itemId: 'puff', sold: 40, expired: 10 }] } }), { types: ['DAYEND', 'WO'], batch: false });
  var de = ok('DAYEND', core.dayend({ date: '2026-01-03', storeId: 'st_vvn', lines: [{ itemId: 'bread', sold: 12, expired: 0 }, { itemId: 'puff', sold: 40, expired: 10 }], cash: 70000, upi: 37500 }, as('store_mgr', '2026-01-03T21:00')));
  var dayEnd = de.doc, wo1 = de.docs[1];
  /* bread 12 x 4000 = 48000 Nil; puff 40 x 1500 = 60000, tax inside = round(60000 x 5 / 210) = 1429 each, taxable 57142 */
  eq('day-end figures', [dayEnd.gross, dayEnd.taxable, dayEnd.gst, dayEnd.shortExcess, dayEnd.lines[1].taxable, dayEnd.lines[1].cgst, dayEnd.lines[0].cost, dayEnd.lines[1].cost, dayEnd.woId],
    [108000, 105142, 2858, -500, 57142, 1429, 14235, 19280, wo1.id]);
  eq('write-off raised by the day-end', [wo1.type, wo1.status, wo1.reason, wo1.sourceDocId, wo1.date, wo1.lines], ['WO', 'PENDING', 'expired', dayEnd.id, '2026-01-03', [{ itemId: 'puff', batchId: 'B-260102-PUF', qty: 10, rate: 482, value: 4820 }]]);
  eq('expired units are reserved, not gone', [book.stock.st_vvn.puff, book.reserved.st_vvn.puff, HB.engine.available('st_vvn', 'puff', '2026-01-03')], [10, 10, 0]);
  refused('one day-end per store per day', core.dayend({ date: '2026-01-03', storeId: 'st_vvn', lines: [], cash: 0, upi: 0 }, as('store_mgr', '2026-01-03T21:10')), 'duplicate', dayEnd.id);
  ok('approve the write-off', core.approve(wo1.id, as('owner', '2026-01-04T08:00')));
  eq('write-off posted on its own date', [wo1.status, book.stock.st_vvn, book.reserved.st_vvn.puff, HB.engine.rowsOf(wo1.id).pnl[0].date, HB.engine.rowsOf(wo1.id).pnl[0].amount], ['POSTED', { bread: 8, puff: 0 }, 0, '2026-01-03', 4820]);
  refused('day-end with an approved write-off', core.cancel(dayEnd.id, 'test', as('store_mgr', '2026-01-04T08:10')), 'has_dependants', wo1.id);

  /* ----------------------------------------------------- receipts, 3 Jan */
  refused('receipt above the open amount', core.rcpt({ date: '2026-01-03', customerId: 'c_week', account: 'cash_factory', amount: 200000, allocations: [{ docId: invWeek.id, amount: 119101 }] }, as('sales', '2026-01-03T17:00')), 'invalid_input');
  var rcpt1 = ok('RCPT cash', core.rcpt({ date: '2026-01-03', customerId: 'c_week', account: 'cash_factory', amount: 100000, allocations: [{ docId: invWeek.id, amount: 100000 }] }, as('sales', '2026-01-03T17:00'))).doc;
  var rcpt2 = ok('RCPT bank with on-account', core.rcpt({ date: '2026-01-03', customerId: 'c_corp', account: 'bank', amount: 1200000, mode: 'neft', allocations: [{ docId: openInv.id, amount: 1000000 }, { docId: invCorp.id, amount: 45000 }] }, as('accounts', '2026-01-03T17:10'))).doc;
  eq('receipts', [rcpt1.onAccount, rcpt2.onAccount, book.ar.balance.c_week, book.ar.balance.c_corp, book.ar.credit.c_corp, HB.engine.openAmount(invWeek), (book.ar.open.c_corp || []).length],
    [0, 155000, 19100, -155000, 155000, 19100, 0]);

  /* ------------------------------------------------------ returns, 4 Jan */
  /* weekly outlet: 2 x 3200 = 6400 over 118000 supplied = 5.42% -> posts; allocated to its open invoice */
  var cn1 = ok('CN within limit', core.cn({ date: '2026-01-04', customerId: 'c_week', lines: [{ itemId: 'bread', qty: 2 }] }, as('sales', '2026-01-04T06:00'))).doc;
  eq('credit note posted', [cn1.status, cn1.sharePct, cn1.total, cn1.allocations, cn1.onAccount, book.ar.balance.c_week], ['POSTED', 5.42, 6400, [{ docId: invWeek.id, amount: 6400 }], 0, 12700]);
  /* cash outlet: 3 x 3200 = 9600 over 75000 = 12.8% -> held */
  var cn2 = ok('CN above limit', core.cn({ date: '2026-01-04', customerId: 'c_cash', lines: [{ itemId: 'bread', qty: 3 }] }, as('sales', '2026-01-04T06:05'))).doc;
  eq('credit note held', [cn2.status, cn2.sharePct, book.ar.balance.c_cash], ['HELD', 12.8, 0]);
  var cnNone = ok('CN with no supply', core.cn({ date: '2026-01-20', customerId: 'c_cash', lines: [{ itemId: 'bread', qty: 1 }] }, as('sales', '2026-01-20T06:00'))).doc;
  eq('no supply in the window', [cnNone.status, cnNone.sharePct, cnNone.holdReason], ['HELD', null, 'no supply in the last seven days']);
  ok('reject it', core.reject(cnNone.id, 'entered by mistake', as('owner', '2026-01-20T08:00')));
  refused('a rejected document cannot be cancelled', core.cancel(cnNone.id, 'test', as('sales', '2026-01-20T08:10')), 'wrong_state');
  ok('approve the held return', core.approve(cn2.id, as('owner', '2026-01-04T08:00')));
  eq('held return becomes credit', [cn2.status, cn2.onAccount, book.ar.credit.c_cash, book.ar.balance.c_cash], ['POSTED', 9600, 9600, -9600]);
  /* the next invoice uses the credit first: 5 x 3200 = 16000, 9600 from credit, 6400 in cash; cost 5 x 1186.25 = 5931.25 -> 5931 */
  var invCash2 = ok('single INV', core.inv({ date: '2026-01-04', customerId: 'c_cash', lines: [{ itemId: 'bread', qty: 5 }, { itemId: 'puff', qty: 0 }] }, as('sales', '2026-01-04T09:00'))).doc;
  eq('credit applied first', [invCash2.creditApplied, invCash2.paidNow, invCash2.sheetId, invCash2.lines.length, invCash2.lines[0].cost, book.ar.credit.c_cash, book.ar.balance.c_cash, book.cash.balance.cash_factory],
    [9600, 6400, null, 1, 5931, 0, 0, 5181950]);

  /* -------------------------------------------- deposits, count, write-off */
  refused('deposit above the cash in hand', core.dep({ date: '2026-01-04', fromAccount: 'cash_st_vvn', amount: 270001 }, as('store_mgr', '2026-01-04T10:00')), 'cash_short');
  refused('the bank is not a cash point', core.dep({ date: '2026-01-04', fromAccount: 'bank', amount: 1 }, as('accounts', '2026-01-04T10:00')), 'invalid_input');
  ok('DEP factory', core.dep({ date: '2026-01-04', fromAccount: 'cash_factory', amount: 100000, slipRef: 'S1' }, as('accounts', '2026-01-04T10:00')));
  ok('DEP store', core.dep({ date: '2026-01-04', fromAccount: 'cash_st_vvn', amount: 50000, slipRef: 'S2' }, as('store_mgr', '2026-01-04T10:05')));

  var adj = ok('ADJ', core.adj({ date: '2026-01-04', locId: 'fac_rm', reason: 'month-end count', lines: [{ itemId: 'maida', countedQty: 674 }] }, as('stores', '2026-01-04T11:00'))).doc;
  eq('count waits', [adj.status, adj.lines[0], book.stock.fac_rm.maida], ['PENDING', { itemId: 'maida', batchId: null, systemQty: 676, countedQty: 674, diff: -2, rate: 3800, value: -7600 }, 676]);
  ok('approve the count', core.approve(adj.id, as('owner', '2026-01-04T12:00')));
  eq('count posted', [adj.status, book.stock.fac_rm.maida], ['POSTED', 674]);

  refused('write-off above the batch', core.wo({ date: '2026-01-04', locId: 'fac_fg', reason: 'damaged', lines: [{ itemId: 'bread', batchId: 'B-260102-BRD', qty: 49 }] }, as('stores', '2026-01-04T11:10')), 'stock_short');
  var wo2 = ok('WO', core.wo({ date: '2026-01-04', locId: 'fac_fg', reason: 'damaged', lines: [{ itemId: 'bread', batchId: 'B-260102-BRD', qty: 3 }] }, as('stores', '2026-01-04T11:10'))).doc;
  /* 3 x 1186.25 = 3558.75 -> 3559 */
  eq('write-off reserves', [wo2.status, wo2.lines[0].value, HB.engine.available('fac_fg', 'bread', '2026-01-04'), book.stock.fac_fg.bread], ['PENDING', 3559, 45, 48]);
  refused('reserved units cannot be invoiced', core.inv({ date: '2026-01-04', customerId: 'c_corp', lines: [{ itemId: 'bread', qty: 46 }] }, as('sales', '2026-01-04T11:20')), 'stock_short');
  ok('approve the write-off', core.approve(wo2.id, as('owner', '2026-01-04T12:05')));
  eq('finished stock after the write-off', [book.stock.fac_fg, lotQty('fac_fg', 'bread', 'B-260102-BRD')], [{ bread: 45, puff: 20 }, 45]);

  /* -------------------------------------------------------------- expenses */
  var claim = ok('EXP claim', core.exp({ kind: 'claim', date: '2026-01-04', categoryId: 'travel', unitId: 'st_vvn', amount: 35000, billRef: 'auto fare' }, as('store_mgr', '2026-01-04T13:00'))).doc;
  eq('claim', [claim.status, claim.payeeType, claim.payeeId, claim.total, claim.dueDate], ['PENDING', 'employee', 'E004', 35000, '2026-01-04']);
  refused('a claim in a bill category', core.exp({ kind: 'claim', date: '2026-01-04', categoryId: 'electricity', unitId: 'factory', amount: 100 }, as('sales', '2026-01-04T13:00')), 'invalid_input');
  refused('an unapproved claim cannot be paid', core.pay({ date: '2026-01-04', payeeType: 'employee', payeeId: 'E004', account: 'cash_factory', allocations: [{ docId: claim.id, amount: 35000 }] }, as('accounts', '2026-01-04T13:05')), 'wrong_state');
  ok('approve claim', core.approve(claim.id, as('owner', '2026-01-04T14:00')));
  var pay2 = ok('reimburse claim', core.pay({ date: '2026-01-04', payeeType: 'employee', payeeId: 'E004', account: 'cash_factory', allocations: [{ docId: claim.id, amount: 35000 }] }, as('accounts', '2026-01-04T14:10'))).doc;
  eq('claim paid', [claim.status, claim.paid, book.ap.balance['employee:E004']], ['PAID', 35000, 0]);
  /* 1000000 + 18%: 90000 + 90000 = 1180000 */
  var ebill = ok('EXP bill', core.exp({ kind: 'bill', date: '2026-01-04', payeeId: 'v_power', categoryId: 'electricity', unitId: 'factory', amount: 1000000, gstRate: 18, billRef: 'MG/5521' }, as('accounts', '2026-01-04T13:10'))).doc;
  eq('expense bill', [ebill.cgst, ebill.sgst, ebill.total, ebill.dueDate, book.ap.balance['vendor:v_power'] || 0], [90000, 90000, 1180000, '2026-01-14', 0]);
  ok('approve expense bill', core.approve(ebill.id, as('owner', '2026-01-04T14:00')));
  /* on the rolls on 31 Jan: factory E001 + E002 = 7500000 (E003 joins 10 Feb), store E004 = 1600000 */
  var sal = ok('salary bill', core.exp({ kind: 'salary', monthKey: '2026-01' }, as('accounts', '2026-01-31T17:00'))).doc;
  eq('salary bill', [sal.date, sal.payeeId, sal.lines, sal.total], ['2026-01-31', 'v_staff', [{ unitId: 'factory', headcount: 2, amount: 7500000 }, { unitId: 'st_vvn', headcount: 1, amount: 1600000 }], 9100000]);
  refused('second salary bill for the month', core.exp({ kind: 'salary', monthKey: '2026-01' }, as('accounts', '2026-01-31T17:05')), 'duplicate', sal.id);
  ok('approve salary bill', core.approve(sal.id, as('owner', '2026-02-01T08:00')));
  refused('salaries are paid from the bank', core.pay({ date: '2026-02-01', payeeType: 'vendor', payeeId: 'v_staff', account: 'cash_factory', allocations: [{ docId: sal.id, amount: 9100000 }] }, as('accounts', '2026-02-01T09:00')), 'invalid_input');
  var pay3 = ok('pay salaries', core.pay({ date: '2026-02-01', payeeType: 'vendor', payeeId: 'v_staff', account: 'bank', allocations: [{ docId: sal.id, amount: 9100000 }] }, as('accounts', '2026-02-01T09:00'))).doc;
  eq('salary bill paid', [sal.status, HB.engine.rowsOf(sal.id).pnl.map(function (x) { return [x.date, x.unitId, x.amount]; })], ['PAID', [['2026-01-31', 'factory', 7500000], ['2026-01-31', 'st_vvn', 1600000]]]);

  /* ----------------------------------------------- checkpoint A: the books */
  eq('A stock', book.stock, { fac_rm: { maida: 674, fat: 67, bag: 822 }, fac_fg: { bread: 45, puff: 20 }, st_vvn: { bread: 8, puff: 0 }, transit_st_vvn: { bread: 0, puff: 0 } });
  /* factory cash 5000000 + 75550 + 100000 + 6400 - 100000 - 35000; store 200000 + 70000 - 50000;
     bank 30000000 - 3000000 + 37500 + 1200000 + 100000 + 50000 - 9100000 */
  eq('A cash', book.cash.balance, { cash_factory: 5046950, cash_st_vvn: 220000, bank: 19287500 });
  eq('A receivables', [book.ar.balance, book.ar.total, book.ar.credit], [{ c_corp: -155000, c_cash: 0, c_week: 12700 }, -142300, { c_corp: 155000, c_cash: 0 }]);
  eq('A payables', [book.ap.balance, book.ap.total], [{ 'vendor:v_stock': 1173000, 'employee:E004': 0, 'vendor:v_power': 1180000, 'vendor:v_staff': 0 }, 2353000]);
  /* sales retail 75000 + 118000 + 16000; cogs retail 23725 + 4820 + 35588 + 9640 + 5931; store 14235 + 19280;
     write-offs 4820 + 3559 */
  eq('A P&L January', book.pnlMonth['2026-01'], {
    sales: { retail: 209000, corporate: 45000, store: 105142 },
    returns: { retail: -16000 },
    cogs: { retail: 79704, corporate: 17794, store: 33515 },
    prodLoss: { all: 2373 },
    writeoff: { all: 8379 },
    countDiff: { all: 7600 },
    expense: { 'cash_short|st_vvn': 500, 'travel|st_vvn': 35000, 'electricity|factory': 1000000, 'salaries|factory': 7500000, 'salaries|st_vvn': 1600000 }
  });
  var gst = {};
  book.gst.forEach(function (g) {
    var k = g.dir + ' ' + g.gstRate, c = gst[k] || (gst[k] = { taxable: 0, cgst: 0, sgst: 0 });
    c.taxable += g.taxable; c.cgst += g.cgst; c.sgst += g.sgst;
  });
  /* output Nil: 64000 + 96000 + 45000 + 48000 + 16000 - 6400 - 9600; output 5%: 11000 + 22000 + 57142, tax 275 + 550 + 1429 */
  eq('A GST', gst, {
    'input 0': { taxable: 1900000, cgst: 0, sgst: 0 }, 'input 5': { taxable: 260000, cgst: 6500, sgst: 6500 },
    'output 0': { taxable: 253000, cgst: 0, sgst: 0 }, 'output 5': { taxable: 90142, cgst: 2254, sgst: 2254 },
    'input 18': { taxable: 1000000, cgst: 90000, sgst: 90000 }
  });
  /* sales by item are running figures per day, unit and channel; an invoice writes one sales and one cost entry.
     3 Jan, routes: bread 20 + 30 units, 64000 + 96000, cost 23725 + 35588; 4 Jan: 5 sold, 2 + 3 returned */
  var cells3 = book.days['2026-01-03'].items, cells4 = book.days['2026-01-04'].items;
  eq('item figures, routes, 3 Jan', cells3.factory.retail, { bread: { qty: 50, sales: 160000, cogs: 59313, returnQty: 0, returns: 0 }, puff: { qty: 30, sales: 33000, cogs: 14460, returnQty: 0, returns: 0 } });
  eq('item figures, corporate, 3 Jan', cells3.factory.corporate, { bread: { qty: 15, sales: 45000, cogs: 17794, returnQty: 0, returns: 0 } });
  eq('item figures, store, 3 Jan', cells3.st_vvn.store, { bread: { qty: 12, sales: 48000, cogs: 14235, returnQty: 0, returns: 0 }, puff: { qty: 40, sales: 57142, cogs: 19280, returnQty: 0, returns: 0 } });
  eq('item figures, 4 Jan', cells4.factory.retail, { bread: { qty: 5, sales: 16000, cogs: 5931, returnQty: 5, returns: -16000 } });
  eq('P&L entries of an invoice', HB.engine.rowsOf(invCash.id).pnl.map(function (x) { return [x.line, x.channel, x.unitId, x.itemId, x.amount, x.qty]; }), [['sales', 'retail', 'factory', null, 75000, 30], ['cogs', 'retail', 'factory', null, 28545, 30]]);
  eq('rows of an invoice', (function (x) { return [x.moves.length, x.ar.map(function (a) { return [a.kind, a.amount]; }), x.cash.length, x.gst.map(function (g) { return [g.gstRate, g.taxable, g.cgst]; })]; })(HB.engine.rowsOf(invCash.id)),
    [2, [['invoice', 75550], ['collected', -75550]], 1, [[0, 64000, 0], [5, 11000, 275]]]); /* two lines, one batch each */
  eq('rows of a transfer, sent and received', HB.engine.rowsOf(xfer.id).moves.map(function (m) { return [m.locId, m.itemId, m.qty, m.kind]; }),
    [['fac_fg', 'bread', -20, 'transfer'], ['transit_st_vvn', 'bread', 20, 'transfer'], ['fac_fg', 'puff', -50, 'transfer'], ['transit_st_vvn', 'puff', 50, 'transfer'],
      ['transit_st_vvn', 'bread', -20, 'transfer_in'], ['st_vvn', 'bread', 20, 'transfer_in'], ['transit_st_vvn', 'puff', -50, 'transfer_in'], ['st_vvn', 'puff', 50, 'transfer_in']]);
  eq('who settled an invoice', HB.engine.settlers(invWeek).map(function (d) { return d.id; }), [rcpt1.id, cn1.id]);

  /* every ledger adds up to its running balance */
  var moved = {};
  book.moves.forEach(function (m) { var k = m.locId + '|' + m.itemId; moved[k] = HB.q3((moved[k] || 0) + m.qty); });
  Object.keys(book.stock).forEach(function (loc) { Object.keys(book.stock[loc]).forEach(function (it) { eq('ledger sums to stock ' + loc + ' ' + it, moved[loc + '|' + it], book.stock[loc][it]); }); });
  eq('cash entries sum to balances', book.cash.entries.reduce(function (s, e) { return s + e.amount; }, 0), 5046950 + 220000 + 19287500);
  eq('receivable entries sum to the total', book.ar.entries.reduce(function (s, e) { return s + e.amount; }, 0), book.ar.total);
  eq('payable entries sum to the total', book.ap.entries.reduce(function (s, e) { return s + e.amount; }, 0), book.ap.total);
  var seqs = book.moves.concat(book.cash.entries, book.ar.entries, book.ap.entries, book.pnl, book.gst).map(function (x) { return x.seq; });
  eq('every row has its own posting sequence', seqs.length, Object.keys(seqs.reduce(function (o, s) { o[s] = 1; return o; }, {})).length);

  /* --------------------------------------------------- post, then cancel */
  var snapA = snapshot();
  var dep3 = ok('DEP to cancel', core.dep({ date: '2026-01-05', fromAccount: 'cash_factory', amount: 30000 }, as('accounts', '2026-01-05T10:00'))).doc;
  var cxlDep = ok('cancel DEP', core.cancel(dep3.id, 'wrong amount', as('accounts', '2026-01-05T10:05'))).doc;
  eq('cancellation rows', [HB.engine.rowsOf(cxlDep.id).cash.map(function (c) { return [c.accountId, c.amount, c.reversal, c.docId, c.date]; }), dep3.status, dep3.cancelled.docId],
    [[['cash_factory', 30000, true, cxlDep.id, '2026-01-05'], ['bank', -30000, true, cxlDep.id, '2026-01-05']], 'CANCELLED', cxlDep.id]);
  refused('a cancellation cannot be cancelled', core.cancel(cxlDep.id, 'test', as('owner', '2026-01-05T10:06')), 'wrong_state');
  refused('cancelling twice', core.cancel(dep3.id, 'test', as('owner', '2026-01-05T10:06')), 'wrong_state', cxlDep.id);

  var invTmp = ok('INV to cancel', core.inv({ date: '2026-01-05', customerId: 'c_week', lines: [{ itemId: 'bread', qty: 4 }] }, as('sales', '2026-01-05T09:00'))).doc;
  ok('cancel INV', core.cancel(invTmp.id, 'wrong outlet', as('sales', '2026-01-05T09:10')));
  var prodTmp = ok('PROD to cancel', core.prod({ date: '2026-01-05', itemId: 'puff', mixes: 1, goodUnits: 95, rejectedUnits: 5 }, as('production', '2026-01-05T14:00'))).doc;
  ok('cancel PROD', core.cancel(prodTmp.id, 'entered twice', as('production', '2026-01-05T14:10')));
  var xferTmp = ok('XFER to cancel', core.xfer({ date: '2026-01-05', toStoreId: 'st_vvn', lines: [{ itemId: 'bread', qty: 5 }] }, as('stores', '2026-01-05T06:00'))).doc;
  ok('cancel XFER', core.cancel(xferTmp.id, 'van did not leave', as('stores', '2026-01-05T06:10')));
  var claimTmp = ok('claim by the Owner', core.exp({ kind: 'claim', date: '2026-01-05', categoryId: 'repairs', unitId: 'factory', amount: 5000 }, as('owner', '2026-01-05T11:00'))).doc;
  eq('the Owner approves own claim in the same operation', [claimTmp.status, claimTmp.approval.self], ['APPROVED', true]);
  ok('cancel approved claim', core.cancel(claimTmp.id, 'test', as('owner', '2026-01-05T11:05')));
  /* a day-end on the 6th: bread at the store has best-before 6 Jan, so the 6 unsold are expired that day */
  var deTmp = ok('DAYEND to cancel', core.dayend({ date: '2026-01-06', storeId: 'st_vvn', lines: [{ itemId: 'bread', sold: 2, expired: 6 }], cash: 8000, upi: 0 }, as('store_mgr', '2026-01-06T21:00')));
  eq('its write-off waits', [de.docs.length, deTmp.docs[1].status, book.reserved.st_vvn.bread], [2, 'PENDING', 6]);
  var cxlDe = ok('cancel DAYEND', core.cancel(deTmp.doc.id, 'wrong day', as('store_mgr', '2026-01-06T21:10'))).doc;
  eq('the pending write-off goes with it', [deTmp.docs[1].status, deTmp.docs[1].cancelled.docId, book.reserved.st_vvn.bread], ['CANCELLED', cxlDe.id, 0]);
  var woTmp = ok('WO by the Owner', core.wo({ date: '2026-01-05', locId: 'fac_fg', reason: 'other', lines: [{ itemId: 'puff', batchId: 'B-260102-PUF', qty: 20 }] }, as('owner', '2026-01-05T12:00'))).doc;
  eq('posted at once', [woTmp.status, book.stock.fac_fg.puff], ['POSTED', 0]);
  ok('cancel posted WO', core.cancel(woTmp.id, 'test', as('owner', '2026-01-05T12:05')));
  var adjTmp = ok('ADJ up by the Owner', core.adj({ date: '2026-01-05', locId: 'fac_rm', reason: 'recount', lines: [{ itemId: 'fat', countedQty: 70 }] }, as('owner', '2026-01-05T12:10'))).doc;
  ok('cancel posted ADJ', core.cancel(adjTmp.id, 'test', as('owner', '2026-01-05T12:15')));
  var snapB = snapshot();
  /* the cancellations are dated the 5th and 6th in January too, so even the month totals come back */
  eq('post then cancel returns every figure', snapB, snapA);

  /* a receipt cancelled: its invoice reopens. 19100 - 6400 = 12700 open before, 112700 after */
  ok('cancel RCPT', core.cancel(rcpt1.id, 'cheque returned', as('accounts', '2026-01-05T15:00')));
  eq('invoice reopened', [HB.engine.openAmount(invWeek), book.ar.balance.c_week, book.cash.balance.cash_factory], [112700, 112700, 4946950]);
  refused('an invoice with a credit note against it', core.cancel(invWeek.id, 'test', as('sales', '2026-01-05T15:05')), 'has_dependants', cn1.id);
  ok('cancel the posted credit note', core.cancel(cn1.id, 'wrong outlet', as('sales', '2026-01-05T15:06')));
  eq('credit note released', [HB.engine.openAmount(invWeek), book.ar.balance.c_week, book.pnlMonth['2026-01'].returns.retail], [119100, 119100, -9600]);
  ok('cancel RCPT with unused credit', core.cancel(rcpt2.id, 'test', as('accounts', '2026-01-05T15:10')));
  eq('corporate back to owing', [book.ar.balance.c_corp, book.ar.credit.c_corp, book.ar.open.c_corp.map(function (d) { return d.id; }), book.cash.balance.bank], [1045000, 0, [openInv.id, invCorp.id], 18087500]);

  /* credit already used by a later invoice is taken back from it */
  var rcptAdv = ok('RCPT on account', core.rcpt({ date: '2026-01-05', customerId: 'c_cash', account: 'cash_factory', amount: 20000 }, as('sales', '2026-01-05T16:00'))).doc;
  var invAdv = ok('INV using the credit', core.inv({ date: '2026-01-05', customerId: 'c_cash', lines: [{ itemId: 'bread', qty: 5 }] }, as('sales', '2026-01-05T16:05'))).doc;
  eq('credit used', [invAdv.creditApplied, invAdv.paidNow, book.ar.credit.c_cash], [16000, 0, 4000]);
  var cxlAdv = ok('cancel the receipt behind it', core.cancel(rcptAdv.id, 'test', as('accounts', '2026-01-05T16:10'))).doc;
  eq('credit taken back from the invoice', [invAdv.creditApplied, HB.engine.openAmount(invAdv), book.ar.credit.c_cash, book.ar.balance.c_cash, cxlAdv.creditTakenBack], [0, 16000, 0, 16000, [{ docId: invAdv.id, amount: 16000 }]]);

  /* --------------------------------------------- cancel with dependants */
  refused('a billed receipt', core.cancel(grn1.id, 'test', as('stores', '2026-01-05T17:00')), 'has_dependants', bill1.id);
  refused('an order with receipts', core.cancel(po1.id, 'test', as('stores', '2026-01-05T17:00')), 'has_dependants', grn2.id);
  refused('a bill with a payment', core.cancel(bill1.id, 'test', as('accounts', '2026-01-05T17:00')), 'has_dependants', pay1.id);
  refused('a paid claim', core.cancel(claim.id, 'test', as('accounts', '2026-01-05T17:00')), 'has_dependants', pay2.id);
  refused('a batch already dispatched', core.cancel(prodBread.id, 'test', as('production', '2026-01-05T17:00')), 'has_dependants');
  refused('opening entries', core.cancel(openInv.id, 'test', as('owner', '2026-01-05T17:00')), 'wrong_state');
  refused('expired stock is never dispatched', core.inv({ date: '2026-01-05', customerId: 'c_corp', lines: [{ itemId: 'puff', qty: 1 }] }, as('sales', '2026-01-05T17:05')), 'stock_short');

  /* a receipt cancelled: the order reopens and the price goes back */
  var po4 = ok('PO bags', core.po({ date: '2026-01-05', vendorId: 'v_stock', lines: [{ itemId: 'bag', qty: 100, rate: 90 }] }, as('stores', '2026-01-05T09:00'))).doc;
  var grn4 = ok('GRN bags', core.grn({ date: '2026-01-05', poId: po4.id, lines: [{ itemId: 'bag', qty: 100 }] }, as('stores', '2026-01-05T10:00'))).doc;
  eq('bag price up', [HB.engine.price('bag'), HB.engine.unitCost('bread'), po4.status], [90, 1196.25, 'RECEIVED']);
  ok('cancel GRN', core.cancel(grn4.id, 'wrong order', as('stores', '2026-01-05T10:10')));
  eq('price and order back', [HB.engine.price('bag'), HB.engine.unitCost('bread'), po4.status, po4.lines[0].received, book.stock.fac_rm.bag, book.prices.bag.history.length], [80, 1186.25, 'APPROVED', 0, 822, 2]);
  ok('pay then cancel the payment', core.cancel(pay2.id, 'paid twice', as('accounts', '2026-01-05T17:10')));
  eq('claim back to approved', [claim.status, claim.paid, book.ap.balance['employee:E004'], book.ap.open['employee:E004'].length], ['APPROVED', 0, 35000, 1]);

  /* the cash guard on a payment: move the factory cash to the bank, then try to pay from cash */
  ok('deposit all factory cash', core.dep({ date: '2026-01-05', fromAccount: 'cash_factory', amount: book.cash.balance.cash_factory }, as('accounts', '2026-01-05T17:20')));
  refused('payment above the cash in hand', core.pay({ date: '2026-01-05', payeeType: 'employee', payeeId: 'E004', account: 'cash_factory', allocations: [{ docId: claim.id, amount: 35000 }] }, as('accounts', '2026-01-05T17:25')), 'cash_short');

  /* ------------------------------------------------------- dry run */
  var seqBefore = book.seq;
  var dryRes = ok('dry run', core.inv({ date: '2026-01-05', customerId: 'c_corp', lines: [{ itemId: 'bread', qty: 2 }] }, as('sales', '2026-01-05T18:00', { dryRun: true })));
  eq('a dry run computes and posts nothing', [dryRes.preview, dryRes.doc.total, dryRes.doc.id, book.seq], [true, 6000, '', seqBefore]);
  var userRes = ok('ids from the log entry', core.inv({ date: '2026-01-05', customerId: 'c_corp', lines: [{ itemId: 'bread', qty: 2 }] }, as('sales', '2026-01-05T18:00', { ids: ['INV-U-0001'] })));
  eq('user id', userRes.doc.id, 'INV-U-0001');
  refused('an id already in the book', core.inv({ date: '2026-01-05', customerId: 'c_corp', lines: [{ itemId: 'bread', qty: 1 }] }, as('sales', '2026-01-05T18:01', { ids: ['INV-U-0001'] })), 'duplicate', 'INV-U-0001');

  /* ------------------------------------------------- more rules, one each */
  /* the Owner's day-end: the write-off of its expired units is approved in the same operation. 6 x 1186.25 = 7117.5 -> 7118 */
  var deOwner = ok('DAYEND by the Owner', core.dayend({ date: '2026-01-06', storeId: 'st_vvn', lines: [{ itemId: 'bread', sold: 2, expired: 6 }], cash: 8000, upi: 0 }, as('owner', '2026-01-06T21:00')));
  eq('its write-off is posted at once', [deOwner.docs[1].status, deOwner.docs[1].approval.self, deOwner.docs[1].value, book.stock.st_vvn.bread, deOwner.doc.woId], ['POSTED', true, 7118, 0, deOwner.docs[1].id]);

  /* a receipt whose goods are gone cannot be cancelled; a count that would go below zero cannot be approved */
  var po5 = ok('PO maida', core.po({ date: '2026-01-06', vendorId: 'v_stock', lines: [{ itemId: 'maida', qty: 10, rate: 3800 }] }, as('stores', '2026-01-06T09:00'))).doc;
  var grn5 = ok('GRN maida', core.grn({ date: '2026-01-06', poId: po5.id, lines: [{ itemId: 'maida', qty: 10 }] }, as('stores', '2026-01-06T10:00'))).doc;
  var adjDown = ok('count down by the Owner', core.adj({ date: '2026-01-06', locId: 'fac_rm', reason: 'recount', lines: [{ itemId: 'maida', countedQty: 5 }] }, as('owner', '2026-01-06T11:00'))).doc;
  eq('counted down', [adjDown.lines[0].diff, book.stock.fac_rm.maida], [-679, 5]);
  refused('receipt with its goods used', core.cancel(grn5.id, 'test', as('stores', '2026-01-06T11:05')), 'stock_short');
  ok('cancel the count', core.cancel(adjDown.id, 'test', as('owner', '2026-01-06T11:06')));
  ok('now the receipt can go', core.cancel(grn5.id, 'test', as('stores', '2026-01-06T11:07')));
  eq('maida back', [book.stock.fac_rm.maida, po5.status], [674, 'APPROVED']);
  var adjA = ok('count A waits', core.adj({ date: '2026-01-06', locId: 'fac_rm', reason: 'count', lines: [{ itemId: 'fat', countedQty: 60 }] }, as('stores', '2026-01-06T12:00'))).doc;
  var adjB = ok('count B waits', core.adj({ date: '2026-01-06', locId: 'fac_rm', reason: 'count', lines: [{ itemId: 'fat', countedQty: 5 }] }, as('stores', '2026-01-06T12:01'))).doc;
  ok('approve B', core.approve(adjB.id, as('owner', '2026-01-06T13:00')));
  refused('approving A would go below zero', core.approve(adjA.id, as('owner', '2026-01-06T13:01')), 'stock_short', adjA.id);
  ok('reject A', core.reject(adjA.id, 'superseded by the second count', as('owner', '2026-01-06T13:02')));
  ok('cancel B', core.cancel(adjB.id, 'test', as('stores', '2026-01-06T13:03')));
  eq('fat back', [book.stock.fac_rm.fat, adjA.status, adjA.approval.reason], [67, 'REJECTED', 'superseded by the second count']);

  /* a rejected write-off lets its stock go; a rejected bill lets its receipt and its number go */
  var freeBefore = HB.engine.available('fac_fg', 'bread', '2026-01-06');
  var woRej = ok('WO to reject', core.wo({ date: '2026-01-06', locId: 'fac_fg', reason: 'damaged', lines: [{ itemId: 'bread', batchId: 'B-260102-BRD', qty: 5 }] }, as('stores', '2026-01-06T14:00'))).doc;
  eq('held back', HB.engine.available('fac_fg', 'bread', '2026-01-06'), freeBefore - 5);
  ok('reject WO', core.reject(woRej.id, 'not damaged', as('owner', '2026-01-06T14:05')));
  eq('let go', [HB.engine.available('fac_fg', 'bread', '2026-01-06'), book.stock.fac_fg.bread], [freeBefore, freeBefore]);
  var po6 = ok('PO bags', core.po({ date: '2026-01-06', vendorId: 'v_stock', lines: [{ itemId: 'bag', qty: 10, rate: 80 }] }, as('stores', '2026-01-06T09:10'))).doc;
  var grn6 = ok('GRN bags', core.grn({ date: '2026-01-06', poId: po6.id, lines: [{ itemId: 'bag', qty: 10 }] }, as('stores', '2026-01-06T10:10'))).doc;
  var billRej = ok('bill held', core.vbill({ date: '2026-01-06', vendorId: 'v_stock', billNo: 'CF/200', grnIds: [grn6.id], lines: [{ itemId: 'bag', qty: 10, rate: 100 }] }, as('accounts', '2026-01-06T11:00'))).doc;
  eq('held and linked', [billRej.status, grn6.billId, (book.unbilled.v_stock || []).length], ['HELD', billRej.id, 0]);
  ok('reject the bill', core.reject(billRej.id, 'wrong rate', as('owner', '2026-01-06T11:05')));
  eq('receipt free again', [grn6.billId, book.unbilled.v_stock.map(function (g) { return g.id; })], [null, [grn6.id]]);
  /* 10 x 80 = 800 + 18% GST: 72 + 72 = 944 */
  var billOk = ok('the same number again', core.vbill({ date: '2026-01-06', vendorId: 'v_stock', billNo: 'CF/200', grnIds: [grn6.id], lines: [{ itemId: 'bag', qty: 10, rate: 80 }] }, as('accounts', '2026-01-06T11:10'))).doc;
  eq('posted', [billOk.status, billOk.total, billOk.lines[0].cgst], ['POSTED', 944, 72]);

  /* two runs of one product in a day; a back-dated invoice takes its place among the open ones */
  var runA = ok('PROD run 1', core.prod({ date: '2026-01-06', itemId: 'puff', mixes: 1, goodUnits: 100 }, as('production', '2026-01-06T14:00'))).doc;
  var runB = ok('PROD run 2', core.prod({ date: '2026-01-06', itemId: 'puff', mixes: 1, goodUnits: 98, rejectedUnits: 2 }, as('production', '2026-01-06T16:00'))).doc;
  eq('batch ids of the day', [runA.batchId, runB.batchId, book.lots.fac_fg.puff.map(function (l) { return l.batchId; })], ['B-260106-PUF', 'B-260106-PUF-2', ['B-260102-PUF', 'B-260106-PUF', 'B-260106-PUF-2']]);
  var invLate = ok('INV on the 6th', core.inv({ date: '2026-01-06', customerId: 'c_week', lines: [{ itemId: 'bread', qty: 1 }] }, as('sales', '2026-01-06T09:00'))).doc;
  var invBack = ok('INV back-dated to the 2nd', core.inv({ date: '2026-01-02', customerId: 'c_week', lines: [{ itemId: 'bread', qty: 1 }] }, as('accounts', '2026-01-06T09:05'))).doc;
  eq('open invoices by date, then posting order', book.ar.open.c_week.map(function (d) { return d.id; }), [invBack.id, invWeek.id, invLate.id]);
  /* 3200 returned over 118000 + 3200 supplied in the window (31 Dec - 6 Jan; the 2nd counts) -> posts, to the oldest invoice */
  var cnOld = ok('CN takes the oldest invoice', core.cn({ date: '2026-01-06', customerId: 'c_week', lines: [{ itemId: 'bread', qty: 1 }] }, as('sales', '2026-01-06T09:10'))).doc;
  eq('allocated by date', [cnOld.status, cnOld.sharePct, cnOld.allocations, book.ar.open.c_week.map(function (d) { return d.id; })], ['POSTED', 2.57, [{ docId: invBack.id, amount: 3200 }], [invWeek.id, invLate.id]]);

  /* a sheet with nothing on it, an outlet of another route, a dry run */
  refused('a sheet with no quantities', core.postDispatch({ routeId: 'r1', date: '2026-01-06', outlets: [{ customerId: 'c_cash', lines: [{ itemId: 'bread', qty: 0 }] }] }, as('sales', '2026-01-06T05:30')), 'invalid_input');
  refused('an outlet that is not a stop', core.postDispatch({ routeId: 'r1', date: '2026-01-06', outlets: [{ customerId: 'c_corp', lines: [{ itemId: 'bread', qty: 1 }] }] }, as('sales', '2026-01-06T05:30')), 'invalid_input');
  var seqDry = book.seq;
  var dryDisp = ok('dry run of a sheet', core.postDispatch({ routeId: 'r1', date: '2026-01-06', outlets: [{ customerId: 'c_cash', lines: [{ itemId: 'bread', qty: 2 }] }, { customerId: 'c_week', lines: [{ itemId: 'bread', qty: 3 }] }] }, as('sales', '2026-01-06T05:30', { dryRun: true })));
  eq('sheet previewed, not posted', [dryDisp.preview, dryDisp.totals, book.seq, HB.engine.dispatchSheet('r1', '2026-01-06').posted], [true, { bread: 5 }, seqDry, false]);
  ok('deactivate an item', core.setActive('items', 'puff', false, as('accounts', '2026-01-06T15:00')));
  refused('an inactive item cannot be invoiced', core.inv({ date: '2026-01-06', customerId: 'c_corp', lines: [{ itemId: 'puff', qty: 1 }] }, as('sales', '2026-01-06T15:01')), 'invalid_input');
  ok('reactivate it', core.setActive('items', 'puff', true, as('accounts', '2026-01-06T15:02')));

  /* ------------------------------------------------------ master changes */
  var changesBefore = M.changes.length;
  var ch = ok('price change', core.master('items', { id: 'bread', price: { retail: 3300 } }, as('accounts', '2026-01-05T19:00')));
  eq('price list changed, posted invoice not', [M.itemById.bread.price, ch.before.price.retail, invCash.lines[0].price, M.changes.length - changesBefore], [{ mrp: 4000, retail: 3300, corporate: 3000 }, 3200, 3200, 1]);
  refused('bad master input', core.master('items', { id: 'bread', gstRate: 40 }, as('accounts', '2026-01-05T19:01')), 'invalid_input');
  var newCust = ok('add an outlet', core.master('customers', { name: 'New Tea Stall', channel: 'retail', routeId: 'r1', terms: 'cash', standing: { bread: 4 } }, as('accounts', '2026-01-05T19:02'))).record;
  eq('the outlet is the last stop of its route', [newCust.id, M.routeById.r1.stops], ['cus_004', ['c_cash', 'c_week', 'cus_004']]);
  var store = ok('add a store', core.master('locations', { name: 'Nadiad', standing: { bread: 10 } }, as('accounts', '2026-01-05T19:03')));
  eq('a store brings its unit, locations and cash', [store.unit.id, !!M.locationById.st_nadiad, !!M.locationById.transit_st_nadiad, M.accountById.cash_st_nadiad.kind, book.cash.balance.cash_st_nadiad], ['st_nadiad', true, true, 'cash', 0]);
  refused('a store with stock stays', core.setActive('locations', 'st_vvn', false, as('accounts', '2026-01-05T19:04')), 'has_dependants');
  refused('a factory store stays', core.setActive('locations', 'fac_rm', false, as('accounts', '2026-01-05T19:04')), 'invalid_input');
  ok('deactivate the empty store', core.setActive('locations', 'st_nadiad', false, as('accounts', '2026-01-05T19:05')));
  refused('no transfer to an inactive store', core.xfer({ date: '2026-01-05', toStoreId: 'st_nadiad', lines: [{ itemId: 'bread', qty: 1 }] }, as('stores', '2026-01-05T19:06')), 'invalid_input');
  ok('recipe change', core.master('recipes', { itemId: 'bread', expectedUnits: 42 }, as('accounts', '2026-01-05T19:07')));
  /* (38000 + 6250) / 42 + 80 = 1133.5714 */
  eq('cost follows the recipe', HB.engine.unitCost('bread'), 1133.5714);
  var sheet5 = HB.engine.costSheet('bread');
  eq('cost sheet', [sheet5.mixCost, sheet5.packingPerUnit, sheet5.unitCost, sheet5.materials.length], [44250, 80, 1133.5714, 2]);

  /* --------------------------------------------------- the salary proposal */
  HB.calendar.set('2026-02-05');
  refused('January is already billed', HB.engine.salaryBill('2026-01'), 'duplicate', sal.id);
  refused('a month that is not over', HB.engine.salaryBill('2026-02'), 'future_date');
  HB.calendar.set('2026-04-05');
  refused('a locked month', HB.engine.salaryBill('2026-02'), 'locked_month');
  var prop = ok('proposal for March', HB.engine.salaryBill('2026-03'));
  eq('March has the February joiner', [prop.date, prop.lines, prop.total], ['2026-03-31', [{ unitId: 'factory', headcount: 3, amount: 9300000 }, { unitId: 'st_vvn', headcount: 1, amount: 1600000 }], 10900000]);

  /* ------------------------------------- what must hold after all of that */
  Object.keys(book.ar.balance).forEach(function (c) {
    var open = (book.ar.open[c] || []).reduce(function (s, d) { return s + HB.engine.openAmount(d); }, 0);
    eq('receivable of ' + c + ' = open invoices less unapplied credit', book.ar.balance[c], open - (book.ar.credit[c] || 0));
  });
  Object.keys(book.ap.balance).forEach(function (k) {
    eq('payable of ' + k + ' = its open bills', book.ap.balance[k], (book.ap.open[k] || []).reduce(function (s, d) { return s + d.total - d.paid; }, 0));
  });
  var rowSum = { sales: 0, cogs: 0, returns: 0 }, cellSum = { sales: 0, cogs: 0, returns: 0 }, monthSum = {};
  book.pnl.forEach(function (r) {
    if (rowSum[r.line] !== undefined) rowSum[r.line] += r.amount;
    var mk = r.date.slice(0, 7), key = r.line + ' ' + (r.line === 'expense' ? r.categoryId + '|' + r.unitId : (r.channel || 'all'));
    (monthSum[mk] || (monthSum[mk] = {}))[key] = ((monthSum[mk] || {})[key] || 0) + r.amount;
  });
  Object.keys(book.days).forEach(function (d) {
    var items = book.days[d].items;
    Object.keys(items).forEach(function (u) { Object.keys(items[u]).forEach(function (ch) { Object.keys(items[u][ch]).forEach(function (it) {
      var c = items[u][ch][it];
      cellSum.sales += c.sales; cellSum.cogs += c.cogs; cellSum.returns += c.returns;
    }); }); });
  });
  eq('item figures add up to the P&L rows', cellSum, rowSum);
  var monthFlat = {};
  Object.keys(book.pnlMonth).forEach(function (mk) {
    monthFlat[mk] = {};
    Object.keys(book.pnlMonth[mk]).forEach(function (line) { Object.keys(book.pnlMonth[mk][line]).forEach(function (k) { monthFlat[mk][line + ' ' + k] = book.pnlMonth[mk][line][k]; }); });
  });
  eq('month totals add up to the P&L rows', noZeros(monthFlat), noZeros(monthSum));
  Object.keys(book.lots).forEach(function (loc) { Object.keys(book.lots[loc]).forEach(function (it) {
    eq('batches add up to the stock of ' + it + ' at ' + loc, book.lots[loc][it].reduce(function (s, l) { return s + l.qty; }, 0), book.stock[loc][it] || 0);
  }); });
  var byDay = 0;
  Object.keys(book.days).forEach(function (d) { var x = book.days[d]; byDay += x.docs.length + x.moves.length + x.ar.length + x.ap.length + x.cash.length + x.pnl.length + x.gst.length; });
  eq('every document and row is filed under its day', byDay, book.docList.length + book.moves.length + book.ar.entries.length + book.ap.entries.length + book.cash.entries.length + book.pnl.length + book.gst.length);
  var rowsByDoc = 0;
  book.docList.forEach(function (d) { var x = HB.engine.rowsOf(d.id); rowsByDoc += x.moves.length + x.ar.length + x.ap.length + x.cash.length + x.pnl.length + x.gst.length; });
  eq('every row belongs to exactly one document', rowsByDoc, book.moves.length + book.ar.entries.length + book.ap.entries.length + book.cash.entries.length + book.pnl.length + book.gst.length);
  eq('and carries its id', book.docList.every(function (d) { var x = HB.engine.rowsOf(d.id); return x.moves.concat(x.ar, x.ap, x.cash, x.pnl, x.gst).every(function (r) { return r.docId === d.id; }); }), true);

  /* ------------------------------------------------------- the audit trail */
  var kinds = {};
  book.audit.forEach(function (a) { kinds[a.action] = (kinds[a.action] || 0) + 1; });
  eq('audit actions seen', Object.keys(kinds).sort(), ['approve', 'cancel', 'master', 'post', 'receive', 'reject', 'setActive']);
  eq('every document type was posted', HB.engine.DOC_TYPES.filter(function (t) { return !book.byType[t].length; }), []);

  return book;
}

function report(book) {
  var fmt = HB.fmt, M = HB.masters;
  console.log('Documents: ' + book.docList.length + '   ledger rows: ' + (book.moves.length + book.cash.entries.length + book.ar.entries.length + book.ap.entries.length + book.pnl.length + book.gst.length) + '   posting sequence: ' + book.seq);
  console.log('\nStock');
  Object.keys(book.stock).forEach(function (loc) {
    var parts = Object.keys(book.stock[loc]).map(function (it) { return M.itemById[it].name + ' ' + fmt.qty(book.stock[loc][it], M.itemById[it].unit); });
    console.log('  ' + M.locationById[loc].name + ': ' + (parts.join(', ') || 'nothing'));
  });
  console.log('\nCash and bank');
  Object.keys(book.cash.balance).forEach(function (a) { console.log('  ' + M.accountById[a].name + ': ' + fmt.inr2(book.cash.balance[a])); });
  console.log('\nReceivables ' + fmt.inr2(book.ar.total));
  Object.keys(book.ar.balance).forEach(function (c) { console.log('  ' + M.customerById[c].name + ': ' + fmt.inr2(book.ar.balance[c]) + ' (unapplied credit ' + fmt.inr2(book.ar.credit[c] || 0) + ')'); });
  console.log('\nPayables ' + fmt.inr2(book.ap.total));
  Object.keys(book.ap.balance).forEach(function (k) { console.log('  ' + k + ': ' + fmt.inr2(book.ap.balance[k])); });
  console.log('\nP&L by month');
  Object.keys(book.pnlMonth).sort().forEach(function (mk) {
    console.log('  ' + mk);
    Object.keys(book.pnlMonth[mk]).forEach(function (line) {
      var cell = book.pnlMonth[mk][line], parts = Object.keys(cell).map(function (k) { return k + ' ' + fmt.inr2(cell[k]); });
      if (parts.length) console.log('    ' + line + ': ' + parts.join(', '));
    });
  });
}

/**
 * Two years of trading at the size of the full company, to see that the posting path is fast and does not slow
 * down with history. The fixture is widened first, through the master functions, to eight products and three
 * stores; each day then gets 45 invoices of eight lines, 40 stale returns, three transfers, three day-ends, eight
 * production runs, receipts, deposits and the weekly buying. Like the seed, it writes off expired stock every
 * morning and collects what is owed, so no list grows for ever.
 */
function bench() {
  HB.engine.reset();
  var D = HB.dates, seed = { userId: 'u_owner', role: 'owner', seed: true, at: null }, day = '2026-01-01', n = 0, bad = 0, d, i, k;
  function post(res) { n++; if (!res.ok) { bad++; if (bad < 4) console.log('  bench refusal: ' + res.error.code + ' - ' + res.error.message); } return res; }
  var t0 = process.hrtime.bigint(), cpu0 = process.cpuUsage();
  var items = ['bread', 'puff'], stores = ['st_vvn'];
  for (k = 2; k <= 4; k++) {
    post(core.master('items', { id: 'bread' + k, code: 'BR' + k, name: 'Bread ' + k, kind: 'fg', unit: 'pcs', gstRate: 0, shelfLifeDays: 4, price: { mrp: 4000, retail: 3200, corporate: 3000 } }, seed));
    post(core.master('recipes', { itemId: 'bread' + k, expectedUnits: 40, materials: [{ itemId: 'maida', qty: 10 }, { itemId: 'fat', qty: 0.5 }], packing: [{ itemId: 'bag', qtyPerUnit: 1 }] }, seed));
    post(core.master('items', { id: 'puff' + k, code: 'PF' + k, name: 'Puff ' + k, kind: 'fg', unit: 'pcs', gstRate: 5, shelfLifeDays: 1, price: { mrp: 1500, retail: 1100, corporate: 1050 } }, seed));
    post(core.master('recipes', { itemId: 'puff' + k, expectedUnits: 100, materials: [{ itemId: 'maida', qty: 4 }, { itemId: 'fat', qty: 2 }], packing: [{ itemId: 'bag', qtyPerUnit: 1 }] }, seed));
    items.push('bread' + k, 'puff' + k);
  }
  stores.push(post(core.master('locations', { name: 'Anand' }, seed)).unit.id, post(core.master('locations', { name: 'Nadiad' }, seed)).unit.id);
  var open = [{ locId: 'fac_rm', itemId: 'maida', qty: 9000000, rate: 3600 }, { locId: 'fac_rm', itemId: 'fat', qty: 2000000, rate: 12000 }, { locId: 'fac_rm', itemId: 'bag', qty: 90000000, rate: 80 }];
  items.forEach(function (it) { open.push({ locId: 'fac_fg', itemId: it, qty: 700, mfgDate: '2025-12-31' }); });
  post(core.openStock({ date: day, lines: open }, seed));
  post(core.openCash({ date: day, lines: [{ accountId: 'cash_factory', amount: 100000000 }, { accountId: 'bank', amount: 2000000000 }] }, seed));
  post(core.master('customers', { id: 'c_corp', creditLimit: 0 }, seed)); /* no limit: the warning text is not what is being timed */
  var customers = ['c_cash', 'c_week', 'c_corp'], book = HB.book;
  for (d = 0; d < 730; d++) {
    day = D.addDays('2026-01-01', d);
    seed.at = day + 'T05:00';
    /* the morning write-off of what expired in the finished store */
    var woLines = [];
    items.forEach(function (it) {
      (book.lots.fac_fg[it] || []).forEach(function (lot) { if (lot.bestBefore < day) woLines.push({ itemId: it, batchId: lot.batchId, qty: lot.qty }); });
    });
    if (woLines.length) post(core.wo({ date: day, locId: 'fac_fg', reason: 'expired', lines: woLines }, seed));
    for (i = 0; i < 45; i++) post(core.inv({ date: day, customerId: customers[i % 3], lines: items.map(function (it, j) { return { itemId: it, qty: 8 + ((i + j) % 5) }; }) }, seed));
    for (i = 0; i < 40; i++) post(core.cn({ date: day, customerId: customers[i % 3], lines: [{ itemId: items[i % 8], qty: 1 }, { itemId: items[(i + 3) % 8], qty: 1 }] }, seed));
    /* the two credit customers pay what is open */
    ['c_week', 'c_corp'].forEach(function (c) {
      var due = (book.ar.open[c] || []).map(function (inv) { return { docId: inv.id, amount: HB.engine.openAmount(inv) }; });
      var sum = due.reduce(function (s2, a2) { return s2 + a2.amount; }, 0);
      if (sum > 0) post(core.rcpt({ date: day, customerId: c, account: 'bank', amount: sum, allocations: due }, seed));
    });
    stores.forEach(function (st) {
      var x = post(core.xfer({ date: day, toStoreId: st, lines: items.map(function (it) { return { itemId: it, qty: 20 }; }) }, seed)).doc;
      post(core.receiveTransfer(x.id, seed));
    });
    items.forEach(function (it) {
      var bread = it.indexOf('bread') === 0;
      post(core.prod({ date: day, itemId: it, mixes: bread ? 15 : 6, goodUnits: bread ? 595 : 598, rejectedUnits: bread ? 5 : 2 }, seed));
    });
    stores.forEach(function (st) {
      /* sold: 15 of each; expired: what has its best-before today and was not sold */
      var lines = items.map(function (it) {
        var today = (book.lots[st][it] || []).reduce(function (s3, lot) { return s3 + (lot.bestBefore === day ? lot.qty : 0); }, 0);
        return { itemId: it, sold: 15, expired: today > 15 ? today - 15 : 0 };
      });
      post(core.dayend({ date: day, storeId: st, lines: lines, cash: 250000, upi: 80000 }, seed));
      post(core.dep({ date: day, fromAccount: HB.masters.unitById[st].cashAccountId, amount: 250000 }, seed));
    });
    post(core.dep({ date: day, fromAccount: 'cash_factory', amount: 100000 }, seed));
    if (d % 2 === 0) {
      var po = post(core.po({ date: day, vendorId: 'v_stock', lines: [{ itemId: 'maida', qty: 500, rate: 3800 + (d % 50) }, { itemId: 'fat', qty: 100, rate: 12000 + (d % 90) }] }, seed)).doc;
      var g = post(core.grn({ date: day, poId: po.id, lines: [{ itemId: 'maida', qty: 500 }, { itemId: 'fat', qty: 100 }] }, seed)).doc;
      var bill = post(core.vbill({ date: day, vendorId: 'v_stock', billNo: 'B' + d, grnIds: [g.id], lines: [{ itemId: 'maida', qty: 500, rate: 3800 + (d % 50) }, { itemId: 'fat', qty: 100, rate: 12000 + (d % 90) }] }, seed)).doc;
      post(core.pay({ date: day, payeeType: 'vendor', payeeId: 'v_stock', account: 'bank', allocations: [{ docId: bill.id, amount: bill.total }] }, seed));
      post(core.exp({ kind: 'claim', date: day, categoryId: 'travel', unitId: 'factory', amount: 12000 }, seed));
    }
  }
  var ms = Number(process.hrtime.bigint() - t0) / 1e6, cpu = process.cpuUsage(cpu0);
  var rows = book.moves.length + book.cash.entries.length + book.ar.entries.length + book.ap.entries.length + book.pnl.length + book.gst.length;
  console.log('\nBench: ' + book.docList.length + ' documents (' + Math.round(book.docList.length / 730) + ' a day) and ' + rows + ' ledger rows in ' + ms.toFixed(0) + ' ms (' + (ms * 1000 / n).toFixed(1) + ' microseconds an operation; processor time ' + Math.round((cpu.user + cpu.system) / 1000) + ' ms), ' + bad + ' refused');
  return bad;
}

var book = main();
report(book);
console.log('\n' + checks + ' checks, ' + failures.length + ' failed');
failures.forEach(function (f) { console.log('  FAIL ' + f); });
var benchBad = process.argv.indexOf('--bench') !== -1 ? bench() : 0;
process.exit(failures.length || benchBad ? 1 : 0);
