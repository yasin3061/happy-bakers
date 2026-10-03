/*
 * HB.forms - the document kit: everything a page needs to list, enter, show and print a document.
 * Inputs (quantity, rate, amount, date, pickers), the editable line grid, the matrix grid, the full-page document
 * form and document view, status tabs, the locked teaser card, the reason dialog, the "posted" toast and printing.
 *
 * Three rules hold throughout:
 *  - Money leaves every control as whole PAISE and a rate as paise per unit; text is parsed digit by digit, never
 *    through a float, so what was typed is what is stored. Nothing here rounds to the rupee.
 *  - A form holds no rule of the business. It shows what the page's preview and submit callbacks return
 *    (HB.engine.preview / HB.engine.act) and marks the field an error names.
 *  - The draft lives in the object the caller passes (the router's per-route state), so a redraw rebuilds the form
 *    exactly as it was, focus included.
 * Contract for page authors: docs/shell/UI-API.md, chapter "HB.forms". Live reference: tools/harness/styleguide.js.
 */
(function (root) {
  'use strict';

  var HB = root.HB;
  if (!HB || !HB.ui || !root.document) return;
  var ui = HB.ui, h = ui.h, doc = root.document, fmt = HB.fmt;
  var forms = HB.forms = {};
  var DASH = '-';

  /* -------------------------------------------------------------- helpers */

  function isNode(x) { return !!x && typeof x === 'object' && typeof x.nodeType === 'number'; }
  function isNum(x) { return typeof x === 'number' && isFinite(x); }
  function blank(x) { return x === null || x === undefined || x === ''; }
  /** A value, or the result of calling it when it is a function. */
  function resolve(v, a, b, c) { return typeof v === 'function' ? v(a, b, c) : v; }
  function assign(target) {
    for (var i = 1; i < arguments.length; i++) {
      var src = arguments[i];
      if (src) Object.keys(src).forEach(function (k) { target[k] = src[k]; });
    }
    return target;
  }
  /** A master list as an array, whether the data layer keeps it as an array or as a map by id. */
  function listOf(x) {
    if (Array.isArray(x)) return x;
    if (x && typeof x === 'object') return Object.keys(x).map(function (k) { return x[k]; });
    return [];
  }
  function masterList(name) { return listOf(HB.masters && HB.masters[name]).filter(Boolean); }
  function byId(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].id === id) return list[i];
    return null;
  }
  function logError(where, e) { if (root.console) root.console.error('[HB.forms] ' + where, e); }
  function setKey(el, fkey) { if (el && fkey) el.setAttribute('data-fkey', fkey); }

  /* ------------------------------------------------------- decimal inputs */
  /*
   * One control, three kinds. Each keeps its value as an integer count of its smallest step, parsed from the text
   * by digits: a quantity in thousandths of a unit, a rate in ten-thousandths of a rupee, an amount in paise.
   */

  var KIND = {
    qty: { decimals: 3, minShown: 0 },     /* units, up to three decimals */
    rate: { decimals: 4, minShown: 2 },    /* rupees per unit typed with up to four decimals -> paise per unit */
    amount: { decimals: 2, minShown: 2 }   /* rupees with paise typed in -> whole paise */
  };

  /* the whole digits a box takes: 99,99,999 units, a rate of 9,99,999 rupees, an amount of 99,99,99,999 rupees */
  var WHOLE_DIGITS = { qty: 7, rate: 6, amount: 9 };

  function toSteps(kind, v) {
    if (!isNum(v)) return null;
    return Math.round(kind === 'qty' ? v * 1000 : (kind === 'rate' ? v * 100 : v));
  }
  function fromSteps(kind, n) { return kind === 'qty' ? n / 1000 : (kind === 'rate' ? n / 100 : n); }

  /** '1,234.5' with 2 decimals -> 123450; '' or text with no digit -> null. Extra decimals are cut, never rounded up. */
  function parseSteps(text, decimals) {
    var s = String(blank(text) ? '' : text).replace(/[,\s]/g, '');
    var neg = s.charAt(0) === '-';
    if (neg) s = s.slice(1);
    if (!/^\d*\.?\d*$/.test(s) || !/\d/.test(s)) return null;
    var parts = s.split('.');
    var frac = (parts[1] || '').slice(0, decimals);
    while (frac.length < decimals) frac += '0';
    var n = Number((parts[0] || '0') + frac);
    return neg && n !== 0 ? -n : n;
  }

  /** 123450 with 2 decimals -> '1234.50'; trailing zeros beyond minShown are dropped. */
  function stepsText(n, decimals, minShown) {
    var s = String(Math.abs(n));
    while (s.length <= decimals) s = '0' + s;
    var whole = decimals ? s.slice(0, s.length - decimals) : s;
    var frac = decimals ? s.slice(s.length - decimals).replace(/0+$/, '') : '';
    while (frac.length < minShown) frac += '0';
    return (n < 0 ? '-' : '') + whole + (frac ? '.' + frac : '');
  }

  function groupIndian(text) {
    var neg = text.charAt(0) === '-';
    var body = neg ? text.slice(1) : text;
    var dot = body.indexOf('.');
    var whole = dot === -1 ? body : body.slice(0, dot), rest = dot === -1 ? '' : body.slice(dot);
    if (whole.length > 3) whole = whole.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + whole.slice(-3);
    return (neg ? '-' : '') + whole + rest;
  }

  /** What the user may have in the box while typing: digits, one point, at most `decimals` after it. */
  function cleanTyped(text, decimals, allowNegative, maxWhole) {
    var s = String(text).replace(/[^\d.\-]/g, '');
    var neg = allowNegative && s.charAt(0) === '-';
    s = s.replace(/-/g, '');
    var dot = s.indexOf('.');
    if (dot !== -1) s = decimals ? s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, '').slice(0, decimals) : s.slice(0, dot);
    /* a guard against a slip of the hand: no more whole digits than the box is for (a key held down, a pasted number) */
    if (maxWhole) { dot = s.indexOf('.'); s = (dot === -1 ? s : s.slice(0, dot)).slice(0, maxWhole) + (dot === -1 ? '' : s.slice(dot)); }
    return (neg ? '-' : '') + s;
  }

  function decimalInput(kind, o) {
    o = o || {};
    var K = KIND[kind];
    var typed = kind === 'qty' && isNum(o.decimals) ? Math.max(0, Math.min(3, Math.floor(o.decimals))) : K.decimals;
    var steps = toSteps(kind, o.value);
    var input = h('input', {
      'class': 'mk-numin__input', type: 'text', inputmode: typed ? 'decimal' : 'numeric', autocomplete: 'off',
      placeholder: o.placeholder !== undefined ? o.placeholder : (kind === 'qty' ? '0' : '0.00'),
      name: o.name, 'aria-label': o.ariaLabel, disabled: o.disabled ? true : null, readOnly: o.readOnly ? true : null
    });
    setKey(input, o.fkey);
    var prefix = kind !== 'qty' && (o.prefix !== undefined ? !!o.prefix : !o.cell);
    var unit = o.unit || '';
    var unitEl = h('span', { 'class': 'mk-numin__suf' });
    /* beside a quantity the unit reads as it would in a sentence: 1 pack, 12 packs (HB.fmt.unitFor); an empty box counts as many */
    function paintUnit() {
      var q = steps === null ? 0 : fromSteps(kind, steps);
      unitEl.textContent = kind === 'qty' && typeof fmt.unitFor === 'function' ? fmt.unitFor(q, unit) : unit;
      unitEl.hidden = !unit;
    }
    var wrap = h('span', { 'class': ['mk-numin', 'mk-numin--' + kind, o.cell ? 'mk-numin--cell' : '', o.disabled || o.readOnly ? 'is-off' : '', o.className] },
      prefix ? h('span', { 'class': 'mk-numin__pre', 'aria-hidden': 'true' }, fmt.rupee) : null, input, unitEl);

    function text(focused) {
      if (steps === null) return '';
      var t = stepsText(steps, K.decimals, K.minShown);
      if (!focused) return groupIndian(t);
      return K.minShown && /\.0+$/.test(t) ? t.replace(/\.0+$/, '') : t; /* whole rupees are edited as '1200' */
    }
    function show() { input.value = text(doc.activeElement === input); }

    input.addEventListener('focus', function () { show(); if (!input.readOnly) input.select(); });
    input.addEventListener('input', function () {
      var clean = cleanTyped(input.value, typed, !!o.allowNegative, WHOLE_DIGITS[kind]);
      if (clean !== input.value) input.value = clean;
      steps = parseSteps(clean, K.decimals);
      paintUnit();
      if (typeof o.onChange === 'function') o.onChange(steps === null ? null : fromSteps(kind, steps), wrap);
    });
    input.addEventListener('blur', show);
    if (typeof o.onEnter === 'function') input.addEventListener('keydown', function (e) { if (e.key === 'Enter') o.onEnter(wrap.getValue(), wrap); });
    show();
    paintUnit();

    wrap.input = input;
    wrap.getValue = function () { return steps === null ? null : fromSteps(kind, steps); };
    /** Silent: sets the value and repaints; onChange does not fire. */
    wrap.setValue = function (v) { steps = toSteps(kind, v); show(); paintUnit(); };
    wrap.setUnit = function (u) { unit = u || ''; paintUnit(); };
    wrap.setInvalid = function (message) {
      if (message) { input.setAttribute('aria-invalid', 'true'); wrap.classList.add('is-invalid'); wrap.title = String(message); }
      else { input.removeAttribute('aria-invalid'); wrap.classList.remove('is-invalid'); wrap.removeAttribute('title'); }
    };
    return wrap;
  }

  /**
   * qtyInput({value, onChange(qty | null), decimals (0-3, default 3), unit, placeholder, disabled, readOnly, ariaLabel, name, cell, allowNegative})
   * value and result are units with at most `decimals` decimals; decimals: 0 for finished goods (whole units).
   */
  forms.qtyInput = function (o) { return decimalInput('qty', o); };
  /** rateInput({value, onChange(paisePerUnit | null), unit, ...}) - typed in rupees with up to four decimals; value and result are PAISE per unit. */
  forms.rateInput = function (o) { return decimalInput('rate', o); };
  /** amountInput({value, onChange(paise | null), ...}) - typed in rupees with paise; value and result are whole PAISE. */
  forms.amountInput = function (o) { return decimalInput('amount', o); };

  /* ----------------------------------------------------------- date, select */

  /**
   * dateInput({value, min, max, onChange(iso), disabled, ariaLabel, name, cell})
   * A native date box bounded by the business date: max defaults to HB.calendar.today, min to HB.calendar.lockBefore,
   * value to today. A date outside the bounds is kept and marked, so the engine's own refusal can explain it.
   */
  forms.dateInput = function (o) {
    o = o || {};
    var cal = HB.calendar;
    var max = o.max === undefined ? cal.today : o.max;
    var min = o.min === undefined ? cal.lockBefore : o.min;
    var input = ui.form.dateInput({
      value: o.value === undefined ? cal.today : o.value, min: min || null, max: max || null, name: o.name, ariaLabel: o.ariaLabel, disabled: o.disabled,
      onChange: function (v) { check(); if (typeof o.onChange === 'function') o.onChange(v, input); }
    });
    if (o.cell) input.classList.add('mk-input--cell');
    setKey(input, o.fkey);
    function check() {
      var v = input.value;
      var why = !v ? '' : (max && v > max ? 'Not after ' + HB.dates.label(max, 'd MMM yyyy') : (min && v < min ? 'Not before ' + HB.dates.label(min, 'd MMM yyyy') : ''));
      if (why) { input.setAttribute('aria-invalid', 'true'); input.title = why; }
      else { input.removeAttribute('aria-invalid'); input.removeAttribute('title'); }
    }
    check();
    input.input = input;
    input.getValue = function () { return input.value || null; };
    input.setValue = function (v) { input.value = v || ''; check(); };
    return input;
  };

  /**
   * selectInput({options: [{value, label, disabled}] | [string], value, onChange(value), placeholder, disabled, ariaLabel, name, cell})
   * A native select at full width. Wrapper: .input, .getValue(), .setValue(v), .setOptions(list).
   */
  forms.selectInput = function (o) {
    o = o || {};
    var wrap = ui.select({
      options: o.options || [], value: o.value, placeholder: o.placeholder, name: o.name, ariaLabel: o.ariaLabel, disabled: o.disabled, block: true,
      onChange: function (v) { if (typeof o.onChange === 'function') o.onChange(v === '' ? null : v, wrap); }
    });
    if (o.cell) wrap.classList.add('mk-selectwrap--cell');
    setKey(wrap.input, o.fkey);
    var getValue = wrap.getValue;
    wrap.getValue = function () { var v = getValue(); return v === '' ? null : v; };
    wrap.setValue = function (v) { wrap.input.value = blank(v) ? '' : v; };
    wrap.setOptions = function (list, value) {
      var keep = value === undefined ? wrap.input.value : value;
      ui.clear(wrap.input);
      if (o.placeholder) wrap.input.appendChild(h('option', { value: '', disabled: true, selected: blank(keep) }, o.placeholder));
      (list || []).forEach(function (opt) {
        var x = typeof opt === 'object' ? opt : { value: opt, label: String(opt) };
        wrap.input.appendChild(h('option', { value: x.value, selected: String(x.value) === String(keep), disabled: x.disabled ? true : null }, x.label));
      });
    };
    return wrap;
  };

  /* ------------------------------------------------------- type-ahead picker */
  /*
   * A text box with a list under it. Typing narrows the list; Down / Up move, Enter or Tab take the highlighted row,
   * Esc closes the list and puts the text back. The list is positioned on the overlay layer so a table or a drawer
   * never clips it. One list is open at a time.
   */

  var LIST_MAX = 60;
  var openList = null; /* {close} of the picker whose list is showing */

  function normaliseOptions(list) {
    return listOf(list).filter(function (x) { return x !== null && x !== undefined; }).map(function (x) {
      if (typeof x !== 'object') return { id: x, label: String(x), sub: '', text: String(x).toLowerCase(), data: x };
      var label = x.label !== undefined ? x.label : (x.name !== undefined ? x.name : String(x.id));
      return { id: x.id, label: String(label), sub: x.sub ? String(x.sub) : '', disabled: !!x.disabled, data: x.data !== undefined ? x.data : x,
        text: (label + ' ' + (x.sub || '') + ' ' + (x.search || '') + ' ' + x.id).toLowerCase() };
    });
  }

  function combo(o) {
    o = o || {};
    var value = blank(o.value) ? null : o.value;
    var listId = ui.uid('mk-combo');
    var listEl = null, shown = [], active = -1, typing = false;

    var input = h('input', {
      'class': ['mk-input', 'mk-combo__input', o.cell ? 'mk-input--cell' : ''], type: 'text', role: 'combobox', 'aria-autocomplete': 'list',
      'aria-expanded': 'false', 'aria-controls': listId, autocomplete: 'off', spellcheck: 'false',
      placeholder: o.placeholder || 'Type to search', 'aria-label': o.ariaLabel, name: o.name, disabled: o.disabled ? true : null
    });
    setKey(input, o.fkey);
    var wrap = h('span', { 'class': ['mk-combo', o.cell ? 'mk-combo--cell' : ''] }, input, ui.icon('chevron-down', 14));

    function options() { return normaliseOptions(resolve(o.options)); }
    function selected(list) {
      list = list || options();
      for (var i = 0; i < list.length; i++) if (list[i].id === value) return list[i];
      return null;
    }
    function showValue() {
      var s = selected();
      /* an id the list no longer holds (a deactivated party) still shows as its id rather than as nothing */
      input.value = s ? s.label : (value === null ? '' : String(value));
      if (s && s.sub) input.title = s.label + ' - ' + s.sub; else input.removeAttribute('title');
    }

    function matches(q) {
      var all = options();
      var words = q.toLowerCase().split(/\s+/).filter(Boolean);
      if (!words.length) return all;
      var first = words[0];
      function rank(opt) { var l = opt.label.toLowerCase(); return l.indexOf(first) === 0 ? 0 : (l.indexOf(' ' + first) !== -1 ? 1 : 2); }
      return all.filter(function (opt) { return words.every(function (w) { return opt.text.indexOf(w) !== -1; }); })
        .map(function (opt, i) { return { opt: opt, i: i, r: rank(opt) }; })
        .sort(function (a, b) { return a.r - b.r || a.i - b.i; })
        .map(function (x) { return x.opt; });
    }

    function place() {
      if (!listEl) return;
      if (!input.isConnected) { close(); return; }
      var r = input.getBoundingClientRect();
      var vw = doc.documentElement.clientWidth, vh = doc.documentElement.clientHeight;
      var w = Math.min(Math.max(r.width, o.listWidth || 280), vw - 16);
      listEl.style.width = Math.round(w) + 'px';
      var ht = listEl.offsetHeight;
      var top = r.bottom + 2;
      if (top + ht > vh - 8 && r.top - ht - 2 > 8) top = r.top - ht - 2;
      listEl.style.left = Math.round(Math.max(8, Math.min(r.left, vw - w - 8))) + 'px';
      listEl.style.top = Math.round(Math.max(8, top)) + 'px';
    }

    function paint() {
      ui.clear(listEl);
      if (!shown.length) {
        listEl.appendChild(h('div', { 'class': 'mk-combo__empty' }, o.emptyText || 'Nothing matches'));
        input.removeAttribute('aria-activedescendant');
        return;
      }
      shown.slice(0, LIST_MAX).forEach(function (opt, i) {
        var row = h('div', {
          'class': ['mk-combo__opt', i === active ? 'is-active' : '', opt.id === value ? 'is-current' : '', opt.disabled ? 'is-disabled' : ''],
          role: 'option', id: listId + '-' + i, 'aria-selected': i === active ? 'true' : 'false', 'aria-disabled': opt.disabled ? 'true' : null,
          onMousedown: function (e) { e.preventDefault(); if (!opt.disabled) pick(opt, 'click'); } /* preventDefault keeps the focus in the box */
        }, h('span', { 'class': 'mk-combo__label' }, opt.label), opt.sub ? h('span', { 'class': 'mk-combo__sub' }, opt.sub) : null);
        listEl.appendChild(row);
      });
      if (shown.length > LIST_MAX) listEl.appendChild(h('div', { 'class': 'mk-combo__empty' }, (shown.length - LIST_MAX) + ' more - keep typing'));
      if (active >= 0) {
        input.setAttribute('aria-activedescendant', listId + '-' + active);
        var el = listEl.children[active];
        if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
      } else input.removeAttribute('aria-activedescendant');
    }

    function open(all) {
      if (input.disabled || input.readOnly) return;
      if (openList && openList.close !== close) openList.close();
      if (!listEl) {
        listEl = h('div', { 'class': 'mk-combo__list', role: 'listbox', id: listId });
        (doc.getElementById('mk-overlays') || doc.body).appendChild(listEl);
        doc.addEventListener('scroll', onScroll, true);
        root.addEventListener('resize', close);
        input.setAttribute('aria-expanded', 'true');
        openList = { close: close };
      }
      shown = all ? options() : matches(input.value);
      active = -1;
      if (all) shown.forEach(function (opt, i) { if (opt.id === value) active = i; });
      else if (shown.length) active = 0; /* the best match is one Enter away */
      if (active >= LIST_MAX) active = -1;
      paint();
      place();
    }

    function close() {
      if (!listEl) return;
      doc.removeEventListener('scroll', onScroll, true);
      root.removeEventListener('resize', close);
      if (listEl.parentNode) listEl.parentNode.removeChild(listEl);
      listEl = null;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      if (openList && openList.close === close) openList = null;
    }

    function onScroll(e) { if (listEl && e.target !== listEl && !(e.target.nodeType === 1 && listEl.contains(e.target))) place(); }

    function pick(opt, via) {
      var changed = opt.id !== value;
      value = opt.id;
      typing = false;
      close();
      showValue();
      if (typeof o.onChange === 'function' && (changed || via !== 'blur')) o.onChange(value, opt.data, { via: via });
    }

    function move(step) {
      var n = Math.min(shown.length, LIST_MAX);
      if (!n) return;
      var i = active;
      for (var tries = 0; tries < n; tries++) {
        i = (i + step + n) % n;
        if (!shown[i].disabled) break;
      }
      active = i;
      paint();
    }

    input.addEventListener('focus', function () { input.select(); });
    input.addEventListener('mousedown', function () { if (doc.activeElement === input && !listEl) open(true); });
    input.addEventListener('click', function () { if (!listEl) open(true); });
    input.addEventListener('input', function () { typing = true; open(false); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!listEl) { if (e.key === 'ArrowUp') return; open(true); } /* a closed box lets Up through, for a grid to move a row */
        else move(e.key === 'ArrowDown' ? 1 : -1);
        e.preventDefault(); e.stopPropagation();
      } else if (e.key === 'Enter') {
        if (!listEl) return; /* closed: Enter belongs to whatever holds the box (a grid moves down) */
        e.preventDefault(); e.stopPropagation();
        if (active >= 0 && shown[active] && !shown[active].disabled) pick(shown[active], 'Enter'); else close();
      } else if (e.key === 'Escape') {
        if (!listEl) return;
        e.preventDefault(); e.stopPropagation();
        typing = false; close(); showValue(); input.select();
      } else if (e.key === 'Tab') {
        if (listEl && typing && active >= 0 && shown[active] && !shown[active].disabled) pick(shown[active], 'Tab');
      }
    });
    input.addEventListener('blur', function () {
      close();
      if (typing && input.value.trim() === '' && value !== null && o.clearable !== false) {
        value = null;
        if (typeof o.onChange === 'function') o.onChange(null, null, { via: 'clear' });
      }
      typing = false;
      showValue();
    });

    showValue();
    wrap.input = input;
    wrap.getValue = function () { return value; };
    /** Silent: sets the value and repaints; onChange does not fire. */
    wrap.setValue = function (v) { value = blank(v) ? null : v; if (doc.activeElement !== input || !typing) showValue(); };
    wrap.setOptions = function (list) { o.options = list; showValue(); };
    wrap.setInvalid = function (message) {
      if (message) { input.setAttribute('aria-invalid', 'true'); wrap.title = String(message); }
      else { input.removeAttribute('aria-invalid'); wrap.removeAttribute('title'); }
    };
    wrap.open = function () { input.focus(); open(true); };
    return wrap;
  }

  HB.bus.on('route:changed', function () { if (openList) openList.close(); });

  /**
   * picker({options: [{id, label, sub, search, disabled}] | function, value, onChange(id | null, record, {via}), placeholder,
   * emptyText, clearable, disabled, ariaLabel, name, cell, listWidth}) - the type-ahead on any list.
   */
  forms.picker = combo;

  var PARTY_LISTS = { customer: 'customers', vendor: 'vendors', employee: 'employees' };

  /** What a vendor supplies, in words: the masters hold item ids ("RM01"), the list shows names ("Maida, Sugar +2"). */
  function suppliesText(supplies) {
    if (typeof supplies === 'string') return supplies;
    var ids = listOf(supplies).filter(function (x) { return !blank(x); });
    if (!ids.length) return '';
    var items = masterList('items');
    var names = ids.slice(0, 2).map(function (id) { var it = byId(items, id); return it ? it.name : String(id); });
    return names.join(', ') + (ids.length > 2 ? ' +' + (ids.length - 2) : '');
  }

  function partySub(p, kind) {
    if (kind === 'customer') return [p.locality, p.channel === 'corporate' ? 'Corporate' : p.outletType].filter(Boolean).join(' - ');
    if (kind === 'vendor') return [p.town, suppliesText(p.supplies)].filter(Boolean).join(' - ');
    return [p.designation, p.dept].filter(Boolean).join(' - ');
  }

  /**
   * partyPicker({kind: 'customer' | 'vendor' | 'employee', value, onChange(id | null, party), options, filter(party),
   * includeInactive, placeholder, ...picker options}) - a type-ahead on HB.masters (customers, vendors or employees).
   * options replaces the master list (an array of party records, or of {id, label, sub}).
   */
  forms.partyPicker = function (o) {
    o = o || {};
    var kind = PARTY_LISTS[o.kind] ? o.kind : 'customer';
    var control;
    function options() {
      var current = control ? control.getValue() : o.value;
      var src = o.options ? listOf(resolve(o.options)) : masterList(PARTY_LISTS[kind]);
      return src.filter(function (p) {
        if (!p || blank(p.id)) return false;
        if (p.active === false && !o.includeInactive && p.id !== current) return false;
        return typeof o.filter === 'function' ? !!o.filter(p) : true;
      }).map(function (p) {
        return { id: p.id, label: p.label || p.name || String(p.id), sub: p.sub !== undefined ? p.sub : partySub(p, kind), search: p.gstin || '', data: p };
      });
    }
    control = combo(assign({ placeholder: 'Search ' + kind + 's' }, o, { options: options }));
    return control;
  };

  /**
   * itemPicker({kind: 'fg' | 'rm' | 'pk' | [kinds], value, onChange(id | null, item), items, filter(item), includeInactive,
   * placeholder, ...picker options}) - a type-ahead on HB.masters.items (or on `items`), by name or code.
   */
  forms.itemPicker = function (o) {
    o = o || {};
    var kinds = o.kind ? [].concat(o.kind) : null;
    var control;
    function options() {
      var current = control ? control.getValue() : o.value;
      var src = o.items ? listOf(resolve(o.items)) : masterList('items');
      return src.filter(function (it) {
        if (!it || blank(it.id)) return false;
        if (kinds && it.kind && kinds.indexOf(it.kind) === -1) return false;
        if (it.active === false && !o.includeInactive && it.id !== current) return false;
        return typeof o.filter === 'function' ? !!o.filter(it) : true;
      }).map(function (it) {
        return { id: it.id, label: it.label || it.name || String(it.id), sub: it.sub !== undefined ? it.sub : [it.code, it.pack || it.unit].filter(Boolean).join(' - '), search: it.hsn || '', data: it };
      });
    }
    control = combo(assign({ placeholder: 'Search items' }, o, { options: options }));
    return control;
  };

  /* -------------------------------------------------------------- formats */

  function nameIn(list, id) { var x = byId(list, id); return x ? (x.label || x.name || String(id)) : (blank(id) ? DASH : String(id)); }

  /** One cell value as text (or a node), by format name or function. */
  function formatCell(format, v, row, col) {
    if (isNode(v)) return v;
    if (typeof format === 'function') return format(v, row);
    if (blank(v) || (typeof v === 'number' && isNaN(v))) return DASH;
    switch (format) {
      case 'inr2': case 'amount': return fmt.inr2(v);
      case 'inr': return fmt.inr(v);
      case 'inrFull': return fmt.inrFull(v);
      case 'rate': return fmt.rate(v);
      case 'qty': return fmt.qty(v, col ? resolve(col.unit, row) : '');
      case 'int': case 'num': return fmt.num(v);
      case 'pct': return fmt.pct(v);
      case 'date': return HB.dates.isIso(v) ? HB.dates.label(v, 'd MMM yyyy') : String(v);
      default: return String(v);
    }
  }
  forms.format = function (format, value, row) { return formatCell(format, value, row, null); };

  var NUMERIC = { qty: 1, int: 1, rate: 1, amount: 1, inr2: 1, inr: 1, inrFull: 1, num: 1, pct: 1 };

  /* ------------------------------------------------------------ line grid */

  /**
   * lineGrid({columns, rows, onChange(rows, {kind, index, key, row}), addLabel, readOnly, newRow(rows), minRows, maxRows,
   * addRows, removeRows, footerLabel, empty, key})
   * rows is the caller's array of plain objects - the draft. The grid writes into it and never copies it.
   * Returns the element; see docs/shell/UI-API.md for .refresh(), .rebuild(), .setErrors(), .setWarnings(), .focusCell(), .addRow().
   */
  forms.lineGrid = function (o) {
    o = o || {};
    var cols = (o.columns || []).filter(Boolean);
    var rows = Array.isArray(o.rows) ? o.rows : [];
    var readOnly = !!o.readOnly;
    var gridKey = o.key || 'l';
    var preview = o.preview || null;
    var errors = [];      /* [{index, key, message}] */
    var warnings = [];    /* the same shape: figures that look wrong and can still be posted */
    var cells = [];       /* cells[index][colKey] = {td, control, col} */
    var minRows = isNum(o.minRows) ? o.minRows : 0;

    function blankRow() { return typeof o.newRow === 'function' ? (o.newRow(rows) || {}) : {}; }
    while (!readOnly && rows.length < minRows) rows.push(blankRow());

    function numeric(col) {
      if (col.align) return col.align === 'right';
      return !!NUMERIC[col.type] || !!NUMERIC[col.format];
    }
    function editable(col, row) {
      return !readOnly && col.type !== 'computed' && col.type !== 'static' && !resolve(col.readOnly, row);
    }
    function rawValue(col, row, index) {
      return typeof col.value === 'function' ? col.value(row, index, preview) : row[col.key];
    }
    function display(col, row, index) {
      var v = rawValue(col, row, index);
      if (isNode(v)) return v;
      if (typeof col.format === 'function') return col.format(v, row, index);
      if (col.type === 'item' && !col.format) return nameIn(col.items ? listOf(resolve(col.items, row)) : masterList('items'), v);
      if (col.type === 'party' && !col.format) return nameIn(col.options ? listOf(resolve(col.options, row)) : masterList(PARTY_LISTS[col.kind] || 'customers'), v);
      if (col.type === 'select' && !col.format) {
        var opts = listOf(resolve(col.options, row)).map(function (x) { return typeof x === 'object' ? { id: x.value, label: x.label } : { id: x, label: String(x) }; });
        return nameIn(opts, v);
      }
      return formatCell(col.format || col.type, v, row, col);
    }

    var table = h('table', { 'class': 'mk-lg__table' });
    var tbody = h('tbody');
    var tfoot = h('tfoot');
    var hasFooter = cols.some(function (c) { return c.footer !== undefined && c.footer !== null; });
    var canRemove = !readOnly && o.removeRows !== false;

    table.appendChild(h('thead', null, h('tr', null,
      h('th', { 'class': 'mk-lg__n', scope: 'col' }, h('span', { 'class': 'mk-sr' }, 'Line')),
      cols.map(function (col) {
        return h('th', { scope: 'col', 'class': [numeric(col) ? 'is-num' : ''], title: col.title, style: col.width ? { width: typeof col.width === 'number' ? col.width + 'px' : col.width } : null },
          col.label, col.required ? h('span', { 'class': 'mk-field__req', title: 'Required' }, '*') : null);
      }),
      canRemove ? h('th', { 'class': 'mk-lg__x' }, h('span', { 'class': 'mk-sr' }, 'Remove')) : null)));
    table.appendChild(tbody);
    if (hasFooter) table.appendChild(tfoot);

    function fire(kind, index, key) {
      if (typeof o.onChange === 'function') o.onChange(rows, { kind: kind, index: index, key: key || null, row: rows[index] || null });
    }

    function makeControl(col, row, index) {
      var common = {
        cell: true, value: row[col.key], fkey: gridKey + ':' + index + ':' + col.key, placeholder: col.placeholder,
        ariaLabel: (typeof col.label === 'string' ? col.label : col.key) + ', line ' + (index + 1),
        onChange: function (v, data, meta) { edit(index, col, v, data, meta); }
      };
      switch (col.type) {
        case 'item': return forms.itemPicker(assign(common, { kind: col.kind, items: col.items ? function () { return resolve(col.items, row); } : null,
          filter: col.filter ? function (it) { return col.filter(it, row, rows); } : null, listWidth: col.listWidth }));
        case 'party': return forms.partyPicker(assign(common, { kind: col.kind, options: col.options ? function () { return resolve(col.options, row); } : null,
          filter: col.filter ? function (p) { return col.filter(p, row, rows); } : null }));
        case 'select': return forms.selectInput(assign(common, { options: resolve(col.options, row) || [], placeholder: col.placeholder || 'Choose' }));
        case 'qty': return forms.qtyInput(assign(common, { decimals: resolve(col.decimals, row), unit: resolve(col.unit, row), allowNegative: col.allowNegative }));
        case 'int': return forms.qtyInput(assign(common, { decimals: 0, unit: resolve(col.unit, row) }));
        case 'rate': return forms.rateInput(assign(common, { unit: resolve(col.unit, row) }));
        case 'amount': return forms.amountInput(assign(common, { allowNegative: col.allowNegative }));
        case 'date': return forms.dateInput(assign(common, { min: col.min, max: col.max, value: row[col.key] === undefined ? null : row[col.key] }));
        default:
          var input = ui.form.input({ value: row[col.key], placeholder: col.placeholder, maxLength: col.maxLength, ariaLabel: common.ariaLabel,
            onInput: function (v) { edit(index, col, v === '' ? null : v); } });
          input.classList.add('mk-input--cell');
          setKey(input, common.fkey);
          input.input = input;
          input.getValue = function () { return input.value === '' ? null : input.value; };
          input.setValue = function (v) { input.value = blank(v) ? '' : String(v); };
          return input;
      }
    }

    function makeCell(col, row, index) {
      var td = h('td', { 'class': [numeric(col) ? 'is-num' : '', col.className] });
      var cell = { td: td, control: null, col: col };
      if (editable(col, row)) {
        cell.control = makeControl(col, row, index);
        var target = cell.control.input || cell.control;
        target.setAttribute('data-row', index);
        target.setAttribute('data-col', col.key);
        td.classList.add('mk-lg__edit');
        td.appendChild(cell.control);
      } else {
        td.classList.add('mk-lg__read');
        ui.append(td, display(col, row, index));
      }
      return cell;
    }

    function rowErrors(index) { return errors.filter(function (e) { return e.index === index; }); }
    function rowWarnings(index) { return warnings.filter(function (e) { return e.index === index; }); }

    /** The line under a row: its refusals, then its warnings. A row with warnings only is amber, not red. */
    function messageRow(index) {
      var list = rowErrors(index), soft = rowWarnings(index);
      if (!list.length && !soft.length) return null;
      return h('tr', { 'class': ['mk-lg__msg', list.length ? '' : 'mk-lg__msg--warn'] }, h('td'), h('td', { colspan: cols.length + (canRemove ? 1 : 0) },
        list.map(function (e) { return h('div', { 'class': 'mk-field__error' }, ui.icon('alert-triangle', 14), e.message); }),
        soft.map(function (e) { return h('div', { 'class': 'mk-field__warn' }, ui.icon('alert-triangle', 14), e.message); })));
    }

    function markCell(index) {
      Object.keys(cells[index] || {}).forEach(function (key) {
        var cell = cells[index][key];
        var err = errors.filter(function (e) { return e.index === index && e.key === key; })[0];
        var soft = warnings.filter(function (e) { return e.index === index && e.key === key; })[0];
        cell.td.classList.toggle('is-warn', !!soft && !err);
        cell.td.classList.toggle('is-error', !!err);
        if (cell.control && typeof cell.control.setInvalid === 'function') cell.control.setInvalid(err ? err.message : '');
        else if (cell.control && cell.control.input) {
          if (err) cell.control.input.setAttribute('aria-invalid', 'true'); else cell.control.input.removeAttribute('aria-invalid');
        }
      });
    }

    function buildRow(index) {
      var row = rows[index];
      cells[index] = {};
      var tr = h('tr', { 'class': 'mk-lg__row', 'data-index': index }, h('td', { 'class': 'mk-lg__n' }, String(index + 1)));
      cols.forEach(function (col) {
        var cell = makeCell(col, row, index);
        cells[index][col.key] = cell;
        tr.appendChild(cell.td);
      });
      if (canRemove) {
        var btn = ui.iconButton('x', 'Remove line ' + (index + 1) + ' (Ctrl+Delete)', function () { removeRow(index); }, { size: 'sm' });
        btn.tabIndex = -1; /* Tab runs across the cells; Ctrl+Delete removes a line from the keyboard */
        tr.appendChild(h('td', { 'class': 'mk-lg__x' }, btn));
      }
      return tr;
    }

    function renderBody() {
      ui.clear(tbody);
      cells = [];
      if (!rows.length) {
        tbody.appendChild(h('tr', { 'class': 'mk-lg__none' }, h('td', { colspan: cols.length + 1 + (canRemove ? 1 : 0) }, o.empty || (readOnly ? 'No lines' : 'No lines yet'))));
      }
      rows.forEach(function (row, index) {
        tbody.appendChild(buildRow(index));
        markCell(index);
        var msg = messageRow(index);
        if (msg) tbody.appendChild(msg);
      });
      renderFooter();
      paintBar();
    }

    function footValue(col) {
      if (col.footer === 'sum') {
        var total = 0, any = false;
        rows.forEach(function (row, i) { var v = rawValue(col, row, i); if (isNum(v)) { total += v; any = true; } });
        if (!any) return '';
        if (col.type === 'qty' || col.format === 'qty') return fmt.qty(HB.q3(total), col.footerUnit || '');
        return formatCell(typeof col.format === 'string' ? col.format : col.type, total, {}, null);
      }
      if (typeof col.footer === 'function') return col.footer(rows, preview);
      return col.footer === undefined || col.footer === null ? '' : col.footer;
    }

    function renderFooter() {
      if (!hasFooter) return;
      ui.clear(tfoot);
      var labelled = false;
      tfoot.appendChild(h('tr', null, h('td', { 'class': 'mk-lg__n' }),
        cols.map(function (col) {
          var content = footValue(col);
          /* the first column without a footer of its own carries the label */
          if (!labelled && (col.footer === undefined || col.footer === null)) { labelled = true; content = o.footerLabel || 'Total'; }
          return h('td', { 'class': [numeric(col) ? 'is-num' : ''] }, content);
        }),
        canRemove ? h('td') : null));
    }

    /** Repaint what is derived: read-only and computed cells, the footer, and any input the user is not typing in. */
    function refreshRow(index) {
      var row = rows[index];
      Object.keys(cells[index] || {}).forEach(function (key) {
        var cell = cells[index][key];
        if (cell.control) {
          var target = cell.control.input || cell.control;
          if (target !== doc.activeElement && typeof cell.control.setValue === 'function') cell.control.setValue(row[key]);
        } else {
          ui.clear(cell.td);
          ui.append(cell.td, display(cell.col, row, index));
        }
      });
    }

    /** Rebuild the cells of one row except the one being typed in: units and option lists may follow the item. */
    function repaintRow(index, exceptKey) {
      var row = rows[index];
      cols.forEach(function (col) {
        if (col.key === exceptKey) return;
        var old = cells[index][col.key];
        var cell = makeCell(col, row, index);
        old.td.parentNode.replaceChild(cell.td, old.td);
        cells[index][col.key] = cell;
      });
      markCell(index);
    }

    function edit(index, col, v, data, meta) {
      var row = rows[index];
      if (!row) return;
      row[col.key] = v;
      if (typeof col.onChange === 'function') {
        try { col.onChange(row, v, data, index, rows); } catch (e) { logError('column onChange', e); }
      }
      if (col.type === 'item' || col.type === 'party' || col.type === 'select' || col.repaint) repaintRow(index, col.key);
      else refreshRow(index);
      renderFooter();
      fire('edit', index, col.key);
      /* a pick with Enter or the mouse moves on to the next cell that takes typing */
      if (meta && (meta.via === 'Enter' || meta.via === 'click')) {
        var after = cols.slice(cols.indexOf(col) + 1).filter(function (c) { return editable(c, row); })[0];
        if (after) focusCell(index, after.key);
      }
    }

    function findInput(index, key) {
      var list = tbody.querySelectorAll('[data-row="' + index + '"]');
      for (var i = 0; i < list.length; i++) if (list[i].getAttribute('data-col') === key) return list[i];
      return null;
    }

    function focusCell(index, key) {
      var el = key ? findInput(index, key) : null;
      if (!el) el = tbody.querySelector('[data-row="' + index + '"]');
      if (!el) return false;
      el.focus();
      if (typeof el.select === 'function' && el.type !== 'date') { try { el.select(); } catch (e) { /* not selectable */ } }
      return true;
    }

    function canAdd() { return !readOnly && o.addRows !== false && (!isNum(o.maxRows) || rows.length < o.maxRows); }
    /** A line nothing has been typed into: every cell that takes typing is empty. */
    function isBlank(row) { return !row || cols.every(function (c) { return !editable(c, row) || blank(row[c.key]); }); }

    function addRow(row, focus) {
      if (!canAdd()) return -1;
      rows.push(row || blankRow());
      renderBody();
      fire('add', rows.length - 1);
      if (focus !== false) focusCell(rows.length - 1, null);
      return rows.length - 1;
    }

    function removeRow(index) {
      if (!canRemove || index < 0 || index >= rows.length) return;
      rows.splice(index, 1);
      while (rows.length < minRows) rows.push(blankRow());
      errors = []; /* the indexes have moved; the next preview says what is still wrong */
      warnings = [];
      renderBody();
      fire('remove', index);
      if (rows.length) focusCell(Math.min(index, rows.length - 1), null);
    }

    tbody.addEventListener('keydown', function (e) {
      var t = e.target;
      if (!t || !t.getAttribute || t.getAttribute('data-row') === null) return;
      var index = +t.getAttribute('data-row'), key = t.getAttribute('data-col');
      if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && t.tagName !== 'TEXTAREA') {
        e.preventDefault();
        if (index < rows.length - 1) focusCell(index + 1, key);
        else if (!isBlank(rows[index])) addRow(null, true); /* Enter in the last line starts the next one, unless that line is still empty */
        return;
      }
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && t.tagName === 'INPUT' && t.type !== 'date' && !e.altKey) {
        var next = index + (e.key === 'ArrowDown' ? 1 : -1);
        if (next >= 0 && next < rows.length) { e.preventDefault(); focusCell(next, key); }
        return;
      }
      if (e.key === 'Delete' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); removeRow(index); }
    });

    var addBtn = ui.button({ label: o.addLabel || 'Add line', icon: 'plus', size: 'sm', onClick: function () { addRow(null, true); } });
    var bar = h('div', { 'class': 'mk-lg__bar' }, addBtn,
      h('span', { 'class': 'mk-lg__hint' }, 'Enter moves down and starts a new line at the end. Ctrl+Delete removes a line.'));
    function paintBar() { bar.hidden = readOnly || o.addRows === false; addBtn.disabled = !canAdd(); }

    var el = h('div', { 'class': ['mk-lg', readOnly ? 'mk-lg--readonly' : '', o.className] }, h('div', { 'class': 'mk-lg__scroll' }, table), bar);
    renderBody();

    el.rows = rows;
    /** Recompute what is derived, after the page changed row values or a new preview arrived. Keeps the focus. */
    el.refresh = function () { rows.forEach(function (r, i) { if (cells[i]) refreshRow(i); }); renderFooter(); };
    /** Rebuild every row from the draft (after lines were added, removed or replaced by page code). */
    el.rebuild = function (nextRows) { if (Array.isArray(nextRows)) { rows = nextRows; el.rows = rows; } errors = []; warnings = []; renderBody(); };
    /** The latest preview result: computed columns receive it as their third argument. */
    el.setPreview = function (p) { preview = p || null; };
    function cleanMessages(list) { return (list || []).filter(function (e) { return e && isNum(e.index) && e.message; }); }
    /* message rows come and go without rebuilding the inputs, so typing is never interrupted */
    function repaintMessages() {
      Array.prototype.slice.call(tbody.querySelectorAll('.mk-lg__msg')).forEach(function (tr) { tr.parentNode.removeChild(tr); });
      rows.forEach(function (r, i) {
        if (!cells[i]) return;
        markCell(i);
        var msg = messageRow(i);
        var tr = tbody.querySelector('tr[data-index="' + i + '"]');
        if (msg && tr) tr.parentNode.insertBefore(msg, tr.nextSibling);
      });
    }
    /** [{index, key, message}] - marks the cells and writes the messages under their lines. [] clears. */
    el.setErrors = function (list) {
      var next = cleanMessages(list);
      if (JSON.stringify(next) === JSON.stringify(errors)) return;
      errors = next;
      repaintMessages();
    };
    /** The same for warnings: the cell turns amber and the message sits under its line. A refusal on the same cell wins. [] clears. */
    el.setWarnings = function (list) {
      var next = cleanMessages(list);
      if (JSON.stringify(next) === JSON.stringify(warnings)) return;
      warnings = next;
      repaintMessages();
    };
    el.focusCell = focusCell;
    el.addRow = addRow;
    el.removeRow = removeRow;
    /** The indexes of the lines something was typed into, in order: what a payload should carry. */
    el.filled = function () {
      var out = [];
      rows.forEach(function (r, i) { if (!isBlank(r)) out.push(i); });
      return out;
    };
    return el;
  };

  /* ---------------------------------------------------------- matrix grid */

  /**
   * matrixGrid({rows: [{id, label, sub}], columns: [{id, label, sub}], values: {rowId: {colId: n}}, available: {colId: n},
   * onChange(values, {rowId, colId, value}), readOnly, rowHeader, totalLabel, availableLabel, balanceLabel, info, disabled(rowId, colId), key})
   * A dense sheet of whole numbers with a total per row and per column and, when `available` is given, an "available"
   * row under the totals: a column that asks for more than is available is marked. values is the caller's object.
   */
  forms.matrixGrid = function (o) {
    o = o || {};
    var rowDefs = (o.rows || []).filter(Boolean), colDefs = (o.columns || []).filter(Boolean);
    var values = o.values && typeof o.values === 'object' ? o.values : {};
    var available = o.available || null;
    var readOnly = !!o.readOnly;
    var gridKey = o.key || 'm';
    var inputs = {}, rowTotalEls = {}, colTotalEls = {}, availEls = {}, balanceEls = {}, headEls = {};
    var grandEl = h('td', { 'class': 'mk-mx__tot' });

    function val(r, c) { var v = values[r] && values[r][c]; return isNum(v) ? v : 0; }
    function rowTotal(r) { return colDefs.reduce(function (t, c) { return t + val(r, c.id); }, 0); }
    function colTotal(c) { return rowDefs.reduce(function (t, r) { return t + val(r.id, c); }, 0); }
    function avail(c) { return available && isNum(available[c]) ? available[c] : null; }
    function shortBy(c) { var a = avail(c); return a === null ? 0 : Math.max(0, colTotal(c) - a); }

    function paintColumn(c) {
      var total = colTotal(c), a = avail(c), short = shortBy(c);
      colTotalEls[c].textContent = fmt.num(total);
      colTotalEls[c].classList.toggle('is-short', short > 0);
      if (short > 0) colTotalEls[c].title = 'Short by ' + fmt.num(short); else colTotalEls[c].removeAttribute('title');
      if (headEls[c]) headEls[c].classList.toggle('is-short', short > 0);
      if (availEls[c]) availEls[c].textContent = a === null ? DASH : fmt.num(a);
      if (balanceEls[c]) {
        balanceEls[c].textContent = a === null ? DASH : fmt.num(a - total);
        balanceEls[c].classList.toggle('is-short', short > 0);
      }
    }
    function paintTotals(r, c) {
      if (r !== undefined && rowTotalEls[r]) rowTotalEls[r].textContent = fmt.num(rowTotal(r));
      if (c !== undefined) paintColumn(c);
      grandEl.textContent = fmt.num(rowDefs.reduce(function (t, row) { return t + rowTotal(row.id); }, 0));
    }
    function paintAll() {
      rowDefs.forEach(function (r) {
        rowTotalEls[r.id].textContent = fmt.num(rowTotal(r.id));
        colDefs.forEach(function (c) {
          var input = inputs[r.id] && inputs[r.id][c.id];
          if (!input) return;
          var v = val(r.id, c.id);
          if (input.tagName === 'INPUT') { if (input !== doc.activeElement) input.value = v ? String(v) : ''; }
          else input.textContent = v ? fmt.num(v) : DASH;
        });
      });
      colDefs.forEach(function (c) { paintColumn(c.id); });
      paintTotals();
    }

    function focusAt(ri, ci) {
      var r = rowDefs[ri], c = colDefs[ci];
      var input = r && c && inputs[r.id] && inputs[r.id][c.id];
      if (!input || input.tagName !== 'INPUT') return false;
      input.focus();
      input.select();
      return true;
    }
    /** Step from a cell in one direction, over cells that cannot be typed in. */
    function moveFrom(ri, ci, dr, dc) {
      var r = ri + dr, c = ci + dc;
      while (r >= 0 && r < rowDefs.length && c >= 0 && c < colDefs.length) {
        if (focusAt(r, c)) return true;
        r += dr; c += dc;
      }
      return false;
    }

    function makeInput(r, c, ri, ci) {
      var off = readOnly || (typeof o.disabled === 'function' && o.disabled(r.id, c.id));
      if (off) return h('span', { 'class': 'mk-mx__ro' });
      var input = h('input', { 'class': 'mk-mx__in', type: 'text', inputmode: 'numeric', autocomplete: 'off', placeholder: '0', maxlength: 6,
        'aria-label': r.label + ', ' + c.label });
      setKey(input, gridKey + ':' + r.id + ':' + c.id);
      input.addEventListener('focus', function () { input.select(); });
      input.addEventListener('input', function () {
        var clean = input.value.replace(/\D/g, '');
        if (clean !== input.value) input.value = clean;
        if (!values[r.id]) values[r.id] = {};
        values[r.id][c.id] = clean ? Number(clean) : 0;
        paintTotals(r.id, c.id);
        if (typeof o.onChange === 'function') o.onChange(values, { rowId: r.id, colId: c.id, value: values[r.id][c.id] });
      });
      input.addEventListener('blur', function () { var v = val(r.id, c.id); input.value = v ? String(v) : ''; });
      input.addEventListener('keydown', function (e) {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        var len = input.value.length, all = input.selectionStart === 0 && input.selectionEnd === len;
        var moved = null;
        if (e.key === 'ArrowDown' || e.key === 'Enter') moved = moveFrom(ri, ci, 1, 0);
        else if (e.key === 'ArrowUp') moved = moveFrom(ri, ci, -1, 0);
        else if (e.key === 'ArrowRight' && (all || input.selectionStart === len)) moved = moveFrom(ri, ci, 0, 1);
        else if (e.key === 'ArrowLeft' && (all || input.selectionEnd === 0)) moved = moveFrom(ri, ci, 0, -1);
        if (moved !== null && (moved || e.key === 'Enter')) e.preventDefault();
      });
      return input;
    }

    function headCell(c) {
      var th = h('th', { scope: 'col', 'class': 'mk-mx__col', title: [c.label, c.sub].filter(Boolean).join(' - ') },
        h('span', { 'class': 'mk-mx__name' }, c.short || c.label), c.sub ? h('small', null, c.sub) : null);
      headEls[c.id] = th;
      return th;
    }

    var thead = h('thead', null, h('tr', null,
      h('th', { 'class': 'mk-mx__corner', scope: 'col' }, o.rowHeader || ''),
      colDefs.map(headCell),
      h('th', { 'class': 'mk-mx__tot', scope: 'col' }, 'Total')));

    var tbody = h('tbody', null, rowDefs.map(function (r, ri) {
      inputs[r.id] = {};
      rowTotalEls[r.id] = h('td', { 'class': 'mk-mx__tot' });
      return h('tr', null,
        h('th', { scope: 'row', 'class': 'mk-mx__rowhead', title: [r.label, r.sub].filter(Boolean).join(' - ') },
          h('span', { 'class': 'mk-mx__name' }, r.label), r.sub ? h('small', null, r.sub) : null),
        colDefs.map(function (c, ci) {
          var input = makeInput(r, c, ri, ci);
          inputs[r.id][c.id] = input;
          return h('td', { 'class': 'mk-mx__cell' }, input);
        }),
        rowTotalEls[r.id]);
    }));

    function footRow(label, cls, cellFor, last) {
      return h('tr', { 'class': cls }, h('th', { scope: 'row', 'class': 'mk-mx__rowhead' }, label), colDefs.map(cellFor), last || h('td', { 'class': 'mk-mx__tot' }));
    }
    var tfoot = h('tfoot', null,
      footRow(o.totalLabel || 'Total', 'mk-mx__totals', function (c) { return (colTotalEls[c.id] = h('td')); }, grandEl),
      available ? footRow(o.availableLabel || 'Available', 'mk-mx__avail', function (c) { return (availEls[c.id] = h('td')); }) : null,
      available && o.balanceLabel ? footRow(o.balanceLabel, 'mk-mx__balance', function (c) { return (balanceEls[c.id] = h('td')); }) : null,
      (o.info || []).filter(Boolean).map(function (info) {
        return footRow(info.label, 'mk-mx__info', function (c) {
          var v = info.values ? info.values[c.id] : undefined;
          return h('td', null, blank(v) ? DASH : (info.format ? formatCell(info.format, v, null, null) : (isNum(v) ? fmt.num(v) : v)));
        });
      }));

    var el = h('div', { 'class': ['mk-mx', readOnly ? 'mk-mx--readonly' : '', o.className] },
      h('div', { 'class': 'mk-mx__scroll' }, h('table', { 'class': 'mk-mx__table' }, thead, tbody, tfoot)));
    paintAll();

    el.values = values;
    /** Replace the values (the same object or a new one) and repaint. */
    el.setValues = function (next) { if (next && typeof next === 'object') { values = next; el.values = values; } paintAll(); };
    el.setAvailable = function (next) { available = next || null; paintAll(); };
    el.totals = function () {
      var out = { rows: {}, columns: {}, grand: 0 };
      rowDefs.forEach(function (r) { out.rows[r.id] = rowTotal(r.id); out.grand += out.rows[r.id]; });
      colDefs.forEach(function (c) { out.columns[c.id] = colTotal(c.id); });
      return out;
    };
    /** The columns that ask for more than is available: [{colId, total, available, short}]. */
    el.short = function () {
      return colDefs.filter(function (c) { return shortBy(c.id) > 0; }).map(function (c) {
        return { colId: c.id, total: colTotal(c.id), available: avail(c.id), short: shortBy(c.id) };
      });
    };
    el.focusCell = function (rowId, colId) {
      var ri = -1, ci = -1;
      rowDefs.forEach(function (r, i) { if (r.id === rowId) ri = i; });
      colDefs.forEach(function (c, i) { if (c.id === colId) ci = i; });
      return focusAt(Math.max(ri, 0), Math.max(ci, 0));
    };
    return el;
  };

  /* --------------------------------------------------------------- totals */

  /**
   * totals([{label, value, sub, strong, tone: 'good' | 'bad' | 'muted', rule}]) - the figures panel of a document:
   * label on the left, value on the right; strong marks the grand total, rule draws a line above the row.
   */
  forms.totals = function (rows) {
    if (isNode(rows)) return rows;
    return h('dl', { 'class': 'mk-totals' }, (rows || []).filter(Boolean).map(function (r) {
      return h('div', { 'class': ['mk-totals__row', r.strong ? 'is-strong' : '', r.rule ? 'has-rule' : '', r.tone ? 'is-' + r.tone : ''] },
        h('dt', null, r.label, r.sub ? h('small', null, r.sub) : null),
        h('dd', null, r.value));
    }));
  };

  /* ------------------------------------------------- names, links, status */

  var TYPE_NAMES = {
    PO: ['Purchase order', 'purchase orders'], GRN: ['Goods receipt', 'goods receipts'], VBILL: ['Vendor bill', 'vendor bills'],
    PAY: ['Payment', 'payments'], PROD: ['Production entry', 'production entries'], SO: ['Sales order', 'sales orders'],
    INV: ['Invoice', 'invoices'], RCPT: ['Receipt', 'receipts'], CN: ['Stale return', 'stale returns'],
    XFER: ['Transfer', 'transfers'], DAYEND: ['Day-end', 'day-ends'], DEP: ['Cash deposit', 'cash deposits'],
    ADJ: ['Stock count', 'stock counts'], WO: ['Write-off', 'write-offs'], EXP: ['Expense', 'expenses'],
    CXL: ['Cancellation', 'cancellations'], OPENSTOCK: ['Opening stock', 'opening stock entries'], OPENCASH: ['Opening balance', 'opening balances']
  };

  /** typeName('VBILL') -> 'Vendor bill'; typeName('VBILL', true) -> 'vendor bills'. */
  forms.typeName = function (type, plural) {
    var t = TYPE_NAMES[String(type || '').toUpperCase()];
    return t ? t[plural ? 1 : 0] : (plural ? 'documents' : 'Document');
  };

  /** docTitle(doc) -> 'Purchase order PO-U-0001'. An expense is named by its kind. */
  forms.docTitle = function (d) {
    if (!d) return '';
    var name = d.type === 'EXP' && d.kind ? ({ claim: 'Expense claim', bill: 'Expense bill', salary: 'Salary bill' }[d.kind] || 'Expense') : forms.typeName(d.type);
    return name + ' ' + d.id;
  };

  /** docLink('INV-260930-014', label?) - a link to '#/doc/<id>'; plain text when the persona has no page for it. */
  forms.docLink = function (id, label) {
    if (blank(id)) return h('span', { 'class': 'mk-faint' }, DASH);
    var router = HB.router;
    if (!router || typeof router.docPage !== 'function' || !router.docPage(id)) {
      return h('span', { 'class': 'mk-doclink mk-doclink--off', title: 'This role has no screen for this document' }, label || String(id));
    }
    return h('a', { 'class': 'mk-link mk-doclink', href: router.docHref(id) }, label || String(id));
  };

  /** statusChip('PART_RECEIVED', {label, title}) - the chip for any document status of SPEC 5.2 (one mapping: HB.ui.statusChip). */
  forms.statusChip = function (status, o) { return ui.statusChip(status, o); };

  /**
   * statusTabs({rows, statuses: ['PENDING', ...] | groups: [{id, label, statuses, test(row)}], value, onChange(id), all, statusKey})
   * Tabs with a count each, "All" first (all: false leaves it out, a string renames it). The element has
   * .value (the selected id) and .filter(rows) -> the rows of the selected tab.
   */
  forms.statusTabs = function (o) {
    o = o || {};
    var rows = o.rows || [];
    var key = o.statusKey || 'status';
    var groups = o.groups || (o.statuses || []).map(function (s) { return { id: s, label: ui.statusInfo(s).label, statuses: [s] }; });
    function inGroup(g, row) {
      if (typeof g.test === 'function') return !!g.test(row);
      return (g.statuses || [g.id]).indexOf(row[key]) !== -1;
    }
    var items = groups.map(function (g) { return { id: g.id, label: g.label, count: rows.filter(function (r) { return inGroup(g, r); }).length }; });
    if (o.all !== false) items.unshift({ id: 'all', label: typeof o.all === 'string' ? o.all : 'All', count: rows.length });
    var value = items.some(function (it) { return it.id === o.value; }) ? o.value : (items[0] && items[0].id);
    var el = ui.tabs({ items: items, value: value, ariaLabel: o.ariaLabel || 'Status', onChange: function (id) { el.value = id; if (typeof o.onChange === 'function') o.onChange(id); } });
    el.value = value;
    el.filter = function (list) {
      var g = groups.filter(function (x) { return x.id === el.value; })[0];
      return g ? (list || rows).filter(function (r) { return inGroup(g, r); }) : (list || rows);
    };
    return el;
  };

  /* ------------------------------------------------------------ doc list */

  var PAGE_SIZE = 50;

  function compareValues(a, b) {
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    return String(a).localeCompare(String(b), 'en', { numeric: true, sensitivity: 'base' });
  }

  /**
   * docList({rows, columns, state, statuses | groups, all, search: [keys] | function (row), searchPlaceholder, onOpen(row),
   * newLabel, onNew, newReason, actions, empty, sort, title, subtitle, pageSize})
   * The list of a document page: status tabs with counts, a search box, "New", and the table in pages of 50.
   * Tab, search text, sort and page live in `state` (the router's per-route state) and survive every redraw.
   * A row opens its document ('#/doc/<row.id>') unless onOpen says otherwise.
   */
  forms.docList = function (o) {
    o = o || {};
    var st = o.state || {};
    var all = o.rows || [];
    /* the id of the listed document is a link like every other document id (the row opens it as well) */
    var cols = (o.columns || []).filter(Boolean).map(function (c) {
      return c.key === 'id' && c.doc === undefined && !c.render && o.onOpen === undefined ? assign({}, c, { doc: true }) : c;
    });
    var size = o.pageSize || PAGE_SIZE;
    if (!st.sort && o.sort) st.sort = o.sort;

    var hasTabs = !!(o.statuses || o.groups);
    var tabsHost = h('div', { 'class': 'mk-doclist__tabs' });
    var tableHost = h('div');
    var countEl = h('span', { 'class': 'mk-doclist__count' });
    var prevBtn = ui.iconButton('chevron-left', 'Previous page', function () { st.page = Math.max(0, (st.page || 0) - 1); paint(); }, { size: 'sm' });
    var nextBtn = ui.iconButton('chevron-right', 'Next page', function () { st.page = (st.page || 0) + 1; paint(); }, { size: 'sm' });
    var pager = h('div', { 'class': 'mk-doclist__pager' }, countEl, prevBtn, nextBtn);
    var tabs = null;

    function searchText(row) {
      if (typeof o.search === 'function') return String(o.search(row) || '').toLowerCase();
      var keys = Array.isArray(o.search) ? o.search : cols.map(function (c) { return c.key; }).filter(Boolean);
      return keys.map(function (k) { return blank(row[k]) ? '' : String(row[k]); }).join(' ').toLowerCase();
    }

    function current() {
      var list = tabs ? tabs.filter(all) : all;
      var words = String(st.q || '').toLowerCase().split(/\s+/).filter(Boolean);
      if (words.length) list = list.filter(function (r) { var t = searchText(r); return words.every(function (w) { return t.indexOf(w) !== -1; }); });
      var s = st.sort, col = s ? cols.filter(function (c) { return c.key === s.key; })[0] : null;
      if (col) {
        var sign = s.dir === 'asc' ? 1 : -1;
        list = list.map(function (r, i) { var v = typeof col.sortValue === 'function' ? col.sortValue(r) : r[col.key]; return { r: r, i: i, v: v }; })
          .sort(function (x, y) {
            var xb = blank(x.v), yb = blank(y.v);
            if (xb || yb) return xb && yb ? x.i - y.i : (xb ? 1 : -1);
            return sign * compareValues(x.v, y.v) || x.i - y.i;
          }).map(function (x) { return x.r; });
      }
      return list;
    }

    function paintTabs() {
      ui.clear(tabsHost);
      if (!hasTabs) { tabs = null; return; }
      tabs = forms.statusTabs({ rows: all, statuses: o.statuses, groups: o.groups, all: o.all, statusKey: o.statusKey, value: st.tab,
        onChange: function (id) { st.tab = id; st.page = 0; paint(); } });
      st.tab = tabs.value;
      tabsHost.appendChild(tabs);
    }

    function paint() {
      var list = current();
      var pages = Math.max(1, Math.ceil(list.length / size));
      st.page = Math.max(0, Math.min(st.page || 0, pages - 1));
      var from = st.page * size, slice = list.slice(from, from + size);
      ui.clear(tableHost).appendChild(ui.table({
        columns: cols, rows: slice, sortable: o.sortable !== false, sort: st.sort || null, rowClass: o.rowClass,
        onSort: function (s) { st.sort = s; st.page = 0; paint(); },
        empty: st.q ? 'Nothing matches "' + st.q + '"' : (o.empty || 'Nothing here yet'),
        onRowClick: o.onOpen === false ? null : function (row) {
          if (typeof o.onOpen === 'function') o.onOpen(row);
          else if (HB.router && !blank(row.id)) HB.router.openDoc(row.id);
        }
      }));
      countEl.textContent = list.length ? fmt.num(from + 1) + ' - ' + fmt.num(from + slice.length) + ' of ' + fmt.num(list.length) : '0';
      prevBtn.disabled = st.page <= 0;
      nextBtn.disabled = st.page >= pages - 1;
      pager.classList.toggle('is-single', pages <= 1);
    }

    var search = o.search === false ? null : ui.form.search({ value: st.q || '', placeholder: o.searchPlaceholder || 'Search', width: 220,
      onInput: function (v) { st.q = v; st.page = 0; paint(); } });
    var newBtn = o.newLabel ? ui.button({ label: o.newLabel, icon: o.newReason ? 'lock' : 'plus', variant: 'primary', disabledReason: o.newReason || '', onClick: o.onNew }) : null;

    paintTabs();
    /* search and "New" sit in the card head; the tabs have a row to themselves, so six statuses fit at 1024px */
    var tools = search || o.actions || newBtn ? h('div', { 'class': 'mk-doclist__tools' }, search, o.actions || null, newBtn) : null;
    var el = ui.card({
      title: o.title, subtitle: o.subtitle, actions: tools, flush: true, className: 'mk-doclist',
      body: [hasTabs ? h('div', { 'class': 'mk-doclist__bar' }, tabsHost) : null, tableHost],
      footer: pager
    });
    paint();
    /** The rows now listed (tab, search and sort applied, every page) - for a CSV export of what the user sees. */
    el.rows = current;
    return el;
  };

  /* --------------------------------------------------------------- teaser */

  var TIERS = {
    'ineo': { label: 'iNeo', icon: 'lock', note: 'In the iNeo tier' },
    'neox': { label: 'NeoX', icon: 'lock', note: 'In the NeoX tier' },
    'neo erp': { label: 'Neo ERP', icon: 'info', note: 'Part of Neo ERP, not shown in this sample' }
  };

  /**
   * teaser({title, tier: 'iNeo' | 'NeoX' | 'Neo ERP', text, href, link}) - the locked card of SCOPE 4.12: one line, no
   * figures, placed where a prospect would look for the feature. link: false leaves out the way to the tiers page.
   */
  forms.teaser = function (o) {
    o = o || {};
    var tier = TIERS[String(o.tier || '').toLowerCase()] || { label: String(o.tier || 'Higher tier'), icon: 'lock', note: '' };
    var href = o.href || '#/system/tiers';
    return h('aside', { 'class': ['mk-teaser', o.className], 'aria-label': tier.note || tier.label },
      h('span', { 'class': 'mk-teaser__icon' }, ui.icon(tier.icon, 16)),
      h('div', { 'class': 'mk-teaser__main' },
        h('div', { 'class': 'mk-teaser__title' }, o.title, h('span', { 'class': 'mk-teaser__tier', title: tier.note || null }, tier.label)),
        o.text ? h('div', { 'class': 'mk-teaser__text' }, o.text) : null),
      o.link === false ? null : h('a', { 'class': 'mk-link mk-teaser__link', href: href }, 'What the higher tiers add'));
  };

  /* -------------------------------------------------- dialogs and toasts */

  /**
   * confirmWithReason({title, message, body, confirmLabel, cancelLabel, tone, reasonLabel, reasonPlaceholder})
   * -> Promise<{ok, reason}>. The dialog does not close on Confirm until a reason is typed (reject, cancel).
   */
  forms.confirmWithReason = function (o) {
    o = o || {};
    return ui.confirm(assign({ tone: 'danger', reasonLabel: 'Reason', reasonPlaceholder: 'Say why, in a line' }, o, { requireReason: true }));
  };

  var STATUS_VERBS = {
    PENDING: 'submitted for approval', HELD: 'held for approval', APPROVED: 'approved', REJECTED: 'rejected', CANCELLED: 'cancelled',
    SENT: 'sent', RECEIVED: 'received', PART_RECEIVED: 'part received', OPEN: 'saved', INVOICED: 'invoiced', PAID: 'paid', POSTED: 'posted'
  };

  /**
   * postedToast(doc | [docs], text, {verb, tone}) - "Purchase order PO-U-0003 approved" with one line of what moved and
   * a link to the document. The verb follows the status the document landed in; a held or pending one is amber.
   */
  forms.postedToast = function (docs, text, o) {
    o = o || {};
    var list = (Array.isArray(docs) ? docs : [docs]).filter(Boolean);
    var d = list[0] || {};
    var verb = o.verb || STATUS_VERBS[d.status] || 'posted';
    var title = list.length > 1 ? fmt.num(list.length) + ' ' + forms.typeName(d.type, true) + ' ' + verb : forms.docTitle(d) + ' ' + verb;
    var waiting = d.status === 'PENDING' || d.status === 'HELD';
    var canOpen = list.length === 1 && d.id && HB.router && typeof HB.router.docPage === 'function' && HB.router.docPage(d.id);
    /* a long line of what moved needs longer to read: about a second for every 20 characters, between 6.5 and 14 seconds */
    var words = typeof text === 'string' ? text.length : 0;
    return ui.toast(text || title, {
      title: text ? title : null, tone: o.tone || (waiting ? 'warn' : 'good'), duration: o.duration || Math.max(6500, Math.min(14000, words * 50)),
      action: canOpen ? { label: 'Open ' + d.id, href: HB.router.docHref(d.id) } : null
    });
  };

  /**
   * changes(beforeRows, afterRows, key, field) -> [{key, row, before, after}]: the rows of a selector whose `field`
   * is no longer what it was. The way a page finds what an operation moved without computing it: read the selector,
   * call HB.engine.act, read the selector again, and name the rows this returns in the toast.
   */
  forms.changes = function (before, after, key, field) {
    var was = {}, had = {};
    (before || []).forEach(function (r) { if (r) { was[r[key]] = r[field]; had[r[key]] = true; } });
    return (after || []).filter(function (r) { return r && had[r[key]] && was[r[key]] !== r[field]; })
      .map(function (r) { return { key: r[key], row: r, before: was[r[key]], after: r[field] }; });
  };

  /** uniqueRows(listA, listB, ...) -> one list, a row with the same id only once (the first one met). For a list that joins two selector calls. */
  forms.uniqueRows = function () {
    var seen = {}, out = [];
    for (var i = 0; i < arguments.length; i++) {
      (arguments[i] || []).forEach(function (r) { if (r && !seen[r.id]) { seen[r.id] = true; out.push(r); } });
    }
    return out;
  };

  /* ------------------------------------- the parts of a document view, from HB.data.doc */

  function dayOf(at) { var d = String(at || '').slice(0, 10); return HB.dates.isIso(d) ? HB.dates.label(d, 'd MMM yyyy') : ''; }

  /** timelineOf(id) -> the history of a document for docView({timeline}): HB.data.doc.timeline(id), oldest first. */
  forms.timelineOf = function (id) {
    var rows = HB.data && HB.data.doc ? HB.data.doc.timeline(id) : [];
    return rows.map(function (r) {
      var note = r.note ? String(r.note).charAt(0).toUpperCase() + String(r.note).slice(1) : '';
      return { actor: r.userName, role: r.roleLabel, action: r.label || r.actionLabel, from: r.before || null, to: r.after || null, note: note, at: r.at };
    });
  };

  /** relatedOf(id) -> the related documents for docView({related}): HB.data.doc.related(id), each as a link with what it is. */
  forms.relatedOf = function (id) {
    var rows = HB.data && HB.data.doc ? HB.data.doc.related(id) : [];
    return rows.map(function (r) {
      var note = [r.label, r.date ? HB.dates.label(r.date, 'd MMM yyyy') : '', isNum(r.amount) ? fmt.inr2(r.amount) : ''].filter(Boolean).join(' - ');
      return { id: r.id, status: r.status, note: note };
    });
  };

  /**
   * docNotice(view, {waiting}) -> the callout under the head of a document view, from HB.data.doc.view(id): who
   * cancelled or rejected it, when and why; for a document that waits, `waiting` (the page's sentence on why it
   * waits). null when there is nothing to say.
   */
  forms.docNotice = function (v, o) {
    o = o || {};
    if (!v) return null;
    var x = v.cancellation, a = v.approval || {};
    if (x) return { tone: 'neutral', title: ['Cancelled', dayOf(x.at) ? 'on ' + dayOf(x.at) : '', x.byName ? 'by ' + x.byName : ''].filter(Boolean).join(' '), text: x.reason };
    if (v.status === 'REJECTED') return { tone: 'critical', title: ['Rejected', dayOf(a.at) ? 'on ' + dayOf(a.at) : '', a.byName ? 'by ' + a.byName : ''].filter(Boolean).join(' '), text: a.reason };
    if (v.status === 'PENDING' || v.status === 'HELD') return { tone: 'warn', title: 'Waits for the Owner', text: o.waiting || null };
    return null;
  };

  /** missingDoc(id, {onBack, backLabel}) -> what a page draws when '#/doc/<id>' names nothing the persona may see. */
  forms.missingDoc = function (id, o) {
    o = o || {};
    var el = ui.emptyState('No such document', String(id || '') + ' is not in this copy, or this role cannot see it.',
      { icon: 'file', action: typeof o.onBack === 'function' ? ui.button({ label: o.backLabel || 'Back', icon: 'arrow-left', onClick: o.onBack }) : null });
    el.classList.add('mk-nodoc'); /* the router reads it as a full-page document: no filter bar above it */
    return el;
  };

  var OP_LOOK = {
    approve: { icon: 'check', variant: 'primary', verb: 'approved', tone: 'good' },
    reject: { icon: 'x', verb: 'rejected', tone: 'info' },
    cancel: { icon: 'ban', danger: true, verb: 'cancelled', tone: 'info' },
    cancelDispatch: { icon: 'ban', danger: true, verb: 'cancelled', tone: 'info' },
    receiveTransfer: { icon: 'check', variant: 'primary', verb: 'received', tone: 'good' }
  };

  /**
   * docActions({view, labels, ask, before(op), moved(op, result, before), done(op, result)}) -> actions for docView.
   * view is HB.data.doc.view(id): its `actions` say what makes sense in the document's state (approve, reject,
   * cancel, receiveTransfer; cancelDispatch for a posted dispatch sheet) and whether the persona may do it - one it
   * may not comes back disabled with the reason from the rights or from the engine, and a link to the document that
   * must be cancelled first.
   * Reject and the two cancels ask for a reason; every one goes through HB.engine.act; a success shows the toast with what
   * moved(...) returns, a refusal shows forms.fail. labels: {cancel: 'Cancel the order'}; ask: {cancel: 'what the
   * dialog says'}; before(op) is read just before the engine acts and handed to moved (see forms.changes).
   */
  forms.docActions = function (o) {
    o = o || {};
    var v = o.view;
    if (!v || !Array.isArray(v.actions) || !HB.engine) return [];
    var labels = o.labels || {}, ask = o.ask || {}, acted = false;
    function run(a, args) {
      if (acted) return; /* a second click before the redraw: the document has already moved on */
      var look = OP_LOOK[a.op] || {}, before = null;
      if (typeof o.before === 'function') { try { before = o.before(a.op); } catch (e) { logError('docActions before', e); } }
      var res = HB.engine.act(a.op, args); /* the store change redraws the view */
      if (!res || !res.ok) { forms.fail(res, (labels[a.op] || a.label) + ': not done'); return; }
      acted = true;
      var text = '';
      if (typeof o.moved === 'function') { try { text = o.moved(a.op, res, before) || ''; } catch (e2) { logError('docActions moved', e2); } }
      /* the toast names what was acted on: the document cancelled, or every invoice of a cancelled sheet */
      var about = a.op === 'cancel' ? (res.target || v) : (a.op === 'cancelDispatch' ? (res.targets || v) : (res.doc || v));
      forms.postedToast(about, text || args.reason || '', { verb: look.verb, tone: look.tone });
      if (typeof o.done === 'function') o.done(a.op, res);
    }
    return v.actions.map(function (a) {
      var look = OP_LOOK[a.op] || {};
      return {
        label: labels[a.op] || a.label, icon: look.icon, variant: look.variant, danger: look.danger,
        reason: a.ok ? '' : (a.reason || 'Not possible now'), docId: a.ok ? null : a.docId,
        onClick: function () {
          var sheet = a.op === 'cancelDispatch', cancel = a.op === 'cancel' || sheet;
          if (a.op !== 'reject' && !cancel) { run(a, { id: v.id }); return; }
          forms.confirmWithReason({
            title: (cancel ? 'Cancel ' : 'Reject ') + v.id + '?',
            message: ask[a.op] || (sheet ? 'Every invoice of the sheet is cancelled, each by a cancellation of its own, dated today, with the reason you give. Either all of them go or none.'
              : (cancel ? 'A cancellation is a document of its own, dated today, with the reason you give. It takes back everything this document moved.'
                : 'The person who raised it sees your reason.')),
            confirmLabel: labels[a.op] || a.label, cancelLabel: cancel ? 'Keep it' : 'Back'
          }).then(function (r) { if (r.ok) run(a, sheet ? { sheetId: v.id, reason: r.reason } : { id: v.id, reason: r.reason }); });
        }
      };
    });
  };

  /**
   * startDraft(pageId, init, {key}) -> Promise<boolean>: open another page's form on a prefilled draft - "Receive"
   * on an order, "Enter the bill" on a receipt. The draft goes into that page's per-route state under `key`
   * (default 'form') and the router opens the page. When that page already holds a draft with something typed in,
   * it asks before replacing it.
   */
  forms.startDraft = function (pageId, init, o) {
    o = o || {};
    var router = HB.router, st = router && typeof router.stateOf === 'function' ? router.stateOf(pageId) : null, key = o.key || 'form';
    if (!st) return Promise.resolve(false);
    function go() { st[key] = forms.draft(init); router.navigate(pageId); return true; }
    if (!st[key] || !st[key].dirty) return Promise.resolve(go());
    return ui.confirm({
      title: 'Replace the unfinished draft?', message: 'That screen holds a draft that was not posted. Starting a new one discards it.',
      confirmLabel: 'Discard it and start', cancelLabel: 'Keep the draft', tone: 'danger'
    }).then(function (res) { return res.ok ? go() : false; });
  };

  /** fail(error | result) - a refusal from the engine as a red toast: the message, and the document to cancel first when it names one. */
  forms.fail = function (err, title) {
    var e = err && err.error ? err.error : err;
    var message = !e ? 'That did not go through' : (typeof e === 'string' ? e : (e.message || 'That did not go through'));
    var id = e && e.docId;
    var canOpen = id && HB.router && typeof HB.router.docPage === 'function' && HB.router.docPage(id);
    return ui.toast(message, { title: title || 'Not done', tone: 'critical', duration: 8000, action: canOpen ? { label: 'Open ' + id, href: HB.router.docHref(id) } : null });
  };

  /* -------------------------------------------------------------- docForm */

  /** draft(init) - make sure an object has the shape of a draft ({values, lines, matrix, touched}); returns the same object. */
  forms.draft = function (init) {
    var st = init && typeof init === 'object' ? init : {};
    if (!st.values || typeof st.values !== 'object') st.values = {};
    if (!st.touched || typeof st.touched !== 'object') st.touched = {};
    return st;
  };

  function errorsOf(result) {
    if (!result) return [];
    var list = Array.isArray(result.errors) ? result.errors.slice() : [];
    if (result.error && list.indexOf(result.error) === -1) list.unshift(result.error);
    return list.filter(Boolean).map(function (e) { return typeof e === 'string' ? { message: e } : e; });
  }

  /** The warnings of a preview as [{message, field}]: a figure that looks wrong, shown and never in the way of posting. */
  function warningsOf(result) {
    return (result && Array.isArray(result.warnings) ? result.warnings : []).filter(Boolean)
      .map(function (w) { return typeof w === 'string' ? { message: w, field: null } : { message: w.message || '', field: w.field || null }; })
      .filter(function (w) { return w.message; });
  }

  /**
   * docForm({title, subtitle, fields, lines, matrix, body, panel, totals, onPreview, onSubmit, onCancel, state,
   * submitLabel, submitIcon, submitReason, cancelLabel, backLabel, actions, fieldMap, compact, confirmDiscard})
   * A full-width document form. See docs/shell/UI-API.md for every option; the short of it:
   *  - state is the draft ({values, lines, matrix}); pass the router's per-route state so a redraw restores it.
   *  - onPreview(draft, form) returns what HB.engine.preview returned; totals(preview, draft) turns it into rows.
   *  - onSubmit(draft, form) returns what HB.engine.act returned; a refusal is shown at the field it names.
   */
  forms.docForm = function (o) {
    o = o || {};
    var st = forms.draft(o.state);
    var fields = (o.fields || []).filter(Boolean);
    var grid = null, matrix = null, fieldEls = {}, previewTimer = null;
    var lineMap = null; /* payload line number -> grid line, set by form.lines() */

    fields.forEach(function (f) {
      if (st.values[f.key] !== undefined) return;
      if (f.value !== undefined) st.values[f.key] = resolve(f.value, st);
      else if (f.type === 'date') st.values[f.key] = HB.calendar.today; /* dates default to the business date, in the draft as on screen */
    });
    if (o.lines && !Array.isArray(st.lines)) st.lines = Array.isArray(o.lines.rows) ? o.lines.rows : [];
    if (o.matrix && (!st.matrix || typeof st.matrix !== 'object')) st.matrix = o.matrix.values || {};

    var el = h('div', { 'class': ['mk-docform', o.compact ? 'mk-docform--compact' : '', o.className] });

    /* ----- header fields */

    function touch(key) { st.touched[key] = true; st.dirty = true; }

    function fieldControl(f) {
      var common = {
        value: st.values[f.key], fkey: 'f:' + f.key, placeholder: f.placeholder, disabled: resolve(f.disabled, st), name: f.key,
        onChange: function (v, data) { setValue(f, v, data); }
      };
      var control;
      switch (f.type) {
        case 'date': control = forms.dateInput(assign(common, { min: f.min, max: f.max })); break;
        case 'select': control = forms.selectInput(assign(common, { options: resolve(f.options, st) || [], placeholder: f.placeholder || 'Choose' })); break;
        case 'party': control = forms.partyPicker(assign(common, { kind: f.kind, options: f.options ? function () { return resolve(f.options, st); } : null,
          filter: f.filter ? function (p) { return f.filter(p, st); } : null, includeInactive: f.includeInactive })); break;
        case 'item': control = forms.itemPicker(assign(common, { kind: f.kind, items: f.items ? function () { return resolve(f.items, st); } : null,
          filter: f.filter ? function (it) { return f.filter(it, st); } : null })); break;
        case 'picker': control = combo(assign(common, { options: function () { return resolve(f.options, st); } })); break;
        case 'qty': control = forms.qtyInput(assign(common, { decimals: resolve(f.decimals, st), unit: resolve(f.unit, st) })); break;
        case 'int': control = forms.qtyInput(assign(common, { decimals: 0, unit: resolve(f.unit, st) })); break;
        case 'rate': control = forms.rateInput(assign(common, { unit: resolve(f.unit, st) })); break;
        case 'amount': control = forms.amountInput(assign(common, { allowNegative: f.allowNegative })); break;
        case 'textarea':
          control = ui.form.textarea({ value: st.values[f.key], placeholder: f.placeholder, rows: f.rows || 2, maxLength: f.maxLength, disabled: common.disabled,
            onInput: function (v) { setValue(f, v === '' ? null : v); } });
          setKey(control, common.fkey);
          break;
        case 'static':
          control = h('div', { 'class': 'mk-docform__static' }, f.text !== undefined ? resolve(f.text, st) : formatCell(f.format, st.values[f.key], st.values, f));
          break;
        case 'custom':
          control = typeof f.control === 'function' ? f.control(st, el) : f.control;
          break;
        default:
          control = ui.form.input({ value: st.values[f.key], placeholder: f.placeholder, maxLength: f.maxLength, mono: f.mono, disabled: common.disabled,
            onInput: function (v) { setValue(f, v === '' ? null : v); } });
          setKey(control, common.fkey);
      }
      return control;
    }

    function setValue(f, v, data) {
      st.values[f.key] = v;
      touch(f.key);
      if (typeof f.onChange === 'function') {
        try { f.onChange(v, st, el, data); } catch (e) { logError('field onChange', e); }
      }
      if (f.rebuild) { rebuild(); return; } /* other fields or the lines depend on this one */
      schedulePreview();
    }

    var fieldsEl = h('div', { 'class': 'mk-docform__fields' });
    function buildFields() {
      ui.clear(fieldsEl);
      fieldEls = {};
      fields.forEach(function (f) {
        if (typeof f.show === 'function' && !f.show(st)) return;
        var control = fieldControl(f);
        var wrap = ui.form.field({ label: f.label, control: control, hint: resolve(f.hint, st), required: f.required, optional: f.optional });
        wrap.classList.add('mk-docform__field');
        wrap.classList.add('mk-span-' + Math.max(1, Math.min(4, f.span || 1)));
        /* a warning about this field sits under it, below any refusal: its own line, so neither wipes the other */
        var warnEl = h('div', { 'class': 'mk-field__warn', 'aria-live': 'polite', hidden: true });
        wrap.appendChild(warnEl);
        fieldsEl.appendChild(wrap);
        fieldEls[f.key] = { wrap: wrap, control: control, def: f, warn: warnEl };
      });
      fieldsCard.hidden = !fieldsEl.firstChild;
    }
    var fieldsCard = h('section', { 'class': 'mk-card mk-docform__card' }, fieldsEl);

    /* ----- lines, matrix, custom body */

    var linesCard = null;
    if (o.lines) {
      grid = forms.lineGrid(assign({}, o.lines, {
        rows: st.lines, key: 'l',
        onChange: function (rows, info) {
          st.dirty = true;
          if (info) { st.touched['lines.' + info.index] = true; if (info.key) st.touched['lines.' + info.index + '.' + info.key] = true; }
          if (info && info.kind === 'remove') {
            /* the lines below moved up by one: what was typed on them no longer matches their numbers */
            Object.keys(st.touched).forEach(function (k) { if (k.indexOf('lines.') === 0) delete st.touched[k]; });
          }
          if (typeof o.lines.onChange === 'function') o.lines.onChange(rows, info, el);
          schedulePreview();
        }
      }));
      linesCard = h('section', { 'class': 'mk-card mk-docform__card mk-docform__lines' },
        h('div', { 'class': 'mk-docform__cardhead' }, h('h3', { 'class': 'mk-card__title' }, o.lines.title || 'Lines'),
          o.lines.subtitle ? h('span', { 'class': 'mk-card__subtitle' }, o.lines.subtitle) : null,
          o.lines.actions ? h('div', { 'class': 'mk-docform__cardactions' }, o.lines.actions) : null),
        grid);
    }
    var matrixCard = null;
    if (o.matrix) {
      matrix = forms.matrixGrid(assign({}, o.matrix, {
        values: st.matrix, key: 'm',
        onChange: function (values, info) {
          st.dirty = true;
          if (typeof o.matrix.onChange === 'function') o.matrix.onChange(values, info, el);
          schedulePreview();
        }
      }));
      matrixCard = h('section', { 'class': 'mk-card mk-docform__card mk-docform__lines' },
        h('div', { 'class': 'mk-docform__cardhead' }, h('h3', { 'class': 'mk-card__title' }, o.matrix.title || 'Quantities'),
          o.matrix.subtitle ? h('span', { 'class': 'mk-card__subtitle' }, o.matrix.subtitle) : null,
          o.matrix.actions ? h('div', { 'class': 'mk-docform__cardactions' }, o.matrix.actions) : null),
        matrix);
    }
    var bodyHost = h('div', { 'class': 'mk-docform__body' });
    function paintBody() {
      ui.clear(bodyHost);
      ui.append(bodyHost, typeof o.body === 'function' ? o.body(st, el) : o.body);
      bodyHost.hidden = !bodyHost.firstChild;
    }

    /* ----- panel (left of the totals), totals, warnings, errors */

    var panelHost = h('div', { 'class': 'mk-docform__panel' });
    var totalsHost = h('div', { 'class': 'mk-docform__totals' });
    var bottom = h('div', { 'class': 'mk-docform__bottom' }, panelHost, totalsHost);
    var warnHost = h('div', { 'class': 'mk-docform__warn' });
    var errorHost = h('div', { 'class': 'mk-docform__error', 'aria-live': 'polite' });

    function paintDerived() {
      var p = el.preview;
      ui.clear(panelHost);
      try { ui.append(panelHost, typeof o.panel === 'function' ? o.panel(p, st, el) : o.panel); } catch (e) { logError('panel', e); }
      ui.clear(totalsHost);
      var rows = null;
      try { rows = typeof o.totals === 'function' ? o.totals(p, st, el) : o.totals; } catch (e2) { logError('totals', e2); }
      if (rows && (isNode(rows) || rows.length)) totalsHost.appendChild(h('section', { 'class': 'mk-card mk-docform__card' }, forms.totals(rows)));
      /* a form with a panel and no totals (a goods receipt) gives the panel the whole width, and the other way round */
      panelHost.hidden = !panelHost.firstChild;
      totalsHost.hidden = !totalsHost.firstChild;
      bottom.hidden = !panelHost.firstChild && !totalsHost.firstChild;

      showWarnings(p);
    }

    /**
     * A warning is shown twice, so that it cannot be missed: beside the figure it concerns (under the header field,
     * or under the line with its cell marked), and in one callout directly above the action bar, floating with it
     * at the bottom of the screen (the dock), where the eye is when the button is pressed. One that names no input
     * of this form is in the callout alone. It never blocks: the button stays.
     */
    function showWarnings(result) {
      var list = warningsOf(result), byField = {}, lineWarnings = [];
      list.forEach(function (w) {
        var at = locate(w.field);
        if (at.kind === 'field') (byField[at.key] || (byField[at.key] = [])).push(w.message);
        else if (at.kind === 'line') lineWarnings.push({ index: at.index, key: at.key, message: w.message });
      });
      Object.keys(fieldEls).forEach(function (k) {
        var node = fieldEls[k].warn, said = byField[k];
        if (!node) return;
        ui.clear(node);
        node.hidden = !said;
        if (said) ui.append(node, ui.icon('alert-triangle', 14), h('span', null, said.join('. ')));
      });
      if (grid) grid.setWarnings(lineWarnings);
      ui.clear(warnHost);
      if (!list.length) return;
      /* "entered", the word of the audit entry: a form may post, submit or raise, and every one of them enters */
      var can = 'It can still be entered as it is.';
      warnHost.appendChild(list.length === 1 ? ui.callout('warn', list[0].message, 'Check the figure. ' + can)
        : ui.callout('warn', 'Check these figures first', [h('ul', { 'class': 'mk-docform__list' }, list.map(function (w) { return h('li', null, w.message); })), can]));
    }

    function locate(field) {
      if (blank(field)) return { kind: 'general' };
      var name = String(field);
      var map = o.fieldMap || {};
      var key = map[name] || name;
      if (fieldEls[key]) return { kind: 'field', key: key };
      var m = /^lines?(?:\[(\d+)\]|\.(\d+))(?:\.([\w-]+))?$/.exec(name);
      if (m && grid) {
        var colKey = m[3] ? (map[m[3]] || m[3]) : null;
        var n = +(m[1] !== undefined ? m[1] : m[2]);
        /* the engine counts the lines of the payload; when empty lines were left out, lineMap leads back to the grid's */
        return { kind: 'line', index: lineMap && lineMap[n] !== undefined ? lineMap[n] : n, key: colKey };
      }
      return { kind: 'general' };
    }

    /**
     * Put each error where it belongs. An error from a preview shows only once its field was touched (or after a
     * submit), so a new form does not open covered in "required"; force shows everything. Returns the first place to focus.
     */
    function showErrors(result, force) {
      Object.keys(fieldEls).forEach(function (k) { fieldEls[k].wrap.setError(''); });
      var lineErrors = [], general = [], first = null;
      var open = force || st.submitted;
      var blocked = resolve(o.submitReason, st) || '';
      errorsOf(result).forEach(function (err) {
        /* the persona may not post this at all: the bar already says so beside the locked button, once is enough */
        if (blocked && (err.code === 'role' || err.message === blocked)) return;
        var at = locate(err.field);
        if (at.kind === 'field') {
          if (!open && !st.touched[at.key]) return;
          fieldEls[at.key].wrap.setError(err.message || 'Check this field');
          first = first || { kind: 'field', key: at.key };
        } else if (at.kind === 'line') {
          if (!open && !st.touched['lines.' + at.index + (at.key ? '.' + at.key : '')]) return;
          lineErrors.push({ index: at.index, key: at.key, message: err.message || 'Check this line' });
          first = first || { kind: 'line', index: at.index, key: at.key };
        } else if (open || st.dirty) {
          general.push(err);
        }
      });
      if (grid) grid.setErrors(lineErrors);
      ui.clear(errorHost);
      general.forEach(function (err) {
        errorHost.appendChild(ui.callout('critical', err.message || 'This cannot be posted', err.docId ? ['Open ', forms.docLink(err.docId), ' first.'] : null));
      });
      return first;
    }

    function focusError(at) {
      if (!at) return;
      if (at.kind === 'line' && grid) { grid.focusCell(at.index, at.key); return; }
      var f = fieldEls[at.key];
      var target = f && (f.wrap.input || (f.control && f.control.input));
      if (target && typeof target.focus === 'function') target.focus();
    }

    /* ----- preview */

    function runPreview() {
      root.clearTimeout(previewTimer);
      previewTimer = null;
      var result = null;
      if (typeof o.onPreview === 'function') {
        try { result = o.onPreview(st, el) || null; }
        catch (e) { logError('onPreview', e); result = { ok: false, error: { code: 'preview', message: e && e.message ? e.message : String(e) } }; }
      }
      el.preview = result;
      if (grid) { grid.setPreview(result); grid.refresh(); }
      paintDerived();
      showErrors(result, false);
    }
    function schedulePreview() {
      root.clearTimeout(previewTimer);
      previewTimer = root.setTimeout(function () { if (el.isConnected) runPreview(); }, 90);
    }

    /* ----- actions */

    var posted = false; /* this form has posted its document: a second click before the redraw must not post it again */
    function submit() {
      var blocked = resolve(o.submitReason, st);
      if (posted || blocked || typeof o.onSubmit !== 'function') return null;
      root.clearTimeout(previewTimer);
      st.submitted = true;
      var result;
      try { result = o.onSubmit(st, el); }
      catch (e) { logError('onSubmit', e); result = { ok: false, error: { code: 'submit', message: e && e.message ? e.message : String(e) } }; }
      if (result && result.ok === true) posted = true;
      if (result && result.ok === false) focusError(showErrors(result, true));
      return result;
    }

    function cancel() {
      if (typeof o.onCancel !== 'function') return;
      if (!st.dirty || o.confirmDiscard === false) { o.onCancel(st); return; }
      ui.confirm({ title: 'Discard this draft?', message: 'What you entered here has not been posted and will be lost.', confirmLabel: 'Discard', cancelLabel: 'Keep editing', tone: 'danger' })
        .then(function (res) { if (res.ok) o.onCancel(st); });
    }

    var submitReason = resolve(o.submitReason, st) || '';
    var submitBtn = ui.button({ label: o.submitLabel || 'Post', icon: submitReason ? 'lock' : (o.submitIcon || 'check'), variant: 'primary', disabledReason: submitReason,
      title: 'Ctrl+Enter', onClick: submit });
    var bar = h('footer', { 'class': 'mk-docform__bar' },
      h('div', { 'class': 'mk-docform__barmain' }, errorHost,
        submitReason ? h('div', { 'class': 'mk-docact__why' }, ui.icon('lock', 12), submitReason) : null),
      h('div', { 'class': 'mk-docform__buttons' },
        typeof o.onCancel === 'function' ? ui.button({ label: o.cancelLabel || 'Cancel', variant: 'ghost', onClick: cancel }) : null,
        (o.actions || []).filter(Boolean).map(function (a) {
          return ui.button({ label: a.label, icon: a.icon, variant: a.variant, disabledReason: a.reason || '', title: a.title,
            onClick: function () { if (typeof a.onClick === 'function') a.onClick(st, el); } });
        }),
        submitBtn));

    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); }
    });

    /* ----- focus: remembered by field, so a rebuilt form puts the caret back where it was */

    el.addEventListener('focusin', function (e) {
      var key = e.target && e.target.getAttribute ? e.target.getAttribute('data-fkey') : null;
      if (key) st.focus = key;
    });
    el.addEventListener('focusout', function () {
      /* a rebuild removes the focused box without the user having left it: only a real move elsewhere forgets it */
      root.setTimeout(function () { if (el.isConnected && !el.contains(doc.activeElement)) st.focus = null; }, 0);
    });
    function restoreFocus() {
      var a = doc.activeElement;
      if (a && a !== doc.body && a !== doc.documentElement && !el.contains(a) && a.id !== 'mk-content') return; /* the user is somewhere else */
      if (a && el.contains(a)) return; /* the router already put the caret back */
      var target = null;
      if (st.focus) {
        var list = el.querySelectorAll('[data-fkey]');
        for (var i = 0; i < list.length; i++) if (list[i].getAttribute('data-fkey') === st.focus) { target = list[i]; break; }
      } else if (!st.opened && o.autofocus !== false) {
        target = el.querySelector('[data-fkey]:not([disabled])'); /* a form just opened starts in its first field */
      }
      st.opened = true;
      if (target && typeof target.focus === 'function') { try { target.focus({ preventScroll: true }); } catch (e) { /* not focusable */ } }
    }

    /* ----- assemble */

    function rebuild() {
      buildFields();
      if (grid) grid.rebuild(st.lines);
      if (matrix) matrix.setValues(st.matrix);
      paintBody();
      runPreview();
      root.setTimeout(function () { if (el.isConnected) restoreFocus(); }, 0);
    }

    /* the warnings ride with the action bar at the bottom of the screen: whenever the button is in sight, so is what
       the preview warned about, even when the figure it concerns has scrolled away (the cash of a long day-end) */
    var dock = h('div', { 'class': 'mk-docform__dock' }, warnHost, bar);

    ui.append(el,
      o.compact ? null : ui.pageHead({ title: o.title, subtitle: o.subtitle, chips: o.chips === undefined ? ui.statusChip('DRAFT', { label: 'Not posted yet' }) : o.chips,
        back: typeof o.onCancel === 'function' ? { label: o.backLabel || 'Back', onClick: cancel } : null }),
      fieldsCard, linesCard, matrixCard, bodyHost, bottom, dock);

    el.draft = st;
    el.preview = null;
    el.grid = grid;
    el.matrix = matrix;
    /** Run the preview again and repaint totals, computed cells, warnings and errors. Call after changing the draft in code. */
    el.refresh = runPreview;
    /** Rebuild fields and lines from the draft (after code replaced lines or changed which fields show). */
    el.rebuild = rebuild;
    el.submit = submit;
    /**
     * The lines of the draft that something was typed into - what the payload should carry. The form remembers which
     * grid line each one is, so 'lines[1].qty' in an error from the engine marks the right line even after an empty
     * one above it was left out.
     */
    el.lines = function () {
      lineMap = grid ? grid.filled() : [];
      return lineMap.map(function (i) { return st.lines[i]; });
    };
    /** Show a refusal from outside the form: setError({message, field, docId}) or setError(result). */
    el.setError = function (err) { focusError(showErrors(err && (err.error || err.errors) ? err : { error: err }, true)); };

    rebuild();
    return el;
  };

  /* -------------------------------------------------------------- docView */

  function actionNode(a, block) {
    var reason = a.reason || '';
    var btn = ui.button({ label: a.label, icon: reason ? 'lock' : a.icon, variant: a.variant || (a.danger ? 'danger' : 'secondary'), block: block,
      disabledReason: reason, title: a.title, onClick: a.onClick });
    /* a blocked action stays on screen with its reason: as the tooltip, and in words beside the button;
       docId is the document the engine says must be dealt with first, as a link */
    return h('div', { 'class': ['mk-docact', reason ? 'is-blocked' : ''] }, btn,
      reason ? h('div', { 'class': 'mk-docact__why' }, ui.icon('lock', 12),
        h('span', null, reason, a.docId && HB.router && HB.router.docPage(a.docId) ? [' ', forms.docLink(a.docId, 'Open ' + a.docId)] : null)) : null);
  }

  /**
   * docView({title, subtitle, status, chips, notice, meta, lines, totals, sections, timeline, related, actions, onBack,
   * backLabel, compact}) - the read view of a posted document. See docs/shell/UI-API.md for every option.
   * actions: [{label, icon, variant, onClick, reason}] - a non-empty reason disables the action and is shown with it.
   */
  forms.docView = function (o) {
    o = o || {};
    var chips = [];
    if (o.status) chips.push(isNode(o.status) ? o.status : forms.statusChip(o.status));
    if (o.chips) chips = chips.concat(o.chips);
    var actions = (o.actions || []).filter(Boolean);

    var notice = null;
    if (isNode(o.notice)) notice = o.notice;
    else if (o.notice && (o.notice.title || o.notice.text)) notice = ui.callout(o.notice.tone || 'info', o.notice.title || null, o.notice.text || null);

    var metaCard = o.meta && o.meta.length ? ui.card({ body: ui.keyValue(o.meta, { stacked: true }), className: 'mk-docview__meta' }) : null;

    var linesCard = null;
    if (o.lines || o.totals) {
      var linesBody = null;
      if (isNode(o.lines)) linesBody = o.lines;
      else if (o.lines) linesBody = ui.table({ columns: o.lines.columns, rows: o.lines.rows || [], footer: o.lines.footer, dense: true, empty: o.lines.empty || 'No lines' });
      linesCard = ui.card({
        title: o.lines && !isNode(o.lines) ? (o.lines.title || 'Lines') : null, subtitle: o.lines && !isNode(o.lines) ? o.lines.subtitle : null,
        flush: !!linesBody, className: 'mk-docview__lines',
        body: [linesBody, o.totals ? h('div', { 'class': 'mk-docview__totals' }, forms.totals(o.totals)) : null]
      });
    }

    var sections = (o.sections || []).filter(Boolean).map(function (s) {
      return isNode(s) ? s : ui.card({ title: s.title, subtitle: s.subtitle, body: s.body, flush: s.flush, actions: s.actions });
    });

    var actionsCard = actions.length ? ui.card({ title: 'Actions', className: 'mk-docview__actions',
      body: h('div', { 'class': 'mk-docacts' }, actions.map(function (a) { return actionNode(a, true); })) }) : null;

    var related = (o.related || []).filter(Boolean);
    var relatedCard = related.length ? ui.card({ title: 'Related documents', body: h('ul', { 'class': 'mk-related' }, related.map(function (r) {
      return h('li', { 'class': 'mk-related__item' },
        h('div', { 'class': 'mk-related__line' }, forms.docLink(r.id, r.label), r.status ? forms.statusChip(r.status) : null),
        r.note ? h('div', { 'class': 'mk-related__note' }, r.note) : null);
    })) }) : null;

    var timelineCard = o.timeline ? ui.card({ title: 'History', body: isNode(o.timeline) ? o.timeline : ui.timeline(o.timeline, { empty: 'Nothing recorded yet' }) }) : null;

    var main = h('div', { 'class': 'mk-docview__main' }, metaCard, linesCard, sections);
    var side = h('aside', { 'class': 'mk-docview__side' }, actionsCard, relatedCard, timelineCard);
    side.hidden = !side.firstChild;

    var el = h('article', { 'class': ['mk-docview', o.compact ? 'mk-docview--compact' : '', side.hidden ? 'mk-docview--single' : '', o.className] },
      o.compact ? null : ui.pageHead({ title: o.title, subtitle: o.subtitle, chips: chips, actions: o.headActions,
        back: typeof o.onBack === 'function' ? { label: o.backLabel || 'Back', onClick: o.onBack } : null }),
      o.compact && chips.length ? h('div', { 'class': 'mk-row mk-row--wrap' }, chips) : null,
      notice,
      h('div', { 'class': 'mk-docview__grid' }, main, side));
    return el;
  };

  /* ------------------------------------------------------------- printing */

  /**
   * printSheet({title, number, date, copy, seller: {name, lines}, party: {label, name, lines}, meta: [[label, value]],
   * columns: [{key, label, align, format, width}], rows, footer, totals, notes, signatory})
   * The paper form of a document (invoice, challan): a header block, the parties, a table whose header repeats on
   * every page, totals that stay together, notes and a signature line. Returns a node for printDoc() or a preview.
   */
  forms.printSheet = function (o) {
    o = o || {};
    var company = (HB.masters && HB.masters.company) || (HB.config && HB.config.company) || {};
    var seller = o.seller || { name: company.legalName || company.name || 'Happy Bakers', lines: [company.address, company.gstin ? 'GSTIN ' + company.gstin : null] };
    var cols = (o.columns || []).filter(Boolean);
    function lines(list) { return (list || []).filter(Boolean).map(function (l) { return h('div', null, l); }); }
    function cellClass(c) { return c.align === 'right' || (!c.align && NUMERIC[c.format]) ? 'is-num' : (c.align === 'center' ? 'is-center' : ''); }

    return h('div', { 'class': 'mk-print-doc' },
      h('div', { 'class': 'mk-print-head' },
        h('div', { 'class': 'mk-print-seller' }, h('div', { 'class': 'mk-print-seller__name' }, seller.name), lines(seller.lines)),
        h('div', { 'class': 'mk-print-title' },
          h('div', { 'class': 'mk-print-title__name' }, o.title || 'Document'),
          o.number ? h('div', { 'class': 'mk-print-title__no' }, o.number) : null,
          o.date ? h('div', null, HB.dates.isIso(o.date) ? HB.dates.label(o.date, 'd MMM yyyy') : o.date) : null,
          o.copy ? h('div', { 'class': 'mk-print-title__copy' }, o.copy) : null)),
      h('div', { 'class': 'mk-print-parties' },
        o.party ? h('div', { 'class': 'mk-print-party' }, h('div', { 'class': 'mk-print-label' }, o.party.label || 'To'),
          h('div', { 'class': 'mk-print-party__name' }, o.party.name), lines(o.party.lines)) : h('div'),
        o.meta && o.meta.length ? h('dl', { 'class': 'mk-print-meta' }, o.meta.filter(Boolean).map(function (p) {
          return h('div', null, h('dt', null, p[0]), h('dd', null, p[1]));
        })) : null),
      cols.length ? h('table', { 'class': 'mk-print-table' },
        h('thead', null, h('tr', null, cols.map(function (c) { return h('th', { 'class': cellClass(c), style: c.width ? { width: typeof c.width === 'number' ? c.width + 'px' : c.width } : null }, c.label); }))),
        h('tbody', null, (o.rows || []).map(function (row, i) {
          return h('tr', null, cols.map(function (c) {
            var v = typeof c.value === 'function' ? c.value(row, i) : row[c.key];
            return h('td', { 'class': cellClass(c) }, formatCell(c.format, v, row, c));
          }));
        })),
        o.footer ? h('tfoot', null, h('tr', null, cols.map(function (c) {
          var v = o.footer[c.key];
          return h('td', { 'class': cellClass(c) }, v === undefined ? '' : (typeof v === 'string' || isNode(v) ? v : formatCell(c.format, v, o.footer, c)));
        }))) : null) : null,
      h('div', { 'class': 'mk-print-end' },
        h('div', { 'class': 'mk-print-notes' }, typeof o.notes === 'string' ? h('div', null, o.notes) : lines(o.notes)),
        o.totals ? h('div', { 'class': 'mk-print-totals' }, forms.totals(o.totals)) : null),
      o.signatory === false ? null : h('div', { 'class': 'mk-print-sign' },
        h('div', { 'class': 'mk-print-sign__box' }, h('div', { 'class': 'mk-print-sign__line' }), 'Received by'),
        h('div', { 'class': 'mk-print-sign__box' }, h('div', { 'class': 'mk-print-sign__line' }), o.signatory || ('For ' + seller.name))));
  };

  /**
   * printDoc(node, {title}) - print only this node. A copy of it goes into a print-only host, css/print.css hides the
   * shell while the browser prints, and the copy is removed afterwards. title names the print job (and a saved PDF).
   */
  forms.printDoc = function (node, o) {
    o = o || {};
    if (!isNode(node)) return;
    var host = doc.getElementById('mk-print');
    if (!host) { host = h('div', { id: 'mk-print', 'class': 'mk-print' }); doc.body.appendChild(host); }
    ui.clear(host).appendChild(node.cloneNode(true));
    var html = doc.documentElement, oldTitle = doc.title, done = false;
    function cleanup() {
      if (done) return;
      done = true;
      root.removeEventListener('afterprint', cleanup);
      html.classList.remove('mk-printing');
      ui.clear(host);
      doc.title = oldTitle;
    }
    html.classList.add('mk-printing');
    if (o.title) doc.title = o.title;
    root.addEventListener('afterprint', cleanup);
    try { root.print(); } catch (e) { logError('print', e); cleanup(); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
