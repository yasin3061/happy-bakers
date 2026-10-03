/*
 * Receipts (#/sell/receipts). The list of receipts, the form of a new receipt against a customer's open invoices
 * (what is not set against an invoice stays on account), the view of one receipt, and the customer statement with
 * its paper form. Built on the pattern of js/pages/buy-orders.js (docs/PAGES.md).
 * What is open, what stays on account and every balance are the data layer's and the engine's; the page holds the
 * wording and the layout.
 */
(function (root) {
  'use strict';

  var HB = root.HB;
  if (!HB || !HB.router || !HB.ui || !HB.forms) return;
  var ui = HB.ui, h = ui.h, forms = HB.forms, fmt = HB.fmt;

  /* how the money came, by the kind of account it went into; the engine stores the word as it is given */
  var MODES = {
    cash: [{ value: 'cash', label: 'Cash' }],
    bank: [{ value: 'NEFT', label: 'NEFT' }, { value: 'UPI', label: 'UPI' }, { value: 'Cheque', label: 'Cheque' }]
  };
  var MODE_LABELS = { cash: 'Cash', bank: 'Bank transfer' };

  function day(iso) { return ui.format('date', iso); }
  function plural(n, one, many) { return fmt.num(n) + ' ' + (n === 1 ? one : many); }
  /** The first two of a list in words, and how many more there are. */
  function few(list) { return list.slice(0, 2).join(', ') + (list.length > 2 ? ' and ' + fmt.num(list.length - 2) + ' more' : ''); }
  function customer(id) { return HB.data.lookup.customer(id); }
  function account(id) { return HB.data.lookup.account(id); }
  function accountName(id) { return id ? account(id).name : ''; }
  function modeLabel(mode) { return MODE_LABELS[mode] || mode || '-'; }
  function modesOf(accountId) { return accountId ? (MODES[account(accountId).kind] || []) : []; }
  function overdueText(x) { return plural(x.daysOverdue, 'day', 'days') + ' overdue'; }
  /** The customer's terms in words; credit terms say for how many days. The days are the master's. */
  function termsText(c) {
    if (!c || !c.termsLabel) return null;
    return c.terms === 'credit' && c.creditDays > 0 ? c.termsLabel + ', ' + plural(c.creditDays, 'day', 'days') : c.termsLabel;
  }
  /** An amount of a statement column: nothing where nothing was invoiced or received; a cancellation is a negative figure in the column of what it cancels. */
  function sum(v) { return v ? fmt.inr2(v) : ''; }

  /** What the receivables hold for one customer now, or null when nothing is open and no credit is unapplied. */
  function owedBy(customerId) {
    return HB.data.ar.balances().rows.filter(function (r) { return r.customerId === customerId; })[0] || null;
  }

  /**
   * The accounts a receipt may go into: the factory's cash and the bank. Any other the engine refuses. The list is
   * the masters' own: a role with no cash book (sales) still has to say where the money went, and sees no balance.
   */
  function receiptAccounts() {
    var factory = HB.data.lookup.units({ kind: 'factory' })[0], cashId = factory ? factory.cashAccountId : null;
    var held = HB.data.cash.balances().rows;
    return (HB.masters.accounts || []).filter(function (a) { return a.active !== false && (a.id === cashId || a.kind !== 'cash'); }).map(function (a) {
      var b = held.filter(function (r) { return r.accountId === a.id; })[0];
      return { value: a.id, label: a.name + (b ? ', ' + fmt.inr2(b.balance) + ' in it now' : '') };
    });
  }

  /* ------------------------------------------------------- what a receipt moves */

  /** Read before and after the engine acts: the cash and bank balances, and what each customer owes. */
  function snapshot() { return { cash: HB.data.cash.balances().rows, ar: HB.data.ar.balances().rows }; }
  function balanceIn(rows, customerId) {
    var row = rows.filter(function (r) { return r.customerId === customerId; })[0];
    return row ? row.balance : 0;
  }

  /** The one line of the toast: the account that moved and what the customer owes, as the selectors returned them before and return now. */
  function movedText(rcpt, before, cancelled) {
    var after = snapshot(), parts = [];
    var moved = forms.changes(before.cash, after.cash, 'accountId', 'balance');
    moved.forEach(function (c) { parts.push(c.row.name + ': ' + fmt.inr2(c.before) + ' to ' + fmt.inr2(c.after) + '.'); });
    if (!moved.length) parts.push(fmt.inr2(rcpt.amount) + (cancelled ? ' has left ' : ' went into ') + accountName(rcpt.account) + (cancelled ? ' again.' : '.'));
    parts.push('Balance of ' + customer(rcpt.customerId).name + ': ' + fmt.inr2(balanceIn(before.ar, rcpt.customerId)) + ' to ' + fmt.inr2(balanceIn(after.ar, rcpt.customerId)) + '.');
    if (cancelled) {
      if (rcpt.allocations.length) parts.push('Open again: ' + few(rcpt.allocations.map(function (a) { return a.docId; })) + '.');
    } else if (rcpt.onAccount > 0) {
      parts.push(fmt.inr2(rcpt.onAccount) + ' stays on account as credit for the next invoice.');
    }
    return parts.join(' ');
  }

  /* ------------------------------------------------------------------ list */

  function start(st, ctx, values) { st.form = forms.draft(values ? { values: values } : null); ctx.rerender(); }

  /**
   * A link may open the statement: '?tab=statement', and for one customer '&customer=<id>' (or '?customer=<id>' alone).
   * It is taken once per link, so the tabs and the picker stay free; a choice on the screen drops the link.
   */
  function fromLink(st, ctx) {
    var p = ctx.params, key = (p.tab || '') + '|' + (p.customer || '');
    if (key === st.link) return;
    st.link = key;
    if (p.tab === 'statement' || p.customer) { st.tab = 'statement'; if (p.customer) st.customerId = p.customer; }
    else if (p.tab === 'receipts') st.tab = 'receipts';
  }
  function dropLink(ctx) {
    if (ctx.params.tab || ctx.params.customer) { HB.router.navigate('sell-receipts', null, { replace: true }); return true; }
    return false;
  }

  function tabs(st, ctx) {
    return ui.tabs({
      items: [{ id: 'receipts', label: 'Receipts' }, { id: 'statement', label: 'Customer statement' }],
      value: st.tab === 'statement' ? 'statement' : 'receipts', ariaLabel: 'Receipts or a customer statement',
      onChange: function (id) { st.tab = id; if (!dropLink(ctx)) ctx.rerender(); }
    });
  }

  function list(rootEl, ctx) {
    var st = ctx.state, may = HB.session.can('rcpt.create');
    st.list = st.list || {};
    rootEl.appendChild(forms.docList({
      state: st.list, rows: HB.data.sell.receipts(ctx.filters),
      subtitle: 'Money received from customers after delivery. Cash taken with a cash invoice is on the invoice.',
      statuses: ['POSTED', 'CANCELLED'],
      search: ['id', 'customerName', 'accountName', 'mode', 'note'], searchPlaceholder: 'Search receipts', sort: { key: 'date', dir: 'desc' },
      empty: 'No receipt in this range',
      columns: [
        { key: 'id', label: 'Receipt' },
        { key: 'date', label: 'Received on', format: 'date' },
        { key: 'customerName', label: 'Customer', render: ui.cells.twoLine(function (r) { return modeLabel(r.mode) + ', into ' + r.accountName; }, { maxWidth: 220 }) },
        /* what stayed on account rides under the amount, so that six columns fit the narrowest window */
        { key: 'amount', label: 'Amount', align: 'right', render: function (v, row) {
          return h('div', null, h('div', null, fmt.inr2(v)), row.onAccount > 0 ? h('div', { 'class': 'mk-xs mk-muted' }, fmt.inr2(row.onAccount) + ' on account') : null);
        } },
        { key: 'status', label: 'Status', render: ui.cells.status() }
      ],
      newLabel: 'New receipt', newReason: may.ok ? '' : may.reason,
      onNew: function () { start(st, ctx, null); }
    }));
  }

  /* ------------------------------------------------------------- statement */

  /** The rows of a statement as a table shows them: the balance brought forward first, then every entry. */
  function statementRows(s) {
    return [{ date: s.from, kindLabel: 'Balance brought forward', balance: s.opening, lead: true }].concat(s.rows);
  }

  function what(row) { return row.reversal && row.note ? row.note : row.kindLabel; }

  /**
   * The same on screen, in a narrow column: a cancellation names the document it cancelled, with the reason that
   * document carries under it. Both lines are cut with an ellipsis and keep the full text as the tooltip.
   */
  function whatCell(row) {
    if (!(row.reversal && row.refId)) return row.kindLabel;
    var target = HB.data.doc.get(row.refId), reason = target && target.cancelled ? target.cancelled.reason : '';
    return h('div', { 'class': 'mk-cell-clip', style: { maxWidth: '190px' } },
      h('div', { title: what(row) }, 'Cancellation of ' + row.refId),
      reason ? h('div', { 'class': 'mk-xs mk-muted', title: reason }, reason) : null);
  }

  function statementColumns() {
    return [
      { key: 'date', label: 'Date', format: 'date' },
      { key: 'docId', label: 'Document', doc: true },
      { key: 'kindLabel', label: 'What', render: function (v, row) { return whatCell(row); } },
      { key: 'invoiced', label: 'Invoiced', align: 'right', format: sum },
      { key: 'settled', label: 'Paid or credited', align: 'right', format: sum },
      { key: 'balance', label: 'Balance', format: 'inr2' }
    ];
  }

  /** The statement on paper: the same rows, with the customer's address and what is still open. */
  function statementPaper(s, owed) {
    var c = customer(s.customerId);
    return forms.printSheet({
      title: 'Statement of account', date: s.to,
      party: { label: 'Customer', name: c.name, lines: [c.locality, c.gstin ? 'GSTIN ' + c.gstin : null] },
      meta: [['Period', HB.filters.rangeLabel(s)], ['Terms', termsText(c)]].filter(function (p) { return p[1]; }),
      columns: [
        { key: 'date', label: 'Date', format: 'date' },
        { key: 'docId', label: 'Document' },
        { key: 'kindLabel', label: 'What', value: what },
        { key: 'invoiced', label: 'Invoiced', align: 'right', format: sum },
        { key: 'settled', label: 'Paid or credited', align: 'right', format: sum },
        { key: 'balance', label: 'Balance', format: 'inr2' }
      ],
      rows: statementRows(s), footer: { date: 'Closing balance', invoiced: s.invoiced, settled: s.settled, balance: s.closing },
      totals: [
        { label: 'Balance brought forward', value: fmt.inr2(s.opening) },
        { label: 'Invoiced', value: fmt.inr2(s.invoiced) },
        { label: 'Paid or credited', value: fmt.inr2(s.settled) },
        { label: 'Closing balance', sub: 'on ' + day(s.to), value: fmt.inr2(s.closing), strong: true, rule: true }
      ],
      notes: [
        owed && owed.open > 0 ? 'Open invoices today: ' + fmt.inr2(owed.open) + ' on ' + plural(owed.items, 'invoice', 'invoices') + '.' : null,
        owed && owed.overdue > 0 ? 'Past the due date: ' + fmt.inr2(owed.overdue) + '.' : null,
        s.creditNow > 0 ? 'Credit not yet applied: ' + fmt.inr2(s.creditNow) + '.' : null
      ],
      signatory: false
    });
  }

  /** The paper form in a dialog, with the button that sends it to the browser's print. */
  function showPaper(title, sheet, job) {
    var dlg = ui.modal({ title: title, size: 'xl', body: sheet, footer: [
      ui.button({ label: 'Close', variant: 'ghost', onClick: function () { dlg.close(); } }),
      ui.button({ label: 'Print', icon: 'printer', variant: 'primary', onClick: function () { forms.printDoc(sheet, { title: job }); } })
    ] });
  }

  function statement(rootEl, ctx) {
    var st = ctx.state, id = st.customerId || null, may = HB.session.can('rcpt.create');
    var s = id ? HB.data.ar.statement(id, { from: ctx.filters.from, to: ctx.filters.to }) : null;
    var owed = id ? owedBy(id) : null;
    var picker = forms.partyPicker({ kind: 'customer', value: id, includeInactive: true, placeholder: 'Search customers', ariaLabel: 'Customer',
      onChange: function (cid) { st.customerId = cid; if (!dropLink(ctx)) ctx.rerender(); } });

    rootEl.appendChild(ui.card({
      title: 'Customer statement', subtitle: 'Invoices, cash collected, receipts and stale returns of one customer, with a running balance',
      body: ui.grid([6, 6], [
        ui.form.field({ label: 'Customer', control: picker, hint: 'The date range above sets the period of the statement.' }),
        h('div', { 'class': 'mk-row mk-row--end mk-row--wrap' },
          ui.button({ label: 'Receive payment', icon: may.ok ? 'coins' : 'lock', disabledReason: !id ? 'Choose a customer first' : (may.ok ? '' : may.reason),
            onClick: function () { start(st, ctx, { customerId: id }); } }),
          ui.button({ label: 'Print statement', icon: 'printer', variant: 'primary', disabledReason: s ? '' : 'Choose a customer first',
            onClick: function () { showPaper('Statement of ' + s.customerName, statementPaper(s, owed), 'Statement ' + s.customerName); } }))
      ])
    }));
    if (!s) {
      rootEl.appendChild(ui.emptyState('Choose a customer', 'The statement lists what was invoiced, received and credited in the date range, and what is open today.', { icon: 'book' }));
      return;
    }

    rootEl.appendChild(ui.kpiRow([
      { label: 'Owed on ' + day(s.from), value: fmt.inr2(s.opening), sub: 'brought forward' },
      { label: 'Invoiced', value: fmt.inr2(s.invoiced), sub: HB.filters.rangeLabel(s) },
      { label: 'Paid or credited', value: fmt.inr2(s.settled), sub: 'cash, receipts and stale returns' },
      { label: 'Owed on ' + day(s.to), value: fmt.inr2(s.closing), sub: 'closing balance' }
    ]));

    rootEl.appendChild(ui.card({
      title: 'Statement', subtitle: s.customerName + ', ' + HB.filters.rangeLabel(s), flush: true,
      body: ui.table({
        dense: true, columns: statementColumns(), rows: statementRows(s), maxHeight: 520,
        rowClass: function (r) { return r.lead ? 'is-strong' : (r.reversal ? 'is-muted' : ''); },
        footer: { kindLabel: 'Closing balance', invoiced: s.invoiced, settled: s.settled, balance: s.closing }
      })
    }));

    rootEl.appendChild(ui.card({
      title: 'Open invoices today', flush: true,
      subtitle: 'Oldest first, the order a receipt is set against them.' + (s.creditNow > 0 ? ' Credit on account, not yet applied: ' + fmt.inr2(s.creditNow) + '.' : ''),
      body: ui.table({
        dense: true, rows: s.openNow, empty: 'No invoice of this customer is open', maxHeight: 360,
        columns: [
          { key: 'id', label: 'Invoice', doc: true },
          { key: 'date', label: 'Dated', format: 'date' },
          { key: 'dueDate', label: 'Due on', render: function (v, x) { return x.overdue ? ui.row([day(v), ui.chip(overdueText(x), 'warn')], { gap: 2 }) : day(v); } },
          { key: 'total', label: 'Invoice total', format: 'inr2' },
          { key: 'open', label: 'Still to receive', format: 'inr2' }
        ],
        footer: owed ? { id: 'Total', open: owed.open } : null
      })
    }));
  }

  /* ------------------------------------------------------------------ form */

  /** The open invoices of the customer of the draft, as the selector gives them now: oldest first. */
  function openOf(draft) { var id = draft.values.customerId; return id ? HB.data.ar.openInvoices(id) : []; }
  function openRow(draft, row) {
    var all = openOf(draft);
    for (var i = 0; i < all.length; i++) if (all[i].id === row.docId) return all[i];
    return {};
  }

  /** One line per open invoice of the customer, the amount empty. Once per customer, so a redraw keeps what was typed. */
  function fill(draft) {
    var id = draft.values.customerId || null;
    if (draft.linesFor === id) return;
    draft.lines = openOf(draft).map(function (x) { return { docId: x.id, amount: null }; });
    draft.linesFor = id;
  }

  /** draft -> the payload of docs/API.md 3.5. A line with no amount is not on the receipt. */
  function payload(draft, form) {
    var v = draft.values;
    return {
      date: v.date, customerId: v.customerId, account: v.account, amount: v.amount, mode: v.mode, note: v.note,
      allocations: form.lines().map(function (l) { return { docId: l.docId, amount: l.amount }; })
    };
  }

  /**
   * The engine calls a line of a receipt 'allocations[i]'; the grid of the form calls its lines 'lines[i]'. The
   * same refusal under the form's name for the line, so that it is shown under that line.
   */
  function atLines(res) {
    var e = res && res.error, m = e && e.field ? /^allocations\[(\d+)\](?:\.(\w+))?$/.exec(e.field) : null;
    if (!m) return res;
    var copy = {}, k;
    for (k in res) if (Object.prototype.hasOwnProperty.call(res, k)) copy[k] = res[k];
    copy.error = { code: e.code, message: e.message, field: 'lines[' + m[1] + ']' + (m[2] === 'amount' ? '.amount' : ''), docId: e.docId };
    return copy;
  }

  /** "Oldest first": the amount received, set against the open invoices in the selector's order until it runs out. */
  function spread(draft, form) {
    var left = draft.values.amount;
    if (!(left > 0)) { form.setError({ message: 'Enter the amount received first', field: 'amount' }); return; }
    draft.lines.forEach(function (l) {
      var take = Math.min(left, openRow(draft, l).open || 0);
      l.amount = take > 0 ? take : null;
      left -= take;
    });
    draft.dirty = true;
    form.grid.refresh();
    form.refresh();
  }

  function clear(draft, form) {
    draft.lines.forEach(function (l) { l.amount = null; });
    draft.dirty = true;
    form.grid.refresh();
    form.refresh();
  }

  function form(rootEl, ctx) {
    var st = ctx.state, draft = forms.draft(st.form), may = HB.session.can('rcpt.create');   /* a draft another page handed over gets its shape here */
    fill(draft);
    rootEl.appendChild(forms.docForm({
      title: 'New receipt', state: draft, backLabel: 'Back to receipts', submitLabel: 'Post receipt',
      subtitle: 'Money received from a customer, set against its open invoices',
      submitReason: may.ok ? '' : may.reason,
      fields: [
        { key: 'customerId', label: 'Customer', type: 'party', kind: 'customer', required: true, span: 2, rebuild: true,
          onChange: function (id, d) { fill(d); } },
        { key: 'date', label: 'Received on', type: 'date', required: true },
        { key: 'amount', label: 'Amount received', type: 'amount', required: true },
        { key: 'account', label: 'Received into', type: 'select', required: true, span: 2, rebuild: true, placeholder: 'Choose factory cash or the bank', options: receiptAccounts,
          onChange: function (id, d) {
            var modes = modesOf(id);
            if (!modes.some(function (m) { return m.value === d.values.mode; })) d.values.mode = modes.length ? modes[0].value : null;
          } },
        { key: 'mode', label: 'How it came', type: 'select', optional: true, placeholder: 'Choose', options: function (d) { return modesOf(d.values.account); } },
        { key: 'note', label: 'Note', optional: true, span: 4, maxLength: 200, placeholder: 'Cheque number, bank reference or who handed it over' }
      ],
      lines: {
        title: 'Open invoices', subtitle: 'Enter an amount against each invoice this receipt settles. What is not set against an invoice stays on account.',
        addRows: false, removeRows: false, empty: 'Choose the customer to see its open invoices. With none open, the whole amount stays on account.',
        columns: [
          { key: 'docId', label: 'Invoice', type: 'static', format: function (v) { return forms.docLink(v); } },
          { key: 'date', label: 'Dated', type: 'computed', format: 'date', value: function (row) { return openRow(draft, row).date; } },
          { key: 'dueDate', label: 'Due on', type: 'computed', value: function (row) { return openRow(draft, row).dueDate; },
            format: function (v, row) {
              var x = openRow(draft, row);
              if (!v) return '-';
              return x.overdue ? ui.row([day(v), ui.chip(overdueText(x), 'warn')], { gap: 2 }) : day(v);
            } },
          { key: 'open', label: 'Still to receive', type: 'computed', format: 'inr2', footer: 'sum', value: function (row) { return openRow(draft, row).open; } },
          { key: 'amount', label: 'Receive now', type: 'amount', footer: 'sum' }
        ]
      },
      panel: function (p, d) {
        var doc = p && p.ok ? p.doc : null;
        if (!d.values.customerId) return ui.callout('neutral', 'Choose the customer', 'Its open invoices appear, oldest first, each with what is still to receive.');
        if (doc && doc.onAccount > 0) {
          return ui.callout('info', fmt.inr2(doc.onAccount) + ' stays on account',
            'It is not set against an invoice. It is kept as the customer\'s credit and applied to its next invoice. ' +
            (d.lines.length ? '"Oldest first" sets the amount against the open invoices instead.' : 'No invoice of this customer is open.'));
        }
        if (doc) {
          return ui.callout('good', 'Posts as it is entered',
            fmt.inr2(doc.amount) + ' goes into ' + accountName(doc.account) + ', and what ' + customer(doc.customerId).name + ' owes falls by the same amount.');
        }
        return ui.callout('neutral', 'Enter the amount, then set it against invoices',
          '"Oldest first" does it in the order the invoices fell due. Each amount is at most what is still to receive on its invoice, and what is left over stays on account as credit.');
      },
      totals: function (p) {
        var doc = p && p.ok ? p.doc : null;
        return [
          { label: 'Invoices settled', sub: 'in full or in part', value: doc ? fmt.num(doc.allocations.length) : '-' },
          { label: 'Amount received', value: doc ? fmt.inr2(doc.amount) : '-', strong: true, rule: true },
          { label: 'Stays on account', sub: 'credit for the next invoice', value: doc ? fmt.inr2(doc.onAccount) : '-', tone: doc && doc.onAccount > 0 ? 'good' : 'muted' }
        ];
      },
      actions: [
        { label: 'Oldest first', icon: 'layers', title: 'Set the amount received against the open invoices, the oldest first', onClick: spread },
        { label: 'Clear the amounts', icon: 'x', variant: 'ghost', onClick: clear }
      ],
      onPreview: function (d, f) { return atLines(HB.engine.preview('RCPT', payload(d, f))); },
      onSubmit: function (d, f) {
        var before = snapshot();                      /* read the selectors, act, read them again: that is what moved */
        var res = HB.engine.act('post', { type: 'RCPT', payload: payload(d, f) });
        if (!res.ok) return atLines(res);             /* the form shows the refusal at the field or the line it names */
        st.form = null;
        forms.postedToast(res.doc, movedText(res.doc, before, false));
        ctx.openDoc(res.doc.id);
        return res;
      },
      onCancel: function () { st.form = null; ctx.rerender(); }
    }));
  }

  /* ------------------------------------------------------------------ view */

  function view(rootEl, ctx) {
    var v = HB.data.doc.view(ctx.docId), st = ctx.state;
    if (!v || v.type !== 'RCPT') { rootEl.appendChild(forms.missingDoc(ctx.docId, { onBack: ctx.closeDoc, backLabel: 'Back to receipts' })); return; }
    var d = v.doc;
    var row = HB.data.sell.receipts({ from: v.date, to: v.date }).filter(function (r) { return r.id === v.id; })[0] || {};

    var actions = [{ label: 'Open the customer statement', icon: 'book',
      onClick: function () { st.tab = 'statement'; st.customerId = d.customerId; ctx.closeDoc(); } }
    ].concat(forms.docActions({
      view: v, labels: { cancel: 'Cancel the receipt' },
      ask: { cancel: 'The money leaves the account it went into, the invoices it settled are open again, and credit it left on account is withdrawn.' },
      before: snapshot,
      moved: function (op, res, before) { return op === 'cancel' ? movedText(res.target, before, true) + ' ' + res.doc.id + ' records the cancellation.' : ''; }
    }));

    rootEl.appendChild(forms.docView({
      title: forms.docTitle(v), subtitle: v.party ? v.party.name : '', status: v.status,
      chips: v.status === 'POSTED' && d.onAccount > 0 ? [ui.chip(d.allocations.length ? 'Part on account' : 'On account', 'info')] : null,
      onBack: ctx.closeDoc, backLabel: 'Back to receipts', notice: forms.docNotice(v),
      meta: [
        ['Customer', v.party ? v.party.name : null],
        ['Received on', day(v.date)],
        ['Received into', accountName(d.account)],
        ['How it came', modeLabel(d.mode)],
        ['Entered by', v.createdByName],
        ['Note', v.note || null]
      ],
      lines: {
        title: 'Set against', subtitle: 'The invoices this receipt settles, in full or in part',
        empty: 'Not set against any invoice: the whole amount is on account',
        columns: [
          { key: 'docId', label: 'Invoice', doc: true },
          { key: 'amount', label: 'Received against it', format: 'inr2' }
        ],
        rows: d.allocations, footer: d.allocations.length ? { docId: 'Total', amount: row.allocated } : null
      },
      totals: [
        { label: 'Amount received', value: fmt.inr2(v.amount), strong: true },
        { label: 'Set against invoices', value: fmt.inr2(row.allocated), tone: 'muted' },
        { label: 'On account', sub: 'credit for the next invoice', value: fmt.inr2(d.onAccount), tone: 'muted' }
      ],
      related: forms.relatedOf(v.id), timeline: forms.timelineOf(v.id), actions: actions
    }));
  }

  /* ------------------------------------------------------------------ page */

  HB.router.register({
    id: 'sell-receipts', route: '#/sell/receipts', group: 'Sell', title: 'Receipts', filters: ['date'],
    subtitle: 'Money from customers, and their statements',
    render: function (rootEl, ctx) {
      if (ctx.docId) return view(rootEl, ctx);         /* '#/doc/RCPT-...': the hash decides */
      if (ctx.state.form) return form(rootEl, ctx);    /* a draft is open: it survives redraws, persona switches and visits elsewhere */
      fromLink(ctx.state, ctx);
      rootEl.appendChild(tabs(ctx.state, ctx));
      if (ctx.state.tab === 'statement') return statement(rootEl, ctx);
      list(rootEl, ctx);
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
