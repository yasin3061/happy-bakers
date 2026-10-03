/*
 * HB.data - every selector the pages use (SPEC section 8; shapes in docs/API.md section 4).
 *
 * A selector reads HB.book and HB.masters as they stand and returns plain rows. It never posts, never reads the
 * clock and never keeps a reference to the book across a change. The rules of SPEC section 8 hold in every one:
 *   - rows, not statuses: an amount or a quantity is a sum of ledger rows by the row's own date, originals and
 *     reversals alike. Only document lists, open balances and "to do" lists look at a status;
 *   - no figure of another period beside this one, and no forecast;
 *   - everything is cut to HB.session.scope() and to the pages the persona has (HB.session.access): a store
 *     manager gets one store, sales gets no payables, and salaries go to the Owner and accounts only.
 * Results are remembered until the book's posting sequence, the persona or the business date changes, so a
 * redraw costs a lookup. What a selector returns is shared: treat it as read-only.
 */
(function (root) {
  'use strict';

  var HB = root.HB || (root.HB = {});
  var D = HB.dates, money = HB.money, q3 = HB.q3, fmt = HB.fmt;
  var has = Object.prototype.hasOwnProperty;

  var RM = 'fac_rm', FACTORY = 'factory', BANK = 'bank';
  var FAR = '9999-12-31';        /* later than any date a row can carry */
  var MAX_RESULTS = 4000;        /* results remembered for one state of the book before the cache starts again */
  var ROW_LIMIT = 5000;          /* the stock ledger and the audit log of two years are too long to hand to a table whole */

  /* --------------------------------------------------------------- cache */
  /*
   * One set of results per state of the book and per persona. book.seq moves with every posting, approval,
   * cancellation and master change (each writes at least an audit entry), a boot replaces the book, and a
   * change of persona or of the business date changes what a selector may return.
   */

  var cache = null;

  function stamp() {
    var b = HB.book, u = HB.session.current(), c = cache;
    if (!b || !HB.masters) throw new Error('HB.data: the book is not built yet - call HB.engine.boot() first');
    if (c && c.book === b && c.seq === b.seq && c.masters === HB.masters && c.today === HB.calendar.today && c.userId === u.id) return c;
    var sc = HB.session.scope();
    cache = {
      book: b, seq: b.seq, masters: HB.masters, today: HB.calendar.today, userId: u.id,
      user: u, role: u.role, sc: sc, all: sc.all, results: {}, count: 0, sees: {}, days: null
    };
    return cache;
  }

  function keyOf(x) { return typeof x === 'string' ? x : JSON.stringify(x === undefined ? null : x); }

  /** The result of fn(cache), remembered under name and argument until the book, the persona or the date changes. */
  function memo(name, arg, fn) {
    var c = stamp(), key = arg === undefined ? name : name + '|' + keyOf(arg);
    if (has.call(c.results, key)) return c.results[key];
    /* a user who pages through many ranges without posting anything must not fill the memory: start again */
    if (++c.count > MAX_RESULTS) { c.results = {}; c.count = 1; }
    return (c.results[key] = fn(c));
  }

  /* ------------------------------------------------------- scope and view */
  /*
   * Units, locations and accounts come from HB.session.scope(). What kind of document a role sees at all is
   * taken from the pages it has, so the rule is written once, in HB.session.access: a selector answers only to
   * a role that has a page showing it.
   */

  var DOMAIN_PAGES = {
    ledger: ['stock-ledger'],
    counts: ['stock-counts'],
    purchase: ['buy-orders', 'buy-receipts'],
    bills: ['buy-bills', 'buy-payments', 'acc-payables'],
    production: ['make-production'],
    recipes: ['make-recipes', 'masters-items', 'acc-margin'],
    sales: ['sell-dispatch', 'sell-corporate', 'sell-invoices', 'sell-returns', 'sell-receipts', 'stores-dayend'],
    ar: ['acc-receivables', 'sell-receipts', 'sell-invoices'],
    storeops: ['stores-transfers', 'stores-dayend'],
    pnl: ['acc-pnl'],
    margin: ['acc-margin'],
    gst: ['acc-gst'],
    people: ['people'],
    approvals: ['approvals'],
    audit: ['sys-audit'],
    notify: ['sys-notifications'],
    reports: ['reports']
  };

  function sees(domain) {
    var c = stamp();
    if (c.all) return true;
    if (c.sees[domain] === undefined) {
      var pages = DOMAIN_PAGES[domain] || [], yes = false;
      for (var i = 0; i < pages.length && !yes; i++) yes = HB.session.canOpen(pages[i], c.role);
      c.sees[domain] = yes;
    }
    return c.sees[domain];
  }

  function unitOk(c, id) { return c.all || c.sc.unit(id); }
  function locOk(c, id) { return c.all || c.sc.loc(id); }
  function accountOk(c, id) { return c.all || c.sc.account(id); }

  /** true when a filter value means "no filter": undefined, null, '' or 'all' (API 4.1). */
  function noFilter(want) { return want === undefined || want === null || want === '' || want === 'all'; }

  /** No filter matches everything; a value or a list of values matches itself. */
  function oneOf(want, value) {
    if (noFilter(want)) return true;
    return Array.isArray(want) ? want.indexOf(value) !== -1 : want === value;
  }

  /** The one id a filter names, or null when it names none, several (a list) or no filter. */
  function oneId(want) { return !noFilter(want) && typeof want === 'string' ? want : null; }

  /** The units a filter asks for, inside the scope: f.unitIds (a list) or f.unitId (one). */
  function unitWanted(c, f, id) {
    if (!unitOk(c, id)) return false;
    if (!f) return true;
    return oneOf(f.unitIds, id) && oneOf(f.unitId, id);
  }

  /* ---------------------------------------------------------------- days */

  /** from and to of a filter, cut to the life of the book: go-live to the business date. */
  function rangeOf(f) {
    var cal = HB.calendar, from = f && f.from ? String(f.from) : cal.goLive, to = f && f.to ? String(f.to) : cal.today;
    if (from < cal.goLive) from = cal.goLive;
    if (to > cal.today) to = cal.today;
    return { from: from, to: to };
  }

  /** The days that have anything, in order. A back-dated document can open a day out of order, hence the sort. */
  function dayKeys(c) { return c.days || (c.days = Object.keys(c.book.days).sort()); }

  /** First index whose key is not before x. */
  function lowerBound(keys, x) {
    var lo = 0, hi = keys.length;
    while (lo < hi) { var mid = (lo + hi) >> 1; if (keys[mid] < x) lo = mid + 1; else hi = mid; }
    return lo;
  }

  /** fn(day) for every day with rows from `from` to `to`, oldest first. */
  function eachDay(from, to, fn) {
    var c = stamp(), keys = dayKeys(c), days = c.book.days;
    for (var i = lowerBound(keys, from); i < keys.length && keys[i] <= to; i++) fn(days[keys[i]]);
  }

  /**
   * The documents of one type (or of several) dated in the range of f, newest first: by date, then by posting
   * order. f.status narrows by status; test(doc) by anything else.
   */
  function docsIn(types, f, test) {
    var c = stamp(), r = rangeOf(f), keys = dayKeys(c), days = c.book.days, out = [];
    var one = typeof types === 'string', status = f ? f.status : undefined, i, j, list, d;
    for (i = lowerBound(keys, r.to + '~') - 1; i >= 0 && keys[i] >= r.from; i--) {
      list = days[keys[i]].docs;
      for (j = list.length - 1; j >= 0; j--) {
        d = list[j];
        if (one ? d.type !== types : types.indexOf(d.type) === -1) continue;
        if (!oneOf(status, d.status)) continue;
        if (test && !test(d)) continue;
        out.push(d);
      }
    }
    return out;
  }

  /** The document a ledger row stands for: itself, or for a row written by a cancellation, the cancelled one. */
  function sourceOf(c, docId) {
    var d = c.book.docs[docId];
    return d && d.type === 'CXL' ? c.book.docs[d.targetId] || d : d;
  }

  /** What a register says beside a reversal row. */
  function reversalNote(c, row) {
    if (!row.reversal) return '';
    var x = c.book.docs[row.docId];
    return x && x.type === 'CXL' ? 'Cancellation of ' + x.targetId + (x.reason ? ': ' + x.reason : '') : 'Cancellation';
  }

  function byDateSeq(a, b) { return a.date < b.date ? -1 : (a.date > b.date ? 1 : a.seq - b.seq); }

  function sumOf(list, key) { var t = 0; for (var i = 0; i < list.length; i++) t += list[i][key] || 0; return t; }

  /** a / b as a fraction, or null when there is nothing to divide by. */
  function ratio(a, b) { return b ? a / b : null; }

  /* --------------------------------------------------------------- labels */

  var TYPE_LABEL = {
    PO: 'Purchase order', GRN: 'Goods receipt', VBILL: 'Vendor bill', PAY: 'Payment', PROD: 'Production entry',
    SO: 'Sales order', INV: 'Invoice', RCPT: 'Receipt', CN: 'Stale return', XFER: 'Transfer', DAYEND: 'Day-end',
    DEP: 'Cash deposit', ADJ: 'Stock count', WO: 'Write-off', EXP: 'Expense', CXL: 'Cancellation',
    OPENSTOCK: 'Opening stock', OPENCASH: 'Opening cash',
    DS: 'Dispatch sheet' /* not a document: the invoices that share a sheet id (sell.sheet) */
  };
  var EXP_LABEL = { claim: 'Expense claim', bill: 'Expense bill', salary: 'Salary bill' };
  var STATUS_LABEL = {
    PENDING: 'Waiting for approval', HELD: 'Held for approval', APPROVED: 'Approved', PART_RECEIVED: 'Part received',
    RECEIVED: 'Received', REJECTED: 'Rejected', CANCELLED: 'Cancelled', POSTED: 'Posted', OPEN: 'Open',
    INVOICED: 'Invoiced', SENT: 'Sent', PAID: 'Paid'
  };
  var CHANNELS = ['retail', 'corporate', 'store'];
  var CHANNEL_LABEL = { retail: 'Retail outlets', corporate: 'Corporates', store: 'Own stores' };
  var KIND_LABEL = { fg: 'Finished goods', rm: 'Raw material', pk: 'Packing' };
  var MOVE_LABEL = {
    opening: 'Opening stock', receipt: 'Goods receipt', consumption: 'Used in production', production: 'Production',
    dispatch: 'Dispatch', transfer: 'Transfer to store', transfer_in: 'Received at store', sale: 'Store sale',
    adjustment: 'Stock count', writeoff: 'Write-off'
  };
  var AR_LABEL = { invoice: 'Invoice', collected: 'Cash collected on delivery', receipt: 'Receipt', credit_note: 'Stale return' };
  var CASH_LABEL = {
    opening: 'Opening balance', collected: 'Cash collected on delivery', receipt: 'Receipt', payment: 'Payment',
    store_cash: 'Store sales, cash', store_upi: 'Store sales, UPI', deposit: 'Cash deposit'
  };
  var PNL_LABEL = {
    sales: 'Sales', returns: 'Stale returns', cogs: 'Cost of goods sold', prodLoss: 'Production loss',
    writeoff: 'Write-offs', countDiff: 'Count differences', expense: 'Expenses'
  };
  var ACTION_LABEL = {
    post: 'Entered', approve: 'Approved', reject: 'Rejected', cancel: 'Cancelled', receive: 'Received by the store',
    master: 'Record changed', setActive: 'Activated or deactivated'
  };
  var TERMS_LABEL = { cash: 'Cash on delivery', weekly: 'Weekly credit', credit: 'Credit' };

  function typeLabel(type, kind) { return type === 'EXP' && EXP_LABEL[kind] ? EXP_LABEL[kind] : (TYPE_LABEL[type] || String(type || '')); }
  function docLabel(d) { return d ? typeLabel(d.type, d.kind) : ''; }
  function statusLabel(s) { return STATUS_LABEL[s] || String(s || ''); }
  function channelLabel(ch) { return CHANNEL_LABEL[ch] || String(ch || ''); }

  /* ---------------------------------------------------------------- names */

  function nameIn(index, id) {
    var r = index ? index[id] : null;
    return r ? r.name : (id === null || id === undefined ? '' : String(id));
  }
  function itemName(id) { return nameIn(HB.masters.itemById, id); }
  function customerName(id) { return nameIn(HB.masters.customerById, id); }
  function vendorName(id) { return nameIn(HB.masters.vendorById, id); }
  function employeeName(id) { return nameIn(HB.masters.employeeById, id); }
  function unitName(id) { return nameIn(HB.masters.unitById, id); }
  function locName(id) { return nameIn(HB.masters.locationById, id); }
  function accountName(id) { return nameIn(HB.masters.accountById, id); }
  function categoryName(id) { return nameIn(HB.masters.categoryById, id); }
  function routeName(id) { return id ? nameIn(HB.masters.routeById, id) : ''; }
  function userName(id) { var u = HB.session.userById(id); return u ? u.name : (id ? String(id) : ''); }
  /**
   * Who entered a document or made an audit entry, by name: the persona, or the employee a seeded store document
   * names in its place (createdAs, receivedAs, userAs: the store's own manager). For display only; rights and
   * scope read the persona.
   */
  function whoName(userId, asEmployeeId) { return asEmployeeId ? employeeName(asEmployeeId) : userName(userId); }
  function payeeName(type, id) { return type === 'employee' ? employeeName(id) : vendorName(id); }
  function itemUnit(id) { var it = HB.masters.itemById[id]; return it ? it.unit || '' : ''; }

  /* --------------------------------------------------------------- lookup */
  /*
   * Masters as pages may show them: a copy with a display name, without what SPEC 5.1 keeps for the seed
   * (orderQty, leadDays, an item's vendorId, a customer's pattern) and without the salary for a role that may
   * not see it. An unknown id gives a record that names itself, so a page never has to test for null.
   */

  function unknown(id) { return { id: id, name: id === null || id === undefined ? '' : String(id), display: id === null || id === undefined ? '' : String(id), unknown: true }; }

  function itemView(it) {
    var fg = it.kind === 'fg';
    return {
      id: it.id, code: it.code || '', name: it.name, display: fg && it.pack ? it.name + ', ' + it.pack : it.name,
      kind: it.kind, kindLabel: KIND_LABEL[it.kind] || it.kind, unit: it.unit || '', pack: it.pack || '', hsn: it.hsn || '',
      gstRate: it.gstRate || 0, shelfLifeDays: fg ? it.shelfLifeDays : null,
      price: it.price ? { mrp: it.price.mrp, retail: it.price.retail, corporate: it.price.corporate } : null,
      reorderLevel: it.reorderLevel || 0, hasRecipe: !!HB.masters.recipeByItem[it.id], active: it.active !== false
    };
  }

  function customerView(cu) {
    var st = {}, k;
    for (k in cu.standing || {}) if (has.call(cu.standing, k)) st[k] = cu.standing[k];
    return {
      id: cu.id, name: cu.name, display: cu.locality ? cu.name + ', ' + cu.locality : cu.name,
      channel: cu.channel, channelLabel: channelLabel(cu.channel), outletType: cu.outletType || '',
      routeId: cu.routeId || null, routeName: routeName(cu.routeId), locality: cu.locality || '',
      terms: cu.terms, termsLabel: TERMS_LABEL[cu.terms] || cu.terms, creditDays: cu.creditDays || 0, creditLimit: cu.creditLimit || 0,
      gstin: cu.gstin || '', standing: st, active: cu.active !== false
    };
  }

  function vendorView(v) {
    return {
      id: v.id, name: v.name, display: v.town ? v.name + ', ' + v.town : v.name, kind: v.kind, town: v.town || '',
      gstin: v.gstin || '', termsDays: v.termsDays || 0, supplies: (v.supplies || []).slice(), active: v.active !== false
    };
  }

  function employeeView(e, salaries) {
    var out = {
      id: e.id, name: e.name, display: e.designation ? e.name + ', ' + e.designation : e.name, dept: e.dept || '',
      designation: e.designation || '', unitId: e.unitId, unitName: unitName(e.unitId), doj: e.doj || null, dol: e.dol || null,
      phone: e.phone || '', active: e.active !== false
    };
    if (salaries) out.salary = e.salary || 0;
    return out;
  }

  function unitView(u) {
    var st = {}, k;
    for (k in u.standing || {}) if (has.call(u.standing, k)) st[k] = u.standing[k];
    return {
      id: u.id, name: u.name, display: u.name, kind: u.kind, locId: u.locId || null, transitLocId: u.transitLocId || null,
      cashAccountId: u.cashAccountId || null, standing: st, active: u.active !== false
    };
  }

  function locationView(l) { return { id: l.id, name: l.name, display: l.name, kind: l.kind, unitId: l.unitId, unitName: unitName(l.unitId), active: l.active !== false }; }
  function accountView(a) { return { id: a.id, name: a.name, display: a.name, kind: a.kind, unitId: a.unitId || null, active: a.active !== false }; }
  function categoryView(k) { return { id: k.id, name: k.name, display: k.name, mode: k.mode, system: k.system || null, active: k.active !== false }; }
  function routeView(r) { return { id: r.id, name: r.name, display: r.name, stops: (r.stops || []).slice(), active: r.active !== false }; }
  function userView(u) {
    return { id: u.id, name: u.name, display: u.name + ' (' + u.roleLabel + ')', initials: u.initials, role: u.role, roleLabel: u.roleLabel, employeeId: u.employeeId, unitId: u.unitId };
  }

  function one(kind, index, id, view) {
    return memo('lookup.' + kind, String(id), function () {
      var r = HB.masters[index] ? HB.masters[index][id] : null;
      return r ? view(r) : unknown(id);
    });
  }

  /** Who may be shown a list of customers or of vendors: the roles that deal with them. */
  function listsCustomers() { return stamp().all || HB.session.partyKinds().indexOf('customers') !== -1 || sees('ar'); }
  function listsVendors() { return stamp().all || HB.session.partyKinds().indexOf('vendors') !== -1 || sees('purchase') || sees('bills'); }

  function activeWanted(f, rec) { return f && f.active === 'all' ? true : (rec.active !== false) === (f && f.active === false ? false : true); }

  var lookup = {
    item: function (id) { return one('item', 'itemById', id, itemView); },
    /* a role that deals with no customers or no vendors gets the name of one, not its terms, limit or GSTIN */
    customer: function (id) {
      return memo('lookup.customer', String(id), function () {
        var cu = HB.masters.customerById[id];
        if (!cu) return unknown(id);
        return listsCustomers() ? customerView(cu) : { id: cu.id, name: cu.name, display: cu.locality ? cu.name + ', ' + cu.locality : cu.name };
      });
    },
    vendor: function (id) {
      return memo('lookup.vendor', String(id), function () {
        var v = HB.masters.vendorById[id];
        if (!v) return unknown(id);
        return listsVendors() ? vendorView(v) : { id: v.id, name: v.name, display: v.town ? v.name + ', ' + v.town : v.name };
      });
    },
    employee: function (id) {
      return memo('lookup.employee', String(id), function () {
        var e = HB.masters.employeeById[id];
        return e ? employeeView(e, HB.session.canSeeSalaries()) : unknown(id);
      });
    },
    unit: function (id) { return one('unit', 'unitById', id, unitView); },
    location: function (id) { return one('location', 'locationById', id, locationView); },
    account: function (id) { return one('account', 'accountById', id, accountView); },
    category: function (id) { return one('category', 'categoryById', id, categoryView); },
    route: function (id) { return one('route', 'routeById', id, routeView); },
    /** Who entered a document, by name: the persona, or the store manager a seeded store document names (whoName). */
    enteredBy: function (d) { return d ? whoName(d.createdBy, d.createdAs) : ''; },
    user: function (id) {
      return memo('lookup.user', String(id), function () { var u = HB.session.userById(id); return u ? userView(u) : unknown(id); });
    },
    /** The payee of a payment or an expense: a vendor or an employee. */
    payee: function (payeeType, id) { return payeeType === 'employee' ? lookup.employee(id) : lookup.vendor(id); },
    /** A name by kind and id, for a cell: kind is item, customer, vendor, employee, unit, location, account, category, route or user. */
    name: function (kind, id) {
      switch (kind) {
        case 'item': return itemName(id);
        case 'customer': return customerName(id);
        case 'vendor': return vendorName(id);
        case 'employee': return employeeName(id);
        case 'unit': return unitName(id);
        case 'location': return locName(id);
        case 'account': return accountName(id);
        case 'category': return categoryName(id);
        case 'route': return routeName(id);
        case 'user': return userName(id);
        default: return id === null || id === undefined ? '' : String(id);
      }
    },

    /** Items by kind: f.kind is 'fg', 'rm', 'pk', 'material' (raw and packing) or a list; f.active true (default), false or 'all'. */
    items: function (f) {
      return memo('lookup.items', f || {}, function () {
        var kind = f && f.kind === 'material' ? ['rm', 'pk'] : (f ? f.kind : undefined);
        return HB.masters.items.filter(function (it) { return oneOf(kind, it.kind) && activeWanted(f, it); }).map(function (it) { return lookup.item(it.id); });
      });
    },
    /** Customers by channel and route; with a route, in the order of its stops, otherwise by name. */
    customers: function (f) {
      return memo('lookup.customers', f || {}, function () {
        if (!listsCustomers()) return [];
        var m = HB.masters, list = m.customers.filter(function (cu) {
          return oneOf(f ? f.channel : undefined, cu.channel) && oneOf(f ? f.routeId : undefined, cu.routeId) && activeWanted(f, cu);
        });
        var route = f && typeof f.routeId === 'string' ? m.routeById[f.routeId] : null;
        if (route) list.sort(function (a, b) { return route.stops.indexOf(a.id) - route.stops.indexOf(b.id); });
        else list.sort(function (a, b) { return a.name < b.name ? -1 : (a.name > b.name ? 1 : 0); });
        return list.map(function (cu) { return lookup.customer(cu.id); });
      });
    },
    /** Vendors by kind ('stock', 'expense', 'staff' or a list), by name. */
    vendors: function (f) {
      return memo('lookup.vendors', f || {}, function () {
        if (!listsVendors()) return [];
        return HB.masters.vendors.filter(function (v) { return oneOf(f ? f.kind : undefined, v.kind) && activeWanted(f, v); })
          .sort(function (a, b) { return a.name < b.name ? -1 : (a.name > b.name ? 1 : 0); })
          .map(function (v) { return lookup.vendor(v.id); });
      });
    },
    /** The units in scope (f.all: every unit, for a claim, which may be for any location); f.kind 'factory' or 'store'. */
    units: function (f) {
      return memo('lookup.units', f || {}, function (c) {
        return HB.masters.units.filter(function (u) { return (f && f.all ? true : unitOk(c, u.id)) && oneOf(f ? f.kind : undefined, u.kind) && activeWanted(f, u); })
          .map(function (u) { return lookup.unit(u.id); });
      });
    },
    /** The own stores the persona deals with: its own, or every store for a role that sends stock to them. */
    stores: function (f) {
      return memo('lookup.stores', f || {}, function (c) {
        return HB.masters.units.filter(function (u) { return u.kind === 'store' && storeOk(c, u) && activeWanted(f, u); }).map(function (u) { return lookup.unit(u.id); });
      });
    },
    /** The stock locations in scope; f.kind 'rm', 'fg', 'store', 'transit' or a list. */
    locations: function (f) {
      return memo('lookup.locations', f || {}, function (c) {
        return HB.masters.locations.filter(function (l) { return locOk(c, l.id) && oneOf(f ? f.kind : undefined, l.kind) && activeWanted(f, l); })
          .map(function (l) { return lookup.location(l.id); });
      });
    },
    /** The cash and bank accounts in scope; f.kind 'cash' or 'bank'. */
    accounts: function (f) {
      return memo('lookup.accounts', f || {}, function (c) {
        return HB.masters.accounts.filter(function (a) { return accountOk(c, a.id) && oneOf(f ? f.kind : undefined, a.kind) && activeWanted(f, a); })
          .map(function (a) { return lookup.account(a.id); });
      });
    },
    /** Expense categories a form may offer: f.mode 'claim' or 'bill' (a category of mode 'both' serves either). The two the engine posts to itself are left out unless f.system. */
    categories: function (f) {
      return memo('lookup.categories', f || {}, function () {
        return HB.masters.expenseCategories.filter(function (k) {
          if (!activeWanted(f, k)) return false;
          if (!(f && f.system) && (k.id === HB.masters.salaryCategoryId || k.id === HB.masters.shortExcessCategoryId)) return false;
          return !f || !f.mode || k.mode === 'both' || k.mode === f.mode;
        }).map(function (k) { return lookup.category(k.id); });
      });
    },
    routes: function () {
      return memo('lookup.routes', undefined, function () {
        return HB.masters.routes.filter(function (r) { return r.active !== false; }).map(function (r) { return lookup.route(r.id); });
      });
    },
    users: function () { return HB.session.users.map(function (u) { return lookup.user(u.id); }); },
    typeLabel: typeLabel,
    statusLabel: statusLabel,
    channelLabel: channelLabel,
    channels: function () { return CHANNELS.map(function (ch) { return { id: ch, name: CHANNEL_LABEL[ch] }; }); }
  };

  /** A store the persona deals with: in its unit scope, or one whose transit location it handles (stores send to every store). */
  function storeOk(c, u) { return c.all || c.sc.unit(u.id) || c.sc.loc(u.transitLocId); }

  /* ------------------------------------------------------- document rows */

  /** What every row of a document list starts with. `doc` is the live document: read-only. */
  function base(d) {
    return {
      id: d.id, type: d.type, typeLabel: docLabel(d), date: d.date, status: d.status, statusLabel: statusLabel(d.status),
      cancelled: d.status === 'CANCELLED', seed: !!d.seed, createdBy: d.createdBy || null, createdByName: whoName(d.createdBy, d.createdAs),
      createdAt: d.createdAt || '', note: d.note || '', doc: d
    };
  }

  function daysLate(due, today) { return due && due < today ? D.diffDays(due, today) : 0; }

  /** May the persona see this document at all? */
  function docVisible(d) {
    var c = stamp(), u;
    if (!d) return false;
    if (c.all) return true;
    switch (d.type) {
      case 'PO': case 'GRN': return sees('purchase');
      case 'VBILL': return sees('bills');
      case 'PAY': return sees('bills') || (d.payeeType === 'employee' && d.payeeId === c.user.employeeId);
      case 'PROD': return sees('production');
      case 'SO': case 'INV': case 'CN': return sees('sales') && c.sc.unit(FACTORY);
      case 'RCPT': return sees('ar');
      case 'XFER': u = HB.masters.unitById[d.toStoreId]; return sees('storeops') && !!u && storeOk(c, u);
      case 'DAYEND': return sees('storeops') && c.sc.unit(d.storeId);
      case 'DEP': return c.sc.account(d.fromAccount);
      case 'ADJ': return sees('counts') && c.sc.loc(d.locId);
      case 'WO': return c.sc.loc(d.locId); /* every role has stock-batches, where a write-off is asked for */
      case 'EXP': return expenseVisible(c, d);
      case 'CXL': return docVisible(c.book.docs[d.targetId]);
      default: return false; /* opening entries: the Owner and accounts */
    }
  }

  /** The expenses view of SPEC section 7: everything, the unit's claims and bills (never the salary bill), or the persona's own claims. */
  function expenseVisible(c, d) {
    var view = c.all ? 'all' : HB.session.expenseView(c.role);
    if (view === 'all') return true;
    if (d.kind === 'salary') return false;
    /* the seed raises the claims of every store under the one store-manager persona (the other stores have no
       persona): a seeded claim of another unit is that unit's, not hers, and stays outside her one store */
    if (d.kind === 'claim' && d.createdBy === c.userId && !(view === 'unit' && d.seed && !c.sc.unit(d.unitId))) return true;
    return view === 'unit' && c.sc.unit(d.unitId);
  }

  /* ================================================================ stock */

  /** The locations in scope a filter asks for: one id, a list, or ('', 'all', null) every one. */
  function locsWanted(c, locId) {
    return HB.masters.locations.filter(function (l) { return locOk(c, l.id) && oneOf(locId, l.id); });
  }

  /** One row per item kept at each location asked for: quantity, what is held, what can leave, value at today's cost. */
  function onHandRows(c, locId) {
    var b = c.book, m = HB.masters, E = HB.engine, today = c.today, out = [];
    var nearUntil = D.addDays(today, m.limits.nearExpiryDays);
    locsWanted(c, locId).forEach(function (loc) {
      var st = b.stock[loc.id] || {}, rs = b.reserved[loc.id] || {}, lotsBy = b.lots[loc.id] || {};
      m.items.forEach(function (it) {
        if ((loc.kind === 'rm') === (it.kind === 'fg')) return; /* materials are kept in the raw store, products everywhere else */
        var qty = st[it.id] || 0, reserved = rs[it.id] || 0;
        if (qty === 0 && reserved === 0 && (loc.kind === 'transit' || it.active === false)) return;
        var lots = lotsBy[it.id] || [], expired = 0, near = 0, i;
        for (i = 0; i < lots.length; i++) {
          if (lots[i].bestBefore < today) expired += lots[i].qty;
          else if (lots[i].bestBefore <= nearUntil) near += lots[i].qty;
        }
        /* goods on their way to a store are nobody's to take until the store confirms them */
        var available = loc.kind === 'transit' ? 0 : E.available(loc.id, it.id, today);
        var rate = E.unitCost(it.id), level = it.reorderLevel || 0;
        out.push({
          locId: loc.id, locName: loc.name, locKind: loc.kind, unitId: loc.unitId,
          itemId: it.id, itemName: it.name, code: it.code || '', kind: it.kind, unit: it.unit || '',
          qty: qty, reserved: reserved, available: available, expired: expired, nearExpiry: near, batches: lots.length,
          rate: rate, value: money.amount(qty, rate),
          reorderLevel: level, low: loc.id === RM && level > 0 && it.active !== false && available <= level
        });
      });
    });
    return out;
  }

  var FLAG_LABEL = { expired: 'Expired', near: 'Near expiry', ok: 'In date' };

  /** The finished-goods batches on hand, oldest first. A batch is near expiry within `days` of the business date. */
  function batchRows(c, f, days) {
    var b = c.book, m = HB.masters, E = HB.engine, today = c.today, out = [];
    var nearUntil = D.addDays(today, days);
    locsWanted(c, f.locId).forEach(function (loc) {
      if (loc.kind === 'rm') return;
      var lotsBy = b.lots[loc.id] || {};
      m.items.forEach(function (it) {
        var lots = it.kind === 'fg' && oneOf(f.itemId, it.id) ? lotsBy[it.id] : null;
        if (!lots || !lots.length) return;
        var rate = E.unitCost(it.id);
        for (var i = 0; i < lots.length; i++) {
          var lot = lots[i], flag = lot.bestBefore < today ? 'expired' : (lot.bestBefore <= nearUntil ? 'near' : 'ok');
          if (!oneOf(f.flag, flag)) continue;
          var made = b.batches[lot.batchId];
          out.push({
            batchId: lot.batchId, itemId: it.id, itemName: it.name, code: it.code || '', unit: it.unit || '',
            locId: loc.id, locName: loc.name, locKind: loc.kind, unitId: loc.unitId,
            mfgDate: lot.mfgDate, bestBefore: lot.bestBefore, daysLeft: D.diffDays(today, lot.bestBefore),
            qty: lot.qty, reserved: lot.reserved,
            available: loc.kind === 'transit' || flag === 'expired' ? 0 : lot.qty - lot.reserved,
            flag: flag, flagLabel: FLAG_LABEL[flag], rate: rate, value: money.amount(lot.qty, rate),
            prodId: made ? made.docId : null, canOpen: !!made && docVisible(b.docs[made.docId])
          });
        }
      });
    });
    out.sort(function (x, y) {
      if (x.bestBefore !== y.bestBefore) return x.bestBefore < y.bestBefore ? -1 : 1;
      if (x.mfgDate !== y.mfgDate) return x.mfgDate < y.mfgDate ? -1 : 1;
      if (x.batchId !== y.batchId) return x.batchId < y.batchId ? -1 : 1;
      return x.locId < y.locId ? -1 : (x.locId > y.locId ? 1 : 0);
    });
    return out;
  }

  function moveRow(c, m, balance) {
    var src = sourceOf(c, m.docId);
    return {
      seq: m.seq, date: m.date, docId: m.docId, refId: src ? src.id : m.docId, refType: src ? src.type : null,
      locId: m.locId, locName: locName(m.locId), itemId: m.itemId, itemName: itemName(m.itemId), unit: itemUnit(m.itemId),
      batchId: m.batchId || null, qty: m.qty, qtyIn: m.qty > 0 ? m.qty : 0, qtyOut: m.qty < 0 ? -m.qty : 0,
      kind: m.kind, kindLabel: MOVE_LABEL[m.kind] || m.kind, reversal: !!m.reversal, note: reversalNote(c, m), balance: balance,
      canOpen: docVisible(c.book.docs[m.docId]) /* a page links the id only when the persona may open it */
    };
  }

  /** The purchase orders that still expect goods. One pass over the orders per state of the book. */
  function openOrders() {
    return memo('buy.openOrders', undefined, function (c) {
      return c.book.byType.PO.filter(function (d) { return d.status === 'APPROVED' || d.status === 'PART_RECEIVED'; });
    });
  }

  /** A stock count or a write-off as a list row: where, why, what it is worth, and whether it waits or was refused. */
  function stockDocRow(d) {
    var r = base(d), loc = HB.masters.locationById[d.locId];
    r.locId = d.locId; r.locName = locName(d.locId); r.unitId = loc ? loc.unitId : null; r.reason = d.reason || '';
    r.value = d.value; r.lineCount = d.lines.length; r.sourceDocId = d.sourceDocId || null;
    r.waiting = d.status === 'PENDING'; r.rejectReason = d.approval && d.approval.state === 'rejected' ? d.approval.reason : '';
    return r;
  }

  var stock = {
    /** Stock at one location, a list of them, or (no argument, '', 'all') at every location in scope, item by item. */
    onHand: function (locId) {
      return memo('stock.onHand', locId || '', function (c) { return onHandRows(c, locId); });
    },

    /** Finished-goods batches on hand. f: { locId, itemId, flag: 'expired' | 'near' | 'ok' or a list }. */
    batches: function (f) {
      f = f || {};
      return memo('stock.batches', f, function (c) { return batchRows(c, f, HB.masters.limits.nearExpiryDays); });
    },

    /**
     * The movement ledger, by the row's own date. f: { from, to, locId, itemId, batchId, kind, docId, limit }.
     * With one location and one item it carries a running balance. At most `limit` rows are returned (default
     * 5000, 0 for all); count, qtyIn and qtyOut are of every row that matched.
     */
    ledger: function (f) {
      f = f || {};
      return memo('stock.ledger', f, function (c) {
        var r = rangeOf(f), b = c.book, m = HB.masters, limit = f.limit === undefined || f.limit === null ? ROW_LIMIT : +f.limit;
        var rows = [], count = 0, qtyIn = 0, qtyOut = 0, opening = null, bal = null;
        if (!sees('ledger')) return { from: r.from, to: r.to, rows: rows, count: 0, truncated: false, opening: null, closing: null, qtyIn: 0, qtyOut: 0 };
        /* a running balance means something for one real location and one real item only, with no cut by kind or document */
        var locId = oneId(f.locId), itemId = oneId(f.itemId);
        var single = !!locId && !!itemId && !!m.locationById[locId] && !!m.itemById[itemId] && locOk(c, locId) && noFilter(f.kind) && noFilter(f.docId);
        function wanted(x) {
          return oneOf(f.locId, x.locId) && oneOf(f.itemId, x.itemId) && oneOf(f.batchId, x.batchId) && oneOf(f.kind, x.kind) && oneOf(f.docId, x.docId);
        }
        if (single) {
          /* the quantity at the start of `from`: on hand now (of the batches asked for), less every row dated `from` or later */
          var now = 0;
          if (noFilter(f.batchId)) now = (b.stock[locId] || {})[itemId] || 0;
          else {
            var lots = (b.lots[locId] || {})[itemId] || [];
            for (var k = 0; k < lots.length; k++) if (oneOf(f.batchId, lots[k].batchId)) now += lots[k].qty;
          }
          eachDay(r.from, FAR, function (day) {
            for (var i = 0; i < day.moves.length; i++) if (wanted(day.moves[i])) now -= day.moves[i].qty;
          });
          opening = bal = q3(now);
        }
        eachDay(r.from, r.to, function (day) {
          var mv = day.moves;
          for (var i = 0; i < mv.length; i++) {
            var m = mv[i];
            if (!locOk(c, m.locId) || !wanted(m)) continue;
            count++;
            if (m.qty > 0) qtyIn += m.qty; else qtyOut -= m.qty;
            if (bal !== null) bal = q3(bal + m.qty);
            if (limit > 0 && rows.length >= limit) continue;
            rows.push(moveRow(c, m, bal));
          }
        });
        return { from: r.from, to: r.to, rows: rows, count: count, truncated: count > rows.length, opening: opening, closing: bal, qtyIn: q3(qtyIn), qtyOut: q3(qtyOut) };
      });
    },

    /**
     * Per location and item: the quantity at the start of the range, what came in, what went out, the quantity at
     * its end, and that closing quantity at today's cost. f: { from, to, locId, itemId, kind }.
     */
    statement: function (f) {
      f = f || {};
      return memo('stock.statement', f, function (c) {
        var r = rangeOf(f), b = c.book, m = HB.masters, E = HB.engine, cells = {}, rows = [], value = 0;
        /* a summary of the ledger: for a role with the ledger page, or with the reports page */
        if (!sees('ledger') && !sees('reports')) return { from: r.from, to: r.to, rows: rows, totals: { value: 0 } };
        function cell(locId, itemId) {
          var byItem = cells[locId] || (cells[locId] = {});
          return byItem[itemId] || (byItem[itemId] = { qtyIn: 0, qtyOut: 0, after: 0 });
        }
        eachDay(r.from, FAR, function (day) {
          var mv = day.moves, late = day.date > r.to;
          for (var i = 0; i < mv.length; i++) {
            var x = mv[i];
            if (!locOk(c, x.locId) || !oneOf(f.locId, x.locId) || !oneOf(f.itemId, x.itemId)) continue;
            var t = cell(x.locId, x.itemId);
            if (late) t.after += x.qty;
            else if (x.qty > 0) t.qtyIn += x.qty;
            else t.qtyOut -= x.qty;
          }
        });
        locsWanted(c, f.locId).forEach(function (loc) {
          var st = b.stock[loc.id] || {}, moved = cells[loc.id] || {};
          m.items.forEach(function (it) {
            if (!oneOf(f.itemId, it.id) || !oneOf(f.kind, it.kind)) return;
            var t = moved[it.id], now = st[it.id] || 0;
            if (!t && now === 0) return;
            t = t || { qtyIn: 0, qtyOut: 0, after: 0 };
            var closing = q3(now - t.after), qtyIn = q3(t.qtyIn), qtyOut = q3(t.qtyOut), opening = q3(closing - qtyIn + qtyOut);
            if (opening === 0 && qtyIn === 0 && qtyOut === 0 && closing === 0) return;
            var rate = E.unitCost(it.id), v = money.amount(closing, rate);
            value += v;
            rows.push({
              locId: loc.id, locName: loc.name, itemId: it.id, itemName: it.name, kind: it.kind, unit: it.unit || '',
              opening: opening, qtyIn: qtyIn, qtyOut: qtyOut, closing: closing, rate: rate, value: v
            });
          });
        });
        return { from: r.from, to: r.to, rows: rows, totals: { value: value } };
      });
    },

    /** Materials and packing at or below their reorder level. An alert only: no quantity to order is suggested. */
    lowStock: function () {
      return memo('stock.lowStock', undefined, function (c) {
        if (!locOk(c, RM)) return [];
        var onOrder = {}, ids = {}, showOrders = sees('purchase');
        openOrders().forEach(function (po) {
          po.lines.forEach(function (l) {
            var left = q3(l.qty - l.received);
            if (left <= 0) return;
            onOrder[l.itemId] = q3((onOrder[l.itemId] || 0) + left);
            (ids[l.itemId] || (ids[l.itemId] = [])).push(po.id);
          });
        });
        return onHandRows(c, RM).filter(function (x) { return x.low; }).map(function (x) {
          return {
            itemId: x.itemId, itemName: x.itemName, code: x.code, kind: x.kind, unit: x.unit, qty: x.qty, reserved: x.reserved,
            available: x.available, reorderLevel: x.reorderLevel, onOrder: onOrder[x.itemId] || 0,
            orderIds: showOrders ? (ids[x.itemId] || []) : []
          };
        });
      });
    },

    /** Batches on hand that are past their best-before date or within `days` of it (default limits.nearExpiryDays). */
    expiring: function (days) {
      var n = days === undefined || days === null ? HB.masters.limits.nearExpiryDays : +days;
      return memo('stock.expiring', n, function (c) { return batchRows(c, { flag: ['expired', 'near'] }, n); });
    },

    /** The value of the stock in scope at today's cost: materials at latest purchase price, products at recipe cost. */
    value: function () {
      return memo('stock.value', undefined, function (c) {
        var byLoc = {}, out = { total: 0, materials: 0, packing: 0, finished: 0, rows: [] };
        onHandRows(c, null).forEach(function (x) {
          var t = byLoc[x.locId] || (byLoc[x.locId] = { locId: x.locId, locName: x.locName, kind: x.locKind, unitId: x.unitId, value: 0 });
          t.value += x.value;
          out.total += x.value;
          if (x.kind === 'fg') out.finished += x.value; else if (x.kind === 'pk') out.packing += x.value; else out.materials += x.value;
        });
        HB.masters.locations.forEach(function (l) { if (byLoc[l.id]) out.rows.push(byLoc[l.id]); });
        return out;
      });
    },

    /** Stock counts, newest first, at the locations the persona may see counts of. f: { from, to, status, locId, reason }. */
    counts: function (f) {
      f = f || {};
      return memo('stock.counts', f, function () {
        return docsIn('ADJ', f, function (d) { return docVisible(d) && oneOf(f.locId, d.locId) && oneOf(f.reason, d.reason); }).map(stockDocRow);
      });
    },

    /** Write-off requests, newest first, at the locations in scope. f: { from, to, status, locId, reason, sourceDocId }. */
    writeOffs: function (f) {
      f = f || {};
      return memo('stock.writeOffs', f, function () {
        return docsIn('WO', f, function (d) { return docVisible(d) && oneOf(f.locId, d.locId) && oneOf(f.reason, d.reason) && oneOf(f.sourceDocId, d.sourceDocId || null); }).map(stockDocRow);
      });
    },

    /** The kinds of stock movement with the label a ledger row carries, for a filter on `kind`: [{ id, name }]. */
    kinds: function () {
      return Object.keys(MOVE_LABEL).map(function (k) { return { id: k, name: MOVE_LABEL[k] }; });
    }
  };

  /* ================================================================== buy */

  function poRow(c, d) {
    var r = base(d), got = 0, i, l;
    for (i = 0; i < d.lines.length; i++) { l = d.lines[i]; got += l.received >= l.qty ? l.amount : money.amount(l.received, l.rate); }
    var open = d.status === 'APPROVED' || d.status === 'PART_RECEIVED';
    r.vendorId = d.vendorId; r.vendorName = vendorName(d.vendorId); r.expectedDate = d.expectedDate; r.total = d.total;
    r.lineCount = d.lines.length; r.receivedValue = got; r.receivedPct = ratio(got, d.total);
    r.open = open; r.late = open && d.expectedDate < c.today; r.daysLate = open ? daysLate(d.expectedDate, c.today) : 0;
    r.waiting = d.status === 'PENDING'; r.grnIds = d.grnIds.slice();
    return r;
  }

  function grnRow(d) {
    var r = base(d), value = 0, rejected = false, i;
    for (i = 0; i < d.lines.length; i++) { value += money.amount(d.lines[i].qty, d.lines[i].rate); if (d.lines[i].rejectedQty > 0) rejected = true; }
    r.poId = d.poId; r.vendorId = d.vendorId; r.vendorName = vendorName(d.vendorId); r.billId = d.billId || null;
    r.billed = !!d.billId; r.lineCount = d.lines.length; r.value = value; r.hasRejected = rejected;
    return r;
  }

  /** An order that still expects goods, with the lines that have something to come (`on`: the day lateness is counted to). */
  function toComeRow(d, on) {
    var r = base(d);
    r.vendorId = d.vendorId; r.vendorName = vendorName(d.vendorId); r.expectedDate = d.expectedDate;
    r.daysLate = daysLate(d.expectedDate, on); r.total = d.total;
    r.lines = d.lines.filter(function (l) { return l.received < l.qty; }).map(function (l) {
      return { itemId: l.itemId, itemName: itemName(l.itemId), unit: itemUnit(l.itemId), qty: l.qty, received: l.received, toCome: q3(l.qty - l.received), rate: l.rate };
    });
    return r;
  }

  function billOpen(d) { return d.status === 'POSTED' ? d.total - d.paid : 0; }

  function billRow(c, d) {
    var r = base(d), open = billOpen(d);
    r.vendorId = d.vendorId; r.vendorName = vendorName(d.vendorId); r.billNo = d.billNo; r.grnIds = d.grnIds.slice();
    r.taxable = d.taxable; r.gst = d.gst; r.total = d.total; r.paid = d.paid; r.open = open; r.dueDate = d.dueDate;
    r.overdue = open > 0 && d.dueDate < c.today; r.daysOverdue = open > 0 ? daysLate(d.dueDate, c.today) : 0;
    r.matchOk = !!(d.match && d.match.ok); r.holdReason = d.holdReason || ''; r.opening = !!d.opening;
    return r;
  }

  function payRow(c, d) {
    var r = base(d), kinds = {}, i, t;
    r.allocations = d.allocations.map(function (a) {
      t = c.book.docs[a.docId];
      kinds[t && t.type === 'EXP' ? t.kind : 'vendor_bill'] = 1;
      return { docId: a.docId, type: t ? t.type : null, typeLabel: docLabel(t), amount: a.amount };
    });
    i = Object.keys(kinds);
    r.payeeType = d.payeeType; r.payeeId = d.payeeId; r.payeeName = payeeName(d.payeeType, d.payeeId);
    r.account = d.account; r.accountName = accountName(d.account); r.amount = d.amount; r.ref = d.ref || '';
    /* what the payment settles: 'vendor_bill', 'claim', 'bill' (an expense bill), 'salary', or 'mixed' */
    r.paysFor = i.length === 1 ? i[0] : 'mixed';
    return r;
  }

  function lineCgst(lines) { var t = 0; for (var i = 0; i < lines.length; i++) t += lines[i].cgst || 0; return t; }
  function lineSgst(lines) { var t = 0; for (var i = 0; i < lines.length; i++) t += lines[i].sgst || 0; return t; }

  var buy = {
    /** Purchase orders, newest first. f: { from, to, status, vendorId, open: true for those still expecting goods }. */
    orders: function (f) {
      f = f || {};
      return memo('buy.orders', f, function (c) {
        if (!sees('purchase')) return [];
        return docsIn('PO', f, function (d) {
          return oneOf(f.vendorId, d.vendorId) && (!f.open || d.status === 'APPROVED' || d.status === 'PART_RECEIVED');
        }).map(function (d) { return poRow(c, d); });
      });
    },

    /** Goods receipts, newest first. f: { from, to, status, vendorId, poId, unbilled: true }. */
    receipts: function (f) {
      f = f || {};
      return memo('buy.receipts', f, function () {
        if (!sees('purchase')) return [];
        return docsIn('GRN', f, function (d) {
          return oneOf(f.vendorId, d.vendorId) && oneOf(f.poId, d.poId) && (!f.unbilled || (d.status === 'POSTED' && !d.billId));
        }).map(grnRow);
      });
    },

    /** Vendor bills, newest first. f: { from, to, status, vendorId, open: true for those with something left to pay }. */
    bills: function (f) {
      f = f || {};
      return memo('buy.bills', f, function (c) {
        if (!sees('bills')) return [];
        return docsIn('VBILL', f, function (d) { return oneOf(f.vendorId, d.vendorId) && (!f.open || billOpen(d) > 0); })
          .map(function (d) { return billRow(c, d); });
      });
    },

    /** Payments to vendors and employees, newest first. f: { from, to, status, payeeType, payeeId, account }. */
    payments: function (f) {
      f = f || {};
      return memo('buy.payments', f, function (c) {
        if (!sees('bills')) return [];
        return docsIn('PAY', f, function (d) { return oneOf(f.payeeType, d.payeeType) && oneOf(f.payeeId, d.payeeId) && oneOf(f.account, d.account); })
          .map(function (d) { return payRow(c, d); });
      });
    },

    /** Orders approved and still expecting goods, expected on or before `date` (default: the business date). */
    dueForReceipt: function (date) {
      var on = date || HB.calendar.today;
      return memo('buy.dueForReceipt', on, function () {
        if (!sees('purchase')) return [];
        return openOrders().filter(function (d) { return d.expectedDate <= on; }).map(function (d) { return toComeRow(d, on); })
          .sort(function (a, b) { return a.expectedDate < b.expectedDate ? -1 : (a.expectedDate > b.expectedDate ? 1 : a.doc.seq - b.doc.seq); });
      });
    },

    /**
     * One order that still expects goods, with the lines a goods receipt form prefills: what is still to come on
     * each, at the order's rate. null when the order is not APPROVED or PART_RECEIVED (or is not an order).
     */
    toReceive: function (poId) {
      return memo('buy.toReceive', String(poId), function (c) {
        if (!sees('purchase')) return null;
        var d = c.book.docs[poId];
        if (!d || d.type !== 'PO' || (d.status !== 'APPROVED' && d.status !== 'PART_RECEIVED')) return null;
        return toComeRow(d, c.today);
      });
    },

    /** Posted receipts that are on no bill, of one vendor or (no argument) of every vendor: what a bill can be entered for. */
    openReceipts: function (vendorId) {
      return memo('buy.openReceipts', vendorId || '', function (c) {
        if (!sees('purchase') && !sees('bills')) return [];
        var out = [];
        HB.masters.vendors.forEach(function (v) {
          if (!oneOf(vendorId, v.id)) return;
          (c.book.unbilled[v.id] || []).forEach(function (d) {
            var r = grnRow(d), po = c.book.docs[d.poId];
            r.lines = d.lines.filter(function (l) { return l.qty > 0; }).map(function (l) {
              var gst = 0, i;
              for (i = 0; po && i < po.lines.length; i++) if (po.lines[i].itemId === l.itemId) gst = po.lines[i].gstRate || 0;
              return { itemId: l.itemId, itemName: itemName(l.itemId), unit: itemUnit(l.itemId), qty: l.qty, rate: l.rate, gstRate: gst, amount: money.amount(l.qty, l.rate) };
            });
            out.push(r);
          });
        });
        return out;
      });
    },

    /**
     * The purchase register: one row per vendor bill on the day its payable is dated (opening bills excluded),
     * a cancellation as a negative row on its own date. f: { from, to, vendorId }.
     */
    register: function (f) {
      f = f || {};
      return memo('buy.register', f, function (c) {
        var r = rangeOf(f), rows = [], totals = { taxable: 0, cgst: 0, sgst: 0, gst: 0, total: 0 };
        if (sees('bills')) {
          eachDay(r.from, r.to, function (day) {
            for (var i = 0; i < day.ap.length; i++) {
              var x = day.ap[i];
              if (x.kind !== 'bill') continue;
              var t = sourceOf(c, x.docId);
              if (!t || t.opening || !oneOf(f.vendorId, t.vendorId)) continue;
              var sign = x.reversal ? -1 : 1;
              var row = {
                seq: x.seq, date: x.date, docId: x.docId, billId: t.id, billNo: t.billNo, vendorId: t.vendorId, vendorName: vendorName(t.vendorId),
                taxable: sign * t.taxable, cgst: sign * lineCgst(t.lines), sgst: sign * lineSgst(t.lines), gst: sign * t.gst, total: x.amount,
                reversal: !!x.reversal, note: reversalNote(c, x)
              };
              rows.push(row);
              totals.taxable += row.taxable; totals.cgst += row.cgst; totals.sgst += row.sgst; totals.gst += row.gst; totals.total += row.total;
            }
          });
        }
        return { from: r.from, to: r.to, rows: rows, totals: totals };
      });
    }
  };

  /* ================================================================= make */

  function prodRow(d) {
    var r = base(d), mat = 0, i;
    for (i = 0; i < d.consumption.length; i++) mat += d.consumption[i].value;
    r.itemId = d.itemId; r.itemName = itemName(d.itemId); r.unit = itemUnit(d.itemId); r.mixes = d.mixes;
    r.expectedUnits = d.expectedUnits; r.goodUnits = d.goodUnits; r.rejectedUnits = d.rejectedUnits;
    r['yield'] = ratio(d.goodUnits, d.expectedUnits); r.batchId = d.batchId; r.bestBefore = d.bestBefore;
    r.unitCost = d.unitCost; r.materialCost = mat; r.lossValue = d.lossValue;
    return r;
  }

  function rhythmLabel(rh) {
    if (rh === 'daily' || rh === undefined || rh === null) return 'Every day';
    if (!Array.isArray(rh)) return String(rh);
    return rh.map(function (d) { return D.DOWS[d]; }).join(', ');
  }

  function runsOn(rec, date) {
    var rh = rec.rhythm;
    if (rh === 'daily' || rh === undefined || rh === null) return true;
    return Array.isArray(rh) && rh.indexOf(D.dow(date)) !== -1;
  }

  var make = {
    /** Production entries, newest first. f: { from, to, status, itemId }. */
    entries: function (f) {
      f = f || {};
      return memo('make.entries', f, function () {
        if (!sees('production')) return [];
        return docsIn('PROD', f, function (d) { return oneOf(f.itemId, d.itemId); }).map(prodRow);
      });
    },

    /**
     * One production entry as a row of `entries`, from the document itself: also the document that
     * HB.engine.preview('PROD', ...) returns, so a form shows the yield before posting. null for any other document.
     */
    entryOf: function (doc) {
      return doc && doc.type === 'PROD' && Array.isArray(doc.consumption) && sees('production') ? prodRow(doc) : null;
    },

    /**
     * Yield by product for the range: what the recipe expected against the good units, and the production loss.
     * An entry counts on its date and a cancellation takes it back on the date of the cancellation. f: { from, to, itemId }.
     */
    yieldByItem: function (f) {
      f = f || {};
      return memo('make.yieldByItem', f, function (c) {
        var r = rangeOf(f), acc = {}, rows = [];
        var totals = { runs: 0, mixes: 0, expectedUnits: 0, goodUnits: 0, rejectedUnits: 0, lossValue: 0, 'yield': null };
        if (sees('production')) {
          eachDay(r.from, r.to, function (day) {
            for (var i = 0; i < day.docs.length; i++) {
              var d = day.docs[i], t = null, sign = 1;
              if (d.type === 'PROD') t = d;
              else if (d.type === 'CXL' && d.targetType === 'PROD') { t = c.book.docs[d.targetId]; sign = -1; }
              if (!t || !oneOf(f.itemId, t.itemId)) continue;
              var a = acc[t.itemId] || (acc[t.itemId] = { runs: 0, mixes: 0, expectedUnits: 0, goodUnits: 0, rejectedUnits: 0, lossValue: 0 });
              a.runs += sign; a.mixes = q3(a.mixes + sign * t.mixes); a.expectedUnits = q3(a.expectedUnits + sign * t.expectedUnits);
              a.goodUnits += sign * t.goodUnits; a.rejectedUnits += sign * t.rejectedUnits; a.lossValue += sign * t.lossValue;
            }
          });
          HB.masters.items.forEach(function (it) {
            var a = acc[it.id];
            if (!a) return;
            rows.push({
              itemId: it.id, itemName: it.name, unit: it.unit || '', runs: a.runs, mixes: a.mixes, expectedUnits: a.expectedUnits,
              goodUnits: a.goodUnits, rejectedUnits: a.rejectedUnits, 'yield': ratio(a.goodUnits, a.expectedUnits), lossValue: a.lossValue
            });
            totals.runs += a.runs; totals.mixes = q3(totals.mixes + a.mixes); totals.expectedUnits = q3(totals.expectedUnits + a.expectedUnits);
            totals.goodUnits += a.goodUnits; totals.rejectedUnits += a.rejectedUnits; totals.lossValue += a.lossValue;
          });
          totals['yield'] = ratio(totals.goodUnits, totals.expectedUnits);
        }
        return { from: r.from, to: r.to, rows: rows, totals: totals };
      });
    },

    /**
     * Production still to record for a date (default: the business date): the standard day plan - every recipe
     * whose rhythm includes that weekday, at its standard mixes - less the products that already have an
     * uncancelled entry dated that day. Nothing in it depends on demand, orders or stock.
     */
    todo: function (date) {
      var on = date || HB.calendar.today;
      return memo('make.todo', on, function (c) {
        if (!sees('production')) return [];
        var done = {}, day = c.book.days[on], out = [];
        if (day) day.docs.forEach(function (d) { if (d.type === 'PROD' && d.status !== 'CANCELLED') done[d.itemId] = true; });
        HB.masters.recipes.forEach(function (rec) {
          var it = HB.masters.itemById[rec.itemId];
          if (!it || it.active === false || done[rec.itemId] || !(rec.standardMixes > 0) || !runsOn(rec, on)) return;
          out.push({
            itemId: it.id, itemName: it.name, unit: it.unit || '', mixLabel: rec.mixLabel || '',
            standardMixes: rec.standardMixes, expectedUnitsPerMix: rec.expectedUnits
          });
        });
        return out;
      });
    },

    /** The cost sheet of a product at today's prices, with its price and margin by channel; null without a recipe. */
    costSheet: function (itemId) {
      return memo('make.costSheet', String(itemId), function () {
        if (!sees('recipes') && !sees('production')) return null;
        var s = HB.engine.costSheet(itemId), it = HB.masters.itemById[itemId], out = {}, k;
        if (!s || !it) return null;
        for (k in s) if (has.call(s, k)) out[k] = s[k];
        var rate = it.gstRate || 0, p = it.price || {}, mrp = p.mrp || 0;
        /* MRP includes GST: what the store keeps is the MRP less the tax inside it, by the day-end's own formula */
        var net = mrp - 2 * Math.round(mrp * rate / (2 * (100 + rate)));
        function channel(ch, price) {
          var margin = Math.round((price - s.unitCost) * 10000) / 10000;
          return { channel: ch, label: CHANNEL_LABEL[ch], price: price, margin: margin, marginPct: ratio(margin, price) };
        }
        out.unit = it.unit || ''; out.gstRate = rate; out.mrp = mrp;
        out.channels = [channel('retail', p.retail || 0), channel('corporate', p.corporate || 0), channel('store', net)];
        return out;
      });
    },

    /** Every recipe with its materials at today's prices and the unit cost that follows. */
    recipes: function () {
      return memo('make.recipes', undefined, function () {
        if (!sees('recipes') && !sees('production')) return [];
        return HB.masters.recipes.map(function (rec) {
          var it = HB.masters.itemById[rec.itemId] || { id: rec.itemId, name: rec.itemId }, s = HB.engine.costSheet(rec.itemId) || {};
          return {
            itemId: rec.itemId, itemName: it.name, unit: it.unit || '', active: it.active !== false, mixLabel: rec.mixLabel || '',
            expectedUnits: rec.expectedUnits, rhythm: rec.rhythm === undefined ? 'daily' : rec.rhythm, rhythmLabel: rhythmLabel(rec.rhythm),
            standardMixes: rec.standardMixes, materials: s.materials || [], packing: s.packing || [],
            mixCost: s.mixCost || 0, materialPerUnit: s.materialPerUnit || 0, packingPerUnit: s.packingPerUnit || 0, unitCost: s.unitCost || 0
          };
        });
      });
    }
  };

  /* ================================================================= sell */

  function invRow(c, d) {
    var r = base(d), open = d.status === 'POSTED' ? HB.engine.openAmount(d) : 0;
    r.customerId = d.customerId; r.customerName = customerName(d.customerId); r.channel = d.channel; r.channelLabel = channelLabel(d.channel);
    r.routeId = d.routeId || null; r.routeName = routeName(d.routeId); r.sheetId = d.sheetId || null; r.soId = d.soId || null;
    r.terms = d.terms; r.dueDate = d.dueDate; r.units = d.units; r.taxable = d.taxable; r.gst = d.gst; r.total = d.total;
    if (sees('margin')) r.cost = d.cost; /* cost and margin of an invoice: the Owner and accounts. Absent for the others, as a salary is */
    r.paidNow = d.paidNow; r.creditApplied = d.creditApplied; r.received = d.received; r.credited = d.credited; r.open = open;
    r.overdue = open > 0 && d.dueDate < c.today; r.daysOverdue = open > 0 ? daysLate(d.dueDate, c.today) : 0; r.opening = !!d.opening;
    return r;
  }

  function soRow(c, d) {
    var r = base(d), units = 0, value = 0, i;
    for (i = 0; i < d.lines.length; i++) { units += d.lines[i].qty; value += money.amount(d.lines[i].qty, d.lines[i].price); }
    r.customerId = d.customerId; r.customerName = customerName(d.customerId); r.deliveryDate = d.deliveryDate; r.poRef = d.poRef || '';
    r.lineCount = d.lines.length; r.units = units; r.value = value; r.invId = d.invId || null;
    r.due = d.status === 'OPEN' && d.deliveryDate <= c.today; /* to deliver and invoice today or earlier */
    return r;
  }

  function cnRow(d) {
    var r = base(d);
    r.customerId = d.customerId; r.customerName = customerName(d.customerId); r.channel = d.channel; r.channelLabel = channelLabel(d.channel);
    r.units = d.units; r.taxable = d.taxable; r.gst = d.gst; r.total = d.total; r.sharePct = d.sharePct;
    r.limitPct = HB.masters.limits.returnsPct; r.holdReason = d.holdReason || '';
    r.allocated = sumOf(d.allocations || [], 'amount'); r.onAccount = d.onAccount || 0;
    return r;
  }

  function rcptRow(d) {
    var r = base(d);
    r.customerId = d.customerId; r.customerName = customerName(d.customerId); r.account = d.account; r.accountName = accountName(d.account);
    r.mode = d.mode || ''; r.amount = d.amount; r.allocated = sumOf(d.allocations || [], 'amount'); r.onAccount = d.onAccount || 0;
    return r;
  }

  /** The invoices of a customer, oldest first, each with the route it was raised on: where the outlet was at the time. */
  function invoiceRoutes(c, customerId) {
    return memo('sell.invoiceRoutes', customerId, function () {
      var rows = c.book.ar.byParty[customerId] || [], out = [], i, d;
      for (i = 0; i < rows.length; i++) {
        if (rows[i].kind !== 'invoice' || rows[i].reversal) continue;
        d = c.book.docs[rows[i].docId];
        if (d && d.type === 'INV') out.push({ date: d.date, seq: d.seq, routeId: d.routeId || null });
      }
      return out.sort(byDateSeq);
    });
  }

  /**
   * The route a sale belongs to: the invoice's own. A stale return or a receipt carries no route, so it takes the
   * route of the outlet's latest invoice dated on or before it - the route the outlet was on when it was raised,
   * which moving the outlet to another route later does not rewrite - and, before any invoice, the outlet's route now.
   */
  function routeOfDoc(c, d) {
    if (!d) return null;
    if (d.type === 'INV') return d.routeId || null;
    if (!d.customerId) return null;
    var list = invoiceRoutes(c, d.customerId), i, x;
    for (i = list.length - 1; i >= 0; i--) {
      x = list[i];
      if (x.date < d.date || (x.date === d.date && x.seq < d.seq)) return x.routeId;
    }
    var cu = HB.masters.customerById[d.customerId];
    return cu ? cu.routeId || null : null;
  }

  /**
   * fn(row) for every sales, returns and cost-of-goods row dated in the range, inside the scope and the filter
   * { from, to, unitIds, unitId, channel, customerId, routeId }. Rows, not documents: a cancellation is the
   * negative row it wrote on its own date.
   */
  function eachSalesRow(c, f, fn) {
    var r = rangeOf(f);
    if (!sees('sales')) return r;
    var byDoc = !noFilter(f.customerId) || !noFilter(f.routeId);
    eachDay(r.from, r.to, function (day) {
      var p = day.pnl;
      for (var i = 0; i < p.length; i++) {
        var x = p[i];
        if (x.line !== 'sales' && x.line !== 'returns' && x.line !== 'cogs') continue;
        if (!unitWanted(c, f, x.unitId) || !oneOf(f.channel, x.channel)) continue;
        if (byDoc) {
          var src = sourceOf(c, x.docId);
          if (!src || !oneOf(f.customerId, src.customerId) || !oneOf(f.routeId, routeOfDoc(c, src))) continue;
        }
        fn(x);
      }
    });
    return r;
  }

  function newAgg() { return { units: 0, sales: 0, returns: 0, returnUnits: 0, cogs: 0 }; }

  function addRow(a, x) {
    if (x.line === 'sales') { a.sales += x.amount; a.units += x.qty; }
    else if (x.line === 'returns') { a.returns += x.amount; a.returnUnits -= x.qty; }
    else a.cogs += x.amount;
  }

  /** net = sales + returns (returns are zero or less); margin = net - cost of goods sold. */
  function finish(a) {
    a.net = a.sales + a.returns;
    a.margin = a.net - a.cogs;
    a.marginPct = ratio(a.margin, a.net);
    return a;
  }

  /** Collections = cash taken on delivery (paidNow) + receipts, by the cash row's own date. */
  function collections(c, f) {
    var r = rangeOf(f), out = { total: 0, cash: 0, bank: 0 };
    if (!sees('ar') || !unitWanted(c, f, FACTORY)) return out;
    var byDoc = !noFilter(f.customerId) || !noFilter(f.routeId) || !noFilter(f.channel);
    eachDay(r.from, r.to, function (day) {
      for (var i = 0; i < day.cash.length; i++) {
        var x = day.cash[i];
        if (x.kind !== 'collected' && x.kind !== 'receipt') continue;
        if (byDoc) {
          /* the route as the sales figures take it (routeOfDoc), so collections by route agree with sales by route */
          var src = sourceOf(c, x.docId), cu = src ? HB.masters.customerById[src.customerId] : null;
          if (!cu || !oneOf(f.customerId, cu.id) || !oneOf(f.routeId, routeOfDoc(c, src)) || !oneOf(f.channel, src.channel || cu.channel)) continue;
        }
        out.total += x.amount;
        if (x.accountId === BANK) out.bank += x.amount; else out.cash += x.amount;
      }
    });
    return out;
  }

  /**
   * The channels a role and a filter can show at all: retail and corporate are sold by the factory, the store
   * channel by the stores. Listed even with nothing sold, so that a tile or a bar has its place on a quiet day.
   */
  function channelsWanted(c, f) {
    if (!sees('sales')) return [];
    var store = HB.masters.units.some(function (u) { return u.kind === 'store' && unitWanted(c, f, u.id); });
    return CHANNELS.filter(function (ch) { return oneOf(f.channel, ch) && (ch === 'store' ? store : unitWanted(c, f, FACTORY)); });
  }

  /**
   * 'DS-<routeId>-<YYMMDD>' -> { routeId, date }, or null when it names no route or no day. A dispatch sheet is
   * not a document of the book: its id, made by HB.engine.sheetId, is all there is to resolve.
   */
  function sheetKey(id) {
    var s = String(id === undefined || id === null ? '' : id), m = /^DS-(.+)-(\d\d)(\d\d)(\d\d)$/.exec(s);
    if (!m || !HB.masters.routeById[m[1]]) return null;
    var date = '20' + m[2] + '-' + m[3] + '-' + m[4];
    return D.isIso(date) && HB.engine.sheetId(m[1], date) === s ? { routeId: m[1], date: date } : null;
  }

  /**
   * Can a sheet of this day be posted by the persona in use, the sheet of a posted one once it is cancelled? The
   * engine's date rules for the day and nothing else (HB.engine.dateCheck): { ok, code, reason, owner }. code
   * 'locked_month': nobody can, the Owner included; 'backdate_limit': the day is further back than this role may go,
   * and owner says the Owner still can. What a screen tells before a sheet is cancelled, not after.
   */
  function sheetRepost(date) {
    var mine = HB.engine.dateCheck(date);
    if (mine.ok) return { ok: true, code: '', reason: '', owner: true };
    return { ok: false, code: mine.error.code, reason: mine.error.message, owner: HB.engine.dateCheck(date, 'owner').ok };
  }

  var DIMS =['item', 'customer', 'route', 'channel', 'unit', 'day', 'month'];

  var sell = {
    /** Invoices, newest first. f: { from, to, status, customerId, channel, routeId, sheetId, open: true, opening: false to leave opening invoices out }. */
    invoices: function (f) {
      f = f || {};
      return memo('sell.invoices', f, function (c) {
        if (!sees('sales') || !unitOk(c, FACTORY)) return [];
        return docsIn('INV', f, function (d) {
          return oneOf(f.customerId, d.customerId) && oneOf(f.channel, d.channel) && oneOf(f.routeId, d.routeId) && oneOf(f.sheetId, d.sheetId) &&
            (!f.open || (d.status === 'POSTED' && HB.engine.openAmount(d) > 0)) && (f.opening !== false || !d.opening);
        }).map(function (d) { return invRow(c, d); });
      });
    },

    /** Sales orders, newest first. f: { from, to, status, customerId }. */
    orders: function (f) {
      f = f || {};
      return memo('sell.orders', f, function (c) {
        if (!sees('sales') || !unitOk(c, FACTORY)) return [];
        return docsIn('SO', f, function (d) { return oneOf(f.customerId, d.customerId); }).map(function (d) { return soRow(c, d); });
      });
    },

    /** Stale returns (credit notes), newest first. f: { from, to, status, customerId, channel }. */
    creditNotes: function (f) {
      f = f || {};
      return memo('sell.creditNotes', f, function (c) {
        if (!sees('sales') || !unitOk(c, FACTORY)) return [];
        return docsIn('CN', f, function (d) { return oneOf(f.customerId, d.customerId) && oneOf(f.channel, d.channel); }).map(cnRow);
      });
    },

    /** Receipts from customers, newest first. f: { from, to, status, customerId, account }. */
    receipts: function (f) {
      f = f || {};
      return memo('sell.receipts', f, function () {
        if (!sees('ar')) return [];
        return docsIn('RCPT', f, function (d) { return oneOf(f.customerId, d.customerId) && oneOf(f.account, d.account); }).map(rcptRow);
      });
    },

    /** The dispatch sheet of every route for a date (default: the business date): posted, or still to post. */
    sheets: function (date) {
      var on = date || HB.calendar.today;
      return memo('sell.sheets', on, function (c) {
        if (!sees('sales') || !unitOk(c, FACTORY)) return [];
        var m = HB.masters;
        return m.routes.filter(function (rt) { return rt.active !== false; }).map(function (rt) {
          var sheetId = HB.engine.sheetId(rt.id, on), invs = c.book.index.sheet[sheetId] || [], outlets = 0, i, cu;
          for (i = 0; i < (rt.stops || []).length; i++) { cu = m.customerById[rt.stops[i]]; if (cu && cu.active !== false) outlets++; }
          return {
            sheetId: sheetId, routeId: rt.id, routeName: rt.name, date: on, outlets: outlets,
            posted: invs.length > 0, toPost: invs.length === 0 && outlets > 0,
            invoiceIds: invs.map(function (d) { return d.id; }), invoices: invs.length,
            units: sumOf(invs, 'units'), total: sumOf(invs, 'total'), collected: sumOf(invs, 'paidNow')
          };
        });
      });
    },

    /**
     * One dispatch sheet by its id ('DS-<routeId>-<YYMMDD>'): the route, the date, whether it is posted and the
     * invoices that carry the id, in the order they were posted (stop order), cancelled ones included. posted,
     * invoiceIds, units, total and collected are of the uncancelled ones, as on a row of sell.sheets. repost: whether
     * a sheet of that day can be posted (again, once cancelled), by the date rules alone (sheetRepost). null for an
     * id that names no route and day, or for a role without the sales documents.
     */
    sheet: function (sheetId) {
      return memo('sell.sheet', String(sheetId), function (c) {
        var k = sheetKey(sheetId);
        if (!k || !sees('sales') || !unitOk(c, FACTORY)) return null;
        var id = String(sheetId), rt = HB.masters.routeById[k.routeId], live = c.book.index.sheet[id] || [];
        var all = docsIn('INV', { from: k.date, to: k.date }, function (d) { return d.sheetId === id; }).reverse();
        return {
          id: id, type: 'DS', typeLabel: TYPE_LABEL.DS, sheetId: id, routeId: rt.id, routeName: rt.name, date: k.date,
          posted: live.length > 0, invoiceIds: live.map(function (d) { return d.id; }),
          invoices: all.map(function (d) { return invRow(c, d); }),
          units: sumOf(live, 'units'), total: sumOf(live, 'total'), collected: sumOf(live, 'paidNow'),
          repost: sheetRepost(k.date)
        };
      });
    },

    /**
     * Sales of the range: gross, returns, net (before GST), cost of goods sold, margin, units, by channel, and
     * the collections. f: { from, to, unitIds, unitId, channel, customerId, routeId }.
     */
    summary: function (f) {
      f = f || {};
      return memo('sell.summary', f, function (c) {
        var tot = newAgg(), by = {}, r;
        r = eachSalesRow(c, f, function (x) { addRow(tot, x); addRow(by[x.channel] || (by[x.channel] = newAgg()), x); });
        finish(tot);
        tot.from = r.from; tot.to = r.to;
        tot.byChannel = channelsWanted(c, f).map(function (ch) {
          var a = finish(by[ch] || newAgg());
          a.channel = ch; a.label = CHANNEL_LABEL[ch];
          return a;
        });
        tot.collections = sees('ar') ? collections(c, f) : null;
        return tot;
      });
    },

    /**
     * Sales of the range by one dimension: item, customer, route, channel, unit, day or month. The rows add up
     * to sell.summary(f) whatever the dimension: counter sales have no customer and no route, and corporates no
     * route, so they come as rows of their own. 'day', 'month' and 'channel' give every day, month or channel of the
     * range and the scope, sold in or not.
     * 'item' honours from, to, unitIds and channel only.
     */
    by: function (dim, f) {
      f = f || {};
      return memo('sell.by', [dim, f], function (c) {
        var m = HB.masters, groups = {}, keys = [], totals = newAgg(), r = rangeOf(f), rows;
        function group(key, label, extra) {
          var g = groups[key];
          if (!g) { g = groups[key] = newAgg(); g.key = key; g.label = label; if (extra) for (var k in extra) g[k] = extra[k]; keys.push(key); }
          return g;
        }
        if (DIMS.indexOf(dim) === -1) throw new Error('HB.data.sell.by: unknown dimension ' + dim);
        if (dim === 'day') D.range(r.from, r.to).forEach(function (d) { group(d, D.label(d, 'd MMM'), { date: d }); });
        if (dim === 'channel') channelsWanted(c, f).forEach(function (ch) { group(ch, channelLabel(ch), { channel: ch }); });
        if (dim === 'month') {
          for (var mk = r.from.slice(0, 7); mk <= r.to.slice(0, 7); mk = D.monthKey(D.addDays(D.monthEnd(mk + '-01'), 1))) group(mk, D.monthLabel(mk, true), { monthKey: mk });
        }
        if (dim === 'item') {
          if (sees('sales')) {
            eachDay(r.from, r.to, function (day) {
              for (var unitId in day.items) {
                if (!has.call(day.items, unitId) || !unitWanted(c, f, unitId)) continue;
                for (var ch in day.items[unitId]) {
                  if (!has.call(day.items[unitId], ch) || !oneOf(f.channel, ch)) continue;
                  var cells = day.items[unitId][ch];
                  for (var itemId in cells) {
                    if (!has.call(cells, itemId)) continue;
                    var cell = cells[itemId], g = group(itemId, itemName(itemId), { itemId: itemId, unit: itemUnit(itemId) });
                    g.units += cell.qty; g.sales += cell.sales; g.cogs += cell.cogs; g.returnUnits += cell.returnQty; g.returns += cell.returns;
                  }
                }
              }
            });
          }
        } else {
          eachSalesRow(c, f, function (x) {
            var key, label, extra = null, src;
            if (dim === 'channel') { key = x.channel; label = channelLabel(x.channel); extra = { channel: x.channel }; }
            else if (dim === 'unit') { key = x.unitId; label = unitName(x.unitId); extra = { unitId: x.unitId }; }
            else if (dim === 'day') { key = x.date; }
            else if (dim === 'month') { key = x.date.slice(0, 7); }
            else {
              src = sourceOf(c, x.docId) || {};
              /* every row of a dimension carries the same fields: a row that stands for no customer or no route says so with null */
              if (dim === 'customer') {
                if (src.type === 'DAYEND') { key = 'store:' + src.storeId; label = unitName(src.storeId) + ' (counter sales)'; extra = { customerId: null, channel: 'store', unitId: src.storeId }; }
                else { key = src.customerId; label = customerName(src.customerId); extra = { customerId: src.customerId, channel: x.channel, unitId: x.unitId }; }
              } else {
                var routeId = routeOfDoc(c, src);
                if (src.type === 'DAYEND') { key = 'stores'; label = 'Own stores (no route)'; extra = { routeId: null }; }
                else if (routeId) { key = routeId; label = routeName(routeId); extra = { routeId: routeId }; }
                else if (x.channel === 'corporate') { key = 'corporate'; label = 'Corporates (no route)'; extra = { routeId: null }; }
                else { key = 'none'; label = 'No route'; extra = { routeId: null }; }
              }
            }
            addRow(group(key, label, extra), x);
          });
        }
        rows = keys.map(function (k) { return finish(groups[k]); });
        /* a product, customer, route or unit whose rows cancel out in the range (a sheet posted and cancelled the same
           day) is not listed with zeros; days, months and channels are, every one: plain bars with no gaps */
        if (dim !== 'day' && dim !== 'month' && dim !== 'channel') rows = rows.filter(function (g) { return g.units || g.sales || g.returns || g.returnUnits || g.cogs; });
        rows.forEach(function (g) { totals.units += g.units; totals.sales += g.sales; totals.returns += g.returns; totals.returnUnits += g.returnUnits; totals.cogs += g.cogs; });
        finish(totals);
        rows.forEach(function (g) { g.share = ratio(g.net, totals.net); });
        function rank(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return i; return list.length; }
        if (dim === 'item') rows.sort(function (a, b) { return rank(m.items, a.key) - rank(m.items, b.key); });
        else if (dim === 'channel') rows.sort(function (a, b) { return CHANNELS.indexOf(a.key) - CHANNELS.indexOf(b.key); });
        else if (dim === 'unit') rows.sort(function (a, b) { return rank(m.units, a.key) - rank(m.units, b.key); });
        else if (dim === 'route') rows.sort(function (a, b) { return rank(m.routes, a.key) - rank(m.routes, b.key) || (a.key < b.key ? -1 : 1); });
        else if (dim === 'customer') rows.sort(function (a, b) { return b.net - a.net || (a.label < b.label ? -1 : 1); });
        return { dim: dim, from: r.from, to: r.to, rows: rows, totals: totals };
      });
    },

    /**
     * Stale returns of the range, as positive figures (a cancellation is a negative row on its own date), with
     * the share of each outlet's supply and of each item's sales. f: { from, to, customerId, routeId, channel }.
     */
    returns: function (f) {
      f = f || {};
      return memo('sell.returns', f, function (c) {
        var rows = [], cust = {}, order = [], items = {}, itemOrder = [], totals = { units: 0, taxable: 0, gst: 0, total: 0 }, r, m = HB.masters;
        function itemCell(id) {
          var g = items[id];
          if (!g) { g = items[id] = { itemId: id, itemName: itemName(id), unit: itemUnit(id), returnUnits: 0, returns: 0, soldUnits: 0, sales: 0, share: null }; itemOrder.push(id); }
          return g;
        }
        r = eachSalesRow(c, f, function (x) {
          if (x.line === 'cogs' || x.channel === 'store') return;
          var t = sourceOf(c, x.docId), sign = x.reversal ? -1 : 1, rt = routeOfDoc(c, t), a = cust[t.customerId], i, l, g;
          if (!a) { a = cust[t.customerId] = { customerId: t.customerId, customerName: customerName(t.customerId), routeId: rt, supply: 0, returns: 0, units: 0 }; order.push(t.customerId); }
          a.routeId = rt; /* the outlet's route on its latest document of the range */
          /* the item figures come from the lines of the same documents, so they add up to the rows whatever the filter */
          for (i = 0; i < (t.lines || []).length; i++) {
            l = t.lines[i]; g = itemCell(l.itemId);
            if (x.line === 'sales') { g.soldUnits += sign * l.qty; g.sales += sign * (l.taxable || 0); }
            else { g.returnUnits += sign * l.qty; g.returns += sign * (l.taxable || 0); }
          }
          if (x.line === 'sales') { a.supply += x.amount; return; }
          var gst = sign * t.gst;
          var row = {
            seq: x.seq, date: x.date, docId: x.docId, cnId: t.id, customerId: t.customerId, customerName: a.customerName, routeId: rt, routeName: routeName(rt),
            units: -x.qty, taxable: -x.amount, gst: gst, total: -x.amount + gst, sharePct: t.sharePct, reversal: !!x.reversal, note: reversalNote(c, x)
          };
          rows.push(row);
          a.returns += row.taxable; a.units += row.units;
          totals.units += row.units; totals.taxable += row.taxable; totals.gst += row.gst; totals.total += row.total;
        });
        function rank(id) { for (var i = 0; i < m.items.length; i++) if (m.items[i].id === id) return i; return m.items.length; }
        var byItem = itemOrder.map(function (id) { return items[id]; }).filter(function (g) { return g.returnUnits !== 0 || g.returns !== 0; });
        byItem.forEach(function (g) { g.share = ratio(g.returns, g.sales); });
        byItem.sort(function (a, b) { return rank(a.itemId) - rank(b.itemId); });
        var byCustomer = order.map(function (id) { return cust[id]; }).filter(function (a) { return a.returns !== 0 || a.units !== 0; });
        byCustomer.forEach(function (a) { a.routeName = routeName(a.routeId); a.share = ratio(a.returns, a.supply); });
        byCustomer.sort(function (a, b) { return b.returns - a.returns; });
        return { from: r.from, to: r.to, rows: rows, totals: totals, byCustomer: byCustomer, byItem: byItem };
      });
    },

    /**
     * The sales register: one row per invoice (not opening), per stale return (negative) and per day-end in the
     * range, a cancellation as the opposite row on its own date. Its taxable total is P&L sales net of returns.
     * f: { from, to, unitIds, unitId, channel, customerId, routeId }.
     */
    register: function (f) {
      f = f || {};
      return memo('sell.register', f, function (c) {
        var rows = [], totals = { units: 0, taxable: 0, cgst: 0, sgst: 0, gst: 0, total: 0 }, r;
        r = eachSalesRow(c, f, function (x) {
          if (x.line === 'cogs') return;
          var t = sourceOf(c, x.docId), sign = (x.line === 'sales') === !x.reversal ? 1 : -1;
          var cgst = sign * lineCgst(t.lines), sgst = sign * lineSgst(t.lines);
          var row = {
            seq: x.seq, date: x.date, docId: x.docId, refId: t.id, type: t.type, typeLabel: docLabel(t),
            partyId: t.type === 'DAYEND' ? t.storeId : t.customerId,
            party: t.type === 'DAYEND' ? unitName(t.storeId) : customerName(t.customerId),
            channel: x.channel, channelLabel: channelLabel(x.channel), unitId: x.unitId, routeId: routeOfDoc(c, t),
            units: x.qty, taxable: x.amount, cgst: cgst, sgst: sgst, gst: cgst + sgst, total: x.amount + cgst + sgst,
            reversal: !!x.reversal, note: reversalNote(c, x), canOpen: docVisible(t)
          };
          rows.push(row);
          totals.units += row.units; totals.taxable += row.taxable; totals.cgst += cgst; totals.sgst += sgst; totals.gst += row.gst; totals.total += row.total;
        });
        return { from: r.from, to: r.to, rows: rows, totals: totals };
      });
    }
  };

  /* =============================================================== stores */

  function xferRow(d) {
    var r = base(d), units = 0, i;
    for (i = 0; i < d.lines.length; i++) units += d.lines[i].qty;
    r.toStoreId = d.toStoreId; r.storeName = unitName(d.toStoreId); r.lineCount = d.lines.length; r.units = units;
    r.receivedAt = d.receivedAt || null; r.receivedBy = d.receivedBy || null; r.receivedByName = whoName(d.receivedBy, d.receivedAs);
    return r;
  }

  function dayEndRow(c, d) {
    var r = base(d), expired = 0, i, wo = d.woId ? c.book.docs[d.woId] : null;
    for (i = 0; i < d.lines.length; i++) expired += d.lines[i].expired || 0;
    r.storeId = d.storeId; r.storeName = unitName(d.storeId); r.units = d.units; r.gross = d.gross; r.taxable = d.taxable; r.gst = d.gst;
    r.cost = d.cost; r.cash = d.cash; r.upi = d.upi; r.shortExcess = d.shortExcess; r.expiredUnits = expired;
    r.woId = d.woId || null; r.woStatus = wo ? wo.status : null;
    return r;
  }

  /** Transfers on their way: sent and not yet confirmed by the store. */
  function sentTransfers() {
    return memo('stores.sent', undefined, function (c) {
      return c.book.byType.XFER.filter(function (d) { return d.status === 'SENT'; });
    });
  }

  var stores = {
    /** Transfers to the stores in scope, newest first. f: { from, to, status, storeId }. */
    transfers: function (f) {
      f = f || {};
      return memo('stores.transfers', f, function () {
        if (!sees('storeops')) return [];
        return docsIn('XFER', f, function (d) { return oneOf(f.storeId, d.toStoreId) && docVisible(d); }).map(xferRow);
      });
    },

    /** Day-ends of the stores in scope, newest first. f: { from, to, status, storeId }. */
    dayEnds: function (f) {
      f = f || {};
      return memo('stores.dayEnds', f, function (c) {
        if (!sees('storeops')) return [];
        return docsIn('DAYEND', f, function (d) { return oneOf(f.storeId, d.storeId) && unitOk(c, d.storeId); }).map(function (d) { return dayEndRow(c, d); });
      });
    },

    /**
     * Per store in scope, for a date (default: the business date): whether a transfer is still to send (its
     * prefilled transfer proposes a quantity), the transfers sent and not confirmed, and whether the day-end of
     * that date is missing.
     */
    pending: function (date) {
      var on = date || HB.calendar.today;
      return memo('stores.pending', on, function (c) {
        if (!sees('storeops')) return [];
        var sent = sentTransfers();
        return HB.masters.units.filter(function (u) { return u.kind === 'store' && u.active !== false && storeOk(c, u); }).map(function (u) {
          /* the day-end is the store's own business: a role that only sends to the store (stores) is told nothing of it */
          var sheet = HB.engine.transferSheet(u.id, on), units = 0, lines = 0, i, own = unitOk(c, u.id), dayEndId = own ? c.book.index.dayEnd[u.id + '|' + on] || null : null;
          for (i = 0; sheet.ok && i < sheet.lines.length; i++) if (sheet.lines[i].qty > 0) { units += sheet.lines[i].qty; lines++; }
          return {
            storeId: u.id, storeName: u.name, date: on, toSend: units > 0, sendUnits: units, sendLines: lines,
            transfersSent: sent.filter(function (d) { return d.toStoreId === u.id; }).map(xferRow),
            dayEndMissing: own ? !dayEndId : null, dayEndId: dayEndId
          };
        });
      });
    }
  };

  /* ========================================================== receivables */

  var BUCKETS = [
    { key: 'notDue', label: 'Not due' }, { key: 'd1_15', label: '1 - 15 days' }, { key: 'd16_30', label: '16 - 30 days' },
    { key: 'd31_60', label: '31 - 60 days' }, { key: 'd60p', label: 'Over 60 days' }
  ];

  /** The ageing bucket of an open amount by its due date: how many days past due it is on the business date. */
  function bucketOf(due, today) {
    var late = due < today ? D.diffDays(due, today) : 0;
    return late <= 0 ? 'notDue' : (late <= 15 ? 'd1_15' : (late <= 30 ? 'd16_30' : (late <= 60 ? 'd31_60' : 'd60p')));
  }

  function emptyAge() { return { notDue: 0, d1_15: 0, d16_30: 0, d31_60: 0, d60p: 0, open: 0, overdue: 0, items: 0, overdueItems: 0, oldestDue: null }; }

  function age(t, due, amount, today) {
    t[bucketOf(due, today)] += amount;
    t.open += amount; t.items++;
    if (due < today) { t.overdue += amount; t.overdueItems++; }
    if (t.oldestDue === null || due < t.oldestDue) t.oldestDue = due;
  }

  function addAge(tot, t) {
    for (var i = 0; i < BUCKETS.length; i++) tot[BUCKETS[i].key] += t[BUCKETS[i].key];
    tot.open += t.open; tot.overdue += t.overdue; tot.items += t.items; tot.overdueItems += t.overdueItems;
    if (t.oldestDue !== null && (tot.oldestDue === null || t.oldestDue < tot.oldestDue)) tot.oldestDue = t.oldestDue;
  }

  /** Every customer with an open invoice, unapplied credit or a balance: open amounts aged by due date, credit apart. */
  function arRows() {
    return memo('ar.rows', undefined, function (c) {
      var a = c.book.ar, E = HB.engine, rows = [], totals = emptyAge();
      totals.credit = 0; totals.balance = 0; totals.customers = 0;
      if (!sees('ar')) return { rows: rows, totals: totals };
      HB.masters.customers.forEach(function (cu) {
        var list = a.open[cu.id] || [], credit = a.credit[cu.id] || 0, balance = a.balance[cu.id] || 0, t = emptyAge(), i;
        if (!list.length && credit === 0 && balance === 0) return;
        for (i = 0; i < list.length; i++) age(t, list[i].dueDate, E.openAmount(list[i]), c.today);
        t.customerId = cu.id; t.customerName = cu.name; t.channel = cu.channel; t.channelLabel = channelLabel(cu.channel);
        t.routeId = cu.routeId || null; t.routeName = routeName(cu.routeId); t.terms = cu.terms; t.creditLimit = cu.creditLimit || 0;
        t.credit = credit; t.balance = balance; t.overLimit = cu.creditLimit > 0 && balance > cu.creditLimit;
        rows.push(t);
        addAge(totals, t);
        totals.credit += credit; totals.balance += balance; totals.customers++;
      });
      return { rows: rows, totals: totals };
    });
  }

  function openInvoiceRow(c, d) {
    var open = HB.engine.openAmount(d);
    return {
      id: d.id, date: d.date, dueDate: d.dueDate, customerId: d.customerId, customerName: customerName(d.customerId),
      total: d.total, open: open, overdue: d.dueDate < c.today, daysOverdue: daysLate(d.dueDate, c.today), opening: !!d.opening, doc: d
    };
  }

  var ar = {
    /** What each customer owes: open invoices, unapplied credit, balance (= open - credit), overdue. { rows, totals }. */
    balances: function () { return arRows(); },

    /** Open invoice amounts by due date in buckets; unapplied credit is its own (negative) column, never netted into a bucket. */
    ageing: function () {
      return memo('ar.ageing', undefined, function (c) {
        var x = arRows();
        return { asOf: c.today, buckets: BUCKETS, rows: x.rows, totals: x.totals };
      });
    },

    /**
     * The statement of one customer: every receivable row of the range with a running balance, and what is open now.
     * f: { from, to }. debit and credit add up the rows by their sign. invoiced and settled add them up by what they
     * are - an invoice, or cash collected, a receipt or a stale return - so that a cancellation, which writes the
     * opposite of its document, takes it back out of the same figure: an invoice posted and cancelled in the range
     * is in neither, where it is in both debit and credit.
     */
    statement: function (customerId, f) {
      return memo('ar.statement', [customerId, f || {}], function (c) {
        var r = rangeOf(f), a = c.book.ar, list = sees('ar') ? (a.byParty[customerId] || []).slice().sort(byDateSeq) : [];
        var opening = 0, bal, rows = [], debit = 0, credit = 0, invoiced = 0, settled = 0, i, x, src, own;
        for (i = 0; i < list.length; i++) if (list[i].date < r.from) opening += list[i].amount;
        bal = opening;
        for (i = 0; i < list.length; i++) {
          x = list[i];
          if (x.date < r.from || x.date > r.to) continue;
          src = sourceOf(c, x.docId);
          bal += x.amount;
          if (x.amount > 0) debit += x.amount; else credit -= x.amount;
          own = x.kind === 'invoice';
          if (own) invoiced += x.amount; else settled -= x.amount;
          rows.push({
            seq: x.seq, date: x.date, docId: x.docId, refId: src ? src.id : x.docId, type: src ? src.type : null,
            kind: x.kind, kindLabel: AR_LABEL[x.kind] || x.kind, debit: x.amount > 0 ? x.amount : 0, credit: x.amount < 0 ? -x.amount : 0,
            invoiced: own ? x.amount : 0, settled: own ? 0 : -x.amount,
            amount: x.amount, balance: bal, reversal: !!x.reversal, note: reversalNote(c, x)
          });
        }
        return {
          customerId: customerId, customerName: customerName(customerId), from: r.from, to: r.to, opening: opening, rows: rows,
          debit: debit, credit: credit, invoiced: invoiced, settled: settled, closing: bal,
          openNow: sees('ar') ? (a.open[customerId] || []).map(function (d) { return openInvoiceRow(c, d); }) : [],
          creditNow: sees('ar') ? a.credit[customerId] || 0 : 0, balanceNow: sees('ar') ? a.balance[customerId] || 0 : 0
        };
      });
    },

    /** The open invoices of one customer, oldest first (the order a receipt allocates in); with no argument, of every customer. */
    openInvoices: function (customerId) {
      return memo('ar.openInvoices', customerId || '', function (c) {
        if (!sees('ar')) return [];
        var out = [];
        HB.masters.customers.forEach(function (cu) {
          if (!oneOf(customerId, cu.id)) return;
          (c.book.ar.open[cu.id] || []).forEach(function (d) { out.push(openInvoiceRow(c, d)); });
        });
        return out;
      });
    }
  };

  /* ============================================================= payables */

  function payableRow(c, d) {
    var open = d.total - d.paid, exp = d.type === 'EXP';
    return {
      id: d.id, type: d.type, typeLabel: docLabel(d), kind: exp ? d.kind : 'vendor_bill', date: d.date, dueDate: d.dueDate,
      payeeType: exp ? d.payeeType : 'vendor', payeeId: exp ? d.payeeId : d.vendorId,
      name: exp ? payeeName(d.payeeType, d.payeeId) : vendorName(d.vendorId), ref: exp ? d.billRef || '' : d.billNo || '',
      total: d.total, paid: d.paid, open: open, overdue: d.dueDate < c.today, daysOverdue: daysLate(d.dueDate, c.today),
      daysToDue: D.diffDays(c.today, d.dueDate), doc: d
    };
  }

  /** Every vendor with something open, the "Staff salaries" vendor among them: open amounts aged by due date. */
  function apRows() {
    return memo('ap.rows', undefined, function (c) {
      var a = c.book.ap, rows = [], totals = emptyAge(), soon = D.addDays(c.today, HB.masters.limits.dueSoonDays);
      totals.dueSoon = 0; totals.balance = 0; totals.vendors = 0;
      if (!sees('bills')) return { rows: rows, totals: totals };
      HB.masters.vendors.forEach(function (v) {
        var key = 'vendor:' + v.id, list = a.open[key] || [], balance = a.balance[key] || 0, t = emptyAge(), i, open;
        if (!list.length && balance === 0) return;
        t.dueSoon = 0;
        for (i = 0; i < list.length; i++) {
          open = list[i].total - list[i].paid;
          age(t, list[i].dueDate, open, c.today);
          if (list[i].dueDate >= c.today && list[i].dueDate <= soon) t.dueSoon += open;
        }
        t.payeeType = 'vendor'; t.payeeId = v.id; t.vendorId = v.id; t.name = v.name; t.kind = v.kind; t.termsDays = v.termsDays || 0; t.balance = balance;
        rows.push(t);
        addAge(totals, t);
        totals.dueSoon += t.dueSoon; totals.balance += balance; totals.vendors++;
      });
      return { rows: rows, totals: totals };
    });
  }

  var ap = {
    /** What is owed to each vendor (the salary payee among them): open, overdue, due soon. Claims are in toReimburse(). { rows, totals }. */
    balances: function () { return apRows(); },

    /** Open bill amounts by due date in buckets, per vendor. */
    ageing: function () {
      return memo('ap.ageing', undefined, function (c) {
        var x = apRows();
        return { asOf: c.today, buckets: BUCKETS, rows: x.rows, totals: x.totals };
      });
    },

    /** The open bills and expenses of one payee: what a payment can be allocated to. payeeType 'vendor' or 'employee'. */
    openItems: function (payeeType, payeeId) {
      return memo('ap.openItems', [payeeType, payeeId], function (c) {
        if (!sees('bills')) return [];
        return (c.book.ap.open[payeeType + ':' + payeeId] || []).map(function (d) { return payableRow(c, d); });
      });
    },

    /** Open vendor and expense bills due on or before the business date + `days` (default limits.dueSoonDays), overdue ones included, soonest first. */
    dueWithin: function (days) {
      var n = days === undefined || days === null ? HB.masters.limits.dueSoonDays : +days;
      return memo('ap.dueWithin', n, function (c) {
        if (!sees('bills')) return [];
        var until = D.addDays(c.today, n), out = [];
        HB.masters.vendors.forEach(function (v) {
          (c.book.ap.open['vendor:' + v.id] || []).forEach(function (d) { if (d.dueDate <= until) out.push(payableRow(c, d)); });
        });
        return out.sort(function (x, y) { return x.dueDate < y.dueDate ? -1 : (x.dueDate > y.dueDate ? 1 : x.doc.seq - y.doc.seq); });
      });
    },

    /** Approved claims not yet paid in full: what accounts reimburses. */
    toReimburse: function () {
      return memo('ap.toReimburse', undefined, function (c) {
        if (!sees('bills')) return [];
        var out = [];
        HB.masters.employees.forEach(function (e) {
          (c.book.ap.open['employee:' + e.id] || []).forEach(function (d) {
            var r = payableRow(c, d);
            r.employeeId = e.id; r.employeeName = e.name; r.categoryId = d.categoryId; r.categoryName = categoryName(d.categoryId);
            r.unitId = d.unitId; r.unitName = unitName(d.unitId);
            out.push(r);
          });
        });
        return out;
      });
    }
  };

  /* ================================================================= cash */

  function cashParty(src, x) {
    if (!src) return '';
    switch (src.type) {
      case 'INV': case 'RCPT': return customerName(src.customerId);
      case 'PAY': return payeeName(src.payeeType, src.payeeId);
      case 'DAYEND': return unitName(src.storeId);
      case 'DEP': return x.accountId === BANK ? 'From ' + accountName(src.fromAccount) : 'To ' + accountName(BANK);
      default: return '';
    }
  }

  var cash = {
    /** The balance of every cash and bank account in scope, now. */
    balances: function () {
      return memo('cash.balances', undefined, function (c) {
        var out = { rows: [], total: 0, cashTotal: 0, bankTotal: 0 };
        HB.masters.accounts.forEach(function (a) {
          if (!accountOk(c, a.id)) return;
          var bal = c.book.cash.balance[a.id] || 0;
          if (a.active === false && bal === 0) return;
          out.rows.push({ accountId: a.id, name: a.name, kind: a.kind, unitId: a.unitId || null, balance: bal });
          out.total += bal;
          if (a.kind === 'bank') out.bankTotal += bal; else out.cashTotal += bal;
        });
        return out;
      });
    },

    /** The book of one account: every row of the range by its own date, money in, money out and a running balance. f: { from, to }. */
    book: function (accountId, f) {
      return memo('cash.book', [accountId, f || {}], function (c) {
        var r = rangeOf(f), ok = !!HB.masters.accountById[accountId] && accountOk(c, accountId);
        var list = ok ? (c.book.cash.byAccount[accountId] || []) : [], inRange = [], opening = ok ? c.book.cash.balance[accountId] || 0 : 0;
        var bal, rows = [], totalIn = 0, totalOut = 0, i, x, src;
        /* the balance at the start of `from`: the balance now, less every row dated `from` or later */
        for (i = 0; i < list.length; i++) {
          x = list[i];
          if (x.date >= r.from) { opening -= x.amount; if (x.date <= r.to) inRange.push(x); }
        }
        inRange.sort(byDateSeq);
        bal = opening;
        for (i = 0; i < inRange.length; i++) {
          x = inRange[i]; src = sourceOf(c, x.docId);
          bal += x.amount;
          if (x.amount > 0) totalIn += x.amount; else totalOut -= x.amount;
          rows.push({
            seq: x.seq, date: x.date, docId: x.docId, refId: src ? src.id : x.docId, type: src ? src.type : null,
            kind: x.kind, kindLabel: CASH_LABEL[x.kind] || x.kind, party: cashParty(src, x),
            'in': x.amount > 0 ? x.amount : 0, out: x.amount < 0 ? -x.amount : 0, amount: x.amount, balance: bal,
            reversal: !!x.reversal, note: reversalNote(c, x)
          });
        }
        return { accountId: accountId, name: accountName(accountId), from: r.from, to: r.to, opening: opening, rows: rows, totalIn: totalIn, totalOut: totalOut, closing: bal };
      });
    }
  };

  /* ================================================================== P&L */

  function monthsToDate() {
    var out = [], end = HB.calendar.today.slice(0, 7);
    for (var mk = HB.calendar.goLive.slice(0, 7); mk <= end; mk = D.monthKey(D.addDays(D.monthEnd(mk + '-01'), 1))) out.push(mk);
    return out;
  }

  function byChannelOf(src) {
    var o = { retail: 0, corporate: 0, store: 0, total: 0 }, k;
    for (k in src || {}) if (has.call(src, k)) { o[k] = (o[k] || 0) + src[k]; o.total += src[k]; }
    return o;
  }

  /**
   * One month of the P&L from the running month totals of the book. Signs as the book holds them: sales positive,
   * returns zero or less, every cost positive when it is a cost. net sales = sales + returns; material cost =
   * cost of goods sold + production loss + write-offs + count differences; gross margin = net sales - material
   * cost; operating profit = gross margin - expenses.
   */
  function pnlOf(c, mk) {
    return memo('pnl.month', mk, function () {
      var m = HB.masters, pm = sees('pnl') ? c.book.pnlMonth[mk] || {} : {};
      var sales = byChannelOf(pm.sales), returns = byChannelOf(pm.returns), cogs = byChannelOf(pm.cogs);
      var net = { retail: sales.retail + returns.retail, corporate: sales.corporate + returns.corporate, store: sales.store + returns.store, total: sales.total + returns.total };
      var prodLoss = (pm.prodLoss || {}).all || 0, writeoff = (pm.writeoff || {}).all || 0, countDiff = (pm.countDiff || {}).all || 0;
      var byCat = {}, expenseTotal = 0, expenses = [], key, at, cat, lines = [];
      for (key in pm.expense || {}) {
        if (!has.call(pm.expense, key)) continue;
        at = key.indexOf('|');
        cat = byCat[key.slice(0, at)] || (byCat[key.slice(0, at)] = { categoryId: key.slice(0, at), categoryName: categoryName(key.slice(0, at)), amount: 0, byUnit: {} });
        cat.amount += pm.expense[key];
        cat.byUnit[key.slice(at + 1)] = (cat.byUnit[key.slice(at + 1)] || 0) + pm.expense[key];
        expenseTotal += pm.expense[key];
      }
      /* a category whose rows net to zero in the month (an expense and its cancellation) is not a line of that month */
      m.expenseCategories.forEach(function (k) { if (byCat[k.id]) { if (byCat[k.id].amount !== 0) expenses.push(byCat[k.id]); delete byCat[k.id]; } });
      for (key in byCat) if (has.call(byCat, key) && byCat[key].amount !== 0) expenses.push(byCat[key]);
      var materialCost = cogs.total + prodLoss + writeoff + countDiff, grossMargin = net.total - materialCost, profit = grossMargin - expenseTotal;

      function line(k, label, amount, drill, strong) {
        lines.push({ key: k, label: label, amount: amount, strong: !!strong, drill: drill ? { monthKey: mk, line: drill.line, channel: drill.channel, categoryId: drill.categoryId } : null });
      }
      CHANNELS.forEach(function (ch) { line('netSales.' + ch, 'Sales, ' + CHANNEL_LABEL[ch].toLowerCase(), net[ch], { line: 'netSales', channel: ch }); });
      line('netSales', 'Net sales', net.total, { line: 'netSales' }, true);
      line('returns', 'of which stale returns', returns.total, { line: 'returns' });
      line('cogs', 'Cost of goods sold', cogs.total, { line: 'cogs' });
      line('prodLoss', 'Production loss', prodLoss, { line: 'prodLoss' });
      line('writeoff', 'Write-offs', writeoff, { line: 'writeoff' });
      line('countDiff', 'Count differences', countDiff, { line: 'countDiff' });
      line('materialCost', 'Material cost', materialCost, { line: 'materialCost' }, true);
      line('grossMargin', 'Gross margin', grossMargin, null, true);
      expenses.forEach(function (e) { line('expense.' + e.categoryId, e.categoryName, e.amount, { line: 'expense', categoryId: e.categoryId }); });
      line('expenseTotal', 'Expenses', expenseTotal, { line: 'expense' }, true);
      line('operatingProfit', 'Operating profit', profit, null, true);

      return {
        monthKey: mk, label: D.monthLabel(mk, true), sales: sales, returns: returns, netSales: net, cogs: cogs,
        prodLoss: prodLoss, writeoff: writeoff, countDiff: countDiff, materialCost: materialCost,
        grossMargin: grossMargin, grossMarginPct: ratio(grossMargin, net.total), expenses: expenses, expenseTotal: expenseTotal,
        operatingProfit: profit, operatingPct: ratio(profit, net.total), lines: lines
      };
    });
  }

  var LINE_SETS = { netSales: ['sales', 'returns'], materialCost: ['cogs', 'prodLoss', 'writeoff', 'countDiff'] };

  /** Who or what a P&L row is about, for the drill-down. */
  function pnlParty(src, x) {
    if (!src) return '';
    switch (src.type) {
      case 'INV': case 'CN': return customerName(src.customerId);
      case 'DAYEND': return unitName(src.storeId);
      case 'EXP': return src.kind === 'salary' ? unitName(x.unitId) : payeeName(src.payeeType, src.payeeId);
      default: return x.itemId ? itemName(x.itemId) : '';
    }
  }

  var pnl = {
    /** The P&L of one month ('YYYY-MM'), with `lines` ready for a statement table. */
    month: function (monthKey) { return pnlOf(stamp(), String(monthKey)); },

    /** Every month from go-live to the month of the business date, oldest first: the month-wise totals. */
    months: function () {
      return memo('pnl.months', undefined, function (c) {
        return monthsToDate().map(function (mk) {
          var p = pnlOf(c, mk);
          return {
            monthKey: mk, label: p.label, sales: p.sales.total, returns: p.returns.total, netSales: p.netSales.total,
            retail: p.netSales.retail, corporate: p.netSales.corporate, store: p.netSales.store,
            cogs: p.cogs.total, prodLoss: p.prodLoss, writeoff: p.writeoff, countDiff: p.countDiff, materialCost: p.materialCost,
            grossMargin: p.grossMargin, grossMarginPct: p.grossMarginPct, expenses: p.expenseTotal, operatingProfit: p.operatingProfit
          };
        });
      });
    },

    /**
     * The rows behind one P&L cell. f: { monthKey, line, channel, categoryId, unitId }. line is a ledger line
     * (sales, returns, cogs, prodLoss, writeoff, countDiff, expense), 'netSales' (sales and returns),
     * 'materialCost' (the four cost lines) or a list.
     */
    entries: function (f) {
      f = f || {};
      return memo('pnl.entries', f, function (c) {
        var out = [], mk = String(f.monthKey || ''), lines = LINE_SETS[f.line] || f.line;
        if (!sees('pnl') || !/^\d{4}-\d{2}$/.test(mk)) return out;
        eachDay(mk + '-01', mk + '-31', function (day) {
          for (var i = 0; i < day.pnl.length; i++) {
            var x = day.pnl[i];
            if (!oneOf(lines, x.line) || !oneOf(f.channel, x.channel) || !oneOf(f.categoryId, x.categoryId) || !oneOf(f.unitId, x.unitId)) continue;
            var src = sourceOf(c, x.docId);
            out.push({
              seq: x.seq, docId: x.docId, refId: src ? src.id : x.docId, type: src ? src.type : null, typeLabel: docLabel(src),
              date: x.date, amount: x.amount, qty: x.qty, line: x.line, lineLabel: PNL_LABEL[x.line] || x.line, channel: x.channel,
              categoryId: x.categoryId, unitId: x.unitId, itemId: x.itemId, party: pnlParty(src, x), reversal: !!x.reversal, note: reversalNote(c, x)
            });
          }
        });
        return out;
      });
    }
  };

  /* =============================================================== margin */

  var margin = {
    /** Margin by product for the range, with today's unit cost beside it. f: { from, to, unitIds, channel }. { rows, totals }. */
    byItem: function (f) {
      f = f || {};
      return memo('margin.byItem', f, function () {
        var r = rangeOf(f);
        if (!sees('margin')) return { from: r.from, to: r.to, rows: [], totals: finish(newAgg()) };
        var x = sell.by('item', f);
        return {
          from: x.from, to: x.to, totals: x.totals,
          rows: x.rows.map(function (g) {
            return {
              itemId: g.itemId, itemName: g.label, unit: g.unit, units: g.units, sales: g.sales, returns: g.returns, returnUnits: g.returnUnits,
              net: g.net, cogs: g.cogs, margin: g.margin, marginPct: g.marginPct, share: g.share,
              avgPrice: ratio(g.sales, g.units), avgCost: ratio(g.cogs, g.units), unitCost: HB.engine.unitCost(g.itemId)
            };
          })
        };
      });
    },

    /** Margin by channel for the range. f: { from, to, unitIds }. { rows, totals }. */
    byChannel: function (f) {
      f = f || {};
      return memo('margin.byChannel', f, function () {
        var r = rangeOf(f);
        if (!sees('margin')) return { from: r.from, to: r.to, rows: [], totals: finish(newAgg()) };
        var x = sell.by('channel', f);
        return {
          from: x.from, to: x.to, totals: x.totals,
          rows: x.rows.map(function (g) {
            return { channel: g.key, label: g.label, units: g.units, sales: g.sales, returns: g.returns, net: g.net, cogs: g.cogs, margin: g.margin, marginPct: g.marginPct, share: g.share };
          })
        };
      });
    }
  };

  /* ================================================================== GST */

  var gst = {
    /**
     * GST of the range by rate, output and input. Rate 0 is "Nil-rated" and stands outside the taxable turnover:
     * totals.taxable adds the rated lines only, totals.nilRated holds the rest. net = output - input.
     */
    summary: function (f) {
      f = f || {};
      return memo('gst.summary', f, function () {
        var r = rangeOf(f), acc = { output: {}, input: {} };
        if (sees('gst')) {
          eachDay(r.from, r.to, function (day) {
            for (var i = 0; i < day.gst.length; i++) {
              var x = day.gst[i], side = acc[x.dir], t = side[x.gstRate] || (side[x.gstRate] = { gstRate: x.gstRate, taxable: 0, cgst: 0, sgst: 0 });
              t.taxable += x.taxable; t.cgst += x.cgst; t.sgst += x.sgst;
            }
          });
        }
        function sideOf(dir) {
          /* a rate whose rows cancel out in the range (a bill posted and cancelled) is not listed with zeros */
          var rows = Object.keys(acc[dir]).map(function (k) { return acc[dir][k]; }).filter(function (t) { return t.taxable || t.cgst || t.sgst; }).sort(function (a, b) { return a.gstRate - b.gstRate; });
          var totals = { taxable: 0, nilRated: 0, cgst: 0, sgst: 0, tax: 0 };
          rows.forEach(function (t) {
            t.label = t.gstRate === 0 ? 'Nil-rated' : t.gstRate + '%';
            t.tax = t.cgst + t.sgst;
            if (t.gstRate === 0) totals.nilRated += t.taxable; else totals.taxable += t.taxable;
            totals.cgst += t.cgst; totals.sgst += t.sgst; totals.tax += t.tax;
          });
          return { rows: rows, totals: totals };
        }
        var out = sideOf('output'), inp = sideOf('input');
        return {
          from: r.from, to: r.to, output: out.rows, outputTotals: out.totals, input: inp.rows, inputTotals: inp.totals,
          net: { cgst: out.totals.cgst - inp.totals.cgst, sgst: out.totals.sgst - inp.totals.sgst, tax: out.totals.tax - inp.totals.tax }
        };
      });
    }
  };

  /* ============================================================= expenses */

  function expenseView(c) { return c.all ? 'all' : HB.session.expenseView(c.role); }

  function expRow(c, d) {
    var r = base(d), salary = d.kind === 'salary';
    r.kind = d.kind; r.kindLabel = EXP_LABEL[d.kind] || d.kind; r.payeeType = d.payeeType; r.payeeId = d.payeeId; r.payeeName = payeeName(d.payeeType, d.payeeId);
    r.categoryId = d.categoryId; r.categoryName = categoryName(d.categoryId); r.unitId = d.unitId || null; r.unitName = salary ? 'All locations' : unitName(d.unitId);
    r.billRef = d.billRef || ''; r.monthKey = d.monthKey || null; r.amount = d.amount; r.gstRate = d.gstRate || 0; r.gst = d.gst || 0; r.total = d.total;
    r.paid = d.paid; r.open = d.status === 'APPROVED' ? d.total - d.paid : 0; r.dueDate = d.dueDate;
    r.waiting = d.status === 'PENDING'; r.mine = d.createdBy === c.userId; r.rejectReason = d.approval && d.approval.state === 'rejected' ? d.approval.reason : '';
    return r;
  }

  /**
   * Spend of the range as a category x unit matrix, from the expense rows of the P&L by their own date. What a
   * role sees: everything; its unit's spend without the salary bill; or the claims it raised itself.
   */
  function expMatrix(f) {
    return memo('exp.matrix', f, function (c) {
      var r = rangeOf(f), m = HB.masters, view = expenseView(c), cells = {}, total = 0;
      eachDay(r.from, r.to, function (day) {
        for (var i = 0; i < day.pnl.length; i++) {
          var x = day.pnl[i], src;
          if (x.line !== 'expense' || !oneOf(f.categoryId, x.categoryId) || !oneOf(f.unitIds, x.unitId) || !oneOf(f.unitId, x.unitId)) continue;
          if (view === 'unit') {
            if (!c.sc.unit(x.unitId) || x.categoryId === m.salaryCategoryId) continue;
            src = sourceOf(c, x.docId);
            if (src && src.kind === 'salary') continue;
          } else if (view === 'own') {
            src = sourceOf(c, x.docId);
            if (!src || src.type !== 'EXP' || src.kind !== 'claim' || src.createdBy !== c.userId) continue;
          }
          var byUnit = cells[x.categoryId] || (cells[x.categoryId] = {});
          byUnit[x.unitId] = (byUnit[x.unitId] || 0) + x.amount;
          total += x.amount;
        }
      });
      return { from: r.from, to: r.to, cells: cells, total: total };
    });
  }

  var exp = {
    /** Claims, expense bills and salary bills the persona may see, newest first. f: { from, to, status, kind, categoryId, unitId, payeeId, mine: true }. */
    list: function (f) {
      f = f || {};
      return memo('exp.list', f, function (c) {
        return docsIn('EXP', f, function (d) {
          return expenseVisible(c, d) && oneOf(f.kind, d.kind) && oneOf(f.categoryId, d.categoryId) && oneOf(f.unitId, d.unitId) &&
            oneOf(f.payeeId, d.payeeId) && (!f.mine || d.createdBy === c.userId);
        }).map(function (d) { return expRow(c, d); });
      });
    },

    /** Spend by category for the range, each with its split by location. f: { from, to, unitIds, unitId, categoryId }. */
    byCategory: function (f) {
      f = f || {};
      return memo('exp.byCategory', f, function () {
        var x = expMatrix(f), m = HB.masters, rows = [], units = {}, seen = {};
        function push(id) {
          var byUnit = x.cells[id], amount = 0, k;
          if (!byUnit || seen[id]) return;
          seen[id] = true;
          for (k in byUnit) if (has.call(byUnit, k)) { amount += byUnit[k]; units[k] = (units[k] || 0) + byUnit[k]; }
          rows.push({ categoryId: id, categoryName: categoryName(id), amount: amount, byUnit: byUnit });
        }
        m.expenseCategories.forEach(function (k) { push(k.id); });
        Object.keys(x.cells).forEach(push);
        return {
          from: x.from, to: x.to, rows: rows, totals: { amount: x.total },
          units: m.units.filter(function (u) { return units[u.id] !== undefined; }).map(function (u) { return { unitId: u.id, unitName: u.name, amount: units[u.id] }; })
        };
      });
    },

    /** Spend by location for the range, each with its split by category. Same filter. */
    byUnit: function (f) {
      f = f || {};
      return memo('exp.byUnit', f, function () {
        var x = expMatrix(f), m = HB.masters, acc = {}, cats = {}, id, k;
        for (id in x.cells) {
          if (!has.call(x.cells, id)) continue;
          for (k in x.cells[id]) {
            if (!has.call(x.cells[id], k)) continue;
            var t = acc[k] || (acc[k] = { unitId: k, unitName: unitName(k), amount: 0, byCategory: {} });
            t.amount += x.cells[id][k];
            t.byCategory[id] = (t.byCategory[id] || 0) + x.cells[id][k];
            cats[id] = (cats[id] || 0) + x.cells[id][k];
          }
        }
        return {
          from: x.from, to: x.to, totals: { amount: x.total },
          rows: m.units.filter(function (u) { return acc[u.id]; }).map(function (u) { return acc[u.id]; }),
          categories: m.expenseCategories.filter(function (c2) { return cats[c2.id] !== undefined; }).map(function (c2) { return { categoryId: c2.id, categoryName: c2.name, amount: cats[c2.id] }; })
        };
      });
    }
  };

  /* =============================================================== people */

  /** On the rolls on a day, by the rule of the salary bill: joined on or before it, and not left before it. */
  function onRolls(e, date) { return !!e.doj && e.doj <= date && (!e.dol || e.dol >= date); }

  var people = {
    /** The employee directory. The salary is in a row only for a role that may see salaries. */
    list: function () {
      return memo('people.list', undefined, function (c) {
        if (!sees('people')) return [];
        var salaries = HB.session.canSeeSalaries();
        return HB.masters.employees.map(function (e) {
          var r = employeeView(e, salaries);
          r.onRolls = onRolls(e, c.today);
          return r;
        });
      });
    },

    /** Headcount on the business date by department and by location, with the monthly salary cost for a role that may see salaries. */
    headcount: function () {
      return memo('people.headcount', undefined, function (c) {
        var salaries = HB.session.canSeeSalaries(), out = { asOf: c.today, headcount: 0, byDept: [], byUnit: [] }, depts = {}, units = {};
        if (salaries) out.salary = 0;
        if (!sees('people')) return out;
        function add(map, list, key, row) {
          var t = map[key];
          if (!t) { t = map[key] = row; t.headcount = 0; if (salaries) t.salary = 0; list.push(t); }
          return t;
        }
        HB.masters.employees.forEach(function (e) {
          if (!onRolls(e, c.today)) return;
          var d = add(depts, out.byDept, e.dept || '', { dept: e.dept || '' }), u = add(units, out.byUnit, e.unitId, { unitId: e.unitId, unitName: unitName(e.unitId) });
          out.headcount++; d.headcount++; u.headcount++;
          if (salaries) { out.salary += e.salary || 0; d.salary += e.salary || 0; u.salary += e.salary || 0; }
        });
        return out;
      });
    }
  };

  /* ============================================================ approvals */

  function lineView(l) {
    var out = {}, k;
    for (k in l) if (has.call(l, k)) out[k] = l[k];
    out.itemName = itemName(l.itemId); out.unit = itemUnit(l.itemId);
    return out;
  }

  /** What an approver needs to see to decide, by type. */
  function evidenceOf(c, d) {
    var m = HB.masters, E = HB.engine, b = c.book;
    switch (d.type) {
      case 'PO':
        return {
          vendorId: d.vendorId, vendorName: vendorName(d.vendorId), expectedDate: d.expectedDate, total: d.total,
          limit: m.limits.poAutoApprove, over: d.total - m.limits.poAutoApprove,
          lines: d.lines.map(function (l) { var x = lineView(l); x.latestRate = E.price(l.itemId); return x; })
        };
      case 'VBILL':
        var orders = [];
        return {
          vendorId: d.vendorId, vendorName: vendorName(d.vendorId), billNo: d.billNo, taxable: d.taxable, gst: d.gst, total: d.total, dueDate: d.dueDate,
          tolerancePct: m.limits.billTolerancePct,
          diffs: d.match.diffs.map(function (x) { var y = lineView(x); y.diffPct = ratio(x.diff, x.expected); return y; }),
          receipts: d.grnIds.map(function (id) {
            var g = b.docs[id] || {};
            if (g.poId && orders.indexOf(g.poId) === -1) orders.push(g.poId);
            return { id: id, date: g.date || null, poId: g.poId || null };
          }),
          orderIds: orders
        };
      case 'CN':
        var from = D.addDays(d.date, -6), sup = b.index.supply[d.customerId] || {}, ret = b.index.returned[d.customerId] || {}, supply = 0, returned = 0;
        D.range(from, d.date).forEach(function (day) { supply += sup[day] || 0; returned += ret[day] || 0; });
        return {
          customerId: d.customerId, customerName: customerName(d.customerId), routeName: routeName(routeOfDoc(c, d)),
          taxable: d.taxable, gst: d.gst, total: d.total, sharePct: d.sharePct, limitPct: m.limits.returnsPct,
          from: from, to: d.date, supply: supply, otherReturns: returned - d.taxable, thisReturn: d.taxable, lines: d.lines.map(lineView)
        };
      case 'ADJ':
        return {
          locId: d.locId, locName: locName(d.locId), reason: d.reason, value: d.value,
          lines: d.lines.map(function (l) {
            var x = lineView(l), lots = l.batchId ? (b.lots[d.locId] || {})[l.itemId] || [] : null, now = 0, i;
            if (lots) { for (i = 0; i < lots.length; i++) if (lots[i].batchId === l.batchId) now = lots[i].qty; }
            else now = (b.stock[d.locId] || {})[l.itemId] || 0;
            x.onHandNow = now;
            return x;
          })
        };
      case 'WO':
        return {
          locId: d.locId, locName: locName(d.locId), reason: d.reason, sourceDocId: d.sourceDocId || null, value: d.value,
          lines: d.lines.map(function (l) { var x = lineView(l), bt = l.batchId ? b.batches[l.batchId] : null; x.bestBefore = bt ? bt.bestBefore : null; return x; })
        };
      case 'EXP':
        return {
          kind: d.kind, kindLabel: EXP_LABEL[d.kind] || d.kind, payeeType: d.payeeType, payeeId: d.payeeId, payeeName: payeeName(d.payeeType, d.payeeId),
          categoryId: d.categoryId, categoryName: categoryName(d.categoryId), unitId: d.unitId || null, unitName: d.kind === 'salary' ? 'All locations' : unitName(d.unitId),
          amount: d.amount, gstRate: d.gstRate || 0, gst: d.gst || 0, total: d.total, billRef: d.billRef || '', monthKey: d.monthKey || null, dueDate: d.dueDate,
          lines: (d.lines || []).map(function (l) { return { unitId: l.unitId, unitName: unitName(l.unitId), headcount: l.headcount, amount: l.amount }; })
        };
      default: return {};
    }
  }

  function waitReason(d) {
    switch (d.type) {
      case 'PO': return 'The order is above the limit of ' + fmt.inr2(HB.masters.limits.poAutoApprove) + ' for approval as submitted';
      case 'VBILL': case 'CN': return d.holdReason ? d.holdReason.charAt(0).toUpperCase() + d.holdReason.slice(1) : 'Held for the Owner';
      case 'ADJ': return 'Every stock count waits for the Owner';
      case 'WO': return 'Every write-off waits for the Owner';
      case 'EXP': return d.kind === 'salary' ? 'The salary bill waits for the Owner' : 'Every expense waits for the Owner';
      default: return '';
    }
  }

  function waitParty(d) {
    switch (d.type) {
      case 'PO': case 'VBILL': return vendorName(d.vendorId);
      case 'CN': return customerName(d.customerId);
      case 'ADJ': case 'WO': return locName(d.locId);
      case 'EXP': return payeeName(d.payeeType, d.payeeId);
      default: return '';
    }
  }

  function waitAmount(d) { return d.type === 'ADJ' || d.type === 'WO' ? d.value : d.total; }

  /** May the persona approve it? The rights first (own document before role), then what the engine would say now. */
  function mayApprove(d) {
    var can = HB.session.can('approve.' + d.type.toLowerCase(), { doc: d });
    if (!can.ok) return { ok: false, code: can.code, reason: can.reason };
    var chk = HB.engine.check('approve', { id: d.id });
    return chk.ok ? { ok: true, code: '', reason: '' } : { ok: false, code: chk.error.code, reason: chk.error.message };
  }

  function mayReject(d) {
    var can = HB.session.can('reject.' + d.type.toLowerCase(), { doc: d });
    return { ok: can.ok, code: can.code, reason: can.reason };
  }

  var APPROVAL_ORDER = ['PO', 'VBILL', 'CN', 'WO', 'ADJ', 'EXP'];

  var approvals = {
    /** Everything waiting for approval, oldest first and grouped by type, each with the evidence to decide and whether the persona may approve it. */
    pending: function () {
      return memo('approvals.pending', undefined, function (c) {
        var out = { count: 0, items: [], groups: [] }, byType = {};
        if (!sees('approvals')) return out;
        Object.keys(c.book.pending).forEach(function (id) {
          var d = c.book.pending[id], r = base(d);
          r.raisedBy = d.createdBy; r.raisedByName = whoName(d.createdBy, d.createdAs); r.raisedAt = d.createdAt;
          r.party = waitParty(d); r.amount = waitAmount(d); r.reason = waitReason(d); r.evidence = evidenceOf(c, d);
          r.warning = warningOf(c, d); /* what the engine warned about when it was entered: the approver decides knowing it */
          r.canApprove = mayApprove(d); r.canReject = mayReject(d);
          out.items.push(r);
          (byType[d.type] || (byType[d.type] = [])).push(r);
        });
        out.items.sort(function (a, b) { return a.doc.seq - b.doc.seq; });
        out.count = out.items.length;
        APPROVAL_ORDER.forEach(function (t) {
          if (byType[t]) out.groups.push({ type: t, label: TYPE_LABEL[t], count: byType[t].length, items: byType[t].sort(function (a, b) { return a.doc.seq - b.doc.seq; }) });
        });
        return out;
      });
    }
  };

  /* ================================================================ audit */

  var ENTITY_LABEL = {
    items: 'Item', recipes: 'Recipe', customers: 'Customer', vendors: 'Vendor', expenseCategories: 'Expense category',
    employees: 'Employee', locations: 'Location'
  };

  /* the engine's short notes (API 2.4) as a reader meets them: a sentence, not a code */
  var AUDIT_NOTE = { 'within limit': 'Within the limit, approved as submitted', 'own document': 'Approved by the Owner, who also raised it', 'opening balance': 'Opening balance' };
  var WARNED_NOTE = /(?:^|\. )(Entered with (?:a warning|warnings): [\s\S]*)$/;
  function auditNote(n) {
    if (!n) return '';
    if (AUDIT_NOTE[n]) return AUDIT_NOTE[n];
    /* a posting that was warned about says so after whatever else its note says (API 2.5) */
    var w = WARNED_NOTE.exec(n);
    if (w) return (w.index > 0 ? auditNote(n.slice(0, w.index)) + '. ' : '') + w[1];
    return /^with \S+$/.test(n) ? 'Cancelled with ' + n.slice(5) : String(n);
  }

  /**
   * What a document was warned about when it was entered, in the engine's own words: the sentences its audit entry
   * holds after "Entered with a warning:" (API 2.5). '' for a document entered without a warning.
   */
  function warningOf(c, d) {
    if (!d || !d.warned || !d.warned.length) return '';
    var list = auditOf(c, d.id), i, w;
    for (i = 0; i < list.length; i++) {
      w = list[i].action === 'post' ? WARNED_NOTE.exec(list[i].note || '') : null;
      if (w) return w[1].replace(/^Entered with (?:a warning|warnings): /, '');
    }
    return '';
  }

  var MASTER_NAME = { items: itemName, recipes: itemName, customers: customerName, vendors: vendorName, employees: employeeName, expenseCategories: categoryName, locations: locName };
  /** The name of the master record an audit entry is about, as it stood after the change. */
  function masterName(a) {
    var fn = MASTER_NAME[a.type];
    return (a.after && a.after.name) || (a.before && a.before.name) || (fn ? fn(a.docId) : String(a.docId));
  }

  function auditRow(c, a) {
    var master = a.action === 'master' || a.action === 'setActive', d = master ? null : c.book.docs[a.docId];
    var label = master ? (ENTITY_LABEL[a.type] || a.type) : (d ? docLabel(d) : typeLabel(a.type));
    /* a master change says what was done to the record: added, changed, deactivated or activated */
    var what = !master ? (ACTION_LABEL[a.action] || a.action)
      : (a.action === 'setActive' ? (a.after && a.after.active === false ? 'Deactivated' : 'Activated') : (a.before ? 'Changed' : 'Added'));
    var note = auditNote(a.note), name = master ? masterName(a) : '', text;
    if (master) text = label + ' ' + name + ': ' + what.toLowerCase();
    else text = label + ' ' + a.docId + ': ' + what.toLowerCase() + (a.after ? ', ' + statusLabel(a.after).toLowerCase() : '') + (note ? ' (' + note + ')' : '');
    return {
      seq: a.seq, at: a.at, date: String(a.at).slice(0, 10), time: String(a.at).slice(11, 16), userId: a.userId, userName: whoName(a.userId, a.userAs),
      role: a.role, roleLabel: a.role ? HB.session.roleLabel(a.role) : '', action: a.action, actionLabel: what,
      docId: a.docId, type: a.type, typeLabel: label, isMaster: master, recordName: name, note: note, before: a.before, after: a.after, text: text
    };
  }

  /* The audit trail only grows, so its index by document is extended, never rebuilt, while the book is the same. */
  var auditIndex = { book: null, upto: 0, byDoc: {} };

  function auditOf(c, docId) {
    var x = auditIndex, list = c.book.audit, i, a;
    if (x.book !== c.book || x.upto > list.length) { x.book = c.book; x.upto = 0; x.byDoc = {}; }
    for (i = x.upto; i < list.length; i++) {
      a = list[i];
      if (a.action === 'master' || a.action === 'setActive' || !a.docId) continue;
      (x.byDoc[a.docId] || (x.byDoc[a.docId] = [])).push(a);
    }
    x.upto = list.length;
    return x.byDoc[docId] || [];
  }

  var audit = {
    /**
     * The audit trail, newest first. f: { from, to, userId, role, action, type, docId, masters: true for master
     * changes only, limit }. At most `limit` rows (default 5000, 0 for all); count is of every row that matched.
     */
    list: function (f) {
      f = f || {};
      return memo('audit.list', f, function (c) {
        var r = rangeOf(f), list = c.book.audit, limit = f.limit === undefined || f.limit === null ? ROW_LIMIT : +f.limit, rows = [], count = 0, i, a, day, master;
        if (sees('audit')) {
          for (i = list.length - 1; i >= 0; i--) {
            a = list[i]; day = String(a.at).slice(0, 10);
            if (day < r.from || day > r.to) continue;
            master = a.action === 'master' || a.action === 'setActive';
            if (!oneOf(f.userId, a.userId) || !oneOf(f.role, a.role) || !oneOf(f.action, a.action) || !oneOf(f.type, a.type)) continue;
            if (a.userAs && !noFilter(f.userId)) continue; /* entered in another employee's name: not that persona's row */
            if (!oneOf(f.docId, a.docId) || (f.masters && !master)) continue;
            count++;
            if (limit > 0 && rows.length >= limit) continue;
            rows.push(auditRow(c, a));
          }
        }
        return { from: r.from, to: r.to, rows: rows, count: count, truncated: count > rows.length };
      });
    }
  };

  /* ======================================================== notifications */
  /*
   * The emails Neo ERP would send, derived from the book as it stands (SCOPE 4.9): nothing is stored and nothing
   * is sent. Each is dated the day it would have gone out.
   */

  var PLACEHOLDER_DOMAIN = 'example.com'; /* reserved for examples: used when the company master names no domain */

  function mailDomain() {
    var co = HB.masters.company || {}, d = co.emailDomain || co.domain || '';
    if (!d && co.email && String(co.email).indexOf('@') !== -1) d = String(co.email).split('@')[1];
    if (!d && co.website) d = String(co.website).replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    return d ? { domain: String(d).toLowerCase(), placeholder: false } : { domain: PLACEHOLDER_DOMAIN, placeholder: true };
  }

  function localPart(name) { return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, ''); }

  /** The persona of a role (for a store manager: of that store), as the recipient of a notification. */
  function recipient(role, unitId) {
    var users = HB.session.users, dom = mailDomain(), u = null, i;
    for (i = 0; i < users.length && !u; i++) if (users[i].role === role && (!unitId || users[i].unitId === unitId)) u = users[i];
    var label = HB.session.roleLabel(role) + (role === 'store_mgr' && unitId ? ', ' + unitName(unitId) : '');
    var local = u ? localPart(u.name) : localPart(role === 'store_mgr' && unitId ? 'store ' + unitId.replace(/^st_/, '') : role);
    return { toRole: role, toRoleLabel: label, toName: u ? u.name : label, to: local + '@' + dom.domain, placeholder: dom.placeholder };
  }

  var NOTIFY_LABEL = { approval: 'Approval request', overdue: 'Overdue receivable', due: 'Bill falling due', low_stock: 'Low stock', expiry: 'Expiry' };

  var notify = {
    /** The notification log, newest first: approval requests, overdue receivables, bills falling due, low stock, near-expiry and expired stock. */
    list: function () {
      return memo('notify.list', undefined, function (c) {
        var out = [], m = HB.masters, today = c.today;
        if (!sees('notify')) return out;
        function push(kind, key, date, who, subject, text, ref) {
          var n = { id: kind + ':' + key, kind: kind, kindLabel: NOTIFY_LABEL[kind], date: date > today ? today : date, subject: subject, text: text, docId: ref.docId || null, ref: ref };
          n.toRole = who.toRole; n.toRoleLabel = who.toRoleLabel; n.toName = who.toName; n.to = who.to; n.placeholder = who.placeholder;
          out.push(n);
        }
        var owner = recipient('owner'), accounts = recipient('accounts'), storesRole = recipient('stores');

        approvals.pending().items.forEach(function (x) {
          push('approval', x.id, String(x.raisedAt || x.date).slice(0, 10), owner,
            'Approval needed: ' + x.typeLabel.toLowerCase() + ' ' + x.id,
            x.typeLabel + ' ' + x.id + (x.party ? ', ' + x.party : '') + ', ' + fmt.inr2(x.amount) + ', raised by ' + x.raisedByName + '. ' + x.reason + '.',
            { docId: x.id, type: x.type });
        });

        ar.balances().rows.forEach(function (x) {
          if (!(x.overdue > 0)) return;
          var list = (c.book.ar.open[x.customerId] || []).filter(function (d) { return d.dueDate < today; });
          push('overdue', x.customerId, D.addDays(x.oldestDue, 1), accounts,
            'Overdue: ' + x.customerName + ' owes ' + fmt.inr2(x.overdue),
            x.customerName + ' has ' + x.overdueItems + (x.overdueItems === 1 ? ' invoice' : ' invoices') + ' past the due date, ' + fmt.inr2(x.overdue) + ' in all; the oldest was due on ' + D.label(x.oldestDue, 'd MMM yyyy') + '.',
            { docId: list.length ? list[0].id : null, customerId: x.customerId, docIds: list.map(function (d) { return d.id; }) });
        });

        ap.dueWithin().forEach(function (x) {
          var first = D.addDays(x.dueDate, -m.limits.dueSoonDays);
          push('due', x.id, x.overdue ? D.addDays(x.dueDate, 1) : (first < x.date ? x.date : first), accounts,
            (x.overdue ? 'Bill overdue: ' : 'Bill falling due: ') + x.name + ', ' + fmt.inr2(x.open),
            x.typeLabel + ' ' + x.id + ' of ' + x.name + ': ' + fmt.inr2(x.open) + ' to pay, due on ' + D.label(x.dueDate, 'd MMM yyyy') + '.',
            { docId: x.id, type: x.type, payeeType: x.payeeType, payeeId: x.payeeId });
        });

        stock.lowStock().forEach(function (x) {
          push('low_stock', x.itemId, today, storesRole,
            'Low stock: ' + x.itemName,
            x.itemName + ': ' + fmt.qty(x.available, x.unit) + ' available against a reorder level of ' + fmt.qty(x.reorderLevel, x.unit) +
              (x.onOrder > 0 ? '; ' + fmt.qty(x.onOrder, x.unit) + ' on order.' : '; nothing on order.'),
            { docId: null, itemId: x.itemId });
        });

        stock.expiring().forEach(function (x) {
          if (x.locKind === 'transit') return;
          var who = x.locKind === 'store' ? recipient('store_mgr', x.unitId) : storesRole;
          push('expiry', x.batchId + '@' + x.locId, x.flag === 'expired' ? D.addDays(x.bestBefore, 1) : today, who,
            (x.flag === 'expired' ? 'Expired: ' : 'Near expiry: ') + x.itemName + ', batch ' + x.batchId,
            fmt.qty(x.qty, x.unit) + ' of ' + x.itemName + ' (batch ' + x.batchId + ') at ' + x.locName + (x.flag === 'expired' ? ' passed' : (x.qty === 1 ? ' reaches' : ' reach')) + ' the best-before date of ' + D.label(x.bestBefore, 'd MMM yyyy') + '.',
            { docId: x.prodId || null, itemId: x.itemId, batchId: x.batchId, locId: x.locId });
        });

        out.sort(function (a, b) { return a.date > b.date ? -1 : (a.date < b.date ? 1 : (a.id < b.id ? -1 : 1)); });
        return out;
      });
    }
  };

  /* ============================================================ dashboard */
  /*
   * SPEC section 7, last paragraph: which blocks a role gets. Each block is given to the roles that have a page
   * showing the same thing, so nothing is decided twice; home.js draws the blocks it receives and nothing else.
   * Flows (sales, collections, spend, production) are of the period; balances (cash, receivables, payables,
   * approvals, low stock, near-expiry) are as they stand now in both periods. No figure of another period.
   */

  function dashOf(c, from, to, period) {
    var f = { from: from, to: to }, out = { period: period, from: from, to: to, role: c.role, blocks: [] };
    function put(id, value) { out[id] = value; out.blocks.push(id); }
    var s = sees('sales') ? sell.summary(f) : null;
    if (s) put('sales', { gross: s.sales, returns: s.returns, net: s.net, units: s.units, byChannel: s.byChannel.map(function (x) { return { channel: x.channel, label: x.label, gross: x.sales, returns: x.returns, net: x.net, units: x.units }; }) });
    if (s && s.collections) put('collections', s.collections);
    if (lookup.accounts().length) put('cash', cash.balances());
    if (expenseView(c) !== 'own') {
      var e = exp.byUnit(f);
      put('spend', { total: e.totals.amount, byUnit: e.rows.map(function (x) { return { unitId: x.unitId, unitName: x.unitName, amount: x.amount }; }) });
    }
    if (sees('production')) {
      var y = make.yieldByItem(f);
      put('production', { runs: y.totals.runs, expectedUnits: y.totals.expectedUnits, goodUnits: y.totals.goodUnits, rejectedUnits: y.totals.rejectedUnits, 'yield': y.totals['yield'], lossValue: y.totals.lossValue, byItem: y.rows });
    }
    if (sees('ar')) {
      var a = ar.balances();
      put('receivables', {
        open: a.totals.open, credit: a.totals.credit, balance: a.totals.balance, overdue: a.totals.overdue,
        overdueRows: a.rows.filter(function (x) { return x.overdue > 0; }).sort(function (x, z) { return z.overdue - x.overdue; })
          .map(function (x) { return { customerId: x.customerId, customerName: x.customerName, overdue: x.overdue, open: x.open, oldestDue: x.oldestDue, invoices: x.overdueItems }; })
      });
    }
    if (sees('bills')) {
      var p = ap.balances(), claims = ap.toReimburse();
      put('payables', { open: p.totals.open, overdue: p.totals.overdue, dueSoon: p.totals.dueSoon, dueRows: ap.dueWithin(), toReimburse: sumOf(claims, 'open'), claims: claims.length });
    }
    if (sees('approvals')) {
      var w = approvals.pending();
      put('approvals', { count: w.count, byType: w.groups.map(function (g) { return { type: g.type, label: g.label, count: g.count }; }) });
    }
    if (locOk(c, RM)) { var low = stock.lowStock(); put('lowStock', { count: low.length, rows: low }); }
    var near = stock.expiring(), expired = 0, soon = 0;
    near.forEach(function (x) { if (x.flag === 'expired') expired += x.qty; else soon += x.qty; });
    put('nearExpiry', { count: near.length, expiredUnits: expired, nearUnits: soon, rows: near });
    return out;
  }

  function may(action, ctx) {
    var x = HB.session.can(action, ctx);
    return { ok: x.ok, code: x.code, reason: x.reason };
  }

  var dash = {
    /** The dashboard blocks of the business date, for the persona in use. */
    today: function () { return memo('dash.today', undefined, function (c) { return dashOf(c, c.today, c.today, 'today'); }); },

    /** The same blocks for the month to date: the first day of the business date's month to the business date. */
    monthToDate: function () { return memo('dash.monthToDate', undefined, function (c) { return dashOf(c, D.monthStart(c.today), c.today, 'month'); }); },

    /**
     * Today's work: sheets to post, transfers to send and to confirm, orders due for receipt, production to
     * record, day-ends to enter, approvals waiting - and nothing else. The Owner and accounts get every item
     * (with whether they may act); another role only the items it may act on.
     */
    work: function () {
      return memo('dash.work', undefined, function (c) {
        var on = c.today, out = { date: on, count: 0, groups: [] }, pend = stores.pending(on), sent = [];
        function add(kind, label, route, items) {
          items = items.filter(function (it) { return c.all || it.can.ok; });
          if (!items.length) return;
          out.groups.push({ kind: kind, label: label, route: route, count: items.length, items: items });
          out.count += items.length;
        }
        add('sheet', 'Dispatch sheets to post', '#/sell/dispatch', sell.sheets(on).filter(function (s) { return s.toPost; }).map(function (s) {
          return { id: s.sheetId, title: s.routeName, text: fmt.num(s.outlets) + (s.outlets === 1 ? ' outlet' : ' outlets'), docId: null, can: may('dispatch.post'), ref: { routeId: s.routeId, date: on } };
        }));
        add('transfer_send', 'Store transfers to send', '#/stores/transfers', pend.filter(function (x) { return x.toSend; }).map(function (x) {
          return { id: 'send:' + x.storeId, title: x.storeName, text: fmt.num(x.sendUnits) + ' units to top up', docId: null, can: may('xfer.create'), ref: { storeId: x.storeId, date: on } };
        }));
        pend.forEach(function (x) { sent = sent.concat(x.transfersSent); });
        add('transfer_confirm', 'Transfers to confirm at the store', '#/stores/transfers', sent.map(function (x) {
          return { id: x.id, title: x.storeName, text: x.id + ', ' + fmt.num(x.units) + ' units sent on ' + D.label(x.date, 'd MMM'), docId: x.id, can: may('xfer.receive', { doc: x.doc }), ref: { storeId: x.toStoreId } };
        }));
        add('receipt', 'Purchase orders due for receipt', '#/buy/receipts', buy.dueForReceipt(on).map(function (x) {
          return { id: x.id, title: x.vendorName, text: x.id + ', expected ' + D.label(x.expectedDate, 'd MMM'), docId: x.id, can: may('grn.create'), ref: { poId: x.id } };
        }));
        add('production', 'Production to record', '#/make/production', make.todo(on).map(function (x) {
          return { id: 'prod:' + x.itemId, title: x.itemName, text: fmt.num(x.standardMixes, x.standardMixes % 1 ? 1 : 0) + ' x ' + x.mixLabel, docId: null, can: may('prod.create'), ref: { itemId: x.itemId, date: on } };
        }));
        add('dayend', 'Store day-ends to enter', '#/stores/dayend', pend.filter(function (x) { return x.dayEndMissing; }).map(function (x) {
          return { id: 'dayend:' + x.storeId, title: x.storeName, text: 'Day-end of ' + D.label(on, 'd MMM'), docId: null, can: may('dayend.create', { doc: { storeId: x.storeId } }), ref: { storeId: x.storeId, date: on } };
        }));
        add('approval', 'Approvals waiting', '#/approvals', approvals.pending().items.map(function (x) {
          return { id: x.id, title: x.typeLabel + ' ' + x.id, text: (x.party ? x.party + ', ' : '') + fmt.inr2(x.amount), docId: x.id, can: x.canApprove, ref: { type: x.type } };
        }));
        return out;
      });
    }
  };

  /* ================================================================ guide */
  /*
   * A journey is { id, title, steps: [{ text, route, role, match: { op, type, test } }], links: [{ text, route }] }
   * (HB.config.journeys, SPEC 8.1). match.op is the operation of a log entry; match.type the type of the first
   * document the entry made (post, postDispatch) or of the document it acted on (approve, reject, cancel,
   * receiveTransfer); match.test(entry, docs, env), when given, looks at what was entered or computed, with
   * env = { book, masters }. A step is done when an entry matches after the entry that ticked the step before.
   */

  /** The documents a log entry made, or the one it acted on. */
  function entryDocs(c, e) {
    var docs = [], ids = e.out && Array.isArray(e.out.ids) ? e.out.ids : [], i;
    if (e.op === 'post' || e.op === 'postDispatch') {
      for (i = 0; i < ids.length; i++) if (c.book.docs[ids[i]]) docs.push(c.book.docs[ids[i]]);
    } else if (e.args && e.args.id && c.book.docs[e.args.id]) docs.push(c.book.docs[e.args.id]);
    return docs;
  }

  function stepHit(c, step, e, env) {
    var m = step ? step.match : null;
    if (!m || e.op !== m.op) return false;
    var docs = entryDocs(c, e);
    if (m.type && (!docs.length || docs[0].type !== m.type)) return false;
    try { return typeof m.test === 'function' ? !!m.test(e, docs, env) : true; }
    catch (err) { return false; }
  }

  /**
   * An approve step is also ticked when a document of the step before was approved in the same operation: the
   * Owner's own document (SPEC 5.3) carries approval.self and the time of the entry that raised it.
   */
  function approvedWith(c, step, prev, env) {
    var m = step ? step.match : null;
    if (!m || m.op !== 'approve' || !prev || (prev.op !== 'post' && prev.op !== 'postDispatch')) return false;
    var docs = entryDocs(c, prev), i, d, a;
    for (i = 0; i < docs.length; i++) {
      d = docs[i]; a = d.approval;
      if ((m.type && d.type !== m.type) || !a || a.state !== 'approved' || !a.self || a.at !== prev.at) continue;
      try { if (typeof m.test !== 'function' || m.test(prev, [d], env)) return true; }
      catch (err) { /* a test that cannot read the document does not tick the step */ }
    }
    return false;
  }

  /** A link to look at: its route, the parameters that open the screen on what the text names, and the two as one href. */
  function linkOf(l) {
    var route = l.route || '', params = {}, query = [], k;
    for (k in l.params || {}) if (has.call(l.params, k) && l.params[k] !== null && l.params[k] !== undefined && l.params[k] !== '') {
      params[k] = String(l.params[k]);
      query.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));
    }
    return { text: l.text || '', route: route, params: params, href: route + (query.length ? '?' + query.join('&') : '') };
  }

  var guide = {
    /** The "try this" journeys with done per step and per journey, ticked from the user's log. */
    journeys: function () {
      return memo('guide.journeys', undefined, function (c) {
        var list = HB.masters.journeys && HB.masters.journeys.length ? HB.masters.journeys : ((HB.config && HB.config.journeys) || []);
        var skipped = {}, env = { book: c.book, masters: HB.masters };
        (HB.engine.skipped || []).forEach(function (s) { skipped[s.n] = true; });
        var entries = HB.engine.log().filter(function (e) { return e && !skipped[e.n]; });
        return list.map(function (j) {
          var pos = -1, prev = null, alive = true, doneSteps = 0;
          var steps = (j.steps || []).map(function (s, i) {
            var out = { index: i, text: s.text || '', route: s.route || '', role: s.role || '', roleLabel: s.role ? HB.session.roleLabel(s.role) : '', done: false, n: null, at: null, userId: null, userName: '' };
            var hit = null, k;
            if (!alive) return out;
            if (i > 0 && approvedWith(c, s, prev, env)) hit = prev;
            else for (k = pos + 1; k < entries.length; k++) if (stepHit(c, s, entries[k], env)) { hit = entries[k]; pos = k; break; }
            if (!hit) { alive = false; return out; }
            prev = hit; doneSteps++;
            out.done = true; out.n = hit.n; out.at = hit.at; out.userId = hit.userId; out.userName = userName(hit.userId);
            return out;
          });
          return {
            id: j.id, title: j.title || '', steps: steps, doneSteps: doneSteps, done: steps.length > 0 && doneSteps === steps.length,
            next: doneSteps < steps.length ? doneSteps : null,
            links: (j.links || []).map(linkOf)
          };
        });
      });
    }
  };

  /* ============================================================ documents */

  var CANCELLABLE = { PO: 1, GRN: 1, VBILL: 1, PAY: 1, SO: 1, INV: 1, RCPT: 1, CN: 1, PROD: 1, XFER: 1, DAYEND: 1, ADJ: 1, WO: 1, DEP: 1, EXP: 1 };

  function docParty(d) {
    switch (d.type) {
      case 'PO': case 'GRN': case 'VBILL': return { kind: 'vendor', id: d.vendorId, name: vendorName(d.vendorId) };
      case 'PAY': case 'EXP': return { kind: d.payeeType, id: d.payeeId, name: payeeName(d.payeeType, d.payeeId) };
      case 'SO': case 'INV': case 'RCPT': case 'CN': return { kind: 'customer', id: d.customerId, name: customerName(d.customerId) };
      case 'XFER': return { kind: 'unit', id: d.toStoreId, name: unitName(d.toStoreId) };
      case 'DAYEND': return { kind: 'unit', id: d.storeId, name: unitName(d.storeId) };
      case 'DEP': return { kind: 'account', id: d.fromAccount, name: accountName(d.fromAccount) };
      case 'ADJ': case 'WO': return { kind: 'location', id: d.locId, name: locName(d.locId) };
      case 'PROD': return { kind: 'item', id: d.itemId, name: itemName(d.itemId) };
      default: return null;
    }
  }

  /** The one money figure a list or a link shows for a document, or null where it has none. */
  function docAmount(d) {
    var i, t = 0;
    switch (d.type) {
      case 'PO': case 'VBILL': case 'INV': case 'CN': case 'EXP': return d.total;
      case 'PAY': case 'RCPT': case 'DEP': return d.amount;
      case 'DAYEND': return d.gross;
      case 'ADJ': case 'WO': return d.value;
      case 'GRN': for (i = 0; i < d.lines.length; i++) t += money.amount(d.lines[i].qty, d.lines[i].rate); return t;
      case 'SO': for (i = 0; i < d.lines.length; i++) t += money.amount(d.lines[i].qty, d.lines[i].price); return t;
      default: return null;
    }
  }

  function mayCancel(d) {
    var can = HB.session.can('cancel.' + d.type.toLowerCase(), { doc: d });
    if (!can.ok) return { ok: false, code: can.code, reason: can.reason, docId: null };
    var chk = HB.engine.check('cancel', { id: d.id });
    return chk.ok ? { ok: true, code: '', reason: '', docId: null } : { ok: false, code: chk.error.code, reason: chk.error.message, docId: chk.error.docId || null };
  }

  /** What the persona may do with the document, and what it may not, with the reason for the disabled control. */
  function actionsOf(d) {
    var out = [];
    function push(op, label, can) { out.push({ op: op, label: label, ok: !!can.ok, code: can.code || '', reason: can.reason || '', docId: can.docId || null }); }
    if (d.status === 'PENDING' || d.status === 'HELD') { push('approve', 'Approve', mayApprove(d)); push('reject', 'Reject', mayReject(d)); }
    if (d.type === 'XFER' && d.status === 'SENT') push('receiveTransfer', 'Confirm receipt', may('xfer.receive', { doc: d }));
    if (CANCELLABLE[d.type] && !d.opening && d.status !== 'CANCELLED' && d.status !== 'REJECTED') push('cancel', 'Cancel', mayCancel(d));
    return out;
  }

  /** The receipts and credit notes allocated to an invoice, or the payments allocated to a bill or an expense - cancelled ones too. */
  function settlementsOf(c, d) {
    var inv = d.type === 'INV', out = [], i, j, r, x;
    var rows = inv ? c.book.ar.byParty[d.customerId] : c.book.ap.byParty[d.type === 'VBILL' ? 'vendor:' + d.vendorId : d.payeeType + ':' + d.payeeId];
    for (i = 0; rows && i < rows.length; i++) {
      r = rows[i];
      if (r.reversal || (inv ? r.kind !== 'receipt' && r.kind !== 'credit_note' : r.kind !== 'payment')) continue;
      x = c.book.docs[r.docId];
      for (j = 0; x && x.allocations && j < x.allocations.length; j++) if (x.allocations[j].docId === d.id) { out.push({ doc: x, amount: x.allocations[j].amount }); break; }
    }
    return out;
  }

  function relatedOf(c, d) {
    var b = c.book, out = [], seen = {};
    function add(relation, label, id, amount) {
      var x = b.docs[id];
      if (!x || seen[relation + '|' + id] || !docVisible(x)) return;
      seen[relation + '|' + id] = true;
      out.push({
        relation: relation, label: label, id: x.id, type: x.type, typeLabel: docLabel(x), date: x.date, status: x.status, statusLabel: statusLabel(x.status),
        cancelled: x.status === 'CANCELLED', amount: amount === undefined ? docAmount(x) : amount
      });
    }
    function settled(label) { settlementsOf(c, d).forEach(function (s) { add('settlement', (TYPE_LABEL[s.doc.type] || label) + (s.doc.status === 'CANCELLED' ? ' (cancelled)' : ''), s.doc.id, s.amount); }); }
    switch (d.type) {
      case 'PO':
        d.grnIds.forEach(function (id) { add('receipt', 'Goods receipt', id); });
        d.grnIds.forEach(function (id) { if (b.docs[id] && b.docs[id].billId) add('bill', 'Vendor bill', b.docs[id].billId); });
        break;
      case 'GRN':
        add('order', 'Purchase order', d.poId);
        if (d.billId) add('bill', 'Vendor bill', d.billId);
        break;
      case 'VBILL':
        d.grnIds.forEach(function (id) { add('receipt', 'Goods receipt', id); });
        d.grnIds.forEach(function (id) { if (b.docs[id]) add('order', 'Purchase order', b.docs[id].poId); });
        settled('Payment');
        break;
      case 'EXP': settled('Payment'); break;
      case 'PAY': d.allocations.forEach(function (a) { add('paid', 'Pays ' + docLabel(b.docs[a.docId]).toLowerCase(), a.docId, a.amount); }); break;
      case 'SO': if (d.invId) add('invoice', 'Invoice', d.invId); break;
      case 'INV':
        if (d.soId) add('order', 'Sales order', d.soId);
        settled('Receipt');
        break;
      case 'RCPT': case 'CN': (d.allocations || []).forEach(function (a) { add('settles', 'Settles invoice', a.docId, a.amount); }); break;
      case 'DAYEND': if (d.woId) add('writeoff', 'Write-off of the expired units', d.woId); break;
      case 'WO': if (d.sourceDocId) add('source', 'Day-end it came from', d.sourceDocId); break;
      case 'DS': d.invoices.forEach(function (x) { add('invoice', x.cancelled ? 'Invoice (cancelled)' : 'Invoice', x.id); }); break;
      case 'CXL':
        add('target', 'Cancellation of', d.targetId);
        var t = b.docs[d.targetId];
        if (t && t.woId && b.docs[t.woId] && b.docs[t.woId].cancelled && b.docs[t.woId].cancelled.docId === d.id) add('target', 'Also cancels', t.woId);
        (d.creditTakenBack || []).forEach(function (x) { add('credit', 'Credit taken back from', x.docId, x.amount); });
        break;
    }
    if (d.cancelled && d.cancelled.docId) add('cancellation', 'Its cancellation', d.cancelled.docId, null);
    return out;
  }

  function docLines(d) {
    var src = d.type === 'PROD' ? d.consumption : d.lines;
    /* the cost stored on an invoice line goes to the roles that see margins; the others get the line without it */
    var bare = d.type === 'INV' && !sees('margin');
    return (src || []).map(function (l) {
      var x = l.itemId ? lineView(l) : {}, k;
      if (bare) { delete x.unitCost; delete x.cost; }
      if (!l.itemId) for (k in l) if (has.call(l, k)) x[k] = l[k];
      if (l.unitId) x.unitName = unitName(l.unitId);
      if (l.accountId) x.accountName = accountName(l.accountId);
      if (l.locId) x.locName = locName(l.locId);
      return x;
    });
  }

  /**
   * Cost and margin of an invoice as it was posted, for the roles that see margins (the Owner and accounts): the
   * costs stored on its lines, nothing recomputed. margin = taxable - cost; marginPct is a fraction of taxable.
   */
  function invCosting(d) {
    return {
      cost: d.cost, margin: d.taxable - d.cost, marginPct: ratio(d.taxable - d.cost, d.taxable),
      lines: d.lines.map(function (l) {
        return { itemId: l.itemId, itemName: itemName(l.itemId), unit: itemUnit(l.itemId), qty: l.qty, unitCost: l.unitCost, cost: l.cost,
          margin: l.taxable - l.cost, marginPct: ratio(l.taxable - l.cost, l.taxable) };
      })
    };
  }

  /** May the persona cancel the posted sheet? The rights first, then what the engine would say now: an invoice with a receipt against it holds the whole sheet. */
  function maySheetCancel(s) {
    var can = HB.session.can('dispatch.cancel');
    if (!can.ok) return { ok: false, code: can.code, reason: can.reason, docId: null };
    var chk = HB.engine.check('cancelDispatch', { sheetId: s.id });
    return chk.ok ? { ok: true, code: '', reason: '', docId: null } : { ok: false, code: chk.error.code, reason: chk.error.message, docId: chk.error.docId || null };
  }

  /**
   * A dispatch sheet (sell.sheet) in the shape of a document view, so that '#/doc/DS-...' and a page treat it like
   * one: the route as its party, the quantities by product of its uncancelled invoices as its lines, who posted it.
   * It has no status of its own ('POSTED' once an uncancelled invoice carries its id). A posted sheet has one
   * action, 'cancelDispatch': every invoice of the sheet in one go, or none (API 3.6).
   */
  function sheetView(s) {
    var first = null, at = {}, lines = [], actions = [], i, j, d, l, x, can;
    if (s.posted) {
      can = maySheetCancel(s);
      actions.push({ op: 'cancelDispatch', label: 'Cancel the sheet', ok: can.ok, code: can.code, reason: can.reason, docId: can.docId });
    }
    for (i = 0; i < s.invoices.length; i++) {
      d = s.invoices[i].doc;
      if (d.status === 'CANCELLED') continue;
      if (!first) first = d;
      for (j = 0; j < d.lines.length; j++) {
        l = d.lines[j]; x = at[l.itemId];
        if (!x) { x = at[l.itemId] = { itemId: l.itemId, itemName: itemName(l.itemId), unit: itemUnit(l.itemId), qty: 0, taxable: 0 }; lines.push(x); }
        x.qty += l.qty; x.taxable += l.taxable;
      }
    }
    return {
      id: s.id, type: s.type, typeLabel: s.typeLabel, date: s.date, status: s.posted ? 'POSTED' : '', statusLabel: s.posted ? statusLabel('POSTED') : 'Not posted',
      cancelled: false, seed: !!(first && first.seed), createdBy: first ? first.createdBy || null : null, createdByName: userName(first ? first.createdBy : null),
      createdAt: first ? first.createdAt || '' : '', note: '', doc: s,
      party: { kind: 'route', id: s.routeId, name: s.routeName }, amount: s.total, lines: lines,
      approval: { state: 'none', by: null, byName: '', at: null, reason: '', self: false }, cancellation: null, target: null, actions: actions
    };
  }

  /* Entered as a record of what happened; the other types are raised, and may wait for an approval or be answered by another document. */
  var ENTERED = { GRN: 1, PROD: 1, RCPT: 1, PAY: 1, DEP: 1, DAYEND: 1, XFER: 1 };

  var doc = {
    /**
     * The document with that id as the book holds it (read-only), or null when there is none or the persona may
     * not see it. The id of a dispatch sheet gives its record (sell.sheet): type 'DS', which is what the router reads.
     */
    get: function (id) {
      var c = stamp(), d = c.book.docs[id];
      if (!d && sheetKey(id)) return sell.sheet(id);
      return d && docVisible(d) ? d : null;
    },

    /** The document ready for a document view: labels, party, lines with item names, the approval, the cancellation and the actions. */
    view: function (id) {
      return memo('doc.view', String(id), function (c) {
        var d = doc.get(id);
        if (!d) return null;
        if (d.type === 'DS') return sheetView(d);
        var r = base(d), a = d.approval || {}, x = d.cancelled;
        r.party = docParty(d); r.amount = docAmount(d); r.lines = docLines(d);
        r.approval = { state: a.state || 'none', by: a.by || null, byName: userName(a.by), at: a.at || null, reason: a.reason || '', self: !!a.self };
        r.cancellation = x ? { by: x.by, byName: userName(x.by), at: x.at, reason: x.reason, docId: x.docId } : null;
        r.target = d.type === 'CXL' ? c.book.docs[d.targetId] || null : null;
        r.warned = d.warned ? d.warned.slice() : [];
        r.warning = warningOf(c, d);
        if (d.type === 'INV') r.costing = !d.opening && sees('margin') ? invCosting(d) : null;
        r.actions = actionsOf(d);
        return r;
      });
    },

    /** Who did what to the document and when, oldest first, from the audit trail. */
    timeline: function (id) {
      return memo('doc.timeline', String(id), function (c) {
        if (!doc.get(id)) return [];
        return auditOf(c, id).map(function (a) {
          var r = auditRow(c, a);
          r.label = a.action === 'post' && !ENTERED[a.type] ? 'Raised' : r.actionLabel;
          r.statusLabel = a.after ? statusLabel(a.after) : '';
          return r;
        });
      });
    },

    /** The documents that hang together with this one, among those the persona may see. */
    related: function (id) {
      return memo('doc.related', String(id), function (c) {
        var d = doc.get(id);
        return d ? relatedOf(c, d) : [];
      });
    }
  };

  /* ============================================================== reports */
  /*
   * Every register of SCOPE 4.10 in one shape, so that one page can show and export them all:
   * { id, title, group, from, to, columns: [{ key, label, align, format }], rows, totals, note }.
   * format is a name HB.ui.table knows (inr, inrFull, inr2, rate, num, num1, pct, qty - the HB.fmt names -
   * and date), or 'text'. A qty cell takes its unit from row.unit. totals is keyed like a row, or null.
   */

  var NUMERIC = { inr: 1, inrFull: 1, inr2: 1, rate: 1, num: 1, num1: 1, pct: 1, qty: 1 };

  function col(key, label, format, extra) {
    var out = { key: key, label: label, align: NUMERIC[format] ? 'right' : 'left', format: format || 'text' }, k;
    for (k in extra || {}) if (has.call(extra, k)) out[k] = extra[k];
    return out;
  }

  var DOC = { doc: true }; /* the cell holds a document id: the page links it to #/doc/<id> */
  var BLANK_ZERO = { blank: true }; /* an in or an out column: a row is one or the other, and the side that is zero stays empty, as on the screen that owns the book */

  function byDimReport(dim, head) {
    return function (f) {
      var x = sell.by(dim, f);
      return {
        from: x.from, to: x.to, rows: x.rows, totals: x.totals,
        columns: [col('label', head), col('units', 'Units', 'num'), col('sales', 'Sales', 'inr2'), col('returns', 'Stale returns', 'inr2'), col('net', 'Net sales', 'inr2'),
          col('cogs', 'Cost of goods sold', 'inr2'), col('margin', 'Margin', 'inr2'), col('marginPct', 'Margin %', 'pct'), col('share', 'Share of net sales', 'pct')]
      };
    };
  }

  function ageColumns(first) {
    return first.concat(BUCKETS.map(function (b) { return col(b.key, b.label, 'inr2'); })).concat([col('open', 'Outstanding', 'inr2')]);
  }

  var REPORTS = [
    { id: 'sales_register', title: 'Sales register', group: 'Sales', filters: ['range', 'unit', 'channel'], run: function (f) {
      var x = sell.register(f);
      return {
        from: x.from, to: x.to, rows: x.rows, totals: x.totals,
        columns: [col('date', 'Date', 'date'), col('docId', 'Document', 'text', DOC), col('typeLabel', 'Type'), col('party', 'Customer or store'), col('channelLabel', 'Channel'),
          col('units', 'Units', 'num'), col('taxable', 'Taxable value', 'inr2'), col('cgst', 'CGST', 'inr2'), col('sgst', 'SGST', 'inr2'), col('total', 'Total', 'inr2'), col('note', 'Note')]
      };
    } },
    { id: 'sales_by_item', title: 'Sales by item', group: 'Sales', filters: ['range', 'unit', 'channel'], run: byDimReport('item', 'Item') },
    { id: 'sales_by_customer', title: 'Sales by customer', group: 'Sales', filters: ['range', 'unit', 'channel'], run: byDimReport('customer', 'Customer') },
    { id: 'sales_by_route', title: 'Sales by route', group: 'Sales', filters: ['range', 'unit', 'channel'], run: byDimReport('route', 'Route') },
    { id: 'sales_by_channel', title: 'Sales by channel', group: 'Sales', filters: ['range', 'unit'], run: byDimReport('channel', 'Channel') },
    { id: 'returns', title: 'Stale returns', group: 'Sales', filters: ['range', 'channel'], run: function (f) {
      var x = sell.returns(f);
      return {
        from: x.from, to: x.to, totals: x.totals,
        rows: x.rows.map(function (r) { var o = {}, k; for (k in r) o[k] = r[k]; o.share = r.sharePct === null || r.sharePct === undefined ? null : r.sharePct / 100; return o; }),
        columns: [col('date', 'Date', 'date'), col('docId', 'Document', 'text', DOC), col('customerName', 'Outlet'), col('routeName', 'Route'), col('units', 'Units', 'num'),
          col('taxable', 'Taxable value', 'inr2'), col('gst', 'GST', 'inr2'), col('total', 'Total', 'inr2'), col('share', 'Share of seven days of supply', 'pct'), col('note', 'Note')]
      };
    } },
    { id: 'production_register', title: 'Production register with yield', group: 'Production', filters: ['range', 'item'], run: function (f) {
      var x = make.register(f);
      return {
        from: x.from, to: x.to, rows: x.rows, totals: x.totals,
        columns: [col('date', 'Date', 'date'), col('docId', 'Document', 'text', DOC), col('itemName', 'Product'), col('batchId', 'Batch'), col('mixes', 'Mixes', 'num1'),
          col('expectedUnits', 'Expected units', 'num'), col('goodUnits', 'Good units', 'num'), col('rejectedUnits', 'Rejected units', 'num'), col('yield', 'Yield', 'pct'),
          col('unitCost', 'Unit cost', 'rate'), col('lossValue', 'Production loss', 'inr2'), col('note', 'Note')]
      };
    } },
    { id: 'stock_statement', title: 'Stock statement', group: 'Stock', filters: ['range', 'location', 'item'], run: function (f) {
      var x = stock.statement(f);
      return {
        from: x.from, to: x.to, rows: x.rows, totals: x.totals,
        columns: [col('locName', 'Location'), col('itemName', 'Item'), col('opening', 'Opening', 'qty'), col('qtyIn', 'In', 'qty'), col('qtyOut', 'Out', 'qty'),
          col('closing', 'Closing', 'qty'), col('rate', 'Cost today', 'rate'), col('value', 'Closing value at today\'s cost', 'inr2')]
      };
    } },
    { id: 'stock_ledger', title: 'Stock ledger', group: 'Stock', filters: ['range', 'location', 'item'], run: function (f) {
      var x = stock.ledger(f), one = oneId(f.itemId), it = one ? HB.masters.itemById[one] : null;
      return {
        /* a quantity total means something for one item only: kilograms and pieces do not add */
        from: x.from, to: x.to, rows: x.rows, totals: it ? { qtyIn: x.qtyIn, qtyOut: x.qtyOut, unit: it.unit || '' } : null,
        note: [x.truncated ? 'Showing the first ' + fmt.num(x.rows.length) + ' of ' + fmt.num(x.count) + ' rows. Narrow the dates, the location or the item to see the rest.' : '',
          x.closing === null ? 'Choose one stock location and one item to see the running balance.' : ''].filter(Boolean).join(' '),
        columns: [col('date', 'Date', 'date'), col('docId', 'Document', 'text', DOC), col('kindLabel', 'Movement'), col('locName', 'Location'), col('itemName', 'Item'), col('batchId', 'Batch'),
          col('qtyIn', 'In', 'qty', BLANK_ZERO), col('qtyOut', 'Out', 'qty', BLANK_ZERO), col('balance', 'Balance', 'qty'), col('note', 'Note')]
      };
    } },
    { id: 'expiry', title: 'Expiry', group: 'Stock', filters: ['location', 'item'], run: function (f) {
      var rows = stock.batches({ locId: f.locId, itemId: f.itemId });
      return {
        from: null, to: null, rows: rows, totals: { value: sumOf(rows, 'value') },
        columns: [col('locName', 'Location'), col('itemName', 'Product'), col('batchId', 'Batch'), col('mfgDate', 'Made on', 'date'), col('bestBefore', 'Best before', 'date'),
          col('daysLeft', 'Days left', 'num'), col('qty', 'On hand', 'qty'), col('reserved', 'On a write-off request', 'qty'), col('flagLabel', 'Status'), col('value', 'Value at today\'s cost', 'inr2')]
      };
    } },
    { id: 'purchase_register', title: 'Purchase register', group: 'Purchases', filters: ['range'], run: function (f) {
      var x = buy.register(f);
      return {
        from: x.from, to: x.to, rows: x.rows, totals: x.totals,
        columns: [col('date', 'Date', 'date'), col('docId', 'Document', 'text', DOC), col('billNo', 'Bill number'), col('vendorName', 'Vendor'),
          col('taxable', 'Taxable value', 'inr2'), col('cgst', 'CGST', 'inr2'), col('sgst', 'SGST', 'inr2'), col('total', 'Total', 'inr2'), col('note', 'Note')]
      };
    } },
    { id: 'order_status', title: 'Purchase order status', group: 'Purchases', filters: ['range'], run: function (f) {
      var r = rangeOf(f), rows = [], totals = { amount: 0, toComeValue: 0 };
      buy.orders({ from: r.from, to: r.to, vendorId: f.vendorId }).forEach(function (o) {
        /* the footer is the value of the orders that stand: a cancelled or rejected order is listed under its status and not added */
        var stands = o.status !== 'CANCELLED' && o.status !== 'REJECTED';
        o.doc.lines.forEach(function (l) {
          var toCome = o.open ? q3(l.qty - l.received) : 0, row = {
            date: o.date, docId: o.id, vendorName: o.vendorName, itemName: itemName(l.itemId), unit: itemUnit(l.itemId), qty: l.qty, received: l.received,
            toCome: toCome, toComeValue: money.amount(toCome, l.rate), rate: l.rate, amount: l.amount, expectedDate: o.expectedDate, statusLabel: o.statusLabel
          };
          rows.push(row);
          if (stands) { totals.amount += l.amount; totals.toComeValue += row.toComeValue; }
        });
      });
      return {
        from: r.from, to: r.to, rows: rows, totals: totals,
        columns: [col('date', 'Date', 'date'), col('docId', 'Order', 'text', DOC), col('vendorName', 'Vendor'), col('itemName', 'Item'), col('qty', 'Ordered', 'qty'), col('received', 'Received', 'qty'),
          col('toCome', 'Still to come', 'qty'), col('rate', 'Rate', 'rate'), col('amount', 'Amount', 'inr2'), col('toComeValue', 'Still to come, value', 'inr2'), col('expectedDate', 'Expected', 'date'), col('statusLabel', 'Status')]
      };
    } },
    { id: 'ar_ageing', title: 'Receivables ageing', group: 'Accounts', filters: [], run: function () {
      var x = ar.ageing(), t = {}, k;
      for (k in x.totals) t[k] = x.totals[k];
      t.unapplied = -x.totals.credit;
      return {
        from: null, to: null, totals: t,
        rows: x.rows.map(function (r) { var o = {}, j; for (j in r) o[j] = r[j]; o.unapplied = -r.credit; return o; }),
        columns: ageColumns([col('customerName', 'Customer'), col('channelLabel', 'Channel')]).concat([col('unapplied', 'Unapplied credit', 'inr2'), col('balance', 'Balance', 'inr2')])
      };
    } },
    { id: 'ap_ageing', title: 'Payables ageing', group: 'Accounts', filters: [], run: function () {
      var x = ap.ageing();
      return { from: null, to: null, rows: x.rows, totals: x.totals, columns: ageColumns([col('name', 'Vendor')]) };
    } },
    { id: 'cash_book', title: 'Cash and bank book', group: 'Accounts', filters: ['range', 'account'], run: function (f) {
      var r = rangeOf(f), c = stamp(), rows = [], totals = { 'in': 0, out: 0 };
      /* every account in scope, a closed store's too: its history outlives its closing. A closed account with nothing in the range and nothing left is skipped */
      HB.masters.accounts.forEach(function (a) {
        if (!accountOk(c, a.id) || !oneOf(f.accountId, a.id)) return;
        var x = cash.book(a.id, f);
        if (a.active === false && !x.rows.length && x.closing === 0) return;
        rows.push({ accountName: a.name, date: r.from, docId: null, kindLabel: 'Balance brought forward', party: '', 'in': null, out: null, balance: x.opening, note: '' });
        x.rows.forEach(function (row) { var o = {}, k; for (k in row) o[k] = row[k]; o.accountName = a.name; rows.push(o); });
        totals['in'] += x.totalIn; totals.out += x.totalOut;
      });
      return {
        from: r.from, to: r.to, rows: rows, totals: totals,
        columns: [col('accountName', 'Account'), col('date', 'Date', 'date'), col('docId', 'Document', 'text', DOC), col('kindLabel', 'Entry'), col('party', 'Party'),
          col('in', 'Money in', 'inr2', BLANK_ZERO), col('out', 'Money out', 'inr2', BLANK_ZERO), col('balance', 'Balance', 'inr2'), col('note', 'Note')]
      };
    } },
    { id: 'expenses', title: 'Expenses by category and location', group: 'Accounts', filters: ['range', 'unit'], run: function (f) {
      var x = exp.byCategory(f), rows = [];
      x.rows.forEach(function (cat) {
        HB.masters.units.forEach(function (u) {
          if (cat.byUnit[u.id] !== undefined) rows.push({ categoryId: cat.categoryId, categoryName: cat.categoryName, unitId: u.id, unitName: u.name, amount: cat.byUnit[u.id] });
        });
      });
      return { from: x.from, to: x.to, rows: rows, totals: x.totals, columns: [col('categoryName', 'Category'), col('unitName', 'Location'), col('amount', 'Amount before GST', 'inr2')] };
    } },
    { id: 'product_margin', title: 'Product cost and margin', group: 'Accounts', filters: ['range', 'unit', 'channel'], run: function (f) {
      var x = margin.byItem(f);
      return {
        from: x.from, to: x.to, rows: x.rows, totals: x.totals,
        columns: [col('itemName', 'Product'), col('units', 'Units', 'num'), col('sales', 'Sales', 'inr2'), col('returns', 'Stale returns', 'inr2'), col('net', 'Net sales', 'inr2'),
          col('cogs', 'Cost of goods sold', 'inr2'), col('margin', 'Margin', 'inr2'), col('marginPct', 'Margin %', 'pct'), col('avgPrice', 'Average price', 'rate'),
          col('avgCost', 'Average cost', 'rate'), col('unitCost', 'Unit cost today', 'rate')]
      };
    } },
    { id: 'pnl_monthly', title: 'Monthly profit and loss', group: 'Accounts', filters: ['range'], run: function (f) {
      var r = rangeOf(f), c = stamp(), months = monthsToDate().filter(function (mk) { return mk >= r.from.slice(0, 7) && mk <= r.to.slice(0, 7); });
      var rows = [], at = {}, columns = [col('label', 'Line')];
      months.forEach(function (mk) {
        var p = pnlOf(c, mk);
        columns.push(col('m_' + mk, p.label, 'inr2', { monthKey: mk }));
        p.lines.forEach(function (l) {
          var row = at[l.key];
          if (!row) { row = at[l.key] = { key: l.key, label: l.label, strong: l.strong, total: 0 }; rows.push(row); }
          row['m_' + mk] = l.amount;
          row.total += l.amount;
        });
      });
      /* the lines in statement order: an expense category that appears only in a later month goes with the other expenses */
      var order = ['netSales.retail', 'netSales.corporate', 'netSales.store', 'netSales', 'returns', 'cogs', 'prodLoss', 'writeoff', 'countDiff', 'materialCost', 'grossMargin'];
      function rankOf(k) { var i = order.indexOf(k); return i !== -1 ? i : (k === 'expenseTotal' ? 1000 : (k === 'operatingProfit' ? 1001 : 500)); }
      rows.forEach(function (row, i) { row.n = i; months.forEach(function (mk) { if (row['m_' + mk] === undefined) row['m_' + mk] = 0; }); });
      rows.sort(function (a, b) { return rankOf(a.key) - rankOf(b.key) || a.n - b.n; });
      columns.push(col('total', 'Total', 'inr2'));
      /* the P&L is by month: a column covers its whole month (the business date's month to that date), and the range says so */
      var from = months.length ? months[0] + '-01' : r.from, to = months.length ? D.min(D.monthEnd(months[months.length - 1] + '-01'), c.today) : r.to;
      var note = from !== r.from || to !== r.to ? 'The P&L is by month: the figures cover ' + D.label(from, 'd MMM yyyy') + ' to ' + D.label(to, 'd MMM yyyy') + '.' : '';
      return { from: from, to: to, rows: rows, totals: null, columns: columns, note: note };
    } },
    { id: 'gst_summary', title: 'GST summary', group: 'Accounts', filters: ['range'], run: function (f) {
      var x = gst.summary(f), rows = [];
      function side(name, list, t) {
        list.forEach(function (g) { rows.push({ side: name, label: g.label, taxable: g.taxable, cgst: g.cgst, sgst: g.sgst, tax: g.tax, strong: false }); });
        rows.push({ side: name, label: 'Total, taxable turnover only', taxable: t.taxable, cgst: t.cgst, sgst: t.sgst, tax: t.tax, strong: true });
      }
      side('Output (sales)', x.output, x.outputTotals);
      side('Input (purchases and expenses)', x.input, x.inputTotals);
      rows.push({ side: 'Net', label: 'Output less input', taxable: null, cgst: x.net.cgst, sgst: x.net.sgst, tax: x.net.tax, strong: true });
      return {
        from: x.from, to: x.to, rows: rows, totals: null,
        columns: [col('side', 'Side'), col('label', 'Rate'), col('taxable', 'Taxable value', 'inr2'), col('cgst', 'CGST', 'inr2'), col('sgst', 'SGST', 'inr2'), col('tax', 'GST', 'inr2')]
      };
    } },
    { id: 'audit_log', title: 'Audit log', group: 'System', filters: ['range'], run: function (f) {
      var x = audit.list(f);
      return {
        from: x.from, to: x.to, totals: null,
        /* a master change names a record, not a document: it goes in a column of its own, so that only document ids are linked */
        rows: x.rows.map(function (a) {
          var o = {}, k, onOff = a.action === 'setActive';
          for (k in a) o[k] = a[k];
          o.docId = a.isMaster ? null : a.docId; o.record = a.isMaster ? a.docId : null;
          /* before and after: the status of a document; for a master record whether it was active. The values a change touched are on the audit log screen */
          o.beforeLabel = a.isMaster ? (onOff && a.before ? (a.before.active === false ? 'Inactive' : 'Active') : '') : (a.before ? statusLabel(a.before) : '');
          o.afterLabel = a.isMaster ? (onOff && a.after ? (a.after.active === false ? 'Inactive' : 'Active') : '') : (a.after ? statusLabel(a.after) : '');
          return o;
        }),
        note: [x.truncated ? 'Showing the latest ' + fmt.num(x.rows.length) + ' of ' + fmt.num(x.count) + ' entries. Narrow the dates to see the rest.' : '',
          x.rows.some(function (a) { return a.isMaster && a.action === 'master'; }) ? 'For a change to an item, a customer or another record, the Audit log screen shows each value before and after.' : ''].filter(Boolean).join(' '),
        columns: [col('date', 'Date', 'date'), col('time', 'Time'), col('userName', 'Who'), col('roleLabel', 'Role'), col('actionLabel', 'What'), col('typeLabel', 'On'), col('docId', 'Document', 'text', DOC), col('recordName', 'Record'),
          col('beforeLabel', 'Before'), col('afterLabel', 'After'), col('note', 'Note')]
      };
    } }
  ];

  var REPORT_BY_ID = {};
  REPORTS.forEach(function (r) { REPORT_BY_ID[r.id] = r; });

  /** The production register: one row per entry on its date, a cancellation as a negative row on its own date. */
  make.register = function (f) {
    f = f || {};
    return memo('make.register', f, function (c) {
      var r = rangeOf(f), rows = [], totals = { runs: 0, mixes: 0, expectedUnits: 0, goodUnits: 0, rejectedUnits: 0, lossValue: 0, 'yield': null };
      if (sees('production')) {
        eachDay(r.from, r.to, function (day) {
          for (var i = 0; i < day.docs.length; i++) {
            var d = day.docs[i], t = null, sign = 1;
            if (d.type === 'PROD') t = d;
            else if (d.type === 'CXL' && d.targetType === 'PROD') { t = c.book.docs[d.targetId]; sign = -1; }
            if (!t || !oneOf(f.itemId, t.itemId)) continue;
            rows.push({
              date: d.date, docId: d.id, prodId: t.id, itemId: t.itemId, itemName: itemName(t.itemId), unit: itemUnit(t.itemId), batchId: t.batchId,
              mixes: sign * t.mixes, expectedUnits: sign * t.expectedUnits, goodUnits: sign * t.goodUnits, rejectedUnits: sign * t.rejectedUnits,
              'yield': ratio(t.goodUnits, t.expectedUnits), unitCost: t.unitCost, lossValue: sign * t.lossValue, reversal: sign < 0,
              note: sign < 0 ? 'Cancellation of ' + t.id + (d.reason ? ': ' + d.reason : '') : ''
            });
            totals.runs += sign; totals.mixes = q3(totals.mixes + sign * t.mixes); totals.expectedUnits = q3(totals.expectedUnits + sign * t.expectedUnits);
            totals.goodUnits += sign * t.goodUnits; totals.rejectedUnits += sign * t.rejectedUnits; totals.lossValue += sign * t.lossValue;
          }
        });
        totals['yield'] = ratio(totals.goodUnits, totals.expectedUnits);
      }
      return { from: r.from, to: r.to, rows: rows, totals: totals };
    });
  };

  var MONEY_FORMATS = { inr: 1, inrFull: 1, inr2: 1, rate: 1 };

  var reports = {
    /** The registers the persona may run: [{ id, title, group, filters }]. filters names the controls that apply: range, unit, channel, location, item, account. */
    list: function () {
      if (!sees('reports')) return [];
      return REPORTS.map(function (r) { return { id: r.id, title: r.title, group: r.group, filters: r.filters.slice() }; });
    },

    /** Run one register. f: { from, to, unitIds, unitId, channel, locId, itemId, accountId, vendorId, customerId, limit }. */
    run: function (id, f) {
      f = f || {};
      return memo('reports.run', [id, f], function () {
        var def = REPORT_BY_ID[id];
        if (!def) throw new Error('HB.data.reports.run: unknown report ' + id);
        var out = { id: def.id, title: def.title, group: def.group, from: null, to: null, columns: [], rows: [], totals: null, note: '' };
        if (!sees('reports')) return out;
        var x = def.run(f);
        out.from = x.from; out.to = x.to; out.columns = x.columns; out.rows = x.rows; out.totals = x.totals || null; out.note = x.note || '';
        return out;
      });
    },

    /** One cell as text, formatted as its column says. */
    cell: function (column, row) {
      var v = row ? row[column.key] : undefined;
      if (v === null || v === undefined || v === '') return column.format === 'text' ? '' : '-';
      if (column.blank && v === 0) return '';
      switch (column.format) {
        case 'inr': return fmt.inr(v);
        case 'inrFull': return fmt.inrFull(v);
        case 'inr2': return fmt.inr2(v);
        case 'rate': return fmt.rate(v);
        case 'num': return fmt.num(v);
        case 'num1': return fmt.num(v, 1);
        case 'pct': return fmt.pct(v);
        case 'qty': return fmt.qty(v, row.unit);
        case 'date': return D.label(String(v), 'd MMM yyyy');
        default: return String(v);
      }
    },

    /** The columns of a result with value(row) for HB.ui.downloadCsv: money in rupees, a percentage as a number, the rest as held. */
    csvColumns: function (result) {
      return (result && result.columns ? result.columns : []).map(function (cl) {
        return {
          key: cl.key, label: cl.label,
          value: function (row) {
            var v = row[cl.key];
            if (v === null || v === undefined || (cl.blank && v === 0)) return '';
            /* a rate may carry a fraction of a paisa: four decimals of a rupee, and no tail of binary noise in the file */
            if (cl.format === 'rate') return Math.round(v * 100) / 10000;
            if (MONEY_FORMATS[cl.format]) return Math.round(money.toRupees(v) * 100) / 100;
            if (cl.format === 'pct') return Math.round(v * 10000) / 100;
            return v;
          }
        };
      });
    }
  };

  /* =============================================================== export */

  HB.data = {
    stock: stock, buy: buy, make: make, sell: sell, stores: stores, ar: ar, ap: ap, cash: cash,
    pnl: pnl, margin: margin, gst: gst, exp: exp, people: people,
    approvals: approvals, audit: audit, notify: notify, dash: dash, guide: guide, doc: doc,
    reports: reports, lookup: lookup,
    /** Forget every remembered result. Never needed after HB.engine.act or boot; for a test that changes the book by hand. */
    reset: function () { cache = null; auditIndex.book = null; },
    /** true once there is a book to read. */
    ready: function () { return !!(HB.book && HB.masters); }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = HB.data;
})(typeof window !== 'undefined' ? window : globalThis);
