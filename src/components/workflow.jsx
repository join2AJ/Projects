/*
 * Project workflow pieces: deliverables with client sign-off, monthly cycles for retainers, % complete,
 * the project health flag, and the client's Home page ("Needs you", "This week", "Results").
 */
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase.js";
import { useRows } from "../lib/useRows.js";
import { fmtDate, fmtDateTime, today } from "../lib/money.js";
import { weeklyLabel, nextUpdate, loadChanges } from "../lib/weekly.js";
import { C, Chip, H2, P, Card, T } from "./ui.jsx";
import { StageBar } from "./parts.jsx";
import { Timeline } from "./activity.jsx";

const input = "mt-1 w-full px-2 py-1.5 rounded text-sm";
const fs = { border: `1px solid ${C.rule}`, background: "#fff" };
const btn = { background: C.deep, color: "#fff" };
const outline = { border: `1px solid ${C.rule}`, background: "#fff" };

/* Opens and highlights ?item=… once the page has loaded it (used by "Needs you" links). */
export function useFocusItem() {
  const [params] = useSearchParams();
  const item = params.get("item");
  useEffect(() => {
    if (!item) return;
    let tries = 0;
    const t = setInterval(() => {
      const el = document.getElementById(`item-${item}`);
      if (el || ++tries > 30) {
        clearInterval(t);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.style.transition = "box-shadow .3s"; el.style.boxShadow = `0 0 0 3px ${C.warn}`;
          setTimeout(() => { el.style.boxShadow = "none"; }, 2500);
        }
      }
    }, 150);
    return () => clearInterval(t);
  }, [item, params]);
}

export const ProgressBar = ({ value }) => value == null ? null : (
  <span className="inline-flex items-center gap-2" style={{ minWidth: 140 }} aria-label={`${value}% complete`}>
    <span style={{ width: 90, height: 8, background: C.bg, borderRadius: 4, overflow: "hidden", display: "inline-block" }}>
      <span style={{ width: `${value}%`, height: "100%", background: value >= 100 ? C.good : C.deep, display: "block", borderRadius: 4 }} />
    </span>
    <span className="text-xs" style={{ fontVariantNumeric: "tabular-nums" }}>{value}%</span>
  </span>
);

/* ───────── health flag: green / amber / red from late work, overdue money and serious issues ───────── */
export function healthOf({ actions = [], invoices = [], issues = [], decisions = [] }) {
  const now = today();
  const lateP1 = actions.filter((a) => a.priority === 1 && a.due_on && a.due_on < now).length;
  const late = actions.filter((a) => a.due_on && a.due_on < now).length;
  const overdue = invoices.filter((i) => i.status === "sent" && i.due_on && i.due_on < now).length;
  const critical = issues.filter((i) => i.severity === "critical").length;
  const high = issues.filter((i) => i.severity === "high").length;
  const lateDecisions = decisions.filter((d) => d.due_on && d.due_on < now && !d.answer).length;
  const why = [lateP1 && `${lateP1} late P1 action${lateP1 > 1 ? "s" : ""}`, overdue && `${overdue} overdue invoice${overdue > 1 ? "s" : ""}`, critical && `${critical} critical issue${critical > 1 ? "s" : ""}`,
    late - lateP1 > 0 && `${late - lateP1} other late action${late - lateP1 > 1 ? "s" : ""}`, high && `${high} high issue${high > 1 ? "s" : ""}`, lateDecisions && `${lateDecisions} late answer${lateDecisions > 1 ? "s" : ""}`].filter(Boolean);
  const level = lateP1 || overdue || critical ? "red" : late || high || lateDecisions ? "amber" : "green";
  return { level, why };
}
/* Health for every project the signed-in person can see, keyed by project id (one query per table). */
export function useAllHealth(projectId = null) {
  const q = (t, cols) => { let x = supabase.from(t).select(cols); return projectId ? x.eq("project_id", projectId) : x; };
  const a = useRows(() => q("meeting_items", "project_id,priority,due_on").eq("kind", "action").in("status", ["open", "in_progress"]), [projectId]);
  const i = useRows(() => q("invoices", "project_id,status,due_on").eq("status", "sent"), [projectId]);
  const s = useRows(() => q("issues", "project_id,severity").in("status", ["open", "in_progress", "waiting_client", "blocked"]), [projectId]);
  const d = useRows(() => q("decisions", "project_id,due_on,answer").eq("status", "open").eq("client_visible", true), [projectId]);
  if (![a, s, d].every((x) => x.rows)) return null;
  const by = (rows, pid) => (rows || []).filter((r) => r.project_id === pid);
  const ids = new Set([a, i, s, d].flatMap((x) => (x.rows || []).map((r) => r.project_id)));
  if (projectId) ids.add(projectId);
  return Object.fromEntries([...ids].map((pid) => [pid, healthOf({ actions: by(a.rows, pid), invoices: by(i.rows, pid), issues: by(s.rows, pid), decisions: by(d.rows, pid) })]));
}
export const useHealth = (projectId) => useAllHealth(projectId)?.[projectId] || null;
const HEALTH = { green: ["On track", "good"], amber: ["At risk", "warn"], red: ["Needs attention", "bad"] };
export const HealthChip = ({ h }) => <span title={h.why.join(" · ") || "Nothing late"}><Chip tone={HEALTH[h.level][1]}>● {HEALTH[h.level][0]}</Chip></span>;

/* ───────── deliverables with client sign-off ───────── */
const DSTATUS = { draft: ["Draft (private)", "info"], awaiting: ["Waiting for sign-off", "warn"], approved: ["Approved", "good"], changes: ["Changes asked", "bad"] };

function DeliverableForm({ projectId, item, onDone }) {
  const [f, setF] = useState(item || { title: "", details: "", link: "", due_on: "" });
  const [msg, setMsg] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault();
    const body = { project_id: projectId, title: f.title, details: f.details || null, link: f.link || null, due_on: f.due_on || null, updated_at: new Date().toISOString() };
    const { error } = item ? await supabase.from("deliverables").update(body).eq("id", item.id) : await supabase.from("deliverables").insert(body);
    if (error) return setMsg(error.message);
    onDone();
  };
  return (
    <form onSubmit={save} className="grid gap-x-3 md:grid-cols-4 p-3 my-2" style={{ background: C.bg, borderRadius: 4 }}>
      <label className="block text-xs mb-2 md:col-span-2" style={{ color: C.mute }}>What needs sign-off<input name="title" required value={f.title} onChange={set("title")} placeholder="e.g. Website home page design" className={input} style={fs} /></label>
      <label className="block text-xs mb-2" style={{ color: C.mute }}>Link (preview, file)<input name="link" type="url" value={f.link || ""} onChange={set("link")} className={input} style={fs} /></label>
      <label className="block text-xs mb-2" style={{ color: C.mute }}>Sign-off by<input name="due_on" type="date" value={f.due_on || ""} onChange={set("due_on")} className={input} style={fs} /></label>
      <label className="block text-xs mb-2 md:col-span-4" style={{ color: C.mute }}>What to check<textarea name="details" rows={2} value={f.details || ""} onChange={set("details")} className={input} style={fs} /></label>
      <div className="flex gap-2 items-center md:col-span-4">
        <button type="submit" className="px-3 py-1 rounded text-sm font-semibold" style={btn}>Save</button>
        <button type="button" className="text-xs underline" onClick={onDone}>Cancel</button>
        {msg && <span className="text-xs" style={{ color: C.bad }}>{msg}</span>}
      </div>
    </form>
  );
}

function Deliverable({ d, admin, role, onChange }) {
  const [edit, setEdit] = useState(false);
  const [note, setNote] = useState("");
  const [asking, setAsking] = useState(false);
  const [msg, setMsg] = useState(null);
  const set = async (patch) => { const { error } = await supabase.from("deliverables").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", d.id); if (error) setMsg(error.message); onChange(); };
  const decide = async (choice) => {
    const { error } = await supabase.rpc("sign_off", { deliverable: d.id, choice, note: note || null });
    if (error) return setMsg(error.message);
    setAsking(false); setNote(""); onChange();
  };
  if (edit) return <DeliverableForm projectId={d.project_id} item={d} onDone={() => { setEdit(false); onChange(); }} />;
  const canSign = !admin && role === "approver" && ["awaiting", "changes"].includes(d.status);
  return (
    <Card className="mb-3"><div id={`item-${d.id}`}>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-semibold flex-1" style={{ minWidth: 0 }}>{d.title}</span>
        <Chip tone={DSTATUS[d.status][1]}>{admin || d.status !== "awaiting" ? DSTATUS[d.status][0] : "Needs your sign-off"}</Chip>
      </div>
      {d.details && <div className="text-sm mt-1" style={{ whiteSpace: "pre-wrap" }}>{d.details}</div>}
      <div className="text-xs mt-1" style={{ color: C.mute }}>
        {d.link && <a href={d.link} target="_blank" rel="noreferrer" className="underline mr-2" style={{ color: C.deep }}>Open to check</a>}
        {d.due_on && `Sign-off by ${fmtDate(d.due_on)}`}
        {d.decided_at && ` · ${d.status === "approved" ? "Approved" : "Changes asked"} ${fmtDateTime(d.decided_at, { dateStyle: "medium", timeStyle: "short" })}`}
      </div>
      {d.client_note && <div className="text-sm mt-1"><b>{admin ? "Client’s note: " : "Your note: "}</b>{d.client_note}</div>}
      {canSign && (
        <div className="mt-2">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => decide("approved")} className="px-4 py-1.5 rounded text-sm font-semibold" style={{ border: `1px solid ${C.good}`, background: C.goodBg, color: C.good }}>Approve</button>
            <button onClick={() => setAsking(!asking)} className="px-4 py-1.5 rounded text-sm font-semibold" style={outline}>Ask for changes</button>
          </div>
          {asking && (
            <div className="mt-2">
              <label className="block text-xs" style={{ color: C.mute }}>What should change?<textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={input} style={fs} /></label>
              <button onClick={() => decide("changes")} className="mt-1 px-3 py-1 rounded text-sm font-semibold" style={btn}>Send</button>
            </div>
          )}
        </div>
      )}
      {!admin && role !== "approver" && d.status === "awaiting" && <div className="text-xs mt-1" style={{ color: C.mute }}>Waiting for the approver’s sign-off.</div>}
      {admin && (
        <div className="flex flex-wrap gap-3 text-xs mt-2">
          {d.status !== "awaiting" && d.status !== "approved" && <button className="px-2 py-0.5 rounded font-semibold" style={btn} onClick={() => set({ status: "awaiting", client_visible: true })}>{d.status === "changes" ? "Send again for sign-off" : "Send for sign-off"}</button>}
          {d.status === "awaiting" && <button className="underline" style={{ color: C.mute }} onClick={() => set({ status: "draft", client_visible: false })}>Withdraw</button>}
          <button className="underline" style={{ color: C.deep }} onClick={() => setEdit(true)}>Edit</button>
        </div>
      )}
      {msg && <div className="text-xs mt-1" style={{ color: C.bad }}>{msg}</div>}
    </div></Card>
  );
}

export function Deliverables({ projectId, admin = false, role = null }) {
  const { rows, reload } = useRows(() => supabase.from("deliverables").select("*").eq("project_id", projectId).order("sort").order("created_at"), [projectId]);
  const [adding, setAdding] = useState(false);
  useFocusItem();
  if (!rows) return <P>Loading…</P>;
  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
        <P style={{ marginBottom: 0 }}>{admin ? "Things the client must approve: designs, ad text, pages. Each sign-off is recorded with date and time, which protects both of you on scope." : "Work waiting for your approval. Approve it, or say what should change; every answer is recorded."}</P>
        {admin && <button onClick={() => setAdding(true)} className="px-3 py-1 rounded text-sm font-semibold" style={btn}>Add deliverable</button>}
      </div>
      {adding && <DeliverableForm projectId={projectId} onDone={() => { setAdding(false); reload(); }} />}
      {!rows.length ? <P style={{ color: C.mute }}>{admin ? "No deliverables yet." : "Nothing waiting for you."}</P> : rows.map((d) => <Deliverable key={d.id} d={d} admin={admin} role={role} onChange={reload} />)}
    </div>
  );
}

/* ───────── monthly cycles (retainers) ───────── */
const CSTATUS = { planning: ["Planning", "info"], in_progress: ["In progress", "info"], report_sent: ["Report sent", "warn"], approved: ["Approved", "good"], delayed: ["Delayed", "bad"] };
const monthName = (m) => new Date(`${m}T12:00:00+05:30`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
const nextMonth = () => { const d = new Date(); d.setMonth(d.getMonth() + 1, 1); return d.toISOString().slice(0, 8) + "01"; };

function Cycle({ c, admin, role, onChange }) {
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState(c);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const save = async (e) => {
    e.preventDefault();
    const body = { plan: f.plan || null, target: f.target || null, plan_agreed_on: f.plan_agreed_on || null, work_done: !!f.work_done, report_link: f.report_link || null,
      report_sent_on: f.report_sent_on || null, result: f.result || null, retro: f.retro || null, status: f.status, client_visible: !!f.client_visible, updated_at: new Date().toISOString() };
    const { error } = await supabase.from("cycles").update(body).eq("id", c.id);
    if (error) return setMsg(error.message);
    setEdit(false); onChange();
  };
  const approve = async () => { const { error } = await supabase.rpc("approve_cycle", { cycle: c.id, note: note || null }); if (error) return setMsg(error.message); onChange(); };
  const steps = [["Plan agreed", !!c.plan_agreed_on], ["Work done", c.work_done], ["Report sent", !!c.report_sent_on || ["report_sent", "approved"].includes(c.status)], ["Approved", c.status === "approved"]];
  return (
    <Card className="mb-3"><div id={`item-${c.id}`}>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-semibold flex-1" style={{ color: C.deep }}>{monthName(c.month)}</span>
        {admin && (c.client_visible ? <Chip tone="good">Shared</Chip> : <Chip tone="info">Private</Chip>)}
        <Chip tone={CSTATUS[c.status][1]}>{!admin && c.status === "report_sent" ? "Report waiting for your approval" : CSTATUS[c.status][0]}</Chip>
      </div>
      <ol className="flex flex-wrap gap-2 my-2 text-xs">
        {steps.map(([l, ok]) => <li key={l} className="px-2 py-1 rounded" style={{ background: ok ? C.goodBg : C.bg, color: ok ? C.good : C.mute }}>{ok ? "✓ " : ""}{l}</li>)}
      </ol>
      {!edit && (<>
        {c.target && <div className="text-sm"><b>Target: </b>{c.target}</div>}
        {c.plan && <div className="text-sm" style={{ whiteSpace: "pre-wrap" }}><b>Plan: </b>{c.plan}</div>}
        {c.result && <div className="text-sm mt-1" style={{ whiteSpace: "pre-wrap" }}><b>Result: </b>{c.result}</div>}
        {c.report_link && <a href={c.report_link} target="_blank" rel="noreferrer" className="text-sm underline" style={{ color: C.deep }}>Open the monthly report</a>}
        {admin && c.retro && <div className="text-sm mt-1" style={{ color: C.mute, whiteSpace: "pre-wrap" }}><b>What to improve (private): </b>{c.retro}</div>}
        {c.client_note && <div className="text-sm mt-1"><b>{admin ? "Client’s note: " : "Your note: "}</b>{c.client_note}</div>}
        {!admin && role === "approver" && c.status === "report_sent" && (
          <div className="mt-2 flex flex-wrap gap-2 items-end">
            <label className="block text-xs flex-1" style={{ color: C.mute, minWidth: 200 }}>Note (optional)<input value={note} onChange={(e) => setNote(e.target.value)} className={input} style={fs} /></label>
            <button onClick={approve} className="px-4 py-1.5 rounded text-sm font-semibold" style={{ border: `1px solid ${C.good}`, background: C.goodBg, color: C.good }}>Approve this month</button>
          </div>
        )}
        {admin && <button className="underline text-xs mt-2" style={{ color: C.deep }} onClick={() => setEdit(true)}>Edit</button>}
      </>)}
      {edit && (
        <form onSubmit={save} className="grid gap-x-3 md:grid-cols-4 mt-2">
          <label className="block text-xs mb-2 md:col-span-2" style={{ color: C.mute }}>Target for the month<input value={f.target || ""} onChange={set("target")} placeholder="e.g. 20 calls from ads" className={input} style={fs} /></label>
          <label className="block text-xs mb-2" style={{ color: C.mute }}>Plan agreed on<input type="date" value={f.plan_agreed_on || ""} onChange={set("plan_agreed_on")} className={input} style={fs} /></label>
          <label className="block text-xs mb-2" style={{ color: C.mute }}>Status
            <select value={f.status} onChange={set("status")} className={input} style={fs}>{Object.entries(CSTATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select>
          </label>
          <label className="block text-xs mb-2 md:col-span-4" style={{ color: C.mute }}>Plan<textarea rows={3} value={f.plan || ""} onChange={set("plan")} className={input} style={fs} /></label>
          <label className="block text-xs mb-2 md:col-span-2" style={{ color: C.mute }}>Monthly report link<input type="url" value={f.report_link || ""} onChange={set("report_link")} className={input} style={fs} /></label>
          <label className="block text-xs mb-2" style={{ color: C.mute }}>Report sent on<input type="date" value={f.report_sent_on || ""} onChange={set("report_sent_on")} className={input} style={fs} /></label>
          <label className="flex items-center gap-2 text-sm md:col-span-1 pt-4"><input type="checkbox" checked={!!f.work_done} onChange={set("work_done")} /> Work done</label>
          <label className="block text-xs mb-2 md:col-span-2" style={{ color: C.mute }}>Result (client sees)<textarea rows={2} value={f.result || ""} onChange={set("result")} className={input} style={fs} /></label>
          <label className="block text-xs mb-2 md:col-span-2" style={{ color: C.mute }}>What to improve next month (private)<textarea rows={2} value={f.retro || ""} onChange={set("retro")} className={input} style={fs} /></label>
          <label className="flex items-center gap-2 text-sm md:col-span-4 mb-2"><input type="checkbox" checked={!!f.client_visible} onChange={set("client_visible")} /> Share with client (set status “Report sent” to ask for approval)</label>
          <div className="flex gap-2 md:col-span-4">
            <button type="submit" className="px-3 py-1 rounded text-sm font-semibold" style={btn}>Save</button>
            <button type="button" className="text-xs underline" onClick={() => { setF(c); setEdit(false); }}>Cancel</button>
          </div>
        </form>
      )}
      {msg && <div className="text-xs mt-1" style={{ color: C.bad }}>{msg}</div>}
    </div></Card>
  );
}

export function Cycles({ projectId, admin = false, role = null }) {
  const { rows, reload } = useRows(() => supabase.from("cycles").select("*").eq("project_id", projectId).order("month", { ascending: false }), [projectId]);
  const [msg, setMsg] = useState(null);
  useFocusItem();
  const add = async () => {
    const month = rows?.length ? (() => { const d = new Date(`${rows[0].month}T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 1, 1); return d.toISOString().slice(0, 10); })() : nextMonth();
    const { error } = await supabase.from("cycles").insert({ project_id: projectId, month });
    setMsg(error ? error.message : null); reload();
  };
  if (!rows) return <P>Loading…</P>;
  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
        <P style={{ marginBottom: 0 }}>{admin ? "One row per month for the monthly services: plan agreed by the 1st, work through the month, report by the last Tuesday, client approval within 3 days, then what to improve." : "Each month: the plan, what was done, the result and the report. Approve the month when you have read the report."}</P>
        {admin && <button onClick={add} className="px-3 py-1 rounded text-sm font-semibold" style={btn}>Add month</button>}
      </div>
      {msg && <P style={{ color: C.bad }}>{msg}</P>}
      {!rows.length ? <P style={{ color: C.mute }}>{admin ? "No months yet." : "Monthly reports will appear here."}</P> : rows.map((c) => <Cycle key={c.id + c.updated_at} c={c} admin={admin} role={role} onChange={reload} />)}
    </div>
  );
}

/* ───────── client's Home: what needs them, this week, results ───────── */
export function useNeedsYou(p, role) {
  const pid = p.id;
  const dec = useRows(() => supabase.from("decisions").select("id,question,due_on").eq("project_id", pid).eq("client_visible", true).eq("status", "open").is("answer", null), [pid]);
  const req = useRows(() => supabase.from("requests").select("id,details,status,reply,created_at,request_messages(author_role,created_at)").eq("project_id", pid).not("status", "in", "(done,declined)"), [pid]);
  const act = useRows(() => supabase.from("meeting_items").select("id,body,due_on,owner,status,meetings!inner(client_visible)").eq("project_id", pid).eq("kind", "action").eq("client_visible", true).eq("meetings.client_visible", true).in("owner", ["client", "both"]).in("status", ["open", "in_progress"]), [pid]);
  const del = useRows(() => supabase.from("deliverables").select("id,title,due_on").eq("project_id", pid).eq("client_visible", true).eq("status", "awaiting"), [pid]);
  const cyc = useRows(() => supabase.from("cycles").select("id,month").eq("project_id", pid).eq("client_visible", true).eq("status", "report_sent"), [pid]);
  const loading = [dec, req, act, del, cyc].some((x) => !x.rows);
  const approver = role === "approver";
  const doer = ["approver", "contributor"].includes(role);
  const replies = (req.rows || []).filter((r) => {
    const msgs = [...(r.request_messages || [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
    return msgs.length ? msgs.at(-1).author_role === "admin" : !!r.reply;
  });
  const items = loading ? [] : [
    ...(approver ? dec.rows.map((d) => ({ tab: "decisions", id: d.id, kind: "Answer", text: d.question, due: d.due_on })) : []),
    ...(approver ? del.rows.map((d) => ({ tab: "approvals", id: d.id, kind: "Sign off", text: d.title, due: d.due_on })) : []),
    ...(approver ? cyc.rows.map((c) => ({ tab: "monthly", id: c.id, kind: "Approve report", text: monthName(c.month) })) : []),
    ...replies.map((r) => ({ tab: "requests", id: r.id, kind: "Ajay replied", text: r.details })),
    ...(doer ? act.rows.map((a) => ({ tab: "meetings", id: a.id, kind: "Your action", text: a.body, due: a.due_on, action: true })) : []),
  ].sort((a, b) => String(a.due || "9").localeCompare(String(b.due || "9")));
  const counts = { decisions: approver ? dec.rows?.length || 0 : 0, approvals: approver ? del.rows?.length || 0 : 0, monthly: approver ? cyc.rows?.length || 0 : 0, requests: replies.length, meetings: doer ? act.rows?.length || 0 : 0 };
  return { loading, items, counts, reload: () => [dec, req, act, del, cyc].forEach((x) => x.reload()) };
}

export function ClientHome({ p, role, needs, go, since, name }) {
  const svc = useRows(() => supabase.from("project_services").select("id,name,kind,status,progress").eq("project_id", p.id).eq("client_visible", true).order("created_at"), [p.id]);
  const weekly = useRows(() => supabase.from("updates").select("id,title,body,happened_on").eq("project_id", p.id).eq("client_visible", true).eq("kind", "meeting").lte("happened_on", today()).order("happened_on", { ascending: false }).limit(1), [p.id]);
  const latest = useRows(() => supabase.from("updates").select("id,title,happened_on").eq("project_id", p.id).eq("client_visible", true).neq("kind", "note").lte("happened_on", today()).order("happened_on", { ascending: false }).limit(3), [p.id]);
  const mets = useRows(() => supabase.from("metrics").select("metric,period,value,unit").eq("project_id", p.id).eq("client_visible", true).gte("period", since).order("period"), [p.id, since]);
  const chg = useRows(loadChanges, []);
  const [busy, setBusy] = useState(null);
  const done = async (id) => { setBusy(id); await supabase.rpc("client_item_done", { item: id, done: true }); setBusy(null); needs.reload(); };
  const n = needs.items.length;
  const next = chg.rows ? nextUpdate(chg.rows, p.id) : null;
  // Results: the latest value of up to three figures, with the change on the period before
  const byMetric = new Map(); (mets.rows || []).forEach((m) => byMetric.set(m.metric, [...(byMetric.get(m.metric) || []), m]));
  const results = [...byMetric].slice(0, 3).map(([m, list]) => { const a = list.at(-1), b = list.at(-2); return { m, v: Number(a.value), unit: a.unit, d: b ? Number(a.value) - Number(b.value) : null, p: a.period }; });
  const fmtV = (r) => (r.unit === "₹" ? `₹${Math.round(r.v).toLocaleString("en-IN")}` : Math.round(r.v).toLocaleString("en-IN"));
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl" style={{ color: C.deep, fontWeight: 600 }}>{name ? `Hello ${name.replace(/^Dr\.?\s*/i, "Dr ")}` : p.name}</h1>
        <span className="text-xs" style={{ color: C.mute }}>{p.name} · project {p.code}</span>
      </div>
      <div className="grid gap-4 md:grid-cols-3 mt-3">
        <Card className="md:col-span-2">
          <div className="flex items-baseline justify-between gap-2 mb-2">
            <span className="font-semibold" style={{ color: n ? C.warn : C.good }}>{needs.loading ? "Checking…" : n ? `${n} thing${n > 1 ? "s" : ""} need${n > 1 ? "" : "s"} you` : "Nothing needs you right now"}</span>
            {role === "viewer" && <span className="text-xs" style={{ color: C.mute }}>You can view; the approver answers.</span>}
          </div>
          <ul>
            {needs.items.map((i) => (
              <li key={i.tab + i.id} className="flex flex-wrap items-center gap-2 py-2" style={{ borderTop: `1px solid ${C.rule}` }}>
                <Chip tone={i.action ? "info" : "warn"}>{i.kind}</Chip>
                <button className="flex-1 text-left text-sm underline" style={{ minWidth: 0, color: C.ink }} onClick={() => go(i.tab, i.id)}>{i.text.length > 110 ? i.text.slice(0, 110) + "…" : i.text}</button>
                {i.due && <span className="text-xs" style={{ color: i.due < today() ? C.bad : C.mute }}>by {fmtDate(i.due)}</span>}
                {i.action && <button disabled={busy === i.id} onClick={() => done(i.id)} className="px-2 py-0.5 rounded text-xs font-semibold" style={{ border: `1px solid ${C.good}`, color: C.good, background: C.goodBg }}>Mark done</button>}
                <button onClick={() => go(i.tab, i.id)} className="px-2 py-0.5 rounded text-xs font-semibold" style={btn}>Open</button>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <div className="font-semibold mb-1" style={{ color: C.deep }}>This week</div>
          {weekly.rows?.[0] ? (
            <button className="text-left text-sm underline" onClick={() => go("updates", weekly.rows[0].id)}>{weekly.rows[0].title}</button>
          ) : (latest.rows || []).slice(0, 2).map((u) => <div key={u.id} className="text-sm">{fmtDate(u.happened_on)}: {u.title}</div>)}
          <div className="text-xs mt-2" style={{ color: C.mute }}>Next update: {next ? weeklyLabel(next.at) : "Tuesday 11:00 IST"}</div>
        </Card>
      </div>
      <Card className="mt-4">
        <div className="flex items-baseline justify-between gap-2 mb-2">
          <span className="font-semibold" style={{ color: C.deep }}>Results</span>
          <button className="text-xs underline" style={{ color: C.deep }} onClick={() => go("numbers")}>See all results</button>
        </div>
        {!results.length ? <div className="text-sm" style={{ color: C.mute }}>Results for the new campaign appear here after the first weekly review.</div> : (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
            {results.map((r) => (
              <div key={r.m}>
                <div className="text-xs" style={{ color: C.mute }}>{r.m}</div>
                <div className="text-xl font-semibold" style={{ color: C.deep, fontVariantNumeric: "tabular-nums" }}>{fmtV(r)}</div>
                {r.d != null && <div className="text-xs" style={{ color: r.d >= 0 ? C.good : C.bad }}>{r.d >= 0 ? "▲" : "▼"} {Math.abs(Math.round(r.d)).toLocaleString("en-IN")} on the month before</div>}
              </div>
            ))}
          </div>
        )}
      </Card>
      <H2>Where we are</H2>
      <StageBar stage={p.stage} />
      {(svc.rows || []).length > 0 && (<>
        <H2>Your services</H2>
        <T head={["Service", "Status", "Progress"]} rows={svc.rows.map((s) => [<b key="n">{s.name}</b>, s.status, s.kind === "one-time" ? <ProgressBar key="p" value={s.progress ?? null} /> : "Monthly"])} />
      </>)}
      <Timeline project={p} />
    </div>
  );
}
