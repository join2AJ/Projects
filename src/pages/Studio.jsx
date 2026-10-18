/* Your private view: every project, plus internal notes, time logs and internal-only findings. */
import { Link, useParams } from "react-router-dom";
import { C, inr, H1, H2, P, Box, T, Card, Status, Audience } from "../components/ui.jsx";
import { STAGES, SERVICES } from "../data/studio.js";
import { PROJECTS } from "../data/projects.js";
import { INTERNAL } from "../data/projects.internal.js";
import { ConvCheck } from "../projects/tailbone/audit.jsx";
import Project from "./Project.jsx";

const hours = ([a, b]) => (b ? (new Date(b) - new Date(a)) / 36e5 : null);

function Internal({ p }) {
  const n = INTERNAL[p.slug] || { time: [], notes: [] };
  const logged = n.time.map(hours).filter((h) => h != null).reduce((a, b) => a + b, 0);
  return (
    <div>
      <Box tone="warn" title="Studio view">Only you see this tab. It is not in the client share build.</Box>
      <H2>Notes</H2>
      <ul className="text-sm pl-5 mb-4" style={{ listStyle: "disc", lineHeight: 1.7 }}>{n.notes.map((x) => <li key={x}>{x}</li>)}</ul>
      <H2>Time log</H2>
      <T head={["Start", "End", "Hours", "Task"]} right={[2]} rows={n.time.map((r) => [
        r[0].replace("T", " "), r[1] ? r[1].replace("T", " ") : <Status key="o" s="Open" />, hours(r) != null ? hours(r).toFixed(1) : "–", r[2],
      ])} />
      <P style={{ color: C.mute }}>Logged so far: {logged.toFixed(1)} h. Fill in end times in src/data/projects.internal.js. Fixed fees do not depend on hours, but the log shows whether a price was right.</P>
      {n.repo && <P>Related repo: {n.repo}</P>}
    </div>
  );
}

const STUDIO_EXTRAS = {
  findings: { tailbone: [["conv", "Conversion check (internal)", ConvCheck]] },
  Tab: Internal,
};

export function StudioProject() {
  const { slug } = useParams();
  return (
    <Audience.Provider value="studio">
      <Project key={slug} studio={STUDIO_EXTRAS} />
    </Audience.Provider>
  );
}

export default function Studio() {
  return (
    <div>
      <H1>All projects</H1>
      <Box tone="warn" title="Not password-protected">This page is unlisted, not private. Protect it before deploying (see README).</Box>
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
