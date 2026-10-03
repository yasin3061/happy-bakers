/*
 * Production (#/make/production). The standard plan for the day, yield by product, the register of production
 * entries, the form of a new entry and the view of one entry with what it consumed and the batch it made.
 * Built on the pattern of js/pages/buy-orders.js (docs/PAGES.md). What a run consumes, what it is expected to give,
 * its yield and its production loss are the engine's and the selectors'; the page holds the wording and the layout.
 */
(function (root) {
  'use strict';

  var HB = root.HB;
  if (!HB || !HB.router || !HB.ui || !HB.forms) return;
  var ui = HB.ui, h = ui.h, forms = HB.forms, fmt = HB.fmt;

  function day(iso) { return ui.format('date', iso); }
  function item(id) { return HB.data.lookup.item(id); }
  /** The first two of a list in words, and how many more there are. */
  function few(list) { return list.slice(0, 2).join(', ') + (list.length > 2 ? ' and ' + fmt.num(list.length - 2) + ' more' : ''); }
  /** The recipe of a product as the selector gives it now (null: none). */
  function recipe(itemId) {
    return HB.data.make.recipes().filter(function (r) { return r.itemId === itemId; })[0] || null;
  }

  /* ------------------------------------------------------------------ list */

  function start(st, ctx, values) { st.form = forms.draft(values ? { values: values } : null); ctx.rerender(); }

  function planCard(st, ctx, may) {
    var today = HB.calendar.today;
    return ui.card({
      title: 'Standard plan for ' + day(today),
      subtitle: 'What the recipes say is made on this weekday, at their standard mixes. A product leaves the list once its run is recorded.',
      flush: true,
      body: ui.table({
        dense: true, rows: HB.data.make.todo(today), empty: 'Every product of the standard plan is recorded for the day', maxHeight: 340,
        columns: [
          { key: 'itemName', label: 'Product', maxWidth: 240 },
          { key: 'standardMixes', label: 'Standard mixes', align: 'right', format: function (v) { return fmt.qty(v); } },
          { key: 'mixLabel', label: 'One mix', maxWidth: 180 },
          { key: 'expectedUnitsPerMix', label: 'Expected from one mix', format: 'qty' },
          { key: 'act', label: '', align: 'right', sortable: false, render: function (v, row) {
            return ui.button({ label: 'Record', icon: may.ok ? 'factory' : 'lock', size: 'sm', disabledReason: may.ok ? '' : may.reason,
              onClick: function () { start(st, ctx, { itemId: row.itemId, date: today }); } });
          } }
        ]
      })
    });
  }

  function yieldCard(st, y) {
    return ui.card({
      title: 'Yield by product', subtitle: HB.filters.rangeLabel(y) + '. Good units against what the recipe expects. The shortfall at recipe cost is the production loss: below zero when a run gave more than expected.', flush: true,
      body: ui.table({
        dense: true, rows: y.rows, empty: 'No production in this range', sortable: true, sort: st.yieldSort, onSort: function (s) { st.yieldSort = s; },
        columns: [
          { key: 'itemName', label: 'Product', maxWidth: 240 },
          { key: 'mixes', label: 'Mixes', align: 'right', format: function (v) { return fmt.qty(v); } },
          { key: 'expectedUnits', label: 'Expected', format: 'qty' },
          { key: 'goodUnits', label: 'Good', format: 'qty' },
          { key: 'rejectedUnits', label: 'Rejected', format: 'qty' },
          { key: 'yield', label: 'Yield', format: 'pct' },
          { key: 'lossValue', label: 'Production loss', format: 'inr2' }
        ],
        footer: { itemName: 'All products', 'yield': y.totals['yield'], lossValue: y.totals.lossValue }
      })
    });
  }

  function list(rootEl, ctx) {
    var st = ctx.state, may = HB.session.can('prod.create');
    st.list = st.list || {};
    var y = HB.data.make.yieldByItem(ctx.filters), t = y.totals, range = HB.filters.rangeLabel(y);
    ui.append(rootEl,
      planCard(st, ctx, may),
      ui.kpiRow([
        { label: 'Runs recorded', value: fmt.num(t.runs), sub: range },
        { label: 'Good units', value: fmt.num(t.goodUnits), sub: fmt.num(t.rejectedUnits) + ' rejected' },
        { label: 'Yield', value: fmt.pct(t['yield']), sub: 'good units against expected' },
        { label: 'Production loss', value: fmt.inr(t.lossValue), sub: 'the shortfall at recipe cost' }
      ]),
      yieldCard(st, y),
      forms.docList({
        state: st.list, rows: HB.data.make.entries(ctx.filters), title: 'Production register',
        statuses: ['POSTED', 'CANCELLED'], all: false,
        search: ['id', 'itemName', 'batchId', 'note'], searchPlaceholder: 'Search entries', sort: { key: 'date', dir: 'desc' },
        empty: 'No production entry in this range',
        columns: [
          { key: 'id', label: 'Entry' },
          { key: 'date', label: 'Made on', format: 'date' },
          { key: 'itemName', label: 'Product and batch', render: ui.cells.twoLine('batchId', { maxWidth: 220 }) },
          { key: 'mixes', label: 'Mixes', align: 'right', format: function (v) { return fmt.qty(v); } },
          { key: 'goodUnits', label: 'Good units', align: 'right', render: function (v, row) {
            return h('div', null, h('div', null, fmt.qty(v, row.unit)), h('div', { 'class': 'mk-xs mk-muted' }, fmt.num(row.rejectedUnits) + ' rejected'));
          } },
          { key: 'yield', label: 'Yield', format: 'pct' },
          { key: 'lossValue', label: 'Production loss', format: 'inr2' }
        ],
        newLabel: 'New production entry', newReason: may.ok ? '' : may.reason,
        onNew: function () { start(st, ctx, null); }
      }));
  }

  /* ------------------------------------------------------------------ form */

  /** The mixes start at the recipe's standard for the product, once per product and only while nothing was typed there. */
  function prefill(draft) {
    var v = draft.values, key = v.itemId || '';
    if (draft.mixesFor === key) return;
    var r = key ? recipe(key) : null;
    if (!draft.touched.mixes) v.mixes = r && r.standardMixes > 0 ? r.standardMixes : null;
    draft.mixesFor = key;
  }

  function payload(draft) {
    var v = draft.values;
    return { date: v.date, itemId: v.itemId, mixes: v.mixes, goodUnits: v.goodUnits, rejectedUnits: v.rejectedUnits || 0, note: v.note };
  }

  /** The materials and packing of the run against the raw store: preview.stock, with the values of the previewed entry. */
  function materials(p) {
    var used = {};
    if (p && p.ok && p.doc) p.doc.consumption.forEach(function (c) { used[c.itemId] = c; });
    return ((p && p.stock) || []).filter(Boolean).map(function (s) {
      var it = item(s.itemId), c = used[s.itemId] || {};
      return { itemName: it.name, unit: it.unit, wanted: s.wanted, available: s.available, 'short': s['short'], rate: c.rate, value: c.value };
    });
  }

  function materialsTable(rows) {
    return ui.table({
      dense: true, rows: rows, empty: 'Nothing is drawn yet',
      columns: [
        { key: 'itemName', label: 'Material or packing', maxWidth: 220 },
        { key: 'wanted', label: 'This run uses', format: 'qty' },
        { key: 'available', label: 'In the raw store', format: 'qty' },
        { key: 'short', label: 'Stock', render: function (v) { return ui.chip(v ? 'Short' : 'Enough', v ? 'critical' : 'good'); } },
        { key: 'rate', label: 'Latest price', format: 'rate' },
        { key: 'value', label: 'Value', format: 'inr2' }
      ]
    });
  }

  /** The one line of the toast: the batch that went into the finished store and what left the raw store, from the entry itself. */
  function movedText(doc, cancelled) {
    var it = item(doc.itemId), row = HB.data.make.entryOf(doc) || {};
    var used = doc.consumption.map(function (c) { return fmt.qty(c.qty, item(c.itemId).unit) + ' of ' + item(c.itemId).name; });
    if (cancelled) return 'Finished stock down: ' + fmt.qty(doc.goodUnits, it.unit) + ' of ' + it.name + ', batch ' + doc.batchId + '. Raw stock up again: ' + few(used) + '.';
    return 'Finished stock up: ' + fmt.qty(doc.goodUnits, it.unit) + ' of ' + it.name + ', batch ' + doc.batchId + ', best before ' + day(doc.bestBefore) +
      '. Raw stock down: ' + few(used) + '. Yield ' + fmt.pct(row['yield']) + ', production loss ' + fmt.inr2(doc.lossValue) + '.';
  }

  function form(rootEl, ctx) {
    var st = ctx.state, draft = st.form, may = HB.session.can('prod.create');
    prefill(draft);
    function unit(d) { return d.values.itemId ? item(d.values.itemId).unit : ''; }
    rootEl.appendChild(forms.docForm({
      title: 'New production entry', state: draft, backLabel: 'Back to production', submitLabel: 'Post entry',
      submitReason: may.ok ? '' : may.reason,
      fields: [
        { key: 'itemId', label: 'Product', type: 'item', kind: 'fg', required: true, span: 2, rebuild: true,
          filter: function (it) { return item(it.id).hasRecipe; },
          hint: function (d) {
            var r = d.values.itemId ? recipe(d.values.itemId) : null;
            if (!r) return 'The product this run made';
            return (r.mixLabel ? 'One mix is a ' + r.mixLabel + ' and' : 'One mix') + ' is expected to give ' + fmt.qty(r.expectedUnits, r.unit) + '.';
          },
          onChange: function (id, d) { prefill(d); } },
        { key: 'date', label: 'Made on', type: 'date', required: true },
        { key: 'mixes', label: 'Mixes', type: 'qty', decimals: 2, required: true,
          hint: function (d) {
            var r = d.values.itemId ? recipe(d.values.itemId) : null;
            return r && r.standardMixes > 0 ? 'The standard is ' + fmt.qty(r.standardMixes) + '. Half mixes are allowed.' : 'Half mixes are allowed';
          } },
        { key: 'goodUnits', label: 'Good units', type: 'int', required: true, unit: unit, hint: 'Counted and fit to sell: they become the batch' },
        { key: 'rejectedUnits', label: 'Rejected units', type: 'int', optional: true, unit: unit, hint: 'Made and not fit to sell' },
        { key: 'note', label: 'Note', optional: true, span: 2, maxLength: 200, placeholder: 'Oven, shift, why units were rejected' }
      ],
      panel: function (p, d) {
        var rows = materials(p), doc = p && p.ok ? p.doc : null, e = p && !p.ok ? p.error : null, head;
        if (!d.values.itemId) return ui.callout('neutral', 'Choose the product that was made',
          'The materials of its recipe appear here against what is in the raw store, with the yield and the production loss of the run.');
        if (e && e.code === 'stock_short') head = ui.callout('critical', 'Not enough material in the raw store', e.message);
        else if (doc) head = ui.callout('good', 'Posts as it is entered',
          'Batch ' + doc.batchId + ', best before ' + day(doc.bestBefore) + ', goes into the finished store. The materials leave the raw store at the recipe quantities, the packing for the good units.');
        else head = ui.callout('neutral', 'Materials for the mixes, packing for the good units',
          'The run draws the recipe quantities for the mixes entered and the packing for the good units. It is refused, naming the material, if the raw store is short.');
        return [head, rows.length ? ui.card({ title: 'What the run uses', flush: true, body: materialsTable(rows) }) : null];
      },
      totals: function (p, d) {
        var doc = p && p.ok ? p.doc : null, row = doc ? HB.data.make.entryOf(doc) : null, u = unit(d);
        return [
          { label: 'Expected units', sub: 'the mixes, times what one mix is expected to give', value: doc ? fmt.qty(doc.expectedUnits, u) : '-' },
          { label: 'Good units', value: doc ? fmt.qty(doc.goodUnits, u) : '-' },
          { label: 'Rejected units', value: doc ? fmt.qty(doc.rejectedUnits, u) : '-', tone: 'muted' },
          { label: 'Yield', sub: 'good units against expected', value: row ? fmt.pct(row['yield']) : '-', strong: true, rule: true },
          { label: 'Production loss', sub: doc ? 'the shortfall at the recipe cost of ' + fmt.rate(doc.unitCost) + ' a unit' : 'the shortfall at recipe cost',
            value: doc ? fmt.inr2(doc.lossValue) : '-', tone: doc && doc.lossValue > 0 ? 'bad' : 'muted' },
          { label: 'Materials and packing used', value: row ? fmt.inr2(row.materialCost) : '-', tone: 'muted' }
        ];
      },
      onPreview: function (d) { return HB.engine.preview('PROD', payload(d)); },
      onSubmit: function (d) {
        var res = HB.engine.act('post', { type: 'PROD', payload: payload(d) });
        if (!res.ok) return res;                    /* the form shows the refusal at the field it names */
        st.form = null;
        forms.postedToast(res.doc, movedText(res.doc, false));
        ctx.openDoc(res.doc.id);
        return res;
      },
      onCancel: function () { st.form = null; ctx.rerender(); }
    }));
  }

  /* ------------------------------------------------------------------ view */

  /** Where the batch of the entry is now: the rows of the batch selector, at the locations the persona sees. */
  function batchSection(d) {
    var rows = HB.data.stock.batches({ itemId: d.itemId }).filter(function (b) { return b.batchId === d.batchId; });
    return { title: 'The batch', flush: true,
      subtitle: 'Batch ' + d.batchId + ', made on ' + day(d.date) + ', best before ' + day(d.bestBefore),
      body: ui.table({
        dense: true, rows: rows, empty: 'Nothing of this batch is on hand where this role looks',
        columns: [
          { key: 'batchId', label: 'Batch', doc: true },
          { key: 'locName', label: 'Where', maxWidth: 220 },
          { key: 'qty', label: 'On hand', format: 'qty' },
          { key: 'available', label: 'Available', format: 'qty' },
          { key: 'flagLabel', label: 'Expiry', render: function (x, b) { return ui.chip(x, b.flag === 'expired' ? 'critical' : (b.flag === 'near' ? 'warn' : 'good')); } }
        ]
      }) };
  }

  function view(rootEl, ctx) {
    var v = HB.data.doc.view(ctx.docId);
    if (!v || v.type !== 'PROD') { rootEl.appendChild(forms.missingDoc(ctx.docId, { onBack: ctx.closeDoc, backLabel: 'Back to production' })); return; }
    var d = v.doc, row = HB.data.make.entryOf(d) || {}, u = item(d.itemId).unit;
    rootEl.appendChild(forms.docView({
      title: forms.docTitle(v), subtitle: v.party ? v.party.name : '', status: v.status,
      chips: [ui.chip('Yield ' + fmt.pct(row['yield']), 'neutral')],
      onBack: ctx.closeDoc, backLabel: 'Back to production', notice: forms.docNotice(v),
      meta: [['Product', v.party ? v.party.name : null], ['Made on', day(v.date)], ['Mixes', fmt.qty(d.mixes)],
        ['Batch', forms.docLink(d.batchId)], ['Best before', day(d.bestBefore)], ['Recorded by', v.createdByName], ['Note', v.note || null]],
      lines: {
        title: 'Materials and packing used', subtitle: 'At the recipe quantities, valued at the purchase prices of the day it was posted',
        columns: [
          { key: 'itemName', label: 'Material or packing' },
          { key: 'qty', label: 'Used', format: 'qty' },
          { key: 'rate', label: 'Rate', format: 'rate' },
          { key: 'value', label: 'Value', format: 'inr2' }
        ],
        rows: v.lines, footer: { itemName: 'Total', value: row.materialCost }
      },
      totals: [
        { label: 'Expected units', sub: 'the mixes, times what one mix is expected to give', value: fmt.qty(d.expectedUnits, u) },
        { label: 'Good units', value: fmt.qty(d.goodUnits, u) },
        { label: 'Rejected units', value: fmt.qty(d.rejectedUnits, u), tone: 'muted' },
        { label: 'Yield', sub: 'good units against expected', value: fmt.pct(row['yield']), strong: true, rule: true },
        { label: 'Production loss', sub: 'the shortfall at the recipe cost of ' + fmt.rate(d.unitCost) + ' a unit', value: fmt.inr2(d.lossValue), tone: d.lossValue > 0 ? 'bad' : 'muted' }
      ],
      sections: [batchSection(d)],
      related: forms.relatedOf(v.id), timeline: forms.timelineOf(v.id),
      actions: forms.docActions({
        view: v, labels: { cancel: 'Cancel the entry' },
        ask: { cancel: 'The batch leaves the finished store, and the materials and packing it used go back into the raw store. It can be cancelled only while the whole batch is still in the finished store.' },
        moved: function (op, res) { return op === 'cancel' ? movedText(res.target, true) + ' ' + res.doc.id + ' records the cancellation.' : ''; }
      })
    }));
  }

  /* ------------------------------------------------------------------ page */

  HB.router.register({
    id: 'make-production', route: '#/make/production', group: 'Make', title: 'Production', filters: ['date'],
    render: function (rootEl, ctx) {
      if (ctx.docId) return view(rootEl, ctx);
      if (ctx.state.form) return form(rootEl, ctx);
      list(rootEl, ctx);
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
