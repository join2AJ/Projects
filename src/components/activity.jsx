/*
 * Audit trail and client timeline. The database writes every entry (triggers + log_event); nothing here can
 * change or delete one. All times are shown in India time.
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { useRows } from "../lib/useRows.js";
import { fmtDate, fmtDateTime, today } from "../lib/money.js";
import { istDate } from "../data/studio.js";
import { weeklyLabel, schedule, loadChanges } from "../lib/weekly.js";
import { C, Chip, H2, P } from "./ui.jsx";

const ROLE = { admin: ["Admin", "info"], client: ["Client", "good"], system: ["System", "warn"] };
const PAGE = 100;

/* Pretty-print one changed value for the before/after view. */
const show = (v) => (v == null ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));

function Detail({ id }) {
  const { rows } = useRows(() => supabase.from("audit_detail").select("old,new").eq("log_id", id), [id]);
  if (!rows) return <div className="text-xs" style={{ color: C.mute }}>Loading…</div>;
  const d = rows[0];
  if (!d) return <div className="text-xs" style={{ color: C.mute }}>No details recorded.</div>;
  const keys = [...new Set([...Object.keys(d.old || {}), ...Object.keys(d.new || {})])].filter((k) => !["id", "project_id", "created_at"].includes(k));
  return (
    <div className="overflow-x-auto">
      <table className="text-xs mt-1" style={{ borderCollapse: "collapse" }}>
        <thead><tr><th className="pr-3 text-left">Field</th><th className="pr-3 text-left">Before</th><th className="text-left">After</th></tr></thead>
        <tbody>{keys.map((k) => (
          <tr key={k}><td className="pr-3 align-top" style={{ color: C.mute }}>{k}</td>
            <td className="pr-3 align-top" style={{ color: C.bad, maxWidth: 280, wordBreak: "break-word" }}>{show(d.old?.[k])}</td>
            <td className="align-top" style={{ color: C.good, maxWidth: 280, wordBreak: "break-word" }}>{show(d.new?.[k])}</td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}

/* What happened, in plain words, from the logged action and its summary. */
const KIND = { created: ["Created", "good"], updated: ["Updated", "info"], status: ["Status changed", "warn"], shared: ["Shared / unshared", "info"], deleted: ["Deleted", "bad"], signin: ["Signed in / out", "info"], secret: ["Password", "warn"], other: ["Other", "info"] };
const kindOf = (e) => {
  if (["sign_in", "sign_out"].includes(e.action)) return "signin";
  if (e.action?.startsWith("secret.")) return "secret";
  if (e.action === "insert") return "created";
  if (e.action === "delete") return "deleted";
  if (e.action === "update") {
    if (/^(Shared|Unshared|Approved|Unapproved|Sent|Withdrew)\b|shared with the client|made private/.test(e.summary)) return "shared";
    if (/→|\bmarked\b|Decided|Fee approved|Price proposed|accepted|hidden from the client|shown to the client/.test(e.summary)) return "status";
    return "updated";
  }
  return "other";
};
const SECTION = { updates: "Updates", issues: "Issues", decisions: "Decisions", requests: "Requests", request_messages: "Request messages", files: "Files", invoices: "Invoices", expenses: "Expenses", time_entries: "Time", metrics: "Numbers", project_services: "Fees", fee_private: "Fees (private)", projects: "Project", project_members: "Client access", meetings: "Meetings", meeting_items: "Meeting points", strategies: "Promotion plan", schedule_changes: "Update schedule", credentials: "Tools and logins", consents: "Privacy", clients: "Clinics", profiles: "People", services: "Price list", service_notes: "Price list (private)" };
const sectionOf = (e) => (e.table_name ? SECTION[e.table_name] || e.table_name : kindOf(e) === "signin" ? "Sign-ins" : "Other");
const sel = "px-2 py-1 rounded text-sm";
const fs = { border: `1px solid ${C.rule}`, background: "#fff" };

/* Admin: the full trail, for one project or all of them, as a table with filters and grouping. */
export function AuditTrail({ projectId, projects }) {
  const [limit, setLimit] = useState(1000);
  const [f, setF] = useState({ who: "", kind: "", section: "", from: "", to: "", q: "", visible: "", by: "" });
  const [open, setOpen] = useState(null);
  const { rows, error } = useRows(() => {
    let q = supabase.from("audit_log").select("*").order("at", { ascending: false }).limit(limit);
    if (projectId) q = q.eq("project_id", projectId);
    return q;
  }, [projectId, limit]);
  const pname = useMemo(() => Object.fromEntries((projects || []).map((p) => [p.id, p.name])), [projects]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  if (error) return <P style={{ color: C.bad }}>{error.message}</P>;
  if (!rows) return <P>Loading…</P>;
  const people = [...new Set(rows.map((e) => e.actor_name).filter(Boolean))].sort();
  const sections = [...new Set(rows.map(sectionOf))].sort();
  const day = (e) => istDate(new Date(e.at));
  const list = rows.filter((e) => (!f.who || e.actor_name === f.who || e.actor_role === f.who) && (!f.kind || kindOf(e) === f.kind) && (!f.section || sectionOf(e) === f.section)
    && (!f.from || day(e) >= f.from) && (!f.to || day(e) <= f.to) && (!f.q || (e.summary || "").toLowerCase().includes(f.q.toLowerCase()))
    && (!f.visible || String(!!e.client_visible) === f.visible));
  const key = { kind: (e) => KIND[kindOf(e)][0], section: sectionOf, person: (e) => e.actor_name || "System", day: (e) => fmtDate(day(e)) }[f.by];
  const groups = key ? [...list.reduce((m, e) => m.set(key(e), [...(m.get(key(e)) || []), e]), new Map())] : [["", list]];
  const Row = (e) => (
    <tr key={e.id} onClick={() => setOpen(open === e.id ? null : e.id)} style={{ borderBottom: `1px solid ${C.rule}`, cursor: e.table_name ? "pointer" : "default", verticalAlign: "top" }}>
      <td className="py-1.5 pr-3 whitespace-nowrap text-xs" style={{ color: C.mute, fontVariantNumeric: "tabular-nums" }}>{fmtDateTime(e.at, { dateStyle: "medium", timeStyle: "short" })}</td>
      <td className="py-1.5 pr-3 whitespace-nowrap"><Chip tone={(ROLE[e.actor_role] || ROLE.system)[1]}>{(ROLE[e.actor_role] || ROLE.system)[0]}</Chip> {e.actor_name}</td>
      <td className="py-1.5 pr-3 whitespace-nowrap"><Chip tone={KIND[kindOf(e)][1]}>{KIND[kindOf(e)][0]}</Chip></td>
      <td className="py-1.5 pr-3 whitespace-nowrap">{sectionOf(e)}{!projectId && e.project_id ? <div className="text-xs" style={{ color: C.mute }}>{pname[e.project_id] || ""}</div> : null}</td>
      <td className="py-1.5 pr-3" style={{ minWidth: 240 }}>{e.summary}{open === e.id && e.table_name && <Detail id={e.id} />}</td>
      <td className="py-1.5 whitespace-nowrap">{e.client_visible ? <Chip tone="good">Client sees</Chip> : <Chip tone="info">Private</Chip>}</td>
    </tr>
  );
  return (
    <div>
      <P>Every change, with the time (IST), who made it and what changed. Entries cannot be edited or deleted. Click a row to see before and after.</P>
      <div className="flex flex-wrap gap-2 items-center mb-3" role="group" aria-label="Filter activity">
        <select aria-label="Who" value={f.who} onChange={set("who")} className={sel} style={fs}>
          <option value="">Everyone</option><option value="admin">Admin</option><option value="client">Clients</option><option value="system">System</option>
          {people.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select aria-label="What happened" value={f.kind} onChange={set("kind")} className={sel} style={fs}>
          <option value="">Any change</option>{Object.entries(KIND).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select aria-label="Section" value={f.section} onChange={set("section")} className={sel} style={fs}>
          <option value="">All sections</option>{sections.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select aria-label="Client can see" value={f.visible} onChange={set("visible")} className={sel} style={fs}>
          <option value="">Shared and private</option><option value="true">Client sees</option><option value="false">Private</option>
        </select>
        <input aria-label="From" type="date" value={f.from} onChange={set("from")} className={sel} style={fs} />
        <input aria-label="To" type="date" value={f.to} onChange={set("to")} className={sel} style={fs} />
        <input aria-label="Search" placeholder="Search…" value={f.q} onChange={set("q")} className={sel} style={{ ...fs, minWidth: 140 }} />
        <select aria-label="Group by" value={f.by} onChange={set("by")} className={sel} style={fs}>
          <option value="">No grouping</option><option value="kind">Group by change</option><option value="section">Group by section</option><option value="person">Group by person</option><option value="day">Group by day</option>
        </select>
      </div>
      <div className="text-xs mb-2" style={{ color: C.mute }}>{list.length} of {rows.length} entries · {Object.entries(KIND).map(([k, [l]]) => [l, list.filter((e) => kindOf(e) === k).length]).filter(([, n]) => n).map(([l, n]) => `${l} ${n}`).join(" · ")}</div>
      {!list.length ? <P style={{ color: C.mute }}>Nothing matches.</P> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <thead><tr className="text-left text-xs" style={{ color: C.mute, borderBottom: `1px solid ${C.rule}` }}>
              <th className="py-1 pr-3 font-semibold">When (IST)</th><th className="py-1 pr-3 font-semibold">Who</th><th className="py-1 pr-3 font-semibold">Change</th>
              <th className="py-1 pr-3 font-semibold">Section</th><th className="py-1 pr-3 font-semibold">What</th><th className="py-1 font-semibold">Client</th>
            </tr></thead>
            {groups.map(([g, items]) => (
              <tbody key={g || "all"}>
                {g && <tr><td colSpan={6} className="pt-3 pb-1 text-sm font-semibold" style={{ color: C.deep }}>{g} <span className="text-xs font-normal" style={{ color: C.mute }}>({items.length})</span></td></tr>}
                {items.map(Row)}
              </tbody>
            ))}
          </table>
        </div>
      )}
      {rows.length === limit && <button className="underline text-sm mt-2" style={{ color: C.deep }} onClick={() => setLimit(limit + 1000)}>Load older entries</button>}
    </div>
  );
}

/* Your own sign-ins (any signed-in user). */
export function MySignIns({ userId }) {
  const { rows } = useRows(() => supabase.from("audit_log").select("at,summary").eq("actor_id", userId).in("action", ["sign_in", "sign_out"]).order("at", { ascending: false }).limit(10), [userId]);
  if (!rows?.length) return <P style={{ color: C.mute }}>No sign-ins recorded yet.</P>;
  return (
    <ul className="text-sm">
      {rows.map((r, i) => <li key={i} className="py-1"><span style={{ color: C.mute, fontVariantNumeric: "tabular-nums" }}>{fmtDateTime(r.at, { dateStyle: "medium", timeStyle: "medium" })}</span> · {r.summary}</li>)}
    </ul>
  );
}

/* ───────── client timeline: what's next, then everything that happened ───────── */
export function Timeline({ project }) {
  const pid = project.id;
  const log = useRows(() => supabase.from("audit_log").select("id,at,actor_name,actor_role,summary").eq("project_id", pid).eq("client_visible", true).eq("actor_role", "client").order("at", { ascending: false }).limit(300), [pid]);
  const upd = useRows(() => supabase.from("updates").select("id,happened_on,publish_at,created_at,title,kind,status").eq("project_id", pid).eq("client_visible", true), [pid]);
  const dec = useRows(() => supabase.from("decisions").select("question,due_on,status,answer").eq("project_id", pid).eq("client_visible", true).eq("status", "open"), [pid]);
  const inv = useRows(() => supabase.from("invoices").select("number,due_on,status").eq("project_id", pid).eq("status", "sent"), [pid]);
  // Ajay's replies to requests, so each "Request sent" has its answer next to it
  const rep = useRows(() => supabase.from("request_messages").select("id,body,created_at,author_role,requests(details)").eq("project_id", pid).eq("author_role", "admin"), [pid]);
  const chg = useRows(loadChanges, []);
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 60000); return () => clearInterval(t); }, []);

  if ([log, upd, dec, inv, chg, rep].some((x) => !x.rows)) return <P>Loading…</P>;
  const now = today();
  // The next weekly updates at their actual times. Skipped or moved dates are never mentioned to the client.
  const started = upd.rows.some((u) => u.kind === "meeting" && u.publish_at && new Date(u.publish_at) <= new Date());
  const weeks = schedule(chg.rows, pid, 6).filter((s) => s.at && s.at > new Date()).sort((a, b) => a.at - b.at).slice(0, 4)
    .map((s, i) => ({ day: istDate(s.at), what: !started && i === 0 ? `Weekly updates start on this page (${weeklyLabel(s.at)}), then every Tuesday` : `Weekly update on this page (${weeklyLabel(s.at)})`, kind: "update" }));
  const ahead = [
    ...weeks,
    ...upd.rows.filter((u) => u.status === "Scheduled" && u.happened_on >= now).map((u) => ({ day: u.happened_on, what: u.title, kind: "plan" })),
    ...dec.rows.filter((d) => !d.answer && d.due_on).map((d) => ({ day: d.due_on, what: `Your answer needed: ${d.question}`, kind: "you" })),
    ...(project.money_open === false ? [] : inv.rows.map((i) => ({ day: i.due_on, what: `Payment due: invoice ${i.number}`, kind: "you" }))),
  ];
  // The extra one-off update, unless a planned item already covers that day
  if (project.next_meeting_at && new Date(project.next_meeting_at) > new Date()) {
    const d = istDate(new Date(project.next_meeting_at));
    if (!ahead.some((x) => x.kind === "plan" && x.day === d)) ahead.push({ day: d, what: project.next_meeting_note || "Extra update", kind: "update" });
  }
  ahead.sort((a, b) => a.day.localeCompare(b.day));

  const past = [
    // The client's own answers were recorded as edits; say what they were
    ...log.rows.map((e) => ({ at: e.at, who: e.actor_name, role: e.actor_role, what: e.summary.replace(/^Edited decision /, "Answered ") })),
    ...rep.rows.map((m) => ({ at: m.created_at, who: "Ajay", role: "admin", what: `Ajay replied: “${m.body.length > 220 ? m.body.slice(0, 220) + "…" : m.body}”` })),
    ...upd.rows.filter((u) => u.status !== "Scheduled" || u.happened_on < now)
      .map((u) => ({ at: u.publish_at || `${u.happened_on}T12:00:00+05:30`, who: "Ajay", role: "admin", what: `${u.kind === "meeting" ? "Weekly update" : "Update"}: ${u.title}`, dayOnly: !u.publish_at })),
  ].sort((a, b) => String(b.at).localeCompare(String(a.at)));

  const groups = [];
  for (const e of past) {
    const d = istDate(new Date(e.at));
    if (!groups.length || groups.at(-1)[0] !== d) groups.push([d, []]);
    groups.at(-1)[1].push(e);
  }
  const TONE = { update: "info", plan: "info", you: "warn" };
  return (
    <div>
      <H2>Coming up</H2>
      <ul className="mb-4">
        {ahead.map((a, i) => (
          <li key={i} className="flex gap-3 py-1 text-sm">
            <span className="whitespace-nowrap" style={{ color: C.mute, minWidth: 92, fontVariantNumeric: "tabular-nums" }}>{fmtDate(a.day)}</span>
            <span><Chip tone={TONE[a.kind]}>{a.kind === "you" ? "You" : a.kind === "update" ? "Update" : "Planned"}</Chip> {a.what}</span>
          </li>
        ))}
      </ul>
      <H2>What has happened</H2>
      <P style={{ color: C.mute }}>Times are India time. This record is kept automatically and cannot be changed.</P>
      {!groups.length ? <P style={{ color: C.mute }}>Nothing yet.</P> : groups.map(([d, list]) => (
        <div key={d} className="mb-3">
          <div className="text-xs font-semibold mb-1" style={{ color: C.deep }}>{fmtDate(d)}</div>
          <ul className="pl-3" style={{ borderLeft: `2px solid ${C.rule}` }}>
            {list.map((e, i) => (
              <li key={i} className="py-1 text-sm">
                <span className="text-xs" style={{ color: C.mute, fontVariantNumeric: "tabular-nums" }}>{e.dayOnly ? "" : fmtDateTime(e.at, { timeStyle: "short" }) + " · "}{e.who}</span>
                <div>{e.what}</div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
