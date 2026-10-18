# Client Projects Portal

Your studio website, client logins and business dashboard in one app.

- **Clients** sign in with an email link and see only their own projects: updates, issues, money owed,
  files, requests, numbers, and any custom report (such as the Tailbone Google Ads audit).
- **You** get a dashboard: money received and owed, overdue reminders, monthly recurring income,
  hours, earned per hour, open requests and issues, plus an editor for every project.

Built with React (Vite), Supabase (database, login, file storage) and hosted on Vercel.

## Pages

Only `/login` is public. Everything else needs a signed-in user.

| URL | Who | What |
| --- | --- | --- |
| `/login` | Anyone | Username (or email) and password. No sign-up: the admin creates every account |
| `/portal`, `/portal/p/<slug>` | Clients | Their projects, including the **Decisions** checklist (answer Yes / No / Other) |
| `/services`, `/process`, `/account` | Signed in | Prices, how we work, change password |
| `/studio` | Admin | Dashboard, including updates waiting for approval |
| `/studio/pricing` | Admin | Price list: standard price, market range, why this price (clients see these), what changes the price and talking tips (private) |
| `/studio/users` | Admin | People (create, edit, disable, delete, reset password, projects) and Clinics |
| `/studio/p/<slug>` | Admin | Edit a project: overview, updates, issues, money, time, files, requests, numbers, report, access |
| `/studio/new`, `/studio/compare`, `/studio/overheads` | Admin | New project, compare, studio running costs |

## Who sees what

Enforced by the database (row level security), not by the website:

- The admin (`profiles.is_owner`, active) sees and edits everything.
- A client sees a project only if it is ticked for them on People, and within it only items marked for the
  client. **Updates start unapproved**: they reach the client only after you press Approve.
  Draft invoices, time logs and private notes are never sent to clients.
- A disabled account cannot sign in, and loses access at once even if it was already signed in.
- Accounts are created and changed only through the `admin-users` Edge Function, which checks that the
  caller is the admin. A username `rajveer` is stored in auth as `rajveer@u.portal`; nothing is ever emailed.

Tested in `supabase/tests/10_access_rules.sql`.

One limit: report code (like the Tailbone audit) is part of the website's code, which every visitor
downloads. Private analysis never goes in report code. The Tailbone "Conversion check" tab and speaker
notes are compiled out of the live site and appear only in `npm run dev`. Use private notes for that.

## Set up (one time)

### 1. Database (Supabase)

1. Create a Supabase project (free plan allows 2 active projects; pause one if both are used).
2. SQL Editor → run `supabase/migrations/0001_portal.sql`, `supabase/seed/tailbone.sql`, `0002_private_helpers.sql`, `0003_users_and_approvals.sql`, `0004_decisions.sql`, `0005_weekly_updates.sql`, `0006_price_list_and_discounts.sql`
   (and `supabase/seed/price_list.sql`)
   (and `supabase/seed/tailbone_decisions.sql` for the 19 Oct meeting).
   Deploy `supabase/functions/admin-users` (Edge Functions).
   (Already done for the live project `client-portal`, ref `zfinxpsezesqzskhaqad`, Mumbai.)
3. Authentication → URL Configuration: set **Site URL** to your live address (for example
   `https://your-site.vercel.app`) and add `http://localhost:5173/**` and `https://your-site.vercel.app/**`
   to **Redirect URLs**.
4. Project Settings → API: copy the **Project URL** and the **anon / publishable key**.

### 2. Website (Vercel)

1. vercel.com → Add New → Project → import `join2aj/projects`.
2. Environment Variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from step 1.4.
3. Deploy. `vercel.json` already handles routing.

### 3. First sign-in

Open `/login` and sign in as `join2ajkumar@gmail.com` with the password you were given, then change it
under Account. Add clients on **People**: name, username, password, clinic, projects. Give them the
username, password and the `/login` address yourself.

## Day to day

- **Update a client:** Updates tab → Add, then **Approve** when it is ready for them. Unapproved updates and
  notes stay private. The dashboard lists everything waiting for approval.
- **Weekly update, every Tuesday 11:00 IST, for every active client** (one timetable, set in
  `src/data/studio.js` → `WEEKLY` and `TIMETABLE`). Project → Updates → **Write this week’s update** drafts it
  from the last 7 days (work done, open issues, decisions waiting, payments). Edit, then **Approve** any time
  before Tuesday; the database shows it to the client only from Tuesday 11:00. The dashboard card lists every
  active client’s update for this week (not written / draft / approved / published) and can draft all missing ones.
  Clients see the timetable on their overview and on How we work.
- **Decisions:** project → Decisions → Add each question (with background and your recommendation),
  then **Send**. The client answers Yes, No or Other (Other needs a note) and can change it until you close it.
  After the meeting, Edit → Status Closed → write the final decision; the client sees it. “Copy checklist for
  WhatsApp” gives a ready-to-paste list with answers.
- **Bill:** Money → Add invoice (starts as a hidden draft) → **Send** → **Mark paid** when it arrives.
  Sent invoices show on the client's page. Overdue ones show a red banner there, and a **Copy reminder**
  message on your dashboard for WhatsApp.
- **Track time:** Time tab → Start timer / Stop. Your dashboard turns hours into earned per hour.
- **Numbers for any project:** Numbers tab → paste `metric, 2026-10, value, unit, source` lines from a
  spreadsheet. Use the same metric names across projects so `/studio/compare` lines them up.
- **Prices:** set standard prices on **Price list**. Each client's fee is set on their project (Overview →
  Services and fees): pick the service, then a discount % or the fee itself, and a reason. The pricing guide
  shows your standard, the market range, whether the fee is below/within/above market, and your tips.
  The client's Money tab shows standard price → discount (with your reason) → their fee, "You save ₹X", and
  "why these prices". The dashboard totals the discounts you are giving.

## Develop

```bash
cp .env.example .env.local   # fill in the two Supabase values
npm install
npm run dev                  # http://localhost:5173
npm run build
node scripts/make-seed.mjs   # rebuild the Tailbone seed from the audit module
npm run build:share          # older one-page snapshot of the Tailbone client page (no database)
```

Not built yet: automatic reminder emails (needs an email service such as Resend and a scheduled
Supabase function), online payment links, and per-client file size quotas.
