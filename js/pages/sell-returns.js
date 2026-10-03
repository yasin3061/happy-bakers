/*
 * Stale returns (#/sell/returns). The list with its Held tab, the form of a new return for an outlet, and the view of
 * one return with what it was set against. Built on the pattern of js/pages/buy-orders.js (docs/PAGES.md).
 * The share of the outlet's supply, the limit, the days it is measured over and where the return lands are the
 * engine's (HB.engine.preview); the page holds the wording and the layout, and no rule.
 */
(function (root) {
  'use strict';

  var HB = root.HB;
  if (!HB || !HB.router || !HB.ui || !HB.forms) return;
  var ui = HB.ui, h = ui.h, forms = HB.forms, fmt = HB.fmt;

  var DESTROYED = 'The returned stock is destroyed, not restocked.';
  var COST_STAYS = 'Nothing comes back into the finished store, and the cost of the goods stays in cost of goods sold, where the invoice posted it.';

  function day(iso) { return ui.format('date', iso); }
  function item(id) { return HB.data.lookup.item(id); }
  function customer(id) { return HB.data.lookup.customer(id); }
  function rateText(rate) { return rate > 0 ? fmt.num(rate) + '%' : 'Nil'; }
  /** A share as the engine stores it (a percentage with two decimals), in words. */
  function shareText(pct) { return pct === null || pct === undefined ? 'No supply' : fmt.pct(pct / 100, 2); }
  /** A limit in words: a whole percentage is written without decimals. */
  function capText(pct) { return fmt.pct(pct / 100, pct === Math.round(pct) ? 0 : 2); }
  /** The limit up to which a return posts at once. The figure is the master's. */
  function limitText() { return capText(HB.masters.limits.returnsPct); }
  function sentence(text) { var s = String(text || ''); return s ? s.charAt(0).toUpperCase() + s.slice(1) + (/[.]$/.test(s) ? '' : '.') : ''; }
  /** The first two of a list in words, and how many more there are. */
  function few(list) { return list.slice(0, 2).join(', ') + (list.length > 2 ? ' and ' + fmt.num(list.length - 2) + ' more' : ''); }

  /* ------------------------------------------------------- what a return moves */

  /** Read before and after the engine acts: what each customer owes. */
  function snapshot() { return HB.data.ar.balances().rows; }
  function balanceOf(rows, customerId) {
    var row = rows.filter(function (r) { return r.customerId === customerId; })[0];
    return row ? row.balance : 0;
  }

  /** What the outlet owes before and after, as the selector returned it and returns it now. */
  function balanceText(cn, before) {
    return 'Balance of ' + customer(cn.customerId).name + ': ' + fmt.inr2(balanceOf(before, cn.customerId)) + ' to ' + fmt.inr2(balanceOf(snapshot(), cn.customerId)) + '.';
  }

  /** Where the engine put the credit: the invoices it allocated, and what it kept on account. */
  function settledText(cn) {
    var parts = [];
    if (cn.allocations.length) parts.push('Set against ' + few(cn.allocations.map(function (a) { return a.docId; })) + '.');
    if (cn.onAccount > 0) parts.push(fmt.inr2(cn.onAccount) + ' is kept as credit for the next invoice.');
    return parts.join(' ');
  }

  /** The one line of the toast after entering a return. */
  function landed(cn, before) {
    if (cn.status === 'HELD') {
      return sentence(cn.holdReason) + ' It waits for the Owner, and the outlet\'s balance does not move until it is approved.';
    }
    return [balanceText(cn, before), settledText(cn), 'Sales and GST fall by the credit.', DESTROYED].filter(Boolean).join(' ');
  }

  /* ------------------------------------------------------------------ list */

  function list(rootEl, ctx) {
    var st = ctx.state, may = HB.session.can('cn.create');
    st.list = st.list || {};
    /* a return that waits is listed whatever the date range says; the range limits the others */
    var rows = forms.uniqueRows(HB.data.sell.creditNotes({ status: 'HELD' }), HB.data.sell.creditNotes(ctx.filters));
    rootEl.appendChild(forms.docList({
      state: st.list, rows: rows,
      subtitle: 'A return above ' + limitText() + ' of the outlet\'s recent supply waits for the Owner. Held returns are always listed. ' + DESTROYED,
      statuses: ['HELD', 'POSTED', 'REJECTED', 'CANCELLED'],
      search: ['id', 'customerName', 'note'], searchPlaceholder: 'Search returns', sort: { key: 'date', dir: 'desc' },
      empty: 'No stale return in this range',
      columns: [
        { key: 'id', label: 'Return' },
        { key: 'date', label: 'Date', format: 'date' },
        { key: 'customerName', label: 'Outlet', maxWidth: 180 },
        { key: 'total', label: 'Credit', format: 'inr2' },
        { key: 'sharePct', label: 'Share of supply', align: 'right', render: function (v, row) {
          var over = v === null || v === undefined || v > row.limitPct;
          return over ? h('span', { 'class': 'mk-warn', title: sentence(row.holdReason) || 'Above the limit of ' + capText(row.limitPct) }, ui.icon('alert-triangle', 14), ' ', shareText(v)) : shareText(v);
        } },
        /* the tab says "Held for approval" in full; the chip is short so that six columns fit the narrowest window */
        { key: 'status', label: 'Status', render: function (v) { return ui.statusChip(v, v === 'HELD' ? { label: 'Held' } : null); } }
      ],
      newLabel: 'New stale return', newReason: may.ok ? '' : may.reason,
      onNew: function () { st.form = forms.draft(); ctx.rerender(); }
    }));
  }

  /* ------------------------------------------------------------------ form */

  /**
   * The days a return of this outlet on this date is measured over, with the supply and the other returns in them:
   * what the engine's preview answers for one unit of any product. Null while the outlet or the date is missing, or
   * when the engine refuses (a date it does not take, a role that may not enter a return).
   */
  function windowOf(customerId, date) {
    var any = HB.data.lookup.items({ kind: 'fg' })[0];
    if (!customerId || !date || !any) return null;
    var p = HB.engine.preview('CN', { date: date, customerId: customerId, lines: [{ itemId: any.id, qty: 1 }] });
    return p && p.ok ? p.returns : null;
  }

  /** The products on the outlet's invoices of those days, in the order of the item master. */
  function supplied(customerId, date) {
    var w = windowOf(customerId, date), seen = {};
    if (!w) return [];
    HB.data.sell.invoices({ from: w.from, to: w.to, status: 'POSTED', customerId: customerId, opening: false }).forEach(function (r) {
      (r.doc.lines || []).forEach(function (l) { seen[l.itemId] = true; });
    });
    return HB.data.lookup.items({ kind: 'fg' }).filter(function (it) { return seen[it.id]; }).map(function (it) { return it.id; });
  }

  /**
   * One line per product the outlet was supplied, the quantity empty. Once per outlet and date, so a redraw keeps
   * what was typed; when only the date moves, the quantities already typed stay with their products.
   */
  function fill(draft) {
    var v = draft.values, key = (v.customerId || '') + '|' + (v.date || '');
    if (draft.linesFor === key) return;
    var typed = {}, order = [];
    if (draft.linesCustomer === v.customerId) {
      (draft.lines || []).forEach(function (l) { if (l.itemId && l.qty > 0 && !typed[l.itemId]) { typed[l.itemId] = l.qty; order.push(l.itemId); } });
    }
    var ids = supplied(v.customerId, v.date);
    draft.lines = ids.map(function (id) { return { itemId: id, qty: typed[id] || null, fixed: true }; });
    order.forEach(function (id) { if (ids.indexOf(id) === -1) draft.lines.push({ itemId: id, qty: typed[id] }); });
    if (!draft.lines.length) draft.lines.push({});      /* nothing was supplied in those days: one empty line to choose a product on */
    draft.linesFor = key;
    draft.linesCustomer = v.customerId || null;
  }

  /** The price list of the outlet's channel for a product: the price a return is credited at. */
  function listPrice(itemId, customerId) {
    var prices = itemId ? item(itemId).price : null, channel = customerId ? customer(customerId).channel : null;
    return prices && channel && prices[channel] > 0 ? prices[channel] : null;
  }

  /** The line of the previewed return for a product: the engine's price and value. */
  function previewLine(p, itemId) {
    var lines = p && p.ok && p.doc ? p.doc.lines : [];
    for (var i = 0; i < lines.length; i++) if (lines[i].itemId === itemId) return lines[i];
    return null;
  }

  /** draft -> the payload of docs/API.md 3.5. The price is left to the engine: the price list of the outlet. */
  function payload(draft, form) {
    var v = draft.values;
    return {
      date: v.date, customerId: v.customerId, note: v.note,
      lines: form.lines().map(function (l) { return { itemId: l.itemId, qty: l.qty || 0 }; })
    };
  }

  /** What the engine says will happen on posting: preview.outcome, in words. */
  function outcome(p) {
    var o = p && p.ok ? p.outcome : null, r = p && p.ok ? p.returns : null;
    if (!o) return { tone: 'neutral', short: '-', title: 'Approval',
      text: 'A return up to ' + limitText() + ' of the outlet\'s supply posts at once. Above that it waits for the Owner.' };
    if (o.waits) return { tone: 'warn', short: 'Waits for the Owner', title: 'Waits for the Owner',
      text: sentence(r.reason) + ' The outlet\'s balance moves only when the Owner approves it.' };
    if (o.self) return { tone: 'info', short: 'Approved as your own', title: 'Above the limit: approved as your own return',
      text: sentence(r.reason) + ' As the Owner you approve it as you post it, and the audit log says so.' };
    return { tone: 'good', short: 'Posts at once', title: 'Posts at once',
      text: 'The share is within the limit of ' + capText(r.limitPct) + '. The credit is set against the outlet\'s open invoices, oldest first, and what is left is kept for its next invoice.' };
  }

  /** Left of the totals: this return's share of the outlet's supply against the limit, and where it will land. */
  function sharePanel(p, draft) {
    var v = draft.values;
    if (!v.customerId) return ui.callout('neutral', 'Choose the outlet', 'Its products appear, one line each. ' + outcome(null).text + ' ' + DESTROYED);
    var r = p && p.ok ? p.returns : null, w = r || windowOf(v.customerId, v.date), o = outcome(p);
    if (!w) return ui.callout(o.tone, o.title, o.text + ' ' + DESTROYED);
    var days = day(w.from) + ' to ' + day(w.to);
    var facts = [['Supplied to the outlet, before GST', fmt.inr2(w.supply)], ['Other returns in these days', fmt.inr2(w.returned)]];
    var body;
    if (!r) {
      body = [ui.keyValue(facts), h('p', { 'class': 'mk-small mk-muted mk-mt-2' }, 'Enter the units returned to see the share. ' + o.text)];
    } else {
      facts.push(['This return', fmt.inr2(r.thisReturn)]);
      body = [
        r.sharePct === null || r.sharePct === undefined ? null : ui.meter({
          label: 'Returns of these days against the limit', value: r.sharePct, max: r.limitPct,
          valueLabel: shareText(r.sharePct) + ' of supply, limit ' + capText(r.limitPct), tone: r.held ? 'critical' : 'good'
        }),
        h('div', { 'class': 'mk-mt-3' }, ui.keyValue(facts)),
        h('div', { 'class': 'mk-mt-3' }, ui.callout(o.tone, o.title, o.text))
      ];
    }
    return ui.card({ title: 'Share of the outlet\'s supply', subtitle: days, body: [body, h('p', { 'class': 'mk-small mk-muted mk-mt-2' }, DESTROYED + ' ' + COST_STAYS)] });
  }

  function totalsOf(p) {
    var d = p && p.ok ? p.doc : null, o = outcome(p);
    return [
      { label: 'Units returned', value: d ? fmt.num(d.units) : '-' },
      { label: 'Before GST', value: d ? fmt.inr2(d.taxable) : '-' },
      { label: 'GST', sub: 'CGST and SGST', value: d ? fmt.inr2(d.gst) : '-' },
      { label: 'Credit to the outlet', value: d ? fmt.inr2(d.total) : '-', strong: true, rule: true },
      { label: 'On posting', value: o.short, tone: o.tone === 'good' ? 'good' : (o.tone === 'warn' ? 'bad' : 'muted') }
    ];
  }

  function form(rootEl, ctx) {
    var st = ctx.state, draft = forms.draft(st.form), may = HB.session.can('cn.create');
    if (!draft.values.date) draft.values.date = HB.calendar.today;
    fill(draft);
    function unit(row) { return row.itemId ? item(row.itemId).unit : ''; }
    function price(row, p) { var l = previewLine(p, row.itemId); return l ? l.price : listPrice(row.itemId, draft.values.customerId); }   /* draft is the state object itself, never a copy */

    rootEl.appendChild(forms.docForm({
      title: 'New stale return', state: draft, backLabel: 'Back to returns', submitLabel: 'Post return',
      subtitle: 'Stale goods taken back from an outlet become a credit note',
      submitReason: may.ok ? '' : may.reason,
      fields: [
        { key: 'customerId', label: 'Outlet', type: 'party', kind: 'customer', required: true, span: 2, rebuild: true,
          filter: function (c) { return c.channel === 'retail'; },
          hint: 'Each product is credited at the outlet\'s price.',
          onChange: function (id, d) { fill(d); } },
        { key: 'date', label: 'Returned on', type: 'date', required: true, rebuild: true, onChange: function (iso, d) { fill(d); } },
        { key: 'route', label: 'Route', type: 'static', text: function (d) { return d.values.customerId ? (customer(d.values.customerId).routeName || '-') : '-'; } },
        { key: 'note', label: 'Note', optional: true, span: 4, maxLength: 200, placeholder: 'Why the goods came back' }
      ],
      lines: {
        title: 'Products returned', addLabel: 'Add product', minRows: 1,
        subtitle: 'One line for each product supplied to the outlet in the days shown below. Enter the units that came back.',
        columns: [
          { key: 'itemId', label: 'Product', type: 'item', kind: 'fg', required: true, width: '34%',
            readOnly: function (row) { return !!row.fixed; },
            filter: function (it, row, rows) { return rows.every(function (r) { return r === row || r.itemId !== it.id; }); } },   /* a product goes on one line */
          { key: 'qty', label: 'Returned', type: 'qty', decimals: 0, unit: unit, required: true },
          { key: 'price', label: 'Outlet price', type: 'computed', format: 'rate', title: 'The price list of the outlet. It cannot be changed here.',
            value: function (row, index, p) { return row.itemId ? price(row, p) : null; } },
          { key: 'gstRate', label: 'GST', type: 'computed', align: 'right', value: function (row) { return row.itemId ? rateText(item(row.itemId).gstRate) : null; } },
          /* the engine's value once the preview has the line; while it is typed, HB.money.amount, the function the engine itself calls */
          { key: 'amount', label: 'Before GST', type: 'computed', format: 'inr2', footer: 'sum',
            value: function (row, index, p) {
              var l = previewLine(p, row.itemId), at = price(row, p);
              if (l && l.qty === row.qty) return l.taxable;
              return row.qty > 0 && at > 0 ? HB.money.amount(row.qty, at) : null;
            } }
        ]
      },
      panel: sharePanel,
      totals: totalsOf,
      onPreview: function (d, f) { return HB.engine.preview('CN', payload(d, f)); },
      onSubmit: function (d, f) {
        var before = snapshot();                      /* read the selector, act, read it again: that is what moved */
        var res = HB.engine.act('post', { type: 'CN', payload: payload(d, f) });
        if (!res.ok) return res;                      /* the form shows the refusal at the field or the line it names */
        st.form = null;
        forms.postedToast(res.doc, landed(res.doc, before));
        ctx.openDoc(res.doc.id);
        return res;
      },
      onCancel: function () { st.form = null; ctx.rerender(); }
    }));
  }

  /* ------------------------------------------------------------------ view */

  /** The share the return was raised with, against the limit, as the list row carries them. */
  function shareSection(row) {
    var none = row.sharePct === null || row.sharePct === undefined, over = none || row.sharePct > row.limitPct;
    return { title: 'Share of the outlet\'s supply', subtitle: 'As worked out when the return was entered', body: [
      none ? null : ui.meter({ label: 'Returns against the limit', value: row.sharePct, max: row.limitPct,
        valueLabel: shareText(row.sharePct) + ' of supply, limit ' + capText(row.limitPct), tone: over ? 'critical' : 'good' }),
      h('p', { 'class': ['mk-small', 'mk-muted', none ? '' : 'mk-mt-2'] },
        over ? (sentence(row.holdReason) || 'Above the limit of ' + capText(row.limitPct) + '.') + ' A return like this needs the Owner.'
          : 'Within the limit of ' + capText(row.limitPct) + ': it posted as it was entered.')
    ] };
  }

  /** What the credit was set against: the invoices the engine allocated it to, and what it kept on account. */
  function settledSection(v, row) {
    var d = v.doc;
    if (v.status === 'HELD') return { title: 'Set against', body: h('p', { 'class': 'mk-small mk-muted' },
      'Nothing yet. When the Owner approves it, the credit goes against the outlet\'s open invoices, oldest first, and what is left is kept for its next invoice.') };
    if (v.status !== 'POSTED') return null;
    return { title: 'Set against', subtitle: 'The outlet\'s open invoices, oldest first', flush: true,
      body: ui.table({ dense: true, rows: d.allocations, empty: 'No invoice was open: the whole credit is kept for the outlet\'s next invoice',
        columns: [
          { key: 'docId', label: 'Invoice', doc: true },
          { key: 'amount', label: 'Credited', format: 'inr2' }
        ],
        footer: d.allocations.length ? { docId: 'Total', amount: row.allocated } : null }) };
  }

  function view(rootEl, ctx) {
    var v = HB.data.doc.view(ctx.docId);
    if (!v || v.type !== 'CN') { rootEl.appendChild(forms.missingDoc(ctx.docId, { onBack: ctx.closeDoc, backLabel: 'Back to returns' })); return; }
    var d = v.doc, c = customer(d.customerId);
    var row = HB.data.sell.creditNotes({ from: v.date, to: v.date }).filter(function (r) { return r.id === v.id; })[0] || {};
    var was = v.status;                               /* a cancellation of a held return takes nothing back */

    var actions = forms.docActions({
      view: v, labels: { cancel: 'Cancel the return' },
      ask: { cancel: was === 'HELD' ? 'The return has moved nothing yet. The cancellation is recorded with the reason you give.'
        : 'The outlet owes the credit again: the invoices it was set against are open again, credit it left on account is withdrawn, and sales and GST go back up.' },
      before: snapshot,
      moved: function (op, res, before) {
        if (op === 'approve') return [balanceText(res.doc, before), settledText(res.doc), 'Sales and GST fall by the credit.', DESTROYED].filter(Boolean).join(' ');
        if (op === 'cancel') return (was === 'HELD' ? 'Nothing had moved on it.' : balanceText(res.target, before)) + ' ' + res.doc.id + ' records the cancellation.';
        return '';                                    /* a rejection: the toast carries the reason */
      }
    });

    rootEl.appendChild(forms.docView({
      title: forms.docTitle(v), subtitle: v.party.name, status: v.status,
      onBack: ctx.closeDoc, backLabel: 'Back to returns',
      notice: forms.docNotice(v, { waiting: sentence(d.holdReason) + ' Nothing moves until it is approved.' }),
      meta: [
        ['Outlet', c.name],
        ['Route', c.routeName || null],
        ['Returned on', day(v.date)],
        ['Entered by', v.createdByName],
        ['Note', v.note || null]
      ],
      lines: {
        title: 'Products returned',
        columns: [
          { key: 'itemName', label: 'Product' },
          { key: 'qty', label: 'Returned', format: 'qty' },                 /* 'qty' reads row.unit */
          { key: 'price', label: 'Outlet price', format: 'rate' },
          { key: 'gstRate', label: 'GST', align: 'right', render: function (x) { return rateText(x); } },
          { key: 'taxable', label: 'Before GST', format: 'inr2' }
        ],
        rows: v.lines, footer: { itemName: 'Total', taxable: d.taxable }
      },
      totals: [
        { label: 'Before GST', value: fmt.inr2(d.taxable) },
        { label: 'GST', sub: 'CGST and SGST', value: fmt.inr2(d.gst) },
        { label: 'Credit to the outlet', value: fmt.inr2(d.total), strong: true, rule: true },
        v.status === 'POSTED' ? { label: 'Set against invoices', value: fmt.inr2(row.allocated), tone: 'muted' } : null,
        v.status === 'POSTED' ? { label: 'Kept for the next invoice', sub: 'credit on account', value: fmt.inr2(row.onAccount), tone: 'muted' } : null
      ],
      sections: [
        shareSection(row),
        settledSection(v, row),
        ui.callout('neutral', DESTROYED, COST_STAYS)
      ],
      related: forms.relatedOf(v.id), timeline: forms.timelineOf(v.id), actions: actions
    }));
  }

  /* ------------------------------------------------------------------ page */

  HB.router.register({
    id: 'sell-returns', route: '#/sell/returns', group: 'Sell', title: 'Stale returns', filters: ['date'],
    subtitle: 'Goods taken back from outlets',
    render: function (rootEl, ctx) {
      if (ctx.docId) return view(rootEl, ctx);         /* '#/doc/CN-...': the hash decides */
      if (ctx.state.form) return form(rootEl, ctx);    /* a draft is open: it survives redraws, persona switches and visits elsewhere */
      list(rootEl, ctx);
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
