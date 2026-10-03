# Happy Bakers - Neo ERP (Tier 1) sample: scope

v0.4, 3 October 2026. Status: **agreed. Nothing is open.**

- v0.4: the owner's decisions of 3 October 2026 (decisions 14 to 18): the load time is accepted as built;
  one action cancels a posted dispatch sheet; delivering less than a corporate order closes the order;
  a salary bill is always dated a month end; the system warns, without blocking, on figures that look
  wrong.
- v0.3: everything in the old "still to confirm" list confirmed by the owner; the Owner persona may do
  everything; the company is resized to about Rs 4 crore and 35 employees; gaps found in review closed
  (opening entries, cash deposits, which document sets the purchase price, who approves what,
  cancelling and back-dating, the business date, money precision, the self-check).
- v0.2: product list revised - nankhatai and cream roll removed; paneer puff, garlic puff and three more
  burger buns added (18 products).

---

## 1. What this is

A clickable sample of the **Neo ERP (Tier 1)** offering, built around a fictional bakery factory in
Anand, Gujarat. It is a sales sample, not a product: a static site, no server-side data.

It is deliberately the opposite of the Miya Kebabs sample (NeoX): fewer areas, each one working end to
end. In Miya Kebabs only bills, payment batches, vendors and rule thresholds hold state; every chart is
regenerated from a fixed simulation, so nothing a user types moves a number. Here **every figure on
every screen is derived from documents, and a user can add those documents.**

From the brief:

- Seed data from 1 January 2026.
- Users enter new data; dashboards and values update.
- Data lives in the browser's local storage: each user has a private copy and the seed is never altered.
- Limited scope is fine; whatever is in scope must be complete.
- 10-15 products (now 18, by the owner's choice); inventory, COGS, employee directory.

## 2. Decisions

| # | Question | Decision |
|---|---|---|
| 1 | Tier boundary | Strict Tier 1, plus a few clearly labelled upgrade teasers for iNeo / NeoX |
| 2 | Accounting depth | Management accounts: receivables, payables, cash and bank book, monthly P&L. No chart of accounts, journals, trial balance or balance sheet |
| 3 | Own stores | Stock locations. The factory transfers stock; the store enters a daily sales summary, cash / UPI collected and unsold or expired stock |
| 4 | Areas beyond the core | Expense claims with approval. **Out:** tasks, attendance and leave, payroll |
| 5 | Demo date | Real calendar. A copy takes the date it is first opened as its **business date** and keeps it; history runs from 1 Jan 2026 to the day before (section 7) |
| 6 | Costing | The simplest method: recipe quantities x latest purchase price (section 6) |
| 7 | Batches | Finished-goods batches with best-before; oldest stock dispatched first; expiry flags and write-off with approval. No raw-material lots |
| 8 | How it is used | On a laptop, both presented by the team and explored alone by a prospect. So: desktop layout only, plus a "try this" guide and guardrails on every form |
| 9 | Owner persona | Can do everything: enter, review, approve, cancel - including approving what the owner raised. The sample opens as the Owner |
| 10 | Size | About Rs 4 crore a year, about 35 employees, 40 retail outlets, 10 corporates, 3 own stores |
| 11 | Company and names | Happy Bakers is fictional; every customer, vendor and employee name is invented |
| 12 | Look and hosting | The Miya Kebabs shell with a different accent, "Neo ERP" as the product name; its own repository and a signed-in preview |
| 13 | Timing | No fixed date |
| 14 | Load time | Accepted as built: about one second for a copy opened in 2026, and over two seconds from about April 2027, because the whole history is rebuilt on every load. Revisit if the sample is still in use then |
| 15 | Cancelling a dispatch sheet | One action cancels every invoice of a posted sheet, all or nothing, with one reason |
| 16 | Part delivery | Delivering less than a corporate order closes the order; there is no back-order, and the form says so |
| 17 | Salary bill | Always dated a month end. On another day, last month's bill is cancelled and raised again, and the cancellation shows in the current month |
| 18 | Unusual figures | The system warns, without blocking, on figures that look wrong: a production entry whose good units are below about 80% or above about 105% of what the recipe expects for the mixes; a stock-count line that differs from the books by more than about a fifth (a difference that is trivial in absolute terms is ignored); an invoice line that delivers more than the corporate order has; a receipt above everything the customer owes, saying how much will stay on account; an expense claim well above what claims normally are; a purchase-order rate more than about a quarter away from the item's latest purchase price; and a store day-end whose cash plus UPI differ from the day's sales at MRP by more than about a tenth |

## 3. The company

- **Happy Bakers** - fictional. Factory in the Vitthal Udyognagar industrial estate, Anand.
  All-vegetarian, eggless range.
- **Went live on Neo ERP on 1 January 2026** with opening balances only (opening stock, customer and
  vendor balances, cash and bank). That is exactly what Tier 1 allows: no migration, history builds
  from go-live.
- About Rs 4 crore a year (about Rs 1.1 lakh a day) and about 35 employees - inside the Tier 1 band of
  Rs 3-15 crore and 20-100 employees.
- Locations: the factory (raw-material store, finished-goods store, office) and three own stores
  (Anand town, Vallabh Vidyanagar, Nadiad).

Customers:

| Channel | Who | How they buy | How they pay |
|---|---|---|---|
| Retail outlets | About 40 provision stores, dairy parlours and tea stalls on 4 van routes (Anand town; Vidyanagar-Karamsad; Nadiad; Borsad-Petlad) | Standing daily order, delivered each morning; stale stock taken back | Cash on delivery, or weekly credit |
| Corporates | About 10 canteens, hostel messes, a hospital kitchen, caterers, hotels | Orders, often against a purchase order | 15-30 days credit, GST invoice |
| Own stores | 3 | Stock transfer from the factory; sold over the counter at MRP | Cash / UPI; cash deposited in the bank |

Products (18):

| # | Item | Pack | GST | Best before |
|---|---|---|---|---|
| 1 | Sandwich bread | 400 g | Nil | 4 days |
| 2 | Brown bread | 400 g | Nil | 4 days |
| 3 | Jumbo sandwich loaf | 800 g | Nil | 4 days |
| 4 | Ladi pav | 12 pieces | Nil | 3 days |
| 5 | Burger bun, plain | 4 pieces | Nil | 4 days |
| 6 | Burger bun, sesame | 4 pieces | Nil | 4 days |
| 7 | Burger bun, whole wheat | 4 pieces | Nil | 4 days |
| 8 | Burger bun, jumbo | 4 pieces, large | Nil | 4 days |
| 9 | Pizza base | 2 pieces | Nil | 5 days |
| 10 | Elaichi toast | 250 g | 5% | 90 days |
| 11 | Milk toast | 400 g | 5% | 90 days |
| 12 | Butter khari | 200 g | 5% | 90 days |
| 13 | Jeera khari | 200 g | 5% | 90 days |
| 14 | Jeera biscuit | 250 g | 5% | 60 days |
| 15 | Tea cake | 200 g | 5% | 15 days |
| 16 | Veg puff | piece | 5% | 1 day |
| 17 | Paneer puff | piece | 5% | 1 day |
| 18 | Garlic puff | piece | 5% | 1 day |

The four burger buns share one dough and the three puffs share one pastry; they differ by topping,
flour blend, size or filling.

Materials: about 30 raw and packing items (maida, atta, sugar, bakery shortening, margarine, butter,
oil, yeast, salt, milk powder, improver, preservative, spices, sesame seeds, tutti-frutti; potato,
peas, paneer and garlic for the puff fillings; bread bags, pouches, boxes, labels) from about 18
vendors. Gas, electricity, rent and diesel are expenses, not stock.

Prices, recipes, yields, wages and the event calendar are set in `docs/RESEARCH.md`.

## 4. Scope by area

Each area lists what a user can **do** and what that **moves**. If it is not listed here it is not in
the sample.

### 4.1 Masters

- Items: finished goods and materials - unit, pack, GST rate, HSN, best-before days, reorder level.
- Recipes: per mix, the materials and quantities, the packing per unit and the expected number of units.
- Price lists: MRP (GST included, as printed on the pack), retailer price and corporate price (before
  GST).
- Customers (channel, route, standing order, credit days, credit limit, GSTIN), vendors (GSTIN, payment
  terms), locations, expense categories.
- Add and edit with a change history; deactivate, never delete. A change applies to new documents only -
  posted documents keep the values they were posted with.
- **Opening entries, dated 1 January 2026** (in the seed only; there is no form): opening stock per
  location - materials with a quantity and an opening rate, which counts as the first purchase price;
  finished goods as opening batches with manufacturing date and best-before. One opening invoice per
  customer and one opening bill per vendor, each with a due date, so receipts, payments, statements and
  ageing treat them like any other. An opening balance for factory cash, each store's cash and the bank.

### 4.2 Buy - purchases and payables

- **Purchase order**: vendor, items, quantity, rate, expected date.
  `Submitted -> Approved -> Part received -> Received`, or `Rejected` / `Cancelled`.
  Up to Rs 50,000 an order is approved as it is submitted, and logged as such; above that it waits for
  the owner.
- **Goods receipt** against an approved order: quantity received and rejected, at the order's rate; part
  receipts allowed. Posting the receipt sets the item's latest purchase price to that rate.
- **Vendor bill** against one or more receipts, with a three-way check (order rate and quantity,
  received quantity, billed quantity and rate). A bill more than 2% away from its order and receipts is
  held for the owner. GST on the bill is shown separately and treated as input credit; an item's cost
  is its rate before GST. The bill does not change the purchase price.
- **Payment** against bills, in part or in full, from factory cash or the bank.

Moves: raw stock; the item's latest purchase price and so the cost of every product that uses it;
payables and their ageing; cash and bank; the purchase register.

### 4.3 Make - production

- **Production entry** per product per day: number of mixes, good units produced, rejected units.
- The system consumes materials at recipe quantities for those mixes, and packing for the good units.
  It refuses, naming the material, if stock is short.
- It creates a **finished-goods batch** with batch number, manufacturing date and best-before.
- **Yield**: good units against the recipe's expected units. The shortfall, at recipe cost, is the
  production loss.
- Daily rhythm: what is produced on one day is dispatched and sent to the stores the next morning.

Moves: raw stock down; finished stock up, by batch; the production register; yield; production loss in
the P&L.

### 4.4 Stock

- Stock by location: factory raw store, factory finished store, each own store.
- **Movement ledger**: every receipt, consumption, production, dispatch, transfer, adjustment and
  write-off is a row. Rows are never edited.
- **Stock count and adjustment** with a reason; waits for the owner.
- **Low-stock list** against the reorder level. An alert only: raising the purchase requirement
  automatically is an iNeo feature and appears as a teaser.
- Finished goods by batch: near-expiry and expired flags. Batches past their best-before are never
  dispatched. **Write-off request** for expired or damaged stock - raised by purchase and stores at the
  factory, by the store manager at a store - waits for the owner; the stock leaves on approval.
- Value: materials at latest purchase price, finished goods at recipe cost.

### 4.5 Sell - three channels, and receivables

- **Retail outlets**: a daily dispatch sheet per route, prefilled from each outlet's standing order.
  Change quantities, post. One invoice per outlet; stock leaves oldest unexpired batch first; cash is
  collected into factory cash or the amount is added to the outlet's balance. A sheet cannot post more
  than the unexpired stock on hand: the form shows what is available and offers to cut to it. A posted
  sheet is cancelled in one action: every invoice of it or none, with one reason, after which the sheet
  can be posted again.
- **Stale returns** are entered at the next visit and become a credit note, which reduces the outlet's
  balance and sales. The returned stock is destroyed, not restocked; its cost stays in cost of goods
  sold, where it was posted. Returns up to 8% of an outlet's supply in the last seven days post at
  once; above that the credit note waits for the owner.
- **Corporates**: order, then delivery with an invoice on credit terms, then receipt against invoices.
  A warning when the credit limit is exceeded.
- **Own stores**: transfer from the factory (a stock movement, not a sale), the store confirms receipt,
  then a **day-end entry**: units sold per item, cash counted, UPI total, unsold expired units. Store
  sales are units sold x MRP, reported before GST. The UPI total is credited to the bank and the cash
  to that store's cash; a difference between cash + UPI and units sold x MRP is posted as "store cash
  short or excess". Sales and cash post at once; the expired units become a write-off request.
- **Cash deposit**: moves an amount from factory cash or a store's cash to the bank, with a slip
  reference. It is a transfer between cash points, not income or expense.
- **Receipts**: against invoices, part payments, on account; customer statement; ageing.
- Printable invoice and delivery challan (the browser's print). The printed title is "Tax invoice" when
  every line is taxable, "Bill of supply" when every line is Nil-rated, and "Invoice-cum-bill of
  supply" when it has both.
- GST: rate and HSN per item; CGST + SGST on taxable lines; a GST summary report. Nothing is filed.

Moves: finished stock by batch; sales by channel, route, customer and item; receivables; cash and bank;
product margin.

### 4.6 Expenses

- **Expense claim** by any persona: category, location (factory or a store), amount, date, bill
  reference. `Submitted -> Approved -> Paid`, or `Rejected` with a reason. An approved claim stays on a
  "claims to reimburse" list until accounts pays it from cash or bank.
- **Expense bills** to vendors - rent, electricity, gas, diesel, repairs - go through the same approval
  and land in payables.
- **Salary bill**: on the last day of each month accounts raises one bill from the directory, one line
  per location, each the total monthly salary of the employees active on that day. The owner approves
  it and accounts pays it from the bank.
- Spend by category and by location for any period: the Tier 1 sheet's "how much did each branch spend
  this month?" and "which expenses are pending approval?".

### 4.7 People

- **Employee directory**: add and edit - department, designation, location, date of joining, contact,
  monthly salary (visible to the owner and accounts only), status.
- Headcount and monthly salary cost by department and by location.
- No attendance, leave or payroll.

### 4.8 Management accounts

- **Receivables**: outstanding by customer, ageing, overdue. Opening invoices count like any other.
- **Payables**: by vendor, ageing, due this week; approved claims waiting to be reimbursed.
- **Cash and bank book**: every receipt, payment and deposit, with a running balance (factory cash,
  each store's cash, one bank account).
- **Monthly P&L** since go-live: sales by channel, net of credit notes and before GST; material cost
  (recipe cost of goods sold; production loss; write-offs; count differences); gross margin; expenses
  by category, including salaries; operating profit.
- **Product margin** by item and by channel.

### 4.9 Control

- **Role switcher** with six personas (section 8). Each sees and can do only what the role allows; the
  store manager sees one store. The Owner can do everything.
- **Approvals**: purchase order above the limit, a bill that fails the three-way check, expenses, the
  salary bill, stock adjustment, write-off, returns above the threshold. Except for the Owner, the
  person who raised a document cannot approve it. An approval the Owner gives to the Owner's own
  document is logged as such.
- **Posted documents are never edited or deleted.** They are cancelled with a reason, and the
  cancellation is itself a document, dated the day it is made, with equal and opposite rows at the
  cost the original carried.
- **Cancelling**: whoever may post a document may cancel it, and so may the Owner. A document can be
  cancelled only while nothing rests on it: an order with no receipt; a receipt not yet billed and
  whose quantity is still in stock; a bill or invoice with no payment, receipt or credit note against
  it; a production entry whose batch is untouched; a transfer the store has not confirmed; a payment,
  receipt or deposit at any time. Otherwise the cancellation is refused, naming the document that must
  be cancelled first.
- **Back-dating** is a right, not a habit: operators up to three days, accounts and the Owner to any
  date in an open month, nobody into a locked month or the future. Every month before the previous one
  is locked. A back-dated document carries its own date in every report but is posted now: it is
  checked against the stock on hand now and never changes documents already posted.
- **Warnings**: the system warns, without blocking, when a figure looks wrong (decision 18): good units
  far from what the recipe expects, a count far from the books, an invoice above its order, a receipt
  above everything the customer owes, a claim well above the usual, an order rate far from the latest
  purchase price, a day-end whose cash and UPI are far from its sales. The form shows the warning beside
  the figure before posting, the entry can still be posted, and its audit entry says that it was entered
  with a warning. The history is never warned about.
- **Audit log**: who, in which role, when, what, before and after.
- **Notification log**: the emails Neo ERP would send (approval requests, overdue receivables, bills
  falling due, low stock, near-expiry), labelled "simulated in this sample - Neo ERP sends these by
  email". Nothing is sent.

### 4.10 Dashboard and reports

Standard MIS, not analytics.

- **Dashboard**: today and month to date - sales by channel, collections, production, cash and bank;
  lists of pending approvals, low stock, near-expiry stock, overdue receivables and bills due this
  week; spend this month by location.
- **Today's work**: dispatch sheets to post, store transfers to send and to confirm, purchase orders
  due for receipt today, production to record, store day-ends pending, approvals waiting. History runs
  to the day before the business date; the business date is the user's to run.
- **Reports**, each with a date range and CSV export: sales register; sales by item, customer, route
  and channel; returns; production register with yield; stock statement; stock ledger; expiry;
  purchase register and order status; receivables ageing; payables ageing; cash and bank book; expenses
  by category and location; product cost and margin; monthly P&L; GST summary; audit log.
- Month-wise totals since go-live are in. Comparison and trend dashboards are an iNeo teaser.

### 4.11 Guide and reset

- **"Try this"**: six to eight short journeys as a checklist that ticks itself, for example "raise a
  flour order at a higher rate, receive it, and watch the bread cost and margin move".
- **Reset** to a fresh copy dated today.

### 4.12 Upgrade teasers

One "What the higher tiers add" page, and a small locked card - one line, no fake data - where a
prospect would look for the feature:

| Where | Card | Tier |
|---|---|---|
| Expenses | Budget against actual | iNeo |
| Low-stock list | Purchase requirement raised automatically | iNeo |
| Vendor and customer forms | GSTIN verification | iNeo |
| Cash and bank | Bank feed and reconciliation; Tally or Zoho Books sync | iNeo |
| Reports | Month-on-month and year-on-year dashboards | iNeo |
| Dashboard | Sales forecast with suggested production; 30/60/90-day cash projection | NeoX |
| People | Attendance and leave; tasks | Neo ERP - in the tier, not shown in this sample |

The last row matters: tasks, attendance and leave are part of Tier 1 but not of this sample, and a
prospect must not conclude that Neo ERP lacks them.

## 5. Out of scope

Tasks. Attendance, leave, payroll. Chart of accounts, journals, trial balance, balance sheet. Budgets.
Forecasting. Any integration (bank, Tally, GST portal, POS, WhatsApp). Sending real email: Neo ERP does
send notification emails, the sample only logs them. E-invoice, e-way bill, GST returns, input-credit
reversal for exempt supplies (all input GST is treated as credit), TDS. Fixed assets. Raw-material lot
traceability and recall. Route optimisation. Crate tracking. Counter billing at the stores. More than
one company. Phone layouts. Real user accounts (a single sign-in at the door, as on the Miya Kebabs
preview, is hosting, not a feature). Any language but English.

## 6. Costing (decision 6: the simplest method)

- A material's cost is its **latest purchase price**: the rate on its most recently posted goods
  receipt (the opening rate until the first one), before GST.
- A product's cost is **recipe quantities x those prices, divided by the recipe's expected units, plus
  packing per unit**.
- When an invoice or a store day-end is posted, the cost of each line is **fixed at that moment**. A new
  flour price changes the cost and margin of what is sold from then on; it never rewrites last month.
- Labour, gas, power and rent are P&L lines. They are not spread over products.
- What the method does not do: it does not track what a batch really consumed. Extra usage shows up
  only as production loss (fewer good units than the recipe expects) or as a stock-count difference.
  Stock on hand is always shown at today's cost; a price change revalues it without a P&L entry.
- Precision: amounts are held in paise as whole numbers; rates and unit costs may carry fractions of a
  paisa. Each line's value, cost and each tax amount (CGST and SGST separately) is rounded to the paisa
  once, when the document is posted, and stored on the line; every total, register and P&L figure is
  the sum of those stored values. Invoices are not rounded to the rupee.

Because each document carries its own cost, a moving average could replace "latest price" later without
touching anything else.

## 7. How the data works

- **Static site**: plain HTML, CSS and JavaScript. No server-side data, no build step. It starts from a
  copy of the Miya Kebabs shell - router, UI kit, chart wrapper, design tokens - under its own namespace
  and accent, and changes it. New: the business-date calendar; personas, rights and navigation for this
  sample; a full-page document form with an editable line grid and decimal quantity, rate and amount
  inputs, whose draft survives a redraw; a print stylesheet that prints only the open invoice or
  challan.
- **One posting engine.** A document is posted by one function that writes its stock movements, its
  receivable or payable and its cash entry, and keeps running balances. The seed generator and the forms
  call the same function; role, approval, back-date and input checks wrap that core for entries made by
  a user. Every balance and report is computed from the documents. That is what makes a typed entry
  move the dashboard.
- **Business date.** On first open the sample reads the browser's local calendar date once and stores
  it. That date is "today" for this copy from then on: date defaults, ageing, expiry flags, back-dating
  limits and "today's work" are computed against it, and the top bar shows it. Nothing ages or expires
  while the copy sits unused.
- **Coming back later**: if the calendar date is later than the business date, a banner says so and
  offers a fresh copy dated today in one click; taking it discards the user's entries exactly as Reset
  does. Until then the copy is exactly as it was left.
- **Seed**: a deterministic, day-by-day simulation of the business from 1 Jan 2026 to the day before the
  business date, rebuilt in memory on every load. It is never stored and never altered. It ends with
  yesterday's production in the finished store - enough to post every one of today's dispatch sheets and
  store transfers as prefilled - and with raw material for at least three normal days. Every parameter
  is a rule that holds for any business date up to 31 December 2027.
- **Local storage** holds: the business date; a seed version; preferences; and one append-only, numbered
  log of everything the user did - each document as entered, each action on an existing document
  (approve, reject, cancel, confirm), each master change - with who, in which role and when. On every
  load the seed is rebuilt, then the log is replayed in its original order through the same posting
  function, so a reload gives exactly the figures the user left. The seed version is bumped whenever the
  generator or a parameter changes; a copy saved under another version is replaced by a fresh one, with
  a notice. A few hundred kilobytes at most, against a browser limit of about 5 MB. If local storage is
  unavailable or a write fails, a banner says that changes will not survive a reload.
- **Self-check** in Node, run after any change to the data layer, in three parts. (a) A hand-worked
  case: a tiny company and about a dozen documents - one of each type, with a part receipt, a stale
  return, a write-off, a cancellation and a back-dated entry - whose expected stock, batch, unit cost,
  GST, receivable, payable, cash and P&L figures are typed into the check by hand. (b) On the full seed,
  recomputed by a separate straight pass over the raw documents: the movement ledger sums to the stock
  balances and never goes negative in posting order; receivables equal opening invoices plus invoices
  less receipts less credit notes; payables likewise; the cash book balances; every P&L line equals the
  documents behind it; two runs give identical results; the seed for one business date is the beginning
  of the seed for a later one. (c) Behaviour: every "try this" journey run through the functions the
  forms call, as each persona allowed and refused for one that is not; each refusal (short stock, own
  approval, locked month, back-date limit, cancel with dependants); post then cancel returns every
  figure to its earlier value; save, rebuild and replay gives identical figures; reset gives the fresh
  seed.

## 8. Personas and approvals

| Persona | Sees | Does |
|---|---|---|
| Owner | Everything | Everything any other persona can do, and every approval - including of the Owner's own entries |
| Accounts and admin | Everything | Vendor bills, payments, receipts, cash deposits, expense bills, the monthly salary bill, claim reimbursements, employee directory, masters, expense claims |
| Purchase and stores | Factory stock, vendors | Purchase orders, goods receipts, stock counts, write-off requests at the factory, transfers to stores, expense claims |
| Production supervisor | Recipes, raw and finished stock | Production entries, expense claims |
| Sales and dispatch | Customers, finished stock | Dispatch sheets, corporate orders and invoices, returns, collections, expense claims |
| Store manager (one store) | That store only | Confirms transfers, day-end entry, store cash deposit, write-off requests, expense claims |

Limits:

- A purchase order up to Rs 50,000 is approved as it is submitted; above that it waits for the Owner.
- Every expense claim, expense bill, salary bill, stock adjustment and write-off request waits for the
  Owner.
- A bill more than 2% away from its order and receipts is held for the Owner.
- Stale returns up to 8% of an outlet's supply in the last seven days post at once; above that the
  credit note waits for the Owner.

## 9. Definition of done

- Every journey in section 4 works end to end for a new record, for each persona allowed to do it.
- Every figure that should move does, without a reload; a reload keeps it; reset removes it.
- History starts on 1 Jan 2026. The load time is accepted as built (decision 14): about one second for a
  copy opened in 2026, and over two seconds from about April 2027, because the whole history is rebuilt
  on every load. Revisit if the sample is still in use then.
- The self-check passes.
- No figure on any screen is typed into page code.
- Nothing from section 5 appears, except as a teaser from section 4.12.

## 10. Build order

1. Foundation: shell, document form with line grid, print stylesheet, store, business date, posting
   engine, masters, seed, self-check.
2. Buy: orders, receipts, bills, payments.
3. Make: production, batches, yield.
4. Sell: the three channels, receipts, returns.
5. Costing, P&L, expenses, people.
6. Dashboard, reports, guide, teasers; hosting.

## 11. Research notes

Checked on 2 October 2026; the binding figures are in `docs/RESEARCH.md`.

- **GST**: bread is exempt, and ladi pav and plain burger buns are bread for this purpose. Pizza bread
  (pizza base) moved from 5% to Nil on 22 September 2025. Rusks and toast (HSN 1905 40 00) were already
  at 5% and stay there. Khari, biscuits, tea cake and puffs (other HSN 1905) fell from 18% to 5% on
  22 September 2025. The whole seed period is after that date, so each item has one rate throughout.
  [busy.in](https://busy.in/gst-rates/bakery-products/)
- **Returns**: in India, bread returns of more than 10% of dispatches are described as common
  ([aibma.com](https://aibma.com/industry.html)); 3-5% of sales is a United States benchmark for a
  well-run route ([thefulltruck.com](https://thefulltruck.com/categories/bread-bakery-routes)). Happy
  Bakers is seeded as a well-run operation, about 5% on the fresh lines, so the 8% limit is breached
  only occasionally.
- **Trade terms**: retailer margin about 20% of MRP
  ([storewise.in](https://storewise.in/blog/fmcg-distribution-margins-and-sales-structure)); cash on
  delivery or weekly credit for outlets is an assumption.
- **Shelf life**: sandwich bread 3-5 days; pav 2-3 days; burger buns 3-4 days; rusk and toast 2-4
  months ([successmarketingkota.com](https://successmarketingkota.com/blog/bread-packaging-for-bakeries.html)).
- **Wages**: Gujarat minimum wages, Zone I, 1 April - 30 September 2026: Rs 13,325 unskilled, Rs 13,585
  semi-skilled, Rs 13,897 skilled a month
  ([sgcms.com](https://www.sgcms.com/regulatory-updates/minimum-rate-of-wages-gujarat-april-2026/)).
- **Materials**: bakery maida about Rs 36-42 a kg in 50 kg bags
  ([hyperpure.com](https://www.hyperpure.com/in/royal-bakery-maida-50-kg-bag)); sugar about Rs 51-57 a
  kg wholesale ([commodityonline.com](https://www.commodityonline.com/mandiprices/sugar)).
- **Gujarat retail prices** for reference: plain khari 400 g Rs 145; sandwich bread 400 g Rs 60, a
  premium brand ([atulbakery.com](https://store.atulbakery.com/products/plain-khari-400g)).
- **Tier definitions**: `Neo_ERP_iNeo_NeoX_Offerings.docx`.
