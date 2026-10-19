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
import { C, Chip, H2, P, Pills } from "./ui.jsx";

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

/* Admin: the full trail, for one project or all of them. */
export function AuditTrail({ projectId, projects }) {
  const [who, setWho] = useState("all");
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState(null);
  const { rows, error } = useRows(() => {
    let q = supabase.from("audit_log").select("*").order("at", { ascending: false }).limit(limit);
    if (projectId) q = q.eq("project_id", projectId);
    if (who === "signins") q = q.in("action", ["sign_in", "sign_out"]);
    else if (who !== "all") q = q.eq("actor_role", who);
    return q;
  }, [projectId, who, limit]);
  const pname = useMemo(() => Object.fromEntries((projects || []).map((p) => [p.id, p.name])), [projects]);
  return (
    <div>
      <P>Every change, with the time (IST), who made it and what changed. Entries cannot be edited or deleted. Click an entry to see before and after.</P>
      <Pills label="Filter activity" value={who} onChange={(v) => { setWho(v); setLimit(PAGE); }}
        options={[["all", "Everything"], ["admin", "By you"], ["client", "By clients"], ["system", "System"], ["signins", "Sign-ins"]]} />
      {error && <P style={{ color: C.bad }}>{error.message}</P>}
      {!rows ? <P>Loading…</P> : !rows.length ? <P style={{ color: C.mute }}>Nothing recorded yet.</P> : (
        <ul className="text-sm">
          {rows.map((e) => (
            <li key={e.id} className="py-2" style={{ borderBottom: `1px solid ${C.rule}` }}>
              <button className="w-full text-left" onClick={() => setOpen(open === e.id ? null : e.id)} aria-expanded={open === e.id}>
                <div className="flex flex-wrap gap-2 items-baseline">
                  <span className="text-xs whitespace-nowrap" style={{ color: C.mute, fontVariantNumeric: "tabular-nums" }}>{fmtDateTime(e.at, { dateStyle: "medium", timeStyle: "medium" })}</span>
                  <Chip tone={ROLE[e.actor_role][1]}>{ROLE[e.actor_role][0]}</Chip>
                  <b>{e.actor_name}</b>
                  {!projectId && e.project_id && <span className="text-xs" style={{ color: C.mute }}>· {pname[e.project_id] || "project"}</span>}
                  {e.client_visible && <span className="text-xs" style={{ color: C.good }}>· client can see</span>}
                </div>
                <div style={{ color: C.ink }}>{e.summary}</div>
              </button>
              {open === e.id && e.table_name && <Detail id={e.id} />}
            </li>
          ))}
        </ul>
      )}
      {rows?.length === limit && <button className="underline text-sm mt-2" style={{ color: C.deep }} onClick={() => setLimit(limit + PAGE)}>Show older</button>}
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
  const log = useRows(() => supabase.from("audit_log").select("id,at,actor_name,actor_role,summary").eq("project_id", pid).order("at", { ascending: false }).limit(300), [pid]);
  const upd = useRows(() => supabase.from("updates").select("id,happened_on,publish_at,created_at,title,kind,status").eq("project_id", pid).eq("client_visible", true), [pid]);
  const dec = useRows(() => supabase.from("decisions").select("question,due_on,status,answer").eq("project_id", pid).eq("client_visible", true).eq("status", "open"), [pid]);
  const inv = useRows(() => supabase.from("invoices").select("number,due_on,status").eq("project_id", pid).eq("status", "sent"), [pid]);
  const chg = useRows(loadChanges, []);
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 60000); return () => clearInterval(t); }, []);

  if ([log, upd, dec, inv, chg].some((x) => !x.rows)) return <P>Loading…</P>;
  const now = today();
  // The next four weekly slots, with any skip or move shown
  const weeks = schedule(chg.rows, pid, 6).filter((s) => (s.at || s.slot) > new Date()).slice(0, 4).map((s) => {
    const why = s.change?.reason ? ` (${s.change.reason.replace(/\.$/, "")})` : "";
    if (!s.change) return { day: istDate(s.slot), what: `Weekly update on this page (${weeklyLabel(s.slot)})`, kind: "update" };
    if (s.change.action === "skip") return { day: istDate(s.slot), what: `No update on ${weeklyLabel(s.slot)}: skipped${why}`, kind: "skip" };
    return { day: istDate(s.at), what: `Weekly update moved from ${weeklyLabel(s.slot)} to ${weeklyLabel(s.at)}${why}`, kind: "update" };
  });
  const ahead = [
    ...weeks,
    ...upd.rows.filter((u) => u.status === "Scheduled" && u.happened_on >= now).map((u) => ({ day: u.happened_on, what: u.title, kind: "plan" })),
    ...dec.rows.filter((d) => !d.answer && d.due_on).map((d) => ({ day: d.due_on, what: `Your answer needed: ${d.question}`, kind: "you" })),
    ...inv.rows.map((i) => ({ day: i.due_on, what: `Payment due: invoice ${i.number}`, kind: "you" })),
  ];
  // The extra one-off update, unless a planned item already covers that day
  if (project.next_meeting_at && new Date(project.next_meeting_at) > new Date()) {
    const d = istDate(new Date(project.next_meeting_at));
    if (!ahead.some((x) => x.kind === "plan" && x.day === d)) ahead.push({ day: d, what: project.next_meeting_note || "Extra update", kind: "update" });
  }
  ahead.sort((a, b) => a.day.localeCompare(b.day));

  const past = [
    ...log.rows.map((e) => ({ at: e.at, who: e.actor_name, role: e.actor_role, what: e.summary })),
    ...upd.rows.filter((u) => u.status !== "Scheduled" || u.happened_on < now)
      .map((u) => ({ at: u.publish_at || `${u.happened_on}T12:00:00+05:30`, who: "Ajay", role: "admin", what: `${u.kind === "meeting" ? "Weekly update" : "Update"}: ${u.title}`, dayOnly: !u.publish_at })),
  ].sort((a, b) => String(b.at).localeCompare(String(a.at)));

  const groups = [];
  for (const e of past) {
    const d = istDate(new Date(e.at));
    if (!groups.length || groups.at(-1)[0] !== d) groups.push([d, []]);
    groups.at(-1)[1].push(e);
  }
  const TONE = { update: "info", plan: "info", you: "warn", skip: "info" };
  return (
    <div>
      <H2>Coming up</H2>
      <ul className="mb-4">
        {ahead.map((a, i) => (
          <li key={i} className="flex gap-3 py-1 text-sm">
            <span className="whitespace-nowrap" style={{ color: C.mute, minWidth: 92, fontVariantNumeric: "tabular-nums" }}>{fmtDate(a.day)}</span>
            <span><Chip tone={TONE[a.kind]}>{a.kind === "you" ? "You" : a.kind === "update" ? "Update" : a.kind === "skip" ? "Skipped" : "Planned"}</Chip> {a.what}</span>
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
