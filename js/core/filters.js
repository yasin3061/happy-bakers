/*
 * HB.filters - the one global filter row (date range, unit) and its state.
 * State lives inside the 'prefs' store key and every change emits 'filters:changed'.
 * Every date preset is relative to HB.calendar.today (the business date of this copy), never the device clock.
 * The data layer is optional: units come from HB.masters when present, else HB.config, else there is no unit control.
 *
 * The date control is built so that an earlier month is one click away: the From and To dates stand in the bar and can
 * be typed, the period button lists every month since go-live, and the two arrows step a month (or a range of days)
 * back and forward.
 */
(function (root) {
  'use strict';

  var HB = root.HB;
  if (!HB || !HB.ui || !root.document) return;
  var ui = HB.ui, h = ui.h, D = HB.dates;

  var PRESETS = [
    { id: 'thisMonth', label: 'This month' },
    { id: 'lastMonth', label: 'Last month' },
    { id: 'last7', label: 'Last 7 days' },
    { id: 'last30', label: 'Last 30 days' },
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: 'sinceGoLive', label: 'Since go-live' },
    { id: 'month', label: 'One month' },      /* a named month: state.month = 'YYYY-MM' */
    { id: 'custom', label: 'Custom range' }   /* state.from, state.to */
  ];
  var QUICK = ['thisMonth', 'lastMonth', 'last7', 'last30', 'today', 'yesterday', 'sinceGoLive'];
  var DEFAULT_PRESET = 'thisMonth';
  var UNIT = { key: 'unitIds', all: 'All locations', title: 'Locations', icon: 'store' };

  function isPreset(id) { return PRESETS.some(function (p) { return p.id === id; }); }
  function clampDate(iso) { return D.max(HB.calendar.goLive, D.min(HB.calendar.today, iso)); }
  function inRange(iso) { return D.isIso(iso) && iso >= HB.calendar.goLive && iso <= HB.calendar.today; }

  /* -------------------------------------------------------------- months */

  function isMonthKey(s) { return typeof s === 'string' && /^\d{4}-\d{2}$/.test(s) && D.isIso(s + '-01'); }
  function clampMonth(key) {
    var lo = D.monthKey(HB.calendar.goLive), hi = D.monthKey(HB.calendar.today);
    return key < lo ? lo : (key > hi ? hi : key);
  }
  function shiftMonth(key, n) {
    var y = +key.slice(0, 4), m = +key.slice(5, 7) - 1 + n;
    y += Math.floor(m / 12);
    m = ((m % 12) + 12) % 12;
    return y + '-' + (m < 9 ? '0' : '') + (m + 1);
  }
  /** Every month from the business date's back to go-live, newest first: ['2026-10', '2026-09', ...]. */
  function months() {
    var out = [], key = D.monthKey(HB.calendar.today), lo = D.monthKey(HB.calendar.goLive);
    while (key >= lo) { out.push(key); key = shiftMonth(key, -1); }
    return out;
  }
  /** The range a month covers in this copy: its first day to its last, or to the business date in the current month. */
  function monthRange(key) {
    var from = clampDate(key + '-01');
    return { from: from, to: clampDate(D.monthEnd(key + '-01')) };
  }

  /* ------------------------------------------------------------- options */

  /** A master list as an array, whether the data layer keeps it as an array or as a map by id. */
  function listOf(x) {
    if (Array.isArray(x)) return x;
    if (x && typeof x === 'object') return Object.keys(x).map(function (k) { return x[k]; });
    return [];
  }

  /** The units (the factory and the stores) the persona may see: [{id, label}]. */
  function unitOptions() {
    var source = listOf(HB.masters && HB.masters.units);
    if (!source.length) source = listOf(HB.config && HB.config.units);
    var scope = HB.session.scope();
    return source.filter(function (u) { return u && u.id && scope.unit(u.id); }).map(function (u) {
      return { id: u.id, label: (u.name || u.label || String(u.id)) + (u.active === false ? ' (closed)' : '') };
    });
  }

  function options(kind) { return kind === 'unit' ? unitOptions() : []; }

  /** Selection limited to the valid options; null when it means "everything in scope". */
  function clean(ids, opts) {
    if (!Array.isArray(ids) || !ids.length) return null;
    var picked = opts.filter(function (o) { return ids.indexOf(o.id) !== -1; }).map(function (o) { return o.id; });
    return picked.length === 0 || picked.length === opts.length ? null : picked;
  }

  /* --------------------------------------------------------------- dates */

  /** rangeFor(presetId, {from, to, month}) -> {from, to}, always inside go-live .. business date and in order. */
  function rangeFor(presetId, st) {
    var today = HB.calendar.today;
    var from, to = today;
    switch (presetId) {
      case 'today': from = today; break;
      case 'yesterday': from = to = D.addDays(today, -1); break;
      case 'last7': from = D.addDays(today, -6); break;
      case 'last30': from = D.addDays(today, -29); break;
      case 'lastMonth':
        to = D.addDays(D.monthStart(today), -1);
        from = D.monthStart(to);
        break;
      case 'sinceGoLive': from = HB.calendar.goLive; break;
      case 'month':
        var key = clampMonth(st && isMonthKey(st.month) ? st.month : D.monthKey(today));
        from = key + '-01';
        to = D.monthEnd(from);
        break;
      case 'custom':
        from = st && D.isIso(st.from) ? st.from : D.monthStart(today);
        to = st && D.isIso(st.to) ? st.to : today;
        break;
      default: from = D.monthStart(today);
    }
    from = clampDate(from);
    to = clampDate(to);
    if (from > to) { var swap = from; from = to; to = swap; }
    return { from: from, to: to };
  }

  function rangeLabel(r) {
    var sameYear = r.from.slice(0, 4) === r.to.slice(0, 4);
    if (r.from === r.to) return D.label(r.to, 'd MMM yyyy');
    return D.label(r.from, sameYear ? 'd MMM' : 'd MMM yyyy') + ' - ' + D.label(r.to, 'd MMM yyyy');
  }

  /* --------------------------------------------------------------- state */

  function blank() { return { preset: DEFAULT_PRESET, from: null, to: null, month: null, unitIds: null }; }

  function load() {
    var saved = (HB.store.get('prefs', {}) || {}).filters || {};
    var s = blank();
    if (isPreset(saved.preset)) s.preset = saved.preset;
    if (D.isIso(saved.from)) s.from = saved.from;
    if (D.isIso(saved.to)) s.to = saved.to;
    if (isMonthKey(saved.month)) s.month = saved.month;
    if (Array.isArray(saved.unitIds) && saved.unitIds.length) s.unitIds = saved.unitIds.slice();
    return s;
  }

  var state = load();

  function persist() {
    var prefs = HB.store.get('prefs', {}) || {};
    prefs.filters = { preset: state.preset, from: state.from, to: state.to, month: state.month, unitIds: state.unitIds };
    HB.store.set('prefs', prefs);
  }

  function get() {
    var r = rangeFor(state.preset, state);
    return { from: r.from, to: r.to, unitIds: clean(state.unitIds, unitOptions()), preset: state.preset };
  }

  /**
   * set({preset}) | set({preset: 'month', month: 'YYYY-MM'}) | set({from, to}) (implies preset 'custom') |
   * set({unitIds}) - null means every unit in scope.
   */
  function set(partial) {
    partial = partial || {};
    if (partial.preset && isPreset(partial.preset)) state.preset = partial.preset;
    if (partial.month !== undefined && isMonthKey(partial.month)) {
      state.month = clampMonth(partial.month);
      if (!partial.preset) state.preset = 'month';
    }
    if (partial.from !== undefined || partial.to !== undefined) {
      if (!partial.preset) state.preset = 'custom';
      var r = rangeFor('custom', { from: partial.from || state.from, to: partial.to || state.to });
      state.from = r.from;
      state.to = r.to;
    }
    if (partial.unitIds !== undefined) state.unitIds = clean(partial.unitIds, unitOptions());
    persist();
    HB.bus.emit('filters:changed', get());
  }

  function reset() {
    state = blank();
    persist();
    HB.bus.emit('filters:changed', get());
  }

  function isDefault(showList) {
    var shown = showList && showList.length ? showList : ['date', 'unit'];
    var f = get();
    return !shown.some(function (kind) {
      if (kind === 'date') return f.preset !== DEFAULT_PRESET;
      return kind === 'unit' ? f.unitIds !== null : false;
    });
  }

  function summary(kind) {
    if (kind !== 'unit') return '';
    var opts = unitOptions(), ids = get().unitIds;
    if (!ids) return opts.length === 1 ? opts[0].label : UNIT.all;
    var firstOpt = opts.filter(function (o) { return o.id === ids[0]; })[0];
    return (firstOpt ? firstOpt.label : ids[0]) + (ids.length > 1 ? ' +' + (ids.length - 1) : '');
  }

  function daysText(f) {
    var days = D.diffDays(f.from, f.to) + 1;
    return days + (days === 1 ? ' day' : ' days');
  }

  function describe() {
    var f = get();
    return rangeLabel(f) + ', ' + daysText(f);
  }

  /** What the period button says: the preset's name, or the month by name ("Sep 2026"). */
  function periodLabel(f) {
    if (f.preset === 'month') return D.monthLabel(D.monthKey(f.from), true);
    var p = PRESETS.filter(function (x) { return x.id === f.preset; })[0];
    return p ? p.label : '';
  }

  /* ---------------------------------------------------------------- step */

  /** The range is one calendar month (the current month counts while it runs to the business date). */
  function isMonthRange(f) {
    if (f.preset === 'thisMonth' || f.preset === 'lastMonth' || f.preset === 'month') return true;
    return D.monthStart(f.from) === f.from && D.monthEnd(f.from) === f.to;
  }

  function canStep(dir) {
    var f = get();
    return dir < 0 ? f.from > HB.calendar.goLive : f.to < HB.calendar.today;
  }

  /** step(-1) | step(1): a month range moves by one month, any other range by its own length in days. */
  function step(dir) {
    if (!canStep(dir)) return;
    var f = get();
    if (isMonthRange(f)) {
      var key = clampMonth(shiftMonth(D.monthKey(f.from), dir < 0 ? -1 : 1));
      if (key === D.monthKey(HB.calendar.today)) set({ preset: DEFAULT_PRESET }); else set({ preset: 'month', month: key });
      return;
    }
    var n = D.diffDays(f.from, f.to) + 1, from, to;
    if (dir < 0) { to = D.addDays(f.from, -1); from = D.addDays(to, -(n - 1)); }
    else { from = D.addDays(f.to, 1); to = D.addDays(from, n - 1); }
    set({ from: clampDate(from), to: clampDate(to) });
  }

  /* ----------------------------------------------------------------- bar */

  var mounted = null; /* {container, showList, refresh} */

  function menuRow(o) {
    return h('button', { type: 'button', role: o.role || 'menuitem', 'aria-checked': o.role ? 'false' : null, 'class': 'mk-menu__item', 'data-autofocus': o.autofocus ? '' : null, onClick: o.onClick },
      o.lead || null,
      h('span', { 'class': 'mk-menu__main' }, o.label),
      o.hint ? h('span', { 'class': 'mk-menu__hint' }, o.hint) : null,
      o.tick ? h('span', { 'class': 'mk-menu__tick' }) : null);
  }

  function openDatePopover(anchor) {
    var pop = null, current = get(), focused = false;
    function pick(partial) { if (pop) pop.close(); set(partial); }
    function row(label, hint, selected, partial) {
      var r = menuRow({ label: label, hint: hint, tick: true, autofocus: selected && !focused, onClick: function () { pick(partial); } });
      if (selected) { focused = true; r.classList.add('is-selected'); r.lastChild.appendChild(ui.icon('check')); }
      return r;
    }
    var quick = QUICK.map(function (id) {
      var p = PRESETS.filter(function (x) { return x.id === id; })[0];
      return row(p.label, rangeLabel(rangeFor(id)), current.preset === id, { preset: id });
    });
    var thisMonth = D.monthKey(HB.calendar.today);
    var byMonth = months().map(function (key) {
      var r = monthRange(key), selected = current.from === r.from && current.to === r.to;
      /* the current month is the default range: picking it leaves nothing to reset */
      return row(D.monthLabel(key, true), key === thisMonth ? 'to ' + D.label(r.to, 'd MMM') : null, selected,
        key === thisMonth ? { preset: DEFAULT_PRESET } : { preset: 'month', month: key });
    });
    pop = ui.popover(anchor, [
      h('div', { 'class': 'mk-menu__heading' }, 'Range'), quick,
      h('div', { 'class': 'mk-menu__sep', role: 'separator' }),
      h('div', { 'class': 'mk-menu__heading' }, 'Month'), byMonth
    ], { width: 280 });
  }

  function openUnitPopover(anchor) {
    var opts = unitOptions();
    var boxes = {};
    function box() { return h('input', { type: 'checkbox', 'class': 'mk-menu__check', tabindex: -1, 'aria-hidden': 'true' }); }
    function sync() {
      var ids = get().unitIds;
      Object.keys(boxes).forEach(function (id) {
        var on = id === '*' ? !ids : !!ids && ids.indexOf(id) !== -1;
        boxes[id].input.checked = on;
        boxes[id].row.setAttribute('aria-checked', on ? 'true' : 'false');
        boxes[id].row.classList.toggle('is-selected', id === '*' && on);
      });
    }
    function makeRow(id, label, onClick) {
      var input = box();
      var row = menuRow({ role: 'menuitemcheckbox', label: label, autofocus: id === '*', onClick: onClick, lead: input });
      boxes[id] = { input: input, row: row };
      return row;
    }
    var rows = [makeRow('*', UNIT.all, function () { set({ unitIds: null }); sync(); })];
    rows.push(h('div', { 'class': 'mk-menu__sep', role: 'separator' }));
    opts.forEach(function (opt) {
      rows.push(makeRow(opt.id, opt.label, function () {
        var ids = (get().unitIds || []).slice();
        var at = ids.indexOf(opt.id);
        if (at === -1) ids.push(opt.id); else ids.splice(at, 1);
        set({ unitIds: ids.length ? ids : null });
        sync();
      }));
    });
    ui.popover(anchor, [h('div', { 'class': 'mk-menu__heading' }, UNIT.title), rows], { width: 240 });
    sync();
  }

  /**
   * mountBar(container, ['date', 'unit']) - renders only the requested controls, plus "Reset filters" when one of
   * them is not at its default. An empty list hides the bar.
   */
  function mountBar(container, showList) {
    var show = (showList || []).filter(function (k) { return k === 'date' || k === 'unit'; });
    ui.clear(container);
    mounted = null;
    if (!show.length) { container.hidden = true; return; }
    container.hidden = false;
    container.setAttribute('role', 'toolbar');
    container.setAttribute('aria-label', 'Filters');

    var updaters = [];
    var refresh = function () {};
    if (show.indexOf('date') !== -1) {
      var stepBtn = function (icon, label, dir) {
        return h('button', { type: 'button', 'class': 'mk-fstep', 'aria-label': label, title: label, onClick: function () { step(dir); } }, ui.icon(icon, 16));
      };
      var prevBtn = stepBtn('chevron-left', 'Earlier', -1), nextBtn = stepBtn('chevron-right', 'Later', 1);
      var dateValue = h('span', { 'class': 'mk-fctl__val' });
      var dateBtn = h('button', { type: 'button', 'class': 'mk-fctl', onClick: function () { openDatePopover(dateBtn); } }, ui.icon('calendar'), dateValue, ui.icon('chevron-down', 14));

      /* A typed date counts once it is a whole date inside go-live .. business date. A native date box reports
         half-typed years (0002, 0020, ...) as changes: those are out of range and are left alone until the date is done. */
      var applyTyped = function () {
        var a = fromInput.value, b = toInput.value, cur = get();
        if (!inRange(a) || !inRange(b) || (a === cur.from && b === cur.to)) return;
        set({ from: a, to: b });
      };
      var fromInput = ui.form.dateInput({ min: HB.calendar.goLive, max: HB.calendar.today, ariaLabel: 'From date', onChange: applyTyped });
      var toInput = ui.form.dateInput({ min: HB.calendar.goLive, max: HB.calendar.today, ariaLabel: 'To date', onChange: applyTyped });
      /* leaving a box puts back what stands, so a date that was not taken never stays on screen */
      [fromInput, toInput].forEach(function (el) { el.addEventListener('blur', function () { refresh(); }); });

      container.appendChild(h('span', { 'class': 'mk-fgroup' }, prevBtn, dateBtn, nextBtn));
      container.appendChild(h('label', { 'class': 'mk-fdate' }, h('span', null, 'From'), fromInput));
      container.appendChild(h('label', { 'class': 'mk-fdate' }, h('span', null, 'To'), toInput));
      updaters.push(function (f) {
        dateValue.textContent = periodLabel(f);
        dateBtn.classList.toggle('is-set', f.preset !== DEFAULT_PRESET);
        dateBtn.setAttribute('aria-label', 'Period: ' + dateValue.textContent + ', ' + rangeLabel(f));
        var active = root.document.activeElement;
        if (active !== fromInput) fromInput.value = f.from;
        if (active !== toInput) toInput.value = f.to;
        prevBtn.disabled = !canStep(-1);
        nextBtn.disabled = !canStep(1);
      });
    }
    if (show.indexOf('unit') !== -1) {
      var opts = unitOptions();
      if (opts.length === 1) {
        /* a persona scoped to one unit (the store manager) sees where it stands, with nothing to choose */
        container.appendChild(h('span', { 'class': 'mk-fctl mk-fctl--locked', title: 'Your role is limited to this location' }, ui.icon('lock', 14), h('span', { 'class': 'mk-fctl__val' }, opts[0].label)));
      } else if (opts.length > 1) {
        var unitValue = h('span', { 'class': 'mk-fctl__val' });
        var unitBtn = h('button', { type: 'button', 'class': 'mk-fctl', onClick: function () { openUnitPopover(unitBtn); } }, ui.icon(UNIT.icon), unitValue, ui.icon('chevron-down', 14));
        container.appendChild(unitBtn);
        updaters.push(function (f) {
          unitValue.textContent = summary('unit');
          unitBtn.classList.toggle('is-set', f.unitIds !== null);
          unitBtn.setAttribute('aria-label', UNIT.title + ': ' + unitValue.textContent);
        });
      }
    }

    var resetBtn = ui.button({ label: 'Reset filters', variant: 'text', size: 'sm', onClick: reset });
    var rangeText = h('span', { 'class': 'mk-filterbar__range' });
    container.appendChild(resetBtn);
    container.appendChild(h('span', { 'class': 'mk-filterbar__spacer' }));
    if (show.indexOf('date') !== -1) container.appendChild(rangeText);

    refresh = function () {
      var f = get();
      updaters.forEach(function (fn) { fn(f); });
      resetBtn.hidden = isDefault(show);
      /* the dates themselves stand in the From and To boxes: beside them, only how long the range is */
      rangeText.textContent = daysText(f);
    };
    mounted = { container: container, showList: show, refresh: refresh };
    refresh();
  }

  HB.bus.on('filters:changed', function () { if (mounted) mounted.refresh(); });

  /* a new persona may see fewer units: drop what it cannot see and rebuild the control */
  HB.bus.on('session:changed', function () {
    var before = JSON.stringify(state.unitIds);
    state.unitIds = clean(state.unitIds, unitOptions());
    if (mounted) mountBar(mounted.container, mounted.showList);
    if (JSON.stringify(state.unitIds) !== before) { persist(); HB.bus.emit('filters:changed', get()); }
  });

  HB.bus.on('store:changed', function (evt) {
    var key = evt && evt.key;
    if (key === '*') { state = blank(); if (mounted) mounted.refresh(); return; }
    /* a posted master change may have added or closed a location: the unit control is rebuilt from the masters */
    if (key !== 'prefs' && mounted && mounted.showList.indexOf('unit') !== -1) mountBar(mounted.container, mounted.showList);
  });

  HB.filters = {
    get: get, set: set, reset: reset, step: step, canStep: canStep, mountBar: mountBar, isDefault: isDefault, describe: describe,
    options: options, summary: summary, months: months,
    presets: function () {
      return PRESETS.map(function (p) {
        var r = p.id === 'custom' || p.id === 'month' ? null : rangeFor(p.id);
        return { id: p.id, label: p.label, from: r && r.from, to: r && r.to };
      });
    },
    range: function (presetId) { return rangeFor(presetId, state); },
    rangeLabel: rangeLabel
  };
})(typeof window !== 'undefined' ? window : globalThis);
