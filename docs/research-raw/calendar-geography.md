# Demand calendar, customers and geography - research parameters

Researched on 2 October 2026 for the Happy Bakers sample (scope v0.3). Happy Bakers is fictional.
A date or figure taken from a page that was opened carries a source key in square brackets; the URLs are
in section 14. Where the public record is silent the value is an **assumption**, marked (A).
**Every demand multiplier in this file is (A).** Money is in rupees, before GST unless stated.

Every parameter is a **rule that holds for any date from 1 January 2026 to 31 December 2027**: each
festival, season and vacation is given for both years, and nothing depends on where the simulation ends.

All customer and shop names are invented. Localities and roads are real place names.

Reviewed on 2 October 2026: the cited pages were re-opened where they would open (festival dates, the
university and school calendars, the wedding dates, the census, the climate page, the distances, the
rain reports; section 14 says where a page would not), every
total, day count and check character was recomputed, section 12 was rebuilt day by day, and the file
was checked against the scope and the other three research files. What that changed: seven invented
names that turned out to match or closely resemble a real business (8.6, 9.1; one GSTIN follows its
new name); the school canteen is now closed on the two Eids like on every other public holiday (rows
E09 and E12, and C09 in section 12); bills keep their date on a closed day (3.1); 1 August 2026 is an
assumed heavy-rain day, not a recorded one (6.2); the extra lunar month of 2026 starts on 17 May (5);
the note on van kilometres follows the revised `people-overheads.md` (10.2). No date, multiplier,
distance or total other than these changed.

This file sits on top of `products-prices.md` (same folder). It keeps that file's ids (O01-O40, C01-C10,
S1-S3), outlet types and sizes, standing orders, day-of-week factors and month factors, and adds the
calendar, the names, the terms and the geography. It follows `people-overheads.md` for the five
vehicles, the drivers and the split of 24 cash and 16 weekly outlets, and `recipes-yields.md` for the
rule that what is baked on one day is dispatched the next morning. The few places where it changes a
rule of another file are listed in section 13.

Headline results:

- 32 dated event rows (section 3), 2 or 3 closed days a year at Diwali, a college and a school calendar,
  a wedding calendar for the caterers, a rain rule and a summer rule.
- Applied to the sales of `products-prices.md` section 9 they take about **2.0% off 2026 and 1.5% off
  2027**: about **Rs 3.95 crore for 2026 and Rs 4.13 crore for 2027** (section 12). "About Rs 4 crore,
  about Rs 1.1 lakh a day" still holds.
- 40 outlets on 4 routes (13 / 11 / 9 / 7 stops), 24 cash on delivery and 16 weekly (four of them slow
  payers); the four route vans leave at 05:30 and a fifth vehicle for stores and corporates at 06:00;
  together they cover 205 km a day and are all back by 08:50.

---

## 0. Conventions

**Channels.** R = retail outlets, C = corporates, S = own stores.

**Product groups** (used wherever a multiplier differs by product):

| Group | Items |
|---|---|
| BR - bread and pav | Sandwich bread, brown bread, jumbo sandwich loaf, ladi pav |
| BN - buns and pizza base | The four burger buns, pizza base |
| DRY - toast, khari and dry bakery | Elaichi toast, milk toast, butter khari, jeera khari, jeera biscuit, tea cake |
| PF - puffs | Veg puff, paneer puff, garlic puff (own stores and corporates only) |

**Corporate classes** (a corporate multiplier applies to every line of the order):

| Class | Customers |
|---|---|
| IC - industrial canteen | C01, C02 |
| HM - hostel mess | C03, C04 |
| HK - hospital kitchen | C05 |
| CT - caterer | C06, C07 |
| HT - hotel | C08 |
| SC - school canteen | C09 |
| CF - cafe | C10 |

**How the factors compose.** For a date D the generator multiplies:

```
retail line  = standing units x day-of-week (products-prices 6.5) x month (products-prices 6.5)
               x month-part (7.2) x events (3) x campus vacation (4.3, five outlets only)
               x summer (6.1) x rain (6.2) x noise
store line   = normal-day units x day-of-week (products-prices 8.2) x month x month-part (7.2)
               x events (3) x college calendar (4.3, S2 only) x summer (6.1) x rain (6.2) x noise
corporate    = typical order, on the days of its pattern (products-prices 7)
               x calendar factor (4.3) x caterer or hotel season (5) x events (3) x rain (6.2, heavy days) x noise
```

- **Events multiply.** Every row of section 3 whose dates contain D applies, and the rows are multiplied
  together. Day rows that fall inside a season (Janmashtami inside Shravan, Samvatsari inside Paryushan)
  were set with the season row in mind; do not pick one and drop the other.
- A factor of 0.00 means no document at all for that customer or store on that day.
- Stochastic rounding and noise are as in `products-prices.md`.
- Section 3 is repeated as one machine-readable block in section 11.

---

## 1. Festival and holiday dates, 2026 and 2027

Dates for 2026 are observed or officially listed. Dates for 2027 are from the panchang; the Gujarat
government's 2027 holiday list had not been notified on 2 October 2026. (T) = tentative: Islamic dates
for 2027 depend on the moon and can move by a day.

| Festival | 2026 | 2027 | Source |
|---|---|---|---|
| Uttarayan (kite day; Gujarat keeps 14 January) | Wed 14 Jan | Thu 14 Jan | [H26] [H27] |
| Vasi Uttarayan (second kite day) | Thu 15 Jan | Fri 15 Jan | the day after (A) |
| Republic Day | Mon 26 Jan | Tue 26 Jan | [H26] [H27] |
| Maha Shivratri | Sun 15 Feb | Sat 6 Mar | [D26] [D27] |
| Ramadan (first to last fast, India) | Thu 19 Feb - Fri 20 Mar (30 fasts) | Tue 9 Feb - Tue 9 Mar (T) | [EID26] [RAM27] |
| Holi (Holika Dahan, evening) | Tue 3 Mar | Sun 21 Mar | [D26] [HOLI27] |
| Dhuleti (colours) | Wed 4 Mar | Mon 22 Mar | [H26] [HOLI27] |
| Eid al-Fitr | Sat 21 Mar (observed) | Wed 10 Mar (T) | [EID26] [D27] [H27] |
| Ram Navami (also Swaminarayan Jayanti) | Thu 26 Mar | Thu 15 Apr | [H26] [D27] |
| Mahavir Jayanti | Tue 31 Mar | Mon 19 Apr | [H26] [JAIN27] |
| Eid al-Adha | Thu 28 May (observed) | Mon 17 May (T) | [BAK26] [D27] |
| Rath Yatra | Thu 16 Jul | Mon 5 Jul | [H26] [D27] |
| Shravan month, Gujarati calendar (month ends on the new moon) | Thu 13 Aug - Fri 11 Sep | Tue 3 Aug - Tue 31 Aug | [SHR26] [SHR27] |
| Shravan Mondays | 17, 24, 31 Aug; 7 Sep | 9, 16, 23, 30 Aug | [SHR26]; 2027 by rule |
| Independence Day | Sat 15 Aug | Sun 15 Aug | [H26] [H27] |
| Raksha Bandhan | Fri 28 Aug | Tue 17 Aug | [H26] [D27] |
| Shitala Satam (day before Janmashtami) | Thu 3 Sep | Tue 24 Aug | derived (A) |
| Janmashtami | Fri 4 Sep | Wed 25 Aug | [H26] [D27] |
| Paryushan (Shwetambar, eight days) | Tue 8 Sep - Tue 15 Sep | Sat 28 Aug - Sat 4 Sep | [PAR26] [JAIN27] |
| Samvatsari | Tue 15 Sep | Sat 4 Sep | [PAR26] [JAIN27] |
| Ganesh Chaturthi | Mon 14 Sep | Sat 4 Sep | [D26] [D27] |
| Anant Chaturdashi (immersion) | Fri 25 Sep | Tue 14 Sep | derived from the full moon (A) |
| Navratri (nine nights) | Sun 11 Oct - Mon 19 Oct | Thu 30 Sep - Fri 8 Oct | [NAV26] [NAV27] |
| Dussehra | Tue 20 Oct | Sat 9 Oct | [D26] [D27] |
| Dhanteras | Fri 6 Nov | Wed 27 Oct | [DHAN] |
| Kali Chaudas | Sat 7 Nov | Thu 28 Oct | the day between (A) |
| Diwali | Sun 8 Nov | Fri 29 Oct | [D26] [D27] |
| Padtar divas (gap day) | Mon 9 Nov | none | [H26]: new year is listed two days after Diwali |
| Bestu Varas (Gujarati New Year) | Tue 10 Nov | Sat 30 Oct | [H26] [D27] |
| Bhai Bij | Wed 11 Nov | Sun 31 Oct | [H26] [D27] |
| Labh Pancham | Sat 14 Nov | Wed 3 Nov | [LABH] |
| Christmas | Fri 25 Dec | Sat 25 Dec | [H26] [D27] |

Notes on dates that sources disagree on:

- **Uttarayan 2027.** The panchang puts Makar Sankranti on Fri 15 Jan 2027 [D27]; Gujarat flies kites on
  14 and 15 January every year and the holiday list keeps 14 January [H27]. The table uses 14 and 15.
- **Eid al-Fitr 2026** was Sat 21 March in India: the moon was not seen on 19 March, so Ramadan ran 30
  days [EID26]. The printed holiday list had the same date [H26].
- **Eid al-Adha 2026** was Thu 28 May in most of India [BAK26]; the printed Gujarat list shows 27 May [H26].
- **Eid al-Fitr 2027**: 10 March in [D27] and [H27]; one India-specific forecast gives Ramadan 9 Feb -
  10 Mar and Eid on 11 March [RAM27]. The generator uses 10 March.
- **Dhuleti 2027**: Holika Dahan Sun 21 March and Dhuleti Mon 22 March for Vadodara [HOLI27]; some
  calendars print 22 and 23 March [H27]. The generator uses 21 and 22.
- **Ram Navami 2026**: Thu 26 March [H26] [D26].

---

## 2. Reading of each event (one line each)

| Code | Event | Why demand moves (A) |
|---|---|---|
| E01-E03 | Uttarayan | Two days on the terrace: families stock bread, pav and buns the evening before for sandwiches, dabeli and pav bhaji; factories and schools shut; tea stalls and many kirana shops close by mid-morning; the second day is quiet everywhere. |
| E04 | Republic Day, Independence Day | Plant and school holiday, so no canteen orders; families are out, the stores sell more snacks. |
| E05 | Maha Shivratri | A fast day (farali food, no grain): bread, buns and above all puffs fall for one day. |
| E06-E07 | Holi, Dhuleti | Holi evening is normal. On Dhuleti morning shops stay shut until the colours are over; plants and schools are closed. |
| E08-E09 | Ramadan, Eid al-Fitr | 12% of the district is Muslim [CENSUS]: pav, toast and khari sell a little more for sehri and iftar in those localities; on Eid morning some outlets open late; caterers are busy; schools are closed on Eid. |
| E10 | Ram Navami | Part-day fast and Swaminarayan Jayanti, widely kept in Charotar: a small dip in bread and puffs; schools closed. |
| E11 | Mahavir Jayanti | Public holiday with no measurable effect; only the school canteen is closed. |
| E12 | Eid al-Adha | Pav and buns up slightly on the routes; caterers busy; a school holiday (inside the summer vacation in both years). |
| E13 | Rath Yatra | A local procession day; the stores do slightly better; schools closed. |
| E14-E15 | Shravan | A month of partial fasting, no onion and garlic for many, less eating out; Mondays are fast days. Bread and buns slip, puffs more so (garlic puff most). Dry bakery holds. |
| E16 | Raksha Bandhan | Family visiting day: tea cake, khari and toast for guests; plants and schools closed; hostels empty out. |
| E17 | Shitala Satam | No cooking at home that day: ready food sells, bread and dry bakery included. |
| E18 | Janmashtami | Fast until midnight and fairs: bread, buns and puffs fall; plants and schools closed. |
| E19-E20 | Paryushan, Samvatsari | Jains (0.4% of the district, more in the bazaars [CENSUS]) avoid bakery food for eight days: a small dip everywhere. |
| E21-E22 | Ganesh Chaturthi and the ten days | Evening outings to pandals: a little more pav and buns through stalls, more puffs at the stores. |
| E23 | Navratri | Garba till late for nine nights: food stalls, cafes and caterers take more buns, pav and sandwich bread; the stores sell far more puffs and buns in the evening. |
| E24 | Dussehra | The fafda-jalebi morning: the bakery breakfast is skipped; plants and schools closed. |
| E25 | Diwali run-up | Every house stocks dry snacks for visitors: khari, toast, jeera biscuit and tea cake sell 25-40% more; bread is normal. |
| E26 | Diwali day | Short trading day; bread and puffs down, dry bakery still up; the hospital and the hotel stock up for the closed days. |
| E27 | Closed days | The market, the plants and the bakery are shut from the day after Diwali to Bhai Bij. |
| E28-E30 | Reopening to Labh Pancham and the week after | Many shops stay shut and families are away until Labh Pancham; industrial units restart on Labh Pancham; then demand creeps back. |
| E31 | Christmas | Tea cake and buns for parties; hotel, cafe and caterers busy. Christians are 1.4% of the district [CENSUS]; the NRI visiting season adds to it. |
| E32 | 31 December | Party night: buns, pizza base and puffs at the stores; hotel and cafe at their peak. |

---

## 3. Event multipliers (all (A))

Columns: R-BR, R-BN, R-DRY = retail outlets by product group. S-BR, S-BN, S-DRY, S-PF = own stores by
product group. IC ... CF = corporate classes (section 0). 1.00 = no effect. 0.00 = no delivery, no sale.

| Code | Event | 2026 | 2027 | R-BR | R-BN | R-DRY | S-BR | S-BN | S-DRY | S-PF | IC | HM | HK | CT | HT | SC | CF |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| E01 | Uttarayan eve | 13 Jan | 13 Jan | 1.10 | 1.15 | 1.05 | 1.15 | 1.20 | 1.10 | 1.10 | 1.00 | 1.00 | 1.00 | 1.20 | 1.10 | 1.00 | 1.00 |
| E02 | Uttarayan | 14 Jan | 14 Jan | 0.90 | 1.00 | 0.85 | 1.10 | 1.20 | 0.90 | 1.20 | 0.00 | 0.70 | 1.00 | 1.20 | 1.20 | 0.00 | 0.60 |
| E03 | Vasi Uttarayan | 15 Jan | 15 Jan | 0.80 | 0.85 | 0.80 | 0.90 | 1.00 | 0.90 | 1.00 | 0.50 | 0.70 | 1.00 | 1.00 | 1.10 | 0.00 | 0.70 |
| E04 | Republic Day; Independence Day | 26 Jan; 15 Aug | 26 Jan; 15 Aug | 1.00 | 1.00 | 1.00 | 1.05 | 1.10 | 1.05 | 1.15 | 0.00 | 1.00 | 1.00 | 1.00 | 1.10 | 0.00 | 1.10 |
| E05 | Maha Shivratri | 15 Feb | 6 Mar | 0.85 | 0.85 | 0.95 | 0.85 | 0.85 | 0.95 | 0.75 | 1.00 | 0.85 | 1.00 | 1.00 | 1.00 | 0.00 | 0.85 |
| E06 | Holi (Holika Dahan) | 3 Mar | 21 Mar | 1.00 | 1.00 | 1.00 | 1.05 | 1.05 | 1.05 | 1.05 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| E07 | Dhuleti | 4 Mar | 22 Mar | 0.60 | 0.60 | 0.60 | 0.70 | 0.70 | 0.70 | 0.70 | 0.00 | 0.70 | 1.00 | 1.00 | 1.10 | 0.00 | 0.50 |
| E08 | Ramadan, every day | 19 Feb - 20 Mar | 9 Feb - 9 Mar (T) | 1.04 | 1.03 | 1.06 | 1.02 | 1.02 | 1.03 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| E09 | Eid al-Fitr | 21 Mar | 10 Mar (T) | 0.97 | 1.00 | 0.97 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.20 | 1.00 | 0.00 | 1.00 |
| E10 | Ram Navami | 26 Mar | 15 Apr | 0.95 | 0.95 | 1.00 | 0.93 | 0.95 | 1.00 | 0.90 | 1.00 | 0.90 | 1.00 | 1.00 | 1.00 | 0.00 | 1.00 |
| E11 | Mahavir Jayanti | 31 Mar | 19 Apr | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 0.00 | 1.00 |
| E12 | Eid al-Adha | 28 May | 17 May (T) | 1.05 | 1.05 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.20 | 1.00 | 0.00 | 1.00 |
| E13 | Rath Yatra | 16 Jul | 5 Jul | 1.00 | 1.00 | 1.00 | 1.03 | 1.03 | 1.05 | 1.05 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 0.00 | 1.00 |
| E14 | Shravan, every day | 13 Aug - 11 Sep | 3 Aug - 31 Aug | 0.96 | 0.96 | 1.00 | 0.95 | 0.95 | 1.00 | 0.90 | 1.00 | 0.95 | 1.00 | 1.00 | 1.00 | 1.00 | 0.95 |
| E15 | Shravan Mondays (on top of E14) | 17, 24, 31 Aug; 7 Sep | 9, 16, 23, 30 Aug | 0.95 | 0.97 | 1.00 | 0.93 | 0.95 | 1.00 | 0.90 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| E16 | Raksha Bandhan | 28 Aug | 17 Aug | 1.00 | 1.00 | 1.08 | 1.05 | 1.05 | 1.20 | 1.10 | 0.00 | 0.80 | 1.00 | 1.00 | 1.15 | 0.00 | 0.85 |
| E17 | Shitala Satam | 3 Sep | 24 Aug | 1.08 | 1.05 | 1.12 | 1.10 | 1.05 | 1.15 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| E18 | Janmashtami | 4 Sep | 25 Aug | 0.85 | 0.85 | 0.95 | 0.80 | 0.85 | 1.00 | 0.70 | 0.00 | 0.70 | 1.00 | 1.00 | 1.10 | 0.00 | 0.70 |
| E19 | Paryushan, every day | 8 - 15 Sep | 28 Aug - 4 Sep | 0.98 | 0.98 | 0.98 | 0.97 | 0.97 | 0.97 | 0.93 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| E20 | Samvatsari (on top of E19) | 15 Sep | 4 Sep | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 0.00 | 1.00 |
| E21 | Ganesh Chaturthi | 14 Sep | 4 Sep | 1.02 | 1.02 | 1.00 | 1.03 | 1.05 | 1.05 | 1.10 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| E22 | Ganeshotsav, to Anant Chaturdashi | 15 - 25 Sep | 5 - 14 Sep | 1.02 | 1.02 | 1.00 | 1.00 | 1.03 | 1.00 | 1.05 | 1.00 | 1.00 | 1.00 | 1.05 | 1.00 | 1.00 | 1.00 |
| E23 | Navratri, nine nights | 11 - 19 Oct | 30 Sep - 8 Oct | 1.05 | 1.12 | 1.00 | 1.03 | 1.15 | 1.00 | 1.20 | 1.00 | 1.00 | 1.00 | 1.20 | 1.10 | 1.00 | 1.25 |
| E24 | Dussehra | 20 Oct | 9 Oct | 0.90 | 0.95 | 0.90 | 0.90 | 0.95 | 0.95 | 0.85 | 0.00 | 0.85 | 1.00 | 1.00 | 1.10 | 0.00 | 0.90 |
| E25 | Diwali run-up, the 7 days before Diwali | 1 - 7 Nov | 22 - 28 Oct | 1.00 | 1.00 | 1.25 | 1.00 | 1.00 | 1.40 | 1.05 | 1.00 | 1.00 | 1.00 | 1.10 | 1.10 | 1.00 | 1.00 |
| E26 | Diwali day | 8 Nov | 29 Oct | 0.80 | 0.80 | 1.10 | 0.85 | 0.85 | 1.30 | 0.80 | 0.00 | 1.00 | 2.50 in 2026, 2.00 in 2027 | 1.00 | 2.50 in 2026, 2.00 in 2027 | 1.00 | 0.70 |
| E27 | Closed days, to Bhai Bij | 9, 10, 11 Nov | 30, 31 Oct | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| E28 | Reopening days | 12 - 13 Nov | 1 - 2 Nov | 0.60 | 0.60 | 0.60 | 0.70 | 0.70 | 0.80 | 0.70 | 0.00 | 1.00 | 1.00 | 0.80 | 1.15 | 1.00 | 0.50 |
| E29 | Labh Pancham | 14 Nov | 3 Nov | 0.85 | 0.85 | 0.85 | 0.90 | 0.90 | 0.90 | 0.90 | 0.60 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 0.80 |
| E30 | Six days after Labh Pancham | 15 - 20 Nov | 4 - 9 Nov | 0.93 | 0.93 | 0.93 | 0.96 | 0.96 | 0.96 | 0.96 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| E31 | Christmas eve and Christmas | 24 - 25 Dec | 24 - 25 Dec | 1.00 | 1.05 | 1.08 | 1.05 | 1.15 | 1.15 | 1.15 | 1.00 | 1.00 | 1.00 | 1.20 | 1.20 | 1.00 on 24 Dec, 0.00 on 25 Dec | 1.20 |
| E32 | 31 December | 31 Dec | 31 Dec | 1.05 | 1.10 | 1.00 | 1.10 | 1.25 | 1.05 | 1.25 | 1.00 | 1.00 | 1.00 | 1.20 | 1.30 | 1.00 | 1.30 |

Rules that go with the table.

- **Plant holidays** (IC = 0.00): Uttarayan, Republic Day, Dhuleti, Independence Day, Raksha Bandhan,
  Janmashtami, Dussehra, and from Diwali day to the day before Labh Pancham. The canteens place no order
  for those days. On Vasi Uttarayan and on Labh Pancham the plants run part-staffed (0.50, 0.60).
- **School canteen** (SC = 0.00): every public holiday of the Gujarat list [H26] that has a row in the
  table - the plant holidays above and also Vasi Uttarayan, Maha Shivratri, the two Eids, Ram Navami,
  Mahavir Jayanti, Rath Yatra, Samvatsari and Christmas - besides Sundays and the school vacations
  (section 4). Eid al-Adha falls inside the summer vacation in both years, so its 0.00 changes nothing.
- **Diwali stock-up** (E26): the hospital kitchen (C05) and the hotel (C08) order
  `1 + 0.5 x the number of closed days that follow` times their normal order on Diwali day: 2.50 in 2026
  (three closed days), 2.00 in 2027 (two).
- A weekly or alternate-day order that falls on a closed day is not placed and not carried forward.
- Days that match more than one row: 2026 - 3 and 4 Mar (with Ramadan), 15 Aug, 17, 24, 28, 31 Aug,
  3, 4, 7 Sep (with Shravan), 8 - 11 Sep (Shravan and Paryushan), 14 Sep (Paryushan and Ganesh Chaturthi),
  15 Sep (Paryushan, Samvatsari and Ganeshotsav). 2027 - 6 Mar (Maha Shivratri in Ramadan), 9, 15, 16, 17,
  23, 24, 25 Aug (with Shravan), 28 - 31 Aug (Shravan and Paryushan; 30 Aug is also a Shravan Monday),
  4 Sep (Paryushan, Samvatsari and Ganesh Chaturthi).

Worked examples (events and month-part only; the day-of-week and month factors of `products-prices.md`,
rain and noise come on top):

| Date | Line | Calculation | Result |
|---|---|---|---|
| Fri 4 Sep 2026 (Janmashtami, in Shravan, day 4 of the month) | Retail, bread and pav | 0.96 x 0.85 x 1.03 | 0.84 |
| same day | Stores, puffs | 0.90 x 0.70 x 1.08 | 0.68 |
| Sat 7 Nov 2026 (Diwali run-up, day 7) | Stores, dry bakery | 1.40 x 1.08 | 1.51 |
| Tue 10 Nov 2026 (Bestu Varas) | everything | closed | 0 |
| Thu 15 Oct 2026 (Navratri, day 15) | Retail, buns | 1.12 x 1.00 | 1.12 |
| Mon 30 Aug 2027 (Shravan Monday, Paryushan, day 30) | Stores, puffs | 0.90 x 0.90 x 0.93 x 0.93 | 0.70 |

### 3.1 Closed days and factory holidays (A)

| | 2026 | 2027 |
|---|---|---|
| **Closed days**: no dispatch sheet, no corporate delivery, no store transfer, stores shut, no day-end entry | Mon 9, Tue 10, Wed 11 Nov | Sat 30, Sun 31 Oct |
| **Factory holidays**: no production entry | Sun 8, Mon 9, Tue 10 Nov | Fri 29, Sat 30 Oct |
| The ovens are lit again on (for the next morning's dispatch) | Wed 11 Nov (Bhai Bij) | Sun 31 Oct (Bhai Bij) |
| First dispatch after the break | Thu 12 Nov | Mon 1 Nov |

Rule: closed days run from the day after Diwali to Bhai Bij. A factory holiday is every day whose next
morning has no dispatch, so the factory holidays are the closed days shifted one day earlier. There are
no other closed days or factory holidays in either year: on every other festival the bakery bakes and
the vans run, with smaller loads.

What follows for the generator:

- The dispatch on Diwali morning uses the bake of the day before, as on any day.
- On Diwali day a store is sent only its expected sale of the day (no top-up to par), so that little
  fresh stock is left to expire behind a closed shutter. What is left and is past its best-before when
  the store reopens goes into the first day-end entry after the break as expired units.
- A stale-return credit note, a weekly collection, a receipt, a payment, an approval or a claim
  reimbursement that falls on a closed day moves to the next open day. Purchase receipts are not
  scheduled on closed days.
- **A bill keeps its date**, as in `people-overheads.md` 4: the scope dates the salary bill on the last
  day of the month, and Sunday 31 October 2027 is a closed day. The salary bill and the other month-end
  bills of October 2027 stay dated 31 October, so that October carries its own salaries; only their
  approval and payment move to 1 November.
- "No long-life run on a Sunday or a factory holiday" in `recipes-yields.md` uses the factory holidays
  above. Dry-bakery stock should be built in the two weeks before Diwali for row E25.

---

## 4. School and college calendars

### 4.1 Colleges of Vallabh Vidyanagar (Sardar Patel University term schedule)

The university publishes one schedule for the arts, science, commerce, management, education, law and
home-science colleges [SPU27] [SPU26].

| Period | From | To | Status | Source |
|---|---|---|---|---|
| Second term 2025-26, teaching | (4 Dec 2025) 1 Jan 2026 | Sat 28 Mar 2026 | term | [SPU26] |
| University examinations | Mon 30 Mar 2026 | Sat 25 Apr 2026 | exam | [SPU26] |
| **Summer vacation** | Mon 27 Apr 2026 | Sun 14 Jun 2026 | vacation | [SPU26] (to 13 Jun; term starts Mon 15 Jun) |
| First term 2026-27, teaching | Mon 15 Jun 2026 | Sun 18 Oct 2026 | term | [SPU27] |
| Examinations | Mon 19 Oct 2026 | Wed 4 Nov 2026 | exam | [SPU27] |
| **Diwali vacation** | Thu 5 Nov 2026 | Wed 25 Nov 2026 | vacation | [SPU27] |
| Examinations | Thu 26 Nov 2026 | Wed 16 Dec 2026 | exam | [SPU27] |
| Second term 2026-27, teaching | Thu 17 Dec 2026 | Sat 27 Mar 2027 | term | [SPU27] |
| Examinations | Mon 29 Mar 2027 | Mon 26 Apr 2027 | exam | [SPU27] |
| **Summer vacation** | Tue 27 Apr 2027 | Mon 14 Jun 2027 | vacation | [SPU27] |
| First term 2027-28, teaching | Tue 15 Jun 2027 | Sun 10 Oct 2027 | term | (A): the 2027-28 schedule is not published |
| Examinations | Mon 11 Oct 2027 | Mon 25 Oct 2027 | exam | (A) |
| **Diwali vacation** | Tue 26 Oct 2027 | Mon 15 Nov 2027 | vacation | (A): 21 days from three days before Diwali, as in 2025 and 2026 |
| Examinations | Tue 16 Nov 2027 | Mon 6 Dec 2027 | exam | (A) |
| Second term 2027-28, teaching | Tue 7 Dec 2027 | 31 Dec 2027 | term | (A) |

A date not covered by an exam or vacation row is "term". Postgraduate, pharmacy and architecture
calendars differ by a few weeks [SPU27]; the generator uses the undergraduate rows above for all.

### 4.2 Schools (Gujarat board)

| Period | 2026 | 2027 | Source |
|---|---|---|---|
| Board examinations, classes 10 and 12 | Thu 26 Feb - Mon 16 Mar 2026 | Thu 25 Feb - Wed 17 Mar 2027 | [GSEB26] [SCH27] |
| **Summer vacation** | Mon 4 May - Sun 7 Jun 2026 | Mon 3 May - Sun 6 Jun 2027 | [GSEB26] [SCH27] |
| **Diwali vacation** | Thu 5 Nov - Wed 25 Nov 2026 | Tue 26 Oct - Mon 15 Nov 2027 (A) | [SCH27]; 2027 as in `products-prices.md` 1.5 |

### 4.3 Factors (A)

| Who | Calendar | Term | Exam weeks | Vacation | Reason |
|---|---|---|---|---|---|
| C03 hostel mess, Vallabh Vidyanagar | college | 1.00 | 1.00 | 0.30 | hostels empty in vacation; full, and eating in, during exams |
| C04 hostel mess, Karamsad | college | 1.00 | 1.00 | 0.30 | as C03 |
| C10 cafe, Vallabh Vidyanagar | college | 1.00 | 0.90 | 0.70 | students go out less in exam weeks and are away in vacation |
| S2 store, Vallabh Vidyanagar | college | 1.00 | 0.95 | 0.70 | the student store |
| Campus outlets O14, O17, O20, O23, O24 (route R2) | college | 1.00 | 1.00 | 0.85 | the Vidyanagar bazaars thin out in vacation |
| C09 school canteen | school | 1.00 | 0.80 in board-exam weeks | 0.00 | no canteen in vacation; classes 10 and 12 are away during the boards |

The school summer vacation's effect on households (fewer lunch-box sandwiches) is already inside the
month factors of `products-prices.md` (April 0.96, May 0.92, June 0.97); it is not applied again.

---

## 5. Wedding seasons (caterers and the hotel)

Wedding dates cluster in the windows the panchang allows [WED26] [WED27].

| | 2026 | 2027 |
|---|---|---|
| **Wedding windows** (first to last listed date) | 5 Feb - 12 Mar; 15 Apr - 14 May; 21 Jun - 11 Jul; 21 Nov - 12 Dec | 15 Jan - 14 Mar; 18 Apr - 12 Jul; 10 Nov - 14 Dec |
| Listed wedding dates | 59 | 96 |
| No dates | 1 Jan - 4 Feb (Venus not visible); 13 Mar - 14 Apr; 15 May - 20 Jun (the extra lunar month, 17 May - 15 Jun); 12 Jul - 20 Nov (the monsoon months of Chaturmas); 13 - 31 Dec | 1 - 14 Jan; 15 Mar - 17 Apr; 13 Jul - 9 Nov; 15 - 31 Dec |

Rule for the generator (A) - the **caterer season factor** for C06 and C07, by date, first match wins:

| Order | Condition | Factor | Days in 2026 | Days in 2027 |
|---|---|---|---|---|
| 1 | inside a wedding window | 1.35 | 109 | 180 |
| 2 | NRI visiting season, 15 December - 31 January (receptions, parties and get-togethers even without wedding dates) | 1.20 | 48 | 31 |
| 3 | Chaturmas gap (12 Jul - 20 Nov 2026; 13 Jul - 9 Nov 2027) | 0.70 | 132 | 120 |
| 4 | any other day | 0.90 | 76 | 34 |
| | **Average over the year** | | **1.00** | **1.08** |

- This replaces the month table "caterer season factor" of `products-prices.md` section 7 (yearly average
  1.02), which did not know that 2026 has no wedding dates in January or that 2027 has about 60% more
  dates than 2026 (96 against 59).
- **Hotel C08**: x 1.10 on any day in a wedding window or in the NRI season, on top of its weekend factor
  of 1.20 (banquets).
- Retail outlets and own stores get no wedding factor.

---

## 6. Summer and monsoon

Climate of Anand [WSPARK]: the hot season runs from 6 April to 10 June with average daily highs above
38 C (May: 41 C high, 28 C low). The wet season runs from 19 June to 16 September; wet days per month:
June 6.7, July 13.9, August 12.5, September 7.4 - about 40 a year. The district's south-west monsoon
normal is 687 mm over about 40 rainy days, onset in the third week of June, withdrawal in the fourth
week of September [ANANDRAIN].

The **level** of the season - less bread in the heat, more in the rains and in winter - is already in
the month factors of `products-prices.md`. The rules here only shift the mix and mark the bad days.

### 6.1 Summer rule (A)

From **6 April to 10 June** in both years:

| Channel | BR | BN | DRY | PF | Reason |
|---|---|---|---|---|---|
| Retail outlets | 1.01 | 1.01 | 0.98 | - | less tea, so less toast and khari; cold sandwiches at home |
| Own stores | 1.03 | 1.03 | 0.98 | 0.95 | a hot puff sells less at 41 C; bread and buns for cold meals |
| Corporates | 1.00 | 1.00 | 1.00 | 1.00 | fixed menus |

Net effect: nil on the routes, about -1.2% at the stores for those 66 days (-0.2% of a store's year).

### 6.2 Rain rule (A)

**Wet season**: 28 June - 24 September 2026; 20 June - 20 September 2027.
The 2026 monsoon was late - the state had only 3.87% of its seasonal rain by 1 July [RAIN-JUL1] - and
was leaving Gujarat in the last week of September [RAIN-WD]; the two dates themselves, 28 June and
24 September, are (A). 2027 uses about the normal dates (19 June - 16 September in [WSPARK]) (A).

Two kinds of day:

**(a) Wet day** - an ordinary rainy day. One draw per date, the same for every route and store, keyed by
the date: the day is wet if the draw is below the month's probability.

| Month (inside the wet season) | June | July | August | September |
|---|---|---|---|---|
| Probability of a wet day | 0.45 | 0.45 | 0.40 | 0.33 |

Expected wet days: 33 in 2026, 35 in 2027 (plus the heavy days below, about 40 rain days a year).

| Channel | BR | BN | DRY | PF | Reason |
|---|---|---|---|---|---|
| Retail outlets | 0.99 | 0.99 | 1.02 | - | the van still delivers; tea-time snacks sell on a wet day |
| Own stores | 0.95 | 0.95 | 0.97 | 1.08 | fewer walk-ins, but a hot puff with tea is what a rainy afternoon wants |
| Corporates | 1.00 | 1.00 | 1.00 | 1.00 | |

Net effect on a wet day: nil on the routes, +0.2% at the stores. It moves the mix, not the total.

**(b) Heavy-rain day** - waterlogged roads; the van runs late, skips stops and cuts quantities.
A heavy-rain day is never also counted as a wet day.

| Year | Heavy-rain days | Routes hit |
|---|---|---|
| 2026 | Thu 9 Jul (A); Thu 23 Jul (A); **Fri 31 Jul** - Petlad 104 mm, Nadiad 95 mm, Borsad 75 mm and Anand 44 mm between 8 and 10 am [RAIN-JUL31]; Sat 1 Aug (A) - the day after; the forecast was for heavy rain on both days, but no measurement for 1 August was found; Tue 18 Aug (A); Sun 6 Sep (A) | all routes, all stores |
| 2026 | **Mon 14 Sep** - Borsad 138 mm, 110 mm of it between 8 and 10 am; Nadiad 33 mm [RAIN-SEP14] | route R4 only; routes R1-R3 and the stores are treated as a wet day |
| 2027 | Tue 29 Jun, Fri 9 Jul, Tue 20 Jul, Thu 29 Jul, Thu 12 Aug, Sat 21 Aug, Wed 8 Sep (all (A)) | all routes, all stores |

| Channel | BR | BN | DRY | PF | Other |
|---|---|---|---|---|---|
| Retail outlets on a route that is hit | 0.82 | 0.82 | 0.82 | - | stale returns on that day's dispatch use a season factor of 1.60 instead of 1.25, so a few credit notes cross the 8% limit and wait for the owner |
| Own stores | 0.70 | 0.70 | 0.75 | 0.75 | |
| Corporates | 1.00 | 1.00 | 1.00 | 1.00 | except caterers 0.90 and the cafe 0.80 |

Seven heavy days a season is an assumption; only the two 2026 dates in bold (31 July and 14 September)
are from the record.
14 September 2026 is also Ganesh Chaturthi (row E21).

---

## 7. Day of week and time of month

### 7.1 Day of week

The day-of-week factors are those of `products-prices.md` (6.5, 7 and 8.2), restated here by channel so
that the calendar is in one place. Nothing is changed.

| Channel | Who | Mon-Fri | Sat | Sun | Reason |
|---|---|---|---|---|---|
| Retail | Provision store | 1.00 | 1.05 | 1.00 | weekend shopping |
| Retail | Dairy parlour | 1.00 | 1.05 | 1.05 | Sunday breakfast |
| Retail | Tea stall | 1.00 | 1.00 | 0.60 | offices, colleges and the estate are shut on Sunday |
| Retail | Bakery counter | 1.00 | 1.10 | 1.15 | weekend treats |
| Retail | General store | 1.00 | 1.10 | 1.15 | weekend shopping |
| Stores | S1 Anand town | 1.00 | 1.10 | 1.20 | family store |
| Stores | S2 Vallabh Vidyanagar | 1.00 | 1.00 | 0.85 | students go home at the weekend |
| Stores | S3 Nadiad | 1.00 | 1.05 | 1.15 | town-centre counter |
| Corporates | C01, C02 industrial canteens | 1.00 | 1.00 | no order | plants closed on Sunday |
| Corporates | C03, C04 hostel messes; C05 hospital kitchen | 1.00 | 1.00 | 1.00 | seven days |
| Corporates | C06 caterer, Anand | Tue, Thu only | order | no order | three orders a week |
| Corporates | C07 caterer, Nadiad | Fri only | no order | no order | one order a week |
| Corporates | C08 hotel | 1.00 | 1.20 | 1.20 | weekend banquets |
| Corporates | C09 school canteen | 1.00 | 1.00 | no order | six-day school week |
| Corporates | C10 cafe | alternate days | alternate days | alternate days | order on every even day count from 1 January 2026 |

### 7.2 Time of month (A, new)

| Day of the month | Retail outlets | Own stores | Corporates | Reason |
|---|---|---|---|---|
| 1 - 7 | 1.03 | 1.08 | 1.00 | salaries and pensions are paid; households stock up and spend on snacks |
| 8 - 23 | 1.00 | 1.00 | 1.00 | |
| 24 - end | 0.97 | 0.93 | 1.00 | month-end squeeze, sharpest on the stores' discretionary items |

The three bands average 1.00 over a month (30 days: 1.000 and 1.002; 31 days: 0.999 and 1.000), so the
month totals of `products-prices.md` are not moved. The factor applies to every product group.

---

## 8. The four van routes

Outlet ids, types, sizes and standing-order values are those of `products-prices.md` 6.4; localities are
kept, and the outlets are put in driving order. Types: P provision store, D dairy parlour, T tea stall,
B bakery counter, G general store. Sizes: S, M, L. "Rs/day" is the standing order at the opening price
list, before GST. The driver-salesmen are in `people-overheads.md` (E022, E023, E024, E025 then E038).

**Terms** (A). 24 outlets (60%) pay **cash on delivery**; 16 (40%) are on **weekly** credit and hold
45.2% of the standing-order value.

- The 16 weekly accounts are: twelve that pay on time - four bakery counters, the general stores O12
  and O33, the four large provision stores and the two large dairy parlours - and the four slow outlets
  O04, O19, O28 and O38, which `people-overheads.md` 7.2 opens with overdue balances. Everyone else,
  including six of the seven tea stalls, pays cash.
- Cash: the invoice is collected by the van salesman at the drop, into factory cash.
- Weekly: due date = invoice date + 7. The salesman collects once a week, on the route's **collection
  day**, everything invoiced up to the day before, in cash or UPI: R1 Monday, R2 Tuesday, R3 Wednesday,
  R4 Thursday. Paid this way nothing becomes overdue, except in Diwali week 2026, when the collections
  of 9, 10 and 11 November move to 12 November (section 3.1) and a few invoices are paid one to three
  days late.
- **The four slow payers** (A), for the receivables and overdue screens. Collection weeks are numbered
  from the week of Monday 5 January 2026 (week 1). On the day it pays, a slow outlet clears everything
  invoiced up to the day before.

| Outlet | Pays | Oldest invoice when it pays | Most overdue |
|---|---|---|---|
| O38 (R4) | on its collection day in odd weeks only | 14 days | 7 days |
| O04 (R1) | on its collection day in odd weeks only | 14 days | 7 days |
| O19 (R2) | on its collection day every third week (weeks 1, 4, 7, ...) | 21 days | 14 days |
| O28 (R3) | on its first collection day of each calendar month | about 35 days | about 28 days |

- Credit limit of a weekly outlet = ten days of its standing order, rounded up to Rs 1,000. The four
  slow payers run past it; a limit on an outlet is information only (the scope's credit-limit warning
  is for corporates).
- Arrival times are for a normal day, from section 10. All four vans leave at 05:30.

### 8.1 Route R1 - Anand town (13 outlets)

Leaves 05:30, back 08:00, 27.1 km. Collection day Monday.

| Seq | Arrives | Id | Shop name (invented) | Locality | Type | Size | Terms | Credit limit | Rs/day |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 05:34 | O11 | Kesarkunj Bakery | Anand-Sojitra Road, Anand | B | M | weekly | 16,000 | 1,549 |
| 2 | 05:44 | O06 | Gopinandan Dairy Parlour | Ganesh Chokdi, Anand | D | M | cash | - | 1,204 |
| 3 | 05:55 | O05 | Navnitkunj Milk Parlour | Amul Dairy Road, Anand | D | L | weekly | 16,000 | 1,561 |
| 4 | 06:05 | O01 | Vrajkunj Provision Store | Station Road, Anand | P | L | weekly | 17,000 | 1,613 |
| 5 | 06:14 | O08 | Raghubhai ni Kitli | Old bus stand, Anand | T | L | cash | - | 1,355 |
| 6 | 06:21 | O09 | Gunjwala Tea and Nasta | Sardar Gunj, Anand | T | M | cash | - | 1,029 |
| 7 | 06:30 | O02 | Harivadan Kirana Bhandar | Gamdi Vad, Anand | P | M | cash | - | 1,239 |
| 8 | 06:40 | O10 | Mithi Bite Bakery and Cake Shop | 100 Feet Road, Anand | B | L | weekly | 21,000 | 2,093 |
| 9 | 06:52 | O13 | Harshvardhan General Stores | Chikhodra Chokdi, Anand | G | M | cash | - | 1,492 |
| 10 | 07:05 | O12 | Triguna Super Store | Borsad Chokdi, Anand | G | L | weekly | 20,000 | 1,923 |
| 11 | 07:20 | O03 | Amrutdhara Provision Store | Mangalpura, Anand | P | M | cash | - | 1,239 |
| 12 | 07:31 | O07 | Makhanchor Dairy Parlour | Lambhvel Road, Anand | D | M | cash | - | 1,204 |
| 13 | 07:44 | O04 | Kalrav Kirana Store | Jitodia Road, Anand | P | S | weekly, slow payer | 11,000 | 1,090 |

Route total Rs 18,591 a day: 6 weekly outlets Rs 9,829, 7 cash outlets Rs 8,762.

### 8.2 Route R2 - Vidyanagar-Karamsad (11 outlets)

Leaves 05:30, back 07:34, 23.2 km. Collection day Tuesday.

| Seq | Arrives | Id | Shop name (invented) | Locality | Type | Size | Terms | Credit limit | Rs/day |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 05:32 | O21 | Shramjivi Tea Stall | Vitthal Udyognagar, estate gate | T | M | cash | - | 1,029 |
| 2 | 05:41 | O22 | Mavjibhai Chai Wala | Janta Chokdi | T | S | cash | - | 865 |
| 3 | 05:54 | O14 | Shardaben Provision Store | Nana Bazar, Vallabh Vidyanagar | P | L | weekly | 17,000 | 1,613 |
| 4 | 06:02 | O20 | Popatkaka Tea Corner | Bhaikaka Circle, Vallabh Vidyanagar | T | L | cash | - | 1,355 |
| 5 | 06:10 | O17 | Vidyadham Milk Parlour | Mota Bazar, Vallabh Vidyanagar | D | L | weekly | 16,000 | 1,561 |
| 6 | 06:17 | O23 | Radhekunj Bake Shop | Iskcon Temple Road, Vallabh Vidyanagar | B | M | weekly | 16,000 | 1,549 |
| 7 | 06:28 | O24 | Shubhangi General Stores | New Vallabh Vidyanagar | G | M | cash | - | 1,492 |
| 8 | 06:40 | O18 | Sardarbhumi Dairy Parlour | Anand-Karamsad Road, Karamsad | D | M | cash | - | 1,204 |
| 9 | 06:49 | O15 | Lakshminandan Provision Store | Main bazar, Karamsad | P | M | cash | - | 1,239 |
| 10 | 07:05 | O16 | Tulsikyara Kirana Store | Bakrol | P | S | cash | - | 1,090 |
| 11 | 07:17 | O19 | Dhenukunj Dairy Parlour | Mogri | D | S | weekly, slow payer | 10,000 | 988 |

Route total Rs 13,985 a day: 4 weekly outlets Rs 5,711, 7 cash outlets Rs 8,274.

### 8.3 Route R3 - Nadiad (9 outlets; the van also carries store S3's transfer and corporate C07)

Leaves 05:30, back 08:34, 60.3 km. Collection day Wednesday.

| Seq | Arrives | Id | Shop name (invented) | Locality | Type | Size | Terms | Credit limit | Rs/day |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 05:56 | O28 | Uttamchand Provision Store | Uttarsanda | P | S | weekly, slow payer | 11,000 | 1,090 |
| 2 | 06:10 | O32 | Sakarba Bakery | Piplag Road, Nadiad | B | M | weekly | 16,000 | 1,549 |
| 3 | 06:22 | S3 | (own store, transfer) | Paras Circle, Santram Road, Nadiad | | | | | |
| 4 | 06:35 | O25 | Santcharan Provision Store | Santram Road, Nadiad | P | L | weekly | 17,000 | 1,613 |
| 5 | 06:44 | O31 | Lalji Maharaj Tea Stall | Station Road, Nadiad | T | M | cash | - | 1,029 |
| 6 | 06:53 | O26 | Chandanvan Provision Store | College Road, Nadiad | P | M | cash | - | 1,239 |
| 7 | 07:01 | O30 | Yamunatat Dairy Parlour | Vaniyavad, Nadiad | D | M | cash | - | 1,204 |
| 8 | 07:12 | O29 | Shantisagar Milk Parlour | Mission Road, Nadiad | D | M | cash | - | 1,204 |
| 9 | 07:24 | O27 | Devkinandan Provision Store | Pij Road, Nadiad | P | M | cash | - | 1,239 |
| 10 | 07:31 | C07 | (corporate) | Pij Road, Nadiad | | | | | |
| 11 | 07:49 | O33 | Ranchhodkrupa General Stores | Dakor Road, Nadiad | G | M | weekly | 15,000 | 1,492 |

Route total Rs 11,659 a day: 4 weekly outlets Rs 5,744, 5 cash outlets Rs 5,915.

### 8.4 Route R4 - Borsad-Petlad (7 outlets)

Leaves 05:30, back 08:00, 66.0 km. Collection day Thursday.

| Seq | Arrives | Id | Shop name (invented) | Locality | Type | Size | Terms | Credit limit | Rs/day |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 05:52 | O36 | Charotarbhumi Kirana | Napad | P | S | cash | - | 1,090 |
| 2 | 06:12 | O38 | Ishwarkaka Tea Stall | Anand Chokdi, Borsad | T | S | weekly, slow payer | 9,000 | 865 |
| 3 | 06:22 | O34 | Mahikantha Provision Store | Station Road, Borsad | P | L | weekly | 17,000 | 1,613 |
| 4 | 06:31 | O40 | Satyagrah General Stores | Bus stand, Borsad | G | S | cash | - | 1,235 |
| 5 | 06:55 | O37 | Parijat Dairy Parlour | Dharmaj | D | S | cash | - | 988 |
| 6 | 07:15 | O35 | Chandrakala Provision Store | Station Road, Petlad | P | M | cash | - | 1,239 |
| 7 | 07:25 | O39 | Suhani Bakery | College Road, Petlad | B | S | cash | - | 1,296 |

Route total Rs 8,326 a day: 2 weekly outlets Rs 2,478, 5 cash outlets Rs 5,848.

### 8.5 Terms by type (check)

| Type | Outlets | Cash on delivery | Weekly |
|---|---|---|---|
| P provision store | 14 | 8 (O02, O03, O15, O16, O26, O27, O35, O36) | 6 (O01, O14, O25, O34; slow: O04, O28) |
| D dairy parlour | 9 | 6 (O06, O07, O18, O29, O30, O37) | 3 (O05, O17; slow: O19) |
| T tea stall | 7 | 6 (O08, O09, O20, O21, O22, O31) | 1 (slow: O38) |
| B bakery counter | 5 | 1 (O39) | 4 (O10, O11, O23, O32) |
| G general store | 5 | 3 (O13, O24, O40) | 2 (O12, O33) |
| **All** | **40** | **24 (60%) - Rs 28,799 a day** | **16 (40%) - Rs 23,762 a day** |

Receivables this produces at the standing-order level, before GST: the twelve prompt accounts together
owe between about Rs 0.6 lakh (Thursday evening, after the last collection of the week) and Rs 1.2 lakh
(Sunday evening); the four slow payers add Rs 0.2 to 0.7 lakh. That brackets the Rs 1,36,000 of opening
retail receivables in `people-overheads.md` 7.2.

### 8.6 The names

Shop names follow local habit: a deity, saint or auspicious word with "Provision Store", "Kirana",
"Dairy Parlour", "Tea Stall" or "ni Kitli" (a tea kettle stall). Each name was searched on the web with
its town on 2 October 2026, in batches; none was found as a business in Anand, Vallabh Vidyanagar,
Karamsad, Nadiad, Borsad or Petlad. Two first choices were dropped because a shop of a similar name
turned up (a "Sikotar" kirana store near Anand, a "Verai" kirana store elsewhere in Gujarat). The
review searched every outlet and corporate name again, in batches, and replaced seven more for
the same reason - four outlets (O05, O20, O23, O36) and three corporates (C05, C07, C10): one was the
name of a dairy brand, one joined the names of two cafe chains, one matched a shop near Nana Bazar, one
a village store in Kheda district, one a charitable hospital trust in Gujarat and a hospital in Anand,
one a caterer in another state and one a burger outlet in another city. The replacements were searched
the same way and not found. A web search cannot prove that a small shop does not exist; any name may be
changed without affecting anything else.

---

## 9. Corporate customers (10) and own stores (3)

### 9.1 Corporates

Type, locality and order pattern are those of `products-prices.md` section 7; names, terms, limits and
GSTINs are new (A). All invoices are on credit; due date = invoice date + credit days.

| Id | Name (invented) | Class | Type | Locality | Constitution | Credit days | Credit limit | GSTIN | Pays (A) | Delivered by |
|---|---|---|---|---|---|---|---|---|---|---|
| C01 | Mahisagar Gears and Castings Pvt Ltd - staff canteen | IC | Industrial canteen, large engineering unit | Vitthal Udyognagar | private company | 30 | 2,50,000 | 24AAHCM4821K1ZF | 0-3 days late | V5, 06:02 |
| C02 | Annakut Canteen Services | IC | Canteen contractor at an industrial unit | Anand-Vidyanagar Road | partnership firm | 30 | 1,50,000 | 24ABKFA7315D1ZS | 0-3 days late | V5, 08:11 |
| C03 | Gyanjyot Kumar Chhatralaya - mess | HM | College hostel mess | University hostels, Vallabh Vidyanagar | education trust | 30 | 1,40,000 | not registered | 0-3 days late | V5, 08:23 |
| C04 | Charak Bhavan Hostel Mess | HM | Hostel mess, medical campus | Karamsad | mess committee | 30 | 90,000 | not registered | about 5 days late | V5, 06:26 |
| C05 | Arogyatirth Charitable Trust Hospital - kitchen | HK | Hospital kitchen | Karamsad | charitable trust | 30 | 1,40,000 | 24AACTA5126H1Z4 | about 10 days late | V5, 06:17 |
| C06 | Swadsangam Caterers | CT | Caterer | 100 Feet Road, Anand | proprietor | 15 | 60,000 | 24BDLPT6247Q1ZM | **about 20 days late; over its limit** | V5, 07:37 |
| C07 | Thalrang Caterers | CT | Caterer | Pij Road, Nadiad | proprietor | 15 | 30,000 | not registered | 0-3 days late | R3 van, 07:31 |
| C08 | Hotel Mahi Regency | HT | Hotel with restaurant and banquet | Amul Dairy Road, Anand | LLP | 30 | 1,80,000 | 24AAVFM2468L1ZM | about 15 days late | V5, 07:22 |
| C09 | Gyanvatika English Medium School - canteen | SC | School canteen | Lambhvel Road, Anand | education trust | 15 | 90,000 | not registered | 0-3 days late | V5, 07:54 |
| C10 | Crustwala Cafe | CF | Cafe and fast-food counter | Vallabh Vidyanagar | proprietor | 15 | 75,000 | 24CKQPP3792M1Z9 | 0-3 days late | V5, 08:33 |

Rules and notes.

- **Credit limit** (A) = (credit days + usual lateness + 15 days) x average billing per day, rounded up,
  so a customer that behaves as in the "Pays" column stays inside its limit - except C06, whose limit is
  set tight on purpose. Average billing per day in 2026 (`products-prices.md` section 7): C01 Rs 4,800;
  C02 Rs 2,960; C03 Rs 2,750; C04 Rs 1,680; C05 Rs 2,440; C06 Rs 2,320; C07 Rs 870; C08 Rs 2,920;
  C09 Rs 2,300; C10 Rs 2,150. Every opening balance in `people-overheads.md` 7.2 is inside its limit
  (C06: Rs 58,000 against Rs 60,000).
- **The late payer** (A): **C06 Swadsangam Caterers** pays about 20 days after the due date, so about 15
  of its orders are open at a time. In a wedding window (orders 1.35 times normal) that is about
  Rs 1.0 lakh against a limit of Rs 60,000, and the credit-limit warning shows on every order; it stays
  over the limit in the NRI season and the ordinary gaps (Rs 70,000 to 90,000) and comes back under it
  only in the monsoon months (about Rs 54,000). This is the build specification's "one corporate pays
  late and is over its limit". C04, C05 and C08 are late but inside their limits, in line with their
  overdue opening invoices in `people-overheads.md` 7.2.
- **GSTIN** [GSTIN]: 15 characters = state code (24 for Gujarat) + the 10-character PAN + entity number
  (1) + "Z" + a check character. The fourth letter of the PAN gives the constitution (C company, F firm
  or LLP, T trust, P individual) and the fifth is the initial of the entity's name (of the surname, for
  an individual); the PAN letter rule is the income-tax department's convention, not from [GSTIN]. The
  six numbers above are synthetic; each has a correct check character (the standard modulus-36
  calculation, recomputed in review), so a format check passes. They are not taken from the GST portal
  and must not be presented as real registrations.
- **Not registered** (A): the two hostel messes and the school canteen (education trusts and a mess
  committee making exempt supplies) and the small Nadiad caterer (below the registration threshold).
  Their invoices carry no customer GSTIN.
- The company's own state code is 24, so every sale is intra-state: CGST + SGST, never IGST.

### 9.2 Own stores

| Id | Name | Road and locality | Opening hours | Stock arrives | Character |
|---|---|---|---|---|---|
| S1 | Happy Bakers - Anand | Town Hall Road, near Vivekanand Wadi, Anand 388001 | 07:30 - 21:00, all seven days | 07:05 on V5 | The family store: bread, pav and dry bakery lead; busiest on Sunday and in the first week of the month. |
| S2 | Happy Bakers - Vidyanagar | Nana Bazar, near Shastri Maidan, Vallabh Vidyanagar 388120 | 08:00 - 21:00, all seven days | 06:44 on V5 | The student store: puffs are 45% of sales, with buns, pizza base and tea cake; peaks 16:00 - 20:00; falls at weekends and in college vacations. |
| S3 | Happy Bakers - Nadiad | Paras Circle, Santram Road, Nadiad 387001 | 07:30 - 20:30, all seven days | 06:22 on the R3 van | The small town-centre counter: temple-road and office footfall, strongest on Sunday; half the size of S1. |

- A staff member is in before the van (S1 from 07:00, S2 from 06:30, S3 from 06:15) to receive the
  transfer; the store confirms it in the system at 07:30 and posts the day-end entry at closing (by
  21:00), as in the build specification.
- The stores are shut only on the closed days of section 3.1.
- The roads are real: Town Hall Road in Anand [ADDR-S1], Nana Bazar by the Shastri ground in Vallabh
  Vidyanagar [ADDR-S2], Paras Circle on Santram Road in Nadiad [ADDR-S3]. Shop rents and sizes are in
  `people-overheads.md` 4.

---

## 10. Distances and timing

### 10.1 What the record gives

| From - to | Distance | Source |
|---|---|---|
| Vitthal Udyognagar - Anand (town) | 3 km; Anand Junction station 4.3 km | [VUN] |
| Vitthal Udyognagar - Vallabh Vidyanagar station | 1.1 km | [VUN] |
| Vitthal Udyognagar - Karamsad station | 2.9 km | [VUN] |
| Vitthal Udyognagar - Nadiad | 22 km (Nadiad Junction 21 km) | [VUN] |
| Vitthal Udyognagar - Petlad | 19 km | [VUN] |
| Anand - Nadiad by road | about 25 km | [DIST-NAD] |
| Anand - Borsad by road | about 20 km | [DIST-BOR] |
| Anand - Napad | about 12 km | [NAPAD] |
| Dharmaj - Petlad; Dharmaj - Borsad | 8 km; 11 km | [DHARMAJ] |

The factory is in the Vitthal Udyognagar estate, off the Anand-Sojitra road, PIN 388121 [VUN].

### 10.2 The five runs (A, built from the distances above)

Five vehicles, as in `people-overheads.md` 4.4: one van per route (V1-V4) and a fifth (V5) for store
transfers and corporate orders. Each makes one delivery run a day. Loading starts at 04:45. Timing
assumptions: 6 minutes at an outlet (unload, take back stale stock, invoice, collect), 8 minutes at a
corporate, 12 minutes at an own store; 20-25 km/h in town, 35-40 km/h on the highway.

| Run | Leaves | Path | First drop | Last drop | Back | Drops | Km |
|---|---|---|---|---|---|---|---|
| R1 Anand town (V1) | 05:30 | factory - Anand-Sojitra Road - Ganesh Chokdi - Amul Dairy Road - Station Road - old bus stand - Sardar Gunj - Gamdi Vad - 100 Feet Road - Chikhodra Chokdi - Borsad Chokdi - Mangalpura - Lambhvel Road - Jitodia Road - factory | 05:34 | 07:44 | 08:00 | 13 outlets | 27.1 |
| R2 Vidyanagar-Karamsad (V2) | 05:30 | factory - estate gate - Janta Chokdi - Nana Bazar - Bhaikaka Circle - Mota Bazar - Iskcon Temple Road - New Vallabh Vidyanagar - Karamsad - Bakrol - Mogri - factory | 05:32 | 07:17 | 07:34 | 11 outlets | 23.2 |
| R3 Nadiad (V3) | 05:30 | factory - Anand-Nadiad road - Uttarsanda (17 km) - Piplag Road - Paras Circle - Santram Road - Station Road - College Road - Vaniyavad - Mission Road - Pij Road - Dakor Road - National Highway 48 - factory (26 km) | 05:56 | 07:49 | 08:34 | 9 outlets + store S3 + C07 | 60.3 |
| R4 Borsad-Petlad (V4) | 05:30 | factory - Anand-Borsad road - Napad (13 km) - Borsad (9 km) - Dharmaj (12 km) - Petlad (9 km) - Karamsad - factory (19 km) | 05:52 | 07:25 | 08:00 | 7 outlets | 66.0 |
| Stores and corporates (V5) | 06:00 | factory - C01 (Vitthal Udyognagar) - C05, C04 (Karamsad) - store S2 (Nana Bazar) - store S1 (Town Hall Road) - C08 (Amul Dairy Road) - C06 (100 Feet Road) - C09 (Lambhvel Road) - C02 (Anand-Vidyanagar Road) - C03 (university hostels) - C10 (Vallabh Vidyanagar) - factory | 06:02 | 08:33 | 08:47 | 2 stores + 9 corporates | 28.3 |
| **All five** | | | | | | 40 outlets, 3 stores, 10 corporates | **204.9** |

V5 timetable: C01 06:02, C05 06:17, C04 06:26, S2 06:44, S1 07:05, C08 07:22, C06 07:37, C09 07:54,
C02 08:11, C03 08:23, C10 08:33. A customer with no order that day is skipped (C06 has three orders a
week, C10 one every second day, the canteens none on Sunday).

- Delivery runs total 205 km a day, about 6,150 km in a 30-day month; nothing on the closed days.
- Leg lengths, in order (km). R1: 1.5, 2.0, 1.5, 1.5, 0.7, 0.6, 0.8, 1.5, 2.5, 3.0, 3.0, 1.5, 3.0, then
  4.0 back. R2: 0.5, 1.2, 3.0, 0.6, 0.6, 0.5, 2.0, 2.5, 0.8, 4.5, 2.5, then 4.5 back. R3: 17, 4.0, 2.0,
  0.5, 1.0, 1.0, 0.8, 1.5, 2.0, 0.5, 4.0, then 26 back. R4: 13, 9, 1.5, 1.0, 12, 9, 1.5, then 19 back.
  V5: 0.5, 3.0, 0.5, 4.0, 4.0, 1.5, 2.5, 3.5, 4.0, 1.5, 0.8, then 2.5 back.
- **Against `people-overheads.md` 4.4.** That file, as revised, takes these delivery runs (27.1, 23.2,
  60.3, 66.0 and 28.3 km, 204.9 km in all) for anything shown as a route distance, and adds about 80 km
  a day of other running (second drops, the collection round, the market, the bank, the pump and the
  garage), which keeps its 285 km and 19.0 litres a day. The two files agree. The leaner alternative
  is about 15 litres a day (205 km + 20 km of other trips, at 15 km a litre); the difference is about
  Rs 12,000 a month.
- **Document times.** The build specification stamps dispatch invoices 05:30, store transfers 06:00 and
  the stores' confirmation 07:30. These fit: the route sheets are posted when the vans leave (05:30), V5
  leaves at 06:00 and reaches S2 at 06:44 and S1 at 07:05, the Nadiad transfer rides on the R3 van and
  arrives at 06:22, and all three stores confirm at 07:30.
- On a heavy-rain day a van on a route that is hit returns 60 to 90 minutes late (not modelled in any
  document).
- Stale stock comes back on the same van and is destroyed at the factory; the credit note follows the
  lag rule of `products-prices.md` 6.6.

---

## 11. The calendar as one block (for the generator)

Dates are ISO; a range is inclusive. Factor order for `r`: BR, BN, DRY. For `s`: BR, BN, DRY, PF.
`c` lists only the corporate classes that differ from 1.00.

```
EVENTS
E01 dates 2026-01-13 | 2027-01-13                          r 1.10 1.15 1.05   s 1.15 1.20 1.10 1.10   c CT 1.20 HT 1.10
E02 dates 2026-01-14 | 2027-01-14                          r 0.90 1.00 0.85   s 1.10 1.20 0.90 1.20   c IC 0 HM 0.70 CT 1.20 HT 1.20 SC 0 CF 0.60
E03 dates 2026-01-15 | 2027-01-15                          r 0.80 0.85 0.80   s 0.90 1.00 0.90 1.00   c IC 0.50 HM 0.70 HT 1.10 SC 0 CF 0.70
E04 dates 2026-01-26 2026-08-15 | 2027-01-26 2027-08-15    r 1.00 1.00 1.00   s 1.05 1.10 1.05 1.15   c IC 0 HT 1.10 SC 0 CF 1.10
E05 dates 2026-02-15 | 2027-03-06                          r 0.85 0.85 0.95   s 0.85 0.85 0.95 0.75   c HM 0.85 SC 0 CF 0.85
E06 dates 2026-03-03 | 2027-03-21                          r 1.00 1.00 1.00   s 1.05 1.05 1.05 1.05
E07 dates 2026-03-04 | 2027-03-22                          r 0.60 0.60 0.60   s 0.70 0.70 0.70 0.70   c IC 0 HM 0.70 HT 1.10 SC 0 CF 0.50
E08 range 2026-02-19..2026-03-20 | 2027-02-09..2027-03-09  r 1.04 1.03 1.06   s 1.02 1.02 1.03 1.00
E09 dates 2026-03-21 | 2027-03-10                          r 0.97 1.00 0.97   s 1.00 1.00 1.00 1.00   c CT 1.20 SC 0
E10 dates 2026-03-26 | 2027-04-15                          r 0.95 0.95 1.00   s 0.93 0.95 1.00 0.90   c HM 0.90 SC 0
E11 dates 2026-03-31 | 2027-04-19                          r 1.00 1.00 1.00   s 1.00 1.00 1.00 1.00   c SC 0
E12 dates 2026-05-28 | 2027-05-17                          r 1.05 1.05 1.00   s 1.00 1.00 1.00 1.00   c CT 1.20 SC 0
E13 dates 2026-07-16 | 2027-07-05                          r 1.00 1.00 1.00   s 1.03 1.03 1.05 1.05   c SC 0
E14 range 2026-08-13..2026-09-11 | 2027-08-03..2027-08-31  r 0.96 0.96 1.00   s 0.95 0.95 1.00 0.90   c HM 0.95 CF 0.95
E15 every Monday inside E14                                r 0.95 0.97 1.00   s 0.93 0.95 1.00 0.90
E16 dates 2026-08-28 | 2027-08-17                          r 1.00 1.00 1.08   s 1.05 1.05 1.20 1.10   c IC 0 HM 0.80 HT 1.15 SC 0 CF 0.85
E17 dates 2026-09-03 | 2027-08-24                          r 1.08 1.05 1.12   s 1.10 1.05 1.15 1.00
E18 dates 2026-09-04 | 2027-08-25                          r 0.85 0.85 0.95   s 0.80 0.85 1.00 0.70   c IC 0 HM 0.70 HT 1.10 SC 0 CF 0.70
E19 range 2026-09-08..2026-09-15 | 2027-08-28..2027-09-04  r 0.98 0.98 0.98   s 0.97 0.97 0.97 0.93
E20 dates 2026-09-15 | 2027-09-04                          r 1.00 1.00 1.00   s 1.00 1.00 1.00 1.00   c SC 0
E21 dates 2026-09-14 | 2027-09-04                          r 1.02 1.02 1.00   s 1.03 1.05 1.05 1.10
E22 range 2026-09-15..2026-09-25 | 2027-09-05..2027-09-14  r 1.02 1.02 1.00   s 1.00 1.03 1.00 1.05   c CT 1.05
E23 range 2026-10-11..2026-10-19 | 2027-09-30..2027-10-08  r 1.05 1.12 1.00   s 1.03 1.15 1.00 1.20   c CT 1.20 HT 1.10 CF 1.25
E24 dates 2026-10-20 | 2027-10-09                          r 0.90 0.95 0.90   s 0.90 0.95 0.95 0.85   c IC 0 HM 0.85 HT 1.10 SC 0 CF 0.90
E25 range 2026-11-01..2026-11-07 | 2027-10-22..2027-10-28  r 1.00 1.00 1.25   s 1.00 1.00 1.40 1.05   c CT 1.10 HT 1.10
E26 dates 2026-11-08 | 2027-10-29                          r 0.80 0.80 1.10   s 0.85 0.85 1.30 0.80   c IC 0 CF 0.70 HK and HT 2.50 (2026) 2.00 (2027)
E27 range 2026-11-09..2026-11-11 | 2027-10-30..2027-10-31  closed: every factor 0
E28 range 2026-11-12..2026-11-13 | 2027-11-01..2027-11-02  r 0.60 0.60 0.60   s 0.70 0.70 0.80 0.70   c IC 0 CT 0.80 HT 1.15 CF 0.50
E29 dates 2026-11-14 | 2027-11-03                          r 0.85 0.85 0.85   s 0.90 0.90 0.90 0.90   c IC 0.60 CF 0.80
E30 range 2026-11-15..2026-11-20 | 2027-11-04..2027-11-09  r 0.93 0.93 0.93   s 0.96 0.96 0.96 0.96
E31 dates 2026-12-24 2026-12-25 | 2027-12-24 2027-12-25    r 1.00 1.05 1.08   s 1.05 1.15 1.15 1.15   c CT 1.20 HT 1.20 CF 1.20 SC 0 on 12-25 only
E32 dates 2026-12-31 | 2027-12-31                          r 1.05 1.10 1.00   s 1.10 1.25 1.05 1.25   c CT 1.20 HT 1.30 CF 1.30

FACTORY HOLIDAYS   2026-11-08 2026-11-09 2026-11-10 | 2027-10-29 2027-10-30

COLLEGE VACATION   2026-04-27..2026-06-14  2026-11-05..2026-11-25  2027-04-27..2027-06-14  2027-10-26..2027-11-15
COLLEGE EXAMS      2026-03-30..2026-04-25  2026-10-19..2026-11-04  2026-11-26..2026-12-16
                   2027-03-29..2027-04-26  2027-10-11..2027-10-25  2027-11-16..2027-12-06
SCHOOL VACATION    2026-05-04..2026-06-07  2026-11-05..2026-11-25  2027-05-03..2027-06-06  2027-10-26..2027-11-15
BOARD EXAMS        2026-02-26..2026-03-16  2027-02-25..2027-03-17
  college: C03 C04 vacation 0.30 | C10 exam 0.90 vacation 0.70 | S2 exam 0.95 vacation 0.70 | O14 O17 O20 O23 O24 vacation 0.85
  school:  C09 vacation 0 board exams 0.80

WEDDING WINDOWS    2026-02-05..2026-03-12  2026-04-15..2026-05-14  2026-06-21..2026-07-11  2026-11-21..2026-12-12
                   2027-01-15..2027-03-14  2027-04-18..2027-07-12  2027-11-10..2027-12-14
NRI SEASON         every 15 December to 31 January
CHATURMAS GAP      2026-07-12..2026-11-20  2027-07-13..2027-11-09
  caterers C06 C07: window 1.35, else NRI season 1.20, else Chaturmas gap 0.70, else 0.90
  hotel C08: 1.10 in a window or the NRI season, else 1.00

SUMMER             04-06..06-10 each year   r 1.01 1.01 0.98   s 1.03 1.03 0.98 0.95
WET SEASON         2026-06-28..2026-09-24   2027-06-20..2027-09-20
  wet-day probability   Jun 0.45  Jul 0.45  Aug 0.40  Sep 0.33   (one draw per date)
  wet day               r 0.99 0.99 1.02   s 0.95 0.95 0.97 1.08
HEAVY RAIN         2026-07-09 2026-07-23 2026-07-31 2026-08-01 2026-08-18 2026-09-06   all routes and stores
                   2026-09-14                                                          route R4 only (others: wet day)
                   2027-06-29 2027-07-09 2027-07-20 2027-07-29 2027-08-12 2027-08-21 2027-09-08   all routes and stores
  heavy day             r 0.82 0.82 0.82   s 0.70 0.70 0.75 0.75   c CT 0.90 CF 0.80   returns season factor 1.60

MONTH PART         day 1-7: retail 1.03, stores 1.08 | day 8-23: 1.00 | day 24-end: retail 0.97, stores 0.93
WEEKLY COLLECTION  R1 Monday, R2 Tuesday, R3 Wednesday, R4 Thursday (week 1 = the week of 2026-01-05)
  slow payers: O38 and O04 odd weeks only | O19 weeks 1, 4, 7, ... | O28 first collection day of each month
```

---

## 12. Effect on yearly sales (check)

Expected values, computed day by day for both years with the standing orders, store sales, corporate
patterns, day-of-week and month factors of `products-prices.md` and the rules of this file, at the
opening price list and without noise. "Before" = the rules of `products-prices.md` alone.

| | 2026 | 2027 |
|---|---|---|
| Retail outlets (gross) | -1.7% | -1.5% |
| Corporates | -2.5% | -1.2% |
| Own stores (S1 / S2 / S3) | -2.0% (-1.4% / -3.3% / -1.4%) | -1.8% (-1.2% / -3.1% / -1.2%) |
| **All channels** | **-2.0%** | **-1.5%** |
| Applied to `products-prices.md` 9.3 | Rs 4.03 crore -> about **Rs 3.95 crore**, Rs 1.08 lakh a day | Rs 4.19 crore -> about **Rs 4.13 crore**, Rs 1.13 lakh a day |

By month (all channels, change against "before"):

| | Jan | Feb | Mar | Apr | May | Jun | Jul | Aug | Sep | Oct | Nov | Dec |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026 | -1.1% | +1.1% | +0.2% | -1.6% | -2.3% | -1.7% | -0.9% | -3.9% | -2.6% | +0.5% | -12.8% | +0.1% |
| 2027 | -0.8% | +2.5% | -0.7% | -2.1% | -1.1% | -1.4% | -0.9% | -5.4% | -0.2% | -4.0% | -4.6% | +0.3% |

By corporate customer (change against "before"):

| | C01 | C02 | C03 | C04 | C05 | C06 | C07 | C08 | C09 | C10 |
|---|---|---|---|---|---|---|---|---|---|---|
| 2026 | -4.1% | -4.1% | -4.3% | -4.4% | -0.5% | -0.5% | -1.3% | +5.0% | -6.4% | -4.7% |
| 2027 | -3.5% | -3.5% | -4.2% | -4.2% | -0.2% | +6.5% | +7.5% | +6.4% | -6.4% | -4.3% |

Where it comes from: the Diwali break (three closed days in 2026, two in 2027, and the thin week around
them; the break falls in November 2026 but straddles October and November in 2027); Shravan with
Janmashtami and Raksha Bandhan in August; the plant holidays of the two canteens; the college summer
vacation, which is two weeks longer than the school vacation the hostels were modelled on; seven
heavy-rain days. Navratri, the Diwali run-up, Ramadan and the wedding windows add. 2027 is a much
stronger wedding year than 2026, which lifts the caterers and the hotel.

The thinnest open days are Dhuleti and the two reopening days after Bhai Bij (about 0.6 of normal on the
routes). The strongest single line is dry bakery at store S1 on the Saturday before Diwali 2026: about
1.6 times a normal weekday (1.40 x 1.08 x Saturday 1.10 x November 0.98).

---

## 13. Points for the reconciliation step

1. **Vacation calendar.** `products-prices.md` section 7 applies the school vacations to C03, C04, C10
   and S2. This file moves them to the **college calendar** of section 4 (the customers are college
   hostels, a student cafe and the student store) and keeps the school calendar for C09 only. The
   vacation factors themselves are unchanged. New: exam-week factors, a board-exam factor for C09, and a
   0.85 vacation factor for five campus outlets on route R2.
2. **Caterer season.** The month table in `products-prices.md` section 7 is replaced by the dated rule of
   section 5; the hotel gets a small season factor. Yearly averages: 1.00 (2026) and 1.08 (2027) against
   1.02.
3. **Yearly sales** come out about 2.0% (2026) and 1.5% (2027) below `products-prices.md` section 9
   (section 12). If the calibration target must stay at Rs 4.0 crore for 2026, raise the retail and
   store month factors by 0.02 across the board; do not weaken the calendar.
4. **Summer and monsoon.** The level of the season stays in the month factors of `products-prices.md`.
   Sections 6.1 and 6.2 only shift the product mix, except on the fourteen heavy-rain days.
5. **Routes and vehicles.** The scope says "about 10" stops a route; the outlet list of
   `products-prices.md` has 13, 11, 9 and 7, which is kept: the Anand town run is short and dense, the
   Borsad-Petlad run long and thin. Vehicles and drivers follow `people-overheads.md` 4.4 (four route
   vans and a fifth for stores and corporates); the Nadiad store and the Nadiad caterer ride on the R3
   van, because the fifth vehicle cannot reach Nadiad before the store opens. The delivery runs here come
   to 205 km a day; that file's 285 km adds 80 km of other running (section 10.2).
6. **Closed days against two scope rules.** (a) "The seed ends with yesterday's production, enough to
   post every one of today's dispatch sheets as prefilled": on a closed day there are no sheets, and on
   the day before a closed day nothing is baked. A copy whose business date is 9, 10 or 11 November
   2026 (or 30 or 31 October 2027) should open with an empty "today's work" and a line saying the bakery
   is closed for the festival; the dispatch-sheet and transfer prefill should be empty on closed days,
   which makes the company's holiday list a small master. (b) "The seed for one business date is the
   beginning of the seed for a later one" holds, because closures and factory holidays depend on the
   date only.
7. **Prefill against demand on thin and strong days.** The prefilled sheet is the standing order; the
   seed dispatches standing order x factors. On a day whose factors are below 1.00 the bake of the day
   before (planned on the factors) is smaller than the prefill, and the form will offer to cut to stock.
   This already happens with the day-of-week and month factors of `products-prices.md` (a tea stall on
   Sunday is 0.60); the calendar adds more such days. The clean fix is for the bake of every day to cover
   the larger of the forecast and the standing-order prefill of the next morning; the surplus of the
   fresh lines is used the day after, oldest first.
8. **Documents that fall on a closed day** (credit notes for stale returns, weekly collections, receipts,
   payments, approvals, goods receipts) move to the next open day; bills, the salary bill of 31 October
   2027 among them, keep their date (section 3.1, and `people-overheads.md` 4 and 8.8).
9. **Terms, late and slow payers.** Cash-on-delivery against weekly outlets follow the counts in
   `people-overheads.md` 7.2 (24 and 16, with O04, O19, O28 and O38 as the slow weekly accounts); this
   file names which outlets are which and gives the collection days and the slow-payer rhythm (section
   8). Corporate C06 is the one that pays late and is over its limit; C04, C05 and C08 pay late inside
   their limits. The opening invoices keep the due dates and collection dates of `people-overheads.md`.
10. **Names** are invented and web-checked (8.6); the three stores are named after their town. The
    customer master should take names, terms, limits, GSTINs and the stop order from sections 8 and 9.
11. **Tentative dates.** If the 2027 moon-dependent dates (Ramadan, both Eids) or Dhuleti 2027 turn out a
    day different, only rows E07, E08, E09 and E12 move; their factors are small.

---

## 14. Sources

Opened on 2 October 2026 unless noted.

| Key | What it gave | URL |
|---|---|---|
| [H26] | Gujarat holiday list 2026: Makar Sankranti 14 Jan, Dhuleti 4 Mar, Eid 21 Mar, Ram Navami 26 Mar, Mahavir Jayanti 31 Mar, Bakri Eid 27 May (printed), Rath Yatra 16 Jul, Raksha Bandhan 28 Aug, Janmashtami 4 Sep, Samvatsari 15 Sep, Dussehra 20 Oct, Diwali 8 Nov, new year 10 Nov, Bhai Bij 11 Nov, Christmas 25 Dec | https://www.greythr.com/wiki/acts/st-gujarat/holidays/2026/ |
| [H27] | Gujarat holiday dates 2027 (not yet the official notification): Makar Sankranti 14 Jan, Maha Shivratri 6 Mar, Eid 10 Mar, Dhuleti 23 Mar (this file uses 22 Mar), Ram Navami 15 Apr, Mahavir Jayanti 19 Apr, Bakri Eid 17 May, Raksha Bandhan 17 Aug, Janmashtami 25 Aug | https://www.qppstudio.net/public-holidays/india-gujarat.htm |
| [D26] | Panchang 2026: Maha Shivratri 15 Feb, Holika Dahan 3 Mar, Holi 4 Mar, Ram Navami 26 Mar, Rath Yatra 16 Jul, Raksha Bandhan 28 Aug, Janmashtami 4 Sep, Ganesh Chaturthi 14 Sep, Dussehra 20 Oct, Diwali 8 Nov, Govardhan Puja 10 Nov, Bhai Dooj 11 Nov | https://www.drikpanchang.com/calendars/indian/indiancalendar.html?year=2026 |
| [D27] | Panchang 2027: Makar Sankranti 15 Jan, Maha Shivratri 6 Mar, Eid al-Fitr 10 Mar, Rama Navami 15 Apr, Mahavir Jayanti 19 Apr, Eid al-Adha 17 May, Rath Yatra 5 Jul, Raksha Bandhan 17 Aug, Janmashtami 25 Aug, Ganesh Chaturthi 4 Sep, Dussehra 9 Oct, Diwali 29 Oct, Govardhan Puja 30 Oct, Bhai Dooj 31 Oct | https://www.drikpanchang.com/calendars/indian/indiancalendar.html?year=2027 |
| [HOLI27] | Vadodara 2027: Holika Dahan Sun 21 Mar, Dhuleti Mon 22 Mar; Purnima from 18:21 on 21 Mar to 16:13 on 22 Mar | https://www.drikpanchang.com/festivals/holi/festivals-holika-dahan-timings.html?geoname-id=1253573&year=2027 |
| [EID26] | Eid al-Fitr celebrated in India on Sat 21 Mar 2026; moon not seen on 19 Mar; 30 fasts | https://www.latestly.com/lifestyle/festivals-events/eid-2026-moon-sighting-final-update-india-to-celebrate-eid-ul-fitr-on-march-21-as-shawwal-chand-not-sighted-7360536.html |
| [BAK26] | Eid al-Adha in India on Thu 28 May 2026 | https://www.indiatvnews.com/lifestyle/spirituality/when-is-eid-al-adha-in-india-bakrid-2026-date-saudi-arabia-rules-for-qurbani-and-meat-distribution-2026-05-20-1041850 |
| [RAM27] | Ramadan 2027 in India expected from Tue 9 Feb (this source: to 10 Mar, Eid 11 Mar) | https://blog.wego.com/ramadan-in-india/ |
| [SHR26] | Gujarati Shravan 2026: 13 Aug - 11 Sep; Mondays 17, 24, 31 Aug, 7 Sep | https://hindupad.com/shravan-maas-gujarati/ |
| [SHR27] | Shravan 2027 (month ending on the new moon): Tue 3 Aug - Tue 31 Aug | https://www.astrovachmi.com/observances/shravan-maas-dates/2027 |
| [PAR26] | Paryushan 2026: 8 - 15 Sep, Samvatsari 15 Sep | https://thejainreligion.in/festivals/paryushan-2026 |
| [JAIN27] | Jain calendar 2027: Paryushan from Sat 28 Aug, Samvatsari Sat 4 Sep, Mahavir Jayanti Mon 19 Apr | https://hinducalculator.com/jain-calendar/2027/ |
| [NAV26] | Navratri 2026: Sun 11 Oct - Mon 19 Oct, Dussehra Tue 20 Oct | https://www.indianeagle.com/traveldiary/sharad-navratri-2026-dates-puja-rituals-fasting-colours/ |
| [NAV27] | Navratri 2027: from Thu 30 Sep, Navami Fri 8 Oct, Dussehra Sat 9 Oct | https://samvat.in/festivals/navaratri-2027/ |
| [DHAN] | Dhanteras Fri 6 Nov 2026 and Wed 27 Oct 2027 (opened in review, with ?year=2026 and ?year=2027) | https://www.drikpanchang.com/festivals/dhanteras/festivals-dhanteras-puja-timings.html |
| [LABH] | Labh Pancham Sat 14 Nov 2026 and Wed 3 Nov 2027 | https://www.prokerala.com/festivals/labh-panchami.html and https://shubhpanchang.in/festivals/labh-pancham-2027?lang=en |
| [WED26] | Marriage dates 2026 by month; none in January, August, September, October | https://www.drikpanchang.com/shubh-dates/shubh-marriage-dates-with-muhurat.html?year=2026 |
| [WED27] | Marriage dates 2027 by month; none in August, September, October | https://www.drikpanchang.com/shubh-dates/shubh-marriage-dates-with-muhurat.html?year=2027 |
| [SPU27] | Sardar Patel University term schedule 2026-27 (notification of 12 June 2026): terms, examination weeks, Diwali vacation 5 - 25 Nov 2026, summer vacation 27 Apr - 14 Jun 2027 | https://www.spuvvn.edu/studentscorner/termschedule/Term-Schedule-Notification-2026-2027.pdf (listed at https://www.spuvvn.edu/students_corner/term_schedule/) |
| [SPU26] | Sardar Patel University term schedule 2025-26: second term from 4 Dec 2025, examinations 30 Mar - 25 Apr 2026, summer vacation 27 Apr - 13 Jun 2026 | https://www.spuvvn.edu/studentscorner/termschedule/Term_Schedule_Notification_25_26.pdf |
| [SCH27] | Gujarat school calendar 2026-27: Diwali vacation 5 - 25 Nov 2026, summer vacation 3 May - 6 Jun 2027, board examinations 25 Feb - 17 Mar 2027 | https://deshgujarat.com/2026/05/03/gujarat-board-schools-academic-calendar-2026-27-classes-from-june-8-21-days-diwali-vacation-35-days-summer-vacation/ |
| [GSEB26] | Board examinations 26 Feb - 16 Mar 2026; summer vacation 4 May - 7 Jun 2026 | https://news.careers360.com/gujarat-board-exams-2026-from-february-26-march-16-gseb-calendar-2025-26-holidays-academic-session-exam-dates/amp |
| [CENSUS] | Anand district, census 2011: Hindu 85.95%, Muslim 11.99%, Christian 1.42%, Jain 0.41%; population 20,92,745 | https://www.census2011.co.in/data/religion/district/196-anand.html |
| [WSPARK] | Anand climate: hot season 6 Apr - 10 Jun; wet season 19 Jun - 16 Sep; wet days June 6.7, July 13.9, August 12.5, September 7.4 | https://weatherspark.com/y/107333/Average-Weather-in-%C4%80nand-Gujarat-India-Year-Round |
| [ANANDRAIN] | Anand district: 687 mm from the south-west monsoon, about 40 rainy days, onset third week of June, withdrawal fourth week of September (abstract as shown in the search listing; the page itself refused the request) | https://www.researchgate.net/publication/276885462_Spatial_and_Temporal_Variability_of_Rainfall_in_Anand_District_of_Gujarat_State |
| [RAIN-JUL1] | Gujarat had 3.87% of its seasonal rain by 1 July 2026 | https://deshgujarat.com/2026/07/01/gujarat-gets-just-3-87-of-seasonal-rainfall-till-july-1-district-and-taluka-wise-data/ |
| [RAIN-JUL31] | 31 July 2026: Petlad 104 mm, Nadiad 95 mm, Borsad 75 mm and Anand 44 mm between 8 and 10 am; red alert for Anand district for 31 July (neither page gives a measurement for 1 August) | https://english.gujaratsamachar.com/news/gujarat/central-gujarat-receives-heaviest-rainfall-in-two-hours-vaso-tops-state-with-124-mm-56318582687 and https://deshgujarat.com/2026/07/29/imd-issues-red-alert-for-extremely-heavy-rain-in-ahmedabad-vadodara-surat-and-other-gujarat-districts-on-july-31/ |
| [RAIN-SEP14] | 14 September 2026: Borsad 115 mm in four hours, 138 mm by the afternoon, 110 mm of it between 8 and 10 am; Nadiad 33 mm | https://english.gujaratsamachar.com/news/gujarat/gujarat-rain-borsad-gets-453-inches-in-4-hours-dholka-records-276-inches-72941006538 and https://english.gujaratsamachar.com/news/gujarat/rains-shift-from-central-districts-to-saurashtra-as-vallabhipur-and-jamkandorna-record-heavy-downpours-13904117425 |
| [RAIN-WD] | 23 September 2026: monsoon leaving Saurashtra-Kutch by 23-24 September; state at about 88% of its seasonal rain | https://www.gujaratsamachar.com/news/ahmedabad/Gujarat-Monsoon-Update-2026-11-Talukas-See-Under-10-Inches-Rain-Withdrawal-Starts-21703788885 |
| [VUN] | Vitthal Udyognagar: Anand 3 km, Petlad 19 km, Nadiad 22 km; stations Vallabh Vidyanagar 1.1 km, Karamsad 2.9 km, Anand Junction 4.3 km, Nadiad Junction 21 km; PIN 388121; Anand-Sojitra Road | http://www.onefivenine.com/india/villages/Anand/Anand/Vithal-Udyognagar |
| [DIST-NAD] | Anand - Nadiad about 25 km by road | https://www.gogacab.in/anand-nadiad-distance |
| [DIST-BOR] | Anand - Borsad about 20 km by road | https://www.gogacab.in/anand-borsad-distance |
| [NAPAD] | Napad Talpad about 12 km from Anand by road, PIN 388350 | https://villageinfo.in/gujarat/anand/anand/napad-talpad/ |
| [DHARMAJ] | Dharmaj: Petlad 8 km, Borsad 11 km (list of nearby taluks; Petlad Junction station 8.6 km; the same page's list of nearby cities prints Petlad at 5 km) | http://www.onefivenine.com/india/villages/Anand/Petlad/Dharmaj |
| [GSTIN] | GSTIN = state code (2) + PAN (10) + entity code (1) + default letter Z (1) + checksum (1) | https://cleartax.in/s/know-your-gstin |
| [ADDR-S1] | "Town Hall Road", behind Vivekanand Wadi, Anand, used as a shop address (search listing and the address in the URL; the page itself returned an error in review) | https://www.justdial.com/Anand/Chinese-Wala-Opposite-Gold-Cinema-Behind-Vivekanand-Wadi-Town-Hall-Road/9999P2692-2692-231224181518-T5Q6_BZDET/amp |
| [ADDR-S2] | Nana Bazar, near Shastri ground, Vallabh Vidyanagar, used as a shop address (search listing; the page refused the connection in review, so the landmark is (A)) | https://anandct.com/index.php?Page=207&catcod=&catnm=&mo=search&search= |
| [ADDR-S3] | "Paras Circle, Santram Road, Nadiad - 387001", used as a branch address (page opened in review) | https://locate.au.bank.in/au-small-finance-bank-nadiad-paras-circle-banks-santram-road-nadiad-371014/Home |

Not found in the public record, so assumed: every demand multiplier; which days a bakery in Anand shuts
at Diwali; the college calendar after 14 June 2027; rain days other than 31 July and 14 September 2026,
and the first and last day of each wet season; payment terms, credit limits and collection days; stop order, leg lengths and service
times of the routes; store hours.
