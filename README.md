# Happy Bakers - Neo ERP sample

A clickable sample of **Neo ERP (Tier 1)**, built around a fictional bakery factory in Anand, Gujarat: about
Rs 4 crore a year, 35 employees, 40 retail outlets on four van routes, 10 corporate customers and three own stores.
It is a sales sample, not a product: plain HTML, CSS and JavaScript, no build step, no database and no application
backend.

What sets it apart from a mock-up: **every figure on every screen comes from documents, and you can add documents.**
Post a dispatch sheet, receive flour at a new rate or approve a write-off, and the stock, the balances, the product
cost and the dashboard move at once. What you enter stays in your own browser. Happy Bakers and every customer,
vendor and employee in it are invented.

## Open it

- Double-click `index.html`. It runs from the file, offline, with nothing to install. Or
- serve it with the sign-in in front, as the hosted preview runs it:

  ```
  LOGIN_USER=you@example.com LOGIN_PASSWORD=choose-one npm start
  ```

  and open http://localhost:8347. The first start writes `server/users.json`; after that `npm start` alone is enough.
  `node tools/serve.js 9000` picks another port; `LOGIN=off npm start` serves it without a sign-in, for local work
  only. In PowerShell: `$env:LOGIN='off'; npm start`.

Node 20 or later, for the server and the checks only; no packages to install. A desktop browser, 1024 pixels wide or
more.

The sample takes the day it is first opened as its **business date** and keeps it: nothing ages while a copy sits
unused. History runs from 1 January 2026 to the day before. Come back on a later day and a banner offers a fresh
copy dated today; "Fresh copy dated today" in the top-right menu does the same at any time, and discards what you
entered.

## The personas

The sample opens as the Owner. Switch from the top bar; the menu, the figures and what you may do follow the role.
A button a role may not use stays on screen, locked, with the reason.

| Persona | Role | Sees | Does |
|---|---|---|---|
| Nilesh Patel | Owner | Everything | Everything, and every approval, his own entries included |
| Falguni Shah | Accounts and admin | Everything | Vendor bills, payments, receipts, deposits, expense bills, the salary bill, masters, the directory |
| Imran Vohra | Purchase and stores | Factory stock, vendors | Purchase orders, goods receipts, stock counts, write-off requests, transfers to stores |
| Bharat Prajapati | Production supervisor | Recipes, raw and finished stock | Production entries |
| Hardik Thakkar | Sales and dispatch | Customers, finished stock | Dispatch sheets, corporate orders and invoices, stale returns, collections |
| Nisha Desai | Store manager, Vallabh Vidyanagar | That store only | Confirms transfers, the day-end, the store's cash deposit, write-off requests |

Every persona can raise an expense claim. Only the Owner approves.

## What is in it

| Area | Screens |
|---|---|
| Home | Dashboard and today's work; approvals; "Try this" |
| Sell | Dispatch sheets by route, and one action that cancels a posted sheet; corporate orders; invoices (printable invoice and delivery challan); stale returns; receipts and customer statements |
| Stores | Transfers to the own stores; the store day-end |
| Buy | Purchase orders; goods receipts; vendor bills with the three-way check; payments |
| Make | Production entries with yield; recipes and the cost sheet |
| Stock | Stock on hand and low stock; batches, expiry and write-offs; the movement ledger; stock counts |
| Expenses, People | Claims, expense bills and the salary bill; the employee directory |
| Accounts | Receivables, payables, cash and bank, monthly profit and loss, product margin, GST summary |
| Reports | Twenty registers, each with a date range and a CSV export |
| Masters | Items and prices; customers and vendors; expense categories and locations |
| System | Audit log; notification log (nothing is sent); what the higher tiers add; about this sample |

Start with **Try this** in the menu: eight short journeys that tick themselves as you post the entries they ask for,
such as "raise a flour order at a higher rate, receive it, and see bread cost and margin move". Small locked cards
mark where a higher tier (iNeo, NeoX) adds something; nothing behind them is built.

## How the data works

**The history is built, not stored.** Each time the page opens, a day-by-day simulation of the business
(`js/data/seed.js`, on the parameters in `js/data/config.js`) runs from 1 January 2026 to the day before the business
date: dispatch, returns, transfers, receipts, production, purchasing, bills, payments, day-ends, expenses. It is
deterministic, so every load gives the same history, and it ends with yesterday's production in the finished store
and raw material for three days, so that today's work can be done.

**One posting engine.** The simulation and the forms post through the same functions (`js/data/engine.js`): a document
writes its stock movements, its receivable or payable, its cash entry, its profit-and-loss and GST rows, and the
running balances follow. Rights, approvals, date rules and input checks wrap that core for what a user enters.
Every screen reads its figures from selectors over that book (`js/data/data.js`); no figure is typed into a page.
Posted documents are never edited: they are cancelled by a document of their own. A posted dispatch sheet is
cancelled in one action: every invoice of it, or none.

**A figure that looks wrong is warned about, not refused.** Good units far from what the recipe expects, a count far
from the books, an invoice above its order, a receipt above everything the customer owes, a large claim, an order
rate far from the last purchase price, a day-end whose cash and UPI are far from its sales: the form says so beside
the figure before posting, the entry can still be posted, and the audit log keeps the warning. The thresholds are in
`js/data/config.js` (`limits.warn`). The history is never warned about.

**Your entries are a log in the browser.** Local storage holds the business date, a version of the sample data and
one numbered log of what you did: each document as entered, each approval, rejection, cancellation and master change.
On every load the history is built again and the log is replayed on top of it in its original order, so a reload
gives exactly the figures you left. Nothing is sent anywhere; another browser or device has its own copy. If the
browser cannot save, a banner says that changes will not survive a reload. If the sample data has changed since a
copy was saved, the copy starts afresh with a notice.

## Checks

```
npm run check            the self-check of the data layer: about two minutes
node tools/check.js a s  the quick half: the hand-worked tiny company and the selectors, a few seconds
npm run check:config     the parameters in js/data/config.js against docs/RESEARCH.md
npm run check:all        both
```

`tools/check.js` has three parts. (a) A tiny company and about three dozen operations whose expected stock, cost,
GST, receivable, payable, cash and profit figures were worked out by hand; then every refusal, every warning at
its threshold, and the cancellation of a dispatch sheet. (b) The full history, reconciled by a
separate straight pass over the raw documents: the ledger against the stock, receivables, payables, cash, every
profit-and-loss line, two runs alike, and the history for one date being the beginning of the history for a later
one. (c) Behaviour: every "Try this" journey as each persona, every refusal, post then cancel, save and replay,
a fresh copy. Run it after touching anything under `js/data`. The build-time limits in part (b) assume an idle
machine.

`tools/harness/run.js` drives the real screens in headless Chrome from a steps file, and `tools/harness/lint.js`
reads a page file for the house rules; `docs/PAGES.md` section 6 shows both.

## The documents

In `docs/`, for people changing the code:

| File | What it is |
|---|---|
| `SCOPE.md` | What is in the sample and what is not, as agreed. The yardstick |
| `SPEC.md` | The build contract: constraints, data model, engine, personas, selectors, pages |
| `RESEARCH.md`, `CONFIG.md` | Every business parameter and where it comes from; how it sits in `js/data/config.js` |
| `API.md` | The data layer as built: kernel, engine, operations, selectors. The authority on shapes |
| `PAGES.md` | How a screen is written and tested |
| `shell/UI-API.md`, `shell/CHARTS-API.md` | The UI kit and the chart wrapper |

## The sign-in

One username and password, checked on the server (`tools/serve.js`) against a file on the server:

- `server/users.json` holds the username and a **salted scrypt hash** of the password. The password itself is
  written nowhere. The file is created at start-up from the variables `LOGIN_USER` and `LOGIN_PASSWORD` and is not
  in the repository (`.gitignore`); on later starts without the variables the file on disk is used.
- Without a file and without the variables the server refuses to start, so the sample is never served unprotected
  by accident.
- Until a browser has signed in it gets the sign-in screen and nothing else: not the page, not a script, not the
  data files.
- A session lasts 12 hours (an HttpOnly cookie, Secure over https). The top-right menu has **Sign out**.
- Eight refused attempts from one address pause that address for ten minutes.
- Changing the password (the variable, then a restart) signs everybody out. `SESSION_SECRET` is optional: set it to
  sign the cookie with a key of its own.

This is a door for a demo, not an identity system: one shared account, no password reset, no user management. The
sign-in protects the hosted site only. Each visitor still works in a private copy in their own browser.

## Deploy (Railway)

1. New Project, Deploy from GitHub repo, pick this repository.
2. In the service's **Variables** add `LOGIN_USER` and `LOGIN_PASSWORD` (and, if you like, `SESSION_SECRET`).
   Without the first two the deploy fails with "No login is configured" in the log, by design.
3. Railway builds with Railpack and starts `node tools/serve.js` (`railway.json`); the server listens on the `PORT`
   Railway injects and answers the health check at `/healthz`.
4. Settings, Networking, Generate Domain. Every push to the deployed branch redeploys.

What the server does (`tools/serve.js`, no dependencies): after the sign-in it serves `index.html`, `css/`, `js/` and
`vendor/` and nothing else, so `docs/`, `tools/`, the configuration and `server/` are never part of the site; files
revalidate by ETag, so a deploy shows at once; text is sent with brotli or gzip; and search engines are told not to
index the preview (`X-Robots-Tag`, the robots meta tag and `/robots.txt`).

If the repository is public, the sign-in protects the deployed site, not the code: anyone can download the code and
open it locally.
