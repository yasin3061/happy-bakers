/*
 * Monthly profit and loss (#/accounts/pnl). The months since go-live side by side, line by line; a figure opens the
 * documents behind it; one bar chart of the months; CSV. No figure is set against another period.
 * A read-only figures page (docs/PAGES.md section 2). Every line, subtotal and percentage is HB.data.pnl's; the page
 * lays the months next to each other and holds the wording.
 */
(function (root) {
  'use strict';

  var HB = root.HB;
  if (!HB || !HB.router || !HB.ui || !HB.forms) return;
  var ui = HB.ui, h = ui.h, forms = HB.forms, fmt = HB.fmt;

  /* how many months stand side by side: a width of the table, not a figure of the business */
  var SPANS = [{ value: 'half', label: 'Last 6 months', months: 6 }, { value: 'year', label: 'Last 12 months', months: 12 }, { value: 'all', label: 'Since go-live', months: 0 }];
  /* what the bar chart can show, each a field of HB.data.pnl.months() */
  var MEASURES = [{ value: 'netSales', label: 'Net sales' }, { value: 'grossMargin', label: 'Gross margin' }, { value: 'operatingProfit', label: 'Operating profit' }];
  /* a line that reads as a clause in the statement, as the heading of its documents */
  var HEADINGS = { returns: 'Stale returns' };

  function day(iso) { return ui.format('date', iso); }
  function pctNumber(x) { return typeof x === 'number' ? Math.round(x * 10000) / 100 : ''; }   /* a fraction as a percentage, for the CSV */

  /* ------------------------------------------------------- the statement */

  /**
   * The months as one statement: a row per line of HB.data.pnl.month(), in the order the months give them (an
   * expense category that appears in a later month takes its place among the expenses), each with one cell per month.
   */
  function statement(monthKeys) {
    var months = monthKeys.map(function (mk) { return HB.data.pnl.month(mk); });
    var rows = [], byKey = {};
    function rowOf(key, label, after, extra) {
      var row = byKey[key];
      if (!row) {
        row = byKey[key] = { key: key, label: label, cells: {} };
        for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) row[k] = extra[k];
        rows.splice(after + 1, 0, row);
      }
      return row;
    }
    months.forEach(function (m) {
      var at = -1;
      function put(key, label, cell, extra) {
        var row = rowOf(key, label, at, extra);
        row.cells[m.monthKey] = cell;
        at = rows.indexOf(row);
      }
      m.lines.forEach(function (l) {
        put(l.key, l.label, { amount: l.amount, drill: l.drill }, { strong: l.strong });
        /* the two percentages of the selector stand under the subtotals they belong to */
        if (l.key === 'grossMargin') put('grossMarginPct', 'Gross margin, share of net sales', { amount: m.grossMarginPct }, { pct: true });
        if (l.key === 'operatingProfit') put('operatingPct', 'Operating profit, share of net sales', { amount: m.operatingPct }, { pct: true });
      });
    });
    return { months: months, rows: rows };
  }

  function cellText(row, cell) {
    if (!cell || cell.amount === null || cell.amount === undefined) return '-';
    return row.pct ? fmt.pct(cell.amount) : fmt.inrFull(cell.amount);
  }

  function statementCard(st, ctx, all) {
    var spans = SPANS.filter(function (s) { return s.months === 0 || all.length > s.months; });
    var span = spans.filter(function (s) { return s.value === st.span; })[0] || spans[spans.length - 1];
    var keys = all.map(function (m) { return m.monthKey; });
    if (span.months) keys = keys.slice(-span.months);
    var s = statement(keys), last = s.months[s.months.length - 1];

    var columns = [{ key: 'label', label: 'Line' }].concat(s.months.map(function (m) {
      return {
        key: m.monthKey, label: m.label, align: 'right',
        value: function (row) { var c = row.cells[m.monthKey]; return !c ? '' : (row.pct ? pctNumber(c.amount) : HB.money.toRupees(c.amount)); },
        render: function (v, row) {
          var c = row.cells[m.monthKey], text = cellText(row, c);
          if (!c || !c.drill) return text;
          return h('button', { type: 'button', 'class': 'pnl-figure', title: 'Open the documents behind this figure',
            onClick: function () { st.drill = { monthKey: m.monthKey, key: row.key }; st.rows = {}; ctx.rerender(); } }, text);
        }
      };
    }));

    var table = ui.table({
      className: 'pnl-statement', columns: columns, rows: s.rows, dense: true, empty: 'No month yet',
      rowClass: function (row) { return row.strong ? 'is-strong' : ''; }
    });
    var card = ui.card({
      title: 'Profit and loss by month', flush: true,
      subtitle: 'Sales are before GST and after stale returns. A figure opens the documents behind it. ' +
        (last ? last.label + ' runs to ' + day(HB.calendar.today) + ', the business date.' : ''),
      actions: [
        spans.length > 1 ? ui.segmented({ size: 'sm', ariaLabel: 'Months shown', value: span.value,
          options: spans.map(function (x) { return { value: x.value, label: x.label }; }),
          onChange: function (v) { st.span = v; ctx.rerender(); } }) : null,
        ui.button({ label: 'CSV', icon: 'download', size: 'sm', onClick: function () { ui.downloadCsv('profit-and-loss-by-month.csv', columns, s.rows); } })
      ],
      body: table
    });
    card.table = table;
    return card;
  }

  function monthsChart(st, all) {
    if (!HB.charts || typeof HB.charts.mount !== 'function') return null;
    function dataOf(measure) {
      return { categories: all.map(function (m) { return m.label; }), values: all.map(function (m) { return m[measure.value]; }), name: measure.label, categoryHeader: 'Month' };
    }
    function measureOf(value) { return MEASURES.filter(function (m) { return m.value === value; })[0] || MEASURES[0]; }
    var chart = HB.charts.mount(null, {
      id: 'pnl-months', kind: 'bar', title: 'Month by month since go-live', format: 'inr', height: 260,
      subtitle: all.length ? all[0].label + ' to ' + all[all.length - 1].label : null,
      data: dataOf(measureOf(st.measure)), emptyText: 'No month yet',
      controls: [{ id: 'measure', label: 'Figure', value: measureOf(st.measure).value, options: MEASURES }],
      onControl: function (id, value) { st.measure = value; chart.update({ data: dataOf(measureOf(value)) }); }
    });
    return chart.el;
  }

  function statementView(rootEl, ctx) {
    var st = ctx.state, all = HB.data.pnl.months();
    var card = statementCard(st, ctx, all);
    ui.append(rootEl, card, monthsChart(st, all));
    /* months run oldest to newest: where the table is wider than the screen, start at the newest. Once more when
       the layout has settled (the width of the page is final only then), unless the reader has scrolled meanwhile */
    var table = card.table, end = function () { table.scrollLeft = table.scrollWidth; };
    end();
    var at = table.scrollLeft;
    root.requestAnimationFrame(function () { if (table.scrollLeft === at) end(); });
  }

  /* ------------------------------------- the documents behind one figure */

  function drillView(rootEl, ctx) {
    var st = ctx.state, d = st.drill, m = HB.data.pnl.month(d.monthKey);
    var line = m.lines.filter(function (l) { return l.key === d.key; })[0];
    function back() { st.drill = null; ctx.rerender(); }
    if (!line || !line.drill) { st.drill = null; statementView(rootEl, ctx); return; }

    var entries = HB.data.pnl.entries(line.drill), heading = HEADINGS[line.key] || line.label;
    /* a cancellation reads "Cancellation of <id>: <reason>"; the selector's rows stay as they are */
    var rows = entries.map(function (e) {
      return { date: e.date, docId: e.docId, what: e.reversal ? e.note : e.typeLabel, about: e.party, lineLabel: e.lineLabel, amount: e.amount };
    });
    var columns = [
      { key: 'date', label: 'Date', format: 'date' },
      { key: 'docId', label: 'Document', doc: true },
      { key: 'what', label: 'What', maxWidth: 260 },
      { key: 'about', label: 'About', maxWidth: 240 },
      { key: 'lineLabel', label: 'Line' },
      { key: 'amount', label: 'Amount', format: 'inr2', value: function (row) { return HB.money.toRupees(row.amount); } }
    ];
    st.rows = st.rows || {};
    ui.append(rootEl,
      ui.pageHead({ title: heading + ', ' + m.label, subtitle: 'The documents behind this figure of the profit and loss statement',
        back: { label: 'Back to the statement', onClick: back } }),
      ui.kpiRow([
        { label: heading, value: fmt.inr2(line.amount), sub: m.label + ', as in the statement' },
        { label: 'Rows behind it', value: fmt.num(rows.length), sub: 'Their amounts add up to the figure' }
      ]),
      forms.docList({
        state: st.rows, rows: rows, columns: columns, onOpen: false,
        title: 'Documents', subtitle: 'Each row is what one document, or its cancellation, put on this line in ' + m.label,
        search: ['docId', 'what', 'about', 'lineLabel'], searchPlaceholder: 'Search these rows', empty: 'No document is behind this figure',
        actions: ui.button({ label: 'CSV', icon: 'download', size: 'sm',
          onClick: function () { ui.downloadCsv('profit-and-loss-' + line.key.replace(/\W+/g, '-') + '-' + m.monthKey + '.csv', columns, rows); } })
      }));
  }

  /* ------------------------------------------------------------------ page */

  HB.router.register({
    id: 'acc-pnl', route: '#/accounts/pnl', group: 'Accounts', title: 'Monthly profit and loss', navLabel: 'Profit and loss', filters: [],
    subtitle: 'Since go-live',
    render: function (rootEl, ctx) {
      if (ctx.state.drill) return drillView(rootEl, ctx);
      statementView(rootEl, ctx);
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
