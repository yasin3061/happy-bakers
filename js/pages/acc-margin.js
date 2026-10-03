/*
 * Product margin (#/accounts/margin). For the range of the filter bar: margin by channel, and margin by product for
 * every channel or for one, each with quantity, sales, cost, margin and margin percent; a link to the cost sheet of
 * each product.
 * A read-only figures page (docs/PAGES.md section 2). Every figure is HB.data.margin's; the page holds the wording.
 */
(function (root) {
  'use strict';

  var HB = root.HB;
  if (!HB || !HB.router || !HB.ui) return;
  var ui = HB.ui, fmt = HB.fmt;

  function rupees(key) { return function (row) { return HB.money.toRupees(row[key]); }; }
  function pctNumber(key) { return function (row) { return typeof row[key] === 'number' ? Math.round(row[key] * 10000) / 100 : ''; }; }   /* a fraction as a percentage, for the CSV */
  function csvButton(name, columns, rows) {
    return ui.button({ label: 'CSV', icon: 'download', size: 'sm', onClick: function () { ui.downloadCsv(name, columns, rows); } });
  }

  function channelCard(st, res) {
    var columns = [
      { key: 'label', label: 'Channel' },
      { key: 'units', label: 'Quantity', format: 'num' },
      { key: 'net', label: 'Sales', format: 'inr2', value: rupees('net'), title: 'Before GST, after stale returns' },
      { key: 'cogs', label: 'Cost', format: 'inr2', value: rupees('cogs'), title: 'The recipe cost fixed when each sale was posted' },
      { key: 'margin', label: 'Margin', format: 'inr2', value: rupees('margin') },
      { key: 'marginPct', label: 'Margin %', format: 'pct', value: pctNumber('marginPct') },
      { key: 'share', label: 'Share of sales', format: 'pct', value: pctNumber('share') }
    ];
    var t = res.totals;
    return ui.card({
      title: 'By channel', subtitle: 'Units sold, sales before GST and after stale returns, and the cost of the goods sold', flush: true,
      actions: csvButton('margin-by-channel.csv', columns, res.rows),
      body: ui.table({
        columns: columns, rows: res.rows, dense: true, empty: 'No sale in this range',
        sortable: true, sort: st.channelSort, onSort: function (s) { st.channelSort = s; },
        footer: res.rows.length ? { label: 'Total', units: t.units, net: t.net, cogs: t.cogs, margin: t.margin, marginPct: t.marginPct } : null
      })
    });
  }

  function itemCard(st, ctx, res, channels, channel) {
    var columns = [
      /* the product is the link to its cost sheet on the recipes screen */
      { key: 'itemName', label: 'Product', maxWidth: 240, render: function (v, row) {
        return ui.link(row.itemName, HB.router.href('make-recipes', { item: row.itemId }), { title: 'Open the cost sheet of ' + row.itemName });
      } },
      { key: 'units', label: 'Quantity', format: 'qty' },                    /* 'qty' reads row.unit */
      { key: 'net', label: 'Sales', format: 'inr2', value: rupees('net'), title: 'Before GST, after stale returns' },
      { key: 'cogs', label: 'Cost', format: 'inr2', value: rupees('cogs'), title: 'The recipe cost fixed when each sale was posted' },
      { key: 'margin', label: 'Margin', format: 'inr2', value: rupees('margin') },
      { key: 'marginPct', label: 'Margin %', format: 'pct', value: pctNumber('marginPct') }
    ];
    var t = res.totals;
    return ui.card({
      title: 'By product', flush: true,
      subtitle: (channel ? 'Sold through ' + channel.name.toLowerCase() : 'Sold through every channel') + '. A product opens its cost sheet.',
      actions: [
        ui.segmented({ size: 'sm', ariaLabel: 'Channel', value: channel ? channel.id : 'all',
          options: [{ value: 'all', label: 'All channels' }].concat(channels.map(function (c) { return { value: c.id, label: c.name }; })),
          onChange: function (v) { st.channel = v; ctx.rerender(); } }),
        csvButton('margin-by-product' + (channel ? '-' + channel.id : '') + '.csv', columns, res.rows)
      ],
      body: ui.table({
        columns: columns, rows: res.rows, dense: true, empty: 'No sale in this range',
        sortable: true, sort: st.itemSort, onSort: function (s) { st.itemSort = s; },
        footer: res.rows.length ? { itemName: 'Total', net: t.net, cogs: t.cogs, margin: t.margin, marginPct: t.marginPct } : null
      })
    });
  }

  HB.router.register({
    id: 'acc-margin', route: '#/accounts/margin', group: 'Accounts', title: 'Product margin', filters: ['date'],
    subtitle: 'By product and by channel',
    render: function (rootEl, ctx) {
      var st = ctx.state, from = ctx.filters.from, to = ctx.filters.to;
      var channels = HB.data.lookup.channels();
      var channel = channels.filter(function (c) { return c.id === st.channel; })[0] || null;
      var byChannel = HB.data.margin.byChannel({ from: from, to: to });
      var byItem = HB.data.margin.byItem(channel ? { from: from, to: to, channel: channel.id } : { from: from, to: to });
      var t = byChannel.totals, range = HB.filters.rangeLabel(byChannel);

      ui.append(rootEl,
        ui.kpiRow([
          { label: 'Sales', value: fmt.inr(t.net), sub: 'Before GST, after stale returns of ' + fmt.inr(-t.returns) },
          { label: 'Cost of goods sold', value: fmt.inr(t.cogs), sub: 'Recipe cost when each sale was posted' },
          { label: 'Margin', value: fmt.inr(t.margin), sub: range },
          { label: 'Margin %', value: fmt.pct(t.marginPct), sub: 'Margin over sales' }
        ]),
        channelCard(st, byChannel),
        itemCard(st, ctx, byItem, channels, channel),
        ui.callout('neutral', 'How the cost is worked out',
          'The cost of a sale is the recipe cost of the product on the day the invoice or the day-end was posted: recipe quantities at the latest purchase prices, plus packing. A stale return reduces sales and leaves the cost where it was. Labour, gas, power and rent are not spread over products: they are in the monthly profit and loss.'));
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
