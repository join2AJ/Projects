/*
 * Studio settings: who you are, what you sell, and how every client moves from enquiry to handover.
 * Edit prices here. Every project quote reads from SERVICES, so a change shows up everywhere.
 * All fees are in INR and exclude GST. Ad spend is always paid by the client directly to Google.
 */

export const STUDIO = {
  name: "Ajay Kumar",
  tagline: "Websites, Google Ads and SEO for clinics and small businesses",
  email: "join2ajkumar@gmail.com",
  hourly: 800, // extra work outside a package, billed in 30-minute blocks
  gstNote: "Fees exclude GST. GST is added only if applicable.",
  paymentTerms: [
    "One-time work: 50% to start, 50% on delivery.",
    "Monthly retainers: billed on the 1st, in advance, due within 7 days.",
    "Ad spend is never billed by me. It goes from your card straight to Google.",
    "Retainers run month to month after any minimum term, with 30 days’ notice to stop.",
  ],
};

export const SERVICES = {
  "ads-audit": {
    name: "Google Ads audit and rebuild",
    kind: "one-time", price: 12000,
    summary: "Full account review, conversion audit, billing reconciliation, and a new campaign built and published.",
    includes: [
      "Campaign, billing, conversion, asset and policy review",
      "Written findings: what is right, what is wrong, how to fix it",
      "New campaign built with budget cap, targeting and policy checks",
      "12-month budget plan and break-even rule",
    ],
  },
  "ads-management": {
    name: "Google Ads management",
    kind: "monthly", price: 5000, minMonths: 3,
    summary: "Running the account week to week, for ad spend up to ₹15,000 a month.",
    includes: [
      "Search terms review and negative keywords",
      "Written weekly update every Tuesday at 11:00",
      "Monthly review using the 5-Layer Check",
      "Budget changes only with your written approval",
    ],
    note: "A flat fee, not a % of spend, because the ad budget is small. Above ₹15,000 spend a month, the fee is reviewed.",
  },
  "website-redesign": {
    name: "Website redesign",
    kind: "one-time", price: 35000,
    summary: "New mobile-first website with booking, clinic pages, and Google tracking installed.",
    includes: [
      "Up to 10 pages: home, doctor, treatments, FAQs, locations, contact, blog",
      "Appointment booking and WhatsApp contact",
      "Google tag, call and form tracking, Search Console",
      "Domain switch-over and 30 days of fixes after launch",
    ],
    milestones: [["Start", 50], ["Design approved", 30], ["Live on your domain", 20]],
  },
  maintenance: {
    name: "Website maintenance",
    kind: "monthly", price: 3000, minMonths: 6,
    summary: "Keeping the site fast, safe, backed up and up to date.",
    includes: [
      "Uptime and form checks, weekly backups",
      "Up to 2 hours of content changes a month",
      "Hosting, domain and SSL renewals watched",
      "Fixes within 2 working days",
    ],
  },
  seo: {
    name: "Local SEO",
    kind: "monthly", price: 8000, minMonths: 6,
    summary: "Getting found on Google and Maps for searches near the clinic, without paying per click.",
    includes: [
      "Google Business Profile: posts, photos, Q&A, review replies",
      "On-page fixes and 2 articles a month",
      "Local listings and citations",
      "Monthly ranking and enquiry report",
    ],
    note: "SEO takes 3 to 6 months to show results, hence the minimum term.",
  },
};

// Bundle discount when a client takes all three monthly services together.
export const BUNDLE = { services: ["ads-management", "maintenance", "seo"], discount: 2500, name: "Growth bundle" };

/* The client journey. Each project records which stage it is at. */
export const STAGES = [
  ["enquiry", "Enquiry", "You tell me what you need."],
  ["discovery", "Discovery", "A 30-minute call and a look at what exists today."],
  ["proposal", "Proposal", "Scope, fees and dates in writing."],
  ["onboarding", "Onboarding", "Access, assets and a kickoff call."],
  ["delivery", "Delivery", "The work, with a written update every Tuesday at 11:00."],
  ["review", "Review", "Monthly check against agreed goals."],
  ["offboarding", "Handover", "Everything you own handed back, cleanly."],
];

/* Onboarding: what every client gets, and what I need. Projects copy the parts that apply. */
export const ONBOARDING = {
  welcome: [
    "Welcome note within 24 hours of saying yes, with this portal link",
    "One page: who does what, how to reach me, response times (same working day on WhatsApp, 24 h on email)",
    "Kickoff call (30 min): goals, what success looks like in numbers, key dates",
    "Your weekly update every Tuesday at 11:00 IST, on your project page",
  ],
  access: {
    "Google Ads": "Standard access by email invite (Admin > Access and security). Never share your password.",
    "Google Analytics 4": "Editor access on the property",
    "Google Tag Manager": "Publish access on the container",
    "Google Business Profile": "Manager (not Owner)",
    "Search Console": "Full user",
    "Domain and DNS": "A delegate login, or someone who can make changes on request",
    "Hosting": "Collaborator access",
    "Brand assets": "Logo, photos, doctor bio, clinic addresses, fees, hours",
  },
  promises: [
    "No change to budgets without your written OK",
    "Every change logged: date, reason, expected effect, check date",
    "You own every account, domain and file. I work as a guest in them",
  ],
};

export const OFFBOARDING = [
  ["Final report", "What was done, results against goals, and what I would do next."],
  ["Handover pack", "Every login, setting and document in one place, with a 30-minute walkthrough for the next person."],
  ["Access returned", "I remove myself from Ads, Analytics, Tag Manager, hosting and Business Profile."],
  ["Files and backups", "Website files, a full backup, and all designs and reports, in your own Google Drive."],
  ["Billing closed", "Final invoice settled."],
  ["Feedback", "A short form: what worked, what didn’t. A testimonial only if you are happy to give one."],
  ["Open door", "7 days of free questions after handover."],
];

/* ───────── the weekly timetable: the same for every client ───────── */
export const TZ_NAME = "IST";
export const WEEKLY = { weekday: 2, hour: 11, minute: 0, label: "Every Tuesday, 11:00 IST" }; // 2 = Tuesday
export const ACTIVE_STAGES = ["onboarding", "delivery", "review"]; // projects that get a weekly update

export const TIMETABLE = [
  ["Monday", "by 18:00", "Ajay writes your weekly update and lists any decisions needed."],
  ["Tuesday", "11:00", "Your weekly update appears on your project page: work done, results, issues, decisions, plan for next week."],
  ["Tuesday to Thursday", "by Thursday 18:00", "You answer the decisions: Yes, No or Other."],
  ["Friday", "", "Agreed decisions are put into action."],
  ["Monday to Saturday", "10:00 to 19:00", "Requests are answered the same working day."],
  ["First Tuesday of the month", "11:00", "The weekly update includes the monthly review: results, spend and next month’s plan."],
  ["1st of the month", "", "Invoice for monthly services, due within 7 days."],
];

const IST_MS = 330 * 60 * 1000; // India has no daylight saving

/* The next weekly update time (a Date) at or after `from`. Today counts if 11:00 has not passed. */
export function nextWeeklyUpdate(from = new Date()) {
  const ist = new Date(from.getTime() + IST_MS); // read the UTC fields of this as India time
  let days = (WEEKLY.weekday - ist.getUTCDay() + 7) % 7;
  const at = (d) => new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + d, WEEKLY.hour, WEEKLY.minute) - IST_MS);
  if (days === 0 && at(0) <= from) days = 7;
  return at(days);
}

/* YYYY-MM-DD (India) of a Date */
export const istDate = (d) => new Date(d.getTime() + IST_MS).toISOString().slice(0, 10);
/* Decisions raised in an update are due by Thursday 18:00 of that week */
export const answerBy = (updateDay) => {
  const d = new Date(updateDay + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 2);
  return d.toISOString().slice(0, 10);
};
