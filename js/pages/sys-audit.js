/*
 * Audit log (#/system/audit). SCOPE 4.9: who, in which role, when, what, before and after.
 * One selector, HB.data.audit.list(f): the date range of the filter bar, a user and a kind. The selector hands back
 * the latest rows only when the range holds more than it lists (truncated); the page says so, and the CSV asks for
 * all of them. A document row opens its document. A master change opens the record before and after, field by field.
 */
(function (root) {
  'use strict';

  var HB = root.HB;
  if (!HB || !HB.router || !HB.ui || !HB.forms) return;
  var ui = HB.ui, h = ui.h, forms = HB.forms, fmt = HB.fmt;

  /* the kinds of entry the selector tells apart: an action on a document, or a change to a master record */
  var KINDS = [
    { value: '', label: 'Every kind' },
    { value: 'post', label: 'Documents entered' },
    { value: 'approve', label: 'Approvals' },
    { value: 'reject', label: 'Rejections' },
    { value: 'cancel', label: 'Cancellations' },
    { value: 'receive', label: 'Transfers received by a store' },
    { value: 'masters', label: 'Changes to items, customers and other records' }
  ];

  /* ------------------------------------------------ a master record, field by field */

  var FIELD = {
    name: 'Name', code: 'Code', kind: 'Kind', unit: 'Unit', pack: 'Pack', hsn: 'HSN', gstRate: 'GST rate', gstin: 'GSTIN',
    shelfLifeDays: 'Best before, days', reorderLevel: 'Reorder level', price: 'Price', mrp: 'MRP', retail: 'retailer', corporate: 'corporate',
    channel: 'Channel', routeId: 'Route', terms: 'Terms', creditDays: 'Credit days', creditLimit: 'Credit limit', termsDays: 'Payment terms, days',
    standing: 'Standing quantity', supplies: 'Supplies', town: 'Town', locality: 'Locality', dept: 'Department', designation: 'Designation',
    unitId: 'Location', doj: 'Date of joining', dol: 'Date of leaving', salary: 'Monthly salary', phone: 'Phone', active: 'Active',
    changeNote: 'Reason for the change', expectedUnits: 'Expected units', mixLabel: 'Mix', materials: 'Material', packing: 'Packing',
    standardMixes: 'Standard mixes', vendorId: 'Vendor', mode: 'Used for', address: 'Address', outletType: 'Outlet type'
  };
  var MONEY = { salary: 1, creditLimit: 1, mrp: 1 };
  var RATES = { retail: 1, corporate: 1 };
  /* the values a record holds as short codes, in the words the forms use for them */
  var WORDS = {
    terms: { cash: 'Cash on delivery', weekly: 'Weekly credit', credit: 'Credit' },
    mode: { claim: 'Expense claims', bill: 'Expense bills', both: 'Claims and bills' },
    kind: { fg: 'Finished product', rm: 'Raw material', pk: 'Packing', stock: 'Materials and packing', expense: 'Services and expenses', staff: 'Salaries', store: 'Own store' }
  };
  var DATES = { doj: 1, dol: 1 };
  var NAMED = { unitId: 'unit', routeId: 'route', vendorId: 'vendor' };
  var RECORD = { items: 'item', recipes: 'item', customers: 'customer', vendors: 'vendor', employees: 'employee', expenseCategories: 'category', locations: 'unit' };

  function blank(v) { return v === null || v === undefined || v === ''; }
  function itemName(id) { var it = HB.masters && HB.masters.itemById ? HB.masters.itemById[id] : null; return it ? it.name : ''; }
  function words(key) { var s = String(key).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase(); return s.charAt(0).toUpperCase() + s.slice(1); }
  function labelOf(path) { return path.split('.').map(function (seg) { return FIELD[seg] || itemName(seg) || words(seg); }).join(': '); }
  function decimals(n) { return Math.min(3, (String(n).split('.')[1] || '').length); }

  function valueText(path, v) {
    var key = path.split('.').pop();
    if (blank(v)) return '-';
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    if (MONEY[key]) return fmt.inr2(v);
    if (RATES[key]) return fmt.rate(v);
    if (DATES[key]) return ui.format('date', v);
    if (NAMED[key]) return HB.data.lookup.name(NAMED[key], v);
    if (key === 'channel') return HB.data.lookup.channelLabel(v);
    if (WORDS[key] && WORDS[key][v]) return WORDS[key][v];
    if (key === 'gstRate') return +v > 0 ? fmt.num(v, decimals(v)) + '%' : 'Nil';
    if (typeof v === 'number') return fmt.num(v, decimals(v));
    return String(v);
  }

  /** A record as { 'price.mrp': 3800, 'standing.FG01': 20, 'materials.RM01': 50 }: one entry per value. */
  function flat(rec, prefix, out) {
    if (!rec || typeof rec !== 'object') return out;
    Object.keys(rec).forEach(function (k) {
      var v = rec[k], path = prefix ? prefix + '.' + k : k;
      if (!prefix && (k === 'id' || k === 'itemId' || k === 'system')) return;   /* the record's own id is in the row; what the system uses a record for is not a value of a form */
      if (Array.isArray(v)) {
        if (v.length && v.every(function (x) { return x && typeof x === 'object'; })) {
          v.forEach(function (x, i) {                                           /* recipe lines: one entry per material */
            var id = x.itemId || x.id || String(i + 1), rest = {};
            Object.keys(x).forEach(function (kk) { if (kk !== 'itemId' && kk !== 'id') rest[kk] = x[kk]; });
            var keys = Object.keys(rest);
            if (keys.length === 1) out[path + '.' + id] = rest[keys[0]]; else flat(rest, path + '.' + id, out);
          });
        } else out[path] = v.map(function (x) { return itemName(x) || String(x); }).join(', ');
      } else if (v && typeof v === 'object') flat(v, path, out);
      else out[path] = v;
    });
    return out;
  }

  /** What a master change changed: [{ path, label, beforeText, afterText }]. A new record lists every value it was given. */
  function changesOf(row) {
    var b = flat(row.before, '', {}), a = flat(row.after, '', {}), seen = {}, out = [];
    Object.keys(b).concat(Object.keys(a)).forEach(function (path) {
      if (seen[path] || path === 'changeNote') return;                         /* the reason of the change is the row's note */
      seen[path] = true;
      var bv = blank(b[path]) ? null : b[path], av = blank(a[path]) ? null : a[path];
      if (bv === av) return;
      out.push({ path: path, label: labelOf(path), beforeText: row.before ? valueText(path, bv) : '-', afterText: valueText(path, av) });
    });
    return out;
  }

  function recordName(row) {
    var name = row.recordName || (row.after && row.after.name) || (row.before && row.before.name) || HB.data.lookup.name(RECORD[row.type] || 'item', row.docId);
    return name && name !== row.docId ? name : '';
  }

  /** "Entered", "Approved" for a document; "Added", "Changed", "Deactivated", "Activated" for a master record: the selector's word. */
  function whatOf(row) { return row.actionLabel; }

  function noteOf(row) {
    if (row.note) return row.note;
    if (!row.isMaster || !row.after || blank(row.after.changeNote)) return '';
    return !row.before || row.before.changeNote !== row.after.changeNote ? String(row.after.changeNote) : '';
  }

  /* ------------------------------------------------------------- cells */

  function arrow() { return h('span', { 'class': 'mk-faint', 'aria-hidden': 'true' }, ui.icon('arrow-right', 12)); }

  function changeCell(value, row) {
    if (!row.isMaster) {
      if (blank(row.before) && blank(row.after)) return h('span', { 'class': 'mk-faint' }, '-');
      return h('span', { 'class': 'mk-row mk-gap-1' },
        blank(row.before) ? null : [ui.statusChip(row.before), h('span', { 'class': 'mk-sr' }, ' to '), arrow()],
        blank(row.after) ? null : ui.statusChip(row.after));
    }
    var list = changesOf(row);
    if (!row.before) return h('span', { 'class': 'mk-muted' }, 'New record, ' + fmt.num(list.length) + (list.length === 1 ? ' value' : ' values'));
    if (!list.length) return h('span', { 'class': 'mk-muted' }, 'No value changed');
    var first = list[0];
    return h('span', { 'class': 'mk-row mk-gap-1' },
      h('span', null, first.label + ': ' + first.beforeText), h('span', { 'class': 'mk-sr' }, ' to '), arrow(), h('span', { 'class': 'mk-strong' }, first.afterText),
      list.length > 1 ? h('span', { 'class': 'mk-small mk-muted' }, 'and ' + fmt.num(list.length - 1) + ' more') : null);
  }

  function recordCell(value, row) {
    if (!row.isMaster) return h('div', null, forms.docLink(row.docId), h('div', { 'class': 'mk-small mk-muted' }, row.typeLabel));
    var name = recordName(row);
    /* a record is known by its name; its id is an internal one and stays in the CSV */
    return h('div', null, h('span', { 'class': 'mk-strong' }, name || row.docId), h('div', { 'class': 'mk-small mk-muted' }, row.typeLabel));
  }

  var COLUMNS = [
    { key: 'at', label: 'When', render: function (v) { return ui.dateTime(v); }, sortValue: function (r) { return r.seq; } },
    { key: 'userName', label: 'Who', render: ui.cells.twoLine('roleLabel', { maxWidth: 200 }) },
    { key: 'actionLabel', label: 'What', render: function (v, r) { return whatOf(r); }, sortValue: whatOf },
    { key: 'docId', label: 'Document or record', render: recordCell },
    { key: 'change', label: 'Before and after', render: changeCell, sortable: false },
    { key: 'note', label: 'Note', maxWidth: 220, render: function (v, r) { return noteOf(r) || h('span', { 'class': 'mk-faint' }, '-'); }, sortable: false }
  ];

  /* what the CSV carries: one plain value per column */
  function side(row, which) {
    if (!row.isMaster) return blank(row[which]) ? '' : HB.data.lookup.statusLabel(row[which]);
    return changesOf(row).map(function (c) { return c.label + ': ' + (which === 'before' ? c.beforeText : c.afterText); }).join('; ');
  }
  var CSV = [
    { key: 'date', label: 'Date' }, { key: 'time', label: 'Time' }, { key: 'userName', label: 'User' }, { key: 'roleLabel', label: 'Role' },
    { key: 'actionLabel', label: 'What', value: whatOf }, { key: 'typeLabel', label: 'Type' }, { key: 'docId', label: 'Document or record' },
    { key: 'recordName', label: 'Record name', value: function (r) { return r.isMaster ? recordName(r) : ''; } },
    { key: 'before', label: 'Before', value: function (r) { return side(r, 'before'); } },
    { key: 'after', label: 'After', value: function (r) { return side(r, 'after'); } },
    { key: 'note', label: 'Note', value: noteOf }
  ];

  function searchText(row) { return [row.docId, row.typeLabel, row.userName, row.roleLabel, row.text, row.note, row.isMaster ? recordName(row) : ''].join(' '); }

  /* ------------------------------------------------------------ the page */

  /** The record before and after, in a drawer: what docView is to a document. */
  function openChange(row) {
    var list = changesOf(row), name = recordName(row), note = noteOf(row);
    ui.drawer({
      title: row.typeLabel + ' ' + (name || row.docId),
      subtitle: whatOf(row) + ' by ' + row.userName + ', ' + row.roleLabel + ', on ' + ui.dateTime(row.at),
      body: ui.stack([
        ui.keyValue([['Record', row.typeLabel + ' ' + (name || row.docId)], ['Reason', note || null]]),
        ui.callout('neutral', null, 'A change applies to new documents only. Posted documents keep the values they were posted with.'),
        ui.table({ dense: true, empty: 'No value changed', rows: list, columns: [
          { key: 'label', label: 'Field', wrap: true },
          { key: 'beforeText', label: 'Before', wrap: true },
          { key: 'afterText', label: 'After', wrap: true, className: 'mk-strong' }] })
      ], 3)
    });
  }

  function filterOf(ctx, limit) {
    var st = ctx.state, f = { from: ctx.filters.from, to: ctx.filters.to, userId: st.userId || null };
    if (st.kind === 'masters') f.masters = true; else if (st.kind) f.action = st.kind;
    if (limit !== undefined) f.limit = limit;
    return f;
  }

  function matches(row, q) {
    var words = String(q || '').toLowerCase().split(/\s+/).filter(Boolean), text = words.length ? searchText(row).toLowerCase() : '';
    return words.every(function (w) { return text.indexOf(w) !== -1; });
  }

  /**
   * The router sends here the one document link no other page can show: a cancellation whose document cannot be
   * found (docs/shell/UI-API.md 1.2). There is nothing to draw but that, and the way back to the log.
   */
  function about(rootEl, ctx) {
    rootEl.appendChild(forms.missingDoc(ctx.docId, { onBack: ctx.closeDoc, backLabel: 'Back to the audit log' }));
  }

  HB.router.register({
    id: 'sys-audit', route: '#/system/audit', group: 'System', title: 'Audit log', filters: ['date'],
    subtitle: 'Who did what, in which role and when',
    render: function (rootEl, ctx) {
      if (ctx.docId) return about(rootEl, ctx);                    /* '#/doc/<id>' of a cancellation whose document is gone */
      var st = ctx.state;
      st.list = st.list || {};
      var res = HB.data.audit.list(filterOf(ctx));                 /* { from, to, rows, count, truncated }: call, draw, forget */

      function pick(key) { return function (v) { st[key] = v; st.list.page = 0; ctx.rerender(); }; }
      var users = [{ value: '', label: 'Every user' }].concat(HB.data.lookup.users().map(function (u) { return { value: u.id, label: u.display }; }));
      var userSel = ui.select({ options: users, value: st.userId || '', size: 'sm', ariaLabel: 'User', name: 'audit-user', onChange: pick('userId') });
      var kindSel = ui.select({ options: KINDS, value: st.kind || '', size: 'sm', ariaLabel: 'Kind of entry', name: 'audit-kind', onChange: pick('kind') });

      var csv = ui.button({ label: 'CSV', icon: 'download', size: 'sm', title: 'Every entry that matches, also those the list leaves out',
        onClick: function () {
          /* the list may be cut short; the file is not: ask the selector for every row of the same filter */
          var all = (res.truncated ? HB.data.audit.list(filterOf(ctx, 0)).rows : res.rows).filter(function (r) { return matches(r, st.list.q); });
          var file = 'audit_log_' + res.from + '_to_' + res.to + '.csv';   /* named like the audit log of the Reports screen */
          ui.downloadCsv(file, CSV, all);
          ui.toast(fmt.num(all.length) + (all.length === 1 ? ' entry in ' : ' entries in ') + file + '.', { title: 'Audit log exported', tone: 'good' });
        } });

      /* user and kind go to the selector, so the cut of a long range falls after them; the search works on what is listed */
      rootEl.appendChild(h('div', { 'class': 'mk-row mk-row--wrap mk-gap-4' },
        h('label', { 'class': 'mk-row mk-gap-2' }, h('span', { 'class': 'mk-label' }, 'User'), userSel),
        h('label', { 'class': 'mk-row mk-gap-2' }, h('span', { 'class': 'mk-label' }, 'Kind'), kindSel)));

      if (res.truncated) {
        rootEl.appendChild(ui.callout('warn', 'The list is cut short',
          'It shows the latest ' + fmt.num(res.rows.length) + ' of ' + fmt.num(res.count) + ' entries. Narrow the dates, or pick a user or a kind, to reach the earlier ones. The CSV holds all of them.'));
      }

      rootEl.appendChild(forms.docList({
        state: st.list, rows: res.rows, columns: COLUMNS,
        title: fmt.num(res.count) + (res.count === 1 ? ' entry' : ' entries'),
        subtitle: HB.filters.rangeLabel(res) + ', newest first. Entries are added, never changed.',
        search: searchText, searchPlaceholder: 'Search the entries',
        actions: csv,
        empty: 'No entry matches in this range',
        /* a document the persona has a screen for opens there; a master change opens the record before and after */
        onOpen: function (row) { if (row.isMaster) openChange(row); else if (HB.router.docPage(row.docId)) ctx.openDoc(row.docId); }
      }));
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
