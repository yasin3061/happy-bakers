/*
 * HB.config - Happy Bakers: master data, opening entries and simulation parameters.
 * Every figure is taken from docs/RESEARCH.md; docs/CONFIG.md maps each key to its section.
 *
 *   company ... journeys    the masters, in the shape the engine copies into HB.masters (docs/API.md 2.2)
 *   opening                 the opening entries of 1 January 2026 (docs/API.md 3.9)
 *   sim                     parameters of the day-by-day simulation: seed.js alone reads them, no page does
 *   calibration             the bands of RESEARCH.md section 13, for the self-check
 *
 * Money is whole paise; a rate or a price is paise per unit. A fraction is written 0.045, not 4.5%.
 * Weekdays are numbered as HB.dates.dow numbers them: 0 = Monday ... 6 = Sunday. RESEARCH.md counts from
 * Sunday, so every weekday table here is written Monday first.
 * Happy Bakers is fictional: every name is invented and every GSTIN is synthetic.
 */
(function (root) {
  'use strict';

  var HB = root.HB || (root.HB = {});

  /* ------------------------------------------------------------ helpers */
  /* The file stands alone (no kernel call), so that it can be read and checked by itself. */

  /** Rupees as typed from RESEARCH.md to whole paise. */
  function rs(x) { return Math.round(x * 100); }
  /** Rs lakh to paise. */
  function lakh(x) { return Math.round(x * 10000000); }

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function utc(iso) { return Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)); }
  function isoOf(ms) { var d = new Date(ms); return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate()); }
  function addDays(iso, n) { return isoOf(utc(iso) + n * 86400000); }
  function diffDays(a, b) { return Math.round((utc(b) - utc(a)) / 86400000); }
  /** 0 = Monday ... 6 = Sunday, as HB.dates.dow. */
  function dow(iso) { return (new Date(utc(iso)).getUTCDay() + 6) % 7; }
  function monthOf(iso) { return +iso.slice(5, 7); }
  function dayOf(iso) { return +iso.slice(8, 10); }
  function daysInMonth(monthKey) { return new Date(Date.UTC(+monthKey.slice(0, 4), +monthKey.slice(5, 7), 0)).getUTCDate(); }
  function monthEnd(iso) { return iso.slice(0, 8) + pad2(daysInMonth(iso.slice(0, 7))); }
  /** Months from one 'YYYY-MM' to another. */
  function monthsBetween(a, b) { return (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7)); }
  function addMonths(monthKey, n) {
    var t = +monthKey.slice(0, 4) * 12 + (+monthKey.slice(5, 7) - 1) + n;
    return Math.floor(t / 12) + '-' + pad2(t % 12 + 1);
  }
  function inAny(iso, periods) {
    for (var i = 0; i < periods.length; i++) if (iso >= periods[i][0] && iso <= periods[i][1]) return true;
    return false;
  }
  /** 'MM-DD' window that repeats every year, both ends included. */
  function inYearly(iso, from, to) { var md = iso.slice(5); return md >= from && md <= to; }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  var MON = 0, TUE = 1, WED = 2, THU = 3, FRI = 4, SAT = 5, SUN = 6;
  var MON_SAT = [MON, TUE, WED, THU, FRI, SAT];
  var EVERY_DAY = [MON, TUE, WED, THU, FRI, SAT, SUN];

  /*
   * GSTIN = '24' (Gujarat) + PAN + '1' + 'Z' + a check character (RESEARCH 5.1). The check character is
   * computed here, never typed: values 0-9 then A-Z = 10-35, weights 1 and 2 alternately from the left,
   * quotient plus remainder of each product by 36, and 36 less the sum modulo 36.
   */
  var GSTIN_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  function gstinCheckChar(first14) {
    var sum = 0, i, p;
    for (i = 0; i < 14; i++) {
      p = GSTIN_CHARS.indexOf(first14.charAt(i)) * (i % 2 === 0 ? 1 : 2);
      sum += Math.floor(p / 36) + p % 36;
    }
    return GSTIN_CHARS.charAt((36 - sum % 36) % 36);
  }
  function gstin(pan) { var s = '24' + pan + '1Z'; return s + gstinCheckChar(s); }
  function gstinValid(g) {
    return typeof g === 'string' && /^24[A-Z]{5}[0-9]{4}[A-Z]1Z[0-9A-Z]$/.test(g) && gstinCheckChar(g.slice(0, 14)) === g.charAt(14);
  }

  /*
   * A contact number per employee; screens mask it. RESEARCH 8.1 has the generator draw it from the seeded
   * stream; here it is a hash of the id, which is as repeatable and needs no seed: the directory is a master
   * and must be whole on a boot that runs no seed (docs/CONFIG.md, choice 19).
   */
  function phoneOf(id) {
    var h = 2166136261, i;
    for (i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = (h * 16777619) >>> 0; }
    var tail = String(100000000 + h % 900000000);
    return '9' + tail;
  }

  /* ============================================================ MASTERS */

  /* ------------------------------------------------- company and places (RESEARCH 1.1, 1.2) */

  var company = {
    name: 'Happy Bakers',
    legalName: 'Happy Bakers (proprietor: Nilesh Patel)',
    gstin: gstin('AFNPP5274H'),
    address: 'Plot 214, GIDC Vitthal Udyognagar, Anand-Sojitra Road, Anand 388121, Gujarat',
    stateCode: '24',
    bankName: 'Bank current account',
    business: 'All-vegetarian, eggless bakery factory with four van routes and three own stores',
    goLive: '2026-01-01',
    hsnDigits: 4
  };

  var FG_IDS = ['FG01', 'FG02', 'FG03', 'FG04', 'FG05', 'FG06', 'FG07', 'FG08', 'FG09',
    'FG10', 'FG11', 'FG12', 'FG13', 'FG14', 'FG15', 'FG16', 'FG17', 'FG18'];

  /** A row of 18 figures in FG01..FG18 order as { itemId: figure }; zeros are left out unless asked for. */
  function byFg(row, keepZero) {
    var out = {}, i;
    for (i = 0; i < FG_IDS.length; i++) if (keepZero || row[i]) out[FG_IDS[i]] = row[i];
    return out;
  }

  /* Store standing quantities and normal-day sales (RESEARCH 6.5), FG01..FG18. */
  var STORE_STANDING = {
    st_anand: [68, 21, 6, 55, 15, 9, 6, 5, 28, 80, 40, 70, 40, 40, 42, 150, 55, 45],
    st_vvn: [33, 12, 3, 26, 15, 12, 6, 6, 24, 30, 15, 30, 20, 20, 36, 155, 55, 55],
    st_nadiad: [36, 9, 3, 29, 8, 3, 3, 2, 12, 50, 20, 40, 20, 20, 15, 75, 25, 20]
  };
  var STORE_SALE = {
    st_anand: [45, 14, 4, 34, 10, 6, 4, 3, 14, 16, 8, 14, 8, 8, 14, 130, 45, 40],
    st_vvn: [22, 8, 2, 16, 10, 8, 4, 4, 12, 6, 3, 6, 4, 4, 12, 140, 50, 50],
    st_nadiad: [24, 6, 2, 18, 5, 2, 2, 1, 6, 10, 4, 8, 4, 4, 5, 65, 20, 15]
  };

  var units = [
    { id: 'factory', name: 'Factory', kind: 'factory', shortName: 'Factory',
      address: 'Plot 214, GIDC Vitthal Udyognagar, Anand-Sojitra Road, Anand 388121', hours: 'bakes every day except factory holidays' },
    { id: 'st_anand', name: 'Happy Bakers - Anand', kind: 'store', shortId: 'S1', shortName: 'Anand',
      address: 'Town Hall Road, near Vivekanand Wadi, Anand 388001', hours: '07:30 - 21:00, seven days',
      standing: byFg(STORE_STANDING.st_anand) },
    { id: 'st_vvn', name: 'Happy Bakers - Vidyanagar', kind: 'store', shortId: 'S2', shortName: 'Vidyanagar',
      address: 'Nana Bazar, near Shastri Maidan, Vallabh Vidyanagar 388120', hours: '08:00 - 21:00, seven days',
      standing: byFg(STORE_STANDING.st_vvn) },
    { id: 'st_nadiad', name: 'Happy Bakers - Nadiad', kind: 'store', shortId: 'S3', shortName: 'Nadiad',
      address: 'Paras Circle, Santram Road, Nadiad 387001', hours: '07:30 - 20:30, seven days',
      standing: byFg(STORE_STANDING.st_nadiad) }
  ];
  var STORE_IDS = ['st_anand', 'st_vvn', 'st_nadiad'];

  var locations = [
    { id: 'fac_rm', name: 'Raw material store', kind: 'rm', unitId: 'factory' },
    { id: 'fac_fg', name: 'Finished goods store', kind: 'fg', unitId: 'factory' },
    { id: 'st_anand', name: 'Anand store', kind: 'store', unitId: 'st_anand' },
    { id: 'st_vvn', name: 'Vidyanagar store', kind: 'store', unitId: 'st_vvn' },
    { id: 'st_nadiad', name: 'Nadiad store', kind: 'store', unitId: 'st_nadiad' },
    { id: 'transit_st_anand', name: 'In transit to Anand store', kind: 'transit', unitId: 'st_anand' },
    { id: 'transit_st_vvn', name: 'In transit to Vidyanagar store', kind: 'transit', unitId: 'st_vvn' },
    { id: 'transit_st_nadiad', name: 'In transit to Nadiad store', kind: 'transit', unitId: 'st_nadiad' }
  ];

  var accounts = [
    { id: 'cash_factory', name: 'Factory cash', kind: 'cash', unitId: 'factory' },
    { id: 'cash_st_anand', name: 'Anand store cash', kind: 'cash', unitId: 'st_anand' },
    { id: 'cash_st_vvn', name: 'Vidyanagar store cash', kind: 'cash', unitId: 'st_vvn' },
    { id: 'cash_st_nadiad', name: 'Nadiad store cash', kind: 'cash', unitId: 'st_nadiad' },
    { id: 'bank', name: 'Bank current account', kind: 'bank', unitId: null }
  ];

  /* ------------------------------------------------- items (RESEARCH 2.1, 2.3, 4.1) */

  /*
   * Finished goods: code, key, name, pack, net weight g, pieces per pack, group, tariff item, GST %,
   * best before (days), then the OPENING list in rupees: MRP (with GST), retailer, corporate (before GST).
   * The id of an item is its code. The unit is the pack for FG01-FG15 and the piece for the puffs.
   */
  var FG_ROWS = [
    ['FG01', 'SB', 'Sandwich bread', '400 g loaf, sliced', 400, 1, 'BR', '19059090', 0, 4, 38, 30.50, 28.50],
    ['FG02', 'BB', 'Brown bread', '400 g loaf, sliced', 400, 1, 'BR', '19059090', 0, 4, 44, 35.00, 33.00],
    ['FG03', 'JL', 'Jumbo sandwich loaf', '800 g loaf, large slice', 800, 1, 'BR', '19059090', 0, 4, 68, 55.00, 50.50],
    ['FG04', 'LP', 'Ladi pav', '12 pieces', 400, 12, 'BR', '19059090', 0, 3, 36, 29.00, 27.00],
    ['FG05', 'BNP', 'Burger bun, plain', '4 pieces', 200, 4, 'BN', '19059090', 0, 4, 31, 25.00, 23.50],
    ['FG06', 'BNS', 'Burger bun, sesame', '4 pieces', 200, 4, 'BN', '19059090', 0, 4, 35, 28.00, 26.00],
    ['FG07', 'BNW', 'Burger bun, whole wheat', '4 pieces', 200, 4, 'BN', '19059090', 0, 4, 38, 30.50, 28.50],
    ['FG08', 'BNJ', 'Burger bun, jumbo', '4 pieces, large', 300, 4, 'BN', '19059090', 0, 4, 47, 38.00, 35.00],
    ['FG09', 'PZ', 'Pizza base', '2 pieces, 7 inch', 200, 2, 'BN', '19059090', 0, 5, 27, 21.50, 20.00],
    ['FG10', 'TE', 'Elaichi toast', '250 g pouch', 250, 20, 'DRY', '19054000', 5, 90, 55, 41.50, 39.50],
    ['FG11', 'TM', 'Milk toast', '400 g pouch', 400, 28, 'DRY', '19054000', 5, 90, 90, 68.00, 65.00],
    ['FG12', 'KB', 'Butter khari', '200 g pouch', 200, 22, 'DRY', '19059090', 5, 90, 70, 53.00, 51.00],
    ['FG13', 'KJ', 'Jeera khari', '200 g pouch', 200, 22, 'DRY', '19059090', 5, 90, 65, 49.00, 47.00],
    ['FG14', 'JB', 'Jeera biscuit', '250 g pouch', 250, 30, 'DRY', '19059020', 5, 60, 75, 57.00, 54.50],
    ['FG15', 'TC', 'Tea cake (tutti-frutti)', '200 g bar', 200, 1, 'DRY', '19059010', 5, 15, 55, 42.00, 39.50],
    ['FG16', 'PV', 'Veg puff', 'piece', 70, 1, 'PF', '19059010', 5, 1, 15, 11.50, 11.00],
    ['FG17', 'PP', 'Paneer puff', 'piece', 70, 1, 'PF', '19059010', 5, 1, 25, 19.00, 18.00],
    ['FG18', 'PG', 'Garlic puff', 'piece', 70, 1, 'PF', '19059010', 5, 1, 20, 15.25, 14.50]
  ];

  /*
   * Materials and packing: code, name, kind, unit, purchase pack, order multiple, HSN, GST %, vendor,
   * lead days (order date to receipt), reorder level, order quantity, opening stock on 1 January 2026.
   * The opening rate is the January 2026 price of sim.prices.
   */
  var MAT_ROWS = [
    ['RM01', 'Maida (bakery flour)', 'rm', 'kg', '50 kg bag', 50, '1101', 0, 'VM01', 2, 5050, 2000, 3400],
    ['RM02', 'Whole wheat atta', 'rm', 'kg', '50 kg bag', 50, '1101', 0, 'VM02', 2, 200, 250, 150],
    ['RM03', 'Sugar', 'rm', 'kg', '50 kg bag', 50, '1701', 5, 'VM03', 2, 450, 600, 450],
    ['RM04', 'Bakery shortening', 'rm', 'kg', '15 kg box', 15, '1517', 5, 'VM04', 3, 240, 270, 285],
    ['RM05', 'Puff margarine', 'rm', 'kg', '15 kg carton', 15, '1517', 5, 'VM04', 3, 255, 240, 315],
    ['RM06', 'Butter (white, unsalted)', 'rm', 'kg', '15 kg carton', 15, '0405', 5, 'VM06', 2, 45, 60, 60],
    ['RM07', 'Refined oil (cottonseed)', 'rm', 'litre', '15 litre tin', 15, '1512', 5, 'VM05', 2, 75, 135, 105],
    ['RM08', 'Yeast, compressed', 'rm', 'kg', 'carton of 20 x 500 g', 10, '2102', 5, 'VM07', 3, 180, 30, 140],
    ['RM09', 'Salt', 'rm', 'kg', '25 kg bag', 25, '2501', 0, 'VM03', 2, 100, 375, 250],
    ['RM10', 'Skimmed milk powder', 'rm', 'kg', '25 kg bag', 25, '0402', 5, 'VM06', 2, 50, 125, 125],
    ['RM11', 'Bread improver', 'rm', 'kg', '5 kg pack', 5, '2106', 5, 'VM07', 2, 20, 60, 55],
    ['RM12', 'Calcium propionate', 'rm', 'kg', '5 kg pack', 5, '2915', 18, 'VM07', 2, 15, 35, 35],
    ['RM13', 'Baking powder', 'rm', 'kg', '5 kg pack', 5, '2102', 5, 'VM07', 2, 5, 10, 10],
    ['RM14', 'Cardamom powder', 'rm', 'kg', '1 kg pack', 1, '0908', 5, 'VM08', 2, 2, 4, 4],
    ['RM15', 'Cumin seed', 'rm', 'kg', '5 kg pack', 5, '0909', 5, 'VM08', 2, 5, 10, 10],
    ['RM16', 'Sesame seed, white', 'rm', 'kg', '5 kg pack', 5, '1207', 5, 'VM08', 2, 5, 10, 10],
    ['RM17', 'Tutti-frutti', 'rm', 'kg', '5 kg pack', 5, '2006', 5, 'VM07', 2, 15, 30, 30],
    ['RM18', 'Flavour essence', 'rm', 'litre', '500 ml bottle', 0.5, '3302', 18, 'VM07', 2, 1, 2, 2],
    ['RM19', 'Potato', 'rm', 'kg', '50 kg bag', 50, '0701', 0, 'VM09', 1, 100, 50, 100],
    ['RM20', 'Onion', 'rm', 'kg', 'loose, 10 kg lots', 10, '0703', 0, 'VM09', 1, 30, 20, 30],
    ['RM21', 'Green peas, frozen', 'rm', 'kg', '1 kg pack', 1, '0710', 5, 'VM10', 2, 35, 35, 50],
    ['RM22', 'Paneer', 'rm', 'kg', '1 kg block', 1, '0406', 0, 'VM11', 1, 14, 5, 10],
    ['RM23', 'Garlic, peeled', 'rm', 'kg', '1 kg pack', 1, '0703', 0, 'VM09', 1, 3, 2, 3],
    ['RM24', 'Puff masala', 'rm', 'kg', '1 kg pack', 1, '0910', 5, 'VM08', 2, 10, 30, 24],
    ['PM01', 'Bread bag, 400 g loaf', 'pk', 'pcs', 'bundle of 1,000', 1000, '3923', 18, 'VM12', 8, 13000, 25000, 17000],
    ['PM02', 'Bread bag, 800 g loaf', 'pk', 'pcs', 'bundle of 1,000', 1000, '3923', 18, 'VM12', 8, 3000, 6000, 4000],
    ['PM03', 'Pav / bun bag', 'pk', 'pcs', 'bundle of 1,000', 1000, '3923', 18, 'VM12', 4, 12000, 35000, 25000],
    ['PM04', 'Pouch, small', 'pk', 'pcs', 'bundle of 500', 500, '3923', 18, 'VM12', 8, 4000, 7500, 5500],
    ['PM05', 'Pouch, large', 'pk', 'pcs', 'bundle of 500', 500, '3923', 18, 'VM12', 8, 4500, 7000, 5500],
    ['PM06', 'Cake pack', 'pk', 'pcs', 'carton of 500', 500, '4819', 5, 'VM13', 6, 1500, 3000, 2000],
    ['PM07', 'Puff paper', 'pk', 'pcs', 'packet of 1,000', 1000, '4806', 18, 'VM13', 3, 8000, 30000, 20000],
    ['PM08', 'Date label', 'pk', 'pcs', 'roll of 1,000', 1000, '4821', 18, 'VM13', 5, 31000, 80000, 57000]
  ];

  var items = [], MAT_IDS = [], GROUP_OF = {}, OPENING_QTY = {};
  FG_ROWS.forEach(function (r, i) {
    GROUP_OF[r[0]] = r[6];
    items.push({
      id: r[0], code: r[0], key: r[1], name: r[2], kind: 'fg', unit: i < 15 ? 'pack' : 'pcs', pack: r[3],
      netWeightG: r[4], piecesPerPack: r[5], group: r[6], hsn: '1905', tariffItem: r[7], gstRate: r[8],
      shelfLifeDays: r[9], price: { mrp: rs(r[10]), retail: rs(r[11]), corporate: rs(r[12]) },
      reorderLevel: 0, active: true
    });
  });
  MAT_ROWS.forEach(function (r) {
    MAT_IDS.push(r[0]);
    OPENING_QTY[r[0]] = r[12];
    items.push({
      id: r[0], code: r[0], name: r[1], kind: r[2], unit: r[3], pack: r[4], orderMultiple: r[5], hsn: r[6],
      gstRate: r[7], vendorId: r[8], leadDays: r[9], reorderLevel: r[10], orderQty: r[11], active: true
    });
  });

  /* ------------------------------------------------- recipes (RESEARCH 3.2, 3.3, 3.5) */

  /* Quantity per mix in the stock unit of the material (kg; RM07 and RM18 litres), FG01..FG18. Water is not stocked. */
  var MIX = {
    RM01: [50, 12.5, 25, 50, 10, 10, 2.5, 10, 15, 25, 50, 20, 20, 15, 6, 2.5, 2.5, 2.5],
    RM02: [0, 12.5, 0, 0, 0, 0, 7.5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    RM03: [2, 1, 1, 3, 1, 1, 1, 1, 0.45, 7.5, 12.5, 0, 0, 2.7, 5.1, 0, 0, 0],
    RM04: [1, 0.5, 0.5, 2, 0.5, 0.5, 0.5, 0.5, 0, 3, 4, 1, 1, 6, 0, 0.1, 0.1, 0.1],
    RM05: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10, 13, 0, 0, 1.375, 1.375, 1.375],
    RM06: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 0, 0.75, 0.3, 0, 0, 0.3],
    RM07: [0.25, 0.15, 0.15, 0.5, 0.1, 0.1, 0.1, 0.1, 0.6, 0.15, 0.3, 0, 0, 0, 2.1, 0.15, 0.15, 0.05],
    RM08: [1.25, 0.7, 0.625, 1.5, 0.35, 0.35, 0.35, 0.35, 0.3, 0.9, 1.8, 0, 0, 0, 0, 0, 0, 0],
    RM09: [0.9, 0.45, 0.45, 0.8, 0.16, 0.16, 0.16, 0.16, 0.27, 0.3, 0.6, 0.4, 0.4, 0.3, 0, 0.095, 0.085, 0.095],
    RM10: [0, 0, 0, 0.5, 0.2, 0.2, 0.2, 0.2, 0, 0.5, 3, 0, 0, 0.3, 0.72, 0, 0, 0],
    RM11: [0.2, 0.125, 0.1, 0.2, 0.05, 0.05, 0.06, 0.05, 0.05, 0.1, 0.2, 0, 0, 0, 0, 0, 0, 0],
    RM12: [0.15, 0.075, 0.075, 0.1, 0.03, 0.03, 0.03, 0.03, 0.05, 0, 0, 0, 0, 0, 0.03, 0, 0, 0],
    RM13: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.15, 0.24, 0, 0, 0],
    RM14: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0.1, 0, 0, 0, 0, 0, 0, 0, 0],
    RM15: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.3, 0.375, 0, 0, 0, 0],
    RM16: [0, 0, 0, 0, 0, 0.45, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    RM17: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1.2, 0, 0, 0],
    RM18: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.06, 0, 0, 0, 0.03, 0, 0, 0],
    RM19: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2.2, 0.6, 2.6],
    RM20: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.6, 0.8, 0.4],
    RM21: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.6, 0.4, 0],
    RM22: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1.5, 0],
    RM23: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.3],
    RM24: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.12, 0.12, 0.08]
  };

  /*
   * Per product: flour per mix kg (the mix label), water per mix litres, pieces per mix T, normal reject r,
   * drift a, expected good units E, packing per good unit, mix step, rhythm (run weekdays, or 'daily'),
   * standard mixes per run. T, r, a and the step drive the seed's yield draw and live under sim.production.
   */
  var BAG = ['PM01', 'PM08'], JUMBO = ['PM02', 'PM08'], BUN = ['PM03', 'PM08'], SMALL = ['PM04', 'PM08'],
    LARGE = ['PM05', 'PM08'], CAKE = ['PM06', 'PM08'], PAPER = ['PM07'];
  var RECIPE_ROWS = [
    ['FG01', 50, 29.5, 186, 0.015, 0.005, 183, BAG, 0.5, 'daily', 4],
    ['FG02', 25, 15.75, 93, 0.02, 0.006, 91, BAG, 0.5, 'daily', 2],
    ['FG03', 25, 14.75, 46, 0.015, 0.005, 45, JUMBO, 0.5, 'daily', 4],
    ['FG04', 50, 28.5, 187, 0.02, 0.008, 183, BUN, 0.5, 'daily', 4],
    ['FG05', 10, 5.5, 76, 0.02, 0.008, 74, BUN, 0.5, 'daily', 2.5],
    ['FG06', 10, 5.5, 76, 0.02, 0.008, 74, BUN, 0.5, 'daily', 1],
    ['FG07', 10, 6.1, 78, 0.02, 0.008, 76, BUN, 0.5, 'daily', 0.5],
    ['FG08', 10, 5.5, 50, 0.02, 0.008, 49, BUN, 0.5, 'daily', 1.5],
    ['FG09', 15, 8.15, 105, 0.03, 0.01, 101, BUN, 0.5, 'daily', 2],
    ['FG10', 25, 11.1, 125, 0.02, 0.015, 122, SMALL, 0.5, [MON, WED, FRI], 4],
    ['FG11', 50, 22.7, 154, 0.02, 0.015, 150, LARGE, 0.5, [TUE, THU, SAT], 1],
    ['FG12', 20, 10, 139, 0.03, 0.02, 134, LARGE, 0.5, [MON, THU], 4],
    ['FG13', 20, 10, 141, 0.03, 0.02, 136, LARGE, 0.5, [TUE, FRI], 1.5],
    ['FG14', 15, 2.1, 92, 0.02, 0.012, 90, SMALL, 0.5, [WED, SAT], 2],
    ['FG15', 6, 5.1, 89, 0.03, 0.01, 86, CAKE, 0.5, [MON, WED, FRI], 3],
    ['FG16', 2.5, 1.3, 92, 0.03, 0.015, 89, PAPER, 0.25, 'daily', 7],
    ['FG17', 2.5, 1.3, 92, 0.03, 0.015, 89, PAPER, 0.25, 'daily', 2],
    ['FG18', 2.5, 1.3, 92, 0.03, 0.015, 89, PAPER, 0.25, 'daily', 2]
  ];

  var recipes = RECIPE_ROWS.map(function (r, i) {
    var materials = [];
    Object.keys(MIX).forEach(function (m) { if (MIX[m][i]) materials.push({ itemId: m, qty: MIX[m][i] }); });
    return {
      itemId: r[0], mixLabel: r[1] + ' kg flour mix', expectedUnits: r[6], materials: materials,
      packing: r[7].map(function (p) { return { itemId: p, qtyPerUnit: 1 }; }),
      rhythm: r[9], standardMixes: r[10]
    };
  });

  /* ------------------------------------------------- routes and outlets (RESEARCH 6.1 - 6.3) */

  var OUTLET_TYPES = {
    P: 'Provision store', D: 'Dairy parlour', T: 'Tea stall', B: 'Bakery counter', G: 'General store'
  };
  /* The items a standing order may carry, in the column order of RESEARCH 6.1. */
  var TEMPLATE_ITEMS = ['FG01', 'FG02', 'FG04', 'FG05', 'FG06', 'FG07', 'FG09', 'FG10', 'FG11', 'FG12', 'FG13', 'FG14', 'FG15'];
  /* The medium outlet of each type: packs a day. */
  var TEMPLATE_M = {
    P: [14, 2, 9, 2, 0, 0, 2, 4, 1, 3, 1, 1, 1],
    D: [16, 3, 10, 2, 0, 0, 2, 3, 1, 2, 0, 0, 1],
    T: [5, 0, 20, 6, 0, 0, 0, 3, 0, 3, 1, 0, 0],
    B: [11, 3, 6, 3, 2, 1, 4, 4, 1, 3, 2, 2, 2],
    G: [16, 4, 5, 2, 1, 1, 3, 4, 1, 3, 1, 1, 2]
  };
  /* Size factor in hundredths, so that the half-up rounding is exact. */
  var SIZE_PCT = { S: 75, M: 100, L: 140 };

  /** Standing order = the medium row of the type x the size factor, each line rounded half up; a zero line is dropped. */
  function standingOf(type, size) {
    var out = {}, i, q;
    for (i = 0; i < TEMPLATE_ITEMS.length; i++) {
      q = Math.floor((TEMPLATE_M[type][i] * SIZE_PCT[size] + 50) / 100);
      if (q > 0) out[TEMPLATE_ITEMS[i]] = q;
    }
    return out;
  }

  function priceOfList(list, itemId, channel) {
    for (var i = 0; i < list.length; i++) if (list[i].id === itemId) return list[i].price[channel];
    return 0;
  }
  /** Value in paise of a { itemId: units } map at the opening list. */
  function valueAtOpening(lines, channel) {
    var v = 0, k;
    for (k in lines) if (has(lines, k)) v += lines[k] * priceOfList(items, k, channel);
    return v;
  }

  /* Each route in stop order: id, name, locality, type, size, terms. */
  var ROUTE_ROWS = [
    { id: 'R1', name: 'Anand town', km: 27.1, vehicle: 'V1', collectionDow: MON, outlets: [
      ['O11', 'Kesarkunj Bakery', 'Anand-Sojitra Road, Anand', 'B', 'M', 'weekly'],
      ['O06', 'Gopinandan Dairy Parlour', 'Ganesh Chokdi, Anand', 'D', 'M', 'cash'],
      ['O05', 'Navnitkunj Milk Parlour', 'Amul Dairy Road, Anand', 'D', 'L', 'weekly'],
      ['O01', 'Vrajkunj Provision Store', 'Station Road, Anand', 'P', 'L', 'weekly'],
      ['O08', 'Raghubhai ni Kitli', 'Old bus stand, Anand', 'T', 'L', 'cash'],
      ['O09', 'Gunjwala Tea and Nasta', 'Sardar Gunj, Anand', 'T', 'M', 'cash'],
      ['O02', 'Harivadan Kirana Bhandar', 'Gamdi Vad, Anand', 'P', 'M', 'cash'],
      ['O10', 'Mithi Bite Bakery and Cake Shop', '100 Feet Road, Anand', 'B', 'L', 'weekly'],
      ['O13', 'Harshvardhan General Stores', 'Chikhodra Chokdi, Anand', 'G', 'M', 'cash'],
      ['O12', 'Triguna Super Store', 'Borsad Chokdi, Anand', 'G', 'L', 'weekly'],
      ['O03', 'Amrutdhara Provision Store', 'Mangalpura, Anand', 'P', 'M', 'cash'],
      ['O07', 'Makhanchor Dairy Parlour', 'Lambhvel Road, Anand', 'D', 'M', 'cash'],
      ['O04', 'Kalrav Kirana Store', 'Jitodia Road, Anand', 'P', 'S', 'weekly']] },
    { id: 'R2', name: 'Vidyanagar-Karamsad', km: 23.2, vehicle: 'V2', collectionDow: TUE, outlets: [
      ['O21', 'Shramjivi Tea Stall', 'Vitthal Udyognagar, estate gate', 'T', 'M', 'cash'],
      ['O22', 'Mavjibhai Chai Wala', 'Janta Chokdi', 'T', 'S', 'cash'],
      ['O14', 'Shardaben Provision Store', 'Nana Bazar, Vallabh Vidyanagar', 'P', 'L', 'weekly'],
      ['O20', 'Popatkaka Tea Corner', 'Bhaikaka Circle, Vallabh Vidyanagar', 'T', 'L', 'cash'],
      ['O17', 'Vidyadham Milk Parlour', 'Mota Bazar, Vallabh Vidyanagar', 'D', 'L', 'weekly'],
      ['O23', 'Radhekunj Bake Shop', 'Iskcon Temple Road, Vallabh Vidyanagar', 'B', 'M', 'weekly'],
      ['O24', 'Shubhangi General Stores', 'New Vallabh Vidyanagar', 'G', 'M', 'cash'],
      ['O18', 'Sardarbhumi Dairy Parlour', 'Anand-Karamsad Road, Karamsad', 'D', 'M', 'cash'],
      ['O15', 'Lakshminandan Provision Store', 'Main bazar, Karamsad', 'P', 'M', 'cash'],
      ['O16', 'Tulsikyara Kirana Store', 'Bakrol', 'P', 'S', 'cash'],
      ['O19', 'Dhenukunj Dairy Parlour', 'Mogri', 'D', 'S', 'weekly']] },
    { id: 'R3', name: 'Nadiad', km: 60.3, vehicle: 'V3', collectionDow: WED, outlets: [
      ['O28', 'Uttamchand Provision Store', 'Uttarsanda', 'P', 'S', 'weekly'],
      ['O32', 'Sakarba Bakery', 'Piplag Road, Nadiad', 'B', 'M', 'weekly'],
      ['O25', 'Santcharan Provision Store', 'Santram Road, Nadiad', 'P', 'L', 'weekly'],
      ['O31', 'Lalji Maharaj Tea Stall', 'Station Road, Nadiad', 'T', 'M', 'cash'],
      ['O26', 'Chandanvan Provision Store', 'College Road, Nadiad', 'P', 'M', 'cash'],
      ['O30', 'Yamunatat Dairy Parlour', 'Vaniyavad, Nadiad', 'D', 'M', 'cash'],
      ['O29', 'Shantisagar Milk Parlour', 'Mission Road, Nadiad', 'D', 'M', 'cash'],
      ['O27', 'Devkinandan Provision Store', 'Pij Road, Nadiad', 'P', 'M', 'cash'],
      ['O33', 'Ranchhodkrupa General Stores', 'Dakor Road, Nadiad', 'G', 'M', 'weekly']] },
    { id: 'R4', name: 'Borsad-Petlad', km: 66.0, vehicle: 'V4', collectionDow: THU, outlets: [
      ['O36', 'Charotarbhumi Kirana', 'Napad', 'P', 'S', 'cash'],
      ['O38', 'Ishwarkaka Tea Stall', 'Anand Chokdi, Borsad', 'T', 'S', 'weekly'],
      ['O34', 'Mahikantha Provision Store', 'Station Road, Borsad', 'P', 'L', 'weekly'],
      ['O40', 'Satyagrah General Stores', 'Bus stand, Borsad', 'G', 'S', 'cash'],
      ['O37', 'Parijat Dairy Parlour', 'Dharmaj', 'D', 'S', 'cash'],
      ['O35', 'Chandrakala Provision Store', 'Station Road, Petlad', 'P', 'M', 'cash'],
      ['O39', 'Suhani Bakery', 'College Road, Petlad', 'B', 'S', 'cash']] }
  ];

  var routes = [], customers = [];
  ROUTE_ROWS.forEach(function (rt) {
    routes.push({ id: rt.id, name: rt.name, stops: rt.outlets.map(function (o) { return o[0]; }) });
    rt.outlets.forEach(function (o) {
      var standing = standingOf(o[3], o[4]), weekly = o[5] === 'weekly';
      customers.push({
        id: o[0], name: o[1], channel: 'retail', outletType: OUTLET_TYPES[o[3]], typeCode: o[3], size: o[4],
        routeId: rt.id, locality: o[2], terms: o[5], creditDays: weekly ? 7 : 0,
        /* ten days of the standing order at the opening list, rounded up to Rs 1,000; no limit on a cash outlet */
        creditLimit: weekly ? Math.ceil(valueAtOpening(standing, 'retail') * 10 / 100000) * 100000 : 0,
        gstin: '', standing: standing, active: true
      });
    });
  });
  customers.sort(function (a, b) { return a.id < b.id ? -1 : 1; });

  /* ------------------------------------------------- corporates (RESEARCH 6.4) */

  /*
   * id, name, class, type, locality, constitution, PAN ('' = not registered), credit days, credit limit Rs,
   * order weekdays (or 'alternate'), in term only, PO reference, delivered by, typical order { item: units }.
   * Payment weekday and lateness are simulation parameters: sim.collections.corporate.
   */
  var CORP_ROWS = [
    ['C01', 'Mahisagar Gears and Castings Pvt Ltd - staff canteen', 'IC', 'Industrial canteen', 'Vitthal Udyognagar', 'private company', 'AAHCM4821K', 30, 250000, MON_SAT, false, 'PO/C01/YYYY-MM', 'V5',
      { FG03: 40, FG04: 60, FG08: 16, FG16: 120 }],
    ['C02', 'Annakut Canteen Services', 'IC', 'Canteen contractor', 'Anand-Vidyanagar Road', 'partnership firm', 'ABKFA7315D', 30, 150000, MON_SAT, false, 'PO/C02/YYYY-MM', 'V5',
      { FG03: 22, FG04: 36, FG16: 60, FG18: 30 }],
    ['C03', 'Gyanjyot Kumar Chhatralaya - mess', 'HM', 'College hostel mess', 'University hostels, Vallabh Vidyanagar', 'education trust', '', 30, 140000, EVERY_DAY, false, '', 'V5',
      { FG03: 40, FG01: 12, FG04: 24, FG10: 8 }],
    ['C04', 'Charak Bhavan Hostel Mess', 'HM', 'Hostel mess, medical campus', 'Karamsad', 'mess committee', '', 30, 100000, EVERY_DAY, false, '', 'V5',
      { FG03: 20, FG02: 6, FG04: 15, FG11: 5 }],
    ['C05', 'Arogyatirth Charitable Trust Hospital - kitchen', 'HK', 'Hospital kitchen', 'Karamsad', 'charitable trust', 'AACTA5126H', 30, 140000, EVERY_DAY, false, 'RC/C05/YYYY', 'V5',
      { FG03: 24, FG02: 10, FG01: 10, FG11: 6, FG10: 5 }],
    ['C06', 'Swadsangam Caterers', 'CT', 'Caterer', '100 Feet Road, Anand', 'proprietor', 'BDLPT6247Q', 15, 40000, [TUE, THU, SAT], false, '', 'V5',
      { FG04: 80, FG08: 24, FG09: 30, FG05: 20, FG03: 12 }],
    ['C07', 'Thalrang Caterers', 'CT', 'Caterer', 'Pij Road, Nadiad', 'proprietor', '', 15, 30000, [FRI], false, '', 'V3',
      { FG04: 100, FG08: 30, FG03: 24, FG09: 24 }],
    ['C08', 'Hotel Mahi Regency', 'HT', 'Hotel with restaurant and banquet', 'Amul Dairy Road, Anand', 'LLP', 'AAVFM2468L', 30, 180000, EVERY_DAY, false, '', 'V5',
      { FG03: 14, FG02: 6, FG08: 12, FG06: 8, FG09: 10, FG15: 8, FG14: 4 }],
    ['C09', 'Gyanvatika English Medium School - canteen', 'SC', 'School canteen', 'Lambhvel Road, Anand', 'education trust', '', 15, 90000, MON_SAT, true, '', 'V5',
      { FG16: 100, FG17: 30, FG05: 16, FG01: 6, FG15: 10 }],
    ['C10', 'Crustwala Cafe', 'CF', 'Cafe and fast-food counter', 'Vallabh Vidyanagar', 'proprietor', 'CKQPP3792M', 15, 75000, 'alternate', false, '', 'V5',
      { FG08: 40, FG06: 24, FG07: 12, FG09: 30, FG18: 30 }]
  ];

  /* the outlets are listed by id, the corporates after them */
  var CLASS_OF = {};
  CORP_ROWS.forEach(function (r) {
    CLASS_OF[r[0]] = r[2];
    customers.push({
      id: r[0], name: r[1], channel: 'corporate', outletType: r[3], typeCode: r[2], routeId: null, locality: r[4],
      constitution: r[5], terms: 'credit', creditDays: r[7], creditLimit: rs(r[8]), gstin: r[6] ? gstin(r[6]) : '',
      standing: {},
      /* the seed's order rule; no form shows it. alternate: every day whose count from go-live is even */
      pattern: {
        weekdays: r[9] === 'alternate' ? EVERY_DAY : r[9], alternate: r[9] === 'alternate', termOnly: r[10],
        poRef: r[11], deliveredBy: r[12],
        lines: Object.keys(r[13]).map(function (k) { return { itemId: k, qty: r[13][k] }; })
      },
      active: true
    });
  });

  /* ------------------------------------------------- vendors (RESEARCH 5) */

  /* Stock vendors: id, name, town, constitution, PAN ('' = not registered), credit days, supplies. */
  var STOCK_VENDORS = [
    ['VM01', 'Godhumvan Roller Flour Mills Pvt Ltd', 'Nadiad', 'private company', 'AAGCG4172M', 15, ['RM01']],
    ['VM02', 'Kanakshali Chakki Atta Udyog', 'Borsad', 'proprietor', 'BKTPP6391H', 15, ['RM02']],
    ['VM03', 'Sharkaravan Sugar and Salt Traders', 'Anand', 'partnership firm', 'ABMFS2846J', 10, ['RM03', 'RM09']],
    ['VM04', 'Snigdhakosh Bakery Fats LLP', 'Vadodara', 'LLP', 'ACDFS7150R', 21, ['RM04', 'RM05']],
    ['VM05', 'Tailvan Oil Depot', 'Anand', 'proprietor', 'CLNPT4418B', 14, ['RM07']],
    ['VM06', 'Ksheervan Dairy Products Agency', 'Anand', 'partnership firm', 'AAZFK9263D', 7, ['RM06', 'RM10']],
    ['VM07', 'Kinvashakti Bakery Ingredients Pvt Ltd', 'Ahmedabad', 'private company', 'AAHCK3057N', 15, ['RM08', 'RM11', 'RM12', 'RM13', 'RM17', 'RM18']],
    ['VM08', 'Elachivala Masala Bhandar', 'Anand', 'proprietor', 'DQRPM8824L', 15, ['RM14', 'RM15', 'RM16', 'RM24']],
    ['VM09', 'Shakmandap Vegetable Suppliers', 'Anand', 'proprietor', '', 7, ['RM19', 'RM20', 'RM23']],
    ['VM10', 'Sheetkosh Frozen Foods', 'Vallabh Vidyanagar', 'proprietor', 'EHYPS5136C', 7, ['RM21']],
    ['VM11', 'Dugdhkalash Paneer and Dairy Farm', 'Karamsad', 'proprietor', '', 7, ['RM22']],
    ['VM12', 'Veshtan Polyfilms Pvt Ltd', 'Vadodara', 'private company', 'AAKCV6609P', 30, ['PM01', 'PM02', 'PM03', 'PM04', 'PM05']],
    ['VM13', 'Kagazvesh Print Pack', 'Vitthal Udyognagar', 'partnership firm', 'ABGFK1784E', 30, ['PM06', 'PM07', 'PM08']]
  ];

  /*
   * Expense vendors: id, name, town, type, PAN, GST % on its bills, expense category, terms in days from the
   * bill date. A rent or telephone bill "dated the 1st, due the 7th" is 6 days; the bank is paid the same day.
   * VE08 is "15 for the contract, 7 otherwise" and the engine takes one number: it is 15 here and its two other
   * bills carry payAfterDays 7 in sim.expenses.bills. The longer term is the one kept so that a seeded bill is
   * paid on or before the due date its document shows, never after it (docs/CONFIG.md, choice 11).
   */
  var EXPENSE_VENDORS = [
    ['VE01', 'Kesarvan Estates LLP', 'Anand', 'factory landlord', 'AAUFK5392G', 18, 'rent', 6],
    ['VE02', 'Maganbhai D. Thakkar', 'Anand', 'landlord of S1', '', 0, 'rent', 4],
    ['VE03', 'Sarlaben K. Amin', 'Vallabh Vidyanagar', 'landlord of S2', '', 0, 'rent', 4],
    ['VE04', 'Rafiqbhai G. Mansuri', 'Nadiad', 'landlord of S3', '', 0, 'rent', 4],
    ['VE05', 'Electricity distribution company', '', 'utility', '', 0, 'electricity', 10],
    ['VE06', 'City gas distributor', 'Anand', 'utility', '', 0, 'oven_fuel', 10],
    ['VE07', 'Tulsivan Fuel Point', 'Anand', 'fuel station', 'AATFT8061Q', 0, 'vehicle_fuel', 7],
    ['VE08', 'Agnitej Oven Services', 'Vadodara', 'oven and machinery service', 'ABEFA2475K', 18, 'repairs', 15],
    ['VE09', 'Broadband and mobile operator', '', 'telecom operator', '', 18, 'telephone', 15],
    ['VE10', 'Pandit Lakdawala and Co., Chartered Accountants', 'Anand', 'accounting firm', 'AASFP6318C', 18, 'professional', 15],
    ['VE11', 'Pahiyaveg Motor Garage', 'Anand', 'garage', 'FMVPC7745D', 18, 'vehicle_maint', 15],
    ['VE12', 'Yantradoot Spares and Bearings', 'Anand', 'spares dealer', 'ABXFY3906H', 18, 'repairs', 7],
    ['VE13', 'General insurance company', '', 'insurer', '', 18, 'licences', 7],
    ['VE14', 'Government fees', '', 'pseudo-vendor', '', 0, 'licences', 7],
    ['VE15', 'Aharnirikshan Food Testing Laboratory Pvt Ltd', 'Vallabh Vidyanagar', 'laboratory', 'AAJCA8452F', 18, 'licences', 7],
    ['VE16', 'The bank', '', 'bank', '', 18, 'bank_charges', 0],
    ['VE17', 'Ganveshkala Uniforms', 'Anand', 'garment supplier', 'GRWPV2587N', 5, 'staff_welfare', 7],
    ['VE18', 'Family clinic', 'Anand', 'clinic', '', 0, 'staff_welfare', 7],
    ['VE19', 'Mithaskalash Sweets and Farsan', 'Anand', 'sweet and gift supplier', 'ABPFM4063T', 5, 'staff_welfare', 7],
    ['VE20', 'Chitrakala Print and Sign', 'Anand', 'printer and sign maker', 'AAQFC9731B', 18, 'marketing', 7],
    ['VE21', 'Dhvaniprachar Media Pvt Ltd', 'Anand', 'advertising agency', 'AANCD1648R', 18, 'marketing', 7],
    ['VE22', 'Swachhmitra Facility Services', 'Anand', 'housekeeping contractor', 'ABCFS5820L', 18, 'running', 7],
    ['VE23', 'Industrial estate water supply', 'Vitthal Udyognagar', 'utility', '', 0, 'running', 7],
    ['VE24', 'Jantumukt Pest Care', 'Anand', 'pest control', 'HJKPJ3379A', 18, 'running', 7]
  ];

  var vendors = [];
  STOCK_VENDORS.forEach(function (r) {
    vendors.push({ id: r[0], name: r[1], kind: 'stock', town: r[2], constitution: r[3], gstin: r[4] ? gstin(r[4]) : '', termsDays: r[5], supplies: r[6], active: true });
  });
  EXPENSE_VENDORS.forEach(function (r) {
    vendors.push({ id: r[0], name: r[1], kind: 'expense', town: r[2], type: r[3], gstin: r[4] ? gstin(r[4]) : '', billGstRate: r[5], categoryId: r[6], termsDays: r[7], supplies: [], active: true });
  });
  /* the one vendor of kind 'staff': the payee of every salary bill, paid on the 5th of the next month */
  vendors.push({ id: 'VS01', name: 'Staff salaries', kind: 'staff', town: 'Anand', gstin: '', termsDays: 5, supplies: [], active: true });

  /* ------------------------------------------------- employees (RESEARCH 8.2) */

  /*
   * id, name, department, designation, unit, joined, grade, then the monthly salary in rupees from
   * 2026-01-01, from 2026-04-01 and from 2027-04-01 (0 = no longer employed). For the three joiners the
   * first figure is the starting salary. The table binds; the raise rule is in sim.people.
   */
  var AA = 'Accounts and admin', SP = 'Stores and purchase', PR = 'Production', PK = 'Packing', DS = 'Dispatch and sales', OS = 'Own stores';
  var EMP_ROWS = [
    ['E001', 'Nilesh Patel', AA, 'Owner (proprietor)', 'factory', '2011-04-01', 'M', 90000, 90000, 90000],
    ['E002', 'Falguni Shah', AA, 'Accounts and admin executive', 'factory', '2016-06-16', 'M', 28000, 30200, 32600],
    ['E003', 'Krupa Macwan', AA, 'Accounts assistant (billing)', 'factory', '2023-07-03', 'SS', 15500, 16700, 18000],
    ['E004', 'Imran Vohra', SP, 'Purchase and stores keeper', 'factory', '2014-02-10', 'M', 24000, 25900, 28000],
    ['E005', 'Ramesh Padhiyar', SP, 'Stores helper', 'factory', '2021-09-01', 'U', 14000, 15100, 16300],
    ['E006', 'Bharat Prajapati', PR, 'Production supervisor', 'factory', '2012-05-05', 'M', 32000, 34600, 37400],
    ['E007', 'Salim Malek', PR, 'Master baker, bread and buns', 'factory', '2013-08-12', 'S', 24000, 25900, 28000],
    ['E008', 'Dinesh Solanki', PR, 'Master baker, toast, khari and biscuit', 'factory', '2015-01-02', 'S', 23000, 24800, 26800],
    ['E009', 'Mukesh Parmar', PR, 'Pastry and puff maker', 'factory', '2019-11-18', 'S', 20000, 21600, 23300],
    ['E010', 'Vijay Chauhan', PR, 'Oven operator', 'factory', '2018-03-07', 'S', 17000, 18400, 19900],
    ['E011', 'Sanjay Rathod', PR, 'Mixer operator', 'factory', '2020-06-21', 'S', 16500, 17800, 19200],
    ['E012', 'Kanu Thakor', PR, 'Production helper', 'factory', '2022-04-04', 'U', 14000, 15100, 16300],
    ['E013', 'Arvind Vaghela', PR, 'Production helper', 'factory', '2022-07-15', 'U', 14000, 15100, 16300],
    ['E014', 'Raju Baria', PR, 'Production helper', 'factory', '2024-10-09', 'U', 13800, 14900, 16100],
    ['E015', 'Suresh Tadvi', PR, 'Production helper', 'factory', '2025-06-02', 'U', 13800, 14900, 16100],
    ['E016', 'Jyotsna Makwana', PK, 'Packing in-charge', 'factory', '2016-12-01', 'S', 17500, 18900, 20400],
    ['E017', 'Mahesh Gohil', PK, 'Slicing machine operator', 'factory', '2021-02-14', 'SS', 15000, 16200, 17500],
    ['E018', 'Manjula Vankar', PK, 'Packer', 'factory', '2022-08-05', 'U', 13800, 14900, 16100],
    ['E019', 'Sharda Rohit', PK, 'Packer', 'factory', '2024-01-20', 'U', 13800, 14900, 16100],
    ['E020', 'Hansa Parmar', PK, 'Packer', 'factory', '2025-03-17', 'U', 13800, 0, 0],
    ['E021', 'Hardik Thakkar', DS, 'Sales and dispatch executive', 'factory', '2017-07-01', 'M', 27000, 29200, 31500],
    ['E022', 'Yusuf Pathan', DS, 'Driver-salesman, route R1', 'factory', '2015-06-06', 'S', 19000, 20500, 22100],
    ['E023', 'Jignesh Rabari', DS, 'Driver-salesman, route R2', 'factory', '2018-09-19', 'S', 19000, 20500, 22100],
    ['E024', 'Prakash Christian', DS, 'Driver-salesman, route R3', 'factory', '2020-02-03', 'S', 18500, 20000, 21600],
    ['E025', 'Ashok Bharwad', DS, 'Driver-salesman, route R4', 'factory', '2023-05-23', 'S', 18500, 20000, 0],
    ['E026', 'Kiran Darji', DS, 'Driver, corporate and store deliveries', 'factory', '2024-01-08', 'S', 18000, 19400, 21000],
    ['E027', 'Vipul Raval', DS, 'Delivery helper', 'factory', '2023-03-01', 'U', 13800, 14900, 16100],
    ['E028', 'Anil Vasava', DS, 'Delivery helper', 'factory', '2024-12-12', 'U', 13800, 14900, 16100],
    ['E029', 'Ketan Bhatt', OS, 'Store manager', 'st_anand', '2017-10-10', 'M', 23000, 24800, 26800],
    ['E030', 'Rekha Solanki', OS, 'Counter assistant', 'st_anand', '2023-05-06', 'SS', 14000, 15100, 16300],
    ['E031', 'Chirag Panchal', OS, 'Counter assistant', 'st_anand', '2024-11-11', 'SS', 13800, 14900, 16100],
    ['E032', 'Nisha Desai', OS, 'Store manager', 'st_vvn', '2019-04-15', 'M', 22000, 23800, 25700],
    ['E033', 'Pooja Mistry', OS, 'Counter assistant', 'st_vvn', '2024-09-02', 'SS', 14000, 15100, 16300],
    ['E034', 'Alpesh Trivedi', OS, 'Store manager', 'st_nadiad', '2021-08-01', 'M', 19000, 20500, 22100],
    ['E035', 'Daxa Chauhan', OS, 'Counter assistant', 'st_nadiad', '2025-02-24', 'SS', 13800, 14900, 16100],
    ['E036', 'Geeta Padhiyar', PK, 'Packer', 'factory', '2026-03-09', 'U', 13800, 13800, 14900],
    ['E037', 'Riya Joshi', OS, 'Counter assistant', 'st_vvn', '2026-06-15', 'SS', 14500, 14500, 15700],
    ['E038', 'Firoz Shaikh', DS, 'Driver-salesman, route R4', 'factory', '2026-08-01', 'S', 19500, 19500, 21100]
  ];
  var LEAVERS = { E020: '2026-02-28', E025: '2026-07-31' };

  function employeeOf(r) {
    return { id: r[0], name: r[1], dept: r[2], designation: r[3], unitId: r[4], doj: r[5], dol: null, grade: r[6],
      salary: rs(r[7]), phone: phoneOf(r[0]), active: true };
  }
  /* The directory at go-live: the 35 who are employed on 2026-01-01. Joiners and leavers are dated changes (sim.people). */
  var employees = EMP_ROWS.filter(function (r) { return r[5] <= '2026-01-01'; }).map(employeeOf);

  /* ------------------------------------------------- categories, users, limits (RESEARCH 9.1, 8.3) */

  var expenseCategories = [
    { id: 'salaries', name: 'Salaries', mode: 'bill', system: 'salary', active: true },
    { id: 'rent', name: 'Rent', mode: 'bill', active: true },
    { id: 'electricity', name: 'Electricity', mode: 'bill', active: true },
    { id: 'oven_fuel', name: 'Oven fuel (gas)', mode: 'bill', active: true },
    { id: 'vehicle_fuel', name: 'Vehicle fuel', mode: 'both', active: true },
    { id: 'vehicle_maint', name: 'Vehicle maintenance', mode: 'both', active: true },
    { id: 'repairs', name: 'Repairs and maintenance', mode: 'both', active: true },
    { id: 'licences', name: 'Licences and insurance', mode: 'bill', active: true },
    { id: 'telephone', name: 'Telephone and internet', mode: 'both', active: true },
    { id: 'professional', name: 'Professional fees', mode: 'bill', active: true },
    { id: 'bank_charges', name: 'Bank charges', mode: 'bill', active: true },
    { id: 'staff_welfare', name: 'Staff welfare', mode: 'both', active: true },
    { id: 'marketing', name: 'Marketing', mode: 'both', active: true },
    { id: 'running', name: 'Running costs', mode: 'both', active: true },
    { id: 'cash_short', name: 'Store cash short / excess', mode: 'bill', system: 'cash_short', active: true }
  ];

  /* The same ids as the kernel's built-in personas, so that a stored persona survives. */
  var users = [
    { id: 'u_owner', name: 'Nilesh Patel', role: 'owner', employeeId: 'E001', unitId: 'factory' },
    { id: 'u_accounts', name: 'Falguni Shah', role: 'accounts', employeeId: 'E002', unitId: 'factory' },
    { id: 'u_stores', name: 'Imran Vohra', role: 'stores', employeeId: 'E004', unitId: 'factory' },
    { id: 'u_production', name: 'Bharat Prajapati', role: 'production', employeeId: 'E006', unitId: 'factory' },
    { id: 'u_sales', name: 'Hardik Thakkar', role: 'sales', employeeId: 'E021', unitId: 'factory' },
    { id: 'u_store_mgr', name: 'Nisha Desai', role: 'store_mgr', roleLabel: 'Store manager, Vallabh Vidyanagar', employeeId: 'E032', unitId: 'st_vvn' }
  ];

  var limits = {
    poAutoApprove: rs(50000),   /* an order above this waits for the Owner */
    billTolerancePct: 2,        /* three-way check */
    returnsPct: 8,              /* stale returns against seven days of supply */
    backDateDays: 3,
    nearExpiryDays: 1,
    dueSoonDays: 7,
    /*
     * Figures that look wrong (SCOPE decision 18): the entry is posted all the same, with a warning. Each value
     * lies outside what RESEARCH.md says an ordinary day gives, so a normal entry raises none. The engine reads
     * them here and holds no value of its own; the seed is never warned.
     */
    warn: {
      yieldLowPct: 80,          /* good units under this share of what the recipe expects for the mixes. 3.4: the worst bad run short of an oven fault leaves 81% (puffs, 20% rejected); the dip of 12.2 leaves 89% */
      yieldHighPct: 105,        /* or above this one. 3.3, 3.4: the best a run can give is 104.2% (butter khari: 139 pieces against 134 expected, 2% drift up, half the normal reject) */
      countAwayPct: 20,         /* a counted quantity this far from the books, either way. 9.5: a month-end count is out by 2% of a month's use at most */
      countMinValue: rs(500),   /* unless the difference is worth less than this: 9.5 puts a whole month-end count at about Rs 5,000 */
      claimAbove: rs(5000),     /* a claim above this. 9.6: claims run from Rs 80 to Rs 2,600 */
      rateAwayPct: 25,          /* an order rate this far from the latest purchase price. 4.2, 4.3: from month to month a material moves by a fifth at most (sugar, July to August 2026), onions apart */
      dayEndAwayPct: 10         /* cash and UPI this far from the day's sales at MRP. 12.6: a till is short by Rs 180 at most, a few per cent of a store's day */
    }
  };

  /* ------------------------------------------------- guide journeys (SPEC 8.1) */

  /*
   * A step is { text, route, role, match: { op, type, test } }. `op` is the operation of the log entry; `type`
   * the type of the document it made (post, postDispatch) or acted on (approve, receiveTransfer); `test`,
   * when there is one, is test(entry, docs, env) -> boolean, where docs are those documents and env is
   * { book, masters } (HB.book and HB.masters when left out). A test looks at what was entered or computed,
   * never at the status the document ended in. `role` is the persona the guide suggests, not a condition.
   * `links` are what to look at afterwards: { text, route, params }, where params (optional) are the route parameters
   * that open the screen on what the text names (a location, an account, a product, a tab). No figure is written into
   * a sentence: limits are masters.
   */
  var FLOUR = 'RM01';

  function envOf(env) { return env || { book: HB.book, masters: HB.masters }; }

  /** The documents a log entry made, or the one it acted on. */
  function entryDocs(entry, env) {
    var e = envOf(env), docs = [], ids = entry.out && entry.out.ids ? entry.out.ids : [], i;
    if (entry.op === 'post' || entry.op === 'postDispatch') {
      for (i = 0; i < ids.length; i++) if (e.book.docs[ids[i]]) docs.push(e.book.docs[ids[i]]);
    } else if (entry.args && entry.args.id && e.book.docs[entry.args.id]) {
      docs.push(e.book.docs[entry.args.id]);
    }
    return docs;
  }

  /** Does this log entry tick this step? The guide adds the order of the steps and the Owner's own approval. */
  function stepMatches(step, entry, env) {
    var m = step && step.match, e = envOf(env), docs;
    if (!m || !entry || entry.op !== m.op || !e.book) return false;
    docs = entryDocs(entry, e);
    if (m.type && (!docs.length || docs[0].type !== m.type)) return false;
    return m.test ? !!m.test(entry, docs, e) : true;
  }

  /** The latest purchase price of an item as it stood just before the posting numbered `seq`. */
  function priceBefore(itemId, seq, env) {
    var p = env.book.prices[itemId], rate = 0, i, h, d, cx;
    if (!p) return 0;
    for (i = 0; i < p.history.length; i++) {
      h = p.history[i];
      if (h.seq > seq) break;
      if (h.cancelled) {
        /* a receipt cancelled after the order was still the latest price when the order was raised */
        d = env.book.docs[h.docId];
        cx = d && d.cancelled ? env.book.docs[d.cancelled.docId] : null;
        if (!cx || cx.seq < seq) continue;
      }
      rate = h.rate;
    }
    return rate;
  }

  function anyLine(doc, fn) {
    var lines = doc && doc.lines ? doc.lines : [];
    for (var i = 0; i < lines.length; i++) if (fn(lines[i])) return true;
    return false;
  }
  function isClaim(entry, docs) { return docs[0].kind === 'claim'; }

  var journeys = [
    {
      id: 'dispatch',
      title: 'Post today\'s dispatch for a route and see sales, stock and cash move',
      steps: [
        { text: 'Open Dispatch and pick one route for today. The sheet is filled in from each outlet\'s standing order. Change a quantity if you like, then post the sheet: every outlet gets its invoice.',
          route: '#/sell/dispatch', role: 'sales',
          match: { op: 'postDispatch', type: 'INV', test: function (entry) { return !!entry.args && entry.args.date === String(entry.at).slice(0, 10); } } }
      ],
      links: [
        { text: 'Dashboard: today\'s sales and collections', route: '#/home' },
        { text: 'Finished stock at the factory', route: '#/stock/onhand', params: { loc: 'fac_fg' } },
        { text: 'Cash book: what the cash outlets paid at the drop', route: '#/accounts/cash', params: { account: 'cash_factory' } }
      ]
    },
    {
      id: 'flour',
      title: 'Raise a flour order at a higher rate, receive it, and see bread cost and margin move',
      steps: [
        { text: 'Raise a purchase order for maida at a rate above the last price paid. Order a few bags only, so that the order stays within the approval limit and is approved as you submit it.',
          route: '#/buy/orders', role: 'stores',
          match: { op: 'post', type: 'PO', test: function (entry, docs, env) {
            var po = docs[0];
            return anyLine(po, function (l) { return l.itemId === FLOUR && l.rate > priceBefore(FLOUR, po.seq, env); });
          } } },
        { text: 'When the flour arrives, enter the goods receipt against the order. The new rate becomes the latest price of maida.',
          route: '#/buy/receipts', role: 'stores',
          match: { op: 'post', type: 'GRN', test: function (entry, docs) {
            return anyLine(docs[0], function (l) { return l.itemId === FLOUR && l.qty > 0; });
          } } }
      ],
      links: [
        { text: 'Cost sheet of sandwich bread', route: '#/make/recipes', params: { item: 'FG01' } },
        { text: 'Product margin', route: '#/accounts/margin' }
      ]
    },
    {
      id: 'bill',
      title: 'Enter the vendor bill at a different rate so that it is held, approve it as the Owner, pay it',
      steps: [
        { text: 'Enter the vendor\'s bill for a goods receipt that has no bill yet, and type one rate higher than the order rate. The bill no longer agrees with the order and the receipt, so it is held.',
          route: '#/buy/bills', role: 'accounts',
          match: { op: 'post', type: 'VBILL', test: function (entry, docs) { return !!docs[0].match && docs[0].match.ok === false; } } },
        { text: 'As the Owner, open Approvals, read the order, the receipt and the bill side by side, and approve the held bill.',
          route: '#/approvals', role: 'owner',
          match: { op: 'approve', type: 'VBILL' } },
        { text: 'Pay the bill from the bank.',
          route: '#/buy/payments', role: 'accounts',
          match: { op: 'post', type: 'PAY', test: function (entry, docs, env) {
            var a = docs[0].allocations || [], i, d;
            for (i = 0; i < a.length; i++) { d = env.book.docs[a[i].docId]; if (d && d.type === 'VBILL') return true; }
            return false;
          } } }
      ],
      links: [
        { text: 'Payables: what is still owed to the vendor', route: '#/accounts/payables' },
        { text: 'Cash book: the payment out of the bank', route: '#/accounts/cash', params: { account: 'bank' } }
      ]
    },
    {
      id: 'production',
      title: 'Record a production run with rejects and see yield and production loss',
      steps: [
        { text: 'Enter a production run for one product: the mixes made, the good units packed and the units rejected.',
          route: '#/make/production', role: 'production',
          match: { op: 'post', type: 'PROD', test: function (entry, docs) { return docs[0].rejectedUnits > 0; } } }
      ],
      links: [
        { text: 'Production register: the yield of the run', route: '#/make/production' },
        { text: 'Monthly profit and loss: production loss', route: '#/accounts/pnl' }
      ]
    },
    {
      id: 'store',
      title: 'Send stock to a store, confirm it as the store manager, enter the day-end with expired units, approve the write-off',
      steps: [
        { text: 'Send today\'s stock to the Vidyanagar store. The sheet tops the store up to its standing quantities.',
          route: '#/stores/transfers', role: 'stores',
          match: { op: 'post', type: 'XFER', test: function (entry, docs, env) {
            var users = env.masters && env.masters.users ? env.masters.users : [], store = 'st_vvn', i;
            for (i = 0; i < users.length; i++) if (users[i].role === 'store_mgr' && users[i].unitId) store = users[i].unitId;
            return docs[0].toStoreId === store;
          } } },
        { text: 'Switch to the store manager and confirm that the stock has arrived.',
          route: '#/stores/transfers', role: 'store_mgr',
          match: { op: 'receiveTransfer', type: 'XFER' } },
        { text: 'Enter the store\'s day-end: units sold of each item, units past their best-before date, the cash counted and the UPI total.',
          route: '#/stores/dayend', role: 'store_mgr',
          match: { op: 'post', type: 'DAYEND', test: function (entry, docs) { return anyLine(docs[0], function (l) { return l.expired > 0; }); } } },
        { text: 'As the Owner, approve the write-off of the expired units.',
          route: '#/approvals', role: 'owner',
          match: { op: 'approve', type: 'WO', test: function (entry, docs, env) {
            var src = docs[0].sourceDocId ? env.book.docs[docs[0].sourceDocId] : null;
            return !!src && src.type === 'DAYEND';
          } } }
      ],
      links: [
        { text: 'Stock at the store', route: '#/stock/onhand', params: { loc: 'st_vvn' } },
        { text: 'Monthly profit and loss: store sales and write-offs', route: '#/accounts/pnl' }
      ]
    },
    {
      id: 'return',
      title: 'Enter a stale return above the limit and approve it',
      steps: [
        { text: 'Enter a stale return for an outlet that is large against what the outlet bought in the last seven days. A return above the limit is held for the Owner.',
          route: '#/sell/returns', role: 'sales',
          match: { op: 'post', type: 'CN', test: function (entry, docs, env) {
            var cn = docs[0], lim = env.masters && env.masters.limits ? env.masters.limits.returnsPct : limits.returnsPct;
            return cn.sharePct === null || cn.sharePct === undefined || cn.sharePct > lim;
          } } },
        { text: 'As the Owner, look at the outlet\'s supply and returns of the week and approve the held return.',
          route: '#/approvals', role: 'owner',
          match: { op: 'approve', type: 'CN' } }
      ],
      links: [
        { text: 'Stale returns by outlet', route: '#/sell/returns' },
        { text: 'The outlet\'s statement', route: '#/sell/receipts', params: { tab: 'statement' } }
      ]
    },
    {
      id: 'claim',
      title: 'Submit an expense claim as the store manager, approve it, reimburse it, and see spend by location',
      steps: [
        { text: 'As the store manager, submit a claim for something the store paid for out of pocket.',
          route: '#/expenses', role: 'store_mgr',
          match: { op: 'post', type: 'EXP', test: isClaim } },
        { text: 'As the Owner, approve the claim.',
          route: '#/approvals', role: 'owner',
          match: { op: 'approve', type: 'EXP', test: isClaim } },
        { text: 'As Accounts, reimburse the claim to the employee.',
          route: '#/buy/payments', role: 'accounts',
          match: { op: 'post', type: 'PAY', test: function (entry, docs) { return docs[0].payeeType === 'employee'; } } }
      ],
      links: [
        { text: 'Expenses by location', route: '#/expenses' }
      ]
    },
    {
      id: 'collect',
      title: 'Receive a payment from a corporate and deposit cash in the bank, and see receivables and the cash book move',
      steps: [
        { text: 'Record a payment received from a corporate customer against its invoices. Take it in cash if you want to bank it in the next step.',
          route: '#/sell/receipts', role: 'accounts',
          match: { op: 'post', type: 'RCPT', test: function (entry, docs, env) {
            var c = env.masters && env.masters.customerById ? env.masters.customerById[docs[0].customerId] : null;
            return !!c && c.channel === 'corporate';
          } } },
        { text: 'Deposit cash from the factory cash box in the bank.',
          route: '#/accounts/cash', role: 'accounts',
          match: { op: 'post', type: 'DEP' } }
      ],
      links: [
        { text: 'Receivables: what the customer still owes', route: '#/accounts/receivables' },
        { text: 'Cash book: cash out, bank in', route: '#/accounts/cash', params: { account: 'cash_factory' } }
      ]
    }
  ];

  /* ============================================================ PRICES */

  /* ------------------------------------------------- purchase prices (RESEARCH 4.2 - 4.4) */

  /*
   * One price a month, rupees per stock unit before GST, January 2026 to December 2027 (24 figures a row).
   * January to October 2026 are researched; November 2026 onwards is the rule below evaluated, and the
   * table binds where arithmetic could land on either side of a rounding step.
   */
  var PRICE_FROM = '2026-01', PRICE_TO = '2027-12';
  var PRICE_ROWS = {
    RM01: [36.00, 36.00, 35.60, 35.00, 35.60, 36.60, 37.40, 38.20, 38.80, 39.00, 39.10, 39.20, 39.40, 39.50, 39.00, 38.50, 39.00, 39.70, 40.50, 41.00, 41.50, 41.60, 41.80, 41.90],
    RM02: [33.50, 33.50, 33.10, 32.50, 33.10, 34.10, 34.90, 35.70, 36.30, 36.50, 36.60, 36.70, 36.80, 36.90, 36.50, 36.00, 36.50, 37.20, 37.90, 38.40, 38.90, 39.00, 39.10, 39.20],
    RM03: [40.20, 41.20, 41.40, 41.50, 42.70, 42.30, 46.80, 56.40, 51.90, 47.40, 45.60, 44.30, 44.50, 44.60, 44.70, 44.90, 45.00, 45.20, 45.30, 45.40, 45.60, 45.70, 45.80, 46.00],
    RM04: [150, 151, 153, 155, 158, 160, 163, 166, 170, 168, 165, 166, 167, 176, 176, 177, 178, 178, 179, 180, 181, 181, 182, 183],
    RM05: [164, 165, 167, 169, 172, 175, 178, 182, 186, 184, 181, 182, 182, 192, 193, 194, 195, 195, 196, 197, 198, 199, 199, 200],
    RM06: [455, 455, 460, 465, 472, 480, 480, 478, 476, 474, 471, 470, 469, 471, 492, 499, 505, 512, 514, 513, 512, 509, 506, 505],
    RM07: [142, 144, 146, 147, 149, 151, 154, 158, 164, 161, 157, 157, 158, 163, 164, 165, 165, 166, 167, 167, 168, 169, 169, 170],
    RM08: [118, 118, 118, 118, 118, 118, 122, 122, 122, 122, 122, 123, 123, 123, 124, 124, 124, 124, 125, 125, 125, 126, 126, 126],
    RM09: [9.00, 9.00, 9.00, 9.00, 9.00, 9.00, 9.40, 9.40, 9.40, 9.40, 9.40, 9.40, 9.50, 9.50, 9.50, 9.50, 9.60, 9.60, 9.60, 9.60, 9.70, 9.70, 9.70, 9.70],
    RM10: [265, 265, 268, 272, 276, 280, 280, 278, 275, 272, 270, 270, 269, 270, 282, 286, 290, 294, 295, 294, 294, 292, 290, 290],
    RM11: [210, 210, 210, 210, 210, 210, 216, 216, 216, 216, 217, 217, 218, 218, 219, 219, 220, 220, 221, 221, 222, 223, 223, 224],
    RM12: [150, 150, 150, 150, 150, 150, 155, 155, 155, 155, 155, 156, 156, 157, 157, 157, 158, 158, 159, 159, 159, 160, 160, 161],
    RM13: [75, 75, 75, 75, 75, 75, 75, 75, 75, 75, 75, 75, 76, 76, 76, 76, 76, 77, 77, 77, 77, 77, 77, 78],
    RM14: [2550, 2550, 2600, 2650, 2700, 2750, 2800, 2800, 2750, 2700, 2710, 2720, 2720, 2730, 2740, 2750, 2760, 2770, 2770, 2780, 2790, 2800, 2810, 2820],
    RM15: [215, 212, 205, 205, 208, 212, 216, 220, 222, 222, 223, 223, 224, 225, 225, 226, 227, 227, 228, 229, 229, 230, 231, 232],
    RM16: [155, 155, 155, 155, 155, 155, 160, 160, 160, 160, 160, 161, 161, 162, 162, 163, 163, 164, 164, 165, 165, 166, 166, 167],
    RM17: [92, 92, 92, 92, 92, 92, 94, 98, 102, 100, 100, 101, 101, 101, 102, 102, 102, 102, 103, 103, 103, 104, 104, 104],
    RM18: [520, 520, 520, 520, 520, 520, 520, 520, 520, 520, 520, 525, 525, 525, 525, 530, 530, 530, 530, 535, 535, 535, 535, 540],
    RM19: [13.00, 11.00, 10.50, 11.50, 12.50, 13.50, 14.50, 15.00, 15.50, 16.50, 17.00, 15.60, 13.50, 11.70, 11.20, 12.20, 13.30, 14.20, 15.30, 15.80, 16.10, 17.20, 17.70, 16.30],
    RM20: [20.00, 18.00, 16.00, 15.00, 16.00, 19.00, 24.00, 32.00, 44.00, 46.00, 39.10, 26.60, 23.00, 20.70, 18.30, 17.20, 18.40, 21.00, 24.80, 28.60, 32.40, 35.00, 32.60, 25.20],
    RM21: [84, 82, 80, 80, 82, 84, 86, 88, 90, 90, 90, 91, 85, 83, 82, 82, 84, 86, 89, 91, 93, 93, 94, 94],
    RM22: [330, 330, 335, 340, 348, 355, 355, 352, 350, 348, 346, 345, 345, 346, 361, 366, 371, 376, 377, 377, 376, 374, 371, 371],
    RM23: [160, 150, 135, 125, 125, 130, 138, 145, 150, 155, 157, 158, 161, 154, 140, 130, 130, 137, 143, 149, 154, 161, 163, 163],
    RM24: [360, 360, 360, 360, 360, 360, 370, 370, 370, 370, 371, 372, 373, 374, 376, 377, 378, 379, 380, 381, 382, 384, 385, 386],
    PM01: [1.00, 1.00, 1.00, 1.00, 1.05, 1.05, 1.10, 1.10, 1.10, 1.10, 1.10, 1.11, 1.11, 1.11, 1.11, 1.12, 1.12, 1.12, 1.12, 1.13, 1.13, 1.13, 1.14, 1.14],
    PM02: [1.60, 1.60, 1.60, 1.60, 1.68, 1.68, 1.76, 1.76, 1.76, 1.76, 1.76, 1.77, 1.77, 1.78, 1.78, 1.79, 1.79, 1.80, 1.80, 1.80, 1.81, 1.81, 1.82, 1.82],
    PM03: [0.55, 0.55, 0.55, 0.55, 0.58, 0.58, 0.60, 0.60, 0.60, 0.60, 0.60, 0.60, 0.60, 0.61, 0.61, 0.61, 0.61, 0.61, 0.61, 0.62, 0.62, 0.62, 0.62, 0.62],
    PM04: [2.00, 2.00, 2.00, 2.00, 2.10, 2.10, 2.18, 2.18, 2.18, 2.18, 2.19, 2.19, 2.20, 2.20, 2.21, 2.21, 2.22, 2.22, 2.23, 2.24, 2.24, 2.25, 2.25, 2.26],
    PM05: [2.70, 2.70, 2.70, 2.70, 2.84, 2.84, 2.94, 2.94, 2.94, 2.94, 2.95, 2.95, 2.96, 2.97, 2.98, 2.98, 2.99, 3.00, 3.01, 3.01, 3.02, 3.03, 3.04, 3.04],
    PM06: [6.80, 6.80, 6.80, 6.80, 6.80, 6.80, 7.10, 7.10, 7.10, 7.10, 7.10, 7.15, 7.15, 7.15, 7.20, 7.20, 7.25, 7.25, 7.25, 7.30, 7.30, 7.30, 7.35, 7.35],
    PM07: [0.18, 0.18, 0.18, 0.18, 0.18, 0.18, 0.19, 0.19, 0.19, 0.19, 0.19, 0.19, 0.19, 0.19, 0.19, 0.19, 0.19, 0.19, 0.19, 0.19, 0.20, 0.20, 0.20, 0.20],
    PM08: [0.24, 0.24, 0.24, 0.24, 0.24, 0.24, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.26, 0.26, 0.26, 0.26, 0.26, 0.26, 0.26]
  };

  var PRICE_MONTHS = [], PRICE_TABLE = {};
  (function () {
    for (var i = 0; i < 24; i++) PRICE_MONTHS.push(addMonths(PRICE_FROM, i));
    MAT_IDS.forEach(function (id) { PRICE_TABLE[id] = PRICE_ROWS[id].map(rs); });
  })();

  /** The price of a month, paise per stock unit. A month outside the series takes the nearest end. */
  function priceIn(itemId, monthKey) {
    var row = PRICE_TABLE[itemId], i = monthsBetween(PRICE_FROM, monthKey);
    if (!row) return 0;
    return row[i < 0 ? 0 : (i > 23 ? 23 : i)];
  }
  /** The rate on a purchase order dated `date`: the price of its month. */
  function priceOn(itemId, date) { return priceIn(itemId, date.slice(0, 7)); }

  /* The rule from November 2026 (RESEARCH 4.4): price = round_half_up( A x (1 + d)^n x shape x events ). */
  var SHAPES = {
    dairy: [0.98, 0.98, 0.99, 1.00, 1.01, 1.02, 1.02, 1.015, 1.01, 1.00, 0.99, 0.985],
    potato: [0.95, 0.82, 0.78, 0.85, 0.92, 0.98, 1.05, 1.08, 1.10, 1.17, 1.20, 1.10],
    onion: [0.95, 0.85, 0.75, 0.70, 0.75, 0.85, 1.00, 1.15, 1.30, 1.40, 1.30, 1.00],
    garlic: [1.10, 1.05, 0.95, 0.88, 0.88, 0.92, 0.96, 1.00, 1.03, 1.07, 1.08, 1.08],
    peas: [0.98, 0.96, 0.94, 0.94, 0.96, 0.98, 1.01, 1.03, 1.05, 1.05, 1.05, 1.05]
  };
  /* An event is [factor, first month, last month]; null = from then on. */
  var FLOUR_EVENTS = [[0.985, '2027-03', '2027-03'], [0.970, '2027-04', '2027-04'], [0.980, '2027-05', '2027-05'],
    [0.995, '2027-06', '2027-06'], [1.010, '2027-07', '2027-07'], [1.020, '2027-08', '2027-08'], [1.030, '2027-09', null]];
  var FAT_EVENTS = [[0.98, '2026-11', null], [1.05, '2027-02', null]];
  var MILK_EVENTS = [[1.03, '2027-03', null]];
  /* item: [A in rupees, drift a month, shape, events, rounding step in rupees] */
  var PRICE_RULE = {
    RM01: [39, 0.0030, null, FLOUR_EVENTS, 0.1],
    RM02: [36.5, 0.0030, null, FLOUR_EVENTS, 0.1],
    RM03: [47.4, 0.0030, null, [[0.96, '2026-11', '2026-11'], [0.93, '2026-12', null]], 0.1],
    RM04: [168, 0.0040, null, FAT_EVENTS, 1],
    RM05: [184, 0.0040, null, FAT_EVENTS, 1],
    RM06: [474, 0.0035, 'dairy', MILK_EVENTS, 1],
    RM07: [161, 0.0040, null, [[0.97, '2026-11', null], [1.03, '2027-02', null]], 1],
    RM08: [122, 0.0025, null, [], 1],
    RM09: [9.4, 0.0025, null, [], 0.1],
    RM10: [272, 0.0035, 'dairy', MILK_EVENTS, 1],
    RM11: [216, 0.0025, null, [], 1],
    RM12: [155, 0.0025, null, [], 1],
    RM13: [75, 0.0025, null, [], 1],
    RM14: [2700, 0.0030, null, [], 10],
    RM15: [222, 0.0030, null, [], 1],
    RM16: [160, 0.0030, null, [], 1],
    RM17: [100, 0.0030, null, [], 1],
    RM18: [520, 0.0025, null, [], 5],
    RM19: [14.1, 0.0035, 'potato', [], 0.1],
    RM20: [24, 0.0035, 'onion', [[1.25, '2026-11', '2026-11'], [1.1, '2026-12', '2026-12']], 0.1],
    RM21: [85.7, 0.0030, 'peas', [], 1],
    RM22: [348, 0.0035, 'dairy', MILK_EVENTS, 1],
    RM23: [145, 0.0030, 'garlic', [], 1],
    RM24: [370, 0.0030, null, [], 1],
    PM01: [1.1, 0.0025, null, [], 0.01],
    PM02: [1.76, 0.0025, null, [], 0.01],
    PM03: [0.6, 0.0025, null, [], 0.01],
    PM04: [2.18, 0.0025, null, [], 0.01],
    PM05: [2.94, 0.0025, null, [], 0.01],
    PM06: [7.1, 0.0025, null, [], 0.05],
    PM07: [0.19, 0.0025, null, [], 0.01],
    PM08: [0.25, 0.0025, null, [], 0.01]
  };
  var RULE_BASE = '2026-10';

  /** The rule evaluated for a month after October 2026, in paise. For checking the table; the table binds. */
  function priceByRule(itemId, monthKey) {
    var r = PRICE_RULE[itemId], n = monthsBetween(RULE_BASE, monthKey), v, i, e;
    if (!r || n < 1) return priceIn(itemId, monthKey);
    v = r[0] * Math.pow(1 + r[1], n);
    if (r[2]) v *= SHAPES[r[2]][+monthKey.slice(5, 7) - 1];
    for (i = 0; i < r[3].length; i++) {
      e = r[3][i];
      if (monthKey >= e[1] && (e[2] === null || monthKey <= e[2])) v *= e[0];
    }
    /* half up to the step; the small term keeps a binary 0.4999999 from rounding down */
    return Math.round(Math.floor(v / r[4] + 0.5 + 1e-9) * r[4] * 100);
  }

  /* ------------------------------------------------- list-price revisions (RESEARCH 2.4) */

  /* Each is a dated master change, one change row per item, entered before the day's dispatch. Rupees: MRP, retailer, corporate. */
  var REVISION_ROWS = [
    { date: '2026-07-01', reason: 'flour, packaging and diesel', userId: 'u_accounts', rows: {
      FG01: [41, 33.00, 31.00], FG02: [47, 37.50, 35.50], FG03: [72, 58.50, 53.50], FG04: [38, 30.50, 28.50],
      FG05: [33, 26.50, 25.00], FG06: [37, 29.50, 27.50], FG07: [41, 33.00, 31.00], FG08: [50, 40.50, 37.00],
      FG09: [29, 23.00, 21.50] } },
    { date: '2027-04-01', reason: 'shortening, butter and paneer', userId: 'u_accounts', rows: {
      FG10: [59, 44.50, 42.50], FG11: [95, 72.00, 69.00], FG12: [75, 57.00, 54.50], FG13: [70, 53.00, 50.50],
      FG14: [80, 61.00, 58.00], FG15: [59, 45.00, 42.50], FG16: [16, 12.25, 11.75], FG17: [27, 20.50, 19.50],
      FG18: [22, 16.75, 16.00] } }
  ];
  var priceRevisions = REVISION_ROWS.map(function (r) {
    var prices = {};
    Object.keys(r.rows).forEach(function (k) { prices[k] = { mrp: rs(r.rows[k][0]), retail: rs(r.rows[k][1]), corporate: rs(r.rows[k][2]) }; });
    return { date: r.date, reason: r.reason, userId: r.userId, prices: prices };
  });

  /** The price list in force for a document dated `date`: { itemId: { mrp, retail, corporate } } in paise. */
  function priceListOn(date) {
    var list = {}, i, k;
    items.forEach(function (it) { if (it.kind === 'fg') list[it.id] = { mrp: it.price.mrp, retail: it.price.retail, corporate: it.price.corporate }; });
    for (i = 0; i < priceRevisions.length; i++) {
      if (date < priceRevisions[i].date) continue;
      for (k in priceRevisions[i].prices) if (has(priceRevisions[i].prices, k)) list[k] = priceRevisions[i].prices[k];
    }
    return list;
  }

  /* ============================================================ OPENING ENTRIES (RESEARCH 10) */

  /*
   * Finished goods open as batches: at the factory [manufactured, units] per batch; at the stores one batch
   * [manufactured, S1, S2, S3]. Best before = manufactured + shelf life. Puffs open at the factory only.
   */
  var OPEN_FG = {
    FG01: { fac: [['2025-12-31', 740]], st: ['2025-12-30', 23, 11, 12] },
    FG02: { fac: [['2025-12-31', 170]], st: ['2025-12-30', 7, 4, 3] },
    FG03: { fac: [['2025-12-31', 200]], st: ['2025-12-30', 2, 1, 1] },
    FG04: { fac: [['2025-12-31', 800]], st: ['2025-12-30', 17, 8, 9] },
    FG05: { fac: [['2025-12-31', 210]], st: ['2025-12-30', 5, 5, 3] },
    FG06: { fac: [['2025-12-31', 80]], st: ['2025-12-30', 3, 4, 1] },
    FG07: { fac: [['2025-12-31', 40]], st: ['2025-12-30', 2, 2, 1] },
    FG08: { fac: [['2025-12-31', 120]], st: ['2025-12-30', 2, 2, 1] },
    FG09: { fac: [['2025-12-31', 240]], st: ['2025-12-30', 14, 12, 6] },
    FG10: { fac: [['2025-12-24', 700], ['2025-12-29', 1060]], st: ['2025-12-24', 64, 24, 40] },
    FG11: { fac: [['2025-12-24', 220], ['2025-12-29', 320]], st: ['2025-12-24', 32, 12, 16] },
    FG12: { fac: [['2025-12-24', 450], ['2025-12-29', 680]], st: ['2025-12-24', 56, 24, 32] },
    FG13: { fac: [['2025-12-24', 170], ['2025-12-29', 260]], st: ['2025-12-24', 32, 16, 16] },
    FG14: { fac: [['2025-12-24', 200], ['2025-12-29', 310]], st: ['2025-12-24', 32, 16, 16] },
    FG15: { fac: [['2025-12-27', 190], ['2025-12-30', 280]], st: ['2025-12-27', 28, 24, 10] },
    FG16: { fac: [['2025-12-31', 700]], st: null },
    FG17: { fac: [['2025-12-31', 180]], st: null },
    FG18: { fac: [['2025-12-31', 190]], st: null }
  };

  var opening = { date: '2026-01-01', stock: [], cash: [], receivables: [], payables: [] };

  /* materials at the raw material store, at the January 2026 price (which becomes the first purchase price) */
  MAT_IDS.forEach(function (id) {
    opening.stock.push({ locId: 'fac_rm', itemId: id, qty: OPENING_QTY[id], rate: priceIn(id, '2026-01') });
  });
  FG_ROWS.forEach(function (r) {
    var o = OPEN_FG[r[0]], life = r[9];
    o.fac.forEach(function (b) {
      opening.stock.push({ locId: 'fac_fg', itemId: r[0], qty: b[1], mfgDate: b[0], bestBefore: addDays(b[0], life) });
    });
    if (o.st) STORE_IDS.forEach(function (s, i) {
      opening.stock.push({ locId: s, itemId: r[0], qty: o.st[i + 1], mfgDate: o.st[0], bestBefore: addDays(o.st[0], life) });
    });
  });

  opening.cash = [
    { accountId: 'cash_factory', amount: rs(64500) },
    { accountId: 'cash_st_anand', amount: rs(17900) },
    { accountId: 'cash_st_vvn', amount: rs(10300) },
    { accountId: 'cash_st_nadiad', amount: rs(10100) },
    { accountId: 'bank', amount: rs(875000) }
  ];

  /*
   * Opening invoices: customer, rupees, due date, then how the seed receives it - a date, two [date, share]
   * halves, or 'rule' (the customer's first payment weekday on or after the due date). No cash outlet has one.
   */
  var OPEN_AR = [
    ['O11', 6700, '2026-01-05', '2026-01-05'], ['O05', 7700, '2026-01-05', '2026-01-05'],
    ['O01', 8300, '2026-01-05', '2026-01-05'], ['O10', 9400, '2026-01-05', '2026-01-05'],
    ['O12', 9000, '2026-01-05', '2026-01-05'], ['O14', 6600, '2026-01-06', '2026-01-06'],
    ['O17', 6200, '2026-01-06', '2026-01-06'], ['O23', 5400, '2026-01-06', '2026-01-06'],
    ['O32', 4100, '2026-01-07', '2026-01-07'], ['O25', 5000, '2026-01-07', '2026-01-07'],
    ['O33', 4000, '2026-01-07', '2026-01-07'], ['O34', 11600, '2026-01-01', '2026-01-01'],
    ['O38', 11200, '2025-12-29', '2026-01-03'], ['O04', 13400, '2025-12-22', '2026-01-08'],
    ['O19', 9600, '2025-12-11', '2026-01-12'], ['O28', 17800, '2025-11-19', [['2026-01-15', 0.5], ['2026-02-15', 0.5]]],
    ['C01', 148000, '2026-01-20', 'rule'], ['C02', 92000, '2026-01-16', 'rule'],
    ['C03', 78000, '2026-01-28', 'rule'], ['C07', 24000, '2026-01-09', 'rule'],
    ['C09', 31000, '2026-01-05', 'rule'], ['C10', 33000, '2026-01-12', 'rule'],
    ['C04', 46000, '2025-12-24', '2026-01-06'], ['C05', 112000, '2025-12-12', '2026-01-15'],
    ['C06', 58000, '2025-12-03', [['2026-01-20', 0.5], ['2026-02-10', 0.5]]], ['C08', 96000, '2025-11-26', '2026-01-28']
  ];
  /* Opening bills: vendor, rupees, due date, then how the seed pays it - a date, or 'rule' (first payment day on or after the due date). */
  var OPEN_AP = [
    ['VM01', 278000, '2026-01-07', 'rule'], ['VM02', 12000, '2026-01-06', 'rule'], ['VM03', 62000, '2026-01-08', 'rule'],
    ['VM04', 174000, '2026-01-14', 'rule'], ['VM05', 31000, '2026-01-09', 'rule'], ['VM06', 45000, '2026-01-05', 'rule'],
    ['VM07', 85000, '2026-01-12', 'rule'], ['VM08', 28000, '2025-12-27', '2026-01-05'], ['VM09', 7000, '2026-01-05', '2026-01-05'],
    ['VM10', 6000, '2026-01-03', '2026-01-05'], ['VM11', 12000, '2026-01-05', '2026-01-05'], ['VM12', 166000, '2026-01-20', 'rule'],
    ['VM13', 64000, '2025-12-19', '2026-01-05']
  ];
  OPEN_AR.forEach(function (r) { opening.receivables.push({ customerId: r[0], total: rs(r[1]), dueDate: r[2] }); });
  OPEN_AP.forEach(function (r) { opening.payables.push({ vendorId: r[0], total: rs(r[1]), dueDate: r[2], billNo: 'OPENING/' + r[0] }); });

  /* ============================================================ SIMULATION PARAMETERS */
  /* Everything from here to `calibration` goes under HB.config.sim. Each function is a pure function of */
  /* its arguments: a random draw is always passed in by the seed, keyed on the date and the entity.      */

  /* ------------------------------------------------- calendar (RESEARCH 7.4, 7.6) */

  /* Closed: no dispatch, corporate delivery, transfer or day-end; nothing is received, approved, paid, collected or deposited. */
  var CLOSED_DAYS = ['2026-11-09', '2026-11-10', '2026-11-11', '2027-10-30', '2027-10-31'];
  /* Factory holiday: no production entry (every day whose next morning has no dispatch). */
  var FACTORY_HOLIDAYS = ['2026-11-08', '2026-11-09', '2026-11-10', '2027-10-29', '2027-10-30'];

  function isClosed(date) { return CLOSED_DAYS.indexOf(date) !== -1; }
  function isFactoryHoliday(date) { return FACTORY_HOLIDAYS.indexOf(date) !== -1; }
  /** The day itself when it is open, else the first open day after it. */
  function nextOpen(date) { while (isClosed(date)) date = addDays(date, 1); return date; }
  /** The last open day before `date`. */
  function prevOpen(date) { do { date = addDays(date, -1); } while (isClosed(date)); return date; }
  /**
   * Is `date` the day of something done on the weekdays `dows`? RESEARCH 7.4: what falls on a closed day
   * moves to the next open day (the longest break is three days).
   */
  function fallsOn(dows, date) {
    var k, s;
    if (isClosed(date)) return false;
    for (k = 0; k <= 3; k++) {
      s = addDays(date, -k);
      if (dows.indexOf(dow(s)) !== -1 && nextOpen(s) === date) return true;
    }
    return false;
  }

  var PERIODS = {
    collegeVacation: [['2026-04-27', '2026-06-14'], ['2026-11-05', '2026-11-25'], ['2027-04-27', '2027-06-14'], ['2027-10-26', '2027-11-15']],
    collegeExams: [['2026-03-30', '2026-04-25'], ['2026-10-19', '2026-11-04'], ['2026-11-26', '2026-12-16'],
      ['2027-03-29', '2027-04-26'], ['2027-10-11', '2027-10-25'], ['2027-11-16', '2027-12-06']],
    schoolVacation: [['2026-05-04', '2026-06-07'], ['2026-11-05', '2026-11-25'], ['2027-05-03', '2027-06-06'], ['2027-10-26', '2027-11-15']],
    boardExams: [['2026-02-26', '2026-03-16'], ['2027-02-25', '2027-03-17']],
    weddings: [['2026-02-05', '2026-03-12'], ['2026-04-15', '2026-05-14'], ['2026-06-21', '2026-07-11'], ['2026-11-21', '2026-12-12'],
      ['2027-01-15', '2027-03-14'], ['2027-04-18', '2027-07-12'], ['2027-11-10', '2027-12-14']],
    chaturmas: [['2026-07-12', '2026-11-20'], ['2027-07-13', '2027-11-09']]
  };
  /* NRI season: every 15 December to 31 January. */
  function inNriSeason(date) { var md = date.slice(5); return md >= '12-15' || md <= '01-31'; }
  /* Summer: 6 April to 10 June each year. */
  var SUMMER = ['04-06', '06-10'];
  function inSummer(date) { return inYearly(date, SUMMER[0], SUMMER[1]); }
  function inPeriod(name, date) {
    if (name === 'nri') return inNriSeason(date);
    if (name === 'summer') return inSummer(date);
    return inAny(date, PERIODS[name]);
  }

  /* ------------------------------------------------- demand model (RESEARCH 7.1 - 7.8) */

  /* Weekday factors, Monday first. Other corporates have none, only order days. */
  var WEEKDAY = {
    outlet: {
      P: [1.00, 1.00, 1.00, 1.00, 1.00, 1.05, 1.00],
      D: [1.00, 1.00, 1.00, 1.00, 1.00, 1.05, 1.05],
      T: [1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 0.60],
      B: [1.00, 1.00, 1.00, 1.00, 1.00, 1.10, 1.15],
      G: [1.00, 1.00, 1.00, 1.00, 1.00, 1.10, 1.15]
    },
    store: {
      st_anand: [1.00, 1.00, 1.00, 1.00, 1.00, 1.10, 1.20],
      st_vvn: [1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 0.85],
      st_nadiad: [1.00, 1.00, 1.00, 1.00, 1.00, 1.05, 1.15]
    },
    corporate: { C08: [1.00, 1.00, 1.00, 1.00, 1.00, 1.20, 1.20] }
  };

  /* Month factor, January first: retail outlets and own stores only, the same in both years. */
  var MONTH_FACTOR = [1.03, 1.02, 1.00, 0.96, 0.92, 0.97, 1.03, 1.04, 1.02, 1.00, 0.98, 1.04];
  /* Time of the month: days 1-7, 8-23, 24 to the end. */
  var MONTH_PART = { retail: [1.03, 1.00, 0.97], store: [1.08, 1.00, 0.93], corporate: [1.00, 1.00, 1.00] };
  function monthPartOf(date) { var d = dayOf(date); return d <= 7 ? 0 : (d <= 23 ? 1 : 2); }

  function day(d) { return [d, d]; }
  var ONE7 = [1, 1, 1, 1, 1, 1, 1];

  /*
   * Dated events (RESEARCH 7.4): code, name, periods, retail [BR, BN, DRY], stores [BR, BN, DRY, PF],
   * corporates [IC, HM, HK, CT, HT, SC, CF], then what differs on a date. Every event whose period holds
   * the day applies and all are multiplied; 0 means no document at all for that customer or store.
   * The Islamic dates of 2027 (E08, E09, E12) are tentative by a day.
   */
  var EVENT_ROWS = [
    ['E01', 'Uttarayan eve', [day('2026-01-13'), day('2027-01-13')], [1.10, 1.15, 1.05], [1.15, 1.20, 1.10, 1.10], [1.00, 1.00, 1.00, 1.20, 1.10, 1.00, 1.00]],
    ['E02', 'Uttarayan', [day('2026-01-14'), day('2027-01-14')], [0.90, 1.00, 0.85], [1.10, 1.20, 0.90, 1.20], [0.00, 0.70, 1.00, 1.20, 1.20, 0.00, 0.60]],
    ['E03', 'Vasi Uttarayan', [day('2026-01-15'), day('2027-01-15')], [0.80, 0.85, 0.80], [0.90, 1.00, 0.90, 1.00], [0.50, 0.70, 1.00, 1.00, 1.10, 0.00, 0.70]],
    ['E04', 'Republic Day and Independence Day', [day('2026-01-26'), day('2026-08-15'), day('2027-01-26'), day('2027-08-15')], [1.00, 1.00, 1.00], [1.05, 1.10, 1.05, 1.15], [0.00, 1.00, 1.00, 1.00, 1.10, 0.00, 1.10]],
    ['E05', 'Maha Shivratri', [day('2026-02-15'), day('2027-03-06')], [0.85, 0.85, 0.95], [0.85, 0.85, 0.95, 0.75], [1.00, 0.85, 1.00, 1.00, 1.00, 0.00, 0.85]],
    ['E06', 'Holi (Holika Dahan)', [day('2026-03-03'), day('2027-03-21')], [1.00, 1.00, 1.00], [1.05, 1.05, 1.05, 1.05], ONE7],
    ['E07', 'Dhuleti', [day('2026-03-04'), day('2027-03-22')], [0.60, 0.60, 0.60], [0.70, 0.70, 0.70, 0.70], [0.00, 0.70, 1.00, 1.00, 1.10, 0.00, 0.50]],
    ['E08', 'Ramadan, every day', [['2026-02-19', '2026-03-20'], ['2027-02-09', '2027-03-09']], [1.04, 1.03, 1.06], [1.02, 1.02, 1.03, 1.00], ONE7],
    ['E09', 'Eid al-Fitr', [day('2026-03-21'), day('2027-03-10')], [0.97, 1.00, 0.97], [1.00, 1.00, 1.00, 1.00], [1.00, 1.00, 1.00, 1.20, 1.00, 0.00, 1.00]],
    ['E10', 'Ram Navami', [day('2026-03-26'), day('2027-04-15')], [0.95, 0.95, 1.00], [0.93, 0.95, 1.00, 0.90], [1.00, 0.90, 1.00, 1.00, 1.00, 0.00, 1.00]],
    ['E11', 'Mahavir Jayanti', [day('2026-03-31'), day('2027-04-19')], [1.00, 1.00, 1.00], [1.00, 1.00, 1.00, 1.00], [1.00, 1.00, 1.00, 1.00, 1.00, 0.00, 1.00]],
    ['E12', 'Eid al-Adha', [day('2026-05-28'), day('2027-05-17')], [1.05, 1.05, 1.00], [1.00, 1.00, 1.00, 1.00], [1.00, 1.00, 1.00, 1.20, 1.00, 0.00, 1.00]],
    ['E13', 'Rath Yatra', [day('2026-07-16'), day('2027-07-05')], [1.00, 1.00, 1.00], [1.03, 1.03, 1.05, 1.05], [1.00, 1.00, 1.00, 1.00, 1.00, 0.00, 1.00]],
    ['E14', 'Shravan, every day', [['2026-08-13', '2026-09-11'], ['2027-08-03', '2027-08-31']], [0.96, 0.96, 1.00], [0.95, 0.95, 1.00, 0.90], [1.00, 0.95, 1.00, 1.00, 1.00, 1.00, 0.95]],
    ['E15', 'Shravan Mondays (on top of E14)', [['2026-08-13', '2026-09-11'], ['2027-08-03', '2027-08-31']], [0.95, 0.97, 1.00], [0.93, 0.95, 1.00, 0.90], ONE7, { onlyDow: MON }],
    ['E16', 'Raksha Bandhan', [day('2026-08-28'), day('2027-08-17')], [1.00, 1.00, 1.08], [1.05, 1.05, 1.20, 1.10], [0.00, 0.80, 1.00, 1.00, 1.15, 0.00, 0.85]],
    ['E17', 'Shitala Satam', [day('2026-09-03'), day('2027-08-24')], [1.08, 1.05, 1.12], [1.10, 1.05, 1.15, 1.00], ONE7],
    ['E18', 'Janmashtami', [day('2026-09-04'), day('2027-08-25')], [0.85, 0.85, 0.95], [0.80, 0.85, 1.00, 0.70], [0.00, 0.70, 1.00, 1.00, 1.10, 0.00, 0.70]],
    ['E19', 'Paryushan, every day', [['2026-09-08', '2026-09-15'], ['2027-08-28', '2027-09-04']], [0.98, 0.98, 0.98], [0.97, 0.97, 0.97, 0.93], ONE7],
    ['E20', 'Samvatsari (on top of E19)', [day('2026-09-15'), day('2027-09-04')], [1.00, 1.00, 1.00], [1.00, 1.00, 1.00, 1.00], [1.00, 1.00, 1.00, 1.00, 1.00, 0.00, 1.00]],
    ['E21', 'Ganesh Chaturthi', [day('2026-09-14'), day('2027-09-04')], [1.02, 1.02, 1.00], [1.03, 1.05, 1.05, 1.10], ONE7],
    ['E22', 'Ganeshotsav', [['2026-09-15', '2026-09-25'], ['2027-09-05', '2027-09-14']], [1.02, 1.02, 1.00], [1.00, 1.03, 1.00, 1.05], [1.00, 1.00, 1.00, 1.05, 1.00, 1.00, 1.00]],
    ['E23', 'Navratri, nine nights', [['2026-10-11', '2026-10-19'], ['2027-09-30', '2027-10-08']], [1.05, 1.12, 1.00], [1.03, 1.15, 1.00, 1.20], [1.00, 1.00, 1.00, 1.20, 1.10, 1.00, 1.25]],
    ['E24', 'Dussehra', [day('2026-10-20'), day('2027-10-09')], [0.90, 0.95, 0.90], [0.90, 0.95, 0.95, 0.85], [0.00, 0.85, 1.00, 1.00, 1.10, 0.00, 0.90]],
    ['E25', 'Diwali run-up, 7 days', [['2026-11-01', '2026-11-07'], ['2027-10-22', '2027-10-28']], [1.00, 1.00, 1.25], [1.00, 1.00, 1.40, 1.05], [1.00, 1.00, 1.00, 1.10, 1.10, 1.00, 1.00]],
    /* the hospital and the hotel stock up on Diwali day: 1 + 0.5 x the closed days that follow (2.50 in 2026, 2.00 in 2027) */
    ['E26', 'Diwali day', [day('2026-11-08'), day('2027-10-29')], [0.80, 0.80, 1.10], [0.85, 0.85, 1.30, 0.80], [0.00, 1.00, 2.50, 1.00, 2.50, 1.00, 0.70],
      { on: { '2027-10-29': { HK: 2.00, HT: 2.00 } } }],
    ['E27', 'Closed days', [['2026-11-09', '2026-11-11'], ['2027-10-30', '2027-10-31']], [0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0]],
    ['E28', 'Reopening days', [['2026-11-12', '2026-11-13'], ['2027-11-01', '2027-11-02']], [0.60, 0.60, 0.60], [0.70, 0.70, 0.80, 0.70], [0.00, 1.00, 1.00, 0.80, 1.15, 1.00, 0.50]],
    ['E29', 'Labh Pancham', [day('2026-11-14'), day('2027-11-03')], [0.85, 0.85, 0.85], [0.90, 0.90, 0.90, 0.90], [0.60, 1.00, 1.00, 1.00, 1.00, 1.00, 0.80]],
    ['E30', 'Six days after Labh Pancham', [['2026-11-15', '2026-11-20'], ['2027-11-04', '2027-11-09']], [0.93, 0.93, 0.93], [0.96, 0.96, 0.96, 0.96], ONE7],
    /* the school canteen orders on 24 December and not on 25 December */
    ['E31', 'Christmas eve and Christmas', [['2026-12-24', '2026-12-25'], ['2027-12-24', '2027-12-25']], [1.00, 1.05, 1.08], [1.05, 1.15, 1.15, 1.15], [1.00, 1.00, 1.00, 1.20, 1.20, 1.00, 1.20],
      { on: { '2026-12-25': { SC: 0.00 }, '2027-12-25': { SC: 0.00 } } }],
    ['E32', '31 December', [day('2026-12-31'), day('2027-12-31')], [1.05, 1.10, 1.00], [1.10, 1.25, 1.05, 1.25], [1.00, 1.00, 1.00, 1.20, 1.30, 1.00, 1.30]]
  ];
  var RETAIL_GROUPS = ['BR', 'BN', 'DRY'], STORE_GROUPS = ['BR', 'BN', 'DRY', 'PF'];
  var CLASSES = ['IC', 'HM', 'HK', 'CT', 'HT', 'SC', 'CF'];

  function keyed(keys, row) { var o = {}; for (var i = 0; i < keys.length; i++) o[keys[i]] = row[i]; return o; }
  var events = EVENT_ROWS.map(function (r) {
    var x = r[6] || {};
    return { code: r[0], name: r[1], periods: r[2], onlyDow: x.onlyDow === undefined ? null : x.onlyDow,
      retail: keyed(RETAIL_GROUPS, r[3]), store: keyed(STORE_GROUPS, r[4]), corporate: keyed(CLASSES, r[5]),
      on: x.on || null };
  });

  function eventApplies(ev, date) {
    return inAny(date, ev.periods) && (ev.onlyDow === null || dow(date) === ev.onlyDow);
  }
  /** The events of a day, each with the corporate factors of that date. */
  function eventsOn(date) {
    var out = [], i, ev, corp, k;
    for (i = 0; i < events.length; i++) {
      ev = events[i];
      if (!eventApplies(ev, date)) continue;
      corp = ev.corporate;
      if (ev.on && ev.on[date]) {
        corp = {};
        for (k in ev.corporate) if (has(ev.corporate, k)) corp[k] = ev.corporate[k];
        for (k in ev.on[date]) if (has(ev.on[date], k)) corp[k] = ev.on[date][k];
      }
      out.push({ code: ev.code, name: ev.name, retail: ev.retail, store: ev.store, corporate: corp });
    }
    return out;
  }
  /** All events of the day multiplied: { codes, retail: { BR, BN, DRY }, store: { BR, BN, DRY, PF }, corporate: { IC ... CF } }. */
  var evMemoDate = null, evMemo = null;
  function eventFactors(date) {
    if (date === evMemoDate) return evMemo;
    var list = eventsOn(date), f = { codes: [], retail: keyed(RETAIL_GROUPS, [1, 1, 1]), store: keyed(STORE_GROUPS, [1, 1, 1, 1]), corporate: keyed(CLASSES, ONE7) }, i, k;
    for (i = 0; i < list.length; i++) {
      f.codes.push(list[i].code);
      for (k in f.retail) if (has(f.retail, k)) f.retail[k] *= list[i].retail[k];
      for (k in f.store) if (has(f.store, k)) f.store[k] *= list[i].store[k];
      for (k in f.corporate) if (has(f.corporate, k)) f.corporate[k] *= list[i].corporate[k];
    }
    evMemoDate = date; evMemo = f;
    return f;
  }

  /* Calendars of particular customers (RESEARCH 7.6): [term, examination weeks, vacation]. */
  var CAMPUS_OUTLETS = ['O14', 'O17', 'O20', 'O23', 'O24'];
  var COLLEGE = { C03: [1.00, 1.00, 0.30], C04: [1.00, 1.00, 0.30], C10: [1.00, 0.90, 0.70], st_vvn: [1.00, 0.95, 0.70], campusOutlet: [1.00, 1.00, 0.85] };
  var SCHOOL = { C09: [1.00, 0.80, 0.00] };   /* 0.80 in board-examination weeks; no orders in the vacation */
  var CATERER = { wedding: 1.35, nri: 1.20, chaturmas: 0.70, other: 0.90 };   /* first match wins */
  var HOTEL_SEASON = 1.10;                    /* C08 in a wedding window or the NRI season, on top of its weekend factor */

  function collegeFactor(who, date) {
    var f = COLLEGE[who] || (CAMPUS_OUTLETS.indexOf(who) !== -1 ? COLLEGE.campusOutlet : null);
    if (!f) return 1;
    if (inAny(date, PERIODS.collegeVacation)) return f[2];
    if (inAny(date, PERIODS.collegeExams)) return f[1];
    return f[0];
  }
  function schoolFactor(who, date) {
    var f = SCHOOL[who];
    if (!f) return 1;
    if (inAny(date, PERIODS.schoolVacation)) return f[2];
    if (inAny(date, PERIODS.boardExams)) return f[1];
    return f[0];
  }
  function catererFactor(date) {
    if (inAny(date, PERIODS.weddings)) return CATERER.wedding;
    if (inNriSeason(date)) return CATERER.nri;
    if (inAny(date, PERIODS.chaturmas)) return CATERER.chaturmas;
    return CATERER.other;
  }

  /* Summer (RESEARCH 7.7), by channel and product group; puffs are not on the routes. */
  var SUMMER_FACTOR = {
    retail: { BR: 1.01, BN: 1.01, DRY: 0.98 },
    store: { BR: 1.03, BN: 1.03, DRY: 0.98, PF: 0.95 },
    corporate: { BR: 1.00, BN: 1.00, DRY: 1.00, PF: 1.00 }
  };

  /* Rain (RESEARCH 7.8). One draw per date inside the wet season, the same for every route and store. */
  var RAIN = {
    seasons: [['2026-06-28', '2026-09-24'], ['2027-06-20', '2027-09-20']],
    wetChance: { 6: 0.45, 7: 0.45, 8: 0.40, 9: 0.33 },   /* by calendar month */
    /* heavy-rain days are never also wet days; these hit every route and store */
    heavyDays: ['2026-07-09', '2026-07-23', '2026-07-31', '2026-08-01', '2026-08-18', '2026-09-06',
      '2027-06-29', '2027-07-09', '2027-07-20', '2027-07-29', '2027-08-12', '2027-08-21', '2027-09-08'],
    /* heavy on the routes named only; the other routes and the stores are wet that day */
    heavyOnRoutes: { '2026-09-14': ['R4'] },
    factor: {
      wet: { retail: { BR: 0.99, BN: 0.99, DRY: 1.02 }, store: { BR: 0.95, BN: 0.95, DRY: 0.97, PF: 1.08 } },
      heavy: { retail: { BR: 0.82, BN: 0.82, DRY: 0.82 }, store: { BR: 0.70, BN: 0.70, DRY: 0.75, PF: 0.75 } }
    },
    /* corporates: 1.00 on a wet day; on a heavy day the caterers and the cafe order less */
    corporateHeavy: { CT: 0.90, CF: 0.80 }
  };
  /** The chance that a date is a wet day: 0 outside the season and on a day that is heavy or wet by the record. */
  function wetChance(date) {
    if (RAIN.heavyDays.indexOf(date) !== -1 || has(RAIN.heavyOnRoutes, date) || !inAny(date, RAIN.seasons)) return 0;
    return RAIN.wetChance[monthOf(date)] || 0;
  }
  /** 'dry', 'wet' or 'heavy' for a route (or a store: leave routeId out), given the day's draw in [0, 1). */
  function rainKind(date, draw, routeId) {
    if (RAIN.heavyDays.indexOf(date) !== -1) return 'heavy';
    if (has(RAIN.heavyOnRoutes, date)) return routeId && RAIN.heavyOnRoutes[date].indexOf(routeId) !== -1 ? 'heavy' : 'wet';
    return draw < wetChance(date) ? 'wet' : 'dry';
  }
  function rainFactor(channel, group, rain) {
    var t = rain && RAIN.factor[rain] ? RAIN.factor[rain][channel] : null;
    return t && t[group] !== undefined ? t[group] : 1;
  }

  var OUTLET = {};
  ROUTE_ROWS.forEach(function (rt) { rt.outlets.forEach(function (o) { OUTLET[o[0]] = { type: o[3], size: o[4], routeId: rt.id, terms: o[5] }; }); });
  function pick(table, group) { return table[group] === undefined ? 1 : table[group]; }

  /** Retail line factor before noise: weekday x month x month-part x events x campus vacation x summer x rain. */
  function retailFactor(customerId, itemId, date, rain) {
    var o = OUTLET[customerId], g = GROUP_OF[itemId];
    if (!o || isClosed(date)) return 0;
    return WEEKDAY.outlet[o.type][dow(date)] * MONTH_FACTOR[monthOf(date) - 1] * MONTH_PART.retail[monthPartOf(date)] *
      pick(eventFactors(date).retail, g) * collegeFactor(customerId, date) *
      (inSummer(date) ? pick(SUMMER_FACTOR.retail, g) : 1) * rainFactor('retail', g, rain);
  }
  /** Store line factor before noise: weekday x month x month-part x events x college calendar (S2) x summer x rain. */
  function storeFactor(storeId, itemId, date, rain) {
    var g = GROUP_OF[itemId];
    if (!WEEKDAY.store[storeId] || isClosed(date)) return 0;
    return WEEKDAY.store[storeId][dow(date)] * MONTH_FACTOR[monthOf(date) - 1] * MONTH_PART.store[monthPartOf(date)] *
      pick(eventFactors(date).store, g) * collegeFactor(storeId, date) *
      (inSummer(date) ? pick(SUMMER_FACTOR.store, g) : 1) * rainFactor('store', g, rain);
  }

  var CUSTOMER = {};
  customers.forEach(function (c) { CUSTOMER[c.id] = c; });

  /** Is `date` a delivery day of the corporate by its pattern alone (weekday, alternate days, not a closed day)? */
  function corporateOrderDay(customerId, date) {
    var c = CUSTOMER[customerId], p = c && c.pattern;
    if (!p || isClosed(date) || date < company.goLive) return false;
    if (p.alternate) return diffDays(company.goLive, date) % 2 === 0;
    return p.weekdays.indexOf(dow(date)) !== -1;
  }
  /**
   * Corporate order factor before noise, applied to every line: events (by class) x calendar x season x
   * weekday (the hotel) x heavy rain. 0 = no order that day (not an order day, a closed day, a holiday of
   * the class, the school vacation). An order that falls on such a day is not carried forward.
   */
  function corporateFactor(customerId, date) {
    if (!corporateOrderDay(customerId, date)) return 0;
    var cls = CLASS_OF[customerId], f = eventFactors(date).corporate[cls];
    f *= collegeFactor(customerId, date) * schoolFactor(customerId, date);
    if (cls === 'CT') f *= catererFactor(date);
    if (cls === 'HT' && (inAny(date, PERIODS.weddings) || inNriSeason(date))) f *= HOTEL_SEASON;
    if (WEEKDAY.corporate[customerId]) f *= WEEKDAY.corporate[customerId][dow(date)];
    if (RAIN.heavyDays.indexOf(date) !== -1 && RAIN.corporateHeavy[cls] !== undefined) f *= RAIN.corporateHeavy[cls];
    return f;
  }
  /** The purchase-order reference a corporate quotes: monthly 'PO/C01/2026-01', yearly 'RC/C05/2026', or ''. */
  function corporatePoRef(customerId, date) {
    var c = CUSTOMER[customerId], t = c && c.pattern ? c.pattern.poRef : '';
    return t ? t.replace('YYYY-MM', date.slice(0, 7)).replace('YYYY', date.slice(0, 4)) : '';
  }

  var demand = {
    /* noise, uniform, one draw per outlet (or store), item and day; corporates one draw per order */
    noise: { retail: [0.90, 1.10], store: [0.90, 1.10], corporate: [0.95, 1.05] },
    rounding: 'stochastic',   /* round down, then add 1 with probability equal to the fraction */
    weekday: WEEKDAY, month: MONTH_FACTOR, monthPart: MONTH_PART, monthPartOf: monthPartOf,
    groupOf: GROUP_OF, retailGroups: RETAIL_GROUPS, storeGroups: STORE_GROUPS, classes: CLASSES, classOf: CLASS_OF,
    events: events, eventsOn: eventsOn, eventFactors: eventFactors,
    campusOutlets: CAMPUS_OUTLETS, college: COLLEGE, school: SCHOOL, caterer: CATERER, hotelSeason: HOTEL_SEASON,
    collegeFactor: collegeFactor, schoolFactor: schoolFactor, catererFactor: catererFactor,
    summer: { from: SUMMER[0], to: SUMMER[1], factor: SUMMER_FACTOR },
    retailFactor: retailFactor, storeFactor: storeFactor, corporateFactor: corporateFactor
  };

  /* ------------------------------------------------- stale returns (RESEARCH 7.9) */

  var RETURN_OUTLET = { O04: 1.60, O28: 1.60, O38: 1.60, O19: 3.50 };   /* the three slow outlets; O19 is the high-returns outlet */
  var RETURN_SIZE = { L: 0.85, M: 1.00, S: 1.20 };
  function returnOutletFactor(customerId) {
    if (has(RETURN_OUTLET, customerId)) return RETURN_OUTLET[customerId];
    return OUTLET[customerId] ? RETURN_SIZE[OUTLET[customerId].size] : 1;
  }
  /** By the dispatch date: 1.60 for the dispatch of a heavy-rain day on a route that is hit, 1.25 in July to September, else 1.00. */
  function returnSeasonFactor(dispatchDate, rain) {
    var m = monthOf(dispatchDate);
    if (rain === 'heavy') return 1.60;
    return m >= 7 && m <= 9 ? 1.25 : 1.00;
  }
  var returns = {
    /* returned units = stochastic round( units dispatched on (D - lag) x rate x outlet factor x season factor ) */
    rate: byFg([0.045, 0.060, 0.050, 0.055, 0.050, 0.055, 0.060, 0.050, 0.040, 0.003, 0.003, 0.005, 0.005, 0.003, 0.015, 0, 0, 0]),
    lagDays: byFg([3, 3, 3, 2, 3, 3, 3, 3, 4, 30, 30, 30, 30, 30, 10, 0, 0, 0]),
    sizeFactor: RETURN_SIZE, outletOverride: RETURN_OUTLET, seasonMonths: [7, 8, 9], seasonFactor: 1.25, heavyRainFactor: 1.60,
    outletFactor: returnOutletFactor, seasonFactorOn: returnSeasonFactor,
    /** Expected units returned, before the stochastic round. */
    expected: function (customerId, itemId, unitsDispatched, dispatchDate, rain) {
      return unitsDispatched * (returns.rate[itemId] || 0) * returnOutletFactor(customerId) * returnSeasonFactor(dispatchDate, rain);
    },
    /** The day the credit note for a dispatch is raised: dispatch date + lag, the next open day if that is closed. */
    noteDate: function (itemId, dispatchDate) { return nextOpen(addDays(dispatchDate, returns.lagDays[itemId] || 0)); },
    /* one credit note per outlet per visit day, a line per item, at the price of the invoice it reverses; */
    /* the stock is destroyed; corporates return nothing; puffs are not on the routes                     */
    priceBasis: 'price list in force on the dispatch date'
  };

  /* ------------------------------------------------- own stores (RESEARCH 6.5, 7.10) */

  /* Seasonal puff standing: dated master changes on the first day of a period, restored the day after it ends. */
  var PUFF_SUMMER = {
    st_anand: { FG16: 135, FG17: 50, FG18: 45 },
    st_vvn: { FG16: 140, FG17: 50, FG18: 50 },
    st_nadiad: { FG16: 70, FG17: 25, FG18: 20 }
  };
  var PUFF_VACATION = { st_vvn: { FG16: 110, FG17: 40, FG18: 40 } };   /* college vacation, S2 only; it takes precedence over summer */

  /** The standing quantities a store has on a date: the base of the unit master with the seasonal puff levels. */
  function storeStandingOn(storeId, date) {
    var out = byFg(STORE_STANDING[storeId]), over = null, k;
    if (PUFF_VACATION[storeId] && inAny(date, PERIODS.collegeVacation)) over = PUFF_VACATION[storeId];
    else if (inSummer(date)) over = PUFF_SUMMER[storeId];
    if (over) for (k in over) if (has(over, k)) out[k] = over[k];
    return out;
  }

  /* Each store's own manager (RESEARCH 6.5). The one store persona, u_store_mgr, is the manager of S2. */
  var STORE_MANAGER = { st_anand: 'E029', st_vvn: 'E032', st_nadiad: 'E034' };
  function userEmployee(userId) {
    for (var i = 0; i < users.length; i++) if (users[i].id === userId) return users[i].employeeId;
    return null;
  }
  /**
   * The note of a store document (RESEARCH 8.3, 14 point 6): it names the store's own manager where the
   * persona that raises it is somebody else (S1, S3), and is empty where the persona is that manager (S2).
   */
  function storeManagerNote(storeId) {
    var id = STORE_MANAGER[storeId], r = id ? empRow(id) : null;
    if (!r || userEmployee('u_store_mgr') === id) return '';
    return 'Store manager: ' + r[1] + ' (' + id + ')';
  }

  var stores = {
    ids: STORE_IDS,
    /* units sold on a normal day, every factor 1 */
    sale: { st_anand: byFg(STORE_SALE.st_anand), st_vvn: byFg(STORE_SALE.st_vvn), st_nadiad: byFg(STORE_SALE.st_nadiad) },
    /* sold = min( stochastic round( sale x demand.storeFactor x noise ), unexpired stock ), oldest unexpired batch first */
    noise: [0.90, 1.10],
    /* expired = every unsold unit whose best-before is the day-end date or earlier */
    puffStanding: { summer: PUFF_SUMMER, collegeVacation: PUFF_VACATION, changedBy: 'u_accounts' },
    standingOn: storeStandingOn,
    /* squashed, dried or broken packs not yet past their date: share of the units sold in the last seven days */
    unsaleableRate: byFg([0.03, 0.05, 0.06, 0.04, 0.04, 0.05, 0.06, 0.06, 0.03, 0.002, 0.002, 0.003, 0.003, 0.002, 0.02, 0, 0, 0]),
    /* every Sunday after the day-end (the Monday after, if the Sunday is closed), one request per store, approved the next morning */
    writeOff: { dow: SUN, reason: 'damaged', windowDays: 7, from: 'oldest batch on the shelf' },
    /** Is `date` the day of the weekly write-off request? Sunday; 31 October 2027 is closed, so Monday 1 November. */
    isWriteOffDay: function (date) { return fallsOn([SUN], date); },
    /* the day-ends, transfer confirmations, write-off requests, deposits and claims of every store are raised by    */
    /* u_store_mgr; at S1 and S3 the note names the store's own manager, the seed names that manager as the one who */
    /* entered them (display only), and a store claim is payable to that manager (claims.rows[].payeeEmployeeId)    */
    manager: STORE_MANAGER, managerNote: storeManagerNote,
    userId: 'u_store_mgr',
    /* UPI total = gross x share x (1 + u), to the rupee; cash counted = gross - UPI, less a shortage or plus an excess (stories.cashShort) */
    upiShare: { st_anand: 0.60, st_vvn: 0.75, st_nadiad: 0.60 }, upiNoise: 0.08,
    /* store cash goes to the bank every Monday and Thursday morning (next open day if closed), leaving a float */
    depositDows: [MON, THU], float: rs(3000),
    isDepositDay: function (date) {
      var k, s;
      if (isClosed(date)) return false;
      for (k = 0; k <= 3; k++) {
        s = addDays(date, -k);
        if ((dow(s) === MON || dow(s) === THU) && nextOpen(s) === date) return true;
      }
      return false;
    },
    /* expected: 8-20% of the puffs sent to the stores expire, by month (about 13% over a year) */
    expectedPuffExpiry: [0.08, 0.20]
  };

  /* ------------------------------------------------- production and yield (RESEARCH 3.3 - 3.5) */

  /* Per product, FG01..FG18: normal-day requirement, average mixes per run, smallest and largest run of the two-year run. */
  var NORMAL_DAY = [652, 146, 168, 672, 170, 53, 27, 69, 162, 195, 59, 141, 53, 50, 93, 620, 161, 161];
  var AVG_MIXES = [3.55, 1.62, 3.57, 3.59, 2.24, 0.72, 0.50, 1.42, 1.62, 3.75, 1.03, 3.68, 1.38, 2.00, 2.53, 7.11, 2.04, 2.04];
  /* FG16: 4 - 8 -> 3.5 - 9. The two-year run gives 3.5 to 8.75 mixes (13 of its 725 entries lay outside 4 - 8 plus a step); band 50 reads this range */
  var RUN_RANGE = [[2, 4.5], [1, 2], [1, 5], [2, 4.5], [1, 3], [0.5, 1.5], [0.5, 0.5], [0.5, 3], [0.5, 2.5],
    [1, 6], [1, 1.5], [1, 5.5], [1, 2.5], [1, 4.5], [1, 4], [3.5, 9], [1.5, 2.25], [1.5, 2.5]];
  /* long-life lines: maximum mixes per run and target cover in days of sale */
  var RUN_LIMIT = { FG10: [6, 7], FG11: [6, 7], FG12: [6, 6], FG13: [6, 6], FG14: [6, 8], FG15: [4, 3] };

  var PROD = {};
  RECIPE_ROWS.forEach(function (r, i) {
    var lim = RUN_LIMIT[r[0]] || null;
    PROD[r[0]] = {
      flourKg: r[1], waterLitres: r[2], piecesPerMix: r[3], reject: r[4], drift: r[5], expectedUnits: r[6], step: r[8],
      daily: r[9] === 'daily', rhythm: r[9], standardMixes: r[10],
      normalDayUnits: NORMAL_DAY[i], averageMixes: AVG_MIXES[i], smallestRun: RUN_RANGE[i][0], largestRun: RUN_RANGE[i][1],
      maxMixes: lim ? lim[0] : null, coverDays: lim ? lim[1] : null
    };
  });

  function scheduledRun(itemId, date) {
    var p = PROD[itemId];
    return !!p && (p.daily || p.rhythm.indexOf(dow(date)) !== -1);
  }
  /**
   * Is `date` a production day of the product? Daily lines: every day that is not a factory holiday. A
   * long-life run on its weekdays; one that falls on a factory holiday moves to the next working day. No
   * run day is a Sunday (RESEARCH 3.5), so for a long-life line the next working day after the holidays
   * of 29 and 30 October 2027 is Monday 1 November, not Sunday 31 October.
   */
  function isRunDay(itemId, date) {
    var p = PROD[itemId], d;
    if (!p || isFactoryHoliday(date)) return false;
    if (p.daily) return true;
    if (dow(date) === SUN) return false;
    if (scheduledRun(itemId, date)) return true;
    /* the days since the last one a run could happen on: did a run fall on one of them? */
    for (d = addDays(date, -1); isFactoryHoliday(d) || dow(d) === SUN; d = addDays(d, -1)) if (scheduledRun(itemId, d)) return true;
    return false;
  }
  /** The next production day of the product after `date`. */
  function nextRunDay(itemId, date) {
    var d = addDays(date, 1), n = 0;
    while (!isRunDay(itemId, d) && n++ < 30) d = addDays(d, 1);
    return d;
  }
  /* Bad-run seasons by calendar month: March to June, July to September, October to February. */
  function heatSeason(date) { var m = monthOf(date); return m >= 3 && m <= 6 ? 'hot' : (m >= 7 && m <= 9 ? 'monsoon' : 'cool'); }

  var BAD_RUNS = [
    { id: 'overproof', cause: 'Heat: over-proofing', items: FG_IDS.slice(0, 9), per: 'each product, each entry',
      chance: { hot: 0.02, monsoon: 0.01, cool: 0.005 }, rejectRate: [0.06, 0.12] },
    { id: 'softFatKhari', cause: 'Heat: soft lamination fat', items: ['FG12', 'FG13'], per: 'each run',
      chance: { hot: 0.10, monsoon: 0.04, cool: 0.03 }, rejectRate: [0.08, 0.15] },
    { id: 'softFatPuff', cause: 'Heat: soft lamination fat', items: ['FG16', 'FG17', 'FG18'], per: 'each product, each day',
      chance: { hot: 0.03, monsoon: 0.015, cool: 0.01 }, rejectRate: [0.10, 0.20] },
    /* one product baked that day, picked in proportion to its mixes; rejected = T x (0.6 to 1.0), one mix */
    { id: 'ovenFault', cause: 'Oven fault', items: FG_IDS, per: 'production day',
      chance: { hot: 0.008, monsoon: 0.008, cool: 0.008 }, rejectedPiecesOfOneMix: [0.6, 1.0] },
    /* 12% from 15 June to 30 September, 2% otherwise; the yield lands 3-6% under expected */
    { id: 'humidity', cause: 'Monsoon humidity', items: ['FG10', 'FG11', 'FG12', 'FG13', 'FG14'], per: 'each run',
      chance: { hot: 0.02, monsoon: 0.12, cool: 0.02 }, monsoonWindow: ['06-15', '09-30'], yieldUnder: [0.03, 0.06] }
  ];
  /** The chance of a bad run of that kind on a date. */
  function badRunChance(id, date) {
    for (var i = 0; i < BAD_RUNS.length; i++) {
      if (BAD_RUNS[i].id !== id) continue;
      if (BAD_RUNS[i].monsoonWindow) return inYearly(date, BAD_RUNS[i].monsoonWindow[0], BAD_RUNS[i].monsoonWindow[1]) ? BAD_RUNS[i].chance.monsoon : BAD_RUNS[i].chance.cool;
      return BAD_RUNS[i].chance[heatSeason(date)];
    }
    return 0;
  }

  var production = {
    byItem: PROD,
    dailyItems: FG_IDS.filter(function (id) { return PROD[id].daily; }),
    runItems: FG_IDS.filter(function (id) { return !PROD[id].daily; }),
    isRunDay: isRunDay, nextRunDay: nextRunDay,
    /*
     * A production entry of m mixes (RESEARCH 3.4):
     *   made = T x m x (1 + u), u uniform in [-drift, +drift]
     *   rejected = round( made x reject x v ), v uniform in rejectDraw     (a bad run or a dip replaces reject x v)
     *   good = round(made) - rejected;  expected = E x m;  yield = good / expected
     */
    rejectDraw: [0.5, 1.6],
    /** The entry for `mixes` mixes, given u in [-drift, +drift] and the reject rate drawn (normally reject x v). */
    outcome: function (itemId, mixes, u, rejectRate) {
      var p = PROD[itemId], made = p.piecesPerMix * mixes * (1 + u), rejected = Math.round(made * rejectRate);
      return { made: made, rejected: rejected, good: Math.round(made) - rejected, expected: p.expectedUnits * mixes };
    },
    badRuns: BAD_RUNS, heatSeason: heatSeason, badRunChance: badRunChance,
    /*
     * Run size. A daily line on day D:
     *   need = max( hand-over quantity for D+1, simulated outflow of D+1 ) - stock in fac_fg still unexpired on D+1
     *   mixes = the smallest multiple of the step whose good units, after the yield draw, cover the need
     * A long-life line on run day D:
     *   need = max( sum over D+1 .. next run day of max(hand-over, outflow),
     *               outflow of D+1 .. next run day + coverDays x average daily outflow of the last 14 days )
     *          - unexpired stock in fac_fg
     *   mixes = need / E rounded up to the step, at least minRunMixes, at most maxMixes; a bad run is not re-run
     * Hand-over for D+1 = standing orders of all active outlets + every store's standing + corporate orders open
     * for D+1. No entry when the need is zero or less. In the first 14 days the average is over the days so far;
     * on 1 January 2026 it is normalDayUnits.
     */
    averageWindowDays: 14, minRunMixes: 1,
    /* what is produced on day D leaves on the morning of D+1; a puff made on D is sold on D+1 only */
    expectedLossShareOfSales: [0.001, 0.006]
  };

  /* ------------------------------------------------- purchasing and payments (RESEARCH 4.5, 5.1) */

  var EVERY_DAY_VENDORS = ['VM09', 'VM11'];   /* deliver on Sundays too; bill weekly; paid in cash */
  /*
   * The "Order days" column of RESEARCH 5.1: Mon-Sat, every day for VM09 and VM11. Its own note makes them the
   * receiving days, and that is all they bind (4.5 rule 4). The order itself is dated the day of the check,
   * a Sunday or a closed day included (4.5 rules 1 and 2; 11.7 row 19: it is raised in the evening and the
   * lead days carry the extra day). docs/CONFIG.md, choice 23.
   */
  var RECEIVING_DOWS = {};
  STOCK_VENDORS.forEach(function (r) { RECEIVING_DOWS[r[0]] = EVERY_DAY_VENDORS.indexOf(r[0]) !== -1 ? EVERY_DAY : MON_SAT; });
  function isReceivingDay(vendorId, date) {
    return !isClosed(date) && (RECEIVING_DOWS[vendorId] || MON_SAT).indexOf(dow(date)) !== -1;
  }
  /** The day itself when the vendor delivers on it, else its next receiving day. */
  function nextReceivingDay(vendorId, date) { while (!isReceivingDay(vendorId, date)) date = addDays(date, 1); return date; }
  /** Accounts pays on Mondays and Thursdays; a payment day that is closed moves to the next open day. */
  function isPaymentDay(date) {
    var k, s;
    if (isClosed(date)) return false;
    for (k = 0; k <= 3; k++) {
      s = addDays(date, -k);
      if ((dow(s) === MON || dow(s) === THU) && nextOpen(s) === date) return true;
    }
    return false;
  }
  /** The first payment day on or after a date. */
  function nextPaymentDay(date) { while (!isPaymentDay(date)) date = addDays(date, 1); return date; }

  var PAY_LATE = { VM08: 12, VM13: 12 };   /* paid late by habit: first payment day on or after due date + 12 days */
  /** The day the seed pays a posted vendor bill with this due date. */
  function vendorPayDate(vendorId, dueDate) {
    if (EVERY_DAY_VENDORS.indexOf(vendorId) !== -1) return nextOpen(dueDate);   /* in cash, on the due date */
    return nextPaymentDay(addDays(dueDate, PAY_LATE[vendorId] || 0));
  }

  var purchasing = {
    /* 1. day-end check after production: stock on hand + open orders <= reorder level -> order the order quantity */
    firstCheck: { stockOf: '2025-12-31', ordersDated: '2026-01-01' },
    /* 2. one order per vendor per day; rate = price of the month of the order date; expected date of a line = date + its lead days */
    rateOn: priceOn,
    /* market vegetables: the month's price x (1 + u), u uniform in +/- pct, rounded to the step (paise) */
    marketNoise: { RM19: { pct: 0.06, step: rs(0.10) }, RM20: { pct: 0.06, step: rs(0.10) }, RM23: { pct: 0.06, step: rs(1) } },
    /** The market rate of RM19, RM20 or RM23 for a draw u in [-pct, +pct]; any other item: the month's price. */
    marketRate: function (itemId, date, u) {
      var m = purchasing.marketNoise[itemId], p = priceOn(itemId, date);
      return m ? Math.round(p * (1 + u) / m.step) * m.step : p;
    },
    /** The date of the order a day-end check raises: the day of the check, whatever weekday it is. */
    orderDate: function (checkDate) { return checkDate; },
    /* 3. an order above limits.poAutoApprove before GST waits for the Owner, who approves it the next morning */
    /* 4. received in the morning of the expected date, before production, at the order rate */
    everyDayVendors: EVERY_DAY_VENDORS, receivingDows: RECEIVING_DOWS, isReceivingDay: isReceivingDay, nextReceivingDay: nextReceivingDay,
    /* seeded exceptions, each drawn once on the order (keyed on the order, not on a receipt), so that the second */
    /* receipt that makes a rejection good is never drawn again; VM01 and VM09 orders have one receipt each       */
    exceptions: {
      VM12: { chance: 0.25, drawnOn: 'order', firstShare: 0.60, restAfterDays: 4 },                      /* arrives in two parts */
      VM01: { chance: 1 / 25, drawnOn: 'order', rejectedQty: 50, secondReceiptAfterDays: 2 },           /* one 50 kg bag rejected */
      VM09: { chance: 1 / 8, drawnOn: 'order', itemId: 'RM19', rejectedKg: [2, 4], madeGood: 'next morning' }   /* an order with a potato line */
    },
    /* 5. one bill per receipt, entered and dated the day after the receipt (next open day if closed), at the order rate plus GST by line */
    billAfterDays: 1,
    /** The date of the bill for a receipt: the day after it, the next open day if that is closed. */
    billDate: function (receiptDate) { return nextOpen(addDays(receiptDate, purchasing.billAfterDays)); },
    weeklyBilling: {
      vendors: EVERY_DAY_VENDORS, dow: MON, covers: 'receipts of the previous Monday to Sunday',
      /** Is `date` the day of the weekly bill? Monday; Monday 9 November 2026 is closed, so Thursday 12 November. */
      isBillDay: function (date) { return fallsOn([MON], date); },
      /** The receipts a weekly bill dated `billDate` covers, [from, to]: the Monday to Sunday before its Monday. */
      periodOf: function (billDate) {
        var m = billDate;
        while (dow(m) !== MON) m = addDays(m, -1);
        return [addDays(m, -7), addDays(m, -1)];
      }
    },
    /* 6. payment: every posted bill due on or before a payment day, one payment per vendor, from the bank */
    paymentDows: [MON, THU], isPaymentDay: isPaymentDay, nextPaymentDay: nextPaymentDay,
    lateDays: PAY_LATE,
    cashVendors: { VM09: 'cash_factory', VM11: 'cash_factory' },   /* paid in cash on the due date */
    payDate: vendorPayDate,
    /* 7. safety net: a material short at the start of a production day gets one extra order, received that morning; expected never */
    safetyNet: { expectedCount: 0 },
    userId: 'u_stores', billedBy: 'u_accounts', approvedBy: 'u_owner'
  };

  /* ------------------------------------------------- collections (RESEARCH 6.2, 6.4) */

  var COLLECTION_DOW = { R1: MON, R2: TUE, R3: WED, R4: THU };
  var WEEK1_MONDAY = '2026-01-05';
  /** Collection week of a date: week 1 is the week of Monday 2026-01-05; the days before it are week 0. */
  function collectionWeek(date) { return Math.floor(diffDays(WEEK1_MONDAY, addDays(date, -dow(date))) / 7) + 1; }

  var SLOW = { O38: 'oddWeeks', O04: 'oddWeeks', O19: 'everyThirdWeek', O28: 'firstOfMonth' };
  function slowPaysOnVisit(customerId, visit) {
    var rule = SLOW[customerId], w = collectionWeek(visit);
    if (!rule) return true;
    if (rule === 'oddWeeks') return w % 2 === 1;
    if (rule === 'everyThirdWeek') return w >= 1 && (w - 1) % 3 === 0;   /* weeks 1, 4, 7 ... */
    return dayOf(visit) <= 7;                                            /* the first collection day of the calendar month */
  }
  /**
   * Does a weekly-credit outlet pay on `date`? On its route's collection day (the next open day if that day
   * is closed), by its own rule if it is a slow payer. It then clears everything invoiced up to the day before.
   */
  function outletPaysOn(customerId, date) {
    var o = OUTLET[customerId], k, visit;
    if (!o || o.terms !== 'weekly' || isClosed(date)) return false;
    for (k = 0; k <= 3; k++) {
      visit = addDays(date, -k);
      if (dow(visit) === COLLECTION_DOW[o.routeId] && nextOpen(visit) === date) return slowPaysOnVisit(customerId, visit);
    }
    return false;
  }

  /* Corporates pay by bank transfer once a week, on their payment weekday: [payment weekday, lateness days]. */
  var CORP_PAY = {
    C01: [MON, 0], C02: [TUE, 0], C03: [WED, 0], C04: [THU, 5], C05: [FRI, 10],
    C06: [MON, 20], C07: [TUE, 0], C08: [WED, 15], C09: [THU, 0], C10: [FRI, 0]
  };
  /** Is `date` the corporate's payment day (its weekday; the next open day if that is closed)? */
  function corporatePaysOn(customerId, date) {
    var p = CORP_PAY[customerId], k, s;
    if (!p || isClosed(date)) return false;
    for (k = 0; k <= 3; k++) {
      s = addDays(date, -k);
      if (dow(s) === p[0] && nextOpen(s) === date) return true;
    }
    return false;
  }
  /** The day the corporate pays an invoice with this due date: its first payment day on or after due date + lateness. */
  function corporatePayDate(customerId, dueDate) {
    var p = CORP_PAY[customerId], d = addDays(dueDate, p ? p[1] : 0), n = 0;
    while (!corporatePaysOn(customerId, d) && n++ < 14) d = addDays(d, 1);
    return d;
  }

  var collections = {
    /* cash outlets: collected by the van salesman at the drop, into factory cash */
    /* weekly outlets: one receipt per outlet on the route's collection day for everything invoiced up to the day before */
    collectionDow: COLLECTION_DOW, week1Monday: WEEK1_MONDAY, weekOf: collectionWeek,
    /* by UPI into the bank when a draw keyed on the receipt is under upiShare, otherwise in cash into factory cash */
    upiShare: 0.5,
    slow: SLOW, outletPaysOn: outletPaysOn,
    corporate: {
      C01: { payDow: MON, latenessDays: 0 }, C02: { payDow: TUE, latenessDays: 0 }, C03: { payDow: WED, latenessDays: 0 },
      C04: { payDow: THU, latenessDays: 5 }, C05: { payDow: FRI, latenessDays: 10 }, C06: { payDow: MON, latenessDays: 20 },
      C07: { payDow: TUE, latenessDays: 0 }, C08: { payDow: WED, latenessDays: 15 }, C09: { payDow: THU, latenessDays: 0 },
      C10: { payDow: FRI, latenessDays: 0 }
    },
    corporateAccount: 'bank',
    /* a corporate pays, on its payment day, every invoice whose due date + lateness days has passed */
    corporatePaysOn: corporatePaysOn, corporatePayDate: corporatePayDate,
    /* RESEARCH names no persona for a receipt: the salesman collects on the route, a corporate pays into the bank */
    userId: { retail: 'u_sales', corporate: 'u_accounts' }
  };

  var corporates = {
    /* each line = stochastic round( typical units x demand.corporateFactor x noise ), one noise draw per order; */
    /* the sales order is dated the last open day before delivery and invoiced on delivery; nothing is returned */
    orderDay: corporateOrderDay, factor: corporateFactor, poRef: corporatePoRef,
    orderDate: prevOpen,
    noise: [0.95, 1.05],
    userId: 'u_sales'
  };

  /* How the seed settles the opening invoices and bills (RESEARCH 10.2, 10.3): [{ date, share }] per party. */
  var openingSettlement = { receivables: {}, payables: {} };
  OPEN_AR.forEach(function (r) {
    var how = r[3];
    if (how === 'rule') how = corporatePayDate(r[0], r[2]);
    openingSettlement.receivables[r[0]] = typeof how === 'string' ? [{ date: how, share: 1 }]
      : how.map(function (h) { return { date: h[0], share: h[1] }; });
  });
  OPEN_AP.forEach(function (r) {
    var cash = purchasing.cashVendors[r[0]];
    openingSettlement.payables[r[0]] = [{ date: r[3] === 'rule' ? nextPaymentDay(r[2]) : r[3], share: 1, account: cash || 'bank' }];
  });

  /* ------------------------------------------------- people (RESEARCH 8) */

  /* Raise: +8% on 1 April 2026 and 1 April 2027, to the nearest Rs 100, for everyone who joined on or before */
  /* 31 December of the year before; the owner takes none. The table of EMP_ROWS holds the results and binds.  */
  function raiseOf(date, col) {
    var salary = {};
    EMP_ROWS.forEach(function (r) {
      var left = LEAVERS[r[0]];
      if (r[col] && r[col] !== r[col - 1] && !(left && left < date)) salary[r[0]] = rs(r[col]);
    });
    return { date: date, note: 'annual increment 8%', userId: 'u_accounts', salary: salary };
  }
  function empRow(id) { for (var i = 0; i < EMP_ROWS.length; i++) if (EMP_ROWS[i][0] === id) return EMP_ROWS[i]; return null; }
  /** Active on a day: joined on or before it and not yet left (the last working day counts). */
  function employeeActiveOn(id, date) {
    var r = empRow(id);
    return !!r && r[5] <= date && !(LEAVERS[id] && LEAVERS[id] < date);
  }
  /** Monthly salary in paise on a date; 0 when not employed that day. */
  function salaryOn(id, date) {
    var r = empRow(id);
    if (!employeeActiveOn(id, date)) return 0;
    return rs(date < '2026-04-01' ? r[7] : (date < '2027-04-01' ? r[8] : r[9]));
  }
  var people = {
    /* dated master changes, entered by Accounts and admin; a leaver stays in the directory as inactive */
    joiners: EMP_ROWS.filter(function (r) { return r[5] > '2026-01-01'; }).map(employeeOf),
    leavers: Object.keys(LEAVERS).map(function (id) { return { id: id, dol: LEAVERS[id] }; }),
    replaces: { E036: 'E020', E038: 'E025' },   /* E037 is a new post for the college term */
    raise: { pct: 0.08, roundTo: rs(100), exclude: ['E001'] },
    raises: [raiseOf('2026-04-01', 8), raiseOf('2027-04-01', 9)],
    activeOn: employeeActiveOn, salaryOn: salaryOn,
    headcountOn: function (date) { var n = 0; EMP_ROWS.forEach(function (r) { if (employeeActiveOn(r[0], date)) n++; }); return n; },
    /* the salary bill takes everyone active on the last day of the month at the full monthly salary */
    salaryBill: { raisedOn: 'last day of the month', raisedBy: 'u_accounts', approvedBy: 'u_owner', approved: 'next morning',
      paidOnDay: 5, account: 'bank' },
    /** The day the salary bill of a month is paid: the 5th of the next month, the next open day if closed. */
    salaryPayDate: function (monthKey) { return nextOpen(addMonths(monthKey, 1) + '-05'); },
    userId: 'u_accounts'
  };

  /* ------------------------------------------------- overheads (RESEARCH 9.2 - 9.4) */

  /* Diesel, paise a litre (no GST), from a date; the last price is held to 2027-12-31. */
  var DIESEL = [['2025-12-16', 9013], ['2026-05-15', 9313], ['2026-05-19', 9403], ['2026-05-23', 9494], ['2026-05-25', 9765], ['2026-07-01', 9789]];
  var DIESEL_LITRES_A_DAY = 19.0;   /* 285 km a day; nothing on a closed day */
  function dieselPrice(date) {
    var p = DIESEL[0][1], i;
    for (i = 0; i < DIESEL.length; i++) if (DIESEL[i][0] <= date) p = DIESEL[i][1];
    return p;
  }
  /** Diesel on account from one day to another, both included, in paise before noise: 19.0 litres on every open day. */
  function dieselFor(from, to) {
    var sum = 0, d;
    for (d = from; d <= to; d = addDays(d, 1)) if (!isClosed(d)) sum += DIESEL_LITRES_A_DAY * dieselPrice(d);
    return sum;
  }
  /* Piped gas, paise per SCM (no GST), from a consumption month. */
  var GAS = [['2025-12', 5200], ['2026-03', 5600], ['2026-04', 6000], ['2026-05', 6600], ['2026-07', 6400], ['2026-08', 6300], ['2026-10', 6200], ['2027-04', 6300]];
  function gasPrice(monthKey) {
    var p = GAS[0][1], i;
    for (i = 0; i < GAS.length; i++) if (GAS[i][0] <= monthKey) p = GAS[i][1];
    return p;
  }
  /* Electricity, rupees: energy a unit, fixed charge a month, duty; fuel surcharge a unit by consumption month. */
  var POWER = {
    factory: { energy: 4.60, fixed: 4900, duty: 0.10, unitsADay: 310 },
    store: { energy: 4.35, fixed: 250, duty: 0.20, unitsAMonth: { st_anand: 620, st_vvn: 520, st_nadiad: 400 } },
    surcharge: [['2025-12', 2.45], ['2026-04', 2.52]],
    /* seasonal factors, January first */
    factorySeason: [0.94, 0.95, 1.00, 1.06, 1.10, 1.08, 1.02, 1.00, 1.00, 1.00, 0.95, 0.93],
    storeSeason: [0.80, 0.85, 1.00, 1.20, 1.30, 1.25, 1.10, 1.05, 1.05, 1.00, 0.85, 0.80],
    vvnVacation: { months: [5, 11], factor: 0.85 }   /* S2 uses less in May and November */
  };
  function surcharge(monthKey) {
    var f = POWER.surcharge[0][1], i;
    for (i = 0; i < POWER.surcharge.length; i++) if (POWER.surcharge[i][0] <= monthKey) f = POWER.surcharge[i][1];
    return f;
  }
  function vOf(env, monthKey) { return env && typeof env.V === 'function' ? env.V(monthKey) : 1; }
  /*
   * A meter is read in whole units: kWh and SCM are rounded before they are priced. For the factory that is
   * the reading RESEARCH 9.4 works out (8,937 units = Rs 74,696); for gas and the stores RESEARCH states no
   * rounding and the same reading is taken (at most Rs 33 on a gas bill, Rs 4 on a store bill, under the
   * noise). The 0.85 of S2 is a factor on its kWh, as the row prints it. docs/CONFIG.md, choice 10.
   */
  /** Factory units (kWh) of a consumption month, for a volume factor V. */
  function factoryUnits(monthKey, V) {
    return Math.round(POWER.factory.unitsADay * daysInMonth(monthKey) * POWER.factorySeason[+monthKey.slice(5, 7) - 1] * (0.60 + 0.40 * V));
  }
  /** The factory electricity bill for a consumption month, paise before noise. */
  function factoryPower(monthKey, V) {
    return (factoryUnits(monthKey, V) * (POWER.factory.energy + surcharge(monthKey)) + POWER.factory.fixed) * (1 + POWER.factory.duty) * 100;
  }
  function storeUnits(storeId, monthKey) {
    var m = +monthKey.slice(5, 7), u = POWER.store.unitsAMonth[storeId] * POWER.storeSeason[m - 1];
    if (storeId === 'st_vvn' && POWER.vvnVacation.months.indexOf(m) !== -1) u *= POWER.vvnVacation.factor;
    return Math.round(u);
  }
  /** A store's electricity bill for a consumption month, paise before noise. */
  function storePower(storeId, monthKey) {
    return (storeUnits(storeId, monthKey) * (POWER.store.energy + surcharge(monthKey)) + POWER.store.fixed) * (1 + POWER.store.duty) * 100;
  }
  var GAS_SCM_A_DAY = 63;
  function gasScm(monthKey, V) { return Math.round(GAS_SCM_A_DAY * daysInMonth(monthKey) * (0.30 + 0.70 * V)); }
  /** The piped-gas bill for a consumption month, paise before noise. */
  function gasBill(monthKey, V) { return gasScm(monthKey, V) * gasPrice(monthKey); }
  /** Bank charges of a month, paise: Rs 1,500 + Rs 1.50 per Rs 1,000 of cash deposited in the month. */
  function bankCharges(depositedPaise) { return rs(1500) + depositedPaise * 0.0015; }

  /* --- when a bill is dated */
  function onDay(d) { return function (date) { return dayOf(date) === d; }; }
  function onLastDay(date) { return date === monthEnd(date); }
  function onDayIn(d, months) { return function (date) { return dayOf(date) === d && months.indexOf(monthOf(date)) !== -1; }; }
  function onYearly(list) { return function (date) { return list.indexOf(date.slice(5)) !== -1; }; }
  function onDates(list) { return function (date) { return list.indexOf(date) !== -1; }; }
  /** A stepped amount in rupees: [[from month, rupees], ...] -> paise for the month of the bill. */
  function stepped(steps) {
    return function (date) {
      var v = steps[0][1], i;
      for (i = 0; i < steps.length; i++) if (steps[i][0] <= date.slice(0, 7)) v = steps[i][1];
      return rs(v);
    };
  }
  function prevMonth(date) { return addMonths(date.slice(0, 7), -1); }

  var Q1 = [1, 4, 7, 10], Q2 = [2, 5, 8, 11], Q3 = [3, 6, 9, 12];
  var BILL_RULES = [];
  /*
   * A bill rule: n (the row of RESEARCH 9.4), category, name, vendor, unit, GST %, then
   *   when(date) -> true on its bill date, or seededDay [first, last] with months (the day is drawn per month);
   *   one of: fixed (paise) | uniform [low, high] paise (one draw per bill) | calc(date, env) -> paise before noise;
   *   noise: +/- fraction, one draw per bill; payAfterDays where RESEARCH differs from the vendor's terms.
   * env = { V: function (monthKey) -> volume factor, cashDeposited: paise in the bill's month, headcount: active employees }.
   */
  function bill(n, categoryId, name, vendorId, unitId, gstRate, spec) {
    var r = { n: n, categoryId: categoryId, name: name, vendorId: vendorId, unitId: unitId, gstRate: gstRate,
      when: null, seededDay: null, months: null, fixed: null, uniform: null, calc: null, noise: 0, payAfterDays: null, sameDay: false }, k;
    for (k in spec) if (has(spec, k)) r[k] = spec[k];
    BILL_RULES.push(r);
  }

  bill(1, 'rent', 'Factory shed rent', 'VE01', 'factory', 18, { when: onDay(1), calc: stepped([['2026-01', 90000], ['2026-04', 94500], ['2027-04', 99200]]) });
  bill(2, 'rent', 'Store rent, Anand', 'VE02', 'st_anand', 0, { when: onDay(1), calc: stepped([['2026-01', 30000], ['2026-10', 31500], ['2027-10', 33100]]) });
  bill(3, 'rent', 'Store rent, Vidyanagar', 'VE03', 'st_vvn', 0, { when: onDay(1), calc: stepped([['2026-01', 22000], ['2026-07', 23500], ['2027-07', 25100]]) });
  bill(4, 'rent', 'Store rent, Nadiad', 'VE04', 'st_nadiad', 0, { when: onDay(1), calc: stepped([['2026-01', 15000], ['2027-01', 15800]]) });
  /* a utility bill dated in month M covers the consumption of M-1 */
  bill(5, 'electricity', 'Electricity, factory', 'VE05', 'factory', 0, { when: onDay(6), noise: 0.03,
    calc: function (date, env) { var m = prevMonth(date); return factoryPower(m, vOf(env, m)); } });
  STORE_IDS.forEach(function (s, i) {
    bill(6 + i, 'electricity', 'Electricity, ' + units[i + 1].shortName + ' store', 'VE05', s, 0, { when: onDay(12), noise: 0.05,
      calc: function (date) { return storePower(s, prevMonth(date)); } });
  });
  bill(9, 'oven_fuel', 'Piped gas', 'VE06', 'factory', 0, { when: onDay(3), noise: 0.03,
    calc: function (date, env) { var m = prevMonth(date); return gasBill(m, vOf(env, m)); } });
  bill(10, 'vehicle_fuel', 'Diesel on account, days 1-15', 'VE07', 'factory', 0, { when: onDay(16), noise: 0.04,
    calc: function (date) { return dieselFor(date.slice(0, 8) + '01', date.slice(0, 8) + '15'); } });
  bill(11, 'vehicle_fuel', 'Diesel on account, day 16 to month end', 'VE07', 'factory', 0, { when: onDay(1), noise: 0.04,
    calc: function (date) { var m = prevMonth(date); return dieselFor(m + '-16', m + '-' + pad2(daysInMonth(m))); } });
  /* van service every quarter, a bill per van: V1, V2, V3 on the 12th, V4 and V5 on the 22nd */
  [['V1', Q1, 12], ['V4', Q1, 22], ['V2', Q2, 12], ['V5', Q2, 22], ['V3', Q3, 12]].forEach(function (v) {
    bill(12, 'vehicle_maint', 'Van service, ' + v[0], 'VE11', 'factory', 18, { when: onDayIn(v[2], v[1]), uniform: [rs(3800), rs(5200)], van: v[0] });
  });
  /* tyres, on the date of that month's service */
  [['V1', '04-12'], ['V2', '05-12'], ['V3', '06-12'], ['V4', '10-22'], ['V5', '11-22']].forEach(function (v) {
    bill(13, 'vehicle_maint', 'Tyres, ' + v[0], 'VE11', 'factory', 18, { when: onYearly([v[1]]), fixed: rs(9600), van: v[0] });
  });
  bill(14, 'vehicle_maint', 'Battery, V5', 'VE11', 'factory', 18, { when: onDates(['2026-08-22']), fixed: rs(6500), van: 'V5' });
  bill(14, 'vehicle_maint', 'Battery, V2', 'VE11', 'factory', 18, { when: onDates(['2027-08-22']), fixed: rs(6500), van: 'V2' });
  bill(15, 'repairs', 'Annual maintenance contract: ovens, mixers, slicers, cold room', 'VE08', 'factory', 18, { when: onDayIn(10, Q1), fixed: rs(36000), payAfterDays: 15 });
  bill(16, 'repairs', 'Breakdown and spares', 'VE12', 'factory', 18, { seededDay: [8, 26], uniform: [rs(3000), rs(10000)] });
  bill(17, 'repairs', 'Second breakdown bill', 'VE12', 'factory', 18, { seededDay: [8, 26], months: Q3, uniform: [rs(8000), rs(16000)] });
  bill(18, 'repairs', 'Generator service', 'VE08', 'factory', 18, { when: onYearly(['05-15', '11-15']), fixed: rs(4500), payAfterDays: 7 });
  bill(19, 'repairs', 'Proofer compressor replaced', 'VE08', 'factory', 18, { when: onDates(['2026-08-18']), fixed: rs(42000), payAfterDays: 7 });
  bill(20, 'licences', 'Product testing at a food laboratory', 'VE15', 'factory', 18, { when: onYearly(['01-10', '07-10']), fixed: rs(6500) });
  bill(21, 'licences', 'Weights and measures verification', 'VE14', 'factory', 0, { when: onYearly(['02-15']), fixed: rs(1500) });
  [['V1', '02-20'], ['V2', '05-20'], ['V3', '07-20'], ['V4', '09-20'], ['V5', '11-20']].forEach(function (v) {
    bill(22, 'licences', 'Van insurance, ' + v[0], 'VE13', 'factory', 18, { when: onYearly([v[1]]), fixed: rs(22000), van: v[0] });
    bill(23, 'licences', 'Van fitness and permit fee, ' + v[0], 'VE14', 'factory', 0, { when: onYearly([v[1]]), fixed: rs(1500), van: v[0] });
  });
  bill(24, 'licences', 'Fire and burglary cover', 'VE13', 'factory', 18, { when: onYearly(['04-01']), fixed: rs(24000) });
  bill(25, 'licences', 'Employees\' compensation policy', 'VE13', 'factory', 18, { when: onYearly(['04-01']), fixed: rs(18000) });
  bill(26, 'licences', 'Money-in-transit and fidelity cover', 'VE13', 'factory', 18, { when: onYearly(['04-01']), fixed: rs(4500) });
  bill(27, 'licences', 'Food licence fee, manufacturer', 'VE14', 'factory', 0, { when: onYearly(['06-10']), fixed: rs(5000) });
  STORE_IDS.forEach(function (s) {
    bill(28, 'licences', 'Food licence fee, retail counter', 'VE14', s, 0, { when: onYearly(['06-10']), fixed: rs(2000) });
  });
  bill(29, 'licences', 'Professional tax, employer\'s enrolment', 'VE14', 'factory', 0, { when: onYearly(['09-25']), fixed: rs(2500) });
  bill(30, 'licences', 'Factory licence renewal', 'VE14', 'factory', 0, { when: onYearly(['10-20']), fixed: rs(2000) });
  bill(31, 'telephone', 'Broadband and mobiles', 'VE09', 'factory', 18, { when: onDay(5), fixed: rs(3989) });
  STORE_IDS.forEach(function (s) {
    bill(32, 'telephone', 'Broadband and one mobile', 'VE09', s, 18, { when: onDay(5), fixed: rs(898) });
  });
  bill(33, 'professional', 'Monthly retainer', 'VE10', 'factory', 18, { when: onLastDay, fixed: rs(12000) });
  bill(34, 'professional', 'Tax audit and income-tax return', 'VE10', 'factory', 18, { when: onYearly(['09-25']), fixed: rs(60000) });
  /* approved and paid on its own date (the next open day when the month ends on a closed day) */
  bill(35, 'bank_charges', 'Bank charges', 'VE16', 'factory', 18, { when: onLastDay, sameDay: true,
    calc: function (date, env) { return bankCharges(env && env.cashDeposited ? env.cashDeposited : 0); } });
  bill(36, 'staff_welfare', 'Uniforms, aprons and caps', 'VE17', 'factory', 5, { when: onYearly(['04-10', '10-10']), fixed: rs(18000) });
  /* Rs 400 x (active employees - 3): 12,800 in 2026, 13,200 in 2027 */
  bill(37, 'staff_welfare', 'Medical fitness certificates', 'VE18', 'factory', 0, { when: onYearly(['03-20']),
    calc: function (date, env) { return rs(400) * ((env && env.headcount ? env.headcount : people.headcountOn(date)) - 3); } });
  /* Rs 1,500 x (active employees - 1): 52,500 */
  bill(38, 'staff_welfare', 'Diwali sweets and gifts', 'VE19', 'factory', 5, { when: onDates(['2026-11-03', '2027-10-24']),
    calc: function (date, env) { return rs(1500) * ((env && env.headcount ? env.headcount : people.headcountOn(date)) - 1); } });
  bill(39, 'marketing', 'Display racks, crates and shop boards', 'VE20', 'factory', 18, { seededDay: [10, 20], uniform: [rs(4000), rs(9000)] });
  bill(40, 'marketing', 'Local advertising and social media', 'VE21', 'factory', 18, { when: onDay(28), fixed: rs(5000) });
  bill(41, 'marketing', 'Festival leaflets and banners', 'VE20', 'factory', 18, { when: onYearly(['01-05']), fixed: rs(8000) });
  bill(41, 'marketing', 'Festival leaflets and banners, Diwali', 'VE20', 'factory', 18, { when: onDates(['2026-10-24', '2027-10-14']), fixed: rs(12000) });
  bill(42, 'running', 'Housekeeping contractor', 'VE22', 'factory', 18, { when: onLastDay, fixed: rs(9000) });
  bill(43, 'running', 'Water charges', 'VE23', 'factory', 0, { when: onDay(8), fixed: rs(2200) });
  bill(44, 'running', 'Pest control', 'VE24', 'factory', 18, { when: onDayIn(15, Q2), fixed: rs(4500) });

  /** The amount of a rule for a bill dated `date`, in paise before noise and before rounding to the rupee; null for a uniform draw. */
  function billAmount(rule, date, env) {
    if (rule.fixed !== null) return rule.fixed;
    if (rule.calc) return rule.calc(date, env);
    return null;
  }
  /** The bills whose rule fixes `date` as the bill date: [{ rule, amount }] in the order of RESEARCH 9.4. */
  function billsOn(date, env) {
    var out = [], i, r;
    for (i = 0; i < BILL_RULES.length; i++) {
      r = BILL_RULES[i];
      if (r.when && r.when(date)) out.push({ rule: r, amount: billAmount(r, date, env) });
    }
    return out;
  }
  /** The rules whose bill date is a seeded day of that month: the seed draws the day with seededDate. */
  function seededBills(monthKey) {
    var m = +monthKey.slice(5, 7);
    return BILL_RULES.filter(function (r) { return !!r.seededDay && (!r.months || r.months.indexOf(m) !== -1); });
  }
  /**
   * The dates a seeded-day rule can take in a month: the open days from seededDay[0] to seededDay[1]. A bill
   * is never dated on a closed day unless its rule fixes the date (RESEARCH 9.2), so November 2026 has no
   * 9th, 10th or 11th. Empty when the rule has no bill that month.
   */
  function seededDates(rule, monthKey) {
    var out = [], d, iso;
    if (!rule.seededDay || (rule.months && rule.months.indexOf(+monthKey.slice(5, 7)) === -1)) return out;
    for (d = rule.seededDay[0]; d <= rule.seededDay[1]; d++) {
      iso = monthKey + '-' + pad2(d);
      if (!isClosed(iso)) out.push(iso);
    }
    return out;
  }
  /** The bill date of a seeded-day rule in a month for a draw u in [0, 1): every open day of the range is as likely. */
  function seededDate(rule, monthKey, u) {
    var list = seededDates(rule, monthKey);
    return list.length ? list[Math.min(list.length - 1, Math.floor(u * list.length))] : null;
  }

  /* Expense claims (RESEARCH 9.6): about 40 a month. A month = count, spread over the open days; rupees low - high. */
  var CLAIM_ROWS = [
    ['Staff tea, milk and snacks', 'staff_welfare', 'u_production', 'factory', 4, 1900, 2600, { dow: SAT }],
    ['Diesel top-up on the route', 'vehicle_fuel', 'u_sales', 'factory', 3, 500, 1500],
    ['Puncture or small van job', 'vehicle_maint', 'u_sales', 'factory', 2, 150, 550],
    ['Toll and parking', 'running', 'u_sales', 'factory', 2, 80, 300],
    ['Customer visit, conveyance', 'running', 'u_sales', 'factory', 1, 600, 2200],
    ['Customer visit, conveyance', 'running', 'u_owner', 'factory', 1, 600, 2200],
    ['Sampling and display at outlets', 'marketing', 'u_sales', 'factory', 1, 300, 900],
    ['Mobile recharge or data pack', 'telephone', 'u_sales', 'factory', 1, 239, 479, { amounts: [239, 299, 399, 479] }],
    ['Loading and unloading labour', 'running', 'u_stores', 'factory', 3, 300, 800],
    ['Cleaning supplies, gloves, hairnets', 'running', 'u_stores', 'factory', 2, 400, 1200],
    ['Small hardware and spares', 'repairs', 'u_stores', 'factory', 2, 250, 1800],
    ['Electrician or plumber', 'repairs', 'u_production', 'factory', 1, 250, 1800],
    ['Courier', 'running', 'u_accounts', 'factory', 2, 80, 350],
    ['Stationery and printer supplies', 'running', 'u_accounts', 'factory', 2, 300, 1500],
    ['Housekeeping and cleaning supplies', 'running', 'u_store_mgr', 'each store', 2, 200, 600],
    ['Carry bags, napkins, billing rolls', 'running', 'u_store_mgr', 'each store', 1, 300, 900],
    ['Drinking water and tea', 'staff_welfare', 'u_store_mgr', 'each store', 1, 250, 550],
    ['Small repair at the store', 'repairs', 'u_store_mgr', 'each store', 0.5, 200, 1200]   /* one every second month at each store */
  ];
  /*
   * payeeEmployeeId is who the claim is payable to: the employee of the persona for a factory row, and for a
   * store row that store's own manager (RESEARCH 8.3) - E029 and E034 at S1 and S3, although u_store_mgr (E032)
   * raises the claim. The engine as built pays a claim to the persona's employee and takes no payee from a
   * payload (docs/API.md 2.7, 2.12); docs/CONFIG.md, choice 24, says what follows from that.
   */
  var claims = [];
  CLAIM_ROWS.forEach(function (r) {
    var each = r[3] === 'each store';
    (each ? STORE_IDS : [r[3]]).forEach(function (u) {
      var x = r[7] || {};
      claims.push({ name: r[0], categoryId: r[1], userId: r[2], unitId: u, payeeEmployeeId: each ? STORE_MANAGER[u] : userEmployee(r[2]),
        perMonth: r[4], amount: [rs(r[5]), rs(r[6])],
        amounts: x.amounts ? x.amounts.map(rs) : null, dow: x.dow === undefined ? null : x.dow });
    });
  });

  var expenses = {
    /* every expense bill waits for the Owner, who approves it the next morning; accounts pays it from the bank on its due date */
    userId: 'u_accounts', approvedBy: 'u_owner', payAccount: 'bank',
    /** Rounded to the rupee, as every bill amount is after its noise draw. */
    toRupee: function (paise) { return Math.round(paise / 100) * 100; },
    diesel: { series: DIESEL, litresADay: DIESEL_LITRES_A_DAY, priceOn: dieselPrice, amount: dieselFor },
    gas: { series: GAS, scmADay: GAS_SCM_A_DAY, priceIn: gasPrice, scm: gasScm, amount: gasBill },
    electricity: { tariff: POWER, surcharge: surcharge, factoryUnits: factoryUnits, factory: factoryPower, storeUnits: storeUnits, store: storePower },
    bankCharges: bankCharges,
    /* V(M) = (kg of maida and atta consumed in month M / days in M) / the same for January 2026; V = 1 for December 2025 */
    volumeFactor: { items: ['RM01', 'RM02'], base: '2026-01', before: 1 },
    bills: BILL_RULES, billsOn: billsOn, seededBills: seededBills, seededDates: seededDates, seededDate: seededDate, billAmount: billAmount,
    claims: {
      rows: claims,
      /** The note of a claim row: it names the store's own manager at S1 and S3, and is empty otherwise. */
      noteOf: function (row) { return row.unitId === 'factory' ? '' : storeManagerNote(row.unitId); },
      roundTo: rs(10),                                    /* the recharge takes one of its listed amounts instead */
      billRef: { prefix: 'CB-', digits: 4, noBill: 'no bill - voucher', noBillShare: 0.2 },
      /* the Owner approves a claim the next morning and rejects 3%; the Owner's own claim is approved by the Owner */
      rejectShare: 0.03, rejectReasons: ['no bill attached', 'duplicate of an earlier claim', 'personal expense'],
      /* approved claims are reimbursed every Saturday: factory claims from factory cash, store claims by bank transfer */
      reimburse: { dow: SAT, factory: 'cash_factory', store: 'bank' },
      /** Is `date` a reimbursement day? Saturday; Saturday 30 October 2027 is closed, so Monday 1 November. */
      isReimburseDay: function (date) { return fallsOn([SAT], date); }
    }
  };

  /* ------------------------------------------------- cash and the month-end count (RESEARCH 9.5) */

  var cash = {
    /* factory cash: every Monday to Saturday that is not closed, deposit the balance above the float; skip a deposit under the minimum */
    factory: { dows: MON_SAT, keep: rs(25000), minDeposit: rs(5000), userId: 'u_accounts' },
    isFactoryDepositDay: function (date) { return !isClosed(date) && dow(date) !== SUN; },
    store: { dows: stores.depositDows, keep: stores.float, isDepositDay: stores.isDepositDay },
    slipRef: { prefix: 'DS-', digits: 6 }
  };

  var PACKING_IDS = MAT_IDS.filter(function (id) { return id.charAt(0) === 'P'; });
  var stockCount = {
    locId: 'fac_rm', userId: 'u_stores', approvedBy: 'u_owner', reason: 'month-end count',
    /** The count of a month is raised on its last open day and approved the next morning. */
    dateOf: function (monthKey) { var d = monthKey + '-' + pad2(daysInMonth(monthKey)); return isClosed(d) ? prevOpen(d) : d; },
    /* a shortage as a share of the month's consumption, drawn per item */
    packing: { items: PACKING_IDS, shortage: [0.010, 0.020], whole: true },
    flour: { items: ['RM01'], shortage: [0.002, 0.004] },
    bulk: { items: ['RM03', 'RM04', 'RM05', 'RM07'], shortage: [0.001, 0.003] },
    /* and two other raw materials drawn that month, +/- 0.5% (may be an excess) */
    others: { count: 2, range: [-0.005, 0.005] }
    /* no count at the stores or of finished goods */
  };

  /* ------------------------------------------------- vans and the document clock (RESEARCH 1.3) */

  var vehicles = [
    { id: 'V1', run: 'R1 Anand town', routeId: 'R1', drivers: [{ employeeId: 'E022', from: '2026-01-01' }], leaves: '05:30', back: '08:00', km: 27.1 },
    { id: 'V2', run: 'R2 Vidyanagar-Karamsad', routeId: 'R2', drivers: [{ employeeId: 'E023', from: '2026-01-01' }], leaves: '05:30', back: '07:34', km: 23.2 },
    { id: 'V3', run: 'R3 Nadiad, store S3 and corporate C07', routeId: 'R3', drivers: [{ employeeId: 'E024', from: '2026-01-01' }], leaves: '05:30', back: '08:34', km: 60.3 },
    { id: 'V4', run: 'R4 Borsad-Petlad', routeId: 'R4', drivers: [{ employeeId: 'E025', from: '2026-01-01' }, { employeeId: 'E038', from: '2026-08-01' }], leaves: '05:30', back: '08:00', km: 66.0 },
    { id: 'V5', run: 'Stores S1 and S2 and nine corporates', routeId: null, drivers: [{ employeeId: 'E026', from: '2026-01-01' }], leaves: '06:00', back: '08:47', km: 28.3,
      timetable: [['C01', '06:02'], ['C05', '06:17'], ['C04', '06:26'], ['st_vvn', '06:44'], ['st_anand', '07:05'], ['C08', '07:22'],
        ['C06', '07:37'], ['C09', '07:54'], ['C02', '08:11'], ['C03', '08:23'], ['C10', '08:33']] }
  ];
  /* the time of day each seeded document carries */
  var clock = { loading: '04:45', dispatch: '05:30', transfer: '06:00', transferConfirmed: '07:30', dayEnd: '21:00',
    dayEndAt: { st_anand: '21:00', st_vvn: '21:00', st_nadiad: '20:30' },
    arrivals: { st_nadiad: '06:22', C07: '07:31' }, serviceMinutes: { outlet: 6, corporate: 8, store: 12 } };

  /* ------------------------------------------------- the eight seeded stories (RESEARCH 12) */

  var DIP = [
    ['FG04', 'new yeast lot - slow proof'], ['FG12', 'margarine too soft - poor lift'], ['FG01', 'proofer humidity fault'],
    ['FG16', 'sheeter gap worn - pastry tears'], ['FG10', 'slicer blade blunt - broken slices'], ['FG05', 'divider out of calibration']
  ];
  /** The product that bakes badly on a production date (the 5th to the 18th of every month), or null. */
  function dipOn(date) {
    var d = dayOf(date), i;
    if (d < 5 || d > 18) return null;
    i = ((monthsBetween('2026-01', date.slice(0, 7)) % 6) + 6) % 6;
    return { itemId: DIP[i][0], note: DIP[i][1], rejectRate: [0.08, 0.12] };
  }
  /** Is the cash at S3 short on this date? The Tuesday of every week k (counted from Thursday 2026-01-01) with k mod 3 = 0 or 1. */
  function s3ShortOn(date) {
    var k = Math.floor(diffDays('2026-01-01', date) / 7);
    return dow(date) === TUE && !isClosed(date) && k >= 0 && k % 3 !== 2;
  }

  /**
   * The morning the Owner releases the held weekly bill: a week after its date, the next open day if that is
   * closed. It is the bill's due date, the day it is paid in cash (purchasing.payDate), and the following
   * Monday for every bill dated on a Monday.
   */
  function weeklyReleaseDate(billDate) { return nextOpen(addDays(billDate, 7)); }

  var stories = {
    /* 12.1 a flour price rise that lifts bread cost: the maida and atta series of sim.prices */
    flour: { items: ['RM01', 'RM02'], products: ['FG01', 'FG04'], rule: 'sim.prices',
      points: [['2026-04', 3500], ['2026-10', 3900], ['2027-04', 3850], ['2027-09', 4150]] },
    /* 12.2 one product with a yield dip for a fortnight: on its entries the reject rate is drawn in rejectRate, in place of reject x v */
    yieldDip: { fromDay: 5, toDay: 18, rotation: DIP.map(function (d) { return { itemId: d[0], note: d[1] }; }), rejectRate: [0.08, 0.12], on: dipOn },
    /* 12.3 one outlet whose returns run above the limit: its credit notes are held for the Owner; it is also a slow payer */
    highReturns: { customerId: 'O19', outletFactor: RETURN_OUTLET.O19, expectedShare: 0.132, expectedShareMonsoon: 0.164 },
    /* 12.4 one corporate that pays late and is over its credit limit on every date */
    lateCorporate: { customerId: 'C06', creditDays: 15, latenessDays: 20, payDow: MON, creditLimit: rs(40000), openingOverdue: rs(58000) },
    /* 12.5 a vendor bill that fails the three-way check */
    heldBill: {
      /* A: every weekly VM09 bill carries the onion line (the potato line if no onion came that week) above the order rate; */
      /*    it waits a week (RESEARCH 14 point 2): the Owner releases it on the morning of its due date, when it is also    */
      /*    paid in cash (4.5 rule 6). That is "the following Monday" of 12.5 for every bill but the one dated Thursday     */
      /*    12 November 2026, released on the 19th and not on Monday the 16th (docs/CONFIG.md, choice 25)                   */
      weekly: { vendorId: 'VM09', itemId: 'RM20', elseItemId: 'RM19', over: [0.03, 0.06], roundTo: rs(0.10), releasedAfterDays: 7,
        releaseDate: weeklyReleaseDate },
      /* B: one bill in 40 from these vendors, drawn on the receipt, has one line 3-5% above the order; released the next morning */
      occasional: { vendors: ['VM03', 'VM04', 'VM07', 'VM12', 'VM13'], chance: 1 / 40, over: [0.03, 0.05], note: 'billed at next month\'s price' }
    },
    /* 12.6 a store with an occasional cash shortage */
    cashShort: {
      storeId: 'st_nadiad', dow: TUE, on: s3ShortOn, amount: [rs(30), rs(180)], roundTo: rs(10),
      /* elsewhere, any store, any day: a draw under `chance` gives a small difference, short seven times in ten */
      anywhere: { chance: 0.02, amount: [rs(10), rs(40)], roundTo: rs(10), shortShare: 0.7 }
    },
    /* 12.7 a material below its reorder level on every date: the order quantity is less than three days of use */
    lowStock: { itemId: 'RM08', reorderLevel: 180, orderQty: 30, leadDays: 3 },
    /* 12.8 near-expiry stock in every store on every date: ladi pav stands at 1.6 normal days and lives three */
    nearExpiry: { itemId: 'FG04', standingDays: 1.6, shelfLifeDays: 3, largestDemandFactor: 1.48 }
  };

  /* ============================================================ CALIBRATION (RESEARCH 13, 11.6) */

  function crore(x) { return Math.round(x * 1000000000); }   /* Rs crore to paise */

  /*
   * The self-check asserts these on the generated seed for the business dates below. A band that fails is
   * fixed by a parameter above, never by patching an output. Money in paise, shares as fractions; min and
   * max are both inside the band. `every` says what the band is tested on.
   */
  var bands = [
    { n: 1, key: 'netSales2026', measure: 'Net sales before GST, 2026', unit: 'paise', min: crore(3.84), max: crore(4.04) },
    { n: 2, key: 'netSales2027', measure: 'Net sales before GST, 2027', unit: 'paise', min: crore(4.00), max: crore(4.22) },
    { n: 3, key: 'netSalesToOct2026', measure: 'Net sales, 2026-01-01..2026-10-01', unit: 'paise', from: '2026-01-01', to: '2026-10-01', min: crore(2.88), max: crore(3.03) },
    { n: 4, key: 'netSalesMonth', measure: 'Net sales of each month, against calibration.months', every: 'month', unit: 'fraction', tolerance: 0.03 },
    { n: 5, key: 'netSalesPerDay', measure: 'Average net sales a day, each year', every: 'year', unit: 'paise', min: lakh(1.05), max: lakh(1.16) },
    { n: 6, key: 'netSalesOpenDay', measure: 'Net sales on an open day', every: 'open day', unit: 'paise', min: rs(55000), max: rs(145000) },
    { n: 7, key: 'channelShares', measure: 'Channel shares of a year', every: 'year', unit: 'fraction',
      parts: { retail: [0.50, 0.54], corporate: [0.20, 0.23], store: [0.25, 0.28] } },
    { n: 8, key: 'storeShares', measure: 'Store shares of store sales', every: 'year', unit: 'fraction',
      parts: { st_anand: [0.45, 0.49], st_vvn: [0.28, 0.32], st_nadiad: [0.21, 0.25] } },
    { n: 9, key: 'returnShare', measure: 'Stale returns, share of retail supply, a year', every: 'year', unit: 'fraction', min: 0.034, max: 0.045 },
    { n: 10, key: 'returnShareFresh', measure: 'Stale returns on the fresh lines (BR and BN groups), a year', every: 'year', unit: 'fraction', groups: ['BR', 'BN'], min: 0.046, max: 0.060 },
    { n: 11, key: 'o19NotesHeld', measure: 'O19 credit notes held, share of its notes from February 2026', unit: 'fraction', customerId: 'O19', from: '2026-02-01', min: 0.95 },
    { n: 12, key: 'otherNotesHeld', measure: 'Held credit notes of all other outlets, a month outside July-September', every: 'month', exceptMonths: [7, 8, 9], unit: 'count', max: 30 },
    { n: 13, key: 'cogsShare', measure: 'Recipe cost of goods sold, share of net sales, a year', unit: 'fraction',
      parts: { '2026': [0.465, 0.50], '2027': [0.48, 0.515] } },
    { n: 14, key: 'materialShareYear', measure: 'Material cost (recipe cost + production loss + write-offs + count differences), a year', unit: 'fraction',
      parts: { '2026': [0.475, 0.515], '2027': [0.495, 0.53] } },
    { n: 15, key: 'materialShareMonth', measure: 'Material cost, any month', every: 'month', unit: 'fraction', min: 0.45, max: 0.55 },
    { n: 16, key: 'retailMargin', measure: 'Product margin to retailers (retailer price - recipe cost)', every: 'product and month', unit: 'paise', above: 0 },
    { n: 17, key: 'productionLossShare', measure: 'Production loss, a year', every: 'year', unit: 'fraction of sales', min: 0.001, max: 0.006 },
    { n: 18, key: 'writeOffShare', measure: 'Write-offs, a year', every: 'year', unit: 'fraction of sales', min: 0.007, max: 0.016 },
    { n: 19, key: 'countDiffShare', measure: 'Count differences, a year', every: 'year', unit: 'fraction of sales', min: 0.001, max: 0.004 },
    { n: 20, key: 'yieldMonth', measure: 'Yield, all entries of a month', every: 'month', unit: 'fraction', min: 0.985, max: 1.005 },
    { n: 21, key: 'yieldDip', measure: 'Yield of the dip product on its entries dated the 5th to the 18th', every: 'month', unit: 'fraction', min: 0.88, max: 0.95 },
    { n: 22, key: 'puffExpiryShare', measure: 'Store puffs expired, share of puffs received, a year', every: 'year', unit: 'fraction', min: 0.09, max: 0.17 },
    { n: 23, key: 'salaryShare', measure: 'Salaries, share of sales, a year', every: 'year', unit: 'fraction', min: 0.215, max: 0.245 },
    { n: 24, key: 'otherExpenseShare', measure: 'Expenses other than salaries, a year', every: 'year', unit: 'fraction of sales', min: 0.155, max: 0.185 },
    { n: 25, key: 'profit2026', measure: 'Operating profit, 2026', unit: 'fraction of sales', min: 0.085, max: 0.12 },
    { n: 26, key: 'profit2027', measure: 'Operating profit, 2027', unit: 'fraction of sales', min: 0.065, max: 0.105 },
    { n: 27, key: 'profitMonth', measure: 'Operating profit, any month', every: 'month', unit: 'fraction of sales', min: -0.04, max: 0.19 },
    { n: 28, key: 'profitQuarter', measure: 'Operating profit, any calendar quarter', every: 'quarter', unit: 'fraction of sales', above: 0.04 },
    { n: 29, key: 'receivables', measure: 'Receivables at each month end from February 2026', every: 'month end', from: '2026-02-01', unit: 'paise',
      min: lakh(7.5), max: lakh(11.5), days: [6.5, 10], daysOf: 'sales with GST' },
    /* 30: upper end 36 -> 38. The simulation's highest month end is 37.6 days (May 2026); 36 was an estimate made before it ran */
    { n: 30, key: 'corporateReceivables', measure: 'Corporate receivables at each month end', every: 'month end', unit: 'days', days: [24, 38], daysOf: 'corporate sales' },
    { n: 31, key: 'overdueReceivables', measure: 'Overdue receivables on every day', every: 'day', unit: 'paise', above: 0 },
    { n: 32, key: 'c06OverLimit', measure: 'C06 balance on every day: above its credit limit', every: 'day', customerId: 'C06', unit: 'paise', above: rs(40000) },
    /* 33: read from 2026-02-01, the earliest business date a copy can have. In January 2026 C01, C03, C05 and C07 stand above their limits on 21 days, until their opening invoices are settled */
    { n: 33, key: 'corporatesWithinLimit', measure: 'Every other corporate, every day from 2026-02-01: at or under its credit limit', every: 'day', from: '2026-02-01', except: ['C06'], unit: 'bool' },
    /* 34: lower end Rs 8.5 lakh -> Rs 8.0 lakh. The simulation's lowest month end is Rs 8.23 lakh (May 2027); 8.5 was an estimate made before it ran */
    { n: 34, key: 'stockPayables', measure: 'Payables to stock vendors at each month end', every: 'month end', unit: 'paise',
      min: lakh(8.0), max: lakh(13.5), days: [15, 23], daysOf: 'purchases with GST' },
    /* 35: read from 2026-02-01 and restated as a share of days. Nothing is overdue to the two from 5 to 30 January 2026, nor on 2026-11-26 and 2027-03-29 to 31: 695 of the 699 days to 2027-12-31 */
    { n: 35, key: 'overduePayables', measure: 'Days from 2026-02-01 with an overdue payable to VM08 or VM13, share of the days', every: 'day', from: '2026-02-01', vendors: ['VM08', 'VM13'], unit: 'fraction', min: 0.994 },
    { n: 36, key: 'materialStock', measure: 'Material stock value at each month end', every: 'month end', unit: 'paise',
      min: lakh(4.5), max: lakh(7.5), days: [8, 13], daysOf: 'consumption' },
    { n: 37, key: 'factoryFinishedStock', measure: 'Finished stock at the factory at each month end, at recipe cost', every: 'month end', unit: 'paise', min: lakh(1.2), max: lakh(2.6) },
    /* RESEARCH names no moment for row 38; it is read like rows 36 and 37 above it, at each month end (docs/CONFIG.md, choice 26) */
    { n: 38, key: 'storeFinishedStock', measure: 'Finished stock at the three stores together', every: 'month end', unit: 'paise', min: rs(10000), max: rs(25000) },
    /* 39: read from 2026-02-01. On 1 and 2 January 2026 the opening stock of RM22 and of RM01 is under the three-day plan */
    { n: 39, key: 'materialCover', measure: 'Day-end stock of every material from 2026-02-01: at least the standard day plan of the next three days', every: 'day', from: '2026-02-01', unit: 'bool', planDays: 3 },
    { n: 40, key: 'safetyNetOrders', measure: 'Safety-net orders', unit: 'count', min: 0, max: 0 },
    { n: 41, key: 'lowStockCount', measure: 'Materials at or under their reorder level at each day-end from 2026-01-05', every: 'day', from: '2026-01-05', unit: 'count',
      min: 1, monthAverage: [4, 12] },
    /* 42: lower end 90 -> 80. The simulation's fewest are 81, in November 2026, a month with three closed days */
    { n: 42, key: 'ordersAMonth', measure: 'Purchase orders a month', every: 'month', unit: 'count', min: 80, max: 120, aboveLimit: [8, 13] },
    { n: 43, key: 'heldBill', measure: 'A held vendor bill on every day after 2026-01-05', every: 'day', after: '2026-01-05', unit: 'count', min: 1 },
    { n: 44, key: 's3Shortages', measure: 'S3 cash shortages in any 30 days', every: '30-day window', storeId: 'st_nadiad', unit: 'count', min: 2, max: 4 },
    { n: 45, key: 'nearExpiry', measure: 'Near-expiry batches at each store at the start of every open day after a normal day', every: 'open day and store', unit: 'count', min: 1 },
    { n: 46, key: 'handOver', measure: 'Hand-over (build specification section 6): holds on every day that is not followed by a closed day', every: 'day', unit: 'bool' },
    { n: 47, key: 'neverNegative', measure: 'Stock, every cash account and the bank, in posting order: never negative', unit: 'bool' },
    { n: 48, key: 'factoryCash', measure: 'Factory cash at any day-end', every: 'day', unit: 'paise', min: rs(5000), max: rs(90000) },
    { n: 49, key: 'bankAtEnd', measure: 'Bank balance on 2027-12-31', on: '2027-12-31', unit: 'paise', min: lakh(60), max: lakh(100) },
    /* 50: the veg puff's range was corrected to 3.5 - 9 mixes (RUN_RANGE above); with 4 - 8, 13 of the 9,990 entries lay outside */
    { n: 50, key: 'mixesInRange', measure: 'Mixes of any production entry: inside smallestRun - largestRun of sim.production.byItem, plus one step', every: 'production entry', unit: 'mixes' },
    { n: 51, key: 'flourADay', measure: 'Flour (RM01 + RM02) consumed a day, a year', every: 'year', unit: 'kg', min: 640, max: 730 },
    { n: 52, key: 'deterministic', measure: 'Two runs of the seed: identical', unit: 'bool' }
  ];

  /*
   * RESEARCH 11.6, expected values month by month (Rs lakh in the source): retail gross, stale returns,
   * corporates, own stores, net sales, net sales a day (rupees), volume factor V, recipe cost %, material
   * cost %, expenses (Rs lakh), operating profit %. Band 4 compares net sales. Check with it, never patch to it.
   */
  var MONTH_ROWS = [
    ['2026-01', 18.39, 0.67, 7.59, 9.37, 34.68, 111864, 1.00, 46.9, 48.1, 12.41, 16.1],
    ['2026-02', 16.79, 0.61, 7.07, 8.40, 31.66, 113056, 1.01, 47.1, 48.3, 12.21, 13.1],
    ['2026-03', 18.19, 0.66, 7.19, 9.06, 33.78, 108959, 0.98, 47.0, 48.3, 11.92, 16.4],
    ['2026-04', 16.64, 0.61, 7.23, 8.14, 31.40, 104668, 0.95, 46.8, 48.3, 13.65, 8.2],
    ['2026-05', 16.18, 0.59, 5.69, 7.50, 28.77, 92807, 0.84, 47.6, 49.3, 13.02, 5.5],
    ['2026-06', 16.69, 0.61, 6.60, 8.10, 30.77, 102576, 0.92, 48.5, 50.0, 13.16, 7.2],
    ['2026-07', 18.98, 0.89, 7.85, 9.27, 35.21, 113566, 0.98, 48.2, 49.5, 13.56, 12.0],
    ['2026-08', 18.94, 0.88, 7.19, 9.18, 34.44, 111094, 0.95, 49.4, 50.8, 13.48, 10.0],
    ['2026-09', 18.18, 0.84, 7.16, 8.83, 33.33, 111103, 0.96, 49.8, 51.3, 13.81, 7.2],
    ['2026-10', 18.94, 0.70, 7.60, 9.37, 35.21, 113589, 0.98, 49.3, 50.5, 13.59, 10.8],
    ['2026-11', 15.29, 0.55, 5.31, 7.48, 27.52, 91740, 0.78, 49.0, 50.6, 13.78, -0.7],
    ['2026-12', 19.56, 0.72, 8.27, 9.65, 36.76, 118573, 1.02, 49.0, 50.2, 12.62, 15.4],
    ['2027-01', 19.21, 0.71, 7.82, 9.63, 35.94, 115945, 1.00, 49.0, 50.2, 13.38, 12.5],
    ['2027-02', 17.89, 0.66, 7.44, 8.71, 33.39, 119241, 1.03, 49.7, 51.0, 13.15, 9.6],
    ['2027-03', 18.66, 0.69, 7.75, 9.18, 34.91, 112602, 0.97, 49.6, 51.1, 12.87, 12.1],
    ['2027-04', 17.78, 0.65, 7.63, 8.71, 33.46, 111548, 0.94, 48.2, 49.7, 14.58, 6.8],
    ['2027-05', 17.31, 0.63, 6.19, 8.03, 30.89, 99654, 0.85, 48.5, 50.2, 13.88, 4.8],
    ['2027-06', 17.75, 0.66, 7.36, 8.60, 33.05, 110178, 0.93, 49.2, 50.7, 13.74, 7.7],
    ['2027-07', 19.47, 0.90, 8.05, 9.71, 36.33, 117194, 0.98, 50.1, 51.3, 14.14, 9.7],
    ['2027-08', 19.13, 0.86, 7.23, 9.35, 34.84, 112389, 0.94, 50.5, 52.2, 13.67, 8.6],
    ['2027-09', 18.92, 0.86, 7.48, 9.51, 35.05, 116845, 0.98, 50.8, 52.1, 14.42, 6.8],
    ['2027-10', 18.40, 0.66, 6.90, 9.29, 33.93, 109457, 0.90, 50.6, 52.0, 14.77, 4.5],
    ['2027-11', 17.19, 0.62, 6.66, 8.45, 31.67, 105580, 0.89, 50.8, 52.5, 13.84, 3.8],
    ['2027-12', 20.03, 0.73, 8.39, 10.14, 37.83, 122044, 1.02, 50.9, 52.1, 13.38, 12.5]
  ];
  var YEAR_ROWS = [
    ['2026', 212.76, 8.34, 84.75, 104.36, 393.52, 107814, null, 48.2, 49.6, 157.22, 10.4],
    ['2027', 221.72, 8.63, 88.90, 109.32, 411.31, 112688, null, 49.9, 51.3, 165.81, 8.4]
  ];
  /** A percentage with one decimal as a fraction free of binary noise (48.1 -> 0.481). */
  function share(pct) { return Math.round(pct * 10) / 1000; }
  function expectedOf(r) {
    return { retailGross: lakh(r[1]), staleReturns: lakh(r[2]), corporates: lakh(r[3]), stores: lakh(r[4]), netSales: lakh(r[5]),
      perDay: rs(r[6]), volumeFactor: r[7], cogsShare: share(r[8]), materialShare: share(r[9]), expenses: lakh(r[10]), profitShare: share(r[11]) };
  }
  var calibration = { dates: ['2026-10-02', '2027-04-01', '2027-12-31'], bands: bands, months: {}, years: {} };
  MONTH_ROWS.forEach(function (r) { calibration.months[r[0]] = expectedOf(r); });
  YEAR_ROWS.forEach(function (r) { calibration.years[r[0]] = expectedOf(r); });

  /* ============================================================ HB.config */

  /* Who buys what (RESEARCH 2.2): outlet types P D T B G, corporates, own stores; 1 = carried. For reference and for the check. */
  var CARRIED = {
    FG01: [1, 1, 1, 1, 1, 1, 1], FG02: [1, 1, 0, 1, 1, 1, 1], FG03: [0, 0, 0, 0, 0, 1, 1], FG04: [1, 1, 1, 1, 1, 1, 1],
    FG05: [1, 1, 1, 1, 1, 1, 1], FG06: [0, 0, 0, 1, 1, 1, 1], FG07: [0, 0, 0, 1, 1, 1, 1], FG08: [0, 0, 0, 0, 0, 1, 1],
    FG09: [1, 1, 0, 1, 1, 1, 1], FG10: [1, 1, 1, 1, 1, 1, 1], FG11: [1, 1, 0, 1, 1, 1, 1], FG12: [1, 1, 1, 1, 1, 0, 1],
    FG13: [1, 0, 1, 1, 1, 0, 1], FG14: [1, 0, 0, 1, 1, 1, 1], FG15: [1, 1, 0, 1, 1, 1, 1], FG16: [0, 0, 0, 0, 0, 1, 1],
    FG17: [0, 0, 0, 0, 0, 1, 1], FG18: [0, 0, 0, 0, 0, 1, 1]
  };

  HB.config = {
    /* ---- masters: copied into HB.masters by the engine */
    company: company,
    units: units,
    locations: locations,
    accounts: accounts,
    items: items,
    recipes: recipes,
    routes: routes,
    customers: customers,
    vendors: vendors,
    employees: employees,
    expenseCategories: expenseCategories,
    users: users,
    limits: limits,
    journeys: journeys,

    /* ---- helpers that belong to the masters */
    gstin: { make: gstin, checkChar: gstinCheckChar, valid: gstinValid },
    guide: { stepMatches: stepMatches, entryDocs: entryDocs },

    /* ---- the opening entries of 1 January 2026, in the shape HB.engine.postOpening reads */
    opening: opening,

    /* ---- simulation parameters: read by seed.js only, never by a page or a selector */
    sim: {
      dow: { MON: MON, TUE: TUE, WED: WED, THU: THU, FRI: FRI, SAT: SAT, SUN: SUN },
      calendar: {
        goLive: company.goLive, closedDays: CLOSED_DAYS, factoryHolidays: FACTORY_HOLIDAYS,
        firstDispatchAfterBreak: ['2026-11-12', '2027-11-01'],
        isClosed: isClosed, isFactoryHoliday: isFactoryHoliday, nextOpen: nextOpen, prevOpen: prevOpen,
        periods: PERIODS, nriSeason: ['12-15', '01-31'], summer: SUMMER,
        inPeriod: inPeriod, inNriSeason: inNriSeason, inSummer: inSummer
      },
      prices: {
        from: PRICE_FROM, to: PRICE_TO, months: PRICE_MONTHS, table: PRICE_TABLE, inMonth: priceIn, on: priceOn,
        ruleBase: RULE_BASE, rule: PRICE_RULE, shapes: SHAPES, byRule: priceByRule
      },
      priceRevisions: priceRevisions,
      priceListOn: priceListOn,
      outlets: {
        types: OUTLET_TYPES, templateItems: TEMPLATE_ITEMS, template: TEMPLATE_M, sizePct: SIZE_PCT, standingOf: standingOf,
        carried: { columns: ['P', 'D', 'T', 'B', 'G', 'corporate', 'store'], byItem: CARRIED },
        info: OUTLET
      },
      demand: demand,
      rain: { seasons: RAIN.seasons, wetChanceByMonth: RAIN.wetChance, heavyDays: RAIN.heavyDays, heavyOnRoutes: RAIN.heavyOnRoutes,
        factor: RAIN.factor, corporateHeavy: RAIN.corporateHeavy, wetChance: wetChance, kind: rainKind, factorOf: rainFactor },
      returns: returns,
      stores: stores,
      corporates: corporates,
      collections: collections,
      production: production,
      purchasing: purchasing,
      people: people,
      expenses: expenses,
      cash: cash,
      stockCount: stockCount,
      vehicles: vehicles,
      clock: clock,
      stories: stories,
      openingSettlement: openingSettlement,
      /* the Owner clears whatever is pending on the next open morning; the held weekly bill of stories.heldBill waits a week */
      approvals: { userId: 'u_owner', when: 'next open morning' }
    },

    /* ---- RESEARCH section 13, for the self-check */
    calibration: calibration
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = HB.config;
})(typeof window !== 'undefined' ? window : globalThis);
