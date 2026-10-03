/*
 * Approvals (#/approvals). Everything that waits for the Owner, grouped by type, each with what is needed to decide:
 * the three-way differences of a held bill, the returns share of a held note, the lines of a count or a write-off,
 * an expense with its category and location (HB.data.approvals.pending()).
 * Approve and reject go through HB.engine.act; a rejection needs a reason. The toast says what moved: the page reads
 * the selectors before and after the engine acts and names what differs. It computes nothing itself.
 * A persona who may not decide sees both buttons, locked, with the reason in words.
 */
(function (root) {
  'use strict';

  var HB = root.HB;
  if (!HB || !HB.router || !HB.ui || !HB.forms) return;
  var ui = HB.ui, h = ui.h, forms = HB.forms, fmt = HB.fmt;

  var WO_REASON = { expired: 'Past best-before', damaged: 'Damaged', other: 'Other' };
  var TAB = { PO: 'Orders', VBILL: 'Bills', CN: 'Returns', WO: 'Write-offs', ADJ: 'Stock counts', EXP: 'Expenses' };   /* short, so that seven tabs fit at 1024px */

  function day(iso) { return ui.format('date', iso); }
  function sentence(s) { s = String(s || ''); return s && !/[.?]$/.test(s) ? s + '.' : s; }
  function capital(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
  /** A percentage as the engine stores it (12.8 is 12.8%). */
  function percent(p) { return p === null || p === undefined ? '-' : fmt.num(p, p % 1 ? 2 : 0) + '%'; }
  /** A GST rate as the forms show it: "Nil" for a rate of zero. */
  function gstRate(p) { return p ? percent(p) : 'Nil'; }
  /**
   * The quantity "at" its rate, where that one rate gives the value beside it. Receipts or bill lines at different rates
   * add up to a value no single rate explains: then the rate is left out and the value speaks for itself.
   */
  function at(qty, unit, rate, value) {
    var one = typeof rate === 'number' && HB.money.amount(qty, rate) === value;
    return fmt.qty(qty, unit) + (one ? ' at ' + fmt.rate(rate) : (qty ? ', more than one rate' : ''));
  }
  /** The first two of a list in words, and how many more there are. */
  /** A value with what it is made of under it. */
  function side(value, under) { return h('div', null, h('div', { 'class': 'mk-num' }, fmt.inr2(value)), h('div', { 'class': 'mk-xs mk-muted' }, under)); }
  function few(list) { return list.slice(0, 2).join(', ') + (list.length > 2 ? ' and ' + fmt.num(list.length - 2) + ' more' : ''); }
  function find(list, key, id) { return (list || []).filter(function (x) { return x[key] === id; })[0] || null; }
  function links(ids) {
    var out = [];
    (ids || []).forEach(function (id, i) { if (i) out.push(', '); out.push(forms.docLink(id)); });
    return out.length ? h('span', null, out) : null;
  }
  function lines(columns, rows, footer) { return ui.table({ dense: true, columns: columns, rows: rows, footer: footer || null }); }

  /* ------------------------------------------------------------- evidence */
  /* What the approver looks at, by type. Every figure is the selector's (docs/API.md 4.16). */

  var EVIDENCE = {
    PO: function (e) {
      return [
        ui.keyValue([['Vendor', e.vendorName], ['Expected on', day(e.expectedDate)], ['Order value', fmt.inr2(e.total)],
          ['Approved as submitted up to', fmt.inr2(e.limit)], ['Above that by', fmt.inr2(e.over)]], { cols: 2 }),
        lines([
          { key: 'itemName', label: 'Item', maxWidth: 240 },
          { key: 'qty', label: 'Ordered', format: 'qty' },
          { key: 'rate', label: 'Rate', format: 'rate' },
          { key: 'latestRate', label: 'Latest price', format: 'rate', title: 'The rate of the goods receipt posted last' },
          { key: 'amount', label: 'Amount', format: 'inr2' }
        ], e.lines, { itemName: 'Total, before GST', amount: e.total })
      ];
    },

    VBILL: function (e) {
      return [
        ui.keyValue([['Vendor', e.vendorName], ['Bill number', e.billNo], ['Due on', day(e.dueDate)], ['Before GST', fmt.inr2(e.taxable)],
          ['GST', fmt.inr2(e.gst)], ['Bill total', fmt.inr2(e.total)],
          ['Goods receipts', links(e.receipts.map(function (r) { return r.id; }))], ['Purchase orders', links(e.orderIds)]], { cols: 2 }),
        h('div', { 'class': 'mk-label' }, 'Order, receipt and bill, item by item'),
        lines([
          { key: 'itemName', label: 'Item', maxWidth: 180 },
          /* each side is one cell, the value over what it is made of: three columns of figures fit at 1024px */
          { key: 'expected', label: 'Order and receipt', align: 'right', title: 'What the bill should come to: the quantity accepted on the goods receipts, at the rate of the order',
            render: function (v, row) { return side(v, at(row.acceptedQty, row.unit, row.orderedRate, row.expected)); } },
          { key: 'billed', label: 'On the bill', align: 'right', title: 'What the bill says: the quantity and the rate billed',
            render: function (v, row) { return side(v, at(row.billedQty, row.unit, row.billedRate, row.billed)); } },
          { key: 'diff', label: 'Difference', align: 'right', render: function (v, row) {
            return h('div', { 'class': 'pg-approvals__diff' }, h('div', null, fmt.inr2(v) + ' (' + fmt.pct(row.diffPct, 2) + ')'), ui.statusChip(row.ok ? 'MATCHED' : 'MISMATCH'));
          } }
        ], e.diffs),
        h('div', { 'class': 'mk-small mk-muted' }, 'A bill is held when an item is more than ' + percent(e.tolerancePct) + ' away from its order and receipts, either way.')
      ];
    },

    CN: function (e) {
      var none = e.sharePct === null || e.sharePct === undefined;
      return [
        ui.keyValue([['Outlet', e.customerName], ['Route', e.routeName || null], ['Return, before GST', fmt.inr2(e.taxable)], ['GST', fmt.inr2(e.gst)],
          ['Credit to the outlet', fmt.inr2(e.total)]], { cols: 2 }),
        none ? ui.callout('neutral', 'No supply to measure it against', 'The outlet was not supplied from ' + day(e.from) + ' to ' + day(e.to) + ', so the return has no share of supply.')
          : ui.meter({ value: e.sharePct, max: e.limitPct, tone: 'critical', label: 'Returns as a share of the supply from ' + day(e.from) + ' to ' + day(e.to),
            valueLabel: percent(e.sharePct) + ' against a limit of ' + percent(e.limitPct) }),
        ui.keyValue([['Supplied in those days', fmt.inr2(e.supply)], ['Other returns in those days', fmt.inr2(e.otherReturns)],
          ['This return', fmt.inr2(e.thisReturn)]], { stacked: true }),
        lines([
          { key: 'itemName', label: 'Item', maxWidth: 240 },
          { key: 'qty', label: 'Returned', format: 'qty' },
          { key: 'price', label: 'Price', format: 'rate' },
          { key: 'gstRate', label: 'GST rate', align: 'right', format: function (v) { return gstRate(v); } },
          { key: 'taxable', label: 'Value before GST', format: 'inr2' }
        ], e.lines, { itemName: 'Total', taxable: e.taxable })
      ];
    },

    ADJ: function (e) {
      return [
        ui.keyValue([['Location', e.locName], ['Reason given', e.reason || null], ['Value of the differences', fmt.inr2(e.value)]], { cols: 2 }),
        lines([
          { key: 'itemName', label: 'Item', maxWidth: 220 },
          { key: 'batchId', label: 'Batch', doc: true },
          { key: 'systemQty', label: 'In the books', format: 'qty' },
          { key: 'countedQty', label: 'Counted', format: 'qty' },
          { key: 'diff', label: 'Difference', format: 'qty' },
          { key: 'value', label: 'Value', format: 'inr2' },
          { key: 'onHandNow', label: 'On hand now', format: 'qty', title: 'Stock may have moved since the count was entered' }
        ], e.lines, { itemName: 'Total', value: e.value })
      ];
    },

    WO: function (e) {
      return [
        ui.keyValue([['Location', e.locName], ['Reason', WO_REASON[e.reason] || capital(e.reason)],
          ['From the day-end', e.sourceDocId ? forms.docLink(e.sourceDocId) : null], ['Value to write off', fmt.inr2(e.value)]], { cols: 2 }),
        lines([
          { key: 'itemName', label: 'Item', maxWidth: 220 },
          { key: 'batchId', label: 'Batch', doc: true },
          { key: 'bestBefore', label: 'Best before', format: 'date' },
          { key: 'qty', label: 'Quantity', format: 'qty' },
          { key: 'rate', label: 'Unit cost', format: 'rate' },
          { key: 'value', label: 'Value', format: 'inr2' }
        ], e.lines, { itemName: 'Total', value: e.value })
      ];
    },

    EXP: function (e) {
      var salary = e.kind === 'salary', claim = e.kind === 'claim';
      /* a claim has no GST and no due date: it is reimbursed to the employee who paid */
      return [
        ui.keyValue([['Kind', e.kindLabel], [claim ? 'Reimbursed to' : 'Payee', e.payeeName], ['Category', e.categoryName], ['Location', e.unitName],
          ['Month', e.monthKey ? HB.dates.monthLabel(e.monthKey, true) : null], [e.kind === 'bill' ? 'Bill number' : 'Bill reference', e.billRef || null],
          e.kind === 'bill' ? ['Amount before GST', fmt.inr2(e.amount)] : null, e.kind === 'bill' ? ['GST', e.gst ? fmt.inr2(e.gst) + ' at ' + percent(e.gstRate) : 'None'] : null,
          [claim ? 'Amount to reimburse' : (salary ? 'Salary of the month' : 'Total to pay'), fmt.inr2(e.total)], claim ? null : ['Due on', day(e.dueDate)]].filter(Boolean), { cols: 2 }),
        salary && e.lines.length ? lines([
          { key: 'unitName', label: 'Location' },
          { key: 'headcount', label: 'Employees', format: 'num' },
          { key: 'amount', label: 'Salary of the month', format: 'inr2' }
        ], e.lines, { unitName: 'Total', amount: e.amount }) : null
      ];
    }
  };

  /* ------------------------------------------------------ what moved */

  function monthOf(date) { return { from: HB.dates.monthStart(date), to: HB.dates.monthEnd(date) }; }

  /** The selectors an approval or a rejection of this document can move, read before and after the engine acts. */
  function snapshot(it) {
    var D = HB.data, e = it.evidence, s = {};
    if (it.type === 'VBILL' || it.type === 'EXP') { s.owed = D.ap.balances().rows; s.dash = D.dash.today().payables || {}; }
    if (it.type === 'VBILL') s.unbilled = D.buy.openReceipts(e.vendorId);
    if (it.type === 'EXP') s.spend = D.exp.byUnit(monthOf(it.date));
    if (it.type === 'CN') { s.owes = D.ar.balances().rows; s.notes = D.sell.creditNotes({ from: it.date, to: it.date, customerId: e.customerId }); }
    if (it.type === 'WO' || it.type === 'ADJ') { s.stock = D.stock.onHand(e.locId); s.pnl = D.pnl.month(HB.dates.monthKey(it.date)); }
    return s;
  }

  function value(rows, key, id, field) { var r = find(rows, key, id); return r ? r[field] : 0; }
  function fromTo(label, before, after) { return before === after ? '' : label + ': ' + fmt.inr2(before) + ' to ' + fmt.inr2(after) + '.'; }
  function stockMoves(before, after, field) {
    return forms.changes(before, after, 'itemId', field).map(function (c) { return c.row.itemName + ' ' + fmt.qty(c.before, c.row.unit) + ' to ' + fmt.qty(c.after, c.row.unit); });
  }

  /** The line of the toast after an approval: what the selectors show now against what they showed before. */
  function approved(it, before) {
    var e = it.evidence, now = snapshot(it), out = [], moves;
    switch (it.type) {
      case 'PO':
        out.push('Goods can now be received against it. Stock and the purchase price move when they are.');
        break;
      case 'VBILL':
        out.push(fromTo('Owed to ' + e.vendorName, value(before.owed, 'payeeId', e.vendorId, 'open'), value(now.owed, 'payeeId', e.vendorId, 'open')));
        out.push('It is due on ' + day(e.dueDate) + '.');
        break;
      case 'CN':
        out.push(fromTo('Balance of ' + e.customerName, value(before.owes, 'customerId', e.customerId, 'balance'), value(now.owes, 'customerId', e.customerId, 'balance')));
        var note = find(now.notes, 'id', it.id);
        if (note) out.push('Set against its open invoices: ' + fmt.inr2(note.allocated) + '. Kept as credit: ' + fmt.inr2(note.onAccount) + '.');
        out.push('Sales of ' + day(it.date) + ' are lower by the return.');
        break;
      case 'WO':
      case 'ADJ':
        moves = stockMoves(before.stock, now.stock, 'qty');
        out.push(moves.length ? 'Stock at ' + e.locName + ': ' + few(moves) + '.' : 'No quantity moved at ' + e.locName + '.');
        out.push(it.type === 'WO' ? fromTo('Write-offs of ' + now.pnl.label, before.pnl.writeoff, now.pnl.writeoff)
          : fromTo('Count differences of ' + now.pnl.label, before.pnl.countDiff, now.pnl.countDiff));
        break;
      case 'EXP':
        if (e.kind === 'claim') out.push(fromTo('Claims to reimburse', before.dash.toReimburse, now.dash.toReimburse));
        else out.push(fromTo('Owed to ' + e.payeeName, value(before.owed, 'payeeId', e.payeeId, 'open'), value(now.owed, 'payeeId', e.payeeId, 'open')));
        out.push(e.kind === 'salary' ? fromTo('Spend of ' + HB.dates.monthLabel(HB.dates.monthKey(it.date), true), before.spend.totals.amount, now.spend.totals.amount)
          : fromTo('Spend of ' + e.unitName + ' in ' + HB.dates.monthLabel(HB.dates.monthKey(it.date), true),
            value(before.spend.rows, 'unitId', e.unitId, 'amount'), value(now.spend.rows, 'unitId', e.unitId, 'amount')));
        break;
    }
    return out.filter(Boolean).join(' ');
  }

  /** The line of the toast after a rejection: the reason, and what the rejection set free. Nothing is posted. */
  function rejected(it, before, reason) {
    var e = it.evidence, now = snapshot(it), out = ['Reason: ' + sentence(reason)];
    if (it.type === 'VBILL') {
      var was = {}, free;
      before.unbilled.forEach(function (r) { was[r.id] = true; });
      free = now.unbilled.filter(function (r) { return !was[r.id]; }).map(function (r) { return r.id; });
      out.push(free.length ? 'Nothing is owed on it. ' + few(free) + ' can be billed again.' : 'Nothing is owed on it.');
    } else if (it.type === 'WO') {
      var back = stockMoves(before.stock, now.stock, 'available');
      out.push(back.length ? 'The stock stays in the books and is free again: ' + few(back) + '.' : 'The stock stays in the books.');
    } else if (it.type === 'ADJ') {
      out.push('The books stay as they were at ' + e.locName + '.');
    } else if (it.type === 'CN') {
      out.push(e.customerName + ' gets no credit: its balance is unchanged.');
    } else {
      out.push('Nothing was posted.');
    }
    return out.join(' ');
  }

  /* -------------------------------------------------------------- actions */

  function approve(it) {
    var before = snapshot(it);                               /* read the selectors, act, read them again: that is what moved */
    var res = HB.engine.act('approve', { id: it.id });       /* the store change redraws the screen */
    if (!res.ok) { forms.fail(res, 'Not approved'); return; }
    forms.postedToast(res.doc, approved(it, before), { verb: 'approved', tone: 'good' });
  }

  function reject(it) {
    forms.confirmWithReason({
      title: 'Reject ' + it.id + '?', confirmLabel: 'Reject', cancelLabel: 'Back',
      message: 'Nothing is posted for a rejected document. ' + it.raisedByName + ' sees your reason on it.'
    }).then(function (r) {
      if (!r.ok) return;
      var before = snapshot(it);
      var res = HB.engine.act('reject', { id: it.id, reason: r.reason });
      if (!res.ok) { forms.fail(res, 'Not rejected'); return; }
      forms.postedToast(res.doc, rejected(it, before, r.reason), { verb: 'rejected', tone: 'info' });
    });
  }

  /** Both buttons are always there. One the persona may not use is locked, and the reason stands beside it in words. */
  function decide(it) {
    /* locked for the same cause, the two buttons share one sentence; Reject keeps its own as a tooltip */
    var why = [], same = !it.canApprove.ok && !it.canReject.ok && it.canApprove.code === it.canReject.code;
    (same ? [it.canApprove] : [it.canApprove, it.canReject]).forEach(function (c) { if (!c.ok && c.reason && why.indexOf(c.reason) === -1) why.push(c.reason); });
    var yes = ui.button({ label: 'Approve', icon: it.canApprove.ok ? 'check' : 'lock', variant: 'primary', disabledReason: it.canApprove.ok ? '' : it.canApprove.reason,
      onClick: function () { approve(it); } });
    var no = ui.button({ label: 'Reject', icon: it.canReject.ok ? 'x' : 'lock', disabledReason: it.canReject.ok ? '' : it.canReject.reason,
      onClick: function () { reject(it); } });
    yes.setAttribute('data-approve', it.id);
    no.setAttribute('data-reject', it.id);
    return ui.row([yes, no, why.length ? h('span', { 'class': 'mk-small mk-muted pg-approvals__why' }, ui.icon('lock', 14), ' ', why.map(sentence).join(' ')) : null], { wrap: true, gap: 3 });
  }

  /* ----------------------------------------------------------------- page */

  function card(it, focus) {
    var panel = EVIDENCE[it.type] ? EVIDENCE[it.type](it.evidence) : [];
    var el = ui.card({
      className: 'pg-approvals__item' + (focus ? ' is-focus' : ''),
      title: [it.typeLabel, ' ', forms.docLink(it.id)],
      subtitle: [it.party, 'dated ' + day(it.date), 'raised by ' + it.raisedByName + ' on ' + ui.dateTime(it.raisedAt)].filter(Boolean).join(', '),
      actions: [h('span', { 'class': 'mk-strong mk-num' }, fmt.inr2(it.amount)), ui.statusChip(it.status)],
      body: ui.stack([
        ui.callout('warn', 'Why it waits', sentence(it.reason)),
        /* a figure the engine found unusual when the document was entered: the approver decides knowing it */
        it.warning ? ui.callout('warn', 'Entered with a warning', sentence(it.warning)) : null,
        panel,
        it.note ? h('div', { 'class': 'mk-small mk-muted' }, 'Note: ', it.note) : null
      ], 3),
      footer: decide(it)
    });
    el.setAttribute('data-doc', it.id);
    return el;
  }

  HB.router.register({
    id: 'approvals', route: '#/approvals', group: 'Home', title: 'Approvals', filters: [],
    subtitle: 'What waits for the Owner',
    render: function (rootEl, ctx) {
      var st = ctx.state, res = HB.data.approvals.pending(), may = HB.session.can('approve.*');
      var focus = ctx.params.doc && find(res.items, 'id', ctx.params.doc) ? ctx.params.doc : null;
      if (focus && st.focus !== focus) { st.focus = focus; st.tab = 'all'; }             /* a link from Today's work: that document first */
      if (!focus) st.focus = null;
      if (st.tab && st.tab !== 'all' && !find(res.groups, 'type', st.tab)) st.tab = 'all';   /* the last one of a type was decided */
      var tab = st.tab || 'all';

      rootEl.appendChild(may.ok
        ? ui.callout('neutral', 'You decide these as the Owner', 'An approval posts the document on its own date, with the figures it was raised with. A rejection needs a reason and posts nothing.')
        : ui.callout('info', sentence(may.reason), 'You can read what waits and why. Approve and Reject stay locked for this role.', { icon: 'lock' }));

      if (!res.count) {
        rootEl.appendChild(ui.card({ body: ui.emptyState('Nothing is waiting for approval',
          'A purchase order above the limit, a bill that does not match, a return above the limit, a stock count, a write-off and every expense come here.', { icon: 'check-circle' }) }));
        return;
      }

      rootEl.appendChild(ui.tabs({
        ariaLabel: 'Waiting documents by type', value: tab,
        items: [{ id: 'all', label: 'All', count: res.count }].concat(res.groups.map(function (g) { return { id: g.type, label: TAB[g.type] || capital(forms.typeName(g.type, true)), count: g.count }; })),
        onChange: function (id) { st.tab = id; ctx.rerender(); }
      }));

      var first = focus ? find(res.items, 'id', focus) : null;
      if (first && (tab === 'all' || tab === first.type)) {
        rootEl.appendChild(ui.sectionTitle('Opened from Today\'s work'));
        rootEl.appendChild(card(first, true));
      }
      res.groups.forEach(function (g) {
        if (tab !== 'all' && tab !== g.type) return;
        var items = g.items.filter(function (it) { return it.id !== focus; });
        if (!items.length) return;
        rootEl.appendChild(ui.sectionTitle(capital(forms.typeName(g.type, true)), fmt.num(g.count) + ' waiting, the oldest first'));
        items.forEach(function (it) { rootEl.appendChild(card(it, false)); });
      });
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
