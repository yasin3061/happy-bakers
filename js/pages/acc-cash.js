/*
 * Cash and bank (#/accounts/cash). What each cash point and the bank hold now, the book of one account with a
 * running balance for the range, the deposits of cash in the bank with their form and their view, and the opening
 * balances of go-live.
 * Built on the pattern of js/pages/buy-orders.js (docs/PAGES.md). Balances, the rows of a book and whether a cash
 * point covers a deposit are the data layer's and the engine's; the page holds the wording and the layout.
 */
(function (root) {
  'use strict';

  var HB = root.HB;
  if (!HB || !HB.router || !HB.ui || !HB.forms) return;
  var ui = HB.ui, forms = HB.forms, fmt = HB.fmt;

  var ROUTE = '#/accounts/cash';

  function day(iso) { return ui.format('date', iso); }
  function accountName(id) { return id ? HB.data.lookup.account(id).name : ''; }
  function rupees(key) { return function (row) { return typeof row[key] === 'number' ? HB.money.toRupees(row[key]) : ''; }; }
  /** What every account in scope holds now. */
  function balanceRows() { return HB.data.cash.balances().rows; }
  function balanceOf(id) {
    var row = balanceRows().filter(function (r) { return r.accountId === id; })[0];
    return row ? row.balance : null;
  }
  /** The cash points a deposit may be taken from: those of the persona's scope. Any other the engine refuses. */
  function cashAccounts() { return HB.data.lookup.accounts({ kind: 'cash' }); }
  /** The account every deposit goes into, by the name the masters give it. */
  function bankName() {
    var b = (HB.masters.accounts || []).filter(function (a) { return a.kind !== 'cash'; })[0];
    return b ? b.name : 'the bank';
  }
  /** The range of the filter bar as the selectors take it. */
  function rangeOf(ctx) { return { from: ctx.filters.from, to: ctx.filters.to }; }

  /* ------------------------------------------------------ what a deposit moves */

  /** Read before and after the engine acts: the balances in scope. */
  function snapshot() { return balanceRows(); }

  /** The one line of the toast: each account in scope that moved, as the selector returned it before and returns it now. */
  function movedText(before, cancelled) {
    var moved = forms.changes(before, balanceRows(), 'accountId', 'balance');
    var parts = moved.map(function (c) { return c.row.name + ': ' + fmt.inr2(c.before) + ' to ' + fmt.inr2(c.after) + '.'; });
    /* a store manager sees the store's cash only: say where the other half went */
    if (!moved.some(function (c) { return c.row.kind !== 'cash'; })) {
      parts.push(cancelled ? 'The same amount has left ' + bankName() + '.' : 'The same amount is now in ' + bankName() + '.');
    }
    return parts.join(' ');
  }

  /* ------------------------------------------------------------------ list */

  /** The accounts whose book can be read: every one in scope, a closed store's too. */
  function bookAccounts() { return HB.data.lookup.accounts({ active: 'all' }); }

  /* Coming to the screen from another one starts afresh: a book chosen on an earlier visit is not kept (below). */
  var arrived = true, here = false;
  if (HB.bus && typeof HB.bus.on === 'function') {
    HB.bus.on('route:changed', function (e) {
      var mine = !!(e && e.page && e.page.id === 'acc-cash');
      if (mine && !here) arrived = true;
      here = mine;
    });
  }

  /** The account in scope whose book has the newest row of the range: where money moved last. Null when none moved. */
  function movedLast(accounts, range) {
    var best = null, seq = -1;
    accounts.forEach(function (a) {
      var rows = HB.data.cash.book(a.id, range).rows, last = rows.length ? rows[rows.length - 1] : null;
      if (last && last.seq > seq) { seq = last.seq; best = a.id; }
    });
    return best;
  }

  /**
   * The account whose book is shown: the one the link names ('?account=<id>'); else the one chosen on the screen
   * during this visit; else the one where money moved last, so that a receipt, a payment or a deposit just posted
   * is in sight on arrival; else the first in scope. The link decides while it names an account, so the same link
   * opens the same book every time; a choice made on the screen rewrites the link (pick).
   */
  function chosen(st, ctx, accounts) {
    var asked = ctx.params.account || null;
    if (arrived) { arrived = false; st.picked = null; }
    if (asked !== st.asked) { st.asked = asked; if (asked) { st.tab = 'book'; st.book = {}; } }   /* a link opens on the book, once: the tabs stay free */
    var want = asked || st.picked || movedLast(accounts, rangeOf(ctx));
    var acc = accounts.filter(function (a) { return a.id === want; })[0] || accounts[0] || null;
    if (acc && st.accountId !== acc.id) st.book = {};
    st.accountId = acc ? acc.id : null;
    return acc;
  }

  /** The book of another account, chosen on the screen. */
  function pick(st, ctx, id) {
    st.picked = id; st.accountId = id; st.tab = 'book'; st.book = {};
    if (ctx.params.account && ctx.params.account !== id) { st.asked = id; HB.router.navigate(ROUTE, { account: id }); return; }
    ctx.rerender();
  }

  function start(st, ctx) {
    var cash = cashAccounts();
    var from = cash.filter(function (a) { return a.id === st.accountId; })[0] || (cash.length === 1 ? cash[0] : null);
    st.form = forms.draft(from ? { values: { fromAccount: from.id } } : null);
    ctx.rerender();
  }

  function balanceTiles(st, ctx) {
    var row = ui.kpiRow(balanceRows().map(function (r) {
      var below = r.balance < 0;
      return {
        label: r.name, icon: r.kind === 'cash' ? 'wallet' : 'building', value: fmt.inr2(r.balance), tone: below ? 'critical' : null,
        sub: below ? 'Below zero after a cancellation' : (r.accountId === st.accountId ? 'Its book is shown below' : 'Show its book'),
        onClick: function () { pick(st, ctx, r.accountId); }
      };
    }));
    row.classList.add('cash-tiles');   /* css/pages/p-acc-cash.css: room for a balance to the paisa */
    return row;
  }

  /**
   * The deposits of the range: the deposit rows of the books in scope, each once, with the document behind it.
   * (There is no list selector for deposits; the cash book has every one of them.)
   */
  function deposits(f) {
    var seen = {}, out = [];
    bookAccounts().forEach(function (a) {
      HB.data.cash.book(a.id, f).rows.forEach(function (r) {
        if (r.type !== 'DEP' || r.reversal || seen[r.docId]) return;
        var d = HB.data.doc.get(r.docId);
        if (!d) return;
        seen[r.docId] = true;
        out.push({
          id: d.id, seq: r.seq, date: d.date, status: d.status, fromName: accountName(d.fromAccount), slipRef: d.slipRef || '',
          amount: d.amount, createdByName: HB.data.lookup.enteredBy(d), note: d.note || ''
        });
      });
    });
    return out.sort(function (x, y) { return x.date !== y.date ? (x.date < y.date ? 1 : -1) : y.seq - x.seq; });   /* newest first */
  }

  function depositsList(st, rows) {
    st.deposits = st.deposits || {};
    return forms.docList({
      state: st.deposits, rows: rows, title: 'Cash deposits', subtitle: 'Cash taken to ' + bankName() + ', by the date of the deposit',
      statuses: ['POSTED', 'CANCELLED'],
      search: ['id', 'fromName', 'slipRef', 'createdByName', 'note'], searchPlaceholder: 'Search deposits', sort: { key: 'date', dir: 'desc' },
      empty: 'No deposit in this range',
      columns: [
        { key: 'id', label: 'Deposit' },
        { key: 'date', label: 'Deposited on', format: 'date' },
        { key: 'fromName', label: 'Taken from', maxWidth: 200 },
        { key: 'slipRef', label: 'Slip reference', maxWidth: 160 },
        { key: 'amount', label: 'Amount', format: 'inr2' },
        { key: 'status', label: 'Status', render: ui.cells.status() }
      ]
    });
  }

  /** The book of one account: opening balance, money in and out and closing balance of the range, then every row. */
  function bookSection(st, ctx, accounts, acc) {
    var b = HB.data.cash.book(acc.id, rangeOf(ctx)), label = HB.filters.rangeLabel(b);
    /* a cancellation reads "Cancellation of <id>: <reason>" with what it took back beneath; the selector's rows stay as they are */
    var rows = b.rows.map(function (r) {
      return {
        date: r.date, docId: r.docId, what: r.reversal ? r.note : r.kindLabel,
        about: r.reversal ? [r.kindLabel, r.party].filter(Boolean).join(', ') : r.party,
        'in': r['in'], out: r.out, balance: r.balance
      };
    });
    function money(v) { return v ? fmt.inr2(v) : ''; }
    var columns = [
      { key: 'date', label: 'Date', format: 'date' },
      /* an id is a link when the persona may open the document; the opening entry is the Owner's and accounts' */
      { key: 'docId', label: 'Document', render: function (v) { return HB.data.doc.get(v) ? forms.docLink(v) : String(v || ''); } },
      { key: 'what', label: 'What', render: ui.cells.twoLine('about', { maxWidth: 300 }) },
      { key: 'about', label: 'About', hidden: true },                      /* the second line of "What": a column of its own in the CSV */
      { key: 'in', label: 'Money in', align: 'right', format: money, value: rupees('in') },
      { key: 'out', label: 'Money out', align: 'right', format: money, value: rupees('out') },
      { key: 'balance', label: 'Balance', format: 'inr2', value: rupees('balance') }
    ];
    var shown = columns.filter(function (c) { return !c.hidden; });
    function csv() {
      var all = [{ date: b.from, what: 'Opening balance', balance: b.opening }].concat(rows,
        [{ date: b.to, what: 'Closing balance', 'in': b.totalIn, out: b.totalOut, balance: b.closing }]);
      ui.downloadCsv('cash-book-' + acc.id + '.csv', columns, all);
    }
    var pick = accounts.length > 1 ? ui.select({
      size: 'sm', ariaLabel: 'Account', value: acc.id,
      options: accounts.map(function (a) { return { value: a.id, label: a.active ? a.name : a.name + ' (closed)' }; }),
      onChange: function (id) { pick(st, ctx, id); }
    }) : null;

    st.book = st.book || {};
    return [
      ui.sectionTitle('Book of ' + acc.name, label, pick),
      ui.kpiRow([
        { label: 'Opening balance', value: fmt.inr2(b.opening), sub: 'Before ' + day(b.from) },
        { label: 'Money in', value: fmt.inr2(b.totalIn), sub: label },
        { label: 'Money out', value: fmt.inr2(b.totalOut), sub: label },
        { label: 'Closing balance', value: fmt.inr2(b.closing), sub: 'At the end of ' + day(b.to), tone: b.closing < 0 ? 'critical' : null }
      ]),
      forms.docList({
        /* the newest on top, so that what was posted last is the first row seen; the CSV runs oldest first, opening to closing */
        state: st.book, rows: rows.slice().reverse(), columns: shown, onOpen: false, sortable: false,
        title: 'Receipts, payments and deposits', subtitle: 'Newest first. Each row carries the balance after it.',
        search: ['docId', 'what', 'about'], searchPlaceholder: 'Search this book', empty: 'Nothing moved in this account in this range',
        actions: ui.button({ label: 'CSV', icon: 'download', size: 'sm', onClick: csv })
      })
    ];
  }

  function list(rootEl, ctx) {
    var st = ctx.state, may = HB.session.can('dep.create');
    var accounts = bookAccounts(), acc = chosen(st, ctx, accounts);
    if (!acc) {
      rootEl.appendChild(ui.emptyState('No cash or bank account for this role', 'The book of an account is shown to those who handle it.', { icon: 'wallet' }));
      return;
    }
    var deps = deposits(rangeOf(ctx));
    if (st.tab !== 'deposits') st.tab = 'book';

    ui.append(rootEl,
      ui.sectionTitle('Balances now', accounts.length > 1 ? 'What each cash point and the bank hold' : 'What the cash point holds',
        ui.button({ label: 'Deposit cash in the bank', icon: may.ok ? 'coins' : 'lock', variant: 'primary', disabledReason: may.ok ? '' : may.reason,
          onClick: function () { start(st, ctx); } })),
      balanceTiles(st, ctx),
      ui.tabs({
        ariaLabel: 'Cash and bank', value: st.tab,
        items: [{ id: 'book', label: 'Cash and bank book' }, { id: 'deposits', label: 'Deposits', count: deps.length }],
        onChange: function (id) { st.tab = id; ctx.rerender(); }
      }),
      st.tab === 'deposits' ? depositsList(st, deps) : bookSection(st, ctx, accounts, acc),
      forms.teaser({ title: 'Bank feed and reconciliation; Tally or Zoho Books sync', tier: 'iNeo' }));
  }

  /* ------------------------------------------------------------------ form */

  /** draft -> the payload of docs/API.md 3.5. */
  function payload(draft) {
    var v = draft.values;
    return { date: v.date, fromAccount: v.fromAccount, amount: v.amount, slipRef: v.slipRef, note: v.note };
  }

  function form(rootEl, ctx) {
    var st = ctx.state, may = HB.session.can('dep.create');
    rootEl.appendChild(forms.docForm({
      title: 'Deposit cash in the bank', state: st.form, backLabel: 'Back to cash and bank', submitLabel: 'Post deposit',
      submitReason: may.ok ? '' : may.reason,
      fields: [
        { key: 'fromAccount', label: 'Take the cash from', type: 'select', required: true, span: 2, rebuild: true, placeholder: 'Choose a cash point',
          options: function () {
            var list = cashAccounts().map(function (a) { return { value: a.id, label: a.name + ', ' + fmt.inr2(balanceOf(a.id)) + ' in it now' }; });
            /* a draft begun by another persona may name a cash point this one does not handle: it stays in the list,
               by name only, so that the field shows what the draft holds and the engine's refusal stands beside it */
            var held = st.form.values.fromAccount;
            if (held && !list.some(function (x) { return x.value === held; })) list.push({ value: held, label: accountName(held) });
            return list;
          } },
        { key: 'date', label: 'Deposited on', type: 'date', required: true },
        { key: 'amount', label: 'Amount', type: 'amount', required: true, hint: 'At most what the cash point holds now' },
        { key: 'slipRef', label: 'Slip reference', optional: true, span: 2, maxLength: 40, placeholder: 'The number on the deposit slip of the bank' },
        { key: 'note', label: 'Note', optional: true, span: 2, maxLength: 200 }
      ],
      panel: function (p) {
        var doc = p && p.ok ? p.doc : null;
        if (doc) return ui.callout('good', 'Posts as it is entered',
          fmt.inr2(doc.amount) + ' leaves ' + accountName(doc.fromAccount) + ' and goes into ' + bankName() + '. A deposit moves money between cash points: it is neither income nor expense.');
        return ui.callout('neutral', 'A deposit moves cash to the bank',
          'Choose the cash point and enter the amount, at most what the cash point holds now. A deposit is neither income nor expense.');
      },
      totals: function (p, d) {
        var doc = p && p.ok ? p.doc : null, from = d.values.fromAccount;
        return [
          from && balanceOf(from) !== null ? { label: 'In ' + accountName(from) + ' now', value: fmt.inr2(balanceOf(from)), tone: 'muted' } : null,
          { label: 'Amount deposited', sub: 'into ' + bankName(), value: doc ? fmt.inr2(doc.amount) : '-', strong: true, rule: !!from }
        ].filter(Boolean);
      },
      onPreview: function (d) { return HB.engine.preview('DEP', payload(d)); },
      onSubmit: function (d) {
        var before = snapshot();                      /* read the selector, act, read it again: that is what moved */
        var res = HB.engine.act('post', { type: 'DEP', payload: payload(d) });
        if (!res.ok) return res;                      /* the form shows the refusal at the field it names */
        st.form = null;
        st.tab = 'deposits';                          /* the way back lands on the list that now holds it */
        forms.postedToast(res.doc, movedText(before, false));
        ctx.openDoc(res.doc.id);
        return res;
      },
      onCancel: function () { st.form = null; ctx.rerender(); }
    }));
  }

  /* ------------------------------------------------------------------ view */

  /** The opening balances of go-live: one entry, never cancelled. */
  function openingView(rootEl, ctx, v) {
    rootEl.appendChild(forms.docView({
      title: forms.docTitle(v), subtitle: 'Cash and bank at go-live', status: v.status,
      onBack: ctx.closeDoc, backLabel: 'Back to cash and bank',
      meta: [['Dated', day(v.date)], ['Note', v.note || null]],
      lines: {
        title: 'Opening balances',
        columns: [{ key: 'accountName', label: 'Account' }, { key: 'amount', label: 'Balance', format: 'inr2' }],
        rows: v.lines, footer: typeof v.amount === 'number' ? { accountName: 'Total', amount: v.amount } : null
      },
      related: forms.relatedOf(v.id), timeline: forms.timelineOf(v.id), actions: forms.docActions({ view: v })
    }));
  }

  function view(rootEl, ctx) {
    var v = HB.data.doc.view(ctx.docId);
    if (v && v.type === 'OPENCASH') { openingView(rootEl, ctx, v); return; }
    if (!v || v.type !== 'DEP') { rootEl.appendChild(forms.missingDoc(ctx.docId, { onBack: ctx.closeDoc, backLabel: 'Back to cash and bank' })); return; }
    var d = v.doc, from = accountName(d.fromAccount);
    rootEl.appendChild(forms.docView({
      title: forms.docTitle(v), subtitle: from + ' to ' + bankName(), status: v.status,
      onBack: ctx.closeDoc, backLabel: 'Back to cash and bank', notice: forms.docNotice(v),
      meta: [['Taken from', from], ['Paid into', bankName()], ['Deposited on', day(v.date)], ['Slip reference', d.slipRef || null],
        ['Entered by', v.createdByName], ['Note', v.note || null]],
      lines: {
        title: 'What it moves',
        columns: [{ key: 'from', label: 'Out of' }, { key: 'to', label: 'Into' }, { key: 'amount', label: 'Amount', format: 'inr2' }],
        rows: [{ from: from, to: bankName(), amount: v.amount }]
      },
      totals: [{ label: 'Amount deposited', sub: 'a transfer between cash points, not income or expense', value: fmt.inr2(v.amount), strong: true }],
      related: forms.relatedOf(v.id), timeline: forms.timelineOf(v.id),
      actions: forms.docActions({
        view: v, labels: { cancel: 'Cancel the deposit' },
        ask: { cancel: 'The money goes back from ' + bankName() + ' into ' + from + '. The cancellation is a document of its own, dated today, with the reason you give.' },
        before: snapshot,
        moved: function (op, res, before) { return op === 'cancel' ? movedText(before, true) + ' ' + res.doc.id + ' records the cancellation.' : ''; }
      })
    }));
  }

  /* ------------------------------------------------------------------ page */

  HB.router.register({
    id: 'acc-cash', route: ROUTE, group: 'Accounts', title: 'Cash and bank', filters: ['date'],
    subtitle: 'Balances and deposits',
    render: function (rootEl, ctx) {
      if (ctx.docId) return view(rootEl, ctx);
      if (ctx.state.form) return form(rootEl, ctx);
      list(rootEl, ctx);
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
