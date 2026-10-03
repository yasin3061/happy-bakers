/*
 * Vendor bills (#/buy/bills). Receipts that still wait for a bill, the list of bills, the form of a new bill against
 * the goods receipts of one vendor, and the view of one bill with its three-way check and its payments.
 * Built on the pattern of js/pages/buy-orders.js (docs/PAGES.md). The three-way check, the GST, the due date and
 * where the bill lands are the engine's (HB.engine.preview); the page holds the wording and the layout.
 */
(function (root) {
  'use strict';

  var HB = root.HB;
  if (!HB || !HB.router || !HB.ui || !HB.forms) return;
  var ui = HB.ui, h = ui.h, forms = HB.forms, fmt = HB.fmt;

  function day(iso) { return ui.format('date', iso); }
  function item(id) { return HB.data.lookup.item(id); }
  function vendor(id) { return HB.data.lookup.vendor(id); }
  function percent(v) { return fmt.qty(v) + '%'; }
  /** How far a bill may be from its order and receipts before it is held. The figure is the master's. */
  function tolerance() { return percent(HB.masters.limits.billTolerancePct); }
  function gstText(v) { return v === null || v === undefined ? '-' : (v > 0 ? percent(v) : 'Nil'); }
  function overdueText(row) { return 'Overdue by ' + fmt.num(row.daysOverdue) + (row.daysOverdue === 1 ? ' day' : ' days'); }

  /** What is owed to a vendor now, as the payables selector holds it (nothing open: no row). */
  function owed(vendorId) {
    var row = HB.data.ap.balances().rows.filter(function (r) { return r.payeeId === vendorId; })[0];
    return row ? row.open : 0;
  }
  function owedText(vendorId, before) {
    var after = owed(vendorId), name = vendor(vendorId).name;
    return before === after ? 'Owed to ' + name + ': ' + fmt.inr2(after) + ', as before.'
      : 'Owed to ' + name + ': ' + fmt.inr2(before) + ' to ' + fmt.inr2(after) + '.';
  }

  /** The chip of a bill: its status while it waits, and how far it is paid once it is posted. */
  function stateChip(row) {
    if (row.status !== 'POSTED') return ui.statusChip(row.status);
    if (!(row.open > 0)) return ui.statusChip('PAID');
    if (row.overdue) return ui.statusChip('OVERDUE', { label: overdueText(row) });
    return ui.statusChip(row.paid > 0 ? 'PART_PAID' : 'UNPAID');
  }

  /* ------------------------------------------------------ the three-way check */

  /**
   * Order, receipt and bill, item by item: the rows of match.diffs as the engine worked them out (for a draft:
   * the preview's; for a posted bill: the stored ones). The page adds the item names and nothing else.
   */
  function threeWay(diffs) {
    var rows = (diffs || []).map(function (d) {
      var it = item(d.itemId);
      return { itemName: it.name, unit: it.unit, orderedRate: d.orderedRate, acceptedQty: d.acceptedQty, expected: d.expected,
        billedQty: d.billedQty, billedRate: d.billedRate, billed: d.billed, diff: d.diff, ok: d.ok };
    });
    return ui.table({
      dense: true, rows: rows, empty: 'Nothing to compare yet',
      columns: [
        { key: 'itemName', label: 'Item', maxWidth: 190 },
        /* receipts at two order rates give one expected value and no single rate: the engine keeps the last, so the cell says so */
        { key: 'orderedRate', label: 'Order rate', align: 'right', title: 'The rate of the purchase order', render: function (v, row) {
          if (!(v > 0)) return '-';
          if (HB.money.amount(row.acceptedQty, v) === row.expected) return fmt.rate(v);
          return h('span', { 'class': 'mk-muted', title: 'The receipts on this bill came at more than one order rate. The expected value is the sum of what each receipt accepted at its own rate.' }, 'Several rates');
        } },
        { key: 'acceptedQty', label: 'Accepted', format: 'qty', title: 'The quantity accepted on the goods receipts' },
        { key: 'expected', label: 'Expected', format: 'inr2', title: 'The accepted quantity at the order rate' },
        { key: 'billedQty', label: 'Billed', align: 'right', title: 'The quantity and the rate on the bill', render: function (v, row) {
          if (!(v > 0)) return h('span', { 'class': 'mk-muted' }, 'Not on the bill');
          var one = HB.money.amount(v, row.billedRate) === row.billed;     /* the item on two lines of the bill at two rates: no single rate */
          return h('div', null, h('div', null, fmt.qty(v, row.unit)), h('div', { 'class': 'mk-xs mk-muted' }, one ? 'at ' + fmt.rate(row.billedRate) : 'at several rates'));
        } },
        { key: 'billed', label: 'Billed value', format: 'inr2' },
        { key: 'ok', label: 'Check', render: function (v, row) {
          var gap = row.diff > 0 ? fmt.inr2(row.diff) + ' more' : (row.diff < 0 ? fmt.inr2(-row.diff) + ' less' : '');
          return h('div', null, ui.statusChip(v ? 'MATCHED' : 'MISMATCH'), gap ? h('div', { 'class': 'mk-xs mk-muted' }, 'Billed ' + gap) : null);
        } }
      ]
    });
  }

  /* ------------------------------------------------------------------ list */

  function start(st, ctx, values) { st.form = forms.draft(values ? { values: values } : null); ctx.rerender(); }

  function unbilledCard(st, ctx, may) {
    return ui.card({
      title: 'Receipts waiting for a bill', subtitle: 'Goods received and not billed yet, of every vendor', flush: true,
      body: ui.table({
        dense: true, rows: HB.data.buy.openReceipts(), empty: 'Every goods receipt is billed', maxHeight: 280,
        columns: [
          { key: 'id', label: 'Receipt', doc: true },
          { key: 'date', label: 'Received on', format: 'date' },
          { key: 'vendorName', label: 'Vendor', maxWidth: 240 },
          { key: 'poId', label: 'Order', doc: true },
          { key: 'value', label: 'Value accepted', format: 'inr2' },
          { key: 'act', label: '', align: 'right', sortable: false, render: function (v, row) {
            return ui.button({ label: 'Enter the bill', icon: may.ok ? 'receipt' : 'lock', size: 'sm', disabledReason: may.ok ? '' : may.reason,
              onClick: function () { start(st, ctx, { vendorId: row.vendorId, grnIds: [row.id] }); } });
          } }
        ]
      })
    });
  }

  function list(rootEl, ctx) {
    var st = ctx.state, may = HB.session.can('vbill.create');
    st.list = st.list || {};
    /* a bill that is held or not paid yet is listed whatever the date range says; the range limits the finished ones */
    var rows = forms.uniqueRows(HB.data.buy.bills({ status: 'HELD' }), HB.data.buy.bills({ open: true }), HB.data.buy.bills(ctx.filters));
    rootEl.appendChild(unbilledCard(st, ctx, may));
    rootEl.appendChild(forms.docList({
      state: st.list, rows: rows, title: 'Bills',
      subtitle: 'Held and unpaid bills are always listed. The date range applies to paid, rejected and cancelled ones.',
      groups: [
        { id: 'HELD', label: 'Held', statuses: ['HELD'] },
        { id: 'unpaid', label: 'To pay', test: function (r) { return r.status === 'POSTED' && r.open > 0; } },
        { id: 'paid', label: 'Paid', test: function (r) { return r.status === 'POSTED' && !(r.open > 0); } },
        { id: 'REJECTED', label: 'Rejected', statuses: ['REJECTED'] },
        { id: 'CANCELLED', label: 'Cancelled', statuses: ['CANCELLED'] }
      ],
      search: ['id', 'vendorName', 'billNo', 'note'], searchPlaceholder: 'Search bills', sort: { key: 'date', dir: 'desc' },
      empty: 'No vendor bill in this range',
      columns: [
        { key: 'id', label: 'Bill' },
        { key: 'date', label: 'Bill date', format: 'date' },
        { key: 'vendorName', label: 'Vendor and bill number', render: ui.cells.twoLine('billNo', { maxWidth: 230 }) },
        { key: 'total', label: 'Total', format: 'inr2' },
        { key: 'open', label: 'Still to pay', format: 'inr2' },
        { key: 'dueDate', label: 'Due on', format: 'date' },
        { key: 'status', label: 'Status', render: function (v, row) { return stateChip(row); } }
      ],
      newLabel: 'New vendor bill', newReason: may.ok ? '' : may.reason,
      onNew: function () { start(st, ctx, null); }
    }));
  }

  /* ------------------------------------------------------------------ form */

  /** The receipts of the draft's vendor that are on no bill, as the selector gives them now. */
  function receiptsOf(draft) { return draft.values.vendorId ? HB.data.buy.openReceipts(draft.values.vendorId) : []; }

  /**
   * The lines of the bill follow the ticked receipts: what was accepted, at the order's rate, one line per item and
   * rate. Done once per choice of receipts, so a redraw keeps what was typed; lines the user added stay.
   */
  function fill(draft) {
    var v = draft.values, open = receiptsOf(draft), at = {}, lines = [];
    var ids = open.map(function (r) { return r.id; }).filter(function (id) { return (v.grnIds || []).indexOf(id) !== -1; });
    var key = (v.vendorId || '') + '|' + ids.join(',');
    if (draft.linesFor === key) return;
    open.forEach(function (r) {
      if (ids.indexOf(r.id) === -1) return;
      r.lines.forEach(function (l) {
        var k = l.itemId + '@' + l.rate;
        if (at[k] === undefined) { at[k] = lines.length; lines.push({ itemId: l.itemId, qty: l.qty, rate: l.rate, gstRate: l.gstRate, fromReceipt: true }); }
        else lines[at[k]].qty = HB.q3(lines[at[k]].qty + l.qty);
      });
    });
    v.grnIds = ids;
    draft.lines = lines.concat((draft.lines || []).filter(function (l) { return !l.fromReceipt && l.itemId; }));
    draft.linesFor = key;
  }

  /** The receipts to tick: a table with a box per receipt. Ticking one rebuilds the lines from what was accepted. */
  function receiptPicker(draft, form) {
    if (!draft.values.vendorId) return h('div', { 'class': 'mk-muted' }, 'Choose a vendor to see its goods receipts that are not billed yet.');
    var open = receiptsOf(draft);
    if (!open.length) return h('div', { 'class': 'mk-muted' }, 'No goods receipt of this vendor is waiting for a bill. A bill is entered against goods already received.');
    function tick(id, on) {
      var ids = (draft.values.grnIds || []).filter(function (x) { return x !== id; });
      if (on) ids.push(id);
      draft.values.grnIds = ids;
      draft.touched.grnIds = true;
      draft.dirty = true;
      fill(draft);
      form.rebuild();
    }
    return ui.table({
      dense: true, rows: open,
      columns: [
        { key: 'tick', label: 'On this bill', sortable: false, render: function (x, row) {
          var box = ui.form.checkbox({ label: 'Bill it', checked: (draft.values.grnIds || []).indexOf(row.id) !== -1, onChange: function (on) { tick(row.id, on); } });
          box.input.setAttribute('data-fkey', 'f:grnIds:' + row.id);
          return box;
        } },
        { key: 'id', label: 'Receipt', doc: true },
        { key: 'date', label: 'Received', format: 'date' },
        { key: 'poId', label: 'Order', doc: true },
        { key: 'lines', label: 'Goods accepted', maxWidth: 280, render: function (lines) {
          return lines.map(function (l) { return l.itemName + ' ' + fmt.qty(l.qty, l.unit); }).join(', ');
        } },
        { key: 'value', label: 'Value', format: 'inr2', title: 'The accepted quantity at the order rate' }
      ]
    });
  }

  /** draft -> the payload of docs/API.md 3.5. form.lines() leaves out the lines nothing was typed into. */
  function payload(draft, form) {
    var v = draft.values;
    return {
      date: v.date, vendorId: v.vendorId, billNo: v.billNo, grnIds: (v.grnIds || []).slice(), note: v.note,
      lines: form.lines().map(function (l) {
        var line = { itemId: l.itemId, qty: l.qty || 0, rate: l.rate || 0 };
        if (l.gstRate !== undefined && l.gstRate !== null) line.gstRate = l.gstRate;
        return line;
      })
    };
  }

  /**
   * The dry run of the draft. The check, the GST and the totals are the engine's, and it asks for the bill number
   * before it works them out. So while only the number is still to be typed, or is one already entered, the same
   * dry run is asked once more with a stand-in for it, for the figures alone: what is shown as refused, and what
   * would be posted, stay those of the draft as it is.
   */
  function preview(draft, form) {
    var p = HB.engine.preview('VBILL', payload(draft, form)), q = p;
    if (!p.ok && p.error && p.error.field === 'billNo') {
      var again = payload(draft, form);
      again.billNo = '(number not entered yet)';
      q = HB.engine.preview('VBILL', again);
    }
    return { ok: p.ok, preview: true, error: p.error, warnings: p.warnings, doc: p.doc, outcome: p.outcome, figures: q.ok ? q.doc : null };
  }

  /** The line of the previewed bill that a grid row became: the engine keeps the lines as sent, so item, quantity and rate name it. */
  function billed(p, row) {
    var lines = p && p.figures ? p.figures.lines : [];
    for (var i = 0; i < lines.length; i++) if (lines[i].itemId === row.itemId && lines[i].qty === row.qty && lines[i].rate === row.rate) return lines[i];
    return null;
  }

  /** Where the bill will land, in words: preview.outcome and the engine's own check. */
  function outcome(p) {
    var o = p && p.ok ? p.outcome : null;
    if (!o) return { tone: 'neutral', short: '-', title: 'Three-way check',
      text: 'Each item on the bill is compared with the quantity accepted at the rate of the order. A bill more than ' + tolerance() + ' away, either way, is held for the Owner.' + (p && p.figures ? '' : ' The check appears once the bill has a vendor and its receipts.') };
    if (o.waits) return { tone: 'warn', short: 'Held for the Owner', title: 'Does not match: held for the Owner',
      text: 'An item is more than ' + tolerance() + ' away from its order and receipts. Nothing is owed to the vendor until the Owner approves the bill.' };
    if (o.self) return { tone: 'info', short: 'Approved as your own', title: 'Does not match: approved as your own bill',
      text: 'An item is more than ' + tolerance() + ' away from its order and receipts. As the Owner you approve the bill as you post it, and the audit log says so.' };
    return { tone: 'good', short: 'Posts as entered', title: 'Matches: posts as it is entered',
      text: 'Every item is within ' + tolerance() + ' of its order and receipts. The amount is owed to the vendor from the moment the bill is posted.' };
  }

  /** The one line of the toast: what the bill did to what is owed. A bill moves neither stock nor a purchase price. */
  function landed(doc, before) {
    if (doc.status === 'HELD') return 'It is held for the Owner: ' + doc.holdReason + '. Nothing is owed on it until it is approved.';
    var lead = doc.approval && doc.approval.self ? 'It did not match and you approved it as your own bill. ' : '';
    return lead + owedText(doc.vendorId, before) + ' Due on ' + day(doc.dueDate) + '. Stock and purchase prices do not move on a bill.';
  }

  function form(rootEl, ctx) {
    var st = ctx.state, draft = st.form, may = HB.session.can('vbill.create');
    fill(draft);
    function unit(row) { return row.itemId ? item(row.itemId).unit : ''; }
    rootEl.appendChild(forms.docForm({
      title: 'New vendor bill', state: draft, backLabel: 'Back to bills', submitLabel: 'Post bill',
      submitReason: may.ok ? '' : may.reason,
      fields: [
        { key: 'vendorId', label: 'Vendor', type: 'party', kind: 'vendor', required: true, span: 2, rebuild: true,
          filter: function (v) { return v.kind === 'stock'; },
          onChange: function (id, d) { d.values.grnIds = []; d.lines = []; fill(d); } },   /* the receipts and the lines belong to the vendor */
        { key: 'billNo', label: 'Bill number', required: true, maxLength: 40, placeholder: 'As printed on the vendor bill',
          hint: 'A bill number is entered once for a vendor' },
        { key: 'date', label: 'Bill date', type: 'date', required: true },
        { key: 'grnIds', label: 'Goods receipts on this bill', type: 'custom', required: true, span: 4, control: receiptPicker },
        { key: 'note', label: 'Note', optional: true, span: 4, maxLength: 200, placeholder: 'Anything the Owner should know about this bill' }
      ],
      lines: {
        title: 'Items on the bill', subtitle: 'They start at what was accepted, at the order\'s rates. Change them to what the bill says.',
        addLabel: 'Add item', empty: 'Tick a goods receipt to bring in its items',
        columns: [
          { key: 'itemId', label: 'Item', type: 'item', kind: ['rm', 'pk'], required: true, width: '26%',
            readOnly: function (row) { return !!row.fromReceipt; },
            onChange: function (row, id) { row.rate = id ? (HB.engine.price(id) || null) : null; row.gstRate = null; } },
          { key: 'qty', label: 'Billed quantity', type: 'qty', required: true, unit: unit },
          { key: 'rate', label: 'Billed rate', type: 'rate', required: true },
          /* the value of a line as it is typed: HB.money.amount, the function the engine itself calls. Tax and totals come from the preview. */
          { key: 'taxable', label: 'Before GST', type: 'computed', format: 'inr2', footer: 'sum',
            value: function (row) { return row.qty > 0 && row.rate > 0 ? HB.money.amount(row.qty, row.rate) : null; } },
          { key: 'gst', label: 'GST rate', type: 'computed', align: 'right', title: 'The rate of the item, as on the order',
            format: function (v) { return gstText(v); },
            value: function (row) { return !row.itemId ? null : (row.gstRate === undefined || row.gstRate === null ? item(row.itemId).gstRate : row.gstRate); } },
          { key: 'cgst', label: 'CGST', type: 'computed', format: 'inr2', footer: 'sum', value: function (row, i, p) { var l = billed(p, row); return l ? l.cgst : null; } },
          { key: 'sgst', label: 'SGST', type: 'computed', format: 'inr2', footer: 'sum', value: function (row, i, p) { var l = billed(p, row); return l ? l.sgst : null; } }
        ]
      },
      panel: function (p) {
        var o = outcome(p), doc = p ? p.figures : null;
        return [
          ui.callout(o.tone, o.title, o.text),
          doc ? ui.card({ title: 'Order, receipt and bill, item by item', flush: true, body: threeWay(doc.match.diffs) }) : null
        ];
      },
      totals: function (p, d) {
        var doc = p ? p.figures : null, o = outcome(p), terms = d.values.vendorId ? vendor(d.values.vendorId).termsDays : null;
        return [
          { label: 'Before GST', value: doc ? fmt.inr2(doc.taxable) : '-' },
          { label: 'GST', sub: 'CGST and SGST, taken as input credit', value: doc ? fmt.inr2(doc.gst) : '-' },
          { label: 'Bill total', sub: 'owed to the vendor', value: doc ? fmt.inr2(doc.total) : '-', strong: true, rule: true },
          { label: 'Due on', sub: terms === null || terms === undefined ? 'by the vendor\'s payment terms' : fmt.num(terms) + ' days from the bill date, the vendor\'s terms',
            value: doc ? day(doc.dueDate) : '-' },
          { label: 'On posting', value: o.short, tone: o.tone === 'good' ? 'good' : (o.tone === 'warn' ? 'bad' : 'muted') }
        ];
      },
      onPreview: preview,
      onSubmit: function (d, f) {
        var before = owed(d.values.vendorId);       /* read the selector, act, read it again: that is what moved */
        var res = HB.engine.act('post', { type: 'VBILL', payload: payload(d, f) });
        if (!res.ok) return res;                      /* the form shows the refusal at the field it names */
        st.form = null;
        forms.postedToast(res.doc, landed(res.doc, before));
        ctx.openDoc(res.doc.id);
        return res;
      },
      onCancel: function () { st.form = null; ctx.rerender(); }
    }));
  }

  /* ------------------------------------------------------------------ view */

  /** "Pay this bill": opens the payment form for the vendor with this bill filled in. The right to pay is the session's. */
  function payAction(v, row) {
    if (v.status !== 'POSTED' || !(row.open > 0)) return null;
    var may = HB.session.can('pay.create');
    return { label: 'Pay this bill', icon: 'wallet', variant: 'primary', reason: may.ok ? '' : may.reason,
      onClick: function () { forms.startDraft('buy-payments', { values: { payeeType: 'vendor', payeeId: v.doc.vendorId, only: v.id } }); } };
  }

  function view(rootEl, ctx) {
    var v = HB.data.doc.view(ctx.docId);
    if (!v || v.type !== 'VBILL') { rootEl.appendChild(forms.missingDoc(ctx.docId, { onBack: ctx.closeDoc, backLabel: 'Back to bills' })); return; }
    var d = v.doc, a = v.approval || {};
    var row = HB.data.buy.bills({ from: v.date, to: v.date }).filter(function (r) { return r.id === v.id; })[0] || {};
    var links = HB.data.doc.related(v.id);
    var payments = links.filter(function (r) { return r.relation === 'settlement'; });
    var others = forms.relatedOf(v.id).filter(function (r) { return !payments.some(function (p) { return p.id === r.id; }); });

    var actions = forms.docActions({
      view: v, labels: { approve: 'Approve the bill', reject: 'Reject the bill', cancel: 'Cancel the bill' },
      ask: { cancel: 'What is owed on this bill and its GST input credit are taken back, and its goods receipts can be billed again.' },
      before: function () { return owed(d.vendorId); },
      moved: function (op, res, before) {
        if (op === 'approve') return owedText(d.vendorId, before) + ' Due on ' + day(d.dueDate) + '.';
        if (op === 'reject') return (res.doc.approval && res.doc.approval.reason ? res.doc.approval.reason + '. ' : '') + 'Its goods receipts can be billed again.';
        if (op === 'cancel') return owedText(d.vendorId, before) + ' Its goods receipts can be billed again. ' + res.doc.id + ' records the cancellation.';
        return '';
      }
    });
    var pay = payAction(v, row);
    if (pay) actions.unshift(pay);

    var notice = forms.docNotice(v, { waiting: 'An item is more than ' + tolerance() + ' away from its order and receipts. Nothing is owed on the bill until it is approved.' });
    if (!notice && d.opening) notice = { tone: 'info', title: 'Opening balance', text: 'What was owed to the vendor on the day Neo ERP went live. It has no goods receipts and no GST.' };
    if (!notice && a.state === 'approved') notice = { tone: 'info', title: 'It did not match and was approved by ' + (a.byName || 'the Owner') + ' on ' + day(String(a.at || '').slice(0, 10)),
      text: a.self ? 'The Owner approved the Owner\'s own bill.' : null };

    rootEl.appendChild(forms.docView({
      title: forms.docTitle(v), subtitle: v.party.name, status: v.status === 'POSTED' ? stateChip(row) : v.status,
      chips: v.status === 'POSTED' && !d.opening ? [ui.statusChip(d.match.ok ? 'MATCHED' : 'MISMATCH')] : null,
      onBack: ctx.closeDoc, backLabel: 'Back to bills', notice: notice,
      meta: [['Vendor', v.party.name], ['Bill number', d.billNo], ['Bill date', day(v.date)], ['Due on', day(d.dueDate)],
        ['Goods receipts', d.grnIds.length ? h('span', null, d.grnIds.map(function (id, i) { return [i ? ', ' : '', forms.docLink(id)]; })) : null],
        ['Entered by', v.createdByName], ['Note', v.note || null]],
      lines: d.opening ? null : {
        title: 'Items on the bill',
        columns: [
          { key: 'itemName', label: 'Item' },
          { key: 'qty', label: 'Billed quantity', format: 'qty' },
          { key: 'rate', label: 'Billed rate', format: 'rate' },
          { key: 'taxable', label: 'Before GST', format: 'inr2' },
          { key: 'gstRate', label: 'GST rate', align: 'right', format: function (x) { return gstText(x); } },
          { key: 'cgst', label: 'CGST', format: 'inr2' },
          { key: 'sgst', label: 'SGST', format: 'inr2' }
        ],
        rows: v.lines, footer: { itemName: 'Total', taxable: d.taxable }
      },
      totals: [
        d.opening ? null : { label: 'Before GST', value: fmt.inr2(d.taxable) },
        d.opening ? null : { label: 'GST', sub: 'CGST and SGST, taken as input credit', value: fmt.inr2(d.gst) },
        { label: 'Bill total', value: fmt.inr2(d.total), strong: true, rule: !d.opening },
        v.status === 'POSTED' ? { label: 'Paid so far', value: fmt.inr2(d.paid), tone: 'muted' } : null,
        v.status === 'POSTED' ? { label: 'Still to pay', value: fmt.inr2(row.open), strong: true } : null
      ],
      sections: [
        d.opening ? null : { title: 'Order, receipt and bill, item by item', flush: true,
          subtitle: 'A bill is held when an item is more than ' + tolerance() + ' away from its order and receipts, either way.',
          body: threeWay(d.match.diffs) },
        { title: 'Payments', flush: true, body: ui.table({
          dense: true, rows: payments, empty: v.status === 'POSTED' ? 'No payment against this bill yet' : 'A bill is paid once it is posted',
          columns: [
            { key: 'id', label: 'Payment', doc: true },
            { key: 'date', label: 'Paid on', format: 'date' },
            { key: 'amount', label: 'Paid against this bill', format: 'inr2' },
            { key: 'status', label: 'Status', render: ui.cells.status() }
          ]
        }) }
      ],
      related: others, timeline: forms.timelineOf(v.id), actions: actions
    }));
  }

  /* ------------------------------------------------------------------ page */

  HB.router.register({
    id: 'buy-bills', route: '#/buy/bills', group: 'Buy', title: 'Vendor bills', filters: ['date'],
    render: function (rootEl, ctx) {
      if (ctx.docId) return view(rootEl, ctx);
      if (ctx.state.form) return form(rootEl, ctx);
      list(rootEl, ctx);
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
