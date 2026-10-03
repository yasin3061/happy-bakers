/*
 * Dispatch (#/sell/dispatch). A tab per route and a date. A sheet still to post is a grid of outlets in stop order
 * by products, prefilled from the standing orders (HB.engine.dispatchSheet), with the stock available and the value
 * of each invoice as the engine previews it; posting is all or nothing. A posted sheet shows its invoices, and
 * "Cancel the sheet" takes them all back in one go, or none of them, after which the sheet is to post again where the
 * date rules allow it (the screen says beforehand when they do not: a locked month, or a day further back than the role may go).
 * A dispatch sheet is not a document: it is the invoices that share its sheet id, so this page has no list.
 * Every figure comes from HB.data or HB.engine; the one rule written here is how a short product is cut.
 */
(function (root) {
  'use strict';

  var HB = root.HB;
  if (!HB || !HB.router || !HB.ui || !HB.forms) return;
  var ui = HB.ui, h = ui.h, forms = HB.forms, fmt = HB.fmt;

  function day(iso) { return ui.format('date', iso); }
  function item(id) { return HB.data.lookup.item(id); }
  function customer(id) { return HB.data.lookup.customer(id); }
  /** The first two of a list in words, and how many more there are. */
  function few(list) { return list.slice(0, 2).join(', ') + (list.length > 2 ? ' and ' + fmt.num(list.length - 2) + ' more' : ''); }

  /* --------------------------------------------------- which sheet is on screen */

  /** The route and date of a sheet id, as the selector resolves it; null when the id names no route and day. */
  function sheetOf(id) {
    var s = HB.data.sell.sheet(id);
    return s ? { routeId: s.routeId, date: s.date } : null;
  }

  /** An amount with a muted line under it, for a cell that has to say where the rest went. */
  function withSub(amount, sub) {
    return h('div', null, h('div', null, fmt.inr2(amount)), sub ? h('div', { 'class': 'mk-xs mk-muted' }, sub) : null);
  }
  function creditUsed(amount) { return amount > 0 ? fmt.inr2(amount) + ' credit used' : ''; }

  /**
   * The date chosen, its sheet rows (one per route), the row of the route chosen (the first still to post until one
   * is picked) and whether a sheet can be posted for that date at all by this persona: the date rules, the same for
   * every route of the day (sell.sheet(...).repost).
   */
  function pick(st) {
    var date = st.date || HB.calendar.today, rows = HB.data.sell.sheets(date), row = null;
    rows.forEach(function (r) { if (r.routeId === st.routeId) row = r; });
    if (!row) row = rows.filter(function (r) { return r.toPost; })[0] || rows[0] || null;
    var sheet = row ? HB.data.sell.sheet(row.sheetId) : null;
    return { date: date, rows: rows, row: row, repost: sheet ? sheet.repost : { ok: true, code: '', reason: '', owner: true } };
  }

  /** A sheet nobody here may post for its day (a locked month, or further back than this role may go) is not "to post". */
  function sheetChip(row, open) {
    if (row.posted) return ui.chip('Posted', 'good');
    if (!row.toPost) return ui.chip('No outlets', 'neutral');
    return open ? ui.chip('To post', 'warn') : ui.chip('Not posted', 'neutral');
  }

  /**
   * What becomes of a posted sheet once "Cancel the sheet" has taken it back, by the date rules for its day: it can be
   * posted again; only the Owner can, the day being further back than this role may go; or nobody can, its month
   * being locked. The cancellation goes through in each case, dated today, as any cancellation does.
   */
  function repostText(repost, done) {
    if (repost.ok) return done ? 'The sheet is to post again.' : 'The sheet can then be posted again.';
    if (repost.owner) return 'Only the Owner can post it again: the sheet is dated further back than you can post.';
    return 'The sheet cannot be posted again. ' + repost.reason + '.';
  }

  /** Route tabs and the date. A refusal of the engine about the date is shown under the date. */
  function head(ctx, sel, dateError) {
    var st = ctx.state;
    function go() { if (ctx.docId) ctx.closeDoc(); else ctx.rerender(); }   /* a sheet opened by its link gives the hash back */
    var input = forms.dateInput({ value: sel.date, name: 'date', ariaLabel: 'Sheet date', onChange: function (v) {
      if (!HB.dates.isIso(v) || v === sel.date) return;
      st.date = v;
      go();
    } });
    var field = ui.form.field({ label: 'Sheet date', control: input });
    if (dateError) field.setError(dateError);
    var tabs = ui.tabs({ ariaLabel: 'Route', value: sel.row ? sel.row.routeId : null,
      items: sel.rows.map(function (r) { return { id: r.routeId, label: [r.routeName, ' ', sheetChip(r, sel.repost.ok)] }; }),
      onChange: function (id) { st.routeId = id; go(); } });
    return ui.card({ title: 'Dispatch sheets', subtitle: 'One sheet for each route and day', actions: field, body: tabs });
  }

  /* ------------------------------------------------------------ the sheet */

  /** The standing orders of a prefilled sheet as the values of the grid: { customerId: { itemId: quantity } }. */
  function standing(sheet) {
    var out = {};
    sheet.outlets.forEach(function (o) {
      var row = out[o.customerId] = {};
      o.lines.forEach(function (l) { if (l.qty > 0) row[l.itemId] = l.qty; });
    });
    return out;
  }

  /** draft -> the arguments of postDispatch (docs/API.md 3.6): every outlet of the sheet in stop order, with the quantities typed. */
  function payload(sheet, draft) {
    var values = draft.matrix || {};
    return { routeId: sheet.routeId, date: sheet.date, outlets: sheet.outlets.map(function (o) {
      var row = values[o.customerId] || {};
      return { customerId: o.customerId, lines: sheet.items.filter(function (it) { return row[it.itemId] > 0; })
        .map(function (it) { return { itemId: it.itemId, qty: row[it.itemId] }; }) };
    }) };
  }

  /**
   * Cut each short product to what the engine says is available: the shortage is taken from the last stop of the
   * route upward until the product fits. Writes the draft and returns what was taken, for the note on screen.
   */
  function cut(sheet, draft, shorts) {
    return shorts.map(function (s) {
      var over = s.wanted - s.available, taken = [];
      for (var i = sheet.outlets.length - 1; i >= 0 && over > 0; i--) {
        var o = sheet.outlets[i], row = draft.matrix[o.customerId], had = row ? row[s.itemId] || 0 : 0;
        if (!(had > 0)) continue;
        var less = Math.min(had, over);
        row[s.itemId] = had - less;
        over -= less;
        taken.push({ name: o.name, from: had, to: had - less });
      }
      return { itemId: s.itemId, less: s.wanted - s.available - over, taken: taken };
    });
  }

  function cutLine(c) {
    return item(c.itemId).name + ': ' + fmt.qty(c.less, item(c.itemId).unit) + ' fewer, taken from ' +
      c.taken.map(function (t) { return t.name + ' (' + fmt.num(t.from) + ' to ' + fmt.num(t.to) + ')'; }).join(', ');
  }

  /** The value of each invoice the sheet would post, as the engine previews it. The grid adds the columns up. */
  function valueCard(p) {
    var rows = p.docs.map(function (d) {
      var c = customer(d.customerId);
      return { name: c.name, terms: c.termsLabel, units: d.units, taxable: d.taxable, gst: d.gst, total: d.total, paidNow: d.paidNow, creditApplied: d.creditApplied };
    });
    var sum = p.summary || {};                        /* the sheet as a whole, added up by the engine */
    function foot(key, how) { return function () { return sum[key] === undefined ? '' : how(sum[key]); }; }
    return ui.card({
      title: 'Value by outlet', flush: true,
      subtitle: 'One invoice per outlet, in stop order. An outlet with no quantity gets none. Credit an outlet holds is used first.',
      body: forms.lineGrid({ readOnly: true, rows: rows, footerLabel: 'Sheet total', columns: [
        /* the terms ride under the outlet, so that six columns fit the narrowest window */
        { key: 'name', label: 'Outlet', type: 'static', format: function (v, row) {
          return h('div', null, h('div', null, v), h('div', { 'class': 'mk-xs mk-muted' }, row.terms));
        } },
        { key: 'units', label: 'Units', type: 'static', format: 'num', footer: foot('units', fmt.num) },
        { key: 'taxable', label: 'Before GST', type: 'static', format: 'inr2', footer: foot('taxable', fmt.inr2) },
        { key: 'gst', label: 'GST', type: 'static', format: 'inr2', footer: foot('gst', fmt.inr2) },
        { key: 'total', label: 'Invoice value', type: 'static', align: 'right', footer: foot('total', fmt.inr2),
          format: function (v, row) { return withSub(v, creditUsed(row.creditApplied)); } },
        { key: 'paidNow', label: 'Cash on delivery', type: 'static', format: 'inr2', footer: foot('collected', fmt.inr2) }
      ] })
    });
  }

  /** Under the grid: what is short and the way to cut it, what a cut took, and the value of the sheet. */
  function panelOf(sheet) {
    return function (p, draft, form) {
      var out = [], shorts = ((p && p.stock) || []).filter(function (s) { return s && s.short; });
      if (shorts.length) {
        out.push(ui.callout('critical', shorts.length === 1 ? item(shorts[0].itemId).name + ' is short' : fmt.num(shorts.length) + ' products are short', [
          h('ul', { 'class': 'mk-docform__list' }, shorts.map(function (s) {
            var unit = item(s.itemId).unit;
            return h('li', null, item(s.itemId).name + ': ' + fmt.qty(s.wanted, unit) + ' wanted, ' + fmt.qty(s.available, unit) + ' available');
          })),
          'A sheet posts whole or not at all. Cutting takes the shortage from the last stops of the route upward until each product fits.'
        ], { actions: ui.button({ label: 'Cut to what is available', icon: 'minus', onClick: function () {
          draft.cut = cut(sheet, draft, shorts);
          draft.dirty = true;
          form.matrix.setValues(draft.matrix);
          form.refresh();
        } }) }));
      } else if (draft.cut && draft.cut.length) {
        out.push(ui.callout('info', 'Cut to what is available, from the last stops upward',
          h('ul', { 'class': 'mk-docform__list' }, draft.cut.map(function (c) { return h('li', null, cutLine(c)); }))));
      }
      if (p && p.ok && p.docs) out.push(valueCard(p));
      return out;
    };
  }

  /** What posting moved, for the toast: the sheet row of the selector as it stands now, the product totals of the preview. */
  function movedText(row, totals, warnings) {
    var goods = Object.keys(totals || {}).map(function (id) { return fmt.qty(totals[id], item(id).unit) + ' of ' + item(id).name; });
    var parts = [
      'Sales value ' + fmt.inr2(row.total) + ' with GST.',
      'Cash collected on delivery: ' + fmt.inr2(row.collected) + '.',
      'Finished stock down by ' + fmt.num(row.units) + ' units' + (goods.length ? ': ' + few(goods) : '') + '.'
    ];
    if (warnings && warnings.length) parts.push(fmt.num(warnings.length) + (warnings.length === 1 ? ' outlet is' : ' outlets are') + ' now above the credit limit.');
    return parts.join(' ');
  }

  function sheetForm(rootEl, ctx, sel, sheet, draft) {
    var st = ctx.state, may = HB.session.can('dispatch.post');
    var available = {};
    sheet.items.forEach(function (it) { available[it.itemId] = it.available; });
    rootEl.appendChild(forms.docForm({
      title: sel.row.routeName + ', ' + day(sel.date), state: draft,
      subtitle: 'Prefilled from each outlet\'s standing order. Change a quantity where an outlet asked for more or less, then post.',
      chips: ui.statusChip('TODO', { label: 'To post' }),
      submitLabel: 'Post dispatch sheet', submitIcon: 'truck', submitReason: may.ok ? '' : may.reason,
      matrix: {
        title: 'Outlets in stop order', subtitle: 'Whole units. One invoice is posted per outlet.',
        rowHeader: 'Outlet',
        rows: sheet.outlets.map(function (o) { return { id: o.customerId, label: o.name, sub: customer(o.customerId).termsLabel }; }),
        columns: sheet.items.map(function (it) { return { id: it.itemId, label: item(it.itemId).name }; }),
        available: available, availableLabel: 'Available in the finished store', balanceLabel: 'Left after the sheet',
        onChange: function () { draft.cut = null; }
      },
      panel: panelOf(sheet),
      actions: [{ label: 'Reset to standing orders', icon: 'undo', onClick: function (d, f) {
        function reset() { d.matrix = standing(sheet); d.cut = null; d.dirty = false; f.matrix.setValues(d.matrix); f.refresh(); }
        if (!d.dirty) { reset(); return; }
        ui.confirm({ title: 'Reset the sheet?', message: 'Every quantity goes back to the outlet\'s standing order. What you changed here is lost.',
          confirmLabel: 'Reset', cancelLabel: 'Keep my changes', tone: 'danger' }).then(function (r) { if (r.ok) reset(); });
      } }],
      onPreview: function (d) { return HB.engine.preview('DISPATCH', payload(sheet, d)); },
      onSubmit: function (d) {
        var args = payload(sheet, d), before = HB.engine.preview('DISPATCH', args);   /* the product totals, read before the engine acts */
        var res = HB.engine.act('postDispatch', args);
        if (!res.ok) return res;                    /* all or nothing: the refusal lists each short product with what is available */
        delete st.drafts[sel.row.sheetId];
        var now = HB.data.sell.sheets(sel.date).filter(function (r) { return r.routeId === sel.row.routeId; })[0] || {};
        forms.postedToast(res.docs, movedText(now, before.totals, res.warnings));
        return res;
      }
    }));
  }

  /* ------------------------------------------------------- a posted sheet */

  /**
   * What cancelling the sheet moved, for the toast: the sheet row, the product lines and whether the sheet can be
   * posted again, as the selectors gave them just before the engine acted. The toast's own title counts the
   * invoices cancelled.
   */
  function cancelledText(before) {
    var goods = before.lines.map(function (l) { return fmt.qty(l.qty, l.unit) + ' of ' + l.itemName; });
    return [
      'Sales reversed: ' + fmt.inr2(before.row.total) + ' with GST.',
      'Cash collected on delivery taken back out: ' + fmt.inr2(before.row.collected) + '.',
      'Finished stock up again by ' + fmt.num(before.row.units) + ' units' + (goods.length ? ': ' + few(goods) : '') + '.',
      repostText(before.repost, true)
    ].join(' ');
  }

  /**
   * "Cancel the sheet": the one action of a posted sheet, from the data layer, with the reason when the persona may
   * not take it or when an invoice of the sheet cannot be cancelled (a receipt or a stale return rests on it).
   */
  function cancelAction(row, repost) {
    var v = HB.data.doc.view(row.sheetId);
    return forms.docActions({
      view: v, labels: { cancelDispatch: 'Cancel the sheet' },
      ask: { cancelDispatch: 'Every invoice of this sheet is cancelled in one go, or none of them. Each gets a cancellation of its own, dated today, with the reason you give. The sales and the cash collected are reversed and the stock is back in the finished store. ' + repostText(repost, false) },
      before: function () { return { row: row, lines: v.lines, repost: repost }; },
      moved: function (op, res, before) { return cancelledText(before); }
    })[0] || null;
  }

  function posted(rootEl, ctx, sel) {
    var row = sel.row, may = HB.session.can('inv.create'), cancel = cancelAction(row, sel.repost);
    /* every invoice that carries the sheet id, in stop order, cancelled ones included */
    var sheet = HB.data.sell.sheet(row.sheetId), invoices = sheet ? sheet.invoices : [];
    var live = invoices.filter(function (r) { return !r.cancelled; }), values = {}, used = {};
    live.forEach(function (r) {
      var cells = values[r.customerId] = {};
      r.doc.lines.forEach(function (l) { cells[l.itemId] = l.qty; used[l.itemId] = true; });
    });
    ui.append(rootEl,
      ui.pageHead({
        title: row.routeName + ', ' + day(sel.date), subtitle: 'Dispatch sheet ' + row.sheetId, chips: ui.statusChip('POSTED'),
        actions: [
          cancel ? ui.button({ label: cancel.label, icon: cancel.reason ? 'lock' : cancel.icon, variant: 'danger', disabledReason: cancel.reason, onClick: cancel.onClick }) : null,
          ui.button({ label: 'New invoice for a further supply', icon: may.ok ? 'plus' : 'lock', disabledReason: may.ok ? '' : may.reason,
            onClick: function () { forms.startDraft('sell-invoices', { values: { date: sel.date } }); } })
        ]
      }),
      ui.callout('good', 'This sheet is posted', [
        'A sheet is posted once for a route and a day. Further supply to an outlet on this day goes on a single invoice. "Cancel the sheet" takes back every invoice of it in one go. ' + repostText(sel.repost, false),
        /* an action that is locked says why in words, with the document that must be cancelled first as a link */
        cancel && cancel.reason ? h('div', { 'class': 'mk-docact__why' }, ui.icon('lock', 12),
          h('span', null, cancel.reason, cancel.docId ? [' ', forms.docLink(cancel.docId, 'Open ' + cancel.docId)] : null)) : null
      ]),
      ui.kpiRow([
        { label: 'Invoices', value: fmt.num(row.invoices) },
        { label: 'Units dispatched', value: fmt.num(row.units) },
        { label: 'Sales value', value: fmt.inr2(row.total), sub: 'with GST' },
        { label: 'Cash collected on delivery', value: fmt.inr2(row.collected) }
      ]),
      ui.card({
        title: 'Invoices of the sheet', flush: true,
        subtitle: invoices.length > live.length ? 'In stop order. A cancelled invoice is listed and left out of the totals.' : 'In stop order',
        body: ui.table({
          dense: true, rows: invoices, empty: 'No invoice carries this sheet',
          onRowClick: function (r) { ctx.openDoc(r.id); },
          columns: [
            { key: 'id', label: 'Invoice', doc: true },
            { key: 'customerName', label: 'Outlet', maxWidth: 138 },
            { key: 'units', label: 'Units', format: 'num' },
            /* total less credit used less cash collected is what is still to receive. The render draws the rows; the
               format is for the footer, which the table formats by itself and would otherwise print as paise */
            { key: 'total', label: 'Total', align: 'right', format: 'inr2', render: function (v, r) { return withSub(v, creditUsed(r.creditApplied)); } },
            { key: 'paidNow', label: 'Cash', title: 'Cash collected on delivery', format: 'inr2' },
            { key: 'open', label: 'To receive', format: 'inr2' },
            { key: 'status', label: 'Status', render: ui.cells.status() }
          ],
          footer: { id: 'Sheet total', units: row.units, total: row.total, paidNow: row.collected }
        })
      }),
      ui.card({
        title: 'Quantities dispatched', subtitle: 'What each outlet was invoiced for', flush: true,
        body: forms.matrixGrid({
          readOnly: true, rowHeader: 'Outlet', values: values,
          rows: live.map(function (r) { return { id: r.customerId, label: r.customerName }; }),
          columns: HB.data.lookup.items({ kind: 'fg', active: 'all' }).filter(function (it) { return used[it.id]; }).map(function (it) { return { id: it.id, label: it.name }; })
        })
      }));
  }

  /* ------------------------------------------------------------------ page */

  HB.router.register({
    id: 'sell-dispatch', route: '#/sell/dispatch', group: 'Sell', title: 'Dispatch', filters: [],
    /* '#/doc/DS-...': a sheet id opens its route and date */
    openDoc: function (id, state) {
      var s = sheetOf(id);
      if (s) { state.routeId = s.routeId; state.date = s.date; }
    },
    render: function (rootEl, ctx) {
      var st = ctx.state;
      if (ctx.docId && !sheetOf(ctx.docId)) { rootEl.appendChild(forms.missingDoc(ctx.docId, { onBack: ctx.closeDoc, backLabel: 'Back to dispatch' })); return; }
      var sel = pick(st);
      if (!sel.row) {
        ui.append(rootEl, head(ctx, sel, ''), ui.emptyState('No route to dispatch', 'Routes and their outlets are kept under Masters.', { icon: 'truck' }));
        return;
      }
      st.routeId = sel.row.routeId;                  /* the choice holds once made: posting a sheet does not jump to the next route */
      if (sel.row.posted) { rootEl.appendChild(head(ctx, sel, '')); posted(rootEl, ctx, sel); return; }

      var sheet = HB.engine.dispatchSheet(sel.row.routeId, sel.date);
      if (!sheet || !sheet.ok || !sheet.outlets.length) {
        ui.append(rootEl, head(ctx, sel, ''), ui.emptyState('Nothing to dispatch on this route',
          sheet && sheet.error ? sheet.error.message : 'The route has no active outlet.', { icon: 'truck' }));
        return;
      }
      st.drafts = st.drafts || {};
      var draft = st.drafts[sel.row.sheetId] || (st.drafts[sel.row.sheetId] = forms.draft());
      if (!draft.dirty) draft.matrix = standing(sheet);   /* until something is typed the sheet follows the standing orders */

      /* the engine's date rules, asked before the form is drawn: a date it refuses has no sheet to fill in. The rules
         of the day come first (for a role that may not post at all, too: nobody posts into a locked month) */
      var asked = HB.engine.preview('DISPATCH', payload(sheet, draft));
      var refused = !sel.repost.ok ? sel.repost.reason : (!asked.ok && asked.error && asked.error.field === 'date' ? asked.error.message : '');
      rootEl.appendChild(head(ctx, sel, refused));
      if (refused) {
        rootEl.appendChild(ui.callout('warn', 'No sheet can be posted for ' + day(sel.date), 'The reason is under the date. Choose another date there.'));
        return;
      }
      sheetForm(rootEl, ctx, sel, sheet, draft);
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
