/*
 * A client's project portal. The studio view (pages/Studio.jsx) reuses it and passes in its private
 * extras, so nothing private is imported here or bundled into the client share build.
 */
import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { C, H1, H2, P, Box, T, Tabs, Pills, Status } from "../components/ui.jsx";
import { STAGES, SERVICES, OFFBOARDING } from "../data/studio.js";
import { findProject } from "../data/projects.js";
import Quote from "../components/Quote.jsx";
import { RequestForm, FeedbackForm } from "../components/forms.jsx";
import * as tailbone from "../projects/tailbone/audit.jsx";
import { MeetingBrief } from "../projects/tailbone/meeting.jsx";

/* Findings per project: [id, label, component]. */
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

function Findings({ f, extra = [] }) {
  const tabs = [...f.tabs, ...extra];
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

/* studio = { findings: {key: [[id, label, Component]]}, Tab: Component } adds private tabs. */
export default function Project({ studio }) {
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
    ...(studio ? [["internal", "Internal"]] : []),
  ];
  const [tab, setTab] = useState("overview");
  if (!p) return <P>Project not found. Check the link you were sent.</P>;
  const Meeting = f?.meeting;
  return (
    <div>
      <div className="text-sm mb-1" style={{ color: C.mute }}>{studio ? <Link to="/studio" style={{ color: C.deep }}>← All projects</Link> : "Client project page"}</div>
      <Tabs label="Project sections" tabs={tabs} value={tab} onChange={setTab} />
      {tab === "overview" && <Overview p={p} />}
      {tab === "meeting" && <Meeting />}
      {tab === "findings" && <Findings f={f} extra={studio?.findings?.[p.findings]} />}
      {tab === "pricing" && <Quote project={p} adSpendMonthly={f?.adSpendMonthly || 0} />}
      {tab === "onboarding" && <Onboarding p={p} />}
      {tab === "requests" && <Requests p={p} />}
      {tab === "handover" && <Handover p={p} />}
      {tab === "internal" && <studio.Tab p={p} />}
    </div>
  );
}
