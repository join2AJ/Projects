/*
 * What a client looks at: page and section views (page_views) plus what they did (the audit trail), with
 * filters by person, section and date, a chart by date, weekday or hour, and time spent per section.
 * Time on a view = gap to their next view, capped at 30 minutes (longer gaps count as 1 minute: they left).
 */
import { useMemo, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { supabase } from "../lib/supabase.js";
import { useRows } from "../lib/useRows.js";
import { fmtDateTime } from "../lib/money.js";
import { emailToLogin } from "../lib/auth.jsx";
import { C, Chip, H2, P, T, Card } from "./ui.jsx";

const PAGE = { "/portal": "My projects", "/services": "Services", "/process": "How we work", "/security": "Security", "/account": "Account", "/privacy": "Privacy notice" };
const TAB = { index: "Index", gantt: "Timeline chart", overview: "Overview", timeline: "Timeline", meetings: "Meeting notes", promotion: "Promotion plan", decisions: "Decisions", updates: "Updates", issues: "Issues", money: "Money", files: "Files", requests: "Requests", work: "Work done", numbers: "Current results", report: "Previous reports & analysis", data: "Your data" };
export const sectionOf = (v) => (v.tab ? TAB[v.tab] || v.tab : PAGE[v.path] || v.path);
const ist = (d, o) => new Date(d).toLocaleString("en-GB", { timeZone: "Asia/Kolkata", ...o });
const dayKey = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const mins = (s) => (s < 60 ? `${Math.round(s)} s` : s < 3600 ? `${Math.round(s / 60)} min` : `${(s / 3600).toFixed(1)} h`);
const sel = "px-2 py-1 rounded text-sm";
const fs = { border: `1px solid ${C.rule}`, background: "#fff" };

function Bars({ data, x, label, horizontal = false, height = 220 }) {
  const tip = ({ active, payload }) => active && payload?.length ? (
    <div className="text-xs px-2 py-1" style={{ background: C.card, border: `1px solid ${C.rule}`, borderRadius: 4 }}>
      <b>{payload[0].payload[x]}</b>: {payload[0].payload.label ?? payload[0].value}
    </div>
  ) : null;
  return (
    <div style={{ width: "100%", height }} role="img" aria-label={label}>
      <ResponsiveContainer>
        {horizontal ? (
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid stroke={C.rule} horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: C.mute }} allowDecimals={false} />
            <YAxis type="category" dataKey={x} width={110} tick={{ fontSize: 11, fill: C.ink }} />
            <Tooltip content={tip} cursor={{ fill: C.bg }} />
            <Bar dataKey="v" fill={C.deep} radius={[0, 4, 4, 0]} barSize={14} />
          </BarChart>
        ) : (
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={C.rule} vertical={false} />
            <XAxis dataKey={x} tick={{ fontSize: 11, fill: C.mute }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11, fill: C.mute }} allowDecimals={false} width={28} />
            <Tooltip content={tip} cursor={{ fill: C.bg }} />
            <Bar dataKey="v" fill={C.deep} radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

export function ClientActivity({ projectId }) {
  const views = useRows(() => supabase.from("page_views").select("*").or(`project_id.eq.${projectId},project_id.is.null`).order("at").limit(5000), [projectId]);
  const members = useRows(() => supabase.from("project_members").select("email").eq("project_id", projectId), [projectId]);
  const profiles = useRows(() => supabase.from("profiles").select("id,full_name,contact_email"), []);
  const acts = useRows(() => supabase.from("audit_log").select("at,actor_id,actor_name,actor_role,summary").or(`project_id.eq.${projectId},project_id.is.null`).eq("actor_role", "client").order("at", { ascending: false }).limit(1000), [projectId]);
  const [who, setWho] = useState("");
  const [tab, setTab] = useState("");
  const [range, setRange] = useState("30");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [by, setBy] = useState("date");
  const [kind, setKind] = useState("real"); // real clients, the demo replica, or both
  const [part, setPart] = useState("");     // part of the day
  const [wday, setWday] = useState("");

  const data = useMemo(() => {
    if (!views.rows || !members.rows) return null;
    const emails = new Set(members.rows.map((m) => m.email));
    // Only this project's people; time on each view = gap to that person's next view
    const all = views.rows.filter((v) => emails.has(v.who));
    const next = new Map();
    for (let i = all.length - 1; i >= 0; i--) {
      const v = all[i]; const n = next.get(v.who);
      const gap = n ? (new Date(n.at) - new Date(v.at)) / 1000 : null;
      v.secs = gap != null && gap <= 1800 ? gap : 60;
      next.set(v.who, v);
    }
    return all;
  }, [views.rows, members.rows]);

  if (!data || !acts.rows || !profiles.rows) return <P>Loading…</P>;
  // Who is who: the demo account is a replica that shows exactly what the client sees
  const prof = Object.fromEntries(profiles.rows.map((r) => [r.id, r]));
  const isDemo = (v) => /^demo\b/i.test(prof[v.user_id]?.full_name || "");
  const nameOf = (v) => {
    const pr = prof[v.user_id];
    if (isDemo(v)) return `Demo replica (${emailToLogin(v.who)})`;
    return pr ? `${pr.full_name}${pr.contact_email ? ` (${pr.contact_email})` : ""}` : emailToLogin(v.who);
  };
  const partOf = (v) => { const h = Number(ist(v.at, { hour: "2-digit", hour12: false })) % 24; return h >= 6 && h < 12 ? "morning" : h < 17 && h >= 12 ? "afternoon" : h >= 17 && h < 21 ? "evening" : "night"; };
  const scoped = data.filter((v) => (kind === "all" || (kind === "demo") === isDemo(v)));
  const people = [...new Set(scoped.map((v) => v.who))];
  const realNames = [...new Set(data.filter((v) => !isDemo(v)).map(nameOf))];
  const sections = [...new Set(data.map(sectionOf))].sort();
  const lo = range === "custom" ? from : range === "all" ? "" : dayKey(Date.now() - (Number(range) - 1) * 864e5);
  const hi = range === "custom" ? to : "";
  const rows = scoped.filter((v) => (!who || v.who === who) && (!tab || sectionOf(v) === tab) && (!lo || dayKey(v.at) >= lo) && (!hi || dayKey(v.at) <= hi)
    && (!part || partOf(v) === part) && (!wday || ist(v.at, { weekday: "short" }) === wday));
  // This project's people only (general actions like sign-ins have no project)
  const ids = new Set(scoped.filter((v) => !who || v.who === who).map((v) => v.user_id));
  const did = acts.rows.filter((a) => ids.has(a.actor_id) && (!lo || dayKey(a.at) >= lo) && (!hi || dayKey(a.at) <= hi));

  // Chart by date (every day in range), weekday or hour
  let chart;
  if (by === "date") {
    const days = new Map();
    const start = lo || (rows[0] && dayKey(rows[0].at));
    const end = hi || dayKey(Date.now());
    if (start) for (let d = new Date(start + "T12:00:00+05:30"); dayKey(d) <= end; d = new Date(d.getTime() + 864e5)) days.set(dayKey(d), 0);
    rows.forEach((v) => days.set(dayKey(v.at), (days.get(dayKey(v.at)) || 0) + 1));
    chart = [...days].map(([k, v]) => ({ k: ist(k + "T12:00:00+05:30", { day: "numeric", month: "short" }), v, label: `${v} view${v === 1 ? "" : "s"}` }));
  } else if (by === "weekday") {
    chart = WEEK.map((k) => ({ k, v: 0 }));
    rows.forEach((v) => { chart[WEEK.indexOf(ist(v.at, { weekday: "short" }))].v++; });
  } else {
    chart = Array.from({ length: 24 }, (_, h) => ({ k: String(h).padStart(2, "0"), v: 0 }));
    rows.forEach((v) => chart[Number(ist(v.at, { hour: "2-digit", hour12: false })) % 24].v++);
  }
  const time = new Map();
  rows.forEach((v) => time.set(sectionOf(v), (time.get(sectionOf(v)) || 0) + v.secs));
  const bySection = [...time].sort((a, b) => b[1] - a[1]).map(([k, s]) => ({ k, v: Math.round(s / 60), label: mins(s) }));
  const total = rows.reduce((a, v) => a + v.secs, 0);
  const visits = new Set(rows.map((v) => `${v.who}|${dayKey(v.at)}`)).size;
  const last = rows.at(-1);
  // One line per person: how much they use the portal and what they look at most
  const perPerson = people.map((w) => {
    const mine = rows.filter((v) => v.who === w);
    const t = new Map(); mine.forEach((v) => t.set(sectionOf(v), (t.get(sectionOf(v)) || 0) + v.secs));
    const top = [...t].sort((a, b) => b[1] - a[1])[0];
    return { w, name: mine[0] ? nameOf(mine[0]) : nameOf(scoped.find((v) => v.who === w)), views: mine.length, days: new Set(mine.map((v) => dayKey(v.at))).size, secs: mine.reduce((a, v) => a + v.secs, 0), last: mine.at(-1)?.at, top: top ? `${top[0]} (${mins(top[1])})` : "–" };
  });

  return (
    <div>
      <P>Which pages and sections your client opens, when, and for how long, plus what they did. Clients are told about this in the privacy notice.</P>
      <div className="text-sm mb-3 p-3" style={{ background: C.infoBg, borderRadius: 4 }}>
        <b>Client:</b> {realNames.length ? realNames.join(", ") : "Dr. Rajveer (rajveer.pt@gmail.com) has not opened the portal since tracking began"}.
        {" "}The <b>demo replica</b> (demo.rajveer@example.com) sees exactly what the client sees, for your own checks; it is left out unless you choose it below.
      </div>
      <div className="flex flex-wrap gap-2 items-center mb-3" role="group" aria-label="Filters">
        <select aria-label="Accounts" value={kind} onChange={(e) => { setKind(e.target.value); setWho(""); }} className={sel} style={fs}>
          <option value="real">Real clients</option><option value="demo">Demo replica</option><option value="all">Both</option>
        </select>
        <select aria-label="Person" value={who} onChange={(e) => setWho(e.target.value)} className={sel} style={fs}>
          <option value="">Everyone</option>{people.map((p) => <option key={p} value={p}>{nameOf(scoped.find((v) => v.who === p))}</option>)}
        </select>
        <select aria-label="Day of the week" value={wday} onChange={(e) => setWday(e.target.value)} className={sel} style={fs}>
          <option value="">Any day</option>{WEEK.map((d) => <option key={d}>{d}</option>)}
        </select>
        <select aria-label="Time of day" value={part} onChange={(e) => setPart(e.target.value)} className={sel} style={fs}>
          <option value="">Any time</option><option value="morning">Morning (6–12)</option><option value="afternoon">Afternoon (12–17)</option><option value="evening">Evening (17–21)</option><option value="night">Night (21–6)</option>
        </select>
        <select aria-label="Section" value={tab} onChange={(e) => setTab(e.target.value)} className={sel} style={fs}>
          <option value="">All sections</option>{sections.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select aria-label="Period" value={range} onChange={(e) => setRange(e.target.value)} className={sel} style={fs}>
          <option value="1">Today</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="all">All time</option><option value="custom">Dates…</option>
        </select>
        {range === "custom" && (<>
          <input aria-label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={sel} style={fs} />
          <input aria-label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} className={sel} style={fs} />
        </>)}
      </div>
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-4">
        {[["Views", rows.length], ["Days active", visits], ["Time spent", mins(total)], ["Last seen", last ? fmtDateTime(last.at, { dateStyle: "medium", timeStyle: "short" }) : "Never"]].map(([l, v]) => (
          <Card key={l}><div className="text-xs uppercase tracking-wide" style={{ color: C.mute }}>{l}</div><div className="text-xl font-semibold" style={{ color: C.deep, fontVariantNumeric: "tabular-nums" }}>{v}</div></Card>
        ))}
      </div>
      {!rows.length ? <P style={{ color: C.mute }}>No views in this period yet.</P> : (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
              <span className="font-semibold text-sm" style={{ color: C.deep }}>Views by {by === "date" ? "date" : by === "weekday" ? "day of the week" : "hour (IST)"}</span>
              <span className="text-xs" role="group" aria-label="Group by">
                {[["date", "Date"], ["weekday", "Day"], ["hour", "Hour"]].map(([k, l]) => (
                  <button key={k} onClick={() => setBy(k)} aria-pressed={by === k} className="ml-1 px-2 py-0.5 rounded" style={{ border: `1px solid ${by === k ? C.deep : C.rule}`, color: by === k ? C.deep : C.mute, fontWeight: by === k ? 600 : 400 }}>{l}</button>
                ))}
              </span>
            </div>
            <Bars data={chart} x="k" label={`Views by ${by}`} />
          </Card>
          <Card>
            <div className="font-semibold text-sm mb-2" style={{ color: C.deep }}>Time spent by section (minutes)</div>
            <Bars data={bySection} x="k" label="Time spent by section" horizontal height={Math.max(160, bySection.length * 28)} />
          </Card>
        </div>
      )}
      <H2>By person</H2>
      <T head={["Person", "Views", "Days active", "Time spent", "Most viewed", "Last seen"]} right={[1, 2, 3]}
        rows={perPerson.map((r) => [<b key="n">{r.name}</b>, r.views, r.days, mins(r.secs), r.top, r.last ? fmtDateTime(r.last, { dateStyle: "medium", timeStyle: "short" }) : "–"])} />
      <H2>What they did</H2>
      {!did.length ? <P style={{ color: C.mute }}>No actions in this period.</P> : (
        <ul className="text-sm mb-4">
          {did.slice(0, 50).map((a, i) => (
            <li key={i} className="py-1 flex gap-3"><span className="text-xs whitespace-nowrap" style={{ color: C.mute, fontVariantNumeric: "tabular-nums", minWidth: 120 }}>{fmtDateTime(a.at, { dateStyle: "medium", timeStyle: "short" })}</span><span><Chip tone="info">{a.actor_name}</Chip> {a.summary}</span></li>
          ))}
        </ul>
      )}
      <H2>Every view</H2>
      <T head={["When (IST)", "Who", "Page / section", "Time there"]} rows={[...rows].reverse().slice(0, 200).map((v) => [
        <span key="w" className="whitespace-nowrap">{fmtDateTime(v.at, { dateStyle: "medium", timeStyle: "short" })}</span>, nameOf(v), sectionOf(v), mins(v.secs),
      ])} />
      {rows.length > 200 && <P style={{ color: C.mute }}>Showing the latest 200 of {rows.length}.</P>}
    </div>
  );
}
