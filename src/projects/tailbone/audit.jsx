/*
 * Tailbone Treatment — Google Ads audit (17 Sep – 16 Oct 2026, billing to 17 Oct).
 * Ported from tailbone_ads_audit.jsx. Data and wording are as supplied; the
 * portal adds issue status (see STATUS) and the kick-off update brief in meeting.jsx.
 */
import { useMemo, useState } from "react";
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell,
} from "recharts";
import { C, FH, FB, inr, inr2, Chip, H2, P, Box, T, Num, OL, Status, StudioOnly } from "../../components/ui.jsx";

export const GST = 1.18;
export const DAYS = 30.4; // Google’s monthly charging limit = 30.4 × daily budget

/* ───────────────────────── data (from your exports) ───────────────────────── */
// Campaign report, 17 Sep – 16 Oct 2026, amounts exclude GST
const CAMP = [
  { id: "p5", name: "Website traffic – PMax-5", budget: "₹180/day", cost: 6553.56, impr: "93,793", clicks: "9,279", ctr: "9.89%", cpc: "₹0.71", conv: "358", cpa: "₹18.31", cvr: "3.83%", tcpa: "₹17.19", verdict: "Unproven, probably low intent", tone: "bad" },
  { id: "p4", name: "Tailbone Treatment – PMax-4", budget: "₹140/day", cost: 558.98, impr: "797", clicks: "26", ctr: "3.26%", cpc: "₹21.50", conv: "9", cpa: "₹62.11", cvr: "34.62%", tcpa: "₹43.00", verdict: "Promising, only ~3 live days", tone: "warn" },
  { id: "yt", name: "YouTube Promotion (11 Oct)", budget: "NA", cost: 1200.85, impr: "NA", clicks: "NA", ctr: "NA", cpc: "NA", conv: "NA", cpa: "NA", cvr: "NA", tcpa: "NA", verdict: "Unmeasured, no report supplied", tone: "info" },
];
const TOTAL_COST = CAMP.reduce((s, c) => s + c.cost, 0);

const EVIDENCE = [
  ["Call asset (account)", "1,071", "217", 173.54, "Phone taps, not confirmed calls"],
  ["Business name (main)", "1,462", "247", 481.48, "Cheap brand-name interactions"],
  ["Logo (main)", "628", "90", 77.6, "Cheap"],
  ["Logo (limited)", "476", "14", 267.87, "Expensive and weak"],
  ["Sitelink: Tailbone Pain Treatment", "235", "35", 428.13, "Search-like pricing"],
  ["Sitelink: Appointment", "225", "32", 427.77, "Search-like pricing"],
  ["Sitelink: WhatsApp Us Now", "164", "26", 422.21, "Search-like pricing"],
];

// Net cost on Google invoices (₹, incl. GST), Jan 2021 → Sep 2026
const ALL = [
  9684.44, 7829.61, 7000.02, 9832.62, 3467.39, 5500.02, 12717.91, 11482.08, 7099.89, 15014.12, 14809.51, 17714.76,
  9952.65, 16290.68, 18837.99, 21611.74, 19742.89, 22830.07, 23895.7, 24407.99, 23167.55, 17052.56, 20271.9, 18500.0,
  16833.05, 15803.15, 19863.78, 20862.54, 19537.39, 11881.33, 14252.85, 16864.18, 18670.79, 20708.39, 17622.5, 18569.08,
  17119.45, 17573.79, 21837.52, 20000.21, 19177.54, 18521.99, 18300.15, 15000.33, 20481.45, 16018.51, 17500.03, 5430.73,
  9134.67, 17381.07, 16001.04, 10554.92, 12317.26, 10448.96, 15837.32, 18993.74, 18241.21, 15718.54, 6660.81, 4442.44,
  13933.84, 11540.98, 17483.54, 11651.36, 13921.58, 7310.31, 13623.97, 9170.97, 8630.74,
];
const MONTHS25 = ["Jan 25", "Feb 25", "Mar 25", "Apr 25", "May 25", "Jun 25", "Jul 25", "Aug 25", "Sep 25", "Oct 25", "Nov 25", "Dec 25", "Jan 26", "Feb 26", "Mar 26", "Apr 26", "May 26", "Jun 26", "Jul 26", "Aug 26", "Sep 26"];
const IMPR25 = [13529, 322308, 128924, 67942, 75599, 55262, 55542, 70118, 119476, 74271, null, 17409, 197958, 84048, 128028, 61848, 57347, 26678, 58278, 38773, 134788];
const TREND = MONTHS25.map((m, i) => ({ m, cost: ALL[ALL.length - 21 + i], impr: IMPR25[i] }));
const YEARLY = [
  { y: "2017", v: 39865 }, { y: "2018", v: 52500 }, { y: "2019", v: 68000 }, { y: "2020", v: 87118 },
  { y: "2021", v: 122152 }, { y: "2022", v: 236562 }, { y: "2023", v: 211469 }, { y: "2024", v: 206962 },
  { y: "2025", v: 155732 }, { y: "2026*", v: 107267 },
];
const PAY26 = [ // month, net cost, payments
  ["Jan", 13933.84, 14000], ["Feb", 11540.98, 11300], ["Mar", 17483.54, 17150], ["Apr", 11651.36, 11700],
  ["May", 13921.58, 13900], ["Jun", 7310.31, 7400], ["Jul", 13623.97, 14510], ["Aug", 9170.97, 8600], ["Sep", 8630.74, 7800],
];

// All 27 conversion actions, Goals > Conversions > Summary, pasted 18 Oct 2026
// [name, goal, source, status, optimisation, count, window, all conv., value, group, verdict]
const CONV27 = [
  ["TailboneTreatment Leads (UA)", "Submit lead forms", "Universal Analytics", "No recent conversions", "Secondary", "Every", "30 days", 22945.5, 0, "legacy", "Leave. Old product, already Secondary"],
  ["Business profile - Form", "Submit lead forms", "Business Profile", "No recent conversions", "Primary", "One", "30 days", 71, 71, "bp", "Not from ads. Keep out of the campaign"],
  ["Business profile - Form submit", "Submit lead forms", "Business Profile", "No recent conversions", "Primary", "One", "30 days", 3, 3, "bp", "Not from ads. Keep out of the campaign"],
  ["tailbonetreatment_leads (GA4)", "Submit lead forms", "GA4 import", "No recent conversions", "Primary", "Every", "90 days", 17659.34, 0, "legacy", "Do not use until the GA4 event is checked"],
  ["Form (GA4)", "Submit lead forms", "GA4 import", "No recent conversions", "Primary", "Every", "90 days", 0, 0, "empty", "Unused. Ignore"],
  ["Calls from ads", "Phone call leads", "Call from ads", "No recent conversions", "Primary", "One", "30 days", 50, 122, "call", "KEEP. One conversion, 60 seconds"],
  ["Calls from Smart Campaign Ads", "Phone call leads", "Call from ads", "No recent conversions", "Primary", "One", "30 days", 17, 0, "call", "Cannot be edited. Fires only for Smart campaigns"],
  ["Business profile - Tracked call", "Phone call leads", "Business Profile", "No recent conversions", "Primary", "One", "30 days", 11, 11, "bp", "Not from ads"],
  ["New Phone Call Lead By SPH", "Phone call leads", "Call from ads", "No recent conversions", "Primary", "One", "30 days", 3, 15, "call", "Set Secondary if allowed. Possible duplicate"],
  ["Call ads 2025", "Phone call leads", "Call from ads", "No recent conversions", "Primary", "Every", "30 days", 1, 30, "call", "Set Secondary if allowed. Possible duplicate"],
  ["Smart campaign ad clicks to call", "Contacts", "Call from ads", "No recent conversions", "Primary", "Every", "30 days", 9, 9, "call", "Smart campaign only. Leave"],
  ["Clicks to call", "Contacts", "Google hosted", "Active", "Primary", "Every", "30 days", 143, 143, "soft", "Tap on a call button. Keep the Contacts goal out"],
  ["Smart campaign map clicks to call", "Contacts", "Google hosted", "No recent conversions", "Secondary", "Every", "30 days", 1, 1, "call", "Smart campaign only. Leave"],
  ["Business profile - Call", "Contacts", "Business Profile", "No recent conversions", "Primary", "One", "30 days", 755, 755, "bp", "Free profile calls, not ads. A demand signal"],
  ["Contact Us (UA)", "Contacts", "Universal Analytics", "No recent conversions", "Primary", "Every", "30 days", 0, 0, "empty", "Unused. Ignore"],
  ["Contact Us (GA4)", "Contacts", "GA4 import", "No recent conversions", "Primary", "Every", "90 days", 0, 0, "empty", "Unused. Ignore"],
  ["Give us Call", "Book appointments", "Website", "Needs attention", "Primary", "Every", "90 days", 0, 0, "empty", "Tag inactive. Fix later or ignore"],
  ["Request quote", "Request quotes", "Website", "Inactive", "Primary", "One", "90 days", 0, 0, "empty", "Not relevant to a clinic. Ignore"],
  ["Android installs (all other apps)", "Downloads", "Mobile app", "No recent conversions", "Primary", "One", "30 days", 0, 0, "empty", "No app. Ignore"],
  ["Smart campaign map directions", "Get directions", "Google hosted", "No recent conversions", "Secondary", "Every", "30 days", 3, 3, "soft", "Smart campaign only. Leave"],
  ["Local actions - Directions", "Get directions", "Google hosted", "Active", "Primary", "Every", "30 days", 2047, 2047, "soft", "Soft. Keep the Get directions goal out"],
  ["Business profile - Directions", "Get directions", "Business Profile", "No recent conversions", "Primary", "One", "30 days", 33, 33, "soft", "Soft. Keep the goal out"],
  ["Business profile - Learn more", "Engagements", "Business Profile", "No recent conversions", "Primary", "One", "30 days", 425, 425, "soft", "Soft. Keep the Engagements goal out"],
  ["YouTube channel subscriptions", "Engagements", "YouTube hosted", "Active", "Primary", "One", "30 days", 1210, 1210, "soft", "Soft. A subscriber is not a patient"],
  ["Local actions - Other engagements", "Engagements", "Google hosted", "Active", "Primary", "Every", "30 days", 2312, 2312, "soft", "Soft. The largest recent source"],
  ["Local actions - Website visits", "Page views", "Google hosted", "Active", "Primary", "Every", "30 days", 43, 43, "soft", "Soft. Keep the Page views goal out"],
  ["YouTube follow-on views", "YouTube follow-on views", "YouTube hosted", "Active", "Primary", "Every", "30 days", 256, 256, "soft", "Soft. Keep the goal out"],
];
const GROUPS = {
  call: ["Real call wins from ads", "good"],
  bp: ["Business Profile calls and forms (not ads)", "info"],
  soft: ["Soft actions (directions, engagements, views, subscriptions)", "bad"],
  legacy: ["Analytics imports (old or unverified)", "warn"],
  empty: ["Unused, broken or inactive", "info"],
};
const OCT_PAY = [["2 Oct", 600], ["5 Oct", 600], ["7 Oct", 600], ["10 Oct", 900], ["12 Oct", 1400], ["15 Oct", 800], ["16 Oct", 800]];
const DAILY = [["1 Aug",353.9,49.82,0.0,0.0,997.99],["2 Aug",362.07,52.16,0.0,0.0,583.76],["3 Aug",343.15,49.7,0.0,0.0,1090.91],["4 Aug",347.31,51.06,0.0,0.0,692.54],["5 Aug",299.64,52.69,0.0,0.0,340.21],["6 Aug",0.02,3.68,0.0,0.0,336.51],["7 Aug",383.26,97.08,0.0,0.0,756.17],["8 Aug",261.85,20.45,0.0,0.0,473.87],["9 Aug",0.01,1.76,0.0,0.0,472.1],["10 Aug",0.0,0.0,0.0,0.0,472.1],["11 Aug",2.6,2.07,0.0,0.0,467.43],["12 Aug",499.9,240.0,0.0,0.0,627.53],["13 Aug",7.17,38.56,0.0,0.0,581.8],["14 Aug",0.11,0.4,0.0,0.0,581.29],["15 Aug",281.56,240.0,0.0,0.0,1659.73],["16 Aug",499.97,240.0,0.0,0.0,919.76],["17 Aug",45.93,53.32,0.0,0.0,820.51],["18 Aug",0.01,0.0,0.0,0.0,820.5],["19 Aug",0.0,0.0,0.0,0.0,820.5],["20 Aug",0.76,1.44,0.0,0.0,818.3],["21 Aug",237.57,39.99,0.0,0.0,1440.74],["22 Aug",240.65,41.69,0.0,0.0,1158.4],["23 Aug",180.44,31.05,0.0,0.0,946.91],["24 Aug",272.55,80.0,0.0,0.0,1494.36],["25 Aug",232.15,35.53,0.0,0.0,1226.68],["26 Aug",222.08,80.0,0.0,0.0,2324.6],["27 Aug",232.9,13.11,0.0,0.0,2078.59],["28 Aug",221.59,29.7,0.0,0.0,1827.3],["29 Aug",229.93,29.64,0.0,0.0,1567.73],["30 Aug",239.97,30.68,0.0,0.0,2397.08],["31 Aug",220.16,28.61,0.0,0.0,830.74],["1 Sep",257.28,41.15,0.0,0.0,532.31],["2 Sep",239.19,41.85,0.0,0.0,251.27],["3 Sep",108.03,17.36,0.0,0.0,125.88],["4 Sep",353.22,66.68,0.0,0.0,805.98],["5 Sep",252.16,45.16,0.0,0.0,508.66],["6 Sep",171.43,44.69,0.0,0.0,292.54],["7 Sep",0.3,0.0,0.0,0.0,292.24],["8 Sep",7.55,0.0,0.0,0.0,284.69],["9 Sep",0.0,0.0,0.0,0.0,284.69],["10 Sep",458.72,0.0,0.0,0.0,1025.97],["11 Sep",459.95,0.0,0.0,0.0,566.02],["12 Sep",459.96,0.0,0.0,0.0,1306.06],["13 Sep",385.0,0.0,0.0,0.0,921.06],["14 Sep",223.63,0.0,0.0,0.0,697.43],["15 Sep",48.16,0.0,0.0,0.0,649.27],["16 Sep",0.01,0.0,0.0,0.0,649.26],["17 Sep",0.0,0.0,0.0,0.0,1849.26],["18 Sep",380.01,0.0,0.0,0.0,1469.25],["19 Sep",410.36,0.0,0.0,0.0,1058.89],["20 Sep",232.29,0.0,0.0,0.0,1526.6],["21 Sep",563.23,0.0,0.0,0.0,963.37],["22 Sep",30.14,0.0,0.0,0.0,933.23],["23 Sep",0.0,0.0,0.0,0.0,933.23],["24 Sep",678.76,0.0,0.0,0.0,1854.47],["25 Sep",664.76,0.0,0.0,0.0,1189.71],["26 Sep",0.0,0.0,0.0,0.0,1189.71],["27 Sep",24.39,0.0,0.0,0.0,1165.32],["28 Sep",0.0,0.0,0.0,0.0,1165.32],["29 Sep",568.79,0.0,0.0,0.0,1396.53],["30 Sep",111.39,0.0,0.0,0.0,0.0],["1 Oct",0.0,0.0,0.0,0.0,0.0],["2 Oct",0.69,0.0,0.0,0.0,599.31],["3 Oct",359.97,0.0,0.0,0.0,239.34],["4 Oct",148.86,0.0,0.0,0.0,90.48],["5 Oct",359.99,0.0,0.0,0.0,330.49],["6 Oct",140.6,0.0,0.0,0.0,189.89],["7 Oct",226.94,0.0,0.0,0.0,562.95],["8 Oct",178.14,0.0,0.0,0.0,384.81],["9 Oct",123.89,0.0,0.0,0.0,260.92],["10 Oct",238.8,0.0,0.0,0.0,922.12],["11 Oct",225.66,0.0,71.98,0.0,624.48],["12 Oct",29.07,0.0,198.33,0.0,1797.08],["13 Oct",318.35,0.0,190.74,0.0,1287.99],["14 Oct",176.77,0.0,225.05,279.48,606.69],["15 Oct",0.71,0.0,1.67,0.0,1404.31],["16 Oct",359.96,0.0,251.04,279.39,1338.79],["17 Oct",81.8,0.0,261.89,126.27,1.1]];
const DAILY_ROWS = DAILY.map((r) => ({ d: r[0], p5: r[1], vv: r[2], yt: r[3], p4: r[4], bal: r[5] }));
// Billing ledger 1 Aug – 17 Oct 2026, net of credits, ex-GST
const LEDGER = [
  ["Website traffic, PMax-5", 16278.12, 71, 229.27, 678.76, "24 Sep"],
  ["Video Views Camp 1 (1 Aug – 6 Sep)", 1891.08, 34, 55.62, 240.0, "12 Aug"],
  ["YouTube Promotion (from 11 Oct)", 1200.7, 7, 171.53, 261.89, "17 Oct"],
  ["Tailbone Treatment, PMax-4 (from 14 Oct)", 685.14, 3, 228.38, 279.48, "14 Oct"],
];
const LEDGER_TOTAL = LEDGER.reduce((s, r) => s + r[1], 0);

/* ───────────────────────── content ───────────────────────── */
const ISSUES = [
  { sev: "bad", sl: "Critical", lvl: "Fact", t: "Prepaid balance is ₹1.10, so ads stop the moment it reaches zero",
    ev: "Available funds are ₹1.10 after 7 top-ups in 15 days. On 30 Sep the ₹1,316.55 month-end GST charge took the balance to ₹0.00, and 1 Oct shows no spend at all (2 Oct: ₹0.69, until a ₹600 top-up). The account is eligible for postpay.",
    fix: "Switch to postpay (billed on the 1st or at your threshold), or hold about ₹1,500 on top of campaign spend for the month-end GST. Keep Visa •••• 3337 as the backup card." },
  { sev: "bad", sl: "Critical", lvl: "Fact", t: "Conversions carry no money value, so ROI cannot be measured",
    ev: "Conv. value equals the conversion count in both campaigns (358.00 = 358, 9.00 = 9). Every conversion is worth a default ₹1.",
    fix: "Make only real actions Primary (call over 60 s, appointment form, WhatsApp click on the booking page). Move page views and generic clicks to Secondary. Assign a rupee value to each." },
  { sev: "bad", sl: "Critical", lvl: "Fact", t: "24 of 27 conversion actions are Primary, and the recording ones are soft",
    ev: "All 27 actions add up to 47,997.84 conversions since 2014. Six actions are Active, all Primary: Local actions - Other engagements, Local actions - Directions, YouTube channel subscriptions, YouTube follow-on views, Clicks to call and Website visits (6,011 conversions). Real call wins from ads total 81, which is 0.2%.",
    fix: "Build the new campaign on the Phone call leads goal only, and keep every soft goal out of it. See the Conversion audit tab." },
  { sev: "bad", sl: "Critical", lvl: "Inference", t: "The 358 conversions were probably light actions (map taps, views), not calls",
    ev: "Only soft, Google-hosted or YouTube-hosted actions are recording. A campaign buying YouTube and Maps inventory at ₹0.71 a click would collect exactly these. Not proven: the per-campaign split is unknown, and the table covers all time since 2014.",
    fix: "In Campaigns, segment by Conversion action for 17 Sep to 16 Oct. That shows which action produced the 358, and the clinic’s call and form log gives the real count." },
  { sev: "warn", sl: "High", lvl: "Fact", t: "85% of recorded conversions come from two Analytics actions",
    ev: "The Universal Analytics action (22,945.50, Secondary) and the GA4 import tailbonetreatment_leads (17,659.34, Primary, counts Every, value ₹0) add to 40,604.84 of 47,997.84. They are lifetime totals since 2014, and neither is Active, so they are history.",
    fix: "Do not use them. Check in GA4 (Admin, Events) what tailbonetreatment_leads fires on before it is ever Primary again." },
  { sev: "info", sl: "Low", lvl: "Fact", t: "Some conversion actions cannot be edited",
    ev: "Calls from Smart Campaign Ads was created by Google Ads and can’t be edited. It only fires for Smart campaigns, and none is running.",
    fix: "Leave it. Control what counts through the campaign’s goal choice, not by editing every action." },
  { sev: "bad", sl: "High", lvl: "Fact", t: "Geography does not match the clinics",
    ev: "Ad text says clinics in New Delhi and Bangalore. PMax-5 targets Hyderabad, Gurugram, Mumbai, Pune, Noida, Delhi, Madhya Pradesh, Rajasthan, Chhattisgarh. PMax-4 targets Patna, Mumbai, Pune, Andhra Pradesh, Delhi, Gujarat, Maharashtra, Chhattisgarh. Karnataka was removed from PMax-4 on 13 Oct, so Bangalore is targeted nowhere.",
    fix: "Limit to the cities patients can actually reach (Delhi NCR, Bangalore), using Presence targeting. Keep other states only if the doctor travels or consults online." },
  { sev: "warn", sl: "High", lvl: "Fact", t: "The clinic has two websites that disagree",
    ev: "tailbonetreatment.com is the older WordPress site: it still lists a Bangalore clinic and calls itself India’s No. 1. The newer site (tailbone.onrender.com, canonical tailbone.netlify.app) lists New Delhi, online, Lucknow soon and Bengaluru closed, with a booking system, consultation ₹800 and follow-up ₹500. The old conversion tags belong to the old site.",
    fix: "Move the new site onto the clinic’s own domain, tailbonetreatment.com, so there is one site. Until then, remove Bangalore and superlative claims from the old pages. Install and test the Google tag on the new site before ads go live." },
  { sev: "bad", sl: "High", lvl: "Fact", t: "PMax-5 settings changed often, so it could not settle",
    ev: "Budget ₹230 to ₹380 (18 Sep), then ₹380 to ₹180 (29 Sep). Locations edited on 18 Sep and 25 Sep. New headlines, long headlines, search themes and the audience persona were replaced on 16 Oct.",
    fix: "Freeze both PMax campaigns for 14 days except for the conversion and geography fixes. Then judge on real enquiries only." },
  { sev: "bad", sl: "High", lvl: "Fact", t: "Two video campaigns took 15% of spend since 1 August",
    ev: "Video Views Camp 1 (1 Aug to 6 Sep) cost ₹1,891 net after ₹315 was credited back. YouTube Promotion started 11 Oct at ₹72 and climbed to ₹262 a day, now your largest daily spender: ₹1,201 in 7 days for 15,577 views or clicks, about ₹0.08 each. Both buy views, not appointments, and neither appears in your Campaigns view.",
    fix: "Pause YouTube Promotion unless you can show calls from it. Do not restart view campaigns until Search and tracking work. Judge any video spend on calls and appointments only." },
  { sev: "warn", sl: "Medium", lvl: "Fact", t: "PMax-5 spend swings between zero and double budget",
    ev: "Over 78 days PMax-5 spent under ₹40 on 23 days and ₹330 or more on 21 days (median day ₹225). Zero days with funds available: 22–23 Sep, 26–28 Sep (after the 25 Sep location edit), 12 Oct and 15 Oct. On 15 Oct all three campaigns went near zero together. PMax-4 also spent ₹279 on two of its three live days, double its ₹140 budget, and nothing on 15 Oct.",
    fix: "Treat the daily budget as an average: the monthly cap is 30.4 × the daily budget. Stop editing for 14 days so delivery can settle, and open the policy view on zero days." },
  { sev: "warn", sl: "High", lvl: "Fact", t: "Most assets are policy-limited, and two are disapproved",
    ev: "“Most asset groups limited by policy”. 25 of 34 assets read Approved (limited). Disapproved: the coccygodynia sitelink and one logo. PMax-5 text includes “Exercise and Back Pain cure”, “Rated Chiropractors in India”, “proven methods” and “lasting relief”, which are claim-risk wording.",
    fix: "Open Policy manager and read which policy each flag cites. Remove cure, rated, proven and lasting claims. Re-submit the two assets. Verify before applying for healthcare certification (see note below)." },
  { sev: "warn", sl: "Medium", lvl: "Fact", t: "Target cost-per-result values did not match real costs",
    ev: "PMax-5 target ₹17.19 favours whichever low-cost action converts. PMax-4 target ₹43 against ₹21.50 CPC would need over 50% of clicks to convert, but actual cost per conversion is ₹62.11, so bidding is throttled.",
    fix: "After the conversion fix, run Maximise conversions for about two weeks, then set Target CPA near 1.2× the cost per real enquiry." },
  { sev: "warn", sl: "Medium", lvl: "Fact", t: "No Search campaign at all",
    ev: "Search impressions are 0 in the window. Condition-based searches (“tailbone pain treatment”, “coccyx pain doctor Delhi”) are the highest-intent traffic. Sitelink clicks costing ₹12 to ₹16 show what that intent costs.",
    fix: "Launch a Search campaign on phrase and exact match with negatives, call and location assets, and clinic-hours scheduling." },
  { sev: "info", sl: "Medium", lvl: "Fact", t: "Many assets and Average ad strength",
    ev: "24 sitelinks, 12 with zero impressions, many duplicated across both campaigns. Both asset groups show ad strength Average.",
    fix: "Delete zero-impression duplicates, keep 4 to 6 strong sitelinks per campaign, and add proper video and image variety." },
  { sev: "info", sl: "Low", lvl: "Fact", t: "Scores and prompts to ignore for now",
    ev: "Optimisation score 93% and 89% measures applied suggestions, not patients. “Optimise budgets +2.8%” would buy more of the same clicks. “Improve app bidding coverage” does not apply, since you run no app campaign.",
    fix: "Dismiss them. Do not apply budget recommendations until conversions are clean." },
];

/* Where each issue stands after the 18 Oct rebuild (old campaigns paused, new Search campaign published).
   Same order as ISSUES. `now` is what to tell the doctor. */
export const ISSUE_STATUS = [
  ["Contained", "Decision: stay on prepay on purpose, because the balance is the only hard stop for the ₹10,000 cap. Doctor loads ₹3,500 on 19 Oct. The month-end GST is taken from the balance, so the load must cover it (Oct buffer is about ₹430)."],
  ["Open", "New campaign bids on clicks, so values do not matter yet. Before switching to conversion bidding (2 Nov at the earliest), set the call value from revenue per patient."],
  ["Contained", "The new campaign uses only the Phone call leads goal, so soft actions cannot train it. Account-level clean-up (SPH and Call ads 2025 to Secondary) is still to do."],
  ["Open", "Cannot be settled without the clinic’s call and WhatsApp log for 17 Sep – 16 Oct. Needed from the doctor."],
  ["Open", "Left alone (no campaign uses them). Check the GA4 event before it is ever Primary again."],
  ["Done", "No action needed. Controlled by the campaign’s goal choice."],
  ["Fixed", "New campaign targets Delhi, Faridabad, Ghaziabad, Gurugram and Noida only. Bangalore is closed, Lucknow not open yet. Verify Presence is selected."],
  ["Before launch", "Still open, and it blocks launch: the ad’s final URL is tailbonetreatment.com, which still mentions Bangalore and “India’s No. 1”. Clean it or point the ad at the new site."],
  ["Superseded", "PMax-5 is paused, so the reset problem has stopped. Rule from now on: one big change per campaign every 14 days, logged."],
  ["Fixed", "YouTube Promotion paused. Video Views Camp 1 ended 6 Sep. No view campaigns until Search and tracking prove themselves."],
  ["Superseded", "PMax-5 is paused. The new campaign’s ₹200 is an average: one day can reach ₹400, a month cannot pass 30.4 × ₹200."],
  ["Fixed", "PMax assets no longer serve. The new ad has no cure, rated, proven or No. 1 claims, and three flagged keywords were removed."],
  ["Superseded", "New campaign uses Maximise clicks with a ₹40 cap. Target CPA comes back only after real calls are recorded."],
  ["Fixed", "Search | Tailbone | Delhi NCR | Oct 2026 published: 15 phrase and exact keywords, Search network only, start 19 Oct."],
  ["Fixed", "New campaign starts clean with 4 sitelinks and ad strength Good. Old clutter sits in paused campaigns."],
  ["In progress", "Auto-apply recommendations being turned off. Budget prompts stay dismissed until conversions are clean."],
];

const RIGHT = [
  "PMax-4 copy is intent-led (“Pain While Sitting? Call Now”, “Schedule Your Consultation”) and avoids cure claims.",
  "Early PMax-4 signal is encouraging: 9 conversions from 26 clicks at ₹21.50 per click, a price that fits real searchers (small sample).",
  "Contact paths exist: call asset (217 taps at ₹0.80), WhatsApp, appointment and doctor-finder sitelinks.",
  "Audience signals and search themes match the condition (coccyx pain, post-pregnancy, long sitting).",
  "Budget reflexes are good: PMax-5 was cut from ₹380 to ₹180 within 11 days of the increase.",
  "Spend is controlled: the last 12 months average ₹11.2k, about 43% below the 2022 yearly total. Google credited ₹139 of invalid-click and overrun adjustments since 1 Aug.",
  "Account is verified (organisation verified 23 Jan 2025) with two cards on file.",
];

const OPTIONS = [
  { when: "Today", items: [
    ["Option 1", "Fix funding. Switch to postpay or top up at least ₹1,000 buffer, so serving does not stop mid-learning."],
    ["Option 2", "Find the YouTube Promotion campaign (include paused and ended). Pause it unless it produced calls. Export its report."],
    ["Option 3", "Stop editing both PMax campaigns for 14 days except for the fixes below."],
  ] },
  { when: "This week", items: [
    ["Option 4", "Conversion audit: Goals > Conversions > Summary. Primary = call over 60 s, appointment form, booking-page WhatsApp. Everything else Secondary. Add values."],
    ["Option 5", "Count real leads for 17 Sep to 16 Oct from phone log, WhatsApp and form entries. Compare with 367."],
    ["Option 6", "Geography: Presence only, clinic cities only. Restore Karnataka/Bangalore if that clinic is live."],
    ["Option 7", "Policy: remove “cure”, “Rated”, “proven”, “lasting relief”. Fix the disapproved sitelink and logo. Delete zero-impression duplicate sitelinks."],
    ["Option 8", "Budgets: all old campaigns stay paused. Search runs alone at ₹200/day with a ₹40 click cap, and the account never exceeds ₹10,000 a month incl. GST."],
    ["Option 12", "Integrity check: ask who created the conversion actions, review who has access, and match the Ads conversions against the clinic’s call and WhatsApp log."],
    ["Option 13", "Conversion clean-up: the new campaign uses only the Phone call leads goal. Leave Calls from ads as is (One conversion, 60 seconds). Set SPH and Call ads 2025 to Secondary if the screen allows. Details on the Conversion audit tab."],
  ] },
  { when: "Next 30 days", items: [
    ["Option 9", "Build the Search campaign (₹100 to ₹150/day): phrase and exact match, negatives, call and location assets, clinic-hours schedule."],
    ["Option 10", "Record how each new patient found you (ask on the call, add a source field on the form), then import booked patients as offline conversions weekly."],
    ["Option 11", "Weekly scorecard: cost per real enquiry, enquiry-to-patient rate, ROI, share of spend on high-intent traffic."],
  ] },
];

const PRESETS = {
  launch: { label: "Launched: Search ₹200", b: { search: 200, p4: 0, p5: 0, yt: 0 } },
  earned: { label: "If earned: ₹250", b: { search: 250, p4: 0, p5: 0, yt: 0 } },
  ceiling: { label: "Ceiling: ₹278", b: { search: 278, p4: 0, p5: 0, yt: 0 } },
  old: { label: "Old budgets (comparison)", b: { search: 0, p4: 140, p5: 180, yt: 170 } },
};
const ASSUME0 = {
  search: { name: "New Search campaign", cpc: 20, rate: 8 },
  p4: { name: "PMax-4 Tailbone Treatment", cpc: 21.5, rate: 12 },
  p5: { name: "PMax-5 Website traffic", cpc: 0.71, rate: 0.5 },
  yt: { name: "YouTube Promotion", cpc: 1, rate: 0.3 },
};
const monthly = (b) => (b.search + b.p4 + b.p5 + b.yt) * DAYS * GST;

/* ───────────────────────── tabs ───────────────────────── */
function Verdict() {
  const share = (v) => `${((v / TOTAL_COST) * 100).toFixed(1)}%`;
  return (
    <div>
      <h1 className="text-3xl mb-3" style={{ fontFamily: FH, color: C.deep, fontWeight: 600, lineHeight: 1.2, maxWidth: "24ch" }}>
        Most of the budget went to low-cost clicks that cannot yet be linked to patients
      </h1>
      <P>Over the last 30 days, 79% of spend went to “Website traffic – PMax-5”, which pays ₹0.71 per click and reports 358 conversions. That is like a pedometer counting a shaken wrist as steps: the number looks athletic, the activity may not be. Meanwhile the campaign that names your treatment has barely begun, and the prepaid balance is ₹1.10.</P>

      <div className="mb-1 text-xs" style={{ color: C.mute }}>Where ≈{inr(TOTAL_COST)} (before 18% GST) went</div>
      <div className="flex w-full mb-2" style={{ height: 34, borderRadius: 3, overflow: "hidden" }}>
        {CAMP.map((c, i) => (
          <div key={c.id} title={c.name} style={{ width: share(c.cost), background: [C.bad, C.warn, C.info][i], color: "#fff", fontSize: 12, display: "flex", alignItems: "center", paddingLeft: 8, whiteSpace: "nowrap", overflow: "hidden" }}>
            {share(c.cost)}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-4 text-xs mb-4" style={{ color: C.mute }}>
        {CAMP.map((c, i) => (
          <span key={c.id}><span style={{ display: "inline-block", width: 10, height: 10, background: [C.bad, C.warn, C.info][i], marginRight: 6 }} />{c.name}: {inr2(c.cost)}</span>
        ))}
      </div>

      <Box tone="warn" title="Correction to my first read">
        I called PMax-4 “barely spending (13% of budget)”. Your change history shows it was paused until 13 Oct 23:37, so its 30-day figures cover about 3 live days. Since reactivation it spends close to its ₹140 budget (billing shows ₹685.28 for October up to 17 Oct). “Limited by budget” and “bidding strategy learning” are therefore normal for it, not a fault.
      </Box>

      <Box tone="info" title="New from your billing ledger (1 Aug – 17 Oct)">
        The daily ledger reconciles exactly with your invoices (Aug ₹9,170.97, Sep ₹8,630.74, Oct ₹5,698.90). Campaigns cost ₹20,055 net before GST: PMax-5 took 81%, video campaigns 15%, and PMax-4 3%. The balance hit ₹0.00 on 30 Sep, so nothing ran on 1 Oct.
      </Box>

      <Box tone="warn" title="New: the full conversion list (27 actions)">
        Since 2014, only 81 of 47,998 recorded conversions (0.2%) are real call wins from ads. 85% come from two old Analytics actions, and the six actions recording right now are soft ones such as Maps engagements and YouTube subscriptions. So the 358 conversions are probably not enquiries. See the Conversion audit tab.
      </Box>

      <H2>What the data proves, suggests and cannot show</H2>
      <T head={["Level", "Statement"]} rows={[
        [<Chip tone="good" key="a">Fact</Chip>, "PMax-5 took 92% of the two-campaign spend and 99% of impressions at a 9.89% CTR and ₹0.71 CPC."],
        [<Chip tone="good" key="b">Fact</Chip>, "No conversion carries a money value, and Search spend is zero."],
        [<Chip tone="good" key="c">Fact</Chip>, "Clicks sit in two price tiers: ₹0.20 to ₹2 per tap versus ₹12 to ₹19 per click (table on the ROI tab)."],
        [<Chip tone="warn" key="d">Inference</Chip>, "Most PMax-5 conversions are soft actions (taps, views) on low-quality inventory."],
        [<Chip tone="info" key="e">Unknown</Chip>, "How many patients actually booked from ads. No revenue or booking data was provided, so true ROI cannot be computed yet."],
        [<Chip tone="info" key="f">Unknown</Chip>, "YouTube Promotion performance (₹1,200.85 spent, no report supplied)."],
      ]} />

      <H2>Three numbers to hold on to</H2>
      <T head={["Item", "Amount", "Meaning"]} right={[1]} rows={[
        ["30-day spend, all three campaigns", inr(TOTAL_COST), "Ads-account view, excludes GST. YouTube is billing data through 17 Oct."],
        ["Same spend with 18% GST", inr(TOTAL_COST * GST), "What your card actually pays. A ₹320/day budget costs about ₹378/day."],
        ["Balance available today", "₹1.10", "Ads stop at zero. Fix this first."],
      ]} />
    </div>
  );
}

function RoiTab() {
  const [rev, setRev] = useState(800);
  const [pts, setPts] = useState({ p5: 0, p4: 0, yt: 0 });
  const rows = CAMP.map((c) => {
    const spend = c.cost * GST;
    const p = pts[c.id];
    const revenue = p * rev;
    return { c, spend, p, revenue, roi: spend ? ((revenue - spend) / spend) * 100 : 0, cpp: p > 0 ? spend / p : null, need: Math.ceil(spend / Math.max(rev, 1)) };
  });
  const totSpend = rows.reduce((s, r) => s + r.spend, 0);
  const totRev = rows.reduce((s, r) => s + r.revenue, 0);
  return (
    <div>
      <H2>Campaign scorecard (17 Sep – 16 Oct 2026, ex-GST)</H2>
      <T head={["Campaign", "Budget", "Cost", "Impr.", "Clicks", "CTR", "CPC", "Conv.", "Cost / conv.", "Conv. rate", "Target CPA", "Verdict"]}
        right={[2, 3, 4, 5, 6, 7, 8, 9, 10]}
        rows={CAMP.map((c) => [c.name, c.budget, inr2(c.cost), c.impr, c.clicks, c.ctr, c.cpc, c.conv, c.cpa, c.cvr, c.tcpa, <Chip key={c.id} tone={c.tone}>{c.verdict}</Chip>])} />

      <H2>Why PMax-5 looks suspicious: two price tiers inside one account</H2>
      <P>Asset-level clicks (account-wide, so they cannot be split by campaign) show tiny prices for brand and tap-type interactions, and 10 to 60 times higher prices where Search-style traffic appears. A campaign whose average is ₹0.71 per click is dominated by the cheap tier.</P>
      <T head={["Asset", "Impr.", "Clicks", "Cost", "Cost ÷ clicks", "Note"]} right={[1, 2, 3, 4]}
        rows={EVIDENCE.map(([a, i, k, cost, note]) => [a, i, k, inr2(cost), inr2(cost / Number(k)), note])} />
      <P style={{ color: C.mute }}>Five low-cost sitelinks (Find a Doctor, Testimonials, Contact Us, TBT Cushion, Blog) together drew 195 interactions for ₹42.65, about ₹0.22 each.</P>

      <H2>ROI calculator</H2>
      <P>Google cannot see patients, so ROI needs two numbers from you: what a new patient is worth, and how many booked from each campaign in the same 30 days. The ₹800 starting value is the first consultation fee on your website. Add ₹500 for each follow-up visit within 7 days to see a fuller figure, and replace it with the doctor’s real average.</P>
      <div className="p-4 mb-3" style={{ background: C.card, border: `1px solid ${C.rule}`, borderRadius: 4 }}>
        <Num label="Revenue per new patient (₹)" value={rev} onChange={setRev} step={100} width={150} />
        <Num label="Patients from PMax-5" value={pts.p5} onChange={(v) => setPts({ ...pts, p5: v })} />
        <Num label="Patients from PMax-4" value={pts.p4} onChange={(v) => setPts({ ...pts, p4: v })} />
        <Num label="Patients from YouTube" value={pts.yt} onChange={(v) => setPts({ ...pts, yt: v })} />
      </div>
      <T head={["Campaign", "Spend incl. GST", "Patients", "Revenue", "ROI", "Cost per patient", "Patients to break even"]} right={[1, 2, 3, 4, 5, 6]}
        rows={[...rows.map((r) => [r.c.name, inr(r.spend), r.p, inr(r.revenue),
          <span key={r.c.id} style={{ color: r.roi >= 0 ? C.good : C.bad, fontWeight: 600 }}>{r.roi.toFixed(0)}%</span>,
          r.cpp ? inr(r.cpp) : "NA", r.need]),
          [<b key="t">All campaigns</b>, <b key="s">{inr(totSpend)}</b>, rows.reduce((s, r) => s + r.p, 0), <b key="r">{inr(totRev)}</b>,
            <b key="o" style={{ color: totRev >= totSpend ? C.good : C.bad }}>{(((totRev - totSpend) / totSpend) * 100).toFixed(0)}%</b>, "", Math.ceil(totSpend / Math.max(rev, 1))]]} />
      <H2>Spend since 1 August (billing ledger, net of credits, ex-GST)</H2>
      <T head={["Campaign", "Net cost", "Share", "Live days", "Avg per live day", "Peak day", "Patients to break even (incl. GST)"]} right={[1, 2, 3, 4, 5, 6]}
        rows={[...LEDGER.map((r) => [r[0], inr(r[1]), `${((r[1] / LEDGER_TOTAL) * 100).toFixed(1)}%`, r[2], inr(r[3]), `${inr(r[4])} (${r[5]})`, Math.ceil((r[1] * GST) / Math.max(rev, 1))]),
          [<b key="t">All campaigns</b>, <b key="n">{inr(LEDGER_TOTAL)}</b>, "100%", "", "", "", Math.ceil((LEDGER_TOTAL * GST) / Math.max(rev, 1))]]} />
      <P style={{ color: C.mute }}>Billing counts for PMax mix clicks and impressions, so cost per click cannot be taken from the ledger. Video Views Camp 1 had ₹315 credited back on its heaviest days.</P>

      <Box title="How to read this">
        At ₹{rev.toLocaleString("en-IN")} per new patient, the three campaigns need about {Math.ceil(totSpend / Math.max(rev, 1))} booked patients in 30 days to pay for themselves. Because break-even is so low, a campaign can be ROI-positive and still wasteful, so also watch cost per patient and track which campaign each patient came from.
      </Box>
    </div>
  );
}

function RightWrong() {
  const wrong = ISSUES.map((w, i) => ({ ...w, st: ISSUE_STATUS[i] })).filter((i) => i.sl !== "Low");
  return (
    <div>
      <P>Plain summary for the doctor. Left: what the account was already doing well. Right: what to improve, and where each item stands now that the old campaigns are paused and the Search campaign is built.</P>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <H2>What is going right</H2>
          <ul className="text-sm" style={{ lineHeight: 1.6 }}>
            {RIGHT.map((r, i) => (
              <li key={i} className="mb-3 pl-3" style={{ borderLeft: `3px solid ${C.good}`, color: C.ink }}>{r}</li>
            ))}
          </ul>
        </div>
        <div>
          <H2>What to improve, and where it stands</H2>
          <ul className="text-sm" style={{ lineHeight: 1.6 }}>
            {wrong.map((w, i) => (
              <li key={i} className="mb-4 pl-3" style={{ borderLeft: `3px solid ${C[w.sev === "info" ? "warn" : w.sev]}`, color: C.ink }}>
                <div className="flex flex-wrap gap-2 items-center mb-1"><Chip tone={w.sev}>{w.sl}</Chip><Status s={w.st[0]} /></div>
                <b>{w.t}</b>
                <div style={{ color: C.mute }}>{w.st[1]}</div>
              </li>
            ))}
          </ul>
          <P style={{ color: C.mute }}>Full evidence and fixes for each item are on the Issues and fixes tab.</P>
        </div>
      </div>
    </div>
  );
}

function Issues() {
  const [f, setF] = useState("All");
  const levels = ["All", "Critical", "High", "Medium", "Low"];
  const list = ISSUES.map((i, k) => ({ ...i, st: ISSUE_STATUS[k] })).filter((i) => f === "All" || i.sl === f);
  return (
    <div>
      <div className="flex flex-wrap gap-2 mt-4 mb-4" role="group" aria-label="Filter by severity">
        {levels.map((l) => (
          <button key={l} onClick={() => setF(l)} className="px-3 py-1 text-sm rounded"
            style={{ border: `1px solid ${f === l ? C.deep : C.rule}`, background: f === l ? C.deep : "#fff", color: f === l ? "#fff" : C.ink }}>{l}</button>
        ))}
      </div>
      {list.map((i, k) => (
        <div key={k} className="mb-4 p-4" style={{ background: C.card, border: `1px solid ${C.rule}`, borderLeft: `4px solid ${C[i.sev === "info" ? "info" : i.sev]}`, borderRadius: 3 }}>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Chip tone={i.sev}>{i.sl}</Chip>
            <Chip tone={i.lvl === "Fact" ? "good" : i.lvl === "Inference" ? "warn" : "info"}>{i.lvl}</Chip>
            <Status s={i.st[0]} />
            <span className="font-semibold text-sm" style={{ color: C.ink }}>{i.t}</span>
          </div>
          <P style={{ marginBottom: 6, color: C.mute }}><b style={{ color: C.ink }}>Evidence. </b>{i.ev}</P>
          <P style={{ marginBottom: 6 }}><b style={{ color: C.good }}>Fix. </b>{i.fix}</P>
          <P style={{ marginBottom: 0 }}><b style={{ color: C.deep }}>Now (18 Oct). </b>{i.st[1]}</P>
        </div>
      ))}
      <Box tone="info" title="About the “Apply for healthcare certification” prompt">
        Google’s April 2026 India update, which introduced certification, concerns online pharmacies promoting prescription-drug services. A chiropractic clinic does not obviously fall under it. Open Policy manager and check which policy each limited asset cites before spending time or money on certification.
      </Box>
    </div>
  );
}

function Habits() {
  const s = useMemo(() => {
    const l12 = ALL.slice(-12);
    const sorted = [...l12].sort((a, b) => a - b);
    const mean = l12.reduce((a, b) => a + b, 0) / 12;
    const med = (sorted[5] + sorted[6]) / 2;
    const sd = Math.sqrt(l12.reduce((a, b) => a + (b - mean) ** 2, 0) / 12);
    const avg = (n) => ALL.slice(-n).reduce((a, b) => a + b, 0) / n;
    return { total: l12.reduce((a, b) => a + b, 0), mean, med, sd, min: sorted[0], max: sorted[11], a6: avg(6), a3: avg(3) };
  }, []);
  const payTot = PAY26.reduce((a, r) => a + r[2], 0);
  const costTot = PAY26.reduce((a, r) => a + r[1], 0);
  const octTot = OCT_PAY.reduce((a, r) => a + r[1], 0);
  return (
    <div>
      <H2>Spending profile</H2>
      <T head={["Measure", "Value", "Reading"]} right={[1]} rows={[
        ["Lifetime ad spend (Jul 2017 – Sep 2026)", "₹12,87,627", "110 invoices, mixing tax invoices (to Sep 2020) and invoices (from Oct 2020)"],
        ["Last 12 months total", inr(s.total), "Oct 2025 – Sep 2026"],
        ["Average per month, last 12 / 6 / 3", `${inr(s.mean)} / ${inr(s.a6)} / ${inr(s.a3)}`, "Slowly easing"],
        ["Median month, last 12", inr(s.med), "Typical month"],
        ["Range, last 12", `${inr(s.min)} to ${inr(s.max)}`, "Dec 2025 lowest, Mar 2026 highest"],
        ["Month-to-month swing (std. dev.)", inr(s.sd), "About 34% of the mean: spend follows budget edits, not a plan"],
        ["Net cost per day: Jun / Jul / Aug / Sep / Oct*", "₹244 / ₹439 / ₹296 / ₹288 / ₹335", "*Oct is 1–17 Oct incl. GST. July was the outlier."],
      ]} />

      <H2>Daily ledger, 1 Aug – 17 Oct</H2>
      <div style={{ width: "100%", height: 300 }}>
        <ResponsiveContainer>
          <ComposedChart data={DAILY_ROWS} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={C.rule} vertical={false} />
            <XAxis dataKey="d" tick={{ fontSize: 10, fill: C.mute }} interval={6} />
            <YAxis yAxisId="l" tick={{ fontSize: 11, fill: C.mute }} />
            <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11, fill: C.mute }} />
            <Tooltip formatter={(v, n) => [inr2(v), n]} />
            <Bar yAxisId="l" stackId="a" dataKey="p5" name="PMax-5" fill={C.deep} />
            <Bar yAxisId="l" stackId="a" dataKey="p4" name="PMax-4" fill={C.warn} />
            <Bar yAxisId="l" stackId="a" dataKey="vv" name="Video Views Camp 1" fill={C.mute} />
            <Bar yAxisId="l" stackId="a" dataKey="yt" name="YouTube Promotion" fill={C.bad} />
            <Line yAxisId="r" type="monotone" dataKey="bal" name="Balance at day end" stroke={C.good} strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <P style={{ color: C.mute }}>Stacked bars: net cost per day (left axis, ₹). Green line: end-of-day prepaid balance (right axis).</P>
      <T head={["Observation", "Evidence"]} rows={[
        ["Stop-start delivery", "PMax-5: 23 of 78 days under ₹40, 21 days at ₹330 or more, daily median ₹225, peak ₹679 on 24 Sep."],
        ["Balance at zero before a top-up", "30 Sep ended at ₹0.00 after ₹1,316.55 GST. 1 Oct: no spend. 2 Oct: ₹0.69."],
        ["Month-end GST is a hidden bill", "GST was ₹1,399 for Aug and ₹1,317 for Sep, taken from the balance on the last day."],
        ["Video spend crowds in", "YouTube Promotion went ₹72 → ₹198 → ₹191 → ₹225 → ₹2 → ₹251 → ₹262 a day from 11 to 17 Oct."],
        ["Credits are small", "Adjustments total ₹139 since 1 Aug (under 1% of spend), so Google found little invalid traffic. The low-cost clicks are probably valid but accidental or low intent, not fraud."],
      ]} />

      <H2>Monthly cost against impressions (2025–2026)</H2>
      <div style={{ width: "100%", height: 280 }}>
        <ResponsiveContainer>
          <ComposedChart data={TREND} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={C.rule} vertical={false} />
            <XAxis dataKey="m" tick={{ fontSize: 11, fill: C.mute }} interval={1} />
            <YAxis yAxisId="l" tick={{ fontSize: 11, fill: C.mute }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
            <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11, fill: C.mute }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
            <Tooltip formatter={(v, n) => [n === "cost" ? inr(v) : Number(v).toLocaleString("en-IN"), n === "cost" ? "Net cost" : "Impressions"]} />
            <Bar yAxisId="l" dataKey="cost" fill={C.deep} radius={[2, 2, 0, 0]} />
            <Line yAxisId="r" type="monotone" dataKey="impr" stroke={C.warn} strokeWidth={2} dot={false} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <P style={{ color: C.mute }}>Bars: net cost (left axis). Line: impressions of today’s campaigns (right axis; Nov 2025 shows none). In Feb 2025, Jan 2026 and Sep 2026 impressions spike while spend barely moves, which means the account bought far cheaper inventory in those months. September 2026 gave 134,788 impressions for ₹8,631 against 38,773 for ₹9,171 in August.</P>

      <H2>Yearly spend</H2>
      <div style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer>
          <BarChart data={YEARLY} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={C.rule} vertical={false} />
            <XAxis dataKey="y" tick={{ fontSize: 11, fill: C.mute }} />
            <YAxis tick={{ fontSize: 11, fill: C.mute }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
            <Tooltip formatter={(v) => [inr(v), "Spend"]} />
            <Bar dataKey="v" radius={[2, 2, 0, 0]}>
              {YEARLY.map((d) => <Cell key={d.y} fill={d.y === "2022" ? C.warn : d.y === "2026*" ? C.info : C.deep} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <P style={{ color: C.mute }}>*2026 covers 9 months (₹1,07,267), about ₹1.43 lakh annualised. Peak was 2022 (₹2,36,562). 2025 was 34% below the peak.</P>

      <H2>Payment habits</H2>
      <T head={["Pattern", "Evidence"]} rows={[
        ["Reactive top-ups", `October: 7 manual payments in 15 days, ${inr(octTot)} in total, average ₹814, one every 2–3 days (₹600 to ₹1,400).`],
        ["Funding runs to empty", "Available funds ₹1.10 with “Funds exhausted” flagged, and the balance reached ₹0.00 on 30 Sep."],
        ["Top-up cadence", "25 manual top-ups in 78 days: 8 in Aug (₹8,600), 10 in Sep (₹7,800), 7 in Oct (₹5,700)."],
        ["Costs and payments track closely", `2026 Jan–Sep: net cost ${inr(costTot)} vs payments ${inr(payTot)}, a gap of ${inr(costTot - payTot)}.`],
        ["GST is a real 18% add-on", "October so far: campaigns ₹4,857.04, adjustments −₹27.50, GST ₹869.36, net ₹5,698.90."],
        ["Nov–Dec dips", "Dec 2024 ₹5,431, Nov 2025 ₹6,661, Dec 2025 ₹4,442. Check whether funds ran out or you paused on purpose."],
      ]} />
      <T head={["2026", ...PAY26.map((r) => r[0])]} right={PAY26.map((_, i) => i + 1)}
        rows={[["Net cost", ...PAY26.map((r) => inr(r[1]))], ["Payments", ...PAY26.map((r) => inr(r[2]))]]} />
    </div>
  );
}

function Budget() {
  const [pre, setPre] = useState("launch");
  const [b, setB] = useState(PRESETS.launch.b);
  const [a, setA] = useState(ASSUME0);
  const l12 = ALL.slice(-12).reduce((x, y) => x + y, 0) / 12;
  const rows = Object.keys(b).map((k) => {
    const spend = b[k] * DAYS;
    const clicks = spend / a[k].cpc;
    const enq = (clicks * a[k].rate) / 100;
    return { k, name: a[k].name, spend, spendG: spend * GST, clicks, enq, cpe: enq > 0 ? (spend * GST) / enq : null };
  });
  const tot = rows.reduce((o, r) => ({ spendG: o.spendG + r.spendG, clicks: o.clicks + r.clicks, enq: o.enq + r.enq }), { spendG: 0, clicks: 0, enq: 0 });
  const diff = ((tot.spendG - l12) / l12) * 100;
  const phases = [
    ["Nov – Dec 2026", "Search at ₹200/day. Learn and review", monthly(PRESETS.launch.b), 2],
    ["Jan – Mar 2027", "Search at ₹200, or ₹250 if the gate is met", monthly(PRESETS.launch.b), 3],
    ["Apr – Oct 2027", "Same. Never above ₹278/day", monthly(PRESETS.launch.b), 7],
  ];
  const yearTot = phases.reduce((s, p) => s + p[2] * p[3], 0);
  return (
    <div>
      <H2>What to allot</H2>
      <P>Search runs alone at ₹200 a day. Stay there until real cost per patient justifies more, and never go above ₹278 a day, which keeps a month under ₹10,000 with GST.</P>
      <T head={["Phase", "Mode", "Monthly (incl. GST)", "Months", "Phase total"]} right={[2, 3, 4]}
        rows={[...phases.map((p) => [p[0], p[1], inr(p[2]), p[3], inr(p[2] * p[3])]),
          [<b key="t">12 months</b>, "", "", 12, <b key="y">{inr(yearTot)}</b>]]} />
      <Box tone="good" title="Against your history">
        The plan totals {inr(yearTot)} versus {inr(l12 * 12)} spent in the last 12 months ({(((yearTot - l12 * 12) / (l12 * 12)) * 100).toFixed(0)}%), and the spend now has a clear job. Raising Search to ₹250 a day would cost {inr(monthly(PRESETS.earned.b))} a month, still under the ₹10,000 ceiling.
      </Box>

      <H2>Budget planner</H2>
      <div className="flex flex-wrap gap-2 mb-3" role="group" aria-label="Presets">
        {Object.entries(PRESETS).map(([k, p]) => (
          <button key={k} onClick={() => { setPre(k); setB(p.b); }} className="px-3 py-1 text-sm rounded"
            style={{ border: `1px solid ${pre === k ? C.deep : C.rule}`, background: pre === k ? C.deep : "#fff", color: pre === k ? "#fff" : C.ink }}>{p.label}</button>
        ))}
      </div>
      {Object.keys(b).map((k) => (
        <div key={k} className="mb-3 p-3" style={{ background: C.card, border: `1px solid ${C.rule}`, borderRadius: 4 }}>
          <div className="flex flex-wrap items-center justify-between mb-1">
            <span className="text-sm font-semibold" style={{ color: C.ink }}>{a[k].name}</span>
            <span className="text-sm" style={{ color: C.deep }}>₹{b[k]}/day</span>
          </div>
          <input type="range" min="0" max="400" step="10" value={b[k]} aria-label={`${a[k].name} daily budget`}
            onChange={(e) => { setPre(""); setB({ ...b, [k]: Number(e.target.value) }); }} className="w-full" />
          <div className="mt-1">
            <Num label="Assumed CPC (₹)" value={a[k].cpc} step={0.1} onChange={(v) => setA({ ...a, [k]: { ...a[k], cpc: Math.max(v, 0.01) } })} />
            <Num label="Real enquiries per 100 clicks" value={a[k].rate} step={0.1} onChange={(v) => setA({ ...a, [k]: { ...a[k], rate: v } })} width={110} />
          </div>
        </div>
      ))}
      <T head={["Campaign", "Monthly ex-GST", "Monthly incl. GST", "Clicks", "Real enquiries", "Cost per enquiry"]} right={[1, 2, 3, 4, 5]}
        rows={[...rows.map((r) => [r.name, inr(r.spend), inr(r.spendG), Math.round(r.clicks).toLocaleString("en-IN"), r.enq.toFixed(1), r.cpe ? inr(r.cpe) : "NA"]),
          [<b key="t">Total</b>, <b key="a">{inr(tot.spendG / GST)}</b>, <b key="b">{inr(tot.spendG)}</b>, Math.round(tot.clicks).toLocaleString("en-IN"), <b key="c">{tot.enq.toFixed(1)}</b>, tot.enq > 0 ? <b key="d">{inr(tot.spendG / tot.enq)}</b> : "NA"]]} />
      <Box tone={diff > 10 ? "warn" : "good"} title={`This plan is ${diff >= 0 ? "+" : ""}${diff.toFixed(0)}% against your 12-month average of ${inr(l12)}/month`}>
        Cost and enquiry rates here are assumptions: CPC of ₹20 to ₹21.50 comes from PMax-4 and your ₹12–16 sitelink clicks, and the enquiry rates are placeholders. Replace them with measured numbers after 30 days. Google can spend up to twice the daily budget on one day, but never more than 30.4 × the daily budget in a month, and GST is added on top.
      </Box>

      <H2>Rules for moving between phases</H2>
      <T head={["If, after 30 days…", "Then"]} rows={[
        ["A paused PMax campaign is restarted and produces no confirmed patients in 30 days", "Pause it again and move its budget to Search."],
        ["Cost per real enquiry is below your break-even", "Raise that campaign’s budget by 20% a week, not more."],
        ["Search cost per patient is under half of revenue per patient", "Move to the Growth preset."],
        ["Real enquiries cannot be counted yet", "Do not raise any budget. Fix tracking first."],
      ]} />
    </div>
  );
}

function Actions() {
  return (
    <div>
      {OPTIONS.map((g) => (
        <div key={g.when}>
          <H2>{g.when}</H2>
          <T head={["Option", "Action"]} rows={g.items.map(([o, t]) => [<b key={o}>{o}</b>, t])} />
        </div>
      ))}
      <H2>KPIs to review every week</H2>
      <T head={["KPI", "Healthy direction"]} rows={[
        ["Cost per real enquiry (incl. GST)", "Falling, and below break-even per patient"],
        ["Enquiry-to-booked-patient rate", "Rising, from your own log"],
        ["ROI per campaign", "Positive, with source-tagged patients"],
        ["Share of spend on Search and PMax-4", "Majority of the budget"],
        ["Days with funds exhausted", "Zero"],
      ]} />
      <Box tone="info" title="Limits of this analysis">
        No revenue, booking or call-log data was supplied, the YouTube campaign report was not available, asset-level clicks are account-wide, October billing runs to 17 Oct, and billing “clicks” for PMax mix clicks and impressions, so they cannot give CPC. Impression history covers only campaigns that still exist. Treat every “Inference” as a hypothesis until the lead count from Option 5 is done.
      </Box>
    </div>
  );
}



function Basics() {
  return (
    <div>
      <h1 className="text-3xl mb-3" style={{ fontFamily: FH, color: C.deep, fontWeight: 600, lineHeight: 1.2, maxWidth: "26ch" }}>
        Google Ads from scratch
      </h1>
      <H2>How it works in six steps</H2>
      <OL items={[
        "Someone types a question into Google, watches a video, or opens a website.",
        "Advertisers compete to show an ad to that person.",
        "You pay mostly when someone clicks.",
        "You set a daily budget to cap the spending.",
        "Google’s robot watches who does the action you told it to count, then finds more people like them.",
        "If you tell it to count the wrong action, it hunts for the wrong people.",
      ]} />
      <Box tone="warn" title="The idea that matters most">
        Think of the “conversion” setting as a heart-rate monitor. If it counts a shaken wrist as a heartbeat, the coach (Google’s robot) trains for the wrong thing, and the chart still looks athletic. That is what may be happening in PMax-5.
      </Box>

      <H2>Words you will meet</H2>
      <T head={["Term", "Plain meaning", "In this account"]} rows={[
        ["Impression", "Your ad was shown once", "94,590 in 30 days"],
        ["Click", "Someone tapped the ad", "9,305"],
        ["CTR", "Clicks ÷ impressions", "9.89% on PMax-5, suspiciously high for a clinic"],
        ["CPC", "Cost per click", "₹0.71 on PMax-5 vs ₹21.50 on PMax-4"],
        ["Conversion", "An action you told Google to count (call, form, WhatsApp)", "367, still to be checked against real enquiries"],
        ["Cost per conversion", "Spend ÷ conversions", "₹18.31 vs ₹62.11"],
        ["Budget", "A daily average. One day can cost up to 2×, but a month never exceeds 30.4 × the daily budget", "₹180 and ₹140 per day"],
        ["Target CPA", "The price per conversion Google tries to hit", "₹17.19 and ₹43"],
        ["GST", "18% added on top of ad cost", "A ₹320/day budget really costs about ₹378/day"],
        ["Prepay vs postpay", "Prepay stops ads when money runs out. Postpay bills later", "You are on prepay and eligible for postpay"],
      ]} />

      <H2>YouTube Promotion in simple terms</H2>
      <P>Nobody here seems to know who started it. The usual route is a “Promote” button under a video in YouTube Studio, which creates a campaign inside the same Google Ads account. It buys views or website visits for a video. It does not buy appointments. It is like handing out leaflets in a busy park: many people take one, very few are patients.</P>
      <T head={["Fact", "Value"]} rows={[
        ["Started", "11 Oct 2026"],
        ["Daily cost", "₹72, then ₹198, ₹191, ₹225, ₹2, ₹251, ₹262"],
        ["Total so far", "₹1,201 for about 15,600 views or clicks, roughly ₹0.08 each"],
      ]} />
      <OL items={[
        "Ask Dr. Rajveer: “Did you or someone press Promote on a YouTube video on 11 Oct?”",
        "In Google Ads open Campaigns and set the status filter to All to find it.",
        "With his OK, pause it, since he owns the account and the money.",
        "Export its report for your records.",
      ]} />
    </div>
  );
}

function Framework() {
  return (
    <div>
      <H2>The 5-Layer Check</H2>
      <P>Check the layers in this order. A problem in a higher layer makes every lower layer unreliable.</P>
      <T head={["Layer", "Question", "Where to look", "Red flags found here"]} rows={[
        [<b key="1">1. Money and billing</b>, "Can ads even run?", "Billing activity, Billing summary", "Balance ₹1.10, and ads stopped on 1 Oct"],
        [<b key="2">2. Measurement</b>, "Can we trust the numbers?", "Conversion actions, Campaign report", "24 of 27 conversion actions are Primary, and only soft ones are recording"],
        [<b key="3">3. Targeting</b>, "Are the right people and places reached?", "Campaign settings, Locations", "Nine states targeted, Bangalore targeted nowhere"],
        [<b key="4">4. Message and policy</b>, "Are ads approved and honest?", "Asset groups, Policy manager", "Clickbait, Misleading Ad Design, Health in personalized advertising"],
        [<b key="5">5. Structure and budget</b>, "Is the money in the right campaigns?", "Campaign report, Billing", "81% of spend in PMax-5, and no Search campaign"],
      ]} />

      <H2>ISO 31000 mapping</H2>
      <T head={["ISO 31000 step", "In this account"]} rows={[
        ["Identify", "Find the red flag in a report."],
        ["Analyse", "Rate impact (₹ where possible) and how sure you are (Fact, Inference, Unknown)."],
        ["Evaluate", "Rank by impact × evidence × urgency."],
        ["Treat", "Apply the fix, one big change per campaign every 14 days."],
        ["Monitor", "Re-check in 14 days with the same report."],
      ]} />

      <H2>Rate every finding on three things</H2>
      <T head={["Dimension", "Scale"]} rows={[
        ["Impact", "High, medium or low, in ₹ where possible"],
        ["Evidence level", <span key="e"><Chip tone="good">Fact</Chip> the data shows it, <Chip tone="warn">Inference</Chip> likely but not proven, <Chip tone="info">Unknown</Chip> we cannot see it</span>],
        ["Urgency", "Today, this week or this month"],
      ]} />
      <Box title="Finding template">
        <b>Finding:</b> Conversions are not tied to money.<br />
        <b>Evidence:</b> Campaign report, “Conv. value” equals “Conversions” (358.00 and 358).<br />
        <b>Impact:</b> ROI cannot be measured and Google trains on soft actions. About ₹6.5k a month is spent on it.<br />
        <b>Fix:</b> Make only real actions Primary (call, appointment form, WhatsApp) and give each a ₹ value.<br />
        <b>Check:</b> In 14 days, reported conversions should be close to the real call log.
      </Box>

      {import.meta.env.DEV && (<StudioOnly>
      <H2>Five sentences for Dr. Rajveer</H2>
      <OL items={[
        "“Your ads are working, but we can’t prove how well, because the account counts things that may not be enquiries.”",
        "“₹20,055 went to campaigns since 1 August, and we can’t yet link it to patients.”",
        "“Ads also stopped on 1 October because the balance hit zero.”",
        "“I need three things from you: revenue per new patient, your call and WhatsApp log, and permission to pause the YouTube campaign.”",
        "“Every Tuesday at 11:00 you’ll get a written update, and I won’t change budgets without your approval.”",
      ]} />

      </StudioOnly>)}

      <H2>Ground rules when managing someone else’s money</H2>
      <T head={["Rule", "Why"]} rows={[
        ["Ask for Standard access by email invite (Admin > Access and security), never his password", "Safer and traceable"],
        ["Get a written monthly cap approved by him", "Protects you and him"],
        ["Log every change: date, reason, expected effect, check date", "Stops the repeated resets seen in PMax-5"],
        ["No more than one big change per campaign every 14 days", "The robot needs time to learn"],
        ["A weekly review before each Tuesday 11:00 update, with the 5-Layer Check", "Builds the habit"],
        ["Raise budgets by 20% at most, only after the gate", "Avoids paying for guesses"],
      ]} />

      <H2>Reports to download</H2>
      <T head={["Report", "Answers", "How often"]} rows={[
        ["Campaign report", "Spend, clicks, conversions per campaign", "Weekly"],
        ["Billing activity", "Daily money flow and balance", "Weekly"],
        ["Conversion actions summary", "What exactly is being counted", "Monthly"],
        ["Search terms report", "What people typed (after Search starts)", "Weekly"],
        ["Campaign settings", "Locations, bids, targets", "Monthly"],
        ["Change history", "Who changed what", "Weekly"],
        ["Asset groups and Asset association", "Ad text and image health", "Monthly"],
        ["Policy details", "Why assets are limited", "When flags appear"],
        ["Locations and PMax placements", "Where ads showed", "Monthly"],
      ]} />
      <P style={{ color: C.mute }}>Menu names change, so search the Help box for each report name if you can’t find it.</P>
    </div>
  );
}

function ConvCheck() {
  return (
    <div>
      <H2>Could someone be inflating conversions?</H2>
      <P>It is possible, but nothing in these files proves it. Nobody has to click anything to make conversions look high. It is enough to change what the account counts. A fitness band that counts arm-shakes as steps looks athletic whether the cause is a bad setting or someone shaking their wrist on purpose. Only the settings history tells you which.</P>
      <T head={["#", "Explanation", "Fits our data?", "Level"]} rows={[
        ["1", "Soft actions counted as conversions (page view, button tap, any click). Most common, and often lazy setup, not fraud.", "Strong: value equals count, and the only actions recording are soft ones (see Conversion audit).", <Chip key="a" tone="warn">Inference</Chip>],
        ["2", "Accidental taps on low-cost inventory (apps, video, Display).", "Strong: 9.89% CTR and 46 video views.", <Chip key="b" tone="warn">Inference</Chip>],
        ["3", "Existing patients searching the clinic name. Real, but not new patients.", "Partial: the business-name asset had 247 clicks.", <Chip key="c" tone="warn">Inference</Chip>],
        ["4", "Someone tapping or submitting on purpose (staff, relatives, a manager).", "Weak at this scale. It could add a few, not explain ~9,000 clicks.", <Chip key="d" tone="info">Unknown</Chip>],
        ["5", "Setup chosen so reports look good: easy actions made Primary, so ₹18 per conversion looks excellent.", "Fits the pattern, but the data cannot show intent.", <Chip key="e" tone="info">Unknown</Chip>],
        ["6", "Bots or click farms.", "Poor: Google credited only ₹139 of invalid clicks since 1 Aug, under 1%.", <Chip key="f" tone="good">Fact</Chip>],
      ]} />
      <Box tone="info" title="What the 30-day change history shows">
        Every change in the last 30 days was made by one login, rajveer.pt@gmail.com. That says nothing about earlier months, or about someone using his login. Explanations 1 and 5 look identical in the numbers, so only the setup history separates a careless setup from a deliberate one.
      </Box>

      <H2>Three-way match</H2>
      <P>Compare independent sources instead of trusting the Ads screen.</P>
      <T head={["Option", "Check", "Where", "What it tells you"]} rows={[
        [<b key="1">Option 1</b>, "List every conversion action: name, type, Primary or Secondary, creation date", "Goals > Conversions > Summary", "Whether page views or taps are being counted"],
        [<b key="2">Option 2</b>, "Split the 358 by conversion action", "Campaign report > Segment > Conversion action", "Which action produces them"],
        [<b key="3">Option 3</b>, "Compare Ads conversions with the clinic’s call log, WhatsApp, appointment book and form entries for 17 Sep to 16 Oct", "Clinic records", "Real enquiries vs reported"],
        [<b key="4">Option 4</b>, "Compare Ads clicks with website visits from Google ads", "Google Analytics, if installed", "A big gap suggests accidental or non-site clicks"],
        [<b key="5">Option 5</b>, "See where ads appeared", "Insights and reports > Where ads showed", "Game apps or odd sites suggest accidental taps"],
        [<b key="6">Option 6</b>, "See who has access and what they changed, date range set to maximum", "Admin > Access and security, then Change history", "Who created or changed conversion settings, and when"],
      ]} />

      <H2>How to read the results</H2>
      <T head={["Result", "Meaning"]} rows={[
        ["Conversions are mostly page views or taps, and the real log is far smaller", "Explanations 1 or 2. Fix the setup."],
        ["A stranger created or edited the conversion actions shortly before “great” reports", "Look closer at explanation 5."],
        ["Conversions cluster at odd hours or in bursts", "Look for manual triggering."],
        ["Real log is close to the Ads count", "The suspicion was wrong, and that is good news."],
      ]} />

      <H2>How to raise it safely</H2>
      <OL items={[
        "Collect evidence first and share the three-way match, not an accusation.",
        "Say “the numbers can’t be verified yet”, which is true and doesn’t blame anyone.",
        "Make the lasting fix a control: only real actions are Primary, and a monthly check against the clinic log. That also protects you if someone later questions your results.",
      ]} />
      <Box title="Two questions to ask">
        Who set up the conversion actions? Was anyone paid based on reported conversions or cost per conversion?
      </Box>
    </div>
  );
}

function Plan12() {
  const launch = monthly(PRESETS.launch.b);
  const earned = monthly(PRESETS.earned.b);
  const base = launch * 12;
  const reserve = (earned - launch) * 12;
  const l12 = ALL.slice(-12).reduce((x, y) => x + y, 0);
  const months = [
    ["18 – 31 Oct", "Campaign published. Remove Bangalore text from the website, doctor loads ₹3,500, check status is Eligible, read Search terms on days 1 to 3", "₹3,500 one-off load", "Ads showing and calls recorded"],
    ["Nov", "Run steadily. Review at day 14 (2 Nov). Switch to conversions bidding only if calls are recording", inr(launch), "Reported calls close to the clinic call log"],
    ["Dec", "Hold. Add the negatives the owner approves from the Search terms report", inr(launch), "30 days of search data"],
    ["Jan", "Decision 1: compare cost per real enquiry with what a patient is worth", `${inr(earned)} if the gate is met, else ${inr(launch)}`, "Cost per patient below revenue per patient"],
    ["Feb – Mar", "Split ad groups by theme and test ad wording, one change at a time", inr(launch), "Stable results for 4 weeks"],
    ["Apr – Jun", "Scale test: raise the budget about 20% at a time, never above ₹278/day", `Up to ${inr(earned)}`, "Cost per patient under about 40% of revenue per patient"],
    ["Jul – Sep", "Stabilise. Keep what works, cut what does not", inr(launch), "Quarterly review"],
    ["Oct 2027", "Annual review against this year", inr(launch), "Plan the next 12 months, reset by ROI"],
  ];
  return (
    <div>
      <H2>Which campaign types to use</H2>
      <T head={["Type", "Simple meaning", "Use here?", "Share of budget"]} rows={[
        [<b key="1">Search</b>, "Text ads when someone types “tailbone pain doctor Delhi”", "Yes, the core. Targets people already looking", "100% (₹200 a day)"],
        [<b key="2">Performance Max (PMax-4)</b>, "Google’s automated campaign across Search, YouTube, Display, Maps", "Paused. Return only after 30 days of Search data and working tracking", "0% (paused)"],
        [<b key="3">Performance Max (PMax-5)</b>, "Same automated type, mostly low-cost clicks", "Paused. Unproven and policy-flagged", "0% (paused)"],
        [<b key="4">Google Business Profile</b>, "Your free map listing", "Yes: reviews, photos and correct clinic addresses, no ad cost", "0%"],
        [<b key="5">YouTube, Display, Demand Gen</b>, "Awareness ads", "Not now. Revisit after month 9, capped at 10%", "0%"],
        [<b key="6">Remarketing</b>, "Following past visitors", "Avoid: health-based personalisation is restricted (the policy flags suggest this)", "0%"],
        [<b key="7">App campaigns</b>, "Promote a mobile app", "Not relevant", "0%"],
      ]} />

      <H2>12-month plan, Nov 2026 – Oct 2027</H2>
      <P>Monthly figures include 18% GST.</P>
      <T head={["Month", "Focus", "Budget", "Gate before moving on"]} rows={months} />
      <Box tone="good" title="Totals">
        Base plan: {inr(base)} (12 months at {inr(launch)}). If every month ran at ₹250 a day the total would be {inr(base + reserve)}. The hard ceiling is ₹1,20,000 (₹10,000 a month). The last 12 months cost {inr(l12)}. The ₹3,500 October load is separate.
      </Box>

      <H2>Break-even rule</H2>
      <P>The most you can afford per enquiry is revenue per new patient × the share of enquiries that become patients. Your website lists ₹800 for a first consultation, so if 25% of enquiries became paying patients, the most you can afford per enquiry is ₹200 on first-visit revenue alone. Follow-up visits (₹500 each) raise this, so ask the doctor how many visits an average patient makes.</P>
      <Box tone="info" title="An expectation to test, not a promise">
        ₹200/day on Search buys about {Math.round((200 * DAYS) / 20)} clicks a month at ₹20 each. At an 8% enquiry rate that is roughly {Math.round(((200 * DAYS) / 20) * 0.08)} real enquiries. Both the ₹20 and the 8% are assumptions to measure in the first 30 days. Google’s own estimate on the review screen was 382 clicks a week at ₹3.66, which is more hopeful, so treat it as a best case.
      </Box>
    </div>
  );
}


function ConvAudit() {
  const [g, setG] = useState("all");
  const total = CONV27.reduce((s, r) => s + r[7], 0);
  const sums = Object.keys(GROUPS).map((k) => {
    const rows = CONV27.filter((r) => r[9] === k);
    return { k, n: rows.length, conv: rows.reduce((s, r) => s + r[7], 0) };
  });
  const active = CONV27.filter((r) => r[3] === "Active");
  const activeConv = active.reduce((s, r) => s + r[7], 0);
  const primary = CONV27.filter((r) => r[4] === "Primary").length;
  const list = CONV27.filter((r) => g === "all" || r[9] === g);
  const fmt = (n) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  return (
    <div>
      <H2>What Google is counting as a “win”</H2>
      <P>A conversion is just a win, such as a phone call. Google’s robot learns from whatever you call a win. The list below holds all 27 actions in the account, and it adds up exactly to the total shown on screen ({fmt(total)}). The date box on that page reads All time, 17 May 2014 to 18 Oct 2026, so every number here is a lifetime total, not the last 30 days. Think of a fitness band that counts arm-shaking as steps: the tally looks athletic, and the coach trains for the wrong thing.</P>
      <T head={["Fact", "Value", "Level"]} right={[1]} rows={[
        ["Conversion actions in the account", "27", <Chip key="a" tone="good">Fact</Chip>],
        ["Marked Primary (train Google)", `${primary} of 27`, <Chip key="b" tone="good">Fact</Chip>],
        ["Actions recording right now (Active)", `${active.length}, all soft, ${fmt(activeConv)} conversions`, <Chip key="c" tone="good">Fact</Chip>],
        ["Real call wins from ads (all time)", `${fmt(sums[0].conv)} (${((sums[0].conv / total) * 100).toFixed(1)}% of all)`, <Chip key="d" tone="good">Fact</Chip>],
        ["Two Analytics imports (all time)", `${fmt(sums[3].conv)} (${((sums[3].conv / total) * 100).toFixed(1)}% of all)`, <Chip key="e" tone="good">Fact</Chip>],
        ["The 358 conversions came from the soft Active actions", "Probable", <Chip key="f" tone="warn">Inference</Chip>],
      ]} />

      <H2>The five groups</H2>
      <T head={["Group", "Actions", "Conversions", "Share"]} right={[1, 2, 3]}
        rows={[...sums.map((s) => [<Chip key={s.k} tone={GROUPS[s.k][1]}>{GROUPS[s.k][0]}</Chip>, s.n, fmt(s.conv), `${((s.conv / total) * 100).toFixed(1)}%`]),
          [<b key="t">Total</b>, 27, <b key="v">{fmt(total)}</b>, "100%"]]} />
      <Box tone="warn" title="Why this matters">
        The six actions that are Active are Maps engagements, YouTube subscriptions and views. A campaign that buys YouTube and Maps inventory at ₹0.71 a click collects exactly these. That would explain why PMax-5 reported 358 “conversions” with almost no real calls. The totals are lifetime (since 2014), so only the Active status tells us what is recording today. It is not proven, because the per-campaign split is unknown.
      </Box>

      <Box tone="info" title="All-time view (rough signal, not a verdict)">
        Google invoices since Oct 2018, when call tracking began, total about ₹12.05 lakh. The account lists 81 call wins from ads, of which 50 are qualifying calls of 60 seconds or more. That is roughly ₹14,900 per call win, or ₹24,100 per qualifying call. Removed conversion actions are not listed, and patients may also have come through website calls, WhatsApp or forms that were never measured, so treat this as a prompt to measure properly, not as proof the ads failed.
      </Box>

      <H2>All 27 actions</H2>
      <div className="flex flex-wrap gap-2 mb-3" role="group" aria-label="Filter by group">
        {[["all", "All"], ...Object.entries(GROUPS).map(([k, v]) => [k, v[0].split(" (")[0]])].map(([k, label]) => (
          <button key={k} onClick={() => setG(k)} className="px-3 py-1 text-sm rounded"
            style={{ border: `1px solid ${g === k ? C.deep : C.rule}`, background: g === k ? C.deep : "#fff", color: g === k ? "#fff" : C.ink }}>{label}</button>
        ))}
      </div>
      <T head={["Action", "Goal", "Source", "Status", "Primary?", "Count", "All conv.", "Value ₹", "What to do"]} right={[6, 7]}
        rows={list.map((r) => [r[0], r[1], r[2],
          <Chip key={r[0]} tone={r[3] === "Active" ? "bad" : r[3] === "No recent conversions" ? "info" : "warn"}>{r[3]}</Chip>,
          r[4], r[5], fmt(r[7]), fmt(r[8]), r[10]])} />
      <P style={{ color: C.mute }}>The Yes/No column in the Google table is probably the attribution model: both call actions you opened show Data-driven. It is not the “include in conversions” setting, so it is left out here.</P>

      <H2>The two call actions you opened</H2>
      <T head={["Setting", "Calls from ads", "Calls from Smart Campaign Ads"]} rows={[
        ["Created", "09/10/2018", "26/11/2021, by Google Ads"],
        ["Goal and action type", "Phone call leads, Primary", "Phone call leads, Primary"],
        ["Value", "₹5", "No value"],
        ["Count", "One conversion", "One conversion"],
        ["Call length", "60 seconds", "30 seconds"],
        ["Click-through window", "30 days", "30 days"],
        ["Attribution", "Data-driven", "Data-driven"],
        ["Editable?", "Name, goal, value and length yes. Type, date and source no", <b key="n">No, created by Google Ads</b>],
        ["Verdict", <Chip key="k" tone="good">Keep</Chip>, <Chip key="s" tone="info">Leave alone</Chip>],
      ]} />
      <P>An earlier table showed “Calls from ads” counting Every call, but its edit screen says One conversion. If you changed it already, good. If not, the edit screen is the one to trust. The ₹5 value is a placeholder with no effect while bidding is on Clicks. Later, set it to revenue per new patient × share that become patients (Conversions sheet in the kit).</P>

      <H2>What to do, step by step</H2>
      <OL items={[
        "Don’t delete anything. Deleting loses history.",
        "In the new Search campaign, on the goals screen keep only Phone call leads. Remove Submit lead forms, Contacts, Get directions, Engagements, Page views, YouTube follow-on views, Book appointments, Request quotes and Downloads.",
        "The campaign’s goal choice is the real switch. Picking only Phone call leads keeps every soft action out of this campaign, even though they stay Primary on the account.",
        "Open Calls from ads and leave it as it is (One conversion, 60 seconds).",
        "Open New Phone Call Lead By SPH, then Call ads 2025. If Action optimisation can be changed, set both to Secondary so one call is not counted twice. If it says they can’t be edited, leave them.",
        "Don’t touch the Smart campaign actions. Google created them, they can’t be edited, and no Smart campaign is running.",
        "Ask the website person to create a real appointment-form action later. Until then forms are not measured.",
        "In 14 days return to Goals, Conversions, Summary. Only Calls from ads should be recording for the new campaign.",
      ]} />
      <Box tone="info" title="Two things to find out">
        What the GA4 event tailbonetreatment_leads fires on (GA4, Admin, Events), and which call action should count when two are set up.
      </Box>
    </div>
  );
}


function OwnerBrief() {
  const done = [
    ["Account review", "30-day campaign report, billing ledger 1 Aug – 17 Oct (reconciles to the invoices), all 27 conversion actions, asset and policy reports, and both websites.", "Done"],
    ["Old campaigns paused", "YouTube Promotion, PMax-5 and PMax-4. Only the new Search campaign shows Enabled.", "Done"],
    ["Search campaign built and published", "Search | Tailbone | Delhi NCR | Oct 2026. Enabled, status Pending until Google finishes review and the start date arrives.", "Done"],
    ["Health policy flag fixed", "Three keywords were flagged (Health in personalized advertising) and removed. The rest passed.", "Done"],
    ["Ad group renamed", "Core keywords.", "Done"],
  ];
  const settings = [
    ["Type, objective, goal", "Search, Leads, Phone call leads only", "Phone calls are the only trusted signal. The other conversion actions count soft things such as map taps and YouTube views."],
    ["Bidding", "Maximise clicks, maximum cost per click ₹40", "Too little conversion data for automatic bidding. The cap protects the budget. Verify the ₹40 is saved."],
    ["Budget", "₹200 a day (average)", "About ₹6,080 a month before GST and ₹7,174 with GST. One day can reach ₹400."],
    ["Hard ceiling", "₹10,000 a month incl. GST, prepay", "The loaded balance is the only absolute stop. Ads pause when it reaches zero."],
    ["Networks", "Google Search only", "Search Partners and Display are off, so the ads show on Google search results."],
    ["Locations", "Delhi, Faridabad, Ghaziabad, Gurugram, Noida", "Delhi clinic only. Bangalore is closed and Lucknow has not opened. Verify the option is Presence."],
    ["Languages, audiences, AI", "English and Hindi, no audiences, AI Max off", "Health audiences are restricted. AI Max would widen matching and rewrite ad text."],
    ["Keywords", "15, phrase and exact match only", "Three common keywords were flagged and removed: [tailbone pain treatment], “tailbone pain treatment”, “tailbone pain clinic”."],
    ["Negative keywords", "None at launch", "The owner asked for none. Revisit on day 3 with real search data."],
    ["Ad", "14 headlines, 4 descriptions, ad strength Good", "Display path tailbone-pain/delhi, business name Tailbone Treatment. No cure, rated or No. 1 claims."],
    ["Sitelinks", "About the Doctor, Book Appointment, Patient FAQs, Treatment Options", "Check each page opens and has no Bangalore text."],
    ["Final URL", "https://tailbonetreatment.com/", "The old website. It must be cleaned first."],
    ["Start date", "19 October 2026", "Verify under Campaign settings. Move it later if the website is not ready."],
  ];
  const owner = [
    ["1", "Remove Bangalore, “India’s No. 1” and “only clinics” from tailbonetreatment.com (header, footer, menu, home slider, Specialised Clinic paragraph)", "Before launch"],
    ["2", "Load ₹3,500 into the account by prepay, and nothing more this month", "19 Oct, before 10:00"],
    ["3", "Confirm: fractured tailbones treated or not, “experienced doctor” wording, online video consultations active", "Before launch"],
    ["4", "Say who can edit the website and Google Tag Manager (the footer credits ARQ IT Solutions)", "This week"],
    ["5", "Tell us the average number of visits per patient and what each visit earns", "This week"],
    ["6", "Decide on negative keywords after seeing the real searches", "21 Oct (day 3)"],
    ["7", "Point the clinic’s domain, tailbonetreatment.com, at the new website", "This month"],
    ["8", "Give the Lucknow opening date, so a separate campaign can be planned", "When known"],
  ];
  const ajay = [
    ["Add four callouts (Appointments Available, Delhi NCR Clinic, Call or WhatsApp, One-to-One Consultation)", "Tonight"],
    ["Confirm the number 9886688323 shows under Assets, Calls", "Tonight"],
    ["Turn off auto-apply recommendations", "Tonight"],
    ["Read and discard the unknown draft (Drafts in progress)", "Tonight"],
    ["Check the status reads Eligible and only this campaign is Enabled", "19 Oct, 10:00"],
    ["Read the Search terms report daily and record wasted searches with cost", "Days 1 to 3"],
    ["Enter weekly cost in the Spend Tracker sheet", "Every week"],
    ["Day-14 review, then switch bidding to conversions only if calls are recording", "2 Nov"],
  ];
  const msg = [
    "Dr Rajveer, update on the Google Ads setup (18 Oct):",
    "",
    "DONE",
    "- Old campaigns paused (YouTube Promotion, PMax-5, PMax-4).",
    "- New Search campaign built and published: Delhi NCR only, ₹200 a day, phone calls as the goal, 15 keywords, one ad.",
    "- A health-policy flag on three keywords was fixed.",
    "",
    "LIMITS WE SET",
    "- Monthly cap ₹10,000 including GST, prepay only, so ads stop when the balance ends.",
    "",
    "NEEDED FROM YOU",
    "1. Remove Bangalore and 'No. 1' lines from tailbonetreatment.com before launch.",
    "2. Load ₹3,500 on 19 Oct before 10:00, nothing more in October.",
    "3. Confirm: fractured tailbones treated? online consultations on?",
    "4. Who can edit the website and Tag Manager?",
    "5. Average visits per patient and fee per visit.",
    "",
    "NEXT",
    "- 21 Oct: review the real searches. 2 Nov: first review. 18 Nov: decide on any budget change.",
  ].join("\n");
  const chipTone = { Done: "good" };
  return (
    <div>
      <h1 className="text-3xl mb-3" style={{ fontFamily: FH, color: C.deep, fontWeight: 600, lineHeight: 1.2, maxWidth: "26ch" }}>
        The campaign is built. Two jobs stand between it and launch
      </h1>
      <P>The Search campaign is published and waiting to start. Nothing can spend until the owner loads funds, and the old website must stop mentioning Bangalore first. Status on 18 Oct 2026: Enabled, Pending.</P>

      <H2>What has been done</H2>
      <T head={["Item", "Detail", "Status"]} rows={done.map((r) => [r[0], r[1], <Chip key={r[0]} tone={chipTone[r[2]]}>{r[2]}</Chip>])} />

      <H2>Settings used and why</H2>
      <T head={["Setting", "Value", "Why"]} rows={settings} />

      <H2>What the owner needs to do</H2>
      <T head={["#", "Task", "When"]} rows={owner} />

      <H2>What Ajay does</H2>
      <T head={["Task", "When"]} rows={ajay} />

      <H2>October money check</H2>
      <T head={["Item", "Amount"]} right={[1]} rows={[
        ["Already loaded in October", "₹5,700"],
        ["New load on 19 Oct", "₹3,500"],
        ["Total loaded in October", "₹9,200"],
        ["Spent to 17 Oct incl. GST", "₹5,699"],
        ["Expected spend 19–31 Oct incl. GST (13 days × ₹236)", "about ₹3,068"],
        ["Expected October spend", "about ₹8,770"],
        ["Monthly ceiling", "₹10,000"],
      ]} />
      <Box tone="warn" title="Limits to tell the owner">
        Only calls made from the ad’s own call button are counted. Website bookings and calls dialled from the page are not tracked yet. Expect fewer clicks than Google’s estimate, because the three most common keywords were removed. Without negative keywords some clicks will go to the wrong searches.
      </Box>

      <H2>Key dates</H2>
      <T head={["Date", "What happens"]} rows={[
        ["19 Oct", "Start date. Check the status is Eligible by 10:00"],
        ["21 Oct (day 3)", "Review real searches and the owner’s negative-keyword decision"],
        ["2 Nov (day 14)", "First review with the 5-Layer Check"],
        ["18 Nov (day 30)", "Decision 1: raise, hold or cut the budget"],
      ]} />

      {import.meta.env.DEV && (<StudioOnly>
      <H2>Message to send the owner</H2>
      <div className="p-4 mb-4" style={{ background: C.card, border: `1px solid ${C.rule}`, borderRadius: 4 }}>
        <pre className="text-sm" style={{ whiteSpace: "pre-wrap", fontFamily: FB, color: C.ink, lineHeight: 1.6, margin: 0 }}>{msg}</pre>
      </div>
      </StudioOnly>)}
    </div>
  );
}

export {
  CAMP, TOTAL_COST, ISSUES, RIGHT, OPTIONS, PRESETS, LEDGER, LEDGER_TOTAL, ALL, monthly,
  Verdict, OwnerBrief, Basics, Framework, RoiTab, RightWrong, Issues, ConvAudit, ConvCheck,
  Habits, Budget, Plan12, Actions,
};
