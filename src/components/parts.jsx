/* Project building blocks shared by the client portal and the studio. */
import { useMemo, useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { supabase, BUCKET } from "../lib/supabase.js";
import { useRows } from "../lib/useRows.js";
import { balance, invoiceState, fmtDate, fmtDateTime, isOverdue, total } from "../lib/money.js";
import { LABEL, TONE } from "../lib/schema.js";
import { STAGES, TIMETABLE, WEEKLY } from "../data/studio.js";
import { KIND_LABEL, weeklyLabel, nextUpdate, loadChanges } from "../lib/weekly.js";
import { C, inr, Chip, H2, P, Box, T, Pills, Card, Audience } from "./ui.jsx";
import { REPORTS } from "../projects/reports.js";
import { FeesClient } from "./pricing.jsx";
import { DecisionHistory } from "./collab.jsx";

export const StageBar = ({ stage }) => {
  const at = STAGES.findIndex(([id]) => id === stage);
  return (
    <ol className="flex flex-wrap gap-2 mb-4 text-xs">
      {STAGES.map(([id, l], i) => (
        <li key={id} className="px-3 py-2 rounded" style={{
          background: i < at ? C.goodBg : i === at ? C.deep : C.card,
          color: i < at ? C.good : i === at ? "#fff" : C.mute, border: `1px solid ${i === at ? C.deep : C.rule}`, fontWeight: i === at ? 700 : 400,
        }}>{i + 1}. {l}</li>
      ))}
      {stage === "closed" && <li className="px-3 py-2 rounded" style={{ background: C.goodBg, color: C.good }}>Closed</li>}
    </ol>
  );
};

export const Tag = ({ v }) => <Chip tone={TONE[v] || "info"}>{LABEL[v] || v}</Chip>;

/* ───────── updates ───────── */
/* Web addresses in a text become links that open in a new tab (e.g. the Google help pages cited in an update) */
export function Linkify({ text }) {
  return String(text).split(/(https?:\/\/[^\s)]+)/g).map((part, i) =>
    /^https?:\/\//.test(part)
      ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: C.deep, wordBreak: "break-all" }}>{part}</a>
      : part);
}

/* mode: "all" (newest first), "latest" (done or in progress), "upcoming" (scheduled, soonest first) */
export function UpdatesList({ projectId, limit, mode = "all" }) {
  const { rows } = useRows(() => {
    let q = supabase.from("updates").select("*").eq("project_id", projectId).eq("client_visible", true);
    if (mode === "latest") q = q.neq("status", "Scheduled");
    if (mode === "upcoming") q = q.eq("status", "Scheduled");
    q = q.order("happened_on", { ascending: mode === "upcoming" }).order("created_at", { ascending: false });
    if (limit) q = q.limit(limit);
    return q;
  }, [projectId, limit, mode]);
  if (!rows) return <P>Loading…</P>;
  if (!rows.length) return <P style={{ color: C.mute }}>{mode === "upcoming" ? "Nothing scheduled." : "No updates yet."}</P>;
  return (
    <ul className="mb-4">
      {rows.map((u) => (
        <li key={u.id} id={`item-${u.id}`} className="pl-3 mb-3" style={{ borderLeft: `3px solid ${u.status === "Done" ? C.good : u.status === "Blocked" ? C.bad : C.info}` }}>
          <div className="flex flex-wrap gap-2 items-center text-xs" style={{ color: C.mute }}>
            <span>{fmtDate(u.happened_on)}</span><Chip tone={u.kind === "meeting" ? "good" : "info"}>{KIND_LABEL[u.kind] || u.kind}</Chip>
            <Chip tone={u.status === "Done" ? "good" : u.status === "Blocked" ? "bad" : "warn"}>{u.status}</Chip>
          </div>
          <div className="font-semibold text-sm">{u.title}</div>
          {u.body && <div className="text-sm" style={{ color: C.mute, whiteSpace: "pre-wrap" }}><Linkify text={u.body} /></div>}
        </li>
      ))}
    </ul>
  );
}

/* ───────── issues ───────── */
export function IssuesList({ projectId }) {
  const [f, setF] = useState("active");
  const { rows } = useRows(() => supabase.from("issues").select("*").eq("project_id", projectId).eq("client_visible", true).order("sort").order("created_at"), [projectId]);
  if (!rows) return <P>Loading…</P>;
  const active = (i) => !["resolved", "superseded"].includes(i.status);
  const list = rows.filter((i) => (f === "all" ? true : f === "active" ? active(i) : !active(i)));
  return (
    <div>
      <P>{rows.filter(active).length} open, {rows.length - rows.filter(active).length} resolved or superseded. “Waiting on you” items need something from your side.</P>
      <Pills label="Filter issues" value={f} onChange={setF} options={[["active", "Open"], ["closed", "Resolved"], ["all", "All"]]} />
      {list.map((i) => (
        <div key={i.id} className="mb-3 p-4" style={{ background: C.card, border: `1px solid ${C.rule}`, borderLeft: `4px solid ${C[TONE[i.severity]]}`, borderRadius: 3 }}>
          <div className="flex flex-wrap items-center gap-2 mb-1"><Tag v={i.severity} /><Tag v={i.status} /><span className="font-semibold text-sm">{i.title}</span></div>
          {i.evidence && <P style={{ color: C.mute, marginBottom: 6 }}><b style={{ color: C.ink }}>Evidence. </b>{i.evidence}</P>}
          {i.fix && <P style={{ marginBottom: 6 }}><b style={{ color: C.good }}>Fix. </b>{i.fix}</P>}
          {i.now_note && <P style={{ marginBottom: 0 }}><b style={{ color: C.deep }}>Now. </b>{i.now_note}</P>}
        </div>
      ))}
      {!list.length && <P style={{ color: C.mute }}>Nothing here.</P>}
    </div>
  );
}

/* ───────── money ───────── */
export function DueBanner({ projectId }) {
  const { rows } = useRows(() => supabase.from("invoices").select("*").eq("project_id", projectId).eq("status", "sent"), [projectId]);
  const due = (rows || []).filter((i) => balance(i) > 0);
  if (!due.length) return null;
  const sum = due.reduce((a, i) => a + balance(i), 0);
  const late = due.filter(isOverdue);
  return (
    <Box tone={late.length ? "bad" : "warn"} title={late.length ? `Payment overdue: ${inr(sum)}` : `Amount due: ${inr(sum)}`}>
      {due.map((i) => `${i.number} (${inr(balance(i))}, ${invoiceState(i)[0]})`).join(" · ")}. Details on the Money tab.
    </Box>
  );
}

export function MoneyClient({ projectId, project = null }) {
  const inv = useRows(() => supabase.from("invoices").select("*").eq("project_id", projectId).neq("status", "draft").order("issued_on", { ascending: false }), [projectId]);
  const exp = useRows(() => supabase.from("expenses").select("*").eq("project_id", projectId).eq("client_visible", true).order("spent_on", { ascending: false }), [projectId]);
  const rows = inv.rows || [];
  const billed = rows.filter((i) => i.status !== "void").reduce((a, i) => a + total(i), 0);
  const paid = rows.reduce((a, i) => a + (i.status === "paid" ? total(i) : Number(i.paid_amount || 0)), 0);
  return (
    <div>
      <FeesClient projectId={projectId} project={project} banner={<DueBanner projectId={projectId} />} />
      <H2>Invoices</H2>
      <T head={["Invoice", "For", "Issued", "Total", "Status"]} right={[3]} rows={rows.map((i) => {
        const [l, tone] = invoiceState(i);
        return [i.number, i.description || "", fmtDate(i.issued_on), inr(total(i)), <Chip key={i.id} tone={tone}>{l}</Chip>];
      })} />
      <P style={{ color: C.mute }}>Billed {inr(billed)} · paid {inr(paid)} · balance {inr(billed - paid)}.</P>
      {(exp.rows || []).length > 0 && (<>
        <H2>Expenses on your project</H2>
        <T head={["Date", "What", "Amount", "Paid by", "Billed to you"]} right={[2]} rows={exp.rows.map((e) => [fmtDate(e.spent_on), e.description, inr(e.amount), e.paid_by === "me" ? "Ajay" : "You", e.rebillable ? "Yes" : "No"])} />
      </>)}
    </div>
  );
}

/* ───────── metrics ───────── */
export function MetricsPanel({ projectId, from = null, before = null, empty = "No numbers recorded yet." }) {
  const all = useRows(() => supabase.from("metrics").select("metric,period,value,unit,source,updated_at").eq("project_id", projectId).eq("client_visible", true).order("period"), [projectId]);
  const rows = all.rows && all.rows.filter((r) => (!from || r.period >= from) && (!before || r.period < before));
  const names = useMemo(() => [...new Set((rows || []).map((r) => r.metric))], [rows]);
  const [pick, setPick] = useState(null);
  // Start on the main figure: ad impressions or clicks if there, else the biggest
  const lead = ["Search ad impressions", "Search ad clicks"].find((x) => names.includes(x))
    || [...names].sort((a, b) => Math.max(...rows.filter((r) => r.metric === b).map((r) => Number(r.value))) - Math.max(...rows.filter((r) => r.metric === a).map((r) => Number(r.value))))[0];
  const m = pick || lead;
  if (!rows) return <P>Loading…</P>;
  if (!names.length) return <P style={{ color: C.mute }}>{empty}</P>;
  const data = rows.filter((r) => r.metric === m).map((r) => ({ p: r.period.slice(0, 7), v: Number(r.value) }));
  const unit = rows.find((r) => r.metric === m)?.unit || "";
  const vals = data.map((d) => d.v);
  const last12 = vals.slice(-12), prev12 = vals.slice(-24, -12);
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const fmtV = (v) => (unit === "₹" ? inr(v) : Math.round(v).toLocaleString("en-IN") + (unit ? ` ${unit}` : ""));
  const stamp = rows.map((r) => r.updated_at).filter(Boolean).sort().at(-1);
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <span className="font-semibold text-sm" style={{ color: C.deep }}>Monthly totals <span className="font-normal text-xs" style={{ color: C.mute }}>(one point per month; day-by-day figures are in the campaign above)</span></span>
        {stamp && <span className="text-xs" style={{ color: C.mute }}>Updated as on <b style={{ color: C.ink }}>{fmtDateTime(stamp)} IST</b></span>}
      </div>
      <Pills label="Metric" value={m} onChange={setPick} options={names.map((n) => [n, n])} />
      <div style={{ width: "100%", height: 280 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={C.rule} vertical={false} />
            <XAxis dataKey="p" tick={{ fontSize: 10, fill: C.mute }} minTickGap={24} />
            <YAxis tick={{ fontSize: 11, fill: C.mute }} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
            <Tooltip formatter={(v) => [fmtV(v), m]} />
            <Line type="monotone" dataKey="v" stroke={C.deep} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <T head={["Measure", "Value"]} right={[1]} rows={[
        ["Latest", `${fmtV(vals.at(-1))} (${data.at(-1).p})`],
        ["Last 12 periods, total", fmtV(sum(last12))],
        ["Last 12 periods, average", fmtV(sum(last12) / last12.length)],
        ...(prev12.length === 12 ? [["Change against the 12 before", `${(((sum(last12) - sum(prev12)) / sum(prev12)) * 100).toFixed(0)}%`]] : []),
        ["Highest", fmtV(Math.max(...vals))],
      ]} />
    </div>
  );
}

/* ───────── files ───────── */
export function FilesPanel({ projectId, owner }) {
  const { rows, reload } = useRows(() => {
    const q = supabase.from("files").select("*").eq("project_id", projectId);
    return (owner ? q : q.eq("client_visible", true)).order("created_at", { ascending: false });
  }, [projectId, owner]);
  const [busy, setBusy] = useState(null);
  const [cat, setCat] = useState("other");
  const [vis, setVis] = useState(true);

  const upload = async (e) => {
    const list = [...e.target.files];
    e.target.value = "";
    for (const file of list) {
      setBusy(`Uploading ${file.name}…`);
      const path = `${projectId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
      const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined });
      if (up.error) { setBusy(`Upload failed: ${up.error.message}`); return; }
      const ins = await supabase.from("files").insert({ project_id: projectId, name: file.name, storage_path: path, size: file.size, mime: file.type, category: cat, client_visible: owner ? vis : true });
      if (ins.error) { await supabase.storage.from(BUCKET).remove([path]); setBusy(`Could not save ${file.name}: ${ins.error.message}`); return; }
    }
    setBusy(null);
    reload();
  };
  const open = async (f) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(f.storage_path, 300);
    if (error) return setBusy(error.message);
    window.open(data.signedUrl, "_blank", "noopener");
  };
  const remove = async (f) => {
    await supabase.storage.from(BUCKET).remove([f.storage_path]);
    await supabase.from("files").delete().eq("id", f.id);
    reload();
  };
  const toggle = async (f) => { await supabase.from("files").update({ client_visible: !f.client_visible }).eq("id", f.id); reload(); };

  return (
    <div>
      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <label htmlFor="file-cat" className="text-xs" style={{ color: C.mute }}>Type
            <select id="file-cat" value={cat} onChange={(e) => setCat(e.target.value)} className="block mt-1 px-2 py-1.5 rounded text-sm" style={{ border: `1px solid ${C.rule}` }}>
              {["report", "design", "contract", "invoice", "data", "asset", "other"].map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          {owner && <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={vis} onChange={(e) => setVis(e.target.checked)} /> Client can see</label>}
          <label htmlFor="file-input" className="px-3 py-1.5 rounded text-sm font-semibold cursor-pointer" style={{ background: C.deep, color: "#fff" }}>
            Upload files<input id="file-input" type="file" multiple className="hidden" onChange={upload} />
          </label>
        </div>
        <div className="text-xs mt-2" style={{ color: C.mute }}>Up to 50 MB each. {busy}</div>
      </Card>
      {!rows ? <P>Loading…</P> : !rows.length ? <P style={{ color: C.mute }}>No files yet.</P> : (
        <T head={["File", "Type", "Added", "By", ""]} rows={rows.map((f) => [
          <button key="n" className="underline text-left" style={{ color: C.deep }} onClick={() => open(f)}>{f.name}</button>,
          f.category, fmtDate(f.created_at.slice(0, 10)), f.uploaded_by || "",
          owner ? <span key="a" className="text-xs whitespace-nowrap">
            <button className="underline mr-2" onClick={() => toggle(f)}>{f.client_visible ? "Hide from client" : "Show to client"}</button>
            <button className="underline" style={{ color: C.bad }} onClick={() => remove(f)}>Delete</button>
          </span> : "",
        ])} />
      )}
    </div>
  );
}

/* ───────── requests (client side) ───────── */
export function RequestsClient({ projectId }) {
  const { rows, reload } = useRows(() => supabase.from("requests").select("*").eq("project_id", projectId).order("created_at", { ascending: false }), [projectId]);
  const [state, setState] = useState(null);
  const send = async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    const { error } = await supabase.from("requests").insert({ project_id: projectId, type: d.type, priority: d.priority, details: d.details, link: d.link || null });
    if (error) return setState(["bad", error.message]);
    e.target.reset();
    setState(["good", "Sent. Ajay is notified on his dashboard and replies here."]);
    reload();
  };
  const fs = { border: `1px solid ${C.rule}`, background: "#fff" };
  return (
    <div>
      <H2>Ask for something</H2>
      <form onSubmit={send} className="max-w-xl">
        <div className="grid md:grid-cols-2 gap-x-4">
          <label htmlFor="rq-type" className="block text-xs mb-3" style={{ color: C.mute }}>Kind
            <select id="rq-type" name="type" className="mt-1 w-full px-2 py-2 rounded text-sm" style={fs}>{["New work", "Change", "Something is broken", "Question"].map((o) => <option key={o}>{o}</option>)}</select>
          </label>
          <label htmlFor="rq-priority" className="block text-xs mb-3" style={{ color: C.mute }}>How urgent
            <select id="rq-priority" name="priority" defaultValue="This week" className="mt-1 w-full px-2 py-2 rounded text-sm" style={fs}>{["Urgent: today", "This week", "This month", "Whenever"].map((o) => <option key={o}>{o}</option>)}</select>
          </label>
        </div>
        <label htmlFor="rq-details" className="block text-xs mb-3" style={{ color: C.mute }}>What would you like?
          <textarea id="rq-details" name="details" required rows={4} maxLength={5000} className="mt-1 w-full px-2 py-2 rounded text-sm" style={fs} />
        </label>
        <label htmlFor="rq-link" className="block text-xs mb-3" style={{ color: C.mute }}>Link (optional)
          <input id="rq-link" name="link" type="url" className="mt-1 w-full px-2 py-2 rounded text-sm" style={fs} />
        </label>
        <button type="submit" className="px-4 py-2 rounded text-sm font-semibold mb-3" style={{ background: C.deep, color: "#fff" }}>Send request</button>
        {state && <div className="text-sm mb-3" style={{ color: C[state[0]] }}>{state[1]}</div>}
      </form>
      <H2>Your requests</H2>
      {!rows ? <P>Loading…</P> : !rows.length ? <P style={{ color: C.mute }}>None yet.</P> : (
        <T head={["Sent", "Request", "Status", "Reply"]} rows={rows.map((r) => [fmtDate(r.created_at.slice(0, 10)), `${r.type}: ${r.details}`, <Tag key="s" v={r.status} />, r.reply || "–"])} />
      )}
    </div>
  );
}

/* ───────── custom report ───────── */
export function ReportPanel({ reportKey, studio }) {
  const r = REPORTS[reportKey];
  const tabs = (r?.tabs || []).filter((t) => studio || !t[3]);
  const [tab, setTab] = useState(tabs[0]?.[0]);
  if (!r) return <P>Report not found.</P>;
  const Active = tabs.find((t) => t[0] === tab)[2];
  return (
    <Audience.Provider value={studio ? "studio" : "client"}>
      <Pills label="Report sections" options={tabs.map(([id, l, , s]) => [id, s ? `${l} (private)` : l])} value={tab} onChange={setTab} />
      <Active />
    </Audience.Provider>
  );
}

/* ───────── decisions (client side) ───────── */
export const ANSWER = { yes: ["Yes", "good"], no: ["No", "bad"], other: ["Other", "warn"] };

/* Decisions grouped by the weekly update they belong to, newest first. */
export const byMeeting = (rows) => {
  const groups = new Map();
  for (const d of rows) {
    const k = d.meeting_on || "";
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(d);
  }
  return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
};

function DecisionCard({ d, n, onSaved, readOnly = false }) {
  const [other, setOther] = useState(d.answer === "other");
  const [note, setNote] = useState(d.answer_note || "");
  const [msg, setMsg] = useState(null);
  const [hist, setHist] = useState(false);
  const decided = d.status === "closed";
  const closed = decided || readOnly;
  const send = async (choice) => {
    setMsg(null);
    const { error } = await supabase.rpc("answer_decision", { decision: d.id, choice, note: choice === "other" ? note : null });
    if (error) return setMsg(error.message);
    onSaved();
  };
  const btn = (k) => {
    const on = d.answer === k || (k === "other" && other && !d.answer);
    return (
      <button key={k} type="button" disabled={closed} aria-pressed={d.answer === k}
        onClick={() => (k === "other" ? setOther(true) : (setOther(false), send(k)))}
        className="px-4 py-1.5 rounded text-sm font-semibold"
        style={{ border: `1px solid ${on ? C[ANSWER[k][1]] : C.rule}`, background: on ? C[ANSWER[k][1] + "Bg"] : "#fff", color: on ? C[ANSWER[k][1]] : C.ink, opacity: closed && !on ? 0.5 : 1 }}>
        {ANSWER[k][0]}
      </button>
    );
  };
  return (
    <div id={`item-${d.id}`} className="p-4 mb-3" style={{ background: C.card, border: `1px solid ${C.rule}`, borderLeft: `4px solid ${decided ? C.good : d.answer ? C.info : C.warn}`, borderRadius: 3 }}>
      <div className="flex flex-wrap items-baseline gap-2 mb-1">
        <span className="text-xs" style={{ color: C.mute }}>{n}.</span>
        <span className="font-semibold text-sm flex-1" style={{ minWidth: 0 }}>{d.question}</span>
        {decided ? <Chip tone="good">Decided</Chip> : d.answer ? <Chip tone="info">Answered</Chip> : readOnly ? <Chip tone="info">Waiting for the approver</Chip> : <Chip tone="warn">{d.due_on ? `Answer by ${fmtDate(d.due_on)}` : "Needs your answer"}</Chip>}
      </div>
      {d.details && <P style={{ color: C.mute, marginBottom: 6 }}>{d.details}</P>}
      {d.recommendation && <P style={{ marginBottom: 8 }}><b style={{ color: C.deep }}>Ajay recommends: </b>{d.recommendation}</P>}
      <div className="flex flex-wrap gap-2 items-center">
        {["yes", "no", "other"].map(btn)}
        {d.answer && !closed && <button type="button" className="text-xs underline ml-1" style={{ color: C.mute }} onClick={() => { setOther(false); setNote(""); send(null); }}>Clear</button>}
        {d.answered_at && <span className="text-xs" style={{ color: C.mute }}>Answered {fmtDate(d.answered_at.slice(0, 10))}</span>}
      </div>
      {(other || d.answer === "other") && !closed && (
        <div className="mt-2">
          <label htmlFor={`note-${d.id}`} className="block text-xs mb-1" style={{ color: C.mute }}>What would you like instead?</label>
          <textarea id={`note-${d.id}`} rows={2} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} className="w-full px-2 py-1.5 rounded text-sm" style={{ border: `1px solid ${C.rule}`, background: "#fff" }} />
          <button type="button" onClick={() => send("other")} className="mt-1 px-3 py-1 rounded text-sm font-semibold" style={{ background: C.deep, color: "#fff" }}>Save answer</button>
        </div>
      )}
      {closed && d.answer === "other" && d.answer_note && <P style={{ marginTop: 8, marginBottom: 0 }}><b>{readOnly ? "Note: " : "Your note: "}</b>{d.answer_note}</P>}
      {closed && d.outcome && <P style={{ marginTop: 8, marginBottom: 0 }}><b style={{ color: C.good }}>Decision: </b>{d.outcome}</P>}
      {msg && <div className="text-sm mt-2" style={{ color: C.bad }}>{msg}</div>}
      <button type="button" className="text-xs underline mt-2" style={{ color: C.mute }} aria-expanded={hist} onClick={() => setHist(!hist)}>{hist ? "Hide history" : "History"}</button>
      {hist && <DecisionHistory id={d.id} />}
    </div>
  );
}

export function DecisionsClient({ projectId, readOnly = false }) {
  const { rows, reload } = useRows(() => supabase.from("decisions").select("*").eq("project_id", projectId).eq("client_visible", true)
    .order("meeting_on", { ascending: false, nullsFirst: false }).order("sort"), [projectId]);
  if (!rows) return <P>Loading…</P>;
  if (!rows.length) return <P style={{ color: C.mute }}>No decisions to make right now.</P>;
  return (
    <div>
      <P>{readOnly ? "The approver answers these; you can follow the answers here." : "Answer each item with Yes, No or Other. You can change an answer until it is marked decided."}</P>
      {byMeeting(rows).map(([day, list]) => {
        const done = list.filter((d) => d.answer || d.status === "closed").length;
        return (
          <div key={day} className="mb-6">
            <H2>{day ? `Update, ${fmtDate(day)}` : "Other decisions"}</H2>
            <div className="text-xs mb-3" style={{ color: C.mute }}>{done} of {list.length} answered</div>
            {list.map((d, i) => <DecisionCard key={d.id + (d.answered_at || "") + d.status} d={d} n={i + 1} onSaved={reload} readOnly={readOnly} />)}
          </div>
        );
      })}
    </div>
  );
}

export function DecisionsBanner({ projectId, onOpen }) {
  const { rows } = useRows(() => supabase.from("decisions").select("id").eq("project_id", projectId).eq("client_visible", true).eq("status", "open").is("answer", null), [projectId]);
  if (!rows?.length) return null;
  return (
    <Box tone="warn" title={`${rows.length} decision${rows.length > 1 ? "s" : ""} need your answer`}>
      <button className="underline" onClick={onOpen}>Open the decisions checklist</button>
    </Box>
  );
}

/* ───────── weekly timetable ───────── */
export function TimetableBox({ extra, projectId = null }) {
  const { rows } = useRows(loadChanges, []);
  const showExtra = extra?.at && new Date(extra.at) > new Date();
  const pub = useRows(() => supabase.from("updates").select("id").eq("project_id", projectId).eq("kind", "meeting").eq("client_visible", true).lte("publish_at", new Date().toISOString()).limit(1), [projectId]);
  const next = nextUpdate(rows || [], projectId);
  const when = <b>{next ? weeklyLabel(next.at) : weeklyLabel()}</b>;
  return (
    <Box tone="info" title={`Weekly update: ${WEEKLY.label}`}>
      {pub.rows && !pub.rows.length ? <>Weekly updates start {when}, then every Tuesday, on this page.</> : <>Next update: {when}, on this page.</>}
      {showExtra && <> Extra update: <b>{new Date(extra.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}</b>{extra.note ? `: ${extra.note.replace(/\.$/, "")}` : ""}.</>}
    </Box>
  );
}

export const TimetableTable = () => (
  <T head={["When", "Time (IST)", "What happens"]} rows={TIMETABLE.map(([d, t, w]) => [<b key={d}>{d}</b>, t || "–", w])} />
);
