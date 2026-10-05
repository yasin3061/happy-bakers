/*
 * Home (#/home). The dashboard and Today's work (SCOPE 4.10).
 * The page draws what HB.data.dash.today(), .period(range) and .work() return for the persona and nothing else: which
 * role gets which block is decided in the data layer (SPEC section 7).
 * On top stands the cockpit: one hero figure for the range of the filter bar (the month to date until another range
 * is chosen), the other figures of the range as tiles beside it, each with a small chart of the days of that range
 * (its months when the range is long), and under them what stands at the business date. Then Today's work, the tables
 * behind the figures and two plain bar charts.
 * Balances are as they stand at the business date, whatever the range. Nothing is set against another period, and
 * nothing is forecast: a small chart shows the range itself.
 */
(function (root) {
  'use strict';

  var HB = root.HB;
  if (!HB || !HB.router || !HB.ui || !HB.forms) return;
  var ui = HB.ui, h = ui.h, forms = HB.forms, fmt = HB.fmt;

  var LIST_HEIGHT = 264;   /* a list scrolls inside its card beyond about seven rows (pixels, not a business figure) */
  var LINE = '--series-1'; /* the one colour of the small charts: series 1 of css/tokens.css */

  function day(iso) { return ui.format('date', iso); }
  /** A day with its weekday, for the best and the slowest day: "Sat 3 Oct". */
  function weekday(iso) { return HB.dates.label(iso, 'EEE d MMM'); }
  /** Words that never part at a line break: an amount and its unit, a date. */
  function whole(text) { return String(text).replace(/ /g, ' '); }
  /** A compact amount for the small line of a tile: the figure and its unit ("L", "Cr") never part at a line break. */
  function inr(p) { return whole(fmt.inr(p)); }
  function count(n, one, many) { return fmt.num(n) + ' ' + (n === 1 ? one : many); }
  function find(list, key, id) { return (list || []).filter(function (x) { return x[key] === id; })[0] || {}; }
  /**
   * The rows of the range, each beside today's row of the same key: [{ r, t }], an empty object where one side has none.
   * A range that ends before today may lack a row that today has (a product made today only): it follows the others.
   */
  function pairs(today, range, key) {
    var out = (range || []).map(function (x) { return { r: x, t: find(today, key, x[key]) }; });
    (today || []).forEach(function (x) { if (find(range, key, x[key])[key] === undefined) out.push({ r: {}, t: x }); });
    return out;
  }

  /** A cell of two lines: the name in bold, a smaller line under it (a document id, a count of days). */
  function twoLine(top, under, maxWidth) {
    return h('div', { 'class': maxWidth ? 'mk-cell-clip' : null, style: maxWidth ? { maxWidth: maxWidth + 'px' } : null, title: maxWidth ? String(top) : null },
      h('div', { 'class': 'mk-strong mk-truncate' }, top), h('div', { 'class': 'mk-xs mk-muted' }, under));
  }

  /** The screen at a route, when it exists in this copy and the persona has it; else null. */
  function pageAt(route) {
    var base = String(route || '').split('?')[0];
    return HB.router.allowedPages().filter(function (p) { return p.route === base; })[0] || null;
  }
  function firstPage(routes) {
    for (var i = 0; i < routes.length; i++) { var p = pageAt(routes[i]); if (p) return p; }
    return null;
  }
  /** A tile opens the screen behind its figure, for a persona who has that screen. */
  function opener(routes) {
    var p = firstPage(routes);
    return p ? function () { HB.router.navigate(p.route); } : null;
  }
  /** The link in the head of a card: the screen that holds the full list. */
  function more(routes) {
    var p = firstPage(routes);
    return p ? ui.link(p.title, p.route, { icon: 'arrow-right' }) : null;
  }

  /* ---------------------------------------------------------------- words */
  /*
   * How the screen names the range and what stands, from what the data layer returned (`period`, `from` and `to` of
   * HB.data.dash.period). The month to date reads as it always has. Any other range is written out, "1 Sep - 30 Sep
   * 2026", wherever "month to date" stood; and a balance, which no range moves, then says the date it stands at.
   */

  function words(today, range) {
    var mtd = range.period === 'month', span = HB.filters.rangeLabel(range), asAt = whole('as at ' + day(today.to));
    return {
      mtd: mtd,
      alone: range.from === today.from && range.to === today.to,   /* the range is the business date alone: its figures are today's */
      span: span,
      asAt: asAt,
      column: mtd ? 'Month to date' : 'In the range',    /* the head of its column, beside "Today" */
      range: mtd ? 'month to date' : span,               /* after the name of a figure: "Net sales, month to date" */
      per: range.grain,                                  /* what a point of a small chart is: 'day' or 'month' */
      /** A line about a balance: as it is while the range is the month to date, with the date it stands at otherwise. */
      stands: function (text) { return mtd ? text : text + ', ' + asAt; }
    };
  }

  /* --------------------------------------------------------- small charts */
  /*
   * What stands inside a tile. A line is the points of the range that the data layer returned, by day or by month,
   * drawn by the chart kit with no axis: the figure above it carries the amount, the accessible label says the
   * first, the last and the highest point in words, and the pointer reads out any point. A point with no figure is
   * a gap. The bars and the ageing bar take their lengths from the shares the data layer returned.
   *
   * A line of what moved runs over the finished points only (`whole`): the business date is still being entered and
   * a month the range holds part of has fewer days than its neighbours, so either would end the line in a fall that
   * the business never took. Their figures are in the totals above the line. A balance has no such trouble: its
   * line (`every`) keeps every point, and ends on the balance at the end of the range.
   */

  var TALL = 60, SMALL = 48;   /* the height of the hero's line and of a tile's, in pixels */
  var BARS = 4;                /* a tile has room for this many bars (rows, not a business figure) */

  function lineOf(w, range, key, what, format, o) {
    if (!HB.charts || typeof HB.charts.sparkline !== 'function' || range.points.length < 2) return null;
    var every = o && o.every, box = h('span', { 'class': 'pg-home__chart' });
    HB.charts.sparkline(box, range.points.map(function (p) { return every || p.whole ? p[key] : null; }), {
      fluid: true, width: 300, height: o && o.tall ? TALL : SMALL, strokeWidth: 2, lineVar: LINE, colourVar: LINE, format: format,
      /* "Net sales by day, 1 Sep - 30 Sep 2026"; a balance is "at the end of each day" */
      label: what + (every ? ' at the end of each ' : ' by ') + w.per + ', ' + w.span, labels: range.points.map(function (p) { return p.label; })
    });
    return box;
  }

  /** A share as the length of a bar. */
  function lengthOf(share) { return (Math.max(0, Math.min(1, share || 0)) * 100).toFixed(1) + '%'; }

  /** Small bars with their names and amounts: each as long as its share of the whole. rows: [{ name, amount, share }]. */
  function barsOf(rows) {
    return h('span', { 'class': 'pg-home__bars' }, rows.map(function (x) {
      return h('span', { 'class': 'pg-home__bar' },
        h('span', { 'class': 'pg-home__bar-name', title: x.name }, x.name),
        h('span', { 'class': 'pg-home__bar-track', 'aria-hidden': 'true', title: x.name + ': ' + fmt.inrFull(x.amount) },
          x.share > 0 ? h('span', { 'class': 'pg-home__bar-fill', style: { width: lengthOf(x.share) } }) : null),
        h('span', { 'class': 'pg-home__bar-value' }, inr(x.amount)));
    }));
  }

  /** What is open by age, as one bar in segments: the lightest is not due yet, the darkest is the oldest. */
  function ageOf(buckets, what) {
    var shown = buckets.filter(function (b) { return b.amount > 0; }), first = buckets[0], last = buckets[buckets.length - 1];
    if (!shown.length) return null;
    return h('span', { 'class': 'pg-home__age' },
      h('span', { 'class': 'pg-home__age-bar', role: 'img', 'aria-label': what + ' by age: ' + shown.map(function (b) { return b.label + ' ' + fmt.inr(b.amount); }).join(', ') },
        shown.map(function (b) {
          return h('span', { 'class': 'pg-home__age-part pg-home__age-part--' + b.key, style: { flexGrow: String(b.share) }, title: b.label + ': ' + fmt.inrFull(b.amount) });
        })),
      h('span', { 'class': 'pg-home__age-ends', 'aria-hidden': 'true' },
        h('span', null, h('i', { 'class': 'pg-home__age-part--' + first.key }), first.label),
        h('span', null, last.label, h('i', { 'class': 'pg-home__age-part--' + last.key }))));
  }

  /** A tile of the kit with a small chart standing at its foot. */
  function tile(o, chart) {
    var el = ui.statTile(o);
    el.classList.add('pg-home__tile');
    if (chart) el.appendChild(chart);
    return el;
  }

  /* ----------------------------------------------------------------- hero */
  /* The one large figure of the dashboard, with its small chart and a short list of facts, a hairline between them. */

  function heroOf(o) {
    var link = more(o.routes);
    return ui.card({
      className: 'pg-home__hero',
      body: h('div', { 'class': 'pg-home__hero-body' },
        h('div', { 'class': 'pg-home__hero-main' },
          ui.hero({ label: h('span', { 'class': 'pg-home__hero-head' }, h('span', null, o.label), link ? h('span', { 'class': 'pg-home__hero-go' }, link) : null), value: o.value, sub: o.sub }), o.chart),
        h('div', { 'class': 'pg-home__facts' }, o.facts.filter(Boolean).map(function (x) {
          return h('div', { 'class': 'pg-home__fact', title: x.title || null },
            h('span', { 'class': 'pg-home__fact-label' }, x.label, x.what ? [' ', h('span', { 'class': 'pg-home__fact-what' }, x.what)] : null),
            h('span', { 'class': 'pg-home__fact-value' }, x.value));
        })))
    });
  }

  /**
   * Under the hero figure: how many days the range has (and which, while the label says "month to date"), then what
   * the figure is. A long range is drawn by month, and says so.
   */
  function underHero(w, range, text) {
    return (w.mtd ? w.span + ', ' : '') + count(range.days, 'day', 'days') + '. ' + text + (range.grain === 'month' ? ' The lines are by whole month.' : '');
  }

  var HERO = {
    /* net sales of the range; today beside it; the average, the best and the slowest of its open days; who leads */
    sales: function (w, today, range) {
      var s = range.sales, f = range.salesFacts;
      return heroOf({
        label: 'Net sales, ' + w.range, value: fmt.inr(s.net), sub: underHero(w, range, 'Before GST, after stale returns.'),
        routes: ['#/sell/invoices', '#/stores/dayend'], chart: lineOf(w, range, 'netSales', 'Net sales', 'inr', { tall: true }),
        facts: [
          w.alone ? null : { label: 'Today', what: w.mtd ? null : day(today.to), value: fmt.inr(today.sales.net) },
          f.openDays && range.days > 1 ? { label: 'Average per open day', what: f.openDays < range.days ? fmt.num(f.openDays) + ' of ' + count(range.days, 'day', 'days') : null, value: fmt.inr(f.average),
            title: 'An open day is a day on which something was sold' } : null,
          f.openDays > 1 ? { label: 'Best day', what: weekday(f.best.date), value: fmt.inr(f.best.net) } : null,
          f.openDays > 1 ? { label: 'Slowest day', what: weekday(f.slowest.date), value: fmt.inr(f.slowest.net) } : null,
          f.channel && s.byChannel.length > 1 ? { label: 'Leading channel', what: f.channel.label + ', ' + fmt.pct(f.channel.share), value: fmt.inr(f.channel.net) } : null,
          f.route ? { label: 'Leading route', what: f.route.label + ', ' + fmt.pct(f.route.share), value: fmt.inr(f.route.net) } : null
        ]
      });
    },

    /* for a persona whose figures are the production: good units of the range, and what the recipes expected */
    production: function (w, today, range) {
      var p = range.production;
      return heroOf({
        label: 'Good units made, ' + w.range, value: fmt.num(p.goodUnits), sub: underHero(w, range, count(p.runs, 'production run', 'production runs') + '.'),
        routes: ['#/make/production'], chart: lineOf(w, range, 'goodUnits', 'Good units made', 'num', { tall: true }),
        facts: [
          w.alone ? null : { label: 'Today', what: w.mtd ? null : day(today.to), value: fmt.num(today.production.goodUnits) },
          { label: 'Expected by the recipes', value: fmt.num(p.expectedUnits) },
          { label: 'Yield', value: fmt.pct(p['yield']) },
          { label: 'Rejected units', value: fmt.num(p.rejectedUnits) },
          { label: 'Production loss', value: fmt.inr(p.lossValue), title: 'The shortfall against what the recipes expected, at recipe cost' }
        ]
      });
    }
  };

  /* ---------------------------------------------------------------- tiles */
  /*
   * The tiles of the range, beside the hero. w: the words of this render, today and range: what the data layer
   * returned for the business date and for the range. Each is drawn only when the data layer returned its figures.
   */

  var PERIOD = ['collections', 'margin', 'production', 'returns', 'spend', 'cash'];

  var TILE = {
    collections: function (w, today, range) {
      return tile({ label: 'Collections', icon: 'coins', value: fmt.inr(range.collections.total), sub: 'Collected today ' + inr(today.collections.total), onClick: opener(['#/sell/receipts']) },
        lineOf(w, range, 'collected', 'Collections', 'inr'));
    },
    margin: function (w, today, range) {
      var m = range.margin;
      return tile({ label: 'Gross margin', icon: 'percent', value: fmt.pct(m.grossMarginPct),
        sub: m.materialPct === null ? 'No sales in the range' : 'Material cost ' + fmt.pct(m.materialPct) + ' of sales',
        title: 'Net sales less material cost: cost of goods sold, production loss, write-offs and count differences', onClick: opener(['#/accounts/pnl']) },
        lineOf(w, range, 'marginPct', 'Gross margin', 'pct'));
    },
    production: function (w, today, range) {
      var p = range.production;
      return tile({ label: 'Good units made', icon: 'factory', value: fmt.num(p.goodUnits),
        sub: p['yield'] === null ? 'No production run in the range' : 'Yield ' + fmt.pct(p['yield']) + ', ' + fmt.num(p.rejectedUnits) + ' rejected', onClick: opener(['#/make/production']) },
        lineOf(w, range, 'goodUnits', 'Good units made', 'num'));
    },
    returns: function (w, today, range) {
      var x = range.returns, limit = fmt.pct(x.limitPct / 100, 0);
      return tile({ label: 'Stale returns', icon: 'undo', value: fmt.pct(x.share), tone: x.over ? 'warn' : null,
        sub: x.share === null ? (x.returned ? inr(x.returned) + ' returned, nothing supplied in the range' : 'Nothing supplied in the range')
          : (x.over ? 'Above the limit of ' + limit + ': ' : '') + inr(x.returned) + ' returned of ' + inr(x.supplied) + ' supplied',
        title: 'Stale returns as a share of what outlets and corporates were supplied, before GST. A return above ' + limit + ' of an outlet\'s supply waits for the Owner.',
        onClick: opener(['#/sell/returns']) },
        lineOf(w, range, 'returnShare', 'Stale returns as a share of supply', 'pct'));
    },
    /* the bars are the locations; a persona with one location (a store manager) gets its largest categories instead */
    spend: function (w, today, range) {
      var x = range.spendFacts, top = x.largest, byLocation = x.byLocation.length > 1;
      var rows = byLocation ? x.byLocation.map(function (u) { return { name: u.unitName, amount: u.amount, share: u.share }; })
        : x.byCategory.slice(0, BARS).map(function (k) { return { name: k.categoryName, amount: k.amount, share: k.share }; });
      return tile({ label: 'Spend', icon: 'calculator', value: fmt.inr(range.spend.total),
        sub: !top ? 'No approved expense in the range' : (byLocation ? 'Largest: ' + top.categoryName + ' ' + inr(top.amount) : count(x.byCategory.length, 'category', 'categories') + ', the largest first'),
        title: 'Approved expenses before GST, on their own date', onClick: opener(['#/expenses']) },
        rows.length ? barsOf(rows) : null);
    },
    cash: function (w, today, range) {
      var c = today.cash, one = c.rows.length === 1;
      return tile({ label: one ? c.rows[0].name : 'Cash and bank', icon: 'wallet', value: fmt.inr(c.total),
        sub: one ? (w.mtd ? 'Balance now' : 'Balance ' + w.asAt) : w.stands('Cash ' + inr(c.cashTotal) + ', bank ' + inr(c.bankTotal)), onClick: opener(['#/accounts/cash']) },
        lineOf(w, range, 'cashBalance', one ? 'Balance' : 'Cash and bank', 'inr', { every: true }));
    }
  };

  /* What stands at the business date, whatever the range: a tile carries an edge when it needs a look. */

  var POSITION = ['receivables', 'payables', 'approvals', 'lowStock', 'nearExpiry'];

  var STANDS = {
    receivables: function (t) {
      /* the open invoices, as the receivables screen and the card below head them; unapplied credit is not taken off */
      return tile({ label: 'Receivables', icon: 'users', value: fmt.inr(t.open), sub: t.overdue > 0 ? 'Overdue ' + inr(t.overdue) : 'Nothing is overdue', tone: t.overdue > 0 ? 'warn' : null,
        onClick: opener(['#/accounts/receivables', '#/sell/receipts']) }, ageOf(t.buckets, 'Receivables'));
    },
    payables: function (t) {
      return tile({ label: 'Payables', icon: 'building', value: fmt.inr(t.open), tone: t.overdue > 0 ? 'warn' : null,
        sub: (t.overdue > 0 ? 'Overdue ' + inr(t.overdue) : 'Nothing is overdue') + ', due this week ' + inr(t.dueSoon),
        title: 'Due this week: bills that fall due within ' + count(HB.masters.limits.dueSoonDays, 'day', 'days'), onClick: opener(['#/accounts/payables']) }, ageOf(t.buckets, 'Payables'));
    },
    approvals: function (t) {
      return tile({ label: 'Waiting for approval', icon: 'check-circle', value: fmt.num(t.count), tone: t.count ? 'warn' : null,
        sub: t.count ? t.byType.map(function (x) { return fmt.num(x.count) + ' ' + forms.typeName(x.type, x.count !== 1).toLowerCase(); }).join(', ') : 'Nothing waits',
        onClick: opener(['#/approvals']) });
    },
    lowStock: function (t) {
      return tile({ label: 'Low stock', icon: 'box', value: fmt.num(t.count), tone: t.count ? 'warn' : null,
        sub: t.count === 1 ? 'material at or below its reorder level' : 'materials at or below their reorder level', onClick: opener(['#/stock/onhand']) });
    },
    nearExpiry: function (t) {
      return tile({ label: 'Near-expiry stock', icon: 'clock', value: fmt.num(t.nearUnits), tone: t.expiredUnits > 0 ? 'critical' : (t.nearUnits > 0 ? 'warn' : null),
        sub: 'units near best-before, ' + fmt.num(t.expiredUnits) + ' expired', onClick: opener(['#/stock/batches']) });
    }
  };

  /* -------------------------------------------------------------- cockpit */
  /*
   * The hero is the sales of the range, or the production for a persona whose figures those are. With four tiles or
   * more beside it (the Owner, accounts) the hero stands on the left, the tiles three to a row on the right and what
   * stands at the business date in a row under both. With fewer, what stands joins the tiles beside the hero. A
   * persona with no figure of a range (stores) gets the row of what stands alone.
   */

  /** Tiles in rows of equal columns: as many columns as there are tiles, up to perRow. */
  function rowOf(className, tiles, perRow) {
    return h('div', { 'class': ['pg-home__tiles', 'pg-home__tiles--' + Math.min(tiles.length, perRow), className] }, tiles);
  }

  function cockpit(w, today, range) {
    var lead = range.sales ? 'sales' : (range.production ? 'production' : null);
    var hero = lead ? HERO[lead](w, today, range) : null;
    var tiles = PERIOD.filter(function (id) { return id !== lead && range[id] && TILE[id]; }).map(function (id) { return TILE[id](w, today, range); });
    var stands = POSITION.filter(function (id) { return today[id]; }).map(function (id) { return STANDS[id](today[id]); });
    var note = stands.length ? h('div', { 'class': 'pg-home__note' }, ui.icon('clock', 14),
      w.mtd ? 'As things stand at the business date, ' + day(today.to) : 'As at the business date, ' + day(today.to) + ', whatever the range') : null;
    var beside = hero && tiles.length > 0 && tiles.length < 4;
    var kind = !hero ? 'bare' : (tiles.length >= 4 ? 'lead' : (tiles.length ? 'split' : 'wide'));
    var under = [note, stands.length ? rowOf('pg-home__tiles--stands', stands, beside ? 3 : 5) : null];
    return h('div', { 'class': ['pg-home__cockpit', 'pg-home__cockpit--' + kind] },
      /* a heading for whoever cannot see the layout: what follows, and for which range */
      h('h2', { 'class': 'mk-sr' }, hero ? 'The figures of ' + (w.mtd ? 'the month to date, ' + w.span : w.span) : 'What stands at the business date'),
      hero,
      tiles.length ? h('div', { 'class': 'pg-home__main' }, rowOf(null, tiles, 3), beside ? under : null) : null,
      beside ? null : under);
  }

  /* ---------------------------------------------------------------- cards */
  /* One card per block: the table behind the figure. w, t and r as for the tiles: t the block for today, r for the range. */

  function listCard(o) {
    return ui.card({ title: o.title, subtitle: o.subtitle, actions: more(o.routes || []), flush: true, footer: o.footer,
      body: ui.table({ dense: true, maxHeight: LIST_HEIGHT, columns: o.columns, rows: o.rows, footer: o.totals, empty: o.empty }) });
  }

  var CARD = {
    sales: function (w, t, r) {
      var rows = r.byChannel.map(function (c) {
        var d = find(t.byChannel, 'channel', c.channel);
        return { label: c.label, today: d.net, unitsToday: d.units, range: c.net, returns: c.returns, units: c.units };
      });
      return listCard({
        title: 'Sales by channel', subtitle: 'Before GST, after stale returns' + (w.mtd ? '' : ', for today and for ' + w.span),
        routes: ['#/sell/invoices', '#/stores/dayend'], rows: rows,
        columns: [
          { key: 'label', label: 'Channel' },
          { key: 'today', label: 'Today', format: 'inrFull' },
          { key: 'unitsToday', label: 'Units today', format: 'num' },
          { key: 'range', label: w.column, format: 'inrFull' },
          { key: 'returns', label: 'Returns', format: 'inrFull',
            title: w.mtd ? 'Stale returns of the month, already taken off the month to date' : 'Stale returns of the range, already taken off its net sales' },
          { key: 'units', label: w.mtd ? 'Units this month' : 'Units in the range', format: 'num' }
        ],
        totals: rows.length > 1 ? { label: 'Total', today: t.net, unitsToday: t.units, range: r.net, returns: r.returns, units: r.units } : null
      });
    },

    collections: function (w, t, r) {
      return listCard({
        title: 'Collections', subtitle: 'Cash taken on delivery and receipts from customers' + (w.mtd ? '' : ', for today and for ' + w.span), routes: ['#/sell/receipts'],
        rows: [{ label: 'In cash', today: t.cash, range: r.cash }, { label: 'Into the bank', today: t.bank, range: r.bank }],
        columns: [{ key: 'label', label: 'Received' }, { key: 'today', label: 'Today', format: 'inrFull' }, { key: 'range', label: w.column, format: 'inrFull' }],
        totals: { label: 'Total', today: t.total, range: r.total }
      });
    },

    /* one account is the tile above and nothing more: the card is for a persona with several */
    cash: function (w, t) {
      if (t.rows.length < 2) return null;
      return listCard({
        title: 'Cash and bank', subtitle: w.mtd ? 'Balances as they stand now' : 'Balances ' + w.asAt, routes: ['#/accounts/cash'], rows: t.rows,
        columns: [{ key: 'name', label: 'Account' }, { key: 'balance', label: 'Balance', format: 'inr2' }],
        totals: { name: 'Total', balance: t.total }
      });
    },

    spend: function (w, t, r) {
      var rows = pairs(t.byUnit, r.byUnit, 'unitId').map(function (x) { return { unitName: x.r.unitName || x.t.unitName, today: x.t.amount || 0, range: x.r.amount || 0 }; });
      return listCard({
        title: w.mtd ? 'Spend this month by location' : 'Spend by location, ' + w.span, subtitle: 'Approved expenses before GST, on their own date', routes: ['#/expenses'], rows: rows,
        columns: [{ key: 'unitName', label: 'Location' }, { key: 'today', label: 'Today', format: 'inrFull' }, { key: 'range', label: w.column, format: 'inrFull' }],
        totals: rows.length > 1 ? { unitName: 'Total', today: t.total, range: r.total } : null,
        empty: w.mtd ? 'No approved expense is dated this month yet' : 'No approved expense is dated in this range'
      });
    },

    production: function (w, t, r) {
      var rows = pairs(t.byItem, r.byItem, 'itemId').map(function (x) {
        return { itemName: x.r.itemName || x.t.itemName, today: x.t.goodUnits || 0, good: x.r.goodUnits || 0, rejected: x.r.rejectedUnits || 0, 'yield': x.r['yield'], loss: x.r.lossValue || 0 };
      });
      return listCard({
        title: 'Production', subtitle: 'Good units made, against what the recipe expects' + (w.mtd ? '' : ', for today and for ' + w.span) + '. The shortfall at recipe cost is the production loss.',
        routes: ['#/make/production'], rows: rows,
        columns: [
          { key: 'itemName', label: 'Product', maxWidth: 170 },
          { key: 'today', label: 'Today', format: 'num', title: 'Good units made today' },
          { key: 'good', label: w.mtd ? 'This month' : w.column, format: 'num', title: w.mtd ? 'Good units made in the month to date' : 'Good units made in the range' },
          { key: 'rejected', label: 'Rejected', format: 'num' },
          { key: 'yield', label: 'Yield', format: 'pct' },
          { key: 'loss', label: 'Loss', format: 'inrFull' }
        ],
        totals: rows.length ? { itemName: 'Total', today: t.goodUnits, good: r.goodUnits, rejected: r.rejectedUnits, 'yield': r['yield'], loss: r.lossValue } : null,
        empty: w.mtd ? 'No production run is dated this month yet' : 'No production run is dated in this range'
      });
    },

    receivables: function (w, t) {
      return listCard({
        title: 'Overdue receivables', subtitle: w.stands('Outstanding ' + fmt.inr(t.open) + ', of which ' + fmt.inr(t.overdue) + ' is past its due date'),
        routes: ['#/accounts/receivables', '#/sell/receipts'], rows: t.overdueRows,
        columns: [
          { key: 'customerName', label: 'Customer', maxWidth: 220 },
          { key: 'overdue', label: 'Overdue', format: 'inrFull' },
          { key: 'oldestDue', label: 'Oldest due', format: 'date' },
          { key: 'invoices', label: 'Invoices', format: 'num', title: 'Invoices past their due date' }
        ],
        totals: t.overdueRows.length ? { customerName: 'Total', overdue: t.overdue } : null,
        empty: 'No invoice is past its due date'
      });
    },

    payables: function (w, t) {
      return listCard({
        title: 'Bills due this week',
        subtitle: w.stands('Owed ' + fmt.inr(t.open) + ': ' + fmt.inr(t.overdue) + ' overdue, ' + fmt.inr(t.dueSoon) + ' falling due within ' + count(HB.masters.limits.dueSoonDays, 'day', 'days')),
        routes: ['#/accounts/payables'], rows: t.dueRows,
        columns: [
          { key: 'name', label: 'Payee and bill', render: function (v, row) { return twoLine(v, forms.docLink(row.id), 220); } },
          { key: 'dueDate', label: 'Due on', render: function (v, row) {
            return twoLine(day(v), row.overdue ? count(row.daysOverdue, 'day', 'days') + ' overdue' : (row.daysToDue ? 'Due in ' + count(row.daysToDue, 'day', 'days') : 'Due today'));
          } },
          { key: 'open', label: 'To pay', format: 'inrFull' }
        ],
        empty: 'No bill falls due this week',
        footer: h('span', { 'class': 'mk-small mk-muted' }, t.claims ? count(t.claims, 'approved claim', 'approved claims') + ' to reimburse: ' + fmt.inr2(t.toReimburse) : 'No approved claim waits to be reimbursed')
      });
    },

    /* approvals have no card: the tile says how many wait and of what kind, and Today's work lists each of them */

    lowStock: function (w, t) {
      return listCard({
        title: 'Low stock', subtitle: w.stands('Materials at or below their reorder level'), routes: ['#/stock/onhand'], rows: t.rows,
        columns: [
          { key: 'itemName', label: 'Material', maxWidth: 220 },
          { key: 'available', label: 'Available', format: 'qty' },
          { key: 'reorderLevel', label: 'Reorder level', format: 'qty' },
          { key: 'onOrder', label: 'On order', format: 'qty' }
        ],
        empty: 'Every material is above its reorder level'
      });
    },

    nearExpiry: function (w, t) {
      return listCard({
        title: 'Near-expiry stock', subtitle: w.stands('Batches on hand that are past or close to their best-before date'), routes: ['#/stock/batches'], rows: t.rows,
        columns: [
          { key: 'itemName', label: 'Product and batch', render: function (v, row) { return twoLine(v, forms.docLink(row.batchId), 170); } },
          { key: 'locName', label: 'Location', maxWidth: 150 },
          { key: 'bestBefore', label: 'Best before', render: function (v, row) { return twoLine(day(v), row.flagLabel); } },
          { key: 'qty', label: 'On hand', format: 'qty' }
        ],
        empty: 'No batch is near its best-before date'
      });
    }
  };

  /* --------------------------------------------------------- today's work */
  /*
   * Each kind of work, the screen that does it and how that screen is opened ready for the item: the form of the
   * page on a prefilled draft (forms.startDraft, the draft named after the payload of docs/API.md 3.5) where the
   * work is a new document; the document itself where it is an action on one. A dispatch sheet is opened by its
   * sheet id, which is the id of the work item: '#/doc/DS-...' brings up that route and date.
   */

  var WORK = {
    sheet: { noun: 'Route', act: 'Post the sheet', icon: 'truck', go: function (it) { HB.router.openDoc(it.id); } },
    transfer_send: { noun: 'Store', act: 'Send stock', icon: 'send', page: 'stores-transfers',
      draft: function (it) { return { values: { toStoreId: it.ref.storeId, date: it.ref.date } }; } },
    transfer_confirm: { noun: 'Store', act: 'Confirm receipt', icon: 'check', doc: true },
    receipt: { noun: 'Vendor', act: 'Receive goods', icon: 'box', page: 'buy-receipts',
      draft: function (it) { return { values: { poId: it.ref.poId } }; } },
    production: { noun: 'Product', act: 'Record the run', icon: 'factory', page: 'make-production',
      draft: function (it) { return { values: { itemId: it.ref.itemId, date: it.ref.date } }; } },
    dayend: { noun: 'Store', act: 'Enter the day-end', icon: 'store', page: 'stores-dayend',
      draft: function (it) { return { values: { storeId: it.ref.storeId, date: it.ref.date } }; } },
    approval: { noun: 'Document', act: 'Approve or reject', look: 'See the evidence', icon: 'check-circle',
      go: function (it, g) { HB.router.navigate(g.route, { doc: it.id }); } }
  };

  function startWork(g, W, it) {
    if (typeof W.go === 'function') return W.go(it, g);
    if (W.doc && it.docId) return HB.router.openDoc(it.docId);
    if (W.page && typeof W.draft === 'function') return forms.startDraft(W.page, W.draft(it));
    return HB.router.navigate(g.route);
  }

  /** A line of text with the document id in it turned into a link to the document. */
  function linked(text, docId) {
    var s = String(text || ''), at = docId ? s.indexOf(docId) : -1;
    return at === -1 ? s : [s.slice(0, at), forms.docLink(docId), s.slice(at + docId.length)];
  }

  function workButton(g, W, it, page) {
    /* reading what waits is open to whoever has the approvals screen; deciding is the Owner's, and the screen says so */
    var look = !it.can.ok && W.look && page;
    var reason = look ? '' : (!it.can.ok ? it.can.reason : (page ? '' : 'This role does not have the screen for it'));
    var btn = ui.button({ label: look ? W.look : W.act, icon: reason ? 'lock' : (look ? 'eye' : W.icon), size: 'sm',
      variant: it.can.ok && !reason ? 'primary' : 'secondary', disabledReason: reason, title: look ? it.can.reason : null,
      onClick: function () { startWork(g, W, it); } });
    btn.setAttribute('data-work', it.id);
    return btn;
  }

  function workCard(g) {
    var W = WORK[g.kind] || { noun: 'To do', act: 'Open', icon: 'arrow-right' }, page = pageAt(g.route);
    var locked = g.items.filter(function (it) { return !it.can.ok; });
    var same = locked.length === g.items.length && locked.every(function (it) { return it.can.reason === locked[0].can.reason; });
    return ui.card({
      title: [g.label, ' ', ui.chip(fmt.num(g.count), 'info')], subtitle: same ? locked[0].can.reason : null,
      actions: page ? ui.link(page.title, page.route, { icon: 'arrow-right' }) : null, flush: true, className: 'pg-home__work',
      body: ui.table({ dense: true, maxHeight: LIST_HEIGHT, rows: g.items, columns: [
        { key: 'title', label: W.noun, render: function (v, it) {
          return twoLine(linked(it.title, it.docId), it.text ? linked(it.text, it.docId) : null);
        } },
        { key: 'act', label: '', align: 'right', sortable: false, render: function (v, it) { return workButton(g, W, it, page); } }
      ] })
    });
  }

  function workSection(work) {
    var title = ui.sectionTitle('Today\'s work', day(work.date) + ': ' + (work.count ? count(work.count, 'thing', 'things') + ' to do' : 'nothing is waiting'));
    if (!work.groups.length) {
      return [title, ui.card({ body: ui.emptyState('Nothing is waiting for you today', 'History runs to the day before the business date. What you post today shows here and in the figures above.', { icon: 'check-circle', compact: true }) })];
    }
    return [title, ui.grid(2, work.groups.map(workCard), { start: true, className: 'pg-home__grid' })];
  }

  /* --------------------------------------------------------------- charts */
  /*
   * Drawn for a persona who receives the sales block, from the two period series the data layer has: by day and by
   * month. The first follows the range as the small charts above do (range.grain): a bar a day, or a bar a month
   * for a long range, a month holding only its days inside the range. The second is every month since go-live,
   * whatever the range.
   */

  function barChart(id, title, subtitle, header, res) {
    return HB.charts.mount(null, {
      id: id, kind: 'bar', title: title, subtitle: subtitle, format: 'inr', height: 240,
      data: { categories: res.rows.map(function (r) { return r.label; }), values: res.rows.map(function (r) { return r.net; }), name: 'Net sales', categoryHeader: header },
      emptyText: 'No sales in this range'
    }).el;
  }

  function charts(w, today, range) {
    if (!HB.charts || typeof HB.charts.mount !== 'function') return null;
    var daily = range.grain === 'day';
    var inRange = HB.data.sell.by(range.grain, { from: range.from, to: range.to });
    var byMonth = HB.data.sell.by('month', { from: HB.calendar.goLive, to: today.to });
    return ui.grid(2, [
      barChart('home-by-range', w.mtd ? 'Net sales this month by day' : 'Net sales of the range by ' + range.grain, HB.filters.rangeLabel(inRange), daily ? 'Day' : 'Month', inRange),
      barChart('home-by-month', 'Net sales by month since go-live', HB.filters.rangeLabel(byMonth), 'Month', byMonth)
    ], { start: true, className: 'pg-home__grid' });
  }

  /* ----------------------------------------------------------------- page */

  HB.router.register({
    id: 'home', route: '#/home', group: 'Home', title: 'Dashboard', navLabel: 'Dashboard', filters: ['date'],
    render: function (rootEl, ctx) {
      /* today is the business date and the range is the filter bar's; the two never take each other's place */
      var today = HB.data.dash.today(), range = HB.data.dash.period(ctx.filters), work = HB.data.dash.work();
      var blocks = today.blocks, w = words(today, range);

      ui.append(rootEl,
        cockpit(w, today, range),
        workSection(work),
        ui.sectionTitle('Behind the figures', w.mtd ? 'What moved today and in the month to date, and what stands now'
          : 'What moved today and in the range, ' + w.span + ', and what stands ' + w.asAt),
        ui.grid(2, blocks.map(function (id) { return CARD[id] ? CARD[id](w, today[id], range[id]) : null; }), { start: true, className: w.mtd ? 'pg-home__grid' : 'pg-home__grid pg-home__grid--range' }),
        blocks.indexOf('sales') !== -1 ? charts(w, today, range) : null,
        forms.teaser({ title: 'Sales forecast with suggested production; 30/60/90-day cash projection', tier: 'NeoX' }));
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
