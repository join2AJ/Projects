import { C, H1, H2, P, T, Card } from "../components/ui.jsx";
import { ONBOARDING, OFFBOARDING, STAGES } from "../data/studio.js";
import { FeedbackForm } from "../components/forms.jsx";
import { TimetableTable } from "../components/parts.jsx";

export default function Process() {
  return (
    <div>
      <H1>How we work together</H1>
      <P>A clear start, a steady rhythm, and a clean handover. You always own your accounts, your domain and your files.</P>

      <H2>The journey</H2>
      <T head={["#", "Stage", "What happens"]} rows={STAGES.map(([, l, d], i) => [i + 1, <b key={l}>{l}</b>, d])} />

      <H2>Onboarding: your first week</H2>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <div className="font-semibold text-sm mb-2" style={{ color: C.deep }}>What you get</div>
          <ul className="text-sm pl-5" style={{ listStyle: "disc", lineHeight: 1.7 }}>{ONBOARDING.welcome.map((x) => <li key={x}>{x}</li>)}</ul>
        </Card>
        <Card>
          <div className="font-semibold text-sm mb-2" style={{ color: C.deep }}>My promises</div>
          <ul className="text-sm pl-5" style={{ listStyle: "disc", lineHeight: 1.7 }}>{ONBOARDING.promises.map((x) => <li key={x}>{x}</li>)}</ul>
        </Card>
      </div>
      <H2>Access I may ask for</H2>
      <P>Only what the work needs. Always by invite to my own email, so every change is traceable and you can remove me in one click.</P>
      <T head={["Tool", "Access level"]} rows={Object.entries(ONBOARDING.access)} />

      <H2>Every week: the timetable</H2>
      <P>The same timetable for every client. Your written update appears on your project page every Tuesday at 11:00 IST. Budgets never change without your written OK.</P>
      <TimetableTable />

      <H2>Handover: when a project ends</H2>
      <T head={["Step", "What you get"]} rows={OFFBOARDING.map(([a, b]) => [<b key={a}>{a}</b>, b])} />

      <H2>Feedback</H2>
      <FeedbackForm />
    </div>
  );
}
