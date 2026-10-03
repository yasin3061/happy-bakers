/*
 * Browser half of the page harness (docs/PAGES.md, "Testing a page without a human"). Loaded by the scratch page
 * that tools/harness/run.js builds, after js/app.js. A steps file calls HBT.run(async function (t) { ... }) and
 * drives the real app through the DOM, the way a user would; the results are written into the page as JSON,
 * where run.js reads them from Chrome's --dump-dom.
 */
(function (root) {
  'use strict';
  var doc = root.document;
  var out = root.__hbt || (root.__hbt = { checks: [], notes: [], errors: [] });   /* errors are trapped from the first script on */

  function wait(ms) { return new Promise(function (r) { root.setTimeout(r, ms); }); }
  function all(sel, scope) { return Array.prototype.slice.call((scope || doc).querySelectorAll(sel)); }
  function shown(el) { return !!el && !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length); }
  function clean(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }

  /** An element: itself, a CSS selector, or (with no match as a selector) the visible button, link, tab or option with that text. */
  function find(target, scope) {
    if (target && target.nodeType === 1) return target;
    var el = null;
    try { el = all(String(target), scope).filter(shown)[0] || null; } catch (e) { el = null; }
    if (el) return el;
    var want = clean(target);
    var list = all('button, a, [role="tab"], [role="option"], .mk-combo__opt', scope).filter(shown);
    return list.filter(function (x) { return clean(x.textContent) === want; })[0] ||
      list.filter(function (x) { return clean(x.textContent).indexOf(want) !== -1; }).sort(function (a, b) { return a.textContent.length - b.textContent.length; })[0] || null;
  }
  function need(target, scope) {
    var el = find(target, scope);
    if (!el) throw new Error('harness: nothing on screen matches "' + target + '"');
    return el;
  }
  function setValue(el, value) {
    var proto = el.tagName === 'TEXTAREA' ? root.HTMLTextAreaElement.prototype : (el.tagName === 'SELECT' ? root.HTMLSelectElement.prototype : root.HTMLInputElement.prototype);
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  }
  function fire(el, type) { el.dispatchEvent(new root.Event(type, { bubbles: true })); }

  var t = {
    wait: wait,
    /** Let the router's redraw (60 ms) and a form's preview (90 ms) run. */
    settle: function () { return wait(220); },
    find: find,
    all: all,
    /** go('#/buy/orders') or go('#/doc/PO-U-0001') */
    go: function (hash) { root.location.hash = hash; return t.settle(); },
    /** as('u_stores'): switch persona, as the top-right menu does */
    as: function (userId) { root.HB.session.set(userId); return t.settle(); },
    click: function (target, scope) { need(target, scope).click(); return t.settle(); },
    /** type('[data-fkey="l:0:qty"]', '500'): focus, replace the text, fire input and change, leave the field */
    type: function (target, text) {
      var el = need(target);
      el.focus(); setValue(el, String(text)); fire(el, 'input'); fire(el, 'change'); el.blur();
      return t.settle();
    },
    /** pick('[data-fkey="f:vendorId"]', 'Godhumvan'): type into a type-ahead and take the first row of its list */
    pick: function (target, text) {
      var el = need(target);
      el.focus(); setValue(el, String(text)); fire(el, 'input');
      var opt = all('.mk-combo__list .mk-combo__opt')[0];
      if (!opt) throw new Error('harness: the list of "' + target + '" has no row for "' + text + '"');
      opt.dispatchEvent(new root.MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      el.blur();
      return t.settle();
    },
    /** A field of a docForm by key, a cell of its grid by line and column */
    field: function (key) { return '[data-fkey="f:' + key + '"]'; },
    cell: function (line, key) { return '[data-fkey="l:' + line + ':' + key + '"]'; },
    /** Visible text of the page (or of one element), spaces collapsed */
    text: function (target) { var el = target ? find(target) : doc.getElementById('mk-page'); return el ? clean(el.innerText || el.textContent) : ''; },
    /** Text of the toasts now on screen, newest last */
    toasts: function () { return all('#mk-toasts .mk-toast').map(function (el) { return clean(el.textContent); }); },
    hash: function () { return root.location.hash; },
    ok: function (cond, label) { out.checks.push({ ok: !!cond, label: label }); return !!cond; },
    eq: function (actual, expected, label) {
      var same = JSON.stringify(actual) === JSON.stringify(expected);
      out.checks.push({ ok: same, label: label, detail: same ? '' : 'got ' + JSON.stringify(actual) + ', expected ' + JSON.stringify(expected) });
      return same;
    },
    /** has('Approved as submitted', 'the outcome shows before posting') - the page text contains it */
    has: function (needle, label, target) {
      var text = t.text(target), yes = text.indexOf(needle) !== -1;
      out.checks.push({ ok: yes, label: label || 'shows "' + needle + '"', detail: yes ? '' : 'page says: ' + text.slice(0, 300) });
      return yes;
    },
    /** note('toast', text): printed with the results, not a check */
    note: function (label, value) { out.notes.push({ label: label, value: value }); }
  };

  function finish() {
    var pre = doc.createElement('pre');
    pre.id = 'hbt-out';
    pre.textContent = JSON.stringify(out);
    doc.body.appendChild(pre);
  }

  root.HBT = {
    t: t,
    run: function (steps) {
      function go() {
        wait(300).then(function () { return steps(t); })
          .catch(function (e) { out.errors.push('steps threw: ' + (e && e.stack ? e.stack : e)); })
          .then(finish);
      }
      if (doc.readyState === 'complete') go(); else root.addEventListener('load', go);
    }
  };
})(window);
