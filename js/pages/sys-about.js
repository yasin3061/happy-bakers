/*
 * About this sample (#/system/about). SCOPE 4.11 and section 7: the company is fictional; the business date and what
 * it means; the history since go-live; what this browser stores (the user's log, counted and measured from
 * HB.engine.log() and HB.store) and that nobody else sees it; the entries the last load had to skip
 * (HB.engine.skipped); a fresh copy dated today (HB.app.freshCopy, which asks before it discards); and what is
 * simulated. Every role has this page. It reads and draws; the one thing it does is start the fresh copy.
 */
(function (root) {
  'use strict';

  var HB = root.HB;
  if (!HB || !HB.router || !HB.ui || !HB.forms) return;
  var ui = HB.ui, h = ui.h, forms = HB.forms, fmt = HB.fmt;

  var KB = 1024;
  function day(iso) { return ui.format('date', iso); }
  function count(n, one, many) { return fmt.num(n) + ' ' + (n === 1 ? one : many); }
  function para(children) { return h('div', { 'class': 'pg-sys-about__p' }, children); }
  function sizeOf(value) { try { return value === undefined || value === null ? 0 : JSON.stringify(value).length; } catch (e) { return 0; } }
  function sizeText(chars) { return chars < KB ? count(chars, 'character', 'characters') : fmt.num(chars / KB, 1) + ' KB'; }
  function pageById(id) { return HB.router.pages().filter(function (p) { return p.id === id; })[0] || null; }
  /** A link to a screen this role has; plain words otherwise. */
  function screen(id, text) {
    var page = pageById(id);
    return page && HB.router.isAllowed(page) ? ui.link(text || page.title, page.route, { icon: 'arrow-right' }) : null;
  }

  /* ------------------------------------------------------------ sections */

  function company() {
    var co = (HB.masters && HB.masters.company) || {}, name = co.name || 'The company';
    return ui.card({
      title: name + ' is fictional', actions: ui.chip('Sample', 'info', { icon: 'info' }),
      body: ui.stack([
        para(name + ' does not exist. It is a made-up bakery' + (co.address ? ' at ' + co.address : '') +
          ', built to show Neo ERP at work on a business a prospect can picture' + (co.business ? ': ' + co.business.charAt(0).toLowerCase() + co.business.slice(1) + '.' : '.')),
        para('Every customer, vendor and employee name is invented. Any likeness to a real business or person is a coincidence.'),
        para(['Every figure on every screen comes from documents, and you can add documents: what you enter moves the stock, the balances and the reports at once. ',
          screen('guide', 'Try this')])
      ], 3)
    });
  }

  function businessDate() {
    /* the device's own date, as it is: on a day the factory is closed, or outside the sample's range, a copy is dated another day and the shell's banner says why */
    var cal = HB.calendar, real = cal.realToday(), moved = cal.movedOn();
    return ui.card({
      title: 'Business date', subtitle: 'The day this copy calls today',
      body: ui.stack([
        ui.keyValue([
          ['Business date', h('span', { 'class': 'mk-strong' }, day(cal.today))],
          ['History runs', day(cal.goLive) + ' to ' + day(cal.dataEnd)],
          ['Open for entries', 'From ' + day(cal.lockBefore) + '. Earlier months are locked.'],
          ['Date on this device', day(real)]
        ]),
        para('This copy took the date it was first opened as its business date, and keeps it. Date defaults, ageing, expiry flags, back-dating limits and today\'s work are all counted from that day, so nothing ages or expires while the copy sits unused.'),
        moved ? ui.callout('info', 'The calendar has moved on',
          'This copy is dated ' + day(cal.today) + ' and today is ' + day(real) + '. It stays exactly as you left it until you start a fresh copy dated today.') : null
      ], 3)
    });
  }

  function history() {
    var cal = HB.calendar;
    return ui.card({
      title: 'History since ' + day(cal.goLive),
      body: ui.stack([
        para('The company went live on Neo ERP on ' + day(cal.goLive) + ' with opening balances only: opening stock, what customers owed, what was owed to vendors, cash and bank. Nothing was migrated from an older system.'),
        para('Every document from that day to ' + day(cal.dataEnd) + ', the day before the business date, was written by a day-by-day simulation of the business. It is built again each time the sample opens, the same every time, and is never stored or altered.'),
        para('The business date itself is yours to run: its dispatch sheets, transfers, receipts and production are waiting.')
      ], 3)
    });
  }

  function storage() {
    var log = HB.engine.log(), meta = HB.store.get('meta', null), prefs = HB.store.get('prefs', null);
    var rows = [
      { what: 'Your log', holds: log.length ? count(log.length, 'entry', 'entries') + ': each document as you entered it, each approval, rejection, cancellation and change to a record, with who, in which role and when' : 'Nothing yet. Each document you enter and each action you take is added here.', size: sizeOf(HB.store.get('log', null)) },
      { what: 'This copy', holds: 'The business date' + (meta && meta.seedVersion ? ' and the version of the sample data (' + meta.seedVersion + ')' : ''), size: sizeOf(meta) },
      { what: 'Your preferences', holds: 'Who you are working as, and the filters you set', size: sizeOf(prefs) }
    ];
    var total = rows.reduce(function (s, r) { return s + r.size; }, 0);
    return ui.card({
      title: 'What this browser stores', subtitle: 'In its local storage, on this device only',
      body: ui.stack([
        ui.kpiRow([
          { label: 'Entries in your log', value: fmt.num(log.length), sub: log.length ? 'Last one at ' + ui.dateTime(log[log.length - 1].at) : 'Nothing entered yet' },
          { label: 'Size of the log', value: sizeText(rows[0].size), sub: 'All that is stored: ' + sizeText(total) }
        ]),
        ui.keyValue(rows.map(function (r) { return [r.what, h('div', null, r.holds, h('div', { 'class': 'mk-small mk-muted' }, sizeText(r.size)))]; })),
        HB.store.ok ? null : ui.callout('warn', 'This browser is not saving changes', 'Its storage is unavailable or full, so what you enter will not survive a reload.'),
        HB.engine.notice ? ui.callout('info', null, HB.engine.notice) : null,
        para('Nobody else sees what you enter. It stays in this browser: nothing is sent to a server, and another browser or device opens its own copy. The history is not stored at all. On every load it is built again and your log is applied on top of it, in the order you made it, so a reload gives exactly the figures you left.')
      ], 3)
    });
  }

  /** One skipped log entry in words: "Enter purchase order PO-U-0003", "Approve EXP-U-0001". */
  function entryText(e) {
    var a = e.args || {}, ids = e.out && Array.isArray(e.out.ids) ? e.out.ids : [], id = a.id || '';
    switch (e.op) {
      case 'post': return 'Enter ' + forms.typeName(a.type).toLowerCase() + (ids[0] ? ' ' + ids[0] : '');
      case 'postDispatch': return 'Post a dispatch sheet' + (a.routeId ? ' for ' + HB.data.lookup.name('route', a.routeId) : '');
      case 'cancelDispatch': return 'Cancel the dispatch sheet' + (a.sheetId ? ' ' + a.sheetId : '');
      case 'approve': return 'Approve ' + id;
      case 'reject': return 'Reject ' + id;
      case 'cancel': return 'Cancel ' + id;
      case 'receiveTransfer': return 'Confirm receipt of ' + id;
      case 'master': return 'Change a record';
      case 'setActive': return 'Activate or deactivate a record';
      default: return e.op ? String(e.op) : 'An entry that cannot be read';
    }
  }

  function skipped() {
    var list = Array.isArray(HB.engine.skipped) ? HB.engine.skipped : [];
    var body = !list.length
      ? ui.callout('good', 'None', 'Every entry in your log was applied again when this copy last loaded.')
      : ui.stack([
        ui.callout('warn', count(list.length, 'entry', 'entries') + ' could not be applied again',
          'They no longer apply to this copy and were left out when it was rebuilt. Everything else is as you left it, and the numbers of the other documents are unchanged.'),
        ui.table({ dense: true, rows: list, columns: [
          { key: 'n', label: 'Entry', align: 'right', render: function (v) { return fmt.num(v); } },
          { key: 'at', label: 'Made', render: function (v) { return v ? ui.dateTime(v) : '-'; } },
          { key: 'userId', label: 'By', render: function (v, e) { return v ? HB.data.lookup.user(v).name + (e.role ? ', ' + HB.session.roleLabel(e.role) : '') : '-'; } },
          { key: 'op', label: 'What it was', render: function (v, e) { return entryText(e); } },
          { key: 'reason', label: 'Why it was skipped', wrap: true }
        ] })
      ], 3);
    return ui.card({ title: 'Entries skipped on the last load', subtitle: 'An entry in your log that no longer applies is skipped, never guessed at', body: body });
  }

  function simulated() {
    return ui.card({
      title: 'What is simulated', actions: ui.statusChip('SIMULATED'),
      body: ui.keyValue([
        ['Emails', h('div', null, 'Neo ERP emails approval requests, overdue receivables, bills falling due, low stock and stock near expiry. This sample only lists what it would send. Nothing is sent. ', screen('sys-notifications', 'Notification log'))],
        ['Integrations', h('div', null, 'There are none. Nothing connects to a bank, Tally, Zoho Books, the GST portal or any other outside system, and no GST return is filed. Those connections come with a higher tier. ', screen('sys-tiers', 'What the higher tiers add'))],
        ['Users', 'The six people in the top bar stand in for user accounts. Switching from one to another changes what the screens show and allow, as a sign-in would.'],
        ['History', 'The documents before the business date are simulated, as described here. What you enter is posted in exactly the same way, and moves the same figures.']
      ])
    });
  }

  function fresh() {
    var cal = HB.calendar, real = cal.clamp(cal.realToday()), n = HB.engine.log().length;
    var btn = ui.button({ label: 'Start a fresh copy dated today', icon: 'refresh', variant: 'danger',
      onClick: function () { if (HB.app && typeof HB.app.freshCopy === 'function') HB.app.freshCopy(); } });   /* asks first, then reloads */
    btn.setAttribute('data-act', 'fresh-copy');
    return ui.card({
      title: 'Start a fresh copy dated today', subtitle: 'The reset of this sample',
      body: ui.stack([
        para('A fresh copy takes ' + day(real) + ' as its business date and builds the history again up to the day before. ' +
          (n ? 'It discards the ' + count(n, 'entry', 'entries') + ' in your log, and that cannot be undone.' : 'Your log is empty, so nothing of yours would be lost.') +
          ' Who you are working as and your filters are kept.'),
        h('div', { 'class': 'mk-row' }, btn, h('span', { 'class': 'mk-small mk-muted' }, 'You are asked to confirm before anything is discarded.'))
      ], 3)
    });
  }

  HB.router.register({
    id: 'sys-about', route: '#/system/about', group: 'System', title: 'About this sample', filters: [],
    subtitle: 'What it is and what it stores',
    render: function (rootEl) {
      ui.append(rootEl,
        company(),
        ui.grid(2, [businessDate(), storage()], { start: true }),
        ui.grid(2, [history(), simulated()], { start: true }),
        skipped(),
        fresh());
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
