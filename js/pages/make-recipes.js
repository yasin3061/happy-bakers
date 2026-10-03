/*
 * Recipes (#/make/recipes). The products, the recipe of one product (materials for one mix, packing for one unit,
 * expected units, the days it is made and the standard mixes), its cost sheet at the latest purchase prices with
 * the margin by channel, and the change history. A role that may edit masters changes a recipe here; the
 * production supervisor reads it. A recipe is a master, not a document: it is saved with HB.engine.act('master').
 * Costs, prices and margins are the selectors' (HB.data.make); the page holds the wording and the layout.
 */
(function (root) {
  'use strict';

  var HB = root.HB;
  if (!HB || !HB.router || !HB.ui || !HB.forms) return;
  var ui = HB.ui, h = ui.h, forms = HB.forms, fmt = HB.fmt;

  var ROUTE = '#/make/recipes';

  function item(id) { return HB.data.lookup.item(id); }
  function qtyOf(v, unit) { return fmt.qty(v, unit); }
  /** One of a unit, in words: 'a kg', 'a pack', 'a piece'. */
  function per(unit) { return unit === 'pcs' ? 'piece' : (unit || 'unit'); }
  /** May this persona change a recipe? The right is the session's; its reason is worded for this screen, where the record is a recipe. */
  function mayEdit() {
    var may = HB.session.can('master.edit');
    return { ok: may.ok, code: may.code, reason: may.ok ? '' : String(may.reason || '').replace('change items, recipes, customers, vendors or other records', 'change a recipe') };
  }
  function recipeOf(itemId) { return HB.data.make.recipes().filter(function (r) { return r.itemId === itemId; })[0] || null; }
  /** The days a recipe is made, in words: 'daily', or a list of weekdays (0 is Monday). */
  function rhythmText(rh) {
    if (rh === 'daily' || rh === undefined || rh === null) return 'Every day';
    return Array.isArray(rh) && rh.length ? rh.map(function (d) { return HB.dates.DOWS[d]; }).join(', ') : 'On no day';
  }

  /* ------------------------------------------------------------ the products */

  function productsCard(ctx, products, selected) {
    return ui.card({
      title: 'Products', subtitle: 'Costed at the latest purchase prices', flush: true,
      body: ui.table({
        dense: true, rows: products, empty: 'No product among the items',
        rowClass: function (row) { return row.id === selected ? 'is-selected' : ''; },
        onRowClick: function (row) { ctx.state.itemId = row.id; ctx.navigate(ROUTE, { item: row.id }); },
        /* one column, so that the list fits beside the recipe at 1024px: the cost and the days stand under the name */
        columns: [
          { key: 'name', label: 'Product and cost of a unit', wrap: true, sortValue: function (row) { return row.name; }, render: function (v, row) {
            return h('div', null, h('div', { 'class': 'mk-strong' }, v),
              h('div', { 'class': 'mk-xs mk-muted' },
                row.recipe ? fmt.rate(row.unitCost) + ' a ' + per(row.recipe.unit) + ', made ' + (row.recipe.rhythm === 'daily' ? 'every day' : (row.recipe.rhythmLabel ? 'on ' + row.recipe.rhythmLabel : 'on no fixed day')) : 'No recipe yet',
                row.active ? null : ', inactive'));
          } }
        ]
      })
    });
  }

  /* --------------------------------------------------------- one recipe, read */

  function recipeCard(st, ctx, it, r, may) {
    return ui.card({
      title: it.name, subtitle: it.pack || null,
      actions: ui.button({ label: 'Edit the recipe', icon: may.ok ? 'edit' : 'lock', size: 'sm', disabledReason: may.ok ? '' : may.reason,
        onClick: function () { startEdit(st, ctx, it.id); } }),
      body: ui.keyValue([
        ['One mix', r.mixLabel || null],
        ['Expected from one mix', qtyOf(r.expectedUnits, r.unit)],
        ['Made', r.rhythmLabel || 'On no fixed day'],
        ['Standard mixes a day', fmt.qty(r.standardMixes)],
        ['Cost of one mix', fmt.inr2(r.mixCost)],
        ['Cost of a unit', fmt.rate(r.unitCost)]
      ], { stacked: true })
    });
  }

  /** A quantity of the recipe with the price it is costed at under it. */
  function atPrice(v, row) {
    return h('div', null, h('div', null, qtyOf(v, row.unit)), h('div', { 'class': 'mk-xs mk-muted' }, 'at ' + fmt.rate(row.rate) + ' a ' + per(row.unit)));
  }

  function costCard(s) {
    return ui.card({
      title: 'Cost sheet', subtitle: 'Recipe quantities at the latest purchase prices, before GST, over the ' + qtyOf(s.expectedUnits, s.unit) + ' expected from one mix. A goods receipt at a new rate moves it at once.', flush: true,
      body: [
        ui.table({
          dense: true, rows: s.materials, empty: 'No material on the recipe',
          columns: [
            { key: 'name', label: 'Material', maxWidth: 160 },
            { key: 'qty', label: 'For one mix', align: 'right', title: 'The quantity of the recipe, at the latest purchase price', render: atPrice },
            { key: 'value', label: 'Mix cost', format: 'inr2' },
            { key: 'perUnit', label: 'Cost a unit', format: 'rate' }
          ],
          footer: { name: 'Materials', value: s.mixCost, perUnit: s.materialPerUnit }
        }),
        ui.table({
          dense: true, rows: s.packing, empty: 'No packing on the recipe',
          columns: [
            { key: 'name', label: 'Packing', maxWidth: 160 },
            { key: 'qtyPerUnit', label: 'For one unit', align: 'right', title: 'The quantity of the recipe, at the latest purchase price', render: atPrice },
            { key: 'perUnit', label: 'Cost a unit', format: 'rate' }
          ],
          footer: { name: 'Packing', perUnit: s.packingPerUnit }
        }),
        h('div', { 'class': 'mk-docview__totals' }, forms.totals([
          { label: 'Materials a unit', value: fmt.rate(s.materialPerUnit) },
          { label: 'Packing a unit', value: fmt.rate(s.packingPerUnit) },
          { label: 'Cost of a unit', sub: 'what an invoice or a day-end takes as cost', value: fmt.rate(s.unitCost), strong: true, rule: true }
        ]))
      ]
    });
  }

  function marginCard(s) {
    return ui.card({
      title: 'Margin by channel', flush: true,
      subtitle: 'The price before GST less the cost of a unit. The MRP is ' + fmt.rate(s.mrp) + (s.gstRate > 0 ? ', with ' + fmt.qty(s.gstRate) + '% GST inside it.' : ', with no GST.'),
      body: ui.table({
        dense: true, rows: s.channels.map(function (c) { return { label: c.label, price: c.price, unitCost: s.unitCost, margin: c.margin, marginPct: c.marginPct }; }),
        columns: [
          { key: 'label', label: 'Channel' },
          { key: 'price', label: 'Price before GST', format: 'rate' },
          { key: 'unitCost', label: 'Cost a unit', format: 'rate' },
          { key: 'margin', label: 'Margin a unit', format: 'rate' },
          { key: 'marginPct', label: 'Margin', format: 'pct' }
        ]
      })
    });
  }

  /* ------------------------------------------------------------ change history */

  /** What one saved change did, line by line, from the record before and after as the audit log holds them. */
  function changeLines(before, after) {
    var out = [];
    if (!before) return ['The recipe was added'];
    function note(label, a, b, text) { if (JSON.stringify(a) !== JSON.stringify(b)) out.push(label + ': ' + text(a) + ' to ' + text(b)); }
    function plain(v) { return v === undefined || v === null || v === '' ? 'none' : String(v); }
    function num(v) { return fmt.qty(v); }
    function lists(a, b, key, per) {
      var was = {}, now = {};
      (a || []).forEach(function (x) { was[x.itemId] = x[key]; });
      (b || []).forEach(function (x) { now[x.itemId] = x[key]; });
      (b || []).forEach(function (x) {
        var it = item(x.itemId);
        if (was[x.itemId] === undefined) out.push('Added ' + it.name + ', ' + qtyOf(x[key], it.unit) + per);
        else if (was[x.itemId] !== x[key]) out.push(it.name + ': ' + qtyOf(was[x.itemId], it.unit) + ' to ' + qtyOf(x[key], it.unit) + per);
      });
      (a || []).forEach(function (x) { if (now[x.itemId] === undefined) out.push('Removed ' + item(x.itemId).name); });
    }
    note('One mix', before.mixLabel, after.mixLabel, plain);
    note('Expected units from one mix', before.expectedUnits, after.expectedUnits, num);
    note('Made', before.rhythm, after.rhythm, rhythmText);
    note('Standard mixes', before.standardMixes, after.standardMixes, num);
    lists(before.materials, after.materials, 'qty', ' a mix');
    lists(before.packing, after.packing, 'qtyPerUnit', ' a unit');
    return out.length ? out : ['Saved with nothing changed'];
  }

  function historyCard(itemId) {
    var rows = HB.data.audit.list({ masters: true, type: 'recipes', docId: itemId, limit: 0 }).rows;
    return ui.card({
      title: 'Change history', subtitle: 'A change applies from the moment it is saved. Documents already posted keep what they were posted with.',
      body: ui.timeline(rows.map(function (r) {
        return { actor: r.userName, role: r.roleLabel, action: r.before ? 'Recipe changed' : 'Recipe added', at: r.at,
          note: h('ul', { 'class': 'mk-docform__list' }, changeLines(r.before, r.after).map(function (line) { return h('li', null, line); })) };
      }), { empty: 'No change since go-live' })
    });
  }

  /* ------------------------------------------------------------------ list */

  function startEdit(st, ctx, itemId) {
    var r = recipeOf(itemId);
    st.form = forms.draft({
      values: {
        itemId: itemId, mixLabel: r ? r.mixLabel : null, expectedUnits: r ? r.expectedUnits : null,
        standardMixes: r ? r.standardMixes : null, rhythm: r && Array.isArray(r.rhythm) ? 'days' : 'daily', days: r && Array.isArray(r.rhythm) ? r.rhythm.slice() : []
      },
      lines: r ? r.materials.map(function (m) { return { itemId: m.itemId, qty: m.qty }; }) : [],
      packing: r ? r.packing.map(function (p) { return { itemId: p.itemId, qtyPerUnit: p.qtyPerUnit }; }) : []
    });
    ctx.rerender();
  }

  function list(rootEl, ctx) {
    var st = ctx.state, may = mayEdit();
    var recipes = HB.data.make.recipes(), by = {};
    recipes.forEach(function (r) { by[r.itemId] = r; });
    var products = HB.data.lookup.items({ kind: 'fg', active: 'all' }).map(function (it) {
      return { id: it.id, name: it.name, active: it.active, recipe: by[it.id] || null, unitCost: by[it.id] ? by[it.id].unitCost : null };
    });
    var wanted = ctx.params.item || st.itemId;
    var sel = products.filter(function (p) { return p.id === wanted; })[0] || products[0] || null;
    if (!sel) { rootEl.appendChild(ui.emptyState('No product yet', 'A recipe belongs to a product on the Items screen.', { icon: 'book' })); return; }
    st.itemId = sel.id;

    var it = item(sel.id), r = sel.recipe, s = r ? HB.data.make.costSheet(sel.id) : null, detail;
    if (!r) {
      detail = [ui.card({ title: it.name, subtitle: it.pack || null,
        body: ui.emptyState('No recipe yet', 'Without a recipe its production cannot be recorded and it has no cost.', { icon: 'book',
          action: ui.button({ label: 'Add the recipe', icon: may.ok ? 'plus' : 'lock', variant: 'primary', disabledReason: may.ok ? '' : may.reason,
            onClick: function () { startEdit(st, ctx, it.id); } }) }) })];
    } else {
      detail = [recipeCard(st, ctx, it, r, may), s ? costCard(s) : null, s ? marginCard(s) : null];
    }
    /* the audit log is for the roles that have its screen; the selector answers nobody else */
    if (HB.session.canOpen('sys-audit')) detail.push(historyCard(sel.id));

    rootEl.appendChild(ui.grid([4, 8], [productsCard(ctx, products, sel.id), ui.stack(detail)], { start: true }));
  }

  /* ------------------------------------------------------------------ form */

  function form(rootEl, ctx) {
    var st = ctx.state, draft = st.form, may = mayEdit();
    var it = item(draft.values.itemId), old = recipeOf(it.id);
    if (!Array.isArray(draft.packing)) draft.packing = [];
    draft.packTouched = draft.packTouched || {};
    var packGrid = null, formEl = null, packIndex = [];

    function unit(row) { return row.itemId ? item(row.itemId).unit : ''; }
    function once(it2, row, rows) { return rows.every(function (x) { return x === row || x.itemId !== it2.id; }); }   /* an item goes on one line */
    function price(row) { return row.itemId ? HB.engine.price(row.itemId) : null; }

    /** draft -> the record of docs/API.md 2.10 (entity recipes). Lines nothing was typed into are left out. */
    function record(d, f) {
      var v = d.values;
      packIndex = packGrid ? packGrid.filled() : d.packing.map(function (x, i) { return i; });
      return {
        itemId: v.itemId, mixLabel: v.mixLabel || '', expectedUnits: v.expectedUnits || 0, standardMixes: v.standardMixes || 0,
        rhythm: v.rhythm === 'days' ? (v.days || []).slice() : 'daily',
        materials: f.lines().map(function (l) { return { itemId: l.itemId, qty: l.qty || 0 }; }),
        packing: packIndex.map(function (i) { return { itemId: d.packing[i].itemId, qtyPerUnit: d.packing[i].qtyPerUnit || 0 }; })
      };
    }

    /**
     * The engine names a line of a recipe 'materials[i]' or 'packing[i]'. The materials are the grid of the form
     * ('lines[i]'); the packing is the page's own grid below it, which shows its refusals itself.
     */
    function place(res, force) {
      var e = res && res.error, m = e && e.field ? /^(materials|packing)\[(\d+)\](?:\.(\w+))?$/.exec(e.field) : null;
      if (packGrid) packGrid.setErrors([]);
      if (!m) return res;
      var copy = {}, k;
      for (k in res) if (Object.prototype.hasOwnProperty.call(res, k)) copy[k] = res[k];
      if (m[1] === 'materials') {
        copy.error = { code: e.code, message: e.message, field: 'lines[' + m[2] + ']' + (m[3] ? '.' + m[3] : ''), docId: null };
        return copy;
      }
      var index = packIndex[+m[2]];
      if (packGrid && index !== undefined && (force || draft.submitted || draft.packTouched[index])) {
        packGrid.setErrors([{ index: index, key: m[3] || null, message: e.message }]);
        if (force) packGrid.focusCell(index, m[3] || null);
      }
      copy.error = null;
      return copy;
    }

    function packingCard(d, f) {
      formEl = f;
      packGrid = forms.lineGrid({
        key: 'p', rows: d.packing, addLabel: 'Add packing', empty: 'No packing: the product is sold loose',
        columns: [
          { key: 'itemId', label: 'Packing item', type: 'item', kind: 'pk', required: true, width: '40%', filter: once },
          { key: 'qtyPerUnit', label: 'Quantity for one unit', type: 'qty', required: true, unit: unit },
          { key: 'rate', label: 'Latest price', type: 'computed', format: 'rate', value: price },
          { key: 'perUnit', label: 'Cost a unit', type: 'computed', format: 'rate', footer: 'sum',
            value: function (row) { return row.itemId && row.qtyPerUnit > 0 ? HB.money.amount(row.qtyPerUnit, price(row)) : null; } }
        ],
        onChange: function (rows, info) {
          d.dirty = true;
          if (info && info.kind === 'remove') d.packTouched = {};
          else if (info) d.packTouched[info.index] = true;
          if (formEl && typeof formEl.refresh === 'function') formEl.refresh();
        }
      });
      return h('section', { 'class': 'mk-card mk-docform__card mk-docform__lines' },
        h('div', { 'class': 'mk-docform__cardhead' }, h('h3', { 'class': 'mk-card__title' }, 'Packing for one unit'),
          h('span', { 'class': 'mk-card__subtitle' }, 'Drawn from the raw store for every good unit of a production entry')),
        packGrid);
    }

    function daysControl(d, f) {
      return h('div', { 'class': 'mk-row mk-row--wrap mk-gap-3' }, HB.dates.DOWS.map(function (name, i) {
        var box = ui.form.checkbox({ label: name, checked: (d.values.days || []).indexOf(i) !== -1, onChange: function (on) {
          var days = (d.values.days || []).filter(function (x) { return x !== i; });
          if (on) days.push(i);
          d.values.days = days.sort(function (a, b) { return a - b; });
          d.touched.days = true;
          d.dirty = true;
          f.refresh();
        } });
        box.input.setAttribute('data-fkey', 'f:days:' + i);
        return box;
      }));
    }

    rootEl.appendChild(forms.docForm({
      title: (old ? 'Edit the recipe of ' : 'Add the recipe of ') + it.name, state: draft, backLabel: 'Back to recipes', submitLabel: 'Save recipe',
      chips: ui.statusChip('DRAFT', { label: 'Not saved yet' }),
      submitReason: may.ok ? '' : may.reason,
      fieldMap: { rhythm: 'days' },               /* 'no weekday ticked' is shown at the weekdays, where it is put right */
      fields: [
        { key: 'itemId', label: 'Product', type: 'static', span: 2, text: function () { return it.display; } },
        { key: 'mixLabel', label: 'One mix is', optional: true, span: 2, maxLength: 40, placeholder: 'What the bakers call the mix, such as 50 kg flour mix' },
        { key: 'expectedUnits', label: 'Expected units from one mix', type: 'int', required: true, unit: it.unit,
          hint: 'Yield is measured against this' },
        { key: 'standardMixes', label: 'Standard mixes', type: 'qty', decimals: 2, hint: 'How many mixes are made on a day it is made' },
        { key: 'rhythm', label: 'Made', type: 'select', rebuild: true, options: [{ value: 'daily', label: 'Every day' }, { value: 'days', label: 'On chosen weekdays' }] },
        { key: 'days', label: 'Weekdays', type: 'custom', control: daysControl, show: function (d) { return d.values.rhythm === 'days'; },
          hint: 'Tick the days it is in the standard plan' }
      ],
      lines: {
        title: 'Materials for one mix', subtitle: 'Drawn from the raw store for every mix of a production entry', addLabel: 'Add material', minRows: 1,
        columns: [
          { key: 'itemId', label: 'Material', type: 'item', kind: 'rm', required: true, width: '40%', filter: once },
          { key: 'qty', label: 'Quantity for one mix', type: 'qty', required: true, unit: unit },
          { key: 'rate', label: 'Latest price', type: 'computed', format: 'rate', value: price },
          /* the value of a line as it is typed: HB.money.amount, the function the engine itself calls */
          { key: 'value', label: 'Cost of the mix', type: 'computed', format: 'inr2', footer: 'sum',
            value: function (row) { return row.itemId && row.qty > 0 ? HB.money.amount(row.qty, price(row)) : null; } }
        ]
      },
      body: packingCard,
      panel: function () {
        return ui.callout('info', 'A change applies from the moment it is saved',
          'The cost sheet, the margins and the standard plan follow the new recipe at once, and the next production entry draws the new quantities. Production entries, invoices and day-ends already posted keep what they were posted with. The change is written to the audit log.');
      },
      onPreview: function (d, f) { return place(HB.engine.check('master', { entity: 'recipes', record: record(d, f) }), false); },
      onSubmit: function (d, f) {
        var was = recipeOf(it.id), before = was ? was.unitCost : null;   /* read the selector, act, read it again */
        var res = HB.engine.act('master', { entity: 'recipes', record: record(d, f) });
        if (!res.ok) return place(res, true);       /* the form shows the refusal at the field or the line it names */
        var now = recipeOf(it.id), after = now ? now.unitCost : null;
        st.form = null;
        ui.toast(before === null ? 'Cost of a unit: ' + fmt.rate(after) + '.'
          : (before === after ? 'Cost of a unit: ' + fmt.rate(after) + ', as before.' : 'Cost of a unit: ' + fmt.rate(before) + ' to ' + fmt.rate(after) + '.'),
          { title: 'Recipe of ' + it.name + ' saved', tone: 'good', duration: 6500 });
        return res;
      },
      onCancel: function () { st.form = null; ctx.rerender(); }
    }));
  }

  /* ------------------------------------------------------------------ page */

  HB.router.register({
    id: 'make-recipes', route: ROUTE, group: 'Make', title: 'Recipes', subtitle: 'What a mix takes, what it gives and what a unit costs', filters: [],
    render: function (rootEl, ctx) {
      if (ctx.state.form) return form(rootEl, ctx);   /* a recipe being edited: it survives redraws, persona switches and visits elsewhere */
      list(rootEl, ctx);
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
