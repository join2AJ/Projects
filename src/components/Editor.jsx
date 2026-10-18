/*
 * One table editor for every project list in the studio: updates, issues, invoices, expenses, time, metrics,
 * members, services, requests. Give it a table name, the fields, and the rows' project.
 */
import { useState } from "react";
import { supabase } from "../lib/supabase.js";
import { useRows } from "../lib/useRows.js";
import { C, T, Box } from "./ui.jsx";
import { fmtDateTime } from "../lib/money.js";

const input = "mt-1 w-full px-2 py-1.5 rounded text-sm";
const inputStyle = { border: `1px solid ${C.rule}`, color: C.ink, background: "#fff" };

// datetime-local wants "YYYY-MM-DDTHH:mm" in local time
const toLocal = (v) => (v ? new Date(new Date(v).getTime() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16) : "");

function Field({ f, value, onChange }) {
  const id = `f-${f.key}`;
  const common = { id, name: f.key, className: input, style: inputStyle, required: f.required };
  let el;
  if (f.type === "textarea") el = <textarea {...common} rows={3} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
  else if (f.type === "select") el = (
    <select {...common} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
      {!f.required && <option value="">—</option>}
      {f.options.map((o) => (Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o}>{o}</option>))}
    </select>
  );
  else if (f.type === "bool") return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm mb-3" style={{ color: C.ink }}>
      <input id={id} type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} /> {f.label}
    </label>
  );
  else if (f.type === "datetime") el = <input {...common} type="datetime-local" value={toLocal(value)} onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)} />;
  else el = <input {...common} type={f.type || "text"} step={f.type === "number" ? "any" : undefined} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
  return <label htmlFor={id} className={`block text-xs mb-3 ${f.type === "textarea" ? "md:col-span-2" : ""}`} style={{ color: C.mute }}>{f.label}{el}</label>;
}

function clean(fields, row) {
  const out = {};
  for (const f of fields) {
    if (f.readOnly) continue;
    let v = row[f.key];
    if (v === "" || v === undefined) v = f.type === "bool" ? false : null;
    if (f.type === "number" && v != null) v = Number(v);
    if (f.lower && typeof v === "string") v = v.trim().toLowerCase();
    out[f.key] = v;
  }
  return out;
}

export default function Editor({ table, projectId, fields, order = ["created_at", false], defaults = {}, columns, title, empty, extra, select = "*", canAdd = true }) {
  const { rows, error, reload } = useRows(
    () => {
      let q = supabase.from(table).select(select);
      if (projectId !== undefined) q = projectId === null ? q.is("project_id", null) : q.eq("project_id", projectId);
      return q.order(order[0], { ascending: order[1] });
    },
    [table, projectId]
  );
  const [editing, setEditing] = useState(null); // row object, or {} for new
  const [confirm, setConfirm] = useState(null);
  const [msg, setMsg] = useState(null);

  const save = async (e) => {
    e.preventDefault();
    const body = clean(fields, editing);
    if (projectId) body.project_id = projectId;
    let q;
    if (!editing.id) q = supabase.from(table).insert(body);
    else if (table === "project_members") q = supabase.from(table).update(body).eq("project_id", projectId).eq("email", editing.id);
    else q = supabase.from(table).update(body).eq("id", editing.id);
    const { error } = await q.select();
    if (error) return setMsg(["bad", error.message]);
    setMsg(["good", "Saved"]);
    setEditing(null);
    reload();
  };
  const remove = async (row) => {
    const q = supabase.from(table).delete();
    const { error } = table === "project_members" ? await q.eq("project_id", projectId).eq("email", row.email) : await q.eq("id", row.id);
    setConfirm(null);
    if (error) return setMsg(["bad", error.message]);
    reload();
  };

  const shown = columns || fields.filter((f) => !f.hidden).slice(0, 5).map((f) => [f.label, (r) => fmt(f, r[f.key])]);
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        {title && <h3 className="font-semibold" style={{ color: C.deep }}>{title}</h3>}
        {canAdd && <button onClick={() => { setMsg(null); setEditing({ ...defaults }); }} className="px-3 py-1 rounded text-sm font-semibold" style={{ background: C.deep, color: "#fff" }}>Add</button>}
      </div>
      {error && <Box tone="bad" title="Could not load">{error.message}</Box>}
      {msg && <div className="text-xs mb-2" style={{ color: C[msg[0]] }}>{msg[1]}</div>}
      {editing && (
        <form onSubmit={save} className="p-4 mb-3" style={{ background: C.card, border: `1px solid ${C.deep}`, borderRadius: 4 }}>
          <div className="grid md:grid-cols-2 gap-x-4">
            {fields.filter((f) => !f.readOnly && !(f.createOnly && editing.id)).map((f) => (
              <Field key={f.key} f={f} value={editing[f.key]} onChange={(v) => setEditing({ ...editing, [f.key]: v })} />
            ))}
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-3 py-1 rounded text-sm font-semibold" style={{ background: C.deep, color: "#fff" }}>Save</button>
            <button type="button" onClick={() => setEditing(null)} className="px-3 py-1 rounded text-sm" style={{ border: `1px solid ${C.rule}`, background: "#fff" }}>Cancel</button>
          </div>
        </form>
      )}
      {rows === null ? <div className="text-sm" style={{ color: C.mute }}>Loading…</div>
        : rows.length === 0 ? <div className="text-sm" style={{ color: C.mute }}>{empty || "Nothing yet."}</div>
        : <T head={[...shown.map((c) => c[0]), ""]} rows={rows.map((r) => [
            ...shown.map((c) => c[1](r)),
            <span key="a" className="whitespace-nowrap text-xs">
              {extra && extra(r, reload)}
              <button className="mr-2 underline" style={{ color: C.deep }} onClick={() => { setMsg(null); setEditing({ ...r, id: r.id ?? r.email }); }}>Edit</button>
              {confirm === (r.id ?? r.email)
                ? <button className="underline" style={{ color: C.bad }} onClick={() => remove(r)}>Confirm delete</button>
                : <button className="underline" style={{ color: C.mute }} onClick={() => setConfirm(r.id ?? r.email)}>Delete</button>}
            </span>,
          ])} />}
    </div>
  );
}

export function fmt(f, v) {
  if (v == null || v === "") return "–";
  if (f.type === "bool") return v ? "Yes" : "No";
  if (f.type === "number" && f.money) return "₹" + Number(v).toLocaleString("en-IN");
  if (f.type === "datetime") return fmtDateTime(v);
  if (f.type === "select" && Array.isArray(f.options[0])) return (f.options.find((o) => o[0] === v) || [, v])[1];
  if (f.type === "textarea") return String(v).length > 140 ? String(v).slice(0, 140) + "…" : v;
  return String(v);
}
