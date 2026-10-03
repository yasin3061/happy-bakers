/*
 * HB.seed: the business simulated day by day from go-live to a date, through HB.engine.core.
 * Every parameter is read from HB.config.sim (docs/CONFIG.md says where each lives); the timetable is SPEC 6
 * and the points of RESEARCH 14. Nothing here reads the clock, Math.random or the end of the run: a draw is
 * HB.rng keyed by the date and the entity, and the history to any day is the beginning of the history to a
 * later day (SPEC 5.4). Every document carries a synthetic time from the day's timetable, and the posting
 * order of a day follows that clock (the engine's opening entries open go-live at 00:00). The dated master
 * changes of a day are posted as the last step of the day before, so that a copy whose business date is a
 * revision date opens with the new list in force (RESEARCH 2.4).
 * The seed runs on every page load, so the daily loop works on small numeric tables built once: quantities
 * by index, plans remembered per day, one payload object per outlet reused every morning.
 */
(function (root) {
  'use strict';

  var HB = root.HB || (root.HB = {});
  var VERSION = '2026.10.03-1';

  var T = null;   /* the static tables, built once for a config */
  var st = null;  /* the state of the run in hand */
  var E, core, cfg, sim, book, M, D, q3, money;

  /* ------------------------------------------------------------ calendar */
  /* Days are numbers: index 0 is PRE days before go-live, so that a lag of a month looks back without a test. */

  var PRE = 45, SPAN = 45 + 731 + 130, I0 = PRE;
  var ISO = [], IDX = {}, DOW = [], MK = [], DOM = [], LAST = [], CLOSED = [], HOLIDAY = [];

  function idxOf(iso) {
    var i = IDX[iso];
    if (i === undefined) { i = PRE + D.diffDays(sim.calendar.goLive, iso); IDX[iso] = i; }
    return i;
  }

  function buildCalendar() {
    var goLive = sim.calendar.goLive, months = {}, i, iso, mk;
    for (i = 0; i < SPAN; i++) {
      iso = D.addDays(goLive, i - PRE);
      ISO.push(iso); IDX[iso] = i;
      mk = iso.slice(0, 7);
      MK.push(months[mk] || (months[mk] = mk));
      DOM.push(+iso.slice(8, 10));
      DOW.push(D.dow(iso));
      CLOSED.push(sim.calendar.isClosed(iso));
      HOLIDAY.push(sim.calendar.isFactoryHoliday(iso));
    }
    for (i = 0; i < SPAN; i++) LAST.push(i + 1 === SPAN || MK[i + 1] !== MK[i]);
  }

  /* --------------------------------------------------------------- helpers */

  /** Stochastic round: down, then up with probability equal to the fraction (RESEARCH conventions). */
  function sround(x, u) { var f = Math.floor(x); return u < x - f ? f + 1 : f; }

  function lerp(range, u) { return range[0] + (range[1] - range[0]) * u; }

  function stepUp(x, step) { return Math.ceil(x / step - 1e-9) * step; }

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function pad4(n) { var s = '' + n; while (s.length < 4) s = '0' + s; return s; }

  /** A timetable time 'THH:MM' moved on by some minutes. */
  function plusMinutes(t, minutes) {
    var mm = +t.slice(1, 3) * 60 + +t.slice(4, 6) + minutes;
    return 'T' + pad2(Math.floor(mm / 60)) + ':' + pad2(mm % 60);
  }

  /** The id and unit of every user, for the contexts. */
  function ctxOf(userId) {
    var u = cfg.users, i;
    for (i = 0; i < u.length; i++) if (u[i].id === userId) return { userId: userId, role: u[i].role, at: null, date: null, seed: true };
    throw new Error('HB.seed: no user ' + userId);
  }

  function at(ctx, time) { ctx.at = st.date + time; ctx.date = st.date; return ctx; }

  /**
   * The context of a store document: the store persona's, naming the store's own manager (sim.stores.manager, an
   * employee) as the one who entered it where that manager is not the persona. Display only: the rights and the
   * scope stay the persona's.
   */
  function storeCtx(sd) {
    var c = st.storeCtx[sd.idx];
    if (!c) {
      c = st.storeCtx[sd.idx] = ctxOf(sim.stores.userId);
      var mgr = sim.stores.manager[sd.id], me = null, i;
      for (i = 0; i < cfg.users.length; i++) if (cfg.users[i].id === sim.stores.userId) me = cfg.users[i].employeeId;
      c.as = mgr && mgr !== me ? mgr : null;
    }
    return c;
  }

  /** The context a claim row is raised in: a store claim by the store persona is that store's document. */
  function claimCtx(row) {
    if (row.userId === sim.stores.userId) for (var s = 0; s < T.stores.length; s++) if (T.stores[s].id === row.unitId) return storeCtx(T.stores[s]);
    return st.ctx[row.userId];
  }

  /** The result of a core call: the document, or null after recording the refusal (a seed never throws on one). */
  function must(res, what) {
    if (res && res.ok) return res.doc;
    st.stats.refusals.push({ date: st.date, what: what, code: res && res.error ? res.error.code : 'none', message: res && res.error ? res.error.message : '' });
    return null;
  }

  function zero(a) { for (var i = 0; i < a.length; i++) a[i] = 0; }
  function zeros(n) { var a = new Array(n), i; for (i = 0; i < n; i++) a[i] = 0; return a; }

  /* ---------------------------------------------------------- static tables */

  function buildStatic() {
    var i, j, k, it, c;
    T = { cfg: cfg };
    T.fg = []; T.fgIdx = {}; T.mat = []; T.matIdx = {};
    for (i = 0; i < cfg.items.length; i++) {
      it = cfg.items[i];
      if (it.kind === 'fg') { T.fgIdx[it.id] = T.fg.length; T.fg.push(it.id); }
      else { T.matIdx[it.id] = T.mat.length; T.mat.push({ id: it.id, vendorId: it.vendorId, leadDays: it.leadDays, reorderLevel: it.reorderLevel, orderQty: it.orderQty, kind: it.kind }); }
    }
    T.nfg = T.fg.length;
    T.group = []; T.rate = []; T.lag = [];
    for (k = 0; k < T.nfg; k++) {
      T.group.push(sim.demand.retailGroups.indexOf(sim.demand.groupOf[T.fg[k]]));
      T.rate.push(sim.returns.rate[T.fg[k]] || 0);
      T.lag.push(sim.returns.lagDays[T.fg[k]] || 0);
    }
    /* price lists by era: the opening list and each revision */
    T.eras = [{ from: idxOf(sim.calendar.goLive), list: sim.priceListOn(sim.calendar.goLive) }];
    for (i = 0; i < sim.priceRevisions.length; i++) T.eras.push({ from: idxOf(sim.priceRevisions[i].date), list: sim.priceListOn(sim.priceRevisions[i].date) });

    /* outlets in route stop order, each with its standing lines and a payload reused every morning */
    T.routes = []; T.outlets = []; T.outletStanding = zeros(T.nfg);
    var custById = {}, classes = {}, nClass = 0;
    for (i = 0; i < cfg.customers.length; i++) custById[cfg.customers[i].id] = cfg.customers[i];
    var off = 0;
    for (i = 0; i < cfg.routes.length; i++) {
      var rt = { id: cfg.routes[i].id, outlets: [], collectionDow: sim.collections.collectionDow[cfg.routes[i].id] };
      T.routes.push(rt);
      for (j = 0; j < cfg.routes[i].stops.length; j++) {
        c = custById[cfg.routes[i].stops[j]];
        if (!c || c.active === false || c.channel !== 'retail') continue;
        /*
         * The retail factor (CONFIG 4.4) depends on the outlet through its type and its place on the campus list,
         * and on the item through its group: outlets of one class share the day's factors. check-seed proves it.
         */
        var cls = (sim.outlets.info[c.id] ? sim.outlets.info[c.id].type : c.typeCode) + '|' + (sim.demand.campusOutlets.indexOf(c.id) !== -1 ? 1 : 0);
        if (classes[cls] === undefined) classes[cls] = nClass++;
        var o = { id: c.id, routeIdx: i, cls: classes[cls], lines: [], fi: [], std: [], grp: [], off: off, retFactor: sim.returns.outletFactor(c.id), terms: c.terms, weekly: c.terms === 'weekly' };
        for (k = 0; k < T.nfg; k++) {
          var q = c.standing ? c.standing[T.fg[k]] : 0;
          if (!(q > 0)) continue;
          o.lines.push({ itemId: T.fg[k], qty: 0 });
          o.fi.push(k); o.std.push(q); o.grp.push(T.group[k]);
          T.outletStanding[k] += q;
        }
        o.payload = { date: null, customerId: c.id, lines: o.lines, routeId: rt.id, sheetId: null };
        off += o.lines.length;
        rt.outlets.push(o); T.outlets.push(o);
      }
    }
    T.nlines = off;
    T.nClass = nClass;
    T.lags = [];
    for (k = 0; k < T.nfg; k++) if (T.rate[k] > 0 && T.lags.indexOf(T.lag[k]) === -1) T.lags.push(T.lag[k]);

    /* corporates in config order, delivery times from the van timetable */
    T.corps = []; T.corpIdx = {};
    var times = {}, v, tt;
    for (i = 0; i < sim.vehicles.length; i++) {
      v = sim.vehicles[i]; tt = v.timetable || [];
      for (j = 0; j < tt.length; j++) times[tt[j][0]] = tt[j][1];
    }
    for (k in sim.clock.arrivals) if (Object.prototype.hasOwnProperty.call(sim.clock.arrivals, k)) times[k] = times[k] || sim.clock.arrivals[k];
    for (i = 0; i < cfg.customers.length; i++) {
      c = cfg.customers[i];
      if (c.channel !== 'corporate' || c.active === false || !c.pattern) continue;
      var cp = { id: c.id, fi: [], typ: [], time: 'T' + (times[c.id] || sim.clock.dispatch), lines: [],
        late: sim.collections.corporate[c.id] ? sim.collections.corporate[c.id].latenessDays : 0,
        payDow: sim.collections.corporate[c.id] ? sim.collections.corporate[c.id].payDow : -1 };
      for (j = 0; j < c.pattern.lines.length; j++) {
        var l = c.pattern.lines[j];
        if (T.fgIdx[l.itemId] === undefined) continue;
        cp.fi.push(T.fgIdx[l.itemId]); cp.typ.push(l.qty); cp.lines.push({ itemId: l.itemId, qty: 0, price: 0 });
      }
      T.corpIdx[c.id] = T.corps.length;
      T.corps.push(cp);
    }
    T.weeklyOutlets = [];
    for (i = 0; i < T.outlets.length; i++) if (T.outlets[i].weekly) T.weeklyOutlets.push(T.outlets[i]);

    /* stores */
    T.stores = [];
    for (i = 0; i < sim.stores.ids.length; i++) {
      var sid = sim.stores.ids[i], unit = null;
      for (j = 0; j < cfg.units.length; j++) if (cfg.units[j].id === sid) unit = cfg.units[j];
      var sale = zeros(T.nfg), unsale = zeros(T.nfg);
      for (k = 0; k < T.nfg; k++) { sale[k] = sim.stores.sale[sid][T.fg[k]] || 0; unsale[k] = sim.stores.unsaleableRate[T.fg[k]] || 0; }
      T.stores.push({
        id: sid, locId: sid, transitLocId: 'transit_' + sid, cashId: 'cash_' + sid, idx: i,
        sale: sale, unsale: unsale, note: sim.stores.managerNote(sid),
        dayEndAt: 'T' + (sim.clock.dayEndAt[sid] || sim.clock.dayEnd), arrival: 'T' + (times[sid] || sim.clock.transfer),
        upiShare: sim.stores.upiShare[sid], lines: [], woLines: []
      });
    }
    /* the morning after loading: transfers out, deliveries and store confirmations in the order of the clock */
    T.morning = [];
    for (i = 0; i < T.stores.length; i++) T.morning.push({ kind: 0, idx: i, time: 'T' + sim.clock.transfer });
    for (i = 0; i < T.corps.length; i++) T.morning.push({ kind: 1, idx: i, time: T.corps[i].time });
    for (i = 0; i < T.stores.length; i++) T.morning.push({ kind: 2, idx: i, time: 'T' + sim.clock.transferConfirmed });
    T.morning.sort(function (a, b) { return a.time < b.time ? -1 : a.time > b.time ? 1 : a.kind - b.kind || a.idx - b.idx; });
    T.storeOrder = T.stores.slice().sort(function (a, b) { return a.dayEndAt < b.dayEndAt ? -1 : a.dayEndAt > b.dayEndAt ? 1 : a.idx - b.idx; });
    /* the opening orders of go-live are raised once the last van has made its morning delivery */
    T.goLiveOrders = plusMinutes(T.morning[T.morning.length - 1].time, 5);

    /* production: the recipe of each product by material index, the bad-run rules that concern it, a time slot */
    T.prod = [];
    var rec = {};
    for (i = 0; i < cfg.recipes.length; i++) rec[cfg.recipes[i].itemId] = cfg.recipes[i];
    for (k = 0; k < T.nfg; k++) {
      var p = sim.production.byItem[T.fg[k]], r = rec[T.fg[k]], pr = { id: T.fg[k], k: k, p: p, mats: [], pack: [], bad: [], slot: 'T' + pad2(16 + Math.floor(k * 5 / 60)) + ':' + pad2((k * 5) % 60) };
      if (r) {
        for (i = 0; i < r.materials.length; i++) pr.mats.push({ mi: T.matIdx[r.materials[i].itemId], qty: r.materials[i].qty });
        for (i = 0; i < (r.packing || []).length; i++) pr.pack.push({ mi: T.matIdx[r.packing[i].itemId], per: r.packing[i].qtyPerUnit });
      }
      for (i = 0; i < sim.production.badRuns.length; i++) {
        var br = sim.production.badRuns[i];
        if (br.id !== 'ovenFault' && br.items.indexOf(T.fg[k]) !== -1) pr.bad.push(br);
      }
      T.prod.push(pr);
    }
    T.ovenFault = null;
    for (i = 0; i < sim.production.badRuns.length; i++) if (sim.production.badRuns[i].id === 'ovenFault') T.ovenFault = sim.production.badRuns[i];
    T.flourMats = [];
    for (i = 0; i < sim.expenses.volumeFactor.items.length; i++) T.flourMats.push(T.matIdx[sim.expenses.volumeFactor.items[i]]);

    /* vendors: the materials each supplies, in order; which are paid in cash */
    T.vendors = []; T.vendorIdx = {};
    for (i = 0; i < cfg.vendors.length; i++) {
      v = cfg.vendors[i];
      if (v.kind !== 'stock') continue;
      var vd = { id: v.id, mats: [], termsDays: v.termsDays || 0, cash: sim.purchasing.cashVendors[v.id] || null, weekly: sim.purchasing.weeklyBilling.vendors.indexOf(v.id) !== -1,
        exception: sim.purchasing.exceptions[v.id] || null, occasional: sim.stories.heldBill.occasional.vendors.indexOf(v.id) !== -1,
        held: sim.stories.heldBill.weekly.vendorId === v.id, late: sim.purchasing.lateDays[v.id] || 0, billNo: billPrefix(v.name) };
      T.vendorIdx[v.id] = T.vendors.length;
      T.vendors.push(vd);
    }
    for (i = 0; i < T.mat.length; i++) { T.mat[i].vi = T.vendorIdx[T.mat[i].vendorId]; if (T.mat[i].vi !== undefined) T.vendors[T.mat[i].vi].mats.push(i); }
    T.expVendorTerms = {};
    for (i = 0; i < cfg.vendors.length; i++) T.expVendorTerms[cfg.vendors[i].id] = cfg.vendors[i].termsDays || 0;

    /* the employees who are paid claims */
    T.claimants = [];
    for (i = 0; i < sim.expenses.claims.rows.length; i++) {
      var e = sim.expenses.claims.rows[i].payeeEmployeeId;
      if (e && T.claimants.indexOf(e) === -1) T.claimants.push(e);
    }
    T.claimRows = sim.expenses.claims.rows;
    T.storeOf = {};
    for (i = 0; i < T.stores.length; i++) T.storeOf[T.stores[i].id] = i;

    /* the stock count rule as item lists */
    T.countGroups = [];
    var sc = sim.stockCount;
    [sc.packing, sc.flour, sc.bulk].forEach(function (g) {
      var mis = [];
      for (i = 0; i < g.items.length; i++) if (T.matIdx[g.items[i]] !== undefined) mis.push(T.matIdx[g.items[i]]);
      T.countGroups.push({ mis: mis, shortage: g.shortage, whole: !!g.whole });
    });
    T.countOthers = [];
    for (i = 0; i < T.mat.length; i++) {
      var inGroup = false;
      for (j = 0; j < T.countGroups.length; j++) if (T.countGroups[j].mis.indexOf(i) !== -1) inGroup = true;
      if (!inGroup && T.mat[i].kind === 'rm') T.countOthers.push(i);
    }
  }

  /** A bill-number prefix from the vendor's name: the initials of its first words. */
  function billPrefix(name) {
    var words = String(name).replace(/[^A-Za-z ]/g, ' ').split(/\s+/), out = '', i;
    for (i = 0; i < words.length && out.length < 4; i++) if (words[i]) out += words[i].charAt(0).toUpperCase();
    return out || 'V';
  }

  /* ------------------------------------------------------------- the state */

  function ring(n, make) { var a = [], i; for (i = 0; i < n; i++) a.push(make()); return a; }

  function newState(toIdx) {
    var s = {
      stats: { refusals: [], safetyNet: 0, days: 0, docs: 0 },
      i: 0, date: null, toIdx: toIdx,
      ctx: {}, storeCtx: [],
      avail: zeros(T.nfg), outflow: zeros(T.nfg), xferProj: zeros(T.nfg), classFactor: zeros(T.nClass * 3), lagIdx: zeros(T.nfg),
      payDay: [], openIdx: [],
      out14: ring(14, function () { return zeros(T.nfg); }),
      sold7: ring(7, function () { return zeros(T.stores.length * T.nfg); }),
      rPlan: ring(8, function () { return { day: -1, q: zeros(T.nlines), tot: zeros(T.nfg), rain: [] }; }),
      cPlan: ring(8, function () { return { day: -1, q: [], has: [], tot: zeros(T.nfg) }; }),
      sPlan: ring(8, function () { return { day: -1, q: zeros(T.stores.length * T.nfg), tot: zeros(T.nfg), rain: null }; }),
      stand: ring(8, function () { return { day: -1, q: [] }; }),
      rainDraw: ring(8, function () { return { day: -1, draw: 0 }; }),
      ret: ring(64, function () { return { day: -1, q: zeros(T.nlines), era: zeros(T.nfg) }; }),
      storePlan: [],          /* per store: the day-end and write-off planned in the morning */
      onOrder: zeros(T.mat.length),
      grnDue: {}, billDue: {}, payDue: {}, expDue: {}, soDue: {}, claimsDue: {}, seededBills: {},
      monthCons: {}, flourByMonth: {}, depositsByMonth: {},
      monthDone: null, countDone: null, bills: {}, billCount: {},
      standing: [],           /* per store: the standing map in force in the masters */
      dip: null
    };
    var i, j, k;
    for (i = 0; i < 8; i++) {
      for (j = 0; j < T.corps.length; j++) { s.cPlan[i].q.push(zeros(T.corps[j].fi.length)); s.cPlan[i].has.push(false); }
      for (j = 0; j < T.stores.length; j++) s.stand[i].q.push(zeros(T.nfg));
    }
    for (j = 0; j < T.stores.length; j++) {
      s.storePlan.push({ sold: zeros(T.nfg), expired: zeros(T.nfg), gross: 0, carry: zeros(T.nfg), oldest: new Array(T.nfg), oldestRem: zeros(T.nfg), dmg: zeros(T.nfg) });
      s.standing.push(null);
    }
    for (k = 0; k < T.vendors.length; k++) s.billCount[T.vendors[k].id] = 0;
    var users = cfg.users;
    for (i = 0; i < users.length; i++) s.ctx[users[i].id] = ctxOf(users[i].id);
    return s;
  }

  function listAt(map, idx) { return map[idx] || (map[idx] = []); }

  /* ------------------------------------------------------------- the plans */
  /* Each is a pure function of the date, remembered for the last eight days asked for. */

  function rainDrawOf(i) {
    var r = st.rainDraw[i & 7];
    if (r.day !== i) { r.day = i; r.draw = HB.rng('rain|' + ISO[i]).next(); }
    return r.draw;
  }

  function retailPlan(i) {
    var p = st.rPlan[i & 7];
    if (p.day === i) return p;
    p.day = i;
    var q = p.q, tot = p.tot, date = ISO[i], r, j, k, rt, o, rng, rain, f, g, n, fc = st.classFactor, fcRain = null, ci;
    zero(tot);
    if (CLOSED[i]) { zero(q); return p; }
    var draw = rainDrawOf(i), lo = sim.demand.noise.retail[0], hi = sim.demand.noise.retail[1];
    for (r = 0; r < T.routes.length; r++) {
      rt = T.routes[r];
      rain = sim.rain.kind(date, draw, rt.id);
      p.rain[r] = rain;
      if (rain !== fcRain) { fcRain = rain; for (k = 0; k < fc.length; k++) fc[k] = -1; }
      rng = HB.rng('dispatch|' + rt.id + '|' + date);
      for (j = 0; j < rt.outlets.length; j++) {
        o = rt.outlets[j];
        ci = o.cls * 3;
        for (k = 0; k < o.fi.length; k++) {
          g = ci + o.grp[k];
          /* one call per class of outlet and product group (see buildStatic) */
          f = fc[g];
          if (f < 0) f = fc[g] = sim.demand.retailFactor(o.id, o.lines[k].itemId, date, rain);
          n = sround(o.std[k] * f * rng.range(lo, hi), rng.next());
          q[o.off + k] = n;
          tot[o.fi[k]] += n;
        }
      }
    }
    return p;
  }

  /**
   * For the check: on a day, does every outlet line get the factor the config gives it outright? Returns the
   * number of lines whose class factor differs from a direct call (0 proves the class cache for that day).
   */
  function verifyClasses(date) {
    var i = idxOf(date), plan = retailPlan(i), bad = 0, r, j, k, o, rt, f, direct;
    if (CLOSED[i]) return 0;
    for (r = 0; r < T.routes.length; r++) {
      rt = T.routes[r];
      for (j = 0; j < rt.outlets.length; j++) {
        o = rt.outlets[j];
        for (k = 0; k < o.fi.length; k++) {
          direct = sim.demand.retailFactor(o.id, o.lines[k].itemId, date, plan.rain[r]);
          f = sim.demand.retailFactor(classRep(o.cls), o.lines[k].itemId, date, plan.rain[r]);
          if (Math.abs(direct - f) > 1e-12) bad++;
        }
      }
    }
    return bad;
  }

  /** The first outlet of a class: the one whose call filled the class factor. */
  function classRep(cls) {
    for (var r = 0; r < T.outlets.length; r++) if (T.outlets[r].cls === cls) return T.outlets[r].id;
    return null;
  }

  function corpPlan(i) {
    var p = st.cPlan[i & 7];
    if (p.day === i) return p;
    p.day = i;
    var date = ISO[i], c, j, cp, f, rng, noise, n, q;
    zero(p.tot);
    for (c = 0; c < T.corps.length; c++) {
      cp = T.corps[c]; q = p.q[c];
      f = CLOSED[i] ? 0 : sim.corporates.factor(cp.id, date);
      if (!(f > 0)) { p.has[c] = false; zero(q); continue; }
      rng = HB.rng('corp|' + cp.id + '|' + date);
      noise = rng.range(sim.corporates.noise[0], sim.corporates.noise[1]);
      p.has[c] = false;
      for (j = 0; j < cp.fi.length; j++) {
        n = sround(cp.typ[j] * f * noise, rng.next());
        q[j] = n;
        if (n > 0) { p.has[c] = true; p.tot[cp.fi[j]] += n; }
      }
    }
    return p;
  }

  function storePlan(i) {
    var p = st.sPlan[i & 7];
    if (p.day === i) return p;
    p.day = i;
    var date = ISO[i], s, k, sd, rng, g, f0, f1, f2, f3, f, n, q = p.q;
    zero(p.tot);
    if (CLOSED[i]) { zero(q); p.rain = 'dry'; return p; }
    var rain = sim.rain.kind(date, rainDrawOf(i)), lo = sim.stores.noise[0], hi = sim.stores.noise[1];
    p.rain = rain;
    for (s = 0; s < T.stores.length; s++) {
      sd = T.stores[s];
      rng = HB.rng('store|' + sd.id + '|' + date);
      f0 = f1 = f2 = f3 = -1;
      for (k = 0; k < T.nfg; k++) {
        if (!(sd.sale[k] > 0)) { q[s * T.nfg + k] = 0; continue; }
        g = T.group[k];
        if (g === 0) { if (f0 < 0) f0 = sim.demand.storeFactor(sd.id, T.fg[k], date, rain); f = f0; }
        else if (g === 1) { if (f1 < 0) f1 = sim.demand.storeFactor(sd.id, T.fg[k], date, rain); f = f1; }
        else if (g === 2) { if (f2 < 0) f2 = sim.demand.storeFactor(sd.id, T.fg[k], date, rain); f = f2; }
        else { if (f3 < 0) f3 = sim.demand.storeFactor(sd.id, T.fg[k], date, rain); f = f3; }
        n = sround(sd.sale[k] * f * rng.range(lo, hi), rng.next());
        q[s * T.nfg + k] = n;
        p.tot[k] += n;
      }
    }
    return p;
  }

  /** The standing quantities of every store on a day, as arrays by item index. */
  function standingOn(i) {
    var p = st.stand[i & 7];
    if (p.day === i) return p;
    p.day = i;
    var s, k, map;
    for (s = 0; s < T.stores.length; s++) {
      map = sim.stores.standingOn(T.stores[s].id, ISO[i]);
      for (k = 0; k < T.nfg; k++) p.q[s][k] = map[T.fg[k]] || 0;
    }
    return p;
  }

  function eraOf(i) {
    var e = T.eras.length - 1;
    while (e > 0 && T.eras[e].from > i) e--;
    return e;
  }

  /* ========================================================= the timetable */

  /* ---- 0. dated master changes (RESEARCH 14 point 7), entered on the morning of their date before the dispatch */

  /**
   * The changes dated day i. A day posts those of the NEXT day as its last step (go-live posts its own first),
   * so that a copy whose business date is a revision date opens with the new list in force (RESEARCH 2.4: a
   * new price applies to every document dated on or after its date). The rows keep their own date and morning
   * times, and the history to any day stays a prefix of the history to a later one: day i would have posted
   * the same rows first thing.
   */
  function masterChanges(i) {
    var date = ISO[i], j, k, rev, rs, rec, ids, ctx;
    function on(c, time) { c.at = date + time; c.date = date; return c; }
    for (j = 0; j < sim.priceRevisions.length; j++) {
      rev = sim.priceRevisions[j];
      if (rev.date !== date) continue;
      ctx = on(st.ctx[rev.userId] || st.ctx.u_accounts, 'T04:30');
      for (k in rev.prices) if (Object.prototype.hasOwnProperty.call(rev.prices, k)) {
        must(core.master('items', { id: k, price: rev.prices[k], changeNote: 'Price list revised: ' + rev.reason }, ctx), 'price revision ' + k);
      }
    }
    for (j = 0; j < sim.people.raises.length; j++) {
      rs = sim.people.raises[j];
      if (rs.date !== date) continue;
      ctx = on(st.ctx[rs.userId] || st.ctx.u_accounts, 'T04:35');
      ids = Object.keys(rs.salary);
      for (k = 0; k < ids.length; k++) must(core.master('employees', { id: ids[k], salary: rs.salary[ids[k]], changeNote: rs.note }, ctx), 'raise ' + ids[k]);
    }
    for (j = 0; j < sim.people.joiners.length; j++) {
      rec = sim.people.joiners[j];
      if (rec.doj !== date) continue;
      ctx = on(st.ctx[sim.people.userId], 'T04:40');
      var copy = {};
      for (k in rec) if (Object.prototype.hasOwnProperty.call(rec, k)) copy[k] = rec[k];
      copy.changeNote = 'Joined';
      must(core.master('employees', copy, ctx), 'joiner ' + rec.id);
    }
    if (CLOSED[i]) return;
    /* the seasonal puff standing: the master changes on the day it differs from the day before */
    var stand = standingOn(i).q, s, unit, cur, diff, map;
    for (s = 0; s < T.stores.length; s++) {
      unit = M.unitById[T.stores[s].id];
      cur = unit.standing || {};
      diff = false;
      for (k = 0; k < T.nfg; k++) if ((cur[T.fg[k]] || 0) !== stand[s][k]) { diff = true; break; }
      if (!diff) continue;
      map = {};
      for (k = 0; k < T.nfg; k++) if (stand[s][k] > 0) map[T.fg[k]] = stand[s][k];
      ctx = on(st.ctx[sim.stores.puffStanding.changedBy] || st.ctx.u_accounts, 'T04:45');
      must(core.master('locations', { id: T.stores[s].id, standing: map }, ctx), 'standing ' + T.stores[s].id);
    }
  }

  /** Leavers: the date of leaving is recorded and the directory shows them inactive from the next day. */
  function leavers() {
    var j, lv, ctx;
    for (j = 0; j < sim.people.leavers.length; j++) {
      lv = sim.people.leavers[j];
      if (lv.dol !== st.date) continue;
      ctx = at(st.ctx[sim.people.userId], 'T18:15');
      must(core.master('employees', { id: lv.id, dol: lv.dol, changeNote: 'Left' }, ctx), 'leaver ' + lv.id);
      must(core.setActive('employees', lv.id, false, ctx), 'leaver inactive ' + lv.id);
    }
  }

  /* ---- 1. the Owner clears everything left pending from the day before (the held weekly bill waits a week) */

  function approvals(i) {
    var ctx = at(st.ctx[sim.approvals.userId], 'T05:00'), id, d, wo = [], adj = [], rest = [], j, w = sim.stories.heldBill.weekly, cl = sim.expenses.claims;
    for (id in book.pending) {
      if (!Object.prototype.hasOwnProperty.call(book.pending, id)) continue;
      d = book.pending[id];
      if (d.type === 'WO') wo.push(d); else if (d.type === 'ADJ') adj.push(d); else rest.push(d);
    }
    /* write-offs before counts: a count may not take off what a waiting write-off holds */
    for (j = 0; j < wo.length; j++) must(core.approve(wo[j].id, ctx), 'approve ' + wo[j].id);
    for (j = 0; j < adj.length; j++) must(core.approve(adj[j].id, ctx), 'approve ' + adj[j].id);
    for (j = 0; j < rest.length; j++) {
      d = rest[j];
      if (d.type === 'VBILL' && d.vendorId === w.vendorId && idxOf(w.releaseDate(d.date)) > i) continue;
      if (d.type === 'EXP' && d.kind === 'claim' && HB.rng('claim-review|' + d.id).next() < cl.rejectShare) {
        must(core.reject(d.id, cl.rejectReasons[HB.rng('claim-reason|' + d.id).int(0, cl.rejectReasons.length - 1)], ctx), 'reject ' + d.id);
        continue;
      }
      must(core.approve(d.id, ctx), 'approve ' + d.id);
    }
  }

  /* ---- 2. every expired batch still in the finished store goes on one write-off, before dispatch */

  function factoryExpired() {
    var byItem = book.lots.fac_fg, lines = [], k, lots, j, lot, free;
    for (k = 0; k < T.nfg; k++) {
      lots = byItem[T.fg[k]];
      if (!lots) continue;
      for (j = 0; j < lots.length; j++) {
        lot = lots[j];
        if (lot.bestBefore >= st.date) break;
        free = lot.qty - lot.reserved;
        if (free > 0) lines.push({ itemId: T.fg[k], batchId: lot.batchId, qty: free });
      }
    }
    if (lines.length) must(core.wo({ date: st.date, locId: 'fac_fg', reason: 'expired', lines: lines, note: 'Past best-before in the finished goods store' }, at(st.ctx[sim.purchasing.userId], 'T05:15')), 'factory write-off');
  }

  /* ---- 3. dispatch: one invoice per outlet under the sheet id, then the stale returns due today */

  function availFG(i) {
    var k, avail = st.avail, date = ISO[i];
    for (k = 0; k < T.nfg; k++) avail[k] = E.available('fac_fg', T.fg[k], date);
  }

  function dispatch(i) {
    var date = st.date, plan = retailPlan(i), q = plan.q, avail = st.avail, ctx = at(st.ctx.u_sales, 'T' + sim.clock.dispatch);
    var r, j, k, rt, o, n, any, doc, rng, rain, season, ret, slot, noteIdx, era, lagIdx = st.lagIdx, lines, byLag = {};
    /* the note date of each lag once: the day the returns of today's drop are raised */
    for (k = 0; k < T.nfg; k++) {
      if (!(T.rate[k] > 0)) { lagIdx[k] = -1; continue; }
      if (byLag[T.lag[k]] === undefined) byLag[T.lag[k]] = idxOf(sim.returns.noteDate(T.fg[k], date));
      lagIdx[k] = byLag[T.lag[k]];
    }
    for (r = 0; r < T.routes.length; r++) {
      rt = T.routes[r];
      rain = plan.rain[r];
      season = sim.returns.seasonFactorOn(date, rain);
      rng = HB.rng('returns|' + rt.id + '|' + date);
      for (j = 0; j < rt.outlets.length; j++) {
        o = rt.outlets[j];
        any = false;
        for (k = 0; k < o.fi.length; k++) {
          n = q[o.off + k];
          if (n > avail[o.fi[k]]) n = avail[o.fi[k]];
          o.lines[k].qty = n;
          if (n > 0) any = true;
        }
        if (!any) continue;
        o.payload.date = date; o.payload.sheetId = st.sheetIds[r];
        doc = must(core.inv(o.payload, ctx), 'dispatch ' + o.id);
        if (!doc) continue;
        for (k = 0; k < o.fi.length; k++) {
          n = o.lines[k].qty;
          if (n === 0) continue;
          avail[o.fi[k]] -= n;
          st.outflow[o.fi[k]] += n;
          /* the stale returns of this drop, drawn now and raised on the note date */
          if (T.rate[o.fi[k]] > 0) {
            ret = sround(n * T.rate[o.fi[k]] * o.retFactor * season, rng.next());
            if (ret > 0) {
              noteIdx = lagIdx[o.fi[k]];
              slot = st.ret[noteIdx & 63];
              if (slot.day !== noteIdx) { slot.day = noteIdx; zero(slot.q); for (era = 0; era < T.nfg; era++) slot.era[era] = -1; }
              slot.q[o.off + k] += ret;
              if (slot.era[o.fi[k]] < 0) slot.era[o.fi[k]] = eraOf(i);
            }
          }
        }
      }
    }
    /* stale returns from earlier deliveries, one note per outlet, at the price of the invoice it reverses */
    slot = st.ret[i & 63];
    if (slot.day !== i) return;
    for (r = 0; r < T.routes.length; r++) {
      rt = T.routes[r];
      for (j = 0; j < rt.outlets.length; j++) {
        o = rt.outlets[j];
        lines = null;
        for (k = 0; k < o.fi.length; k++) {
          n = slot.q[o.off + k];
          if (n === 0) continue;
          if (!lines) lines = [];
          era = slot.era[o.fi[k]];
          lines.push({ itemId: o.lines[k].itemId, qty: n, price: T.eras[era < 0 ? eraOf(i) : era].list[o.lines[k].itemId].retail });
        }
        if (lines) must(core.cn({ date: date, customerId: o.id, lines: lines, note: 'Stale returns picked up on the route' }, ctx), 'return ' + o.id);
      }
    }
  }

  /* ---- 4 and 5. corporate deliveries, store transfers (cut to stock) and the store's confirmation, in clock order */

  function morningRun(i) {
    var date = st.date, avail = st.avail, j, k, c, s, cp, sd, so, doc, sheet, line, n, cut, lines, ev, ctx;
    /* what each corporate gets today: its open order, cut to the stock left after the routes */
    var due = st.soDue[i] || [], corpCut = {}, short;
    for (j = 0; j < due.length; j++) {
      so = book.docs[due[j]];
      if (!so || so.status !== 'OPEN') continue;
      cut = []; short = false;
      for (k = 0; k < so.lines.length; k++) {
        line = so.lines[k];
        n = line.qty;
        if (n > avail[T.fgIdx[line.itemId]]) { n = avail[T.fgIdx[line.itemId]]; short = true; }
        cut.push({ itemId: line.itemId, qty: n });
        avail[T.fgIdx[line.itemId]] -= n;
        st.outflow[T.fgIdx[line.itemId]] += n;
      }
      /* with the stock there, the order is invoiced as it stands; cut, the invoice carries its own lines at the order's prices */
      corpCut[so.customerId] = { so: so, lines: short ? cut : null };
    }
    delete st.soDue[i];
    /* the transfer of each store: the engine's sheet, cut to what is left */
    var xfer = [];
    for (s = 0; s < T.stores.length; s++) {
      sd = T.stores[s];
      sheet = E.transferSheet(sd.id, date);
      lines = sd.lines; lines.length = 0;
      if (sheet.ok) {
        for (j = 0; j < sheet.lines.length; j++) {
          line = sheet.lines[j];
          n = line.qty;
          k = T.fgIdx[line.itemId];
          if (n > avail[k]) n = avail[k];
          if (n <= 0) continue;
          lines.push({ itemId: line.itemId, qty: n });
          avail[k] -= n;
          st.outflow[k] += n;
        }
      }
      xfer.push(null);
    }
    for (j = 0; j < T.morning.length; j++) {
      ev = T.morning[j];
      if (ev.kind === 0) {
        sd = T.stores[ev.idx];
        if (!sd.lines.length) continue;
        doc = must(core.xfer({ date: date, toStoreId: sd.id, lines: sd.lines }, at(st.ctx[sim.purchasing.userId], ev.time)), 'transfer ' + sd.id);
        xfer[ev.idx] = doc;
      } else if (ev.kind === 1) {
        cp = T.corps[ev.idx];
        c = corpCut[cp.id];
        if (!c) continue;
        ctx = at(st.ctx[sim.corporates.userId], ev.time);
        var any = true;
        if (c.lines) { any = false; for (k = 0; k < c.lines.length; k++) if (c.lines[k].qty > 0) any = true; }
        if (!any) continue;
        must(core.inv(c.lines ? { date: date, customerId: cp.id, soId: c.so.id, lines: c.lines } : { date: date, customerId: cp.id, soId: c.so.id }, ctx), 'delivery ' + cp.id);
      } else {
        doc = xfer[ev.idx];
        if (doc) must(core.receiveTransfer(doc.id, at(storeCtx(T.stores[ev.idx]), ev.time)), 'confirm ' + doc.id);
      }
    }
  }

  /**
   * The sales orders for the next open day, placed the day before (the last open day before delivery). On
   * go-live the orders of the day itself are placed first thing, since the day before is before the books.
   */
  function salesOrders(i, forToday) {
    var n1 = forToday ? i : i + 1;
    while (CLOSED[n1]) n1++;
    if (!forToday && idxOf(sim.corporates.orderDate(ISO[n1])) !== i) return;
    var plan = corpPlan(n1), list = listAt(st.soDue, n1), c, cp, j, lines, ctx = at(st.ctx[sim.corporates.userId], forToday ? 'T04:50' : 'T12:30'), doc, era = T.eras[eraOf(n1)].list, q;
    for (c = 0; c < T.corps.length; c++) {
      if (!plan.has[c]) continue;
      cp = T.corps[c]; q = plan.q[c]; lines = [];
      for (j = 0; j < cp.fi.length; j++) if (q[j] > 0) lines.push({ itemId: cp.lines[j].itemId, qty: q[j], price: era[cp.lines[j].itemId].corporate });
      doc = must(core.so({ date: st.date, customerId: cp.id, deliveryDate: ISO[n1], poRef: sim.corporates.poRef(cp.id, ISO[n1]), lines: lines }, ctx), 'order ' + cp.id);
      if (doc) list.push(doc.id);
    }
  }

  /* ---- the stores: what each will sell, lose and keep today, planned once the transfers are in */

  function planStores(i) {
    var date = st.date, d1 = ISO[i + 1], sp = storePlan(i), s, k, sd, pl, lots, j, lot, free, want, left, take, rem, sold, expired, carry, oldest, oldestRem, byItem, wo, rng, q7, sold7, m, stand;
    var writeOffDay = !CLOSED[i] && sim.stores.isWriteOffDay(date), s7 = st.sold7[i % 7];
    zero(st.xferProj);
    stand = standingOn(i + 1).q;
    for (s = 0; s < T.stores.length; s++) {
      sd = T.stores[s]; pl = st.storePlan[s]; byItem = book.lots[sd.locId];
      pl.gross = 0;
      rng = writeOffDay ? HB.rng('damaged|' + sd.id + '|' + date) : null;
      for (k = 0; k < T.nfg; k++) {
        want = CLOSED[i] ? 0 : sp.q[s * T.nfg + k];
        lots = byItem[T.fg[k]];
        left = want; sold = 0; expired = 0; carry = 0; oldest = null; oldestRem = 0;
        if (lots) {
          for (j = 0; j < lots.length; j++) {
            lot = lots[j];
            free = lot.qty - lot.reserved;
            if (free <= 0) continue;
            if (lot.bestBefore < date) { expired += free; continue; }
            take = left < free ? left : free;
            left -= take; sold += take; rem = free - take;
            if (lot.bestBefore === date) expired += rem;
            else if (rem > 0) { carry += rem; if (oldest === null) { oldest = lot.batchId; oldestRem = rem; } }
          }
        }
        pl.sold[k] = sold; pl.expired[k] = CLOSED[i] ? 0 : expired;
        pl.gross += sold * M.itemById[T.fg[k]].price.mrp;
        s7[s * T.nfg + k] = sold;
        /* the weekly request for squashed and broken packs: a share of seven days' sales, from the oldest batch on the shelf */
        wo = 0;
        if (writeOffDay && sd.unsale[k] > 0) {
          sold7 = 0;
          for (m = 0; m < 7; m++) sold7 += st.sold7[m][s * T.nfg + k];
          wo = sround(sold7 * sd.unsale[k], rng.next());
          if (wo > oldestRem) wo = oldestRem;
        }
        pl.dmg[k] = wo; pl.oldest[k] = oldest;
        carry -= wo;
        st.xferProj[k] += stand[s][k] > carry ? stand[s][k] - carry : 0;
      }
    }
  }

  /* ---- 11. the day-end of each store at closing, with the expired units; the Sunday write-offs once every till is closed */

  function dayEnds(i) {
    var date = st.date, s, sd, pl, k, lines, rng, gross, upi, cash, diff, u, ctx, cs = sim.stories.cashShort, aw = cs.anywhere;
    var writeOffDay = sim.stores.isWriteOffDay(date);
    for (s = 0; s < T.storeOrder.length; s++) {
      sd = T.storeOrder[s]; pl = st.storePlan[sd.idx];
      lines = [];
      for (k = 0; k < T.nfg; k++) if (pl.sold[k] > 0 || pl.expired[k] > 0) lines.push({ itemId: T.fg[k], sold: pl.sold[k], expired: pl.expired[k] });
      gross = pl.gross;
      rng = HB.rng('till|' + sd.id + '|' + date);
      u = rng.range(-sim.stores.upiNoise, sim.stores.upiNoise);
      upi = Math.round(gross * sd.upiShare * (1 + u) / 100) * 100;
      if (upi > gross) upi = gross;
      /* the Tuesday shortage at S3 by its rule; elsewhere (the other stores) a small difference now and then */
      diff = 0;
      if (gross > 0) {
        if (sd.id === cs.storeId) { if (cs.on(date)) diff = -Math.round(rng.range(cs.amount[0], cs.amount[1]) / cs.roundTo) * cs.roundTo; }
        else if (rng.next() < aw.chance) {
          diff = Math.round(rng.range(aw.amount[0], aw.amount[1]) / aw.roundTo) * aw.roundTo;
          if (rng.next() < aw.shortShare) diff = -diff;
        }
      }
      cash = gross - upi + diff;
      if (cash < 0) cash = 0;
      ctx = at(storeCtx(sd), sd.dayEndAt);
      must(core.dayend({ date: date, storeId: sd.id, cash: cash, upi: upi, lines: lines, note: sd.note }, ctx), 'day-end ' + sd.id);
    }
    if (!writeOffDay) return;
    /* the squashed and broken packs of the week, one write-off per store, after the last till of the evening */
    for (s = 0; s < T.storeOrder.length; s++) {
      sd = T.storeOrder[s]; pl = st.storePlan[sd.idx];
      lines = [];
      for (k = 0; k < T.nfg; k++) if (pl.dmg[k] > 0 && pl.oldest[k]) lines.push({ itemId: T.fg[k], batchId: pl.oldest[k], qty: pl.dmg[k] });
      if (lines.length) must(core.wo({ date: date, locId: sd.locId, reason: sim.stores.writeOff.reason, lines: lines, note: 'Squashed, dried or broken packs' + (sd.note ? '. ' + sd.note : '') }, at(storeCtx(sd), 'T21:10')), 'damaged ' + sd.id);
    }
  }

  /* ---- 6. goods receipts for the orders due this morning, before production */

  function receipts(i) {
    var list = st.grnDue[i];
    if (!list) return;
    var j, k, task, po, doc, ctx = at(st.ctx[sim.purchasing.userId], 'T08:45'), vd, occ = sim.stories.heldBill.occasional, rng, over, mi;
    for (j = 0; j < list.length; j++) {
      task = list[j];
      po = book.docs[task.poId];
      if (!po || (po.status !== 'APPROVED' && po.status !== 'PART_RECEIVED')) { st.stats.refusals.push({ date: st.date, what: 'receipt against ' + task.poId, code: 'wrong_state', message: po ? po.status : 'missing' }); continue; }
      doc = must(core.grn({ date: st.date, poId: task.poId, lines: task.lines, note: task.note || '' }, ctx), 'receipt ' + task.poId);
      if (!doc) continue;
      vd = T.vendors[task.vi];
      for (k = 0; k < task.lines.length; k++) {
        mi = T.matIdx[task.lines[k].itemId];
        st.onOrder[mi] = q3(st.onOrder[mi] - task.lines[k].qty);
        if (st.onOrder[mi] < 0) st.onOrder[mi] = 0;
      }
      if (vd.weekly) continue;
      /* the bill, entered the day after: one receipt in forty from some vendors is billed at next month's price */
      over = null;
      if (vd.occasional) {
        rng = HB.rng('bill-b|' + doc.id);
        if (rng.next() < occ.chance) over = { k: rng.int(0, doc.lines.length - 1), u: rng.range(occ.over[0], occ.over[1]) };
      }
      listAt(st.billDue, idxOf(sim.purchasing.billDate(st.date))).push({ grnId: doc.id, vi: task.vi, over: over });
    }
    delete st.grnDue[i];
  }

  /* ---- 9. vendor bills: one per receipt the day after; the weekly vendors on their bill day */

  function nextBillNo(vd, date) {
    var n = ++st.billCount[vd.id], y = +date.slice(0, 4), m = +date.slice(5, 7), fy = m >= 4 ? y : y - 1;
    return vd.billNo + '/' + String(fy).slice(2) + '-' + String(fy + 1).slice(2) + '/' + pad4(n);
  }

  function vendorBills(i) {
    var date = st.date, ctx = at(st.ctx[sim.purchasing.billedBy], 'T10:30'), list = st.billDue[i], j, k, task, grn, vd, lines, l, rate, doc;
    if (list) {
      for (j = 0; j < list.length; j++) {
        task = list[j]; grn = book.docs[task.grnId]; vd = T.vendors[task.vi];
        if (!grn || grn.status !== 'POSTED' || grn.billId) continue;
        lines = [];
        for (k = 0; k < grn.lines.length; k++) {
          l = grn.lines[k];
          if (!(l.qty > 0)) continue;
          rate = l.rate;
          if (task.over && task.over.k === k) rate = Math.round(rate * (1 + task.over.u) * 100) / 100;
          lines.push({ itemId: l.itemId, qty: l.qty, rate: rate });
        }
        if (!lines.length) continue;
        doc = must(core.vbill({ date: date, vendorId: vd.id, billNo: nextBillNo(vd, date), grnIds: [grn.id], lines: lines, note: task.over ? sim.stories.heldBill.occasional.note : '' }, ctx), 'bill ' + grn.id);
        if (doc) schedulePay(doc, vd);
      }
      delete st.billDue[i];
    }
    if (!sim.purchasing.weeklyBilling.isBillDay(date)) return;
    var period = sim.purchasing.weeklyBilling.periodOf(date), from = period[0], to = period[1], w = sim.stories.heldBill.weekly, v, unbilled, byItem, order, ids, it, g, gl, b, rng, u, overId;
    for (v = 0; v < T.vendors.length; v++) {
      vd = T.vendors[v];
      if (!vd.weekly) continue;
      unbilled = book.unbilled[vd.id] || [];
      byItem = {}; order = []; ids = [];
      for (j = 0; j < unbilled.length; j++) {
        g = unbilled[j];
        if (g.date < from || g.date > to || g.billId) continue;
        ids.push(g.id);
        for (k = 0; k < g.lines.length; k++) {
          gl = g.lines[k];
          if (!(gl.qty > 0)) continue;
          b = byItem[gl.itemId];
          if (!b) { b = byItem[gl.itemId] = { qty: 0, value: 0 }; order.push(gl.itemId); }
          b.qty = q3(b.qty + gl.qty); b.value += money.amount(gl.qty, gl.rate);
        }
      }
      if (!ids.length) continue;
      lines = [];
      overId = null;
      if (vd.held) overId = byItem[w.itemId] ? w.itemId : (byItem[w.elseItemId] ? w.elseItemId : order[0]);
      rng = vd.held ? HB.rng('bill-a|' + vd.id + '|' + date) : null;
      for (k = 0; k < order.length; k++) {
        it = order[k]; b = byItem[it];
        rate = Math.round(b.value / b.qty * 100) / 100;
        if (it === overId) { u = rng.range(w.over[0], w.over[1]); rate = Math.round(rate * (1 + u) / w.roundTo) * w.roundTo; }
        lines.push({ itemId: it, qty: b.qty, rate: rate });
      }
      doc = must(core.vbill({ date: date, vendorId: vd.id, billNo: nextBillNo(vd, date), grnIds: ids, lines: lines, note: vd.held ? 'Weekly bill at the mandi rate of the bill day' : 'Weekly bill' }, ctx), 'weekly bill ' + vd.id);
      if (doc) schedulePay(doc, vd);
    }
  }

  /** Is the day a payment day (Monday, Thursday, moved off a closed day)? The config's answer, kept per day. */
  function payDay(idx) {
    var v = st.payDay[idx];
    if (v === undefined) v = st.payDay[idx] = sim.purchasing.isPaymentDay(ISO[idx]);
    return v;
  }

  function nextOpenIdx(idx) { while (CLOSED[idx]) idx++; return idx; }

  /**
   * The day a bill is paid, as purchasing.payDate gives it: the cash vendors on the due date (the next open
   * day if closed), the others on the first payment day on or after due date + their lateness. Worked out on
   * the day table so that the config's day test runs once per day, not once per bill.
   */
  function payIdxOf(vd, dueDate) {
    var idx = idxOf(dueDate);
    if (vd.cash) return nextOpenIdx(idx);
    idx += vd.late;
    while (!payDay(idx)) idx++;
    return idx;
  }

  function schedulePay(bill, vd) {
    listAt(st.payDue, payIdxOf(vd, bill.dueDate)).push(bill.id);
  }

  /* ---- 10. payments twice a week, the cash vendors on their due date; receipts by the customers' terms */

  function payments(i) {
    var date = st.date, ctx = at(st.ctx[sim.expenses.userId], 'T11:30'), j, k, v, vd, s, list, doc, allocs, sum, byPayee, keys, p, open, bal;
    /* the opening bills, by the dates RESEARCH 10.3 gives */
    for (v = 0; v < T.vendors.length; v++) {
      vd = T.vendors[v];
      s = sim.openingSettlement.payables[vd.id];
      if (!s) continue;
      for (j = 0; j < s.length; j++) {
        if (s[j].date !== date) continue;
        open = book.ap.open['vendor:' + vd.id] || [];
        for (k = 0; k < open.length; k++) if (open[k].opening && open[k].type === 'VBILL') {
          sum = Math.round(open[k].total * s[j].share);
          if (sum > open[k].total - open[k].paid) sum = open[k].total - open[k].paid;
          if (sum > 0) must(core.pay({ date: date, payeeType: 'vendor', payeeId: vd.id, account: s[j].account || 'bank', allocations: [{ docId: open[k].id, amount: sum }], ref: 'Opening balance' }, ctx), 'opening payment ' + vd.id);
        }
      }
    }
    /* the bills whose pay date is today, one payment per vendor */
    list = st.payDue[i];
    if (list) {
      byPayee = {}; keys = [];
      for (j = 0; j < list.length; j++) {
        doc = book.docs[list[j]];
        if (!doc || doc.status !== 'POSTED' || doc.total - doc.paid <= 0) continue;
        p = byPayee[doc.vendorId];
        if (!p) { p = byPayee[doc.vendorId] = { allocs: [], sum: 0 }; keys.push(doc.vendorId); }
        p.allocs.push({ docId: doc.id, amount: doc.total - doc.paid });
        p.sum += doc.total - doc.paid;
      }
      for (j = 0; j < keys.length; j++) {
        vd = T.vendors[T.vendorIdx[keys[j]]];
        p = byPayee[keys[j]];
        must(core.pay({ date: date, payeeType: 'vendor', payeeId: keys[j], account: vd.cash || 'bank', allocations: p.allocs, ref: vd.cash ? 'Cash' : 'NEFT' }, ctx), 'payment ' + keys[j]);
      }
      delete st.payDue[i];
    }
  }

  /* ---- receipts: the weekly outlets when the vans are back (09:00), the corporates at midday, the opening invoices by their dates */

  /**
   * What a party pays today, or null: its opening invoice by the settlement rows dated today (RESEARCH 10.2)
   * and, when `pays`, every other open invoice for which `due` holds, in full.
   */
  function receiptOf(partyId, pays, due) {
    var date = st.date, rows = sim.openingSettlement.receivables[partyId], settles = false, open, k, c, inv, part, allocs = null, sum = 0;
    if (rows) for (c = 0; c < rows.length; c++) if (rows[c].date === date) settles = true;
    if (!pays && !settles) return null;
    open = book.ar.open[partyId] || [];
    for (k = 0; k < open.length; k++) {
      inv = open[k];
      if (inv.opening) {
        if (settles) for (c = 0; c < rows.length; c++) if (rows[c].date === date) {
          part = Math.round(inv.total * rows[c].share);
          if (part > E.openAmount(inv)) part = E.openAmount(inv);
          if (part > 0) { if (!allocs) allocs = []; allocs.push({ docId: inv.id, amount: part }); sum += part; }
        }
      } else if (pays && due(inv)) {
        if (!allocs) allocs = [];
        allocs.push({ docId: inv.id, amount: E.openAmount(inv) });
        sum += E.openAmount(inv);
      }
    }
    return allocs ? { allocations: allocs, amount: sum } : null;
  }

  function invoicedBefore(inv) { return inv.date < st.date; }

  /** Retail: the salesman's collection from the weekly outlets on the route's collection day, when the vans are back. */
  function retailCollections(i) {
    var date = st.date, ctx = at(st.ctx[sim.collections.userId.retail], 'T09:00'), moved = CLOSED[i - 1], j, o, pays, r, draw, acc;
    for (j = 0; j < T.weeklyOutlets.length; j++) {
      o = T.weeklyOutlets[j];
      /* the config's day test is asked only on the route's collection weekday or the day after a closed day */
      pays = (DOW[i] === T.routes[o.routeIdx].collectionDow || moved) && sim.collections.outletPaysOn(o.id, date);
      r = receiptOf(o.id, pays, invoicedBefore);
      if (!r) continue;
      draw = HB.rng('collect|' + o.id + '|' + date).next();
      acc = draw < sim.collections.upiShare ? 'bank' : 'cash_factory';
      must(core.rcpt({ date: date, customerId: o.id, account: acc, amount: r.amount, mode: acc === 'bank' ? 'UPI' : 'cash', allocations: r.allocations }, ctx), 'collection ' + o.id);
    }
  }

  /** Corporates: a bank transfer on the customer's payment weekday for every invoice past due plus its lateness. */
  function corporateReceipts(i) {
    var date = st.date, ctx = at(st.ctx[sim.collections.userId.corporate], 'T12:00'), moved = CLOSED[i - 1], j, cp, pays, r;
    for (j = 0; j < T.corps.length; j++) {
      cp = T.corps[j];
      pays = (DOW[i] === cp.payDow || moved) && sim.collections.corporatePaysOn(cp.id, date);
      r = receiptOf(cp.id, pays, pastDue(cp.late, i));
      if (!r) continue;
      must(core.rcpt({ date: date, customerId: cp.id, account: sim.collections.corporateAccount, amount: r.amount, mode: 'NEFT', allocations: r.allocations }, ctx), 'receipt ' + cp.id);
    }
  }

  function pastDue(late, i) { return function (inv) { return idxOf(inv.dueDate) + late <= i; }; }

  /* ---- 12. cash deposits: the stores on their mornings, the factory most days */

  /** Cash is banked in whole rupees: the odd paise of the balance above the float stay in the till. */
  function wholeRupees(paise) { return Math.floor(paise / 100) * 100; }

  function deposits(i) {
    var date = st.date, s, sd, bal, amount, rng, ctx, f = sim.cash.factory;
    if (sim.cash.store.isDepositDay(date)) {
      for (s = 0; s < T.stores.length; s++) {
        sd = T.stores[s];
        ctx = at(storeCtx(sd), 'T09:30');
        bal = book.cash.balance[sd.cashId] || 0;
        amount = wholeRupees(bal - sim.cash.store.keep);
        if (amount <= 0) continue;
        rng = HB.rng('deposit|' + sd.cashId + '|' + date);
        if (must(core.dep({ date: date, fromAccount: sd.cashId, amount: amount, slipRef: sim.cash.slipRef.prefix + rng.int(100000, 999999), note: sd.note }, ctx), 'deposit ' + sd.id)) noteDeposit(i, amount);
      }
    }
  }

  /** The factory's surplus cash goes to the bank once the day's cash payments are made, leaving the float. */
  function factoryDeposit(i) {
    var date = st.date, f = sim.cash.factory, bal, amount, rng;
    if (!sim.cash.isFactoryDepositDay(date)) return;
    bal = book.cash.balance.cash_factory || 0;
    amount = wholeRupees(bal - f.keep);
    if (amount < f.minDeposit) return;
    rng = HB.rng('deposit|cash_factory|' + date);
    if (must(core.dep({ date: date, fromAccount: 'cash_factory', amount: amount, slipRef: sim.cash.slipRef.prefix + rng.int(100000, 999999) }, at(st.ctx[f.userId], 'T12:15')), 'factory deposit')) noteDeposit(i, amount);
  }

  function noteDeposit(i, amount) { st.depositsByMonth[MK[i]] = (st.depositsByMonth[MK[i]] || 0) + amount; }

  /* ---- 13. expense bills, claims and the salary bill; the Owner's same-day approval where the rule says so */

  function volumeFactor(monthKey) {
    var vf = sim.expenses.volumeFactor, base = st.flourByMonth[vf.base], here = st.flourByMonth[monthKey];
    if (monthKey < vf.base || !base || !here) return vf.before;
    return (here / D.daysInMonth(monthKey)) / (base / D.daysInMonth(vf.base));
  }

  function monthSetup(i) {
    var mk = MK[i];
    if (st.monthDone === mk) return;
    st.monthDone = mk;
    /* the bills whose day is drawn in the month */
    var rules = sim.expenses.seededBills(mk), j, r, d, rngIdx, open = [], k;
    for (j = 0; j < rules.length; j++) {
      r = rules[j];
      d = sim.expenses.seededDate(r, mk, HB.rng('seeded-bill|' + r.n + '|' + r.name + '|' + mk).next());
      if (d) listAt(st.seededBills, idxOf(d)).push(r);
    }
    /* the claims of the month, spread over its open days */
    for (k = idxOf(mk + '-01'); k < SPAN && MK[k] === mk; k++) if (!CLOSED[k]) open.push(k);
    var rows = T.claimRows, cl = sim.expenses.claims, row, n, rng, days, picked, m, amount, ref;
    var monthsIn = (+mk.slice(0, 4) - +sim.calendar.goLive.slice(0, 4)) * 12 + (+mk.slice(5, 7) - +sim.calendar.goLive.slice(5, 7));
    for (j = 0; j < rows.length; j++) {
      row = rows[j];
      rng = HB.rng('claims|' + mk + '|' + j);
      n = row.perMonth;
      if (n < 1) n = (monthsIn + (T.storeOf[row.unitId] || 0)) % Math.round(1 / n) === 0 ? 1 : 0;
      if (row.dow !== null) { days = []; for (k = 0; k < open.length; k++) if (DOW[open[k]] === row.dow) days.push(open[k]); picked = days.slice(0, n); }
      else {
        days = open.slice(); picked = [];
        for (m = 0; m < n && days.length; m++) picked.push(days.splice(rng.int(0, days.length - 1), 1)[0]);
      }
      for (m = 0; m < picked.length; m++) {
        amount = row.amounts ? row.amounts[rng.int(0, row.amounts.length - 1)] : Math.round(rng.range(row.amount[0], row.amount[1]) / cl.roundTo) * cl.roundTo;
        ref = rng.next() < cl.billRef.noBillShare ? cl.billRef.noBill : cl.billRef.prefix + rng.int(1000, 9999);
        listAt(st.claimsDue, picked[m]).push({ row: row, amount: amount, ref: ref });
      }
    }
  }

  function expenses(i) {
    var date = st.date, mk = MK[i], ctx = at(st.ctx[sim.expenses.userId], 'T11:00'), env, list, j, r, amount, rng, doc, k, row, item, sameDay = [];
    /* the headcount is counted only by the two rules that read it */
    env = { V: volumeFactor, cashDeposited: st.depositsByMonth[mk] || 0 };
    Object.defineProperty(env, 'headcount', { get: function () { return sim.people.headcountOn(date); } });
    list = sim.expenses.billsOn(date, env);
    var seeded = st.seededBills[i];
    if (seeded) { for (j = 0; j < seeded.length; j++) list.push({ rule: seeded[j], amount: sim.expenses.billAmount(seeded[j], date, env) }); delete st.seededBills[i]; }
    for (j = 0; j < list.length; j++) {
      r = list[j].rule;
      rng = HB.rng('bill|' + r.n + '|' + r.name + '|' + date);
      if (list[j].amount === null) amount = lerp(r.uniform, rng.next());
      else amount = list[j].amount * (1 + (r.noise ? r.noise * (2 * rng.next() - 1) : 0));
      amount = sim.expenses.toRupee(amount);
      if (!(amount > 0)) continue;
      doc = must(core.exp({ kind: 'bill', date: date, payeeId: r.vendorId, categoryId: r.categoryId, unitId: r.unitId, amount: amount, gstRate: r.gstRate, billRef: r.vendorId.slice(2) + '/' + date.slice(2, 4) + date.slice(5, 7) + '/' + pad2(j + 1), note: r.name }, ctx), 'expense bill ' + r.name);
      if (!doc) continue;
      var after = r.payAfterDays !== null && r.payAfterDays !== undefined ? r.payAfterDays : T.expVendorTerms[r.vendorId] || 0;
      if (r.sameDay) sameDay.push(doc); else listAt(st.expDue, idxOf(sim.calendar.nextOpen(ISO[i + after]))).push(doc.id);
    }
    /* approved and paid on its own date (the next open day when that is closed) */
    for (j = 0; j < sameDay.length; j++) {
      if (CLOSED[i]) { listAt(st.expDue, idxOf(sim.calendar.nextOpen(date))).push(sameDay[j].id); continue; }
      must(core.approve(sameDay[j].id, at(st.ctx[sim.expenses.approvedBy], 'T11:05')), 'approve ' + sameDay[j].id);
      must(core.pay({ date: date, payeeType: 'vendor', payeeId: sameDay[j].payeeId, account: sim.expenses.payAccount, allocations: [{ docId: sameDay[j].id, amount: sameDay[j].total }], ref: 'Bank debit' }, at(ctx, 'T11:10')), 'pay ' + sameDay[j].id);
    }
    /* the salary bill on the last day of the month, paid from the bank on the 5th */
    if (LAST[i]) {
      doc = must(core.exp({ kind: 'salary', monthKey: mk, note: 'Salaries for ' + D.monthLabel(mk, true) }, at(st.ctx[sim.people.userId], 'T11:15')), 'salary bill ' + mk);
      if (doc) listAt(st.expDue, idxOf(sim.people.salaryPayDate(mk))).push(doc.id);
    }
    /* claims */
    list = st.claimsDue[i];
    if (list) {
      for (j = 0; j < list.length; j++) {
        row = list[j].row;
        must(core.exp({ kind: 'claim', date: date, categoryId: row.categoryId, unitId: row.unitId, amount: list[j].amount, billRef: list[j].ref, payeeId: row.payeeEmployeeId,
          note: row.name + (sim.expenses.claims.noteOf(row) ? '. ' + sim.expenses.claims.noteOf(row) : '') }, at(claimCtx(row), 'T' + pad2(11) + ':' + pad2(20 + j))), 'claim ' + row.name);
      }
      delete st.claimsDue[i];
    }
  }

  /** Expense bills and the salary bill due today, from the bank; approved claims every Saturday. */
  function expensePayments(i) {
    var date = st.date, ctx = at(st.ctx[sim.expenses.userId], 'T11:40'), list = st.expDue[i], j, doc, byPayee, keys, p, e, open, allocs, sum, acc, k;
    if (list) {
      byPayee = {}; keys = [];
      for (j = 0; j < list.length; j++) {
        doc = book.docs[list[j]];
        if (!doc || doc.type !== 'EXP') continue;
        if (doc.status !== 'APPROVED') { if (doc.status === 'PENDING') listAt(st.expDue, idxOf(sim.calendar.nextOpen(ISO[i + 1]))).push(doc.id); continue; }
        p = byPayee[doc.payeeId];
        if (!p) { p = byPayee[doc.payeeId] = { allocs: [], sum: 0, type: doc.payeeType }; keys.push(doc.payeeId); }
        p.allocs.push({ docId: doc.id, amount: doc.total - doc.paid });
        p.sum += doc.total - doc.paid;
      }
      for (j = 0; j < keys.length; j++) {
        p = byPayee[keys[j]];
        must(core.pay({ date: date, payeeType: p.type, payeeId: keys[j], account: sim.expenses.payAccount, allocations: p.allocs, ref: 'NEFT' }, ctx), 'expense payment ' + keys[j]);
      }
      delete st.expDue[i];
    }
    if (!sim.expenses.claims.isReimburseDay(date)) return;
    ctx = at(ctx, 'T11:50');
    for (j = 0; j < T.claimants.length; j++) {
      e = T.claimants[j];
      open = book.ap.open['employee:' + e];
      if (!open || !open.length) continue;
      allocs = []; sum = 0;
      for (k = 0; k < open.length; k++) { allocs.push({ docId: open[k].id, amount: open[k].total - open[k].paid }); sum += open[k].total - open[k].paid; }
      acc = open[0].unitId === 'factory' ? sim.expenses.claims.reimburse.factory : sim.expenses.claims.reimburse.store;
      if ((book.cash.balance[acc] || 0) < sum) acc = 'bank';
      must(core.pay({ date: date, payeeType: 'employee', payeeId: e, account: acc, allocations: allocs, ref: 'Claims reimbursed' }, ctx), 'reimburse ' + e);
    }
  }

  /* ---- 7. production for tomorrow's dispatch and transfers (RESEARCH 3.4, 3.5, 12.2) */

  function avg14(k, i) {
    var pr = T.prod[k];
    if (i === I0) return pr.p.normalDayUnits;
    var n = i - I0 + 1, sum = 0, m;
    if (n > 14) n = 14;
    for (m = 0; m < n; m++) sum += st.out14[(i - m) % 14][k];
    return sum / n;
  }

  function production(i) {
    if (HOLIDAY[i]) return;
    var date = st.date, n1 = i + 1, rp1 = retailPlan(n1), cp1 = corpPlan(n1), stand1 = standingOn(n1).q, k, pr, p, s, item, stock, ho, out, need, nr, d, rp, cp, x, s1, s2, entries = [], en, rng, u, v, rate, note, under, j, br, chance, a, m, oc, perMix, good, rejected, dip = sim.stories.yieldDip.on(date), chances = {};
    var closedNext = CLOSED[n1];
    for (k = 0; k < T.nfg; k++) {
      pr = T.prod[k]; p = pr.p; item = pr.id;
      if (!p || !pr.mats.length || !sim.production.isRunDay(item, date)) continue;
      stock = E.available('fac_fg', item, ISO[n1]);
      if (p.daily) {
        if (closedNext) continue;
        ho = T.outletStanding[k] + cp1.tot[k];
        for (s = 0; s < T.stores.length; s++) { x = M.unitById[T.stores[s].id].standing[item] || 0; ho += x > stand1[s][k] ? x : stand1[s][k]; }
        out = rp1.tot[k] + cp1.tot[k] + st.xferProj[k];
        need = (ho > out ? ho : out) - stock;
      } else {
        nr = idxOf(sim.production.nextRunDay(item, date));
        if (nr > i + 7) nr = i + 7;
        s1 = 0; s2 = 0;
        for (d = n1; d <= nr; d++) {
          if (CLOSED[d]) continue;
          rp = retailPlan(d); cp = corpPlan(d);
          x = d === n1 ? st.xferProj[k] : storePlan(d - 1).tot[k];
          out = rp.tot[k] + cp.tot[k] + x;
          ho = T.outletStanding[k] + cp.tot[k];
          for (s = 0; s < T.stores.length; s++) {
            x = standingOn(d).q[s][k];
            if (d === n1) { var cur = M.unitById[T.stores[s].id].standing[item] || 0; if (cur > x) x = cur; }
            ho += x;
          }
          s1 += ho > out ? ho : out; s2 += out;
        }
        s2 += p.coverDays * avg14(k, i);
        need = (s1 > s2 ? s1 : s2) - stock;
      }
      if (need <= 0) continue;
      /* the yield draw, keyed on the date and the product: drift, the normal reject, then each bad-run cause */
      rng = HB.rng('prod|' + item + '|' + date);
      u = rng.range(-p.drift, p.drift);
      v = rng.range(sim.production.rejectDraw[0], sim.production.rejectDraw[1]);
      rate = p.reject * v; note = ''; under = 0;
      for (j = 0; j < pr.bad.length; j++) {
        br = pr.bad[j];
        chance = chances[br.id];
        if (chance === undefined) chance = chances[br.id] = sim.production.badRunChance(br.id, date);
        a = rng.next(); x = rng.next();
        if (a < chance) {
          if (br.rejectRate) { x = lerp(br.rejectRate, x); if (x > rate) { rate = x; note = br.cause; } }
          else if (br.yieldUnder) { under = lerp(br.yieldUnder, x); note = br.cause; }
        }
      }
      /* the fortnight dip (RESEARCH 12.2): its reject rate replaces r x v and the yield lands at one less that rate */
      if (dip && dip.itemId === item) { x = lerp(dip.rejectRate, rng.next()); if (x > rate) rate = x; if (x > under) under = x; note = dip.note; }
      if (p.daily) {
        perMix = p.piecesPerMix * (1 + u) * (1 - rate);
        m = stepUp(need / perMix, p.step);
        if (m < p.step) m = p.step;
        oc = outcomeOf(item, p, m, u, rate, under);
        while (oc.good < need) { m = q3(m + p.step); oc = outcomeOf(item, p, m, u, rate, under); }
        while (m - p.step >= p.step - 1e-9 && outcomeOf(item, p, q3(m - p.step), u, rate, under).good >= need) { m = q3(m - p.step); oc = outcomeOf(item, p, m, u, rate, under); }
        good = oc.good; rejected = oc.rejected;
      } else {
        m = stepUp(need / p.expectedUnits, p.step);
        if (m < sim.production.minRunMixes) m = sim.production.minRunMixes;
        if (p.maxMixes && m > p.maxMixes) m = p.maxMixes;
        oc = outcomeOf(item, p, m, u, rate, under);
        good = oc.good; rejected = oc.rejected;
      }
      entries.push({ k: k, pr: pr, m: m, good: good, rejected: rejected, need: need, u: u, rate: rate, under: under, note: note, made: oc.made });
    }
    if (!entries.length) return;
    /* the oven fault: one product of the day, in proportion to its mixes, loses most of one mix */
    if (T.ovenFault) {
      rng = HB.rng('oven|' + date);
      a = rng.next(); x = rng.next(); v = rng.range(T.ovenFault.rejectedPiecesOfOneMix[0], T.ovenFault.rejectedPiecesOfOneMix[1]);
      if (a < sim.production.badRunChance(T.ovenFault.id, date)) {
        var total = 0;
        for (j = 0; j < entries.length; j++) total += entries[j].m;
        x *= total;
        for (j = 0; j < entries.length; j++) { x -= entries[j].m; if (x <= 0) break; }
        if (j >= entries.length) j = entries.length - 1;
        en = entries[j]; p = en.pr.p;
        var extra = Math.round(p.piecesPerMix * v);
        if (p.daily) {
          m = en.m; oc = outcomeOf(en.pr.id, p, m, en.u, en.rate, en.under);
          while (oc.good - extra < en.need) { m = q3(m + p.step); oc = outcomeOf(en.pr.id, p, m, en.u, en.rate, en.under); }
          en.m = m; en.good = oc.good - extra; en.rejected = oc.rejected + extra; en.made = oc.made;
        } else if (en.good - extra >= 1) {
          en.good -= extra; en.rejected += extra;
        }
        en.note = T.ovenFault.cause;
      }
    }
    /* the safety net: a material short of the day's need gets one order, received at once (expected never) */
    var cons = zeros(T.mat.length), c, mi;
    for (j = 0; j < entries.length; j++) {
      en = entries[j]; pr = en.pr;
      for (c = 0; c < pr.mats.length; c++) cons[pr.mats[c].mi] += pr.mats[c].qty * en.m;
      for (c = 0; c < pr.pack.length; c++) cons[pr.pack[c].mi] += pr.pack[c].per * en.good;
    }
    for (mi = 0; mi < T.mat.length; mi++) {
      if (q3((book.stock.fac_rm[T.mat[mi].id] || 0) - cons[mi]) >= 0) continue;
      safetyNet(i, mi);
    }
    for (j = 0; j < entries.length; j++) {
      en = entries[j];
      var doc = must(core.prod({ date: date, itemId: en.pr.id, mixes: en.m, goodUnits: en.good, rejectedUnits: en.rejected, note: en.note }, at(st.ctx.u_production, en.pr.slot)), 'production ' + en.pr.id);
      if (!doc) continue;
      var mc = st.monthCons[MK[i]] || (st.monthCons[MK[i]] = zeros(T.mat.length)), flour = 0;
      for (c = 0; c < doc.consumption.length; c++) {
        mi = T.matIdx[doc.consumption[c].itemId];
        mc[mi] += doc.consumption[c].qty;
        if (T.flourMats.indexOf(mi) !== -1) flour += doc.consumption[c].qty;
      }
      st.flourByMonth[MK[i]] = (st.flourByMonth[MK[i]] || 0) + flour;
    }
  }

  /**
   * The entry of m mixes: the config's outcome (made, rejected, good, expected), and where a cause fixes the
   * yield itself (monsoon humidity, the fortnight dip) the good units are expected x (1 - under) and the rest
   * of what was made is rejected.
   */
  function outcomeOf(item, p, m, u, rate, under) {
    var oc = sim.production.outcome(item, m, u, rate);
    if (under > 0) {
      oc.good = Math.round(p.expectedUnits * m * (1 - under));
      oc.rejected = Math.round(oc.made) - oc.good;
      if (oc.rejected < 0) oc.rejected = 0;
    }
    return oc;
  }

  function safetyNet(i, mi) {
    var mat = T.mat[mi], vd = T.vendors[mat.vi], ctx = at(st.ctx[sim.purchasing.userId], 'T15:45'), rate = sim.purchasing.rateOn(mat.id, st.date), po, grn;
    st.stats.safetyNet++;
    po = must(core.po({ date: st.date, vendorId: vd.id, lines: [{ itemId: mat.id, qty: mat.orderQty, rate: rate }], note: 'Safety net: short of the day\'s need' }, at(st.ctx.u_owner, 'T15:45')), 'safety-net order ' + mat.id);
    if (!po) return;
    grn = must(core.grn({ date: st.date, poId: po.id, lines: [{ itemId: mat.id, qty: mat.orderQty }], note: 'Safety net' }, ctx), 'safety-net receipt ' + mat.id);
  }

  /* ---- 8. purchasing: the day-end check after production; an order above the limit waits for the Owner */

  function purchasing(i, first) {
    var date = st.date, time = first ? T.goLiveOrders : 'T17:45', mi, mat, stock, byVendor = {}, order = [], v, vd, lines, rng, u, rate, j, k, doc, lead, arrive, groups, key, task, ex, hit, idx, qty;
    for (mi = 0; mi < T.mat.length; mi++) {
      mat = T.mat[mi];
      if (mat.vi === undefined) continue;
      stock = book.stock.fac_rm[mat.id] || 0;
      if (q3(stock + st.onOrder[mi]) > mat.reorderLevel) continue;
      if (!byVendor[mat.vi]) { byVendor[mat.vi] = []; order.push(mat.vi); }
      byVendor[mat.vi].push(mi);
    }
    order.sort(function (a, b) { return a - b; });
    for (v = 0; v < order.length; v++) {
      vd = T.vendors[order[v]];
      rng = HB.rng('po|' + vd.id + '|' + date + (first ? '|opening' : ''));
      lines = []; groups = {}; arrive = null;
      for (j = 0; j < byVendor[order[v]].length; j++) {
        mat = T.mat[byVendor[order[v]][j]];
        if (sim.purchasing.marketNoise[mat.id]) { u = rng.range(-sim.purchasing.marketNoise[mat.id].pct, sim.purchasing.marketNoise[mat.id].pct); rate = sim.purchasing.marketRate(mat.id, date, u); }
        else rate = sim.purchasing.rateOn(mat.id, date);
        lines.push({ itemId: mat.id, qty: mat.orderQty, rate: rate });
        lead = sim.purchasing.nextReceivingDay(vd.id, ISO[i + mat.leadDays]);
        if (arrive === null || lead < arrive) arrive = lead;
        key = idxOf(lead);
        if (!groups[key]) groups[key] = [];
        groups[key].push({ itemId: mat.id, qty: mat.orderQty, mi: byVendor[order[v]][j] });
      }
      doc = must(core.po({ date: date, vendorId: vd.id, expectedDate: arrive, lines: lines }, at(st.ctx[sim.purchasing.userId], time)), 'order ' + vd.id);
      if (!doc) continue;
      for (j = 0; j < lines.length; j++) st.onOrder[T.matIdx[lines[j].itemId]] = q3(st.onOrder[T.matIdx[lines[j].itemId]] + lines[j].qty);
      /* the receipts, with the seeded exceptions drawn once on the order */
      ex = vd.exception;
      hit = ex ? rng.next() < ex.chance : false;
      u = rng.next();
      for (key in groups) {
        if (!Object.prototype.hasOwnProperty.call(groups, key)) continue;
        idx = +key;
        if (hit && ex.firstShare) {
          task = { poId: doc.id, vi: order[v], lines: [], note: 'Part delivery' };
          var rest = { poId: doc.id, vi: order[v], lines: [], note: 'Balance of the part delivery' };
          for (k = 0; k < groups[key].length; k++) {
            qty = q3(Math.round(groups[key][k].qty * ex.firstShare));
            task.lines.push({ itemId: groups[key][k].itemId, qty: qty });
            rest.lines.push({ itemId: groups[key][k].itemId, qty: q3(groups[key][k].qty - qty) });
          }
          listAt(st.grnDue, idx).push(task);
          listAt(st.grnDue, idxOf(sim.purchasing.nextReceivingDay(vd.id, ISO[idx + ex.restAfterDays]))).push(rest);
        } else if (hit && ex.rejectedQty) {
          task = { poId: doc.id, vi: order[v], lines: [], note: 'One bag rejected at the gate: damp' };
          for (k = 0; k < groups[key].length; k++) {
            qty = groups[key][k].qty;
            if (k === 0 && qty > ex.rejectedQty) { task.lines.push({ itemId: groups[key][k].itemId, qty: q3(qty - ex.rejectedQty), rejectedQty: ex.rejectedQty }); listAt(st.grnDue, idxOf(sim.purchasing.nextReceivingDay(vd.id, ISO[idx + ex.secondReceiptAfterDays]))).push({ poId: doc.id, vi: order[v], lines: [{ itemId: groups[key][k].itemId, qty: ex.rejectedQty }], note: 'Replacement for the bag rejected' }); }
            else task.lines.push({ itemId: groups[key][k].itemId, qty: qty });
          }
          listAt(st.grnDue, idx).push(task);
        } else if (hit && ex.itemId && hasItem(groups[key], ex.itemId)) {
          var rej = Math.round(lerp(ex.rejectedKg, u));
          task = { poId: doc.id, vi: order[v], lines: [], note: 'Rotten potatoes rejected' };
          for (k = 0; k < groups[key].length; k++) {
            qty = groups[key][k].qty;
            if (groups[key][k].itemId === ex.itemId && qty > rej) { task.lines.push({ itemId: ex.itemId, qty: q3(qty - rej), rejectedQty: rej }); listAt(st.grnDue, idxOf(sim.purchasing.nextReceivingDay(vd.id, ISO[idx + 1]))).push({ poId: doc.id, vi: order[v], lines: [{ itemId: ex.itemId, qty: rej }], note: 'Made good: the quantity rejected' }); }
            else task.lines.push({ itemId: groups[key][k].itemId, qty: qty });
          }
          listAt(st.grnDue, idx).push(task);
        } else {
          task = { poId: doc.id, vi: order[v], lines: [], note: '' };
          for (k = 0; k < groups[key].length; k++) task.lines.push({ itemId: groups[key][k].itemId, qty: groups[key][k].qty });
          listAt(st.grnDue, idx).push(task);
        }
      }
    }
  }

  function hasItem(lines, itemId) { for (var i = 0; i < lines.length; i++) if (lines[i].itemId === itemId) return true; return false; }

  /* ---- 14. the month-end count of the raw material store, with small differences */

  function stockCount(i) {
    var mk = MK[i], date = st.date, sc = sim.stockCount;
    if (st.countDone === mk || sc.dateOf(mk) !== date) return;
    st.countDone = mk;
    var cons = st.monthCons[mk] || zeros(T.mat.length), rng = HB.rng('count|' + mk), lines = [], g, j, mi, mat, used, short, system, counted, others = T.countOthers.slice(), pick = [];
    for (g = 0; g < T.countGroups.length; g++) {
      for (j = 0; j < T.countGroups[g].mis.length; j++) {
        mi = T.countGroups[g].mis[j]; mat = T.mat[mi];
        used = cons[mi] || 0;
        short = used * lerp(T.countGroups[g].shortage, rng.next());
        short = T.countGroups[g].whole ? Math.floor(short) : q3(short);
        system = book.stock.fac_rm[mat.id] || 0;
        counted = q3(system - short);
        if (counted < 0) counted = 0;
        lines.push({ itemId: mat.id, countedQty: counted });
      }
    }
    for (j = 0; j < sc.others.count && others.length; j++) pick.push(others.splice(rng.int(0, others.length - 1), 1)[0]);
    for (j = 0; j < pick.length; j++) {
      mat = T.mat[pick[j]];
      used = cons[pick[j]] || 0;
      system = book.stock.fac_rm[mat.id] || 0;
      counted = q3(system + used * lerp(sc.others.range, rng.next()));
      if (counted < 0) counted = 0;
      lines.push({ itemId: mat.id, countedQty: counted });
    }
    must(core.adj({ date: date, locId: sc.locId, reason: sc.reason, lines: lines, note: 'Month-end count, ' + D.monthLabel(mk, true) }, at(st.ctx[sc.userId], 'T18:00')), 'stock count ' + mk);
  }

  /* ================================================================ a day */

  function day(i) {
    var date = ISO[i], r, k, o14;
    st.i = i; st.date = date; st.stats.days++;
    st.sheetIds = [];
    for (r = 0; r < T.routes.length; r++) st.sheetIds.push(E.sheetId(T.routes[r].id, date));
    zero(st.outflow);
    monthSetup(i);
    /* go-live: its own dated changes, then the orders for today's deliveries, before the day begins */
    if (i === I0) { masterChanges(i); salesOrders(i, true); }
    if (!CLOSED[i]) {
      approvals(i);
      factoryExpired();
      availFG(i);
      dispatch(i);
      morningRun(i);
      /* go-live: the opening orders once the vans are back; one above the limit waits for the Owner's next morning (SPEC 6 step 8) */
      if (i === I0) purchasing(i, true);
      receipts(i);
      retailCollections(i);
      deposits(i);
      vendorBills(i);
    }
    /* today's outflow, for the long-life average (nothing leaves on a closed day) */
    o14 = st.out14[i % 14];
    for (k = 0; k < T.nfg; k++) o14[k] = st.outflow[k];
    planStores(i);
    expenses(i);
    if (!CLOSED[i]) {
      payments(i);
      expensePayments(i);
      corporateReceipts(i);
      factoryDeposit(i);
      salesOrders(i);
    }
    production(i);
    if (!HOLIDAY[i]) purchasing(i, false);
    stockCount(i);
    leavers();
    if (!CLOSED[i]) dayEnds(i);
    /* tomorrow's dated master changes, entered on its morning before the dispatch (see masterChanges) */
    masterChanges(i + 1);
  }

  /* ================================================================== run */

  /**
   * Simulate from go-live to `toDate` (both included) on the book HB.engine.reset() made. `hooks.afterDay(date)`
   * is called after the last step of each day; a check uses it to look at the book day by day.
   */
  function run(toDate, hooks) {
    E = HB.engine; core = E.core; cfg = HB.config; sim = cfg && cfg.sim; D = HB.dates; q3 = HB.q3; money = HB.money;
    E.postOpening();
    book = HB.book; M = HB.masters;
    if (!sim) { HB.seed.stats = { refusals: [], safetyNet: 0, days: 0, docs: book.docList.length, config: 'no simulation parameters' }; return book; }
    if (!T || T.cfg !== cfg) { ISO.length = 0; DOW.length = 0; MK.length = 0; DOM.length = 0; LAST.length = 0; CLOSED.length = 0; HOLIDAY.length = 0; IDX = {}; buildCalendar(); buildStatic(); }
    var end = toDate && toDate >= sim.calendar.goLive ? idxOf(toDate) : I0 - 1, i;
    if (end > SPAN - 60) end = SPAN - 60;
    st = newState(end);
    HB.seed.stats = st.stats;
    for (i = I0; i <= end; i++) {
      day(i);
      if (hooks && typeof hooks.afterDay === 'function') hooks.afterDay(ISO[i], i - I0);
    }
    st.stats.docs = book.docList.length;
    return book;
  }

  HB.seed = {
    VERSION: VERSION,
    run: run,
    stats: null,
    /** For checks: the day index of a date, as the seed counts them (go-live is 0). */
    dayIndex: function (iso) { return idxOf(iso) - I0; },
    /** For checks, after a run: lines on `date` whose class factor is not the factor the config gives the outlet outright. */
    verifyClasses: verifyClasses
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = HB.seed;
})(typeof window !== 'undefined' ? window : globalThis);
