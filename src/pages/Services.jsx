import { C, inr, Chip, H1, H2, P, Box, Card } from "../components/ui.jsx";
import { STUDIO, SERVICES, BUNDLE } from "../data/studio.js";

export default function Services() {
  const bundleFull = BUNDLE.services.reduce((a, id) => a + SERVICES[id].price, 0);
  return (
    <div>
      <H1>Services and pricing</H1>
      <P>Fixed fees, agreed in writing before work starts. {STUDIO.gstNote}</P>
      <div className="grid gap-4 md:grid-cols-2">
        {Object.entries(SERVICES).map(([id, s]) => (
          <Card key={id}>
            <div className="flex flex-wrap justify-between items-baseline gap-2">
              <span className="font-semibold" style={{ color: C.deep }}>{s.name}</span>
              <span className="font-semibold">{inr(s.price)}<span className="text-xs" style={{ color: C.mute }}>{s.kind === "monthly" ? " / month" : " one-time"}</span></span>
            </div>
            {s.minMonths && <div className="mt-1"><Chip tone="info">min. {s.minMonths} months</Chip></div>}
            <P style={{ color: C.mute, marginTop: 8 }}>{s.summary}</P>
            <ul className="text-sm pl-5 mb-2" style={{ listStyle: "disc", lineHeight: 1.6 }}>
              {s.includes.map((x) => <li key={x}>{x}</li>)}
            </ul>
            {s.note && <div className="text-xs" style={{ color: C.mute }}>{s.note}</div>}
          </Card>
        ))}
      </div>
      <H2>{BUNDLE.name}</H2>
      <Box tone="good">
        Ads management, maintenance and SEO together: {inr(bundleFull - BUNDLE.discount)} a month instead of {inr(bundleFull)}.
      </Box>
      <H2>Payment terms</H2>
      <ul className="text-sm pl-5" style={{ listStyle: "disc", lineHeight: 1.7 }}>
        {STUDIO.paymentTerms.map((t) => <li key={t}>{t}</li>)}
        <li>Extra work: {inr(STUDIO.hourly)} an hour, agreed before it starts.</li>
      </ul>
    </div>
  );
}
