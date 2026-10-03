# Recipes, yields and the material master

Research raw for `docs/RESEARCH.md`. Checked on 2 October 2026 against `docs/SCOPE.md` v0.3.
Happy Bakers is fictional; every figure below is a parameter for the day-by-day simulation, not a
record of a real bakery. Values marked **(A)** are assumptions where the public record is silent.
Every researched figure carries its source in section 8.

Reviewed on 2 October 2026: the cited pages were re-opened, the arithmetic was recomputed and the file
was checked against `products-prices.md` and `people-overheads.md` (sections 4.3, 7.2 and 9 carry what
that check added).

Nothing here is a list of dates. Every parameter is a rule that holds for any business date from
1 January 2026 to 31 December 2027.

## 0. Conventions

- **Mix** = one mixer batch, defined by its flour weight. A recipe is the material list for one mix.
  Mixes may be entered in halves (0.5, 1, 1.5 ...); material use is recipe quantity x mixes. The three
  puffs may be entered in quarters (0.25, 0.5 ...): they are cut from one shared pastry, so a puff
  "mix" is a share of that pastry, and a puff has no second day in which a surplus could be sold (A).
- **Water is not a material.** It is shown in each recipe because it sets the dough weight, but it is
  not stocked or costed (it is part of the water / utilities expense).
- **Gas and electricity are expenses**, not materials.
- **Yeast is compressed (fresh) yeast**, the form Indian wholesale bakeries buy in 500 g blocks. If the
  buyer ever switches to instant dry yeast the quantity is one third (source 9).
- **Oil** in a recipe includes tin and tray greasing. Oil is stocked in litres; 1 litre = 0.91 kg.
- **Pieces per mix (T)** = what the dough, batter or oven-out weight gives after normal handling loss.
- **Expected good units per mix (E)** = T less the normal reject rate, rounded down. This is the
  recipe's "expected number of units" in the ERP. Product cost = mix cost / E + packing per unit, so
  the normal reject is inside the product cost and a normal day's yield is close to 100%.
- Packing is consumed for good units only (scope 4.3).
- Codes: products `FG01`-`FG18` in the order of the scope's product table; raw materials `RM01`-`RM24`;
  packing `PM01`-`PM08`. 32 materials in all.

## 1. Material master (32 items)

Stock unit is the unit of every recipe, receipt and count. "Buying pack" is a note for the purchase
topic, not a second unit **(A)**.

### Raw materials (24)

| Code | Name | Stock unit | Buying pack (A) | Used in | Note |
|---|---|---|---|---|---|
| RM01 | Maida (bakery flour) | kg | 50 kg bag | all 18 products | Refined wheat flour, 11-13% protein for bread (source 1). The main cost driver. |
| RM02 | Whole wheat atta | kg | 50 kg bag | FG02, FG07 | 50% of the flour in brown bread, 75% in the whole wheat bun (FSSAI labelling rule: "brown" needs 50%, "whole wheat" 75%; source 12). |
| RM03 | Sugar | kg | 50 kg bag | all yeast lines, FG14, FG15 | Crystal sugar; ground in-house for biscuit and cake. |
| RM04 | Bakery shortening | kg | 15 kg box | all except FG09, FG15 | Vanaspati-type bakery fat for doughs, biscuit and the dough layer of puff pastry. |
| RM05 | Puff margarine | kg | 15 kg carton | FG12, FG13, FG16-FG18 | Lamination (roll-in) fat with a high melting point. |
| RM06 | Butter | kg | 15 kg carton | FG11, FG12, FG14, FG15, FG18 | White (unsalted) butter; kept chilled. |
| RM07 | Refined oil | litre | 15 litre tin | all yeast lines, FG15, FG16-FG18 | Cottonseed or sunflower oil: tin greasing, pizza dough, cake batter, puff fillings. |
| RM08 | Yeast, compressed | kg | carton of 20 x 500 g | FG01-FG11 | Fresh yeast, kept chilled, about 3-4 weeks life; bought twice a week (A). |
| RM09 | Salt | kg | 25 kg bag | all except FG15 | Iodised, free-flowing. |
| RM10 | Skimmed milk powder | kg | 25 kg bag | FG04-FG08, FG10, FG11, FG14, FG15 | |
| RM11 | Bread improver | kg | 5 kg pack | FG01-FG11 | Enzyme and ascorbic-acid improver, 0.3-0.6% of flour. |
| RM12 | Calcium propionate (preservative) | kg | 5 kg pack | FG01-FG09, FG15 | Mould inhibitor, 0.2-0.3% of flour (source 7). Not used in toast, khari or biscuit, which keep by dryness. |
| RM13 | Baking powder | kg | 5 kg pack | FG14, FG15 | The only chemical leavening. |
| RM14 | Cardamom (elaichi) powder | kg | 1 kg pack | FG10 | |
| RM15 | Cumin seed (jeera) | kg | 5 kg pack | FG13, FG14 | |
| RM16 | Sesame seed, white | kg | 5 kg pack | FG06 | Bun topping. |
| RM17 | Tutti-frutti | kg | 5 kg pack | FG15 | Candied papaya dice. |
| RM18 | Flavour essence | litre | 500 ml bottle | FG11, FG15 | Milk flavour for milk toast, vanilla for tea cake; one stock item. |
| RM19 | Potato | kg | 50 kg bag | FG16, FG17, FG18 | Bought two or three times a week. |
| RM20 | Onion | kg | 50 kg bag | FG16, FG17, FG18 | |
| RM21 | Green peas, frozen | kg | 1 kg pack | FG16, FG17 | Frozen, so the recipe is the same all year. |
| RM22 | Paneer | kg | 1 kg block | FG17 | Bought daily or on alternate days; kept chilled. |
| RM23 | Garlic, peeled | kg | 1 kg pack | FG18 | |
| RM24 | Puff masala | kg | 1 kg pack | FG16, FG17, FG18 | Ready spice blend for the fillings: chilli, turmeric, coriander, garam masala, dry mango. |

### Packing materials (8)

| Code | Name | Stock unit | Used for | Note |
|---|---|---|---|---|
| PM01 | Bread bag, 400 g loaf | piece | FG01, FG02 | Printed polypropylene bag, 25 micron; about 4 g, about 250 bags a kg (source 14; weight calculated, A). One house design; the label names the variant. |
| PM02 | Bread bag, 800 g loaf | piece | FG03 | Same film, longer bag. |
| PM03 | Pav / bun bag | piece | FG04-FG09 | Plain clear polypropylene bag, about 10 x 12 inch (A); takes a 12-piece ladi, four buns or two pizza bases. |
| PM04 | Pouch, small | piece | FG10, FG14 | Printed pouch for a 250 g pack of toast or biscuit. |
| PM05 | Pouch, large | piece | FG11, FG12, FG13 | Printed pouch for 400 g of toast or 200 g of khari (khari is bulky). |
| PM06 | Cake pack | piece | FG15 | Paper baking mould with a printed sleeve box for one 200 g tea cake. |
| PM07 | Puff paper | piece | FG16, FG17, FG18 | One greaseproof paper square per puff; puffs travel in trays, unpacked. |
| PM08 | Date label | piece | FG01-FG15 | Sticker with product name, MRP, batch number, manufacturing and best-before dates. One per pack. |

Crates and trays are equipment, not stock (crate tracking is out of scope).

## 2. What the references say, and what Happy Bakers uses

Baker's percentage = weight of an ingredient as a percentage of the flour weight.

| Product family | Reference formula or figure | Source | Happy Bakers value |
|---|---|---|---|
| Tin bread | Milk bread: flour 1000 g, milk powder 25 g, compressed yeast 15 g, water 550 ml, shortening 50 g, improver 3 g, salt 10 g (the printed 250 g sugar is treated as a misprint for 25 g) | 1 | Flour 100, water 59, sugar 4, shortening 2, yeast 2.5, salt 1.8, improver 0.4, preservative 0.3 |
| Tin bread | Yeast in a normal straight dough: 2-3% of flour | 4 | 2.5-2.8% |
| Tin bread | "Generally, 12% extra dough weight is taken to compensate for the loss" | 1 | 450 g dough for a 400 g loaf (12.5% extra) |
| Tin bread | Commercial plants lose 12-13% of dough weight; small bakers 15-20%. Scaling guide: 485 g of dough for a small white tin loaf that cools to 420 g (13%), 950 g for 820 g (14%); whole wheat 500 g for 420 g (16%) | 8 | Bake and cooling loss 11% (white), 12.5% (brown) - at the low end, as in source 1's 12% extra dough |
| Tin bread | Proof 55-65 minutes at 30-35 C; bake 25-30 minutes at 220-250 C | 1 | Process note only |
| Preservative | Calcium propionate 0.1-0.3% of flour weight | 7 | 0.2-0.3% |
| Brown bread | FSSAI labelling rule (in force from 1 May 2023): brown bread at least 50% whole wheat flour; whole wheat bread 75% | 12 | Brown bread 50% atta, 50% maida. Whole wheat bun 75% atta, 25% maida, so that the scope's name "whole wheat" stands if the rule is read to cover buns |
| Burger buns | Flour 100, water 65 + ice 2, sugar 13, dry yeast 4, oil 3, salt 2, conditioner 0.25-0.5; bake 199-218 C for 10-12 minutes | 5 | Flour 100, water 55, sugar 10, shortening 5, yeast 3.5, salt 1.6, milk powder 2, improver 0.5 (A: Indian buns are less sweet than the US formula) |
| Burger buns | Market pack: 4 pieces, 200 g (a national brand's listing) | 15 | 4 pieces, 200 g; jumbo 4 pieces, 300 g (A) |
| Ladi pav | Home recipe: 450 g maida, 7 g dry yeast, 2 tsp sugar, 2 tbsp butter gives 12 pav | 10 | Flour 100, water 57, sugar 6, shortening 4, yeast 3, salt 1.6, milk powder 1 (A, commercial) |
| Ladi pav | Market packs seen at re-check: 12 pieces 400 g; 12 pieces 300 g; "Bombay pav" 400 g; whole wheat 12 pieces 500 g (the listings rotate; a 12-piece 360 g pack noted earlier was no longer shown) | 16 | 12 pieces, 400 g |
| Pizza base | Market pack: 2 pieces, 200 g | 17 | 2 pieces, 200 g; lean dough with 3% oil and 3% sugar (A) |
| Toast (rusk) | Sample recipe: bread flour 72 kg, sugar 26.4 kg, palm oil 9.6 kg, suji 2.4 kg, compressed yeast 2.7 kg, milk powder 1.2 kg, salt 0.84 kg, improver 0.24 kg, water 33-35 litres, cardamom flavour and seeds | 2 | Elaichi toast: flour 100, sugar 30, shortening 12, yeast 3.6, salt 1.2, milk powder 2, improver 0.4, cardamom 0.4, water 44 |
| Toast (rusk) | First bake 30 minutes at 190-195 C; loaf cooled to 20-21% moisture; sliced 14 mm; second bake 30-32 minutes at 160-170 C; final moisture 1-1.8% | 2 | Dough-to-toast weight loss 31-32% (calculated from these moistures) |
| Toast (rusk) | Project norm: wastage 4%; finished stock 10 days; raw material stock 10 days | 3 | Slicing and breakage 5%, reject 2%; stock cover 7 days |
| Puff pastry | Dough: flour 100, butter 3-3.5, water 45-50, salt 2-2.5. Roll-in fat 50-60% of dough weight. 5-6 single folds, rested 30 minutes between sets | 6 | Dough fat 4-5%, water 50-52%, salt 1.8-2% |
| Puff pastry | "Full", "three-quarter" and "half" paste = fat equal to 100%, 75% or 50% of the flour; about 130 layers gives the best lift; bake at 220 C | 11 | Khari: 65% roll-in fat + 5% dough fat (about three-quarter). Puffs: 55% + 4% (between half and three-quarter) |
| Khari | Bake at 200 C for 20-25 minutes, then at 180 C for 15-20 minutes; rusk first bake 200 C, second 180 C | 13 | Process note; khari baked dry to about 3% moisture (A) |
| Khari | Home recipe uses puff margarine and bakes 25 minutes at 180 C then 25 minutes at 160 C | 18 | Confirms the two-stage bake |
| Jeera biscuit | Home recipes: flour 160 g, butter 113 g, powdered sugar 35 g (fat 71%, sugar 22% of flour); Surti style: 300 g fat to 250 g flour | 19, 20 | Flour 100, fat 45, sugar 18, salt 2, cumin 2.5, baking powder 1 (A: a wholesale biscuit carries less fat than a home or Surti recipe) |
| Eggless tea cake | Commercial egg-free premix: 1000 g premix, 450 g water, 120 g oil; bake 35-40 minutes at 190 falling to 170 C | 21 | Scratch batter: flour 100, sugar 85, oil 32, butter 5, milk powder 12, baking powder 4, tutti-frutti 20, water 85 (A) |
| Cake preservative | Calcium propionate is the usual bread preservative; potassium sorbate is common in cakes | 4 | Calcium propionate 0.5% of flour in the tea cake, so the master keeps one preservative (A) |
| Rejects | Production waste 1-1.5% of output in small and medium bakeries, 3-5% in large ones (one large respondent said 2-5%); causes: deformed, wrong weight, burnt, damaged by equipment, human error in weighing | 22 | Normal reject 1.5-3% by product; bad runs in section 6 |

## 3. Recipes per mix

### 3.1 Summary of all 18 products

| Code | Product (pack as sold) | Flour per mix (kg) | Water per mix (litre) | Dough, batter or paste (kg) | Piece weight before baking | Bake loss | Net weight as sold | Pieces per mix (T) | Normal reject | Expected good units per mix (E) |
|---|---|---:|---:|---:|---|---:|---|---:|---:|---:|
| FG01 | Sandwich bread, 400 g | 50 | 29.5 | 85.00 | 450 g | 11% | 400 g | 186 | 1.5% | **183** |
| FG02 | Brown bread, 400 g | 25 | 15.75 | 43.60 | 460 g | 12.5% | 400 g | 93 | 2% | **91** |
| FG03 | Jumbo sandwich loaf, 800 g | 25 | 14.75 | 42.50 | 900 g | 11% | 800 g | 46 | 1.5% | **45** |
| FG04 | Ladi pav, 12 pieces | 50 | 28.5 | 86.60 | 38 g each, 456 g a slab | 12% | about 400 g | 187 | 2% | **183** |
| FG05 | Burger bun, plain, 4 pieces | 10 | 5.5 | 17.79 | 57 g each | 12% | 200 g | 76 | 2% | **74** |
| FG06 | Burger bun, sesame, 4 pieces | 10 | 5.5 | 17.79 | 57 g each | 12% | 200 g | 76 | 2% | **74** |
| FG07 | Burger bun, whole wheat, 4 pieces | 10 | 6.1 | 18.40 | 58 g each | 13% | 200 g | 78 | 2% | **76** |
| FG08 | Burger bun, jumbo, 4 pieces | 10 | 5.5 | 17.79 | 86 g each | 12% | 300 g | 50 | 2% | **49** |
| FG09 | Pizza base, 2 pieces | 15 | 8.15 | 24.68 | 115 g each | 12% | 200 g | 105 | 3% | **101** |
| FG10 | Elaichi toast, 250 g | 25 | 11.1 | 48.50 | 400 g loaf tin, then 14 mm slices | 31% over both bakes | 250 g | 125 | 2% | **122** |
| FG11 | Milk toast, 400 g | 50 | 22.7 | 96.86 | 400 g loaf tin, then 14 mm slices | 32% over both bakes | 400 g | 154 | 2% | **150** |
| FG12 | Butter khari, 200 g | 20 | 10 | 44.40 | about 14 g strip (A) | 34% | 200 g | 139 | 3% | **134** |
| FG13 | Jeera khari, 200 g | 20 | 10 | 44.70 | about 14 g strip (A) | 34% | 200 g | 141 | 3% | **136** |
| FG14 | Jeera biscuit, 250 g | 15 | 2.1 | 27.68 | about 10 g (A) | 14% | 250 g | 92 | 2% | **90** |
| FG15 | Tea cake, 200 g | 6 | 5.1 | 20.63 | 225 g batter | 10% | 200 g | 89 | 3% | **86** |
| FG16 | Veg puff, piece | 2.5 | 1.3 | 5.32 paste + 3.2 filling | 55 g pastry + 35 g filling | about 21% | about 70 g | 92 | 3% | **89** |
| FG17 | Paneer puff, piece | 2.5 | 1.3 | 5.32 paste + 3.3 filling | 55 g pastry + 35 g filling | about 21% | about 70 g | 92 | 3% | **89** |
| FG18 | Garlic puff, piece | 2.5 | 1.3 | 5.32 paste + 3.3 filling | 55 g pastry + 35 g filling | about 21% | about 70 g | 92 | 3% | **89** |

How T is worked out:

- **Yeast doughs (FG01-FG09):** dough weight less 1.5% handling loss (bowl, divider, dusting,
  fermentation), divided by the dough weight of one pack. Example FG01: 85.00 x 0.985 = 83.72 kg;
  / 0.450 = 186 loaves; less 1.5% = 183.
- **Tea cake:** batter less 2% (bowl and depositor), / 225 g.
- **Toast, khari, biscuit (packed by weight):** dry matter of the recipe (flour 87% solids, margarine
  and butter 84%, compressed yeast 30%, sugar and fats 100%) less process loss, brought to the final
  moisture (toast 2%, khari and biscuit 3%), less slicing or breakage loss, divided by the fill weight
  (1% overfill). Process loss of dry matter (fermentation, dusting, trimmings, crumbs) is 2.6% for
  toast, 4% for khari and 1.8% for biscuit (A). Breakage at slicing or packing: toast 5%, khari 4%,
  biscuit 2%. Example FG10: 33.5 kg dry matter, 33.3 kg of toast out of the second oven from 48.5 kg
  of dough, 31.65 kg packable after 5% end-slices and breakage, / 252.5 g = 125 packs; less 2% = 122.
- **Puffs:** paste less 4% trimmings that are not re-rolled, / 55 g = 92 pieces; less 3% = 89.

Check: FG01 gives 74.4 kg of bread from 50 kg of flour, 149 kg per 100 kg of flour, inside the usual
140-150 band for pan bread (A). Packed toast is 1.20-1.22 kg per kg of flour and packed khari
1.34-1.36 kg per kg of flour.

### 3.2 Bread and pav - quantity per mix

Sandwich bread and the jumbo loaf are the same dough in two tin sizes; the jumbo recipe is the
sandwich recipe at half the batch. Quantities in kg, oil in litres.

| Material | FG01 Sandwich 400 g | FG02 Brown 400 g | FG03 Jumbo 800 g | FG04 Ladi pav |
|---|---:|---:|---:|---:|
| RM01 Maida | 50 | 12.5 | 25 | 50 |
| RM02 Atta | - | 12.5 | - | - |
| RM03 Sugar | 2 | 1 | 1 | 3 |
| RM04 Shortening | 1 | 0.5 | 0.5 | 2 |
| RM07 Oil (litre) | 0.25 | 0.15 | 0.15 | 0.5 |
| RM08 Yeast | 1.25 | 0.7 | 0.625 | 1.5 |
| RM09 Salt | 0.9 | 0.45 | 0.45 | 0.8 |
| RM10 Milk powder | - | - | - | 0.5 |
| RM11 Improver | 0.2 | 0.125 | 0.1 | 0.2 |
| RM12 Calcium propionate | 0.15 | 0.075 | 0.075 | 0.1 |
| Water (not stocked) | 29.5 | 15.75 | 14.75 | 28.5 |
| Dough (kg) | 85.00 | 43.60 | 42.50 | 86.60 |
| Pieces per mix (T) | 186 | 93 | 46 | 187 |
| **Expected good units (E)** | **183** | **91** | **45** | **183** |

Ladi pav oil includes brushing the tops after baking. Pav carries less preservative (3-day
best-before) than bread.

### 3.3 Burger buns (one shared dough) and pizza base - quantity per mix

**Shared bun dough, per 10 kg of flour:** sugar 1 kg, shortening 0.5 kg, yeast 0.35 kg, salt 0.16 kg,
milk powder 0.2 kg, improver 0.05 kg, calcium propionate 0.03 kg, oil 0.1 litre for the trays,
water 5.5 litres. What differs:

| | FG05 Plain | FG06 Sesame | FG07 Whole wheat | FG08 Jumbo |
|---|---|---|---|---|
| Flour | 10 kg maida | 10 kg maida | 2.5 kg maida + 7.5 kg atta | 10 kg maida |
| Water | 5.5 litres | 5.5 litres | 6.1 litres | 5.5 litres |
| Improver | 0.05 kg | 0.05 kg | 0.06 kg | 0.05 kg |
| Topping | none | 0.45 kg sesame (about 1.5 g a bun) | none | none |
| Dough piece | 57 g | 57 g | 58 g | 86 g |
| Baked bun | 50 g | 50 g | 50 g | 75 g |

| Material | FG05 Plain | FG06 Sesame | FG07 Whole wheat | FG08 Jumbo | FG09 Pizza base |
|---|---:|---:|---:|---:|---:|
| RM01 Maida | 10 | 10 | 2.5 | 10 | 15 |
| RM02 Atta | - | - | 7.5 | - | - |
| RM03 Sugar | 1 | 1 | 1 | 1 | 0.45 |
| RM04 Shortening | 0.5 | 0.5 | 0.5 | 0.5 | - |
| RM07 Oil (litre) | 0.1 | 0.1 | 0.1 | 0.1 | 0.6 |
| RM08 Yeast | 0.35 | 0.35 | 0.35 | 0.35 | 0.3 |
| RM09 Salt | 0.16 | 0.16 | 0.16 | 0.16 | 0.27 |
| RM10 Milk powder | 0.2 | 0.2 | 0.2 | 0.2 | - |
| RM11 Improver | 0.05 | 0.05 | 0.06 | 0.05 | 0.05 |
| RM12 Calcium propionate | 0.03 | 0.03 | 0.03 | 0.03 | 0.05 |
| RM16 Sesame | - | 0.45 | - | - | - |
| Water (not stocked) | 5.5 | 5.5 | 6.1 | 5.5 | 8.15 |
| Dough (kg) | 17.79 | 17.79 | 18.40 | 17.79 | 24.68 |
| Pieces per mix (T) | 76 | 76 | 78 | 50 | 105 |
| **Expected good units (E)** | **74** | **74** | **76** | **49** | **101** |

The whole wheat bun carries 75% atta so that it may be labelled "whole wheat" (source 12); atta takes
more water (61% against 55%) and loses a little more in the oven (13%) (A).

Pizza base: 0.45 litre of the oil (0.41 kg, counted in the 24.68 kg of dough) is in the dough (3% of
flour), 0.15 litre is for the trays. The
bases are docked and par-baked pale; the 3% reject covers blistered, broken and over-coloured bases.

### 3.4 Toast (twice baked), khari (laminated), biscuit and tea cake - quantity per mix

| Material | FG10 Elaichi toast | FG11 Milk toast | FG12 Butter khari | FG13 Jeera khari | FG14 Jeera biscuit | FG15 Tea cake |
|---|---:|---:|---:|---:|---:|---:|
| RM01 Maida | 25 | 50 | 20 | 20 | 15 | 6 |
| RM03 Sugar | 7.5 | 12.5 | - | - | 2.7 | 5.1 |
| RM04 Shortening | 3 | 4 | 1 | 1 | 6 | - |
| RM05 Puff margarine | - | - | 10 | 13 | - | - |
| RM06 Butter | - | 2 | 3 | - | 0.75 | 0.3 |
| RM07 Oil (litre) | 0.15 | 0.3 | - | - | - | 2.1 |
| RM08 Yeast | 0.9 | 1.8 | - | - | - | - |
| RM09 Salt | 0.3 | 0.6 | 0.4 | 0.4 | 0.3 | - |
| RM10 Milk powder | 0.5 | 3 | - | - | 0.3 | 0.72 |
| RM11 Improver | 0.1 | 0.2 | - | - | - | - |
| RM12 Calcium propionate | - | - | - | - | - | 0.03 |
| RM13 Baking powder | - | - | - | - | 0.15 | 0.24 |
| RM14 Cardamom | 0.1 | - | - | - | - | - |
| RM15 Cumin | - | - | - | 0.3 | 0.375 | - |
| RM17 Tutti-frutti | - | - | - | - | - | 1.2 |
| RM18 Flavour (litre) | - | 0.06 | - | - | - | 0.03 |
| Water (not stocked) | 11.1 | 22.7 | 10 | 10 | 2.1 | 5.1 |
| Dough, paste or batter (kg) | 48.50 | 96.86 | 44.40 | 44.70 | 27.68 | 20.63 |
| Out of the last oven (kg) | 33.3 | 65.6 | 29.4 | 29.7 | 23.8 | 18.2 |
| Packable after slicing or breakage (kg) | 31.65 | 62.29 | 28.24 | 28.50 | 23.33 | - |
| Pieces per mix (T) | 125 | 154 | 139 | 141 | 92 | 89 |
| **Expected good units (E)** | **122** | **150** | **134** | **136** | **90** | **86** |

Process notes that explain the numbers:

- **Toast is twice baked.** The sweet dough is scaled at 400 g into long lidded tins, proofed and baked
  like bread (about 30 minutes at 190-200 C), cooled for five to six hours until firm (20-21%
  moisture), sliced at about 14 mm, and the slices are baked again (about 30 minutes at 160-180 C) down
  to 1-2% moisture (sources 2, 13). Dough to finished toast loses about 31-32% of its weight. End
  slices, crumbs and broken slices take another 5%; over-coloured slices are the 2% reject. One
  production entry is made on the day of the second bake and packing; the batch's manufacturing date is
  that day.
- **Milk toast** carries 6% milk powder and 4% butter on flour (A) and has no cardamom.
- **Khari is laminated.** A lean dough (flour, salt, 5% shortening, 50% water) is wrapped around the
  roll-in fat and given folds on the sheeter with rests in between, cut into strips and baked in two
  stages (200 C then 180 C, source 13) until dry. **Butter khari and jeera khari share the dough;**
  they differ only in the roll-in fat and the seed: butter khari uses 10 kg margarine + 3 kg butter,
  jeera khari 13 kg margarine + 0.3 kg cumin. Paste to khari loses about 34% of its weight; khari is
  fragile, so 4% is lost as breakage at packing and 3% is rejected (burnt, or flat pieces that did
  not lift). Strips are cut at about 14 g and bake to about 9 g, about 22 to a 200 g pack (A, the
  count used in `products-prices.md`).
- **Jeera biscuit** is a short dough (creamed fat and sugar, 14% water), sheeted and cut at about 10 g,
  about 30 biscuits to a 250 g pack (A, the count used in `products-prices.md`).
- **Tea cake** is an eggless oil batter; 225 g is deposited into each paper mould and loses 10% in the
  oven. The 3% reject covers sunken, cracked and stuck cakes.

### 3.5 Puffs (one shared puff pastry) - quantity per mix

**Shared puff pastry, per 2.5 kg of flour:** maida 2.5 kg, shortening 0.1 kg (in the dough), salt
0.045 kg, water 1.3 litres, puff margarine 1.375 kg rolled in. That is 5.32 kg of paste, 55 g a puff,
92 puffs. Each puff takes about 35 g of cooked filling. What differs is the filling:

| Material | FG16 Veg puff | FG17 Paneer puff | FG18 Garlic puff |
|---|---:|---:|---:|
| RM01 Maida | 2.5 | 2.5 | 2.5 |
| RM04 Shortening | 0.1 | 0.1 | 0.1 |
| RM05 Puff margarine | 1.375 | 1.375 | 1.375 |
| RM06 Butter | - | - | 0.3 |
| RM07 Oil (litre) | 0.15 | 0.15 | 0.05 |
| RM09 Salt (pastry + filling) | 0.095 | 0.085 | 0.095 |
| RM19 Potato | 2.2 | 0.6 | 2.6 |
| RM20 Onion | 0.6 | 0.8 | 0.4 |
| RM21 Green peas | 0.6 | 0.4 | - |
| RM22 Paneer | - | 1.5 | - |
| RM23 Garlic | - | - | 0.3 |
| RM24 Puff masala | 0.12 | 0.12 | 0.08 |
| Water (not stocked) | 1.3 | 1.3 | 1.3 |
| Cooked filling (kg) | 3.2 | 3.3 | 3.3 |
| Pieces per mix (T) | 92 | 92 | 92 |
| **Expected good units (E)** | **89** | **89** | **89** |

Potato loses 15% in peeling and onion 30% in peeling and cooking (A); the filling weights allow for
that. The garlic puff is a garlic-butter potato filling, about 4.5% garlic in the baked puff (3.3 g in
71 g). Salt is 0.045 kg in the pastry plus 0.05 kg (paneer 0.04 kg) in the filling.

### 3.6 Baker's percentages (flour = 100) for reference

| Family | Water | Sugar | Fat | Yeast (compressed) | Salt | Milk powder | Other |
|---|---:|---:|---:|---:|---:|---:|---|
| Sandwich / jumbo bread | 59 | 4 | 2 shortening | 2.5 | 1.8 | - | improver 0.4, propionate 0.3 |
| Brown bread (50% atta) | 63 | 4 | 2 shortening | 2.8 | 1.8 | - | improver 0.5, propionate 0.3 |
| Ladi pav | 57 | 6 | 4 shortening | 3.0 | 1.6 | 1 | improver 0.4, propionate 0.2 |
| Burger buns | 55 (whole wheat 61) | 10 | 5 shortening | 3.5 | 1.6 | 2 | improver 0.5 (whole wheat 0.6), propionate 0.3, sesame 4.5 on FG06; whole wheat = 75% atta |
| Pizza base | 54 | 3 | 3 oil | 2.0 | 1.8 | - | improver 0.33, propionate 0.33 |
| Elaichi toast | 44 | 30 | 12 shortening | 3.6 | 1.2 | 2 | improver 0.4, cardamom 0.4 |
| Milk toast | 45 | 25 | 8 shortening + 4 butter | 3.6 | 1.2 | 6 | improver 0.4, flavour 0.12 |
| Butter khari | 50 | - | 5 shortening + 50 margarine + 15 butter | - | 2 | - | - |
| Jeera khari | 50 | - | 5 shortening + 65 margarine | - | 2 | - | cumin 1.5 |
| Jeera biscuit | 14 | 18 | 40 shortening + 5 butter | - | 2 | 2 | cumin 2.5, baking powder 1 |
| Tea cake | 85 | 85 | 32 oil + 5 butter | - | - | 12 | baking powder 4, tutti-frutti 20, propionate 0.5, flavour 0.5 |
| Puff pastry | 52 | - | 4 shortening + 55 margarine | - | 1.8 | - | filling 35 g a piece |

### 3.7 Packing per unit sold

| Product | Packing per good unit |
|---|---|
| FG01 Sandwich bread, FG02 Brown bread | 1 x PM01 + 1 x PM08 |
| FG03 Jumbo sandwich loaf | 1 x PM02 + 1 x PM08 |
| FG04 Ladi pav, FG05-FG08 Burger buns, FG09 Pizza base | 1 x PM03 + 1 x PM08 |
| FG10 Elaichi toast, FG14 Jeera biscuit | 1 x PM04 + 1 x PM08 |
| FG11 Milk toast, FG12 Butter khari, FG13 Jeera khari | 1 x PM05 + 1 x PM08 |
| FG15 Tea cake | 1 x PM06 + 1 x PM08 |
| FG16-FG18 Puffs | 1 x PM07 |

Real packing wastage (torn bags, misprinted labels) is about 1-2% (A). The recipe does not carry it;
it appears at the stock count as a count difference, which is what the scope's costing method expects.

### 3.8 The same data in one block (for the generator)

Quantities per mix in the stock unit of each material; `pieces` is T, `expected` is E.

```js
FG01: {materials:{RM01:50,RM03:2,RM04:1,RM07:0.25,RM08:1.25,RM09:0.9,RM11:0.2,RM12:0.15}, pieces:186, expected:183, pack:{PM01:1,PM08:1}},
FG02: {materials:{RM01:12.5,RM02:12.5,RM03:1,RM04:0.5,RM07:0.15,RM08:0.7,RM09:0.45,RM11:0.125,RM12:0.075}, pieces:93, expected:91, pack:{PM01:1,PM08:1}},
FG03: {materials:{RM01:25,RM03:1,RM04:0.5,RM07:0.15,RM08:0.625,RM09:0.45,RM11:0.1,RM12:0.075}, pieces:46, expected:45, pack:{PM02:1,PM08:1}},
FG04: {materials:{RM01:50,RM03:3,RM04:2,RM07:0.5,RM08:1.5,RM09:0.8,RM10:0.5,RM11:0.2,RM12:0.1}, pieces:187, expected:183, pack:{PM03:1,PM08:1}},
FG05: {materials:{RM01:10,RM03:1,RM04:0.5,RM07:0.1,RM08:0.35,RM09:0.16,RM10:0.2,RM11:0.05,RM12:0.03}, pieces:76, expected:74, pack:{PM03:1,PM08:1}},
FG06: {materials:{RM01:10,RM03:1,RM04:0.5,RM07:0.1,RM08:0.35,RM09:0.16,RM10:0.2,RM11:0.05,RM12:0.03,RM16:0.45}, pieces:76, expected:74, pack:{PM03:1,PM08:1}},
FG07: {materials:{RM01:2.5,RM02:7.5,RM03:1,RM04:0.5,RM07:0.1,RM08:0.35,RM09:0.16,RM10:0.2,RM11:0.06,RM12:0.03}, pieces:78, expected:76, pack:{PM03:1,PM08:1}},
FG08: {materials:{RM01:10,RM03:1,RM04:0.5,RM07:0.1,RM08:0.35,RM09:0.16,RM10:0.2,RM11:0.05,RM12:0.03}, pieces:50, expected:49, pack:{PM03:1,PM08:1}},
FG09: {materials:{RM01:15,RM03:0.45,RM07:0.6,RM08:0.3,RM09:0.27,RM11:0.05,RM12:0.05}, pieces:105, expected:101, pack:{PM03:1,PM08:1}},
FG10: {materials:{RM01:25,RM03:7.5,RM04:3,RM07:0.15,RM08:0.9,RM09:0.3,RM10:0.5,RM11:0.1,RM14:0.1}, pieces:125, expected:122, pack:{PM04:1,PM08:1}},
FG11: {materials:{RM01:50,RM03:12.5,RM04:4,RM06:2,RM07:0.3,RM08:1.8,RM09:0.6,RM10:3,RM11:0.2,RM18:0.06}, pieces:154, expected:150, pack:{PM05:1,PM08:1}},
FG12: {materials:{RM01:20,RM04:1,RM05:10,RM06:3,RM09:0.4}, pieces:139, expected:134, pack:{PM05:1,PM08:1}},
FG13: {materials:{RM01:20,RM04:1,RM05:13,RM09:0.4,RM15:0.3}, pieces:141, expected:136, pack:{PM05:1,PM08:1}},
FG14: {materials:{RM01:15,RM03:2.7,RM04:6,RM06:0.75,RM09:0.3,RM10:0.3,RM13:0.15,RM15:0.375}, pieces:92, expected:90, pack:{PM04:1,PM08:1}},
FG15: {materials:{RM01:6,RM03:5.1,RM06:0.3,RM07:2.1,RM10:0.72,RM12:0.03,RM13:0.24,RM17:1.2,RM18:0.03}, pieces:89, expected:86, pack:{PM06:1,PM08:1}},
FG16: {materials:{RM01:2.5,RM04:0.1,RM05:1.375,RM07:0.15,RM09:0.095,RM19:2.2,RM20:0.6,RM21:0.6,RM24:0.12}, pieces:92, expected:89, pack:{PM07:1}},
FG17: {materials:{RM01:2.5,RM04:0.1,RM05:1.375,RM07:0.15,RM09:0.085,RM19:0.6,RM20:0.8,RM21:0.4,RM22:1.5,RM24:0.12}, pieces:92, expected:89, pack:{PM07:1}},
FG18: {materials:{RM01:2.5,RM04:0.1,RM05:1.375,RM06:0.3,RM07:0.05,RM09:0.095,RM19:2.6,RM20:0.4,RM23:0.3,RM24:0.08}, pieces:92, expected:89, pack:{PM07:1}},
```

## 4. Production rhythm

Scope rule: what is produced on day D is dispatched and sent to the stores on the morning of D+1.

### 4.1 Daily lines (every day of the week)

Fresh lines and puffs are made to the next morning's requirement and hold no stock. They are made
seven days a week, because the vans, the stores and several corporates take goods seven days a week
(`products-prices.md` 6.5, 7, 8.2); only a closed day in the event calendar stops them.

Rule: `mixes = round up to the next half mix of ( (next morning's dispatch + corporate deliveries +
store transfers - unexpired stock carried over) x 1.02 / E )`, minimum half a mix; **no mix at all
when the carried-over stock already covers the requirement**. Puffs use quarter mixes and have no
carry-over. The 2% is the planner's safety margin (A).

| Product | Assumed units a day | Mixes a day by the rule | Good units from those mixes |
|---|---:|---:|---:|
| FG01 Sandwich bread | 900 | 5 (4.5 to 5.5) | 915 (823 to 1,006) |
| FG02 Brown bread | 200 | 2 to 2.5 | 182 to 227 |
| FG03 Jumbo sandwich loaf | 120 | 2.5 to 3 | 112 to 135 |
| FG04 Ladi pav | 700 | 4 (3.5 on some days) | 732 (640) |
| FG05 Burger bun, plain | 150 | 2 (2.5 when the carry-over is used up) | 148 (185) |
| FG06 Burger bun, sesame | 80 | 1 to 1.5 | 74 to 111 |
| FG07 Burger bun, whole wheat | 50 | 0.5 to 1 | 38 to 76 |
| FG08 Burger bun, jumbo | 70 | 1.5 (1 on some days) | 73 (49) |
| FG09 Pizza base | 150 | 1.5 (1 to 2) | 151 (101 to 202) |
| FG16 Veg puff | 260 | 3 | 267 |
| FG17 Paneer puff | 130 | 1.5 | 133 |
| FG18 Garlic puff | 110 | 1.5 | 133 |

Because the rule rounds up and then subtracts the carry-over, a fresh line moves between two
neighbouring mix counts and averages `units / E` mixes a day (4.9 for FG01, 2.2 for FG02, 0.66 for
FG07). A puff surplus cannot be carried, so it is written off the next evening: at these volumes
about 7, 3 and 23 puffs a day.

The split of "350 bun packs in all" into 150 / 80 / 50 / 70 and of "500 puffs" into 260 / 130 / 110
is an assumption (A); section 4.3 gives the same rhythm at the volumes of `products-prices.md`. On a
normal day at the brief's volumes the fresh lines take about 20 dough mixes and 6 puff mixes, about
650 kg of flour.

### 4.2 Long-life lines (a few larger runs a week)

| Product | Run days | Runs a week | Assumed packs a week (7 x daily) | Average mixes per run | Mixes by the rule: run before the shorter gap / before the longer gap | Good packs from those mixes |
|---|---|---:|---:|---:|---|---|
| FG10 Elaichi toast | Monday, Wednesday, Friday | 3 | 1,260 | 3.4 | 3 / 4.5 (Friday) | 366 / 549 |
| FG11 Milk toast | Tuesday, Thursday, Saturday | 3 | 1,260 | 2.8 | 2.5 / 3.5 to 4 (Saturday) | 375 / 525 to 600 |
| FG12 Butter khari | Monday, Thursday | 2 | 1,050 | 3.9 | 3.5 (Monday) / 4.5 (Thursday) | 469 / 603 |
| FG13 Jeera khari | Tuesday, Friday | 2 | 1,050 | 3.9 | 3.5 (Tuesday) / 4.5 (Friday) | 476 / 612 |
| FG14 Jeera biscuit | Wednesday, Saturday | 2 | 840 | 4.7 | 4 (Wednesday) / 5.5 (Saturday) | 360 / 495 |
| FG15 Tea cake | Monday, Wednesday, Friday | 3 | 700 | 2.7 | 2.5 / 3.5 (Friday) | 215 / 301 |

A run is sized for the days until the next one, so the run before the longer gap (a weekend, or four
days instead of three) is the bigger one. Rounding up leaves a small surplus, so now and then a run
comes out half a mix smaller than shown.

No long-life run on a Sunday or a factory holiday; a run that falls on a holiday moves to the next
working day (A). The weekday pattern is the rule, so it holds for any date.

Rule for the size of a run (order-up-to):
`units needed = average daily demand over the last 14 days x (target cover days + days until the next
scheduled run) - unexpired stock on hand after that morning's dispatch`; `mixes = units needed / E,
rounded up to the next half mix`, minimum 1 mix, maximum 5 mixes for toast and khari, 6 for biscuit,
4 for tea cake (A). **If units needed is zero or less, the run is skipped.** In the first 14 days of
January 2026 the average is taken over the days so far, and on 1 January it is the normal-day volume.
Target cover is in section 5.

Equipment behind the mix sizes (A): one spiral mixer taking 50 kg of flour, one taking 25 kg, a
planetary mixer for biscuit dough and cake batter, a dough sheeter for khari and puffs, two rotary
rack ovens. Fresh lines are baked in the afternoon and evening; long-life lines use the ovens in the
morning, and the toast's second bake runs in the same day's last oven slot.

### 4.3 The same rhythm at the volumes of `products-prices.md`

The brief's rough volumes above are well over what Rs 1.1 lakh a day needs. `products-prices.md`
(section 10, note 3) sets the production a normal day really requires; the recipes and both rules are
unchanged, only the mix counts fall. These are the figures the generator should land near.

| Product | Units a day to make | Mixes a day, average | Mixes on a given day, by the rule of 4.1 |
|---|---:|---:|---|
| FG01 Sandwich bread | 490 | 2.7 | 2.5 or 3 |
| FG02 Brown bread | 145 | 1.6 | 1.5 or 2 |
| FG03 Jumbo sandwich loaf | 135 | 3.0 | 3 or 3.5 |
| FG04 Ladi pav | 510 | 2.8 | 2.5 or 3 |
| FG05 Burger bun, plain | 170 | 2.3 | 2 or 2.5 |
| FG06 Burger bun, sesame | 52 | 0.7 | 0.5 or 1 |
| FG07 Burger bun, whole wheat | 26 | 0.35 | 0.5 on two days in three, none on the third |
| FG08 Burger bun, jumbo | 68 | 1.4 | 1 or 1.5 |
| FG09 Pizza base | 160 | 1.6 | 1.5 or 2 |
| FG16 Veg puff | 545 | 6.25 | 6.25 (556 good) |
| FG17 Paneer puff | 150 | 1.75 | 1.75 (155 good) |
| FG18 Garlic puff | 155 | 2.0 | 2 (178 good) |

| Product | Packs a day sold | Packs a week | Runs a week | Mixes per run, by the rule of 4.2 |
|---|---:|---:|---:|---|
| FG10 Elaichi toast | 146 | 1,022 | 3 | 2 to 2.5, and 3.5 to 4 on Friday |
| FG11 Milk toast | 57 | 399 | 3 | 1 (1.5 on a few Saturdays); about one run in eight is skipped |
| FG12 Butter khari | 103 | 721 | 2 | 2 to 2.5 on Monday, 3 to 3.5 on Thursday |
| FG13 Jeera khari | 53 | 371 | 2 | 1 to 1.5 on Tuesday, 1.5 to 2 on Friday |
| FG14 Jeera biscuit | 50 | 350 | 2 | 1.5 to 2 on Wednesday, 2 to 2.5 on Saturday |
| FG15 Tea cake | 91 | 637 | 3 | 2 to 2.5, and 3 to 3.5 on Friday |

At these volumes a normal day takes about 16 dough mixes and 10 puff mixes on the daily lines and
about 570 kg of flour in all (section 7.2). Every mix count stays inside the mixer sizes and the
maxima of 4.2; milk toast, jeera khari and the whole wheat bun are the lines where one mix is more
than a day's or a run's need, which the carry-over and skip clauses handle.

## 5. Shelf life and finished stock held

Best-before days are fixed by the scope. Manufacturing date = the production date D; best-before date
= D + best-before days. A batch can be dispatched or sold up to and including its best-before date
and never after it. This matters for puffs: made on D, best-before D+1, dispatched and sold on D+1.

| Product | Best before (days, scope) | Dispatched | Life left at dispatch | Finished stock normally held | Target cover used in the run rule |
|---|---:|---|---:|---|---:|
| FG01, FG02, FG03 Bread | 4 | D+1 | 3 days (2 for carried-over stock) | none; at most one day's carry-over | - |
| FG04 Ladi pav | 3 | D+1 | 2 days (1 for carried-over stock) | none; at most one day's carry-over, under half a mix | - |
| FG05-FG08 Burger buns | 4 | D+1 | 3 days (2 for carried-over stock) | none; at most one day's carry-over, two on the slowest bun | - |
| FG09 Pizza base | 5 | D+1 | 4 days (3 for carried-over stock) | none; at most two days' carry-over | - |
| FG10, FG11 Toast | 90 | from stock | about 80 days or more | 7 to 10 days of sales | 7 days |
| FG12, FG13 Khari | 90 | from stock | about 80 days or more | 6 to 10 days of sales | 6 days |
| FG14 Jeera biscuit | 60 | from stock | about 48 days or more | 8 to 12 days of sales | 8 days |
| FG15 Tea cake | 15 | from stock | about 9 days or more | 3 to 6 days of sales | 3 days |
| FG16-FG18 Puffs | 1 | D+1 | sold the same day | none; unsold puffs are written off | - |

- "Finished stock normally held" follows from the run rule of 4.2: stock is at the target cover just
  before a run's output comes in and at the cover plus the days to the next run just after. A pack
  therefore leaves the factory within about 10 days of being made (toast, khari), 12 (biscuit) or 6
  (tea cake), which gives the "life left" column. A slow line whose smallest run is more than its need
  (milk toast at the volumes of 4.3) can reach 12 days of stock.
- The 10 days of finished stock in the NIFTEM rusk project norm (source 3) is the anchor for the
  long-life cover; khari is held a little shorter because it breaks in storage, tea cake much shorter
  because of its 15 days (A).
- Fresh-line stock left at the factory after the morning dispatch goes out first the next day (oldest
  unexpired batch first). Stock that has passed its best-before date becomes a write-off request.
- Opening finished stock on 1 January 2026 (for the opening-entries topic): one day's production of
  each fresh line and of puffs with manufacturing date 31 December 2025, and the target cover of each
  long-life line in two or three batches made in the last ten days of December 2025.
- Trade shelf-life references for the scope's figures: bread 3-5 days, pav 2-3, buns 3-4, rusk and
  toast 2-4 months (scope section 11).

## 6. Yield behaviour

### 6.1 A normal day

Good units move a little around the expected figure because dough pieces are divided by a machine,
the oven-out moisture of dry products drifts, and the number of rejects changes from batch to batch.

For a production entry of `m` mixes of a product with T pieces per mix and normal reject rate `r`:

```
made      = T x m x (1 + u)          u uniform in [-a, +a]
rejected  = round( made x r x v )    v uniform in [0.5, 1.6]
good      = round(made) - rejected
expected  = E x m
yield %   = good / expected
```

| Products | a (drift in pieces made) | r (normal reject) | Normal yield band |
|---|---:|---:|---|
| FG01, FG03 White tin bread | 0.5% | 1.5% | 98.7% to 102% |
| FG02 Brown bread | 0.6% | 2% | 98.3% to 101.8% |
| FG04 Ladi pav, FG05-FG08 Burger buns | 0.8% | 2% | 98% to 102.5% |
| FG09 Pizza base | 1.0% | 3% | 98% to 103.5% |
| FG10, FG11 Toast | 1.5% | 2% | 97.7% to 103.2% |
| FG12, FG13 Khari | 2.0% | 3% | 96.7% to 104.2% |
| FG14 Jeera biscuit | 1.2% | 2% | 97.5% to 102.5% |
| FG15 Tea cake | 1.0% | 3% | 97.5% to 103% |
| FG16-FG18 Puffs | 1.5% | 3% | 96.9% to 103.5% |

The bands are the extremes of the formula above, before rounding to whole units; the mean yield is
99.9-100.7% by construction (E is T less the normal reject, rounded down; the mean of `v` is 1.05).
Random draws must come from the seeded generator keyed on the
date and the product, so that the seed for one business date is the beginning of the seed for a later
one. Total physical rejects of about 2% of output sit between the 1-1.5% reported for small and
medium bakeries and the 3-5% for large ones (source 22) and below the 4% wastage of the rusk project
norm (source 3).

Rejects have no stock value: they are crumbed, given away or sold as feed, and no document is raised.

### 6.2 Bad runs (two causes, as rules)

**Cause 1 - heat: over-proofing and soft lamination fat.** Yeast doughs proof too fast in a hot
bakery and a rack of loaves or buns collapses or bakes flat; puff margarine softens, leaks during
baking and the khari or puffs do not lift. Puff pastry wants a cool room (10-20 C in the production
area, roll-in fat at 16 C, source 6; 12-16 C for the working area and dough, source 23) and Anand's
bakery floor is far above that from March to June (A).

| Line | Chance per production entry, March-June | July-September | October-February | Effect on that entry |
|---|---:|---:|---:|---|
| FG01-FG09 yeast lines (each product separately) | 2% | 1% | 0.5% | reject rate 6-12% instead of the normal rate |
| FG12, FG13 Khari (each run) | 10% | 4% | 3% | reject rate 8-15% |
| FG16-FG18 Puffs (each product, each day) | 3% | 1.5% | 1% | reject rate 10-20% |

Every chance and effect in this table is (A). The reject rate of a bad run is drawn uniformly from the
range shown and replaces `r x v` in the formula of 6.1.

**Cause 2 - oven fault.** A burner or thermostat failure, or a power trip in the middle of a bake,
spoils what is in the oven: under-baked or burnt. Chance 0.8% per production day in any month (about
three a year) (A). One product baked that day, picked in proportion to its mixes, loses 60-100% of
ONE mix: rejected = T x (0.6 to 1.0).

**Optional third cause - monsoon humidity** (15 June to 30 September): toast, khari and biscuit take
up moisture, need a longer second bake and break more. Chance 12% per long-life run in that period,
2% otherwise; yield 3-6% below expected (A).

Rules that keep the seed consistent:

- **Make-up mix.** When a bad run hits a daily line, the supervisor makes extra mixes the same day
  (rounded up to the next half mix, quarter mix for puffs) so that good units still cover the next
  morning's requirement.
  The production entry shows more mixes for the same good units: yield falls to about 90-94% on a
  product that runs four or five mixes and to 50-70% on a one-mix product that loses most of its mix,
  and the shortfall is the production loss. The next morning's dispatch is never short because of a
  bad run.
- Long-life lines are not re-run; the stock cover absorbs the shortfall and the next run is larger by
  the order-up-to rule.
- Bad runs are drawn per date and product from the seeded generator, never from a list of dates.
- Expected size in the P&L: normal-day shortfalls of about 0.3% of material cost plus bad runs of
  about 0.2%, so production loss is about 0.5% of material cost in a normal month and visibly higher
  in March-June (A).

## 7. Derived checks at the assumed volumes

### 7.1 At the brief's rough volumes (section 4.1 and 4.2)

Average material use a day if every product is made exactly to the assumed daily volume (units / E
mixes, no rounding to half mixes). Real use is a little higher - roughly 1-3% (A) - because the puff
surplus, expired carry-over and bad runs are made but not sold; a fresh-line surplus that is carried
over is not extra use.

| Code | Material | Per day | Per 30 days |
|---|---|---:|---:|
| RM01 | Maida | 783 kg (about 16 bags) | 23,490 kg |
| RM02 | Whole wheat atta | 32 kg | 970 kg |
| RM03 | Sugar | 68 kg | 2,030 kg |
| RM04 | Bakery shortening | 38 kg | 1,130 kg |
| RM05 | Puff margarine | 33 kg | 1,000 kg |
| RM06 | Butter | 7.5 kg | 225 kg |
| RM07 | Refined oil | 9.0 litres | 270 litres |
| RM08 | Yeast, compressed | 20.8 kg | 625 kg |
| RM09 | Salt | 13.9 kg | 415 kg |
| RM10 | Skimmed milk powder | 8.5 kg | 255 kg |
| RM11 | Bread improver | 3.0 kg | 91 kg |
| RM12 | Calcium propionate | 1.75 kg | 53 kg |
| RM13 | Baking powder | 0.48 kg | 14 kg |
| RM14 | Cardamom powder | 0.15 kg | 4.4 kg |
| RM15 | Cumin seed | 0.83 kg | 25 kg |
| RM16 | Sesame seed | 0.49 kg | 15 kg |
| RM17 | Tutti-frutti | 1.4 kg | 42 kg |
| RM18 | Flavour essence | 0.11 litre | 3.2 litres |
| RM19 | Potato | 10.5 kg | 316 kg |
| RM20 | Onion | 3.4 kg | 102 kg |
| RM21 | Green peas, frozen | 2.3 kg | 70 kg |
| RM22 | Paneer | 2.2 kg | 66 kg |
| RM23 | Garlic, peeled | 0.37 kg | 11 kg |
| RM24 | Puff masala | 0.62 kg | 19 kg |
| PM01 | Bread bag, 400 g | 1,100 | 33,000 |
| PM02 | Bread bag, 800 g | 120 | 3,600 |
| PM03 | Pav / bun bag | 1,200 | 36,000 |
| PM04 | Pouch, small | 300 | 9,000 |
| PM05 | Pouch, large | 480 | 14,400 |
| PM06 | Cake pack | 100 | 3,000 |
| PM07 | Puff paper | 500 | 15,000 |
| PM08 | Date label | 3,300 | 99,000 |

Flour per unit sold (maida + atta, at E): sandwich bread 273 g, brown bread 275 g, jumbo loaf 556 g,
ladi pav 273 g, bun packs 132-135 g (jumbo 204 g), pizza base 149 g, elaichi toast 205 g, milk toast
333 g, khari 147-149 g, jeera biscuit 167 g, tea cake 70 g, a puff 28 g.

That is about 815 kg of flour a day; flour is the largest material line, then fats (shortening,
margarine, butter: about 78 kg a day), sugar and yeast. These volumes are the brief's and are too
high for Rs 1.1 lakh a day: at the average realisations of `products-prices.md` 9.1 they would sell
for roughly Rs 1.5 lakh. Use 7.2 for sizing.

### 7.2 At the production volumes of `products-prices.md`

The same calculation at the normal-day production of `products-prices.md` section 10, note 3 (the
volumes of section 4.3), which is what a day of about Rs 1.09 lakh of sales needs. Opening stock,
reorder levels and the purchase topic should be sized from this table.

| Code | Material | Per day | Per 30 days |
|---|---|---:|---:|
| RM01 | Maida | 547 kg (about 11 bags) | 16,420 kg |
| RM02 | Whole wheat atta | 22.5 kg | 675 kg |
| RM03 | Sugar | 44.4 kg | 1,330 kg |
| RM04 | Bakery shortening | 23.5 kg | 705 kg |
| RM05 | Puff margarine | 25.9 kg | 775 kg |
| RM06 | Butter | 4.3 kg | 130 kg |
| RM07 | Refined oil | 8.0 litres | 240 litres |
| RM08 | Yeast, compressed | 14.4 kg | 430 kg |
| RM09 | Salt | 10.0 kg | 300 kg |
| RM10 | Skimmed milk powder | 5.0 kg | 150 kg |
| RM11 | Bread improver | 2.1 kg | 63 kg |
| RM12 | Calcium propionate | 1.28 kg | 38 kg |
| RM13 | Baking powder | 0.34 kg | 10 kg |
| RM14 | Cardamom powder | 0.12 kg | 3.6 kg |
| RM15 | Cumin seed | 0.33 kg | 10 kg |
| RM16 | Sesame seed | 0.32 kg | 9.5 kg |
| RM17 | Tutti-frutti | 1.27 kg | 38 kg |
| RM18 | Flavour essence | 0.05 litre | 1.6 litres |
| RM19 | Potato | 19.0 kg | 570 kg |
| RM20 | Onion | 5.7 kg | 172 kg |
| RM21 | Green peas, frozen | 4.35 kg | 130 kg |
| RM22 | Paneer | 2.5 kg | 76 kg |
| RM23 | Garlic, peeled | 0.52 kg | 16 kg |
| RM24 | Puff masala | 1.08 kg | 32 kg |
| PM01 | Bread bag, 400 g | 635 | 19,050 |
| PM02 | Bread bag, 800 g | 135 | 4,050 |
| PM03 | Pav / bun bag | 986 | 29,580 |
| PM04 | Pouch, small | 196 | 5,880 |
| PM05 | Pouch, large | 213 | 6,390 |
| PM06 | Cake pack | 91 | 2,730 |
| PM07 | Puff paper | 850 | 25,500 |
| PM08 | Date label | 2,256 | 67,680 |

About 570 kg of flour a day (547 maida + 22.5 atta) and about 54 kg of fats. Those mixes give about
850 kg of finished goods a day at the pack weights of this file, in line with the "about 830 kg" of
`products-prices.md`; `people-overheads.md` uses the flour figure for its volume factor `V(M)` and
the daily use for its opening stock in days.

## 8. Sources

Opened on 2 October 2026.

1. NIFTEM (PMFME), "Processing of Bread Making" - milk bread formulation, 12% extra dough weight,
   proofing and baking conditions, flour protein:
   http://www.niftem-t.ac.in/pmfme/breadmet.pdf
2. NIFTEM (PMFME), "Processing of Rusk" write-up - sample rusk recipe (flour 72 kg ...), sponge and
   dough steps, moisture after each stage, slice thickness, second bake:
   https://niftem.ac.in/newsite/pmfme/wp-content/uploads/2022/07/ruskwriteup.pdf
3. NIFTEM (PMFME), "Detailed Project Report of Rusk Making" - wastage 4%, finished stock 10 days, raw
   material stock 10 days:
   https://niftem.ac.in/newsite/pmfme/wp-content/uploads/2022/07/ruskdpr.pdf
4. NIFTEM (PMFME), bakery handbook - yeast 2-3% in a straight dough; calcium propionate for bread,
   potassium sorbate for cakes:
   https://niftem-t.ac.in/olapp/pmfme/upload/mt_handbook_bake.pdf
5. BAKERpedia, "Hamburger Bun" - formula in baker's percent, bake temperature and time:
   https://bakerpedia.com/processes/hamburger-bun/
6. BAKERpedia, "Puff Pastry" - dough and roll-in formula, folds and rests:
   https://bakerpedia.com/processes/puff-pastry/
7. BAKERpedia, "Calcium Propionate" - usage 0.1-0.3% of flour weight:
   https://bakerpedia.com/ingredients/calcium-propionate/
8. Busby's Bakery School, "How much weight does bread lose when baked?" - 12-13% in commercial plants,
   15-20% for small bakers; 485 g of dough for a small white tin loaf of 420 g cooled, 950 g for 820 g:
   https://www.busbysbakery.com/bread-weight-lost-when-baked/
9. King Arthur Baking, professional reference, "Yeast" - fresh yeast x 0.33 = instant yeast:
   https://www.kingarthurbaking.com/pro/reference/yeast
10. Hebbar's Kitchen, ladi pav - 450 g maida gives 12 pav:
    https://hebbarskitchen.com/eggless-ladi-pav-recipe-pav-bread-recipe/
11. Baking Industry Research Trust (New Zealand), "Puff pastry" - full, three-quarter and half paste,
    about 130 layers, bake at 220 C:
    https://www.bakeinfo.co.nz/facts/flour-based-products/pastry/puff-pastry/
12. Agro & Food Processing, report on the FSSAI bread labelling rules - brown bread 50% whole wheat,
    whole wheat bread 75%, garlic bread 2% garlic:
    https://agronfoodprocessing.com/food-safety-authority-comes-out-with-new-regulations-for-bread/
    The same site reports the rules as the Labelling and Display (Second Amendment) Regulations, 2022,
    in force from 1 May 2023:
    https://agronfoodprocessing.com/fssai-publishes-guidelines-for-bread-labelling-and-a-statement-about-pan-masala/
13. NCDC, sample detailed project report for a bakery unit (khari, rusk, atta biscuit) - process and
    baking temperatures for khari and rusk, 500 kg a day product mix:
    https://www.ncdc.in/documents/downloads/12150805204.Sample-DPR_BAKERY-UNIT.pdf
14. IndiaMART listing, printed polypropylene bread pouch - 400 g capacity, 25 micron, Rs 245 a kg:
    https://www.indiamart.com/proddetail/pp-bread-packaging-pouch-25094002412.html
15. Blinkit listing, burger bun 200 g, 4 pieces, Rs 40:
    https://blinkit.com/prn/english-oven-burger-bun-200-g/prid/18405
16. IndiaMART category page, pav and ladi pav - at re-check: 12 pieces 400 g; 12 pieces 300 g; "Bombay
    pav" 400 g; whole wheat ladi pav 12 pieces 500 g (the listings on this page change):
    https://dir.indiamart.com/impcat/pav-bun.html
17. Blinkit listing, pizza base 200 g, 2 pieces, Rs 50:
    https://blinkit.com/prn/english-oven-pizza-base/prid/18736
18. Khari recipe on a khari maker's blog - puff margarine, two-stage bake 180 C then 160 C:
    https://www.dipfoods.com/blog/the-khari-biscuit-recipe-that-is-perfect-for-your-next-tea-break/
19. Aromatic Essence, jeera biscuits - 160 g flour, 113 g butter, 35 g sugar, about 18 biscuits:
    https://aromaticessence.co/jeera-biscuits-indian-cumin-cookies/
20. Neha's Cook Book, Surti jeera biscuit - 300 g fat to 250 g flour, 22 biscuits:
    https://www.nehascookbook.com/surti-makhania-biscuit-recipe-surti-jeera-biscuit-recipe-farmas-biscuit-recipe-home-made-butter-biscuit/
21. Egg-free tea-time cake premix, maker's recipe as listed by a bakery-supplies seller - 1000 g
    premix, 450 g water, 120 g oil; 5 kg pack Rs 1,020:
    https://sweetkraft.com/products/egg-free-tea-time-cake-mix-vanilla-flavoured-premix-pillsbury-1
22. M. Iakovlieva, "Food waste in bakeries - quantities, causes and treatment", Swedish University of
    Agricultural Sciences, 2021 - production waste 1-1.5% in small and medium bakeries, 3-5% in large
    ones (2-5% in one respondent's answer); causes:
    https://stud.epsilon.slu.se/17180/1/Iakovlieva-m-210826.pdf
23. Delta Wilmar, "Margarines for puff pastry" - recommended working-area and dough temperature
    12-16 C (seen in the search listing only; the page refused the request again at re-check, so the
    figure rests on source 6, which was opened and gives 10-20 C for the production area):
    https://www.deltawilmar.com/en/margarin-dlya-sloenogo-testa/

Not found in the public record and therefore assumed (A): commercial ladi pav, pizza base, jeera
biscuit and scratch eggless tea cake formulas in baker's percent; khari and biscuit piece weights;
the filling recipes; reject rates by product; the chance and size of bad runs; mixer sizes; packing
dimensions; the split of buns and puffs by variant; the water and bake loss of the 75% atta bun. The
dough-to-product weight losses for toast, khari and biscuit are calculated from ingredient moisture
and an assumed process loss, not quoted.

## 9. Points for the reconciliation step

1. **Sign of production loss.** With E set after the normal reject, good units exceed expected on
   about half the days. Either treat production loss as a signed yield variance (a small gain on good
   days) or book only shortfalls; the first keeps stock value and the P&L in step. The scope says
   "shortfall", so the engine must choose.
2. **Half and quarter mixes.** The rhythm assumes the production entry accepts 0.5 steps, and 0.25
   steps for the three puffs (a quarter mix is 22 good puffs). If it must be whole numbers, halve the
   mix sizes of FG02, FG03, FG06-FG09 and quarter those of the puffs. With half-mix steps on puffs the
   rounding surplus, which cannot be sold a day later, would be up to 44 puffs a variant a day.
3. **Puff best-before.** A one-day best-before works only if a batch may be dispatched and sold on
   its best-before date (section 5). `products-prices.md` section 2 reads it the same way.
4. **Volumes.** Sections 4.1, 4.2 and 7.1 use the brief's rough figures; sections 4.3 and 7.2 use the
   production volumes of `products-prices.md`, which are about 30% lower in flour and are the ones
   that match Rs 1.1 lakh a day. If volumes move again, only the mixes per day or per run change, not
   the recipes.
5. **Prices** of the 32 materials belong to the materials-price topic and must use these codes and
   stock units (oil and flavour in litres, yeast as compressed yeast in kg, packing in pieces).
6. **Pack weights not printed in the scope** (ladi pav about 400 g, buns 200 g and 300 g, pizza base
   200 g, puff about 70 g) are market-anchored assumptions for the item master. Three of them differ
   from `products-prices.md` section 2, which says the recipe file's weights replace its own: ladi pav
   400 g here against 360 g there; jumbo bun pack 300 g against 320 g; every puff about 70 g against
   80 g for veg and paneer and 70 g for garlic. The item master should carry this file's weights;
   E per mix is built on them.
7. **Pack type of khari and biscuit.** `products-prices.md` describes butter khari, jeera khari and
   jeera biscuit as a "box"; the material master here packs them in printed pouches (PM04, PM05), as
   the brief lists, and has no carton. With the 32-item limit used up, the item master should say
   "pouch" for these three, or a carton must replace another packing item.
8. **Whole wheat bun.** FG07 was first drawn at 50% atta, which the FSSAI labelling rule calls
   "brown" or "wheat", not "whole wheat". It is now 75% atta so that the scope's product name is
   safe. If the rule is held not to reach buns, 50% would also do, and E would be 75 with 5.9 litres
   of water.
9. **Fresh-line carry-over.** The daily rule lets surplus bread, pav and buns go out a day later,
   oldest first (scope 4.5), with one day less life. If the seed should never dispatch stock with less
   than two days left, the generator must write that stock off instead and the mix counts of 4.3 rise
   slightly.
