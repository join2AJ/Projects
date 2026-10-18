/* Interactive quote for one project: tick services on or off during a meeting and see the totals move. */
import { useState } from "react";
import { C, inr, Chip, H2, P, Box, T, Status } from "./ui.jsx";
import { SERVICES, BUNDLE, STUDIO } from "../data/studio.js";

export default function Quote({ project, adSpendMonthly }) {
  const [on, setOn] = useState(() => Object.fromEntries(project.services.map((s) => [s.id, true])));
  const picked = project.services.filter((s) => on[s.id]).map((s) => ({ ...s, svc: SERVICES[s.id] }));
  const oneTime = picked.filter((s) => s.svc.kind === "one-time").reduce((a, s) => a + s.svc.price, 0);
  const monthlyRaw = picked.filter((s) => s.svc.kind === "monthly").reduce((a, s) => a + s.svc.price, 0);
  const bundled = BUNDLE.services.every((id) => on[id] && project.services.some((s) => s.id === id));
  const monthly = monthlyRaw - (bundled ? BUNDLE.discount : 0);
  const year = oneTime + monthly * 12;

  return (
    <div>
      <H2>Scope and fees</H2>
      <P>Untick a service to see the totals without it. Fees exclude GST. Ad spend goes from the clinic’s card straight to Google and is shown separately.</P>
      <div className="grid gap-3 mb-4">
        {project.services.map((s) => {
          const svc = SERVICES[s.id];
          return (
            <label key={s.id} className="flex gap-3 p-3 cursor-pointer" style={{ background: C.card, border: `1px solid ${on[s.id] ? C.deep : C.rule}`, borderRadius: 4, opacity: on[s.id] ? 1 : 0.6 }}>
              <input type="checkbox" checked={on[s.id]} onChange={() => setOn({ ...on, [s.id]: !on[s.id] })} className="mt-1" />
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 justify-between">
                  <span className="font-semibold text-sm">{svc.name}</span>
                  <span className="text-sm" style={{ color: C.deep, fontWeight: 600 }}>
                    {inr(svc.price)}{svc.kind === "monthly" ? " / month" : " one-time"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 items-center mt-1">
                  <Status s={s.status} />
                  {svc.minMonths && <Chip tone="info">min. {svc.minMonths} months</Chip>}
                </div>
                <div className="text-sm mt-1" style={{ color: C.mute }}>{s.note}</div>
              </div>
            </label>
          );
        })}
      </div>
      <T head={["", "Amount"]} right={[1]} rows={[
        ["One-time work", inr(oneTime)],
        ["Monthly services", inr(monthlyRaw)],
        ...(bundled ? [[`${BUNDLE.name} discount (all three monthly services)`, `− ${inr(BUNDLE.discount)}`]] : []),
        [<b key="m">Monthly fee</b>, <b key="mv">{inr(monthly)}</b>],
        [<b key="y">First 12 months of fees</b>, <b key="yv">{inr(year)}</b>],
        ["Ad spend, paid to Google (₹200/day incl. GST)", `about ${inr(adSpendMonthly)} / month`],
      ]} />
      {!bundled && BUNDLE.services.every((id) => project.services.some((s) => s.id === id)) && (
        <Box tone="info" title={`Tip: ${BUNDLE.name}`}>Taking Ads management, maintenance and SEO together saves {inr(BUNDLE.discount)} a month.</Box>
      )}
      <H2>Payment terms</H2>
      <ul className="text-sm mb-4 pl-5" style={{ listStyle: "disc", lineHeight: 1.7 }}>
        {STUDIO.paymentTerms.map((t) => <li key={t}>{t}</li>)}
        {SERVICES["website-redesign"].milestones && on["website-redesign"] && (
          <li>Website redesign: {SERVICES["website-redesign"].milestones.map(([m, p]) => `${p}% at ${m.toLowerCase()}`).join(", ")}.</li>
        )}
        <li>Extra work outside these services: {inr(STUDIO.hourly)} an hour, agreed before it starts.</li>
      </ul>
    </div>
  );
}
