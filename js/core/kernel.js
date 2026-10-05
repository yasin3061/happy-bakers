/*
 * HB kernel: namespace, event bus, money and quantity arithmetic, formatting, dates, seeded randomness,
 * storage, the business-date calendar, and the session (personas, rights, page access, scope).
 * No DOM access in this file - it must load in the browser (classic script) and in Node (require).
 * Everything else in the sample builds on this contract (docs/API.md, section 1); extend it, do not fork it.
 */
(function (root) {
  'use strict';

  var HB = root.HB || (root.HB = {});
  HB.version = '0.1.0';

  /* ------------------------------------------------------------------ bus */

  var listeners = {};
  HB.bus = {
    on: function (evt, fn) {
      (listeners[evt] || (listeners[evt] = [])).push(fn);
      return function off() {
        listeners[evt] = (listeners[evt] || []).filter(function (f) { return f !== fn; });
      };
    },
    emit: function (evt, payload) {
      (listeners[evt] || []).slice().forEach(function (fn) {
        try { fn(payload); } catch (e) { if (root.console) root.console.error('[HB.bus] ' + evt, e); }
      });
    }
  };

  /* ---------------------------------------------------------------- money */
  /*
   * Money is integer paise. Every rounding in the kernel goes through roundHalfUp, so a half always rounds
   * away from zero and a negative value is the exact opposite of the positive one.
   */

  /**
   * a >= 0 -> nearest integer, halves up. The tolerance absorbs binary floating-point error: 1.005 x 100 is
   * held as 100.49999999999999 and still counts as the half it stands for. It grows with a because the error
   * does, and is capped so that very large whole numbers stay as they are.
   */
  function roundHalfUp(a) {
    return Math.floor(a + 0.5 + 1e-9 + Math.min(a * 2e-15, 1e-3));
  }

  /** Signed version: halves away from zero; never returns -0. */
  function roundAway(x) {
    var r = roundHalfUp(Math.abs(x));
    return x < 0 && r !== 0 ? -r : r;
  }

  /** Quantity to at most three decimals. Call it after every arithmetic step on a quantity. */
  HB.q3 = function (x) { return roundAway(x * 1000) / 1000; };

  HB.money = {
    /** Rupees (number, or a numeric string from an input) -> whole paise. */
    fromRupees: function (r) { return roundAway(+r * 100); },
    /** Paise -> rupees as a number. For input controls only; screens use HB.fmt. */
    toRupees: function (p) { return p / 100; },
    /** A typed rate in rupees per unit -> paise per unit with two decimals (a ten-thousandth of a rupee). */
    rateFromRupees: function (r) { return roundAway(+r * 10000) / 100; },
    /**
     * The only place a quantity and a rate become money.
     * qty: units, up to three decimals. rate: paise per unit, may be fractional. Returns whole paise.
     * The quantity is taken in thousandths first, so the product is formed from an integer and one rate.
     */
    amount: function (qty, rate) {
      var milli = roundHalfUp(Math.abs(qty) * 1000);
      var paise = roundHalfUp(Math.abs(milli * rate) / 1000);
      return (qty < 0) !== (rate < 0) && paise !== 0 ? -paise : paise;
    }
  };

  /* ------------------------------------------------------------------ fmt */
  /* Money arguments are PAISE. Only HB.fmt and the input controls ever convert to rupees. */

  var RUPEE = '₹';
  var MINUS = '-';
  var DASH = '-'; /* shown for a missing value */
  var UNIT_PLURAL = { pack: 'packs', litre: 'litres', piece: 'pieces', unit: 'units', bag: 'bags', box: 'boxes', carton: 'cartons' };
  var UNIT_SINGULAR = { pcs: 'pc' }; /* the one abbreviation that carries its plural: 1 pc, 240 pcs */

  function missing(n) { return n === null || n === undefined || n === '' || isNaN(n) || !isFinite(n); }

  function groupIndian(intStr) {
    if (intStr.length <= 3) return intStr;
    var last3 = intStr.slice(-3);
    var rest = intStr.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    return rest + ',' + last3;
  }

  function trimZeros(s) { return s.indexOf('.') === -1 ? s : s.replace(/\.?0+$/, ''); }

  function padLeft(n, width) { var s = String(n); while (s.length < width) s = '0' + s; return s; }

  /**
   * abs >= 0 rounded to d decimals -> { int, frac, zero } as digit strings. toFixed() is not used because it
   * rounds the binary value: (1.005).toFixed(2) is '1.00'.
   */
  function fixedParts(abs, d) {
    var scale = Math.pow(10, d);
    var scaled = roundHalfUp(abs * scale);
    var whole = Math.floor(scaled / scale);
    return { int: String(whole), frac: d ? padLeft(scaled - whole * scale, d) : '', zero: scaled === 0 };
  }

  function fixedStr(abs, d) { var p = fixedParts(abs, d); return p.int + (d ? '.' + p.frac : ''); }

  /** A unit as it reads after a quantity: a word takes its plural for anything but exactly one; kg and the like never change. */
  function unitWord(one, unit) {
    if (!unit) return '';
    if (one) return UNIT_SINGULAR.hasOwnProperty(unit) ? UNIT_SINGULAR[unit] : unit;
    return UNIT_PLURAL.hasOwnProperty(unit) ? UNIT_PLURAL[unit] : unit;
  }

  HB.fmt = {
    /** Plain number with Indian digit grouping. decimals defaults to 0. Not for money. */
    num: function (n, decimals) {
      if (missing(n)) return DASH;
      var p = fixedParts(Math.abs(n), decimals || 0);
      return (n < 0 && !p.zero ? MINUS : '') + groupIndian(p.int) + (p.frac ? '.' + p.frac : '');
    },
    /** Paise -> compact rupees for tiles, axes and tooltips: Rs 1.08 Cr, Rs 12.4 L, Rs 45,200 */
    inr: function (p) {
      if (missing(p)) return DASH;
      var a = Math.abs(p) / 100, sign = p < 0 ? MINUS : '';
      var lakhs = fixedStr(a / 1e5, a >= 1e6 ? 1 : 2);
      /* a value that rounds up into the next unit is shown in that unit: Rs 1 Cr, never Rs 100 L */
      if (a >= 1e7 || +lakhs >= 100) return sign + RUPEE + trimZeros(fixedStr(a / 1e7, 2)) + ' Cr';
      if (a >= 1e5 || roundHalfUp(a) >= 1e5) return sign + RUPEE + trimZeros(lakhs) + ' L';
      var whole = roundHalfUp(a);
      return (whole ? sign : '') + RUPEE + groupIndian(String(whole));
    },
    /** Paise -> whole rupees with Indian grouping: Rs 12,43,500 */
    inrFull: function (p) {
      if (missing(p)) return DASH;
      var whole = roundHalfUp(Math.abs(p) / 100);
      return (p < 0 && whole ? MINUS : '') + RUPEE + groupIndian(String(whole));
    },
    /** Paise -> rupees with two decimals, for documents and registers: Rs 1,234.50 */
    inr2: function (p) {
      if (missing(p)) return DASH;
      var paise = roundHalfUp(Math.abs(p));
      var rupees = Math.floor(paise / 100);
      return (p < 0 && paise ? MINUS : '') + RUPEE + groupIndian(String(rupees)) + '.' + padLeft(paise - rupees * 100, 2);
    },
    /**
     * Paise per unit -> rupees with two to four decimals: Rs 38.50, Rs 21.4275.
     * Zeros are trimmed only beyond the second decimal, so a rate still reads as money.
     */
    rate: function (p) {
      if (missing(p)) return DASH;
      var parts = fixedParts(Math.abs(p) / 100, 4);
      var frac = parts.frac.replace(/0{1,2}$/, '');
      return (p < 0 && !parts.zero ? MINUS : '') + RUPEE + groupIndian(parts.int) + '.' + frac;
    },
    /**
     * Quantity with up to three decimals, trailing zeros trimmed, and its unit: 12.5 kg, 240 pcs, 1 pack, 189 packs.
     * A unit that is a word takes its plural for anything but exactly one; an abbreviation (kg, pcs) never changes.
     */
    qty: function (q, unit) {
      if (missing(q)) return DASH;
      var parts = fixedParts(Math.abs(q), 3);
      var frac = parts.frac.replace(/0+$/, '');
      var word = unitWord(parts.int === '1' && !frac, unit);
      return (q < 0 && !parts.zero ? MINUS : '') + groupIndian(parts.int) + (frac ? '.' + frac : '') + (word ? ' ' + word : '');
    },
    /** The unit as it reads after that quantity: unitFor(1, 'pack') 'pack', unitFor(189, 'pack') 'packs', unitFor(1, 'pcs') 'pc', unitFor(2, 'kg') 'kg'. */
    unitFor: function (q, unit) { return unitWord(Math.abs(q) === 1, unit); },
    /** Fraction to percent: 0.1234 -> 12.3% */
    pct: function (x, decimals) {
      if (missing(x)) return DASH;
      var d = decimals === undefined ? 1 : decimals;
      var parts = fixedParts(Math.abs(x) * 100, d);
      return (x < 0 && !parts.zero ? MINUS : '') + parts.int + (d ? '.' + parts.frac : '') + '%';
    },
    /*
     * delta and points stay only because the inherited chart wrapper calls them. Pages do not: no tile, table or
     * chart in this sample shows a change against another period.
     */
    /** Relative change between two values. dir is 'up' | 'down' | 'flat'. */
    delta: function (cur, prev) {
      if (!prev || isNaN(prev) || isNaN(cur)) return { value: null, label: DASH, dir: 'flat' };
      var v = (cur - prev) / Math.abs(prev);
      var dir = Math.abs(v) < 0.0005 ? 'flat' : (v > 0 ? 'up' : 'down');
      return { value: v, label: (v > 0 ? '+' : '') + (v * 100).toFixed(1) + '%', dir: dir };
    },
    /** Percentage-point change between two fractions: 0.34 vs 0.32 -> +2.0 pts */
    points: function (curFrac, prevFrac) {
      if (curFrac === null || prevFrac === null || isNaN(curFrac) || isNaN(prevFrac)) return { value: null, label: DASH, dir: 'flat' };
      var v = (curFrac - prevFrac) * 100;
      var dir = Math.abs(v) < 0.05 ? 'flat' : (v > 0 ? 'up' : 'down');
      return { value: v, label: (v > 0 ? '+' : '') + v.toFixed(1) + ' pts', dir: dir };
    },
    rupee: RUPEE
  };

  /* ---------------------------------------------------------------- dates */
  /* ISO 'YYYY-MM-DD' strings everywhere; all arithmetic in UTC so time zones never shift a day. */

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DOWS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  function toMs(iso) { return Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)); }
  function fromMs(ms) {
    var d = new Date(ms);
    var m = d.getUTCMonth() + 1, day = d.getUTCDate();
    return d.getUTCFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }

  HB.dates = {
    MONTHS: MONTHS,
    DOWS: DOWS,
    /** True for a 'YYYY-MM-DD' string that names a real calendar day. */
    isIso: function (s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && fromMs(toMs(s)) === s; },
    addDays: function (iso, n) { return fromMs(toMs(iso) + n * 86400000); },
    diffDays: function (a, b) { return Math.round((toMs(b) - toMs(a)) / 86400000); },
    /** Inclusive list of ISO dates. */
    range: function (from, to) {
      var out = [], n = HB.dates.diffDays(from, to);
      for (var i = 0; i <= n; i++) out.push(HB.dates.addDays(from, i));
      return out;
    },
    /** 0 = Monday ... 6 = Sunday */
    dow: function (iso) { return (new Date(toMs(iso)).getUTCDay() + 6) % 7; },
    monthKey: function (iso) { return iso.slice(0, 7); },
    monthStart: function (iso) { return iso.slice(0, 8) + '01'; },
    monthEnd: function (iso) {
      var y = +iso.slice(0, 4), m = +iso.slice(5, 7);
      return fromMs(Date.UTC(y, m, 0));
    },
    daysInMonth: function (monthKey) { return +HB.dates.monthEnd(monthKey + '-01').slice(8, 10); },
    /** Monday of the week containing iso. */
    weekStart: function (iso) { return HB.dates.addDays(iso, -HB.dates.dow(iso)); },
    min: function (a, b) { return a < b ? a : b; },
    max: function (a, b) { return a > b ? a : b; },
    /** style: 'd MMM' (default) | 'd MMM yyyy' | 'MMM yyyy' | 'MMM' | 'EEE' | 'EEE d MMM' */
    label: function (iso, style) {
      var d = +iso.slice(8, 10), m = MONTHS[+iso.slice(5, 7) - 1], y = iso.slice(0, 4);
      switch (style) {
        case 'd MMM yyyy': return d + ' ' + m + ' ' + y;
        case 'MMM yyyy': return m + ' ' + y;
        case 'MMM': return m;
        case 'EEE': return DOWS[HB.dates.dow(iso)];
        case 'EEE d MMM': return DOWS[HB.dates.dow(iso)] + ' ' + d + ' ' + m;
        default: return d + ' ' + m;
      }
    },
    monthLabel: function (monthKey, withYear) {
      return MONTHS[+monthKey.slice(5, 7) - 1] + (withYear ? ' ' + monthKey.slice(0, 4) : '');
    }
  };

  /* ------------------------------------------------------------------ rng */
  /* Deterministic. Never use Math.random() or the clock for data. */

  HB.hash = function (str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };

  /** HB.rng(seed) where seed is a number or any string key, e.g. HB.rng('demand|o07|2026-04-01') */
  HB.rng = function (seed) {
    var s = (typeof seed === 'string' ? HB.hash(seed) : (seed >>> 0)) || 1;
    function next() {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    var spare = null;
    var api = {
      next: next,
      range: function (a, b) { return a + (b - a) * next(); },
      int: function (a, b) { return a + Math.floor(next() * (b - a + 1)); },
      chance: function (p) { return next() < p; },
      pick: function (arr) { return arr[Math.floor(next() * arr.length)]; },
      /** Index drawn in proportion to non-negative weights. */
      weighted: function (weights) {
        var total = 0, i;
        for (i = 0; i < weights.length; i++) total += weights[i];
        var r = next() * total;
        for (i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return i; }
        return weights.length - 1;
      },
      normal: function (mean, sd) {
        var z;
        if (spare !== null) { z = spare; spare = null; }
        else {
          var u = 0, v = 0;
          while (u === 0) u = next();
          v = next();
          var mag = Math.sqrt(-2 * Math.log(u));
          z = mag * Math.cos(2 * Math.PI * v);
          spare = mag * Math.sin(2 * Math.PI * v);
        }
        return (mean || 0) + (sd === undefined ? 1 : sd) * z;
      },
      poisson: function (lambda) {
        if (lambda <= 0) return 0;
        if (lambda > 30) return Math.max(0, Math.round(api.normal(lambda, Math.sqrt(lambda))));
        var L = Math.exp(-lambda), k = 0, p = 1;
        do { k++; p *= next(); } while (p > L);
        return k - 1;
      }
    };
    return api;
  };

  /* ---------------------------------------------------------------- store */
  /*
   * Namespaced localStorage with an in-memory fallback. Node always runs on the fallback (a check must not
   * inherit state from an earlier run), and so does a browser that blocks storage.
   * Keys in use: 'meta' { businessDate, seedVersion }, 'log' (the user's operations), 'prefs'.
   */

  var PREFIX = 'hb.v1.';
  var COPY_KEYS = ['meta', 'log']; /* the keys that make up a copy; 'prefs' is each tab's own business */
  var memory = {};
  var ls = null;
  try {
    if (typeof window !== 'undefined' && root === window && root.localStorage) {
      root.localStorage.setItem(PREFIX + '__probe', '1');
      root.localStorage.removeItem(PREFIX + '__probe');
      ls = root.localStorage;
    }
  } catch (e) { ls = null; }

  var cache = {};
  var failed = {}; /* keys whose latest value did not reach localStorage */

  function refreshOk() { HB.store.ok = !!ls && Object.keys(failed).length === 0; }

  /** Write without announcing it; the callers decide which event follows. */
  function put(key, value) {
    cache[key] = value;
    var raw = JSON.stringify(value);
    if (ls) {
      try { ls.setItem(PREFIX + key, raw); delete failed[key]; }
      catch (e) { failed[key] = true; } /* quota or a storage error: the value lives in the cache until the reload */
    } else {
      memory[key] = raw;
    }
    refreshOk();
  }

  HB.store = {
    /** False when storage is unavailable (always in Node) or a write failed: changes will not survive a reload. */
    ok: !!ls,
    get: function (key, fallback) {
      if (Object.prototype.hasOwnProperty.call(cache, key)) return cache[key];
      var raw = null;
      try { raw = ls ? ls.getItem(PREFIX + key) : (Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null); } catch (e) { raw = null; }
      if (raw === null || raw === undefined) return fallback;
      try { cache[key] = JSON.parse(raw); return cache[key]; } catch (e2) { return fallback; }
    },
    set: function (key, value) {
      put(key, value);
      HB.bus.emit('store:changed', { key: key });
    },
    remove: function (key) {
      delete cache[key];
      delete memory[key];
      delete failed[key];
      try { if (ls) ls.removeItem(PREFIX + key); } catch (e) { /* ignore */ }
      refreshOk();
      HB.bus.emit('store:changed', { key: key });
    },
    /**
     * Remove every key this app wrote (any schema version) and start the calendar again from realToday(), as a
     * first open does - so memory and storage agree even when no reload follows.
     */
    resetAll: function () {
      cache = {};
      memory = {};
      failed = {};
      try {
        if (ls) {
          var doomed = [];
          for (var i = 0; i < ls.length; i++) { var k = ls.key(i); if (k && k.indexOf('hb.') === 0) doomed.push(k); }
          doomed.forEach(function (k) { ls.removeItem(k); });
        }
      } catch (e) { /* ignore */ }
      refreshOk();
      openCalendar();
      HB.bus.emit('store:changed', { key: '*' });
    }
  };

  /*
   * Another tab changed the copy (posted a document, took a fresh copy, reset): this tab's book is stale, and the
   * only safe way to catch up is to rebuild it. The event never fires in the tab that made the change.
   */
  if (ls && typeof root.addEventListener === 'function') {
    root.addEventListener('storage', function (e) {
      if (!e || (e.storageArea && e.storageArea !== ls)) return;
      var cleared = e.key === null || e.key === undefined;
      var ours = !cleared && COPY_KEYS.some(function (k) { return e.key === PREFIX + k; });
      if ((cleared || ours) && root.location && typeof root.location.reload === 'function') root.location.reload();
    });
  }

  /* ------------------------------------------------------------- calendar */
  /*
   * The business date is "today" for this copy: taken from the device once, on first open, and kept in 'meta'.
   * History (the seed) runs from goLive to the day before it. Nothing ages while the copy sits unused.
   */

  var MIN_DATE = '2026-02-01'; /* the month before must exist, so that lockBefore is never before go-live */
  var MAX_DATE = '2027-12-31'; /* every seed rule is written to hold up to this day */

  function rangeClamp(iso) { return iso < MIN_DATE ? MIN_DATE : (iso > MAX_DATE ? MAX_DATE : iso); }

  /*
   * The factory's closed days (HB.config.sim.calendar.closedDays) are no business date: a copy first opened on
   * one takes the next open day, so that every journey is possible on any business date. The config loads
   * after the kernel, so the date adopted on load is settled on the first read that finds the config.
   */
  function closedDays() {
    var c = HB.config && HB.config.sim && HB.config.sim.calendar;
    return c && Array.isArray(c.closedDays) ? c.closedDays : null;
  }

  /** iso moved into range and off the closed days: the first open day on or after it. */
  function clampDate(iso) {
    var closed = closedDays(), n = 0;
    iso = rangeClamp(iso);
    if (closed) while (closed.indexOf(iso) !== -1 && n++ < 31) iso = rangeClamp(HB.dates.addDays(iso, 1));
    return iso;
  }

  /** The device's calendar date. The only clock read in the code base; local, never toISOString() (that is UTC). */
  function realToday() {
    var d = new Date();
    return d.getFullYear() + '-' + padLeft(d.getMonth() + 1, 2) + '-' + padLeft(d.getDate(), 2);
  }

  var cal = { today: null, dataEnd: null, lockBefore: null }, settled = false;

  function settle() {
    if (settled || !closedDays()) return;
    settled = true;
    var moved = clampDate(cal.today);
    if (moved !== cal.today) adopt(moved, true);
  }

  HB.calendar = {
    goLive: '2026-01-01',
    minDate: MIN_DATE,
    maxDate: MAX_DATE,
    realToday: realToday,
    clamp: clampDate,
    /**
     * Make iso (clamped) the business date and store it. For Node checks and for "fresh copy"; the book is not
     * rebuilt here - follow with HB.engine.boot() or a reload. Returns the date now in force.
     */
    set: function (iso) {
      if (!HB.dates.isIso(iso)) throw new Error('HB.calendar.set: expected a YYYY-MM-DD date, got ' + iso);
      adopt(clampDate(iso), true);
      HB.bus.emit('store:changed', { key: 'meta' });
      return HB.calendar.today;
    },
    /** True when the device's date (clamped) is later than the business date: the "calendar has moved on" banner. */
    movedOn: function () { return clampDate(realToday()) > HB.calendar.today; }
  };
  /* today (the business date), dataEnd (the day before: the last day of seeded history) and lockBefore (the first */
  /* day of the month before today; months before it are locked) read as plain data, settled once the config is in */
  ['today', 'dataEnd', 'lockBefore'].forEach(function (k) {
    Object.defineProperty(HB.calendar, k, { enumerable: true, get: function () { settle(); return cal[k]; } });
  });

  function adopt(iso, persist) {
    var D = HB.dates;
    cal.today = iso;
    cal.dataEnd = D.addDays(iso, -1);
    cal.lockBefore = D.monthStart(D.addDays(D.monthStart(iso), -1));
    if (!persist) return;
    var meta = HB.store.get('meta', null);
    if (!meta || typeof meta !== 'object') meta = {};
    meta.businessDate = iso; /* seedVersion and anything else the data layer keeps in meta is left alone */
    put('meta', meta);
  }

  /** First open: take the device's date. Any later open: the stored date, whatever the device says. */
  function openCalendar() {
    var meta = HB.store.get('meta', null);
    var stored = meta && typeof meta === 'object' ? meta.businessDate : null;
    if (HB.dates.isIso(stored)) adopt(clampDate(stored), clampDate(stored) !== stored);
    else adopt(clampDate(realToday()), true);
  }

  openCalendar();

  /* -------------------------------------------------------------- session */
  /* Fictional personas. Rights, page access and scope are held here once; nothing else decides them. */

  var ROLES = ['owner', 'accounts', 'stores', 'production', 'sales', 'store_mgr'];
  var ROLE_LABELS = {
    owner: 'Owner', accounts: 'Accounts and admin', stores: 'Purchase and stores',
    production: 'Production supervisor', sales: 'Sales and dispatch', store_mgr: 'Store manager'
  };
  /* the role as a sentence names it: a job takes its article, a team does not */
  var ROLE_IN_TEXT = {
    owner: 'the Owner', accounts: 'Accounts and admin', stores: 'Purchase and stores',
    production: 'the production supervisor', sales: 'Sales and dispatch', store_mgr: 'the store manager'
  };

  /*
   * Lists of ids. An entry ending in '*' matches by prefix, so ['*'] is "all, including what is added later"
   * and 'transit_*' is every store's transit location, present and future. Test with HB.session.matches().
   */
  var ALL = ['*'];
  var COMMON_PAGES = ['home', 'guide', 'expenses', 'sys-tiers'];

  var ACCESS = {
    owner: { pages: ALL, unitIds: ALL, locIds: ALL, accountIds: ALL },
    accounts: { pages: ALL, unitIds: ALL, locIds: ALL, accountIds: ALL },
    stores: {
      pages: COMMON_PAGES.concat(['buy-orders', 'buy-receipts', 'stores-transfers', 'stock-onhand', 'stock-batches', 'stock-ledger', 'stock-counts', 'masters-parties']),
      unitIds: ['factory'], locIds: ['fac_rm', 'fac_fg', 'transit_*'], accountIds: []
    },
    production: {
      pages: COMMON_PAGES.concat(['make-production', 'make-recipes', 'stock-onhand', 'stock-batches', 'stock-ledger']),
      unitIds: ['factory'], locIds: ['fac_rm', 'fac_fg'], accountIds: []
    },
    sales: {
      pages: COMMON_PAGES.concat(['sell-dispatch', 'sell-corporate', 'sell-invoices', 'sell-returns', 'sell-receipts', 'stock-onhand', 'stock-batches', 'masters-parties']),
      unitIds: ['factory'], locIds: ['fac_fg'], accountIds: []
    },
    store_mgr: {
      pages: COMMON_PAGES.concat(['stores-transfers', 'stores-dayend', 'stock-onhand', 'stock-batches', 'stock-ledger', 'acc-cash']),
      unitIds: ['st_vvn'], locIds: ['st_vvn', 'transit_st_vvn'], accountIds: ['cash_st_vvn']
    }
  };
  ROLES.forEach(function (r) {
    ['pages', 'unitIds', 'locIds', 'accountIds'].forEach(function (k) { Object.freeze(ACCESS[r][k]); });
    Object.freeze(ACCESS[r]);
  });
  Object.freeze(ACCESS);

  /* which side of masters-parties a role sees */
  var PARTY_KINDS = { owner: ['customers', 'vendors'], accounts: ['customers', 'vendors'], stores: ['vendors'], sales: ['customers'], production: [], store_mgr: [] };
  /* what the expenses page lists: everything, the role's unit (never the salary bill), or the persona's own claims */
  var EXPENSE_VIEW = { owner: 'all', accounts: 'all', store_mgr: 'unit', stores: 'own', production: 'own', sales: 'own' };

  function matches(list, id) {
    if (!list || id === null || id === undefined) return false;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (e === id) return true;
      if (e.charAt(e.length - 1) === '*' && String(id).indexOf(e.slice(0, -1)) === 0) return true;
    }
    return false;
  }

  /*
   * Rights. action -> the roles that may do it besides the Owner, who may do all of them.
   * scope names the part of the role's access the document must fall in, and from the one field of the document
   * (or of the payload about to be posted) that says which it is for. Only that field is read: a payload must
   * not pass the test under one name and be posted for what another names.
   */
  var EVERY_ROLE = ROLES.filter(function (r) { return r !== 'owner'; });
  var ACTIONS = {
    'po.create': { roles: ['stores'], what: 'raise a purchase order' },
    'grn.create': { roles: ['stores'], what: 'post a goods receipt' },
    'xfer.create': { roles: ['stores'], what: 'send stock to a store' },
    'vbill.create': { roles: ['accounts'], what: 'enter a vendor bill' },
    'pay.create': { roles: ['accounts'], what: 'make a payment' },
    'exp.bill': { roles: ['accounts'], what: 'enter an expense bill' },
    'exp.salary': { roles: ['accounts'], what: 'raise the salary bill' },
    'master.edit': { roles: ['accounts'], what: 'change items, recipes, customers, vendors or other records' },
    'employee.edit': { roles: ['accounts'], what: 'change the employee directory' },
    'dep.create': { roles: ['accounts', 'store_mgr'], what: 'deposit cash in the bank', scope: 'account', from: 'fromAccount' },
    'rcpt.create': { roles: ['accounts', 'sales'], what: 'record a receipt' },
    'prod.create': { roles: ['production'], what: 'record production' },
    'dispatch.post': { roles: ['sales'], what: 'post a dispatch sheet' },
    'dispatch.cancel': { roles: ['sales'], what: 'cancel a dispatch sheet' },   /* as for posting one */
    'inv.create': { roles: ['sales'], what: 'raise an invoice' },
    'so.create': { roles: ['sales'], what: 'enter a sales order' },
    'cn.create': { roles: ['sales'], what: 'enter a stale return' },
    'xfer.receive': { roles: ['store_mgr'], what: 'confirm a transfer', scope: 'unit', from: 'toStoreId' },
    'dayend.create': { roles: ['store_mgr'], what: 'enter a day-end', scope: 'unit', from: 'storeId' },
    'adj.create': { roles: ['stores'], what: 'raise a stock count', scope: 'loc', from: 'locId' },
    'wo.create': { roles: ['stores', 'store_mgr'], what: 'request a write-off', scope: 'loc', from: 'locId' },
    /* no scope: any persona may claim for the factory or for a store (SCOPE 4.6; the location is an input) */
    'exp.claim': { roles: EVERY_ROLE, what: 'submit an expense claim' }
  };
  /* the key under which a caller may give the subject of a scope test outright */
  var GIVEN = { unit: 'unitId', loc: 'locId', account: 'accountId' };

  /* cancel.<type>: whoever may create the type may cancel it, within the same scope */
  var CANCELS = {
    po: { via: ['po.create'], noun: 'a purchase order' },
    grn: { via: ['grn.create'], noun: 'a goods receipt' },
    vbill: { via: ['vbill.create'], noun: 'a vendor bill' },
    pay: { via: ['pay.create'], noun: 'a payment' },
    so: { via: ['so.create'], noun: 'a sales order' },
    inv: { via: ['inv.create'], noun: 'an invoice' },
    rcpt: { via: ['rcpt.create'], noun: 'a receipt' },
    cn: { via: ['cn.create'], noun: 'a stale return' },
    prod: { via: ['prod.create'], noun: 'a production entry' },
    xfer: { via: ['xfer.create'], noun: 'a transfer' },
    dayend: { via: ['dayend.create'], noun: 'a day-end' },
    adj: { via: ['adj.create'], noun: 'a stock count' },
    wo: { via: ['wo.create'], noun: 'a write-off' },
    dep: { via: ['dep.create'], noun: 'a cash deposit' },
    exp: { via: ['exp.claim', 'exp.bill', 'exp.salary'], noun: 'an expense' }
  };
  var EXP_KIND_ACTION = { claim: 'exp.claim', bill: 'exp.bill', salary: 'exp.salary' };

  var OK = { ok: true, code: '', reason: '' };
  function allow() { return { ok: OK.ok, code: OK.code, reason: OK.reason }; }
  function refuse(code, reason) { return { ok: false, code: code, reason: reason }; }

  function joinOr(list) {
    if (list.length < 2) return list.join('');
    return list.slice(0, -1).join(', ') + ' or ' + list[list.length - 1];
  }

  function whoMay(roles) {
    return joinOr(roles.map(function (r) { return ROLE_IN_TEXT[r]; }).concat(['the Owner']));
  }

  /** The role at the head of a sentence: 'The store manager', 'Sales and dispatch'. */
  function roleSubject(role) {
    var s = ROLE_IN_TEXT[role] || ROLE_LABELS[role] || String(role);
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  /** Who raised the document and, for an expense, its kind: given outright, or read from the document. */
  function subject(ctx) {
    var d = ctx.doc || {};
    return {
      kind: ctx.kind || d.kind || null,
      createdBy: ctx.createdBy || d.createdBy || null
    };
  }

  /**
   * What a scope test is about: given outright by the caller, or read from the field the action names - a
   * day-end's store from storeId and from nothing else, whatever other fields the payload carries.
   */
  function scopeValue(ctx, def) {
    var d = ctx.doc || {};
    return ctx[GIVEN[def.scope]] || d[def.from] || null;
  }

  /* A role's stock rights stop at the door of its own stores: goods in transit are nobody's to count or write off. */
  function ownStockLocs(role) {
    return ACCESS[role].locIds.filter(function (id) { return id === '*' || id.indexOf('transit_') !== 0; });
  }

  function scopeRefusal(role, kind, value) {
    var who = roleSubject(role), store = role === 'store_mgr';
    if (!value) return ''; /* the caller has not said what it is for: the role alone is the answer */
    if (kind === 'unit' && !matches(ACCESS[role].unitIds, value)) return who + ' works only for ' + (store ? 'their own store' : 'the factory');
    if (kind === 'loc' && !matches(ownStockLocs(role), value)) return who + ' handles only the stock ' + (store ? 'of their own store' : 'at the factory');
    if (kind === 'account' && !matches(ACCESS[role].accountIds, value)) return who + ' handles only the cash ' + (store ? 'of their own store' : 'at the factory');
    return '';
  }

  /** One create-type action for one user. verb is the sentence fragment used in a refusal. */
  function testAction(u, key, ctx, verb) {
    var def = ACTIONS[key];
    if (u.role === 'owner') return allow();
    if (def.roles.indexOf(u.role) === -1) return refuse('role', roleSubject(u.role) + ' cannot ' + verb + ': that is for ' + whoMay(def.roles));
    var why = def.scope ? scopeRefusal(u.role, def.scope, scopeValue(ctx, def)) : '';
    if (!why) return allow();
    var no = refuse('role', why);
    no.field = def.from; /* the input a form marks: the role may do this, but not for what that field names */
    return no;
  }

  /* ----- personas */

  /* Used until HB.config.users exists, so the shell runs with no data layer. Same ids as the config. */
  var FALLBACK_USERS = [
    { id: 'u_owner', name: 'Nilesh Patel', role: 'owner', employeeId: 'E001' },
    { id: 'u_accounts', name: 'Falguni Shah', role: 'accounts', employeeId: 'E002' },
    { id: 'u_stores', name: 'Imran Vohra', role: 'stores', employeeId: 'E004' },
    { id: 'u_production', name: 'Bharat Prajapati', role: 'production', employeeId: 'E006' },
    { id: 'u_sales', name: 'Hardik Thakkar', role: 'sales', employeeId: 'E021' },
    { id: 'u_store_mgr', name: 'Nisha Desai', role: 'store_mgr', roleLabel: 'Store manager, Vallabh Vidyanagar', employeeId: 'E032' }
  ].map(normaliseUser);

  function initialsOf(name) {
    var words = String(name || '').split(/\s+/).filter(Boolean);
    if (!words.length) return '';
    return (words[0].charAt(0) + (words.length > 1 ? words[words.length - 1].charAt(0) : '')).toUpperCase();
  }

  /** Fill in what a persona record leaves out, so the shell can rely on every field. */
  function normaliseUser(raw) {
    var u = {}, k;
    for (k in raw) if (Object.prototype.hasOwnProperty.call(raw, k)) u[k] = raw[k];
    if (!u.roleLabel) u.roleLabel = ROLE_LABELS[u.role] || u.role;
    if (!u.initials) u.initials = initialsOf(u.name);
    if (!u.unitId) u.unitId = ACCESS[u.role] && ACCESS[u.role].unitIds[0] !== '*' ? ACCESS[u.role].unitIds[0] : 'factory';
    return u;
  }

  /* config.js loads after this file, so the personas are resolved when first asked for, not here. */
  var usersFrom = null, usersCache = null;
  function users() {
    var src = HB.config && HB.config.users;
    if (!Array.isArray(src) || !src.length) return FALLBACK_USERS;
    if (src !== usersFrom) { usersFrom = src; usersCache = src.map(normaliseUser); }
    return usersCache;
  }

  function userById(id) {
    var list = users();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function resolveRole(roleOrNothing) { return roleOrNothing || HB.session.current().role; }

  HB.session = {
    roles: ROLES.slice(),
    roleLabel: function (role) { return ROLE_LABELS[role] || role; },
    access: ACCESS,
    matches: matches,
    userById: userById,
    /** The persona in use. The sample opens as the Owner. */
    current: function () {
      var prefs = HB.store.get('prefs', {}) || {};
      var list = users();
      return userById(prefs.userId) || list.filter(function (u) { return u.role === 'owner'; })[0] || list[0];
    },
    /** Switch persona. Returns the user, or null (and changes nothing) for an unknown id. */
    set: function (userId) {
      var u = userById(userId);
      if (!u) return null;
      var prefs = HB.store.get('prefs', {}) || {};
      prefs.userId = userId;
      HB.store.set('prefs', prefs);
      HB.bus.emit('session:changed', u);
      return u;
    },
    /**
     * can(action, ctx) -> { ok, code, reason }
     * code is '' when ok, else 'own_approval', 'role' (the role may not do it, or not for this unit, location or
     * account - the refusal then also carries field, the input that names it) or 'unknown_action'. reason is a
     * sentence for the disabled control.
     * ctx (all optional): doc, createdBy, unitId, locId, accountId, kind, user - see docs/API.md.
     */
    can: function (action, ctx) {
      ctx = ctx || {};
      var u = ctx.user ? (typeof ctx.user === 'string' ? userById(ctx.user) : ctx.user) : HB.session.current();
      if (!u || !ACCESS[u.role]) return refuse('role', 'This user is not one of the people of the demo');
      var key = String(action || '').toLowerCase();
      var dot = key.indexOf('.');
      var verb = dot === -1 ? key : key.slice(0, dot), rest = dot === -1 ? '' : key.slice(dot + 1);
      var sub = subject(ctx);

      if (verb === 'approve' || verb === 'reject') {
        /* own document before role: the rule must survive a change of approver */
        if (u.role !== 'owner' && sub.createdBy && sub.createdBy === u.id) return refuse('own_approval', 'You raised this document, so you cannot ' + verb + ' it');
        if (u.role !== 'owner') return refuse('role', 'Only the Owner ' + (verb === 'approve' ? 'approves' : 'rejects') + ' documents');
        return allow();
      }

      if (verb === 'cancel') {
        var c = CANCELS[rest];
        if (!c) return refuse('unknown_action', 'This cannot be done in the demo');
        var via = rest === 'exp' && EXP_KIND_ACTION[sub.kind] ? [EXP_KIND_ACTION[sub.kind]] : c.via;
        var first = null;
        for (var i = 0; i < via.length; i++) {
          var res = testAction(u, via[i], ctx, 'cancel ' + c.noun);
          if (res.ok) return res;
          first = first || res;
        }
        return first;
      }

      if (!ACTIONS[key]) return refuse('unknown_action', 'This cannot be done in the demo');
      return testAction(u, key, ctx, ACTIONS[key].what);
    },
    /** Every role that may do a create-type action, the Owner first. [] for an unknown action. */
    rolesFor: function (action) {
      var def = ACTIONS[String(action || '').toLowerCase()];
      return def ? ['owner'].concat(def.roles) : [];
    },
    /** The roles that have a page: what the router takes as the page's roles. */
    pageRoles: function (pageId) {
      return ROLES.filter(function (r) { return matches(ACCESS[r].pages, pageId); });
    },
    /** May the role (default: the current persona's) open the page? */
    canOpen: function (pageId, role) {
      var a = ACCESS[resolveRole(role)];
      return !!a && matches(a.pages, pageId);
    },
    /**
     * What the role (default: the current persona's) may see. Every selector intersects with it:
     * { role, userId, all, unitIds, locIds, accountIds, unit(id), loc(id), account(id) }.
     */
    scope: function (role) {
      var r = resolveRole(role);
      var a = ACCESS[r] || { unitIds: [], locIds: [], accountIds: [] };
      return {
        role: r,
        userId: role ? null : HB.session.current().id,
        all: a.unitIds[0] === '*' && a.locIds[0] === '*' && a.accountIds[0] === '*',
        unitIds: a.unitIds, locIds: a.locIds, accountIds: a.accountIds,
        unit: function (id) { return matches(a.unitIds, id); },
        loc: function (id) { return matches(a.locIds, id); },
        account: function (id) { return matches(a.accountIds, id); }
      };
    },
    /** Salaries are returned only to the Owner and to accounts. */
    canSeeSalaries: function (role) {
      var r = resolveRole(role);
      return r === 'owner' || r === 'accounts';
    },
    /** Which lists of masters-parties the role sees: any of 'customers', 'vendors'. */
    partyKinds: function (role) { return (PARTY_KINDS[resolveRole(role)] || []).slice(); },
    /** 'all' | 'unit' (the role's unit, never the salary bill) | 'own' (the persona's own claims). */
    expenseView: function (role) { return EXPENSE_VIEW[resolveRole(role)] || 'own'; }
  };

  /* HB.session.users: the six personas, as an array. A getter because HB.config arrives after this file. */
  Object.defineProperty(HB.session, 'users', { enumerable: true, get: users });

  if (typeof module !== 'undefined' && module.exports) module.exports = HB;
})(typeof window !== 'undefined' ? window : globalThis);
