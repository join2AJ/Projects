/*
 * Promotion plan: every channel with its strategies, status, priority, monthly budget and how success is measured.
 * Private until shared point by point; the client sees only the shared points, read-only.
 */
import { useState } from "react";
import { supabase } from "../lib/supabase.js";
import { useRows } from "../lib/useRows.js";
import { fmtDate } from "../lib/money.js";
import { PRIORITY } from "./meetings.jsx";
import { C, inr, Chip, H2, P, Card } from "./ui.jsx";
import { TagFilter, tagMatch } from "./shared.jsx";

export const CHANNELS = [
  "Google Ads", "Website and landing page", "Google Business Profile and local SEO", "Instagram and Facebook (own page)",
  "Influencers", "Facebook and Instagram ads", "Referral partners", "WhatsApp and follow-up", "Reviews and reputation",
  "Measurement", "Later",
];
const STATUS = { idea: ["Idea", "info"], planned: ["Planned", "warn"], active: ["Running", "good"], paused: ["Paused", "info"], done: ["Done", "good"], dropped: ["Dropped", "info"] };
const OWNER = { me: "Ajay", client: "You", both: "Both" };
const OWNER_ADMIN = { me: "Me", client: "Client", both: "Both" };
const input = "mt-1 w-full px-2 py-1.5 rounded text-sm";
const fs = { border: `1px solid ${C.rule}`, background: "#fff" };
const btn = { background: C.deep, color: "#fff" };
const byPriority = (a, b) => (a.priority ?? 9) - (b.priority ?? 9) || a.sort - b.sort || a.created_at.localeCompare(b.created_at);

function StrategyForm({ item, projectId, channel, onDone }) {
  const [f, setF] = useState(item || { channel: channel || CHANNELS[0], title: "", details: "", status: "idea", priority: "", budget_month: "", kpi: "", owner: "me", start_on: "", client_visible: false });
  const [msg, setMsg] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const save = async (e) => {
    e.preventDefault();
    const body = {
      project_id: projectId, channel: f.channel.trim(), title: f.title, details: f.details || null, status: f.status,
      priority: f.priority ? Number(f.priority) : null, budget_month: f.budget_month === "" || f.budget_month == null ? null : Number(f.budget_month),
      kpi: f.kpi || null, owner: f.owner || null, start_on: f.start_on || null, client_visible: !!f.client_visible, updated_at: new Date().toISOString(),
    };
    const { error } = item ? await supabase.from("strategies").update(body).eq("id", item.id) : await supabase.from("strategies").insert(body);
    if (error) return setMsg(error.message);
    onDone();
  };
  return (
    <form onSubmit={save} className="grid gap-x-3 md:grid-cols-6 p-3 my-2" style={{ background: C.bg, borderRadius: 4 }}>
      <label className="block text-xs mb-2 md:col-span-2" style={{ color: C.mute }}>Channel
        <input name="channel" list="channels" required value={f.channel} onChange={set("channel")} className={input} style={fs} />
        <datalist id="channels">{CHANNELS.map((c) => <option key={c} value={c} />)}</datalist>
      </label>
      <label className="block text-xs mb-2 md:col-span-4" style={{ color: C.mute }}>Strategy<input name="title" required maxLength={300} value={f.title} onChange={set("title")} className={input} style={fs} /></label>
      <label className="block text-xs mb-2 md:col-span-6" style={{ color: C.mute }}>Details (how, what exactly)<textarea name="details" rows={3} maxLength={4000} value={f.details || ""} onChange={set("details")} className={input} style={fs} /></label>
      <label className="block text-xs mb-2" style={{ color: C.mute }}>Status
        <select name="status" value={f.status} onChange={set("status")} className={input} style={fs}>{Object.entries(STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select>
      </label>
      <label className="block text-xs mb-2" style={{ color: C.mute }}>Priority
        <select name="priority" value={f.priority || ""} onChange={set("priority")} className={input} style={fs}><option value="">—</option>{Object.entries(PRIORITY).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select>
      </label>
      <label className="block text-xs mb-2" style={{ color: C.mute }}>Budget / month (₹)<input name="budget_month" type="number" min="0" value={f.budget_month ?? ""} onChange={set("budget_month")} className={input} style={fs} /></label>
      <label className="block text-xs mb-2" style={{ color: C.mute }}>Who
        <select name="owner" value={f.owner || ""} onChange={set("owner")} className={input} style={fs}><option value="">—</option><option value="me">Me</option><option value="client">Client</option><option value="both">Both</option></select>
      </label>
      <label className="block text-xs mb-2 md:col-span-2" style={{ color: C.mute }}>Start<input name="start_on" type="date" value={f.start_on || ""} onChange={set("start_on")} className={input} style={fs} /></label>
      <label className="block text-xs mb-2 md:col-span-4" style={{ color: C.mute }}>How we measure success<input name="kpi" maxLength={500} value={f.kpi || ""} onChange={set("kpi")} placeholder="e.g. calls per week, cost per call" className={input} style={fs} /></label>
      <label className="flex items-center gap-2 text-sm md:col-span-2 pt-4"><input type="checkbox" checked={!!f.client_visible} onChange={set("client_visible")} /> Share with client</label>
      <div className="flex gap-2 items-center md:col-span-6">
        <button type="submit" className="px-3 py-1 rounded text-sm font-semibold" style={btn}>Save</button>
        <button type="button" className="text-xs underline" onClick={onDone}>Cancel</button>
        {msg && <span className="text-xs" style={{ color: C.bad }}>{msg}</span>}
      </div>
    </form>
  );
}

function Strategy({ s, admin, onChange }) {
  const [edit, setEdit] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const set = async (patch) => { await supabase.from("strategies").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", s.id); onChange(); };
  const remove = async () => { await supabase.from("strategies").delete().eq("id", s.id); onChange(); };
  if (edit) return <StrategyForm item={s} projectId={s.project_id} onDone={() => { setEdit(false); onChange(); }} />;
  const closed = ["done", "dropped"].includes(s.status);
  return (
    <li className="py-2" style={{ borderBottom: `1px solid ${C.rule}`, opacity: s.status === "dropped" ? 0.5 : 1 }}>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-semibold text-sm flex-1" style={{ minWidth: 0 }}>{s.title}</span>
        {s.priority && !closed && <Chip tone={PRIORITY[s.priority][1]}>{PRIORITY[s.priority][0]}</Chip>}
        <Chip tone={STATUS[s.status][1]}>{STATUS[s.status][0]}</Chip>
      </div>
      {s.details && <div className="text-sm mt-1" style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{s.details}</div>}
      <div className="text-xs mt-1" style={{ color: C.mute }}>
        {[s.owner && `Who: ${(admin ? OWNER_ADMIN : OWNER)[s.owner]}`, s.budget_month != null && `Budget: ${inr(s.budget_month)} / month`, s.start_on && `From ${fmtDate(s.start_on)}`, s.kpi && `Measured by: ${s.kpi}`].filter(Boolean).join(" · ")}
      </div>
      {admin && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 items-center text-xs mt-1">
          <button onClick={() => set({ client_visible: !s.client_visible })} aria-pressed={s.client_visible}
            className="px-1.5 py-0.5 rounded font-semibold" style={s.client_visible ? { background: C.goodBg, color: C.good } : { border: `1px solid ${C.rule}`, color: C.mute }}>
            {s.client_visible ? "✓ Shared" : "Share"}
          </button>
          <label className="flex items-center gap-1" style={{ color: C.mute }}>Status
            <select aria-label={`Status of ${s.title}`} value={s.status} onChange={(e) => set({ status: e.target.value })} className="px-1 py-0.5 rounded" style={fs}>
              {Object.entries(STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          <button className="underline" style={{ color: C.deep }} onClick={() => setEdit(true)}>Edit</button>
          {confirm ? <button className="underline" style={{ color: C.bad }} onClick={remove}>Confirm delete</button>
            : <button className="underline" style={{ color: C.mute }} onClick={() => setConfirm(true)}>Delete</button>}
        </div>
      )}
    </li>
  );
}

export function PromotionPlan({ projectId, admin = false, cap = null }) {
  const { rows, reload } = useRows(() => { const q = supabase.from("strategies").select("*").eq("project_id", projectId); return admin ? q : q.eq("client_visible", true); }, [projectId, admin]);
  const [adding, setAdding] = useState(null); // channel name or ""
  const [show, setShow] = useState("");
  if (!rows) return <P>Loading…</P>;
  const channels = [...CHANNELS, ...new Set(rows.map((r) => r.channel).filter((c) => !CHANNELS.includes(c)))].filter((c) => rows.some((r) => r.channel === c));
  const live = rows.filter((r) => ["active", "planned"].includes(r.status) && r.budget_month);
  const spend = live.reduce((a, r) => a + Number(r.budget_month), 0);
  const running = rows.filter((r) => r.status === "active").length;
  const shared = rows.filter((r) => r.client_visible).length;
  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-2">
        <P style={{ marginBottom: 0 }}>{admin
          ? "Every way we promote the clinic: what we do on each channel, its status, budget and how we measure it. Points stay private until you share them."
          : "How we are promoting your clinic, channel by channel: what is running now, what is planned next, and how we measure it."}</P>
        {admin && <span className="flex items-center gap-3"><TagFilter value={show} onChange={setShow} /><button onClick={() => setAdding("")} className="px-3 py-1 rounded text-sm font-semibold" style={btn}>Add strategy</button></span>}
      </div>
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 my-4">
        {[["Channels", channels.length], ["Running now", running], ["Planned ad spend", `${inr(spend)} / month`], ...(admin ? [["Shared with client", `${shared} of ${rows.length}`]] : [])].map(([l, v]) => (
          <Card key={l}><div className="text-xs uppercase tracking-wide" style={{ color: C.mute }}>{l}</div><div className="text-xl font-semibold" style={{ color: C.deep, fontVariantNumeric: "tabular-nums" }}>{v}</div></Card>
        ))}
      </div>
      {cap != null && <P style={{ color: spend > Number(cap) ? C.bad : C.mute }}>{spend > Number(cap) ? "Planned ad spend is above" : "Planned ad spend is within"} the agreed limit of {inr(cap)} a month (including GST).</P>}
      {adding === "" && <StrategyForm projectId={projectId} onDone={() => { setAdding(null); reload(); }} />}
      {!rows.length && <P style={{ color: C.mute }}>{admin ? "No strategies yet." : "Nothing shared yet."}</P>}
      {channels.map((c) => {
        const list = rows.filter((r) => r.channel === c && tagMatch(show, r)).sort(byPriority);
        if (!list.length && show) return null;
        return (
          <Card key={c} className="mb-4">
            <div className="flex flex-wrap justify-between items-baseline gap-2">
              <H2>{c}</H2>
              {admin && <button className="text-xs underline" style={{ color: C.deep }} onClick={() => setAdding(c)}>+ Add to {c}</button>}
            </div>
            {adding === c && <StrategyForm projectId={projectId} channel={c} onDone={() => { setAdding(null); reload(); }} />}
            <ul>{list.map((s) => <Strategy key={s.id} s={s} admin={admin} onChange={reload} />)}</ul>
          </Card>
        );
      })}
    </div>
  );
}
