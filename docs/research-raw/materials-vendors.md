# Material prices, purchasing and vendors

Research raw for `docs/RESEARCH.md`. Written on 2 October 2026 against `docs/SCOPE.md` v0.3 and
`recipes-yields.md` (material codes, stock units, recipes, daily use in its section 7.2). Happy Bakers
is fictional; every figure is a parameter for the day-by-day simulation, not a record of a real
business. All rupee prices are **before GST, per stock unit, delivered to the factory**.

Marks: **(A)** = assumption, the public record is silent. **(L)** = seen in a search listing only, the
page was not opened (blocked or not fetched). Everything else was opened on 2 October 2026; sources are
numbered in section 13.

Reviewed on 2 October 2026: the sugar, edible-oil, milk, flour, fats, butter, paneer, peas, yeast,
mandi and GST pages were re-opened; every table was recomputed from the block in section 12 (prices,
the rule of section 4, order values, the monthly basket, product costs, GSTIN check characters); the
purchasing rules were re-run day by day for two years; every invented vendor name was searched and
seven were replaced. What that changed is in the text; what it left open is in section 14.

Nothing here is a list that stops in October 2026: prices for January-October 2026 are a table, and
from November 2026 to December 2027 they follow the rule of section 4. Every purchasing parameter is a
rule on stock levels and dates.

## 0. Headlines

- 32 materials, 13 material vendors, 24 expense vendors (10 core, 14 minor).
- A normal 30-day month buys **Rs 12.9 lakh of materials before GST at January 2026 prices and
  Rs 14.1 lakh at October 2026 prices**, plus Rs 45,000-49,000 of input GST. Flour is 47%, fats and
  oil 25-26%, packing 8.5%.
- **Material cost comes to about 41-44% of sales, not 45-55%** (section 10). The prices are at the
  upper middle of what was found; reaching 50% would need purchase prices about 15% above any source.
  This is the main point for the reconciliation step.
- Three real price events of 2026 are in the table: the sugar spike of July-September, the edible-oil
  rise that ended in the customs-duty cut of 24 September, and the milk price rise of 14 May.
- About 90 purchase orders a month; the flour order (Rs 70,000-81,400 over the two years) is the one
  routine order above the Owner's Rs 50,000 limit, 8 times a month.

## 1. Purchase master: pack, tax, vendor

Stock unit is that of `recipes-yields.md`. "Order multiple" is the smallest quantity a purchase order
line may carry; order quantities are whole multiples of it. HSN is the 4-digit heading, which is all a
bill needs at this turnover. GST rates are those in force since 22 September 2025, so each material has
one rate for the whole period.

| Code | Material | Stock unit | Purchase pack | Order multiple | HSN | GST | Vendor |
|---|---|---|---|---|---|---|---|
| RM01 | Maida (bakery flour) | kg | 50 kg bag | 50 kg | 1101 | Nil | VM01 |
| RM02 | Whole wheat atta | kg | 50 kg bag | 50 kg | 1101 | Nil | VM02 |
| RM03 | Sugar | kg | 50 kg bag | 50 kg | 1701 | 5% | VM03 |
| RM04 | Bakery shortening | kg | 15 kg box | 15 kg | 1517 | 5% | VM04 |
| RM05 | Puff margarine | kg | 15 kg carton | 15 kg | 1517 | 5% | VM04 |
| RM06 | Butter (white, unsalted) | kg | 15 kg carton | 15 kg | 0405 | 5% | VM06 |
| RM07 | Refined oil (cottonseed) | litre | 15 litre tin | 15 litres | 1512 | 5% | VM05 |
| RM08 | Yeast, compressed | kg | carton of 20 x 500 g | 10 kg | 2102 | 5% | VM07 |
| RM09 | Salt | kg | 25 kg bag | 25 kg | 2501 | Nil (A) | VM03 |
| RM10 | Skimmed milk powder | kg | 25 kg bag | 25 kg | 0402 | 5% | VM06 |
| RM11 | Bread improver | kg | 5 kg pack | 5 kg | 2106 | 5% | VM07 |
| RM12 | Calcium propionate | kg | 5 kg pack | 5 kg | 2915 | 18% | VM07 |
| RM13 | Baking powder | kg | 5 kg pack | 5 kg | 2102 | 5% | VM07 |
| RM14 | Cardamom powder | kg | 1 kg pack | 1 kg | 0908 | 5% | VM08 |
| RM15 | Cumin seed | kg | 5 kg pack | 5 kg | 0909 | 5% | VM08 |
| RM16 | Sesame seed, white | kg | 5 kg pack | 5 kg | 1207 | 5% | VM08 |
| RM17 | Tutti-frutti | kg | 5 kg pack | 5 kg | 2006 | 5% | VM07 |
| RM18 | Flavour essence | litre | 500 ml bottle | 0.5 litre | 3302 | 18% | VM07 |
| RM19 | Potato | kg | 50 kg bag | 50 kg | 0701 | Nil (A) | VM09 |
| RM20 | Onion | kg | loose, from a 50 kg bag | 10 kg | 0703 | Nil (A) | VM09 |
| RM21 | Green peas, frozen | kg | 1 kg pack | 1 kg | 0710 | 5% | VM10 |
| RM22 | Paneer | kg | 1 kg vacuum-packed block | 1 kg | 0406 | Nil | VM11 |
| RM23 | Garlic, peeled | kg | 1 kg pack | 1 kg | 0703 | Nil (A) | VM09 |
| RM24 | Puff masala | kg | 1 kg pack | 1 kg | 0910 | 5% | VM08 |
| PM01 | Bread bag, 400 g loaf | piece | bundle of 1,000 | 1,000 | 3923 | 18% | VM12 |
| PM02 | Bread bag, 800 g loaf | piece | bundle of 1,000 | 1,000 | 3923 | 18% | VM12 |
| PM03 | Pav / bun bag | piece | bundle of 1,000 | 1,000 | 3923 | 18% | VM12 |
| PM04 | Pouch, small | piece | bundle of 500 | 500 | 3923 | 18% | VM12 |
| PM05 | Pouch, large | piece | bundle of 500 | 500 | 3923 | 18% | VM12 |
| PM06 | Cake pack | piece | carton of 500 | 500 | 4819 | 5% | VM13 |
| PM07 | Puff paper | piece | packet of 1,000 | 1,000 | 4806 | 18% | VM13 |
| PM08 | Date label | piece | roll of 1,000 | 1,000 | 4821 | 18% | VM13 |

Tax notes.

- **Flour is Nil because the bag is 50 kg.** The 5% on flour applies only to "pre-packaged and
  labelled" packs, and a package of more than 25 kg is outside that definition [22]; heading 1101
  itself is at 0% [21]. A 10 kg or 25 kg bag of the same maida would carry 5%.
- The September 2025 changes that matter here: butter 12% to 5%; yeast and baking powder 12% to 5%;
  margarine and food preparations (the improver) to 5%; candied fruit 12% to 5%; paper cartons and
  boxes 12% to 5%; pre-packaged paneer 5% to Nil; **greaseproof paper 12% up to 18%** [19]. Sugar,
  edible oil, milk powder, spices and sesame are 5%; plastic bags and pouches, calcium propionate and
  flavouring essences 18% [20]. Paper labels 18% [21]. Frozen vegetables in a labelled pack 5% [21].
- Salt, potato, onion and garlic do not appear on the lists opened; they are long-standing exempt
  goods and are taken as Nil (A).
- Classification choices (A): the improver under 2106 (a food preparation), not 3507 (enzymes, 18%);
  the cake pack - a paper mould in a printed sleeve - as one item under 4819; peeled garlic as fresh
  garlic.
- All vendors are in Gujarat, so every purchase bill carries CGST + SGST in equal halves, never IGST.
  A bill line's GST is computed on the line and treated as input credit (scope 4.2).

## 2. Prices, January to October 2026

Rs per stock unit, before GST. One price a month; the rate on a purchase order is the price of the
month of the order date (section 6). **The January column is also the opening rate on 1 January 2026.**

| Code | Jan | Feb | Mar | Apr | May | Jun | Jul | Aug | Sep | Oct |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| RM01 Maida | 36.00 | 36.00 | 35.60 | 35.00 | 35.60 | 36.60 | 37.40 | 38.20 | 38.80 | 39.00 |
| RM02 Atta | 33.50 | 33.50 | 33.10 | 32.50 | 33.10 | 34.10 | 34.90 | 35.70 | 36.30 | 36.50 |
| RM03 Sugar | 40.20 | 41.20 | 41.40 | 41.50 | 42.70 | 42.30 | 46.80 | 56.40 | 51.90 | 47.40 |
| RM04 Shortening | 150 | 151 | 153 | 155 | 158 | 160 | 163 | 166 | 170 | 168 |
| RM05 Puff margarine | 164 | 165 | 167 | 169 | 172 | 175 | 178 | 182 | 186 | 184 |
| RM06 Butter | 455 | 455 | 460 | 465 | 472 | 480 | 480 | 478 | 476 | 474 |
| RM07 Oil (litre) | 142 | 144 | 146 | 147 | 149 | 151 | 154 | 158 | 164 | 161 |
| RM08 Yeast | 118 | 118 | 118 | 118 | 118 | 118 | 122 | 122 | 122 | 122 |
| RM09 Salt | 9.00 | 9.00 | 9.00 | 9.00 | 9.00 | 9.00 | 9.40 | 9.40 | 9.40 | 9.40 |
| RM10 Milk powder | 265 | 265 | 268 | 272 | 276 | 280 | 280 | 278 | 275 | 272 |
| RM11 Improver | 210 | 210 | 210 | 210 | 210 | 210 | 216 | 216 | 216 | 216 |
| RM12 Calcium propionate | 150 | 150 | 150 | 150 | 150 | 150 | 155 | 155 | 155 | 155 |
| RM13 Baking powder | 75 | 75 | 75 | 75 | 75 | 75 | 75 | 75 | 75 | 75 |
| RM14 Cardamom powder | 2,550 | 2,550 | 2,600 | 2,650 | 2,700 | 2,750 | 2,800 | 2,800 | 2,750 | 2,700 |
| RM15 Cumin | 215 | 212 | 205 | 205 | 208 | 212 | 216 | 220 | 222 | 222 |
| RM16 Sesame | 155 | 155 | 155 | 155 | 155 | 155 | 160 | 160 | 160 | 160 |
| RM17 Tutti-frutti | 92 | 92 | 92 | 92 | 92 | 92 | 94 | 98 | 102 | 100 |
| RM18 Essence (litre) | 520 | 520 | 520 | 520 | 520 | 520 | 520 | 520 | 520 | 520 |
| RM19 Potato | 13.00 | 11.00 | 10.50 | 11.50 | 12.50 | 13.50 | 14.50 | 15.00 | 15.50 | 16.50 |
| RM20 Onion | 20.00 | 18.00 | 16.00 | 15.00 | 16.00 | 19.00 | 24.00 | 32.00 | 44.00 | 46.00 |
| RM21 Peas, frozen | 84 | 82 | 80 | 80 | 82 | 84 | 86 | 88 | 90 | 90 |
| RM22 Paneer | 330 | 330 | 335 | 340 | 348 | 355 | 355 | 352 | 350 | 348 |
| RM23 Garlic, peeled | 160 | 150 | 135 | 125 | 125 | 130 | 138 | 145 | 150 | 155 |
| RM24 Puff masala | 360 | 360 | 360 | 360 | 360 | 360 | 370 | 370 | 370 | 370 |
| PM01 Bread bag 400 g | 1.00 | 1.00 | 1.00 | 1.00 | 1.05 | 1.05 | 1.10 | 1.10 | 1.10 | 1.10 |
| PM02 Bread bag 800 g | 1.60 | 1.60 | 1.60 | 1.60 | 1.68 | 1.68 | 1.76 | 1.76 | 1.76 | 1.76 |
| PM03 Pav / bun bag | 0.55 | 0.55 | 0.55 | 0.55 | 0.58 | 0.58 | 0.60 | 0.60 | 0.60 | 0.60 |
| PM04 Pouch, small | 2.00 | 2.00 | 2.00 | 2.00 | 2.10 | 2.10 | 2.18 | 2.18 | 2.18 | 2.18 |
| PM05 Pouch, large | 2.70 | 2.70 | 2.70 | 2.70 | 2.84 | 2.84 | 2.94 | 2.94 | 2.94 | 2.94 |
| PM06 Cake pack | 6.80 | 6.80 | 6.80 | 6.80 | 6.80 | 6.80 | 7.10 | 7.10 | 7.10 | 7.10 |
| PM07 Puff paper | 0.18 | 0.18 | 0.18 | 0.18 | 0.18 | 0.18 | 0.19 | 0.19 | 0.19 | 0.19 |
| PM08 Date label | 0.24 | 0.24 | 0.24 | 0.24 | 0.24 | 0.24 | 0.25 | 0.25 | 0.25 | 0.25 |

### 2.1 Where each price comes from

"Anchor" is what a source showed, nearly always in September-October 2026. Unless a monthly source is
named, the earlier months are (A): the anchor carried back along the trend of the nearest researched
commodity. Online wholesale listings do not say whether tax is included; they are read as including
GST (A), so the before-GST price is the listing divided by 1.05 or 1.18.

| Code | Anchor | Source | How the Happy Bakers price was set |
|---|---|---|---|
| RM01 | Ahmedabad, 1 Oct 2026: maida in 50 kg bags Rs 34-37 a kg, bags at Rs 1,730-2,000 (Rs 34.60-40.00 a kg). A wholesale app: bakery maida Rs 1,840 a bag (Rs 36.80; Rs 35.80 above 250 kg). Scope: Rs 36-42 | [6] [7] | Rs 39.00 in October: a strong bakery grade delivered on 15 days' credit, the middle of the scope's range. Back to Rs 36.00 in January with a dip at the March-April wheat harvest (A): milling wheat averaged Rs 2,244 a quintal across India on 1 April (L) [9]; on 25 September wheat was Rs 2,730 in Gujarat mandis and Rs 2,627 across India (L) [8] |
| RM02 | Chakki atta, 50 kg bag, Rs 1,825 (Rs 36.50 a kg) | [6] | Rs 36.50 in October; Rs 2.50 below maida throughout (A) |
| RM03 | Gujarat ex-mill M/30, Rs a quintal before GST: 19 Jan 3,751-3,791; 16 Feb 3,841-3,901; 16 Mar 3,871-3,900; 15 Apr 3,881-3,921; 5 May 4,011-4,031; 11 Jun 3,961-4,001; 8 Jul 4,271-4,291; 30 Jul 4,521-4,620; 7 Aug 4,671-4,790; 18 Aug 5,081-5,200; 22 Aug 6,231-6,350; 3 Sep 5,384-5,504; 30 Sep 4,421-4,461; 1 Oct 4,471-4,511 | [1] | Month price = average of the mid-points read in that month, per kg, **plus Rs 2.50** for the trader's margin, freight and handling (A). Every month is sourced; all 14 readings were re-opened in review and match. Cross-check: the scope quotes Rs 51-57 a kg wholesale, which is the all-India mandi average (Rs 57.13 on 1 October, range Rs 51-66); the October price here is Rs 49.80 with GST, a little below it, because Gujarat mills sell below the national mandi average (section 14, point 11) |
| RM04 | Bakery fats in 15 kg packs: Rs 2,547 (Rs 170 a kg) and Rs 2,583 (Rs 172) at the cheap end; vanaspati, 15 kg tin, Ahmedabad Rs 2,727 (Rs 182). The page lists seven bakery fats at Rs 170-204 a kg and does not say which are shortening and which lamination margarine; reading the two cheapest as shortening is (A) | [10] [11] | Rs 168 in October (Rs 176 with GST). January is 11% lower: vegetable oils rose nearly 20% in a year [3] and the Rajkot cottonseed tin rose 13% from March to 11 September [4] |
| RM05 | Dearer bakery fats on the same page, read as puff / lamination margarine (A), 15 kg: Rs 2,646 (Rs 176 a kg) to Rs 2,930 (Rs 195) | [11] | Rs 184 in October (Rs 193 with GST); same trend as shortening |
| RM06 | White butter, Ahmedabad listings, October 2026: most at Rs 370-500 a kg, the commonest Rs 430 (whole range Rs 250-800); a 20 kg bulk pack Rs 9,548, Rs 477 a kg (L). Retail blocks cost far more: 500 g Rs 290, a 10 kg pack Rs 6,300 | [12] | Rs 474 in October (Rs 498 with GST), the top of the bulk range. Lower in the winter flush, a step after the milk price rise of 14 May [13] |
| RM07 | Rajkot, cottonseed oil, 15 kg tin: Rs 2,520-2,540 in March (L); Rs 2,670 on 15 July; Rs 2,780 on 4 September; Rs 2,850 on 11 September | [4] | Tin price / 15 / 1.05 x 0.91 = Rs per litre before GST: 146 (March), 154 (July), 165 (11 September). October eases 2% after the duty cut (A) |
| RM08 | Carton of 20 x 500 g (10 kg): Rs 1,250, Rs 125 a kg (the page shows the same amount with and without tax; with 5% GST inside it is Rs 119); a 500 g block Rs 57.75 at a wholesale app (L) | [14] | Rs 118, an agent's rate to a regular buyer (A); Rs 122 from the maker's 1 July list (A) |
| RM09 | Free-flow iodised salt at the works, Gujarat: Rs 3.40-5.50 a kg; Rs 7.80 in 25 kg bags | [18] | Rs 9.00 delivered in small lots (A); Rs 9.40 from July, freight after the May diesel rise (A) |
| RM10 | 25 kg bags: Rs 200-300 a kg, Ahmedabad Rs 245 | [18] | Rs 272 in October for a branded powder (A); follows the dairy shape |
| RM11 | Rs 160-220 a kg in bulk, Rs 280-315 in 1 kg packs; Surat Rs 160-180 | [18] | Rs 210 in 5 kg packs (A) |
| RM12 | Food grade, 20-25 kg: Rs 105-175 a kg; Ahmedabad Rs 105-170 | [18] | Rs 150 repacked in 5 kg (A) |
| RM13 | Rs 48-53 a kg in 25-50 kg bags (Ahmedabad, Kalol); Rs 68-100 in small packs | [18] | Rs 75 in 5 kg packs (A) |
| RM14 | Whole cardamom at auction, 1 Oct 2026: Rs 2,700 a kg (5-6 mm) to Rs 4,300 (8 mm+), average Rs 3,335 | [15] | Rs 2,700 in October: bakery powder is ground from the small grade (A). Monthly shape (A) |
| RM15 | Gujarat mandi average Rs 192.95 a kg on 25 Sep 2026 (range Rs 123-214.50) | [15] | Mandi + 15% for cleaning, packing and the merchant (A) = Rs 222; a dip at the March-April harvest (A) |
| RM16 | Natural and hulled white sesame Rs 112-190 a kg; Rajkot Rs 150; hulled Rs 170-190 | [18] | Rs 160 (A) |
| RM17 | Rs 60-150 a kg; Ahmedabad Rs 90 | [18] | Rs 92; Rs 100 from September - it is two-thirds sugar (A) |
| RM18 | Bakery essence, 500 ml bottle: Rs 120-300 (Rs 240-600 a litre); Rajkot Rs 250 a bottle | [18] | Rs 520 a litre (A) |
| RM19 | Gujarat mandi average Rs 11.92 a kg on 25 Sep 2026; Ahmedabad Rs 7.75-12.50 | [15] | Mandi + about Rs 3.50 delivered (A) = Rs 15.50 in September. Monthly shape (A): cheapest at the February-March harvest, dearest in October-November out of cold storage |
| RM20 | Gujarat mandi average Rs 39.55 a kg on 25 Sep 2026; Ahmedabad Rs 44.50 | [15] | Rs 44.00 in September. Earlier months (A), a normal year's shape; the September level is a real spike (section 3) |
| RM21 | Ahmedabad, 1 kg pack: Rs 95-99. Elsewhere Rs 55-80 in bulk, Rs 70-125 in small packs | [16] [18] | Rs 90 before GST in October; a mild seasonal shape (A) |
| RM22 | Ahmedabad, branded 1 kg: Rs 345-392 at re-check (the listings and their discounts change; Rs 336 was seen earlier). Paneer is Nil-rated, so the listing is the price before GST | [16] | Rs 348 from a local dairy (A); dairy shape and the May step |
| RM23 | Whole garlic, Gujarat mandi average Rs 97.33 a kg on 25 Sep 2026; peeled garlic listings Rs 60-220 | [15] [18] | Whole / 0.85 + Rs 35 for peeling and delivery (A) = Rs 150 in September; cheapest at the March-April harvest (A) |
| RM24 | none found | - | Rs 360 (A): a blend of chilli, turmeric, coriander and dry mango powders |
| PM01 | Printed polypropylene bread pouch, 25 micron, Rs 245 a kg; about 250 bags a kg | `recipes-yields.md` source 14 (not re-opened) | Rs 0.98 a bag at the listing; Rs 1.00 to Rs 1.10 across 2026 (A) |
| PM02 | same film, about 6.5 g a bag | (A) | 1.6 x PM01 |
| PM03 | Plain bags and printed film Rs 130-265 a kg | [17] | About 3.3 g of clear film at Rs 170-180 a kg (A) |
| PM04, PM05 | Printed laminated pouches Rs 130-265 a kg, Rs 0.40-2 apiece for small sizes | [17] | 8 g and 11 g at about Rs 265 a kg (A) |
| PM06 | Small cake boxes Rs 4.50-11.10 apiece | [17] | Paper mould Rs 1.60 + printed sleeve Rs 5.50 (A) |
| PM07 | Butter paper, 40 gsm, Rs 66-150 a kg | [17] | A 20 cm square weighs 1.6 g: Rs 0.18 (A) |
| PM08 | Chromo paper labels, 50 x 25 mm, Rs 175-220 a roll; Rs 0.35-0.40 apiece in small lots | [17] | Rs 0.24 for a pre-printed label in rolls of 1,000 (A) |

Packing prices step up in May and July 2026 (A): polymer and paper follow the fuel shock of May 2026
(`people-overheads.md` 3.1 and 3.3); the dairy co-operative named packaging film and fuel among the
reasons for its May price rise [13]. This is what the 1 July list-price revision calls "flour,
packaging and diesel" (`products-prices.md` 4): from April to July maida rises 6.9% and the bags and
pouches 9-10%.

## 3. Price events

| # | Event | Real or (A) | What the record says | In the table |
|---|---|---|---|---|
| 1 | **Sugar spike, July-September 2026** | real | Gujarat ex-mill M/30 rose from about Rs 3,980 a quintal on 11 June to Rs 6,231-6,350 on 22 August, on low mill stocks, tight supply and fear of an El Nino year for the next crop. The government capped dealers' stocks at 4,000 quintals and 30 days from 1 August (L), later tightened the cap to 1,000 quintals and 15 days (the date is not on the pages opened) and approved 10 lakh tonnes of imports; the price was Rs 5,631-5,751 on 26 August and back at Rs 4,421-4,461 by 30 September [1] [2] | RM03: 42.30 in June, 46.80 in July, **56.40 in August**, 51.90 in September, 47.40 in October. Sugar is 4-5% of purchases, so August costs about Rs 19,000 more than June. Tutti-frutti follows |
| 2 | **Edible oil rise and the duty cut of 24 September 2026** | real | Vegetable oils rose nearly 20% in a year. The Rajkot cottonseed tin went from about Rs 2,530 in March to Rs 2,850 on 11 September. On 24 September the customs duty on crude palm and soybean oil was cut from 10% to 5% (all-in 16.5% to 11%), crude sunflower oil to zero, refined palm and soybean oil from 32.5% to 27.5% [3] [4] [5] | RM04, RM05, RM07 rise 13-15% from January to September, then ease in October. How much of the cut reaches the buyer is (A): 1-2% in October, 2-3% more from November (section 4) |
| 3 | **Milk price rise, 14 May 2026** | real | The dairy co-operative and its main rival raised milk by Rs 2 a litre (2.5-3.5%); procurement prices were 3.7% above a year earlier [13] | RM06, RM10, RM22 step up about 2% across May-June on top of the summer shape. The size of the pass-through to butter, powder and paneer is (A) |
| 4 | **Onion at Rs 40-45 a kg, September-October 2026** | real level, (A) path | Gujarat mandi average Rs 39.55 a kg on 25 September, Ahmedabad Rs 44.50 [15] | RM20: 44.00 and 46.00, about 1.4 times a normal autumn; it unwinds by January 2027 (section 4). Onion is 0.3-0.6% of purchases - visible in the cost of a puff, not in the P&L |
| 5 | Fats firm again, February 2027 | (A), invented | - | RM04, RM05 +5%, RM07 +3% from February 2027 |
| 6 | A second milk price rise, March 2027 | (A), invented | - | RM06, RM10, RM22 +3% from March 2027 |

Events 5 and 6 are there so that the 1 April 2027 list-price revision has its stated reason,
"shortening, butter and paneer" (`products-prices.md` 4): by April 2027 shortening is 5.4% above
October 2026, butter 5.3%, paneer 5.2%.

## 4. Prices from November 2026 to December 2027: the rule

For a month `M` after October 2026, with `n` = number of months after October 2026 (November 2026 = 1,
December 2027 = 14):

```
price(M) = round_to_step( A x (1 + d)^n x S[calendar month of M] x E(M) )
```

- `A` = the October 2026 level, with the season taken out for seasonal materials.
- `d` = drift per month (A).
- `S` = seasonal shape, 1.00 for every month unless a shape is named. Each shape averages 1.00.
- `E(M)` = product of the event factors in force in month `M`.
- Round half up to the step shown.

### 4.1 Parameters

| Code | A | d a month | Shape | Events (factor, from - to) | Step |
|---|---:|---:|---|---|---:|
| RM01 | 39.00 | 0.30% | - | - | 0.10 |
| RM02 | 36.50 | 0.30% | - | - | 0.10 |
| RM03 | 47.40 | 0.30% | - | new crushing season: x 0.96 in Nov 2026; x 0.93 from Dec 2026 | 0.10 |
| RM04 | 168 | 0.40% | - | duty cut: x 0.98 from Nov 2026; event 5: x 1.05 from Feb 2027 | 1 |
| RM05 | 184 | 0.40% | - | x 0.98 from Nov 2026; x 1.05 from Feb 2027 | 1 |
| RM06 | 474 | 0.35% | dairy | event 6: x 1.03 from Mar 2027 | 1 |
| RM07 | 161 | 0.40% | - | x 0.97 from Nov 2026; x 1.03 from Feb 2027 | 1 |
| RM08 | 122 | 0.25% | - | - | 1 |
| RM09 | 9.40 | 0.25% | - | - | 0.10 |
| RM10 | 272 | 0.35% | dairy | x 1.03 from Mar 2027 | 1 |
| RM11 | 216 | 0.25% | - | - | 1 |
| RM12 | 155 | 0.25% | - | - | 1 |
| RM13 | 75 | 0.25% | - | - | 1 |
| RM14 | 2,700 | 0.30% | - | - | 10 |
| RM15 | 222 | 0.30% | - | - | 1 |
| RM16 | 160 | 0.30% | - | - | 1 |
| RM17 | 100 | 0.30% | - | - | 1 |
| RM18 | 520 | 0.25% | - | - | 5 |
| RM19 | 14.10 | 0.35% | potato | - | 0.10 |
| RM20 | 24.00 | 0.35% | onion | spike unwinding: x 1.25 in Nov 2026 only; x 1.10 in Dec 2026 only | 0.10 |
| RM21 | 85.7 | 0.30% | peas | - | 1 |
| RM22 | 348 | 0.35% | dairy | x 1.03 from Mar 2027 | 1 |
| RM23 | 145 | 0.30% | garlic | - | 1 |
| RM24 | 370 | 0.30% | - | - | 1 |
| PM01 | 1.10 | 0.25% | - | - | 0.01 |
| PM02 | 1.76 | 0.25% | - | - | 0.01 |
| PM03 | 0.60 | 0.25% | - | - | 0.01 |
| PM04 | 2.18 | 0.25% | - | - | 0.01 |
| PM05 | 2.94 | 0.25% | - | - | 0.01 |
| PM06 | 7.10 | 0.25% | - | - | 0.05 |
| PM07 | 0.19 | 0.25% | - | - | 0.01 |
| PM08 | 0.25 | 0.25% | - | - | 0.01 |

Drift is 3-5% a year (A): flour, sugar, spices, frozen peas and garlic 3.7%, fats and oil 4.9%, dairy,
potato and onion 4.3%, packing and the list-priced ingredients 3.0%.

### 4.2 Seasonal shapes (A)

| Shape | Jan | Feb | Mar | Apr | May | Jun | Jul | Aug | Sep | Oct | Nov | Dec | Why |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| dairy | 0.98 | 0.98 | 0.99 | 1.00 | 1.01 | 1.02 | 1.02 | 1.015 | 1.01 | 1.00 | 0.99 | 0.985 | winter flush, summer lean |
| potato | 0.95 | 0.82 | 0.78 | 0.85 | 0.92 | 0.98 | 1.05 | 1.08 | 1.10 | 1.17 | 1.20 | 1.10 | harvest February-March, then cold storage |
| onion | 0.95 | 0.85 | 0.75 | 0.70 | 0.75 | 0.85 | 1.00 | 1.15 | 1.30 | 1.40 | 1.30 | 1.00 | rabi crop in store from April, tight before the late kharif crop |
| garlic | 1.10 | 1.05 | 0.95 | 0.88 | 0.88 | 0.92 | 0.96 | 1.00 | 1.03 | 1.07 | 1.08 | 1.08 | harvest March-April |
| peas | 0.98 | 0.96 | 0.94 | 0.94 | 0.96 | 0.98 | 1.01 | 1.03 | 1.05 | 1.05 | 1.05 | 1.05 | frozen at the winter harvest |

The shapes are also what the 2026 table follows for these materials (within 3%), so there is no jump
at the join. Onion is the exception: October 2026 is 1.37 times its shape, and the two event factors
of 4.1 bring it back by January 2027.

### 4.3 The rule evaluated (binding where a rounding step could differ)

| Code | Nov 26 | Dec 26 | Jan 27 | Feb 27 | Mar 27 | Apr 27 | May 27 | Jun 27 | Jul 27 | Aug 27 | Sep 27 | Oct 27 | Nov 27 | Dec 27 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| RM01 | 39.10 | 39.20 | 39.40 | 39.50 | 39.60 | 39.70 | 39.80 | 39.90 | 40.10 | 40.20 | 40.30 | 40.40 | 40.50 | 40.70 |
| RM02 | 36.60 | 36.70 | 36.80 | 36.90 | 37.10 | 37.20 | 37.30 | 37.40 | 37.50 | 37.60 | 37.70 | 37.80 | 37.90 | 38.10 |
| RM03 | 45.60 | 44.30 | 44.50 | 44.60 | 44.70 | 44.90 | 45.00 | 45.20 | 45.30 | 45.40 | 45.60 | 45.70 | 45.80 | 46.00 |
| RM04 | 165 | 166 | 167 | 176 | 176 | 177 | 178 | 178 | 179 | 180 | 181 | 181 | 182 | 183 |
| RM05 | 181 | 182 | 182 | 192 | 193 | 194 | 195 | 195 | 196 | 197 | 198 | 199 | 199 | 200 |
| RM06 | 471 | 470 | 469 | 471 | 492 | 499 | 505 | 512 | 514 | 513 | 512 | 509 | 506 | 505 |
| RM07 | 157 | 157 | 158 | 163 | 164 | 165 | 165 | 166 | 167 | 167 | 168 | 169 | 169 | 170 |
| RM08 | 122 | 123 | 123 | 123 | 124 | 124 | 124 | 124 | 125 | 125 | 125 | 126 | 126 | 126 |
| RM09 | 9.40 | 9.40 | 9.50 | 9.50 | 9.50 | 9.50 | 9.60 | 9.60 | 9.60 | 9.60 | 9.70 | 9.70 | 9.70 | 9.70 |
| RM10 | 270 | 270 | 269 | 270 | 282 | 286 | 290 | 294 | 295 | 294 | 294 | 292 | 290 | 290 |
| RM11 | 217 | 217 | 218 | 218 | 219 | 219 | 220 | 220 | 221 | 221 | 222 | 223 | 223 | 224 |
| RM12 | 155 | 156 | 156 | 157 | 157 | 157 | 158 | 158 | 159 | 159 | 159 | 160 | 160 | 161 |
| RM13 | 75 | 75 | 76 | 76 | 76 | 76 | 76 | 77 | 77 | 77 | 77 | 77 | 77 | 78 |
| RM14 | 2,710 | 2,720 | 2,720 | 2,730 | 2,740 | 2,750 | 2,760 | 2,770 | 2,770 | 2,780 | 2,790 | 2,800 | 2,810 | 2,820 |
| RM15 | 223 | 223 | 224 | 225 | 225 | 226 | 227 | 227 | 228 | 229 | 229 | 230 | 231 | 232 |
| RM16 | 160 | 161 | 161 | 162 | 162 | 163 | 163 | 164 | 164 | 165 | 165 | 166 | 166 | 167 |
| RM17 | 100 | 101 | 101 | 101 | 102 | 102 | 102 | 102 | 103 | 103 | 103 | 104 | 104 | 104 |
| RM18 | 520 | 525 | 525 | 525 | 525 | 530 | 530 | 530 | 530 | 535 | 535 | 535 | 535 | 540 |
| RM19 | 17.00 | 15.60 | 13.50 | 11.70 | 11.20 | 12.20 | 13.30 | 14.20 | 15.30 | 15.80 | 16.10 | 17.20 | 17.70 | 16.30 |
| RM20 | 39.10 | 26.60 | 23.00 | 20.70 | 18.30 | 17.20 | 18.40 | 21.00 | 24.80 | 28.60 | 32.40 | 35.00 | 32.60 | 25.20 |
| RM21 | 90 | 91 | 85 | 83 | 82 | 82 | 84 | 86 | 89 | 91 | 93 | 93 | 94 | 94 |
| RM22 | 346 | 345 | 345 | 346 | 361 | 366 | 371 | 376 | 377 | 377 | 376 | 374 | 371 | 371 |
| RM23 | 157 | 158 | 161 | 154 | 140 | 130 | 130 | 137 | 143 | 149 | 154 | 161 | 163 | 163 |
| RM24 | 371 | 372 | 373 | 374 | 376 | 377 | 378 | 379 | 380 | 381 | 382 | 384 | 385 | 386 |
| PM01 | 1.10 | 1.11 | 1.11 | 1.11 | 1.11 | 1.12 | 1.12 | 1.12 | 1.12 | 1.13 | 1.13 | 1.13 | 1.14 | 1.14 |
| PM02 | 1.76 | 1.77 | 1.77 | 1.78 | 1.78 | 1.79 | 1.79 | 1.80 | 1.80 | 1.80 | 1.81 | 1.81 | 1.82 | 1.82 |
| PM03 | 0.60 | 0.60 | 0.60 | 0.61 | 0.61 | 0.61 | 0.61 | 0.61 | 0.61 | 0.62 | 0.62 | 0.62 | 0.62 | 0.62 |
| PM04 | 2.19 | 2.19 | 2.20 | 2.20 | 2.21 | 2.21 | 2.22 | 2.22 | 2.23 | 2.24 | 2.24 | 2.25 | 2.25 | 2.26 |
| PM05 | 2.95 | 2.95 | 2.96 | 2.97 | 2.98 | 2.98 | 2.99 | 3.00 | 3.01 | 3.01 | 3.02 | 3.03 | 3.04 | 3.04 |
| PM06 | 7.10 | 7.15 | 7.15 | 7.15 | 7.20 | 7.20 | 7.25 | 7.25 | 7.25 | 7.30 | 7.30 | 7.30 | 7.35 | 7.35 |
| PM07 | 0.19 | 0.19 | 0.19 | 0.19 | 0.19 | 0.19 | 0.19 | 0.19 | 0.19 | 0.19 | 0.20 | 0.20 | 0.20 | 0.20 |
| PM08 | 0.25 | 0.25 | 0.25 | 0.25 | 0.25 | 0.25 | 0.25 | 0.26 | 0.26 | 0.26 | 0.26 | 0.26 | 0.26 | 0.26 |

Floating-point arithmetic can land a hair on either side of a rounding boundary. The generator may
store the 24 months (section 2 and this table) as one price table; if it computes the rule instead,
this table decides.

## 5. Use, reorder level, order quantity, lead time

Daily use is `recipes-yields.md` 7.2 (the production a Rs 1.09 lakh day needs). Reorder levels and
order quantities are fixed quantities for the item master; they hold for the whole period, because
volume stays between about 13% below and 8% above the normal day.

How the reorder level is sized: **enough that the day-end stock of every material stays at or above
three normal days** (scope 7). An order raised after a day-end check arrives, at worst, `L + 1` days of
use later (a Sunday in between), and the stock at the check may already be a day below the level, so
`reorder level = 1.1 x (L + 5) x daily use`, rounded up to a pack, and more for materials used in
lumps on run days (margarine, butter, sugar, milk powder, spices, pouches). For the four materials
delivered every day with no lead time (potato, onion, garlic, paneer) it is `1.1 x 4 x daily use`.
Flour is the one level rounded down: the formula gives 3,610 kg and the master carries 3,600 kg
(72 bags).

| Code | Use a day | Kept in; life | Lead time `L` (days) | Reorder level (days of use) | Normal order (days of use) | Orders per 30 days | Order value, Jan / Oct 2026 (Rs) | Most on hand | Opening stock, 1 Jan 2026 |
|---|---:|---|---:|---|---|---:|---|---:|---:|
| RM01 | 547 kg | dry store on pallets; 2 months | 1 | 3,600 kg (6.6) | 2,000 kg = 40 bags (3.7) | 8.2 | 72,000 / 78,000 | 5,050 kg | 2,750 kg |
| RM02 | 22.5 kg | dry store; 2 months | 1 | 150 kg (6.7) | 250 kg = 5 bags (11) | 2.7 | 8,375 / 9,125 | 380 kg | 150 kg |
| RM03 | 44.4 kg | dry store; a year | 1 | 400 kg (9.0) | 500 kg = 10 bags (11) | 2.7 | 20,100 / 23,700 | 860 kg | 400 kg |
| RM04 | 23.5 kg | dry store, cool corner; 6 months | 2 | 225 kg (9.6) | 270 kg = 18 boxes (11.5) | 2.6 | 40,500 / 45,360 | 450 kg | 240 kg |
| RM05 | 25.9 kg | cold room; 6 months | 2 | 285 kg (11.0) | 240 kg = 16 cartons (9.3) | 3.2 | 39,360 / 44,160 | 475 kg | 270 kg |
| RM06 | 4.3 kg | cold room; 3 months chilled | 1 | 45 kg (10.4) | 45 kg = 3 cartons (10.4) | 2.9 | 20,475 / 21,330 | 86 kg | 45 kg |
| RM07 | 8.0 litres | dry store; 9 months | 1 | 60 litres (7.5) | 120 litres = 8 tins (15) | 2.0 | 17,040 / 19,320 | 172 litres | 90 litres |
| RM08 | 14.4 kg | cold room; **3-4 weeks** | 1 | 110 kg (7.6) | 50 kg = 5 cartons (3.5) | 8.6 | 5,900 / 6,100 | 146 kg | 60 kg |
| RM09 | 10.0 kg | dry store | 1 | 75 kg (7.5) | 300 kg = 12 bags (30) | 1.0 | 2,700 / 2,820 | 365 kg | 200 kg |
| RM10 | 5.0 kg | dry store; a year | 1 | 50 kg (10.0) | 100 kg = 4 bags (20) | 1.5 | 26,500 / 27,200 | 145 kg | 125 kg |
| RM11 | 2.1 kg | dry store | 1 | 15 kg (7.1) | 50 kg (24) | 1.3 | 10,500 / 10,800 | 63 kg | 45 kg |
| RM12 | 1.28 kg | dry store | 1 | 10 kg (7.8) | 30 kg (23) | 1.3 | 4,500 / 4,650 | 39 kg | 30 kg |
| RM13 | 0.34 kg | dry store | 1 | 5 kg (15) | 10 kg (30) | 1.0 | 750 / 750 | 15 kg | 10 kg |
| RM14 | 0.12 kg | dry store, sealed | 1 | 2 kg (17) | 3 kg (25) | 1.2 | 7,650 / 8,100 | 5 kg | 3 kg |
| RM15 | 0.33 kg | dry store | 1 | 5 kg (15) | 10 kg (31) | 1.0 | 2,150 / 2,220 | 15 kg | 10 kg |
| RM16 | 0.32 kg | dry store | 1 | 5 kg (16) | 10 kg (32) | 0.9 | 1,550 / 1,600 | 15 kg | 10 kg |
| RM17 | 1.27 kg | dry store | 1 | 20 kg (16) | 30 kg (24) | 1.3 | 2,760 / 3,000 | 49 kg | 30 kg |
| RM18 | 0.05 litre | dry store | 1 | 1 litre (18) | 2 litres = 4 bottles (37) | 0.8 | 1,040 / 1,040 | 3 litres | 1.5 litres |
| RM19 | 19.0 kg | ventilated rack; **about 2 weeks** | 0 | 100 kg (5.3) | 50 kg = 1 bag (2.6) | 11.4 | 650 / 825 | 150 kg | 100 kg |
| RM20 | 5.7 kg | ventilated rack; 3 weeks | 0 | 30 kg (5.2) | 20 kg (3.5) | 8.6 | 400 / 920 | 50 kg | 20 kg |
| RM21 | 4.35 kg | chest freezer, 100 kg; a year | 1 | 30 kg (6.9) | 30 kg (6.9) | 4.3 | 2,520 / 2,700 | 56 kg | 44 kg |
| RM22 | 2.5 kg | cold room; **about 10 days vacuum-packed (A)** | 0 | 11 kg (4.4) | 5 kg (2.0) | 15.2 | 1,650 / 1,740 | 16 kg | 8 kg |
| RM23 | 0.52 kg | cold room; **about 10 days (A)** | 0 | 3 kg (5.7) | 2 kg (3.8) | 7.8 | 320 / 310 | 5 kg | 2 kg |
| RM24 | 1.08 kg | dry store | 1 | 8 kg (7.4) | 25 kg (23) | 1.3 | 9,000 / 9,250 | 32 kg | 22 kg |
| PM01 | 635 | packing store | 7 | 9,000 (14) | 20,000 (31) | 1.0 | 20,000 / 22,000 | 24,600 | 14,000 |
| PM02 | 135 | packing store | 7 | 2,000 (15) | 5,000 (37) | 0.8 | 8,000 / 8,800 | 6,100 | 3,000 |
| PM03 | 986 | packing store | 3 | 9,000 (9.1) | 30,000 (30) | 1.0 | 16,500 / 18,000 | 36,000 | 21,000 |
| PM04 | 196 | packing store | 7 | 3,500 (18) | 6,000 (31) | 1.0 | 12,000 / 13,080 | 8,100 | 4,500 |
| PM05 | 213 | packing store | 7 | 4,000 (19) | 6,000 (28) | 1.1 | 16,200 / 17,640 | 8,500 | 4,500 |
| PM06 | 91 | packing store | 5 | 1,500 (16) | 3,000 (33) | 0.9 | 20,400 / 21,300 | 4,050 | 2,000 |
| PM07 | 850 | packing store | 2 | 7,000 (8.2) | 25,000 (29) | 1.0 | 4,500 / 4,750 | 30,300 | 18,000 |
| PM08 | 2,256 | packing store | 4 | 23,000 (10) | 70,000 (31) | 1.0 | 16,800 / 17,500 | 84,000 | 48,000 |

Notes.

- "Most on hand" = reorder level - use during the lead time + one order; nothing exceeds its storage:
  flour peaks at about 101 bags, the cold room at about 730 kg (margarine, yeast, butter, paneer,
  garlic), the freezer at 56 kg.
- **Short-life materials are bought every few days**: yeast every 3.5 days (the oldest block in the
  cold room is about 10 days from receipt), paneer every second day, potato every 2.6 days, peeled
  garlic every 4 days, onion twice a week. Butter and margarine come in three or four lots a month
  because the cold room is small, not because they spoil.
- **Paneer is held at three to six days, not one.** The scope asks for three normal days of every raw
  material; that works with vacuum-packed blocks kept chilled (A). `recipes-yields.md` says "daily or
  on alternate days" - the order is every second day - and `people-overheads.md` 7.4 opens with one
  day; the opening column above uses 8 kg.
- Opening stock is `people-overheads.md` 7.4 (days per class x daily use) rounded up to whole packs;
  at the January 2026 rates it is **about Rs 4.0 lakh** (that file says "about Rs 4.7 lakh", from
  higher assumed prices). Ten materials open at or below their reorder level, so the first working
  day of the year raises eight orders.
- Checked by a two-year day-by-day run of these rules with lumpy run days and volume noise: no
  material ran short; the lowest day-end stock was 3.1 days (yeast, in the first week) and 3.3 days
  (paneer); flour never fell below 3.5 days. Stock averaged about Rs 4.8 lakh (Rs 3.3-6.1 lakh).
  The review ran the same rules again with its own noise and run-day pattern: no shortage, lowest
  day-end stock 3.3 days (yeast, paneer) and 3.7 days (flour), stock Rs 3.5-6.2 lakh, 90 orders per
  30 days of which 8 above Rs 50,000.
- On a typical day six to eight of the 32 materials are at or below their reorder level, nearly all
  with an order already placed (flour, yeast, potato and paneer about half the time). The low-stock
  list should therefore show the quantity on order beside each alert.

## 6. Purchasing rules for the generator

1. **Day-end check.** After production is posted on day D, for every material:
   `if stock on hand + quantity on open orders <= reorder level -> order the normal order quantity`.
   The check on 31 December 2025 is made on the opening stock.
2. **Purchase order.** One order per vendor per order day, with one line for each of that vendor's
   materials that tripped the check. It is dated the next order day after D. Order days: Monday to
   Saturday except closed days (`calendar-geography.md` 3.1); for VM09 and VM11 every day except
   closed days. Rate = `price(month of the order date)`. For potato, onion and garlic the rate is the
   month's price x (1 + u), u uniform in +/-6% from the seeded stream keyed on date and material,
   rounded to Rs 0.10 (garlic Rs 1) (A). Expected date = order date + `L` of the line (a line keeps its
   own lead time).
3. **Approval.** An order whose value before GST is Rs 50,000 or less is approved as submitted; above
   that the Owner approves it the same day in the seed (A). That is every flour order (8 a month), and
   now and then a fats order when shortening and margarine fall on one day (one in three months) or a
   butter and milk powder order in 2027. An order above the limit raised on the last seeded day is
   left "Submitted" for the user; the three-day floor covers the wait.
4. **Goods receipt.** In the morning of the expected date, before production; if that day is a Sunday
   (VM09 and VM11 excepted) or a closed day, the next receiving day. At the order's rate (scope).
   Seeded exceptions (A), each drawn from the stream keyed on the order:
   - VM12: one order in four arrives in two parts - 60% on the expected date, the rest four days
     later ("Part received", then "Received").
   - VM01: one receipt in 25 rejects one bag (damp or torn); VM09: one potato receipt in 8 rejects
     2-4 kg. The rejected quantity is neither stocked nor billed and the order closes short.
5. **Vendor bill.** One bill per receipt, dated the receipt date, for what was received at the order
   rate, plus GST by line. **VM09 and VM11 bill weekly**: one bill each Monday for the receipts of the
   previous Monday to Sunday (one bill against several receipts). Due date = bill date + the vendor's
   credit days. Seeded exception (A): one bill in 40 from VM03, VM04, VM07, VM12 or VM13 carries a
   rate 3-5% above the order (the vendor billed next month's price); it fails the three-way check, is
   held, and the Owner releases it one to three days later. The purchase price does not change.
6. **Payment.** Accounts pays on **Mondays and Thursdays** (A): every bill due on or before that day,
   one payment per vendor, from the bank. **VM08 and VM13 are paid late by habit**: at the first
   payment day on or after the due date + 12 days, so the payables ageing always shows something
   overdue (as the opening position does). VM09 and VM11 are paid in cash from factory cash on the due
   date (about Rs 3,100-4,600 and Rs 5,800-6,200 a week). A payment day that is a closed day moves to
   the next open day. The opening bills follow the same rule, except that the two overdue ones are
   paid on Monday 5 January 2026, as `people-overheads.md` 7.3 has it.
7. **Safety net.** If, at the start of a production day, the stock of a material is less than that
   day's requirement, an extra order of one normal quantity is raised and received that morning from
   the same vendor. With the levels of section 5 this never fires; the self-check should count it.
8. **Volume at a month:** about 91 orders (VM01 8, VM02 3, VM03 4, VM04 6, VM05 2, VM06 5, VM07 12-13,
   VM08 4, VM09 20, VM10 4, VM11 15, VM12 5, VM13 3), about 95 receipts, about 66 bills and about 55
   payments.

## 7. Material vendors (13)

Names are invented. Credit days count from the bill date. "Share" is of a normal month's purchases
before GST at October 2026 prices.

| Id | Name (invented) | Town | Constitution | GSTIN (synthetic) | Supplies | Credit days | Delivers | Share |
|---|---|---|---|---|---|---:|---|---:|
| VM01 | Godhumvan Roller Flour Mills Pvt Ltd | Nadiad | private company | 24AAGCG4172M1ZE | RM01 | 15 | next day, own truck, Mon-Sat | 45.3% |
| VM02 | Kanakshali Chakki Atta Udyog | Borsad | proprietor | 24BKTPP6391H1ZH | RM02 | 15 | next day, Mon-Sat | 1.7% |
| VM03 | Sharkaravan Sugar and Salt Traders | Anand (grain market) | partnership firm | 24ABMFS2846J1ZT | RM03, RM09 | 10 | next day, Mon-Sat | 4.7% |
| VM04 | Snigdhakosh Bakery Fats LLP | Vadodara | LLP | 24ACDFS7150R1ZL | RM04, RM05 | 21 | 2 days, Mon-Sat | 18.5% |
| VM05 | Tailvan Oil Depot | Anand | proprietor | 24CLNPT4418B1Z4 | RM07 | 14 | next day, Mon-Sat | 2.7% |
| VM06 | Ksheervan Dairy Products Agency | Anand | partnership firm | 24AAZFK9263D1ZU | RM06, RM10 | 7 | next day, chilled van, Mon-Sat | 7.2% |
| VM07 | Kinvashakti Bakery Ingredients Pvt Ltd | Ahmedabad | private company | 24AAHCK3057N1Z9 | RM08, RM11, RM12, RM13, RM17, RM18 | 15 | next day, chilled van, Mon-Sat | 5.5% |
| VM08 | Elachivala Masala Bhandar | Anand | proprietor | 24DQRPM8824L1Z1 | RM14, RM15, RM16, RM24 | 15 (paid late) | next day, Mon-Sat | 1.8% |
| VM09 | Shakmandap Vegetable Suppliers | Anand (vegetable market yard) | proprietor | not registered | RM19, RM20, RM23 | 7, weekly bill | same morning, every day | 1.4% |
| VM10 | Sheetkosh Frozen Foods | Vallabh Vidyanagar | proprietor | 24EHYPS5136C1ZY | RM21 | 7 | next day, Mon-Sat | 0.8% |
| VM11 | Dugdhkalash Paneer and Dairy Farm | Karamsad | proprietor | not registered | RM22 | 7, weekly bill | same morning, every day | 1.9% |
| VM12 | Veshtan Polyfilms Pvt Ltd | Vadodara (Makarpura GIDC) | private company | 24AAKCV6609P1ZN | PM01-PM05 | 30 | 7 days printed, 3 days plain | 5.5% |
| VM13 | Kagazvesh Print Pack | Vitthal Udyognagar | partnership firm | 24ABGFK1784E1ZF | PM06, PM07, PM08 | 30 (paid late) | 2-5 days | 2.9% |

- **GSTIN.** 15 characters: state code 24 + a 10-character PAN (fourth letter C for a company, F for a
  firm or LLP, P for an individual; fifth letter the initial of the name, or of the surname for a
  proprietor) + entity number 1 + "Z" + a check character. The numbers above are synthetic and must not
  be shown as real registrations. **The generator must compute the 15th character itself and not trust
  a typed one**: over the first 14 characters, with values 0-9 then A-Z = 10-35, multiply alternately
  by 1 and 2 starting with 1 at the first character, add quotient and remainder of each product
  divided by 36, sum, and take `(36 - sum mod 36) mod 36`. That calculation reproduces all six customer
  GSTINs of `calendar-geography.md` 9.1 and gave the check characters shown here and in section 8.
- VM09 and VM11 sell only exempt goods (fresh vegetables, paneer) and are not registered (A); their
  bills carry no GSTIN and no tax.
- Credit against the brief: flour 15 days and sugar 10; packing 30; dairy and vegetables weekly; fats
  21, oil 14, bakery ingredients and spices 15 (A).
- **Names.** They are coined compounds (godhum = wheat, sharkara = sugar, kinva = yeast, snigdha =
  fat, sheet = cold, veshtan = wrapping ...) chosen to be unlikely as real trade names. The review
  searched each of the 13 on the web on 2 October 2026 and replaced four first choices whose coined
  word turned out to be in use (VM04: a charity and an infrastructure company; VM09: two websites;
  VM10: a food brand from another state; VM13: an art-print brand). The 13 names above gave no
  business of that name; the replacements start with the same letter where the GSTIN depends on it,
  so no GSTIN changed. A web search cannot prove that a small firm does not exist; any name can
  change without touching anything else.
- The scope speaks of "about 18 vendors" for materials and `people-overheads.md` 7.3 groups its opening
  bills as 2 + 3 + 6 + 4 + 3 = 18. This file has 13, as the brief asked for about 12. The mapping onto
  those groups is in section 11.

## 8. Expense vendors

Bill dates, amounts and due dates are the rules of `people-overheads.md` 4; this table only names who
sends them. The first ten are the core set. Utilities, the telecom operator, the insurer, the bank and
government fees keep generic names, as that file asks. Six names (marked *) were searched there on
2 October 2026 with no match in Anand. The other seven firm names were searched in the review of this
file; three first choices were replaced because the coined word is in use (VE11: a technology
company; VE15: a food-safety app; VE17: a tailoring label) and the seven shown gave no match. The
three store landlords are invented individuals. The Terms column is the vendor's usual term; a bill
for which that file states no due date takes its 7-day default.

| Id | Name | Town | Type | GSTIN (synthetic) | GST on its bills | Expense category | Terms |
|---|---|---|---|---|---|---|---|
| VE01 | Kesarvan Estates LLP * | Anand | factory landlord, LLP | 24AAUFK5392G1ZV | 18% | Rent (factory) | dated the 1st, due the 7th |
| VE02 | Maganbhai D. Thakkar | Anand | landlord of store S1, individual | not registered | none | Rent (S1) | dated the 1st, due the 5th |
| VE03 | Sarlaben K. Amin | Vallabh Vidyanagar | landlord of store S2, individual | not registered | none | Rent (S2) | same |
| VE04 | Rafiqbhai G. Mansuri | Nadiad | landlord of store S3, individual | not registered | none | Rent (S3) | same |
| VE05 | Electricity distribution company | - | state utility | - | none | Electricity (factory, S1, S2, S3) | 10 days |
| VE06 | City gas distributor | Anand | piped gas | - | none (VAT inside) | Oven fuel (gas) | 10 days |
| VE07 | Tulsivan Fuel Point * | Anand | fuel station, firm | 24AATFT8061Q1Z6 | none (diesel is outside GST) | Vehicle fuel | 7 days, two bills a month |
| VE08 | Agnitej Oven Services * | Vadodara | oven and machinery service, firm | 24ABEFA2475K1ZG | 18% | Repairs and maintenance (quarterly contract, generator service, the August 2026 compressor) | 15 days for the contract, 7 days otherwise |
| VE09 | Broadband and mobile operator | - | telecom operator | - | 18% | Telephone and internet (one bill per location) | dated the 5th, due the 20th |
| VE10 | Pandit Lakdawala & Co., Chartered Accountants | Anand | accounting firm | 24AASFP6318C1Z8 | 18% | Professional fees | 15 days |
| VE11 | Pahiyaveg Motor Garage | Anand | garage, proprietor | 24FMVPC7745D1ZS | 18% | Vehicle maintenance (service, tyres, battery) | 15 days |
| VE12 | Yantradoot Spares and Bearings | Anand | spares dealer, firm | 24ABXFY3906H1ZM | 18% | Repairs and maintenance (monthly breakdown and spares) | 7 days |
| VE13 | General insurance company | - | insurer | - | 18% | Licences and insurance | 7 days |
| VE14 | Government fees | - | pseudo-vendor | - | none | Licences and insurance | 7 days |
| VE15 | Aharnirikshan Food Testing Laboratory Pvt Ltd | Vallabh Vidyanagar | laboratory | 24AAJCA8452F1ZP | 18% | Licences and insurance (product testing) | 7 days |
| VE16 | The bank | - | bank | - | 18% | Bank charges | paid the same day |
| VE17 | Ganveshkala Uniforms | Anand | garment supplier, proprietor | 24GRWPV2587N1ZE | 5% | Staff welfare (uniforms) | 7 days |
| VE18 | Family clinic (medical fitness certificates) | Anand | clinic | not registered | none | Staff welfare | 7 days |
| VE19 | Mithaskalash Sweets and Farsan | Anand | sweet and gift supplier, firm | 24ABPFM4063T1ZF | 5% | Staff welfare (Diwali) | 7 days |
| VE20 | Chitrakala Print and Sign * | Anand | printer and sign maker, firm | 24AAQFC9731B1ZI | 18% | Marketing (racks, boards, leaflets, banners) | 7 days |
| VE21 | Dhvaniprachar Media Pvt Ltd | Anand | advertising agency | 24AANCD1648R1Z1 | 18% | Marketing (local advertising) | 7 days |
| VE22 | Swachhmitra Facility Services * | Anand | housekeeping contractor, firm | 24ABCFS5820L1Z3 | 18% | Running costs | 7 days |
| VE23 | Industrial estate water supply | Vitthal Udyognagar | utility | - | none | Running costs | 7 days |
| VE24 | Jantumukt Pest Care * | Anand | pest control, proprietor | 24HJKPJ3379A1Z8 | 18% | Running costs | 7 days |

- The generic vendors carry no GSTIN in the master; their GST, where there is any, still counts as
  input credit.
- Store rent carries no GST because the landlords are unregistered and the sample does not model
  reverse charge (`people-overheads.md` 4.1).
- Expense bills are paid from the bank on their due date (that file's rule), not on the Monday and
  Thursday rhythm of material bills.

## 9. A normal month of purchases

30 days at the normal-day production of `recipes-yields.md` 7.2, before GST. Orders per month are from
the two-year run of section 5.

| Vendor | Buys | Jan 2026 prices (Rs) | Oct 2026 prices (Rs) | Input GST, Oct (Rs) | Orders a month | Typical order (Rs) |
|---|---|---:|---:|---:|---:|---|
| VM01 Godhumvan Roller Flour Mills | maida 16,420 kg | 5,91,060 | 6,40,320 | 0 | 8 | 70,000-81,400 |
| VM02 Kanakshali Chakki Atta | atta 675 kg | 22,600 | 24,620 | 0 | 3 | 8,400-9,500 |
| VM03 Sharkaravan Sugar and Salt | sugar 1,330 kg, salt 300 kg | 56,210 | 65,920 | 3,160 | 4 | 20,000-28,000; salt 2,700 |
| VM04 Snigdhakosh Bakery Fats | shortening 705 kg, margarine 775 kg | 2,32,970 | 2,61,170 | 13,060 | 6 | 39,000-49,000 |
| VM05 Tailvan Oil Depot | oil 240 litres | 33,860 | 38,400 | 1,920 | 2 | 17,000-20,400 |
| VM06 Ksheervan Dairy Products | butter 130 kg, milk powder 150 kg | 98,800 | 1,02,320 | 5,120 | 5 | 20,500-29,000 |
| VM07 Kinvashakti Bakery Ingredients | yeast 430 kg, improver, propionate, baking powder, tutti-frutti, essence | 75,150 | 77,750 | 4,770 | 12-13 | 5,900-17,800 |
| VM08 Elachivala Masala Bhandar | cardamom, cumin, sesame, puff masala | 24,350 | 25,330 | 1,270 | 4 | 1,600-11,600 |
| VM09 Shakmandap Vegetable Suppliers | potato 570 kg, onion 172 kg, garlic 16 kg | 13,350 | 19,730 | 0 | 20 | 300-2,000 |
| VM10 Sheetkosh Frozen Foods | peas 130 kg | 10,960 | 11,740 | 590 | 4 | 2,500-2,800 |
| VM11 Dugdhkalash Paneer and Dairy Farm | paneer 76 kg | 25,030 | 26,390 | 0 | 15 | 1,650-1,900 |
| VM12 Veshtan Polyfilms | 19,050 + 4,050 bread bags, 29,580 bun bags, 12,270 pouches | 70,810 | 77,440 | 13,940 | 5 | 8,000-38,000 |
| VM13 Kagazvesh Print Pack | 2,730 cake packs, 25,500 puff papers, 67,680 labels | 39,400 | 41,150 | 4,890 | 3 | 4,500-27,000 |
| **Total** | | **12,94,550** | **14,12,270** | **48,700** | **about 91** | |

By class (October 2026 prices): flour 47.1%; fats and oil 25.6%; packing 8.4%; milk powder and paneer
4.8%; sugar 4.5%; yeast 3.7%; other ingredients 3.8%; vegetables 2.2%. Input GST was Rs 44,760 at
January prices. The quantities shown are rounded; the rupee columns were worked from the unrounded
daily use, so quantity x price can differ from them by up to 0.7% on a line (Rs 130 on the total).

Month by month at normal volume, the same basket costs (Rs lakh): Jan 12.95, Feb 12.96, Mar 12.93,
Apr 12.88, May 13.12, Jun 13.37, Jul 13.71, Aug 14.05, Sep 14.19, Oct 14.12 in 2026; 14.05 in
November and December 2026; 14.06 in January 2027 rising to 14.78 in December 2027. A real month
scales with its volume (`V(M)` of `people-overheads.md`) and its number of days.

Payables this produces: about Rs 8 lakh on an ordinary day at January 2026 prices and about Rs 8.8
lakh at October 2026 prices (each vendor's daily purchases with GST x its credit days, the extra 12
days of VM08 and VM13, and up to three days' wait for a payment day), of which flour is Rs 3.1-3.4
lakh. From day to day the balance moves between about Rs 6.4 lakh and Rs 10 lakh (review run).

## 10. Check: product cost and material cost as a share of sales

Recipe cost per good unit = mix cost / E + packing (`recipes-yields.md` 3.8), at the prices of
section 2. Retailer price is the list in force (`products-prices.md` 3 and 4).

| Code | Product | Cost, Jan 2026 | Retailer price | Cost % | Cost, Oct 2026 | Retailer price | Cost % |
|---|---|---:|---:|---:|---:|---:|---:|
| FG01 | Sandwich bread 400 g | 13.73 | 36.00 | 38% | 14.90 | 38.50 | 39% |
| FG02 | Brown bread 400 g | 13.65 | 44.00 | 31% | 14.84 | 46.50 | 32% |
| FG03 | Jumbo loaf 800 g | 27.32 | 65.00 | 42% | 29.66 | 69.00 | 43% |
| FG04 | Ladi pav 12 pieces | 15.35 | 32.00 | 48% | 16.66 | 34.00 | 49% |
| FG05 | Burger bun, plain | 8.90 | 32.00 | 28% | 9.65 | 34.00 | 28% |
| FG06 | Burger bun, sesame | 9.84 | 36.00 | 27% | 10.63 | 38.50 | 28% |
| FG07 | Burger bun, whole wheat | 8.47 | 40.00 | 21% | 9.20 | 42.50 | 22% |
| FG08 | Burger bun, jumbo | 13.04 | 49.00 | 27% | 14.15 | 52.00 | 27% |
| FG09 | Pizza base | 7.71 | 28.00 | 28% | 8.38 | 29.50 | 28% |
| FG10 | Elaichi toast 250 g | 20.19 | 45.00 | 45% | 22.09 | 45.00 | 49% |
| FG11 | Milk toast 400 g | 35.88 | 68.00 | 53% | 38.70 | 68.00 | 57% |
| FG12 | Butter khari 200 g | 31.88 | 53.00 | 60% | 34.64 | 53.00 | 65% |
| FG13 | Jeera khari 200 g | 25.51 | 49.00 | 52% | 28.27 | 49.00 | 58% |
| FG14 | Jeera biscuit 250 g | 25.17 | 68.00 | 37% | 27.49 | 68.00 | 40% |
| FG15 | Tea cake 200 g | 20.94 | 53.00 | 40% | 22.58 | 53.00 | 43% |
| FG16 | Veg puff | 5.65 | 15.25 | 37% | 6.42 | 15.25 | 42% |
| FG17 | Paneer puff | 10.83 | 23.00 | 47% | 11.89 | 23.00 | 52% |
| FG18 | Garlic puff | 6.85 | 19.00 | 36% | 7.56 | 19.00 | 40% |

A plain 400 g loaf at Rs 13.70-14.90 of materials and packing is believable: Rs 9.80-10.70 of it is
273 g of flour. Khari and milk toast are the thin lines (fat and butter); buns and pizza base the fat
ones. The nine 5% lines lose three to five points between January and October 2026, which is why the
second list-price revision is theirs.

**Material cost as a share of sales.** Normal day, units of `products-prices.md` 9.1:

| | Jan 2026 | Jun 2026 | Oct 2026 | Mar 2027 | Dec 2027 |
|---|---:|---:|---:|---:|---:|
| Recipe cost of the units sold, Rs a day | 42,810 | 44,200 | 46,700 | 47,320 | 48,880 |
| Net sales, Rs a day (list in force) | 1,08,750 | 1,08,750 | 1,12,730 | 1,12,730 | 1,16,080 |
| Recipe cost of goods sold | 39.4% | 40.6% | 41.4% | 42.0% | 42.1% |
| + production loss, write-offs, count differences (about 1.8 points) | **41.2%** | **42.4%** | **43.2%** | **43.8%** | **43.9%** |
| Purchases of a 30-day month / sales of that month | 39.7% | 41.0% | 41.8% | 42.3% | 42.4% |

(Net sales after the July 2026 revision are worked from the price tables of `products-prices.md` 3
and 4 on the units of its 9.1: + Rs 3,980 a day; the April 2027 revision adds about Rs 3,350 more.
The 1.8 points are that file's and `people-overheads.md` 6's production loss, write-offs and count
differences, scaled to this cost level.)

So material cost runs at **41-44% of sales**, against "roughly 45-55%" in the brief and the 47-53%
band of `people-overheads.md` 6. The gap is not a pricing slip:

- The prices used are already at the upper middle of every source (maida at Rs 36-39 where a mill
  quotes Rs 34-37 to a bulk buyer; branded fats; a strong grade of butter).
- The share is low because the selling side is rich: Rs 128 a kg of finished goods, with no
  distributor margin and 30% of sales at MRP through the own stores. A bread-only plant selling to
  distributors would be at 55-60% on the same costs.
- To reach 50% on the purchase side every price would have to rise about 15% above its source.

Levers, for the reconciliation step to choose from: (a) accept 41-44% and widen the band in
`RESEARCH.md` - operating profit in the reference month of `people-overheads.md` 6 then lands at
about 16-21% instead of 9.5-12% (six to nine points more); (b) take the top of each
researched range (maida Rs 41, the dearest fats, butter Rs 500): about + 2 points; (c) trim list
prices or the store share on the selling side. This file recommends (a): a prospect who knows the
trade will check the flour and sugar prices first.

## 11. Opening entries this topic touches

- **Opening rate** of each material on 1 January 2026 = the January 2026 column of section 2.
- **Opening stock** quantities: the last column of section 5.
- **Opening bills, one per vendor.** The totals, the five groups and the three due-date buckets of
  `people-overheads.md` 7.3 are kept exactly; only the split over 13 vendors is new (A).

| Group in `people-overheads.md` 7.3 | Vendor | Opening bill (Rs) | Due | Paid in the seed |
|---|---|---:|---|---|
| Flour mills, 2,90,000 | VM01 | 2,78,000 | 7 Jan 2026 | on the first payment day on or after the due date |
| | VM02 | 12,000 | 6 Jan 2026 | same |
| Fats and oils, 2,50,000 | VM04 | 1,74,000 | 14 Jan 2026 | same |
| | VM05 | 31,000 | 9 Jan 2026 | same |
| | VM06 | 45,000 | 5 Jan 2026 | same |
| Sugar, yeast, milk powder and other ingredients, 1,75,000 | VM03 | 62,000 | 8 Jan 2026 | same |
| | VM07 | 85,000 | 12 Jan 2026 | same |
| | VM08 | 28,000 | **27 Dec 2025, overdue** | 5 Jan 2026 |
| Packing, 2,30,000 | VM12 | 1,66,000 | 20 Jan 2026 | same |
| | VM13 | 64,000 | **19 Dec 2025, overdue** | 5 Jan 2026 |
| Fresh, 25,000 | VM09 | 7,000 | 5 Jan 2026 | cash, 5 Jan |
| | VM10 | 6,000 | 3 Jan 2026 | 5 Jan |
| | VM11 | 12,000 | 5 Jan 2026 | cash, 5 Jan |
| **Total** | | **9,70,000** | overdue 92,000; due 1-7 Jan 3,60,000; due 8-31 Jan 5,18,000 | |

  These balances are larger than a normal credit cycle at this file's prices (about Rs 8 lakh in
  January 2026, section 9): the sugar, ingredient, oil, dairy and printed-bag bills stand for about
  two cycles, as after a year-end round of stocking up. If the integrator prefers balances that match
  the cycle, scale every bill that is not overdue by 0.8 and keep the two overdue ones.

## 12. The same data in one block (for the generator)

```js
// Rs before GST per stock unit, Jan..Oct 2026
PRICE_2026 = {
RM01:[36.00,36.00,35.60,35.00,35.60,36.60,37.40,38.20,38.80,39.00],
RM02:[33.50,33.50,33.10,32.50,33.10,34.10,34.90,35.70,36.30,36.50],
RM03:[40.20,41.20,41.40,41.50,42.70,42.30,46.80,56.40,51.90,47.40],
RM04:[150,151,153,155,158,160,163,166,170,168],
RM05:[164,165,167,169,172,175,178,182,186,184],
RM06:[455,455,460,465,472,480,480,478,476,474],
RM07:[142,144,146,147,149,151,154,158,164,161],
RM08:[118,118,118,118,118,118,122,122,122,122],
RM09:[9.00,9.00,9.00,9.00,9.00,9.00,9.40,9.40,9.40,9.40],
RM10:[265,265,268,272,276,280,280,278,275,272],
RM11:[210,210,210,210,210,210,216,216,216,216],
RM12:[150,150,150,150,150,150,155,155,155,155],
RM13:[75,75,75,75,75,75,75,75,75,75],
RM14:[2550,2550,2600,2650,2700,2750,2800,2800,2750,2700],
RM15:[215,212,205,205,208,212,216,220,222,222],
RM16:[155,155,155,155,155,155,160,160,160,160],
RM17:[92,92,92,92,92,92,94,98,102,100],
RM18:[520,520,520,520,520,520,520,520,520,520],
RM19:[13.00,11.00,10.50,11.50,12.50,13.50,14.50,15.00,15.50,16.50],
RM20:[20.00,18.00,16.00,15.00,16.00,19.00,24.00,32.00,44.00,46.00],
RM21:[84,82,80,80,82,84,86,88,90,90],
RM22:[330,330,335,340,348,355,355,352,350,348],
RM23:[160,150,135,125,125,130,138,145,150,155],
RM24:[360,360,360,360,360,360,370,370,370,370],
PM01:[1.00,1.00,1.00,1.00,1.05,1.05,1.10,1.10,1.10,1.10],
PM02:[1.60,1.60,1.60,1.60,1.68,1.68,1.76,1.76,1.76,1.76],
PM03:[0.55,0.55,0.55,0.55,0.58,0.58,0.60,0.60,0.60,0.60],
PM04:[2.00,2.00,2.00,2.00,2.10,2.10,2.18,2.18,2.18,2.18],
PM05:[2.70,2.70,2.70,2.70,2.84,2.84,2.94,2.94,2.94,2.94],
PM06:[6.80,6.80,6.80,6.80,6.80,6.80,7.10,7.10,7.10,7.10],
PM07:[0.18,0.18,0.18,0.18,0.18,0.18,0.19,0.19,0.19,0.19],
PM08:[0.24,0.24,0.24,0.24,0.24,0.24,0.25,0.25,0.25,0.25],
};
// From Nov 2026: price = round(A * (1+d)^n * SHAPE[sh][month-1] * events, step); n = months after Oct 2026.
// ev: [first n, factor, last n (omitted = for good)]
SHAPE = {
dairy: [0.98,0.98,0.99,1.00,1.01,1.02,1.02,1.015,1.01,1.00,0.99,0.985],
potato:[0.95,0.82,0.78,0.85,0.92,0.98,1.05,1.08,1.10,1.17,1.20,1.10],
onion: [0.95,0.85,0.75,0.70,0.75,0.85,1.00,1.15,1.30,1.40,1.30,1.00],
garlic:[1.10,1.05,0.95,0.88,0.88,0.92,0.96,1.00,1.03,1.07,1.08,1.08],
peas:  [0.98,0.96,0.94,0.94,0.96,0.98,1.01,1.03,1.05,1.05,1.05,1.05],
};
RULE = {
RM01:{A:39.00,d:0.0030,step:0.1}, RM02:{A:36.50,d:0.0030,step:0.1},
RM03:{A:47.40,d:0.0030,step:0.1,ev:[[1,0.96,1],[2,0.93]]},
RM04:{A:168,d:0.0040,step:1,ev:[[1,0.98],[4,1.05]]},
RM05:{A:184,d:0.0040,step:1,ev:[[1,0.98],[4,1.05]]},
RM06:{A:474,d:0.0035,step:1,sh:'dairy',ev:[[5,1.03]]},
RM07:{A:161,d:0.0040,step:1,ev:[[1,0.97],[4,1.03]]},
RM08:{A:122,d:0.0025,step:1}, RM09:{A:9.40,d:0.0025,step:0.1},
RM10:{A:272,d:0.0035,step:1,sh:'dairy',ev:[[5,1.03]]},
RM11:{A:216,d:0.0025,step:1}, RM12:{A:155,d:0.0025,step:1}, RM13:{A:75,d:0.0025,step:1},
RM14:{A:2700,d:0.0030,step:10}, RM15:{A:222,d:0.0030,step:1}, RM16:{A:160,d:0.0030,step:1},
RM17:{A:100,d:0.0030,step:1}, RM18:{A:520,d:0.0025,step:5},
RM19:{A:14.10,d:0.0035,step:0.1,sh:'potato'},
RM20:{A:24.00,d:0.0035,step:0.1,sh:'onion',ev:[[1,1.25,1],[2,1.10,2]]},
RM21:{A:85.7,d:0.0030,step:1,sh:'peas'},
RM22:{A:348,d:0.0035,step:1,sh:'dairy',ev:[[5,1.03]]},
RM23:{A:145,d:0.0030,step:1,sh:'garlic'}, RM24:{A:370,d:0.0030,step:1},
PM01:{A:1.10,d:0.0025,step:0.01}, PM02:{A:1.76,d:0.0025,step:0.01}, PM03:{A:0.60,d:0.0025,step:0.01},
PM04:{A:2.18,d:0.0025,step:0.01}, PM05:{A:2.94,d:0.0025,step:0.01}, PM06:{A:7.10,d:0.0025,step:0.05},
PM07:{A:0.19,d:0.0025,step:0.01}, PM08:{A:0.25,d:0.0025,step:0.01},
};
// v vendor, mult order multiple, gst %, hsn, L lead days, R reorder level, Q order quantity, open opening stock
PURCHASE = {
RM01:{v:'VM01',mult:50,gst:0,hsn:'1101',L:1,R:3600,Q:2000,open:2750},
RM02:{v:'VM02',mult:50,gst:0,hsn:'1101',L:1,R:150,Q:250,open:150},
RM03:{v:'VM03',mult:50,gst:5,hsn:'1701',L:1,R:400,Q:500,open:400},
RM04:{v:'VM04',mult:15,gst:5,hsn:'1517',L:2,R:225,Q:270,open:240},
RM05:{v:'VM04',mult:15,gst:5,hsn:'1517',L:2,R:285,Q:240,open:270},
RM06:{v:'VM06',mult:15,gst:5,hsn:'0405',L:1,R:45,Q:45,open:45},
RM07:{v:'VM05',mult:15,gst:5,hsn:'1512',L:1,R:60,Q:120,open:90},
RM08:{v:'VM07',mult:10,gst:5,hsn:'2102',L:1,R:110,Q:50,open:60},
RM09:{v:'VM03',mult:25,gst:0,hsn:'2501',L:1,R:75,Q:300,open:200},
RM10:{v:'VM06',mult:25,gst:5,hsn:'0402',L:1,R:50,Q:100,open:125},
RM11:{v:'VM07',mult:5,gst:5,hsn:'2106',L:1,R:15,Q:50,open:45},
RM12:{v:'VM07',mult:5,gst:18,hsn:'2915',L:1,R:10,Q:30,open:30},
RM13:{v:'VM07',mult:5,gst:5,hsn:'2102',L:1,R:5,Q:10,open:10},
RM14:{v:'VM08',mult:1,gst:5,hsn:'0908',L:1,R:2,Q:3,open:3},
RM15:{v:'VM08',mult:5,gst:5,hsn:'0909',L:1,R:5,Q:10,open:10},
RM16:{v:'VM08',mult:5,gst:5,hsn:'1207',L:1,R:5,Q:10,open:10},
RM17:{v:'VM07',mult:5,gst:5,hsn:'2006',L:1,R:20,Q:30,open:30},
RM18:{v:'VM07',mult:0.5,gst:18,hsn:'3302',L:1,R:1,Q:2,open:1.5},
RM19:{v:'VM09',mult:50,gst:0,hsn:'0701',L:0,R:100,Q:50,open:100,noise:0.06},
RM20:{v:'VM09',mult:10,gst:0,hsn:'0703',L:0,R:30,Q:20,open:20,noise:0.06},
RM21:{v:'VM10',mult:1,gst:5,hsn:'0710',L:1,R:30,Q:30,open:44},
RM22:{v:'VM11',mult:1,gst:0,hsn:'0406',L:0,R:11,Q:5,open:8},
RM23:{v:'VM09',mult:1,gst:0,hsn:'0703',L:0,R:3,Q:2,open:2,noise:0.06},
RM24:{v:'VM08',mult:1,gst:5,hsn:'0910',L:1,R:8,Q:25,open:22},
PM01:{v:'VM12',mult:1000,gst:18,hsn:'3923',L:7,R:9000,Q:20000,open:14000},
PM02:{v:'VM12',mult:1000,gst:18,hsn:'3923',L:7,R:2000,Q:5000,open:3000},
PM03:{v:'VM12',mult:1000,gst:18,hsn:'3923',L:3,R:9000,Q:30000,open:21000},
PM04:{v:'VM12',mult:500,gst:18,hsn:'3923',L:7,R:3500,Q:6000,open:4500},
PM05:{v:'VM12',mult:500,gst:18,hsn:'3923',L:7,R:4000,Q:6000,open:4500},
PM06:{v:'VM13',mult:500,gst:5,hsn:'4819',L:5,R:1500,Q:3000,open:2000},
PM07:{v:'VM13',mult:1000,gst:18,hsn:'4806',L:2,R:7000,Q:25000,open:18000},
PM08:{v:'VM13',mult:1000,gst:18,hsn:'4821',L:4,R:23000,Q:70000,open:48000},
};
// credit days from bill date; sunday: orders and receipts on Sundays; weekly: one bill each Monday; late: paid 12 days late; cash: paid from factory cash
VENDOR = {
VM01:{credit:15,open:278000,due:'2026-01-07'}, VM02:{credit:15,open:12000,due:'2026-01-06'},
VM03:{credit:10,open:62000,due:'2026-01-08'}, VM04:{credit:21,open:174000,due:'2026-01-14'},
VM05:{credit:14,open:31000,due:'2026-01-09'}, VM06:{credit:7,open:45000,due:'2026-01-05'},
VM07:{credit:15,open:85000,due:'2026-01-12'}, VM08:{credit:15,late:12,open:28000,due:'2025-12-27'},
VM09:{credit:7,sunday:true,weekly:true,cash:true,open:7000,due:'2026-01-05'},
VM10:{credit:7,open:6000,due:'2026-01-03'},
VM11:{credit:7,sunday:true,weekly:true,cash:true,open:12000,due:'2026-01-05'},
VM12:{credit:30,open:166000,due:'2026-01-20'}, VM13:{credit:30,late:12,open:64000,due:'2025-12-19'},
};
```

## 13. Sources

Opened on 2 October 2026 unless marked (L).

1. ChiniMandi, daily sugar market updates - Gujarat ex-mill S/30 and M/30, "all rates excluding GST":
   https://www.chinimandi.com/daily-sugar-market-update-by-vizzie-19-1-2026/ ;
   https://www.chinimandi.com/daily-sugar-market-update-by-vizzie-16-02-2026/ ;
   https://www.chinimandi.com/daily-sugar-market-update-by-vizzie-16-03-2026/ ;
   https://www.chinimandi.com/daily-sugar-market-update-by-vizzie-15-04-2026/ ;
   https://www.chinimandi.com/daily-sugar-market-update-by-vizzie-05-05-2026/ ;
   https://www.chinimandi.com/daily-sugar-market-update-by-vizzie-11-06-2026/ ;
   https://www.chinimandi.com/daily-sugar-market-update-by-vizzie-08-07-2026/ ;
   https://www.chinimandi.com/daily-sugar-market-update-by-vizzie-30-07-2026/ ;
   https://www.chinimandi.com/daily-sugar-market-update-by-vizzie-07-08-2026/ ;
   https://www.chinimandi.com/daily-sugar-market-update-by-vizzie-18-08-2026/ ;
   https://www.chinimandi.com/daily-sugar-market-update-by-vizzie-22-08-2026/ (10 lakh tonnes of
   imports approved) ;
   https://www.chinimandi.com/daily-sugar-market-update-by-vizzie-26-08-2026/ (added in review:
   M/30 Rs 5,631-5,751; not used in the August average) ;
   https://www.chinimandi.com/daily-sugar-market-update-by-vizzie-03-09-2026/ (the stock cap of 1,000
   quintals and 15 days is a news headline carried on this and the later pages, without its date) ;
   https://www.chinimandi.com/daily-sugar-market-update-by-vizzie-30-09-2026/ ;
   https://www.chinimandi.com/daily-sugar-market-update-by-vizzie-01-10-2026/
2. Sugar stock limits: dealers capped at 4,000 quintals and 30 days from 1 August to 30 November 2026
   (L): https://www.business-standard.com/industry/news/govt-orders-sugar-dealers-to-limit-stocks-to-30-days-and-4-000-quintals-126072801142_1.html ;
   retail sugar Rs 48.18 a kg on 20 July and Rs 55.70 on 20 August 2026 (L; the page refused the
   request): https://www.pib.gov.in/PressReleasePage.aspx?PRID=2302018&reg=48&lang=1
3. Business Today, 24 September 2026 - customs duty cut on edible oils, old and new rates:
   https://www.businesstoday.in/latest/economy/story/govt-cuts-customs-duty-on-edible-oil-ahead-of-festive-season-557539-2026-09-24
4. Rajkot edible oil, 15 kg tin - 11 September 2026 (cottonseed Rs 2,850, a week earlier Rs 2,780):
   https://www.etvbharat.com/gu/state/rajkot-edible-oil-price-hike-groundnut-oil-price-gjs26091106247 ;
   15 July 2026 (cottonseed Rs 2,670):
   https://tv9gujarati.com/gujarat/rajkot/rajkot-edible-oil-prices-rise-groundnut-cottonseed-oil-cost-increases-gujarat-1482437.html ;
   March 2026, Rs 2,520 to Rs 2,540 (L; the page refused the request):
   https://www.vtvgujarati.com/news-details/gujarat-news-prices-of-castor-oil-and-cottonseed-oil-increase
5. Edible-oil duty cut, second report (opened in review; it confirms the duty rates of source 3):
   https://www.whalesbook.com/news/English/commodities/India-Cuts-Import-Duty-on-Palm-Soybean-Sunflower-Oils/6ab415565aacb956d07ea4ed
   The retail prices first noted from its search listing - palm Rs 154 a kg (+16.3% on the year),
   soybean Rs 167 (+14%), sunflower Rs 194 (+19.5%) - are not on the page; they are unsupported and
   no price in this file rests on them.
6. Wholesale app, bakery maida 50 kg Rs 1,840 (Rs 36.80 a kg; Rs 35.80 above 250 kg) and chakki atta
   50 kg Rs 1,825: https://www.hyperpure.com/in/royal-bakery-maida-50-kg-bag
7. IndiaMART, maida in Ahmedabad, 1 October 2026: https://dir.indiamart.com/ahmedabad/maida-flour.html
8. Wheat, Gujarat mandis, 25 September 2026 (average Rs 2,729.73 a quintal; Kapadvanj Rs 2,662):
   https://www.commodityonline.com/mandiprices/wheat/gujarat ; all-India page, Rs 2,626.97 (L):
   https://www.commodityonline.com/mandiprices/wheat
9. Milling wheat, India, 1 April 2026, average Rs 2,243.75 a quintal (L; the page refused the request):
   https://www.openpr.com/news/4454193/milling-wheat-price-trend-analysis-2026-grain-market
10. Wholesale app, Ahmedabad, vanaspati and oils in 15 kg tins:
    https://www.hyperpure.com/ind/ahmedabad/vanaspati-others
11. Wholesale app, seven bakery fats in 14-15 kg packs, Rs 2,547-2,930 (Rs 170-204 a kg; the page does
    not label them as shortening or margarine):
    https://www.hyperpure.com/in/bakery-fats3
12. Butter: retail and 10 kg packs https://www.hyperpure.com/in/unsalted-butter-20-kg-bulk-pack (the
    20 kg pack at Rs 9,548 was in the search listing only (L)); white butter in Ahmedabad, opened in
    review - Rs 250-800 a kg, most listings Rs 370-500, the commonest Rs 430:
    https://dir.indiamart.com/ahmedabad/white-butter.html
13. Milk price rise of 14 May 2026, Rs 2 a litre, reasons:
    https://www.whalesbook.com/news/English/consumer-products/Amul-Mother-Dairy-Hike-Milk-Prices-by-indian-rupee2Litre-Amid-Rising-Costs/6a04a7059444064ed06f543a
14. Compressed yeast, carton of 20 x 500 g (10 kg), Rs 1,250 (shown the same with and without tax):
    https://bromill.com/index.php?product_id=692&route=product%2Fproduct ; a 500 g block Rs 57.75 (L):
    https://www.hyperpure.com/ind/noida/prestige-fresh-bakers-compressed-yeast-500-gm
15. Mandi prices, 25 September - 1 October 2026 (all five re-opened in review and match; sugar, all
    India, Rs 57.13 a kg on 1 October, range Rs 51-66: https://www.commodityonline.com/mandiprices/sugar):
    potato https://www.commodityonline.com/mandiprices/potato/gujarat ;
    onion https://www.commodityonline.com/mandiprices/onion/gujarat ;
    garlic https://www.commodityonline.com/mandiprices/garlic/gujarat ;
    cumin https://www.commodityonline.com/mandiprices/cummin-seed-jeera/gujarat ;
    cardamom https://www.commodityonline.com/mandiprices/cardamoms
16. Wholesale app, Ahmedabad: paneer https://www.hyperpure.com/ind/ahmedabad/paneer ; frozen peas
    https://www.hyperpure.com/ind/ahmedabad/frozen-vegetables
17. IndiaMART packing categories: https://dir.indiamart.com/impcat/printed-bopp-bag.html ;
    https://dir.indiamart.com/impcat/butter-paper.html ; https://dir.indiamart.com/impcat/cake-box.html ;
    https://dir.indiamart.com/impcat/barcode-labels.html
18. IndiaMART ingredient categories: https://dir.indiamart.com/impcat/skimmed-milk-powder.html ;
    https://dir.indiamart.com/impcat/bread-improvers.html ;
    https://dir.indiamart.com/impcat/calcium-propionate.html ;
    https://dir.indiamart.com/impcat/baking-powder.html ; https://dir.indiamart.com/impcat/sesame-seed.html ;
    https://dir.indiamart.com/impcat/tutti-frutti.html ; https://dir.indiamart.com/impcat/vanilla-essence.html ;
    https://dir.indiamart.com/impcat/iodized-salt.html ; https://dir.indiamart.com/impcat/frozen-green-peas.html ;
    https://dir.indiamart.com/impcat/peeled-garlic.html
19. GST changes of 22 September 2025, old and new rates: https://goodsandservice.tax/2.0/
20. GST rates by HSN from 22 September 2025:
    https://taxshastra.com/new-gst-rates-on-all-goods-from-22-09-2025-new-list-of-all-items-with-hsn-code-and-gst-rate-from-22-09-2025/
21. HSN look-ups: https://www.credlix.com/hsn-code/1101 ; https://www.credlix.com/hsn-code/0710 ;
    https://www.credlix.com/hsn-code/4821 ; https://www.credlix.com/hsn-code/4806 (still shows 12% for
    greaseproof paper; source 19 gives the change to 18%)
22. GST on pre-packaged and labelled goods - a package above 25 kg is outside the levy:
    https://taxguru.in/goods-and-service-tax/faqs-gst-applicability-pre-packaged-labelled-goods.html

Not found, and therefore (A): a monthly price history for anything except sugar and cottonseed oil;
what a bakery in Anand actually pays any of its suppliers; the price of puff masala; pack weights of
the bags and pouches; lead times, credit terms and order sizes; whether listed wholesale prices
include GST.

## 14. Points for the reconciliation step

1. **Material cost is 41-44% of sales, not 50%** (section 10). `people-overheads.md` 6 holds material
   cost at 50% and derives a 12% operating profit (9.5% at October 2026 costs); with these prices the
   profit is six to nine points higher. The review recomputed all 18 product costs and the share from
   the recipes and price lists and gets the same figures. Choose a lever there or widen the band; do
   not push purchase prices past their sources.
2. **Vendor count.** 13 material vendors here; the scope says "about 18" and `people-overheads.md`
   lists about 22 expense vendor types, of which this file names 24. If 18 material vendors are wanted,
   split VM07 (yeast agent; improver and chemicals; sundries), VM12 (bag printer; pouch printer) and
   VM13 (box maker; label printer) and add a second flour mill.
3. **Vendor names** were searched in review and seven were replaced (sections 7 and 8); the six taken
   from `people-overheads.md` rest on that file's search. The synthetic GSTINs pass the check-character
   test but were not looked up on the GST portal; a chance match with a real registration cannot be
   excluded, so the generator may as well build its own from the pattern of section 7.
4. **Opening payables** follow `people-overheads.md` 7.3 to the rupee but stand above a normal cycle
   at these prices (section 11); **opening stock** is about Rs 4.0 lakh, not Rs 4.7 lakh, and paneer
   opens at 8 kg, not 2.5 kg.
5. **Paneer and the three-day rule.** If paneer should be bought daily and held for one day, the
   scope's "raw material for at least three normal days" needs an exception for it; set its reorder
   level to 5 kg and its order to 3 kg.
6. **The order limit bites on flour only.** Every flour order (Rs 70,000-81,400) waits for the Owner.
   If that is too many approvals, order 25 bags at a time (Rs 43,750-49,900 until June 2027, above
   the limit from July 2027) and expect 13 orders a month.
7. **The low-stock list is never empty** (six to eight items a day, section 5). It reads better with
   the on-order quantity beside each line; otherwise lower the reorder levels of flour, yeast, potato
   and paneer in the master and let the generator keep its own, higher trigger.
8. **Hyperpure and IndiaMART prices** are read as including GST. If they are before tax, shortening,
   margarine, butter and peas are 5% low, which is worth about 0.5 points of material cost (paneer is
   Nil-rated, so it is not affected).
9. **Sugar in August 2026** is one monthly price (Rs 56.40). The market moved from Rs 49.80 to
   Rs 65.40 within the month; a half-month price step would show the spike more sharply but needs a
   second price table.
10. Purchase documents on closed days follow `calendar-geography.md` 3.1: none are scheduled; a date
    that falls on one moves to the next open day.
11. **Sugar against the scope's note.** The scope quotes "about Rs 51-57 a kg wholesale" from the
    all-India mandi page (Rs 57.13 on 1 October 2026, range Rs 51-66). This file prices sugar from the
    dated Gujarat ex-mill quotes plus Rs 2.50: Rs 47.40 before GST in October (Rs 49.80 with GST),
    Rs 40-42 in the first half of the year. If the scope's range should hold for October, raise the
    Rs 2.50 to Rs 4.00 in every month; it adds Rs 2,000 a month (0.06 points of material cost).
12. **Generic expense vendors carry no GSTIN** (VE05, VE06, VE09, VE13, VE14, VE16, VE23), although
    VE09, VE13 and VE16 charge 18% GST. If the vendor form insists on a GSTIN for a bill with tax,
    give those three a synthetic one by the pattern of section 7.
