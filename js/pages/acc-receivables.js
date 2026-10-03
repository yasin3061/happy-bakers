/*
 * Receivables (#/accounts/receivables). What every customer owes on the business date, by age, with what is overdue
 * and the unapplied credit in a column of its own; a row opens the customer with its open invoices and its
 * statement ('#/accounts/receivables?customer=<id>'), from where a receipt is started on js/pages/sell-receipts.js.
 * A read-only figures page (docs/PAGES.md section 2): every figure is HB.data.ar's.
 */
(function (root) {
  'use strict';

  var HB = root.HB;
  if (!HB || !HB.router || !HB.ui || !HB.forms) return;
  var ui = HB.ui, h = ui.h, forms = HB.forms, fmt = HB.fmt;

  var ROUTE = '#/accounts/receivables';

  function day(iso) { return ui.format('date', iso); }
  function plural(n, one, many) { return fmt.num(n) + ' ' + (n === 1 ? one : many); }
  function customer(id) { return HB.data.lookup.customer(id); }
  function overdueText(x) { return plural(x.daysOverdue, 'day', 'days') + ' overdue'; }
  /** The customer's terms in words; credit terms say for how many days. The days are the master's. */
  function termsText(c) {
    if (!c || !c.termsLabel) return null;
    return c.terms === 'credit' && c.creditDays > 0 ? c.termsLabel + ', ' + plural(c.creditDays, 'day', 'days') : c.termsLabel;
  }
  /** A figure of the ageing table in whole rupees: a dash where nothing is owed. */
  function whole(v) { return v ? fmt.inrFull(v) : '-'; }
  /** Unapplied credit stands against what is owed: it is shown as a negative figure, never taken out of a bucket. */
  function less(v) { return v ? fmt.inrFull(-v) : '-'; }
  /** An amount of a statement column: nothing where nothing was invoiced or received; a cancellation is a negative figure in the column of what it cancels. */
  function sum(v) { return v ? fmt.inr2(v) : ''; }
  function rupees(key, sign) { return function (row) { return row[key] ? sign * HB.money.toRupees(row[key]) : 0; }; }
  function where(r) { return [r.channelLabel, r.routeName, r.overLimit ? 'over its credit limit' : null].filter(Boolean).join(' - '); }

  /* ------------------------------------------------------------------ list */

  function list(rootEl, ctx) {
    var st = ctx.state, a = HB.data.ar.ageing(), t = a.totals;          /* { asOf, buckets, rows, totals }: call, draw, forget */
    if (!st.sort) st.sort = { key: 'overdue', dir: 'desc' };

    var columns = [
      { key: 'customerName', label: 'Customer', render: ui.cells.twoLine(where, { maxWidth: 210 }) },
      { key: 'open', label: 'Outstanding', align: 'right', format: whole },
      { key: 'overdue', label: 'Overdue', align: 'right', format: function (v) {
        return v ? h('span', { 'class': 'mk-warn' }, ui.icon('alert-triangle', 14), ' ', fmt.inrFull(v)) : '-';
      } },
      { key: 'credit', label: 'Unapplied credit', align: 'right', format: less, title: 'Stale returns and money on account that are not yet set against an invoice' }
    ].concat(a.buckets.map(function (b) {
      return { key: b.key, label: b.label, align: 'right', format: whole, title: 'Part of what is outstanding, by days past the due date' };
    }));

    /* the file carries the same rows in rupees with paise, and what the screen keeps for the customer's own view */
    var csv = [
      { key: 'customerName', label: 'Customer' },
      { key: 'channelLabel', label: 'Channel' },
      { key: 'routeName', label: 'Route' }
    ].concat(a.buckets.map(function (b) { return { key: b.key, label: b.label, value: rupees(b.key, 1) }; }), [
      { key: 'open', label: 'Outstanding', value: rupees('open', 1) },
      { key: 'overdue', label: 'Overdue', value: rupees('overdue', 1) },
      { key: 'credit', label: 'Unapplied credit', value: rupees('credit', -1) },
      { key: 'balance', label: 'Balance', value: rupees('balance', 1) },
      { key: 'items', label: 'Open invoices' },
      { key: 'overdueItems', label: 'Overdue invoices' },
      { key: 'oldestDue', label: 'Oldest due date' }
    ]);

    ui.append(rootEl,
      ui.kpiRow([
        { label: 'Outstanding', value: fmt.inr(t.open), sub: plural(t.items, 'open invoice', 'open invoices') },
        { label: 'Overdue', value: fmt.inr(t.overdue), tone: t.overdue > 0 ? 'warn' : null,
          sub: plural(t.overdueItems, 'invoice', 'invoices') + (t.oldestDue && t.overdue > 0 ? ', the oldest due ' + day(t.oldestDue) : '') },
        { label: 'Unapplied credit', value: fmt.inr(t.credit), sub: 'returns and money on account' },
        { label: 'Owed, less credit', value: fmt.inr(t.balance), sub: plural(t.customers, 'customer', 'customers') }
      ]),
      ui.card({
        title: 'Outstanding by customer', flush: true,
        subtitle: 'As it stands on ' + day(a.asOf) + ': what is outstanding, then the same amount by days past the due date. A row opens the customer; the date range above sets the period of its statement.',
        actions: ui.button({ label: 'CSV', icon: 'download', size: 'sm', onClick: function () { ui.downloadCsv('receivables-ageing.csv', csv, a.rows); } }),
        body: ui.table({
          columns: columns, rows: a.rows, dense: true, maxHeight: 620, empty: 'No customer owes anything',
          sortable: true, sort: st.sort, onSort: function (s) { st.sort = s; },      /* the sort survives a redraw */
          onRowClick: function (row) { ctx.navigate(ROUTE, { customer: row.customerId }); },
          footer: { customerName: 'Total', notDue: t.notDue, d1_15: t.d1_15, d16_30: t.d16_30, d31_60: t.d31_60, d60p: t.d60p, open: t.open, overdue: t.overdue, credit: t.credit }
        })
      }));
  }

  /* ------------------------------------------------------- one customer */

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

  /** The statement on paper: the same rows, with the customer's address and what is still open. */
  function statementPaper(s, c, owed) {
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

  function detail(rootEl, ctx, id) {
    var c = customer(id), back = function () { ctx.navigate(ROUTE); };
    var s = c.unknown ? null : HB.data.ar.statement(id, { from: ctx.filters.from, to: ctx.filters.to });
    if (!s) {
      rootEl.appendChild(ui.emptyState('No such customer', String(id) + ' is not a customer in this copy.',
        { icon: 'users', action: ui.button({ label: 'Back to receivables', icon: 'arrow-left', onClick: back }) }));
      return;
    }
    var a = HB.data.ar.ageing(), owed = a.rows.filter(function (r) { return r.customerId === id; })[0] || null;   /* null: nothing open, no credit */
    var may = HB.session.can('rcpt.create');

    rootEl.appendChild(ui.pageHead({
      title: c.name, subtitle: [c.channelLabel, c.routeName, termsText(c)].filter(Boolean).join(' - '),
      back: { label: 'Back to receivables', onClick: back },
      chips: [
        owed && owed.overdue > 0 ? ui.statusChip('OVERDUE', { label: fmt.inr2(owed.overdue) + ' overdue' }) : null,
        owed && owed.overLimit ? ui.chip('Over its credit limit', 'critical') : null
      ].filter(Boolean),
      actions: [
        ui.button({ label: 'Print statement', icon: 'printer', onClick: function () { showPaper('Statement of ' + c.name, statementPaper(s, c, owed), 'Statement ' + c.name); } }),
        ui.button({ label: 'Receive payment', icon: may.ok ? 'coins' : 'lock', variant: 'primary', disabledReason: may.ok ? '' : may.reason,
          onClick: function () { forms.startDraft('sell-receipts', { values: { customerId: id } }); } })
      ]
    }));

    rootEl.appendChild(ui.kpiRow([
      { label: 'Outstanding', value: fmt.inr2(owed ? owed.open : 0), sub: plural(s.openNow.length, 'open invoice', 'open invoices') },
      { label: 'Overdue', value: fmt.inr2(owed ? owed.overdue : 0), tone: owed && owed.overdue > 0 ? 'warn' : null,
        sub: owed && owed.oldestDue ? 'oldest due ' + day(owed.oldestDue) : 'nothing past its due date' },
      { label: 'Unapplied credit', value: fmt.inr2(s.creditNow), sub: 'returns and money on account' },
      { label: 'Owed, less credit', value: fmt.inr2(s.balanceNow), tone: owed && owed.overLimit ? 'critical' : null,
        sub: c.creditLimit > 0 ? (owed && owed.overLimit ? 'above' : 'within') + ' the credit limit of ' + fmt.inr2(c.creditLimit) : 'on ' + day(a.asOf) + ', no credit limit set' }
    ]));

    rootEl.appendChild(ui.card({
      title: 'Open invoices', subtitle: 'Oldest first, the order a receipt is set against them', flush: true,
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

    rootEl.appendChild(ui.card({
      title: 'Statement', subtitle: HB.filters.rangeLabel(s) + ': invoices, cash collected, receipts and stale returns, with a running balance', flush: true,
      body: ui.table({
        dense: true, rows: statementRows(s), maxHeight: 520,
        rowClass: function (r) { return r.lead ? 'is-strong' : (r.reversal ? 'is-muted' : ''); },
        columns: [
          { key: 'date', label: 'Date', format: 'date' },
          { key: 'docId', label: 'Document', doc: true },
          { key: 'kindLabel', label: 'What', render: function (v, row) { return whatCell(row); } },
          { key: 'invoiced', label: 'Invoiced', align: 'right', format: sum },
          { key: 'settled', label: 'Paid or credited', align: 'right', format: sum },
          { key: 'balance', label: 'Balance', format: 'inr2' }
        ],
        footer: { kindLabel: 'Closing balance', invoiced: s.invoiced, settled: s.settled, balance: s.closing }
      })
    }));
  }

  /* ------------------------------------------------------------------ page */

  HB.router.register({
    id: 'acc-receivables', route: ROUTE, group: 'Accounts', title: 'Receivables', filters: ['date'],
    subtitle: 'What customers owe, by age',
    render: function (rootEl, ctx) {
      if (ctx.params && ctx.params.customer) return detail(rootEl, ctx, ctx.params.customer);
      list(rootEl, ctx);
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
