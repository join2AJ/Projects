/*
 * Meeting notes: after each call or update, what was discussed, the action points (who, by when, done or not)
 * and the workable points (ideas to act on). Private until shared; then the client sees them on their project.
 */
import { useState } from "react";
import { supabase } from "../lib/supabase.js";
import { useRows } from "../lib/useRows.js";
import { fmtDate } from "../lib/money.js";
import { C, Chip, P, Card } from "./ui.jsx";

export const KINDS = [["discussion", "Discussion points"], ["action", "Action points"], ["workable", "Workable points"]];
const OWNER = { me: "Ajay", client: "You", both: "Both" };
const OWNER_ADMIN = { me: "Me", client: "Client", both: "Both" };
// Action points: open → done. Workable points: noted → working on it → done. Either can be dropped.
const STATUS = { open: ["Open", "warn"], in_progress: ["Working on it", "info"], done: ["Done", "good"], dropped: ["Dropped", "info"] };
export const PRIORITY = { 1: ["P1 Now", "bad"], 2: ["P2 Next", "warn"], 3: ["P3 Later", "info"] };
const byPriority = (a, b) => (a.priority ?? 9) - (b.priority ?? 9) || a.sort - b.sort || a.created_at.localeCompare(b.created_at);
const statusLabel = (i) => (i.kind === "workable" && i.status === "open" ? ["Noted", "info"] : STATUS[i.status]);
const NEXT = { action: [["open", "Open"], ["done", "Done"], ["dropped", "Drop"]], workable: [["open", "Noted"], ["in_progress", "Working on it"], ["done", "Done"], ["dropped", "Drop"]], discussion: [] };
const input = "mt-1 w-full px-2 py-1.5 rounded text-sm";
const fs = { border: `1px solid ${C.rule}`, background: "#fff" };
const btn = { background: C.deep, color: "#fff" };
const todayIst = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

/* WhatsApp-ready text of one meeting. */
export const meetingText = (m, items, client = false) => {
  const who = client ? OWNER : OWNER_ADMIN;
  if (client) items = items.filter((i) => i.client_visible);
  const lines = [`${m.title} (${fmtDate(m.held_on)}${m.channel ? `, ${m.channel}` : ""})`];
  if (m.summary) lines.push("", m.summary);
  for (const [k, label] of KINDS) {
    const list = items.filter((i) => i.kind === k && i.status !== "dropped");
    if (!list.length) continue;
    lines.push("", label);
    list.forEach((i, n) => lines.push(`${n + 1}. ${i.priority && !["done", "dropped"].includes(i.status) ? `(${PRIORITY[i.priority][0]}) ` : ""}${i.body}${i.owner ? ` [${who[i.owner]}${i.due_on ? `, by ${fmtDate(i.due_on)}` : ""}]` : ""}${i.kind !== "discussion" && i.status !== "open" ? ` (${statusLabel(i)[0]})` : ""}`));
  }
  return lines.join("\n");
};

function ItemForm({ item, meetingId, kind, onDone }) {
  const [f, setF] = useState(item || { kind, body: "", owner: kind === "action" ? "me" : "", due_on: "", priority: "", client_visible: false });
  const [msg, setMsg] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const save = async (e) => {
    e.preventDefault();
    const body = { kind: f.kind, body: f.body, owner: f.owner || null, due_on: f.due_on || null, priority: f.priority ? Number(f.priority) : null, client_visible: !!f.client_visible };
    const { error } = item ? await supabase.from("meeting_items").update(body).eq("id", item.id) : await supabase.from("meeting_items").insert({ ...body, meeting_id: meetingId });
    if (error) return setMsg(error.message);
    onDone();
  };
  return (
    <form onSubmit={save} className="grid gap-2 md:grid-cols-6 items-end my-2 p-2" style={{ background: C.bg, borderRadius: 4 }}>
      <label className="block text-xs md:col-span-6" style={{ color: C.mute }}>Point
        <textarea name="body" required maxLength={2000} rows={2} autoFocus value={f.body} onChange={set("body")} className={input} style={fs} />
      </label>
      <label className="block text-xs" style={{ color: C.mute }}>Type
        <select name="kind" value={f.kind} onChange={set("kind")} className={input} style={fs}>{KINDS.map(([k, l]) => <option key={k} value={k}>{l.replace(" points", "")}</option>)}</select>
      </label>
      <label className="block text-xs" style={{ color: C.mute }}>Who
        <select name="owner" value={f.owner || ""} onChange={set("owner")} className={input} style={fs}><option value="">—</option><option value="me">Me</option><option value="client">Client</option><option value="both">Both</option></select>
      </label>
      <label className="block text-xs" style={{ color: C.mute }}>By<input name="due_on" type="date" value={f.due_on || ""} onChange={set("due_on")} className={input} style={fs} /></label>
      <label className="block text-xs" style={{ color: C.mute }}>Priority
        <select name="priority" value={f.priority || ""} onChange={set("priority")} className={input} style={fs}><option value="">—</option>{Object.entries(PRIORITY).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select>
      </label>
      <label className="flex items-center gap-2 text-sm pb-1"><input type="checkbox" checked={!!f.client_visible} onChange={set("client_visible")} /> Share with client</label>
      <div className="flex gap-2 items-center pb-1">
        <button type="submit" className="px-3 py-1 rounded text-sm font-semibold" style={btn}>Save</button>
        <button type="button" className="text-xs underline" onClick={onDone}>Cancel</button>
      </div>
      {msg && <div className="text-xs md:col-span-6" style={{ color: C.bad }}>{msg}</div>}
    </form>
  );
}

function Items({ list, admin, onChange }) {
  const [edit, setEdit] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const set = async (i, patch) => { await supabase.from("meeting_items").update(patch).eq("id", i.id); onChange(); };
  const remove = async (i) => { await supabase.from("meeting_items").delete().eq("id", i.id); setConfirm(null); onChange(); };
  return (
    <ol className="text-sm pl-5" style={{ listStyle: "decimal", lineHeight: 1.6 }}>
      {list.map((i) => edit === i.id ? (
        <li key={i.id}><ItemForm item={i} onDone={() => { setEdit(null); onChange(); }} /></li>
      ) : (
        <li key={i.id} className="py-1" style={{ opacity: i.status === "dropped" ? 0.5 : 1 }}>
          <span style={{ textDecoration: i.status === "done" && i.kind === "action" ? "line-through" : "none" }}>{i.body}</span>
          <span className="ml-2 text-xs" style={{ color: C.mute }}>
            {i.priority && i.status !== "done" && i.status !== "dropped" && <><Chip tone={PRIORITY[i.priority][1]}>{PRIORITY[i.priority][0]}</Chip>{" "}</>}
            {i.owner && <b>{(admin ? OWNER_ADMIN : OWNER)[i.owner]}</b>}{i.due_on && ` · by ${fmtDate(i.due_on)}`}{" "}
            {i.kind !== "discussion" && <Chip tone={statusLabel(i)[1]}>{statusLabel(i)[0]}</Chip>}
          </span>
          {admin && (
            <div className="flex flex-wrap gap-x-3 gap-y-1 items-center text-xs mt-0.5">
              <button onClick={() => set(i, { client_visible: !i.client_visible })} aria-pressed={i.client_visible}
                className="px-1.5 py-0.5 rounded font-semibold" style={i.client_visible ? { background: C.goodBg, color: C.good } : { border: `1px solid ${C.rule}`, color: C.mute }}>
                {i.client_visible ? "✓ Shared" : "Share"}
              </button>
              {NEXT[i.kind].filter(([k]) => k !== i.status).map(([k, l]) => (
                <button key={k} className="underline" style={{ color: k === "done" ? C.good : k === "dropped" ? C.mute : C.deep }} onClick={() => set(i, { status: k })}>{l}</button>
              ))}
              <button className="underline" style={{ color: C.deep }} onClick={() => setEdit(i.id)}>Edit</button>
              {confirm === i.id ? <button className="underline" style={{ color: C.bad }} onClick={() => remove(i)}>Confirm delete</button>
                : <button className="underline" style={{ color: C.mute }} onClick={() => setConfirm(i.id)}>Delete</button>}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

function AddItem({ meetingId, kind, onAdded }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button className="text-xs underline" style={{ color: C.deep }} onClick={() => setOpen(true)}>+ Add</button>;
  return <ItemForm meetingId={meetingId} kind={kind} onDone={() => { setOpen(false); onAdded(); }} />;
}

function MeetingForm({ projectId, m, onDone }) {
  const [f, setF] = useState(m || { held_on: todayIst(), channel: "WhatsApp voice call", title: "", summary: "" });
  const [msg, setMsg] = useState(null);
  const save = async (e) => {
    e.preventDefault();
    const body = { project_id: projectId, held_on: f.held_on, channel: f.channel || null, title: f.title, summary: f.summary || null, updated_at: new Date().toISOString() };
    const { error } = m?.id ? await supabase.from("meetings").update(body).eq("id", m.id) : await supabase.from("meetings").insert(body);
    if (error) return setMsg(error.message);
    onDone();
  };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <form onSubmit={save} className="p-4 mb-4 grid gap-x-4 md:grid-cols-3" style={{ background: C.card, border: `1px solid ${C.deep}`, borderRadius: 4 }}>
      <label className="block text-xs mb-2" style={{ color: C.mute }}>Date<input id="mt-date" type="date" required value={f.held_on} onChange={set("held_on")} className={input} style={fs} /></label>
      <label className="block text-xs mb-2" style={{ color: C.mute }}>How<input id="mt-channel" value={f.channel || ""} onChange={set("channel")} placeholder="WhatsApp voice call" className={input} style={fs} /></label>
      <label className="block text-xs mb-2" style={{ color: C.mute }}>Title<input id="mt-title" required value={f.title} onChange={set("title")} placeholder="e.g. Kick-off call" className={input} style={fs} /></label>
      <label className="block text-xs mb-2 md:col-span-3" style={{ color: C.mute }}>Summary (optional)<textarea id="mt-summary" rows={2} value={f.summary || ""} onChange={set("summary")} className={input} style={fs} /></label>
      <div className="flex gap-2 items-center md:col-span-3">
        <button type="submit" className="px-3 py-1 rounded text-sm font-semibold" style={btn}>Save</button>
        <button type="button" onClick={onDone} className="px-3 py-1 rounded text-sm" style={{ border: `1px solid ${C.rule}`, background: "#fff" }}>Cancel</button>
        {msg && <span className="text-sm" style={{ color: C.bad }}>{msg}</span>}
      </div>
    </form>
  );
}

function Meeting({ m, items, admin, onChange, onEdit }) {
  const [copied, setCopied] = useState(false);
  const mine = items.filter((i) => i.meeting_id === m.id).sort(byPriority);
  const share = async () => { await supabase.from("meetings").update({ client_visible: !m.client_visible }).eq("id", m.id); onChange(); };
  const copy = async () => { try { await navigator.clipboard.writeText(meetingText(m, mine, true)); setCopied(true); } catch { setCopied(false); } };
  const open = mine.filter((i) => i.kind === "action" && i.status === "open").length;
  const shared = mine.filter((i) => i.client_visible).length;
  const shareAll = async (k, on) => { await supabase.from("meeting_items").update({ client_visible: on }).eq("meeting_id", m.id).eq("kind", k); onChange(); };
  return (
    <Card className="mb-4">
      <div className="flex flex-wrap items-baseline gap-2 mb-1">
        <span className="font-semibold flex-1" style={{ color: C.deep, minWidth: 0 }}>{m.title}</span>
        <span className="text-xs" style={{ color: C.mute }}>{fmtDate(m.held_on)}{m.channel ? ` · ${m.channel}` : ""}</span>
        {admin && (m.client_visible ? <Chip tone="good">Shared</Chip> : <Chip tone="warn">Private draft</Chip>)}
        {admin && <Chip tone="info">{shared} of {mine.length} points shared</Chip>}
        {open > 0 && <Chip tone="warn">{open} action{open > 1 ? "s" : ""} open</Chip>}
      </div>
      {m.summary && <P style={{ color: C.mute }}>{m.summary}</P>}
      {KINDS.map(([k, label]) => {
        const list = mine.filter((i) => i.kind === k && (admin || i.status !== "dropped"));
        if (!admin && !list.length) return null;
        const all = list.length > 0 && list.every((i) => i.client_visible);
        return (
          <div key={k} className="mt-3">
            <div className="flex flex-wrap items-baseline gap-3 mb-1">
              <span className="text-sm font-semibold" style={{ color: C.ink }}>{label}</span>
              {admin && list.length > 0 && <button className="text-xs underline" style={{ color: C.deep }} onClick={() => shareAll(k, !all)}>{all ? "Unshare all" : "Share all"}</button>}
            </div>
            {list.length ? <Items list={list} admin={admin} onChange={onChange} /> : <div className="text-xs" style={{ color: C.mute }}>None yet.</div>}
            {admin && <AddItem meetingId={m.id} kind={k} onAdded={onChange} />}
          </div>
        );
      })}
      {admin && (
        <div className="flex flex-wrap gap-3 items-center mt-4 pt-3 text-sm" style={{ borderTop: `1px solid ${C.rule}` }}>
          <span className="text-xs w-full" style={{ color: C.mute }}>{m.client_visible
            ? `The client sees this meeting and the ${shared} point${shared === 1 ? "" : "s"} marked Shared.`
            : "Mark the points to share, then press Share with client. Until then the client sees nothing from this meeting."}</span>
          <button onClick={share} className="px-3 py-1 rounded font-semibold" style={m.client_visible ? { border: `1px solid ${C.rule}`, background: "#fff" } : btn}>{m.client_visible ? "Unshare" : "Share with client"}</button>
          <button onClick={copy} className="underline" style={{ color: C.deep }}>{copied ? "Copied, paste in WhatsApp" : "Copy shared points for WhatsApp"}</button>
          <button onClick={onEdit} className="underline" style={{ color: C.mute }}>Edit title and summary</button>
        </div>
      )}
    </Card>
  );
}

export function MeetingNotes({ projectId, admin = false }) {
  const meetings = useRows(() => supabase.from("meetings").select("*").eq("project_id", projectId).order("held_on", { ascending: false }).order("created_at", { ascending: false }), [projectId]);
  const items = useRows(() => supabase.from("meeting_items").select("*").eq("project_id", projectId), [projectId]);
  const [edit, setEdit] = useState(null);
  const reload = () => { meetings.reload(); items.reload(); };
  if (!meetings.rows || !items.rows) return <P>Loading…</P>;
  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-2">
        <P style={{ marginBottom: 0 }}>{admin
          ? "After each call or update: what was discussed, who does what by when, and ideas to act on. Notes stay private until you share them."
          : "Notes from our calls and updates: what we discussed, who does what by when, and ideas we can act on."}</P>
        {admin && <button onClick={() => setEdit({})} className="px-3 py-1 rounded text-sm font-semibold" style={btn}>Add meeting notes</button>}
      </div>
      {edit && <MeetingForm projectId={projectId} m={edit.id ? edit : null} onDone={() => { setEdit(null); reload(); }} />}
      <div className="mt-3">
        {!meetings.rows.length ? <P style={{ color: C.mute }}>{admin ? "No notes yet." : "No meeting notes shared yet."}</P>
          : meetings.rows.map((m) => <Meeting key={m.id} m={m} items={items.rows} admin={admin} onChange={reload} onEdit={() => setEdit(m)} />)}
      </div>
    </div>
  );
}

/* Admin dashboard: open action points across projects. */
export function OpenActions({ projects }) {
  const { rows } = useRows(() => supabase.from("meeting_items").select("id,project_id,body,owner,due_on,priority").eq("kind", "action").in("status", ["open", "in_progress"])
    .order("priority", { nullsFirst: false }).order("due_on", { nullsFirst: false }), []);
  const name = Object.fromEntries(projects.map((p) => [p.id, p]));
  return (
    <Card>
      <div className="font-semibold text-sm mb-2" style={{ color: C.deep }}>Open action points</div>
      {!rows?.length ? <div className="text-sm" style={{ color: C.mute }}>None. Add them after each call under the project’s Meetings tab.</div> : (
        <ul className="text-sm grid gap-1">
          {rows.slice(0, 8).map((i) => (
            <li key={i.id}>{i.priority && <Chip tone={PRIORITY[i.priority][1]}>{PRIORITY[i.priority][0]}</Chip>} <b>{name[i.project_id]?.name}</b>: {i.body} <span className="text-xs" style={{ color: C.mute }}>{OWNER_ADMIN[i.owner] || ""}{i.due_on ? ` · by ${fmtDate(i.due_on)}` : ""}</span></li>
          ))}
          {rows.length > 8 && <li className="text-xs" style={{ color: C.mute }}>and {rows.length - 8} more</li>}
        </ul>
      )}
    </Card>
  );
}

