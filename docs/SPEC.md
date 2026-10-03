# Happy Bakers - Neo ERP (Tier 1) sample: build specification

Binding for everyone who writes code here. Read with:

- `docs/SCOPE.md` - what is in and out, and why (agreed with the owner; do not re-decide it).
- `docs/RESEARCH.md` - every business parameter (products, prices, recipes, customers, people, calendar).
- `docs/shell/UI-API.md`, `docs/shell/CHARTS-API.md` - the UI kit and chart wrapper inherited from the
  Miya Kebabs sample (written for the `MK` namespace; here the global is `HB`).
- `docs/API.md` - the data layer as built (written by the data-layer authors; the authority on shapes).

Where this file and SCOPE.md disagree, SCOPE.md wins and this file has a bug - say so.

---

## 1. What makes this sample different

Every figure on every screen is derived from documents, and the user can add documents. There is one
posting engine; the seed simulation and the forms both go through it. A page never computes a business
figure itself and never holds a literal number: it calls a selector.

## 2. Hard constraints

1. **Runs by double-clicking `index.html`**, offline: classic `<script src>` tags only. No ES modules,
   no `import`, no `fetch` of local files, no build step, no CDN, no web fonts, no packages.
2. One global: `window.HB`. Every JS file is an IIFE
   `(function (root) { ... })(typeof window !== 'undefined' ? window : globalThis);`
   and tolerates optional dependencies being absent.
3. `js/core/kernel.js` and everything in `js/data/` also run under **Node** with no DOM
   (`tools/check.js` loads them with `require`).
4. **No emojis anywhere.** Icons are inline SVG from `HB.ui.icon()`.
5. **No hard-coded colours** in JS or page CSS: use the custom properties in `css/tokens.css`.
6. Light theme, desktop layout (1024px and up). It must not break below that; it need not be pretty.
7. User-typed strings reach the DOM as text nodes (`HB.ui.h()` children / `textContent`), never
   through concatenated `innerHTML`.
8. **Money is integer paise** everywhere in JavaScript. Rates, prices and unit costs are numbers in
   paise per unit and may be fractional; a typed rate is held as `Math.round(rupees * 10000) / 100`
   paise; MRP is whole paise. `HB.money.amount(qty, rate)` is the only function that turns a quantity
   and a rate into money: `sign x Math.round(Math.abs(Math.round(qty * 1000) * rate) / 1000)`, so
   halves round away from zero and a negative value is the exact opposite of the positive one. It is
   called once, when the document is entered, and the result is stored on the line; the tax formulas
   are in section 5.2. Totals are sums of stored line values. Only `HB.fmt` and the input controls
   convert to and from rupees.
9. **Quantities** are numbers with at most three decimals (`HB.q3(x)` after every arithmetic step).
   Finished goods are whole units.
10. Deterministic: only `HB.rng(seed)`; never `Math.random()`. The only clock read in the whole code
    base is `HB.calendar.realToday()` (local year, month and day - never `toISOString()`).
11. Every number on screen comes from the data layer. No literal figures in page code, including in
    sentences.
12. CSS class prefix stays `mk-` (inherited, not user-visible). The JS global is `HB`; the storage
    prefix is `hb.v1.`.
13. Nothing outside SCOPE.md section 4 is built. No empty menu items. Upgrade teasers only as listed in
    SCOPE.md 4.12.

## 3. Files, load order, owners

```
index.html
css/tokens.css base.css components.css charts.css forms.css print.css
css/pages/p-<page>.css                 one per page file, optional
vendor/echarts.min.js
js/core/kernel.js      HB: bus, fmt, dates, rng, q3, store, calendar, session (personas, rights)
js/data/config.js      HB.config: static master data and simulation parameters from RESEARCH.md
js/data/engine.js      HB.book (state) and HB.engine (posting, actions, validation, masters, log, boot)
js/data/seed.js        HB.seed: the day-by-day simulation
js/data/data.js        HB.data: every selector the pages use
js/core/ui.js charts.js filters.js router.js   the shell (adapted)
js/core/forms.js       HB.forms: document form, line grid, decimal inputs, document view, print
js/pages/<page>.js     one file per page (section 9)
js/app.js              boot
tools/check.js         Node self-check        tools/serve.js   static server with the sign-in
docs/                  SCOPE.md RESEARCH.md SPEC.md API.md shell/UI-API.md shell/CHARTS-API.md
```

Script order in `index.html`: echarts, kernel, config, engine, seed, data, ui, charts, forms, filters,
router, every page file, app. `index.html` lists every page file and page stylesheet named in section 9
from the start, so page authors never edit it; a missing file must not break boot.

## 4. Kernel (`HB`)

Keep from the inherited kernel: `HB.bus`, `HB.dates`, `HB.hash`, `HB.rng`. Change:

- `HB.fmt` takes **paise**: `inr(p)` compact (Rs 1.08 Cr, Rs 12.4 L, Rs 45,200), `inrFull(p)` whole
  rupees with Indian grouping, `inr2(p)` rupees with two decimals (documents and registers),
  `num(n, d)`, `pct(x, d)`, `qty(q, unit)` ("12.5 kg", "240 pcs"), `rate(p)` (rupees with up to four
  decimals, trailing zeros trimmed). `fmt.delta` and `fmt.points` stay in the kernel only because the
  inherited chart wrapper calls them; pages do not call them and pass no delta and no spark to a tile.
- `HB.q3(x)`, `HB.money.fromRupees(r)` -> paise, `HB.money.toRupees(p)`, `HB.money.amount(qty, rate)`
  (section 2, item 8).
- `HB.calendar` = `{ goLive: '2026-01-01', today, dataEnd, realToday(), set(iso), lockBefore }`.
  `today` is the **business date** of this copy: read once from `realToday()` on first open and stored;
  `dataEnd` = the day before; `lockBefore` = first day of the month before `today` (months before it are
  locked). A business date before `2026-02-01` or after `2027-12-31` is clamped into that range.
  `set(iso)` exists for Node checks and for "fresh copy"; it stores the date in `meta`, so the manual
  load test for 31 December 2027 is `HB.calendar.set('2027-12-31')` and a reload. The "calendar has
  moved on" banner compares the clamped real date with `today`: it shows only when
  `clamp(realToday()) > today`.
- `HB.store`: `get/set/remove/resetAll` as inherited (prefix `hb.v1.`), plus `HB.store.ok` (false when
  a write failed or storage is unavailable) and a `storage` event listener that reloads the page when
  another tab changes the copy. Keys in use: `meta` (`{businessDate, seedVersion}`), `log` (array, the
  user's operations), `prefs`.
- `HB.session`: personas, rights, page access and scope (section 7).

## 5. Data model

### 5.1 Masters (`HB.config` -> live in `HB.masters`)

`HB.config` is static and comes from RESEARCH.md. `HB.masters` is what the app reads: config plus the
seed's dated master changes plus the user's master changes, in that order.

```
company     { name, legalName, gstin, address, stateCode: '24', bankName }
units       factory, st_anand, st_vvn, st_nadiad            ('unit' = a place that spends and sells);
            each store unit carries standing: { itemId: qty }, its fixed daily stock level
locations   fac_rm (raw store), fac_fg (finished store), st_anand, st_vvn, st_nadiad,
            transit_st_anand, transit_st_vvn, transit_st_nadiad
accounts    cash_factory, cash_st_anand, cash_st_vvn, cash_st_nadiad, bank
items       { id, code, name, kind: 'fg'|'rm'|'pk', unit, pack, hsn, gstRate,
              shelfLifeDays (fg), price: { mrp, retail, corporate } (fg; mrp includes GST, the others do not),
              reorderLevel, orderQty, leadDays, vendorId (rm, pk), active }
recipes     { itemId, mixLabel, expectedUnits, materials: [{ itemId, qty }], packing: [{ itemId, qtyPerUnit }],
              rhythm, standardMixes }           rhythm: 'daily' or weekdays; standardMixes: mixes per run
routes      { id, name, stops: [customerId...] }
customers   { id, name, channel: 'retail'|'corporate', outletType, routeId, locality,
              terms: 'cash'|'weekly'|'credit', creditDays, creditLimit, gstin, standing: { itemId: qty },
              pattern (corporates), active }
vendors     { id, name, kind: 'stock'|'expense'|'staff', town, gstin, termsDays, supplies, active }
            exactly one vendor has kind 'staff' ("Staff salaries"): the payee of every salary bill
employees   { id, name, dept, designation, unitId, doj, dol, salary, phone, active }
expenseCategories  { id, name, mode: 'claim'|'bill'|'both' }
users       the six personas (section 7), each linked to an employee
limits      { poAutoApprove: 50,00,000 paise, billTolerancePct: 2, returnsPct: 8, backDateDays: 3,
              nearExpiryDays: 1, dueSoonDays: 7,
              warn: { yieldLowPct: 80, yieldHighPct: 105, countAwayPct: 20, countMinValue: 50,000 paise,
                      claimAbove: 5,00,000 paise, rateAwayPct: 25, dayEndAwayPct: 10 } }
            warn: the thresholds of the warnings on unusual figures (section 5.5), each outside what
            RESEARCH.md says an ordinary day gives
journeys    the guide journeys (section 8.1)
```

Master changes are operations (`'master'` and `'setActive'` through `HB.engine.act`), logged with before
and after. A change affects new documents only. Entities: `items` (with prices), `recipes`,
`customers`, `vendors`, `expenseCategories`, `employees` (right `employee.edit`), `locations`. A
location that is added is an own store: the one operation creates the unit, its stock location, its
transit location and its cash account. Editing a location changes its name and, for a store, its
standing quantities. A store can be deactivated only when it holds no stock and no cash; the two
factory stores cannot be deactivated. Pages and selectors list units, locations and accounts from
`HB.masters`, never from fixed ids. Company, routes, users and limits have no form.

The standing quantities and the standard day plan are masters, not forecasts. An outlet's `standing`
prefills its dispatch sheet; a store's `standing` prefills its transfer (section 5.5); the **standard
day plan** for a date is every recipe whose `rhythm` includes that weekday, at its `standardMixes`.
`orderQty`, `leadDays`, `vendorId` (items) and `pattern` (customers) drive the seed only: no form shows
or edits them and no selector returns them. The same holds for every simulation parameter in
`HB.config` (demand multipliers, events, rain, noise, return rates, yield draws): `seed.js` alone reads
them, and no engine call, selector or page exposes the seed's demand model.

### 5.2 Documents

Common fields: `{ id, type, date, status, createdBy, createdAt, seed: bool, createdAs, note,
approval: { state: 'none'|'pending'|'approved'|'rejected', by, at, reason, self },
cancelled: { by, at, reason, docId } }` (`docId` = the cancellation document, section 5.3). `createdAs` is
display only: on a seeded store document, the store's own manager whom the screens name as having entered it.
A document a user entered with a warning (section 5.5) also carries `warned: [code, ...]`; no other
document has the field.

Ids: seeded `TYPE-YYMMDD-NNN` (sequence per type per day, independent of where the seed ends); user
`TYPE-U-NNNN`, fixed in the log entry that creates it (section 5.6). Batch ids `B-YYMMDD-<item code>`
(suffix `-2`... for a second run the same day). `createdAt` is `YYYY-MM-DDTHH:MM` - a synthetic clock:
seeded documents follow the day's timetable, a user's document takes the time of its log entry.

| Type | Fields beyond the common ones | Status | What posting does |
|---|---|---|---|
| `PO` | vendorId, expectedDate, lines[{itemId, qty, rate, gstRate, amount, received}], total | PENDING, APPROVED, PART_RECEIVED, RECEIVED, REJECTED, CANCELLED | Nothing to stock or money, and no tax is computed (`gstRate` is copied from the item to prefill the bill). `total` is the sum of the line amounts, before GST, and is the figure tested against the limit: `total <= limits.poAutoApprove` is APPROVED on submit (`approval.state 'none'`, audit says "within limit"); above, PENDING. Receipts add to `received`; the order is PART_RECEIVED while any line has `received < qty`, RECEIVED when none has |
| `GRN` | poId, vendorId, lines[{itemId, qty, rejectedQty, rate}], billId | POSTED, CANCELLED | Needs an APPROVED / PART_RECEIVED order. `qty` is the quantity accepted: it goes into stock at `fac_rm`, adds to the order line's `received`, is the quantity to be billed, and cannot exceed ordered less already received. `rejectedQty` is a record only (goods sent back): no stock, no payable, and the order stays open for it. `rate` is copied from the order line and cannot be typed. **Sets the item's latest purchase price to `rate`**; "latest" always means the uncancelled receipt posted last (posting order, not document date) |
| `VBILL` | vendorId, billNo, grnIds[], lines[{itemId, qty, rate, gstRate, taxable, cgst, sgst}], taxable, gst, total, dueDate, match{ok, diffs[]}, paid, opening | HELD, POSTED, REJECTED, CANCELLED | A bill takes whole receipts of its vendor and links them (`billId`) as soon as it is entered, HELD or POSTED; a receipt has at most one bill that is not REJECTED or CANCELLED. Three-way check per item: expected = the sum over those receipts of `amount(qty, rate)`. The bill is HELD until approved when, for any item on the bill or on its receipts, billed taxable differs from expected, either way, by more than `billTolerancePct` % of expected, or the item is billed but not on the receipts. `match.diffs[]` lists per item the ordered rate, the accepted quantity, the billed quantity and rate, and the expected and billed value. On POSTED: payable to the vendor for `total`; input GST entry. Does not touch stock or the purchase price. Duplicate `billNo` for a vendor is refused. `dueDate = date + termsDays` |
| `PAY` | payeeType 'vendor' or 'employee', payeeId, account 'cash_factory' or 'bank' (a salary bill: 'bank' only), amount, allocations[{docId, amount}], ref | POSTED, CANCELLED | Money out of `account` (cannot go below zero); `amount` equals the sum of its allocations; reduces the allocated vendor bills, expense bills, salary bills or claims; an expense fully paid becomes PAID |
| `PROD` | itemId, mixes, goodUnits, rejectedUnits, expectedUnits, batchId, consumption[{itemId, qty, rate, value}], unitCost, lossValue | POSTED, CANCELLED | Consumes recipe materials x mixes and packing x goodUnits from `fac_rm` (refused, naming the material, if short); creates the batch at `fac_fg` with `mfgDate = date`, `bestBefore = date + shelfLifeDays`; P&L production loss = `lossValue` = `amount(expectedUnits - goodUnits, unitCost)` (may be negative) |
| `SO` | customerId, deliveryDate, poRef, lines[{itemId, qty, price}], invId | OPEN, INVOICED, CANCELLED | Nothing until invoiced. Its invoice sets INVOICED and `invId`; cancelling that invoice returns it to OPEN. An invoice for less than the order closes it all the same: there is no back-order (SCOPE decision 16), and the delivery form says so |
| `INV` | customerId, channel, routeId, sheetId, soId, terms, dueDate, lines[{itemId, qty, price, gstRate, taxable, cgst, sgst, unitCost, cost, batches[{batchId, qty}]}], taxable, gst, total, creditApplied, paidNow, received, credited, opening | POSTED, CANCELLED | Stock out of `fac_fg`, oldest unexpired batch first (refused if short, naming item and quantity available); receivable for `total`; any unapplied credit of the customer is applied first (`creditApplied`); for `terms 'cash'` the rest is collected into `cash_factory` at once (`paidNow`); P&L sales = taxable by channel and item, cost of goods sold = sum of line `cost` (unit recipe cost at this moment); output GST entry. `dueDate` = date for cash, date + 7 for weekly, date + creditDays for credit |
| `RCPT` | customerId, account 'cash_factory' or 'bank', amount, mode, allocations[{docId, amount}], onAccount | POSTED, CANCELLED | Money in; reduces the allocated invoices; the unallocated part (`onAccount`) becomes customer credit |
| `CN` | customerId, lines[{itemId, qty, price, gstRate, taxable, cgst, sgst}], taxable, gst, total, sharePct, allocations[{docId, amount}], onAccount | HELD, POSTED, REJECTED, CANCELLED | A stale return. `sharePct` = 100 x (taxable of this return + taxable of the customer's other credit notes dated in the window with status POSTED or HELD) / (taxable of the customer's POSTED invoices dated in the window, opening invoices excluded). The window is the seven days from `date - 6` to `date`, both inclusive. It is computed once, when the note is raised, and stored to two decimals. The note is HELD until approved when `sharePct > limits.returnsPct` (exactly 8 posts) or when the divisor is zero (`sharePct` null, reason "no supply in the last seven days"). On POSTED: the engine allocates it to the customer's open invoices, oldest first, and any remainder (`onAccount`) becomes customer credit; P&L sales reduced (shown as "returns"); output GST reduced. No stock comes back and no cost moves |
| `XFER` | toStoreId, lines[{itemId, qty, batches[]}], receivedAt, receivedBy | SENT, RECEIVED, CANCELLED | SENT: `fac_fg` -> `transit_<store>`, oldest unexpired first. RECEIVED (the store confirms): transit -> the store |
| `DAYEND` | storeId, lines[{itemId, sold, expired, mrp, gstRate, gross, taxable, cgst, sgst, unitCost, cost, batches[]}], gross, taxable, gst, cash, upi, shortExcess, woId | POSTED, CANCELLED | One per store per date. Store stock out for `sold`, oldest unexpired first; line `gross` = `amount(sold, mrp)`, taxable = gross less the GST inside it (formula below); `cash` into that store's cash, `upi` into `bank`; `shortExcess = cash + upi - gross`, and `-shortExcess` is posted as an expense of that store in the category "Store cash short / excess" (a shortage is a cost); P&L sales by channel `store`, cost of goods sold; output GST. `expired` units become a `WO` in PENDING, linked by `woId` (batch rules below) |
| `DEP` | fromAccount, amount, slipRef | POSTED, CANCELLED | `fromAccount` -> `bank`. `fromAccount` is a cash account, never `bank`; `amount` is above zero and at most the balance of `fromAccount`. Not income or expense |
| `ADJ` | locId, reason, lines[{itemId, batchId, systemQty, countedQty, diff, rate, value}] | PENDING, POSTED, REJECTED, CANCELLED | `value = amount(diff, rate)` (negative for a shortage). On approval: stock moves by `diff`; P&L count differences = -sum(value) |
| `WO` | locId, reason 'expired', 'damaged' or 'other', sourceDocId, lines[{itemId, batchId, qty, rate, value}] | PENDING, POSTED, REJECTED, CANCELLED | On approval: stock out; P&L write-offs = sum(value). Rate: recipe cost for finished goods, latest price for materials. While PENDING its quantities are reserved (batch rules below) |
| `EXP` | kind 'claim', 'bill' or 'salary', payeeType 'vendor' or 'employee', payeeId, categoryId, unitId, billRef, monthKey (salary), lines (salary: [{unitId, headcount, amount}]), amount, gstRate, cgst, sgst, gst, total, dueDate, paid | PENDING, APPROVED, PAID, REJECTED, CANCELLED | On approval: payable to the payee for `total`; P&L expense = `amount` by category and unit (a salary bill: one entry per line), dated `date`; input GST entry. Payees and the salary bill: below |
| `CXL` | targetId, reason | POSTED | Created by `cancel` (section 5.3). Carries, under its own id and dated the cancellation date, the equal and opposite of every row the target wrote, at the values the target carried. Cannot itself be cancelled |
| `OPENSTOCK`, `OPENCASH` | opening stock per location (materials with rate; finished goods as batches), opening balance per account | POSTED | Seed only, dated go-live, never cancelled. Opening receivables are `INV` and opening payables `VBILL` with `opening: true`, a total and a due date, and no stock, sales or GST effect; they are never cancelled either |

Unit recipe cost of a product at a moment = sum(recipe material qty x latest price) / expectedUnits +
sum(packing qtyPerUnit x latest price).

**Money and tax arithmetic**, one rule for every document:

- Every quantity x rate goes through `HB.money.amount` (section 2, item 8): the line `amount` of a
  `PO`; `taxable` = `amount(qty, rate)` on a `VBILL` and `amount(qty, price)` on an `INV` and a `CN`;
  the line `gross` of a `DAYEND`; `cost`; `value` on `PROD` consumption, `ADJ` and `WO`; `lossValue`.
  On an `EXP`, `taxable = amount` as typed.
- Lines priced before GST (`VBILL`, `INV`, `CN`, `EXP`): `cgst = sgst = Math.round(taxable x gstRate /
  200)`; line total = `taxable + cgst + sgst`.
- `DAYEND` lines (MRP includes GST): `cgst = sgst = Math.round(gross x gstRate / (2 x (100 +
  gstRate)))`; `taxable = gross - cgst - sgst`, so the three add back to `gross` exactly and at Nil
  `taxable = gross`.
- Tax is only ever computed on a value of zero or more. A credit note stores positive values and
  writes negative sales and GST rows; a cancellation writes the negatives of the stored values.
  Neither recomputes anything.
- Document `gross`, `taxable`, `gst` and `total` are sums of the stored line values. `EXP` stores
  `cgst` and `sgst` as well as `gst`.
- GST entries carry `gstRate`. The GST summary is by rate and shows rate 0 as "Nil-rated", outside
  taxable turnover.

**Batch rules.**

- A batch is unexpired on a date d when `bestBefore >= d`: on its best-before date it can still be
  dispatched, transferred and sold. d is the document's `date`, for a back-dated document too.
- "Oldest unexpired first" means: the batches of the item at that location with quantity on hand now
  and `bestBefore >= d`, in order of `bestBefore`, then `mfgDate`, then batch id. `INV`, `XFER` and the
  `sold` quantity of a `DAYEND` take only such batches; the line stores the `batches[{batchId, qty}]`
  it took.
- Quantities on a PENDING write-off are reserved: no invoice, transfer, day-end or later write-off
  takes them, and "stock available" leaves them out. Stock in `transit_<store>` is available to nobody
  until it is received.
- Day-end: `sold` is allocated first. The `expired` quantity is then taken from that store's batches
  of the item with `bestBefore <= date`, counting only what remains after `sold` and is not reserved,
  oldest first; a quantity above that is refused. The `WO` it creates is raised by whoever posts the
  day-end and has `date` = the day-end date, `reason 'expired'`, `sourceDocId` = the day-end, one line
  per batch, and rate = the recipe cost when the day-end is posted. No expired units, no `WO`.
- Flags (stock pages, dashboard, notification log): a batch is expired when `bestBefore` is before the
  business date, and near-expiry when it is not expired and `bestBefore` is within
  `limits.nearExpiryDays` of the business date.

**Dispatch sheet.** A dispatch sheet is not a document: it is the set of invoices that share
`sheetId = 'DS-<routeId>-<YYMMDD>'` (the sheet's date); the seed uses the same id. One sheet per route
per date: `postDispatch` is refused while any uncancelled invoice carries that `sheetId` (further
supply to an outlet that day is a single `INV`). `postDispatch` is all or nothing: it adds up each
product over all outlets and, if any exceeds the stock available at `fac_fg` (unexpired, not
reserved), refuses the whole sheet, listing each short product with the quantity available; otherwise
it posts one `INV` per outlet in route stop order, skipping outlets whose quantities are all zero, as
one log entry. A sheet is "to post" for `sell.sheets(date)` and `dash.work()` when no uncancelled
invoice carries its `sheetId`.

A posted sheet is cancelled in one operation, `cancelDispatch` `{ sheetId, reason }` (SCOPE decision 15):
every uncancelled invoice that carries the `sheetId`, in the order the sheet posted them, each by a
`CXL` of its own (which carries the `sheetId` too) and all with the one reason, which is mandatory.
It is all or nothing: every invoice is tested against the cancel table of section 5.3 before the first
is touched, and one that cannot be cancelled, because a receipt or a credit note is allocated to it, refuses
the whole operation with `has_dependants`, the message naming that invoice and `docId` the document
that rests on it. It is one log entry, with one `CXL` id per invoice fixed in it (section 5.6); the
rights are those of `postDispatch`: sales and the Owner. An invoice of the sheet that was cancelled
alone before is left as it is. Afterwards no uncancelled invoice carries the `sheetId`: every figure
is back where it was before the sheet was posted, the sheet is "to post" again, and `postDispatch`
takes it once more, under the date rules of section 5.3 like any posting. Those rules do not hold the
cancellation back (it is dated the business date), so a sheet of a locked month is cancelled for good,
and one dated further back than `backDateDays` can be posted again by the Owner only:
`HB.engine.dateCheck` gives the rule for the day beforehand, and the Dispatch screen says which of the
three it is in its dialog, its toast and its callout. A sheet with no uncancelled invoice has nothing
to cancel (`not_found`).

**Receivables.** Only these write a receivable entry for the customer: `INV`, +`total` (opening
invoices included); the cash collected with a cash invoice, -`paidNow` (same `docId`, kind
'collected', with a cash entry into `cash_factory`); `RCPT`, -`amount`; `CN`, -`total`; and the
reversals of these. Applying credit to an invoice and allocating a receipt or a credit note are
allocations, not entries: they change invoice open amounts and the customer's unapplied credit, never
the customer's balance.

- Invoice open amount = `total - creditApplied - paidNow - received - credited`, never below zero.
  `received` and `credited` count allocations of uncancelled POSTED receipts and credit notes only.
- Customer unapplied credit = sum(`RCPT.onAccount`) + sum(`CN.onAccount`) - sum(`INV.creditApplied`),
  each sum over POSTED documents that are not cancelled; never below zero (section 5.3 says how a
  cancellation keeps it so).
- Customer balance = sum of the customer's receivable entries = sum(invoice open amounts) - unapplied
  credit.
- On `INV`: `creditApplied = min(unapplied credit, total)`; for `terms 'cash'`
  `paidNow = total - creditApplied`, otherwise `paidNow = 0`.
- `RCPT`: each allocation is at most the invoice's open amount; `onAccount = amount -
  sum(allocations)`, zero or more.
- `CN`: `allocations` and `onAccount` are set by the engine when the note becomes POSTED (a held note:
  at approval), over the customer's open invoices in order of `date`, then posting order;
  `onAccount = total - sum(allocations)`.
- Ageing buckets hold invoice open amounts by `dueDate`; unapplied credit is a separate negative
  column, not netted into a bucket.
- "Collections" on every screen = `paidNow` + receipts.

**Payables and payees.** Only these write a payable entry: `VBILL` on POSTED, +`total` (opening bills
included); `EXP` on APPROVED, +`total`; `PAY`, -`amount`; and their reversals. `PAY.amount` must equal
the sum of its allocations; each allocation is at most the open amount (`total - paid`) of a POSTED
bill or an APPROVED expense of the same payee. There are no advances and no payments on account.
Payee balance = sum of its entries = sum of open amounts.

- Vendor bill and expense bill: `payeeType 'vendor'`, `payeeId` the vendor (kind 'stock' or
  'expense'); `dueDate = date + termsDays`.
- Claim: `payeeType 'employee'`, `payeeId` the employee linked to the persona who raised it; `gstRate`
  0; `dueDate = date`.
- Salary bill: `payeeType 'vendor'`, `payeeId` the one vendor of kind 'staff'; no GST;
  `dueDate = date`; paid from `bank` only. It carries `monthKey`, and section 5.5 says for which months
  one can be raised.
- `ap.balances()` and `ap.ageing()` list vendors, the "Staff salaries" vendor among them; approved
  unpaid claims appear only in `ap.toReimburse()`.

### 5.3 Actions on documents

`approve(id)`, `reject(id, reason)` (reason mandatory), `cancel(id, reason)` (reason mandatory),
`receiveTransfer(id)`. `approve` and `reject` act only on PENDING or HELD; `receiveTransfer` only on
SENT. `cancelDispatch(sheetId, reason)` is `cancel` for every invoice of a posted dispatch sheet at
once (section 5.2).

- Approval: only the Owner approves. For every other persona the rule "you cannot approve what you
  raised" also holds (kept in the rights check so it survives a change of approver, and tested before
  the role - section 7). The Owner may approve the Owner's own document; `approval.self = true` and the
  audit entry says so. A document the Owner raises that would need approval is approved in the same
  operation; that includes the write-off created by a day-end the Owner posts.
- Posting on approval (`ADJ`, `WO`, `EXP`, a held `CN`, a held `VBILL`): the document is computed
  once, when it is entered - lines, rates, values, GST, `sharePct` and the three-way result are stored
  then, and approval does not recompute them. Approval only writes the rows, and every row carries the
  document's `date`, whenever it is approved (the approval day is in `approval.at` and the audit
  trail). Stock is tested at approval: if a line would take stock below zero the approval is refused,
  naming the item and batch. Rejecting a `VBILL` clears `billId` on its receipts.
- Cancel: by a persona who may create that type, or the Owner, and only in the states of the table
  below; elsewhere it is refused with the reason and, where a document rests on the target, the id of
  the document that must be cancelled first. `cancel` creates a `CXL` document (user id `CXL-U-NNNN`,
  seeded `CXL-YYMMDD-NNN`) dated the cancellation date (the business date for a user). The target
  keeps its own rows on its own date, takes status CANCELLED and `cancelled: { by, at, reason, docId }`
  pointing at the `CXL`. The `CXL` carries, under its own id and with `reversal: true`, the equal and
  opposite of every row the target wrote - stock (back to the same batches and locations), receivable
  / payable, cash, P&L and GST - from the values stored on the target; nothing is recomputed. A target
  that has written no rows (a PENDING order, an OPEN sales order, a HELD bill) still gets a `CXL`, with
  no rows. Books and registers show the reversal rows as "Cancellation of <id>" with the reason;
  `doc.related` links the two. Post then cancel returns every figure to its earlier value.
- Cash guard: no document a user posts may take a cash or bank account below zero; balances are tested
  as they stand now, in posting order, whatever the document's date (`PAY` and `DEP`, section 5.2).
  Cancellations are not tested: SCOPE 4.9 allows a payment, receipt or deposit to be cancelled at any
  time, so a cancellation may leave an account below zero and the cash book shows that balance.
- Dates: `date` cannot be in the future. A persona other than accounts and Owner may go back at most
  `limits.backDateDays`; accounts and Owner to any date on or after `calendar.lockBefore`; nobody
  before it. A back-dated document is posted now: checked against stock on hand now, oldest unexpired
  first over the batches on hand now, never re-running history.

What can be cancelled, and what the cancellation does besides reversing the rows:

| Type | Can be cancelled while | Also |
|---|---|---|
| `PO` | PENDING or APPROVED (no uncancelled receipt) | |
| `GRN` | POSTED, with `billId` empty and the full quantity of every line still at `fac_rm` | `received` on the order falls and its status is recomputed (APPROVED or PART_RECEIVED); the latest purchase price goes back to the uncancelled receipt posted last, or the opening rate |
| `VBILL` | HELD; or POSTED with no payment allocated (`paid = 0`) | Clears `billId` on its receipts |
| `EXP` | PENDING; or APPROVED with no payment allocated (`paid = 0`) | |
| `PAY` | POSTED, at any time | Reopens its bills and claims; an expense goes from PAID back to APPROVED |
| `SO` | OPEN (an INVOICED order: cancel its invoice first) | |
| `INV` | POSTED with `received = 0` and `credited = 0`; its own `paidNow` and `creditApplied` do not block | `paidNow` goes back out of `cash_factory` and `creditApplied` back to the customer's credit; an order it came from returns to OPEN |
| `RCPT` | POSTED, at any time | Releases its allocations (the invoices reopen) and withdraws its `onAccount` credit |
| `CN` | HELD; or POSTED, at any time | As `RCPT` |
| `PROD` | POSTED with the whole batch still at `fac_fg` | Materials and packing return to `fac_rm` |
| `XFER` | SENT | |
| `DAYEND` | POSTED while its write-off is not POSTED (otherwise cancel the write-off first) | A PENDING write-off is cancelled by the same `CXL` |
| `ADJ`, `WO` | PENDING or POSTED | |
| `DEP` | POSTED, at any time | |
| `CXL`, `OPENSTOCK`, `OPENCASH`, opening `INV` and `VBILL`, anything REJECTED | Never | |

No document and no balance ever blocks the cancellation of a payment, receipt or deposit (SCOPE 4.9).
When a cancelled `RCPT` or `CN` withdraws on-account credit that later invoices have already used, the
shortfall is taken back from those invoices, latest first: their `creditApplied` falls and their open
amount rises, so the customer's credit never goes below zero. Stock is the one balance a cancellation
is tested against: a cancellation that would take a stock quantity below zero (a `GRN` whose goods
were used, a POSTED `ADJ` that added stock) is refused, naming the item and the quantity short.

### 5.4 The book (`HB.book`)

In-memory state, rebuilt on every load: documents by id and by type; stock by location and item, and
by location, item and batch; the movement ledger (`{ seq, date, docId, locId, itemId, batchId, qty,
kind }`); batches (`{ id, itemId, mfgDate, bestBefore }`); receivable and payable entries and open
balances per document and per party; customer credit; cash entries and balances per account; P&L
entries (`{ date, line, channel, itemId, categoryId, unitId, amount, docId }` with `line` in sales,
returns, cogs, prodLoss, writeoff, countDiff, expense); GST entries (with `gstRate`); latest purchase
prices with their history; the audit trail. Screens read running balances and indexed lists; nothing
rescans the whole ledger to draw a tile.

Every row of every ledger (movement, receivable / payable, cash, P&L, GST) carries a posting sequence
`seq`, a `date` and a `docId`; a row written by a cancellation carries the id of the `CXL` and
`reversal: true`. "Never negative" and prefix stability are defined on `seq`, not on dates: the ordered
movement, cash, receivable / payable, P&L and GST rows and the ordered list of document ids produced by
`HB.seed.run(D)` are identical to the first rows and ids of `HB.seed.run(D')` for any later D'.

### 5.5 Engine API (`HB.engine`)

```
HB.engine.boot()                      build book: reset -> seed to calendar.dataEnd -> replay the user log
HB.engine.act(op, args)               the ONLY entry point for user operations. op in:
                                      'post' {type, payload} | 'approve' | 'reject' | 'cancel' |
                                      'receiveTransfer' | 'postDispatch' {routeId, date, outlets[...]} |
                                      'cancelDispatch' {sheetId, reason} |
                                      'master' {entity, record} | 'setActive'
                                      checks rights (HB.session), dates and inputs; fixes the log entry
                                      (time and ids, section 5.6); applies; appends it to the log; writes
                                      an audit entry; emits 'store:changed'.
                                      Returns { ok, doc|docs, error, warnings[] }
HB.engine.preview(type, payload)      same validation and computed figures (totals, GST, three-way result,
                                      returns share, warnings, stock available), nothing posted
HB.engine.dateCheck(date, role)       the date rules of section 5.3 alone, for a day with nothing to preview:
                                      { ok: true } or the refusal (future_date, locked_month, backdate_limit)
HB.engine.core.*                      the lean functions the seed calls directly (no rights, no log)
HB.engine.dispatchSheet(routeId, date) the prefilled sheet: each active outlet's standing quantities,
                                      unchanged, with the stock available per item
HB.engine.transferSheet(storeId, date) the prefilled transfer: per item, the store's standing quantity less
                                      the unexpired quantity already at the store or in transit to it,
                                      never below zero, with the stock available at fac_fg. No demand
                                      figure enters it
HB.engine.salaryBill(monthKey)        the proposed salary bill from the directory (rule below)
HB.engine.unitCost(itemId)            recipe cost now;  HB.engine.costSheet(itemId) the breakdown
HB.engine.freshCopy()                 clear the log, take realToday() (clamped) as the business date, reload
```

`error` is `{ code, message, field, docId }`: `field` names the input the form marks, `docId` the
document that must be cancelled first. Codes include `role`, `own_approval`, `future_date`,
`backdate_limit`, `locked_month`, `stock_short`, `cash_short`, `has_dependants`, `duplicate`,
`invalid_input`.

**Warnings** (SCOPE decision 18). A figure that looks wrong is posted all the same, with a warning.
`preview` and `act` return `warnings: [{ code, message, field }]`; the form shows each one before
posting, beside the input `field` names; the document keeps the codes in `warned`; and the audit entry
of its posting says "Entered with a warning: ..." with the sentences. A warning never refuses and never
changes what is posted, and a refusal carries none. The seed is never warned and no seeded document
carries `warned`. The thresholds are `limits.warn` (section 5.1) and live nowhere else: the engine
holds no value of its own, and a threshold the masters do not carry is a warning that never fires. Each
test is exact, so a figure exactly at its threshold raises nothing. The seven:

| Code | Document | Raised when | `field` |
|---|---|---|---|
| `yield_unusual` | `PROD` | `goodUnits` is below `yieldLowPct` % or above `yieldHighPct` % of `expectedUnits`, what the recipe expects for the mixes | `goodUnits` |
| `count_far` | `ADJ` | a line whose `countedQty` differs from `systemQty`, either way, by more than `countAwayPct` % of it, unless the difference is worth less than `countMinValue` | `lines[i].countedQty` |
| `over_order` | `INV` with `soId` | a line whose `qty` is above the quantity of that item on the order; an item the order does not have counts as ordered nil | `lines[i].qty` |
| `over_owed` | `RCPT` | `amount` is above everything the customer owes, the sum of the open amounts of its invoices. The message says how much will stay on account (`onAccount`) | `amount` |
| `claim_high` | `EXP` of kind 'claim' | `amount` is above `claimAbove` | `amount` |
| `rate_far` | `PO` | a line whose `rate` is more than `rateAwayPct` % away, either way, from the item's latest purchase price (no test for an item that has none) | `lines[i].rate` |
| `cash_far` | `DAYEND` | `cash + upi` differs from `gross`, the day's sales at MRP, either way, by more than `dayEndAwayPct` % of `gross` | `cash` |

The credit-limit warning for corporates (`credit_limit`, SCOPE 4.5) is older and stays as it was: it is
returned with the others, names no `field`, and is neither kept on the invoice nor written into its
audit entry.

Salary bill. A user may raise one only for a month whose last day is on or before the business date
and on or after `calendar.lockBefore` - that is, last month, and this month only on its last day;
`salaryBill(monthKey)` refuses any other month. For the seed and the user alike, a salary bill is
refused while another for that month is PENDING, APPROVED or PAID, naming that bill (code
`duplicate`). The bill is dated the last day of the month: one line per unit with the headcount and
the total salary of the employees with `doj` on or before that day and `dol` empty or on or after it.
On a business date that is not a month end, the way to raise one is to cancel last month's seeded bill
(its payment first, if it is paid) and raise it again; the check runs exactly that. Last month then
shows the salary twice and the business date's month shows it once negative; the total is unchanged.

Role, approval, back-date and input rules live in the engine, not in the forms, so `tools/check.js` can
reach them. A form shows what `preview` and `act` return; it does not re-implement a rule.

### 5.6 Persistence

`log` is append-only: `{ n, at, userId, role, op, args, out: { ids: [...], batchId } }`. Before
applying, `act` fixes `at` (business date, 09:00 plus one minute per entry, stopping at 23:59), the
document ids the operation will create, in order (`TYPE-U-NNNN`, the next number per type after the
highest in the log - a dispatch sheet takes one per outlet, a day-end one for its write-off, a
cancellation one `CXL`, the cancellation of a dispatch sheet one `CXL` per invoice it then has) and any
batch id, and stores them in `out`. The inner path is a function of the
book and the entry only: it takes user, role, time and ids from the entry and never reads `HB.session`,
a counter or the clock; `createdBy`, the Owner's same-operation approval and `approval.self` follow the
entry's role. Boot replays each entry as stored (rights are not re-checked on replay, validation is),
so a reload under any persona gives the same book. An entry that no longer applies is skipped, never
thrown; it leaves the ids of all later entries unchanged, and an entry that names a document missing
because an earlier entry was skipped is skipped as well; so is the cancellation of a dispatch sheet that
no longer has as many invoices as the entry fixed ids for. All skipped entries are listed in a banner.
Warnings are computed again on replay from the same book and the same entry, so `warned` and the
audit sentences come back as they were.
`meta.seedVersion` is a string constant in `seed.js`; on mismatch the log is discarded with a notice
and a fresh copy starts. If `HB.store.ok` is false a banner says changes will not survive a reload.

## 6. Seed (`HB.seed.run(toDate)`)

A day-by-day simulation from go-live to `calendar.dataEnd`, calling `HB.engine.core`. The history up to
any day D must not depend on where the run ends: random draws are keyed by date and entity, and no step
reads `toDate` or treats the last day differently (section 5.4 defines the test). Daily timetable:

1. Morning: the Owner approves everything left pending from the day before (orders above the limit,
   held bills, held returns, write-offs, adjustments, expenses).
2. Before dispatch, every expired batch still in `fac_fg` goes on one `WO` (reason 'expired'),
   approved the next morning.
3. 05:30 dispatch: per route and outlet, order = standing order x demand multipliers (weekday, month,
   events, rain) x noise, whole units, cut to unexpired stock. One `INV` per outlet, under the sheet id
   of section 5.2; then the stale returns from the previous delivery as a `CN` (rates from RESEARCH.md;
   the "high returns" outlet goes over the limit and waits for the Owner).
4. Corporate deliveries by each customer's pattern (`SO` a day or two earlier, `INV` on delivery).
5. 06:00 store transfers: each store's `transferSheet`, cut to stock; confirmed by the store at 07:30.
6. Goods receipts for orders due; some in two parts. A rejected quantity comes with a later receipt,
   so every seeded order ends RECEIVED.
7. Production through the day for tomorrow's dispatch and transfers, by each recipe's rhythm, in whole
   mixes: for each product due, the larger of tomorrow's hand-over quantity (below) and the simulated
   demand for tomorrow (a pure function of the date), added up over the days until the product's next
   run, less the unexpired stock it already has. Good units = expected x a yield draw.
8. Purchasing: an item at or below reorder level with no open order gets a `PO`; above the limit it
   waits for the Owner, who approves the next morning.
9. Vendor bills a day or two after receipt; one in a few dozen fails the three-way check and is held.
10. Payment runs twice a week for bills due; receipts from weekly-credit outlets and corporates by
    their terms (one corporate pays late and is over its limit).
11. 21:00 store day-end: sales from the demand model bounded by stock; `expired` = every unsold unit
    with `bestBefore <= date`; cash and UPI split; an occasional cash shortage at one store. The
    write-off waits for the Owner (next morning).
12. Cash deposits: factory cash most days, store cash the next morning, leaving a float.
13. Expenses: claims and expense bills by RESEARCH.md rules; salary bill on the last day of the month;
    approved a day later; paid by their terms, the salary bill from the bank.
14. A stock count of the factory stores at each month end with small differences.
15. Dated master changes: price revisions, joiners and leavers.

Whatever would be approved, confirmed, received or paid on or after the business date is left open:
that is "today's work". The hand-over is a property of every simulated day, not of the end of the run,
and the check tests it for every day: after the last step of day D, for each product, the stock in
`fac_fg` that is unexpired on D+1 and not reserved is at least the sum of the standing orders of all
active outlets, plus every store's standing quantity, plus the open corporate orders due on D+1 -
enough to post every dispatch sheet and store transfer of D+1 as prefilled; and every material in
`fac_rm` covers the standard day plan (section 5.1) of D+1, D+2 and D+3. Reorder levels in RESEARCH.md
are set so that the material rule holds on every day; the check proves it. The masters and the seed
also leave every guide journey of section 8.1 possible on every business date. In the seed, stock,
cash and bank never go negative in posting order. The calibration bands in RESEARCH.md section 13
hold. Speed: the load time is accepted as built (SCOPE decision 14): about one second for a copy opened
in 2026 and over two seconds from about April 2027, because the whole history is rebuilt on every
load. The check holds a run to 2 October 2026 under one second and a run to 31 December 2027 under two
seconds in Node.

## 7. Personas and rights (`HB.session`)

Roles: `owner`, `accounts`, `stores`, `production`, `sales`, `store_mgr` (scoped to one store:
Vallabh Vidyanagar). Names and employee links from RESEARCH.md. The sample opens as the Owner.

| Action | Roles (the Owner may do all of them) |
|---|---|
| po.create, grn.create, xfer.create | stores |
| vbill.create, pay.create, exp.bill, exp.salary, master.edit, employee.edit, dep.create (any cash account) | accounts |
| rcpt.create | accounts, sales |
| prod.create | production |
| dispatch.post, dispatch.cancel, inv.create, so.create, cn.create | sales |
| xfer.receive, dayend.create, dep.create (own store's cash) | store_mgr |
| adj.create | stores (fac_rm and fac_fg) |
| wo.create | stores (factory locations), store_mgr (own store) |
| exp.claim | every role |
| approve.*, reject.* | owner |
| cancel.<type> | the roles that create the type |

A stock count at a store is raised by the Owner (the Owner may do everything); the store manager has
no stock-count right. `HB.session.can(action, ctx) -> { ok, code, reason }`.
`can('approve.*', { doc })` tests "own document" before role, so a persona other than the Owner who
raised the document is refused with `own_approval`. A forbidden action is shown disabled with the
reason. Salaries are returned only to `owner` and `accounts`.

Page access and scope are fixed here and held once in the kernel as
`HB.session.access[role] = { pages, unitIds, locIds, accountIds }`. The router takes a page's roles
from it (a page file does not choose them) and `HB.session.scope()` returns the rest. Every selector
intersects with the scope: the store manager gets one store's stock, transfers, day-ends, cash and
expenses, and nothing else. Owner and accounts: every page, every unit, location and account.

| Role | Pages | Scope |
|---|---|---|
| stores | buy-orders, buy-receipts, stores-transfers, stock-onhand, stock-batches, stock-ledger, stock-counts, masters-parties (vendors only) | unit factory; locations fac_rm, fac_fg and every transit location; no accounts |
| production | make-production, make-recipes, stock-onhand, stock-batches, stock-ledger | unit factory; fac_rm, fac_fg; no accounts |
| sales | sell-dispatch, sell-corporate, sell-invoices, sell-returns, sell-receipts, stock-onhand, stock-batches, masters-parties (customers only) | unit factory; fac_fg; no accounts |
| store_mgr | stores-transfers, stores-dayend, stock-onhand, stock-batches, stock-ledger, acc-cash | unit st_vvn; locations st_vvn, transit_st_vvn; account cash_st_vvn |

Every role also gets home, guide, expenses, sys-tiers and sys-about. On expenses, stores, production
and sales see their own claims only; store_mgr sees the claims and expense bills of its store (never
the salary bill). All other pages are for owner and accounts only; accounts sees approvals with approve
and reject disabled and the reason.

`dash.work()` lists an item for owner and accounts, and for another role only when `HB.session.can`
allows the action the item needs. `dash.today()` and `dash.monthToDate()` return sales, collections,
cash and bank, spend, receivables, payables and approvals to owner and accounts; to store_mgr its own
store's sales, cash and spend; to sales the sales, collections and overdue receivables; production
figures to production; low stock to stores and production; near-expiry to every role, cut to
`scope()`. `home.js` draws the blocks it receives and nothing else.

## 8. Selectors (`HB.data`)

Names are fixed here; shapes are documented in `docs/API.md` by the author. Money in paise. Each takes
plain arguments or a filter `{ from, to, unitIds, channel, ... }`.

```
stock     onHand(locId)  batches(filter)  ledger(filter)  statement(f)  lowStock()  expiring(days)  value()
buy       orders(f) receipts(f) bills(f) payments(f) dueForReceipt(date) openReceipts(vendorId) register(f)
make      entries(f) yieldByItem(f) todo(date) costSheet(itemId) recipes()
sell      invoices(f) orders(f) creditNotes(f) receipts(f) sheets(date) summary(f) by(dim, f) returns(f)
          register(f)
stores    transfers(f) dayEnds(f) pending(date)
ar        balances() ageing() statement(customerId) openInvoices(customerId)
ap        balances() ageing() openItems(payeeType, payeeId) dueWithin(days) toReimburse()
cash      balances() book(accountId, f)
pnl       month(monthKey) months() entries(f)   margin  byItem(f) byChannel(f)        gst  summary(f)
exp       list(f) byCategory(f) byUnit(f)   people  list() headcount()
approvals pending()      audit  list(f)      notify  list()
dash      today() monthToDate() work()      guide  journeys()  (section 8.1)
doc       get(id)  timeline(id)  related(id)
```

`dim` in `sell.by` is item, customer, route, channel, unit, day or month.

- Rows, not statuses. Every selector that returns an amount or a quantity (P&L, margin, sales and
  purchase registers, `sell.summary` and `sell.by`, returns, expenses, GST, cash book, statements,
  stock ledger) sums rows by the row's own date, originals and reversals alike, and never filters by
  document status to compute a figure. Document lists show a cancelled document under a Cancelled tab;
  open balances, ageing and "to do" lists leave it out. A group whose rows add up to nothing in the range
  (a product, customer, route, unit or GST rate of a document posted and cancelled in it) is not listed
  with zeros; days, months and channels are listed whatever they hold. A statement adds up what was
  invoiced and what was paid or credited by the kind of row, so that a cancellation is a negative figure
  beside what it cancels and both net to nothing when they fall in the same range.
- No comparison. No selector returns a previous-period figure, and no tile, table or chart shows a
  change against another period (SCOPE 4.10 and 4.12: comparison is an iNeo teaser). The only period
  series are the month-wise totals since go-live (`pnl.months()`, `sell.by('month', f)`) and this month
  by day (`sell.by('day', f)`), drawn as plain bars.
- No forecast. `dash.work()` is built only from sheets to post (section 5.2), `stores.pending`,
  `buy.dueForReceipt`, `make.todo` and `approvals.pending`. `stores.pending(date)` returns, per store
  in scope, whether a transfer is still to send (its `transferSheet` proposes a quantity), the
  transfers SENT and not confirmed, and whether the day-end of that date is missing. `make.todo(date)`
  returns the standard day plan (section 5.1) less the products that already have an uncancelled
  `PROD` dated that day, each with its mix label, `standardMixes` and expected units per mix; no
  figure in it depends on demand, orders or stock. `stock.lowStock()` suggests no order quantity and
  offers no order prefill.
- `pnl.entries(f)` returns the documents behind one P&L cell, f = `{ monthKey, line, channel,
  categoryId, unitId }`: docId, date, amount. `stock.statement(f)` returns, per location and item for
  the range, the opening, in, out and closing quantity from the movement ledger, and the closing value
  at today's cost. `sell.register(f)` returns one row per `INV` (not opening), per `CN` (negative) and
  per `DAYEND` in the range, a cancellation as a negative row on its own date; its taxable total equals
  P&L sales net of returns for the range.
- `stock.expiring(days)` and `ap.dueWithin(days)` default `days` to `limits.nearExpiryDays` and
  `limits.dueSoonDays`; pages call them with no argument.

### 8.1 Guide journeys

`HB.config.journeys = [{ id, title, steps: [{ text, route, role, match: { op, type, test } }] }]`. A
step is done when the user's log holds an entry matching `match` that comes after the entry that ticked
the previous step; a journey is done when its last step is. `guide.journeys()` returns them with `done`
per step and per journey. A step's `role` is the persona the guide suggests, not a condition: the same
entry made by the Owner ticks it. `test` looks at what was entered or computed (a rate against the
latest price, `match.ok`, `sharePct` against `limits.returnsPct`), never at the resulting status. An
approve step is also ticked when the document of the step before it was approved in the same operation
(the Owner's own document, section 5.3). What the user is asked to look at afterwards is a link under
the journey, not a step.

| # | Journey | Steps: suggested persona and the entry that ticks each | Then look at |
|---|---|---|---|
| 1 | Post today's dispatch for a route and see sales, stock and cash move | 1. sales: `postDispatch` for a route, dated the business date | Dashboard, finished stock, cash book |
| 2 | Raise a flour order at a higher rate, receive it, and see bread cost and margin move | 1. stores: a `PO` with a maida line whose rate is above maida's latest purchase price. 2. stores: a `GRN` with a maida line | Cost sheet of sandwich bread, product margin |
| 3 | Enter the vendor bill at a different rate so that it is held, approve it as the Owner, pay it | 1. accounts: a `VBILL` whose three-way check fails (`match.ok` false). 2. owner: `approve` of a `VBILL`. 3. accounts: a `PAY` allocated to a `VBILL` | Payables, cash book |
| 4 | Record a production run with rejects and see yield and production loss | 1. production: a `PROD` with `rejectedUnits` above zero | Production register, monthly P&L |
| 5 | Send stock to a store, confirm it as the store manager, enter the day-end with expired units, approve the write-off | 1. stores: an `XFER` to the store manager's store. 2. store_mgr: `receiveTransfer`. 3. store_mgr: a `DAYEND` with a line whose `expired` is above zero. 4. owner: `approve` of a `WO` that has a day-end as `sourceDocId` | Store stock, monthly P&L |
| 6 | Enter a stale return above the limit and approve it | 1. sales: a `CN` whose `sharePct` is above `limits.returnsPct` or null. 2. owner: `approve` of a `CN` | Returns, the outlet's statement |
| 7 | Submit an expense claim as the store manager, approve it, reimburse it, and see spend by location | 1. store_mgr: an `EXP` of kind 'claim'. 2. owner: `approve` of a claim. 3. accounts: a `PAY` to an employee | Expenses by location |
| 8 | Receive a payment from a corporate and deposit cash in the bank, and see receivables and the cash book move | 1. accounts: a `RCPT` from a customer of channel 'corporate'. 2. accounts: a `DEP` | Receivables, cash book |

Each journey must be possible on any business date, and needs nothing beyond what section 6 and the
masters guarantee: (1) today's sheets post as prefilled; (2) the order and receipt are the user's own,
and the guide text says to keep the order within the limit so that it is approved as submitted; (3) the
bill is for the receipt of journey 2 or any other unbilled receipt; (4) the materials cover the
standard day plan; (5) today's transfer posts as prefilled, and every store's standing quantities
include a one-day item, so a day-end on the business date can carry expired units; (6) every outlet has
supply in the last seven days, or the note is held for want of it; (7) needs nothing; (8) a receipt may
be on account, and a receipt taken in cash gives the deposit its money. None depends on the weekday,
the day of the month or the state of a seeded document.

## 9. Pages

One file per page, `js/pages/<file>.js`, self-registering with `HB.router.register({ id, route, group,
title, subtitle, filters, render })`; the router takes the roles of a page from `HB.session.access`
(section 7). Navigation groups in this order:

| Group | File | Route | What it holds |
|---|---|---|---|
| Home | `home.js` | `#/home` | Dashboard and Today's work (SCOPE 4.10); NeoX teaser card |
| Home | `approvals.js` | `#/approvals` | Everything waiting for approval, by type, with the evidence to decide; approve / reject |
| Home | `guide.js` | `#/guide` | "Try this" journeys with self-ticking steps and links (section 8.1) |
| Sell | `sell-dispatch.js` | `#/sell/dispatch` | Route sheets for a date: grid of outlets x items, stock available, post; posted sheets, each with "Cancel the sheet" |
| Sell | `sell-corporate.js` | `#/sell/corporate` | Corporate orders; deliver and invoice; credit-limit warning |
| Sell | `sell-invoices.js` | `#/sell/invoices` | All invoices; view with batches and cost; print invoice and challan; cancel |
| Sell | `sell-returns.js` | `#/sell/returns` | Stale returns: enter, share of supply, held ones |
| Sell | `sell-receipts.js` | `#/sell/receipts` | Receipts against invoices, on account; customer statement |
| Stores | `stores-transfers.js` | `#/stores/transfers` | Send to a store, prefilled from its standing quantities; confirm receipt |
| Stores | `stores-dayend.js` | `#/stores/dayend` | Day-end entry; store sales, stock and cash |
| Buy | `buy-orders.js` | `#/buy/orders` | Purchase orders |
| Buy | `buy-receipts.js` | `#/buy/receipts` | Goods receipts against orders |
| Buy | `buy-bills.js` | `#/buy/bills` | Vendor bills with the three-way panel |
| Buy | `buy-payments.js` | `#/buy/payments` | Payments to vendors and claim reimbursements |
| Make | `make-production.js` | `#/make/production` | Production entry, register, yield |
| Make | `make-recipes.js` | `#/make/recipes` | Recipes: view, and edit for roles with master.edit; the cost sheet per product, margin by channel |
| Stock | `stock-onhand.js` | `#/stock/onhand` | Stock by location, value, low-stock list; iNeo teaser |
| Stock | `stock-batches.js` | `#/stock/batches` | Finished-goods batches, expiry, write-off request |
| Stock | `stock-ledger.js` | `#/stock/ledger` | The movement ledger |
| Stock | `stock-counts.js` | `#/stock/counts` | Stock count and adjustment |
| Expenses | `expenses.js` | `#/expenses` | Claims, expense bills, salary bill; spend by category and location; iNeo teaser |
| People | `people.js` | `#/people` | Employee directory, headcount, salary cost; "in Neo ERP" teaser |
| Accounts | `acc-receivables.js` | `#/accounts/receivables` | Outstanding, ageing, overdue |
| Accounts | `acc-payables.js` | `#/accounts/payables` | Outstanding, ageing, due this week, claims to reimburse |
| Accounts | `acc-cash.js` | `#/accounts/cash` | Cash and bank book, deposit; iNeo teaser |
| Accounts | `acc-pnl.js` | `#/accounts/pnl` | Monthly P&L with drill to documents |
| Accounts | `acc-margin.js` | `#/accounts/margin` | Product margin by item and channel |
| Accounts | `acc-gst.js` | `#/accounts/gst` | GST summary |
| Reports | `reports.js` | `#/reports` | The registers of SCOPE 4.10, each with a date range and CSV; iNeo teaser |
| Masters | `masters-items.js` | `#/masters/items` | Items, recipes link, price lists |
| Masters | `masters-parties.js` | `#/masters/parties` | Customers and vendors; iNeo teaser on the forms |
| Masters | `masters-setup.js` | `#/masters/setup` | Expense categories and locations: add, edit, deactivate |
| System | `sys-audit.js` | `#/system/audit` | Audit log |
| System | `sys-notifications.js` | `#/system/notifications` | Notification log |
| System | `sys-tiers.js` | `#/system/tiers` | What the higher tiers add |
| System | `sys-about.js` | `#/system/about` | About this sample: business date, what is stored, fresh copy, reset |

Rules for every page:

- **List, then document.** A table of documents with status tabs and a search box; a row opens the
  document view (lines, totals, status timeline, related documents, the actions the persona may take
  and, disabled with the reason, those it may not); "New" opens the form.
- **Forms** are built with `HB.forms` (line grid, decimal inputs, live totals from `HB.engine.preview`).
  The draft lives in the router's per-route state so a redraw does not lose it. Dates default to the
  business date. Every refusal from the engine is shown next to the field it concerns (`error.field`),
  and every warning next to the figure it concerns (`field` of the warning) and once more directly above
  the action bar, which it stays with at the bottom of the screen, so that it is in sight whenever the
  button is: before posting and without locking the button.
- **After posting**, a toast names the document and says in one line what moved ("Stock up 500 kg,
  bread cost Rs 21.40 -> Rs 22.15").
- A document id anywhere is a link to that document (`#/doc/<id>` opens the right page and view).
- Charts are few and plain (month-wise bars, this month by day). Tables carry the page. No tile shows
  a change against another period.
- Wording: plain, active, no jargon, no em-dash asides, no exclamation marks. "Purchase order",
  "Goods receipt", "Vendor bill", "Stale return", "Day-end".

## 10. Shell changes

- Rename the global to `HB`, storage prefix, brand block ("Happy Bakers", "Neo ERP sample"), page
  title, accent colour token (a deep green in place of the ember).
- Top bar: the business date ("Business date 2 Oct 2026"), the persona switcher, a menu with Fresh copy
  / Reset and Sign out. No simulated loading (`latency.js` goes).
- Banners: storage not available; log entries skipped on replay; calendar has moved on since this copy
  was created ("Start a fresh copy dated today"), by the test in section 4.
- `HB.filters`: date range (presets Today, Yesterday, Last 7 days, This month, Last month, Since go-live,
  Custom - relative to the business date) and unit (factory and the stores, limited by scope).
- `HB.forms` (new, documented in `docs/shell/UI-API.md`): `docForm`, `lineGrid` (add / remove rows, item
  picker, quantity / rate / amount cells, keyboard friendly), `qtyInput`, `rateInput`, `amountInput`
  (rupees with paise in, paise out), `docView`, `statusTabs`, `teaser({ title, tier, text })`,
  `printDoc(node)`. Full-page or wide-drawer layouts for documents with lines.
- `css/print.css`: printing hides the shell and prints only the open invoice or challan, across pages.
- Router: `#/doc/<id>` resolver; roles and scope from `HB.session.access`; a route the persona does not
  have is left out of the menu and lands on Home, as the inherited router already does; redraw on
  `store:changed` keeps per-route state (open document, draft form, selected tab).

## 11. Self-check (`tools/check.js`, `npm run check`)

The three parts of SCOPE.md section 7: (a) a hand-worked tiny company with expected figures typed in;
(b) full-seed reconciliations by a separate straight pass over the raw documents, plus determinism,
prefix stability on `seq` (section 5.4), the hand-over of section 6 for every simulated day, the
RESEARCH.md calibration bands and build time for business dates today, 1 April 2027 and
31 December 2027; (c) behaviour - every guide journey of section 8.1 through `HB.engine.act` on each
of those business dates, as each persona allowed and refused for one that is not, each refusal rule
identified by its code, post-then-cancel, the salary bill cancelled and raised again (section 5.5),
save-rebuild-replay under another persona, fresh copy. Part (a) also holds the two additions of
3 October 2026 on the tiny company: each of the seven warnings silent at its threshold and raised just
beyond it, never a refusal, kept on the document and in its audit entry, never for the seed; and
`cancelDispatch`: all or nothing with a receipt against one invoice, every figure back, the sheet to
post again, by role, replayed with its ids, with an earlier entry skipped, and on later business dates
the date rules for posting it again (a sheet of a locked month is cancelled and cannot be posted
again). Exit code non-zero on any failure, with a readable list.

The straight pass of (b) counts a cancelled document on its `date` and its negative on the date of its
`CXL`. Receivables = sum(`INV.total`, opening included) - sum(`INV.paidNow`) - sum(`RCPT.amount`) -
sum(`CN.total`), a cancelled document netted by its reversal; and per customer the same figure equals
open invoices less unapplied credit. Payables = sum(`VBILL.total` posted, opening included) +
sum(`EXP.total` approved) - sum(`PAY.amount`), a cancelled document netted by its reversal.

## 12. Definition of done

SCOPE.md section 9, plus: opens from `file://` with no console errors; every route renders for every
persona that has it, and a route the persona does not have is left out of the menu and lands on Home;
`npm run check` passes; no emoji, no CDN reference, no hard-coded colour; nothing from SCOPE.md
section 5 on any screen.
