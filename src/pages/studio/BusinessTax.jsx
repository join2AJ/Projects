/* Business and tax details. With a GSTIN, GST is added to fees on every project that has GST switched on; without one, no GST. */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase.js";
import { useRows } from "../../lib/useRows.js";
import { useBusiness } from "../../lib/tax.js";
import { C, H1, H2, P, Box, T } from "../../components/ui.jsx";

const input = "mt-1 w-full px-2 py-1.5 rounded text-sm";
const fs = { border: `1px solid ${C.rule}`, background: "#fff" };
const F = ({ label, children, wide }) => <label className={`block text-xs mb-3 ${wide ? "md:col-span-2" : ""}`} style={{ color: C.mute }}>{label}{children}</label>;

export default function BusinessTax() {
  const b = useBusiness();
  const projects = useRows(() => supabase.from("projects").select("id,slug,code,name,gst_applies").order("created_at"), []);
  const [f, setF] = useState(null);
  const [msg, setMsg] = useState(null);
  useEffect(() => { if (b && !f) setF({ company_name: b.company_name || "", gstin: b.gstin || "", pan: b.pan || "", address: b.address || "", gst_rate: b.gst_rate ?? 18 }); }, [b, f]);
  if (!f) return <P>Loading…</P>;
  const set = (k) => (e) => setF({ ...f, [k]: k === "gstin" || k === "pan" ? e.target.value.toUpperCase().replace(/\s/g, "") : e.target.value });
  const save = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from("business_settings").update({
      company_name: f.company_name || null, gstin: f.gstin || null, pan: f.pan || null, address: f.address || null, gst_rate: Number(f.gst_rate || 18), updated_at: new Date().toISOString(),
    }).eq("id", true);
    if (error) return setMsg(["bad", error.message.includes("gstin") ? "That GSTIN does not look right: 15 characters, e.g. 07ABCDE1234F1Z5." : error.message.includes("pan") ? "That PAN does not look right: e.g. ABCDE1234F." : error.message]);
    setMsg(["good", f.gstin ? "Saved. GST now applies to projects with GST switched on." : "Saved. No GSTIN, so no GST is charged: clients pay you directly."]); b.reload();
  };
  const toggle = async (p) => { await supabase.from("projects").update({ gst_applies: !p.gst_applies }).eq("id", p.id); projects.reload(); };
  const registered = !!b.gstin;
  return (
    <div className="max-w-3xl">
      <div className="text-sm mb-1"><Link to="/studio" style={{ color: C.deep }}>← Dashboard</Link></div>
      <H1>Business and tax details</H1>
      <Box tone={registered ? "good" : "info"} title={registered ? `GST registered: ${b.gstin}` : "Not GST-registered"}>
        {registered ? `GST at ${b.gst_rate}% is added to fees on the projects ticked below. Clients see “+ ${b.gst_rate}% GST” next to each fee.` : "No GST is charged on any project. Clients see “No GST” and pay you directly. Add your GSTIN below when you register."}
      </Box>
      <form onSubmit={save} className="grid md:grid-cols-2 gap-x-4 mt-4">
        <F label="Business or company name (shown to clients)"><input value={f.company_name} onChange={set("company_name")} className={input} style={fs} /></F>
        <F label="GSTIN (leave empty if not registered)"><input value={f.gstin} onChange={set("gstin")} maxLength={15} placeholder="e.g. 07ABCDE1234F1Z5" className={input} style={fs} /></F>
        <F label="PAN (optional)"><input value={f.pan} onChange={set("pan")} maxLength={10} className={input} style={fs} /></F>
        <F label="GST rate (%)"><input type="number" min="0" max="28" step="0.01" value={f.gst_rate} onChange={set("gst_rate")} className={input} style={fs} /></F>
        <F label="Business address (for invoices)" wide><textarea rows={2} value={f.address} onChange={set("address")} className={input} style={fs} /></F>
        <div className="md:col-span-2 flex gap-3 items-center">
          <button type="submit" className="px-4 py-2 rounded text-sm font-semibold" style={{ background: C.deep, color: "#fff" }}>Save</button>
          {msg && <span className="text-sm" style={{ color: msg[0] === "good" ? C.good : C.bad }}>{msg[1]}</span>}
        </div>
      </form>
      <H2>GST on each project</H2>
      <P style={{ color: C.mute }}>{registered ? "Untick a project to charge it without GST." : "These take effect once you add a GSTIN."}</P>
      <T head={["Project", "GST"]} rows={(projects.rows || []).map((p) => [
        <Link key="n" to={`/studio/p/${p.slug}`} className="underline" style={{ color: C.deep }}><span className="font-mono text-xs">{p.code}</span> {p.name}</Link>,
        <label key="g" className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.gst_applies} onChange={() => toggle(p)} /> {registered ? (p.gst_applies ? `${b.gst_rate}% GST` : "No GST") : "No GST (not registered)"}</label>,
      ])} />
    </div>
  );
}
