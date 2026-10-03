/*
 * Stock on hand (#/stock/onhand). What each location holds now: quantity, what can leave it, today's unit cost
 * and the value; the value of all stock in scope; and the low-stock list of the raw store against reorder levels.
 * A read-only page (docs/PAGES.md section 2): every figure is HB.data.stock's, already cut to the persona's
 * locations. The low-stock list is an alert only: it proposes no quantity and starts no order.
 */
(function (root) {
  'use strict';

  var HB = root.HB;
  if (!HB || !HB.router || !HB.ui || !HB.forms) return;
  var ui = HB.ui, h = ui.h, forms = HB.forms, fmt = HB.fmt;

  var ALL = 'all';

  function muted(text) { return h('span', { 'class': 'mk-muted' }, text); }
  function locations() { return HB.data.lookup.locations(); }
  /** May this persona read the movement ledger? Then a row opens the movements of its item. */
  function hasLedger() { return HB.router.isAllowed('stock-ledger'); }
  /** Open the ledger on one item at one location: its filters live in its own state (docs/shell/UI-API.md 1.3, stateOf). */
  function openLedger(row) {
    var s = HB.router.stateOf('stock-ledger');
    s.locId = row.locId; s.itemId = row.itemId; s.kind = ''; s.list = {};
    HB.router.navigate('stock-ledger');
  }

  /**
   * The location whose stock is listed: the one a link names ('?loc=<id>', taken once per link, so the choice stays
   * free), else the one chosen last, or the first in scope. 'all' lists every one.
   */
  function chosen(st, ctx, locs) {
    var asked = ctx.params.loc || null;
    if (asked !== st.asked) { st.asked = asked; if (asked) { st.locId = asked; st.sort = null; } }
    if (st.locId === ALL && locs.length > 1) return ALL;
    var loc = locs.filter(function (l) { return l.id === st.locId; })[0] || locs[0] || null;
    st.locId = loc ? loc.id : ALL;
    return st.locId;
  }

  /* ----------------------------------------------------------------- tiles */

  function tiles(st, ctx, value, low, hasRaw) {
    var list = [{ label: 'Stock value', icon: 'layers', value: fmt.inr(value.total), sub: 'every location you see, at today\'s cost' }];
    if (hasRaw) {
      list.push({ label: 'Raw materials', value: fmt.inr(value.materials), sub: 'at the latest purchase price' });
      list.push({ label: 'Packing', value: fmt.inr(value.packing), sub: 'at the latest purchase price' });
    }
    list.push({ label: 'Finished goods', value: fmt.inr(value.finished), sub: 'at recipe cost' });
    if (hasRaw) {
      list.push({
        label: 'Low stock', icon: 'alert-triangle', value: fmt.num(low.length), tone: low.length ? 'warn' : null,
        sub: low.length === 1 ? 'item at or below its reorder level' : 'items at or below their reorder level',
        onClick: function () { var el = root.document.getElementById('stock-low'); if (el) el.scrollIntoView({ block: 'start' }); }
      });
    }
    return ui.kpiRow(list);
  }

  /* ------------------------------------------------------ stock by location */

  /** What needs a second look on a row: low stock, units held by a write-off that waits, units past or near best-before. */
  function flags(row) {
    var out = [];
    if (row.locKind === 'transit') out.push(ui.chip('On the way', 'info', { title: 'Sent to the store and not yet confirmed by it' }));
    if (row.low) out.push(ui.statusChip('LOW_STOCK'));
    if (row.reserved > 0) out.push(ui.chip(fmt.qty(row.reserved, row.unit) + ' held', 'warn', { title: 'On a write-off request that waits for the Owner' }));
    if (row.expired > 0) out.push(ui.chip(fmt.qty(row.expired, row.unit) + ' expired', 'critical', { title: 'Past best-before: never dispatched, transferred or sold' }));
    if (row.nearExpiry > 0) out.push(ui.chip(fmt.qty(row.nearExpiry, row.unit) + ' near expiry', 'warn'));
    return out.length ? ui.row(out, { gap: 1, wrap: true }) : '';
  }

  function matches(row, q) {
    var text = (row.itemName + ' ' + row.code + ' ' + row.locName).toLowerCase();
    return q.every(function (w) { return text.indexOf(w) !== -1; });
  }

  function stockCard(st, ctx, value, locs) {
    var locId = chosen(st, ctx, locs), all = locId === ALL;
    var rows = HB.data.stock.onHand(all ? '' : locId);
    var loc = all ? null : locs.filter(function (l) { return l.id === locId; })[0];
    var worth = all ? value.total : ((value.rows.filter(function (r) { return r.locId === locId; })[0] || {}).value || 0);
    var words = String(st.q || '').toLowerCase().split(/\s+/).filter(Boolean);
    var shown = words.length ? rows.filter(function (r) { return matches(r, words); }) : rows;
    var drill = hasLedger();

    var columns = [
      { key: 'itemName', label: 'Item', render: ui.cells.twoLine('code', { maxWidth: 240 }) },
      all ? { key: 'locName', label: 'Location', maxWidth: 180 } : null,
      { key: 'qty', label: 'On hand', format: 'qty' },
      { key: 'available', label: 'Available', format: 'qty', title: 'What a document dated today may take: in date, and not held by a write-off request that waits' },
      { key: 'rate', label: 'Rate', format: 'rate', title: 'Today\'s unit cost: the latest purchase price of a material, the recipe cost of a product' },
      { key: 'value', label: 'Value', format: 'inr2' },
      { key: 'flags', label: 'Note', sortable: false, wrap: true, render: function (v, row) { return flags(row); } }
    ].filter(Boolean);

    var tools = ui.row([
      locs.length > 1 ? ui.select({
        size: 'sm', ariaLabel: 'Location', value: locId,
        options: locs.map(function (l) { return { value: l.id, label: l.name }; }).concat([{ value: ALL, label: 'All locations' }]),
        onChange: function (v) {
          st.locId = v; st.sort = null;
          /* a choice on the screen drops the link's location, so that following the link again opens it again */
          if (ctx.params.loc) HB.router.navigate('stock-onhand', null, { replace: true }); else ctx.rerender();
        }
      }) : null,
      ui.form.search({ value: st.q || '', placeholder: 'Search items', width: 200, ariaLabel: 'Search items', onInput: function (v) { st.q = v; ctx.rerender(); } })
    ], { gap: 2 });

    return ui.card({
      title: all ? 'Stock at every location' : 'Stock at ' + (loc ? loc.name : ''), flush: true, actions: tools,
      subtitle: 'Worth ' + fmt.inr2(worth) + ' at today\'s cost.' + (drill ? ' A row opens the movements of its item.' : ''),
      body: ui.table({
        columns: columns, rows: shown, dense: true, maxHeight: 560,
        empty: words.length ? 'Nothing matches "' + st.q + '"' : (loc && loc.kind === 'transit' ? 'Nothing is on the way to this store' : 'Nothing is kept here'),
        sortable: true, sort: st.sort, onSort: function (s) { st.sort = s; },
        rowClass: function (row) { return row.low ? 'is-strong' : ''; },
        onRowClick: drill ? openLedger : null,
        /* the total is the selector's, so it stands only while every row of the location is listed */
        footer: words.length ? null : { itemName: 'Total', value: worth }
      })
    });
  }

  /* -------------------------------------------------------------- low stock */

  function lowCard(low) {
    return ui.card({
      id: 'stock-low', title: 'Low stock', flush: true,
      subtitle: 'Materials and packing in the raw store at or below their reorder level. An alert only: the order is raised by hand, under Purchase orders.',
      body: ui.table({
        dense: true, rows: low, empty: 'Every material and packing item is above its reorder level',
        columns: [
          { key: 'itemName', label: 'Item', render: ui.cells.twoLine('code', { maxWidth: 240 }) },
          { key: 'available', label: 'Available', format: 'qty' },
          { key: 'reorderLevel', label: 'Reorder level', format: 'qty' },
          { key: 'onOrder', label: 'On order', title: 'What approved purchase orders still expect', align: 'right',
            render: function (v, row) { return v > 0 ? fmt.qty(v, row.unit) : muted('Nothing on order'); } },
          { key: 'orderIds', label: 'Open orders', sortable: false, wrap: true, render: function (ids) {
            return ids && ids.length ? h('span', null, ids.map(function (id, i) { return [i ? ', ' : '', forms.docLink(id)]; })) : '';
          } }
        ]
      })
    });
  }

  /* ------------------------------------------------------------------ page */

  HB.router.register({
    id: 'stock-onhand', route: '#/stock/onhand', group: 'Stock', title: 'Stock on hand', filters: [],
    render: function (rootEl, ctx) {
      var st = ctx.state, locs = locations();
      if (!locs.length) { rootEl.appendChild(ui.emptyState('No stock location', 'This role sees no stock location.', { icon: 'layers' })); return; }
      var value = HB.data.stock.value(), low = HB.data.stock.lowStock();
      var hasRaw = HB.data.lookup.locations({ kind: 'rm' }).length > 0;   /* the low-stock list is the raw store's */
      ui.append(rootEl,
        tiles(st, ctx, value, low, hasRaw),
        stockCard(st, ctx, value, locs),
        hasRaw ? lowCard(low) : null,
        hasRaw ? forms.teaser({ title: 'Purchase requirement raised automatically', tier: 'iNeo',
          text: 'An item that falls to its reorder level raises its own purchase requirement for approval.' }) : null);
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
