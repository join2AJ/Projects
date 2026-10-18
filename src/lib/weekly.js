/*
 * Weekly updates. Stored as updates of kind "meeting" (shown as "Weekly update") with publish_at set to
 * Tuesday 11:00 IST. Clients see one only after it is approved and that time has passed (database rule).
 */
import { supabase } from "./supabase.js";
import { fmtDate } from "./money.js";
import { nextWeeklyUpdate, istDate, answerBy, WEEKLY } from "../data/studio.js";

export const WEEKLY_KIND = "meeting";
export const KIND_LABEL = { meeting: "Weekly update", work: "Work", milestone: "Milestone", decision: "Decision", note: "Private note" };

/* This week's slot: the next Tuesday 11:00 (today, if before 11:00 on a Tuesday). */
export const thisWeek = () => {
  const at = nextWeeklyUpdate();
  return { at, day: istDate(at) };
};

const OPEN_ISSUE = ["open", "in_progress", "waiting_client", "blocked"];

/* Create a draft weekly update for a project, pre-filled from the last 7 days. Returns {existed} or {id}. */
export async function draftWeekly(project) {
  const { at, day } = thisWeek();
  const have = await supabase.from("updates").select("id").eq("project_id", project.id).eq("kind", WEEKLY_KIND).eq("happened_on", day);
  if (have.error) throw have.error;
  if (have.data.length) return { existed: true, id: have.data[0].id };

  const since = new Date(at.getTime() - 7 * 864e5).toISOString().slice(0, 10);
  const [done, iss, dec, inv] = await Promise.all([
    supabase.from("updates").select("title").eq("project_id", project.id).not("kind", "in", `(${WEEKLY_KIND},note)`)
      .eq("status", "Done").gte("happened_on", since).lte("happened_on", day).order("happened_on"),
    supabase.from("issues").select("title,owner").eq("project_id", project.id).in("status", OPEN_ISSUE).eq("client_visible", true),
    supabase.from("decisions").select("question").eq("project_id", project.id).eq("status", "open").eq("client_visible", true).is("answer", null).order("sort"),
    supabase.from("invoices").select("number,due_on").eq("project_id", project.id).eq("status", "sent"),
  ]);
  for (const r of [done, iss, dec, inv]) if (r.error) throw r.error;

  const list = (rows, f, empty) => (rows.length ? rows.map((r) => `- ${f(r)}`).join("\n") : `- ${empty}`);
  const yours = iss.data.filter((i) => i.owner === "client");
  const body = [
    "Done this week",
    list(done.data, (r) => r.title, "(add what was done)"),
    "",
    "Results",
    "- (add the numbers that matter this week)",
    "",
    "Issues",
    `- ${iss.data.length} open${yours.length ? `, ${yours.length} waiting on you: ${yours.map((i) => i.title).join("; ")}` : ""}`,
    "",
    `Decisions needed by ${fmtDate(answerBy(day))} (Decisions tab)`,
    list(dec.data, (r) => r.question, "None this week"),
    ...(inv.data.length ? ["", "Payments", list(inv.data, (r) => `${r.number} due ${fmtDate(r.due_on)}`, "")] : []),
    "",
    "Next week",
    "- (add the plan)",
  ].join("\n");

  const { data, error } = await supabase.from("updates").insert({
    project_id: project.id, kind: WEEKLY_KIND, happened_on: day, publish_at: at.toISOString(),
    title: `Weekly update, ${fmtDate(day)}`, body, status: "Done", client_visible: false,
  }).select("id").single();
  if (error) throw error;
  return { id: data.id };
}

export const weeklyLabel = (at = nextWeeklyUpdate()) =>
  `${at.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}, ${String(WEEKLY.hour).padStart(2, "0")}:${String(WEEKLY.minute).padStart(2, "0")} IST`;
