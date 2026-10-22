/*
 * Tailbone Treatment — Google Ads account history, 2014 to 21 Oct 2026.
 * From the campaign report (all time, by click type) and the monthly impressions time series, downloaded 21 Oct 2026.
 * Amounts exclude GST.
 */
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { C, inr, Chip, H2, P, Box, T } from "../../components/ui.jsx";

// [campaign, status, type, cost, clicks, recorded conversions, call-button taps, verdict, tone]
const CAMPAIGNS = [
  ["Tailbone Pain Specialist", "Removed", "Search", 957150, 80905, 36771, 1095, "70% of all spend; conversions were Analytics actions", "bad"],
  ["Website traffic – Performance Max-5", "Paused 18 Oct", "PMax", 80951, 94309, 2435, 0, "Cheap clicks (₹0.86), no traceable calls", "bad"],
  ["Website traffic – Search-9 by SPH", "Removed", "Search", 41662, 25652, 1319, 303, "Mostly low-cost clicks", "warn"],
  ["YouTube: Tailbone Pain Treatment, Coccyx Pain Precautions", "Removed", "Video", 42056, 81313, 0, 0, "Views, not enquiries", "bad"],
  ["Tailbone Treatment – Performance Max-4", "Paused 18 Oct", "PMax", 30863, 22608, 165, 0, "Best of the PMax campaigns", "warn"],
  ["Smart campaigns (7)", "Paused / removed", "Smart", 54222, 14482, 57, 665, "Low volume, high cost per result", "warn"],
  ["Call-only campaigns (3)", "Paused", "Search", 4870, 1410, 9, 1391, "Cheapest calls in the account: about ₹3.50 a tap", "good"],
  ["Gulf Country Search Ads", "Paused", "Search", 3931, 1035, 767, 4, "Small test abroad", "info"],
  ["Search | Tailbone | Delhi NCR | Oct 2026", "Running since 20 Oct", "Search", 337, 14, 0, 0, "New: real searches at ₹24 a click", "good"],
];
const TYPES = [
  ["Search", 1013460, 3848309, 117080, 38867],
  ["YouTube (in-stream video)", 185190, 4214551, 100927, 116],
  ["Performance Max", 118522, 1920449, 120562, 3084],
  ["Smart", 54222, 910102, 14482, 57],
];
// Impressions by year: Search text ads, Performance Max, YouTube video
const YEARS = [
  ["2015", 61585, 0, 0], ["2016", 303453, 0, 0], ["2017", 115665, 0, 0], ["2018", 57006, 0, 0], ["2019", 92377, 0, 0],
  ["2020", 149499, 0, 0], ["2021", 517949, 0, 0], ["2022", 1091416, 0, 1102792], ["2023", 653243, 0, 997316],
  ["2024", 849437, 14214, 606877], ["2025", 580440, 1073320, 753932], ["2026 (to 21 Oct)", 418, 832910, 753634],
];
const TOTAL = 1371393;
const n = (v) => Math.round(v).toLocaleString("en-IN");

export function History() {
  const searchYears = YEARS.map(([y, s]) => ({ y: y.slice(0, 4), v: s }));
  return (
    <div>
      <Box tone="warn" title="Since 2014: ₹13.7 lakh on Google Ads (about ₹16 lakh with GST)">
        Most of it went to one old Search campaign whose 36,771 “conversions” were Analytics actions, not enquiries. The ads did make phones ring: 3,544 taps on the call button over the years. The cheapest calls came from small call-only campaigns, and from January 2026 until 20 Oct no Search text ads ran at all.
      </Box>

      <H2>Every campaign, all time</H2>
      <T head={["Campaign", "Status", "Type", "Cost", "Share", "Clicks", "Cost / click", "Recorded conv.", "Call taps", "What it tells us"]} right={[3, 4, 5, 6, 7, 8]}
        rows={CAMPAIGNS.map(([c, st, ty, cost, clk, conv, taps, note, tone]) => [
          <b key="c">{c}</b>, st, ty, inr(cost), `${((cost / TOTAL) * 100).toFixed(1)}%`, n(clk), clk ? `₹${(cost / clk).toFixed(2)}` : "–", n(conv), n(taps), <Chip key="v" tone={tone}>{note}</Chip>])} />
      <P style={{ color: C.mute }}>Costs exclude GST. Call taps are taps on the call button in an ad; not every tap becomes a connected call. Recorded conversions include soft actions such as page views and old Analytics events.</P>

      <H2>By campaign type</H2>
      <T head={["Type", "Cost", "Impressions", "Clicks", "Cost / click", "Recorded conv."]} right={[1, 2, 3, 4, 5]}
        rows={TYPES.map(([t, cost, imp, clk, conv]) => [<b key="t">{t}</b>, inr(cost), n(imp), n(clk), `₹${(cost / clk).toFixed(2)}`, n(conv)])} />

      <H2>Search text ads shown per year</H2>
      <P>Search ads appear when someone types a search such as “tailbone pain treatment”. They were the backbone until 2024, then almost stopped in 2025–2026 while Performance Max and YouTube took over.</P>
      <div style={{ width: "100%", height: 240 }} role="img" aria-label="Search ad impressions per year">
        <ResponsiveContainer>
          <BarChart data={searchYears} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={C.rule} vertical={false} />
            <XAxis dataKey="y" tick={{ fontSize: 11, fill: C.mute }} />
            <YAxis tick={{ fontSize: 11, fill: C.mute }} tickFormatter={(v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1000 ? `${Math.round(v / 1000)}k` : v)} width={40} />
            <Tooltip formatter={(v) => [n(v), "Search ad impressions"]} cursor={{ fill: C.bg }} />
            <Bar dataKey="v" fill={C.deep} radius={[4, 4, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <T head={["Year", "Search ads", "Performance Max", "YouTube"]} right={[1, 2, 3]}
        rows={YEARS.map(([y, s, p, v]) => [y, n(s), p ? n(p) : "–", v ? n(v) : "–"])} />

      <H2>What we do with this</H2>
      <ul className="text-sm pl-5 mb-4" style={{ listStyle: "disc", lineHeight: 1.7 }}>
        <li>Keep money on Search ads, where people are looking for treatment (the new campaign since 20 Oct).</li>
        <li>Test a small call-only campaign again: historically the cheapest way to make the phone ring.</li>
        <li>Count only real calls and bookings as results, not page views or video views.</li>
        <li>Judge every rupee by patients, using the patient tracker.</li>
      </ul>
    </div>
  );
}
