/*
 * Prices: the price list (services + private service_notes), each client's fees, and how they look to the client.
 * A client's fee is project_services.price. The standard price and any discount are admin-only (fee_private,
 * service_notes.std_price): the client sees just their fee, and can approve it or propose their own.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase.js";
import { useRows } from "../lib/useRows.js";
import { fmtDateTime } from "../lib/money.js";
import { C, inr, Chip, H2, P, Box, T, Card } from "./ui.jsx";

export const per = (kind) => (kind === "monthly" ? "/ month" : kind === "hourly" ? "/ hour" : "one-time");
const one = (x) => (Array.isArray(x) ? x[0] : x) || {};
export const notesOf = (s) => one(s?.service_notes);
export const stdOf = (s) => notesOf(s).std_price;
export const discountOf = (s, priv) => (priv?.list_price != null && Number(priv.list_price) > Number(s.price) ? Number(priv.list_price) - Number(s.price) : 0);
export const pctOf = (s, priv) => (discountOf(s, priv) && Number(priv.list_price) ? Math.round((discountOf(s, priv) / Number(priv.list_price)) * 100) : 0);
export const range = (s) => (s.market_low != null && s.market_high != null ? `${inr(s.market_low)}–${inr(s.market_high)}` : "–");
const input = "mt-1 w-full px-2 py-1.5 rounded text-sm";
const fs = { border: `1px solid ${C.rule}`, background: "#fff" };
const F = ({ label, children, wide }) => <label className={`block text-xs mb-3 ${wide ? "md:col-span-2" : ""}`} style={{ color: C.mute }}>{label}{children}</label>;

/* Market position of a price: below, inside or above the usual range. */
function Position({ price, s }) {
  if (s?.market_low == null || s?.market_high == null) return null;
  const p = Number(price);
  if (p < Number(s.market_low)) return <Chip tone="warn">below market</Chip>;
  if (p > Number(s.market_high)) return <Chip tone="warn">above market</Chip>;
  return <Chip tone="good">within market</Chip>;
}

/* ───────── admin: one client's fees, with discount calculator ───────── */
function ClientSays({ r }) {
  if (!r.client_response) return <span className="text-xs" style={{ color: C.mute }}>No answer yet</span>;
  if (r.client_response === "approved") return <span><Chip tone="good">Approved</Chip>{r.client_note ? <div className="text-xs">{r.client_note}</div> : null}</span>;
  return (
    <span><Chip tone="warn">Proposes {inr(r.client_offer)}</Chip>
      {r.client_note ? <div className="text-xs">{r.client_note}</div> : null}
      <div className="text-xs" style={{ color: C.mute }}>{fmtDateTime(r.client_response_at)}</div>
    </span>
  );
}

export function FeesEditor({ projectId }) {
  const fees = useRows(() => supabase.from("project_services").select("*, fee_private(list_price,discount_note,hours_month)").eq("project_id", projectId).order("created_at"), [projectId]);
  const cat = useRows(() => supabase.from("services").select("*, service_notes(factors,tips,std_price)").order("sort"), []);
  const [edit, setEdit] = useState(null);
  const [msg, setMsg] = useState(null);
  const svc = (key) => (cat.rows || []).find((c) => c.id === key);

  const pick = (key) => {
    const s = svc(key);
    setEdit((e) => ({ ...e, service_key: key, ...(s ? { name: s.name, kind: s.kind, list_price: stdOf(s) ?? "", price: stdOf(s) ?? "" } : {}) }));
  };
  const setPct = (pct) => setEdit((e) => ({ ...e, price: Math.max(0, Math.round(Number(e.list_price || 0) * (1 - Number(pct || 0) / 100))) }));
  const open = (r) => { setMsg(null); setEdit({ ...r, list_price: one(r.fee_private).list_price ?? "", discount_note: one(r.fee_private).discount_note || "", hours_month: one(r.fee_private).hours_month ?? "" }); };

  const save = async (ev) => {
    ev.preventDefault();
    const body = {
      project_id: projectId, service_key: edit.service_key, name: edit.name, kind: edit.kind,
      price: Number(edit.price), status: edit.status, progress: edit.kind === "one-time" && edit.progress !== "" && edit.progress != null ? Math.max(0, Math.min(100, Number(edit.progress))) : null, start_on: edit.start_on || null, note: edit.note || null, client_visible: !!edit.client_visible,
    };
    // A new fee asks the client again
    if (edit.id && Number(edit.price) !== Number(fees.rows.find((r) => r.id === edit.id)?.price)) Object.assign(body, { client_response: null, client_offer: null, client_note: null, client_response_at: null });
    const res = edit.id ? await supabase.from("project_services").update(body).eq("id", edit.id).select("id").single()
      : await supabase.from("project_services").insert(body).select("id").single();
    if (res.error) return setMsg(["bad", res.error.message]);
    const priv = { project_service_id: res.data.id, list_price: edit.list_price === "" || edit.list_price == null ? null : Number(edit.list_price), discount_note: edit.discount_note || null, hours_month: edit.hours_month === "" || edit.hours_month == null ? null : Number(edit.hours_month), updated_at: new Date().toISOString() };
    const pv = await supabase.from("fee_private").upsert(priv);
    if (pv.error) return setMsg(["bad", pv.error.message]);
    setMsg(["good", "Saved. The client sees the fee straight away and can approve it or propose another."]); setEdit(null); fees.reload();
  };
  const accept = async (r) => {
    const { error } = await supabase.from("project_services").update({ price: r.client_offer, client_response: "approved", status: r.status === "Proposed" ? "Agreed" : r.status }).eq("id", r.id);
    setMsg(error ? ["bad", error.message] : ["good", `Accepted ${inr(r.client_offer)} for ${r.name}.`]); fees.reload();
  };
  const stop = async (r) => {
    const { error } = await supabase.from("project_services").update({ status: "Stopped" }).eq("id", r.id);
    if (error) setMsg(["bad", error.message]); fees.reload();
  };

  const rows = fees.rows || [];
  const live = rows.filter((r) => !["Declined", "Stopped"].includes(r.status));
  const sum = (kind, f) => live.filter((r) => r.kind === kind).reduce((a, r) => a + Number(f(r)), 0);
  const monthly = sum("monthly", (r) => r.price), monthlyList = sum("monthly", (r) => one(r.fee_private).list_price ?? r.price);
  const once = sum("one-time", (r) => r.price), onceList = sum("one-time", (r) => one(r.fee_private).list_price ?? r.price);
  const s = edit && svc(edit.service_key);
  const d = edit ? Math.max(0, Number(edit.list_price || 0) - Number(edit.price || 0)) : 0;

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
        <P style={{ marginBottom: 0 }}>The client sees only their fee, and can approve it or propose their own. Your standard price and discount stay private. Set standard prices on <Link to="/studio/pricing" className="underline" style={{ color: C.deep }}>Price list</Link>.</P>
        <button onClick={() => { setMsg(null); setEdit({ status: "Proposed", client_visible: true, kind: "monthly" }); }} className="px-3 py-1 rounded text-sm font-semibold" style={{ background: C.deep, color: "#fff" }}>Add service</button>
      </div>
      {msg && <div className="text-sm mb-2" style={{ color: C[msg[0]] }}>{msg[1]}</div>}
      {edit && (
        <form onSubmit={save} className="p-4 mb-4" style={{ background: C.card, border: `1px solid ${C.deep}`, borderRadius: 4 }}>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2 grid md:grid-cols-2 gap-x-4">
              <F label="Service">
                <select id="fee-service" required value={edit.service_key || ""} onChange={(e) => pick(e.target.value)} className={input} style={fs}>
                  <option value="" disabled>Choose…</option>
                  {(cat.rows || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  <option value="custom">Custom</option>
                </select>
              </F>
              <F label="Name the client sees"><input id="fee-name" required value={edit.name || ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className={input} style={fs} /></F>
              <F label="Billing">
                <select id="fee-kind" value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value })} className={input} style={fs}>
                  <option value="one-time">One-time</option><option value="monthly">Monthly</option><option value="hourly">Hourly</option>
                </select>
              </F>
              <F label="Standard price (₹, ex-GST, private)"><input id="fee-list" type="number" min="0" value={edit.list_price ?? ""} onChange={(e) => setEdit({ ...edit, list_price: e.target.value })} className={input} style={fs} /></F>
              <F label="Discount % (private)">
                <input id="fee-pct" type="number" min="0" max="100" value={edit.list_price ? Math.round((d / Number(edit.list_price)) * 100) : 0} onChange={(e) => setPct(e.target.value)} className={input} style={fs} />
              </F>
              <F label="Client's fee (₹, ex-GST)"><input id="fee-price" type="number" min="0" required value={edit.price ?? ""} onChange={(e) => setEdit({ ...edit, price: e.target.value })} className={input} style={fs} /></F>
              <F label="Why the discount (private note)" wide>
                <input id="fee-reason" value={edit.discount_note || ""} onChange={(e) => setEdit({ ...edit, discount_note: e.target.value })} placeholder="e.g. First client, referred; long-term work" className={input} style={fs} />
              </F>
              <F label={edit.kind === "monthly" ? "My hours a month (private)" : "My hours in total (private)"}><input id="fee-hours" type="number" min="0" step="0.5" value={edit.hours_month ?? ""} onChange={(e) => setEdit({ ...edit, hours_month: e.target.value })} className={input} style={fs} /></F>
              <F label="Status">
                <select id="fee-status" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })} className={input} style={fs}>
                  {["Proposed", "Agreed", "In progress", "Live", "Done", "Paused", "Stopped", "Declined"].map((o) => <option key={o}>{o}</option>)}
                </select>
              </F>
              {edit.kind === "one-time" && <F label="% complete (client sees a progress bar)"><input id="fee-progress" type="number" min="0" max="100" value={edit.progress ?? ""} onChange={(e) => setEdit({ ...edit, progress: e.target.value })} className={input} style={fs} /></F>}
              <F label="Starts"><input id="fee-start" type="date" value={edit.start_on || ""} onChange={(e) => setEdit({ ...edit, start_on: e.target.value })} className={input} style={fs} /></F>
              <F label="Note for the client" wide><input id="fee-note" value={edit.note || ""} onChange={(e) => setEdit({ ...edit, note: e.target.value })} className={input} style={fs} /></F>
              <label className="flex items-center gap-2 text-sm mb-3"><input type="checkbox" checked={!!edit.client_visible} onChange={(e) => setEdit({ ...edit, client_visible: e.target.checked })} /> Client can see this</label>
            </div>
            <div className="text-sm" style={{ background: C.bg, padding: 12, borderRadius: 4 }}>
              <div className="font-semibold mb-1" style={{ color: C.deep }}>Pricing guide (only you see this)</div>
              {s ? (<>
                <div>Your standard: <b>{stdOf(s) != null ? inr(stdOf(s)) : "–"}</b> {per(s.kind)}</div>
                <div>Market: <b>{range(s)}</b></div>
                <div className="mt-1">This fee: <b>{inr(edit.price || 0)}</b> <Position price={edit.price || 0} s={s} /></div>
                {Number(edit.hours_month) > 0 && <div className="mt-1">Per hour of your time: <b>{inr(Math.round(Number(edit.price || 0) / Number(edit.hours_month)))}</b></div>}
                {d > 0 && <div className="mt-1" style={{ color: C.good }}>Discount {inr(d)} {per(edit.kind)}</div>}
                {edit.client_response === "offer" && <div className="mt-1" style={{ color: C.warn }}>Client proposes {inr(edit.client_offer)}</div>}
                {notesOf(s).factors && <div className="mt-2"><b>What changes the price: </b>{notesOf(s).factors}</div>}
                {notesOf(s).tips && <div className="mt-2"><b>Tip: </b>{notesOf(s).tips}</div>}
              </>) : <div style={{ color: C.mute }}>Choose a service to see your standard price, the market range and tips.</div>}
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-3 py-1 rounded text-sm font-semibold" style={{ background: C.deep, color: "#fff" }}>Save</button>
            <button type="button" onClick={() => setEdit(null)} className="px-3 py-1 rounded text-sm" style={{ border: `1px solid ${C.rule}`, background: "#fff" }}>Cancel</button>
          </div>
        </form>
      )}
      <T head={["Service", "Billing", "Standard", "Discount", "Client’s fee", "My hours", "Client says", "Status", "Client sees", ""]} right={[2, 3, 4, 5]} rows={rows.map((r) => {
        const pv = one(r.fee_private);
        return [
          <span key="n"><b>{r.name}</b><div className="text-xs">{range(svc(r.service_key) || {})} <Position price={r.price} s={svc(r.service_key)} /></div></span>,
          r.kind, pv.list_price != null ? inr(pv.list_price) : "–",
          discountOf(r, pv) ? <span key="d" style={{ color: C.good }}>−{inr(discountOf(r, pv))} ({pctOf(r, pv)}%)</span> : "–",
          <b key="p">{inr(r.price)}</b>,
          pv.hours_month != null ? <span key="h">{Number(pv.hours_month)} h{r.kind === "monthly" ? " / month" : ""}<div className="text-xs" style={{ color: C.mute }}>{inr(Math.round(r.price / Math.max(Number(pv.hours_month), 0.5)))} / h</div></span> : "–",
          <ClientSays key="c" r={r} />,
          r.status, r.client_visible ? "Yes" : "No",
          <span key="a" className="text-xs whitespace-nowrap">
            {r.client_response === "offer" && <button className="underline mr-2 font-semibold" style={{ color: C.good }} onClick={() => accept(r)}>Accept {inr(r.client_offer)}</button>}
            <button className="underline mr-2" style={{ color: C.deep }} onClick={() => open(r)}>Edit</button>
            {!["Stopped", "Declined"].includes(r.status) && <button className="underline" style={{ color: C.mute }} onClick={() => stop(r)}>Stop</button>}
          </span>,
        ];
      })} />
      {rows.length > 0 && (
        <P style={{ color: C.mute }}>
          Active: one-time {inr(once)}{onceList > once ? ` (standard ${inr(onceList)})` : ""} · monthly {inr(monthly)}{monthlyList > monthly ? ` (standard ${inr(monthlyList)})` : ""}.
          {(onceList > once || monthlyList > monthly) && ` Discount given: ${inr(onceList - once)} one-time and ${inr(monthlyList - monthly)} a month.`} Fees are never deleted: stop a service instead, and every change is in Activity.
        </P>
      )}
    </div>
  );
}

/* ───────── client: their fees, approve or propose ───────── */
function FeeRow({ r, onSaved }) {
  const [mode, setMode] = useState(null); // "offer"
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState(null);
  const locked = ["Declined", "Stopped"].includes(r.status);
  const send = async (choice) => {
    setMsg(null);
    const { error } = await supabase.rpc("respond_fee", { service: r.id, choice, amount: choice === "offer" ? Number(amount) : null, note: note || null });
    if (error) return setMsg(error.message);
    setMode(null); setAmount(""); setNote(""); onSaved();
  };
  return (
    <div className="p-4 mb-3" style={{ background: C.card, border: `1px solid ${C.rule}`, borderLeft: `4px solid ${r.client_response === "approved" ? C.good : r.client_response === "offer" ? C.warn : C.info}`, borderRadius: 3 }}>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-semibold flex-1" style={{ minWidth: 0 }}>{r.name}</span>
        <span className="font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>{inr(r.price)} <span className="text-xs" style={{ color: C.mute }}>{per(r.kind)}, ex-GST</span></span>
      </div>
      <div className="text-xs mb-2" style={{ color: C.mute }}>{r.status}{r.note ? ` · ${r.note}` : ""}</div>
      {r.client_response === "approved" && <div className="text-sm mb-2"><Chip tone="good">You approved</Chip> <span className="text-xs" style={{ color: C.mute }}>{fmtDateTime(r.client_response_at)}</span></div>}
      {r.client_response === "offer" && <div className="text-sm mb-2"><Chip tone="warn">You proposed {inr(r.client_offer)}</Chip> <span className="text-xs" style={{ color: C.mute }}>{fmtDateTime(r.client_response_at)}{r.client_note ? ` · ${r.client_note}` : ""} · Ajay will reply</span></div>}
      {!locked && r.client_response !== "approved" && (
        <div className="flex flex-wrap gap-2 items-center">
          <button onClick={() => send("approved")} className="px-4 py-1.5 rounded text-sm font-semibold" style={{ border: `1px solid ${C.good}`, background: C.goodBg, color: C.good }}>Approve {inr(r.price)}</button>
          <button onClick={() => setMode(mode ? null : "offer")} aria-expanded={!!mode} className="px-4 py-1.5 rounded text-sm font-semibold" style={{ border: `1px solid ${C.rule}`, background: "#fff" }}>{r.client_response === "offer" ? "Change my price" : "Suggest your price"}</button>
        </div>
      )}
      {mode && (
        <div className="mt-2 grid gap-2 md:grid-cols-3 items-end">
          <label htmlFor={`offer-${r.id}`} className="block text-xs" style={{ color: C.mute }}>Your price (₹, ex-GST) {per(r.kind)}
            <input id={`offer-${r.id}`} type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} className={input} style={fs} />
          </label>
          <label htmlFor={`onote-${r.id}`} className="block text-xs md:col-span-2" style={{ color: C.mute }}>Note (optional)
            <input id={`onote-${r.id}`} value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} className={input} style={fs} />
          </label>
          <div><button onClick={() => send("offer")} disabled={!amount} className="px-3 py-1 rounded text-sm font-semibold" style={{ background: C.deep, color: "#fff", opacity: amount ? 1 : 0.5 }}>Send my price</button></div>
        </div>
      )}
      {msg && <div className="text-sm mt-2" style={{ color: C.bad }}>{msg}</div>}
    </div>
  );
}

/* The client's own money dashboard: what they pay every month, and one-time. */
const OFF = ["Declined", "Stopped"];
function FeeTiles({ rows }) {
  const live = rows.filter((r) => !OFF.includes(r.status));
  const tile = (title, list, unit) => {
    const sum = list.reduce((a, r) => a + Number(r.price), 0);
    const ok = list.filter((r) => r.client_response === "approved").length;
    return (
      <Card>
        <div className="text-xs uppercase tracking-wide" style={{ color: C.mute }}>{title}</div>
        <div className="text-2xl font-semibold" style={{ color: C.deep, fontVariantNumeric: "tabular-nums" }}>{inr(sum)}<span className="text-sm font-normal" style={{ color: C.mute }}>{unit}</span></div>
        <div className="text-xs mt-1" style={{ color: C.mute }}>{list.length ? `${list.length} service${list.length > 1 ? "s" : ""} · ${ok} approved by you` : "None"}</div>
        <ul className="text-xs mt-2" style={{ lineHeight: 1.6 }}>
          {list.map((r) => <li key={r.id} className="flex justify-between gap-2"><span>{r.name}</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{inr(r.price)}</span></li>)}
        </ul>
      </Card>
    );
  };
  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 mb-4" aria-label="Your payments">
      {tile("Recurring, every month", live.filter((r) => r.kind === "monthly"), " / month")}
      {tile("One-time", live.filter((r) => r.kind !== "monthly"), "")}
    </div>
  );
}

export function FeesClient({ projectId, banner = null }) {
  const fees = useRows(() => supabase.from("project_services").select("*").eq("project_id", projectId).eq("client_visible", true).order("created_at"), [projectId]);
  const cat = useRows(() => supabase.from("services").select("id,why,includes"), []);
  const [open, setOpen] = useState(null);
  const rows = fees.rows || [];
  const svc = (k) => (cat.rows || []).find((c) => c.id === k);
  const waiting = rows.filter((r) => !r.client_response && !OFF.includes(r.status)).length;
  return (
    <div>
      <H2>Your payments</H2>
      <FeeTiles rows={rows} />
      <P style={{ color: C.mute, marginTop: -8 }}>All fees exclude GST.</P>
      {banner}
      <H2>Your fees</H2>
      <P>Approve each fee, or suggest your own price and Ajay will reply. Every answer is saved with its date and time.</P>
      {waiting > 0 && <Box tone="warn" title={`${waiting} fee${waiting > 1 ? "s" : ""} waiting for your answer`}>Approve, or suggest your price, below.</Box>}
      {rows.map((r) => <FeeRow key={r.id + (r.client_response_at || "") + r.price} r={r} onSaved={fees.reload} />)}
      {rows.some((r) => svc(r.service_key)?.why) && <H2>What each service covers</H2>}
      {rows.map((r) => {
        const s = svc(r.service_key);
        if (!s?.why) return null;
        return (
          <div key={r.id} className="mb-2">
            <button className="text-sm underline text-left" style={{ color: C.deep }} onClick={() => setOpen(open === r.id ? null : r.id)}>{r.name}</button>
            {open === r.id && (
              <Card className="mt-1">
                <P style={{ marginBottom: 6 }}>{s.why}</P>
                {s.includes && <ul className="text-sm pl-5" style={{ listStyle: "disc", lineHeight: 1.6 }}>{s.includes.split("\n").filter(Boolean).map((x) => <li key={x}>{x}</li>)}</ul>}
              </Card>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ───────── signed-in list of services (clients see it under Services); no prices ───────── */
export function PublicPriceList() {
  const { rows } = useRows(() => supabase.from("services").select("*").eq("active", true).order("sort"), []);
  if (!rows) return <P>Loading…</P>;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {rows.map((s) => (
        <Card key={s.id}>
          <div className="flex flex-wrap justify-between items-baseline gap-2">
            <span className="font-semibold" style={{ color: C.deep }}>{s.name}</span>
            <span className="text-xs" style={{ color: C.mute }}>{per(s.kind)}{s.min_months ? `, min. ${s.min_months} months` : ""}</span>
          </div>
          <P style={{ color: C.mute, marginTop: 8 }}>{s.summary}</P>
          {s.includes && <ul className="text-sm pl-5 mb-2" style={{ listStyle: "disc", lineHeight: 1.6 }}>{s.includes.split("\n").filter(Boolean).map((x) => <li key={x}>{x}</li>)}</ul>}
          {s.why && <div className="text-xs" style={{ color: C.mute }}>{s.why}</div>}
        </Card>
      ))}
    </div>
  );
}
