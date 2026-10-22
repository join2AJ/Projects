# Client Projects Portal

Your studio website, client logins and business dashboard in one app.

- **Clients** sign in with an email link and see only their own projects: updates, issues, money owed,
  files, requests, numbers, and any custom report (such as the Tailbone Google Ads audit).
- **You** get a dashboard: money received and owed, overdue reminders, monthly recurring income,
  hours, earned per hour, open requests and issues, plus an editor for every project.

Built with React (Vite), Supabase (database, login, file storage) and hosted on Vercel.

## Pages

Only `/login` and `/privacy` (the privacy notice) are public. Everything else needs a signed-in user.

| URL | Who | What |
| --- | --- | --- |
| `/login` | Anyone | Username (or email) and password. No sign-up: the admin creates every account |
| `/portal`, `/portal/p/<slug>` | Clients | Their projects: **Decisions** (Yes / No / Other, with history), **Money** (approve each fee or suggest their own price), **Requests** (conversations), **Work done**, **Your data** (download, correction, deletion) |
| `/services`, `/process`, `/account` | Signed in | What each service covers (no prices), how we work, change password |
| `/studio` | Admin | Dashboard, including updates waiting for approval |
| `/studio/pricing` | Admin | Price list: standard price, market range, what changes the price and talking tips (all private); what it covers (clients see this) |
| `/studio/activity` | Admin | Audit trail across all projects: every change with IST timestamp, who, before/after; sign-ins |
| `/security` | Signed in | How data is protected (encryption in transit and at rest, access, audit trail) |
| `/studio/users` | Admin | People (create, edit, disable, delete, reset password, projects) and Clinics |
| `/studio/p/<slug>` | Admin | Edit a project: overview and fees, decisions, updates and the **update schedule**, issues, money, time, files, requests, **work done**, numbers, report, timeline, activity, client access, **tools and logins** |
| `/studio/new`, `/studio/compare`, `/studio/overheads` | Admin | New project, compare, studio running costs |

## Who sees what

Enforced by the database (row level security), not by the website:

- The admin (`profiles.is_owner`, active) sees and edits everything.
- A client sees a project only if it is ticked for them on People, and within it only items marked for the
  client. **Updates start unapproved**: they reach the client only after you press Approve.
  Draft invoices, time logs and private notes are never sent to clients.
- Each project has a permanent code (e.g. `TBT-2610`), and each person has a role on each project, set on People:
  **approver** (answers decisions, approves fees, signs off deliverables and monthly reports), **contributor**
  (sends requests and files, marks their own action points done), **viewer** (reads only) and **team** (sees and
  drafts project work, never money, time or passwords, and cannot share with the client). The database enforces these.
- The client's Home lists what needs them ("2 things need you"); each item opens the place to act on it.
- A disabled account cannot sign in, and loses access at once even if it was already signed in.
- Accounts are created and changed only through the `admin-users` Edge Function, which checks that the
  caller is the admin. A username `rajveer` is stored in auth as `rajveer@u.portal`; nothing is ever emailed.

Tested in `supabase/tests/10_access_rules.sql`.

## Audit trail, timeline and encryption

- **Audit trail** (migration 0007): database triggers record every insert, change and delete on project data
  with the time, the person and their role, a plain-language summary, and before/after values. Sign-ins and
  sign-outs are recorded too. No one can edit or delete entries through the API. The admin sees everything
  (Activity page, and each project's Activity tab). A client sees the entries for their own projects that
  concern things they can see, plus their own sign-ins (Account page).
- **Client timeline** (project → Timeline): coming up (weekly update, planned items, answers needed, payments
  due) and everything that has happened, by date, in India time.
- **Encryption in transit:** HTTPS only (TLS 1.2/1.3) for the site, the database API and file downloads;
  HSTS and a strict Content-Security-Policy are set in `vercel.json`.
- **Encryption at rest:** Supabase encrypts the database and stored files with AES-256
  ([supabase.com/security](https://supabase.com/security)); project region Mumbai (ap-south-1).
  Passwords are stored only as bcrypt hashes. File links expire after 5 minutes.
- **Admin to do:** Supabase → Database → Settings → enable *Enforce SSL on incoming connections*.

- **Passwords for client tools** (migration 0009, project → Tools and logins, admin only): stored in Supabase
  Vault (encrypted with a key held outside the database). The `credentials` table holds only the tool, login,
  access level and a Vault reference. `credential_reveal()` checks the admin and logs every view.
- **Nothing is deleted** (migration 0008): requests, decisions and fees cannot be deleted (a fee is stopped
  instead); request messages cannot be edited or deleted. Every change is in the audit trail.

## Privacy (DPDP Act, 2023)

- A privacy notice (`src/data/studio.js` → `PRIVACY`) says who is responsible, what is held, why, where, how
  long, and the client's rights. Each client accepts it once before seeing their project (`consents` table,
  with the version and time); changing `PRIVACY_VERSION` asks everyone again.
- Clients can download all their data (JSON), and ask for correction, deletion or to withdraw consent from the
  **Your data** tab. These arrive as requests starting “[Privacy]”; reply within 7 days.
- Access ends 7 days after a project's end date (enforced by the database in `private.is_member`). The dashboard
  **Privacy (DPDP)** card lists ended projects that still have accounts attached, to remove.
- What the code cannot do for you: delete personal data after the 7 days (remove the account on People, then
  delete what is not needed for tax records), and report a breach to the Data Protection Board and the client.

One limit: report code (like the Tailbone audit) is part of the website's code, which every visitor
downloads. Private analysis never goes in report code. The Tailbone "Conversion check" tab and speaker
notes are compiled out of the live site and appear only in `npm run dev`. Use private notes for that.

## Set up (one time)

### 1. Database (Supabase)

1. Create a Supabase project (free plan allows 2 active projects; pause one if both are used).
2. SQL Editor → run `supabase/migrations/0001_portal.sql`, `supabase/seed/tailbone.sql`, `0002_private_helpers.sql`, `0003_users_and_approvals.sql`, `0004_decisions.sql`, `0005_weekly_updates.sql`, `0006_price_list_and_discounts.sql`, `0007_audit_trail.sql`, `0008_schedule_threads_fees_privacy.sql`, `0009_credentials_vault.sql`, `0010_schedule_changes_private.sql`, `0011_respond_fee_done_work.sql`, `0012_money_coming_soon.sql`, `0013_meetings_drafts_page_views.sql`, `0014_meeting_items_share.sql`, `0015_meeting_items_priority.sql`, `0016_promotion_plan.sql`, `0017_codes_roles_signoff_cycles.sql`
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
  `src/data/studio.js` → `WEEKLY` and `TIMETABLE`). **Skip or move** any one on project → Updates → Update
  schedule (for that client or every client, with a private reason). Clients are never told about a skipped or
  moved date: they only see when the next update is (“Weekly updates start …” until the first one is out). Project → Updates → **Write the next update** drafts it
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
- **Prices:** set standard prices on **Price list** (private). Each client's fee is set on their project
  (Overview → Services and fees): pick the service, then a discount % or the fee itself. The pricing guide
  shows your standard, the market range, whether the fee is below/within/above market, and your tips. The
  client sees only the fee, and either **approves** it or **suggests their own price** with a note. Their answer
  shows in the “Client says” column; **Accept ₹X** takes their price. Changing a fee asks them again.
- **Fees not agreed yet?** Project → Overview (or Money) → **Hide: coming soon**. The client's Money tab says
  “Coming soon”: no fees, prices or invoices, they cannot answer fees, and fee changes stay out of their timeline
  and data download. **Show fees to the client** when you have agreed them together.
- **After a call:** project → Meetings → **Add meeting notes**, then add (and later Edit or Delete) discussion points, action points (who, by
  when; Done or Drop) and workable points (Noted, Working on it, Done). Mark each point **Share** (or Share all), then
  **Share with client**: the client sees only the shared points. **Copy shared points for WhatsApp** gives a
  ready list. Give each point a priority (P1 Now, P2 Next, P3 Later); points sort by it, and open action points
  across projects show on the dashboard, most urgent first.
- **What the client views:** project → What the client views. Pages and sections opened, with time there, by date,
  weekday or hour; filter by person, section and dates; plus what they did. Your own views are not recorded.
- **Draft replies:** a prepared reply sits under a request as “Draft reply, not shared yet”. Edit it and press
  **Share reply**; only then does the client see it.
- **Promotion plan:** project → Promotion plan. Every channel (Google Ads, website, Google Business Profile, Instagram
  and Facebook, influencers, Meta ads, referral partners, WhatsApp, reviews, measurement) with its strategies:
  status, priority, monthly budget, who, and how success is measured. Planned ad spend is checked against the
  client's limit (project Overview → ad spend limit). Share points one by one; the client sees only those.
- **Index and direct links:** every project tab has its own address (`?tab=decisions`, `?tab=meetings`…). The
  **Index** tab says what each tab is for; in the admin view, **Copy client link** gives the client’s link to the same
  tab for WhatsApp.
- **Tabs in groups:** Index · Plan (Overview, Promotion plan, Meetings, Decisions, Timeline chart) · Work · Results
  (Current results, Previous reports & analysis) · Money · Client (What the client views, Shared vs private, Client
  timeline, Client access, Activity, Tools and logins). Hover a group for its tabs; the open group's tabs also show as
  a second row. Results since the project start are "current"; older figures and audits sit under Previous reports.
- **Shared vs private:** every item in the project with a Shared / Private tag, counts per section and filters.
  Meetings and the Promotion plan also have All / Shared / Private filters.
- **Timeline chart:** action points (agreed → due), running strategies and milestones on a Gantt chart.
- **Activity:** a table with filters (who, change type, section, client-visible, dates, search) and grouping.
- **Requests:** a conversation per request. Both sides reply; you set the status. Nothing can be edited or deleted.
- **Work done:** project → Work done → **Log work** for each audit, report or piece of work (approve it on
  Updates for the client to see). Done work and milestones, the report and report files are listed in one place.
- **Tools and logins:** project → Tools and logins. Record each tool you have access to, the login and access
  level; add the password if you must keep one.
- **Invite someone:** People → create the user (or **Invite** on an existing one) → **Copy WhatsApp message**
  or **Open in WhatsApp**. The password is included only right after you set it.

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
