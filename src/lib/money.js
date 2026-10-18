/* Invoice and money helpers shared by the client portal and the studio dashboard. */

export const TZ = "Asia/Kolkata";
export const today = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ }); // YYYY-MM-DD in India
export const fmtDateTime = (d, opts = { dateStyle: "medium", timeStyle: "short" }) => new Date(d).toLocaleString("en-IN", { timeZone: TZ, ...opts });
export const total = (inv) => Number(inv.amount) + Number(inv.gst || 0);
export const balance = (inv) => (inv.status === "paid" || inv.status === "void" ? 0 : total(inv) - Number(inv.paid_amount || 0));
export const isOverdue = (inv) => inv.status === "sent" && inv.due_on < today() && balance(inv) > 0;
export const daysLate = (inv) => Math.max(0, Math.round((new Date(today()) - new Date(inv.due_on)) / 864e5));

export function invoiceState(inv) {
  if (inv.status === "paid") return ["Paid", "good"];
  if (inv.status === "void") return ["Void", "info"];
  if (inv.status === "draft") return ["Draft", "info"];
  if (isOverdue(inv)) return [`Overdue ${daysLate(inv)} days`, "bad"];
  return ["Due " + fmtDate(inv.due_on), "warn"];
}

export const fmtDate = (d) => (d ? new Date(d + (d.length === 10 ? "T00:00:00" : "")).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: d.length === 10 ? undefined : TZ }) : "");

export const hours = (t) => (t.ended_at ? (new Date(t.ended_at) - new Date(t.started_at)) / 36e5 : 0);

/* A polite WhatsApp/email reminder you can copy. */
export const reminderText = (inv, project, email) =>
  `Hello, a gentle reminder that invoice ${inv.number} for ${project} (₹${Math.round(balance(inv)).toLocaleString("en-IN")}) ` +
  `${isOverdue(inv) ? `was due on ${fmtDate(inv.due_on)}` : `is due on ${fmtDate(inv.due_on)}`}. ` +
  `You can see it in your project page. Thank you. ${email}`;
