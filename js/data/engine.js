/*
 * HB.masters, HB.book and HB.engine: the masters as the app reads them, the book (every ledger with its
 * running balances and indexes), the lean posting core that the seed and the forms both go through, and the
 * operations that wrap it for a user (act, preview, boot, freshCopy - at the end of the file).
 * The core is a function of the book, the masters and its arguments only: the actor, the role, the time and the
 * ids come in a context object. It never reads HB.session, the clock or a counter outside the book. Rights,
 * back-date limits and the user log wrap it (HB.engine.act); stock, cash, duplicate and state rules live here.
 * Every poster has two halves: build (validates and computes, changes nothing, may refuse) and commit (writes,
 * cannot refuse). That is what makes a refusal leave the book untouched, and a dry run free.
 * Shapes and payloads: docs/API.md, sections 2 and 3. Runs in the browser and in Node; no DOM.
 */
(function (root) {
  'use strict';

  var HB = root.HB || (root.HB = {});
  var E = HB.engine || (HB.engine = {});
  var money = HB.money, D = HB.dates, q3 = HB.q3, fmt = HB.fmt;
  var has = Object.prototype.hasOwnProperty;

  /* The posting rules of SPEC 5.2 name these places outright; everything else is listed from the masters. */
  var RM = 'fac_rm', FG = 'fac_fg', FACTORY = 'factory', CASH_FACTORY = 'cash_factory', BANK = 'bank';
  var DOC_TYPES = ['OPENSTOCK', 'OPENCASH', 'PO', 'GRN', 'VBILL', 'PAY', 'PROD', 'SO', 'INV', 'RCPT', 'CN', 'XFER',
    'DAYEND', 'DEP', 'ADJ', 'WO', 'EXP', 'CXL'];
  /* limits.warn is left out on purpose: the thresholds of the warnings live in HB.config.limits and nowhere else (see "warnings" below) */
  var LIMIT_DEFAULTS = { poAutoApprove: 5000000, billTolerancePct: 2, returnsPct: 8, backDateDays: 3, nearExpiryDays: 1, dueSoonDays: 7 };

  var M = null;    /* the masters in force (HB.masters) */
  var book = null; /* the book in force (HB.book) */

  /* ------------------------------------------------------------ refusals */
  /*
   * A refusal is thrown as a plain object (no stack to capture) from anywhere in a build, and turned into
   * { ok: false, error } at the public edge. Nothing is ever thrown from a commit.
   */

  function Refusal(code, message, field, docId) {
    this.error = { code: code, message: message, field: field || null, docId: docId || null };
  }

  function refuse(code, message, field, docId) { throw new Refusal(code, message, field, docId); }

  function entry(fn) {
    return function (a, b, c, d) {
      try { return fn(a, b, c, d); }
      catch (e) {
        if (e instanceof Refusal) return { ok: false, error: e.error, warnings: [] };
        throw e;
      }
    };
  }

  /* ------------------------------------------------------------- context */
  /* One operation at a time, so the context of the operation in hand is held here rather than passed around. */

  var op = { userId: null, role: null, owner: false, at: null, date: null, seed: false, dry: false, ids: null, n: 0, batchId: null, as: null };

  function begin(ctx) {
    if (!book || !M) throw new Error('HB.engine: call HB.engine.reset() before posting');
    ctx = ctx || {};
    op.userId = ctx.userId || null;
    op.role = ctx.role || null;
    op.owner = ctx.role === 'owner';
    op.at = ctx.at || null;
    op.date = ctx.date || (ctx.at ? ctx.at.slice(0, 10) : null);
    op.seed = !!ctx.seed;
    /* display only: the employee a seeded document names as having entered it (a store's own manager); never rights */
    op.as = op.seed && ctx.as ? String(ctx.as) : null;
    op.dry = !!ctx.dryRun;
    op.ids = ctx.ids && ctx.ids.length ? ctx.ids : null;
    op.n = 0;
    op.batchId = ctx.batchId || null;
    warns = null;
    if (op.ids) {
      /* tested here, in the build half, so that taking an id during a commit cannot fail */
      for (var i = 0; i < op.ids.length; i++) {
        if (book.docs[op.ids[i]] || op.ids.indexOf(op.ids[i]) !== i) refuse('duplicate', 'Document ' + op.ids[i] + ' already exists', null, book.docs[op.ids[i]] ? op.ids[i] : null);
      }
    }
  }

  /* ------------------------------------------------------- small helpers */

  var ymdCache = {};
  /** '2026-01-05' -> '260105', for document and batch ids. */
  function ymd(date) { return ymdCache[date] || (ymdCache[date] = date.slice(2, 4) + date.slice(5, 7) + date.slice(8, 10)); }

  var plusCache = {};
  /** HB.dates.addDays, remembered: the same few offsets are asked for on every document of a day. */
  function addDays(date, n) {
    var c = plusCache[n] || (plusCache[n] = {});
    return c[date] || (c[date] = D.addDays(date, n));
  }

  var okDates = {};
  function needDate(d, field, what) {
    /* the type before the lookup: an array of one day reads like that day as a key, and would pass as a date */
    if (typeof d === 'string' && okDates[d] === true) return d;
    if (!D.isIso(d)) refuse('invalid_input', 'Enter ' + (what || 'the date') + ' as a calendar day', field);
    okDates[d] = true;
    return d;
  }

  function needText(v, message, field) {
    var s = v === null || v === undefined ? '' : String(v).trim();
    if (!s) refuse('invalid_input', message, field);
    return s;
  }

  /** A money amount in whole paise, zero or more. */
  function needPaise(v, message, field, allowZero) {
    var n = +v;
    if (v === null || v === undefined || v === '' || !isFinite(n) || n !== Math.floor(n) || n < 0 || (n === 0 && !allowZero)) refuse('invalid_input', message, field);
    return n;
  }

  /** A quantity: finished goods in whole units, materials to three decimals. */
  function needQty(v, it, field, allowZero) {
    var n = +v;
    if (v === null || v === undefined || v === '' || !isFinite(n) || n < 0 || (n === 0 && !allowZero)) refuse('invalid_input', it.name + ': enter a quantity' + (allowZero ? '' : ' above zero'), field);
    if (it.kind === 'fg') {
      if (n !== Math.floor(n)) refuse('invalid_input', it.name + ' is counted in whole units', field);
      return n;
    }
    return q3(n);
  }

  /** A rate or price in paise per unit; may carry a fraction of a paisa. */
  function needRate(v, it, field, allowZero) {
    var n = +v;
    if (v === null || v === undefined || v === '' || !isFinite(n) || n < 0 || (n === 0 && !allowZero)) refuse('invalid_input', it.name + ': enter the rate', field);
    return n;
  }

  /**
   * A line, an allocation or an outlet as it arrives: an object. A grid with a hole in it (a removed row leaves
   * a sparse array) comes through JSON as null, and that must be a refusal with a field, not an exception.
   */
  function isRow(x) { return x !== null && typeof x === 'object'; }

  function needLines(lines, message) {
    if (!Array.isArray(lines) || !lines.length) refuse('invalid_input', message || 'Add at least one line', 'lines');
    for (var i = 0; i < lines.length; i++) if (!isRow(lines[i])) refuse('invalid_input', 'Line ' + (i + 1) + ' is empty: choose an item or remove the line', lineField(i, 'itemId'));
    return lines;
  }

  function lineField(i, name) { return 'lines[' + i + '].' + name; }

  function needItem(id, i) {
    var it = M.itemById[id];
    if (!it) refuse('invalid_input', 'Line ' + (i + 1) + ': choose an item', lineField(i, 'itemId'));
    return it;
  }

  function neg(x) { return x === 0 ? 0 : -x; } /* never -0: it would print as "-0" and fail an equality check */

  /** A count of finished units for a P&L row: whole, or 0 when the figure is not a whole number of units. */
  function wholeUnits(x) { return x === Math.floor(x) ? x : 0; }

  /* A status inside a sentence, in the words the screens use for it (the labels of docs/shell/UI-API.md), never the code. */
  var STATUS_WORDS = { PENDING: 'waiting for approval', HELD: 'held for approval' };
  function word(status) { return STATUS_WORDS[status] || String(status).toLowerCase().replace('_', ' '); }

  function qtyText(q, it) { return fmt.qty(q, it && it.unit ? it.unit : ''); }

  function dayText(date) { return D.label(date, 'd MMM yyyy'); }

  function locName(locId) { var l = M.locationById[locId]; return l ? l.name : locId; }

  function itemOf(id) { return M.itemById[id] || { id: id, name: id, unit: '', kind: 'rm' }; }

  function clone(x) {
    if (x === null || typeof x !== 'object') return x;
    var i, k, out;
    if (Array.isArray(x)) {
      out = new Array(x.length);
      for (i = 0; i < x.length; i++) out[i] = clone(x[i]);
      return out;
    }
    out = {};
    for (k in x) if (has.call(x, k)) out[k] = clone(x[k]);
    return out;
  }

  function pad3(n) { return n < 10 ? '00' + n : (n < 100 ? '0' + n : '' + n); }

  /* ------------------------------------------------------------- warnings */
  /*
   * A warning says that a figure looks wrong. It never refuses: the document is posted all the same. A build
   * half raises it with warn(); the poster takes the list with takeWarnings(), returns it from a dry run and from
   * a posting alike, keeps the codes on the document (doc.warned) and says so in the audit entry of the posting.
   * The thresholds are HB.config.limits.warn and nowhere else: one that is not there is a warning that never
   * fires. The seed is never warned: its figures are the history, not something typed. So every test below
   * stands behind `!op.seed`, and a seeded document carries no `warned`.
   * Each test is taken on whole numbers (thousandths of a unit, hundredths of a paisa), so that a figure exactly at
   * its threshold is on the near side whatever binary fractions make of it: exactly 20% away is not "more than 20%".
   */

  var warns = null; /* the warnings of the document being built, or null: one operation at a time */

  function milli(q) { return Math.round(q * 1000); }

  /** A threshold of limits.warn, or null when the masters do not carry it. */
  function warnAt(key) {
    var group = M.limits.warn, v = group ? group[key] : null;
    return typeof v === 'number' && v >= 0 ? v : null;
  }

  function warn(code, message, field) {
    (warns || (warns = [])).push({ code: code, message: message, field: field || null });
  }

  /** The warnings raised by the build just done; nothing is left behind for the next document. */
  function takeWarnings() {
    var list = warns || [];
    warns = null;
    return list;
  }

  /**
   * The audit note of a posting. With warnings: their codes go on the document, once each, and the note says
   * "Entered with a warning: ..." after whatever it said before.
   */
  function warnedNote(doc, list, note) {
    if (!list || !list.length) return note || '';
    var codes = [], said = [], i;
    for (i = 0; i < list.length; i++) {
      if (codes.indexOf(list[i].code) === -1) codes.push(list[i].code);
      said.push(list[i].message);
    }
    doc.warned = codes;
    return (note ? note + '. ' : '') + (said.length === 1 ? 'Entered with a warning: ' : 'Entered with warnings: ') + said.join('; ');
  }

  /* -------------------------------------------------------------- masters */
  /*
   * HB.masters is a private copy of HB.config (a master change must never write into the static config), with
   * what the config leaves out filled in by convention and an index per entity.
   */

  function normaliseUnit(u) {
    if (typeof u === 'string') u = { id: u };
    if (!u.kind) u.kind = u.id === FACTORY ? 'factory' : 'store';
    if (!u.name) u.name = u.id;
    if (u.active === undefined) u.active = true;
    if (u.kind === 'store') {
      if (!u.locId) u.locId = u.id;
      if (!u.transitLocId) u.transitLocId = 'transit_' + u.id;
      if (!u.cashAccountId) u.cashAccountId = 'cash_' + u.id;
      if (!u.standing) u.standing = {};
    } else if (!u.cashAccountId) {
      u.cashAccountId = CASH_FACTORY;
    }
    return u;
  }

  function normaliseLocation(l) {
    if (typeof l === 'string') l = { id: l };
    if (!l.kind) l.kind = l.id === RM ? 'rm' : (l.id === FG ? 'fg' : (l.id.indexOf('transit_') === 0 ? 'transit' : 'store'));
    if (!l.unitId) l.unitId = l.kind === 'rm' || l.kind === 'fg' ? FACTORY : (l.kind === 'transit' ? l.id.slice(8) : l.id);
    if (!l.name) l.name = l.id;
    if (l.active === undefined) l.active = true;
    return l;
  }

  function normaliseAccount(a) {
    if (typeof a === 'string') a = { id: a };
    if (!a.kind) a.kind = a.id === BANK ? 'bank' : 'cash';
    if (a.unitId === undefined) a.unitId = a.kind === 'bank' ? null : a.id.replace(/^cash_/, '');
    if (!a.name) a.name = a.id;
    if (a.active === undefined) a.active = true;
    return a;
  }

  function indexBy(list, key) {
    var out = {};
    for (var i = 0; i < list.length; i++) out[list[i][key || 'id']] = list[i];
    return out;
  }

  function ensure(list, index, id, make) {
    if (!index[id]) { var rec = make(); list.push(rec); index[id] = rec; }
  }

  /** The category a rule of the engine posts to: marked in the config by `system`, else found by id, else by name. */
  function systemCategory(m, tag, ids, pattern) {
    var list = m.expenseCategories, i;
    for (i = 0; i < list.length; i++) if (list[i].system === tag) return list[i].id;
    for (i = 0; i < list.length; i++) if (ids.indexOf(list[i].id) !== -1) return list[i].id;
    for (i = 0; i < list.length; i++) if (pattern.test(list[i].name || '')) return list[i].id;
    return null;
  }

  function buildMasters(cfg) {
    cfg = cfg || {};
    var m = {
      company: clone(cfg.company || {}),
      limits: clone(cfg.limits || {}),
      journeys: cfg.journeys || [],
      units: clone(cfg.units || []).map(normaliseUnit),
      locations: clone(cfg.locations || []).map(normaliseLocation),
      accounts: clone(cfg.accounts || []).map(normaliseAccount),
      items: clone(cfg.items || []),
      recipes: clone(cfg.recipes || []),
      routes: clone(cfg.routes || []),
      customers: clone(cfg.customers || []),
      vendors: clone(cfg.vendors || []),
      employees: clone(cfg.employees || []),
      expenseCategories: clone(cfg.expenseCategories || []),
      users: clone(cfg.users && cfg.users.length ? cfg.users : (HB.session ? HB.session.users : [])),
      changes: []
    };
    var k, i;
    for (k in LIMIT_DEFAULTS) if (has.call(LIMIT_DEFAULTS, k) && typeof m.limits[k] !== 'number') m.limits[k] = LIMIT_DEFAULTS[k];

    m.unitById = indexBy(m.units);
    m.locationById = indexBy(m.locations);
    m.accountById = indexBy(m.accounts);
    /* every unit has its places and its cash, whether or not the config lists them */
    if (m.unitById[FACTORY]) {
      ensure(m.locations, m.locationById, RM, function () { return normaliseLocation({ id: RM, name: 'Raw material store' }); });
      ensure(m.locations, m.locationById, FG, function () { return normaliseLocation({ id: FG, name: 'Finished goods store' }); });
    }
    m.units.forEach(function (u) {
      if (u.kind === 'store') {
        ensure(m.locations, m.locationById, u.locId, function () { return normaliseLocation({ id: u.locId, name: u.name, kind: 'store', unitId: u.id }); });
        ensure(m.locations, m.locationById, u.transitLocId, function () { return normaliseLocation({ id: u.transitLocId, name: 'In transit to ' + u.name, kind: 'transit', unitId: u.id }); });
      }
      ensure(m.accounts, m.accountById, u.cashAccountId, function () { return normaliseAccount({ id: u.cashAccountId, name: 'Cash, ' + u.name, kind: 'cash', unitId: u.id }); });
    });
    ensure(m.accounts, m.accountById, BANK, function () { return normaliseAccount({ id: BANK, name: 'Bank account' }); });

    var lists = ['items', 'customers', 'vendors', 'employees', 'expenseCategories', 'routes'];
    for (i = 0; i < lists.length; i++) m[lists[i]].forEach(function (r) { if (r.active === undefined) r.active = true; });
    m.items.forEach(function (it) { if (typeof it.gstRate !== 'number') it.gstRate = 0; });

    m.itemById = indexBy(m.items);
    m.recipeByItem = indexBy(m.recipes, 'itemId');
    m.routeById = indexBy(m.routes);
    m.customerById = indexBy(m.customers);
    m.vendorById = indexBy(m.vendors);
    m.employeeById = indexBy(m.employees);
    m.categoryById = indexBy(m.expenseCategories);
    m.userById = indexBy(m.users);

    m.staffVendorId = null;
    for (i = 0; i < m.vendors.length; i++) if (m.vendors[i].kind === 'staff') { m.staffVendorId = m.vendors[i].id; break; }
    m.shortExcessCategoryId = systemCategory(m, 'cash_short', ['cash_short'], /short/i);
    m.salaryCategoryId = systemCategory(m, 'salary', ['salaries', 'salary'], /salar/i);
    return m;
  }

  /* ----------------------------------------------------------------- book */

  function newBook() {
    var b = {
      seq: 0,              /* the posting sequence: one counter for documents, ledger rows, prices and audit entries */
      docs: {},            /* id -> document */
      docList: [],         /* documents in posting order */
      byType: {},          /* type -> documents in posting order */
      days: {},            /* date -> { date, docs, moves, ar, ap, cash, pnl, gst, items }: everything dated that day */
      counters: {},        /* type -> date -> last number given to a seeded id */
      stock: {},           /* locId -> itemId -> quantity on hand */
      reserved: {},        /* locId -> itemId -> quantity on PENDING write-offs */
      lots: {},            /* locId -> itemId -> [{ batchId, bestBefore, mfgDate, qty, reserved }], oldest first, on hand only */
      batches: {},         /* batchId -> { id, itemId, mfgDate, bestBefore, docId, qty } */
      batchesByItem: {},   /* itemId -> [batch], in order of creation */
      moves: [],           /* the movement ledger */
      ar: { entries: [], byParty: {}, balance: {}, total: 0, credit: {}, open: {}, creditUsed: {} },
      ap: { entries: [], byParty: {}, balance: {}, total: 0, open: {} },
      cash: { entries: [], byAccount: {}, balance: {} },
      pnl: [],             /* P&L entries */
      pnlMonth: {},        /* monthKey -> line -> key -> running total */
      gst: [],             /* GST entries */
      prices: {},          /* itemId -> { rate, docId, date, history: [{ seq, date, rate, docId, cancelled }] } */
      audit: [],           /* the audit trail */
      rowIdx: [],          /* parallel to docList: the posting (index into rowMarks / 6) in which that document wrote its rows, or -1 */
      rowMarks: [],        /* six ledger lengths per posting: moves, receivable, payable, cash, P&L, GST - where its rows start */
      rowIdx2: {},         /* XFER id -> the posting of its receipt (a transfer writes rows twice) */
      pending: {},         /* id -> document waiting for approval (PENDING or HELD), oldest first */
      unbilled: {},        /* vendorId -> [GRN] posted and not on a bill */
      index: {
        billNo: {},        /* vendorId|bill number -> VBILL id (HELD or POSTED) */
        dayEnd: {},        /* storeId|date -> DAYEND id (uncancelled) */
        sheet: {},         /* sheetId -> [INV] uncancelled invoices of that dispatch sheet */
        salary: {},        /* monthKey -> EXP id of the salary bill (PENDING, APPROVED or PAID) */
        supply: {},        /* customerId -> date -> taxable of POSTED invoices (not opening) */
        returned: {}       /* customerId -> date -> taxable of POSTED or HELD credit notes */
      }
    };
    var i;
    for (i = 0; i < DOC_TYPES.length; i++) b.byType[DOC_TYPES[i]] = [];
    for (i = 0; i < M.accounts.length; i++) { b.cash.balance[M.accounts[i].id] = 0; b.cash.byAccount[M.accounts[i].id] = []; }
    for (i = 0; i < M.locations.length; i++) { b.stock[M.locations[i].id] = {}; b.lots[M.locations[i].id] = {}; b.reserved[M.locations[i].id] = {}; }
    return b;
  }

  var lastDayKey = null, lastDay = null, lastMonthDate = null, lastMonth = null, costCache = {};

  /** Start again: the masters from HB.config and an empty book. HB.engine.boot() begins here. */
  function reset() {
    M = HB.masters = buildMasters(HB.config);
    book = HB.book = newBook();
    lastDayKey = lastDay = lastMonthDate = lastMonth = null;
    costCache = {};
    return book;
  }

  function dayFor(date) {
    if (date === lastDayKey) return lastDay;
    lastDayKey = date;
    return (lastDay = book.days[date] || (book.days[date] = { date: date, docs: [], moves: [], ar: [], ap: [], cash: [], pnl: [], gst: [], items: {} }));
  }

  function monthFor(date) {
    if (date === lastMonthDate) return lastMonth;
    lastMonthDate = date;
    var mk = date.slice(0, 7);
    return (lastMonth = book.pnlMonth[mk] || (book.pnlMonth[mk] = { sales: {}, returns: {}, cogs: {}, prodLoss: {}, writeoff: {}, countDiff: {}, expense: {} }));
  }

  /*
   * The rows a document writes are consecutive in every ledger, because one document is posted at a time. So
   * they are remembered as positions, not as lists: each posting that writes rows marks where the six ledgers
   * stood when it began, and its rows run from there to the marks of the next posting. Nothing is allocated per
   * document, which matters when the seed posts seventy thousand of them.
   */

  /** A document's position in docList; documents are in posting order, so a search by seq finds it. */
  function ordinalOf(doc) {
    var list = book.docList, lo = 0, hi = list.length - 1;
    if (hi >= 0 && list[hi] === doc) return hi;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      if (list[mid].seq === doc.seq) return mid;
      if (list[mid].seq < doc.seq) lo = mid + 1; else hi = mid - 1;
    }
    return -1;
  }

  /** Call before a document writes rows. Every row must be written inside a posting opened here. */
  function rowsBegin(doc, second) {
    var marks = book.rowMarks, e = marks.length / 6;
    marks.push(book.moves.length, book.ar.entries.length, book.ap.entries.length, book.cash.entries.length, book.pnl.length, book.gst.length);
    if (second) book.rowIdx2[doc.id] = e; else book.rowIdx[ordinalOf(doc)] = e;
  }

  /** Where ledger k (0 moves, 1 receivable, 2 payable, 3 cash, 4 P&L, 5 GST) stood at the start of posting e, or stands now. */
  function markAt(e, k) {
    var marks = book.rowMarks;
    if (e * 6 < marks.length) return marks[e * 6 + k];
    return k === 0 ? book.moves.length : k === 1 ? book.ar.entries.length : k === 2 ? book.ap.entries.length : k === 3 ? book.cash.entries.length : k === 4 ? book.pnl.length : book.gst.length;
  }

  function postingOf(doc) {
    var n = ordinalOf(doc), e = n === -1 ? -1 : book.rowIdx[n];
    return e === undefined ? -1 : e;
  }

  /** The rows a document wrote, as lists: { moves, ar, ap, cash, pnl, gst }. Empty lists for one that wrote none. */
  function rowsOf(docId) {
    var doc = book.docs[docId], e = doc ? postingOf(doc) : -1;
    var out = { moves: [], ar: [], ap: [], cash: [], pnl: [], gst: [] };
    if (e === -1) return out;
    out.moves = book.moves.slice(markAt(e, 0), markAt(e + 1, 0));
    out.ar = book.ar.entries.slice(markAt(e, 1), markAt(e + 1, 1));
    out.ap = book.ap.entries.slice(markAt(e, 2), markAt(e + 1, 2));
    out.cash = book.cash.entries.slice(markAt(e, 3), markAt(e + 1, 3));
    out.pnl = book.pnl.slice(markAt(e, 4), markAt(e + 1, 4));
    out.gst = book.gst.slice(markAt(e, 5), markAt(e + 1, 5));
    var e2 = book.rowIdx2[docId];
    if (e2 !== undefined) out.moves = out.moves.concat(book.moves.slice(markAt(e2, 0), markAt(e2 + 1, 0)));
    return out;
  }

  /* ------------------------------------------------------------ documents */

  /* Most documents never wait for anyone; they share one frozen record instead of carrying one each. */
  var NO_APPROVAL = Object.freeze({ state: 'none', by: null, at: null, reason: '', self: false });

  function newDoc(type, date, status, note) {
    return {
      id: '', seq: 0, type: type, date: date, status: status,
      createdBy: op.userId, createdAt: op.at || date + 'T09:00', seed: op.seed, createdAs: op.as,
      note: note ? String(note) : '',
      approval: status === 'PENDING' || status === 'HELD' ? { state: 'pending', by: null, at: null, reason: '', self: false } : NO_APPROVAL,
      cancelled: null
    };
  }

  /**
   * The id fixed in the log entry if there is one left, otherwise the next seeded id of that type and day. A
   * seeded id is unique by its counter and is not looked up before use (looking up a new string costs more than
   * the rest of the commit), so the ids a log entry carries must never have the seeded form: TYPE-U-NNNN only.
   */
  function nextId(type, date) {
    if (op.ids && op.n < op.ids.length) return op.ids[op.n++];
    var c = book.counters[type] || (book.counters[type] = {});
    var n = (c[date] || 0) + 1;
    c[date] = n;
    return type + '-' + ymd(date) + '-' + pad3(n);
  }

  function commitDoc(doc) {
    doc.id = nextId(doc.type, doc.date);
    doc.seq = ++book.seq;
    book.docs[doc.id] = doc;
    book.docList.push(doc);
    book.rowIdx.push(-1);
    book.byType[doc.type].push(doc);
    dayFor(doc.date).docs.push(doc);
    return doc;
  }

  function audit(action, doc, note, before, after) {
    book.audit.push({
      seq: ++book.seq, at: op.at || (doc ? doc.date : op.date) + 'T09:00', userId: op.userId, userAs: op.as, role: op.role, action: action,
      docId: doc ? doc.id : null, type: doc ? doc.type : null,
      note: note || '', before: before === undefined ? null : before, after: after === undefined ? null : after
    });
  }

  function done(doc, warnings) { return { ok: true, doc: doc, warnings: warnings || [] }; }

  function dry(doc, warnings, docs) {
    var out = { ok: true, preview: true, doc: doc, warnings: warnings || [] };
    if (docs) out.docs = docs;
    return out;
  }

  function needDoc(id, type, field) {
    var d = book.docs[id];
    if (!d || (type && d.type !== type)) refuse('not_found', id ? 'There is no ' + (DOC_NOUN[type] || 'document') + ' ' + id : 'Choose the ' + (DOC_NOUN[type] || 'document'), field);
    return d;
  }

  var DOC_NOUN = {
    PO: 'purchase order', GRN: 'goods receipt', VBILL: 'vendor bill', PAY: 'payment', PROD: 'production entry',
    SO: 'sales order', INV: 'invoice', RCPT: 'receipt', CN: 'stale return', XFER: 'transfer', DAYEND: 'day-end',
    DEP: 'cash deposit', ADJ: 'stock count', WO: 'write-off', EXP: 'expense', CXL: 'cancellation',
    OPENSTOCK: 'opening stock entry', OPENCASH: 'opening cash entry'
  };

  /* ---------------------------------------------------------- ledger rows */
  /*
   * Each writer appends one row, files it under its day and moves the running balance. A row is a small object
   * and there are a million of them in two years: keep the money and quantity fields whole numbers (a fraction
   * in a field makes every later row of that shape bigger) and add no field that a selector can derive.
   */

  function arRow(date, docId, customerId, amount, kind, rev) {
    var a = book.ar;
    var row = { seq: ++book.seq, date: date, docId: docId, customerId: customerId, amount: amount, kind: kind, reversal: rev };
    a.entries.push(row);
    dayFor(date).ar.push(row);
    (a.byParty[customerId] || (a.byParty[customerId] = [])).push(row);
    a.balance[customerId] = (a.balance[customerId] || 0) + amount;
    a.total += amount;
  }

  var apKeys = { vendor: {}, employee: {} };
  /** 'vendor:<id>' or 'employee:<id>': the key of a payee in book.ap. Remembered, because a fresh string is a slow key. */
  function apKey(payeeType, payeeId) {
    var byType = apKeys[payeeType] || (apKeys[payeeType] = {});
    return byType[payeeId] || (byType[payeeId] = payeeType + ':' + payeeId);
  }

  function apRow(date, docId, payeeType, payeeId, amount, kind, rev) {
    var a = book.ap, key = apKey(payeeType, payeeId);
    var row = { seq: ++book.seq, date: date, docId: docId, payeeType: payeeType, payeeId: payeeId, amount: amount, kind: kind, reversal: rev };
    a.entries.push(row);
    dayFor(date).ap.push(row);
    (a.byParty[key] || (a.byParty[key] = [])).push(row);
    a.balance[key] = (a.balance[key] || 0) + amount;
    a.total += amount;
  }

  function cashRow(date, docId, accountId, amount, kind, rev) {
    var c = book.cash;
    var row = { seq: ++book.seq, date: date, docId: docId, accountId: accountId, amount: amount, kind: kind, reversal: rev };
    c.entries.push(row);
    dayFor(date).cash.push(row);
    (c.byAccount[accountId] || (c.byAccount[accountId] = [])).push(row);
    c.balance[accountId] = (c.balance[accountId] || 0) + amount;
  }

  /**
   * One P&L entry. Signs: sales positive, returns negative, every cost line (cogs, prodLoss, writeoff, countDiff,
   * expense) positive when it is a cost. qty is whole units of finished goods (0 for materials and expenses).
   * The month total is kept by channel for sales, returns and cogs, by 'category|unit' for expenses and under
   * 'all' for the rest.
   */
  function plRow(date, docId, line, channel, itemId, categoryId, unitId, amount, qty, rev) {
    var row = {
      seq: ++book.seq, date: date, docId: docId, line: line, channel: channel, itemId: itemId,
      categoryId: categoryId, unitId: unitId, amount: amount, qty: qty, reversal: rev
    };
    book.pnl.push(row);
    dayFor(date).pnl.push(row);
    var cell = monthFor(date)[line];
    var key = line === 'expense' ? categoryId + '|' + unitId : (channel || 'all');
    cell[key] = (cell[key] || 0) + amount;
  }

  function gstRow(date, docId, dir, gstRate, taxable, cgst, sgst, rev) {
    var row = { seq: ++book.seq, date: date, docId: docId, dir: dir, gstRate: gstRate, taxable: taxable, cgst: cgst, sgst: sgst, reversal: rev };
    book.gst.push(row);
    dayFor(date).gst.push(row);
  }

  var gRates = [], gTax = [], gCgst = [], gSgst = []; /* scratch for gstRows: one document at a time, nothing to allocate */

  /** One GST entry per rate for a document whose lines carry gstRate, taxable, cgst and sgst. sign is 1 or -1. */
  function gstRows(date, docId, dir, lines, sign) {
    var rates = gRates, tx = gTax, cg = gCgst, sg = gSgst, n = 0, i, j, l;
    for (i = 0; i < lines.length; i++) {
      l = lines[i];
      for (j = 0; j < n; j++) if (rates[j] === l.gstRate) break;
      if (j === n) { rates[n] = l.gstRate; tx[n] = 0; cg[n] = 0; sg[n] = 0; n++; }
      tx[j] += l.taxable; cg[j] += l.cgst; sg[j] += l.sgst;
    }
    for (j = 0; j < n; j++) {
      if (tx[j] === 0 && cg[j] === 0) continue; /* a line with nothing sold (expired units only) is not a supply */
      if (sign < 0) gstRow(date, docId, dir, rates[j], neg(tx[j]), neg(cg[j]), neg(sg[j]), false);
      else gstRow(date, docId, dir, rates[j], tx[j], cg[j], sg[j], false);
    }
  }

  /* ---------------------------------------------------------------- stock */

  function lotIndex(list, batchId) {
    for (var i = 0; i < list.length; i++) if (list[i].batchId === batchId) return i;
    return -1;
  }

  /** Keep a lot list in the order stock leaves: best-before, then manufacturing date, then batch id. */
  function lotInsert(list, lot) {
    var i = list.length;
    while (i > 0) {
      var p = list[i - 1];
      if (p.bestBefore < lot.bestBefore) break;
      if (p.bestBefore === lot.bestBefore && (p.mfgDate < lot.mfgDate || (p.mfgDate === lot.mfgDate && p.batchId < lot.batchId))) break;
      i--;
    }
    if (i === list.length) list.push(lot); else list.splice(i, 0, lot);
  }

  function lotOf(locId, itemId, batchId) {
    var byItem = book.lots[locId], list = byItem ? byItem[itemId] : null;
    if (!list) return null;
    var i = lotIndex(list, batchId);
    return i === -1 ? null : list[i];
  }

  /** Quantity on hand: of one batch for finished goods, of the item for materials. */
  function onHand(locId, itemId, batchId) {
    if (batchId) { var lot = lotOf(locId, itemId, batchId); return lot ? lot.qty : 0; }
    var st = book.stock[locId];
    return st ? st[itemId] || 0 : 0;
  }

  function reservedOf(locId, itemId, batchId) {
    if (batchId) { var lot = lotOf(locId, itemId, batchId); return lot ? lot.reserved : 0; }
    var r = book.reserved[locId];
    return r ? r[itemId] || 0 : 0;
  }

  /** One movement row; moves the stock balance and, for finished goods, the batch. qty is signed. */
  function move(date, docId, locId, itemId, batchId, qty, kind, rev) {
    var st = book.stock[locId] || (book.stock[locId] = {});
    var now = (st[itemId] || 0) + qty;
    st[itemId] = batchId ? now : q3(now); /* finished goods are whole units; only materials need the rounding */
    if (batchId) {
      var byItem = book.lots[locId] || (book.lots[locId] = {});
      var list = byItem[itemId] || (byItem[itemId] = []);
      var i = lotIndex(list, batchId);
      if (i === -1) {
        var b = book.batches[batchId];
        lotInsert(list, { batchId: batchId, bestBefore: b.bestBefore, mfgDate: b.mfgDate, qty: qty, reserved: 0 });
      } else {
        var lot = list[i];
        lot.qty += qty;
        if (lot.qty === 0 && lot.reserved === 0) list.splice(i, 1);
      }
    }
    /*
     * Two literals with the same fields in another order, on purpose. Once a field has held a fraction the engine
     * boxes it for every later object of that shape; material rows (2.5 kg) would make every finished-goods row
     * (whole units, by far the most) pay for that. Keeping them apart keeps the many rows small.
     */
    var row = batchId
      ? { seq: ++book.seq, date: date, docId: docId, locId: locId, itemId: itemId, batchId: batchId, qty: qty, kind: kind, reversal: rev }
      : { seq: ++book.seq, date: date, docId: docId, locId: locId, itemId: itemId, qty: qty, batchId: null, kind: kind, reversal: rev };
    book.moves.push(row);
    dayFor(date).moves.push(row);
  }

  /** Put a quantity on hold for a PENDING write-off (qty above zero), or let it go (qty below zero). */
  function reserve(locId, itemId, batchId, qty) {
    var r = book.reserved[locId] || (book.reserved[locId] = {});
    r[itemId] = q3((r[itemId] || 0) + qty);
    if (!batchId) return;
    var byItem = book.lots[locId], list = byItem ? byItem[itemId] : null;
    var i = list ? lotIndex(list, batchId) : -1;
    if (i === -1) return;
    list[i].reserved += qty;
    if (list[i].qty === 0 && list[i].reserved === 0) list.splice(i, 1);
  }

  var lastFree = 0; /* what takeUnexpired found when it came back empty-handed */

  /**
   * Oldest unexpired first: the batches to take `qty` from, as [{ batchId, qty }], or null when the stock that is
   * unexpired on `date` and not reserved does not cover it (lastFree then holds what there is). Changes nothing.
   */
  function takeUnexpired(locId, itemId, qty, date) {
    var byItem = book.lots[locId], lots = byItem ? byItem[itemId] : null, out = null, need = qty;
    if (lots) {
      for (var i = 0; i < lots.length; i++) {
        var lot = lots[i];
        if (lot.bestBefore < date) continue;
        var free = lot.qty - lot.reserved;
        if (free <= 0) continue;
        if (free >= need) {
          if (out === null) return [{ batchId: lot.batchId, qty: need }];
          out.push({ batchId: lot.batchId, qty: need });
          return out;
        }
        if (out === null) out = [];
        out.push({ batchId: lot.batchId, qty: free });
        need -= free;
      }
    }
    lastFree = qty - need;
    return null;
  }

  /**
   * The expired units of a day-end: from batches with bestBefore on or before `date`, what is left after the
   * units sold (`sold`, the batches just taken) and is not reserved, oldest first. null when there is less.
   */
  function takeExpired(locId, itemId, qty, date, sold) {
    var byItem = book.lots[locId], lots = byItem ? byItem[itemId] : null, out = [], need = qty;
    if (lots) {
      for (var i = 0; i < lots.length; i++) {
        var lot = lots[i];
        if (lot.bestBefore > date) break; /* the list is in best-before order */
        var free = lot.qty - lot.reserved;
        for (var j = 0; j < sold.length; j++) if (sold[j].batchId === lot.batchId) free -= sold[j].qty;
        if (free <= 0) continue;
        if (free >= need) { out.push({ batchId: lot.batchId, qty: need }); return out; }
        out.push({ batchId: lot.batchId, qty: free });
        need -= free;
      }
    }
    lastFree = qty - need;
    return null;
  }

  /**
   * Stock available to a new document dated `date`: for finished goods the unexpired, unreserved quantity; for
   * materials the quantity on hand less what is on PENDING write-offs. Never below zero.
   */
  function available(locId, itemId, date) {
    var it = M.itemById[itemId];
    if (it && it.kind !== 'fg') {
      var left = q3(onHand(locId, itemId, null) - reservedOf(locId, itemId, null));
      return left > 0 ? left : 0;
    }
    var byItem = book.lots[locId], lots = byItem ? byItem[itemId] : null, sum = 0;
    if (lots) {
      for (var i = 0; i < lots.length; i++) {
        var free = lots[i].qty - lots[i].reserved;
        if (free > 0 && (!date || lots[i].bestBefore >= date)) sum += free;
      }
    }
    return sum;
  }

  function nextBatchId(itemId, date) {
    var it = itemOf(itemId), base = 'B-' + ymd(date) + '-' + (it.code || it.id);
    if (!book.batches[base]) return base;
    var n = 2;
    while (book.batches[base + '-' + n]) n++;
    return base + '-' + n;
  }

  function addBatch(id, itemId, mfgDate, bestBefore, docId, qty) {
    var b = { id: id, itemId: itemId, mfgDate: mfgDate, bestBefore: bestBefore, docId: docId, qty: qty };
    book.batches[id] = b;
    (book.batchesByItem[itemId] || (book.batchesByItem[itemId] = [])).push(b);
    return b;
  }

  /* -------------------------------------------------------------- costing */

  function priceOf(itemId) { var p = book.prices[itemId]; return p ? p.rate : 0; }

  /** The latest purchase price is the rate of the uncancelled receipt posted last; this records one more. */
  function setPrice(itemId, rate, date, docId) {
    var p = book.prices[itemId] || (book.prices[itemId] = { rate: 0, docId: null, date: null, history: [] });
    p.history.push({ seq: ++book.seq, date: date, rate: rate, docId: docId, cancelled: false });
    p.rate = rate; p.docId = docId; p.date = date;
    costCache = {};
  }

  /** A receipt is cancelled: its price entry is struck and the latest price falls back to the one before. */
  function dropPrice(itemId, docId) {
    var p = book.prices[itemId], i, h, last = null;
    if (!p) return;
    for (i = 0; i < p.history.length; i++) {
      h = p.history[i];
      if (h.docId === docId) h.cancelled = true;
      if (!h.cancelled) last = h;
    }
    p.rate = last ? last.rate : 0; p.docId = last ? last.docId : null; p.date = last ? last.date : null;
    costCache = {};
  }

  /**
   * Unit recipe cost of a product now, in paise (held to four decimals so that it prints and compares cleanly):
   * recipe materials at latest price over the expected units, plus packing per unit. Remembered until a price or
   * a recipe changes.
   */
  function fgCost(itemId) {
    var c = costCache[itemId];
    if (c !== undefined) return c;
    var rec = M.recipeByItem[itemId], sum = 0, pack = 0, i;
    if (!rec || !(rec.expectedUnits > 0)) return (costCache[itemId] = 0);
    for (i = 0; i < rec.materials.length; i++) sum += rec.materials[i].qty * priceOf(rec.materials[i].itemId);
    if (rec.packing) for (i = 0; i < rec.packing.length; i++) pack += rec.packing[i].qtyPerUnit * priceOf(rec.packing[i].itemId);
    return (costCache[itemId] = Math.round((sum / rec.expectedUnits + pack) * 10000) / 10000);
  }

  function unitCost(itemId) {
    var it = M.itemById[itemId];
    if (!it) return 0;
    return it.kind === 'fg' ? fgCost(itemId) : priceOf(itemId);
  }

  function round4(x) { return Math.round(x * 10000) / 10000; }

  function costSheet(itemId) {
    var it = M.itemById[itemId], rec = M.recipeByItem[itemId];
    if (!it || !rec) return null;
    var mixCost = 0, perUnitMat = 0, perUnitPack = 0;
    var materials = rec.materials.map(function (m) {
      var rate = priceOf(m.itemId), mi = itemOf(m.itemId);
      var value = money.amount(m.qty, rate), perUnit = round4(m.qty * rate / rec.expectedUnits);
      mixCost += value; perUnitMat += m.qty * rate / rec.expectedUnits;
      return { itemId: m.itemId, name: mi.name, unit: mi.unit, qty: m.qty, rate: rate, value: value, perUnit: perUnit };
    });
    var packing = (rec.packing || []).map(function (p) {
      var rate = priceOf(p.itemId), pi = itemOf(p.itemId);
      perUnitPack += p.qtyPerUnit * rate;
      return { itemId: p.itemId, name: pi.name, unit: pi.unit, qtyPerUnit: p.qtyPerUnit, rate: rate, perUnit: round4(p.qtyPerUnit * rate) };
    });
    return {
      itemId: itemId, name: it.name, mixLabel: rec.mixLabel || '', expectedUnits: rec.expectedUnits,
      materials: materials, packing: packing, mixCost: mixCost,
      materialPerUnit: round4(perUnitMat), packingPerUnit: round4(perUnitPack), unitCost: fgCost(itemId)
    };
  }

  /* ---------------------------------------------------------- receivables */

  function openAmount(inv) { return inv.total - inv.creditApplied - inv.paidNow - inv.received - inv.credited; }

  /** Keep the customer's list of open invoices true to the invoice: in it (by date, then posting order) or out. */
  function syncOpen(inv) {
    var list = book.ar.open[inv.customerId] || (book.ar.open[inv.customerId] = []);
    var at = list.indexOf(inv);
    var open = inv.status === 'POSTED' && openAmount(inv) > 0;
    if (!open) { if (at !== -1) list.splice(at, 1); return; }
    if (at !== -1) return;
    var i = list.length;
    while (i > 0 && (list[i - 1].date > inv.date || (list[i - 1].date === inv.date && list[i - 1].seq > inv.seq))) i--;
    if (i === list.length) list.push(inv); else list.splice(i, 0, inv);
  }

  /** A new invoice with something left to pay: straight onto the end of the list, unless it is dated before the last one. */
  function openAppend(inv) {
    var list = book.ar.open[inv.customerId] || (book.ar.open[inv.customerId] = []), n = list.length;
    if (n === 0 || list[n - 1].date <= inv.date) list.push(inv); else syncOpen(inv);
  }

  function addCredit(customerId, amount) { book.ar.credit[customerId] = (book.ar.credit[customerId] || 0) + amount; }

  /**
   * A cancelled receipt or credit note takes its on-account credit back. What later invoices have already used
   * is taken back from them, latest first, so the customer's credit never goes below zero. Returns what was
   * taken back, as [{ docId, amount }].
   */
  function withdrawCredit(customerId, amount) {
    var have = book.ar.credit[customerId] || 0, back = [];
    if (have >= amount) { book.ar.credit[customerId] = have - amount; return back; }
    var short = amount - have, used = book.ar.creditUsed[customerId] || [];
    book.ar.credit[customerId] = 0;
    for (var i = used.length - 1; i >= 0 && short > 0; i--) {
      var inv = used[i], t = inv.creditApplied < short ? inv.creditApplied : short;
      inv.creditApplied -= t;
      short -= t;
      back.push({ docId: inv.id, amount: t });
      if (inv.creditApplied === 0) used.splice(i, 1);
      syncOpen(inv);
    }
    return back;
  }

  /**
   * The uncancelled receipts, credit notes or payments allocated to a document, in posting order. Found from the
   * party's own ledger rows when asked for (a refusal, a document view); nothing is kept for it while posting.
   */
  function settlers(doc) {
    var inv = doc.type === 'INV', out = [], i, j;
    var rows = inv ? book.ar.byParty[doc.customerId] : book.ap.byParty[payeeOf(doc)];
    if (!rows) return out;
    for (i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (r.reversal || (inv ? r.kind !== 'receipt' && r.kind !== 'credit_note' : r.kind !== 'payment')) continue;
      var d = book.docs[r.docId];
      if (!d || d.status !== 'POSTED' || !d.allocations) continue;
      for (j = 0; j < d.allocations.length; j++) if (d.allocations[j].docId === doc.id) { out.push(d); break; }
    }
    return out;
  }

  function lastSettler(doc) {
    var list = settlers(doc);
    return list.length ? list[list.length - 1].id : null;
  }

  function dayAdd(map, key, date, amount) {
    var m = map[key] || (map[key] = {});
    m[date] = (m[date] || 0) + amount;
  }

  /* ------------------------------------------------------------- payables */

  function payOpen(doc) { return doc.total - doc.paid; }

  function payeeOf(doc) { return doc.type === 'VBILL' ? apKey('vendor', doc.vendorId) : apKey(doc.payeeType, doc.payeeId); }

  /** Keep the payee's list of open bills and expenses true to the document. */
  function syncPayable(doc) {
    var key = payeeOf(doc), list = book.ap.open[key] || (book.ap.open[key] = []);
    var at = list.indexOf(doc);
    var open = (doc.type === 'VBILL' ? doc.status === 'POSTED' : doc.status === 'APPROVED') && payOpen(doc) > 0;
    if (open && at === -1) list.push(doc);
    else if (!open && at !== -1) list.splice(at, 1);
  }

  function hold(doc) { book.pending[doc.id] = doc; }

  /* --------------------------------------------------------- item figures */
  /*
   * Sales, returns and cost of goods sold by item are kept as running figures per day, unit and channel, not as
   * one P&L entry per invoice line: an invoice writes one sales entry and one cost entry, and its lines add to
   * the day's cells. That halves the number of ledger rows. A cell moves on the date of whatever moves it, a
   * cancellation included, so a sum of cells over a range is a sum of rows by their own date.
   * book.days[date].items[unitId][channel][itemId] = { qty, sales, cogs, returnQty, returns }
   * (returns is zero or less, like the P&L returns line; returnQty is the number of units returned).
   */

  function itemCells(date, unitId, channel) {
    var items = dayFor(date).items, byChannel = items[unitId] || (items[unitId] = {});
    return byChannel[channel] || (byChannel[channel] = {});
  }

  function cellOf(cells, itemId) {
    return cells[itemId] || (cells[itemId] = { qty: 0, sales: 0, cogs: 0, returnQty: 0, returns: 0 });
  }

  /** Add (sign 1) or take back (sign -1) what an invoice, a day-end or a posted credit note says by item, on `date`. */
  function itemFigures(doc, date, sign) {
    var lines = doc.lines, cells, c, l, i;
    if (doc.type === 'INV') {
      cells = itemCells(date, FACTORY, doc.channel);
      for (i = 0; i < lines.length; i++) { l = lines[i]; c = cellOf(cells, l.itemId); c.qty += sign * l.qty; c.sales += sign * l.taxable; c.cogs += sign * l.cost; }
    } else if (doc.type === 'DAYEND') {
      cells = itemCells(date, doc.storeId, 'store');
      for (i = 0; i < lines.length; i++) { l = lines[i]; if (l.sold === 0) continue; c = cellOf(cells, l.itemId); c.qty += sign * l.sold; c.sales += sign * l.taxable; c.cogs += sign * l.cost; }
    } else if (doc.type === 'CN') {
      cells = itemCells(date, FACTORY, doc.channel);
      for (i = 0; i < lines.length; i++) { l = lines[i]; c = cellOf(cells, l.itemId); c.returnQty += sign * l.qty; c.returns -= sign * l.taxable; }
    }
  }

  /* ================================================================ posters */

  /* ------------------------------------------------------------------- PO */

  function buildPO(p) {
    var date = needDate(p.date, 'date');
    var v = M.vendorById[p.vendorId];
    if (!v) refuse('invalid_input', 'Choose a vendor', 'vendorId');
    if (v.kind !== 'stock') refuse('invalid_input', v.name + ' does not supply materials; a purchase order goes to a stock vendor', 'vendorId');
    if (v.active === false) refuse('invalid_input', v.name + ' is not an active vendor', 'vendorId');
    var src = needLines(p.lines, 'Add at least one item to the order');
    var expected = p.expectedDate ? needDate(p.expectedDate, 'expectedDate', 'the expected date') : date;
    if (expected < date) refuse('invalid_input', 'The expected date cannot be before the order date', 'expectedDate');
    var lines = [], total = 0, seen = {}, i;
    for (i = 0; i < src.length; i++) {
      var it = needItem(src[i].itemId, i);
      if (it.kind === 'fg') refuse('invalid_input', it.name + ' is a finished product; a purchase order is for materials and packing', lineField(i, 'itemId'));
      if (it.active === false) refuse('invalid_input', it.name + ' is not an active item', lineField(i, 'itemId'));
      if (seen[it.id]) refuse('invalid_input', it.name + ' is on the order twice; put it on one line', lineField(i, 'itemId'));
      seen[it.id] = 1;
      var qty = needQty(src[i].qty, it, lineField(i, 'qty')), rate = needRate(src[i].rate, it, lineField(i, 'rate'));
      var amount = money.amount(qty, rate);
      if (!op.seed) rateWarning(it, rate, lineField(i, 'rate'));
      lines.push({ itemId: it.id, qty: qty, rate: rate, gstRate: it.gstRate || 0, amount: amount, received: 0 });
      total += amount;
    }
    var waits = total > M.limits.poAutoApprove;
    var doc = newDoc('PO', date, waits ? 'PENDING' : 'APPROVED', p.note);
    doc.vendorId = v.id; doc.expectedDate = expected; doc.lines = lines; doc.total = total; doc.grnIds = [];
    return doc;
  }

  /** A rate far from the item's latest purchase price: a slip of a digit, or a price to ask the vendor about. */
  function rateWarning(it, rate, field) {
    var pct = warnAt('rateAwayPct'), latest = priceOf(it.id);
    if (pct === null || !(latest > 0) || Math.round(Math.abs(rate - latest) * 100) * 100 <= pct * Math.round(latest * 100)) return;
    warn('rate_far', it.name + ': ' + fmt.rate(rate) + ' against the latest purchase price of ' + fmt.rate(latest) + ', more than ' + pct + '% away', field);
  }

  function postPO(p) {
    var doc = buildPO(p), w = takeWarnings();
    if (op.dry) return dry(doc, w);
    commitDoc(doc);
    if (doc.status === 'PENDING') { audit('post', doc, warnedNote(doc, w, ''), null, doc.status); hold(doc); if (op.owner) applyApproval(doc); }
    else audit('post', doc, warnedNote(doc, w, 'within limit'), null, doc.status);
    return done(doc, w);
  }

  /** PART_RECEIVED while a receipt stands and any line is short of its quantity; RECEIVED when none is. */
  function poStatus(po) {
    if (!po.grnIds.length) return 'APPROVED';
    for (var i = 0; i < po.lines.length; i++) if (po.lines[i].received < po.lines[i].qty) return 'PART_RECEIVED';
    return 'RECEIVED';
  }

  function poLine(po, itemId) {
    for (var i = 0; i < po.lines.length; i++) if (po.lines[i].itemId === itemId) return po.lines[i];
    return null;
  }

  /* ------------------------------------------------------------------ GRN */

  function buildGRN(p) {
    var date = needDate(p.date, 'date');
    var po = needDoc(p.poId, 'PO', 'poId');
    if (po.status !== 'APPROVED' && po.status !== 'PART_RECEIVED') refuse('wrong_state', po.id + ' is ' + word(po.status) + '; goods are received only against an approved order', 'poId', po.id);
    /* goods cannot arrive before they were ordered: a back-dated receipt goes back to the order's date at most */
    if (date < po.date) refuse('invalid_input', 'A receipt cannot be dated before its order', 'date');
    var src = needLines(p.lines, 'Enter the quantity received for at least one item');
    var lines = [], seen = {}, i;
    for (i = 0; i < src.length; i++) {
      var it = needItem(src[i].itemId, i), pl = poLine(po, it.id);
      if (!pl) refuse('invalid_input', it.name + ' is not on ' + po.id, lineField(i, 'itemId'));
      if (seen[it.id]) refuse('invalid_input', it.name + ' is on the receipt twice; put it on one line', lineField(i, 'itemId'));
      seen[it.id] = 1;
      var qty = needQty(src[i].qty === undefined ? 0 : src[i].qty, it, lineField(i, 'qty'), true);
      var rej = needQty(src[i].rejectedQty === undefined || src[i].rejectedQty === null ? 0 : src[i].rejectedQty, it, lineField(i, 'rejectedQty'), true);
      if (qty === 0 && rej === 0) continue;
      var left = q3(pl.qty - pl.received);
      if (qty > left) refuse('invalid_input', it.name + ': ' + qtyText(qty, it) + ' is more than the ' + qtyText(left, it) + ' still to come on ' + po.id, lineField(i, 'qty'));
      lines.push({ itemId: it.id, qty: qty, rejectedQty: rej, rate: pl.rate });
    }
    if (!lines.length) refuse('invalid_input', 'Enter the quantity received for at least one item', 'lines');
    var doc = newDoc('GRN', date, 'POSTED', p.note);
    doc.poId = po.id; doc.vendorId = po.vendorId; doc.lines = lines; doc.billId = null;
    return doc;
  }

  function postGRN(p) {
    var doc = buildGRN(p);
    if (op.dry) return dry(doc);
    commitDoc(doc);
    var po = book.docs[doc.poId], billable = false, i;
    rowsBegin(doc);
    for (i = 0; i < doc.lines.length; i++) {
      var l = doc.lines[i];
      if (l.qty === 0) continue; /* a rejected quantity is a record only */
      billable = true;
      move(doc.date, doc.id, RM, l.itemId, null, l.qty, 'receipt', false);
      var pl = poLine(po, l.itemId);
      pl.received = q3(pl.received + l.qty);
      setPrice(l.itemId, l.rate, doc.date, doc.id);
    }
    po.grnIds.push(doc.id);
    po.status = poStatus(po);
    if (billable) (book.unbilled[doc.vendorId] || (book.unbilled[doc.vendorId] = [])).push(doc);
    audit('post', doc, '', null, doc.status);
    return done(doc);
  }

  function unbilledDrop(grn) {
    var list = book.unbilled[grn.vendorId], i = list ? list.indexOf(grn) : -1;
    if (i !== -1) list.splice(i, 1);
  }

  function unbilledAdd(grn) {
    var list = book.unbilled[grn.vendorId] || (book.unbilled[grn.vendorId] = []);
    for (var i = 0; i < grn.lines.length; i++) if (grn.lines[i].qty > 0) { if (list.indexOf(grn) === -1) list.push(grn); return; }
  }

  /* ---------------------------------------------------------------- VBILL */

  function billKey(vendorId, billNo) { return vendorId + '|' + billNo.toLowerCase(); }

  function buildOpenBill(p) {
    if (!op.seed) refuse('invalid_input', 'Opening bills are part of the opening entries and cannot be added', null);
    var date = needDate(p.date, 'date');
    var v = M.vendorById[p.vendorId];
    if (!v) refuse('invalid_input', 'Choose a vendor', 'vendorId');
    var total = needPaise(p.total, 'Enter the opening amount owed to ' + v.name, 'total');
    var doc = newDoc('VBILL', date, 'POSTED', p.note);
    doc.vendorId = v.id; doc.billNo = p.billNo ? String(p.billNo) : 'Opening'; doc.grnIds = []; doc.lines = [];
    doc.taxable = 0; doc.gst = 0; doc.total = total;
    doc.dueDate = p.dueDate ? needDate(p.dueDate, 'dueDate', 'the due date') : date;
    doc.match = { ok: true, diffs: [] }; doc.paid = 0; doc.opening = true; doc.holdReason = '';
    return doc;
  }

  function buildVBill(p) {
    if (p.opening) return buildOpenBill(p);
    var date = needDate(p.date, 'date');
    var v = M.vendorById[p.vendorId];
    if (!v) refuse('invalid_input', 'Choose a vendor', 'vendorId');
    var billNo = needText(p.billNo, 'Enter the bill number printed on the vendor bill', 'billNo');
    var dup = book.index.billNo[billKey(v.id, billNo)];
    if (dup) refuse('duplicate', 'Bill ' + billNo + ' of ' + v.name + ' is already entered as ' + dup, 'billNo', dup);
    if (!Array.isArray(p.grnIds) || !p.grnIds.length) refuse('invalid_input', 'Choose the goods receipts this bill is for', 'grnIds');

    /* what the receipts say should be billed, per item */
    var exp = {}, order = [], i, j, it;
    for (i = 0; i < p.grnIds.length; i++) {
      var grn = needDoc(p.grnIds[i], 'GRN', 'grnIds');
      if (p.grnIds.indexOf(grn.id) !== i) refuse('invalid_input', grn.id + ' is chosen twice', 'grnIds');
      if (grn.status !== 'POSTED') refuse('wrong_state', grn.id + ' is ' + word(grn.status) + ' and cannot be billed', 'grnIds', grn.id);
      if (grn.vendorId !== v.id) refuse('invalid_input', grn.id + ' is a receipt from another vendor', 'grnIds', grn.id);
      if (grn.billId) refuse('duplicate', grn.id + ' is already billed on ' + grn.billId, 'grnIds', grn.billId);
      for (j = 0; j < grn.lines.length; j++) {
        var gl = grn.lines[j], e = exp[gl.itemId];
        if (!e) { e = exp[gl.itemId] = { orderedRate: gl.rate, acceptedQty: 0, expected: 0, billedQty: 0, billedRate: null, billed: 0 }; order.push(gl.itemId); }
        e.orderedRate = gl.rate;
        e.acceptedQty = q3(e.acceptedQty + gl.qty);
        e.expected += money.amount(gl.qty, gl.rate);
      }
    }

    var src = needLines(p.lines, 'Enter the items on the bill');
    var lines = [], taxable = 0, gst = 0;
    for (i = 0; i < src.length; i++) {
      it = needItem(src[i].itemId, i);
      var qty = needQty(src[i].qty, it, lineField(i, 'qty')), rate = needRate(src[i].rate, it, lineField(i, 'rate'));
      var gr = src[i].gstRate === undefined || src[i].gstRate === null ? (it.gstRate || 0) : +src[i].gstRate;
      if (!(gr >= 0) || !isFinite(gr)) refuse('invalid_input', it.name + ': enter the GST rate', lineField(i, 'gstRate'));
      var tx = money.amount(qty, rate), tax = Math.round(tx * gr / 200);
      lines.push({ itemId: it.id, qty: qty, rate: rate, gstRate: gr, taxable: tx, cgst: tax, sgst: tax });
      taxable += tx; gst += tax + tax;
      var b = exp[it.id];
      if (!b) { b = exp[it.id] = { orderedRate: null, acceptedQty: 0, expected: 0, billedQty: 0, billedRate: null, billed: 0 }; order.push(it.id); }
      b.billedQty = q3(b.billedQty + qty); b.billedRate = rate; b.billed += tx;
    }

    /* the three-way check: billed against ordered rate x accepted quantity, item by item, either way */
    var tol = M.limits.billTolerancePct, ok = true, diffs = [];
    for (i = 0; i < order.length; i++) {
      var x = exp[order[i]], diff = x.billed - x.expected;
      var fine = Math.abs(diff) * 100 <= tol * x.expected;
      if (!fine) ok = false;
      diffs.push({
        itemId: order[i], orderedRate: x.orderedRate, acceptedQty: x.acceptedQty, billedQty: x.billedQty,
        billedRate: x.billedRate, expected: x.expected, billed: x.billed, diff: diff, ok: fine
      });
    }

    var doc = newDoc('VBILL', date, ok ? 'POSTED' : 'HELD', p.note);
    doc.vendorId = v.id; doc.billNo = billNo; doc.grnIds = p.grnIds.slice(); doc.lines = lines;
    doc.taxable = taxable; doc.gst = gst; doc.total = taxable + gst;
    doc.dueDate = addDays(date, v.termsDays || 0);
    doc.match = { ok: ok, diffs: diffs }; doc.paid = 0; doc.opening = false;
    doc.holdReason = ok ? '' : 'the bill is more than ' + tol + '% away from its order and receipts';
    return doc;
  }

  function billRows(doc) {
    rowsBegin(doc);
    doc.status = 'POSTED';
    apRow(doc.date, doc.id, 'vendor', doc.vendorId, doc.total, 'bill', false);
    if (doc.lines.length) gstRows(doc.date, doc.id, 'input', doc.lines, 1);
    syncPayable(doc);
  }

  function postVBill(p) {
    var doc = buildVBill(p), i;
    if (op.dry) return dry(doc);
    commitDoc(doc);
    if (!doc.opening) {
      book.index.billNo[billKey(doc.vendorId, doc.billNo)] = doc.id;
      for (i = 0; i < doc.grnIds.length; i++) { var grn = book.docs[doc.grnIds[i]]; grn.billId = doc.id; unbilledDrop(grn); }
    }
    if (doc.status === 'POSTED') { billRows(doc); audit('post', doc, '', null, doc.status); }
    else { audit('post', doc, doc.holdReason, null, doc.status); hold(doc); if (op.owner) applyApproval(doc); }
    return done(doc);
  }

  function unlinkBill(doc) {
    delete book.index.billNo[billKey(doc.vendorId, doc.billNo)];
    for (var i = 0; i < doc.grnIds.length; i++) {
      var grn = book.docs[doc.grnIds[i]];
      if (grn.billId === doc.id) { grn.billId = null; if (grn.status === 'POSTED') unbilledAdd(grn); }
    }
  }

  /* ------------------------------------------------------------------ PAY */

  function buildPay(p) {
    var date = needDate(p.date, 'date');
    var type = p.payeeType, payee = type === 'vendor' ? M.vendorById[p.payeeId] : (type === 'employee' ? M.employeeById[p.payeeId] : null);
    if (!payee) refuse('invalid_input', 'Choose who is being paid', 'payeeId');
    var acc = M.accountById[p.account];
    if (!acc || (acc.id !== BANK && acc.id !== CASH_FACTORY)) refuse('invalid_input', 'Pay from factory cash or the bank', 'account');
    if (!Array.isArray(p.allocations) || !p.allocations.length) refuse('invalid_input', 'Enter an amount against at least one bill or claim', 'allocations');
    var allocs = [], sum = 0, seen = {}, latest = null, i;
    for (i = 0; i < p.allocations.length; i++) {
      var a = p.allocations[i], f = 'allocations[' + i + ']';
      if (!isRow(a)) refuse('invalid_input', 'Row ' + (i + 1) + ' is empty: choose a bill or remove the row', f + '.docId');
      var d = book.docs[a.docId];
      if (!d || (d.type !== 'VBILL' && d.type !== 'EXP')) refuse('not_found', 'There is no bill or expense ' + (a.docId || ''), f + '.docId');
      if (seen[d.id]) refuse('invalid_input', d.id + ' is on the payment twice', f + '.docId');
      seen[d.id] = 1;
      if (payeeOf(d) !== apKey(type, payee.id)) refuse('invalid_input', d.id + ' is not owed to ' + payee.name, f + '.docId', d.id);
      if (d.type === 'VBILL' ? d.status !== 'POSTED' : d.status !== 'APPROVED') refuse('wrong_state', d.id + ' is ' + word(d.status) + ' and cannot be paid', f + '.docId', d.id);
      if (d.type === 'EXP' && d.kind === 'salary' && acc.id !== BANK) refuse('invalid_input', 'The salary bill is paid from the bank', 'account');
      var amt = needPaise(a.amount, d.id + ': enter the amount to pay', f + '.amount');
      if (amt > payOpen(d)) refuse('invalid_input', d.id + ': ' + fmt.inr2(amt) + ' is more than the ' + fmt.inr2(payOpen(d)) + ' still to pay', f + '.amount', d.id);
      allocs.push({ docId: d.id, amount: amt });
      sum += amt;
      if (!latest || d.date > latest.date) latest = d;
    }
    /* nothing is paid before it is owed: a back-dated payment goes back to the latest of its bills and claims at most */
    if (date < latest.date) refuse('invalid_input', 'A payment cannot be dated before the bills and claims it pays: ' + latest.id + ' is dated ' + dayText(latest.date), 'date', latest.id);
    if (p.amount !== undefined && p.amount !== null && +p.amount !== sum) refuse('invalid_input', 'The payment of ' + fmt.inr2(+p.amount) + ' must equal the bills it pays, ' + fmt.inr2(sum), 'amount');
    var bal = book.cash.balance[acc.id] || 0;
    if (bal < sum) refuse('cash_short', acc.name + ' has ' + fmt.inr2(bal) + '; this payment needs ' + fmt.inr2(sum), 'amount');
    var doc = newDoc('PAY', date, 'POSTED', p.note);
    doc.payeeType = type; doc.payeeId = payee.id; doc.account = acc.id; doc.amount = sum; doc.allocations = allocs;
    doc.ref = p.ref ? String(p.ref) : '';
    return doc;
  }

  function postPay(p) {
    var doc = buildPay(p);
    if (op.dry) return dry(doc);
    commitDoc(doc);
    rowsBegin(doc);
    cashRow(doc.date, doc.id, doc.account, -doc.amount, 'payment', false);
    apRow(doc.date, doc.id, doc.payeeType, doc.payeeId, -doc.amount, 'payment', false);
    for (var i = 0; i < doc.allocations.length; i++) {
      var d = book.docs[doc.allocations[i].docId];
      d.paid += doc.allocations[i].amount;
      syncPayable(d); /* while it is still APPROVED, so that a fully paid expense leaves the open list */
      if (d.type === 'EXP' && d.paid === d.total) d.status = 'PAID';
    }
    audit('post', doc, '', null, doc.status);
    return done(doc);
  }

  /* ----------------------------------------------------------------- PROD */

  function addConsumption(list, at, itemId, qty) {
    if (!(qty > 0)) return;
    if (at[itemId] === undefined) { at[itemId] = list.length; list.push({ itemId: itemId, qty: qty, rate: 0, value: 0 }); }
    else list[at[itemId]].qty = q3(list[at[itemId]].qty + qty);
  }

  function buildProd(p) {
    var date = needDate(p.date, 'date');
    var it = M.itemById[p.itemId];
    if (!it || it.kind !== 'fg') refuse('invalid_input', 'Choose the product that was made', 'itemId');
    if (it.active === false) refuse('invalid_input', it.name + ' is not an active item', 'itemId');
    var rec = M.recipeByItem[it.id];
    if (!rec || !(rec.expectedUnits > 0)) refuse('invalid_input', it.name + ' has no recipe, so its production cannot be recorded', 'itemId');
    var mixes = +p.mixes;
    if (!isFinite(mixes)) refuse('invalid_input', 'Enter the number of mixes', 'mixes');
    /* rounded first, then tested: a figure that rounds to no mix, or to a run the recipe expects nothing of, is no run,
       and its yield would have nothing to be measured against */
    mixes = q3(mixes);
    var expected = q3(rec.expectedUnits * mixes);
    if (!(mixes > 0) || !(expected > 0)) refuse('invalid_input', 'Enter the number of mixes', 'mixes');
    var good = needQty(p.goodUnits, it, 'goodUnits');
    var rejected = needQty(p.rejectedUnits === undefined || p.rejectedUnits === null ? 0 : p.rejectedUnits, it, 'rejectedUnits', true);
    var batchId = op.batchId || nextBatchId(it.id, date);
    if (book.batches[batchId]) refuse('duplicate', 'Batch ' + batchId + ' already exists', null);

    var cons = [], at = {}, i;
    for (i = 0; i < rec.materials.length; i++) addConsumption(cons, at, rec.materials[i].itemId, q3(rec.materials[i].qty * mixes));
    if (rec.packing) for (i = 0; i < rec.packing.length; i++) addConsumption(cons, at, rec.packing[i].itemId, q3(rec.packing[i].qtyPerUnit * good));
    for (i = 0; i < cons.length; i++) {
      var c = cons[i], have = available(RM, c.itemId, null);
      if (q3(have - c.qty) < 0) {
        var mi = itemOf(c.itemId);
        refuse('stock_short', mi.name + ': ' + qtyText(c.qty, mi) + ' needed for ' + fmt.qty(mixes) + (mixes === 1 ? ' mix' : ' mixes') + ' of ' + it.name + ', ' + qtyText(have, mi) + ' in the raw material store', 'mixes');
      }
      c.rate = priceOf(c.itemId);
      c.value = money.amount(c.qty, c.rate);
    }
    var cost = fgCost(it.id);
    if (!op.seed) yieldWarning(it, mixes, good, expected);
    var doc = newDoc('PROD', date, 'POSTED', p.note);
    doc.itemId = it.id; doc.mixes = mixes; doc.goodUnits = good; doc.rejectedUnits = rejected; doc.expectedUnits = expected;
    doc.batchId = batchId; doc.bestBefore = addDays(date, it.shelfLifeDays || 0);
    doc.consumption = cons; doc.unitCost = cost; doc.lossValue = money.amount(q3(expected - good), cost);
    return doc;
  }

  /** Good units far from what the recipe expects for the mixes: the mixes or the good units were mistyped, or the run went badly wrong. */
  function yieldWarning(it, mixes, good, expected) {
    var low = warnAt('yieldLowPct'), high = warnAt('yieldHighPct'), g = milli(good) * 100, e = milli(expected);
    var under = low !== null && g < low * e;
    if (!(under || (high !== null && g > high * e))) return;
    var usual = low !== null && high !== null ? low + '% to ' + high + '%' : (low !== null ? low + '% or more' : high + '% or less');
    warn('yield_unusual', it.name + ': ' + qtyText(good, it) + ' good is ' + pctBeyond(good / expected, under ? low : high) + ' of the ' + qtyText(expected, it) +
      ' the recipe expects for ' + fmt.qty(mixes) + (mixes === 1 ? ' mix' : ' mixes') + '. A run normally gives ' + usual, 'goodUnits');
  }

  /**
   * A share as a percentage that does not read as the bound it broke: one decimal, or as many more as it takes
   * (79.98% where one decimal would print 80.0% beside "80% to 105%"), four at most.
   */
  function pctBeyond(x, boundPct) {
    var d = 1;
    while (d < 4 && fmt.pct(x, d) === fmt.pct(boundPct / 100, d)) d++;
    return fmt.pct(x, d);
  }

  function postProd(p) {
    var doc = buildProd(p), w = takeWarnings();
    if (op.dry) return dry(doc, w);
    commitDoc(doc);
    var i;
    rowsBegin(doc);
    for (i = 0; i < doc.consumption.length; i++) move(doc.date, doc.id, RM, doc.consumption[i].itemId, null, -doc.consumption[i].qty, 'consumption', false);
    addBatch(doc.batchId, doc.itemId, doc.date, doc.bestBefore, doc.id, doc.goodUnits);
    move(doc.date, doc.id, FG, doc.itemId, doc.batchId, doc.goodUnits, 'production', false);
    if (doc.lossValue !== 0) plRow(doc.date, doc.id, 'prodLoss', null, doc.itemId, null, FACTORY, doc.lossValue, wholeUnits(doc.expectedUnits - doc.goodUnits), false);
    audit('post', doc, warnedNote(doc, w, ''), null, doc.status);
    return done(doc, w);
  }

  /* ------------------------------------------------------------------- SO */

  function channelPrice(it, corporate) {
    var pr = it.price;
    return pr ? (corporate ? pr.corporate : pr.retail) : undefined;
  }

  function soLine(so, itemId) {
    for (var i = 0; i < so.lines.length; i++) if (so.lines[i].itemId === itemId) return so.lines[i];
    return null;
  }

  function needCustomer(id, mustBeActive) {
    var c = M.customerById[id];
    if (!c) refuse('invalid_input', 'Choose a customer', 'customerId');
    if (mustBeActive && c.active === false) refuse('invalid_input', c.name + ' is not an active customer', 'customerId');
    return c;
  }

  function buildSO(p) {
    var date = needDate(p.date, 'date');
    var c = needCustomer(p.customerId, true);
    /* SCOPE 4.5: order, delivery, invoice is the corporate channel; an outlet is supplied from its route's dispatch sheet */
    if (c.channel !== 'corporate') refuse('invalid_input', c.name + ' is not a corporate customer; a sales order is for a corporate customer', 'customerId');
    var delivery = p.deliveryDate ? needDate(p.deliveryDate, 'deliveryDate', 'the delivery date') : date;
    if (delivery < date) refuse('invalid_input', 'The delivery date cannot be before the order date', 'deliveryDate');
    var src = needLines(p.lines, 'Add at least one item to the order');
    var lines = [], seen = {}, corporate = c.channel === 'corporate', i;
    for (i = 0; i < src.length; i++) {
      var it = needItem(src[i].itemId, i);
      if (it.kind !== 'fg') refuse('invalid_input', it.name + ' is not a finished product', lineField(i, 'itemId'));
      if (it.active === false) refuse('invalid_input', it.name + ' is not an active item', lineField(i, 'itemId'));
      if (seen[it.id]) refuse('invalid_input', it.name + ' is on the order twice; put it on one line', lineField(i, 'itemId'));
      seen[it.id] = 1;
      var qty = needQty(src[i].qty, it, lineField(i, 'qty'));
      var price = needRate(src[i].price === undefined || src[i].price === null ? channelPrice(it, corporate) : src[i].price, it, lineField(i, 'price'), true);
      lines.push({ itemId: it.id, qty: qty, price: price });
    }
    var doc = newDoc('SO', date, 'OPEN', p.note);
    doc.customerId = c.id; doc.deliveryDate = delivery; doc.poRef = p.poRef ? String(p.poRef) : ''; doc.lines = lines; doc.invId = null;
    return doc;
  }

  function postSO(p) {
    var doc = buildSO(p);
    if (op.dry) return dry(doc);
    commitDoc(doc);
    audit('post', doc, '', null, doc.status);
    return done(doc);
  }

  /* ------------------------------------------------------------------ INV */

  var trial = false;    /* a dispatch sheet first builds every invoice without the stock test (it tests the sheet as a whole) */
  var invWarnings = null;

  function buildOpenInv(p) {
    if (!op.seed) refuse('invalid_input', 'Opening invoices are part of the opening entries and cannot be added', null);
    var date = needDate(p.date, 'date');
    var c = needCustomer(p.customerId, false);
    var total = needPaise(p.total, 'Enter the opening amount ' + c.name + ' owes', 'total');
    var doc = newDoc('INV', date, 'POSTED', p.note);
    doc.customerId = c.id; doc.channel = c.channel; doc.routeId = c.routeId || null; doc.sheetId = null; doc.soId = null;
    doc.terms = c.terms; doc.dueDate = p.dueDate ? needDate(p.dueDate, 'dueDate', 'the due date') : date;
    doc.lines = []; doc.units = 0; doc.cost = 0; doc.taxable = 0; doc.gst = 0; doc.total = total;
    doc.creditApplied = 0; doc.paidNow = 0; doc.received = 0; doc.credited = 0; doc.opening = true;
    return doc;
  }

  function buildInv(p) {
    if (p.opening) return buildOpenInv(p);
    var date = needDate(p.date, 'date');
    var c = needCustomer(p.customerId, true);
    var so = null, src = p.lines;
    if (p.soId) {
      so = needDoc(p.soId, 'SO', 'soId');
      if (so.customerId !== c.id) refuse('invalid_input', so.id + ' is an order of another customer', 'soId', so.id);
      if (so.status !== 'OPEN') refuse('wrong_state', so.id + ' is ' + word(so.status) + (so.invId ? ': it is invoiced on ' + so.invId : ''), 'soId', so.invId || so.id);
      if (!src) src = so.lines;
    }
    if (!Array.isArray(src) || !src.length) refuse('invalid_input', 'Add at least one item to the invoice', 'lines');
    var corporate = c.channel === 'corporate';
    var lines = [], taxable = 0, gst = 0, units = 0, costSum = 0, n = src.length, i, k;
    for (i = 0; i < n; i++) {
      var l = src[i];
      if (!isRow(l)) refuse('invalid_input', 'Line ' + (i + 1) + ' is empty: choose a finished product or remove the line', lineField(i, 'itemId'));
      var qty = +l.qty;
      if (qty === 0) continue; /* an untouched row of a sheet or a grid */
      var it = M.itemById[l.itemId];
      if (!it || it.kind !== 'fg') refuse('invalid_input', 'Line ' + (i + 1) + ': choose a finished product', lineField(i, 'itemId'));
      if (it.active === false) refuse('invalid_input', it.name + ' is not an active item', lineField(i, 'itemId'));
      for (k = 0; k < lines.length; k++) if (lines[k].itemId === it.id) refuse('invalid_input', it.name + ' is on the invoice twice; put it on one line', lineField(i, 'itemId'));
      if (!(qty > 0) || qty !== Math.floor(qty) || !isFinite(qty)) refuse('invalid_input', it.name + ': enter a whole number of units', lineField(i, 'qty'));
      var price = +l.price;
      if (l.price === undefined || l.price === null) {
        /* the price agreed on the order holds for whatever part of it is invoiced; the price list is for the rest */
        var agreed = so ? soLine(so, it.id) : null;
        price = agreed ? agreed.price : channelPrice(it, corporate);
      }
      if (!(price >= 0) || !isFinite(price)) refuse('invalid_input', it.name + ': enter the price', lineField(i, 'price'));
      var rate = it.gstRate || 0;
      var tx = money.amount(qty, price), tax = Math.round(tx * rate / 200);
      var uc = fgCost(it.id), batches = takeUnexpired(FG, it.id, qty, date);
      if (batches === null) {
        if (!trial) refuse('stock_short', it.name + ': ' + qtyText(qty, it) + ' wanted, ' + qtyText(lastFree, it) + ' available in the finished goods store', lineField(i, 'qty'));
        batches = [];
      }
      var cost = money.amount(qty, uc);
      if (so && !op.seed) {
        /* more than was ordered, or something the order does not have: the invoice is for what was delivered all the same */
        var onOrder = soLine(so, it.id), ordered = onOrder ? onOrder.qty : 0;
        if (qty > ordered) warn('over_order', it.name + ': ' + qtyText(qty, it) + ' on the invoice, ' + (ordered > 0 ? qtyText(ordered, it) : 'none') + ' on the order ' + so.id, lineField(i, 'qty'));
      }
      lines.push({ itemId: it.id, qty: qty, price: price, gstRate: rate, taxable: tx, cgst: tax, sgst: tax, unitCost: uc, cost: cost, batches: batches });
      taxable += tx; gst += tax + tax; units += qty; costSum += cost;
    }
    if (!lines.length) refuse('invalid_input', 'Enter a quantity for at least one item', 'lines');
    var total = taxable + gst;
    var credit = book.ar.credit[c.id] || 0;
    var doc = newDoc('INV', date, 'POSTED', p.note);
    doc.customerId = c.id; doc.channel = c.channel; doc.routeId = p.routeId || c.routeId || null;
    doc.sheetId = p.sheetId || null; doc.soId = so ? so.id : null;
    doc.terms = c.terms;
    doc.dueDate = c.terms === 'cash' ? date : (c.terms === 'weekly' ? addDays(date, 7) : addDays(date, c.creditDays || 0));
    doc.lines = lines.slice(); /* a copy is exactly as long as it needs to be; a list grown by push keeps room for more */
    doc.units = units; doc.cost = costSum; doc.taxable = taxable; doc.gst = gst; doc.total = total;
    doc.creditApplied = credit < total ? credit : total;
    doc.paidNow = c.terms === 'cash' ? total - doc.creditApplied : 0;
    doc.received = 0; doc.credited = 0; doc.opening = false;
    invWarnings = null;
    /* SCOPE 4.5 gives the credit-limit warning to corporates; an outlet's limit is a figure of its master only */
    if (corporate && c.creditLimit > 0) {
      var owes = (book.ar.balance[c.id] || 0) + total - doc.paidNow;
      if (owes > c.creditLimit) invWarnings = [{ code: 'credit_limit', message: c.name + ' will owe ' + fmt.inr2(owes) + ', above its credit limit of ' + fmt.inr2(c.creditLimit), field: null }];
    }
    return doc;
  }

  function commitInv(doc, w) {
    commitDoc(doc);
    var date = doc.date, id = doc.id, c = doc.customerId, lines = doc.lines, i, j, l;
    rowsBegin(doc);
    arRow(date, id, c, doc.total, 'invoice', false);
    if (doc.opening) { openAppend(doc); audit('post', doc, 'opening balance', null, doc.status); return; }
    for (i = 0; i < lines.length; i++) {
      l = lines[i];
      for (j = 0; j < l.batches.length; j++) move(date, id, FG, l.itemId, l.batches[j].batchId, -l.batches[j].qty, 'dispatch', false);
    }
    if (doc.creditApplied > 0) {
      book.ar.credit[c] -= doc.creditApplied;
      (book.ar.creditUsed[c] || (book.ar.creditUsed[c] = [])).push(doc);
    }
    if (doc.paidNow > 0) {
      arRow(date, id, c, -doc.paidNow, 'collected', false);
      cashRow(date, id, CASH_FACTORY, doc.paidNow, 'collected', false);
    }
    if (doc.total - doc.creditApplied - doc.paidNow > 0) openAppend(doc);
    plRow(date, id, 'sales', doc.channel, null, null, FACTORY, doc.taxable, doc.units, false);
    plRow(date, id, 'cogs', doc.channel, null, null, FACTORY, doc.cost, doc.units, false);
    itemFigures(doc, date, 1);
    gstRows(date, id, 'output', lines, 1);
    dayAdd(book.index.supply, c, date, doc.taxable);
    if (doc.sheetId) (book.index.sheet[doc.sheetId] || (book.index.sheet[doc.sheetId] = [])).push(doc);
    if (doc.soId) { var so = book.docs[doc.soId]; so.status = 'INVOICED'; so.invId = id; }
    audit('post', doc, warnedNote(doc, w, ''), null, doc.status);
  }

  /* The credit-limit warning stays as it was: returned, and neither kept on the invoice nor in its audit entry. */
  function postInv(p) {
    var doc = buildInv(p), w = takeWarnings(), warnings = invWarnings ? invWarnings.concat(w) : w;
    invWarnings = null;
    if (op.dry) return dry(doc, warnings);
    commitInv(doc, w);
    return done(doc, warnings);
  }

  /* ------------------------------------------------------- dispatch sheet */

  function sheetIdOf(routeId, date) { return 'DS-' + routeId + '-' + ymd(date); }

  /**
   * All or nothing. First every outlet is built without the stock test, so that any bad input refuses the sheet
   * before a single invoice exists; then each product is added up over the outlets and tested against the stock
   * available; only then are the invoices posted, in route stop order.
   */
  function postDispatch(args) {
    args = args || {};
    var route = M.routeById[args.routeId];
    if (!route) refuse('invalid_input', 'Choose a route', 'routeId');
    var date = needDate(args.date, 'date');
    var sheetId = sheetIdOf(route.id, date), posted = book.index.sheet[sheetId];
    if (posted && posted.length) refuse('duplicate', 'The ' + route.name + ' sheet for ' + dayText(date) + ' is already posted. Further supply to an outlet that day goes on a single invoice', 'date', posted[0].id);
    if (!Array.isArray(args.outlets) || !args.outlets.length) refuse('invalid_input', 'The sheet has no outlets', 'outlets');
    var byCustomer = {}, i, j;
    for (i = 0; i < args.outlets.length; i++) {
      var o = args.outlets[i];
      if (!isRow(o)) refuse('invalid_input', 'Row ' + (i + 1) + ' of the sheet is empty: choose an outlet or remove the row', 'outlets[' + i + '].customerId');
      var c = M.customerById[o.customerId];
      if (!c || route.stops.indexOf(o.customerId) === -1) refuse('invalid_input', (c ? c.name : 'Outlet ' + o.customerId) + ' is not a stop on ' + route.name, 'outlets[' + i + '].customerId');
      if (byCustomer[c.id]) refuse('invalid_input', c.name + ' is on the sheet twice', 'outlets[' + i + '].customerId');
      if (Array.isArray(o.lines)) {
        for (j = 0; j < o.lines.length; j++) if (!isRow(o.lines[j])) refuse('invalid_input', c.name + ': line ' + (j + 1) + ' is empty: choose a finished product or remove the line', 'outlets[' + i + '].lines[' + j + '].itemId');
      }
      byCustomer[c.id] = o;
    }
    var payloads = [], totals = {}, order = [];
    trial = true;
    try {
      for (i = 0; i < route.stops.length; i++) {
        var entryOf = byCustomer[route.stops[i]];
        if (!entryOf || !Array.isArray(entryOf.lines)) continue;
        var any = false;
        for (j = 0; j < entryOf.lines.length; j++) if (+entryOf.lines[j].qty !== 0) { any = true; break; }
        if (!any) continue; /* an outlet that takes nothing today gets no invoice */
        var payload = { date: date, customerId: entryOf.customerId, lines: entryOf.lines, routeId: route.id, sheetId: sheetId, note: args.note };
        var probe;
        try { probe = buildInv(payload); }
        catch (err) {
          /* on a sheet an input is found by its outlet as well: 'outlets[1].lines[0].qty' */
          if (err instanceof Refusal && err.error.field && err.error.field !== 'date') err.error.field = 'outlets[' + args.outlets.indexOf(entryOf) + '].' + err.error.field;
          throw err;
        }
        for (j = 0; j < probe.lines.length; j++) {
          var pl = probe.lines[j];
          if (totals[pl.itemId] === undefined) { totals[pl.itemId] = 0; order.push(pl.itemId); }
          totals[pl.itemId] += pl.qty;
        }
        payloads.push(payload);
      }
    } finally { trial = false; invWarnings = null; warns = null; }
    if (!payloads.length) refuse('invalid_input', 'Enter a quantity for at least one outlet', 'outlets');

    var short = [], parts = [];
    for (i = 0; i < order.length; i++) {
      var free = available(FG, order[i], date);
      if (totals[order[i]] > free) {
        var it = itemOf(order[i]);
        short.push({ itemId: it.id, wanted: totals[order[i]], available: free });
        parts.push(it.name + ' ' + qtyText(totals[order[i]], it) + ' wanted, ' + qtyText(free, it) + ' available');
      }
    }
    if (short.length) {
      var r = new Refusal('stock_short', 'Not enough stock to post the ' + route.name + ' sheet: ' + parts.join('; '), 'outlets', null);
      r.error.short = short; /* the form offers to cut the sheet to these quantities */
      throw r;
    }
    if (op.dry) return { ok: true, preview: true, sheetId: sheetId, totals: totals, docs: [], warnings: [] };

    var docs = [], warnings = [];
    for (i = 0; i < payloads.length; i++) {
      var doc = buildInv(payloads[i]);
      if (invWarnings) warnings = warnings.concat(invWarnings);
      invWarnings = null;
      commitInv(doc, null); /* an invoice of a sheet has no order to be measured against: nothing to keep */
      docs.push(doc);
    }
    return { ok: true, sheetId: sheetId, doc: docs[0], docs: docs, warnings: warnings };
  }

  /* ----------------------------------------------------------------- RCPT */

  function buildRcpt(p) {
    var date = needDate(p.date, 'date');
    var c = needCustomer(p.customerId, false);
    var acc = M.accountById[p.account];
    if (!acc || (acc.id !== BANK && acc.id !== CASH_FACTORY)) refuse('invalid_input', 'Receive into factory cash or the bank', 'account');
    var amount = needPaise(p.amount, 'Enter the amount received', 'amount');
    var src = Array.isArray(p.allocations) ? p.allocations : [], allocs = [], sum = 0, i, k;
    for (i = 0; i < src.length; i++) {
      var f = 'allocations[' + i + ']';
      if (!isRow(src[i])) refuse('invalid_input', 'Row ' + (i + 1) + ' is empty: choose an invoice or remove the row', f + '.docId');
      var inv = needDoc(src[i].docId, 'INV', f + '.docId');
      if (inv.customerId !== c.id) refuse('invalid_input', inv.id + ' is an invoice of another customer', f + '.docId', inv.id);
      if (inv.status !== 'POSTED') refuse('wrong_state', inv.id + ' is ' + word(inv.status) + ' and cannot take a receipt', f + '.docId', inv.id);
      for (k = 0; k < allocs.length; k++) if (allocs[k].docId === inv.id) refuse('invalid_input', inv.id + ' is on the receipt twice', f + '.docId');
      var amt = needPaise(src[i].amount, inv.id + ': enter the amount received against it', f + '.amount');
      if (amt > openAmount(inv)) refuse('invalid_input', inv.id + ': ' + fmt.inr2(amt) + ' is more than the ' + fmt.inr2(openAmount(inv)) + ' still open', f + '.amount', inv.id);
      allocs.push({ docId: inv.id, amount: amt });
      sum += amt;
    }
    if (sum > amount) refuse('invalid_input', 'The invoices add up to ' + fmt.inr2(sum) + ', more than the ' + fmt.inr2(amount) + ' received', 'amount');
    var doc = newDoc('RCPT', date, 'POSTED', p.note);
    doc.customerId = c.id; doc.account = acc.id; doc.amount = amount;
    doc.mode = p.mode ? String(p.mode) : (acc.id === BANK ? 'bank' : 'cash');
    doc.allocations = allocs; doc.onAccount = amount - sum;
    if (!op.seed) {
      /* more than every open invoice of the customer together: the rest can only stay on account */
      var owes = 0, open = book.ar.open[c.id] || [];
      for (i = 0; i < open.length; i++) owes += openAmount(open[i]);
      if (amount > owes) {
        warn('over_owed', (owes > 0 ? fmt.inr2(amount) + ' is more than the ' + fmt.inr2(owes) + ' ' + c.name + ' owes' : c.name + ' owes nothing') +
          '. ' + fmt.inr2(doc.onAccount) + ' will stay on account', 'amount');
      }
    }
    return doc;
  }

  function postRcpt(p) {
    var doc = buildRcpt(p), w = takeWarnings();
    if (op.dry) return dry(doc, w);
    commitDoc(doc);
    rowsBegin(doc);
    cashRow(doc.date, doc.id, doc.account, doc.amount, 'receipt', false);
    arRow(doc.date, doc.id, doc.customerId, -doc.amount, 'receipt', false);
    for (var i = 0; i < doc.allocations.length; i++) {
      var inv = book.docs[doc.allocations[i].docId];
      inv.received += doc.allocations[i].amount;
      syncOpen(inv);
    }
    if (doc.onAccount > 0) addCredit(doc.customerId, doc.onAccount);
    audit('post', doc, warnedNote(doc, w, ''), null, doc.status);
    return done(doc, w);
  }

  /* ------------------------------------------------------------------- CN */

  function buildCN(p) {
    var date = needDate(p.date, 'date');
    var c = needCustomer(p.customerId, false);
    var src = needLines(p.lines, 'Enter the items returned');
    var lines = [], taxable = 0, gst = 0, units = 0, corporate = c.channel === 'corporate', i, k;
    for (i = 0; i < src.length; i++) {
      var it = needItem(src[i].itemId, i);
      if (it.kind !== 'fg') refuse('invalid_input', it.name + ' is not a finished product', lineField(i, 'itemId'));
      for (k = 0; k < lines.length; k++) if (lines[k].itemId === it.id) refuse('invalid_input', it.name + ' is on the return twice; put it on one line', lineField(i, 'itemId'));
      var qty = needQty(src[i].qty, it, lineField(i, 'qty'));
      var price = needRate(src[i].price === undefined || src[i].price === null ? channelPrice(it, corporate) : src[i].price, it, lineField(i, 'price'), true);
      var rate = it.gstRate || 0, tx = money.amount(qty, price), tax = Math.round(tx * rate / 200);
      lines.push({ itemId: it.id, qty: qty, price: price, gstRate: rate, taxable: tx, cgst: tax, sgst: tax });
      taxable += tx; gst += tax + tax; units += qty;
    }
    /* the share of the last seven days' supply, counting this return and the others of the window */
    var sup = book.index.supply[c.id], ret = book.index.returned[c.id], den = 0, num = taxable, d = date;
    for (i = 0; i < 7; i++) {
      if (sup) den += sup[d] || 0;
      if (ret) num += ret[d] || 0;
      d = addDays(d, -1);
    }
    /*
     * The decision is taken on the exact ratio, in whole paise: a share between the limit and the next half
     * hundredth would round down to the limit and post. The stored share is for the screen, to two decimals; on
     * a held note it never reads as within the limit (8.0025% is stored as 8.01, not as 8).
     */
    var limit = M.limits.returnsPct;
    var waits = den === 0 || num * 100 > limit * den;
    var share = den > 0 ? Math.round(num * 10000 / den) / 100 : null;
    if (waits && share !== null && share <= limit) share = Math.round(limit * 100 + 1) / 100;
    var doc = newDoc('CN', date, waits ? 'HELD' : 'POSTED', p.note);
    doc.customerId = c.id; doc.channel = c.channel; doc.lines = lines.slice(); doc.units = units;
    doc.taxable = taxable; doc.gst = gst; doc.total = taxable + gst;
    doc.sharePct = share; doc.allocations = []; doc.onAccount = 0;
    doc.holdReason = !waits ? '' : (share === null ? 'no supply in the last seven days' : 'returns are above ' + M.limits.returnsPct + '% of the supply of the last seven days');
    return doc;
  }

  /** The note becomes POSTED: allocated to the open invoices, oldest first; the rest is the customer's credit. */
  function cnRows(doc) {
    var c = doc.customerId, list = book.ar.open[c], left = doc.total, allocs = [], i = 0;
    rowsBegin(doc);
    doc.status = 'POSTED';
    if (list) {
      while (left > 0 && i < list.length) {
        var inv = list[i], open = openAmount(inv), t = open < left ? open : left;
        inv.credited += t;
        left -= t;
        allocs.push({ docId: inv.id, amount: t });
        if (t === open) list.splice(i, 1); else i++;
      }
    }
    doc.allocations = allocs.length ? allocs.slice() : allocs;
    doc.onAccount = left;
    if (left > 0) addCredit(c, left);
    arRow(doc.date, doc.id, c, -doc.total, 'credit_note', false);
    plRow(doc.date, doc.id, 'returns', doc.channel, null, null, FACTORY, neg(doc.taxable), neg(doc.units), false);
    itemFigures(doc, doc.date, 1);
    gstRows(doc.date, doc.id, 'output', doc.lines, -1);
  }

  function postCN(p) {
    var doc = buildCN(p);
    if (op.dry) return dry(doc);
    commitDoc(doc);
    dayAdd(book.index.returned, doc.customerId, doc.date, doc.taxable);
    if (doc.status === 'POSTED') { cnRows(doc); audit('post', doc, '', null, doc.status); }
    else { audit('post', doc, doc.holdReason, null, doc.status); hold(doc); if (op.owner) applyApproval(doc); }
    return done(doc);
  }

  /* ----------------------------------------------------------------- XFER */

  function needStore(id, field) {
    var u = M.unitById[id];
    if (!u || u.kind !== 'store') refuse('invalid_input', 'Choose a store', field);
    if (u.active === false) refuse('invalid_input', u.name + ' is not an active store', field);
    return u;
  }

  function buildXfer(p) {
    var date = needDate(p.date, 'date');
    var u = needStore(p.toStoreId, 'toStoreId');
    var src = needLines(p.lines, 'Add at least one item to the transfer');
    var lines = [], seen = {}, i;
    for (i = 0; i < src.length; i++) {
      if (+src[i].qty === 0) continue;
      var it = needItem(src[i].itemId, i);
      if (it.kind !== 'fg') refuse('invalid_input', it.name + ' is not a finished product', lineField(i, 'itemId'));
      if (seen[it.id]) refuse('invalid_input', it.name + ' is on the transfer twice; put it on one line', lineField(i, 'itemId'));
      seen[it.id] = 1;
      var qty = needQty(src[i].qty, it, lineField(i, 'qty'));
      var batches = takeUnexpired(FG, it.id, qty, date);
      if (batches === null) refuse('stock_short', it.name + ': ' + qtyText(qty, it) + ' wanted, ' + qtyText(lastFree, it) + ' available in the finished goods store', lineField(i, 'qty'));
      lines.push({ itemId: it.id, qty: qty, batches: batches });
    }
    if (!lines.length) refuse('invalid_input', 'Enter a quantity for at least one item', 'lines');
    var doc = newDoc('XFER', date, 'SENT', p.note);
    doc.toStoreId = u.id; doc.lines = lines; doc.receivedAt = null; doc.receivedBy = null; doc.receivedAs = null;
    return doc;
  }

  function postXfer(p) {
    var doc = buildXfer(p);
    if (op.dry) return dry(doc);
    commitDoc(doc);
    var transit = M.unitById[doc.toStoreId].transitLocId, i, j;
    rowsBegin(doc);
    for (i = 0; i < doc.lines.length; i++) {
      var l = doc.lines[i];
      for (j = 0; j < l.batches.length; j++) {
        move(doc.date, doc.id, FG, l.itemId, l.batches[j].batchId, -l.batches[j].qty, 'transfer', false);
        move(doc.date, doc.id, transit, l.itemId, l.batches[j].batchId, l.batches[j].qty, 'transfer', false);
      }
    }
    audit('post', doc, '', null, doc.status);
    return done(doc);
  }

  function receiveTransfer(id) {
    var doc = needDoc(id, 'XFER', null);
    if (doc.status !== 'SENT') refuse('wrong_state', doc.id + ' is ' + word(doc.status) + '; only a transfer on its way can be confirmed', null, doc.id);
    if (op.dry) return dry(doc);
    var u = M.unitById[doc.toStoreId], date = op.date || doc.date, i, j;
    rowsBegin(doc, true); /* the receipt is the transfer's second posting */
    for (i = 0; i < doc.lines.length; i++) {
      var l = doc.lines[i];
      for (j = 0; j < l.batches.length; j++) {
        move(date, doc.id, u.transitLocId, l.itemId, l.batches[j].batchId, -l.batches[j].qty, 'transfer_in', false);
        move(date, doc.id, u.locId, l.itemId, l.batches[j].batchId, l.batches[j].qty, 'transfer_in', false);
      }
    }
    doc.status = 'RECEIVED';
    doc.receivedAt = op.at || date + 'T09:00';
    doc.receivedBy = op.userId;
    doc.receivedAs = op.as;
    audit('receive', doc, '', 'SENT', 'RECEIVED');
    return done(doc);
  }

  /* --------------------------------------------------------------- DAYEND */

  function dayEndKey(storeId, date) { return storeId + '|' + date; }

  /** Returns [dayEnd, writeOff or null]. The write-off for the expired units is built with it, one line per batch. */
  function buildDayEnd(p) {
    var date = needDate(p.date, 'date');
    var u = needStore(p.storeId, 'storeId');
    var dup = book.index.dayEnd[dayEndKey(u.id, date)];
    if (dup) refuse('duplicate', 'The day-end of ' + u.name + ' for ' + dayText(date) + ' is already entered as ' + dup, 'date', dup);
    var cash = needPaise(p.cash === undefined || p.cash === null ? 0 : p.cash, 'Enter the cash counted', 'cash', true);
    var upi = needPaise(p.upi === undefined || p.upi === null ? 0 : p.upi, 'Enter the UPI total', 'upi', true);
    var src = Array.isArray(p.lines) ? p.lines : [];
    var lines = [], woLines = [], gross = 0, taxable = 0, gst = 0, units = 0, costSum = 0, seen = {}, i, j;
    for (i = 0; i < src.length; i++) {
      if (!isRow(src[i])) refuse('invalid_input', 'Line ' + (i + 1) + ' is empty: choose an item or remove the line', lineField(i, 'itemId'));
      var it = needItem(src[i].itemId, i);
      if (it.kind !== 'fg') refuse('invalid_input', it.name + ' is not a finished product', lineField(i, 'itemId'));
      if (seen[it.id]) refuse('invalid_input', it.name + ' is on the day-end twice; put it on one line', lineField(i, 'itemId'));
      seen[it.id] = 1;
      var sold = needQty(src[i].sold === undefined || src[i].sold === null ? 0 : src[i].sold, it, lineField(i, 'sold'), true);
      var expired = needQty(src[i].expired === undefined || src[i].expired === null ? 0 : src[i].expired, it, lineField(i, 'expired'), true);
      if (sold === 0 && expired === 0) continue;
      var mrp = it.price ? it.price.mrp : undefined;
      if (!(mrp >= 0)) refuse('invalid_input', it.name + ' has no MRP', lineField(i, 'itemId'));
      var batches = [];
      if (sold > 0) {
        batches = takeUnexpired(u.locId, it.id, sold, date);
        if (batches === null) refuse('stock_short', it.name + ': ' + qtyText(sold, it) + ' sold, but only ' + qtyText(lastFree, it) + ' unexpired at ' + u.name, lineField(i, 'sold'));
      }
      var rate = it.gstRate || 0, g = money.amount(sold, mrp);
      var tax = Math.round(g * rate / (2 * (100 + rate))); /* MRP includes GST: take out the tax inside it */
      var uc = fgCost(it.id);
      if (expired > 0) {
        var gone = takeExpired(u.locId, it.id, expired, date, batches);
        if (gone === null) refuse('stock_short', it.name + ': ' + qtyText(expired, it) + ' entered as expired, but only ' + qtyText(lastFree, it) + ' past best-before remain at ' + u.name + ' after the units sold', lineField(i, 'expired'));
        for (j = 0; j < gone.length; j++) woLines.push({ itemId: it.id, batchId: gone[j].batchId, qty: gone[j].qty, rate: uc, value: money.amount(gone[j].qty, uc) });
      }
      var cost = money.amount(sold, uc);
      lines.push({ itemId: it.id, sold: sold, expired: expired, mrp: mrp, gstRate: rate, gross: g, taxable: g - tax - tax, cgst: tax, sgst: tax, unitCost: uc, cost: cost, batches: batches });
      gross += g; taxable += g - tax - tax; gst += tax + tax; units += sold; costSum += cost;
    }
    /* a day-end with nothing in it is a form posted by mistake, as an order with no lines is */
    if (!lines.length && cash === 0 && upi === 0) refuse('invalid_input', 'Enter the units sold or expired, or the cash and UPI of the day', 'lines');
    var doc = newDoc('DAYEND', date, 'POSTED', p.note);
    doc.storeId = u.id; doc.lines = lines; doc.units = units; doc.cost = costSum; doc.gross = gross; doc.taxable = taxable; doc.gst = gst;
    doc.cash = cash; doc.upi = upi; doc.shortExcess = cash + upi - gross; doc.woId = null;
    if (!op.seed) {
      /* a till is a few rupees out; cash and UPI far from the day's sales at MRP is a figure left out or mistyped */
      var away = warnAt('dayEndAwayPct');
      if (away !== null && Math.abs(doc.shortExcess) * 100 > away * gross) {
        warn('cash_far', 'Cash and UPI come to ' + fmt.inr2(cash + upi) + ' against sales of ' + fmt.inr2(gross) + ' at MRP, more than ' + away + '% away', 'cash');
      }
    }
    var wo = null;
    if (woLines.length) {
      wo = newDoc('WO', date, 'PENDING', 'Expired units of the day-end');
      wo.locId = u.locId; wo.reason = 'expired'; wo.sourceDocId = null; wo.lines = woLines;
      wo.value = 0;
      for (i = 0; i < woLines.length; i++) wo.value += woLines[i].value;
    }
    return [doc, wo];
  }

  function postDayEnd(p) {
    var pair = buildDayEnd(p), doc = pair[0], wo = pair[1], w = takeWarnings();
    if (op.dry) return dry(doc, w, wo ? [doc, wo] : [doc]);
    commitDoc(doc);
    var u = M.unitById[doc.storeId], date = doc.date, id = doc.id, i, j, l;
    rowsBegin(doc);
    book.index.dayEnd[dayEndKey(u.id, date)] = id;
    for (i = 0; i < doc.lines.length; i++) {
      l = doc.lines[i];
      for (j = 0; j < l.batches.length; j++) move(date, id, u.locId, l.itemId, l.batches[j].batchId, -l.batches[j].qty, 'sale', false);
    }
    if (doc.cash > 0) cashRow(date, id, u.cashAccountId, doc.cash, 'store_cash', false);
    if (doc.upi > 0) cashRow(date, id, BANK, doc.upi, 'store_upi', false);
    if (doc.units > 0) {
      plRow(date, id, 'sales', 'store', null, null, u.id, doc.taxable, doc.units, false);
      plRow(date, id, 'cogs', 'store', null, null, u.id, doc.cost, doc.units, false);
      itemFigures(doc, date, 1);
    }
    /* a shortage is a cost of that store; an excess is the same line, negative */
    if (doc.shortExcess !== 0) plRow(date, id, 'expense', null, null, M.shortExcessCategoryId || 'cash_short', u.id, -doc.shortExcess, 0, false);
    if (doc.lines.length) gstRows(date, id, 'output', doc.lines, 1);
    audit('post', doc, warnedNote(doc, w, ''), null, doc.status);
    if (!wo) return done(doc, w);
    wo.sourceDocId = id;
    commitWO(wo);
    doc.woId = wo.id;
    return { ok: true, doc: doc, docs: [doc, wo], warnings: w };
  }

  /* ------------------------------------------------------------------ DEP */

  function buildDep(p) {
    var date = needDate(p.date, 'date');
    var acc = M.accountById[p.fromAccount];
    if (!acc || acc.kind !== 'cash') refuse('invalid_input', 'Choose the cash the deposit is taken from', 'fromAccount');
    var amount = needPaise(p.amount, 'Enter the amount deposited', 'amount');
    var bal = book.cash.balance[acc.id] || 0;
    if (amount > bal) refuse('cash_short', acc.name + ' has ' + fmt.inr2(bal) + '; ' + fmt.inr2(amount) + ' cannot be deposited', 'amount');
    var doc = newDoc('DEP', date, 'POSTED', p.note);
    doc.fromAccount = acc.id; doc.amount = amount; doc.slipRef = p.slipRef ? String(p.slipRef) : '';
    return doc;
  }

  function postDep(p) {
    var doc = buildDep(p);
    if (op.dry) return dry(doc);
    commitDoc(doc);
    rowsBegin(doc);
    cashRow(doc.date, doc.id, doc.fromAccount, -doc.amount, 'deposit', false);
    cashRow(doc.date, doc.id, BANK, doc.amount, 'deposit', false);
    audit('post', doc, '', null, doc.status);
    return done(doc);
  }

  /* ------------------------------------------------------------ ADJ and WO */

  /** A stock location a count or a write-off may be raised for: never goods in transit. */
  function needStockLoc(id) {
    var loc = M.locationById[id];
    if (!loc || loc.kind === 'transit') refuse('invalid_input', 'Choose a stock location', 'locId');
    return loc;
  }

  /** Materials and packing live in the raw store, finished goods everywhere else; finished goods move by batch. */
  function needStockLine(l, i, loc) {
    var it = needItem(l.itemId, i);
    if ((loc.kind === 'rm') === (it.kind === 'fg')) refuse('invalid_input', it.name + ' is not kept in ' + loc.name, lineField(i, 'itemId'));
    if (it.kind === 'fg') {
      /* a batch id is text: an array of one id would be found by the lookup and then stored as it came */
      var b = typeof l.batchId === 'string' ? book.batches[l.batchId] : null;
      if (!b || b.itemId !== it.id) refuse('invalid_input', it.name + ': choose the batch', lineField(i, 'batchId'));
    }
    return it;
  }

  /** The PENDING write-off that holds a quantity of this item (of this batch, for finished goods) at a place. */
  function pendingWoOn(locId, itemId, batchId) {
    for (var id in book.pending) {
      if (!has.call(book.pending, id)) continue;
      var d = book.pending[id];
      if (d.type !== 'WO' || d.locId !== locId) continue;
      for (var i = 0; i < d.lines.length; i++) if (d.lines[i].itemId === itemId && d.lines[i].batchId === (batchId || null)) return d.id;
    }
    return null;
  }

  /**
   * A count may not take off what a PENDING write-off holds: the write-off could then never be approved.
   * Tested when the count is approved - and when the Owner raises it, because that is the same operation.
   */
  function countAgainstHeld(locId, l, have, field) {
    var held = reservedOf(locId, l.itemId, l.batchId);
    if (!(held > 0) || q3(have - held + l.diff) >= 0) return;
    var it = itemOf(l.itemId), wo = pendingWoOn(locId, l.itemId, l.batchId);
    refuse('stock_short', it.name + (l.batchId ? ', batch ' + l.batchId : '') + ': the count takes off ' + qtyText(-l.diff, it) + ', but ' + qtyText(held, it) + ' of the ' + qtyText(have, it) + ' at ' + locName(locId) +
      ' is held by a write-off that waits for approval. Approve or reject ' + wo + ' first', field, wo);
  }

  function hasStockLine(lines, itemId, batchId) {
    for (var i = 0; i < lines.length; i++) if (lines[i].itemId === itemId && lines[i].batchId === batchId) return true;
    return false;
  }

  function buildAdj(p) {
    var date = needDate(p.date, 'date');
    var loc = needStockLoc(p.locId);
    var reason = needText(p.reason, 'Give the reason for the stock count', 'reason');
    var src = needLines(p.lines, 'Enter the counted quantity for at least one item');
    var lines = [], value = 0, i;
    for (i = 0; i < src.length; i++) {
      var it = needStockLine(src[i], i, loc), batchId = it.kind === 'fg' ? src[i].batchId : null;
      if (hasStockLine(lines, it.id, batchId)) refuse('invalid_input', it.name + ' is counted twice; put it on one line', lineField(i, 'itemId'));
      var counted = needQty(src[i].countedQty, it, lineField(i, 'countedQty'), true);
      var system = onHand(loc.id, it.id, batchId), diff = q3(counted - system);
      var rate = it.kind === 'fg' ? fgCost(it.id) : priceOf(it.id), v = money.amount(diff, rate);
      var line = { itemId: it.id, batchId: batchId, systemQty: system, countedQty: counted, diff: diff, rate: rate, value: v };
      if (op.owner && diff < 0) countAgainstHeld(loc.id, line, system, lineField(i, 'countedQty'));
      if (!op.seed) countWarning(it, line, lineField(i, 'countedQty'));
      lines.push(line);
      value += v;
    }
    var doc = newDoc('ADJ', date, 'PENDING', p.note);
    doc.locId = loc.id; doc.reason = reason; doc.lines = lines; doc.value = value;
    return doc;
  }

  /** A counted quantity far from the books, either way: a slip of a digit or a wrong unit. A difference worth little is let through. */
  function countWarning(it, l, field) {
    var pct = warnAt('countAwayPct'), least = warnAt('countMinValue');
    if (pct === null || milli(Math.abs(l.diff)) * 100 <= pct * milli(l.systemQty)) return;
    if (least !== null && Math.abs(l.value) < least) return;
    warn('count_far', it.name + (l.batchId ? ', batch ' + l.batchId : '') + ': ' + qtyText(l.countedQty, it) + ' counted against ' + qtyText(l.systemQty, it) +
      ' in the books, more than ' + pct + '% away', field);
  }

  function postAdj(p) {
    var doc = buildAdj(p), w = takeWarnings();
    if (op.dry) return dry(doc, w);
    commitDoc(doc);
    audit('post', doc, warnedNote(doc, w, ''), null, doc.status);
    hold(doc);
    if (op.owner) applyApproval(doc);
    return done(doc, w);
  }

  function adjRows(doc) {
    var unitId = M.locationById[doc.locId].unitId;
    rowsBegin(doc);
    for (var i = 0; i < doc.lines.length; i++) {
      var l = doc.lines[i];
      if (l.diff === 0) continue;
      move(doc.date, doc.id, doc.locId, l.itemId, l.batchId, l.diff, 'adjustment', false);
      if (l.value !== 0) plRow(doc.date, doc.id, 'countDiff', null, l.itemId, null, unitId, -l.value, l.batchId ? l.diff : 0, false);
    }
    doc.status = 'POSTED';
  }

  var WO_REASONS = ['expired', 'damaged', 'other'];

  function buildWO(p) {
    var date = needDate(p.date, 'date');
    var loc = needStockLoc(p.locId);
    if (WO_REASONS.indexOf(p.reason) === -1) refuse('invalid_input', 'Say why the stock is written off: expired, damaged or other', 'reason');
    var src = needLines(p.lines, 'Add at least one item to the write-off');
    var lines = [], value = 0, i;
    for (i = 0; i < src.length; i++) {
      var it = needStockLine(src[i], i, loc), batchId = it.kind === 'fg' ? src[i].batchId : null;
      if (hasStockLine(lines, it.id, batchId)) refuse('invalid_input', it.name + ' is on the write-off twice; put it on one line', lineField(i, 'itemId'));
      var qty = needQty(src[i].qty, it, lineField(i, 'qty'));
      var free = q3(onHand(loc.id, it.id, batchId) - reservedOf(loc.id, it.id, batchId));
      if (qty > free) refuse('stock_short', it.name + (batchId ? ', batch ' + batchId : '') + ': ' + qtyText(qty, it) + ' to write off, ' + qtyText(free < 0 ? 0 : free, it) + ' available at ' + loc.name, lineField(i, 'qty'));
      var rate = it.kind === 'fg' ? fgCost(it.id) : priceOf(it.id), v = money.amount(qty, rate);
      lines.push({ itemId: it.id, batchId: batchId, qty: qty, rate: rate, value: v });
      value += v;
    }
    var doc = newDoc('WO', date, 'PENDING', p.note);
    doc.locId = loc.id; doc.reason = p.reason; doc.sourceDocId = p.sourceDocId || null; doc.lines = lines; doc.value = value;
    return doc;
  }

  /** While it waits, a write-off holds its quantities back from every other document. */
  function commitWO(doc) {
    commitDoc(doc);
    for (var i = 0; i < doc.lines.length; i++) reserve(doc.locId, doc.lines[i].itemId, doc.lines[i].batchId, doc.lines[i].qty);
    audit('post', doc, '', null, doc.status);
    hold(doc);
    if (op.owner) applyApproval(doc);
  }

  function postWO(p) {
    var doc = buildWO(p);
    if (op.dry) return dry(doc);
    commitWO(doc);
    return done(doc);
  }

  function releaseWO(doc) {
    for (var i = 0; i < doc.lines.length; i++) reserve(doc.locId, doc.lines[i].itemId, doc.lines[i].batchId, -doc.lines[i].qty);
  }

  function woRows(doc) {
    var unitId = M.locationById[doc.locId].unitId;
    rowsBegin(doc);
    releaseWO(doc);
    for (var i = 0; i < doc.lines.length; i++) {
      var l = doc.lines[i];
      move(doc.date, doc.id, doc.locId, l.itemId, l.batchId, -l.qty, 'writeoff', false);
      plRow(doc.date, doc.id, 'writeoff', null, l.itemId, null, unitId, l.value, l.batchId ? l.qty : 0, false);
    }
    doc.status = 'POSTED';
  }

  /* ------------------------------------------------------------------ EXP */

  /** One line per unit: the headcount and total salary of the employees on the rolls on `date`. */
  function salaryLines(date) {
    var byUnit = {}, lines = [], i;
    for (i = 0; i < M.employees.length; i++) {
      var e = M.employees[i];
      if (!e.doj || e.doj > date || (e.dol && e.dol < date)) continue;
      var l = byUnit[e.unitId];
      if (!l) l = byUnit[e.unitId] = { unitId: e.unitId, headcount: 0, amount: 0 };
      l.headcount += 1;
      l.amount += e.salary || 0;
    }
    for (i = 0; i < M.units.length; i++) if (byUnit[M.units[i].id]) lines.push(byUnit[M.units[i].id]);
    return lines;
  }

  function needMonth(mk) {
    if (typeof mk !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(mk)) refuse('invalid_input', 'Choose the month of the salary bill', 'monthKey');
    return mk;
  }

  function buildSalary(p) {
    var mk = needMonth(p.monthKey), date = D.monthEnd(mk + '-01');
    if (p.date && p.date !== date) refuse('invalid_input', 'The salary bill is dated the last day of its month, ' + dayText(date), 'date');
    var dup = book.index.salary[mk];
    if (dup) refuse('duplicate', 'The salary bill for ' + D.monthLabel(mk, true) + ' is already raised as ' + dup, 'monthKey', dup);
    var staff = M.vendorById[M.staffVendorId];
    if (!staff) refuse('invalid_input', 'There is no "Staff salaries" vendor to raise the salary bill to', null);
    var lines = salaryLines(date), amount = 0, i;
    if (!lines.length) refuse('invalid_input', 'Nobody was on the rolls on ' + dayText(date), 'monthKey');
    for (i = 0; i < lines.length; i++) amount += lines[i].amount;
    var doc = newDoc('EXP', date, 'PENDING', p.note);
    doc.kind = 'salary'; doc.payeeType = 'vendor'; doc.payeeId = staff.id;
    doc.categoryId = M.salaryCategoryId; doc.unitId = null; doc.billRef = p.billRef ? String(p.billRef) : '';
    doc.monthKey = mk; doc.lines = lines; doc.amount = amount; doc.gstRate = 0; doc.cgst = 0; doc.sgst = 0; doc.gst = 0;
    doc.total = amount; doc.dueDate = date; doc.paid = 0;
    return doc;
  }

  function buildExp(p) {
    if (p.kind === 'salary') return buildSalary(p);
    if (p.kind !== 'claim' && p.kind !== 'bill') refuse('invalid_input', 'Choose the kind of expense: a claim or a bill', 'kind');
    var claim = p.kind === 'claim';
    var date = needDate(p.date, 'date');
    var cat = M.categoryById[p.categoryId];
    if (!cat || cat.active === false) refuse('invalid_input', 'Choose an expense category', 'categoryId');
    if (cat.mode !== 'both' && cat.mode !== p.kind) refuse('invalid_input', cat.name + ' is not a category for ' + (claim ? 'claims' : 'expense bills'), 'categoryId');
    var u = M.unitById[p.unitId];
    if (!u || u.active === false) refuse('invalid_input', 'Choose the location the expense is for', 'unitId');
    var amount = needPaise(p.amount, 'Enter the amount of the expense', 'amount');
    var payeeId, gstRate = 0, due = date;
    if (claim) {
      var user = M.userById[op.userId], emp = user ? M.employeeById[user.employeeId] : null;
      /* a seeded store claim is payable to that store's own manager (docs/CONFIG.md, choice 24); a user's claim never names its payee */
      if (op.seed && p.payeeId && M.employeeById[p.payeeId]) emp = M.employeeById[p.payeeId];
      if (!emp) refuse('invalid_input', 'A claim is raised by someone who is in the employee directory', null);
      payeeId = emp.id;
    } else {
      var v = M.vendorById[p.payeeId];
      if (!v || v.kind === 'staff') refuse('invalid_input', 'Choose the vendor who sent the bill', 'payeeId');
      if (v.active === false) refuse('invalid_input', v.name + ' is not an active vendor', 'payeeId');
      payeeId = v.id;
      gstRate = p.gstRate === undefined || p.gstRate === null || p.gstRate === '' ? 0 : +p.gstRate;
      if (!(gstRate >= 0) || !isFinite(gstRate)) refuse('invalid_input', 'Enter the GST rate on the bill', 'gstRate');
      due = addDays(date, v.termsDays || 0);
    }
    if (claim && !op.seed) {
      var top = warnAt('claimAbove');
      if (top !== null && amount > top) warn('claim_high', 'A claim of ' + fmt.inr2(amount) + ' is well above what a claim normally is, ' + fmt.inr2(top) + ' or less', 'amount');
    }
    var tax = Math.round(amount * gstRate / 200);
    var doc = newDoc('EXP', date, 'PENDING', p.note);
    doc.kind = p.kind; doc.payeeType = claim ? 'employee' : 'vendor'; doc.payeeId = payeeId;
    doc.categoryId = cat.id; doc.unitId = u.id; doc.billRef = p.billRef ? String(p.billRef) : '';
    doc.monthKey = null; doc.lines = []; doc.amount = amount; doc.gstRate = gstRate; doc.cgst = tax; doc.sgst = tax; doc.gst = tax + tax;
    doc.total = amount + tax + tax; doc.dueDate = due; doc.paid = 0;
    return doc;
  }

  function postExp(p) {
    var doc = buildExp(p), w = takeWarnings();
    if (op.dry) return dry(doc, w);
    commitDoc(doc);
    if (doc.kind === 'salary') book.index.salary[doc.monthKey] = doc.id;
    audit('post', doc, warnedNote(doc, w, ''), null, doc.status);
    hold(doc);
    if (op.owner) applyApproval(doc);
    return done(doc, w);
  }

  function expRows(doc) {
    rowsBegin(doc);
    doc.status = 'APPROVED';
    apRow(doc.date, doc.id, doc.payeeType, doc.payeeId, doc.total, 'expense', false);
    if (doc.kind === 'salary') {
      for (var i = 0; i < doc.lines.length; i++) plRow(doc.date, doc.id, 'expense', null, null, doc.categoryId, doc.lines[i].unitId, doc.lines[i].amount, 0, false);
    } else {
      plRow(doc.date, doc.id, 'expense', null, null, doc.categoryId, doc.unitId, doc.amount, 0, false);
    }
    /*
     * An input GST entry only for an expense that carries GST. A bill with none (diesel, piped gas, electricity,
     * rent from an unregistered landlord) is outside GST, not a Nil-rated purchase: the Nil-rated input line of
     * the GST summary holds Nil-rated stock purchases (vendor bills) only.
     */
    if (doc.gst > 0) gstRow(doc.date, doc.id, 'input', doc.gstRate, doc.amount, doc.cgst, doc.sgst, false);
    syncPayable(doc);
  }

  /* ------------------------------------------------------ opening entries */

  function seedOnly(what) {
    if (!op.seed) refuse('invalid_input', what + ' is part of the opening entries and cannot be added', null);
  }

  function buildOpenStock(p) {
    seedOnly('Opening stock');
    var date = needDate(p.date, 'date');
    var src = needLines(p.lines, 'Add the opening stock lines');
    var lines = [], i;
    for (i = 0; i < src.length; i++) {
      var l = src[i], loc = M.locationById[l.locId], it = needItem(l.itemId, i);
      if (!loc) refuse('invalid_input', 'Line ' + (i + 1) + ': choose a location', lineField(i, 'locId'));
      var qty = needQty(l.qty, it, lineField(i, 'qty'));
      if (it.kind === 'fg') {
        var mfg = needDate(l.mfgDate, lineField(i, 'mfgDate'), 'the manufacturing date');
        var best = l.bestBefore ? needDate(l.bestBefore, lineField(i, 'bestBefore'), 'the best-before date') : addDays(mfg, it.shelfLifeDays || 0);
        var batchId = l.batchId || 'B-' + ymd(mfg) + '-' + (it.code || it.id);
        var b = book.batches[batchId];
        if (b && (b.itemId !== it.id || b.mfgDate !== mfg || b.bestBefore !== best)) refuse('duplicate', 'Batch ' + batchId + ' already exists with other dates', lineField(i, 'batchId'));
        lines.push({ locId: loc.id, itemId: it.id, batchId: batchId, mfgDate: mfg, bestBefore: best, qty: qty, rate: null });
      } else {
        lines.push({ locId: loc.id, itemId: it.id, batchId: null, mfgDate: null, bestBefore: null, qty: qty, rate: needRate(l.rate, it, lineField(i, 'rate')) });
      }
    }
    var doc = newDoc('OPENSTOCK', date, 'POSTED', p.note);
    doc.lines = lines;
    return doc;
  }

  function postOpenStock(p) {
    var doc = buildOpenStock(p);
    if (op.dry) return dry(doc);
    commitDoc(doc);
    rowsBegin(doc);
    for (var i = 0; i < doc.lines.length; i++) {
      var l = doc.lines[i];
      if (l.batchId) {
        var b = book.batches[l.batchId];
        if (b) b.qty += l.qty; else addBatch(l.batchId, l.itemId, l.mfgDate, l.bestBefore, doc.id, l.qty);
      } else {
        setPrice(l.itemId, l.rate, doc.date, doc.id); /* the opening rate counts as the first purchase price */
      }
      move(doc.date, doc.id, l.locId, l.itemId, l.batchId, l.qty, 'opening', false);
    }
    audit('post', doc, 'opening balance', null, doc.status);
    return done(doc);
  }

  function buildOpenCash(p) {
    seedOnly('Opening cash');
    var date = needDate(p.date, 'date');
    var src = needLines(p.lines, 'Add the opening balance of each account');
    var lines = [], i;
    for (i = 0; i < src.length; i++) {
      var acc = M.accountById[src[i].accountId];
      if (!acc) refuse('invalid_input', 'Line ' + (i + 1) + ': choose an account', lineField(i, 'accountId'));
      lines.push({ accountId: acc.id, amount: needPaise(src[i].amount, acc.name + ': enter the opening balance', lineField(i, 'amount'), true) });
    }
    var doc = newDoc('OPENCASH', date, 'POSTED', p.note);
    doc.lines = lines;
    return doc;
  }

  function postOpenCash(p) {
    var doc = buildOpenCash(p);
    if (op.dry) return dry(doc);
    commitDoc(doc);
    rowsBegin(doc);
    for (var i = 0; i < doc.lines.length; i++) if (doc.lines[i].amount !== 0) cashRow(doc.date, doc.id, doc.lines[i].accountId, doc.lines[i].amount, 'opening', false);
    audit('post', doc, 'opening balance', null, doc.status);
    return done(doc);
  }

  /* ================================================================ actions */

  /* ------------------------------------------------- approve and reject */

  function needWaiting(id) {
    var doc = needDoc(id, null, null);
    if (doc.status !== 'PENDING' && doc.status !== 'HELD') refuse('wrong_state', doc.id + ' is ' + word(doc.status) + '; it is not waiting for approval', null, doc.id);
    return doc;
  }

  /** Stock is tested when the rows are written: an approval that would take a quantity below zero is refused. */
  function approvalCheck(doc) {
    var i, l, it, have;
    if (doc.type === 'ADJ') {
      for (i = 0; i < doc.lines.length; i++) {
        l = doc.lines[i];
        if (l.diff >= 0) continue;
        have = onHand(doc.locId, l.itemId, l.batchId);
        if (q3(have + l.diff) < 0) {
          it = itemOf(l.itemId);
          refuse('stock_short', it.name + (l.batchId ? ', batch ' + l.batchId : '') + ': the count takes off ' + qtyText(-l.diff, it) + ' but only ' + qtyText(have, it) + ' is at ' + locName(doc.locId) + ' now', null, doc.id);
        }
        countAgainstHeld(doc.locId, l, have, null);
      }
    } else if (doc.type === 'WO') {
      for (i = 0; i < doc.lines.length; i++) {
        l = doc.lines[i];
        have = onHand(doc.locId, l.itemId, l.batchId);
        if (q3(have - l.qty) < 0) {
          it = itemOf(l.itemId);
          refuse('stock_short', it.name + (l.batchId ? ', batch ' + l.batchId : '') + ': ' + qtyText(l.qty, it) + ' to write off but only ' + qtyText(have, it) + ' is at ' + locName(doc.locId) + ' now', null, doc.id);
        }
      }
    }
  }

  /** Write the rows of a document that was computed when it was entered. Every row carries the document's date. */
  function applyApproval(doc) {
    var from = doc.status, self = doc.createdBy === op.userId;
    doc.approval.state = 'approved';
    doc.approval.by = op.userId;
    doc.approval.at = op.at || (op.date || doc.date) + 'T09:00';
    doc.approval.self = self;
    delete book.pending[doc.id];
    switch (doc.type) {
      case 'PO': doc.status = 'APPROVED'; break;
      case 'VBILL': billRows(doc); break;
      case 'CN': cnRows(doc); break;
      case 'ADJ': adjRows(doc); break;
      case 'WO': woRows(doc); break;
      case 'EXP': expRows(doc); break;
    }
    audit('approve', doc, self ? 'own document' : '', from, doc.status);
  }

  function approve(id) {
    var doc = needWaiting(id);
    approvalCheck(doc);
    if (op.dry) return dry(doc);
    applyApproval(doc);
    return done(doc);
  }

  function reject(id, reason) {
    var doc = needWaiting(id);
    reason = needText(reason, 'Give the reason for rejecting ' + doc.id, 'reason');
    if (op.dry) return dry(doc);
    var from = doc.status;
    doc.status = 'REJECTED';
    doc.approval.state = 'rejected';
    doc.approval.by = op.userId;
    doc.approval.at = op.at || (op.date || doc.date) + 'T09:00';
    doc.approval.reason = reason;
    doc.approval.self = doc.createdBy === op.userId;
    delete book.pending[doc.id];
    if (doc.type === 'VBILL') unlinkBill(doc);
    else if (doc.type === 'WO') releaseWO(doc);
    else if (doc.type === 'CN') dayAdd(book.index.returned, doc.customerId, doc.date, -doc.taxable);
    else if (doc.type === 'EXP' && doc.kind === 'salary') delete book.index.salary[doc.monthKey];
    audit('reject', doc, reason, from, doc.status);
    return done(doc);
  }

  /* --------------------------------------------------------------- cancel */

  /**
   * The document that must be cancelled before a production entry can be: the uncancelled one that last took
   * units of its batch out of the finished goods store (an invoice, a transfer, a write-off, a count). The
   * search runs back from the end of the movement ledger and stops at the entry's own rows.
   */
  function lastTaker(doc) {
    var e = postingOf(doc), from = e === -1 ? 0 : markAt(e + 1, 0);
    for (var i = book.moves.length - 1; i >= from; i--) {
      var r = book.moves[i];
      if (r.batchId !== doc.batchId || r.locId !== FG || r.qty >= 0 || r.reversal) continue;
      var d = book.docs[r.docId];
      if (d && d.status !== 'CANCELLED') return d.id;
    }
    return null;
  }

  /** The cancel table of SPEC 5.3: the states a document can be cancelled in, and what must go first. */
  function cancelCheck(doc) {
    var st = doc.status, id = doc.id, wo, left, taker;
    if (doc.type === 'CXL') refuse('wrong_state', 'A cancellation cannot itself be cancelled', null, id);
    if (doc.type === 'OPENSTOCK' || doc.type === 'OPENCASH' || doc.opening) refuse('wrong_state', 'Opening entries cannot be cancelled', null, id);
    if (st === 'CANCELLED') refuse('wrong_state', id + ' is already cancelled', null, doc.cancelled ? doc.cancelled.docId : id);
    if (st === 'REJECTED') refuse('wrong_state', id + ' was rejected; a rejected document cannot be cancelled', null, id);
    switch (doc.type) {
      case 'PO':
        if (doc.grnIds.length) refuse('has_dependants', id + ' has goods received against it. Cancel ' + doc.grnIds[doc.grnIds.length - 1] + ' first', null, doc.grnIds[doc.grnIds.length - 1]);
        break;
      case 'GRN':
        if (doc.billId) refuse('has_dependants', id + ' is billed on ' + doc.billId + '. Cancel that bill first', null, doc.billId);
        break;
      case 'VBILL':
        if (st === 'POSTED' && doc.paid > 0) refuse('has_dependants', fmt.inr2(doc.paid) + ' is already paid against ' + id + '. Cancel ' + lastSettler(doc) + ' first', null, lastSettler(doc));
        break;
      case 'EXP':
        if (doc.paid > 0) refuse('has_dependants', fmt.inr2(doc.paid) + ' is already paid against ' + id + '. Cancel ' + lastSettler(doc) + ' first', null, lastSettler(doc));
        break;
      case 'SO':
        if (st !== 'OPEN') refuse('has_dependants', id + ' is invoiced on ' + doc.invId + '. Cancel that invoice first', null, doc.invId);
        break;
      case 'INV':
        if (doc.received > 0 || doc.credited > 0) refuse('has_dependants', id + ' has a receipt or a credit note against it. Cancel ' + lastSettler(doc) + ' first', null, lastSettler(doc));
        break;
      case 'PROD':
        wo = reservedOf(FG, doc.itemId, doc.batchId) > 0 ? pendingWoOn(FG, doc.itemId, doc.batchId) : null;
        if (wo) refuse('has_dependants', 'Batch ' + doc.batchId + ' has a write-off waiting on it. Cancel or reject ' + wo + ' first', null, wo);
        /* the whole batch must still be in the finished goods store; if not, name what took it */
        left = onHand(FG, doc.itemId, doc.batchId);
        taker = left < doc.goodUnits ? lastTaker(doc) : null;
        if (taker) refuse('has_dependants', 'Batch ' + doc.batchId + ' is no longer whole: ' + qtyText(left, itemOf(doc.itemId)) + ' of its ' + qtyText(doc.goodUnits, itemOf(doc.itemId)) + ' are in the finished goods store. Cancel ' + taker + ' first', null, taker);
        break;
      case 'XFER':
        if (st !== 'SENT') refuse('wrong_state', 'The store has confirmed ' + id + '; a confirmed transfer cannot be cancelled', null, id);
        break;
      case 'DAYEND':
        wo = doc.woId ? book.docs[doc.woId] : null;
        if (wo && wo.status === 'POSTED') refuse('has_dependants', 'The write-off of the expired units of ' + id + ' is approved. Cancel ' + wo.id + ' first', null, wo.id);
        break;
    }
  }

  /**
   * Stock is the one balance a cancellation is tested against: giving back what the document brought in must not
   * take any quantity below zero (a receipt whose goods were used, a count that added stock), nor below what a
   * PENDING write-off holds - that write-off is then named as what must go first.
   */
  function reversalStockCheck(doc, from, to) {
    var need = {}, keys = [], i, r, key;
    for (i = from; i < to; i++) {
      r = book.moves[i];
      key = r.locId + '|' + r.itemId + '|' + (r.batchId || '');
      if (need[key] === undefined) { need[key] = { row: r, qty: 0 }; keys.push(key); }
      need[key].qty = q3(need[key].qty + r.qty);
    }
    for (i = 0; i < keys.length; i++) {
      var n = need[keys[i]];
      if (n.qty <= 0) continue;
      var have = onHand(n.row.locId, n.row.itemId, n.row.batchId), it = itemOf(n.row.itemId);
      var what = it.name + (n.row.batchId ? ', batch ' + n.row.batchId : '') + ': ' + doc.id + ' brought in ' + qtyText(n.qty, it);
      if (q3(have - n.qty) < 0) {
        refuse('stock_short', what + ' and only ' + qtyText(have, it) + ' is still at ' + locName(n.row.locId) + ', ' + qtyText(q3(n.qty - have), it) + ' short', null, doc.id);
      }
      var held = reservedOf(n.row.locId, n.row.itemId, n.row.batchId);
      if (held > 0 && q3(have - held - n.qty) < 0) {
        var wo = pendingWoOn(n.row.locId, n.row.itemId, n.row.batchId);
        refuse('has_dependants', what + ', but ' + qtyText(held, it) + ' of the ' + qtyText(have, it) + ' at ' + locName(n.row.locId) + ' is held by a write-off that waits for approval. Cancel or reject ' + wo + ' first', null, wo);
      }
    }
  }

  /** Release what a cancelled receipt or credit note had settled: the invoices reopen, the credit is withdrawn. */
  function releaseAllocations(doc, field) {
    for (var i = 0; i < doc.allocations.length; i++) {
      var inv = book.docs[doc.allocations[i].docId];
      inv[field] -= doc.allocations[i].amount;
      syncOpen(inv);
    }
    return doc.onAccount > 0 ? withdrawCredit(doc.customerId, doc.onAccount) : [];
  }

  /** What a cancellation does besides reversing the rows (the "Also" column of the cancel table). */
  function cancelEffects(doc, was, cxl) {
    var i, d, list, at;
    delete book.pending[doc.id];
    switch (doc.type) {
      case 'GRN':
        var po = book.docs[doc.poId];
        for (i = 0; i < doc.lines.length; i++) {
          if (doc.lines[i].qty === 0) continue;
          var pl = poLine(po, doc.lines[i].itemId);
          pl.received = q3(pl.received - doc.lines[i].qty);
          dropPrice(doc.lines[i].itemId, doc.id);
        }
        at = po.grnIds.indexOf(doc.id);
        if (at !== -1) po.grnIds.splice(at, 1);
        if (po.status === 'PART_RECEIVED' || po.status === 'RECEIVED') po.status = poStatus(po);
        unbilledDrop(doc);
        break;
      case 'VBILL':
        unlinkBill(doc);
        syncPayable(doc);
        break;
      case 'EXP':
        if (doc.kind === 'salary' && book.index.salary[doc.monthKey] === doc.id) delete book.index.salary[doc.monthKey];
        syncPayable(doc);
        break;
      case 'PAY':
        for (i = 0; i < doc.allocations.length; i++) {
          d = book.docs[doc.allocations[i].docId];
          d.paid -= doc.allocations[i].amount;
          if (d.type === 'EXP' && d.status === 'PAID') d.status = 'APPROVED';
          syncPayable(d);
        }
        break;
      case 'INV':
        if (doc.creditApplied > 0) {
          addCredit(doc.customerId, doc.creditApplied);
          list = book.ar.creditUsed[doc.customerId];
          at = list ? list.indexOf(doc) : -1;
          if (at !== -1) list.splice(at, 1);
        }
        syncOpen(doc);
        dayAdd(book.index.supply, doc.customerId, doc.date, -doc.taxable);
        if (doc.sheetId) {
          list = book.index.sheet[doc.sheetId];
          at = list ? list.indexOf(doc) : -1;
          if (at !== -1) list.splice(at, 1);
        }
        if (doc.soId) { d = book.docs[doc.soId]; if (d.invId === doc.id) { d.status = 'OPEN'; d.invId = null; } }
        break;
      case 'RCPT':
        cxl.creditTakenBack = releaseAllocations(doc, 'received');
        break;
      case 'CN':
        dayAdd(book.index.returned, doc.customerId, doc.date, -doc.taxable);
        if (was === 'POSTED') cxl.creditTakenBack = releaseAllocations(doc, 'credited');
        break;
      case 'DAYEND':
        if (book.index.dayEnd[dayEndKey(doc.storeId, doc.date)] === doc.id) delete book.index.dayEnd[dayEndKey(doc.storeId, doc.date)];
        d = doc.woId ? book.docs[doc.woId] : null;
        if (d && d.status === 'PENDING') {
          /* the write-off it raised has nothing left to stand on: the same cancellation takes it */
          releaseWO(d);
          delete book.pending[d.id];
          d.status = 'CANCELLED';
          d.cancelled = { by: op.userId, at: cxl.createdAt, reason: cxl.reason, docId: cxl.id };
          audit('cancel', d, 'with ' + doc.id, 'PENDING', 'CANCELLED');
        }
        break;
      case 'WO':
        if (was === 'PENDING') releaseWO(doc);
        break;
    }
  }

  /** The stock test of a cancellation, on the rows the document wrote. */
  function cancelStock(doc) {
    var e = postingOf(doc);
    if (e !== -1) reversalStockCheck(doc, markAt(e, 0), markAt(e + 1, 0));
  }

  function cancel(id, reason) {
    var doc = needDoc(id, null, null);
    cancelCheck(doc);
    reason = needText(reason, 'Give the reason for cancelling ' + doc.id, 'reason');
    cancelStock(doc);
    if (op.dry) return dry(doc);
    return { ok: true, doc: cancelCommit(doc, reason, null), target: doc, warnings: [] };
  }

  /**
   * The commit half of a cancellation: the CXL, the opposite of every row, the effects of the cancel table and
   * the audit entry. It cannot refuse: cancelCheck and cancelStock have passed. sheetId is set when the document
   * goes with its dispatch sheet. Returns the CXL.
   */
  function cancelCommit(doc, reason, sheetId) {
    var e = postingOf(doc), date = op.date || doc.date, was = doc.status, i, r;
    var cxl = newDoc('CXL', date, 'POSTED', '');
    cxl.targetId = doc.id; cxl.targetType = doc.type; cxl.reason = reason; cxl.creditTakenBack = [];
    if (sheetId) cxl.sheetId = sheetId;
    commitDoc(cxl);

    /* the equal and opposite of every row the target wrote, from the values it carried; nothing is recomputed */
    if (e !== -1) {
      var cid = cxl.id, to = [0, 0, 0, 0, 0, 0];
      for (i = 0; i < 6; i++) to[i] = markAt(e + 1, i); /* read before the cancellation opens its own posting */
      var m = markAt(e, 0), a = markAt(e, 1), p = markAt(e, 2), c = markAt(e, 3), l = markAt(e, 4), g = markAt(e, 5);
      rowsBegin(cxl);
      for (i = m; i < to[0]; i++) { r = book.moves[i]; move(date, cid, r.locId, r.itemId, r.batchId, neg(r.qty), r.kind, true); }
      for (i = a; i < to[1]; i++) { r = book.ar.entries[i]; arRow(date, cid, r.customerId, neg(r.amount), r.kind, true); }
      for (i = p; i < to[2]; i++) { r = book.ap.entries[i]; apRow(date, cid, r.payeeType, r.payeeId, neg(r.amount), r.kind, true); }
      for (i = c; i < to[3]; i++) { r = book.cash.entries[i]; cashRow(date, cid, r.accountId, neg(r.amount), r.kind, true); }
      for (i = l; i < to[4]; i++) { r = book.pnl[i]; plRow(date, cid, r.line, r.channel, r.itemId, r.categoryId, r.unitId, neg(r.amount), neg(r.qty), true); }
      for (i = g; i < to[5]; i++) { r = book.gst[i]; gstRow(date, cid, r.dir, r.gstRate, neg(r.taxable), neg(r.cgst), neg(r.sgst), true); }
    }
    if (was === 'POSTED' && !doc.opening) itemFigures(doc, date, -1);
    doc.status = 'CANCELLED';
    doc.cancelled = { by: op.userId, at: cxl.createdAt, reason: reason, docId: cxl.id };
    cancelEffects(doc, was, cxl);
    audit('cancel', doc, reason, was, 'CANCELLED');
    return cxl;
  }

  /* ---------------------------------------------- cancel a dispatch sheet */

  /**
   * One action for a posted sheet: every uncancelled invoice that carries the sheet id is cancelled, in the order
   * the sheet posted them, each by a cancellation of its own and all with the one reason. All or nothing: every
   * invoice is tested before the first is touched, and one that cannot be cancelled refuses the sheet, naming
   * that invoice and the document that rests on it. Afterwards no invoice carries the id: the sheet is to post again.
   */
  function cancelDispatch(args) {
    args = args || {};
    var sheetId = typeof args.sheetId === 'string' ? args.sheetId : '';
    if (!sheetId) refuse('invalid_input', 'Choose the dispatch sheet to cancel', 'sheetId');
    var live = has.call(book.index.sheet, sheetId) ? book.index.sheet[sheetId] : null; /* an own key only: 'constructor' is no sheet */
    if (!live || !live.length) refuse('not_found', 'The dispatch sheet ' + sheetId + ' is not posted, so there is nothing to cancel', 'sheetId');
    var list = live.slice(), docs = [], i; /* a copy: each cancellation takes its invoice off the live list */
    /* the ids were fixed for the invoices the sheet had when the entry was made: a sheet that has others now is not the same sheet */
    if (op.ids && op.ids.length !== list.length) refuse('wrong_state', 'The dispatch sheet ' + sheetId + ' no longer has the invoices it had when this was entered', 'sheetId');
    function test(fn, inv) {
      try { fn(inv); }
      catch (err) {
        if (err instanceof Refusal) err.error.message = 'The sheet cannot be cancelled: ' + err.error.message;
        throw err;
      }
    }
    for (i = 0; i < list.length; i++) test(cancelCheck, list[i]);
    var reason = needText(args.reason, 'Give the reason for cancelling the sheet', 'reason');
    for (i = 0; i < list.length; i++) test(cancelStock, list[i]);
    if (op.dry) return { ok: true, preview: true, sheetId: sheetId, docs: [], targets: list, warnings: [] };
    for (i = 0; i < list.length; i++) docs.push(cancelCommit(list[i], reason, sheetId));
    return { ok: true, sheetId: sheetId, doc: docs[0], docs: docs, targets: list, warnings: [] };
  }

  /* ===================================================== sheets and bills */

  /** The prefilled dispatch sheet of a route: each active outlet's standing order, unchanged, and the stock available. */
  function dispatchSheet(routeId, date) {
    var route = M && M.routeById[routeId];
    if (!route) return { ok: false, error: { code: 'invalid_input', message: 'Choose a route', field: 'routeId', docId: null } };
    var sheetId = sheetIdOf(route.id, date), posted = book.index.sheet[sheetId] || [], totals = {}, outlets = [], i, j;
    for (i = 0; i < route.stops.length; i++) {
      var c = M.customerById[route.stops[i]];
      if (!c || c.active === false) continue;
      var lines = [], st = c.standing || {};
      for (j = 0; j < M.items.length; j++) {
        var it = M.items[j], q = st[it.id];
        if (it.kind !== 'fg' || it.active === false || !(q > 0)) continue;
        lines.push({ itemId: it.id, qty: q });
        totals[it.id] = (totals[it.id] || 0) + q;
      }
      outlets.push({ customerId: c.id, name: c.name, terms: c.terms, lines: lines });
    }
    var items = [];
    for (j = 0; j < M.items.length; j++) {
      var fg = M.items[j];
      if (fg.kind !== 'fg' || fg.active === false) continue;
      var free = available(FG, fg.id, date), want = totals[fg.id] || 0;
      items.push({ itemId: fg.id, total: want, available: free, short: want > free });
    }
    return {
      ok: true, sheetId: sheetId, routeId: route.id, date: date,
      posted: posted.length > 0, invoiceIds: posted.map(function (d) { return d.id; }),
      items: items, outlets: outlets
    };
  }

  /**
   * Unexpired quantity of an item at a place (a store, or its transit location). Units on a PENDING write-off
   * count: they are still there, and come back to the shelf if the Owner rejects the write-off.
   */
  function unexpiredAt(locId, itemId, date) {
    var byItem = book.lots[locId], lots = byItem ? byItem[itemId] : null, sum = 0;
    if (lots) for (var i = 0; i < lots.length; i++) if (lots[i].bestBefore >= date) sum += lots[i].qty;
    return sum;
  }

  /** The prefilled transfer to a store: standing quantity less what is unexpired at the store or on its way. */
  function transferSheet(storeId, date) {
    var u = M && M.unitById[storeId];
    if (!u || u.kind !== 'store') return { ok: false, error: { code: 'invalid_input', message: 'Choose a store', field: 'storeId', docId: null } };
    var lines = [], st = u.standing || {};
    for (var j = 0; j < M.items.length; j++) {
      var it = M.items[j], standing = st[it.id];
      if (it.kind !== 'fg' || it.active === false || !(standing > 0)) continue;
      var atStore = unexpiredAt(u.locId, it.id, date), inTransit = unexpiredAt(u.transitLocId, it.id, date);
      var qty = standing - atStore - inTransit;
      lines.push({ itemId: it.id, standing: standing, atStore: atStore, inTransit: inTransit, qty: qty > 0 ? qty : 0, available: available(FG, it.id, date) });
    }
    return { ok: true, storeId: u.id, date: date, lines: lines };
  }

  /**
   * The proposed salary bill of a month, from the directory as it stands. A month can be billed when its last
   * day is on or before the business date and not in a locked month, and no other bill for it stands.
   * It answers the persona in use, like preview: a line is a unit's salaries (one person's, where a unit has
   * one), so a role that may not see salaries gets a refusal. The seed posts with core.exp and never calls this.
   */
  function salaryBill(monthKey) {
    try {
      if (HB.session && !HB.session.canSeeSalaries()) refuse('role', 'The salary bill is shown to ' + HB.session.roleLabel('accounts') + ' and the Owner only', null);
      var mk = needMonth(monthKey), date = D.monthEnd(mk + '-01'), cal = HB.calendar;
      if (cal && cal.today && date > cal.today) refuse('future_date', D.monthLabel(mk, true) + ' is not over yet: its salary bill is raised on ' + dayText(date), 'monthKey');
      if (cal && cal.lockBefore && date < cal.lockBefore) refuse('locked_month', D.monthLabel(mk, true) + ' is a locked month', 'monthKey');
      var dup = book.index.salary[mk];
      if (dup) refuse('duplicate', 'The salary bill for ' + D.monthLabel(mk, true) + ' is already raised as ' + dup, 'monthKey', dup);
      var lines = salaryLines(date), amount = 0;
      for (var i = 0; i < lines.length; i++) amount += lines[i].amount;
      return {
        ok: true, kind: 'salary', monthKey: mk, date: date, payeeType: 'vendor', payeeId: M.staffVendorId,
        categoryId: M.salaryCategoryId, lines: lines, amount: amount, total: amount
      };
    } catch (e) {
      if (e instanceof Refusal) return { ok: false, error: e.error };
      throw e;
    }
  }

  /* ======================================================= master changes */
  /* A change is an operation like any other: validated, applied to HB.masters, kept with before and after. */

  var ENTITIES = {
    items: { list: 'items', by: 'itemById', prefix: 'itm', noun: 'item' },
    customers: { list: 'customers', by: 'customerById', prefix: 'cus', noun: 'customer' },
    vendors: { list: 'vendors', by: 'vendorById', prefix: 'ven', noun: 'vendor' },
    expenseCategories: { list: 'expenseCategories', by: 'categoryById', prefix: 'cat', noun: 'expense category' },
    employees: { list: 'employees', by: 'employeeById', prefix: 'emp', noun: 'employee' }
  };

  function newMasterId(entity) {
    var def = ENTITIES[entity];
    if (!def) return null;
    var n = M[def.list].length + 1, id;
    do { id = def.prefix + '_' + pad3(n++); } while (M[def.by][id]);
    return id;
  }

  function optPaise(v, message, field) { return needPaise(v === undefined || v === null || v === '' ? 0 : v, message, field, true); }

  function optWhole(v, message, field) {
    var n = v === undefined || v === null || v === '' ? 0 : +v;
    if (!isFinite(n) || n < 0 || n !== Math.floor(n)) refuse('invalid_input', message, field);
    return n;
  }

  function cleanStanding(standing, field) {
    var out = {}, k;
    if (!standing) return out;
    for (k in standing) {
      if (!has.call(standing, k)) continue;
      var it = M.itemById[k], q = +standing[k];
      if (!it || it.kind !== 'fg') refuse('invalid_input', k ? 'A standing quantity is for a finished product' : 'Choose the product for each standing quantity', field);
      if (!isFinite(q) || q < 0 || q !== Math.floor(q)) refuse('invalid_input', it.name + ': enter a whole number of units', field);
      if (q > MASTER_MAX.standing) refuse('invalid_input', it.name + ': a standing quantity cannot be above ' + fmt.num(MASTER_MAX.standing), field);
      if (q > 0) out[k] = q;
    }
    return out;
  }

  /* The most a master form takes. Above these a figure is a slip of the hand, and far above them paise stop being exact. */
  var MASTER_MAX = { price: 10000000, creditLimit: 100000000000, days: 365, shelfLifeDays: 3650, reorderLevel: 10000000, standing: 100000 };
  var GSTIN_FORMAT = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;

  function upTo(n, max, message, field) {
    if (n > max) refuse('invalid_input', message, field);
    return n;
  }

  /** A price of the price list: above zero, and within reason. */
  function needPrice(v, what, field, whole) {
    var n = whole ? needPaise(v, 'Enter the ' + what, field) : +v;
    if (v === null || v === undefined || v === '' || !isFinite(n) || n <= 0) refuse('invalid_input', 'Enter the ' + what, field);
    return upTo(n, MASTER_MAX.price, 'The ' + what + ' cannot be above ' + fmt.inrFull(MASTER_MAX.price), field);
  }

  /** A GSTIN is optional; one that is given has the 15 characters of a GSTIN. Whether it exists is not tested here. */
  function cleanGstin(v) {
    var s = v === null || v === undefined ? '' : String(v).trim().toUpperCase();
    if (s && !GSTIN_FORMAT.test(s)) refuse('invalid_input', 'A GSTIN has 15 characters, like 24ABCDE1234F1Z5. Leave it empty if there is none', 'gstin');
    return s;
  }

  /** One name, one record: two categories or two stores of the same name cannot be told apart on a form. */
  function needUniqueName(list, r, old, noun) {
    var key = r.name.toLowerCase();
    for (var i = 0; i < list.length; i++) {
      if (list[i] !== old && list[i].id !== r.id && String(list[i].name || '').trim().toLowerCase() === key) refuse('duplicate', 'There is already ' + noun + ' called ' + list[i].name, 'name');
    }
  }

  /** Has the item ever been in stock? Its unit is then part of every quantity posted, and stays. */
  function itemUsed(id) {
    if (book.prices[id] || book.batchesByItem[id]) return true;
    for (var loc in book.stock) if (has.call(book.stock, loc) && book.stock[loc][id] !== undefined) return true;
    return false;
  }

  var VALIDATE = {
    items: function (r, old) {
      r.name = needText(r.name, 'Enter the name of the item', 'name');
      needUniqueName(M.items, r, old, 'an item');
      if (['fg', 'rm', 'pk'].indexOf(r.kind) === -1) refuse('invalid_input', 'Choose the kind of item: finished product, material or packing', 'kind');
      if (old && old.kind !== r.kind) refuse('invalid_input', 'The kind of an item cannot be changed', 'kind');
      r.code = needText(r.code || r.id.toUpperCase(), 'Enter the item code', 'code');
      for (var i = 0; i < M.items.length; i++) if (M.items[i] !== old && String(M.items[i].code).toLowerCase() === r.code.toLowerCase()) refuse('duplicate', 'Code ' + r.code + ' is already used by ' + M.items[i].name, 'code');
      if (old && old.code !== r.code && book.batchesByItem[r.id]) refuse('invalid_input', 'The code of ' + old.name + ' is on its batch numbers and cannot be changed', 'code');
      r.unit = needText(r.unit, 'Enter the unit of the item', 'unit');
      if (old && old.unit !== r.unit && itemUsed(r.id)) refuse('invalid_input', 'The unit of ' + old.name + ' is on its stock and its posted documents and cannot be changed', 'unit');
      r.gstRate = +r.gstRate || 0;
      if (r.gstRate < 0 || r.gstRate > 28) refuse('invalid_input', 'Enter the GST rate, from 0 to 28', 'gstRate');
      r.reorderLevel = +r.reorderLevel || 0;
      if (r.reorderLevel < 0) refuse('invalid_input', 'The reorder level cannot be below zero', 'reorderLevel');
      upTo(r.reorderLevel, MASTER_MAX.reorderLevel, 'The reorder level cannot be above ' + fmt.num(MASTER_MAX.reorderLevel), 'reorderLevel');
      if (r.kind === 'fg') {
        r.shelfLifeDays = +r.shelfLifeDays;
        if (!(r.shelfLifeDays >= 1) || r.shelfLifeDays !== Math.floor(r.shelfLifeDays)) refuse('invalid_input', 'Enter the best-before period in whole days', 'shelfLifeDays');
        upTo(r.shelfLifeDays, MASTER_MAX.shelfLifeDays, 'The best-before period cannot be above ' + fmt.num(MASTER_MAX.shelfLifeDays) + ' days', 'shelfLifeDays');
        var pr = r.price || {};
        r.price = {
          mrp: needPrice(pr.mrp, 'MRP', 'price.mrp', true),
          retail: needPrice(pr.retail, 'retailer price', 'price.retail'),
          corporate: needPrice(pr.corporate, 'corporate price', 'price.corporate')
        };
      }
    },
    customers: function (r, old) {
      r.name = needText(r.name, 'Enter the name of the customer', 'name');
      needUniqueName(M.customers, r, old, 'a customer');
      if (r.channel !== 'retail' && r.channel !== 'corporate') refuse('invalid_input', 'Choose the channel: retail outlet or corporate', 'channel');
      if (old && old.channel !== r.channel) refuse('invalid_input', 'The channel of a customer cannot be changed', 'channel');
      if (['cash', 'weekly', 'credit'].indexOf(r.terms) === -1) refuse('invalid_input', 'Choose how the customer pays: cash, weekly or credit', 'terms');
      r.creditDays = upTo(optWhole(r.creditDays, 'Enter the credit days as a whole number', 'creditDays'), MASTER_MAX.days, 'The credit days cannot be above ' + MASTER_MAX.days, 'creditDays');
      r.creditLimit = upTo(optPaise(r.creditLimit, 'Enter the credit limit', 'creditLimit'), MASTER_MAX.creditLimit, 'The credit limit cannot be above ' + fmt.inrFull(MASTER_MAX.creditLimit), 'creditLimit');
      if (old ? r.gstin !== old.gstin : r.gstin) r.gstin = cleanGstin(r.gstin);
      if (r.channel === 'retail') {
        if (!M.routeById[r.routeId]) refuse('invalid_input', 'Choose the route of the outlet', 'routeId');
      } else {
        r.routeId = null;
      }
      r.standing = cleanStanding(r.standing, 'standing');
    },
    vendors: function (r, old) {
      r.name = needText(r.name, 'Enter the name of the vendor', 'name');
      needUniqueName(M.vendors, r, old, 'a vendor');
      if (old ? old.kind !== r.kind : (r.kind !== 'stock' && r.kind !== 'expense')) refuse('invalid_input', old ? 'The kind of a vendor cannot be changed' : 'Choose what the vendor supplies: materials and packing, or services', 'kind');
      r.termsDays = upTo(optWhole(r.termsDays, 'Enter the payment terms in whole days', 'termsDays'), MASTER_MAX.days, 'The payment terms cannot be above ' + MASTER_MAX.days + ' days', 'termsDays');
      if (old ? r.gstin !== old.gstin : r.gstin) r.gstin = cleanGstin(r.gstin);
    },
    expenseCategories: function (r, old) {
      r.name = needText(r.name, 'Enter the name of the category', 'name');
      needUniqueName(M.expenseCategories, r, old, 'an expense category');
      if (['claim', 'bill', 'both'].indexOf(r.mode) === -1) refuse('invalid_input', 'Choose what the category is for: claims, bills or both', 'mode');
    },
    employees: function (r) {
      r.name = needText(r.name, 'Enter the name of the employee', 'name');
      if (!M.unitById[r.unitId]) refuse('invalid_input', 'Choose the location of the employee', 'unitId');
      needDate(r.doj, 'doj', 'the date of joining');
      if (r.dol) { needDate(r.dol, 'dol', 'the date of leaving'); if (r.dol < r.doj) refuse('invalid_input', 'The date of leaving cannot be before the date of joining', 'dol'); }
      else r.dol = null;
      r.salary = optPaise(r.salary, 'Enter the monthly salary', 'salary');
    }
  };

  /** Do two master records hold the same values? Key order aside, an empty value reads like a missing one, and the reason for a change is not a value. */
  function sameRecord(a, b, top) {
    if (a === b) return true;
    var blankA = a === null || a === undefined || a === '', blankB = b === null || b === undefined || b === '';
    if (blankA || blankB) return blankA && blankB;
    if (typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a) && a.length !== b.length) return false;
    var k;
    for (k in a) if (has.call(a, k) && !(top && k === 'changeNote') && !sameRecord(a[k], has.call(b, k) ? b[k] : undefined)) return false;
    for (k in b) if (has.call(b, k) && !has.call(a, k) && !(top && k === 'changeNote') && !sameRecord(undefined, b[k])) return false;
    return true;
  }

  /** An edit that changes no value is refused: it would only write a history entry that says nothing. */
  function needChange(before, after) {
    if (sameRecord(before, after, true)) refuse('invalid_input', 'Nothing was changed', null);
  }

  function auditMaster(action, entity, id, before, after) {
    var row = {
      seq: ++book.seq, at: op.at || (op.date || HB.calendar.goLive) + 'T09:00', userId: op.userId, role: op.role, action: action,
      docId: id, type: entity, note: '', before: before, after: after
    };
    book.audit.push(row);
    M.changes.push(row);
  }

  /** Copy the fields of `next` onto the live record, so every index that points at it stays true. */
  function assign(live, next) {
    var k;
    for (k in live) if (has.call(live, k) && !has.call(next, k)) delete live[k];
    for (k in next) if (has.call(next, k)) live[k] = next[k];
  }

  function masterRecipe(record) {
    var it = M.itemById[record.itemId];
    if (!it || it.kind !== 'fg') refuse('invalid_input', 'Choose the product the recipe is for', 'itemId');
    var old = M.recipeByItem[it.id] || null, r = old ? clone(old) : { itemId: it.id }, k, i;
    for (k in record) if (has.call(record, k)) r[k] = clone(record[k]);
    r.expectedUnits = +r.expectedUnits;
    if (!(r.expectedUnits > 0)) refuse('invalid_input', 'Enter the number of units one mix is expected to give', 'expectedUnits');
    if (!Array.isArray(r.materials) || !r.materials.length) refuse('invalid_input', 'A recipe needs at least one material', 'materials');
    for (i = 0; i < r.materials.length; i++) {
      var m = isRow(r.materials[i]) ? M.itemById[r.materials[i].itemId] : null;
      if (!m || m.kind === 'fg') refuse('invalid_input', 'Material ' + (i + 1) + ': choose a material', 'materials[' + i + '].itemId');
      r.materials[i] = { itemId: m.id, qty: needQty(r.materials[i].qty, m, 'materials[' + i + '].qty') };
    }
    r.packing = Array.isArray(r.packing) ? r.packing : [];
    for (i = 0; i < r.packing.length; i++) {
      var pk = isRow(r.packing[i]) ? M.itemById[r.packing[i].itemId] : null;
      if (!pk || pk.kind === 'fg') refuse('invalid_input', 'Packing ' + (i + 1) + ': choose a packing item', 'packing[' + i + '].itemId');
      r.packing[i] = { itemId: pk.id, qtyPerUnit: needQty(r.packing[i].qtyPerUnit, pk, 'packing[' + i + '].qtyPerUnit') };
    }
    r.mixLabel = r.mixLabel ? String(r.mixLabel) : '';
    if (r.rhythm === undefined) r.rhythm = 'daily';
    /* made every day, or on chosen weekdays (0 = Monday): a list with no day in it would leave the product off every plan unnoticed */
    if (r.rhythm !== 'daily' && !(Array.isArray(r.rhythm) && r.rhythm.length && r.rhythm.every(function (d) { return d === Math.floor(d) && d >= 0 && d <= 6; }))) {
      refuse('invalid_input', 'Tick at least one weekday, or choose every day', 'rhythm');
    }
    r.standardMixes = r.standardMixes === undefined ? 1 : +r.standardMixes;
    if (!(r.standardMixes >= 0)) refuse('invalid_input', 'Enter the standard number of mixes', 'standardMixes');
    if (old) needChange(old, r);
    if (op.dry) return { ok: true, preview: true, record: r, warnings: [] };
    var before = old ? clone(old) : null;
    if (old) assign(old, r); else { M.recipes.push(r); M.recipeByItem[it.id] = r; old = r; }
    costCache = {};
    auditMaster('master', 'recipes', it.id, before, clone(old));
    return { ok: true, record: old, before: before, warnings: [] };
  }

  function storeIdFrom(name) {
    var slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 10) || 'store', id = 'st_' + slug, n = 2;
    while (M.unitById[id] || M.locationById[id]) id = 'st_' + slug + n++;
    return id;
  }

  /** A store, a factory store and the factory itself each have a name of their own (a transit location is named after its store). */
  function needUniqueLocation(name, self) {
    var key = name.toLowerCase(), i;
    for (i = 0; i < M.locations.length; i++) {
      var l = M.locations[i];
      if (l !== self && l.kind !== 'transit' && String(l.name).trim().toLowerCase() === key) refuse('duplicate', 'There is already a location called ' + l.name, 'name');
    }
    for (i = 0; i < M.units.length; i++) {
      var u = M.units[i];
      if ((!self || u.id !== self.unitId) && String(u.name).trim().toLowerCase() === key) refuse('duplicate', 'There is already a location called ' + u.name, 'name');
    }
  }

  /** Adding a location adds an own store: its unit, its stock location, its transit location and its cash. */
  function masterLocation(record) {
    var name, standing, before;
    if (record.id && (M.locationById[record.id] || M.unitById[record.id])) {
      var loc = M.locationById[record.id];
      if (!loc || loc.kind === 'transit') refuse('invalid_input', 'Change the store itself; its transit location follows', 'id');
      name = needText(record.name === undefined ? loc.name : record.name, 'Enter the name of the location', 'name');
      needUniqueLocation(name, loc);
      var u = loc.kind === 'store' ? M.unitById[loc.unitId] : null;
      standing = u && record.standing !== undefined ? cleanStanding(record.standing, 'standing') : null;
      needChange({ name: loc.name, standing: u && standing ? u.standing : null }, { name: name, standing: standing });
      if (op.dry) return { ok: true, preview: true, record: loc, warnings: [] };
      before = { id: loc.id, name: loc.name, standing: u ? clone(u.standing) : null };
      loc.name = name;
      if (u) {
        u.name = name;
        if (standing) u.standing = standing;
        if (M.locationById[u.transitLocId]) M.locationById[u.transitLocId].name = 'In transit to ' + name;
        if (M.accountById[u.cashAccountId]) M.accountById[u.cashAccountId].name = 'Cash, ' + name;
      }
      auditMaster('master', 'locations', loc.id, before, { id: loc.id, name: loc.name, standing: u ? clone(u.standing) : null });
      return { ok: true, record: loc, unit: u, before: before, warnings: [] };
    }
    name = needText(record.name, 'Enter the name of the store', 'name');
    needUniqueLocation(name, null);
    standing = cleanStanding(record.standing, 'standing');
    /* like a document id, the id of a new store is fixed in the log entry, so that a replay cannot give it another */
    var id = record.id || (op.ids ? op.ids[0] : null) || storeIdFrom(name);
    if (!/^st_[a-z0-9_]+$/.test(id)) refuse('invalid_input', 'A store id starts with st_ and has small letters and digits only', 'id');
    if (op.dry) return { ok: true, preview: true, record: { id: id, name: name }, warnings: [] };
    var unit = normaliseUnit({ id: id, name: name, kind: 'store', standing: standing, active: true });
    var store = normaliseLocation({ id: unit.locId, name: name, kind: 'store', unitId: id });
    var transit = normaliseLocation({ id: unit.transitLocId, name: 'In transit to ' + name, kind: 'transit', unitId: id });
    var acc = normaliseAccount({ id: unit.cashAccountId, name: 'Cash, ' + name, kind: 'cash', unitId: id });
    M.units.push(unit); M.unitById[id] = unit;
    M.locations.push(store, transit); M.locationById[store.id] = store; M.locationById[transit.id] = transit;
    M.accounts.push(acc); M.accountById[acc.id] = acc;
    book.stock[store.id] = {}; book.lots[store.id] = {}; book.reserved[store.id] = {};
    book.stock[transit.id] = {}; book.lots[transit.id] = {}; book.reserved[transit.id] = {};
    book.cash.balance[acc.id] = 0; book.cash.byAccount[acc.id] = [];
    auditMaster('master', 'locations', id, null, { id: id, name: name, standing: clone(standing) });
    return { ok: true, record: store, unit: unit, before: null, warnings: [] };
  }

  /** Add (no id, or an id not yet in use) or edit (an existing id) one master record. */
  function master(entity, record) {
    record = record || {};
    if (entity === 'recipes') return masterRecipe(record);
    if (entity === 'locations') return masterLocation(record);
    var def = ENTITIES[entity];
    if (!def) refuse('invalid_input', 'There is no form for ' + entity, 'entity');
    var old = record.id ? M[def.by][record.id] || null : null;
    var r = old ? clone(old) : { id: record.id || (op.ids ? op.ids[0] : null) || newMasterId(entity), active: true }, k;
    for (k in record) {
      if (!has.call(record, k) || k === 'id') continue;
      /* a price list is changed one price at a time */
      if (k === 'price' && r.price && record.price) { for (var pk in record.price) if (has.call(record.price, pk)) r.price[pk] = record.price[pk]; }
      else r[k] = clone(record[k]);
    }
    if (old && has.call(record, 'active') && record.active !== old.active) refuse('invalid_input', 'Use activate or deactivate to change the status', 'active');
    VALIDATE[entity](r, old);
    if (old) needChange(old, r);
    if (op.dry) return { ok: true, preview: true, record: r, warnings: [] };
    var before = old ? clone(old) : null;
    if (old) assign(old, r); else { M[def.list].push(r); M[def.by][r.id] = r; old = r; }
    if (entity === 'customers') {
      /* an outlet is a stop on its route: a new one goes last, one that changes route leaves the old one */
      for (var i = 0; i < M.routes.length; i++) {
        var stops = M.routes[i].stops || (M.routes[i].stops = []), at = stops.indexOf(old.id);
        if (M.routes[i].id === old.routeId) { if (at === -1) stops.push(old.id); }
        else if (at !== -1) stops.splice(at, 1);
      }
    }
    if (entity === 'items') costCache = {};
    auditMaster('master', entity, old.id, before, clone(old));
    return { ok: true, record: old, before: before, warnings: [] };
  }

  function isEmpty(map) {
    for (var k in map) if (has.call(map, k) && map[k] !== 0) return false;
    return true;
  }

  /** Deactivate or reactivate; never delete. */
  function setActive(entity, id, active) {
    active = !!active;
    if (entity === 'locations') {
      var loc = M.locationById[id];
      if (!loc || loc.kind === 'transit') refuse('invalid_input', 'Choose a store', 'id');
      if (loc.kind !== 'store') refuse('invalid_input', loc.name + ' is a factory store and cannot be deactivated', 'id');
      var u = M.unitById[loc.unitId];
      if (!active) {
        if (!isEmpty(book.stock[u.locId] || {}) || !isEmpty(book.stock[u.transitLocId] || {})) refuse('has_dependants', u.name + ' still holds stock, or has stock on its way; it can be deactivated only when it holds none', 'id');
        if ((book.cash.balance[u.cashAccountId] || 0) !== 0) refuse('has_dependants', u.name + ' still holds ' + fmt.inr2(book.cash.balance[u.cashAccountId]) + ' in cash; deposit it first', 'id');
      }
      if ((u.active !== false) === active) refuse('invalid_input', 'Nothing was changed: ' + u.name + ' is ' + (active ? 'active' : 'inactive') + ' already', 'id');
      if (op.dry) return { ok: true, preview: true, record: loc, warnings: [] };
      var was = u.active !== false;
      u.active = active; loc.active = active;
      if (M.locationById[u.transitLocId]) M.locationById[u.transitLocId].active = active;
      if (M.accountById[u.cashAccountId]) M.accountById[u.cashAccountId].active = active;
      auditMaster('setActive', 'locations', loc.id, { active: was }, { active: active });
      return { ok: true, record: loc, unit: u, warnings: [] };
    }
    var def = ENTITIES[entity];
    if (!def) refuse('invalid_input', 'There is no form for ' + entity, 'entity');
    var r = M[def.by][id];
    if (!r) refuse('not_found', 'There is no ' + def.noun + ' ' + id, 'id');
    if (!active && entity === 'vendors' && r.kind === 'staff') refuse('invalid_input', r.name + ' takes the monthly salary bill and cannot be deactivated', 'id');
    if (!active && entity === 'expenseCategories' && (r.id === M.shortExcessCategoryId || r.id === M.salaryCategoryId)) refuse('invalid_input', r.name + ' is used by ' + (r.id === M.salaryCategoryId ? 'the monthly salary bill' : 'the store day-end') + ' and cannot be deactivated', 'id');
    if ((r.active !== false) === active) refuse('invalid_input', 'Nothing was changed: ' + r.name + ' is ' + (active ? 'active' : 'inactive') + ' already', 'id');
    if (op.dry) return { ok: true, preview: true, record: r, warnings: [] };
    var before = r.active !== false;
    r.active = active;
    auditMaster('setActive', entity, r.id, { active: before }, { active: active });
    return { ok: true, record: r, warnings: [] };
  }

  /* =============================================================== exports */

  var POSTERS = {
    PO: postPO, GRN: postGRN, VBILL: postVBill, PAY: postPay, PROD: postProd, SO: postSO, INV: postInv, RCPT: postRcpt,
    CN: postCN, XFER: postXfer, DAYEND: postDayEnd, DEP: postDep, ADJ: postAdj, WO: postWO, EXP: postExp,
    OPENSTOCK: postOpenStock, OPENCASH: postOpenCash
  };

  function poster(fn) { return entry(function (payload, ctx) { begin(ctx); return fn(payload || {}); }); }

  var core = {
    /** post(type, payload, ctx): any document type by name. An INV or VBILL payload with opening: true is an opening balance. */
    post: entry(function (type, payload, ctx) {
      begin(ctx);
      var fn = POSTERS[String(type || '').toUpperCase()];
      if (!fn) refuse('invalid_input', 'Unknown document type: ' + type, 'type');
      return fn(payload || {});
    }),
    po: poster(postPO), grn: poster(postGRN), vbill: poster(postVBill), pay: poster(postPay), prod: poster(postProd),
    so: poster(postSO), inv: poster(postInv), rcpt: poster(postRcpt), cn: poster(postCN), xfer: poster(postXfer),
    dayend: poster(postDayEnd), dep: poster(postDep), adj: poster(postAdj), wo: poster(postWO), exp: poster(postExp),
    openStock: poster(postOpenStock), openCash: poster(postOpenCash),
    openInv: entry(function (payload, ctx) { begin(ctx); var p = clone(payload || {}); p.opening = true; return postInv(p); }),
    openBill: entry(function (payload, ctx) { begin(ctx); var p = clone(payload || {}); p.opening = true; return postVBill(p); }),
    postDispatch: entry(function (args, ctx) { begin(ctx); return postDispatch(args); }),
    approve: entry(function (id, ctx) { begin(ctx); return approve(id); }),
    reject: entry(function (id, reason, ctx) { begin(ctx); return reject(id, reason); }),
    cancel: entry(function (id, reason, ctx) { begin(ctx); return cancel(id, reason); }),
    cancelDispatch: entry(function (args, ctx) { begin(ctx); return cancelDispatch(args); }),
    receiveTransfer: entry(function (id, ctx) { begin(ctx); return receiveTransfer(id); }),
    master: entry(function (entity, record, ctx) { begin(ctx); return master(entity, record); }),
    setActive: entry(function (entity, id, active, ctx) { begin(ctx); return setActive(entity, id, active); }),
    nextBatchId: function (itemId, date) { return nextBatchId(itemId, date); },
    newMasterId: newMasterId
  };

  /**
   * What ids an operation will take, so that HB.engine.act can fix them in the log entry before applying:
   * { types: ['INV', 'INV'], batch: false }. One id per document the operation creates, in the order it takes them.
   * It runs before the core has looked at the arguments, so it must take anything: an empty line is not a line.
   */
  function idPlan(opName, args) {
    args = args || {};
    var types = [], batch = false, i, j, p = isRow(args.payload) ? args.payload : {};
    if (opName === 'post') {
      var type = String(args.type || '').toUpperCase();
      types.push(type);
      if (type === 'PROD') batch = true;
      if (type === 'DAYEND' && Array.isArray(p.lines)) {
        for (i = 0; i < p.lines.length; i++) if (isRow(p.lines[i]) && +p.lines[i].expired > 0) { types.push('WO'); break; }
      }
    } else if (opName === 'cancel') {
      types.push('CXL');
    } else if (opName === 'cancelDispatch') {
      /* one cancellation per invoice the sheet has now, in the order the core cancels them */
      var live = book && typeof args.sheetId === 'string' && has.call(book.index.sheet, args.sheetId) ? book.index.sheet[args.sheetId] : null;
      for (i = 0; live && i < live.length; i++) types.push('CXL');
    } else if (opName === 'postDispatch' && Array.isArray(args.outlets)) {
      for (i = 0; i < args.outlets.length; i++) {
        var lines = isRow(args.outlets[i]) && Array.isArray(args.outlets[i].lines) ? args.outlets[i].lines : [];
        for (j = 0; j < lines.length; j++) if (isRow(lines[j]) && +lines[j].qty !== 0) { types.push('INV'); break; }
      }
    }
    return { types: types, batch: batch };
  }

  /* ============================================================ operations */
  /*
   * HB.engine.act is the only way a user changes the book. It has two halves.
   * The outer half belongs to this session: it asks HB.session whether the persona may do it, and fixes the log
   * entry - who, in which role, when, and the ids the operation will take.
   * The inner half (applyEntry) is a function of the book and the entry alone: it reads neither HB.session nor
   * a counter nor the clock, and "today" for the date rules is the day in the entry's own time. Boot replays the
   * log through the same function, which is why a reload under any persona gives the same book.
   */

  var OPS = ['post', 'approve', 'reject', 'cancel', 'receiveTransfer', 'postDispatch', 'cancelDispatch', 'master', 'setActive'];
  var CREATE_ACTION = {
    PO: 'po.create', GRN: 'grn.create', VBILL: 'vbill.create', PAY: 'pay.create', PROD: 'prod.create', SO: 'so.create',
    INV: 'inv.create', RCPT: 'rcpt.create', CN: 'cn.create', XFER: 'xfer.create', DAYEND: 'dayend.create',
    DEP: 'dep.create', ADJ: 'adj.create', WO: 'wo.create'
  };
  var EXP_ACTION = { claim: 'exp.claim', bill: 'exp.bill', salary: 'exp.salary' };
  var USER_ID = /^([A-Z]+)-U-(\d+)$/;

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function pad4(n) { var s = String(n); while (s.length < 4) s = '0' + s; return s; }

  /** The user's log: one array in the store, append-only. */
  function logOf() {
    var log = HB.store.get('log', null);
    return Array.isArray(log) ? log : [];
  }

  /** 09:00 plus one minute per entry, stopping at 23:59: a made-up clock, so that a replay tells the same time. */
  function clockOf(n) {
    var m = 540 + n;
    if (m > 1439) m = 1439;
    return pad2(Math.floor(m / 60)) + ':' + pad2(m % 60);
  }

  /* --------------------------------------------------- the outer half */

  /**
   * May this persona do it? Own approval is tested before the role (in HB.session.can). Returns a refusal, or
   * null. Whatever the session has no action for is left to the core, which refuses what it does not know.
   */
  function rightsOf(opName, a, user) {
    var action = null, ctx = { user: user }, doc = null;
    if (opName === 'post') {
      var p = a.payload && typeof a.payload === 'object' ? a.payload : {};
      action = a.type === 'EXP' ? EXP_ACTION[p.kind] : CREATE_ACTION[a.type];
      ctx.doc = p; /* the session reads the unit, location or account the document is for */
    } else if (opName === 'postDispatch') {
      action = 'dispatch.post';
    } else if (opName === 'cancelDispatch') {
      action = 'dispatch.cancel'; /* whoever may post a sheet may cancel one */
    } else if (opName === 'master' || opName === 'setActive') {
      action = a.entity === 'employees' ? 'employee.edit' : 'master.edit';
    } else {
      doc = book.docs[a.id];
      if (!doc) return null;
      action = opName === 'receiveTransfer' ? 'xfer.receive' : opName + '.' + doc.type.toLowerCase();
      ctx.doc = doc;
    }
    if (!action) return null;
    var can = HB.session.can(action, ctx);
    if (can.ok || can.code === 'unknown_action') return null;
    /* a role that may post this, but not for that store, location or account: the form marks the input that names it */
    return E.fail(can.code, can.reason, opName === 'post' ? can.field : null, doc ? doc.id : null);
  }

  /** The highest number each type has in the log: TYPE-U-NNNN ids are numbered after it, skipped entries included. */
  function highestIn(log) {
    var top = {}, i, j;
    for (i = 0; i < log.length; i++) {
      var ids = log[i] && log[i].out && Array.isArray(log[i].out.ids) ? log[i].out.ids : [];
      for (j = 0; j < ids.length; j++) {
        var m = USER_ID.exec(ids[j]);
        if (m && +m[2] > (top[m[1]] || 0)) top[m[1]] = +m[2];
      }
    }
    return top;
  }

  /**
   * What the operation will take, fixed before it is applied: one id per document it creates, in order, the batch
   * id of a production entry, and the id of a master record or a store that is being added.
   */
  function outOf(opName, a, log) {
    var plan = idPlan(opName, a), top = highestIn(log), out = { ids: [], batchId: null }, i;
    for (i = 0; i < plan.types.length; i++) {
      var t = plan.types[i];
      top[t] = (top[t] || 0) + 1;
      out.ids.push(t + '-U-' + pad4(top[t]));
    }
    if (plan.batch) {
      var p = a.payload || {};
      if (M.itemById[p.itemId] && D.isIso(p.date)) out.batchId = nextBatchId(p.itemId, p.date);
    }
    if (opName === 'master') {
      var rec = a.record && typeof a.record === 'object' ? a.record : {};
      if (ENTITIES[a.entity] && !rec.id) out.ids.push(newMasterId(a.entity));
      else if (a.entity === 'locations' && !rec.id && rec.name && String(rec.name).trim()) out.ids.push(storeIdFrom(String(rec.name).trim()));
    }
    return out;
  }

  /* --------------------------------------------------- the inner half */

  /** The date a posted entry carries, and the input that holds it. A salary bill is dated by its month. */
  function datedOf(opName, a) {
    if (opName === 'postDispatch') return { date: a.date, field: 'date' };
    if (opName !== 'post') return null;
    var p = a.payload && typeof a.payload === 'object' ? a.payload : {};
    if (a.type === 'EXP' && p.kind === 'salary') {
      if (typeof p.monthKey !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(p.monthKey)) return null;
      return { date: D.monthEnd(p.monthKey + '-01'), field: 'monthKey', month: p.monthKey };
    }
    return { date: p.date, field: 'date' };
  }

  /**
   * SPEC 5.3: no date in the future; nobody before the first day of last month; a persona other than accounts
   * and the Owner at most limits.backDateDays back. `today` is the day of the entry, so the answer is the same
   * whenever the entry is replayed. Text that is not a date is left to the core, which says what is wrong; a
   * date that is not text (an array of one day reads like that day) is refused here, before any rule is skipped.
   */
  function dateRule(opName, a, role, today) {
    var x = datedOf(opName, a);
    if (!x) return null;
    if (x.date !== undefined && x.date !== null && typeof x.date !== 'string') return E.fail('invalid_input', 'Enter the date as a calendar day', x.field);
    if (!D.isIso(x.date)) return null;
    var date = x.date;
    if (date > today) {
      return E.fail('future_date', x.month
        ? D.monthLabel(x.month, true) + ' is not over yet: its salary bill is raised on ' + dayText(date)
        : 'The date cannot be after the business date, ' + dayText(today), x.field);
    }
    var lock = D.monthStart(addDays(D.monthStart(today), -1));
    if (date < lock) return E.fail('locked_month', D.label(date, 'MMM yyyy') + ' is a locked month: entries can be dated from ' + dayText(lock), x.field);
    if (role !== 'owner' && role !== 'accounts') {
      var back = M.limits.backDateDays, first = addDays(today, -back);
      if (date < first) return E.fail('backdate_limit', 'This role can go back ' + back + (back === 1 ? ' day' : ' days') + ' at most, to ' + dayText(first) + '. Accounts and the Owner can enter an earlier date in an open month', x.field);
    }
    return null;
  }

  /** A copy of a payload without the fields only the engine may set. */
  function without(p, a, b) {
    var out = {}, k;
    for (k in p) if (has.call(p, k) && k !== a && k !== b) out[k] = p[k];
    return out;
  }

  /**
   * Apply one log entry { at, userId, role, op, args, out: { ids, batchId } } to the book: the date rules, then
   * the core with the entry as its context. Returns what the core returns. Rights are not tested here.
   */
  function applyEntry(e, dryRun) {
    if (!e || typeof e !== 'object' || OPS.indexOf(e.op) === -1) return E.fail('invalid_input', 'Unknown operation: ' + (e && e.op ? e.op : 'none'), 'op');
    var a = e.args && typeof e.args === 'object' ? e.args : {}, out = e.out && typeof e.out === 'object' ? e.out : {};
    if (typeof e.at !== 'string' || !D.isIso(e.at.slice(0, 10))) return E.fail('invalid_input', 'The entry carries no time', null);
    var today = e.at.slice(0, 10);
    var late = dateRule(e.op, a, e.role, today);
    if (late) return late;
    var ctx = {
      userId: e.userId || null, role: e.role || null, at: e.at, date: today,
      ids: Array.isArray(out.ids) && out.ids.length ? out.ids : null, batchId: out.batchId || null, dryRun: !!dryRun
    };
    switch (e.op) {
      case 'post':
        var type = String(a.type || '').toUpperCase(), p = a.payload && typeof a.payload === 'object' ? a.payload : {};
        /* a sheet id belongs to postDispatch and a source document to the day-end: neither can be typed in */
        if (type === 'INV' && (p.routeId !== undefined || p.sheetId !== undefined)) p = without(p, 'routeId', 'sheetId');
        if (type === 'WO' && p.sourceDocId !== undefined) p = without(p, 'sourceDocId');
        return core.post(type, p, ctx);
      case 'approve': return core.approve(a.id, ctx);
      case 'reject': return core.reject(a.id, a.reason, ctx);
      case 'cancel': return core.cancel(a.id, a.reason, ctx);
      case 'receiveTransfer': return core.receiveTransfer(a.id, ctx);
      case 'postDispatch': return core.postDispatch(a, ctx);
      case 'cancelDispatch': return core.cancelDispatch(a, ctx);
      case 'master': return core.master(a.entity, a.record, ctx);
      default: return core.setActive(a.entity, a.id, a.active, ctx);
    }
  }

  /* ---------------------------------------------------------- act, check */

  /** Rights, then the entry, then the inner half. A dry run stops there; a real one that went through is logged. */
  function run(opName, args, dryRun) {
    if (OPS.indexOf(opName) === -1) return E.fail('invalid_input', 'Unknown operation: ' + opName, 'op');
    if (!book || !M) reset();
    var a;
    /* through JSON, so that what is applied now is exactly what the log will hold and a replay will read */
    try { a = JSON.parse(JSON.stringify(args && typeof args === 'object' ? args : {})); }
    catch (err) { return E.fail('invalid_input', 'This entry cannot be stored', null); }
    if (opName === 'post') a.type = String(a.type || '').toUpperCase();
    var user = HB.session.current();
    var no = rightsOf(opName, a, user);
    if (no) return no;
    var log = dryRun ? null : logOf(), last = log && log.length ? log[log.length - 1] : null;
    var n = dryRun ? 0 : (last && typeof last.n === 'number' ? last.n : log.length) + 1;
    var e = {
      n: n, at: HB.calendar.today + 'T' + clockOf(n), userId: user.id, role: user.role, op: opName, args: a,
      out: dryRun ? { ids: [], batchId: null } : outOf(opName, a, log)
    };
    var res = applyEntry(e, dryRun);
    if (dryRun || !res.ok) return res; /* a refusal changed nothing, took no id and leaves no entry */
    log.push(e);
    HB.store.set('log', log);
    HB.bus.emit('store:changed', { key: 'book', op: opName, n: n });
    res.n = n;
    return res;
  }

  function act(opName, args) { return run(opName, args, false); }

  /**
   * Would it go through? The same rights, date rules and validation as act, and nothing posted. For a cancel or
   * a reject asked without a reason, the reason is not what is being asked about, so one is filled in.
   */
  function check(opName, args) {
    var a = args && typeof args === 'object' ? args : {};
    if ((opName === 'cancel' || opName === 'reject') && (a.reason === undefined || a.reason === null)) a = { id: a.id, reason: 'check' };
    if (opName === 'cancelDispatch' && (a.reason === undefined || a.reason === null)) a = { sheetId: a.sheetId, reason: 'check' };
    return run(opName, a, true);
  }

  /**
   * The date rules of SPEC 5.3 alone: may something dated `date` be entered on the business date by `role` (default:
   * the persona in use)? { ok: true }, or the refusal an entry so dated would get (future_date, locked_month,
   * backdate_limit; field 'date'). Rights and the rest of the entry are not asked. For a screen that has to say
   * whether a day is still open where there is no entry to preview: whether a cancelled dispatch sheet can be posted again.
   */
  function dateCheck(date, role) {
    if (!book || !M) reset();
    if (typeof date !== 'string' || !D.isIso(date)) return E.fail('invalid_input', 'Enter the date as a calendar day', 'date');
    return dateRule('postDispatch', { date: date }, role || HB.session.current().role, HB.calendar.today) || { ok: true };
  }

  /* -------------------------------------------------------------- preview */

  /** What a day-end may enter as expired: past best-before on `date`, not reserved, and left after the units sold. */
  function expirable(locId, itemId, date, sold) {
    var byItem = book.lots[locId], lots = byItem ? byItem[itemId] : null, sum = 0, i, j;
    if (!lots) return 0;
    for (i = 0; i < lots.length; i++) {
      if (lots[i].bestBefore > date) break;
      var free = lots[i].qty - lots[i].reserved;
      for (j = 0; j < sold.length; j++) if (sold[j].batchId === lots[i].batchId) free -= sold[j].qty;
      if (free > 0) sum += free;
    }
    return sum;
  }

  function wantOf(v) { var n = +v; return isFinite(n) && n > 0 ? n : 0; }

  /**
   * The stock behind each line of a draft, whether or not the draft would be accepted: one entry per payload
   * line (null where no item is chosen yet), or one per material for a production entry and per product for a
   * dispatch sheet. `available` is what a document dated like this one may take.
   */
  function stockOf(type, p) {
    var out = [], lines = Array.isArray(p.lines) ? p.lines : [], date = D.isIso(p.date) ? p.date : null, i, j, it, want, have;
    if (type === 'INV' || type === 'XFER') {
      var so = type === 'INV' && !lines.length && p.soId ? book.docs[p.soId] : null;
      if (so && so.type === 'SO') lines = so.lines;
      for (i = 0; i < lines.length; i++) {
        it = lines[i] ? M.itemById[lines[i].itemId] : null;
        if (!it) { out.push(null); continue; }
        want = wantOf(lines[i].qty); have = available(FG, it.id, date);
        out.push({ index: i, itemId: it.id, batchId: null, locId: FG, wanted: want, available: have, short: want > have });
      }
    } else if (type === 'DAYEND') {
      var u = M.unitById[p.storeId];
      for (i = 0; i < lines.length; i++) {
        it = lines[i] ? M.itemById[lines[i].itemId] : null;
        if (!it || !u || u.kind !== 'store' || !date) { out.push(null); continue; }
        want = wantOf(lines[i].sold); have = available(u.locId, it.id, date);
        var sold = want > 0 && want <= have && want === Math.floor(want) ? takeUnexpired(u.locId, it.id, want, date) : null;
        var gone = wantOf(lines[i].expired), can = expirable(u.locId, it.id, date, sold || []);
        out.push({ index: i, itemId: it.id, batchId: null, locId: u.locId, wanted: want, available: have, short: want > have, expired: gone, expirable: can, expiredShort: gone > can });
      }
    } else if (type === 'PROD') {
      var rec = M.recipeByItem[p.itemId], mixes = wantOf(p.mixes), good = wantOf(p.goodUnits), need = [], at = {};
      if (rec) {
        for (i = 0; i < rec.materials.length; i++) addConsumption(need, at, rec.materials[i].itemId, q3(rec.materials[i].qty * mixes));
        if (rec.packing) for (i = 0; i < rec.packing.length; i++) addConsumption(need, at, rec.packing[i].itemId, q3(rec.packing[i].qtyPerUnit * good));
        /* a material the draft needs none of yet is still listed: the form shows what the recipe draws on */
        for (i = 0; i < rec.materials.length; i++) if (at[rec.materials[i].itemId] === undefined) { at[rec.materials[i].itemId] = need.length; need.push({ itemId: rec.materials[i].itemId, qty: 0 }); }
        if (rec.packing) for (i = 0; i < rec.packing.length; i++) if (at[rec.packing[i].itemId] === undefined) { at[rec.packing[i].itemId] = need.length; need.push({ itemId: rec.packing[i].itemId, qty: 0 }); }
      }
      for (i = 0; i < need.length; i++) {
        have = available(RM, need[i].itemId, null);
        out.push({ index: null, itemId: need[i].itemId, batchId: null, locId: RM, wanted: need[i].qty, available: have, short: need[i].qty > have });
      }
    } else if (type === 'WO' || type === 'ADJ') {
      var loc = M.locationById[p.locId];
      for (i = 0; i < lines.length; i++) {
        it = lines[i] ? M.itemById[lines[i].itemId] : null;
        if (!it || !loc) { out.push(null); continue; }
        var batchId = it.kind === 'fg' ? lines[i].batchId || null : null;
        if (it.kind === 'fg' && !batchId) { out.push(null); continue; }
        have = onHand(loc.id, it.id, batchId);
        if (type === 'ADJ') { out.push({ index: i, itemId: it.id, batchId: batchId, locId: loc.id, wanted: 0, available: have, short: false }); continue; }
        want = wantOf(lines[i].qty); have = q3(have - reservedOf(loc.id, it.id, batchId));
        out.push({ index: i, itemId: it.id, batchId: batchId, locId: loc.id, wanted: want, available: have, short: want > have });
      }
    } else if (type === 'DISPATCH') {
      var totals = {}, order = [], outlets = Array.isArray(p.outlets) ? p.outlets : [];
      for (i = 0; i < outlets.length; i++) {
        var ol = outlets[i] && Array.isArray(outlets[i].lines) ? outlets[i].lines : [];
        for (j = 0; j < ol.length; j++) {
          it = ol[j] ? M.itemById[ol[j].itemId] : null;
          if (!it) continue;
          if (totals[it.id] === undefined) { totals[it.id] = 0; order.push(it.id); }
          totals[it.id] += wantOf(ol[j].qty);
        }
      }
      for (i = 0; i < order.length; i++) {
        have = available(FG, order[i], date);
        out.push({ index: null, itemId: order[i], batchId: null, locId: FG, wanted: totals[order[i]], available: have, short: totals[order[i]] > have });
      }
    }
    return out;
  }

  /** The status the document will have when the operation is over, and whether it will then wait for the Owner. */
  function outcomeOf(doc, role) {
    var waits = doc.status === 'PENDING' || doc.status === 'HELD';
    if (waits && role === 'owner') return { status: doc.type === 'PO' || doc.type === 'EXP' ? 'APPROVED' : 'POSTED', waits: false, self: true };
    return { status: doc.status, waits: waits, self: false };
  }

  /** The figures behind sharePct: the supply and the returns of the seven days that end on the note's date. */
  function returnsOf(doc) {
    var sup = book.index.supply[doc.customerId], ret = book.index.returned[doc.customerId], supply = 0, other = 0, d = doc.date;
    for (var i = 0; i < 7; i++) {
      if (sup) supply += sup[d] || 0;
      if (ret) other += ret[d] || 0;
      d = addDays(d, -1);
    }
    return {
      from: addDays(doc.date, -6), to: doc.date, supply: supply, returned: other, thisReturn: doc.taxable,
      sharePct: doc.sharePct, limitPct: M.limits.returnsPct, held: doc.status === 'HELD', reason: doc.holdReason
    };
  }

  /** Where an invoice leaves the customer against its credit limit; null for a customer with no limit. */
  function creditOf(doc) {
    var c = M.customerById[doc.customerId];
    if (!c || !(c.creditLimit > 0)) return null;
    var owes = book.ar.balance[c.id] || 0, after = owes + doc.total - doc.paidNow;
    return { limit: c.creditLimit, owes: owes, after: after, over: after > c.creditLimit };
  }

  /**
   * Everything a form shows while it is being filled in, and nothing posted: the document as it would be posted
   * (lines, totals, GST, three-way result, share of returns), the warnings, the stock behind each line, where
   * the document would land - or the refusal it would get. type is a document type, or 'DISPATCH' with the
   * arguments of postDispatch.
   */
  function preview(type, payload) {
    var t = String(type || '').toUpperCase(), p = payload && typeof payload === 'object' ? payload : {}, res, i;
    if (t === 'POSTDISPATCH') t = 'DISPATCH';
    res = t === 'DISPATCH' ? run('postDispatch', p, true) : run('post', { type: t, payload: p }, true);
    res.preview = true;
    res.stock = stockOf(t, p);
    if (!res.ok) return res;
    var role = HB.session.current().role;
    if (t === 'DISPATCH') {
      /* one invoice per outlet, as the sheet would post them (the batches each would take are not worked out) */
      var route = M.routeById[p.routeId], docs = [];
      for (i = 0; i < route.stops.length; i++) {
        for (var j = 0; j < p.outlets.length; j++) {
          if (p.outlets[j].customerId !== route.stops[i]) continue;
          var one = run('post', { type: 'INV', payload: { date: p.date, customerId: p.outlets[j].customerId, lines: p.outlets[j].lines } }, true);
          if (one.ok) { docs.push(one.doc); if (one.warnings.length) res.warnings = res.warnings.concat(one.warnings); }
        }
      }
      res.docs = docs;
      /* the sheet as a whole, so that a form states its total without adding the invoices up itself */
      var sum = { invoices: docs.length, units: 0, taxable: 0, gst: 0, total: 0, collected: 0 };
      for (i = 0; i < docs.length; i++) { sum.units += docs[i].units; sum.taxable += docs[i].taxable; sum.gst += docs[i].gst; sum.total += docs[i].total; sum.collected += docs[i].paidNow; }
      res.summary = sum;
      return res;
    }
    if (res.doc) {
      res.outcome = outcomeOf(res.doc, role);
      if (t === 'CN') res.returns = returnsOf(res.doc);
      if (t === 'INV') res.credit = creditOf(res.doc);
    }
    return res;
  }

  /* -------------------------------------------------------- boot, replay */

  /**
   * The opening entries of HB.config.opening, through the core, dated go-live:
   * { date?, stock: [openStock lines], cash: [{ accountId, amount }], receivables: [{ customerId, total, dueDate }],
   *   payables: [{ vendorId, total, dueDate, billNo? }] }. Boot posts them when there is no seed; a seed that
   * wants the same entries may call this first. A refusal here is a mistake in the config, so it is thrown.
   */
  function postOpening() {
    var o = HB.config && HB.config.opening, docs = [], who = null, i;
    if (!o || typeof o !== 'object') return docs;
    var date = o.date || HB.calendar.goLive;
    for (i = 0; i < M.users.length; i++) if (M.users[i].role === 'accounts') { who = M.users[i].id; break; }
    /* as at the start of the day, before anything a seed posts on go-live (its timetable begins at 04:30) */
    var ctx = { userId: who, role: 'accounts', at: date + 'T00:00', seed: true };
    function must(res, what) {
      if (!res.ok) throw new Error('HB.config.opening, ' + what + ': ' + res.error.message);
      docs.push(res.doc);
    }
    if (Array.isArray(o.stock) && o.stock.length) must(core.openStock({ date: date, lines: o.stock }, ctx), 'stock');
    if (Array.isArray(o.cash) && o.cash.length) must(core.openCash({ date: date, lines: o.cash }, ctx), 'cash');
    var rec = Array.isArray(o.receivables) ? o.receivables : [], pay = Array.isArray(o.payables) ? o.payables : [];
    for (i = 0; i < rec.length; i++) must(core.openInv({ date: date, customerId: rec[i].customerId, total: rec[i].total, dueDate: rec[i].dueDate }, ctx), 'receivable ' + (i + 1));
    for (i = 0; i < pay.length; i++) must(core.openBill({ date: date, vendorId: pay[i].vendorId, total: pay[i].total, dueDate: pay[i].dueDate, billNo: pay[i].billNo }, ctx), 'payable ' + (i + 1));
    return docs;
  }

  /**
   * Each entry as stored, in order. One that no longer applies is skipped and listed, never thrown: its ids stay
   * its own (they are in the entry), and an entry that needs a document it would have made is refused in turn.
   */
  function replay(log) {
    for (var i = 0; i < log.length; i++) {
      var e = log[i], res;
      try { res = applyEntry(e, false); }
      catch (err) { res = E.fail('error', err && err.message ? err.message : String(err)); }
      if (res.ok) continue;
      var x = e && typeof e === 'object' ? e : {};
      E.skipped.push({
        n: x.n === undefined ? i + 1 : x.n, at: x.at || null, userId: x.userId || null, role: x.role || null,
        op: x.op || null, args: x.args || null, out: x.out || null, code: res.error.code, reason: res.error.message
      });
    }
  }

  /**
   * Build the book: reset, the seed up to the day before the business date (or, with no seed, the opening
   * entries of the config), then the user's log. A copy saved under another seed version starts again.
   */
  function boot() {
    E.skipped = [];
    E.notice = '';
    var seed = HB.seed, version = seed && seed.VERSION !== undefined && seed.VERSION !== null ? String(seed.VERSION) : null;
    if (version !== null) {
      var meta = HB.store.get('meta', null), saved = meta && typeof meta === 'object' ? meta.seedVersion : null;
      /* no version yet is a copy opened for the first time, not a mismatch */
      if (saved !== undefined && saved !== null && String(saved) !== version) {
        var had = logOf().length;
        HB.store.remove('log');
        HB.calendar.set(HB.calendar.realToday());
        E.notice = 'The sample has been updated since this copy was saved' +
          (had ? ', so the ' + (had === 1 ? 'entry' : had + ' entries') + ' made in it could not be kept' : '') +
          '. A fresh copy dated ' + dayText(HB.calendar.today) + ' has been started.';
      }
      meta = HB.store.get('meta', null);
      if (!meta || typeof meta !== 'object') meta = {};
      if (meta.seedVersion !== version) { meta.seedVersion = version; HB.store.set('meta', meta); }
    }
    reset();
    if (seed && typeof seed.run === 'function') seed.run(HB.calendar.dataEnd);
    else postOpening();
    replay(logOf());
    E.booted = true;
    return book;
  }

  /** Discard the user's entries and start again from the device's date. A browser reloads; Node rebuilds in place. */
  function freshCopy() {
    HB.store.remove('log');
    HB.calendar.set(HB.calendar.realToday());
    if (root.location && typeof root.location.reload === 'function') { root.location.reload(); return null; }
    var b = boot();
    HB.bus.emit('store:changed', { key: 'book', op: 'freshCopy', n: 0 });
    return b;
  }

  E.boot = boot;
  E.act = act;
  E.check = check;
  E.dateCheck = dateCheck;
  E.preview = preview;
  E.freshCopy = freshCopy;
  E.postOpening = postOpening;
  /** The user's log, oldest first: [{ n, at, userId, role, op, args, out: { ids, batchId } }]. Read-only. */
  E.log = logOf;
  E.skipped = []; /* the entries the last boot could not replay: { n, at, userId, role, op, args, out, code, reason } */
  E.notice = '';  /* one sentence for a banner, when the last boot had to start a fresh copy */
  E.booted = false;

  E.reset = reset;
  E.core = core;
  E.unitCost = unitCost;
  E.costSheet = costSheet;
  E.price = priceOf;
  E.available = available;
  E.openAmount = openAmount;
  E.rowsOf = rowsOf;
  E.settlers = settlers;
  E.dispatchSheet = dispatchSheet;
  E.transferSheet = transferSheet;
  E.salaryBill = salaryBill;
  E.salaryLines = salaryLines;
  E.sheetId = sheetIdOf;
  E.idPlan = idPlan;
  E.DOC_TYPES = DOC_TYPES.slice();
  /** For the wrapper: a refusal in the same shape the core returns. */
  E.fail = function (code, message, field, docId) {
    return { ok: false, error: { code: code, message: message, field: field || null, docId: docId || null }, warnings: [] };
  };

  /* Pages may ask for the masters before the boot has run; an empty book is a valid book. */
  if (HB.config) reset();

  if (typeof module !== 'undefined' && module.exports) module.exports = HB;
})(typeof window !== 'undefined' ? window : globalThis);
