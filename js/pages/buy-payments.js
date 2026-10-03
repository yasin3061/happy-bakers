/*
 * Payments (#/buy/payments). Claims waiting to be reimbursed, the list of payments, the form of a new payment to a
 * vendor or an employee against what is open for them, and the view of one payment.
 * Built on the pattern of js/pages/buy-orders.js (docs/PAGES.md). What is open, what an account holds and whether
 * it covers the payment are the data layer's and the engine's; the page holds the wording and the layout.
 */
(function (root) {
  'use strict';

  var HB = root.HB;
  if (!HB || !HB.router || !HB.ui || !HB.forms) return;
  var ui = HB.ui, forms = HB.forms, fmt = HB.fmt;

  function day(iso) { return ui.format('date', iso); }
  function plural(n, one, many) { return fmt.num(n) + ' ' + (n === 1 ? one : many); }
  /** The first two of a list in words, and how many more there are. */
  function few(list) { return list.slice(0, 2).join(', ') + (list.length > 2 ? ' and ' + fmt.num(list.length - 2) + ' more' : ''); }
  function payeeName(type, id) { return HB.data.lookup.payee(type, id).name; }
  function accountName(id) { return id ? HB.data.lookup.account(id).name : ''; }
  function balanceOf(id) {
    var row = HB.data.cash.balances().rows.filter(function (r) { return r.accountId === id; })[0];
    return row ? row.balance : null;
  }

  /** The accounts a payment may leave from: the factory's cash and the bank. Any other the engine refuses. */
  function payAccounts() {
    var L = HB.data.lookup, factory = L.units({ kind: 'factory' })[0], cashId = factory ? factory.cashAccountId : null;
    return L.accounts().filter(function (a) { return a.id === cashId || a.kind !== 'cash'; }).map(function (a) {
      return { value: a.id, label: a.name + ', ' + fmt.inr2(balanceOf(a.id)) + ' in it now' };
    });
  }

  /** Who can be paid: only a payee with something open, since there are no advances. */
  function payees(type) {
    if (type === 'employee') {
      var by = {}, out = [];
      HB.data.ap.toReimburse().forEach(function (c) {
        if (!by[c.payeeId]) { by[c.payeeId] = { id: c.payeeId, label: c.employeeName, n: 0 }; out.push(by[c.payeeId]); }
        by[c.payeeId].n++;
      });
      return out.map(function (x) { return { id: x.id, label: x.label, sub: plural(x.n, 'claim', 'claims') + ' to reimburse' }; });
    }
    return HB.data.ap.balances().rows.map(function (r) {
      return { id: r.payeeId, label: r.name, sub: fmt.inr2(r.open) + ' open on ' + plural(r.items, 'document', 'documents') };
    });
  }

  /* ------------------------------------------------------- what a payment moves */

  /** Read before and after the engine acts: the cash and bank balances, and what is owed to each vendor. */
  function snapshot() { return { cash: HB.data.cash.balances().rows, ap: HB.data.ap.balances().rows }; }

  /** The one line of the toast: the account that moved and what is still owed, as the selectors returned them before and return now. */
  function movedText(pay, before, cancelled) {
    var after = snapshot(), parts = [];
    forms.changes(before.cash, after.cash, 'accountId', 'balance').forEach(function (c) {
      parts.push(c.row.name + ': ' + fmt.inr2(c.before) + ' to ' + fmt.inr2(c.after) + '.');
    });
    if (pay.payeeType === 'vendor') {
      var was = before.ap.filter(function (r) { return r.payeeId === pay.payeeId; })[0], now = after.ap.filter(function (r) { return r.payeeId === pay.payeeId; })[0];
      parts.push('Owed to ' + payeeName('vendor', pay.payeeId) + ': ' + fmt.inr2(was ? was.open : 0) + ' to ' + fmt.inr2(now ? now.open : 0) + '.');
    } else if (cancelled) {
      parts.push('The claims it paid are back on the list to reimburse.');
    } else {
      var done = pay.allocations.filter(function (a) { var d = HB.data.doc.get(a.docId); return d && d.status === 'PAID'; }).map(function (a) { return a.docId; });
      parts.push(done.length ? 'Reimbursed in full: ' + few(done) + '.' : 'Part of the claim is still to reimburse.');
    }
    return parts.join(' ');
  }

  /* ------------------------------------------------------------------ list */

  function start(st, ctx, values) { st.form = forms.draft(values ? { values: values } : null); ctx.rerender(); }

  function claimsCard(st, ctx, may) {
    return ui.card({
      title: 'Claims to reimburse', subtitle: 'Approved expense claims that are not paid in full', flush: true,
      body: ui.table({
        dense: true, rows: HB.data.ap.toReimburse(), empty: 'No approved claim is waiting to be reimbursed', maxHeight: 280,
        columns: [
          { key: 'id', label: 'Claim', doc: true },
          { key: 'date', label: 'Date', format: 'date' },
          { key: 'employeeName', label: 'Employee', maxWidth: 180 },
          { key: 'categoryName', label: 'Category and location', render: ui.cells.twoLine('unitName', { maxWidth: 200 }) },
          { key: 'open', label: 'Still to pay', format: 'inr2' },
          { key: 'act', label: '', align: 'right', sortable: false, render: function (v, row) {
            return ui.button({ label: 'Pay', icon: may.ok ? 'wallet' : 'lock', size: 'sm', disabledReason: may.ok ? '' : may.reason,
              onClick: function () { start(st, ctx, { payeeType: 'employee', payeeId: row.payeeId, only: row.id }); } });
          } }
        ]
      })
    });
  }

  function paysFor(row) {
    var first = row.allocations[0];
    if (row.paysFor === 'mixed' || !first) return row.allocations.length ? 'Several kinds, ' + plural(row.allocations.length, 'document', 'documents') : '-';
    return first.typeLabel + (row.allocations.length > 1 ? ', ' + plural(row.allocations.length, 'document', 'documents') : '');
  }

  function list(rootEl, ctx) {
    var st = ctx.state, may = HB.session.can('pay.create');
    st.list = st.list || {};
    rootEl.appendChild(claimsCard(st, ctx, may));
    rootEl.appendChild(forms.docList({
      state: st.list, rows: HB.data.buy.payments(ctx.filters), title: 'Payments',
      groups: [
        { id: 'vendor', label: 'To vendors', test: function (r) { return r.status === 'POSTED' && r.payeeType === 'vendor'; } },
        { id: 'employee', label: 'To employees', test: function (r) { return r.status === 'POSTED' && r.payeeType === 'employee'; } },
        { id: 'CANCELLED', label: 'Cancelled', statuses: ['CANCELLED'] }
      ],
      search: ['id', 'payeeName', 'ref', 'accountName', 'note'], searchPlaceholder: 'Search payments', sort: { key: 'date', dir: 'desc' },
      empty: 'No payment in this range',
      columns: [
        { key: 'id', label: 'Payment' },
        { key: 'date', label: 'Paid on', format: 'date' },
        { key: 'payeeName', label: 'Paid to', maxWidth: 220 },
        { key: 'paysFor', label: 'Pays for', maxWidth: 190, render: function (v, row) { return paysFor(row); } },
        { key: 'accountName', label: 'From, and reference', render: ui.cells.twoLine('ref', { maxWidth: 170 }) },
        { key: 'amount', label: 'Amount', format: 'inr2' },
        { key: 'status', label: 'Status', render: ui.cells.status() }
      ],
      newLabel: 'New payment', newReason: may.ok ? '' : may.reason,
      onNew: function () { start(st, ctx, null); }
    }));
  }

  /* ------------------------------------------------------------------ form */

  /** What is open for the payee of the draft, as the selector gives it now. */
  function openOf(draft) { var v = draft.values; return v.payeeId ? HB.data.ap.openItems(v.payeeType, v.payeeId) : []; }

  /**
   * One line per open document of the payee, the amount starting at what is still to pay (opened from one bill or one
   * claim: only that one is filled in). Once per payee, so a redraw keeps what was typed.
   */
  function fill(draft) {
    var v = draft.values, key = (v.payeeType || '') + '|' + (v.payeeId || '');
    if (draft.linesFor === key) return;
    draft.lines = openOf(draft).map(function (x) { return { docId: x.id, amount: v.only && x.id !== v.only ? null : x.open }; });
    draft.linesFor = key;
  }

  /** draft -> the payload of docs/API.md 3.5. A line with no amount is not on the payment; the total is the engine's sum. */
  function payload(draft, form) {
    var v = draft.values;
    return {
      date: v.date, payeeType: v.payeeType, payeeId: v.payeeId, account: v.account, ref: v.ref, note: v.note,
      allocations: form.lines().map(function (l) { return { docId: l.docId, amount: l.amount }; })
    };
  }

  /**
   * The engine calls a line of a payment 'allocations[i]'; the grid of the form calls its lines 'lines[i]'. The
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

  function form(rootEl, ctx) {
    var st = ctx.state, draft = st.form, may = HB.session.can('pay.create');
    if (!draft.values.payeeType) draft.values.payeeType = 'vendor';
    fill(draft);
    function open(row) {
      var list = openOf(draft);
      for (var i = 0; i < list.length; i++) if (list[i].id === row.docId) return list[i];
      return {};
    }
    function setAll(d, f, full) {
      d.lines.forEach(function (l) { l.amount = full ? (open(l).open || null) : null; });
      d.dirty = true;
      f.grid.refresh();
      f.refresh();
    }
    rootEl.appendChild(forms.docForm({
      title: 'New payment', state: draft, backLabel: 'Back to payments', submitLabel: 'Post payment',
      submitReason: may.ok ? '' : may.reason,
      /* a payment the account cannot cover is refused on its amount: here that is the choice of account */
      fieldMap: { amount: 'account' },
      fields: [
        { key: 'payeeType', label: 'Pay', type: 'select', required: true, rebuild: true,
          options: [{ value: 'vendor', label: 'A vendor' }, { value: 'employee', label: 'An employee, for a claim' }],
          onChange: function (type, d) { d.values.payeeId = null; d.values.only = null; fill(d); } },
        { key: 'payeeId', label: 'Paid to', type: 'picker', required: true, span: 2, rebuild: true, placeholder: 'Search those with something to pay',
          options: function (d) { return payees(d.values.payeeType); },
          hint: 'Only those with something open are listed: a payment is always against a bill or a claim',
          onChange: function (id, d) { d.values.only = null; fill(d); } },
        { key: 'date', label: 'Paid on', type: 'date', required: true },
        { key: 'account', label: 'Pay from', type: 'select', required: true, span: 2, placeholder: 'Choose factory cash or the bank', options: payAccounts },
        { key: 'ref', label: 'Reference', optional: true, span: 2, maxLength: 60, placeholder: 'Cheque number, bank reference or cash voucher' },
        { key: 'note', label: 'Note', optional: true, span: 4, maxLength: 200 }
      ],
      lines: {
        title: 'What it pays', subtitle: 'Enter an amount against each document this payment covers. Leave the amount empty for one it does not.',
        addRows: false, removeRows: false, empty: 'Choose who is being paid to see what is open for them',
        columns: [
          { key: 'docId', label: 'Document', type: 'static', format: function (v) { return forms.docLink(v); } },
          { key: 'what', label: 'What', type: 'computed', value: function (row) { var x = open(row); return x.typeLabel ? x.typeLabel + (x.ref ? ', ' + x.ref : '') : null; } },
          { key: 'date', label: 'Dated', type: 'computed', format: 'date', value: function (row) { return open(row).date; } },
          { key: 'dueDate', label: 'Due on', type: 'computed', value: function (row) { return open(row).dueDate; },
            format: function (v, row) {
              var x = open(row);
              if (!v) return '-';
              return x.overdue ? ui.row([day(v), ui.chip(plural(x.daysOverdue, 'day', 'days') + ' overdue', 'warn')], { gap: 2 }) : day(v);
            } },
          { key: 'open', label: 'Still to pay', type: 'computed', format: 'inr2', footer: 'sum', value: function (row) { return open(row).open; } },
          { key: 'amount', label: 'Pay now', type: 'amount', footer: 'sum' }
        ]
      },
      panel: function (p, d) {
        var doc = p && p.ok ? p.doc : null;
        if (!d.values.payeeId) return ui.callout('neutral', 'Choose who is being paid',
          'Their open bills, expense bills or claims appear, each with what is still to pay.');
        if (!d.lines.length) return ui.callout('neutral', 'Nothing is open for this payee', 'A payment is always against a posted bill or an approved claim.');
        if (doc) return ui.callout('good', 'Posts as it is entered',
          fmt.inr2(doc.amount) + ' leaves ' + accountName(doc.account) + ', and what is owed to ' + payeeName(doc.payeeType, doc.payeeId) + ' falls by the same amount.');
        return ui.callout('neutral', 'The payment is the sum of its amounts',
          'Each amount is at most what is still to pay on its document, and the account it leaves cannot go below zero. A salary bill is paid from the bank.');
      },
      totals: function (p, d) {
        var doc = p && p.ok ? p.doc : null, acc = d.values.account;
        return [
          { label: 'Documents paid', value: doc ? fmt.num(doc.allocations.length) : '-' },
          { label: 'Payment total', sub: 'the sum of the amounts', value: doc ? fmt.inr2(doc.amount) : '-', strong: true, rule: true },
          acc ? { label: 'In ' + accountName(acc) + ' now', value: fmt.inr2(balanceOf(acc)), tone: 'muted' } : null
        ];
      },
      actions: [
        { label: 'Pay all in full', icon: 'check-circle', onClick: function (d, f) { setAll(d, f, true); } },
        { label: 'Clear the amounts', icon: 'x', variant: 'ghost', onClick: function (d, f) { setAll(d, f, false); } }
      ],
      onPreview: function (d, f) { return atLines(HB.engine.preview('PAY', payload(d, f))); },
      onSubmit: function (d, f) {
        var before = snapshot();                      /* read the selectors, act, read them again: that is what moved */
        var res = HB.engine.act('post', { type: 'PAY', payload: payload(d, f) });
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
    var v = HB.data.doc.view(ctx.docId);
    if (!v || v.type !== 'PAY') { rootEl.appendChild(forms.missingDoc(ctx.docId, { onBack: ctx.closeDoc, backLabel: 'Back to payments' })); return; }
    var d = v.doc;
    var row = HB.data.buy.payments({ from: v.date, to: v.date }).filter(function (r) { return r.id === v.id; })[0] || { allocations: [] };
    rootEl.appendChild(forms.docView({
      title: forms.docTitle(v), subtitle: v.party ? v.party.name : '', status: v.status,
      onBack: ctx.closeDoc, backLabel: 'Back to payments', notice: forms.docNotice(v),
      meta: [['Paid to', v.party ? v.party.name : null], ['Paid on', day(v.date)], ['Paid from', accountName(d.account)],
        ['Reference', d.ref || null], ['Entered by', v.createdByName], ['Note', v.note || null]],
      lines: {
        title: 'What it pays',
        columns: [
          { key: 'docId', label: 'Document', doc: true },
          { key: 'typeLabel', label: 'What' },
          { key: 'amount', label: 'Paid', format: 'inr2' }
        ],
        rows: row.allocations, footer: { typeLabel: 'Total', amount: v.amount }
      },
      totals: [{ label: 'Payment total', sub: 'the sum of the amounts', value: fmt.inr2(v.amount), strong: true }],
      related: forms.relatedOf(v.id), timeline: forms.timelineOf(v.id),
      actions: forms.docActions({
        view: v, labels: { cancel: 'Cancel the payment' },
        ask: { cancel: 'The money goes back into the account it left, and the bills or claims it paid are open again.' },
        before: snapshot,
        moved: function (op, res, before) { return op === 'cancel' ? movedText(res.target, before, true) + ' ' + res.doc.id + ' records the cancellation.' : ''; }
      })
    }));
  }

  /* ------------------------------------------------------------------ page */

  HB.router.register({
    id: 'buy-payments', route: '#/buy/payments', group: 'Buy', title: 'Payments', filters: ['date'],
    subtitle: 'To vendors and to employees',
    render: function (rootEl, ctx) {
      if (ctx.docId) return view(rootEl, ctx);
      if (ctx.state.form) return form(rootEl, ctx);
      list(rootEl, ctx);
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
