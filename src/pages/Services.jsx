import { inr, H1, H2, P } from "../components/ui.jsx";
import { STUDIO } from "../data/studio.js";
import { PublicPriceList } from "../components/pricing.jsx";

export default function Services() {
  return (
    <div>
      <H1>Services and pricing</H1>
      <P>Typical prices. Every project is quoted on its own scope, tools and effort, and agreed in writing before work starts. Your agreed fees are on your project’s Money tab. {STUDIO.gstNote}</P>
      <PublicPriceList />
      <H2>Payment terms</H2>
      <ul className="text-sm pl-5" style={{ listStyle: "disc", lineHeight: 1.7 }}>
        {STUDIO.paymentTerms.map((t) => <li key={t}>{t}</li>)}
        <li>Extra work: {inr(STUDIO.hourly)} an hour, agreed before it starts.</li>
      </ul>
    </div>
  );
}
