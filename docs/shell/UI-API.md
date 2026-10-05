# UI-API - shell, router, filters, UI kit and document kit

Contract for page authors. Code from this file; you should not need to read `js/core/*.js`.
How a page is put together and tested, with two real pages as the pattern: `docs/PAGES.md`.
Live reference of the document kit, working on dummy rows: `tools/harness/styleguide.js`, a developer page outside the sample.
index.html does not load it; its first lines say how to load it by hand, after which it opens at `#/system/styleguide`
(registered with `nav: false`, so it is not in the menu).

Ground rules
- A page file is one IIFE that calls `HB.router.register({...})`. It never edits `index.html`, the shell or the kit. `index.html`
  already lists every page file and every `css/pages/p-<page>.css` of SPEC section 9; a file that does not exist yet is skipped.
- Every component returns a **DOM node** unless marked *controller*. Children may be strings, numbers, nodes, arrays, `null`/`false`.
- Strings always become text nodes. Never build HTML strings from data.
- No colours in page code. Pass token **names** (`'--series-1'`) where a colour is needed; use classes otherwise.
- Every number on screen comes from the data layer, formatted with `HB.fmt`. Money is **paise** everywhere in JavaScript; only
  `HB.fmt` and the input controls of `HB.forms` convert to and from rupees. (The developer styleguide in `tools/harness/` types sample figures; no page of the sample does.)
- A form holds no rule of the business: it shows what `HB.engine.preview` and `HB.engine.act` return.
- `var ui = HB.ui, h = ui.h, forms = HB.forms;` is assumed in the examples.

Contents: [1 Router](#1-router---hbrouter) - [2 Filters](#2-filters---hbfilters) - [3 UI kit](#3-ui-kit---hbui) -
[4 Document kit](#4-document-kit---hbforms) - [5 CSS for pages](#5-css-available-to-pages) - [6 Shell](#6-shell---hbapp)

---

## 1. Router - `HB.router`

### register(def)
```js
HB.router.register({
  id: 'buy-orders',               // the file name without .js (SPEC section 9); also gives the page root the class 'pg-buy-orders'
  route: '#/buy/orders',          // exact hash; '#/buy/orders/x/y' also matches -> ctx.params.path = ['x','y']
  group: 'Buy',                   // Home | Sell | Stores | Buy | Make | Stock | Expenses | People | Accounts | Reports | Masters | System
  title: 'Purchase orders', subtitle: 'optional one-liner shown next to the title',
  filters: ['date', 'unit'],      // global filters the page honours; [] hides the filter bar
  icon: 'cart',                   // optional, defaults by page id
  navLabel: 'Orders',             // optional shorter menu label (menu text fits ~24 characters); defaults to title
  nav: true,                      // false = routable by URL but no menu item; default true
  docTypes: ['PO'],               // optional: document types this page opens, on top of the router's table (1.2)
  openDoc: function (id, state) { /* optional: prepare ctx.state before a '#/doc/<id>' link is drawn (1.2) */ },
  render: function (root, ctx) { /* build into root; may return a cleanup function */ }
});
```
Registering an existing `id` replaces the page. Routes start with `#/`: any other fragment (`#mk-content` from the skip link, an
in-page anchor) is not a route, and the router keeps the current screen.

**Who may open a page is not the page's choice.** The router takes it from `HB.session.access` (`HB.session.canOpen(pageId)`,
docs/API.md 1.9); `register` has no `roles` option. A route the persona does not have is left out of the menu and lands on Home.
An unknown route lands on Home too.

Nav order: groups in the order above, pages in script order (the order of `index.html`, which is the order of SPEC section 9). A group
with a single menu page shows no heading. `nav: false` pages are left out of the menu and out of that count.

### 1.1 ctx (second argument of render)
| field | meaning |
|---|---|
| `ctx.filters` | `{from, to, unitIds, preset}` - the global filter state **narrowed to the dimensions the page declared in `filters`**. An undeclared dimension is `null` (= all; for `date`: `from`, `to` and `preset` are `null`), because it has no control in the filter bar and may still hold a value set on another screen. Pass `ctx.filters` to selectors as is; **never call `HB.filters.get()` from a page** |
| `ctx.user` | current persona (`HB.session.current()`) |
| `ctx.params` | query params of the hash as strings, e.g. `#/accounts/cash?account=bank` -> `{account: 'bank'}`; extra path segments in `params.path` |
| `ctx.docId` | the document the hash asks for (`'#/doc/<id>'`), or `null`: draw the document view when it is set, the list when it is not |
| `ctx.state` | plain object kept per route across every redraw and across navigation: the selected tab, the list's search and sort, **the draft of an open form**. Not persisted |
| `ctx.navigate(route, params, opts)` | same as `HB.router.navigate` |
| `ctx.openDoc(id)` | open a document wherever it lives: same as `HB.router.openDoc(id)` |
| `ctx.closeDoc()` | back from a document view to this page's list (`navigate(page.route)`) |
| `ctx.rerender()` | re-run `render` now (synchronously), keeping the scroll position |

Lifecycle: the router re-runs `render` (debounced 60 ms, current page only) on `filters:changed` (only if `filters` is non-empty),
`session:changed` and `store:changed` (any key except `prefs`) - so a posted document redraws the screen that posted it, with no
reload. Before each run it calls the previous cleanup function, then `HB.charts.disposeAll(root)`, then empties `root`.

**A redraw never loses work.** `ctx.state` is the same object before and after, the scroll position is kept, and keyboard focus is
restored: by position for ordinary inputs (a search box may call `ctx.rerender()` on every keystroke), by field for a `docForm`
(4.6). Keep anything the user typed in `ctx.state`; a `docForm` does that for you when you pass it `state`.

**The filter bar steps aside for a document.** When the first thing a page draws is a full-page `docForm`, `docView` or
`forms.missingDoc`, the router hides the filter bar until the list is back: a date range has nothing to say about one document.
The filter state is untouched, and a page does nothing for this.

The scroll position resets when another page opens. Between the list and a document of the same page each keeps its own position,
so closing a document returns the list to where it was. Drawers, modals and popovers are closed when the hash changes (new page
**or** new params), never on a plain re-render - except popovers whose anchor disappeared with the old DOM.

`render` must be idempotent and cheap, and **must not write to `HB.store`** (that would loop). A `render` that throws shows an error
card with the message and logs to the console; the rest of the app keeps working.

### 1.2 Documents: `#/doc/<id>`
A document id anywhere on screen is a link: `forms.docLink(id)` (4.9), or `HB.router.docHref(id)` for an `href`. The hash stays
`#/doc/<id>` (Back and Forward work, the link can be pasted); the router resolves it to the page that owns the type, marks that
page in the menu and calls its `render` with `ctx.docId = id` and `ctx.params = {doc: id}`.

The type is the document's own (`HB.data.doc.get(id).type`) or, with no data layer, the prefix of the id.

| Type | Page | Type | Page |
|---|---|---|---|
| `PO` | buy-orders | `XFER` | stores-transfers |
| `GRN` | buy-receipts | `DAYEND` | stores-dayend |
| `VBILL` | buy-bills | `DEP`, `OPENCASH` | acc-cash |
| `PAY` | buy-payments | `ADJ` | stock-counts |
| `PROD` | make-production | `WO` | stock-batches |
| `SO` | sell-corporate | `OPENSTOCK` | stock-ledger |
| `INV` | sell-invoices | `EXP` | expenses |
| `RCPT` | sell-receipts | `DS-...` (a dispatch sheet id) | sell-dispatch |
| `CN` | sell-returns | `B-...` (a batch id) | stock-batches |

- A cancellation (`CXL`) is read on the document it cancelled: `#/doc/CXL-U-0001` opens the target, whose view shows the cancellation
  under related documents. (A `CXL` whose target cannot be found goes to sys-audit.)
- `docTypes: [...]` in `register` adds to the table or takes a type over.
- `openDoc(id, state)` in `register` is called once when a document link resolves to the page, **before** the render, with the page's
  per-route state: use it to switch a tab or drop a stale selection. Most pages need none and simply read `ctx.docId`.
- The persona has no page for the document, or no registered page opens the type: the router lands on Home and a toast says so.
  `forms.docLink` already shows such an id as plain text.

### 1.3 Other functions
| call | returns / effect |
|---|---|
| `navigate(route, params, {replace})` | `route` is a hash (`'#/buy/bills'`) or a page id (`'buy-bills'`); `params` become the query string. Same hash -> re-render. `replace: true` swaps the current history entry instead of adding one. The route is resolved **synchronously**: when `navigate` returns, `current()` is the new page and its first render has run |
| `openDoc(id, {replace})` | `navigate('#/doc/<id>')` |
| `docHref(id)` | `'#/doc/<id>'` (the id is URL-encoded) |
| `docPage(id, user?)` | the page that shows the document, or `null` when none is registered or the persona does not have it |
| `href(idOrRoute, params)` | the hash string, for `h('a', {href: ...})` or `ui.link` |
| `stateOf(idOrRoute)` | the per-route state object of a page, created on demand - to prepare a page before navigating to it (for example to open its form with a draft: `HB.router.stateOf('buy-receipts').form = forms.draft({values: {poId: id}})`) |
| `dirtyDrafts()` | `[{page, key}]`: the screens whose per-route state holds a draft with something typed in and not posted (`HB.forms.draft` with `dirty: true`). The shell reads it before the window goes (section 6) |
| `rerender()` | re-render the current page now |
| `current()` | `{page, params}` or `null` |
| `pages()` / `allowedPages(user?)` | registered pages in nav order / those the persona may open |
| `isAllowed(pageOrId, user?)` | boolean |
| `start({content, page, nav})`, `renderNav()` | used by `app.js` only |
| `GROUPS` | the group names in nav order |

Events on `HB.bus`: `route:changed` `{page, params}` (after the top bar is updated, before render).

---

## 2. Filters - `HB.filters`

State lives in `prefs.filters`; every change emits `filters:changed` with the new `get()` object. Every preset is relative to
`HB.calendar.today` (the business date of this copy) and clamped to `HB.calendar.goLive .. HB.calendar.today`.

| Preset id | Label | Range |
|---|---|---|
| `thisMonth` (default) | This month | first of the month to the business date |
| `lastMonth` | Last month | the whole month before |
| `last7` | Last 7 days | the business date and the six days before |
| `last30` | Last 30 days | the business date and the 29 days before |
| `today` | Today | the business date |
| `yesterday` | Yesterday | the day before |
| `sinceGoLive` | Since go-live | 1 Jan 2026 to the business date |
| `month` | the month by name, "Sep 2026" | one named month since go-live (`month: 'YYYY-MM'`); the current month runs to the business date |
| `custom` | Custom range | two dates, typed in the From and To boxes |

| call | meaning |
|---|---|
| `get()` | `{from, to, unitIds, preset}`; ISO dates; `unitIds` an array of unit ids or `null` = every unit in the persona's scope. A selection that covers every option is normalised to `null` |
| `set(partial)` | `{preset}`; `{preset: 'month', month: 'YYYY-MM'}`; `{from, to}` implies `custom`; `{unitIds: [...] \| null}` |
| `step(-1 \| 1)` / `canStep(dir)` | move the range earlier or later: a month range by one month, any other range by its own length in days; never before go-live or past the business date |
| `months()` | every month from the business date's back to go-live, newest first: `['2026-10', '2026-09', ...]` |
| `reset()` | back to This month / all units |
| `isDefault(showList?)` | true when the listed controls are at their defaults |
| `describe()` | `'1 Oct - 2 Oct 2026, 2 days'` - handy as a card subtitle |
| `summary('unit')` | `'All locations'`, `'Nadiad store'`, `'Factory +1'` |
| `options('unit')` | `[{id, label}]` - the factory and the stores from `HB.masters.units` (else `HB.config.units`), limited by `HB.session.scope()`; a deactivated one is labelled "(closed)". Empty with no data layer |
| `presets()` / `range(presetId)` | `[{id, label, from, to}]` / `{from, to}` |
| `rangeLabel({from, to})` | `'1 Sep - 30 Sep 2026'` |
| `mountBar(container, showList)` | used by the shell; pages only declare `filters: ['date', 'unit']` in `register` |

```js
var f = ctx.filters;                                   // inside render - already narrowed to the page's declared filters
var rows = HB.data.sell.invoices(f);                   // selectors take the filter object as is, and intersect with the scope themselves
HB.filters.set({ unitIds: ['st_vvn'] });               // drill-through, then navigate
HB.filters.set({ from: '2026-08-01', to: '2026-08-31' });
```
Behaviour: the date control is built so that an earlier month is one click away. In the bar, left to right: an arrow that
steps the range earlier, the period button, an arrow that steps it later, then the From and To dates in two boxes that can be
typed or picked (limited to go-live .. business date; a half-typed or out-of-range date is ignored and the box goes back to
what stands when it is left), and at the right end how many days the range covers. The period button opens a list in two
parts: the ranges above, each with its dates, and every month since go-live by name, newest first (bold + tick on what is
selected). The unit control is a checkbox popover with an "All locations" row; changes apply live. A persona with
one unit (the store manager) sees a locked chip; with no units known there is no unit control. On a persona switch, units the new
persona cannot see are dropped. "Reset filters" appears only when a shown control is non-default. A value set on one screen stays
in the global state, but it only reaches pages that declare that dimension.

A report page that needs a range (each register "with a date range", SPEC section 9) declares `filters: ['date']` and uses
`ctx.filters`; it does not build a second date control.

---

## 3. UI kit - `HB.ui`

### 3.1 DOM helpers
| call | notes |
|---|---|
| `h(tag, attrs?, ...children)` | attrs: `class` (string or array, falsy entries dropped), `style` (object; `'--x'` keys allowed), `dataset` (object), `onClick`/`onInput`/... handlers, `aria-*`, `for`, boolean attributes (`true` sets, `false`/`null` skips), `value`/`checked`/`disabled` set as properties. SVG tags are namespaced |
| `icon(name, size = 16)` | inline SVG, stroke 1.75, `currentColor`. Names: `home overview chart clock dish shield-check receipt coins scale calculator check-circle x-circle alert-triangle info building factory store truck box bank wallet layers grid list database users user chevron-down chevron-up chevron-right chevron-left arrow-up arrow-down arrow-right arrow-left plus minus check x search filter download upload edit more refresh external calendar paperclip lock eye file copy trash printer ban undo send tag cart clipboard book bell help settings route percent flag star`. `iconNames()` lists them |
| `clear(node)` / `append(parent, ...children)` | empty a node / append with the same child rules as `h`; both return the node |
| `token('--name')` | computed value of a CSS custom property |
| `format(fmt, value, row?)` | `fmt`: `'inr'` (compact) `'inrFull'` (whole rupees) `'inr2'` (two decimals) `'rate'` `'num'` `'num1'` `'pct'` `'qty'` (uses `row.unit`) `'date'`, or `function (value, row)`. Money values are paise. Blanks -> `'-'` |
| `dateTime(at)` | `'2026-09-16T14:32'`, `'2026-09-16'` or epoch ms -> `'16 Sep 2026, 14:32'` |
| `uid(prefix?)` | unique id string |

### 3.2 Layout
| call | notes |
|---|---|
| `grid(cols, children, {tight, start, className})` | `cols` number 1-6 = equal columns; `cols` array = spans on a 12-column grid, repeating: `grid([8, 4], [a, b])` |
| `row(children, {wrap, between, end, top, gap: 1\|2\|3\|4\|6})` | horizontal flex, centred, 8px gap |
| `stack(children, gap?)` | vertical flex; gap `1 2 3 5 6` (x4px), default 16px |
| `sectionTitle(title, sub?, actions?)` | heading between groups of cards |
| `card({title, subtitle, actions, body, footer, flush, className, id})` | `flush: true` removes body padding (tables). `card.bodyEl` is the body container |
| `pageHead({title, subtitle, back: {label, onClick}, chips, actions})` | the head of a **full-page document**: a way back to the list, the title with its status chips, actions on the right. `docForm` and `docView` build theirs with it; use it directly for a full-page layout of your own |

The page root is already a vertical stack with 16px gaps and the full content width (up to 1440px): append cards and grids straight
into `root`. A document with lines takes the whole page (4.6, 4.7); when it must open over another screen, use the wide drawer (3.8).

### 3.3 Figures
| call | notes |
|---|---|
| `hero({label, value, sub})` | the single >= 48px figure of a page |
| `statTile({label, value, sub, onClick, icon, tone, title})` | `onClick` makes the tile a button; `tone: 'warn' \| 'critical' \| 'good'` adds an edge marker |
| `kpiRow([tileOptions \| node, ...])` | responsive row of tiles (auto-fit, min 168px) |

No tile, table or chart shows a change against another period (SPEC section 8): pass no `delta` and no `spark` to a tile. The kit
still accepts them only because the inherited chart wrapper shares the code.

The one exception is the landing dashboard, whose tiles carry a small chart of the days (or months) of the chosen range. It does
not use the `spark` option, which draws a fixed 96px line with no label: `js/pages/home.js` makes the tile with `statTile`, builds
the chart with `HB.charts.sparkline(box, values, { fluid: true, labels: [...] })` (CHARTS-API section 6) and appends it to the tile,
where it stands at the foot. A tile is a flex column, so what is appended follows the small line; `margin-top: auto` on it (page
CSS, on the page's own class) puts the charts of a row in line.

### 3.4 Table
`table({columns, rows, onRowClick, dense, footer, empty, sortable, sort, onSort, maxHeight, rowClass, caption, className})`
-> wrapper node with `setRows(rows)` and `getSort()`. For the list of a document page use `forms.docList` (4.8), which adds status
tabs, search and paging on top of this table.

| option | meaning |
|---|---|
| `columns[]` | `{key, label, align: 'left'\|'right'\|'center', format, render, doc, width, maxWidth, wrap, sortable, sortValue(row), numeric, title, className}`. Numeric (right-aligned, tabular figures) when `format` is a number format or `align: 'right'` |
| `maxWidth`, `wrap` | Body cells **never wrap by default**. Long text is a per-column choice: `maxWidth: 240` (px) keeps one line and truncates with an ellipsis, full text as the tooltip; `wrap: true` lets the cell wrap |
| `render(value, row, col, ctx)` | returns node or string; `ctx = {rows, index}` |
| `doc: true` | the cell holds a document id: it is shown as a link to `#/doc/<id>` (`forms.docLink`), and as plain text for a persona with no page for it. `{ key: 'poId', label: 'Order', doc: true }`. The report columns of `HB.data.reports` carry the same flag |
| `sortable` | table-wide default; per-column `sortable` overrides. Numeric aware, blanks last, first click = descending for numbers |
| `sort`, `onSort` | initial `{key, dir: 'asc'\|'desc'}` and a callback - store it in `ctx.state` so the sort survives re-renders |
| `onRowClick(row, event)` | rows become focusable; Enter / Space activate; clicks on inner buttons and links are ignored |
| `footer` | object keyed by column key (raw values are formatted with the column's `format`; strings and nodes pass through), or an array of such objects |
| `empty` | string or node shown when `rows` is empty |
| `maxHeight` | px number or CSS length: scrolls inside with sticky header and footer |
| `rowClass(row)` | e.g. `'is-selected'`, `'is-muted'`, `'is-strong'` |

The table draws every row it is given: hand it a page of rows (`docList` does), not ten thousand invoices.

Cell renderers - `HB.ui.cells`
| call | notes |
|---|---|
| `bar(max, colourVar = '--series-1', {format})` | inline bar + value; `max: null` = column maximum. One colour for all bars |
| `heat(min, max, {format, scale: 'div', mid, invert})` | shades the whole cell on the blue ramp; `null` bounds = column range |
| `status()` | value is a status -> `statusChip` |
| `twoLine(subKey \| fn(row), {maxWidth = 280})` | bold value + muted second line; both lines truncate at `maxWidth` px |
| `entity(colourVar \| fn(row))` | colour dot + label |

### 3.5 Buttons, chips, states
| call | notes |
|---|---|
| `button({label, icon, iconRight, variant, size: 'sm', onClick, disabled, disabledReason, title, type, block, ariaLabel, className})` | `variant`: `'secondary'` (default) `'primary'` `'ghost'` `'danger'` `'text'`. `button('Label')` also works. **`disabledReason`** (non-empty string, e.g. `HB.session.can(...).reason`) keeps the button visible and focusable, blocks the click and shows the reason as tooltip. In a document view use `actions[].reason` (4.7), which also writes the reason beside the button |
| `iconButton(iconName, label, onClick, {variant, size, disabledReason})` | icon-only, `label` becomes tooltip and aria-label |
| `link(label, route, {icon, title})` | in-app anchor |
| `chip(label, tone, {icon, dotVar, outline, title})` | `tone`: `neutral info good warn serious critical` |
| `statusChip(state, {label, title})` | the one mapping of statuses to tone + icon + label (also `forms.statusChip`) |
| `statusInfo(state)` | `{tone, icon, label}` |
| `avatar(initials, {accent, size: 'sm'})` | |

Statuses known to `statusChip` (case-insensitive; an unknown one renders neutral with a humanised label).

Every document status of SPEC 5.2:
`PENDING` Waiting for approval, `HELD` Held for approval, `APPROVED` Approved, `PART_RECEIVED` Part received, `RECEIVED` Received,
`REJECTED` Rejected, `CANCELLED` Cancelled, `POSTED` Posted, `OPEN` Open, `INVOICED` Invoiced, `SENT` Sent, `PAID` Paid.

Flags for lists and tiles:
`DRAFT` Draft, `UNPAID` Unpaid, `PART_PAID` Part paid, `OVERDUE` Overdue, `DUE_SOON` Due soon, `NOT_DUE` Not due, `EXPIRED` Expired,
`NEAR_EXPIRY` Near expiry, `LOW_STOCK` Low stock, `OK` OK, `MATCHED` Matched, `MISMATCH` Does not match, `ACTIVE` Active,
`INACTIVE` Inactive, `DONE` Done, `TODO` To do, `LOCKED` Locked, `SIMULATED` Simulated.

### 3.6 Tabs, segmented, select
| call | notes |
|---|---|
| `tabs({items: [{id, label, count}], value, onChange(id), ariaLabel})` | tab strip only; draw the panel yourself (usually `st.tab = id; ctx.rerender()`). Arrow keys move. For status tabs with counts use `forms.statusTabs` (4.8) |
| `segmented({options: [{value, label}], value, onChange(value), size: 'sm', ariaLabel})` | for measure / grouping switches, including inside a card's `actions` |
| `select({options: [{value, label, disabled}] \| [string], value, onChange(value), placeholder, size: 'sm', block, ariaLabel, disabled, name})` | native select; wrapper has `.input`, `.getValue()`, `.setValue(v)` |
| `stepper({label, value, min, max, step, unit, format(v), onChange(v), ariaLabel, title, size: 'sm'})` | a labelled figure with minus and plus buttons; wrapper has `getValue()` and `setValue(v)` (silent) |

### 3.7 Plain form controls - `HB.ui.form` (also aliased as `ui.field`, `ui.input`, `ui.textarea`, `ui.dateInput`, `ui.checkbox`, `ui.search`)
For small forms in a modal (a master record, a reason). **A document is entered with `HB.forms`** (chapter 4): quantities, rates
and amounts have their own controls there, and there is no whole-rupee money input any more.

| call | notes |
|---|---|
| `form.field({label, control, hint, required, optional, error})` | binds the label to the first input inside `control`; wrapper has `.setError(msg)` (inline, sets `aria-invalid`), `.setOk(msg)`, `.input`, `.control`. Empty message clears |
| `form.input({value, placeholder, type, name, mono, maxLength, onInput(value, el), onChange(value, el), onEnter(value, el), disabled, readOnly, ariaLabel})` | returns the `<input>`; `mono: true` for GSTIN (uppercase monospace) |
| `form.textarea({... , rows})` | returns the `<textarea>` |
| `form.dateInput({value, min, max, onChange(iso), name, disabled, ariaLabel})` | native date input with no bounds of its own. For a document date use `forms.dateInput`, which is bounded by the business date |
| `form.select(opts)` | `ui.select` at full width |
| `form.checkbox({label, checked, onChange(bool), name, disabled})` | label element, `.input` is the checkbox |
| `form.search({value, placeholder, onInput(value), width, ariaLabel})` | search box, `.input` |
| `form.row(fields, 2 \| 3)` / `form.group(children)` | side-by-side fields / vertical form container |

### 3.8 Overlays (*controllers*)
| call | notes |
|---|---|
| `drawer({title, subtitle, headerExtra, body, footer, width, wide, onClose})` | right side, 480-560px (default 520), focus trap, Esc / backdrop close, focus returns to the trigger. **`wide: true`** is the document drawer: up to 1120px, for a document with lines opened over another screen (an approval with its evidence). Returns `{el, body, foot, close(), setTitle(t, sub), setBody(content), setFooter(content)}` |
| `modal({title, subtitle, body, footer, size: 'sm'\|'lg'\|'xl', dismissible, onClose})` | same controller; `xl` is 960px. `dismissible: false` disables Esc / backdrop for the user; navigation (`closeAll()`) still closes it |
| `confirm({title, message, body, confirmLabel, cancelLabel, tone: 'primary'\|'danger', requireReason, reasonLabel, reasonPlaceholder, onConfirm(reason), onCancel()})` | returns `Promise<{ok, reason}>`, never rejects. For a mandatory reason use `forms.confirmWithReason` (4.10) |
| `toast(message, {title, tone: 'info'\|'good'\|'warn'\|'critical', duration, action: {label, href, onClick}})` | bottom right, auto-dismiss (4.2 s), max 4 stacked. `message` may be a node; `action` adds one link under it. Returns `{close()}`. After posting use `forms.postedToast` (4.10) |
| `popover(anchor, content, {align: 'left'\|'right', width, onClose})` | anchored panel; closes on outside click, Esc, scroll, resize. Calling it for an anchor that is already open closes it and returns `null`. Returns `{el, close(), reposition()}` |
| `menu(anchor, items, {align, width})` | items: `{label, sub, icon, avatar, hint, selected, danger, disabled, title, onSelect}` \| `{heading}` \| `{separator: true}` |
| `closeAll()` / `closeOrphans()` | close every popover, drawer and modal (the router does this when the hash changes) / close popovers whose anchor left the document (the router does this after each re-render) |

Overlays live outside the page root, so they survive page re-renders: after an action refresh them yourself (`d.setBody(...)`) or
close them. Dialogs stack in opening order: a confirm opened from a drawer dims and blocks the drawer. An open type-ahead list
(4.2) takes the first Esc; the dialog around it takes the next.

### 3.9 Status and detail blocks
| call | notes |
|---|---|
| `timeline(events, {empty})` | `events[]`: `{actor, role, action, from, to, note, at, tone, icon}`; `from` / `to` are statuses (chips with an arrow); `at` is `'YYYY-MM-DDTHH:MM'`; tone defaults from `to` |
| `meter({value, max, label, valueLabel, tone, goodWhen, warnAt, criticalAt, target, targetLabel, size: 'sm'})` | a bar against a limit (a customer's balance against its credit limit, a return share against the threshold) |
| `callout(tone, title, body, {actions, icon})` | tone `neutral info good warn serious critical`; title or body may be `null` |
| `emptyState(title, body?, {icon, action, compact})` | also `emptyState({title, body, icon, action, compact})` |
| `keyValue(pairs, {cols: 2, stacked})` | pairs `[[label, value]]` or `[{label, value}]`; values may be nodes; `null` values are skipped |
| `steps({items: ['Order', 'Receipt', 'Bill', 'Payment'], current})` | progress along a chain, zero-based |
| `errorCard(title, errorOrMessage, hint?)` | what the router shows when a page throws |
| `downloadCsv(filename, columns, rows)` | columns `[{key, label, value(row), csv: false to skip}]` - table column arrays work as is. Raw values (paise stay paise: give money columns a `value(row)` that returns rupees, `HB.money.toRupees(row.total)`), UTF-8 BOM, formula-safe, works on `file://`. Returns the CSV text |

Removed with the previous sample: `moneyInput` (whole rupees), `sourceTag`, `estimateBadge`, `notProvided`, the `'kg'` format and
the simulated loading (`latency.js`).

---

## 4. Document kit - `HB.forms`

`js/core/forms.js` + `css/forms.css` + `css/print.css`. Everything a page needs to list, enter, show and print a document.

| | |
|---|---|
| Inputs | `qtyInput` `rateInput` `amountInput` `dateInput` `selectInput` `partyPicker` `itemPicker` `picker` |
| Grids | `lineGrid` `matrixGrid` `totals` |
| Document | `docForm` `docView` `draft` |
| Lists and status | `docList` `statusTabs` `statusChip` `docLink` `typeName` `docTitle` `uniqueRows` |
| From the data layer | `docActions` `docNotice` `timelineOf` `relatedOf` `missingDoc` `startDraft` `changes` (4.10) |
| Messages | `postedToast` `fail` `confirmWithReason` `teaser` |
| Paper | `printSheet` `printDoc` |

### 4.1 Units in and out
| Control | Typed as | Value in and out |
|---|---|---|
| `qtyInput` | a number with up to three decimals (`decimals: 0` for whole units) | units, a `number` (`12.5`) |
| `rateInput` | rupees with up to four decimals | **paise per unit**, two decimals of a paisa (`38.50` typed -> `3850`; `21.4275` -> `2142.75`) |
| `amountInput` | rupees with paise | **whole paise** (`1,234.50` typed -> `123450`) |

An empty box is `null`. The text is parsed digit by digit, never through a float, and extra decimals are cut as they are typed, not
rounded: what the user sees is what is stored. Nothing rounds to the rupee. While focused the box shows plain digits; on leaving it
shows Indian grouping (`2,50,075.50`). `HB.money.amount(qty, rate)` remains the only place a quantity and a rate become money - and
that is the engine's call, not the form's, except for showing a line value before the preview answers.

### 4.2 Inputs
Every control returns a wrapper (for `dateInput`: the `<input>` itself) with `.input` (the native element), `.getValue()` and
`.setValue(v)` (silent: `onChange` does not fire). All take `value`, `onChange(value)`, `disabled`, `ariaLabel`, `name`, and
`cell: true` (borderless, for a grid cell).

| call | options beyond the common ones |
|---|---|
| `qtyInput({decimals, unit, placeholder, readOnly, allowNegative})` | `decimals` 0-3 (default 3); `unit` is shown after the figure (`'kg'`, `'pcs'`); `.setUnit(text)` |
| `rateInput({unit, prefix})` | rupee sign in front (not in a cell); `unit` after (`'per kg'`) |
| `amountInput({prefix, allowNegative})` | rupee sign in front (not in a cell) |
| all three | take no more whole digits than the box is for: 7 for a quantity, 6 for a rate, 9 for an amount. A key held down or a pasted number stops there |
| `dateInput({min, max})` | bounded by the business date: `max` defaults to `HB.calendar.today`, `min` to `HB.calendar.lockBefore`, `value` to today. Pass `max: null` for a date that may be in the future (an expected delivery). A typed date outside the bounds is kept and marked invalid, so the engine's own refusal (`future_date`, `locked_month`, `backdate_limit`) can say why |
| `selectInput({options: [{value, label, disabled}] \| [string], placeholder})` | native select at full width; `''` is returned as `null`; `.setOptions(list, value?)` |
| `partyPicker({kind: 'customer' \| 'vendor' \| 'employee', options, filter(party), includeInactive, placeholder})` | type-ahead on `HB.masters.customers`, `.vendors` or `.employees`; `onChange(id, party)`. `options` replaces the master list (party records, or `{id, label, sub}`). Deactivated parties are left out unless one is the current value. A vendor's second line is its town and what it supplies, by item name |
| `itemPicker({kind: 'fg' \| 'rm' \| 'pk' \| [kinds], items, filter(item), includeInactive, placeholder})` | type-ahead on `HB.masters.items` by name or code; `onChange(id, item)`. `items` replaces the master list |
| `picker({options: [{id, label, sub, search, disabled}] \| function, placeholder, emptyText, clearable, listWidth})` | the type-ahead on any list (routes, expense categories, accounts, open invoices); `onChange(id, record, {via})` |

Type-ahead behaviour: click or type to open; typing narrows by every word typed, names that start with it first; Down / Up move,
Enter or Tab take the highlighted row, Esc closes the list and puts the text back; emptying the box clears the value
(`clearable: false` prevents that). `.setOptions(list)`, `.open()`, `.setInvalid(message)`.

```js
var qty = forms.qtyInput({ value: line.qty, unit: 'kg', onChange: function (q) { line.qty = q; } });
var paid = forms.amountInput({ value: st.amount, onChange: function (paise) { st.amount = paise; } });
var who = forms.partyPicker({ kind: 'vendor', value: st.vendorId, onChange: function (id, vendor) { st.vendorId = id; } });
ui.form.field({ label: 'Amount paid', required: true, control: paid });
```

### 4.3 lineGrid
`lineGrid({columns, rows, onChange, addLabel, readOnly, newRow, minRows, maxRows, addRows, removeRows, footerLabel, empty})`

`rows` is **your** array of plain objects - the draft. The grid writes into it (`row[col.key] = value`) and never copies it, so
keeping the array in `ctx.state` is all it takes to survive a redraw. Inside a `docForm` you do not create the grid: pass these
options as `lines` (4.6).

| option | meaning |
|---|---|
| `columns[]` | see the table below |
| `onChange(rows, {kind, index, key, row})` | after every edit (`kind: 'edit'`), added line (`'add'`) and removed line (`'remove'`) |
| `addLabel` | text of the add button, default "Add line" |
| `newRow(rows)` | returns the object for a new line, default `{}` |
| `minRows`, `maxRows` | the grid keeps at least `minRows` lines (removing the last one leaves an empty line) and refuses more than `maxRows` |
| `addRows: false`, `removeRows: false` | a fixed set of lines (a goods receipt against an order: one line per order line) |
| `readOnly` | every cell as text, no add, no remove |
| `footerLabel` | label of the footer row, default "Total"; it sits in the first column that has no footer of its own |

Column: `{key, label, type, width, align, required, title, placeholder, ...}`

| `type` | cell | value in `row[key]` | extra options |
|---|---|---|---|
| `'item'` | `itemPicker` | item id | `kind`, `items` (array or `function (row)`), `filter(item, row, rows)`, `listWidth` |
| `'party'` | `partyPicker` | party id | `kind`, `options`, `filter` |
| `'select'` | `selectInput` | option value | `options` (array or `function (row)`) |
| `'qty'` | `qtyInput` | units | `unit` and `decimals` (value or `function (row)`), `allowNegative`, `footerUnit` |
| `'int'` | whole number | units | `unit` |
| `'rate'` | `rateInput` | paise per unit | `unit` |
| `'amount'` | `amountInput` | paise | `allowNegative` |
| `'date'` | `dateInput` | ISO date | `min`, `max` |
| `'text'` (default) | text box | string or `null` | `maxLength` |
| `'computed'` | read-only | - | `value(row, index, preview)` returns the raw value; `format` |
| `'static'` | read-only `row[key]` | as given | `format` |

Options for any column:
- `readOnly: true | function (row)` shows the cell as text (a rate copied from the order).
- `format`: `'inr2'` `'rate'` `'qty'` `'num'` `'pct'` `'date'` or `function (value, row, index)` returning text or a node. Read-only
  cells of an editable type format themselves (an item shows its name, a rate as a rate).
- `value(row, index, preview)`: where a read-only cell takes its value when it is not simply `row[key]`. `preview` is the latest
  result of the form's `onPreview`, so a cell can show a figure the engine computed.
- `footer`: `'sum'` (adds the column up and formats it like its cells), `function (rows, preview)`, or fixed text.
- `onChange(row, value, record, index, rows)`: called after the cell wrote its value - the place to fill other fields of the line
  (`row.rate = HB.engine.price(id)`). The rest of the line is repainted afterwards; for `'item'`, `'party'` and `'select'` columns
  it is rebuilt, so a unit or an option list that follows the item is up to date.

Keyboard: Tab runs across the cells of a line and on to the next line. Enter moves down in the same column; in the last line it
starts a new one (unless that line is still empty). Up / Down move between lines. In a picker, Down opens the list and Enter takes
the highlighted row and moves to the next cell. Ctrl+Delete removes the line (the remove buttons are left out of the Tab order).

Returned element:

| member | meaning |
|---|---|
| `.rows` | the array |
| `.filled()` | the indexes of the lines something was typed into. A line nothing was typed into stays in the draft as `{}`: **leave it out of the payload** (inside a `docForm`: `form.lines()`, 4.6) |
| `.refresh()` | recompute read-only and computed cells and the footer, and re-read every input the user is not typing in. Call it after changing row values in code. Keeps the focus |
| `.rebuild(rows?)` | rebuild every line (after code added, removed or replaced lines) |
| `.setErrors([{index, key, message}])` | marks the cells and writes the messages under their lines; `[]` clears. Inside a `docForm` the form does this from the engine's errors |
| `.setWarnings([{index, key, message}])` | the same for warnings: the cell turns amber (`is-warn`) and the message sits under its line in amber (`mk-field__warn`); a refusal on the same cell wins. `[]` clears. Inside a `docForm` the form does this from the engine's warnings |
| `.setPreview(result)` | the value computed columns receive as `preview` |
| `.focusCell(index, key)`, `.addRow(row?, focus?)`, `.removeRow(index)` | |

### 4.4 matrixGrid
`matrixGrid({rows, columns, values, available, onChange, readOnly, rowHeader, totalLabel, availableLabel, balanceLabel, info, disabled})`

A dense sheet of whole numbers: the route dispatch sheet (outlets by products) and the store day-end (sold and expired by product).

| option | meaning |
|---|---|
| `rows`, `columns` | `[{id, label, sub}]`; a column may add `short` (a shorter header text) |
| `values` | **your** object `{rowId: {colId: number}}` - the draft; the grid writes into it. A missing cell is 0 |
| `available` | `{colId: number}`: adds an "available" row under the totals, and marks every column whose total is above it (header, total and balance in the critical tone, "Short by n" as the tooltip) |
| `availableLabel`, `balanceLabel` | label of the available row (default "Available"); `balanceLabel` adds a third row, available less total ("Left in the store") |
| `info` | `[{label, values: {colId: value}, format}]` - further read-only rows under the totals (MRP, standing quantity) |
| `onChange(values, {rowId, colId, value})` | after every edit |
| `disabled(rowId, colId)` | `true` makes one cell read-only |
| `rowHeader`, `totalLabel` | text of the corner cell; label of the totals row (default "Total") |

Keyboard: arrows move between cells, Enter moves down, Tab across; a cell selects its content on focus, so typing replaces it.
The header row and the first column stay in place while the sheet scrolls.

Returned element: `.values`, `.setValues(values)` (replace and repaint - after "reset to standing quantities" or "cut to
available"), `.setAvailable(map)`, `.totals()` -> `{rows: {id: n}, columns: {id: n}, grand}`, `.short()` ->
`[{colId, total, available, short}]`, `.focusCell(rowId, colId)`.

How a short column is cut to what is available is a rule of the business, not of the grid: decide it with the engine's figures,
write the result into `values` and call `.setValues()`.

```js
var sheet = HB.engine.dispatchSheet(routeId, date);                 // outlets, standing quantities, stock available per item (docs/API.md)
var grid = forms.matrixGrid({ rowHeader: 'Outlet', rows: outletRows, columns: productColumns,
  values: st.form.matrix, available: availableByItem, availableLabel: 'Available in the finished store' });
```
Inside a `docForm`, pass these options as `matrix` (4.6) instead of creating the grid yourself.

### 4.5 totals
`totals([{label, value, sub, strong, tone: 'good' | 'bad' | 'muted', rule}])` - the figures panel of a document: label left,
value right. `strong` marks the grand total, `rule` draws a line above the row, `sub` is a small second line under the label.
`docForm` and `docView` call it for you.

### 4.6 docForm
`docForm({title, subtitle, fields, lines, matrix, body, panel, totals, onPreview, onSubmit, onCancel, state, ...})`

A full-width document form: page head with a way back, header fields in a four-column grid, an editable line grid (or a matrix),
a panel and the totals side by side, warnings, and an action bar that stays in reach at the bottom of the screen.

| option | meaning |
|---|---|
| `state` | **the draft** - an object the form reads and writes: `{values: {key: value}, lines: [...], matrix: {...}}` plus the form's own bookkeeping (`touched`, `dirty`, `submitted`, `focus`, `opened`). Pass an object held in `ctx.state` (`st.form`); a redraw then rebuilds the form exactly as it was. `forms.draft(init)` gives an empty one, or completes `{values, lines}` you prefilled |
| `title`, `subtitle` | the page head |
| `fields[]` | header fields, table below |
| `lines` | `lineGrid` options without `rows` and `onChange` (`{title, subtitle, actions, columns, addLabel, newRow, minRows, ...}`). The rows are `state.lines`; `lines.rows` is used once, as the initial lines of a new draft. `lines.onChange(rows, info, form)` is called after each edit |
| `matrix` | `matrixGrid` options without `values` (`{title, subtitle, actions, rows, columns, available, ...}`). The values are `state.matrix`; `matrix.values` is the initial sheet of a new draft |
| `body` | a node or `function (draft, form)`: an extra section between the lines and the totals |
| `panel` | a node or `function (preview, draft, form)`: what stands left of the totals and follows the preview - where the document will land, the three-way check, a credit-limit meter, a teaser. Redrawn after every preview. With no `totals` the panel takes the whole width, and the other way round |
| `totals` | rows for `forms.totals`, or `function (preview, draft, form)` returning them. Redrawn after every preview |
| `onPreview(draft, form)` | called when the form opens and 90 ms after every change. Build the payload from the draft, **return what `HB.engine.preview(type, payload)` returned** |
| `onSubmit(draft, form)` | called by the primary button and by Ctrl+Enter. **Return what `HB.engine.act(...)` returned.** On success, clear the draft (`st.form = null`), show the toast and go to the document or the list. A form that has posted takes no second submit: a double click posts one document (`docActions` does the same for approve, reject and cancel) |
| `onCancel(draft)` | called by "Cancel" and by the back link, after a "Discard this draft?" question when something was typed (`confirmDiscard: false` skips it). Clear the draft and re-render |
| `submitLabel`, `submitIcon`, `cancelLabel`, `backLabel` | default "Post", `'check'`, "Cancel", "Back" |
| `submitReason` | a non-empty string (or `function (draft)`) disables the primary button and shows the reason beside it: `HB.session.can('po.create').reason`. The `role` refusal the preview then returns is not shown a second time |
| `actions[]` | further buttons in the bar: `{label, icon, variant, reason, title, onClick(draft, form)}` ("Reset to standing quantities", "Cut to available") |
| `fieldMap` | `{engineFieldName: formKey}` when a field or a column is named differently from the engine's `error.field` |
| `chips` | chips beside the title; default one that says "Not posted yet" |
| `compact: true` | no page head and a plain bar: for a form inside a drawer or modal |
| `autofocus: false` | do not put the caret in the first field when the form opens |

Field: `{key, label, type, span, required, optional, hint, value, placeholder, disabled, show, rebuild, onChange, ...}`

| `type` | control | extra options |
|---|---|---|
| `'text'` (default), `'textarea'` | text | `maxLength`, `mono`, `rows` |
| `'date'` | `forms.dateInput` | `min`, `max` |
| `'select'` | `forms.selectInput` | `options` (array or `function (draft)`) |
| `'party'` | `forms.partyPicker` | `kind`, `options`, `filter(party, draft)`, `includeInactive` |
| `'item'` | `forms.itemPicker` | `kind`, `items`, `filter(item, draft)` |
| `'picker'` | `forms.picker` | `options` (array or `function (draft)`) |
| `'qty'`, `'int'`, `'rate'`, `'amount'` | the decimal inputs | `unit`, `decimals`, `allowNegative` |
| `'static'` | read-only text | `text` (value or `function (draft)`), or `format` for `draft.values[key]` |
| `'custom'` | `control: function (draft, form)` returning a node | you write `draft.values` yourself and call `form.refresh()` |

- `span`: 1-4 columns of the four-column grid (default 1).
- `value`: the initial value, used only while the draft has none for the key. A `'date'` field with no `value` starts on the
  business date.
- `show(draft)`: leave the field out when it returns false. `rebuild: true`: rebuild fields and lines when this field changes
  (another field's `show` or `options`, or the lines, depend on it); the caret stays where it was.
- `onChange(value, draft, form, record)`: after the field wrote its value - fill other values, replace `draft.lines`, then
  `form.rebuild()` if lines or fields changed (or set `rebuild: true`).
- Name fields and columns after the payload (`vendorId`, `date`, `lines[i].qty`): errors then find their place without a `fieldMap`.

**Errors.** The form shows what the engine says, where the engine says it. From a result `{ok, error: {code, message, field,
docId}, errors: [...], warnings: [...]}` (`errors` is optional; `error` alone is enough):

| `error.field` | shown |
|---|---|
| a field key (`'vendorId'`, `'date'`) | under that field, the control marked |
| `'lines[2].qty'` (also `'lines.2.qty'`) | in a message row under that line, that cell marked |
| `'lines[2]'` | under that line |
| anything else, or none | in the action bar; with `docId`, a link to the document that must be dealt with first |

The engine numbers the lines of the payload. Build the payload from **`form.lines()`** - the lines something was typed into, empty
ones left out - and the form maps the engine's line numbers back to the grid's, so the right line is marked even when an empty
line above it was skipped.

An error from a **preview** appears only once its field has been touched, so a new form does not open covered in "required". After
a **submit** every error shows, and the caret goes to the first one.

**Warnings.** A warning is a figure that looks wrong and can still be posted (`docs/API.md` 3.3). From `warnings: [{code, message,
field}]` (a plain string is taken as a message with no field) the form shows each one twice, so that it cannot be missed:

| `warning.field` | shown |
|---|---|
| a field key (`'amount'`, `'cash'`, `'goodUnits'`) | in amber under that field, below its hint and any refusal |
| `'lines[2].rate'` (also `'lines.2.rate'`) | in an amber message row under that line, that cell marked amber |
| anything else, or none | above the action bar only |

and every warning once more in one amber callout directly above the action bar: its sentence, then "Check the figure. It can
still be entered as it is." (several: a list under "Check these figures first"). The callout floats with the bar at the bottom
of the screen (`.mk-docform__dock`, a third of the window high at most, then it scrolls), so whenever the button is in sight the
warning is too, even when the figure it concerns has scrolled away above. A warning is shown as soon as the preview raises it,
touched field or not, and goes when the figure is corrected. It never locks the button: the callout is information, not a question.
The same `fieldMap` and line numbering as for errors apply. A page does nothing for this beyond returning the preview.

**Focus and redraw.** The form remembers the focused field by key in the draft; when a redraw (a posted document elsewhere, a
persona switch) rebuilds it, the caret returns to that field. A form that has just opened starts in its first field.

Returned element (also the `form` argument of every callback):

| member | meaning |
|---|---|
| `.draft` | the state object |
| `.lines()` | the filled lines of the draft, for the payload (see Errors) |
| `.preview` | the latest preview result |
| `.grid`, `.matrix` | the `lineGrid` / `matrixGrid` element, when there is one |
| `.refresh()` | run the preview again and repaint totals, panel, computed cells, warnings and errors - after changing the draft in code |
| `.rebuild()` | rebuild fields and lines from the draft - after code replaced lines or changed which fields show |
| `.submit()`, `.setError(errorOrResult)` | submit as the button does; show a refusal that came from elsewhere |

### 4.7 docView
`docView({title, subtitle, status, chips, notice, meta, lines, totals, sections, timeline, related, actions, onBack, backLabel, compact})`

The read view of a posted document: head with status, what it carries on the left, what may be done with it, what rests on it and
its history on the right.

| option | meaning |
|---|---|
| `title`, `subtitle` | `forms.docTitle(doc)` gives "Purchase order PO-U-0001" |
| `status`, `chips` | a status name (or a node), and further chips beside it |
| `onBack`, `backLabel` | the way back to the list: `onBack: ctx.closeDoc` |
| `notice` | `{tone, title, text}` or a node: a callout under the head ("Cancelled on 2 Oct by ...: ordered twice", "Held: 4.1% above its receipts") |
| `meta` | `[[label, value]]` for the summary card; values may be nodes (`forms.docLink(doc.poId)`); `null` values are skipped |
| `lines` | `{title, subtitle, columns, rows, footer, empty}` (a `ui.table`, dense) or a node |
| `totals` | rows for `forms.totals`, shown under the lines on the right |
| `sections` | `[{title, subtitle, body, flush, actions}]` or nodes: further cards (the three-way panel, batches and cost, allocations) |
| `related` | `[{id, label, status, note}]`: related documents as links with their status. `forms.relatedOf(id)` gives it from the data layer |
| `timeline` | events for `ui.timeline` `{actor, role, action, from, to, note, at}` (or a node). `forms.timelineOf(id)` gives it from the data layer |
| `actions[]` | `{label, icon, variant, danger, onClick, reason, docId, title}`. **A non-empty `reason` disables the action and shows the reason as its tooltip and in words beside the button** - an action the persona may not take, or that the state of the document forbids, stays on screen and says why. `docId` adds a link to the document that must be dealt with first ("Open GRN-U-0002"). `forms.docActions` (4.10) builds approve, reject, cancel and confirm receipt for you |
| `headActions` | nodes at the right of the head |
| `compact: true` | no head, one column: inside `ui.drawer({wide: true})` |

Give `reason` what the engine or the session says. `forms.docActions` does, from `HB.data.doc.view(id).actions`; for an action of
your own use `HB.session.can(...).reason` or the message of `HB.engine.check(...)`. Do not write the rule in the page.

### 4.8 docList, statusTabs
`docList({rows, columns, state, statuses | groups, all, search, searchPlaceholder, onOpen, newLabel, onNew, newReason, actions, empty, sort, title, subtitle, pageSize})`

The list of a document page: a card with the search box and "New" in its head, the status tabs with counts in a row of their own
(six statuses fit at 1024px), and the table in pages of 50. The column with key `id` is a link to the document, like every
document id on screen (`doc: true`, 3.4); the row opens it as well.

| option | meaning |
|---|---|
| `rows` | every document the selector returned for the filters (cancelled ones included: they get their tab) |
| `columns` | `ui.table` columns. Sorting is done over the whole list, not the page |
| `state` | where tab, search text, sort and page live: an object in `ctx.state` (`st.list = st.list \|\| {}`) |
| `statuses` | `['PENDING', 'APPROVED', ...]`: one tab per status, labelled as the chip, "All" first |
| `groups` | instead of `statuses`: `[{id, label, statuses: [...]}]` or `[{id, label, test(row)}]` ("Open" = PENDING and HELD) |
| `all` | `false` leaves the "All" tab out; a string renames it |
| `search` | the row keys to search (default: every column key), or `function (row)` returning the text; `false` for no box |
| `onOpen(row)` | default: `HB.router.openDoc(row.id)`; `false` for rows that open nothing |
| `newLabel`, `onNew`, `newReason` | the primary button; `newReason` (a non-empty string) disables it with that tooltip: `HB.session.can('po.create').reason` |
| `actions` | further nodes beside the search box (a CSV button) |
| `sort` | the initial `{key, dir}` |

Returned element: `.rows()` -> the rows now listed (tab, search and sort applied, every page) - what a CSV export should carry.

`statusTabs({rows, statuses | groups, value, onChange(id), all, statusKey})` is the tab strip alone, for a list you draw yourself:
the element has `.value` (the selected id) and `.filter(rows)` (the rows of the selected tab).
`statusChip(status, {label, title})` is `HB.ui.statusChip` (3.5).

### 4.9 Names and links
| call | returns |
|---|---|
| `docLink(id, label?)` | an `<a href="#/doc/<id>">`; plain text when the persona has no page for it; `'-'` for an empty id |
| `typeName(type, plural?)` | `'Vendor bill'` / `'vendor bills'`. Types: `PO GRN VBILL PAY PROD SO INV RCPT CN XFER DAYEND DEP ADJ WO EXP CXL OPENSTOCK OPENCASH` |
| `docTitle(doc)` | `'Purchase order PO-U-0001'`; an expense by its kind: "Expense claim", "Expense bill", "Salary bill" |
| `format(format, value, row?)` | the cell formatter of the grids: `'inr2' 'inr' 'inrFull' 'rate' 'qty' 'num' 'pct' 'date'` |

### 4.10 Messages
| call | notes |
|---|---|
| `postedToast(doc \| [docs], text, {verb, tone, duration})` | "Purchase order PO-U-0003 approved" with **one line of what moved** (`text`, written by the page from what the engine and the selectors returned) and a link to the document. It stays 6.5 to 14 seconds, longer for a longer line. The verb follows the status the document landed in (posted, approved, submitted for approval, held for approval, sent, saved); a held or pending one is amber. An array gives "12 invoices posted" |
| `fail(errorOrResult, title?)` | a refusal as a red toast: the message, and a link to `error.docId` when the engine names the document to cancel first. For actions taken from a document view (approve, cancel, confirm receipt) |
| `confirmWithReason({title, message, body, confirmLabel, cancelLabel, tone, reasonLabel, reasonPlaceholder})` | `Promise<{ok, reason}>`: a modal that does not confirm until a reason is typed - for reject and cancel |
| `teaser({title, tier: 'iNeo' \| 'NeoX' \| 'Neo ERP', text, link, href})` | the locked card of SCOPE 4.12: one line, no figures, placed where a prospect would look for the feature. `'Neo ERP'` is for what the tier itself includes; no screen uses it since SCOPE decision 19. `link: false` leaves out the link to `#/system/tiers` |

**From the data layer.** What every document view needs from `HB.data.doc` and `HB.engine`, so that no page writes it again
(used by `js/pages/buy-orders.js` and `buy-receipts.js`; `docs/PAGES.md` shows them in place):

| call | notes |
|---|---|
| `docActions({view, labels, ask, before(op), moved(op, result, before), done(op, result)})` | the `actions` of a `docView`, built from `HB.data.doc.view(id).actions`: approve, reject, cancel and confirm receipt, each only in the states where it makes sense, and for the view of a posted dispatch sheet its one action, `cancelDispatch`. One the persona may not take comes back disabled with the reason of the rights or of the engine (`HB.engine.check`) and, for a cancellation with dependants, a link to the document to cancel first. Reject and the two cancels ask for a reason. Each goes through `HB.engine.act` (`{id}`, `{id, reason}`, or `{sheetId, reason}` for a sheet); a success shows `postedToast` with what `moved` returns (default: the reason typed), a refusal shows `fail`. `labels: {cancel: 'Cancel the order'}`; `ask: {cancel: 'what the dialog says the cancellation undoes'}`; `before(op)` is read just before the engine acts and handed to `moved` (for `changes`). For `cancel`, `result.target` is the cancelled document and `result.doc` the `CXL`; for `cancelDispatch`, `result.targets` are the cancelled invoices (the toast counts them: "13 invoices cancelled") and `result.docs` their cancellations. Add the page's own actions to the array it returns. A screen that is not a `docView` (the Dispatch screen) draws the action itself from what this returns: `{label, icon, danger, reason, docId, onClick}` (`js/pages/sell-dispatch.js`) |
| `docNotice(view, {waiting})` | the `notice` of a `docView`: who cancelled or rejected the document, when and why; for one that waits, "Waits for the Owner" with `waiting`, the page's sentence on why. `null` when there is nothing to say |
| `timelineOf(id)` | the `timeline` of a `docView`: `HB.data.doc.timeline(id)` as events, oldest first |
| `relatedOf(id)` | the `related` of a `docView`: `HB.data.doc.related(id)`, each a link with what it is, its date and amount |
| `missingDoc(id, {onBack, backLabel})` | what a page draws when `ctx.docId` names nothing the persona may see |
| `startDraft(pageId, init, {key})` | open **another** page's form on a prefilled draft ("Receive goods" on an order): puts `forms.draft(init)` into that page's state under `key` (default `'form'`) and navigates there. If that page holds a draft with something typed in, it asks before replacing it. `Promise<boolean>` |
| `changes(beforeRows, afterRows, key, field)` | `[{key, row, before, after}]`: the rows of a selector whose `field` is no longer what it was. How a page finds what an operation moved without computing it: read the selector, call `HB.engine.act`, read it again |
| `uniqueRows(listA, listB, ...)` | one list, a row with the same `id` only once: for a list that joins two selector calls (the open documents of any date, and the range of the filter bar) |

### 4.11 Printing
| call | notes |
|---|---|
| `printSheet({title, number, date, copy, seller, party, meta, columns, rows, footer, totals, notes, signatory})` | builds the paper form of a document: a header block (seller left; title, number, date and copy right), the party and a meta list, a table, the totals, notes and two signature lines. `seller` defaults to `HB.masters.company`; `party` is `{label, name, lines: [...]}`; `columns` are `{key, label, align, format, width, value(row, i)}`; `signatory: false` leaves the signature lines out. Returns a node - show it in a modal as a preview, or hand it to `printDoc` |
| `printDoc(node, {title})` | prints **only that node**: a copy goes into a print-only host, `css/print.css` hides the shell, the browser's print dialog opens, and the copy is removed afterwards. `title` names the print job (and a saved PDF): pass the document id |

On paper the document flows over as many pages as it needs: the table header repeats on every page, no line splits, and the header
block, the totals and the signature lines each stay in one piece. `printDoc` takes any node - a `printSheet`, or a `docView`
(buttons, the back link and the action card are left out). The browser's own Print on any screen also works: the sidebar, the bars
and the buttons go, and the content flows.

The printed title of an invoice follows its lines (SCOPE 4.5): "Tax invoice" when every line is taxable, "Bill of supply" when
every line is Nil-rated, "Invoice-cum-bill of supply" when it has both; the same lines without prices are the delivery challan.

### 4.12 Worked example: a document page
The worked example is a real page: `js/pages/buy-orders.js` (list, form, view) and `js/pages/buy-receipts.js` (a form opened
from another document, a toast that says what moved). `docs/PAGES.md` walks through them and is the guide for every other page.
The shape, in short:

```js
HB.router.register({
  id: 'buy-orders', route: '#/buy/orders', group: 'Buy', title: 'Purchase orders', filters: ['date'],
  render: function (rootEl, ctx) {
    if (ctx.docId) return view(rootEl, ctx);         // '#/doc/PO-...': the hash decides
    if (ctx.state.form) return form(rootEl, ctx);    // a draft is open: it survives redraws, persona switches and visits elsewhere
    list(rootEl, ctx);
  }
});
```
- `list` is one `forms.docList` over a selector; `form` is one `forms.docForm` whose `onPreview` returns `HB.engine.preview(...)`
  and whose `onSubmit` returns `HB.engine.act(...)`; `view` is one `forms.docView` over `HB.data.doc.view(ctx.docId)` with
  `forms.docNotice`, `relatedOf`, `timelineOf` and `docActions`.
- The draft is `ctx.state.form`; "New" creates it (`forms.draft()`), posting or cancelling clears it. (`render` returns
  `undefined` in every branch: only a function returned from `render` is a cleanup.)
- The page computes nothing the engine computes. The one use of `HB.money.amount` shows a line value while the user types; the
  totals and where the document will land come from the preview.
- A document that opens over another screen (an approval with its evidence) is the same view in a drawer:
  `ui.drawer({ wide: true, title: forms.docTitle(v), body: forms.docView({ compact: true, ... }) })`.

---

## 5. CSS available to pages

Page-specific rules go in `css/pages/p-<page id>.css` (already linked from `index.html`), every selector prefixed with the page
root class (`.pg-<page id> ...`), colours only as `var(--token)`. A page that needs no rules has no file.

| purpose | classes |
|---|---|
| Grid | `mk-grid` + `mk-grid--1..6` (equal columns) or `mk-grid--12` with children `mk-col-1..12`; `mk-grid--tight` (8px gap), `mk-grid--start` (top-align). 4-6 columns relax below 1180px |
| Flex | `mk-row` (+ `mk-row--wrap`, `--between`, `--end`, `--top`, `--baseline`), `mk-stack` (+ `mk-stack--1/2/3/5/6`), `mk-grow`, `mk-gap-1/2/3/4/6` |
| Spacing | `mk-mt-0/1/2/3/4/6`, `mk-mb-1/2/3/4/6`, `mk-pad-0`, `mk-divider` (hairline `<hr>`-like div) |
| Headings | `mk-h1` 24px, `mk-h2` 18px, `mk-h3` 15px, `mk-eyebrow` (small caps label), `mk-label` |
| Text | `mk-muted` (ink-2; the muted tone for anything a reader must read), `mk-faint` (ink-3; below 4.5:1 on every surface - icons, placeholders and disabled states only, never sentences), `mk-small` 12px, `mk-xs` 11px, `mk-strong`, `mk-num` (tabular figures), `mk-nowrap`, `mk-truncate`, `mk-right`, `mk-center`, `mk-good` / `mk-bad` / `mk-warn` (status ink - always next to an icon or sign), `mk-link`, `mk-sr` (screen-reader only) |
| Table rows | `is-selected`, `is-muted`, `is-strong` via `rowClass` |
| Legend dot | `mk-legend-dot` + inline `style="background: var(--series-1)"` |

Spacing scale is 4px (`--sp-1..8`), card radius `--radius`, type sizes `--fs-xs..hero`. The accent is The Biz CFO's electric blue (`--accent`,
white text on it; text in the brand colour uses `--accent-text`, the deeper blue). Do not restyle `mk-*` component classes from page CSS. The CSS class prefix stays `mk-` (inherited, not
user-visible); the JavaScript global is `HB`.

## 6. Shell - `HB.app`

Boot order in `js/app.js`: `HB.engine.boot()` when the data layer is there (inside try/catch: a failure is reported in a banner and
the shell still comes up), then the sidebar and the top bar, then `HB.router.start`. Nothing in the shell assumes that a data file
or a page file is present. There is no simulated loading: a screen is drawn when its figures are computed.

Top bar: the page title, the **business date** ("Business date 2 Oct 2026" - `HB.calendar.today`), the persona switcher
(`HB.session.users`; a switch emits `session:changed` and the router redraws), and a menu with **Fresh copy dated today** and, when
served behind the sign-in, **Sign out**.

| call | meaning |
|---|---|
| `HB.app.freshCopy()` | asks, then discards the user's entries and starts again from today's date (`HB.engine.freshCopy()`; without a data layer it clears the log, sets the calendar and reloads). The new copy opens on the dashboard with the filters as on a first open; the persona stays. Returns a promise of whether it went ahead. "Fresh copy dated today" in the menu at the top right calls this, and so do the calendar banner and the banner of a failed build |
| `HB.app.banner(id, {text, tone: 'warn' \| 'info' \| 'critical', action: {label, onClick}})` | sets one banner row above the top bar; `HB.app.banner(id, null)` clears it. Ids, in display order: `engine storage notice skipped calendar message` |
| `HB.app.showBanner(message \| '')` | sets or clears the `message` banner |

Banners the shell raises on its own, re-read after every change to the store:

| Banner | When |
|---|---|
| The sample data could not be built | `HB.engine.boot()` threw; offers a fresh copy |
| This browser is not saving changes | `HB.store.ok` is false (storage unavailable, or a write failed) |
| (a sentence from the data layer) | `HB.engine.notice` is a non-empty string - for example a copy replaced because the seed version changed |
| n of your entries no longer apply to this copy and were skipped | `HB.engine.skipped` is a non-empty array; "Show them" lists each in words. An entry is read as `{n, op, args, out, reason \| message \| error}` or `{entry: {...}, reason}` |
| This copy is dated ... Today is ... | `HB.calendar.movedOn()`; offers "Start a fresh copy dated today". When the device's date cannot be a business date (the factory is closed, or the day is outside the sample's range) the sentence says so and the button names the date a fresh copy takes |
| Today is ... The factory is closed today, so this copy is dated ... | a copy first opened on such a day: the device's date differs from the business date though the calendar has not moved on. No action |

A form that is filled in and not posted lives in the page's per-route state only. While `HB.router.dirtyDrafts()` lists one, the
shell answers `beforeunload`, so a reload or a closed tab asks first in the browser's own words. It does not ask when the reload is
the sample's own: a fresh copy just confirmed, or another tab that changed this copy.

The shell also wires the "Skip to content" link (it focuses `#mk-content` and never touches the hash) and publishes `--gutter-w`,
the width of the content column's scrollbar gutter, which `css/base.css` uses to give the top bar and the filter row the same
measure as the page (24px gutters; past 1440px the same centred column).

**Sign-in.** Served by `tools/serve.js` the app sits behind a sign-in: the server answers nothing of the app without a session
cookie and shows `login/login.html` instead. The shell only reflects that: at boot it asks `GET /auth/session` (over http or https
only; opened as a file there is no server to ask) and, when the answer names a user, the menu gains **Sign out**, which posts an
empty form to `/logout`. Nothing in the app checks a password; a page author has nothing to do for it.
