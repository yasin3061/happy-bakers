/*
 * Batches and write-offs (#/stock/batches). The finished-goods batches on hand by location, with the expired and
 * near-expiry flags; the write-off request for expired or damaged stock, its list and the view of one; and the
 * view of one batch ('#/doc/B-...'). Built on the pattern of js/pages/buy-orders.js (docs/PAGES.md).
 * A write-off waits for the Owner. While it waits its quantities are held, and the stock leaves on approval.
 * Flags, what is free to write off and every value are HB.data.stock's and HB.engine.preview's.
 */
(function (root) {
  'use strict';

  var HB = root.HB;
  if (!HB || !HB.router || !HB.ui || !HB.forms) return;
  var ui = HB.ui, h = ui.h, forms = HB.forms, fmt = HB.fmt;

  var REASONS = [{ value: 'expired', label: 'Expired' }, { value: 'damaged', label: 'Damaged' }, { value: 'other', label: 'Other' }];
  var FLAG_STATUS = { expired: 'EXPIRED', near: 'NEAR_EXPIRY' };   /* the chips of the kit for the selector's flags */

  function day(iso) { return ui.format('date', iso); }
  function item(id) { return HB.data.lookup.item(id); }
  function locOf(id) { return id ? HB.data.lookup.location(id) : null; }
  function muted(text) { return h('span', { 'class': 'mk-muted' }, text); }
  function reasonLabel(id) { var r = REASONS.filter(function (x) { return x.value === id; })[0]; return r ? r.label : String(id || ''); }
  /** The first two of a list in words, and how many more there are. */
  function few(list) { return list.slice(0, 2).join(', ') + (list.length > 2 ? ' and ' + fmt.num(list.length - 2) + ' more' : ''); }
  function daysText(n) { return fmt.num(n) + (n === 1 ? ' day' : ' days'); }
  function flagChip(row) {
    return FLAG_STATUS[row.flag] ? ui.statusChip(FLAG_STATUS[row.flag]) : ui.chip(row.flagLabel, 'good');
  }

  /** The places stock can be written off at: never goods on their way to a store. */
  function writeOffLocations() { return HB.data.lookup.locations({ kind: ['rm', 'fg', 'store'] }); }
  /** The places that hold finished goods by batch. */
  function batchLocations() { return HB.data.lookup.locations({ kind: ['fg', 'store', 'transit'] }); }

  /* ------------------------------------------------- what a write-off moves */

  /** Read before and after the engine acts: the stock of the write-off's location, item by item. */
  function snapshot(locId) { return HB.data.stock.onHand(locId); }

  function goods(doc) {
    return few(doc.lines.map(function (l) { return fmt.qty(l.qty, item(l.itemId).unit) + ' of ' + item(l.itemId).name; }));
  }

  /** The quantities on hand that are no longer what the selector returned before, in words. */
  function leftText(locId, before) {
    var moves = forms.changes(before, snapshot(locId), 'itemId', 'qty').map(function (c) {
      return c.row.itemName + ' ' + fmt.qty(c.before, c.row.unit) + ' to ' + fmt.qty(c.after, c.row.unit);
    });
    return moves.length ? 'Stock at ' + locOf(locId).name + ': ' + few(moves) + '.' : '';
  }

  /** The one line of the toast after submitting: where the request landed, and what is held or has left. */
  function landed(doc, before) {
    if (doc.status === 'PENDING') {
      return 'It waits for the Owner. Held in the books until then: ' + goods(doc) + '. No invoice, transfer or day-end takes held stock.';
    }
    return 'Approved as your own request. ' + leftText(doc.locId, before) + ' Write-offs in the P&L are up by ' + fmt.inr2(doc.value) + '.';
  }

  /* ------------------------------------------------------------------ list */

  /** A new draft: the location is filled in when the persona has only one, and the lines when a batch was chosen. */
  function draftOf(init) {
    var locs = writeOffLocations(), values = (init && init.values) || {};
    if (!values.locId && locs.length === 1) values.locId = locs[0].id;
    return { values: values, lines: init && init.lines ? init.lines : [{}] };
  }

  function start(st, ctx, init) { st.form = forms.draft(draftOf(init)); ctx.rerender(); }

  function tiles(st, ctx) {
    var soon = HB.data.stock.expiring(), waiting = HB.data.stock.writeOffs({ status: 'PENDING' });
    var expired = soon.filter(function (b) { return b.flag === 'expired'; }), near = soon.filter(function (b) { return b.flag === 'near'; });
    function show(tab) { return function () { st.tab = 'batches'; st.batches = st.batches || {}; st.batches.tab = tab; st.batches.page = 0; ctx.rerender(); }; }
    return ui.kpiRow([
      { label: 'Expired batches', icon: 'alert-triangle', value: fmt.num(expired.length), tone: expired.length ? 'critical' : null,
        sub: 'past best-before: never dispatched, transferred or sold', onClick: show('expired') },
      { label: 'Near expiry', value: fmt.num(near.length), tone: near.length ? 'warn' : null,
        sub: 'best before within ' + daysText(HB.masters.limits.nearExpiryDays) + ' of the business date', onClick: show('near') },
      { label: 'Write-offs waiting', icon: 'clock', value: fmt.num(waiting.length), tone: waiting.length ? 'warn' : null,
        sub: 'for the Owner: their stock is held until then',
        onClick: function () { st.tab = 'writeoffs'; st.list = st.list || {}; st.list.tab = 'PENDING'; st.list.page = 0; ctx.rerender(); } }
    ]);
  }

  function batchList(st, ctx) {
    st.batches = st.batches || {};
    var locs = batchLocations();
    if (!locs.some(function (l) { return l.id === st.locId; })) st.locId = '';
    /* a row carries the batch id as `id`: it opens '#/doc/<batch id>', the view of the batch on this page */
    var rows = HB.data.stock.batches({ locId: st.locId }).map(function (b) {
      return { id: b.batchId, itemName: b.itemName, locName: b.locName, mfgDate: b.mfgDate, bestBefore: b.bestBefore, qty: b.qty, unit: b.unit,
        reserved: b.reserved, flag: b.flag, flagLabel: b.flagLabel, daysLeft: b.daysLeft, locKind: b.locKind };
    });
    return forms.docList({
      state: st.batches, rows: rows, title: 'Batches on hand', subtitle: 'Finished goods on hand now, the oldest first. The date range above applies to the write-off requests.',
      groups: [
        { id: 'expired', label: 'Expired', test: function (r) { return r.flag === 'expired'; } },
        { id: 'near', label: 'Near expiry', test: function (r) { return r.flag === 'near'; } },
        { id: 'ok', label: 'In date', test: function (r) { return r.flag === 'ok'; } }
      ],
      search: ['id', 'itemName', 'locName'], searchPlaceholder: 'Search batches', empty: 'No batch on hand here',
      columns: [
        { key: 'id', label: 'Batch' },
        /* with every location listed, the location stands under the product: the table keeps its flags in sight at 1024px */
        st.locId ? { key: 'itemName', label: 'Product', maxWidth: 220 } : { key: 'itemName', label: 'Product and location', render: ui.cells.twoLine('locName', { maxWidth: 220 }) },
        { key: 'mfgDate', label: 'Made on', format: 'date' },
        { key: 'bestBefore', label: 'Best before', format: 'date' },
        { key: 'qty', label: 'On hand', format: 'qty' },
        { key: 'flag', label: 'Flag', sortable: false, render: function (v, row) {
          return ui.row([flagChip(row),
            row.reserved > 0 ? ui.chip(fmt.num(row.reserved) + ' held', 'warn', { title: fmt.qty(row.reserved, row.unit) + ' on a write-off request that waits for the Owner' }) : null,
            row.locKind === 'transit' ? ui.chip('On the way', 'info', { title: 'Sent to the store and not yet confirmed by it' }) : null], { gap: 1 });
        } }
      ],
      actions: locs.length > 1 ? ui.select({
        size: 'sm', ariaLabel: 'Location', value: st.locId || '',
        options: [{ value: '', label: 'All locations' }].concat(locs.map(function (l) { return { value: l.id, label: l.name }; })),
        onChange: function (v) { st.locId = v; st.batches.page = 0; ctx.rerender(); }
      }) : null
    });
  }

  function writeOffList(st, ctx) {
    st.list = st.list || {};
    /* a request that waits is listed whatever the date range says; the range limits the finished ones */
    var rows = forms.uniqueRows(HB.data.stock.writeOffs({ status: 'PENDING' }), HB.data.stock.writeOffs(ctx.filters));
    return forms.docList({
      state: st.list, rows: rows, title: 'Write-off requests',
      subtitle: 'Requests that wait for the Owner are always listed. The date range applies to the others.',
      statuses: ['PENDING', 'POSTED', 'REJECTED', 'CANCELLED'],
      search: ['id', 'locName', 'reason', 'sourceDocId', 'note', 'createdByName'], searchPlaceholder: 'Search write-offs', sort: { key: 'date', dir: 'desc' },
      empty: 'No write-off request in this range',
      columns: [
        { key: 'id', label: 'Write-off' },
        { key: 'date', label: 'Date', format: 'date' },
        { key: 'locName', label: 'Location', maxWidth: 190 },
        /* a write-off that a day-end raised names it under the reason: six columns, so the status stays in sight at 1024px */
        { key: 'reason', label: 'Reason', render: function (v, row) {
          return h('div', null, reasonLabel(v), row.sourceDocId ? h('div', { 'class': 'mk-small mk-muted' }, 'from ', forms.docLink(row.sourceDocId)) : null);
        } },
        { key: 'value', label: 'Value', format: 'inr2' },
        { key: 'status', label: 'Status', render: ui.cells.status() }
      ]
    });
  }

  /** The two lists of the page, one at a time, and the request that both lead to. */
  function list(rootEl, ctx) {
    var st = ctx.state, may = HB.session.can('wo.create');
    var tab = st.tab === 'writeoffs' ? 'writeoffs' : 'batches';
    var bar = ui.row([
      ui.tabs({ ariaLabel: 'Batches or write-off requests', value: tab, onChange: function (id) { st.tab = id; ctx.rerender(); },
        items: [{ id: 'batches', label: 'Batches on hand' }, { id: 'writeoffs', label: 'Write-off requests' }] }),
      ui.button({ label: 'Request a write-off', icon: may.ok ? 'plus' : 'lock', variant: 'primary', disabledReason: may.ok ? '' : may.reason,
        onClick: function () { start(st, ctx, tab === 'batches' && st.locId && locOf(st.locId).kind !== 'transit' ? { values: { locId: st.locId } } : null); } })
    ], { between: true, wrap: true });
    ui.append(rootEl, tiles(st, ctx), bar, tab === 'batches' ? batchList(st, ctx) : writeOffList(st, ctx));
  }

  /* ------------------------------------------------------------------ form */

  function kindOf(draft) { var loc = locOf(draft.values.locId); return loc && !loc.unknown ? loc.kind : null; }

  /** What the books hold at the draft's location, item by item (HB.data.stock.onHand): the items a line may name, and today's unit cost. */
  function heldAt(draft) { return draft.values.locId ? HB.data.stock.onHand(draft.values.locId) : []; }

  /** The batches of a product on hand at the draft's location, the oldest first. */
  function batchesOf(draft, itemId) {
    return draft.values.locId && itemId ? HB.data.stock.batches({ locId: draft.values.locId, itemId: itemId }) : [];
  }

  function sameLine(a, b) { return a.itemId === b.itemId && (a.batchId || null) === (b.batchId || null); }

  /** draft -> the payload of docs/API.md 3.5. form.lines() leaves out the lines nothing was typed into. */
  function payload(draft, form) {
    var v = draft.values;
    return {
      date: v.date, locId: v.locId, reason: v.reason, note: v.note,
      lines: form.lines().map(function (l) { return { itemId: l.itemId, batchId: l.batchId || undefined, qty: l.qty || 0 }; })
    };
  }

  /** The stock behind a line, from the preview (docs/API.md 3.7): on hand less what another request holds. Matched by item and batch. */
  function stockOf(p, row) {
    var list = (p && p.stock) || [];
    for (var i = 0; i < list.length; i++) if (list[i] && sameLine(list[i], row)) return list[i];
    return null;
  }

  /**
   * "Add the expired batches": one line per expired batch at the location that is not on the draft yet, the
   * quantity what the engine says is free (a dry run with the batches named and nothing asked for).
   */
  function addExpired(draft, form) {
    var locId = draft.values.locId;
    if (!locId) { ui.toast('Choose the location first.', { tone: 'info' }); return; }
    var rows = HB.data.stock.batches({ locId: locId, flag: 'expired' }).filter(function (b) {
      return !draft.lines.some(function (l) { return sameLine(l, b); });
    });
    var dry = HB.engine.preview('WO', { date: draft.values.date, locId: locId, reason: 'expired',
      lines: rows.map(function (b) { return { itemId: b.itemId, batchId: b.batchId, qty: 0 }; }) });
    var add = rows.map(function (b) { var s = stockOf(dry, b); return { itemId: b.itemId, batchId: b.batchId, qty: s ? s.available : 0 }; })
      .filter(function (l) { return l.qty > 0; });
    if (!add.length) { ui.toast('No expired batch is free to write off at ' + locOf(locId).name + '.', { tone: 'info' }); return; }
    draft.lines = draft.lines.filter(function (l) { return l.itemId; }).concat(add);
    if (!draft.values.reason) draft.values.reason = 'expired';
    draft.dirty = true;
    form.rebuild();
  }

  /** What the engine says will happen on submitting: preview.outcome, in words. */
  function outcome(p) {
    var o = p && p.ok ? p.outcome : null;
    if (!o) return { tone: 'neutral', short: '-', title: 'Approval',
      text: 'A write-off request waits for the Owner. Its stock is held while it waits and leaves the books when it is approved.' };
    if (o.waits) return { tone: 'warn', short: 'Waits for the Owner', title: 'Waits for the Owner',
      text: 'On submitting the quantities are held: no invoice, transfer or day-end takes them. They leave the books, and their value goes to write-offs in the P&L, when the Owner approves.' };
    return { tone: 'info', short: 'Approved as your own', title: 'Approved as your own request',
      text: 'As the Owner you approve the request as you submit it: the stock leaves the books at once, and the audit log says so.' };
  }

  function form(rootEl, ctx) {
    var st = ctx.state, draft = st.form, may = HB.session.can('wo.create');
    function unit(row) { return row.itemId ? item(row.itemId).unit : ''; }
    rootEl.appendChild(forms.docForm({
      title: 'New write-off request', state: draft, backLabel: 'Back to batches', submitLabel: 'Submit request', submitIcon: 'send',
      submitReason: may.ok ? '' : may.reason,
      fields: [
        { key: 'locId', label: 'Location', type: 'select', required: true, span: 2, rebuild: true, placeholder: 'Choose a location',
          options: function () { return writeOffLocations().map(function (l) { return { value: l.id, label: l.name }; }); },
          onChange: function (id, d) { d.lines = [{}]; } },        /* the items and batches belong to the location */
        { key: 'reason', label: 'Reason', type: 'select', required: true, options: REASONS, placeholder: 'Choose a reason' },
        { key: 'date', label: 'Date', type: 'date', required: true },
        { key: 'note', label: 'Note', optional: true, span: 4, maxLength: 200, placeholder: 'What happened to the stock' }
      ],
      lines: {
        title: 'Stock to write off', addLabel: 'Add line', minRows: 1,
        subtitle: 'Finished goods are written off batch by batch. Materials and packing of the raw store have no batch.',
        columns: [
          { key: 'itemId', label: 'Item', type: 'item', required: true, width: '21%',
            items: function () { return heldAt(draft).filter(function (r) { return r.qty > 0; }).map(function (r) { return item(r.itemId); }); },
            filter: function (it, row, rows) {                      /* a material goes on one line; a product once per batch */
              return it.kind === 'fg' || rows.every(function (r) { return r === row || r.itemId !== it.id; });
            },
            onChange: function (row, id) {
              var list = batchesOf(draft, id);
              row.batchId = list.length === 1 ? list[0].batchId : null;
              row.qty = null;
            } },
          { key: 'batchId', label: 'Batch', type: 'select', placeholder: 'Choose the batch', width: '24%',
            readOnly: function (row) { return kindOf(draft) === 'rm' || !row.itemId; },
            options: function (row) { return batchesOf(draft, row.itemId).map(function (b) { return { value: b.batchId, label: b.batchId }; }); } },
          { key: 'bestBefore', label: 'Best before', type: 'computed', value: function (row) {
            var b = row.batchId ? batchesOf(draft, row.itemId).filter(function (x) { return x.batchId === row.batchId; })[0] : null;
            return b ? day(b.bestBefore) + (b.flag === 'ok' ? '' : ', ' + b.flagLabel.toLowerCase()) : null;
          } },
          { key: 'free', label: 'Free to write off', type: 'computed', format: 'qty', unit: unit, title: 'On hand, less what another write-off request already holds',
            value: function (row, i, p) { var s = stockOf(p, row); return s ? s.available : null; } },
          { key: 'qty', label: 'Quantity', type: 'qty', required: true, unit: unit, decimals: function (row) { return row.itemId && item(row.itemId).kind === 'fg' ? 0 : 3; } },
          /* the value of a line as it is typed: HB.money.amount on today's unit cost, as the engine itself does. The total is the preview's. */
          { key: 'value', label: 'Value', type: 'computed', format: 'inr2', footer: 'sum', title: 'At today\'s unit cost: recipe cost for a product, latest purchase price for a material',
            value: function (row) {
              var held = row.itemId ? heldAt(draft).filter(function (r) { return r.itemId === row.itemId; })[0] : null;
              return held && row.qty > 0 ? HB.money.amount(row.qty, held.rate) : null;
            } }
        ]
      },
      panel: function (p) { var o = outcome(p); return ui.callout(o.tone, o.title, o.text); },
      totals: function (p) {
        var doc = p && p.ok ? p.doc : null, o = outcome(p);
        return [
          { label: 'Lines', value: doc ? fmt.num(doc.lines.length) : '-' },
          { label: 'Value to write off', sub: 'at today\'s unit cost', value: doc ? fmt.inr2(doc.value) : '-', strong: true, rule: true },
          { label: 'On submitting', value: o.short, tone: o.tone === 'warn' ? 'bad' : 'muted' }
        ];
      },
      actions: [{ label: 'Add the expired batches', icon: 'plus', title: 'One line for every expired batch at the location that is free to write off', onClick: addExpired }],
      onPreview: function (d, f) { return HB.engine.preview('WO', payload(d, f)); },
      onSubmit: function (d, f) {
        var before = d.values.locId ? snapshot(d.values.locId) : [];   /* read the selector, act, read it again: that is what moved */
        var res = HB.engine.act('post', { type: 'WO', payload: payload(d, f) });
        if (!res.ok) return res;                    /* the form shows the refusal at the field or the line it names */
        st.form = null;
        forms.postedToast(res.doc, landed(res.doc, before));
        ctx.openDoc(res.doc.id);
        return res;
      },
      onCancel: function () { st.form = null; ctx.rerender(); }
    }));
  }

  /* ------------------------------------------------------- view: a write-off */

  function writeOffView(rootEl, ctx, v) {
    var d = v.doc;
    /* approve, reject and cancel come from the data layer, each with the reason when the persona may not */
    var actions = forms.docActions({
      view: v, labels: { cancel: 'Cancel the write-off' },
      ask: { cancel: 'A write-off that was approved is taken back: the stock returns to the batches it left. One that still waits ends, and the stock it held is free again.' },
      before: function () { return snapshot(d.locId); },
      moved: function (op, res, before) {
        if (op === 'reject') return 'The stock stays in the books and is free again. Reason: ' + res.doc.approval.reason;
        var left = leftText(d.locId, before);
        if (op === 'approve') return (left || 'No quantity moved.') + ' Write-offs in the P&L are up by ' + fmt.inr2(res.doc.value) + '.';
        return left || 'Nothing had left the books. The stock it held is free again.';
      }
    });
    rootEl.appendChild(forms.docView({
      title: forms.docTitle(v), subtitle: v.party ? v.party.name : '', status: v.status, chips: [ui.chip(reasonLabel(d.reason), 'neutral')],
      onBack: ctx.closeDoc, backLabel: 'Back to write-offs',
      notice: forms.docNotice(v, { waiting: 'Its quantities are held while it waits: no invoice, transfer or day-end takes them. The stock leaves the books when the Owner approves.' }),
      meta: [['Location', v.party ? v.party.name : null], ['Reason', reasonLabel(d.reason)], ['Date', day(v.date)],
        ['From the day-end', d.sourceDocId ? forms.docLink(d.sourceDocId) : null], ['Requested by', v.createdByName], ['Note', v.note || null]],
      lines: {
        title: 'Stock written off',
        columns: [
          { key: 'itemName', label: 'Item', maxWidth: 240 },
          { key: 'batchId', label: 'Batch', doc: true },
          { key: 'qty', label: 'Quantity', format: 'qty' },                 /* 'qty' reads row.unit */
          { key: 'rate', label: 'Unit cost', format: 'rate' },
          { key: 'value', label: 'Value', format: 'inr2' }
        ],
        rows: v.lines, footer: { itemName: 'Total', value: v.amount }
      },
      totals: [{ label: 'Value written off', sub: 'at the unit cost of the day it was requested', value: fmt.inr2(v.amount), strong: true }],
      related: forms.relatedOf(v.id), timeline: forms.timelineOf(v.id), actions: actions
    }));
  }

  /* ----------------------------------------------------------- view: a batch */

  /** One batch: where it is now and, for a role with the ledger, every movement of it. A batch is not a document, but its id opens like one. */
  function batchView(rootEl, ctx) {
    var id = ctx.docId;
    var here = HB.data.stock.batches().filter(function (b) { return b.batchId === id; });
    var moves = HB.data.stock.ledger({ batchId: id, limit: 0 });       /* since go-live; empty for a role without the ledger */
    if (!here.length && !moves.rows.length) { rootEl.appendChild(forms.missingDoc(id, { onBack: ctx.closeDoc, backLabel: 'Back to batches' })); return; }
    var b = here[0] || null, first = moves.rows[0] || null;
    var may = HB.session.can('wo.create');
    var at = here.filter(function (r) { return r.locKind !== 'transit'; });
    var free = at.filter(function (r) { return r.qty > r.reserved; });   /* units no waiting request holds yet */
    var actions = [{
      label: 'Request a write-off', icon: 'trash',
      reason: !may.ok ? may.reason : (free.length ? '' : (at.length ? 'Every unit of this batch is already on a write-off request that waits for the Owner'
        : 'No unit of this batch is at a location stock can be written off at')),
      onClick: function () {                           /* the form of this page, on a draft that names the batch */
        forms.startDraft('stock-batches', draftOf({ values: { locId: free[0].locId, reason: free[0].flag === 'expired' ? 'expired' : undefined },
          lines: [{ itemId: free[0].itemId, batchId: id, qty: null }] }));
      }
    }];
    rootEl.appendChild(forms.docView({
      title: 'Batch ' + id, subtitle: b ? b.itemName : (first ? first.itemName : ''), status: b ? flagChip(b) : ui.chip('None on hand', 'neutral'),
      onBack: ctx.closeDoc, backLabel: 'Back to batches',
      notice: b ? (b.flag === 'expired' ? { tone: 'critical', title: 'Past its best-before date', text: 'This batch is never dispatched, transferred or sold. Request a write-off to take it out of the books.' } : null)
        : { tone: 'neutral', title: 'Nothing of this batch is on hand', text: 'Every unit has left the locations you see. Its movements are below.' },
      meta: b ? [['Product', b.itemName], ['Made on', day(b.mfgDate)], ['Best before', day(b.bestBefore)],
        ['Days to best-before', b.daysLeft < 0 ? daysText(-b.daysLeft) + ' past' : daysText(b.daysLeft)],
        ['Production entry', b.prodId ? (b.canOpen ? forms.docLink(b.prodId) : b.prodId) : null]] : [['Product', first.itemName]],
      lines: {
        title: 'Where it is now', empty: 'None on hand',
        columns: [
          { key: 'locName', label: 'Location', maxWidth: 220 },
          { key: 'qty', label: 'On hand', format: 'qty' },                  /* 'qty' reads row.unit */
          { key: 'reserved', label: 'Held', format: 'qty', title: 'On a write-off request that waits for the Owner' },
          { key: 'available', label: 'Available', format: 'qty', title: 'What a document dated today may take' },
          { key: 'value', label: 'Value', format: 'inr2', title: 'At today\'s recipe cost' }
        ],
        rows: here
      },
      sections: moves.rows.length ? [{
        title: 'Movements', subtitle: 'Every row of the stock ledger that names this batch, oldest first', flush: true,
        body: ui.table({
          dense: true, rows: moves.rows, maxHeight: 420,
          columns: [
            { key: 'date', label: 'Date', format: 'date' },
            { key: 'docId', label: 'Document', render: function (v, row) { return row.canOpen ? forms.docLink(v) : String(v || ''); } },
            { key: 'kindLabel', label: 'Movement', render: ui.cells.twoLine('note', { maxWidth: 240 }) },
            { key: 'locName', label: 'Location', maxWidth: 200 },
            { key: 'qtyIn', label: 'In', align: 'right', format: function (v, row) { return v ? fmt.qty(v, row.unit) : ''; } },
            { key: 'qtyOut', label: 'Out', align: 'right', format: function (v, row) { return v ? fmt.qty(v, row.unit) : ''; } }
          ]
        })
      }] : null,
      actions: actions
    }));
  }

  function view(rootEl, ctx) {
    var v = HB.data.doc.view(ctx.docId);
    if (v && v.type === 'WO') return writeOffView(rootEl, ctx, v);
    if (v) { rootEl.appendChild(forms.missingDoc(ctx.docId, { onBack: ctx.closeDoc, backLabel: 'Back to batches' })); return; }
    batchView(rootEl, ctx);                              /* not a document: a batch id, or nothing this role sees */
  }

  /* ------------------------------------------------------------------ page */

  HB.router.register({
    id: 'stock-batches', route: '#/stock/batches', group: 'Stock', title: 'Batches and write-offs', navLabel: 'Batches', filters: ['date'],
    /* a link to a write-off or to a batch: closing it returns to the list it belongs to */
    openDoc: function (id, state) { state.tab = HB.data.doc.get(id) ? 'writeoffs' : 'batches'; },
    render: function (rootEl, ctx) {
      if (ctx.docId) return view(rootEl, ctx);         /* '#/doc/WO-...' or '#/doc/B-...': the hash decides */
      if (ctx.state.form) return form(rootEl, ctx);    /* a draft is open: it survives redraws, persona switches and visits elsewhere */
      list(rootEl, ctx);
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
