/*
 * Customers and vendors (#/masters/parties). The two lists, one party with what the documents take from it and
 * its change history, and the form that adds or edits it. Which list a role sees is HB.session.partyKinds():
 * stores sees the vendors, sales the customers, and both read only. A party is a master: it is saved with
 * HB.engine.act('master') and switched off with act('setActive'), never deleted.
 * Every value shown is HB.data.lookup's and every rule is the engine's; the page holds the wording and the layout.
 */
(function (root) {
  'use strict';

  var HB = root.HB;
  if (!HB || !HB.router || !HB.ui || !HB.forms) return;
  var ui = HB.ui, h = ui.h, forms = HB.forms, fmt = HB.fmt;

  var ROUTE = '#/masters/parties';
  var NEW_ONLY = 'A change applies to new documents only. Documents already posted keep the values they were posted with.';
  var TERMS = [{ value: 'cash', label: 'Cash on delivery' }, { value: 'weekly', label: 'Weekly credit' }, { value: 'credit', label: 'Credit' }];
  var VENDOR_KINDS = [
    { value: 'stock', label: 'Materials and packing', one: 'Supplies materials or packing' },
    { value: 'expense', label: 'Services and expenses', one: 'Supplies services, billed as expenses' }
  ];
  /* the two lists: the name of the engine's entity, the words, and the hash parameter that opens one record */
  var KINDS = {
    customers: { id: 'customers', entity: 'customers', param: 'customer', label: 'Customers', one: 'customer', back: 'Back to customers' },
    vendors: { id: 'vendors', entity: 'vendors', param: 'vendor', label: 'Vendors', one: 'vendor', back: 'Back to vendors' }
  };

  function L() { return HB.data.lookup; }
  function blank(v) { return v === null || v === undefined || v === ''; }
  function item(id) { return L().item(id); }
  function daysText(v) { return fmt.qty(+v || 0, +v === 1 ? 'day' : 'days'); }
  function limitText(v) { return v > 0 ? fmt.inrFull(v) : 'None'; }
  function termsLabel(t) { var x = TERMS.filter(function (o) { return o.value === t; })[0]; return x ? x.label : String(t || ''); }
  function termsText(c) { return c.terms === 'credit' ? c.termsLabel + ', ' + daysText(c.creditDays) : c.termsLabel; }
  function vendorKind(kind) {
    var x = VENDOR_KINDS.filter(function (o) { return o.value === kind; })[0];
    return x ? x.label : (kind === 'staff' ? 'Salaries' : String(kind || ''));
  }
  function suppliesText(v) { return (v.supplies || []).map(function (id) { return item(id).name; }).join(', '); }
  function billTermsText(days) { return +days > 0 ? daysText(days) + ' from the date of the bill' : 'On the date of the bill'; }

  /** Why this role may look and not change, in the words of the list it is looking at. '' when it may change. */
  function lockReason(kind) {
    if (HB.session.can('master.edit').ok) return '';
    var roles = HB.session.rolesFor('master.edit').filter(function (r) { return r !== 'owner'; }).map(function (r) { return HB.session.roleLabel(r); });
    return kind.label + ' are changed by ' + roles.concat(['the Owner']).join(' or ');
  }
  function kindsSeen() { return HB.session.partyKinds().map(function (k) { return KINDS[k]; }).filter(Boolean); }
  function go(ctx, kind, id) { var p = {}; if (id) p[kind.param] = id; ctx.navigate(ROUTE, p); }

  /* ------------------------------------------------------------ change history */

  var FIELDS = {
    customers: [
      ['name', 'Name'], ['locality', 'Locality'],
      ['routeId', 'Route', function (v) { return L().name('route', v); }],
      ['terms', 'Terms', termsLabel], ['creditDays', 'Credit days', daysText],
      ['creditLimit', 'Credit limit', function (v) { return limitText(+v || 0); }], ['gstin', 'GSTIN']
    ],
    vendors: [['name', 'Name'], ['town', 'Town'], ['gstin', 'GSTIN'], ['termsDays', 'Payment terms', daysText]]
  };

  /** What one saved change did, line by line, from the record before and after as the engine holds them. */
  function changeLines(kind, before, after) {
    var out = [];
    FIELDS[kind.id].forEach(function (f) {
      var a = before[f[0]], b = after[f[0]];
      if (blank(a) && blank(b)) return;
      if (String(blank(a) ? '' : a) === String(blank(b) ? '' : b)) return;
      var text = f[2] || function (v) { return String(v); };
      out.push(f[1] + ': ' + (blank(a) ? 'none' : text(a)) + ' to ' + (blank(b) ? 'none' : text(b)));
    });
    if (kind.id === 'customers') {
      var was = before.standing || {}, now = after.standing || {};
      Object.keys(now).forEach(function (id) {
        var it = item(id);
        if (was[id] === undefined) out.push('Standing order: added ' + it.name + ', ' + fmt.qty(now[id], it.unit));
        else if (was[id] !== now[id]) out.push('Standing order: ' + it.name + ', ' + fmt.qty(was[id], it.unit) + ' to ' + fmt.qty(now[id], it.unit));
      });
      Object.keys(was).forEach(function (id) { if (now[id] === undefined) out.push('Standing order: removed ' + item(id).name); });
    } else {
      var had = before.supplies || [], has = after.supplies || [];
      has.forEach(function (id) { if (had.indexOf(id) === -1) out.push('Supplies: added ' + item(id).name); });
      had.forEach(function (id) { if (has.indexOf(id) === -1) out.push('Supplies: removed ' + item(id).name); });
    }
    return out.length ? out : ['Saved with nothing changed'];
  }

  /** The audit trail of one party as timeline events, oldest first. */
  function historyOf(kind, id) {
    var rows = HB.data.audit.list({ masters: true, type: kind.entity, docId: id, limit: 0 }).rows.slice().reverse();
    return rows.map(function (r) {
      if (r.action === 'setActive') {
        var off = r.after && r.after.active === false;
        return { actor: r.userName, role: r.roleLabel, at: r.at, action: off ? 'Deactivated' : 'Activated', icon: off ? 'ban' : 'check' };
      }
      return { actor: r.userName, role: r.roleLabel, at: r.at, action: r.before ? 'Changed' : 'Added', icon: r.before ? 'edit' : 'plus',
        note: r.before ? h('ul', { 'class': 'mk-docform__list' }, changeLines(kind, r.before, r.after).map(function (line) { return h('li', null, line); })) : null };
    });
  }

  /* ------------------------------------------------------------------ list */

  function statusOf(rec) { return rec.active ? 'ACTIVE' : 'INACTIVE'; }

  function customerList(st, ctx) {
    var kind = KINDS.customers;
    var rows = L().customers({ active: 'all' }).map(function (c) {
      return { id: c.id, name: c.name, locality: c.locality, channel: c.channel, channelLabel: c.channelLabel, routeName: c.routeName || '',
        terms: termsText(c), creditLimit: c.creditLimit, gstin: c.gstin, active: c.active, status: statusOf(c) };
    });
    return forms.docList({
      state: st.lists.customers, rows: rows, title: kind.label, subtitle: NEW_ONLY, statusKey: 'channel',
      groups: [{ id: 'retail', label: L().channelLabel('retail'), statuses: ['retail'] }, { id: 'corporate', label: L().channelLabel('corporate'), statuses: ['corporate'] }],
      search: ['name', 'locality', 'routeName', 'gstin'], searchPlaceholder: 'Search customers', sort: { key: 'name', dir: 'asc' },
      empty: 'No customer yet', rowClass: function (row) { return row.active ? '' : 'is-muted'; },
      columns: [
        { key: 'name', label: 'Customer', render: ui.cells.twoLine('locality', { maxWidth: 220 }) },
        { key: 'routeName', label: 'Route', maxWidth: 160 },
        { key: 'terms', label: 'Terms' },
        { key: 'creditLimit', label: 'Credit limit', align: 'right', format: limitText },
        /* the status before the GSTIN: at the smallest width the column that scrolls away is the GSTIN */
        { key: 'status', label: 'Status', render: ui.cells.status() },
        { key: 'gstin', label: 'GSTIN' }
      ],
      onOpen: function (row) { go(ctx, kind, row.id); },
      newLabel: 'New customer', newReason: lockReason(kind),
      onNew: function () { st.form = forms.draft({ kind: kind.id, values: {} }); ctx.rerender(); }
    });
  }

  function vendorList(st, ctx) {
    var kind = KINDS.vendors;
    var rows = L().vendors({ active: 'all' }).map(function (v) {
      /* what a vendor supplies: the materials it is ordered from, or the kind of bill it sends */
      return { id: v.id, name: v.name, town: v.town, kind: v.kind, supplies: v.kind === 'stock' ? (suppliesText(v) || 'Every material') : vendorKind(v.kind),
        termsDays: v.termsDays, gstin: v.gstin, active: v.active, status: statusOf(v) };
    });
    return forms.docList({
      state: st.lists.vendors, rows: rows, title: kind.label, subtitle: NEW_ONLY, statusKey: 'kind',
      groups: VENDOR_KINDS.map(function (k) { return { id: k.value, label: k.label, statuses: [k.value] }; }),
      search: ['name', 'town', 'supplies', 'gstin'], searchPlaceholder: 'Search vendors', sort: { key: 'name', dir: 'asc' },
      empty: 'No vendor yet', rowClass: function (row) { return row.active ? '' : 'is-muted'; },
      columns: [
        { key: 'name', label: 'Vendor', render: ui.cells.twoLine('town', { maxWidth: 220 }) },
        { key: 'supplies', label: 'Supplies', maxWidth: 200 },
        { key: 'termsDays', label: 'Payment terms', align: 'right', format: daysText, title: 'Days from the date of a bill to its due date' },
        { key: 'status', label: 'Status', render: ui.cells.status() },
        { key: 'gstin', label: 'GSTIN' }
      ],
      onOpen: function (row) { go(ctx, kind, row.id); },
      newLabel: 'New vendor', newReason: lockReason(kind),
      onNew: function () { st.form = forms.draft({ kind: kind.id, values: {} }); ctx.rerender(); }
    });
  }

  function list(rootEl, ctx, seen) {
    var st = ctx.state;
    st.lists = st.lists || { customers: {}, vendors: {} };
    if (!seen.length) { rootEl.appendChild(ui.emptyState('No customers or vendors for this role', null, { icon: 'users' })); return; }
    var kind = seen.filter(function (k) { return k.id === st.tab; })[0] || seen[0];
    st.tab = kind.id;
    if (seen.length > 1) {
      rootEl.appendChild(ui.tabs({
        ariaLabel: 'Customers or vendors', value: kind.id,
        items: seen.map(function (k) { return { id: k.id, label: k.label, count: (k.id === 'customers' ? L().customers({ active: 'all' }) : L().vendors({ active: 'all' })).length }; }),
        onChange: function (id) { st.tab = id; ctx.rerender(); }
      }));
    }
    rootEl.appendChild(kind.id === 'customers' ? customerList(st, ctx) : vendorList(st, ctx));
  }

  /* ------------------------------------------------------------------ view */

  function startEdit(ctx, kind, rec) {
    var draft;
    if (kind.id === 'customers') {
      draft = { kind: kind.id, values: { id: rec.id, channel: rec.channel, name: rec.name, locality: rec.locality || null, routeId: rec.routeId, terms: rec.terms,
        creditDays: rec.creditDays || null, creditLimit: rec.creditLimit || null, gstin: rec.gstin || null },
        lines: Object.keys(rec.standing).map(function (id) { return { itemId: id, qty: rec.standing[id] }; }) };
    } else {
      draft = { kind: kind.id, values: { id: rec.id, kind: rec.kind, name: rec.name, town: rec.town || null, gstin: rec.gstin || null, termsDays: rec.termsDays || null },
        lines: rec.supplies.map(function (id) { return { itemId: id }; }) };
    }
    ctx.state.form = forms.draft(draft);
    ctx.rerender();
  }

  /** Deactivate or activate, after a question. The engine decides; a refusal is shown as it words it. */
  function toggle(kind, rec) {
    var off = rec.active;
    ui.confirm({
      title: (off ? 'Deactivate ' : 'Activate ') + rec.name + '?', confirmLabel: off ? 'Deactivate' : 'Activate', tone: off ? 'danger' : 'primary',
      message: off ? 'New documents no longer offer this ' + kind.one + '. Documents already posted and what is outstanding stay as they are, and it can be activated again.'
        : 'New documents offer this ' + kind.one + ' again.'
    }).then(function (r) {
      if (!r.ok) return;
      var res = HB.engine.act('setActive', { entity: kind.entity, id: rec.id, active: !off });
      if (!res.ok) { forms.fail(res, rec.name + ': not done'); return; }
      ui.toast(off ? 'New documents no longer offer it. Posted documents keep it.' : 'New documents offer it again.',
        { title: rec.name + (off ? ' deactivated' : ' activated'), tone: 'good', duration: 6500 });
    });
  }

  function standingCard(c) {
    var rows = Object.keys(c.standing).map(function (id) { var it = item(id); return { name: it.display, qty: c.standing[id], unit: it.unit }; });
    return { title: 'Standing order', flush: true, subtitle: 'What the outlet takes on a usual day. It prefills the outlet on the dispatch sheet of its route.',
      body: ui.table({ dense: true, rows: rows, empty: 'No standing order: the outlet starts empty on the dispatch sheet',
        columns: [{ key: 'name', label: 'Product' }, { key: 'qty', label: 'A day', format: 'qty' }] }) };
  }

  function suppliesCard(v) {
    var rows = v.supplies.map(function (id) { var it = item(id); return { name: it.name, kindLabel: it.kindLabel, unit: it.unit }; });
    return { title: 'What it supplies', flush: true, subtitle: 'A purchase order for this vendor offers these items.',
      body: ui.table({ dense: true, rows: rows, empty: 'Nothing listed: a purchase order for this vendor offers every material',
        columns: [{ key: 'name', label: 'Item' }, { key: 'kindLabel', label: 'Kind' }, { key: 'unit', label: 'Unit' }] }) };
  }

  /** The hash names a party that is not there, or one of a list this role does not see: say which, and offer its own list. */
  function missing(rootEl, ctx, kind, id, seen) {
    var own = seen.indexOf(kind) !== -1 ? kind : (seen[0] || kind);
    rootEl.appendChild(ui.emptyState(
      own === kind ? 'No such ' + kind.one : kind.label + ' are not for this role',
      own === kind ? String(id) + ' is not among the ' + kind.label.toLowerCase() + '.' : ctx.user.roleLabel + ' sees the ' + own.label.toLowerCase() + ' only.',
      { icon: 'users', action: ui.button({ label: own.back, icon: 'arrow-left', onClick: function () { go(ctx, own); } }) }));
  }

  function view(rootEl, ctx, kind, id, seen) {
    var customer = kind.id === 'customers';
    var rec = customer ? L().customer(id) : L().vendor(id);
    if (seen.indexOf(kind) === -1 || rec.unknown) { missing(rootEl, ctx, kind, id, seen); return; }
    var locked = lockReason(kind);
    var chk = HB.engine.check('setActive', { entity: kind.entity, id: rec.id, active: !rec.active });
    var audit = HB.session.canOpen('sys-audit');   /* the audit trail is for the roles that have its screen */
    ctx.state.tab = kind.id;
    rootEl.appendChild(forms.docView({
      title: rec.name, status: statusOf(rec), onBack: function () { go(ctx, kind); }, backLabel: kind.back,
      subtitle: customer ? [rec.channelLabel, rec.locality].filter(Boolean).join(', ') : [vendorKind(rec.kind), rec.town].filter(Boolean).join(', '),
      notice: { tone: 'info', title: 'A change applies to new documents only',
        text: customer ? 'Invoices already posted keep the due date they were posted with.' : 'Bills already posted keep the due date they were posted with.' },
      meta: customer ? [
        ['Channel', rec.channelLabel], ['Outlet type', rec.outletType || null], ['Locality', rec.locality || null],
        ['Route', rec.channel === 'retail' ? rec.routeName : null], ['Terms', rec.termsLabel],
        ['Credit days', rec.terms === 'credit' ? daysText(rec.creditDays) : null],
        ['Credit limit', limitText(rec.creditLimit)], ['GSTIN', rec.gstin || 'Not given']
      ] : [
        ['Kind', vendorKind(rec.kind)], ['Town', rec.town || null], ['GSTIN', rec.gstin || 'Not given'],
        ['Payment terms', billTermsText(rec.termsDays)]
      ],
      sections: [
        customer && rec.channel === 'retail' ? standingCard(rec) : null,
        !customer && rec.kind === 'stock' ? suppliesCard(rec) : null,
        audit ? null : { title: 'History', body: h('div', { 'class': 'mk-muted' }, 'Every change is kept, with who made it and when. The Owner and ' + HB.session.roleLabel('accounts') + ' see that history here.') }
      ],
      timeline: audit ? historyOf(kind, rec.id) : null,
      actions: [
        { label: 'Edit the ' + kind.one, icon: 'edit', variant: 'primary', reason: locked, onClick: function () { startEdit(ctx, kind, rec); } },
        { label: rec.active ? 'Deactivate' : 'Activate', icon: rec.active ? 'ban' : 'check', danger: rec.active,
          reason: locked || (chk.ok ? '' : chk.error.message), onClick: function () { toggle(kind, rec); } }
      ]
    }));
  }

  /* ------------------------------------------------------------------ form */

  function once(it, row, rows) { return rows.every(function (x) { return x === row || x.itemId !== it.id; }); }   /* an item goes on one line */

  /** draft -> the record of docs/API.md 2.10 (entity customers). The standing order of an outlet is sent whole. */
  function customerRecord(d, f) {
    var v = d.values, retail = v.channel === 'retail', r = {};
    if (v.id) r.id = v.id;
    r.channel = v.channel || null;
    r.name = v.name || '';
    r.locality = v.locality || '';
    r.routeId = retail ? (v.routeId || null) : null;
    r.terms = v.terms || null;
    r.creditDays = v.terms === 'credit' ? (v.creditDays || 0) : 0;   /* only credit terms count days */
    r.creditLimit = v.creditLimit || 0;
    r.gstin = String(v.gstin || '').toUpperCase();
    if (retail) {
      r.standing = {};
      f.lines().forEach(function (l) { r.standing[l.itemId || ''] = l.qty || 0; });   /* a quantity with no product: the engine refuses it */
    }
    return r;
  }

  /** draft -> the record of docs/API.md 2.10 (entity vendors). */
  function vendorRecord(d, f) {
    var v = d.values, r = {};
    if (v.id) r.id = v.id;
    r.kind = v.kind || null;
    r.name = v.name || '';
    r.town = v.town || '';
    r.gstin = String(v.gstin || '').toUpperCase();
    r.termsDays = v.termsDays || 0;
    if (v.kind === 'stock') r.supplies = f.lines().map(function (l) { return l.itemId; }).filter(Boolean);
    return r;
  }

  function panel(text) {
    return function () {
      return [
        ui.callout('info', 'A change applies to new documents only', text),
        forms.teaser({ title: 'GSTIN verification', tier: 'iNeo', text: 'The GSTIN is checked against the GST portal and the legal name is filled in as it is typed.' })
      ];
    };
  }

  /** A refusal about the standing order belongs at its line: the one with a quantity and no product, or the one the engine names. */
  function atLine(res, f) {
    if (!res || res.ok || !res.error || res.error.field !== 'standing') return res;
    var lines = f.lines(), at = -1, key = 'itemId', i, k, e = {};
    for (i = 0; i < lines.length && at === -1; i++) if (!lines[i].itemId) at = i;
    for (i = 0; i < lines.length && at === -1; i++) if (String(res.error.message).indexOf(item(lines[i].itemId).name + ':') === 0) { at = i; key = 'qty'; }
    if (at === -1) return res;
    for (k in res.error) if (Object.prototype.hasOwnProperty.call(res.error, k)) e[k] = res.error[k];
    e.field = 'lines[' + at + '].' + key;
    return { ok: false, error: e };
  }

  function form(rootEl, ctx, kind) {
    var st = ctx.state, draft = st.form;
    var customer = kind.id === 'customers', v = draft.values;
    var old = v.id ? (customer ? L().customer(v.id) : L().vendor(v.id)) : null;
    var redraw = function () { ctx.rerender(); };   /* the channel or the kind decides whether the form has lines */
    var fields, lines = null;

    if (customer) {
      fields = [
        old ? { key: 'channel', label: 'Channel', type: 'static', text: function () { return old.channelLabel; }, hint: 'The channel of a customer cannot be changed' }
          : { key: 'channel', label: 'Channel', type: 'select', required: true, onChange: redraw,
            options: [{ value: 'retail', label: L().channelLabel('retail') }, { value: 'corporate', label: L().channelLabel('corporate') }] },
        { key: 'name', label: 'Name', required: true, span: 2, maxLength: 80 },
        { key: 'locality', label: 'Locality', optional: true, maxLength: 60 },
        { key: 'routeId', label: 'Route', type: 'select', required: true, show: function (d) { return d.values.channel === 'retail'; },
          options: function () { return L().routes().map(function (r) { return { value: r.id, label: r.name }; }); },
          hint: 'An outlet that joins a route becomes its last stop' },
        { key: 'terms', label: 'Terms', type: 'select', required: true, options: TERMS, rebuild: true, hint: 'When an invoice falls due' },
        { key: 'creditDays', label: 'Credit days', type: 'int', unit: 'days', show: function (d) { return d.values.terms === 'credit'; }, hint: 'Days from the invoice to its due date' },
        { key: 'creditLimit', label: 'Credit limit', type: 'amount', hint: 'Leave empty for none. An invoice that takes the customer above it is posted with a warning' },
        { key: 'gstin', label: 'GSTIN', mono: true, maxLength: 15, optional: true, hint: '15 characters, if the customer has one' }
      ];
      if (v.channel === 'retail') {
        lines = { title: 'Standing order', subtitle: 'What the outlet takes on a usual day. It prefills the outlet on the dispatch sheet of its route.',
          addLabel: 'Add product', empty: 'No standing order: the outlet starts empty on the dispatch sheet',
          columns: [
            { key: 'itemId', label: 'Product', type: 'item', kind: 'fg', required: true, width: '60%', filter: once },
            { key: 'qty', label: 'A day', type: 'int', required: true, unit: function (row) { return row.itemId ? item(row.itemId).unit : ''; } }
          ] };
      }
    } else {
      fields = [
        old ? { key: 'kind', label: 'Kind', type: 'static', text: function () { return vendorKind(old.kind); }, hint: 'The kind of a vendor cannot be changed' }
          : { key: 'kind', label: 'Kind', type: 'select', required: true, onChange: redraw,
            options: VENDOR_KINDS.map(function (k) { return { value: k.value, label: k.one }; }) },
        { key: 'name', label: 'Name', required: true, span: 2, maxLength: 80 },
        { key: 'town', label: 'Town', optional: true, maxLength: 40 },
        { key: 'gstin', label: 'GSTIN', mono: true, maxLength: 15, optional: true, hint: '15 characters, if the vendor has one' },
        { key: 'termsDays', label: 'Payment terms', type: 'int', unit: 'days', hint: 'Days from the date of a bill to its due date' }
      ];
      if (v.kind === 'stock') {
        lines = { title: 'What it supplies', subtitle: 'A purchase order for this vendor offers these items. With none listed it offers every material.',
          addLabel: 'Add item', empty: 'Nothing listed yet',
          columns: [
            { key: 'itemId', label: 'Item', type: 'item', kind: ['rm', 'pk'], required: true, width: '60%', filter: once },
            { key: 'unit', label: 'Unit', type: 'computed', value: function (row) { return row.itemId ? item(row.itemId).unit : null; } }
          ] };
      }
    }

    var record = customer ? customerRecord : vendorRecord;
    rootEl.appendChild(forms.docForm({
      title: old ? 'Edit ' + old.name : 'New ' + kind.one, state: draft, backLabel: old ? 'Back to the ' + kind.one : kind.back, submitLabel: 'Save ' + kind.one,
      chips: ui.statusChip('DRAFT', { label: 'Not saved yet' }),
      submitReason: lockReason(kind),
      fields: fields, lines: lines,
      panel: panel(customer ? 'The next invoice takes the terms and the limit as they stand when it is posted, and the next dispatch sheet takes the standing order. Invoices already posted keep their due date. The change goes into the history of the customer.'
        : 'The next bill takes the payment terms as they stand when it is posted. Bills already posted keep their due date. The change goes into the history of the vendor.'),
      onPreview: function (d, f) { return atLine(HB.engine.check('master', { entity: kind.entity, record: record(d, f) }), f); },
      onSubmit: function (d, f) {
        var res = HB.engine.act('master', { entity: kind.entity, record: record(d, f) });
        if (!res.ok) return atLine(res, f);         /* the form shows the refusal at the field or the line it names */
        st.form = null;
        ui.toast(res.before ? changeLines(kind, res.before, res.record).join('. ') + '. New documents take it from now.' : 'New documents can use this ' + kind.one + ' from now.',
          { title: res.record.name + (res.before ? ' saved' : ' added'), tone: 'good', duration: 6500 });
        go(ctx, kind, res.record.id);
        return res;
      },
      onCancel: function () { st.form = null; ctx.rerender(); }
    }));
  }

  /* ------------------------------------------------------------------ page */

  HB.router.register({
    id: 'masters-parties', route: ROUTE, group: 'Masters', title: 'Customers and vendors', navLabel: 'Customers and vendors', filters: [],
    subtitle: 'Terms and standing orders',
    render: function (rootEl, ctx) {
      var seen = kindsSeen(), draft = ctx.state.form;
      /* a party being added or edited survives redraws and visits elsewhere; a role that does not see that list gets its own */
      var asked = ctx.params.customer || ctx.params.vendor || null;   /* a link to another party opens that party, and the draft waits */
      if (draft && KINDS[draft.kind] && seen.indexOf(KINDS[draft.kind]) !== -1 && (!asked || asked === draft.values.id)) return form(rootEl, ctx, KINDS[draft.kind]);
      if (ctx.params.customer) return view(rootEl, ctx, KINDS.customers, ctx.params.customer, seen);
      if (ctx.params.vendor) return view(rootEl, ctx, KINDS.vendors, ctx.params.vendor, seen);
      list(rootEl, ctx, seen);
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
