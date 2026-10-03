# Research digest and binding parameters - Happy Bakers

Distilled on 2 October 2026 from five researched and re-checked files in `docs/research-raw/`
(`products-prices.md`, `recipes-yields.md`, `materials-vendors.md`, `people-overheads.md`,
`calendar-geography.md`; they hold the source URLs) against `docs/SCOPE.md` v0.3. This file is the one
the master data (`HB.config`) and the day-by-day simulation (`HB.seed`) are written from; the raw files
need not be opened. Where a raw file and this file differ, this file wins; section 11.7 lists every
figure that was changed and why.

Conventions.

- Happy Bakers is fictional. Every customer, vendor and employee name is invented. Every GSTIN is
  synthetic with a correct check character and must not be shown as a real registration.
- **(A)** marks an assumption: the public record is silent and a sensible value was chosen. Every demand
  multiplier, every lead time, every credit term and every seeded exception is (A) even where the mark
  is not repeated on each row.
- Money is in rupees; `config.js` holds paise. A price or amount is **before GST** unless it is called
  MRP, which includes GST.
- Every parameter is a **rule that holds for any date from 1 January 2026 to 31 December 2027**. Nothing
  depends on where the simulation ends. A random draw is always "from the seeded stream keyed on the
  date and the entity", so that the history to any day is the beginning of the history to a later day.
- **Stochastic round** = round down, then add 1 with probability equal to the fraction.
- Tune parameters, never outputs: if a calibration band of section 13 fails, change a figure here.

Codes used in every table.

| Thing | Code | Note |
|---|---|---|
| Finished goods | FG01 - FG18 | the item `code`; each also has a short key (SB, BB ...) used in column headings |
| Raw materials | RM01 - RM24 | |
| Packing materials | PM01 - PM08 | |
| Retail outlets | O01 - O40 | |
| Corporates | C01 - C10 | |
| Own stores | S1, S2, S3 | unit and location ids `st_anand`, `st_vvn`, `st_nadiad` in `docs/SPEC.md` |
| Routes | R1 - R4 | |
| Stock vendors | VM01 - VM13 | |
| Expense vendors | VE01 - VE24 | |
| Staff vendor | VS01 | the one vendor of kind `staff`, payee of every salary bill |
| Employees | E001 - E038 | |
| Events | E01 - E32 | |
| Product groups | BR, BN, DRY, PF | bread and pav; buns and pizza base; toast, khari, biscuit and cake; puffs |
| Dates | ISO `YYYY-MM-DD`; a range `a..b` includes both ends | weekdays in rules: Sun = 0 ... Sat = 6 |

---

## 1. Company, locations, routes, own stores

### 1.1 Company

| Field | Value |
|---|---|
| Name | Happy Bakers |
| Legal name | Happy Bakers (proprietor: Nilesh Patel) (A) |
| Business | All-vegetarian, eggless bakery factory with four van routes and three own stores |
| Address | Plot 214, GIDC Vitthal Udyognagar, Anand-Sojitra Road, Anand 388121, Gujarat (the plot number is invented) |
| State code | 24 (every sale and purchase is inside Gujarat: CGST + SGST, never IGST) |
| GSTIN | 24AFNPP5274H1Z3 (synthetic) |
| Bank | one current account, shown as "Bank current account" (no bank is named) |
| Go-live on Neo ERP | 2026-01-01, with opening balances only (section 10) |
| Size | about Rs 4 crore a year, 35 employees on go-live |
| Invoice HSN | the 4-digit heading (turnover under Rs 5 crore) |

### 1.2 Units, stock locations and cash points

| Unit id | Short id | Name | Kind | Stock locations | Cash account | Address | Hours |
|---|---|---|---|---|---|---|---|
| factory | - | Factory | factory | fac_rm (raw material store); fac_fg (finished goods store) | cash_factory | as 1.1 | bakes every day except factory holidays (7.4) |
| st_anand | S1 | Happy Bakers - Anand | store | st_anand; transit_st_anand | cash_st_anand | Town Hall Road, near Vivekanand Wadi, Anand 388001 | 07:30 - 21:00, seven days |
| st_vvn | S2 | Happy Bakers - Vidyanagar | store | st_vvn; transit_st_vvn | cash_st_vvn | Nana Bazar, near Shastri Maidan, Vallabh Vidyanagar 388120 | 08:00 - 21:00, seven days |
| st_nadiad | S3 | Happy Bakers - Nadiad | store | st_nadiad; transit_st_nadiad | cash_st_nadiad | Paras Circle, Santram Road, Nadiad 387001 | 07:30 - 20:30, seven days |

One bank account, id `bank`. The stores are shut only on the closed days of 7.4.

Store characters (the data must show them): **S1** is the family store - bread, pav and dry bakery
lead, busiest on Sunday and in the first week of the month. **S2** is the student store - puffs are
over 40% of its sales, buns, pizza base and tea cake are strong, bread is weak, and it falls at
weekends and in college vacations. **S3** is a small town-centre counter, half the size of S1.

### 1.3 Vehicles and runs

Five owned mini-trucks (A). All four route vans leave at 05:30; V5 leaves at 06:00. Loading starts at
04:45. Service time (A): 6 minutes at an outlet, 8 at a corporate, 12 at a store.

| Vehicle | Run | Driver | Leaves | Back | Delivery km | Drops | Weekly collection day |
|---|---|---|---|---|---|---|---|
| V1 | R1 Anand town | E022 | 05:30 | 08:00 | 27.1 | 13 outlets | Monday |
| V2 | R2 Vidyanagar-Karamsad | E023 | 05:30 | 07:34 | 23.2 | 11 outlets | Tuesday |
| V3 | R3 Nadiad | E024 | 05:30 | 08:34 | 60.3 | 9 outlets, store S3, corporate C07 | Wednesday |
| V4 | R4 Borsad-Petlad | E025 to 2026-07-31, then E038 | 05:30 | 08:00 | 66.0 | 7 outlets | Thursday |
| V5 | stores S1 and S2 and nine corporates | E026 | 06:00 | 08:47 | 28.3 | 2 stores, 9 corporates | - |

Delivery runs total 204.9 km a day; with other running (second drops, collection round, market, bank)
the vehicles do 285 km and burn **19.0 litres of diesel a day** (A), nothing on a closed day.
V5 timetable: C01 06:02, C05 06:17, C04 06:26, S2 06:44, S1 07:05, C08 07:22, C06 07:37, C09 07:54,
C02 08:11, C03 08:23, C10 08:33. Store S3's transfer arrives at 06:22 and C07's order at 07:31 on the
R3 van. Document clock: dispatch invoices 05:30, store transfers 06:00, store confirmation 07:30,
day-end 21:00 (S3 20:30).

---

## 2. Products

### 2.1 Item master (finished goods)

The unit of sale and stock is the pack for FG01-FG15 and the piece for FG16-FG18. Best before is counted
from the manufacturing date; a batch may be dispatched and sold up to and including its best-before
date, so a puff made on day D is sold on D+1 only. Net weights and piece counts are (A). The 8-digit
tariff item is a reading of the tariff (A); the invoice prints the 4-digit heading 1905.

| Code | Key | Name | Pack | Net weight (g) | Pieces per pack | Group | HSN | Tariff item | GST % | Best before (days) |
|---|---|---|---|---|---|---|---|---|---|---|
| FG01 | SB | Sandwich bread | 400 g loaf, sliced | 400 | 1 | BR | 1905 | 19059090 | 0 | 4 |
| FG02 | BB | Brown bread | 400 g loaf, sliced | 400 | 1 | BR | 1905 | 19059090 | 0 | 4 |
| FG03 | JL | Jumbo sandwich loaf | 800 g loaf, large slice | 800 | 1 | BR | 1905 | 19059090 | 0 | 4 |
| FG04 | LP | Ladi pav | 12 pieces | 400 | 12 | BR | 1905 | 19059090 | 0 | 3 |
| FG05 | BNP | Burger bun, plain | 4 pieces | 200 | 4 | BN | 1905 | 19059090 | 0 | 4 |
| FG06 | BNS | Burger bun, sesame | 4 pieces | 200 | 4 | BN | 1905 | 19059090 | 0 | 4 |
| FG07 | BNW | Burger bun, whole wheat | 4 pieces | 200 | 4 | BN | 1905 | 19059090 | 0 | 4 |
| FG08 | BNJ | Burger bun, jumbo | 4 pieces, large | 300 | 4 | BN | 1905 | 19059090 | 0 | 4 |
| FG09 | PZ | Pizza base | 2 pieces, 7 inch | 200 | 2 | BN | 1905 | 19059090 | 0 | 5 |
| FG10 | TE | Elaichi toast | 250 g pouch | 250 | 20 | DRY | 1905 | 19054000 | 5 | 90 |
| FG11 | TM | Milk toast | 400 g pouch | 400 | 28 | DRY | 1905 | 19054000 | 5 | 90 |
| FG12 | KB | Butter khari | 200 g pouch | 200 | 22 | DRY | 1905 | 19059090 | 5 | 90 |
| FG13 | KJ | Jeera khari | 200 g pouch | 200 | 22 | DRY | 1905 | 19059090 | 5 | 90 |
| FG14 | JB | Jeera biscuit | 250 g pouch | 250 | 30 | DRY | 1905 | 19059020 | 5 | 60 |
| FG15 | TC | Tea cake (tutti-frutti) | 200 g bar | 200 | 1 | DRY | 1905 | 19059010 | 5 | 15 |
| FG16 | PV | Veg puff | piece | 70 | 1 | PF | 1905 | 19059010 | 5 | 1 |
| FG17 | PP | Paneer puff | piece | 70 | 1 | PF | 1905 | 19059010 | 5 | 1 |
| FG18 | PG | Garlic puff | piece | 70 | 1 | PF | 1905 | 19059010 | 5 | 1 |

GST basis: bread, pav and buns are "bread" (Nil); pizza base is "pizza bread" (Nil since 22 September
2025); toast, khari, biscuit, cake and puffs are 5% since that date. The whole period is after it, so
each item has one rate throughout. A 5% line carries CGST 2.5% + SGST 2.5%.

### 2.2 Who buys what (A)

1 = sold in that channel, 0 = not. The outlet columns say which outlet types carry the item on a
standing order (P provision store, D dairy parlour, T tea stall, B bakery counter, G general store).
A retailer price exists for every item so that a user can add any item to a dispatch sheet.

| Code | Key | P | D | T | B | G | Corporates | Own stores |
|---|---|---|---|---|---|---|---|---|
| FG01 | SB | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| FG02 | BB | 1 | 1 | 0 | 1 | 1 | 1 | 1 |
| FG03 | JL | 0 | 0 | 0 | 0 | 0 | 1 | 1 |
| FG04 | LP | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| FG05 | BNP | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| FG06 | BNS | 0 | 0 | 0 | 1 | 1 | 1 | 1 |
| FG07 | BNW | 0 | 0 | 0 | 1 | 1 | 1 | 1 |
| FG08 | BNJ | 0 | 0 | 0 | 0 | 0 | 1 | 1 |
| FG09 | PZ | 1 | 1 | 0 | 1 | 1 | 1 | 1 |
| FG10 | TE | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| FG11 | TM | 1 | 1 | 0 | 1 | 1 | 1 | 1 |
| FG12 | KB | 1 | 1 | 1 | 1 | 1 | 0 | 1 |
| FG13 | KJ | 1 | 0 | 1 | 1 | 1 | 0 | 1 |
| FG14 | JB | 1 | 0 | 0 | 1 | 1 | 1 | 1 |
| FG15 | TC | 1 | 1 | 0 | 1 | 1 | 1 | 1 |
| FG16 | PV | 0 | 0 | 0 | 0 | 0 | 1 | 1 |
| FG17 | PP | 0 | 0 | 0 | 0 | 0 | 1 | 1 |
| FG18 | PG | 0 | 0 | 0 | 0 | 0 | 1 | 1 |

Puffs have a one-day life and are not sent on the routes.

### 2.3 Price list in force from 2026-01-01 (opening list)

MRP includes GST and is printed on the pack. Retailer and corporate prices are before GST. "Retailer
pays" adds GST. Own stores sell at MRP; store sales are reported before GST, so the store realisation is
MRP for Nil items and MRP / 1.05 for 5% items (the engine works it out line by line; the column is for
checking). Positioning (A): at or just under the national bread brand, well under the premium Gujarat
chain; retailer margin 18.8-20.8% of MRP; corporate price 4-8% under the retailer price.

| Code | Key | MRP | Retailer price | Retailer pays | Retailer margin on MRP | Corporate price | Store realisation |
|---|---|---|---|---|---|---|---|
| FG01 | SB | 38 | 30.50 | 30.50 | 19.7% | 28.50 | 38.00 |
| FG02 | BB | 44 | 35.00 | 35.00 | 20.5% | 33.00 | 44.00 |
| FG03 | JL | 68 | 55.00 | 55.00 | 19.1% | 50.50 | 68.00 |
| FG04 | LP | 36 | 29.00 | 29.00 | 19.4% | 27.00 | 36.00 |
| FG05 | BNP | 31 | 25.00 | 25.00 | 19.4% | 23.50 | 31.00 |
| FG06 | BNS | 35 | 28.00 | 28.00 | 20.0% | 26.00 | 35.00 |
| FG07 | BNW | 38 | 30.50 | 30.50 | 19.7% | 28.50 | 38.00 |
| FG08 | BNJ | 47 | 38.00 | 38.00 | 19.1% | 35.00 | 47.00 |
| FG09 | PZ | 27 | 21.50 | 21.50 | 20.4% | 20.00 | 27.00 |
| FG10 | TE | 55 | 41.50 | 43.58 | 20.8% | 39.50 | 52.38 |
| FG11 | TM | 90 | 68.00 | 71.40 | 20.7% | 65.00 | 85.71 |
| FG12 | KB | 70 | 53.00 | 55.65 | 20.5% | 51.00 | 66.67 |
| FG13 | KJ | 65 | 49.00 | 51.45 | 20.8% | 47.00 | 61.90 |
| FG14 | JB | 75 | 57.00 | 59.85 | 20.2% | 54.50 | 71.43 |
| FG15 | TC | 55 | 42.00 | 44.10 | 19.8% | 39.50 | 52.38 |
| FG16 | PV | 15 | 11.50 | 12.08 | 19.5% | 11.00 | 14.29 |
| FG17 | PP | 25 | 19.00 | 19.95 | 20.2% | 18.00 | 23.81 |
| FG18 | PG | 20 | 15.25 | 16.01 | 19.9% | 14.50 | 19.05 |

### 2.4 List-price revisions (A)

Two revisions. Each is a dated master change: a new price applies to every document **dated on or after
the date**; posted documents keep their prices; standing quantities do not change; a credit note for a
stale return uses the price on the invoice it reverses (the price in force on the dispatch date).
Rule used: MRP to the whole rupee, trade prices to Rs 0.50 (puffs Rs 0.25), retailer margin inside
18-22% of MRP.

**Revision 1 - 2026-07-01 - the nine Nil-rated lines, +5.6% to +7.9%.** Reason in the change history:
"flour, packaging and diesel". (The national bread brands went up Rs 5 a loaf in mid-May 2026.)

| Code | Key | MRP old | MRP new | Retailer old | Retailer new | Retailer margin on MRP | Corporate old | Corporate new | Store realisation new |
|---|---|---|---|---|---|---|---|---|---|
| FG01 | SB | 38 | 41 | 30.50 | 33.00 | 19.5% | 28.50 | 31.00 | 41.00 |
| FG02 | BB | 44 | 47 | 35.00 | 37.50 | 20.2% | 33.00 | 35.50 | 47.00 |
| FG03 | JL | 68 | 72 | 55.00 | 58.50 | 18.8% | 50.50 | 53.50 | 72.00 |
| FG04 | LP | 36 | 38 | 29.00 | 30.50 | 19.7% | 27.00 | 28.50 | 38.00 |
| FG05 | BNP | 31 | 33 | 25.00 | 26.50 | 19.7% | 23.50 | 25.00 | 33.00 |
| FG06 | BNS | 35 | 37 | 28.00 | 29.50 | 20.3% | 26.00 | 27.50 | 37.00 |
| FG07 | BNW | 38 | 41 | 30.50 | 33.00 | 19.5% | 28.50 | 31.00 | 41.00 |
| FG08 | BNJ | 47 | 50 | 38.00 | 40.50 | 19.0% | 35.00 | 37.00 | 50.00 |
| FG09 | PZ | 27 | 29 | 21.50 | 23.00 | 20.7% | 20.00 | 21.50 | 29.00 |

**Revision 2 - 2027-04-01 - the nine 5% lines, +5.6% to +10%.** Reason: "shortening, butter and
paneer". A copy opened before that date never sees it.

| Code | Key | MRP old | MRP new | Retailer old | Retailer new | Retailer margin on MRP | Corporate old | Corporate new | Store realisation new |
|---|---|---|---|---|---|---|---|---|---|
| FG10 | TE | 55 | 59 | 41.50 | 44.50 | 20.8% | 39.50 | 42.50 | 56.19 |
| FG11 | TM | 90 | 95 | 68.00 | 72.00 | 20.4% | 65.00 | 69.00 | 90.48 |
| FG12 | KB | 70 | 75 | 53.00 | 57.00 | 20.2% | 51.00 | 54.50 | 71.43 |
| FG13 | KJ | 65 | 70 | 49.00 | 53.00 | 20.5% | 47.00 | 50.50 | 66.67 |
| FG14 | JB | 75 | 80 | 57.00 | 61.00 | 19.9% | 54.50 | 58.00 | 76.19 |
| FG15 | TC | 55 | 59 | 42.00 | 45.00 | 19.9% | 39.50 | 42.50 | 56.19 |
| FG16 | PV | 15 | 16 | 11.50 | 12.25 | 19.6% | 11.00 | 11.75 | 15.24 |
| FG17 | PP | 25 | 27 | 19.00 | 20.50 | 20.3% | 18.00 | 19.50 | 25.71 |
| FG18 | PG | 20 | 22 | 15.25 | 16.75 | 20.1% | 14.50 | 16.00 | 20.95 |

Both revisions are entered by Accounts and admin (E002) on the morning of their date, one change row
per item, before the day's dispatch.

---

## 3. Recipes, yields and production rhythm

### 3.1 Conventions

- A **mix** is one mixer batch, defined by its flour weight. A recipe is the material list for one mix.
  The four burger buns share one dough and the three puffs one pastry, but each product has its own
  recipe row.
- Water is shown because it sets the dough weight; it is not a stock item. Gas and electricity are
  expenses. Yeast is compressed (fresh) yeast. Oil and flavour are stocked in litres.
- **T** = pieces per mix after normal handling loss. **E** = expected good units per mix = T less the
  normal reject, rounded down. E is the recipe's `expectedUnits`. Product cost = mix cost / E + packing
  per unit, so the normal reject is inside the cost and a normal day's yield is close to 100%.
- Packing is consumed for good units only. Rejects have no stock value and no document.
- Mixes are entered in steps of 0.5; the three puffs in steps of 0.25 (a quarter mix is 22 good puffs).
  Recipes are fixed: tuning never touches them.

### 3.2 Materials per mix

Quantity per mix in the stock unit of the material (kg; RM07 and RM18 in litres). 0 = not used.

| Material | FG01 | FG02 | FG03 | FG04 | FG05 | FG06 | FG07 | FG08 | FG09 | FG10 | FG11 | FG12 | FG13 | FG14 | FG15 | FG16 | FG17 | FG18 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| RM01 | 50 | 12.5 | 25 | 50 | 10 | 10 | 2.5 | 10 | 15 | 25 | 50 | 20 | 20 | 15 | 6 | 2.5 | 2.5 | 2.5 |
| RM02 | 0 | 12.5 | 0 | 0 | 0 | 0 | 7.5 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| RM03 | 2 | 1 | 1 | 3 | 1 | 1 | 1 | 1 | 0.45 | 7.5 | 12.5 | 0 | 0 | 2.7 | 5.1 | 0 | 0 | 0 |
| RM04 | 1 | 0.5 | 0.5 | 2 | 0.5 | 0.5 | 0.5 | 0.5 | 0 | 3 | 4 | 1 | 1 | 6 | 0 | 0.1 | 0.1 | 0.1 |
| RM05 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 10 | 13 | 0 | 0 | 1.375 | 1.375 | 1.375 |
| RM06 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 3 | 0 | 0.75 | 0.3 | 0 | 0 | 0.3 |
| RM07 | 0.25 | 0.15 | 0.15 | 0.5 | 0.1 | 0.1 | 0.1 | 0.1 | 0.6 | 0.15 | 0.3 | 0 | 0 | 0 | 2.1 | 0.15 | 0.15 | 0.05 |
| RM08 | 1.25 | 0.7 | 0.625 | 1.5 | 0.35 | 0.35 | 0.35 | 0.35 | 0.3 | 0.9 | 1.8 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| RM09 | 0.9 | 0.45 | 0.45 | 0.8 | 0.16 | 0.16 | 0.16 | 0.16 | 0.27 | 0.3 | 0.6 | 0.4 | 0.4 | 0.3 | 0 | 0.095 | 0.085 | 0.095 |
| RM10 | 0 | 0 | 0 | 0.5 | 0.2 | 0.2 | 0.2 | 0.2 | 0 | 0.5 | 3 | 0 | 0 | 0.3 | 0.72 | 0 | 0 | 0 |
| RM11 | 0.2 | 0.125 | 0.1 | 0.2 | 0.05 | 0.05 | 0.06 | 0.05 | 0.05 | 0.1 | 0.2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| RM12 | 0.15 | 0.075 | 0.075 | 0.1 | 0.03 | 0.03 | 0.03 | 0.03 | 0.05 | 0 | 0 | 0 | 0 | 0 | 0.03 | 0 | 0 | 0 |
| RM13 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.15 | 0.24 | 0 | 0 | 0 |
| RM14 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| RM15 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.3 | 0.375 | 0 | 0 | 0 | 0 |
| RM16 | 0 | 0 | 0 | 0 | 0 | 0.45 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| RM17 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1.2 | 0 | 0 | 0 |
| RM18 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.06 | 0 | 0 | 0 | 0.03 | 0 | 0 | 0 |
| RM19 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2.2 | 0.6 | 2.6 |
| RM20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.6 | 0.8 | 0.4 |
| RM21 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.6 | 0.4 | 0 |
| RM22 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1.5 | 0 |
| RM23 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.3 |
| RM24 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.12 | 0.12 | 0.08 |

### 3.3 Mix size, expected units and packing

| Code | Key | Mix label | Flour per mix (kg) | Water per mix (litre) | Pieces per mix T | Normal reject r | Drift a | Expected good units E | Packing per good unit | Mix step |
|---|---|---|---|---|---|---|---|---|---|---|
| FG01 | SB | 50 kg flour mix | 50 | 29.5 | 186 | 1.5% | 0.5% | 183 | 1 x PM01 + 1 x PM08 | 0.5 |
| FG02 | BB | 25 kg flour mix | 25 | 15.75 | 93 | 2% | 0.6% | 91 | 1 x PM01 + 1 x PM08 | 0.5 |
| FG03 | JL | 25 kg flour mix | 25 | 14.75 | 46 | 1.5% | 0.5% | 45 | 1 x PM02 + 1 x PM08 | 0.5 |
| FG04 | LP | 50 kg flour mix | 50 | 28.5 | 187 | 2% | 0.8% | 183 | 1 x PM03 + 1 x PM08 | 0.5 |
| FG05 | BNP | 10 kg flour mix | 10 | 5.5 | 76 | 2% | 0.8% | 74 | 1 x PM03 + 1 x PM08 | 0.5 |
| FG06 | BNS | 10 kg flour mix | 10 | 5.5 | 76 | 2% | 0.8% | 74 | 1 x PM03 + 1 x PM08 | 0.5 |
| FG07 | BNW | 10 kg flour mix | 10 | 6.1 | 78 | 2% | 0.8% | 76 | 1 x PM03 + 1 x PM08 | 0.5 |
| FG08 | BNJ | 10 kg flour mix | 10 | 5.5 | 50 | 2% | 0.8% | 49 | 1 x PM03 + 1 x PM08 | 0.5 |
| FG09 | PZ | 15 kg flour mix | 15 | 8.15 | 105 | 3% | 1% | 101 | 1 x PM03 + 1 x PM08 | 0.5 |
| FG10 | TE | 25 kg flour mix | 25 | 11.1 | 125 | 2% | 1.5% | 122 | 1 x PM04 + 1 x PM08 | 0.5 |
| FG11 | TM | 50 kg flour mix | 50 | 22.7 | 154 | 2% | 1.5% | 150 | 1 x PM05 + 1 x PM08 | 0.5 |
| FG12 | KB | 20 kg flour mix | 20 | 10 | 139 | 3% | 2% | 134 | 1 x PM05 + 1 x PM08 | 0.5 |
| FG13 | KJ | 20 kg flour mix | 20 | 10 | 141 | 3% | 2% | 136 | 1 x PM05 + 1 x PM08 | 0.5 |
| FG14 | JB | 15 kg flour mix | 15 | 2.1 | 92 | 2% | 1.2% | 90 | 1 x PM04 + 1 x PM08 | 0.5 |
| FG15 | TC | 6 kg flour mix | 6 | 5.1 | 89 | 3% | 1% | 86 | 1 x PM06 + 1 x PM08 | 0.5 |
| FG16 | PV | 2.5 kg flour mix | 2.5 | 1.3 | 92 | 3% | 1.5% | 89 | 1 x PM07 | 0.25 |
| FG17 | PP | 2.5 kg flour mix | 2.5 | 1.3 | 92 | 3% | 1.5% | 89 | 1 x PM07 | 0.25 |
| FG18 | PG | 2.5 kg flour mix | 2.5 | 1.3 | 92 | 3% | 1.5% | 89 | 1 x PM07 | 0.25 |

PM01 bread bag 400 g, PM02 bread bag 800 g, PM03 pav / bun bag, PM04 small pouch, PM05 large pouch,
PM06 cake pack, PM07 puff paper, PM08 date label. Real packing wastage (torn bags, misprints) is not in
the recipe; it shows at the month-end count (9.5).

### 3.4 Yield on a production entry

For `m` mixes of a product with T pieces per mix, normal reject `r` and drift `a` (table 3.3):

```
made      = T x m x (1 + u)          u uniform in [-a, +a]
rejected  = round( made x r x v )    v uniform in [0.5, 1.6]
good      = round(made) - rejected
expected  = E x m
yield     = good / expected
```

Mean yield is 99.9-100.7% by construction. Production loss is signed (a small gain on a good day), as
the build specification posts it.

Bad runs (A). Each is drawn per date and product; the reject rate drawn replaces `r x v`.

| Cause | Lines | Chance per entry, Mar-Jun | Jul-Sep | Oct-Feb | Effect |
|---|---|---|---|---|---|
| Heat: over-proofing | FG01-FG09, each product | 2% | 1% | 0.5% | reject rate uniform 6-12% |
| Heat: soft lamination fat | FG12, FG13, each run | 10% | 4% | 3% | reject rate uniform 8-15% |
| Heat: soft lamination fat | FG16-FG18, each product each day | 3% | 1.5% | 1% | reject rate uniform 10-20% |
| Oven fault | one product baked that day, picked in proportion to its mixes | 0.8% per production day, any month | same | same | rejected = T x (0.6 to 1.0), one mix |
| Monsoon humidity | FG10-FG14, each run | 2% | 12% from 15 Jun to 30 Sep | 2% | yield 3-6% under expected |

The seeded fortnight dip of 12.2 comes on top. Expected production loss: 0.1-0.6% of sales in a month.

### 3.5 Production rhythm

What is produced on day D is dispatched and sent to the stores on the morning of D+1. Fresh lines and
puffs are baked every day; long-life lines in runs on fixed weekdays. No production on a factory
holiday (7.4); a long-life run that falls on a Sunday never happens (no run day is a Sunday) and one
that falls on a factory holiday moves to the next working day.

| Code | Key | Rhythm | Normal-day requirement (units) | Standard mixes per run | Good units at the standard | Average mixes per run (two-year run) | Smallest - largest run | Maximum mixes per run | Target cover (days of sale) |
|---|---|---|---|---|---|---|---|---|---|
| FG01 | SB | daily | 652 | 4 | 732 | 3.55 | 2 - 4.5 | - | - |
| FG02 | BB | daily | 146 | 2 | 182 | 1.62 | 1 - 2 | - | - |
| FG03 | JL | daily | 168 | 4 | 180 | 3.57 | 1 - 5 | - | - |
| FG04 | LP | daily | 672 | 4 | 732 | 3.59 | 2 - 4.5 | - | - |
| FG05 | BNP | daily | 170 | 2.5 | 185 | 2.24 | 1 - 3 | - | - |
| FG06 | BNS | daily | 53 | 1 | 74 | 0.72 | 0.5 - 1.5 | - | - |
| FG07 | BNW | daily | 27 | 0.5 | 38 | 0.50 | 0.5 - 0.5 | - | - |
| FG08 | BNJ | daily | 69 | 1.5 | 74 | 1.42 | 0.5 - 3 | - | - |
| FG09 | PZ | daily | 162 | 2 | 202 | 1.62 | 0.5 - 2.5 | - | - |
| FG10 | TE | Mon Wed Fri | 195 | 4 | 488 | 3.75 | 1 - 6 | 6 | 7 |
| FG11 | TM | Tue Thu Sat | 59 | 1 | 150 | 1.03 | 1 - 1.5 | 6 | 7 |
| FG12 | KB | Mon Thu | 141 | 4 | 536 | 3.68 | 1 - 5.5 | 6 | 6 |
| FG13 | KJ | Tue Fri | 53 | 1.5 | 204 | 1.38 | 1 - 2.5 | 6 | 6 |
| FG14 | JB | Wed Sat | 50 | 2 | 180 | 2.00 | 1 - 4.5 | 6 | 8 |
| FG15 | TC | Mon Wed Fri | 93 | 3 | 258 | 2.53 | 1 - 4 | 4 | 3 |
| FG16 | PV | daily | 620 | 7 | 623 | 7.11 | 3.5 - 9 | - | - |
| FG17 | PP | daily | 161 | 2 | 178 | 2.04 | 1.5 - 2.25 | - | - |
| FG18 | PG | daily | 161 | 2 | 178 | 2.04 | 1.5 - 2.5 | - | - |

The veg puff's range was 4 - 8 before the simulation existed; the two-year run gives 3.5 to 8.75 mixes
(13 of its 725 entries lay outside 4 - 8 plus a step), and the range was corrected to 3.5 - 9 (13, row 50).

`standardMixes` in the recipe master is the "Standard mixes per run" column; `rhythm` is the "Rhythm"
column. The standard day plan (every recipe due that weekday at its standard mixes) uses 663 kg
of flour on a Sunday and 743-861 kg on the other days (775 kg on average) against about 690 kg actually
used on a normal day: standard mixes are rounded up, and reorder levels are sized on the plan.

Equipment behind the mix sizes (A): one spiral mixer for 50 kg of flour, one for 25 kg, a planetary
mixer for biscuit dough and cake batter, a sheeter for khari and puffs, two rotary rack ovens.

**Rule for a daily line** (FG01-FG09, FG16-FG18), each production day D:

```
need   = max( hand-over quantity for D+1 , simulated outflow of D+1 ) - unexpired stock in fac_fg
         that is still unexpired on D+1 (puffs: none can be carried)
mixes  = the smallest multiple of the step whose good units, after the yield draw, cover need
         no entry when need <= 0
```

- Hand-over quantity for D+1 = the standing orders of all active outlets + every store's standing
  quantity + the corporate orders open for D+1 (the build specification's daily guarantee).
- Simulated outflow of D+1 = the dispatch, corporate deliveries and store transfers the seed will post
  on D+1 (a pure function of the date).
- Because the size is found after the draw, a bad run shows as more mixes for the same good units: the
  yield falls and the shortfall is the production loss; the next morning is never short.
- Nothing is baked on the day before a closed day, and no hand-over applies to a closed day.

**Rule for a long-life line** (FG10-FG15), each run day D:

```
need   = max( sum over the days D+1 .. next run day of max(hand-over, simulated outflow) ,
              simulated outflow of D+1 .. next run day + target cover x average daily outflow
              of the last 14 days )
         - unexpired stock in fac_fg
mixes  = need / E rounded up to 0.5, at least 1, at most the maximum; no run when need <= 0
```

In the first 14 days of January 2026 the average is over the days so far (on 1 January: the normal-day
requirement). A long-life bad run is not re-run; the cover absorbs it.

**Finished stock that results.** Fresh lines: at most one or two days of carry-over, used first the
next morning (oldest unexpired batch first). Toast 7-10 days of sales, khari 6-10, jeera biscuit 8-12,
tea cake 3-6. A batch past its best-before in `fac_fg` goes on the morning write-off of the build
specification (in practice: unsold puffs, on average half a quarter mix per variant per day, and now
and then whole wheat buns).

---

## 4. Materials

### 4.1 Material master

"Lead days" = days from the order date to the receipt (the raw research's lead time + 1, because the
order is raised in the evening). Reorder levels were sized as 1.1 x the heaviest (lead + 4)-day stretch
of the standard day plan, rounded up to the order multiple (yeast higher), so that every day-end stock
covers three days of the plan; the table is what binds. "Normal use a day" is the normal day of
section 11. An order quantity is a whole multiple of the order multiple. The opening rate is the
January 2026 price.

| Code | Material | Kind | Unit | Purchase pack | Order multiple | HSN | GST | Vendor | Lead days | Reorder level | Order quantity | Normal use a day | Reorder level in days | Orders per 30 days | Opening stock 1 Jan 2026 | Opening rate |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| RM01 | Maida (bakery flour) | rm | kg | 50 kg bag | 50 | 1101 | Nil | VM01 | 2 | 5050 | 2000 | 674 | 7.5 | 10.0 | 3400 | 36.00 |
| RM02 | Whole wheat atta | rm | kg | 50 kg bag | 50 | 1101 | Nil | VM02 | 2 | 200 | 250 | 22.7 | 8.8 | 2.8 | 150 | 33.50 |
| RM03 | Sugar | rm | kg | 50 kg bag | 50 | 1701 | 5% | VM03 | 2 | 450 | 600 | 52.9 | 8.5 | 2.6 | 450 | 40.20 |
| RM04 | Bakery shortening | rm | kg | 15 kg box | 15 | 1517 | 5% | VM04 | 3 | 240 | 270 | 28.2 | 8.5 | 3.1 | 285 | 150.00 |
| RM05 | Puff margarine | rm | kg | 15 kg carton | 15 | 1517 | 5% | VM04 | 3 | 255 | 240 | 30.1 | 8.5 | 3.9 | 315 | 164.00 |
| RM06 | Butter (white, unsalted) | rm | kg | 15 kg carton | 15 | 0405 | 5% | VM06 | 2 | 45 | 60 | 5.23 | 8.6 | 2.6 | 60 | 455.00 |
| RM07 | Refined oil (cottonseed) | rm | litre | 15 litre tin | 15 | 1512 | 5% | VM05 | 2 | 75 | 135 | 9.01 | 8.3 | 2.0 | 105 | 142.00 |
| RM08 | Yeast, compressed | rm | kg | carton of 20 x 500 g | 10 | 2102 | 5% | VM07 | 3 | 180 | 30 | 17.7 | 10.2 | 17.4 | 140 | 118.00 |
| RM09 | Salt | rm | kg | 25 kg bag | 25 | 2501 | Nil | VM03 | 2 | 100 | 375 | 12.2 | 8.2 | 0.9 | 250 | 9.00 |
| RM10 | Skimmed milk powder | rm | kg | 25 kg bag | 25 | 0402 | 5% | VM06 | 2 | 50 | 125 | 5.72 | 8.7 | 1.4 | 125 | 265.00 |
| RM11 | Bread improver | rm | kg | 5 kg pack | 5 | 2106 | 5% | VM07 | 2 | 20 | 60 | 2.58 | 7.7 | 1.3 | 55 | 210.00 |
| RM12 | Calcium propionate | rm | kg | 5 kg pack | 5 | 2915 | 18% | VM07 | 2 | 15 | 35 | 1.56 | 9.6 | 1.3 | 35 | 150.00 |
| RM13 | Baking powder | rm | kg | 5 kg pack | 5 | 2102 | 5% | VM07 | 2 | 5 | 10 | 0.34 | 14.6 | 1.0 | 10 | 75.00 |
| RM14 | Cardamom powder | rm | kg | 1 kg pack | 1 | 0908 | 5% | VM08 | 2 | 2 | 4 | 0.16 | 12.5 | 1.2 | 4 | 2550.00 |
| RM15 | Cumin seed | rm | kg | 5 kg pack | 5 | 0909 | 5% | VM08 | 2 | 5 | 10 | 0.33 | 15.4 | 1.0 | 10 | 215.00 |
| RM16 | Sesame seed, white | rm | kg | 5 kg pack | 5 | 1207 | 5% | VM08 | 2 | 5 | 10 | 0.32 | 15.6 | 0.9 | 10 | 155.00 |
| RM17 | Tutti-frutti | rm | kg | 5 kg pack | 5 | 2006 | 5% | VM07 | 2 | 15 | 30 | 1.30 | 11.5 | 1.3 | 30 | 92.00 |
| RM18 | Flavour essence | rm | litre | 500 ml bottle | 0.5 | 3302 | 18% | VM07 | 2 | 1 | 2 | 0.06 | 17.8 | 0.8 | 2 | 520.00 |
| RM19 | Potato | rm | kg | 50 kg bag | 50 | 0701 | Nil | VM09 | 1 | 100 | 50 | 21.1 | 4.7 | 13.2 | 100 | 13.00 |
| RM20 | Onion | rm | kg | loose, 10 kg lots | 10 | 0703 | Nil | VM09 | 1 | 30 | 20 | 6.35 | 4.7 | 10.0 | 30 | 20.00 |
| RM21 | Green peas, frozen | rm | kg | 1 kg pack | 1 | 0710 | 5% | VM10 | 2 | 35 | 35 | 4.90 | 7.1 | 4.3 | 50 | 84.00 |
| RM22 | Paneer | rm | kg | 1 kg block | 1 | 0406 | Nil | VM11 | 1 | 14 | 5 | 2.71 | 5.2 | 18.3 | 10 | 330.00 |
| RM23 | Garlic, peeled | rm | kg | 1 kg pack | 1 | 0703 | Nil | VM09 | 1 | 3 | 2 | 0.54 | 5.5 | 9.1 | 3 | 160.00 |
| RM24 | Puff masala | rm | kg | 1 kg pack | 1 | 0910 | 5% | VM08 | 2 | 10 | 30 | 1.20 | 8.4 | 1.3 | 24 | 360.00 |
| PM01 | Bread bag, 400 g loaf | pk | pcs | bundle of 1,000 | 1000 | 3923 | 18% | VM12 | 8 | 13000 | 25000 | 798 | 16.3 | 0.9 | 17000 | 1.00 |
| PM02 | Bread bag, 800 g loaf | pk | pcs | bundle of 1,000 | 1000 | 3923 | 18% | VM12 | 8 | 3000 | 6000 | 168 | 17.8 | 0.8 | 4000 | 1.60 |
| PM03 | Pav / bun bag | pk | pcs | bundle of 1,000 | 1000 | 3923 | 18% | VM12 | 4 | 12000 | 35000 | 1152 | 10.4 | 1.0 | 25000 | 0.55 |
| PM04 | Pouch, small | pk | pcs | bundle of 500 | 500 | 3923 | 18% | VM12 | 8 | 4000 | 7500 | 245 | 16.3 | 1.0 | 5500 | 2.00 |
| PM05 | Pouch, large | pk | pcs | bundle of 500 | 500 | 3923 | 18% | VM12 | 8 | 4500 | 7000 | 253 | 17.8 | 1.1 | 5500 | 2.70 |
| PM06 | Cake pack | pk | pcs | carton of 500 | 500 | 4819 | 5% | VM13 | 6 | 1500 | 3000 | 93.2 | 16.1 | 0.9 | 2000 | 6.80 |
| PM07 | Puff paper | pk | pcs | packet of 1,000 | 1000 | 4806 | 18% | VM13 | 3 | 8000 | 30000 | 941 | 8.5 | 1.0 | 20000 | 0.18 |
| PM08 | Date label | pk | pcs | roll of 1,000 | 1000 | 4821 | 18% | VM13 | 5 | 31000 | 80000 | 2710 | 11.4 | 1.0 | 57000 | 0.24 |

Notes.

- Tax: flour is Nil because the bag is 50 kg (over 25 kg is outside "pre-packaged and labelled"); salt,
  potato, onion and garlic are taken as Nil (A); pre-packaged paneer is Nil since 22 September 2025;
  greaseproof paper went to 18% on that date. One rate per material for the whole period.
- Storage: flour on pallets (peak about 120 bags); margarine, butter, yeast, paneer and garlic in the
  cold room (peak about 740 kg); peas in a 100 kg chest freezer.
- **Yeast (RM08) is the standing low-stock item** (12.7): bought in 30 kg lots nearly every other day
  because it keeps only three to four weeks, with a reorder level its stock never rises above.
- Every flour order (2,000 kg, Rs 70,000-84,000) is above the Owner's Rs 50,000 limit: about ten a
  month wait for approval. A fats order (RM04 + RM05 on one order) or a butter and milk powder order
  crosses the limit now and then. Every other order is approved as submitted.
- Checked by a two-year day-by-day run of these rules: no material ran short; the lowest day-end stock
  was 3.6 days (potato, onion) and 3.7 days (flour); between 2 and 16 materials were at or below their
  reorder level on every day (7.8 on average); about 105 orders a month, 10 of them above the limit.

### 4.2 Purchase prices, 2026 (Rs per stock unit, before GST)

One price a month. The rate on a purchase order is the price of the month of the order date. January is
also the opening rate. January to October are researched or anchored on October 2026 listings; November
and December follow the rule of 4.4.

| Code | Jan 2026 | Feb 2026 | Mar 2026 | Apr 2026 | May 2026 | Jun 2026 | Jul 2026 | Aug 2026 | Sep 2026 | Oct 2026 | Nov 2026 | Dec 2026 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| RM01 | 36.00 | 36.00 | 35.60 | 35.00 | 35.60 | 36.60 | 37.40 | 38.20 | 38.80 | 39.00 | 39.10 | 39.20 |
| RM02 | 33.50 | 33.50 | 33.10 | 32.50 | 33.10 | 34.10 | 34.90 | 35.70 | 36.30 | 36.50 | 36.60 | 36.70 |
| RM03 | 40.20 | 41.20 | 41.40 | 41.50 | 42.70 | 42.30 | 46.80 | 56.40 | 51.90 | 47.40 | 45.60 | 44.30 |
| RM04 | 150 | 151 | 153 | 155 | 158 | 160 | 163 | 166 | 170 | 168 | 165 | 166 |
| RM05 | 164 | 165 | 167 | 169 | 172 | 175 | 178 | 182 | 186 | 184 | 181 | 182 |
| RM06 | 455 | 455 | 460 | 465 | 472 | 480 | 480 | 478 | 476 | 474 | 471 | 470 |
| RM07 | 142 | 144 | 146 | 147 | 149 | 151 | 154 | 158 | 164 | 161 | 157 | 157 |
| RM08 | 118 | 118 | 118 | 118 | 118 | 118 | 122 | 122 | 122 | 122 | 122 | 123 |
| RM09 | 9.00 | 9.00 | 9.00 | 9.00 | 9.00 | 9.00 | 9.40 | 9.40 | 9.40 | 9.40 | 9.40 | 9.40 |
| RM10 | 265 | 265 | 268 | 272 | 276 | 280 | 280 | 278 | 275 | 272 | 270 | 270 |
| RM11 | 210 | 210 | 210 | 210 | 210 | 210 | 216 | 216 | 216 | 216 | 217 | 217 |
| RM12 | 150 | 150 | 150 | 150 | 150 | 150 | 155 | 155 | 155 | 155 | 155 | 156 |
| RM13 | 75 | 75 | 75 | 75 | 75 | 75 | 75 | 75 | 75 | 75 | 75 | 75 |
| RM14 | 2550 | 2550 | 2600 | 2650 | 2700 | 2750 | 2800 | 2800 | 2750 | 2700 | 2710 | 2720 |
| RM15 | 215 | 212 | 205 | 205 | 208 | 212 | 216 | 220 | 222 | 222 | 223 | 223 |
| RM16 | 155 | 155 | 155 | 155 | 155 | 155 | 160 | 160 | 160 | 160 | 160 | 161 |
| RM17 | 92 | 92 | 92 | 92 | 92 | 92 | 94 | 98 | 102 | 100 | 100 | 101 |
| RM18 | 520 | 520 | 520 | 520 | 520 | 520 | 520 | 520 | 520 | 520 | 520 | 525 |
| RM19 | 13.00 | 11.00 | 10.50 | 11.50 | 12.50 | 13.50 | 14.50 | 15.00 | 15.50 | 16.50 | 17.00 | 15.60 |
| RM20 | 20.00 | 18.00 | 16.00 | 15.00 | 16.00 | 19.00 | 24.00 | 32.00 | 44.00 | 46.00 | 39.10 | 26.60 |
| RM21 | 84 | 82 | 80 | 80 | 82 | 84 | 86 | 88 | 90 | 90 | 90 | 91 |
| RM22 | 330 | 330 | 335 | 340 | 348 | 355 | 355 | 352 | 350 | 348 | 346 | 345 |
| RM23 | 160 | 150 | 135 | 125 | 125 | 130 | 138 | 145 | 150 | 155 | 157 | 158 |
| RM24 | 360 | 360 | 360 | 360 | 360 | 360 | 370 | 370 | 370 | 370 | 371 | 372 |
| PM01 | 1.00 | 1.00 | 1.00 | 1.00 | 1.05 | 1.05 | 1.10 | 1.10 | 1.10 | 1.10 | 1.10 | 1.11 |
| PM02 | 1.60 | 1.60 | 1.60 | 1.60 | 1.68 | 1.68 | 1.76 | 1.76 | 1.76 | 1.76 | 1.76 | 1.77 |
| PM03 | 0.55 | 0.55 | 0.55 | 0.55 | 0.58 | 0.58 | 0.60 | 0.60 | 0.60 | 0.60 | 0.60 | 0.60 |
| PM04 | 2.00 | 2.00 | 2.00 | 2.00 | 2.10 | 2.10 | 2.18 | 2.18 | 2.18 | 2.18 | 2.19 | 2.19 |
| PM05 | 2.70 | 2.70 | 2.70 | 2.70 | 2.84 | 2.84 | 2.94 | 2.94 | 2.94 | 2.94 | 2.95 | 2.95 |
| PM06 | 6.80 | 6.80 | 6.80 | 6.80 | 6.80 | 6.80 | 7.10 | 7.10 | 7.10 | 7.10 | 7.10 | 7.15 |
| PM07 | 0.18 | 0.18 | 0.18 | 0.18 | 0.18 | 0.18 | 0.19 | 0.19 | 0.19 | 0.19 | 0.19 | 0.19 |
| PM08 | 0.24 | 0.24 | 0.24 | 0.24 | 0.24 | 0.24 | 0.25 | 0.25 | 0.25 | 0.25 | 0.25 | 0.25 |

### 4.3 Purchase prices, 2027

The rule of 4.4 evaluated. **This table is binding** where floating-point arithmetic could land on
either side of a rounding step; the generator may store the 24 months of 4.2 and 4.3 as one table.

| Code | Jan 2027 | Feb 2027 | Mar 2027 | Apr 2027 | May 2027 | Jun 2027 | Jul 2027 | Aug 2027 | Sep 2027 | Oct 2027 | Nov 2027 | Dec 2027 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| RM01 | 39.40 | 39.50 | 39.00 | 38.50 | 39.00 | 39.70 | 40.50 | 41.00 | 41.50 | 41.60 | 41.80 | 41.90 |
| RM02 | 36.80 | 36.90 | 36.50 | 36.00 | 36.50 | 37.20 | 37.90 | 38.40 | 38.90 | 39.00 | 39.10 | 39.20 |
| RM03 | 44.50 | 44.60 | 44.70 | 44.90 | 45.00 | 45.20 | 45.30 | 45.40 | 45.60 | 45.70 | 45.80 | 46.00 |
| RM04 | 167 | 176 | 176 | 177 | 178 | 178 | 179 | 180 | 181 | 181 | 182 | 183 |
| RM05 | 182 | 192 | 193 | 194 | 195 | 195 | 196 | 197 | 198 | 199 | 199 | 200 |
| RM06 | 469 | 471 | 492 | 499 | 505 | 512 | 514 | 513 | 512 | 509 | 506 | 505 |
| RM07 | 158 | 163 | 164 | 165 | 165 | 166 | 167 | 167 | 168 | 169 | 169 | 170 |
| RM08 | 123 | 123 | 124 | 124 | 124 | 124 | 125 | 125 | 125 | 126 | 126 | 126 |
| RM09 | 9.50 | 9.50 | 9.50 | 9.50 | 9.60 | 9.60 | 9.60 | 9.60 | 9.70 | 9.70 | 9.70 | 9.70 |
| RM10 | 269 | 270 | 282 | 286 | 290 | 294 | 295 | 294 | 294 | 292 | 290 | 290 |
| RM11 | 218 | 218 | 219 | 219 | 220 | 220 | 221 | 221 | 222 | 223 | 223 | 224 |
| RM12 | 156 | 157 | 157 | 157 | 158 | 158 | 159 | 159 | 159 | 160 | 160 | 161 |
| RM13 | 76 | 76 | 76 | 76 | 76 | 77 | 77 | 77 | 77 | 77 | 77 | 78 |
| RM14 | 2720 | 2730 | 2740 | 2750 | 2760 | 2770 | 2770 | 2780 | 2790 | 2800 | 2810 | 2820 |
| RM15 | 224 | 225 | 225 | 226 | 227 | 227 | 228 | 229 | 229 | 230 | 231 | 232 |
| RM16 | 161 | 162 | 162 | 163 | 163 | 164 | 164 | 165 | 165 | 166 | 166 | 167 |
| RM17 | 101 | 101 | 102 | 102 | 102 | 102 | 103 | 103 | 103 | 104 | 104 | 104 |
| RM18 | 525 | 525 | 525 | 530 | 530 | 530 | 530 | 535 | 535 | 535 | 535 | 540 |
| RM19 | 13.50 | 11.70 | 11.20 | 12.20 | 13.30 | 14.20 | 15.30 | 15.80 | 16.10 | 17.20 | 17.70 | 16.30 |
| RM20 | 23.00 | 20.70 | 18.30 | 17.20 | 18.40 | 21.00 | 24.80 | 28.60 | 32.40 | 35.00 | 32.60 | 25.20 |
| RM21 | 85 | 83 | 82 | 82 | 84 | 86 | 89 | 91 | 93 | 93 | 94 | 94 |
| RM22 | 345 | 346 | 361 | 366 | 371 | 376 | 377 | 377 | 376 | 374 | 371 | 371 |
| RM23 | 161 | 154 | 140 | 130 | 130 | 137 | 143 | 149 | 154 | 161 | 163 | 163 |
| RM24 | 373 | 374 | 376 | 377 | 378 | 379 | 380 | 381 | 382 | 384 | 385 | 386 |
| PM01 | 1.11 | 1.11 | 1.11 | 1.12 | 1.12 | 1.12 | 1.12 | 1.13 | 1.13 | 1.13 | 1.14 | 1.14 |
| PM02 | 1.77 | 1.78 | 1.78 | 1.79 | 1.79 | 1.80 | 1.80 | 1.80 | 1.81 | 1.81 | 1.82 | 1.82 |
| PM03 | 0.60 | 0.61 | 0.61 | 0.61 | 0.61 | 0.61 | 0.61 | 0.62 | 0.62 | 0.62 | 0.62 | 0.62 |
| PM04 | 2.20 | 2.20 | 2.21 | 2.21 | 2.22 | 2.22 | 2.23 | 2.24 | 2.24 | 2.25 | 2.25 | 2.26 |
| PM05 | 2.96 | 2.97 | 2.98 | 2.98 | 2.99 | 3.00 | 3.01 | 3.01 | 3.02 | 3.03 | 3.04 | 3.04 |
| PM06 | 7.15 | 7.15 | 7.20 | 7.20 | 7.25 | 7.25 | 7.25 | 7.30 | 7.30 | 7.30 | 7.35 | 7.35 |
| PM07 | 0.19 | 0.19 | 0.19 | 0.19 | 0.19 | 0.19 | 0.19 | 0.19 | 0.20 | 0.20 | 0.20 | 0.20 |
| PM08 | 0.25 | 0.25 | 0.25 | 0.25 | 0.25 | 0.26 | 0.26 | 0.26 | 0.26 | 0.26 | 0.26 | 0.26 |

### 4.4 The rule from November 2026 to December 2027

For month M, with n = months after October 2026 (November 2026 = 1, December 2027 = 14):

```
price(M) = round_half_up_to_step( A x (1 + d)^n x shape[calendar month of M] x product of event factors in force in M )
```

| Code | A (October 2026 level) | Drift d a month | Shape | Events (factor, months) | Rounding step |
|---|---|---|---|---|---|
| RM01 | 39 | 0.30% | none | x 0.985 in Mar 2027 only; x 0.970 in Apr 2027 only; x 0.980 in May 2027 only; x 0.995 in Jun 2027 only; x 1.010 in Jul 2027 only; x 1.020 in Aug 2027 only; x 1.030 from Sep 2027 | 0.1 |
| RM02 | 36.5 | 0.30% | none | x 0.985 in Mar 2027 only; x 0.970 in Apr 2027 only; x 0.980 in May 2027 only; x 0.995 in Jun 2027 only; x 1.010 in Jul 2027 only; x 1.020 in Aug 2027 only; x 1.030 from Sep 2027 | 0.1 |
| RM03 | 47.4 | 0.30% | none | x 0.96 in Nov 2026 only; x 0.93 from Dec 2026 | 0.1 |
| RM04 | 168 | 0.40% | none | x 0.98 from Nov 2026; x 1.05 from Feb 2027 | 1 |
| RM05 | 184 | 0.40% | none | x 0.98 from Nov 2026; x 1.05 from Feb 2027 | 1 |
| RM06 | 474 | 0.35% | dairy | x 1.03 from Mar 2027 | 1 |
| RM07 | 161 | 0.40% | none | x 0.97 from Nov 2026; x 1.03 from Feb 2027 | 1 |
| RM08 | 122 | 0.25% | none | none | 1 |
| RM09 | 9.4 | 0.25% | none | none | 0.1 |
| RM10 | 272 | 0.35% | dairy | x 1.03 from Mar 2027 | 1 |
| RM11 | 216 | 0.25% | none | none | 1 |
| RM12 | 155 | 0.25% | none | none | 1 |
| RM13 | 75 | 0.25% | none | none | 1 |
| RM14 | 2700 | 0.30% | none | none | 10 |
| RM15 | 222 | 0.30% | none | none | 1 |
| RM16 | 160 | 0.30% | none | none | 1 |
| RM17 | 100 | 0.30% | none | none | 1 |
| RM18 | 520 | 0.25% | none | none | 5 |
| RM19 | 14.1 | 0.35% | potato | none | 0.1 |
| RM20 | 24 | 0.35% | onion | x 1.25 in Nov 2026 only; x 1.1 in Dec 2026 only | 0.1 |
| RM21 | 85.7 | 0.30% | peas | none | 1 |
| RM22 | 348 | 0.35% | dairy | x 1.03 from Mar 2027 | 1 |
| RM23 | 145 | 0.30% | garlic | none | 1 |
| RM24 | 370 | 0.30% | none | none | 1 |
| PM01 | 1.1 | 0.25% | none | none | 0.01 |
| PM02 | 1.76 | 0.25% | none | none | 0.01 |
| PM03 | 0.6 | 0.25% | none | none | 0.01 |
| PM04 | 2.18 | 0.25% | none | none | 0.01 |
| PM05 | 2.94 | 0.25% | none | none | 0.01 |
| PM06 | 7.1 | 0.25% | none | none | 0.05 |
| PM07 | 0.19 | 0.25% | none | none | 0.01 |
| PM08 | 0.25 | 0.25% | none | none | 0.01 |

Seasonal shapes (A), each averaging 1.00:

| Shape | Jan | Feb | Mar | Apr | May | Jun | Jul | Aug | Sep | Oct | Nov | Dec |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| dairy | 0.98 | 0.98 | 0.99 | 1.00 | 1.01 | 1.02 | 1.02 | 1.015 | 1.01 | 1.00 | 0.99 | 0.985 |
| potato | 0.95 | 0.82 | 0.78 | 0.85 | 0.92 | 0.98 | 1.05 | 1.08 | 1.10 | 1.17 | 1.20 | 1.10 |
| onion | 0.95 | 0.85 | 0.75 | 0.70 | 0.75 | 0.85 | 1.00 | 1.15 | 1.30 | 1.40 | 1.30 | 1.00 |
| garlic | 1.10 | 1.05 | 0.95 | 0.88 | 0.88 | 0.92 | 0.96 | 1.00 | 1.03 | 1.07 | 1.08 | 1.08 |
| peas | 0.98 | 0.96 | 0.94 | 0.94 | 0.96 | 0.98 | 1.01 | 1.03 | 1.05 | 1.05 | 1.05 | 1.05 |

Price events in the tables.

| # | Event | Real or (A) | Effect |
|---|---|---|---|
| 1 | Wheat harvest dip and climb, 2026 | (A) shape on researched October levels | RM01 35.00 in April to 39.00 in October 2026 (+11.4%); RM02 the same shape |
| 2 | Sugar spike, July-September 2026 | real | RM03 42.30 in June, 56.40 in August, 47.40 in October; RM17 follows |
| 3 | Edible-oil rise and the customs-duty cut of 24 September 2026 | real | RM04, RM05, RM07 +13-15% January to September, easing from October |
| 4 | Milk price rise of 14 May 2026 | real | RM06, RM10, RM22 step up about 2% across May-June |
| 5 | Onion at Rs 40-46, September-November 2026 | real level, (A) path | RM20 44.00, 46.00, 39.10, then back to its shape |
| 6 | Fats firm again, February 2027 | (A) | RM04, RM05 x 1.05, RM07 x 1.03 from February 2027 |
| 7 | Second milk price rise, March 2027 | (A) | RM06, RM10, RM22 x 1.03 from March 2027 |
| 8 | Wheat harvest dip and climb, 2027 | (A) | RM01 38.50 in April to 41.50 in September 2027 (+7.8%) |

Events 6 and 7 give revision 2 its reason; events 1 and 8 are the flour story of 12.1.

### 4.5 Purchasing rules for the seed (A)

1. **Day-end check.** After production is posted on day D, for every material: if stock on hand +
   quantity on open orders <= reorder level, order the order quantity. The check of 31 December 2025
   is made on the opening stock and its orders are dated 1 January 2026.
2. **Purchase order.** One order per vendor per day, a line for each of that vendor's materials that
   tripped, raised that evening and dated D. Rate = price of the month of D. For RM19, RM20 and RM23
   the rate is the month's price x (1 + u), u uniform in +/-6%, rounded to Rs 0.10 (RM23 to Re 1).
   Expected date of a line = D + its lead days; lines with different lead days arrive on their own
   dates and the order shows "Part received" in between.
3. **Approval.** Order value before GST up to Rs 50,000: approved as submitted. Above: the Owner
   approves it the next morning; the lead days already allow for that.
4. **Goods receipt.** In the morning of the expected date, before production. A Sunday (except VM09
   and VM11, which deliver every day) or a closed day moves it to the next receiving day. At the order
   rate. Seeded exceptions, each drawn on the order: VM12 - one order in four arrives 60% on the
   expected date and the rest four days later; VM01 - one receipt in 25 rejects one 50 kg bag, which
   comes with a second receipt two days later; VM09 - one potato receipt in 8 rejects 2-4 kg, made
   good with the next morning's receipt. Every seeded order ends "Received".
5. **Vendor bill.** One bill per receipt, entered by accounts the day after the receipt and dated that
   day (next open day if closed), for the quantity accepted at the order rate plus GST by line.
   VM09 and VM11 bill weekly: one bill each Monday for the receipts of the previous Monday to Sunday.
   Due date = bill date + credit days. Bills that fail the three-way check: 12.5.
6. **Payment.** Accounts pays on **Mondays and Thursdays**: every posted bill due on or before that day,
   one payment per vendor, from the bank. VM08 and VM13 are paid late by habit: at the first payment
   day on or after due date + 12 days. VM09 and VM11 are paid in cash from factory cash on the due date
   (about Rs 5,100 and Rs 6,600 a week). A payment day that is a closed day moves to the next open day.
7. **Safety net.** If at the start of a production day a material is short of that day's need, one
   extra order of the order quantity is raised and received that morning. With these levels it never
   fires; the self-check counts it and expects zero.

---

## 5. Vendors

### 5.1 Stock vendors (13)

Credit days count from the bill date. "Order days" are also the receiving days. Share = of a normal
month's purchases before GST at October 2026 prices (Rs 16.9 lakh).

| Id | Name | Town | Constitution | GSTIN | Supplies | Credit days | Order days | Billing | Paid | Share % |
|---|---|---|---|---|---|---|---|---|---|---|
| VM01 | Godhumvan Roller Flour Mills Pvt Ltd | Nadiad | private company | 24AAGCG4172M1ZE | RM01 | 15 | Mon-Sat | per receipt | bank, on time | 46.6 |
| VM02 | Kanakshali Chakki Atta Udyog | Borsad | proprietor | 24BKTPP6391H1ZH | RM02 | 15 | Mon-Sat | per receipt | bank, on time | 1.5 |
| VM03 | Sharkaravan Sugar and Salt Traders | Anand | partnership firm | 24ABMFS2846J1ZT | RM03, RM09 | 10 | Mon-Sat | per receipt | bank, on time | 4.6 |
| VM04 | Snigdhakosh Bakery Fats LLP | Vadodara | LLP | 24ACDFS7150R1ZL | RM04, RM05 | 21 | Mon-Sat | per receipt | bank, on time | 18.2 |
| VM05 | Tailvan Oil Depot | Anand | proprietor | 24CLNPT4418B1Z4 | RM07 | 14 | Mon-Sat | per receipt | bank, on time | 2.6 |
| VM06 | Ksheervan Dairy Products Agency | Anand | partnership firm | 24AAZFK9263D1ZU | RM06, RM10 | 7 | Mon-Sat | per receipt | bank, on time | 7.1 |
| VM07 | Kinvashakti Bakery Ingredients Pvt Ltd | Ahmedabad | private company | 24AAHCK3057N1Z9 | RM08, RM11, RM12, RM13, RM17, RM18 | 15 | Mon-Sat | per receipt | bank, on time | 5.6 |
| VM08 | Elachivala Masala Bhandar | Anand | proprietor | 24DQRPM8824L1Z1 | RM14, RM15, RM16, RM24 | 15 | Mon-Sat | per receipt | bank, 12 days late | 1.8 |
| VM09 | Shakmandap Vegetable Suppliers | Anand | proprietor | none (not registered) | RM19, RM20, RM23 | 7 | every day | weekly, Monday | factory cash, on the due date | 1.3 |
| VM10 | Sheetkosh Frozen Foods | Vallabh Vidyanagar | proprietor | 24EHYPS5136C1ZY | RM21 | 7 | Mon-Sat | per receipt | bank, on time | 0.8 |
| VM11 | Dugdhkalash Paneer and Dairy Farm | Karamsad | proprietor | none (not registered) | RM22 | 7 | every day | weekly, Monday | factory cash, on the due date | 1.7 |
| VM12 | Veshtan Polyfilms Pvt Ltd | Vadodara | private company | 24AAKCV6609P1ZN | PM01, PM02, PM03, PM04, PM05 | 30 | Mon-Sat | per receipt | bank, on time | 5.6 |
| VM13 | Kagazvesh Print Pack | Vitthal Udyognagar | partnership firm | 24ABGFK1784E1ZF | PM06, PM07, PM08 | 30 | Mon-Sat | per receipt | bank, 12 days late | 2.7 |

GSTIN = "24" + a 10-character PAN (fourth letter C company, F firm or LLP, T trust, P individual) + "1"
+ "Z" + a check character. The generator should compute the 15th character itself: over the first 14
characters, with values 0-9 then A-Z = 10-35, multiply alternately by 1 and 2 starting with 1, add
quotient and remainder of each product divided by 36, sum, and take `(36 - sum mod 36) mod 36`. Every
GSTIN in this file passes that test. The scope speaks of "about 18" material vendors; 13 cover the 32
materials and that count is kept.

### 5.2 Staff vendor

| Id | Name | Kind | Terms |
|---|---|---|---|
| VS01 | Staff salaries | staff | the payee of every salary bill; paid from the bank on the 5th of the next month |

### 5.3 Expense vendors (24)

Utilities, the telecom operator, the insurer, the bank and government fees keep generic names and carry
no GSTIN; their GST, where there is any, still counts as input credit. Store rent carries no GST (the
landlords are unregistered and reverse charge is out of scope). "Terms" = days from bill date to due
date unless a day of the month is given.

| Id | Name | Town | Type | GSTIN | GST % on its bills | Expense category | Terms |
|---|---|---|---|---|---|---|---|
| VE01 | Kesarvan Estates LLP | Anand | factory landlord | 24AAUFK5392G1ZV | 18 | rent | dated the 1st, due the 7th |
| VE02 | Maganbhai D. Thakkar | Anand | landlord of S1 | none | 0 | rent | dated the 1st, due the 5th |
| VE03 | Sarlaben K. Amin | Vallabh Vidyanagar | landlord of S2 | none | 0 | rent | dated the 1st, due the 5th |
| VE04 | Rafiqbhai G. Mansuri | Nadiad | landlord of S3 | none | 0 | rent | dated the 1st, due the 5th |
| VE05 | Electricity distribution company | - | utility | none | 0 | electricity | 10 |
| VE06 | City gas distributor | Anand | utility | none | 0 | oven_fuel | 10 |
| VE07 | Tulsivan Fuel Point | Anand | fuel station | 24AATFT8061Q1Z6 | 0 | vehicle_fuel | 7 |
| VE08 | Agnitej Oven Services | Vadodara | oven and machinery service | 24ABEFA2475K1ZG | 18 | repairs | 15 for the contract, 7 otherwise |
| VE09 | Broadband and mobile operator | - | telecom operator | none | 18 | telephone | dated the 5th, due the 20th |
| VE10 | Pandit Lakdawala and Co., Chartered Accountants | Anand | accounting firm | 24AASFP6318C1Z8 | 18 | professional | 15 |
| VE11 | Pahiyaveg Motor Garage | Anand | garage | 24FMVPC7745D1ZS | 18 | vehicle_maint | 15 |
| VE12 | Yantradoot Spares and Bearings | Anand | spares dealer | 24ABXFY3906H1ZM | 18 | repairs | 7 |
| VE13 | General insurance company | - | insurer | none | 18 | licences | 7 |
| VE14 | Government fees | - | pseudo-vendor | none | 0 | licences | 7 |
| VE15 | Aharnirikshan Food Testing Laboratory Pvt Ltd | Vallabh Vidyanagar | laboratory | 24AAJCA8452F1ZP | 18 | licences | 7 |
| VE16 | The bank | - | bank | none | 18 | bank_charges | paid the same day |
| VE17 | Ganveshkala Uniforms | Anand | garment supplier | 24GRWPV2587N1ZE | 5 | staff_welfare | 7 |
| VE18 | Family clinic | Anand | clinic | none | 0 | staff_welfare | 7 |
| VE19 | Mithaskalash Sweets and Farsan | Anand | sweet and gift supplier | 24ABPFM4063T1ZF | 5 | staff_welfare | 7 |
| VE20 | Chitrakala Print and Sign | Anand | printer and sign maker | 24AAQFC9731B1ZI | 18 | marketing | 7 |
| VE21 | Dhvaniprachar Media Pvt Ltd | Anand | advertising agency | 24AANCD1648R1Z1 | 18 | marketing | 7 |
| VE22 | Swachhmitra Facility Services | Anand | housekeeping contractor | 24ABCFS5820L1Z3 | 18 | running | 7 |
| VE23 | Industrial estate water supply | Vitthal Udyognagar | utility | none | 0 | running | 7 |
| VE24 | Jantumukt Pest Care | Anand | pest control | 24HJKPJ3379A1Z8 | 18 | running | 7 |

---

## 6. Customers

### 6.1 Retail outlets: types, sizes and the standing-order template (A)

40 outlets on 4 routes. Types: P provision (kirana) store 14, D dairy parlour 9, T tea stall or snack
cart 7, B bakery counter or cake shop 5, G general store or mini supermarket 5. Sizes: S 10, M 20, L 10.

An outlet's standing order = the medium (M) row of its type x the size factor (**S 0.75, M 1.00,
L 1.40**), each line rounded half up to a whole pack; a line that rounds to 0 is dropped. The table is
that rule worked out, for checking the generator. FG03, FG08 and the puffs are never on a standing
order. A standing order is master data and stays fixed; 7.1 says what is actually dispatched.

| Type | Size | SB | BB | LP | BNP | BNS | BNW | PZ | TE | TM | KB | KJ | JB | TC | Rs/day opening list | Rs/day after revision 1 | Rs/day after revision 2 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| P | S | 11 | 2 | 7 | 2 | 0 | 0 | 2 | 3 | 1 | 2 | 1 | 1 | 1 | 1148.00 | 1197.00 | 1229.00 |
| P | M | 14 | 2 | 9 | 2 | 0 | 0 | 2 | 4 | 1 | 3 | 1 | 1 | 1 | 1392.00 | 1451.50 | 1490.50 |
| P | L | 20 | 3 | 13 | 3 | 0 | 0 | 3 | 6 | 1 | 4 | 1 | 1 | 1 | 1908.50 | 1994.50 | 2043.50 |
| D | S | 12 | 2 | 8 | 2 | 0 | 0 | 2 | 2 | 1 | 2 | 0 | 0 | 1 | 1060.00 | 1113.00 | 1134.00 |
| D | M | 16 | 3 | 10 | 2 | 0 | 0 | 2 | 3 | 1 | 2 | 0 | 0 | 1 | 1316.50 | 1385.00 | 1409.00 |
| D | L | 22 | 4 | 14 | 3 | 0 | 0 | 3 | 4 | 1 | 3 | 0 | 0 | 1 | 1791.50 | 1886.50 | 1917.50 |
| T | S | 4 | 0 | 15 | 5 | 0 | 0 | 0 | 2 | 0 | 2 | 1 | 0 | 0 | 920.00 | 960.00 | 978.00 |
| T | M | 5 | 0 | 20 | 6 | 0 | 0 | 0 | 3 | 0 | 3 | 1 | 0 | 0 | 1215.00 | 1266.50 | 1291.50 |
| T | L | 7 | 0 | 28 | 8 | 0 | 0 | 0 | 4 | 0 | 4 | 1 | 0 | 0 | 1652.50 | 1724.00 | 1756.00 |
| B | S | 8 | 2 | 5 | 2 | 2 | 1 | 3 | 3 | 1 | 2 | 2 | 2 | 2 | 1254.50 | 1300.00 | 1343.00 |
| B | M | 11 | 3 | 6 | 3 | 2 | 1 | 4 | 4 | 1 | 3 | 2 | 2 | 2 | 1551.00 | 1611.00 | 1661.00 |
| B | L | 15 | 4 | 8 | 4 | 3 | 1 | 6 | 6 | 1 | 4 | 3 | 3 | 3 | 2146.00 | 2227.50 | 2298.50 |
| G | S | 12 | 3 | 4 | 2 | 1 | 1 | 2 | 3 | 1 | 2 | 1 | 1 | 2 | 1227.00 | 1280.50 | 1315.50 |
| G | M | 16 | 4 | 5 | 2 | 1 | 1 | 3 | 4 | 1 | 3 | 1 | 1 | 2 | 1529.00 | 1598.00 | 1640.00 |
| G | L | 22 | 6 | 7 | 3 | 1 | 1 | 4 | 6 | 1 | 4 | 1 | 1 | 3 | 2064.50 | 2159.50 | 2214.50 |

Column keys: SB FG01, BB FG02, LP FG04, BNP FG05, BNS FG06, BNW FG07, PZ FG09, TE FG10, TM FG11, KB FG12,
KJ FG13, JB FG14, TC FG15. Smallest outlet Rs 920 a day, largest Rs 2,146, average Rs 1,440 (opening
list, before GST).

### 6.2 Outlet terms (A)

- **Cash on delivery** (24 outlets, `terms: 'cash'`): the invoice is collected by the van salesman at
  the drop into factory cash.
- **Weekly credit** (16 outlets, `terms: 'weekly'`): due date = invoice date + 7. The salesman collects
  once a week on the route's collection day (R1 Monday, R2 Tuesday, R3 Wednesday, R4 Thursday)
  everything invoiced up to the day before, as one receipt per outlet: by UPI into the bank when a draw
  keyed on the receipt is under 0.5, otherwise in cash into factory cash. A collection that falls on a
  closed day moves to the next open day.
- **Four slow payers**, one per route. Collection weeks are numbered from the week of Monday
  2026-01-05 (week 1). On the day it pays, a slow outlet clears everything invoiced up to the day before.

| Outlet | Pays | Oldest invoice when it pays | Most overdue |
|---|---|---|---|
| O38 | on its collection day in odd weeks only | 14 days | 7 days |
| O04 | on its collection day in odd weeks only | 14 days | 7 days |
| O19 | on its collection day every third week (weeks 1, 4, 7 ...) | 21 days | 14 days |
| O28 | on its first collection day of each calendar month | about 35 days | about 28 days |

- Credit limit of a weekly outlet = ten days of its standing order at the opening list, rounded up to
  Rs 1,000; 0 for a cash outlet (no limit). On an outlet the limit is information only.
- Returns factor: the outlet factor of the stale-return rule (7.9). **O19 is the high-returns outlet**
  (12.3).

### 6.3 The 40 outlets, by route in stop order

`routes[].stops` is the Seq order. Rs/day = standing order at the opening list, before GST.

**R1 - Anand town** (13 outlets, 27.1 km, collection Monday)

| Seq | Id | Name | Locality | Type | Size | Terms | Credit limit | SB | BB | LP | BNP | BNS | BNW | PZ | TE | TM | KB | KJ | JB | TC | Rs/day opening list | Returns factor |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | O11 | Kesarkunj Bakery | Anand-Sojitra Road, Anand | B | M | weekly | 16000 | 11 | 3 | 6 | 3 | 2 | 1 | 4 | 4 | 1 | 3 | 2 | 2 | 2 | 1551.00 | 1 |
| 2 | O06 | Gopinandan Dairy Parlour | Ganesh Chokdi, Anand | D | M | cash | 0 | 16 | 3 | 10 | 2 | 0 | 0 | 2 | 3 | 1 | 2 | 0 | 0 | 1 | 1316.50 | 1 |
| 3 | O05 | Navnitkunj Milk Parlour | Amul Dairy Road, Anand | D | L | weekly | 18000 | 22 | 4 | 14 | 3 | 0 | 0 | 3 | 4 | 1 | 3 | 0 | 0 | 1 | 1791.50 | 0.85 |
| 4 | O01 | Vrajkunj Provision Store | Station Road, Anand | P | L | weekly | 20000 | 20 | 3 | 13 | 3 | 0 | 0 | 3 | 6 | 1 | 4 | 1 | 1 | 1 | 1908.50 | 0.85 |
| 5 | O08 | Raghubhai ni Kitli | Old bus stand, Anand | T | L | cash | 0 | 7 | 0 | 28 | 8 | 0 | 0 | 0 | 4 | 0 | 4 | 1 | 0 | 0 | 1652.50 | 0.85 |
| 6 | O09 | Gunjwala Tea and Nasta | Sardar Gunj, Anand | T | M | cash | 0 | 5 | 0 | 20 | 6 | 0 | 0 | 0 | 3 | 0 | 3 | 1 | 0 | 0 | 1215.00 | 1 |
| 7 | O02 | Harivadan Kirana Bhandar | Gamdi Vad, Anand | P | M | cash | 0 | 14 | 2 | 9 | 2 | 0 | 0 | 2 | 4 | 1 | 3 | 1 | 1 | 1 | 1392.00 | 1 |
| 8 | O10 | Mithi Bite Bakery and Cake Shop | 100 Feet Road, Anand | B | L | weekly | 22000 | 15 | 4 | 8 | 4 | 3 | 1 | 6 | 6 | 1 | 4 | 3 | 3 | 3 | 2146.00 | 0.85 |
| 9 | O13 | Harshvardhan General Stores | Chikhodra Chokdi, Anand | G | M | cash | 0 | 16 | 4 | 5 | 2 | 1 | 1 | 3 | 4 | 1 | 3 | 1 | 1 | 2 | 1529.00 | 1 |
| 10 | O12 | Triguna Super Store | Borsad Chokdi, Anand | G | L | weekly | 21000 | 22 | 6 | 7 | 3 | 1 | 1 | 4 | 6 | 1 | 4 | 1 | 1 | 3 | 2064.50 | 0.85 |
| 11 | O03 | Amrutdhara Provision Store | Mangalpura, Anand | P | M | cash | 0 | 14 | 2 | 9 | 2 | 0 | 0 | 2 | 4 | 1 | 3 | 1 | 1 | 1 | 1392.00 | 1 |
| 12 | O07 | Makhanchor Dairy Parlour | Lambhvel Road, Anand | D | M | cash | 0 | 16 | 3 | 10 | 2 | 0 | 0 | 2 | 3 | 1 | 2 | 0 | 0 | 1 | 1316.50 | 1 |
| 13 | O04 | Kalrav Kirana Store | Jitodia Road, Anand | P | S | weekly | 12000 | 11 | 2 | 7 | 2 | 0 | 0 | 2 | 3 | 1 | 2 | 1 | 1 | 1 | 1148.00 | 1.6 |

**R2 - Vidyanagar-Karamsad** (11 outlets, 23.2 km, collection Tuesday). O14, O17, O20, O23 and O24 are
the five campus outlets (x 0.85 in college vacations).

| Seq | Id | Name | Locality | Type | Size | Terms | Credit limit | SB | BB | LP | BNP | BNS | BNW | PZ | TE | TM | KB | KJ | JB | TC | Rs/day opening list | Returns factor |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | O21 | Shramjivi Tea Stall | Vitthal Udyognagar, estate gate | T | M | cash | 0 | 5 | 0 | 20 | 6 | 0 | 0 | 0 | 3 | 0 | 3 | 1 | 0 | 0 | 1215.00 | 1 |
| 2 | O22 | Mavjibhai Chai Wala | Janta Chokdi | T | S | cash | 0 | 4 | 0 | 15 | 5 | 0 | 0 | 0 | 2 | 0 | 2 | 1 | 0 | 0 | 920.00 | 1.2 |
| 3 | O14 | Shardaben Provision Store | Nana Bazar, Vallabh Vidyanagar | P | L | weekly | 20000 | 20 | 3 | 13 | 3 | 0 | 0 | 3 | 6 | 1 | 4 | 1 | 1 | 1 | 1908.50 | 0.85 |
| 4 | O20 | Popatkaka Tea Corner | Bhaikaka Circle, Vallabh Vidyanagar | T | L | cash | 0 | 7 | 0 | 28 | 8 | 0 | 0 | 0 | 4 | 0 | 4 | 1 | 0 | 0 | 1652.50 | 0.85 |
| 5 | O17 | Vidyadham Milk Parlour | Mota Bazar, Vallabh Vidyanagar | D | L | weekly | 18000 | 22 | 4 | 14 | 3 | 0 | 0 | 3 | 4 | 1 | 3 | 0 | 0 | 1 | 1791.50 | 0.85 |
| 6 | O23 | Radhekunj Bake Shop | Iskcon Temple Road, Vallabh Vidyanagar | B | M | weekly | 16000 | 11 | 3 | 6 | 3 | 2 | 1 | 4 | 4 | 1 | 3 | 2 | 2 | 2 | 1551.00 | 1 |
| 7 | O24 | Shubhangi General Stores | New Vallabh Vidyanagar | G | M | cash | 0 | 16 | 4 | 5 | 2 | 1 | 1 | 3 | 4 | 1 | 3 | 1 | 1 | 2 | 1529.00 | 1 |
| 8 | O18 | Sardarbhumi Dairy Parlour | Anand-Karamsad Road, Karamsad | D | M | cash | 0 | 16 | 3 | 10 | 2 | 0 | 0 | 2 | 3 | 1 | 2 | 0 | 0 | 1 | 1316.50 | 1 |
| 9 | O15 | Lakshminandan Provision Store | Main bazar, Karamsad | P | M | cash | 0 | 14 | 2 | 9 | 2 | 0 | 0 | 2 | 4 | 1 | 3 | 1 | 1 | 1 | 1392.00 | 1 |
| 10 | O16 | Tulsikyara Kirana Store | Bakrol | P | S | cash | 0 | 11 | 2 | 7 | 2 | 0 | 0 | 2 | 3 | 1 | 2 | 1 | 1 | 1 | 1148.00 | 1.2 |
| 11 | O19 | Dhenukunj Dairy Parlour | Mogri | D | S | weekly | 11000 | 12 | 2 | 8 | 2 | 0 | 0 | 2 | 2 | 1 | 2 | 0 | 0 | 1 | 1060.00 | 3.5 |

**R3 - Nadiad** (9 outlets, 60.3 km, collection Wednesday; the van also drops store S3 after O32 and
corporate C07 after O27)

| Seq | Id | Name | Locality | Type | Size | Terms | Credit limit | SB | BB | LP | BNP | BNS | BNW | PZ | TE | TM | KB | KJ | JB | TC | Rs/day opening list | Returns factor |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | O28 | Uttamchand Provision Store | Uttarsanda | P | S | weekly | 12000 | 11 | 2 | 7 | 2 | 0 | 0 | 2 | 3 | 1 | 2 | 1 | 1 | 1 | 1148.00 | 1.6 |
| 2 | O32 | Sakarba Bakery | Piplag Road, Nadiad | B | M | weekly | 16000 | 11 | 3 | 6 | 3 | 2 | 1 | 4 | 4 | 1 | 3 | 2 | 2 | 2 | 1551.00 | 1 |
| 3 | O25 | Santcharan Provision Store | Santram Road, Nadiad | P | L | weekly | 20000 | 20 | 3 | 13 | 3 | 0 | 0 | 3 | 6 | 1 | 4 | 1 | 1 | 1 | 1908.50 | 0.85 |
| 4 | O31 | Lalji Maharaj Tea Stall | Station Road, Nadiad | T | M | cash | 0 | 5 | 0 | 20 | 6 | 0 | 0 | 0 | 3 | 0 | 3 | 1 | 0 | 0 | 1215.00 | 1 |
| 5 | O26 | Chandanvan Provision Store | College Road, Nadiad | P | M | cash | 0 | 14 | 2 | 9 | 2 | 0 | 0 | 2 | 4 | 1 | 3 | 1 | 1 | 1 | 1392.00 | 1 |
| 6 | O30 | Yamunatat Dairy Parlour | Vaniyavad, Nadiad | D | M | cash | 0 | 16 | 3 | 10 | 2 | 0 | 0 | 2 | 3 | 1 | 2 | 0 | 0 | 1 | 1316.50 | 1 |
| 7 | O29 | Shantisagar Milk Parlour | Mission Road, Nadiad | D | M | cash | 0 | 16 | 3 | 10 | 2 | 0 | 0 | 2 | 3 | 1 | 2 | 0 | 0 | 1 | 1316.50 | 1 |
| 8 | O27 | Devkinandan Provision Store | Pij Road, Nadiad | P | M | cash | 0 | 14 | 2 | 9 | 2 | 0 | 0 | 2 | 4 | 1 | 3 | 1 | 1 | 1 | 1392.00 | 1 |
| 9 | O33 | Ranchhodkrupa General Stores | Dakor Road, Nadiad | G | M | weekly | 16000 | 16 | 4 | 5 | 2 | 1 | 1 | 3 | 4 | 1 | 3 | 1 | 1 | 2 | 1529.00 | 1 |

**R4 - Borsad-Petlad** (7 outlets, 66.0 km, collection Thursday)

| Seq | Id | Name | Locality | Type | Size | Terms | Credit limit | SB | BB | LP | BNP | BNS | BNW | PZ | TE | TM | KB | KJ | JB | TC | Rs/day opening list | Returns factor |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | O36 | Charotarbhumi Kirana | Napad | P | S | cash | 0 | 11 | 2 | 7 | 2 | 0 | 0 | 2 | 3 | 1 | 2 | 1 | 1 | 1 | 1148.00 | 1.2 |
| 2 | O38 | Ishwarkaka Tea Stall | Anand Chokdi, Borsad | T | S | weekly | 10000 | 4 | 0 | 15 | 5 | 0 | 0 | 0 | 2 | 0 | 2 | 1 | 0 | 0 | 920.00 | 1.6 |
| 3 | O34 | Mahikantha Provision Store | Station Road, Borsad | P | L | weekly | 20000 | 20 | 3 | 13 | 3 | 0 | 0 | 3 | 6 | 1 | 4 | 1 | 1 | 1 | 1908.50 | 0.85 |
| 4 | O40 | Satyagrah General Stores | Bus stand, Borsad | G | S | cash | 0 | 12 | 3 | 4 | 2 | 1 | 1 | 2 | 3 | 1 | 2 | 1 | 1 | 2 | 1227.00 | 1.2 |
| 5 | O37 | Parijat Dairy Parlour | Dharmaj | D | S | cash | 0 | 12 | 2 | 8 | 2 | 0 | 0 | 2 | 2 | 1 | 2 | 0 | 0 | 1 | 1060.00 | 1.2 |
| 6 | O35 | Chandrakala Provision Store | Station Road, Petlad | P | M | cash | 0 | 14 | 2 | 9 | 2 | 0 | 0 | 2 | 4 | 1 | 3 | 1 | 1 | 1 | 1392.00 | 1 |
| 7 | O39 | Suhani Bakery | College Road, Petlad | B | S | cash | 0 | 8 | 2 | 5 | 2 | 2 | 1 | 3 | 3 | 1 | 2 | 2 | 2 | 2 | 1254.50 | 1.2 |

Route totals (packs on a normal day and value before GST):

| Route | Outlets | SB | BB | LP | BNP | BNS | BNW | PZ | TE | TM | KB | KJ | JB | TC | Rs/day opening list | Weekly outlets Rs/day | Cash outlets Rs/day | Rs/day after revision 1 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| R1 | 13 | 189 | 36 | 146 | 42 | 7 | 4 | 33 | 54 | 11 | 40 | 13 | 11 | 17 | 20423.00 | 10609.50 | 9813.50 | 21337.50 |
| R2 | 11 | 138 | 23 | 135 | 38 | 3 | 2 | 21 | 39 | 8 | 31 | 9 | 6 | 10 | 15484.00 | 6311.00 | 9173.00 | 16187.00 |
| R3 | 9 | 123 | 22 | 89 | 24 | 3 | 2 | 20 | 34 | 8 | 25 | 8 | 7 | 10 | 12768.50 | 6136.50 | 6632.00 | 13340.00 |
| R4 | 7 | 81 | 14 | 61 | 18 | 3 | 2 | 14 | 23 | 6 | 17 | 7 | 6 | 8 | 8910.00 | 2828.50 | 6081.50 | 9296.50 |
| All | 40 | 531 | 95 | 431 | 122 | 16 | 10 | 88 | 150 | 33 | 113 | 37 | 30 | 45 | 57585.50 | 25885.50 | 31700.00 | 60161.00 |

Terms by type: P 8 cash and 6 weekly; D 6 and 3; T 6 and 1; B 1 and 4; G 3 and 2. Localities are real
place names; shop names follow local habit and were web-checked on 2 October 2026 - any may be changed
without touching anything else.

### 6.4 Corporates (10) (A)

All invoices are on credit (`terms: 'credit'`); due date = invoice date + credit days. Every corporate
pays by bank transfer, **once a week on its payment weekday**, every invoice whose due date + its
lateness days has passed (next open day if closed). The order is placed the day before delivery (a
sales order dated D-1, or the last open day before D) and invoiced on delivery. Corporates return
nothing.

| Id | Name | Class | Type | Locality | Constitution | GSTIN | Credit days | Credit limit | Lateness days | Payment weekday | Order days | PO reference | Delivered by |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| C01 | Mahisagar Gears and Castings Pvt Ltd - staff canteen | IC | industrial canteen | Vitthal Udyognagar | private company | 24AAHCM4821K1ZF | 30 | 250000 | 0 | Monday | Mon-Sat | monthly, `PO/C01/YYYY-MM` | V5 |
| C02 | Annakut Canteen Services | IC | canteen contractor | Anand-Vidyanagar Road | partnership firm | 24ABKFA7315D1ZS | 30 | 150000 | 0 | Tuesday | Mon-Sat | monthly, `PO/C02/YYYY-MM` | V5 |
| C03 | Gyanjyot Kumar Chhatralaya - mess | HM | college hostel mess | University hostels, Vallabh Vidyanagar | education trust | none | 30 | 140000 | 0 | Wednesday | every day | none | V5 |
| C04 | Charak Bhavan Hostel Mess | HM | hostel mess, medical campus | Karamsad | mess committee | none | 30 | 100000 | 5 | Thursday | every day | none | V5 |
| C05 | Arogyatirth Charitable Trust Hospital - kitchen | HK | hospital kitchen | Karamsad | charitable trust | 24AACTA5126H1Z4 | 30 | 140000 | 10 | Friday | every day | annual, `RC/C05/YYYY` | V5 |
| C06 | Swadsangam Caterers | CT | caterer | 100 Feet Road, Anand | proprietor | 24BDLPT6247Q1ZM | 15 | 40000 | 20 | Monday | Tue Thu Sat | none | V5 |
| C07 | Thalrang Caterers | CT | caterer | Pij Road, Nadiad | proprietor | none | 15 | 30000 | 0 | Tuesday | Fri | none | V3 |
| C08 | Hotel Mahi Regency | HT | hotel with restaurant and banquet | Amul Dairy Road, Anand | LLP | 24AAVFM2468L1ZM | 30 | 180000 | 15 | Wednesday | every day | none | V5 |
| C09 | Gyanvatika English Medium School - canteen | SC | school canteen | Lambhvel Road, Anand | education trust | none | 15 | 90000 | 0 | Thursday | Mon-Sat in term | none | V5 |
| C10 | Crustwala Cafe | CF | cafe and fast-food counter | Vallabh Vidyanagar | proprietor | 24CKQPP3792M1Z9 | 15 | 75000 | 0 | Friday | alternate days | none | V5 |

- C10 orders on every day whose count from 2026-01-01 (that day = 0) is even.
- **C06 is the late payer and is over its limit** (12.4). C04, C05 and C08 pay late but stay inside
  their limits. The others pay within a week of the due date.
- C03, C04, C07 and C09 are not registered for GST: their invoices carry no customer GSTIN.

Typical order, units per order (the `pattern` of the customer; FG codes):

| Customer | Item | Units per order |
|---|---|---|
| C01 | FG03 | 40 |
| C01 | FG04 | 60 |
| C01 | FG08 | 16 |
| C01 | FG16 | 120 |
| C02 | FG03 | 22 |
| C02 | FG04 | 36 |
| C02 | FG16 | 60 |
| C02 | FG18 | 30 |
| C03 | FG03 | 40 |
| C03 | FG01 | 12 |
| C03 | FG04 | 24 |
| C03 | FG10 | 8 |
| C04 | FG03 | 20 |
| C04 | FG02 | 6 |
| C04 | FG04 | 15 |
| C04 | FG11 | 5 |
| C05 | FG03 | 24 |
| C05 | FG02 | 10 |
| C05 | FG01 | 10 |
| C05 | FG11 | 6 |
| C05 | FG10 | 5 |
| C06 | FG04 | 80 |
| C06 | FG08 | 24 |
| C06 | FG09 | 30 |
| C06 | FG05 | 20 |
| C06 | FG03 | 12 |
| C07 | FG04 | 100 |
| C07 | FG08 | 30 |
| C07 | FG03 | 24 |
| C07 | FG09 | 24 |
| C08 | FG03 | 14 |
| C08 | FG02 | 6 |
| C08 | FG08 | 12 |
| C08 | FG06 | 8 |
| C08 | FG09 | 10 |
| C08 | FG15 | 8 |
| C08 | FG14 | 4 |
| C09 | FG16 | 100 |
| C09 | FG17 | 30 |
| C09 | FG05 | 16 |
| C09 | FG01 | 6 |
| C09 | FG15 | 10 |
| C10 | FG08 | 40 |
| C10 | FG06 | 24 |
| C10 | FG07 | 12 |
| C10 | FG09 | 30 |
| C10 | FG18 | 30 |

Order values before GST, and what the rules of section 7 make of them over a year (expected values):

| Id | Typical order (units) | Order value opening list | Order value after revision 1 | Order value after revision 2 | With GST, after revision 1 | Orders in 2026 | Sales 2026 (Rs lakh) | Sales 2027 (Rs lakh) |
|---|---|---|---|---|---|---|---|---|
| C01 | JL 40, LP 60, BNJ 16, PV 120 | 5520.00 | 5762.00 | 5852.00 | 5828.00 | 301 | 16.93 | 17.61 |
| C02 | JL 22, LP 36, PV 60, PG 30 | 3178.00 | 3298.00 | 3388.00 | 3352.75 | 301 | 9.72 | 10.17 |
| C03 | JL 40, SB 12, LP 24, TE 8 | 3326.00 | 3512.00 | 3536.00 | 3527.80 | 362 | 10.68 | 11.02 |
| C04 | JL 20, BB 6, LP 15, TM 5 | 1938.00 | 2035.50 | 2055.50 | 2051.75 | 362 | 6.21 | 6.40 |
| C05 | JL 24, BB 10, SB 10, TM 6, TE 5 | 2414.50 | 2536.50 | 2575.50 | 2565.88 | 362 | 9.00 | 9.34 |
| C06 | LP 80, BNJ 24, PZ 30, BNP 20, JL 12 | 4676.00 | 4955.00 | 4955.00 | 4955.00 | 156 | 7.63 | 8.34 |
| C07 | LP 100, BNJ 30, JL 24, PZ 24 | 5442.00 | 5760.00 | 5760.00 | 5760.00 | 52 | 2.91 | 3.35 |
| C08 | JL 14, BB 6, BNJ 12, BNS 8, PZ 10, TC 8, JB 4 | 2267.00 | 2375.00 | 2413.00 | 2401.70 | 362 | 9.40 | 9.87 |
| C09 | PV 100, PP 30, BNP 16, SB 6, TC 10 | 2582.00 | 2621.00 | 2771.00 | 2722.75 | 251 | 6.46 | 6.76 |
| C10 | BNJ 40, BNS 24, BNW 12, PZ 30, PG 30 | 3401.00 | 3592.00 | 3637.00 | 3613.75 | 181 | 5.83 | 6.03 |

C06 and C07 buy only Nil-rated lines (bill of supply); the others get an invoice-cum-bill of supply.
On a given day each line = stochastic round( typical units x the day's corporate factor (section 7) x noise ),
noise uniform 0.95-1.05 per order. A factor of 0 means no order at all. All ten together average
Rs 25,214 a day at the price list after revision 1 with every factor at 1.00.

### 6.5 Own stores (3) (A)

"Sale" = units sold on a normal day (all factors 1). "Standing" = the store's fixed stock level, the
master the transfer sheet tops up to every morning (transfer = standing less the unexpired quantity at
the store or on the way). Standing is 1.5 normal days for FG01-FG03 and FG05-FG08, 1.6 days for FG04,
2 days for FG09, 3 days for FG15 and 5 days for FG10-FG14, each rounded up; for the puffs 1.12 x the
normal day (S2: 1.10), rounded up to 5. The seed sends exactly the transfer sheet, cut to factory
stock, every open day for every item.

| Code | Key | S1 sale | S2 sale | S3 sale | All sale | S1 standing | S2 standing | S3 standing | Unsaleable rate |
|---|---|---|---|---|---|---|---|---|---|
| FG01 | SB | 45 | 22 | 24 | 91 | 68 | 33 | 36 | 3.0% |
| FG02 | BB | 14 | 8 | 6 | 28 | 21 | 12 | 9 | 5.0% |
| FG03 | JL | 4 | 2 | 2 | 8 | 6 | 3 | 3 | 6.0% |
| FG04 | LP | 34 | 16 | 18 | 68 | 55 | 26 | 29 | 4.0% |
| FG05 | BNP | 10 | 10 | 5 | 25 | 15 | 15 | 8 | 4.0% |
| FG06 | BNS | 6 | 8 | 2 | 16 | 9 | 12 | 3 | 5.0% |
| FG07 | BNW | 4 | 4 | 2 | 10 | 6 | 6 | 3 | 6.0% |
| FG08 | BNJ | 3 | 4 | 1 | 8 | 5 | 6 | 2 | 6.0% |
| FG09 | PZ | 14 | 12 | 6 | 32 | 28 | 24 | 12 | 3.0% |
| FG10 | TE | 16 | 6 | 10 | 32 | 80 | 30 | 50 | 0.2% |
| FG11 | TM | 8 | 3 | 4 | 15 | 40 | 15 | 20 | 0.2% |
| FG12 | KB | 14 | 6 | 8 | 28 | 70 | 30 | 40 | 0.3% |
| FG13 | KJ | 8 | 4 | 4 | 16 | 40 | 20 | 20 | 0.3% |
| FG14 | JB | 8 | 4 | 4 | 16 | 40 | 20 | 20 | 0.2% |
| FG15 | TC | 14 | 12 | 5 | 31 | 42 | 36 | 15 | 2.0% |
| FG16 | PV | 130 | 140 | 65 | 335 | 150 | 155 | 75 | by date |
| FG17 | PP | 45 | 50 | 20 | 115 | 55 | 55 | 25 | by date |
| FG18 | PG | 40 | 50 | 15 | 105 | 45 | 55 | 20 | by date |

| Store | Sales at MRP opening list | Before GST opening list | Before GST after revision 1 | Before GST after revision 2 | Sales 2026 (Rs lakh, expected) | Sales 2027 (Rs lakh, expected) |
|---|---|---|---|---|---|---|
| S1 | 13,358 | 12,961 | 13,303 | 13,884 | 49.12 | 51.43 |
| S2 | 9,744 | 9,430 | 9,644 | 10,118 | 31.42 | 32.94 |
| S3 | 6,550 | 6,356 | 6,525 | 6,806 | 23.82 | 24.95 |

**Seasonal puff standing** - dated master changes entered by Accounts and admin on the first day of each
period, restored the day after it ends. Summer: 6 April to 10 June each year, all stores. College
vacation (S2 only, takes precedence over summer): 2026-04-27..2026-06-14, 2026-11-05..2026-11-25,
2027-04-27..2027-06-14, 2027-10-26..2027-11-15.

| Store | Item | Base standing | Summer standing (6 Apr - 10 Jun) | College-vacation standing (S2 only) |
|---|---|---|---|---|
| S1 | FG16 | 150 | 135 | - |
| S1 | FG17 | 55 | 50 | - |
| S1 | FG18 | 45 | 45 | - |
| S2 | FG16 | 155 | 140 | 110 |
| S2 | FG17 | 55 | 50 | 40 |
| S2 | FG18 | 55 | 50 | 40 |
| S3 | FG16 | 75 | 70 | - |
| S3 | FG17 | 25 | 25 | - |
| S3 | FG18 | 20 | 20 | - |

**Day-end entry** (one per store per open day, posted at closing):

- Units sold per item = min( stochastic round( sale x the day's store factor (7.5) x noise ), unexpired
  stock on hand ), noise uniform 0.90-1.10 per store, item and day. Oldest unexpired batch first.
- Expired units = every unsold unit whose best-before is the day-end date or earlier. In practice
  these are the puffs (all three, every day), ladi pav on a rare slow day, and whatever fresh stock is
  left behind a closed shutter over the Diwali break (it goes into the first day-end after reopening).
- UPI total = gross x share x (1 + u), to the rupee; share 60% at S1 and S3, 75% at S2; u uniform
  +/-8%. Cash counted = gross - UPI, less a shortage or plus an excess by the rule of 12.6.
- Store cash is deposited in the bank every Monday and Thursday morning (next open day if closed),
  leaving a Rs 3,000 float.

**Unsaleable stock** (squashed, dried or broken packs that are not yet past their date): every Sunday
after the day-end (the Monday after, if the Sunday is closed) each store manager raises one write-off
request, reason "damaged", with a line per item: quantity = stochastic round( units sold in the last
seven days x the item's unsaleable rate of the table above ), taken from the oldest batch on the shelf
and never more than is there. The Owner approves it the next morning. E029 raises it at S1, E032 at S2,
E034 at S3; the same three post the day-ends, confirm the transfers and raise their store's claims.

---

## 7. Demand model

All multipliers are (A). The three formulas:

```
retail line     = standing units x weekday (7.2) x month (7.3) x month-part (7.3) x events (7.4)
                  x campus vacation (7.6, five outlets) x summer (7.7) x rain (7.8) x noise
store line      = sale units x weekday (7.2) x month (7.3) x month-part (7.3) x events (7.4)
                  x college calendar (7.6, S2 only) x summer (7.7) x rain (7.8) x noise
corporate line  = typical units, on an order day of the customer
                  x events (7.4, by class) x calendar (7.6) x season (7.6) x heavy rain (7.8) x noise
```

### 7.1 What is dispatched, noise and rounding

- The dispatch sheet of a route is the standing orders changed the way a van salesman would: each line =
  stochastic round( retail line ), then cut to the unexpired stock in `fac_fg` if that is short.
- Noise: uniform 0.90-1.10 per outlet, item and day (stores the same, per store, item and day);
  corporates uniform 0.95-1.05 per order.
- Events multiply: every row of 7.4 whose dates contain the day applies, and all of them are multiplied
  together. A factor of 0 means no document at all for that customer or store that day.
- No volume growth is modelled: the year-on-year rise comes from the two price revisions and the
  calendar only.

### 7.2 Weekday factors

| Who | Sun | Mon | Tue | Wed | Thu | Fri | Sat |
|---|---|---|---|---|---|---|---|
| Outlet type P | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.05 |
| Outlet type D | 1.05 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.05 |
| Outlet type T | 0.60 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| Outlet type B | 1.15 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.10 |
| Outlet type G | 1.15 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.10 |
| Store S1 | 1.20 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.10 |
| Store S2 | 0.85 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| Store S3 | 1.15 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.05 |
| Hotel C08 | 1.20 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.20 |

Other corporates have no weekday factor, only order days (6.4). The vans run all seven days.

### 7.3 Month and time of month

Month factor, retail outlets and own stores only (not corporates), the same in both years:

| Jan | Feb | Mar | Apr | May | Jun | Jul | Aug | Sep | Oct | Nov | Dec |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1.03 | 1.02 | 1.00 | 0.96 | 0.92 | 0.97 | 1.03 | 1.04 | 1.02 | 1.00 | 0.98 | 1.04 |

Month-part factor, every product group:

| Day of the month | Retail outlets | Own stores | Corporates |
|---|---|---|---|
| 1 - 7 | 1.03 | 1.08 | 1.00 |
| 8 - 23 | 1.00 | 1.00 | 1.00 |
| 24 - end | 0.97 | 0.93 | 1.00 |

### 7.4 Dated events, 2026 and 2027

R- columns: retail outlets by product group. S- columns: own stores by product group. IC ... CF:
corporate classes (IC industrial canteen C01 C02; HM hostel mess C03 C04; HK hospital kitchen C05; CT
caterer C06 C07; HT hotel C08; SC school canteen C09; CF cafe C10); a class factor applies to every
line of the order. 1.00 = no effect. Dates for 2027 are from the panchang; the Islamic dates of 2027
(E08, E09, E12) are tentative by a day.

| Code | Event | Dates 2026 | Dates 2027 | R-BR | R-BN | R-DRY | S-BR | S-BN | S-DRY | S-PF | IC | HM | HK | CT | HT | SC | CF |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| E01 | Uttarayan eve | 2026-01-13 | 2027-01-13 | 1.10 | 1.15 | 1.05 | 1.15 | 1.20 | 1.10 | 1.10 | 1.00 | 1.00 | 1.00 | 1.20 | 1.10 | 1.00 | 1.00 |
| E02 | Uttarayan | 2026-01-14 | 2027-01-14 | 0.90 | 1.00 | 0.85 | 1.10 | 1.20 | 0.90 | 1.20 | 0.00 | 0.70 | 1.00 | 1.20 | 1.20 | 0.00 | 0.60 |
| E03 | Vasi Uttarayan | 2026-01-15 | 2027-01-15 | 0.80 | 0.85 | 0.80 | 0.90 | 1.00 | 0.90 | 1.00 | 0.50 | 0.70 | 1.00 | 1.00 | 1.10 | 0.00 | 0.70 |
| E04 | Republic Day and Independence Day | 2026-01-26 2026-08-15 | 2027-01-26 2027-08-15 | 1.00 | 1.00 | 1.00 | 1.05 | 1.10 | 1.05 | 1.15 | 0.00 | 1.00 | 1.00 | 1.00 | 1.10 | 0.00 | 1.10 |
| E05 | Maha Shivratri | 2026-02-15 | 2027-03-06 | 0.85 | 0.85 | 0.95 | 0.85 | 0.85 | 0.95 | 0.75 | 1.00 | 0.85 | 1.00 | 1.00 | 1.00 | 0.00 | 0.85 |
| E06 | Holi (Holika Dahan) | 2026-03-03 | 2027-03-21 | 1.00 | 1.00 | 1.00 | 1.05 | 1.05 | 1.05 | 1.05 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| E07 | Dhuleti | 2026-03-04 | 2027-03-22 | 0.60 | 0.60 | 0.60 | 0.70 | 0.70 | 0.70 | 0.70 | 0.00 | 0.70 | 1.00 | 1.00 | 1.10 | 0.00 | 0.50 |
| E08 | Ramadan, every day | 2026-02-19..2026-03-20 | 2027-02-09..2027-03-09 | 1.04 | 1.03 | 1.06 | 1.02 | 1.02 | 1.03 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| E09 | Eid al-Fitr | 2026-03-21 | 2027-03-10 | 0.97 | 1.00 | 0.97 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.20 | 1.00 | 0.00 | 1.00 |
| E10 | Ram Navami | 2026-03-26 | 2027-04-15 | 0.95 | 0.95 | 1.00 | 0.93 | 0.95 | 1.00 | 0.90 | 1.00 | 0.90 | 1.00 | 1.00 | 1.00 | 0.00 | 1.00 |
| E11 | Mahavir Jayanti | 2026-03-31 | 2027-04-19 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 0.00 | 1.00 |
| E12 | Eid al-Adha | 2026-05-28 | 2027-05-17 | 1.05 | 1.05 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.20 | 1.00 | 0.00 | 1.00 |
| E13 | Rath Yatra | 2026-07-16 | 2027-07-05 | 1.00 | 1.00 | 1.00 | 1.03 | 1.03 | 1.05 | 1.05 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 0.00 | 1.00 |
| E14 | Shravan, every day | 2026-08-13..2026-09-11 | 2027-08-03..2027-08-31 | 0.96 | 0.96 | 1.00 | 0.95 | 0.95 | 1.00 | 0.90 | 1.00 | 0.95 | 1.00 | 1.00 | 1.00 | 1.00 | 0.95 |
| E15 | Shravan Mondays (on top of E14) | Mondays in 2026-08-13..2026-09-11 | Mondays in 2027-08-03..2027-08-31 | 0.95 | 0.97 | 1.00 | 0.93 | 0.95 | 1.00 | 0.90 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| E16 | Raksha Bandhan | 2026-08-28 | 2027-08-17 | 1.00 | 1.00 | 1.08 | 1.05 | 1.05 | 1.20 | 1.10 | 0.00 | 0.80 | 1.00 | 1.00 | 1.15 | 0.00 | 0.85 |
| E17 | Shitala Satam | 2026-09-03 | 2027-08-24 | 1.08 | 1.05 | 1.12 | 1.10 | 1.05 | 1.15 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| E18 | Janmashtami | 2026-09-04 | 2027-08-25 | 0.85 | 0.85 | 0.95 | 0.80 | 0.85 | 1.00 | 0.70 | 0.00 | 0.70 | 1.00 | 1.00 | 1.10 | 0.00 | 0.70 |
| E19 | Paryushan, every day | 2026-09-08..2026-09-15 | 2027-08-28..2027-09-04 | 0.98 | 0.98 | 0.98 | 0.97 | 0.97 | 0.97 | 0.93 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| E20 | Samvatsari (on top of E19) | 2026-09-15 | 2027-09-04 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 0.00 | 1.00 |
| E21 | Ganesh Chaturthi | 2026-09-14 | 2027-09-04 | 1.02 | 1.02 | 1.00 | 1.03 | 1.05 | 1.05 | 1.10 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| E22 | Ganeshotsav | 2026-09-15..2026-09-25 | 2027-09-05..2027-09-14 | 1.02 | 1.02 | 1.00 | 1.00 | 1.03 | 1.00 | 1.05 | 1.00 | 1.00 | 1.00 | 1.05 | 1.00 | 1.00 | 1.00 |
| E23 | Navratri, nine nights | 2026-10-11..2026-10-19 | 2027-09-30..2027-10-08 | 1.05 | 1.12 | 1.00 | 1.03 | 1.15 | 1.00 | 1.20 | 1.00 | 1.00 | 1.00 | 1.20 | 1.10 | 1.00 | 1.25 |
| E24 | Dussehra | 2026-10-20 | 2027-10-09 | 0.90 | 0.95 | 0.90 | 0.90 | 0.95 | 0.95 | 0.85 | 0.00 | 0.85 | 1.00 | 1.00 | 1.10 | 0.00 | 0.90 |
| E25 | Diwali run-up, 7 days | 2026-11-01..2026-11-07 | 2027-10-22..2027-10-28 | 1.00 | 1.00 | 1.25 | 1.00 | 1.00 | 1.40 | 1.05 | 1.00 | 1.00 | 1.00 | 1.10 | 1.10 | 1.00 | 1.00 |
| E26 | Diwali day | 2026-11-08 | 2027-10-29 | 0.80 | 0.80 | 1.10 | 0.85 | 0.85 | 1.30 | 0.80 | 0.00 | 1.00 | 2.50 / 2.00 | 1.00 | 2.50 / 2.00 | 1.00 | 0.70 |
| E27 | Closed days | 2026-11-09..2026-11-11 | 2027-10-30..2027-10-31 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| E28 | Reopening days | 2026-11-12..2026-11-13 | 2027-11-01..2027-11-02 | 0.60 | 0.60 | 0.60 | 0.70 | 0.70 | 0.80 | 0.70 | 0.00 | 1.00 | 1.00 | 0.80 | 1.15 | 1.00 | 0.50 |
| E29 | Labh Pancham | 2026-11-14 | 2027-11-03 | 0.85 | 0.85 | 0.85 | 0.90 | 0.90 | 0.90 | 0.90 | 0.60 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 0.80 |
| E30 | Six days after Labh Pancham | 2026-11-15..2026-11-20 | 2027-11-04..2027-11-09 | 0.93 | 0.93 | 0.93 | 0.96 | 0.96 | 0.96 | 0.96 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| E31 | Christmas eve and Christmas | 2026-12-24 2026-12-25 | 2027-12-24 2027-12-25 | 1.00 | 1.05 | 1.08 | 1.05 | 1.15 | 1.15 | 1.15 | 1.00 | 1.00 | 1.00 | 1.20 | 1.20 | 1.00 / 0.00 | 1.20 |
| E32 | 31 December | 2026-12-31 | 2027-12-31 | 1.05 | 1.10 | 1.00 | 1.10 | 1.25 | 1.05 | 1.25 | 1.00 | 1.00 | 1.00 | 1.20 | 1.30 | 1.00 | 1.30 |

- E15 applies on the Mondays inside E14, on top of E14.
- E26, columns HK and HT: 2.50 in 2026 and 2.00 in 2027 (`1 + 0.5 x the closed days that follow`): the
  hospital and the hotel stock up on Diwali day.
- E31, column SC: 1.00 on 24 December, 0.00 on 25 December.
- A weekly or alternate-day order that falls on a closed day is not placed and not carried forward.

**Closed days and factory holidays.**

| | 2026 | 2027 |
|---|---|---|
| Closed days: no dispatch, no corporate delivery, no transfer, stores shut, no day-end | 2026-11-09 2026-11-10 2026-11-11 | 2027-10-30 2027-10-31 |
| Factory holidays: no production entry | 2026-11-08 2026-11-09 2026-11-10 | 2027-10-29 2027-10-30 |
| First dispatch after the break | 2026-11-12 | 2027-11-01 |

Closed days run from the day after Diwali to Bhai Bij; a factory holiday is every day whose next morning
has no dispatch. There are no others. On a closed day nothing is received, approved, paid, collected,
deposited or reimbursed: each such step moves to the next open day. **A bill keeps its own date** (the
salary bill and month-end bills of 31 October 2027 stay in October; only their approval and payment
move). Stale-return credit notes due on a closed day are raised on the next open day.

### 7.5 Store factor

The store line of the formula above; the S- columns of 7.4 by the item's group; S2 also takes the
college calendar of 7.6.

### 7.6 Calendars and seasons for particular customers

| Calendar | Periods |
|---|---|
| College vacation | 2026-04-27..2026-06-14; 2026-11-05..2026-11-25; 2027-04-27..2027-06-14; 2027-10-26..2027-11-15 |
| College examinations | 2026-03-30..2026-04-25; 2026-10-19..2026-11-04; 2026-11-26..2026-12-16; 2027-03-29..2027-04-26; 2027-10-11..2027-10-25; 2027-11-16..2027-12-06 |
| School vacation | 2026-05-04..2026-06-07; 2026-11-05..2026-11-25; 2027-05-03..2027-06-06; 2027-10-26..2027-11-15 |
| Board examinations | 2026-02-26..2026-03-16; 2027-02-25..2027-03-17 |
| Wedding windows | 2026-02-05..2026-03-12; 2026-04-15..2026-05-14; 2026-06-21..2026-07-11; 2026-11-21..2026-12-12; 2027-01-15..2027-03-14; 2027-04-18..2027-07-12; 2027-11-10..2027-12-14 |
| NRI season | every 15 December to 31 January |
| Chaturmas gap | 2026-07-12..2026-11-20; 2027-07-13..2027-11-09 |

| Who | Calendar | Term | Examination weeks | Vacation |
|---|---|---|---|---|
| C03, C04 | college | 1.00 | 1.00 | 0.30 |
| C10 | college | 1.00 | 0.90 | 0.70 |
| S2 (every item) | college | 1.00 | 0.95 | 0.70 |
| O14, O17, O20, O23, O24 | college | 1.00 | 1.00 | 0.85 |
| C09 | school | 1.00 | 0.80 in board-examination weeks | 0.00 (no orders) |

Caterers C06 and C07, first match wins: inside a wedding window 1.35; else in the NRI season 1.20; else
in the Chaturmas gap 0.70; else 0.90. Hotel C08: x 1.10 on any day in a wedding window or the NRI
season, on top of its weekend factor. The college dates after 14 June 2027 and the Diwali vacations of
2027 are (A).

### 7.7 Summer

From 6 April to 10 June each year:

| Channel | BR | BN | DRY | PF |
|---|---|---|---|---|
| Retail outlets | 1.01 | 1.01 | 0.98 | - |
| Own stores | 1.03 | 1.03 | 0.98 | 0.95 |
| Corporates | 1.00 | 1.00 | 1.00 | 1.00 |

### 7.8 Rain

Wet season: 2026-06-28..2026-09-24 and 2027-06-20..2027-09-20. One draw per date inside the season,
the same for every route and store: the day is **wet** if the draw is under the month's probability
(June 0.45, July 0.45, August 0.40, September 0.33).

**Heavy-rain days** (never also wet days): 2026-07-09, 2026-07-23, 2026-07-31, 2026-08-01, 2026-08-18,
2026-09-06 and 2027-06-29, 2027-07-09, 2027-07-20, 2027-07-29, 2027-08-12, 2027-08-21, 2027-09-08 hit
all routes and stores; 2026-09-14 hits route R4 only (routes R1-R3 and the stores are wet that day).
31 July and 14 September 2026 are from the record; the rest are (A).

| Day | Channel | BR | BN | DRY | PF |
|---|---|---|---|---|---|
| Wet | Retail outlets | 0.99 | 0.99 | 1.02 | - |
| Wet | Own stores | 0.95 | 0.95 | 0.97 | 1.08 |
| Heavy | Retail outlets on a route that is hit | 0.82 | 0.82 | 0.82 | - |
| Heavy | Own stores | 0.70 | 0.70 | 0.75 | 0.75 |

Corporates: 1.00 on a wet day; on a heavy day caterers 0.90 and the cafe 0.80.

### 7.9 Stale returns (retail outlets only)

```
returned units = stochastic round( units dispatched on (D - lag) x item rate x outlet factor x season factor )
```

| Code | Key | Return rate | Lag in days |
|---|---|---|---|
| FG01 | SB | 4.5% | 3 |
| FG02 | BB | 6.0% | 3 |
| FG03 | JL | 5.0% | 3 |
| FG04 | LP | 5.5% | 2 |
| FG05 | BNP | 5.0% | 3 |
| FG06 | BNS | 5.5% | 3 |
| FG07 | BNW | 6.0% | 3 |
| FG08 | BNJ | 5.0% | 3 |
| FG09 | PZ | 4.0% | 4 |
| FG10 | TE | 0.3% | 30 |
| FG11 | TM | 0.3% | 30 |
| FG12 | KB | 0.5% | 30 |
| FG13 | KJ | 0.5% | 30 |
| FG14 | JB | 0.3% | 30 |
| FG15 | TC | 1.5% | 10 |

- FG03 and FG08 return only if a user adds them to a sheet; puffs are not on the routes.
- **Outlet factor**: L 0.85, M 1.00, S 1.20; the slow outlets O04, O28 and O38 1.60; **O19 3.50**.
- **Season factor** by the dispatch date: 1.25 in July, August and September, otherwise 1.00; 1.60 for
  the dispatch of a heavy-rain day on a route that is hit.
- One credit note per outlet per visit day with a line for each item returned, at the price of the
  invoice it reverses. The returned stock is destroyed: nothing comes back into stock.
- Expected result: 3.7% of retail supply on a normal day (5.3% on the fresh lines, 0.5% on the long-life
  lines), about 3.9% over a year. Against the 8% limit: O19 runs at 13.2% (16.4% in the monsoon) and
  its notes wait for the Owner; O38 6.5% (8.1%); O04 and O28 5.2% (6.6%); every other outlet at or
  under 4.8% (6.1%). Outside the monsoon only O19 is held, now and then another small outlet when the
  rounding runs against it.

### 7.10 Store expiry

See 6.5. Expected: 8-20% of the puffs sent to the stores expire, by month (about 13% over a year; the
highest months are May and November, the lowest December to February), with 0-4% of puff demand lost to
stock-outs on strong days; the unsaleable rates of 6.5 add about 12 packs a day across the three stores.
Together with the factory's own expired stock, write-offs come to about 1.1% of sales.

---

## 8. People

### 8.1 Rules

- 35 employees are active on 2026-01-01 (E001-E035). Two leave and three join in 2026; nobody joins or
  leaves in 2027. Headcount: 35; 34 from 1 to 8 March 2026; 35 from 9 March; 36 from 15 June 2026.
- An employee is active on day d when `doj <= d` and (`dol` is empty or `dol >= d`). The salary bill of
  a month takes everyone active on its last day at the full monthly salary; no part months.
- Monthly salary is the whole monthly cost of the person (A); payroll matters are out of scope.
- **Raise: +8% on 1 April 2026 and 1 April 2027, rounded to the nearest Rs 100**, for everyone who
  joined on or before 31 December of the year before. The owner takes no raise. Each raise is a dated
  master change with the note "annual increment 8%". The table holds the results; it binds.
- Every salary stays above the Gujarat Zone I minimum wage (Rs 13,013 unskilled on 1 January 2026,
  Rs 13,325 from 1 April 2026, about Rs 13,793 by October 2027 (A)); no floor rule is needed.
- A leaver stays in the directory with status Inactive. Contact numbers: the generator invents a
  10-digit number per employee from the seeded stream, shown masked.
- Grade: U unskilled, SS semi-skilled, S skilled, M supervisory or managerial.

### 8.2 The directory

| Id | Name | Department | Designation | Unit | Joined | Left | Grade | Salary from 2026-01-01 | Salary from 2026-04-01 | Salary from 2027-04-01 |
|---|---|---|---|---|---|---|---|---|---|---|
| E001 | Nilesh Patel | Accounts and admin | Owner (proprietor) | factory | 2011-04-01 | | M | 90000 | 90000 | 90000 |
| E002 | Falguni Shah | Accounts and admin | Accounts and admin executive | factory | 2016-06-16 | | M | 28000 | 30200 | 32600 |
| E003 | Krupa Macwan | Accounts and admin | Accounts assistant (billing) | factory | 2023-07-03 | | SS | 15500 | 16700 | 18000 |
| E004 | Imran Vohra | Stores and purchase | Purchase and stores keeper | factory | 2014-02-10 | | M | 24000 | 25900 | 28000 |
| E005 | Ramesh Padhiyar | Stores and purchase | Stores helper | factory | 2021-09-01 | | U | 14000 | 15100 | 16300 |
| E006 | Bharat Prajapati | Production | Production supervisor | factory | 2012-05-05 | | M | 32000 | 34600 | 37400 |
| E007 | Salim Malek | Production | Master baker, bread and buns | factory | 2013-08-12 | | S | 24000 | 25900 | 28000 |
| E008 | Dinesh Solanki | Production | Master baker, toast, khari and biscuit | factory | 2015-01-02 | | S | 23000 | 24800 | 26800 |
| E009 | Mukesh Parmar | Production | Pastry and puff maker | factory | 2019-11-18 | | S | 20000 | 21600 | 23300 |
| E010 | Vijay Chauhan | Production | Oven operator | factory | 2018-03-07 | | S | 17000 | 18400 | 19900 |
| E011 | Sanjay Rathod | Production | Mixer operator | factory | 2020-06-21 | | S | 16500 | 17800 | 19200 |
| E012 | Kanu Thakor | Production | Production helper | factory | 2022-04-04 | | U | 14000 | 15100 | 16300 |
| E013 | Arvind Vaghela | Production | Production helper | factory | 2022-07-15 | | U | 14000 | 15100 | 16300 |
| E014 | Raju Baria | Production | Production helper | factory | 2024-10-09 | | U | 13800 | 14900 | 16100 |
| E015 | Suresh Tadvi | Production | Production helper | factory | 2025-06-02 | | U | 13800 | 14900 | 16100 |
| E016 | Jyotsna Makwana | Packing | Packing in-charge | factory | 2016-12-01 | | S | 17500 | 18900 | 20400 |
| E017 | Mahesh Gohil | Packing | Slicing machine operator | factory | 2021-02-14 | | SS | 15000 | 16200 | 17500 |
| E018 | Manjula Vankar | Packing | Packer | factory | 2022-08-05 | | U | 13800 | 14900 | 16100 |
| E019 | Sharda Rohit | Packing | Packer | factory | 2024-01-20 | | U | 13800 | 14900 | 16100 |
| E020 | Hansa Parmar | Packing | Packer | factory | 2025-03-17 | 2026-02-28 | U | 13800 | | |
| E021 | Hardik Thakkar | Dispatch and sales | Sales and dispatch executive | factory | 2017-07-01 | | M | 27000 | 29200 | 31500 |
| E022 | Yusuf Pathan | Dispatch and sales | Driver-salesman, route R1 | factory | 2015-06-06 | | S | 19000 | 20500 | 22100 |
| E023 | Jignesh Rabari | Dispatch and sales | Driver-salesman, route R2 | factory | 2018-09-19 | | S | 19000 | 20500 | 22100 |
| E024 | Prakash Christian | Dispatch and sales | Driver-salesman, route R3 | factory | 2020-02-03 | | S | 18500 | 20000 | 21600 |
| E025 | Ashok Bharwad | Dispatch and sales | Driver-salesman, route R4 | factory | 2023-05-23 | 2026-07-31 | S | 18500 | 20000 | |
| E026 | Kiran Darji | Dispatch and sales | Driver, corporate and store deliveries | factory | 2024-01-08 | | S | 18000 | 19400 | 21000 |
| E027 | Vipul Raval | Dispatch and sales | Delivery helper | factory | 2023-03-01 | | U | 13800 | 14900 | 16100 |
| E028 | Anil Vasava | Dispatch and sales | Delivery helper | factory | 2024-12-12 | | U | 13800 | 14900 | 16100 |
| E029 | Ketan Bhatt | Own stores | Store manager | st_anand | 2017-10-10 | | M | 23000 | 24800 | 26800 |
| E030 | Rekha Solanki | Own stores | Counter assistant | st_anand | 2023-05-06 | | SS | 14000 | 15100 | 16300 |
| E031 | Chirag Panchal | Own stores | Counter assistant | st_anand | 2024-11-11 | | SS | 13800 | 14900 | 16100 |
| E032 | Nisha Desai | Own stores | Store manager | st_vvn | 2019-04-15 | | M | 22000 | 23800 | 25700 |
| E033 | Pooja Mistry | Own stores | Counter assistant | st_vvn | 2024-09-02 | | SS | 14000 | 15100 | 16300 |
| E034 | Alpesh Trivedi | Own stores | Store manager | st_nadiad | 2021-08-01 | | M | 19000 | 20500 | 22100 |
| E035 | Daxa Chauhan | Own stores | Counter assistant | st_nadiad | 2025-02-24 | | SS | 13800 | 14900 | 16100 |
| E036 | Geeta Padhiyar | Packing | Packer | factory | 2026-03-09 | | U | 13800 | 13800 | 14900 |
| E037 | Riya Joshi | Own stores | Counter assistant | st_vvn | 2026-06-15 | | SS | 14500 | 14500 | 15700 |
| E038 | Firoz Shaikh | Dispatch and sales | Driver-salesman, route R4 | factory | 2026-08-01 | | S | 19500 | 19500 | 21100 |

For E036, E037 and E038 the first column is the starting salary on the joining date (no raise in 2026).
E036 replaces E020; E037 is a new post for the college term; E038 replaces E025.

Checks. Headcount on 1 January 2026: Production 10, Packing 5, Stores and purchase 2, Dispatch and
sales 8, Accounts and admin 3, Own stores 7. By unit: factory 28, st_anand 3, st_vvn 2, st_nadiad 2.
The salary bill, one line per unit:

| Salary bill of | factory | st_anand | st_vvn | st_nadiad | Total | Active on the last day |
|---|---|---|---|---|---|---|
| 2026-01 to 2026-03 | 581100 | 50800 | 36000 | 32800 | 700700 | 35 |
| 2026-04 and 2026-05 | 619100 | 54800 | 38900 | 35400 | 748200 | 35 |
| 2026-06 and 2026-07 | 619100 | 54800 | 53400 | 35400 | 762700 | 36 |
| 2026-08 to 2027-03 | 618600 | 54800 | 53400 | 35400 | 762200 | 36 |
| 2027-04 to 2027-12 | 660900 | 59200 | 57700 | 38200 | 816000 | 36 |

Timing: the bill is raised by Accounts and admin on the last day of the month, approved by the Owner
the next morning and paid from the bank on the 5th of the next month. December 2025 was paid before
go-live.

### 8.3 The six personas

| User id | Persona | Role | Employee | Scope |
|---|---|---|---|---|
| u_owner | Owner | owner | E001 Nilesh Patel | everything |
| u_accounts | Accounts and admin | accounts | E002 Falguni Shah | everything |
| u_stores | Purchase and stores | stores | E004 Imran Vohra | factory stock, vendors |
| u_production | Production supervisor | production | E006 Bharat Prajapati | recipes, raw and finished stock |
| u_sales | Sales and dispatch | sales | E021 Hardik Thakkar | customers, finished stock |
| u_store_mgr | Store manager | store_mgr | E032 Nisha Desai | store S2 (`st_vvn`) only |

In the seed every document carries one of these six user ids. Day-ends, transfer confirmations and
claims of S1 and S3 are raised under `u_store_mgr` too, with the note naming their own manager (E029,
E034); a store claim is payable to that store's manager.

---

## 9. Overheads, expense categories and claims

### 9.1 Expense categories

| Id | Name | Mode | Typical month Rs (October 2026 rates) |
|---|---|---|---|
| salaries | Salaries | bill | 762200 |
| rent | Rent | bill | 164500 |
| electricity | Electricity | bill | 91800 |
| oven_fuel | Oven fuel (gas) | bill | 117200 |
| vehicle_fuel | Vehicle fuel | both | 58800 |
| vehicle_maint | Vehicle maintenance | both | 12700 |
| repairs | Repairs and maintenance | both | 27400 |
| licences | Licences and insurance | bill | 16200 |
| telephone | Telephone and internet | both | 7000 |
| professional | Professional fees | bill | 17000 |
| bank_charges | Bank charges | bill | 3600 |
| staff_welfare | Staff welfare | both | 18700 |
| marketing | Marketing | both | 13800 |
| running | Running costs | both | 25600 |
| cash_short | Store cash short / excess | bill | 300 |

`salaries` is the system category of the salary bill and `cash_short` of the day-end difference.
Production loss, write-offs and count differences are material-cost lines, not categories.

### 9.2 Common rules for expense bills

- `V(M)` = (kg of maida and atta consumed in month M / days in M) divided by the same figure for January
  2026. `V` = 1 for December 2025. Expected values of `V` are in 11.6.
- A utility bill dated in month M covers the consumption of M-1 and is an expense of M. January 2026
  carries the bills for December 2025; there is no opening expense payable.
- Every expense bill waits for the Owner, who approves it the next morning; accounts pays it from the
  bank on its due date. Due date = bill date + the vendor's terms (5.3). On any business date the bills
  of the day before are still pending and approved bills not yet due are unpaid.
- A bill is never dated on a closed day unless its rule fixes the date (a month-end bill keeps it).
- "Noise +/-x%" = one draw per bill. Amounts are rounded to the rupee. Unit = factory unless a store is
  named. GST on a bill is input credit.

### 9.3 Price series used by the rules

| Diesel, Rs a litre (no GST) | From |
|---|---|
| 90.13 | 2025-12-16 |
| 93.13 | 2026-05-15 |
| 94.03 | 2026-05-19 |
| 94.94 | 2026-05-23 |
| 97.65 | 2026-05-25 |
| 97.89 | 2026-07-01, held to 2027-12-31 (A) |

| Piped gas, Rs per SCM (A; no GST) | Consumption months |
|---|---|
| 52.00 | 2025-12 to 2026-02 |
| 56.00 | 2026-03 |
| 60.00 | 2026-04 |
| 66.00 | 2026-05 and 2026-06 |
| 64.00 | 2026-07 |
| 63.00 | 2026-08 and 2026-09 |
| 62.00 | 2026-10 to 2027-03 |
| 63.00 | 2027-04 to 2027-12 |

Electricity: factory energy Rs 4.60 a unit, stores Rs 4.35; fuel surcharge F = Rs 2.45 a unit for
consumption months to March 2026 and Rs 2.52 after (A); fixed charge Rs 4,900 a month at the factory and
Rs 250 at a store; duty 10% at the factory and 20% at a store; no GST.

| Month | Jan | Feb | Mar | Apr | May | Jun | Jul | Aug | Sep | Oct | Nov | Dec |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `S_f` factory | 0.94 | 0.95 | 1.00 | 1.06 | 1.10 | 1.08 | 1.02 | 1.00 | 1.00 | 1.00 | 0.95 | 0.93 |
| `S_s` stores | 0.80 | 0.85 | 1.00 | 1.20 | 1.30 | 1.25 | 1.10 | 1.05 | 1.05 | 1.00 | 0.85 | 0.80 |

### 9.4 The bills, one rule each (A)

M-1 = the consumption month. "Day" = day of the month of the bill date.

| # | Category | Bill | Vendor | Unit | Bill date | Amount before GST | GST % |
|---|---|---|---|---|---|---|---|
| 1 | rent | Factory shed | VE01 | factory | 1st of each month | 90000; 94500 from 2026-04; 99200 from 2027-04 | 18 |
| 2 | rent | Store S1 | VE02 | st_anand | 1st | 30000; 31500 from 2026-10; 33100 from 2027-10 | 0 |
| 3 | rent | Store S2 | VE03 | st_vvn | 1st | 22000; 23500 from 2026-07; 25100 from 2027-07 | 0 |
| 4 | rent | Store S3 | VE04 | st_nadiad | 1st | 15000; 15800 from 2027-01 | 0 |
| 5 | electricity | Factory | VE05 | factory | 6th | `(kWh x (4.60 + F) + 4900) x 1.10`, kWh = `310 x days in M-1 x S_f(M-1) x (0.60 + 0.40 x V(M-1))`, noise +/-3% | 0 |
| 6 | electricity | Store S1 | VE05 | st_anand | 12th | `(kWh x (4.35 + F) + 250) x 1.20`, kWh = `620 x S_s(M-1)`, noise +/-5% | 0 |
| 7 | electricity | Store S2 | VE05 | st_vvn | 12th | same formula, kWh = `520 x S_s(M-1)`, x 0.85 when M-1 is May or November, noise +/-5% | 0 |
| 8 | electricity | Store S3 | VE05 | st_nadiad | 12th | same formula, kWh = `400 x S_s(M-1)`, noise +/-5% | 0 |
| 9 | oven_fuel | Piped gas | VE06 | factory | 3rd | SCM x price of M-1, SCM = `63 x days in M-1 x (0.30 + 0.70 x V(M-1))`, noise +/-3% | 0 |
| 10 | vehicle_fuel | Diesel on account, days 1-15 | VE07 | factory | 16th | sum over the open days 1-15 of 19.0 litres x that day's price, noise +/-4% | 0 |
| 11 | vehicle_fuel | Diesel on account, day 16 to month end | VE07 | factory | 1st of the next month | the same sum for those days, noise +/-4% | 0 |
| 12 | vehicle_maint | Van service: V1 and V4 in Jan Apr Jul Oct; V2 and V5 in Feb May Aug Nov; V3 in Mar Jun Sep Dec | VE11 | factory | 12th for V1, V2, V3; 22nd for V4, V5 | 3800 - 5200 per van, uniform | 18 |
| 13 | vehicle_maint | Tyres: V1 April, V2 May, V3 June, V4 October, V5 November | VE11 | factory | the date of that month's service | 9600 | 18 |
| 14 | vehicle_maint | Battery: V5 in 2026, V2 in 2027 | VE11 | factory | 22 August | 6500 | 18 |
| 15 | repairs | Annual maintenance contract, ovens, mixers, slicers, cold room | VE08 | factory | 10th of Jan Apr Jul Oct | 36000 | 18 |
| 16 | repairs | Breakdown and spares | VE12 | factory | a seeded day from the 8th to the 26th, every month | 3000 - 10000, uniform | 18 |
| 17 | repairs | Second breakdown bill | VE12 | factory | a seeded day from the 8th to the 26th in Mar Jun Sep Dec | 8000 - 16000, uniform | 18 |
| 18 | repairs | Generator service | VE08 | factory | 15 May and 15 November | 4500 | 18 |
| 19 | repairs | Proofer compressor replaced (one seeded event) | VE08 | factory | 2026-08-18 | 42000 | 18 |
| 20 | licences | Product testing at a food laboratory | VE15 | factory | 10 January and 10 July | 6500 | 18 |
| 21 | licences | Weights and measures verification | VE14 | factory | 15 February | 1500 | 0 |
| 22 | licences | Van insurance: V1 20 Feb, V2 20 May, V3 20 Jul, V4 20 Sep, V5 20 Nov | VE13 | factory | those dates | 22000 each | 18 |
| 23 | licences | Van fitness and permit fee | VE14 | factory | the same five dates | 1500 each | 0 |
| 24 | licences | Fire and burglary cover | VE13 | factory | 1 April | 24000 | 18 |
| 25 | licences | Employees' compensation policy | VE13 | factory | 1 April | 18000 | 18 |
| 26 | licences | Money-in-transit and fidelity cover | VE13 | factory | 1 April | 4500 | 18 |
| 27 | licences | Food licence fee, manufacturer | VE14 | factory | 10 June | 5000 | 0 |
| 28 | licences | Food licence fee, retail counter | VE14 | each store | 10 June | 2000 each | 0 |
| 29 | licences | Professional tax, employer's enrolment | VE14 | factory | 25 September | 2500 | 0 |
| 30 | licences | Factory licence renewal | VE14 | factory | 20 October | 2000 | 0 |
| 31 | telephone | Broadband and mobiles | VE09 | factory | 5th | 3989 | 18 |
| 32 | telephone | Broadband and one mobile | VE09 | each store | 5th | 898 each | 18 |
| 33 | professional | Monthly retainer | VE10 | factory | last day of the month | 12000 | 18 |
| 34 | professional | Tax audit and income-tax return | VE10 | factory | 25 September | 60000 | 18 |
| 35 | bank_charges | Bank charges; approved and paid on its own date | VE16 | factory | last day of the month | `1500 + 1.50 per Rs 1,000 of cash deposited in the month` | 18 |
| 36 | staff_welfare | Uniforms, aprons and caps | VE17 | factory | 10 April and 10 October | 18000 | 5 |
| 37 | staff_welfare | Medical fitness certificates | VE18 | factory | 20 March | `400 x (active employees - 3)`: 12800 in 2026, 13200 in 2027 | 0 |
| 38 | staff_welfare | Diwali sweets and gifts | VE19 | factory | 2026-11-03 and 2027-10-24 | `1500 x (active employees - 1)`: 52500 | 5 |
| 39 | marketing | Display racks, crates and shop boards | VE20 | factory | a seeded day from the 10th to the 20th, every month | 4000 - 9000, uniform | 18 |
| 40 | marketing | Local advertising and social media | VE21 | factory | 28th | 5000 | 18 |
| 41 | marketing | Festival leaflets and banners | VE20 | factory | 5 January; 2026-10-24 and 2027-10-14 | 8000 in January; 12000 before Diwali | 18 |
| 42 | running | Housekeeping contractor | VE22 | factory | last day of the month | 9000 | 18 |
| 43 | running | Water charges | VE23 | factory | 8th | 2200 | 0 |
| 44 | running | Pest control | VE24 | factory | 15th of Feb May Aug Nov | 4500 | 18 |

Checks: the factory electricity bill of 6 January 2026 (for December 2025, before noise) is 8,937 units
= Rs 74,696; a 30-day month at factor 1.00 and F 2.52 is Rs 78,228; stores at factor 1.00: S1 Rs 5,411,
S2 Rs 4,587, S3 Rs 3,598. Gas bill of 3 January 2026 = 1,953 SCM x 52 = Rs 1,01,556. Diesel for a
30-day month = 570 litres = Rs 55,797 at Rs 97.89; the bill of 1 January 2026 covers 16-31 December
2025. Yearly bills total Rs 1,94,000 of licences and insurance.

### 9.5 Other dated rules

- **Cash deposits.** Factory cash: every Monday to Saturday that is not a closed day, deposit the
  balance above Rs 25,000 (skip when that is under Rs 5,000). Stores: 6.5. Slip reference
  `DS-<6 digits>`. Cash deposited is about Rs 14 lakh a month.
- **Month-end stock count** at `fac_rm`, raised by Purchase and stores on the last open day of each
  month, approved by the Owner the next morning (A): a shortage on every packing item of 1.0-2.0% of
  the month's consumption (whole pieces); RM01 0.2-0.4% of the month's consumption; RM03, RM04, RM05
  and RM07 0.1-0.3%; and two other raw materials drawn that month, +/-0.5% (may be an excess). About
  Rs 5,000 a month, 0.1-0.2% of sales. No count at the stores or of finished goods.

### 9.6 Expense claims (A)

About 40 claims a month, about Rs 32,000. Each row is drawn from the seeded stream: the count is spread
over the open days of the month, the amount is uniform in the range, rounded to Rs 10 (the recharge:
Rs 239, 299, 399 or 479). The amount is the total paid, with no GST split. Bill reference `CB-<4
digits>`, or `no bill - voucher` for one claim in five.

| Claim | Category | Raised by | Unit | A month | Amount Rs |
|---|---|---|---|---|---|
| Staff tea, milk and snacks (Saturdays) | staff_welfare | u_production | factory | 4 | 1900 - 2600 |
| Diesel top-up on the route | vehicle_fuel | u_sales | factory | 3 | 500 - 1500 |
| Puncture or small van job | vehicle_maint | u_sales | factory | 2 | 150 - 550 |
| Toll and parking | running | u_sales | factory | 2 | 80 - 300 |
| Customer visit, conveyance | running | u_sales | factory | 1 | 600 - 2200 |
| Customer visit, conveyance | running | u_owner | factory | 1 | 600 - 2200 |
| Sampling and display at outlets | marketing | u_sales | factory | 1 | 300 - 900 |
| Mobile recharge or data pack | telephone | u_sales | factory | 1 | 239 - 479 |
| Loading and unloading labour | running | u_stores | factory | 3 | 300 - 800 |
| Cleaning supplies, gloves, hairnets | running | u_stores | factory | 2 | 400 - 1200 |
| Small hardware and spares | repairs | u_stores | factory | 2 | 250 - 1800 |
| Electrician or plumber | repairs | u_production | factory | 1 | 250 - 1800 |
| Courier | running | u_accounts | factory | 2 | 80 - 350 |
| Stationery and printer supplies | running | u_accounts | factory | 2 | 300 - 1500 |
| Housekeeping and cleaning supplies | running | u_store_mgr | each store | 2 each | 200 - 600 |
| Carry bags, napkins, billing rolls | running | u_store_mgr | each store | 1 each | 300 - 900 |
| Drinking water and tea | staff_welfare | u_store_mgr | each store | 1 each | 250 - 550 |
| Small repair at the store | repairs | u_store_mgr | each store | 1 every second month each | 200 - 1200 |

- The Owner approves a claim the next morning and rejects 3% of them (reason drawn from "no bill
  attached", "duplicate of an earlier claim", "personal expense"). The Owner's own claim is approved by
  the Owner and logged as such.
- Accounts reimburses approved claims every Saturday: factory claims from factory cash, store claims
  by bank transfer. So on any business date the claims of the day before are pending and those
  approved since the last Saturday are on the "claims to reimburse" list.

---

## 10. Opening position on 2026-01-01

All are opening entries dated 2026-01-01. Totals: cash Rs 1,02,800 + bank Rs 8,75,000 + receivables
Rs 8,54,000 + stock about Rs 6.65 lakh - payables Rs 9,70,000 = net working capital about Rs 15.3 lakh.

### 10.1 Cash and bank

| Account | Opening balance |
|---|---|
| cash_factory | 64500 |
| cash_st_anand | 17900 |
| cash_st_vvn | 10300 |
| cash_st_nadiad | 10100 |
| bank | 875000 |

1 January 2026 is a Thursday, so every store deposits on day one.

### 10.2 Opening invoices (26, Rs 8,54,000)

One per customer, with a total and a due date; no stock, sales or GST effect. The 24 cash outlets have
none. Ageing on 1 January: not due 4,90,000; 1-15 days overdue 70,600; 16-30 days 1,79,600; 31-60 days
1,13,800.

Twelve prompt weekly outlets (Rs 84,000), each received in full on its due date:

| Customer | Opening invoice (Rs) | Due date | Received in the seed |
|---|---|---|---|
| O11 | 6700 | 2026-01-05 | 2026-01-05 |
| O05 | 7700 | 2026-01-05 | 2026-01-05 |
| O01 | 8300 | 2026-01-05 | 2026-01-05 |
| O10 | 9400 | 2026-01-05 | 2026-01-05 |
| O12 | 9000 | 2026-01-05 | 2026-01-05 |
| O14 | 6600 | 2026-01-06 | 2026-01-06 |
| O17 | 6200 | 2026-01-06 | 2026-01-06 |
| O23 | 5400 | 2026-01-06 | 2026-01-06 |
| O32 | 4100 | 2026-01-07 | 2026-01-07 |
| O25 | 5000 | 2026-01-07 | 2026-01-07 |
| O33 | 4000 | 2026-01-07 | 2026-01-07 |
| O34 | 11600 | 2026-01-01 | 2026-01-01 |

Slow outlets and corporates:

| Customer | Opening invoice (Rs) | Due date | Received in the seed |
|---|---|---|---|
| O38 | 11200 | 2025-12-29 | 2026-01-03 |
| O04 | 13400 | 2025-12-22 | 2026-01-08 |
| O19 | 9600 | 2025-12-11 | 2026-01-12 |
| O28 | 17800 | 2025-11-19 | half on 2026-01-15, half on 2026-02-15 |
| C01 | 148000 | 2026-01-20 | on its first payment weekday on or after the due date |
| C02 | 92000 | 2026-01-16 | same rule |
| C03 | 78000 | 2026-01-28 | same rule |
| C07 | 24000 | 2026-01-09 | same rule |
| C09 | 31000 | 2026-01-05 | same rule |
| C10 | 33000 | 2026-01-12 | same rule |
| C04 | 46000 | 2025-12-24 | 2026-01-06 |
| C05 | 112000 | 2025-12-12 | 2026-01-15 |
| C06 | 58000 | 2025-12-03 | half on 2026-01-20, half on 2026-02-10 |
| C08 | 96000 | 2025-11-26 | 2026-01-28 |

After its opening invoice a customer pays by its normal rule (6.2, 6.4).

### 10.3 Opening bills (13, Rs 9,70,000)

One per stock vendor; no stock or GST effect. Overdue Rs 92,000; due 1-7 January Rs 3,60,000; due 8-31
January Rs 5,18,000. No expense bill and no salary is outstanding.

| Vendor | Opening bill (Rs) | Due date | Paid in the seed |
|---|---|---|---|
| VM01 | 278000 | 2026-01-07 | first payment day on or after the due date |
| VM02 | 12000 | 2026-01-06 | same rule |
| VM03 | 62000 | 2026-01-08 | same rule |
| VM04 | 174000 | 2026-01-14 | same rule |
| VM05 | 31000 | 2026-01-09 | same rule |
| VM06 | 45000 | 2026-01-05 | same rule |
| VM07 | 85000 | 2026-01-12 | same rule |
| VM08 | 28000 | 2025-12-27 | 2026-01-05 |
| VM09 | 7000 | 2026-01-05 | 2026-01-05, from factory cash |
| VM10 | 6000 | 2026-01-03 | 2026-01-05 |
| VM11 | 12000 | 2026-01-05 | 2026-01-05, from factory cash |
| VM12 | 166000 | 2026-01-20 | same rule |
| VM13 | 64000 | 2025-12-19 | 2026-01-05 |

### 10.4 Opening stock

**Materials** at `fac_rm`: the "Opening stock" and "Opening rate" columns of 4.1 (days of normal use by
class, rounded up to whole packs: flour 5, sugar 8, fats and oil 10, yeast 8, market vegetables 4,
paneer 3.5, peas 10, other ingredients 20, packing 21). Value Rs 4.82 lakh. Eight materials (RM01,
RM02, RM03, RM08, RM19, RM20, RM22, RM23) open at or below their reorder level, so 1 January raises
the first orders.

**Finished goods**, as batches with a manufacturing date; rate = recipe cost at the opening rates.
Factory Rs 1.68 lakh, S1 Rs 7,400, S2 Rs 3,600, S3 Rs 3,900. Rules behind the table (A): at the factory
each fresh line and each puff opens with one batch made on 2025-12-31 = 1.05 x the hand-over quantity of
1 January, rounded up to 10; each long-life line with (target cover + 2) days of the normal-day
requirement in two batches (40% and 60%). At a store: half a normal day of each fresh line (a full day
of pizza base) made on 2025-12-30, four normal days of FG10-FG14, two of FG15, no puffs.

| Code | Key | Location | Batch mfg date | Best before | Units | Rate (recipe cost, Jan 2026) |
|---|---|---|---|---|---|---|
| FG01 | SB | fac_fg | 2025-12-31 | 2026-01-04 | 740 | 13.73 |
| FG01 | SB | S1 | 2025-12-30 | 2026-01-03 | 23 | 13.73 |
| FG01 | SB | S2 | 2025-12-30 | 2026-01-03 | 11 | 13.73 |
| FG01 | SB | S3 | 2025-12-30 | 2026-01-03 | 12 | 13.73 |
| FG02 | BB | fac_fg | 2025-12-31 | 2026-01-04 | 170 | 13.65 |
| FG02 | BB | S1 | 2025-12-30 | 2026-01-03 | 7 | 13.65 |
| FG02 | BB | S2 | 2025-12-30 | 2026-01-03 | 4 | 13.65 |
| FG02 | BB | S3 | 2025-12-30 | 2026-01-03 | 3 | 13.65 |
| FG03 | JL | fac_fg | 2025-12-31 | 2026-01-04 | 200 | 27.32 |
| FG03 | JL | S1 | 2025-12-30 | 2026-01-03 | 2 | 27.32 |
| FG03 | JL | S2 | 2025-12-30 | 2026-01-03 | 1 | 27.32 |
| FG03 | JL | S3 | 2025-12-30 | 2026-01-03 | 1 | 27.32 |
| FG04 | LP | fac_fg | 2025-12-31 | 2026-01-03 | 800 | 15.35 |
| FG04 | LP | S1 | 2025-12-30 | 2026-01-02 | 17 | 15.35 |
| FG04 | LP | S2 | 2025-12-30 | 2026-01-02 | 8 | 15.35 |
| FG04 | LP | S3 | 2025-12-30 | 2026-01-02 | 9 | 15.35 |
| FG05 | BNP | fac_fg | 2025-12-31 | 2026-01-04 | 210 | 8.90 |
| FG05 | BNP | S1 | 2025-12-30 | 2026-01-03 | 5 | 8.90 |
| FG05 | BNP | S2 | 2025-12-30 | 2026-01-03 | 5 | 8.90 |
| FG05 | BNP | S3 | 2025-12-30 | 2026-01-03 | 3 | 8.90 |
| FG06 | BNS | fac_fg | 2025-12-31 | 2026-01-04 | 80 | 9.84 |
| FG06 | BNS | S1 | 2025-12-30 | 2026-01-03 | 3 | 9.84 |
| FG06 | BNS | S2 | 2025-12-30 | 2026-01-03 | 4 | 9.84 |
| FG06 | BNS | S3 | 2025-12-30 | 2026-01-03 | 1 | 9.84 |
| FG07 | BNW | fac_fg | 2025-12-31 | 2026-01-04 | 40 | 8.47 |
| FG07 | BNW | S1 | 2025-12-30 | 2026-01-03 | 2 | 8.47 |
| FG07 | BNW | S2 | 2025-12-30 | 2026-01-03 | 2 | 8.47 |
| FG07 | BNW | S3 | 2025-12-30 | 2026-01-03 | 1 | 8.47 |
| FG08 | BNJ | fac_fg | 2025-12-31 | 2026-01-04 | 120 | 13.04 |
| FG08 | BNJ | S1 | 2025-12-30 | 2026-01-03 | 2 | 13.04 |
| FG08 | BNJ | S2 | 2025-12-30 | 2026-01-03 | 2 | 13.04 |
| FG08 | BNJ | S3 | 2025-12-30 | 2026-01-03 | 1 | 13.04 |
| FG09 | PZ | fac_fg | 2025-12-31 | 2026-01-05 | 240 | 7.71 |
| FG09 | PZ | S1 | 2025-12-30 | 2026-01-04 | 14 | 7.71 |
| FG09 | PZ | S2 | 2025-12-30 | 2026-01-04 | 12 | 7.71 |
| FG09 | PZ | S3 | 2025-12-30 | 2026-01-04 | 6 | 7.71 |
| FG10 | TE | fac_fg | 2025-12-24 | 2026-03-24 | 700 | 20.19 |
| FG10 | TE | fac_fg | 2025-12-29 | 2026-03-29 | 1060 | 20.19 |
| FG10 | TE | S1 | 2025-12-24 | 2026-03-24 | 64 | 20.19 |
| FG10 | TE | S2 | 2025-12-24 | 2026-03-24 | 24 | 20.19 |
| FG10 | TE | S3 | 2025-12-24 | 2026-03-24 | 40 | 20.19 |
| FG11 | TM | fac_fg | 2025-12-24 | 2026-03-24 | 220 | 35.88 |
| FG11 | TM | fac_fg | 2025-12-29 | 2026-03-29 | 320 | 35.88 |
| FG11 | TM | S1 | 2025-12-24 | 2026-03-24 | 32 | 35.88 |
| FG11 | TM | S2 | 2025-12-24 | 2026-03-24 | 12 | 35.88 |
| FG11 | TM | S3 | 2025-12-24 | 2026-03-24 | 16 | 35.88 |
| FG12 | KB | fac_fg | 2025-12-24 | 2026-03-24 | 450 | 31.88 |
| FG12 | KB | fac_fg | 2025-12-29 | 2026-03-29 | 680 | 31.88 |
| FG12 | KB | S1 | 2025-12-24 | 2026-03-24 | 56 | 31.88 |
| FG12 | KB | S2 | 2025-12-24 | 2026-03-24 | 24 | 31.88 |
| FG12 | KB | S3 | 2025-12-24 | 2026-03-24 | 32 | 31.88 |
| FG13 | KJ | fac_fg | 2025-12-24 | 2026-03-24 | 170 | 25.51 |
| FG13 | KJ | fac_fg | 2025-12-29 | 2026-03-29 | 260 | 25.51 |
| FG13 | KJ | S1 | 2025-12-24 | 2026-03-24 | 32 | 25.51 |
| FG13 | KJ | S2 | 2025-12-24 | 2026-03-24 | 16 | 25.51 |
| FG13 | KJ | S3 | 2025-12-24 | 2026-03-24 | 16 | 25.51 |
| FG14 | JB | fac_fg | 2025-12-24 | 2026-02-22 | 200 | 25.17 |
| FG14 | JB | fac_fg | 2025-12-29 | 2026-02-27 | 310 | 25.17 |
| FG14 | JB | S1 | 2025-12-24 | 2026-02-22 | 32 | 25.17 |
| FG14 | JB | S2 | 2025-12-24 | 2026-02-22 | 16 | 25.17 |
| FG14 | JB | S3 | 2025-12-24 | 2026-02-22 | 16 | 25.17 |
| FG15 | TC | fac_fg | 2025-12-27 | 2026-01-11 | 190 | 20.94 |
| FG15 | TC | fac_fg | 2025-12-30 | 2026-01-14 | 280 | 20.94 |
| FG15 | TC | S1 | 2025-12-27 | 2026-01-11 | 28 | 20.94 |
| FG15 | TC | S2 | 2025-12-27 | 2026-01-11 | 24 | 20.94 |
| FG15 | TC | S3 | 2025-12-27 | 2026-01-11 | 10 | 20.94 |
| FG16 | PV | fac_fg | 2025-12-31 | 2026-01-01 | 700 | 5.65 |
| FG17 | PP | fac_fg | 2025-12-31 | 2026-01-01 | 180 | 10.83 |
| FG18 | PG | fac_fg | 2025-12-31 | 2026-01-01 | 190 | 6.85 |

---

## 11. Reconcile

Everything below is computed from sections 2-9 of this file (recipes x purchase prices, the price
lists, the standing orders, the corporate patterns, the store sales and the overhead rules), not copied
from the raw files. "Latest prices" = the October 2026 purchase prices and the price list in force
since 1 July 2026: what a copy opened on 2 October 2026 sees. Expected values; the seed adds noise.

Targets and where the tuned parameters land:

| Target | Result |
|---|---|
| Sales about Rs 1.05-1.2 lakh a day | normal day Rs 1,08,333 (opening list), Rs 1,12,617 (after revision 1), Rs 1,15,808 (after revision 2); Rs 3.94 crore in 2026, Rs 4.11 crore in 2027 |
| No product with a negative margin to retailers | highest cost is butter khari at 65% of its retailer price (68% in March 2027); 11.1 |
| Material cost 45-55% of sales | 50.8% in the normal month; 48-53% in every month of the two years |
| Operating profit 6-12% of sales | 9.7% in the normal month; 10.4% over 2026, 8.4% over 2027 |
| Daily production fits the mixes | about 690 kg of flour a day; every run inside the mixer sizes and maxima of 3.5 |

### 11.1 Standard cost of every product

Cost = recipe quantities x the month's purchase prices / E + packing per unit.

| Code | Key | Cost Jan 2026 | Cost Oct 2026 (latest) | Cost Dec 2027 | Of which packing (Oct 2026) | Retailer price Oct 2026 | Cost % retailer | Margin to retailer Rs | Corporate price | Cost % corporate | Store realisation | Cost % store |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| FG01 | SB | 13.73 | 14.90 | 15.87 | 1.35 | 33.00 | 45.2% | 18.10 | 31.00 | 48.1% | 41.00 | 36.4% |
| FG02 | BB | 13.65 | 14.84 | 15.79 | 1.35 | 37.50 | 39.6% | 22.66 | 35.50 | 41.8% | 47.00 | 31.6% |
| FG03 | JL | 27.32 | 29.66 | 31.59 | 2.01 | 58.50 | 50.7% | 28.84 | 53.50 | 55.4% | 72.00 | 41.2% |
| FG04 | LP | 15.35 | 16.66 | 17.75 | 0.85 | 30.50 | 54.6% | 13.84 | 28.50 | 58.5% | 38.00 | 43.9% |
| FG05 | BNP | 8.90 | 9.65 | 10.25 | 0.85 | 26.50 | 36.4% | 16.85 | 25.00 | 38.6% | 33.00 | 29.3% |
| FG06 | BNS | 9.84 | 10.63 | 11.26 | 0.85 | 29.50 | 36.0% | 18.87 | 27.50 | 38.6% | 37.00 | 28.7% |
| FG07 | BNW | 8.47 | 9.20 | 9.76 | 0.85 | 33.00 | 27.9% | 23.80 | 31.00 | 29.7% | 41.00 | 22.5% |
| FG08 | BNJ | 13.04 | 14.15 | 15.03 | 0.85 | 40.50 | 34.9% | 26.35 | 37.00 | 38.2% | 50.00 | 28.3% |
| FG09 | PZ | 7.71 | 8.38 | 8.91 | 0.85 | 23.00 | 36.4% | 14.62 | 21.50 | 39.0% | 29.00 | 28.9% |
| FG10 | TE | 20.19 | 22.09 | 23.28 | 2.43 | 41.50 | 53.2% | 19.41 | 39.50 | 55.9% | 52.38 | 42.2% |
| FG11 | TM | 35.88 | 38.70 | 40.92 | 3.19 | 68.00 | 56.9% | 29.30 | 65.00 | 59.5% | 85.71 | 45.1% |
| FG12 | KB | 31.88 | 34.64 | 37.18 | 3.19 | 53.00 | 65.4% | 18.36 | 51.00 | 67.9% | 66.67 | 52.0% |
| FG13 | KJ | 25.51 | 28.27 | 30.47 | 3.19 | 49.00 | 57.7% | 20.73 | 47.00 | 60.1% | 61.90 | 45.7% |
| FG14 | JB | 25.17 | 27.49 | 29.39 | 2.43 | 57.00 | 48.2% | 29.51 | 54.50 | 50.4% | 71.43 | 38.5% |
| FG15 | TC | 20.94 | 22.58 | 23.52 | 7.35 | 42.00 | 53.8% | 19.42 | 39.50 | 57.2% | 52.38 | 43.1% |
| FG16 | PV | 5.65 | 6.42 | 6.70 | 0.19 | 11.50 | 55.8% | 5.08 | 11.00 | 58.4% | 14.29 | 45.0% |
| FG17 | PP | 10.83 | 11.89 | 12.50 | 0.19 | 19.00 | 62.6% | 7.11 | 18.00 | 66.1% | 23.81 | 49.9% |
| FG18 | PG | 6.85 | 7.56 | 7.97 | 0.19 | 15.25 | 49.6% | 7.69 | 14.50 | 52.1% | 19.05 | 39.7% |

Over all 24 months (cost of the month against the list in force):

| Code | Key | Highest cost % of retailer price | In month | Highest cost % of corporate price | In month | Lowest margin to retailer Rs |
|---|---|---|---|---|---|---|
| FG01 | SB | 48.1% | 2027-12 | 51.2% | 2027-12 | 16.46 |
| FG02 | BB | 42.1% | 2027-12 | 44.5% | 2027-12 | 21.04 |
| FG03 | JL | 54.0% | 2027-12 | 59.1% | 2027-12 | 26.91 |
| FG04 | LP | 58.2% | 2027-12 | 62.3% | 2027-12 | 12.75 |
| FG05 | BNP | 38.7% | 2027-12 | 41.0% | 2027-12 | 15.84 |
| FG06 | BNS | 38.2% | 2027-12 | 41.0% | 2027-12 | 17.90 |
| FG07 | BNW | 29.6% | 2027-12 | 31.5% | 2027-12 | 21.78 |
| FG08 | BNJ | 37.1% | 2027-12 | 40.6% | 2027-12 | 24.59 |
| FG09 | PZ | 38.7% | 2027-12 | 41.4% | 2027-12 | 13.61 |
| FG10 | TE | 54.3% | 2026-08 | 57.1% | 2026-08 | 18.96 |
| FG11 | TM | 57.8% | 2026-08 | 60.5% | 2026-08 | 28.70 |
| FG12 | KB | 67.6% | 2027-03 | 70.2% | 2027-03 | 17.19 |
| FG13 | KJ | 59.7% | 2027-03 | 62.2% | 2027-03 | 19.77 |
| FG14 | JB | 49.4% | 2027-03 | 51.7% | 2027-03 | 28.83 |
| FG15 | TC | 54.8% | 2026-08 | 58.3% | 2026-08 | 18.98 |
| FG16 | PV | 55.8% | 2026-10 | 58.4% | 2026-10 | 5.08 |
| FG17 | PP | 62.9% | 2027-03 | 66.4% | 2027-03 | 7.05 |
| FG18 | PG | 49.6% | 2026-10 | 52.1% | 2026-10 | 7.69 |

No product ever sells under its recipe cost in any channel. Khari and milk toast are the thin lines
(fat and butter); buns, pizza base and brown bread the rich ones; ladi pav is thin to corporates.

### 11.2 A normal day's sales by channel, and the margin by channel

Every factor 1.00; corporates as their weekly average per day; stale returns at the expected rate of
7.9; cost = recipe cost of every unit invoiced or sold (the cost of returned packs stays in).

| Price list and costs | Retail gross | Stale returns | Retail net | Corporates | Own stores | Total net | Recipe cost of goods sold | Cost % of net sales | Retail cost % | Corporate cost % | Store cost % |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Opening list, January 2026 costs | 57,586 | 2,095 | 55,490 | 24,096 | 28,747 | 1,08,333 | 50,988 | 47.1% | 49.9% | 50.7% | 38.6% |
| Opening list, June 2026 costs | 57,586 | 2,095 | 55,490 | 24,096 | 28,747 | 1,08,333 | 52,633 | 48.6% | 51.5% | 52.1% | 40.1% |
| After revision 1, October 2026 costs (latest) | 60,161 | 2,229 | 57,932 | 25,214 | 29,472 | 1,12,617 | 55,597 | 49.4% | 51.9% | 52.9% | 41.4% |
| After revision 1, March 2027 costs | 60,161 | 2,229 | 57,932 | 25,214 | 29,472 | 1,12,617 | 55,953 | 49.7% | 52.5% | 52.9% | 41.4% |
| After revision 2, April 2027 costs | 61,598 | 2,237 | 59,361 | 25,640 | 30,807 | 1,15,808 | 55,776 | 48.2% | 51.0% | 51.8% | 39.6% |
| After revision 2, December 2027 costs | 61,598 | 2,237 | 59,361 | 25,640 | 30,807 | 1,15,808 | 59,023 | 51.0% | 53.9% | 55.1% | 41.8% |

Channel shares of net sales at the latest prices: retail outlets 51.4%, corporates 22.4%, own stores
26.2%. Gross margin after recipe cost: retail 48.1%, corporates 47.1%, own stores 58.6%.

### 11.3 The normal day by item (latest prices)

Units a day (corporates: weekly average), value before GST and gross of stale returns, recipe cost at
October 2026 prices.

| Code | Key | Retail units | Corporate units | Store units | Total units | Retail Rs | Corporate Rs | Store Rs | Total Rs | Share | Recipe cost Rs | Cost % |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| FG01 | SB | 531 | 27.14 | 91 | 649.14 | 17,523 | 841 | 3,731 | 22,095 | 19.2% | 9,675 | 43.8% |
| FG02 | BB | 95 | 22.00 | 28 | 145.00 | 3,563 | 781 | 1,316 | 5,660 | 4.9% | 2,152 | 38.0% |
| FG03 | JL | 0 | 159.71 | 8 | 167.71 | 0 | 8,545 | 576 | 9,121 | 7.9% | 4,974 | 54.5% |
| FG04 | LP | 431 | 169.86 | 68 | 668.86 | 13,146 | 4,841 | 2,584 | 20,570 | 17.9% | 11,146 | 54.2% |
| FG05 | BNP | 122 | 22.29 | 25 | 169.29 | 3,233 | 557 | 825 | 4,615 | 4.0% | 1,634 | 35.4% |
| FG06 | BNS | 16 | 20.00 | 16 | 52.00 | 472 | 550 | 592 | 1,614 | 1.4% | 553 | 34.2% |
| FG07 | BNW | 10 | 6.00 | 10 | 26.00 | 330 | 186 | 410 | 926 | 0.8% | 239 | 25.8% |
| FG08 | BNJ | 0 | 60.29 | 8 | 68.29 | 0 | 2,231 | 400 | 2,631 | 2.3% | 966 | 36.7% |
| FG09 | PZ | 88 | 41.29 | 32 | 161.29 | 2,024 | 888 | 928 | 3,840 | 3.3% | 1,352 | 35.2% |
| FG10 | TE | 150 | 13.00 | 32 | 195.00 | 6,225 | 514 | 1,676 | 8,415 | 7.3% | 4,308 | 51.2% |
| FG11 | TM | 33 | 11.00 | 15 | 59.00 | 2,244 | 715 | 1,286 | 4,245 | 3.7% | 2,283 | 53.8% |
| FG12 | KB | 113 | 0.00 | 28 | 141.00 | 5,989 | 0 | 1,867 | 7,856 | 6.8% | 4,884 | 62.2% |
| FG13 | KJ | 37 | 0.00 | 16 | 53.00 | 1,813 | 0 | 990 | 2,803 | 2.4% | 1,498 | 53.4% |
| FG14 | JB | 30 | 4.00 | 16 | 50.00 | 1,710 | 218 | 1,143 | 3,071 | 2.7% | 1,375 | 44.8% |
| FG15 | TC | 45 | 16.57 | 31 | 92.57 | 1,890 | 655 | 1,624 | 4,168 | 3.6% | 2,091 | 50.2% |
| FG16 | PV | 0 | 240.00 | 335 | 575.00 | 0 | 2,640 | 4,786 | 7,426 | 6.5% | 3,693 | 49.7% |
| FG17 | PP | 0 | 25.71 | 115 | 140.71 | 0 | 463 | 2,738 | 3,201 | 2.8% | 1,673 | 52.3% |
| FG18 | PG | 0 | 40.71 | 105 | 145.71 | 0 | 590 | 2,000 | 2,590 | 2.3% | 1,101 | 42.5% |
| Total |  |  |  |  |  | 60,161 | 25,214 | 29,472 | 1,14,846 | 100.0% | 55,597 | 48.4% |

The nine Nil-rated lines are 62% of sales value, the nine 5% lines 38%.

### 11.4 A normal month's P&L (latest prices)

30 normal days; expenses at October 2026 rates with yearly bills at one-twelfth; before depreciation,
interest and tax.

| Line | Rs | % of sales |
|---|---|---|
| Sales, retail outlets (net of credit notes) | 17,37,950 | 51.4% |
| Sales, corporates | 7,56,411 | 22.4% |
| Sales, own stores | 8,84,146 | 26.2% |
| **Sales** | 33,78,507 | 100.0% |
| Recipe cost of goods sold | 16,67,899 | 49.4% |
| Production loss | 6,672 | 0.2% |
| Write-offs (expired and unsaleable) | 35,884 | 1.1% |
| Stock count differences | 5,000 | 0.1% |
| **Material cost** | 17,15,455 | 50.8% |
| **Gross margin** | 16,63,053 | 49.2% |
| Salaries | 7,62,200 | 22.6% |
| Rent | 1,64,500 | 4.9% |
| Electricity | 91,800 | 2.7% |
| Oven fuel (gas) | 1,17,200 | 3.5% |
| Vehicle fuel | 58,800 | 1.7% |
| Vehicle maintenance | 12,700 | 0.4% |
| Repairs and maintenance | 27,400 | 0.8% |
| Licences and insurance | 16,200 | 0.5% |
| Telephone and internet | 7,000 | 0.2% |
| Professional fees | 17,000 | 0.5% |
| Bank charges | 3,600 | 0.1% |
| Staff welfare | 18,700 | 0.6% |
| Marketing | 13,800 | 0.4% |
| Running costs | 25,600 | 0.8% |
| Store cash short / excess | 300 | 0.0% |
| **Total expenses** | 13,36,800 | 39.6% |
| of which overheads other than salaries | 5,74,600 | 17.0% |
| **Operating profit** | 3,26,253 | 9.7% |

How the smaller lines are built: production loss 0.4% of recipe cost (normal yield noise nets to a
small gain; bad runs and the fortnight dip of 12.2 make the loss); write-offs = expired store puffs
about Rs 640 a day + expired factory puffs about Rs 285 + unsaleable store stock about Rs 180 + odd
expired fresh stock; count differences by the rule of 9.5.

### 11.5 Production against the mixes

A normal day needs about 652 sandwich loaves (3.6 mixes of 50 kg), 672 packs of ladi pav (3.7 mixes of
50 kg), 168 jumbo loaves (3.7 mixes of 25 kg), 620 veg puffs (7 mixes of 2.5 kg) and so on - the table
of 3.5, where the two-year run of the rules gives the average, smallest and largest run of every
product. About 19 dough mixes and 11 puff mixes on the daily lines, plus two or three long-life runs on
a weekday; about 690 kg of flour a day (maida 674 kg, atta 23 kg on a normal day). The 50 kg mixer
carries the sandwich bread, ladi pav and milk toast (about 8 mixes a day) and the 25 kg mixer the
smaller doughs, inside a two-shift day (A). No run exceeds a maximum; the largest are 6 mixes of
elaichi toast and 5.5 of butter khari before Diwali.

### 11.6 Month by month under all the rules (expected values, Rs lakh)

Weekday, month, month-part, event, calendar, summer and rain rules, both price revisions, stale returns
in the month of the dispatch, expenses in the month of the bill date. Use it to check the generator
(within about 3% a month on sales) - never to patch it.

| Month | Retail gross | Stale returns | Corporates | Own stores | Net sales | Per day Rs | Volume factor V | Recipe COGS % | Material cost % | Expenses | Operating profit % |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-01 | 18.39 | 0.67 | 7.59 | 9.37 | 34.68 | 1,11,864 | 1.00 | 46.9% | 48.1% | 12.41 | 16.1% |
| 2026-02 | 16.79 | 0.61 | 7.07 | 8.40 | 31.66 | 1,13,056 | 1.01 | 47.1% | 48.3% | 12.21 | 13.1% |
| 2026-03 | 18.19 | 0.66 | 7.19 | 9.06 | 33.78 | 1,08,959 | 0.98 | 47.0% | 48.3% | 11.92 | 16.4% |
| 2026-04 | 16.64 | 0.61 | 7.23 | 8.14 | 31.40 | 1,04,668 | 0.95 | 46.8% | 48.3% | 13.65 | 8.2% |
| 2026-05 | 16.18 | 0.59 | 5.69 | 7.50 | 28.77 | 92,807 | 0.84 | 47.6% | 49.3% | 13.02 | 5.5% |
| 2026-06 | 16.69 | 0.61 | 6.60 | 8.10 | 30.77 | 1,02,576 | 0.92 | 48.5% | 50.0% | 13.16 | 7.2% |
| 2026-07 | 18.98 | 0.89 | 7.85 | 9.27 | 35.21 | 1,13,566 | 0.98 | 48.2% | 49.5% | 13.56 | 12.0% |
| 2026-08 | 18.94 | 0.88 | 7.19 | 9.18 | 34.44 | 1,11,094 | 0.95 | 49.4% | 50.8% | 13.48 | 10.0% |
| 2026-09 | 18.18 | 0.84 | 7.16 | 8.83 | 33.33 | 1,11,103 | 0.96 | 49.8% | 51.3% | 13.81 | 7.2% |
| 2026-10 | 18.94 | 0.70 | 7.60 | 9.37 | 35.21 | 1,13,589 | 0.98 | 49.3% | 50.5% | 13.59 | 10.8% |
| 2026-11 | 15.29 | 0.55 | 5.31 | 7.48 | 27.52 | 91,740 | 0.78 | 49.0% | 50.6% | 13.78 | -0.7% |
| 2026-12 | 19.56 | 0.72 | 8.27 | 9.65 | 36.76 | 1,18,573 | 1.02 | 49.0% | 50.2% | 12.62 | 15.4% |
| 2027-01 | 19.21 | 0.71 | 7.82 | 9.63 | 35.94 | 1,15,945 | 1.00 | 49.0% | 50.2% | 13.38 | 12.5% |
| 2027-02 | 17.89 | 0.66 | 7.44 | 8.71 | 33.39 | 1,19,241 | 1.03 | 49.7% | 51.0% | 13.15 | 9.6% |
| 2027-03 | 18.66 | 0.69 | 7.75 | 9.18 | 34.91 | 1,12,602 | 0.97 | 49.6% | 51.1% | 12.87 | 12.1% |
| 2027-04 | 17.78 | 0.65 | 7.63 | 8.71 | 33.46 | 1,11,548 | 0.94 | 48.2% | 49.7% | 14.58 | 6.8% |
| 2027-05 | 17.31 | 0.63 | 6.19 | 8.03 | 30.89 | 99,654 | 0.85 | 48.5% | 50.2% | 13.88 | 4.8% |
| 2027-06 | 17.75 | 0.66 | 7.36 | 8.60 | 33.05 | 1,10,178 | 0.93 | 49.2% | 50.7% | 13.74 | 7.7% |
| 2027-07 | 19.47 | 0.90 | 8.05 | 9.71 | 36.33 | 1,17,194 | 0.98 | 50.1% | 51.3% | 14.14 | 9.7% |
| 2027-08 | 19.13 | 0.86 | 7.23 | 9.35 | 34.84 | 1,12,389 | 0.94 | 50.5% | 52.2% | 13.67 | 8.6% |
| 2027-09 | 18.92 | 0.86 | 7.48 | 9.51 | 35.05 | 1,16,845 | 0.98 | 50.8% | 52.1% | 14.42 | 6.8% |
| 2027-10 | 18.40 | 0.66 | 6.90 | 9.29 | 33.93 | 1,09,457 | 0.90 | 50.6% | 52.0% | 14.77 | 4.5% |
| 2027-11 | 17.19 | 0.62 | 6.66 | 8.45 | 31.67 | 1,05,580 | 0.89 | 50.8% | 52.5% | 13.84 | 3.8% |
| 2027-12 | 20.03 | 0.73 | 8.39 | 10.14 | 37.83 | 1,22,044 | 1.02 | 50.9% | 52.1% | 13.38 | 12.5% |
| **2026** | 212.76 | 8.34 | 84.75 | 104.36 | 393.52 | 1,07,814 |  | 48.2% | 49.6% | 157.22 | 10.4% |
| **2027** | 221.72 | 8.63 | 88.90 | 109.32 | 411.31 | 1,12,688 |  | 49.9% | 51.3% | 165.81 | 8.4% |

- 1 January to 1 October 2026 (the history of a copy first opened on 2 October 2026): Rs 2.95 crore.
- Quarters: operating profit 15.3%, 7.0%, 9.8%, 9.4% in 2026 and 11.4%, 6.5%, 8.4%, 7.2% in 2027. The
  first quarter of 2026 is the best (old salaries, gas at Rs 52, the cheapest flour). April to June is
  thin every year (the April raise and yearly insurance, the vacation and the heat); the July 2026
  revision restores it. November 2026 is about break-even: three closed days, thin weeks around them
  and the Diwali bill. The bank balance rises by about Rs 75 lakh over the two years because the sample
  has no document for drawings, tax or GST payments; that is accepted.
- Open days range from about Rs 62,000 (12 November 2026, the reopening day) to about Rs 1.36 lakh
  (the first Saturday of December).

### 11.7 What was changed from the raw files, and why

The raw files priced the materials at researched levels and came to a material cost of 41-44% of sales
and an operating profit of 16-21%. The brief is 45-55% and 6-12%. Tuning went prices first, then
volumes; no recipe and no researched purchase price was touched.

| # | Parameter | Raw file | This file | Why |
|---|---|---|---|---|
| 1 | Opening MRP, SB / BB / JL / LP | 45 / 55 / 80 / 40 | 38 / 44 / 68 / 36 | selling prices were the reason material cost came out low; the new list sits at or under the national bread brand |
| 2 | Opening MRP, BNP / BNS / BNW / BNJ / PZ | 40 / 45 / 50 / 60 / 35 | 31 / 35 / 38 / 47 / 27 | the same |
| 3 | Opening MRP, TE / JB / TC | 60 / 90 / 70 | 55 / 75 / 55 | the same; TM 90, KB 70 and KJ 65 are kept (already thin) |
| 4 | Opening MRP, PV / PP / PG | 20 / 30 / 25 | 15 / 25 / 20 | the usual round counter prices; puffs were the richest store line |
| 5 | Retailer and corporate prices | 18-21% and 4-8% rules | re-derived from the new MRPs by the same rules | follow the MRPs |
| 6 | Revision 1 (2026-07-01) | about +6% on the old list | +5.6% to +7.9% on the new list | same date and reason |
| 7 | Revision 2 (2027-04-01) | about +7% on the old list | TM, KB, KJ as in the raw file; the other six re-derived | same date and reason |
| 8 | Outlet templates | SB 10/12/4/8/12, LP 6/8/14/5/4, TE 3/2/2/3/3, KB 2/1/2/2/2 for P/D/T/B/G | SB 14/16/5/11/16, LP 9/10/20/6/5, TE 4/3/3/4/4, KB 3/2/3/3/3 | volume replaces the sales the price cut took away, on the thin lines |
| 9 | Size factor, large outlet | 1.30 | 1.40 | the same |
| 10 | Corporate orders | C01 JL 30, LP 50, PV 100; C02 JL 18, LP 30; C03 JL 30, SB 10, LP 20, TE 6; C04 JL 16, LP 12, TM 4; C05 JL 20, SB 8, TM 5, TE 4; C06 LP 70, JL 10; C07 LP 90, JL 20; C08 JL 12; C09 PV 90 | C01 JL 40, LP 60, PV 120; C02 JL 22, LP 36; C03 JL 40, SB 12, LP 24, TE 8; C04 JL 20, LP 15, TM 5; C05 JL 24, SB 10, TM 6, TE 5; C06 LP 80, JL 12; C07 LP 100, JL 24; C08 JL 14; C09 PV 100 | the same |
| 11 | Store sales | S1 SB 40, LP 30, TE 14, KB 12, TC 12, PV 120; S2 PV 130; S3 SB 20, LP 16, TE 8, KB 6, PV 60 | S1 SB 45, LP 34, TE 16, KB 14, TC 14, PV 130; S2 PV 140; S3 SB 24, LP 18, TE 10, KB 8, PV 65 | the same |
| 12 | Pack of FG12, FG13, FG14 | "box" in the price file | pouch | the material master has pouches and no carton |
| 13 | Vacation calendar of C03, C04, C10, S2; caterer season | school calendar; month table | college calendar; dated wedding windows | the later, reviewed calendar file |
| 14 | Stale-return outlet factor of the four slow outlets | 1.80 | O04, O28, O38 1.60; O19 3.50 | one outlet is over the 8% limit on every date (12.3) and the approvals list is otherwise quiet |
| 15 | Credit limits of C06 and C04 | 60000 and 90000 | 40000 and 100000 | C06 is over its limit on every date (12.4); C04 follows the limit rule at the new volumes |
| 16 | Corporate payment timing | "0-3 days late" and the like | a payment weekday plus lateness days (6.4) | a rule, and about ten receipts a week |
| 17 | Store transfers and store expiry | puffs by expected sale, long-life twice a week, expiry as a rate on every line | every item topped up daily to a standing level; puffs expire by date; other lines by a weekly "damaged" write-off at the raw rates | the build specification's transfer sheet and day-end: expired units must be past their date |
| 18 | Production rule | need x 1.02; long-life maximum 5 mixes | larger of hand-over and simulated outflow; maximum 6 (tea cake 4) | the build specification's daily guarantee; larger volumes |
| 19 | Lead time | counted from the morning after the check | counted from the order date (raw + 1) | the order is raised in the evening |
| 20 | Reorder levels, order quantities, opening material stock | sized on 570 kg of flour a day | re-sized on the new volumes (4.1) | volumes |
| 21 | Yeast RM08 | lead 1, reorder 110 kg, order 50 kg | lead 3 days from the order, reorder 180 kg, order 30 kg | the standing low-stock item (12.7) |
| 22 | RM04 and RM05 order quantities | 270 kg and 240 kg | kept (not scaled up) | each order stays under the Rs 50,000 limit |
| 23 | Maida and atta, March 2027 onward | drift only | harvest dip and climb added (4.4) | the flour story has a second season (12.1) |
| 24 | Rejected quantity on a receipt | order closes short | made good by a second receipt | the build specification: every seeded order ends Received |
| 25 | Vendor bill date | the receipt date | the day after the receipt | unbilled receipts exist on any business date |
| 26 | Bills that fail the three-way check | one in 40 | the weekly VM09 bill, plus one in 40 (12.5) | one is waiting on every date |
| 27 | Expense bill, claim and salary-bill approval | 0-2 days, or the same day | the next morning | the build specification's morning approval |
| 28 | Opening receivables | groups | one invoice per customer (10.2), total unchanged | the generator needs rows |
| 29 | Opening stock | about Rs 6.1 lakh | about Rs 6.65 lakh | new volumes and rules |
| 30 | Write-offs in the P&L | 1.4% of sales assumed | about 1.1%, built from the rules | computed, not assumed |

Not changed: every recipe and yield; every purchase price for 2026 and every rule parameter except row
23; GST rates; shelf lives; outlet list, routes and names; salaries and the directory; every overhead
rule, amount and date; the event calendar and its multipliers; return rates and lags; opening cash,
bank, receivable and payable totals.

---

## 12. Seeded stories, each as a rule

Each holds for any business date from 2 October 2026 to 31 December 2027 (a copy takes the date it is
first opened; the history runs to the day before). Nothing is keyed on the business date: every rule is
a function of the calendar date, so a later copy contains an earlier one.

### 12.1 A flour price rise that lifts bread cost

Rule: the maida and atta prices of 4.2-4.4. Maida falls to Rs 35.00 at the April 2026 harvest and
climbs to Rs 39.00 by October 2026 (+11.4%); it dips again to Rs 38.50 in April 2027 and climbs to
Rs 41.50 by September 2027 (+7.8%). Each month's first flour receipt posts the new latest price.
What the screens show: the cost of sandwich bread moves from Rs 13.51 (April 2026) to Rs 14.90 (October
2026), of which flour is Rs 9.56 and Rs 10.66; its cost against the retailer price goes 44.3% in April,
46.0% in June, 43.7% after the 1 July revision and 45.2% in October; in 2027 from Rs 14.83 (45.0%) in
April to Rs 15.72 (47.6%) in September. Ladi pav moves 52.4%, 54.3%, 53.0%, 54.6% and 57.7% at the same
points. The purchase-price history of RM01, the cost sheet of FG01, product margin by month and the
change-history note of revision 1 ("flour, packaging and diesel") tell the story on any date; from June
2027 the second climb is the recent one.

### 12.2 One product with a yield dip for a fortnight

Rule: in every calendar month, on production dates from the 5th to the 18th, one product bakes badly.
The product rotates with the month: index = (months since January 2026) mod 6 into this list.

| Index | Product | Months | Note on the production entries |
|---|---|---|---|
| 0 | FG04 Ladi pav | Jan and Jul 2026, Jan and Jul 2027 | new yeast lot - slow proof |
| 1 | FG12 Butter khari | Feb and Aug 2026, Feb and Aug 2027 | margarine too soft - poor lift |
| 2 | FG01 Sandwich bread | Mar and Sep 2026, Mar and Sep 2027 | proofer humidity fault |
| 3 | FG16 Veg puff | Apr and Oct 2026, Apr and Oct 2027 | sheeter gap worn - pastry tears |
| 4 | FG10 Elaichi toast | May and Nov 2026, May and Nov 2027 | slicer blade blunt - broken slices |
| 5 | FG05 Burger bun, plain | Jun and Dec 2026, Jun and Dec 2027 | divider out of calibration |

On those entries the reject rate is drawn uniform 8-12% (in place of `r x v`), so the yield is 89-94%
against about 100% before and after. Daily lines make up with extra mixes (3.5), so dispatch is never
short; run lines (FG12 four runs, FG10 six runs in the window) lose stock cover and the next run is
larger. A factory holiday inside the window simply has no entry. On 2 October 2026 the latest complete
dip is sandwich bread, 5-18 September 2026; the production register with yield and the production-loss
line of the monthly P&L show it. Typical loss Rs 2,000-13,000 per dip.

### 12.3 One outlet whose returns run above the 8% limit

Rule: O19 Dhenukunj Dairy Parlour (route R2, Mogri) has a stale-return outlet factor of 3.50 (7.9). Its
returns run at about 13.2% of its supply (16.4% from July to September), so its seven-day share is above
8% on nearly every visit and its credit notes are held for the Owner. The note raised the day before
the business date is therefore waiting in the approvals list. O19 is also a slow payer (every third
week), so it is the problem outlet on three screens: returns, approvals and overdue receivables. In the
monsoon O38 crosses the limit on about half the days.

### 12.4 One corporate that pays late and is over its credit limit

Rule: C06 Swadsangam Caterers has 15 credit days, 20 lateness days, a Monday payment day and a credit
limit of Rs 40,000 (6.4). About 16 of its orders are open at any time: Rs 54,000 at the least (the
Chaturmas weeks after Diwali 2026) and about Rs 1.1 lakh in a wedding window. It opens with Rs 58,000
overdue. So on every date C06 has invoices 1-26 days overdue, its balance is above its limit, and every
new order for it shows the credit-limit warning. C04, C05 and C08 are late inside their limits.

### 12.5 One vendor bill that fails the three-way check

Rule A (the standing example): the vegetable supplier VM09 bills weekly at the mandi rate of the bill
day, not at the order rates. On every Monday bill the onion line (the potato line if no onion was
received that week) carries a rate 3-6% above the order rate, drawn per bill and rounded to Rs 0.10;
the other lines are at the order rate. The check finds the line more than 2% over, the bill is held,
and **the Owner releases a held VM09 bill on the morning of the following Monday** (the next open day if
closed), when it is also paid in cash. So one VM09 bill is on hold on every business date after
5 January 2026. This is the one approval the Owner does not clear the next morning.
Rule B (the occasional example): one bill in 40 from VM03, VM04, VM07, VM12 or VM13, drawn on the
receipt, carries one line at a rate 3-5% above the order ("billed at next month's price"); it is held
and released the next morning. The purchase price never changes because of a bill.

### 12.6 A store with an occasional cash shortage

Rule: at S3 Nadiad the manager's weekly day off is Tuesday and the counter assistant closes the till.
Number the weeks from Thursday 2026-01-01 (week k = floor(days since 2026-01-01 / 7)); on the Tuesday of
every week whose k mod 3 is 0 or 1 the cash counted is short by Rs 30-180 (drawn, a multiple of Rs 10).
That is two Tuesdays in three, so every 30-day window holds two or three shortages at S3. Elsewhere, at
any store on any day, a draw under 0.02 gives a difference of Rs 10-40 (short seven times in ten,
otherwise an excess). The expense report by unit shows "Store cash short / excess" at about Rs 300 a
month, nearly all at S3 and all on Tuesdays - a pattern a user can find.

### 12.7 A material below its reorder level on the business date

Rule: yeast RM08 has a reorder level of 180 kg, an order quantity of 30 kg and three lead days against
a use of about 18 kg a day (4.1). The check orders 30 kg whenever stock plus open orders is at or under
180 kg; because 30 kg is less than three days of use, the stock on hand never climbs back above 180 kg
(except for a day or two after the Diwali closure). Yeast is therefore on the low-stock list on every
date, always with an order or two on the way - the list should show the quantity on order beside each
alert. By the ordinary rhythm flour is at or under its level on about seven days in ten, and between 2
and 16 materials (8 on average) are on the list at any day-end.

### 12.8 Items near expiry in a store

Rule: the store standing level of ladi pav is 1.6 normal days (6.5) and its life is three days. A store
therefore closes each day with a part-pack of the batch baked the day before yesterday's delivery was
topped up - at the start of business date B it holds ladi pav made on B-2 with best before B+1, which is
inside the one-day near-expiry flag. The largest demand factor a store can meet (1.48) is under the 1.6
days of standing, so the left-over is never zero. Every store thus shows near-expiry stock on every
date; the puffs of the day before show as expired with their write-off waiting for the Owner; and in
`fac_fg` the puffs for today's transfer are near expiry by definition. After the Diwali break the first
day shows expired bread and pav at every store.

---

## 13. Calibration targets

The self-check asserts these on the generated seed for business dates 2 October 2026, 1 April 2027 and
31 December 2027. A band that fails is fixed by a parameter above, never by patching an output.

| # | Measure | Band |
|---|---|---|
| 1 | Net sales before GST, 2026 | Rs 3.84 - 4.04 crore |
| 2 | Net sales before GST, 2027 | Rs 4.00 - 4.22 crore |
| 3 | Net sales, 2026-01-01..2026-10-01 | Rs 2.88 - 3.03 crore |
| 4 | Net sales of each month | within 3% of 11.6 |
| 5 | Average net sales a day, each year | Rs 1.05 - 1.16 lakh |
| 6 | Net sales on an open day | Rs 55,000 - 1,45,000 |
| 7 | Channel shares of a year: retail outlets / corporates / own stores | 50-54% / 20-23% / 25-28% |
| 8 | Store shares of store sales: S1 / S2 / S3 | 45-49% / 28-32% / 21-25% |
| 9 | Stale returns, share of retail supply, a year | 3.4 - 4.5% |
| 10 | Stale returns on the fresh lines (BR and BN groups), a year | 4.6 - 6.0% |
| 11 | O19 credit notes held, share of its notes from February 2026 | at least 95% |
| 12 | Held credit notes of all other outlets, a month outside July-September | at most 30 |
| 13 | Recipe cost of goods sold, share of net sales, a year | 46.5 - 50% in 2026; 48 - 51.5% in 2027 |
| 14 | Material cost (recipe cost + production loss + write-offs + count differences), a year | 47.5 - 51.5% in 2026; 49.5 - 53% in 2027 |
| 15 | Material cost, any month | 45 - 55% |
| 16 | Product margin to retailers (retailer price - recipe cost) | above zero for every product in every month |
| 17 | Production loss, a year | 0.1 - 0.6% of sales |
| 18 | Write-offs, a year | 0.7 - 1.6% of sales |
| 19 | Count differences, a year | 0.1 - 0.4% of sales |
| 20 | Yield, all entries of a month | 98.5 - 100.5% |
| 21 | Yield of the dip product on its entries dated the 5th to the 18th | 88 - 95% |
| 22 | Store puffs expired, share of puffs received, a year | 9 - 17% |
| 23 | Salaries, share of sales, a year | 21.5 - 24.5% |
| 24 | Expenses other than salaries, a year | 15.5 - 18.5% |
| 25 | Operating profit, 2026 | 8.5 - 12% |
| 26 | Operating profit, 2027 | 6.5 - 10.5% |
| 27 | Operating profit, any month | -4% to +19% |
| 28 | Operating profit, any calendar quarter | above 4% |
| 29 | Receivables at each month end from February 2026 | Rs 7.5 - 11.5 lakh; 6.5 - 10 days of sales with GST |
| 30 | Corporate receivables at each month end | 24 - 38 days of corporate sales |
| 31 | Overdue receivables on every day | above zero |
| 32 | C06 balance on every day | above its credit limit |
| 33 | Every other corporate, every day from 2026-02-01 | at or under its credit limit |
| 34 | Payables to stock vendors at each month end | Rs 8.0 - 13.5 lakh; 15 - 23 days of purchases with GST |
| 35 | Days from 2026-02-01 with an overdue payable to VM08 or VM13, share of the days | at least 99.4% |
| 36 | Material stock value at each month end | Rs 4.5 - 7.5 lakh; 8 - 13 days of consumption |
| 37 | Finished stock at the factory at each month end, at recipe cost | Rs 1.2 - 2.6 lakh |
| 38 | Finished stock at the three stores together | Rs 10,000 - 25,000 |
| 39 | Day-end stock of every material | at least the standard day plan of the next three days, every day from 2026-02-01 |
| 40 | Safety-net orders (4.5 rule 7) | zero |
| 41 | Materials at or under their reorder level at each day-end from 2026-01-05 | at least 1; 4 - 12 on average over a month |
| 42 | Purchase orders a month | 80 - 120, of which 8 - 13 above Rs 50,000 |
| 43 | A held vendor bill on every day after 2026-01-05 | at least 1 |
| 44 | S3 cash shortages in any 30 days | 2 - 4 |
| 45 | Near-expiry batches at each store at the start of every open day after a normal day | at least 1 |
| 46 | Hand-over (build specification section 6) | holds on every day that is not followed by a closed day |
| 47 | Stock, every cash account and the bank, in posting order | never negative |
| 48 | Factory cash at any day-end | Rs 5,000 - 90,000 |
| 49 | Bank balance on 2027-12-31 | Rs 60 - 100 lakh |
| 50 | Mixes of any production entry | inside the smallest - largest column of 3.5, plus one step |
| 51 | Flour (RM01 + RM02) consumed a day, a year | 640 - 730 kg |
| 52 | Two runs of the seed | identical |

**Bands corrected against the simulation.** Seven bands were analytic estimates made before the
simulation existed and failed by construction; where they disagreed, the simulation was right. No
parameter was changed for them. The same reasons stand beside each band in `js/data/config.js`.

| # | Was | Is | Reason |
|---|---|---|---|
| 30 | 24 - 36 days | 24 - 38 days | the highest month end of the simulation is 37.6 days (May 2026) |
| 33 | every day | every day from 2026-02-01 | in January 2026 C01, C03, C05 and C07 stand above their limits on 21 days, until their opening invoices are settled; no copy has a business date before 2026-02-01 |
| 34 | Rs 8.5 - 13.5 lakh | Rs 8.0 - 13.5 lakh | the lowest month end of the simulation is Rs 8.23 lakh (May 2027) |
| 35 | above zero on every day | on at least 99.4% of the days from 2026-02-01 | nothing is overdue to the two from 5 to 30 January 2026, nor on 2026-11-26 and 2027-03-29 to 31: 695 of the 699 days to 2027-12-31 |
| 39 | every day | every day from 2026-02-01 | on 1 and 2 January 2026 the opening stock of RM22 and of RM01 is under the three-day plan |
| 42 | 90 - 120 orders | 80 - 120 orders | the fewest are 81, in November 2026, a month with three closed days |
| 50 | veg puff 4 - 8 mixes (3.5) | veg puff 3.5 - 9 mixes | the two-year run gives 3.5 to 8.75 mixes; 13 of the 9,990 entries lay outside 4 - 8 plus a step |

---

## 14. Points for the build

Places where this file is more specific than, or differs from, the wording of `docs/SPEC.md` section 6.
None needs a change to the engine.

1. **Mix steps.** Production runs in steps of 0.5 mix (0.25 for puffs), not whole mixes; the engine
   takes three decimals.
2. **Held vendor bills.** The Owner clears everything pending the next morning except a held VM09 bill,
   which waits a week (12.5).
3. **Closed days.** No dispatch, transfer, day-end or production documents; the hand-over guarantee
   does not apply to the day before a closed day. A copy whose business date is a closed day (2026-11-09
   to 2026-11-11, 2027-10-30, 2027-10-31) opens with nothing to dispatch; its prefilled sheets will
   offer to cut to the stock on hand, which is none.
4. **Prefill against demand.** The prefilled sheet is the standing order; on a day whose factors are
   under 1.00 the seed dispatches less. Production always covers the full prefill of the next morning
   (3.5), so today's sheets post as prefilled on any business date.
5. **Standard day plan.** `standardMixes` are rounded up, so the plan uses more flour than a real day;
   reorder levels are sized on the plan.
6. **Store documents of S1 and S3** are created by `u_store_mgr` (the only store persona) with the
   store's own manager named in the note.
7. **Dated master changes in the seed**: the two price revisions (18 item rows), the salary raises, the
   joiners and leavers, and the seasonal puff standing of 6.5.
8. **GSTINs** are synthetic; the generator may recompute the check character with the rule of 5.1.
9. **Tentative dates.** If the moon-dependent dates of 2027 move by a day only rows E08, E09 and E12
   change. The minimum-wage steps after 1 April 2026 are projected; no salary depends on them.
10. **Sources** for every researched figure are in the raw files; this file carries none.
