/*
 * Corporate orders (#/sell/corporate). Sales orders of corporate customers: the list, the form of a new order and
 * the view of one order with "Deliver and invoice", which opens the invoice form of js/pages/sell-invoices.js on
 * the order. Built on the pattern of js/pages/buy-orders.js (docs/PAGES.md). An order moves nothing: stock, the
 * customer's balance and the credit-limit warning belong to the invoice.
 */
(function (root) {
  'use strict';

  var HB = root.HB;
  if (!HB || !HB.router || !HB.ui || !HB.forms) return;
  var ui = HB.ui, h = ui.h, forms = HB.forms, fmt = HB.fmt;

  function day(iso) { return ui.format('date', iso); }
  function item(id) { return HB.data.lookup.item(id); }
  function customer(id) { return HB.data.lookup.customer(id); }
  /** The customer's terms in words; credit terms say for how many days. The days are the master's. */
  function termsText(c) {
    if (!c || !c.termsLabel) return '-';
    return c.terms === 'credit' && c.creditDays > 0 ? c.termsLabel + ', ' + fmt.num(c.creditDays) + (c.creditDays === 1 ? ' day' : ' days') : c.termsLabel;
  }
  /** The corporate price list of a product, or null. */
  function listPrice(itemId) { var p = itemId ? item(itemId).price : null; return p && p.corporate > 0 ? p.corporate : null; }

  /** What a customer owes now, as the receivables selector has it (null: nothing open and no credit). */
  function position(customerId) {
    var rows = HB.data.ar.balances().rows;
    for (var i = 0; i < rows.length; i++) if (rows[i].customerId === customerId) return rows[i];
    return null;
  }

  function dueChip(row) {
    if (!row.due) return null;
    return row.deliveryDate === HB.calendar.today ? ui.chip('To deliver today', 'info') : ui.chip('Delivery is due', 'warn');
  }

  /* ------------------------------------------------------------------ list */

  function list(rootEl, ctx) {
    var st = ctx.state, may = HB.session.can('so.create');
    st.list = st.list || {};
    /* an open order is listed whatever the date range says; the range limits the invoiced and cancelled ones */
    var rows = forms.uniqueRows(HB.data.sell.orders({ status: 'OPEN' }), HB.data.sell.orders(ctx.filters));
    rootEl.appendChild(forms.docList({
      state: st.list, rows: rows,
      subtitle: 'Open orders are always listed. The date range applies to invoiced and cancelled ones.',
      statuses: ['OPEN', 'INVOICED', 'CANCELLED'],
      search: ['id', 'customerName', 'poRef', 'invId', 'note'], searchPlaceholder: 'Search orders', sort: { key: 'deliveryDate', dir: 'desc' },
      empty: 'No sales order in this range',
      /* five columns, so the list fits the narrowest window: the order date rides under the delivery date, the invoice under the status */
      columns: [
        { key: 'id', label: 'Order' },
        { key: 'customerName', label: 'Customer', render: ui.cells.twoLine(function (r) { return r.poRef ? 'Their order ' + r.poRef : ''; }, { maxWidth: 220 }) },
        { key: 'deliveryDate', label: 'Deliver on', render: function (v, row) {
          return h('div', null, h('div', null, day(v)), h('div', { 'class': 'mk-xs mk-muted' }, 'ordered ' + day(row.date)));
        } },
        { key: 'value', label: 'Value', format: 'inr2', title: 'Before GST' },
        { key: 'status', label: 'Status', render: function (v, row) {
          var chip = dueChip(row) || ui.statusChip(v);
          return row.invId ? h('div', null, h('div', null, chip), h('div', { 'class': 'mk-xs' }, forms.docLink(row.invId))) : chip;
        } }
      ],
      newLabel: 'New sales order', newReason: may.ok ? '' : may.reason,
      onNew: function () { st.form = forms.draft(); ctx.rerender(); }
    }));
  }

  /* ------------------------------------------------------------------ form */

  /** draft -> the payload of docs/API.md 3.5. form.lines() leaves out the lines nothing was typed into. */
  function payload(draft, form) {
    var v = draft.values;
    return {
      date: v.date, customerId: v.customerId, deliveryDate: v.deliveryDate, poRef: v.poRef, note: v.note,
      lines: form.lines().map(function (l) { return { itemId: l.itemId, qty: l.qty || 0, price: l.price }; })
    };
  }

  /** Left of the form's foot: where the order lands, and what the customer owes against its limit today. */
  function orderPanel(p, draft) {
    var id = draft.values.customerId;
    var lands = ui.callout(p && p.ok ? 'good' : 'neutral', p && p.ok ? 'Saves as an open order' : 'An order moves nothing',
      'Stock leaves and the customer owes once the order is delivered and invoiced. The invoice warns if it takes the customer above the credit limit.');
    if (!id) return lands;
    var c = customer(id), pos = position(id);
    if (!(c.creditLimit > 0)) return [lands, ui.callout('neutral', 'Terms: ' + termsText(c), 'No credit limit is set for this customer.')];
    return [lands, ui.card({ title: 'Credit limit', subtitle: c.name, body: [
      pos ? ui.meter({ label: 'Owes now', value: pos.balance, max: c.creditLimit, valueLabel: fmt.inr2(pos.balance) + ' of ' + fmt.inr2(c.creditLimit), tone: pos.overLimit ? 'critical' : 'good' })
        : h('p', { 'class': 'mk-small' }, 'Owes nothing now. Credit limit ' + fmt.inr2(c.creditLimit) + '.'),
      pos && pos.overLimit ? h('p', { 'class': 'mk-small mk-muted mk-mt-2' }, 'Already above the limit. The order can still be saved and invoiced.') : null
    ] })];
  }

  function form(rootEl, ctx) {
    var st = ctx.state, may = HB.session.can('so.create');
    rootEl.appendChild(forms.docForm({
      title: 'New sales order', state: st.form, backLabel: 'Back to orders', submitLabel: 'Save order',
      submitReason: may.ok ? '' : may.reason,
      fields: [
        { key: 'customerId', label: 'Customer', type: 'party', kind: 'customer', required: true, span: 2,
          filter: function (p) { return p.channel === 'corporate'; }, placeholder: 'Search corporate customers' },
        { key: 'date', label: 'Order date', type: 'date', required: true },
        { key: 'deliveryDate', label: 'Deliver on', type: 'date', max: null, hint: 'May lie ahead' },
        { key: 'poRef', label: 'Their purchase order', optional: true, span: 2, maxLength: 40, placeholder: 'The reference on the customer\'s order' },
        { key: 'note', label: 'Note', optional: true, span: 2, maxLength: 200, placeholder: 'Delivery time, gate, contact' }
      ],
      lines: {
        title: 'Items', subtitle: 'The price starts at the corporate price list. Change it if another price was agreed.', addLabel: 'Add item', minRows: 1,
        columns: [
          { key: 'itemId', label: 'Item', type: 'item', kind: 'fg', required: true, width: '32%',
            filter: function (it, row, rows) { return rows.every(function (r) { return r === row || r.itemId !== it.id; }); },   /* an item goes on one line */
            onChange: function (row, id) { row.price = listPrice(id); } },
          { key: 'qty', label: 'Quantity', type: 'qty', decimals: 0, required: true, unit: function (row) { return row.itemId ? item(row.itemId).unit : ''; } },
          { key: 'list', label: 'Price list', type: 'computed', format: 'rate', title: 'The corporate price, before GST', value: function (row) { return listPrice(row.itemId); } },
          { key: 'price', label: 'Price', type: 'rate', required: true },
          /* the value of a line as it is typed: HB.money.amount, the function the engine itself calls */
          { key: 'amount', label: 'Before GST', type: 'computed', format: 'inr2', footer: 'sum',
            value: function (row) { return row.qty > 0 && row.price > 0 ? HB.money.amount(row.qty, row.price) : null; } }
        ]
      },
      panel: orderPanel,
      onPreview: function (draft, f) { return HB.engine.preview('SO', payload(draft, f)); },
      onSubmit: function (draft, f) {
        var res = HB.engine.act('post', { type: 'SO', payload: payload(draft, f) });
        if (!res.ok) return res;                    /* the form shows the refusal at the field it names */
        st.form = null;
        forms.postedToast(res.doc, 'To deliver on ' + day(res.doc.deliveryDate) + '. Nothing moves until it is delivered and invoiced.');
        ctx.openDoc(res.doc.id);
        return res;
      },
      onCancel: function () { st.form = null; ctx.rerender(); }
    }));
  }

  /* ------------------------------------------------------------------ view */

  /** What the engine says of delivering the whole order today: the stock behind each line and the customer's credit. */
  function deliveryCheck(v) {
    return v.status === 'OPEN' ? HB.engine.preview('INV', { date: HB.calendar.today, customerId: v.party.id, soId: v.id }) : null;
  }

  function stockOf(p, itemId) {
    var list = (p && p.stock) || [];
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].itemId === itemId) return list[i];
    return null;
  }

  /** "Deliver and invoice": open while the engine would take an invoice for this order from this persona. */
  function deliverAction(v, p) {
    if (!p) return null;
    /* short stock does not lock it: the invoice form shows what is available and takes a smaller quantity */
    var blocked = !p.ok && (p.error.code === 'role' || p.error.field === 'soId' || p.error.field === 'customerId');
    return { label: 'Deliver and invoice', icon: 'truck', variant: 'primary', reason: blocked ? p.error.message : '',
      onClick: function () { forms.startDraft('sell-invoices', { values: { soId: v.id } }); } };
  }

  function noticeOf(v, row, p) {
    var n = forms.docNotice(v);
    if (n) return n;
    if (v.status === 'INVOICED') return { tone: 'good', title: 'Delivered and invoiced', text: ['The delivery is on ', forms.docLink(v.doc.invId), '. To cancel the order, cancel that invoice first.'] };
    if (p && !p.ok && p.error.code === 'stock_short') return { tone: 'warn', title: 'Not enough stock to deliver it in full today', text: p.error.message + '. A smaller quantity can be delivered.' };
    /* of the warnings an invoice can carry, this notice is about the credit limit; the others belong to the invoice form */
    var over = p && p.ok ? p.warnings.filter(function (w) { return w.code === 'credit_limit'; }) : [];
    if (over.length) return { tone: 'warn', title: 'Delivering it today takes the customer above the credit limit', text: over.map(function (w) { return w.message; }).join('. ') + '. The invoice can still be posted.' };
    if (row.due) return { tone: 'info', title: row.deliveryDate === HB.calendar.today ? 'To deliver today' : 'Delivery was due on ' + day(row.deliveryDate), text: 'Deliver and invoice it once the goods leave.' };
    return null;
  }

  function view(rootEl, ctx) {
    var v = HB.data.doc.view(ctx.docId);
    if (!v || v.type !== 'SO') { rootEl.appendChild(forms.missingDoc(ctx.docId, { onBack: ctx.closeDoc, backLabel: 'Back to orders' })); return; }
    var d = v.doc, c = customer(d.customerId);
    var row = HB.data.sell.orders({ from: v.date, to: v.date }).filter(function (r) { return r.id === v.id; })[0] || {};
    var p = deliveryCheck(v);
    var actions = forms.docActions({
      view: v, labels: { cancel: 'Cancel the order' },
      ask: { cancel: 'An open order has moved no stock and no money. The cancellation is a document of its own, dated today, with the reason you give.' },
      moved: function (op, res) { return op === 'cancel' ? 'No stock or money had moved on it. ' + res.doc.id + ' records the cancellation.' : ''; }
    });
    var deliver = deliverAction(v, p);
    if (deliver) actions.unshift(deliver);

    rootEl.appendChild(forms.docView({
      title: forms.docTitle(v), subtitle: v.party.name, status: v.status, chips: [dueChip(row)].filter(Boolean),
      onBack: ctx.closeDoc, backLabel: 'Back to orders', notice: noticeOf(v, row, p),
      meta: [
        ['Customer', c.name],
        ['Order date', day(v.date)],
        ['Deliver on', day(d.deliveryDate)],
        ['Their purchase order', d.poRef || null],
        ['Terms', c.termsLabel ? termsText(c) : null],
        ['Invoice', d.invId ? forms.docLink(d.invId) : null],
        ['Entered by', v.createdByName],
        ['Note', v.note || null]
      ],
      lines: {
        title: 'Items',
        columns: [
          { key: 'itemName', label: 'Item' },
          { key: 'qty', label: 'Ordered', format: 'qty' },                  /* 'qty' reads row.unit */
          p ? { key: 'available', label: 'Available today', align: 'right', render: function (x, l) {
            var s = stockOf(p, l.itemId);
            if (!s) return '-';
            var text = fmt.qty(s.available, l.unit);
            return s.short ? h('span', { 'class': 'mk-bad', title: 'Not enough for this line' }, ui.icon('alert-triangle', 14), ' ', text) : text;
          } } : null,
          { key: 'price', label: 'Price', format: 'rate' },
          { key: 'amount', label: 'Before GST', format: 'inr2', render: function (x, l) { return fmt.inr2(HB.money.amount(l.qty, l.price)); } }
        ],
        rows: v.lines, footer: { itemName: 'Total', amount: v.amount }
      },
      totals: [
        { label: 'Order value', sub: 'before GST', value: fmt.inr2(v.amount), strong: true },
        p && p.ok ? { label: 'Invoice total if delivered in full today', sub: 'with GST', value: fmt.inr2(p.doc.total), tone: 'muted' } : null
      ],
      related: forms.relatedOf(v.id), timeline: forms.timelineOf(v.id), actions: actions
    }));
  }

  /* ------------------------------------------------------------------ page */

  HB.router.register({
    id: 'sell-corporate', route: '#/sell/corporate', group: 'Sell', title: 'Corporate orders', filters: ['date'],
    render: function (rootEl, ctx) {
      if (ctx.docId) return view(rootEl, ctx);         /* '#/doc/SO-...': the hash decides */
      if (ctx.state.form) return form(rootEl, ctx);    /* a draft is open: it survives redraws, persona switches and visits elsewhere */
      list(rootEl, ctx);
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
