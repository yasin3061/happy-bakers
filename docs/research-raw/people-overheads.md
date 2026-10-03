# People, overheads and the opening position - research parameters

Researched on 2 October 2026 for the Happy Bakers sample (scope v0.3). Happy Bakers is fictional.

- A figure taken from a page that was opened carries its URL. **(L)** = the figure was read in a search
  listing and the page itself could not be opened (blocked, or a certificate error). **(A)** = assumption:
  the public record is silent, a sensible value was chosen.
- Money is in rupees. Overhead amounts are **before GST** unless stated.
- Every parameter is a **rule that holds for any date from 1 January 2026 to 31 December 2027**.
- Read together with `products-prices.md` (sales: Rs 1,08,748 a normal day; retail 46.6%, corporates
  23.4%, own stores 30.0%; store ids S1 Anand town, S2 Vallabh Vidyanagar, S3 Nadiad; routes R1-R4; the
  vans run seven days) and `recipes-yields.md` (two rotary rack ovens, two spiral mixers, a sheeter).
  Where this file needs a sales or volume figure it takes it from those two files.
- All employee names are invented. No name below was chosen from a real business.
- Reviewed on 2 October 2026: the pages behind the wage, fuel, tariff, rent, salary and benchmark figures
  were re-opened, every table was recomputed, and the file was checked against the scope and against
  `products-prices.md`, `recipes-yields.md` and `calendar-geography.md`. What that changed: the van
  kilometres (4.4), the closed-day and due-date rules (4), the monthly profit band (6), the fuel
  surcharge, food-licence and UPI-fee notes (3.4, 4.7, 4.10) and notes 5 and 8-10 of section 8.

Headline: 35 employees on 1 January 2026 costing Rs 7,00,700 a month; overheads other than salaries
about Rs 5.5 lakh a month; target operating profit 9-13% of sales; opening bank Rs 8,75,000, receivables
Rs 8,54,000, payables Rs 9,70,000, stock about Rs 6.1 lakh.

---

## 1. Minimum wages (the floor under every salary)

Gujarat revises the special allowance every 1 April and 1 October. Monthly rate = daily rate x 26.
Zone I = areas of municipal corporations, municipalities and urban development authorities
(https://www.zimyo.com/resources/guides/minimum-wages/gujarat/ (L)). Anand (with Vallabh Vidyanagar and
Karamsad) and Nadiad both became municipal corporations on 1 January 2025
(https://deshgujarat.com/2025/01/01/gujarat-cabinet-approves-9-new-municipal-corporations-operational-with-immediate-effect/),
so the factory and all three stores are **Zone I**. The Vitthal Udyognagar estate itself is a notified
industrial area between Anand and Vallabh Vidyanagar and is not named in that merger; it is taken as
Zone I because it lies inside the area of the Anand-Vallabh Vidyanagar-Karamsad urban development
authority (A).

| Effective | Special allowance, Rs/day | Unskilled: day / month | Semi-skilled: day / month | Skilled: day / month | Status |
|---|---|---|---|---|---|
| 1 Apr 2025 | 45.50 | 497.50 / 12,935 | 507.50 / 13,195 | 519.50 / 13,507 | researched: https://www.sgcms.com/regulatory-updates/minimum-rate-of-wages-gujarat-2/ |
| 1 Oct 2025 | 48.50 | 500.50 / 13,013 | 510.50 / 13,273 | 522.50 / 13,585 | researched: https://www.sgcms.com/regulatory-updates/minimum-rate-of-wages-gujarat-october-2025/ |
| 1 Apr 2026 | 60.50 | 512.50 / 13,325 | 522.50 / 13,585 | 534.50 / 13,897 | researched: https://www.sgcms.com/regulatory-updates/minimum-rate-of-wages-gujarat-april-2026/ and https://labourlawhelp.com/gujarat-minimum-wages/ |
| 1 Oct 2026 | 66.50 (A) | 518.50 / 13,481 | 528.50 / 13,741 | 540.50 / 14,053 | **(A)** - see note |
| 1 Apr 2027 | 72.50 (A) | 524.50 / 13,637 | 534.50 / 13,897 | 546.50 / 14,209 | (A) |
| 1 Oct 2027 | 78.50 (A) | 530.50 / 13,793 | 540.50 / 14,053 | 552.50 / 14,365 | (A) |

Basic rates (Zone I, unchanged through the period): unskilled Rs 452, semi-skilled Rs 462, skilled
Rs 474 a day.

Note on 1 October 2026: on 2 October 2026 none of the pages opened (sgcms.com, labourlawhelp.com) nor
any search listing showed the October 2026 notification; the latest published rates are those of
1 April 2026. The last three steps of the allowance were +10.50 (April 2025, from Rs 35.00 - search
listing (L)), +3.00 (October 2025) and +12.00 (April 2026); **+6.00 a half-year is assumed** from
October 2026 onward. Replace the three (A) rows when the notification appears. No salary
below depends on it: the lowest salary in the directory stays above the floor even if each step were
+12.00 (unskilled would then be Rs 13,637 from October 2026 and Rs 14,261 from October 2027).

Treating the bakery and its shops under the general Zone I rates of the 46 scheduled employments is (A).

---

## 2. Employee directory

### 2.1 Rules

- **35 employees are active on 1 January 2026** (E001-E035). During 2026 two leave and three join
  (E036-E038): headcount 35 (34 on 1-8 March 2026, between E020 leaving and E036 joining), then 36
  from 15 June 2026. No joiner or leaver in 2027.
- An employee is **active on day d** when `joined <= d` and (`left` is empty or `left >= d`). The
  salary bill of a month takes everyone active on its last day, at the full monthly salary (the scope's
  rule; no part months).
- **Monthly salary** is the whole monthly cost of the person to the business (A). Provident fund, ESIC,
  statutory bonus and professional tax are payroll matters and outside the sample.
- **Annual raise: 1 April each year (2026 and 2027), +8%, rounded to the nearest Rs 100**, for every
  employee who joined on or before 31 December of the previous year. The owner takes no raise. (India's
  2026 average increment was projected at 9.1%:
  https://www.angelone.in/news/economy/india-salaries-estimated-to-rise-by-an-average-9-1-in-2026-real-estate-and-nbfcs-lead-growth-aon-survey
  ; a small Anand employer giving Rs 1,100-2,600 a head is (A).)
- **Floor check** on every 1 April and 1 October: `salary = max(salary, minimum wage of the grade)`.
  With the table above it never bites.
- Each raise is a master change dated 1 April with a change-history line ("annual increment 8%").
- Salary benchmarks used: baker Rs 21,589 a month on average in India, range Rs 11,232-41,495
  (https://in.indeed.com/career/baker/salaries); Anand job posts: Tally operator Rs 8,000-12,000,
  driver Rs 15,000-18,000, back office Rs 14,268-15,018, office assistant Rs 20,000
  (https://www.quikr.com/jobs/anand+zwqxj760939060). Supervisory and owner pay are (A).
- Contact numbers are not researched: the generator invents a 10-digit number per employee from the
  seeded stream, shown masked (A).

### 2.2 The directory

Grade = minimum-wage class: U unskilled, SS semi-skilled, S skilled, M supervisory or managerial (paid
well above the skilled floor). Location: Factory, or store S1 Anand town, S2 Vallabh Vidyanagar,
S3 Nadiad.

| Id | Name | Department | Designation | Location | Joined | Grade | Salary 1 Jan 2026 | from 1 Apr 2026 | from 1 Apr 2027 |
|---|---|---|---|---|---|---|---|---|---|
| E001 | Nilesh Patel | Accounts and admin | Owner (proprietor) | Factory | 1 Apr 2011 | M | 90,000 | 90,000 | 90,000 |
| E002 | Falguni Shah | Accounts and admin | Accounts and admin executive | Factory | 16 Jun 2016 | M | 28,000 | 30,200 | 32,600 |
| E003 | Krupa Macwan | Accounts and admin | Accounts assistant (billing) | Factory | 3 Jul 2023 | SS | 15,500 | 16,700 | 18,000 |
| E004 | Imran Vohra | Stores and purchase | Purchase and stores keeper | Factory | 10 Feb 2014 | M | 24,000 | 25,900 | 28,000 |
| E005 | Ramesh Padhiyar | Stores and purchase | Stores helper | Factory | 1 Sep 2021 | U | 14,000 | 15,100 | 16,300 |
| E006 | Bharat Prajapati | Production | Production supervisor | Factory | 5 May 2012 | M | 32,000 | 34,600 | 37,400 |
| E007 | Salim Malek | Production | Master baker, bread and buns | Factory | 12 Aug 2013 | S | 24,000 | 25,900 | 28,000 |
| E008 | Dinesh Solanki | Production | Master baker, toast, khari and biscuit | Factory | 2 Jan 2015 | S | 23,000 | 24,800 | 26,800 |
| E009 | Mukesh Parmar | Production | Pastry and puff maker | Factory | 18 Nov 2019 | S | 20,000 | 21,600 | 23,300 |
| E010 | Vijay Chauhan | Production | Oven operator | Factory | 7 Mar 2018 | S | 17,000 | 18,400 | 19,900 |
| E011 | Sanjay Rathod | Production | Mixer operator | Factory | 21 Jun 2020 | S | 16,500 | 17,800 | 19,200 |
| E012 | Kanu Thakor | Production | Production helper | Factory | 4 Apr 2022 | U | 14,000 | 15,100 | 16,300 |
| E013 | Arvind Vaghela | Production | Production helper | Factory | 15 Jul 2022 | U | 14,000 | 15,100 | 16,300 |
| E014 | Raju Baria | Production | Production helper | Factory | 9 Oct 2024 | U | 13,800 | 14,900 | 16,100 |
| E015 | Suresh Tadvi | Production | Production helper | Factory | 2 Jun 2025 | U | 13,800 | 14,900 | 16,100 |
| E016 | Jyotsna Makwana | Packing | Packing in-charge | Factory | 1 Dec 2016 | S | 17,500 | 18,900 | 20,400 |
| E017 | Mahesh Gohil | Packing | Slicing machine operator | Factory | 14 Feb 2021 | SS | 15,000 | 16,200 | 17,500 |
| E018 | Manjula Vankar | Packing | Packer | Factory | 5 Aug 2022 | U | 13,800 | 14,900 | 16,100 |
| E019 | Sharda Rohit | Packing | Packer | Factory | 20 Jan 2024 | U | 13,800 | 14,900 | 16,100 |
| E020 | Hansa Parmar | Packing | Packer | Factory | 17 Mar 2025 | U | 13,800 | **left 28 Feb 2026** | - |
| E021 | Hardik Thakkar | Dispatch and sales | Sales and dispatch executive | Factory | 1 Jul 2017 | M | 27,000 | 29,200 | 31,500 |
| E022 | Yusuf Pathan | Dispatch and sales | Driver-salesman, route R1 Anand town | Factory | 6 Jun 2015 | S | 19,000 | 20,500 | 22,100 |
| E023 | Jignesh Rabari | Dispatch and sales | Driver-salesman, route R2 Vidyanagar-Karamsad | Factory | 19 Sep 2018 | S | 19,000 | 20,500 | 22,100 |
| E024 | Prakash Christian | Dispatch and sales | Driver-salesman, route R3 Nadiad | Factory | 3 Feb 2020 | S | 18,500 | 20,000 | 21,600 |
| E025 | Ashok Bharwad | Dispatch and sales | Driver-salesman, route R4 Borsad-Petlad | Factory | 23 May 2023 | S | 18,500 | 20,000 | **left 31 Jul 2026** |
| E026 | Kiran Darji | Dispatch and sales | Driver, corporate and store deliveries | Factory | 8 Jan 2024 | S | 18,000 | 19,400 | 21,000 |
| E027 | Vipul Raval | Dispatch and sales | Delivery helper | Factory | 1 Mar 2023 | U | 13,800 | 14,900 | 16,100 |
| E028 | Anil Vasava | Dispatch and sales | Delivery helper | Factory | 12 Dec 2024 | U | 13,800 | 14,900 | 16,100 |
| E029 | Ketan Bhatt | Own stores | Store manager | S1 Anand town | 10 Oct 2017 | M | 23,000 | 24,800 | 26,800 |
| E030 | Rekha Solanki | Own stores | Counter assistant | S1 Anand town | 6 May 2023 | SS | 14,000 | 15,100 | 16,300 |
| E031 | Chirag Panchal | Own stores | Counter assistant | S1 Anand town | 11 Nov 2024 | SS | 13,800 | 14,900 | 16,100 |
| E032 | Nisha Desai | Own stores | Store manager | S2 Vallabh Vidyanagar | 15 Apr 2019 | M | 22,000 | 23,800 | 25,700 |
| E033 | Pooja Mistry | Own stores | Counter assistant | S2 Vallabh Vidyanagar | 2 Sep 2024 | SS | 14,000 | 15,100 | 16,300 |
| E034 | Alpesh Trivedi | Own stores | Store manager | S3 Nadiad | 1 Aug 2021 | M | 19,000 | 20,500 | 22,100 |
| E035 | Daxa Chauhan | Own stores | Counter assistant | S3 Nadiad | 24 Feb 2025 | SS | 13,800 | 14,900 | 16,100 |

Joiners in 2026 (starting salary; first raise on 1 April 2027):

| Id | Name | Department | Designation | Location | Joined | Grade | Starting salary | from 1 Apr 2027 | Why |
|---|---|---|---|---|---|---|---|---|---|
| E036 | Geeta Padhiyar | Packing | Packer | Factory | 9 Mar 2026 | U | 13,800 | 14,900 | replaces E020 |
| E037 | Riya Joshi | Own stores | Counter assistant | S2 Vallabh Vidyanagar | 15 Jun 2026 | SS | 14,500 | 15,700 | new post, for the college term |
| E038 | Firoz Shaikh | Dispatch and sales | Driver-salesman, route R4 Borsad-Petlad | Factory | 1 Aug 2026 | S | 19,500 | 21,100 | replaces E025 |

Leavers: **E020 Hansa Parmar, last day 28 February 2026** (in the February salary bill, not in March);
**E025 Ashok Bharwad, last day 31 July 2026** (in the July bill, not in August). A leaver's record stays
in the directory with status Inactive.

### 2.3 The six demo personas

| Persona | Employee |
|---|---|
| Owner | E001 Nilesh Patel |
| Accounts and admin | E002 Falguni Shah |
| Purchase and stores | E004 Imran Vohra |
| Production supervisor | E006 Bharat Prajapati |
| Sales and dispatch | E021 Hardik Thakkar |
| Store manager (Vallabh Vidyanagar store) | E032 Nisha Desai |

In the seed, day-end entries and claims of stores S1 and S3 carry their own managers (E029, E034) in the
same Store manager role.

### 2.4 Checks for the generator

Headcount on 1 January 2026: Production 10, Packing 5, Stores and purchase 2, Dispatch and sales 8,
Accounts and admin 3, Own stores 7 = **35**. By location: Factory 28, S1 3, S2 2, S3 2.

Monthly salary by department on 1 January 2026: Production 1,88,100; Packing 73,900; Stores and purchase
38,000; Dispatch and sales 1,47,600; Accounts and admin 1,33,500; Own stores 1,19,600.

The salary bill (one line per location), every month to December 2027:

| Salary bill of | Factory | S1 Anand town | S2 Vallabh Vidyanagar | S3 Nadiad | Total | Active on the last day |
|---|---|---|---|---|---|---|
| Jan, Feb, Mar 2026 | 5,81,100 | 50,800 | 36,000 | 32,800 | **7,00,700** | 35 |
| Apr, May 2026 | 6,19,100 | 54,800 | 38,900 | 35,400 | **7,48,200** | 35 |
| Jun, Jul 2026 | 6,19,100 | 54,800 | 53,400 | 35,400 | **7,62,700** | 36 |
| Aug 2026 - Mar 2027 | 6,18,600 | 54,800 | 53,400 | 35,400 | **7,62,200** | 36 |
| Apr - Dec 2027 | 6,60,900 | 59,200 | 57,700 | 38,200 | **8,16,000** | 36 |

2026 total Rs 89.35 lakh (22.2% of the Rs 4.03 crore sales of `products-prices.md`); 2027 total
Rs 96.31 lakh (23.0% of Rs 4.19 crore). Thirty-five people on Rs 4 crore is labour-heavy by
construction of the scope: even at the bare minimum wage 35 people cost 14% of sales.

Salary bill timing (A): dated the last day of the month, approved by the Owner the same day, **paid from
the bank on the 5th of the next month**. The December 2025 salaries were paid before go-live and are not
an opening payable.

---

## 3. Energy and fuel prices (series used by the overhead rules)

### 3.1 Diesel, Anand, Rs per litre (pump price; VAT inside, no GST)

| From | Price | Basis |
|---|---|---|
| 1 Jan 2026 (also 16-31 December 2025, for the bill dated 1 January) | 90.13 | Anand price before the May hikes: https://www.drivespark.com/diesel-price-in-anand/ (the page's own history stops in July 2025; as a cross-check, the Rs 97.89 of 2 October 2026 less the four May hikes of Rs 7.52 is Rs 90.37) |
| 15 May 2026 | 93.13 | +3.00: https://www.businesstoday.in/india/story/petrol-diesel-prices-hiked-in-gujarat-check-new-rates-in-gandhinagar-surat-ahmedabad-and-other-cities-528320-2026-05-15 |
| 19 May 2026 | 94.03 | +0.90, same page (Ahmedabad Rs 94.14 after this step) |
| 23 May 2026 | 94.94 | +0.91: https://www.timestoday.co/2026/05/25/petrol-and-diesel-prices-hiked-again-on-may-25-2026-fourth-increase-in-less-than-two-weeks/ |
| 25 May 2026 | 97.65 | +2.71, same page |
| 1 Jul 2026 to 31 Dec 2027 | 97.89 | Anand, 2 Oct 2026: https://www.businesstoday.in/fuel-price/diesel-price-in-anand-today ; held flat after that (A) - before May 2026 the last change was the Rs 2 cut of 15 March 2024; in September 2026 the daily Anand price moved between Rs 97.57 and Rs 99.53 |

### 3.2 Piped natural gas for the ovens, Rs per standard cubic metre (VAT inside, no GST)

Anand has piped gas from a city-gas co-operative that serves domestic, commercial and industrial
users (https://www.charotargas.com); its commercial rate is not published (the price page shows no
figure) and other Gujarat distributors quote commercial rates only on request
(https://www.vgl.co.in/tariff/tariff-rate/). Anchors: domestic PNG in Anand Rs 48.91 on 2 Oct 2026
(https://www.goodreturns.in/png-price-in-gujarat-s12.html); industrial PNG elsewhere in Gujarat about
Rs 68 after the March-May 2026 supply shock
(https://deshgujarat.com/2026/06/02/morbi-ceramic-gas-demand-rebounds-20-fold-in-three-months-gel/).
The series below is therefore **(A)**, shaped like the commercial LPG series in 3.3:

| Consumption month | Rs/SCM | | Consumption month | Rs/SCM |
|---|---|---|---|---|
| Dec 2025, Jan, Feb 2026 | 52.00 | | Jul 2026 | 64.00 |
| Mar 2026 | 56.00 | | Aug, Sep 2026 | 63.00 |
| Apr 2026 | 60.00 | | Oct 2026 - Mar 2027 | 62.00 |
| May, Jun 2026 | 66.00 | | Apr - Dec 2027 | 63.00 |

Why gas and not diesel or cylinders (A): rack ovens are sold in diesel, LPG and electric versions (a
36-tray oven burns about 2 litres of diesel or 1.4 kg of LPG an hour - manufacturer listing,
https://www.hindchef.com/36-tray-rotary-rack-oven/); that a gas burner runs on piped gas as well is
(A). Per unit of heat, piped gas at Rs 62 is about Rs 6.3 a kWh, diesel at Rs 97.89 about Rs 9.8 and a
19 kg cylinder at Rs 2,873 about Rs 11.8, so a factory on the gas grid uses piped gas. No public source says what Anand's bakeries burn.

### 3.3 Commercial LPG, 19 kg cylinder, Ahmedabad (reference only; not used by the generator)

Jan 2026 Rs 1,709.50; Feb 1,759; Mar 1,903; Apr 2,098; **May 3,091**; Jun 3,133; Jul 2,950; Aug 2,757.50;
Sep 2,767 (https://www.petroldieselprice.com/lpg-gas-cylinder-price-in-Ahmedabad); Oct 2,831.50, and
Rs 2,873 in Anand (https://www.goodreturns.in/lpg-price-in-gujarat-s12.html). This is the real 2026
energy shock that the gas series copies in a milder form.

### 3.4 Electricity (state distribution company for Anand and Nadiad: MGVCL)

The tariff did not change for 2026-27
(https://deshgujarat.com/2026/03/25/gerc-unveils-fy-2026-27-power-tariff-in-gujarat-no-base-rate-hike-more-rebates-for-smart-meters-solar-hours/).
The 2027-28 order is not out; the same rates are held to December 2027 (A).

| | Factory: Rate LTMD (load above 40 kW) | Stores: Rate Non-RGP (load up to 10 kW) |
|---|---|---|
| Fixed charge | Rs 90 per kW for the first 40 kW of billing demand, Rs 130 for the next 20 kW, Rs 195 above 60 kW; billing demand is at least 85% of the contract demand | Rs 50 per kW a month |
| Energy charge | Rs 4.60 per unit | Rs 4.35 per unit |
| Fuel surcharge (FPPPA) | Rs 2.45 per unit for consumption to March 2026; **Rs 2.52 from April 2026 to December 2027 (A)**. The sources disagree on 2026-27: the regulator kept the base at Rs 2.45 (https://solarquarter.com/2026/03/27/gerc-issues-ugvcl-tariff-order-for-fy27-projects-%E2%82%B9906-crore-surplus-and-introduces-green-tariff/); one calculator shows Rs 2.52, another Rs 2.45 + 3.99% from July 2026 (about Rs 2.55), and the LTMD page still shows an old Rs 3.35. The surcharge is revised each quarter; Rs 0.07 a unit is about Rs 700 a month on the factory bill | same |
| Electricity duty | 10% of the charges (industrial, low tension) | 20% (commercial) |
| GST | none | none |
| Sources | https://gebguru.in/mgvcl-unit-rate-in-ltmd-industrial/ ; official schedule (L): https://gercin.org/wp-content/uploads/2026/03/Tariff-Schedule-of-DGVCL-MGVCL-PGVCL-UGVCL-w.e.f.-01.04.2026.pdf | https://electricitybillcalculator.in/mgvcl-bill-calculator/ (also the Rs 2.52 base surcharge); duty: https://billunits.in/state-calculators/ugvcl-bill-calculator/ ; Rs 2.45: https://thediscombill.com/tariffs/gujarat/dgvcl/ |

Factory (A): contract demand 55 kW, billing demand 50 kW, so the fixed charge is 40 x 90 + 10 x 130 =
**Rs 4,900 a month**. Stores (A): 5 kW each, fixed charge **Rs 250**.

---

## 4. Overheads: one rule per bill

Common rules.

- `V(M)` = volume factor of month M = (kg of maida and atta consumed in M / days in M) divided by the same
  figure for January 2026. `V = 1` for December 2025.
- A utility bill dated in month M covers the consumption of month M-1 and is an expense of month M (its
  bill date). So January 2026 carries bills for December 2025 consumption; there is no opening expense
  payable.
- Every expense bill waits for the Owner (scope). In the seed the Owner approves it 0-2 days after the
  bill date and accounts pays it from the **bank** on the due date. A bill dated within two days of the
  business date is left "Submitted"; an approved bill not yet due is left unpaid - these fill the
  approvals list and "bills due this week".
- A bill for which no due date is given below is due 7 days after its date (A).
- **Closed days** (`calendar-geography.md` 3.1: 9, 10 and 11 November 2026; 30 and 31 October 2027).
  A bill keeps its date - it is the vendor's document, and the scope dates the salary bill on the last
  day of the month - so the bills of 31 October 2027 (salary bill, accountant's retainer, housekeeping,
  bank charges) stay in October. A seeded-day bill and a claim are never drawn on a closed day. An
  approval, a payment or a claim reimbursement that falls on a closed day moves to the next open day.
- "Noise +/-x%" = one draw per bill from the seeded stream. Amounts are rounded to the rupee.
- Location is the factory unless a store is named. GST shown on a bill is input credit (scope).
- Vendor display names: use generic names for the utilities, the bank, the insurer and government fees
  ("Electricity distribution company", "City gas distributor"...). Six invented names were searched
  on 2 October 2026 and gave no match in Anand: Kesarvan Estates LLP (factory landlord), Tulsivan Fuel
  Point (diesel), Agnitej Oven Services (oven and machinery service), Jantumukt Pest Care, Swachhmitra
  Facility Services (housekeeping), Chitrakala Print and Sign (printer). The vendor master decides.

### 4.1 Rent

| Premises | Size and rate | Monthly rent | Escalation (rounded to Rs 100) | Bill | Vendor type | GST |
|---|---|---|---|---|---|---|
| Factory shed, Vitthal Udyognagar GIDC | 5,000 sq ft built-up on a GIDC plot, Rs 18 a sq ft | 90,000 | +5% every 1 April: 94,500 from Apr 2026; 99,200 from Apr 2027 | dated the 1st, due the 7th | landlord, GST-registered firm | 18% |
| Store S1, Anand town | 400 sq ft ground floor, Rs 75 | 30,000 | +5% every 1 October: 31,500 from Oct 2026; 33,100 from Oct 2027 | dated the 1st, due the 5th | landlord, individual, unregistered | none |
| Store S2, Vallabh Vidyanagar | 320 sq ft ground floor, Rs 69 | 22,000 | +7% every 1 July: 23,500 from Jul 2026; 25,100 from Jul 2027 | same | same | none |
| Store S3, Nadiad | 280 sq ft ground floor, Rs 54 | 15,000 | +5% on 1 January 2027: 15,800 | same | same | none |

Basis. Shops: Vidyanagar 420 sq ft ground floor Rs 30,000 a month (Rs 71 a sq ft) and an office of
450 sq ft Rs 25,000 (https://www.realestateindia.com/anand-property/commercial-property-for-rent.htm);
Vidyanagar 280 sq ft Rs 20,000 and 167 sq ft Rs 8,500
(https://www.ghar.tv/resale/shops-on-rent-in-anand/1-2-23-156-0-0-0-2.html (L)); Ganesh Circle, Anand
108 sq ft Rs 7,500 and Anand-Vidyanagar Road 350 sq ft Rs 35,000
(https://www.olx.in/amul-dairy-area_g5350935/for-rent-shops-offices_c1731 (L)); Santram Road, Nadiad,
small office Rs 8,500 (https://www.olx.in/anand_g4058679/for-rent-shops-offices_c1731 (L)).
Shed: no priced listing for Vitthal Udyognagar was found (a 12,000 sq ft factory listed under Vallabh
Vidyanagar on the realestateindia page above is "price on request"). Nearby: warehouse at Sarsa, Anand district, 5,400 sq ft
Rs 55,000 (Rs 10 a sq ft, same page); Makarpura GIDC, Vadodara, 5,000 sq ft Rs 1.75 lakh (Rs 35)
(https://www.99acres.com/factory-land-for-rent-in-vadodara-ffid (L)); Vapi GIDC Rs 15 a sq ft
(https://www.99acres.com/warehouse-for-rent-in-gidc-vapi-ffid (L)). **Rs 18 a sq ft and 5,000 sq ft are
(A)**: enough for two rack ovens, mixers, proofing, cooling and slicing, packing, two stores and an
office for 28 people.
Reverse charge: since 10 October 2024 a registered tenant owes 18% GST under reverse charge on
commercial rent paid to an unregistered landlord
(https://taxguru.in/goods-and-service-tax/reverse-charge-commercial-property-rent-unregistered-persons.html (L)).
The sample does not model reverse charge, so the three store rent bills carry no GST.

### 4.2 Electricity

| Bill | Units (kWh) for consumption month M | Amount | Dated | Due |
|---|---|---|---|---|
| Factory | `310 x days in M x S_f(M) x (0.60 + 0.40 x V(M))`, noise +/-3% | `(kWh x (4.60 + F) + 4,900) x 1.10` | 6th | 16th |
| Store S1 | `620 x S_s(M)`, noise +/-5% | `(kWh x (4.35 + F) + 250) x 1.20` | 12th | 22nd |
| Store S2 | `520 x S_s(M)`, noise +/-5%; x 0.85 when M is May or November (college vacation) | same formula | 12th | 22nd |
| Store S3 | `400 x S_s(M)`, noise +/-5% | same formula | 12th | 22nd |

`F` = 2.45 for consumption months to March 2026, 2.52 after. Vendor type: utility; no GST.

| Month | Jan | Feb | Mar | Apr | May | Jun | Jul | Aug | Sep | Oct | Nov | Dec |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `S_f` factory | 0.94 | 0.95 | 1.00 | 1.06 | 1.10 | 1.08 | 1.02 | 1.00 | 1.00 | 1.00 | 0.95 | 0.93 |
| `S_s` stores | 0.80 | 0.85 | 1.00 | 1.20 | 1.30 | 1.25 | 1.10 | 1.05 | 1.05 | 1.00 | 0.85 | 0.80 |

Units, load and the seasonal shape (hot April-June: fans, the cold room for margarine and paneer, the
store chillers) are (A). Checks: factory, a 30-day month at factor 1.00 = 9,300 units = Rs 77,512 at
F 2.45 and Rs 78,228 at F 2.52, about Rs 8.40 a unit all-in; the first bill (6 Jan 2026, for December
2025, before noise) = 8,937 units = Rs 74,696. Stores at factor 1.00 and F 2.52: S1 Rs 5,411,
S2 Rs 4,587, S3 Rs 3,598.

### 4.3 Oven fuel - piped gas

`SCM for month M = 63 x days in M x (0.30 + 0.70 x V(M))`, noise +/-3%; amount = SCM x the price of M in
3.2. One bill dated the **3rd**, due the 13th; vendor type utility; no GST. Check: bill of 3 Jan 2026 =
1,953 SCM x 52 = Rs 1,01,556; a 30-day month at Rs 62 = Rs 1,17,180.
63 SCM a day (A) is about 2.7 MJ per kg for the 830 kg of finished goods a day of `products-prices.md`,
which allows for the double bake of toast and the idle hours of two rack ovens.

### 4.4 Delivery vans - diesel

Five vehicles, all owned (A): four mini-trucks of the Tata Ace class on the four routes and a fifth for
corporate orders, store transfers and market purchases. Payload 900 kg, claimed 22 km a litre
(https://trucks.tractorjunction.com/en/tata-truck/ace-gold-diesel); **15 km a litre in loaded stop-start
use is (A)**.

| Vehicle | Driver | Delivery run (`calendar-geography.md` 10.2) | All running a day (A) | Litres a day |
|---|---|---|---|---|
| V1, route R1 Anand town | E022 | 27.1 km | 39 km | 2.6 |
| V2, route R2 Vidyanagar-Karamsad | E023 | 23.2 km | 35 km | 2.3 |
| V3, route R3 Nadiad (also store S3 and corporate C07) | E024 | 60.3 km | 72 km | 4.8 |
| V4, route R4 Borsad-Petlad | E025, then E038 | 66.0 km | 78 km | 5.2 |
| V5, stores S1 and S2 and nine corporates | E026 | 28.3 km | 61 km | 4.1 |
| **All five** | | **204.9 km** | **285 km** | **19.0** |

The delivery runs are the measured routes of `calendar-geography.md` (205 km a day); use those figures
wherever a route distance is shown. The other 80 km a day is everything else the vehicles do (A): about
12 km for each route van (a second drop for a short or late order, the weekly collection round, the pump
and the garage) and about 33 km for V5 (the vegetable and paneer market, the bank, afternoon top-ups to
the stores, urgent corporate orders). The generator needs only the total: **19.0 litres a day**.

The vans run seven days. A closed day in the event calendar burns no diesel. Fuel is bought on account at
one fuel station: **two bills a month**, dated the 16th (for days 1-15) and the 1st (for day 16 to the
end of the previous month); amount = sum over the days of 19.0 litres x that day's price in 3.1, noise
+/-4%; due 7 days after the bill date; no GST. Checks: a 30-day month = 570 litres = Rs 51,374 at
Rs 90.13 and Rs 55,797 at Rs 97.89. Top-ups bought on the road are expense claims (section 5).

### 4.5 Delivery vans - maintenance

Vendor type: garage (GST 18%).

- Service: each van every third month - V1 and V4 in Jan, Apr, Jul, Oct; V2 and V5 in Feb, May, Aug,
  Nov; V3 in Mar, Jun, Sep, Dec. Bill dated the 12th (V1, V2, V3) or the 22nd (V4, V5), Rs 3,800-5,200,
  due in 15 days.
- Tyres: Rs 9,600 a van once a year, a separate bill on the date of that month's service: V1 April,
  V2 May, V3 June, V4 October, V5 November.
- Battery: Rs 6,500, one van a year, a separate bill dated 22 August (V5 in 2026, V2 in 2027).
- About Rs 1,44,500 a year (20 services, 5 sets of tyres, 1 battery), Rs 12,000 a month, plus small
  claims. Amounts are (A).

### 4.6 Repairs and maintenance (plant and building)

Vendor type: service engineer or spares dealer (GST 18%). Amounts are (A).

- Annual maintenance contract for the ovens, mixers, slicers and the cold room: Rs 36,000 a quarter,
  bill dated 10 January, April, July and October, due in 15 days.
- Breakdown and spares (burner parts, belts, bearings, slicer blades, thermostat): one bill every month
  on a seeded day between the 8th and the 26th, Rs 3,000-10,000; a second bill in every third month
  (March, June, September, December), Rs 8,000-16,000.
- Generator service: Rs 4,500, dated 15 May and 15 November.
- One seeded event: **18 August 2026, proofer compressor replaced, Rs 42,000** - it makes August's
  repairs stand out in the spend report.
- Average about Rs 23,300 a month before the event, plus about Rs 4,100 of small claims (section 5).

### 4.7 Licences and insurance (yearly bills, the same dates in 2026 and 2027)

| Date | Bill | Amount | Location | Vendor type | GST |
|---|---|---|---|---|---|
| 10 Jan, 10 Jul | Product testing at a food laboratory | 6,500 each | Factory | laboratory | 18% |
| 15 Feb | Weights and measures verification | 1,500 | Factory | government fee | none |
| 20 Feb (V1), 20 May (V2), 20 Jul (V3), 20 Sep (V4), 20 Nov (V5) | Van insurance, package policy | 22,000 each | Factory | insurer | 18% |
| same five dates | Van fitness and permit fee | 1,500 each | Factory | government fee | none |
| 1 Apr | Fire and burglary cover for plant, stock and fittings | 24,000 | Factory | insurer | 18% |
| 1 Apr | Employees' compensation policy | 18,000 | Factory | insurer | 18% |
| 1 Apr | Money-in-transit and fidelity cover | 4,500 | Factory | insurer | 18% |
| 10 Jun | Food licence fee, manufacturer | 5,000 | Factory | government fee | none |
| 10 Jun | Food licence fee, retail counter | 2,000 each | S1, S2, S3 | government fee | none |
| 25 Sep | Professional tax, employer's enrolment | 2,500 | Factory | government fee | none |
| 20 Oct | Factory licence renewal | 2,000 | Factory | government fee | none |

Total Rs 1,94,000 a year, Rs 16,200 a month on average. Each bill is due 7 days after its date.
Basis: food licence, state level - manufacturer Rs 3,000-5,000 a year, retailer Rs 2,000
(https://velcolegalindia.com/blog/fssai-license-fees-complete-guide-2026; the same page says licences
applied for after 1 April 2026 pay once - a yearly fee is kept here as (A)). The Rs 5,000 slab is for a
capacity above 1 tonne a day and Rs 3,000 below it (the regulator's fee chart, search listing (L):
https://foscos.fssai.gov.in/assets/docs/KindofBusinessEligibility.pdf); Happy Bakers bakes about 0.85
tonne a day, so Rs 5,000 assumes an installed capacity above 1 tonne (A). From 1 April 2026 the state
licence is for a turnover of Rs 1.5-50 crore and plain registration (Rs 100 a year) is enough below
that (https://tallysolutions.com/business-guides/fssai-license-fees-cost-of-food-business-registration/);
a store counter selling under Rs 1.5 crore may therefore need only the registration - Rs 2,000 a store
is kept as (A), the difference is Rs 5,700 a year. Third-party premium for a
goods vehicle up to 7,500 kg Rs 16,049 (https://www.deccanherald.com/amp/story/business%2Fgovt-issues-draft-motor-third-party-premium-and-liability-rules-for-fy24-1229631.html (L)),
plus own-damage cover (A); Gujarat factory licence fee Rs 704 for 21-50 workers and 10-50 horsepower
(https://www.professionalutilities.com/factory-license-registration-certificate/gujarat.php (L)) -
Rs 2,000 for the next power slab is (A). All other amounts are (A).

### 4.8 Telephone and internet

One bill per location, dated the **5th**, due the 20th; vendor type telecom operator; GST 18%.
Factory Rs 3,989 (fibre broadband Rs 999 + ten mobile connections at Rs 299); each store Rs 898
(broadband Rs 599 + one mobile connection). Total Rs 6,683 a month, fixed through 2027 (A).

### 4.9 Accounting and professional fees

Vendor type: chartered accountant's firm; GST 18%. Retainer for monthly books review, GST returns and
TDS: **Rs 12,000**, bill dated the last day of each month, due in 15 days. Tax audit and income-tax
return: **Rs 60,000**, bill dated 25 September each year. Average Rs 17,000 a month. (A)

### 4.10 Bank charges

One bill from the bank dated the last day of each month, paid from the bank the same day (the bank debits
it; in the seed the Owner's approval is logged the same day): **Rs 1,500 + Rs 1.50 per Rs 1,000 of cash
deposited in the month**; GST 18%. With about Rs 13 lakh of cash deposits this is about Rs 3,500. (A)
For scale: a regular current account allows Rs 2 lakh of free cash deposits a month, then Rs 3.50 per
Rs 1,000 (https://upstox.com/news/personal-finance/latest-updates/hdfc-bank-cash-deposit-charges-how-much-do-you-have-to-pay-for-depositing-cash-in-current-and-savings-account/article-166705/ (L));
Happy Bakers is assumed to hold a higher-limit account. UPI receipts at the stores carry no charge: the
0.4% merchant fee on UPI payments to merchants, in force from 15 October 2026, applies only to payments
above Rs 2,000 and is capped at Rs 300
(https://www.scconline.com/blog/post/2026/09/16/npci-released-upi-mdr-faqs-explained/); store tickets
are far smaller. A weekly outlet that settles Rs 5,000-14,000 by UPI would carry the fee from that date -
about Rs 1,400 a month if half the weekly collections came by UPI. The sample does not model it (A;
section 8, note 9).

### 4.11 Staff welfare

- Tea, milk and snacks at the factory: weekly claims (section 5), about Rs 9,000 a month.
- Uniforms, aprons and caps: Rs 18,000, bills dated 10 April and 10 October; garment supplier; GST 5%.
- Medical fitness certificates for food handlers: Rs 400 x (active employees - 3), bill dated 20 March;
  clinic; no GST. Rs 12,800 in 2026 (35 active), Rs 13,200 in 2027 (36 active).
- **Diwali sweets and gifts: Rs 1,500 x (active employees - 1)**, bill dated five days before Diwali:
  **3 November 2026** and **24 October 2027** (Diwali is 8 November 2026 and 29 October 2027:
  https://dekhopanchang.com/en/festivals/diwali/2027 (L)); sweet and gift supplier; GST 5%.
  Rs 52,500 each year.
- Average about Rs 18,700 a month. All (A).

### 4.12 Marketing

- Display racks, crates and shop boards for outlets: one bill a month on a seeded day between the 10th
  and the 20th, Rs 4,000-9,000; fabricator or printer; GST 18%.
- Local advertising and social media: Rs 5,000, bill dated the 28th; agency; GST 18%.
- Festival leaflets and banners: Rs 8,000 dated 5 January (Uttarayan); Rs 12,000 dated 15 days before
  Diwali (24 October 2026, 14 October 2027); printer; GST 18%.
- Average about Rs 13,800 a month including the sampling claims. All (A).

### 4.13 Running costs (housekeeping, water, pest control, stationery, courier, conveyance)

- Housekeeping contractor at the factory: Rs 9,000, bill dated the last day of the month; GST 18%.
- Water charges for the shed: Rs 2,200, bill dated the 8th; estate water supply (utility); no GST.
- Pest control: Rs 4,500, dated 15 February, May, August and November; GST 18%.
- Everything else arrives as claims (section 5), about Rs 12,900 a month, of which the three stores
  together about Rs 4,200.
- Average about Rs 25,600 a month. All (A).

---

## 5. Expense categories and claims

### 5.1 The category list (14)

| # | Category | Normally arrives as | Typical month, Rs | Notes |
|---|---|---|---|---|
| 1 | Salaries | salary bill (last day of the month) | 7,00,700 | one line per location |
| 2 | Rent | vendor bill | 1,57,000 | factory and three stores |
| 3 | Electricity | vendor bill | 91,000 | factory and three stores |
| 4 | Oven fuel (gas) | vendor bill | 1,05,800 | factory |
| 5 | Vehicle fuel | vendor bill (fuel station, twice a month); **claims** for top-ups on the road | 54,400 | factory |
| 6 | Vehicle maintenance | vendor bill; **claims** for punctures and small jobs | 12,700 | factory |
| 7 | Repairs and maintenance | vendor bill; **claims** for small spares and local tradesmen | 27,400 | factory, stores |
| 8 | Licences and insurance | vendor bill, yearly | 16,200 | factory, stores |
| 9 | Telephone and internet | vendor bill; an occasional **claim** for a recharge | 7,000 | factory, stores |
| 10 | Professional fees | vendor bill | 17,000 | factory |
| 11 | Bank charges | vendor bill (the bank) | 3,500 | factory |
| 12 | Staff welfare | **claims** (tea, snacks, drinking water); bills for uniforms and Diwali | 18,700 | factory, stores |
| 13 | Marketing | vendor bill; **claims** for sampling | 13,800 | factory |
| 14 | Running costs | **claims** mostly; bills for housekeeping, water, pest control | 25,600 | factory, stores |

"Store cash short or excess", production loss, write-offs and count differences are P&L lines that come
from other documents; they are not expense categories.

### 5.2 Claims in the seed (A)

About **40 claims a month, about Rs 32,000**, average about Rs 790. Each row is drawn from the seeded stream:
the count is spread over the month on working days, the amount is uniform in the range, rounded to
Rs 10. A claim amount is the total paid, GST included, with no GST split.

| Claim | Category | Raised by | Location | A month | Amount, Rs |
|---|---|---|---|---|---|
| Staff tea, milk and snacks (weekly, on Saturdays) | Staff welfare | Production supervisor | Factory | 4 | 1,900-2,600 |
| Diesel top-up on the route | Vehicle fuel | Sales and dispatch | Factory | 3 | 500-1,500 |
| Puncture or small van job | Vehicle maintenance | Sales and dispatch | Factory | 2 | 150-550 |
| Toll and parking | Running costs | Sales and dispatch | Factory | 2 | 80-300 |
| Customer visit, conveyance | Running costs | Sales and dispatch 1, Owner 1 | Factory | 2 | 600-2,200 |
| Sampling and display at outlets | Marketing | Sales and dispatch | Factory | 1 | 300-900 |
| Mobile recharge or data pack | Telephone and internet | Sales and dispatch | Factory | 1 | 239-479 |
| Loading and unloading labour | Running costs | Purchase and stores | Factory | 3 | 300-800 |
| Cleaning supplies, gloves, hairnets | Running costs | Purchase and stores | Factory | 2 | 400-1,200 |
| Small hardware and spares; electrician or plumber | Repairs and maintenance | Purchase and stores 2, Production supervisor 1 | Factory | 3 | 250-1,800 |
| Courier | Running costs | Accounts and admin | Factory | 2 | 80-350 |
| Stationery and printer supplies | Running costs | Accounts and admin | Factory | 2 | 300-1,500 |
| Housekeeping and cleaning supplies | Running costs | Store manager | each store | 2 each | 200-600 |
| Carry bags, napkins, billing rolls | Running costs | Store manager | each store | 1 each | 300-900 |
| Drinking water and tea | Staff welfare | Store manager | each store | 1 each | 250-550 |
| Small repair at the store (light, lock, tap) | Repairs and maintenance | Store manager | each store | 1 every second month each | 200-1,200 |

- Claimants are the six persona employees and, for stores S1 and S3, their managers E029 and E034.
- The Owner approves a claim 0-2 days after it is raised and **rejects 3%** of them (reasons drawn from:
  "no bill attached", "duplicate of an earlier claim", "personal expense"). The Owner's own claim is
  approved by the Owner and logged as such.
- Accounts reimburses approved claims **every Saturday**: factory claims from factory cash, store
  managers' claims by bank transfer.
- At the business date, claims raised in the last two days are still "Submitted" and claims approved
  since the last Saturday sit on the "claims to reimburse" list.
- Every claim carries a bill reference of the form `CB-<4 digits>` or `no bill - voucher`.

---

## 6. Target monthly P&L

Reference month: 30 days, sales **Rs 33,00,000** before GST and net of credit notes, costs at March
2026 rates (gas Rs 56, diesel Rs 90.13, the January-March salary bill). The right-hand column re-prices
the same month at October 2026 costs (gas Rs 62, diesel Rs 97.89, the August 2026 salary bill, rents
after their 2026 escalations).

| Line | Rs | % of sales | At October 2026 costs, Rs | % |
|---|---|---|---|---|
| **Sales** (retail 46.6%, corporates 23.4%, own stores 30.0%) | 33,00,000 | 100.0 | 33,00,000 | 100.0 |
| Recipe cost of goods sold | 15,80,700 | 47.9 | 15,80,700 | 47.9 |
| Production loss | 9,900 | 0.3 | 9,900 | 0.3 |
| Write-offs (expired and damaged; mostly store puffs and bread) | 46,200 | 1.4 | 46,200 | 1.4 |
| Stock count differences | 13,200 | 0.4 | 13,200 | 0.4 |
| **Material cost** | **16,50,000** | **50.0** | 16,50,000 | 50.0 |
| **Gross margin** | **16,50,000** | **50.0** | 16,50,000 | 50.0 |
| Salaries | 7,00,700 | 21.2 | 7,62,200 | 23.1 |
| Rent | 1,57,000 | 4.8 | 1,64,500 | 5.0 |
| Electricity | 91,000 | 2.8 | 91,800 | 2.8 |
| Oven fuel (gas) | 1,05,800 | 3.2 | 1,17,200 | 3.6 |
| Vehicle fuel | 54,400 | 1.6 | 58,800 | 1.8 |
| Vehicle maintenance | 12,700 | 0.4 | 12,700 | 0.4 |
| Repairs and maintenance | 27,400 | 0.8 | 27,400 | 0.8 |
| Licences and insurance | 16,200 | 0.5 | 16,200 | 0.5 |
| Telephone and internet | 7,000 | 0.2 | 7,000 | 0.2 |
| Professional fees | 17,000 | 0.5 | 17,000 | 0.5 |
| Bank charges | 3,500 | 0.1 | 3,500 | 0.1 |
| Staff welfare | 18,700 | 0.6 | 18,700 | 0.6 |
| Marketing | 13,800 | 0.4 | 13,800 | 0.4 |
| Running costs | 25,600 | 0.8 | 25,600 | 0.8 |
| **Total expenses** | **12,50,800** | **37.9** | 13,36,400 | 40.5 |
| *of which overheads other than salaries* | *5,50,100* | *16.7* | *5,74,200* | *17.4* |
| **Operating profit** (before depreciation, interest and income tax) | **3,99,200** | **12.1** | 3,13,600 | 9.5 |

Yearly items are shown at one-twelfth; in the sample they fall in their own months, so a month with the
audit fee, the insurance renewals or Diwali shows a visibly lower profit.

Calibration bands for the integrator (tune parameters, never outputs):

- Material cost **47-53% of sales** in a normal month. It is an output of recipes x purchase prices x the
  channel mix; if the costing run lands outside the band, change a purchase price or a list price, not
  this table. Production loss about 0.5% of material cost (`recipes-yields.md`); write-offs 1-2% of
  sales; count differences under 0.5%.
- Salaries 20-24% of sales; overheads other than salaries 15-19%.
- **Operating profit 9-13% of sales in the reference month and about 10% over each year.** Single
  months move between about 5% and about 15% as the yearly bills fall (worked through month by month
  with the rules of sections 2-5, the sales of `products-prices.md` 9.2 and material cost held at 50%):
  January, March and December are the best; May is the lowest ordinary month (school vacation, sales
  of about Rs 29.4 lakh: about 5%). **The Diwali month is the exception.** With the closed days and thin
  weeks of `calendar-geography.md` 12, November 2026 sells about Rs 27.5 lakh instead of Rs 31.5 lakh
  and carries the Rs 52,500 Diwali bill, so it comes out at about break-even; October and November 2027
  come out at 6-7%. Never negative over a quarter (the weakest, April-June, still earns about Rs 6 lakh).
  The 1 July 2026 price revision (+6% on the fresh lines) restores what the April raise and the May fuel
  prices take away.

What the public record says, and how Happy Bakers sits against it:

| Benchmark | Figure | Source |
|---|---|---|
| Large listed Indian biscuit and bakery company, 2025-26: gross margin; operating (EBITDA) margin | 45.2%; 12.6% | https://quartr.com/events/mrs-bectors-food-specialities-limited-bectorfood-q4-25-26_FRT7QLY2 (L); https://www.whalesbook.com/corporate-news/English/consumer-products/Mrs-Bectors-Food-FY26-Revenue-Up-91percent-Profit-Declines-16percent/6a1923466ec823f1f29093d6 |
| Same company, employee cost | 13.8% of sales in 2024-25 | https://www.marketsmojo.com/news/result-analysis/mrs-bectors-food-q3-fy26-margin-pressures-cloud-revenue-growth-story-3833657 (L) |
| Model project report, small bread-only unit: raw material Rs 32-35 per kg of bread against a selling price of Rs 45 a kg; year 1 sales Rs 53.46 lakh, raw material Rs 38.40 lakh | 72% of sales | https://uphorticulture.in/DPR/Bakery/Bread%20%20Manufacturing.pdf |
| Retail bakeries in India: raw material; overall margin | 35-40% of revenue; 20-40% | https://blog.petpooja.com/growth-scaling/cost-opening-bakery-india-city-wise-breakdown/ |
| Retail bakery: raw material 28-35%, net margin 12-22% | | https://trufflenationonline.com/blog/bakery-profit-margin/ |
| Bread is "a low margin business"; returns above 10% of dispatches are common | | https://aibma.com/industry.html (L; also cited in the scope) |

Happy Bakers' 50% material cost sits between the bread-only unit (72%, plain bread at Rs 45 a kg in 2020)
and the retail bakery (35%): 40% of its sales are toast, khari, biscuit, cake and puffs, it sells direct
with no distributor margin, and 30% of sales are at MRP through its own stores. Its salaries are far
above the listed company's 13.8% because it is small, runs its own vans and staffs three counters; the
operating margin ends near the listed company's 12.6%.

---

## 7. Opening position on 1 January 2026

All figures are opening entries dated 1 January 2026 (scope 4.1). Splits by customer and vendor are (A)
and indicative: the customer and vendor masters decide credit days and who is on credit; keep the totals
and the ageing shape.

### 7.1 Cash and bank

| Cash point | Opening balance | Made up of |
|---|---|---|
| Factory cash | 64,500 | petty-cash float 25,000 + route cash collected on 31 December, not yet deposited |
| Store S1 Anand town | 17,900 | float 3,000 + cash sales since the last deposit |
| Store S2 Vallabh Vidyanagar | 10,300 | float 3,000 + cash sales since the last deposit |
| Store S3 Nadiad | 10,100 | float 3,000 + cash sales since the last deposit |
| Bank (one current account) | 8,75,000 | about 12 days of payments other than salaries |

Deposit rules that keep these balances stable (A): factory cash is deposited every bank working day,
leaving Rs 25,000; each store deposits every Monday and Thursday, leaving its Rs 3,000 float (1 January
2026 is a Thursday, so each store makes a deposit on day one). Store cash is 40% of sales at S1 and S3
and 25% at S2 (`products-prices.md`).

### 7.2 Receivables: Rs 8,54,000 (about 8 days of total sales)

| Who owes | Customers | Amount | Age on 1 January 2026 |
|---|---|---|---|
| Retail outlets on weekly credit, up to date | 12 outlets (the prompt weekly accounts of `calendar-geography.md` 8: O01, O05, O10, O11, O12, O14, O17, O23, O25, O32, O33, O34) | 84,000 | not due: each owes 1-7 days of supply (4 on average), Rs 3,000-12,000, due on its route's next collection day: R4 Thursday 1 January, R1 Monday 5, R2 Tuesday 6, R3 Wednesday 7 January |
| Retail outlets, slow payers | 4 outlets (the four slow outlets of `products-prices.md`: O04, O19, O28, O38) | 52,000 | O38 Rs 11,200 due 29 Dec (3 days overdue); O04 Rs 13,400 due 22 Dec (10 days); O19 Rs 9,600 due 11 Dec (21 days); O28 Rs 17,800 due 19 Nov (43 days) |
| Retail outlets on cash on delivery | 24 outlets | 0 | - |
| Corporates, not due | C01 1,48,000; C02 92,000; C03 78,000; C07 24,000; C09 31,000; C10 33,000 | 4,06,000 | due 5-28 January |
| Corporates, overdue | C04 hostel mess 46,000 due 24 Dec (8 days); C05 hospital kitchen 1,12,000 due 12 Dec (20 days); C06 caterer 58,000 due 3 Dec (29 days); C08 hotel 96,000 due 26 Nov (36 days) | 3,12,000 | 8-36 days overdue |
| Own stores | - | 0 | transfers are not sales |
| **Total** | 26 opening invoices | **8,54,000** | |

Ageing: not due 4,90,000; 1-15 days overdue 70,600; 16-30 days 1,79,600; 31-60 days 1,13,800; over 60
days nil. Corporates owe Rs 7,18,000, about 28 days of their sales; retail outlets Rs 1,36,000.
On the collection days of `calendar-geography.md` 8 the twelve prompt outlets would owe about Rs 55,000
on the evening of 31 December (R1 three days of supply, R2 two, R3 one, R4 seven); Rs 84,000 assumes
that the year-end week's collections ran a few days behind (A). Keep the total.

Collection of the opening invoices in the seed: a not-due invoice is received in full on its due date
(corporates 0-3 days late); O38 on 3 Jan; C04 on 6 Jan; O04 on 8 Jan; O19 on 12 Jan; C05 on 15 Jan;
C06 half on 20 Jan and half on 10 Feb; C08 on 28 Jan; O28 half on 15 Jan and half on 15 Feb. The two
part payments show a part-settled invoice in the statement.

### 7.3 Payables: Rs 9,70,000 (about 18 days of material purchases)

One opening bill per material vendor. Amount = the vendor's normal daily purchases x its credit days.

| Vendor group | Vendors | Credit days | Opening bills |
|---|---|---|---|
| Flour mills (maida, atta) | 2 | 15 | 2,90,000 |
| Fats and oils (shortening, margarine, butter, oil) | 3 | 21 | 2,50,000 |
| Sugar, yeast, milk powder and other bakery ingredients | 6 | 15-30 | 1,75,000 |
| Packing (bags, pouches, boxes, labels) | 4 | 30 | 2,30,000 |
| Fresh (potato, onion, peas, paneer, garlic) | 3 | 7, or cash | 25,000 |
| **Total** | **18** | | **9,70,000** |

Due dates: **overdue Rs 92,000** (one packing vendor Rs 64,000 due 19 December, one ingredient vendor
Rs 28,000 due 27 December; both paid on 5 January); due 1-7 January Rs 3,60,000; due 8-31 January
Rs 5,18,000. No expense bill and no salary is outstanding at opening (rent is billed on 1 January,
utilities during January, December salaries were paid).

### 7.4 Stock: about Rs 6.1 lakh at opening rates (about 11 days of material cost)

Raw and packing materials in the factory raw store, in days of normal consumption (the daily use of each
material is in `recipes-yields.md`, scaled to the sales volumes; value follows from the opening rates):

| Class | Days held | Why |
|---|---|---|
| Maida, atta | 5 | a truck twice a week; 50 kg bags |
| Sugar | 8 | weekly |
| Shortening, margarine, butter, oil | 10 | butter and margarine in the cold room |
| Yeast, compressed | 4 | short life, bought twice a week |
| Salt, milk powder, improver, preservative, baking powder, spices, sesame, tutti-frutti, essence | 20 | small monthly buys |
| Potato, onion, garlic | 3 | market, alternate days |
| Green peas (frozen) | 10 | |
| Paneer | 1 | daily |
| Bags, pouches, cake packs, puff paper, labels | 21 | printed in lots; 30 days' credit |

About **Rs 4.7 lakh, 9 days of consumption** overall (A). The model project report above assumes 20 days
of raw material; a factory that takes flour twice a week holds less. Every material except paneer and
the market vegetables is above the scope's "three normal days"; those are bought daily or on alternate
days, so the reorder rule, not the opening stock, keeps them covered.

Finished goods, as `recipes-yields.md` section 5 sets out: at the factory, one day's production of each
fresh line and of the puffs, manufactured 31 December 2025 (it is the dispatch and store transfer of
1 January), and the target cover of each long-life line - toast 7 days of sales, khari 6, jeera biscuit
8, tea cake 3 - in two or three batches made between 22 and 30 December 2025: about Rs 1.2 lakh at
recipe cost. At each store, the closing shelf of 31 December: half a day of fresh lines (manufactured
30 December; pizza base one day), four days of the long-life lines, three days of tea cake, no puffs
(the pars of `products-prices.md` 8.4 less the sales since the last top-up): about Rs 9,000 at S1,
Rs 7,000 at S2 and Rs 4,500 at S3.

### 7.5 The opening position in one line

Cash Rs 1,02,800 + bank Rs 8,75,000 + receivables Rs 8,54,000 + stock about Rs 6,10,000 - payables
Rs 9,70,000 = **net working capital about Rs 14.7 lakh**.

---

## 8. Notes for the integrator

1. **October 2026 minimum wage** is not published in any source opened; the three rows marked (A) in
   section 1 are projections and no salary depends on them.
2. **The gas price** is an assumed series (3.2). If the sample should rest only on researched prices,
   switch the ovens to diesel: 63 SCM of gas is about 62 litres of diesel a day at the prices of 3.1,
   which raises oven fuel from about 3.4% to about 5.5% of sales.
3. **The bank balance grows.** With an operating profit of Rs 3-4 lakh a month and no document for
   drawings, loan repayments, income tax or GST paid to the government, the bank balance rises by
   roughly Rs 80-90 lakh by December 2027. The scope has no such document; either accept it (there is no balance
   sheet) or raise it as a scope question. Nothing here hides it.
4. **Salaries are 21-23% of sales**, forced by 35 people on Rs 4 crore. If the costing run gives a
   material cost above 53%, the first lever is the list prices, not the directory.
5. Section 7's split by customer assumes 16 weekly-credit outlets and the corporate credit days of
   `calendar-geography.md` 9.1 (30 days for C01-C05 and C08, 15 days for C06, C07, C09 and C10); every
   opening balance is inside that file's credit limit. The customer master may change who is on
   credit - keep Rs 8.54 lakh and the ageing shape.
6. Expense vendors needed by section 4 (types): factory landlord; three store landlords; electricity
   distribution company; city gas distributor; fuel station; garage; oven and machinery service firm;
   spares dealer; insurer; government fees (one pseudo-vendor); food laboratory; telecom operator;
   chartered accountant's firm; the bank; garment supplier; clinic; sweet and gift supplier; printer;
   advertising agency; housekeeping contractor; estate water supply; pest control firm. About 22, on top
   of the 18 material vendors.
7. The seed for one business date is the beginning of the seed for a later one: every rule above is a
   function of the date, the directory and the documents already posted (`V(M)`, cash deposited).
8. **Closed days.** `calendar-geography.md` 3.1 moves a salary bill that falls on a closed day to the
   next open day. That would date the October 2027 salary bill 1 November and leave October without
   salaries. This file keeps every bill on its own date and moves only approvals, payments and
   reimbursements (section 4, common rules). The integrator should take this file's rule for bills.
9. **UPI merchant fee.** From 15 October 2026 a UPI payment above Rs 2,000 to a merchant costs the
   merchant 0.4% (4.10). Store sales are below the threshold. Weekly settlements by outlets are not, and
   `calendar-geography.md` 8 lets them pay in cash or UPI; the fee (about Rs 1,400 a month at most) is
   not modelled, and the scope has no document for a deduction from a receipt.
10. **Van kilometres.** `calendar-geography.md` 10.2 measured the delivery runs at 205 km a day; 4.4 now
    uses those distances and keeps 19.0 litres a day by counting 80 km of other running. If that is
    thought too much, that file's alternative is 15 litres a day (225 km), which takes about Rs 12,000
    a month off vehicle fuel and adds 0.4 points to the operating margin.

## 9. Sources opened on 2 October 2026

Minimum wages: sgcms.com (October 2025, April 2026), labourlawhelp.com. Municipal corporations:
deshgujarat.com (1 January 2025). Diesel: businesstoday.in (Anand, 2 October 2026; Gujarat, 19 May 2026),
timestoday.co (25 May 2026), drivespark.com, goodreturns.in, cardekho.com. LPG and piped gas:
petroldieselprice.com (Ahmedabad monthly table), goodreturns.in (LPG and PNG, Gujarat), vgl.co.in,
charotargas.com, deshgujarat.com (2 June 2026). Electricity: gebguru.in, electricitybillcalculator.in,
thediscombill.com, billunits.in, billcalculator.in, deshgujarat.com (25 March 2026); the regulator's
tariff schedule PDF could not be opened (certificate error). Rents: realestateindia.com (Anand
commercial, Anand shops, Vallabh Vidyanagar). Salaries: in.indeed.com, quikr.com (Anand). Vans:
trucks.tractorjunction.com. Food licence fees: velcolegalindia.com. P&L: whalesbook.com, the bread
project report at uphorticulture.in (PDF read in full), blog.petpooja.com, trufflenationonline.com,
restroworks.com. Every other URL in this file is marked (L).

Opened at the review, the same day: sgcms.com (April 2025, October 2025, April 2026 - all three rows of
section 1 confirmed), businesstoday.in (Anand diesel Rs 97.89 on 2 October; the hikes of 15 and 19 May),
timestoday.co (23 and 25 May), drivespark.com, gebguru.in, electricitybillcalculator.in,
thediscombill.com, billunits.in, deshgujarat.com (tariff; municipal corporations; gas, 2 June 2026),
solarquarter.com (fuel surcharge base), goodreturns.in (piped gas and LPG), petroldieselprice.com,
charotargas.com, hindchef.com, realestateindia.com (Anand and Vallabh Vidyanagar), in.indeed.com,
quikr.com, angelone.in, trucks.tractorjunction.com, velcolegalindia.com, tallysolutions.com,
scconline.com, whalesbook.com, blog.petpooja.com, trufflenationonline.com and the bread project report
(sales Rs 53.46 lakh, raw material Rs 38.40 lakh, Rs 32-35 and Rs 45 a kg, 20 days of raw material).
Each supports the figure it is cited for, except as corrected in 3.1, 3.2, 3.4, 4.1, 4.7 and 4.10. The
1 October 2026 minimum-wage notification was still not published. The regulator's tariff PDF still
fails with a certificate error.
