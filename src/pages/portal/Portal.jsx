/* What a client sees after signing in: their projects, and one project in detail. */
import { useEffect, useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabase.js";
import { useAuth } from "../../lib/auth.jsx";
import { useRows } from "../../lib/useRows.js";
import { C, H1, H2, P, Box, T, Tabs, Card } from "../../components/ui.jsx";
import { StageBar, UpdatesList, IssuesList, DueBanner, MoneyClient, MetricsPanel, FilesPanel, ReportPanel, DecisionsClient, DecisionsBanner, TimetableBox } from "../../components/parts.jsx";
import { REPORTS } from "../../projects/reports.js";
import { Timeline } from "../../components/activity.jsx";
import { RequestThreads, WorkLog, YourData } from "../../components/collab.jsx";
import { MeetingNotes } from "../../components/meetings.jsx";
import { PromotionPlan } from "../../components/promotion.jsx";
import { TabIndex } from "../../components/tabindex.jsx";
import { NavTabs, flatTabs } from "../../components/navtabs.jsx";
import { Gantt } from "../../components/gantt.jsx";
import { track } from "../../lib/track.js";

export function Portal() {
  const { session, profile } = useAuth();
  const { rows, error } = useRows(() => supabase.from("projects").select("slug,name,stage,summary,next_meeting_at").order("created_at", { ascending: false }), []);
  if (profile?.is_owner) return <Navigate to="/studio" replace />;
  if (rows?.length === 1) return <Navigate to={`/portal/p/${rows[0].slug}`} replace />;
  return (
    <div>
      <H1>Your projects</H1>
      {error && <Box tone="bad" title="Could not load">{error.message}</Box>}
      {rows && !rows.length && <Box tone="info" title="No projects yet">Your email has not been added to a project. Ask Ajay to add {session.user.email}.</Box>}
      <div className="grid gap-3">
        {(rows || []).map((p) => (
          <Card key={p.slug}>
            <Link to={`/portal/p/${p.slug}`} className="font-semibold" style={{ color: C.deep }}>{p.name}</Link>
            <div className="text-sm" style={{ color: C.mute }}>{p.summary}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Overview({ p, go }) {
  const svc = useRows(() => supabase.from("project_services").select("*").eq("project_id", p.id).eq("client_visible", true).order("created_at"), [p.id]);
  return (
    <div>
      <H1>{p.name}</H1>
      <P>{p.summary} {p.brief}</P>
      {p.money_open && <DueBanner projectId={p.id} />}
      <DecisionsBanner projectId={p.id} onOpen={() => go("decisions")} />
      <TimetableBox projectId={p.id} extra={{ at: p.next_meeting_at, note: p.next_meeting_note }} />
      <H2>Where we are</H2>
      <StageBar stage={p.stage} />
      <H2>Services</H2>
      <T head={["Service", "Status", "Detail"]} rows={(svc.rows || []).map((s) => [<b key={s.id}>{s.name}</b>, s.status, s.note || ""])} />
      <div className="grid gap-6 md:grid-cols-2">
        <div><H2>Latest updates</H2><UpdatesList projectId={p.id} limit={5} mode="latest" /></div>
        <div><H2>Coming up</H2><UpdatesList projectId={p.id} limit={4} mode="upcoming" /></div>
      </div>
    </div>
  );
}

export function PortalProject() {
  const { slug } = useParams();
  const { rows, error } = useRows(() => supabase.from("projects").select("*").eq("slug", slug), [slug]);
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "overview";
  const setTab = (t) => setParams(t === "overview" ? {} : { tab: t });
  const p0 = rows?.[0];
  useEffect(() => { if (p0) track(`/portal/p/${p0.slug}`, p0.id, tab); }, [p0?.id, tab]);
  if (error) return <Box tone="bad" title="Could not load">{error.message}</Box>;
  if (!rows) return <P>Loading…</P>;
  const p = rows[0];
  if (!p) return <Box tone="warn" title="Project not found">This project is not shared with your email. <Link to="/portal" className="underline">Your projects</Link></Box>;
  const since = (p.started_on || new Date().toISOString()).slice(0, 8) + "01";
  const groups = [
    ["index", "Index", [["index", "Index"]]],
    ["home", "Overview", [["overview", "Overview"], ["timeline", "Timeline"]]],
    ["plan", "Plan", [["promotion", "Promotion plan"], ["meetings", "Meeting notes"], ["decisions", "Decisions"], ["gantt", "Timeline chart"]]],
    ["progress", "Progress", [["updates", "Updates"], ["work", "Work done"], ["issues", "Issues"]]],
    ["results", "Results", [["numbers", "Current results"], ["report", "Previous reports & analysis"]]],
    ["requests", "Requests", [["requests", "Requests"]]],
    ["money", "Money", [["money", "Money"]]],
    ["files", "Files", [["files", "Files"], ["data", "Your data"]]],
  ];
  const tabs = flatTabs(groups);
  return (
    <div>
      <div className="text-sm mb-1 flex justify-between" style={{ color: C.mute }}>
        <Link to="/portal" style={{ color: C.deep }}>← Your projects</Link>
      </div>
      <NavTabs label="Project sections" groups={groups} value={tab} onChange={setTab} />
      {tab === "overview" && <Overview p={p} go={setTab} />}
      {tab === "decisions" && <DecisionsClient projectId={p.id} />}
      {tab === "index" && <TabIndex tabs={tabs} slug={p.slug} onOpen={setTab} />}
      {tab === "timeline" && <Timeline project={p} />}
      {tab === "meetings" && <MeetingNotes projectId={p.id} />}
      {tab === "gantt" && <Gantt projectId={p.id} />}
      {tab === "promotion" && <PromotionPlan projectId={p.id} />}
      {tab === "updates" && <UpdatesList projectId={p.id} />}
      {tab === "issues" && <IssuesList projectId={p.id} />}
      {tab === "money" && (p.money_open ? <MoneyClient projectId={p.id} /> : (
        <Box tone="info" title="Coming soon">
          Your fees and payments will appear here once we have agreed the scope together. Nothing is charged until then.
        </Box>
      ))}
      {tab === "files" && <FilesPanel projectId={p.id} />}
      {tab === "requests" && <RequestThreads projectId={p.id} />}
      {tab === "work" && <WorkLog projectId={p.id} reportKey={p.report_key} onOpenReport={() => setTab("report")} />}
      {tab === "numbers" && <MetricsPanel projectId={p.id} from={since} empty="Figures for the new campaign will appear here after the first weekly review." />}
      {tab === "report" && (<>
        <P>Earlier results and our analysis of them. Current results are on the Current results tab.</P>
        <H2>Figures before {new Date(since).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</H2>
        <MetricsPanel projectId={p.id} before={since} empty="No earlier figures." />
        {p.report_key && REPORTS[p.report_key] && <><H2>{REPORTS[p.report_key].label}</H2><ReportPanel reportKey={p.report_key} /></>}
      </>)}
      {tab === "data" && <YourData project={p} />}
    </div>
  );
}
