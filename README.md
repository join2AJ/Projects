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
| `/portal`, `/portal/p/<slug>` | Clients | Their projects |
| `/services`, `/process`, `/account` | Signed in | Prices, how we work, change password |
| `/studio` | Admin | Dashboard, including updates waiting for approval |
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
2. SQL Editor → run `supabase/migrations/0001_portal.sql`, `supabase/seed/tailbone.sql`, `0002_private_helpers.sql`, `0003_users_and_approvals.sql`.
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
- **Bill:** Money → Add invoice (starts as a hidden draft) → **Send** → **Mark paid** when it arrives.
  Sent invoices show on the client's page. Overdue ones show a red banner there, and a **Copy reminder**
  message on your dashboard for WhatsApp.
- **Track time:** Time tab → Start timer / Stop. Your dashboard turns hours into earned per hour.
- **Numbers for any project:** Numbers tab → paste `metric, 2026-10, value, unit, source` lines from a
  spreadsheet. Use the same metric names across projects so `/studio/compare` lines them up.
- **Prices:** `src/data/studio.js` sets the public price list and service defaults. Each project stores its own agreed fee.

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
