# HB.config - a map for the seed author

File: `js/data/config.js`. Loaded after `js/core/kernel.js` and before `js/data/engine.js`; it also runs
under Node (`require`) and calls nothing in the kernel. Every figure in it is taken from
`docs/RESEARCH.md` ("R" below, with the section number). `node tools/check-config.js` proves that
(section 7 of this file).

```
HB.config
  company ... journeys     the masters, copied into HB.masters by the engine      section 2
  gstin, guide             two small helpers that belong to the masters           section 2
  opening                  the opening entries of 1 January 2026                  section 3
  sim                      simulation parameters, read by seed.js only            section 4
  calibration              the bands of R13 and the table of R11.6                section 5
```

Nothing under `HB.config.sim` or `HB.config.calibration` is read by the engine, a selector or a page.

## 1. Conventions

| Thing | In the config |
|---|---|
| Money | whole **paise**. RESEARCH prints rupees: Rs 30.50 is `3050`, Rs 1.05 lakh is `10500000` |
| Price, rate | paise per unit (a purchase price, a list price, diesel per litre, gas per SCM) |
| Share, factor, chance | a fraction or a plain multiplier: 4.5% is `0.045`, a 3% noise is `0.03` |
| A range | `[low, high]`, both ends in the band unless the row says otherwise |
| Date, month | `'YYYY-MM-DD'`, `'YYYY-MM'`; a period is `[from, to]` with both ends included; a yearly window is `['MM-DD', 'MM-DD']` |
| **Weekday** | **`0` = Monday ... `6` = Sunday, as `HB.dates.dow` returns it.** RESEARCH counts from Sunday; every weekday array here is written Monday first. `sim.dow` holds the seven names |
| Ids | the codes of RESEARCH as they stand: `FG01`, `RM01`, `PM01`, `O01`, `C01`, `VM01`, `VE01`, `VS01`, `E001`, `R1`; stores `st_anand` (S1), `st_vvn` (S2), `st_nadiad` (S3). An item's `id` and `code` are the same |
| Product group | `BR` bread and pav, `BN` buns and pizza base, `DRY` toast, khari, biscuit and cake, `PF` puffs |
| Corporate class | `IC HM HK CT HT SC CF` (R7.4) |
| Rain | `'dry'`, `'wet'` or `'heavy'`: the third argument of the demand functions |
| Functions | every function is pure: a function of its arguments and the static config, never of `HB.book`, `HB.masters`, the clock or a random stream. **A draw is always made by the seed and passed in.** `eventFactors` returns one shared object per date: read it, do not change it |

The simulation functions read the static config, not `HB.masters`: a user who edits a master does not
change the seeded history.

## 2. Masters

Shapes are those of SPEC 5.1 and API 2.2; the table lists what each record carries beyond them.

| Key | What | From |
|---|---|---|
| `company` | `name, legalName, gstin, address, stateCode '24', bankName 'Bank current account'`, plus `business, goLive, hsnDigits` | R1.1 |
| `units` | `factory` and the three stores: `id, name, kind`, plus `shortId` (S1..S3), `shortName, address, hours`. A store has `standing: { itemId: packs }`, its **base** standing level (the seasonal puff levels are in `sim.stores`) | R1.2, R6.5 |
| `locations` | `fac_rm, fac_fg`, a stock and a transit location per store | R1.2 |
| `accounts` | `cash_factory`, a cash account per store, `bank` | R1.2 |
| `items` | 18 finished goods: `id, code, key (SB ...), name, kind 'fg', unit ('pack'; 'pcs' for the puffs), pack, netWeightG, piecesPerPack, group, hsn '1905', tariffItem, gstRate (%), shelfLifeDays, price { mrp, retail, corporate } (paise, the OPENING list), reorderLevel 0`. 24 raw (`kind 'rm'`) and 8 packing (`'pk'`) materials: `id, code, name, kind, unit (kg, litre, pcs), pack, orderMultiple, hsn, gstRate, vendorId, leadDays (order date to receipt), reorderLevel, orderQty` (stock units) | R2.1, R2.3, R4.1 |
| `recipes` | per product: `itemId, mixLabel, expectedUnits (E), materials [{ itemId, qty per mix }], packing [{ itemId, qtyPerUnit }], rhythm, standardMixes`. **`rhythm` is `'daily'` or an array of weekdays, Monday = 0** (`[0, 2, 4]` = Mon Wed Fri). The standard day plan of a date is every recipe whose rhythm is `'daily'` or holds `HB.dates.dow(date)`, at its `standardMixes` | R3.2, R3.3, R3.5 |
| `routes` | `R1`..`R4`: `id, name, stops` in the Seq order of R6.3 | R6.3 |
| `customers` | 40 outlets, ordered by id: `channel 'retail', outletType (name), typeCode (P D T B G), size (S M L), routeId, locality, terms ('cash' or 'weekly'), creditDays (0 or 7), creditLimit (paise; 0 for a cash outlet), gstin '', standing { itemId: packs }`. 10 corporates: `channel 'corporate', outletType, typeCode (the class), routeId null, locality, constitution, terms 'credit', creditDays, creditLimit, gstin ('' when not registered), standing {}, pattern` | R6.1 - R6.4 |
| `customers[].pattern` | corporates only, the seed's order rule: `weekdays` (order days), `alternate` (C10: every day whose count from go-live is even), `termOnly` (C09), `poRef` (`'PO/C01/YYYY-MM'`, `'RC/C05/YYYY'` or `''`), `deliveredBy` (V5, V3), `lines [{ itemId, qty }]` (the typical order) | R6.4 |
| `vendors` | 13 stock vendors: `kind 'stock', town, constitution, gstin, termsDays (credit days), supplies [itemId]`. 24 expense vendors: `kind 'expense', town, type, gstin, billGstRate (%), categoryId, termsDays`. `VS01` Staff salaries, `kind 'staff'` | R5 |
| `employees` | **the 35 on the directory at go-live**: `id, name, dept, designation, unitId, doj, dol null, grade (U SS S M), salary (paise a month from 2026-01-01), phone, active`. The three joiners, the two leavers and the raises are dated changes: `sim.people` | R8.2 |
| `expenseCategories` | 15: `id, name, mode`; `system: 'salary'` on `salaries`, `system: 'cash_short'` on `cash_short` | R9.1 |
| `users` | the six personas with the kernel's ids: `id, name, role, employeeId, unitId` | R8.3 |
| `limits` | `poAutoApprove 5000000, billTolerancePct 2, returnsPct 8, backDateDays 3, nearExpiryDays 1, dueSoonDays 7`, and the group `warn`: `yieldLowPct 80, yieldHighPct 105, countAwayPct 20, countMinValue 50000, claimAbove 500000, rateAwayPct 25, dayEndAwayPct 10` - the thresholds of the warnings on unusual figures (SCOPE decision 18), each outside what RESEARCH says an ordinary day gives: 3.3, 3.4 and 12.2 (yield: an ordinary run lies between 81.5% and 104.2%), 9.5 (a month-end count is out by 2% of a month's use at most, about Rs 5,000 in all), 9.6 (claims run to Rs 2,600), 4.2 - 4.4 (from month to month a material moves by 20.5% at most, onions apart), 12.6 (a till is out by Rs 180 at most). `tools/check-config.js` holds each of these against the config | SPEC 5.1, 5.5 |
| `journeys` | the eight guide journeys: `id, title, steps [{ text, route, role, match }], links [{ text, route, params }]` (below) | SPEC 8.1, 9 |
| `gstin` | `make(pan)`, `checkChar(first14)`, `valid(gstin)`: every GSTIN in the file is `'24' + PAN + '1Z'` + a computed check character | R5.1 |
| `guide` | `stepMatches(step, entry, env)`, `entryDocs(entry, env)` | SPEC 8.1 |

### Guide journeys

`match` is `{ op, type, test }`. `op` is the operation of the log entry. `type` is the type of the first
document the entry made (`post`, `postDispatch`) or of the document it acted on (`approve`,
`receiveTransfer`). `test(entry, docs, env)` is optional: `docs` are those documents, `env` is
`{ book, masters }` (`HB.book` and `HB.masters` when left out). `HB.config.guide.stepMatches(step, entry)`
applies all three and is what `guide.journeys()` should call for each log entry; the order of the steps
and the rule "an approve step is also ticked when the step before it was approved in the same operation"
are the guide's.

| # | id | Steps (suggested persona: what ticks it) |
|---|---|---|
| 1 | `dispatch` | sales: `postDispatch` whose `date` is the day of the entry's own `at` |
| 2 | `flour` | stores: a `PO` with a maida (`RM01`) line above maida's latest purchase price **as it stood before that order** (from `book.prices.RM01.history` and the order's `seq`, so the tick survives the receipt that moves the price). stores: a `GRN` with a maida line |
| 3 | `bill` | accounts: a `VBILL` with `match.ok === false`. owner: `approve` of a `VBILL`. accounts: a `PAY` with an allocation to a `VBILL` |
| 4 | `production` | production: a `PROD` with `rejectedUnits > 0` |
| 5 | `store` | stores: an `XFER` to the store of the `store_mgr` user. store_mgr: `receiveTransfer`. store_mgr: a `DAYEND` with a line whose `expired > 0`. owner: `approve` of a `WO` whose `sourceDocId` is a day-end |
| 6 | `return` | sales: a `CN` whose `sharePct` is null or above `limits.returnsPct`. owner: `approve` of a `CN` |
| 7 | `claim` | store_mgr: an `EXP` of kind `claim`. owner: `approve` of a claim. accounts: a `PAY` to an employee |
| 8 | `collect` | accounts: a `RCPT` from a customer of channel `corporate`. accounts: a `DEP` |

No sentence holds a figure (SPEC 2.11): the order limit and the returns limit are named, not quoted.

A link's `params` (optional) open its screen on what the text names: `loc` on Stock on hand (`fac_fg` for
the finished store, `st_vvn` for the store of the store journey), `account` on Cash and bank (`cash_factory`,
`bank`), `item` on Recipes (`FG01`, the sandwich bread of the cost sheet), `tab: 'statement'` on Receipts (the
customer statement). `guide.journeys()` hands each link on with `href`, the route and its parameters as one.

## 3. Opening entries

`HB.config.opening` is at the top level, in the shape `HB.engine.postOpening()` reads (API 3.9), so a
boot with no seed already posts it. A seed calls `HB.engine.postOpening()` first.

| Key | What | From |
|---|---|---|
| `opening.date` | `'2026-01-01'` | R10 |
| `opening.stock` | 32 material lines `{ locId 'fac_rm', itemId, qty, rate }` (rate = the January 2026 price, paise) and 69 finished-goods batch lines `{ locId, itemId, qty, mfgDate, bestBefore }` at `fac_fg` and the three stores | R4.1, R10.4 |
| `opening.cash` | `{ accountId, amount }` for the four cash accounts and the bank | R10.1 |
| `opening.receivables` | 26 `{ customerId, total, dueDate }` | R10.2 |
| `opening.payables` | 13 `{ vendorId, total, dueDate, billNo 'OPENING/VM01' }` | R10.3 |
| `sim.openingSettlement.receivables[customerId]` | `[{ date, share }]`: when the seed receives the opening invoice (two halves for O28 and C06). The six "first payment weekday" rows are worked out to dates | R10.2 |
| `sim.openingSettlement.payables[vendorId]` | `[{ date, share, account }]`: when the seed pays the opening bill, and from which account (`cash_factory` for VM09 and VM11) | R10.3 |

## 4. HB.config.sim

### 4.1 Calendar - `sim.calendar`, `sim.dow`

| Key | What | From |
|---|---|---|
| `dow` | `{ MON: 0 ... SUN: 6 }` | - |
| `calendar.goLive` | `'2026-01-01'` | R1.1 |
| `calendar.closedDays`, `factoryHolidays`, `firstDispatchAfterBreak` | dates | R7.4 |
| `calendar.isClosed(date)`, `isFactoryHoliday(date)` | boolean | R7.4 |
| `calendar.nextOpen(date)` | the date itself when open, else the first open day after it | R7.4 |
| `calendar.prevOpen(date)` | the last open day before the date | R6.4 |
| `calendar.periods` | `collegeVacation, collegeExams, schoolVacation, boardExams, weddings, chaturmas`: arrays of `[from, to]` | R7.6 |
| `calendar.nriSeason`, `summer` | yearly windows `['12-15', '01-31']`, `['04-06', '06-10']` | R7.6, R7.7 |
| `calendar.inPeriod(name, date)`, `inNriSeason(date)`, `inSummer(date)` | boolean; `name` is a key of `periods`, `'nri'` or `'summer'` | R7.6 |

### 4.2 Prices - `sim.prices`, `sim.priceRevisions`, `sim.priceListOn`

| Key | What | From |
|---|---|---|
| `prices.from`, `to`, `months` | `'2026-01'`, `'2027-12'`, the 24 month keys | R4.2, R4.3 |
| `prices.table[itemId]` | 24 purchase prices, paise per stock unit before GST. **This table binds** | R4.2, R4.3 |
| `prices.inMonth(itemId, monthKey)`, `prices.on(itemId, date)` | the price of the month; the rate of a purchase order dated `date` | R4.2 |
| `prices.rule[itemId]` | `[A (rupees), drift a month, shape or null, events [[factor, from month, to month or null]], rounding step (rupees)]` | R4.4 |
| `prices.shapes`, `ruleBase` | the five seasonal shapes (January first); `'2026-10'` | R4.4 |
| `prices.byRule(itemId, monthKey)` | the rule evaluated, paise. It gives the table exactly for all 32 items from November 2026 to December 2027; it is there to show that, not to be used | R4.4 |
| `priceRevisions` | `[{ date, reason, userId, prices: { itemId: { mrp, retail, corporate } } }]`: 2026-07-01 (FG01-FG09) and 2027-04-01 (FG10-FG18), each a dated master change with one row per item, before the day's dispatch | R2.4 |
| `priceListOn(date)` | `{ itemId: { mrp, retail, corporate } }` in force for a document dated `date` | R2.4 |

### 4.3 Outlets - `sim.outlets`

| Key | What | From |
|---|---|---|
| `types`, `templateItems`, `template`, `sizePct` | type names; the 13 item columns; the medium row of each type; size factor in hundredths (`S 75, M 100, L 140`) | R6.1 |
| `standingOf(type, size)` | the standing order of the rule (half up, zero lines dropped); the customer masters were built with it | R6.1 |
| `carried` | who buys what: `columns`, `byItem[itemId]` (1 or 0) | R2.2 |
| `info[customerId]` | `{ type, size, routeId, terms }` | R6.3 |

### 4.4 Demand - `sim.demand`, `sim.rain`

```
retail line    = standing units x demand.retailFactor(customerId, itemId, date, rain) x noise
store line     = sale units     x demand.storeFactor(storeId, itemId, date, rain)     x noise
corporate line = typical units  x demand.corporateFactor(customerId, date)            x noise (one draw per order)
```

| Key | What | From |
|---|---|---|
| `demand.noise` | `{ retail, store, corporate }` uniform ranges | R7.1 |
| `demand.rounding` | `'stochastic'`: round down, add 1 with probability equal to the fraction | R conventions |
| `demand.weekday` | `outlet[typeCode]`, `store[storeId]`, `corporate.C08`: seven factors, **Monday first** | R7.2 |
| `demand.month`, `monthPart`, `monthPartOf(date)` | 12 factors, January first; `{ retail, store, corporate }` x `[days 1-7, 8-23, 24-end]`; the index 0, 1 or 2 | R7.3 |
| `demand.groupOf[itemId]`, `retailGroups`, `storeGroups`, `classes`, `classOf[customerId]` | product groups and corporate classes | R codes, R7.4 |
| `demand.events` | the 32 rows: `{ code, name, periods, onlyDow (0 for E15, else null), retail { BR, BN, DRY }, store { BR, BN, DRY, PF }, corporate { IC ... CF }, on }`. `on[date]` replaces corporate factors on that date (E26 in 2027, E31 on 25 December) | R7.4 |
| `demand.eventsOn(date)` | the events of a day, `on` applied | R7.4 |
| `demand.eventFactors(date)` | all of them multiplied: `{ codes, retail, store, corporate }` | R7.1, R7.4 |
| `demand.campusOutlets`, `college`, `school`, `caterer`, `hotelSeason` | calendar factors `[term, examinations, vacation]`; caterer `{ wedding, nri, chaturmas, other }`; 1.10 | R7.6 |
| `demand.collegeFactor(who, date)`, `schoolFactor(who, date)`, `catererFactor(date)` | 1 for anyone the calendar does not concern | R7.6 |
| `demand.summer` | `{ from, to, factor: { retail, store, corporate } }` by group | R7.7 |
| `demand.retailFactor(customerId, itemId, date, rain)` | weekday x month x month-part x events x campus vacation x summer x rain; 0 on a closed day | R7 |
| `demand.storeFactor(storeId, itemId, date, rain)` | weekday x month x month-part x events x college calendar (S2) x summer x rain; 0 on a closed day | R7, R7.5 |
| `demand.corporateFactor(customerId, date)` | events (by class) x calendar x season x weekday (C08) x heavy rain; **0 = no order that day** (not an order day, a closed day, a class holiday, the school vacation) | R6.4, R7 |
| `rain.seasons`, `wetChanceByMonth`, `heavyDays`, `heavyOnRoutes`, `factor`, `corporateHeavy` | the wet seasons, the chance by calendar month, the dated heavy days (2026-09-14: R4 only), the factors by kind, channel and group | R7.8 |
| `rain.wetChance(date)` | the chance that the date is wet (0 outside the season and on a dated day) | R7.8 |
| `rain.kind(date, draw, routeId)` | `'dry'`, `'wet'` or `'heavy'` for a route; leave `routeId` out for a store. One draw per date | R7.8 |
| `rain.factorOf(channel, group, rain)` | the rain factor alone | R7.8 |

### 4.5 Stale returns - `sim.returns`

| Key | What | From |
|---|---|---|
| `rate[itemId]`, `lagDays[itemId]` | fraction of the units dispatched; days from dispatch to the credit note. FG01-FG15 only | R7.9 |
| `sizeFactor`, `outletOverride`, `outletFactor(customerId)` | L 0.85, M 1.00, S 1.20; O04, O28, O38 1.60; O19 3.50 | R7.9, R12.3 |
| `seasonMonths`, `seasonFactor`, `heavyRainFactor`, `seasonFactorOn(dispatchDate, rain)` | 1.25 for a dispatch in July to September, 1.60 for the dispatch of a heavy-rain day on a route that is hit, else 1 | R7.9 |
| `expected(customerId, itemId, units, dispatchDate, rain)` | units x rate x outlet factor x season factor, before the stochastic round | R7.9 |
| `noteDate(itemId, dispatchDate)` | dispatch date + lag, moved off a closed day | R7.4, R7.9 |
| `priceBasis` | the note uses the price of the invoice it reverses | R2.4 |

### 4.6 Own stores - `sim.stores`

| Key | What | From |
|---|---|---|
| `ids`, `sale[storeId][itemId]`, `noise` | units sold on a normal day; noise range | R6.5 |
| `puffStanding.summer[storeId]`, `collegeVacation.st_vvn`, `changedBy` | seasonal puff standing (dated master changes by Accounts) | R6.5 |
| `standingOn(storeId, date)` | the full standing map of the date: the base of the unit master with the seasonal puff levels; the vacation level of S2 takes precedence over summer. Change the master on the day it differs from the day before | R6.5 |
| `unsaleableRate[itemId]` | share of the last seven days' sale, FG01-FG15 | R6.5 |
| `writeOff` | `{ dow 6, reason 'damaged', windowDays 7 }`: every Sunday after the day-end | R6.5 |
| `isWriteOffDay(date)` | is the date the day of the weekly write-off request: Sunday, the Monday after when the Sunday is closed (2027-10-31 -> 2027-11-01) | R6.5, R7.4 |
| `manager[storeId]`, `userId` | E029, E032, E034; every store document (day-end, transfer confirmation, write-off request, claim) is raised by `u_store_mgr`, whose employee is E032; at S1 and S3 the seed names the store's own manager as the one who entered it (`ctx.as`, display only, API 2.5) | R6.5, R8.3 |
| `managerNote(storeId)` | the `note` of a store document: `'Store manager: Ketan Bhatt (E029)'` at S1, the same for E034 at S3, `''` at S2 where the persona is the manager | R8.3, R14 point 6 |
| `upiShare[storeId]`, `upiNoise` | 0.60, 0.75, 0.60; +/- 0.08 | R6.5 |
| `depositDows`, `float`, `isDepositDay(date)` | Monday and Thursday, moved off a closed day; Rs 3,000 left in the till | R6.5 |
| `expectedPuffExpiry` | 0.08 - 0.20, for reference | R7.10 |

### 4.7 Corporates and collections - `sim.corporates`, `sim.collections`

| Key | What | From |
|---|---|---|
| `corporates.orderDay(customerId, date)` | is the date a delivery day by the pattern alone | R6.4 |
| `corporates.factor` | the same function as `demand.corporateFactor` | R6.4 |
| `corporates.poRef(customerId, date)` | `'PO/C01/2026-03'`, `'RC/C05/2026'` or `''` | R6.4 |
| `corporates.orderDate(deliveryDate)` | the date of the sales order: the last open day before delivery | R6.4 |
| `corporates.noise`, `userId` | 0.95 - 1.05 per order; `u_sales` | R7.1 |
| `collections.collectionDow[routeId]` | R1 Monday (0) ... R4 Thursday (3) | R6.2 |
| `collections.week1Monday`, `weekOf(date)` | week 1 is the week of Monday 2026-01-05 | R6.2 |
| `collections.upiShare` | 0.5: a draw under it is UPI into the bank, otherwise cash into factory cash | R6.2 |
| `collections.slow[customerId]` | `'oddWeeks'` (O38, O04), `'everyThirdWeek'` (O19), `'firstOfMonth'` (O28) | R6.2 |
| `collections.outletPaysOn(customerId, date)` | does a weekly outlet pay that day (collection day, moved off a closed day, slow rule applied)? It then clears everything invoiced up to the day before | R6.2 |
| `collections.corporate[customerId]` | `{ payDow, latenessDays }` | R6.4 |
| `collections.corporatePaysOn(customerId, date)` | its payment weekday, moved off a closed day | R6.4 |
| `collections.corporatePayDate(customerId, dueDate)` | its first payment day on or after due date + lateness | R6.4 |
| `collections.corporateAccount`, `userId` | `'bank'`; `{ retail: 'u_sales', corporate: 'u_accounts' }` | R6.4 |

### 4.8 Production and yield - `sim.production`

| Key | What | From |
|---|---|---|
| `byItem[itemId]` | `flourKg, waterLitres, piecesPerMix (T), reject (r), drift (a), expectedUnits (E), step, daily, rhythm, standardMixes, normalDayUnits, averageMixes, smallestRun, largestRun, maxMixes, coverDays` (the last two for the long-life lines) | R3.3, R3.5 |
| `dailyItems`, `runItems` | FG01-FG09 and FG16-FG18; FG10-FG15 | R3.5 |
| `isRunDay(itemId, date)`, `nextRunDay(itemId, date)` | no entry on a factory holiday; a daily line bakes on every other day, Sundays included; a long-life line never runs on a Sunday, and a run that falls on a factory holiday moves to the next working day that is not a Sunday (choice 13) | R3.5 |
| `rejectDraw` | `[0.5, 1.6]`: the range of `v` | R3.4 |
| `outcome(itemId, mixes, u, rejectRate)` | `{ made, rejected, good, expected }` for `u` in `[-drift, +drift]` and the reject rate drawn (normally `reject x v`) | R3.4 |
| `badRuns` | the five causes: `{ id, cause, items, per, chance { hot, monsoon, cool }, rejectRate or rejectedPiecesOfOneMix or yieldUnder }` | R3.4 |
| `heatSeason(date)`, `badRunChance(id, date)` | `'hot'` (Mar-Jun), `'monsoon'` (Jul-Sep), `'cool'`; the chance of that cause on the date (humidity: 15 June to 30 September) | R3.4 |
| `averageWindowDays`, `minRunMixes` | 14; 1. The run-size rules are written out in the comment above them | R3.5 |
| `expectedLossShareOfSales` | 0.001 - 0.006, for reference | R3.4 |

### 4.9 Purchasing and payments - `sim.purchasing`

| Key | What | From |
|---|---|---|
| `firstCheck` | the check of 31 December 2025 runs on the opening stock; its orders are dated 1 January 2026 | R4.5 rule 1 |
| `rateOn(itemId, date)` | the order rate: the price of the month | R4.5 rule 2 |
| `marketNoise[itemId]`, `marketRate(itemId, date, u)` | RM19, RM20, RM23: `{ pct 0.06, step (paise) }`; the month's price x (1 + u), rounded to the step | R4.5 rule 2 |
| `orderDate(checkDate)` | the date of the order a day-end check raises: the day of the check, a Sunday or a closed day with production included (choice 23) | R4.5 rules 1, 2 |
| `everyDayVendors`, `receivingDows[vendorId]`, `isReceivingDay(vendorId, date)`, `nextReceivingDay(vendorId, date)` | the "Order days" column of R5.1 as receiving days: Monday to Saturday, every day for VM09 and VM11; no receipt on a closed day | R5.1, R4.5 rule 4 |
| `exceptions` | `VM12 { chance 0.25, firstShare 0.60, restAfterDays 4 }`, `VM01 { chance 1/25, rejectedQty 50, secondReceiptAfterDays 2 }`, `VM09 { chance 1/8, itemId 'RM19', rejectedKg [2, 4] }`. **Each has `drawnOn: 'order'`**: one draw per order, keyed on the order, so the second receipt that makes a rejection good is never drawn again (VM09: an order with a potato line) | R4.5 rule 4 |
| `billAfterDays`, `billDate(receiptDate)` | 1; the day after the receipt, the next open day if that is closed | R4.5 rule 5 |
| `weeklyBilling` | `{ vendors, dow 0, covers, isBillDay(date), periodOf(billDate) }`: VM09 and VM11 bill each Monday (the bill of the closed Monday 2026-11-09 is dated Thursday 2026-11-12) for the receipts of the previous Monday to Sunday, `[from, to]` | R4.5 rule 5 |
| `paymentDows`, `isPaymentDay(date)`, `nextPaymentDay(date)` | Monday and Thursday, moved off a closed day | R4.5 rule 6 |
| `lateDays`, `cashVendors`, `payDate(vendorId, dueDate)` | VM08 and VM13 12 days late; VM09 and VM11 in cash on the due date; the day the seed pays a bill | R4.5 rule 6 |
| `safetyNet.expectedCount` | 0 | R4.5 rule 7 |
| `userId`, `billedBy`, `approvedBy` | `u_stores`, `u_accounts`, `u_owner` | R4.5, SPEC 7 |

The order limit is `HB.config.limits.poAutoApprove`.

### 4.10 People - `sim.people`

| Key | What | From |
|---|---|---|
| `joiners` | three full employee records (E036, E037, E038) to add on their `doj` | R8.2 |
| `leavers` | `[{ id, dol }]` for E020 and E025 | R8.2 |
| `replaces` | `{ E036: 'E020', E038: 'E025' }` | R8.2 |
| `raise` | `{ pct 0.08, roundTo 10000 paise, exclude ['E001'] }` | R8.1 |
| `raises` | `[{ date, note 'annual increment 8%', userId, salary: { employeeId: paise } }]` for 2026-04-01 and 2027-04-01: the table, which binds | R8.2 |
| `activeOn(id, date)`, `salaryOn(id, date)`, `headcountOn(date)` | by the table; `salaryOn` is 0 when not employed | R8.1 |
| `salaryBill`, `salaryPayDate(monthKey)` | raised on the last day by `u_accounts`, approved the next morning, paid from the bank on the 5th (next open day) | R8.2 |

### 4.11 Overheads and claims - `sim.expenses`

| Key | What | From |
|---|---|---|
| `diesel` | `series [[from date, paise a litre]]`, `litresADay 19`, `priceOn(date)`, `amount(from, to)` (19 litres on every open day) | R9.3, R1.3 |
| `gas` | `series [[from month, paise per SCM]]`, `scmADay 63`, `priceIn(monthKey)`, `scm(monthKey, V)`, `amount(monthKey, V)` | R9.3, R9.4 |
| `electricity` | `tariff` (rupees: energy, fixed, duty, surcharge steps, seasonal factors January first), `surcharge(monthKey)`, `factoryUnits(monthKey, V)`, `factory(monthKey, V)`, `storeUnits(storeId, monthKey)`, `store(storeId, monthKey)` | R9.3, R9.4 |
| `bankCharges(depositedPaise)` | Rs 1,500 + Rs 1.50 per Rs 1,000 deposited | R9.4 row 35 |
| `volumeFactor` | how `V(M)` is defined: flour consumed a day in M over the same for January 2026; 1 for December 2025 | R9.2 |
| `bills` | one rule per bill of R9.4 (a row per van or per store where the table says "each"): `n, categoryId, name, vendorId, unitId, gstRate, when(date) or seededDay [first, last] with months, fixed or uniform [low, high] or calc(date, env), noise, payAfterDays, sameDay, van` | R9.4 |
| `billsOn(date, env)` | the bills whose rule fixes that date: `[{ rule, amount }]`; `amount` is paise before noise, null for a uniform draw | R9.4 |
| `seededBills(monthKey)` | the rules whose day is drawn in that month (rows 16, 17, 39) | R9.4 |
| `seededDates(rule, monthKey)`, `seededDate(rule, monthKey, u)` | the open days of the rule's range in that month (November 2026 has no 9th, 10th or 11th); the one a draw `u` in `[0, 1)` picks, each as likely. `[]` and `null` in a month the rule has no bill | R9.2, R9.4 |
| `billAmount(rule, date, env)`, `toRupee(paise)` | the amount of one rule; rounding to the rupee after the noise draw | R9.2 |
| `claims.rows` | 26 rows (the store rows once per store): `name, categoryId, userId, unitId, payeeEmployeeId, perMonth, amount [low, high], amounts (the recharge), dow (5 for the Saturday tea)`. `payeeEmployeeId` is the persona's employee on a factory row and the store's own manager on a store row (choice 24) | R9.6, R8.3 |
| `claims.noteOf(row)` | the `note` of the claim: `stores.managerNote` of its store, `''` for the factory | R8.3 |
| `claims.roundTo, billRef, rejectShare, rejectReasons, reimburse` | Rs 10; `CB-<4 digits>` or `'no bill - voucher'` one in five; 3% rejected; every Saturday, factory cash or bank | R9.6 |
| `claims.isReimburseDay(date)` | is the date a reimbursement day: Saturday, the next open day when the Saturday is closed (2027-10-30 -> 2027-11-01) | R9.6, R7.4 |
| `userId`, `approvedBy`, `payAccount` | `u_accounts`, `u_owner`, `'bank'` | R9.2 |

`env` for `calc` and `billsOn`: `{ V: function (monthKey) -> number, cashDeposited: paise deposited in the
bill's month, headcount: active employees }`. Left out, `V` is 1, the deposits 0 and the headcount that
of `people.headcountOn(date)`. All amounts are in paise and are **not** rounded: apply the noise, then
`toRupee`.

### 4.12 Cash, the month-end count, vans, clock, approvals

| Key | What | From |
|---|---|---|
| `cash.factory` | `{ dows Mon-Sat, keep Rs 25,000, minDeposit Rs 5,000, userId }`; `cash.isFactoryDepositDay(date)` | R9.5 |
| `cash.store`, `cash.slipRef` | the store rule again; `DS-<6 digits>` | R6.5, R9.5 |
| `stockCount` | `locId 'fac_rm', userId, approvedBy, reason, dateOf(monthKey)` (last open day), `packing { items, shortage [0.01, 0.02], whole }`, `flour { items ['RM01'], shortage }`, `bulk { items, shortage }`, `others { count 2, range }` | R9.5 |
| `vehicles` | V1-V5: `run, routeId, drivers [{ employeeId, from }], leaves, back, km`; V5 has its `timetable` | R1.3 |
| `clock` | time of day of the seeded documents: `loading, dispatch, transfer, transferConfirmed, dayEnd, dayEndAt[storeId], arrivals, serviceMinutes` | R1.3 |
| `approvals` | `{ userId 'u_owner', when 'next open morning' }`; the held weekly bill of `stories.heldBill` is the one exception | R9.2, R14 point 2 |

### 4.13 The eight stories - `sim.stories`

| Key | What | From |
|---|---|---|
| `flour` | items, products and the four turning points of the maida price (paise); the rule is `sim.prices` | R12.1 |
| `yieldDip` | `fromDay 5, toDay 18, rotation [{ itemId, note }], rejectRate [0.08, 0.12]`; `on(date)` -> `{ itemId, note, rejectRate }` or null | R12.2 |
| `highReturns` | O19, its outlet factor, the expected shares | R12.3 |
| `lateCorporate` | C06: credit days, lateness, payment weekday, limit, opening overdue | R12.4 |
| `heldBill.weekly` | VM09: the onion line (potato if none) 3-6% above the order rate, rounded to Rs 0.10, released after 7 days; `releaseDate(billDate)` is that morning, the next open day if closed, and equals `purchasing.payDate('VM09', due date)` (choice 25) | R12.5 rule A, R14 point 2 |
| `heldBill.occasional` | one bill in 40 from five vendors, one line 3-5% over, note `'billed at next month's price'`, released the next morning | R12.5 rule B |
| `cashShort` | S3, Tuesday: `on(date)`, `amount`, `roundTo`; `anywhere { chance 0.02, amount, shortShare 0.7 }` | R12.6 |
| `lowStock` | yeast RM08: the figures of the master that make the story | R12.7 |
| `nearExpiry` | ladi pav FG04: 1.6 days of standing, three days of life, largest store demand factor 1.48 | R12.8 |

## 5. HB.config.calibration

| Key | What | From |
|---|---|---|
| `dates` | the three business dates the self-check uses | R13 |
| `bands` | 52 rows `{ n, key, measure, unit, ... }` with `min`, `max`, `above`, `tolerance`, `parts { name: [min, max] }`, `days [min, max]` as the band needs, and `every`, `from`, `customerId` and the like saying what it is tested on. Money in paise, shares as fractions | R13 |
| `months['YYYY-MM']`, `years['YYYY']` | the expected values of R11.6: `retailGross, staleReturns, corporates, stores, netSales, perDay, expenses` (paise), `volumeFactor`, `cogsShare, materialShare, profitShare` (fractions). For band 4 and for checking the generator, never for patching it | R11.6 |

## 6. Choices made

Where RESEARCH is silent, says two things, or the engine fixes the shape. Each is checked.

1. **Weekdays are numbered from Monday** (`HB.dates.dow`), not from Sunday as RESEARCH's convention
   line says. The seed and the selectors work with `HB.dates.dow`; one numbering in the code base.
   Every weekday array (`demand.weekday`, a recipe `rhythm`) and every weekday number (`dow`, `dows`,
   `payDow`, `onlyDow`, `collectionDow`, `depositDows`, `paymentDows`) is to be read with `HB.dates.dow`
   or `sim.dow`, never with `Date.getUTCDay()` or RESEARCH's numbers. The check reads each of them
   through real dates against R7.2 as it is printed, Sunday first.
2. **Ids are the RESEARCH codes**, and an item's id is its code (batch ids read `B-260101-FG04`).
3. **`opening` sits at the top level**, not under `sim`: `HB.engine.boot()` and `postOpening()` read
   `HB.config.opening` (API 3.9). What the seed does with those balances is `sim.openingSettlement`.
4. **The employee master holds the 35 people of go-live.** The joiners, the leavers' `dol` and the raises
   are dated master changes in `sim.people`, so that a copy opened early does not show a future joiner
   or a future leaving date. `salary` is the figure from 2026-01-01.
5. **A normal day's corporate sales are the weekly average** R11.2 uses: orders a week by the pattern
   alone, over seven days (C10 3.5 orders a week, C09 6, with no vacation).
6. **Normal-day units, two readings.** `sim.production.byItem[].normalDayUnits` is the requirement of R3.5
   (sales plus what the stores lose: 652 loaves, 620 veg puffs); the units of R11.3 are sales alone
   (649.14, 575). Both are right; the seed's 1 January rule uses the first.
7. **Reorder levels are the table of R4.1.** Its note says "1.1 x the heaviest (lead + 4)-day stretch";
   for RM19, RM20 and RM22 the table follows a (lead + 3)-day stretch (potato: 100 kg, where five days of the
   plan x 1.1 is 120). The table
   binds; every level covers the plan of the lead days plus three, which is what SPEC 6 needs.
8. **Stale returns on a heavy-rain dispatch: the factor 1.60 replaces 1.25**, it does not multiply it.
   With that reading the returns of every month land within 0.8% of R11.6.
9. **Corporates on 2026-09-14** (heavy on R4 only): the day is wet for everyone else, so the caterer and
   cafe factors for heavy rain do not apply.
10. **Units and SCM are rounded before they are priced**: the factory's kWh, each store's kWh and the gas
    SCM of a month are whole numbers, as a meter reads them. R9.4 states no rounding. For the factory it
    is the reading that gives R9.4's own worked figure (8,937 units = Rs 74,696; unrounded it is
    Rs 74,699). For gas and the stores nothing in RESEARCH decides it and the same reading is taken: it
    moves a gas bill by at most Rs 33 and a store bill by at most Rs 4, well under the 3% and 5% noise,
    and all the worked checks of R9.4 hold. **The 0.85 of S2** (row 7, "x 0.85 when M-1 is May or
    November") is a factor on its kWh, as the row prints it after the kWh, not on the whole bill; on
    the bill it would be about Rs 45 lower.
11. **Vendor terms are one number.** The engine dates an expense bill's due date as bill date +
    `termsDays`. "Dated the 1st, due the 7th" is 6 (VE01), "due the 5th" 4 (VE02-VE04), "dated the 5th,
    due the 20th" 15 (VE09), "paid the same day" 0 (VE16). **VE08 is 15** (R5.3: "15 for the contract,
    7 otherwise"); its two other bills carry `payAfterDays: 7` in `sim.expenses.bills`, the contract
    `payAfterDays: 15`. So the generator-service bills (15 May, 15 November) and the compressor bill
    (2026-08-18) show a due date 15 days out and are paid at 7 days: paid early, never overdue. With 7
    in the master the four contract bills a year would each show as eight days overdue, which RESEARCH
    does not intend; the check holds that no bill rule pays after the due date its document shows.
    VS01 has 5, for the 5th of the next month; the engine dates a salary bill due on its own date and
    the seed pays it on `people.salaryPayDate`.
12. **The price rule's `A`** is printed as "October 2026 level" but for the seasonal items (RM19, RM20,
    RM21, RM23) it is the level before the shape. The config keeps `A` as printed and reads prices from
    the table; the rule reproduces the table to the paisa.
13. **No long-life run is on a Sunday, a moved run included.** R3.5: "a long-life run that falls on a
    Sunday never happens (no run day is a Sunday) and one that falls on a factory holiday moves to the
    next working day". The runs of Friday 29 and Saturday 30 October 2027 (FG10, FG13, FG15; FG11,
    FG14) therefore move past Sunday 31 October to Monday 1 November 2027, where all six long-life
    lines run together, as they do on Wednesday 11 November 2026 after the first break. For a
    long-life line a working day is a day that is neither a factory holiday nor a Sunday; the daily
    lines bake on Sunday 31 October 2027 for the dispatch of 1 November. The long-life run rule sizes
    the last run before the break to reach the next run day, so the dispatch of 1 November is covered.
14. **Whatever is done on a weekday moves to the next open day when that day is closed** (R7.4), and
    the config holds each move as a function, so that the seed does not work it out: `stores.isDepositDay`,
    `stores.isWriteOffDay`, `purchasing.isPaymentDay`, `purchasing.billDate`, `purchasing.weeklyBilling.isBillDay`,
    `collections.outletPaysOn`, `collections.corporatePaysOn`, `expenses.claims.isReimburseDay`,
    `returns.noteDate`, `people.salaryPayDate`, `stockCount.dateOf` (the last open day),
    `expenses.seededDates` (a drawn bill day is an open day). `expenses.billsOn` dates nothing on a
    closed day but the three month-end bills of 2027-10-31 (rows 33, 35, 42), which keep their date.
    A slow outlet's rule (odd week, third week, first of the month) is read on the day it was due.
    O28's "first collection day of the month" is the first Wednesday.
15. **C06** is open 37 to 41 days on each invoice (delivered Tue, Thu or Sat, due at 15 days, paid on the
    first Monday 20 days later). By its expected orders alone it owes Rs 50,300 at the least and Rs 1.2
    lakh at the most, against a limit of Rs 40,000; R12.4 says "Rs 54,000" and "about Rs 1.1 lakh".
16. **Event cells with two figures**: E26 holds 2.50 for HK and HT and `on['2027-10-29']` sets 2.00; E31
    holds 1.00 for SC and `on` sets 0 on 25 December of both years. Read events through `eventsOn` or
    `eventFactors`.
17. **A retail factor for a group a table does not list is 1** (a puff added to a route sheet by a user).
18. **Who raises a seeded document**, where RESEARCH names nobody: the only role SPEC 7 allows besides the
    Owner. Receipts are open to two roles; the config suggests `u_sales` for route collections and
    `u_accounts` for corporate transfers.
19. **Contact numbers** are fixed in the config by a hash of the employee id (ten digits, 38 different
    numbers), not drawn by the seed from the seeded stream as R8.1 has it. The directory is a master
    and is whole on a boot that runs no seed; a number drawn by the seed would need 38 master changes
    and would differ between a copy with a seed and one without. A hash of the id is as repeatable as
    a draw keyed on the employee, and no figure depends on it. Screens mask the number.
20. **Claim "one every second month at each store"** is `perMonth: 0.5`.
21. **Journey text names no figure**, and journey 5 names the Vidyanagar store because the kernel scopes
    the store manager to it; the test reads the store from the `store_mgr` user.
22. **Finished-goods unit**: `'pack'` for FG01-FG15, `'pcs'` for the puffs (R2.1).
23. **An order is dated the day of the check, on any weekday.** R5.1 prints an "Order days" column
    (Monday to Saturday; every day for VM09 and VM11) and says beside it that these "are also the
    receiving days". The config holds the column as `purchasing.receivingDows` and applies it to the
    receipt only (R4.5 rule 4). The order date follows R4.5 rules 1 and 2 (the check runs after
    production on day D and the order is "raised that evening and dated D") and R11.7 row 19, which
    records the change from the raw file: the order is raised in the evening and the lead days carry
    the extra day. So a Sunday-evening order to a Monday-to-Saturday vendor exists, and so does an
    order dated the closed production day 2026-11-11; with two lead days a flour order of Sunday is
    received on Tuesday. `purchasing.orderDate` says so in code.
24. **Who a store claim is payable to.** R8.3: the claims of S1 and S3 are raised under `u_store_mgr`
    with the note naming their own manager, and "a store claim is payable to that store's manager".
    The config carries that: `claims.rows[].payeeEmployeeId` is E029, E032 or E034 on a store row and
    `claims.noteOf(row)` is the note. The engine takes the payee of a seeded claim from its payload
    (`payeeId`, seed only; a user's claim is payable to the employee of the persona who raises it), so
    the S1 and S3 claims are payable and reimbursed to E029 and E034. The screens also name that
    manager as the one who raised them (`ctx.as`, display only). No figure of R9 or R11 changes either
    way: the expense is by unit and category.
25. **The held VM09 bill waits a week.** R14 point 2 says it "waits a week" and R4.5 rule 6 that VM09
    is paid in cash on the due date, which is bill date + 7 (R5.1); R12.5 says the Owner releases it
    "on the morning of the following Monday (the next open day if closed), when it is also paid in
    cash". These are the same day for every weekly bill dated on a Monday. They differ for one bill in
    the two years: the bill of the closed Monday 2026-11-09 is dated Thursday 2026-11-12, and is
    released and paid on Thursday 2026-11-19 here (`heldBill.weekly.releaseDate`, `purchasing.payDate`),
    not on Monday 2026-11-16. Two VM09 bills are then on hold from 16 to 18 November 2026; band 43
    (at least one) holds on every open day either way, and the check proves both.
26. **Band 38 is tested at each month end.** R13 says "at each month end" on rows 36 and 37 and names
    no moment on row 38 (finished stock at the three stores, Rs 10,000 - 25,000). The config reads it
    like the two rows above it and gives it `every: 'month end'`: a day-end figure, as the opening
    Rs 14,900 of R10.4 is. A self-check that wants it on every day-end may test that as well; after
    the morning top-up the stores hold more than the band, so it is not a start-of-day figure.
27. **S3 is short two to four times in 30 days.** `stories.cashShort.on` is the rule of R12.6 exactly
    (the Tuesday of every week `k = floor(days since 2026-01-01 / 7)` with `k mod 3` 0 or 1). The prose
    after it says "every 30-day window holds two or three"; by the rule a window can hold four
    (2026-01-06 to 2026-02-04: 6, 13 and 27 January, 3 February). Band 44 is 2 - 4 and is what binds.

## 7. Checking it

`node tools/check-config.js` (add `-v` for the month-by-month table). It loads the kernel, the config
and the engine and exits with code 1 on any failure. The expected figures are typed from RESEARCH.md
beside the section they come from. What it proves:

- counts; every id referenced anywhere exists, on both sides (an item names its vendor and the vendor
  lists the item; a stop is an outlet of that route; a bill rule uses the category and GST rate of its
  vendor; a persona named for a document may raise it);
- every GSTIN: Gujarat, the format, the check character by the check's own function, and the registrations
  as R5 and R6.4 print them;
- the item master, both price revisions, the material master, the outlet template worked out, every
  outlet, the route totals, the corporates and their orders in 2026 (301, 301, 362, 362, 362, 156, 52,
  362, 251, 181), the stores and their standing rule;
- unit recipe cost of all 18 products at January 2026, October 2026 and December 2027 prices (R11.1), the
  24-month extremes, the figures of the flour story, and that no product sells below cost in any channel
  in any month;
- a normal day's sales by channel at the three price lists and six cost months (R11.2) and by item (R11.3);
- the standard day plan: flour by weekday (663 kg on a Sunday, 743-861 otherwise, 775 on average), mix
  steps, smallest and largest run, maxima, reorder levels and opening stock against the plan;
- the opening entries through `HB.engine.boot()` with no seed: 41 documents, no refusal, cash and bank,
  Rs 8,54,000 of receivables with their ageing, Rs 9,70,000 of payables by due date, stock of Rs 4.82
  lakh + 1.68 lakh + 7,400 + 3,600 + 3,900, every batch of R10.4, and that the sheets, transfers and
  corporate orders of 1 January post as prefilled;
- every event row of R7.4, every event and calendar period inside 2026-2027, the 2026 price table, the
  rule of R4.4 against the 2027 table, diesel and gas to December 2027;
- salaries, both raises by rule and by table, headcount, and the salary bill of all 24 months (R8.2);
- purchasing, payment and collection days; the worked checks of R9.4; the yearly Rs 1,94,000 of licences;
- **weekdays**: every weekday array and number of the config, read through real dates, against R7.2 as
  printed (Sunday first) and against the weekday each rule names;
- **closed days, on all 730 days**: every rule that names a weekday has a function, none answers yes on
  a closed day, and each weekday due has its day (the next open one); no bill, drawn or dated by a rule,
  falls on a closed day except the three month-end bills of 2027-10-31; no long-life run is on a Sunday;
- **who and when, where the engine fixes the shape**: a claim row's payee (the persona's employee, or
  the store's manager); no bill rule pays after the due date its document shows; each receipt exception
  is drawn on the order; a held VM09 bill is released on its due date and one is on hold on every open
  day after 5 January 2026;
- the eight stories as rules (the dip rotation, S3's Tuesdays with two to four shortages in any 30 days,
  C06 above its limit on every date);
- **the demand model against R11.6**: expected sales of each of the 24 months from the config's own
  functions, with no noise. Retail lands within 0.0%, corporates 0.1%, stale returns 0.8%, own stores
  1.5% (the model here has no stock cap on puffs), net sales 0.4%; each corporate's and each store's year
  against R6.4 and R6.5;
- the eight journeys through `HB.engine.act` on a copy with the opening entries only: each of the 18
  steps is ticked by the entry SPEC 8.1 names and by no other, a near miss ticks nothing, and a rebuild
  from the log ticks the same steps;
- the 52 bands and the table of R11.6 as data; that the engine copies only the masters and that a master
  change never writes into the config.
