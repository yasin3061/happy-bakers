/*
 * HB.router - hash router, page registry and sidebar navigation.
 * Pages self-register (see docs/shell/UI-API.md); nothing else knows about them. The router owns the page
 * lifecycle: cleanup -> dispose charts -> render, a per-route state object that survives every redraw (open
 * document, draft form, selected tab), scroll preservation, who may open what (HB.session.access - a page file
 * does not choose its roles), the '#/doc/<id>' links, and an error boundary around every render.
 */
(function (root) {
  'use strict';

  var HB = root.HB;
  if (!HB || !HB.ui || !root.document) return;
  var ui = HB.ui, h = ui.h, doc = root.document;

  /* SPEC section 9: navigation groups in this order */
  var GROUPS = ['Home', 'Sell', 'Stores', 'Buy', 'Make', 'Stock', 'Expenses', 'People', 'Accounts', 'Reports', 'Masters', 'System'];
  var PAGE_ICONS = {
    'home': 'home', 'approvals': 'check-circle', 'guide': 'flag',
    'sell-dispatch': 'truck', 'sell-corporate': 'building', 'sell-invoices': 'receipt', 'sell-returns': 'undo', 'sell-receipts': 'coins',
    'stores-transfers': 'send', 'stores-dayend': 'store',
    'buy-orders': 'cart', 'buy-receipts': 'box', 'buy-bills': 'file', 'buy-payments': 'wallet',
    'make-production': 'factory', 'make-recipes': 'clipboard',
    'stock-onhand': 'layers', 'stock-batches': 'tag', 'stock-ledger': 'list', 'stock-counts': 'scale',
    'expenses': 'calculator', 'people': 'users',
    'acc-receivables': 'arrow-down', 'acc-payables': 'arrow-up', 'acc-cash': 'bank', 'acc-pnl': 'chart', 'acc-margin': 'percent', 'acc-gst': 'shield-check',
    'reports': 'book',
    'masters-items': 'grid', 'masters-parties': 'user', 'masters-setup': 'settings',
    'sys-audit': 'eye', 'sys-notifications': 'bell', 'sys-tiers': 'star'
  };
  /*
   * Which page shows a document of each type. The type is the document's own (HB.data.doc.get) or, with no data
   * layer, the prefix of its id. 'DS' is a dispatch sheet id and 'B' a batch id: not documents, but linked the
   * same way. A page may claim types of its own with `docTypes` in register().
   */
  var DOC_PAGES = {
    PO: 'buy-orders', GRN: 'buy-receipts', VBILL: 'buy-bills', PAY: 'buy-payments',
    PROD: 'make-production',
    SO: 'sell-corporate', INV: 'sell-invoices', RCPT: 'sell-receipts', CN: 'sell-returns', DS: 'sell-dispatch',
    XFER: 'stores-transfers', DAYEND: 'stores-dayend',
    DEP: 'acc-cash', OPENCASH: 'acc-cash',
    ADJ: 'stock-counts', WO: 'stock-batches', B: 'stock-batches', OPENSTOCK: 'stock-ledger',
    EXP: 'expenses'
  };
  var DOC_PREFIX = '#/doc/';
  var HOME_ID = 'home';
  var RERENDER_MS = 60;
  var APP_NAME = 'Happy Bakers';

  var pages = [];
  var states = {};           /* route -> plain object that survives re-renders and navigation */
  var scrolls = {};          /* hash -> scroll position, so a list is where it was left when its document closes */
  var current = null;        /* {page, params, cleanup} */
  var els = null;            /* {content, page, nav} */
  var started = false;
  var rendering = false;
  var timer = null;
  var resolvedHash = null;   /* hash that produced the current page; lets the hashchange handler skip echoes */

  /* ------------------------------------------------------------ registry */

  function register(def) {
    if (!def || !def.id || !def.route || typeof def.render !== 'function') {
      if (root.console) root.console.error('[HB.router] register() needs id, route and render', def);
      return;
    }
    var page = {
      id: def.id, route: def.route, group: GROUPS.indexOf(def.group) === -1 ? 'System' : def.group,
      title: def.title || def.id, subtitle: def.subtitle || '', icon: def.icon || PAGE_ICONS[def.id] || 'list',
      navLabel: def.navLabel || def.title || def.id,
      nav: def.nav !== false, /* nav: false = routable by URL, no menu item */
      filters: Array.isArray(def.filters) ? def.filters.slice() : [], render: def.render,
      openDoc: typeof def.openDoc === 'function' ? def.openDoc : null
    };
    if (Array.isArray(def.docTypes)) def.docTypes.forEach(function (t) { DOC_PAGES[String(t).toUpperCase()] = page.id; });
    var at = -1;
    pages.forEach(function (p, i) { if (p.id === page.id) at = i; });
    if (at === -1) pages.push(page); else pages[at] = page;
    if (started) { renderNav(); resolve(); }
  }

  /** Who may open a page is decided in the kernel (HB.session.access), never by the page file. */
  function isAllowed(page, user) {
    if (!page) return false;
    var u = user || HB.session.current();
    return HB.session.canOpen(page.id, u.role);
  }

  function ordered() {
    return pages.slice().sort(function (a, b) {
      return (GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group)) || (pages.indexOf(a) - pages.indexOf(b));
    });
  }

  function allowedPages(user) { return ordered().filter(function (p) { return isAllowed(p, user); }); }

  function byId(id) { return pages.filter(function (p) { return p.id === id; })[0] || null; }

  /** Where an unknown or forbidden route lands: Home, or the first allowed screen of the menu while Home is not built. */
  function homePage(user) {
    var home = byId(HOME_ID);
    if (home && isAllowed(home, user)) return home;
    var list = allowedPages(user);
    return list.filter(function (p) { return p.nav; })[0] || list[0] || null;
  }

  /* ------------------------------------------------------------ documents */

  function lookupDoc(id) {
    try { return HB.data && HB.data.doc && typeof HB.data.doc.get === 'function' ? (HB.data.doc.get(id) || null) : null; }
    catch (e) { return null; }
  }

  /**
   * id -> { docId, type, page } - the page that shows the document, or page: null when no registered page does.
   * A cancellation is read on the document it cancelled, so a CXL id resolves to its target.
   */
  function docTarget(id, depth) {
    var d = lookupDoc(id);
    var type = String(d && d.type ? d.type : String(id).split('-')[0]).toUpperCase();
    if (type === 'CXL' && d && d.targetId && d.targetId !== id && !depth) return docTarget(d.targetId, 1);
    var pageId = type === 'CXL' ? 'sys-audit' : DOC_PAGES[type];
    return { docId: id, type: type, page: pageId ? byId(pageId) : null };
  }

  function docHref(id) { return DOC_PREFIX + encodeURIComponent(String(id)); }

  function docIdOf(path) {
    if (path.indexOf(DOC_PREFIX) !== 0) return null;
    try { return decodeURIComponent(path.slice(DOC_PREFIX.length)); } catch (e) { return path.slice(DOC_PREFIX.length); }
  }

  /* ------------------------------------------------------------- matching */

  function parseHash(hash) {
    var raw = hash || '';
    var q = raw.indexOf('?');
    var path = (q === -1 ? raw : raw.slice(0, q)).replace(/\/+$/, '');
    var params = {};
    if (q !== -1) {
      raw.slice(q + 1).split('&').forEach(function (pair) {
        if (!pair) return;
        var eq = pair.indexOf('=');
        var k = eq === -1 ? pair : pair.slice(0, eq), v = eq === -1 ? '' : pair.slice(eq + 1);
        try { params[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' ')); } catch (e) { /* malformed pair */ }
      });
    }
    return { path: path, params: params };
  }

  function match(path) {
    var best = null;
    pages.forEach(function (p) {
      if (p.route === path) { best = { page: p, rest: [] }; return; }
      if (path.indexOf(p.route + '/') === 0 && (!best || (best.rest.length && p.route.length > best.page.route.length))) {
        best = { page: p, rest: path.slice(p.route.length + 1).split('/').filter(Boolean) };
      }
    });
    return best;
  }

  /** hash -> { page, params, docLink } for a route or a document link, or null when nothing registered answers it. */
  function locate(hash) {
    var parsed = parseHash(hash);
    var docId = docIdOf(parsed.path);
    if (docId !== null) {
      var t = docId ? docTarget(docId) : { page: null };
      if (!t.page) return docId ? { page: null, params: {}, docLink: docId } : null;
      return { page: t.page, params: { doc: t.docId }, docLink: docId };
    }
    var found = match(parsed.path);
    if (!found) return null;
    if (found.rest.length) parsed.params.path = found.rest;
    return { page: found.page, params: parsed.params, docLink: null };
  }

  function buildHash(route, params) {
    var page = route && route.charAt(0) !== '#' ? byId(route) : null;
    var base = page ? page.route : route;
    var query = Object.keys(params || {}).filter(function (k) { return params[k] !== null && params[k] !== undefined && params[k] !== ''; })
      .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&');
    return base + (query ? '?' + query : '');
  }

  /**
   * navigate('#/buy/orders') | navigate('buy-orders', {tab: 'PENDING'}) | navigate('home', null, {replace: true})
   * replace: true swaps the current history entry. The route is resolved synchronously, so router.current() is already
   * the new page when navigate() returns and a debounced re-render can never run against the old params; the
   * hashchange echo is ignored through resolvedHash.
   */
  function navigate(route, params, o) {
    var target = buildHash(route, params);
    if (root.location.hash !== target) {
      if (o && o.replace) root.location.replace(target); /* same document: only the fragment changes */
      else root.location.hash = target;
    }
    resolve();
  }

  /** Open a document wherever it lives: the hash becomes '#/doc/<id>' and the page that owns the type draws its view. */
  function openDoc(id, o) { navigate(docHref(id), null, o); }

  /* ------------------------------------------------------------ lifecycle */

  function teardown() {
    if (!current) return;
    if (typeof current.cleanup === 'function') {
      try { current.cleanup(); } catch (e) { if (root.console) root.console.error('[HB.router] cleanup failed', e); }
    }
    current.cleanup = null;
    if (els && HB.charts && typeof HB.charts.disposeAll === 'function') {
      try { HB.charts.disposeAll(els.page); } catch (e2) { if (root.console) root.console.error('[HB.router] chart disposal failed', e2); }
    }
  }

  function defaultFilters() {
    var today = HB.calendar.today;
    return { from: HB.dates.monthStart(today), to: today, unitIds: null, preset: 'thisMonth' };
  }

  /**
   * The filter object a page receives: the global state narrowed to the dimensions the page declared in `filters`.
   * A dimension the page does not honour has no control in the filter bar, so a value left over from another screen
   * must not reach it: undeclared dimensions are null, which selectors read as "all".
   */
  function filtersFor(page) {
    var f = HB.filters && typeof HB.filters.get === 'function' ? HB.filters.get() : defaultFilters(); /* a fresh object on every call */
    var honours = page.filters;
    if (honours.indexOf('unit') === -1) f.unitIds = null;
    if (honours.indexOf('date') === -1) { f.from = null; f.to = null; f.preset = null; }
    return f;
  }

  /* Focus survives a re-render when the same kind of element sits at the same position in the new DOM:
     this is what keeps a search box usable while every keystroke re-renders the page. (A document form restores
     its own focus by field, see HB.forms.docForm.) */
  function markFocus() {
    var a = doc.activeElement;
    if (!a || a === doc.body || a === els.page || !els.page.contains(a)) return null;
    var path = [];
    for (var n = a; n && n !== els.page; n = n.parentNode) path.unshift(Array.prototype.indexOf.call(n.parentNode.childNodes, n));
    var sel = null;
    try { if (typeof a.selectionStart === 'number') sel = [a.selectionStart, a.selectionEnd]; } catch (e) { sel = null; }
    return { path: path, tag: a.tagName, type: a.type, sel: sel };
  }

  function restoreFocus(mark) {
    if (!mark) return;
    var n = els.page;
    for (var i = 0; i < mark.path.length && n; i++) n = n.childNodes[mark.path[i]];
    if (!n || n.tagName !== mark.tag || n.type !== mark.type || typeof n.focus !== 'function') return;
    try {
      n.focus({ preventScroll: true });
      if (mark.sel && typeof n.setSelectionRange === 'function') n.setSelectionRange(mark.sel[0], mark.sel[1]);
    } catch (e) { /* not focusable after all */ }
  }

  /** scrollTo: null keeps the position (a redraw); a number is where a navigation puts the content. */
  function draw(scrollTo) {
    if (!current || !els) return;
    if (rendering) { schedule(); return; }
    rendering = true;
    root.clearTimeout(timer);
    timer = null;
    var page = current.page;
    var redraw = scrollTo === null || scrollTo === undefined;
    var keepTop = els.content.scrollTop;
    var focusMark = redraw ? markFocus() : null;
    /* Hold the height while the page is rebuilt so the scroll position cannot collapse. */
    els.page.style.minHeight = redraw ? els.page.offsetHeight + 'px' : '';
    teardown();
    ui.clear(els.page);
    els.page.className = 'mk-page pg-' + page.id;
    var ctx = {
      filters: filtersFor(page),
      user: HB.session.current(),
      params: current.params,
      docId: current.params.doc || null,
      state: states[page.route] || (states[page.route] = {}),
      navigate: navigate,
      openDoc: openDoc,
      closeDoc: function () { navigate(page.route); },
      rerender: function () { draw(null); }
    };
    try {
      try {
        var result = page.render(els.page, ctx);
        if (typeof result === 'function') current.cleanup = result;
      } catch (e) {
        /* Page-level error boundary: a tidy card instead of a blank screen. */
        if (root.console) root.console.error('[HB.router] render failed for ' + page.id, e);
        teardown();
        ui.clear(els.page);
        els.page.appendChild(ui.errorCard('"' + page.title + '" could not be drawn', e,
          'The rest of the demo keeps working. Pick another screen from the menu, or use "Fresh copy dated today" in the top-right menu if this persists.'));
      }
      els.page.style.minHeight = '';
      /* A page that drew a full-page document (a docForm or a docView as its first element) is not showing a list:
         the filter bar steps aside until the list is back. The filter state itself is untouched. */
      var first = els.page.firstElementChild;
      var full = !!first && (first.classList.contains('mk-docform') || first.classList.contains('mk-docview') || first.classList.contains('mk-nodoc'));
      doc.documentElement.classList.toggle('mk-doc-open', full);
      els.content.scrollTop = redraw ? keepTop : scrollTo;
      restoreFocus(focusMark);
      if (typeof ui.closeOrphans === 'function') ui.closeOrphans();
    } finally {
      rendering = false; /* never leave the router locked, whatever happened above */
    }
  }

  function schedule() {
    root.clearTimeout(timer);
    timer = root.setTimeout(function () { timer = null; draw(null); }, RERENDER_MS);
  }

  function restoreHash() {
    if (resolvedHash === null) return;
    try { root.history.replaceState(root.history.state, '', resolvedHash || '#'); }
    catch (e) { root.location.replace(resolvedHash || '#'); } /* fires hashchange, which the echo check above ignores */
  }

  function rememberRoute(hash) {
    var prefs = HB.store.get('prefs', {}) || {};
    if (prefs.lastRoute === hash) return;
    prefs.lastRoute = hash;
    HB.store.set('prefs', prefs);
  }

  function resolve() {
    if (!started) return;
    var user = HB.session.current();
    var found = locate(root.location.hash);
    if (!found || !found.page || !isAllowed(found.page, user)) {
      /* a document link the persona cannot follow says so; any other miss lands on Home quietly */
      if (found && found.docLink) {
        ui.toast(found.page ? user.roleLabel + ' has no screen for ' + found.docLink + '.' : 'No screen opens ' + found.docLink + '.', { tone: 'info' });
      }
      var fallback = homePage(user);
      if (!fallback) {
        teardown();
        current = null;
        ui.clear(els.page).appendChild(ui.emptyState('No screens are available for this role', 'Switch role from the top-right corner.', { icon: 'lock' }));
        return;
      }
      if (parseHash(root.location.hash).path !== fallback.route) root.location.replace(fallback.route); /* same-document, no history entry */
      found = { page: fallback, params: {}, docLink: null };
    }
    var params = found.params;

    var leaving = resolvedHash;
    resolvedHash = root.location.hash;
    var samePage = !!current && current.page.id === found.page.id;
    if (samePage && JSON.stringify(current.params) === JSON.stringify(params)) { current.page = found.page; draw(null); return; }

    /* The hash is the source of truth: a new page or new params closes every overlay.
       `current` moves to the new route BEFORE the overlays close, so an onClose handler can tell why it runs:
       router.current() still carries its record id -> the user closed the drawer; anything else -> navigation did. */
    if (current && leaving !== null && els) scrolls[leaving] = els.content.scrollTop;
    teardown();
    var next = { page: found.page, params: params, cleanup: null };
    current = next;
    if (typeof ui.closeAll === 'function') ui.closeAll();
    if (current !== next) return; /* an onClose handler navigated on; that navigation has already been resolved and drawn */
    if (params.doc && found.page.openDoc) {
      /* the page's own way of opening a document: it prepares its per-route state before the render */
      try { found.page.openDoc(params.doc, states[found.page.route] || (states[found.page.route] = {})); }
      catch (e) { if (root.console) root.console.error('[HB.router] openDoc failed for ' + found.page.id, e); }
    }
    doc.title = found.page.title + ' - ' + APP_NAME;
    markActive();
    rememberRoute(root.location.hash);
    HB.bus.emit('route:changed', { page: found.page, params: params });
    /* list <-> document of the same page: each keeps its own scroll position; another page starts at the top */
    draw(samePage ? (scrolls[resolvedHash] || 0) : 0);
  }

  /* ------------------------------------------------------------------ nav */

  var navLinks = {};

  function markActive() {
    Object.keys(navLinks).forEach(function (id) {
      var on = !!current && current.page.id === id;
      navLinks[id].classList.toggle('is-active', on);
      if (on) navLinks[id].setAttribute('aria-current', 'page'); else navLinks[id].removeAttribute('aria-current');
      if (on) revealInNav(navLinks[id]);
    });
  }

  /** Keep the active item visible when the menu is taller than the window (scrolls the menu only, never the page). */
  function revealInNav(link) {
    var host = els && els.nav;
    if (!host || host.scrollHeight <= host.clientHeight) return;
    var box = link.getBoundingClientRect(), frame = host.getBoundingClientRect();
    if (box.top < frame.top + 8) host.scrollTop -= frame.top + 8 - box.top;
    else if (box.bottom > frame.bottom - 8) host.scrollTop += box.bottom - frame.bottom + 8;
  }

  /** Build (or rebuild) the grouped navigation for the current persona into the container given to start(). */
  function renderNav(container) {
    var host = container || (els && els.nav);
    if (!host) return;
    ui.clear(host);
    navLinks = {};
    var visible = allowedPages().filter(function (p) { return p.nav; });
    GROUPS.forEach(function (group) {
      var inGroup = visible.filter(function (p) { return p.group === group; });
      if (!inGroup.length) return;
      var registered = pages.filter(function (p) { return p.nav && p.group === group; }).length;
      var solo = registered === 1; /* a group that only ever has one screen needs no heading */
      var headingId = 'mk-nav-' + group.toLowerCase();
      host.appendChild(h('div', { 'class': ['mk-nav__group', solo ? 'mk-nav__group--solo' : ''], role: 'group', 'aria-labelledby': solo ? null : headingId, 'aria-label': solo ? group : null },
        solo ? null : h('div', { 'class': 'mk-nav__heading', id: headingId }, group),
        inGroup.map(function (p) {
          var a = h('a', { 'class': 'mk-nav__item', href: p.route, title: p.navLabel !== p.title ? p.title : (p.subtitle || null) }, ui.icon(p.icon), h('span', null, p.navLabel));
          navLinks[p.id] = a;
          return a;
        })));
    });
    markActive();
  }

  /* ---------------------------------------------------------------- start */

  /** start({content, page, nav}) - content is the scrolling region, page the render root inside it, nav the sidebar list. */
  function start(o) {
    if (started) return;
    els = { content: o.content, page: o.page, nav: o.nav };
    started = true;
    renderNav();

    root.addEventListener('hashchange', function () {
      var hash = root.location.hash;
      if (hash === resolvedHash) return; /* echo of a navigation that is already resolved */
      /* A plain fragment ('#mk-content' from a skip link, any in-page anchor) is not a route: keep the screen and put the route back. */
      if (current && hash.length > 1 && hash.indexOf('#/') !== 0) { restoreHash(); return; }
      resolve();
    });
    /* A redraw, never a reset: the per-route state object (open document, draft form, selected tab) and the scroll
       position are kept. A persona that loses the page it is on lands on Home. */
    HB.bus.on('session:changed', function () {
      renderNav();
      if (current && isAllowed(current.page)) schedule(); else resolve();
    });
    HB.bus.on('filters:changed', function () { if (current && current.page.filters.length) schedule(); });
    HB.bus.on('store:changed', function (evt) {
      var key = evt && evt.key;
      if (key === 'prefs' || key === '*') return; /* prefs: role, filters and last route have their own events; '*' is followed by a reload */
      if (current) schedule();
    });

    if (!root.location.hash || root.location.hash === '#') {
      var last = (HB.store.get('prefs', {}) || {}).lastRoute;
      var remembered = last ? locate(last) : null;
      if (remembered && remembered.page && isAllowed(remembered.page)) root.location.replace(last);
    }
    resolve();
  }

  HB.router = {
    GROUPS: GROUPS.slice(),
    register: register,
    start: start,
    navigate: navigate,
    rerender: function () { if (current) draw(null); },
    current: function () { return current ? { page: current.page, params: current.params } : null; },
    pages: function () { return ordered(); },
    allowedPages: allowedPages,
    isAllowed: function (pageOrId, user) { return isAllowed(typeof pageOrId === 'string' ? byId(pageOrId) : pageOrId, user); },
    href: function (id, params) { return buildHash(id, params); },
    renderNav: renderNav,
    /* documents */
    openDoc: openDoc,
    docHref: docHref,
    /** The page that shows a document, or null when none is registered or the persona does not have it. */
    docPage: function (id, user) { var t = docTarget(String(id)); return t.page && isAllowed(t.page, user) ? t.page : null; },
    /** The per-route state object of a page (by id or route), created on demand. For code that prepares a page before opening it. */
    stateOf: function (idOrRoute) {
      var page = byId(idOrRoute) || pages.filter(function (p) { return p.route === idOrRoute; })[0];
      return page ? (states[page.route] || (states[page.route] = {})) : null;
    },
    /**
     * The screens that hold a form with something typed in and not posted: [{page, key}]. A draft lives in a page's
     * per-route state (HB.forms.draft: {values, lines, dirty}); it survives navigation and is lost on a reload, which
     * is why the shell asks before the window goes (js/app.js).
     */
    dirtyDrafts: function () {
      var out = [];
      pages.forEach(function (p) {
        var st = states[p.route];
        if (!st) return;
        Object.keys(st).forEach(function (k) {
          var d = st[k];
          if (d && typeof d === 'object' && d.dirty === true && d.values && typeof d.values === 'object') out.push({ page: p, key: k });
        });
      });
      return out;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
