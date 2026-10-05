# Writing a page

For whoever writes or changes a screen. All 36 are built; two are the pattern: `js/pages/buy-orders.js` (list, form,
view) and `js/pages/buy-receipts.js` (a form opened from another document, a toast that says what moved). Copy their shape, not
their wording. Shapes of selectors and engine calls: `docs/API.md`. The kit: `docs/shell/UI-API.md`, and the developer page `tools/harness/styleguide.js` (its first lines say how to load it).

A page is one file, `js/pages/<id>.js`, one IIFE that calls `HB.router.register`. It never edits `index.html`, the shell, the
kit, the engine or the config. If the kit is wrong or two pages repeat the same lines, say so: the fix belongs in `js/core/forms.js`.

## 1. A document page

Trimmed from `js/pages/buy-orders.js`; every call below is in that file and runs.

```js
(function (root) {
  'use strict';
  var HB = root.HB;
  if (!HB || !HB.router || !HB.ui || !HB.forms) return;
  var ui = HB.ui, forms = HB.forms, fmt = HB.fmt;
  var OPEN = ['PENDING', 'APPROVED', 'PART_RECEIVED'];
  function limit() { return fmt.inrFull(HB.masters.limits.poAutoApprove); }   // a figure in a sentence still comes from the masters

  function list(rootEl, ctx) {
    var st = ctx.state, may = HB.session.can('po.create');
    st.list = st.list || {};                                   // tab, search, sort and page live here
    // open documents are listed whatever the date range says; the range limits the finished ones
    var rows = forms.uniqueRows(HB.data.buy.orders({ status: OPEN }), HB.data.buy.orders(ctx.filters));
    rootEl.appendChild(forms.docList({
      state: st.list, rows: rows, statuses: ['PENDING', 'APPROVED', 'PART_RECEIVED', 'RECEIVED', 'REJECTED', 'CANCELLED'],
      search: ['id', 'vendorName', 'note'], searchPlaceholder: 'Search orders', sort: { key: 'date', dir: 'desc' },
      columns: [
        { key: 'id', label: 'Order' },                         // the id column is a link; the row opens '#/doc/<id>' too
        { key: 'date', label: 'Date', format: 'date' },
        { key: 'vendorName', label: 'Vendor', maxWidth: 240 },
        { key: 'total', label: 'Value', format: 'inr2' },
        { key: 'status', label: 'Status', render: ui.cells.status() }
      ],
      newLabel: 'New purchase order', newReason: may.ok ? '' : may.reason,
      onNew: function () { st.form = forms.draft(); ctx.rerender(); }
    }));
  }

  function payload(draft, form) {                              // draft -> the payload of docs/API.md 3.5
    var v = draft.values;
    return { date: v.date, vendorId: v.vendorId, expectedDate: v.expectedDate, note: v.note,
      lines: form.lines().map(function (l) { return { itemId: l.itemId, qty: l.qty, rate: l.rate }; }) };   // empty lines left out
  }

  function form(rootEl, ctx) {
    var st = ctx.state, may = HB.session.can('po.create');
    rootEl.appendChild(forms.docForm({
      title: 'New purchase order', state: st.form, backLabel: 'Back to orders', submitLabel: 'Submit order',
      submitReason: may.ok ? '' : may.reason,                  // a persona that may not post sees the form, locked, with the reason
      fields: [
        { key: 'vendorId', label: 'Vendor', type: 'party', kind: 'vendor', required: true, span: 2, rebuild: true },
        { key: 'date', label: 'Order date', type: 'date', required: true },      // starts on the business date
        { key: 'expectedDate', label: 'Expected on', type: 'date', max: null }
      ],
      lines: { title: 'Items', addLabel: 'Add item', minRows: 1, columns: [
        { key: 'itemId', label: 'Item', type: 'item', kind: ['rm', 'pk'], required: true,
          onChange: function (row, id) { row.rate = id ? (HB.engine.price(id) || null) : null; } },   // prefill from the engine
        { key: 'qty', label: 'Quantity', type: 'qty', required: true, unit: function (row) { return row.itemId ? HB.data.lookup.item(row.itemId).unit : ''; } },
        { key: 'rate', label: 'Rate', type: 'rate', required: true },
        { key: 'amount', label: 'Amount', type: 'computed', format: 'inr2', footer: 'sum',             // the one sum a page may do
          value: function (row) { return row.qty > 0 && row.rate > 0 ? HB.money.amount(row.qty, row.rate) : null; } }
      ] },
      panel: function (p) {                                    // where it will land, before posting: preview.outcome
        var o = p && p.ok ? p.outcome : null;
        if (!o) return ui.callout('neutral', 'Approval', 'An order up to ' + limit() + ' is approved as it is submitted.');
        return o.waits ? ui.callout('warn', 'Waits for the Owner, above the limit', 'This order is above ' + limit() + '.')
          : ui.callout('good', 'Approved as submitted', 'This order is within the limit of ' + limit() + '.');
      },
      totals: function (p) {
        var doc = p && p.ok ? p.doc : null;                    // the engine's figures, or a dash while the draft is incomplete
        return [{ label: 'Order value', sub: 'before GST', value: doc ? fmt.inr2(doc.total) : '-', strong: true }];
      },
      onPreview: function (draft, f) { return HB.engine.preview('PO', payload(draft, f)); },
      onSubmit: function (draft, f) {
        var res = HB.engine.act('post', { type: 'PO', payload: payload(draft, f) });
        if (!res.ok) return res;                               // the form puts the refusal at the field it names
        st.form = null;                                        // 1 clear the draft  2 toast  3 open the document
        forms.postedToast(res.doc, res.doc.status === 'PENDING' ? 'Above the limit of ' + limit() + ': it waits for the Owner.'
          : 'Within the limit of ' + limit() + ': approved as submitted. Stock moves when the goods are received.');
        ctx.openDoc(res.doc.id);
        return res;
      },
      onCancel: function () { st.form = null; ctx.rerender(); }
    }));
  }

  function view(rootEl, ctx) {
    var v = HB.data.doc.view(ctx.docId);                       // labels, party, lines with names and units, actions with reasons
    if (!v || v.type !== 'PO') { rootEl.appendChild(forms.missingDoc(ctx.docId, { onBack: ctx.closeDoc, backLabel: 'Back to orders' })); return; }
    var actions = forms.docActions({                           // approve, reject, cancel: through the engine, disabled with the reason
      view: v, labels: { cancel: 'Cancel the order' },
      moved: function (op, res) { return op === 'approve' ? 'Goods can now be received against it.' : ''; }
    });
    actions.unshift({ label: 'Receive goods', icon: 'box', variant: 'primary', reason: '' /* HB.engine.check(...) message, see the file */,
      onClick: function () { forms.startDraft('buy-receipts', { values: { poId: v.id } }); } });
    rootEl.appendChild(forms.docView({
      title: forms.docTitle(v), subtitle: v.party.name, status: v.status, onBack: ctx.closeDoc, backLabel: 'Back to orders',
      notice: forms.docNotice(v, { waiting: 'It is above ' + limit() + ', the limit up to which an order is approved as it is submitted.' }),
      meta: [['Vendor', v.party.name], ['Order date', ui.format('date', v.date)], ['Raised by', v.createdByName], ['Note', v.note || null]],
      lines: { title: 'Items', rows: v.lines, footer: { itemName: 'Total', amount: v.amount }, columns: [
        { key: 'itemName', label: 'Item' }, { key: 'qty', label: 'Ordered', format: 'qty' }, { key: 'received', label: 'Received', format: 'qty' },
        { key: 'rate', label: 'Rate', format: 'rate' }, { key: 'amount', label: 'Amount', format: 'inr2' }] },
      totals: [{ label: 'Order value', sub: 'before GST', value: fmt.inr2(v.amount), strong: true }],
      related: forms.relatedOf(v.id), timeline: forms.timelineOf(v.id), actions: actions
    }));
  }

  HB.router.register({
    id: 'buy-orders', route: '#/buy/orders', group: 'Buy', title: 'Purchase orders', filters: ['date'],
    render: function (rootEl, ctx) {
      if (ctx.docId) return view(rootEl, ctx);                 // '#/doc/PO-...': the hash decides
      if (ctx.state.form) return form(rootEl, ctx);            // a draft is open
      list(rootEl, ctx);
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
```

## 2. A read-only figures page

A report, a register, a balance list: filters in, one selector call, tiles, one table, CSV. Run as written in the harness
against `HB.data.buy.register`; replace the selector and the columns.

```js
function rupees(key) { return function (row) { return HB.money.toRupees(row[key]); }; }   // paise stay paise except in a CSV
HB.router.register({
  id: 'x-register', route: '#/x/register', group: 'Reports', title: 'Purchase register', filters: ['date'],
  render: function (rootEl, ctx) {
    var st = ctx.state, res = HB.data.buy.register(ctx.filters);      // { from, to, rows, totals }: call, draw, forget
    var columns = [
      { key: 'date', label: 'Date', format: 'date' },
      { key: 'docId', label: 'Bill', doc: true },                      // a document id is a link
      { key: 'vendorName', label: 'Vendor', maxWidth: 260 },
      { key: 'taxable', label: 'Taxable', format: 'inr2', value: rupees('taxable') },   // value(): what the CSV carries
      { key: 'total', label: 'Total', format: 'inr2', value: rupees('total') }
    ];
    ui.append(rootEl,
      ui.kpiRow([{ label: 'Purchases before GST', value: fmt.inr(res.totals.taxable), sub: HB.filters.rangeLabel(res) },
        { label: 'Billed', value: fmt.inr(res.totals.total) }]),       // no delta, no spark: nothing compares periods
      ui.card({ title: 'Vendor bills', flush: true,
        actions: ui.button({ label: 'CSV', icon: 'download', size: 'sm', onClick: function () { ui.downloadCsv('purchase-register.csv', columns, res.rows); } }),
        body: ui.table({ columns: columns, rows: res.rows, dense: true, maxHeight: 560, empty: 'No vendor bill in this range',
          sortable: true, sort: st.sort, onSort: function (s) { st.sort = s; },         // the sort survives a redraw
          footer: { date: 'Total', taxable: res.totals.taxable, total: res.totals.total } }) }));
  }
});
```

A tile takes no delta and no spark. The landing dashboard (`js/pages/home.js`) is the one place whose tiles carry a
small chart: the days of the range of the filter bar, or its months, from `HB.data.dash.period(f).points`, drawn with
`HB.charts.sparkline` (`fluid`, `labels`: CHARTS-API section 6) and appended to the tile. It shows that range and nothing
else, never a change against another period; no other screen puts a chart in a tile.

## 3. Conventions

**State.** Everything the user has done and not posted lives in `ctx.state` (per route, kept across redraws, persona switches
and navigation, lost on reload): `st.list` for the list, `st.form` for the draft, `st.sort`, `st.tab`. `render` reads the data
layer afresh on every run and keeps no selector result between runs. `render` never writes the store. The hash decides list or
document (`ctx.docId`); the draft decides list or form.

**Preview and act.** One `payload(draft, form)` function feeds both `onPreview` (return `HB.engine.preview(type, payload)`) and
`onSubmit` (return `HB.engine.act('post', {type, payload})`). Totals, tax, limits, shares and where the document will land
(`preview.outcome`: `{status, waits, self}`) are read from the preview, never worked out. The one sum a page may do is
`HB.money.amount(qty, rate)` for the value of a line as it is typed. A figure in a sentence comes from the data layer too
(`fmt.inrFull(HB.masters.limits.poAutoApprove)`).

**Errors and warnings.** Name fields and columns after the payload (`vendorId`, `lines[i].qty`) and the form shows each refusal
where it belongs: under the field, under the line, or in the action bar with a link to `error.docId`. Do not test rights, dates
or stock in the page. `warnings` (a figure that looks wrong, still postable: API 3.3) show by themselves, beside the input each
names and once more above the bar; they never lock the button, and a page adds nothing for them. An action on a posted document
that the engine refuses shows `forms.fail` (done by `docActions`).

**The toast.** After a success: `st.form = null`, then `forms.postedToast(res.doc, line)`, then `ctx.openDoc(res.doc.id)`. The
line says what moved, in one or two short sentences, most important first: "Raw stock up: 300 kg of Maida. Purchase price:
Maida ₹38.80 to ₹39.25. Product cost: Sandwich bread ₹14.914 to ₹15.0369 and 16 more." Its figures have three sources and no
other: the document the engine returned (`res.doc.lines`), names from `HB.data.lookup`, and for anything derived the selectors
read before and after: `var before = HB.data.stock.onHand(ids); var res = HB.engine.act(...); forms.changes(before,
HB.data.stock.onHand(ids), 'itemId', 'rate')` gives the rows that changed (`buy-receipts.js`, `snapshot` and `movedText`). A
document that moves nothing says where it landed and when something will move.

**Disabled actions.** Nothing a persona may not do is hidden. "New": `newReason: HB.session.can('x.create').reason`. The form:
`submitReason`. Approve, reject, cancel, confirm: `forms.docActions`, which takes the reason from the rights or from
`HB.engine.check`. An action of your own: `reason: HB.engine.check(op, args)` message when the state matters (see `receiveAction`).

**Dates.** A `'date'` field starts on the business date and is bounded by it; pass `max: null` for a date that may lie ahead.
Show dates with `ui.format('date', iso)` or `format: 'date'`. Never read the clock.

**Opening a document.** Any id on screen is a link: `doc: true` on a table column, `forms.docLink(id)` elsewhere. Open one with
`ctx.openDoc(id)`. The router sends `#/doc/<id>` to the page that owns the type (UI-API 1.2) with `ctx.docId`; a cancellation
id opens the document it cancelled. Draw `forms.missingDoc` when `HB.data.doc.view(id)` is null or of another type. To start
another page's form from a document: `forms.startDraft('buy-receipts', { values: { poId: id } })`; that page fills the rest.

**Naming.** Page id = file name = SPEC section 9. Functions `list`, `form`, `view`, `payload`. Labels: "New purchase order",
"Back to orders", "Submit order" / "Post receipt", "Cancel the order". Plain, active, no jargon, no exclamation marks.

**CSS.** None, if you can: the two pages have no stylesheet. Otherwise `css/pages/p-<id>.css`, every selector under `.pg-<id>`,
colours as `var(--token)` only. Never restyle `mk-*` classes.

## 4. What the kit gives (do not rebuild)

| Need | Use |
|---|---|
| List with tabs, search, paging, "New" | `forms.docList` (`groups` for tabs that are not statuses) |
| Form with header fields, line grid, totals, errors, action bar, draft, focus | `forms.docForm`; a sheet of whole numbers: `matrix` |
| View with status, notice, meta, lines, totals, related, history, actions | `forms.docView` + `docNotice`, `relatedOf`, `timelineOf`, `docActions` |
| Reason dialog, posted toast, refusal toast | `forms.confirmWithReason` (inside `docActions`), `postedToast`, `fail` |
| Pickers for items, parties, anything | `type: 'item' \| 'party' \| 'picker'`, with `filter` and `options` |
| Quantities, rates, amounts typed in | `type: 'qty' \| 'rate' \| 'amount'`: they hand you units, paise per unit, paise |
| Status chips, tiles, tables, CSV, callouts, drawers | `ui.statusChip`, `ui.kpiRow`, `ui.table`, `ui.downloadCsv`, `ui.callout`, `ui.drawer` |
| Teaser card, printing | `forms.teaser`, `forms.printSheet`, `forms.printDoc` |
| Names of masters | `HB.data.lookup.item(id).name`, `.unit`; lists for pickers come from `HB.masters` through the kit |

## 5. Pitfalls we hit

- A list filtered by "This month" hides last month's open documents on the first of the month. Join the open ones in
  (`forms.uniqueRows`), and say so in the list's `subtitle`.
- `HB.data.doc.view(id)` has the lines with `itemName` and `unit`, `party`, `amount`, `actions`; fields it does not lift are on
  `v.doc` (read-only: `v.doc.expectedDate`). Flags of the list row (`late`, `receivedPct`) are not on the view: ask the list
  selector for that one day, `HB.data.buy.orders({ from: v.date, to: v.date })`, and pick the row.
- Selector results are shared and read-only: `rows.slice().sort(...)`, never `rows.sort(...)`.
- A `docForm` outlives a rebuild of its fields. Read the draft inside callbacks (`orderOf(draft)`), not a variable captured when
  `render` ran. Keep in the draft only what the user types (`itemId`, `qty`); show the rest through `value(row)` from a selector,
  so it is never stale. Prefill lines once per key (`draft.linesFor`), or every redraw wipes what was typed.
- `form.lines()` leaves out a line whose editable cells are all empty. A cleared quantity is `null`: send `l.qty || 0` where the
  engine wants a number. The engine may drop lines, so the previewed document's lines do not line up with the grid by number:
  match them by `itemId`.
- Location, unit and account ids are never typed: `HB.data.lookup.locations({ kind: 'rm' })`. `tools/harness/lint.js` flags them.
- `HB.engine.act` already redraws the screen (store change, 60 ms). Do not call `ctx.rerender()` after it.
- With `submitReason` set, the preview's `role` refusal is not repeated; any other refusal still shows.
- At 1024px a table scrolls sideways: at most seven columns, `maxWidth` on names, the action column last.
- `index.html` lists every page file and page stylesheet, and all of them exist. A file it names that does not load is a page
  error: the harness counts it, and SPEC section 12 allows no console message.
- With `--size=1024x768` the picture is taken at 1024 wide, but the steps run inside Chrome's window frame, at 1006 wide, where
  the sidebar is already collapsed. Steps that measure the layout at a true 1024 need `--size=1042x864`.

## 6. Testing a page without a human

`tools/harness/run.js` opens the real app from `file://` in headless Chrome, runs your steps against the DOM, prints checks and
any page error, and exits 1 on failure. The scratch page and Chrome's `--user-data-dir` live in `<temp>/hb-harness/<name>/`, so
give every run your own `--name` (default: the steps file's name) and ten people never share storage.

```
node tools/check.js a s                                                   the data layer still passes on the tiny company (seconds)
node tools/check.js                                                       the whole self-check, full seed included (about two minutes)
node tools/harness/run.js my/steps.js --name=sell-returns --date=2026-10-02   one run, a fresh copy dated 2 Oct 2026
node tools/harness/run.js my/reload.js --name=sell-returns --keep          second run on the same storage: a reload keeps it
node tools/harness/run.js my/steps.js --seed=off                           without js/data/seed.js (if it is broken that day)
node tools/harness/run.js my/steps.js --shot=out.png --size=1024x768       a picture of the last screen, at the smallest width
node tools/harness/lint.js js/pages/sell-returns.js css/pages/p-sell-returns.css   the house rules a machine can read
```

A steps file is plain browser JavaScript (keep yours outside the project or delete them; they are not part of the site):

```js
HBT.run(async function (t) {
  await t.as('u_stores');                                  // u_owner u_accounts u_stores u_production u_sales u_store_mgr
  await t.go('#/buy/orders');
  await t.click('New purchase order');                     // a button, link, tab or list row by its text, or a CSS selector
  await t.pick(t.field('vendorId'), 'Godhumvan');          // a type-ahead: type, take the first row
  await t.pick(t.cell(0, 'itemId'), 'Maida');              // t.field(key), t.cell(line, column) address a docForm
  await t.type(t.cell(0, 'qty'), '500');
  t.has('Approved as submitted', 'the outcome shows before posting');
  await t.click('Submit order');
  t.eq(t.hash(), '#/doc/PO-U-0001', 'posting opens the new order');
  t.eq(HB.engine.price('RM01') > 0, true, 'read the engine to check a figure');
  t.note('toast', t.toasts().slice(-1)[0]);                // printed, not checked
  await t.as('u_sales'); await t.go('#/doc/PO-U-0001');
  t.ok(t.text().indexOf('PO-U-0001') === -1, 'sales cannot open it');
});
```

Also `t.text(sel)`, `t.find`, `t.all`, `t.settle()` (wait for the redraw and the preview), `t.click(text, scopeElement)` for a
dialog (`t.find('.mk-modal')`). To look and click yourself, serve your own copy on your own port; storage is per port:
Git Bash `LOGIN=off node tools/serve.js 8412`, PowerShell `$env:LOGIN='off'; node tools/serve.js 8412`, then
`http://localhost:8412/index.html`. Take a port nobody else uses (8400 plus your page's row in SPEC section 9).

## 7. Before you report a page done

1. `node tools/harness/lint.js` on your files is clean; `node tools/check.js` passes.
2. A steps file per persona that has the page, 0 failed and 0 page errors, covering: the list (tabs, search, a row opens its
   document), "New", the outcome shown before posting, posting, the toast naming what moved, the document view, every action.
3. Every refusal you can provoke shows at its field or beside its action: a future date, a date too far back, a quantity the
   engine refuses, an action of another role, an own approval, a cancellation with something resting on the document.
4. A persona that may see but not act (accounts, usually) has every button there, locked, with the reason in words.
5. A persona without the page cannot open the route or a `#/doc/<id>` link to its documents.
6. The draft survives `HB.router.rerender()`, a persona switch and a visit to another screen; leaving a dirty form asks first.
7. A second run with `--keep` finds what the first one posted; the same steps pass with `--seed=off`.
8. `#/doc/<id>` opens the document for a seeded id and for one posted by the steps; every id on screen is a link.
9. A screenshot at 1024x768 and one at the default size: nothing overlaps, nothing is cut that cannot be scrolled to.
10. Every sentence is plain and active; no figure, colour, emoji, clock read or `innerHTML` in your files.
