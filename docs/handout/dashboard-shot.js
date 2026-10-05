/*
 * Steps for the page harness: the dashboard as the Owner on last month, for the picture on page 1 of the handout.
 *
 *   node tools/harness/run.js docs/handout/dashboard-shot.js --name=handout-shot --date=2026-10-05 --size=1440x900 --shot=docs/handout/dashboard.png
 */
HBT.run(async function (t) {
  await t.as('u_owner');
  HB.filters.set({ preset: 'lastMonth' });
  await t.go('#/home');
  await t.settle();
  t.ok(!!document.querySelector('.pg-home__cockpit'), 'the dashboard is drawn');
});
