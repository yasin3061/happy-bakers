/*
 * Expenses (#/expenses). Claims, expense bills and the salary bill: the list, the three forms and the view of one
 * document; and the spend of the range by category and by location.
 * Built on the pattern of js/pages/buy-orders.js (docs/PAGES.md). What a role sees is the selectors' answer
 * (HB.data.exp follows HB.session.expenseView); what it may do is the engine's. The page holds wording and layout.
 */
(function (root) {
  'use strict';

  var HB = root.HB;
  if (!HB || !HB.router || !HB.ui || !HB.forms) return;
  var ui = HB.ui, h = ui.h, forms = HB.forms, fmt = HB.fmt;

  var OPEN = ['PENDING', 'APPROVED'];   /* still to approve or to pay */

  /* the three kinds of expense: the right that raises one, and the words for it */
  var KIND = {
    claim: { right: 'exp.claim', title: 'New expense claim', submit: 'Submit claim', noun: 'claim' },
    bill: { right: 'exp.bill', title: 'New expense bill', submit: 'Submit bill', noun: 'bill' },
    salary: { right: 'exp.salary', title: 'Salary bill', submit: 'Raise salary bill', noun: 'salary bill' }
  };

  /* what the spend figures cover, by the view the session gives the role */
  var COVERS = {
    all: 'Approved expenses of every location, salaries included',
    unit: 'Approved expenses of your store, without salaries',
    own: 'Your own approved claims'
  };

  function day(iso) { return ui.format('date', iso); }
  function monthName(monthKey) { return HB.dates.monthLabel(monthKey, true); }
  function monthOf(date) { return { from: HB.dates.monthStart(date), to: HB.dates.monthEnd(date) }; }
  function percent(rate) { return fmt.qty(rate) + '%'; }
  function unitName(id) { return HB.data.lookup.unit(id).name; }
  /** The first two of a list in words, and how many more there are. */
  function few(list) { return list.slice(0, 2).join(', ') + (list.length > 2 ? ' and ' + fmt.num(list.length - 2) + ' more' : ''); }
  function rupees(key) { return function (row) { return row[key] === undefined || row[key] === null ? '' : HB.money.toRupees(row[key]); }; }

  /* ------------------------------------------------- what an expense moves */

  /** Read before and after the engine acts: the spend by location of the month the rows land in, and what is owed. */
  function snapshot(date) { return { date: date, spend: HB.data.exp.byUnit(monthOf(date)).rows, owed: HB.data.ap.balances().rows }; }

  /** One figure of a selector row, nothing when the selector has no such row. */
  function figure(rows, key, id, field) {
    var row = rows.filter(function (r) { return r[key] === id; })[0];
    return row ? row[field] : 0;
  }

  /** What the selectors show now against what they showed before: the payee's balance and the spend of each location. */
  function movedText(doc, before) {
    var now = snapshot(before.date), parts = [];
    if (doc.payeeType === 'vendor') {
      var was = figure(before.owed, 'payeeId', doc.payeeId, 'open'), is = figure(now.owed, 'payeeId', doc.payeeId, 'open');
      if (was !== is) parts.push('Owed to ' + HB.data.lookup.payee(doc.payeeType, doc.payeeId).name + ': ' + fmt.inr2(was) + ' to ' + fmt.inr2(is) + '.');
    }
    var units = doc.kind === 'salary' ? doc.lines.map(function (l) { return l.unitId; }) : [doc.unitId];
    var spend = units.map(function (id) {
      var a = figure(before.spend, 'unitId', id, 'amount'), b = figure(now.spend, 'unitId', id, 'amount');
      return a === b ? null : unitName(id) + ' ' + fmt.inr2(a) + ' to ' + fmt.inr2(b);
    }).filter(Boolean);
    if (spend.length) parts.push('Spend of ' + monthName(HB.dates.monthKey(before.date)) + ': ' + few(spend) + '.');
    return parts.join(' ');
  }

  /** The one line of the toast after an approval, the Owner's own included. */
  function approvedText(doc, before) {
    var parts = [];
    if (doc.kind === 'claim') parts.push('It is on the list of claims to reimburse.');
    parts.push(movedText(doc, before));
    if (doc.kind === 'bill') parts.push('It is due on ' + day(doc.dueDate) + '.');
    return parts.filter(Boolean).join(' ');
  }

  /** The one line of the toast after posting: where the expense landed and, when the Owner raised it, what moved. */
  function landedText(doc, before) {
    if (doc.status === 'PENDING') return 'It waits for the Owner. Nothing is owed and no spend is counted until it is approved.';
    return 'Approved as your own ' + KIND[doc.kind].noun + '. ' + approvedText(doc, before);
  }

  /* ------------------------------------------------------------------ list */

  function start(st, ctx, kind) {
    var init = { values: { kind: kind } };
    if (kind === 'salary') {
      /* the month whose bill can be raised now: this month on its last day, else last month once its bill is cancelled.
         With none free, the month before the business month, where the engine says why and the form how to raise it again */
      var free = monthOptions().filter(function (o) { return HB.engine.salaryBill(o.value).ok; })[0];
      init.values.monthKey = free ? free.value : HB.dates.monthKey(HB.calendar.lockBefore);
      init.touched = { monthKey: true };
    }
    st.form = forms.draft(init);
    ctx.rerender();
  }

  function spendChart(byUnit, byCategory) {
    if (!HB.charts || typeof HB.charts.mount !== 'function') return null;
    /* one plain bar chart: by location, or by category when the range holds one location only */
    var byPlace = byUnit.rows.length > 1;
    var rows = byPlace ? byUnit.rows : byCategory.rows;
    if (!rows.length) return null;   /* nothing approved in the range: the table below says so */
    return HB.charts.mount(null, {
      /* upright bars by location; by category one lying bar a row, the card as tall as its rows need (pixels) */
      id: 'expenses-spend', kind: byPlace ? 'bar' : 'hbar', format: 'inr', height: byPlace ? 220 : Math.min(300, 96 + rows.length * 36),
      title: byPlace ? 'Spend by location' : 'Spend by category', subtitle: HB.filters.rangeLabel(byUnit),
      data: {
        categories: rows.map(function (r) { return byPlace ? r.unitName : r.categoryName; }),
        values: rows.map(function (r) { return r.amount; }), name: 'Spend', categoryHeader: byPlace ? 'Location' : 'Category'
      },
      emptyText: 'No approved expense in this range'
    }).el;
  }

  function spendTable(st, res) {
    /* one row per category, one column per location, as the selector gives them */
    var rows = res.rows.map(function (r) {
      var row = { categoryName: r.categoryName, amount: r.amount };
      res.units.forEach(function (u) { row['at_' + u.unitId] = r.byUnit[u.unitId]; });
      return row;
    });
    var columns = [{ key: 'categoryName', label: 'Category', maxWidth: 220 }].concat(res.units.map(function (u) {
      return { key: 'at_' + u.unitId, label: u.unitName, format: 'inr2', value: rupees('at_' + u.unitId) };
    }), [{ key: 'amount', label: 'All locations', format: 'inr2', value: rupees('amount') }]);
    var footer = { categoryName: 'Total', amount: res.totals.amount };
    res.units.forEach(function (u) { footer['at_' + u.unitId] = u.amount; });
    return ui.card({
      title: 'Spend by category and location', flush: true,
      subtitle: HB.filters.rangeLabel(res) + '. ' + (COVERS[HB.session.expenseView()] || '') + ', before GST, on the date of each expense.',
      actions: ui.button({ label: 'CSV', icon: 'download', size: 'sm', onClick: function () { ui.downloadCsv('expenses-by-category-and-location.csv', columns, rows); } }),
      body: ui.table({ columns: columns, rows: rows, dense: true, maxHeight: 340,
        empty: 'No approved expense is dated in this range. An expense counts on its own date once the Owner approves it.',
        sortable: true, sort: st.spendSort, onSort: function (s) { st.spendSort = s; }, footer: footer })
    });
  }

  function list(rootEl, ctx) {
    var st = ctx.state, f = ctx.filters;
    st.list = st.list || {};
    var mayClaim = HB.session.can(KIND.claim.right), mayBill = HB.session.can(KIND.bill.right), maySalary = HB.session.can(KIND.salary.right);
    /* an expense still to approve or to pay is listed whatever the date range says; the range limits the finished ones */
    var open = HB.data.exp.list({ status: OPEN, unitId: f.unitIds });
    var rows = forms.uniqueRows(open, HB.data.exp.list({ from: f.from, to: f.to, unitId: f.unitIds }));
    var byCategory = HB.data.exp.byCategory(f), byUnit = HB.data.exp.byUnit(f);
    var waiting = open.filter(function (r) { return r.status === 'PENDING'; }).length;
    var toPay = open.filter(function (r) { return r.status === 'APPROVED'; }).length;
    function tab(id) { return function () { st.list.tab = id; st.list.page = 0; ctx.rerender(); }; }
    var chart = spendChart(byUnit, byCategory), table = spendTable(st, byCategory);

    ui.append(rootEl,
      ui.kpiRow([
        { label: 'Spend in the range', value: fmt.inr(byCategory.totals.amount), sub: HB.filters.rangeLabel(byCategory) },
        { label: 'Waiting for approval', value: fmt.num(waiting), sub: 'claims and bills, of any date', tone: waiting ? 'warn' : null, onClick: tab('PENDING') },
        { label: 'Approved, still to pay', value: fmt.num(toPay), sub: 'claims and bills, of any date', onClick: tab('APPROVED') }
      ]),
      /* the heading stands above the card: the card's head holds the search box and three buttons, and needs the width */
      ui.sectionTitle('Claims and bills', 'Expenses still to approve or to pay are always listed. The date range applies to the rest.'),
      forms.docList({
        state: st.list, rows: rows, pageSize: 12,
        statuses: ['PENDING', 'APPROVED', 'PAID', 'REJECTED', 'CANCELLED'],
        search: ['id', 'kindLabel', 'payeeName', 'categoryName', 'unitName', 'billRef', 'note'], searchPlaceholder: 'Search expenses',
        sort: { key: 'date', dir: 'desc' }, empty: 'No expense in this range',
        columns: [
          /* the document and its date share a column (sorted by the date), which leaves room for the status at 1024px */
          { key: 'date', label: 'Document and date', render: function (v, row) {
            return h('div', null, h('div', null, forms.docLink(row.id)), h('div', { 'class': 'mk-xs mk-muted' }, day(v)));
          } },
          { key: 'payeeName', label: 'Payee and kind', render: ui.cells.twoLine('kindLabel', { maxWidth: 150 }) },
          { key: 'categoryName', label: 'Category and location', render: ui.cells.twoLine('unitName', { maxWidth: 150 }) },
          /* one column for the money, so that the status is in sight at 1024px: what is still to pay stands under
             the amount once a part of an approved expense has been paid */
          { key: 'total', label: 'Amount', align: 'right', render: function (v, row) {
            var part = row.status === 'APPROVED' && row.paid > 0;
            return h('div', null, h('div', { 'class': 'mk-num' }, fmt.inr2(v)), part ? h('div', { 'class': 'mk-xs mk-muted mk-num' }, 'Still to pay ' + fmt.inr2(row.open)) : null);
          } },
          { key: 'status', label: 'Status', render: function (v, row) { return ui.statusChip(v, { title: row.rejectReason || null }); } }
        ],
        actions: [
          ui.button({ label: 'New expense bill', icon: mayBill.ok ? 'plus' : 'lock', disabledReason: mayBill.ok ? '' : mayBill.reason,
            onClick: function () { start(st, ctx, 'bill'); } }),
          ui.button({ label: 'Salary bill', icon: maySalary.ok ? 'users' : 'lock', disabledReason: maySalary.ok ? '' : maySalary.reason,
            onClick: function () { start(st, ctx, 'salary'); } })
        ],
        newLabel: 'New claim', newReason: mayClaim.ok ? '' : mayClaim.reason,
        onNew: function () { start(st, ctx, 'claim'); }
      }),
      chart, table,       /* one under the other: the table has a column for every location and needs the width */
      forms.teaser({ title: 'Budget against actual', tier: 'iNeo' }));
  }

  /* ------------------------------------------------------------------ form */

  function categoryOptions(mode) {
    return HB.data.lookup.categories({ mode: mode }).map(function (c) { return { value: c.id, label: c.name }; });
  }
  /** A claim or a bill is for the factory or for any store, whoever raises it. */
  function unitOptions() {
    return HB.data.lookup.units({ all: true }).map(function (u) { return { value: u.id, label: u.name }; });
  }
  /** The months a salary bill could be for: from the first open month to the business month. The engine decides. */
  function monthOptions() {
    var out = [], first = HB.dates.monthKey(HB.calendar.lockBefore), d = HB.dates.monthStart(HB.calendar.today);
    while (HB.dates.monthKey(d) >= first) {
      out.push({ value: HB.dates.monthKey(d), label: monthName(HB.dates.monthKey(d)) });
      d = HB.dates.monthStart(HB.dates.addDays(d, -1));
    }
    return out;
  }

  /** draft -> the payload of docs/API.md 3.5, by kind. */
  function payload(draft) {
    var v = draft.values;
    if (v.kind === 'salary') return { kind: 'salary', monthKey: v.monthKey, note: v.note };
    if (v.kind === 'bill') {
      return { kind: 'bill', date: v.date, payeeId: v.payeeId, categoryId: v.categoryId, unitId: v.unitId, amount: v.amount,
        gstRate: v.gstRate, billRef: v.billRef, note: v.note };
    }
    return { kind: 'claim', date: v.date, categoryId: v.categoryId, unitId: v.unitId, amount: v.amount, billRef: v.billRef, note: v.note };
  }

  var FIELDS = {
    claim: function () {
      var me = HB.session.current();
      return [
        { key: 'categoryId', label: 'Category', type: 'select', required: true, placeholder: 'Choose a category', options: function () { return categoryOptions('claim'); } },
        { key: 'unitId', label: 'Location', type: 'select', required: true, value: me.unitId, options: unitOptions,
          hint: 'The factory or the store the money was spent for' },
        { key: 'amount', label: 'Amount', type: 'amount', required: true },
        { key: 'date', label: 'Spent on', type: 'date', required: true },
        { key: 'billRef', label: 'Bill reference', optional: true, span: 2, maxLength: 60, placeholder: 'Bill or voucher number' },
        { key: 'payee', label: 'Reimbursed to', type: 'static', span: 2, text: function () { return HB.data.lookup.employee(me.employeeId).name; } },
        { key: 'note', label: 'What it was for', optional: true, span: 4, maxLength: 200 }
      ];
    },
    bill: function () {
      return [
        { key: 'payeeId', label: 'Vendor', type: 'party', kind: 'vendor', required: true, span: 2,
          filter: function (v) { return v.kind !== 'staff'; } },   /* the salary payee has its own bill */
        { key: 'categoryId', label: 'Category', type: 'select', required: true, placeholder: 'Choose a category', options: function () { return categoryOptions('bill'); } },
        { key: 'unitId', label: 'Location', type: 'select', required: true, placeholder: 'Choose a location', options: unitOptions },
        { key: 'date', label: 'Bill date', type: 'date', required: true },
        { key: 'billRef', label: 'Bill number', optional: true, maxLength: 60 },
        { key: 'amount', label: 'Amount before GST', type: 'amount', required: true },
        { key: 'gstRate', label: 'GST rate', type: 'qty', decimals: 2, unit: '%', optional: true, hint: 'Leave empty for a bill with no GST' },
        { key: 'note', label: 'Note', optional: true, span: 4, maxLength: 200 }
      ];
    },
    salary: function () {
      return [
        { key: 'monthKey', label: 'Month', type: 'select', required: true, rebuild: true, placeholder: 'Choose the month', options: monthOptions,
          hint: 'A salary bill is dated the last day of its month' },
        { key: 'note', label: 'Note', optional: true, span: 3, maxLength: 200 }
      ];
    }
  };

  /** The proposed salary bill of the month, from the engine: one line per location with its headcount. */
  function salaryBody(draft) {
    var mk = draft.values.monthKey, bill = mk ? HB.engine.salaryBill(mk) : null;
    if (!bill) return null;
    if (!bill.ok) {
      var e = bill.error;
      /* a month already billed: the field carries the engine's refusal; this says how to raise it again */
      if (e.code === 'duplicate') {
        return ui.callout('info', 'To raise it again',
          ['Cancel ', forms.docLink(e.docId), ' first, and before that its payment if it is paid. The month is then free for a new bill.']);
      }
      return e.field ? null : ui.callout('neutral', e.message, null);
    }
    return ui.card({
      title: 'Salary of ' + monthName(bill.monthKey), subtitle: 'From the employee directory: those on the rolls on ' + day(bill.date), flush: true,
      body: ui.table({ dense: true, rows: bill.lines, footer: { unitId: 'Total', amount: bill.total },
        columns: [
          { key: 'unitId', label: 'Location', render: function (v) { return unitName(v); } },
          { key: 'headcount', label: 'Employees', format: 'num' },
          { key: 'amount', label: 'Salary of the month', format: 'inr2' }
        ] })
    });
  }

  /** What the engine says will happen on submitting: preview.outcome, in words. */
  function outcome(p, kind) {
    var o = p && p.ok ? p.outcome : null, doc = o ? p.doc : null;
    var after = kind === 'claim' ? 'Once approved it stays on the list of claims to reimburse until accounts pays it from cash or the bank.'
      : (kind === 'salary' ? 'Once approved it is owed as staff salaries and is paid from the bank.'
        : 'Once approved it is owed to the vendor' + (doc ? ' and due on ' + day(doc.dueDate) : '') + '.');
    if (!o) return { tone: 'neutral', short: '-', title: 'Approval', text: 'Every expense waits for the Owner. ' + after };
    if (o.waits) return { tone: 'warn', short: 'Waits for the Owner', title: 'Waits for the Owner',
      text: 'Nothing is owed and no spend is counted until the Owner approves it. ' + after };
    return { tone: 'info', short: 'Approved as your own', title: 'Approved as you submit it',
      text: 'As the Owner you approve your own ' + KIND[kind].noun + ' as you submit it, and the audit log says so. It counts as spend on its own date.' };
  }

  function totals(p, kind) {
    var doc = p && p.ok ? p.doc : null, o = outcome(p, kind);
    var rows = [];
    if (kind === 'bill') {
      rows.push({ label: 'Amount', sub: 'before GST', value: doc ? fmt.inr2(doc.amount) : '-' });
      rows.push({ label: 'GST', sub: doc && doc.gst ? 'at ' + percent(doc.gstRate) : null, value: doc ? fmt.inr2(doc.gst) : '-' });
    }
    rows.push({ label: kind === 'salary' ? 'Salary of the month' : (kind === 'bill' ? 'Total to pay' : 'Amount to reimburse'),
      value: doc ? fmt.inr2(doc.total) : '-', strong: true, rule: kind === 'bill' });
    rows.push({ label: 'On submitting', value: o.short, tone: o.tone === 'warn' ? 'bad' : 'muted' });
    return rows;
  }

  function form(rootEl, ctx) {
    var st = ctx.state, draft = st.form;
    var kind = KIND[draft.values.kind] ? draft.values.kind : 'claim', K = KIND[kind], may = HB.session.can(K.right);
    draft.values.kind = kind;
    rootEl.appendChild(forms.docForm({
      title: K.title, state: draft, backLabel: 'Back to expenses', submitLabel: K.submit, submitIcon: 'send',
      submitReason: may.ok ? '' : may.reason,     /* a persona that may not raise it sees the form, locked, with the reason */
      fields: FIELDS[kind](),
      body: kind === 'salary' ? salaryBody : null,
      panel: function (p) { var o = outcome(p, kind); return ui.callout(o.tone, o.title, o.text); },
      totals: function (p) { return totals(p, kind); },
      onPreview: function (d) { return HB.engine.preview('EXP', payload(d)); },
      onSubmit: function (d) {
        var p = HB.engine.preview('EXP', payload(d));
        var before = snapshot(p.ok ? p.doc.date : HB.calendar.today);   /* read the selectors, act, read them again */
        var res = HB.engine.act('post', { type: 'EXP', payload: payload(d) });
        if (!res.ok) return res;                    /* the form shows the refusal at the field it names */
        st.form = null;
        forms.postedToast(res.doc, landedText(res.doc, before));
        ctx.openDoc(res.doc.id);
        return res;
      },
      onCancel: function () { st.form = null; ctx.rerender(); }
    }));
  }

  /* ------------------------------------------------------------------ view */

  /** "Pay": starts a payment on the payments screen, when the engine would take one against this expense from this persona. */
  function payAction(v, row) {
    if (OPEN.indexOf(v.status) === -1) return null;
    var d = v.doc, account = HB.data.lookup.accounts().filter(function (a) { return a.kind !== 'cash'; })[0];
    var chk = HB.engine.check('post', { type: 'PAY', payload: { date: HB.calendar.today, payeeType: d.payeeType, payeeId: d.payeeId,
      account: account ? account.id : null, allocations: [{ docId: v.id, amount: row.open || d.total }] } });
    /* the account and the amount are chosen on the payments screen: only a refusal about the persona or this document blocks */
    var blocked = !chk.ok && (chk.error.code === 'role' || /^allocations/.test(chk.error.field || ''));
    return { label: 'Pay', icon: 'wallet', variant: v.status === 'APPROVED' ? 'primary' : 'secondary', reason: blocked ? chk.error.message : '',
      onClick: function () { forms.startDraft('buy-payments', { values: { payeeType: d.payeeType, payeeId: d.payeeId, only: v.id } }); } };
  }

  function view(rootEl, ctx) {
    var v = HB.data.doc.view(ctx.docId);
    if (!v || v.type !== 'EXP') { rootEl.appendChild(forms.missingDoc(ctx.docId, { onBack: ctx.closeDoc, backLabel: 'Back to expenses' })); return; }
    var d = v.doc, kind = KIND[d.kind] ? d.kind : 'claim', K = KIND[kind];
    var row = HB.data.exp.list({ from: v.date, to: v.date }).filter(function (r) { return r.id === v.id; })[0] || {};
    /* approve, reject and cancel come from the data layer with their reasons; the page adds the payment */
    var actions = forms.docActions({
      view: v, labels: { cancel: 'Cancel the ' + K.noun },
      ask: { cancel: 'The cancellation is a document of its own, dated today. ' + (v.status === 'PENDING'
        ? 'Nothing is owed and no spend is counted on this ' + K.noun + ' yet, so nothing else moves.'
        : 'What is owed on this ' + K.noun + ' and the spend it counted are taken back today.') +
        /* an expense of an earlier month: its month keeps the spend and this month shows the cancellation, as the profit and loss does */
        (HB.dates.monthKey(v.date) !== HB.dates.monthKey(HB.calendar.today) && v.status === 'APPROVED'
          ? ' The spend stays in ' + monthName(HB.dates.monthKey(v.date)) + ', where it was counted, and comes off ' + monthName(HB.dates.monthKey(HB.calendar.today)) + '.' : '') },
      before: function (op) { return snapshot(op === 'cancel' ? HB.calendar.today : v.date); },   /* a cancellation's rows are dated today */
      moved: function (op, res, before) {
        if (op === 'approve') return approvedText(res.doc, before);
        if (op !== 'cancel') return '';               /* a rejection: the toast carries the reason */
        var moved = movedText(res.target, before);
        return (moved || 'Nothing was owed and no spend was counted on it.') + (kind === 'salary' ? ' The month is free for a new salary bill.' : '') +
          ' ' + res.doc.id + ' records the cancellation.';
      }
    });
    var pay = payAction(v, row);
    if (pay) actions.splice(v.status === 'PENDING' ? Math.max(0, actions.length - 1) : 0, 0, pay);   /* after approve and reject while it waits, first once approved */

    var approved = v.status !== 'APPROVED' ? null : {
      tone: 'info', title: 'Approved, waiting to be paid',
      text: kind === 'claim' ? 'It stays on the list of claims to reimburse until accounts pays it from cash or the bank.'
        : (kind === 'salary' ? 'It is owed as staff salaries and is paid from the bank.' : 'It is owed to the vendor and due on ' + day(d.dueDate) + '.')
    };
    rootEl.appendChild(forms.docView({
      title: forms.docTitle(d), subtitle: v.party ? v.party.name : '', status: v.status, onBack: ctx.closeDoc, backLabel: 'Back to expenses',   /* the kind names it: the document carries it */
      notice: forms.docNotice(v, { waiting: 'Every expense waits for the Owner. Nothing is owed and no spend is counted until it is approved.' }) || approved,
      meta: [
        [kind === 'claim' ? 'Reimbursed to' : 'Payee', v.party ? v.party.name : null],
        ['Category', row.categoryName || null], ['Location', row.unitName || null],
        ['Month', d.monthKey ? monthName(d.monthKey) : null],
        [kind === 'claim' ? 'Spent on' : (kind === 'salary' ? 'Dated' : 'Bill date'), day(v.date)],
        [kind === 'bill' ? 'Bill number' : 'Bill reference', d.billRef || null],
        ['Due on', kind === 'claim' ? null : day(d.dueDate)],
        ['Raised by', v.createdByName], ['Note', v.note || null]
      ],
      lines: kind !== 'salary' ? null : {
        title: 'Salary by location', subtitle: 'Those on the rolls on ' + day(v.date), rows: v.lines, footer: { unitName: 'Total', amount: d.amount },
        columns: [
          { key: 'unitName', label: 'Location' },
          { key: 'headcount', label: 'Employees', format: 'num' },
          { key: 'amount', label: 'Salary of the month', format: 'inr2' }
        ]
      },
      totals: [
        kind === 'bill' ? { label: 'Amount', sub: 'before GST', value: fmt.inr2(d.amount) } : null,
        kind === 'bill' ? { label: 'GST', sub: d.gst ? 'at ' + percent(d.gstRate) : null, value: fmt.inr2(d.gst) } : null,
        { label: kind === 'salary' ? 'Salary of the month' : (kind === 'bill' ? 'Total to pay' : 'Amount to reimburse'), value: fmt.inr2(d.total), strong: true, rule: kind === 'bill' },
        { label: 'Paid so far', value: fmt.inr2(d.paid), tone: 'muted' },
        v.status === 'APPROVED' ? { label: 'Still to pay', value: fmt.inr2(row.open) } : null
      ],
      related: forms.relatedOf(v.id), timeline: forms.timelineOf(v.id), actions: actions
    }));
  }

  /* ------------------------------------------------------------------ page */

  HB.router.register({
    id: 'expenses', route: '#/expenses', group: 'Expenses', title: 'Expenses', filters: ['date', 'unit'],
    subtitle: 'Claims and bills',
    render: function (rootEl, ctx) {
      if (ctx.docId) return view(rootEl, ctx);         /* '#/doc/EXP-...': the hash decides */
      if (ctx.state.form) return form(rootEl, ctx);    /* a draft is open: it survives redraws, persona switches and visits elsewhere */
      list(rootEl, ctx);
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
