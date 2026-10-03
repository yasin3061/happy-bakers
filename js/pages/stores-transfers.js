/*
 * Store transfers (#/stores/transfers). What each store is to be sent today and what is on its way, the list of
 * transfers, the form of a new one and the view of one. Built on the pattern of js/pages/buy-orders.js (docs/PAGES.md).
 * A transfer is prefilled by HB.engine.transferSheet: the store's standing quantity less what it holds in date or
 * has on the way. That is a master, not a forecast. Posting moves stock from the finished store into transit; the
 * store confirms receipt and the stock is then its own. Every figure comes from HB.data or HB.engine.
 */
(function (root) {
  'use strict';

  var HB = root.HB;
  if (!HB || !HB.router || !HB.ui || !HB.forms) return;
  var ui = HB.ui, h = ui.h, forms = HB.forms, fmt = HB.fmt;

  function day(iso) { return ui.format('date', iso); }
  function item(id) { return HB.data.lookup.item(id); }
  function storeName(id) { return HB.data.lookup.unit(id).name; }
  function unitsText(n) { return fmt.num(n) + (n === 1 ? ' unit' : ' units'); }
  function productsText(n) { return fmt.num(n) + (n === 1 ? ' product' : ' products'); }
  function muted(text) { return h('span', { 'class': 'mk-muted' }, text); }
  /** The first two of a list in words, and how many more there are. */
  function few(list) { return list.slice(0, 2).join(', ') + (list.length > 2 ? ' and ' + fmt.num(list.length - 2) + ' more' : ''); }

  /* -------------------------------------------------------- what a transfer moves */

  /** The row of the list selector for one transfer: it carries the units and the number of products. */
  function rowOf(doc) {
    return HB.data.stores.transfers({ from: doc.date, to: doc.date }).filter(function (r) { return r.id === doc.id; })[0] || {};
  }

  /** The one line of the toast. The quantities are the transfer's own lines; the unit total is the selector's. */
  function movedText(op, doc) {
    var row = rowOf(doc), name = storeName(doc.toStoreId);
    var goods = few(doc.lines.map(function (l) { return fmt.qty(l.qty, item(l.itemId).unit) + ' of ' + item(l.itemId).name; }));
    if (op === 'receiveTransfer') return name + ' now holds the ' + unitsText(row.units) + ' of this transfer: ' + goods + '. They can be sold and entered in the day-end.';
    if (op === 'cancel') return 'Finished stock up by ' + unitsText(row.units) + ', back in the batches they came from: ' + goods + '.';
    return 'Finished stock down by ' + unitsText(row.units) + ': ' + goods + '. They are on the way to ' + name + ' and count as its stock once the store confirms receipt.';
  }

  /* ------------------------------------------------------------------ list */

  function start(st, ctx, storeId) { st.form = forms.draft(storeId ? { values: { toStoreId: storeId } } : null); ctx.rerender(); }

  /** The store confirms receipt, from the list. The same operation as the action on the transfer's own view. */
  function confirmReceipt(id) {
    var res = HB.engine.act('receiveTransfer', { id: id });
    if (!res.ok) { forms.fail(res, 'Confirm receipt: not done'); return; }
    forms.postedToast(res.doc, movedText('receiveTransfer', res.doc));
  }

  /** One transfer on its way, with the way to confirm it: locked, with the engine's reason, for whoever may not. */
  function onTheWay(row) {
    var chk = HB.engine.check('receiveTransfer', { id: row.id });
    return ui.row([
      forms.docLink(row.id), muted(unitsText(row.units) + ', sent ' + day(row.date)),
      ui.button({ label: 'Confirm receipt', icon: chk.ok ? 'check' : 'lock', size: 'sm', variant: chk.ok ? 'primary' : 'secondary',
        disabledReason: chk.ok ? '' : chk.error.message, onClick: function () { confirmReceipt(row.id); } })
    ], { gap: 2, wrap: true });
  }

  /** Per store, for the business date: what the prefilled transfer proposes and what is sent and not confirmed. */
  function todayCard(st, ctx, may) {
    var rows = HB.data.stores.pending();
    return ui.card({
      title: 'To send and to confirm, ' + day(HB.calendar.today), flush: true,
      subtitle: 'A transfer is prefilled with each store\'s standing quantities, less what the store holds in date or has on the way',
      body: ui.table({
        dense: true, rows: rows, empty: 'No active store to send to',
        columns: [
          { key: 'storeName', label: 'Store', maxWidth: 200 },
          { key: 'sendUnits', label: 'Still to send', sortable: false, render: function (v, row) {
            return row.toSend ? unitsText(row.sendUnits) + ' of ' + productsText(row.sendLines) : muted('Nothing, the store is covered');
          } },
          { key: 'transfersSent', label: 'On the way', title: 'Sent and not yet confirmed by the store', sortable: false, wrap: true, render: function (list) {
            return list.length ? ui.stack(list.map(onTheWay), 1) : muted('Nothing on the way');
          } },
          { key: 'act', label: '', align: 'right', sortable: false, render: function (v, row) {
            if (!row.toSend) return '';
            return ui.button({ label: 'Send', icon: may.ok ? 'send' : 'lock', size: 'sm', disabledReason: may.ok ? '' : may.reason, onClick: function () { start(st, ctx, row.storeId); } });
          } }
        ]
      })
    });
  }

  function list(rootEl, ctx) {
    var st = ctx.state, may = HB.session.can('xfer.create');
    st.list = st.list || {};
    rootEl.appendChild(todayCard(st, ctx, may));
    /* a transfer on its way is listed whatever the date range says; the range limits the finished ones */
    var rows = forms.uniqueRows(HB.data.stores.transfers({ status: 'SENT' }), HB.data.stores.transfers(ctx.filters));
    rootEl.appendChild(forms.docList({
      state: st.list, rows: rows, title: 'Transfers',
      subtitle: 'Transfers on the way are always listed. The date range applies to received and cancelled ones.',
      statuses: ['SENT', 'RECEIVED', 'CANCELLED'],
      search: ['id', 'storeName', 'note'], searchPlaceholder: 'Search transfers', sort: { key: 'date', dir: 'desc' },
      empty: 'No transfer in this range',
      columns: [
        { key: 'id', label: 'Transfer' },
        { key: 'date', label: 'Date', format: 'date' },
        { key: 'storeName', label: 'Store', maxWidth: 200 },
        { key: 'units', label: 'Units', format: 'num' },
        { key: 'receivedAt', label: 'Received', render: function (v, row) {
          if (v) return ui.dateTime(v);
          return row.status === 'SENT' ? muted('Not confirmed yet') : '-';
        } },
        { key: 'status', label: 'Status', render: ui.cells.status() }
      ],
      newLabel: 'New transfer', newReason: may.ok ? '' : may.reason,
      onNew: function () { start(st, ctx, null); }
    }));
  }

  /* ------------------------------------------------------------------ form */

  /** The prefilled transfer of the draft's store and date, as the engine gives it now (null: no store chosen yet). */
  function sheetOf(draft) {
    var v = draft.values, sheet = v.toStoreId ? HB.engine.transferSheet(v.toStoreId, v.date || HB.calendar.today) : null;
    return sheet && sheet.ok ? sheet : null;
  }

  function sheetLine(draft, itemId) {
    var sheet = sheetOf(draft), lines = sheet ? sheet.lines : [];
    for (var i = 0; i < lines.length; i++) if (lines[i].itemId === itemId) return lines[i];
    return {};
  }

  /**
   * One line per product of the store's standing quantities, the quantity to send starting at what the engine
   * proposes. Once per store; again for another date only while nothing was typed, so a change of date never
   * wipes a quantity the user entered.
   */
  function fill(draft, force) {
    var v = draft.values, key = v.toStoreId || '', on = v.date || '';
    if (!force && draft.linesFor === key && (draft.edited || draft.linesOn === on)) return;
    var sheet = sheetOf(draft);
    draft.lines = sheet ? sheet.lines.map(function (l) { return { itemId: l.itemId, qty: l.qty || null }; }) : [];
    draft.linesFor = key;
    draft.linesOn = on;
    draft.edited = false;
    draft.cut = null;
  }

  /** draft -> the payload of docs/API.md 3.5. Every line of the grid goes, in order: the engine skips a zero and numbers the rest as sent. */
  function payload(draft) {
    var v = draft.values;
    return {
      date: v.date, toStoreId: v.toStoreId, note: v.note,
      lines: (draft.lines || []).map(function (l) { return { itemId: l.itemId, qty: l.qty || 0 }; })
    };
  }

  /** The stock behind line i of the draft, from the preview (docs/API.md 3.7). */
  function stockOf(p, index, row) {
    var s = p && p.stock ? p.stock[index] : null;
    return s && s.itemId === row.itemId ? s : null;
  }

  /** Bring each short line down to what the engine says is available. Returns what was taken, for the note on screen. */
  function cut(draft, shorts) {
    return shorts.map(function (s) {
      var row = draft.lines[s.index], had = row.qty;
      row.qty = s.available > 0 ? s.available : null;
      return { itemId: s.itemId, from: had, to: s.available };
    });
  }

  function panelOf(p, draft, form) {
    var sheet = sheetOf(draft);
    if (!sheet) return ui.callout('neutral', 'Choose the store to send to', 'Its products appear with the quantity that brings the store back to its standing quantities.');
    var out = [], name = storeName(draft.values.toStoreId);
    var shorts = ((p && p.stock) || []).filter(function (s) { return s && s.short; });
    if (shorts.length) {
      out.push(ui.callout('critical', shorts.length === 1 ? item(shorts[0].itemId).name + ' is short in the finished store' : productsText(shorts.length) + ' are short in the finished store',
        h('ul', { 'class': 'mk-docform__list' }, shorts.map(function (s) {
          var unit = item(s.itemId).unit;
          return h('li', null, item(s.itemId).name + ': ' + fmt.qty(s.wanted, unit) + ' to send, ' + fmt.qty(s.available, unit) + ' available');
        })),
        { actions: ui.button({ label: 'Cut to what is available', icon: 'minus', onClick: function () {
          draft.cut = cut(draft, shorts);
          draft.dirty = true;
          draft.edited = true;
          form.refresh();
        } }) }));
    } else if (draft.cut && draft.cut.length) {
      out.push(ui.callout('info', 'Cut to what is available in the finished store',
        h('ul', { 'class': 'mk-docform__list' }, draft.cut.map(function (c) {
          return h('li', null, item(c.itemId).name + ': ' + fmt.num(c.from) + ' to ' + fmt.num(c.to));
        }))));
    }
    if (!sheet.lines.some(function (l) { return l.qty > 0; })) {
      out.push(ui.callout('info', name + ' holds its standing quantities', 'What the store has in date or on the way covers every product, so the prefilled transfer is empty. Enter a quantity to send more.'));
    }
    out.push(ui.callout('neutral', 'What posting does',
      'The stock leaves the finished store, the oldest batch in date first, and waits in transit. It counts as the stock of ' + name + ' once the store confirms receipt. Until then the transfer can be cancelled.'));
    return out;
  }

  function form(rootEl, ctx) {
    var st = ctx.state, draft = st.form, may = HB.session.can('xfer.create');
    if (!draft.values.date) draft.values.date = HB.calendar.today;   /* the sheet is asked for a date before the form sets its default */
    fill(draft);
    function unit(row) { return row.itemId ? item(row.itemId).unit : ''; }
    rootEl.appendChild(forms.docForm({
      title: 'New transfer to a store', state: draft, backLabel: 'Back to transfers', submitLabel: 'Send transfer', submitIcon: 'send',
      submitReason: may.ok ? '' : may.reason,
      fields: [
        { key: 'toStoreId', label: 'Store', type: 'picker', required: true, span: 2, rebuild: true, placeholder: 'Choose a store',
          options: function () { return HB.data.lookup.stores().map(function (s) { return { id: s.id, label: s.name }; }); },
          onChange: function (id, d) { fill(d); } },
        { key: 'date', label: 'Sent on', type: 'date', required: true, rebuild: true, onChange: function (v, d) { fill(d); } },
        { key: 'note', label: 'Note', optional: true, span: 4, maxLength: 200, placeholder: 'Vehicle, driver, anything the store should know' }
      ],
      lines: {
        title: 'Products', addRows: false, removeRows: false, empty: 'Choose a store to see its standing quantities',
        subtitle: 'Whole units. To send starts at the standing quantity less what the store holds in date or has on the way.',
        onChange: function () { draft.edited = true; draft.cut = null; },
        columns: [
          { key: 'itemId', label: 'Product', type: 'static', width: '26%', format: function (v) { return v ? item(v).name : '-'; } },
          { key: 'standing', label: 'Standing quantity', type: 'computed', format: 'qty', unit: unit, title: 'The store\'s fixed daily stock level, set with the store under Masters, Setup',
            value: function (row) { return sheetLine(draft, row.itemId).standing; } },
          { key: 'atStore', label: 'At the store', type: 'computed', format: 'qty', unit: unit, title: 'In date on the day of the transfer',
            value: function (row) { return sheetLine(draft, row.itemId).atStore; } },
          { key: 'inTransit', label: 'On the way', type: 'computed', format: 'qty', unit: unit, title: 'Sent and not yet confirmed by the store',
            value: function (row) { return sheetLine(draft, row.itemId).inTransit; } },
          { key: 'qty', label: 'To send', type: 'int', unit: unit, footer: 'sum' },
          { key: 'available', label: 'Available at the factory', type: 'computed', format: 'qty', unit: unit, title: 'In the finished store, in date and not set aside for a write-off',
            value: function (row, index, p) { var s = stockOf(p, index, row); return s ? s.available : sheetLine(draft, row.itemId).available; } }
        ]
      },
      panel: panelOf,
      totals: function (p) {
        var doc = p && p.ok ? p.doc : null;
        return [
          { label: 'Products to send', value: doc ? fmt.num(doc.lines.length) : '-', strong: true },
          { label: 'On posting', value: doc ? 'Sent, waits for the store' : '-', tone: 'muted' }
        ];
      },
      actions: [{ label: 'Reset to the prefilled quantities', icon: 'undo', onClick: function (d, f) { fill(d, true); d.dirty = false; f.rebuild(); } }],
      onPreview: function (d) { return HB.engine.preview('XFER', payload(d)); },
      onSubmit: function (d) {
        var res = HB.engine.act('post', { type: 'XFER', payload: payload(d) });
        if (!res.ok) return res;                      /* the form shows the refusal at the field or the line it names */
        st.form = null;
        forms.postedToast(res.doc, movedText('post', res.doc));
        ctx.openDoc(res.doc.id);
        return res;
      },
      onCancel: function () { st.form = null; ctx.rerender(); }
    }));
  }

  /* ------------------------------------------------------------------ view */

  function view(rootEl, ctx) {
    var v = HB.data.doc.view(ctx.docId);
    if (!v || v.type !== 'XFER') { rootEl.appendChild(forms.missingDoc(ctx.docId, { onBack: ctx.closeDoc, backLabel: 'Back to transfers' })); return; }
    var d = v.doc, row = rowOf(d);
    /* confirm receipt and cancel come from the data layer, each with the reason when the persona may not */
    var actions = forms.docActions({
      view: v, labels: { receiveTransfer: 'Confirm receipt', cancel: 'Cancel the transfer' },
      ask: { cancel: 'The stock goes back from transit into the finished store, into the batches it came from.' },
      moved: function (op, res) { return movedText(op, op === 'cancel' ? res.target : res.doc); }
    });
    actions.forEach(function (a) { if (a.docId === v.id) a.docId = null; });   /* a confirmed transfer names itself: no link to the screen one is on */
    var notice = forms.docNotice(v);
    if (!notice && v.status === 'SENT') {
      notice = { tone: 'info', title: 'On the way to ' + v.party.name,
        text: 'The stock has left the finished store and waits in transit. It counts as the store\'s stock, and can be sold there, once the store confirms receipt.' };
    }
    rootEl.appendChild(forms.docView({
      title: forms.docTitle(v), subtitle: v.party.name, status: v.status, onBack: ctx.closeDoc, backLabel: 'Back to transfers',
      notice: notice,
      meta: [['Store', v.party.name], ['Sent on', day(v.date)], ['Sent by', v.createdByName],
        ['Received by the store', d.receivedAt ? ui.dateTime(d.receivedAt) + (row.receivedByName ? ', ' + row.receivedByName : '') : (v.status === 'SENT' ? 'Not confirmed yet' : null)],
        ['Note', v.note || null]],
      lines: {
        title: 'Products', subtitle: 'With the batches the finished store gave, the oldest in date first',
        columns: [
          { key: 'itemName', label: 'Product' },
          { key: 'qty', label: 'Quantity', format: 'qty' },                 /* 'qty' reads row.unit */
          { key: 'batches', label: 'Batches', wrap: true, sortable: false, render: function (list) {
            return h('span', null, (list || []).map(function (b, i) { return [i ? ', ' : '', forms.docLink(b.batchId), ' (' + fmt.num(b.qty) + ')']; }));
          } }
        ],
        rows: v.lines, footer: { itemName: 'Total', qty: unitsText(row.units) }
      },
      totals: [
        { label: 'Products', value: fmt.num(row.lineCount) },
        { label: 'Units', value: fmt.num(row.units), strong: true }
      ],
      related: forms.relatedOf(v.id), timeline: forms.timelineOf(v.id), actions: actions
    }));
  }

  /**
   * Whether the draft is one this persona may look at. The form shows the stock of the finished store and of the
   * store it goes to: a persona that does not see both (the store manager, who only confirms) gets the list, and the
   * draft stays in the state for whoever began it.
   */
  function drawable(draft) {
    var id = draft && draft.values ? draft.values.toStoreId : null;
    if (!HB.data.lookup.locations({ kind: 'fg' }).length) return false;
    return !id || HB.data.lookup.stores({ active: 'all' }).some(function (s) { return s.id === id; });
  }

  /* ------------------------------------------------------------------ page */

  HB.router.register({
    id: 'stores-transfers', route: '#/stores/transfers', group: 'Stores', title: 'Store transfers', navLabel: 'Transfers', filters: ['date'],
    render: function (rootEl, ctx) {
      if (ctx.docId) return view(rootEl, ctx);         /* '#/doc/XFER-...': the hash decides */
      if (ctx.state.form && drawable(ctx.state.form)) return form(rootEl, ctx);   /* a draft is open: it survives redraws, persona switches and visits elsewhere */
      list(rootEl, ctx);
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
