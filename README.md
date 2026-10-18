# Client Projects Portal

One place to run every client project: what is being worked on, findings, pricing, onboarding, requests and handover.
Each client gets their own link. You get a studio view of everything.

## Pages

| URL | Who | What |
| --- | --- | --- |
| `/` | Anyone | Services and how a project runs |
| `/services` | Anyone | Prices and payment terms |
| `/process` | Clients | Onboarding, weekly rhythm, handover, feedback form |
| `/request` | Clients | Send a new request (`?project=Name` pre-fills it) |
| `/p/<slug>` | One client | Their portal: overview, meeting brief, findings, plan and pricing, onboarding, requests, handover |
| `/studio` | You | All projects, with internal notes and time logs (`/studio/p/<slug>`) |

## Where to edit things

- **Prices, payment terms, onboarding and handover steps:** `src/data/studio.js`
- **Projects** (services, status, timeline, onboarding checklist, requests, time log): `src/data/projects.js`
- **Tailbone findings** (from the Google Ads audit): `src/projects/tailbone/audit.jsx`. Issue status after the
  18 Oct rebuild is in `ISSUE_STATUS`.
- **Tailbone meeting brief, 19 Oct:** `src/projects/tailbone/meeting.jsx`

To add a client, add an object to `PROJECTS` and send them `/p/<slug>`.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # output in dist/
```

## Deploy (Netlify)

Connect this repo in Netlify. `netlify.toml` already sets the build, SPA routing and `noindex`.
The request and feedback forms post to Netlify Forms: turn on email notifications under
Site settings > Forms. When the site runs anywhere else, the forms open an email to you instead.

## Privacy: read before sharing

This is a static site. Client pages and `/studio` are **unlisted, not private**: anyone with the URL can read them,
and the code ships every project's data to the browser. Before you share a link:

1. Turn on Netlify site password protection, or
2. Move projects and requests into a database with login (Supabase is the planned next step).

Never put passwords or access tokens in `src/data`.
