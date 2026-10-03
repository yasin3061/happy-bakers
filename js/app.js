/*
 * Boot: build the book (when the data layer is there), build the shell, start the router.
 * Nothing here assumes that a data file or a page file is present - the shell must come up on its own.
 */
(function (root) {
  'use strict';

  var HB = root.HB;
  var doc = root.document;
  if (!HB || !HB.ui || !HB.router || !doc) {
    if (root.console) root.console.error('[HB.app] kernel, ui or router did not load - check the script tags in index.html');
    return;
  }
  var ui = HB.ui, h = ui.h;

  /* ---------------------------------------------------------- data layer */

  /** Build the book: seed to the day before the business date, then replay the user's log. Returns the failure text, or ''. */
  function bootEngine() {
    if (!HB.engine || typeof HB.engine.boot !== 'function') return '';
    try { HB.engine.boot(); return ''; }
    catch (e) {
      if (root.console) root.console.error('[HB.app] engine.boot failed', e);
      return e && e.message ? e.message : String(e);
    }
  }

  /* -------------------------------------------------------------- banners */
  /* Several can show at once, one row each, in a fixed order. Each has an id so it can be set and cleared on its own. */

  var BANNER_ORDER = ['engine', 'storage', 'notice', 'skipped', 'calendar', 'message'];
  var banners = {};

  function paintBanners() {
    var el = doc.getElementById('mk-banner');
    if (!el) return;
    ui.clear(el);
    var ids = BANNER_ORDER.filter(function (id) { return banners[id]; });
    ids.forEach(function (id) {
      var b = banners[id];
      el.appendChild(h('div', { 'class': ['mk-banner__item', b.tone && b.tone !== 'warn' ? 'mk-banner__item--' + b.tone : ''] },
        ui.icon(b.tone === 'info' ? 'info' : 'alert-triangle', 14),
        h('span', { 'class': 'mk-banner__text' }, b.text),
        b.action ? h('button', { type: 'button', 'class': 'mk-banner__action', onClick: b.action.onClick }, b.action.label) : null));
    });
    el.hidden = !ids.length;
  }

  /** banner(id, {text, tone: 'warn' | 'info' | 'critical', action: {label, onClick}}) sets one; banner(id, null) clears it. */
  function banner(id, o) {
    if (BANNER_ORDER.indexOf(id) === -1) id = 'message';
    if (o && o.text) banners[id] = o; else delete banners[id];
    paintBanners();
  }

  /** The inherited one-line banner: showBanner('text') sets it, showBanner('') clears it. */
  function showBanner(message) { banner('message', message ? { text: message } : null); }

  function dayLabel(iso) { return HB.dates.label(iso, 'd MMM yyyy'); }

  /** What one skipped entry was, in words: "Entry 12, vendor bill VBILL-U-0003: the order is cancelled". Tolerant of whatever the engine records. */
  function skippedLine(s) {
    if (s === null || s === undefined) return '';
    if (typeof s !== 'object') return String(s);
    var entry = s.entry && typeof s.entry === 'object' ? s.entry : s;
    var args = entry.args && typeof entry.args === 'object' ? entry.args : {};
    var ids = entry.out && Array.isArray(entry.out.ids) ? entry.out.ids.join(', ') : '';
    var typeName = HB.data && HB.data.lookup && typeof HB.data.lookup.typeLabel === 'function' && args.type
      ? HB.data.lookup.typeLabel(String(args.type).toUpperCase(), args.payload && args.payload.kind).toLowerCase() : 'document';
    var what;
    switch (entry.op) {
      case 'post': what = typeName + (ids ? ' ' + ids : ''); break;
      case 'postDispatch': what = 'dispatch sheet' + (ids ? ', ' + ids : ''); break;
      case 'cancelDispatch': what = 'cancellation of the dispatch sheet ' + (args.sheetId || ''); break;
      case 'approve': what = 'approval of ' + (args.id || 'a document'); break;
      case 'reject': what = 'rejection of ' + (args.id || 'a document'); break;
      case 'cancel': what = 'cancellation of ' + (args.id || 'a document'); break;
      case 'receiveTransfer': what = 'receipt of ' + (args.id || 'a transfer') + ' at the store'; break;
      case 'master': case 'setActive': what = 'a change to an item, a customer or another record'; break;
      default: what = 'an entry that cannot be read';
    }
    var why = s.reason || s.message || (s.error && (s.error.message || s.error)) || '';
    return 'Entry ' + (entry.n !== undefined ? entry.n : '?') + ', ' + what + (why ? ': ' + why : '');
  }

  function showSkipped(list) {
    ui.modal({
      title: 'Entries that were skipped',
      subtitle: 'They no longer apply to this copy and were left out when it was built again. Everything else is as you left it.',
      size: 'lg',
      body: h('ol', { 'class': 'mk-skipped' }, list.map(function (s) { return h('li', null, skippedLine(s)); }))
    });
  }

  /**
   * The calendar banner. Two cases, both rare on an ordinary day:
   *  - the device's date is later than the business date: the copy is as it was left, and a fresh one is offered;
   *  - the copy was opened on a day that cannot be a business date (the factory is closed, or the day lies outside
   *    the sample's range), so it took the nearest day that can: one line says why the top bar shows another date.
   * `fresh` is the date a fresh copy would take; it differs from the device's date in exactly those cases.
   */
  function calendarBanner() {
    var cal = HB.calendar, real = cal.realToday(), fresh = cal.clamp(real);
    /* why a copy opened today is not dated today; '' on an ordinary day. `what` is "this copy" or "a fresh copy". */
    function why(what) {
      if (fresh === real) return '';
      if (real < cal.minDate) return ' The sample starts on ' + dayLabel(cal.minDate) + ', so ' + what + ' is dated that day.';
      if (real > cal.maxDate) return ' The sample\'s history ends on ' + dayLabel(cal.maxDate) + ', so ' + what + ' is dated that day.';
      return ' The factory is closed today, so ' + what + ' is dated ' + dayLabel(fresh) + ', the next working day.';
    }
    if (cal.movedOn()) {
      return {
        text: 'This copy is dated ' + dayLabel(cal.today) + '. Today is ' + dayLabel(real) + '.' + why('a fresh copy'), tone: 'info',
        action: { label: fresh === real ? 'Start a fresh copy dated today' : 'Start a fresh copy dated ' + dayLabel(fresh), onClick: function () { freshCopy(); } }
      };
    }
    if (fresh !== real && fresh === cal.today) return { text: 'Today is ' + dayLabel(real) + '.' + why('this copy'), tone: 'info' };
    return null;
  }

  /** Re-read everything a banner depends on. Runs after boot and after every change to the store. */
  function refreshBanners() {
    banner('storage', HB.store.ok ? null : { text: 'This browser is not saving changes: what you enter will not survive a reload.' });

    var skipped = HB.engine && HB.engine.skipped;
    var list = Array.isArray(skipped) ? skipped : [];
    banner('skipped', list.length ? {
      text: list.length === 1 ? 'One of your entries no longer applies to this copy and was skipped.' : list.length + ' of your entries no longer apply to this copy and were skipped.',
      action: { label: list.length === 1 ? 'Show it' : 'Show them', onClick: function () { showSkipped(list); } }
    } : null);

    /* the data layer may leave one sentence for the user, such as a copy replaced because the sample was updated */
    var notice = HB.engine && typeof HB.engine.notice === 'string' ? HB.engine.notice : '';
    banner('notice', notice ? { text: notice, tone: 'info' } : null);

    banner('calendar', calendarBanner());
  }

  /* ------------------------------------------------- leaving with a draft */
  /*
   * A form that is filled in and not posted lives in memory only: a reload or a closed tab loses it. The browser asks
   * first, in its own words. It does not ask when the reload is the sample's own doing: a fresh copy the user just
   * confirmed, or another tab that changed this copy (this tab's book is stale then, and it must rebuild).
   */
  var leaving = false;
  var copySeen = null; /* the stored copy as this tab last wrote or read it */

  function storedCopy() {
    try { return String(root.localStorage.getItem('hb.v1.meta')) + '|' + String(root.localStorage.getItem('hb.v1.log')); }
    catch (e) { return null; }
  }
  /* true when another tab has written the copy since this tab last did: this tab's own writes all announce themselves */
  function copyChangedElsewhere() { return copySeen !== null && storedCopy() !== copySeen; }

  function wireLeaveGuard() {
    copySeen = storedCopy();
    HB.bus.on('store:changed', function () { copySeen = storedCopy(); });
    root.addEventListener('beforeunload', function (e) {
      if (leaving || typeof HB.router.dirtyDrafts !== 'function' || !HB.router.dirtyDrafts().length) return undefined;
      if (HB.store.ok && copyChangedElsewhere()) return undefined;
      e.preventDefault();
      e.returnValue = ''; /* the browser shows its own sentence; the text of ours would be ignored */
      return '';
    });
  }

  /* ----------------------------------------------------------- fresh copy */

  /** Discard the user's entries and start again from today's date. Asks first. Returns a promise of whether it went ahead. */
  function freshCopy() {
    var realDay = HB.calendar.clamp(HB.calendar.realToday()), isToday = realDay === HB.calendar.realToday();
    return ui.confirm({
      title: isToday ? 'Start a fresh copy dated today?' : 'Start a fresh copy dated ' + dayLabel(realDay) + '?',
      message: 'Everything you entered in this copy is discarded, and the sample starts again with ' + dayLabel(realDay) +
        ' as its business date. The history is built again up to the day before. This cannot be undone.',
      confirmLabel: 'Start a fresh copy', tone: 'danger'
    }).then(function (res) {
      if (!res.ok) return false;
      leaving = true; /* the reload that follows is the user's own choice: no second question about unposted drafts */
      /* a fresh copy opens on the dashboard, with the date range and the locations as on a first open: the document on
         screen may be one of the entries just discarded, and a range picked in the old copy says nothing about the new one.
         The persona stays: the top bar shows who is working. */
      try { root.history.replaceState(root.history.state, '', '#/home'); } catch (e) { /* the reload then keeps the screen it was on */ }
      if (HB.filters && typeof HB.filters.reset === 'function') HB.filters.reset();
      if (HB.engine && typeof HB.engine.freshCopy === 'function') {
        try { HB.engine.freshCopy(); return true; } /* clears the log, takes today's date, reloads */
        catch (e) { if (root.console) root.console.error('[HB.app] engine.freshCopy failed', e); }
      }
      /* no data layer (or it failed): the same result by hand */
      HB.store.remove('log');
      HB.calendar.set(HB.calendar.realToday());
      root.location.reload();
      return true;
    });
  }

  /* --------------------------------------------------------------- shell */

  function buildSidebar(sidebar) {
    var nav = h('nav', { 'class': 'mk-nav', 'aria-label': 'Screens' });
    ui.append(ui.clear(sidebar),
      h('div', { 'class': 'mk-brand' },
        h('div', { 'class': 'mk-brand__mark', 'aria-hidden': 'true' }, 'HB'),
        h('div', { 'class': 'mk-brand__text' },
          h('div', { 'class': 'mk-brand__name' }, 'Happy Bakers'),
          h('div', { 'class': 'mk-brand__tag' }, 'Neo ERP sample'))),
      nav,
      h('div', { 'class': 'mk-sidebar__foot' }, ui.icon('info', 14), h('span', null, 'A sample on invented data. Happy Bakers is fictional.')));
    return nav;
  }

  function buildTopbar(topbar) {
    var crumb = h('div', { 'class': 'mk-topbar__crumb' });
    var title = h('h1', { 'class': 'mk-topbar__title' });

    var roleBtn = h('button', { type: 'button', 'class': 'mk-role', onClick: openRoleMenu });
    function paintRole() {
      var u = HB.session.current();
      ui.append(ui.clear(roleBtn),
        ui.avatar(u.initials, { accent: true }),
        h('span', { 'class': 'mk-role__text' }, h('span', { 'class': 'mk-role__name' }, u.name), h('span', { 'class': 'mk-role__label' }, u.roleLabel)),
        ui.icon('chevron-down', 14));
      roleBtn.setAttribute('aria-label', 'Working as ' + u.name + ', ' + u.roleLabel + '. Work as someone else');
    }
    function openRoleMenu() {
      var me = HB.session.current();
      var items = [{ heading: 'Work in the sample as' }].concat(HB.session.users.map(function (u) {
        return { label: u.name, sub: u.roleLabel, avatar: u.initials, selected: u.id === me.id, onSelect: function () {
          if (u.id === HB.session.current().id) return;
          HB.session.set(u.id);
          ui.toast('The menu, the figures and what you may do now follow this role.', { title: 'Working as ' + u.name + ', ' + u.roleLabel, tone: 'info' });
        } };
      }));
      ui.menu(roleBtn, items, { align: 'right', width: 300 });
    }

    var moreBtn = ui.iconButton('more', 'More options', function () {
      ui.menu(moreBtn, [
        { label: 'Fresh copy dated today', sub: 'Discard what you entered and start again', icon: 'refresh', danger: true, onSelect: function () { freshCopy(); } },
        auth.user ? { separator: true } : null,
        auth.user ? { label: 'Sign out', sub: auth.user, icon: 'lock', onSelect: function () { signOut(); } } : null
      ].filter(Boolean), { align: 'right', width: 280 });
    });

    var dateText = h('strong');
    var stamp = h('span', { 'class': 'mk-stamp' }, ui.icon('calendar', 14), 'Business date ', dateText);
    function paintDate() {
      dateText.textContent = HB.dates.label(HB.calendar.today, 'd MMM yyyy');
      stamp.title = HB.dates.label(HB.calendar.today, 'EEE') + ' ' + dayLabel(HB.calendar.today) + ' is today for this copy. It was set when the copy was first opened and stays until you start a fresh copy. History runs to the day before.';
    }

    ui.append(ui.clear(topbar),
      h('div', { 'class': 'mk-topbar__titles' }, crumb, title),
      h('div', { 'class': 'mk-topbar__right' }, stamp, roleBtn, moreBtn));
    paintRole();
    paintDate();
    HB.bus.on('session:changed', paintRole);
    HB.bus.on('store:changed', function (evt) { if (evt && evt.key === 'meta') paintDate(); });

    return function setPage(page) {
      crumb.textContent = page.group !== page.title ? page.group : '';
      crumb.hidden = !crumb.textContent;
      ui.append(ui.clear(title), page.title, page.subtitle ? h('small', null, page.subtitle) : null);
    };
  }

  /**
   * "Skip to content" moves keyboard focus into the content column. It must not change the hash: in a hash-routed app
   * '#mk-content' would read as an unknown route (the router also ignores plain fragments, as a second line of defence).
   */
  function wireSkipLink(content) {
    var skip = doc.querySelector('.mk-skip');
    if (!skip || !content) return;
    skip.addEventListener('click', function (e) {
      e.preventDefault();
      content.focus();
    });
  }

  /**
   * The content column reserves a scrollbar gutter; the top bar and the filter row do not scroll. Publishing the gutter
   * width lets css/base.css give the bars exactly the same measure as the page, so titles, filters and cards line up
   * at every window width (including past 1440px, where the page is centred).
   */
  function syncGutter(content) {
    if (!content) return;
    function measure() { doc.documentElement.style.setProperty('--gutter-w', Math.max(0, content.offsetWidth - content.clientWidth) + 'px'); }
    measure();
    root.addEventListener('resize', measure); /* browser zoom changes the scrollbar's CSS width and fires resize */
  }

  /*
   * Served behind a sign-in (tools/serve.js)? Then the server knows who is signed in, and the menu offers the way out.
   * Opened as a file there is no server and no session, and neither is asked for.
   */
  var auth = { user: null };
  function checkSession() {
    if (!/^https?:$/.test(root.location.protocol) || typeof root.fetch !== 'function') return;
    root.fetch('/auth/session', { credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) { return r.status === 200 ? r.json() : null; })
      .then(function (j) { if (j && j.user) auth.user = String(j.user); })
      .catch(function () { /* no session to report: the menu simply has no sign-out */ });
  }
  /* a sign-out is a POST, like every action that changes something on a server */
  function signOut() {
    var form = doc.createElement('form');
    form.method = 'post';
    form.action = '/logout';
    form.hidden = true;
    doc.body.appendChild(form);
    form.submit();
  }

  function boot() {
    var failure = bootEngine();
    checkSession();

    var nav = buildSidebar(doc.getElementById('mk-sidebar'));
    var setPage = buildTopbar(doc.getElementById('mk-topbar'));
    var filterBar = doc.getElementById('mk-filterbar');
    var content = doc.getElementById('mk-content');
    wireSkipLink(content);
    syncGutter(content);
    wireLeaveGuard();

    HB.bus.on('route:changed', function (evt) {
      setPage(evt.page);
      if (HB.filters && typeof HB.filters.mountBar === 'function') HB.filters.mountBar(filterBar, evt.page.filters);
      else filterBar.hidden = true;
    });

    if (failure) banner('engine', { tone: 'critical', text: 'The sample data could not be built (' + failure + '). Screens may be empty or wrong; a fresh copy usually clears it.', action: { label: 'Start a fresh copy', onClick: function () { freshCopy(); } } });
    refreshBanners();
    /* a failed write, a skipped entry after a later rebuild, a new business date: each can change what the banners say */
    HB.bus.on('store:changed', refreshBanners);

    HB.router.start({ content: content, page: doc.getElementById('mk-page'), nav: nav });
  }

  HB.app = { freshCopy: freshCopy, showBanner: showBanner, banner: banner };

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
})(typeof window !== 'undefined' ? window : globalThis);
