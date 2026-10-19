/*
 * All client projects. Add a new object to PROJECTS to give a client their own portal page at /p/<slug>.
 * Everything here can be shown to the client. Private notes and time logs go in projects.internal.js.
 */

export const PROJECTS = [
  {
    slug: "tailbone-treatment",
    name: "Tailbone Treatment",
    client: { name: "Dr Rajveer", org: "Tailbone Treatment clinic, New Delhi" },
    stage: "delivery",
    started: "2026-10-17",
    brief: "Received Sat 17 Oct 2026, 13:00. Work started the same day at 15:00.",
    nextMeeting: { when: "Mon 19 Oct 2026", what: "Check we are on track: old ads stopped, new Search campaign and monthly cap" },
    findings: "tailbone", // key into FINDINGS in pages/Project.jsx

    services: [
      { id: "ads-audit", status: "Done", note: "Audit 17–18 Oct. Search | Tailbone | Delhi NCR | Oct 2026 published 18 Oct, starts 19 Oct." },
      { id: "ads-management", status: "Proposed", note: "From 19 Oct. Ad budget ₹200/day, ceiling ₹10,000/month incl. GST, paid to Google." },
      { id: "website-redesign", status: "In progress", note: "New site built (booking, ₹800 consultation, ₹500 follow-up). Goes live on the clinic’s own domain, tailbonetreatment.com, replacing the old WordPress site." },
      { id: "maintenance", status: "Proposed", note: "Long term, from launch of the new site." },
      { id: "seo", status: "Proposed", note: "Long term. Starts with the Google Business Profile and the new site." },
    ],

    timeline: [
      ["17 Oct, 13:00", "Project brief received", "Done"],
      ["17 Oct, 15:00", "Work started: account review", "Done"],
      ["18 Oct", "Findings written: 16 issues, 27 conversion actions audited, billing reconciled", "Done"],
      ["18 Oct", "Old campaigns paused (YouTube Promotion, PMax-5, PMax-4)", "Done"],
      ["18 Oct", "Search campaign built and published, health-policy flag fixed", "Done"],
      ["19 Oct", "Meeting with Dr Rajveer. ₹3,500 load before 10:00. Campaign start", "Scheduled"],
      ["21 Oct", "Day 3: real searches reviewed, negative keywords agreed", "Scheduled"],
      ["2 Nov", "Day 14: first review with the 5-Layer Check", "Scheduled"],
      ["18 Nov", "Day 30: budget decision (raise, hold or cut)", "Scheduled"],
    ],

    onboarding: [
      ["Brief and goals agreed", "Done"],
      ["Google Ads: Standard access invite to Ajay’s own email", "Needs client"],
      ["Google Tag Manager and website editor named (footer credits ARQ IT Solutions)", "Needs client"],
      ["Google Business Profile manager access", "Needs client"],
      ["Clinic phone hours, for the ad schedule", "Needs client"],
      ["Revenue per patient: visits per patient and fee per visit", "Needs client"],
      ["Call and WhatsApp log for 17 Sep – 16 Oct", "Needs client"],
      ["Written OK on the ₹10,000 monthly cap and the fees", "Needs client"],
      ["Friday update set up", "Scheduled"],
    ],

    // Things the client asked for, plus anything they send through the request form.
    requests: [
      ["17 Oct", "Website redesign", "In progress"],
      ["17 Oct", "Google Ads (AdWords) campaign", "Done"],
      ["17 Oct", "Website maintenance, long term", "Proposed"],
      ["17 Oct", "SEO, long term", "Proposed"],
    ],
  },
];

export const findProject = (slug) => PROJECTS.find((p) => p.slug === slug);
