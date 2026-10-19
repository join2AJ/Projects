/*
 * Working together, on the record: the update schedule, request conversations, decision history,
 * the work register, tool access and credentials (admin only), and the client's privacy rights (DPDP).
 * Nothing here deletes a record: messages, requests and decisions are kept, and every change is in the audit trail.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase.js";
import { useRows } from "../lib/useRows.js";
import { useAuth } from "../lib/auth.jsx";
import { fmtDate, fmtDateTime } from "../lib/money.js";
import { schedule, weeklyLabel } from "../lib/weekly.js";
import { PRIVACY, PRIVACY_VERSION, OFFBOARDING, WEEKLY } from "../data/studio.js";
import { REPORTS } from "../projects/reports.js";
import { C, Chip, H1, H2, P, Box, T, Card } from "./ui.jsx";

const input = "mt-1 w-full px-2 py-1.5 rounded text-sm";
const fs = { border: `1px solid ${C.rule}`, background: "#fff" };
const btn = (bg = C.deep) => ({ background: bg, color: "#fff" });
// datetime-local values are India time, whatever the browser’s own time zone
const toIstInput = (d) => new Date(d.getTime() + 330 * 6e4).toISOString().slice(0, 16);
const fromIstInput = (v) => new Date(`${v}:00+05:30`);

/* ───────── update schedule (admin) ───────── */
export function ScheduleEditor({ projectId, onChange }) {
  const { rows, reload } = useRows(() => supabase.from("schedule_changes").select("*").order("slot_at"), []);
  const [form, setForm] = useState(null); // { slot, action, at, reason, all }
  const [msg, setMsg] = useState(null);
  if (!rows) return null;
  const list = schedule(rows, projectId, 7).filter((s) => s.slot > new Date(Date.now() - 864e5)).slice(0, 6);
  const save = async () => {
    setMsg(null);
    const body = { project_id: form.all ? null : projectId, slot_at: form.slot.toISOString(), action: form.action,
      new_at: form.action === "move" ? fromIstInput(form.at).toISOString() : null, reason: form.reason || null };
    const { error } = await supabase.from("schedule_changes").insert(body);
    if (error) return setMsg(error.message.includes("schedule_changes_once") ? "This update already has a change. Restore it first." : error.message);
    setForm(null); reload(); onChange?.();
  };
  const restore = async (c) => { await supabase.from("schedule_changes").delete().eq("id", c.id); reload(); onChange?.(); };
  return (
    <Card className="mb-4">
      <div className="font-semibold text-sm mb-1" style={{ color: C.deep }}>Update schedule: {WEEKLY.label}</div>
      <div className="text-xs mb-2" style={{ color: C.mute }}>Skip or move any update. The client is never told about a skipped or moved date: they only see when the next update is. Every change is in your Activity log.</div>
      <ul className="text-sm">
        {list.map((s) => (
          <li key={s.slot.toISOString()} className="flex flex-wrap items-center gap-2 py-1" style={{ borderBottom: `1px solid ${C.rule}` }}>
            <span style={{ minWidth: 150, fontVariantNumeric: "tabular-nums" }}>{weeklyLabel(s.slot)}</span>
            {!s.change ? <Chip tone="good">On schedule</Chip>
              : s.change.action === "skip" ? <Chip tone="warn">Skipped</Chip>
              : <Chip tone="info">Moved to {weeklyLabel(new Date(s.change.new_at))}</Chip>}
            {s.change?.project_id === null && <span className="text-xs" style={{ color: C.mute }}>all clients</span>}
            {s.change?.reason && <span className="text-xs" style={{ color: C.mute }}>{s.change.reason}</span>}
            <span className="ml-auto text-xs whitespace-nowrap">
              {s.change ? <button className="underline" style={{ color: C.deep }} onClick={() => restore(s.change)}>Restore</button> : (<>
                <button className="underline mr-2" style={{ color: C.deep }} onClick={() => setForm({ slot: s.slot, action: "skip", reason: "", all: false })}>Skip</button>
                <button className="underline" style={{ color: C.deep }} onClick={() => setForm({ slot: s.slot, action: "move", at: toIstInput(s.slot), reason: "", all: false })}>Move</button>
              </>)}
            </span>
          </li>
        ))}
      </ul>
      {form && (
        <div className="mt-3 p-3" style={{ background: C.bg, borderRadius: 4 }}>
          <div className="text-sm font-semibold mb-2">{form.action === "skip" ? "Skip" : "Move"} the update on {weeklyLabel(form.slot)}</div>
          {form.action === "move" && (
            <label htmlFor="sch-at" className="block text-xs mb-2" style={{ color: C.mute }}>New date and time (IST)
              <input id="sch-at" type="datetime-local" value={form.at} onChange={(e) => setForm({ ...form, at: e.target.value })} className={input} style={fs} />
            </label>
          )}
          <label htmlFor="sch-reason" className="block text-xs mb-2" style={{ color: C.mute }}>Reason (private)
            <input id="sch-reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className={input} style={fs} />
          </label>
          <label className="flex items-center gap-2 text-sm mb-2"><input type="checkbox" checked={form.all} onChange={(e) => setForm({ ...form, all: e.target.checked })} /> Apply to every client</label>
          <div className="flex gap-2">
            <button onClick={save} className="px-3 py-1 rounded text-sm font-semibold" style={btn()}>{form.action === "skip" ? "Skip update" : "Move update"}</button>
            <button onClick={() => setForm(null)} className="px-3 py-1 rounded text-sm" style={{ border: `1px solid ${C.rule}`, background: "#fff" }}>Cancel</button>
          </div>
          {msg && <div className="text-sm mt-2" style={{ color: C.bad }}>{msg}</div>}
        </div>
      )}
    </Card>
  );
}

/* ───────── request conversations (client and admin) ───────── */
const REQ_STATUS = { new: ["New", "warn"], accepted: ["Accepted", "info"], in_progress: ["In progress", "info"], done: ["Done", "good"], declined: ["Declined", "info"] };

function Thread({ req, admin, onChange }) {
  const { rows, reload } = useRows(() => supabase.from("request_messages").select("*").eq("request_id", req.id).order("created_at"), [req.id]);
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState(null);
  const send = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    const { error } = await supabase.from("request_messages").insert({ request_id: req.id, body });
    if (error) return setMsg(error.message);
    setBody(""); reload();
  };
  const setStatus = async (status) => { await supabase.from("requests").update({ status }).eq("id", req.id); onChange(); };
  const [label, tone] = REQ_STATUS[req.status] || [req.status, "info"];
  return (
    <div className="mb-4 p-4" style={{ background: C.card, border: `1px solid ${C.rule}`, borderRadius: 4 }}>
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <Chip tone={tone}>{label}</Chip>
        <span className="text-xs" style={{ color: C.mute }}>{req.type} · {req.priority} · sent {fmtDateTime(req.created_at)}{req.author_email ? ` by ${req.author_email.replace("@u.portal", "")}` : ""}</span>
        {admin && (
          <select aria-label="Request status" value={req.status} onChange={(e) => setStatus(e.target.value)} className="ml-auto text-xs px-1 py-0.5 rounded" style={fs}>
            {Object.entries(REQ_STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
          </select>
        )}
      </div>
      <div className="text-sm mb-2" style={{ whiteSpace: "pre-wrap" }}>{req.details}</div>
      {req.link && <div className="text-xs mb-2"><a className="underline" style={{ color: C.deep }} href={req.link} target="_blank" rel="noreferrer">{req.link}</a></div>}
      <ul className="pl-3 mb-2" style={{ borderLeft: `2px solid ${C.rule}` }}>
        {req.reply && <li className="py-1 text-sm"><span className="text-xs" style={{ color: C.mute }}>Ajay (earlier reply)</span><div>{req.reply}</div></li>}
        {(rows || []).map((m) => (
          <li key={m.id} className="py-1 text-sm">
            <span className="text-xs" style={{ color: C.mute, fontVariantNumeric: "tabular-nums" }}>{fmtDateTime(m.created_at, { dateStyle: "medium", timeStyle: "short" })} · <b style={{ color: m.author_role === "admin" ? C.deep : C.good }}>{m.author_name}</b></span>
            <div style={{ whiteSpace: "pre-wrap" }}>{m.body}</div>
          </li>
        ))}
        {rows && !rows.length && !req.reply && <li className="text-xs py-1" style={{ color: C.mute }}>No replies yet.</li>}
      </ul>
      <form onSubmit={send} className="flex gap-2">
        <label htmlFor={`reply-${req.id}`} className="sr-only">Reply</label>
        <input id={`reply-${req.id}`} value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} placeholder="Write a reply…" className="flex-1 px-2 py-1.5 rounded text-sm" style={{ ...fs, minWidth: 0 }} />
        <button type="submit" className="px-3 py-1 rounded text-sm font-semibold" style={btn()}>Send</button>
      </form>
      {msg && <div className="text-xs mt-1" style={{ color: C.bad }}>{msg}</div>}
    </div>
  );
}

export function RequestThreads({ projectId, admin = false }) {
  const { rows, reload } = useRows(() => supabase.from("requests").select("*").eq("project_id", projectId).order("created_at", { ascending: false }), [projectId]);
  const [state, setState] = useState(null);
  const send = async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    const { error } = await supabase.from("requests").insert({ project_id: projectId, type: d.type, priority: d.priority, details: d.details, link: d.link || null });
    if (error) return setState(["bad", error.message]);
    e.target.reset(); setState(["good", "Sent. You can follow the replies below."]); reload();
  };
  return (
    <div>
      {!admin && (<>
        <H2>Ask for something</H2>
        <form onSubmit={send} className="max-w-xl mb-4">
          <div className="grid md:grid-cols-2 gap-x-4">
            <label htmlFor="rq-type" className="block text-xs mb-3" style={{ color: C.mute }}>Kind
              <select id="rq-type" name="type" className={input} style={fs}>{["New work", "Change", "Something is broken", "Question"].map((o) => <option key={o}>{o}</option>)}</select>
            </label>
            <label htmlFor="rq-priority" className="block text-xs mb-3" style={{ color: C.mute }}>How urgent
              <select id="rq-priority" name="priority" defaultValue="This week" className={input} style={fs}>{["Urgent: today", "This week", "This month", "Whenever"].map((o) => <option key={o}>{o}</option>)}</select>
            </label>
          </div>
          <label htmlFor="rq-details" className="block text-xs mb-3" style={{ color: C.mute }}>What would you like?
            <textarea id="rq-details" name="details" required rows={3} maxLength={5000} className={input} style={fs} />
          </label>
          <label htmlFor="rq-link" className="block text-xs mb-3" style={{ color: C.mute }}>Link (optional)
            <input id="rq-link" name="link" type="url" className={input} style={fs} />
          </label>
          <button type="submit" className="px-4 py-2 rounded text-sm font-semibold" style={btn()}>Send request</button>
          {state && <span className="ml-3 text-sm" style={{ color: C[state[0]] }}>{state[1]}</span>}
        </form>
      </>)}
      <H2>{admin ? "Requests and conversations" : "Your requests and replies"}</H2>
      <P style={{ color: C.mute }}>Every request and message is kept with its date and time. Nothing here can be edited or deleted.</P>
      {!rows ? <P>Loading…</P> : !rows.length ? <P style={{ color: C.mute }}>No requests yet.</P> : rows.map((r) => <Thread key={r.id} req={r} admin={admin} onChange={reload} />)}
    </div>
  );
}

/* ───────── decision history (from the audit trail) ───────── */
export function DecisionHistory({ id }) {
  const { rows } = useRows(() => supabase.from("audit_log").select("at,actor_name,summary").eq("table_name", "decisions").eq("row_id", id).order("at"), [id]);
  if (!rows) return <div className="text-xs" style={{ color: C.mute }}>Loading…</div>;
  if (!rows.length) return <div className="text-xs" style={{ color: C.mute }}>No changes recorded yet.</div>;
  return (
    <ul className="text-xs mt-1 pl-3" style={{ borderLeft: `2px solid ${C.rule}` }}>
      {rows.map((r, i) => <li key={i} className="py-0.5"><span style={{ color: C.mute, fontVariantNumeric: "tabular-nums" }}>{fmtDateTime(r.at)} · {r.actor_name}</span> · {r.summary}</li>)}
    </ul>
  );
}

/* ───────── work register: every audit and piece of work, in one place ───────── */
export function WorkLog({ projectId, reportKey, admin = false, onOpenReport }) {
  const upd = useRows(() => {
    let q = supabase.from("updates").select("id,happened_on,title,body,kind,status,client_visible").eq("project_id", projectId).in("kind", ["work", "milestone"]).eq("status", "Done");
    if (!admin) q = q.eq("client_visible", true);
    return q.order("happened_on", { ascending: false });
  }, [projectId, admin]);
  const files = useRows(() => {
    let q = supabase.from("files").select("id,name,created_at,category,client_visible").eq("project_id", projectId).in("category", ["report", "data", "design"]);
    if (!admin) q = q.eq("client_visible", true);
    return q.order("created_at", { ascending: false });
  }, [projectId, admin]);
  const [form, setForm] = useState(false);
  const [msg, setMsg] = useState(null);
  const add = async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    const { error } = await supabase.from("updates").insert({ project_id: projectId, kind: d.kind, happened_on: d.day, title: d.title, body: d.body || null, status: "Done", client_visible: false });
    if (error) return setMsg(error.message);
    setForm(false); setMsg("Logged. Approve it on the Updates tab when the client should see it."); upd.reload();
  };
  const report = reportKey && REPORTS[reportKey];
  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-2">
        <P style={{ marginBottom: 0 }}>Every audit, report and piece of work done for this project, with its date.</P>
        {admin && <button onClick={() => setForm(!form)} className="px-3 py-1 rounded text-sm font-semibold" style={btn()}>Log work</button>}
      </div>
      {msg && <div className="text-sm my-2" style={{ color: C.good }}>{msg}</div>}
      {form && (
        <form onSubmit={add} className="p-3 my-3 grid md:grid-cols-2 gap-x-4" style={{ background: C.card, border: `1px solid ${C.deep}`, borderRadius: 4 }}>
          <label htmlFor="w-title" className="block text-xs mb-2 md:col-span-2" style={{ color: C.mute }}>What was done<input id="w-title" name="title" required className={input} style={fs} /></label>
          <label htmlFor="w-day" className="block text-xs mb-2" style={{ color: C.mute }}>Date<input id="w-day" name="day" type="date" required defaultValue={new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })} className={input} style={fs} /></label>
          <label htmlFor="w-kind" className="block text-xs mb-2" style={{ color: C.mute }}>Type<select id="w-kind" name="kind" className={input} style={fs}><option value="work">Work</option><option value="milestone">Milestone or audit</option></select></label>
          <label htmlFor="w-body" className="block text-xs mb-2 md:col-span-2" style={{ color: C.mute }}>Details<textarea id="w-body" name="body" rows={3} className={input} style={fs} /></label>
          <div><button type="submit" className="px-3 py-1 rounded text-sm font-semibold" style={btn()}>Save</button></div>
        </form>
      )}
      {report && (
        <Card className="my-3">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <span><Chip tone="good">Report</Chip> <b>{report.label}</b></span>
            {onOpenReport && <button className="underline text-sm" style={{ color: C.deep }} onClick={onOpenReport}>Open the report</button>}
          </div>
        </Card>
      )}
      <T head={["Date", "Work", "Details", ...(admin ? ["Client sees"] : [])]} rows={(upd.rows || []).map((u) => [
        <span key="d" className="whitespace-nowrap">{fmtDate(u.happened_on)}</span>, <b key="t">{u.title}</b>, u.body || "",
        ...(admin ? [u.client_visible ? "Yes" : <Chip key="w" tone="warn">Not approved</Chip>] : []),
      ])} />
      {(files.rows || []).length > 0 && (<>
        <H2>Reports and files</H2>
        <T head={["Added", "File", "Type"]} rows={files.rows.map((f) => [fmtDate(f.created_at.slice(0, 10)), f.name, f.category])} />
        <P style={{ color: C.mute }}>Download them from the Files tab.</P>
      </>)}
    </div>
  );
}

/* ───────── tool access and credentials (admin only) ───────── */
function Secret({ c, onSaved }) {
  const [shown, setShown] = useState(null);
  const [edit, setEdit] = useState(false);
  const [val, setVal] = useState("");
  const [msg, setMsg] = useState(null);
  useEffect(() => { if (!shown) return; const t = setTimeout(() => setShown(null), 30000); return () => clearTimeout(t); }, [shown]);
  const reveal = async () => {
    const { data, error } = await supabase.rpc("credential_reveal", { cred: c.id });
    if (error) return setMsg(error.message);
    setShown(data);
  };
  const save = async (e) => {
    e.preventDefault();
    const { error } = await supabase.rpc("credential_set_secret", { cred: c.id, secret: val });
    if (error) return setMsg(error.message);
    setVal(""); setEdit(false); setMsg("Saved, encrypted."); onSaved();
  };
  const copy = async () => { try { await navigator.clipboard.writeText(shown); setMsg("Copied"); } catch { setMsg("Select and copy it by hand"); } };
  return (
    <div className="text-xs">
      {c.secret_id ? (shown != null
        ? <span><code style={{ userSelect: "all", background: C.bg, padding: "1px 4px" }}>{shown}</code> <button className="underline" onClick={copy}>Copy</button> <button className="underline" onClick={() => setShown(null)}>Hide</button></span>
        : <span>•••••••• <button className="underline" style={{ color: C.deep }} onClick={reveal}>Show</button></span>)
        : <span style={{ color: C.mute }}>No password stored</span>}
      {" "}<button className="underline" style={{ color: C.mute }} onClick={() => setEdit(!edit)}>{c.secret_id ? "Change" : "Add password"}</button>
      {edit && (
        <form onSubmit={save} className="flex gap-1 mt-1">
          <input aria-label={`Password for ${c.tool}`} type="password" autoComplete="new-password" required value={val} onChange={(e) => setVal(e.target.value)} className="px-2 py-1 rounded" style={{ ...fs, minWidth: 0 }} />
          <button type="submit" className="px-2 py-1 rounded font-semibold" style={btn()}>Save</button>
        </form>
      )}
      {msg && <div style={{ color: C.mute }}>{msg}</div>}
    </div>
  );
}

const CRED_FIELDS = [["tool", "Tool", true], ["url", "Login address"], ["username", "Login / username"], ["access_level", "Access level"], ["granted_by", "Access given by"], ["granted_on", "Since", false, "date"], ["notes", "Notes", false, "textarea"]];

export function CredentialsPanel({ projectId }) {
  const { rows, reload } = useRows(() => supabase.from("credentials").select("*").eq("project_id", projectId).order("tool"), [projectId]);
  const [edit, setEdit] = useState(null);
  const [msg, setMsg] = useState(null);
  const save = async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(CRED_FIELDS.map(([k]) => [k, edit[k] || null]));
    body.status = edit.status || "active"; body.project_id = projectId; body.updated_at = new Date().toISOString();
    const { error } = edit.id ? await supabase.from("credentials").update(body).eq("id", edit.id) : await supabase.from("credentials").insert(body);
    if (error) return setMsg(error.message);
    setEdit(null); setMsg(null); reload();
  };
  return (
    <div>
      <Box tone="info" title="Only you can see this tab">
        Passwords are encrypted in Supabase Vault and never stored in plain text. Each “Show” is recorded in the Activity log, and the password hides again after 30 seconds. Prefer your own login with access granted by the client over keeping their password.
      </Box>
      <div className="flex justify-end mb-2">
        <button onClick={() => setEdit({ status: "active" })} className="px-3 py-1 rounded text-sm font-semibold" style={btn()}>Add tool</button>
      </div>
      {edit && (
        <form onSubmit={save} className="p-4 mb-3 grid md:grid-cols-2 gap-x-4" style={{ background: C.card, border: `1px solid ${C.deep}`, borderRadius: 4 }}>
          {CRED_FIELDS.map(([k, l, req, type]) => (
            <label key={k} htmlFor={`cr-${k}`} className={`block text-xs mb-2 ${type === "textarea" ? "md:col-span-2" : ""}`} style={{ color: C.mute }}>{l}
              {type === "textarea"
                ? <textarea id={`cr-${k}`} rows={2} value={edit[k] || ""} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} className={input} style={fs} />
                : <input id={`cr-${k}`} type={type || "text"} required={req} value={edit[k] || ""} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} className={input} style={fs} />}
            </label>
          ))}
          <label htmlFor="cr-status" className="block text-xs mb-2" style={{ color: C.mute }}>Status
            <select id="cr-status" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })} className={input} style={fs}>
              <option value="active">Active</option><option value="pending">Waiting for access</option><option value="revoked">Removed</option>
            </select>
          </label>
          <div className="md:col-span-2 flex gap-2 items-center">
            <button type="submit" className="px-3 py-1 rounded text-sm font-semibold" style={btn()}>Save</button>
            <button type="button" onClick={() => setEdit(null)} className="px-3 py-1 rounded text-sm" style={{ border: `1px solid ${C.rule}`, background: "#fff" }}>Cancel</button>
            <span className="text-xs" style={{ color: C.mute }}>Add the password after saving.</span>
            {msg && <span className="text-xs" style={{ color: C.bad }}>{msg}</span>}
          </div>
        </form>
      )}
      {!rows ? <P>Loading…</P> : !rows.length ? <P style={{ color: C.mute }}>No tools recorded yet.</P> : (
        <T head={["Tool", "Login", "Access", "Since", "Password", "Status", ""]} rows={rows.map((c) => [
          <span key="t"><b>{c.tool}</b>{c.url && <div className="text-xs"><a className="underline" href={c.url} target="_blank" rel="noreferrer" style={{ color: C.deep }}>{c.url.replace(/^https?:\/\//, "")}</a></div>}</span>,
          <span key="u" style={{ userSelect: "all" }}>{c.username || "–"}</span>,
          <span key="a">{c.access_level || "–"}{c.granted_by && <div className="text-xs" style={{ color: C.mute }}>by {c.granted_by}</div>}</span>,
          c.granted_on ? fmtDate(c.granted_on) : "–",
          <Secret key="s" c={c} onSaved={reload} />,
          <Chip key="st" tone={c.status === "active" ? "good" : c.status === "pending" ? "warn" : "info"}>{c.status === "pending" ? "Waiting" : c.status === "revoked" ? "Removed" : "Active"}</Chip>,
          <button key="e" className="underline text-xs" style={{ color: C.deep }} onClick={() => setEdit({ ...c })}>Edit</button>,
        ])} />
      )}
      {rows?.some((c) => c.notes) && rows.filter((c) => c.notes).map((c) => <P key={c.id} style={{ color: C.mute }}><b>{c.tool}: </b>{c.notes}</P>)}
    </div>
  );
}

/* ───────── privacy (DPDP) ───────── */
export function PrivacyNotice() {
  return (
    <div>
      <P>This notice explains what personal data this portal holds, why, and your rights under India’s Digital Personal Data Protection Act, 2023. Version {PRIVACY_VERSION}.</P>
      <T head={["", ""]} rows={[
        ["Who is responsible", `${PRIVACY.fiduciary}. Contact: ${PRIVACY.contact}`],
        ["What we hold", <ul key="c" className="pl-4" style={{ listStyle: "disc" }}>{PRIVACY.collected.map((x) => <li key={x}>{x}</li>)}</ul>],
        ["Why", PRIVACY.purpose],
        ["Where", PRIVACY.where],
        ["How long", PRIVACY.retention],
        ["Your rights", <ul key="r" className="pl-4" style={{ listStyle: "disc" }}>{PRIVACY.rights.map((x) => <li key={x}>{x}</li>)}</ul>],
        ["If something goes wrong", PRIVACY.breach],
        ["Response time", PRIVACY.response],
      ].map(([a, b]) => [<b key={a}>{a}</b>, b])} />
    </div>
  );
}

export function PrivacyPage() {
  return <div><H1>Privacy notice</H1><PrivacyNotice /></div>;
}

/* Asks a client to accept the current privacy notice once (and again whenever it changes). */
export function ConsentGate({ children }) {
  const { session, profile } = useAuth();
  const { rows, reload } = useRows(() => supabase.from("consents").select("notice_version").eq("user_id", session?.user.id ?? "").eq("notice_version", PRIVACY_VERSION), [session?.user.id]);
  const [ok, setOk] = useState(false);
  const [msg, setMsg] = useState(null);
  if (!session || profile?.is_owner) return children;
  if (!rows) return <P>Loading…</P>;
  if (rows.length) return children;
  const accept = async () => {
    const { error } = await supabase.from("consents").insert({ notice_version: PRIVACY_VERSION });
    if (error) return setMsg(error.message);
    reload();
  };
  return (
    <div className="max-w-3xl">
      <H1>Before you continue</H1>
      <PrivacyNotice />
      <label className="flex items-start gap-2 text-sm my-3"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} className="mt-1" /> I have read this notice and agree to my personal data being used as described, to run my project.</label>
      <button disabled={!ok} onClick={accept} className="px-4 py-2 rounded text-sm font-semibold" style={{ ...btn(), opacity: ok ? 1 : 0.5 }}>Agree and continue</button>
      {msg && <div className="text-sm mt-2" style={{ color: C.bad }}>{msg}</div>}
    </div>
  );
}

/* Client: their data, rights, and what happens if the project ends. */
export function YourData({ project }) {
  const { session, profile } = useAuth();
  const consents = useRows(() => supabase.from("consents").select("notice_version,accepted_at").eq("user_id", session.user.id).order("accepted_at", { ascending: false }), [session.user.id]);
  const [busy, setBusy] = useState(null);
  const [req, setReq] = useState(null);

  const download = async () => {
    setBusy("Collecting your data…");
    const pid = project.id;
    const tables = ["updates", "issues", "decisions", "requests", "request_messages", "project_services", "invoices", "expenses", "files", "metrics"];
    const out = { exported_at: new Date().toISOString(), notice_version: PRIVACY_VERSION, profile, project };
    for (const t of tables) { const { data } = await supabase.from(t).select("*").eq("project_id", pid); out[t] = data || []; }
    out.activity = (await supabase.from("audit_log").select("at,actor_name,summary").or(`project_id.eq.${pid},actor_id.eq.${session.user.id}`).order("at")).data || [];
    out.consents = consents.rows || [];
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `my-data-${project.slug}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setBusy("Downloaded. Your files themselves are on the Files tab.");
  };
  const ask = async (kind) => {
    const text = { correct: "[Privacy] Please correct my personal data: ", delete: "[Privacy] Please delete my personal data and close my portal access.", withdraw: "[Privacy] I withdraw my consent." }[kind];
    const { error } = await supabase.from("requests").insert({ project_id: project.id, type: "Question", priority: "This week", details: text + (kind === "correct" ? (req || "") : "") });
    setBusy(error ? error.message : "Your privacy request is sent and logged. Ajay replies within 7 days (Requests tab).");
  };

  return (
    <div>
      <H2>Your data and privacy</H2>
      <P>{PRIVACY.purpose}</P>
      <div className="flex flex-wrap gap-2 mb-3">
        <button onClick={download} className="px-3 py-1.5 rounded text-sm font-semibold" style={btn()}>Download my data</button>
        <Link to="/privacy" className="px-3 py-1.5 rounded text-sm underline" style={{ color: C.deep }}>Read the privacy notice</Link>
      </div>
      {busy && <Box tone="info">{busy}</Box>}
      <Card className="mb-4">
        <div className="font-semibold text-sm mb-2" style={{ color: C.deep }}>Ask for a change to your data</div>
        <label htmlFor="priv-fix" className="block text-xs mb-2" style={{ color: C.mute }}>What should be corrected?
          <input id="priv-fix" value={req || ""} onChange={(e) => setReq(e.target.value)} className={input} style={fs} />
        </label>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => ask("correct")} disabled={!req} className="px-3 py-1 rounded text-sm" style={{ border: `1px solid ${C.deep}`, color: C.deep, background: "#fff", opacity: req ? 1 : 0.5 }}>Request correction</button>
          <button onClick={() => ask("delete")} className="px-3 py-1 rounded text-sm" style={{ border: `1px solid ${C.bad}`, color: C.bad, background: "#fff" }}>Request deletion</button>
          <button onClick={() => ask("withdraw")} className="px-3 py-1 rounded text-sm" style={{ border: `1px solid ${C.rule}`, background: "#fff" }}>Withdraw consent</button>
        </div>
      </Card>
      <H2>If the project ends</H2>
      <P>This is a long-term project: while it runs, Ajay manages your tools and accounts. If it ever ends:</P>
      <T head={["", ""]} rows={OFFBOARDING.map(([a, b]) => [<b key={a}>{a}</b>, b])} />
      {project.ended_on && <Box tone="warn" title={`Project ended on ${fmtDate(project.ended_on)}`}>Your access to this portal ends 7 days after that date.</Box>}
      <P style={{ color: C.mute }}>
        Consent recorded: {(consents.rows || []).map((c) => `${c.notice_version} on ${fmtDateTime(c.accepted_at)}`).join("; ") || "none yet"}.
      </P>
    </div>
  );
}
