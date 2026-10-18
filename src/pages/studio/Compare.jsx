/* Compare projects with each other, and any recorded number across projects and time. */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { supabase } from "../../lib/supabase.js";
import { useRows } from "../../lib/useRows.js";
import { total, balance, hours, today } from "../../lib/money.js";
import { FIELDS } from "../../lib/schema.js";
import Editor from "../../components/Editor.jsx";
import { C, inr, H1, H2, P, T, Pills } from "../../components/ui.jsx";

const LINE = [C.deep, C.warn, C.good, C.bad, C.info, C.mute];

export default function Compare() {
  const projects = useRows(() => supabase.from("projects").select("id,slug,name,stage,started_on,ended_on").order("created_at"), []);
  const inv = useRows(() => supabase.from("invoices").select("*"), []);
  const exp = useRows(() => supabase.from("expenses").select("*"), []);
  const time = useRows(() => supabase.from("time_entries").select("*"), []);
  const iss = useRows(() => supabase.from("issues").select("project_id,status,severity"), []);
  const met = useRows(() => supabase.from("metrics").select("project_id,metric,period,value,unit").order("period"), []);
  const [metric, setMetric] = useState(null);
  const [span, setSpan] = useState("12");

  const per = useMemo(() => {
    if (![projects, inv, exp, time, iss].every((x) => x.rows)) return null;
    return projects.rows.map((p) => {
      const pi = inv.rows.filter((i) => i.project_id === p.id && i.status !== "void");
      const got = pi.reduce((a, i) => a + (i.status === "paid" ? Number(i.paid_amount ?? total(i)) : 0), 0);
      const cost = exp.rows.filter((e) => e.project_id === p.id && e.paid_by === "me").reduce((a, e) => a + Number(e.amount), 0);
      const h = time.rows.filter((t) => t.project_id === p.id).reduce((a, t) => a + hours(t), 0);
      const pIss = iss.rows.filter((i) => i.project_id === p.id);
      const days = p.started_on ? Math.round((new Date(p.ended_on || today()) - new Date(p.started_on)) / 864e5) : null;
      return [
        <Link key={p.id} to={`/studio/p/${p.slug}`} style={{ color: C.deep, fontWeight: 600 }}>{p.name}</Link>,
        days ?? "–", inr(pi.filter((i) => i.status !== "draft").reduce((a, i) => a + total(i), 0)), inr(got),
        inr(pi.reduce((a, i) => a + balance(i), 0)), inr(cost), h.toFixed(1), h ? inr((got - cost) / h) : "–",
        `${pIss.filter((i) => !["resolved", "superseded"].includes(i.status)).length} / ${pIss.length}`,
      ];
    });
  }, [projects.rows, inv.rows, exp.rows, time.rows, iss.rows]);

  const names = useMemo(() => [...new Set((met.rows || []).map((r) => r.metric))], [met.rows]);
  const m = metric || names[0];
  const chart = useMemo(() => {
    if (!met.rows || !m) return { data: [], keys: [] };
    const rows = met.rows.filter((r) => r.metric === m);
    const periods = [...new Set(rows.map((r) => r.period.slice(0, 7)))].sort();
    const keep = span === "all" ? periods : periods.slice(-Number(span));
    const pname = Object.fromEntries((projects.rows || []).map((p) => [p.id, p.name]));
    const keys = [...new Set(rows.map((r) => pname[r.project_id]))];
    const data = keep.map((per) => Object.fromEntries([["p", per], ...rows.filter((r) => r.period.startsWith(per)).map((r) => [pname[r.project_id], Number(r.value)])]));
    const sums = keys.map((k) => {
      const v = data.map((d) => d[k]).filter((x) => x != null);
      return [k, v.length, Math.round(v.reduce((a, b) => a + b, 0)).toLocaleString("en-IN"), v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length).toLocaleString("en-IN") : "–", v.length ? Math.max(...v).toLocaleString("en-IN") : "–"];
    });
    return { data, keys, sums, unit: rows[0]?.unit || "" };
  }, [met.rows, m, span, projects.rows]);

  return (
    <div>
      <div className="text-sm mb-1"><Link to="/studio" style={{ color: C.deep }}>← Dashboard</Link></div>
      <H1>Compare</H1>
      <H2>Projects side by side</H2>
      {per ? <T head={["Project", "Days", "Billed", "Received", "Owed", "Your costs", "Hours", "Per hour", "Issues open / all"]} right={[1, 2, 3, 4, 5, 6, 7]} rows={per} /> : <P>Loading…</P>}

      <H2>Any number, across projects and time</H2>
      {!names.length ? <P style={{ color: C.mute }}>No numbers yet. Add them on a project’s Numbers tab.</P> : (<>
        <Pills label="Metric" value={m} onChange={setMetric} options={names.map((n) => [n, n])} />
        <Pills label="Range" value={span} onChange={setSpan} options={[["6", "Last 6"], ["12", "Last 12"], ["24", "Last 24"], ["all", "All"]]} />
        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer>
            <LineChart data={chart.data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={C.rule} vertical={false} />
              <XAxis dataKey="p" tick={{ fontSize: 10, fill: C.mute }} minTickGap={20} />
              <YAxis tick={{ fontSize: 11, fill: C.mute }} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
              <Tooltip formatter={(v, n) => [Number(v).toLocaleString("en-IN") + (chart.unit ? ` ${chart.unit}` : ""), n]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {chart.keys.map((k, i) => <Line key={k} type="monotone" dataKey={k} stroke={LINE[i % LINE.length]} strokeWidth={2} dot={false} connectNulls />)}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <T head={["Project", "Periods", `Total ${chart.unit}`, "Average", "Highest"]} right={[1, 2, 3, 4]} rows={chart.sums || []} />
        <P style={{ color: C.mute }}>Use the same metric name on every project (for example “Calls from ads”) so they line up here.</P>
      </>)}
    </div>
  );
}

export function Overheads() {
  return (
    <div>
      <div className="text-sm mb-1"><Link to="/studio" style={{ color: C.deep }}>← Dashboard</Link></div>
      <H1>Studio overheads</H1>
      <P>Costs that belong to no single project: software, domain, hosting, travel. They count in your dashboard’s expenses and earned-per-hour.</P>
      <Editor table="expenses" projectId={null} fields={FIELDS.expenses.filter((f) => f.key !== "client_visible" && f.key !== "rebillable")} order={["spent_on", false]}
        defaults={{ spent_on: today(), category: "software", paid_by: "me" }} />
    </div>
  );
}
