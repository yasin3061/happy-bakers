/*
 * Setup (#/masters/setup). Expense categories and locations: the two lists, one record with its change history,
 * and the form that adds or edits it. Adding a location adds an own store: the engine creates its unit, its stock
 * location, its transit location and its cash account in one operation. A store is deactivated only when it holds
 * no stock and no cash; the engine says so, and the page shows its reason beside the locked button.
 * Every value shown is HB.data's and every rule is the engine's; the page holds the wording and the layout.
 */
(function (root) {
  'use strict';

  var HB = root.HB;
  if (!HB || !HB.router || !HB.ui || !HB.forms) return;
  var ui = HB.ui, h = ui.h, forms = HB.forms, fmt = HB.fmt;

  var ROUTE = '#/masters/setup';
  var MODES = [{ value: 'claim', label: 'Expense claims' }, { value: 'bill', label: 'Expense bills' }, { value: 'both', label: 'Claims and bills' }];
  var LOC_KINDS = { rm: 'Factory, raw materials', fg: 'Factory, finished goods', store: 'Own store' };
  /* the two lists: the name of the engine's entity, the words, and the hash parameter that opens one record */
  var KINDS = [
    { id: 'categories', entity: 'expenseCategories', param: 'category', label: 'Expense categories', one: 'category', back: 'Back to categories' },
    { id: 'locations', entity: 'locations', param: 'location', label: 'Locations', one: 'location', back: 'Back to locations' }
  ];

  function L() { return HB.data.lookup; }
  function kindOf(id) { return KINDS.filter(function (k) { return k.id === id; })[0] || null; }
  function blank(v) { return v === null || v === undefined || v === ''; }
  function item(id) { return L().item(id); }
  function modeLabel(m) { var x = MODES.filter(function (o) { return o.value === m; })[0]; return x ? x.label : String(m || ''); }
  function statusOf(rec) { return rec.active ? 'ACTIVE' : 'INACTIVE'; }
  function go(ctx, kind, id) { var p = {}; if (id) p[kind.param] = id; ctx.navigate(ROUTE, p); }
  function systemNote(c) {
    return c.system === 'salary' ? 'The monthly salary bill goes under it' : (c.system ? 'A store day-end books its cash difference under it' : '');
  }
  function categories() { return L().categories({ system: true, active: 'all' }); }
  /** The places that hold stock, a store with what the engine created beside it. A transit location is part of its store. */
  function locations() {
    return L().locations({ active: 'all' }).filter(function (l) { return l.kind !== 'transit'; }).map(function (l) {
      var u = l.kind === 'store' ? L().unit(l.unitId) : null;
      return { id: l.id, name: l.name, kind: l.kind, kindLabel: LOC_KINDS[l.kind] || l.kind, active: l.active, unit: u,
        transitName: u ? L().name('location', u.transitLocId) : '', cashName: u ? L().name('account', u.cashAccountId) : '',
        standing: u ? u.standing : null, products: u ? Object.keys(u.standing).length : null };
    });
  }

  /* ------------------------------------------------------------ change history */

  /** What one saved change did, line by line, from the record before and after as the engine holds them. */
  function changeLines(before, after) {
    var out = [];
    function note(label, a, b, text) {
      if (blank(a) && blank(b)) return;
      if (String(blank(a) ? '' : a) !== String(blank(b) ? '' : b)) out.push(label + ': ' + (blank(a) ? 'none' : text(a)) + ' to ' + (blank(b) ? 'none' : text(b)));
    }
    note('Name', before.name, after.name, String);
    note('Used for', before.mode, after.mode, modeLabel);
    var was = before.standing || {}, now = after.standing || {};
    Object.keys(now).forEach(function (id) {
      var it = item(id);
      if (was[id] === undefined) out.push('Standing quantity: added ' + it.name + ', ' + fmt.qty(now[id], it.unit));
      else if (was[id] !== now[id]) out.push('Standing quantity: ' + it.name + ', ' + fmt.qty(was[id], it.unit) + ' to ' + fmt.qty(now[id], it.unit));
    });
    Object.keys(was).forEach(function (id) { if (now[id] === undefined) out.push('Standing quantity: removed ' + item(id).name); });
    return out.length ? out : ['Saved with nothing changed'];
  }

  /** The audit trail of one record as timeline events, oldest first. */
  function historyOf(kind, id) {
    var rows = HB.data.audit.list({ masters: true, type: kind.entity, docId: id, limit: 0 }).rows.slice().reverse();
    return rows.map(function (r) {
      if (r.action === 'setActive') {
        var off = r.after && r.after.active === false;
        return { actor: r.userName, role: r.roleLabel, at: r.at, action: off ? 'Deactivated' : 'Activated', icon: off ? 'ban' : 'check' };
      }
      return { actor: r.userName, role: r.roleLabel, at: r.at, action: r.before ? 'Changed' : 'Added', icon: r.before ? 'edit' : 'plus',
        note: r.before ? h('ul', { 'class': 'mk-docform__list' }, changeLines(r.before, r.after).map(function (line) { return h('li', null, line); })) : null };
    });
  }

  /* ------------------------------------------------------------------ list */

  function categoryList(st, ctx, may) {
    var kind = kindOf('categories');
    var rows = categories().map(function (c) {
      return { id: c.id, name: c.name, modeLabel: modeLabel(c.mode), system: systemNote(c), active: c.active, status: statusOf(c) };
    });
    return forms.docList({
      state: st.lists.categories, rows: rows, title: kind.label,
      subtitle: 'What an expense is booked under. A change applies to new documents only: expenses already posted keep their category.',
      search: ['name', 'modeLabel'], searchPlaceholder: 'Search categories', empty: 'No expense category yet',
      rowClass: function (row) { return row.active ? '' : 'is-muted'; },
      columns: [
        { key: 'name', label: 'Category' },
        { key: 'modeLabel', label: 'Used for' },
        { key: 'system', label: 'Used by Neo ERP itself', maxWidth: 320 },
        { key: 'status', label: 'Status', render: ui.cells.status() }
      ],
      onOpen: function (row) { go(ctx, kind, row.id); },
      newLabel: 'New category', newReason: may.ok ? '' : may.reason,
      onNew: function () { st.form = forms.draft({ kind: kind.id, values: {} }); ctx.rerender(); }
    });
  }

  function locationList(st, ctx, may) {
    var kind = kindOf('locations');
    var rows = locations().map(function (l) {
      return { id: l.id, name: l.name, kindLabel: l.kindLabel, transitName: l.transitName, cashName: l.cashName, products: l.products, active: l.active, status: statusOf(l) };
    });
    return forms.docList({
      state: st.lists.locations, rows: rows, title: kind.label,
      subtitle: 'The factory stores and the own stores. A new store comes with its transit location and its cash account.',
      search: ['name', 'kindLabel'], searchPlaceholder: 'Search locations', empty: 'No location yet',
      rowClass: function (row) { return row.active ? '' : 'is-muted'; },
      columns: [
        { key: 'name', label: 'Location' },
        { key: 'kindLabel', label: 'Kind' },
        { key: 'cashName', label: 'Cash account', maxWidth: 200 },
        { key: 'products', label: 'Products stocked', format: 'num', title: 'The products with a standing quantity' },
        { key: 'status', label: 'Status', render: ui.cells.status() }
      ],
      onOpen: function (row) { go(ctx, kind, row.id); },
      newLabel: 'New store', newReason: may.ok ? '' : may.reason,
      onNew: function () { st.form = forms.draft({ kind: kind.id, values: {} }); ctx.rerender(); }
    });
  }

  function list(rootEl, ctx) {
    var st = ctx.state, may = HB.session.can('master.edit');
    st.lists = st.lists || { categories: {}, locations: {} };
    var kind = kindOf(st.tab) || KINDS[0];
    st.tab = kind.id;
    ui.append(rootEl,
      ui.tabs({
        ariaLabel: 'Categories or locations', value: kind.id,
        items: KINDS.map(function (k) { return { id: k.id, label: k.label, count: (k.id === 'categories' ? categories() : locations()).length }; }),
        onChange: function (id) { st.tab = id; ctx.rerender(); }
      }),
      kind.id === 'categories' ? categoryList(st, ctx, may) : locationList(st, ctx, may));
  }

  /* ------------------------------------------------------------------ view */

  function startEdit(ctx, kind, rec) {
    var draft = kind.id === 'categories' ? { kind: kind.id, values: { id: rec.id, name: rec.name, mode: rec.mode } }
      : { kind: kind.id, values: { id: rec.id, name: rec.name },
        lines: rec.standing ? Object.keys(rec.standing).map(function (id) { return { itemId: id, qty: rec.standing[id] }; }) : [] };
    ctx.state.form = forms.draft(draft);
    ctx.rerender();
  }

  /** Deactivate or activate, after a question. The engine decides; a refusal is shown as it words it. */
  function toggle(kind, rec) {
    var off = rec.active, store = kind.id === 'locations';
    ui.confirm({
      title: (off ? 'Deactivate ' : 'Activate ') + rec.name + '?', confirmLabel: off ? 'Deactivate' : 'Activate', tone: off ? 'danger' : 'primary',
      message: off ? (store ? 'The store, its transit location and its cash account are closed to new documents. Its history stays in every report, and it can be activated again.'
        : 'New expenses no longer offer this category. Expenses already posted keep it, and it can be activated again.')
        : (store ? 'The store, its transit location and its cash account take new documents again.' : 'New expenses offer this category again.')
    }).then(function (r) {
      if (!r.ok) return;
      var res = HB.engine.act('setActive', { entity: kind.entity, id: rec.id, active: !off });
      if (!res.ok) { forms.fail(res, rec.name + ': not done'); return; }
      ui.toast(off ? 'New documents no longer offer it. Posted documents keep it.' : 'New documents offer it again.',
        { title: rec.name + (off ? ' deactivated' : ' activated'), tone: 'good', duration: 6500 });
    });
  }

  function standingCard(loc) {
    var rows = Object.keys(loc.standing).map(function (id) { var it = item(id); return { name: it.display, qty: loc.standing[id], unit: it.unit }; });
    return { title: 'Standing quantities', flush: true, subtitle: 'The fixed daily stock level of the store. It prefills the transfer sent to it.',
      body: ui.table({ dense: true, rows: rows, empty: 'No standing quantity: a transfer to this store starts empty',
        columns: [{ key: 'name', label: 'Product' }, { key: 'qty', label: 'A day', format: 'qty' }] }) };
  }

  function missing(rootEl, ctx, kind, id) {
    rootEl.appendChild(ui.emptyState('No such ' + kind.one, String(id) + ' is not among the ' + kind.label.toLowerCase() + '.',
      { icon: 'settings', action: ui.button({ label: kind.back, icon: 'arrow-left', onClick: function () { go(ctx, kind); } }) }));
  }

  /** What a store holds now, from the selectors: the two things that keep it from being deactivated. */
  function holdings(loc) {
    var stock = HB.data.stock.value().rows, cash = HB.data.cash.balances().rows;
    function valueAt(id) { var r = stock.filter(function (x) { return x.locId === id; })[0]; return r ? r.value : null; }
    var held = valueAt(loc.unit.locId), coming = valueAt(loc.unit.transitLocId);
    var acc = cash.filter(function (x) { return x.accountId === loc.unit.cashAccountId; })[0];
    return [
      ['Stock held, at today\'s cost', held === null ? null : fmt.inr2(held)],
      ['Stock on its way, at today\'s cost', coming === null ? null : fmt.inr2(coming)],
      ['Cash in hand', acc ? fmt.inr2(acc.balance) : null]
    ];
  }

  function view(rootEl, ctx, kind, id) {
    var category = kind.id === 'categories';
    var rec = category ? categories().filter(function (c) { return c.id === id; })[0] : locations().filter(function (l) { return l.id === id; })[0];
    if (!rec) { missing(rootEl, ctx, kind, id); return; }
    var may = HB.session.can('master.edit'), store = !category && rec.kind === 'store';
    var chk = HB.engine.check('setActive', { entity: kind.entity, id: rec.id, active: !rec.active });
    ctx.state.tab = kind.id;
    rootEl.appendChild(forms.docView({
      title: rec.name, status: statusOf(rec), onBack: function () { go(ctx, kind); }, backLabel: kind.back,
      subtitle: category ? 'Expense category' : rec.kindLabel,
      notice: { tone: 'info', title: 'A change applies to new documents only',
        text: category ? 'Expenses already posted stay under this category. A new name shows on them too; their amounts do not move.'
          : (store ? 'Transfers already sent keep their quantities. The next transfer is prefilled from the standing quantities as they stand then.'
            : 'Documents already posted are not touched.') },
      meta: category ? [['Used for', modeLabel(rec.mode)], ['Used by Neo ERP itself', systemNote(rec) || null]]
        : [['Kind', rec.kindLabel], ['Stock on its way is held in', store ? rec.transitName : null], ['Cash account', store ? rec.cashName : null]].concat(store ? holdings(rec) : []),
      sections: [store ? standingCard(rec) : null],
      timeline: historyOf(kind, rec.id),
      actions: [
        { label: 'Edit the ' + kind.one, icon: 'edit', variant: 'primary', reason: may.ok ? '' : may.reason, onClick: function () { startEdit(ctx, kind, rec); } },
        { label: rec.active ? 'Deactivate' : 'Activate', icon: rec.active ? 'ban' : 'check', danger: rec.active,
          reason: chk.ok ? '' : chk.error.message, onClick: function () { toggle(kind, rec); } }
      ]
    }));
  }

  /* ------------------------------------------------------------------ form */

  function once(it, row, rows) { return rows.every(function (x) { return x === row || x.itemId !== it.id; }); }   /* a product goes on one line */

  /** draft -> the record of docs/API.md 2.10: an expense category, or a location with its standing quantities sent whole. */
  function record(kind, d, f, old) {
    var v = d.values, r = {};
    if (v.id) r.id = v.id;
    r.name = v.name || '';
    if (kind.id === 'categories') { r.mode = v.mode || null; return r; }
    if (!old || old.kind === 'store') {
      r.standing = {};
      f.lines().forEach(function (l) { r.standing[l.itemId || ''] = l.qty || 0; });   /* a quantity with no product: the engine refuses it */
    }
    return r;
  }

  /** A refusal about the standing quantities belongs at its line: the one with a quantity and no product, or the one the engine names. */
  function atLine(res, f) {
    if (!res || res.ok || !res.error || res.error.field !== 'standing') return res;
    var lines = f.lines(), at = -1, key = 'itemId', i, k, e = {};
    for (i = 0; i < lines.length && at === -1; i++) if (!lines[i].itemId) at = i;
    for (i = 0; i < lines.length && at === -1; i++) if (String(res.error.message).indexOf(item(lines[i].itemId).name + ':') === 0) { at = i; key = 'qty'; }
    if (at === -1) return res;
    for (k in res.error) if (Object.prototype.hasOwnProperty.call(res.error, k)) e[k] = res.error[k];
    e.field = 'lines[' + at + '].' + key;
    return { ok: false, error: e };
  }

  function form(rootEl, ctx, kind) {
    var st = ctx.state, draft = st.form, may = HB.session.can('master.edit');
    var category = kind.id === 'categories', v = draft.values;
    var old = v.id ? (category ? categories() : locations()).filter(function (x) { return x.id === v.id; })[0] || null : null;
    var store = !category && (!old || old.kind === 'store');
    var noun = category ? 'category' : (store ? 'store' : 'location');
    rootEl.appendChild(forms.docForm({
      title: old ? 'Edit ' + old.name : 'New ' + noun, state: draft, backLabel: old ? 'Back to the ' + kind.one : kind.back, submitLabel: 'Save ' + noun,
      chips: ui.statusChip('DRAFT', { label: 'Not saved yet' }),
      submitReason: may.ok ? '' : may.reason,
      fields: [
        { key: 'name', label: 'Name', required: true, span: 2, maxLength: 60,
          hint: category ? '' : (store ? 'Its transit location and its cash account are named after it' : '') },
        category ? { key: 'mode', label: 'Used for', type: 'select', required: true, span: 2, options: MODES,
          hint: 'A claim is what an employee spent; a bill is what a vendor charges' } : null
      ],
      lines: store ? {
        title: 'Standing quantities', subtitle: 'The fixed daily stock level of the store. It prefills the transfer sent to it.',
        addLabel: 'Add product', empty: 'No standing quantity: a transfer to this store starts empty',
        columns: [
          { key: 'itemId', label: 'Product', type: 'item', kind: 'fg', required: true, width: '60%', filter: once },
          { key: 'qty', label: 'A day', type: 'int', required: true, unit: function (row) { return row.itemId ? item(row.itemId).unit : ''; } }
        ]
      } : null,
      panel: function () {
        if (category) return ui.callout('info', 'A change applies to new documents only', 'Expenses already posted stay under this category and keep their amounts. A new name shows on them too, in every report. The change goes into the history of the category.');
        if (!old) return ui.callout('info', 'One step sets up the whole store',
          'Saving gives the store its own stock, a place for the stock on its way from the factory, and its own cash. From then on transfers, day-ends, the cash book and the location filters offer it.');
        return ui.callout('info', 'A change applies to new documents only', store
          ? 'The next transfer is prefilled from the standing quantities as they stand then. Transfers already sent keep their quantities. The change goes into the history of the store.'
          : 'Documents already posted are not touched. The change goes into the history of the location.');
      },
      onPreview: function (d, f) { return atLine(HB.engine.check('master', { entity: kind.entity, record: record(kind, d, f, old) }), f); },
      onSubmit: function (d, f) {
        var res = HB.engine.act('master', { entity: kind.entity, record: record(kind, d, f, old) });
        if (!res.ok) return atLine(res, f);         /* the form shows the refusal at the field or the line it names */
        st.form = null;
        var u = res.unit || null, text;
        if (!res.before) {
          text = u ? 'Created with it: ' + L().name('location', u.transitLocId) + ' and ' + L().name('account', u.cashAccountId) + '. Transfers and day-ends can use it from now.'
            : 'New expenses can use it from now.';
        } else {
          text = changeLines(res.before, { name: res.record.name, mode: res.record.mode, standing: u ? u.standing : null }).join('. ') + '. New documents take it from now.';
        }
        ui.toast(text, { title: res.record.name + (res.before ? ' saved' : ' added'), tone: 'good', duration: 6500 });
        go(ctx, kind, res.record.id);
        return res;
      },
      onCancel: function () { st.form = null; ctx.rerender(); }
    }));
  }

  /* ------------------------------------------------------------------ page */

  HB.router.register({
    id: 'masters-setup', route: ROUTE, group: 'Masters', title: 'Setup', subtitle: 'Expense categories and locations', filters: [],
    render: function (rootEl, ctx) {
      var draft = ctx.state.form;
      var asked = ctx.params.category || ctx.params.location || null;
      /* a record being added or edited survives redraws; a link to another record opens that record, and the draft waits */
      if (draft && kindOf(draft.kind) && (!asked || asked === draft.values.id)) return form(rootEl, ctx, kindOf(draft.kind));
      if (ctx.params.category) return view(rootEl, ctx, kindOf('categories'), ctx.params.category);
      if (ctx.params.location) return view(rootEl, ctx, kindOf('locations'), ctx.params.location);
      list(rootEl, ctx);
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
