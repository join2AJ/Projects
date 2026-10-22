/*
 * By service: every point in a project (updates, issues, decisions, meeting points, requests, sign-offs,
 * strategies, months) under the service or fee it belongs to. Each row has a dropdown to link or move it.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase.js";
import { useRows } from "../lib/useRows.js";
import { fmtDate } from "../lib/money.js";
import { C, Chip, P, Card } from "./ui.jsx";

const sel = "px-2 py-1 rounded text-sm";
const fs = { border: `1px solid ${C.rule}`, background: "#fff" };

// [table, section label, tab, columns, title, date]
const SOURCES = [
  ["updates", "Update", "updates", "id,title,happened_on,client_visible,service_id", (r) => r.title, (r) => r.happened_on],
  ["issues", "Issue", "issues", "id,title,raised_on,status,client_visible,service_id", (r) => r.title, (r) => r.raised_on],
  ["decisions", "Decision", "decisions", "id,question,meeting_on,client_visible,service_id", (r) => r.question, (r) => r.meeting_on],
  ["meeting_items", "Meeting point", "meetings", "id,body,kind,created_at,client_visible,service_id", (r) => r.body, (r) => r.created_at],
  ["requests", "Request", "requests", "id,details,created_at,service_id", (r) => r.details, (r) => r.created_at],
  ["deliverables", "Sign-off", "deliverables", "id,title,due_on,client_visible,service_id", (r) => r.title, (r) => r.due_on],
  ["strategies", "Strategy", "promotion", "id,title,start_on,client_visible,service_id", (r) => r.title, (r) => r.start_on],
  ["cycles", "Month", "cycles", "id,month,client_visible,service_id", (r) => `Monthly cycle ${fmtDate(r.month)}`, (r) => r.month],
];

/* The project's services, for dropdowns: [[id, name], …] */
export function useServices(projectId) {
  const r = useRows(() => !projectId ? Promise.resolve({ data: [] }) : supabase.from("project_services").select("id,name,kind,status").eq("project_id", projectId).order("created_at"), [projectId]);
  return r.rows;
}

/* A Service field for the generic Editor */
export const serviceField = (services) => ({ key: "service_id", label: "Service", type: "select", options: [["", "Not linked yet"], ...(services || []).map((s) => [s.id, s.name])] });

export function ByService({ projectId }) {
  const services = useServices(projectId);
  const all = SOURCES.map(([t, , , cols]) => useRows(() => supabase.from(t).select(cols).eq("project_id", projectId), [projectId])); // eslint-disable-line react-hooks/rules-of-hooks
  const [only, setOnly] = useState("");
  const [msg, setMsg] = useState(null);
  if (!services || all.some((x) => !x.rows)) return <P>Loading…</P>;
  const items = SOURCES.flatMap(([t, label, tab, , title, date], i) => all[i].rows.map((r) => ({ t, label, tab, r, title: title(r), date: date(r), reload: all[i].reload })));
  const move = async (it, sid) => {
    const { error } = await supabase.from(it.t).update({ service_id: sid || null }).eq("id", it.r.id);
    setMsg(error ? error.message : null); it.reload();
  };
  const groups = [...services.map((s) => [s.id, s.name, s.status]), ["", "Not linked yet", null]];
  const shown = only === "" ? groups : groups.filter(([id]) => id === only || (only === "none" && id === ""));
  return (
    <div>
      <P>Every point in this project under the service it belongs to. Use the dropdown to link a point or move it to another service.</P>
      <div className="flex flex-wrap gap-2 items-center mb-3 text-sm">
        <label htmlFor="svc-only" style={{ color: C.mute }}>Show</label>
        <select id="svc-only" value={only} onChange={(e) => setOnly(e.target.value)} className={sel} style={fs}>
          <option value="">All services</option>
          {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          <option value="none">Not linked yet</option>
        </select>
        {msg && <span style={{ color: C.bad }}>{msg}</span>}
      </div>
      {shown.map(([sid, name, status]) => {
        const list = items.filter((it) => (it.r.service_id || "") === sid).sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
        return (
          <Card key={sid || "none"} className="mb-4">
            <div className="flex flex-wrap items-baseline gap-2 mb-2">
              <span className="font-semibold" style={{ color: sid ? C.deep : C.warn }}>{name}</span>
              {status && <Chip tone="info">{status}</Chip>}
              <span className="text-xs" style={{ color: C.mute }}>{list.length} point{list.length === 1 ? "" : "s"}</span>
            </div>
            {!list.length ? <div className="text-sm" style={{ color: C.mute }}>Nothing here.</div> : (
              <ul>
                {list.map((it) => (
                  <li key={it.t + it.r.id} className="flex flex-wrap items-center gap-2 py-1.5 text-sm" style={{ borderTop: `1px solid ${C.rule}` }}>
                    <Chip tone="info">{it.label}</Chip>
                    <Link to={`?tab=${it.tab}&item=${it.r.id}`} className="flex-1 underline" style={{ minWidth: 0, color: C.ink }}>{String(it.title).length > 120 ? String(it.title).slice(0, 120) + "…" : it.title}</Link>
                    {it.date && <span className="text-xs" style={{ color: C.mute }}>{fmtDate(String(it.date).slice(0, 10))}</span>}
                    <select aria-label={`Service for ${it.label.toLowerCase()}`} value={it.r.service_id || ""} onChange={(e) => move(it, e.target.value)} className="px-1 py-0.5 rounded text-xs" style={fs}>
                      <option value="">Not linked yet</option>
                      {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        );
      })}
    </div>
  );
}
