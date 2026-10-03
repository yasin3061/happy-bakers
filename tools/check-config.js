/*
 * The check of js/data/config.js against docs/RESEARCH.md. Run it after any change to the config:
 *   node tools/check-config.js          every section, a one-line summary each
 *   node tools/check-config.js -v       also the month-by-month comparison with RESEARCH 11.6
 * Exit code 1 on any failure, with a readable list.
 *
 * The expected figures below were typed from the tables of RESEARCH.md (the section is named beside each);
 * none was copied from a run of the config. Where the config derives a figure by a rule (a standing order,
 * a credit limit, a GSTIN check character, a best-before date) the check holds the worked-out table, and
 * where the config holds a table the check re-derives it by the rule.
 */
'use strict';

var path = require('path');
var ROOT = path.join(__dirname, '..');
var HB = require(path.join(ROOT, 'js', 'core', 'kernel.js'));
require(path.join(ROOT, 'js', 'data', 'config.js'));
require(path.join(ROOT, 'js', 'data', 'engine.js'));

var C = HB.config, S = C.sim, D = HB.dates;
var VERBOSE = process.argv.indexOf('-v') !== -1;

/* ====================================================== the assert kit */

var sections = [], sec = null;

function section(title, fn) {
  sec = { title: title, checks: 0, failures: [], notes: [] };
  sections.push(sec);
  try { fn(); }
  catch (e) { sec.failures.push('stopped by an error: ' + (e && e.stack ? e.stack.split('\n').slice(0, 4).join(' | ') : String(e))); }
}
function ok(label, cond, detail) {
  sec.checks++;
  if (!cond) sec.failures.push(label + (detail ? ': ' + detail : ''));
  return !!cond;
}
function eq(label, got, want) {
  var a = JSON.stringify(got), b = JSON.stringify(want);
  return ok(label, a === b, 'expected ' + b + ', got ' + a);
}
/** Equal within a tolerance (the RESEARCH tables are rounded). */
function near(label, got, want, tol) {
  return ok(label, Math.abs(got - want) <= tol, 'expected ' + want + ' within ' + tol + ', got ' + (Math.round(got * 1000) / 1000));
}
function note(text) { sec.notes.push(text); }

/* ====================================================== small helpers */

function rs(x) { return Math.round(x * 100); }
function sum(list, fn) { var t = 0; for (var i = 0; i < list.length; i++) t += fn ? fn(list[i], i) : list[i]; return t; }
function byId(list) { var o = {}; list.forEach(function (r) { o[r.id] = r; }); return o; }
function keys(o) { return Object.keys(o || {}); }
function round2(x) { return Math.round(x * 100) / 100; }

var ITEM = byId(C.items), CUST = byId(C.customers), VEND = byId(C.vendors), EMP = byId(C.employees),
  UNIT = byId(C.units), LOC = byId(C.locations), ACC = byId(C.accounts), CAT = byId(C.expenseCategories),
  USER = byId(C.users), ROUTE = byId(C.routes);
var RECIPE = {};
C.recipes.forEach(function (r) { RECIPE[r.itemId] = r; });

var FG = ['FG01', 'FG02', 'FG03', 'FG04', 'FG05', 'FG06', 'FG07', 'FG08', 'FG09', 'FG10', 'FG11', 'FG12', 'FG13', 'FG14', 'FG15', 'FG16', 'FG17', 'FG18'];
var STORES = ['st_anand', 'st_vvn', 'st_nadiad'];
var OUTLETS = C.customers.filter(function (c) { return c.channel === 'retail'; });
var CORPS = C.customers.filter(function (c) { return c.channel === 'corporate'; });
var ALL_EMPLOYEES = C.employees.concat(S.people.joiners);
var ALL_EMP = byId(ALL_EMPLOYEES);
/* every day the rules must hold on: a rule that names a weekday is tested on all 730, closed days and the days after them included */
var ALL_DAYS = D.range('2026-01-01', '2027-12-31');
/** The weekday of a date as RESEARCH numbers it (Sun = 0 ... Sat = 6), written apart from the config and the kernel. */
function researchDow(iso) { return new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))).getUTCDay(); }

/** The check's own GSTIN check character (RESEARCH 5.1), written apart from the config's. */
function gstinCheck(g) {
  var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', total = 0, i, v, p;
  for (i = 0; i < 14; i++) {
    v = chars.indexOf(g.charAt(i));
    if (v < 0) return '?';
    p = v * (i % 2 ? 2 : 1);
    total += (p - p % 36) / 36 + p % 36;
  }
  return chars.charAt((36 - total % 36) % 36);
}

/** Unit recipe cost in paise at the purchase prices of a month: materials per mix / expected units + packing per unit. */
function recipeCost(itemId, monthKey) {
  var r = RECIPE[itemId];
  return sum(r.materials, function (m) { return m.qty * S.prices.inMonth(m.itemId, monthKey); }) / r.expectedUnits +
    sum(r.packing, function (p) { return p.qtyPerUnit * S.prices.inMonth(p.itemId, monthKey); });
}
/** What a store keeps of an MRP sale before GST, in paise (not rounded). */
function realisation(itemId, list) { return list[itemId].mrp / (1 + ITEM[itemId].gstRate / 100); }

var LIST_DATES = { opening: '2026-01-01', rev1: '2026-07-01', rev2: '2027-04-01' };
var LISTS = { opening: S.priceListOn('2026-01-01'), rev1: S.priceListOn('2026-07-01'), rev2: S.priceListOn('2027-04-01') };

/** Corporate orders a week by the pattern alone (every factor 1.00): the weekly average of RESEARCH 11.2. */
function ordersAWeek(c) { return c.pattern.alternate ? 3.5 : c.pattern.weekdays.length; }
function orderValue(c, list) { return sum(c.pattern.lines, function (l) { return l.qty * list[l.itemId].corporate; }); }
function standingValue(c, list) { return sum(keys(c.standing), function (k) { return c.standing[k] * list[k].retail; }); }

/** Units of a normal day by channel (RESEARCH 11.3): outlets' standing, corporates' weekly average, stores' sale. */
function normalDayUnits(itemId) {
  return {
    retail: sum(OUTLETS, function (c) { return c.standing[itemId] || 0; }),
    corporate: sum(CORPS, function (c) { return sum(c.pattern.lines, function (l) { return l.itemId === itemId ? l.qty * ordersAWeek(c) / 7 : 0; }); }),
    store: sum(STORES, function (s) { return S.stores.sale[s][itemId] || 0; })
  };
}

/* ====================================================== 1. counts and shapes */

section('Counts (RESEARCH 1, 2, 4, 5, 6, 8; SPEC 5.1)', function () {
  eq('finished goods', C.items.filter(function (i) { return i.kind === 'fg'; }).length, 18);
  eq('raw materials', C.items.filter(function (i) { return i.kind === 'rm'; }).length, 24);
  eq('packing materials', C.items.filter(function (i) { return i.kind === 'pk'; }).length, 8);
  eq('recipes', C.recipes.length, 18);
  eq('retail outlets', OUTLETS.length, 40);
  eq('corporates', CORPS.length, 10);
  eq('routes', C.routes.length, 4);
  eq('stops per route', C.routes.map(function (r) { return r.stops.length; }), [13, 11, 9, 7]);
  eq('store units', C.units.filter(function (u) { return u.kind === 'store'; }).length, 3);
  eq('factory units', C.units.filter(function (u) { return u.kind === 'factory'; }).map(function (u) { return u.id; }), ['factory']);
  eq('locations', C.locations.map(function (l) { return l.id; }).sort(),
    ['fac_fg', 'fac_rm', 'st_anand', 'st_nadiad', 'st_vvn', 'transit_st_anand', 'transit_st_nadiad', 'transit_st_vvn']);
  eq('accounts', C.accounts.map(function (a) { return a.id; }).sort(), ['bank', 'cash_factory', 'cash_st_anand', 'cash_st_nadiad', 'cash_st_vvn']);
  eq('employees on the directory at go-live', C.employees.length, 35);
  ok('everyone on the directory joined on or before go-live and has not left', C.employees.every(function (e) { return e.doj <= '2026-01-01' && e.dol === null && e.active === true; }));
  eq('dated joiners', S.people.joiners.map(function (e) { return e.id + ' ' + e.doj; }), ['E036 2026-03-09', 'E037 2026-06-15', 'E038 2026-08-01']);
  eq('dated leavers', S.people.leavers.map(function (e) { return e.id + ' ' + e.dol; }), ['E020 2026-02-28', 'E025 2026-07-31']);
  eq('stock vendors', C.vendors.filter(function (v) { return v.kind === 'stock'; }).length, 13);
  eq('expense vendors', C.vendors.filter(function (v) { return v.kind === 'expense'; }).length, 24);
  eq('staff vendors', C.vendors.filter(function (v) { return v.kind === 'staff'; }).map(function (v) { return v.id + ' ' + v.name; }), ['VS01 Staff salaries']);
  eq('users', C.users.map(function (u) { return u.id + ' ' + u.role + ' ' + u.employeeId; }),
    ['u_owner owner E001', 'u_accounts accounts E002', 'u_stores stores E004', 'u_production production E006', 'u_sales sales E021', 'u_store_mgr store_mgr E032']);
  ok('each user carries the name of its employee', C.users.every(function (u) { return EMP[u.employeeId] && EMP[u.employeeId].name === u.name; }));
  eq('the store manager is scoped to the store the kernel names', USER.u_store_mgr.unitId, HB.session.access.store_mgr.unitIds[0]);
  eq('expense categories', C.expenseCategories.length, 15);
  eq('system categories', C.expenseCategories.filter(function (c) { return c.system; }).map(function (c) { return c.id + ':' + c.system; }), ['salaries:salary', 'cash_short:cash_short']);
  eq('limits', C.limits, { poAutoApprove: 5000000, billTolerancePct: 2, returnsPct: 8, backDateDays: 3, nearExpiryDays: 1, dueSoonDays: 7,
    warn: { yieldLowPct: 80, yieldHighPct: 105, countAwayPct: 20, countMinValue: 50000, claimAbove: 500000, rateAwayPct: 25, dayEndAwayPct: 10 } });
  eq('guide journeys', C.journeys.length, 8);
  eq('outlets by type (6.1)', ['P', 'D', 'T', 'B', 'G'].map(function (t) { return OUTLETS.filter(function (c) { return c.typeCode === t; }).length; }), [14, 9, 7, 5, 5]);
  eq('outlets by size (6.1)', ['S', 'M', 'L'].map(function (z) { return OUTLETS.filter(function (c) { return c.size === z; }).length; }), [10, 20, 10]);
  eq('outlets by terms (6.2)', ['cash', 'weekly'].map(function (t) { return OUTLETS.filter(function (c) { return c.terms === t; }).length; }), [24, 16]);
  eq('cash and weekly by type (6.3)', ['P', 'D', 'T', 'B', 'G'].map(function (t) {
    return ['cash', 'weekly'].map(function (x) { return OUTLETS.filter(function (c) { return c.typeCode === t && c.terms === x; }).length; });
  }), [[8, 6], [6, 3], [6, 1], [1, 4], [3, 2]]);
  eq('headcount by department on 1 January 2026 (8.2)', ['Production', 'Packing', 'Stores and purchase', 'Dispatch and sales', 'Accounts and admin', 'Own stores'].map(function (d) {
    return C.employees.filter(function (e) { return e.dept === d; }).length;
  }), [10, 5, 2, 8, 3, 7]);
  eq('headcount by unit on 1 January 2026 (8.2)', ['factory', 'st_anand', 'st_vvn', 'st_nadiad'].map(function (u) {
    return C.employees.filter(function (e) { return e.unitId === u; }).length;
  }), [28, 3, 2, 2]);
  ok('money in the masters is whole paise', C.items.every(function (i) {
    return i.kind !== 'fg' || [i.price.mrp, i.price.retail, i.price.corporate].every(function (p) { return p === Math.round(p) && p > 0; });
  }) && C.customers.every(function (c) { return c.creditLimit === Math.round(c.creditLimit); }) &&
    C.employees.every(function (e) { return e.salary === Math.round(e.salary) && e.salary % 10000 === 0; }));
  ok('every employee has a ten-digit contact number', ALL_EMPLOYEES.every(function (e) { return /^[6-9][0-9]{9}$/.test(e.phone); }));
  /* 8.1: one number per employee. They are fixed by the id (CONFIG choice 19), so the three joiners have theirs before they join */
  eq('no two employees share a contact number', keys(ALL_EMPLOYEES.reduce(function (o, e) { o[e.phone] = 1; return o; }, {})).length, 38);
});

/* ====================================================== 2. every id referenced exists */

section('Every id that is referenced exists', function () {
  function item(id, where, kinds) { ok(where + ': item ' + id, !!ITEM[id] && (!kinds || kinds.indexOf(ITEM[id].kind) !== -1)); }
  function fg(id, where) { item(id, where, ['fg']); }
  function mat(id, where) { item(id, where, ['rm', 'pk']); }
  function cust(id, where) { ok(where + ': customer ' + id, !!CUST[id]); }
  function vend(id, where) { ok(where + ': vendor ' + id, !!VEND[id]); }
  function emp(id, where) { ok(where + ': employee ' + id, !!ALL_EMP[id]); }
  function unit(id, where) { ok(where + ': unit ' + id, !!UNIT[id]); }
  function user(id, where) { ok(where + ': user ' + id, !!USER[id]); }
  function cat(id, where) { ok(where + ': category ' + id, !!CAT[id]); }
  function iso(d, where) { ok(where + ': date ' + d, D.isIso(d)); }
  function unique(list, what) { var seen = {}; list.forEach(function (r) { ok(what + ' id ' + r.id + ' is used once', !seen[r.id]); seen[r.id] = 1; }); }

  [['items', C.items], ['customers', C.customers], ['vendors', C.vendors], ['employees', ALL_EMPLOYEES], ['units', C.units],
    ['locations', C.locations], ['accounts', C.accounts], ['categories', C.expenseCategories], ['users', C.users], ['routes', C.routes],
    ['journeys', C.journeys]].forEach(function (p) { unique(p[1], p[0]); });
  eq('item codes are the ids', C.items.filter(function (i) { return i.code !== i.id; }).length, 0);

  C.locations.forEach(function (l) { unit(l.unitId, 'location ' + l.id); });
  C.accounts.forEach(function (a) { if (a.unitId !== null) unit(a.unitId, 'account ' + a.id); });
  C.units.forEach(function (u) {
    if (u.kind !== 'store') return;
    ok('store ' + u.id + ' has its location, transit location and cash account', !!LOC[u.id] && !!LOC['transit_' + u.id] && !!ACC['cash_' + u.id]);
    keys(u.standing).forEach(function (k) { fg(k, 'standing of ' + u.id); });
  });
  C.items.forEach(function (i) {
    if (i.kind === 'fg') { ok('product ' + i.id + ' has a recipe', !!RECIPE[i.id]); return; }
    vend(i.vendorId, 'item ' + i.id);
    ok('item ' + i.id + ' is on the supply list of ' + i.vendorId, !!VEND[i.vendorId] && VEND[i.vendorId].kind === 'stock' && VEND[i.vendorId].supplies.indexOf(i.id) !== -1);
  });
  C.vendors.forEach(function (v) {
    v.supplies.forEach(function (s) { mat(s, 'supplies of ' + v.id); ok(s + ' names ' + v.id + ' as its vendor', ITEM[s] && ITEM[s].vendorId === v.id); });
    if (v.kind === 'expense') cat(v.categoryId, 'vendor ' + v.id);
  });
  C.recipes.forEach(function (r) {
    fg(r.itemId, 'recipe');
    r.materials.forEach(function (m) { item(m.itemId, 'recipe ' + r.itemId, ['rm']); });
    r.packing.forEach(function (p) { item(p.itemId, 'packing of ' + r.itemId, ['pk']); });
    ok('recipe ' + r.itemId + ' rhythm is daily or weekdays 0-6', r.rhythm === 'daily' ||
      (Array.isArray(r.rhythm) && r.rhythm.length > 0 && r.rhythm.every(function (d) { return d === Math.floor(d) && d >= 0 && d <= 6; })));
  });
  var stopOf = {};
  C.routes.forEach(function (r) {
    r.stops.forEach(function (s) {
      cust(s, 'route ' + r.id);
      ok('stop ' + s + ' is on one route', !stopOf[s]); stopOf[s] = r.id;
      ok('stop ' + s + ' is an outlet of route ' + r.id, CUST[s] && CUST[s].channel === 'retail' && CUST[s].routeId === r.id);
    });
  });
  C.customers.forEach(function (c) {
    if (c.channel === 'retail') {
      ok('outlet ' + c.id + ' is a stop of its route', !!ROUTE[c.routeId] && ROUTE[c.routeId].stops.indexOf(c.id) !== -1);
      keys(c.standing).forEach(function (k) { fg(k, 'standing of ' + c.id); });
    } else {
      ok('corporate ' + c.id + ' has no route, no standing order and a pattern', c.routeId === null && keys(c.standing).length === 0 && !!c.pattern && c.pattern.lines.length > 0);
      c.pattern.lines.forEach(function (l) { fg(l.itemId, 'pattern of ' + c.id); });
    }
  });
  ALL_EMPLOYEES.forEach(function (e) { unit(e.unitId, 'employee ' + e.id); });
  C.users.forEach(function (u) { ok('user ' + u.id + ': employee ' + u.employeeId + ' is on the directory at go-live', !!EMP[u.employeeId]); unit(u.unitId, 'user ' + u.id); });

  /* opening entries */
  C.opening.stock.forEach(function (l, i) {
    ok('opening stock ' + i + ': location ' + l.locId, !!LOC[l.locId] && LOC[l.locId].kind !== 'transit');
    item(l.itemId, 'opening stock ' + i);
    if (ITEM[l.itemId].kind === 'fg') { iso(l.mfgDate, 'opening stock ' + i); ok('opening batch of ' + l.itemId + ' is not at fac_rm', l.locId !== 'fac_rm'); }
    else eq('opening material ' + l.itemId + ' is at fac_rm', l.locId, 'fac_rm');
  });
  C.opening.cash.forEach(function (l) { ok('opening cash: account ' + l.accountId, !!ACC[l.accountId]); });
  C.opening.receivables.forEach(function (r) { cust(r.customerId, 'opening invoice'); iso(r.dueDate, 'opening invoice ' + r.customerId); });
  C.opening.payables.forEach(function (r) { vend(r.vendorId, 'opening bill'); iso(r.dueDate, 'opening bill ' + r.vendorId); });
  keys(S.openingSettlement.receivables).forEach(function (k) {
    cust(k, 'opening settlement');
    S.openingSettlement.receivables[k].forEach(function (p) { iso(p.date, 'settlement of ' + k); });
    near('settlement shares of ' + k + ' add up', sum(S.openingSettlement.receivables[k], function (p) { return p.share; }), 1, 1e-9);
  });
  keys(S.openingSettlement.payables).forEach(function (k) {
    vend(k, 'opening settlement');
    S.openingSettlement.payables[k].forEach(function (p) { iso(p.date, 'settlement of ' + k); ok('settlement account ' + p.account, !!ACC[p.account]); });
  });
  eq('every opening invoice and bill has its settlement', [keys(S.openingSettlement.receivables).sort(), keys(S.openingSettlement.payables).sort()],
    [C.opening.receivables.map(function (r) { return r.customerId; }).sort(), C.opening.payables.map(function (r) { return r.vendorId; }).sort()]);

  /* simulation parameters */
  keys(S.prices.table).forEach(function (k) { mat(k, 'price series'); });
  keys(S.prices.rule).forEach(function (k) { mat(k, 'price rule'); });
  S.priceRevisions.forEach(function (r) { iso(r.date, 'price revision'); user(r.userId, 'price revision'); keys(r.prices).forEach(function (k) { fg(k, 'price revision ' + r.date); }); });
  keys(S.outlets.template).forEach(function (t) { ok('template type ' + t, !!S.outlets.types[t]); });
  S.outlets.templateItems.forEach(function (k) { fg(k, 'outlet template'); });
  keys(S.outlets.carried.byItem).forEach(function (k) { fg(k, 'who buys what'); });
  keys(S.outlets.info).forEach(function (k) { cust(k, 'outlet info'); });
  keys(S.demand.groupOf).forEach(function (k) { fg(k, 'product group'); });
  keys(S.demand.classOf).forEach(function (k) { cust(k, 'corporate class'); ok('class of ' + k, S.demand.classes.indexOf(S.demand.classOf[k]) !== -1); });
  keys(S.demand.weekday.outlet).forEach(function (t) { ok('weekday factors of type ' + t, !!S.outlets.types[t] && S.demand.weekday.outlet[t].length === 7); });
  keys(S.demand.weekday.store).forEach(function (s) { unit(s, 'weekday factors'); });
  keys(S.demand.weekday.corporate).forEach(function (c) { cust(c, 'weekday factors'); });
  S.demand.campusOutlets.forEach(function (c) { cust(c, 'campus outlets'); });
  keys(S.demand.college).forEach(function (k) { ok('college calendar: ' + k, k === 'campusOutlet' || !!CUST[k] || !!UNIT[k]); });
  keys(S.demand.school).forEach(function (k) { cust(k, 'school calendar'); });
  keys(S.rain.heavyOnRoutes).forEach(function (d) { iso(d, 'rain'); S.rain.heavyOnRoutes[d].forEach(function (r) { ok('rain: route ' + r, !!ROUTE[r]); }); });
  keys(S.returns.rate).concat(keys(S.returns.lagDays)).forEach(function (k) { fg(k, 'stale returns'); });
  keys(S.returns.outletOverride).forEach(function (k) { cust(k, 'returns factor'); });
  S.stores.ids.forEach(function (s) {
    unit(s, 'stores');
    keys(S.stores.sale[s]).forEach(function (k) { fg(k, 'store sale'); });
    emp(S.stores.manager[s], 'store manager of ' + s);
    eq('the manager of ' + s + ' works there', ALL_EMP[S.stores.manager[s]].unitId, s);
    ok('UPI share of ' + s, S.stores.upiShare[s] > 0 && S.stores.upiShare[s] < 1);
    keys(S.stores.puffStanding.summer[s]).forEach(function (k) { fg(k, 'summer puff standing'); });
  });
  keys(S.stores.puffStanding.collegeVacation).forEach(function (s) { unit(s, 'vacation puff standing'); });
  keys(S.stores.unsaleableRate).forEach(function (k) { fg(k, 'unsaleable rate'); });
  user(S.stores.userId, 'stores'); user(S.stores.puffStanding.changedBy, 'puff standing');
  keys(S.collections.collectionDow).forEach(function (r) { ok('collection day: route ' + r, !!ROUTE[r]); });
  keys(S.collections.slow).forEach(function (k) { cust(k, 'slow payer'); eq('slow payer ' + k + ' is a weekly outlet', CUST[k].terms, 'weekly'); });
  eq('one slow payer per route', keys(S.collections.slow).map(function (k) { return CUST[k].routeId; }).sort(), ['R1', 'R2', 'R3', 'R4']);
  eq('every corporate has its payment rule', keys(S.collections.corporate).sort(), CORPS.map(function (c) { return c.id; }).sort());
  ok('collection account', !!ACC[S.collections.corporateAccount]); user(S.collections.userId.retail, 'collections'); user(S.collections.userId.corporate, 'collections');
  user(S.corporates.userId, 'corporates'); user(S.approvals.userId, 'approvals');
  ok('the personas named for receipts may enter them', HB.session.can('rcpt.create', { user: S.collections.userId.retail }).ok && HB.session.can('rcpt.create', { user: S.collections.userId.corporate }).ok);
  ok('the personas named for the other seeded documents may raise them', HB.session.can('po.create', { user: S.purchasing.userId }).ok && HB.session.can('vbill.create', { user: S.purchasing.billedBy }).ok &&
    HB.session.can('so.create', { user: S.corporates.userId }).ok && HB.session.can('exp.salary', { user: S.people.salaryBill.raisedBy }).ok && HB.session.can('employee.edit', { user: S.people.userId }).ok &&
    HB.session.can('adj.create', { user: S.stockCount.userId, locId: S.stockCount.locId }).ok && HB.session.can('dep.create', { user: S.cash.factory.userId, accountId: 'cash_factory' }).ok &&
    HB.session.can('master.edit', { user: S.priceRevisions[0].userId }).ok && HB.session.can('dayend.create', { user: S.stores.userId, unitId: 'st_vvn' }).ok && HB.session.can('exp.bill', { user: S.expenses.userId }).ok);
  eq('production parameters for every product', keys(S.production.byItem).sort(), FG);
  S.production.badRuns.forEach(function (b) { b.items.forEach(function (k) { fg(k, 'bad run ' + b.id); }); });
  keys(S.purchasing.marketNoise).forEach(function (k) { mat(k, 'market noise'); });
  S.purchasing.everyDayVendors.forEach(function (v) { vend(v, 'every-day vendors'); });
  keys(S.purchasing.exceptions).concat(keys(S.purchasing.lateDays)).concat(keys(S.purchasing.cashVendors)).concat(S.purchasing.weeklyBilling.vendors).forEach(function (v) {
    ok('purchasing: stock vendor ' + v, !!VEND[v] && VEND[v].kind === 'stock');
  });
  mat(S.purchasing.exceptions.VM09.itemId, 'purchasing exception');
  keys(S.purchasing.cashVendors).forEach(function (v) { ok('cash account of ' + v, !!ACC[S.purchasing.cashVendors[v]]); });
  [S.purchasing.userId, S.purchasing.billedBy, S.purchasing.approvedBy, S.people.userId, S.people.salaryBill.raisedBy, S.people.salaryBill.approvedBy,
    S.expenses.userId, S.expenses.approvedBy, S.cash.factory.userId, S.stockCount.userId, S.stockCount.approvedBy].forEach(function (u) { user(u, 'actor'); });
  S.people.raises.forEach(function (r) { iso(r.date, 'raise'); user(r.userId, 'raise'); keys(r.salary).forEach(function (k) { emp(k, 'raise of ' + r.date); }); });
  keys(S.people.replaces).forEach(function (k) { emp(k, 'replaces'); emp(S.people.replaces[k], 'replaces'); });
  S.people.raise.exclude.forEach(function (k) { emp(k, 'raise'); });
  S.expenses.bills.forEach(function (b) {
    var where = 'bill rule ' + b.n + ' (' + b.name + ')';
    ok(where + ': expense vendor ' + b.vendorId, !!VEND[b.vendorId] && VEND[b.vendorId].kind === 'expense');
    cat(b.categoryId, where); unit(b.unitId, where);
    ok(where + ': a bill category', CAT[b.categoryId] && CAT[b.categoryId].mode !== 'claim' && !CAT[b.categoryId].system);
    eq(where + ': the category of its vendor (5.3)', b.categoryId, VEND[b.vendorId].categoryId);
    eq(where + ': the GST rate of its vendor (5.3)', b.gstRate, VEND[b.vendorId].billGstRate);
    ok(where + ': dated by a rule or a seeded day', (typeof b.when === 'function') !== !!b.seededDay);
    ok(where + ': one amount rule', [b.fixed !== null, !!b.uniform, typeof b.calc === 'function'].filter(Boolean).length === 1);
  });
  S.expenses.claims.rows.forEach(function (c) {
    cat(c.categoryId, 'claim ' + c.name); unit(c.unitId, 'claim ' + c.name); user(c.userId, 'claim ' + c.name);
    ok('claim ' + c.name + ': a claim category', CAT[c.categoryId] && CAT[c.categoryId].mode !== 'bill');
    ok('claim ' + c.name + ': the persona may claim for ' + c.unitId, HB.session.can('exp.claim', { user: c.userId, unitId: c.unitId }).ok);
    emp(c.payeeEmployeeId, 'payee of claim ' + c.name + ' at ' + c.unitId);
  });
  keys(S.purchasing.receivingDows).forEach(function (v) { ok('receiving days: stock vendor ' + v, !!VEND[v] && VEND[v].kind === 'stock'); });
  ok('claim reimbursement accounts', !!ACC[S.expenses.claims.reimburse.factory] && !!ACC[S.expenses.claims.reimburse.store] && !!ACC[S.expenses.payAccount]);
  S.expenses.volumeFactor.items.forEach(function (k) { mat(k, 'volume factor'); });
  ok('stock count location', !!LOC[S.stockCount.locId]);
  S.stockCount.packing.items.concat(S.stockCount.flour.items).concat(S.stockCount.bulk.items).forEach(function (k) { mat(k, 'stock count'); });
  eq('the stock count names every packing item', S.stockCount.packing.items, C.items.filter(function (i) { return i.kind === 'pk'; }).map(function (i) { return i.id; }));
  S.vehicles.forEach(function (v) {
    if (v.routeId !== null) ok('vehicle ' + v.id + ': route ' + v.routeId, !!ROUTE[v.routeId]);
    v.drivers.forEach(function (d) { emp(d.employeeId, 'vehicle ' + v.id); iso(d.from, 'vehicle ' + v.id); });
    (v.timetable || []).forEach(function (t) { ok('V5 timetable: ' + t[0], !!CUST[t[0]] || !!UNIT[t[0]]); });
  });
  keys(S.clock.dayEndAt).forEach(function (s) { unit(s, 'clock'); });
  var st = S.stories;
  st.flour.items.forEach(function (k) { mat(k, 'story flour'); }); st.flour.products.forEach(function (k) { fg(k, 'story flour'); });
  st.yieldDip.rotation.forEach(function (r) { fg(r.itemId, 'story yield dip'); });
  cust(st.highReturns.customerId, 'story returns'); cust(st.lateCorporate.customerId, 'story late corporate');
  vend(st.heldBill.weekly.vendorId, 'story held bill'); mat(st.heldBill.weekly.itemId, 'story held bill'); mat(st.heldBill.weekly.elseItemId, 'story held bill');
  st.heldBill.occasional.vendors.forEach(function (v) { vend(v, 'story held bill'); });
  unit(st.cashShort.storeId, 'story cash short'); mat(st.lowStock.itemId, 'story low stock'); fg(st.nearExpiry.itemId, 'story near expiry');
  C.calibration.bands.forEach(function (b) {
    if (b.customerId) cust(b.customerId, 'band ' + b.n);
    if (b.storeId) unit(b.storeId, 'band ' + b.n);
    (b.vendors || []).forEach(function (v) { vend(v, 'band ' + b.n); });
    (b.except || []).forEach(function (c) { cust(c, 'band ' + b.n); });
  });
  keys(C.calibration.bands[7].parts).forEach(function (s) { unit(s, 'band 8'); });
});

/* ====================================================== 3. GSTINs */

section('GSTINs: Gujarat, format and check character (RESEARCH 1.1, 5.1, 5.3, 6.4)', function () {
  /* the registrations as RESEARCH.md prints them */
  var WANT = {
    company: '24AFNPP5274H1Z3',
    VM01: '24AAGCG4172M1ZE', VM02: '24BKTPP6391H1ZH', VM03: '24ABMFS2846J1ZT', VM04: '24ACDFS7150R1ZL', VM05: '24CLNPT4418B1Z4',
    VM06: '24AAZFK9263D1ZU', VM07: '24AAHCK3057N1Z9', VM08: '24DQRPM8824L1Z1', VM09: '', VM10: '24EHYPS5136C1ZY', VM11: '',
    VM12: '24AAKCV6609P1ZN', VM13: '24ABGFK1784E1ZF',
    VE01: '24AAUFK5392G1ZV', VE02: '', VE03: '', VE04: '', VE05: '', VE06: '', VE07: '24AATFT8061Q1Z6', VE08: '24ABEFA2475K1ZG', VE09: '',
    VE10: '24AASFP6318C1Z8', VE11: '24FMVPC7745D1ZS', VE12: '24ABXFY3906H1ZM', VE13: '', VE14: '', VE15: '24AAJCA8452F1ZP', VE16: '',
    VE17: '24GRWPV2587N1ZE', VE18: '', VE19: '24ABPFM4063T1ZF', VE20: '24AAQFC9731B1ZI', VE21: '24AANCD1648R1Z1', VE22: '24ABCFS5820L1Z3',
    VE23: '', VE24: '24HJKPJ3379A1Z8', VS01: '',
    C01: '24AAHCM4821K1ZF', C02: '24ABKFA7315D1ZS', C03: '', C04: '', C05: '24AACTA5126H1Z4', C06: '24BDLPT6247Q1ZM', C07: '',
    C08: '24AAVFM2468L1ZM', C09: '', C10: '24CKQPP3792M1Z9'
  };
  var all = [{ id: 'company', gstin: C.company.gstin }].concat(C.vendors).concat(C.customers), n = 0;
  all.forEach(function (r) {
    if (WANT[r.id] !== undefined) eq('GSTIN of ' + r.id, r.gstin, WANT[r.id]);
    else eq('outlet ' + r.id + ' carries no GSTIN', r.gstin, '');
    if (!r.gstin) return;
    n++;
    ok(r.id + ' ' + r.gstin + ': 24 + PAN + 1Z + check character', /^24[A-Z]{5}[0-9]{4}[A-Z]1Z[0-9A-Z]$/.test(r.gstin));
    eq(r.id + ' ' + r.gstin + ': check character', r.gstin.charAt(14), gstinCheck(r.gstin));
    ok(r.id + ': the config\'s own test agrees', C.gstin.valid(r.gstin));
  });
  eq('registered parties', n, 31);
  eq('state code', C.company.stateCode, '24');
  ok('a wrong check character is caught', !C.gstin.valid('24AFNPP5274H1Z4') && !C.gstin.valid('27AFNPP5274H1Z3'));
  /* the fourth letter of the PAN follows the constitution: C company, F firm or LLP, T trust, P individual */
  var LETTER = { 'private company': 'C', 'partnership firm': 'F', 'LLP': 'F', 'proprietor': 'P', 'charitable trust': 'T' };
  C.vendors.concat(CORPS).forEach(function (r) {
    if (r.gstin && r.constitution) eq('PAN type of ' + r.id + ' (' + r.constitution + ')', r.gstin.charAt(5), LETTER[r.constitution]);
  });
});

/* ====================================================== 4. masters against the tables */

section('Item master and price lists (RESEARCH 2.1, 2.3, 2.4, 4.1)', function () {
  /* code: key, group, GST %, best before, MRP, retailer, corporate at the opening list, retailer pays, store realisation */
  var T23 = {
    FG01: ['SB', 'BR', 0, 4, 38, 30.50, 28.50, 30.50, 38.00], FG02: ['BB', 'BR', 0, 4, 44, 35.00, 33.00, 35.00, 44.00],
    FG03: ['JL', 'BR', 0, 4, 68, 55.00, 50.50, 55.00, 68.00], FG04: ['LP', 'BR', 0, 3, 36, 29.00, 27.00, 29.00, 36.00],
    FG05: ['BNP', 'BN', 0, 4, 31, 25.00, 23.50, 25.00, 31.00], FG06: ['BNS', 'BN', 0, 4, 35, 28.00, 26.00, 28.00, 35.00],
    FG07: ['BNW', 'BN', 0, 4, 38, 30.50, 28.50, 30.50, 38.00], FG08: ['BNJ', 'BN', 0, 4, 47, 38.00, 35.00, 38.00, 47.00],
    FG09: ['PZ', 'BN', 0, 5, 27, 21.50, 20.00, 21.50, 27.00], FG10: ['TE', 'DRY', 5, 90, 55, 41.50, 39.50, 43.58, 52.38],
    FG11: ['TM', 'DRY', 5, 90, 90, 68.00, 65.00, 71.40, 85.71], FG12: ['KB', 'DRY', 5, 90, 70, 53.00, 51.00, 55.65, 66.67],
    FG13: ['KJ', 'DRY', 5, 90, 65, 49.00, 47.00, 51.45, 61.90], FG14: ['JB', 'DRY', 5, 60, 75, 57.00, 54.50, 59.85, 71.43],
    FG15: ['TC', 'DRY', 5, 15, 55, 42.00, 39.50, 44.10, 52.38], FG16: ['PV', 'PF', 5, 1, 15, 11.50, 11.00, 12.08, 14.29],
    FG17: ['PP', 'PF', 5, 1, 25, 19.00, 18.00, 19.95, 23.81], FG18: ['PG', 'PF', 5, 1, 20, 15.25, 14.50, 16.01, 19.05]
  };
  FG.forEach(function (id) {
    var it = ITEM[id], t = T23[id];
    eq(id + ' key, group, GST, shelf life', [it.key, it.group, it.gstRate, it.shelfLifeDays], t.slice(0, 4));
    eq(id + ' opening list', [it.price.mrp, it.price.retail, it.price.corporate], [rs(t[4]), rs(t[5]), rs(t[6])]);
    near(id + ' retailer pays', it.price.retail * (1 + it.gstRate / 100), rs(t[7]), 0.51);
    near(id + ' store realisation', realisation(id, LISTS.opening), rs(t[8]), 0.51);
    ok(id + ' HSN heading 1905 and an 8-digit tariff item under it', it.hsn === '1905' && /^1905[0-9]{4}$/.test(it.tariffItem));
    eq(id + ' unit', it.unit, id < 'FG16' ? 'pack' : 'pcs');
    var margin = 1 - it.price.retail * (1 + it.gstRate / 100) / it.price.mrp;
    ok(id + ' retailer margin 18.8-20.8% of MRP', margin > 0.1875 && margin < 0.2085, (margin * 100).toFixed(1) + '%');
    var under = 1 - it.price.corporate / it.price.retail;
    ok(id + ' corporate price 4-8% under the retailer price', under > 0.035 && under < 0.085, (under * 100).toFixed(1) + '%');
  });
  eq('price revisions', S.priceRevisions.map(function (r) { return r.date + ' ' + r.reason + ' ' + keys(r.prices).sort().join(','); }),
    ['2026-07-01 flour, packaging and diesel FG01,FG02,FG03,FG04,FG05,FG06,FG07,FG08,FG09',
      '2027-04-01 shortening, butter and paneer FG10,FG11,FG12,FG13,FG14,FG15,FG16,FG17,FG18']);
  /* code: MRP, retailer, corporate after its revision, and the store realisation */
  var REV = {
    FG01: [41, 33.00, 31.00, 41.00], FG02: [47, 37.50, 35.50, 47.00], FG03: [72, 58.50, 53.50, 72.00], FG04: [38, 30.50, 28.50, 38.00],
    FG05: [33, 26.50, 25.00, 33.00], FG06: [37, 29.50, 27.50, 37.00], FG07: [41, 33.00, 31.00, 41.00], FG08: [50, 40.50, 37.00, 50.00],
    FG09: [29, 23.00, 21.50, 29.00], FG10: [59, 44.50, 42.50, 56.19], FG11: [95, 72.00, 69.00, 90.48], FG12: [75, 57.00, 54.50, 71.43],
    FG13: [70, 53.00, 50.50, 66.67], FG14: [80, 61.00, 58.00, 76.19], FG15: [59, 45.00, 42.50, 56.19], FG16: [16, 12.25, 11.75, 15.24],
    FG17: [27, 20.50, 19.50, 25.71], FG18: [22, 16.75, 16.00, 20.95]
  };
  FG.forEach(function (id) {
    var p = LISTS.rev2[id], t = REV[id];
    eq(id + ' list after both revisions', [p.mrp, p.retail, p.corporate], [rs(t[0]), rs(t[1]), rs(t[2])]);
    near(id + ' store realisation after its revision', realisation(id, LISTS.rev2), rs(t[3]), 0.51);
    var margin = 1 - p.retail * (1 + ITEM[id].gstRate / 100) / p.mrp;
    ok(id + ' retailer margin inside 18-22% after its revision', margin > 0.18 && margin < 0.22, (margin * 100).toFixed(1) + '%');
    /* a revision applies to documents dated on or after its date, and to no other item */
    var nil = id <= 'FG09';
    eq(id + ' on 2026-06-30', S.priceListOn('2026-06-30')[id], ITEM[id].price);
    eq(id + ' on 2026-07-01', S.priceListOn('2026-07-01')[id], nil ? p : ITEM[id].price);
    eq(id + ' on 2027-03-31', S.priceListOn('2027-03-31')[id], nil ? p : ITEM[id].price);
    eq(id + ' on 2027-12-31', S.priceListOn('2027-12-31')[id], p);
  });

  /* 4.1: vendor, lead days, reorder level, order quantity, order multiple, GST, unit, opening stock */
  var M41 = {
    RM01: ['VM01', 2, 5050, 2000, 50, 0, 'kg', 3400], RM02: ['VM02', 2, 200, 250, 50, 0, 'kg', 150], RM03: ['VM03', 2, 450, 600, 50, 5, 'kg', 450],
    RM04: ['VM04', 3, 240, 270, 15, 5, 'kg', 285], RM05: ['VM04', 3, 255, 240, 15, 5, 'kg', 315], RM06: ['VM06', 2, 45, 60, 15, 5, 'kg', 60],
    RM07: ['VM05', 2, 75, 135, 15, 5, 'litre', 105], RM08: ['VM07', 3, 180, 30, 10, 5, 'kg', 140], RM09: ['VM03', 2, 100, 375, 25, 0, 'kg', 250],
    RM10: ['VM06', 2, 50, 125, 25, 5, 'kg', 125], RM11: ['VM07', 2, 20, 60, 5, 5, 'kg', 55], RM12: ['VM07', 2, 15, 35, 5, 18, 'kg', 35],
    RM13: ['VM07', 2, 5, 10, 5, 5, 'kg', 10], RM14: ['VM08', 2, 2, 4, 1, 5, 'kg', 4], RM15: ['VM08', 2, 5, 10, 5, 5, 'kg', 10],
    RM16: ['VM08', 2, 5, 10, 5, 5, 'kg', 10], RM17: ['VM07', 2, 15, 30, 5, 5, 'kg', 30], RM18: ['VM07', 2, 1, 2, 0.5, 18, 'litre', 2],
    RM19: ['VM09', 1, 100, 50, 50, 0, 'kg', 100], RM20: ['VM09', 1, 30, 20, 10, 0, 'kg', 30], RM21: ['VM10', 2, 35, 35, 1, 5, 'kg', 50],
    RM22: ['VM11', 1, 14, 5, 1, 0, 'kg', 10], RM23: ['VM09', 1, 3, 2, 1, 0, 'kg', 3], RM24: ['VM08', 2, 10, 30, 1, 5, 'kg', 24],
    PM01: ['VM12', 8, 13000, 25000, 1000, 18, 'pcs', 17000], PM02: ['VM12', 8, 3000, 6000, 1000, 18, 'pcs', 4000],
    PM03: ['VM12', 4, 12000, 35000, 1000, 18, 'pcs', 25000], PM04: ['VM12', 8, 4000, 7500, 500, 18, 'pcs', 5500],
    PM05: ['VM12', 8, 4500, 7000, 500, 18, 'pcs', 5500], PM06: ['VM13', 6, 1500, 3000, 500, 5, 'pcs', 2000],
    PM07: ['VM13', 3, 8000, 30000, 1000, 18, 'pcs', 20000], PM08: ['VM13', 5, 31000, 80000, 1000, 18, 'pcs', 57000]
  };
  var openQty = {};
  C.opening.stock.forEach(function (l) { if (l.locId === 'fac_rm') openQty[l.itemId] = l.qty; });
  eq('materials in the master', C.items.filter(function (i) { return i.kind !== 'fg'; }).map(function (i) { return i.id; }), keys(M41));
  keys(M41).forEach(function (id) {
    var it = ITEM[id], t = M41[id];
    eq(id + ' vendor, lead, reorder level, order quantity, multiple, GST, unit', [it.vendorId, it.leadDays, it.reorderLevel, it.orderQty, it.orderMultiple, it.gstRate, it.unit], t.slice(0, 7));
    eq(id + ' opening stock', openQty[id], t[7]);
    ok(id + ' order quantity and opening stock are whole purchase packs', Math.abs(it.orderQty / it.orderMultiple - Math.round(it.orderQty / it.orderMultiple)) < 1e-9 &&
      Math.abs(t[7] / it.orderMultiple - Math.round(t[7] / it.orderMultiple)) < 1e-9);
  });
  eq('materials that open at or below their reorder level (10.4)', keys(M41).filter(function (id) { return openQty[id] <= ITEM[id].reorderLevel; }),
    ['RM01', 'RM02', 'RM03', 'RM08', 'RM19', 'RM20', 'RM22', 'RM23']);
  /* 5.1: credit days of the stock vendors */
  eq('stock vendor credit days', C.vendors.filter(function (v) { return v.kind === 'stock'; }).map(function (v) { return v.termsDays; }), [15, 15, 10, 21, 14, 7, 15, 15, 7, 7, 7, 30, 30]);
  /* a flour order is above the Owner's limit; a fats, butter or milk powder line stays under it (4.1 notes, 11.7 row 22) */
  ok('every flour order waits for the Owner in every month', S.prices.months.every(function (m) { return ITEM.RM01.orderQty * S.prices.inMonth('RM01', m) > C.limits.poAutoApprove; }));
  ok('a single RM04 or RM05 line never needs the Owner', S.prices.months.every(function (m) {
    return ITEM.RM04.orderQty * S.prices.inMonth('RM04', m) <= C.limits.poAutoApprove && ITEM.RM05.orderQty * S.prices.inMonth('RM05', m) <= C.limits.poAutoApprove;
  }));
});

section('Outlets, routes and standing orders (RESEARCH 6.1 - 6.3)', function () {
  var COLS = ['FG01', 'FG02', 'FG04', 'FG05', 'FG06', 'FG07', 'FG09', 'FG10', 'FG11', 'FG12', 'FG13', 'FG14', 'FG15'];
  /* the template of 6.1 worked out: 13 pack columns, then Rs a day at the opening list, after revision 1, after revision 2 */
  var T61 = {
    PS: [11, 2, 7, 2, 0, 0, 2, 3, 1, 2, 1, 1, 1, 1148.00, 1197.00, 1229.00], PM: [14, 2, 9, 2, 0, 0, 2, 4, 1, 3, 1, 1, 1, 1392.00, 1451.50, 1490.50],
    PL: [20, 3, 13, 3, 0, 0, 3, 6, 1, 4, 1, 1, 1, 1908.50, 1994.50, 2043.50], DS: [12, 2, 8, 2, 0, 0, 2, 2, 1, 2, 0, 0, 1, 1060.00, 1113.00, 1134.00],
    DM: [16, 3, 10, 2, 0, 0, 2, 3, 1, 2, 0, 0, 1, 1316.50, 1385.00, 1409.00], DL: [22, 4, 14, 3, 0, 0, 3, 4, 1, 3, 0, 0, 1, 1791.50, 1886.50, 1917.50],
    TS: [4, 0, 15, 5, 0, 0, 0, 2, 0, 2, 1, 0, 0, 920.00, 960.00, 978.00], TM: [5, 0, 20, 6, 0, 0, 0, 3, 0, 3, 1, 0, 0, 1215.00, 1266.50, 1291.50],
    TL: [7, 0, 28, 8, 0, 0, 0, 4, 0, 4, 1, 0, 0, 1652.50, 1724.00, 1756.00], BS: [8, 2, 5, 2, 2, 1, 3, 3, 1, 2, 2, 2, 2, 1254.50, 1300.00, 1343.00],
    BM: [11, 3, 6, 3, 2, 1, 4, 4, 1, 3, 2, 2, 2, 1551.00, 1611.00, 1661.00], BL: [15, 4, 8, 4, 3, 1, 6, 6, 1, 4, 3, 3, 3, 2146.00, 2227.50, 2298.50],
    GS: [12, 3, 4, 2, 1, 1, 2, 3, 1, 2, 1, 1, 2, 1227.00, 1280.50, 1315.50], GM: [16, 4, 5, 2, 1, 1, 3, 4, 1, 3, 1, 1, 2, 1529.00, 1598.00, 1640.00],
    GL: [22, 6, 7, 3, 1, 1, 4, 6, 1, 4, 1, 1, 3, 2064.50, 2159.50, 2214.50]
  };
  /* 6.3 by route in stop order: id, type, size, terms, credit limit Rs, returns factor */
  var T63 = {
    R1: [['O11', 'B', 'M', 'weekly', 16000, 1], ['O06', 'D', 'M', 'cash', 0, 1], ['O05', 'D', 'L', 'weekly', 18000, 0.85], ['O01', 'P', 'L', 'weekly', 20000, 0.85],
      ['O08', 'T', 'L', 'cash', 0, 0.85], ['O09', 'T', 'M', 'cash', 0, 1], ['O02', 'P', 'M', 'cash', 0, 1], ['O10', 'B', 'L', 'weekly', 22000, 0.85],
      ['O13', 'G', 'M', 'cash', 0, 1], ['O12', 'G', 'L', 'weekly', 21000, 0.85], ['O03', 'P', 'M', 'cash', 0, 1], ['O07', 'D', 'M', 'cash', 0, 1], ['O04', 'P', 'S', 'weekly', 12000, 1.6]],
    R2: [['O21', 'T', 'M', 'cash', 0, 1], ['O22', 'T', 'S', 'cash', 0, 1.2], ['O14', 'P', 'L', 'weekly', 20000, 0.85], ['O20', 'T', 'L', 'cash', 0, 0.85],
      ['O17', 'D', 'L', 'weekly', 18000, 0.85], ['O23', 'B', 'M', 'weekly', 16000, 1], ['O24', 'G', 'M', 'cash', 0, 1], ['O18', 'D', 'M', 'cash', 0, 1],
      ['O15', 'P', 'M', 'cash', 0, 1], ['O16', 'P', 'S', 'cash', 0, 1.2], ['O19', 'D', 'S', 'weekly', 11000, 3.5]],
    R3: [['O28', 'P', 'S', 'weekly', 12000, 1.6], ['O32', 'B', 'M', 'weekly', 16000, 1], ['O25', 'P', 'L', 'weekly', 20000, 0.85], ['O31', 'T', 'M', 'cash', 0, 1],
      ['O26', 'P', 'M', 'cash', 0, 1], ['O30', 'D', 'M', 'cash', 0, 1], ['O29', 'D', 'M', 'cash', 0, 1], ['O27', 'P', 'M', 'cash', 0, 1], ['O33', 'G', 'M', 'weekly', 16000, 1]],
    R4: [['O36', 'P', 'S', 'cash', 0, 1.2], ['O38', 'T', 'S', 'weekly', 10000, 1.6], ['O34', 'P', 'L', 'weekly', 20000, 0.85], ['O40', 'G', 'S', 'cash', 0, 1.2],
      ['O37', 'D', 'S', 'cash', 0, 1.2], ['O35', 'P', 'M', 'cash', 0, 1], ['O39', 'B', 'S', 'cash', 0, 1.2]]
  };
  /* route totals of 6.3: 13 pack columns, Rs a day opening list, of which weekly outlets, cash outlets, Rs a day after revision 1 */
  var TOTALS = {
    R1: [189, 36, 146, 42, 7, 4, 33, 54, 11, 40, 13, 11, 17, 20423.00, 10609.50, 9813.50, 21337.50],
    R2: [138, 23, 135, 38, 3, 2, 21, 39, 8, 31, 9, 6, 10, 15484.00, 6311.00, 9173.00, 16187.00],
    R3: [123, 22, 89, 24, 3, 2, 20, 34, 8, 25, 8, 7, 10, 12768.50, 6136.50, 6632.00, 13340.00],
    R4: [81, 14, 61, 18, 3, 2, 14, 23, 6, 17, 7, 6, 8, 8910.00, 2828.50, 6081.50, 9296.50],
    All: [531, 95, 431, 122, 16, 10, 88, 150, 33, 113, 37, 30, 45, 57585.50, 25885.50, 31700.00, 60161.00]
  };
  eq('template columns', S.outlets.templateItems, COLS);
  keys(T61).forEach(function (k) {
    var st = S.outlets.standingOf(k.charAt(0), k.charAt(1)), t = T61[k];
    eq('template ' + k + ' packs', COLS.map(function (c) { return st[c] || 0; }), t.slice(0, 13));
    ok('template ' + k + ' drops a line that rounds to zero', keys(st).every(function (c) { return st[c] > 0; }));
    ['opening', 'rev1', 'rev2'].forEach(function (l, i) {
      eq('template ' + k + ' Rs a day, ' + l, sum(keys(st), function (c) { return st[c] * LISTS[l][c].retail; }), rs(t[13 + i]));
    });
  });
  var all = COLS.map(function () { return 0; }), allV = [0, 0, 0, 0];
  keys(T63).forEach(function (rid) {
    eq('route ' + rid + ' stop order', ROUTE[rid].stops, T63[rid].map(function (o) { return o[0]; }));
    var tot = COLS.map(function () { return 0; }), v = [0, 0, 0, 0];
    T63[rid].forEach(function (o) {
      var c = CUST[o[0]];
      eq(o[0] + ' type, size, terms, credit days', [c.typeCode, c.size, c.terms, c.creditDays], [o[1], o[2], o[3], o[3] === 'weekly' ? 7 : 0]);
      eq(o[0] + ' outlet type name', c.outletType, S.outlets.types[o[1]]);
      eq(o[0] + ' credit limit', c.creditLimit, rs(o[4]));
      eq(o[0] + ' standing order', COLS.map(function (k) { return c.standing[k] || 0; }), T61[o[1] + o[2]].slice(0, 13));
      eq(o[0] + ' returns factor', S.returns.outletFactor(o[0]), o[5]);
      eq(o[0] + ' carries no jumbo loaf, jumbo bun or puff', ['FG03', 'FG08', 'FG16', 'FG17', 'FG18'].filter(function (k) { return c.standing[k]; }), []);
      COLS.forEach(function (k, i) { tot[i] += c.standing[k] || 0; });
      var val = standingValue(c, LISTS.opening);
      v[0] += val; v[o[3] === 'weekly' ? 1 : 2] += val; v[3] += standingValue(c, LISTS.rev1);
    });
    eq('route ' + rid + ' packs on a normal day', tot, TOTALS[rid].slice(0, 13));
    eq('route ' + rid + ' Rs a day: opening list, weekly, cash, after revision 1', v, TOTALS[rid].slice(13).map(rs));
    tot.forEach(function (x, i) { all[i] += x; }); v.forEach(function (x, i) { allV[i] += x; });
  });
  eq('all routes, packs on a normal day', all, TOTALS.All.slice(0, 13));
  eq('all routes, Rs a day', allV, TOTALS.All.slice(13).map(rs));
  var vals = OUTLETS.map(function (c) { return standingValue(c, LISTS.opening); });
  eq('smallest and largest outlet, Rs a day', [Math.min.apply(null, vals), Math.max.apply(null, vals)], [rs(920), rs(2146)]);
  near('average outlet, Rs a day', sum(vals) / 40, rs(1440), 50);
  eq('collection weekdays, Monday = 0', [S.collections.collectionDow.R1, S.collections.collectionDow.R2, S.collections.collectionDow.R3, S.collections.collectionDow.R4], [0, 1, 2, 3]);
  eq('campus outlets are on route R2', S.demand.campusOutlets.map(function (c) { return CUST[c].routeId; }), ['R2', 'R2', 'R2', 'R2', 'R2']);
  /* 2.2 who buys what */
  var cols = S.outlets.carried.columns;
  FG.forEach(function (id) {
    var want = S.outlets.carried.byItem[id], got = cols.map(function (col) {
      if (col === 'corporate') return CORPS.some(function (c) { return c.pattern.lines.some(function (l) { return l.itemId === id; }); }) ? 1 : 0;
      if (col === 'store') return STORES.every(function (s) { return UNIT[s].standing[id] > 0 && S.stores.sale[s][id] > 0; }) ? 1 : 0;
      return S.outlets.template[col][COLS.indexOf(id)] > 0 ? 1 : 0;
    });
    eq(id + ' who buys what (2.2)', got, want);
  });
});

section('Corporates (RESEARCH 6.4)', function () {
  /* id: class, credit days, credit limit, lateness days, payment weekday (Mon = 0), orders a week, order value at the three lists, orders in 2026 */
  var T64 = {
    C01: ['IC', 30, 250000, 0, 0, 6, 5520.00, 5762.00, 5852.00, 301], C02: ['IC', 30, 150000, 0, 1, 6, 3178.00, 3298.00, 3388.00, 301],
    C03: ['HM', 30, 140000, 0, 2, 7, 3326.00, 3512.00, 3536.00, 362], C04: ['HM', 30, 100000, 5, 3, 7, 1938.00, 2035.50, 2055.50, 362],
    C05: ['HK', 30, 140000, 10, 4, 7, 2414.50, 2536.50, 2575.50, 362], C06: ['CT', 15, 40000, 20, 0, 3, 4676.00, 4955.00, 4955.00, 156],
    C07: ['CT', 15, 30000, 0, 1, 1, 5442.00, 5760.00, 5760.00, 52], C08: ['HT', 30, 180000, 15, 2, 7, 2267.00, 2375.00, 2413.00, 362],
    C09: ['SC', 15, 90000, 0, 3, 6, 2582.00, 2621.00, 2771.00, 251], C10: ['CF', 15, 75000, 0, 4, 3.5, 3401.00, 3592.00, 3637.00, 181]
  };
  var PATTERN = {
    C01: { FG03: 40, FG04: 60, FG08: 16, FG16: 120 }, C02: { FG03: 22, FG04: 36, FG16: 60, FG18: 30 },
    C03: { FG03: 40, FG01: 12, FG04: 24, FG10: 8 }, C04: { FG03: 20, FG02: 6, FG04: 15, FG11: 5 },
    C05: { FG03: 24, FG02: 10, FG01: 10, FG11: 6, FG10: 5 }, C06: { FG04: 80, FG08: 24, FG09: 30, FG05: 20, FG03: 12 },
    C07: { FG04: 100, FG08: 30, FG03: 24, FG09: 24 }, C08: { FG03: 14, FG02: 6, FG08: 12, FG06: 8, FG09: 10, FG15: 8, FG14: 4 },
    C09: { FG16: 100, FG17: 30, FG05: 16, FG01: 6, FG15: 10 }, C10: { FG08: 40, FG06: 24, FG07: 12, FG09: 30, FG18: 30 }
  };
  var days2026 = D.range('2026-01-01', '2026-12-31');
  keys(T64).forEach(function (id) {
    var c = CUST[id], t = T64[id], pay = S.collections.corporate[id], lines = {};
    c.pattern.lines.forEach(function (l) { lines[l.itemId] = l.qty; });
    eq(id + ' class, terms, credit days, credit limit', [c.typeCode, c.terms, c.creditDays, c.creditLimit], [t[0], 'credit', t[1], rs(t[2])]);
    eq(id + ' lateness days and payment weekday', [pay.latenessDays, pay.payDow], [t[3], t[4]]);
    eq(id + ' typical order', lines, PATTERN[id]);
    eq(id + ' orders a week by its pattern', ordersAWeek(c), t[5]);
    eq(id + ' order value at the opening list, after revision 1, after revision 2', [orderValue(c, LISTS.opening), orderValue(c, LISTS.rev1), orderValue(c, LISTS.rev2)], [rs(t[6]), rs(t[7]), rs(t[8])]);
    /* the order days, the class holidays of 7.4 and the calendars of 7.6 together give the count of the table */
    eq(id + ' orders in 2026', days2026.filter(function (d) { return S.demand.corporateFactor(id, d) > 0; }).length, t[9]);
    ok(id + ' never orders on a closed day', S.calendar.closedDays.every(function (d) { return S.demand.corporateFactor(id, d) === 0 && !S.corporates.orderDay(id, d); }));
  });
  eq('C10 orders on go-live and every second day after', ['2026-01-01', '2026-01-02', '2026-01-03'].map(function (d) { return S.corporates.orderDay('C10', d); }), [true, false, true]);
  eq('PO references', [S.corporates.poRef('C01', '2026-03-14'), S.corporates.poRef('C05', '2027-03-14'), S.corporates.poRef('C03', '2026-03-14')], ['PO/C01/2026-03', 'RC/C05/2027', '']);
  eq('corporates that buy only Nil-rated lines', CORPS.filter(function (c) { return c.pattern.lines.every(function (l) { return ITEM[l.itemId].gstRate === 0; }); }).map(function (c) { return c.id; }), ['C06', 'C07']);
  near('all ten a day after revision 1, every factor 1.00', sum(CORPS, function (c) { return orderValue(c, LISTS.rev1) * ordersAWeek(c) / 7; }), rs(25214), 50);
  /* 7.6 */
  eq('caterer season: wedding, NRI, Chaturmas, other', ['2026-02-10', '2026-01-20', '2026-08-01', '2026-06-01'].map(S.demand.catererFactor), [1.35, 1.20, 0.70, 0.90]);
  eq('hostel mess in term, examinations and vacation', ['2026-02-02', '2026-04-01', '2026-05-01'].map(function (d) { return S.demand.collegeFactor('C03', d); }), [1, 1, 0.30]);
  eq('S2 and the cafe in the same weeks', ['2026-02-02', '2026-04-01', '2026-05-01'].map(function (d) { return [S.demand.collegeFactor('st_vvn', d), S.demand.collegeFactor('C10', d)]; }), [[1, 1], [0.95, 0.90], [0.70, 0.70]]);
  eq('school canteen in term, board examinations and vacation', ['2026-02-02', '2026-03-02', '2026-05-11'].map(function (d) { return S.demand.schoolFactor('C09', d); }), [1, 0.80, 0]);
  near('the hotel on a Saturday in a wedding window', S.demand.corporateFactor('C08', '2026-02-07'), 1.20 * 1.10, 1e-9);
  near('the hospital and the hotel on Diwali day 2026', S.demand.corporateFactor('C05', '2026-11-08'), 2.5, 1e-9);
  near('the hospital on Diwali day 2027', S.demand.corporateFactor('C05', '2027-10-29'), 2.0, 1e-9);
  eq('the school canteen on 24 and 25 December', [S.demand.corporateFactor('C09', '2026-12-24'), S.demand.corporateFactor('C09', '2026-12-25')], [1, 0]);
});

section('Own stores (RESEARCH 6.5; SPEC 8.1 journey 5)', function () {
  var SALE = {
    st_anand: [45, 14, 4, 34, 10, 6, 4, 3, 14, 16, 8, 14, 8, 8, 14, 130, 45, 40],
    st_vvn: [22, 8, 2, 16, 10, 8, 4, 4, 12, 6, 3, 6, 4, 4, 12, 140, 50, 50],
    st_nadiad: [24, 6, 2, 18, 5, 2, 2, 1, 6, 10, 4, 8, 4, 4, 5, 65, 20, 15]
  };
  var STANDING = {
    st_anand: [68, 21, 6, 55, 15, 9, 6, 5, 28, 80, 40, 70, 40, 40, 42, 150, 55, 45],
    st_vvn: [33, 12, 3, 26, 15, 12, 6, 6, 24, 30, 15, 30, 20, 20, 36, 155, 55, 55],
    st_nadiad: [36, 9, 3, 29, 8, 3, 3, 2, 12, 50, 20, 40, 20, 20, 15, 75, 25, 20]
  };
  /* sales at MRP at the opening list, then before GST at the three lists */
  var VALUE = { st_anand: [13358, 12961, 13303, 13884], st_vvn: [9744, 9430, 9644, 10118], st_nadiad: [6550, 6356, 6525, 6806] };
  /* standing = normal days of sale, rounded up: tenths of a day per item; puffs 1.12 x (S2 1.10), rounded up to 5 */
  var DAYS10 = [15, 15, 15, 16, 15, 15, 15, 15, 20, 50, 50, 50, 50, 50, 30];
  STORES.forEach(function (s) {
    var u = UNIT[s];
    eq(s + ' normal-day sale', FG.map(function (k) { return S.stores.sale[s][k] || 0; }), SALE[s]);
    eq(s + ' standing quantities', FG.map(function (k) { return u.standing[k] || 0; }), STANDING[s]);
    eq(s + ' standing by the rule of 6.5', FG.map(function (k, i) {
      var q = SALE[s][i];
      if (i < 15) return Math.ceil(q * DAYS10[i] / 10);
      return Math.ceil(q * (s === 'st_vvn' ? 110 : 112) / 500) * 5;
    }), STANDING[s]);
    var oneDay = FG.filter(function (k) { return ITEM[k].shelfLifeDays === 1 && u.standing[k] > 0; });
    ok(s + ' standing quantities include a one-day item', oneDay.length > 0, 'none');
    eq(s + ' one-day items on standing', oneDay, ['FG16', 'FG17', 'FG18']);
    near(s + ' sales at MRP, opening list', sum(FG, function (k) { return S.stores.sale[s][k] * LISTS.opening[k].mrp; }), rs(VALUE[s][0]), 0);
    ['opening', 'rev1', 'rev2'].forEach(function (l, i) {
      near(s + ' sales before GST, ' + l, sum(FG, function (k) { return S.stores.sale[s][k] * realisation(k, LISTS[l]); }), rs(VALUE[s][1 + i]), 60);
    });
    /* 12.8: ladi pav stands at 1.6 days and lives three, so a part-pack near its date is always on the shelf */
    ok(s + ' ladi pav standing covers the largest demand factor', u.standing.FG04 >= S.stores.sale[s].FG04 * S.stories.nearExpiry.largestDemandFactor);
  });
  eq('all stores, normal-day sale', FG.map(function (k) { return normalDayUnits(k).store; }), [91, 28, 8, 68, 25, 16, 10, 8, 32, 32, 15, 28, 16, 16, 31, 335, 115, 105]);
  eq('unsaleable rates', FG.slice(0, 15).map(function (k) { return S.stores.unsaleableRate[k]; }), [0.03, 0.05, 0.06, 0.04, 0.04, 0.05, 0.06, 0.06, 0.03, 0.002, 0.002, 0.003, 0.003, 0.002, 0.02]);
  /* seasonal puff standing: [FG16, FG17, FG18] base, summer, college vacation */
  function puffs(s, d) { var st = S.stores.standingOn(s, d); return [st.FG16, st.FG17, st.FG18]; }
  eq('S1 puffs: base, summer', [puffs('st_anand', '2026-04-05'), puffs('st_anand', '2026-04-06'), puffs('st_anand', '2026-06-10'), puffs('st_anand', '2026-06-11')],
    [[150, 55, 45], [135, 50, 45], [135, 50, 45], [150, 55, 45]]);
  eq('S2 puffs: base, summer, vacation over summer, base', [puffs('st_vvn', '2026-04-05'), puffs('st_vvn', '2026-04-26'), puffs('st_vvn', '2026-04-27'), puffs('st_vvn', '2026-06-14'), puffs('st_vvn', '2026-06-15'), puffs('st_vvn', '2027-10-26'), puffs('st_vvn', '2027-11-16')],
    [[155, 55, 55], [140, 50, 50], [110, 40, 40], [110, 40, 40], [155, 55, 55], [110, 40, 40], [155, 55, 55]]);
  eq('S3 puffs: base, summer', [puffs('st_nadiad', '2027-04-05'), puffs('st_nadiad', '2027-04-06')], [[75, 25, 20], [70, 25, 20]]);
  ok('only the puffs change with the season', STORES.every(function (s) {
    return ['2026-05-01', '2026-11-10', '2027-05-20'].every(function (d) {
      var st = S.stores.standingOn(s, d);
      return FG.slice(0, 15).every(function (k) { return st[k] === UNIT[s].standing[k]; });
    });
  }));
  eq('UPI share and float', [S.stores.upiShare.st_anand, S.stores.upiShare.st_vvn, S.stores.upiShare.st_nadiad, S.stores.float], [0.60, 0.75, 0.60, rs(3000)]);
  eq('store deposit days: Thursday 1 January 2026, then Monday', ['2026-01-01', '2026-01-02', '2026-01-05'].map(S.stores.isDepositDay), [true, false, true]);
  eq('a deposit day that is closed moves to the next open day', ['2026-11-09', '2026-11-12', '2026-11-13'].map(S.stores.isDepositDay), [false, true, false]);
  /* the weekly write-off request: every Sunday, the Monday after if the Sunday is closed (6.5) */
  var woDays = ALL_DAYS.filter(S.stores.isWriteOffDay);
  eq('the weekly write-off request: one for every Sunday of the two years', woDays.length, ALL_DAYS.filter(function (d) { return D.dow(d) === S.stores.writeOff.dow; }).length);
  eq('it is on a Sunday, except the one of the closed Sunday 31 October 2027', woDays.filter(function (d) { return D.dow(d) !== 6; }), ['2027-11-01']);
  ok('and never on a closed day', woDays.every(function (d) { return !S.calendar.isClosed(d); }));
  /* 8.3, 14 point 6: the documents of S1 and S3 are raised under u_store_mgr, whose employee is the manager of S2; the note names the store's own manager */
  eq('store managers', [S.stores.manager.st_anand, S.stores.manager.st_vvn, S.stores.manager.st_nadiad], ['E029', 'E032', 'E034']);
  eq('the one store persona is the manager of S2', [S.stores.userId, USER.u_store_mgr.employeeId, USER.u_store_mgr.unitId], ['u_store_mgr', 'E032', 'st_vvn']);
  eq('the note of a store document names the manager at S1 and S3 and is empty at S2', STORES.map(S.stores.managerNote),
    ['Store manager: Ketan Bhatt (E029)', '', 'Store manager: Alpesh Trivedi (E034)']);
});

/* ====================================================== 5. recipes and costs */

/* RESEARCH 11.1: unit cost in rupees at the prices of January 2026, October 2026 (latest) and December 2027; packing at October 2026 */
var COST = {
  FG01: [13.73, 14.90, 15.87, 1.35], FG02: [13.65, 14.84, 15.79, 1.35], FG03: [27.32, 29.66, 31.59, 2.01], FG04: [15.35, 16.66, 17.75, 0.85],
  FG05: [8.90, 9.65, 10.25, 0.85], FG06: [9.84, 10.63, 11.26, 0.85], FG07: [8.47, 9.20, 9.76, 0.85], FG08: [13.04, 14.15, 15.03, 0.85],
  FG09: [7.71, 8.38, 8.91, 0.85], FG10: [20.19, 22.09, 23.28, 2.43], FG11: [35.88, 38.70, 40.92, 3.19], FG12: [31.88, 34.64, 37.18, 3.19],
  FG13: [25.51, 28.27, 30.47, 3.19], FG14: [25.17, 27.49, 29.39, 2.43], FG15: [20.94, 22.58, 23.52, 7.35], FG16: [5.65, 6.42, 6.70, 0.19],
  FG17: [10.83, 11.89, 12.50, 0.19], FG18: [6.85, 7.56, 7.97, 0.19]
};

section('Recipes, expected units and unit recipe cost (RESEARCH 3.2, 3.3, 11.1, 12.1)', function () {
  /* 3.3: flour kg, pieces per mix T, normal reject %, drift %, expected good units E, packing, mix step */
  var T33 = {
    FG01: [50, 186, 1.5, 0.5, 183, 'PM01+PM08', 0.5], FG02: [25, 93, 2, 0.6, 91, 'PM01+PM08', 0.5], FG03: [25, 46, 1.5, 0.5, 45, 'PM02+PM08', 0.5],
    FG04: [50, 187, 2, 0.8, 183, 'PM03+PM08', 0.5], FG05: [10, 76, 2, 0.8, 74, 'PM03+PM08', 0.5], FG06: [10, 76, 2, 0.8, 74, 'PM03+PM08', 0.5],
    FG07: [10, 78, 2, 0.8, 76, 'PM03+PM08', 0.5], FG08: [10, 50, 2, 0.8, 49, 'PM03+PM08', 0.5], FG09: [15, 105, 3, 1, 101, 'PM03+PM08', 0.5],
    FG10: [25, 125, 2, 1.5, 122, 'PM04+PM08', 0.5], FG11: [50, 154, 2, 1.5, 150, 'PM05+PM08', 0.5], FG12: [20, 139, 3, 2, 134, 'PM05+PM08', 0.5],
    FG13: [20, 141, 3, 2, 136, 'PM05+PM08', 0.5], FG14: [15, 92, 2, 1.2, 90, 'PM04+PM08', 0.5], FG15: [6, 89, 3, 1, 86, 'PM06+PM08', 0.5],
    FG16: [2.5, 92, 3, 1.5, 89, 'PM07', 0.25], FG17: [2.5, 92, 3, 1.5, 89, 'PM07', 0.25], FG18: [2.5, 92, 3, 1.5, 89, 'PM07', 0.25]
  };
  FG.forEach(function (id) {
    var r = RECIPE[id], p = S.production.byItem[id], t = T33[id], flour = 0;
    r.materials.forEach(function (m) { if (m.itemId === 'RM01' || m.itemId === 'RM02') flour += m.qty; });
    eq(id + ' flour per mix', flour, t[0]);
    eq(id + ' mix label', r.mixLabel, t[0] + ' kg flour mix');
    eq(id + ' pieces per mix, reject, drift, expected units, step', [p.piecesPerMix, p.reject, p.drift, r.expectedUnits, p.step], [t[1], t[2] / 100, t[3] / 100, t[4], t[6]]);
    eq(id + ' expected units = pieces less the normal reject, rounded down', Math.floor(t[1] * (1000 - t[2] * 10) / 1000), t[4]);
    eq(id + ' packing', r.packing.map(function (k) { return k.itemId; }).join('+'), t[5]);
    ok(id + ' one of each packing item per good unit', r.packing.every(function (k) { return k.qtyPerUnit === 1; }));
    ok(id + ' no material twice and every quantity above zero', r.materials.every(function (m, i) {
      return m.qty > 0 && r.materials.findIndex(function (x) { return x.itemId === m.itemId; }) === i;
    }));
    eq(id + ' unit cost at January 2026 prices', Math.round(recipeCost(id, '2026-01')), rs(COST[id][0]));
    eq(id + ' unit cost at October 2026 prices', Math.round(recipeCost(id, '2026-10')), rs(COST[id][1]));
    eq(id + ' unit cost at December 2027 prices', Math.round(recipeCost(id, '2027-12')), rs(COST[id][2]));
    eq(id + ' of which packing, October 2026', Math.round(sum(r.packing, function (k) { return S.prices.inMonth(k.itemId, '2026-10'); })), rs(COST[id][3]));
  });
  /* a few cells of the matrix of 3.2, and what the three puffs and the four buns share */
  function qty(id, m) { var x = RECIPE[id].materials.filter(function (l) { return l.itemId === m; })[0]; return x ? x.qty : 0; }
  eq('matrix cells', [qty('FG01', 'RM08'), qty('FG02', 'RM02'), qty('FG07', 'RM02'), qty('FG06', 'RM16'), qty('FG10', 'RM14'), qty('FG11', 'RM18'), qty('FG13', 'RM05'), qty('FG15', 'RM17'), qty('FG17', 'RM22'), qty('FG18', 'RM23'), qty('FG16', 'RM19')],
    [1.25, 12.5, 7.5, 0.45, 0.1, 0.06, 13, 1.2, 1.5, 0.3, 2.2]);
  eq('materials used by no recipe', C.items.filter(function (i) {
    return i.kind !== 'fg' && !C.recipes.some(function (r) { return r.materials.concat(r.packing).some(function (m) { return m.itemId === i.id; }); });
  }).map(function (i) { return i.id; }), []);
  /* 12.1: what the screens show of sandwich bread and ladi pav */
  function pct(id, m, date) { return Math.round(recipeCost(id, m) / S.priceListOn(date)[id].retail * 1000) / 10; }
  eq('sandwich bread cost, April and October 2026, April and September 2027', ['2026-04', '2026-10', '2027-04', '2027-09'].map(function (m) { return Math.round(recipeCost('FG01', m)); }), [1351, 1490, 1483, 1572]);
  eq('of which flour, April and October 2026', ['2026-04', '2026-10'].map(function (m) { return Math.round(50 * S.prices.inMonth('RM01', m) / 183); }), [956, 1066]);
  eq('sandwich bread cost % of retailer price: Apr, Jun, Jul, Oct 2026, Apr, Sep 2027',
    [pct('FG01', '2026-04', '2026-04-15'), pct('FG01', '2026-06', '2026-06-15'), pct('FG01', '2026-07', '2026-07-15'), pct('FG01', '2026-10', '2026-10-15'), pct('FG01', '2027-04', '2027-04-15'), pct('FG01', '2027-09', '2027-09-15')],
    [44.3, 46.0, 43.7, 45.2, 45.0, 47.6]);
  eq('ladi pav cost % of retailer price: Apr, Jun, Jul, Oct 2026, Sep 2027',
    [pct('FG04', '2026-04', '2026-04-15'), pct('FG04', '2026-06', '2026-06-15'), pct('FG04', '2026-07', '2026-07-15'), pct('FG04', '2026-10', '2026-10-15'), pct('FG04', '2027-09', '2027-09-15')],
    [52.4, 54.3, 53.0, 54.6, 57.7]);
  eq('maida at the points of the flour story', S.stories.flour.points.map(function (p) { return S.prices.inMonth('RM01', p[0]); }), S.stories.flour.points.map(function (p) { return p[1]; }));
});

section('No product sells below cost in any channel, in any month (RESEARCH 11.1, band 16)', function () {
  /* highest cost % of retailer price and its month, highest cost % of corporate price and its month, lowest margin to the retailer in rupees */
  var T = {
    FG01: [48.1, '2027-12', 51.2, '2027-12', 16.46], FG02: [42.1, '2027-12', 44.5, '2027-12', 21.04], FG03: [54.0, '2027-12', 59.1, '2027-12', 26.91],
    FG04: [58.2, '2027-12', 62.3, '2027-12', 12.75], FG05: [38.7, '2027-12', 41.0, '2027-12', 15.84], FG06: [38.2, '2027-12', 41.0, '2027-12', 17.90],
    FG07: [29.6, '2027-12', 31.5, '2027-12', 21.78], FG08: [37.1, '2027-12', 40.6, '2027-12', 24.59], FG09: [38.7, '2027-12', 41.4, '2027-12', 13.61],
    FG10: [54.3, '2026-08', 57.1, '2026-08', 18.96], FG11: [57.8, '2026-08', 60.5, '2026-08', 28.70], FG12: [67.6, '2027-03', 70.2, '2027-03', 17.19],
    FG13: [59.7, '2027-03', 62.2, '2027-03', 19.77], FG14: [49.4, '2027-03', 51.7, '2027-03', 28.83], FG15: [54.8, '2026-08', 58.3, '2026-08', 18.98],
    FG16: [55.8, '2026-10', 58.4, '2026-10', 5.08], FG17: [62.9, '2027-03', 66.4, '2027-03', 7.05], FG18: [49.6, '2026-10', 52.1, '2026-10', 7.69]
  };
  var worst = { share: 0, id: '', month: '', channel: '' };
  FG.forEach(function (id) {
    var hiR = [0, ''], hiC = [0, ''], lowMargin = Infinity, below = [];
    S.prices.months.forEach(function (m) {
      var cost = recipeCost(id, m), p = S.priceListOn(m + '-01')[id], real = realisation(id, S.priceListOn(m + '-01'));
      [['retail', p.retail], ['corporate', p.corporate], ['store', real]].forEach(function (ch) {
        if (!(cost < ch[1])) below.push(m + ' ' + ch[0]);
        if (cost / ch[1] > worst.share) worst = { share: cost / ch[1], id: id, month: m, channel: ch[0] };
      });
      if (cost / p.retail > hiR[0]) hiR = [cost / p.retail, m];
      if (cost / p.corporate > hiC[0]) hiC = [cost / p.corporate, m];
      lowMargin = Math.min(lowMargin, p.retail - cost);
    });
    eq(id + ' cost is under the retailer price, the corporate price and the store realisation in all 24 months', below, []);
    eq(id + ' highest cost % of retailer price, and when', [Math.round(hiR[0] * 1000) / 10, hiR[1]], [T[id][0], T[id][1]]);
    eq(id + ' highest cost % of corporate price, and when', [Math.round(hiC[0] * 1000) / 10, hiC[1]], [T[id][2], T[id][3]]);
    eq(id + ' lowest margin to the retailer', Math.round(lowMargin), rs(T[id][4]));
  });
  note('thinnest line: ' + worst.id + ' to ' + worst.channel + ' in ' + worst.month + ', cost ' + (worst.share * 100).toFixed(1) + '% of the price');
  ok('butter khari to corporates in March 2027 is the thinnest line of all', worst.id === 'FG12' && worst.month === '2027-03' && worst.channel === 'corporate');
});

section('A normal day\'s sales by channel and by item (RESEARCH 11.2, 11.3)', function () {
  /* price list, cost month: retail gross, stale returns, corporates, own stores, total net, recipe cost of goods sold (rupees) */
  var T112 = [
    ['opening', '2026-01', 57586, 2095, 24096, 28747, 108333, 50988],
    ['opening', '2026-06', 57586, 2095, 24096, 28747, 108333, 52633],
    ['rev1', '2026-10', 60161, 2229, 25214, 29472, 112617, 55597],
    ['rev1', '2027-03', 60161, 2229, 25214, 29472, 112617, 55953],
    ['rev2', '2027-04', 61598, 2237, 25640, 30807, 115808, 55776],
    ['rev2', '2027-12', 61598, 2237, 25640, 30807, 115808, 59023]
  ];
  var UNITS = {};
  FG.forEach(function (id) { UNITS[id] = normalDayUnits(id); });
  T112.forEach(function (t) {
    var list = LISTS[t[0]], label = t[0] + ' list, ' + t[1] + ' costs: ';
    var retail = sum(OUTLETS, function (c) { return standingValue(c, list); });
    var returned = sum(OUTLETS, function (c) { return sum(keys(c.standing), function (k) { return S.returns.expected(c.id, k, c.standing[k], '2026-01-10', 'dry') * list[k].retail; }); });
    var corp = sum(CORPS, function (c) { return orderValue(c, list) * ordersAWeek(c) / 7; });
    var store = sum(STORES, function (s) { return sum(FG, function (k) { return S.stores.sale[s][k] * realisation(k, list); }); });
    var cogs = sum(FG, function (k) { return (UNITS[k].retail + UNITS[k].corporate + UNITS[k].store) * recipeCost(k, t[1]); });
    near(label + 'retail outlets, gross', retail, rs(t[2]), 50);
    near(label + 'stale returns at the expected rate', returned, rs(t[3]), 100);
    near(label + 'corporates, weekly average a day', corp, rs(t[4]), 50);
    near(label + 'own stores, before GST', store, rs(t[5]), 100);
    near(label + 'total net of returns', retail - returned + corp + store, rs(t[6]), 200);
    near(label + 'recipe cost of goods sold', cogs, rs(t[7]), 200);
    ok(label + 'recipe cost is 45-55% of net sales', cogs / (retail - returned + corp + store) > 0.45 && cogs / (retail - returned + corp + store) < 0.55);
  });
  /* 11.3 at the latest prices: retail units, corporate units, store units, total Rs before GST and gross of returns */
  var T113 = {
    FG01: [531, 27.14, 91, 22095], FG02: [95, 22.00, 28, 5660], FG03: [0, 159.71, 8, 9121], FG04: [431, 169.86, 68, 20570], FG05: [122, 22.29, 25, 4615],
    FG06: [16, 20.00, 16, 1614], FG07: [10, 6.00, 10, 926], FG08: [0, 60.29, 8, 2631], FG09: [88, 41.29, 32, 3840], FG10: [150, 13.00, 32, 8415],
    FG11: [33, 11.00, 15, 4245], FG12: [113, 0.00, 28, 7856], FG13: [37, 0.00, 16, 2803], FG14: [30, 4.00, 16, 3071], FG15: [45, 16.57, 31, 4168],
    FG16: [0, 240.00, 335, 7426], FG17: [0, 25.71, 115, 3201], FG18: [0, 40.71, 105, 2590]
  };
  var total = 0, nil = 0;
  FG.forEach(function (id) {
    var u = UNITS[id], l = LISTS.rev1[id], value = u.retail * l.retail + u.corporate * l.corporate + u.store * realisation(id, LISTS.rev1);
    eq(id + ' units a day: retail, corporate, store', [u.retail, round2(u.corporate), u.store], T113[id].slice(0, 3));
    near(id + ' value a day at the latest prices', value, rs(T113[id][3]), 100);
    total += value; if (ITEM[id].gstRate === 0) nil += value;
  });
  near('all items, value a day', total, rs(114846), 300);
  near('the nine Nil-rated lines, share of sales value', nil / total, 0.62, 0.005);
  /* 7.9 */
  eq('return rates', FG.slice(0, 15).map(function (k) { return S.returns.rate[k]; }), [0.045, 0.06, 0.05, 0.055, 0.05, 0.055, 0.06, 0.05, 0.04, 0.003, 0.003, 0.005, 0.005, 0.003, 0.015]);
  eq('return lags in days', FG.slice(0, 15).map(function (k) { return S.returns.lagDays[k]; }), [3, 3, 3, 2, 3, 3, 3, 3, 4, 30, 30, 30, 30, 30, 10]);
  ok('puffs are not on the routes: no return rate', ['FG16', 'FG17', 'FG18'].every(function (k) { return !S.returns.rate[k]; }));
  eq('season factor: June, July, September, October, a heavy-rain day', [S.returns.seasonFactorOn('2026-06-30'), S.returns.seasonFactorOn('2026-07-01'), S.returns.seasonFactorOn('2026-09-30'), S.returns.seasonFactorOn('2026-10-01'), S.returns.seasonFactorOn('2026-07-09', 'heavy')], [1, 1.25, 1.25, 1, 1.6]);
  /* expected share of an outlet's supply that comes back, against the 8% limit (7.9, 12.3) */
  function share(id, season) {
    var c = CUST[id];
    return sum(keys(c.standing), function (k) { return c.standing[k] * LISTS.rev1[k].retail * S.returns.rate[k] * S.returns.outletFactor(id) * season; }) / standingValue(c, LISTS.rev1);
  }
  near('O19 returns run at about 13.2% of its supply', share('O19', 1), 0.132, 0.004);
  near('O19 in the monsoon, about 16.4%', share('O19', 1.25), 0.164, 0.005);
  near('O38 about 6.5%, 8.1% in the monsoon', share('O38', 1), 0.065, 0.003);
  eq('outlets whose expected returns are above the limit outside the monsoon', OUTLETS.filter(function (c) { return share(c.id, 1) > C.limits.returnsPct / 100; }).map(function (c) { return c.id; }), ['O19']);
  eq('and in the monsoon', OUTLETS.filter(function (c) { return share(c.id, 1.25) > C.limits.returnsPct / 100; }).map(function (c) { return c.id; }), ['O19', 'O38']);
  eq('credit note date: lag, moved off a closed day', [S.returns.noteDate('FG01', '2026-03-10'), S.returns.noteDate('FG04', '2026-11-08'), S.returns.noteDate('FG09', '2026-11-06')], ['2026-03-13', '2026-11-12', '2026-11-12']);
});

/* ====================================================== 6. production */

section('The standard day plan fits the mix limits (RESEARCH 3.5, 11.5)', function () {
  /* rhythm (Mon = 0), normal-day requirement, standard mixes, good units at the standard, average, smallest, largest, maximum, cover */
  var T35 = {
    FG01: ['daily', 652, 4, 732, 3.55, 2, 4.5, null, null], FG02: ['daily', 146, 2, 182, 1.62, 1, 2, null, null], FG03: ['daily', 168, 4, 180, 3.57, 1, 5, null, null],
    FG04: ['daily', 672, 4, 732, 3.59, 2, 4.5, null, null], FG05: ['daily', 170, 2.5, 185, 2.24, 1, 3, null, null], FG06: ['daily', 53, 1, 74, 0.72, 0.5, 1.5, null, null],
    FG07: ['daily', 27, 0.5, 38, 0.50, 0.5, 0.5, null, null], FG08: ['daily', 69, 1.5, 74, 1.42, 0.5, 3, null, null], FG09: ['daily', 162, 2, 202, 1.62, 0.5, 2.5, null, null],
    FG10: [[0, 2, 4], 195, 4, 488, 3.75, 1, 6, 6, 7], FG11: [[1, 3, 5], 59, 1, 150, 1.03, 1, 1.5, 6, 7], FG12: [[0, 3], 141, 4, 536, 3.68, 1, 5.5, 6, 6],
    FG13: [[1, 4], 53, 1.5, 204, 1.38, 1, 2.5, 6, 6], FG14: [[2, 5], 50, 2, 180, 2.00, 1, 4.5, 6, 8], FG15: [[0, 2, 4], 93, 3, 258, 2.53, 1, 4, 4, 3],
    FG16: ['daily', 620, 7, 623, 7.11, 3.5, 9, null, null], FG17: ['daily', 161, 2, 178, 2.04, 1.5, 2.25, null, null], FG18: ['daily', 161, 2, 178, 2.04, 1.5, 2.5, null, null]
  };
  FG.forEach(function (id) {
    var r = RECIPE[id], p = S.production.byItem[id], t = T35[id];
    eq(id + ' rhythm and standard mixes', [r.rhythm, r.standardMixes], [t[0], t[2]]);
    eq(id + ' normal-day requirement, average, smallest and largest run, maximum, cover', [p.normalDayUnits, p.averageMixes, p.smallestRun, p.largestRun, p.maxMixes, p.coverDays], [t[1], t[4], t[5], t[6], t[7], t[8]]);
    eq(id + ' good units at the standard', Math.floor(r.expectedUnits * r.standardMixes + 0.5), t[3]);
    ok(id + ' standard mixes are a whole number of mix steps', Math.abs(r.standardMixes / p.step - Math.round(r.standardMixes / p.step)) < 1e-9);
    ok(id + ' standard mixes lie inside the smallest and largest run', r.standardMixes >= p.smallestRun && r.standardMixes <= p.largestRun);
    ok(id + ' the largest run is inside the maximum', p.maxMixes === null || (p.largestRun <= p.maxMixes && r.standardMixes <= p.maxMixes));
    ok(id + ' no run day is a Sunday', r.rhythm === 'daily' || r.rhythm.indexOf(6) === -1);
    /* the standard, over a week, covers the normal week (standard mixes are rounded up) */
    var runs = r.rhythm === 'daily' ? 7 : r.rhythm.length;
    ok(id + ' a week of standard runs covers a week of normal days', r.expectedUnits * r.standardMixes * runs >= p.normalDayUnits * 7,
      (r.expectedUnits * r.standardMixes * runs) + ' against ' + (p.normalDayUnits * 7));
    /* the normal-day requirement is the normal day's sale plus what the stores lose (3.5 against 11.3) */
    var u = normalDayUnits(id), sale = u.retail + u.corporate + u.store;
    ok(id + ' normal-day requirement is at least the normal day\'s sale', p.normalDayUnits >= Math.floor(sale) && p.normalDayUnits <= sale * 1.15, p.normalDayUnits + ' against ' + round2(sale));
  });
  /* flour of the standard day plan by weekday, Monday first (3.5: 663 kg on a Sunday, 743-861 on the other days, 775 on average) */
  function planOn(dow) { return C.recipes.filter(function (r) { return r.rhythm === 'daily' || r.rhythm.indexOf(dow) !== -1; }); }
  function use(dow, mats) {
    return sum(planOn(dow), function (r) { return sum(r.materials, function (m) { return mats.indexOf(m.itemId) !== -1 ? m.qty * r.standardMixes : 0; }); });
  }
  var flour = [0, 1, 2, 3, 4, 5, 6].map(function (d) { return use(d, ['RM01', 'RM02']); });
  eq('flour of the standard day plan, Monday to Sunday', flour, [860.5, 742.5, 810.5, 792.5, 810.5, 742.5, 662.5]);
  near('flour of the plan, average a day', sum(flour) / 7, 775, 0.6);
  eq('mixes on the 50 kg mixer in the plan (sandwich bread, ladi pav, milk toast), Monday to Sunday', [0, 1, 2, 3, 4, 5, 6].map(function (d) {
    return sum(planOn(d), function (r) { return S.production.byItem[r.itemId].flourKg === 50 ? r.standardMixes : 0; });
  }), [8, 9, 8, 9, 8, 9, 8]);
  eq('long-life runs on a weekday of the plan, Monday to Sunday', [0, 1, 2, 3, 4, 5, 6].map(function (d) { return planOn(d).filter(function (r) { return r.rhythm !== 'daily'; }).length; }), [3, 2, 3, 2, 3, 2, 0]);
  eq('daily lines: dough mixes and puff mixes of the plan', [sum(S.production.dailyItems.slice(0, 9), function (id) { return RECIPE[id].standardMixes; }), sum(S.production.dailyItems.slice(9), function (id) { return RECIPE[id].standardMixes; })], [21.5, 11]);
  /* the opening stock and the reorder levels against the plan (4.1, SPEC 6: every material covers the next three days of the plan) */
  var heaviest = {};
  C.items.forEach(function (it) {
    if (it.kind === 'fg') return;
    var day = [0, 1, 2, 3, 4, 5, 6].map(function (d) {
      return sum(planOn(d), function (r) {
        return sum(r.materials, function (m) { return m.itemId === it.id ? m.qty * r.standardMixes : 0; }) +
          sum(r.packing, function (k) { return k.itemId === it.id ? k.qtyPerUnit * r.expectedUnits * r.standardMixes : 0; });
      });
    });
    /* the plan used while an order is on its way, and the three days SPEC 6 asks every day-end to cover */
    var span = it.leadDays + 3, worst = 0, s, k, t;
    for (s = 0; s < 7; s++) { t = 0; for (k = 0; k < span; k++) t += day[(s + k) % 7]; worst = Math.max(worst, t); }
    heaviest[it.id] = worst;
    ok(it.id + ' reorder level covers the heaviest (lead + 3)-day stretch of the plan', it.reorderLevel >= worst, it.reorderLevel + ' against ' + round2(worst));
    /* 1 January 2026 is a Thursday: the plan of Thursday, Friday and Saturday */
    var open = C.opening.stock.filter(function (l) { return l.itemId === it.id; })[0].qty;
    ok(it.id + ' opening stock covers the plan of the first three days', open >= day[3] + day[4] + day[5], open + ' against ' + round2(day[3] + day[4] + day[5]));
  });
  ok('yeast: the order quantity is less than three days of the plan, so it stays on the low-stock list (12.7)', ITEM.RM08.orderQty < heaviest.RM08 * 3 / (ITEM.RM08.leadDays + 3));
  /* run days */
  eq('run days of elaichi toast in the first week of 2026', D.range('2026-01-01', '2026-01-07').filter(function (d) { return S.production.isRunDay('FG10', d); }), ['2026-01-02', '2026-01-05', '2026-01-07']);
  eq('no production on a factory holiday', S.calendar.factoryHolidays.filter(function (d) { return FG.some(function (id) { return S.production.isRunDay(id, d); }); }), []);
  eq('long-life runs that fall on the Diwali holidays of 2026 move to the next working day', FG.filter(function (id) { return !S.production.byItem[id].daily && S.production.isRunDay(id, '2026-11-11'); }), ['FG10', 'FG11', 'FG12', 'FG13', 'FG14', 'FG15']);
  /* 3.5 on every day of the two years: "no run day is a Sunday", a moved run included; the daily lines bake on Sundays */
  var RUN = S.production.runItems, scheduled = function (id, d) { return RECIPE[id].rhythm.indexOf(D.dow(d)) !== -1; };
  eq('no long-life run falls on a Sunday', ALL_DAYS.filter(function (d) { return researchDow(d) === 0 && RUN.some(function (id) { return S.production.isRunDay(id, d); }); }), []);
  ok('a long-life line runs on each of its weekdays that is not a factory holiday', RUN.every(function (id) {
    return ALL_DAYS.every(function (d) { return !scheduled(id, d) || S.calendar.isFactoryHoliday(d) || S.production.isRunDay(id, d); });
  }));
  var moved = [];
  ALL_DAYS.forEach(function (d) { RUN.forEach(function (id) { if (S.production.isRunDay(id, d) && !scheduled(id, d)) moved.push(d + ' ' + id); }); });
  eq('run days off the rhythm: the runs of the holidays, on Wednesday 11 November 2026 and Monday 1 November 2027', moved,
    ['2026-11-11 FG11', '2026-11-11 FG12', '2026-11-11 FG13', '2027-11-01 FG11', '2027-11-01 FG13', '2027-11-01 FG14']);
  eq('the six long-life lines run together on the first working day after each break', ['2026-11-11', '2027-11-01'].map(function (d) { return RUN.filter(function (id) { return S.production.isRunDay(id, d); }).length; }), [6, 6]);
  eq('the next run of jeera khari after Tuesday 26 October 2027', S.production.nextRunDay('FG13', '2027-10-26'), '2027-11-01');
  eq('a daily line bakes on every day but the five factory holidays, Sundays included', [ALL_DAYS.filter(function (d) { return S.production.isRunDay('FG01', d); }).length, S.production.isRunDay('FG16', '2027-10-31')], [725, true]);
  /* the yield formula of 3.4: no drift and the normal reject give the pieces less the reject */
  var o = S.production.outcome('FG01', 4, 0, 0.015);
  eq('sandwich bread, 4 mixes, no drift, normal reject', [o.made, o.rejected, o.good, o.expected], [744, 11, 733, 732]);
  eq('reject draw range', S.production.rejectDraw, [0.5, 1.6]);
  eq('bad-run chances on 1 May, 1 August and 1 December', ['overproof', 'softFatKhari', 'softFatPuff', 'ovenFault', 'humidity'].map(function (id) {
    return ['2026-05-01', '2026-08-01', '2026-12-01'].map(function (d) { return S.production.badRunChance(id, d); });
  }), [[0.02, 0.01, 0.005], [0.10, 0.04, 0.03], [0.03, 0.015, 0.01], [0.008, 0.008, 0.008], [0.02, 0.12, 0.02]]);
  eq('humidity season runs from 15 June to 30 September', ['2026-06-14', '2026-06-15', '2026-09-30', '2026-10-01'].map(function (d) { return S.production.badRunChance('humidity', d); }), [0.02, 0.12, 0.12, 0.02]);
});

/* ====================================================== 7. the opening entries through the engine */

section('Opening entries post through the engine and give the balances of RESEARCH 10', function () {
  HB.calendar.set('2026-02-01');
  ok('no seed is loaded: boot posts the opening entries of the config', !HB.seed);
  var book = HB.engine.boot();
  eq('nothing skipped, no notice', [HB.engine.skipped.length, HB.engine.notice], [0, '']);
  eq('documents by type', ['OPENSTOCK', 'OPENCASH', 'INV', 'VBILL'].map(function (t) { return book.byType[t].length; }), [1, 1, 26, 13]);
  eq('all of them', book.docList.length, 41);
  ok('every opening document is dated go-live, seeded and posted', book.docList.every(function (d) { return d.date === '2026-01-01' && d.seed === true && d.status === 'POSTED'; }));
  ok('opening invoices and bills carry the opening flag and no lines', book.byType.INV.concat(book.byType.VBILL).every(function (d) { return d.opening === true && (!d.lines || d.lines.length === 0); }));
  eq('nothing waits for approval', keys(book.pending).length, 0);
  eq('no sales, cost, expense or GST effect', [book.pnl.length, book.gst.length], [0, 0]);

  /* 10.1 */
  eq('cash and bank', book.cash.balance, { cash_factory: rs(64500), cash_st_anand: rs(17900), cash_st_vvn: rs(10300), cash_st_nadiad: rs(10100), bank: rs(875000) });
  eq('cash in hand', book.cash.balance.cash_factory + book.cash.balance.cash_st_anand + book.cash.balance.cash_st_vvn + book.cash.balance.cash_st_nadiad, rs(102800));

  /* 10.2 */
  var AR = { O11: [6700, '2026-01-05'], O05: [7700, '2026-01-05'], O01: [8300, '2026-01-05'], O10: [9400, '2026-01-05'], O12: [9000, '2026-01-05'],
    O14: [6600, '2026-01-06'], O17: [6200, '2026-01-06'], O23: [5400, '2026-01-06'], O32: [4100, '2026-01-07'], O25: [5000, '2026-01-07'],
    O33: [4000, '2026-01-07'], O34: [11600, '2026-01-01'], O38: [11200, '2025-12-29'], O04: [13400, '2025-12-22'], O19: [9600, '2025-12-11'],
    O28: [17800, '2025-11-19'], C01: [148000, '2026-01-20'], C02: [92000, '2026-01-16'], C03: [78000, '2026-01-28'], C07: [24000, '2026-01-09'],
    C09: [31000, '2026-01-05'], C10: [33000, '2026-01-12'], C04: [46000, '2025-12-24'], C05: [112000, '2025-12-12'], C06: [58000, '2025-12-03'],
    C08: [96000, '2025-11-26'] };
  var got = {};
  book.byType.INV.forEach(function (d) { got[d.customerId] = [d.total / 100, d.dueDate]; });
  eq('opening invoices: customer, amount, due date', got, AR);
  eq('receivables', book.ar.total, rs(854000));
  eq('each customer owes its opening invoice', keys(AR).filter(function (k) { return book.ar.balance[k] !== rs(AR[k][0]); }), []);
  eq('the 24 cash outlets have none', OUTLETS.filter(function (c) { return c.terms === 'cash' && book.ar.balance[c.id]; }).length, 0);
  eq('the twelve prompt weekly outlets', sum(['O11', 'O05', 'O01', 'O10', 'O12', 'O14', 'O17', 'O23', 'O32', 'O25', 'O33', 'O34'], function (k) { return book.ar.balance[k]; }), rs(84000));
  var age = { notDue: 0, d1_15: 0, d16_30: 0, d31_60: 0, older: 0 };
  book.byType.INV.forEach(function (d) {
    var n = D.diffDays(d.dueDate, '2026-01-01');
    age[n <= 0 ? 'notDue' : (n <= 15 ? 'd1_15' : (n <= 30 ? 'd16_30' : (n <= 60 ? 'd31_60' : 'older')))] += HB.engine.openAmount(d);
  });
  eq('ageing on 1 January: not due, 1-15, 16-30, 31-60 days overdue', age, { notDue: rs(490000), d1_15: rs(70600), d16_30: rs(179600), d31_60: rs(113800), older: 0 });
  ok('C06 opens above its credit limit, every other corporate inside it (12.4)', CORPS.every(function (c) { return (book.ar.balance[c.id] || 0) > c.creditLimit === (c.id === 'C06'); }));
  eq('the slow outlets and the late corporates open overdue', keys(AR).filter(function (k) { return AR[k][1] < '2026-01-01'; }).sort(), ['C04', 'C05', 'C06', 'C08', 'O04', 'O19', 'O28', 'O38']);

  /* 10.3 */
  var AP = { VM01: [278000, '2026-01-07'], VM02: [12000, '2026-01-06'], VM03: [62000, '2026-01-08'], VM04: [174000, '2026-01-14'], VM05: [31000, '2026-01-09'],
    VM06: [45000, '2026-01-05'], VM07: [85000, '2026-01-12'], VM08: [28000, '2025-12-27'], VM09: [7000, '2026-01-05'], VM10: [6000, '2026-01-03'],
    VM11: [12000, '2026-01-05'], VM12: [166000, '2026-01-20'], VM13: [64000, '2025-12-19'] };
  got = {};
  book.byType.VBILL.forEach(function (d) { got[d.vendorId] = [d.total / 100, d.dueDate]; });
  eq('opening bills: vendor, amount, due date', got, AP);
  eq('payables', book.ap.total, rs(970000));
  eq('each stock vendor is owed its opening bill', keys(AP).filter(function (k) { return book.ap.balance['vendor:' + k] !== rs(AP[k][0]); }), []);
  var due = { overdue: 0, w1: 0, later: 0 };
  book.byType.VBILL.forEach(function (d) { due[d.dueDate < '2026-01-01' ? 'overdue' : (d.dueDate <= '2026-01-07' ? 'w1' : 'later')] += d.total - d.paid; });
  eq('bills overdue, due 1-7 January, due 8-31 January', due, { overdue: rs(92000), w1: rs(360000), later: rs(518000) });
  ok('no expense bill and no salary is outstanding', book.byType.EXP.length === 0);

  /* 10.4 */
  function valueAt(locId, kinds) {
    return sum(keys(book.stock[locId]), function (k) { return kinds.indexOf(ITEM[k].kind) !== -1 ? book.stock[locId][k] * HB.engine.unitCost(k) : 0; });
  }
  var mat = valueAt('fac_rm', ['rm', 'pk']), fac = valueAt('fac_fg', ['fg']), s1 = valueAt('st_anand', ['fg']), s2 = valueAt('st_vvn', ['fg']), s3 = valueAt('st_nadiad', ['fg']);
  near('materials at the raw material store, Rs 4.82 lakh', mat, rs(481680), 0.5);
  near('finished goods at the factory, Rs 1.68 lakh', fac, rs(168000), rs(500));
  near('finished goods at S1, Rs 7,400', s1, rs(7400), rs(50));
  near('finished goods at S2, Rs 3,600', s2, rs(3600), rs(50));
  near('finished goods at S3, Rs 3,900', s3, rs(3900), rs(50));
  near('stock, about Rs 6.65 lakh', mat + fac + s1 + s2 + s3, rs(665000), rs(1000));
  near('net working capital, about Rs 15.3 lakh', rs(102800) + rs(875000) + book.ar.total + (mat + fac + s1 + s2 + s3) - book.ap.total, rs(1530000), rs(5000));
  eq('nothing in transit and no finished goods at the raw material store', [keys(book.stock.transit_st_anand).length, keys(book.stock.transit_st_vvn).length, keys(book.stock.transit_st_nadiad).length,
    keys(book.stock.fac_rm).filter(function (k) { return ITEM[k].kind === 'fg'; }).length], [0, 0, 0, 0]);
  /* the rate of every opening batch is the recipe cost at the opening rates (the table of 10.4 = the January column of 11.1) */
  FG.forEach(function (id) { eq(id + ' unit cost in the book after the opening entries', Math.round(HB.engine.unitCost(id)), rs(COST[id][0])); });
  keys(book.prices).forEach(function (k) { eq(k + ' first purchase price is the January 2026 price', book.prices[k].rate, S.prices.inMonth(k, '2026-01')); });
  eq('every material has its first purchase price', keys(book.prices).length, 32);

  /* the batches of 10.4: location, manufactured, best before, units */
  var B = {
    FG01: [['fac_fg', '2025-12-31', '2026-01-04', 740], ['st_anand', '2025-12-30', '2026-01-03', 23], ['st_vvn', '2025-12-30', '2026-01-03', 11], ['st_nadiad', '2025-12-30', '2026-01-03', 12]],
    FG02: [['fac_fg', '2025-12-31', '2026-01-04', 170], ['st_anand', '2025-12-30', '2026-01-03', 7], ['st_vvn', '2025-12-30', '2026-01-03', 4], ['st_nadiad', '2025-12-30', '2026-01-03', 3]],
    FG03: [['fac_fg', '2025-12-31', '2026-01-04', 200], ['st_anand', '2025-12-30', '2026-01-03', 2], ['st_vvn', '2025-12-30', '2026-01-03', 1], ['st_nadiad', '2025-12-30', '2026-01-03', 1]],
    FG04: [['fac_fg', '2025-12-31', '2026-01-03', 800], ['st_anand', '2025-12-30', '2026-01-02', 17], ['st_vvn', '2025-12-30', '2026-01-02', 8], ['st_nadiad', '2025-12-30', '2026-01-02', 9]],
    FG05: [['fac_fg', '2025-12-31', '2026-01-04', 210], ['st_anand', '2025-12-30', '2026-01-03', 5], ['st_vvn', '2025-12-30', '2026-01-03', 5], ['st_nadiad', '2025-12-30', '2026-01-03', 3]],
    FG06: [['fac_fg', '2025-12-31', '2026-01-04', 80], ['st_anand', '2025-12-30', '2026-01-03', 3], ['st_vvn', '2025-12-30', '2026-01-03', 4], ['st_nadiad', '2025-12-30', '2026-01-03', 1]],
    FG07: [['fac_fg', '2025-12-31', '2026-01-04', 40], ['st_anand', '2025-12-30', '2026-01-03', 2], ['st_vvn', '2025-12-30', '2026-01-03', 2], ['st_nadiad', '2025-12-30', '2026-01-03', 1]],
    FG08: [['fac_fg', '2025-12-31', '2026-01-04', 120], ['st_anand', '2025-12-30', '2026-01-03', 2], ['st_vvn', '2025-12-30', '2026-01-03', 2], ['st_nadiad', '2025-12-30', '2026-01-03', 1]],
    FG09: [['fac_fg', '2025-12-31', '2026-01-05', 240], ['st_anand', '2025-12-30', '2026-01-04', 14], ['st_vvn', '2025-12-30', '2026-01-04', 12], ['st_nadiad', '2025-12-30', '2026-01-04', 6]],
    FG10: [['fac_fg', '2025-12-24', '2026-03-24', 700], ['fac_fg', '2025-12-29', '2026-03-29', 1060], ['st_anand', '2025-12-24', '2026-03-24', 64], ['st_vvn', '2025-12-24', '2026-03-24', 24], ['st_nadiad', '2025-12-24', '2026-03-24', 40]],
    FG11: [['fac_fg', '2025-12-24', '2026-03-24', 220], ['fac_fg', '2025-12-29', '2026-03-29', 320], ['st_anand', '2025-12-24', '2026-03-24', 32], ['st_vvn', '2025-12-24', '2026-03-24', 12], ['st_nadiad', '2025-12-24', '2026-03-24', 16]],
    FG12: [['fac_fg', '2025-12-24', '2026-03-24', 450], ['fac_fg', '2025-12-29', '2026-03-29', 680], ['st_anand', '2025-12-24', '2026-03-24', 56], ['st_vvn', '2025-12-24', '2026-03-24', 24], ['st_nadiad', '2025-12-24', '2026-03-24', 32]],
    FG13: [['fac_fg', '2025-12-24', '2026-03-24', 170], ['fac_fg', '2025-12-29', '2026-03-29', 260], ['st_anand', '2025-12-24', '2026-03-24', 32], ['st_vvn', '2025-12-24', '2026-03-24', 16], ['st_nadiad', '2025-12-24', '2026-03-24', 16]],
    FG14: [['fac_fg', '2025-12-24', '2026-02-22', 200], ['fac_fg', '2025-12-29', '2026-02-27', 310], ['st_anand', '2025-12-24', '2026-02-22', 32], ['st_vvn', '2025-12-24', '2026-02-22', 16], ['st_nadiad', '2025-12-24', '2026-02-22', 16]],
    FG15: [['fac_fg', '2025-12-27', '2026-01-11', 190], ['fac_fg', '2025-12-30', '2026-01-14', 280], ['st_anand', '2025-12-27', '2026-01-11', 28], ['st_vvn', '2025-12-27', '2026-01-11', 24], ['st_nadiad', '2025-12-27', '2026-01-11', 10]],
    FG16: [['fac_fg', '2025-12-31', '2026-01-01', 700]], FG17: [['fac_fg', '2025-12-31', '2026-01-01', 180]], FG18: [['fac_fg', '2025-12-31', '2026-01-01', 190]]
  };
  var order = { fac_fg: 0, st_anand: 1, st_vvn: 2, st_nadiad: 3 };
  FG.forEach(function (id) {
    var lots = [];
    keys(order).forEach(function (loc) { (book.lots[loc][id] || []).forEach(function (l) { lots.push([loc, l.mfgDate, l.bestBefore, l.qty]); }); });
    lots.sort(function (a, b) { return order[a[0]] - order[b[0]] || (a[1] < b[1] ? -1 : 1); });
    eq(id + ' opening batches', lots, B[id]);
    ok(id + ' best before = manufactured + shelf life', lots.every(function (l) { return l[2] === D.addDays(l[1], ITEM[id].shelfLifeDays); }));
  });
  /* the rules behind the store batches: half a normal day of each fresh line (a full day of pizza base), four days of FG10-FG14, two of FG15 */
  STORES.forEach(function (s) {
    eq(s + ' opening stock by the rule of 10.4', FG.map(function (k, i) { return book.stock[s][k] || 0; }), FG.map(function (k, i) {
      var q = S.stores.sale[s][k];
      return i < 8 ? Math.ceil(q / 2) : (i === 8 ? q : (i < 14 ? q * 4 : (i === 14 ? q * 2 : 0)));
    }));
  });

  /* the hand-over on the opening day: each fresh line and each puff opens at 1.05 x the hand-over quantity of 1 January, rounded up to 10 */
  var first = '2026-01-01', handOver = {};
  FG.forEach(function (id) { handOver[id] = 0; });
  C.routes.forEach(function (r) {
    var sheet = HB.engine.dispatchSheet(r.id, first);
    ok('dispatch sheet of ' + r.id + ' on the opening day lists every outlet in stop order', sheet.ok && sheet.outlets.map(function (o) { return o.customerId; }).join() === r.stops.join());
    sheet.outlets.forEach(function (o) { o.lines.forEach(function (l) { handOver[l.itemId] += l.qty; }); });
  });
  STORES.forEach(function (s) {
    var sheet = HB.engine.transferSheet(s, first);
    ok('transfer sheet of ' + s + ' on the opening day tops every item up to its standing', sheet.ok && sheet.lines.every(function (l) { return l.standing === UNIT[s].standing[l.itemId] && l.qty === Math.max(0, l.standing - l.atStore - l.inTransit); }));
    FG.forEach(function (k) { handOver[k] += UNIT[s].standing[k]; });
  });
  CORPS.forEach(function (c) { if (S.corporates.orderDay(c.id, first)) c.pattern.lines.forEach(function (l) { handOver[l.itemId] += l.qty; }); });
  S.production.dailyItems.forEach(function (id) {
    eq(id + ' opens at 1.05 x the hand-over of 1 January, rounded up to 10', book.stock.fac_fg[id], Math.ceil(handOver[id] * 105 / 1000) * 10);
  });
  FG.forEach(function (id) {
    ok(id + ' the sheets, transfers and corporate orders of the opening day post as prefilled', HB.engine.available('fac_fg', id, first) >= handOver[id],
      HB.engine.available('fac_fg', id, first) + ' available, ' + handOver[id] + ' to hand over');
  });
  /* how the seed settles the opening balances (10.2, 10.3) */
  var st = S.openingSettlement;
  eq('opening invoices received by the customer\'s payment rule', ['C01', 'C02', 'C03', 'C07', 'C09', 'C10'].map(function (k) { return st.receivables[k][0].date; }),
    ['2026-01-26', '2026-01-20', '2026-01-28', '2026-01-13', '2026-01-08', '2026-01-16']);
  eq('O28 and C06 pay in two halves', [st.receivables.O28, st.receivables.C06], [[{ date: '2026-01-15', share: 0.5 }, { date: '2026-02-15', share: 0.5 }], [{ date: '2026-01-20', share: 0.5 }, { date: '2026-02-10', share: 0.5 }]]);
  eq('opening bills paid on the first payment day on or after the due date', ['VM01', 'VM02', 'VM03', 'VM04', 'VM05', 'VM06', 'VM07', 'VM12'].map(function (k) { return st.payables[k][0].date; }),
    ['2026-01-08', '2026-01-08', '2026-01-08', '2026-01-15', '2026-01-12', '2026-01-05', '2026-01-12', '2026-01-22']);
  eq('the vegetable and paneer vendors are paid from factory cash', keys(st.payables).filter(function (k) { return st.payables[k][0].account === 'cash_factory'; }), ['VM09', 'VM11']);
  ok('factory cash covers them on 5 January', book.cash.balance.cash_factory >= rs(7000) + rs(12000));
  ok('nothing is settled before go-live or on a closed day', keys(st.receivables).concat(keys(st.payables)).every(function (k) {
    return (st.receivables[k] || st.payables[k]).every(function (p) { return p.date >= '2026-01-01' && !S.calendar.isClosed(p.date); });
  }));
});

/* ====================================================== 8. dates and series */

section('Weekdays: numbered from Monday in the config, from Sunday in RESEARCH (conventions, 7.2)', function () {
  /* RESEARCH writes Sun = 0 ... Sat = 6 and prints 7.2 Sunday first; the config numbers a weekday as HB.dates.dow does (CONFIG choice 1). */
  /* Every weekday the config names is read here through a real date, so that an array or a number written the other way round fails. */
  eq('sim.dow', S.dow, { MON: 0, TUE: 1, WED: 2, THU: 3, FRI: 4, SAT: 5, SUN: 6 });
  ok('HB.dates.dow is RESEARCH\'s weekday moved by one, on every day', ALL_DAYS.every(function (d) { return D.dow(d) === (researchDow(d) + 6) % 7; }));
  eq('1 January 2026 is a Thursday and 4 January a Sunday', [D.dow('2026-01-01'), researchDow('2026-01-01'), D.dow('2026-01-04'), researchDow('2026-01-04')], [3, 4, 6, 0]);
  /* 7.2 as printed: Sun Mon Tue Wed Thu Fri Sat */
  var T72 = {
    P: [1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.05], D: [1.05, 1.00, 1.00, 1.00, 1.00, 1.00, 1.05], T: [0.60, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00],
    B: [1.15, 1.00, 1.00, 1.00, 1.00, 1.00, 1.10], G: [1.15, 1.00, 1.00, 1.00, 1.00, 1.00, 1.10],
    st_anand: [1.20, 1.00, 1.00, 1.00, 1.00, 1.00, 1.10], st_vvn: [0.85, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00], st_nadiad: [1.15, 1.00, 1.00, 1.00, 1.00, 1.00, 1.05],
    C08: [1.20, 1.00, 1.00, 1.00, 1.00, 1.00, 1.20]
  };
  /* the week of Sunday 18 to Saturday 24 January 2026 */
  var week = D.range('2026-01-18', '2026-01-24');
  function printed(arr) { return week.map(function (d) { return arr[D.dow(d)]; }); }
  ['P', 'D', 'T', 'B', 'G'].forEach(function (t) { eq('weekday factors of outlet type ' + t + ', Sunday first as 7.2 prints them', printed(S.demand.weekday.outlet[t]), T72[t]); });
  STORES.forEach(function (s) { eq('weekday factors of ' + s + ', Sunday first', printed(S.demand.weekday.store[s]), T72[s]); });
  eq('weekday factors of the hotel C08, Sunday first', printed(S.demand.weekday.corporate.C08), T72.C08);
  eq('only C08 has a weekday factor among the corporates', keys(S.demand.weekday.corporate), ['C08']);
  /* the weekdays named one by one, each as RESEARCH's number */
  function asResearch(dow) { return (dow + 1) % 7; }
  eq('collection days: R1 Monday, R2 Tuesday, R3 Wednesday, R4 Thursday (6.2)', ['R1', 'R2', 'R3', 'R4'].map(function (r) { return asResearch(S.collections.collectionDow[r]); }), [1, 2, 3, 4]);
  eq('store deposits and vendor payments: Monday and Thursday (6.5, 4.5)', [S.stores.depositDows.map(asResearch), S.purchasing.paymentDows.map(asResearch)], [[1, 4], [1, 4]]);
  eq('weekly bill Monday, write-off Sunday, reimbursement Saturday, S3 shortage Tuesday, factory deposits Monday to Saturday',
    [asResearch(S.purchasing.weeklyBilling.dow), asResearch(S.stores.writeOff.dow), asResearch(S.expenses.claims.reimburse.dow), asResearch(S.stories.cashShort.dow), S.cash.factory.dows.map(asResearch)],
    [1, 0, 6, 2, [1, 2, 3, 4, 5, 6]]);
  eq('claim rows on a weekday: the Saturday tea', S.expenses.claims.rows.filter(function (c) { return c.dow !== null; }).map(function (c) { return c.name + ' ' + asResearch(c.dow); }), ['Staff tea, milk and snacks 6']);
  eq('corporate payment weekdays, C01 to C10 (6.4)', CORPS.map(function (c) { return asResearch(S.collections.corporate[c.id].payDow); }), [1, 2, 3, 4, 5, 1, 2, 3, 4, 5]);
  eq('events on one weekday only: E15 on Mondays', S.demand.events.filter(function (e) { return e.onlyDow !== null; }).map(function (e) { return e.code + ' ' + asResearch(e.onlyDow); }), ['E15 1']);
  eq('long-life rhythms (3.5): Mon Wed Fri, Tue Thu Sat, Mon Thu, Tue Fri, Wed Sat, Mon Wed Fri', S.production.runItems.map(function (id) { return RECIPE[id].rhythm.map(asResearch); }),
    [[1, 3, 5], [2, 4, 6], [1, 4], [2, 5], [3, 6], [1, 3, 5]]);
  /* and through the functions, on dates: Monday 5, Tuesday 6, Saturday 10, Sunday 11 January 2026 */
  eq('S3 is short on a Tuesday, the stores deposit on a Monday, a Mon-Sat vendor does not deliver on a Sunday',
    [S.stories.cashShort.on('2026-01-06'), S.stories.cashShort.on('2026-01-05'), S.stores.isDepositDay('2026-01-05'), S.stores.isDepositDay('2026-01-06'), S.purchasing.isReceivingDay('VM01', '2026-01-11'), S.purchasing.isReceivingDay('VM01', '2026-01-10')],
    [true, false, true, false, false, true]);
  eq('E15 applies on the Mondays inside Shravan and on no other day', ALL_DAYS.filter(function (d) { return S.demand.eventsOn(d).some(function (e) { return e.code === 'E15'; }) && researchDow(d) !== 1; }), []);
  /*
   * 7.4: on a closed day nothing is received, paid, collected, deposited or reimbursed; each step moves to the next open day.
   * Every rule of the config that names a weekday has its function here, so that the move is the config's and not the seed's:
   * none answers yes on a closed day, and each answers once for every one of its weekdays in the two years (nothing is lost in a break).
   */
  var DAY_RULES = [
    ['store deposits', S.stores.isDepositDay, S.stores.depositDows],
    ['the store write-off request', S.stores.isWriteOffDay, [S.stores.writeOff.dow]],
    ['vendor payments', S.purchasing.isPaymentDay, S.purchasing.paymentDows],
    ['the weekly vendor bill', S.purchasing.weeklyBilling.isBillDay, [S.purchasing.weeklyBilling.dow]],
    ['claim reimbursement', S.expenses.claims.isReimburseDay, [S.expenses.claims.reimburse.dow]],
    ['the collection round of R1', function (d) { return S.collections.outletPaysOn('O11', d); }, [S.collections.collectionDow.R1]],
    ['the payment of C01', function (d) { return S.collections.corporatePaysOn('C01', d); }, [S.collections.corporate.C01.payDow]]
  ];
  DAY_RULES.forEach(function (r) {
    ok(r[0] + ': never on a closed day', S.calendar.closedDays.every(function (d) { return !r[1](d); }));
    /* two weekdays of one rule may move onto the same open day (Monday 9 and Thursday 12 November 2026), so count the days due, not the days done */
    var due = ALL_DAYS.filter(function (d) { return r[2].indexOf(D.dow(d)) !== -1; }), done = ALL_DAYS.filter(r[1]);
    ok(r[0] + ': every weekday due has its day, the next open one', due.every(function (d) { return done.indexOf(S.calendar.nextOpen(d)) !== -1; }) &&
      done.every(function (d) { return due.some(function (x) { return S.calendar.nextOpen(x) === d; }); }), done.length + ' days for ' + due.length + ' due');
  });
  ok('receipts and factory deposits: never on a closed day', S.calendar.closedDays.every(function (d) {
    return !S.purchasing.isReceivingDay('VM01', d) && !S.purchasing.isReceivingDay('VM09', d) && !S.cash.isFactoryDepositDay(d);
  }));
});

section('Dated events fall inside 2026-2027; every price series reaches December 2027 (RESEARCH 4.2 - 4.4, 7.4 - 7.8, 9.3)', function () {
  function inside(d) { return D.isIso(d) && d >= '2026-01-01' && d <= '2027-12-31'; }
  function periodOk(p) { return inside(p[0]) && inside(p[1]) && p[0] <= p[1]; }
  eq('events', S.demand.events.map(function (e) { return e.code; }), D.range('2026-01-01', '2026-02-01').map(function (d, i) { return 'E' + (i < 9 ? '0' : '') + (i + 1); }));
  S.demand.events.forEach(function (e) {
    ok(e.code + ' ' + e.name + ': every period lies inside 2026-2027', e.periods.length > 0 && e.periods.every(periodOk), JSON.stringify(e.periods));
    ok(e.code + ': dated in both years', e.periods.some(function (p) { return p[0] < '2027-01-01'; }) && e.periods.some(function (p) { return p[0] >= '2027-01-01'; }));
    ok(e.code + ': a factor for every group and class, none negative', S.demand.retailGroups.every(function (g) { return e.retail[g] >= 0; }) &&
      S.demand.storeGroups.every(function (g) { return e.store[g] >= 0; }) && S.demand.classes.every(function (c) { return e.corporate[c] >= 0; }));
    keys(e.on || {}).forEach(function (d) { ok(e.code + ': the dated exception ' + d + ' lies in one of its periods', e.periods.some(function (p) { return d >= p[0] && d <= p[1]; })); });
  });
  /* the table of 7.4: code, dates 2026, dates 2027, then R-BR R-BN R-DRY, S-BR S-BN S-DRY S-PF, IC HM HK CT HT SC CF */
  var T74 = [
    ['E01', '2026-01-13', '2027-01-13', 1.10, 1.15, 1.05, 1.15, 1.20, 1.10, 1.10, 1.00, 1.00, 1.00, 1.20, 1.10, 1.00, 1.00],
    ['E02', '2026-01-14', '2027-01-14', 0.90, 1.00, 0.85, 1.10, 1.20, 0.90, 1.20, 0.00, 0.70, 1.00, 1.20, 1.20, 0.00, 0.60],
    ['E03', '2026-01-15', '2027-01-15', 0.80, 0.85, 0.80, 0.90, 1.00, 0.90, 1.00, 0.50, 0.70, 1.00, 1.00, 1.10, 0.00, 0.70],
    ['E04', '2026-01-26 2026-08-15', '2027-01-26 2027-08-15', 1.00, 1.00, 1.00, 1.05, 1.10, 1.05, 1.15, 0.00, 1.00, 1.00, 1.00, 1.10, 0.00, 1.10],
    ['E05', '2026-02-15', '2027-03-06', 0.85, 0.85, 0.95, 0.85, 0.85, 0.95, 0.75, 1.00, 0.85, 1.00, 1.00, 1.00, 0.00, 0.85],
    ['E06', '2026-03-03', '2027-03-21', 1.00, 1.00, 1.00, 1.05, 1.05, 1.05, 1.05, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00],
    ['E07', '2026-03-04', '2027-03-22', 0.60, 0.60, 0.60, 0.70, 0.70, 0.70, 0.70, 0.00, 0.70, 1.00, 1.00, 1.10, 0.00, 0.50],
    ['E08', '2026-02-19..2026-03-20', '2027-02-09..2027-03-09', 1.04, 1.03, 1.06, 1.02, 1.02, 1.03, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00],
    ['E09', '2026-03-21', '2027-03-10', 0.97, 1.00, 0.97, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.20, 1.00, 0.00, 1.00],
    ['E10', '2026-03-26', '2027-04-15', 0.95, 0.95, 1.00, 0.93, 0.95, 1.00, 0.90, 1.00, 0.90, 1.00, 1.00, 1.00, 0.00, 1.00],
    ['E11', '2026-03-31', '2027-04-19', 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 0.00, 1.00],
    ['E12', '2026-05-28', '2027-05-17', 1.05, 1.05, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.20, 1.00, 0.00, 1.00],
    ['E13', '2026-07-16', '2027-07-05', 1.00, 1.00, 1.00, 1.03, 1.03, 1.05, 1.05, 1.00, 1.00, 1.00, 1.00, 1.00, 0.00, 1.00],
    ['E14', '2026-08-13..2026-09-11', '2027-08-03..2027-08-31', 0.96, 0.96, 1.00, 0.95, 0.95, 1.00, 0.90, 1.00, 0.95, 1.00, 1.00, 1.00, 1.00, 0.95],
    ['E15', 'Mondays in 2026-08-13..2026-09-11', 'Mondays in 2027-08-03..2027-08-31', 0.95, 0.97, 1.00, 0.93, 0.95, 1.00, 0.90, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00],
    ['E16', '2026-08-28', '2027-08-17', 1.00, 1.00, 1.08, 1.05, 1.05, 1.20, 1.10, 0.00, 0.80, 1.00, 1.00, 1.15, 0.00, 0.85],
    ['E17', '2026-09-03', '2027-08-24', 1.08, 1.05, 1.12, 1.10, 1.05, 1.15, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00],
    ['E18', '2026-09-04', '2027-08-25', 0.85, 0.85, 0.95, 0.80, 0.85, 1.00, 0.70, 0.00, 0.70, 1.00, 1.00, 1.10, 0.00, 0.70],
    ['E19', '2026-09-08..2026-09-15', '2027-08-28..2027-09-04', 0.98, 0.98, 0.98, 0.97, 0.97, 0.97, 0.93, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00],
    ['E20', '2026-09-15', '2027-09-04', 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 0.00, 1.00],
    ['E21', '2026-09-14', '2027-09-04', 1.02, 1.02, 1.00, 1.03, 1.05, 1.05, 1.10, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00],
    ['E22', '2026-09-15..2026-09-25', '2027-09-05..2027-09-14', 1.02, 1.02, 1.00, 1.00, 1.03, 1.00, 1.05, 1.00, 1.00, 1.00, 1.05, 1.00, 1.00, 1.00],
    ['E23', '2026-10-11..2026-10-19', '2027-09-30..2027-10-08', 1.05, 1.12, 1.00, 1.03, 1.15, 1.00, 1.20, 1.00, 1.00, 1.00, 1.20, 1.10, 1.00, 1.25],
    ['E24', '2026-10-20', '2027-10-09', 0.90, 0.95, 0.90, 0.90, 0.95, 0.95, 0.85, 0.00, 0.85, 1.00, 1.00, 1.10, 0.00, 0.90],
    ['E25', '2026-11-01..2026-11-07', '2027-10-22..2027-10-28', 1.00, 1.00, 1.25, 1.00, 1.00, 1.40, 1.05, 1.00, 1.00, 1.00, 1.10, 1.10, 1.00, 1.00],
    ['E26', '2026-11-08', '2027-10-29', 0.80, 0.80, 1.10, 0.85, 0.85, 1.30, 0.80, 0.00, 1.00, '2.50 / 2.00', 1.00, '2.50 / 2.00', 1.00, 0.70],
    ['E27', '2026-11-09..2026-11-11', '2027-10-30..2027-10-31', 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00],
    ['E28', '2026-11-12..2026-11-13', '2027-11-01..2027-11-02', 0.60, 0.60, 0.60, 0.70, 0.70, 0.80, 0.70, 0.00, 1.00, 1.00, 0.80, 1.15, 1.00, 0.50],
    ['E29', '2026-11-14', '2027-11-03', 0.85, 0.85, 0.85, 0.90, 0.90, 0.90, 0.90, 0.60, 1.00, 1.00, 1.00, 1.00, 1.00, 0.80],
    ['E30', '2026-11-15..2026-11-20', '2027-11-04..2027-11-09', 0.93, 0.93, 0.93, 0.96, 0.96, 0.96, 0.96, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00],
    ['E31', '2026-12-24 2026-12-25', '2027-12-24 2027-12-25', 1.00, 1.05, 1.08, 1.05, 1.15, 1.15, 1.15, 1.00, 1.00, 1.00, 1.20, 1.20, '1.00 / 0.00', 1.20],
    ['E32', '2026-12-31', '2027-12-31', 1.05, 1.10, 1.00, 1.10, 1.25, 1.05, 1.25, 1.00, 1.00, 1.00, 1.20, 1.30, 1.00, 1.30]
  ];
  function datesOf(e, year) {
    var t = e.periods.filter(function (p) { return p[0].slice(0, 4) === year; }).map(function (p) { return p[0] === p[1] ? p[0] : p[0] + '..' + p[1]; }).join(' ');
    if (e.code === 'E31') t = t.replace('..', ' ');   /* the table lists its two days */
    return (e.onlyDow === 0 ? 'Mondays in ' : '') + t;
  }
  T74.forEach(function (t, i) {
    var e = S.demand.events[i];
    eq(t[0] + ' dates', [e.code, datesOf(e, '2026'), datesOf(e, '2027')], t.slice(0, 3));
    var got = [e.retail.BR, e.retail.BN, e.retail.DRY, e.store.BR, e.store.BN, e.store.DRY, e.store.PF, e.corporate.IC, e.corporate.HM, e.corporate.HK, e.corporate.CT, e.corporate.HT, e.corporate.SC, e.corporate.CF];
    eq(t[0] + ' factors', got.filter(function (g, k) { return typeof t[3 + k] === 'number'; }), t.slice(3).filter(function (w) { return typeof w === 'number'; }));
  });
  /* the three cells with two figures: 2.50 in 2026 and 2.00 in 2027; 1.00 on 24 December and 0.00 on 25 December */
  eq('E26 hospital kitchen and hotel, 2026 and 2027', ['2026-11-08', '2027-10-29'].map(function (d) { var c = S.demand.eventsOn(d)[0].corporate; return [c.HK, c.HT]; }), [[2.5, 2.5], [2, 2]]);
  eq('E31 school canteen on 24 and 25 December of both years', ['2026-12-24', '2026-12-25', '2027-12-24', '2027-12-25'].map(function (d) { return S.demand.eventsOn(d)[0].corporate.SC; }), [1, 0, 1, 0]);

  /* a few rows of 7.4 read back through the functions the seed will call */
  var f = S.demand.eventFactors('2026-01-14');
  eq('Uttarayan 2026: codes, retail, stores, corporates', [f.codes, f.retail, f.store, f.corporate],
    [['E02'], { BR: 0.90, BN: 1.00, DRY: 0.85 }, { BR: 1.10, BN: 1.20, DRY: 0.90, PF: 1.20 }, { IC: 0, HM: 0.70, HK: 1, CT: 1.20, HT: 1.20, SC: 0, CF: 0.60 }]);
  eq('events of a Shravan Monday, 17 August 2026', S.demand.eventFactors('2026-08-17').codes, ['E14', 'E15']);
  near('Shravan Monday multiplies on top of Shravan: store puffs', S.demand.eventFactors('2026-08-17').store.PF, 0.90 * 0.90, 1e-9);
  eq('events of a Shravan Tuesday', S.demand.eventFactors('2026-08-18').codes, ['E14']);
  eq('15 September 2026: Paryushan, Samvatsari and Ganeshotsav together', S.demand.eventFactors('2026-09-15').codes, ['E19', 'E20', 'E22']);
  eq('4 September 2027: Paryushan, Samvatsari and Ganesh Chaturthi together', S.demand.eventFactors('2027-09-04').codes, ['E19', 'E20', 'E21']);
  eq('an ordinary day has no event', S.demand.eventFactors('2026-06-18'), { codes: [], retail: { BR: 1, BN: 1, DRY: 1 }, store: { BR: 1, BN: 1, DRY: 1, PF: 1 }, corporate: { IC: 1, HM: 1, HK: 1, CT: 1, HT: 1, SC: 1, CF: 1 } });
  /* 2026, counted from the table of 7.4: 3 (Uttarayan) + 1 (26 January) + 1 (15 February) + 30 (Ramadan, with Holi and Dhuleti inside) + 3 + 1 + 1 +
     30 (Shravan, with 15 August and three festivals inside) + 4 + 10 (Paryushan and Ganeshotsav beyond it) + 9 + 1 + 7 + 1 + 3 + 2 + 1 + 6 + 2 + 1 */
  eq('event days in 2026', D.range('2026-01-01', '2026-12-31').filter(function (d) { return S.demand.eventFactors(d).codes.length > 0; }).length, 117);

  eq('closed days', S.calendar.closedDays, ['2026-11-09', '2026-11-10', '2026-11-11', '2027-10-30', '2027-10-31']);
  eq('factory holidays', S.calendar.factoryHolidays, ['2026-11-08', '2026-11-09', '2026-11-10', '2027-10-29', '2027-10-30']);
  ok('a factory holiday is every day whose next morning has no dispatch', D.range('2026-01-01', '2027-12-30').every(function (d) { return S.calendar.isFactoryHoliday(d) === S.calendar.isClosed(D.addDays(d, 1)); }));
  ok('the closed days are the days of event E27', D.range('2026-01-01', '2027-12-31').every(function (d) { return S.calendar.isClosed(d) === (S.demand.eventFactors(d).codes.indexOf('E27') !== -1); }));
  eq('first dispatch after each break', [S.calendar.nextOpen('2026-11-09'), S.calendar.nextOpen('2027-10-30')], S.calendar.firstDispatchAfterBreak);
  eq('last open day before a break and before an open day', [S.calendar.prevOpen('2026-11-12'), S.calendar.prevOpen('2026-03-10')], ['2026-11-08', '2026-03-09']);
  ok('nothing is sold on a closed day', S.calendar.closedDays.every(function (d) {
    return S.demand.retailFactor('O01', 'FG01', d, 'dry') === 0 && S.demand.storeFactor('st_anand', 'FG16', d, 'dry') === 0;
  }));
  keys(S.calendar.periods).forEach(function (k) { ok('calendar ' + k + ': every period lies inside 2026-2027 and they do not overlap', S.calendar.periods[k].every(function (p, i, all) { return periodOk(p) && (i === 0 || all[i - 1][1] < p[0]); })); });
  eq('periods per calendar', keys(S.calendar.periods).map(function (k) { return k + ' ' + S.calendar.periods[k].length; }), ['collegeVacation 4', 'collegeExams 6', 'schoolVacation 4', 'boardExams 2', 'weddings 7', 'chaturmas 2']);
  eq('NRI season and summer at their edges', [['2026-12-14', '2026-12-15', '2027-01-31', '2027-02-01'].map(S.calendar.inNriSeason), ['2026-04-05', '2026-04-06', '2027-06-10', '2027-06-11'].map(S.calendar.inSummer)],
    [[false, true, true, false], [false, true, true, false]]);
  ok('rain seasons lie inside 2026-2027', S.rain.seasons.every(periodOk));
  ok('heavy-rain days lie inside a wet season', S.rain.heavyDays.concat(keys(S.rain.heavyOnRoutes)).every(function (d) { return S.rain.seasons.some(function (p) { return d >= p[0] && d <= p[1]; }); }));
  eq('heavy-rain days by year', ['2026', '2027'].map(function (y) { return S.rain.heavyDays.filter(function (d) { return d.slice(0, 4) === y; }).length; }), [6, 7]);
  eq('14 September 2026: heavy on R4, wet elsewhere and at the stores, whatever the draw', [S.rain.kind('2026-09-14', 0.99, 'R4'), S.rain.kind('2026-09-14', 0.99, 'R1'), S.rain.kind('2026-09-14', 0.99)], ['heavy', 'wet', 'wet']);
  eq('a July day: wet under 0.45; dry outside the season', [S.rain.kind('2026-07-10', 0.44, 'R1'), S.rain.kind('2026-07-10', 0.45, 'R1'), S.rain.kind('2026-06-27', 0, 'R1'), S.rain.kind('2026-09-25', 0, 'R1'), S.rain.kind('2026-07-09', 0.9, 'R2')], ['wet', 'dry', 'dry', 'dry', 'heavy']);
  eq('wet chance by month', [S.rain.wetChance('2026-06-29'), S.rain.wetChance('2026-07-15'), S.rain.wetChance('2026-08-15'), S.rain.wetChance('2026-09-15'), S.rain.wetChance('2026-07-09')], [0.45, 0.45, 0.40, 0.33, 0]);

  /* demand factors of 7.2, 7.3, 7.7 and 7.8, read back on ordinary days (January month factor 1.03; days 8-23) */
  near('provision store on a Saturday', S.demand.retailFactor('O01', 'FG01', '2026-01-17', 'dry'), 1.05 * 1.03, 1e-9);
  near('tea stall on a Sunday', S.demand.retailFactor('O08', 'FG04', '2026-01-18', 'dry'), 0.60 * 1.03, 1e-9);
  near('bakery counter on a Sunday in the first week of the month', S.demand.retailFactor('O11', 'FG01', '2026-02-01', 'dry'), 1.15 * 1.02 * 1.03, 1e-9);
  near('campus outlet in the college vacation, in summer, at the month end', S.demand.retailFactor('O14', 'FG10', '2026-05-26', 'dry'), 0.92 * 0.97 * 0.85 * 0.98, 1e-9);
  near('S1 on a Sunday in the first week', S.demand.storeFactor('st_anand', 'FG16', '2026-03-01', 'dry'), 1.20 * 1.00 * 1.08 * 1.00, 1e-9);
  near('S2 on a Sunday in the examination weeks, summer, puffs', S.demand.storeFactor('st_vvn', 'FG16', '2026-04-12', 'dry'), 0.85 * 0.96 * 1.00 * 0.95 * 0.95, 1e-9);
  near('S3 puffs on a wet day in July', S.demand.storeFactor('st_nadiad', 'FG17', '2026-07-14', 'wet'), 1.03 * 1.08, 1e-9);
  near('retail bread on a heavy-rain day', S.demand.retailFactor('O02', 'FG01', '2026-07-09', 'heavy'), 1.03 * 0.82, 1e-9);
  near('the cafe on a heavy-rain day on which it orders', S.demand.corporateFactor('C10', '2026-08-01'), 0.80, 1e-9);
  near('a caterer on the same day, in the Chaturmas gap', S.demand.corporateFactor('C06', '2026-08-01'), 0.70 * 0.90, 1e-9);
  eq('the cafe does not order on 9 July 2026, an odd day from go-live', S.demand.corporateFactor('C10', '2026-07-09'), 0);
  eq('month factors', S.demand.month, [1.03, 1.02, 1.00, 0.96, 0.92, 0.97, 1.03, 1.04, 1.02, 1.00, 0.98, 1.04]);
  eq('month-part: days 1-7, 8-23, 24 to the end', [S.demand.monthPartOf('2026-03-07'), S.demand.monthPartOf('2026-03-08'), S.demand.monthPartOf('2026-03-23'), S.demand.monthPartOf('2026-03-24'), S.demand.monthPart], [0, 1, 1, 2, { retail: [1.03, 1, 0.97], store: [1.08, 1, 0.93], corporate: [1, 1, 1] }]);
  eq('noise ranges', S.demand.noise, { retail: [0.90, 1.10], store: [0.90, 1.10], corporate: [0.95, 1.05] });
  /* the largest factor a store can meet stays under the 1.6 days of ladi pav it stands at (12.8) */
  var top = 0;
  D.range('2026-01-01', '2027-12-31').forEach(function (d) { STORES.forEach(function (s) { top = Math.max(top, S.demand.storeFactor(s, 'FG04', d, 'dry') * 1.10); }); });
  ok('the largest ladi pav demand factor at a store, with noise, is under 1.6', top < 1.6, round2(top));
  near('and is the 1.48 the story names', top, S.stories.nearExpiry.largestDemandFactor, 0.02);

  /* purchase prices */
  eq('price months', [S.prices.months.length, S.prices.months[0], S.prices.months[23], S.prices.from, S.prices.to], [24, '2026-01', '2027-12', '2026-01', '2027-12']);
  var bad = [], off = [];
  keys(S.prices.table).forEach(function (id) {
    var row = S.prices.table[id];
    if (row.length !== 24 || !row.every(function (p) { return p > 0 && p === Math.round(p); })) bad.push(id);
    S.prices.months.forEach(function (m) { if (m > '2026-10' && S.prices.byRule(id, m) !== S.prices.inMonth(id, m)) off.push(id + ' ' + m); });
  });
  /* the table of 4.2: rupees per stock unit in the twelve months of 2026 (2027 is the rule, checked below) */
  var T42 = {
    RM01: [36.00, 36.00, 35.60, 35.00, 35.60, 36.60, 37.40, 38.20, 38.80, 39.00, 39.10, 39.20],
    RM02: [33.50, 33.50, 33.10, 32.50, 33.10, 34.10, 34.90, 35.70, 36.30, 36.50, 36.60, 36.70],
    RM03: [40.20, 41.20, 41.40, 41.50, 42.70, 42.30, 46.80, 56.40, 51.90, 47.40, 45.60, 44.30],
    RM04: [150, 151, 153, 155, 158, 160, 163, 166, 170, 168, 165, 166],
    RM05: [164, 165, 167, 169, 172, 175, 178, 182, 186, 184, 181, 182],
    RM06: [455, 455, 460, 465, 472, 480, 480, 478, 476, 474, 471, 470],
    RM07: [142, 144, 146, 147, 149, 151, 154, 158, 164, 161, 157, 157],
    RM08: [118, 118, 118, 118, 118, 118, 122, 122, 122, 122, 122, 123],
    RM09: [9.00, 9.00, 9.00, 9.00, 9.00, 9.00, 9.40, 9.40, 9.40, 9.40, 9.40, 9.40],
    RM10: [265, 265, 268, 272, 276, 280, 280, 278, 275, 272, 270, 270],
    RM11: [210, 210, 210, 210, 210, 210, 216, 216, 216, 216, 217, 217],
    RM12: [150, 150, 150, 150, 150, 150, 155, 155, 155, 155, 155, 156],
    RM13: [75, 75, 75, 75, 75, 75, 75, 75, 75, 75, 75, 75],
    RM14: [2550, 2550, 2600, 2650, 2700, 2750, 2800, 2800, 2750, 2700, 2710, 2720],
    RM15: [215, 212, 205, 205, 208, 212, 216, 220, 222, 222, 223, 223],
    RM16: [155, 155, 155, 155, 155, 155, 160, 160, 160, 160, 160, 161],
    RM17: [92, 92, 92, 92, 92, 92, 94, 98, 102, 100, 100, 101],
    RM18: [520, 520, 520, 520, 520, 520, 520, 520, 520, 520, 520, 525],
    RM19: [13.00, 11.00, 10.50, 11.50, 12.50, 13.50, 14.50, 15.00, 15.50, 16.50, 17.00, 15.60],
    RM20: [20.00, 18.00, 16.00, 15.00, 16.00, 19.00, 24.00, 32.00, 44.00, 46.00, 39.10, 26.60],
    RM21: [84, 82, 80, 80, 82, 84, 86, 88, 90, 90, 90, 91],
    RM22: [330, 330, 335, 340, 348, 355, 355, 352, 350, 348, 346, 345],
    RM23: [160, 150, 135, 125, 125, 130, 138, 145, 150, 155, 157, 158],
    RM24: [360, 360, 360, 360, 360, 360, 370, 370, 370, 370, 371, 372],
    PM01: [1.00, 1.00, 1.00, 1.00, 1.05, 1.05, 1.10, 1.10, 1.10, 1.10, 1.10, 1.11],
    PM02: [1.60, 1.60, 1.60, 1.60, 1.68, 1.68, 1.76, 1.76, 1.76, 1.76, 1.76, 1.77],
    PM03: [0.55, 0.55, 0.55, 0.55, 0.58, 0.58, 0.60, 0.60, 0.60, 0.60, 0.60, 0.60],
    PM04: [2.00, 2.00, 2.00, 2.00, 2.10, 2.10, 2.18, 2.18, 2.18, 2.18, 2.19, 2.19],
    PM05: [2.70, 2.70, 2.70, 2.70, 2.84, 2.84, 2.94, 2.94, 2.94, 2.94, 2.95, 2.95],
    PM06: [6.80, 6.80, 6.80, 6.80, 6.80, 6.80, 7.10, 7.10, 7.10, 7.10, 7.10, 7.15],
    PM07: [0.18, 0.18, 0.18, 0.18, 0.18, 0.18, 0.19, 0.19, 0.19, 0.19, 0.19, 0.19],
    PM08: [0.24, 0.24, 0.24, 0.24, 0.24, 0.24, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25]
  };
  keys(T42).forEach(function (id) { eq(id + ' prices of 2026', S.prices.table[id].slice(0, 12), T42[id].map(rs)); });
  eq('series for every material and packing item', [keys(S.prices.table).length, keys(T42).length], [32, 32]);
  eq('every series holds 24 monthly prices in whole paise, to December 2027', bad, []);
  eq('the rule of 4.4 gives the table of 4.3 from November 2026 to December 2027, to the paisa', off, []);
  eq('a few prices, paise: maida Apr 2026, sugar Aug 2026, onion Oct and Nov 2026, butter Mar 2027, date label Jun 2027, maida Dec 2027',
    [S.prices.inMonth('RM01', '2026-04'), S.prices.inMonth('RM03', '2026-08'), S.prices.inMonth('RM20', '2026-10'), S.prices.inMonth('RM20', '2026-11'), S.prices.inMonth('RM06', '2027-03'), S.prices.inMonth('PM08', '2027-06'), S.prices.inMonth('RM01', '2027-12')],
    [3500, 5640, 4600, 3910, 49200, 26, 4190]);
  eq('the rate on an order is the price of the month of its date', [S.prices.on('RM01', '2026-03-31'), S.prices.on('RM01', '2026-04-01')], [3560, 3500]);
  eq('shapes average 1.00', keys(S.prices.shapes).map(function (k) { return Math.round(sum(S.prices.shapes[k]) / 12 * 100) / 100; }), [1, 1, 1, 1, 1]);
  eq('market rate: no draw gives the month\'s price; +6% on potato rounds to 10 paise; garlic to the rupee', [S.purchasing.marketRate('RM19', '2026-01-10', 0), S.purchasing.marketRate('RM19', '2026-01-10', 0.06), S.purchasing.marketRate('RM23', '2026-01-10', -0.06), S.purchasing.marketRate('RM01', '2026-01-10', 0.06)], [1300, 1380, 15000, 3600]);
  /* diesel and gas run to the end of 2027 */
  eq('diesel, paise a litre', ['2026-01-01', '2026-05-14', '2026-05-15', '2026-05-22', '2026-05-24', '2026-05-25', '2026-06-30', '2026-07-01', '2027-12-31'].map(S.expenses.diesel.priceOn), [9013, 9013, 9313, 9403, 9494, 9765, 9765, 9789, 9789]);
  eq('piped gas, paise per SCM by consumption month', ['2025-12', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2027-03', '2027-04', '2027-12'].map(S.expenses.gas.priceIn), [5200, 5200, 5600, 6000, 6600, 6600, 6400, 6300, 6300, 6200, 6200, 6300, 6300]);
  ok('every dated step of every series lies before 2028', S.expenses.diesel.series.concat(S.expenses.gas.series).every(function (s) { return s[0] < '2028'; }) && S.priceRevisions.every(function (r) { return inside(r.date); }));
});

/* ====================================================== 9. people */

section('People: salaries, raises and the salary bill (RESEARCH 8)', function () {
  /* salary from 2026-01-01, from 2026-04-01, from 2027-04-01 (rupees) */
  var T82 = {
    E001: [90000, 90000, 90000], E002: [28000, 30200, 32600], E003: [15500, 16700, 18000], E004: [24000, 25900, 28000], E005: [14000, 15100, 16300],
    E006: [32000, 34600, 37400], E007: [24000, 25900, 28000], E008: [23000, 24800, 26800], E009: [20000, 21600, 23300], E010: [17000, 18400, 19900],
    E011: [16500, 17800, 19200], E012: [14000, 15100, 16300], E013: [14000, 15100, 16300], E014: [13800, 14900, 16100], E015: [13800, 14900, 16100],
    E016: [17500, 18900, 20400], E017: [15000, 16200, 17500], E018: [13800, 14900, 16100], E019: [13800, 14900, 16100], E020: [13800, null, null],
    E021: [27000, 29200, 31500], E022: [19000, 20500, 22100], E023: [19000, 20500, 22100], E024: [18500, 20000, 21600], E025: [18500, 20000, null],
    E026: [18000, 19400, 21000], E027: [13800, 14900, 16100], E028: [13800, 14900, 16100], E029: [23000, 24800, 26800], E030: [14000, 15100, 16300],
    E031: [13800, 14900, 16100], E032: [22000, 23800, 25700], E033: [14000, 15100, 16300], E034: [19000, 20500, 22100], E035: [13800, 14900, 16100],
    E036: [13800, 13800, 14900], E037: [14500, 14500, 15700], E038: [19500, 19500, 21100]
  };
  eq('directory with the joiners', ALL_EMPLOYEES.map(function (e) { return e.id; }), keys(T82));
  ALL_EMPLOYEES.forEach(function (e) { eq(e.id + ' salary in the master (the starting salary for a joiner)', e.salary, rs(T82[e.id][0])); });
  keys(T82).forEach(function (id) {
    var t = T82[id], live = ALL_EMP[id].doj <= '2026-04-01' ? '2026-04-01' : ALL_EMP[id].doj;
    if (t[1] !== null) eq(id + ' salary from 1 April 2026', S.people.salaryOn(id, id > 'E035' ? '2026-09-01' : live), rs(t[1]));
    if (t[2] !== null) eq(id + ' salary from 1 April 2027', S.people.salaryOn(id, '2027-04-01'), rs(t[2]));
  });
  /* the raise rule gives the table: +8% to the nearest Rs 100 for everyone who joined on or before 31 December of the year before; the owner takes none */
  [['2026-04-01', '2025-12-31', 0], ['2027-04-01', '2026-12-31', 1]].forEach(function (y) {
    var raise = S.people.raises[y[2]], want = {};
    keys(T82).forEach(function (id) {
      var e = ALL_EMP[id], before = T82[id][y[2]];
      if (id === 'E001' || e.doj > y[1] || T82[id][y[2] + 1] === null) return;
      want[id] = Math.round(before * 1.08 / 100) * 100 * 100;
    });
    eq('raise of ' + y[0] + ': date and note', [raise.date, raise.note], [y[0], 'annual increment 8%']);
    eq('raise of ' + y[0] + ': who and how much, by the rule', raise.salary, want);
    eq('raise of ' + y[0] + ': the same as the table', keys(raise.salary).filter(function (id) { return raise.salary[id] !== rs(T82[id][y[2] + 1]); }), []);
  });
  eq('headcount: 1 Jan, 1 Mar, 8 Mar, 9 Mar, 14 Jun, 15 Jun, 31 Jul, 1 Aug 2026, 31 Dec 2027', ['2026-01-01', '2026-03-01', '2026-03-08', '2026-03-09', '2026-06-14', '2026-06-15', '2026-07-31', '2026-08-01', '2027-12-31'].map(S.people.headcountOn), [35, 34, 34, 35, 35, 36, 36, 36, 36]);
  eq('a leaver is active on the last working day and not after', [S.people.activeOn('E020', '2026-02-28'), S.people.activeOn('E020', '2026-03-01'), S.people.activeOn('E036', '2026-03-08'), S.people.activeOn('E036', '2026-03-09')], [true, false, false, true]);
  /* the salary bill, one line per unit: factory, st_anand, st_vvn, st_nadiad, total, active on the last day */
  var BILL = [
    ['2026-01', '2026-03', 581100, 50800, 36000, 32800, 700700, 35], ['2026-04', '2026-05', 619100, 54800, 38900, 35400, 748200, 35],
    ['2026-06', '2026-07', 619100, 54800, 53400, 35400, 762700, 36], ['2026-08', '2027-03', 618600, 54800, 53400, 35400, 762200, 36],
    ['2027-04', '2027-12', 660900, 59200, 57700, 38200, 816000, 36]
  ];
  S.prices.months.forEach(function (m) {
    var row = BILL.filter(function (b) { return m >= b[0] && m <= b[1]; })[0], last = D.monthEnd(m + '-01'), by = { factory: 0, st_anand: 0, st_vvn: 0, st_nadiad: 0 }, n = 0;
    ALL_EMPLOYEES.forEach(function (e) { var s = S.people.salaryOn(e.id, last); if (s) { by[e.unitId] += s; n++; } });
    eq('salary bill of ' + m, [by.factory, by.st_anand, by.st_vvn, by.st_nadiad, by.factory + by.st_anand + by.st_vvn + by.st_nadiad, n], row.slice(2, 7).map(rs).concat([row[7]]));
  });
  eq('salary bill of January 2026 as the engine proposes it from the masters', HB.engine.salaryLines('2026-01-31').map(function (l) { return [l.unitId, l.headcount, l.amount]; }),
    [['factory', 28, rs(581100)], ['st_anand', 3, rs(50800)], ['st_vvn', 2, rs(36000)], ['st_nadiad', 2, rs(32800)]]);
  eq('salary pay dates: the 5th of the next month, moved off a closed day', [S.people.salaryPayDate('2026-01'), S.people.salaryPayDate('2026-12'), S.people.salaryPayDate('2027-10')], ['2026-02-05', '2027-01-05', '2027-11-05']);
  ok('every salary stays above the minimum wage of the day', keys(T82).every(function (id) { return T82[id][0] >= 13013 && (T82[id][1] === null || T82[id][1] >= 13325) && (T82[id][2] === null || T82[id][2] >= 13793); }));
  eq('typical month of salaries at October 2026 rates (9.1)', sum(ALL_EMPLOYEES, function (e) { return S.people.salaryOn(e.id, '2026-10-31'); }), rs(762200));
});

/* ====================================================== 10. purchasing, collections, overheads, stories */

section('Purchasing, payments and collections (RESEARCH 4.5, 5.1, 6.2, 6.4)', function () {
  eq('receiving: Saturday, Sunday, Sunday for the vegetable vendor, a closed day', [S.purchasing.isReceivingDay('VM01', '2026-01-03'), S.purchasing.isReceivingDay('VM01', '2026-01-04'), S.purchasing.isReceivingDay('VM09', '2026-01-04'), S.purchasing.isReceivingDay('VM09', '2026-11-10')], [true, false, true, false]);
  eq('a receipt due on a Sunday or in the break moves to the next receiving day', [S.purchasing.nextReceivingDay('VM01', '2026-01-04'), S.purchasing.nextReceivingDay('VM11', '2026-01-04'), S.purchasing.nextReceivingDay('VM01', '2026-11-08'), S.purchasing.nextReceivingDay('VM01', '2027-10-30')], ['2026-01-05', '2026-01-04', '2026-11-12', '2027-11-01']);
  eq('payment days in the first fortnight of 2026', D.range('2026-01-01', '2026-01-14').filter(S.purchasing.isPaymentDay), ['2026-01-01', '2026-01-05', '2026-01-08', '2026-01-12']);
  eq('payment days around the Diwali break of 2026', D.range('2026-11-05', '2026-11-16').filter(S.purchasing.isPaymentDay), ['2026-11-05', '2026-11-12', '2026-11-16']);
  eq('pay dates: on time, 12 days late, in cash on the due date', [S.purchasing.payDate('VM01', '2026-03-10'), S.purchasing.payDate('VM08', '2026-03-10'), S.purchasing.payDate('VM13', '2026-03-10'), S.purchasing.payDate('VM09', '2026-03-10'), S.purchasing.payDate('VM11', '2026-11-10')], ['2026-03-12', '2026-03-23', '2026-03-23', '2026-03-10', '2026-11-12']);
  eq('late vendors and cash vendors', [S.purchasing.lateDays, S.purchasing.cashVendors], [{ VM08: 12, VM13: 12 }, { VM09: 'cash_factory', VM11: 'cash_factory' }]);
  eq('seeded receipt exceptions', [S.purchasing.exceptions.VM12.chance, S.purchasing.exceptions.VM12.firstShare, S.purchasing.exceptions.VM12.restAfterDays, S.purchasing.exceptions.VM01.chance, S.purchasing.exceptions.VM01.rejectedQty, S.purchasing.exceptions.VM09.chance, S.purchasing.exceptions.VM09.rejectedKg], [0.25, 0.60, 4, 0.04, 50, 0.125, [2, 4]]);
  /* 4.5 rule 4: "seeded exceptions, each drawn on the order" - the stream key, and the receipt that makes a rejection good is not drawn again */
  eq('each seeded exception is drawn on the order', keys(S.purchasing.exceptions).sort().map(function (v) { return v + ' ' + S.purchasing.exceptions[v].drawnOn; }), ['VM01 order', 'VM09 order', 'VM12 order']);
  eq('when a rejection is made good: flour two days later, potato the next morning', [S.purchasing.exceptions.VM01.secondReceiptAfterDays, S.purchasing.exceptions.VM09.madeGood, S.purchasing.exceptions.VM09.itemId], [2, 'next morning', 'RM19']);
  /* 5.1, the "Order days" column, which its note makes the receiving days: Mon-Sat, every day for VM09 and VM11 */
  var stockVendors = C.vendors.filter(function (v) { return v.kind === 'stock'; });
  eq('receiving days a week by vendor (5.1)', stockVendors.map(function (v) { return (S.purchasing.receivingDows[v.id] || []).length; }), [6, 6, 6, 6, 6, 6, 6, 6, 7, 6, 7, 6, 6]);
  ok('a vendor receives on its days of 5.1 and never on a closed day, on every day of the two years', stockVendors.every(function (v) {
    var everyDay = v.id === 'VM09' || v.id === 'VM11';
    return ALL_DAYS.every(function (d) { return S.purchasing.isReceivingDay(v.id, d) === (!S.calendar.isClosed(d) && (everyDay || researchDow(d) !== 0)); });
  }));
  /* 4.5 rules 1 and 2: the order is dated the day of the check, whatever day that is (CONFIG choice 23) */
  eq('an order is dated the day of the check: a weekday, a Sunday, a closed day with production', ['2026-01-02', '2026-01-04', '2026-11-11'].map(S.purchasing.orderDate), ['2026-01-02', '2026-01-04', '2026-11-11']);
  eq('lead days and a Sunday: a flour order of Friday is received on Monday, one of Sunday on Tuesday', [S.purchasing.nextReceivingDay('VM01', D.addDays('2026-01-02', ITEM.RM01.leadDays)), S.purchasing.nextReceivingDay('VM01', D.addDays('2026-01-04', ITEM.RM01.leadDays))], ['2026-01-05', '2026-01-06']);
  /* 4.5 rule 5: the bill is dated the day after the receipt, the next open day if closed; VM09 and VM11 bill each Monday */
  eq('bill dates: a weekday, the eve of the break of 2026, the eve of the break of 2027', ['2026-01-05', '2026-11-08', '2027-10-29'].map(S.purchasing.billDate), ['2026-01-06', '2026-11-12', '2027-11-01']);
  ok('no bill is dated on a closed day', ALL_DAYS.every(function (d) { return !S.calendar.isClosed(S.purchasing.billDate(d)); }));
  var weekly = ALL_DAYS.filter(S.purchasing.weeklyBilling.isBillDay);
  eq('weekly bills: one for every Monday of the two years', weekly.length, ALL_DAYS.filter(function (d) { return researchDow(d) === 1; }).length);
  eq('each on its Monday, except the one of the closed Monday 9 November 2026', weekly.filter(function (d) { return researchDow(d) !== 1; }), ['2026-11-12']);
  eq('what a weekly bill covers: the Monday to Sunday before', [S.purchasing.weeklyBilling.periodOf('2026-01-05'), S.purchasing.weeklyBilling.periodOf('2026-11-12'), S.purchasing.weeklyBilling.periodOf('2026-11-16')],
    [['2025-12-29', '2026-01-04'], ['2026-11-02', '2026-11-08'], ['2026-11-09', '2026-11-15']]);
  /* 4.5 rule 6 and 12.5: the weekly bill is paid in cash on its due date, the morning the Owner releases the held VM09 bill */
  var release = S.stories.heldBill.weekly.releaseDate;
  ok('the held VM09 bill is released on its due date, the day it is paid, and never on a closed day', weekly.every(function (d) {
    return release(d) === S.purchasing.payDate('VM09', D.addDays(d, VEND.VM09.termsDays)) && !S.calendar.isClosed(release(d));
  }));
  function followingMonday(d) { do { d = D.addDays(d, 1); } while (researchDow(d) !== 1); return S.calendar.nextOpen(d); }
  eq('that is the following Monday (the next open day if closed) for every bill but the one dated Thursday 12 November 2026', weekly.filter(function (d) { return release(d) !== followingMonday(d); }).map(function (d) { return d + ' ' + release(d) + ' ' + followingMonday(d); }),
    ['2026-11-12 2026-11-19 2026-11-16']);
  eq('releases around the two breaks', ['2026-11-02', '2026-11-12', '2026-11-16', '2027-10-25'].map(release), ['2026-11-12', '2026-11-19', '2026-11-23', '2027-11-01']);
  /* band 43: after 5 January 2026 a VM09 bill is on hold at the end of every open day (entered that day or earlier, not yet released) */
  ok('a VM09 bill is on hold on every open day after 5 January 2026', ALL_DAYS.every(function (d) {
    return d <= '2026-01-05' || S.calendar.isClosed(d) || weekly.some(function (b) { return b <= d && release(b) > d; });
  }));
  /* collections */
  eq('collection week numbers', ['2026-01-01', '2026-01-04', '2026-01-05', '2026-01-11', '2026-01-12'].map(S.collections.weekOf), [0, 0, 1, 1, 2]);
  function paid(id, from, to) { return D.range(from, to).filter(function (d) { return S.collections.outletPaysOn(id, d); }); }
  eq('a prompt weekly outlet of R1 pays every Monday', paid('O11', '2026-01-01', '2026-01-31'), ['2026-01-05', '2026-01-12', '2026-01-19', '2026-01-26']);
  eq('a cash outlet has no collection day', paid('O06', '2026-01-01', '2026-01-31'), []);
  eq('O04 pays on Mondays of odd weeks', paid('O04', '2026-01-01', '2026-02-15'), ['2026-01-05', '2026-01-19', '2026-02-02']);
  eq('O38 pays on Thursdays of odd weeks', paid('O38', '2026-01-01', '2026-02-15'), ['2026-01-08', '2026-01-22', '2026-02-05']);
  eq('O19 pays on Tuesdays of weeks 1, 4, 7', paid('O19', '2026-01-01', '2026-02-28'), ['2026-01-06', '2026-01-27', '2026-02-17']);
  eq('O28 pays on the first Wednesday of the month', paid('O28', '2026-01-01', '2026-03-31'), ['2026-01-07', '2026-02-04', '2026-03-04']);
  eq('a collection that falls in the break moves to the next open day', paid('O11', '2026-11-05', '2026-11-20').concat(paid('O14', '2026-11-05', '2026-11-20')), ['2026-11-12', '2026-11-16', '2026-11-12', '2026-11-17']);
  /* the oldest invoice a slow outlet holds when it pays (6.2): 14 days, 14 days, 21 days, about 35 */
  function longestGap(id) {
    var days = paid(id, '2026-02-01', '2026-10-31'), g = 0, i;
    for (i = 1; i < days.length; i++) g = Math.max(g, D.diffDays(days[i - 1], days[i]));
    return g;
  }
  eq('longest wait between two payments: O38, O04, O19, O28, a prompt outlet', [longestGap('O38'), longestGap('O04'), longestGap('O19'), longestGap('O28'), longestGap('O25')], [14, 14, 21, 35, 7]);
  eq('C06 pays an invoice 15 + 20 days after delivery, on its Monday', [S.collections.corporatePayDate('C06', D.addDays('2026-03-03', 15)), S.collections.corporatePaysOn('C06', '2026-04-13'), S.collections.corporatePaysOn('C06', '2026-04-14')], ['2026-04-13', true, false]);
  /* 12.4: delivered on a Tuesday, Thursday or Saturday, due at 15 days, paid on the first Monday 20 days after that: open 37 to 41 days, 22 to 26 of them overdue */
  var open = D.range('2026-02-01', '2026-06-30').filter(function (d) { return S.corporates.orderDay('C06', d); }).map(function (d) { return D.diffDays(d, S.collections.corporatePayDate('C06', D.addDays(d, 15))); });
  eq('C06 invoices: fewest and most days open', [Math.min.apply(null, open), Math.max.apply(null, open)], [37, 41]);
});

section('Overheads and claims (RESEARCH 9)', function () {
  var E = S.expenses;
  /* the worked checks of 9.4 */
  eq('factory units for December 2025', E.electricity.factoryUnits('2025-12', 1), 8937);
  near('factory electricity bill of 6 January 2026, before noise', E.electricity.factory('2025-12', 1), rs(74696), 50);
  near('a 30-day month at factor 1.00 and the later surcharge', E.electricity.factory('2026-09', 1), rs(78228), 50);
  near('store S1 at factor 1.00', E.electricity.store('st_anand', '2026-10'), rs(5411), 50);
  near('store S2 at factor 1.00', E.electricity.store('st_vvn', '2026-10'), rs(4587), 50);
  near('store S3 at factor 1.00', E.electricity.store('st_nadiad', '2026-10'), rs(3598), 50);
  eq('S2 uses less in May and November', [E.electricity.storeUnits('st_vvn', '2026-04'), E.electricity.storeUnits('st_vvn', '2026-05'), E.electricity.storeUnits('st_vvn', '2026-11')], [624, Math.round(520 * 1.30 * 0.85), Math.round(520 * 0.85 * 0.85)]);
  eq('fuel surcharge by consumption month', ['2025-12', '2026-03', '2026-04', '2027-12'].map(E.electricity.surcharge), [2.45, 2.45, 2.52, 2.52]);
  eq('gas for December 2025: SCM and the bill of 3 January 2026', [E.gas.scm('2025-12', 1), E.gas.amount('2025-12', 1)], [1953, rs(101556)]);
  near('diesel for a 30-day month at the last price', E.diesel.amount('2026-09-01', '2026-09-30'), rs(55797), 50);
  near('the diesel bill of 1 January 2026 covers 16-31 December 2025', E.billsOn('2026-01-01').filter(function (b) { return b.rule.n === 11; })[0].amount, 16 * 19 * 9013, 0.5);
  near('no diesel on a closed day', E.diesel.amount('2026-11-01', '2026-11-15'), 12 * 19 * 9789, 0.5);
  near('bank charges on Rs 14 lakh of deposits', E.bankCharges(rs(1400000)), rs(1500 + 2100), 0.5);
  eq('rounding to the rupee', E.toRupee(7469876), 7469900);

  eq('bill rows of 9.4 covered', keys(E.bills.reduce(function (o, b) { o[b.n] = 1; return o; }, {})).length, 44);
  /* every bill of a year, by its rule; the seeded-day rules are counted in the month they belong to */
  function yearOf(y, env) {
    var out = [];
    D.range(y + '-01-01', y + '-12-31').forEach(function (d) { E.billsOn(d, env).forEach(function (b) { out.push({ date: d, rule: b.rule, amount: b.amount }); }); });
    return out;
  }
  var y26 = yearOf('2026'), y27 = yearOf('2027');
  function total(list, cat) { return sum(list, function (b) { return b.rule.categoryId === cat && b.amount !== null ? b.amount : 0; }); }
  eq('yearly bills of licences and insurance: Rs 1,94,000 in each year', [total(y26, 'licences'), total(y27, 'licences')], [rs(194000), rs(194000)]);
  eq('rent of October 2026 (9.1)', sum(E.billsOn('2026-10-01'), function (b) { return b.rule.categoryId === 'rent' ? b.amount : 0; }), rs(164500));
  eq('rent steps: January 2026, April, July, October 2026, January, April, July, October 2027', ['2026-01-01', '2026-04-01', '2026-07-01', '2026-10-01', '2027-01-01', '2027-04-01', '2027-07-01', '2027-10-01'].map(function (d) {
    return sum(E.billsOn(d), function (b) { return b.rule.categoryId === 'rent' ? b.amount : 0; }) / 100;
  }), [157000, 161500, 163000, 164500, 165300, 170000, 171600, 173200]);
  eq('telephone bills on the 5th', E.billsOn('2026-03-05').map(function (b) { return [b.rule.unitId, b.amount]; }), [['factory', rs(3989)], ['st_anand', rs(898)], ['st_vvn', rs(898)], ['st_nadiad', rs(898)]]);
  eq('professional fees of a year: twelve retainers and the tax audit', total(y26, 'professional'), rs(12 * 12000 + 60000));
  eq('medical certificates: Rs 400 x (active employees - 3)', [E.billsOn('2026-03-20')[0].amount, E.billsOn('2027-03-20')[0].amount], [rs(12800), rs(13200)]);
  eq('Diwali sweets: Rs 1,500 x (active employees - 1)', ['2026-11-03', '2027-10-24'].map(function (d) { return E.billsOn(d).filter(function (b) { return b.rule.n === 38; })[0].amount; }), [rs(52500), rs(52500)]);
  eq('van service bills of 2026: van and date', y26.filter(function (b) { return b.rule.n === 12; }).map(function (b) { return b.rule.van + ' ' + b.date.slice(5); }),
    ['V1 01-12', 'V4 01-22', 'V2 02-12', 'V5 02-22', 'V3 03-12', 'V1 04-12', 'V4 04-22', 'V2 05-12', 'V5 05-22', 'V3 06-12', 'V1 07-12', 'V4 07-22', 'V2 08-12', 'V5 08-22', 'V3 09-12', 'V1 10-12', 'V4 10-22', 'V2 11-12', 'V5 11-22', 'V3 12-12']);
  eq('tyres of 2026 on the date of that month\'s service', y26.filter(function (b) { return b.rule.n === 13; }).map(function (b) { return b.rule.van + ' ' + b.date.slice(5); }), ['V1 04-12', 'V2 05-12', 'V3 06-12', 'V4 10-22', 'V5 11-22']);
  eq('battery: V5 in 2026, V2 in 2027', y26.concat(y27).filter(function (b) { return b.rule.n === 14; }).map(function (b) { return b.rule.van + ' ' + b.date; }), ['V5 2026-08-22', 'V2 2027-08-22']);
  eq('van insurance and fitness fee dates', y27.filter(function (b) { return b.rule.n === 22 || b.rule.n === 23; }).map(function (b) { return b.rule.van + ' ' + b.date.slice(5) + ' ' + b.amount / 100; }),
    ['V1 02-20 22000', 'V1 02-20 1500', 'V2 05-20 22000', 'V2 05-20 1500', 'V3 07-20 22000', 'V3 07-20 1500', 'V4 09-20 22000', 'V4 09-20 1500', 'V5 11-20 22000', 'V5 11-20 1500']);
  eq('one seeded event: the proofer compressor', y26.concat(y27).filter(function (b) { return b.rule.n === 19; }).map(function (b) { return b.date + ' ' + b.amount / 100; }), ['2026-08-18 42000']);
  eq('festival leaflets', y26.concat(y27).filter(function (b) { return b.rule.n === 41; }).map(function (b) { return b.date + ' ' + b.amount / 100; }), ['2026-01-05 8000', '2026-10-24 12000', '2027-01-05 8000', '2027-10-14 12000']);
  /* 20 bills every month (4 rent, 4 electricity, gas, 2 diesel, 4 telephone, retainer, bank charges, advertising, housekeeping, water) and 66 dated ones
     in 2026: 20 van services, 5 tyres, 1 battery, 4 contract, 2 generator, 1 compressor, 2 testing, 1 weights and measures, 10 van insurance and fitness,
     3 policies, 4 food licences, professional tax, factory licence, tax audit, 2 uniforms, 1 medical, 1 Diwali, 2 leaflets, 4 pest control; no compressor in 2027 */
  eq('bills dated by a rule in 2026 and 2027', [y26.length, y27.length], [240 + 66, 240 + 65]);
  eq('seeded-day bills: an ordinary month, a quarter-end month', [E.seededBills('2026-02').map(function (r) { return r.n; }), E.seededBills('2026-03').map(function (r) { return r.n; })], [[16, 39], [16, 17, 39]]);
  ok('no rule dates a bill on a closed day, month-end bills apart', y26.concat(y27).every(function (b) { return !S.calendar.isClosed(b.date) || b.date === D.monthEnd(b.date); }));
  eq('bills that keep their month-end date on the closed 31 October 2027', E.billsOn('2027-10-31').map(function (b) { return b.rule.n; }), [33, 35, 42]);
  eq('VE08: the contract is paid at 15 days, its other bills at 7', E.bills.filter(function (b) { return b.vendorId === 'VE08'; }).map(function (b) { return [b.n, b.payAfterDays]; }), [[15, 15], [18, 7], [19, 7]]);
  /* the engine dates an expense bill due at bill date + the vendor's one term: a rule that pays on another day must pay earlier, never after the due date shown (CONFIG choice 11) */
  ok('no bill rule pays after the due date its document shows', E.bills.every(function (b) { return b.payAfterDays === null || b.payAfterDays <= VEND[b.vendorId].termsDays; }));
  eq('rules that pay before the vendor\'s term: the two other bills of VE08', E.bills.filter(function (b) { return b.payAfterDays !== null && b.payAfterDays !== VEND[b.vendorId].termsDays; }).map(function (b) { return b.n; }), [18, 19]);
  ok('the bank is paid the same day and has no term', E.bills.every(function (b) { return !b.sameDay || VEND[b.vendorId].termsDays === 0; }));
  /* 9.2: a bill is never dated on a closed day unless its rule fixes the date - the drawn day of rows 16, 17 and 39 */
  var seededRules = E.bills.filter(function (b) { return !!b.seededDay; });
  eq('rules with a drawn day and their ranges', seededRules.map(function (b) { return [b.n, b.seededDay]; }), [[16, [8, 26]], [17, [8, 26]], [39, [10, 20]]]);
  ok('a drawn bill day is never a closed day and stays inside its range, in every month', S.prices.months.every(function (m) {
    return E.seededBills(m).every(function (r) {
      var list = E.seededDates(r, m);
      return list.length > 0 && list.every(function (d) { return d.slice(0, 7) === m && !S.calendar.isClosed(d) && +d.slice(8) >= r.seededDay[0] && +d.slice(8) <= r.seededDay[1]; }) &&
        [0, 0.25, 0.5, 0.999999].every(function (u) { return list.indexOf(E.seededDate(r, m, u)) !== -1; });
    });
  }));
  eq('days a drawn bill can take: an ordinary month, November 2026 without the 9th, 10th and 11th', [E.seededDates(seededRules[0], '2026-02').length, E.seededDates(seededRules[0], '2026-11').length, E.seededDates(seededRules[2], '2026-02').length, E.seededDates(seededRules[2], '2026-11').length], [19, 16, 11, 9]);
  eq('the draw picks the first and the last open day of the range', [E.seededDate(seededRules[2], '2026-11', 0), E.seededDate(seededRules[2], '2026-11', 0.15), E.seededDate(seededRules[2], '2026-11', 0.999)], ['2026-11-12', '2026-11-13', '2026-11-20']);
  eq('the second breakdown bill has no day outside its months', [E.seededDates(seededRules[1], '2026-02'), E.seededDate(seededRules[1], '2026-02', 0.5), E.seededDates(seededRules[1], '2026-03').length], [[], null, 19]);
  /* 9.3, 9.4: a meter reads whole units - kWh and SCM are whole before they are priced (CONFIG choice 10) */
  var consumption = ['2025-12'].concat(S.prices.months.slice(0, 23));
  ok('units and SCM are whole numbers in every consumption month, at any volume factor', consumption.every(function (m) {
    return [0.78, 0.9, 1, 1.03].every(function (v) { return E.electricity.factoryUnits(m, v) % 1 === 0 && E.gas.scm(m, v) % 1 === 0; }) &&
      STORES.every(function (s) { return E.electricity.storeUnits(s, m) % 1 === 0; });
  }));
  ok('rounding the units moves a gas bill by under Rs 33.01 and a store bill by under Rs 4.13', consumption.every(function (m) {
    var days = D.daysInMonth(m), mm = +m.slice(5, 7);
    return [0.78, 0.9, 1, 1.03].every(function (v) { return Math.abs(E.gas.amount(m, v) - 63 * days * (0.30 + 0.70 * v) * E.gas.priceIn(m)) <= 3301; }) &&
      STORES.every(function (s, i) {
        var kwh = [620, 520, 400][i] * E.electricity.tariff.storeSeason[mm - 1] * (s === 'st_vvn' && (mm === 5 || mm === 11) ? 0.85 : 1);
        return Math.abs(E.electricity.store(s, m) - (kwh * (4.35 + E.electricity.surcharge(m)) + 250) * 1.20 * 100) <= 413;
      });
  }));
  /* expense vendor terms of 5.3 */
  eq('expense vendor terms in days', C.vendors.filter(function (v) { return v.kind === 'expense'; }).map(function (v) { return v.termsDays; }), [6, 4, 4, 4, 10, 10, 7, 15, 15, 15, 15, 7, 7, 7, 7, 0, 7, 7, 7, 7, 7, 7, 7, 7]);
  /* the typical month of 9.1 at October 2026 rates, for the lines that are fixed by rule */
  var oct = [];
  D.range('2026-10-01', '2026-10-31').forEach(function (d) { E.billsOn(d, { V: function () { return 0.97; }, cashDeposited: rs(1400000) }).forEach(function (b) { oct.push(b); }); });
  near('electricity of a typical month, about Rs 91,800', total(oct, 'electricity'), rs(91800), rs(3000));
  near('oven fuel of a typical month, about Rs 1,17,200', total(oct, 'oven_fuel'), rs(117200), rs(4000));
  near('diesel on account of a typical month (the claims add the rest of Rs 58,800)', total(oct, 'vehicle_fuel'), rs(55800), rs(1500));
  near('bank charges of a typical month, about Rs 3,600', total(oct, 'bank_charges'), rs(3600), rs(100));
  near('telephone bills of a typical month (a recharge claim adds the rest of Rs 7,000)', total(oct, 'telephone'), rs(6683), 0);
  /* claims: about 40 a month, about Rs 32,000 */
  var rows = E.claims.rows;
  near('claims a month', sum(rows, function (c) { return c.perMonth; }), 40, 2);
  near('claims a month, value at the middle of each range', sum(rows, function (c) { return c.perMonth * (c.amount[0] + c.amount[1]) / 2; }), rs(32000), rs(2500));
  eq('claim rows after the store rows are spread over the three stores', rows.length, 14 + 4 * 3);
  eq('the recharge takes one of its listed amounts', rows.filter(function (c) { return c.amounts; }).map(function (c) { return c.amounts; }), [[rs(239), rs(299), rs(399), rs(479)]]);
  /* 8.3: a factory claim is payable to whoever raises it, a store claim to that store's manager, whoever raises it */
  var storeRows = rows.filter(function (c) { return c.unitId !== 'factory'; });
  eq('a factory claim is payable to the employee of its persona', rows.filter(function (c) { return c.unitId === 'factory' && c.payeeEmployeeId !== USER[c.userId].employeeId; }).length, 0);
  ok('a store claim is raised under u_store_mgr and is payable to that store\'s manager', storeRows.length === 12 && storeRows.every(function (c) {
    return c.userId === 'u_store_mgr' && c.payeeEmployeeId === S.stores.manager[c.unitId] && ALL_EMP[c.payeeEmployeeId].unitId === c.unitId && ALL_EMP[c.payeeEmployeeId].designation === 'Store manager';
  }));
  eq('payees by store', STORES.map(function (s) { return keys(storeRows.reduce(function (o, c) { if (c.unitId === s) o[c.payeeEmployeeId] = 1; return o; }, {})); }), [['E029'], ['E032'], ['E034']]);
  /* the engine pays a claim to the persona's employee (API 2.7): these are the rows where 8.3 names somebody else (CONFIG choice 24) */
  eq('rows whose payee is not the employee of the persona: the four claims of S1 and of S3', rows.filter(function (c) { return c.payeeEmployeeId !== USER[c.userId].employeeId; }).map(function (c) { return c.unitId; }),
    ['st_anand', 'st_nadiad', 'st_anand', 'st_nadiad', 'st_anand', 'st_nadiad', 'st_anand', 'st_nadiad']);
  eq('the note of a claim names the manager at S1 and S3 only', [E.claims.noteOf(rows[0]), E.claims.noteOf(storeRows[0]), E.claims.noteOf(storeRows[1]), E.claims.noteOf(storeRows[2])],
    ['', 'Store manager: Ketan Bhatt (E029)', '', 'Store manager: Alpesh Trivedi (E034)']);
  /* 9.6, 7.4: reimbursed every Saturday; nothing is reimbursed on a closed day, it moves to the next open day */
  var reimb = ALL_DAYS.filter(E.claims.isReimburseDay);
  eq('claims are reimbursed once for every Saturday of the two years', [E.claims.reimburse.dow, reimb.length], [5, ALL_DAYS.filter(function (d) { return researchDow(d) === 6; }).length]);
  eq('on the Saturday, except that of the closed 30 October 2027', reimb.filter(function (d) { return researchDow(d) !== 6; }), ['2027-11-01']);
  ok('and never on a closed day', reimb.every(function (d) { return !S.calendar.isClosed(d); }));
  eq('factory cash: Monday to Saturday, never a closed day', ['2026-01-03', '2026-01-04', '2026-11-10'].map(S.cash.isFactoryDepositDay), [true, false, false]);
  eq('factory cash float and smallest deposit', [S.cash.factory.keep, S.cash.factory.minDeposit], [rs(25000), rs(5000)]);
  eq('the month-end count is on the last open day', [S.stockCount.dateOf('2026-02'), S.stockCount.dateOf('2027-10'), S.stockCount.dateOf('2026-11')], ['2026-02-28', '2027-10-29', '2026-11-30']);
});

section('The eight seeded stories (RESEARCH 12)', function () {
  var st = S.stories;
  /* 12.2: the product that bakes badly, by month */
  eq('dip product by month, 2026', S.prices.months.slice(0, 12).map(function (m) { return st.yieldDip.on(m + '-10').itemId; }),
    ['FG04', 'FG12', 'FG01', 'FG16', 'FG10', 'FG05', 'FG04', 'FG12', 'FG01', 'FG16', 'FG10', 'FG05']);
  eq('and 2027 the same', S.prices.months.slice(12).map(function (m) { return st.yieldDip.on(m + '-10').itemId; }),
    ['FG04', 'FG12', 'FG01', 'FG16', 'FG10', 'FG05', 'FG04', 'FG12', 'FG01', 'FG16', 'FG10', 'FG05']);
  eq('the dip runs from the 5th to the 18th', ['2026-09-04', '2026-09-05', '2026-09-18', '2026-09-19'].map(function (d) { return st.yieldDip.on(d) ? st.yieldDip.on(d).itemId : null; }), [null, 'FG01', 'FG01', null]);
  eq('the note and the reject range of the September dip', [st.yieldDip.on('2026-09-10').note, st.yieldDip.on('2026-09-10').rejectRate], ['proofer humidity fault', [0.08, 0.12]]);
  /* a reject of 8-12% gives a yield of 89-94% */
  var lo = S.production.outcome('FG01', 4, 0, 0.12), hi = S.production.outcome('FG01', 4, 0, 0.08);
  ok('a dip entry yields 88-95%', lo.good / lo.expected > 0.88 && hi.good / hi.expected < 0.95, round2(lo.good / lo.expected) + ' to ' + round2(hi.good / hi.expected));
  eq('run days of butter khari and elaichi toast inside a dip window', [D.range('2026-02-05', '2026-02-18').filter(function (d) { return S.production.isRunDay('FG12', d); }).length, D.range('2026-05-05', '2026-05-18').filter(function (d) { return S.production.isRunDay('FG10', d); }).length], [4, 6]);
  /* 12.3, 12.4 */
  eq('the high-returns outlet', [st.highReturns.customerId, S.returns.outletFactor('O19'), CUST.O19.routeId, S.collections.slow.O19], ['O19', 3.5, 'R2', 'everyThirdWeek']);
  eq('the late corporate', [st.lateCorporate.customerId, CUST.C06.creditDays, S.collections.corporate.C06.latenessDays, S.collections.corporate.C06.payDow, CUST.C06.creditLimit], ['C06', 15, 20, 0, rs(40000)]);
  /* about 16 orders of C06 open at any time; the fewest value open, in the Chaturmas weeks after Diwali 2026, is still above its limit */
  function c06Open(d) {
    var v = 0, n = 0, x;
    for (x = D.addDays(d, -45); x <= d; x = D.addDays(x, 1)) {
      var f = S.demand.corporateFactor('C06', x);
      if (f > 0 && S.collections.corporatePayDate('C06', D.addDays(x, 15)) > d) { v += f * orderValue(CUST.C06, S.priceListOn(x)); n++; }
    }
    return [v, n];
  }
  var least = Infinity, most = 0, when = '', peak = '', counts = [];
  D.range('2026-03-01', '2027-12-31').forEach(function (d) {
    var o = c06Open(d);
    counts.push(o[1]);
    if (o[0] < least) { least = o[0]; when = d; }
    if (o[0] > most) { most = o[0]; peak = d; }
  });
  ok('C06 is above its credit limit on every date, by its expected orders alone', least > CUST.C06.creditLimit, 'least Rs ' + Math.round(least / 100) + ' on ' + when);
  near('the least it owes is about Rs 54,000', least, rs(54000), rs(4000));
  eq('and that is in the Chaturmas weeks', S.demand.catererFactor(when), 0.70);
  ok('the most is Rs 1.0 to 1.25 lakh', most >= rs(100000) && most <= rs(125000), 'Rs ' + Math.round(most / 100) + ' on ' + peak);
  ok('and builds up in a wedding window or the NRI season', S.demand.catererFactor(D.addDays(peak, -14)) >= 1.20, peak);
  near('about 16 of its orders are open at any time', sum(counts) / counts.length, 16, 1.5);
  note('C06 by its expected orders: least Rs ' + Math.round(least / 100) + ' on ' + when + ', most Rs ' + Math.round(most / 100) + ' on ' + peak + ', limit Rs ' + CUST.C06.creditLimit / 100);
  /* 12.5 */
  eq('the standing held bill: weekly, vegetable vendor, onion line 3-6% over', [st.heldBill.weekly.vendorId, st.heldBill.weekly.itemId, st.heldBill.weekly.elseItemId, st.heldBill.weekly.over, st.heldBill.weekly.releasedAfterDays], ['VM09', 'RM20', 'RM19', [0.03, 0.06], 7]);
  ok('3% over the order rate fails the three-way check', st.heldBill.weekly.over[0] * 100 > C.limits.billTolerancePct && st.heldBill.occasional.over[0] * 100 > C.limits.billTolerancePct);
  eq('the occasional held bill', [st.heldBill.occasional.vendors, st.heldBill.occasional.chance, st.heldBill.occasional.over], [['VM03', 'VM04', 'VM07', 'VM12', 'VM13'], 0.025, [0.03, 0.05]]);
  /* 12.6: two Tuesdays in three at S3; every 30-day window holds two to four */
  var tuesdays = D.range('2026-01-01', '2027-12-31').filter(function (d) { return D.dow(d) === 1 && !S.calendar.isClosed(d); });
  var shorts = tuesdays.filter(st.cashShort.on);
  eq('the first Tuesdays of 2026: short, short, not', tuesdays.slice(0, 6).map(st.cashShort.on), [true, true, false, true, true, false]);
  near('two Tuesdays in three', shorts.length / tuesdays.length, 2 / 3, 0.02);
  ok('never on another weekday', D.range('2026-01-01', '2027-12-31').every(function (d) { return !st.cashShort.on(d) || D.dow(d) === 1; }));
  var windows = D.range('2026-01-01', '2027-12-02').map(function (d) { var to = D.addDays(d, 29); return shorts.filter(function (x) { return x >= d && x <= to; }).length; });
  eq('shortages in any 30 days: fewest and most (band 44: 2-4)', [Math.min.apply(null, windows), Math.max.apply(null, windows)], [2, 4]);
  eq('amount of a shortage', [st.cashShort.amount, st.cashShort.roundTo, st.cashShort.anywhere.chance, st.cashShort.anywhere.shortShare], [[rs(30), rs(180)], rs(10), 0.02, 0.7]);
  /* 12.7, 12.8 */
  eq('yeast as the master has it', [ITEM.RM08.reorderLevel, ITEM.RM08.orderQty, ITEM.RM08.leadDays], [st.lowStock.reorderLevel, st.lowStock.orderQty, st.lowStock.leadDays]);
  eq('ladi pav: three days of life, inside the near-expiry flag on its last day but one', [ITEM.FG04.shelfLifeDays, C.limits.nearExpiryDays], [3, 1]);
});

/* ====================================================== 10b. the warning thresholds */

section('Warning thresholds lie outside what an ordinary day gives (RESEARCH 3.3, 3.4, 4.2 - 4.4, 9.5, 9.6, 12.2, 12.6; SCOPE decision 18)', function () {
  var W = C.limits.warn, P = S.production;
  function pct1(x) { return Math.round(x * 1000) / 10; }
  /* 3.4: made = T x (1 + u) with u up to the drift; rejected = made x r x v with v from 0.5. The best a run can give, against E */
  var best = FG.map(function (id) { var p = P.byItem[id]; return p.piecesPerMix * (1 + p.drift) * (1 - p.reject * P.rejectDraw[0]) / p.expectedUnits; });
  var top = Math.max.apply(null, best);
  ok('the best run of every product stays under the upper yield threshold', top * 100 < W.yieldHighPct, pct1(top) + '%');
  /* butter khari: 139 x 1.02 x (1 - 0.03 x 0.5) / 134 = 139.6533 / 134 */
  eq('the highest is butter khari, at 104.2%', [FG[best.indexOf(top)], pct1(top)], ['FG12', 104.2]);
  /* 3.4, 12.2: the worst a bad run leaves when it is not an oven fault: the highest reject rate drawn, at the bottom of the drift */
  var worst = [];
  P.badRuns.forEach(function (b) {
    b.items.forEach(function (id) {
      var p = P.byItem[id];
      if (b.rejectRate) worst.push([id, b.id, p.piecesPerMix * (1 - p.drift) * (1 - b.rejectRate[1]) / p.expectedUnits]);
      else if (b.yieldUnder) worst.push([id, b.id, 1 - b.yieldUnder[1]]);
    });
  });
  S.stories.yieldDip.rotation.forEach(function (d) { var p = P.byItem[d.itemId]; worst.push([d.itemId, 'dip', p.piecesPerMix * (1 - p.drift) * (1 - S.stories.yieldDip.rejectRate[1]) / p.expectedUnits]); });
  worst.sort(function (a, b) { return a[2] - b[2]; });
  ok('the worst bad run short of an oven fault stays above the lower yield threshold', worst[0][2] * 100 >= W.yieldLowPct, worst[0].join(' '));
  /* a puff: 92 x (1 - 0.015) x (1 - 0.20) / 89 = 72.496 / 89 */
  eq('it is a puff with soft lamination fat, at 81.5%', [worst[0][1], pct1(worst[0][2])], ['softFatPuff', 81.5]);
  note('yield: an ordinary run lies between ' + pct1(worst[0][2]) + '% (' + worst[0][0] + ', ' + worst[0][1] + ') and ' + pct1(top) + '% (' + FG[best.indexOf(top)] + '); the thresholds are ' + W.yieldLowPct + '% and ' + W.yieldHighPct + '%');
  /* 9.6: the claim rows */
  var largest = Math.max.apply(null, S.expenses.claims.rows.map(function (r) { return r.amount[1]; }));
  eq('the largest claim of 9.6 is Rs 2,600, about half the claim threshold', [largest, largest * 2 > W.claimAbove, largest < W.claimAbove], [rs(2600), true, true]);
  /* 4.2 - 4.4: the price of a material in a month against the month before */
  var movers = {}, widest = { RM20: 0, other: 0, at: '' };
  keys(S.prices.table).forEach(function (id) {
    S.prices.months.forEach(function (m, i) {
      if (!i) return;
      var was = S.prices.inMonth(id, S.prices.months[i - 1]), now = S.prices.inMonth(id, m), move = Math.abs(now - was) / was;
      if (move * 100 > W.rateAwayPct) movers[id] = (movers[id] || 0) + 1;
      if (id === 'RM20') widest.RM20 = Math.max(widest.RM20, move);
      else if (move > widest.other) { widest.other = move; widest.at = id + ' ' + m; }
    });
  });
  /* onions, 4.2: 19.00 to 24.00 in July 2026 (26.3%), to 32.00 in August (33.3%), to 44.00 in September (37.5%), and 39.10 to 26.60 in December (32.0%) */
  eq('from one month to the next only onions move by more than the rate threshold, in four months of the 23', movers, { RM20: 4 });
  eq('the widest move of any other material is sugar in August 2026, 20.5%', [widest.at, pct1(widest.other)], ['RM03 2026-08', 20.5]);
  /* 9.5: a month-end count is short by 2% of a month's use at most, a tenth of the count threshold */
  var counts = S.stockCount, shares = [counts.packing.shortage[1], counts.flour.shortage[1], counts.bulk.shortage[1], counts.others.range[1], -counts.others.range[0]];
  eq('the largest share a month-end count draws is 2% of the month\'s use', Math.max.apply(null, shares), 0.02);
  ok('which is a tenth of the count threshold', Math.max.apply(null, shares) * 100 * 10 <= W.countAwayPct);
  /* 12.6: a till is out by Rs 180 at most; that is more than a tenth only of a day that sold under Rs 1,800 */
  eq('the largest till difference of 12.6, and the day\'s sales under which it would be warned about', [S.stories.cashShort.amount[1], S.stories.cashShort.anywhere.amount[1], S.stories.cashShort.amount[1] * 100 / W.dayEndAwayPct], [rs(180), rs(40), rs(1800)]);
});

/* ====================================================== 11. the demand model against 11.6 */

section('The demand model, month by month, against RESEARCH 11.6 (expected values)', function () {
  /* expected sales with no noise: every factor of section 7, both price revisions; a wet day weighted by its chance */
  function expectRain(date, routeId, fn) {
    var p = S.rain.wetChance(date);
    if (p > 0) return p * fn('wet') + (1 - p) * fn('dry');
    return fn(S.rain.kind(date, 1, routeId));
  }
  var rows = [], worst = { retail: 0, corporate: 0, store: 0, returns: 0, net: 0 };
  var yearOf = { '2026': {}, '2027': {} };   /* expected sales of each corporate and each store, by year */
  function add(year, id, v) { yearOf[year][id] = (yearOf[year][id] || 0) + v; }
  S.prices.months.forEach(function (m) {
    var retail = 0, corp = 0, store = 0, returned = 0, want = C.calibration.months[m];
    D.range(m + '-01', D.monthEnd(m + '-01')).forEach(function (d) {
      if (S.calendar.isClosed(d)) return;
      var list = S.priceListOn(d);
      OUTLETS.forEach(function (c) {
        keys(c.standing).forEach(function (k) {
          var value = c.standing[k] * list[k].retail;
          retail += value * expectRain(d, c.routeId, function (rain) { return S.demand.retailFactor(c.id, k, d, rain); });
          returned += value * expectRain(d, c.routeId, function (rain) { return S.demand.retailFactor(c.id, k, d, rain) * S.returns.expected(c.id, k, 1, d, rain); });
        });
      });
      CORPS.forEach(function (c) {
        var f = S.demand.corporateFactor(c.id, d);
        if (f > 0) { corp += f * orderValue(c, list); add(m.slice(0, 4), c.id, f * orderValue(c, list)); }
      });
      STORES.forEach(function (s) {
        FG.forEach(function (k) {
          var v = S.stores.sale[s][k] * realisation(k, list) * expectRain(d, null, function (rain) { return S.demand.storeFactor(s, k, d, rain); });
          store += v; add(m.slice(0, 4), s, v);
        });
      });
    });
    var net = retail - returned + corp + store;
    rows.push([m, retail / want.retailGross, returned / want.staleReturns, corp / want.corporates, store / want.stores, net / want.netSales]);
    worst.retail = Math.max(worst.retail, Math.abs(retail / want.retailGross - 1));
    worst.corporate = Math.max(worst.corporate, Math.abs(corp / want.corporates - 1));
    worst.store = Math.max(worst.store, Math.abs(store / want.stores - 1));
    worst.returns = Math.max(worst.returns, Math.abs(returned / want.staleReturns - 1));
    worst.net = Math.max(worst.net, Math.abs(net / want.netSales - 1));
    /* a store cannot sell more puffs than it holds, so its expected sale is a little under the uncapped figure computed here */
    ok(m + ' retail gross within 0.3% of 11.6', Math.abs(retail / want.retailGross - 1) <= 0.003, (retail / 1e7).toFixed(2) + ' against ' + (want.retailGross / 1e7).toFixed(2) + ' lakh');
    ok(m + ' corporates within 0.5% of 11.6', Math.abs(corp / want.corporates - 1) <= 0.005, (corp / 1e7).toFixed(2) + ' against ' + (want.corporates / 1e7).toFixed(2) + ' lakh');
    ok(m + ' own stores within 2.5% of 11.6', Math.abs(store / want.stores - 1) <= 0.025, (store / 1e7).toFixed(2) + ' against ' + (want.stores / 1e7).toFixed(2) + ' lakh');
    ok(m + ' stale returns within 2% of 11.6', Math.abs(returned / want.staleReturns - 1) <= 0.02, (returned / 1e7).toFixed(2) + ' against ' + (want.staleReturns / 1e7).toFixed(2) + ' lakh');
    ok(m + ' net sales within 1% of 11.6 (band 4 allows the seed 3%)', Math.abs(net / want.netSales - 1) <= 0.01, (net / 1e7).toFixed(2) + ' against ' + (want.netSales / 1e7).toFixed(2) + ' lakh');
  });
  /* 6.4 and 6.5: what the rules make of each corporate and each store over a year, Rs lakh in 2026 and in 2027 */
  var YEAR = {
    C01: [16.93, 17.61], C02: [9.72, 10.17], C03: [10.68, 11.02], C04: [6.21, 6.40], C05: [9.00, 9.34], C06: [7.63, 8.34], C07: [2.91, 3.35],
    C08: [9.40, 9.87], C09: [6.46, 6.76], C10: [5.83, 6.03], st_anand: [49.12, 51.43], st_vvn: [31.42, 32.94], st_nadiad: [23.82, 24.95]
  };
  keys(YEAR).forEach(function (id) {
    ['2026', '2027'].forEach(function (y, i) {
      var got = yearOf[y][id] / 1e7, tol = id.charAt(0) === 'C' ? 0.005 : 0.02;   /* the stores: uncapped by stock, as above */
      ok(id + ' sales of ' + y + ' within ' + (tol * 100) + '% of the table', Math.abs(got / YEAR[id][i] - 1) <= tol, got.toFixed(2) + ' against ' + YEAR[id][i] + ' lakh');
    });
  });
  var st26 = yearOf['2026'].st_anand + yearOf['2026'].st_vvn + yearOf['2026'].st_nadiad;
  ok('store shares of store sales inside band 8', STORES.every(function (s) { var p = C.calibration.bands[7].parts[s], x = yearOf['2026'][s] / st26; return x >= p[0] && x <= p[1]; }));
  note('largest difference from 11.6 over the 24 months: retail ' + (worst.retail * 100).toFixed(1) + '%, corporates ' + (worst.corporate * 100).toFixed(1) +
    '%, own stores ' + (worst.store * 100).toFixed(1) + '%, stale returns ' + (worst.returns * 100).toFixed(1) + '%, net sales ' + (worst.net * 100).toFixed(1) + '%');
  if (VERBOSE) rows.forEach(function (r) { note(r[0] + '  retail ' + r[1].toFixed(3) + '  returns ' + r[2].toFixed(3) + '  corporates ' + r[3].toFixed(3) + '  stores ' + r[4].toFixed(3) + '  net ' + r[5].toFixed(3)); });
});

/* ====================================================== 12. guide journeys */

/* the routes of SPEC section 9 */
var ROUTES = ['#/home', '#/approvals', '#/guide', '#/sell/dispatch', '#/sell/corporate', '#/sell/invoices', '#/sell/returns', '#/sell/receipts',
  '#/stores/transfers', '#/stores/dayend', '#/buy/orders', '#/buy/receipts', '#/buy/bills', '#/buy/payments', '#/make/production', '#/make/recipes',
  '#/stock/onhand', '#/stock/batches', '#/stock/ledger', '#/stock/counts', '#/expenses', '#/people', '#/accounts/receivables', '#/accounts/payables',
  '#/accounts/cash', '#/accounts/pnl', '#/accounts/margin', '#/accounts/gst', '#/reports', '#/masters/items', '#/masters/parties', '#/masters/setup',
  '#/system/audit', '#/system/notifications', '#/system/tiers', '#/system/about'];
/* route -> page id, for the persona a step suggests */
function pageOf(route) { return route === '#/home' || route === '#/approvals' || route === '#/guide' || route === '#/expenses' || route === '#/people' || route === '#/reports'
  ? route.slice(2) : route.slice(2).replace('accounts/', 'acc-').replace('system/', 'sys-').replace('/', '-'); }

section('Guide journeys: text, routes and match rules (SPEC 8.1, 9)', function () {
  /* journey: per step the suggested persona, the operation and the document type */
  var WANT = [
    ['dispatch', [['sales', 'postDispatch', 'INV']]],
    ['flour', [['stores', 'post', 'PO'], ['stores', 'post', 'GRN']]],
    ['bill', [['accounts', 'post', 'VBILL'], ['owner', 'approve', 'VBILL'], ['accounts', 'post', 'PAY']]],
    ['production', [['production', 'post', 'PROD']]],
    ['store', [['stores', 'post', 'XFER'], ['store_mgr', 'receiveTransfer', 'XFER'], ['store_mgr', 'post', 'DAYEND'], ['owner', 'approve', 'WO']]],
    ['return', [['sales', 'post', 'CN'], ['owner', 'approve', 'CN']]],
    ['claim', [['store_mgr', 'post', 'EXP'], ['owner', 'approve', 'EXP'], ['accounts', 'post', 'PAY']]],
    ['collect', [['accounts', 'post', 'RCPT'], ['accounts', 'post', 'DEP']]]
  ];
  eq('journeys and their steps', C.journeys.map(function (j) { return [j.id, j.steps.map(function (s) { return [s.role, s.match.op, s.match.type]; })]; }), WANT);
  C.journeys.forEach(function (j) {
    ok(j.id + ': a title', typeof j.title === 'string' && j.title.length > 20);
    j.steps.forEach(function (s, i) {
      var where = j.id + ' step ' + (i + 1);
      ok(where + ': text a person can follow', typeof s.text === 'string' && s.text.length >= 25 && /\.$/.test(s.text));
      ok(where + ': no figure in the sentence (SPEC 2.11)', !/[0-9]/.test(s.text), s.text);
      ok(where + ': no emoji, no exclamation mark, plain characters', /^[\x20-\x7E]+$/.test(s.text) && s.text.indexOf('!') === -1);
      ok(where + ': a route of SPEC section 9', ROUTES.indexOf(s.route) !== -1, s.route);
      ok(where + ': a role', HB.session.roles.indexOf(s.role) !== -1);
      ok(where + ': the suggested persona can open the page', HB.session.canOpen(pageOf(s.route), s.role), s.role + ' ' + pageOf(s.route));
      ok(where + ': the test, if any, is a function', s.match.test === undefined || typeof s.match.test === 'function');
    });
    ok(j.id + ': links to look at afterwards, each on a route of SPEC section 9', j.links.length > 0 && j.links.every(function (l) { return ROUTES.indexOf(l.route) !== -1 && l.text.length > 5 && !/[0-9]/.test(l.text); }));
    /* the parameters a link carries are those its screen honours, and each names something that exists */
    ok(j.id + ': the parameters of each link name a location, an account, a product or a tab of its screen', j.links.every(function (l) {
      return Object.keys(l.params || {}).every(function (k) {
        var v = l.params[k], M = HB.masters;
        if (k === 'loc') return l.route === '#/stock/onhand' && !!M.locationById[v];
        if (k === 'account') return l.route === '#/accounts/cash' && !!M.accountById[v];
        if (k === 'item') return l.route === '#/make/recipes' && !!M.itemById[v] && M.itemById[v].kind === 'fg';
        if (k === 'tab') return l.route === '#/sell/receipts' && (v === 'statement' || v === 'receipts');
        return false;
      });
    }));
  });
  /* a link lands where its words say: the finished store, the store of the journey, the statement, the product, the book */
  function linkOf(id, text) { var j = C.journeys.filter(function (x) { return x.id === id; })[0]; return (j.links.filter(function (l) { return l.text === text; })[0] || {}).params || null; }
  eq('links open on what they name', [linkOf('dispatch', 'Finished stock at the factory'), HB.masters.locationById.fac_fg.kind, linkOf('store', 'Stock at the store'), HB.masters.locationById.st_vvn.kind,
    linkOf('return', 'The outlet\'s statement'), linkOf('flour', 'Cost sheet of sandwich bread'), HB.masters.itemById.FG01.name, linkOf('bill', 'Cash book: the payment out of the bank'),
    linkOf('dispatch', 'Cash book: what the cash outlets paid at the drop'), HB.masters.accountById.cash_factory.kind],
  [{ loc: 'fac_fg' }, 'fg', { loc: 'st_vvn' }, 'store', { tab: 'statement' }, { item: 'FG01' }, 'Sandwich bread', { account: 'bank' }, { account: 'cash_factory' }, 'cash']);
  ok('titles as SPEC 8.1 words them', C.journeys[0].title === 'Post today\'s dispatch for a route and see sales, stock and cash move' &&
    C.journeys[7].title === 'Receive a payment from a corporate and deposit cash in the bank, and see receivables and the cash book move');
  eq('the masters carry the journeys by reference', HB.masters.journeys === C.journeys, true);
});

section('Guide journeys: each step is ticked by the entry SPEC 8.1 names, through HB.engine.act', function () {
  /* a copy with the opening entries only, on the first business date a copy can have */
  HB.store.remove('log');
  HB.calendar.set('2026-02-01');
  HB.engine.boot();
  var today = HB.calendar.today, J = {};
  C.journeys.forEach(function (j) { J[j.id] = j; });

  function act(userId, op, args, label) {
    HB.session.set(userId);
    var res = HB.engine.act(op, args);
    ok(label + ' goes through as ' + userId, res.ok === true, res.ok ? '' : res.error.code + ': ' + res.error.message);
    return res;
  }
  function entry(res) { var log = HB.engine.log(); return res && res.ok ? log.filter(function (e) { return e.n === res.n; })[0] : null; }
  /** The entry must tick exactly the step named, and no other step of any journey. */
  function ticks(res, journeyId, stepNo, label) {
    var e = entry(res), hit = [];
    if (!e) { ok(label + ': logged', false); return; }
    C.journeys.forEach(function (j) { j.steps.forEach(function (s, i) { if (C.guide.stepMatches(s, e)) hit.push(j.id + ' ' + (i + 1)); }); });
    eq(label + ' ticks', hit, journeyId ? [journeyId + ' ' + stepNo] : []);
  }

  /* 1. dispatch: only long-life stock is unexpired a month after the opening batches, so the sheet carries those lines */
  var r = act('u_sales', 'postDispatch', { routeId: 'R1', date: today, outlets: [{ customerId: 'O11', lines: [{ itemId: 'FG10', qty: 4 }] }, { customerId: 'O06', lines: [{ itemId: 'FG10', qty: 3 }] }] }, 'dispatch sheet of R1 for today');
  ticks(r, 'dispatch', 1, 'a sheet dated the business date');
  r = act('u_sales', 'postDispatch', { routeId: 'R2', date: D.addDays(today, -1), outlets: [{ customerId: 'O21', lines: [{ itemId: 'FG10', qty: 3 }] }] }, 'dispatch sheet of R2 for yesterday');
  ticks(r, null, 0, 'a sheet dated yesterday');

  /* 2. flour: an order at the latest price does not tick; above it does; then the receipt */
  var latest = HB.engine.price('RM01');
  r = act('u_stores', 'post', { type: 'PO', payload: { date: today, vendorId: 'VM01', lines: [{ itemId: 'RM01', qty: 100, rate: latest }] } }, 'flour order at the latest price');
  ticks(r, null, 0, 'an order at the latest price');
  var po = act('u_stores', 'post', { type: 'PO', payload: { date: today, vendorId: 'VM01', lines: [{ itemId: 'RM01', qty: 100, rate: latest + 150 }] } }, 'flour order at a higher rate');
  eq('ten bags stay within the limit: approved as submitted', po.ok && po.doc.status, 'APPROVED');
  ticks(po, 'flour', 1, 'an order above the latest price');
  var grn = act('u_stores', 'post', { type: 'GRN', payload: { date: today, poId: po.doc.id, lines: [{ itemId: 'RM01', qty: 100 }] } }, 'goods receipt of the flour');
  ticks(grn, 'flour', 2, 'the receipt with a maida line');
  eq('the receipt moves the latest price and the cost of sandwich bread', [HB.engine.price('RM01'), HB.engine.unitCost('FG01') > rs(COST.FG01[0])], [latest + 150, true]);
  ticks(po, 'flour', 1, 'the order, looked at again after its receipt changed the latest price');

  /* 3. bill: at the order rate it is posted and ticks nothing; at another rate it is held; approve; pay */
  var po2 = act('u_stores', 'post', { type: 'PO', payload: { date: today, vendorId: 'VM03', lines: [{ itemId: 'RM03', qty: 50, rate: HB.engine.price('RM03') }] } }, 'sugar order');
  var grn2 = act('u_stores', 'post', { type: 'GRN', payload: { date: today, poId: po2.doc.id, lines: [{ itemId: 'RM03', qty: 50 }] } }, 'goods receipt of the sugar');
  ticks(grn2, null, 0, 'a receipt without maida');
  r = act('u_accounts', 'post', { type: 'VBILL', payload: { date: today, vendorId: 'VM03', billNo: 'T-101', grnIds: [grn2.doc.id], lines: [{ itemId: 'RM03', qty: 50, rate: po2.doc.lines[0].rate }] } }, 'bill at the order rate');
  ticks(r, null, 0, 'a bill that passes the three-way check');
  var bill = act('u_accounts', 'post', { type: 'VBILL', payload: { date: today, vendorId: 'VM01', billNo: 'T-102', grnIds: [grn.doc.id], lines: [{ itemId: 'RM01', qty: 100, rate: latest + 400 }] } }, 'bill at a different rate');
  eq('the bill is held', bill.ok && bill.doc.status, 'HELD');
  ticks(bill, 'bill', 1, 'a bill that fails the three-way check');
  HB.session.set('u_accounts');
  eq('accounts cannot approve it', HB.engine.act('approve', { id: bill.doc.id }).ok, false);
  r = act('u_owner', 'approve', { id: bill.doc.id }, 'approval of the held bill');
  ticks(r, 'bill', 2, 'the Owner\'s approval of a bill');
  r = act('u_accounts', 'post', { type: 'PAY', payload: { date: today, payeeType: 'vendor', payeeId: 'VM01', account: 'bank', allocations: [{ docId: bill.doc.id, amount: bill.doc.total }] } }, 'payment of the bill');
  ticks(r, 'bill', 3, 'a payment allocated to a bill');

  /* 4. production */
  r = act('u_production', 'post', { type: 'PROD', payload: { date: today, itemId: 'FG05', mixes: 1, goodUnits: 74 } }, 'a run without rejects');
  ticks(r, null, 0, 'a run with no rejects');
  r = act('u_production', 'post', { type: 'PROD', payload: { date: today, itemId: 'FG01', mixes: 1, goodUnits: 176, rejectedUnits: 10 } }, 'a run with rejects');
  ticks(r, 'production', 1, 'a run with rejects');

  /* 5. store: transfer, confirm, day-end with expired units, write-off approved */
  r = act('u_stores', 'post', { type: 'XFER', payload: { date: today, toStoreId: 'st_anand', lines: [{ itemId: 'FG10', qty: 5 }] } }, 'transfer to the Anand store');
  ticks(r, null, 0, 'a transfer to another store');
  var x = act('u_stores', 'post', { type: 'XFER', payload: { date: today, toStoreId: 'st_vvn', lines: [{ itemId: 'FG10', qty: 5 }, { itemId: 'FG01', qty: 20 }] } }, 'transfer to the store manager\'s store');
  ticks(x, 'store', 1, 'a transfer to the store manager\'s store');
  r = act('u_store_mgr', 'receiveTransfer', { id: x.doc.id }, 'confirmation of the transfer');
  ticks(r, 'store', 2, 'the confirmation');
  /* the opening sandwich bread of the store went past its date in January: it is the expired line */
  var de = act('u_store_mgr', 'post', { type: 'DAYEND', payload: { date: today, storeId: 'st_vvn', cash: rs(152), upi: rs(380), lines: [{ itemId: 'FG01', sold: 14, expired: 11 }] } }, 'day-end with expired units');
  ticks(de, 'store', 3, 'a day-end with expired units');
  ok('the day-end raises its write-off, waiting for the Owner', de.ok && de.docs && de.docs.length === 2 && de.docs[1].type === 'WO' && de.docs[1].status === 'PENDING');
  var wo = act('u_stores', 'post', { type: 'WO', payload: { date: today, locId: 'fac_fg', reason: 'damaged', lines: [{ itemId: 'FG10', batchId: 'B-251224-FG10', qty: 2 }] } }, 'a write-off request at the factory');
  r = act('u_owner', 'approve', { id: wo.doc.id }, 'approval of the factory write-off');
  ticks(r, null, 0, 'approval of a write-off that no day-end raised');
  r = act('u_owner', 'approve', { id: de.docs[1].id }, 'approval of the day-end write-off');
  ticks(r, 'store', 4, 'approval of the write-off of a day-end');

  /* 6. return: a small one against today's supply is posted; one above the limit, or with no supply, is held */
  r = act('u_sales', 'post', { type: 'INV', payload: { date: today, customerId: 'O01', lines: [{ itemId: 'FG10', qty: 60 }] } }, 'further supply to an outlet');
  ticks(r, null, 0, 'an invoice');
  r = act('u_sales', 'post', { type: 'CN', payload: { date: today, customerId: 'O01', lines: [{ itemId: 'FG10', qty: 1 }] } }, 'a small return');
  eq('a return under the limit is posted', r.ok && r.doc.status, 'POSTED');
  ticks(r, null, 0, 'a return under the limit');
  var cn = act('u_sales', 'post', { type: 'CN', payload: { date: today, customerId: 'O11', lines: [{ itemId: 'FG10', qty: 2 }] } }, 'a return above the limit');
  eq('a return above the limit is held', cn.ok && [cn.doc.status, cn.doc.sharePct > C.limits.returnsPct], ['HELD', true]);
  ticks(cn, 'return', 1, 'a return above the limit');
  var cn2 = act('u_sales', 'post', { type: 'CN', payload: { date: today, customerId: 'O19', lines: [{ itemId: 'FG01', qty: 1 }] } }, 'a return from an outlet with no supply in the week');
  ticks(cn2, 'return', 1, 'a return held for want of supply');
  r = act('u_owner', 'approve', { id: cn.doc.id }, 'approval of the held return');
  ticks(r, 'return', 2, 'the Owner\'s approval of a return');

  /* 7. claim */
  r = act('u_accounts', 'post', { type: 'EXP', payload: { kind: 'bill', date: today, payeeId: 'VE23', categoryId: 'running', unitId: 'factory', amount: rs(2200), billRef: 'W-1' } }, 'an expense bill');
  ticks(r, null, 0, 'an expense bill');
  var billExp = r;
  var claim = act('u_store_mgr', 'post', { type: 'EXP', payload: { kind: 'claim', date: today, categoryId: 'running', unitId: 'st_vvn', amount: rs(450), billRef: 'CB-0001' } }, 'a claim by the store manager');
  eq('the claim is payable to the store manager', claim.ok && [claim.doc.payeeType, claim.doc.payeeId], ['employee', 'E032']);
  ticks(claim, 'claim', 1, 'a claim');
  r = act('u_owner', 'approve', { id: billExp.doc.id }, 'approval of the expense bill');
  ticks(r, null, 0, 'approval of an expense bill');
  r = act('u_owner', 'approve', { id: claim.doc.id }, 'approval of the claim');
  ticks(r, 'claim', 2, 'the Owner\'s approval of a claim');
  r = act('u_accounts', 'post', { type: 'PAY', payload: { date: today, payeeType: 'employee', payeeId: 'E032', account: 'bank', allocations: [{ docId: claim.doc.id, amount: claim.doc.total }] } }, 'reimbursement of the claim');
  ticks(r, 'claim', 3, 'a payment to an employee');

  /* 8. collect */
  r = act('u_accounts', 'post', { type: 'RCPT', payload: { date: today, customerId: 'O05', account: 'cash_factory', amount: rs(7700) } }, 'a receipt from an outlet');
  ticks(r, null, 0, 'a receipt from an outlet');
  r = act('u_accounts', 'post', { type: 'RCPT', payload: { date: today, customerId: 'C07', account: 'cash_factory', amount: rs(24000), allocations: [{ docId: HB.book.ar.open.C07[0].id, amount: rs(24000) }] } }, 'a receipt from a corporate');
  ticks(r, 'collect', 1, 'a receipt from a corporate');
  r = act('u_accounts', 'post', { type: 'DEP', payload: { date: today, fromAccount: 'cash_factory', amount: rs(30000), slipRef: 'DS-000001' } }, 'a cash deposit');
  ticks(r, 'collect', 2, 'a deposit');

  /* the book still stands after all of it, and a rebuild from the log gives the same entries their ticks */
  var before = HB.engine.log().length, ticked = 0;
  HB.engine.boot();
  eq('nothing is skipped when the copy is rebuilt from its log', [HB.engine.skipped.length, HB.engine.log().length], [0, before]);
  HB.engine.log().forEach(function (e) { C.journeys.forEach(function (j) { j.steps.forEach(function (s) { if (C.guide.stepMatches(s, e)) ticked++; }); }); });
  eq('every one of the 18 steps is ticked after the rebuild (journey 6 step 1 twice)', ticked, 19);
  HB.store.remove('log');
  HB.session.set('u_owner');
});

/* ====================================================== 13. calibration data */

section('Calibration bands as data (RESEARCH 13, 11.6)', function () {
  var B = C.calibration.bands, by = {};
  B.forEach(function (b) { by[b.n] = b; });
  eq('bands', B.map(function (b) { return b.n; }), D.range('2026-01-01', '2026-02-21').map(function (d, i) { return i + 1; }));
  ok('every band has a key, a measure and a unit', B.every(function (b) { return b.key && b.measure && b.unit; }));
  eq('band keys are used once', keys(B.reduce(function (o, b) { o[b.key] = 1; return o; }, {})).length, 52);
  ok('where a band has both ends, the lower is the smaller', B.every(function (b) { return b.min === undefined || b.max === undefined || b.min <= b.max; }));
  eq('business dates the self-check uses', C.calibration.dates, ['2026-10-02', '2027-04-01', '2027-12-31']);
  /* the figures of section 13, in rupees and percent as it prints them */
  eq('1-3 net sales, Rs crore', [by[1].min, by[1].max, by[2].min, by[2].max, by[3].min, by[3].max].map(function (p) { return p / 1e9; }), [3.84, 4.04, 4.00, 4.22, 2.88, 3.03]);
  eq('4-6', [by[4].tolerance, by[5].min / 100, by[5].max / 100, by[6].min / 100, by[6].max / 100], [0.03, 105000, 116000, 55000, 145000]);
  eq('7-8 shares', [by[7].parts, by[8].parts], [{ retail: [0.50, 0.54], corporate: [0.20, 0.23], store: [0.25, 0.28] }, { st_anand: [0.45, 0.49], st_vvn: [0.28, 0.32], st_nadiad: [0.21, 0.25] }]);
  eq('9-12 returns', [by[9].min, by[9].max, by[10].min, by[10].max, by[11].min, by[12].max], [0.034, 0.045, 0.046, 0.060, 0.95, 30]);
  eq('13-15 cost shares', [by[13].parts, by[14].parts, by[15].min, by[15].max], [{ '2026': [0.465, 0.50], '2027': [0.48, 0.515] }, { '2026': [0.475, 0.515], '2027': [0.495, 0.53] }, 0.45, 0.55]);
  eq('16-22', [by[16].above, by[17].min, by[17].max, by[18].min, by[18].max, by[19].min, by[19].max, by[20].min, by[20].max, by[21].min, by[21].max, by[22].min, by[22].max],
    [0, 0.001, 0.006, 0.007, 0.016, 0.001, 0.004, 0.985, 1.005, 0.88, 0.95, 0.09, 0.17]);
  eq('23-28 expenses and profit', [by[23].min, by[23].max, by[24].min, by[24].max, by[25].min, by[25].max, by[26].min, by[26].max, by[27].min, by[27].max, by[28].above],
    [0.215, 0.245, 0.155, 0.185, 0.085, 0.12, 0.065, 0.105, -0.04, 0.19, 0.04]);
  eq('29-38 balances, Rs', [by[29].min, by[29].max, by[34].min, by[34].max, by[36].min, by[36].max, by[37].min, by[37].max, by[38].min, by[38].max].map(function (p) { return p / 100; }),
    [750000, 1150000, 800000, 1350000, 450000, 750000, 120000, 260000, 10000, 25000]);
  eq('29-36 days', [by[29].days, by[30].days, by[34].days, by[36].days], [[6.5, 10], [24, 38], [15, 23], [8, 13]]);
  /* 33, 35 and 39 are read from the earliest business date a copy can have; 35 is a share of those days */
  eq('33, 35, 39 are read from the first possible business date', [by[33].from, by[35].from, by[39].from, HB.calendar.minDate], ['2026-02-01', '2026-02-01', '2026-02-01', '2026-02-01']);
  eq('35: a share of the days', [by[35].unit, by[35].min, by[35].above], ['fraction', 0.994, undefined]);
  /* 13 says "at each month end" on rows 36 and 37 and names no moment on row 38: the config reads it like the two rows above it (CONFIG choice 26) */
  eq('36-38 are tested at each month end', [by[36].every, by[37].every, by[38].every], ['month end', 'month end', 'month end']);
  /* a month end is a day-end figure, as the opening position is: Rs 7,400 + 3,600 + 3,900 at the three stores (10.4) */
  var storeOpening = sum(C.opening.stock, function (l) { return STORES.indexOf(l.locId) !== -1 ? l.qty * recipeCost(l.itemId, '2026-01') : 0; });
  near('the opening stock of the three stores, about Rs 14,900', storeOpening, rs(14900), rs(150));
  ok('and it lies inside band 38', storeOpening >= by[38].min && storeOpening <= by[38].max);
  /* a band that says what it is tested on uses one of these words; a new one must be added here and read by the self-check */
  var EVERY = ['month', 'year', 'quarter', 'day', 'open day', 'month end', 'product and month', '30-day window', 'open day and store', 'production entry'];
  eq('what a band is tested on: the words in use', B.filter(function (b) { return b.every !== undefined && EVERY.indexOf(b.every) === -1; }).map(function (b) { return b.n + ' ' + b.every; }), []);
  eq('32: C06 above its limit', [by[32].customerId, by[32].above], ['C06', CUST.C06.creditLimit]);
  eq('40-45 counts', [by[40].max, by[41].min, by[41].monthAverage, by[42].min, by[42].max, by[42].aboveLimit, by[43].min, by[44].min, by[44].max, by[45].min], [0, 1, [4, 12], 80, 120, [8, 13], 1, 2, 4, 1]);
  eq('48-51', [by[48].min / 100, by[48].max / 100, by[49].min / 100, by[49].max / 100, by[49].on, by[51].min, by[51].max], [5000, 90000, 6000000, 10000000, '2027-12-31', 640, 730]);
  /* the table of 11.6 */
  var M = C.calibration.months, Y = C.calibration.years;
  eq('months of 11.6', keys(M), S.prices.months);
  eq('a row: January 2026', [M['2026-01'].retailGross, M['2026-01'].staleReturns, M['2026-01'].corporates, M['2026-01'].stores, M['2026-01'].netSales, M['2026-01'].perDay, M['2026-01'].volumeFactor, M['2026-01'].cogsShare, M['2026-01'].materialShare, M['2026-01'].expenses, M['2026-01'].profitShare],
    [183900000, 6700000, 75900000, 93700000, 346800000, 11186400, 1, 0.469, 0.481, 124100000, 0.161]);
  ok('each month: net sales = retail gross - stale returns + corporates + own stores, to the rounding of the table', keys(M).every(function (m) {
    var r = M[m]; return Math.abs(r.retailGross - r.staleReturns + r.corporates + r.stores - r.netSales) <= 200000;
  }));
  ok('each month: net sales a day x days = net sales', keys(M).every(function (m) { return Math.abs(M[m].perDay * D.daysInMonth(m) - M[m].netSales) <= 100000; }));
  ['2026', '2027'].forEach(function (y) {
    ['retailGross', 'staleReturns', 'corporates', 'stores', 'netSales', 'expenses'].forEach(function (k) {
      near(y + ' ' + k + ': the months add up to the year', sum(keys(M), function (m) { return m.slice(0, 4) === y ? M[m][k] : 0; }), Y[y][k], 700000);
    });
  });
  near('1 January to 1 October 2026: Rs 2.95 crore', sum(keys(M), function (m) { return m <= '2026-09' ? M[m].netSales : 0; }) + M['2026-10'].perDay, 2950000000, 5000000);
  ok('the expected years lie inside bands 1 and 2', Y['2026'].netSales >= by[1].min && Y['2026'].netSales <= by[1].max && Y['2027'].netSales >= by[2].min && Y['2027'].netSales <= by[2].max);
  ok('the expected profit of each year lies inside bands 25 and 26', Y['2026'].profitShare >= by[25].min && Y['2026'].profitShare <= by[25].max && Y['2027'].profitShare >= by[26].min && Y['2027'].profitShare <= by[26].max);
  ok('the expected profit of every month lies inside band 27', keys(M).every(function (m) { return M[m].profitShare >= by[27].min && M[m].profitShare <= by[27].max; }));
  ok('the expected material cost of every month lies inside band 15', keys(M).every(function (m) { return M[m].materialShare >= by[15].min && M[m].materialShare <= by[15].max; }));
});

section('The config stays out of the way of the engine and the pages', function () {
  var copied = ['company', 'units', 'locations', 'accounts', 'items', 'recipes', 'routes', 'customers', 'vendors', 'employees', 'expenseCategories', 'users', 'limits', 'journeys'];
  eq('keys of HB.config', keys(C), copied.concat(['gstin', 'guide', 'opening', 'sim', 'calibration']));
  ok('HB.masters holds none of the simulation parameters', ['sim', 'calibration', 'opening'].every(function (k) { return HB.masters[k] === undefined; }));
  eq('HB.masters lists what the config lists', copied.slice(1, 11).map(function (k) { return HB.masters[k].length; }), copied.slice(1, 11).map(function (k) { return C[k].length; }));
  eq('the engine finds the staff vendor and the two system categories', [HB.masters.staffVendorId, HB.masters.salaryCategoryId, HB.masters.shortExcessCategoryId], ['VS01', 'salaries', 'cash_short']);
  ok('a master change does not write into the config', (function () {
    HB.store.remove('log'); HB.calendar.set('2026-02-01'); HB.engine.boot(); HB.session.set('u_accounts');
    var res = HB.engine.act('master', { entity: 'items', record: { id: 'FG01', price: { mrp: 4100 } } });
    var kept = ITEM.FG01.price.mrp === 3800 && res.ok && HB.masters.itemById.FG01.price.mrp === 4100;
    HB.store.remove('log'); HB.session.set('u_owner'); HB.engine.boot();
    return kept;
  })());
  /* the simulation functions are pure: the same arguments give the same answer, and they leave the config as it was */
  var snap = JSON.stringify(C);
  var a = [S.demand.retailFactor('O14', 'FG01', '2026-05-02', 'wet'), S.demand.storeFactor('st_vvn', 'FG16', '2027-11-01', 'dry'), S.demand.corporateFactor('C06', '2026-12-01'), S.stores.standingOn('st_vvn', '2026-05-02'), S.priceListOn('2027-05-01').FG16, S.expenses.billsOn('2026-04-01').length];
  var b = [S.demand.retailFactor('O14', 'FG01', '2026-05-02', 'wet'), S.demand.storeFactor('st_vvn', 'FG16', '2027-11-01', 'dry'), S.demand.corporateFactor('C06', '2026-12-01'), S.stores.standingOn('st_vvn', '2026-05-02'), S.priceListOn('2027-05-01').FG16, S.expenses.billsOn('2026-04-01').length];
  eq('the same arguments give the same answer', a, b);
  eq('and the config is unchanged by the calls of this check', JSON.stringify(C), snap);
  ok('the unit master keeps its base standing after a seasonal lookup', UNIT.st_vvn.standing.FG16 === 155);
});

/* ====================================================== report */

var failed = 0, checks = 0;
console.log('');
console.log('Happy Bakers - check of js/data/config.js against docs/RESEARCH.md');
console.log('');
sections.forEach(function (s) {
  checks += s.checks; failed += s.failures.length;
  console.log((s.failures.length ? 'FAIL  ' : 'ok    ') + s.title + '  (' + s.checks + ' checks' + (s.failures.length ? ', ' + s.failures.length + ' failed' : '') + ')');
  s.notes.forEach(function (n) { console.log('        ' + n); });
  s.failures.forEach(function (f) { console.log('        - ' + f); });
});
console.log('');
console.log(failed ? failed + ' of ' + checks + ' checks failed' : 'All ' + checks + ' checks passed in ' + sections.length + ' sections');
process.exit(failed ? 1 : 0);
