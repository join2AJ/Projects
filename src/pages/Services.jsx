import { H1, H2, P } from "../components/ui.jsx";
import { STUDIO } from "../data/studio.js";
import { PublicPriceList } from "../components/pricing.jsx";

export default function Services() {
  return (
    <div>
      <H1>Services</H1>
      <P>What each service covers. Every project is priced on its own scope, tools and effort. Your fees are on your project’s Money tab, where you can approve each one or suggest your own price. {STUDIO.gstNote}</P>
      <PublicPriceList />
      <H2>Payment terms</H2>
      <ul className="text-sm pl-5" style={{ listStyle: "disc", lineHeight: 1.7 }}>
        {STUDIO.paymentTerms.map((t) => <li key={t}>{t}</li>)}
        <li>Extra work is quoted and agreed with you before it starts.</li>
      </ul>
    </div>
  );
}
