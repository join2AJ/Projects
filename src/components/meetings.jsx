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
const STATUS = { open: ["Open", "warn"], done: ["Done", "good"], dropped: ["Dropped", "info"] };
const input = "mt-1 w-full px-2 py-1.5 rounded text-sm";
const fs = { border: `1px solid ${C.rule}`, background: "#fff" };
const btn = { background: C.deep, color: "#fff" };
const todayIst = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

/* WhatsApp-ready text of one meeting. */
export const meetingText = (m, items, client = false) => {
  const who = client ? OWNER : OWNER_ADMIN;
  const lines = [`${m.title} (${fmtDate(m.held_on)}${m.channel ? `, ${m.channel}` : ""})`];
  if (m.summary) lines.push("", m.summary);
  for (const [k, label] of KINDS) {
    const list = items.filter((i) => i.kind === k && i.status !== "dropped");
    if (!list.length) continue;
    lines.push("", label);
    list.forEach((i, n) => lines.push(`${n + 1}. ${i.body}${i.owner ? ` [${who[i.owner]}${i.due_on ? `, by ${fmtDate(i.due_on)}` : ""}]` : ""}${i.status === "done" ? " ✓" : ""}`));
  }
  return lines.join("\n");
};

function Items({ list, admin, onChange }) {
  const set = async (i, patch) => { await supabase.from("meeting_items").update(patch).eq("id", i.id); onChange(); };
  return (
    <ol className="text-sm pl-5" style={{ listStyle: "decimal", lineHeight: 1.6 }}>
      {list.map((i) => (
        <li key={i.id} className="py-1" style={{ opacity: i.status === "dropped" ? 0.5 : 1 }}>
          <span style={{ textDecoration: i.status === "done" && i.kind === "action" ? "line-through" : "none" }}>{i.body}</span>
          {(i.owner || i.due_on || i.kind === "action") && (
            <span className="ml-2 text-xs whitespace-nowrap" style={{ color: C.mute }}>
              {i.owner && <b>{(admin ? OWNER_ADMIN : OWNER)[i.owner]}</b>}{i.due_on && ` · by ${fmtDate(i.due_on)}`}{" "}
              {i.kind === "action" && <Chip tone={STATUS[i.status][1]}>{STATUS[i.status][0]}</Chip>}
            </span>
          )}
          {admin && (
            <span className="ml-2 text-xs whitespace-nowrap">
              {i.status !== "done" && <button className="underline mr-2" style={{ color: C.good }} onClick={() => set(i, { status: "done" })}>Done</button>}
              {i.status !== "open" && <button className="underline mr-2" style={{ color: C.deep }} onClick={() => set(i, { status: "open" })}>Reopen</button>}
              {i.status === "open" && <button className="underline" style={{ color: C.mute }} onClick={() => set(i, { status: "dropped" })}>Drop</button>}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

function AddItem({ meetingId, kind, onAdded }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState(null);
  const add = async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    const { error } = await supabase.from("meeting_items").insert({ meeting_id: meetingId, kind, body: d.body, owner: d.owner || null, due_on: d.due_on || null });
    if (error) return setMsg(error.message);
    e.target.reset(); setMsg(null); onAdded();
  };
  if (!open) return <button className="text-xs underline" style={{ color: C.deep }} onClick={() => setOpen(true)}>+ Add</button>;
  return (
    <form onSubmit={add} className="grid gap-2 md:grid-cols-6 items-end mt-1">
      <label className="block text-xs md:col-span-3" style={{ color: C.mute }}>Point<input name="body" required maxLength={2000} autoFocus className={input} style={fs} /></label>
      <label className="block text-xs" style={{ color: C.mute }}>Who
        <select name="owner" defaultValue={kind === "action" ? "me" : ""} className={input} style={fs}><option value="">—</option><option value="me">Me</option><option value="client">Client</option><option value="both">Both</option></select>
      </label>
      <label className="block text-xs" style={{ color: C.mute }}>By<input name="due_on" type="date" className={input} style={fs} /></label>
      <div className="flex gap-2"><button type="submit" className="px-3 py-1.5 rounded text-sm font-semibold" style={btn}>Add</button><button type="button" className="text-xs underline" onClick={() => setOpen(false)}>Close</button></div>
      {msg && <div className="text-xs md:col-span-6" style={{ color: C.bad }}>{msg}</div>}
    </form>
  );
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
  const mine = items.filter((i) => i.meeting_id === m.id).sort((a, b) => a.sort - b.sort || a.created_at.localeCompare(b.created_at));
  const share = async () => { await supabase.from("meetings").update({ client_visible: !m.client_visible }).eq("id", m.id); onChange(); };
  const copy = async () => { try { await navigator.clipboard.writeText(meetingText(m, mine, true)); setCopied(true); } catch { setCopied(false); } };
  const open = mine.filter((i) => i.kind === "action" && i.status === "open").length;
  return (
    <Card className="mb-4">
      <div className="flex flex-wrap items-baseline gap-2 mb-1">
        <span className="font-semibold flex-1" style={{ color: C.deep, minWidth: 0 }}>{m.title}</span>
        <span className="text-xs" style={{ color: C.mute }}>{fmtDate(m.held_on)}{m.channel ? ` · ${m.channel}` : ""}</span>
        {admin && (m.client_visible ? <Chip tone="good">Shared</Chip> : <Chip tone="warn">Private draft</Chip>)}
        {open > 0 && <Chip tone="warn">{open} action{open > 1 ? "s" : ""} open</Chip>}
      </div>
      {m.summary && <P style={{ color: C.mute }}>{m.summary}</P>}
      {KINDS.map(([k, label]) => {
        const list = mine.filter((i) => i.kind === k && (admin || i.status !== "dropped"));
        if (!admin && !list.length) return null;
        return (
          <div key={k} className="mt-3">
            <div className="text-sm font-semibold mb-1" style={{ color: C.ink }}>{label}</div>
            {list.length ? <Items list={list} admin={admin} onChange={onChange} /> : <div className="text-xs" style={{ color: C.mute }}>None yet.</div>}
            {admin && <AddItem meetingId={m.id} kind={k} onAdded={onChange} />}
          </div>
        );
      })}
      {admin && (
        <div className="flex flex-wrap gap-3 items-center mt-4 pt-3 text-sm" style={{ borderTop: `1px solid ${C.rule}` }}>
          <button onClick={share} className="px-3 py-1 rounded font-semibold" style={m.client_visible ? { border: `1px solid ${C.rule}`, background: "#fff" } : btn}>{m.client_visible ? "Unshare" : "Share with client"}</button>
          <button onClick={copy} className="underline" style={{ color: C.deep }}>{copied ? "Copied, paste in WhatsApp" : "Copy for WhatsApp"}</button>
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
  const { rows } = useRows(() => supabase.from("meeting_items").select("id,project_id,body,owner,due_on").eq("kind", "action").eq("status", "open").order("due_on", { nullsFirst: false }), []);
  const name = Object.fromEntries(projects.map((p) => [p.id, p]));
  return (
    <Card>
      <div className="font-semibold text-sm mb-2" style={{ color: C.deep }}>Open action points</div>
      {!rows?.length ? <div className="text-sm" style={{ color: C.mute }}>None. Add them after each call under the project’s Meetings tab.</div> : (
        <ul className="text-sm grid gap-1">
          {rows.slice(0, 8).map((i) => (
            <li key={i.id}><b>{name[i.project_id]?.name}</b>: {i.body} <span className="text-xs" style={{ color: C.mute }}>{OWNER_ADMIN[i.owner] || ""}{i.due_on ? ` · by ${fmtDate(i.due_on)}` : ""}</span></li>
          ))}
          {rows.length > 8 && <li className="text-xs" style={{ color: C.mute }}>and {rows.length - 8} more</li>}
        </ul>
      )}
    </Card>
  );
}

