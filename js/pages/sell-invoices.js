/*
 * Invoices (#/sell/invoices). Every invoice: the list, the form of a single invoice (a further supply to any active
 * customer, or the delivery of a corporate order that js/pages/sell-corporate.js hands over), the view with the
 * batches each line took, and the printed invoice and delivery challan. Built on the pattern of
 * js/pages/buy-orders.js (docs/PAGES.md). Every figure comes from HB.data or HB.engine.
 */
(function (root) {
  'use strict';

  var HB = root.HB;
  if (!HB || !HB.router || !HB.ui || !HB.forms) return;
  var ui = HB.ui, h = ui.h, forms = HB.forms, fmt = HB.fmt;

  var TERMS = { cash: 'Cash on delivery', weekly: 'Weekly credit', credit: 'Credit' };   /* the terms an invoice was posted on, in words */

  function day(iso) { return ui.format('date', iso); }
  function item(id) { return HB.data.lookup.item(id); }
  function customer(id) { return HB.data.lookup.customer(id); }
  function rateText(rate) { return rate > 0 ? fmt.num(rate) + '%' : 'Nil'; }
  /** The customer's terms in words; credit terms say for how many days. The days are the master's. */
  function termsText(c) {
    if (!c || !c.termsLabel) return '-';
    return c.terms === 'credit' && c.creditDays > 0 ? c.termsLabel + ', ' + fmt.num(c.creditDays) + (c.creditDays === 1 ? ' day' : ' days') : c.termsLabel;
  }
  function overdueText(row) { return fmt.num(row.daysOverdue) + (row.daysOverdue === 1 ? ' day overdue' : ' days overdue'); }
  /** The first two of a list in words, and how many more there are. */
  function few(list) { return list.slice(0, 2).join(', ') + (list.length > 2 ? ' and ' + fmt.num(list.length - 2) + ' more' : ''); }

  /** Where the money of an invoice stands, as one chip. The figures are the list row's own. */
  function payChip(row) {
    if (row.status !== 'POSTED') return ui.statusChip(row.status);
    if (row.overdue) return ui.statusChip('OVERDUE', { label: overdueText(row) });
    if (!(row.open > 0)) return ui.statusChip('PAID', { label: 'Settled' });
    return row.open < row.total ? ui.statusChip('PART_PAID', { label: 'Part settled' }) : ui.statusChip('UNPAID', { label: 'To receive' });
  }

  /* ------------------------------------------------------------------ list */

  function list(rootEl, ctx) {
    var st = ctx.state, may = HB.session.can('inv.create');
    st.list = st.list || {};
    /* an invoice with money still to receive is listed whatever the date range says; the range limits the others */
    var rows = forms.uniqueRows(HB.data.sell.invoices({ open: true }), HB.data.sell.invoices(ctx.filters));
    rootEl.appendChild(forms.docList({
      state: st.list, rows: rows,
      subtitle: 'Invoices with money still to receive are always listed. The date range applies to settled and cancelled ones.',
      groups: [
        { id: 'toReceive', label: 'To receive', test: function (r) { return r.status === 'POSTED' && r.open > 0; } },
        { id: 'overdue', label: 'Overdue', test: function (r) { return r.overdue; } },
        { id: 'settled', label: 'Settled', test: function (r) { return r.status === 'POSTED' && !(r.open > 0); } },
        { id: 'CANCELLED', label: 'Cancelled', statuses: ['CANCELLED'] }
      ],
      search: ['id', 'customerName', 'channelLabel', 'routeName', 'soId', 'sheetId', 'note'], searchPlaceholder: 'Search invoices',
      sort: { key: 'date', dir: 'desc' }, empty: 'No invoice in this range',
      columns: [
        { key: 'id', label: 'Invoice' },
        /* the due date rides under the invoice date, so that six columns fit the narrowest window */
        { key: 'date', label: 'Date', render: function (v, row) {
          return h('div', null, h('div', null, day(v)), h('div', { 'class': 'mk-xs mk-muted' }, 'due ' + day(row.dueDate)));
        } },
        { key: 'customerName', label: 'Customer', render: ui.cells.twoLine(function (r) {
          return r.opening ? 'Opening balance' : [r.channelLabel, r.routeName].filter(Boolean).join(' - ');
        }, { maxWidth: 180 }) },
        { key: 'total', label: 'Total', format: 'inr2' },
        { key: 'open', label: 'To receive', format: 'inr2' },
        { key: 'status', label: 'Status', render: function (v, row) { return payChip(row); } }
      ],
      newLabel: 'New invoice', newReason: may.ok ? '' : may.reason,
      onNew: function () { st.form = forms.draft(); ctx.rerender(); }
    }));
  }

  /* ------------------------------------------------------------------ form */

  /** The sales order the draft delivers, as the data layer holds it now (null: a single invoice with no order). */
  function orderOf(draft) {
    var v = draft.values.soId ? HB.data.doc.view(draft.values.soId) : null;
    return v && v.type === 'SO' ? v : null;
  }

  function orderLine(draft, row) {
    var order = orderOf(draft), lines = order ? order.lines : [];
    for (var i = 0; i < lines.length; i++) if (lines[i].itemId === row.itemId) return lines[i];
    return {};
  }

  /** A delivery starts with the order's customer and one line per order line at the quantity ordered. Once per order. */
  function fill(draft) {
    var soId = draft.values.soId || null;
    if (draft.linesFor === soId) return;
    var order = orderOf(draft);
    if (order) {
      draft.values.customerId = order.party.id;
      draft.lines = order.lines.map(function (l) { return { itemId: l.itemId, qty: l.qty }; });
      draft.touched.soId = true;                    /* a refusal about the order shows at once, not only after a submit */
    }
    draft.linesFor = soId;
  }

  /** The price list of the customer's channel for a product, or null while either is missing. */
  function listPrice(itemId, customerId) {
    var prices = itemId ? item(itemId).price : null, channel = customerId ? customer(customerId).channel : null;
    return prices && channel && prices[channel] > 0 ? prices[channel] : null;
  }

  /** The price a line is invoiced at: the order's on a delivery, the one typed otherwise. */
  function priceOf(draft, row) { return draft.values.soId ? orderLine(draft, row).price : row.price; }

  /**
   * draft -> the payload of docs/API.md 3.5. A delivery sends every line of the order with its quantity (the engine
   * takes the order's prices and skips a quantity of zero), so its line numbers are the grid's own.
   */
  function payload(draft, form) {
    var v = draft.values;
    if (v.soId) {
      return { date: v.date, customerId: v.customerId, soId: v.soId, note: v.note,
        lines: draft.lines.map(function (l) { return { itemId: l.itemId, qty: l.qty || 0 }; }) };
    }
    return { date: v.date, customerId: v.customerId, note: v.note,
      lines: form.lines().map(function (l) { return { itemId: l.itemId, qty: l.qty || 0, price: l.price }; }) };
  }

  /** What the preview says of the stock behind one product. */
  function stockOf(p, itemId) {
    var list = (p && p.stock) || [];
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].itemId === itemId) return list[i];
    return null;
  }

  function availableCell(row, index, p) {
    var s = row.itemId ? stockOf(p, row.itemId) : null;
    if (!s) return null;
    var text = fmt.qty(s.available, item(row.itemId).unit);
    return s.short ? h('span', { 'class': 'mk-bad', title: 'Not enough for this line' }, ui.icon('alert-triangle', 14), ' ', text) : text;
  }

  /** Left of the totals: what the customer owes against its limit once this invoice is posted, as the preview has it. */
  function creditPanel(p, draft) {
    var id = draft.values.customerId;
    if (!id) return ui.callout('neutral', 'Choose the customer', 'Posting takes the stock out of the finished store, oldest batch first, and adds the invoice to what the customer owes.');
    var c = customer(id), k = p && p.ok ? p.credit : null;
    if (k) {
      return ui.card({ title: 'Credit limit', subtitle: c.name, body: [
        ui.meter({ label: 'Owes once this invoice is posted', value: k.after, max: k.limit, valueLabel: fmt.inr2(k.after) + ' of ' + fmt.inr2(k.limit), tone: k.over ? 'critical' : 'good' }),
        h('p', { 'class': 'mk-small mk-muted mk-mt-2' }, 'Owes now: ' + fmt.inr2(k.owes) + '. ' +
          (!k.over ? 'The invoice stays within the limit.'
            : (k.owes > k.limit ? 'The customer is already above the limit.' : 'The invoice takes the customer above the limit.') + ' It can still be posted.'))
      ] });
    }
    return ui.callout('neutral', 'Terms: ' + termsText(c),
      c.creditLimit > 0 ? 'Credit limit ' + fmt.inr2(c.creditLimit) + '. The balance against it shows once the lines are complete.' : 'No credit limit is set for this customer.');
  }

  function totalsOf(p) {
    var d = p && p.ok ? p.doc : null;
    if (!d) return [{ label: 'Before GST', value: '-' }, { label: 'GST', value: '-' }, { label: 'Invoice total', value: '-', strong: true, rule: true }];
    var open = HB.engine.openAmount(d);
    return [
      { label: 'Before GST', value: fmt.inr2(d.taxable) },
      { label: 'GST', sub: 'CGST and SGST', value: fmt.inr2(d.gst) },
      { label: 'Invoice total', value: fmt.inr2(d.total), strong: true, rule: true },
      d.creditApplied > 0 ? { label: 'Credit applied', sub: 'from returns and money on account', value: fmt.inr2(d.creditApplied), tone: 'muted' } : null,
      d.paidNow > 0 ? { label: 'Cash collected on delivery', value: fmt.inr2(d.paidNow), tone: 'good' } : null,
      open > 0 ? { label: 'Added to the balance', sub: 'due ' + day(d.dueDate), value: fmt.inr2(open) } : null
    ];
  }

  function goods(inv) {
    return inv.lines.map(function (l) { return fmt.qty(l.qty, item(l.itemId).unit) + ' of ' + item(l.itemId).name; });
  }

  /** The one line of the toast: the invoice's own lines and amounts, names from the lookup. */
  function movedText(inv, warnings) {
    var parts = ['Finished stock down: ' + few(goods(inv)) + '.'], open = HB.engine.openAmount(inv);
    if (inv.creditApplied > 0) parts.push('Credit applied: ' + fmt.inr2(inv.creditApplied) + '.');
    if (inv.paidNow > 0) parts.push('Cash collected: ' + fmt.inr2(inv.paidNow) + '.');
    if (open > 0) parts.push(customer(inv.customerId).name + ' owes ' + fmt.inr2(open) + ' more, due ' + day(inv.dueDate) + '.');
    if (inv.soId) parts.push(inv.soId + ' is now invoiced.');
    (warnings || []).forEach(function (w) {
      if (!w) return;
      if (w.code === 'credit_limit') parts.push('That is above the credit limit of ' + fmt.inr2(customer(inv.customerId).creditLimit) + '.');
      else if (w.message) parts.push(w.message + '.');
    });
    return parts.join(' ');
  }

  function form(rootEl, ctx) {
    var st = ctx.state, draft = forms.draft(st.form), may = HB.session.can('inv.create');   /* a draft another page handed over gets its shape here */
    fill(draft);
    var delivery = !!draft.values.soId;
    function unit(row) { return row.itemId ? item(row.itemId).unit : ''; }

    var fields = delivery ? [
      { key: 'customerId', label: 'Customer', type: 'static', span: 2, text: function (d) { return d.values.customerId ? customer(d.values.customerId).name : '-'; } },
      { key: 'date', label: 'Invoice date', type: 'date', required: true },
      { key: 'soId', label: 'Sales order', type: 'static', text: function (d) { return forms.docLink(d.values.soId); } }
    ] : [
      { key: 'customerId', label: 'Customer', type: 'party', kind: 'customer', required: true, span: 2, rebuild: true,
        hint: 'Prices start at the price list of the customer\'s channel.',
        onChange: function (id, d) { d.lines.forEach(function (l) { if (l.itemId) l.price = listPrice(l.itemId, id); }); } },
      { key: 'date', label: 'Invoice date', type: 'date', required: true },
      { key: 'terms', label: 'Terms', type: 'static', text: function (d) { return d.values.customerId ? termsText(customer(d.values.customerId)) : '-'; } }
    ];
    fields.push({ key: 'note', label: 'Note', optional: true, span: 4, maxLength: 200, placeholder: 'Anything the customer or the driver should know' });

    var columns = [
      delivery ? { key: 'itemId', label: 'Item', type: 'static', width: '28%', format: function (v) { return v ? item(v).name : '-'; } }
        : { key: 'itemId', label: 'Item', type: 'item', kind: 'fg', required: true, width: '28%',
          filter: function (it, row, rows) { return rows.every(function (r) { return r === row || r.itemId !== it.id; }); },   /* an item goes on one line */
          onChange: function (row, id) { row.price = listPrice(id, st.form.values.customerId); } },
      delivery ? { key: 'ordered', label: 'Ordered', type: 'computed', format: 'qty', unit: unit, value: function (row) { return orderLine(st.form, row).qty; } } : null,
      { key: 'qty', label: delivery ? 'Delivered' : 'Quantity', type: 'qty', decimals: 0, unit: unit, required: true },
      { key: 'available', label: 'Available', type: 'computed', align: 'right', title: 'Unexpired stock in the finished store on the invoice date', value: availableCell },
      delivery ? { key: 'price', label: 'Order price', type: 'computed', format: 'rate', title: 'The price of the order. It cannot be changed here.', value: function (row) { return orderLine(st.form, row).price; } }
        : { key: 'price', label: 'Price', type: 'rate', required: true },
      { key: 'gstRate', label: 'GST', type: 'computed', align: 'right', value: function (row) { return row.itemId ? rateText(item(row.itemId).gstRate) : null; } },
      /* the value of a line as it is typed: HB.money.amount, the function the engine itself calls. Totals come from the preview. */
      { key: 'amount', label: 'Before GST', type: 'computed', format: 'inr2', footer: 'sum',
        value: function (row) { var price = priceOf(st.form, row); return row.qty > 0 && price > 0 ? HB.money.amount(row.qty, price) : null; } }
    ];

    rootEl.appendChild(forms.docForm({
      title: delivery ? 'Deliver and invoice ' + draft.values.soId : 'New invoice', state: draft,
      subtitle: delivery ? 'The order becomes an invoice. Change a quantity where less was delivered: the order is closed with what this invoice delivers.' : 'A single supply outside the dispatch sheets',
      backLabel: delivery ? 'Back to the order' : 'Back to invoices', submitLabel: 'Post invoice',
      submitReason: may.ok ? '' : may.reason,
      fields: fields,
      lines: {
        title: 'Items', addLabel: 'Add item', minRows: delivery ? 0 : 1, addRows: !delivery, removeRows: !delivery,
        subtitle: 'Stock leaves the finished store, oldest unexpired batch first.', empty: 'This order has no lines',
        columns: columns
      },
      panel: creditPanel,
      totals: totalsOf,
      onPreview: function (d, f) { return HB.engine.preview('INV', payload(d, f)); },
      onSubmit: function (d, f) {
        var res = HB.engine.act('post', { type: 'INV', payload: payload(d, f) });
        if (!res.ok) return res;                    /* the form shows the refusal at the field or the line it names */
        st.form = null;
        forms.postedToast(res.doc, movedText(res.doc, res.warnings));
        ctx.openDoc(res.doc.id);
        return res;
      },
      onCancel: function (d) {
        st.form = null;
        if (d.values.soId) ctx.openDoc(d.values.soId); else ctx.rerender();
      }
    }));
  }

  /* ----------------------------------------------------------------- paper */

  /** SCOPE 4.5: the printed title follows the lines. */
  function paperTitle(lines) {
    var taxed = anyTaxed(lines), nil = anyNil(lines);
    return taxed && nil ? 'Invoice-cum-bill of supply' : (taxed ? 'Tax invoice' : 'Bill of supply');
  }

  function anyTaxed(lines) { return lines.some(function (l) { return l.gstRate > 0; }); }
  function anyNil(lines) { return lines.some(function (l) { return !(l.gstRate > 0); }); }
  /** What the value before GST is called on paper: "taxable" only when every line is taxed. */
  function valueLabel(lines) { return anyNil(lines) ? 'Value before GST' : 'Taxable value'; }

  /** Value and tax by GST rate, from the rows the invoice itself posted: one row per rate, nothing added up here. */
  function taxRows(tax) {
    var out = [];
    tax.forEach(function (t) {
      if (!(t.gstRate > 0)) { out.push({ label: 'Of which Nil-rated', sub: 'no GST is charged on it', value: fmt.inr2(t.taxable), tone: 'muted' }); return; }
      var on = 'on ' + fmt.inr2(t.taxable) + ' of items at ' + rateText(t.gstRate) + ' GST';
      out.push({ label: 'CGST', sub: on, value: fmt.inr2(t.cgst) });
      out.push({ label: 'SGST', sub: on, value: fmt.inr2(t.sgst) });
    });
    return out;
  }

  function partyBlock(label, c) {
    return { label: label, name: c.name, lines: [c.locality, c.gstin ? 'GSTIN ' + c.gstin : null] };
  }

  function invoicePaper(v, tax, row) {
    var d = v.doc, c = customer(d.customerId), so = d.soId ? HB.data.doc.get(d.soId) : null, company = HB.masters.company;
    var taxed = anyTaxed(v.lines);
    return forms.printSheet({
      title: paperTitle(v.lines), number: v.id, date: v.date, copy: v.cancelled ? 'Cancelled' : null,
      party: partyBlock('Billed to', c),
      meta: [['Terms', TERMS[d.terms] || d.terms], ['Due on', day(d.dueDate)], d.soId ? ['Sales order', d.soId] : null,
        so && so.poRef ? ['Purchase order', so.poRef] : null, ['State code', company.stateCode]],
      /* a bill of supply charges no GST: it carries no tax columns */
      columns: [
        { key: 'itemId', label: 'Item', value: function (l) { return item(l.itemId).display; } },
        { key: 'hsn', label: 'HSN', value: function (l) { return item(l.itemId).hsn; } },
        { key: 'qty', label: 'Quantity', format: 'qty', unit: function (l) { return l.unit; } },
        { key: 'price', label: 'Price', format: 'rate' },
        { key: 'taxable', label: taxed ? valueLabel(v.lines) : 'Value', format: 'inr2' },
        taxed ? { key: 'gstRate', label: 'GST', align: 'right', format: function (x) { return rateText(x); } } : null,
        taxed ? { key: 'cgst', label: 'CGST', format: 'inr2' } : null,
        taxed ? { key: 'sgst', label: 'SGST', format: 'inr2' } : null
      ].filter(Boolean),
      rows: v.lines, footer: { itemId: 'Total', qty: d.units, taxable: d.taxable },
      totals: (taxed ? [{ label: valueLabel(v.lines), value: fmt.inr2(d.taxable) }].concat(taxRows(tax)) : [{ label: 'Nil-rated value', sub: 'no GST is charged on it', value: fmt.inr2(d.taxable) }])
        .concat([{ label: 'Invoice total', value: fmt.inr2(d.total), strong: true, rule: true }]),
      notes: [
        d.creditApplied > 0 ? 'Credit applied: ' + fmt.inr2(d.creditApplied) + '.' : null,
        d.paidNow > 0 ? 'Received in cash on delivery: ' + fmt.inr2(d.paidNow) + '.' : null,
        row.open > 0 ? 'To pay: ' + fmt.inr2(row.open) + ' by ' + day(d.dueDate) + '.' : null
      ]
    });
  }

  /** The same lines without prices, with the batches that left. */
  function challanPaper(v) {
    var d = v.doc, c = customer(d.customerId), so = d.soId ? HB.data.doc.get(d.soId) : null;
    return forms.printSheet({
      title: 'Delivery challan', number: v.id, date: v.date, copy: v.cancelled ? 'Cancelled' : null,
      party: partyBlock('Delivered to', c),
      meta: [d.routeId ? ['Route', HB.data.lookup.route(d.routeId).name] : null, d.soId ? ['Sales order', d.soId] : null, so && so.poRef ? ['Purchase order', so.poRef] : null],
      columns: [
        { key: 'itemId', label: 'Item', value: function (l) { return item(l.itemId).display; } },
        { key: 'hsn', label: 'HSN', value: function (l) { return item(l.itemId).hsn; } },
        { key: 'batches', label: 'Batch', value: function (l) { return (l.batches || []).map(function (b) { return b.batchId + ' x ' + fmt.num(b.qty); }).join(', '); } },
        { key: 'qty', label: 'Quantity', format: 'qty', unit: function (l) { return l.unit; } }
      ],
      rows: v.lines, footer: { itemId: 'Total', qty: d.units },
      notes: 'Goods delivered against ' + v.id + '. Prices and tax are on the invoice.'
    });
  }

  /** The paper form in a dialog, with the button that sends it to the browser's print. */
  function showPaper(title, sheet, job) {
    var dlg = ui.modal({ title: title, size: 'xl', body: sheet, footer: [
      ui.button({ label: 'Close', variant: 'ghost', onClick: function () { dlg.close(); } }),
      ui.button({ label: 'Print', icon: 'printer', variant: 'primary', onClick: function () { forms.printDoc(sheet, { title: job }); } })
    ] });
  }

  /* ------------------------------------------------------------------ view */

  function batchRows(lines) {
    var out = [];
    lines.forEach(function (l) {
      (l.batches || []).forEach(function (b) { out.push({ itemName: l.itemName, unit: l.unit, batchId: b.batchId, qty: b.qty }); });
    });
    return out;
  }

  /** What a cancellation gives back, from the cancelled invoice itself. */
  function cancelledText(res) {
    var inv = res.target, parts = ['Finished stock back: ' + few(goods(inv)) + '.'];
    if (inv.paidNow > 0) parts.push(fmt.inr2(inv.paidNow) + ' of cash collected has left factory cash again.');
    if (inv.creditApplied > 0) parts.push(fmt.inr2(inv.creditApplied) + ' of credit is back with the customer.');
    if (inv.soId) parts.push(inv.soId + ' is open again.');
    parts.push(res.doc.id + ' records the cancellation.');
    return parts.join(' ');
  }

  function view(rootEl, ctx) {
    var v = HB.data.doc.view(ctx.docId);
    if (!v || v.type !== 'INV') { rootEl.appendChild(forms.missingDoc(ctx.docId, { onBack: ctx.closeDoc, backLabel: 'Back to invoices' })); return; }
    var d = v.doc, c = customer(d.customerId);
    var row = HB.data.sell.invoices({ from: v.date, to: v.date }).filter(function (r) { return r.id === v.id; })[0] || {};
    var so = d.soId ? HB.data.doc.get(d.soId) : null;
    var tax = HB.engine.rowsOf(v.id).gst;           /* the GST rows the invoice posted: value and tax by rate */
    var k = v.costing;                              /* cost and margin: only for the roles the selector gives them to */
    var noPaper = d.opening ? 'An opening balance has no lines to print' : '';

    var notice = forms.docNotice(v);
    if (!notice && d.opening) notice = { tone: 'info', title: 'Opening balance', text: 'What the customer owed when the books opened. It carries a total and a due date, and no stock, sales or GST.' };
    if (!notice && row.overdue) notice = { tone: 'warn', title: 'Overdue', text: fmt.inr2(row.open) + ' was due on ' + day(d.dueDate) + ', ' + overdueText(row) + '.' };

    var actions = [
      { label: 'Print invoice', icon: 'printer', reason: noPaper, onClick: function () { showPaper(paperTitle(v.lines) + ' ' + v.id, invoicePaper(v, tax, row), v.id); } },
      { label: 'Print delivery challan', icon: 'truck', reason: noPaper, onClick: function () { showPaper('Delivery challan ' + v.id, challanPaper(v), v.id + ' challan'); } }
    ].concat(forms.docActions({
      view: v, labels: { cancel: 'Cancel the invoice' },
      ask: { cancel: 'The stock goes back to the finished store in the batches it left from, the customer no longer owes the invoice, cash collected on delivery leaves factory cash again, and an order it came from is open again.' },
      moved: function (op, res) { return op === 'cancel' ? cancelledText(res) : ''; }
    }));

    rootEl.appendChild(forms.docView({
      title: forms.docTitle(v), subtitle: v.party.name, status: v.status,
      chips: [v.status === 'POSTED' ? payChip(row) : null, d.opening ? ui.chip('Opening balance', 'neutral') : null].filter(Boolean),
      onBack: ctx.closeDoc, backLabel: 'Back to invoices', notice: notice,
      meta: [
        ['Customer', c.name],
        ['Channel', [row.channelLabel, row.routeName].filter(Boolean).join(' - ') || null],
        ['Invoice date', day(v.date)],
        ['Terms', TERMS[d.terms] || d.terms || null],
        ['Due on', day(d.dueDate)],
        ['Sales order', d.soId ? forms.docLink(d.soId) : null],
        ['Their purchase order', so && so.poRef ? so.poRef : null],
        ['Dispatch sheet', d.sheetId ? forms.docLink(d.sheetId) : null],
        ['Entered by', v.createdByName],
        ['Note', v.note || null]
      ],
      lines: {
        title: 'Items', empty: 'An opening balance carries a total and no lines',
        columns: [
          { key: 'itemName', label: 'Item' },
          { key: 'qty', label: 'Quantity', format: 'qty' },                 /* 'qty' reads row.unit */
          { key: 'price', label: 'Price', format: 'rate' },
          { key: 'taxable', label: 'Before GST', format: 'inr2' },
          { key: 'gstRate', label: 'GST', align: 'right', render: function (x) { return rateText(x); } },
          { key: 'cgst', label: 'CGST', format: 'inr2' },
          { key: 'sgst', label: 'SGST', format: 'inr2' }
        ],
        rows: v.lines, footer: v.lines.length ? { itemName: 'Total', taxable: d.taxable } : null
      },
      totals: [{ label: 'Before GST', value: fmt.inr2(d.taxable) }].concat(taxRows(tax), [
        { label: 'Invoice total', value: fmt.inr2(d.total), strong: true, rule: true },
        d.creditApplied > 0 ? { label: 'Credit applied', sub: 'from returns and money on account', value: fmt.inr2(d.creditApplied), tone: 'muted' } : null,
        d.paidNow > 0 ? { label: 'Cash collected on delivery', value: fmt.inr2(d.paidNow), tone: 'muted' } : null,
        d.received > 0 ? { label: 'Received', sub: 'receipts against it', value: fmt.inr2(d.received), tone: 'muted' } : null,
        d.credited > 0 ? { label: 'Credited', sub: 'stale returns against it', value: fmt.inr2(d.credited), tone: 'muted' } : null,
        v.status === 'POSTED' ? { label: 'Still to receive', value: fmt.inr2(row.open), strong: true, rule: true } : null
      ]),
      sections: [
        v.lines.length ? { title: 'Batches taken', subtitle: 'Stock left the finished store oldest unexpired batch first', flush: true,
          body: ui.table({ dense: true, rows: batchRows(v.lines), empty: 'No batch was recorded',
            columns: [
              { key: 'itemName', label: 'Item' },
              { key: 'batchId', label: 'Batch', doc: true },
              { key: 'qty', label: 'Quantity', format: 'qty' }
            ] }) } : null,
        k ? { title: 'Cost and margin', subtitle: 'At the recipe cost on the day the invoice was posted', flush: true,
          body: ui.table({ dense: true, rows: k.lines,
            columns: [
              { key: 'itemName', label: 'Item' },
              { key: 'qty', label: 'Quantity', format: 'qty' },
              { key: 'unitCost', label: 'Unit cost', format: 'rate' },
              { key: 'cost', label: 'Cost', format: 'inr2' },
              { key: 'margin', label: 'Margin', format: 'inr2' },
              { key: 'marginPct', label: 'Margin %', format: 'pct' }
            ],
            footer: { itemName: 'Total', cost: k.cost, margin: k.margin, marginPct: k.marginPct } }) } : null
      ],
      related: forms.relatedOf(v.id), timeline: forms.timelineOf(v.id), actions: actions
    }));
  }

  /* ------------------------------------------------------------------ page */

  HB.router.register({
    id: 'sell-invoices', route: '#/sell/invoices', group: 'Sell', title: 'Invoices', filters: ['date'],
    render: function (rootEl, ctx) {
      if (ctx.docId) return view(rootEl, ctx);         /* '#/doc/INV-...': the hash decides */
      if (ctx.state.form) return form(rootEl, ctx);    /* a draft is open: it survives redraws, persona switches and visits elsewhere */
      list(rootEl, ctx);
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
