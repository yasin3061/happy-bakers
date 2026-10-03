/*
 * Stock counts (#/stock/counts). The list of counts, the count sheet of a location and the view of one count.
 * Built on the pattern of js/pages/buy-orders.js (docs/PAGES.md). A count is entered against what the books hold;
 * the difference and its value are the engine's (HB.engine.preview). It waits for the Owner: stock moves by the
 * differences, and their value reaches the P&L, only when it is approved.
 */
(function (root) {
  'use strict';

  var HB = root.HB;
  if (!HB || !HB.router || !HB.ui || !HB.forms) return;
  var ui = HB.ui, h = ui.h, forms = HB.forms, fmt = HB.fmt;

  function day(iso) { return ui.format('date', iso); }
  function item(id) { return HB.data.lookup.item(id); }
  function locOf(id) { return id ? HB.data.lookup.location(id) : null; }
  /** The first two of a list in words, and how many more there are. */
  function few(list) { return list.slice(0, 2).join(', ') + (list.length > 2 ? ' and ' + fmt.num(list.length - 2) + ' more' : ''); }
  /** A difference with its sign in words a count sheet uses: "4 kg short", "2 pcs over". */
  function diffText(diff, unit) { return diff < 0 ? fmt.qty(-diff, unit) + ' short' : fmt.qty(diff, unit) + ' over'; }

  /** The places a count can be raised for: never goods on their way to a store. */
  function countLocations() { return HB.data.lookup.locations({ kind: ['rm', 'fg', 'store'] }); }

  /* ----------------------------------------------------- what a count moves */

  /** Read before and after the engine acts: the stock of the count's location, item by item. */
  function snapshot(locId) { return HB.data.stock.onHand(locId); }

  /** The quantities that are no longer what the selector returned before, in words. */
  function movedText(locId, before) {
    var moves = forms.changes(before, snapshot(locId), 'itemId', 'qty').map(function (c) {
      return c.row.itemName + ' ' + fmt.qty(c.before, c.row.unit) + ' to ' + fmt.qty(c.after, c.row.unit);
    });
    return moves.length ? 'Stock at ' + locOf(locId).name + ': ' + few(moves) + '.' : 'No quantity moved at ' + locOf(locId).name + '.';
  }

  /** What an approved count did to the P&L: the value of the differences, the document's own figure. A shortage is a cost. */
  function pnlText(doc) {
    if (!doc.value) return 'The differences come to nothing in the P&L.';
    return 'Count differences in the P&L: ' + (doc.value < 0 ? 'a cost of ' + fmt.inr2(-doc.value) : 'a gain of ' + fmt.inr2(doc.value)) + '.';
  }

  /** The one line of the toast after submitting: where the count landed, and what moved or will move. */
  function landed(doc, before) {
    if (doc.status !== 'PENDING') return 'Approved as your own count. ' + movedText(doc.locId, before) + ' ' + pnlText(doc);
    var off = doc.lines.filter(function (l) { return l.diff !== 0; }).map(function (l) { return item(l.itemId).name + ' ' + diffText(l.diff, item(l.itemId).unit); });
    return 'It waits for the Owner. ' + (off.length ? 'Stock moves on approval: ' + few(off) + '.' : 'The count agrees with the books, so nothing will move.');
  }

  /* ------------------------------------------------------------------ list */

  function start(st, ctx) {
    var locs = countLocations();
    st.form = forms.draft(locs.length === 1 ? { values: { locId: locs[0].id } } : null);
    ctx.rerender();
  }

  function list(rootEl, ctx) {
    var st = ctx.state, may = HB.session.can('adj.create');
    st.list = st.list || {};
    /* a count that waits is listed whatever the date range says; the range limits the finished ones */
    var rows = forms.uniqueRows(HB.data.stock.counts({ status: 'PENDING' }), HB.data.stock.counts(ctx.filters));
    rootEl.appendChild(forms.docList({
      state: st.list, rows: rows,
      subtitle: 'Counts that wait for the Owner are always listed. The date range applies to the others.',
      statuses: ['PENDING', 'POSTED', 'REJECTED', 'CANCELLED'],
      search: ['id', 'locName', 'reason', 'note', 'createdByName'], searchPlaceholder: 'Search counts', sort: { key: 'date', dir: 'desc' },
      empty: 'No stock count in this range',
      columns: [
        { key: 'id', label: 'Count' },
        { key: 'date', label: 'Counted on', format: 'date' },
        { key: 'locName', label: 'Location', maxWidth: 200 },
        { key: 'reason', label: 'Reason', maxWidth: 220 },
        { key: 'lineCount', label: 'Lines', format: 'num' },
        { key: 'value', label: 'Difference', format: 'inr2', title: 'What was counted minus what the books held, at the unit cost of the day it was entered. A shortage is below zero.' },
        { key: 'status', label: 'Status', render: ui.cells.status() }
      ],
      newLabel: 'New stock count', newReason: may.ok ? '' : may.reason,
      onNew: function () { start(st, ctx); }
    }));
  }

  /* ------------------------------------------------------------------ form */

  /**
   * What the books hold at a location, one row per line of a count sheet: every material and packing item of the
   * raw store, every finished-goods batch on hand elsewhere. By item, then the oldest batch first.
   */
  function sheetOf(locId) {
    var loc = locOf(locId);
    if (!loc || loc.unknown) return [];
    if (loc.kind === 'rm') return HB.data.stock.onHand(locId).map(function (r) { return { itemId: r.itemId, batchId: null, qty: r.qty, bestBefore: null }; });
    return HB.data.stock.batches({ locId: locId }).map(function (b, i) { return { itemId: b.itemId, batchId: b.batchId, qty: b.qty, bestBefore: b.bestBefore, name: b.itemName, n: i }; })
      .sort(function (x, y) { return x.name === y.name ? x.n - y.n : (x.name < y.name ? -1 : 1); });
  }

  function sameLine(a, b) { return a.itemId === b.itemId && (a.batchId || null) === (b.batchId || null); }

  /** The row of the books behind a line of the draft, as the selector gives it now. */
  function inBooks(draft, row) {
    var rows = sheetOf(draft.values.locId);
    for (var i = 0; i < rows.length; i++) if (sameLine(rows[i], row)) return rows[i];
    return null;
  }

  /** One line per row of the books, the counted quantity empty. Once per location, so a redraw never wipes what was typed. */
  function fill(draft) {
    var locId = draft.values.locId || '';
    if (draft.linesFor === locId) return;
    draft.lines = sheetOf(locId).map(function (r) { return { itemId: r.itemId, batchId: r.batchId, countedQty: null }; });
    draft.linesFor = locId;
  }

  /** draft -> the payload of docs/API.md 3.5. form.lines() carries the lines a count was typed on; the others are not part of the count. */
  function payload(draft, form) {
    var v = draft.values;
    return {
      date: v.date, locId: v.locId, reason: v.reason, note: v.note,
      lines: form.lines().map(function (l) { return { itemId: l.itemId, batchId: l.batchId || undefined, countedQty: l.countedQty }; })
    };
  }

  /**
   * The dry run of the draft. The differences and their value are the engine's, so while only the reason is still
   * to be typed the same dry run is asked once more with a stand-in for it, for the figures of the sheet alone:
   * what is shown as refused, and what would be posted, stay those of the draft as it is. The warnings go with the
   * figures: a count far from the books is said beside its line as soon as the difference shows, reason or not.
   */
  function preview(draft, form) {
    var p = HB.engine.preview('ADJ', payload(draft, form)), q = p;
    if (!p.ok && p.error && p.error.field === 'reason') {
      var again = payload(draft, form);
      again.reason = 'count';
      q = HB.engine.preview('ADJ', again);
    }
    return { ok: p.ok, preview: true, error: p.error, warnings: q.warnings, stock: p.stock, doc: p.doc, outcome: p.outcome, figures: q.ok ? q.doc : null };
  }

  /** The line of the previewed count for a line of the grid. The engine numbers only the lines sent: match by item and batch. */
  function counted(p, row) {
    var lines = p && p.figures ? p.figures.lines : [];
    for (var i = 0; i < lines.length; i++) if (sameLine(lines[i], row)) return lines[i];
    return null;
  }

  /** What the engine says will happen on submitting: preview.outcome, in words. */
  function outcome(p) {
    var o = p && p.ok ? p.outcome : null;
    if (!o) return { tone: 'neutral', short: '-', title: 'Approval',
      text: 'A stock count waits for the Owner. Stock moves by the differences, and their value goes to count differences in the P&L, when it is approved.' };
    if (o.waits) return { tone: 'warn', short: 'Waits for the Owner', title: 'Waits for the Owner',
      text: 'Nothing moves on submitting. When the Owner approves the count, stock moves by each difference and their value goes to count differences in the P&L.' };
    return { tone: 'info', short: 'Approved as your own', title: 'Approved as your own count',
      text: 'As the Owner you approve the count as you submit it: stock moves by each difference at once, and the audit log says so.' };
  }

  function form(rootEl, ctx) {
    var st = ctx.state, draft = st.form, may = HB.session.can('adj.create');
    fill(draft);
    function unit(row) { return row.itemId ? item(row.itemId).unit : ''; }
    rootEl.appendChild(forms.docForm({
      title: 'New stock count', state: draft, backLabel: 'Back to counts', submitLabel: 'Submit count', submitIcon: 'send',
      submitReason: may.ok ? '' : may.reason,
      fields: [
        { key: 'locId', label: 'Location', type: 'select', required: true, span: 2, rebuild: true, placeholder: 'Choose a location',
          options: function () { return countLocations().map(function (l) { return { value: l.id, label: l.name }; }); },
          onChange: function (id, d) { fill(d); } },
        { key: 'date', label: 'Counted on', type: 'date', required: true },
        { key: 'reason', label: 'Reason', required: true, span: 2, maxLength: 120, placeholder: 'Month-end count, spot check, spillage found' },
        { key: 'note', label: 'Note', optional: true, span: 2, maxLength: 200, placeholder: 'Who counted, anything the Owner should know' }
      ],
      lines: {
        title: 'Count sheet', addRows: false, removeRows: false, empty: 'Choose a location to list what the books hold there',
        subtitle: 'Type what was counted. A line left empty is not part of the count. Finished goods are counted batch by batch.',
        columns: [
          { key: 'itemId', label: 'Item', type: 'static', width: '26%', format: function (v) { return v ? item(v).name : '-'; } },
          { key: 'batchId', label: 'Batch', type: 'static', format: function (v, row) {
            var b = v ? inBooks(draft, row) : null;
            return v ? h('div', null, v, b && b.bestBefore ? h('div', { 'class': 'mk-small mk-muted' }, 'best before ' + day(b.bestBefore)) : null) : '-';
          } },
          { key: 'systemQty', label: 'In the books', type: 'computed', format: 'qty', unit: unit, title: 'The quantity on hand now',
            value: function (row) { var b = inBooks(draft, row); return b ? b.qty : 0; } },
          { key: 'countedQty', label: 'Counted', type: 'qty', unit: unit, placeholder: '',   /* an empty box, not a grey zero: a line left empty is not counted */
            decimals: function (row) { return row.batchId ? 0 : 3; } },
          { key: 'diff', label: 'Difference', type: 'computed', format: 'qty', unit: unit, title: 'What was counted minus what the books hold: below zero is a shortage',
            value: function (row, i, p) { var l = counted(p, row); return l ? l.diff : null; } },
          { key: 'value', label: 'Value', type: 'computed', format: 'inr2', title: 'The difference at today\'s unit cost',
            value: function (row, i, p) { var l = counted(p, row); return l ? l.value : null; },
            footer: function (rows, p) { return p && p.figures ? fmt.inr2(p.figures.value) : ''; } }
        ]
      },
      panel: function (p) { var o = outcome(p); return ui.callout(o.tone, o.title, o.text); },
      totals: function (p) {
        var doc = p ? p.figures : null, o = outcome(p);
        return [
          { label: 'Lines counted', value: doc ? fmt.num(doc.lines.length) : '-' },
          { label: 'Value of the differences', sub: 'counted minus the books, at today\'s unit cost', value: doc ? fmt.inr2(doc.value) : '-', strong: true, rule: true },
          { label: 'On submitting', value: o.short, tone: o.tone === 'warn' ? 'bad' : 'muted' }
        ];
      },
      onPreview: preview,
      onSubmit: function (d, f) {
        var before = d.values.locId ? snapshot(d.values.locId) : [];   /* read the selector, act, read it again: that is what moved */
        var res = HB.engine.act('post', { type: 'ADJ', payload: payload(d, f) });
        if (!res.ok) return res;                    /* the form shows the refusal at the field or the line it names */
        st.form = null;
        forms.postedToast(res.doc, landed(res.doc, before));
        ctx.openDoc(res.doc.id);
        return res;
      },
      onCancel: function () { st.form = null; ctx.rerender(); }
    }));
  }

  /* ------------------------------------------------------------------ view */

  function view(rootEl, ctx) {
    var v = HB.data.doc.view(ctx.docId);
    if (!v || v.type !== 'ADJ') { rootEl.appendChild(forms.missingDoc(ctx.docId, { onBack: ctx.closeDoc, backLabel: 'Back to counts' })); return; }
    var d = v.doc;
    /* approve, reject and cancel come from the data layer, each with the reason when the persona may not */
    var actions = forms.docActions({
      view: v, labels: { cancel: 'Cancel the count' },
      ask: { cancel: 'A count that was approved is taken back: the stock returns to what the books held before it. A count that still waits simply ends.' },
      before: function () { return snapshot(d.locId); },
      moved: function (op, res, before) {
        if (op === 'reject') return '';               /* the toast carries the reason; nothing had moved */
        if (op === 'approve') return movedText(d.locId, before) + ' ' + pnlText(res.doc);
        return movedText(d.locId, before);
      }
    });
    rootEl.appendChild(forms.docView({
      title: forms.docTitle(v), subtitle: v.party ? v.party.name : '', status: v.status, onBack: ctx.closeDoc, backLabel: 'Back to counts',
      notice: forms.docNotice(v, { waiting: 'A stock count moves nothing until the Owner approves it. The differences below are against the books as they stood when it was entered.' }),
      meta: [['Location', v.party ? v.party.name : null], ['Counted on', day(v.date)], ['Reason', d.reason || null], ['Raised by', v.createdByName], ['Note', v.note || null]],
      lines: {
        title: 'Count sheet',
        columns: [
          { key: 'itemName', label: 'Item', maxWidth: 220 },
          { key: 'batchId', label: 'Batch', doc: true },
          { key: 'systemQty', label: 'In the books', format: 'qty' },      /* 'qty' reads row.unit */
          { key: 'countedQty', label: 'Counted', format: 'qty' },
          { key: 'diff', label: 'Difference', format: 'qty' },
          { key: 'rate', label: 'Unit cost', format: 'rate' },
          { key: 'value', label: 'Value', format: 'inr2' }
        ],
        rows: v.lines, footer: { itemName: 'Total', value: v.amount }
      },
      totals: [
        { label: 'Lines counted', value: fmt.num(v.lines.length) },
        { label: 'Value of the differences', sub: 'counted minus the books, at the unit cost of the day it was entered', value: fmt.inr2(v.amount), strong: true, rule: true }
      ],
      related: forms.relatedOf(v.id), timeline: forms.timelineOf(v.id), actions: actions
    }));
  }

  /* ------------------------------------------------------------------ page */

  HB.router.register({
    id: 'stock-counts', route: '#/stock/counts', group: 'Stock', title: 'Stock counts', filters: ['date'],
    render: function (rootEl, ctx) {
      if (ctx.docId) return view(rootEl, ctx);         /* '#/doc/ADJ-...': the hash decides */
      if (ctx.state.form) return form(rootEl, ctx);    /* a draft is open: it survives redraws, persona switches and visits elsewhere */
      list(rootEl, ctx);
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
