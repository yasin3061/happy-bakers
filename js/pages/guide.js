/*
 * Try this (#/guide). The journeys of HB.data.guide.journeys() (SPEC 8.1) as cards. A step ticks itself when the
 * user's log holds the entry it asks for: the page only draws what the selector returns.
 * Each step names the persona the guide suggests, with a button that switches to it (HB.session.set) and a link to
 * the screen. The persona is a suggestion, not a condition: the Owner can do every step.
 */
(function (root) {
  'use strict';

  var HB = root.HB;
  if (!HB || !HB.router || !HB.ui || !HB.forms) return;
  var ui = HB.ui, h = ui.h, fmt = HB.fmt;

  function of(n, total, one, many) { return fmt.num(n) + ' of ' + fmt.num(total) + ' ' + (total === 1 ? one : many); }
  function pageOf(route) {
    var base = String(route || '').split('?')[0];
    return HB.router.pages().filter(function (p) { return p.route === base; })[0] || null;
  }
  /** The persona of a role, as the top bar lists them. */
  function personaOf(role) { return HB.session.users.filter(function (u) { return u.role === role; })[0] || null; }
  function ownerUser() { return personaOf('owner'); }

  function become(user) {
    if (!HB.session.set(user.id)) return;                      /* 'session:changed' redraws the screen */
    ui.toast('The screens now show what ' + user.roleLabel + ' sees and may do.', { title: 'You are now ' + user.name, tone: 'info' });
  }

  /**
   * A link to a screen. A screen the persona in use does not have is not hidden: it is shown locked, and the reason
   * says who has it, since following the link would only land on the dashboard.
   */
  function screenLink(text, route, me, suggest) {
    var page = pageOf(route);
    /* a screen this copy does not hold yet stays a plain link: the router then lands on the dashboard */
    if (!page || HB.router.isAllowed(page)) return ui.link(text || (page ? page.title : 'Open the screen'), route, { icon: 'arrow-right' });
    var who = suggest && suggest.role !== me.role && suggest.role !== 'owner' ? 'Switch to ' + suggest.roleLabel + ' or to the Owner to open it.' : 'Switch to the Owner to open it.';
    var why = me.roleLabel + ' does not have this screen. ' + who;
    return h('span', { 'class': 'mk-muted pg-guide__locked', title: why }, ui.icon('lock', 14), text || page.title,
      h('span', { 'class': 'mk-sr' }, ' (' + why + ')'));
  }

  function step(s, j, me) {
    var user = personaOf(s.role), page = pageOf(s.route), next = j.next === s.index;
    var mark = h('span', { 'class': 'pg-guide__mark', 'aria-hidden': 'true' }, s.done ? ui.icon('check', 14) : fmt.num(s.index + 1));
    var state = s.done ? ui.statusChip('DONE') : (next ? ui.chip('Next', 'info') : ui.statusChip('TODO'));
    var same = user && user.id === me.id;
    var swap = user ? ui.button({
      label: 'Switch to ' + (s.role === 'owner' ? 'the Owner' : s.roleLabel), icon: 'user', size: 'sm', title: user.name,
      disabledReason: same ? 'You are ' + user.name + ', ' + s.roleLabel + ', already' : '',
      onClick: function () { become(user); }
    }) : null;
    if (swap) swap.setAttribute('data-switch', s.role);
    var el = h('li', { 'class': ['pg-guide__step', s.done ? 'is-done' : '', next ? 'is-next' : ''] },
      mark,
      h('div', { 'class': 'pg-guide__main' },
        h('div', null, h('span', { 'class': 'mk-sr' }, s.done ? 'Done: ' : 'To do: '), s.text),
        h('div', { 'class': 'pg-guide__meta' },
          state,
          ui.chip('Suggested: ' + (user ? user.name + ', ' : '') + s.roleLabel, 'neutral', { icon: 'user', outline: true }),
          s.done ? h('span', { 'class': 'mk-small mk-muted' }, 'Ticked by ' + s.userName + ' on ' + ui.dateTime(s.at)) : null)),
      h('div', { 'class': 'pg-guide__acts' }, swap, screenLink(page ? 'Open ' + page.title.toLowerCase() : 'Open the screen', s.route, me, user)));
    el.setAttribute('data-step', j.id + ':' + s.index);
    return el;
  }

  function journey(j, n, me) {
    var chip = j.done ? ui.statusChip('DONE') : (j.doneSteps ? ui.chip(of(j.doneSteps, j.steps.length, 'step', 'steps'), 'info') : ui.statusChip('TODO'));
    /* a screen to look at that this persona does not have: say so in words, with the way to it */
    var owner = ownerUser(), shut = j.links.filter(function (l) { var p = pageOf(l.route); return p && !HB.router.isAllowed(p); }).length;
    var toOwner = shut && owner ? ui.button({ label: shut === j.links.length && shut > 1 ? 'Switch to the Owner to open them' : 'Switch to the Owner to open ' + (shut === 1 ? 'it' : 'the locked ones'),
      icon: 'user', size: 'sm', variant: 'ghost', onClick: function () { become(owner); } }) : null;
    if (toOwner) toOwner.setAttribute('data-switch-look', j.id);
    var el = ui.card({
      className: 'pg-guide__journey', title: fmt.num(n) + '. ' + j.title, actions: chip,
      body: h('ol', { 'class': 'pg-guide__steps' }, j.steps.map(function (s) { return step(s, j, me); })),
      footer: j.links.length ? h('div', { 'class': 'pg-guide__then' }, h('span', { 'class': 'mk-label' }, 'Then look at'),
        j.links.map(function (l) { return screenLink(l.text, l.href || l.route, me, null); }), toOwner) : null
    });
    el.setAttribute('data-journey', j.id);
    return el;
  }

  function intro(list, me) {
    var done = list.filter(function (j) { return j.done; }).length, owner = ownerUser(), isOwner = me.role === 'owner';
    return ui.card({
      title: 'Try this', subtitle: 'Short journeys through the demo. A step ticks itself when you post the entry it asks for, and the figures move as you go.',
      body: ui.stack([
        ui.meter({ value: done, max: list.length, tone: done ? 'good' : 'neutral', label: 'Journeys done', valueLabel: of(done, list.length, 'journey', 'journeys') }),
        ui.callout('info', 'The Owner can do every step', [
          'Each step names the person who does it in the business. Switch to that person to see the screens as their role sees them, or stay as the Owner throughout: an entry the Owner makes ticks the step just the same. ',
          'You are ' + me.name + ', ' + me.roleLabel + '.'
        ], { actions: owner && !isOwner ? ui.button({ label: 'Switch to the Owner', icon: 'user', size: 'sm', onClick: function () { become(owner); } }) : null }),
        h('div', { 'class': 'mk-small mk-muted pg-guide__fresh' }, 'To clear the ticks and start again, choose "Fresh copy dated today" in the top-right menu.')
      ], 3)
    });
  }

  HB.router.register({
    id: 'guide', route: '#/guide', group: 'Home', title: 'Try this', filters: [],
    subtitle: 'Journeys that tick themselves',
    render: function (rootEl, ctx) {
      var list = HB.data.guide.journeys(), me = ctx.user || HB.session.current();
      rootEl.appendChild(intro(list, me));
      if (!list.length) { rootEl.appendChild(ui.card({ body: ui.emptyState('No journey is set up in this copy', null, { icon: 'flag' }) })); return; }
      list.forEach(function (j, i) { rootEl.appendChild(journey(j, i + 1, me)); });
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
