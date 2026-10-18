import { Link } from "react-router-dom";
import { C, H1, H2, P, Card } from "../components/ui.jsx";
import { STUDIO, SERVICES, STAGES } from "../data/studio.js";

export default function Home() {
  return (
    <div>
      <H1>{STUDIO.tagline}</H1>
      <P>Every client gets a private project page: what is being worked on, what was found, what it costs, and what comes next. You can send new requests from the same page at any time.</P>

      <H2>What I do</H2>
      <div className="grid gap-3 md:grid-cols-2 mb-4">
        {Object.entries(SERVICES).map(([id, s]) => (
          <Card key={id}>
            <div className="font-semibold text-sm mb-1" style={{ color: C.deep }}>{s.name}</div>
            <div className="text-sm" style={{ color: C.mute }}>{s.summary}</div>
          </Card>
        ))}
      </div>
      <Link to="/services" className="text-sm font-semibold" style={{ color: C.deep }}>See prices →</Link>

      <H2>How a project runs</H2>
      <ol className="grid gap-2 md:grid-cols-7 text-sm mb-4">
        {STAGES.map(([id, l, d], i) => (
          <li key={id} className="p-3" style={{ background: C.card, border: `1px solid ${C.rule}`, borderRadius: 4 }}>
            <div className="text-xs" style={{ color: C.mute }}>{i + 1}</div>
            <div className="font-semibold" style={{ color: C.deep }}>{l}</div>
            <div className="text-xs mt-1" style={{ color: C.mute }}>{d}</div>
          </li>
        ))}
      </ol>
      <Link to="/process" className="text-sm font-semibold" style={{ color: C.deep }}>Onboarding and handover in detail →</Link>
    </div>
  );
}
