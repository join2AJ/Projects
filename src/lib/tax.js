/* GST: charged only when the business has a GSTIN, and the project has GST switched on. */
import { supabase } from "./supabase.js";
import { useRows } from "./useRows.js";

export function useBusiness(key = null) {
  const r = useRows(() => supabase.from("business_settings").select("*").limit(1), [key]);
  return r.rows ? { ...(r.rows[0] || {}), reload: r.reload } : null;
}

/* { applies, rate, label } for a project; label is what the client reads next to a fee. */
export function taxFor(business, project) {
  const applies = !!business?.gstin && project?.gst_applies !== false;
  const rate = Number(business?.gst_rate ?? 18);
  return { applies, rate, label: applies ? `+ ${rate}% GST` : "No GST" };
}

export const gstOn = (amount, tax) => (tax.applies ? Math.round(Number(amount) * tax.rate) / 100 : 0);
