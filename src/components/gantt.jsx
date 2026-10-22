/*
 * Timeline chart (Gantt): action points from meetings (from when they were agreed to their due date), running
 * promotion strategies (from their start date to today), and milestones (planned updates, decision deadlines).
 * Items without dates are counted below the chart, not invented. Clients see only what is shared with them.
 */
import { useState } from "react";
import { supabase } from "../lib/supabase.js";
import { useRows } from "../lib/useRows.js";
import { fmtDate, today } from "../lib/money.js";
import { PRIORITY } from "./meetings.jsx";
import { TagFilter, tagMatch } from "./shared.jsx";
import { C, Chip, P } from "./ui.jsx";

const DAY = 864e5;
const toD = (s) => new Date(`${String(s).slice(0, 10)}T12:00:00+05:30`);
const key = (d) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const TONE = { open: "warn", in_progress: "info", done: "good", dropped: "info", active: "good", planned: "warn", idea: "info", paused: "info", milestone: "info" };
const LABEL = { open: "Open", in_progress: "Working on it", done: "Done", dropped: "Dropped", active: "Running", planned: "Planned", idea: "Idea", paused: "Paused" };
const OWNER = { me: "Ajay", client: "Client", both: "Both" };
const sel = "px-2 py-1 rounded text-sm";
const fs = { border: `1px solid ${C.rule}`, background: "#fff" };

export function Gantt({ projectId, admin = false }) {
  const acts = useRows(() => supabase.from("meeting_items").select("id,body,kind,status,owner,due_on,priority,created_at,client_visible").eq("project_id", projectId).eq("kind", "action"), [projectId]);
  const strat = useRows(() => supabase.from("strategies").select("id,title,channel,status,start_on,priority,owner,client_visible").eq("project_id", projectId), [projectId]);
  const upd = useRows(() => supabase.from("updates").select("id,title,happened_on,status,client_visible").eq("project_id", projectId).eq("status", "Scheduled"), [projectId]);
  const dec = useRows(() => supabase.from("decisions").select("id,question,due_on,status,client_visible").eq("project_id", projectId).eq("status", "open"), [projectId]);
  const [open, setOpen] = useState(true);
  const [who, setWho] = useState("");
  const [show, setShow] = useState("");
  if (![acts, strat, upd, dec].every((x) => x.rows)) return <P>Loading…</P>;
  const now = toD(today());
  const keep = (r) => tagMatch(show, r) && (!who || r.owner === who);
  const rows = [
    ...acts.rows.filter((r) => r.due_on && keep(r) && (!open || ["open", "in_progress"].includes(r.status)))
      .map((r) => ({ group: "Action points", title: r.body, start: toD(r.created_at), end: toD(r.due_on), status: r.status, owner: r.owner, priority: r.priority, late: r.status === "open" && toD(r.due_on) < now })),
    ...strat.rows.filter((r) => r.start_on && keep(r) && (!open || ["active", "planned"].includes(r.status)))
      .map((r) => ({ group: "Promotion plan", title: `${r.title} (${r.channel})`, start: toD(r.start_on), end: r.status === "active" ? new Date(Math.max(now, toD(r.start_on))) : toD(r.start_on), status: r.status, owner: r.owner, priority: r.priority, ongoing: r.status === "active" })),
    ...upd.rows.filter((r) => tagMatch(show, r) && toD(r.happened_on) >= new Date(now - 7 * DAY)).map((r) => ({ group: "Milestones", title: r.title, start: toD(r.happened_on), end: toD(r.happened_on), status: "milestone", milestone: true })),
    ...dec.rows.filter((r) => r.due_on && tagMatch(show, r)).map((r) => ({ group: "Milestones", title: `Answer due: ${r.question}`, start: toD(r.due_on), end: toD(r.due_on), status: "milestone", milestone: true })),
  ].sort((a, b) => a.group.localeCompare(b.group) || a.start - b.start);
  const undated = acts.rows.filter((r) => !r.due_on && ["open", "in_progress"].includes(r.status)).length + strat.rows.filter((r) => !r.start_on && ["active", "planned"].includes(r.status)).length;

  // Window: a week before the earliest item (or today) to two weeks after the last, at most 4 months
  const lo = new Date(Math.min(now - 7 * DAY, ...rows.map((r) => +r.start)));
  const hi = new Date(Math.min(Math.max(+now + 14 * DAY, ...rows.map((r) => +r.end)) + 3 * DAY, +lo + 120 * DAY));
  const span = hi - lo;
  const pct = (d) => `${Math.max(0, Math.min(100, ((d - lo) / span) * 100))}%`;
  const weeks = [];
  for (let d = new Date(lo); d <= hi; d = new Date(+d + 7 * DAY)) weeks.push(d);
  let last = "";
  return (
    <div>
      <P>{admin ? "Action points, running strategies and milestones on one timeline. Items need a date to appear: due dates for action points, start dates for strategies." : "What is planned and when, on one timeline."}</P>
      <div className="flex flex-wrap gap-3 items-center mb-3" role="group" aria-label="Filter">
        <label className="text-sm flex items-center gap-1"><input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} /> Open items only</label>
        <select aria-label="Who" value={who} onChange={(e) => setWho(e.target.value)} className={sel} style={fs}>
          <option value="">Everyone</option><option value="me">{admin ? "Me" : "Ajay"}</option><option value="client">{admin ? "Client" : "You"}</option><option value="both">Both</option>
        </select>
        {admin && <TagFilter value={show} onChange={setShow} />}
      </div>
      {!rows.length ? <P style={{ color: C.mute }}>Nothing with dates to show yet.</P> : (
        <div className="overflow-x-auto">
          <div style={{ minWidth: 760 }}>
            <div className="flex text-xs" style={{ color: C.mute, borderBottom: `1px solid ${C.rule}` }}>
              <div style={{ width: 280, flexShrink: 0 }} />
              <div className="relative flex-1" style={{ height: 22 }}>
                {weeks.map((w) => <span key={+w} className="absolute" style={{ left: pct(w), whiteSpace: "nowrap" }}>{w.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}</span>)}
              </div>
            </div>
            {rows.map((r, i) => {
              const head = r.group !== last ? (last = r.group) : null;
              const tone = r.late ? "bad" : TONE[r.status];
              return (
                <div key={i}>
                  {head && <div className="text-xs font-semibold pt-3 pb-1" style={{ color: C.deep }}>{head}</div>}
                  <div className="flex items-center text-sm" style={{ borderBottom: `1px solid ${C.bg}`, minHeight: 30 }}>
                    <div className="pr-3" style={{ width: 280, flexShrink: 0, lineHeight: 1.3 }} title={r.title}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</div>
                      <div className="text-xs" style={{ color: C.mute }}>
                        {!r.milestone && <Chip tone={tone}>{r.late ? "Late" : LABEL[r.status]}</Chip>}{" "}
                        {r.priority && PRIORITY[r.priority][0]}{r.owner ? ` · ${OWNER[r.owner]}` : ""}{" · "}{r.milestone ? fmtDate(key(r.start)) : `${fmtDate(key(r.start))} → ${r.ongoing ? "ongoing" : fmtDate(key(r.end))}`}
                      </div>
                    </div>
                    <div className="relative flex-1" style={{ height: 30 }}>
                      {weeks.map((w) => <span key={+w} className="absolute" style={{ left: pct(w), top: 0, bottom: 0, borderLeft: `1px solid ${C.bg}` }} />)}
                      <span className="absolute" aria-hidden="true" style={{ left: pct(now), top: 0, bottom: 0, borderLeft: `2px solid ${C.bad}` }} />
                      {r.milestone
                        ? <span className="absolute" style={{ left: `calc(${pct(r.start)} - 6px)`, top: 9, width: 12, height: 12, background: C.info, transform: "rotate(45deg)", borderRadius: 2 }} />
                        : <span className="absolute" style={{ left: pct(r.start), width: `max(6px, calc(${pct(r.end)} - ${pct(r.start)}))`, top: 8, height: 14, borderRadius: 4,
                            background: C[tone], opacity: r.status === "done" ? 0.5 : 1, borderRight: r.ongoing ? `3px dashed ${C.card}` : "none" }} />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="text-xs mt-2" style={{ color: C.mute }}>Red line: today. Bars run from when a point was agreed to its due date; running strategies run to today. Diamonds are milestones.</div>
        </div>
      )}
      {admin && undated > 0 && <P style={{ color: C.mute, marginTop: 8 }}>{undated} open item{undated > 1 ? "s have" : " has"} no date yet: add a due date (Meetings) or start date (Promotion plan) to place {undated > 1 ? "them" : "it"} on the chart.</P>}
    </div>
  );
}
