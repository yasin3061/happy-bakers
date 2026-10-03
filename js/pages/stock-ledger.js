/*
 * Stock ledger (#/stock/ledger). Every movement of stock in the range of the filter bar, oldest first: receipts,
 * consumption, production, dispatch, transfers, store sales, counts and write-offs, and the cancellations of each.
 * Filters for location, item and kind of movement; with one location and one item the rows carry a running
 * balance. A read-only page (docs/PAGES.md section 2): the rows, the totals and the balance are
 * HB.data.stock.ledger's. The opening stock of go-live opens here as a document ('#/doc/OPENSTOCK-...').
 */
(function (root) {
  'use strict';

  var HB = root.HB;
  if (!HB || !HB.router || !HB.ui || !HB.forms) return;
  var ui = HB.ui, h = ui.h, forms = HB.forms, fmt = HB.fmt;

  function day(iso) { return ui.format('date', iso); }
  function item(id) { return HB.data.lookup.item(id); }
  /** A closed store keeps its history, so its location stays in the list. */
  function locations() { return HB.data.lookup.locations({ active: 'all' }); }

  /**
   * The items a filter may name: materials and packing for the raw store, products for the other locations. With
   * no location chosen: whatever the locations in scope keep, so a store manager is offered no material.
   */
  function itemsFor(loc, locs) {
    var raw = (loc ? [loc] : locs).some(function (l) { return l.kind === 'rm'; });
    var other = (loc ? [loc] : locs).some(function (l) { return l.kind !== 'rm'; });
    return HB.data.lookup.items({ kind: raw && other ? null : (raw ? 'material' : 'fg'), active: 'all' });
  }

  /**
   * The filters as they stand in the page's state (stock-onhand sets them there before it opens this page for one
   * item). A location or an item the persona does not have is dropped.
   */
  function filtersOf(st, locs) {
    var loc = locs.filter(function (l) { return l.id === st.locId; })[0] || null;
    st.locId = loc ? loc.id : '';
    var items = itemsFor(loc, locs);
    if (!items.some(function (it) { return it.id === st.itemId; })) st.itemId = '';
    return { loc: loc, items: items };
  }

  /* --------------------------------------------------------------- filters */

  function filterCard(st, ctx, locs, items) {
    function changed() { st.list = {}; ctx.rerender(); }
    var loc = ui.form.select({
      ariaLabel: 'Location', value: st.locId,
      options: [{ value: '', label: 'All locations' }].concat(locs.map(function (l) { return { value: l.id, label: l.name }; })),
      onChange: function (v) { st.locId = v; changed(); }
    });
    var it = forms.picker({
      value: st.itemId || null, placeholder: 'All items', ariaLabel: 'Item',
      options: items.map(function (x) { return { id: x.id, label: x.name, sub: [x.code, x.unit].filter(Boolean).join(' - ') }; }),
      onChange: function (id) { st.itemId = id || ''; changed(); }
    });
    var kind = ui.form.select({
      ariaLabel: 'Movement', value: st.kind || '',
      options: [{ value: '', label: 'Every movement' }].concat(HB.data.stock.kinds().map(function (k) { return { value: k.id, label: k.name }; })),
      onChange: function (v) { st.kind = v; changed(); }
    });
    return ui.card({
      body: ui.grid(3, [
        ui.form.field({ label: 'Location', control: loc }),
        ui.form.field({ label: 'Item', control: it, hint: 'Choose one location and one item, and every movement, for a running balance' }),
        ui.form.field({ label: 'Movement', control: kind })
      ])
    });
  }

  /* ------------------------------------------------------------------ list */

  function qtyCell(v, row) { return v ? fmt.qty(v, row.unit) : ''; }

  function list(rootEl, ctx) {
    var st = ctx.state, locs = locations(), f = filtersOf(st, locs);
    st.list = st.list || {};
    var res = HB.data.stock.ledger({ from: ctx.filters.from, to: ctx.filters.to, locId: st.locId, itemId: st.itemId, kind: st.kind });
    var one = st.itemId ? item(st.itemId) : null;          /* quantities add up for one item only */
    var running = res.opening !== null;                    /* one location, one item, every movement */
    var range = HB.filters.rangeLabel(res);

    var tiles = [];
    if (running) tiles.push({ label: 'Opening', value: fmt.qty(res.opening, one.unit), sub: 'at the start of ' + day(res.from) });
    if (one) {
      tiles.push({ label: 'In', value: fmt.qty(res.qtyIn, one.unit), sub: range });
      tiles.push({ label: 'Out', value: fmt.qty(res.qtyOut, one.unit), sub: range });
    }
    if (running) tiles.push({ label: 'Closing', value: fmt.qty(res.closing, one.unit), sub: 'at the end of ' + day(res.to) });
    var counted = fmt.num(res.count) + (res.count === 1 ? ' movement' : ' movements');

    /* what the table shows follows the filters: a column the filter already fixes is left out */
    var columns = [
      { key: 'date', label: 'Date', format: 'date' },
      /* the ledger is cut by location while a document belongs to its pages: an id is a link only when the persona may open it */
      { key: 'docId', label: 'Document', render: function (v, row) { return row.canOpen ? forms.docLink(v) : String(v || ''); } },
      { key: 'kindLabel', label: 'Movement', render: ui.cells.twoLine('note', { maxWidth: 260 }) },
      { key: 'note', label: 'Note', hidden: true },
      { key: 'locName', label: 'Location', maxWidth: 170, hidden: !!f.loc },
      /* with every item listed the batch goes under the item's name, so the table keeps to seven columns at 1024px */
      { key: 'itemName', label: 'Item', hidden: !!one, render: function (v, row) {
        return h('div', null, h('div', { 'class': 'mk-truncate', style: { maxWidth: '200px' }, title: v }, v),
          row.batchId ? h('div', { 'class': 'mk-small' }, forms.docLink(row.batchId)) : null);
      } },
      { key: 'batchId', label: 'Batch', doc: true, hidden: !one || one.kind !== 'fg' },   /* materials and packing have no batch */
      { key: 'unit', label: 'Unit', hidden: true },
      { key: 'qtyIn', label: 'In', align: 'right', format: qtyCell },
      { key: 'qtyOut', label: 'Out', align: 'right', format: qtyCell },
      { key: 'balance', label: 'Balance', align: 'right', hidden: !running, format: function (v, row) { return fmt.qty(v, row.unit); } }
    ];
    var shown = columns.filter(function (c) { return !c.hidden; });
    /* the CSV carries every column, the hidden ones too, so a file reads without the screen beside it */
    var csv = columns.filter(function (c) { return c.key !== 'balance' || running; }).map(function (c) { return { key: c.key, label: c.label }; });

    ui.append(rootEl,
      filterCard(st, ctx, locs, f.items),
      tiles.length ? ui.kpiRow(tiles) : null,
      res.truncated ? ui.callout('warn', 'The list is cut short',
        'The first ' + fmt.num(res.rows.length) + ' of ' + fmt.num(res.count) + ' movements are listed, and the CSV carries the same rows. ' +
        'The totals count every movement. Choose a shorter date range, one location or one item to see the rest.') : null,
      forms.docList({
        state: st.list, rows: res.rows, columns: shown, search: false, onOpen: false, sortable: false, pageSize: 100,
        title: one ? 'Movements of ' + one.name : 'Movements',
        subtitle: counted + ', ' + range + ', oldest first. A row is never edited: a cancellation is a row of its own, on the day it was made.',
        empty: 'No movement matches these filters in this range',
        actions: ui.button({ label: 'CSV', icon: 'download', size: 'sm', onClick: function () { ui.downloadCsv('stock-ledger.csv', csv, res.rows); } })
      }));
  }

  /* ------------------------------------------------------------------ view */

  /** The opening stock of go-live, the one document this page opens. It is seeded and never cancelled. */
  function view(rootEl, ctx) {
    var v = HB.data.doc.view(ctx.docId);
    if (!v || v.type !== 'OPENSTOCK') { rootEl.appendChild(forms.missingDoc(ctx.docId, { onBack: ctx.closeDoc, backLabel: 'Back to the ledger' })); return; }
    rootEl.appendChild(forms.docView({
      title: forms.docTitle(v), status: v.status, onBack: ctx.closeDoc, backLabel: 'Back to the ledger',
      notice: { tone: 'info', title: 'The stock the books started with',
        text: 'Materials came in with an opening rate, which counts as their first purchase price. Finished goods came in as batches. An opening entry is never cancelled.' },
      meta: [['Dated', day(v.date)], ['Entered by', v.createdByName], ['Note', v.note || null]],
      lines: {
        title: 'Opening stock',
        columns: [
          { key: 'locName', label: 'Location', maxWidth: 180 },
          { key: 'itemName', label: 'Item', maxWidth: 220 },
          { key: 'batchId', label: 'Batch', doc: true },
          { key: 'bestBefore', label: 'Best before', format: 'date' },
          { key: 'qty', label: 'Quantity', format: 'qty' },
          { key: 'rate', label: 'Opening rate', format: 'rate' }
        ],
        rows: v.lines
      },
      related: forms.relatedOf(v.id), timeline: forms.timelineOf(v.id), actions: forms.docActions({ view: v })
    }));
  }

  /* ------------------------------------------------------------------ page */

  HB.router.register({
    id: 'stock-ledger', route: '#/stock/ledger', group: 'Stock', title: 'Stock ledger', filters: ['date'],
    render: function (rootEl, ctx) {
      if (ctx.docId) return view(rootEl, ctx);         /* '#/doc/OPENSTOCK-...': the hash decides */
      list(rootEl, ctx);
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
