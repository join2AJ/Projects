/*
 * A client's project portal. The same page serves the studio view (internal = true), which adds
 * internal-only findings tabs, notes and the time log.
 */
import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { C, inr, H1, H2, P, Box, T, Tabs, Pills, Status, Card } from "../components/ui.jsx";
import { STAGES, SERVICES, OFFBOARDING } from "../data/studio.js";
import { PROJECTS, findProject } from "../data/projects.js";
import Quote from "../components/Quote.jsx";
import { RequestForm, FeedbackForm } from "../components/forms.jsx";
import * as tailbone from "../projects/tailbone/audit.jsx";
import { MeetingBrief } from "../projects/tailbone/meeting.jsx";

/* Findings per project: [id, label, component, internalOnly]. */
const FINDINGS = {
  tailbone: {
    meeting: MeetingBrief,
    adSpendMonthly: 200 * tailbone.DAYS * tailbone.GST,
    tabs: [
      ["rw", "Right vs wrong", tailbone.RightWrong],
      ["verdict", "Verdict", tailbone.Verdict],
      ["issues", "Issues and fixes", tailbone.Issues],
      ["owner", "Campaign set-up", tailbone.OwnerBrief],
      ["roi", "Campaign ROI", tailbone.RoiTab],
      ["audit", "Conversion audit", tailbone.ConvAudit],
      ["habits", "Spending habits", tailbone.Habits],
      ["budget", "Future budget", tailbone.Budget],
      ["plan", "12-month plan", tailbone.Plan12],
      ["actions", "Action plan", tailbone.Actions],
      ["basics", "Google Ads basics", tailbone.Basics],
      ["framework", "How we check", tailbone.Framework],
      ["conv", "Conversion check", tailbone.ConvCheck, true],
    ],
  },
};

function Overview({ p }) {
  const at = STAGES.findIndex(([id]) => id === p.stage);
  return (
    <div>
      <H1>{p.name}</H1>
      <P>{p.client.name} · {p.client.org}. {p.brief}</P>
      {p.nextMeeting && <Box tone="info" title={`Next meeting: ${p.nextMeeting.when}`}>{p.nextMeeting.what}</Box>}

      <H2>Where we are</H2>
      <ol className="flex flex-wrap gap-2 mb-4 text-xs">
        {STAGES.map(([id, l], i) => (
          <li key={id} className="px-3 py-2 rounded" style={{
            background: i < at ? C.goodBg : i === at ? C.deep : C.card,
            color: i < at ? C.good : i === at ? "#fff" : C.mute, border: `1px solid ${i === at ? C.deep : C.rule}`, fontWeight: i === at ? 700 : 400,
          }}>{i + 1}. {l}</li>
        ))}
      </ol>

      <H2>Services</H2>
      <T head={["Service", "Status", "Detail"]} rows={p.services.map((s) => [<b key={s.id}>{SERVICES[s.id].name}</b>, <Status key="s" s={s.status} />, s.note])} />

      <H2>Timeline</H2>
      <T head={["When", "What", "Status"]} rows={p.timeline.map(([w, t, s]) => [<span key={w} className="whitespace-nowrap">{w}</span>, t, <Status key="s" s={s} />])} />
    </div>
  );
}

function Findings({ f, internal }) {
  const tabs = f.tabs.filter((t) => internal || !t[3]);
  const [tab, setTab] = useState(tabs[0][0]);
  const Active = tabs.find((t) => t[0] === tab)[2];
  return (
    <div>
      <Pills label="Findings sections" options={tabs.map(([id, l, , i]) => [id, i ? `${l} (internal)` : l])} value={tab} onChange={setTab} />
      <Active />
    </div>
  );
}

function Onboarding({ p }) {
  const done = p.onboarding.filter(([, s]) => s === "Done").length;
  return (
    <div>
      <H2>Getting set up</H2>
      <P>{done} of {p.onboarding.length} done. Items marked “Needs client” are waiting on you. Access is always by invite to my own email, never by sharing passwords.</P>
      <T head={["Item", "Status"]} rows={p.onboarding.map(([t, s]) => [t, <Status key={t} s={s} />])} />
      <P style={{ color: C.mute }}>See <Link to="/process" style={{ color: C.deep }}>How we work</Link> for the full onboarding and handover process.</P>
    </div>
  );
}

function Requests({ p }) {
  return (
    <div>
      <H2>What you have asked for</H2>
      <T head={["Date", "Request", "Status"]} rows={p.requests.map(([d, t, s]) => [d, t, <Status key={t} s={s} />])} />
      <H2>Ask for something new</H2>
      <RequestForm project={p.name} />
    </div>
  );
}

function Handover({ p }) {
  return (
    <div>
      <H2>When this project ends</H2>
      <P>Nothing is locked in. If you stop a service, this is what you get, so the next person can pick up without losing anything.</P>
      <T head={["Step", "What you get"]} rows={OFFBOARDING.map(([a, b]) => [<b key={a}>{a}</b>, b])} />
      <H2>Feedback, any time</H2>
      <FeedbackForm project={p.name} />
    </div>
  );
}

const hours = ([a, b]) => (b ? (new Date(b) - new Date(a)) / 36e5 : null);

function Internal({ p }) {
  const logged = p.internal.time.map(hours).filter((h) => h != null).reduce((a, b) => a + b, 0);
  return (
    <div>
      <Box tone="warn" title="Studio view">Only you should see this tab. The client link is /p/{p.slug}.</Box>
      <H2>Notes</H2>
      <ul className="text-sm pl-5 mb-4" style={{ listStyle: "disc", lineHeight: 1.7 }}>{p.internal.notes.map((n) => <li key={n}>{n}</li>)}</ul>
      <H2>Time log</H2>
      <T head={["Start", "End", "Hours", "Task"]} right={[2]} rows={p.internal.time.map((r) => [
        r[0].replace("T", " "), r[1] ? r[1].replace("T", " ") : <Status key="o" s="Open" />, hours(r) != null ? hours(r).toFixed(1) : "–", r[2],
      ])} />
      <P style={{ color: C.mute }}>Logged so far: {logged.toFixed(1)} h. Fill in end times in src/data/projects.js. Fixed fees do not depend on hours, but the log shows whether a price was right.</P>
      {p.internal.repo && <P>Related repo: {p.internal.repo}</P>}
    </div>
  );
}

export default function Project({ internal = false }) {
  const { slug } = useParams();
  const p = findProject(slug);
  const f = p && FINDINGS[p.findings];
  const tabs = [
    ["overview", "Overview"],
    ...(f?.meeting ? [["meeting", "Meeting brief"]] : []),
    ...(f ? [["findings", "Findings"]] : []),
    ["pricing", "Plan and pricing"],
    ["onboarding", "Onboarding"],
    ["requests", "Requests"],
    ["handover", "Handover"],
    ...(internal ? [["internal", "Internal"]] : []),
  ];
  const [tab, setTab] = useState("overview");
  if (!p) return <P>Project not found. Check the link you were sent.</P>;
  const Meeting = f?.meeting;
  return (
    <div>
      <div className="text-sm mb-1" style={{ color: C.mute }}>{internal ? <Link to="/studio" style={{ color: C.deep }}>← All projects</Link> : "Client project page"}</div>
      <Tabs label="Project sections" tabs={tabs} value={tab} onChange={setTab} />
      {tab === "overview" && <Overview p={p} />}
      {tab === "meeting" && <Meeting />}
      {tab === "findings" && <Findings f={f} internal={internal} />}
      {tab === "pricing" && <Quote project={p} adSpendMonthly={f?.adSpendMonthly || 0} />}
      {tab === "onboarding" && <Onboarding p={p} />}
      {tab === "requests" && <Requests p={p} />}
      {tab === "handover" && <Handover p={p} />}
      {tab === "internal" && <Internal p={p} />}
    </div>
  );
}

export function Studio() {
  return (
    <div>
      <H1>All projects</H1>
      <Box tone="warn" title="Not password-protected">This page is unlisted, not private. Protect it before sharing the site (see README).</Box>
      <div className="grid gap-3">
        {PROJECTS.map((p) => {
          const monthly = p.services.filter((s) => SERVICES[s.id].kind === "monthly").reduce((a, s) => a + SERVICES[s.id].price, 0);
          const waiting = p.onboarding.filter(([, s]) => s === "Needs client").length;
          return (
            <Card key={p.slug}>
              <div className="flex flex-wrap justify-between gap-2 items-baseline">
                <Link to={`/studio/p/${p.slug}`} className="font-semibold" style={{ color: C.deep }}>{p.name}</Link>
                <span className="text-xs" style={{ color: C.mute }}>{p.client.name} · stage: {STAGES.find(([id]) => id === p.stage)[1]}</span>
              </div>
              <div className="text-sm mt-1" style={{ color: C.mute }}>
                {p.services.length} services · {inr(monthly)} / month if all monthly services are agreed · {waiting} items waiting on the client
              </div>
              {p.nextMeeting && <div className="text-sm mt-1">Next: {p.nextMeeting.when}, {p.nextMeeting.what}</div>}
              <div className="text-xs mt-2" style={{ color: C.mute }}>Client link: /p/{p.slug}</div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
