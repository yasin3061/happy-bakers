/*
 * What the higher tiers add (#/system/tiers). SCOPE 4.12: the three offerings in one plain line each, then the
 * table of where a locked card sits in this sample, what it stands for and which tier holds it. The last row says
 * that tasks, attendance and leave are part of Neo ERP and are not shown here. No prices, no figures: the page is
 * wording only, and every role has it.
 */
(function (root) {
  'use strict';

  var HB = root.HB;
  if (!HB || !HB.router || !HB.ui || !HB.forms) return;
  var ui = HB.ui, h = ui.h;

  var NEO = 'Neo ERP', INEO = 'iNeo', NEOX = 'NeoX';

  var OFFERINGS = [
    { tier: NEO, here: true, line: 'Digitise daily work in one shared system.' },
    { tier: INEO, line: 'Connect outside systems such as the bank, Tally or Zoho Books and GST verification, bring in 12 to 18 months of history, and add basic budgets.' },
    { tier: NEOX, line: 'Analyse several years of history, forecast with statistical methods and plan with budgets and scenarios.' }
  ];

  /* SCOPE 4.12, row for row: where the card sits (the page that carries it), what it stands for, the tier */
  var ROWS = [
    { where: 'Expenses', page: 'expenses', what: ['Budget against actual'], tier: INEO },
    { where: 'Low-stock list', page: 'stock-onhand', what: ['Purchase requirement raised automatically'], tier: INEO },
    { where: 'Vendor and customer forms', page: 'masters-parties', what: ['GSTIN verification'], tier: INEO },
    { where: 'Cash and bank', page: 'acc-cash', what: ['Bank feed and reconciliation', 'Tally or Zoho Books sync'], tier: INEO },
    { where: 'Reports', page: 'reports', what: ['Month-on-month and year-on-year dashboards'], tier: INEO },
    { where: 'Dashboard', page: 'home', what: ['Sales forecast with suggested production', '30/60/90-day cash projection'], tier: NEOX },
    { where: 'People', page: 'people', what: ['Attendance and leave', 'Tasks'], tier: NEO, inTier: true }
  ];

  function tierChip(tier, inThisSample) {
    if (tier === NEO) return ui.chip(NEO, 'good', { icon: 'check', title: inThisSample ? 'The tier this sample shows' : 'Part of Neo ERP' });
    return ui.chip(tier, 'info', { icon: 'lock', title: 'In the ' + tier + ' tier, not in Neo ERP' });
  }

  /** The screen that carries the card: a link when this role has it, plain words when it does not. */
  function whereCell(value, row) {
    var page = HB.router.pages().filter(function (p) { return p.id === row.page; })[0] || null;
    if (page && HB.router.isAllowed(page)) return ui.link(row.where, page.route, { title: 'Open ' + page.title });
    return h('span', { title: page ? 'Your role does not have this screen' : null }, row.where);
  }

  function tierCell(value, row) {
    if (!row.inTier) return tierChip(row.tier);
    return h('div', null, tierChip(row.tier), h('div', { 'class': 'mk-small mk-muted mk-mt-1' }, 'In the tier, not shown in this sample'));
  }

  function offering(o) {
    return ui.card({
      className: 'pg-sys-tiers__offer',
      title: o.tier, actions: o.here ? ui.chip('This sample', 'good', { icon: 'check' }) : ui.chip('Higher tier', 'info', { icon: 'lock' }),
      body: h('div', { 'class': 'pg-sys-tiers__line' }, o.line)
    });
  }

  HB.router.register({
    id: 'sys-tiers', route: '#/system/tiers', group: 'System', title: 'What the higher tiers add', navLabel: 'Higher tiers', filters: [],
    subtitle: 'Neo ERP, iNeo and NeoX',
    render: function (rootEl) {
      ui.append(rootEl,
        ui.callout('info', 'This sample is Neo ERP, the first of three offerings',
          'Everything on its screens works end to end. Where a prospect would look for something a higher tier adds, a small locked card says so in one line. Nothing behind such a card is built here, and no figure is made up for it.'),
        ui.grid(3, OFFERINGS.map(offering)),
        ui.card({
          title: 'Where the locked cards are', subtitle: 'The place in this sample, what the card stands for, and the tier that holds it', flush: true,
          body: ui.table({ rows: ROWS, columns: [
            { key: 'where', label: 'Where', render: whereCell },
            { key: 'what', label: 'What', wrap: true, render: function (v) { return h('div', null, v.map(function (line) { return h('div', null, line); })); } },
            { key: 'tier', label: 'Tier', render: tierCell }
          ] })
        }),
        ui.callout('good', 'Tasks, attendance and leave are part of Neo ERP',
          'They belong to the tier this sample shows. The sample leaves them out to stay small, so their absence here says nothing about Neo ERP.'));
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
