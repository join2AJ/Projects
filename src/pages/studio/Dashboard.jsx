/* Your dashboard: how the business is doing, and what needs you today. */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { supabase } from "../../lib/supabase.js";
import { useRows } from "../../lib/useRows.js";
import { balance, total, isOverdue, daysLate, fmtDate, hours, reminderText, today, fmtDateTime } from "../../lib/money.js";
import { RECURRING } from "../../lib/schema.js";
import { STUDIO, STAGES, WEEKLY, ACTIVE_STAGES, nextWeeklyUpdate } from "../../data/studio.js";
import { draftWeekly, thisWeek, weeklyLabel, schedule, loadChanges, WEEKLY_KIND } from "../../lib/weekly.js";
import { C, inr, Chip, H1, H2, P, Box, T, Card } from "../../components/ui.jsx";
import { OpenActions } from "../../components/meetings.jsx";

const ym = (d) => d.slice(0, 7);
const monthsBack = (n) => {
  const out = [], d = new Date(); d.setDate(1);
  for (let i = n - 1; i >= 0; i--) { const x = new Date(d); x.setMonth(d.getMonth() - i); out.push(x.toISOString().slice(0, 7)); }
  return out;
};

function Stat({ label, value, note, tone }) {
  return (
    <Card>
      <div className="text-xs uppercase tracking-wide" style={{ color: C.mute }}>{label}</div>
      <div className="text-2xl font-semibold" style={{ color: tone ? C[tone] : C.deep, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      {note && <div className="text-xs mt-1" style={{ color: C.mute }}>{note}</div>}
    </Card>
  );
}

function Remind({ inv, project, onDone }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(reminderText(inv, project, STUDIO.email)); setCopied(true); } catch { setCopied(false); }
    await supabase.from("invoices").update({ last_reminded_at: new Date().toISOString() }).eq("id", inv.id);
    onDone();
  };
  return <button onClick={copy} className="underline text-xs" style={{ color: C.deep }}>{copied ? "Copied, send on WhatsApp" : "Copy reminder"}</button>;
}

/* The next weekly update for each active client, honouring skips and moves. */
function WeeklyCard({ projects, upcoming }) {
  const chg = useRows(loadChanges, []);
  const changes = chg.rows || [];
  const regular = nextWeeklyUpdate();
  const active = projects.filter((p) => ACTIVE_STAGES.includes(p.stage));
  const next = Object.fromEntries(active.map((p) => [p.id, thisWeek(changes, p.id)]));
  const days = [...new Set(Object.values(next).map((n) => n.day))];
  const w = useRows(() => supabase.from("updates").select("id,project_id,client_visible,happened_on").eq("kind", WEEKLY_KIND).in("happened_on", days.length ? days : ["1970-01-01"]), [days.join()]);
  const [busy, setBusy] = useState(null);
  const mine = (p) => (w.rows || []).find((x) => x.project_id === p.id && x.happened_on === next[p.id].day);
  const state = (p) => {
    const u = mine(p);
    if (!u) return ["Not written", "bad"];
    if (!u.client_visible) return ["Draft: approve it", "warn"];
    return next[p.id].at > new Date() ? ["Approved, goes out on time", "good"] : ["Published", "good"];
  };
  const skipped = (p) => schedule(changes, p.id, 2).find((s) => s.slot.getTime() === regular.getTime())?.change;
  const missing = active.filter((p) => !mine(p));
  const draftAll = async () => {
    setBusy("Writing drafts…");
    try { for (const p of missing) await draftWeekly(p, changes); setBusy(null); } catch (e) { setBusy(e.message); }
    w.reload();
  };
  return (
    <Card>
      <div className="font-semibold text-sm" style={{ color: C.deep }}>Weekly updates: {weeklyLabel(regular)}</div>
      <div className="text-xs mb-2" style={{ color: C.mute }}>{WEEKLY.label}, for every active client. Skip or move one on the project’s Updates tab.</div>
      {!active.length ? <div className="text-sm" style={{ color: C.mute }}>No active projects.</div> : (
        <ul className="text-sm grid gap-1">
          {active.map((p) => { const [l, t] = state(p); const sk = skipped(p); return (
            <li key={p.id} className="flex flex-wrap justify-between gap-2">
              <Link to={`/studio/p/${p.slug}`} className="underline" style={{ color: C.deep }}>{p.name}</Link>
              <span>{sk && <Chip tone="info">{sk.action === "skip" ? "Skipped" : "Moved"}</Chip>} {sk && <span className="text-xs" style={{ color: C.mute }}>next {weeklyLabel(next[p.id].at)} </span>}<Chip tone={t}>{l}</Chip></span>
            </li>
          ); })}
        </ul>
      )}
      {missing.length > 0 && <button onClick={draftAll} className="mt-2 px-3 py-1 rounded text-xs font-semibold" style={{ background: C.deep, color: "#fff" }}>Write {missing.length} missing draft{missing.length > 1 ? "s" : ""}</button>}
      {busy && <div className="text-xs mt-1" style={{ color: C.mute }}>{busy}</div>}
      {upcoming.length > 0 && (
        <div className="text-xs mt-3" style={{ color: C.mute }}>
          Extra updates: {upcoming.map((p) => `${p.name} ${fmtDateTime(p.next_meeting_at)}`).join(" · ")}
        </div>
      )}
    </Card>
  );
}

/* DPDP: a client's access ends 7 days after their project ends. Lists accounts still attached after that. */
function PrivacyCard({ projects }) {
  const mem = useRows(() => supabase.from("project_members").select("project_id,email"), []);
  const late = projects.filter((p) => p.ended_on && (Date.now() - new Date(p.ended_on).getTime()) / 864e5 > 7)
    .map((p) => [p, (mem.rows || []).filter((m) => m.project_id === p.id)]).filter(([, m]) => m.length);
  const soon = projects.filter((p) => p.ended_on && (Date.now() - new Date(p.ended_on).getTime()) / 864e5 <= 7);
  return (
    <Card>
      <div className="font-semibold text-sm mb-2" style={{ color: C.deep }}>Privacy (DPDP)</div>
      {!late.length && !soon.length ? <div className="text-sm" style={{ color: C.mute }}>No ended projects. Client data is kept only while their project runs, plus 7 days.</div> : (
        <ul className="text-sm grid gap-1">
          {soon.map((p) => <li key={p.id}><b>{p.name}</b>: ended {fmtDate(p.ended_on)}, portal access until {fmtDate(new Date(new Date(p.ended_on).getTime() + 7 * 864e5).toISOString().slice(0, 10))}</li>)}
          {late.map(([p, m]) => <li key={p.id}><Chip tone="bad">Action</Chip> <b>{p.name}</b>: access ended, {m.length} account{m.length > 1 ? "s" : ""} still attached. Remove them on <Link to="/studio/users" className="underline" style={{ color: C.deep }}>People</Link> and delete personal data not needed for tax records.</li>)}
        </ul>
      )}
      <div className="text-xs mt-2" style={{ color: C.mute }}>Privacy requests from clients arrive under Client requests, starting “[Privacy]”. Reply within 7 days.</div>
    </Card>
  );
}

export default function Dashboard() {
  const projects = useRows(() => supabase.from("projects").select("id,slug,name,stage,ended_on,next_meeting_at,next_meeting_note,clients(name)").order("created_at", { ascending: false }), []);
  const inv = useRows(() => supabase.from("invoices").select("*"), []);
  const exp = useRows(() => supabase.from("expenses").select("*"), []);
  const time = useRows(() => supabase.from("time_entries").select("*"), []);
  const svc = useRows(() => supabase.from("project_services").select("*, fee_private(list_price)"), []);
  const req = useRows(() => supabase.from("requests").select("*").in("status", ["new", "accepted", "in_progress"]).order("created_at", { ascending: false }), []);
  const dec = useRows(() => supabase.from("decisions").select("id,project_id,answer,client_visible,status").eq("status", "open"), []);
  const pending = useRows(() => supabase.from("updates").select("id,project_id,title,happened_on").eq("client_visible", false).neq("kind", "note").order("happened_on", { ascending: false }), []);
  const iss = useRows(() => supabase.from("issues").select("id,project_id,title,severity,status,owner").in("status", ["open", "in_progress", "waiting_client", "blocked"]), []);

  const k = useMemo(() => {
    if (![projects, inv, exp, time, svc].every((x) => x.rows)) return null;
    const name = Object.fromEntries(projects.rows.map((p) => [p.id, p.name]));
    const month = ym(today()), months = monthsBack(12), y = today().slice(0, 4);
    const paidOn = (i) => (i.status === "paid" ? i.paid_on || i.issued_on : null);
    const cash = (i) => (i.status === "paid" ? Number(i.paid_amount ?? total(i)) : 0);
    const paidIn = (pred) => inv.rows.filter((i) => paidOn(i) && pred(paidOn(i))).reduce((a, i) => a + cash(i), 0);
    const mine = exp.rows.filter((e) => e.paid_by === "me");
    const spent = (pred) => mine.filter((e) => pred(e.spent_on)).reduce((a, e) => a + Number(e.amount), 0);
    const hrs = (pred) => time.rows.filter((t) => pred(t.started_at)).reduce((a, t) => a + hours(t), 0);
    const since90 = new Date(Date.now() - 90 * 864e5).toISOString();
    const open = inv.rows.filter((i) => i.status === "sent" && balance(i) > 0);
    const overdue = open.filter(isOverdue);
    const mrr = svc.rows.filter((s) => s.kind === "monthly" && RECURRING.includes(s.status)).reduce((a, s) => a + Number(s.price), 0);
    const pipeline = svc.rows.filter((s) => s.status === "Proposed");
    const per = projects.rows.map((p) => {
      const pi = inv.rows.filter((i) => i.project_id === p.id);
      const h = time.rows.filter((t) => t.project_id === p.id).reduce((a, t) => a + hours(t), 0);
      const got = pi.reduce((a, i) => a + cash(i), 0);
      const cost = mine.filter((e) => e.project_id === p.id).reduce((a, e) => a + Number(e.amount), 0);
      return { p, billed: pi.filter((i) => i.status !== "draft" && i.status !== "void").reduce((a, i) => a + total(i), 0), got, due: pi.reduce((a, i) => a + balance(i), 0), cost, h, rate: h ? (got - cost) / h : null };
    });
    return {
      name, open, overdue, mrr, per,
      paidMonth: paidIn((d) => ym(d) === month), paidYear: paidIn((d) => d.startsWith(y)),
      outstanding: open.reduce((a, i) => a + balance(i), 0), overdueSum: overdue.reduce((a, i) => a + balance(i), 0),
      spentMonth: spent((d) => ym(d) === month), hrsMonth: hrs((d) => ym(d) === month),
      rate90: (() => { const h = hrs((d) => d >= since90); const g = paidIn((d) => d >= since90.slice(0, 10)) - spent((d) => d >= since90.slice(0, 10)); return h ? g / h : null; })(),
      discMonth: svc.rows.filter((x) => x.kind === "monthly" && !["Declined", "Stopped"].includes(x.status)).reduce((a, x) => a + Math.max(0, Number(x.fee_private?.list_price ?? x.price) - Number(x.price)), 0),
      discOnce: svc.rows.filter((x) => x.kind === "one-time" && !["Declined", "Stopped"].includes(x.status)).reduce((a, x) => a + Math.max(0, Number(x.fee_private?.list_price ?? x.price) - Number(x.price)), 0),
      pipeline: pipeline.reduce((a, s) => a + Number(s.price) * (s.kind === "monthly" ? 12 : 1), 0), pipelineN: pipeline.length,
      openTimers: time.rows.filter((t) => !t.ended_at),
      chart: months.map((m) => ({
        m: m.slice(2).replace("-", "/"),
        Invoiced: inv.rows.filter((i) => i.status !== "draft" && i.status !== "void" && ym(i.issued_on) === m).reduce((a, i) => a + total(i), 0),
        Received: paidIn((d) => ym(d) === m),
        Expenses: spent((d) => ym(d) === m),
      })),
    };
  }, [projects.rows, inv.rows, exp.rows, time.rows, svc.rows]);

  if (!k) return <P>Loading…</P>;
  const errs = [projects, inv, exp, time, svc, req, iss].map((x) => x.error).filter(Boolean);
  const upcoming = projects.rows.filter((p) => p.next_meeting_at && p.next_meeting_at >= new Date(Date.now() - 864e5).toISOString()).sort((a, b) => a.next_meeting_at.localeCompare(b.next_meeting_at));
  const clientWaits = (iss.rows || []).filter((i) => i.status === "waiting_client" || i.owner === "client");

  return (
    <div>
      <div className="flex flex-wrap justify-between items-baseline gap-2">
        <H1>How the studio is doing</H1>
        <div className="text-sm flex gap-4">
          <Link to="/studio/new" style={{ color: C.deep, fontWeight: 600 }}>+ New project</Link>
          <Link to="/studio/users" style={{ color: C.deep }}>People and clinics</Link>
          <Link to="/studio/pricing" style={{ color: C.deep }}>Price list</Link>
          <Link to="/studio/compare" style={{ color: C.deep }}>Compare</Link>
          <Link to="/studio/overheads" style={{ color: C.deep }}>Overheads</Link>
        </div>
      </div>
      {errs.length > 0 && <Box tone="bad" title="Some data did not load">{errs[0].message}</Box>}

      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 mb-4">
        <Stat label="Received this month" value={inr(k.paidMonth)} note={`${inr(k.paidYear)} this year`} />
        <Stat label="Owed to you" value={inr(k.outstanding)} note={`${k.open.length} invoices sent`} tone={k.outstanding ? "warn" : null} />
        <Stat label="Overdue" value={inr(k.overdueSum)} note={`${k.overdue.length} invoices`} tone={k.overdue.length ? "bad" : "good"} />
        <Stat label="Monthly recurring" value={inr(k.mrr)} note="agreed or live retainers" />
        <Stat label="Hours this month" value={k.hrsMonth.toFixed(1)} note={k.openTimers.length ? `${k.openTimers.length} timer(s) without an end` : "all timers closed"} tone={k.openTimers.length ? "warn" : null} />
        <Stat label="Earned per hour, 90 days" value={k.rate90 == null ? "–" : inr(k.rate90)} note={`received minus your expenses ÷ hours. Target ${inr(STUDIO.hourly)}`} tone={k.rate90 == null ? null : k.rate90 >= STUDIO.hourly ? "good" : "warn"} />
        <Stat label="Your expenses this month" value={inr(k.spentMonth)} />
        <Stat label="Proposed, not yet agreed" value={inr(k.pipeline)} note={`${k.pipelineN} services, monthly ones × 12`} />
        <Stat label="Discounts given" value={inr(k.discMonth) + " / month"} note={`${inr(k.discOnce)} on one-time work, vs standard prices`} tone={k.discMonth || k.discOnce ? "warn" : null} />
      </div>

      <H2>Needs you</H2>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <div className="font-semibold text-sm mb-2" style={{ color: C.deep }}>Payment reminders</div>
          {!k.open.length ? <div className="text-sm" style={{ color: C.mute }}>Nothing owed.</div> : (
            <ul className="text-sm grid gap-2">
              {[...k.open].sort((a, b) => a.due_on.localeCompare(b.due_on)).map((i) => (
                <li key={i.id} className="flex flex-wrap justify-between gap-2">
                  <span>{k.name[i.project_id]} · {i.number} · {inr(balance(i))} {isOverdue(i) ? <Chip tone="bad">{daysLate(i)} days late</Chip> : <Chip tone="warn">due {fmtDate(i.due_on)}</Chip>}
                    {i.last_reminded_at && <span className="text-xs" style={{ color: C.mute }}> reminded {fmtDate(i.last_reminded_at.slice(0, 10))}</span>}</span>
                  <Remind inv={i} project={k.name[i.project_id]} onDone={inv.reload} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <div className="font-semibold text-sm mb-2" style={{ color: C.deep }}>Client requests</div>
          {!(req.rows || []).length ? <div className="text-sm" style={{ color: C.mute }}>No open requests.</div> : (
            <ul className="text-sm grid gap-2">
              {req.rows.map((r) => (
                <li key={r.id}>
                  <Chip tone={r.status === "new" ? "warn" : "info"}>{r.status}</Chip> <b>{k.name[r.project_id]}</b>: {r.details.slice(0, 90)}
                  <span className="text-xs" style={{ color: C.mute }}> · {r.priority} · {fmtDate(r.created_at.slice(0, 10))}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <WeeklyCard projects={projects.rows} upcoming={upcoming} />
        <Card>
          <div className="font-semibold text-sm mb-2" style={{ color: C.deep }}>Updates waiting for your approval</div>
          {!(pending.rows || []).length ? <div className="text-sm" style={{ color: C.mute }}>Nothing waiting. Clients see every update you have approved.</div> : (
            <ul className="text-sm grid gap-1">
              {pending.rows.slice(0, 6).map((u) => {
                const p = projects.rows.find((x) => x.id === u.project_id);
                return <li key={u.id}><Link to={`/studio/p/${p?.slug}`} className="underline" style={{ color: C.deep }}>{p?.name}</Link>: {u.title} <span className="text-xs" style={{ color: C.mute }}>{fmtDate(u.happened_on)}</span></li>;
              })}
              {pending.rows.length > 6 && <li className="text-xs" style={{ color: C.mute }}>and {pending.rows.length - 6} more</li>}
            </ul>
          )}
        </Card>
        <Card>
          <div className="font-semibold text-sm mb-2" style={{ color: C.deep }}>Decisions</div>
          {(() => {
            const open = dec.rows || [];
            const waiting = open.filter((d) => d.client_visible && !d.answer), answered = open.filter((d) => d.answer), drafts = open.filter((d) => !d.client_visible);
            if (!open.length) return <div className="text-sm" style={{ color: C.mute }}>No open decisions.</div>;
            const per = [...new Set(open.map((d) => d.project_id))].map((pid) => projects.rows.find((x) => x.id === pid)).filter(Boolean);
            return (
              <div className="text-sm">
                {waiting.length} waiting on clients · {answered.length} answered, to close · {drafts.length} drafts
                <div className="mt-1">{per.map((p) => <Link key={p.id} to={`/studio/p/${p.slug}`} className="underline mr-3" style={{ color: C.deep }}>{p.name}</Link>)}</div>
              </div>
            );
          })()}
        </Card>
        <OpenActions projects={projects.rows} />
        <PrivacyCard projects={projects.rows} />
        <Card>
          <div className="font-semibold text-sm mb-2" style={{ color: C.deep }}>Open issues</div>
          <div className="text-sm">
            {(iss.rows || []).length} open across projects · {(iss.rows || []).filter((i) => ["critical", "high"].includes(i.severity)).length} critical or high · {clientWaits.length} waiting on clients
          </div>
        </Card>
      </div>

      <H2>Money, last 12 months</H2>
      <div style={{ width: "100%", height: 260 }}>
        <ResponsiveContainer>
          <BarChart data={k.chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={C.rule} vertical={false} />
            <XAxis dataKey="m" tick={{ fontSize: 11, fill: C.mute }} />
            <YAxis tick={{ fontSize: 11, fill: C.mute }} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
            <Tooltip formatter={(v, n) => [inr(v), n]} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Invoiced" fill={C.info} radius={[2, 2, 0, 0]} />
            <Bar dataKey="Received" fill={C.good} radius={[2, 2, 0, 0]} />
            <Bar dataKey="Expenses" fill={C.warn} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <H2>Projects</H2>
      <T head={["Project", "Client", "Stage", "Billed", "Received", "Owed", "Hours", "Per hour"]} right={[3, 4, 5, 6, 7]}
        rows={k.per.map(({ p, billed, got, due, h, rate }) => [
          <Link key={p.id} to={`/studio/p/${p.slug}`} className="font-semibold" style={{ color: C.deep }}>{p.name}</Link>,
          p.clients?.name || "", (STAGES.find(([id]) => id === p.stage) || [, p.stage])[1],
          inr(billed), inr(got), due ? <span key="d" style={{ color: C.warn }}>{inr(due)}</span> : "–", h.toFixed(1), rate == null ? "–" : inr(rate),
        ])} />
      {!projects.rows.length && <P style={{ color: C.mute }}>No projects yet. <Link to="/studio/new" className="underline">Create the first one</Link>.</P>}
    </div>
  );
}
