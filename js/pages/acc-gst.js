/*
 * GST summary (#/accounts/gst). For the range of the filter bar: output GST by rate with the Nil-rated sales shown
 * outside the taxable turnover, input GST by rate, and the difference. Nothing is filed from this sample.
 * A read-only figures page (docs/PAGES.md section 2). Every figure is HB.data.gst.summary's; the page holds the wording.
 */
(function (root) {
  'use strict';

  var HB = root.HB;
  if (!HB || !HB.router || !HB.ui) return;
  var ui = HB.ui, fmt = HB.fmt;

  function rupees(key) { return function (row) { return typeof row[key] === 'number' ? HB.money.toRupees(row[key]) : ''; }; }

  var COLUMNS = [
    { key: 'label', label: 'Rate' },
    { key: 'taxable', label: 'Value before GST', format: 'inr2', value: rupees('taxable') },
    { key: 'cgst', label: 'CGST', format: 'inr2', value: rupees('cgst') },
    { key: 'sgst', label: 'SGST', format: 'inr2', value: rupees('sgst') },
    { key: 'tax', label: 'GST', format: 'inr2', value: rupees('tax') }
  ];

  /** One side of the summary: the rated lines, their total, and beneath it what carries no GST. */
  function sideCard(o) {
    var rated = o.rows.filter(function (r) { return r.gstRate !== 0; }), t = o.totals;
    return ui.card({
      title: o.title, subtitle: o.subtitle, flush: true,
      body: ui.table({
        columns: COLUMNS, rows: rated, dense: true, empty: o.empty,
        footer: [
          { label: o.totalLabel, taxable: t.taxable, cgst: t.cgst, sgst: t.sgst, tax: t.tax },
          { label: o.nilLabel, taxable: t.nilRated }
        ]
      })
    });
  }

  function differenceCard(g) {
    var o = g.outputTotals, i = g.inputTotals;
    return ui.card({
      title: 'The difference', subtitle: 'Output GST less input GST. All input GST is treated as credit.', flush: true,
      body: ui.table({
        columns: COLUMNS.filter(function (c) { return c.key !== 'taxable'; }).map(function (c) { return c.key === 'label' ? { key: 'label', label: '' } : c; }),
        rows: [{ label: 'Output GST, on sales', cgst: o.cgst, sgst: o.sgst, tax: o.tax }, { label: 'Input GST, on purchases and expenses', cgst: i.cgst, sgst: i.sgst, tax: i.tax }],
        dense: true,
        footer: { label: 'Output less input', cgst: g.net.cgst, sgst: g.net.sgst, tax: g.net.tax }
      })
    });
  }

  /** The whole summary as one sheet: side, line, and the figures in rupees. */
  function csv(g) {
    var rows = [];
    function side(name, list, t, totalLabel, nilLabel) {
      list.forEach(function (r) { if (r.gstRate !== 0) rows.push({ side: name, label: r.label, taxable: r.taxable, cgst: r.cgst, sgst: r.sgst, tax: r.tax }); });
      rows.push({ side: name, label: totalLabel, taxable: t.taxable, cgst: t.cgst, sgst: t.sgst, tax: t.tax });
      rows.push({ side: name, label: nilLabel, taxable: t.nilRated });
    }
    side('Output', g.output, g.outputTotals, 'Taxable turnover', 'Nil-rated, outside taxable turnover');
    side('Input', g.input, g.inputTotals, 'Purchases and expenses with GST', 'Nil-rated purchases on vendor bills');
    rows.push({ side: 'Difference', label: 'Output less input', cgst: g.net.cgst, sgst: g.net.sgst, tax: g.net.tax });
    ui.downloadCsv('gst-summary-' + g.from + '-to-' + g.to + '.csv', [{ key: 'side', label: 'Side' }].concat(COLUMNS), rows);
  }

  HB.router.register({
    id: 'acc-gst', route: '#/accounts/gst', group: 'Accounts', title: 'GST summary', filters: ['date'],
    subtitle: 'Output, input and the difference',
    render: function (rootEl, ctx) {
      var g = HB.data.gst.summary({ from: ctx.filters.from, to: ctx.filters.to });
      var o = g.outputTotals, i = g.inputTotals, range = HB.filters.rangeLabel(g);
      var net = g.net.tax, which = net > 0 ? 'Output is above input' : (net < 0 ? 'Input is above output' : 'Output and input are equal');

      ui.append(rootEl,
        ui.sectionTitle('GST for ' + range, null,
          ui.button({ label: 'CSV', icon: 'download', size: 'sm', onClick: function () { csv(g); } })),
        ui.kpiRow([
          { label: 'Taxable turnover', value: fmt.inr2(o.taxable), sub: 'Nil-rated sales of ' + fmt.inr2(o.nilRated) + ' stand outside it' },
          { label: 'Output GST', value: fmt.inr2(o.tax), sub: 'On sales, less stale returns' },
          { label: 'Input GST', value: fmt.inr2(i.tax), sub: 'On vendor bills and expenses' },
          { label: 'Output less input', value: fmt.inr2(net), sub: which }
        ]),
        sideCard({
          title: 'Output: sales', subtitle: 'Invoices and store day-ends, less stale returns, by GST rate',
          rows: g.output, totals: o, empty: 'No taxable sale in this range',
          totalLabel: 'Taxable turnover', nilLabel: 'Nil-rated sales, outside taxable turnover'
        }),
        sideCard({
          /* an expense with no GST on it (a salary, a claim) writes nothing here: it is no purchase of goods at Nil */
          title: 'Input: purchases and expenses', subtitle: 'Vendor bills, and approved expenses that carry GST, by GST rate',
          rows: g.input, totals: i, empty: 'No purchase or expense with GST in this range',
          totalLabel: 'Purchases and expenses with GST', nilLabel: 'Nil-rated purchases on vendor bills'
        }),
        differenceCard(g));
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
