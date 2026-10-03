/*
 * People (#/people). The employee directory: add, edit, deactivate; headcount and monthly salary cost by department
 * and by location. An employee is a master, not a document: it is saved with HB.engine.act('master') and
 * deactivated with HB.engine.act('setActive'), like a recipe (js/pages/make-recipes.js).
 * The salary is shown where the selector returns it and nowhere else. Attendance, leave and tasks are not in this sample.
 */
(function (root) {
  'use strict';

  var HB = root.HB;
  if (!HB || !HB.router || !HB.ui || !HB.forms) return;
  var ui = HB.ui, h = ui.h, forms = HB.forms, fmt = HB.fmt;

  var ENTITY = 'employees', RIGHT = 'employee.edit';

  function day(iso) { return ui.format('date', iso); }
  function employee(id) { return HB.data.people.list().filter(function (e) { return e.id === id; })[0] || null; }

  /* --------------------------------------------- what a change moves */

  /** Headcount and salary cost as the selector shows them now against before the engine acted. */
  function movedText(before) {
    var now = HB.data.people.headcount(), parts = [];
    if (before.headcount !== now.headcount) parts.push('On the rolls: ' + fmt.num(before.headcount) + ' to ' + fmt.num(now.headcount) + '.');
    if (now.salary !== undefined && before.salary !== now.salary) parts.push('Monthly salary cost: ' + fmt.inr2(before.salary) + ' to ' + fmt.inr2(now.salary) + '.');
    return parts.length ? parts.join(' ') : 'On the rolls: ' + fmt.num(now.headcount) + ', as before.';
  }

  /* ------------------------------------------------------------------ list */

  /** Where an employee stands: deactivated, on the rolls, or outside the dates of joining and leaving. */
  function standing(row) {
    if (!row.active) return ui.statusChip('INACTIVE', { label: 'Deactivated' });
    if (row.onRolls) return ui.statusChip('ACTIVE', { label: 'On the rolls' });
    return ui.chip(row.dol ? 'Left on ' + day(row.dol) : 'Joins on ' + day(row.doj), 'neutral');
  }

  /** The record of an employee as the engine takes it, with another date of leaving. The salary goes with it only where the selector gave it. */
  function withLeaving(row, dol) {
    var r = { id: row.id, name: row.name, dept: row.dept || '', designation: row.designation || '', unitId: row.unitId, doj: row.doj, dol: dol, phone: row.phone || '' };
    if (row.salary !== undefined) r.salary = row.salary;
    return r;
  }

  /**
   * The date of leaving that goes with a change of status. Headcount and the salary bill count an employee by the
   * dates of joining and leaving, so the status moves the date with it: deactivating someone on the rolls sets the
   * last day counted to the day before the business date; reactivating someone who has left clears it. Undefined
   * where the date stays as it is (not on the rolls anyway; joined today, so no earlier day to leave on).
   */
  function leavingFor(row, active) {
    var eve = HB.dates.addDays(HB.calendar.today, -1);
    if (!active) return row.onRolls && eve >= row.doj ? eve : undefined;
    return row.dol && row.dol < HB.calendar.today ? null : undefined;
  }

  /** Deactivate or reactivate through the engine; the toast says what the selector shows afterwards. */
  function setActive(row, active) {
    var before = HB.data.people.headcount(), dol = leavingFor(row, active), res;
    if (dol !== undefined) {
      res = HB.engine.act('master', { entity: ENTITY, record: withLeaving(row, dol) });
      if (!res.ok) { forms.fail(res, row.name + ': not changed'); return; }
    }
    res = HB.engine.act('setActive', { entity: ENTITY, id: row.id, active: active });   /* the store change redraws the list */
    if (!res.ok) { forms.fail(res, row.name + ': not changed'); return; }
    var now = employee(row.id) || row;
    ui.toast(movedText(before) + (dol ? ' The last day counted is ' + day(dol) + '.' : '') +
      (active && !now.onRolls ? ' Not on the rolls: the dates of joining and leaving decide that.' : '') +
      (!active && now.onRolls ? ' Still on the rolls today: enter a date of leaving to take the employee off.' : ''),
      { title: row.name + (active ? ' reactivated' : ' deactivated'), tone: 'info', duration: 8000 });
  }

  function toggle(row, may) {
    return ui.button({
      label: row.active ? 'Deactivate' : 'Reactivate', icon: may.ok ? (row.active ? 'ban' : 'undo') : 'lock', size: 'sm', variant: 'ghost',
      disabledReason: may.ok ? '' : may.reason,
      onClick: function () {
        if (!row.active) { setActive(row, true); return; }
        var last = leavingFor(row, false);
        ui.confirm({
          title: 'Deactivate ' + row.name + '?', confirmLabel: 'Deactivate', cancelLabel: 'Keep active', tone: 'danger',
          message: 'The employee stays in the directory, marked as deactivated, and is never deleted. ' +
            (last ? 'The date of leaving is set to ' + day(last) + ', the last day counted: headcount and the next salary bill leave the employee out.'
              : 'Headcount and the salary bill follow the dates of joining and leaving.')
        }).then(function (r) { if (r.ok) setActive(row, false); });
      }
    });
  }

  function breakdown(title, subtitle, key, label, rows, hc, paid) {
    var footer = { headcount: hc.headcount };
    footer[key] = 'Total';
    if (paid) footer.salary = hc.salary;
    return ui.card({
      title: title, subtitle: subtitle, flush: true,
      body: ui.table({ dense: true, rows: rows, footer: footer, empty: 'Nobody is on the rolls',
        columns: [
          { key: key, label: label, maxWidth: 240 },
          { key: 'headcount', label: 'Employees', format: 'num' },
          paid ? { key: 'salary', label: 'Monthly salary cost', format: 'inr2' } : null
        ] })
    });
  }

  function open(st, ctx, row) {
    var values = row ? { id: row.id, name: row.name, dept: row.dept, designation: row.designation, unitId: row.unitId, doj: row.doj, dol: row.dol || null, phone: row.phone } : {};
    if (row && row.salary !== undefined) values.salary = row.salary;
    st.form = forms.draft({ values: values });
    ctx.rerender();
  }

  function list(rootEl, ctx) {
    var st = ctx.state, may = HB.session.can(RIGHT);
    var rows = HB.data.people.list(), hc = HB.data.people.headcount();
    var paid = hc.salary !== undefined;   /* the selector leaves the salary out for a role that may not see it */
    var asOf = 'On ' + day(hc.asOf);
    st.list = st.list || {};

    ui.append(rootEl,
      ui.kpiRow([
        { label: 'On the rolls', value: fmt.num(hc.headcount), sub: asOf },
        paid ? { label: 'Monthly salary cost', value: fmt.inr(hc.salary), sub: 'of those on the rolls' } : null
      ]),
      ui.grid(2, [
        breakdown('By department', asOf, 'dept', 'Department', hc.byDept, hc, paid),
        breakdown('By location', asOf, 'unitName', 'Location', hc.byUnit, hc, paid)
      ], { start: true }),
      forms.docList({
        state: st.list, rows: rows, title: 'Employee directory', pageSize: 20,
        subtitle: 'Headcount and the salary bill count an employee from the date of joining to the date of leaving.',
        groups: [
          { id: 'on', label: 'On the rolls', test: function (r) { return r.onRolls; } },
          { id: 'off', label: 'Not on the rolls', test: function (r) { return !r.onRolls; } },
          { id: 'inactive', label: 'Deactivated', test: function (r) { return !r.active; } }
        ],
        search: ['id', 'name', 'dept', 'designation', 'unitName', 'phone'], searchPlaceholder: 'Search employees',
        sort: { key: 'name', dir: 'asc' }, empty: 'No employee in the directory',
        onOpen: function (row) { open(st, ctx, row); },
        columns: [
          { key: 'name', label: 'Employee', render: ui.cells.twoLine('designation', { maxWidth: 190 }) },
          { key: 'dept', label: 'Department and location', render: ui.cells.twoLine('unitName', { maxWidth: 150 }) },
          /* the date of joining with the contact under it: one column less, so that the status is in sight at 1024px */
          { key: 'doj', label: 'Joined, contact', render: function (v, row) {
            return h('div', null, h('div', null, day(v)), h('div', { 'class': 'mk-xs mk-muted' }, row.phone || ''));
          } },
          paid ? { key: 'salary', label: 'Monthly salary', format: 'inr2' } : null,
          { key: 'active', label: 'Status', render: function (v, row) { return standing(row); },
            sortValue: function (row) { return !row.active ? 2 : (row.onRolls ? 0 : 1); } },
          { key: 'act', label: '', align: 'right', sortable: false, render: function (v, row) { return toggle(row, may); } }
        ],
        newLabel: 'Add employee', newReason: may.ok ? '' : may.reason,
        onNew: function () { open(st, ctx, null); }
      }),
      forms.teaser({ title: 'Attendance and leave; tasks', tier: 'Neo ERP',
        text: 'Attendance, leave and tasks are part of Neo ERP. They are not shown in this sample.' }));
  }

  /* ------------------------------------------------------------------ form */

  /** draft -> the record of docs/API.md 2.10. Only the fields of the form are sent: the rest of the record stays. */
  function record(draft) {
    var v = draft.values;
    var r = { name: v.name, dept: v.dept || '', designation: v.designation || '', unitId: v.unitId, doj: v.doj, dol: v.dol || null, phone: v.phone || '' };
    if (v.id) r.id = v.id;
    if (HB.session.canSeeSalaries()) r.salary = v.salary;
    return r;
  }

  /** A text box that offers the departments already in the directory and takes a new one as well. */
  function deptControl(draft, formEl) {
    var id = ui.uid('dept'), seen = {}, names = [];
    HB.data.people.list().forEach(function (e) { if (e.dept && !seen[e.dept]) { seen[e.dept] = true; names.push(e.dept); } });
    var input = ui.form.input({ value: draft.values.dept, maxLength: 40, placeholder: 'Choose or type a department',
      onInput: function (v) {
        draft.values.dept = v === '' ? null : v;
        draft.touched.dept = true;
        draft.dirty = true;
        formEl.refresh();
      } });
    input.setAttribute('list', id);
    input.setAttribute('data-fkey', 'f:dept');
    return h('div', null, input, h('datalist', { id: id }, names.sort().map(function (n) { return h('option', { value: n }); })));
  }

  function form(rootEl, ctx) {
    var st = ctx.state, draft = st.form, may = HB.session.can(RIGHT);
    var old = draft.values.id ? employee(draft.values.id) : null;
    rootEl.appendChild(forms.docForm({
      title: old ? 'Edit ' + old.name : 'Add an employee', subtitle: old ? old.id : '', state: draft,
      backLabel: 'Back to the directory', submitLabel: old ? 'Save changes' : 'Add employee',
      chips: [ui.statusChip('DRAFT', { label: 'Not saved yet' })].concat(old ? [standing(old)] : []),
      submitReason: may.ok ? '' : may.reason,
      fields: [
        { key: 'name', label: 'Name', required: true, span: 2, maxLength: 60 },
        { key: 'designation', label: 'Designation', span: 2, maxLength: 60 },
        { key: 'dept', label: 'Department', type: 'custom', control: deptControl },
        { key: 'unitId', label: 'Location', type: 'select', required: true, placeholder: 'Choose a location',
          options: function () { return HB.data.lookup.units({ all: true }).map(function (u) { return { value: u.id, label: u.name }; }); } },
        { key: 'doj', label: 'Date of joining', type: 'date', required: true, min: null, max: null },
        { key: 'dol', label: 'Date of leaving', type: 'date', optional: true, value: null, min: null, max: null,
          hint: 'On the rolls, and in the salary bill, up to this day' },
        { key: 'phone', label: 'Contact', maxLength: 20, placeholder: 'Phone number' },
        { key: 'salary', label: 'Monthly salary', type: 'amount', show: function () { return HB.session.canSeeSalaries(); },
          hint: 'Seen by the Owner and accounts only' }
      ],
      panel: function () {
        return ui.callout('info', 'A change applies from the moment it is saved',
          'Headcount and the next salary bill follow the directory as it stands. Salary bills already raised keep the figures they were raised with. The change is written to the audit log.');
      },
      onPreview: function (d) { return HB.engine.check('master', { entity: ENTITY, record: record(d) }); },
      onSubmit: function (d) {
        var before = HB.data.people.headcount();    /* read the selector, act, read it again */
        var res = HB.engine.act('master', { entity: ENTITY, record: record(d) });
        if (!res.ok) return res;                    /* the form shows the refusal at the field it names */
        st.form = null;
        ui.toast(movedText(before), { title: res.record.name + (old ? ' saved' : ' added to the directory'), tone: 'good', duration: 6500 });
        return res;
      },
      onCancel: function () { st.form = null; ctx.rerender(); }
    }));
  }

  /* ------------------------------------------------------------------ page */

  HB.router.register({
    id: 'people', route: '#/people', group: 'People', title: 'People', filters: [],
    subtitle: 'Directory, headcount and salary cost',
    render: function (rootEl, ctx) {
      if (ctx.state.form) return form(rootEl, ctx);    /* an employee being added or edited: it survives redraws and visits elsewhere */
      list(rootEl, ctx);
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
