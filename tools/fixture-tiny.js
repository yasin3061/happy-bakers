/*
 * A tiny HB.config for tests: small enough that every figure a check asserts can be worked out by hand.
 * One store, two materials, one packing item, two products (one Nil-rated, one at 5%), three customers (a cash
 * outlet, a weekly-credit outlet, a corporate), two vendors and the staff vendor, four employees, six users.
 * Load it after js/core/kernel.js and before js/data/engine.js; it replaces HB.config.
 * All money is in paise. Every name is invented.
 */
(function (root) {
  'use strict';

  var HB = root.HB || (root.HB = {});

  HB.config = {
    company: {
      name: 'Happy Bakers (tiny)', legalName: 'Happy Bakers Test Company', gstin: '24AAAAA0000A1Z5',
      address: 'Vitthal Udyognagar, Anand', stateCode: '24', bankName: 'Test Bank, Anand'
    },

    /* the store is st_vvn because that is the store the kernel scopes the store manager to */
    units: [
      { id: 'factory', name: 'Factory', kind: 'factory' },
      { id: 'st_vvn', name: 'Vidyanagar store', kind: 'store', standing: { bread: 20, puff: 50 } }
    ],
    locations: [
      { id: 'fac_rm', name: 'Raw material store', kind: 'rm', unitId: 'factory' },
      { id: 'fac_fg', name: 'Finished goods store', kind: 'fg', unitId: 'factory' },
      { id: 'st_vvn', name: 'Vidyanagar store', kind: 'store', unitId: 'st_vvn' },
      { id: 'transit_st_vvn', name: 'In transit to Vidyanagar store', kind: 'transit', unitId: 'st_vvn' }
    ],
    accounts: [
      { id: 'cash_factory', name: 'Factory cash', kind: 'cash', unitId: 'factory' },
      { id: 'cash_st_vvn', name: 'Vidyanagar store cash', kind: 'cash', unitId: 'st_vvn' },
      { id: 'bank', name: 'Bank account', kind: 'bank', unitId: null }
    ],

    items: [
      { id: 'maida', code: 'MAI', name: 'Maida', kind: 'rm', unit: 'kg', pack: '50 kg bag', hsn: '1101', gstRate: 0, reorderLevel: 300, orderQty: 500, leadDays: 2, vendorId: 'v_stock', active: true },
      { id: 'fat', code: 'FAT', name: 'Bakery shortening', kind: 'rm', unit: 'kg', pack: '15 kg tin', hsn: '1517', gstRate: 5, reorderLevel: 30, orderQty: 45, leadDays: 3, vendorId: 'v_stock', active: true },
      { id: 'bag', code: 'BAG', name: 'Poly bag', kind: 'pk', unit: 'pcs', pack: 'bundle of 1000', hsn: '3923', gstRate: 18, reorderLevel: 500, orderQty: 2000, leadDays: 4, vendorId: 'v_stock', active: true },
      { id: 'bread', code: 'BRD', name: 'Sandwich bread', kind: 'fg', unit: 'pcs', pack: '400 g', hsn: '1905', gstRate: 0, shelfLifeDays: 4, price: { mrp: 4000, retail: 3200, corporate: 3000 }, reorderLevel: 0, active: true },
      { id: 'puff', code: 'PUF', name: 'Veg puff', kind: 'fg', unit: 'pcs', pack: 'piece', hsn: '1905', gstRate: 5, shelfLifeDays: 1, price: { mrp: 1500, retail: 1100, corporate: 1050 }, reorderLevel: 0, active: true }
    ],

    /* bread: (10 kg maida + 0.5 kg shortening) / 40 + one bag; puff: (4 kg maida + 2 kg shortening) / 100 + one bag */
    recipes: [
      { itemId: 'bread', mixLabel: '10 kg flour mix', expectedUnits: 40, materials: [{ itemId: 'maida', qty: 10 }, { itemId: 'fat', qty: 0.5 }], packing: [{ itemId: 'bag', qtyPerUnit: 1 }], rhythm: 'daily', standardMixes: 2 },
      { itemId: 'puff', mixLabel: '4 kg pastry mix', expectedUnits: 100, materials: [{ itemId: 'maida', qty: 4 }, { itemId: 'fat', qty: 2 }], packing: [{ itemId: 'bag', qtyPerUnit: 1 }], rhythm: 'daily', standardMixes: 1 }
    ],

    routes: [
      { id: 'r1', name: 'Anand town', stops: ['c_cash', 'c_week'] }
    ],

    customers: [
      { id: 'c_cash', name: 'Shree Ganesh Provision', channel: 'retail', outletType: 'provision store', routeId: 'r1', locality: 'Anand', terms: 'cash', creditDays: 0, creditLimit: 0, gstin: '', standing: { bread: 20, puff: 10 }, active: true },
      { id: 'c_week', name: 'Amul Parlour, Station Road', channel: 'retail', outletType: 'dairy parlour', routeId: 'r1', locality: 'Anand', terms: 'weekly', creditDays: 7, creditLimit: 0, gstin: '', standing: { bread: 30, puff: 20 }, active: true },
      { id: 'c_corp', name: 'Sardar Hostel Mess', channel: 'corporate', outletType: 'hostel mess', routeId: null, locality: 'Vallabh Vidyanagar', terms: 'credit', creditDays: 15, creditLimit: 1000000, gstin: '24BBBBB0000B1Z4', standing: {}, pattern: { weekdays: [0, 2, 4] }, active: true }
    ],

    vendors: [
      { id: 'v_stock', name: 'Charotar Flour and Fats', kind: 'stock', town: 'Anand', gstin: '24CCCCC0000C1Z3', termsDays: 15, supplies: ['maida', 'fat', 'bag'], active: true },
      { id: 'v_power', name: 'Madhya Gujarat Power', kind: 'expense', town: 'Anand', gstin: '24DDDDD0000D1Z2', termsDays: 10, supplies: [], active: true },
      { id: 'v_staff', name: 'Staff salaries', kind: 'staff', town: 'Anand', gstin: '', termsDays: 0, supplies: [], active: true }
    ],

    /* E003 joins in February, so the January salary bill must leave him out */
    employees: [
      { id: 'E001', name: 'Nilesh Patel', dept: 'Management', designation: 'Owner', unitId: 'factory', doj: '2026-01-01', dol: null, salary: 5000000, phone: '', active: true },
      { id: 'E002', name: 'Falguni Shah', dept: 'Accounts', designation: 'Accountant', unitId: 'factory', doj: '2026-01-01', dol: null, salary: 2500000, phone: '', active: true },
      { id: 'E003', name: 'Imran Vohra', dept: 'Stores', designation: 'Storekeeper', unitId: 'factory', doj: '2026-02-10', dol: null, salary: 1800000, phone: '', active: true },
      { id: 'E004', name: 'Nisha Desai', dept: 'Stores', designation: 'Store manager', unitId: 'st_vvn', doj: '2026-01-01', dol: null, salary: 1600000, phone: '', active: true }
    ],

    expenseCategories: [
      { id: 'salaries', name: 'Salaries', mode: 'bill', system: 'salary', active: true },
      { id: 'electricity', name: 'Electricity', mode: 'bill', active: true },
      { id: 'travel', name: 'Travel and conveyance', mode: 'claim', active: true },
      { id: 'repairs', name: 'Repairs', mode: 'both', active: true },
      { id: 'cash_short', name: 'Store cash short / excess', mode: 'bill', system: 'cash_short', active: true }
    ],

    /* the same ids as the kernel's built-in personas; with four employees, three personas share E003 */
    users: [
      { id: 'u_owner', name: 'Nilesh Patel', role: 'owner', employeeId: 'E001' },
      { id: 'u_accounts', name: 'Falguni Shah', role: 'accounts', employeeId: 'E002' },
      { id: 'u_stores', name: 'Imran Vohra', role: 'stores', employeeId: 'E003' },
      { id: 'u_production', name: 'Imran Vohra', role: 'production', employeeId: 'E003' },
      { id: 'u_sales', name: 'Imran Vohra', role: 'sales', employeeId: 'E003' },
      { id: 'u_store_mgr', name: 'Nisha Desai', role: 'store_mgr', employeeId: 'E004' }
    ],

    /* warn: the figures that look wrong (SCOPE decision 18), the same values as the full company carries */
    limits: { poAutoApprove: 5000000, billTolerancePct: 2, returnsPct: 8, backDateDays: 3, nearExpiryDays: 1, dueSoonDays: 7,
      warn: { yieldLowPct: 80, yieldHighPct: 105, countAwayPct: 20, countMinValue: 50000, claimAbove: 500000, rateAwayPct: 25, dayEndAwayPct: 10 } },

    journeys: []
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = HB.config;
})(typeof window !== 'undefined' ? window : globalThis);
