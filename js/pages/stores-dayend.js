/*
 * Store day-end (#/stores/dayend). For one store: what is still to do today, three tiles (sales, stock value, cash
 * in the till), the list of its day-ends, the form of a new one and the view of one with its write-off.
 * Built on the pattern of js/pages/buy-orders.js (docs/PAGES.md). A day-end is entered once per store and day:
 * units sold and units expired per product, the cash counted and the UPI total. The engine works out the sales at
 * MRP, the GST inside them and the cash short or excess, and puts the expired units on a write-off request.
 * Every figure comes from HB.data or HB.engine; the page holds the wording and the layout, and no rule.
 */
(function (root) {
  'use strict';

  var HB = root.HB;
  if (!HB || !HB.router || !HB.ui || !HB.forms) return;
  var ui = HB.ui, h = ui.h, forms = HB.forms, fmt = HB.fmt;

  function day(iso) { return ui.format('date', iso); }
  function item(id) { return HB.data.lookup.item(id); }
  function store(id) { return HB.data.lookup.unit(id); }
  function unitsText(n) { return fmt.num(n) + (n === 1 ? ' unit' : ' units'); }
  function muted(text) { return h('span', { 'class': 'mk-muted' }, text); }
  function first(list, test) { for (var i = 0; i < list.length; i++) if (test(list[i])) return list[i]; return null; }

  /* the status of a write-off in a word, for the narrow column of the list */
  var WRITE_OFF = { PENDING: 'Waiting', POSTED: 'Approved', REJECTED: 'Rejected', CANCELLED: 'Cancelled' };

  /** The expense category the engine posts a cash difference to, by its name in the masters. */
  function shortCategory() { return HB.data.lookup.category(HB.masters.shortExcessCategoryId).name; }

  /** Cash and UPI against the sales at MRP, in words. The figure is the engine's shortExcess; only its sign is read here. */
  function shortWords(x) {
    if (x < 0) return { tone: 'bad', label: 'Cash short', text: 'Short by ' + fmt.inr2(-x), value: fmt.inr2(-x) };
    if (x > 0) return { tone: 'muted', label: 'Cash in excess', text: 'Over by ' + fmt.inr2(x), value: fmt.inr2(x) };
    return { tone: 'good', label: 'Cash short or excess', text: 'Matches the sales', value: 'None' };
  }

  /** The row of the list selector for one day-end: it carries the expired units and the status of the write-off. */
  function rowOf(doc) {
    return first(HB.data.stores.dayEnds({ from: doc.date, to: doc.date, storeId: doc.storeId }), function (r) { return r.id === doc.id; }) || {};
  }

  /* -------------------------------------------------------- what a day-end moves */

  /** The one line of the toast: the figures of the day-end the engine returned, and where its write-off landed. */
  function postedText(doc, wo) {
    var x = shortWords(doc.shortExcess), row = rowOf(doc);
    var parts = ['Sales of ' + store(doc.storeId).name + ': ' + fmt.inr2(doc.gross) + ' at MRP, ' + fmt.inr2(doc.taxable) + ' before GST.'];
    /* only what moved is named: a day with no UPI does not say the bank is up by nothing */
    if (doc.units > 0) parts.push('Store stock down by ' + unitsText(doc.units) + '.');
    if (doc.cash > 0 && doc.upi > 0) parts.push('Cash in the till up by ' + fmt.inr2(doc.cash) + ', bank up by ' + fmt.inr2(doc.upi) + '.');
    else if (doc.cash > 0) parts.push('Cash in the till up by ' + fmt.inr2(doc.cash) + '.');
    else if (doc.upi > 0) parts.push('Bank up by ' + fmt.inr2(doc.upi) + '.');
    if (doc.shortExcess !== 0) parts.push(x.text + ', posted to "' + shortCategory() + '".');
    if (wo && wo.status === 'PENDING') parts.push(unitsText(row.expiredUnits) + ' expired: ' + wo.id + ' waits for the Owner.');
    else if (wo) parts.push(unitsText(row.expiredUnits) + ' expired: written off on ' + wo.id + ', approved as your own.');
    return parts.join(' ');
  }

  function cancelledText(doc) {
    return 'Store stock up by ' + unitsText(doc.units) + '. Sales of ' + fmt.inr2(doc.gross) + ' at MRP, the cash and the UPI total are taken back' +
      (doc.woId ? ', and the write-off request ' + doc.woId + ' is cancelled with it.' : '.');
  }

  /* ------------------------------------------------------------------ list */

  /** The stores the persona deals with, and the one on screen: the one chosen, else the first. */
  function pick(st) {
    var stores = HB.data.lookup.stores({ active: 'all' });
    return { stores: stores, store: first(stores, function (s) { return s.id === st.storeId; }) || stores[0] || null };
  }

  function start(st, ctx, storeId, date) {
    st.form = forms.draft({ values: date ? { storeId: storeId, date: date } : { storeId: storeId } });
    ctx.rerender();
  }

  /** One tab per store, each saying whether today's day-end is still to enter. A persona with one store gets no tabs. */
  function storeTabs(st, ctx, sel, pending) {
    function chip(s) {
      var p = first(pending, function (x) { return x.storeId === s.id; });
      if (!p) return s.active === false ? ui.chip('Closed', 'neutral') : null;
      return p.dayEndMissing ? ui.chip('Day-end to enter', 'warn') : ui.chip('Day-end entered', 'good');
    }
    return ui.card({ title: 'Own stores', subtitle: 'The tiles and the day-ends below are of the store chosen here',
      body: ui.tabs({ ariaLabel: 'Store', value: sel.store.id,
        items: sel.stores.map(function (s) { return { id: s.id, label: [s.name, ' ', chip(s)] }; }),
        onChange: function (id) { st.storeId = id; if (st.list) st.list.page = 0; ctx.rerender(); } }) });
  }

  /** What is still to do at the store on the business date: a transfer to confirm, the day-end to enter. */
  function todayBlock(st, ctx, s, p, may) {
    var out = [];
    if (!p) return out;
    if (p.transfersSent.length) {
      out.push(ui.callout('warn', p.transfersSent.length === 1 ? 'A transfer is on the way to ' + s.name : fmt.num(p.transfersSent.length) + ' transfers are on the way to ' + s.name,
        [p.transfersSent.map(function (t, i) { return [i ? ', ' : '', forms.docLink(t.id)]; }),
          '. The units cannot be sold or entered in a day-end until the store confirms receipt: open the transfer to confirm it.']));
    }
    if (p.dayEndMissing) {
      out.push(ui.callout('info', 'The day-end of ' + day(p.date) + ' is still to enter',
        'Units sold and units expired per product, the cash counted and the UPI total. One day-end per store and day.',
        { actions: ui.button({ label: 'Enter the day-end', icon: may.ok ? 'plus' : 'lock', variant: 'primary', disabledReason: may.ok ? '' : may.reason,
          onClick: function () { start(st, ctx, s.id, p.date); } }) }));
    } else if (p.dayEndId) {
      out.push(ui.callout('good', 'The day-end of ' + day(p.date) + ' is entered', [forms.docLink(p.dayEndId), ' holds the sales, the cash and the expired units of the day.']));
    }
    return out;
  }

  /** Sales of the range, the stock of the store at today's cost and the cash in its till, each from its selector. */
  function tiles(s, f) {
    var sales = HB.data.sell.summary({ from: f.from, to: f.to, unitId: s.id, channel: 'store' });
    var stock = first(HB.data.stock.value().rows, function (r) { return r.locId === s.locId; });
    var cash = first(HB.data.cash.balances().rows, function (r) { return r.accountId === s.cashAccountId; });
    return ui.kpiRow([
      { label: 'Sales before GST', value: fmt.inr(sales.net), sub: unitsText(sales.units) + ' sold, ' + HB.filters.rangeLabel(sales), icon: 'receipt' },
      { label: 'Stock value', value: fmt.inr(stock ? stock.value : null), sub: 'On hand now, at today\'s cost', icon: 'box' },
      { label: 'Cash in the till', value: fmt.inr(cash ? cash.balance : null), sub: 'As it stands now', icon: 'wallet' }
    ]);
  }

  function list(rootEl, ctx) {
    var st = ctx.state, sel = pick(st), s = sel.store;
    if (!s) { rootEl.appendChild(ui.emptyState('No store', 'Own stores are kept under Masters, as locations.', { icon: 'store' })); return; }
    st.storeId = s.id;                               /* the choice holds once made */
    st.list = st.list || {};
    var may = HB.session.can('dayend.create', { doc: { storeId: s.id } });
    var pending = HB.data.stores.pending();
    if (sel.stores.length > 1) rootEl.appendChild(storeTabs(st, ctx, sel, pending));
    ui.append(rootEl, todayBlock(st, ctx, s, first(pending, function (x) { return x.storeId === s.id; }), may), tiles(s, ctx.filters));
    rootEl.appendChild(forms.docList({
      state: st.list, rows: HB.data.stores.dayEnds({ from: ctx.filters.from, to: ctx.filters.to, storeId: s.id }), title: 'Day-ends of ' + s.name,
      statuses: ['POSTED', 'CANCELLED'],
      search: ['id', 'woId', 'note'], searchPlaceholder: 'Search day-ends', sort: { key: 'date', dir: 'desc' },
      empty: 'No day-end in this range',
      columns: [
        { key: 'id', label: 'Day-end' },
        { key: 'date', label: 'Day', format: 'date' },
        { key: 'units', label: 'Units', title: 'Units sold', format: 'num' },
        { key: 'gross', label: 'Sales', title: 'Units sold at MRP, which includes GST', format: 'inr2' },
        { key: 'shortExcess', label: 'Collected', title: 'Cash and UPI against the sales at MRP', render: function (v) { return v === 0 ? muted('Matches') : (v < 0 ? 'Short ' : 'Over ') + shortWords(v).value; } },
        /* the write-off of the expired units by its status; its id is on the day-end's own view, and the search finds it */
        { key: 'woId', label: 'Write-off', title: 'The write-off request for the expired units', render: function (v, row) {
          return v ? ui.statusChip(row.woStatus, { label: WRITE_OFF[row.woStatus], title: v + ': ' + HB.data.lookup.statusLabel(row.woStatus) }) : muted('None');
        } },
        { key: 'status', label: 'Status', render: ui.cells.status() }
      ],
      newLabel: 'New day-end', newReason: may.ok ? '' : may.reason,
      onNew: function () { start(st, ctx, s.id, null); }
    }));
  }

  /* ------------------------------------------------------------------ form */

  /** The stock of the draft's store as the selector gives it now, by item ({} while no store is chosen). */
  function held(draft) {
    var id = draft.values.storeId, out = {};
    if (id) HB.data.stock.onHand(store(id).locId).forEach(function (r) { out[r.itemId] = r; });
    return out;
  }

  /**
   * One line per product kept at the store. The draft holds only what is typed (sold, expired); what is on hand is
   * read from the selector as the cells are drawn. A change of store starts the lines again; otherwise a product
   * that has since reached the store is added and nothing typed is lost.
   */
  function fill(draft) {
    var key = draft.values.storeId || '', stock = held(draft), has = {};
    if (draft.linesFor !== key || !Array.isArray(draft.lines)) { draft.lines = []; draft.linesFor = key; }
    draft.lines.forEach(function (l) { has[l.itemId] = true; });
    Object.keys(stock).forEach(function (itemId) { if (!has[itemId]) draft.lines.push({ itemId: itemId, sold: null, expired: null }); });
  }

  /** draft -> the payload of docs/API.md 3.5. Every line of the grid goes, in order: the engine drops a line with neither sold nor expired units. */
  function payload(draft) {
    var v = draft.values;
    return {
      date: v.date, storeId: v.storeId, cash: v.cash || 0, upi: v.upi || 0, note: v.note,
      lines: (draft.lines || []).map(function (l) { return { itemId: l.itemId, sold: l.sold || 0, expired: l.expired || 0 }; })
    };
  }

  /** The stock behind line i of the draft, from the preview (docs/API.md 3.7): what may be sold, what may be entered as expired. */
  function stockOf(p, index, row) {
    var s = p && p.stock ? p.stock[index] : null;
    return s && s.itemId === row.itemId ? s : {};
  }

  /** The line of the previewed day-end for a product. The engine drops empty lines, so they are matched by item. */
  function previewLine(p, itemId) {
    return p && p.ok && p.doc ? first(p.doc.lines, function (l) { return l.itemId === itemId; }) : null;
  }

  /**
   * Where the write-off of the previewed day-end will land. The preview of a day-end gives the write-off as it is
   * raised and an outcome for the day-end alone, so the engine is asked about a write-off with the same lines:
   * its outcome says whether this persona's request waits or is approved as its own. No rule is written here.
   */
  function writeOffOutcome(wo) {
    var p = HB.engine.preview('WO', { date: wo.date, locId: wo.locId, reason: wo.reason,
      lines: wo.lines.map(function (l) { return { itemId: l.itemId, batchId: l.batchId, qty: l.qty }; }) });
    return p.ok && p.outcome ? p.outcome : { status: wo.status, waits: wo.status === 'PENDING', self: false };
  }

  /** Under the grid: a day-end already entered, the cash against the sales, and where the expired units go. */
  function panelOf(p, draft) {
    if (!draft.values.storeId) return ui.callout('neutral', 'Choose the store', 'Its products appear with what is on hand, what is in date and can be sold, and what has reached its best-before.');
    var out = [], err = p && !p.ok ? p.error : null, doc = p && p.ok ? p.doc : null, wo = p && p.ok && p.docs ? p.docs[1] : null;
    if (err && err.code === 'duplicate' && err.docId) {
      out.push(ui.callout('critical', 'This day is already entered', [err.message + '. Open ', forms.docLink(err.docId), '. A store has one day-end for a day: cancel that one to enter the day again.']));
    }
    if (!doc) {
      out.push(ui.callout('neutral', 'What posting does',
        'The units sold leave the store\'s stock, the oldest batch in date first. Sales are the units sold at MRP, reported before the GST inside it. The cash goes to the store\'s till and the UPI total to the bank. Expired units go on a write-off request for the Owner.'));
      return out;
    }
    var x = shortWords(doc.shortExcess), cat = shortCategory();
    if (doc.shortExcess < 0) {
      out.push(ui.callout('warn', 'Cash and UPI are short by ' + x.value,
        'They come to less than the sales at MRP. The shortage is posted as an expense of the store under "' + cat + '".'));
    } else if (doc.shortExcess > 0) {
      out.push(ui.callout('info', 'Cash and UPI are over by ' + x.value,
        'They come to more than the sales at MRP. The excess is posted under "' + cat + '" and reduces the store\'s expenses.'));
    } else {
      out.push(ui.callout('good', 'Cash and UPI match the sales at MRP', 'Nothing is posted as short or excess.'));
    }
    if (wo && writeOffOutcome(wo).waits) {
      out.push(ui.callout('warn', 'The expired units go on a write-off request, worth ' + fmt.inr2(wo.value) + ' at cost',
        'The request waits for the Owner. Until it is approved the units stay in the store\'s stock, set aside so that nothing else takes them.'));
    } else if (wo) {
      out.push(ui.callout('info', 'The expired units are written off as you post, worth ' + fmt.inr2(wo.value) + ' at cost',
        'As the Owner you approve the write-off of your own day-end in the same step, and the audit log says so.'));
    } else {
      out.push(ui.callout('neutral', 'No expired units', 'No write-off request is raised.'));
    }
    return out;
  }

  function totalsOf(p) {
    var doc = p && p.ok ? p.doc : null, wo = p && p.ok && p.docs ? p.docs[1] : null;
    var x = doc ? shortWords(doc.shortExcess) : { label: 'Cash short or excess', value: '-', tone: 'muted' };
    function money(key) { return doc ? fmt.inr2(doc[key]) : '-'; }
    return [
      { label: 'Units sold', value: doc ? fmt.num(doc.units) : '-' },
      { label: 'Sales at MRP', value: money('gross'), strong: true, rule: true },
      { label: 'GST inside it', value: money('gst'), tone: 'muted' },
      { label: 'Sales before GST', value: money('taxable') },
      { label: 'Cash counted', value: money('cash'), rule: true },
      { label: 'UPI total', value: money('upi') },
      { label: x.label, sub: 'cash and UPI against the sales at MRP', value: x.value, tone: x.tone },
      { label: 'Expired units to write off', sub: 'at cost, on a write-off request', value: wo ? fmt.inr2(wo.value) : (doc ? 'None' : '-'), rule: true }
    ];
  }

  function form(rootEl, ctx) {
    var st = ctx.state, draft = st.form;
    var stores = HB.data.lookup.stores();
    if (!draft.values.storeId && stores.length === 1) draft.values.storeId = stores[0].id;   /* the store manager has one store */
    fill(draft);
    function may() { return HB.session.can('dayend.create', draft.values.storeId ? { doc: { storeId: draft.values.storeId } } : undefined); }
    function unit(row) { return row.itemId ? item(row.itemId).unit : ''; }
    rootEl.appendChild(forms.docForm({
      title: 'New day-end', state: draft, backLabel: 'Back to day-ends', submitLabel: 'Post day-end',
      submitReason: function () { var m = may(); return m.ok ? '' : m.reason; },
      fields: [
        { key: 'storeId', label: 'Store', type: 'picker', required: true, span: 2, rebuild: true, placeholder: 'Choose a store',
          options: function () { return HB.data.lookup.stores().map(function (s) { return { id: s.id, label: s.name }; }); },
          onChange: function (id, d) { fill(d); } },
        { key: 'date', label: 'Day', type: 'date', required: true, hint: 'One day-end per store and day' },
        { key: 'note', label: 'Note', optional: true, maxLength: 200, placeholder: 'Anything about the day' },
        { key: 'cash', label: 'Cash counted', type: 'amount', span: 2, hint: 'The cash of the day\'s sales. It goes to the store\'s till.' },
        { key: 'upi', label: 'UPI total', type: 'amount', span: 2, hint: 'The UPI collections of the day. They go to the bank.' }
      ],
      lines: {
        title: 'Products', addRows: false, removeRows: false, empty: 'Choose a store to see its products',
        subtitle: 'Whole units. Expired units can come only from batches at or past their best-before on the day.',
        columns: [
          { key: 'itemId', label: 'Product and MRP', type: 'static', format: function (v) {
            if (!v) return '-';
            var it = item(v);
            return h('span', null, it.name, it.price ? h('span', { 'class': 'mk-muted mk-small' }, ' ' + fmt.inr2(it.price.mrp)) : null);
          } },
          { key: 'onHand', label: 'On hand', type: 'computed', format: 'num', title: 'In the store now, by the books',
            value: function (row) { var r = held(draft)[row.itemId]; return r ? r.qty : null; } },
          { key: 'canSell', label: 'In date', type: 'computed', format: 'num', title: 'What can be sold: in date on the day, and not set aside on a write-off request that waits',
            value: function (row, index, p) { return stockOf(p, index, row).available; } },
          { key: 'sold', label: 'Sold', type: 'int', unit: unit, footer: 'sum' },
          { key: 'expirable', label: 'At best-before', type: 'computed', format: 'num', title: 'What can be entered as expired: at or past best-before on the day, after the units sold',
            value: function (row, index, p) { return stockOf(p, index, row).expirable; } },
          { key: 'expired', label: 'Expired', type: 'int', unit: unit, footer: 'sum' },
          /* the engine's line once it previews; until then the line as typed, through HB.money.amount, the function the engine itself calls */
          { key: 'gross', label: 'Sales at MRP', type: 'computed', format: 'inr2',
            value: function (row, index, p) {
              var l = previewLine(p, row.itemId), it = item(row.itemId);
              if (l) return l.gross;
              return row.sold > 0 && it.price ? HB.money.amount(row.sold, it.price.mrp) : null;
            },
            footer: function (rows, p) { return p && p.ok && p.doc ? fmt.inr2(p.doc.gross) : ''; } }
        ]
      },
      panel: panelOf,
      totals: totalsOf,
      onPreview: function (d) { return HB.engine.preview('DAYEND', payload(d)); },
      onSubmit: function (d) {
        var res = HB.engine.act('post', { type: 'DAYEND', payload: payload(d) });
        if (!res.ok) return res;                      /* the form shows the refusal at the field or the line it names */
        st.form = null;
        st.storeId = res.doc.storeId;
        forms.postedToast(res.doc, postedText(res.doc, res.docs ? res.docs[1] : null), { tone: res.doc.shortExcess < 0 ? 'warn' : 'good' });
        ctx.openDoc(res.doc.id);
        return res;
      },
      onCancel: function () { st.form = null; ctx.rerender(); }
    }));
  }

  /* ------------------------------------------------------------------ view */

  /** The write-off of the expired units, as the data layer shows it to this persona: its status, its value and its batches. */
  function writeOffSection(d) {
    if (!d.woId) return { title: 'Write-off of the expired units', body: muted('No expired units were entered, so this day-end raised no write-off request.') };
    var w = HB.data.doc.view(d.woId);
    if (!w) return { title: 'Write-off of the expired units', body: ['The expired units are on ', forms.docLink(d.woId), '.'] };
    var a = w.approval || {}, says = '';
    if (w.status === 'PENDING') says = 'It waits for the Owner. Until it is approved the units stay in the store\'s stock, set aside.';
    else if (w.status === 'POSTED') says = 'Approved' + (a.byName ? ' by ' + a.byName : '') + ': the units have left the store\'s stock and their cost is a write-off in the P&L.';
    else if (w.status === 'REJECTED') says = 'Rejected' + (a.byName ? ' by ' + a.byName : '') + (a.reason ? ': ' + a.reason : '') + '. The units are in the store\'s stock again.';
    else if (w.status === 'CANCELLED') says = 'Cancelled' + (w.cancellation && w.cancellation.reason ? ': ' + w.cancellation.reason : '') + '. The units are in the store\'s stock again.';
    return {
      title: 'Write-off of the expired units', subtitle: says, flush: true,
      actions: ui.row([forms.docLink(w.id), ui.statusChip(w.status)], { gap: 2 }),
      body: ui.table({
        dense: true, rows: w.lines, empty: 'No lines',
        columns: [
          { key: 'itemName', label: 'Product' },
          { key: 'batchId', label: 'Batch', doc: true },
          { key: 'qty', label: 'Expired', format: 'qty' },
          { key: 'rate', label: 'Cost a unit', format: 'rate' },
          { key: 'value', label: 'Value at cost', format: 'inr2' }
        ],
        footer: { itemName: 'Total', value: w.amount }
      })
    };
  }

  function view(rootEl, ctx) {
    var v = HB.data.doc.view(ctx.docId);
    if (!v || v.type !== 'DAYEND') { rootEl.appendChild(forms.missingDoc(ctx.docId, { onBack: ctx.closeDoc, backLabel: 'Back to day-ends' })); return; }
    var d = v.doc, row = rowOf(d), x = shortWords(d.shortExcess);
    /* cancel comes from the data layer: allowed, or locked with the reason and the write-off to cancel first */
    var actions = forms.docActions({
      view: v, labels: { cancel: 'Cancel the day-end' },
      ask: { cancel: 'The units sold go back into the store\'s stock, and the sales, the cash and the UPI total are taken back. A write-off request that still waits is cancelled with it.' },
      moved: function (op, res) { return op === 'cancel' ? cancelledText(res.target) : ''; }
    });
    var notice = forms.docNotice(v);
    if (!notice && row.woStatus === 'PENDING') {
      notice = { tone: 'warn', title: 'The write-off of the expired units waits for the Owner',
        text: ['Sales and cash are posted. The expired units stay in the store\'s stock, set aside, until ', forms.docLink(d.woId), ' is approved.'] };
    }
    rootEl.appendChild(forms.docView({
      title: forms.docTitle(v), subtitle: v.party.name + ', ' + day(v.date), status: v.status, onBack: ctx.closeDoc, backLabel: 'Back to day-ends',
      chips: d.woId && row.woStatus ? [ui.statusChip(row.woStatus, { label: 'Write-off: ' + (WRITE_OFF[row.woStatus] || HB.data.lookup.statusLabel(row.woStatus)).toLowerCase() })] : null,
      notice: notice,
      meta: [['Store', v.party.name], ['Day', day(v.date)], ['Entered by', v.createdByName], ['Cash counted', fmt.inr2(d.cash)], ['UPI total', fmt.inr2(d.upi)], ['Note', v.note || null]],
      lines: {
        title: 'Products', subtitle: 'Sales are the units sold at the MRP of the day, which includes GST',
        columns: [
          { key: 'itemName', label: 'Product' },
          { key: 'sold', label: 'Sold', format: 'qty' },                  /* 'qty' reads row.unit */
          { key: 'expired', label: 'Expired', format: 'qty' },
          { key: 'mrp', label: 'MRP', format: 'rate' },
          { key: 'gstRate', label: 'GST', align: 'right', render: function (r) { return r ? fmt.num(r) + '%' : 'Nil'; } },
          { key: 'gross', label: 'Sales at MRP', format: 'inr2' },
          { key: 'taxable', label: 'Before GST', format: 'inr2' }
        ],
        rows: v.lines, empty: 'Nothing was sold and nothing expired',
        footer: { itemName: 'Total', sold: fmt.num(d.units), expired: fmt.num(row.expiredUnits), gross: d.gross, taxable: d.taxable }
      },
      totals: [
        { label: 'Sales at MRP', value: fmt.inr2(d.gross), strong: true },
        { label: 'GST inside it', value: fmt.inr2(d.gst), tone: 'muted' },
        { label: 'Sales before GST', value: fmt.inr2(d.taxable) },
        { label: 'Cash counted', sub: 'into the store\'s till', value: fmt.inr2(d.cash), rule: true },
        { label: 'UPI total', sub: 'into the bank', value: fmt.inr2(d.upi) },
        { label: x.label, sub: d.shortExcess === 0 ? 'cash and UPI match the sales at MRP' : 'posted to "' + shortCategory() + '"', value: x.value, tone: x.tone }
      ],
      sections: [writeOffSection(d)],
      related: forms.relatedOf(v.id), timeline: forms.timelineOf(v.id), actions: actions
    }));
  }

  /**
   * Whether the draft is one this persona may look at: a day-end begun for another store (by the Owner, before the
   * persona was switched) stays in the state for whoever began it, and is not drawn for a persona without that store.
   */
  function drawable(draft) {
    var id = draft && draft.values ? draft.values.storeId : null;
    return !id || HB.data.lookup.stores({ active: 'all' }).some(function (s) { return s.id === id; });
  }

  /* ------------------------------------------------------------------ page */

  HB.router.register({
    id: 'stores-dayend', route: '#/stores/dayend', group: 'Stores', title: 'Store day-end', navLabel: 'Day-end', filters: ['date'],
    /* '#/doc/DAYEND-...': going back from the document shows the list of its store */
    openDoc: function (id, state) {
      var d = HB.data.doc.get(id);
      if (d && d.storeId) state.storeId = d.storeId;
    },
    render: function (rootEl, ctx) {
      if (ctx.docId) return view(rootEl, ctx);         /* the hash decides */
      if (ctx.state.form && drawable(ctx.state.form)) return form(rootEl, ctx);   /* a draft is open: it survives redraws, persona switches and visits elsewhere */
      list(rootEl, ctx);
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
