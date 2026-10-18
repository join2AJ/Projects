# Client Projects Portal

Your studio website, client logins and business dashboard in one app.

- **Clients** sign in with an email link and see only their own projects: updates, issues, money owed,
  files, requests, numbers, and any custom report (such as the Tailbone Google Ads audit).
- **You** get a dashboard: money received and owed, overdue reminders, monthly recurring income,
  hours, earned per hour, open requests and issues, plus an editor for every project.

Built with React (Vite), Supabase (database, login, file storage) and hosted on Vercel.

## Pages

| URL | Who | What |
| --- | --- | --- |
| `/`, `/services`, `/process` | Anyone | Services, prices, onboarding and handover |
| `/login` | Anyone | Email sign-in link |
| `/portal`, `/portal/p/<slug>` | Clients | Their projects |
| `/studio` | You | Dashboard |
| `/studio/p/<slug>` | You | Edit a project: overview, updates, issues, money, time, files, requests, numbers, report, client access |
| `/studio/new`, `/studio/compare`, `/studio/overheads` | You | New project, compare projects and numbers, studio running costs |

## Who sees what

Enforced by the database (row level security), not by the website:

- You (the email in `settings.owner_email`) see and edit everything.
- A client sees a project only if their email is in its **Client access** tab, and within it only rows
  with "Client can see this" switched on. Draft invoices, time logs and private notes are never sent to them.
- Clients can add requests and upload files to their own projects. Nothing else.

Tested in `supabase/tests/10_access_rules.sql`.

One limit: report code (like the Tailbone audit) is part of the website's code, which every visitor
downloads. Private analysis never goes in report code. The Tailbone "Conversion check" tab and speaker
notes are compiled out of the live site and appear only in `npm run dev`. Use private updates for notes.

## Set up (one time)

### 1. Database (Supabase)

1. Create a Supabase project (free plan allows 2 active projects; pause one if both are used).
2. SQL Editor → run `supabase/migrations/0001_portal.sql`, `0002_private_helpers.sql`, then `supabase/seed/tailbone.sql`.
   (Already done for the live project `client-portal`, ref `zfinxpsezesqzskhaqad`, Mumbai.)
3. Authentication → URL Configuration: set **Site URL** to your live address (for example
   `https://your-site.vercel.app`) and add `http://localhost:5173/**` and `https://your-site.vercel.app/**`
   to **Redirect URLs**.
4. Project Settings → API: copy the **Project URL** and the **anon / publishable key**.
5. Supabase's built-in email sender allows only a few sign-in emails an hour. Before inviting several
   clients, add your own SMTP under Authentication → Emails (for example Resend's free plan).

### 2. Website (Vercel)

1. vercel.com → Add New → Project → import `join2aj/projects`.
2. Environment Variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from step 1.4.
3. Deploy. `vercel.json` already handles routing.

### 3. First sign-in

Open `/login` on the live site and sign in with `join2ajkumar@gmail.com`. That email is the owner,
so you land on the dashboard.

To give a client access: open the project → **Client access** → Add their email → send them the `/login` link.

## Day to day

- **Update a client:** Updates tab. Switch off "Client can see this" for private notes.
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
