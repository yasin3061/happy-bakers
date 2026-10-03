/*
 * Items (#/masters/items). Finished goods, raw materials and packing: the list by kind, one item with its price
 * list, its recipe link and its change history, and the form that adds or edits it. An item is a master, not a
 * document: it is saved with HB.engine.act('master') and switched off with act('setActive'), never deleted.
 * Every value shown is HB.data.lookup's and every rule is the engine's; the page holds the wording and the layout.
 */
(function (root) {
  'use strict';

  var HB = root.HB;
  if (!HB || !HB.router || !HB.ui || !HB.forms) return;
  var ui = HB.ui, h = ui.h, forms = HB.forms, fmt = HB.fmt;

  var ROUTE = '#/masters/items';
  var ENTITY = 'items';
  var KINDS = [
    { id: 'fg', label: 'Finished goods', one: 'Finished product' },
    { id: 'rm', label: 'Raw materials', one: 'Raw material' },
    { id: 'pk', label: 'Packing', one: 'Packing' }
  ];
  var NEW_ONLY = 'A change applies to new documents only. Documents already posted keep the values they were posted with.';

  function L() { return HB.data.lookup; }
  function kindOf(id) { return KINDS.filter(function (k) { return k.id === id; })[0] || KINDS[0]; }
  function gstText(v) { return v > 0 ? fmt.qty(v) + '%' : 'Nil'; }
  function daysText(v) { return v === null || v === undefined || v === '' ? '-' : fmt.qty(v, +v === 1 ? 'day' : 'days'); }
  function blank(v) { return v === null || v === undefined || v === ''; }

  /* ------------------------------------------------------------ change history */

  /* the fields a change can touch, with the name a reader knows them by and how a value is written */
  var FIELDS = [
    ['name', 'Name'], ['code', 'Code'], ['unit', 'Unit'], ['pack', 'Pack'], ['hsn', 'HSN'],
    ['gstRate', 'GST rate', function (v) { return gstText(+v || 0); }],
    ['shelfLifeDays', 'Best before', daysText],
    ['reorderLevel', 'Reorder level', function (v, rec) { return fmt.qty(+v || 0, rec.unit); }],
    ['price.mrp', 'MRP', function (v) { return fmt.inr2(v); }],
    ['price.retail', 'Retailer price', function (v) { return fmt.rate(v); }],
    ['price.corporate', 'Corporate price', function (v) { return fmt.rate(v); }]
  ];

  function valueAt(rec, path) {
    return path.split('.').reduce(function (o, k) { return o === null || o === undefined ? undefined : o[k]; }, rec);
  }

  /** What one saved change did, field by field, from the record before and after as the engine holds them. */
  function changeLines(before, after) {
    var out = [];
    FIELDS.forEach(function (f) {
      var a = valueAt(before, f[0]), b = valueAt(after, f[0]);
      if (blank(a) && blank(b)) return;
      if (String(blank(a) ? '' : a) === String(blank(b) ? '' : b)) return;
      var text = f[2] || function (v) { return String(v); };
      out.push(f[1] + ': ' + (blank(a) ? 'none' : text(a, before)) + ' to ' + (blank(b) ? 'none' : text(b, after)));
    });
    return out.length ? out : ['Saved with nothing changed'];
  }

  /** The audit trail of one item as timeline events, oldest first. */
  function historyOf(id) {
    var rows = HB.data.audit.list({ masters: true, type: ENTITY, docId: id, limit: 0 }).rows.slice().reverse();
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

  function rowOf(it) {
    return {
      id: it.id, code: it.code, name: it.name, pack: it.pack, unit: it.unit, hsn: it.hsn, gstRate: it.gstRate, shelfLifeDays: it.shelfLifeDays,
      reorderLevel: it.reorderLevel, mrp: it.price ? it.price.mrp : null, retail: it.price ? it.price.retail : null,
      corporate: it.price ? it.price.corporate : null, active: it.active, status: it.active ? 'ACTIVE' : 'INACTIVE'
    };
  }

  function columnsOf(kind) {
    var name = { key: 'name', label: kind === 'fg' ? 'Product' : 'Item',
      render: ui.cells.twoLine(function (row) { return [row.code, row.pack].filter(Boolean).join(', '); }, { maxWidth: 260 }) };
    var gst = { key: 'gstRate', label: 'GST', align: 'right', format: gstText };
    var status = { key: 'status', label: 'Status', render: ui.cells.status() };
    if (kind === 'fg') {
      return [name, gst,
        { key: 'shelfLifeDays', label: 'Best before', align: 'right', format: daysText },
        { key: 'mrp', label: 'MRP', format: 'inr2', title: 'GST included, as printed on the pack' },
        { key: 'retail', label: 'Retailer price', format: 'rate', title: 'Before GST' },
        { key: 'corporate', label: 'Corporate price', format: 'rate', title: 'Before GST' },
        status];
    }
    return [name, { key: 'unit', label: 'Unit' }, { key: 'hsn', label: 'HSN' }, gst,
      { key: 'reorderLevel', label: 'Reorder level', format: 'qty', title: 'The raw store shows the item as low at or below this quantity' },
      status];
  }

  function list(rootEl, ctx) {
    var st = ctx.state, may = HB.session.can('master.edit');
    var by = {};
    KINDS.forEach(function (k) { by[k.id] = []; });
    L().items({ active: 'all' }).forEach(function (it) { if (by[it.kind]) by[it.kind].push(rowOf(it)); });
    var kind = by[st.kind] ? st.kind : KINDS[0].id;
    st.kind = kind;
    st.lists = st.lists || {};
    st.lists[kind] = st.lists[kind] || {};
    ui.append(rootEl,
      ui.tabs({
        ariaLabel: 'Kind of item', value: kind,
        items: KINDS.map(function (k) { return { id: k.id, label: k.label, count: by[k.id].length }; }),
        onChange: function (id) { st.kind = id; ctx.rerender(); }
      }),
      forms.docList({
        state: st.lists[kind], rows: by[kind], columns: columnsOf(kind), title: kindOf(kind).label, subtitle: NEW_ONLY,
        search: ['name', 'code', 'pack', 'hsn'], searchPlaceholder: 'Search items', sort: { key: 'name', dir: 'asc' },
        empty: 'No item of this kind yet',
        rowClass: function (row) { return row.active ? '' : 'is-muted'; },
        onOpen: function (row) { ctx.navigate(ROUTE, { id: row.id }); },
        newLabel: 'New item', newReason: may.ok ? '' : may.reason,
        onNew: function () { st.form = forms.draft({ values: { kind: kind } }); ctx.rerender(); }
      }));
  }

  /* ------------------------------------------------------------------ view */

  function startEdit(ctx, it) {
    ctx.state.form = forms.draft({ values: {
      id: it.id, kind: it.kind, code: it.code, name: it.name, unit: it.unit, pack: it.pack || null, hsn: it.hsn || null, gstRate: it.gstRate || null,
      shelfLifeDays: it.shelfLifeDays, reorderLevel: it.reorderLevel || null,
      'price.mrp': it.price ? it.price.mrp : null, 'price.retail': it.price ? it.price.retail : null, 'price.corporate': it.price ? it.price.corporate : null
    } });
    ctx.rerender();
  }

  /** Deactivate or activate, after a question. The engine decides; a refusal is shown as it words it. */
  function toggle(it) {
    var off = it.active;
    ui.confirm({
      title: (off ? 'Deactivate ' : 'Activate ') + it.name + '?', confirmLabel: off ? 'Deactivate' : 'Activate', tone: off ? 'danger' : 'primary',
      message: off ? 'It is no longer offered on new documents. Documents already posted keep it, its stock and its history stay, and it can be activated again.'
        : 'It is offered on new documents again.'
    }).then(function (r) {
      if (!r.ok) return;
      var res = HB.engine.act('setActive', { entity: ENTITY, id: it.id, active: !off });
      if (!res.ok) { forms.fail(res, it.name + ': not done'); return; }
      ui.toast(off ? 'New documents no longer offer it. Posted documents keep it.' : 'New documents offer it again.',
        { title: it.name + (off ? ' deactivated' : ' activated'), tone: 'good', duration: 6500 });
    });
  }

  function priceCard(it) {
    return { title: 'Price list', flush: true, subtitle: 'An invoice, a dispatch sheet and a day-end take these prices as they are posted.',
      body: ui.table({ dense: true, columns: [
        { key: 'label', label: 'Price' }, { key: 'note', label: 'Used for', wrap: true }, { key: 'price', label: 'Per ' + (it.unit || 'unit'), align: 'right' }
      ], rows: [
        { label: 'MRP', note: 'GST included, as printed on the pack. The own stores sell at it.', price: fmt.inr2(it.price.mrp) },
        { label: 'Retailer price', note: 'Before GST. What a retail outlet is invoiced.', price: fmt.rate(it.price.retail) },
        { label: 'Corporate price', note: 'Before GST. What a corporate customer is invoiced.', price: fmt.rate(it.price.corporate) }
      ] }) };
  }

  function recipeCard(it) {
    if (!HB.session.canOpen('make-recipes')) return null;
    var href = HB.router.href('#/make/recipes', { item: it.id });
    return { title: 'Recipe', body: it.hasRecipe
      ? h('div', null, 'What a mix takes, what it gives and what a unit costs: ', h('a', { 'class': 'mk-link', href: href }, 'open the recipe of ' + it.name), '.')
      : h('div', null, 'No recipe yet, so its production cannot be recorded and it has no cost. ', h('a', { 'class': 'mk-link', href: href }, 'Add the recipe of ' + it.name), '.') };
  }

  function missing(rootEl, ctx, id) {
    rootEl.appendChild(ui.emptyState('No such item', String(id) + ' is not among the items.',
      { icon: 'box', action: ui.button({ label: 'Back to items', icon: 'arrow-left', onClick: function () { ctx.navigate(ROUTE); } }) }));
  }

  function view(rootEl, ctx, id) {
    var it = L().item(id);
    if (it.unknown) { missing(rootEl, ctx, id); return; }
    var fg = it.kind === 'fg', may = HB.session.can('master.edit');
    var chk = HB.engine.check('setActive', { entity: ENTITY, id: it.id, active: !it.active });
    ctx.state.kind = it.kind;   /* "Back to items" returns to the tab of this item */
    rootEl.appendChild(forms.docView({
      title: it.name, subtitle: [it.code, kindOf(it.kind).one].filter(Boolean).join(', '), status: it.active ? 'ACTIVE' : 'INACTIVE',
      onBack: function () { ctx.navigate(ROUTE); }, backLabel: 'Back to items',
      notice: { tone: 'info', title: 'A change applies to new documents only',
        text: fg ? 'Documents already posted keep the GST rate and the prices they were posted with.' : 'Documents already posted keep the GST rate and the rate they were posted with.' },
      meta: [
        ['Code', it.code], ['Kind', kindOf(it.kind).one], ['Unit', it.unit], ['Pack', it.pack || null], ['HSN', it.hsn || null],
        ['GST rate', gstText(it.gstRate)],
        ['Best before', fg ? daysText(it.shelfLifeDays) + ' from the day it is made' : null],
        ['Reorder level', fg ? null : (it.reorderLevel > 0 ? fmt.qty(it.reorderLevel, it.unit) : 'None')]
      ],
      sections: [fg && it.price ? priceCard(it) : null, fg ? recipeCard(it) : null],
      timeline: historyOf(it.id),
      actions: [
        { label: 'Edit the item', icon: 'edit', variant: 'primary', reason: may.ok ? '' : may.reason, onClick: function () { startEdit(ctx, it); } },
        { label: it.active ? 'Deactivate' : 'Activate', icon: it.active ? 'ban' : 'check', danger: it.active,
          reason: chk.ok ? '' : chk.error.message, onClick: function () { toggle(it); } }
      ]
    }));
  }

  /* ------------------------------------------------------------------ form */

  /** draft -> the record of docs/API.md 2.10 (entity items). A product carries its three prices, a material its reorder level. */
  function record(d) {
    var v = d.values, r = {};
    if (v.id) r.id = v.id;
    r.kind = v.kind || null;
    r.code = v.code || '';
    r.name = v.name || '';
    r.unit = v.unit || '';
    r.pack = v.pack || '';
    r.hsn = v.hsn || '';
    r.gstRate = v.gstRate || 0;
    if (v.kind === 'fg') {
      r.shelfLifeDays = v.shelfLifeDays;
      r.price = { mrp: v['price.mrp'], retail: v['price.retail'], corporate: v['price.corporate'] };
    } else {
      r.reorderLevel = v.reorderLevel || 0;
    }
    return r;
  }

  function isProduct(d) { return d.values.kind === 'fg'; }
  function isMaterial(d) { return !!d.values.kind && d.values.kind !== 'fg'; }

  function form(rootEl, ctx) {
    var st = ctx.state, draft = st.form, may = HB.session.can('master.edit');
    var old = draft.values.id ? L().item(draft.values.id) : null;
    rootEl.appendChild(forms.docForm({
      title: old ? 'Edit ' + old.name : 'New item', state: draft, backLabel: old ? 'Back to the item' : 'Back to items', submitLabel: 'Save item',
      chips: ui.statusChip('DRAFT', { label: 'Not saved yet' }),
      submitReason: may.ok ? '' : may.reason,
      fields: [
        old ? { key: 'kind', label: 'Kind', type: 'static', text: function () { return kindOf(old.kind).one; }, hint: 'The kind of an item cannot be changed' }
          : { key: 'kind', label: 'Kind', type: 'select', required: true, rebuild: true, options: KINDS.map(function (k) { return { value: k.id, label: k.one }; }) },
        { key: 'code', label: 'Code', maxLength: 12, hint: old ? '' : 'Left empty, the item gets a code of its own' },
        { key: 'name', label: 'Name', required: true, span: 2, maxLength: 60 },
        { key: 'unit', label: 'Unit', required: true, maxLength: 12, placeholder: 'kg, pcs, pack',
          hint: old ? 'What it is counted in. It stays once the item has been in stock' : 'What it is counted, bought or sold in' },
        { key: 'hsn', label: 'HSN', maxLength: 8, optional: true, hint: 'The code of the item on a GST invoice' },
        { key: 'pack', label: 'Pack', span: 2, maxLength: 60, optional: true, placeholder: 'How it comes: a bag, a loaf, a box' },
        { key: 'gstRate', label: 'GST rate', type: 'qty', decimals: 2, unit: '%', hint: 'Leave empty for Nil' },
        { key: 'shelfLifeDays', label: 'Best before', type: 'int', unit: 'days', required: true, show: isProduct, hint: 'Days from the day it is made' },
        { key: 'reorderLevel', label: 'Reorder level', type: 'qty', show: isMaterial, hint: 'In its unit. The raw store shows it as low at or below this' },
        { key: 'price.mrp', label: 'MRP', type: 'amount', required: true, show: isProduct, hint: 'GST included, as printed on the pack' },
        { key: 'price.retail', label: 'Retailer price', type: 'rate', required: true, show: isProduct, hint: 'Before GST' },
        { key: 'price.corporate', label: 'Corporate price', type: 'rate', required: true, show: isProduct, hint: 'Before GST' }
      ],
      panel: function (p, d) {
        var product = isProduct(d || draft);
        return ui.callout('info', 'A change applies to new documents only', (product
          ? 'The next invoice, dispatch sheet or day-end takes the GST rate and the prices as they stand when it is posted.'
          : 'The next purchase order and bill take the GST rate as it stands when they are posted.') +
          ' Documents already posted keep the values they were posted with. The change goes into the history of the item.');
      },
      onPreview: function (d) { return HB.engine.check('master', { entity: ENTITY, record: record(d) }); },
      onSubmit: function (d) {
        var res = HB.engine.act('master', { entity: ENTITY, record: record(d) });
        if (!res.ok) return res;                    /* the form shows the refusal at the field it names */
        st.form = null;
        ui.toast(res.before ? changeLines(res.before, res.record).join('. ') + '. New documents take it from now.' : 'New documents can use it from now.',
          { title: res.record.name + (res.before ? ' saved' : ' added'), tone: 'good', duration: 6500 });
        ctx.navigate(ROUTE, { id: res.record.id });
        return res;
      },
      onCancel: function () { st.form = null; ctx.rerender(); }
    }));
  }

  /* ------------------------------------------------------------------ page */

  HB.router.register({
    id: 'masters-items', route: ROUTE, group: 'Masters', title: 'Items', subtitle: 'Products, materials, packing and prices', filters: [],
    render: function (rootEl, ctx) {
      var draft = ctx.state.form, id = ctx.params.id;
      /* an item being added or edited survives redraws and visits elsewhere; a link to another item opens that item, and the draft waits */
      if (draft && (!id || id === draft.values.id)) return form(rootEl, ctx);
      if (id) return view(rootEl, ctx, id);
      list(rootEl, ctx);
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
