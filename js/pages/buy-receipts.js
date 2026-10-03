/*
 * Goods receipts (#/buy/receipts). Orders still to receive, the list of receipts, the receipt form against an
 * approved order, and the view of one receipt. Built on the pattern of js/pages/buy-orders.js (docs/PAGES.md).
 * A receipt is what moves raw stock and sets the latest purchase price, so its toast says what both did.
 */
(function (root) {
  'use strict';

  var HB = root.HB;
  if (!HB || !HB.router || !HB.ui || !HB.forms) return;
  var ui = HB.ui, h = ui.h, forms = HB.forms, fmt = HB.fmt;

  function day(iso) { return ui.format('date', iso); }
  function item(id) { return HB.data.lookup.item(id); }
  function lateText(row) { return fmt.num(row.daysLate) + (row.daysLate === 1 ? ' day late' : ' days late'); }
  /** One of a unit, in words: 'a kg', 'a piece'. */
  function per(unit) { return unit === 'pcs' ? 'piece' : (unit || 'unit'); }
  /** The first two of a list in words, and how many more there are. */
  function few(list) { return list.slice(0, 2).join(', ') + (list.length > 2 ? ' and ' + fmt.num(list.length - 2) + ' more' : ''); }

  /* ------------------------------------------------------- what a receipt moves */

  function ids(list) { return list.map(function (x) { return x.id; }); }

  /** Read before and after the engine acts: raw stock with its latest prices, and the products with their recipe cost. */
  function snapshot() {
    var L = HB.data.lookup;
    return { rm: HB.data.stock.onHand(ids(L.locations({ kind: 'rm' }))), fg: HB.data.stock.onHand(ids(L.locations({ kind: 'fg' }))) };
  }

  /**
   * The one line of the toast. The quantities are the receipt's own; the prices and the product costs are what the
   * selectors returned before and return now (forms.changes names the rows that differ). Nothing is computed here.
   */
  function movedText(grn, before, cancelled) {
    var after = snapshot();
    var prices = forms.changes(before.rm, after.rm, 'itemId', 'rate'), costs = forms.changes(before.fg, after.fg, 'itemId', 'rate');
    var goods = grn.lines.filter(function (l) { return l.qty > 0; }).map(function (l) { return fmt.qty(l.qty, item(l.itemId).unit) + ' of ' + item(l.itemId).name; });
    var parts = [goods.length ? (cancelled ? 'Raw stock down: ' : 'Raw stock up: ') + few(goods) + '.' : 'Nothing was accepted, so no stock moved.'];
    if (prices.length) {
      parts.push('Purchase price: ' + few(prices.map(function (c) { return c.row.itemName + ' ' + fmt.rate(c.before) + ' to ' + fmt.rate(c.after); })) + '.');
    }
    if (costs.length) {
      parts.push('Product cost: ' + few(costs.map(function (c) { return c.row.itemName + ' ' + fmt.rate(c.before) + ' to ' + fmt.rate(c.after); })) + '.');
    } else if (goods.length) {
      parts.push('Product costs are unchanged.');
    }
    return parts.join(' ');
  }

  /* ------------------------------------------------------------------ list */

  function start(st, ctx, poId) { st.form = forms.draft(poId ? { values: { poId: poId } } : null); ctx.rerender(); }

  function toReceiveCard(st, ctx, may) {
    var rows = HB.data.buy.orders({ open: true }).slice().sort(function (a, b) {
      return a.expectedDate < b.expectedDate ? -1 : (a.expectedDate > b.expectedDate ? 1 : 0);
    });
    return ui.card({
      title: 'Orders to receive', subtitle: 'Approved orders with goods still to come, the earliest first', flush: true,
      body: ui.table({
        dense: true, rows: rows, empty: 'No order is waiting for goods', maxHeight: 320,
        columns: [
          { key: 'id', label: 'Order', doc: true },                            /* doc: true - the cell is a link to the document */
          { key: 'vendorName', label: 'Vendor', maxWidth: 200 },
          { key: 'expectedDate', label: 'Expected on', render: function (v, row) {
            if (row.late) return ui.row([day(v), ui.chip(lateText(row), 'warn')], { gap: 2 });
            return v === HB.calendar.today ? ui.row([day(v), ui.chip('Today', 'info')], { gap: 2 }) : day(v);
          } },
          { key: 'total', label: 'Value', format: 'inr2' },
          { key: 'receivedPct', label: 'Received', align: 'right', format: function (v) { return fmt.pct(v, 0); } },
          { key: 'act', label: '', align: 'right', sortable: false, render: function (v, row) {
            return ui.button({ label: 'Receive', icon: may.ok ? 'box' : 'lock', size: 'sm', disabledReason: may.ok ? '' : may.reason, onClick: function () { start(st, ctx, row.id); } });
          } }
        ]
      })
    });
  }

  function list(rootEl, ctx) {
    var st = ctx.state, may = HB.session.can('grn.create');
    st.list = st.list || {};
    rootEl.appendChild(toReceiveCard(st, ctx, may));
    /* a receipt that still waits for its bill is listed whatever the date range says; the range limits the others */
    var rows = forms.uniqueRows(HB.data.buy.receipts({ unbilled: true }), HB.data.buy.receipts(ctx.filters));
    rootEl.appendChild(forms.docList({
      state: st.list, rows: rows, title: 'Receipts',
      subtitle: 'Receipts not billed yet are always listed. The date range applies to billed and cancelled ones.',
      groups: [
        { id: 'unbilled', label: 'Not billed yet', test: function (r) { return r.status === 'POSTED' && !r.billed; } },
        { id: 'billed', label: 'Billed', test: function (r) { return r.status === 'POSTED' && r.billed; } },
        { id: 'CANCELLED', label: 'Cancelled', statuses: ['CANCELLED'] }
      ],
      search: ['id', 'poId', 'vendorName', 'note'], searchPlaceholder: 'Search receipts', sort: { key: 'date', dir: 'desc' },
      empty: 'No goods receipt in this range',
      columns: [
        { key: 'id', label: 'Receipt' },
        { key: 'date', label: 'Date', format: 'date' },
        { key: 'poId', label: 'Order', doc: true },
        { key: 'vendorName', label: 'Vendor', maxWidth: 180 },
        { key: 'value', label: 'Value accepted', format: 'inr2' },
        { key: 'billId', label: 'Vendor bill', render: function (v, row) {
          if (v) return forms.docLink(v);
          return row.status === 'POSTED' ? h('span', { 'class': 'mk-muted' }, 'Not billed yet') : '-';
        } },
        { key: 'status', label: 'Status', render: function (v, row) {
          return row.hasRejected ? h('div', null, ui.statusChip(v), h('div', { 'class': 'mk-xs mk-muted' }, 'Some goods rejected')) : ui.statusChip(v);
        } }
      ],
      newLabel: 'New goods receipt', newReason: may.ok ? '' : may.reason,
      onNew: function () { start(st, ctx, null); }
    }));
  }

  /* ------------------------------------------------------------------ form */

  /** The order the draft is for, as the selector gives it now (null: none chosen, or no longer open). */
  function orderOf(draft) { return draft.values.poId ? HB.data.buy.toReceive(draft.values.poId) : null; }

  /** One line per order line still to come, the accepted quantity starting at what is still to come. Once per order. */
  function fill(draft) {
    if (draft.linesFor === draft.values.poId) return;
    var order = orderOf(draft);
    draft.lines = order ? order.lines.map(function (l) { return { itemId: l.itemId, qty: l.toCome, rejectedQty: null }; }) : [];
    draft.linesFor = draft.values.poId;
  }

  function payload(draft, form) {
    var v = draft.values;
    return {
      date: v.date, poId: v.poId, note: v.note,
      lines: form.lines().map(function (l) { return { itemId: l.itemId, qty: l.qty || 0, rejectedQty: l.rejectedQty || 0 }; })
    };
  }

  function form(rootEl, ctx) {
    var st = ctx.state, draft = st.form, may = HB.session.can('grn.create');
    fill(draft);
    function orderLine(row) {
      var order = orderOf(draft), lines = order ? order.lines : [];
      for (var i = 0; i < lines.length; i++) if (lines[i].itemId === row.itemId) return lines[i];
      return {};
    }
    function unit(row) { return row.itemId ? item(row.itemId).unit : ''; }
    rootEl.appendChild(forms.docForm({
      title: 'New goods receipt', state: draft, backLabel: 'Back to receipts', submitLabel: 'Post receipt',
      submitReason: may.ok ? '' : may.reason,
      fields: [
        { key: 'poId', label: 'Purchase order', type: 'picker', required: true, span: 2, rebuild: true, placeholder: 'Search open orders',
          options: function () {
            return HB.data.buy.orders({ open: true }).map(function (r) { return { id: r.id, label: r.id + ' - ' + r.vendorName, sub: 'expected ' + day(r.expectedDate) }; });
          },
          hint: 'Goods are received only against an approved order',
          onChange: function (id, d) { fill(d); } },
        { key: 'date', label: 'Received on', type: 'date', required: true },
        { key: 'expected', label: 'Expected on', type: 'static', text: function (d) { var o = orderOf(d); return o ? day(o.expectedDate) : '-'; } },
        { key: 'note', label: 'Note', optional: true, span: 4, maxLength: 200, placeholder: 'Challan number, vehicle, why goods were rejected' }
      ],
      lines: {
        title: 'Goods', subtitle: 'Accepted goods go into the raw store at the order\'s rate. Rejected goods are a record only: the order stays open for them.',
        addRows: false, removeRows: false, empty: 'Choose an order to see what is still to come',
        columns: [
          { key: 'itemId', label: 'Item', type: 'static', width: '24%', format: function (v) { return v ? item(v).name : '-'; } },
          { key: 'ordered', label: 'Ordered', type: 'computed', format: 'qty', unit: unit, value: function (row) { return orderLine(row).qty; } },
          { key: 'toCome', label: 'Still to come', type: 'computed', format: 'qty', unit: unit, value: function (row) { return orderLine(row).toCome; } },
          { key: 'qty', label: 'Accepted', type: 'qty', unit: unit, required: true },
          { key: 'rejectedQty', label: 'Rejected', type: 'qty', unit: unit },
          { key: 'rate', label: 'Order rate', type: 'computed', format: 'rate', title: 'The rate of the order. It cannot be changed here.', value: function (row) { return orderLine(row).rate; } },
          { key: 'latest', label: 'Latest price', type: 'computed', format: 'rate', title: 'The rate of the goods receipt posted last',
            value: function (row) { return row.itemId ? HB.engine.price(row.itemId) : null; } },
          /* the value of a line as it is typed: HB.money.amount, the function the engine itself calls */
          { key: 'value', label: 'Value', type: 'computed', format: 'inr2', footer: 'sum',
            value: function (row) { var r = orderLine(row).rate; return row.qty > 0 && r > 0 ? HB.money.amount(row.qty, r) : null; } }
        ]
      },
      /* what posting will do to the purchase prices: the order's rate against the latest price, as the engine holds both */
      panel: function (p, d) {
        if (!orderOf(d)) return ui.callout('neutral', 'Choose the order the goods came against', 'Its lines appear with what is still to come. Change the accepted quantity for a part delivery.');
        var changes = d.lines.filter(function (l) { return l.qty > 0 && orderLine(l).rate !== HB.engine.price(l.itemId); });
        if (!changes.length) return ui.callout('neutral', 'Purchase prices stay as they are', 'The order\'s rates are the latest purchase prices, so product costs do not move.');
        return ui.callout('info', 'This receipt changes the latest purchase price',
          [h('ul', { 'class': 'mk-docform__list' }, changes.map(function (l) {
            return h('li', null, item(l.itemId).name + ': ' + fmt.rate(HB.engine.price(l.itemId)) + ' to ' + fmt.rate(orderLine(l).rate) + ' a ' + per(item(l.itemId).unit));
          })), 'Every product that uses these items is costed at the new price from the moment the receipt is posted.']);
      },
      onPreview: function (d, f) { return HB.engine.preview('GRN', payload(d, f)); },
      onSubmit: function (d, f) {
        var before = snapshot();                      /* read the selectors, act, read them again: that is what moved */
        var res = HB.engine.act('post', { type: 'GRN', payload: payload(d, f) });
        if (!res.ok) return res;
        st.form = null;
        forms.postedToast(res.doc, movedText(res.doc, before, false));
        ctx.openDoc(res.doc.id);
        return res;
      },
      onCancel: function () { st.form = null; ctx.rerender(); }
    }));
  }

  /* ------------------------------------------------------------------ view */

  /** "Enter the vendor bill": the next step on a receipt that is not billed. It opens the bill form of js/pages/buy-bills.js with this receipt ticked. */
  function billAction(v) {
    if (v.status !== 'POSTED' || v.doc.billId) return null;
    var may = HB.session.can('vbill.create');
    return { label: 'Enter the vendor bill', icon: 'receipt', variant: 'primary', reason: may.ok ? '' : may.reason,
      onClick: function () { forms.startDraft('buy-bills', { values: { vendorId: v.doc.vendorId, grnIds: [v.id] } }); } };
  }

  function view(rootEl, ctx) {
    var v = HB.data.doc.view(ctx.docId);
    if (!v || v.type !== 'GRN') { rootEl.appendChild(forms.missingDoc(ctx.docId, { onBack: ctx.closeDoc, backLabel: 'Back to receipts' })); return; }
    var d = v.doc, hasRejected = v.lines.some(function (l) { return l.rejectedQty > 0; });
    var actions = forms.docActions({
      view: v, labels: { cancel: 'Cancel the receipt' },
      ask: { cancel: 'The goods leave the raw store again, the order reopens for them, and the latest purchase price goes back to the receipt before this one.' },
      before: snapshot,
      moved: function (op, res, before) { return op === 'cancel' ? movedText(res.target, before, true) + ' ' + res.doc.id + ' records the cancellation.' : ''; }
    });
    var bill = billAction(v);
    if (bill) actions.unshift(bill);
    rootEl.appendChild(forms.docView({
      title: forms.docTitle(v), subtitle: v.party.name, status: v.status,
      chips: v.status === 'POSTED' ? [ui.chip(d.billId ? 'Billed' : 'Not billed yet', d.billId ? 'good' : 'neutral')] : null,
      onBack: ctx.closeDoc, backLabel: 'Back to receipts',
      notice: forms.docNotice(v) || (hasRejected ? { tone: 'info', title: 'Some goods were rejected',
        text: 'Rejected goods are a record only: they are not in stock, nothing is owed for them, and the order stays open until they are delivered.' } : null),
      meta: [['Vendor', v.party.name], ['Received on', day(v.date)], ['Purchase order', forms.docLink(d.poId)],
        ['Vendor bill', d.billId ? forms.docLink(d.billId) : 'Not billed yet'], ['Entered by', v.createdByName], ['Note', v.note || null]],
      lines: {
        title: 'Goods',
        columns: [
          { key: 'itemName', label: 'Item' },
          { key: 'qty', label: 'Accepted', format: 'qty' },
          { key: 'rejectedQty', label: 'Rejected', format: 'qty' },
          { key: 'rate', label: 'Rate', format: 'rate' },
          { key: 'value', label: 'Value', format: 'inr2', render: function (x, l) { return fmt.inr2(HB.money.amount(l.qty, l.rate)); } }
        ],
        rows: v.lines, footer: { itemName: 'Total', value: v.amount }
      },
      totals: [{ label: 'Value accepted', sub: 'at the order\'s rates, before GST', value: fmt.inr2(v.amount), strong: true }],
      related: forms.relatedOf(v.id), timeline: forms.timelineOf(v.id), actions: actions
    }));
  }

  /* ------------------------------------------------------------------ page */

  HB.router.register({
    id: 'buy-receipts', route: '#/buy/receipts', group: 'Buy', title: 'Goods receipts', filters: ['date'],
    render: function (rootEl, ctx) {
      if (ctx.docId) return view(rootEl, ctx);
      if (ctx.state.form) return form(rootEl, ctx);
      list(rootEl, ctx);
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
