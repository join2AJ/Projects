/* Records which page and section a client opens (listed in the privacy notice). The admin's own views are not recorded. */
import { supabase } from "./supabase.js";

let last = "";
export function track(path, projectId = null, tab = null) {
  const key = `${path}|${tab || ""}`;
  if (key === last) return;
  last = key;
  // Fire and forget: a failed insert must never get in the client's way
  supabase.from("page_views").insert({ path, project_id: projectId, tab }).then(() => {}, () => {});
}
