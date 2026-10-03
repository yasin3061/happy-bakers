/*
 * Payables (#/accounts/payables). What is owed to each payee with its ageing, what falls due this week, and the
 * approved claims waiting to be reimbursed. A row opens the payee's open documents; "Pay" starts a payment on the
 * payments screen (js/pages/buy-payments.js). Everything is as of the business date: the page has no date range.
 * Every figure is HB.data.ap's (the claims tile: HB.data.dash); the page holds the wording and the layout.
 */
(function (root) {
  'use strict';

  var HB = root.HB;
  if (!HB || !HB.router || !HB.ui || !HB.forms) return;
  var ui = HB.ui, forms = HB.forms, fmt = HB.fmt;

  var KIND = { stock: 'Stock vendor', expense: 'Expense vendor', staff: 'Salaries' };

  function day(iso) { return ui.format('date', iso); }
  function plural(n, one, many) { return fmt.num(n) + ' ' + (n === 1 ? one : many); }
  function rupees(key) { return function (row) { return HB.money.toRupees(row[key]); }; }   /* paise stay paise except in a CSV */
  /** An amount of an ageing table: a dash where nothing is owed, so that the eye finds what is. */
  function owed(v) { return v ? fmt.inr2(v) : '-'; }

  /** "Pay": the payment form of the payments screen, started for this payee (and, with `only`, for one document). */
  function payButton(may, values, o) {
    o = o || {};
    return ui.button({ label: o.label || 'Pay', icon: may.ok ? 'wallet' : 'lock', size: o.size, variant: o.variant, disabledReason: may.ok ? '' : may.reason,
      onClick: function () { forms.startDraft('buy-payments', { values: values }); } });
  }

  /** The due date with how far it is: overdue by so many days, due today, or in so many days. */
  function dueCell(v, row) {
    if (!v) return '-';
    var chip = row.overdue ? ui.chip(plural(row.daysOverdue, 'day', 'days') + ' overdue', 'warn')
      : ui.chip(row.daysToDue === 0 ? 'Due today' : 'In ' + plural(row.daysToDue, 'day', 'days'), 'neutral');
    return ui.row([day(v), chip], { gap: 2 });
  }

  /* --------------------------------------------- the open documents of one payee */

  function openItems(row, may) {
    var items = HB.data.ap.openItems(row.payeeType, row.payeeId);
    var drawer = ui.drawer({
      wide: true, title: row.name,
      subtitle: fmt.inr2(row.open) + ' open on ' + plural(row.items, 'document', 'documents') +
        (row.overdue ? ', ' + fmt.inr2(row.overdue) + ' of it overdue' : ', nothing overdue') + '. Payment terms: ' + plural(row.termsDays, 'day', 'days') + '.',
      body: ui.table({
        dense: true, rows: items, empty: 'Nothing is open for this payee', footer: { typeLabel: 'Total', open: row.open },
        columns: [
          { key: 'id', label: 'Document', doc: true },
          { key: 'typeLabel', label: 'What', render: ui.cells.twoLine('ref', { maxWidth: 200 }) },
          { key: 'date', label: 'Dated', format: 'date' },
          { key: 'dueDate', label: 'Due on', render: dueCell },
          { key: 'total', label: 'Total', format: 'inr2' },
          { key: 'paid', label: 'Paid', format: 'inr2' },
          { key: 'open', label: 'Still to pay', format: 'inr2' }
        ]
      }),
      footer: ui.row([
        ui.button({ label: 'Close', variant: 'ghost', onClick: function () { drawer.close(); } }),
        payButton(may, { payeeType: row.payeeType, payeeId: row.payeeId }, { label: 'Pay ' + row.name, variant: 'primary' })
      ], { end: true })
    });
  }

  /* ------------------------------------------------------------------ cards */

  function ageingCard(st, ageing, may) {
    var columns = [{ key: 'name', label: 'Payee', render: ui.cells.twoLine(function (row) {
      return (KIND[row.kind] || 'Vendor') + ', ' + plural(row.items, 'open document', 'open documents');
    }, { maxWidth: 260 }) },
      /* what is owed stands next to the name, so it is in sight at any width; how old it is follows */
      { key: 'open', label: 'Outstanding', format: 'inr2', value: rupees('open') }].concat(ageing.buckets.map(function (b) {
      return { key: b.key, label: b.label, align: 'right', format: owed, value: rupees(b.key) };
    }));
    var footer = { name: 'Total', open: ageing.totals.open };
    ageing.buckets.forEach(function (b) { footer[b.key] = ageing.totals[b.key]; });
    return ui.card({
      title: 'Outstanding by payee', flush: true,
      subtitle: 'On ' + day(ageing.asOf) + ', by how far each open document is past its due date. A row opens what is open for the payee.',
      actions: ui.button({ label: 'CSV', icon: 'download', size: 'sm', onClick: function () { ui.downloadCsv('payables-ageing.csv', columns, ageing.rows); } }),
      body: ui.table({
        columns: columns, rows: ageing.rows, dense: true, maxHeight: 460, empty: 'Nothing is owed to any vendor',
        sortable: true, sort: st.sort || { key: 'open', dir: 'desc' }, onSort: function (s) { st.sort = s; },
        onRowClick: function (row) { openItems(row, may); }, footer: footer
      })
    });
  }

  function dueCard(st, rows, may) {
    var until = HB.dates.addDays(HB.calendar.today, HB.masters.limits.dueSoonDays);
    return ui.card({
      title: 'Due this week', flush: true,
      subtitle: 'Vendor bills, expense bills and salary bills due on or before ' + day(until) + ', overdue ones included, soonest first',
      body: ui.table({
        dense: true, rows: rows, maxHeight: 420, empty: 'Nothing falls due on or before ' + day(until),
        columns: [
          { key: 'id', label: 'Document', doc: true },
          { key: 'name', label: 'Payee', maxWidth: 240 },
          { key: 'typeLabel', label: 'What', render: ui.cells.twoLine('ref', { maxWidth: 180 }) },
          { key: 'dueDate', label: 'Due on', render: dueCell },
          { key: 'open', label: 'Still to pay', format: 'inr2' },
          { key: 'act', label: '', align: 'right', sortable: false, render: function (v, row) {
            return payButton(may, { payeeType: row.payeeType, payeeId: row.payeeId, only: row.id }, { size: 'sm' });
          } }
        ]
      })
    });
  }

  function claimsCard(rows, may) {
    return ui.card({
      title: 'Claims to reimburse', subtitle: 'Approved expense claims that are not paid in full. They are owed to employees and are not in the table of payees above.', flush: true,
      body: ui.table({
        dense: true, rows: rows, maxHeight: 360, empty: 'No approved claim is waiting to be reimbursed',
        columns: [
          { key: 'id', label: 'Claim', doc: true },
          { key: 'date', label: 'Date', format: 'date' },
          { key: 'employeeName', label: 'Employee', maxWidth: 200 },
          { key: 'categoryName', label: 'Category and location', render: ui.cells.twoLine('unitName', { maxWidth: 200 }) },
          { key: 'open', label: 'Still to pay', format: 'inr2' },
          { key: 'act', label: '', align: 'right', sortable: false, render: function (v, row) {
            return payButton(may, { payeeType: row.payeeType, payeeId: row.payeeId, only: row.id }, { size: 'sm' });
          } }
        ]
      })
    });
  }

  /* ------------------------------------------------------------------ page */

  HB.router.register({
    id: 'acc-payables', route: '#/accounts/payables', group: 'Accounts', title: 'Payables', filters: [],
    subtitle: 'What is owed and what falls due',
    render: function (rootEl, ctx) {
      var st = ctx.state, may = HB.session.can('pay.create');
      var ageing = HB.data.ap.ageing(), t = ageing.totals, due = HB.data.ap.dueWithin(), claims = HB.data.ap.toReimburse();
      var dash = HB.data.dash.today().payables || {};
      ui.append(rootEl,
        ui.kpiRow([
          { label: 'Owed to vendors', value: fmt.inr(t.open), sub: plural(t.vendors, 'payee', 'payees') + ', ' + plural(t.items, 'open document', 'open documents') },
          { label: 'Overdue', value: fmt.inr(t.overdue), tone: t.overdue ? 'warn' : null,
            sub: t.overdueItems ? plural(t.overdueItems, 'document', 'documents') + ', the oldest due on ' + day(t.oldestDue) : 'Nothing is past its due date' },
          { label: 'Due in the next ' + plural(HB.masters.limits.dueSoonDays, 'day', 'days'), value: fmt.inr(t.dueSoon), sub: 'not yet overdue' },
          { label: 'Claims to reimburse', value: fmt.inr(dash.toReimburse), sub: plural(claims.length, 'approved claim', 'approved claims') }
        ]),
        ageingCard(st, ageing, may),
        dueCard(st, due, may),
        claimsCard(claims, may));
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
