/*
 * Reports (#/reports). One screen over every register of SCOPE 4.10: pick a report, set the date range in the
 * filter bar and the filters the report declares, read the table with its totals, export it as CSV.
 * The registers, their columns, rows, totals and notes are HB.data.reports'; the page holds the layout and no figure.
 */
(function (root) {
  'use strict';

  var HB = root.HB;
  if (!HB || !HB.router || !HB.ui || !HB.forms) return;
  var ui = HB.ui, h = ui.h, forms = HB.forms, fmt = HB.fmt;

  var ROUTE = '#/reports';
  var PAGE = 100;   /* rows on a screen; the export carries every row */
  var TABLE_HEIGHT = 560;   /* the table scrolls inside the card, so its heads, its totals and its sideways scroll bar stay in reach */

  function R() { return HB.data.reports; }
  function L() { return HB.data.lookup; }

  /* ------------------------------------------------------------- filters */

  /** The filter a report is run with: the range of the filter bar and what the report declares, always in this order. */
  function filterOf(def, ctx) {
    var st = ctx.state.f, f = {};
    function takes(name) { return def.filters.indexOf(name) !== -1; }
    if (takes('range')) { f.from = ctx.filters.from; f.to = ctx.filters.to; }
    if (takes('unit')) f.unitId = st.unitId || null;
    if (takes('channel')) f.channel = st.channel || null;
    if (takes('location')) f.locId = st.locId || null;
    if (takes('item')) f.itemId = st.itemId || null;
    if (takes('account')) f.accountId = st.accountId || null;
    return f;
  }

  /** The same filter with no row limit: what the export asks for. */
  function withAll(f) {
    var out = {}, k;
    for (k in f) if (Object.prototype.hasOwnProperty.call(f, k)) out[k] = f[k];
    out.limit = 0;
    return out;
  }

  function closed(rec) { return rec.active ? rec.name : rec.name + ' (closed)'; }

  /** One labelled select of the report's own filters. An empty value means "all". */
  function choice(ctx, key, label, allLabel, records) {
    var st = ctx.state;
    return ui.form.field({ label: label, control: ui.form.select({
      ariaLabel: label, name: key, value: st.f[key] || '',
      options: [{ value: '', label: allLabel }].concat(records.map(function (r) { return { value: r.id, label: closed(r) }; })),
      onChange: function (v) { st.f[key] = v || null; st.page = 0; ctx.rerender(); }
    }) });
  }

  function controls(def, ctx) {
    var st = ctx.state, out = [];
    function takes(name) { return def.filters.indexOf(name) !== -1; }
    if (takes('unit')) out.push(choice(ctx, 'unitId', 'Location', 'All locations', L().units({ active: 'all' })));
    if (takes('channel')) out.push(choice(ctx, 'channel', 'Channel', 'All channels', L().channels().map(function (c) { return { id: c.id, name: c.name, active: true }; })));
    if (takes('location')) out.push(choice(ctx, 'locId', 'Stock location', 'All stock locations', L().locations({ active: 'all' })));
    if (takes('account')) out.push(choice(ctx, 'accountId', 'Account', 'All accounts', L().accounts({ active: 'all' })));
    if (takes('item')) {
      var picker = forms.itemPicker({ value: st.f.itemId || null, includeInactive: true, placeholder: 'All items', ariaLabel: 'Item', name: 'itemId',
        onChange: function (id) { st.f.itemId = id || null; st.page = 0; ctx.rerender(); } });
      out.push(h('div', { 'class': 'rp-item' }, ui.form.field({ label: 'Item', control: picker })));
    }
    return out.length ? h('div', { 'class': 'rp-filters' }, out) : null;
  }

  /* --------------------------------------------------------------- table */

  /** The columns of a result as the table takes them: a document id as a link, every other cell as the selector formats it. */
  function columnsOf(res) {
    return res.columns.map(function (c) {
      return {
        key: c.key, label: c.label, align: c.align, maxWidth: c.format === 'text' && !c.doc ? 260 : null,
        render: function (v, row) { return c.doc ? (v ? forms.docLink(v) : '') : R().cell(c, row); }
      };
    });
  }

  /** The totals of a result as the table's footer, formatted like the cells above them. */
  function footerOf(res) {
    if (!res.totals) return null;
    var out = {}, any = false;
    res.columns.forEach(function (c) {
      var v = res.totals[c.key];
      if (v === undefined || v === null || c.format === 'text' || c.format === 'date') return;
      out[c.key] = R().cell(c, res.totals);
      any = true;
    });
    if (!any) return null;
    var first = res.columns.filter(function (c) { return out[c.key] === undefined; })[0];
    if (first) out[first.key] = 'Total';
    return out;
  }

  function rowsText(n) { return fmt.num(n) + (n === 1 ? ' row' : ' rows'); }

  function fileName(res) {
    return res.id + '_' + (res.from ? res.from + '_to_' + res.to : 'as_of_' + HB.calendar.today) + '.csv';
  }

  function reportCard(def, ctx) {
    var st = ctx.state, f = filterOf(def, ctx), res = R().run(def.id, f);
    var asOf = !res.from;
    var pages = Math.max(1, Math.ceil(res.rows.length / PAGE));
    st.page = Math.max(0, Math.min(st.page || 0, pages - 1));
    var from = st.page * PAGE, slice = res.rows.slice(from, from + PAGE);

    var exportBtn = ui.button({ label: 'CSV', icon: 'download', size: 'sm', title: 'Every row of this report, as a file for a spreadsheet',
      onClick: function () {
        var all = R().run(def.id, withAll(f));
        ui.downloadCsv(fileName(all), R().csvColumns(all), all.rows);
        ui.toast(rowsText(all.rows.length) + ' in ' + fileName(all) + '.', { title: res.title + ' exported', tone: 'good' });
      } });

    var prev = ui.iconButton('chevron-left', 'Previous page', function () { st.page = Math.max(0, st.page - 1); ctx.rerender(); }, { size: 'sm' });
    var next = ui.iconButton('chevron-right', 'Next page', function () { st.page = st.page + 1; ctx.rerender(); }, { size: 'sm' });
    prev.disabled = st.page <= 0;
    next.disabled = st.page >= pages - 1;
    var count = res.rows.length ? fmt.num(from + 1) + ' - ' + fmt.num(from + slice.length) + ' of ' + rowsText(res.rows.length) : rowsText(0);
    var pager = h('div', { 'class': ['mk-doclist__pager', pages <= 1 ? 'is-single' : ''] }, h('span', { 'class': 'mk-doclist__count' }, count), prev, next);

    return ui.card({
      title: res.title, flush: true, className: 'mk-doclist rp-report', actions: exportBtn,
      subtitle: asOf ? 'As of the business date, ' + ui.format('date', HB.calendar.today) + '. The date range does not apply to this report.'
        : HB.filters.rangeLabel({ from: res.from, to: res.to }),
      body: [
        controls(def, ctx),
        res.note ? h('div', { 'class': 'rp-note' }, ui.callout('info', null, res.note)) : null,
        ui.table({
          columns: columnsOf(res), rows: slice, dense: true, footer: footerOf(res), maxHeight: TABLE_HEIGHT,
          empty: asOf ? 'Nothing to list as of the business date' : 'Nothing in this range',
          rowClass: function (row) { return row.strong ? 'is-strong' : ''; }
        })
      ],
      footer: pager
    });
  }

  /* -------------------------------------------------------------- chooser */

  function chooser(list, sel, ctx) {
    var st = ctx.state, groups = [];
    list.forEach(function (r) { if (groups.indexOf(r.group) === -1) groups.push(r.group); });
    function pick(id) { st.reportId = id; st.page = 0; ctx.navigate(ROUTE, { report: id }); }
    return ui.card({
      className: 'rp-chooser',
      body: [
        ui.tabs({
          ariaLabel: 'Kind of report', value: sel.group,
          items: groups.map(function (g) { return { id: g, label: g, count: list.filter(function (r) { return r.group === g; }).length }; }),
          onChange: function (g) { pick(list.filter(function (r) { return r.group === g; })[0].id); }
        }),
        h('div', { 'class': 'rp-list', role: 'group', 'aria-label': sel.group + ' reports' }, list.filter(function (r) { return r.group === sel.group; }).map(function (r) {
          var on = r.id === sel.id;
          var btn = ui.button({ label: r.title, size: 'sm', variant: on ? 'primary' : 'secondary', onClick: function () { if (!on) pick(r.id); } });
          btn.setAttribute('aria-pressed', on ? 'true' : 'false');
          return btn;
        }))
      ]
    });
  }

  /* ------------------------------------------------------------------ page */

  HB.router.register({
    id: 'reports', route: ROUTE, group: 'Reports', title: 'Reports', subtitle: 'Each with a date range and a CSV export', filters: ['date'],
    render: function (rootEl, ctx) {
      var st = ctx.state, list = R().list();
      st.f = st.f || {};
      if (!list.length) { rootEl.appendChild(ui.emptyState('No report for this role', 'The registers are for the Owner and for Accounts.', { icon: 'file' })); return; }
      var wanted = ctx.params.report || st.reportId;
      var sel = list.filter(function (r) { return r.id === wanted; })[0] || list[0];
      if (st.reportId !== sel.id) { st.reportId = sel.id; st.page = 0; }
      ui.append(rootEl,
        chooser(list, sel, ctx),
        reportCard(sel, ctx),
        forms.teaser({ title: 'Month-on-month and year-on-year dashboards', tier: 'iNeo',
          text: 'Each register set against the month before and the same month a year earlier, as charts.' }));
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
