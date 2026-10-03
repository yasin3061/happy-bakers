/*
 * Purchase orders (#/buy/orders). The list, the form of a new order and the view of one order.
 * This file is the model of a document page: docs/PAGES.md walks through it.
 * Every figure comes from HB.data or HB.engine; the page holds the wording and the layout, and no rule.
 */
(function (root) {
  'use strict';

  var HB = root.HB;
  if (!HB || !HB.router || !HB.ui || !HB.forms) return;
  var ui = HB.ui, forms = HB.forms, fmt = HB.fmt;

  var OPEN = ['PENDING', 'APPROVED', 'PART_RECEIVED'];   /* still to approve or to receive */

  function day(iso) { return ui.format('date', iso); }
  function item(id) { return HB.data.lookup.item(id); }
  /** The limit up to which an order is approved as it is submitted, in words. The figure is the master's. */
  function limit() { return fmt.inrFull(HB.masters.limits.poAutoApprove); }
  function lateText(row) { return fmt.num(row.daysLate) + (row.daysLate === 1 ? ' day late' : ' days late'); }

  /* ------------------------------------------------------------------ list */

  function list(rootEl, ctx) {
    var st = ctx.state, may = HB.session.can('po.create');
    st.list = st.list || {};
    /* an open order is listed whatever the date range says; the range limits the finished ones */
    var rows = forms.uniqueRows(HB.data.buy.orders({ status: OPEN }), HB.data.buy.orders(ctx.filters));
    rootEl.appendChild(forms.docList({
      state: st.list, rows: rows,
      subtitle: 'Open orders are always listed. The date range applies to received, rejected and cancelled ones.',
      statuses: ['PENDING', 'APPROVED', 'PART_RECEIVED', 'RECEIVED', 'REJECTED', 'CANCELLED'],
      search: ['id', 'vendorName', 'note'], searchPlaceholder: 'Search orders', sort: { key: 'date', dir: 'desc' },
      empty: 'No purchase order in this range',
      columns: [
        { key: 'id', label: 'Order' },
        { key: 'date', label: 'Date', format: 'date' },
        { key: 'vendorName', label: 'Vendor', maxWidth: 240 },
        { key: 'expectedDate', label: 'Expected on', render: function (v, row) {
          return row.late ? ui.row([day(v), ui.chip(lateText(row), 'warn')], { gap: 2 }) : day(v);
        } },
        { key: 'total', label: 'Value', format: 'inr2' },
        { key: 'receivedPct', label: 'Received', align: 'right', format: function (v) { return fmt.pct(v, 0); } },
        { key: 'status', label: 'Status', render: ui.cells.status() }
      ],
      newLabel: 'New purchase order', newReason: may.ok ? '' : may.reason,
      onNew: function () { st.form = forms.draft(); ctx.rerender(); }
      /* a row opens '#/doc/<row.id>': the router comes back here with ctx.docId */
    }));
  }

  /* ------------------------------------------------------------------ form */

  /** The items the masters say this vendor supplies, or null when they do not say. */
  function supplied(vendorId) {
    var list = vendorId ? HB.data.lookup.vendor(vendorId).supplies : null;
    return list && list.length ? list : null;
  }

  /** draft -> the payload of docs/API.md 3.5. form.lines() leaves out the lines nothing was typed into. */
  function payload(draft, form) {
    var v = draft.values;
    return {
      date: v.date, vendorId: v.vendorId, expectedDate: v.expectedDate, note: v.note,
      lines: form.lines().map(function (l) { return { itemId: l.itemId, qty: l.qty, rate: l.rate }; })
    };
  }

  /** What the engine says will happen on submitting: preview.outcome, in words. */
  function outcome(p) {
    var o = p && p.ok ? p.outcome : null;
    if (!o) return { tone: 'neutral', short: '-', title: 'Approval',
      text: 'An order up to ' + limit() + ' is approved as it is submitted. Above that it waits for the Owner.' };
    if (o.waits) return { tone: 'warn', short: 'Waits for the Owner', title: 'Waits for the Owner, above the limit',
      text: 'This order is above ' + limit() + '. Goods can be received against it once the Owner approves it.' };
    if (o.self) return { tone: 'info', short: 'Approved as your own', title: 'Above the limit: approved as your own order',
      text: 'This order is above ' + limit() + '. As the Owner you approve it as you submit it, and the audit log says so.' };
    return { tone: 'good', short: 'Approved as submitted', title: 'Approved as submitted',
      text: 'This order is within the limit of ' + limit() + ' and needs no approval.' };
  }

  /** The one line of the toast: where the order landed. An order moves neither stock nor money. */
  function landed(doc) {
    if (doc.status === 'PENDING') return 'Above the limit of ' + limit() + ': it waits for the Owner. Nothing moves until the goods are received.';
    if (doc.approval && doc.approval.self) return 'Above the limit of ' + limit() + ': approved as your own order. Stock moves when the goods are received.';
    return 'Within the limit of ' + limit() + ': approved as submitted. Stock moves when the goods are received.';
  }

  function form(rootEl, ctx) {
    var st = ctx.state, draft = st.form, may = HB.session.can('po.create');   /* the draft outlives st.form: a box that loses the caret after posting still reads it */
    rootEl.appendChild(forms.docForm({
      title: 'New purchase order', state: draft, backLabel: 'Back to orders', submitLabel: 'Submit order', submitIcon: 'send',
      submitReason: may.ok ? '' : may.reason,
      fields: [
        { key: 'vendorId', label: 'Vendor', type: 'party', kind: 'vendor', required: true, span: 2, rebuild: true,
          filter: function (v) { return v.kind === 'stock'; },
          hint: function (draft) { return supplied(draft.values.vendorId) ? 'The item list is limited to what this vendor supplies.' : ''; },
          onChange: function (id, draft) {
            /* lines for items the new vendor does not supply are dropped; the engine has no such rule, the masters do */
            var only = supplied(id);
            if (only) draft.lines = draft.lines.filter(function (l) { return !l.itemId || only.indexOf(l.itemId) !== -1; });
            if (!draft.lines.length) draft.lines.push({});
          } },
        { key: 'date', label: 'Order date', type: 'date', required: true },
        { key: 'expectedDate', label: 'Expected on', type: 'date', max: null },
        { key: 'note', label: 'Note', optional: true, span: 4, maxLength: 200, placeholder: 'Anything the vendor or the stores should know' }
      ],
      lines: {
        title: 'Items', subtitle: 'The rate starts at the latest purchase price. Change it if the vendor quotes another.', addLabel: 'Add item', minRows: 1,
        columns: [
          { key: 'itemId', label: 'Item', type: 'item', kind: ['rm', 'pk'], required: true, width: '32%',
            filter: function (it, row, rows) {
              var only = supplied(draft.values.vendorId);
              if (only && only.indexOf(it.id) === -1) return false;
              return rows.every(function (r) { return r === row || r.itemId !== it.id; });   /* an item goes on one line */
            },
            onChange: function (row, id) { row.rate = id ? (HB.engine.price(id) || null) : null; } },
          { key: 'qty', label: 'Quantity', type: 'qty', required: true, unit: function (row) { return row.itemId ? item(row.itemId).unit : ''; } },
          { key: 'latest', label: 'Latest price', type: 'computed', format: 'rate', title: 'The rate of the goods receipt posted last',
            value: function (row) { return row.itemId ? HB.engine.price(row.itemId) : null; } },
          { key: 'rate', label: 'Rate', type: 'rate', required: true },
          /* the value of a line as it is typed: HB.money.amount, the function the engine itself calls. Totals come from the preview. */
          { key: 'amount', label: 'Amount', type: 'computed', format: 'inr2', footer: 'sum',
            value: function (row) { return row.qty > 0 && row.rate > 0 ? HB.money.amount(row.qty, row.rate) : null; } }
        ]
      },
      panel: function (p) { var o = outcome(p); return ui.callout(o.tone, o.title, o.text); },
      totals: function (p) {
        var doc = p && p.ok ? p.doc : null, o = outcome(p);
        return [
          { label: 'Items', value: doc ? fmt.num(doc.lines.length) : '-' },
          { label: 'Order value', sub: 'before GST', value: doc ? fmt.inr2(doc.total) : '-', strong: true, rule: true },
          { label: 'On submitting', value: o.short, tone: o.tone === 'good' ? 'good' : (o.tone === 'warn' ? 'bad' : 'muted') }
        ];
      },
      onPreview: function (draft, f) { return HB.engine.preview('PO', payload(draft, f)); },
      onSubmit: function (draft, f) {
        var res = HB.engine.act('post', { type: 'PO', payload: payload(draft, f) });
        if (!res.ok) return res;                    /* the form shows the refusal at the field it names */
        st.form = null;
        forms.postedToast(res.doc, landed(res.doc));
        ctx.openDoc(res.doc.id);
        return res;
      },
      onCancel: function () { st.form = null; ctx.rerender(); }
    }));
  }

  /* ------------------------------------------------------------------ view */

  /** "Receive goods": allowed when the engine would take a receipt against this order from this persona. */
  function receiveAction(v) {
    if (OPEN.indexOf(v.status) === -1) return null;
    var chk = HB.engine.check('post', { type: 'GRN', payload: { date: HB.calendar.today, poId: v.id, lines: [] } });
    var blocked = !chk.ok && (chk.error.code === 'role' || chk.error.field === 'poId');   /* no lines yet: that refusal is not about the order */
    return { label: 'Receive goods', icon: 'box', variant: v.status === 'PENDING' ? 'secondary' : 'primary', reason: blocked ? chk.error.message : '',
      onClick: function () { forms.startDraft('buy-receipts', { values: { poId: v.id } }); } };
  }

  function view(rootEl, ctx) {
    var v = HB.data.doc.view(ctx.docId);
    if (!v || v.type !== 'PO') { rootEl.appendChild(forms.missingDoc(ctx.docId, { onBack: ctx.closeDoc, backLabel: 'Back to orders' })); return; }
    var row = HB.data.buy.orders({ from: v.date, to: v.date }).filter(function (r) { return r.id === v.id; })[0] || {};
    /* approve, reject and cancel come from the data layer with their reasons; the page adds its own next step */
    var actions = forms.docActions({
      view: v, labels: { cancel: 'Cancel the order' },
      moved: function (op, res) {
        if (op === 'approve') return 'Goods can now be received against it.';
        if (op === 'cancel') return 'No stock or money had moved on it. ' + res.doc.id + ' records the cancellation.';
        return '';                                    /* a rejection: the toast carries the reason */
      }
    });
    var receive = receiveAction(v);
    if (receive) actions.splice(v.status === 'PENDING' ? actions.length - 1 : 0, 0, receive);   /* after approve and reject while it waits, first once approved */
    rootEl.appendChild(forms.docView({
      title: forms.docTitle(v), subtitle: v.party.name, status: v.status,
      chips: row.late ? [ui.chip(lateText(row), 'warn')] : null,
      onBack: ctx.closeDoc, backLabel: 'Back to orders',
      notice: forms.docNotice(v, { waiting: 'It is above ' + limit() + ', the limit up to which an order is approved as it is submitted.' }),
      meta: [['Vendor', v.party.name], ['Order date', day(v.date)], ['Expected on', day(v.doc.expectedDate)], ['Raised by', v.createdByName], ['Note', v.note || null]],
      lines: {
        title: 'Items',
        columns: [
          { key: 'itemName', label: 'Item' },
          { key: 'qty', label: 'Ordered', format: 'qty' },            /* 'qty' reads row.unit */
          { key: 'received', label: 'Received', format: 'qty' },
          { key: 'rate', label: 'Rate', format: 'rate' },
          { key: 'amount', label: 'Amount', format: 'inr2' }
        ],
        rows: v.lines, footer: { itemName: 'Total', amount: v.amount }
      },
      totals: [
        { label: 'Order value', sub: 'before GST', value: fmt.inr2(v.amount), strong: true },
        { label: 'Received so far', sub: 'at the order\'s rates', value: fmt.inr2(row.receivedValue), tone: 'muted' }
      ],
      related: forms.relatedOf(v.id), timeline: forms.timelineOf(v.id), actions: actions
    }));
  }

  /* ------------------------------------------------------------------ page */

  HB.router.register({
    id: 'buy-orders', route: '#/buy/orders', group: 'Buy', title: 'Purchase orders', filters: ['date'],
    render: function (rootEl, ctx) {
      if (ctx.docId) return view(rootEl, ctx);         /* '#/doc/PO-...': the hash decides */
      if (ctx.state.form) return form(rootEl, ctx);    /* a draft is open: it survives redraws, persona switches and visits elsewhere */
      list(rootEl, ctx);
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
