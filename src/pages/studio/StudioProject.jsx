/* One project, editable: everything the client sees, plus money, time and private notes. */
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase.js";
import { useRows } from "../../lib/useRows.js";
import { FIELDS, defaultsFor } from "../../lib/schema.js";
import { fmt } from "../../components/Editor.jsx";
import { invoiceState, total, fmtDate, hours, today, fmtDateTime } from "../../lib/money.js";
import { STAGES, SERVICES } from "../../data/studio.js";
import { REPORTS } from "../../projects/reports.js";
import Editor from "../../components/Editor.jsx";
import { C, inr, Chip, H1, H2, P, Box, Tabs, Card } from "../../components/ui.jsx";
import { FilesPanel, MetricsPanel, ReportPanel, Tag, ANSWER, byMeeting } from "../../components/parts.jsx";
import { emailToLogin } from "../../lib/auth.jsx";
import { FeesEditor } from "../../components/pricing.jsx";
import { AuditTrail, Timeline } from "../../components/activity.jsx";
import { draftWeekly, thisWeek, weeklyLabel, KIND_LABEL, loadChanges } from "../../lib/weekly.js";
import { ScheduleEditor, RequestThreads, CredentialsPanel, WorkLog, MoneySwitch } from "../../components/collab.jsx";
import { WEEKLY, answerBy } from "../../data/studio.js";

const field = "mt-1 w-full px-2 py-1.5 rounded text-sm";
const fs = { border: `1px solid ${C.rule}`, background: "#fff" };
const col = (table, key, label) => { const f = FIELDS[table].find((x) => x.key === key); return [label || f.label, (r) => fmt(f, r[key])]; };

/* ───────── project details ───────── */
const L = ({ label, children, wide }) => <label className={`block text-xs mb-3 ${wide ? "md:col-span-2" : ""}`} style={{ color: C.mute }}>{label}{children}</label>;
export function ProjectForm({ initial, onSaved }) {
  const clients = useRows(() => supabase.from("clients").select("id,name,org").order("name"), []);
  const [p, setP] = useState(initial);
  const [newClient, setNewClient] = useState({ name: "", org: "", email: "", phone: "" });
  const [msg, setMsg] = useState(null);
  const set = (k) => (e) => setP({ ...p, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    let client_id = p.client_id || null;
    if (client_id === "new") {
      const { data, error } = await supabase.from("clients").insert({ ...newClient, email: newClient.email || null }).select().single();
      if (error) return setMsg(["bad", error.message]);
      client_id = data.id;
    }
    const body = {
      slug: p.slug, name: p.name, stage: p.stage, client_id, summary: p.summary || null, brief: p.brief || null,
      started_on: p.started_on || null, ended_on: p.ended_on || null, report_key: p.report_key || null,
      next_meeting_at: p.next_meeting_at ? new Date(p.next_meeting_at).toISOString() : null, next_meeting_note: p.next_meeting_note || null,
    };
    const { data, error } = p.id
      ? await supabase.from("projects").update(body).eq("id", p.id).select().single()
      : await supabase.from("projects").insert(body).select().single();
    if (error) return setMsg(["bad", error.code === "23505" ? "That link name is already used by another project." : error.message]);
    setMsg(["good", "Saved"]);
    onSaved(data);
  };
  const localDT = p.next_meeting_at ? new Date(new Date(p.next_meeting_at).getTime() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16) : "";
  return (
    <form onSubmit={save}>
      <div className="grid md:grid-cols-2 gap-x-4">
        <L label="Project name"><input required value={p.name || ""} onChange={(e) => setP({ ...p, name: e.target.value, slug: p.id ? p.slug : e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") })} className={field} style={fs} /></L>
        <L label="Link name (client URL: /portal/p/…)"><input required pattern="[a-z0-9\-]+" value={p.slug || ""} onChange={set("slug")} className={field} style={fs} /></L>
        <L label="Client">
          <select value={p.client_id || ""} onChange={set("client_id")} className={field} style={fs}>
            <option value="">—</option>
            {(clients.rows || []).map((c) => <option key={c.id} value={c.id}>{c.name}{c.org ? `, ${c.org}` : ""}</option>)}
            <option value="new">+ New client…</option>
          </select>
        </L>
        <L label="Stage"><select value={p.stage || "enquiry"} onChange={set("stage")} className={field} style={fs}>{[...STAGES.map(([id, l]) => [id, l]), ["closed", "Closed"]].map(([id, l]) => <option key={id} value={id}>{l}</option>)}</select></L>
        {p.client_id === "new" && ["name", "org", "email", "phone"].map((k) => (
          <L key={k} label={`New client: ${k}`}><input required={k === "name"} value={newClient[k]} onChange={(e) => setNewClient({ ...newClient, [k]: e.target.value })} className={field} style={fs} /></L>
        ))}
        <L label="Summary (one line)" wide><input value={p.summary || ""} onChange={set("summary")} className={field} style={fs} /></L>
        <L label="Brief" wide><textarea rows={2} value={p.brief || ""} onChange={set("brief")} className={field} style={fs} /></L>
        <L label="Started"><input type="date" value={p.started_on || ""} onChange={set("started_on")} className={field} style={fs} /></L>
        <L label="Ended"><input type="date" value={p.ended_on || ""} onChange={set("ended_on")} className={field} style={fs} /></L>
        <L label="Extra one-off update (optional; weekly updates are every Tuesday 11:00)"><input type="datetime-local" value={localDT} onChange={set("next_meeting_at")} className={field} style={fs} /></L>
        <L label="Extra update about"><input value={p.next_meeting_note || ""} onChange={set("next_meeting_note")} className={field} style={fs} /></L>
        <L label="Custom report (optional)"><select value={p.report_key || ""} onChange={set("report_key")} className={field} style={fs}><option value="">None</option>{Object.entries(REPORTS).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}</select></L>
      </div>
      <button type="submit" className="px-4 py-2 rounded text-sm font-semibold" style={{ background: C.deep, color: "#fff" }}>{p.id ? "Save project" : "Create project"}</button>
      {msg && <span className="ml-3 text-sm" style={{ color: C[msg[0]] }}>{msg[1]}</span>}
    </form>
  );
}

/* ───────── timer ───────── */
function Timer({ projectId, onChange }) {
  const { rows, reload } = useRows(() => supabase.from("time_entries").select("*").eq("project_id", projectId).is("ended_at", null), [projectId]);
  const [task, setTask] = useState("");
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 30000); return () => clearInterval(t); }, []);
  const running = rows?.[0];
  const start = async () => { await supabase.from("time_entries").insert({ project_id: projectId, started_at: new Date().toISOString(), task: task || "Work" }); setTask(""); reload(); onChange(); };
  const stop = async () => { await supabase.from("time_entries").update({ ended_at: new Date().toISOString() }).eq("id", running.id); reload(); onChange(); };
  return (
    <Card className="mb-4">
      {running ? (
        <div className="flex flex-wrap items-center gap-3">
          <Chip tone="warn">Running</Chip>
          <span className="text-sm">{running.task} · since {fmtDateTime(running.started_at, { dateStyle: "medium", timeStyle: "short" })} · {((Date.now() - new Date(running.started_at)) / 36e5).toFixed(1)} h</span>
          <button onClick={stop} className="px-3 py-1 rounded text-sm font-semibold" style={{ background: C.bad, color: "#fff" }}>Stop</button>
          <span className="text-xs" style={{ color: C.mute }}>Forgot to stop? Edit the end time in the list below.</span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <input aria-label="What are you working on" placeholder="What are you working on?" value={task} onChange={(e) => setTask(e.target.value)} className="px-2 py-1.5 rounded text-sm flex-1" style={{ ...fs, minWidth: 0 }} />
          <button onClick={start} className="px-3 py-1 rounded text-sm font-semibold" style={{ background: C.good, color: "#fff" }}>Start timer</button>
        </div>
      )}
    </Card>
  );
}

/* ───────── metrics import ───────── */
function MetricsImport({ projectId, onDone }) {
  const [text, setText] = useState("");
  const [msg, setMsg] = useState(null);
  const run = async () => {
    const rows = text.trim().split(/\r?\n/).map((l) => l.split(/\t|,/).map((x) => x.trim())).filter((r) => r.length >= 3 && r[0] && !/^metric$/i.test(r[0]));
    const bad = rows.find((r) => !/^\d{4}-\d{2}(-\d{2})?$/.test(r[1]) || isNaN(Number(r[2].replace(/[₹,\s]/g, ""))));
    if (bad) return setMsg(["bad", `Could not read: ${bad.join(" | ")}. Use metric, YYYY-MM or YYYY-MM-DD, value.`]);
    const body = rows.map((r) => ({ project_id: projectId, metric: r[0], period: r[1].length === 7 ? r[1] + "-01" : r[1], value: Number(r[2].replace(/[₹,\s]/g, "")), unit: r[3] || null, source: r[4] || "Pasted" }));
    const { error } = await supabase.from("metrics").upsert(body, { onConflict: "project_id,metric,period" });
    if (error) return setMsg(["bad", error.message]);
    setMsg(["good", `${body.length} values saved`]); setText(""); onDone();
  };
  return (
    <Card className="mb-4">
      <div className="font-semibold text-sm mb-1" style={{ color: C.deep }}>Paste numbers from a spreadsheet</div>
      <div className="text-xs mb-2" style={{ color: C.mute }}>One per line: metric, month (2026-09) or day, value, unit, source. Same metric and month overwrites.</div>
      <textarea aria-label="Numbers to import" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={"Calls from ads, 2026-10, 14, calls, Google Ads\nWebsite visits, 2026-10, 820, visits, GA4"} className={field} style={fs} />
      <button onClick={run} className="mt-2 px-3 py-1 rounded text-sm font-semibold" style={{ background: C.deep, color: "#fff" }}>Import</button>
      {msg && <span className="ml-3 text-sm" style={{ color: C[msg[0]] }}>{msg[1]}</span>}
    </Card>
  );
}

/* ───────── weekly update ───────── */
function WeeklyButton({ project, onDone, bump }) {
  const [msg, setMsg] = useState(null);
  const chg = useRows(loadChanges, [bump]);
  const { at, day } = thisWeek(chg.rows || [], project.id);
  const go = async () => {
    setMsg(null);
    try {
      const r = await draftWeekly(project, chg.rows || []);
      setMsg(r.existed ? ["info", "This week’s update already exists: edit it below."] : ["good", "Draft created from the last 7 days. Edit it, then Approve. It shows to the client at the time below."]);
      onDone();
    } catch (e) { setMsg(["bad", e.message]); }
  };
  return (
    <Card className="mb-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1" style={{ minWidth: 0 }}>
          <div className="font-semibold text-sm" style={{ color: C.deep }}>Weekly update: {WEEKLY.label}</div>
          <div className="text-sm" style={{ color: C.mute }}>The next one goes to the client on <b>{weeklyLabel(at)}</b> ({fmtDate(day)}). Approve it before then.</div>
        </div>
        <button onClick={go} className="px-3 py-1.5 rounded text-sm font-semibold" style={{ background: C.deep, color: "#fff" }}>Write the next update</button>
      </div>
      {msg && <div className="text-sm mt-2" style={{ color: C[msg[0]] }}>{msg[1]}</div>}
    </Card>
  );
}

/* ───────── decisions ───────── */
function SendToggle({ row, reload }) {
  const go = async () => { await supabase.from("decisions").update({ client_visible: !row.client_visible }).eq("id", row.id); reload(); };
  return row.client_visible
    ? <button className="mr-2 underline" style={{ color: C.mute }} onClick={go}>Unsend</button>
    : <button className="mr-2 underline font-semibold" style={{ color: C.good }} onClick={go}>Send</button>;
}

/* Summary per weekly update and a plain-text checklist for WhatsApp or notes. */
function DecisionsSummary({ projectId, projectName, bump }) {
  const { rows } = useRows(() => supabase.from("decisions").select("*").eq("project_id", projectId).order("meeting_on", { ascending: false, nullsFirst: false }).order("sort"), [projectId, bump]);
  const [copied, setCopied] = useState(null);
  if (!rows?.length) return null;
  const mark = (d) => (d.status === "closed" ? "✅" : d.answer ? "🟦" : "⬜");
  const text = (day, list) => [
    `${projectName}: decisions${day ? ` for the update on ${fmtDate(day)}` : ""}`, "",
    ...list.map((d, i) => `${mark(d)} ${i + 1}. ${d.question}${d.answer ? `\n   Answer: ${ANSWER[d.answer][0]}${d.answer_note ? `: ${d.answer_note}` : ""}` : ""}${d.outcome ? `\n   Decision: ${d.outcome}` : ""}`),
    "", "Answer on your project page, Decisions tab.",
  ].join("\n");
  const copy = async (day, list) => {
    try { await navigator.clipboard.writeText(text(day, list)); setCopied(day); } catch { setCopied("fail"); }
  };
  return (
    <div className="grid gap-3 md:grid-cols-2 mb-4">
      {byMeeting(rows).map(([day, list]) => {
        const sent = list.filter((d) => d.client_visible), answered = sent.filter((d) => d.answer), closed = list.filter((d) => d.status === "closed");
        return (
          <Card key={day}>
            <div className="font-semibold text-sm" style={{ color: C.deep }}>{day ? `Update, ${fmtDate(day)}` : "No update date"}</div>
            <div className="text-sm" style={{ color: C.mute }}>{list.length} items · {sent.length} sent · {answered.length} answered · {closed.length} decided</div>
            <div className="text-xs mt-1">
              {["yes", "no", "other"].map((k) => <span key={k} className="mr-2"><Chip tone={ANSWER[k][1]}>{ANSWER[k][0]} {list.filter((d) => d.answer === k).length}</Chip></span>)}
            </div>
            <button onClick={() => copy(day, list)} className="mt-2 underline text-xs" style={{ color: C.deep }}>{copied === day ? "Copied" : "Copy checklist for WhatsApp"}</button>
          </Card>
        );
      })}
    </div>
  );
}

/* Approve an update for the client, or take it back. */
export function Approve({ row, reload }) {
  const go = async (yes) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("updates").update(yes ? { client_visible: true, approved_at: new Date().toISOString(), approved_by: user.id } : { client_visible: false, approved_at: null, approved_by: null }).eq("id", row.id);
    reload();
  };
  return row.client_visible
    ? <button className="mr-2 underline" style={{ color: C.mute }} onClick={() => go(false)}>Unapprove</button>
    : <button className="mr-2 underline font-semibold" style={{ color: C.good }} onClick={() => go(true)}>Approve</button>;
}

function MarkPaid({ inv, reload }) {
  if (inv.status === "paid" || inv.status === "void") return null;
  const go = async (status) => {
    const body = status === "paid" ? { status, paid_on: today(), paid_amount: total(inv) } : { status, issued_on: inv.status === "draft" ? today() : inv.issued_on };
    await supabase.from("invoices").update(body).eq("id", inv.id);
    reload();
  };
  return inv.status === "draft"
    ? <button className="mr-2 underline" style={{ color: C.info }} onClick={() => go("sent")}>Send</button>
    : <button className="mr-2 underline" style={{ color: C.good }} onClick={() => go("paid")}>Mark paid</button>;
}

/* ───────── page ───────── */
export default function StudioProject() {
  const { slug } = useParams();
  const nav = useNavigate();
  const { rows, error, reload } = useRows(() => supabase.from("projects").select("*, clients(name,org,email,phone)").eq("slug", slug), [slug]);
  const [tab, setTab] = useState("overview");
  const [bump, setBump] = useState(0);
  const numbers = useRows(() => supabase.from("invoices").select("number"), [bump, tab]);
  const chg = useRows(loadChanges, [bump]);
  if (error) return <Box tone="bad" title="Could not load">{error.message}</Box>;
  if (!rows) return <P>Loading…</P>;
  const p = rows[0];
  if (!p) return <Box tone="warn" title="No such project"><Link to="/studio" className="underline">Back to dashboard</Link></Box>;
  const id = p.id;
  const year = today().slice(0, 4);
  const seq = Math.max(0, ...(numbers.rows || []).map((r) => r.number.match(new RegExp(`^INV-${year}-(\\d+)$`))?.[1]).filter(Boolean).map(Number));
  const nextNumber = `INV-${year}-${String(seq + 1).padStart(3, "0")}`;
  const nextDay = thisWeek(chg.rows || [], id).day;
  const tabs = [
    ["overview", "Overview"], ["decisions", "Decisions"], ["updates", "Updates"], ["issues", "Issues"], ["money", "Money"], ["time", "Time"],
    ["files", "Files"], ["requests", "Requests"], ["work", "Work done"], ["numbers", "Numbers"],
    ...(p.report_key && REPORTS[p.report_key] ? [["report", "Report"]] : []),
    ["timeline", "Client timeline"], ["activity", "Activity"],
    ["access", "Client access"], ["logins", "Tools and logins"],
  ];

  return (
    <div>
      <div className="text-sm mb-1 flex flex-wrap justify-between gap-2" style={{ color: C.mute }}>
        <Link to="/studio" style={{ color: C.deep }}>← Dashboard</Link>
        <span>{p.clients?.name}{p.clients?.org ? `, ${p.clients.org}` : ""} · client link: <b style={{ userSelect: "all" }}>{window.location.origin}/portal/p/{p.slug}</b></span>
      </div>
      <H1>{p.name}</H1>
      <Tabs label="Project sections" tabs={tabs} value={tab} onChange={setTab} />

      {tab === "overview" && (<>
        <ProjectForm key={p.id + p.slug} initial={p} onSaved={(d) => (d.slug !== slug ? nav(`/studio/p/${d.slug}`, { replace: true }) : reload())} />
        <H2>Services and fees</H2>
        <MoneySwitch project={p} onChange={reload} />
        <FeesEditor projectId={id} />
      </>)}

      {tab === "decisions" && (<>
        <P>Questions for the client to answer Yes, No or Other. Drafts stay private until you press <b>Send</b>. After the update, Edit an item, set Status to Closed and write the final decision.</P>
        <DecisionsSummary projectId={id} projectName={p.name} bump={bump} />
        <Editor table="decisions" onChange={() => setBump((b) => b + 1)} projectId={id} fields={FIELDS.decisions} order={["sort", true]}
          defaults={{ ...defaultsFor("decisions"), meeting_on: nextDay, due_on: answerBy(nextDay), status: "open", sort: 100 }}
          columns={[["#", (r) => r.sort], ["Update", (r) => fmtDate(r.meeting_on)], ["Question", (r) => r.question],
            ["Sent", (r) => (r.client_visible ? <Chip key="s" tone="good">Sent</Chip> : <Chip key="d" tone="info">Draft</Chip>)],
            ["Answer", (r) => (r.answer ? <span key="a"><Chip tone={ANSWER[r.answer][1]}>{ANSWER[r.answer][0]}</Chip>{r.answer_note ? ` ${r.answer_note}` : ""}</span> : "–")],
            ["Decision", (r) => (r.status === "closed" ? <span key="c"><Chip tone="good">Closed</Chip> {r.outcome || ""}</span> : "Open")]]}
          extra={(r, reload) => <SendToggle row={r} reload={() => { reload(); setBump((b) => b + 1); }} />} />
      </>)}

      {tab === "updates" && <WeeklyButton project={p} bump={bump} onDone={() => setBump((b) => b + 1)} />}
      {tab === "updates" && <ScheduleEditor projectId={id} onChange={() => setBump((b) => b + 1)} />}
      {tab === "updates" && <Editor key={`u${bump}`} table="updates" projectId={id} fields={FIELDS.updates} order={["happened_on", false]}
        defaults={{ ...defaultsFor("updates"), happened_on: today(), kind: "work", status: "Done" }}
        columns={[col("updates", "happened_on"), ["Type", (r) => KIND_LABEL[r.kind] || r.kind], col("updates", "title"), col("updates", "status"),
          ["Client", (r) => (!r.client_visible ? <Chip key="p" tone="warn">Waiting for approval</Chip>
            : r.publish_at && new Date(r.publish_at) > new Date() ? <span key="s"><Chip tone="info">Approved</Chip> shows {fmtDateTime(r.publish_at)}</span>
            : <Chip key="a" tone="good">Approved, visible</Chip>)]]}
        extra={(r, reload) => <Approve row={r} reload={reload} />} />}
      {tab === "updates" && <P style={{ color: C.mute }}>New updates stay private until you approve them. Approved updates show on the client’s page straight away.</P>}

      {tab === "issues" && <Editor table="issues" projectId={id} fields={FIELDS.issues} order={["sort", true]}
        defaults={{ ...defaultsFor("issues"), severity: "medium", status: "open", owner: "me", raised_on: today(), sort: 100 }}
        columns={[["Severity", (r) => <Tag key="s" v={r.severity} />], col("issues", "title"), ["Status", (r) => <Tag key="t" v={r.status} />], col("issues", "owner")]} />}

      {tab === "money" && (<>
        <MoneySwitch project={p} onChange={reload} />
        <Editor key={`inv${bump}`} title="Invoices" table="invoices" projectId={id} fields={FIELDS.invoices} order={["issued_on", false]}
          defaults={{ number: nextNumber, issued_on: today(), due_on: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10), status: "draft", gst: 0 }}
          columns={[col("invoices", "number"), col("invoices", "description"), ["Total", (r) => inr(total(r))], ["Status", (r) => { const [l, t] = invoiceState(r); return <Chip key="s" tone={t}>{l}</Chip>; }]]}
          extra={(r, reload) => <MarkPaid inv={r} reload={() => { reload(); setBump(bump + 1); }} />} />
        <P style={{ color: C.mute }}>Drafts are hidden from the client. “Send” makes an invoice visible and starts the due-date clock. Overdue invoices show a banner on the client’s page and a reminder on your dashboard.</P>
        <Editor title="Expenses" table="expenses" projectId={id} fields={FIELDS.expenses} order={["spent_on", false]}
          defaults={{ ...defaultsFor("expenses"), spent_on: today(), category: "software", paid_by: "me" }}
          columns={[col("expenses", "spent_on"), col("expenses", "description"), col("expenses", "amount"), col("expenses", "paid_by"), ["Client sees", (r) => (r.client_visible ? "Yes" : "No")]]} />
      </>)}

      {tab === "time" && (<>
        <Timer projectId={id} onChange={() => setBump(bump + 1)} />
        <Editor key={bump} table="time_entries" projectId={id} fields={FIELDS.time_entries} order={["started_at", false]}
          defaults={{ started_at: new Date().toISOString(), billable: true }}
          columns={[col("time_entries", "started_at"), col("time_entries", "ended_at"), ["Hours", (r) => (r.ended_at ? hours(r).toFixed(2) : <Chip key="o" tone="warn">open</Chip>)], col("time_entries", "task")]} />
        <P style={{ color: C.mute }}>Time is private. Clients never see it.</P>
      </>)}

      {tab === "files" && <FilesPanel projectId={id} owner />}

      {tab === "requests" && <RequestThreads projectId={id} admin />}
      {tab === "work" && <WorkLog projectId={id} reportKey={p.report_key} admin onOpenReport={() => setTab("report")} />}
      {tab === "logins" && <CredentialsPanel projectId={id} />}

      {tab === "numbers" && (<>
        <MetricsImport projectId={id} onDone={() => setBump(bump + 1)} />
        <MetricsPanel key={`c${bump}`} projectId={id} />
        <Editor key={`e${bump}`} title="All values" table="metrics" projectId={id} fields={FIELDS.metrics} order={["period", false]}
          defaults={{ ...defaultsFor("metrics"), period: today().slice(0, 8) + "01" }} />
      </>)}

      {tab === "report" && <ReportPanel reportKey={p.report_key} studio />}

      {tab === "activity" && <AuditTrail projectId={id} />}
      {tab === "timeline" && <Timeline project={p} />}
      {tab === "access" && (<>
        <P>People who can sign in and see this project. Create accounts and tick their projects on <Link className="underline" to="/studio/users" style={{ color: C.deep }}>People</Link>, then give them their username, password and this address:</P>
        <Card className="mb-4"><b style={{ userSelect: "all" }}>{window.location.origin}/login</b></Card>
        <Editor table="project_members" projectId={id} fields={FIELDS.project_members} order={["added_at", true]} defaults={{ role: "client" }} canAdd={false}
          columns={[["Signs in as", (r) => emailToLogin(r.email)], ["Name", (r) => r.name || "–"], ["Role", (r) => r.role]]} empty="Nobody has access yet. Add someone on People." />
        <P style={{ color: C.mute }}>To see the page as they do, open <Link className="underline" to={`/portal/p/${p.slug}`}>the client view</Link>. It shows only what is marked for the client.</P>
      </>)}
    </div>
  );
}

export function NewProject() {
  const nav = useNavigate();
  return (
    <div>
      <div className="text-sm mb-1"><Link to="/studio" style={{ color: C.deep }}>← Dashboard</Link></div>
      <H1>New project</H1>
      <P>Create the project, then add services, the client’s login email and the first update.</P>
      <ProjectForm initial={{ stage: "enquiry", started_on: today() }} onSaved={(d) => nav(`/studio/p/${d.slug}`)} />
    </div>
  );
}
