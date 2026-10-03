# Products, prices and demand - research parameters

Researched on 2 October 2026 for the Happy Bakers sample (scope v0.3). Happy Bakers is fictional.
Figures taken from a page that was opened carry its URL. Where the public record is silent the value is
an **assumption**, marked (A). Money is in rupees. "Before GST" is always stated; MRP always includes GST.

Reviewed on 2 October 2026: the cited pages were re-opened (section 1 says where a listing had changed),
every table was recomputed from the rules, and the file was checked against the scope and against
`recipes-yields.md`, `people-overheads.md` and `calendar-geography.md`. What that check changed: the
trade-listing rows of 1.2, the ladi pav, jumbo bun and puff weights in section 2 (now those of the
recipes), the reading of the 8% return limit in 6.6, a note on store expiry in 8.3, and cross-references
to the calendar and recipe files in sections 7, 9 and 10. No price, rate, quantity or total changed.

Every parameter below is a **rule that holds for any date from 1 January 2026 to 31 December 2027**.
Nothing here is a list that stops in October 2026.

No business or person is named in this file. Outlets, corporates and stores carry ids (O01-O40, C01-C10,
S1-S3), a type and a real locality; their invented names belong to the customer master.

Headline result (section 9): a normal day at the opening price list sells **Rs 1,08,748 before GST, net
of stale returns** - retail outlets Rs 50,644, corporates Rs 25,463, own stores Rs 32,641. With the
day-of-week, month, vacation and price-revision rules the model gives **Rs 4.03 crore for 2026** and
**Rs 4.19 crore for 2027**, before the event calendar; `calendar-geography.md` (festivals, the Diwali
closure, rain) brings that to about Rs 3.95 crore and Rs 4.13 crore.

---

## 1. What the public record says (benchmarks)

### 1.1 Retail prices seen (MRP, GST included)

| Product | Price seen | Brand position | Source |
|---|---|---|---|
| Sandwich bread 400 g | Rs 60 | premium Gujarat bakery chain | https://store.atulbakery.com/collections/bread |
| Sandwich bread 800 g | Rs 85 | same | https://store.atulbakery.com/collections/bread |
| Brown bread 400 g | Rs 65 | same | https://store.atulbakery.com/collections/bread |
| Bhaji pav 12 pieces / 6 pieces | Rs 50 / Rs 28 | same | https://store.atulbakery.com/collections/bread |
| Wheat bhaji pav 12 pieces | Rs 55 | same | https://store.atulbakery.com/collections/bread |
| Burger bun 2 pieces | Rs 34 | same | https://store.atulbakery.com/collections/bread |
| Soft white pizza bread 7 inch | Rs 40 | same | https://store.atulbakery.com/collections/bread |
| Jeera khari 200 g; wheat khari 200 g; plain khari 400 g | Rs 80; Rs 85; Rs 145 | same | https://store.atulbakery.com/collections/khari-1 |
| Milk rusk 200 g | Rs 80 | same | https://store.atulbakery.com/collections/all?page=4 |
| Chinese puff, piece | Rs 30 | same | https://store.atulbakery.com/collections/all?page=2 |
| Butter sandwich bread 400 g | MRP Rs 50 (selling Rs 47) | national dairy brand, strong in Gujarat | https://blinkit.com/prn/amul-white-sandwich-bread/prid/446209 |
| Sandwich loaf 400 g | Rs 40 -> Rs 45 from 16 May 2026; whole wheat Rs 55 -> Rs 60 | national bread brand | https://www.whalesbook.com/news/Hinglish/consumer-products/Modern-Bread-Hikes-Bread-Prices-by-indian-rupee5-Amid-Soaring-Costs-Weaker-Rupee/6a0b8d8acfe07c0307ec2327 |
| Elaichi rusk 250 g | MRP Rs 50 (selling Rs 39) | national brand | https://blinkit.com/prn/britannia-toastea-premium-bake-rusk/prid/15366 |
| Jeera biscuits 250 g | Rs 120, shelf life 90 days | sweet-shop brand | https://sangamsweets.in/products/jeera-biscuits |
| Burger bun 200 g, 4 pieces | MRP Rs 40 | a second national bread brand | https://blinkit.com/prn/english-oven-burger-bun-200-g/prid/18405 |
| Pizza base 200 g, 2 pieces | MRP Rs 50 | same | https://blinkit.com/prn/english-oven-pizza-base/prid/18736 |

### 1.2 Wholesale / trade listings in Gujarat (IndiaMART, October 2026)

| Product | Price seen | Source |
|---|---|---|
| Burger bun, 4 pieces (plain), Ahmedabad | Rs 40 a pack (three sellers; one states 300 g, the others give no weight); Rs 10 a piece (Kalol) | https://dir.indiamart.com/ahmedabad/burger-bun.html |
| Burger bun, sesame, 4 pieces, Ahmedabad | Rs 56 a pack | https://dir.indiamart.com/ahmedabad/burger-bun.html |
| Pizza base: 2 pieces (Gandhinagar); soft 6 inch, 4 pieces; thin crust, 4 pieces; 7 inch 150 g | Rs 30 a pack; Rs 60 a pack; Rs 35 a pack; Rs 43 a piece | https://dir.indiamart.com/ahmedabad/pizza-crust.html |
| Pav: 12 pieces 400 g (Ahmedabad); 12 pieces, weight not given (Ahmedabad); Bombay pav 400 g (Surat); dabeli pav 6 pieces 200 g | Rs 50; Rs 50; Rs 45; Rs 25 a pack. The listings rotate: a 6-piece 100 g pack at Rs 30 and a 12-piece 250 g pack at Rs 24 noted at first reading were not shown at re-check | https://dir.indiamart.com/impcat/pav-bun.html |
| Fresh veg puff (Kalol); puff, assorted fillings, and Chinese puff (Ahmedabad); matar puff (Kalol) | Rs 15; Rs 20; Rs 20 a piece. The paneer puff listing (Ahmedabad) shows no price at re-check; Rs 25 was noted at first reading | https://dir.indiamart.com/ahmedabad/puff-pastry.html |
| Suji rusk toast 350 g; multigrain toast 190 g; milk rusk 250 g | Rs 40; Rs 44; Rs 100 a pack | https://dir.indiamart.com/ahmedabad/rusk-toast.html |
| Dry fruit cake 200 g, Ahmedabad, shelf life 1 month | Rs 60 a piece | https://www.indiamart.com/proddetail/dry-fruit-cake-200gm-21432814312.html |

Reading: a mid-market regional brand sits **below the premium chain and between the national bread
brand and the national dairy brand** on sandwich bread, and well below the premium chain on khari, toast
and puffs. The Happy Bakers list in section 3 is placed there.

### 1.3 Trade terms and returns

| Fact | Figure | Source |
|---|---|---|
| Retailer margin, packaged food | 20% of MRP (retailer buys a Rs 175 MRP pack at about Rs 140) | https://storewise.in/blog/fmcg-distribution-margins-and-sales-structure |
| Bakery and confectionery distributor gross margin; returns | 8-14% gross, 3-6% net; returns "can reach 5-8% of volume" | https://spirestock.com/blog/fmcg-distributor-margin-profit-guide-india |
| Bread returns in India | "more than 10 per cent of dispatches" is common; shelf life "about four days on an average" | https://aibma.com/industry.html |
| Bakery customer mix | A Gujarat bread maker lists hotels, restaurants, cafes, QSR chains, institutional buyers and caterers beside distributors and retail outlets | https://www.superbread.com/ |

Happy Bakers sells direct from its own vans (no distributor), so the whole trade margin is the retailer's
18-21% of MRP (A). Returns are seeded at a well-run 5% on fresh lines, as the scope requires.

### 1.4 GST and HSN

| Fact | Source |
|---|---|
| From 22 September 2025: "Pastry, cakes, biscuits and other bakers' wares ... (other than bread, pizza bread, khakhra, chapathi, roti)" under 1905 move to 5%; "Pizza bread" (1905) and "Khakhra, chapathi or roti" move to Nil. Bread stays Nil | GST Council press release, 3 September 2025: https://gstcouncil.gov.in/sites/default/files/2025-09/press_release_press_information_bureau.pdf |
| Tariff items under heading 1905: 1905 40 00 rusks, toasted bread and similar toasted products; 1905 90 10 pastries and cakes; 1905 90 20 biscuits not elsewhere specified; 1905 90 90 other | https://busy.in/hsn/sub-chapter-1905/ |
| Rates summary (bread 0%; cakes, pastries, biscuits 5% from 22 September 2025) | https://busy.in/gst-rates/bakery-products/ |
| HSN digits on invoices: turnover up to Rs 5 crore - 4 digits, mandatory on B2B invoices, optional on B2C; above Rs 5 crore - 6 digits (Notification 78/2020, from 1 April 2021) | https://taxguru.in/goods-and-service-tax/hsn-code-mandatory-irrespective-turnover-01-04-2021.html |

At about Rs 4 crore Happy Bakers needs only the 4-digit HSN **1905** on its invoices. The item master
carries the 8-digit tariff item below; the invoice may print either. The whole seed period is after
22 September 2025, so each item has one GST rate throughout (scope section 11).

### 1.5 School calendar (drives hostel, school-canteen and student demand)

| Vacation | Dates | Source |
|---|---|---|
| Summer 2026 | 4 May - 7 June 2026 | https://www.pw.live/gshseb/exams/gujarat-school-holiday-list-2026 |
| Diwali 2026 | 5 - 25 November 2026 (21 days) | https://deshgujarat.com/2026/05/03/gujarat-board-schools-academic-calendar-2026-27-classes-from-june-8-21-days-diwali-vacation-35-days-summer-vacation/ |
| Summer 2027 | 3 May - 6 June 2027 (35 days) | same |
| Diwali 2027 | 26 October - 15 November 2027 (A: the 2027-28 calendar is not published; 21 days starting three days before Diwali, as in 2026, when Diwali was 8 November). Diwali 2027 is Friday 29 October | https://dekhopanchang.com/en/festivals/diwali/2027 |

---

## 2. Product master (18 items)

Pack, GST rate and best-before days are the scope's. Net weight of the piece-count packs, pieces per pack
of the weight packs and puff weights are (A), set from the listings in section 1 and equal to the weights
the recipes of `recipes-yields.md` are built on (ladi pav 400 g, buns 200 g and 300 g, pizza base 200 g,
a puff about 70 g).

| # | Code | Key | Item | Pack as sold | Net weight | Pieces per pack | HSN | GST | Best before |
|---|---|---|---|---|---|---|---|---|---|
| 1 | FG01 | SB | Sandwich bread | 400 g loaf, sliced | 400 g | 1 loaf (about 16 slices + 2 ends) | 1905 90 90 | Nil | 4 days |
| 2 | FG02 | BB | Brown bread | 400 g loaf, sliced | 400 g | 1 loaf (about 16 slices + 2 ends) | 1905 90 90 | Nil | 4 days |
| 3 | FG03 | JL | Jumbo sandwich loaf | 800 g loaf, large slice | 800 g | 1 loaf (about 26 large slices) | 1905 90 90 | Nil | 4 days |
| 4 | FG04 | LP | Ladi pav | 12 pieces | 400 g (about 33 g each) | 12 | 1905 90 90 | Nil | 3 days |
| 5 | FG05 | BNP | Burger bun, plain | 4 pieces | 200 g (50 g each) | 4 | 1905 90 90 | Nil | 4 days |
| 6 | FG06 | BNS | Burger bun, sesame | 4 pieces | 200 g (50 g each) | 4 | 1905 90 90 | Nil | 4 days |
| 7 | FG07 | BNW | Burger bun, whole wheat | 4 pieces | 200 g (50 g each) | 4 | 1905 90 90 | Nil | 4 days |
| 8 | FG08 | BNJ | Burger bun, jumbo | 4 pieces, large | 300 g (75 g each) | 4 | 1905 90 90 | Nil | 4 days |
| 9 | FG09 | PZ | Pizza base | 2 pieces, 7 inch | 200 g (100 g each) | 2 | 1905 90 90 | Nil | 5 days |
| 10 | FG10 | TE | Elaichi toast | 250 g pouch | 250 g | about 20 | 1905 40 00 | 5% | 90 days |
| 11 | FG11 | TM | Milk toast | 400 g pouch | 400 g | about 28 | 1905 40 00 | 5% | 90 days |
| 12 | FG12 | KB | Butter khari | 200 g box | 200 g | about 22 | 1905 90 90 | 5% | 90 days |
| 13 | FG13 | KJ | Jeera khari | 200 g box | 200 g | about 22 | 1905 90 90 | 5% | 90 days |
| 14 | FG14 | JB | Jeera biscuit | 250 g box | 250 g | about 30 | 1905 90 20 | 5% | 60 days |
| 15 | FG15 | TC | Tea cake (tutti-frutti) | 200 g bar | 200 g | 1 bar (about 8 slices) | 1905 90 10 | 5% | 15 days |
| 16 | FG16 | PV | Veg puff | piece | about 70 g | 1 | 1905 90 10 | 5% | 1 day |
| 17 | FG17 | PP | Paneer puff | piece | about 70 g | 1 | 1905 90 10 | 5% | 1 day |
| 18 | FG18 | PG | Garlic puff | piece | about 70 g | 1 | 1905 90 10 | 5% | 1 day |

Notes.

- The unit of sale and stock is the **pack** for items 1-15 and the **piece** for items 16-18.
- Bread, pav and buns are "bread" (Nil). Pizza base is "pizza bread" (Nil from 22 September 2025). Both
  sit in the residual tariff item 1905 90 90 (A); the Nil rate comes from the description, not the
  8-digit code. The busy.in listing shows pizza bread beside 1905 40 00; the rate is Nil under either
  code. Khari is classed here with "other bakers' wares" (1905 90 90), as the scope does; some traders
  put it under 1905 40 00 or 1905 90 10. The rate is 5% either way.
- Every 8-digit tariff item in the table is a reading of the tariff descriptions (A). What is verified
  is the heading (1905) and the rate of each item; the 4-digit heading is all the invoice needs (1.4).
- Best before is counted from the manufacturing date: a puff made on day D-1 and sent out on the morning
  of day D is good for day D only.

---

## 3. Price list in force from 1 January 2026 (opening list)

All trade prices are **before GST**. "Retailer pays" adds GST, to show the margin on MRP.
Own stores sell at MRP; store sales are reported before GST, so the store realisation is MRP for Nil
items and MRP / 1.05 for 5% items.

| Key | Item | MRP (GST incl.) | Retailer price, before GST | Retailer pays, GST incl. | Retailer margin on MRP | Corporate price, before GST | Corporate below retailer | Store realisation, before GST |
|---|---|---|---|---|---|---|---|---|
| SB | Sandwich bread 400 g | 45 | 36.00 | 36.00 | 20.0% | 34.00 | 5.6% | 45.00 |
| BB | Brown bread 400 g | 55 | 44.00 | 44.00 | 20.0% | 42.00 | 4.5% | 55.00 |
| JL | Jumbo sandwich loaf 800 g | 80 | 65.00 | 65.00 | 18.8% | 60.00 | 7.7% | 80.00 |
| LP | Ladi pav 12 pieces | 40 | 32.00 | 32.00 | 20.0% | 30.00 | 6.3% | 40.00 |
| BNP | Burger bun, plain, 4 pieces | 40 | 32.00 | 32.00 | 20.0% | 30.00 | 6.3% | 40.00 |
| BNS | Burger bun, sesame, 4 pieces | 45 | 36.00 | 36.00 | 20.0% | 34.00 | 5.6% | 45.00 |
| BNW | Burger bun, whole wheat, 4 pieces | 50 | 40.00 | 40.00 | 20.0% | 38.00 | 5.0% | 50.00 |
| BNJ | Burger bun, jumbo, 4 pieces | 60 | 49.00 | 49.00 | 18.3% | 45.00 | 8.2% | 60.00 |
| PZ | Pizza base, 2 pieces | 35 | 28.00 | 28.00 | 20.0% | 26.00 | 7.1% | 35.00 |
| TE | Elaichi toast 250 g | 60 | 45.00 | 47.25 | 21.3% | 43.00 | 4.4% | 57.14 |
| TM | Milk toast 400 g | 90 | 68.00 | 71.40 | 20.7% | 65.00 | 4.4% | 85.71 |
| KB | Butter khari 200 g | 70 | 53.00 | 55.65 | 20.5% | 51.00 | 3.8% | 66.67 |
| KJ | Jeera khari 200 g | 65 | 49.00 | 51.45 | 20.8% | 47.00 | 4.1% | 61.90 |
| JB | Jeera biscuit 250 g | 90 | 68.00 | 71.40 | 20.7% | 65.00 | 4.4% | 85.71 |
| TC | Tea cake 200 g | 70 | 53.00 | 55.65 | 20.5% | 50.00 | 5.7% | 66.67 |
| PV | Veg puff | 20 | 15.25 | 16.01 | 19.9% | 14.50 | 4.9% | 19.05 |
| PP | Paneer puff | 30 | 23.00 | 24.15 | 19.5% | 22.00 | 4.3% | 28.57 |
| PG | Garlic puff | 25 | 19.00 | 19.95 | 20.2% | 18.00 | 5.3% | 23.81 |

How the list was set (A, against section 1):

- Sandwich bread Rs 45: the national bread brand was Rs 40 until May 2026 and Rs 45 after, the dairy
  brand Rs 50, the premium Gujarat chain Rs 60. Brown bread Rs 55 against Rs 55-65. Jumbo 800 g Rs 80
  against Rs 85.
- Ladi pav 12 pieces Rs 40 against Rs 50 at the premium chain and Rs 50 for a 12-piece 400 g pack in
  an Ahmedabad trade listing; burger bun 4 pieces Rs 40 is the going Ahmedabad pack price and a national
  brand's MRP for 200 g; sesame Rs 45 against a Rs 56 listing; pizza base Rs 35 for two against Rs 30
  for a trade pair, Rs 50 for a national brand's 200 g pair and Rs 40 for one 7-inch base at the premium
  chain.
- Elaichi toast 250 g Rs 60 sits above the national rusk (Rs 50) and far below the premium chain
  (Rs 80 for 200 g). Khari 200 g Rs 65-70 against Rs 80. Jeera biscuit 250 g Rs 90 against Rs 120.
  Tea cake 200 g Rs 70 against a Rs 60 trade listing.
- Puffs Rs 20 / 25 / 30 against Rs 15-20 wholesale in Ahmedabad and Kalol and Rs 30 at the premium
  chain.
- Retailer margin 18.3-21.3% of MRP; the two jumbo lines carry the lowest margin because few outlets
  stock them. Corporate price 4-8% below the retailer price; the two bulk lines (jumbo loaf, jumbo bun)
  get the deepest cut.
- A retailer price is kept for every item, including the lines not on a standing order, so that a user
  can add any item to a dispatch sheet.

Tax on a line: Nil items carry no tax. 5% items carry CGST 2.5% + SGST 2.5% on the before-GST value.
A store line is units x MRP / 1.05 before GST, the rest is CGST and SGST in equal halves.

---

## 4. List-price revisions (A)

Two revisions in 2026-2027. Each is a new price list **effective for every document dated on or after
the date**; documents posted before keep their prices (scope 4.1). Standing-order quantities do not
change. A credit note for a stale return uses the price on the invoice it reverses.

Rule: MRP rounded to the whole rupee; trade prices to the nearest Rs 0.50 (puffs Rs 0.25); retailer
margin kept inside 18-22% of MRP.

**Revision 1 - 1 July 2026 - the nine Nil-rated fresh lines (items 1-9) - about +6%.** Reason shown in
the change history: "flour, packaging and diesel". It follows the national bread brands, which went up
Rs 5 a loaf in mid-May 2026 (section 1.1).

| Key | MRP old -> new | Retailer price old -> new | Retailer margin on MRP | Corporate price old -> new |
|---|---|---|---|---|
| SB | 45 -> 48 | 36.00 -> 38.50 | 19.8% | 34.00 -> 36.00 |
| BB | 55 -> 58 | 44.00 -> 46.50 | 19.8% | 42.00 -> 44.50 |
| JL | 80 -> 85 | 65.00 -> 69.00 | 18.8% | 60.00 -> 63.50 |
| LP | 40 -> 42 | 32.00 -> 34.00 | 19.0% | 30.00 -> 32.00 |
| BNP | 40 -> 42 | 32.00 -> 34.00 | 19.0% | 30.00 -> 32.00 |
| BNS | 45 -> 48 | 36.00 -> 38.50 | 19.8% | 34.00 -> 36.00 |
| BNW | 50 -> 53 | 40.00 -> 42.50 | 19.8% | 38.00 -> 40.00 |
| BNJ | 60 -> 64 | 49.00 -> 52.00 | 18.8% | 45.00 -> 47.50 |
| PZ | 35 -> 37 | 28.00 -> 29.50 | 20.3% | 26.00 -> 27.50 |

**Revision 2 - 1 April 2027 - the nine 5% lines (items 10-18) - about +7%.** Reason: "shortening,
butter and paneer".

| Key | MRP old -> new | Retailer price old -> new | Retailer pays, GST incl. | Retailer margin on MRP | Corporate price old -> new | Store realisation, before GST |
|---|---|---|---|---|---|---|
| TE | 60 -> 64 | 45.00 -> 48.00 | 50.40 | 21.3% | 43.00 -> 46.00 | 60.95 |
| TM | 90 -> 95 | 68.00 -> 72.00 | 75.60 | 20.4% | 65.00 -> 69.00 | 90.48 |
| KB | 70 -> 75 | 53.00 -> 57.00 | 59.85 | 20.2% | 51.00 -> 54.50 | 71.43 |
| KJ | 65 -> 70 | 49.00 -> 53.00 | 55.65 | 20.5% | 47.00 -> 50.50 | 66.67 |
| JB | 90 -> 95 | 68.00 -> 72.00 | 75.60 | 20.4% | 65.00 -> 69.00 | 90.48 |
| TC | 70 -> 75 | 53.00 -> 57.00 | 59.85 | 20.2% | 50.00 -> 53.50 | 71.43 |
| PV | 20 -> 22 | 15.25 -> 16.75 | 17.59 | 20.1% | 14.50 -> 16.00 | 20.95 |
| PP | 30 -> 32 | 23.00 -> 24.50 | 25.73 | 19.6% | 22.00 -> 23.50 | 30.48 |
| PG | 25 -> 27 | 19.00 -> 20.50 | 21.53 | 20.3% | 18.00 -> 19.50 | 25.71 |

So in October 2026 sandwich bread is Rs 48: above the national bread brand (Rs 45), below the dairy
brand (Rs 50) and the premium chain (Rs 60). A copy opened before 1 April 2027 never sees revision 2.

---

## 5. Which channel buys what (A)

R = on the retail routes, C = corporates, S = own stores. "(B, G)" = only the bakery-counter and
general-store outlet types take it.

| Key | Item | Retail outlets | Corporates | Own stores | Note |
|---|---|---|---|---|---|
| SB | Sandwich bread | R, every type | C | S | the volume line |
| BB | Brown bread | R, not tea stalls | C | S | |
| JL | Jumbo sandwich loaf | - | C | S, a few | canteens, messes, hospital, hotel |
| LP | Ladi pav | R, every type | C | S | tea stalls and caterers are the heavy buyers |
| BNP | Burger bun, plain | R, every type | C | S | |
| BNS | Burger bun, sesame | R (B, G) | C | S | |
| BNW | Burger bun, whole wheat | R (B, G) | C | S | |
| BNJ | Burger bun, jumbo | - | C | S, a few | cafes, caterers, hotel, canteen |
| PZ | Pizza base | R, not tea stalls | C | S | |
| TE | Elaichi toast | R, every type | C (messes, hospital) | S | |
| TM | Milk toast | R, not tea stalls | C (mess, hospital) | S | |
| KB | Butter khari | R, every type | - | S | |
| KJ | Jeera khari | R, not dairy parlours | - | S | |
| JB | Jeera biscuit | R, not dairy parlours or tea stalls | C (hotel) | S | |
| TC | Tea cake | R, not tea stalls | C (hotel, school) | S | |
| PV | Veg puff | - | C (canteens, school) | S | one-day life: not sent on the routes |
| PP | Paneer puff | - | C (school) | S | |
| PG | Garlic puff | - | C (canteen, cafe) | S | |

---

## 6. Retail outlets (40, on 4 van routes) (A)

### 6.1 Outlet types and counts

| Type | What it is | Count | R1 Anand town | R2 Vidyanagar-Karamsad | R3 Nadiad | R4 Borsad-Petlad |
|---|---|---|---|---|---|---|
| P | Provision (kirana) store | 14 | 4 | 3 | 4 | 3 |
| D | Dairy parlour (milk, curd, bread) | 9 | 3 | 3 | 2 | 1 |
| T | Tea stall / snack cart (pav, bun-maska, toast and khari with tea) | 7 | 2 | 3 | 1 | 1 |
| B | Small bakery counter / cake shop that resells bread and dry bakery | 5 | 2 | 1 | 1 | 1 |
| G | General store / mini supermarket | 5 | 2 | 1 | 1 | 1 |
| | **Total** | **40** | **13** | **11** | **9** | **7** |

### 6.2 Standing-order template, units per normal day, medium outlet

| Type | SB | BB | LP | BNP | BNS | BNW | PZ | TE | TM | KB | KJ | JB | TC | Value before GST, opening list |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| P provision store | 10 | 2 | 6 | 2 | - | - | 2 | 3 | 1 | 2 | 1 | 1 | 1 | Rs 1,239 |
| D dairy parlour | 12 | 3 | 8 | 2 | - | - | 2 | 2 | 1 | 1 | - | - | 1 | Rs 1,204 |
| T tea stall | 4 | - | 14 | 6 | - | - | - | 2 | - | 2 | 1 | - | - | Rs 1,029 |
| B bakery counter | 8 | 3 | 5 | 3 | 2 | 1 | 4 | 3 | 1 | 2 | 2 | 2 | 2 | Rs 1,549 |
| G general store | 12 | 4 | 4 | 2 | 1 | 1 | 3 | 3 | 1 | 2 | 1 | 1 | 2 | Rs 1,492 |

JL, BNJ and the three puffs are never on a standing order.

### 6.3 Outlet size

Each outlet has a size: **S = 0.75, M = 1.00, L = 1.30**. Its standing order is the template times the
size factor, each line rounded half up to a whole pack (a line that rounds to 0 is dropped). The result,
for checking the generator:

| Type | Size | SB | BB | LP | BNP | BNS | BNW | PZ | TE | TM | KB | KJ | JB | TC | Rs/day opening list | after revision 1 | after revision 2 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| P | S | 8 | 2 | 5 | 2 | - | - | 2 | 2 | 1 | 2 | 1 | 1 | 1 | 1,090 | 1,132.00 | 1,162.00 |
| P | M | 10 | 2 | 6 | 2 | - | - | 2 | 3 | 1 | 2 | 1 | 1 | 1 | 1,239 | 1,288.00 | 1,321.00 |
| P | L | 13 | 3 | 8 | 3 | - | - | 3 | 4 | 1 | 3 | 1 | 1 | 1 | 1,613 | 1,679.50 | 1,719.50 |
| D | S | 9 | 2 | 6 | 2 | - | - | 2 | 2 | 1 | 1 | - | - | 1 | 988 | 1,034.50 | 1,052.50 |
| D | M | 12 | 3 | 8 | 2 | - | - | 2 | 2 | 1 | 1 | - | - | 1 | 1,204 | 1,264.50 | 1,282.50 |
| D | L | 16 | 4 | 10 | 3 | - | - | 3 | 3 | 1 | 1 | - | - | 1 | 1,561 | 1,641.50 | 1,662.50 |
| T | S | 3 | - | 11 | 5 | - | - | - | 2 | - | 2 | 1 | - | - | 865 | 904.50 | 922.50 |
| T | M | 4 | - | 14 | 6 | - | - | - | 2 | - | 2 | 1 | - | - | 1,029 | 1,079.00 | 1,097.00 |
| T | L | 5 | - | 18 | 8 | - | - | - | 3 | - | 3 | 1 | - | - | 1,355 | 1,419.50 | 1,444.50 |
| B | S | 6 | 2 | 4 | 2 | 2 | 1 | 3 | 2 | 1 | 2 | 2 | 2 | 2 | 1,296 | 1,340.00 | 1,382.00 |
| B | M | 8 | 3 | 5 | 3 | 2 | 1 | 4 | 3 | 1 | 2 | 2 | 2 | 2 | 1,549 | 1,606.00 | 1,651.00 |
| B | L | 10 | 4 | 7 | 4 | 3 | 1 | 5 | 4 | 1 | 3 | 3 | 3 | 3 | 2,093 | 2,167.50 | 2,231.50 |
| G | S | 9 | 3 | 3 | 2 | 1 | 1 | 2 | 2 | 1 | 2 | 1 | 1 | 2 | 1,235 | 1,283.00 | 1,317.00 |
| G | M | 12 | 4 | 4 | 2 | 1 | 1 | 3 | 3 | 1 | 2 | 1 | 1 | 2 | 1,492 | 1,553.50 | 1,590.50 |
| G | L | 16 | 5 | 5 | 3 | 1 | 1 | 4 | 4 | 1 | 3 | 1 | 1 | 3 | 1,923 | 2,002.50 | 2,050.50 |

Counts by size: 10 small, 20 medium, 10 large. Smallest outlet Rs 865 a day, largest Rs 2,093, average
**Rs 1,314** (opening list).

### 6.4 The 40 outlets

Localities are real place names, indicative only (A). Value = standing order at the opening list.

| Id | Route | Locality | Type | Size | Rs/day |
|---|---|---|---|---|---|
| O01 | R1 | Station Road, Anand | P | L | 1,613 |
| O02 | R1 | Gamdi Vad, Anand | P | M | 1,239 |
| O03 | R1 | Mangalpura, Anand | P | M | 1,239 |
| O04 | R1 | Jitodia Road, Anand | P | S | 1,090 |
| O05 | R1 | Amul Dairy Road, Anand | D | L | 1,561 |
| O06 | R1 | Ganesh Chokdi, Anand | D | M | 1,204 |
| O07 | R1 | Lambhvel Road, Anand | D | M | 1,204 |
| O08 | R1 | Old bus stand, Anand | T | L | 1,355 |
| O09 | R1 | Sardar Gunj, Anand | T | M | 1,029 |
| O10 | R1 | 100 Feet Road, Anand | B | L | 2,093 |
| O11 | R1 | Anand-Sojitra Road | B | M | 1,549 |
| O12 | R1 | Borsad Chokdi, Anand | G | L | 1,923 |
| O13 | R1 | Chikhodra Chokdi, Anand | G | M | 1,492 |
| O14 | R2 | Nana Bazar, Vallabh Vidyanagar | P | L | 1,613 |
| O15 | R2 | Karamsad, main bazar | P | M | 1,239 |
| O16 | R2 | Bakrol | P | S | 1,090 |
| O17 | R2 | Mota Bazar, Vallabh Vidyanagar | D | L | 1,561 |
| O18 | R2 | Anand-Karamsad Road, Karamsad | D | M | 1,204 |
| O19 | R2 | Mogri | D | S | 988 |
| O20 | R2 | Bhaikaka Circle, Vallabh Vidyanagar | T | L | 1,355 |
| O21 | R2 | Vitthal Udyognagar, estate gate | T | M | 1,029 |
| O22 | R2 | Janta Chokdi | T | S | 865 |
| O23 | R2 | Iskcon Temple Road, Vallabh Vidyanagar | B | M | 1,549 |
| O24 | R2 | New Vallabh Vidyanagar | G | M | 1,492 |
| O25 | R3 | Santram Road, Nadiad | P | L | 1,613 |
| O26 | R3 | College Road, Nadiad | P | M | 1,239 |
| O27 | R3 | Pij Road, Nadiad | P | M | 1,239 |
| O28 | R3 | Uttarsanda | P | S | 1,090 |
| O29 | R3 | Mission Road, Nadiad | D | M | 1,204 |
| O30 | R3 | Vaniyavad, Nadiad | D | M | 1,204 |
| O31 | R3 | Station Road, Nadiad | T | M | 1,029 |
| O32 | R3 | Piplag Road, Nadiad | B | M | 1,549 |
| O33 | R3 | Dakor Road, Nadiad | G | M | 1,492 |
| O34 | R4 | Station Road, Borsad | P | L | 1,613 |
| O35 | R4 | Station Road, Petlad | P | M | 1,239 |
| O36 | R4 | Napad | P | S | 1,090 |
| O37 | R4 | Dharmaj | D | S | 988 |
| O38 | R4 | Anand Chokdi, Borsad | T | S | 865 |
| O39 | R4 | College Road, Petlad | B | S | 1,296 |
| O40 | R4 | Bus stand, Borsad | G | S | 1,235 |

Normal-day standing orders by route (packs) and value before GST, opening list:

| Route | Outlets | SB | BB | LP | BNP | BNS | BNW | PZ | TE | TM | KB | KJ | JB | TC | Rs/day |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| R1 Anand town | 13 | 136 | 35 | 104 | 42 | 7 | 4 | 32 | 38 | 11 | 27 | 13 | 11 | 17 | 18,591 |
| R2 Vidyanagar-Karamsad | 11 | 100 | 23 | 95 | 38 | 3 | 2 | 21 | 29 | 8 | 21 | 9 | 6 | 10 | 13,985 |
| R3 Nadiad | 9 | 89 | 22 | 64 | 24 | 3 | 2 | 20 | 24 | 8 | 17 | 8 | 7 | 10 | 11,659 |
| R4 Borsad-Petlad | 7 | 58 | 14 | 43 | 18 | 3 | 2 | 14 | 17 | 6 | 14 | 7 | 6 | 8 | 8,326 |
| **All routes** | **40** | **383** | **94** | **306** | **122** | **16** | **10** | **87** | **108** | **33** | **79** | **37** | **30** | **45** | **52,561** |

By type: P Rs 18,246; D Rs 11,118; T Rs 7,527; B Rs 8,036; G Rs 7,634.

### 6.5 What is actually dispatched on a day

The standing order is master data and stays fixed. The seed's dispatch sheet changes the prefilled
quantities the way a van salesman does:

`units = stochastic round( standing units x day-of-week factor x month factor x noise )`

- **Day of week** (the vans run all seven days):

| Type | Mon-Fri | Sat | Sun |
|---|---|---|---|
| P provision store | 1.00 | 1.05 | 1.00 |
| D dairy parlour | 1.00 | 1.05 | 1.05 |
| T tea stall | 1.00 | 1.00 | 0.60 |
| B bakery counter | 1.00 | 1.10 | 1.15 |
| G general store | 1.00 | 1.10 | 1.15 |

- **Month** (retail outlets and own stores; bread sells less in the summer heat and school vacation,
  more in the monsoon and winter): Jan 1.03, Feb 1.02, Mar 1.00, Apr 0.96, May 0.92, Jun 0.97, Jul 1.03,
  Aug 1.04, Sep 1.02, Oct 1.00, Nov 0.98, Dec 1.04. The twelve average 1.00. The same twelve apply in
  2027.
- **Noise**: uniform 0.90-1.10 per outlet-line-day, from the seeded generator.
- **Stochastic round**: round down, then add 1 with probability equal to the fraction, so that small
  quantities keep their average.
- No volume growth is modelled: the year-on-year rise comes from the two price revisions only.
- Festival closures and other one-off days come from the event calendar, not from this file.

### 6.6 Stale returns (retail outlets only)

Return rate = share of the units dispatched that come back stale and are credited at the invoiced price.

| Key | Item | Return rate | Credit note raised this many days after the dispatch |
|---|---|---|---|
| SB | Sandwich bread | 4.5% | 3 |
| BB | Brown bread | 6.0% | 3 |
| JL | Jumbo sandwich loaf | 5.0% (only if a user adds it) | 3 |
| LP | Ladi pav | 5.5% | 2 |
| BNP | Burger bun, plain | 5.0% | 3 |
| BNS | Burger bun, sesame | 5.5% | 3 |
| BNW | Burger bun, whole wheat | 6.0% | 3 |
| BNJ | Burger bun, jumbo | 5.0% (only if a user adds it) | 3 |
| PZ | Pizza base | 4.0% | 4 |
| TE | Elaichi toast | 0.3% | 30 |
| TM | Milk toast | 0.3% | 30 |
| KB | Butter khari | 0.5% (breakage) | 30 |
| KJ | Jeera khari | 0.5% (breakage) | 30 |
| JB | Jeera biscuit | 0.3% | 30 |
| TC | Tea cake | 1.5% | 10 |
| PV, PP, PG | Puffs | not on the routes | - |

`returned units = stochastic round( units dispatched on (D - lag) x item rate x outlet factor x season factor )`

- **Outlet factor**: large 0.85, medium 1.00, small 1.20. Four slow outlets - **O04, O19, O28, O38**, one
  per route - use 1.80 instead.
- **Season factor**: 1.25 in July, August and September (humidity), otherwise 1.00.
- Result on a normal day: Rs 1,917 of Rs 52,561 = **3.65% of supply**; **about 5% on the fresh lines**
  (5.0% from the item rates alone, 5.2% with the outlet factors), about 0.5% on the long-life lines.
- Against the scope's 8% limit (returns against the last seven days' supply), expected values: the
  four slow outlets run at 5.7-6.9% of their supply normally (O04 and O28 5.7%, O19 6.8%, O38 6.9%) and
  at 7.2-8.7% in July-September (O04 and O28 7.2%, O19 8.5%, O38 8.7%); every other outlet stays at or
  below 4.6% (5.8% in the monsoon). So outside the monsoon the limit is crossed only when the rounding
  and noise run against a slow outlet, but **O19 and O38 are above it on average from July to
  September**: their credit notes wait for the owner on most monsoon days, those of O04 and O28 now and
  then. That is two outlets in forty for three months. If the approvals list should be quieter, lower
  the slow-outlet factor from 1.80 to 1.60 (O19 and O38 then average 7.6-7.7% in the monsoon); the
  normal-day return falls from Rs 1,917 to about Rs 1,889 and the totals of section 9 rise by 0.03%.
- Corporates return nothing: they order what they will use.

---

## 7. Corporates (10) (A)

Corporate prices, before GST. Orders are whole packs. Value = typical order at the opening list.

| Id | Type, locality | Frequency | Typical order (packs / pieces) | Order value before GST | 2026 total | Notes |
|---|---|---|---|---|---|---|
| C01 | Industrial canteen, large engineering unit, Vitthal Udyognagar | Daily, Monday-Saturday | JL 30, LP 50, BNJ 16, PV 100 | Rs 5,470 | Rs 17.51 lakh | the largest account; monthly purchase order |
| C02 | Industrial canteen run by a contractor, Anand-Vidyanagar Road | Daily, Monday-Saturday | JL 18, LP 30, PV 60, PG 30 | Rs 3,390 | Rs 10.81 lakh | monthly purchase order |
| C03 | Hostel mess, university hostels, Vallabh Vidyanagar | Daily, 7 days | JL 30, SB 10, LP 20, TE 6 | Rs 2,998 | Rs 10.05 lakh | x 0.30 in vacations |
| C04 | Hostel mess, medical campus, Karamsad | Daily, 7 days | JL 16, BB 6, LP 12, TM 4 | Rs 1,832 | Rs 6.13 lakh | x 0.30 in vacations |
| C05 | Hospital kitchen, Karamsad | Daily, 7 days | JL 20, BB 10, SB 8, TM 5, TE 4 | Rs 2,389 | Rs 8.92 lakh | flat all year; annual rate contract |
| C06 | Caterer, Anand town | Tuesday, Thursday, Saturday | LP 70, BNJ 24, PZ 30, BNP 20, JL 10 | Rs 5,160 | Rs 8.47 lakh | x caterer season factor |
| C07 | Caterer, Nadiad | Weekly, Friday | LP 90, BNJ 30, JL 20, PZ 24 | Rs 5,874 | Rs 3.19 lakh | x caterer season factor |
| C08 | Hotel with restaurant and banquet, Anand | Daily, 7 days | JL 12, BB 6, BNJ 12, BNS 8, PZ 10, TC 8, JB 4 | Rs 2,704 | Rs 10.66 lakh | x 1.20 on Saturday and Sunday |
| C09 | School canteen, Lambhvel Road, Anand | Daily, Monday-Saturday, in term | PV 90, PP 30, BNP 16, SB 6, TC 10 | Rs 3,149 | Rs 8.41 lakh | no orders in vacations |
| C10 | Cafe / fast-food counter, Vallabh Vidyanagar | Alternate days | BNJ 40, BNS 24, BNW 12, PZ 30, PG 30 | Rs 4,392 | Rs 7.86 lakh | x 0.70 in vacations |
| | **All ten** | | | week average **Rs 25,463 a day** | **Rs 92.00 lakh** | |

Rules.

- **Alternate days** (C10): an order on every day whose count from 1 January 2026 (that day = 0) is even.
- **Vacations** (C03, C04, C09, C10 and store S2): 4 May - 7 June 2026; 5 - 25 November 2026;
  3 May - 6 June 2027; 26 October - 15 November 2027 (section 1.5). Using the school calendar for the
  hostels is (A). `calendar-geography.md` section 4 moves C03, C04, C10 and S2 to the college calendar
  (summer vacation 27 April - 14 June, the same Diwali vacation, plus exam-week factors) and keeps the
  school calendar for C09 only; the factors (0.30, 0.70, no orders) do not change. Every figure in this
  file uses the school calendar for all five; that file's section 12 gives the difference.
- **Caterer season factor** by month (weddings; lean in the monsoon and chaturmas): Jan 1.3, Feb 1.3,
  Mar 0.9, Apr 1.1, May 1.2, Jun 0.9, Jul 0.7, Aug 0.7, Sep 0.7, Oct 0.8, Nov 1.2, Dec 1.4. The twelve
  average 1.02. `calendar-geography.md` section 5 replaces this month table by dated wedding windows
  from the panchang (2026 has no wedding dates in January; 2027 has far more dates than 2026). The
  figures in this file use the month table.
- A factor multiplies every line; each line is then rounded to a whole pack (stochastic round).
  Noise on corporate orders: uniform 0.95-1.05 per order.
- The month factors of section 6.5 do **not** apply to corporates.
- The week average of Rs 25,463 a day counts order frequency only, with every factor at 1.00 (as in
  section 9.1); with the hotel's weekend factor it is Rs 25,618.
- The order is placed the day before and delivered with an invoice on the delivery day.
- Orders in 2026 under these rules: C01 and C02 313 each; C03, C04, C05, C08 365 each; C06 157; C07 52;
  C09 265; C10 183. About 2,740 corporate invoices a year.
- With GST the typical orders come to: C01 Rs 5,542.50; C02 Rs 3,460.50; C03 Rs 3,010.90; C04
  Rs 1,845.00; C05 Rs 2,413.85; C06 Rs 5,160.00; C07 Rs 5,874.00; C08 Rs 2,737.00; C09 Rs 3,272.25;
  C10 Rs 4,419.00. C06 and C07 buy only Nil-rated lines, so they receive a bill of supply; the others
  receive an invoice-cum-bill of supply.
- Credit terms and limits are the customer master's. For sizing a limit: a 30-day month of C01 (about
  26 orders) is about Rs 1.41 lakh before GST at the opening list and Rs 1.47 lakh after revision 1.

---

## 8. Own stores (3) (A)

### 8.1 Units sold per normal day

| Key | Item | S1 Anand town | S2 Vallabh Vidyanagar | S3 Nadiad | All three |
|---|---|---|---|---|---|
| SB | Sandwich bread | 40 | 22 | 20 | 82 |
| BB | Brown bread | 14 | 8 | 6 | 28 |
| JL | Jumbo sandwich loaf | 4 | 2 | 2 | 8 |
| LP | Ladi pav | 30 | 16 | 16 | 62 |
| BNP | Burger bun, plain | 10 | 10 | 5 | 25 |
| BNS | Burger bun, sesame | 6 | 8 | 2 | 16 |
| BNW | Burger bun, whole wheat | 4 | 4 | 2 | 10 |
| BNJ | Burger bun, jumbo | 3 | 4 | 1 | 8 |
| PZ | Pizza base | 14 | 12 | 6 | 32 |
| TE | Elaichi toast | 14 | 6 | 8 | 28 |
| TM | Milk toast | 8 | 3 | 4 | 15 |
| KB | Butter khari | 12 | 6 | 6 | 24 |
| KJ | Jeera khari | 8 | 4 | 4 | 16 |
| JB | Jeera biscuit | 8 | 4 | 4 | 16 |
| TC | Tea cake | 12 | 12 | 5 | 29 |
| PV | Veg puff | 120 | 130 | 60 | 310 |
| PP | Paneer puff | 45 | 50 | 20 | 115 |
| PG | Garlic puff | 40 | 50 | 15 | 105 |
| | **Sales at MRP, GST included** | Rs 14,860 | Rs 11,710 | Rs 7,095 | Rs 33,665 |
| | **Sales before GST** (opening list) | **Rs 14,420** | **Rs 11,336** | **Rs 6,885** | **Rs 32,641** |
| | 2026 total, before GST | Rs 55.58 lakh | Rs 39.16 lakh | Rs 26.17 lakh | Rs 120.92 lakh |

Character: S1 is the family store - bread, pav and dry bakery lead. S2 is the student store - puffs are
45% of its sales, buns, pizza base and tea cake are strong, bread is weak, and it falls in vacations.
S3 is a small town-centre counter.

### 8.2 Day factors

`units sold = stochastic round( normal-day units x day-of-week factor x month factor x vacation factor x noise )`

| Store | Mon-Fri | Sat | Sun | Vacation factor |
|---|---|---|---|---|
| S1 Anand town | 1.00 | 1.10 | 1.20 | 1.00 |
| S2 Vallabh Vidyanagar | 1.00 | 1.00 | 0.85 | 0.70 in the vacations of section 7 |
| S3 Nadiad | 1.00 | 1.05 | 1.15 | 1.00 |

Month factors as in section 6.5. Noise uniform 0.90-1.10 per store-item-day.
Payment mix for the day-end entry (A): UPI 60%, cash 40% (S2: UPI 75%, cash 25%).

### 8.3 Unsold and expired stock at the stores

Expired units per day, as a share of the units sold that day; they become the day-end's write-off request
and are valued at recipe cost.

| Lines | Rate |
|---|---|
| Sandwich bread | 3% |
| Ladi pav; burger bun, plain | 4% |
| Brown bread; burger bun, sesame | 5% |
| Jumbo sandwich loaf; burger bun, whole wheat; burger bun, jumbo | 6% |
| Pizza base | 3% |
| Tea cake | 2% |
| Elaichi toast, milk toast, jeera biscuit | 0.2% |
| Butter khari, jeera khari | 0.3% (breakage) |
| Veg puff | 6% |
| Paneer puff, garlic puff | 8% |

On a normal day that is about 19 units at S1, 20 at S2 and 9 at S3 - 3.8% to 4.8% of the store's sales
at MRP - nearly all of it puffs and the slow bread lines.

Only the puffs reach their printed best-before on the shelf. With the par stocks of 8.4 a loaf or a
pack of buns leaves the shelf within two days of baking (pizza base three), inside its 3 to 5 days. On
items 1-9 and tea cake the "expired" units are therefore the store's unsaleable leftovers (dried,
squashed, or with a day of life left), taken from the oldest batch on the shelf (A). Whether the
day-end entry may write off a batch that is not yet past its best-before date, or the par stocks should
be longer so that the rates arise by date, is left to the reconciliation step.

### 8.4 Transfers from the factory to a store

- **Puffs**: sent every morning; `units sent = round( expected sale of the day x (1 + expiry rate) )`.
  What is not sold by closing expires that day.
- **Fresh lines** (items 1-9) and tea cake: sent every morning to bring the store back to a par stock of
  1.5 normal days of sale (pizza base 2 days, tea cake 4 days); so each morning's transfer equals the
  previous day's sale plus the previous day's expired units.
- **Long-life lines** (toast, khari, jeera biscuit): topped up on Monday and Thursday to a par of 7
  normal days of sale.
- The store sells the oldest unexpired batch first.

---

## 9. Resulting sales

### 9.1 A normal day (all factors 1.00), opening price list, before GST

| Channel | Gross | Stale returns | Net | Share |
|---|---|---|---|---|
| Retail outlets (40) | Rs 52,561 | Rs 1,917 | **Rs 50,644** | 46.6% |
| Corporates (10), week average | Rs 25,463 | - | **Rs 25,463** | 23.4% |
| Own stores (3) | Rs 32,641 | - | **Rs 32,641** | 30.0% |
| **Total** | Rs 1,10,665 | Rs 1,917 | **Rs 1,08,748** | 100% |

Units and value by item (retail at retailer price, corporates at corporate price, stores at MRP before
GST; corporate units are the weekly average per day):

| Item | Retail units | Corporate units | Store units | Total units | Retail Rs | Corporate Rs | Store Rs | Total Rs | Share |
|---|---|---|---|---|---|---|---|---|---|
| Sandwich bread 400 g | 383 | 23 | 82 | 488 | 13,788 | 787 | 3,690 | 18,265 | 16.5% |
| Brown bread 400 g | 94 | 22 | 28 | 144 | 4,136 | 924 | 1,540 | 6,600 | 6.0% |
| Jumbo sandwich loaf 800 g | 0 | 126 | 8 | 134 | 0 | 7,577 | 640 | 8,217 | 7.4% |
| Ladi pav 12 pieces | 306 | 143 | 62 | 511 | 9,792 | 4,303 | 2,480 | 16,575 | 15.0% |
| Burger bun, plain | 122 | 22 | 25 | 169 | 3,904 | 669 | 1,000 | 5,573 | 5.0% |
| Burger bun, sesame | 16 | 20 | 16 | 52 | 576 | 680 | 720 | 1,976 | 1.8% |
| Burger bun, whole wheat | 10 | 6 | 10 | 26 | 400 | 228 | 500 | 1,128 | 1.0% |
| Burger bun, jumbo | 0 | 60 | 8 | 68 | 0 | 2,713 | 480 | 3,193 | 2.9% |
| Pizza base | 87 | 41 | 32 | 160 | 2,436 | 1,073 | 1,120 | 4,629 | 4.2% |
| Elaichi toast 250 g | 108 | 10 | 28 | 146 | 4,860 | 430 | 1,600 | 6,890 | 6.2% |
| Milk toast 400 g | 33 | 9 | 15 | 57 | 2,244 | 585 | 1,286 | 4,115 | 3.7% |
| Butter khari 200 g | 79 | 0 | 24 | 103 | 4,187 | 0 | 1,600 | 5,787 | 5.2% |
| Jeera khari 200 g | 37 | 0 | 16 | 53 | 1,813 | 0 | 990 | 2,803 | 2.5% |
| Jeera biscuit 250 g | 30 | 4 | 16 | 50 | 2,040 | 260 | 1,371 | 3,671 | 3.3% |
| Tea cake 200 g | 45 | 17 | 29 | 91 | 2,385 | 829 | 1,933 | 5,147 | 4.7% |
| Veg puff | 0 | 214 | 310 | 524 | 0 | 3,107 | 5,905 | 9,012 | 8.1% |
| Paneer puff | 0 | 26 | 115 | 141 | 0 | 566 | 3,286 | 3,851 | 3.5% |
| Garlic puff | 0 | 41 | 105 | 146 | 0 | 733 | 2,500 | 3,233 | 2.9% |
| **Total** | | | | | **52,561** | **25,463** | **32,641** | **1,10,665** | 100% |

The nine Nil-rated lines are 59.8% of sales value; the nine 5% lines 40.2%. Production needed to cover
these sales is about 845 kg of finished goods a day at the pack weights of section 2 (about Rs 131 a kg
before GST), plus returns, store expiry and rejects. (At the 360 g pav, 320 g jumbo bun and 80 g puff
first assumed here the figure was 830 kg, which is what `people-overheads.md` 4.3 quotes.)

### 9.2 Month by month under the rules (expected values, Rs lakh before GST)

Day-of-week, month, vacation and caterer factors, the two price revisions and the stale-return rules
applied to every day; noise averages out. Event-calendar closures are not included. Stale returns are
shown in the month of the dispatch they belong to; with the credit-note lags of 6.6 nothing is credited
against supply from before go-live, so the generator's January 2026 returns come out about Rs 0.08 lakh
lower and no later month moves by more than Rs 0.03 lakh.

| Month | Retail gross | Stale returns | Retail net | Corporates | Own stores | Total net | Per day, Rs |
|---|---|---|---|---|---|---|---|
| 2026-01 | 16.93 | 0.62 | 16.32 | 8.39 | 10.61 | 35.31 | 1,13,919 |
| 2026-02 | 15.13 | 0.55 | 14.58 | 7.43 | 9.49 | 31.50 | 1,12,483 |
| 2026-03 | 16.41 | 0.60 | 15.81 | 7.72 | 10.30 | 33.84 | 1,09,146 |
| 2026-04 | 15.25 | 0.56 | 14.69 | 7.80 | 9.55 | 32.05 | 1,06,823 |
| 2026-05 | 15.13 | 0.55 | 14.57 | 6.23 | 8.64 | 29.44 | 94,957 |
| 2026-06 | 15.41 | 0.56 | 14.85 | 7.15 | 9.43 | 31.43 | 1,04,758 |
| 2026-07 | 17.62 | 0.82 | 16.81 | 8.03 | 10.82 | 35.66 | 1,15,044 |
| 2026-08 | 17.83 | 0.82 | 17.00 | 7.92 | 10.97 | 35.89 | 1,15,789 |
| 2026-09 | 16.89 | 0.78 | 16.11 | 7.76 | 10.38 | 34.25 | 1,14,167 |
| 2026-10 | 17.14 | 0.63 | 16.51 | 8.19 | 10.52 | 35.22 | 1,13,606 |
| 2026-11 | 16.23 | 0.60 | 15.63 | 6.58 | 9.29 | 31.51 | 1,05,019 |
| 2026-12 | 17.80 | 0.66 | 17.14 | 8.79 | 10.93 | 36.85 | 1,18,868 |
| **2026** | **197.77** | **7.75** | **190.02** | **92.00** | **120.92** | **402.94** | **1,10,394** |
| 2027-01 | 17.66 | 0.65 | 17.00 | 8.54 | 10.86 | 36.40 | 1,17,423 |
| 2027-02 | 15.78 | 0.58 | 15.19 | 7.77 | 9.69 | 32.65 | 1,16,616 |
| 2027-03 | 17.11 | 0.63 | 16.48 | 8.23 | 10.51 | 35.21 | 1,13,588 |
| 2027-04 | 16.26 | 0.59 | 15.66 | 8.39 | 10.23 | 34.28 | 1,14,271 |
| 2027-05 | 16.12 | 0.59 | 15.54 | 6.44 | 9.21 | 31.19 | 1,00,616 |
| 2027-06 | 16.42 | 0.60 | 15.83 | 7.70 | 10.13 | 33.66 | 1,12,185 |
| 2027-07 | 18.05 | 0.82 | 17.23 | 8.30 | 11.36 | 36.89 | 1,18,996 |
| 2027-08 | 18.19 | 0.83 | 17.37 | 8.04 | 11.47 | 36.88 | 1,18,968 |
| 2027-09 | 17.27 | 0.78 | 16.49 | 7.93 | 10.87 | 35.29 | 1,17,631 |
| 2027-10 | 17.52 | 0.64 | 16.89 | 7.82 | 10.84 | 35.54 | 1,14,638 |
| 2027-11 | 16.59 | 0.60 | 15.99 | 7.34 | 9.92 | 33.24 | 1,10,813 |
| 2027-12 | 18.19 | 0.66 | 17.53 | 8.93 | 11.45 | 37.91 | 1,22,277 |
| **2027** | **205.17** | **7.98** | **197.19** | **95.42** | **126.53** | **419.14** | **1,14,833** |

### 9.3 Yearly totals

| | 2026 | 2027 |
|---|---|---|
| Retail outlets, net of returns | Rs 1.90 crore (47.2%) - Rs 52,062 a day | Rs 1.97 crore (47.0%) - Rs 54,025 a day |
| Corporates | Rs 0.92 crore (22.8%) - Rs 25,204 a day | Rs 0.95 crore (22.8%) - Rs 26,142 a day |
| Own stores | Rs 1.21 crore (30.0%) - Rs 33,128 a day | Rs 1.27 crore (30.2%) - Rs 34,666 a day |
| **Sales before GST, net of credit notes** | **Rs 4.03 crore - Rs 1,10,394 a day** | **Rs 4.19 crore - Rs 1,14,833 a day** |

- 1 January to 1 October 2026 (the history of a copy first opened on 2 October 2026, 274 days):
  **Rs 3.00 crore**.
- 2027 is 4.0% above 2026: price only (revision 1 for a full year, revision 2 from April).
- The event calendar of `calendar-geography.md` (three closed days at Diwali 2026 and two in 2027, thin
  festival days, plant holidays, the college calendar, heavy-rain days) takes about 2.0% off 2026 and
  1.5% off 2027 (its section 12), leaving about Rs 3.95 crore and Rs 4.13 crore. The scope's "about
  Rs 4 crore, about Rs 1.1 lakh a day" holds either way.
- Lowest month May (school vacation, heat, hostels and school canteen away); highest December (winter,
  wedding catering).

---

## 10. Notes for the generator and the integrator

1. Every table above is an expected value. The generator draws noise from its seeded stream, so its
   totals should land within about 1% of section 9 over a month. Calibrate by changing a parameter here,
   never by patching an output.
2. All rules are functions of the date alone (weekday, month, the four vacation ranges, the two revision
   dates, the day count from 1 January 2026), so the seed for one business date is the beginning of the
   seed for a later one.
3. Production must make, each day, tomorrow's dispatch + store transfers + corporate orders, plus
   expected rejects. On a normal day that is about: SB 490, BB 145, JL 135, LP 510, BNP 170, BNS 52,
   BNW 26, BNJ 68, PZ 160 packs; TE 146, TM 57, KB 103, KJ 53, JB 50, TC 91 packs (the long-life lines
   may be made in larger runs every few days); PV 545, PP 150, PG 155 pieces including the store
   expiry allowance. Recipe batch sizes should be checked against these volumes: `recipes-yields.md`
   section 4 still plans on the brief's rough volumes (sandwich bread 900, ladi pav 700, 500 puffs a
   day; about 815 kg of flour a day), while the volumes above need about 570 kg of flour a day with the
   same recipes. The volumes here are the demand model's; only the mixes per day or per run change
   there (its section 9, point 4). Whole wheat bun demand (26 packs a day) is below that file's minimum
   of half a mix (38 packs), so that line is baked on some days only or carries a surplus.
4. The pack net weights in section 2 marked (A) - ladi pav 400 g, buns 200 g and 300 g, pizza base
   200 g, a puff about 70 g - are those of `recipes-yields.md` (its sections 3.1 and 9, point 6); if
   the recipes change, their figures replace these and nothing else here changes.
5. Left to other topics: customer names, credit days and limits, cash-on-delivery against weekly-credit
   outlets, the event calendar (festival closures, one-off spikes), opening stock, recipes and costs.
6. Margin sanity for the costing topic: realisation before GST is Rs 90 a kg on sandwich bread at the
   retailer price (Rs 36 for 400 g), Rs 75 a kg on the jumbo loaf to corporates (Rs 60 for 800 g),
   Rs 180 a kg on elaichi toast and Rs 265 a kg on butter khari.
