/* Admin: everyone who can sign in, and the clinics (clients) they belong to. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase.js";
import { useRows } from "../../lib/useRows.js";
import { useAuth } from "../../lib/auth.jsx";
import { FIELDS } from "../../lib/schema.js";
import { fmtDateTime } from "../../lib/money.js";
import Editor from "../../components/Editor.jsx";
import { C, inr, Chip, H1, H2, P, Box, T, Card, Tabs } from "../../components/ui.jsx";

/* Calls the admin-users Edge Function and turns its errors into plain messages. */
async function adminCall(body) {
  const { data, error } = await supabase.functions.invoke("admin-users", { body });
  if (error) {
    let msg = error.message;
    try { msg = (await error.context.json()).error || msg; } catch { /* keep the generic message */ }
    throw new Error(msg);
  }
  return data;
}

const input = "mt-1 w-full px-2 py-1.5 rounded text-sm";
const fs = { border: `1px solid ${C.rule}`, background: "#fff" };
const F = ({ label, children, wide }) => <label className={`block text-xs mb-3 ${wide ? "md:col-span-2" : ""}`} style={{ color: C.mute }}>{label}{children}</label>;
const blank = { full_name: "", login: "", password: "", is_owner: false, status: "active", phone: "", contact_email: "", client_id: "", notes: "", project_ids: [] };

function UserForm({ user, clients, projects, onDone, onCancel }) {
  const isNew = !user.id;
  const [u, setU] = useState({ ...blank, ...user, password: "" });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setU({ ...u, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const toggleProject = (id) => setU({ ...u, project_ids: u.project_ids.includes(id) ? u.project_ids.filter((x) => x !== id) : [...u.project_ids, id] });
  // When a clinic is picked, offer its projects first
  const sorted = [...projects].sort((a, b) => (b.client_id === u.client_id) - (a.client_id === u.client_id) || a.name.localeCompare(b.name));

  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const body = {
      action: isNew ? "create" : "update", id: user.id,
      full_name: u.full_name, phone: u.phone, contact_email: u.contact_email, client_id: u.client_id || null,
      notes: u.notes, status: u.status, is_owner: !!u.is_owner, project_ids: u.project_ids,
      ...(isNew ? { login: u.login } : {}), ...(u.password ? { password: u.password } : {}),
    };
    try { await adminCall(body); onDone(isNew ? `Created. They sign in as “${u.login.trim().toLowerCase()}” with the password you set.` : "Saved"); }
    catch (err) { setMsg(err.message); }
    setBusy(false);
  };

  return (
    <form onSubmit={save} className="p-4 mb-4" style={{ background: C.card, border: `1px solid ${C.deep}`, borderRadius: 4 }}>
      <div className="font-semibold text-sm mb-3" style={{ color: C.deep }}>{isNew ? "New user" : `Edit ${user.full_name || user.login}`}</div>
      <div className="grid md:grid-cols-2 gap-x-4">
        <F label="Full name"><input id="u-name" required value={u.full_name || ""} onChange={set("full_name")} className={input} style={fs} /></F>
        {isNew
          ? <F label="Username (or an email) they sign in with"><input id="u-login" required autoCapitalize="none" value={u.login} onChange={set("login")} placeholder="e.g. rajveer" className={input} style={fs} /></F>
          : <F label="Signs in as"><div className="mt-2 text-sm" style={{ color: C.ink }}>{user.login}</div></F>}
        <F label={isNew ? "Password (at least 8 characters)" : "New password (leave empty to keep)"}>
          <input id="u-password" type="text" autoComplete="off" required={isNew} minLength={8} value={u.password} onChange={set("password")} className={input} style={fs} />
        </F>
        <F label="Status">
          <select id="u-status" value={u.status} onChange={set("status")} className={input} style={fs}>
            <option value="active">Active: can sign in</option><option value="disabled">Disabled: cannot sign in</option>
          </select>
        </F>
        <F label="Role">
          <select id="u-role" value={u.is_owner ? "admin" : "client"} onChange={(e) => setU({ ...u, is_owner: e.target.value === "admin" })} className={input} style={fs}>
            <option value="client">Client: sees only their projects</option><option value="admin">Admin: sees and edits everything</option>
          </select>
        </F>
        <F label="Clinic / client">
          <select id="u-client" value={u.client_id || ""} onChange={set("client_id")} className={input} style={fs}>
            <option value="">—</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}{c.org ? `, ${c.org}` : ""}</option>)}
          </select>
        </F>
        <F label="Phone"><input id="u-phone" value={u.phone || ""} onChange={set("phone")} className={input} style={fs} /></F>
        <F label="Contact email"><input id="u-email" type="email" value={u.contact_email || ""} onChange={set("contact_email")} className={input} style={fs} /></F>
        <F label="Notes (private)" wide><textarea id="u-notes" rows={2} value={u.notes || ""} onChange={set("notes")} className={input} style={fs} /></F>
      </div>
      {!u.is_owner && (
        <fieldset className="mb-3">
          <legend className="text-xs mb-1" style={{ color: C.mute }}>Projects they can see</legend>
          <div className="flex flex-wrap gap-3">
            {sorted.map((p) => (
              <label key={p.id} className="text-sm flex items-center gap-1">
                <input type="checkbox" checked={u.project_ids.includes(p.id)} onChange={() => toggleProject(p.id)} /> {p.name}
              </label>
            ))}
            {!projects.length && <span className="text-sm" style={{ color: C.mute }}>No projects yet.</span>}
          </div>
        </fieldset>
      )}
      <div className="flex gap-2 items-center">
        <button type="submit" disabled={busy} className="px-3 py-1 rounded text-sm font-semibold" style={{ background: C.deep, color: "#fff" }}>{busy ? "Saving…" : isNew ? "Create user" : "Save"}</button>
        <button type="button" onClick={onCancel} className="px-3 py-1 rounded text-sm" style={{ border: `1px solid ${C.rule}`, background: "#fff" }}>Cancel</button>
        {msg && <span className="text-sm" style={{ color: C.bad }}>{msg}</span>}
      </div>
    </form>
  );
}

function ServicesFor({ user, projects, services }) {
  const mine = services.filter((s) => user.project_ids.includes(s.project_id));
  const pname = Object.fromEntries(projects.map((p) => [p.id, p]));
  if (!mine.length) return <P style={{ color: C.mute }}>No services on their projects yet.</P>;
  const monthly = mine.filter((s) => s.kind === "monthly" && !["Declined", "Stopped"].includes(s.status)).reduce((a, s) => a + Number(s.price), 0);
  const once = mine.filter((s) => s.kind === "one-time" && s.status !== "Declined").reduce((a, s) => a + Number(s.price), 0);
  return (
    <div>
      <T head={["Service", "Project", "Billing", "Fee (ex-GST)", "Status"]} right={[3]} rows={mine.map((s) => [
        s.name, <Link key="p" to={`/studio/p/${pname[s.project_id]?.slug}`} className="underline" style={{ color: C.deep }}>{pname[s.project_id]?.name}</Link>,
        s.kind, inr(s.price), s.status,
      ])} />
      <P style={{ color: C.mute }}>One-time {inr(once)} · monthly {inr(monthly)}. Change fees on the project’s Overview tab.</P>
    </div>
  );
}

function People() {
  const { session } = useAuth();
  const [users, setUsers] = useState(null);
  const [err, setErr] = useState(null);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [note, setNote] = useState(null);
  const clients = useRows(() => supabase.from("clients").select("id,name,org").order("name"), []);
  const projects = useRows(() => supabase.from("projects").select("id,slug,name,client_id").order("name"), []);
  const services = useRows(() => supabase.from("project_services").select("*").order("created_at"), []);

  const load = useCallback(async () => {
    try { setUsers(await adminCall({ action: "list" })); setErr(null); } catch (e) { setErr(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const remove = async (u) => {
    try { await adminCall({ action: "delete", id: u.id }); setNote(["good", `Deleted ${u.login}`]); load(); }
    catch (e) { setNote(["bad", e.message]); }
    setConfirm(null);
  };
  const cname = useMemo(() => Object.fromEntries((clients.rows || []).map((c) => [c.id, c.name])), [clients.rows]);
  const pname = useMemo(() => Object.fromEntries((projects.rows || []).map((p) => [p.id, p.name])), [projects.rows]);

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
        <P style={{ marginBottom: 0 }}>Only you can add people. Give each person their username and password yourself.</P>
        <button onClick={() => { setNote(null); setEditing({ ...blank }); }} className="px-3 py-1 rounded text-sm font-semibold" style={{ background: C.deep, color: "#fff" }}>Add user</button>
      </div>
      {err && <Box tone="bad" title="Could not load users">{err}</Box>}
      {note && <Box tone={note[0]}>{note[1]}</Box>}
      {editing && clients.rows && projects.rows && (
        <UserForm key={editing.id || "new"} user={editing} clients={clients.rows} projects={projects.rows}
          onCancel={() => setEditing(null)} onDone={(m) => { setEditing(null); setNote(["good", m]); load(); }} />
      )}
      {!users ? <P>Loading…</P> : (
        <T head={["Name", "Signs in as", "Role", "Status", "Clinic", "Projects", "Last sign-in", ""]} rows={users
          .sort((a, b) => (b.is_owner - a.is_owner) || (a.full_name || a.login).localeCompare(b.full_name || b.login))
          .map((u) => [
            <button key="n" className="underline text-left" style={{ color: C.deep }} onClick={() => setOpen(open === u.id ? null : u.id)}>{u.full_name || "—"}</button>,
            u.login, u.is_owner ? <Chip key="r" tone="info">Admin</Chip> : "Client",
            <Chip key="s" tone={u.status === "active" ? "good" : "bad"}>{u.status === "active" ? "Active" : "Disabled"}</Chip>,
            cname[u.client_id] || "–", u.is_owner ? "All" : u.project_ids.map((id) => pname[id]).filter(Boolean).join(", ") || "–",
            u.last_sign_in_at ? fmtDateTime(u.last_sign_in_at) : "Never",
            <span key="a" className="text-xs whitespace-nowrap">
              <button className="underline mr-2" style={{ color: C.deep }} onClick={() => { setNote(null); setEditing(u); }}>Edit</button>
              {u.id === session.user.id ? <span style={{ color: C.mute }}>you</span>
                : confirm === u.id ? <button className="underline" style={{ color: C.bad }} onClick={() => remove(u)}>Confirm delete</button>
                : <button className="underline" style={{ color: C.mute }} onClick={() => setConfirm(u.id)}>Delete</button>}
            </span>,
          ])} />
      )}
      {open && users && services.rows && projects.rows && (() => {
        const u = users.find((x) => x.id === open);
        return u && (
          <Card className="mb-4">
            <div className="font-semibold text-sm mb-1" style={{ color: C.deep }}>{u.full_name || u.login}</div>
            <div className="text-sm mb-2" style={{ color: C.mute }}>
              {[u.phone, u.contact_email, cname[u.client_id]].filter(Boolean).join(" · ") || "No contact details yet."}
              {u.notes && <div style={{ color: C.ink }}>{u.notes}</div>}
            </div>
            <H2>Services and pricing</H2>
            {u.is_owner ? <P style={{ color: C.mute }}>Admin account.</P> : <ServicesFor user={u} projects={projects.rows} services={services.rows} />}
          </Card>
        );
      })()}
    </div>
  );
}

function Clinics() {
  const projects = useRows(() => supabase.from("projects").select("client_id"), []);
  const count = (id) => (projects.rows || []).filter((p) => p.client_id === id).length;
  return (
    <div>
      <P>Clinics and businesses you work for. Link people to a clinic on the People tab, and projects on each project’s Overview.</P>
      <Editor table="clients" fields={FIELDS.clients} order={["name", true]} defaults={{ status: "active" }}
        columns={[["Name", (r) => <b key="n">{r.name}</b>], ["Clinic", (r) => r.org || "–"], ["Status", (r) => r.status], ["Contact", (r) => [r.phone, r.email].filter(Boolean).join(" · ") || "–"], ["City", (r) => r.city || "–"], ["Projects", (r) => count(r.id)]]} />
    </div>
  );
}

export default function Users() {
  const [tab, setTab] = useState("people");
  return (
    <div>
      <div className="text-sm mb-1"><Link to="/studio" style={{ color: C.deep }}>← Dashboard</Link></div>
      <H1>People and clinics</H1>
      <Tabs label="Users sections" tabs={[["people", "People"], ["clinics", "Clinics"]]} value={tab} onChange={setTab} />
      {tab === "people" ? <People /> : <Clinics />}
    </div>
  );
}
