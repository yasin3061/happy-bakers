/*
 * Notification log (#/system/notifications). SCOPE 4.9: the emails Neo ERP would send - approval requests, overdue
 * receivables, bills falling due, low stock, near expiry - by kind, each with the document it concerns.
 * HB.data.notify.list() works them out from the books as they stand: nothing is stored and nothing is sent, and an
 * entry leaves the list when what it is about is settled. The page draws what the selector returns.
 */
(function (root) {
  'use strict';

  var HB = root.HB;
  if (!HB || !HB.router || !HB.ui || !HB.forms) return;
  var ui = HB.ui, h = ui.h, forms = HB.forms, fmt = HB.fmt;

  /* the kinds of SCOPE 4.9, in the order of the tabs; the selector's row carries its own label (kindLabel) */
  var KINDS = [
    { id: 'approval', label: 'Approvals', tone: 'warn' },
    { id: 'overdue', label: 'Overdue receivables', tone: 'serious' },
    { id: 'due', label: 'Bills due', tone: 'info' },
    { id: 'low_stock', label: 'Low stock', tone: 'warn' },
    { id: 'expiry', label: 'Expiry', tone: 'serious' }
  ];
  var LOW_STOCK_PAGE = 'stock-onhand';   /* where the low-stock list is: a low-stock email concerns no document */

  function toneOf(kind) { var k = KINDS.filter(function (x) { return x.id === kind; })[0]; return k ? k.tone : 'neutral'; }
  function pageById(id) { return HB.router.pages().filter(function (p) { return p.id === id; })[0] || null; }

  /** The document the email is about, as a link; for an overdue customer the oldest invoice and how many more. */
  function aboutCell(value, n) {
    if (n.docId) {
      var more = n.ref && Array.isArray(n.ref.docIds) ? n.ref.docIds.length - 1 : 0;
      return h('div', null, forms.docLink(n.docId), more > 0 ? h('div', { 'class': 'mk-small mk-muted' }, 'and ' + fmt.num(more) + ' more') : null);
    }
    var page = n.kind === 'low_stock' ? pageById(LOW_STOCK_PAGE) : null;
    if (page && HB.router.isAllowed(page)) return ui.link(page.title, page.route);
    return h('span', { 'class': 'mk-faint' }, '-');
  }

  /* the kind of email, its subject and its text in one cell, so that the document it is about stays on screen at the smallest width */
  function mailCell(value, n) {
    return h('div', null, h('div', { 'class': 'mk-mb-1' }, ui.chip(n.kindLabel, toneOf(n.kind))), h('div', { 'class': 'mk-strong' }, n.subject), h('div', { 'class': 'mk-small mk-muted' }, n.text));
  }

  var COLUMNS = [
    { key: 'date', label: 'Dated', format: 'date' },
    { key: 'toName', label: 'To', render: ui.cells.twoLine(function (n) { return n.to; }, { maxWidth: 190 }) },
    { key: 'subject', label: 'Email', wrap: true, className: 'pg-sys-notifications__mail', render: mailCell },
    { key: 'docId', label: 'About', render: aboutCell, sortable: false }
  ];

  HB.router.register({
    id: 'sys-notifications', route: '#/system/notifications', group: 'System', title: 'Notification log', navLabel: 'Notifications', filters: [],
    subtitle: 'The emails Neo ERP would send',
    render: function (rootEl, ctx) {
      var st = ctx.state, list = HB.data.notify.list();            /* newest first: call, draw, forget */
      st.list = st.list || {};

      rootEl.appendChild(forms.docList({
        state: st.list, rows: list, columns: COLUMNS,
        title: fmt.num(list.length) + (list.length === 1 ? ' email' : ' emails') + ' Neo ERP would send',
        subtitle: 'By kind, newest first, with the document each concerns.',
        groups: KINDS.map(function (k) { return { id: k.id, label: k.label, test: function (n) { return n.kind === k.id; } }; }),
        search: ['subject', 'text', 'toName', 'toRoleLabel', 'to', 'docId', 'kindLabel'], searchPlaceholder: 'Search the emails',
        empty: 'No email of this kind to send as the books stand',
        onOpen: false
      }));
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
