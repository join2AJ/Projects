/*
 * Shared vs private: every item in a project with a tag saying whether the client can see it, filterable,
 * so you get the complete picture in one place. Each row links to the tab where it can be changed.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase.js";
import { useRows } from "../lib/useRows.js";
import { fmtDate } from "../lib/money.js";
import { C, Chip, P, Card } from "./ui.jsx";

const sel = "px-2 py-1 rounded text-sm";
const fs = { border: `1px solid ${C.rule}`, background: "#fff" };
const d10 = (v) => (v ? String(v).slice(0, 10) : "");

export function SharedOverview({ project }) {
  const pid = project.id;
  const q = (t, cols) => supabase.from(t).select(cols).eq("project_id", pid);
  const sources = {
    upd: useRows(() => q("updates", "id,title,kind,happened_on,client_visible"), [pid]),
    iss: useRows(() => q("issues", "id,title,raised_on,client_visible"), [pid]),
    dec: useRows(() => q("decisions", "id,question,meeting_on,client_visible"), [pid]),
    fil: useRows(() => q("files", "id,name,created_at,client_visible"), [pid]),
    mtg: useRows(() => q("meeting_items", "id,body,kind,created_at,client_visible,meetings(title,client_visible)"), [pid]),
    str: useRows(() => q("strategies", "id,title,channel,start_on,created_at,client_visible"), [pid]),
    exp: useRows(() => q("expenses", "id,description,spent_on,client_visible"), [pid]),
    fee: useRows(() => q("project_services", "id,name,created_at,client_visible"), [pid]),
    inv: useRows(() => q("invoices", "id,number,issued_on,status"), [pid]),
    met: useRows(() => q("metrics", "metric,period,client_visible"), [pid]),
  };
  const [tag, setTag] = useState("");
  const [section, setSection] = useState("");
  const [text, setText] = useState("");
  if (Object.values(sources).some((s) => !s.rows)) return <P>Loading…</P>;
  const s = Object.fromEntries(Object.entries(sources).map(([k, v]) => [k, v.rows]));
  const money = project.money_open !== false;
  const metricNames = [...new Set(s.met.map((m) => m.metric))];
  const items = [
    ...s.upd.map((r) => ["Updates", "updates", r.title, r.happened_on, r.kind !== "note" && r.client_visible, r.kind === "note" ? "Private note" : null]),
    ...s.iss.map((r) => ["Issues", "issues", r.title, r.raised_on, r.client_visible]),
    ...s.dec.map((r) => ["Decisions", "decisions", r.question, r.meeting_on, r.client_visible, r.client_visible ? null : "Draft, not sent"]),
    ...s.fil.map((r) => ["Files", "files", r.name, d10(r.created_at), r.client_visible]),
    ...s.mtg.map((r) => ["Meeting points", "meetings", r.body, d10(r.created_at), r.client_visible && r.meetings?.client_visible,
      r.client_visible && !r.meetings?.client_visible ? "Point marked Share, but the meeting is not shared yet" : null]),
    ...s.str.map((r) => ["Promotion plan", "promotion", `${r.title} (${r.channel})`, r.start_on || d10(r.created_at), r.client_visible]),
    ...s.exp.map((r) => ["Expenses", "money", r.description, r.spent_on, money && r.client_visible]),
    ...s.fee.map((r) => ["Fees", "overview", r.name, d10(r.created_at), money && r.client_visible, !money && r.client_visible ? "Money tab is “Coming soon”" : null]),
    ...s.inv.map((r) => ["Invoices", "money", r.number, r.issued_on, money && r.status !== "draft", r.status === "draft" ? "Draft" : null]),
    ...metricNames.map((m) => { const rows = s.met.filter((x) => x.metric === m); const on = rows.filter((x) => x.client_visible).length;
      return ["Numbers", "numbers", `${m} (${rows.length} months)`, rows.at(-1)?.period, on > 0, on && on < rows.length ? `${on} of ${rows.length} shared` : null]; }),
  ].map(([sec, tab, title, day, shared, note]) => ({ sec, tab, title, day, shared: !!shared, note }));
  const sections = [...new Set(items.map((i) => i.sec))];
  const list = items.filter((i) => (!tag || String(i.shared) === tag) && (!section || i.sec === section) && (!text || i.title.toLowerCase().includes(text.toLowerCase())))
    .sort((a, b) => a.sec.localeCompare(b.sec) || String(b.day || "").localeCompare(String(a.day || "")));
  return (
    <div>
      <P>Everything in this project, tagged by whether {project.clients?.name || "the client"} can see it. Change a tag on the item’s own tab.</P>
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-4">
        {sections.map((sec) => {
          const all = items.filter((i) => i.sec === sec), on = all.filter((i) => i.shared).length;
          return (
            <button key={sec} onClick={() => setSection(section === sec ? "" : sec)} className="text-left" aria-pressed={section === sec}>
              <Card className={section === sec ? "ring-2" : ""}>
                <div className="text-xs uppercase tracking-wide" style={{ color: C.mute }}>{sec}</div>
                <div className="text-sm"><b style={{ color: C.good }}>{on} shared</b> · <span style={{ color: C.mute }}>{all.length - on} private</span></div>
              </Card>
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2 items-center mb-3" role="group" aria-label="Filter">
        <select aria-label="Tag" value={tag} onChange={(e) => setTag(e.target.value)} className={sel} style={fs}>
          <option value="">Shared and private</option><option value="true">Shared only</option><option value="false">Private only</option>
        </select>
        <select aria-label="Section" value={section} onChange={(e) => setSection(e.target.value)} className={sel} style={fs}>
          <option value="">All sections</option>{sections.map((x) => <option key={x}>{x}</option>)}
        </select>
        <input aria-label="Search" placeholder="Search…" value={text} onChange={(e) => setText(e.target.value)} className={sel} style={fs} />
        <span className="text-xs" style={{ color: C.mute }}>{list.length} items · {list.filter((i) => i.shared).length} shared · {list.filter((i) => !i.shared).length} private</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
          <thead><tr className="text-left text-xs" style={{ color: C.mute, borderBottom: `1px solid ${C.rule}` }}>
            <th className="py-1 pr-3 font-semibold">Tag</th><th className="py-1 pr-3 font-semibold">Section</th><th className="py-1 pr-3 font-semibold">Item</th><th className="py-1 pr-3 font-semibold">Date</th><th className="py-1 font-semibold"></th>
          </tr></thead>
          <tbody>{list.map((i, n) => (
            <tr key={n} style={{ borderBottom: `1px solid ${C.rule}`, verticalAlign: "top" }}>
              <td className="py-1.5 pr-3 whitespace-nowrap">{i.shared ? <Chip tone="good">Shared</Chip> : <Chip tone="info">Private</Chip>}</td>
              <td className="py-1.5 pr-3 whitespace-nowrap">{i.sec}</td>
              <td className="py-1.5 pr-3">{i.title}{i.note && <div className="text-xs" style={{ color: C.warn }}>{i.note}</div>}</td>
              <td className="py-1.5 pr-3 whitespace-nowrap text-xs" style={{ color: C.mute }}>{i.day ? fmtDate(String(i.day).slice(0, 10)) : ""}</td>
              <td className="py-1.5 whitespace-nowrap text-xs"><Link to={`?tab=${i.tab}`} className="underline" style={{ color: C.deep }}>Open</Link></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

/* Shared / Private / All pills for lists that carry a client_visible flag. */
export function TagFilter({ value, onChange }) {
  return (
    <span className="inline-flex gap-1 text-xs" role="group" aria-label="Show">
      {[["", "All"], ["shared", "Shared"], ["private", "Private"]].map(([k, l]) => (
        <button key={k} onClick={() => onChange(k)} aria-pressed={value === k} className="px-2 py-0.5 rounded-full"
          style={{ border: `1px solid ${value === k ? C.deep : C.rule}`, background: value === k ? C.deep : "#fff", color: value === k ? "#fff" : C.ink }}>{l}</button>
      ))}
    </span>
  );
}
export const tagMatch = (v, item) => !v || (v === "shared") === !!item.client_visible;
