import { useSearchParams } from "react-router-dom";
import { H1, P } from "../components/ui.jsx";
import { RequestForm } from "../components/forms.jsx";

export default function Request() {
  const [q] = useSearchParams();
  return (
    <div>
      <H1>Send a request</H1>
      <P>New work, a change, something broken, or a question. It reaches me straight away, and I reply the same working day.</P>
      <RequestForm project={q.get("project") || ""} />
    </div>
  );
}
