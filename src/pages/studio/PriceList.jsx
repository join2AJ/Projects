/* Admin: the price list. Standard prices (service_notes.std_price), factors and tips are private; clients see only what a service covers. */
import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase.js";
import { useRows } from "../../lib/useRows.js";
import { per, range, notesOf, stdOf } from "../../components/pricing.jsx";
import { C, inr, Chip, H1, P, Box, Card } from "../../components/ui.jsx";

const input = "mt-1 w-full px-2 py-1.5 rounded text-sm";
const fs = { border: `1px solid ${C.rule}`, background: "#fff" };
const F = ({ label, children, wide }) => <label className={`block text-xs mb-3 ${wide ? "md:col-span-2" : ""}`} style={{ color: C.mute }}>{label}{children}</label>;
const num = (v) => (v === "" || v == null ? null : Number(v));

function ServiceForm({ s, onDone, onCancel }) {
  const isNew = !s.id;
  const [f, setF] = useState({ ...s, std_price: stdOf(s) ?? "", factors: notesOf(s).factors || "", tips: notesOf(s).tips || "" });
  const [msg, setMsg] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const save = async (e) => {
    e.preventDefault();
    const id = isNew ? f.key.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : s.id;
    if (!id) return setMsg("Give the service a short code, e.g. social-media.");
    const body = {
      id, name: f.name, kind: f.kind, avg_price: 0, market_low: num(f.market_low), market_high: num(f.market_high),
      min_months: num(f.min_months), sort: Number(f.sort || 0), summary: f.summary || null, includes: f.includes || null,
      why: f.why || null, active: !!f.active, updated_at: new Date().toISOString(),
    };
    const r1 = await supabase.from("services").upsert(body);
    if (r1.error) return setMsg(r1.error.message);
    const r2 = await supabase.from("service_notes").upsert({ service_id: id, std_price: num(f.std_price), factors: f.factors || null, tips: f.tips || null });
    if (r2.error) return setMsg(r2.error.message);
    onDone();
  };
  return (
    <form onSubmit={save} className="p-4 mb-4" style={{ background: C.card, border: `1px solid ${C.deep}`, borderRadius: 4 }}>
      <div className="grid md:grid-cols-2 gap-x-4">
        <F label="Service name"><input id="s-name" required value={f.name || ""} onChange={set("name")} className={input} style={fs} /></F>
        {isNew ? <F label="Short code (used inside the system)"><input id="s-key" required value={f.key || ""} onChange={set("key")} placeholder="e.g. social-media" className={input} style={fs} /></F>
          : <F label="Short code"><div className="mt-2 text-sm">{s.id}</div></F>}
        <F label="Billing">
          <select id="s-kind" value={f.kind} onChange={set("kind")} className={input} style={fs}><option value="one-time">One-time</option><option value="monthly">Monthly</option><option value="hourly">Hourly</option></select>
        </F>
        <F label="Your standard price (₹, ex-GST, private)"><input id="s-avg" type="number" min="0" required value={f.std_price ?? ""} onChange={set("std_price")} className={input} style={fs} /></F>
        <F label="Market: lowest typical (₹)"><input id="s-low" type="number" min="0" value={f.market_low ?? ""} onChange={set("market_low")} className={input} style={fs} /></F>
        <F label="Market: highest typical (₹)"><input id="s-high" type="number" min="0" value={f.market_high ?? ""} onChange={set("market_high")} className={input} style={fs} /></F>
        <F label="Minimum months (monthly services)"><input id="s-min" type="number" min="0" value={f.min_months ?? ""} onChange={set("min_months")} className={input} style={fs} /></F>
        <F label="Order in the list"><input id="s-sort" type="number" value={f.sort ?? 0} onChange={set("sort")} className={input} style={fs} /></F>
        <F label="One-line summary" wide><input id="s-summary" value={f.summary || ""} onChange={set("summary")} className={input} style={fs} /></F>
        <F label="What is included (one per line)" wide><textarea id="s-includes" rows={4} value={f.includes || ""} onChange={set("includes")} className={input} style={fs} /></F>
        <F label="What this covers and why it matters (clients see this)" wide><textarea id="s-why" rows={3} value={f.why || ""} onChange={set("why")} className={input} style={fs} /></F>
        <F label="What changes the price (private)" wide><textarea id="s-factors" rows={2} value={f.factors} onChange={set("factors")} className={input} style={fs} /></F>
        <F label="Your tips for talking about price (private)" wide><textarea id="s-tips" rows={3} value={f.tips} onChange={set("tips")} className={input} style={fs} /></F>
        <label className="flex items-center gap-2 text-sm mb-3"><input type="checkbox" checked={!!f.active} onChange={set("active")} /> Offered (shown on the price list)</label>
      </div>
      <div className="flex gap-2 items-center">
        <button type="submit" className="px-3 py-1 rounded text-sm font-semibold" style={{ background: C.deep, color: "#fff" }}>Save</button>
        <button type="button" onClick={onCancel} className="px-3 py-1 rounded text-sm" style={{ border: `1px solid ${C.rule}`, background: "#fff" }}>Cancel</button>
        {msg && <span className="text-sm" style={{ color: C.bad }}>{msg}</span>}
      </div>
    </form>
  );
}

export default function PriceList() {
  const { rows, reload } = useRows(() => supabase.from("services").select("*, service_notes(factors,tips,std_price)").order("sort"), []);
  const [edit, setEdit] = useState(null);
  const [note, setNote] = useState(null);
  return (
    <div>
      <div className="text-sm mb-1"><Link to="/studio" style={{ color: C.deep }}>← Dashboard</Link></div>
      <div className="flex flex-wrap justify-between items-center gap-2">
        <H1>Price list</H1>
        <button onClick={() => { setNote(null); setEdit({ kind: "monthly", active: true, sort: 100 }); }} className="px-3 py-1 rounded text-sm font-semibold" style={{ background: C.deep, color: "#fff" }}>Add service</button>
      </div>
      <P>Only you see these prices. Each client’s fee is set on their project; they see just that fee and can approve it or propose their own. Clients see what each service includes and why it matters, never the standard price, market range or your tips.</P>
      {note && <Box tone="good">{note}</Box>}
      {edit && <ServiceForm key={edit.id || "new"} s={edit} onCancel={() => setEdit(null)} onDone={() => { setEdit(null); setNote("Saved. Existing client fees are not changed."); reload(); }} />}
      {!rows ? <P>Loading…</P> : (
        <div className="grid gap-3">
          {rows.map((s) => (
            <Card key={s.id}>
              <div className="flex flex-wrap justify-between items-baseline gap-2">
                <span className="font-semibold" style={{ color: C.deep }}>{s.name} {!s.active && <Chip tone="info">not offered</Chip>}</span>
                <span className="text-sm"><b>{stdOf(s) != null ? inr(stdOf(s)) : "–"}</b> {per(s.kind)} · market {range(s)}</span>
              </div>
              {s.why && <div className="text-sm mt-1"><b>Why: </b>{s.why}</div>}
              {notesOf(s).factors && <div className="text-sm mt-1" style={{ color: C.mute }}><b>Price changes with: </b>{notesOf(s).factors}</div>}
              {notesOf(s).tips && <div className="text-sm mt-1" style={{ color: C.mute }}><b>Tip: </b>{notesOf(s).tips}</div>}
              <button className="underline text-xs mt-2" style={{ color: C.deep }} onClick={() => { setNote(null); setEdit(s); }}>Edit</button>
            </Card>
          ))}
        </div>
      )}
      <P style={{ color: C.mute, marginTop: 12 }}>Market ranges are starting estimates for a single clinic in India. Adjust them as you learn what others in your area charge.</P>
    </div>
  );
}
