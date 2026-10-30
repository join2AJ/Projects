/*
 * Campaigns on Current results: which ads run, with their settings, and the results day by day since they started.
 * The admin adds or edits campaigns, shares them, and imports a Google Ads time-series CSV (any mix of
 * impressions, clicks, cost, calls and conversions columns); figures already there for a day are updated.
 */
import { useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, LabelList } from "recharts";
import { supabase } from "../lib/supabase.js";
import { useRows } from "../lib/useRows.js";
import { fmtDate, fmtDateTime } from "../lib/money.js";
import { C, Chip, H2, P, Card, Box } from "./ui.jsx";

const input = "mt-1 w-full px-2 py-1.5 rounded text-sm";
const fs = { border: `1px solid ${C.rule}`, background: "#fff" };
const btn = { background: C.deep, color: "#fff" };
const STATUS = { planned: ["Planned", "info"], live: ["Running", "good"], paused: ["Paused", "warn"], ended: ["Ended", "info"] };
const DETAILS = [
  ["type", "Type"], ["started_on", "Started"], ["ended_on", "Paused / ended on"], ["locations", "Where the ads show"], ["budget", "Budget"], ["networks", "Networks"],
  ["schedule", "When the ads show"], ["goal", "Goal"], ["bidding", "Bidding"], ["keywords", "Keywords"], ["ads", "The ad"], ["assets", "Extras on the ad"],
  ["landing_url", "Ad opens"], ["notes", "Notes"],
];
const n0 = (v) => (v == null ? null : Number(v));
const int = (v) => (v == null ? "–" : Math.round(v).toLocaleString("en-IN"));
const rs = (v) => (v == null ? "–" : `₹${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`);

/* ───────── CSV import ───────── */
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
function parseDay(s) {
  s = String(s || "").trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/(\d{1,2})[\s-]+([A-Za-z]{3})[a-z]*[\s,-]+(\d{4})/);
  if (m && MONTHS[m[2].toLowerCase()]) return `${m[3]}-${String(MONTHS[m[2].toLowerCase()]).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = s.match(/^([A-Za-z]{3})[a-z]*\s+(\d{1,2}),?\s+(\d{4})/);
  if (m && MONTHS[m[1].toLowerCase()]) return `${m[3]}-${String(MONTHS[m[1].toLowerCase()]).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  return null;
}
function splitCsv(line) {
  const out = []; let cur = "", q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if ((ch === "," || ch === "\t") && !q) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim());
}
const num = (s) => { const t = String(s ?? "").replace(/[₹,%\s]/g, ""); return t === "" || t === "--" || isNaN(Number(t)) ? null : Number(t); };
/* Returns [{ day, impressions?, clicks?, cost?, calls?, conversions? }] and the columns found. */
export function parseTimeSeries(text) {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  const hi = lines.findIndex((l) => /^"?(date|day)"?\s*[,\t]/i.test(l));
  if (hi < 0) throw new Error("No Date column found. Export the time series from Google Ads as CSV.");
  const head = splitCsv(lines[hi]).map((h) => h.toLowerCase());
  const pick = (re, not) => head.findIndex((h, i) => i > 0 && re.test(h) && !(not && not.test(h)));
  // Ad impressions: a plain "Impr." column, else the headline (whole ad) impressions
  let imp = pick(/^impr\.?$|^impressions$/);
  if (imp < 0) imp = pick(/impr.*headline/);
  const cols = { impressions: imp, clicks: pick(/^clicks$/), cost: pick(/^cost$/), calls: pick(/phone calls|^calls$/), conversions: pick(/^conversions$/) };
  const found = Object.entries(cols).filter(([, i]) => i >= 0).map(([k]) => k);
  // Other "Impr.(…)" columns, e.g. Impr.(Sitelink), are kept by day as extras: "Sitelink shown"
  const raw = splitCsv(lines[hi]);
  const extra = raw.map((h, i) => [i, h.match(/^impr\.?\s*\((.+)\)$/i)?.[1]]).filter(([i, l]) => l && i !== imp).map(([i, l]) => [i, `${l.replace(/^Mobile clicks-to-call$/i, "Call button").replace(/^Get location details$/i, "Location details")} shown`]);
  if (extra.length) found.push("extras");
  if (!found.length) throw new Error("No impressions, clicks, cost, calls or conversions columns found.");
  const rows = lines.slice(hi + 1).map(splitCsv).map((c) => {
    const day = parseDay(c[0]);
    if (!day) return null;
    const r = { day };
    // Blank or "--" cells are left out, so figures already saved for that day stay
    for (const k of found) { if (k === "extras") continue; const v = num(c[cols[k]]); if (v != null) r[k] = v; }
    if (extra.length) r.extras = Object.fromEntries(extra.map(([i, l]) => [l, num(c[i])]).filter(([, v]) => v != null));
    return r;
  }).filter(Boolean);
  return { rows, found };
}

function Import({ c, onDone }) {
  const [msg, setMsg] = useState(null);
  const load = async (text) => {
    try {
      const { rows, found } = parseTimeSeries(text);
      if (!rows.length) throw new Error("No dated rows found.");
      // Rows with the same columns go up together (a bulk upsert needs matching keys)
      const groups = new Map();
      for (const r of rows) { const key = Object.keys(r).sort().join(","); groups.set(key, [...(groups.get(key) || []), r]); }
      for (const list of groups.values()) {
        const { error } = await supabase.from("campaign_days").upsert(list.map((r) => ({ ...r, campaign_id: c.id, project_id: c.project_id, updated_at: new Date().toISOString() })), { onConflict: "campaign_id,day" });
        if (error) throw error;
      }
      setMsg(["good", `Imported ${rows.length} day${rows.length > 1 ? "s" : ""}: ${found.join(", ")}. Other figures already entered were kept.`]); onDone();
    } catch (e) { setMsg(["bad", e.message]); }
  };
  return (
    <div className="text-sm mt-2">
      <label className="underline cursor-pointer" style={{ color: C.deep }}>Import a Google Ads time-series CSV
        <input type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) await load(await f.text()); e.target.value = ""; }} />
      </label>
      <span className="text-xs ml-2" style={{ color: C.mute }}>Columns used: Date, Impr. (or Impr. Headline), Clicks, Cost, Phone calls, Conversions</span>
      {msg && <div className="text-xs mt-1" style={{ color: msg[0] === "good" ? C.good : C.bad }}>{msg[1]}</div>}
    </div>
  );
}

function DayForm({ c, onDone }) {
  const [f, setF] = useState({ day: new Date().toISOString().slice(0, 10) });
  const [msg, setMsg] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault();
    const row = { campaign_id: c.id, project_id: c.project_id, day: f.day, updated_at: new Date().toISOString() };
    for (const k of ["impressions", "clicks", "cost", "calls", "conversions"]) if (f[k] !== undefined && f[k] !== "") row[k] = Number(f[k]);
    const { error } = await supabase.from("campaign_days").upsert(row, { onConflict: "campaign_id,day" });
    if (error) return setMsg(error.message);
    setMsg(null); onDone();
  };
  return (
    <form onSubmit={save} className="grid gap-x-2 grid-cols-3 md:grid-cols-7 items-end mt-2">
      <label className="block text-xs" style={{ color: C.mute }}>Day<input type="date" required value={f.day} onChange={set("day")} className={input} style={fs} /></label>
      {[["impressions", "Impr."], ["clicks", "Clicks"], ["cost", "Cost ₹"], ["calls", "Calls"], ["conversions", "Conv."]].map(([k, l]) => (
        <label key={k} className="block text-xs" style={{ color: C.mute }}>{l}<input type="number" min="0" step="any" value={f[k] ?? ""} onChange={set(k)} className={input} style={fs} /></label>
      ))}
      <div><button type="submit" className="px-3 py-1.5 rounded text-sm font-semibold" style={btn}>Save day</button></div>
      {msg && <div className="text-xs col-span-full" style={{ color: C.bad }}>{msg}</div>}
    </form>
  );
}

function CampaignForm({ projectId, c, onDone }) {
  const [f, setF] = useState(c || { status: "live", platform: "Google Ads", type: "Search" });
  const [msg, setMsg] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const save = async (e) => {
    e.preventDefault();
    const body = { project_id: projectId, updated_at: new Date().toISOString() };
    for (const k of ["name", "platform", "status", ...DETAILS.map(([k]) => k)]) body[k] = f[k] === "" ? null : f[k] ?? null;
    body.highlights = f.highlights || null;
    body.client_visible = !!f.client_visible;
    const { error } = c ? await supabase.from("campaigns").update(body).eq("id", c.id) : await supabase.from("campaigns").insert(body);
    if (error) return setMsg(error.message);
    onDone();
  };
  const L = ({ k, l, area, type }) => (
    <label className={`block text-xs mb-2 ${area ? "md:col-span-2" : ""}`} style={{ color: C.mute }}>{l}
      {area ? <textarea rows={3} value={f[k] || ""} onChange={set(k)} className={input} style={fs} /> : <input type={type || "text"} value={f[k] || ""} onChange={set(k)} className={input} style={fs} />}
    </label>
  );
  return (
    <form onSubmit={save} className="p-4 mb-4 grid md:grid-cols-2 gap-x-4" style={{ background: C.card, border: `1px solid ${C.deep}`, borderRadius: 4 }}>
      <label className="block text-xs mb-2 md:col-span-2" style={{ color: C.mute }}>Campaign name (as in Google Ads)<input required value={f.name || ""} onChange={set("name")} className={input} style={fs} /></label>
      {L({ k: "platform", l: "Platform" })}
      <label className="block text-xs mb-2" style={{ color: C.mute }}>Status
        <select value={f.status} onChange={set("status")} className={input} style={fs}>{Object.entries(STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select>
      </label>
      {L({ k: "type", l: "Type" })}
      {L({ k: "started_on", l: "Started", type: "date" })}
      {L({ k: "ended_on", l: "Ended / paused on", type: "date" })}
      {L({ k: "budget", l: "Budget" })}
      {L({ k: "locations", l: "Where the ads show" })}
      {L({ k: "networks", l: "Networks" })}
      {L({ k: "schedule", l: "When the ads show" })}
      {L({ k: "goal", l: "Goal" })}
      {L({ k: "bidding", l: "Bidding" })}
      {L({ k: "landing_url", l: "Ad opens (page)" })}
      {L({ k: "keywords", l: "Keywords (one per line)", area: true })}
      {L({ k: "ads", l: "The ad: headlines and descriptions (one per line)", area: true })}
      {L({ k: "assets", l: "Extras on the ad (sitelinks, call button…)", area: true })}
      {L({ k: "notes", l: "Notes the client sees", area: true })}
      {L({ k: "highlights", l: "How it’s going (shown first, one point per line)", area: true })}
      <label className="flex items-center gap-2 text-sm mb-2 md:col-span-2"><input type="checkbox" checked={!!f.client_visible} onChange={set("client_visible")} /> Client can see this campaign and its results</label>
      <div className="flex gap-2 items-center md:col-span-2">
        <button type="submit" className="px-3 py-1 rounded text-sm font-semibold" style={btn}>Save</button>
        <button type="button" className="text-xs underline" onClick={onDone}>Cancel</button>
        {msg && <span className="text-xs" style={{ color: C.bad }}>{msg}</span>}
      </div>
    </form>
  );
}

/* ───────── date-wise trend: one small chart per measure (different scales never share an axis) ───────── */
const short = (d) => new Date(`${d}T12:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
function Trend({ title, data, fmt: raw }) {
  const fmt = (v, axis) => (v == null ? "–" : raw(v, axis));
  const last = data.length - 1;
  // A figure that stops before the latest day says so, rather than looking like a drop
  const upto = data.reduce((a, d, i) => (d.v != null ? i : a), -1);
  return (
    <figure className="p-2 rounded" style={{ border: `1px solid ${C.rule}` }}>
      <figcaption className="text-xs font-semibold mb-1" style={{ color: C.ink }}>{title}</figcaption>
      <div style={{ height: 130 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 16, right: 18, left: -18, bottom: 0 }}>
            <CartesianGrid stroke={C.rule} strokeOpacity={0.6} vertical={false} />
            <XAxis dataKey="d" tick={{ fontSize: 10, fill: C.mute }} tickLine={false} axisLine={{ stroke: C.rule }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10, fill: C.mute }} tickLine={false} axisLine={false} allowDecimals={false} width={44} tickFormatter={(v) => fmt(v, true)} />
            <Tooltip formatter={(v) => [fmt(v), title]} labelStyle={{ color: C.ink }} itemStyle={{ color: C.ink }} contentStyle={{ fontSize: 12, borderColor: C.rule }} cursor={{ stroke: C.mute, strokeDasharray: "3 3" }} />
            <Line type="monotone" dataKey="v" stroke={C.deep} strokeWidth={2} dot={{ r: 4, fill: C.deep, stroke: C.card, strokeWidth: 2 }} activeDot={{ r: 6 }} connectNulls isAnimationActive={false}>
              {/* Only the latest value is labelled; the rest are on hover and in the table below */}
              <LabelList dataKey="v" content={({ x, y, value, index }) => (index === last && value != null ? <text x={x} y={y - 8} textAnchor="end" fontSize={11} fill={C.ink}>{fmt(value)}</text> : null)} />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </div>
      {upto >= 0 && upto < last && <div className="text-xs mt-1" style={{ color: C.mute }}>By day up to {data[upto].d}; later days are added when Google’s day-by-day report is in.</div>}
    </figure>
  );
}

function Trends({ list }) {
  const has = (k) => list.some((d) => d[k] != null);
  const series = (f) => list.map((d) => ({ d: short(d.day), v: f(d) }));
  const charts = [
    has("impressions") && ["Times the ad was shown", series((d) => n0(d.impressions)), (v) => int(v)],
    has("clicks") && ["Clicks", series((d) => n0(d.clicks)), (v) => int(v)],
    has("impressions") && has("clicks") && ["Click rate", series((d) => (d.impressions && d.clicks != null ? Math.round((d.clicks / d.impressions) * 10000) / 100 : null)), (v, axis) => `${axis ? Math.round(v) : v.toFixed(2)}%`],
    has("cost") && ["Spent (₹, before GST)", series((d) => n0(d.cost)), (v) => rs(v)],
    has("calls") && ["Calls from the ad", series((d) => n0(d.calls)), (v) => int(v)],
  ].filter(Boolean);
  if (list.length < 2 || !charts.length) return null;
  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mb-3" aria-label="Trend by date">
      {charts.map(([t, data, fmt]) => <Trend key={t} title={t} data={data} fmt={fmt} />)}
    </div>
  );
}

/* ───────── one campaign: details and results by day ───────── */
function Campaign({ c, days, admin, onChange }) {
  const [edit, setEdit] = useState(false);
  const [more, setMore] = useState(false);
  const [adding, setAdding] = useState(false);
  const list = days.filter((d) => d.campaign_id === c.id).sort((a, b) => a.day.localeCompare(b.day));
  const stamp = [c.updated_at, ...list.map((d) => d.updated_at)].filter(Boolean).sort().at(-1);
  const extraKeys = [...new Set(list.flatMap((d) => Object.keys(d.extras || {})))];
  // A total only when every day the ad ran has the figure (a day it was never shown counts as 0), so a part-filled column never looks complete
  const sum = (k) => (list.every((d) => d[k] != null || !Number(d.impressions)) && list.some((d) => d[k] != null) ? list.reduce((a, d) => a + (n0(d[k]) || 0), 0) : null);
  const tot = { impressions: sum("impressions"), clicks: sum("clicks"), cost: sum("cost"), calls: sum("calls"), conversions: sum("conversions") };
  // CTR and cost per click only over days that have both figures
  const both = (a, b) => list.filter((d) => d[a] != null && d[b] != null);
  const ctr = (rows) => { const i = rows.reduce((x, d) => x + Number(d.impressions), 0); return i ? `${((rows.reduce((x, d) => x + Number(d.clicks), 0) / i) * 100).toFixed(2)}%` : "–"; };
  const cpc = (rows) => { const k = rows.reduce((x, d) => x + Number(d.clicks), 0); return k ? rs(Math.round((rows.reduce((x, d) => x + Number(d.cost), 0) / k) * 100) / 100) : "–"; };
  const share = async () => { await supabase.from("campaigns").update({ client_visible: !c.client_visible, updated_at: new Date().toISOString() }).eq("id", c.id); onChange(); };
  const MORE = ["keywords", "ads", "assets", "bidding"];
  // Table columns: a column with no figure on any day is left out
  const any = (k) => list.some((d) => d[k] != null);
  const COLS = [
    ["Day", (d) => fmtDate(d.day), "Total", true],
    ["Shown", (d) => int(n0(d.impressions)), int(tot.impressions), true],
    ["Clicks", (d) => int(n0(d.clicks)), int(tot.clicks), any("clicks")],
    ["Click rate", (d) => ctr(d.impressions != null && d.clicks != null ? [d] : []), ctr(both("impressions", "clicks")), any("clicks")],
    ["Spent", (d) => rs(n0(d.cost)), rs(tot.cost), any("cost")],
    ["Per click", (d) => cpc(d.clicks != null && d.cost != null ? [d] : []), cpc(both("clicks", "cost")), any("cost") && any("clicks")],
    ["Calls", (d) => int(n0(d.calls)), int(tot.calls), any("calls")],
  ].filter((x) => x[3]);
  const shown = more ? DETAILS : DETAILS.filter(([k]) => !MORE.includes(k));
  if (edit) return <CampaignForm projectId={c.project_id} c={c} onDone={() => { setEdit(false); onChange(); }} />;
  return (
    <Card className="mb-4">
      <div className="flex flex-wrap items-baseline gap-2 mb-2">
        <span className="font-semibold" style={{ color: C.deep }}>{c.name}</span>
        <Chip tone={STATUS[c.status][1]}>{STATUS[c.status][0]}</Chip>
        <span className="text-xs" style={{ color: C.mute }}>{c.platform}</span>
        {admin && (c.client_visible ? <Chip tone="good">Shared</Chip> : <Chip tone="info">Private</Chip>)}
        {admin && <span className="ml-auto text-xs whitespace-nowrap">
          <button className="underline mr-3" style={{ color: C.deep }} onClick={() => setEdit(true)}>Edit</button>
          <button className="underline" style={{ color: c.client_visible ? C.mute : C.good }} onClick={share}>{c.client_visible ? "Unshare" : "Share"}</button>
        </span>}
      </div>
      {c.highlights && (
        <div className="p-3 mb-3 rounded text-sm" style={{ background: C.goodBg, border: `1px solid ${C.good}` }} aria-label="How it’s going">
          <div className="font-semibold mb-1" style={{ color: C.good }}>How it’s going</div>
          <ul className="pl-5" style={{ listStyle: "disc", lineHeight: 1.6 }}>{c.highlights.split("\n").filter(Boolean).map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      )}
      <dl className="grid gap-x-4 text-sm" style={{ gridTemplateColumns: "minmax(110px, max-content) 1fr" }}>
        {shown.filter(([k]) => c[k]).map(([k, l]) => (
          <div key={k} className="contents">
            <dt className="py-1" style={{ color: C.mute }}>{l}</dt>
            <dd className="py-1" style={{ whiteSpace: "pre-wrap" }}>{k === "started_on" || k === "ended_on" ? fmtDate(c[k]) : k === "landing_url" ? <a href={c[k]} target="_blank" rel="noreferrer" className="underline" style={{ color: C.deep }}>{c[k].replace(/^https?:\/\//, "")}</a> : c[k]}</dd>
          </div>
        ))}
      </dl>
      {MORE.some((k) => c[k]) && (
        <button className="text-xs underline mt-1" style={{ color: C.deep }} onClick={() => setMore(!more)} aria-expanded={more}>{more ? "Fewer details" : "Keywords, the ad and more details"}</button>
      )}
      {(list.length > 0 || admin) && (<>
        <div className="font-semibold text-sm mt-4 mb-2" style={{ color: C.deep }}>Trend and results by day{c.started_on ? ` since ${fmtDate(c.started_on)}` : ""}</div>
        {list.length > 0 && <div className="text-xs mb-2" style={{ color: C.mute }}>Report updated as on <b style={{ color: C.ink }}>{fmtDateTime(stamp)} IST</b> · figures up to {fmtDate(list.at(-1).day)}</div>}
        <Trends list={list} />
        {!list.length ? <P style={{ color: C.mute }}>No figures yet.</P> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ borderCollapse: "collapse", fontVariantNumeric: "tabular-nums" }} aria-label={`Results by day: ${c.name}`}>
              <thead><tr>{COLS.map(([h], i) => (
                <th key={h} className="py-1.5 pr-3 font-semibold" style={{ borderBottom: `2px solid ${C.deep}`, color: C.deep, textAlign: i ? "right" : "left", whiteSpace: "nowrap" }}>{h}</th>
              ))}</tr></thead>
              <tbody>
                {list.map((d) => (
                  <tr key={d.day}>
                    {COLS.map(([, f]) => f(d)).map((v, i) => (
                      <td key={i} className="py-1.5 pr-3" style={{ borderBottom: `1px solid ${C.rule}`, textAlign: i ? "right" : "left", whiteSpace: "nowrap" }}>{v}</td>
                    ))}
                  </tr>
                ))}
                <tr>
                  {COLS.map(([, , t]) => t).map((v, i) => (
                    <td key={i} className="py-1.5 pr-3 font-semibold" style={{ textAlign: i ? "right" : "left", whiteSpace: "nowrap" }}>{v}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
        {/* Admin only: the client sees the main figures, not each extra */}
        {admin && extraKeys.length > 0 && (
          <div className="overflow-x-auto mt-3">
            <div className="text-xs font-semibold mb-1" style={{ color: C.ink }}>Extras shown with the ad, by day <span className="font-normal" style={{ color: C.mute }}>(only you see this)</span></div>
            <table className="w-full text-sm" style={{ borderCollapse: "collapse", fontVariantNumeric: "tabular-nums" }} aria-label={`Extras by day: ${c.name}`}>
              <thead><tr>{["Day", ...extraKeys].map((h, i) => <th key={h} className="py-1.5 pr-3 font-semibold" style={{ borderBottom: `2px solid ${C.deep}`, color: C.deep, textAlign: i ? "right" : "left", whiteSpace: "nowrap" }}>{h}</th>)}</tr></thead>
              <tbody>
                {list.map((d) => <tr key={d.day}>{[fmtDate(d.day), ...extraKeys.map((k) => int(n0(d.extras?.[k])))].map((v, i) => <td key={i} className="py-1.5 pr-3" style={{ borderBottom: `1px solid ${C.rule}`, textAlign: i ? "right" : "left", whiteSpace: "nowrap" }}>{v}</td>)}</tr>)}
                <tr>{["Total", ...extraKeys.map((k) => int(list.reduce((a, d) => a + (n0(d.extras?.[k]) || 0), 0)))].map((v, i) => <td key={i} className="py-1.5 pr-3 font-semibold" style={{ textAlign: i ? "right" : "left" }}>{v}</td>)}</tr>
              </tbody>
            </table>
          </div>
        )}
        <div className="text-xs mt-1" style={{ color: C.mute }}>“Shown” is how many times the ad appeared. “Calls” counts calls from the ad’s call button. A dash means the figure is not in yet. Spent is as Google reports it, before GST.</div>
        {admin && (<>
          <Import c={c} onDone={onChange} />
          <button className="text-xs underline mt-1" style={{ color: C.deep }} onClick={() => setAdding(!adding)}>{adding ? "Close" : "Enter or correct one day by hand"}</button>
          {adding && <DayForm c={c} onDone={() => { setAdding(false); onChange(); }} />}
        </>)}
      </>)}
    </Card>
  );
}

export function Campaigns({ projectId, admin = false }) {
  const camps = useRows(() => { const q = supabase.from("campaigns").select("*").eq("project_id", projectId); return (admin ? q : q.eq("client_visible", true)).order("sort").order("created_at"); }, [projectId, admin]);
  const days = useRows(() => supabase.from("campaign_days").select("*").eq("project_id", projectId).order("day"), [projectId]);
  const [adding, setAdding] = useState(false);
  if (!camps.rows || !days.rows) return <P>Loading…</P>;
  if (!admin && !camps.rows.length) return null;
  const reload = () => { camps.reload(); days.reload(); };
  const order = { live: 0, planned: 1, paused: 2, ended: 3 };
  const list = [...camps.rows].sort((a, b) => order[a.status] - order[b.status]);
  return (
    <div className="mb-6">
      <div className="flex flex-wrap justify-between items-baseline gap-2">
        <H2>Which ads are running</H2>
        {admin && <button onClick={() => setAdding(true)} className="px-3 py-1 rounded text-sm font-semibold" style={btn}>Add campaign</button>}
      </div>
      {adding && <CampaignForm projectId={projectId} onDone={() => { setAdding(false); reload(); }} />}
      {admin && !list.length && <Box tone="info">No campaigns yet. Add the campaigns running in Google Ads, then import their daily figures.</Box>}
      {list.map((c) => <Campaign key={c.id + c.updated_at} c={c} days={days.rows} admin={admin} onChange={reload} />)}
    </div>
  );
}
