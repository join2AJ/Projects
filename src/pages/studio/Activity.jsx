/* Admin: the audit trail across every project, plus sign-ins and account changes. */
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase.js";
import { useRows } from "../../lib/useRows.js";
import { AuditTrail } from "../../components/activity.jsx";
import { C, H1 } from "../../components/ui.jsx";

export function ActivityPage() {
  const projects = useRows(() => supabase.from("projects").select("id,name"), []);
  return (
    <div>
      <div className="text-sm mb-1"><Link to="/studio" style={{ color: C.deep }}>← Dashboard</Link></div>
      <H1>Activity</H1>
      <AuditTrail projects={projects.rows || []} />
    </div>
  );
}
