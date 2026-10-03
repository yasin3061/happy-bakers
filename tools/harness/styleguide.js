/*
 * To load it: open index.html from the file (not through tools/serve.js), run
 *   document.body.appendChild(Object.assign(document.createElement('script'), { src: 'tools/harness/styleguide.js' }))
 * in the browser console, then go to #/system/styleguide as the Owner or accounts.
 *
 * Document kit reference for developers. Every component of HB.forms, working, on dummy rows. It is not part of
 * the sample: index.html does not load it and no menu lists it, because the names and figures on it are typed
 * inline on purpose (it documents the kit and needs no data layer). Nothing here is posted anywhere.
 */
(function (root) {
  'use strict';

  var HB = root.HB;
  if (!HB || !HB.router || !HB.ui || !HB.forms) return;
  var ui = HB.ui, h = ui.h, forms = HB.forms, fmt = HB.fmt;

  /* ------------------------------------------------------------ dummy rows */

  var ITEMS = [
    { id: 'rm_maida', code: 'RM-001', name: 'Maida', kind: 'rm', unit: 'kg', pack: '50 kg bag', gstRate: 0, rate: 3850 },
    { id: 'rm_sugar', code: 'RM-003', name: 'Sugar', kind: 'rm', unit: 'kg', pack: '50 kg bag', gstRate: 5, rate: 5425 },
    { id: 'rm_yeast', code: 'RM-008', name: 'Yeast, compressed', kind: 'rm', unit: 'kg', pack: '500 g block', gstRate: 5, rate: 14250 },
    { id: 'rm_shortening', code: 'RM-004', name: 'Bakery shortening', kind: 'rm', unit: 'kg', pack: '15 kg tin', gstRate: 5, rate: 11842.75 },
    { id: 'pk_breadbag', code: 'PK-001', name: 'Bread bag, 400 g', kind: 'pk', unit: 'pcs', pack: 'roll of 1,000', gstRate: 18, rate: 62 },
    { id: 'fg_sandwich', code: 'FG-001', name: 'Sandwich bread', kind: 'fg', unit: 'pcs', pack: '400 g', gstRate: 0, rate: 3200 },
    { id: 'fg_brown', code: 'FG-002', name: 'Brown bread', kind: 'fg', unit: 'pcs', pack: '400 g', gstRate: 0, rate: 3600 },
    { id: 'fg_pav', code: 'FG-004', name: 'Ladi pav', kind: 'fg', unit: 'pcs', pack: '12 pieces', gstRate: 0, rate: 2800 },
    { id: 'fg_toast', code: 'FG-010', name: 'Elaichi toast', kind: 'fg', unit: 'pcs', pack: '250 g', gstRate: 5, rate: 4400 },
    { id: 'fg_khari', code: 'FG-012', name: 'Butter khari', kind: 'fg', unit: 'pcs', pack: '200 g', gstRate: 5, rate: 5200 },
    { id: 'fg_puff', code: 'FG-016', name: 'Veg puff', kind: 'fg', unit: 'pcs', pack: 'piece', gstRate: 5, rate: 1400 }
  ];
  var VENDORS = [
    { id: 'v_flour', name: 'Shreeji Flour Mills', town: 'Nadiad', supplies: 'Maida, atta' },
    { id: 'v_sugar', name: 'Charotar Sugar Traders', town: 'Anand', supplies: 'Sugar, salt' },
    { id: 'v_pack', name: 'Amul Road Packaging', town: 'Anand', supplies: 'Bags, pouches, labels' },
    { id: 'v_fats', name: 'Vidyanagar Oils and Fats', town: 'Vallabh Vidyanagar', supplies: 'Shortening, margarine', active: false }
  ];
  var CUSTOMERS = [
    { id: 'c_01', name: 'Jay Ambe Provision Store', channel: 'retail', outletType: 'Provision store', locality: 'Station Road' },
    { id: 'c_02', name: 'Gokul Dairy Parlour', channel: 'retail', outletType: 'Dairy parlour', locality: 'Amul Dairy Road' },
    { id: 'c_03', name: 'Shiv Tea Stall', channel: 'retail', outletType: 'Tea stall', locality: 'Ganesh Chokdi' },
    { id: 'c_04', name: 'Sardar Hostel Mess', channel: 'corporate', locality: 'Vallabh Vidyanagar' },
    { id: 'c_05', name: 'Charotar Hospital Kitchen', channel: 'corporate', locality: 'Changa' }
  ];
  var FG = ITEMS.filter(function (it) { return it.kind === 'fg'; });
  var STATUSES = ['PENDING', 'APPROVED', 'PART_RECEIVED', 'RECEIVED', 'REJECTED', 'CANCELLED', 'POSTED', 'HELD', 'OPEN', 'INVOICED', 'SENT', 'PAID'];
  var FLAGS = ['DRAFT', 'UNPAID', 'PART_PAID', 'OVERDUE', 'DUE_SOON', 'NOT_DUE', 'EXPIRED', 'NEAR_EXPIRY', 'LOW_STOCK', 'OK', 'MATCHED', 'MISMATCH', 'ACTIVE', 'INACTIVE', 'DONE', 'TODO', 'LOCKED', 'SIMULATED'];
  var PO_LIMIT = 5000000; /* Rs 50,000 in paise: orders above it wait for the Owner */

  function item(id) { return ITEMS.filter(function (it) { return it.id === id; })[0] || null; }
  function vendor(id) { return VENDORS.filter(function (v) { return v.id === id; })[0] || null; }

  /** 130 purchase orders for the list demo, the same on every load (seeded, never Math.random). */
  function sampleOrders() {
    var rng = HB.rng('styleguide|orders'), out = [], states = ['RECEIVED', 'RECEIVED', 'RECEIVED', 'APPROVED', 'PART_RECEIVED', 'PENDING', 'CANCELLED', 'REJECTED'];
    for (var i = 0; i < 130; i++) {
      var date = HB.dates.addDays(HB.calendar.today, -Math.floor(i / 2));
      var v = VENDORS[rng.int(0, VENDORS.length - 1)];
      out.push({ id: 'PO-' + date.slice(2).replace(/-/g, '') + '-' + (i % 2 ? '002' : '001'), date: date, vendorName: v.name, town: v.town,
        total: rng.int(40, 900) * 10000 + rng.int(0, 99), status: i < 4 ? 'PENDING' : states[rng.int(0, states.length - 1)] });
    }
    return out;
  }
  var ORDERS = null;

  /* --------------------------------------------------------------- helpers */

  function section(title, sub, children) { return ui.stack([ui.sectionTitle(title, sub), children], 3); }
  function readout(text) { return h('div', { 'class': 'mk-xs mk-muted mk-num' }, text); }

  /** A control with the value it hands to the page written under it. */
  function sample(label, hint, make, describe) {
    var out = readout('');
    var control = make(function (v) { out.textContent = describe(v); });
    out.textContent = describe(control.getValue());
    return ui.form.field({ label: label, hint: hint, control: h('div', { 'class': 'mk-stack mk-stack--1' }, control, out) });
  }

  /* ---------------------------------------------------------------- inputs */

  function inputsCard(st) {
    st.inputs = st.inputs || { qty: 12.5, units: 240, rate: 3850, amount: 4812550, date: HB.calendar.today, mode: 'bank', vendorId: 'v_flour', itemId: 'fg_sandwich' };
    var v = st.inputs;
    function raw(x) { return x === null ? 'null (empty)' : String(x); }
    return ui.card({ title: 'Inputs', subtitle: 'Each control hands the page a number or an id, never text. The line under it shows that value as you type.',
      body: ui.form.group([
        ui.form.row([
          sample('Quantity', 'qtyInput: up to three decimals', function (on) {
            return forms.qtyInput({ value: v.qty, unit: 'kg', onChange: function (x) { v.qty = x; on(x); } });
          }, function (x) { return 'qty = ' + raw(x) + '   shown as ' + fmt.qty(x, 'kg'); }),
          sample('Whole units', 'qtyInput with decimals: 0 (finished goods)', function (on) {
            return forms.qtyInput({ value: v.units, decimals: 0, unit: 'pcs', onChange: function (x) { v.units = x; on(x); } });
          }, function (x) { return 'qty = ' + raw(x); }),
          sample('Rate', 'rateInput: rupees typed with up to four decimals', function (on) {
            return forms.rateInput({ value: v.rate, unit: 'per kg', onChange: function (x) { v.rate = x; on(x); } });
          }, function (x) { return 'paise per unit = ' + raw(x) + '   shown as ' + fmt.rate(x); })
        ], 3),
        ui.form.row([
          sample('Amount', 'amountInput: rupees with paise, never rounded to the rupee', function (on) {
            return forms.amountInput({ value: v.amount, onChange: function (x) { v.amount = x; on(x); } });
          }, function (x) { return 'paise = ' + raw(x) + '   shown as ' + fmt.inr2(x); }),
          sample('Date', 'dateInput: not after the business date, not in a locked month', function (on) {
            return forms.dateInput({ value: v.date, onChange: function (x) { v.date = x; on(x); } });
          }, function (x) { return 'date = ' + raw(x); }),
          sample('Choice', 'selectInput', function (on) {
            return forms.selectInput({ value: v.mode, options: [{ value: 'cash_factory', label: 'Factory cash' }, { value: 'bank', label: 'Bank' }], onChange: function (x) { v.mode = x; on(x); } });
          }, function (x) { return 'value = ' + raw(x); })
        ], 3),
        ui.form.row([
          sample('Party', 'partyPicker: type a name or a town. Down, Up, Enter; Esc puts the text back', function (on) {
            return forms.partyPicker({ kind: 'vendor', options: VENDORS, value: v.vendorId, onChange: function (x) { v.vendorId = x; on(x); } });
          }, function (x) { return 'vendorId = ' + raw(x); }),
          sample('Item', 'itemPicker: by name or code, here finished goods only', function (on) {
            return forms.itemPicker({ items: ITEMS, kind: 'fg', value: v.itemId, onChange: function (x) { v.itemId = x; on(x); } });
          }, function (x) { return 'itemId = ' + raw(x); })
        ], 2)
      ]) });
  }

  /* ------------------------------------------------------- status, tabs, list */

  function statusCard() {
    return ui.card({ title: 'Status chips', subtitle: 'statusChip(status): every document status of the specification, then the flags lists use.',
      body: ui.stack([
        ui.row(STATUSES.map(function (s) { return forms.statusChip(s); }), { wrap: true }),
        ui.row(FLAGS.map(function (s) { return forms.statusChip(s); }), { wrap: true })
      ], 3) });
  }

  function listCard(st, ctx) {
    ORDERS = ORDERS || sampleOrders();
    st.list = st.list || {};
    return forms.docList({
      title: 'List of a document page', subtitle: 'docList: status tabs with counts, search, "New", pages of 50. Tab, search, sort and page survive a redraw.',
      state: st.list, rows: ORDERS, statuses: ['PENDING', 'APPROVED', 'PART_RECEIVED', 'RECEIVED', 'REJECTED', 'CANCELLED'],
      search: ['id', 'vendorName', 'town'], searchPlaceholder: 'Search orders', sort: { key: 'date', dir: 'desc' },
      columns: [
        { key: 'id', label: 'Order', width: 150 },
        { key: 'date', label: 'Date', format: 'date' },
        { key: 'vendorName', label: 'Vendor', render: ui.cells.twoLine('town') },
        { key: 'total', label: 'Value', format: 'inr2' },
        { key: 'status', label: 'Status', render: ui.cells.status() }
      ],
      newLabel: 'New purchase order',
      onNew: function () { st.form = forms.draft(); ctx.rerender(); ui.toast('The form below is open on a new draft.'); },
      onOpen: function (row) { ui.toast('A page opens the document here: ctx.openDoc("' + row.id + '")', { title: row.id }); }
    });
  }

  /* -------------------------------------------------------------- line grid */

  function lineColumns() {
    return [
      { key: 'itemId', label: 'Item', type: 'item', items: ITEMS, kind: ['rm', 'pk'], required: true, width: '34%',
        onChange: function (row, id, it) { row.rate = it ? it.rate : null; row.gstRate = it ? it.gstRate : null; } },
      { key: 'qty', label: 'Quantity', type: 'qty', required: true, /* no footer: kg and pieces do not add up */
        unit: function (row) { var it = item(row.itemId); return it ? it.unit : ''; },
        decimals: function (row) { var it = item(row.itemId); return it && it.unit === 'pcs' ? 0 : 3; } },
      { key: 'rate', label: 'Rate', type: 'rate', required: true },
      { key: 'gstRate', label: 'GST', type: 'computed', align: 'right', format: function (v) { return v === null || v === undefined ? '-' : (v ? v + '%' : 'Nil'); } },
      { key: 'amount', label: 'Amount', type: 'computed', format: 'inr2', footer: 'sum',
        value: function (row) { return row.qty > 0 && row.rate > 0 ? HB.money.amount(row.qty, row.rate) : null; } }
    ];
  }

  function lineGridCard(st) {
    st.lines = st.lines || [{ itemId: 'rm_maida', qty: 500, rate: 3850, gstRate: 0 }, { itemId: 'rm_yeast', qty: 12.5, rate: 14250, gstRate: 5 }, {}];
    var host = h('div');
    function paint() {
      ui.clear(host).appendChild(forms.lineGrid({ columns: lineColumns(), rows: st.lines, readOnly: !!st.linesReadOnly, addLabel: 'Add item', minRows: 1 }));
    }
    paint();
    return ui.card({ title: 'Line grid', subtitle: 'lineGrid: item picker, quantity and rate cells, computed cells, a footer. Tab runs across, Enter runs down and starts a new line.',
      actions: ui.segmented({ size: 'sm', ariaLabel: 'Mode', value: st.linesReadOnly ? 'read' : 'edit', options: [{ value: 'edit', label: 'Editable' }, { value: 'read', label: 'Read-only' }],
        onChange: function (v) { st.linesReadOnly = v === 'read'; paint(); } }),
      flush: true, body: host });
  }

  /* ------------------------------------------------------------ matrix grid */

  function matrixCard(st) {
    st.sheet = st.sheet || { c_01: { fg_sandwich: 24, fg_brown: 6, fg_pav: 30, fg_puff: 20 }, c_02: { fg_sandwich: 18, fg_pav: 12, fg_toast: 6, fg_khari: 8 }, c_03: { fg_pav: 40, fg_puff: 30, fg_khari: 4 } };
    st.dayEnd = st.dayEnd || { sold: { fg_sandwich: 22, fg_brown: 5, fg_pav: 28, fg_puff: 17 }, expired: { fg_puff: 3 } };
    var available = { fg_sandwich: 60, fg_brown: 12, fg_pav: 70, fg_toast: 40, fg_khari: 30, fg_puff: 45 };
    var onHand = { fg_sandwich: 26, fg_brown: 8, fg_pav: 31, fg_toast: 14, fg_khari: 9, fg_puff: 20 };
    var columns = FG.map(function (it) { return { id: it.id, label: it.name, sub: it.pack }; });
    var note = h('div', { 'class': 'mk-small mk-muted' });
    var sheet = forms.matrixGrid({
      rowHeader: 'Outlet', rows: CUSTOMERS.slice(0, 3).map(function (c) { return { id: c.id, label: c.name, sub: c.locality }; }),
      columns: columns, values: st.sheet, available: available, availableLabel: 'Available in the finished store',
      onChange: function () { describe(); }
    });
    function describe() {
      var short = sheet.short();
      note.textContent = short.length ? 'Short: ' + short.map(function (s) { return (item(s.colId) || {}).name + ' by ' + fmt.num(s.short); }).join(', ') + '. grid.short() lists them for the page.'
        : 'Type a quantity above what is available to see a column marked. Arrows and Enter move between cells.';
    }
    describe();
    var dayEnd = forms.matrixGrid({
      rowHeader: 'Units', rows: [{ id: 'sold', label: 'Sold' }, { id: 'expired', label: 'Expired, unsold' }],
      columns: columns, values: st.dayEnd, available: onHand, availableLabel: 'In the store this morning', balanceLabel: 'Left in the store',
      info: [{ label: 'MRP', format: 'rate', values: FG.reduce(function (m, it) { m[it.id] = it.rate * 1.25; return m; }, {}) }]
    });
    return ui.stack([
      ui.card({ title: 'Matrix grid: a route dispatch sheet', subtitle: 'matrixGrid: outlets by products, whole numbers, row and column totals, and what is available.', flush: true,
        body: sheet, footer: note }),
      ui.card({ title: 'Matrix grid: a store day-end', subtitle: 'The same component with two rows, a balance row and an information row.', flush: true, body: dayEnd })
    ]);
  }

  /* ---------------------------------------------------------- document form */

  /* Stands in for HB.engine.preview: the same result shape, errors named the way the engine names them. */
  function previewOrder(draft, form) {
    var v = draft.values, errors = [], warnings = [], total = 0;
    var lines = form.lines(); /* the lines something was typed into; the form maps their numbers back to the grid */
    if (!v.vendorId) errors.push({ code: 'invalid_input', field: 'vendorId', message: 'Choose the vendor' });
    else if (vendor(v.vendorId) && vendor(v.vendorId).active === false) errors.push({ code: 'invalid_input', field: 'vendorId', message: 'This vendor is deactivated' });
    if (!v.date) errors.push({ code: 'invalid_input', field: 'date', message: 'Enter the order date' });
    else if (v.date > HB.calendar.today) errors.push({ code: 'future_date', field: 'date', message: 'The date cannot be after the business date' });
    if (v.expectedDate && v.date && v.expectedDate < v.date) errors.push({ code: 'invalid_input', field: 'expectedDate', message: 'Expected on or after the order date' });
    lines.forEach(function (l, i) {
      if (!l.itemId) errors.push({ code: 'invalid_input', field: 'lines[' + i + '].itemId', message: 'Choose an item' });
      if (!(l.qty > 0)) errors.push({ code: 'invalid_input', field: 'lines[' + i + '].qty', message: 'Enter a quantity above zero' });
      if (!(l.rate > 0)) errors.push({ code: 'invalid_input', field: 'lines[' + i + '].rate', message: 'Enter the rate' });
      if (l.qty > 0 && l.rate > 0) total += HB.money.amount(l.qty, l.rate);
    });
    if (!lines.length) errors.push({ code: 'invalid_input', message: 'Add at least one line' });
    if (total > PO_LIMIT) warnings.push('Above ' + fmt.inrFull(PO_LIMIT) + ': this order will wait for the Owner.');
    return { ok: !errors.length, error: errors[0] || null, errors: errors, warnings: warnings, total: total, lines: lines.length };
  }

  function formSection(st, ctx) {
    if (!st.form) {
      return ui.card({ title: 'Document form', subtitle: 'docForm: header fields, a line grid, totals from a preview callback, errors at the field they name.',
        body: ui.emptyState('No draft is open', 'A page opens the form from "New". The draft lives in ctx.state, so it is still here after a redraw, a persona switch or a visit to another screen.',
          { icon: 'edit', action: ui.button({ label: 'New purchase order', icon: 'plus', variant: 'primary', onClick: function () { st.form = forms.draft(); ctx.rerender(); } }) }) });
    }
    return forms.docForm({
      title: 'New purchase order', subtitle: 'A dummy form: Post checks the draft and shows a toast. Leave the vendor empty and post to see the errors.',
      state: st.form, autofocus: false, backLabel: 'Close the form', submitLabel: 'Submit order',
      fields: [
        { key: 'vendorId', label: 'Vendor', type: 'party', kind: 'vendor', options: VENDORS, includeInactive: true, required: true, span: 2, hint: 'The deactivated vendor shows a refusal at this field' },
        { key: 'date', label: 'Order date', type: 'date', required: true, value: HB.calendar.today },
        { key: 'expectedDate', label: 'Expected on', type: 'date', max: null, min: HB.calendar.lockBefore, value: HB.dates.addDays(HB.calendar.today, 2) },
        { key: 'note', label: 'Note', type: 'text', optional: true, span: 4, placeholder: 'Anything the stores should know' }
      ],
      lines: { title: 'Items', columns: lineColumns(), rows: [{}], minRows: 1, addLabel: 'Add item' },
      totals: function (p) {
        return [
          { label: 'Lines', value: fmt.num(p ? p.lines : 0) },
          { label: 'Order value', sub: 'before GST', value: fmt.inr2(p ? p.total : 0), strong: true, rule: true },
          { label: 'Approval', value: p && p.total > PO_LIMIT ? 'Waits for the Owner' : 'Approved as submitted', tone: p && p.total > PO_LIMIT ? 'bad' : 'good' }
        ];
      },
      panel: function () { return forms.teaser({ title: 'GSTIN verification', tier: 'iNeo', text: 'The vendor is checked against the GST portal as the order is raised.' }); },
      onPreview: previewOrder,
      onSubmit: function (draft, form) {
        var p = previewOrder(draft, form);
        if (!p.ok) return p;
        st.form = null;
        forms.postedToast({ id: 'PO-U-0001', type: 'PO', status: p.total > PO_LIMIT ? 'PENDING' : 'APPROVED' }, 'Styleguide only: nothing was posted. Order value ' + fmt.inr2(p.total) + '.');
        ctx.rerender();
        return { ok: true };
      },
      onCancel: function () { st.form = null; ctx.rerender(); }
    });
  }

  /* ---------------------------------------------------------- document view */

  var INVOICE = {
    id: 'INV-260930-014', date: HB.calendar.today, customer: CUSTOMERS[3],
    lines: [
      { itemId: 'fg_sandwich', name: 'Sandwich bread', pack: '400 g', hsn: '1905 90 90', qty: 120, price: 3200, gstRate: 0, taxable: 384000, gst: 0, batch: 'B-260929-FG001' },
      { itemId: 'fg_pav', name: 'Ladi pav', pack: '12 pieces', hsn: '1905 90 90', qty: 80, price: 2800, gstRate: 0, taxable: 224000, gst: 0, batch: 'B-260929-FG004' },
      { itemId: 'fg_toast', name: 'Elaichi toast', pack: '250 g', hsn: '1905 40 00', qty: 36, price: 4400, gstRate: 5, taxable: 158400, gst: 7920, batch: 'B-260921-FG010' }
    ],
    taxable: 766400, gst: 7920, total: 774320
  };

  function invoiceSheet() {
    return forms.printSheet({
      title: 'Invoice-cum-bill of supply', number: INVOICE.id, date: INVOICE.date, copy: 'Original for recipient',
      seller: { name: 'Happy Bakers', lines: ['Vitthal Udyognagar, Anand, Gujarat', 'GSTIN 24AAAAA0000A1Z5 (sample)'] },
      party: { label: 'Bill to', name: INVOICE.customer.name, lines: [INVOICE.customer.locality, 'Place of supply: Gujarat (24)'] },
      meta: [['Terms', '15 days'], ['Due', HB.dates.label(HB.dates.addDays(INVOICE.date, 15), 'd MMM yyyy')]],
      columns: [{ key: 'name', label: 'Item' }, { key: 'hsn', label: 'HSN' }, { key: 'qty', label: 'Qty', format: 'num', align: 'right' }, { key: 'price', label: 'Rate', format: 'rate' },
        { key: 'gstRate', label: 'GST', align: 'right', format: function (v) { return v ? v + '%' : 'Nil'; } }, { key: 'taxable', label: 'Taxable', format: 'inr2' }],
      rows: INVOICE.lines, footer: { name: 'Total', taxable: INVOICE.taxable },
      totals: [{ label: 'Taxable value', value: fmt.inr2(INVOICE.taxable) }, { label: 'CGST', value: fmt.inr2(INVOICE.gst / 2) }, { label: 'SGST', value: fmt.inr2(INVOICE.gst / 2) },
        { label: 'Invoice total', value: fmt.inr2(INVOICE.total), strong: true, rule: true }],
      notes: ['Goods once sold are taken back only as stale returns at the next visit.', 'A sample document on invented data.']
    });
  }

  function viewOptions(compact) {
    return {
      compact: compact, title: 'Invoice ' + INVOICE.id, subtitle: INVOICE.customer.name + ' - ' + HB.dates.label(INVOICE.date, 'EEE d MMM'), status: 'POSTED',
      chips: [ui.chip('Corporate', 'info'), forms.statusChip('NOT_DUE')],
      onBack: function () { ui.toast('A page goes back to its list here: ctx.closeDoc()'); }, backLabel: 'Back to invoices',
      notice: { tone: 'info', title: 'A dummy document', text: 'docView shows a posted document: what it carries, what it moved, what rests on it and what may be done with it.' },
      meta: [['Customer', INVOICE.customer.name], ['Date', HB.dates.label(INVOICE.date, 'd MMM yyyy')], ['Terms', '15 days'], ['Sales order', forms.docLink('SO-260928-003')], ['Raised by', 'Hardik Thakkar']],
      lines: { title: 'Lines', columns: [
        { key: 'name', label: 'Item', render: ui.cells.twoLine('pack') },
        { key: 'batch', label: 'Batch' },
        { key: 'qty', label: 'Qty', format: 'num' },
        { key: 'price', label: 'Rate', format: 'rate' },
        { key: 'taxable', label: 'Taxable', format: 'inr2' },
        { key: 'gst', label: 'GST', format: 'inr2' }
      ], rows: INVOICE.lines, footer: { name: 'Total', qty: 236, taxable: INVOICE.taxable, gst: INVOICE.gst } },
      totals: [{ label: 'Taxable value', value: fmt.inr2(INVOICE.taxable) }, { label: 'GST', value: fmt.inr2(INVOICE.gst) }, { label: 'Invoice total', value: fmt.inr2(INVOICE.total), strong: true, rule: true },
        { label: 'Received', value: fmt.inr2(300000), tone: 'muted' }, { label: 'Open', value: fmt.inr2(INVOICE.total - 300000), strong: true }],
      related: [{ id: 'SO-260928-003', status: 'INVOICED', note: 'The order this invoice delivers' }, { id: 'RCPT-U-0001', status: 'POSTED', note: 'Part payment of ' + fmt.inr2(300000) }],
      timeline: [
        { actor: 'Falguni Shah', role: 'Accounts and admin', action: 'Receipt allocated', at: INVOICE.date + 'T11:42', note: 'RCPT-U-0001, by bank transfer' },
        { actor: 'Hardik Thakkar', role: 'Sales and dispatch', action: 'Invoice posted', to: 'POSTED', at: INVOICE.date + 'T09:05' }
      ],
      actions: [
        { label: 'Print invoice', icon: 'printer', variant: 'primary', onClick: function () { forms.printDoc(invoiceSheet(), { title: INVOICE.id }); } },
        { label: 'Reject', icon: 'x', onClick: function () {
          forms.confirmWithReason({ title: 'Reject this document?', message: 'The person who raised it sees your reason.', confirmLabel: 'Reject' })
            .then(function (res) { if (res.ok) ui.toast(res.reason, { title: 'Rejected (styleguide only)', tone: 'warn' }); });
        } },
        { label: 'Cancel invoice', icon: 'ban', danger: true, reason: 'A receipt is allocated to this invoice: cancel RCPT-U-0001 first.' }
      ]
    };
  }

  /* --------------------------------------------------- teasers, dialogs, print */

  function teaserCard() {
    return ui.card({ title: 'Teaser cards', subtitle: 'teaser({ title, tier, text }): one line, no figures, where a prospect would look for the feature.',
      body: ui.stack([
        forms.teaser({ title: 'Budget against actual', tier: 'iNeo', text: 'Set a monthly budget by category and location and see spend against it.' }),
        forms.teaser({ title: 'Sales forecast with suggested production', tier: 'NeoX', text: 'Tomorrow\'s demand by product, and the mixes to run for it.' }),
        forms.teaser({ title: 'Attendance and leave; tasks', tier: 'Neo ERP', text: 'Included in the tier. This sample leaves them out.' })
      ], 3) });
  }

  function dialogCard() {
    return ui.card({ title: 'Dialogs and toasts', subtitle: 'confirmWithReason, postedToast, fail, the wide drawer and printDoc.',
      body: ui.row([
        ui.button({ label: 'Cancel with a reason', icon: 'ban', onClick: function () {
          forms.confirmWithReason({ title: 'Cancel PO-U-0001?', message: 'A cancellation is a document of its own, dated today, with the reason you give.', confirmLabel: 'Cancel the order' })
            .then(function (res) { ui.toast(res.ok ? res.reason : 'Nothing was cancelled', { title: res.ok ? 'Reason collected' : 'Dismissed' }); });
        } }),
        ui.button({ label: 'Posted toast', icon: 'check', onClick: function () { forms.postedToast({ id: 'GRN-U-0002', type: 'GRN', status: 'POSTED' }, 'Stock up 500 kg. Maida now costs ' + fmt.rate(3925) + ' a kg.'); } }),
        ui.button({ label: 'Held toast', icon: 'clock', onClick: function () { forms.postedToast({ id: 'VBILL-U-0001', type: 'VBILL', status: 'HELD' }, 'The bill is 4.1% above its receipts and waits for the Owner.'); } }),
        ui.button({ label: 'Refusal toast', icon: 'alert-triangle', onClick: function () { forms.fail({ code: 'has_dependants', message: 'A goods receipt rests on this order. Cancel it first.', docId: 'GRN-260928-002' }, 'Not cancelled'); } }),
        ui.button({ label: 'Document in a wide drawer', icon: 'external', onClick: function () {
          var o = viewOptions(true);
          ui.drawer({ wide: true, title: o.title, subtitle: o.subtitle, body: forms.docView(o) });
        } }),
        ui.button({ label: 'Print the paper form', icon: 'printer', onClick: function () { forms.printDoc(invoiceSheet(), { title: INVOICE.id }); } })
      ], { wrap: true }) });
  }

  /* ------------------------------------------------------------------ page */

  HB.router.register({
    id: 'sys-styleguide',
    route: '#/system/styleguide',
    group: 'System',
    title: 'Styleguide',
    subtitle: 'The document kit, working on dummy rows',
    nav: false, icon: 'grid',
    filters: [],
    render: function (rootEl, ctx) {
      var st = ctx.state;
      ui.append(rootEl,
        ui.callout('info', 'For page authors and reviewers', 'Every component of HB.forms is on this page with dummy rows. Nothing is posted and nothing reads the data layer. The contract is docs/shell/UI-API.md.'),
        section('Inputs and pickers', 'qtyInput, rateInput, amountInput, dateInput, selectInput, partyPicker, itemPicker', inputsCard(st)),
        section('Status', 'statusChip, statusTabs, docList', ui.stack([statusCard(), listCard(st, ctx)])),
        section('Grids', 'lineGrid, matrixGrid', ui.stack([lineGridCard(st), matrixCard(st)])),
        section('Document form', 'docForm', formSection(st, ctx)),
        section('Document view', 'docView, with an action that is disabled and says why', forms.docView(viewOptions(false))),
        section('Teasers, dialogs, print', 'teaser, confirmWithReason, postedToast, fail, printSheet, printDoc', ui.stack([teaserCard(), dialogCard(),
          ui.card({ title: 'Paper form', subtitle: 'printSheet: what printDoc sends to the printer, shown here as a preview.', body: invoiceSheet() })])));
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
