/* What a client sees after signing in: their projects, and one project in detail. */
import { useEffect, useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabase.js";
import { useAuth } from "../../lib/auth.jsx";
import { useRows } from "../../lib/useRows.js";
import { C, H1, H2, P, Box, Card } from "../../components/ui.jsx";
import { UpdatesList, IssuesList, MoneyClient, MetricsPanel, FilesPanel, ReportPanel, DecisionsClient } from "../../components/parts.jsx";
import { REPORTS } from "../../projects/reports.js";
import { RequestThreads, WorkLog } from "../../components/collab.jsx";
import { MeetingNotes } from "../../components/meetings.jsx";
import { PromotionPlan } from "../../components/promotion.jsx";
import { TabIndex } from "../../components/tabindex.jsx";
import { NavTabs, flatTabs } from "../../components/navtabs.jsx";
import { Campaigns } from "../../components/campaigns.jsx";
import { WebsitePreview } from "../../components/workflow.jsx";
import { useNeedsYou, ClientHome, Deliverables, Cycles, useFocusItem } from "../../components/workflow.jsx";
import { track } from "../../lib/track.js";

export function Portal() {
  const { session, profile } = useAuth();
  const { rows, error } = useRows(() => supabase.from("projects").select("slug,name,code,stage,summary,next_meeting_at,project_members(role,email)").order("created_at", { ascending: false }), []);
  const mine = (p) => (p.project_members || []).find((m) => m.email === (session?.user.email || "").toLowerCase())?.role;
  if (profile?.is_owner) return <Navigate to="/studio" replace />;
  if (rows?.length === 1) return <Navigate to={mine(rows[0]) === "team" ? `/studio/p/${rows[0].slug}` : `/portal/p/${rows[0].slug}`} replace />;
  return (
    <div>
      <H1>Your projects</H1>
      {error && <Box tone="bad" title="Could not load">{error.message}</Box>}
      {rows && !rows.length && <Box tone="info" title="No projects yet">Your email has not been added to a project. Ask Ajay to add {session.user.email}.</Box>}
      <div className="grid gap-3">
        {(rows || []).map((p) => (
          <Card key={p.slug}>
            <Link to={mine(p) === "team" ? `/studio/p/${p.slug}` : `/portal/p/${p.slug}`} className="font-semibold" style={{ color: C.deep }}>{p.name}</Link>
            <span className="text-xs ml-2" style={{ color: C.mute }}>{p.code}</span>
            <div className="text-sm" style={{ color: C.mute }}>{p.summary}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* The signed-in person's role on a project: approver, contributor, viewer or team. */
export function useMyRole(projectId) {
  const { session } = useAuth();
  const email = (session?.user.email || "").toLowerCase();
  // [projectId, role]: the role only counts once it belongs to the project asked about
  const [got, setGot] = useState([null, null]);
  useEffect(() => {
    if (!projectId) return;
    let on = true;
    supabase.from("project_members").select("role").eq("project_id", projectId).eq("email", email)
      .then(({ data }) => on && setGot([projectId, data?.[0]?.role || "viewer"]));
    return () => { on = false; };
  }, [projectId, email]);
  return projectId && got[0] === projectId ? got[1] : null;
}

/* Which optional sections have anything the client can see (empty ones are hidden). */
function useVisible(p, since) {
  const pid = p?.id ?? "";
  const n = (t, extra = (q) => q) => useRows(() => !pid ? Promise.resolve({ data: [{ c: 0 }] }) : extra(supabase.from(t).select("id", { count: "exact", head: true }).eq("project_id", pid)).then((r) => ({ data: [{ c: r.count || 0 }], error: r.error })), [pid, since]);
  const res = {
    meetings: n("meetings", (q) => q.eq("client_visible", true)),
    promotion: n("strategies", (q) => q.eq("client_visible", true)),
    decisions: n("decisions", (q) => q.eq("client_visible", true)),
    issues: n("issues", (q) => q.eq("client_visible", true).in("status", ["open", "in_progress", "waiting_client", "blocked"])),
    approvals: n("deliverables", (q) => q.eq("client_visible", true)),
    monthly: n("cycles", (q) => q.eq("client_visible", true)),
    report: n("metrics", (q) => q.eq("client_visible", true).lt("period", since)),
  };
  if (Object.values(res).some((r) => !r.rows)) return null;
  return Object.fromEntries(Object.entries(res).map(([k, r]) => [k, r.rows[0].c]));
}

const Badge = ({ n }) => (n ? <span className="ml-1 px-1.5 rounded-full text-xs font-semibold" style={{ background: C.warn, color: "#fff" }} aria-label={`${n} need you`}>{n}</span> : null);
const withBadge = (label, n) => (n ? <span>{label}<Badge n={n} /></span> : label);

export function PortalProject() {
  const { slug } = useParams();
  const { profile } = useAuth();
  const { rows, error } = useRows(() => supabase.from("projects").select("*, clients(name)").eq("slug", slug), [slug]);
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "home";
  const setTab = (t, item) => setParams(t === "home" && !item ? {} : item ? { tab: t, item } : { tab: t });
  const p0 = rows?.[0];
  const owner = !!profile?.is_owner;
  // The admin sees the page exactly as the approver does, with every action switched off
  const myRole = useMyRole(owner ? null : p0?.id);
  const role = owner ? (p0 ? "approver" : null) : myRole;
  const since = ((p0?.started_on) || new Date().toISOString()).slice(0, 8) + "01";
  const visible = useVisible(p0 || { id: null }, since);
  useEffect(() => { if (p0 && !owner) track(`/portal/p/${p0.slug}`, p0.id, tab); }, [p0?.id, tab]);
  if (error) return <Box tone="bad" title="Could not load">{error.message}</Box>;
  if (!rows) return <P>Loading…</P>;
  const p = rows[0];
  if (!p) return <Box tone="warn" title="Project not found">This project is not shared with your login. <Link to="/portal" className="underline">Your projects</Link></Box>;
  if (!role) return <P>Loading…</P>;
  if (role === "team") return <Navigate to={`/studio/p/${p.slug}`} replace />;
  const view = <ClientProject p={p} role={role} visible={visible} since={since} tab={tab} setTab={setTab} name={owner ? p.clients?.name : profile?.full_name} preview={owner} />;
  return owner ? (
    <div>
      <div className="mb-4 px-3 py-2 rounded text-sm flex flex-wrap justify-between gap-2" role="status" style={{ background: C.deep, color: "#fff" }}>
        <span>Signed in as <b>admin</b>, viewing <b>{p.clients?.name || "the client"}</b>’s page exactly as they see it. Buttons are switched off here.</span>
        <Link to={`/studio/p/${p.slug}`} className="underline" style={{ color: "#fff" }}>Back to the project</Link>
      </div>
      {view}
    </div>
  ) : view;
}

function ClientProject({ p, role, visible, since, tab, setTab, name, preview = false }) {
  const needs = useNeedsYou(p, role);
  useFocusItem();
  if (!visible) return <P>Loading…</P>;
  const c = needs.counts;
  const show = (k) => visible[k] > 0;
  const plan = [
    show("promotion") && ["promotion", "Promotion plan"],
    show("meetings") && ["meetings", withBadge("Meeting notes", c.meetings)],
    show("decisions") && ["decisions", withBadge("Decisions", c.decisions)],
    show("approvals") && ["approvals", withBadge("Approvals", c.approvals)],
    show("monthly") && ["monthly", withBadge("Monthly reports", c.monthly)],
  ].filter(Boolean);
  const groups = [
    ["home", withBadge("Home", needs.items.length), [["home", "Home"]]],
    ...(plan.length ? [["plan", withBadge("Plan", c.meetings + c.decisions + c.approvals + c.monthly), plan]] : []),
    ["progress", "Progress", [["updates", "Updates"], ...(show("issues") ? [["issues", "Issues"]] : [])]],
    ["results", "Results", [["numbers", "Current results"], ...(show("report") || p.report_key ? [["report", "Previous reports & analysis"]] : [])]],
    ["requests", withBadge("Requests & files", c.requests), [["requests", withBadge("Requests", c.requests)], ["files", "Files"]]],
    ["money", withBadge("Money", c.money), [["money", withBadge("Money", c.money)]]],
  ];
  const tabs = flatTabs(groups);
  const known = tabs.some(([id]) => id === tab) || tab === "index";
  const t = known ? tab : "home";
  const go = (k, item) => setTab(k, item);
  return (
    <div>
      <NavTabs label="Project sections" groups={groups} value={t} onChange={(k) => setTab(k)}
        extra={<button onClick={() => setTab("index")} className="px-3 py-3 text-sm" style={{ color: C.mute }} aria-label="Help: what each section is for">? Help</button>} />
      <fieldset disabled={preview} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }} className={preview ? "preview" : ""}>
      {t === "home" && <ClientHome p={p} role={role} needs={needs} go={go} since={since} name={name} />}
      {t === "index" && <TabIndex tabs={tabs.map(([k, l]) => [k, typeof l === "string" ? l : k])} slug={p.slug} />}
      {t === "promotion" && <PromotionPlan projectId={p.id} />}
      {t === "meetings" && <MeetingNotes projectId={p.id} canMark={["approver", "contributor"].includes(role)} onMarked={needs.reload} />}
      {t === "decisions" && <DecisionsClient projectId={p.id} readOnly={role !== "approver"} />}
      {t === "approvals" && <Deliverables projectId={p.id} role={role} />}
      {t === "monthly" && <Cycles projectId={p.id} role={role} />}
      {t === "updates" && <ClientUpdates p={p} go={go} />}
      {t === "issues" && <IssuesList projectId={p.id} />}
      {t === "money" && <WebsitePreview projectId={p.id} compact />}
      {t === "money" && (p.money_open ? <MoneyClient projectId={p.id} project={p} /> : (<>
        <Box tone="info" title="Coming soon">
          Your fees and payments will appear here once we have agreed the scope together. Nothing is charged until then.
        </Box>
        {preview && (<>
          <Box tone="warn" title="Only you see this part">Fees are hidden from the client. When you press “Show fees to the client” on the project’s Overview, this is what they get, with a count on Home and on Money until they answer.</Box>
          <MoneyClient projectId={p.id} project={p} />
        </>)}
      </>))}
      {t === "files" && <FilesPanel projectId={p.id} />}
      {t === "requests" && (role === "viewer" ? <ReadOnlyNote what="send requests" /> : null)}
      {t === "requests" && <RequestThreads projectId={p.id} readOnly={role === "viewer"} />}
      {t === "numbers" && (<>
        <Campaigns projectId={p.id} />
        <MetricsPanel projectId={p.id} from={since} empty="Figures for the new campaign will appear here after the first weekly review." />
      </>)}
      {t === "report" && (<>
        <P>Earlier results and our analysis of them. Current results are on the Current results tab.</P>
        <H2>Figures before {new Date(since).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</H2>
        <MetricsPanel projectId={p.id} before={since} empty="No earlier figures." />
        {p.report_key && REPORTS[p.report_key] && <><H2>{REPORTS[p.report_key].label}</H2><ReportPanel reportKey={p.report_key} /></>}
      </>)}
      </fieldset>
    </div>
  );
}

const ReadOnlyNote = ({ what }) => <Box tone="info">You can read everything here. To {what}, ask Ajay to give your login a contributor role.</Box>;

/* Updates, with the work-done register as a second view of the same page. */
function ClientUpdates({ p, go }) {
  const [view, setView] = useState("all");
  return (
    <div>
      <div className="flex gap-2 mb-3 text-sm" role="group" aria-label="Show">
        {[["all", "All updates"], ["work", "Work done"]].map(([k, l]) => (
          <button key={k} onClick={() => setView(k)} aria-pressed={view === k} className="px-3 py-1 rounded-full text-xs"
            style={{ border: `1px solid ${view === k ? C.deep : C.rule}`, background: view === k ? C.deep : C.card, color: view === k ? "#fff" : C.ink }}>{l}</button>
        ))}
      </div>
      {view === "all" ? <UpdatesList projectId={p.id} /> : <WorkLog projectId={p.id} reportKey={p.report_key} onOpenReport={() => go("report")} />}
    </div>
  );
}
