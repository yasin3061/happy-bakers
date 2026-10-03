/*
 * Home (#/home). The dashboard and Today's work (SCOPE 4.10).
 * The page draws the blocks that HB.data.dash.today(), .monthToDate() and .work() return for the persona, in the
 * order they come, and nothing else: which role gets which block is decided in the data layer (SPEC section 7).
 * Flows are shown for today and for the month to date side by side; balances as they stand now. Nothing is set
 * against another period, and nothing is forecast. The two charts are plain bars.
 */
(function (root) {
  'use strict';

  var HB = root.HB;
  if (!HB || !HB.router || !HB.ui || !HB.forms) return;
  var ui = HB.ui, h = ui.h, forms = HB.forms, fmt = HB.fmt;

  var LIST_HEIGHT = 264;   /* a list scrolls inside its card beyond about seven rows (pixels, not a business figure) */

  function day(iso) { return ui.format('date', iso); }
  /** A compact amount for the small line of a tile: the figure and its unit ("L", "Cr") never part at a line break. */
  function inr(p) { return String(fmt.inr(p)).replace(/ /g, '\u00a0'); }
  function count(n, one, many) { return fmt.num(n) + ' ' + (n === 1 ? one : many); }
  function find(list, key, id) { return (list || []).filter(function (x) { return x[key] === id; })[0] || {}; }

  /** A cell of two lines: the name in bold, a smaller line under it (a document id, a count of days). */
  function twoLine(top, under, maxWidth) {
    return h('div', { 'class': maxWidth ? 'mk-cell-clip' : null, style: maxWidth ? { maxWidth: maxWidth + 'px' } : null, title: maxWidth ? String(top) : null },
      h('div', { 'class': 'mk-strong mk-truncate' }, top), h('div', { 'class': 'mk-xs mk-muted' }, under));
  }

  /** The screen at a route, when it exists in this copy and the persona has it; else null. */
  function pageAt(route) {
    var base = String(route || '').split('?')[0];
    return HB.router.allowedPages().filter(function (p) { return p.route === base; })[0] || null;
  }
  function firstPage(routes) {
    for (var i = 0; i < routes.length; i++) { var p = pageAt(routes[i]); if (p) return p; }
    return null;
  }
  /** A tile opens the screen behind its figure, for a persona who has that screen. */
  function opener(routes) {
    var p = firstPage(routes);
    return p ? function () { HB.router.navigate(p.route); } : null;
  }
  /** The link in the head of a card: the screen that holds the full list. */
  function more(routes) {
    var p = firstPage(routes);
    return p ? ui.link(p.title, p.route, { icon: 'arrow-right' }) : null;
  }

  /* ---------------------------------------------------------------- tiles */
  /* One tile per block the persona receives. t: the block for today, m: the same block for the month to date. */

  var TILE = {
    sales: function (t, m) {
      return { label: 'Net sales today', icon: 'receipt', value: fmt.inr(t.net), sub: 'Month to date ' + inr(m.net),
        onClick: opener(['#/sell/invoices', '#/stores/dayend']) };
    },
    collections: function (t, m) {
      return { label: 'Collections today', icon: 'coins', value: fmt.inr(t.total), sub: 'Month to date ' + inr(m.total), onClick: opener(['#/sell/receipts']) };
    },
    cash: function (t) {
      var one = t.rows.length === 1;
      return { label: one ? t.rows[0].name : 'Cash and bank', icon: 'wallet', value: fmt.inr(t.total),
        sub: one ? 'Balance now' : 'Cash ' + inr(t.cashTotal) + ', bank ' + inr(t.bankTotal), onClick: opener(['#/accounts/cash']) };
    },
    spend: function (t, m) {
      return { label: 'Spend this month', icon: 'calculator', value: fmt.inr(m.total), sub: 'Today ' + inr(t.total), onClick: opener(['#/expenses']) };
    },
    production: function (t, m) {
      return { label: 'Good units made today', icon: 'factory', value: fmt.num(t.goodUnits),
        sub: 'Month to date ' + fmt.num(m.goodUnits) + (m['yield'] === null ? '' : ', yield ' + fmt.pct(m['yield'])), onClick: opener(['#/make/production']) };
    },
    receivables: function (t) {
      /* the open invoices, as the receivables screen and the card below head them; unapplied credit is not taken off */
      return { label: 'Receivables', icon: 'users', value: fmt.inr(t.open), sub: 'Overdue ' + inr(t.overdue), tone: t.overdue > 0 ? 'warn' : null,
        onClick: opener(['#/accounts/receivables', '#/sell/receipts']) };
    },
    payables: function (t) {
      return { label: 'Payables', icon: 'building', value: fmt.inr(t.open), sub: 'Overdue ' + inr(t.overdue), tone: t.overdue > 0 ? 'warn' : null,
        onClick: opener(['#/accounts/payables']) };
    },
    approvals: function (t) {
      return { label: 'Waiting for approval', icon: 'check-circle', value: fmt.num(t.count), tone: t.count ? 'warn' : null,
        sub: t.count ? t.byType.map(function (x) { return fmt.num(x.count) + ' ' + forms.typeName(x.type, x.count !== 1).toLowerCase(); }).join(', ') : 'Nothing waits',
        onClick: opener(['#/approvals']) };
    },
    lowStock: function (t) {
      return { label: 'Low stock', icon: 'box', value: fmt.num(t.count), tone: t.count ? 'warn' : null,
        sub: t.count === 1 ? 'material at or below its reorder level' : 'materials at or below their reorder level', onClick: opener(['#/stock/onhand']) };
    },
    nearExpiry: function (t) {
      return { label: 'Near-expiry stock', icon: 'clock', value: fmt.num(t.nearUnits), tone: t.expiredUnits > 0 ? 'critical' : (t.nearUnits > 0 ? 'warn' : null),
        sub: 'units near best-before, ' + fmt.num(t.expiredUnits) + ' expired', onClick: opener(['#/stock/batches']) };
    }
  };

  /* ---------------------------------------------------------------- cards */
  /* One card per block: the table behind the tile. */

  function listCard(o) {
    return ui.card({ title: o.title, subtitle: o.subtitle, actions: more(o.routes || []), flush: true, footer: o.footer,
      body: ui.table({ dense: true, maxHeight: LIST_HEIGHT, columns: o.columns, rows: o.rows, footer: o.totals, empty: o.empty }) });
  }

  var CARD = {
    sales: function (t, m) {
      var rows = m.byChannel.map(function (c) {
        var d = find(t.byChannel, 'channel', c.channel);
        return { label: c.label, today: d.net, unitsToday: d.units, month: c.net, returns: c.returns, units: c.units };
      });
      return listCard({
        title: 'Sales by channel', subtitle: 'Before GST, after stale returns', routes: ['#/sell/invoices', '#/stores/dayend'], rows: rows,
        columns: [
          { key: 'label', label: 'Channel' },
          { key: 'today', label: 'Today', format: 'inrFull' },
          { key: 'unitsToday', label: 'Units today', format: 'num' },
          { key: 'month', label: 'Month to date', format: 'inrFull' },
          { key: 'returns', label: 'Returns', format: 'inrFull', title: 'Stale returns of the month, already taken off the month to date' },
          { key: 'units', label: 'Units this month', format: 'num' }
        ],
        totals: rows.length > 1 ? { label: 'Total', today: t.net, unitsToday: t.units, month: m.net, returns: m.returns, units: m.units } : null
      });
    },

    collections: function (t, m) {
      return listCard({
        title: 'Collections', subtitle: 'Cash taken on delivery and receipts from customers', routes: ['#/sell/receipts'],
        rows: [{ label: 'In cash', today: t.cash, month: m.cash }, { label: 'Into the bank', today: t.bank, month: m.bank }],
        columns: [{ key: 'label', label: 'Received' }, { key: 'today', label: 'Today', format: 'inrFull' }, { key: 'month', label: 'Month to date', format: 'inrFull' }],
        totals: { label: 'Total', today: t.total, month: m.total }
      });
    },

    cash: function (t) {
      return listCard({
        title: 'Cash and bank', subtitle: 'Balances as they stand now', routes: ['#/accounts/cash'], rows: t.rows,
        columns: [{ key: 'name', label: 'Account' }, { key: 'balance', label: 'Balance', format: 'inr2' }],
        totals: t.rows.length > 1 ? { name: 'Total', balance: t.total } : null
      });
    },

    spend: function (t, m) {
      var rows = m.byUnit.map(function (u) { return { unitName: u.unitName, today: find(t.byUnit, 'unitId', u.unitId).amount || 0, month: u.amount }; });
      return listCard({
        title: 'Spend this month by location', subtitle: 'Approved expenses before GST, on their own date', routes: ['#/expenses'], rows: rows,
        columns: [{ key: 'unitName', label: 'Location' }, { key: 'today', label: 'Today', format: 'inrFull' }, { key: 'month', label: 'Month to date', format: 'inrFull' }],
        totals: rows.length > 1 ? { unitName: 'Total', today: t.total, month: m.total } : null,
        empty: 'No approved expense is dated this month yet'
      });
    },

    production: function (t, m) {
      var rows = m.byItem.map(function (x) {
        return { itemName: x.itemName, today: find(t.byItem, 'itemId', x.itemId).goodUnits || 0, good: x.goodUnits, rejected: x.rejectedUnits, 'yield': x['yield'], loss: x.lossValue };
      });
      return listCard({
        title: 'Production', subtitle: 'Good units made, against what the recipe expects. The shortfall at recipe cost is the production loss.',
        routes: ['#/make/production'], rows: rows,
        columns: [
          { key: 'itemName', label: 'Product', maxWidth: 170 },
          { key: 'today', label: 'Today', format: 'num', title: 'Good units made today' },
          { key: 'good', label: 'This month', format: 'num', title: 'Good units made in the month to date' },
          { key: 'rejected', label: 'Rejected', format: 'num' },
          { key: 'yield', label: 'Yield', format: 'pct' },
          { key: 'loss', label: 'Loss', format: 'inrFull' }
        ],
        totals: rows.length ? { itemName: 'Total', today: t.goodUnits, good: m.goodUnits, rejected: m.rejectedUnits, 'yield': m['yield'], loss: m.lossValue } : null,
        empty: 'No production run is dated this month yet'
      });
    },

    receivables: function (t) {
      return listCard({
        title: 'Overdue receivables', subtitle: 'Outstanding ' + fmt.inr(t.open) + ', of which ' + fmt.inr(t.overdue) + ' is past its due date',
        routes: ['#/accounts/receivables', '#/sell/receipts'], rows: t.overdueRows,
        columns: [
          { key: 'customerName', label: 'Customer', maxWidth: 220 },
          { key: 'overdue', label: 'Overdue', format: 'inrFull' },
          { key: 'oldestDue', label: 'Oldest due', format: 'date' },
          { key: 'invoices', label: 'Invoices', format: 'num', title: 'Invoices past their due date' }
        ],
        totals: t.overdueRows.length ? { customerName: 'Total', overdue: t.overdue } : null,
        empty: 'No invoice is past its due date'
      });
    },

    payables: function (t) {
      return listCard({
        title: 'Bills due this week',
        subtitle: 'Owed ' + fmt.inr(t.open) + ': ' + fmt.inr(t.overdue) + ' overdue, ' + fmt.inr(t.dueSoon) + ' falling due within ' + count(HB.masters.limits.dueSoonDays, 'day', 'days'),
        routes: ['#/accounts/payables'], rows: t.dueRows,
        columns: [
          { key: 'name', label: 'Payee and bill', render: function (v, row) { return twoLine(v, forms.docLink(row.id), 220); } },
          { key: 'dueDate', label: 'Due on', render: function (v, row) {
            return twoLine(day(v), row.overdue ? count(row.daysOverdue, 'day', 'days') + ' overdue' : (row.daysToDue ? 'Due in ' + count(row.daysToDue, 'day', 'days') : 'Due today'));
          } },
          { key: 'open', label: 'To pay', format: 'inrFull' }
        ],
        empty: 'No bill falls due this week',
        footer: h('span', { 'class': 'mk-small mk-muted' }, t.claims ? count(t.claims, 'approved claim', 'approved claims') + ' to reimburse: ' + fmt.inr2(t.toReimburse) : 'No approved claim waits to be reimbursed')
      });
    },

    approvals: function (t) {
      return listCard({
        title: 'Pending approvals', subtitle: 'Documents that wait for the Owner', routes: ['#/approvals'], rows: t.byType,
        columns: [{ key: 'label', label: 'Type' }, { key: 'count', label: 'Waiting', format: 'num' }],
        totals: t.byType.length > 1 ? { label: 'Total', count: t.count } : null,
        empty: 'Nothing is waiting for approval'
      });
    },

    lowStock: function (t) {
      return listCard({
        title: 'Low stock', subtitle: 'Materials at or below their reorder level', routes: ['#/stock/onhand'], rows: t.rows,
        columns: [
          { key: 'itemName', label: 'Material', maxWidth: 220 },
          { key: 'available', label: 'Available', format: 'qty' },
          { key: 'reorderLevel', label: 'Reorder level', format: 'qty' },
          { key: 'onOrder', label: 'On order', format: 'qty' }
        ],
        empty: 'Every material is above its reorder level'
      });
    },

    nearExpiry: function (t) {
      return listCard({
        title: 'Near-expiry stock', subtitle: 'Batches on hand that are past or close to their best-before date', routes: ['#/stock/batches'], rows: t.rows,
        columns: [
          { key: 'itemName', label: 'Product and batch', render: function (v, row) { return twoLine(v, forms.docLink(row.batchId), 170); } },
          { key: 'locName', label: 'Location', maxWidth: 150 },
          { key: 'bestBefore', label: 'Best before', render: function (v, row) { return twoLine(day(v), row.flagLabel); } },
          { key: 'qty', label: 'On hand', format: 'qty' }
        ],
        empty: 'No batch is near its best-before date'
      });
    }
  };

  /* --------------------------------------------------------- today's work */
  /*
   * Each kind of work, the screen that does it and how that screen is opened ready for the item: the form of the
   * page on a prefilled draft (forms.startDraft, the draft named after the payload of docs/API.md 3.5) where the
   * work is a new document; the document itself where it is an action on one. A dispatch sheet is opened by its
   * sheet id, which is the id of the work item: '#/doc/DS-...' brings up that route and date.
   */

  var WORK = {
    sheet: { noun: 'Route', act: 'Post the sheet', icon: 'truck', go: function (it) { HB.router.openDoc(it.id); } },
    transfer_send: { noun: 'Store', act: 'Send stock', icon: 'send', page: 'stores-transfers',
      draft: function (it) { return { values: { toStoreId: it.ref.storeId, date: it.ref.date } }; } },
    transfer_confirm: { noun: 'Store', act: 'Confirm receipt', icon: 'check', doc: true },
    receipt: { noun: 'Vendor', act: 'Receive goods', icon: 'box', page: 'buy-receipts',
      draft: function (it) { return { values: { poId: it.ref.poId } }; } },
    production: { noun: 'Product', act: 'Record the run', icon: 'factory', page: 'make-production',
      draft: function (it) { return { values: { itemId: it.ref.itemId, date: it.ref.date } }; } },
    dayend: { noun: 'Store', act: 'Enter the day-end', icon: 'store', page: 'stores-dayend',
      draft: function (it) { return { values: { storeId: it.ref.storeId, date: it.ref.date } }; } },
    approval: { noun: 'Document', act: 'Approve or reject', look: 'See the evidence', icon: 'check-circle',
      go: function (it, g) { HB.router.navigate(g.route, { doc: it.id }); } }
  };

  function startWork(g, W, it) {
    if (typeof W.go === 'function') return W.go(it, g);
    if (W.doc && it.docId) return HB.router.openDoc(it.docId);
    if (W.page && typeof W.draft === 'function') return forms.startDraft(W.page, W.draft(it));
    return HB.router.navigate(g.route);
  }

  /** A line of text with the document id in it turned into a link to the document. */
  function linked(text, docId) {
    var s = String(text || ''), at = docId ? s.indexOf(docId) : -1;
    return at === -1 ? s : [s.slice(0, at), forms.docLink(docId), s.slice(at + docId.length)];
  }

  function workButton(g, W, it, page) {
    /* reading what waits is open to whoever has the approvals screen; deciding is the Owner's, and the screen says so */
    var look = !it.can.ok && W.look && page;
    var reason = look ? '' : (!it.can.ok ? it.can.reason : (page ? '' : 'This role does not have the screen for it'));
    var btn = ui.button({ label: look ? W.look : W.act, icon: reason ? 'lock' : (look ? 'eye' : W.icon), size: 'sm',
      variant: it.can.ok && !reason ? 'primary' : 'secondary', disabledReason: reason, title: look ? it.can.reason : null,
      onClick: function () { startWork(g, W, it); } });
    btn.setAttribute('data-work', it.id);
    return btn;
  }

  function workCard(g) {
    var W = WORK[g.kind] || { noun: 'To do', act: 'Open', icon: 'arrow-right' }, page = pageAt(g.route);
    var locked = g.items.filter(function (it) { return !it.can.ok; });
    var same = locked.length === g.items.length && locked.every(function (it) { return it.can.reason === locked[0].can.reason; });
    return ui.card({
      title: [g.label, ' ', ui.chip(fmt.num(g.count), 'info')], subtitle: same ? locked[0].can.reason : null,
      actions: page ? ui.link(page.title, page.route, { icon: 'arrow-right' }) : null, flush: true, className: 'pg-home__work',
      body: ui.table({ dense: true, maxHeight: LIST_HEIGHT, rows: g.items, columns: [
        { key: 'title', label: W.noun, render: function (v, it) {
          return twoLine(linked(it.title, it.docId), it.text ? linked(it.text, it.docId) : null);
        } },
        { key: 'act', label: '', align: 'right', sortable: false, render: function (v, it) { return workButton(g, W, it, page); } }
      ] })
    });
  }

  function workSection(work) {
    var title = ui.sectionTitle('Today\'s work', day(work.date) + ': ' + (work.count ? count(work.count, 'thing', 'things') + ' to do' : 'nothing is waiting'));
    if (!work.groups.length) {
      return [title, ui.card({ body: ui.emptyState('Nothing is waiting for you today', 'History runs to the day before the business date. What you post today shows here and in the figures above.', { icon: 'check-circle', compact: true }) })];
    }
    return [title, ui.grid(2, work.groups.map(workCard), { start: true, className: 'pg-home__grid' })];
  }

  /* --------------------------------------------------------------- charts */
  /* Drawn for a persona who receives the sales block, from the two period series the data layer has: by day and by month. */

  function barChart(id, title, subtitle, header, res) {
    return HB.charts.mount(null, {
      id: id, kind: 'bar', title: title, subtitle: subtitle, format: 'inr', height: 240,
      data: { categories: res.rows.map(function (r) { return r.label; }), values: res.rows.map(function (r) { return r.net; }), name: 'Net sales', categoryHeader: header },
      emptyText: 'No sales in this range'
    }).el;
  }

  function charts(month) {
    if (!HB.charts || typeof HB.charts.mount !== 'function') return null;
    var byDay = HB.data.sell.by('day', { from: month.from, to: month.to });
    var byMonth = HB.data.sell.by('month', { from: HB.calendar.goLive, to: month.to });
    return ui.grid(2, [
      barChart('home-by-day', 'Net sales this month by day', HB.filters.rangeLabel(byDay), 'Day', byDay),
      barChart('home-by-month', 'Net sales by month since go-live', HB.filters.rangeLabel(byMonth), 'Month', byMonth)
    ], { start: true, className: 'pg-home__grid' });
  }

  /* ----------------------------------------------------------------- page */

  HB.router.register({
    id: 'home', route: '#/home', group: 'Home', title: 'Dashboard', navLabel: 'Dashboard', filters: [],
    render: function (rootEl) {
      var today = HB.data.dash.today(), month = HB.data.dash.monthToDate(), work = HB.data.dash.work();
      var blocks = today.blocks;

      ui.append(rootEl,
        ui.sectionTitle('Today and month to date', day(today.from) + ', and ' + HB.filters.rangeLabel(month)),
        ui.kpiRow(blocks.map(function (id) { return TILE[id] ? TILE[id](today[id], month[id]) : null; })),
        workSection(work),
        ui.sectionTitle('Behind the figures', 'What moved today and in the month to date, and what stands now'),
        ui.grid(2, blocks.map(function (id) { return CARD[id] ? CARD[id](today[id], month[id]) : null; }), { start: true, className: 'pg-home__grid' }),
        blocks.indexOf('sales') !== -1 ? charts(month) : null,
        forms.teaser({ title: 'Sales forecast with suggested production; 30/60/90-day cash projection', tier: 'NeoX' }));
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
