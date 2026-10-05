# Happy Bakers - API as built

The authority on shapes and signatures. `docs/SPEC.md` says what must exist; this file says what does.
Each author adds a section for the files they own and keeps it true.

---

## 1. Kernel

File: `js/core/kernel.js`. Global: `HB` (`window.HB` in a browser, `globalThis.HB` in Node).
No DOM access. Nothing here reads `HB.config`, `HB.masters` or `HB.book` except `HB.session.users`,
which looks at `HB.config.users` when it is asked (1.9).

Contents: [1.1 Loading](#11-loading) - [1.2 bus](#12-hbbus) - [1.3 money and quantities](#13-money-and-quantities) -
[1.4 fmt](#14-hbfmt) - [1.5 dates](#15-hbdates) - [1.6 hash, rng](#16-hbhash-hbrng) - [1.7 store](#17-hbstore) -
[1.8 calendar](#18-hbcalendar) - [1.9 session](#19-hbsession) - [1.10 gone from the inherited kernel](#110-gone-from-the-inherited-kernel)

### 1.1 Loading

- Browser: `<script src="js/core/kernel.js"></script>`, first after echarts. It works from `file://`.
- Node: `var HB = require('./js/core/kernel.js');` It also sets `globalThis.HB`, so data files loaded with
  `require` afterwards find it as `root.HB`.
- Loading the kernel reads the device clock once (through `HB.calendar.realToday()`) to open the
  calendar. In Node the store is always in memory and always starts empty, so every `require` in a new
  process is a first open; a check sets its own date with `HB.calendar.set(iso)`.

Units used throughout:

| Thing | Unit |
|---|---|
| Money | whole **paise** (integer `number`) |
| Rate, price, unit cost | **paise per unit**, may be fractional |
| Quantity | units with at most three decimals |
| Date | `'YYYY-MM-DD'` string |
| Month | `'YYYY-MM'` string ("monthKey") |
| Fraction | `0.125` means 12.5% |

### 1.2 `HB.bus`

| Call | Returns | Notes |
|---|---|---|
| `HB.bus.on(evt, fn)` | `off()` - call it to stop listening | `fn(payload)` |
| `HB.bus.emit(evt, payload)` | nothing | A listener that throws is logged to the console and does not stop the others |

Events the kernel emits:

| Event | Payload | When |
|---|---|---|
| `'store:changed'` | `{ key }` | After `HB.store.set` and `remove` (the key written), after `HB.calendar.set` (`'meta'`), after `HB.store.resetAll` (`'*'`) |
| `'session:changed'` | the user object | After `HB.session.set(userId)` |

### 1.3 Money and quantities

Every rounding in the kernel rounds a half **away from zero**, so a negative value is the exact opposite
of the positive one, and none of them is fooled by binary floating point (1.005 x 100 is held by
JavaScript as 100.49999999999999 and is still rounded as the half it stands for).

| Call | Arguments | Returns |
|---|---|---|
| `HB.q3(x)` | a quantity | the quantity rounded to three decimals. Call it after every arithmetic step on a quantity |
| `HB.money.fromRupees(r)` | rupees: a number, or a numeric string from an input | whole paise |
| `HB.money.toRupees(p)` | paise | rupees as a number (`p / 100`). For input controls only; screens use `HB.fmt` |
| `HB.money.rateFromRupees(r)` | a typed rate in rupees per unit | paise per unit with two decimals (SPEC 2.8: a typed rate is held to a ten-thousandth of a rupee) |
| `HB.money.amount(qty, rate)` | `qty` in units (up to three decimals), `rate` in paise per unit (may be fractional) | whole paise |

`HB.money.amount` is the **only** function that turns a quantity and a rate into money. Call it once,
when the document is entered, and store the result on the line; totals are sums of stored values. It
takes the quantity in thousandths, multiplies by the rate and rounds once. It is exact for every
quantity with three decimals and every rate with two decimals of a paisa, up to about Rs 5 crore a line.
A non-number in gives `NaN` out; it does not throw. The result is never `-0`.

```js
HB.q3(0.1 + 0.2)                      // 0.3
HB.q3(1.0005)                         // 1.001
HB.money.fromRupees(50000)            // 5000000   (the Rs 50,000 order limit, in paise)
HB.money.fromRupees(1.005)            // 101
HB.money.fromRupees('12.5')           // 1250
HB.money.toRupees(123456)             // 1234.56
HB.money.rateFromRupees(21.4275)      // 2142.75   (paise per unit)
HB.money.amount(12.5, 3850)           // 48125     12.5 kg at Rs 38.50 = Rs 481.25
HB.money.amount(1.005, 100)           // 101       half a paisa rounds away from zero
HB.money.amount(-1.005, 100)          // -101      the mirror image
HB.money.amount(240, 2143.2857)       // 514389    a fractional unit cost
```

Tax amounts (`Math.round(taxable x gstRate / 200)` and the MRP formula) are the engine's; they are
computed on values of zero or more, where `Math.round` already rounds halves up.

### 1.4 `HB.fmt`

All money arguments are **paise**. Every function returns a string, and `'-'` for `null`, `undefined`,
`''`, `NaN` or an infinite value. A negative value is written with a leading `-` before the rupee sign.
A value that rounds to zero is never shown as minus zero.

| Call | Argument | Returns | Use for |
|---|---|---|---|
| `HB.fmt.inr(p)` | paise | compact rupees: crore with up to 2 decimals, lakh with 1 (2 below Rs 10 lakh), whole rupees below Rs 1 lakh | tiles, chart axes, tooltips |
| `HB.fmt.inrFull(p)` | paise | whole rupees, Indian grouping | tables where paise are noise |
| `HB.fmt.inr2(p)` | paise (a fraction is rounded to the paisa) | rupees with two decimals, Indian grouping | documents, registers, statements |
| `HB.fmt.rate(p)` | paise per unit | rupees with two to four decimals: zeros are trimmed only beyond the second | rates, prices, unit costs |
| `HB.fmt.qty(q, unit)` | quantity; `unit` optional text | up to three decimals, trailing zeros trimmed, Indian grouping, then a space and the unit as it reads after that quantity: `pack` and `litre` take their plural for anything but exactly one, `pcs` reads `pc` for one, `kg` never changes | quantities |
| `HB.fmt.unitFor(q, unit)` | quantity; unit | the unit word alone, by the same rule | a unit beside an input or in a sentence built by hand |
| `HB.fmt.num(n, d)` | a plain number; `d` decimals, default 0 | Indian grouping, exactly `d` decimals | counts. Not money |
| `HB.fmt.pct(x, d)` | a fraction; `d` decimals, default 1 | percent | yield, share, margin |
| `HB.fmt.rupee` | - | the rupee sign, a string constant | input affixes |

```js
HB.fmt.inr(1080000000)       // '₹1.08 Cr'
HB.fmt.inr(124000000)        // '₹12.4 L'
HB.fmt.inr(4520000)          // '₹45,200'
HB.fmt.inrFull(124350000)    // '₹12,43,500'
HB.fmt.inr2(123450)          // '₹1,234.50'
HB.fmt.inr2(-5)              // '-₹0.05'
HB.fmt.rate(3850)            // '₹38.50'
HB.fmt.rate(2142.75)         // '₹21.4275'
HB.fmt.rate(3600)            // '₹36.00'
HB.fmt.qty(12.5, 'kg')       // '12.5 kg'
HB.fmt.qty(240, 'pcs')       // '240 pcs'
HB.fmt.qty(189, 'pack')      // '189 packs'
HB.fmt.qty(1, 'pack')        // '1 pack'
HB.fmt.qty(1.25)             // '1.25'
HB.fmt.num(1234567)          // '12,34,567'
HB.fmt.num(1234.5, 1)        // '1,234.5'
HB.fmt.pct(0.1234)           // '12.3%'
HB.fmt.pct(0.5, 0)           // '50%'
HB.fmt.inr(null)             // '-'
```

Kept only because the inherited chart wrapper calls them. Pages do not call them, and pass no delta to a
tile (SPEC section 8: no comparison against another period). The small charts in the tiles of the landing
dashboard show the days of the chosen range and call neither:

| Call | Returns |
|---|---|
| `HB.fmt.delta(cur, prev)` | `{ value, label, dir }` - relative change; `label` like `'+10.0%'`, `dir` `'up'`, `'down'` or `'flat'`; `{ value: null, label: '-', dir: 'flat' }` when `prev` is zero or missing |
| `HB.fmt.points(curFrac, prevFrac)` | `{ value, label, dir }` - change in percentage points; `label` like `'+2.0 pts'` |

### 1.5 `HB.dates`

Unchanged from the inherited kernel, plus `isIso`. Dates are `'YYYY-MM-DD'` strings; the arithmetic is
in UTC, so a time zone never shifts a day. Compare two dates with `<`, `>` and `===`.

| Call | Returns |
|---|---|
| `HB.dates.isIso(s)` | `true` for a `'YYYY-MM-DD'` string that names a real day (`'2026-02-30'` is `false`) |
| `HB.dates.addDays(iso, n)` | the date `n` days later (`n` may be negative) |
| `HB.dates.diffDays(a, b)` | whole days from `a` to `b` (`b - a`) |
| `HB.dates.range(from, to)` | array of dates, both ends included |
| `HB.dates.dow(iso)` | `0` Monday ... `6` Sunday |
| `HB.dates.monthKey(iso)` | `'YYYY-MM'` |
| `HB.dates.monthStart(iso)` | first day of that month |
| `HB.dates.monthEnd(iso)` | last day of that month |
| `HB.dates.daysInMonth(monthKey)` | number of days |
| `HB.dates.weekStart(iso)` | the Monday of that week |
| `HB.dates.min(a, b)`, `HB.dates.max(a, b)` | the earlier, the later |
| `HB.dates.label(iso, style)` | text. `style`: `'d MMM'` (default, `'2 Oct'`), `'d MMM yyyy'`, `'MMM yyyy'`, `'MMM'`, `'EEE'`, `'EEE d MMM'` (`'Fri 2 Oct'`) |
| `HB.dates.monthLabel(monthKey, withYear)` | `'Oct'` or `'Oct 2026'` |
| `HB.dates.MONTHS`, `HB.dates.DOWS` | the short names (`DOWS[0]` is `'Mon'`) |

### 1.6 `HB.hash`, `HB.rng`

Unchanged from the inherited kernel: the same seed gives the same stream as before.

- `HB.hash(str)` -> unsigned 32-bit integer.
- `HB.rng(seed)` -> a generator. `seed` is a number or any string; key every stream by date and entity
  (`HB.rng('demand|o07|2026-04-01')`) so that history does not depend on where a run ends.

| Generator method | Returns |
|---|---|
| `next()` | a number in `[0, 1)` |
| `range(a, b)` | a number in `[a, b)` |
| `int(a, b)` | an integer from `a` to `b`, both included |
| `chance(p)` | `true` with probability `p` |
| `pick(arr)` | one element |
| `weighted(weights)` | an index, drawn in proportion to the non-negative weights |
| `normal(mean, sd)` | a normal draw (defaults 0 and 1) |
| `poisson(lambda)` | a Poisson count |

Never `Math.random()`, never the clock.

### 1.7 `HB.store`

Namespaced `localStorage` (prefix `hb.v1.`) holding JSON. In Node, and in a browser where storage is
blocked, it runs on an in-memory fallback with the same behaviour.

Keys in use: `meta` (`{ businessDate, seedVersion }`), `log` (array, the user's operations), `prefs`
(`{ userId, ... }` - the shell adds its own fields).

| Call | Returns | Notes |
|---|---|---|
| `HB.store.get(key, fallback)` | the stored value, or `fallback` | The value is cached and returned by reference: copy it before changing it, or write it back with `set` |
| `HB.store.set(key, value)` | nothing | `value` must survive `JSON.stringify`. Emits `'store:changed' { key }` |
| `HB.store.remove(key)` | nothing | Emits `'store:changed' { key }` |
| `HB.store.resetAll()` | nothing | Removes every key this app wrote (any `hb.` version), **then opens the calendar again from `HB.calendar.realToday()`** exactly as a first open does, and emits `'store:changed' { key: '*' }`. This is "Reset to a fresh copy dated today". A Node check that needs another date calls `HB.calendar.set(iso)` after it |
| `HB.store.ok` | boolean | `false` when storage is unavailable or the latest write of any key failed (for example, quota): changes will not survive a reload. A later successful write of that key turns it back to `true`. **Always `false` in Node**; reads and writes still work there |

Other tabs. In a browser the kernel listens for the `storage` event and **reloads the page** when
another tab changes `meta` or `log`, or clears storage. A change to `prefs` in another tab is ignored:
each tab keeps its persona and filters until it reloads. The event does not fire in the tab that wrote.

The engine's own `'store:changed'` after `HB.engine.act` (SPEC 5.5) comes on top of the one `set('log')`
emits; the router's redraw is debounced, so two events cost one redraw.

### 1.8 `HB.calendar`

The business date of this copy. All of it is plain data except the four functions.

| Member | Value |
|---|---|
| `HB.calendar.goLive` | `'2026-01-01'` |
| `HB.calendar.minDate`, `maxDate` | `'2026-02-01'`, `'2027-12-31'`: the range a business date is clamped into |
| `HB.calendar.today` | the **business date**. On first open it is `clamp(realToday())` and is stored in `meta.businessDate`; on every later open it is the stored date, whatever the device says |
| `HB.calendar.dataEnd` | the day before `today`: the last day of seeded history |
| `HB.calendar.lockBefore` | the first day of the month before `today`. A date before it is in a locked month |
| `HB.calendar.realToday()` | the device's **local** date as `'YYYY-MM-DD'`. The only clock read in the code base |
| `HB.calendar.clamp(iso)` | `iso` moved into `minDate`..`maxDate` |
| `HB.calendar.set(iso)` | Makes `clamp(iso)` the business date: updates `today`, `dataEnd` and `lockBefore`, stores `meta.businessDate` (other fields of `meta` are kept), emits `'store:changed' { key: 'meta' }`, returns the date now in force. Throws an `Error` if `iso` is not a real `'YYYY-MM-DD'` date. It does **not** rebuild the book: follow it with `HB.engine.boot()` (Node) or a reload (browser) |
| `HB.calendar.movedOn()` | `true` when `clamp(realToday()) > today`: the test for the "calendar has moved on" banner |

```js
HB.calendar.set('2026-03-31');   // today '2026-03-31', dataEnd '2026-03-30', lockBefore '2026-02-01'
HB.calendar.set('2027-01-01');   // today '2027-01-01', dataEnd '2026-12-31', lockBefore '2026-12-01'
HB.calendar.set('2026-01-15');   // clamped: today '2026-02-01', dataEnd '2026-01-31', lockBefore '2026-01-01'
HB.calendar.set('2028-03-01');   // clamped: today '2027-12-31', dataEnd '2027-12-30', lockBefore '2027-11-01'
```

- A fresh copy is `HB.calendar.set(HB.calendar.realToday())` after clearing the log.
- The kernel writes only `businessDate` into `meta`. On a first open `meta.seedVersion` is absent until
  the data layer writes it; treat "absent" as a new copy, not as a version mismatch.
- The manual load test for the last day: `HB.calendar.set('2027-12-31')` in the console, then reload.

### 1.9 `HB.session`

Personas, rights, page access and scope. They are decided here and nowhere else.

#### Roles and personas

`HB.session.roles` = `['owner', 'accounts', 'stores', 'production', 'sales', 'store_mgr']`.
`HB.session.roleLabel(role)` -> `'Owner'`, `'Accounts and admin'`, `'Purchase and stores'`,
`'Production supervisor'`, `'Sales and dispatch'`, `'Store manager'`.

| Call | Returns |
|---|---|
| `HB.session.users` | the personas, an array (a getter: it resolves `HB.config.users` when read) |
| `HB.session.userById(id)` | the user, or `null` |
| `HB.session.current()` | the persona in use: `prefs.userId` if it names one, otherwise the Owner |
| `HB.session.set(userId)` | switches persona, stores it in `prefs`, emits `'session:changed'`; returns the user, or `null` (nothing changed) for an unknown id |

A user is `{ id, name, initials, role, roleLabel, employeeId, unitId }`.

`HB.config.users` (written by the config author) is an array of
`{ id, name, role, employeeId }`, optionally with `initials`, `roleLabel` and `unitId`; the kernel fills
what is left out (`initials` from the name, `roleLabel` from the role, `unitId` from the role's scope).
Until `HB.config.users` exists the kernel uses this built-in set, and the config should keep the same
ids so that a stored persona survives:

| id | role | name | employee | roleLabel |
|---|---|---|---|---|
| `u_owner` | owner | Nilesh Patel | E001 | Owner |
| `u_accounts` | accounts | Falguni Shah | E002 | Accounts and admin |
| `u_stores` | stores | Imran Vohra | E004 | Purchase and stores |
| `u_production` | production | Bharat Prajapati | E006 | Production supervisor |
| `u_sales` | sales | Hardik Thakkar | E021 | Sales and dispatch |
| `u_store_mgr` | store_mgr | Nisha Desai | E032 | Store manager, Vallabh Vidyanagar |

`createdBy` on a document must be one of these user ids: the "own document" test compares it with
`user.id`.

#### Rights: `HB.session.can(action, ctx)`

Returns `{ ok, code, reason }`. When allowed: `{ ok: true, code: '', reason: '' }`. When refused,
`reason` is a sentence for the disabled control and `code` is one of:

| code | Meaning |
|---|---|
| `'own_approval'` | a persona other than the Owner tried to approve or reject a document it raised. Tested **before** the role |
| `'role'` | the role may not do this, or may do it but not for this unit, location or cash account. In the second case the refusal also carries `field`: the input that names it (`'storeId'`, `'toStoreId'`, `'locId'` or `'fromAccount'`) |
| `'unknown_action'` | the action name is not in the table (a programming error) |

`action` is not case-sensitive (`'cancel.' + doc.type` works).

| Action | Roles besides the Owner | Scope test (only when `ctx` says what the document is for) | Read from `ctx.doc` |
|---|---|---|---|
| `po.create`, `grn.create`, `xfer.create` | stores | - | |
| `vbill.create`, `pay.create`, `exp.bill`, `exp.salary`, `master.edit`, `employee.edit` | accounts | - | |
| `dep.create` | accounts, store_mgr | account: accounts any; store_mgr only `cash_st_vvn` | `fromAccount` |
| `rcpt.create` | accounts, sales | - | |
| `prod.create` | production | - | |
| `dispatch.post`, `dispatch.cancel`, `inv.create`, `so.create`, `cn.create` | sales | - | |
| `xfer.receive` | store_mgr | unit: its own store | `toStoreId` |
| `dayend.create` | store_mgr | unit: its own store | `storeId` |
| `adj.create` | stores | location: `fac_rm` or `fac_fg` | `locId` |
| `wo.create` | stores, store_mgr | location: stores `fac_rm` or `fac_fg`; store_mgr `st_vvn`. Never a transit location | `locId` |
| `exp.claim` | every role | - : a claim is for the factory or for any store, whoever raises it (SCOPE 4.6) | |
| `approve.<anything>`, `reject.<anything>` (also `'approve.*'`) | none: the Owner only | own document first, then role | `createdBy` |
| `cancel.<type>` for `po grn vbill pay so inv rcpt cn prod xfer dayend adj wo dep exp` | the roles that may create the type | the same scope test as the create action | the same field; `kind` for an expense |

A scope test reads **one** field, the one the document is posted for, and no other: a day-end payload
that names another store in `storeId` is refused whatever it carries under `unitId` or `toStoreId`.

The Owner is allowed every action in the table, for every unit, location and account, including
approving the Owner's own document. `cancel.exp` looks at the kind: a claim follows `exp.claim`, a bill
`exp.bill`, the salary bill `exp.salary`; with no kind given it is allowed if any of the three is.
`cancel.cxl`, `cancel.openstock` and `cancel.opencash` are not actions (`'unknown_action'`): those
documents are never cancelled.

`ctx` - every field is optional:

| Field | Meaning |
|---|---|
| `doc` | the document, or the payload about to be posted. The kernel reads from it whatever is not given outright: `createdBy`; `kind`; and the subject of the scope test from the one field in the last column of the table above |
| `createdBy` | user id of whoever raised the document (approve, reject) |
| `unitId` | the unit the document is for, given outright by the caller (never taken from `doc.unitId`) |
| `locId` | the stock location, given outright |
| `accountId` | the cash account the money leaves, given outright |
| `kind` | `'claim'`, `'bill'` or `'salary'` (for `cancel.exp`) |
| `user` | a user object or user id to test instead of the current persona |

With no `ctx`, `can` answers for the role alone - enough to show or disable a "New" button. The engine
passes the document so that the scope test runs as well.

```js
HB.session.can('po.create')
// as sales: { ok: false, code: 'role',
//             reason: 'Sales and dispatch cannot raise a purchase order: that is for Purchase and stores or the Owner' }
HB.session.can('approve.exp', { doc: claim })
// as the persona who raised it: { ok: false, code: 'own_approval', reason: 'You raised this document, so you cannot approve it' }
// as accounts, someone else's:  { ok: false, code: 'role', reason: 'Only the Owner approves documents' }
HB.session.can('dep.create', { doc: { fromAccount: 'cash_factory' } })
// as the store manager: { ok: false, code: 'role', reason: 'The store manager handles only the cash of their own store',
//                         field: 'fromAccount' }
HB.session.can('cancel.' + doc.type, { doc: doc, user: 'u_stores' })   // test another persona
```

`HB.session.rolesFor(action)` -> the roles that may do a create-type action, the Owner first
(`rolesFor('rcpt.create')` is `['owner', 'accounts', 'sales']`); `[]` for an unknown action.

#### Page access and scope

`HB.session.access[role]` = `{ pages, unitIds, locIds, accountIds }`, frozen. Each is an array of ids in
which **an entry ending in `*` matches by prefix**: `['*']` is "all, including whatever is added later",
and `'transit_*'` is every store's transit location. Do not test these lists with `indexOf`; use
`HB.session.matches(list, id)` or the functions below.

| Role | pages | unitIds | locIds | accountIds |
|---|---|---|---|---|
| owner, accounts | `['*']` | `['*']` | `['*']` | `['*']` |
| stores | common + `buy-orders buy-receipts stores-transfers stock-onhand stock-batches stock-ledger stock-counts masters-parties` | `['factory']` | `['fac_rm', 'fac_fg', 'transit_*']` | `[]` |
| production | common + `make-production make-recipes stock-onhand stock-batches stock-ledger` | `['factory']` | `['fac_rm', 'fac_fg']` | `[]` |
| sales | common + `sell-dispatch sell-corporate sell-invoices sell-returns sell-receipts stock-onhand stock-batches masters-parties` | `['factory']` | `['fac_fg']` | `[]` |
| store_mgr | common + `stores-transfers stores-dayend stock-onhand stock-batches stock-ledger acc-cash` | `['st_vvn']` | `['st_vvn', 'transit_st_vvn']` | `['cash_st_vvn']` |

common = `home guide expenses sys-tiers`. A page id is the page's file name without `.js`
(SPEC section 9), and it is the `id` the page registers with the router.

| Call | Returns |
|---|---|
| `HB.session.matches(list, id)` | `true` when `id` is in `list`, wildcards honoured |
| `HB.session.pageRoles(pageId)` | the roles that have the page. The router takes a page's roles from this; a page file does not choose them |
| `HB.session.canOpen(pageId, role)` | boolean. `role` defaults to the current persona's |
| `HB.session.scope(role)` | `{ role, userId, all, unitIds, locIds, accountIds, unit(id), loc(id), account(id) }`. `role` defaults to the current persona's (`userId` is then the current user's id, otherwise `null`). `all` is `true` for owner and accounts: nothing to filter. `unit(id)`, `loc(id)` and `account(id)` return `true` when the id is in scope |
| `HB.session.canSeeSalaries(role)` | `true` for owner and accounts only |
| `HB.session.partyKinds(role)` | which lists of `masters-parties` the role sees: `['customers', 'vendors']` for owner and accounts, `['vendors']` for stores, `['customers']` for sales, `[]` otherwise |
| `HB.session.expenseView(role)` | `'all'` (owner, accounts), `'unit'` (store_mgr: the claims and expense bills of its store, never the salary bill) or `'own'` (stores, production, sales: the persona's own claims). A claim may be for any unit, so under `'unit'` the selector should list the persona's own claims as well, or a claim the store manager raises for the factory disappears from her list |

Every selector intersects with the scope:

```js
var sc = HB.session.scope();
rows = rows.filter(function (r) { return sc.loc(r.locId); });   // one store's stock for the store manager
if (!HB.session.canSeeSalaries()) delete row.salary;
```

### 1.10 Gone from the inherited kernel

The shell files copied from the previous sample still call some of these; each needs its replacement.

| Inherited (`MK.`) | Here |
|---|---|
| `fmt.inr(n)`, `fmt.inrFull(n, d)` taking rupees | take **paise**; `inrFull` has no decimals argument - use `inr2` |
| `fmt.kg(n, d)` | `fmt.qty(q, 'kg')` |
| `store.persistent` | `store.ok` |
| `store.coll(name)` | gone: documents live in `HB.book`, rebuilt from the seed and the log |
| `calendar.dataStart`, `calendar.fyLabel` | `calendar.goLive`; there is no financial-year label |
| a fixed `calendar.today` | the business date of this copy (1.8) |
| `session.OUTLET_IDS`, `ALL_UNITS`, `allowedUnitIds()`, `allowedOutletIds()`, `seesAllUnits()` | `session.scope()`; units come from `HB.masters`, never from a fixed list |
| `user.unitIds` | `user.unitId` and `session.access[user.role]` |
| `can()` returning `{ ok, reason }` | returns `{ ok, code, reason }`; the action names are those of 1.9 |

---

## 2. Engine core

File: `js/data/engine.js`. This section covers `HB.masters`, `HB.book` and the lean part of `HB.engine`:
`reset`, `core.*`, the costing functions, the prefilled sheets, the salary proposal and a few helpers.
`HB.engine.boot`, `act`, `preview`, `check` and `freshCopy` wrap the core for a user; they live in the same
file and are described in section 3. Pages and forms use section 3; the seed uses this one.

Contents: [2.1 Loading and rules](#21-loading-and-rules) - [2.2 What HB.config must hold](#22-what-hbconfig-must-hold) -
[2.3 HB.masters](#23-hbmasters) - [2.4 HB.book](#24-hbbook) - [2.5 Context and results](#25-context-and-results) -
[2.6 Error codes](#26-error-codes) - [2.7 Documents: payloads and fields](#27-documents-payloads-and-fields) -
[2.8 Actions](#28-actions) - [2.9 Costing, stock and sheets](#29-costing-stock-and-sheets) -
[2.10 Master changes](#210-master-changes) - [2.11 For the seed author](#211-for-the-seed-author) -
[2.12 For the wrapper author](#212-for-the-wrapper-author) - [2.13 For the selector author](#213-for-the-selector-author) -
[2.14 Checking it](#214-checking-it)

### 2.1 Loading and rules

- Browser: after `kernel.js` and `config.js`. Node: `require` the kernel, then the config (or
  `tools/fixture-tiny.js`), then `js/data/engine.js`.
- `HB.engine.reset()` builds `HB.masters` from `HB.config` and an empty `HB.book`, and returns the book.
  It runs once by itself when the file loads and `HB.config` exists. `boot` starts with it. After a
  reset, read `HB.masters` and `HB.book` afresh: the old objects are no longer the ones in force.
- The core is a function of the book, the masters and its arguments. It never reads `HB.session`, the
  clock or `HB.calendar` (the one exception is `HB.engine.salaryBill`, a proposal for a form, 2.9).
- Every poster has two halves: **build** (validates and computes, changes nothing, may refuse) and
  **commit** (writes, cannot refuse). A refusal therefore leaves the book exactly as it was.
- The core checks stock, cash, duplicates and document states. It does **not** check rights, future
  dates, back-date limits or locked months, and it does not write the user log.
- Treat everything in `HB.book` and `HB.masters` as read-only. Change them only through `HB.engine.core`.

### 2.2 What `HB.config` must hold

`HB.masters` is a private copy of these keys of `HB.config` (anything else in the config is the seed's
business and is not copied). Shapes are those of SPEC 5.1; this table adds what the engine relies on.
`tools/fixture-tiny.js` is a complete small example.

| Key | Shape and what the engine needs |
|---|---|
| `company` | object, copied as it is |
| `units` | `[{ id, name, kind: 'factory' or 'store', standing: { itemId: qty } (stores) }]`. One unit has id `'factory'`. Left out, the engine fills: `kind` (`'factory'` for that id, else `'store'`), `active: true`, and for a store `locId` = its id, `transitLocId` = `'transit_' + id`, `cashAccountId` = `'cash_' + id`; for the factory `cashAccountId` = `'cash_factory'` |
| `locations` | `[{ id, name, kind: 'rm', 'fg', 'store' or 'transit', unitId }]`. Ids `fac_rm` and `fac_fg` are fixed (the posting rules name them). Any location or account a unit needs and the config does not list is added |
| `accounts` | `[{ id, name, kind: 'cash' or 'bank', unitId }]`. Ids `cash_factory` and `bank` are fixed |
| `items` | SPEC 5.1. `code` goes into batch ids. `gstRate` defaults to 0. A finished good needs `shelfLifeDays` and `price: { mrp, retail, corporate }` in paise |
| `recipes` | `[{ itemId, mixLabel, expectedUnits, materials: [{ itemId, qty }], packing: [{ itemId, qtyPerUnit }], rhythm, standardMixes }]` |
| `routes` | `[{ id, name, stops: [customerId] }]`. `stops` is the order of a dispatch sheet |
| `customers` | SPEC 5.1. `terms` `'cash'`, `'weekly'` or `'credit'`; `creditLimit` in paise (0 = no limit) |
| `vendors` | SPEC 5.1. Exactly one with `kind: 'staff'` |
| `employees` | SPEC 5.1. `salary` in paise a month; `doj`, `dol` dates (`dol` null while employed) |
| `expenseCategories` | `[{ id, name, mode: 'claim', 'bill' or 'both' }]`. Two are posted to by the engine and are found by `system: 'cash_short'` and `system: 'salary'`; failing that by id (`cash_short`; `salaries` or `salary`); failing that by name (containing "short"; containing "salar") |
| `users` | the six personas (1.9). `employeeId` is the payee of that persona's claims |
| `limits` | SPEC 5.1; a missing number takes the SPEC value. The group `warn` is the exception: its seven thresholds (2.5) are read from here and from nowhere else, the engine has no value of its own for them, and one that is missing (or the whole group) is a warning that never fires. `tools/fixture-tiny.js` carries the same values as the full config |
| `journeys` | passed through by reference |

`active` defaults to `true` on every item, customer, vendor, employee, category and route.

### 2.3 `HB.masters`

```
company, limits, journeys
units[]              unitById{}
locations[]          locationById{}
accounts[]           accountById{}
items[]              itemById{}
recipes[]            recipeByItem{}
routes[]             routeById{}
customers[]          customerById{}
vendors[]            vendorById{}
employees[]          employeeById{}
expenseCategories[]  categoryById{}
users[]              userById{}
staffVendorId            id of the vendor with kind 'staff'
shortExcessCategoryId    category of "Store cash short / excess"
salaryCategoryId         category of the salary bill
changes[]                the master changes applied, oldest first (the same rows as in book.audit, 2.10)
```

A list and its index hold the same objects. A master change edits the record in place, so a reference
taken earlier stays true. Units, locations and accounts added later (a new store) appear in the lists:
list them from here, never from fixed ids.

Normalised shapes: unit `{ id, name, kind, active, cashAccountId, locId, transitLocId, standing }` (the
last three on stores only); location `{ id, name, kind, unitId, active }` (a transit location's `unitId`
is its store); account `{ id, name, kind, unitId, active }` (`unitId` null for the bank).

### 2.4 `HB.book`

All money in paise, all quantities as in 1.1. "Row" = one object in a ledger.

#### Sequence

`book.seq` is one counter for the whole book. Every document (`doc.seq`), every ledger row, every price
entry and every audit entry takes the next number, so `seq` orders everything that ever happened.

#### Documents

| Member | Holds |
|---|---|
| `book.docs` | `{ id: document }` |
| `book.docList` | every document, in posting order |
| `book.byType[TYPE]` | the documents of one type, in posting order. A key exists for every type in `HB.engine.DOC_TYPES` |
| `book.days[date]` | `{ date, docs, moves, ar, ap, cash, pnl, gst, items }`: the documents and the rows **dated** that day, in posting order, and the item figures of the day (below). A day with nothing has no key |
| `book.pending` | `{ id: document }` for everything waiting for approval (PENDING or HELD), oldest first |
| `book.unbilled[vendorId]` | the posted goods receipts of a vendor that are on no bill |
| `book.index.billNo[key]` | id of the HELD or POSTED bill with that number. `key` is the vendor id, a bar and the bill number in lower case |
| `book.index.dayEnd[key]` | id of the uncancelled day-end. `key` is the store id, a bar and the date |
| `book.index.sheet[sheetId]` | the uncancelled invoices of a dispatch sheet. A sheet is "to post" when this is empty or missing |
| `book.index.salary[monthKey]` | id of the salary bill that stands for the month (PENDING, APPROVED or PAID) |
| `book.index.supply[customerId][date]` | taxable of the customer's POSTED invoices dated that day (opening excluded) |
| `book.index.returned[customerId][date]` | taxable of the customer's POSTED or HELD credit notes dated that day |
| `book.counters[TYPE][date]` | the last number given to a seeded id |

#### Stock

| Member | Holds |
|---|---|
| `book.stock[locId][itemId]` | quantity on hand |
| `book.reserved[locId][itemId]` | quantity on PENDING write-offs |
| `book.lots[locId][itemId]` | finished goods only: `[{ batchId, bestBefore, mfgDate, qty, reserved }]`, the batches **on hand** at that place in the order stock leaves (best-before, manufacturing date, batch id). A batch with nothing left and nothing reserved is not in the list |
| `book.batches[batchId]` | `{ id, itemId, mfgDate, bestBefore, docId, qty }`: every batch ever made; `docId` the `PROD` or `OPENSTOCK`, `qty` what was produced |
| `book.batchesByItem[itemId]` | the same batch records, in order of creation |
| `book.moves` | the movement ledger: `{ seq, date, docId, locId, itemId, batchId, qty, kind, reversal }`. `qty` is signed; `batchId` is null for materials and packing |

`kind`: `opening`, `receipt` (GRN), `consumption` and `production` (PROD), `dispatch` (INV), `transfer`
(XFER sent: out of `fac_fg`, into transit), `transfer_in` (XFER confirmed: out of transit, into the store),
`sale` (DAYEND), `adjustment` (ADJ), `writeoff` (WO). A reversal row keeps the kind of the row it reverses.

Stock available to a new document is not a stored figure: call `HB.engine.available(locId, itemId, date)`.

#### Receivables: `book.ar`

| Member | Holds |
|---|---|
| `entries` | `{ seq, date, docId, customerId, amount, kind, reversal }`; `kind` `invoice` (+total), `collected` (-paidNow), `receipt` (-amount), `credit_note` (-total) |
| `byParty[customerId]` | that customer's rows, in posting order |
| `balance[customerId]`, `total` | running sums of the rows |
| `credit[customerId]` | unapplied credit, zero or more |
| `open[customerId]` | the customer's POSTED invoices with an open amount, by date then posting order. Open amount: `HB.engine.openAmount(inv)` |
| `creditUsed[customerId]` | invoices with `creditApplied` above zero (used when a cancellation takes credit back) |

Always: `balance[c]` = sum of the open amounts in `open[c]` - `credit[c]`.

#### Payables: `book.ap`

A payee key is `'vendor:<vendorId>'` or `'employee:<employeeId>'`.

| Member | Holds |
|---|---|
| `entries` | `{ seq, date, docId, payeeType, payeeId, amount, kind, reversal }`; `kind` `bill` (VBILL posted, +total), `expense` (EXP approved, +total), `payment` (-amount) |
| `byParty[key]`, `balance[key]`, `total` | as for receivables |
| `open[key]` | the payee's POSTED bills and APPROVED expenses with `total - paid` above zero |

#### Cash: `book.cash`

`entries`: `{ seq, date, docId, accountId, amount, kind, reversal }`; `byAccount[accountId]`: that
account's rows; `balance[accountId]`: running balance (a key for every account, 0 to start).
`kind`: `opening`, `collected` (cash invoice), `receipt`, `payment`, `store_cash`, `store_upi`, `deposit`
(two rows: out of the cash account, into the bank).

#### P&L: `book.pnl`, `book.pnlMonth`, and the item figures

`book.pnl`: `{ seq, date, docId, line, channel, itemId, categoryId, unitId, amount, qty, reversal }`.

| line | Written by | channel | itemId | categoryId | unitId | amount | qty |
|---|---|---|---|---|---|---|---|
| `sales` | INV, DAYEND | `retail`, `corporate`, `store` | null | null | `factory`, or the store | taxable of the document | units |
| `cogs` | INV, DAYEND | the same | null | null | the same | sum of line `cost` | units |
| `returns` | CN when POSTED | the customer's | null | null | `factory` | **minus** taxable | minus units |
| `prodLoss` | PROD (when not zero) | null | the product | null | `factory` | `lossValue` (negative for a gain) | expected less good units |
| `writeoff` | WO on approval, one per line | null | the item | null | unit of the location | `value` | units (0 for a material) |
| `countDiff` | ADJ on approval, one per line with a difference | null | the item | null | unit of the location | `-value` (a shortage is positive) | `diff` (0 for a material) |
| `expense` | EXP on approval; DAYEND short or excess | null | null | the category | the unit | `amount` before GST; for short or excess `-shortExcess` | 0 |

Signs: sales positive, returns negative, every cost line positive when it is a cost. So
net sales = `sales + returns`, and profit = `sales + returns - cogs - prodLoss - writeoff - countDiff -
expense`. A salary bill writes one expense row per line (per unit).

`book.pnlMonth[monthKey][line][key]` is the running month total of the rows: `key` is the channel for
`sales`, `returns` and `cogs`; `'<categoryId>|<unitId>'` for `expense`; `'all'` for the other three.

**Sales by item are not P&L rows.** SPEC 5.2 says "sales by channel and item". One row per invoice line
would double the size of the book, so an invoice, a day-end and a credit note each write one row per
line of the P&L (`itemId` null) and add their lines to the item figures of their day:

```
book.days[date].items[unitId][channel][itemId] = { qty, sales, cogs, returnQty, returns }
```

`unitId` is `factory` for the `retail` and `corporate` channels and the store for `store`. `qty` units
sold, `sales` taxable, `cogs` cost, `returnQty` units returned, `returns` zero or less (like the P&L
line). A cell moves on the date of whatever moves it; a cancellation takes the figures back on **its
own** date. So a sum of cells over a range of days is a sum of rows by their own date, and over any
range `sum(sales)` and `sum(cogs)` of the cells equal the `sales` and `cogs` rows, `sum(returns)` the
`returns` rows.

#### GST: `book.gst`

`{ seq, date, docId, dir: 'output' or 'input', gstRate, taxable, cgst, sgst, reversal }`, one row per
document and rate. Output: INV and DAYEND (positive), CN (negative). Input: VBILL on POSTED, EXP on
approval (only when its GST is above zero). Rate 0 rows are written for invoices, day-ends, credit notes
and vendor bills (Nil-rated supplies and purchases). An expense with no GST - a claim, the salary bill,
an expense bill at rate 0 (diesel, piped gas, electricity, rent) - writes **no** GST row: it is outside
GST, not a Nil-rated purchase. So on the input side of the GST summary the Nil-rated line holds
Nil-rated stock purchases only, and an expense appears there only under the rate it was billed at.

#### Prices, audit, rows of a document

| Member | Holds |
|---|---|
| `book.prices[itemId]` | `{ rate, docId, date, history: [{ seq, date, rate, docId, cancelled }] }`: the latest purchase price and every receipt or opening entry that set it. A cancelled receipt's entry stays, flagged |
| `book.audit` | `{ seq, at, userId, userAs, role, action, docId, type, note, before, after }`. `userAs`: null, or the employee a seeded store document names in place of the persona (2.5, `as`). `action`: `post`, `approve`, `reject`, `cancel`, `receive` (for documents: `docId`, `type` the document type, `before` and `after` the status), `master`, `setActive` (for masters: `type` is the entity name, `docId` the record id, `before` and `after` the record). `note`: `'within limit'` on an order approved as submitted, `'own document'` on an approval by whoever raised it, `'opening balance'`, the reason of a hold, a rejection or a cancellation. The `post` entry of a document entered with a warning (2.5) ends in `'Entered with a warning: <message>'` (several: `'Entered with warnings: <message>; <message>'`), after `'. '` when the note says something already: `'within limit. Entered with a warning: ...'` |
| `book.rowIdx`, `book.rowMarks`, `book.rowIdx2` | internal: where each document's rows are. Use `HB.engine.rowsOf(docId)` |

### 2.5 Context and results

Every core function takes a context as its last argument:

| Field | Meaning |
|---|---|
| `userId` | the actor: `createdBy`, `approval.by`, `cancelled.by`, `receivedBy`; for a claim, the claimant |
| `role` | the actor's role. `'owner'` means: a document this operation raises that would wait for approval is approved in the same operation |
| `at` | `'YYYY-MM-DDTHH:MM'`: `createdAt`, `approval.at`, `cancelled.at`, `receivedAt`, the audit time. Left out: the document's date at 09:00 |
| `date` | the day of an **action**: the date of a `CXL` and of the rows a confirmed transfer writes. Left out: the date part of `at`, else the document's date. It is not the date of a posted document (that is in the payload) |
| `seed` | `true` marks the documents `seed: true` and allows opening entries |
| `as` | seed only, display only: the employee id a store document names as having entered it, when the store's own manager is not the persona that posts it (`createdAs`, `receivedAs`, the audit row's `userAs`). Never read for rights or scope; ignored without `seed` |
| `ids` | array of ids for the documents the operation creates, in the order it creates them. Left out or used up: seeded ids `TYPE-YYMMDD-NNN`. **Ids passed here must be of the form `TYPE-U-NNNN`**, never the seeded form |
| `batchId` | the batch id of a `PROD`. Left out: `HB.engine.core.nextBatchId(itemId, date)` |
| `dryRun` | `true`: validate and compute, post nothing |

Results:

| Call | Success | Refusal |
|---|---|---|
| a poster | `{ ok: true, doc, warnings }`; a day-end with expired units and a dispatch sheet also give `docs: [...]` | `{ ok: false, error, warnings: [] }` |
| `cancel` | `{ ok: true, doc: <the CXL>, target: <the cancelled document>, warnings: [] }` | the same |
| `cancelDispatch` | `{ ok: true, sheetId, doc: <the first CXL>, docs: [the CXLs, in the order of the invoices], targets: [the cancelled invoices], warnings: [] }`; a dry run: `{ ok: true, preview: true, sheetId, docs: [], targets, warnings: [] }` | the same |
| a dry run | `{ ok: true, preview: true, doc, warnings }` with `doc.id === ''`; `docs: [dayEnd, writeOff]` for a day-end with expired units; a dispatch sheet gives `{ ok, preview, sheetId, totals: { itemId: qty } }` | the same |
| a master change | `{ ok: true, record, before, warnings: [] }` (`unit` too for a location) | the same |

`warnings` is `[{ code, message, field }]`: figures that look wrong. A warning never refuses and never
changes what is posted; a refusal carries none. `field` names the input the figure was typed in, as
`error.field` does (2.6), or is null.

| code | Poster | Raised when | `field` | Threshold in `limits.warn` |
|---|---|---|---|---|
| `yield_unusual` | `core.prod` | `goodUnits x 100 < yieldLowPct x expectedUnits`, or `> yieldHighPct x expectedUnits`. The sentence gives the share to one decimal, or to as many more (four at most) as it takes not to read as the bound it broke: 79.98%, never 80.0% | `goodUnits` | `yieldLowPct` 80, `yieldHighPct` 105 (either may be missing: that side is then not tested) |
| `count_far` | `core.adj` | a line with `abs(diff) x 100 > countAwayPct x systemQty` (so any count against nothing in the books), unless `abs(value) < countMinValue`. One warning per such line | `lines[i].countedQty` | `countAwayPct` 20; `countMinValue` 50000 paise (missing: no difference is too small) |
| `over_order` | `core.inv` with `soId` | a line whose `qty` is above the quantity of that item on the order; an item the order does not have counts as ordered nil. One warning per such line | `lines[i].qty` | none |
| `over_owed` | `core.rcpt` | `amount` is above the sum of `HB.engine.openAmount` over the customer's open invoices (`book.ar.open`), whatever the allocations are. The message says how much will stay on account: `doc.onAccount` | `amount` | none |
| `claim_high` | `core.exp`, kind `'claim'` | `amount > claimAbove` | `amount` | `claimAbove` 500000 paise |
| `rate_far` | `core.po` | a line with `abs(rate - latest) x 100 > rateAwayPct x latest`, `latest` being `HB.engine.price(itemId)`; no test while that is 0. One warning per such line | `lines[i].rate` | `rateAwayPct` 25 |
| `cash_far` | `core.dayend` | `abs(shortExcess) x 100 > dayEndAwayPct x gross` (so any cash or UPI on a day with no sales) | `cash` | `dayEndAwayPct` 10 |
| `credit_limit` | `core.inv` | the invoice takes a corporate customer with a credit limit above it. An outlet is not warned about, whatever limit its master holds (SCOPE 4.5) | null | none: the customer's `creditLimit` |

Each test is taken on whole numbers (thousandths of a unit, hundredths of a paisa), so a figure exactly
at its threshold raises nothing: 4500 against a latest price of 3600 is not "more than 25% away", 4501 is.

What the first seven leave behind when the document is posted: `doc.warned`, the list of their codes,
each once (a document entered without one has no such field), and the sentence in the audit entry of the
posting (2.4). `credit_limit` is older and stays as it was: returned, first in the list, and neither
kept in `warned` nor written into the audit entry.

**Never for the seed.** With `ctx.seed` none of the seven is computed, returned or kept, however
unusual the figure: the history is not something a user typed. (`credit_limit` is still returned to
the seed, as before; nothing is stored for it.) The message texts are sentences for the user, with
the figures as `HB.fmt` prints them: show them as they are.

### 2.6 Error codes

`error` is `{ code, message, field, docId }`. `message` is a sentence for the user; where it names a
status it uses the words of the screens ("is waiting for approval", "is held for approval", "is part
received"), never the code. `field` names the
input (`'date'`, `'lines[2].qty'`, `'allocations[0].amount'`, `'reason'`), or is null. `docId` is the
document to look at or to cancel first, or null.

| code | When (from the core) |
|---|---|
| `invalid_input` | something missing or wrong in the payload; an inactive master; an opening entry without `seed` |
| `not_found` | no document with that id, or not of the type asked for; for `core.cancelDispatch`, a sheet with no uncancelled invoice |
| `wrong_state` | the document is not in a state that allows the action (`docId` = it); for `core.cancelDispatch`, a sheet that has another number of invoices than `ctx.ids` holds ids |
| `stock_short` | not enough stock available; an approval or a cancellation that would take stock below zero (`docId` = the document); a count that would take off what a PENDING write-off holds (`docId` = that write-off). A refused dispatch sheet also carries `error.short = [{ itemId, wanted, available }]` |
| `cash_short` | a payment or deposit above the balance of the account |
| `duplicate` | bill number already entered (`docId` = that bill); receipt already billed; day-end of that store and date exists; sheet already posted (`docId` = its first invoice); salary bill for the month exists; an id from the context already in the book |
| `has_dependants` | a cancellation with something resting on the document; `docId` = what to cancel first (the list is in 3.4). For a dispatch sheet: on any one of its invoices, and then none is cancelled. Also a store that still holds stock or cash |
| `future_date`, `locked_month` | `HB.engine.salaryBill` only (it also refuses with `role`, 2.9). In the wrapper, with `role`, `own_approval` and `backdate_limit` |

### 2.7 Documents: payloads and fields

Every document has the common fields
`{ id, seq, type, date, status, createdBy, createdAt, seed, createdAs, note, approval, cancelled }`.
`createdAs` is null, or on a seeded store document the employee id of the store's own manager, whom the
selectors name as having entered it (display only; `createdBy` stays the persona for rights and scope).
`approval` is `{ state: 'none', 'pending', 'approved' or 'rejected', by, at, reason, self }`; documents
that never waited share one frozen `state: 'none'` record. `cancelled` is null, or
`{ by, at, reason, docId }` with `docId` the `CXL`. Every payload may carry `note`. A document a user
entered with a warning also has `warned: [code, ...]` (2.5); on every other document the field is
absent, so test it with `doc.warned && doc.warned.length`.

Each poster is `HB.engine.core.<name>(payload, ctx)`; `HB.engine.core.post(TYPE, payload, ctx)` calls
the same function by type name. In the tables, **R** = required in the payload, **O** = optional,
**C** = computed by the engine (anything of that name in the payload is ignored).

Rules common to all: `date` R, a real `'YYYY-MM-DD'` and a string (anything else, an array of one day
included, is `invalid_input`; the same holds for every other date and for a batch id). A line with an
item twice in one document is refused. A line, an allocation or an outlet that is not an object (a
hole in a grid arrives as `null`) is refused with `invalid_input` at its first input
(`lines[i].itemId`, `allocations[i].docId`, `outlets[i].customerId`); nothing throws. Finished goods
are whole units; other quantities are rounded to three decimals. Rates and prices are paise per unit
and may carry a fraction; money amounts are whole paise.

#### `core.po` - purchase order

| Field | | |
|---|---|---|
| `vendorId` | R | an active vendor of kind `stock` |
| `expectedDate` | O | default `date`; not before it |
| `lines[].itemId`, `qty`, `rate` | R | a material or packing item, active; both above zero |
| `lines[].gstRate`, `amount`, `received` | C | from the item; `amount(qty, rate)`; 0 |
| `total`, `grnIds` | C | sum of amounts; the uncancelled receipts |

Status `APPROVED` when `total <= limits.poAutoApprove` (audit note "within limit"), else `PENDING`.
Then `PART_RECEIVED` / `RECEIVED` by receipts. Warning `rate_far` per line (2.5).

#### `core.grn` - goods receipt

| Field | | |
|---|---|---|
| `poId` | R | an order that is APPROVED or PART_RECEIVED |
| `date` | R | not before the date of the order |
| `lines[].itemId` | R | an item on the order |
| `lines[].qty` | R | accepted; at most ordered less received; may be 0 |
| `lines[].rejectedQty` | O | a record only |
| `lines[].rate`, `vendorId`, `billId` | C | from the order line; from the order; null until billed |

A line with both quantities zero is dropped; a receipt with no line left is refused. Posts stock into
`fac_rm`, adds to `received`, sets the latest purchase price of each accepted item. Status `POSTED`.

#### `core.vbill` - vendor bill

| Field | | |
|---|---|---|
| `vendorId`, `billNo`, `grnIds[]` | R | posted receipts of that vendor, not yet billed |
| `lines[].itemId`, `qty`, `rate` | R | |
| `lines[].gstRate` | O | default the item's |
| `lines[].taxable`, `cgst`, `sgst`; `taxable`, `gst`, `total`, `dueDate`, `paid`, `opening`, `holdReason` | C | |
| `match` | C | `{ ok, diffs: [{ itemId, orderedRate, acceptedQty, billedQty, billedRate, expected, billed, diff, ok }] }`, one entry per item on the receipts or on the bill |

`POSTED` when the three-way check passes, else `HELD`. The receipts are linked at once in both cases.

`core.openBill({ date, vendorId, total, dueDate, billNo? }, ctx)` is the opening bill: `opening: true`,
no lines, POSTED, payable for `total`. Needs `ctx.seed`.

#### `core.pay` - payment

| Field | | |
|---|---|---|
| `payeeType`, `payeeId` | R | `'vendor'` or `'employee'` |
| `account` | R | `'cash_factory'` or `'bank'`; a salary bill: `'bank'` |
| `allocations[].docId`, `amount` | R | a POSTED `VBILL` or APPROVED `EXP` of that payee; above zero, at most `total - paid` |
| `amount` | O | when given it must equal the sum of the allocations |
| `date` | R | not before the date of the latest of the bills and claims it pays (`invalid_input`, field `date`, `docId` that bill or claim) |
| `ref` | O | |

Status `POSTED`. An expense paid in full becomes `PAID`.

#### `core.prod` - production entry

| Field | | |
|---|---|---|
| `itemId` | R | an active product with a recipe |
| `mixes`, `goodUnits` | R | above zero; good units whole. `mixes` is rounded to three decimals first, and refused (`invalid_input`, "Enter the number of mixes") when that, or what the recipe expects of it, is zero: 0.0004 is no run, 0.0005 is 0.001 mix |
| `rejectedUnits` | O | a record; default 0 |
| `expectedUnits`, `batchId`, `bestBefore`, `consumption[{ itemId, qty, rate, value }]`, `unitCost`, `lossValue` | C | |

Refused with `stock_short`, naming the material, when `fac_rm` is short. Status `POSTED`. Warning
`yield_unusual` (2.5).

#### `core.so` - sales order

`customerId` R (active, of the corporate channel: an outlet is supplied from its route's dispatch sheet);
`deliveryDate` O (default `date`); `poRef` O; `lines[].itemId`, `qty` R;
`lines[].price` O (default: the price list of the customer's channel); `invId` C. Status `OPEN`, then
`INVOICED`.

#### `core.inv` - invoice

| Field | | |
|---|---|---|
| `customerId` | R | active |
| `soId` | O | an OPEN order of that customer; without `lines` the order's lines are invoiced |
| `lines[].itemId`, `qty` | R | finished goods; a line with `qty` 0 is skipped |
| `lines[].price` | O | default: with `soId`, the price of the order's line for that item - also when `lines` is sent (a part delivery, a changed quantity); for an item the order does not have, and without an order, the price list of the channel |
| `routeId`, `sheetId` | O | for the seed and `postDispatch`; default the customer's route and null |
| `lines[].gstRate`, `taxable`, `cgst`, `sgst`, `unitCost`, `cost`, `batches[{ batchId, qty }]` | C | |
| `channel`, `terms`, `dueDate`, `units`, `cost`, `taxable`, `gst`, `total`, `creditApplied`, `paidNow`, `received`, `credited`, `opening` | C | `units` = total units, `cost` = sum of line cost |

Status `POSTED`. Warnings `credit_limit`, and with `soId` `over_order` per line (2.5). An invoice for
less than its order closes the order all the same: there is no back-order (SCOPE decision 16).
`core.openInv({ date, customerId, total, dueDate }, ctx)` is the opening invoice (`opening: true`, no
lines; needs `ctx.seed`).

#### `core.postDispatch` - dispatch sheet

`core.postDispatch({ routeId, date, outlets: [{ customerId, lines: [{ itemId, qty }] }], note? }, ctx)`.
All or nothing. Posts one invoice per outlet with a quantity, in route stop order, each with
`sheetId = 'DS-<routeId>-<YYMMDD>'`. Returns `{ ok, sheetId, doc, docs, warnings }`. It takes one id
from `ctx.ids` per invoice. `core.cancelDispatch` (2.8) takes a posted sheet back in one operation.

#### `core.rcpt` - receipt

`customerId` R; `account` R (`'cash_factory'` or `'bank'`); `amount` R; `mode` O (default `'cash'` or
`'bank'`); `allocations[{ docId, amount }]` O, each at most the open amount of a POSTED invoice of the
customer; `onAccount` C. Status `POSTED`. Warning `over_owed` (2.5).

#### `core.cn` - stale return

`customerId` R; `lines[].itemId`, `qty` R; `lines[].price` O (default the price list);
`lines[].gstRate`, `taxable`, `cgst`, `sgst`, and `channel`, `units`, `taxable`, `gst`, `total`,
`sharePct`, `allocations`, `onAccount`, `holdReason` C. `POSTED`, or `HELD` when the share is above
`limits.returnsPct` or there was no supply in the window (`sharePct` null; `holdReason` says which).
The decision is taken on the exact ratio in whole paise (`returns x 100 > limit x supply`), not on the
rounded figure: exactly 8% posts, 8.0025% waits. `sharePct` is that ratio to two decimals, for the
screen; where the exact share is above the limit but would round down to it, the next hundredth is
stored (8.0025% is stored as 8.01), so `sharePct > limits.returnsPct` is true of every note held for
its share and of no other.

#### `core.xfer` - transfer to a store

`toStoreId` R (an active store unit); `lines[].itemId`, `qty` R; `lines[].batches`, `receivedAt`,
`receivedBy`, `receivedAs` (the employee who confirmed it on a seeded store's behalf, else null) C. Status `SENT`; `core.receiveTransfer(id, ctx)` makes it `RECEIVED`.

#### `core.dayend` - store day-end

| Field | | |
|---|---|---|
| `storeId` | R | an active store unit |
| `lines[].itemId` | R | |
| `lines[].sold`, `expired` | O | default 0; a line with both zero is dropped |
| `cash`, `upi` | O | whole paise, default 0 |
| `lines[].mrp`, `gstRate`, `gross`, `taxable`, `cgst`, `sgst`, `unitCost`, `cost`, `batches` | C | |
| `units`, `cost`, `gross`, `taxable`, `gst`, `shortExcess`, `woId` | C | |

Status `POSTED`. With expired units it also creates the write-off (`type 'WO'`, `reason 'expired'`,
`sourceDocId` the day-end, one line per batch): result `docs: [dayEnd, writeOff]`, and a second id is
taken from `ctx.ids`. A day-end with no lines is allowed (a store that sold nothing). Warning
`cash_far` (2.5), on the day-end, never on its write-off.

#### `core.dep` - cash deposit

`fromAccount` R (an account of kind `cash`); `amount` R (above zero, at most the balance); `slipRef` O.

#### `core.adj` - stock count

`locId` R (not a transit location); `reason` R; `lines[].itemId` R; `lines[].batchId` R for finished
goods; `lines[].countedQty` R (zero or more); `lines[].systemQty`, `diff`, `rate`, `value`, and `value`
(the sum) C. Materials are counted at `fac_rm` only, finished goods anywhere else. Status `PENDING`,
then `POSTED` on approval. A count may not take off what a PENDING write-off holds (2.8); raised by the
Owner, whose approval is part of the same operation, such a count is refused when it is entered
(`stock_short`, field `lines[i].countedQty`, `docId` the write-off). Warning `count_far` per line (2.5).

#### `core.wo` - write-off

`locId` R; `reason` R (`'expired'`, `'damaged'`, `'other'`); `sourceDocId` O; `lines[].itemId`, `qty` R;
`lines[].batchId` R for finished goods; `lines[].rate`, `value`, and `value` C. The quantity must be
available (on hand less what other pending write-offs hold). Status `PENDING`, reserved; `POSTED` on
approval.

#### `core.exp` - expense

| kind | Payload | Computed |
|---|---|---|
| `'claim'` | `categoryId` R (mode `claim` or `both`), `unitId` R (the factory or any active store, whoever claims), `amount` R, `billRef` O | `payeeType 'employee'`, `payeeId` = the employee of `ctx.userId`, `gstRate 0`, `dueDate = date` |
| `'bill'` | `payeeId` R (a vendor, not the staff vendor), `categoryId` R (mode `bill` or `both`), `unitId` R, `amount` R, `gstRate` O, `billRef` O | `payeeType 'vendor'`, `cgst`, `sgst`, `gst`, `total`, `dueDate = date + termsDays` |
| `'salary'` | `monthKey` R; no `date` (or the month's last day) | `date`, `payeeId` (staff vendor), `categoryId`, `lines[{ unitId, headcount, amount }]`, `amount`, `total` |

Status `PENDING`, `APPROVED` on approval, `PAID` when paid in full. Warning `claim_high`, on a claim
only (2.5).

#### `core.openStock`, `core.openCash` (need `ctx.seed`)

- `openStock({ date, lines }, ctx)`: a material line is `{ locId, itemId, qty, rate }` (the rate becomes
  the first purchase price); a finished-goods line is `{ locId, itemId, qty, mfgDate, bestBefore?,
  batchId? }` (`bestBefore` defaults to `mfgDate + shelfLifeDays`, `batchId` to `B-YYMMDD-<code>` of the
  manufacturing date; the same batch may appear at several locations).
- `openCash({ date, lines: [{ accountId, amount }] }, ctx)`.

#### `CXL`

Created by `cancel` and by `cancelDispatch`. Fields: `targetId`, `targetType`, `reason`,
`creditTakenBack: [{ docId, amount }]` (what a cancelled receipt or credit note took back from invoices
that had used its credit), and, on a cancellation that was part of a sheet's, `sheetId`.

### 2.8 Actions

| Call | Does |
|---|---|
| `core.approve(id, ctx)` | PENDING or HELD only. `PO` -> APPROVED; `VBILL`, `CN`, `ADJ`, `WO` -> POSTED; `EXP` -> APPROVED. Writes the rows, each with the **document's** date. `approval = { state: 'approved', by, at, self }` (`self` when `ctx.userId` raised it). `ADJ` and `WO` are refused with `stock_short` if a line would take stock below zero (`docId` the document), and an `ADJ` also if a line would take off what a PENDING write-off holds (`docId` that write-off) |
| `core.reject(id, reason, ctx)` | PENDING or HELD only; `reason` mandatory. Status `REJECTED`. A bill frees its receipts and its number; a write-off frees its reserved stock; a salary bill frees its month |
| `core.receiveTransfer(id, ctx)` | SENT only. Transit -> the store; rows dated `ctx.date` |
| `core.cancel(id, reason, ctx)` | the cancel table of SPEC 5.3, `reason` mandatory. Creates the `CXL` dated `ctx.date`, writes the opposite of every row the target wrote (`reversal: true`, `docId` the CXL), takes the item figures back on that date, sets the target `CANCELLED` |
| `core.cancelDispatch({ sheetId, reason }, ctx)` | cancels every uncancelled invoice that carries `sheetId` (`book.index.sheet[sheetId]`), in the order the sheet posted them, each exactly as `core.cancel` would: one `CXL` per invoice (with `sheetId` on it), one audit entry per invoice, all with the one `reason`. **All or nothing**: every invoice is tested first (the cancel table; then the stock test, which an invoice always passes, since its reversal brings stock in), and the first that fails refuses the whole call, with the code, field and `docId` that `core.cancel` would give for that invoice and the message prefixed "The sheet cannot be cancelled: " (so: `has_dependants`, "... INV-U-0002 has a receipt or a credit note against it. Cancel RCPT-U-0001 first", `docId` that receipt). Other refusals: `invalid_input` on `sheetId` (missing, or not a string) and on `reason` (empty); `not_found` on `sheetId` when no uncancelled invoice carries it (a sheet never posted, or already taken back); `wrong_state` on `sheetId` when `ctx.ids` holds another number of ids than the sheet has invoices (a replayed entry whose sheet is no longer the sheet it cancelled, 3.9). It takes one id from `ctx.ids` per invoice. An invoice of the sheet cancelled alone earlier is left as it is. Afterwards `book.index.sheet[sheetId]` is empty: the sheet is to post again |

The Owner's same-operation approval is not a separate call: post with `role: 'owner'`.

What a cancellation is tested against, besides the states of the cancel table:

- A `PROD` needs its whole batch in `fac_fg`. If a write-off waits on the batch: `has_dependants`,
  `docId` that write-off. If units have left: `has_dependants`, `docId` the uncancelled document that
  took from the batch last (an invoice, a transfer, a posted write-off or count) - cancel that, ask
  again, and the one before it is named. A confirmed transfer cannot be cancelled, so a batch that
  reached a store stays.
- Any document that brought stock in (a `GRN`, a POSTED `ADJ` that added stock): the quantity must still
  be there, or `stock_short` (`docId` the document itself, the message names the item and the quantity
  short); and it must not be held by a PENDING write-off, or `has_dependants` with `docId` that
  write-off.

So stock on hand never falls below what PENDING write-offs hold, and `HB.engine.available` is never
below zero.

### 2.9 Costing, stock and sheets

| Call | Returns |
|---|---|
| `HB.engine.unitCost(itemId)` | paise per unit, to four decimals: recipe cost now for a product, latest purchase price for a material, 0 for an unknown item |
| `HB.engine.price(itemId)` | latest purchase price, 0 if none |
| `HB.engine.costSheet(itemId)` | `{ itemId, name, mixLabel, expectedUnits, materials: [{ itemId, name, unit, qty, rate, value, perUnit }], packing: [{ itemId, name, unit, qtyPerUnit, rate, perUnit }], mixCost, materialPerUnit, packingPerUnit, unitCost }`, or null without a recipe |
| `HB.engine.available(locId, itemId, date)` | finished goods: the quantity unexpired on `date` and not reserved (no `date`: not reserved); materials: on hand less reserved. Never below zero |
| `HB.engine.openAmount(inv)` | `total - creditApplied - paidNow - received - credited` |
| `HB.engine.rowsOf(docId)` | `{ moves, ar, ap, cash, pnl, gst }`: the rows that document wrote (a confirmed transfer: both postings). Empty lists if none. For a cancelled document, its reversal rows are `rowsOf(doc.cancelled.docId)` |
| `HB.engine.settlers(doc)` | the uncancelled receipts and credit notes allocated to an invoice, or payments allocated to a bill or expense, in posting order |
| `HB.engine.dispatchSheet(routeId, date)` | `{ ok, sheetId, routeId, date, posted, invoiceIds, items: [{ itemId, total, available, short }], outlets: [{ customerId, name, terms, lines: [{ itemId, qty }] }] }`: every active outlet of the route in stop order with its standing order, unchanged. `outlets` can be passed to `postDispatch` as it is |
| `HB.engine.transferSheet(storeId, date)` | `{ ok, storeId, date, lines: [{ itemId, standing, atStore, inTransit, qty, available }] }`; `qty` = standing less the unexpired quantity at the store or in transit, never below zero. `atStore` counts units on a PENDING write-off too: they are still at the store (`available` is what leaves them out) |
| `HB.engine.salaryBill(monthKey)` | the proposal `{ ok, kind: 'salary', monthKey, date, payeeType, payeeId, categoryId, lines, amount, total }`, or a refusal: `role` (the persona in use may not see salaries: anyone but the Owner and accounts), `future_date` (the month's last day is after `HB.calendar.today`), `locked_month` (before `HB.calendar.lockBefore`), `duplicate`. It answers the persona in use, like `preview`; a page may call it for anyone and show the refusal. Post it with `act('post', { type: 'EXP', payload: { kind: 'salary', monthKey } })`; the seed posts with `core.exp` and does not call this |
| `HB.engine.salaryLines(date)` | the lines alone, for any day. No rights test: for the core, the seed and the check. **Pages and selectors must not call it** - a line is one person's salary where a unit has one employee; use `salaryBill`, or gate on `HB.session.canSeeSalaries()` |
| `HB.engine.sheetId(routeId, date)` | `'DS-<routeId>-<YYMMDD>'` |
| `HB.engine.dateCheck(date, role)` | the date rules of SPEC 5.3 alone (3.2, step 3): may something dated `date` be entered on the business date by `role` (default: the persona in use)? `{ ok: true }`, or the refusal an entry so dated would get: `future_date`, `locked_month`, `backdate_limit`, field `'date'`, the same words; `invalid_input` for what is not a date. Rights and the rest of an entry are not asked. For a screen that has to say whether a day is open where there is nothing to preview: whether a dispatch sheet can be posted again once it is cancelled (`sell.sheet(id).repost`, 4.6) |
| `HB.engine.core.nextBatchId(itemId, date)` | `'B-<YYMMDD>-<code>'`, with `-2`, `-3` ... when taken |
| `HB.engine.idPlan(op, args)` | `{ types: [...], batch }`: the ids an operation will take (2.12). For `cancelDispatch` it reads the book: one `'CXL'` per uncancelled invoice of the sheet as it stands |
| `HB.engine.fail(code, message, field, docId)` | a refusal in the shape the core returns |
| `HB.engine.DOC_TYPES` | every document type |

### 2.10 Master changes

`core.master(entity, record, ctx)` adds (no `id`, or an id not in use) or edits (an existing `id`; only
the fields given change; `price` is merged price by price). `core.setActive(entity, id, active, ctx)`
deactivates or reactivates. Both validate, apply to `HB.masters`, and add a row to `book.audit` and
`masters.changes` with `before` and `after`. Posted documents are not touched. An edit that changes no value
(key order aside, an empty value read as a missing one, `changeNote` not counted as a value) and a `setActive` to
the state the record is already in are refused, `invalid_input` "Nothing was changed" (field `null`; `'id'` for
`setActive`), and write no history entry.

| entity | Notes |
|---|---|
| `items` | `kind` and (once it has batches) `code` cannot change; `code` and `name` unique; `unit` cannot change once the item has been in stock; a product needs `shelfLifeDays` (up to 3,650) and all three prices (above zero, up to Rs 1,00,000) |
| `recipes` | keyed by `itemId`; needs `expectedUnits` and at least one material; `rhythm` is `'daily'` or a list of weekdays (0 = Monday) with at least one day in it, else `invalid_input` on `rhythm` |
| `customers` | `channel` cannot change; `name` unique; a retail customer needs `routeId` and is added as the last stop of that route (and leaves the old one); `creditDays` up to 365, `creditLimit` up to Rs 100 crore, a standing quantity up to 1,00,000; a `gstin` that is given or changed must look like one (15 characters) |
| `vendors` | kind `stock` or `expense`; `name` unique; `termsDays` up to 365; `gstin` as for customers; the staff vendor cannot be added or deactivated |
| `expenseCategories` | `name` unique; the two system categories cannot be deactivated |
| `employees` | `unitId`, `doj` required; `dol` empty or on or after `doj` |
| `locations` | add `{ name, standing?, id? }`: an own store - one call creates the unit, the stock location, the transit location and the cash account (id `st_<name>` unless given). Edit `{ id, name?, standing? }`. Deactivate: a store only, and only when it and its transit location hold no stock and its cash is zero (`has_dependants`). A name is used once among the stores, the factory stores and the units (`duplicate`, field `name`) |

A new id is `record.id` if given, else `ctx.ids[0]`, else `core.newMasterId(entity)` (`itm_019`,
`cus_051`, ...); for a new store, `record.id`, else `ctx.ids[0]`, else `st_<name>`. Company, routes, users
and limits have no form: `invalid_input`.

### 2.11 For the seed author

- Opening entries first, with `seed: true`: `openStock`, `openCash`, one `openInv` per customer, one
  `openBill` per vendor.
- Pass the role of whoever acts. A document raised with `role: 'owner'` is approved at once; for
  "approved the next morning" raise it as the persona and call `core.approve` the next day as the Owner.
- `core.postDispatch` is all or nothing; cut the quantities to `HB.engine.available('fac_fg', itemId,
  date)` first. `core.inv` with `routeId` and `sheetId` (from `HB.engine.sheetId`) posts one outlet.
- Batch ids and document ids come from the book; leave `ids` and `batchId` out.
- In the morning approvals, approve the write-offs before the stock counts: a count that takes units
  off a batch (or a material) is refused while a PENDING write-off holds them (2.8). A count raised
  with `role: 'owner'` is tested the same way when it is posted.
- An invoice for a sales order sent with its own `lines` and no `price` takes the order's prices.
- The salary bill: `core.exp({ kind: 'salary', monthKey }, ctx)`. Do not call `HB.engine.salaryBill` from
  the seed: it reads the persona in use and the business date, and a boot under another persona would
  then build another book.
- Speed: reuse one context object and one date string per day (the day and month lookups compare the
  string by identity first).
- What the engine costs. `node tools/smoke-engine.js --bench` posts a two-year run at the size of the
  full company: 81,000 documents (112 a day, 45 invoices of eight lines among them) and 750,000 ledger
  rows. On the build machine, which was busy with other work at the time, that took 0.95 to 1.1 seconds
  in most runs and up to 2 seconds when the machine was loaded; about 0.8 seconds of it is the posting
  itself and the rest is the memory manager. The book of such a run is about 240 MB in Node (about half
  that in a browser). So SPEC 6's "under one second" for the whole seed is **not** met by the engine
  with room to spare: the seed's own work comes on top. The large savings left are fewer documents and
  fewer lines, for example a credit note only for an outlet that returned something, and one receipt
  for a week's invoices.
- Keep money in whole paise and finished-goods quantities whole: a fraction in a row field makes every
  later row larger (see the comment in `move`).

### 2.12 For the wrapper author

- `act` should: check rights and dates; fix `at`, `ids` (from `HB.engine.idPlan(op, args)`: one id per
  entry of `types`, in order; `batch: true` means also fix `core.nextBatchId(itemId, date)`) and store
  them in the log entry; call the core with `{ userId, role, at, date: <business date>, ids, batchId }`;
  on `ok` append the entry and emit `'store:changed'`.
- `preview` is the same call with `dryRun: true`.
- A refusal changes nothing, so a replayed entry that no longer applies can simply be skipped.
- Opening entries are refused without `seed`; a user payload cannot carry `opening: true` through
  `core.inv` or `core.vbill` (it is refused the same way). Strip `routeId` and `sheetId` from a user's
  invoice payload.
- `ctx.date` matters for `cancel`, `cancelDispatch` and `receiveTransfer`: pass the business date.
- Warnings need nothing from the wrapper: the core returns them from a dry run and from a posting alike,
  and keeps them when it posts. `cancelDispatch` needs its ids fixed like any other operation:
  `idPlan('cancelDispatch', args)` counts the invoices of the sheet in the book as it stands.
- The claim payee comes from `ctx.userId`; nothing in a payload can change it.

### 2.13 For the selector author

- A period: walk `HB.dates.range(from, to)` and read `book.days[date]` (skip missing days). A month of
  P&L: `book.pnlMonth`. Never scan `book.pnl` or `book.moves` whole to draw a tile.
- Sales, returns and cost by item: `book.days[date].items` (2.4). By customer or route: the `sales` rows
  of the day and `book.docs[row.docId]`.
- Sum rows, originals and reversals alike, by the row's own date. A cancelled document keeps its rows
  on its date; the `CXL` carries the opposite on the cancellation date.
- A balance at an earlier date is the balance now less the rows dated after it (`book.cash.byAccount`,
  `book.ar.byParty`, `book.ap.byParty`, `book.days`).
- Ageing: `book.ar.open[customerId]` with `HB.engine.openAmount`, and `book.ar.credit`; payables:
  `book.ap.open[key]` with `total - paid`.
- Batches on hand, expiry flags: `book.lots`. Available: `HB.engine.available`.
- What a document posted: `HB.engine.rowsOf(id)`. Related documents: the id fields on the documents
  (`poId`, `grnIds`, `billId`, `soId`, `invId`, `woId`, `sourceDocId`, `sheetId`, `targetId`,
  `cancelled.docId`, `allocations[].docId`) and `HB.engine.settlers(doc)`.
- Waiting for approval: `book.pending`. Receipts to bill: `book.unbilled`. Sheets posted:
  `book.index.sheet`.

### 2.14 Checking it

`node tools/smoke-engine.js` posts one of every document type on `tools/fixture-tiny.js`, runs every
action and refusal, cancels what it posted, changes masters, and compares stock, cash, receivables,
payables, P&L and GST with figures worked out by hand (the arithmetic is in the comments). It prints the
books and exits with code 1 on any difference. `--bench` adds the two-year timing run.

---

## 3. Engine operations

File: `js/data/engine.js` (the last part). What pages, forms and the shell call. Everything a user does goes
through `HB.engine.act`; a form shows what `HB.engine.preview` and `HB.engine.act` return and holds no rule
of its own.

Contents: [3.1 The calls](#31-the-calls) - [3.2 What act does](#32-what-act-does) - [3.3 Results](#33-results) -
[3.4 Error codes and fields](#34-error-codes-and-fields) - [3.5 post: the payload of each document](#35-post-the-payload-of-each-document) -
[3.6 The other operations](#36-the-other-operations) - [3.7 preview and check](#37-preview-and-check) -
[3.8 The log](#38-the-log) - [3.9 boot, replay, fresh copy](#39-boot-replay-fresh-copy) -
[3.10 Notes for the other authors](#310-notes-for-the-other-authors) - [3.11 Checking it](#311-checking-it)

### 3.1 The calls

| Call | Does |
|---|---|
| `HB.engine.boot()` | builds the book: reset, the seed up to `HB.calendar.dataEnd` (with no seed: the opening entries of `HB.config.opening`), then the user's log. Returns `HB.book` (3.9) |
| `HB.engine.act(op, args)` | the only entry point for a user's operation. Checks, applies, logs, announces (3.2) |
| `HB.engine.preview(type, payload)` | what a form shows while it is filled in: the document as it would be posted, the stock behind each line, the refusal it would get. Posts nothing (3.7) |
| `HB.engine.check(op, args)` | would `act(op, args)` go through? Same rights, dates and validation, nothing posted (3.7) |
| `HB.engine.freshCopy()` | discards the user's entries, takes the device's date as the business date, reloads (3.9) |
| `HB.engine.log()` | the user's log, oldest first (3.8). Read-only |
| `HB.engine.skipped` | array: the log entries the last boot could not replay (3.9) |
| `HB.engine.notice` | string: one sentence for a banner when the last boot had to start a fresh copy, else `''` |
| `HB.engine.booted` | `true` once `boot()` has run |
| `HB.engine.postOpening()` | posts `HB.config.opening` through the core (3.9). For `boot` and for a seed |

`op` is one of `'post'`, `'approve'`, `'reject'`, `'cancel'`, `'receiveTransfer'`, `'postDispatch'`,
`'cancelDispatch'`, `'master'`, `'setActive'`.

### 3.2 What `act` does

In this order; the first step that refuses ends it, and a refusal changes nothing: no document, no row, no
id used up, no log entry, no event.

1. **Rights**, through `HB.session.can` for the persona in use (`HB.session.current()`), own approval
   before role. The action asked about:

   | op | action | what the scope test sees |
   |---|---|---|
   | `post` | `po.create`, `grn.create`, `vbill.create`, `pay.create`, `prod.create`, `so.create`, `inv.create`, `rcpt.create`, `cn.create`, `xfer.create`, `dayend.create`, `dep.create`, `adj.create`, `wo.create` by type; an `EXP` by kind: `exp.claim`, `exp.bill`, `exp.salary` | the payload, and in it only the field the document is posted for: `storeId` of a `DAYEND`, `fromAccount` of a `DEP`, `locId` of an `ADJ` or `WO` |
   | `postDispatch` | `dispatch.post` | - |
   | `cancelDispatch` | `dispatch.cancel`: the same roles, sales and the Owner | - |
   | `approve`, `reject` | `approve.<type>`, `reject.<type>` | the document (`createdBy`) |
   | `cancel` | `cancel.<type>` | the document (the same field as for its creation; the kind of an expense) |
   | `receiveTransfer` | `xfer.receive` | the document (`toStoreId`) |
   | `master`, `setActive` | `employee.edit` for the entity `employees`, else `master.edit` | - |

   The refusal is `role` or `own_approval`, with the sentence from the session as its message and, for
   an action on a document, `docId`. A `post` refused because the role may do it but not for that store,
   location or account carries the input that names it as `field` (`storeId`, `locId`, `fromAccount`).
2. **The log entry is fixed**: its number, its time (the business date, 09:00 plus one minute per entry,
   stopping at 23:59), the user and role, the arguments (copied through JSON), the ids the operation
   will take (`TYPE-U-NNNN`, numbered per type after the highest in the log, skipped entries included)
   and the batch id of a production entry. See 3.8.
3. **Date rules** (SPEC 5.3), on the `date` of a posted document or a dispatch sheet; a salary bill is
   dated the last day of its `monthKey`. A `date` that is present and not a string is `invalid_input`
   here, before any rule; a string that is not a calendar day is refused by the core in step 4:
   - after the business date: `future_date`;
   - before the first day of the month before the business date: `locked_month`, for everyone;
   - for a role other than `owner` and `accounts`, more than `limits.backDateDays` days back:
     `backdate_limit`.

   `approve`, `reject`, `cancel`, `cancelDispatch` and `receiveTransfer` carry no date: they happen on
   the business date. A cancellation is dated the business date, each cancellation of a sheet too; so
   are the rows of a confirmed transfer. A back-dated
   document carries its own date on every row but is posted now, against the stock and cash of now.
4. **The core** (section 2): input, state, stock, cash and duplicate rules, then the posting. A document
   raised by the Owner that would wait for approval is approved in the same operation
   (`approval.self = true`, audit note "own document"); that includes the write-off of a day-end the
   Owner posts. The core writes the audit entries (2.4): one per document posted, approved, rejected,
   cancelled or confirmed, and one per master change with `before` and `after`, each with the user, the
   role and the time of the log entry.
5. **The entry is appended** to the log (`HB.store` key `log`) and `'store:changed'` is emitted twice:
   `{ key: 'log' }` by the store, then `{ key: 'book', op, n }` by the engine. The router's redraw is
   debounced, so the two cost one redraw.

Steps 3 and 4 are the *inner half*: a function of the book and the entry alone. It reads the user, the
role, the time and the ids from the entry, never `HB.session`, a counter or the clock, and "today" for
the date rules is the day in the entry's own time. Boot replays the log through the same function.

Three fields are the engine's and are dropped from what a user sends: `routeId` and `sheetId` on an
`INV` (they belong to `postDispatch`), `sourceDocId` on a `WO` (it belongs to the day-end). `opening:
true` is refused.

### 3.3 Results

| Operation | On success |
|---|---|
| `post` | `{ ok: true, doc, warnings, n }`. A `DAYEND` with expired units also has `docs: [dayEnd, writeOff]` |
| `postDispatch` | `{ ok: true, sheetId, doc: <first invoice>, docs: [invoices in stop order], warnings, n }` |
| `approve`, `reject`, `receiveTransfer` | `{ ok: true, doc, warnings, n }` - `doc` is the document acted on |
| `cancel` | `{ ok: true, doc: <the CXL>, target: <the cancelled document>, warnings, n }` |
| `cancelDispatch` | `{ ok: true, sheetId, doc: <the first CXL>, docs: [one CXL per invoice, in the order the sheet posted them], targets: [the cancelled invoices, in the same order], warnings: [], n }` |
| `master` | `{ ok: true, record, before, warnings, n }`; a location also has `unit` |
| `setActive` | `{ ok: true, record, warnings, n }`; a location also has `unit` |

`n` is the number of the log entry. `doc` and `docs` are the live documents of `HB.book` (read-only).
Look at `doc.status` to say what happened: `APPROVED` or `PENDING` for an order, `POSTED` or `HELD` for a
bill or a return, `PENDING` for anything that waits for the Owner.

A refusal is `{ ok: false, error: { code, message, field, docId }, warnings: [] }`.

`warnings` is `[{ code, message, field }]`: figures that look wrong (SCOPE decision 18). The operation
went through all the same; a form shows each warning before posting, from `preview` (3.7), beside the
input `field` names. Only `post` raises them:

| code | On | Says | `field` |
|---|---|---|---|
| `yield_unusual` | `PROD` | the good units are under 80% or over 105% of what the recipe expects for the mixes: "Sandwich bread: 95 pcs good is 79.2% of the 120 pcs the recipe expects for 3 mixes. A run normally gives 80% to 105%" | `goodUnits` |
| `count_far` | `ADJ` | a counted quantity is more than 20% away from the books, and the difference is worth Rs 500 or more: "Maida: 16 kg counted against 166 kg in the books, more than 20% away" | `lines[i].countedQty` |
| `over_order` | `INV` with `soId` | a line delivers more than the order has: "Sandwich bread: 12 pcs on the invoice, 10 pcs on the order SO-U-0001" ("none on the order" for an item it does not have) | `lines[i].qty` |
| `over_owed` | `RCPT` | the amount is above everything the customer owes, and how much will stay on account: "Rs 11,000.00 is more than the Rs 10,415.12 Sardar Hostel Mess owes. Rs 584.88 will stay on account" ("<name> owes nothing. ..." when no invoice is open) | `amount` |
| `claim_high` | `EXP`, a claim | the amount is above Rs 5,000: "A claim of Rs 8,000.00 is well above what a claim normally is, Rs 5,000.00 or less" | `amount` |
| `rate_far` | `PO` | a rate is more than 25% away from the item's latest purchase price: "Maida: Rs 50.00 against the latest purchase price of Rs 36.00, more than 25% away" | `lines[i].rate` |
| `cash_far` | `DAYEND` | cash and UPI are more than 10% away from the day's sales at MRP: "Cash and UPI come to Rs 500.00 against sales of Rs 700.00 at MRP, more than 10% away" | `cash` |
| `credit_limit` | `INV` | the invoice takes a corporate customer above its credit limit. Invoices to outlets never carry it, so a dispatch sheet posts without warnings | null |

(The messages carry the rupee sign as `HB.fmt` prints it; "Rs" stands for it here.) The figures in the
table are those of `limits.warn`; the rules, to the comparison, are in 2.5. The first seven are kept:
`doc.warned` lists their codes and the audit entry of the posting says "Entered with a warning: ...",
which the history of the document and the audit log show. `credit_limit` stays as it was and is kept
nowhere. Several warnings come in the order of the lines, `credit_limit` first. A document the seed
posted never carries one.

### 3.4 Error codes and fields

`error.field` is the name of the input to mark, or null: a payload key (`'date'`, `'vendorId'`), a line
input (`'lines[2].qty'`, `'allocations[0].amount'`), on a dispatch sheet the outlet as well
(`'outlets[1].lines[0].qty'`), or a record key for a master (`'name'`, `'price.mrp'`,
`'materials[0].qty'`). Line numbers count the lines of the payload as sent. `error.docId` is the document
to look at or to cancel first, or null. `error.message` names a status in the words of the screens (the
labels of `docs/shell/UI-API.md`: "PO-U-0002 is waiting for approval; ...", "VBILL-U-0001 is held for
approval and cannot be paid"), never by its code: show it as it is.

| code | Raised by | field | docId |
|---|---|---|---|
| `role` | step 1: the role may not do it, or not for this unit, location or cash account. Also `HB.engine.salaryBill` for a persona who may not see salaries | null; for a `post` refused for its store, location or account: `storeId`, `locId` or `fromAccount` | the document, for an action on one |
| `own_approval` | step 1: a persona other than the Owner approving or rejecting what it raised | null | the document |
| `future_date` | step 3 | `date` (`monthKey` for a salary bill) | null |
| `locked_month` | step 3 | `date` (`monthKey`) | null |
| `backdate_limit` | step 3 | `date` | null |
| `invalid_input` | the core: something missing or wrong; an inactive master; an opening entry; an unknown `op` (field `'op'`) or document type (field `'type'`); a date or a batch id that is not a string; an empty line, allocation or outlet (`null` in the array: field `lines[i].itemId`, `allocations[i].docId`, `outlets[i].customerId`, `outlets[i].lines[j].itemId`, `materials[i].itemId`, `packing[i].itemId`) | the input | sometimes the document concerned |
| `not_found` | no document with that id, or not of the type needed; `cancelDispatch` for a sheet that has no uncancelled invoice (field `sheetId`) | the input that named it, or null | null |
| `wrong_state` | the document is not in a state that allows it (approve a posted one, receive against a pending order, cancel a rejected one, a confirmed transfer, a cancellation, an opening entry) | the input that named it, or null | that document |
| `stock_short` | not enough stock: a line of an `INV`, `XFER`, `DAYEND` (`sold` or `expired`) or `WO`; a material of a `PROD` (field `'mixes'`); a dispatch sheet as a whole (field `'outlets'`, with `error.short = [{ itemId, wanted, available }]`); an approval or a cancellation that would take a quantity below zero (field null, `docId` the document); a count that would take off what a PENDING write-off holds (on approval: field null; raised by the Owner: `lines[i].countedQty`; `docId` the write-off) | see left | see left |
| `cash_short` | a `PAY` or `DEP` above the balance of the account | `amount` | null |
| `duplicate` | a bill number already entered (`billNo`, `docId` that bill); a receipt already billed (`grnIds`, `docId` its bill); a second day-end for the store and date (`date`, `docId` the first); a sheet already posted (`date`, `docId` its first invoice); a second salary bill for the month (`monthKey`, `docId` the first); an item code in use (`code`) | see left | see left |
| `has_dependants` | a cancellation with something resting on the document (for `cancelDispatch`: on any one invoice of the sheet, and the message names that invoice); deactivating a store that holds stock or cash (field `'id'`) | null | what must be cancelled first |

What must be cancelled first (`has_dependants`): an order - its latest receipt; a receipt - its bill,
or the PENDING write-off that holds its goods; a bill or an expense - the latest payment against it; a
sales order - its invoice; an invoice - the latest receipt or credit note against it; a production entry
- the write-off waiting on its batch, else the uncancelled document that last took units of the batch
out of `fac_fg` (an invoice, a transfer, a write-off, a count); a posted count that added stock - the
PENDING write-off that holds it; a day-end - its approved write-off. A cancellation is `stock_short`
only when the goods a receipt or a count brought in are no longer there (used in production, or
written off) and no single document can be named.

### 3.5 `post`: the payload of each document

`HB.engine.act('post', { type, payload })`. `type` is not case-sensitive. Every payload may carry `note`.
Money is whole paise, rates and prices paise per unit, quantities as in 1.1. Fields not listed are
computed (2.7 has the full list of computed fields); anything of that name in the payload is ignored.
"Lands" is the status of `doc` in the result; raised by the Owner, a document that would wait is
approved in the same operation and lands where the approval takes it.

**`PO`** - purchase order
```js
{ date, vendorId, expectedDate /* optional, default date */, lines: [{ itemId, qty, rate }] }
```
Lands `APPROVED` when `doc.total <= limits.poAutoApprove`, else `PENDING` (the Owner: `APPROVED`).
Warning `rate_far` (`lines[i].rate`). Fields refused: `date`, `vendorId`, `expectedDate`, `lines`, `lines[i].itemId`, `lines[i].qty`, `lines[i].rate`.

**`GRN`** - goods receipt
```js
{ date, poId, lines: [{ itemId, qty /* accepted */, rejectedQty /* optional */ }] }
```
Lands `POSTED`. The rate is the order's. Refused: `poId` (`not_found`; `wrong_state` unless the order is
APPROVED or PART_RECEIVED), `date` (before the date of the order: "A receipt cannot be dated before its
order"), `lines`, `lines[i].itemId` (not on the order), `lines[i].qty` (more than is
still to come), `lines[i].rejectedQty`.

**`VBILL`** - vendor bill
```js
{ date, vendorId, billNo, grnIds: [grnId], lines: [{ itemId, qty, rate, gstRate /* optional, default the item's */ }] }
```
Lands `POSTED`, or `HELD` when the three-way check fails (`doc.match.ok` false, `doc.holdReason`); the
Owner: `POSTED`. `doc.match.diffs` is the three-way panel. Refused: `vendorId`, `billNo` (missing;
`duplicate`), `grnIds` (none; of another vendor; `not_found`; `wrong_state`; `duplicate` when already
billed), `lines`, `lines[i].itemId`, `.qty`, `.rate`, `.gstRate`.

**`PAY`** - payment to a vendor or an employee
```js
{ date, payeeType: 'vendor' | 'employee', payeeId, account: 'cash_factory' | 'bank',
  allocations: [{ docId, amount }], amount /* optional: must equal the sum */, ref /* optional */ }
```
Lands `POSTED`. Each `docId` is a POSTED `VBILL` or an APPROVED `EXP` of that payee. Refused: `payeeId`,
`account` (also: a salary bill is paid from the bank), `allocations`, `allocations[i].docId` (`not_found`,
`wrong_state`, another payee, twice), `allocations[i].amount` (above the open amount), `date` (before the
latest of the bills and claims it pays: "A payment cannot be dated before the bills and claims it pays: <id>
is dated <date>", `docId` that bill or claim), `amount` (not the sum; `cash_short`).

**`PROD`** - production entry
```js
{ date, itemId, mixes, goodUnits, rejectedUnits /* optional */ }
```
Lands `POSTED`. Warning `yield_unusual` (`goodUnits`). Refused: `itemId` (no product, inactive, no
recipe), `mixes` (none once rounded to three decimals; also `stock_short`, naming the material),
`goodUnits`, `rejectedUnits`.

**`SO`** - sales order
```js
{ date, customerId, deliveryDate /* optional, may be later than date */, poRef /* optional */,
  lines: [{ itemId, qty, price /* optional, default the price list of the channel */ }] }
```
Lands `OPEN`. For corporate customers only (SCOPE 4.5). Refused: `customerId` (none; inactive; not of the
corporate channel), `deliveryDate`, `lines`, `lines[i].itemId`, `.qty`, `.price`.

**`INV`** - invoice (a corporate delivery, or further supply to an outlet outside its sheet)
```js
{ date, customerId, soId /* optional */, lines: [{ itemId, qty, price /* optional */ }] /* optional with soId */ }
```
Lands `POSTED`. With `soId` and no `lines` the order's lines are invoiced. With `soId` and `lines` (a
part delivery, a changed quantity) a line sent without `price` takes the price of the order's line for
that item; the price list applies only to an item the order does not have. A line with `qty` 0 is
skipped. Delivering less than the order closes it: there is no back-order. Warnings `credit_limit`, for a corporate customer only, and with `soId` `over_order` (`lines[i].qty`) for a line above the order. Refused: `customerId`, `soId` (`not_found`; another customer;
`wrong_state` when not OPEN, `docId` its invoice), `lines`, `lines[i].itemId`, `.qty` (also
`stock_short`), `.price`.

**`RCPT`** - receipt from a customer
```js
{ date, customerId, account: 'cash_factory' | 'bank', amount, mode /* optional text */,
  allocations: [{ docId, amount }] /* optional: none = all on account */ }
```
Lands `POSTED`; `doc.onAccount` is what was not allocated. Warning `over_owed` (`amount`) when the amount is above every open invoice of the customer together. Refused: `customerId`, `account`, `amount`
(missing; less than its allocations), `allocations[i].docId` (`not_found`, `wrong_state`, another
customer, twice), `allocations[i].amount` (above the open amount).

**`CN`** - stale return
```js
{ date, customerId, lines: [{ itemId, qty, price /* optional */ }] }
```
Lands `POSTED` (allocated to the open invoices, oldest first; the rest in `doc.onAccount`), or `HELD`
when `doc.sharePct` is above `limits.returnsPct` or null (`doc.holdReason`); the Owner: `POSTED`. The
share is tested exactly (2.7): exactly the limit posts, anything above it waits.
Refused: `customerId`, `lines`, `lines[i].itemId`, `.qty`, `.price`.

**`XFER`** - transfer to a store
```js
{ date, toStoreId, lines: [{ itemId, qty }] }
```
Lands `SENT`. A line with `qty` 0 is skipped. Refused: `toStoreId`, `lines`, `lines[i].itemId`, `.qty`
(also `stock_short`).

**`DAYEND`** - store day-end
```js
{ date, storeId, cash, upi, lines: [{ itemId, sold, expired }] }
```
Lands `POSTED`. With expired units the result has `docs: [dayEnd, writeOff]`; the write-off is `PENDING`
(the Owner: `POSTED`). Warning `cash_far` (`cash`). Refused: `storeId`, `date` (`duplicate`, `docId` the day-end already entered),
`cash`, `upi`, `lines[i].itemId`, `lines[i].sold` and `lines[i].expired` (also `stock_short`), `lines`
(a day-end with nothing sold, nothing expired and no cash or UPI: an empty form posted by mistake).

**`DEP`** - cash deposit
```js
{ date, fromAccount /* a cash account */, amount, slipRef /* optional */ }
```
Lands `POSTED`. Refused: `fromAccount`, `amount` (also `cash_short`).

**`ADJ`** - stock count
```js
{ date, locId, reason, lines: [{ itemId, batchId /* finished goods only */, countedQty }] }
```
Lands `PENDING` (the Owner: `POSTED`). `doc.lines[i]` has `systemQty`, `diff`, `rate`, `value`. Warning
`count_far` (`lines[i].countedQty`). Refused:
`locId`, `reason`, `lines`, `lines[i].itemId` (not kept at that location; twice), `.batchId`,
`.countedQty` (also, for the Owner, `stock_short` when the count would take off what a PENDING
write-off holds; `docId` that write-off).

**`WO`** - write-off request
```js
{ date, locId, reason: 'expired' | 'damaged' | 'other', lines: [{ itemId, batchId /* finished goods only */, qty }] }
```
Lands `PENDING` with its quantities reserved (the Owner: `POSTED`). Refused: `locId`, `reason`, `lines`,
`lines[i].itemId`, `.batchId`, `.qty` (also `stock_short`).

**`EXP`** - expense
```js
{ kind: 'claim', date, categoryId, unitId, amount, billRef /* optional */ }             // payee: the persona's employee
{ kind: 'bill', date, payeeId /* vendor */, categoryId, unitId, amount, gstRate /* optional */, billRef }
{ kind: 'salary', monthKey }                                                           // prefill: HB.engine.salaryBill(monthKey)
```
Lands `PENDING` (the Owner: `APPROVED`). A claim's `unitId` is the factory or any active store, whoever
raises it; the form offers them all. Warning `claim_high` (`amount`) on a claim. Refused: `kind`, `categoryId` (also: not a category for that
kind), `unitId`, `amount`, `payeeId`, `gstRate`, `monthKey` (`future_date` while the month is not over,
`locked_month`, `duplicate`).

`OPENSTOCK`, `OPENCASH` and opening invoices and bills cannot be posted by a user: `invalid_input`.

### 3.6 The other operations

| Call | Notes |
|---|---|
| `act('postDispatch', { routeId, date, outlets: [{ customerId, lines: [{ itemId, qty, price? }] }], note? })` | All or nothing; `HB.engine.dispatchSheet(routeId, date).outlets` can be passed as it is, edited. Refused: `routeId`, `date` (date rules; `duplicate` when the sheet is posted, `docId` its first invoice), `outlets` (none; nothing to post; `stock_short` with `error.short`), `outlets[i].customerId` (not a stop, twice, inactive), `outlets[i].lines[j].itemId`, `.qty`, `.price` |
| `act('approve', { id })` | PENDING or HELD only. Refused: `own_approval`, `role`, `not_found`, `wrong_state`, `stock_short` (a count or write-off that would take stock below zero; a count that would take off what another PENDING write-off holds, `docId` that write-off) |
| `act('reject', { id, reason })` | the same, and `invalid_input` on `reason` when it is empty |
| `act('cancel', { id, reason })` | the cancel table of SPEC 5.3. Refused: `role`, `not_found`, `wrong_state`, `has_dependants` (`docId` = what to cancel first), `invalid_input` on `reason`, `stock_short` |
| `act('cancelDispatch', { sheetId, reason })` | cancels a posted dispatch sheet in one operation (SCOPE decision 15): every uncancelled invoice that carries `sheetId`, in the order the sheet posted them, each by its own `CXL` and all with the one `reason`. All or nothing. One log entry; `out.ids` holds one `CXL` id per invoice. Afterwards the sheet is to post again (`sell.sheets`, `dash.work`, `HB.engine.dispatchSheet(...).posted`) and `postDispatch` takes it, under the date rules like any posting: the cancellation is dated the business date and is not held back by them, so a sheet of a locked month is cancelled for good, and one further back than `backDateDays` is posted again by the Owner only. `HB.engine.dateCheck(date)` and `sell.sheet(id).repost` say which beforehand. Refused: `role` (anyone but sales and the Owner), `invalid_input` on `sheetId` (missing, not a string) and on `reason` (empty), `not_found` on `sheetId` (not posted: nothing to cancel), `has_dependants` (an invoice of the sheet has a receipt or a credit note against it: the message names the invoice, `docId` is what to cancel first; nothing of the sheet is cancelled) |
| `act('receiveTransfer', { id })` | SENT only. Refused: `role`, `not_found`, `wrong_state` |
| `act('master', { entity, record })` | add (no `record.id`) or edit; 2.10 has the entities and their rules. Refused: `role`, `invalid_input` (field = the record key, or `'entity'`; field `null` with "Nothing was changed" for an edit that changes no value), `duplicate` (`code`) |
| `act('setActive', { entity, id, active })` | Refused: `role`, `not_found`, `invalid_input` (`'id'`; also "Nothing was changed" when the record is in that state already), `has_dependants` (`'id'`) |

### 3.7 `preview` and `check`

`HB.engine.preview(type, payload)` runs steps 1, 3 and 4 of `act` as a dry run - the same rights, date
rules and validation, for the persona in use - and adds what a form needs. `type` is a document type
with the payload of 3.5, or `'DISPATCH'` with the arguments of `postDispatch`. It never changes the
book, the log or an id.

| Field | When | Holds |
|---|---|---|
| `ok`, `preview: true` | always | |
| `error` | `ok` false | the refusal `act` would give (3.4). Show it at `error.field` |
| `warnings` | always | as `act` would return (3.3): the seven warnings on unusual figures, each with the `field` to show it at, and `credit_limit`. `[]` with a refusal |
| `stock` | always, also when refused | the stock behind the draft (below) |
| `doc` | `ok` true | the document as it would be posted, `id: ''`: lines with `amount`, `taxable`, `cgst`, `sgst`, `cost`, `batches`; totals; `match` (VBILL); `sharePct`, `holdReason` (CN); `creditApplied`, `paidNow` (INV); `consumption`, `unitCost`, `lossValue`, `batchId` (PROD); `systemQty`, `diff`, `value` (ADJ); `shortExcess` (DAYEND) |
| `docs` | DAYEND with expired units; DISPATCH | `[dayEnd, writeOff]`; for a sheet one invoice per outlet in stop order (their `batches` are not worked out) |
| `outcome` | `ok` true, not DISPATCH | `{ status, waits, self }`: the status the document will have when the operation is over, whether it will then wait for the Owner, and whether the Owner's own approval is part of the operation |
| `returns` | CN, `ok` true | `{ from, to, supply, returned, thisReturn, sharePct, limitPct, held, reason }`: the seven-day window, the customer's supply in it, the other returns in it, this one (all taxable, in paise) |
| `credit` | INV, `ok` true | `{ limit, owes, after, over }` for a customer with a credit limit, else null: what the customer owes now and after this invoice. A fact of the master, given for an outlet with a limit too; the warning is for corporates only |
| `sheetId`, `totals` | DISPATCH, `ok` true | the sheet id; `{ itemId: units }` over all outlets |
| `summary` | DISPATCH, `ok` true | the sheet as a whole, added up from `docs`: `{ invoices, units, taxable, gst, total, collected }` (`collected`: what the cash outlets pay at the drop) |

`stock` has one entry per line of the payload, in order (null where the line has no item yet):
`{ index, itemId, batchId, locId, wanted, available, short }`. `available` is what a document dated like
this one may take; `short` is `wanted > available`.

| type | entries | available |
|---|---|---|
| `INV`, `XFER` | per line (an `INV` from an order with no lines: the order's) | unexpired on the date and not reserved, at `fac_fg` |
| `DAYEND` | per line; `wanted` = `sold`. Also `expired`, `expirable`, `expiredShort` | unexpired at the store; `expirable` = what is past best-before, not reserved, and left after the units sold |
| `WO` | per line | on hand less reserved, for that batch |
| `ADJ` | per line; `wanted` 0 | the quantity in the books (`systemQty`) |
| `PROD` | one per material and packing item of the recipe (`index` null); `wanted` = what the mixes and good units draw | at `fac_rm`, less reserved |
| `DISPATCH` | one per product on the sheet (`index` null); `wanted` = the total over the outlets | as `INV` |
| others | `[]` | |

```js
HB.session.set('u_sales');
HB.engine.preview('INV', { date: today, customerId: 'c_corp', lines: [{ itemId: 'bread', qty: 10 }, { itemId: 'puff', qty: 30 }] })
// { ok: false, preview: true, warnings: [],
//   error: { code: 'stock_short', message: 'Veg puff: 30 pcs wanted, 20 pcs available ...', field: 'lines[1].qty', docId: null },
//   stock: [{ index: 0, itemId: 'bread', batchId: null, locId: 'fac_fg', wanted: 10, available: 27, short: false },
//           { index: 1, itemId: 'puff', batchId: null, locId: 'fac_fg', wanted: 30, available: 20, short: true }] }
```

`HB.engine.check(op, args)` is the dry run of any operation: `{ ok: true, preview: true, doc, warnings }`
or the refusal. Use it to disable a button with the engine's own reason when `HB.session.can` alone does
not know (a cancellation with dependants): `HB.engine.check('cancel', { id })`. For `cancel`, `reject`
and `cancelDispatch` asked without a `reason`, the reason is not tested.
`HB.engine.check('cancelDispatch', { sheetId })` returns `{ ok: true, preview: true, sheetId, docs: [],
targets: [the invoices that would be cancelled], warnings: [] }`, or the refusal.
`HB.engine.dateCheck(date, role)` (2.9) is step 3 alone, for a day rather than an entry: `{ ok: true }` or
the date refusal, whatever the rights.

### 3.8 The log

`HB.store` key `log`: an array, append-only. `HB.engine.log()` returns it. One entry per operation that
went through:

```js
{ n: 14, at: '2026-10-02T09:14', userId: 'u_store_mgr', role: 'store_mgr', op: 'post',
  args: { type: 'DAYEND', payload: { ... as sent ... } },
  out: { ids: ['DAYEND-U-0001', 'WO-U-0001'], batchId: null } }
```

- `n` runs from 1 without a gap. `at` is the synthetic clock of 3.2; a document's `createdAt`, an
  approval's `at` and the audit time are the `at` of the entry that made them.
- `out.ids`: the ids of the documents the operation created, in order - one per invoice of a dispatch
  sheet, the day-end and then its write-off, one `CXL` for a cancellation, one `CXL` per invoice for the
  cancellation of a dispatch sheet, none for approve, reject and receiveTransfer. For a `master` that adds a record: the id of the new record (`cus_051`, `st_nadiad`).
- `out.batchId`: the batch of a `PROD`.
- A document made by an entry is `HB.book.docs[entry.out.ids[i]]`; the entry that made a document is the
  one whose `out.ids` holds its id. The guide (SPEC 8.1) matches steps on `op`, `args` and those documents.

### 3.9 boot, replay, fresh copy

`HB.engine.boot()`:

1. Seed version. When `HB.seed` exists and has a `VERSION`: no `meta.seedVersion` yet is a new copy and
   the version is recorded; another version discards the log, takes `HB.calendar.realToday()` (clamped)
   as the business date, records the version and leaves a sentence in `HB.engine.notice`. With no
   `HB.seed` nothing is tested.
2. `HB.engine.reset()`.
3. `HB.seed.run(HB.calendar.dataEnd)` when there is a seed. Otherwise `HB.engine.postOpening()`: the book
   then holds the opening entries of the config and what the log makes.
4. Replay: every log entry, in order, through the inner half of `act` (3.2, steps 3 and 4) with the
   user, role, time, ids and batch id stored in it. Rights are not tested again; dates and validation
   are. An entry that is refused - or throws - is skipped and listed in `HB.engine.skipped`:
   `{ n, at, userId, role, op, args, out, code, reason }`. Its ids stay its own, so every later entry
   makes its documents under the ids it was given, and an entry that names a document a skipped entry
   would have made is skipped in turn (`not_found`). So is a `cancelDispatch` whose sheet is not posted
   at that point (`not_found`), or has another number of invoices than the entry fixed ids for
   (`wrong_state`): no document is ever made under an id the log does not hold. New ids are numbered
   after the highest in the log, so the number of a skipped entry is never given again. Warnings are
   computed again on replay, from the same book and the same entry: `doc.warned` and the audit
   sentences come back as they were.
5. Returns `HB.book`; `HB.engine.booted` is `true`.

`boot` throws only for a broken seed or a wrong `HB.config.opening`; the shell reports that in a banner.
A reload under any persona gives the same book: the check compares a hash of every ledger.

`HB.config.opening` (optional; all parts optional), posted dated go-live as seeded documents:

```js
{ date: '2026-01-01',                                              // default HB.calendar.goLive
  stock: [{ locId, itemId, qty, rate },                            // a material: the rate is its first purchase price
          { locId, itemId, qty, mfgDate, bestBefore, batchId }],   // finished goods: a batch (the last two optional)
  cash: [{ accountId, amount }],
  receivables: [{ customerId, total, dueDate }],                   // one opening invoice each
  payables: [{ vendorId, total, dueDate, billNo }] }               // one opening bill each
```

`HB.engine.freshCopy()` removes the log, calls `HB.calendar.set(HB.calendar.realToday())` and reloads the
page. In Node there is nothing to reload: it boots again in place and returns the book. `prefs` (the
persona, the shell's settings) are kept; `HB.store.resetAll()` is the call that removes those too.

Banners the shell reads after a boot: `HB.engine.skipped` (non-empty), `HB.engine.notice` (non-empty),
`HB.store.ok` (false).

### 3.10 Notes for the other authors

- **Seed**: define `HB.seed = { VERSION: '<string>', run: function (toDate) { ... } }`. `boot` has already
  reset the book when it calls `run`; post through `HB.engine.core` with `seed: true` and leave `ids` out
  (seeded ids are `TYPE-YYMMDD-NNN`; the form `TYPE-U-NNNN` is the user's). Bump `VERSION` whenever the
  generator or a parameter changes. If the config carries `opening`, `HB.engine.postOpening()` posts it.
- **Pages**: build the payload from the draft, return `HB.engine.preview(type, payload)` from `onPreview`
  and `HB.engine.act(...)` from `onSubmit`. Do not test rights, dates or stock in a page. For a disabled
  action use `HB.session.can(action, { doc }).reason`, and `HB.engine.check` where the state matters.
- **Selectors**: `HB.book` is replaced by every `boot`; read `HB.book` and `HB.masters` when called, do
  not keep a reference across a `'store:changed'`.
- **Sheets**: `HB.engine.dispatchSheet` and `transferSheet` (2.9) prefill; `preview('DISPATCH', ...)` and
  `preview('XFER', ...)` say what is short as the user edits. How to cut a short column is the page's
  choice, from `stock[i].available`.

### 3.11 Checking it

`node tools/check.js` (`npm run check`). Part (a) runs on `tools/fixture-tiny.js` through `HB.engine.act`
as the personas: a hand-worked case of 35 operations - one of every document type, with the arithmetic
in the comments and the stock by batch, unit costs, GST, every customer's, vendor's, cash and bank
balance and every P&L line asserted to the paisa - then every refusal code, what `preview` and `check`
return, post-then-cancel for every type that can be cancelled, master changes and their audit entries
(and the edit that changes nothing, refused without a history entry), and persistence: save, rebuild and replay under another persona (a hash of every ledger), skipped
entries and the ids after them, the seed version, a fresh copy. Section a.15 runs, on a new copy, the
rules two reviews found broken: the order's price on a part delivery, stock held by a waiting
write-off against a cancellation and a count, the document named when a production entry cannot be
cancelled, the returns limit on the exact ratio, a claim for another unit, an expense bill without
GST, a scope that a payload field cannot move, dates and batch ids that are not strings, the prefilled
transfer, the salary bill by role, and empty lines. Section a.16 runs what the screens reported: a
goods receipt dated before its order, a payment dated before the latest claim it pays, a sales order for an outlet, the credit-limit warning for
corporates only, statuses named in words in every refusal, and the totals of a previewed sheet. Section
a.17 runs the seven warnings on a new copy: each silent at its threshold and raised just beyond it (on
both sides where it has two), one entry posted with each (not refused, the code in `doc.warned`, the
sentence in the audit entry), the yield sentence just beyond a bound (a second decimal), mixes that
round to none, the credit-limit warning beside them unchanged, nothing for the seed, the
thresholds moved and removed in the masters, and the replay. Section a.18 runs `cancelDispatch`: refused
whole while a receipt rests on one invoice, by role, the one log entry and its `CXL` ids, every figure
back to its value before the sheet (a snapshot of every balance), the sheet posted again and cancelled
by the Owner, the replay under another persona, two logs with an earlier entry broken, and on later
business dates `HB.engine.dateCheck` by role and day: a sheet further back than sales may go, and a
sheet of a locked month cancelled all the same and then refused to the Owner.

`node tools/check.js` is the whole self-check: part (a), part (s) (4.24), then the full company from
`tools/check-seed.js` - part (b), the seed reconciled by a straight pass over the raw documents,
determinism and prefix stability, the dated master changes, the hand-over and material cover of every
simulated day, the calibration bands of RESEARCH 13 and the build times; part (c), the stories and the
guide journeys on nine business dates. One summary, exit code 1 on any failure. Parts (b) and (c) take
about two minutes, so name the parts to run fewer: `node tools/check.js a s` is the quick half,
`node tools/check.js b -v` prints every band with its figure. `npm run check:config` runs
`tools/check-config.js`; `npm run check:all` runs both.

---

## 4. Selectors

File: `js/data/data.js`. Global: `HB.data`. Everything a page shows comes from here: a page calls a selector
when it draws and holds no figure of its own. Nothing in this section changes the book.

Contents: [4.1 Rules for every selector](#41-rules-for-every-selector) - [4.2 lookup](#42-hbdatalookup) -
[4.3 stock](#43-hbdatastock) - [4.4 buy](#44-hbdatabuy) - [4.5 make](#45-hbdatamake) - [4.6 sell](#46-hbdatasell) -
[4.7 stores](#47-hbdatastores) - [4.8 ar](#48-hbdataar) - [4.9 ap](#49-hbdataap) - [4.10 cash](#410-hbdatacash) -
[4.11 pnl](#411-hbdatapnl) - [4.12 margin](#412-hbdatamargin) - [4.13 gst](#413-hbdatagst) - [4.14 exp](#414-hbdataexp) -
[4.15 people](#415-hbdatapeople) - [4.16 approvals](#416-hbdataapprovals) - [4.17 audit](#417-hbdataaudit) -
[4.18 notify](#418-hbdatanotify) - [4.19 dash](#419-hbdatadash) - [4.20 doc](#420-hbdatadoc) - [4.21 guide](#421-hbdataguide) -
[4.22 reports](#422-hbdatareports) - [4.23 Cache and cost](#423-cache-and-cost) - [4.24 Checking it](#424-checking-it) -
[4.25 Choices where SPEC was silent](#425-choices-where-spec-was-silent)

### 4.1 Rules for every selector

**Loading.** Browser: after `kernel.js`, `config.js`, `engine.js` and `seed.js`. Node: `require` it after the
engine. Loading it runs nothing; a selector called before `HB.engine.boot()` (no book yet) throws.
`HB.data.ready()` is `true` once there is a book.

**Call, draw, forget.** Call the selector inside `render`; do not keep what it returns across a
`'store:changed'` or a `'session:changed'`. What it returns is shared with every other caller until the
book changes: **read-only**. Copy before sorting or changing (`rows.slice().sort(...)`). The field `doc` on a
row is the live document of `HB.book`: read-only as well.

**Units.** Money: whole paise. Rate, price, unit cost: paise per unit (may carry a fraction). Quantity: units
with at most three decimals. Date: `'YYYY-MM-DD'`. A share, a yield, a margin percentage: a **fraction**
(`0.125` is 12.5%), ready for `HB.fmt.pct`. The one exception is `sharePct` of a stale return and the limits
(`limitPct`, `tolerancePct`): percentages as the engine stores them (`12.8` is 12.8%).

**Filter `f`.** Always optional, a plain object. Fields a selector does not list are ignored.

| Field | Meaning |
|---|---|
| `from`, `to` | dates, both included. Default: go-live and the business date. Cut to that span |
| `unitIds` (a list) or `unitId` | units wanted, inside the persona's scope |
| `channel` | `'retail'`, `'corporate'`, `'store'` |
| `status` | a document status |
| `customerId`, `vendorId`, `itemId`, `locId`, ... | as listed with each selector |

Every matching field takes one value **or a list**; `undefined`, `null`, `''` and `'all'` mean "no filter"
(`{ status: ['PENDING', 'HELD'] }`, `{ channel: 'retail' }`). A selector that takes one id as a plain argument
(`stock.onHand(locId)`, `buy.openReceipts(vendorId)`, `ar.openInvoices(customerId)`) reads it the same way, so a
select whose first option is `''` or `'all'` can be passed as it is.

**Rows, not statuses.** Every amount and quantity is a sum of ledger rows by the row's own date, originals and
reversals alike. A cancelled document keeps its figures on its date; the cancellation is a row of its own on
the day it was made, with `reversal: true`, `docId` = the `CXL`, `refId` = the document it cancels and
`note` = `'Cancellation of <id>: <reason>'`. Only document lists, open balances and "to do" lists look at a
status: a list shows a cancelled document (`status: 'CANCELLED'`, `cancelled: true` - put it under a
Cancelled tab); open balances and to-do lists leave it out.

**No other period, no forecast.** No selector returns a figure of a previous period, a change, a trend or a
projection. The only series are `pnl.months()`, `sell.by('month', f)`, `sell.by('day', f)` and the points of a
dashboard range (`dash.period(f).points`, 4.19): the days of the range that was asked for, or its months, and
nothing outside it.

**What comes back.** A list of documents is an array. Figures come as `{ rows, totals }` (often with `from`
and `to`), `totals` keyed like a row. Never `null` for a list: an empty array.

**Document rows.** Every row of a document list starts with these fields, then adds its own:

```
id, type, typeLabel, date, status, statusLabel, cancelled (bool), seed (bool),
createdBy, createdByName, createdAt ('YYYY-MM-DDTHH:MM'), note, doc (the live document)
```

`createdByName` is the persona's name, or for a seeded store document the store's own manager it names
(`createdAs`); `receivedByName`, `raisedByName`, the audit `userName` and `lookup.enteredBy` follow the same rule.

Lists are newest first: by `date`, then by posting order.

**Scope and view.** Every selector is cut to `HB.session.scope()` - units, locations, accounts - and to what
the role has a page for (`HB.session.access`). A selector the role has no page for returns an empty result
(`[]`, zero totals, `null` for one object), never an error, so a page need not test the role first:

| What | Roles besides the Owner and accounts | Decided by |
|---|---|---|
| stock on hand, batches, expiring, value, write-off requests | every role, its own locations | `scope().loc` |
| stock ledger and statement | stores, production, store_mgr: their own locations | `stock-ledger` (the statement also with `reports`), then `scope().loc` |
| stock counts | stores: its own locations | `stock-counts`, then `scope().loc` |
| purchase orders, receipts | stores | a page among `buy-orders`, `buy-receipts` |
| vendor bills, payments, payables (`ap.*`), purchase register | none | `buy-bills`, `buy-payments`, `acc-payables` |
| production entries, yield, to-do | production | `make-production` |
| recipes, cost sheet | production | `make-recipes`, `masters-items`, `acc-margin` (or `make-production`) |
| invoices, orders, returns, sheets (unit `factory`) | sales | the `sell-*` pages |
| sales figures (`sell.summary`, `by`, `register`, `returns`) | sales: retail and corporate; store_mgr: its store's counter sales | the `sell-*` pages or `stores-dayend`, then `scope().unit` |
| receipts, receivables (`ar.*`), collections | sales | `acc-receivables`, `sell-receipts`, `sell-invoices` |
| transfers | stores (every store), store_mgr (its own) | `stores-transfers` / `stores-dayend`, then the store's unit or transit location |
| day-ends | store_mgr (its own) | the same, then `scope().unit` |
| cash and bank | store_mgr: its store's cash | `scope().account` |
| expenses | `HB.session.expenseView()`: store_mgr its unit's claims and bills and its own claims, never the salary bill; stores, production, sales their own claims | 4.14 |
| P&L, margin, GST, people, approvals, audit, notifications, reports | none | `acc-pnl`, `acc-margin`, `acc-gst`, `people`, `approvals`, `sys-audit`, `sys-notifications`, `reports` |
| salaries | none | `HB.session.canSeeSalaries()`: the field is absent, not zero |
| cost and margin of an invoice (`cost` on a row of `sell.invoices` or `sell.sheet`, `unitCost` and `cost` on the lines of its `doc.view`, `costing`) | none | `acc-margin`: the fields are absent, not zero (`costing` is `null`) |

**Labels.** `HB.data.lookup.typeLabel(type, kind)` ("Purchase order", "Stale return", "Expense claim"),
`statusLabel(status)` ("Waiting for approval", "Part received"), `channelLabel(channel)` ("Retail outlets",
"Corporates", "Own stores"). Rows carry them already as `typeLabel`, `statusLabel`, `channelLabel`,
`kindLabel`.

### 4.2 `HB.data.lookup`

Masters as a page may show them: a copy with a display name, without the fields SPEC 5.1 keeps for the seed
and without the salary for a role that may not see it. An unknown id gives
`{ id, name: <the id>, display: <the id>, unknown: true }`, so a page never tests for null.

| Call | Returns |
|---|---|
| `lookup.item(id)` | `{ id, code, name, display, kind: 'fg'\|'rm'\|'pk', kindLabel, unit, pack, hsn, gstRate, shelfLifeDays (fg, else null), price: { mrp, retail, corporate } or null, reorderLevel, hasRecipe, active }`. `display` is the name with the pack ("Sandwich bread, 400 g") |
| `lookup.customer(id)` | `{ id, name, display, channel, channelLabel, outletType, routeId, routeName, locality, terms, termsLabel, creditDays, creditLimit (paise), gstin, standing: { itemId: qty }, active }`. For a role that deals with no customers (stores, production, store_mgr) only `{ id, name, display }` |
| `lookup.vendor(id)` | `{ id, name, display, kind: 'stock'\|'expense'\|'staff', town, gstin, termsDays, supplies: [itemId], active }`. For a role that deals with no vendors (sales, production, store_mgr) only `{ id, name, display }` |
| `lookup.employee(id)` | `{ id, name, display, dept, designation, unitId, unitName, doj, dol, phone, active }`, and `salary` (paise a month) for the Owner and accounts only |
| `lookup.unit(id)` | `{ id, name, display, kind: 'factory'\|'store', locId, transitLocId, cashAccountId, standing, active }` |
| `lookup.location(id)` | `{ id, name, display, kind: 'rm'\|'fg'\|'store'\|'transit', unitId, unitName, active }` |
| `lookup.account(id)` | `{ id, name, display, kind: 'cash'\|'bank', unitId, active }` |
| `lookup.category(id)` | `{ id, name, display, mode: 'claim'\|'bill'\|'both', system: 'salary'\|'cash_short'\|null, active }` |
| `lookup.route(id)` | `{ id, name, display, stops: [customerId], active }` |
| `lookup.user(id)` | `{ id, name, display, initials, role, roleLabel, employeeId, unitId }` |
| `lookup.enteredBy(doc)` | the name of who entered the document: the persona, or the store manager a seeded store document names (`createdAs`) |
| `lookup.payee(payeeType, id)` | `lookup.employee(id)` for `'employee'`, else `lookup.vendor(id)` |
| `lookup.name(kind, id)` | the name alone, a string. `kind`: `item customer vendor employee unit location account category route user` |

Lists, each an array of the records above. `active`: `true` (default), `false`, or `'all'`.

| Call | Returns |
|---|---|
| `lookup.items({ kind, active })` | items in master order. `kind`: `'fg'`, `'rm'`, `'pk'`, `'material'` (raw and packing) or a list |
| `lookup.customers({ channel, routeId, active })` | customers; with one `routeId` in the order of its stops, otherwise by name. `[]` for a role that deals with no customers (stores, production, store_mgr) |
| `lookup.vendors({ kind, active })` | vendors by name. `[]` for sales, production, store_mgr |
| `lookup.units({ kind, all, active })` | the units in scope. `all: true`: every unit - for a claim, which may be for any location |
| `lookup.stores({ active })` | the store units the persona deals with: its own; every store for stores, the Owner and accounts |
| `lookup.locations({ kind, active })` | the stock locations in scope |
| `lookup.accounts({ kind, active })` | the cash and bank accounts in scope |
| `lookup.categories({ mode, system, active })` | expense categories for a form: `mode: 'claim'` or `'bill'` (a category of mode `both` serves either). The two the engine posts to itself (salaries, store cash short / excess) are left out unless `system: true` |
| `lookup.routes()` | active routes |
| `lookup.users()` | the six personas |
| `lookup.channels()` | `[{ id: 'retail', name: 'Retail outlets' }, ...]` |

```js
var L = HB.data.lookup;
h('td', null, L.item(line.itemId).display);                       // a cell
picker.options = L.customers({ channel: 'corporate' }).map(function (c) { return { value: c.id, label: c.display }; });
L.items({ kind: 'material' });                                    // the item picker of a purchase order
```

### 4.3 `HB.data.stock`

| Call | Returns |
|---|---|
| `stock.onHand(locId)` | array, one row per item kept at the location (materials and packing at `fac_rm`, products everywhere else). `locId`: one location, a list, or (none, `''`, `'all'`) every location in scope. An active item with nothing on hand is listed with `qty: 0`; a transit location lists only what is in it |
| `stock.batches(f)` | array: the finished-goods batches on hand, oldest first (best-before, made on, batch id). `f`: `{ locId, itemId, flag }`, each one value, a list or no filter |
| `stock.ledger(f)` | the movement ledger, oldest first. `f`: `{ from, to, locId, itemId, batchId, kind, docId, limit }`. Empty for a role without the `stock-ledger` page (sales) |
| `stock.statement(f)` | opening, in, out, closing per location and item. `f`: `{ from, to, locId, itemId, kind }` (`kind`: the item's). For a role with the `stock-ledger` or the `reports` page |
| `stock.lowStock()` | array: materials and packing at `fac_rm` at or below their reorder level |
| `stock.expiring(days)` | array of batch rows: on hand and expired, or within `days` of best-before. `days` defaults to `limits.nearExpiryDays`; pages call it with no argument |
| `stock.value()` | the stock in scope at today's cost |
| `stock.counts(f)` | array of stock counts (`ADJ`), newest first. `f`: `{ from, to, status, locId, reason }`. For a role with the `stock-counts` page, at its locations |
| `stock.writeOffs(f)` | array of write-off requests (`WO`), newest first. `f`: `{ from, to, status, locId, reason, sourceDocId }`. Every role, at its locations |
| `stock.kinds()` | `[{ id, name }]`: the kinds of stock movement with the `kindLabel` a ledger row carries, for a filter on `kind` (stock-ledger) |

`onHand` row: `{ locId, locName, locKind, unitId, itemId, itemName, code, kind, unit, qty, reserved, available,
expired, nearExpiry, batches, rate, value, reorderLevel, low }`. `reserved`: on write-off requests that
wait. `available`: what a document dated the business date may take (unexpired, not reserved; `0` in
transit). `expired` and `nearExpiry`: units past, or within `limits.nearExpiryDays` of, best-before.
`batches`: number of batches on hand. `rate`: today's unit cost (latest purchase price, or recipe cost);
`value` = `amount(qty, rate)`. `low`: only at `fac_rm`, `available <= reorderLevel` for a level above zero.

Batch row (`batches`, `expiring`): `{ batchId, itemId, itemName, code, unit, locId, locName, locKind, unitId,
mfgDate, bestBefore, daysLeft, qty, reserved, available, flag, flagLabel, rate, value, prodId, canOpen }`.
`daysLeft`: days from the business date to best-before (negative once expired). `flag`: `'expired'`
(best-before is before the business date), `'near'` (within `limits.nearExpiryDays`), `'ok'`; `flagLabel`:
"Expired", "Near expiry", "In date". `available`: `0` for an expired batch and in transit. `prodId`: the
production entry (or opening entry) that made the batch; `canOpen`: whether the persona may open it
(`doc.get` would answer) - a page links `prodId` only when it is `true`, since a batch is in scope by its
location while the entry that made it belongs to the production pages.

`ledger` returns `{ from, to, rows, count, truncated, opening, closing, qtyIn, qtyOut }`. Row: `{ seq, date,
docId, refId, refType, locId, locName, itemId, itemName, unit, batchId, qty (signed), qtyIn, qtyOut, kind,
kindLabel, reversal, note, balance, canOpen }`. `kind`: the engine's (2.4); `kindLabel`: "Goods receipt", "Used in
production", "Dispatch", "Transfer to store", "Received at store", "Store sale", "Stock count", "Write-off".
`canOpen`: whether the persona may open `docId` (`doc.get` would answer): the ledger is cut by location while
a document belongs to its pages, so stores cannot open the production entry behind a consumption row; a page
links the id only when `canOpen` is `true`. With **one** real `locId` and **one** real `itemId` - a single id
each, not `''`, `'all'` or a list - and no `kind` or `docId`, the rows carry a running `balance` and the
result `opening` and `closing` (of the batches `batchId` names, or of the whole item); otherwise those are
`null`. At most `limit` rows come back (default 5000; `limit: 0` for all - two years of every item is three
quarters of a million rows); `count`, `qtyIn` and `qtyOut` are of every row that matched and `truncated` says
whether rows were left out. `qtyIn` and `qtyOut` mean something for one item only: across items they add
kilograms to pieces, so show them only when `itemId` names one item.

`statement` returns `{ from, to, rows, totals: { value } }`. Row: `{ locId, locName, itemId, itemName, kind,
unit, opening, qtyIn, qtyOut, closing, rate, value }`: quantities at the start and the end of the range
from the movement ledger; `value` = the closing quantity at **today's** cost. `locId` and `itemId` take one
value, a list or no filter, like every filter field.

`counts` and `writeOffs` rows: the common fields, then `{ locId, locName, unitId, reason, value, lineCount,
sourceDocId (the day-end a write-off came from, else null), waiting (PENDING), rejectReason }`. A count is
listed for a role with the `stock-counts` page and a write-off for every role, at the persona's locations: so
whoever raised one finds it in its list while it waits and after a rejection (4.16), and the stock-counts and
stock-batches pages have their document table.

`lowStock` row: `{ itemId, itemName, code, kind, unit, qty, reserved, available, reorderLevel, onOrder,
orderIds }`. `onOrder`: what open purchase orders still expect; `orderIds`: those orders (`[]` for a role
that has no purchase pages). An alert only: there is no quantity to order and no order prefill.

`value` returns `{ total, materials, packing, finished, rows: [{ locId, locName, kind, unitId, value }] }`.

```js
var rows = HB.data.stock.onHand(state.locId);                 // stock-onhand
ui.table({ columns: [{ key: 'itemName', label: 'Item' }, { key: 'qty', label: 'On hand', format: 'qty' },
  { key: 'available', label: 'Available', format: 'qty' }, { key: 'value', label: 'Value', format: 'inr2' }], rows: rows });
var led = HB.data.stock.ledger({ from: f.from, to: f.to, locId: 'fac_rm', itemId: itemId });   // with a running balance
```

### 4.4 `HB.data.buy`

Seen by the Owner, accounts and stores (orders and receipts); bills, payments and the register by the Owner
and accounts only.

| Call | Returns |
|---|---|
| `buy.orders(f)` | array of purchase orders. `f`: `{ from, to, status, vendorId, open: true }` (`open`: APPROVED or PART_RECEIVED) |
| `buy.receipts(f)` | array of goods receipts. `f`: `{ from, to, status, vendorId, poId, unbilled: true }` |
| `buy.bills(f)` | array of vendor bills, opening bills included. `f`: `{ from, to, status, vendorId, open: true }` |
| `buy.payments(f)` | array of payments, to vendors and to employees. `f`: `{ from, to, status, payeeType, payeeId, account }` |
| `buy.dueForReceipt(date)` | array: orders APPROVED or PART_RECEIVED expected on or before `date` (default the business date), earliest first |
| `buy.toReceive(poId)` | one order that still expects goods, whenever it is expected, in the shape of a `dueForReceipt` row (`daysLate` counted to the business date): the lines a goods receipt form prefills. `null` when the order is not APPROVED or PART_RECEIVED |
| `buy.openReceipts(vendorId)` | array: posted receipts on no bill - what a bill can be entered for. No argument: of every vendor |
| `buy.register(f)` | the purchase register. `f`: `{ from, to, vendorId }` |

Rows, after the common fields:

- order: `vendorId, vendorName, expectedDate, total, lineCount, receivedValue, receivedPct (fraction of the
  value), open, late (open and past its expected date), daysLate, waiting (PENDING), grnIds`
- receipt: `poId, vendorId, vendorName, billId, billed, lineCount, value (accepted quantity at the order's
  rate), hasRejected`
- bill: `vendorId, vendorName, billNo, grnIds, taxable, gst, total, paid, open (0 unless POSTED), dueDate,
  overdue, daysOverdue, matchOk, holdReason, opening`
- payment: `payeeType, payeeId, payeeName, account, accountName, amount, ref, allocations: [{ docId, type,
  typeLabel, amount }], paysFor` - `'vendor_bill'`, `'claim'`, `'bill'` (an expense bill), `'salary'` or
  `'mixed'`
- `dueForReceipt`, `toReceive`: `vendorId, vendorName, expectedDate, daysLate, total, lines: [{ itemId, itemName,
  unit, qty, received, toCome, rate }]` (only the lines with something still to come)
- `openReceipts`: the receipt row plus `lines: [{ itemId, itemName, unit, qty, rate, gstRate, amount }]`:
  the lines a bill form prefills (`gstRate` from the order)

`register` returns `{ from, to, rows, totals: { taxable, cgst, sgst, gst, total } }`: one row per vendor bill on
the day its payable is dated (a held bill appears once approved, on its own date; opening bills are not
purchases and are left out), and a cancellation as a negative row on its own date. Row: `{ seq, date, docId,
billId, billNo, vendorId, vendorName, taxable, cgst, sgst, gst, total, reversal, note }`.

```js
var due = HB.data.buy.dueForReceipt();                         // buy-receipts: "expected today"
var order = HB.data.buy.toReceive(poId);                       // buy-receipts: the receipt form, one line per order.lines
form.prefill(HB.data.buy.openReceipts(vendorId));              // buy-bills: choose the receipts, prefill the lines
```

### 4.5 `HB.data.make`

Seen by the Owner, accounts and production.

| Call | Returns |
|---|---|
| `make.entries(f)` | array of production entries. `f`: `{ from, to, status, itemId }` |
| `make.entryOf(doc)` | one entry row from the document itself, also from the `doc` of `HB.engine.preview('PROD', ...)`: how the production form shows the yield before posting. `null` for another document or a role without production |
| `make.yieldByItem(f)` | `{ from, to, rows, totals }`: yield by product. `f`: `{ from, to, itemId }` |
| `make.register(f)` | `{ from, to, rows, totals }`: the production register, a cancellation as a negative row. Same `f` |
| `make.todo(date)` | array: production still to record for `date` (default the business date) |
| `make.costSheet(itemId)` | the cost sheet of a product, or `null` (no recipe, or a role without recipes) |
| `make.recipes()` | array: every recipe with today's costs |

- entry row: `itemId, itemName, unit, mixes, expectedUnits, goodUnits, rejectedUnits, yield (good / expected,
  a fraction), batchId, bestBefore, unitCost, materialCost (sum of the consumption values), lossValue`
- `yieldByItem` row: `{ itemId, itemName, unit, runs, mixes, expectedUnits, goodUnits, rejectedUnits, yield,
  lossValue }`; `totals` has the same fields without the item. An entry counts on its date; a cancellation
  takes it back on the date of the cancellation
- `register` row: `{ date, docId, prodId, itemId, itemName, unit, batchId, mixes, expectedUnits, goodUnits,
  rejectedUnits, yield, unitCost, lossValue, reversal, note }` (negative figures on a reversal row)
- `todo` row: `{ itemId, itemName, unit, mixLabel, standardMixes, expectedUnitsPerMix }`: the standard day plan
  (every recipe whose `rhythm` includes that weekday, at its `standardMixes`) less the products that already
  have an uncancelled entry dated that day. Nothing in it depends on demand, orders or stock
- `costSheet`: the engine's sheet (2.9: `itemId, name, mixLabel, expectedUnits, materials[], packing[], mixCost,
  materialPerUnit, packingPerUnit, unitCost`) plus `unit, gstRate, mrp, channels: [{ channel, label, price,
  margin, marginPct }]` - per channel the price before GST (for `store`: the MRP less the GST inside it), the
  margin over today's unit cost (paise per unit) and that margin as a fraction of the price
- recipe row: `{ itemId, itemName, unit, active, mixLabel, expectedUnits, rhythm ('daily' or weekdays, 0 =
  Monday), rhythmLabel, standardMixes, materials, packing, mixCost, materialPerUnit, packingPerUnit, unitCost }`

```js
HB.data.make.todo().forEach(function (t) { list.add(t.itemName, HB.fmt.num(t.standardMixes) + ' x ' + t.mixLabel); });
var y = HB.data.make.yieldByItem({ from: f.from, to: f.to });  // y.rows for the table, y.totals.yield for the tile
```

### 4.6 `HB.data.sell`

Documents (unit `factory`) are seen by the Owner, accounts and sales. The figures are cut by unit: sales sees
the retail and corporate channels, the store manager the counter sales of its store.

| Call | Returns |
|---|---|
| `sell.invoices(f)` | array of invoices, opening invoices included. `f`: `{ from, to, status, customerId, channel, routeId, sheetId, open: true, opening: false }` (`opening: false` leaves the opening invoices out) |
| `sell.orders(f)` | array of sales orders. `f`: `{ from, to, status, customerId }` |
| `sell.creditNotes(f)` | array of stale returns. `f`: `{ from, to, status, customerId, channel }` |
| `sell.receipts(f)` | array of receipts. `f`: `{ from, to, status, customerId, account }` |
| `sell.sheets(date)` | array: one row per route for `date` (default the business date) |
| `sell.sheet(sheetId)` | one dispatch sheet by its id (`'DS-<routeId>-<YYMMDD>'`, `HB.engine.sheetId`), or `null` when the id names no route and day or the role has no sales documents |
| `sell.summary(f)` | sales of the range. `f`: `{ from, to, unitIds, unitId, channel, customerId, routeId }` |
| `sell.by(dim, f)` | `{ dim, from, to, rows, totals }`. `dim`: `'item'`, `'customer'`, `'route'`, `'channel'`, `'unit'`, `'day'`, `'month'`. Same `f` (`'item'` honours `from`, `to`, `unitIds`, `unitId` and `channel` only) |
| `sell.returns(f)` | stale returns of the range. `f` as `summary` |
| `sell.register(f)` | the sales register. `f` as `summary` |

Rows, after the common fields:

- invoice: `customerId, customerName, channel, channelLabel, routeId, routeName, sheetId, soId, terms, dueDate,
  units, taxable, gst, total, paidNow, creditApplied, received, credited, open (0 unless POSTED),
  overdue, daysOverdue, opening`, and `cost` for the Owner and accounts only: for sales the field is absent,
  not zero (as a salary is). Show cost and margin of an invoice from `doc.view(id).costing`, never from `doc`
- order: `customerId, customerName, deliveryDate, poRef, lineCount, units, value (before GST), invId, due
  (OPEN and to deliver on or before the business date)`
- stale return: `customerId, customerName, channel, channelLabel, units, taxable, gst, total, sharePct (percent,
  null when there was no supply), limitPct, holdReason, allocated, onAccount`
- receipt: `customerId, customerName, account, accountName, mode, amount, allocated, onAccount`
- sheet: `{ sheetId, routeId, routeName, date, outlets (active stops), posted, toPost, invoiceIds, invoices
  (count), units, total, collected }`. `toPost`: no uncancelled invoice carries the sheet id (and the route has
  an active outlet)
- `sell.sheet(sheetId)`: `{ id, type: 'DS', typeLabel: 'Dispatch sheet', sheetId, routeId, routeName, date,
  posted, invoiceIds, invoices, units, total, collected }`. Here `invoices` is an **array** of invoice rows
  (above): every invoice that carries the sheet id, in the order posted (stop order), cancelled ones included
  (`cancelled: true`). `posted`, `invoiceIds`, `units`, `total` and `collected` are of the uncancelled ones, as
  on a row of `sell.sheets`. A sheet that was never posted is a record all the same (`posted: false`, no
  invoices): any route and day make an id. A sheet taken back by `cancelDispatch` (3.6) is `posted: false`
  with its invoices listed as cancelled, and `toPost` again on its row of `sell.sheets`. `repost: { ok, code,
  reason, owner }`: whether the persona in use may post a sheet of that day, a posted one once it is
  cancelled - the date rules alone (`HB.engine.dateCheck`), the same for every route of the day. `code`
  and `reason` are the date refusal: `locked_month` (nobody can, `owner: false`) or `backdate_limit`
  (further back than this role may go; `owner: true`, the Owner still can). What the Dispatch screen says
  before "Cancel the sheet", in the dialog, the toast and the callout

`summary` returns `{ from, to, units, sales, returns, returnUnits, cogs, net, margin, marginPct, byChannel,
collections }`. `sales`: taxable before returns; `returns`: negative for a note on its date and positive for
its cancellation on the day it was made, so zero or less unless a note of an earlier period was cancelled in
this one (rows, not statuses); `net = sales + returns`;
`margin = net - cogs`; `marginPct = margin / net`. `byChannel`: one entry per channel in scope, sold in or
not: `{ channel, label, units, sales, returns, returnUnits, cogs, net, margin, marginPct }`.
`collections`: `{ total, cash, bank }` - cash taken on delivery plus receipts, by the cash row's date - or
`null` for a role without receivables (the store manager: store takings are sales and cash, not collections).

`by` row: `{ key, label, units, sales, returns, returnUnits, cogs, net, margin, marginPct, share }` (`share`:
of the net total), plus per dimension: `item`: `itemId, unit`; `customer`: `customerId, channel, unitId`;
`route`: `routeId`; `channel`: `channel`; `unit`: `unitId`; `day`: `date`; `month`: `monthKey`. `totals`: the
same figures. Whatever the dimension the rows add up to `summary(f)`: counter sales have no customer and no
route and corporates no route, so they come as rows of their own, with the same fields as the others -
`key: 'store:<unitId>'` ("Vidyanagar store (counter sales)", `customerId: null, channel: 'store'`) by customer;
`key: 'stores'` ("Own stores (no route)"), `'corporate'` ("Corporates (no route)"), both `routeId: null`, by
route. The route of a sale is the invoice's own; of a return or a receipt, the outlet's route when it was
raised (below). `day`, `month` and `channel` give every day, month or channel of the range and the scope,
with zeros: plain bars with no gaps. `item`, `customer`, `route` and `unit` leave out a group whose units,
sales, returns and cost all come to nothing in the range (what a sheet posted and cancelled the same day
leaves), as the GST summary leaves out such a rate; the totals are the same either way. Order: items, units and routes in master order, channels retail -
corporate - store, customers by net sales, days and months by date.

`returns` gives `{ from, to, rows, totals: { units, taxable, gst, total }, byCustomer, byItem }`, figures
**positive** (a cancelled return is a negative row on the date of its cancellation). Row: `{ seq, date,
docId, cnId, customerId, customerName, routeId, routeName, units, taxable, gst, total, sharePct, reversal,
note }`. `byCustomer`: `[{ customerId, customerName, routeId, routeName, supply, returns, units, share }]`
(`share` = returns / supply of the range, a fraction). `byItem`: `[{ itemId, itemName, unit, returnUnits,
returns, soldUnits, sales, share }]`, in master order, built from the lines of the same invoices and notes the
filter kept (`share` = returns / sales of those), so `byItem` and `byCustomer` add up to `totals` whatever the
filter. A held return is not in it until it is approved.

**The route of a return or a receipt.** An invoice carries its own `routeId`; a stale return and a receipt
carry none, so they take the route on the outlet's latest invoice dated on or before them (the same day: the
one posted before) - the route the outlet was on when they were raised - and, before any invoice, the
outlet's route now. `routeId` on a returns row is that of its own note; on a `byCustomer` row, of the outlet's
latest document in the range. `summary`, `by('route')`, `returns`, `register` and `collections` all use this
rule, so they agree with each other, and moving an outlet to another route (2.10) leaves every figure dated
before the move where it was.

`register` gives `{ from, to, rows, totals: { units, taxable, cgst, sgst, gst, total } }`: one row per invoice
(not opening), per stale return (negative) and per day-end, a cancellation as the opposite row on its own
date. `totals.taxable` equals P&L sales net of returns for the range. Row: `{ seq, date, docId, refId, type
('INV', 'CN', 'DAYEND'), typeLabel, partyId, party (the customer, or the store), channel, channelLabel,
unitId, routeId, units, taxable, cgst, sgst, gst, total, reversal, note, canOpen }` (`canOpen` as on a ledger
row: link `docId` only when it is `true`).

```js
var s = HB.data.sell.summary({ from: today, to: today });
ui.tile({ label: 'Sales today', value: HB.fmt.inr(s.net) });   // no delta, no spark
charts.bar(HB.data.sell.by('day', { from: HB.dates.monthStart(today), to: today }).rows, { x: 'label', y: 'net' });
HB.data.sell.sheets(state.date).filter(function (x) { return x.toPost; });
```

### 4.7 `HB.data.stores`

| Call | Returns |
|---|---|
| `stores.transfers(f)` | array of transfers. `f`: `{ from, to, status, storeId }`. Stores, the Owner and accounts see every store's; the store manager its own |
| `stores.dayEnds(f)` | array of day-ends. `f`: `{ from, to, status, storeId }`. The store manager's own store; the Owner and accounts every store |
| `stores.pending(date)` | array, one row per active store the persona deals with, for `date` (default the business date) |

- transfer row: `toStoreId, storeName, lineCount, units, receivedAt, receivedBy, receivedByName`
- day-end row: `storeId, storeName, units, gross, taxable, gst, cost, cash, upi, shortExcess, expiredUnits, woId,
  woStatus`
- `pending` row: `{ storeId, storeName, date, toSend, sendUnits, sendLines, transfersSent, dayEndMissing,
  dayEndId }`. `toSend`: the store's prefilled transfer (`HB.engine.transferSheet`) proposes a quantity;
  `sendUnits` and `sendLines`: how many units and items it proposes. `transfersSent`: transfer rows SENT and
  not confirmed. `dayEndMissing`: no uncancelled day-end of that store and date. `dayEndMissing` and
  `dayEndId` are `null` for a persona that does not see the store's day-ends (stores, which only sends to it)

```js
HB.data.stores.pending().forEach(function (p) {
  if (p.dayEndMissing) banner('Day-end of ' + p.storeName + ' is still to enter');
});
```

### 4.8 `HB.data.ar`

Receivables. Seen by the Owner, accounts and sales.

| Call | Returns |
|---|---|
| `ar.balances()` | `{ rows, totals }`: every customer with an open invoice, unapplied credit or a balance, in master order |
| `ar.ageing()` | `{ asOf, buckets, rows, totals }`: the same rows and totals; `buckets` = `[{ key, label }]` for the columns |
| `ar.statement(customerId, f)` | one customer's statement. `f`: `{ from, to }` |
| `ar.openInvoices(customerId)` | array: the open invoices of the customer, oldest first (the order a receipt allocates in). No argument: of every customer |

Row of `balances` and `ageing`: `{ customerId, customerName, channel, channelLabel, routeId, routeName, terms,
creditLimit, notDue, d1_15, d16_30, d31_60, d60p, open, overdue, items, overdueItems, oldestDue, credit,
balance, overLimit }`. The five buckets hold open invoice amounts by days past the due date on the business
date (`notDue`: due today or later) and add up to `open`. `overdue`: what is past due. `items`,
`overdueItems`: counts of invoices. `credit`: unapplied credit, a positive number that a table shows as a
separate negative column; it is never netted into a bucket. `balance = open - credit`. `overLimit`: a credit
limit above zero and a balance above it. `totals`: the same sums, with `customers` (a count).

`statement` returns `{ customerId, customerName, from, to, opening, rows, debit, credit, invoiced, settled,
closing, openNow, creditNow, balanceNow }`. Row: `{ seq, date, docId, refId, type, kind, kindLabel, debit,
credit, invoiced, settled, amount (signed), balance (running), reversal, note }`, by date then posting
order. `kind`: `invoice`, `collected` (cash taken with a cash invoice), `receipt`, `credit_note`.
`opening`: the balance before `from`; `openNow`: open-invoice rows as they stand now.

`debit` and `credit` split the rows by sign. `invoiced` and `settled` split them by kind: `invoiced` is the
amount of an `invoice` row, `settled` the amount of any other row with its sign turned (cash collected,
a receipt, a stale return), so a cancellation, which writes the opposite of its document under the same
kind, is a negative figure in the column of what it cancels. An invoice posted and cancelled in the range
is then in neither total, where it is in both `debit` and `credit`. `opening + invoiced - settled =
closing`, as `opening + debit - credit` does. The statement screens show `invoiced` and `settled`: the
two columns, their footer, the tiles and the printed totals.

Open-invoice row: `{ id, date, dueDate, customerId, customerName, total, open, overdue, daysOverdue, opening,
doc }`.

```js
var a = HB.data.ar.ageing();
ui.table({ columns: [{ key: 'customerName', label: 'Customer' }].concat(a.buckets.map(function (b) { return { key: b.key, label: b.label, format: 'inr2' }; })), rows: a.rows, footer: a.totals });
allocGrid.rows = HB.data.ar.openInvoices(draft.customerId);    // the receipt form
```

### 4.9 `HB.data.ap`

Payables. Seen by the Owner and accounts only.

| Call | Returns |
|---|---|
| `ap.balances()` | `{ rows, totals }`: every vendor with something open, the "Staff salaries" vendor among them. Claims are not here |
| `ap.ageing()` | `{ asOf, buckets, rows, totals }`: the same rows, with the bucket list |
| `ap.openItems(payeeType, payeeId)` | array: the open bills and expenses of one payee (`'vendor'` or `'employee'`): what a payment can be allocated to |
| `ap.dueWithin(days)` | array: open vendor bills, expense bills and salary bills due on or before the business date + `days`, overdue ones included, soonest first. `days` defaults to `limits.dueSoonDays` |
| `ap.toReimburse()` | array: approved claims not yet paid in full |

Row of `balances` and `ageing`: `{ payeeType: 'vendor', payeeId, vendorId, name, kind, termsDays, notDue,
d1_15, d16_30, d31_60, d60p, open, overdue, items, overdueItems, oldestDue, dueSoon, balance }`. `dueSoon`: due
from the business date to `limits.dueSoonDays` after it. `totals`: the same sums, with `vendors`.

Row of `openItems`, `dueWithin` and `toReimburse`: `{ id, type ('VBILL' or 'EXP'), typeLabel, kind
('vendor_bill', 'bill', 'salary', 'claim'), date, dueDate, payeeType, payeeId, name, ref (bill number or bill
reference), total, paid, open, overdue, daysOverdue, daysToDue (negative once overdue), doc }`;
`toReimburse` adds `employeeId, employeeName, categoryId, categoryName, unitId, unitName`.

```js
payForm.allocations = HB.data.ap.openItems('vendor', draft.payeeId).map(function (x) { return { docId: x.id, amount: x.open }; });
```

### 4.10 `HB.data.cash`

Cut to the accounts in scope: every account for the Owner and accounts, the store's cash for the store
manager, nothing for the other roles.

| Call | Returns |
|---|---|
| `cash.balances()` | `{ rows: [{ accountId, name, kind, unitId, balance }], total, cashTotal, bankTotal }`, as they stand now |
| `cash.book(accountId, f)` | the book of one account. `f`: `{ from, to }` |

`book` returns `{ accountId, name, from, to, opening, rows, totalIn, totalOut, closing }`. Row: `{ seq, date,
docId, refId, type, kind, kindLabel, party, in, out, amount (signed), balance (running), reversal, note }`, by
date then posting order. `kind`: the engine's (2.4); `kindLabel`: "Opening balance", "Cash collected on
delivery", "Receipt", "Payment", "Store sales, cash", "Store sales, UPI", "Cash deposit". `party`: the
customer, the payee, the store, or for a deposit "To Bank account" / "From Factory cash". A cancellation may
leave a balance below zero (SPEC 5.3); the book shows it. An account outside the scope gives no rows and zeros.

```js
var b = HB.data.cash.book(state.accountId, { from: f.from, to: f.to });
// "Opening balance" b.opening, then b.rows with in / out / balance, then "Closing balance" b.closing
```

### 4.11 `HB.data.pnl`

Seen by the Owner and accounts only.

| Call | Returns |
|---|---|
| `pnl.month(monthKey)` | the P&L of one month (`'YYYY-MM'`) |
| `pnl.months()` | array: every month from go-live to the month of the business date, oldest first |
| `pnl.entries(f)` | array: the rows behind one P&L cell. `f`: `{ monthKey, line, channel, categoryId, unitId }` |

`month` returns:

```
{ monthKey, label ('Mar 2026'),
  sales:    { retail, corporate, store, total },      taxable before returns
  returns:  { retail, corporate, store, total },      negative for a note on its date, positive for its cancellation on the cancellation date
  netSales: { retail, corporate, store, total },      sales + returns
  cogs:     { retail, corporate, store, total },
  prodLoss, writeoff, countDiff,                      positive when a cost
  materialCost,                                       cogs.total + prodLoss + writeoff + countDiff
  grossMargin, grossMarginPct,                        netSales.total - materialCost; over net sales
  expenses: [{ categoryId, categoryName, amount, byUnit: { unitId: amount } }],   salaries among them; a category whose rows net to zero in the month is left out
  expenseTotal,
  operatingProfit, operatingPct,                      grossMargin - expenseTotal
  lines: [{ key, label, amount, strong, drill }] }
```

`lines` is the statement top to bottom: `netSales.retail`, `netSales.corporate`, `netSales.store`, `netSales`,
`returns` ("of which stale returns"), `cogs`, `prodLoss`, `writeoff`, `countDiff`, `materialCost`,
`grossMargin`, one `expense.<categoryId>` per category, `expenseTotal`, `operatingProfit`. `strong`: a
subtotal. `drill`: the filter to hand to `pnl.entries` for that line (`null` where a line is only
arithmetic); the amounts of the entries add up to the line.

`months` row: `{ monthKey, label, sales, returns, netSales, retail, corporate, store (net sales by channel),
cogs, prodLoss, writeoff, countDiff, materialCost, grossMargin, grossMarginPct, expenses, operatingProfit }`.

`entries`: `f.line` is a ledger line (`sales returns cogs prodLoss writeoff countDiff expense`), `'netSales'`
(sales and returns), `'materialCost'` (the four cost lines) or a list. Row: `{ seq, docId, refId, type,
typeLabel, date, amount, qty, line, lineLabel, channel, categoryId, unitId, itemId, party, reversal, note }`.

```js
var p = HB.data.pnl.month(state.monthKey);
p.lines.forEach(function (l) { table.row(l.label, HB.fmt.inr2(l.amount), l.drill && function () { open(HB.data.pnl.entries(l.drill)); }); });
charts.bar(HB.data.pnl.months(), { x: 'label', y: 'netSales' });   // month-wise totals since go-live
```

### 4.12 `HB.data.margin`

Seen by the Owner and accounts only.

| Call | Returns |
|---|---|
| `margin.byItem(f)` | `{ from, to, rows, totals }`. `f`: `{ from, to, unitIds, unitId, channel }`. Row: `{ itemId, itemName, unit, units, sales, returns, returnUnits, net, cogs, margin, marginPct, share, avgPrice, avgCost, unitCost }` - `avgPrice` = sales / units and `avgCost` = cogs / units (paise per unit, `null` with no units), `unitCost` = today's recipe cost. The rows of `sell.by('item', f)`: a product whose figures come to nothing in the range is not listed |
| `margin.byChannel(f)` | `{ from, to, rows, totals }`. `f`: `{ from, to, unitIds, unitId }`. Row: `{ channel, label, units, sales, returns, net, cogs, margin, marginPct, share }` |

`totals`: `{ units, sales, returns, returnUnits, cogs, net, margin, marginPct }`. Margin by item **and**
channel: `margin.byItem({ from, to, channel: 'retail' })`.

```js
var m = HB.data.margin.byItem({ from: f.from, to: f.to, channel: state.channel });
```

### 4.13 `HB.data.gst`

Seen by the Owner and accounts only.

`gst.summary(f)`, `f`: `{ from, to }`, returns

```
{ from, to,
  output: [{ gstRate, label, taxable, cgst, sgst, tax }],     by rate, lowest first; label 'Nil-rated' or '5%'
  outputTotals: { taxable, nilRated, cgst, sgst, tax },
  input:  [...], inputTotals: {...},
  net: { cgst, sgst, tax } }                                   output less input
```

Rate 0 is Nil-rated and stands outside the taxable turnover: `totals.taxable` adds the rated lines only and
`totals.nilRated` holds the rest. Output: invoices and day-ends (positive), stale returns (negative). Input:
vendor bills and expenses that carry GST (2.4).

```js
var g = HB.data.gst.summary({ from: f.from, to: f.to });
g.output.forEach(function (x) { table.row(x.label, HB.fmt.inr2(x.taxable), HB.fmt.inr2(x.cgst), HB.fmt.inr2(x.sgst)); });
```

### 4.14 `HB.data.exp`

Every role has the expenses page; what it lists follows `HB.session.expenseView()`:

| View | Roles | `exp.list` | `exp.byCategory`, `exp.byUnit` |
|---|---|---|---|
| `all` | owner, accounts | every claim, expense bill and salary bill | every expense row |
| `unit` | store_mgr | the claims and expense bills of its store, and the claims it entered itself in this copy for any location (a seeded claim of another store, which the seed raises under the same persona, is not listed); never the salary bill | the spend of its store, without salaries |
| `own` | stores, production, sales | the claims the persona raised | the persona's own approved claims |

| Call | Returns |
|---|---|
| `exp.list(f)` | array of expenses. `f`: `{ from, to, status, kind, categoryId, unitId, payeeId, mine: true }` |
| `exp.byCategory(f)` | `{ from, to, rows, totals: { amount }, units }`. `f`: `{ from, to, unitIds, unitId, categoryId }` |
| `exp.byUnit(f)` | `{ from, to, rows, totals: { amount }, categories }`. Same `f` |

- list row: `kind ('claim', 'bill', 'salary'), kindLabel, payeeType, payeeId, payeeName, categoryId,
  categoryName, unitId (null on a salary bill), unitName ('All locations' on a salary bill), billRef, monthKey,
  amount (before GST), gstRate, gst, total, paid, open (APPROVED: total - paid; else 0), dueDate, waiting
  (PENDING), mine (raised by the persona), rejectReason`
- `byCategory` row: `{ categoryId, categoryName, amount, byUnit: { unitId: amount } }`; `units`:
  `[{ unitId, unitName, amount }]` - the columns of a category x location table and their totals
- `byUnit` row: `{ unitId, unitName, amount, byCategory: { categoryId: amount } }`; `categories`:
  `[{ categoryId, categoryName, amount }]`

Spend is the expense rows of the P&L by their own date, before GST: an expense counts once it is approved,
on its own date; a salary bill one row per location; "Store cash short / excess" from the day-ends.

```js
var x = HB.data.exp.byCategory({ from: HB.dates.monthStart(today), to: today });   // "spend this month"
x.rows.forEach(function (r) { x.units.forEach(function (u) { cell(r.categoryName, u.unitName, r.byUnit[u.unitId] || 0); }); });
```

### 4.15 `HB.data.people`

Seen by the Owner and accounts only (the page is theirs); both may see salaries.

| Call | Returns |
|---|---|
| `people.list()` | array: the directory - the record of `lookup.employee` plus `onRolls` (joined on or before the business date and not left before it) |
| `people.headcount()` | `{ asOf, headcount, salary, byDept: [{ dept, headcount, salary }], byUnit: [{ unitId, unitName, headcount, salary }] }`: who is on the rolls on the business date and the monthly salary cost |

`salary` is absent everywhere for a role that may not see salaries; such a role gets `[]` and a headcount of
zero.

```js
var hc = HB.data.people.headcount();
ui.tile({ label: 'Employees', value: HB.fmt.num(hc.headcount) });
```

### 4.16 `HB.data.approvals`

`approvals.pending()` returns `{ count, items, groups }`: everything PENDING or HELD. `items`: oldest first.
`groups`: `[{ type, label, count, items }]` in the order PO, VBILL, CN, WO, ADJ, EXP. The Owner and accounts
get the list; any other role an empty one (it sees its own waiting documents in its lists: an order in
`buy.orders`, a return in `sell.creditNotes`, a count in `stock.counts`, a write-off in `stock.writeOffs`, a
claim in `exp.list`, each with `waiting` and, once refused, `rejectReason` where the row has them).

Item: the common document fields, then `{ raisedBy, raisedByName, raisedAt, party, amount, reason, warning,
evidence, canApprove, canReject }`. `party`: the vendor, customer, location or payee. `amount`: the total (the
value of a count or write-off). `reason`: one sentence saying why it waits. `warning`: what the engine warned
about when the document was entered (3.3), in its own words, or `''`: a count far from the books, a claim
above what claims normally are. The approver decides knowing it. `canApprove`, `canReject`:
`{ ok, code, reason }` - the rights of the persona (own document before role, 1.9) and, for an approval the
rights allow, what the engine would answer now (`stock_short` when a count or a write-off no longer has its
stock). Show both buttons; disable with `reason`.

`evidence` by type:

| Type | Fields |
|---|---|
| `PO` | `vendorId, vendorName, expectedDate, total, limit (limits.poAutoApprove), over (total - limit), lines: [{ itemId, itemName, unit, qty, rate, gstRate, amount, received, latestRate }]` - `latestRate`: the latest purchase price now |
| `VBILL` | `vendorId, vendorName, billNo, taxable, gst, total, dueDate, tolerancePct, diffs: [{ itemId, itemName, unit, orderedRate, acceptedQty, billedQty, billedRate, expected, billed, diff, diffPct (fraction), ok }], receipts: [{ id, date, poId }], orderIds` - the three-way differences |
| `CN` | `customerId, customerName, routeName, taxable, gst, total, sharePct (as stored when raised), limitPct, from, to (the seven days), supply, otherReturns, thisReturn (taxable, as the week stands now), lines: [{ itemId, itemName, unit, qty, price, gstRate, taxable, cgst, sgst }]` |
| `ADJ` | `locId, locName, reason, value, lines: [{ itemId, itemName, unit, batchId, systemQty, countedQty, diff, rate, value, onHandNow }]` |
| `WO` | `locId, locName, reason, sourceDocId, value, lines: [{ itemId, itemName, unit, batchId, bestBefore, qty, rate, value }]` |
| `EXP` | `kind, kindLabel, payeeType, payeeId, payeeName, categoryId, categoryName, unitId, unitName, amount, gstRate, gst, total, billRef, monthKey, dueDate, lines: [{ unitId, unitName, headcount, amount }]` (lines on a salary bill) |

```js
HB.data.approvals.pending().groups.forEach(function (g) {
  g.items.forEach(function (it) {
    card(it.typeLabel + ' ' + it.id, it.party, HB.fmt.inr2(it.amount), it.reason, panelFor(it.type, it.evidence),
      ui.button('Approve', { disabled: !it.canApprove.ok, title: it.canApprove.reason, onClick: function () { HB.engine.act('approve', { id: it.id }); } }));
  });
});
```

### 4.17 `HB.data.audit`

Seen by the Owner and accounts only.

`audit.list(f)` returns `{ from, to, rows, count, truncated }`, newest first. `f`: `{ from, to, userId, role,
action, type, docId, masters: true, limit }` (`type`: a document type, or an entity name for a master change;
`masters: true`: master changes only; with `userId`, a row made in another employee's name (`userAs`) is left
out). At most `limit` rows (default 5000, `0` for all); `count` is of every row that matched.

Row: `{ seq, at ('YYYY-MM-DDTHH:MM'), date, time, userId, userName, role, roleLabel, action, actionLabel, docId
(the document, or the master record), type, typeLabel, isMaster, recordName, note, before, after, text }`. For a document
`before` and `after` are statuses; for a master change the record before and after. `text`: one line -
"Vendor bill VBILL-U-0001: approved, posted", "Item Sandwich bread: changed". For a master change `actionLabel` is
what was done ("Added", "Changed", "Deactivated", "Activated") and `recordName` the name of the record. `note` is a
sentence: the engine's short notes of 2.4 are worded here ("Within the limit, approved as submitted", "Approved by the
Owner, who also raised it", "Opening balance", "Cancelled with INV-..."); `doc.timeline` rows carry the same.
The entry of a document posted with a warning ends in "Entered with a warning: ..." as the engine wrote it
(2.4), after the worded note when there is one: "Within the limit, approved as submitted. Entered with a
warning: Maida: ...".

```js
var a = HB.data.audit.list({ from: f.from, to: f.to, userId: state.userId });
```

### 4.18 `HB.data.notify`

The notification log of SCOPE 4.9: the emails Neo ERP would send, **derived from the book as it stands**.
Nothing is stored and nothing is sent; when what an entry is about is settled, the entry is gone. Seen by the
Owner and accounts only.

`notify.list()` returns an array, newest first:

```
{ id, kind, kindLabel, date, subject, text, docId, ref,
  toRole, toRoleLabel, toName, to, placeholder }
```

| kind | One entry per | Dated | To | `docId`, `ref` |
|---|---|---|---|---|
| `approval` | document that waits | the day it was raised | owner | the document; `{ type }` |
| `overdue` | customer with invoices past due | the day after the oldest due date | accounts | the oldest overdue invoice; `{ customerId, docIds }` |
| `due` | open vendor or expense bill due within `limits.dueSoonDays`, or overdue | the day it came within that many days of its due date (not before its own date); overdue: the day after | accounts | the bill; `{ type, payeeType, payeeId }` |
| `low_stock` | material at or below its reorder level | the business date | stores | `null`; `{ itemId }` |
| `expiry` | batch on hand near expiry or expired, per location (not in transit) | near: the business date; expired: the day after best-before | stores for the factory, the store manager for a store | the production entry of the batch; `{ itemId, batchId, locId }` |

`to` is the address of the persona of that role, built from its name, at the company's domain:
`HB.config.company.emailDomain` (or `domain`, or the domain of `email` or `website`). The company master
names none today, so the address is at the reserved `example.com` and `placeholder` is `true`; add
`emailDomain: '<invented domain>'` to the company record to change that. A store without a persona gets
`store.<name>@<domain>`. The page carries no note that nothing is sent: the handout says so (SCOPE
decision 19).

```js
HB.data.notify.list().forEach(function (n) { row(HB.dates.label(n.date), n.kindLabel, n.toRoleLabel, n.to, n.subject, n.docId); });
```

### 4.19 `HB.data.dash`

| Call | Returns |
|---|---|
| `dash.today()` | the dashboard blocks for the business date |
| `dash.period(f)` | the same blocks for the range `f = { from, to }` |
| `dash.monthToDate()` | `dash.period` of the month to date: the first day of the business date's month to the business date |
| `dash.work()` | today's work |

`today()`, `period(f)` and `monthToDate()` return `{ period: 'today' | 'month' | 'range', from, to, role, blocks,
...one field per block, days, grain, points, ...what stands beside the blocks }`. `blocks` lists the ids of the
blocks the persona gets, in order; a block that is not listed is `undefined`. `days`, `grain`, `points` and the
four members beside the blocks (`salesFacts`, `margin`, `returns`, `spendFacts`) are what the cockpit at the top of
the dashboard draws; they are described under "Beside the blocks" below. `home.js` draws what it receives and
nothing else.

`period(f)` takes its range as every selector does (4.1): `from` and `to`, both days included, go-live and the
business date where one is missing, cut to that span; `from` and `to` of the result are the range as cut. It
reads no other field of `f`, so a page passes `ctx.filters` as it is, and it remembers one result per range. The
roles and the scope are those of `today()`: the same blocks to the same roles, cut the same way. `period` of
the result is `'month'` when the range is the month to date and `'range'` for any other, which is how `home.js`
knows whether to write "month to date" or the range in words. `monthToDate()` returns the very result of
`period` for the month to date (the same object), so the two cannot differ.

| Block | Holds | Given to (besides the Owner and accounts, who get all) |
|---|---|---|
| `sales` | `{ gross, returns, net, units, byChannel: [{ channel, label, gross, returns, net, units }] }` - of the period | sales (retail, corporate), store_mgr (its store) |
| `collections` | `{ total, cash, bank }` - of the period | sales |
| `cash` | `cash.balances()` - now | store_mgr (its store's cash) |
| `spend` | `{ total, byUnit: [{ unitId, unitName, amount }] }` - of the period, by location | store_mgr (its store, without salaries) |
| `production` | `{ runs, expectedUnits, goodUnits, rejectedUnits, yield, lossValue, byItem }` - of the period; `byItem` as `make.yieldByItem().rows` | production |
| `receivables` | `{ open, credit, balance, overdue, overdueRows: [{ customerId, customerName, overdue, open, oldestDue, invoices }], buckets }` - now, largest overdue first | sales |
| `payables` | `{ open, overdue, dueSoon, dueRows (ap.dueWithin()), toReimburse (paise), claims (count), buckets }` - now | - |
| `approvals` | `{ count, byType: [{ type, label, count }] }` - now | - |
| `lowStock` | `{ count, rows }` - `stock.lowStock()`, now | stores, production |
| `nearExpiry` | `{ count, expiredUnits, nearUnits, rows }` - `stock.expiring()`, now, cut to the scope | every role |

Flows are of the period asked for; balances are as they stand now, at the business date, and are the same in
every call whatever the range. A call holds one period: no block holds a figure of another period, and nothing
sets two periods side by side.

`buckets`, in `receivables` and in `payables`: `[{ key, label, amount, share }]`, the five ageing buckets of
4.25 in order (`notDue`, `d1_15`, `d16_30`, `d31_60`, `d60p`, labelled as on the ageing screens). `amount` is
the open amounts whose due date falls in the bucket, from `ar.ageing().totals` and `ap.ageing().totals` (vendors;
claims are not aged); `share` its share of `open`, `null` when nothing is open. The amounts add up to `open`, and
all but the first to `overdue`.

**Beside the blocks.** What the cockpit at the top of the dashboard draws, in every result:

| Field | Holds | Given |
|---|---|---|
| `days` | the number of days of the range, both ends included | always |
| `grain` | `'day'` for a range of up to 62 days, `'month'` for a longer one | always |
| `points` | the days of the range, or its months, oldest first: `[{ key, label, from, to, whole, ...figures }]` | always |
| `salesFacts` | `{ openDays, average, best, slowest, channel, route }` | with the `sales` block |
| `margin` | `{ netSales, cogs, prodLoss, writeoff, countDiff, materialCost, grossMargin, grossMarginPct, materialPct }` | with the `sales` block, to a role that has the P&L (`acc-pnl`): the Owner and accounts |
| `returns` | `{ supplied, returned, share, limitPct, over }` | with the `sales` block, to a role with the factory in its scope: not the store manager |
| `spendFacts` | `{ byLocation, byCategory, largest }` | with the `spend` block |

A member that is not given is `undefined`. All of them are of the range asked for and lie inside it: a line of
the range itself, never one period beside another.

A point: `key` is the date, or `'YYYY-MM'` for a month; `label` is `'5 Oct'` or `'Oct 2026'`; `from` and `to` are
the days it covers (a month holds only its days inside the range). `whole` is `true` for a finished day (one
before the business date) and for a month that the range holds in full and that is over; `false` for the business
date, which is still being entered, and for a month held in part or still running. A point that is not whole
has fewer entries than its neighbours for no reason of the business: a line of what moved leaves it out, while
the line of a balance, which does not grow with the days, keeps it. Its figures are in the point all the same,
and in the totals.

The figures of a point. A point carries only the figures of the blocks the persona gets. A figure is `null`
where the point has no row of its kind (the factory was closed, or it is the business date and nothing is posted
yet), so that a line has a gap there and not a fall to nothing:

| Figure | With | Holds |
|---|---|---|
| `netSales` | `sales` | the sales and returns rows of the point, in the persona's units. They add up to `sales.net` |
| `collected` | `collections` | the cash rows of kind `collected` and `receipt`. They add up to `collections.total` |
| `materialCost` | `margin` | the rows of the four cost lines: `cogs`, `prodLoss`, `writeoff`, `countDiff`. They add up to `margin.materialCost` |
| `marginPct` | `margin` | `(netSales - materialCost) / netSales`, a fraction; `null` with no sales row, or with net sales of nothing |
| `goodUnits` | `production` | the good units of the production entries dated in the point; a cancellation takes them back on its own date. They add up to `production.goodUnits` |
| `supplied` | `returns` | the sales rows of the retail and corporate channels: what went out on invoice. They add up to `returns.supplied` |
| `returned` | `returns` | the returns rows, as a positive figure. They add up to `returns.returned` |
| `returnShare` | `returns` | `returned / supplied`, a fraction (`returned` counting as nothing where it is `null`); `null` where nothing was supplied |
| `cashBalance` | `cash` | the balance of the accounts in scope at the end of the point's last day: every cash row dated up to it. Never `null`. In a range that ends on the business date the last one is `cash.total` |

`salesFacts`. An **open day** is a day whose sales rows, before returns, add up to more than nothing: a day the
factory was closed, the business date before anything is posted, and a day that only took a sale back are not
open. `openDays` counts them. `average` is `sales.net / openDays`, to the paisa, `null` with no open day. `best`
and `slowest` are `{ date, net }`: the open day with the highest and with the lowest net sales, the earlier of
two that tie, `null` with no open day; they are days whatever the grain. `channel` is `{ channel, label, net,
share }`, the channel of `sales.byChannel` with the highest net sales above nothing; `route` is `{ routeId,
label, net, share }`, the route with the highest net sales above nothing among the rows of `sell.by('route', f)`
that have a route (4.6); of two that tie, the first in master order. `share` is of `sales.net`. Either is `null`
when there is none: a store manager has no route.

`margin` is the P&L of 4.11 summed over the range: `materialCost = cogs + prodLoss + writeoff + countDiff`,
`grossMargin = netSales - materialCost`, `grossMarginPct` and `materialPct` their shares of `netSales` (`null`
with net sales of nothing). `netSales` is `sales.net`. For a whole month the figures are those of `pnl.month()`.

`returns`: `supplied` and `returned` as in the points, `share = returned / supplied` (`null` when nothing was
supplied). `limitPct` is `HB.masters.limits.returnsPct`, a percentage as the engine stores it. `over` is `true`
when something was supplied and `returned * 100 > limitPct * supplied`: exactly at the limit is within it, as
for a stale return (SPEC 5.2).

`spendFacts`, of the same expense rows as `spend` and cut to the same view (4.14): `byLocation` is `[{ unitId,
unitName, amount, share }]`, every unit in scope in master order, spent at or not (a deactivated one only while it
has spend in the range); `byCategory` is `[{ categoryId, categoryName, amount, share }]`, the categories whose
amount is not nothing, the largest first (two of the same amount in master order); `largest` is the first of
them when its amount is above nothing, else `null`. `share` is of `spend.total`, `null` when that is nothing.

`today()` holds the same members for the business date alone: one point, which is never whole.

`work()` returns `{ date, count, groups }`; `groups`: `[{ kind, label, route, count, items }]`, only the groups
with something in them, in this order:

| kind | From | An item needs |
|---|---|---|
| `sheet` | `sell.sheets(today)` with `toPost` | `dispatch.post` |
| `transfer_send` | `stores.pending(today)` with `toSend` | `xfer.create` |
| `transfer_confirm` | its `transfersSent` | `xfer.receive` for that store |
| `receipt` | `buy.dueForReceipt(today)` | `grn.create` |
| `production` | `make.todo(today)` | `prod.create` |
| `dayend` | `stores.pending(today)` with `dayEndMissing` | `dayend.create` for that store |
| `approval` | `approvals.pending()` | `approve.<type>` |

Item: `{ id, title, text, docId (or null), can: { ok, code, reason }, ref }`. `route` is the hash of the page
that does the work (`'#/sell/dispatch'`, ...). The Owner and accounts get every item, with `can` saying
whether they may act; any other role only the items it may act on. Nothing else enters the list: no demand,
no forecast.

```js
var d = HB.data.dash.today(), r = HB.data.dash.period(ctx.filters);   // the business date, and the range of the filter bar
d.blocks.forEach(function (id) { page.appendChild(BLOCKS[id](d[id], r[id])); });   // r.period === 'month' while the range is the month to date
if (r.sales) HB.charts.sparkline(el, r.points.map(function (p) { return p.whole ? p.netSales : null; }),   // the line of the hero
  { fluid: true, format: 'inr', labels: r.points.map(function (p) { return p.label; }) });
HB.data.dash.work().groups.forEach(function (g) { section(g.label, g.items, g.route); });
```

### 4.20 `HB.data.doc`

| Call | Returns |
|---|---|
| `doc.get(id)` | the document as the book holds it (2.7; read-only), or `null` when there is none or the persona may not see it. The router's `#/doc/<id>` resolver reads `type` and `targetId` from it. For the id of a dispatch sheet (`'DS-...'`) it gives `sell.sheet(id)` (4.6): `type: 'DS'`, which the router maps to the dispatch page |
| `doc.view(id)` | the document ready for a document view, or `null` |
| `doc.timeline(id)` | array: who did what and when, oldest first, from the audit trail. `[]` for a document the persona may not see |
| `doc.related(id)` | array: the documents that hang together with it, among those the persona may see |

`view`: the common document fields (4.1), then

```
party:  { kind, id, name } or null      kind: vendor, employee, customer, unit, account, location, item
amount: the one money figure of the document (total, amount, gross, value) or null
lines:  the lines (the consumption of a production entry), each with itemName and unit added;
        salary lines with unitName, opening cash lines with accountName. The lines of an INV carry
        unitCost and cost for the Owner and accounts only: for sales the two fields are absent
approval:     { state, by, byName, at, reason, self }
cancellation: { by, byName, at, reason, docId } or null
target: the cancelled document, on a CXL
warned: the codes of the warnings the document was entered with (3.3), [] for none
warning: what those warnings said, as the audit entry of the posting holds it (several joined by '; '), '' for none
costing: on an INV only. { cost, margin, marginPct, lines: [{ itemId, itemName, unit, qty, unitCost, cost, margin, marginPct }] }
         for the roles that see margins (the Owner and accounts; not on an opening invoice), else null. As posted:
         margin = taxable - cost of the stored lines, marginPct a fraction of taxable. A page shows cost and
         margin of an invoice from this, and shows neither when it is null
actions: [{ op, label, ok, code, reason, docId }]
```

`actions` are the operations that make sense in the document's state, each with whether the persona may do
it: `approve` and `reject` (PENDING or HELD), `receiveTransfer` (a transfer SENT), `cancel` (anything not
cancelled, rejected or an opening entry), and on the view of a posted dispatch sheet `cancelDispatch` (below). `ok: false` comes with the sentence for the disabled control - from
the rights, or from the engine (`HB.engine.check`): a cancellation with dependants carries `code:
'has_dependants'` and `docId`, the document to cancel first. Call `HB.engine.act(op, { id })` (with `reason`
for `reject` and `cancel`).

`timeline` row: the audit row of 4.17 plus `label` and `statusLabel` (the status it led to). The first
`label` is "Entered" for a document that records what happened (goods receipt, production entry, receipt,
payment, cash deposit, day-end, transfer) and "Raised" for the others (order, bill, sales order, invoice,
stale return, count, write-off, expense, opening entry); then "Approved", "Rejected", "Cancelled",
"Received by the store".

**A dispatch sheet** is not a document, but its id opens like one. `view('DS-...')` gives the common fields
(`type: 'DS'`, `typeLabel: 'Dispatch sheet'`, `date`, `status: 'POSTED'` once an uncancelled invoice carries
the id, else `''` with `statusLabel: 'Not posted'`; `createdBy`, `createdAt`: of its first uncancelled
invoice; `doc`: the `sell.sheet` record), `party: { kind: 'route', id, name }`, `amount` (the total of its
uncancelled invoices), `lines: [{ itemId, itemName, unit, qty, taxable }]` (the quantities by product of
those invoices), `approval.state: 'none'`, `cancellation: null`, no `warned`. `actions` is `[]` for a sheet
that is not posted and, for a posted one, its one action: `[{ op: 'cancelDispatch', label: 'Cancel the
sheet', ok, code, reason, docId }]` - `ok: false` with `code: 'role'` for a persona other than sales and the
Owner, or with what `HB.engine.check('cancelDispatch', { sheetId })` answers: `has_dependants`, the sentence
that names the invoice, and `docId` the receipt or credit note to cancel first. Call
`HB.engine.act('cancelDispatch', { sheetId: id, reason })`. `related` gives its invoices; `timeline` is `[]`
(each invoice has its own).

`related` row: `{ relation, label, id, type, typeLabel, date, status, statusLabel, cancelled, amount }`.

| Of a | relation: label |
|---|---|
| `PO` | `receipt`: its goods receipts; `bill`: their vendor bills |
| `GRN` | `order`: its purchase order; `bill`: its vendor bill |
| `VBILL` | `receipt`, `order`; `settlement`: the payments allocated to it (`amount` = what was allocated; a cancelled one is labelled "(cancelled)") |
| `EXP` | `settlement`: its payments |
| `PAY` | `paid`: the bills and expenses it pays (`amount` allocated) |
| `SO` | `invoice`: its invoice |
| `INV` | `order`: its sales order; `settlement`: receipts and stale returns allocated to it |
| `RCPT`, `CN` | `settles`: the invoices it is allocated to |
| `DAYEND` | `writeoff`: the write-off of its expired units |
| `WO` | `source`: the day-end it came from |
| a dispatch sheet (`DS-...`) | `invoice`: every invoice that carries its id ("Invoice (cancelled)" for a cancelled one) |
| `CXL` | `target`: the document it cancels (and the write-off cancelled with a day-end); `credit`: invoices credit was taken back from |
| anything cancelled | `cancellation`: its `CXL` |

```js
var v = HB.data.doc.view(id);                     // the kit turns each part into what forms.docView takes (docs/shell/UI-API.md 4.10)
forms.docView({ title: forms.docTitle(v), status: v.status, notice: forms.docNotice(v), lines: { columns: columns, rows: v.lines },
  timeline: forms.timelineOf(id), related: forms.relatedOf(id),
  actions: forms.docActions({ view: v }) });      // v.actions, each through HB.engine.act, the disabled ones with their reason
```

### 4.21 `HB.data.guide`

`guide.journeys()` returns an array, one per journey of `HB.config.journeys`:

```
{ id, title, done, doneSteps, next (index of the first step not done, or null),
  steps: [{ index, text, route, role, roleLabel, done, n, at, userId, userName }],
  links: [{ text, route, params, href }] }
```

`params`: the route parameters of the link (`{}` when it has none), each a string; `href`: the route with them as
a query (`'#/stock/onhand?loc=fac_fg'`), what the guide links to. Stock on hand honours `loc`, Cash and bank
`account`, Recipes `item`, Receipts `tab` (`'statement'` or `'receipts'`) and `customer`, Receivables `customer`.

`n`, `at`, `userId`: the log entry that ticked the step. `role` is the persona the guide suggests, not a
condition.

**The journey record the selector expects** (the shape `js/data/config.js` holds; `tools/check.js` has small
ones for the fixture):

```js
{ id, title,
  steps: [{ text, route, role, match: { op, type, test } }],
  links: [{ text, route, params }] }  // what to look at afterwards: links, not steps; params optional
```

- `match.op`: the `op` of a log entry (3.8): `post`, `postDispatch`, `approve`, `reject`, `cancel`,
  `receiveTransfer`.
- `match.type` (optional): the type of the **first** document the entry made (`post`: the document, for a
  day-end the `DAYEND`; `postDispatch`: `INV`) or of the document it acted on.
- `match.test(entry, docs, env)` (optional) -> boolean. `docs`: the documents the entry made, in order (a
  day-end and its write-off), or `[the document acted on]`. `env`: `{ book, masters }`. It looks at what was
  entered or computed, never at the status the document ended in. A test that throws does not tick.
- A step is done when an entry of the user's log matches it **after** the entry that ticked the step before;
  a journey is done when its last step is. Entries the last boot skipped do not count.
- An `approve` step is also ticked by the entry of the step before it, when a document that entry made (of
  `match.type`, passing `match.test` as `docs[0]`) was approved in the same operation: `approval.self` and
  `approval.at` equal to the entry's time - the Owner's own document.

```js
HB.data.guide.journeys().forEach(function (j) {
  card(j.title, j.steps.map(function (s) { return ui.check(s.done, s.text, s.roleLabel, s.route); }), j.done ? j.links : []);
});
```

### 4.22 `HB.data.reports`

Every register of SCOPE 4.10 in one shape, for one generic page. Seen by the Owner and accounts (the page is
theirs); `list()` is `[]` and a run is empty for any other role.

| Call | Returns |
|---|---|
| `reports.list()` | `[{ id, title, group, filters }]`. `filters`: the controls that apply, any of `'range'`, `'unit'`, `'channel'`, `'location'`, `'item'`, `'account'` |
| `reports.run(id, f)` | `{ id, title, group, from, to, columns, rows, totals, note }`. `f`: `{ from, to, unitIds, unitId, channel, locId, itemId, accountId, vendorId, customerId, limit }` - each report takes what its `filters` name |
| `reports.cell(column, row)` | the cell as text, formatted as the column says; a zero in a column with `blank: true` (the In and Out of the stock ledger and of the cash book) is `''`, as on the screen that owns the book |
| `reports.csvColumns(result)` | columns with `value(row)` for `HB.ui.downloadCsv`: money in rupees to two decimals, a rate to four, a fraction as a percentage number, the rest as held |

`columns`: `[{ key, label, align: 'left' | 'right', format }]`, as `HB.ui.table` takes them. `format` is one of
the `HB.fmt` names the table knows - `inr`, `inrFull`, `inr2`, `rate`, `num`, `num1`, `pct`, `qty` (the unit
is `row.unit`) - or `date`, or `text`. A column with `doc: true` holds a document id or nothing: link a
non-empty cell to `#/doc/<id>`; an empty cell (`null`) is not linked. `totals`: an object keyed like a row
(hand it to the table as `footer`; a `qty` total takes its unit from `totals.unit`), or `null`. `note`: a
sentence to show above the table (rows left out by the limit, a range widened to whole months), or `''`.
`from` and `to` are `null` for a report as of the business date (`expiry`, `ar_ageing`, `ap_ageing`: the
three take no range and ignore one, and the page labels them "as of the business date"). A row may carry
`strong: true` (a subtotal).

| id | Title | Group | filters | Rows are |
|---|---|---|---|---|
| `sales_register` | Sales register | Sales | range, unit, channel | `sell.register` |
| `sales_by_item` | Sales by item | Sales | range, unit, channel | `sell.by('item')` |
| `sales_by_customer` | Sales by customer | Sales | range, unit, channel | `sell.by('customer')` |
| `sales_by_route` | Sales by route | Sales | range, unit, channel | `sell.by('route')` |
| `sales_by_channel` | Sales by channel | Sales | range, unit | `sell.by('channel')` |
| `returns` | Stale returns | Sales | range, channel | `sell.returns` rows, with `share` (a fraction) |
| `production_register` | Production register with yield | Production | range, item | `make.register` |
| `stock_statement` | Stock statement | Stock | range, location, item | `stock.statement` |
| `stock_ledger` | Stock ledger | Stock | range, location, item | `stock.ledger` (pass `limit: 0` for the export); `totals` (`qtyIn`, `qtyOut`, `unit`) only when `itemId` names one item, else `null`; `note` says how to get the running balance when the filter does not give one |
| `expiry` | Expiry | Stock | location, item | `stock.batches`, every batch on hand |
| `purchase_register` | Purchase register | Purchases | range | `buy.register` |
| `order_status` | Purchase order status | Purchases | range | one row per order line: ordered, received, still to come and its value (`toComeValue`); `totals` (`amount`, `toComeValue`) add the orders that stand - a cancelled or rejected order is listed under its status and not added |
| `ar_ageing` | Receivables ageing | Accounts | - | `ar.ageing`, with `unapplied` (credit, negative) |
| `ap_ageing` | Payables ageing | Accounts | - | `ap.ageing` |
| `cash_book` | Cash and bank book | Accounts | range, account | `cash.book` of every account in scope (or `f.accountId`), a closed store's too unless it has no row in the range and no balance, each after a "Balance brought forward" row (`docId` null) |
| `expenses` | Expenses by category and location | Accounts | range, unit | one row per category and location |
| `product_margin` | Product cost and margin | Accounts | range, unit, channel | `margin.byItem` |
| `pnl_monthly` | Monthly profit and loss | Accounts | range | one row per P&L line, one column per month of the range (`m_<monthKey>`) and `total`; `from` and `to` are the whole months the columns cover, `to` never past the business date, and `note` says so when the range asked for was widened |
| `gst_summary` | GST summary | Accounts | range | output and input by rate, their totals, and the net |
| `audit_log` | Audit log | System | range | `audit.list` (the latest 5000 unless `limit: 0`); columns date, time, who, role, what, on, document, record, before, after, note. `docId` (linked) on a document row; on a master change `record` (the record's id, not shown) and `recordName`. `beforeLabel` and `afterLabel`: the status of a document, Active or Inactive for a record switched on or off, else `''` (the values a change touched are on the audit log screen, and `note` says so) |

```js
var R = HB.data.reports, res = R.run(state.reportId, { from: f.from, to: f.to, unitIds: f.unitIds });
ui.table({ columns: res.columns, rows: pageOf(res.rows), footer: res.totals });
exportButton.onclick = function () { HB.ui.downloadCsv(res.id + '.csv', R.csvColumns(res), R.run(state.reportId, withAll(f)).rows); };
```

### 4.23 Cache and cost

- A result is remembered under the selector's name and its arguments until `HB.book.seq` moves (every
  posting, approval, cancellation and master change moves it), the book is rebuilt, the persona changes or
  the business date changes. A redraw with nothing changed costs a lookup; the same call twice returns the
  **same object**.
- Pass a filter with the same fields in the same order to hit the cache (`{ from, to }`, not sometimes
  `{ to, from }`); a miss costs a recomputation, nothing else.
- Nothing rescans history to draw a tile: balances, stock, batches, open items and month totals are read
  from the running balances and indexes of 2.4; a range walks `book.days` for its days only. The audit trail
  is indexed by document once and extended as it grows.
- Measured on two years at the size of the full company (81,000 documents, 753,000 ledger rows; the loop of
  `tools/smoke-engine.js --bench`), first call after a change: the three dashboard calls together 11 ms;
  ageing, cash, stock on hand under 1 ms each; a month of sales by day, by item or the register 2 to 5 ms;
  a statement or a ledger of a month 4 to 7 ms; a document view 10 to 15 ms. Since go-live: the sales
  summary 16 ms, every invoice (32,800 rows) 60 ms, the stock statement 33 ms. Any second call: 0.02 ms.
- The members beside the dashboard blocks (4.19) cost one more walk over the days of the range, a walk over
  the cash rows dated after it (for the balance at each point), and the sales of the range by route. Measured
  on the full company (`js/data/seed.js`), first call after a change, the three dashboard calls together: 3 ms on
  a copy dated 5 Oct 2026 (37,800 documents), 8 ms on one dated 31 Dec 2027 (98,700 documents). `dash.period` of
  the life of the copy, the dearest range: 31 ms and 75 ms. The route of a stale return is found by halving the
  outlet's invoices, whose lists are made in one walk over the invoices per state of the book.
- A page shows a range: give `from` and `to`. A list of every invoice since go-live is 30,000 rows; page it
  (`forms.docList` does).
- `HB.data.reset()` forgets every result. It is never needed after `HB.engine.act` or `boot`; a test that
  changes the book or the masters by hand calls it.
- The engine was not changed for the selectors: no read index was added.

### 4.24 Checking it

`node tools/check.js s` (part of `node tools/check.js`): the tiny company and the 35 operations of part (a),
then twelve more on the same day - things that wait, a back-dated invoice and bill, cancellations - and eight
on the next business date after a rebuild (an invoice, a payment, a stale return, a production entry and a
vendor bill cancelled a day later than they are dated).

- **s.1, s.3**: every selector against a straight pass that never touches a running balance or an index - over
  the raw documents (a document that wrote rows counts on its date and, cancelled, once more as its negative
  on the date of its cancellation) or over the raw ledger rows: sales by channel, item and customer,
  collections, the sales and purchase registers, returns, production and yield, GST by rate, spend, the P&L
  month by month and line by line with its drill-down, cash and customer and payee balances, open documents,
  unapplied credit, ageing by due date, stock, batches, the stock statement and ledger, the cash books and
  statements (what was invoiced and what was paid or credited, each against the documents and the sum of
  its column), document lists, approvals and to-do lists, headcount, and the totals of every report; and no
  product, customer, route or unit listed with nothing in it. Run for several ranges, before and after the
  cancellations.
- **s.2**: the same figures typed in from the arithmetic of part (a).
- **s.3** also: approvals with their evidence and who may approve, today's work, the notification log, the
  document view, timeline and related documents, the guide's journeys (in order, out of order, the Owner's own
  document), the cache.
- **s.4**: by role - the store manager gets one store's stock, sales, transfers, day-ends, cash and expenses;
  sales gets no payables; no selector returns a salary to the four other roles under any name; which
  selectors answer to which role and which documents each may open; the dashboard blocks and today's work of
  every role.
- **s.5**: the rules two reviews of the selectors found broken, each on the smallest case that shows it:
  `''`, `'all'` and null as no filter in the ledger, the audit log and every location filter; returns by
  item against the documents under every filter; the fields of every row of sales by customer and by route;
  the footers of the stock ledger and order status reports; the route of a return and a receipt before and
  after the outlet moves; the lists of counts and write-offs by role and for whoever raised one; `canOpen`;
  the stock selectors against the pages; doc columns that open; what stores is told of a day-end and what a
  role is told of a party it does not deal with; the monthly P&L range; the cash book of a closed store.
- **s.6**: what the screens reported: the cost on an invoice row and on the lines of its view by role
  (absent for sales, and back for the Owner asked next), a dispatch sheet by its id through `sell.sheet`,
  `doc.get`, `doc.view` and `doc.related`, ids that name nothing, and "Entered" or "Raised" on the first
  line of a history for every document type.
- **s.7**: the two additions of 3 October 2026 as the screens read them, on a new copy: `warned` and
  `warning` on a view, the sentence in the history and the audit log, `warning` on what waits for the Owner;
  the one action of a posted sheet by role, locked while a receipt rests on an invoice and free once it is
  cancelled; after `cancelDispatch` the sheet to post again on `sell.sheets` and `dash.work`, its invoices
  listed as cancelled, the sales of the day netting to nothing row by row, nothing of the day listed with
  zeros by product, outlet, route or unit, the outlets' statements invoiced and paid to nothing, and the
  whole reconciliation of s.1 once more on that book; then `sell.sheet(id).repost` on later business dates,
  by role (further back than sales may go; a locked month).
- **s.8**: the dashboard of a range, on a new copy: the 35 operations, four entries back-dated into February (a
  sale, a receipt, a production run, an expense bill) and, on the next business date, three cancellations (an
  invoice, an expense bill, a production run of that day), a production run and a receipt. `dash.period` for
  seven ranges - a whole past month, a range across two months, the day of the cancellations, one day, the
  month to date, the life of the copy, a month in which nothing moved - against a straight sum: sales by
  channel, spend by location and production by product from the documents, collections from the raw cash rows
  and once more from the documents. February and 10 March typed in. A whole month against its P&L: net sales
  by channel, expenses, production loss. The month to date is `monthToDate()`, the same object; every range
  has its shape; a balance is the same whatever the range; the range is cut to go-live and the business date;
  a result is remembered until the book moves. By role: the blocks of `today()`, one store and no salaries for
  the store manager, no payables and no spend for sales.
- **s.9**: what a dashboard result holds beside its blocks, on the copy of s.8 rebuilt from its log with a stale
  return back-dated into February. For the same seven ranges - a whole past month, the life of the copy at 70
  days and so by month, a day, the month to date - the points, the day facts, the margin, the returns and the
  spend against a straight pass: the figures of each point from the raw rows of the P&L and cash ledgers and from
  the production entries, with `null` where a point has nothing; the balance of each point as every cash row up
  to its last day, and as the closing balances of the cash books; the leading channel and route, the cost lines,
  what was supplied and returned and the spend by location and category from the documents. The points add up
  to the totals of the blocks, and the months of a long range are its days added up. February, the nineteen
  days to 10 Mar and March to date typed in; a whole month against its P&L; 62 days by day and 63 by month; which
  points are whole; the returns limit read from the masters and met exactly. The ageing buckets against the open
  amounts by due date. By role: the figures of a point and the members beside the blocks are those of the blocks
  the role gets, for a range by day, a range by month and today; the store manager her store's sales, cash and
  spend without salaries; sales no cost, margin, spend or balance; stores the days alone.

### 4.25 Choices where SPEC was silent

- **What a role sees beyond its units, locations and accounts** is taken from the pages it has (the table in
  4.1), so the rule lives once, in `HB.session.access`.
- **`doc.get` returns the document itself**, because the router reads `type` and `targetId` from it;
  `doc.view` is the enriched record for a page. A dispatch sheet has no document, so its id gives the
  record of `sell.sheet` with `type: 'DS'`.
- **The cost of an invoice is left out of what a selector builds** for a role without the margin page
  (`cost` on a row, `unitCost` and `cost` on the view's lines). The field `doc` is still the book's own
  record, which stores them, and `sell.summary` and `sell.by` still give `cogs` and `margin` to every role
  with sales figures: a page for sales shows neither.
- **Ageing buckets**: not due, 1-15, 16-30, 31-60 and over 60 days past the due date, for receivables and
  payables alike (terms run from cash to 30 days).
- **Low stock** is tested on the quantity available (on hand less what write-off requests hold) at `fac_rm`,
  for items with a reorder level above zero. `onOrder` is a fact about open orders, not a suggestion.
- **Purchase register**: vendor bills (stock purchases) by the date of their payable; expense bills are in
  the expenses registers.
- **Sales by customer and by route** keep counter sales and corporates as rows of their own, so every
  dimension adds up to the same total.
- **Collections** are not given to the store manager: a store's takings are its sales and its cash.
- **Spend for the store manager** is the expense rows of its unit without salaries; for the three roles with
  only their own claims it is those claims once approved.
- **Dashboard**: flows are of the period asked for (the business date, or a range), balances as they stand at
  the business date whatever the period; a block goes to the roles that have a page for the same thing, which
  gives exactly the list of SPEC section 7. `dash.period()` with no range is the life of the copy, as for every
  range selector; the month to date is `monthToDate()`. A range of the dashboard has no unit filter: the screen
  shows the date control alone.
- **The points of a dashboard range** (4.19) follow the rule the dashboard's bar chart already had: a day each
  up to 62 days, a month each beyond. A figure of a point is `null`, not zero, where nothing was entered, so that
  a closed day is a gap in a line. `whole` is the data layer's word on which points a line may join: the business
  date is still being entered and a month held in part has fewer days than its neighbours, and either would end
  a line in a fall the business never took. An open day is one with sales above nothing, so that neither a
  closed day nor the day of a cancellation is the "slowest day". What was "supplied", for the share of stale
  returns, is what went out on invoice to outlets and corporates: a store sells at its counter and returns
  nothing. Margin and returns are not blocks of their own: they go with the sales, to the roles named in 4.19,
  and `blocks` lists what it always did.
- **Notifications**: one per waiting document, per customer with overdue invoices, per bill falling due or
  overdue, per low item and per expiring batch and location; recipients by role; dates as in 4.18; the
  address at `company.emailDomain`, else at `example.com` with `placeholder: true`.
- **A dispatch sheet is "to post"** only for a route with an active outlet.
- **Headcount** follows the rule of the salary bill (joined on or before the day, not left before it).
- **The stock ledger and the audit log** return 5000 rows unless asked for more, and say so.
- **P&L lines** show net sales by channel with "of which stale returns" beneath; the gross and the returns by
  channel are in `sales` and `returns` of `pnl.month`.
- **The stock ledger and statement follow the pages** like every other selector: a role without the
  `stock-ledger` page (sales) gets neither, the statement also goes with `reports`, and a stock count is a
  document of the `stock-counts` page. On hand, batches, expiring, value and write-off requests go to every
  role at its locations. SPEC 7 and API 4.1 now say the same thing; a batch or a ledger row whose source
  document belongs to another page carries `canOpen: false` instead of a dead link.
- **Stock counts and write-off requests have lists** (`stock.counts`, `stock.writeOffs`, 4.3) so that the
  stock-counts and stock-batches pages have a document table and whoever raised one finds it while it waits
  or after a rejection. SPEC section 8 lists neither name; its owner should add them.
- **The route of a return or a receipt** is the route on the outlet's latest invoice on or before it (4.6),
  not the customer master as it stands: the engine stamps `routeId` on invoices only, and reading the master
  would move past returns and collections to a new route while past sales stayed on the old one.
- **The notification log is a view of what is outstanding**, not a store of what was sent (4.18): a settled
  approval request leaves it. SCOPE 4.9 calls it a "log"; whether settled requests should stay (they can be
  rebuilt from the audit trail at no stored cost) is for the owner of SCOPE to decide, and nothing changes
  here until then.
- **Three reports are as of the business date** (`expiry`, `ar_ageing`, `ap_ageing`) where SCOPE 4.10 gives
  every report a date range: an ageing or an expiry list has no range by nature; `from` and `to` are `null`
  and the page labels them so.
