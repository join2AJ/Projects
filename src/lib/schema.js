/* Field definitions for each table, used by the studio editors. Options match the database checks. */
import { SERVICES } from "../data/studio.js";

const visible = (def = true) => ({ key: "client_visible", label: "Client can see this", type: "bool", hidden: true, def });
const approved = () => ({ key: "client_visible", label: "Approved: client can see this", type: "bool", hidden: true, def: false });

export const CLIENT_STATUS = ["active", "lead", "paused", "past"];

export const FIELDS = {
  decisions: [
    { key: "meeting_on", label: "Meeting date", type: "date" },
    { key: "sort", label: "Order", type: "number" },
    { key: "question", label: "Question (answerable with yes or no)", type: "textarea", required: true },
    { key: "details", label: "Background for the client", type: "textarea" },
    { key: "recommendation", label: "Your recommendation", type: "textarea" },
    { key: "due_on", label: "Answer needed by", type: "date" },
    { key: "client_visible", label: "Sent: client can see and answer this", type: "bool", def: false },
    { key: "answer", label: "Answer (the client sets this; you can fill it in during the meeting)", type: "select", options: [["yes", "Yes"], ["no", "No"], ["other", "Other"]] },
    { key: "answer_note", label: "Answer note", type: "textarea" },
    { key: "status", label: "Status", type: "select", required: true, options: [["open", "Open"], ["closed", "Closed: decided"]] },
    { key: "outcome", label: "Final decision (shown to the client)", type: "textarea" },
  ],
  clients: [
    { key: "name", label: "Client / doctor name", required: true },
    { key: "org", label: "Clinic or business" },
    { key: "status", label: "Status", type: "select", required: true, options: CLIENT_STATUS },
    { key: "phone", label: "Phone" },
    { key: "email", label: "Email", type: "email", lower: true },
    { key: "city", label: "City" },
    { key: "address", label: "Address", type: "textarea", hidden: true },
    { key: "gstin", label: "GSTIN", hidden: true },
    { key: "notes", label: "Notes (private)", type: "textarea", hidden: true },
  ],
  updates: [
    { key: "happened_on", label: "Date", type: "date", required: true },
    { key: "kind", label: "Type", type: "select", required: true, options: ["work", "milestone", "meeting", "decision", "note"] },
    { key: "title", label: "Title", required: true },
    { key: "status", label: "Status", type: "select", required: true, options: ["Done", "In progress", "Scheduled", "Blocked"] },
    { key: "body", label: "Details", type: "textarea" },
    approved(),
  ],
  issues: [
    { key: "title", label: "Issue", required: true },
    { key: "severity", label: "Severity", type: "select", required: true, options: ["critical", "high", "medium", "low"] },
    { key: "status", label: "Status", type: "select", required: true, options: ["open", "in_progress", "waiting_client", "blocked", "resolved", "superseded"] },
    { key: "owner", label: "Who acts", type: "select", required: true, options: [["me", "Me"], ["client", "Client"], ["third_party", "Someone else"]] },
    { key: "raised_on", label: "Raised", type: "date", hidden: true },
    { key: "resolved_on", label: "Resolved", type: "date", hidden: true },
    { key: "evidence", label: "Evidence", type: "textarea", hidden: true },
    { key: "fix", label: "Fix", type: "textarea", hidden: true },
    { key: "now_note", label: "Where it stands", type: "textarea", hidden: true },
    { key: "sort", label: "Order", type: "number", hidden: true },
    visible(),
  ],
  invoices: [
    { key: "number", label: "Number", required: true },
    { key: "description", label: "For" },
    { key: "amount", label: "Amount ex-GST (₹)", type: "number", money: true, required: true },
    { key: "status", label: "Status", type: "select", required: true, options: ["draft", "sent", "paid", "void"] },
    { key: "due_on", label: "Due", type: "date", required: true },
    { key: "issued_on", label: "Issued", type: "date", required: true, hidden: true },
    { key: "gst", label: "GST (₹)", type: "number", money: true, hidden: true },
    { key: "paid_on", label: "Paid on", type: "date", hidden: true },
    { key: "paid_amount", label: "Amount paid (₹)", type: "number", money: true, hidden: true },
  ],
  expenses: [
    { key: "spent_on", label: "Date", type: "date", required: true },
    { key: "description", label: "What", required: true },
    { key: "category", label: "Category", type: "select", required: true, options: ["software", "hosting", "domain", "ads", "stock", "travel", "contractor", "other"] },
    { key: "amount", label: "Amount (₹)", type: "number", money: true, required: true },
    { key: "paid_by", label: "Paid by", type: "select", required: true, options: [["me", "Me"], ["client", "Client"]] },
    { key: "rebillable", label: "Bill it to the client", type: "bool", hidden: true },
    visible(false),
  ],
  time_entries: [
    { key: "started_at", label: "Start", type: "datetime", required: true },
    { key: "ended_at", label: "End", type: "datetime" },
    { key: "task", label: "Task", required: true },
    { key: "billable", label: "Billable", type: "bool" },
  ],
  metrics: [
    { key: "metric", label: "Metric", required: true },
    { key: "period", label: "Month or day", type: "date", required: true },
    { key: "value", label: "Value", type: "number", required: true },
    { key: "unit", label: "Unit" },
    { key: "source", label: "Source" },
    visible(),
  ],
  project_members: [
    { key: "email", label: "Login email", type: "email", required: true, createOnly: true, lower: true },
    { key: "name", label: "Name" },
    { key: "role", label: "Role", type: "select", required: true, options: ["client", "viewer"] },
  ],
  project_services: [
    { key: "service_key", label: "Service", type: "select", required: true, options: [...Object.entries(SERVICES).map(([k, s]) => [k, s.name]), ["custom", "Custom"]] },
    { key: "name", label: "Name shown to client", required: true },
    { key: "kind", label: "Billing", type: "select", required: true, options: ["one-time", "monthly", "hourly"] },
    { key: "price", label: "Agreed fee ex-GST (₹)", type: "number", money: true, required: true },
    { key: "status", label: "Status", type: "select", required: true, options: ["Proposed", "Agreed", "In progress", "Live", "Done", "Paused", "Stopped", "Declined"] },
    { key: "start_on", label: "Start", type: "date", hidden: true },
    { key: "end_on", label: "End", type: "date", hidden: true },
    { key: "note", label: "Note", type: "textarea", hidden: true },
    visible(),
  ],
  requests: [
    { key: "type", label: "Type", readOnly: true },
    { key: "details", label: "Request", type: "textarea", readOnly: true },
    { key: "status", label: "Status", type: "select", required: true, options: ["new", "accepted", "in_progress", "done", "declined"] },
    { key: "reply", label: "Your reply (client sees it)", type: "textarea" },
  ],
};

export const defaultsFor = (table) =>
  Object.fromEntries(FIELDS[table].filter((f) => "def" in f).map((f) => [f.key, f.def]));

/* Services that bring money in each month. */
export const RECURRING = ["Agreed", "In progress", "Live"];

export const LABEL = {
  open: "Open", in_progress: "In progress", waiting_client: "Waiting on you", blocked: "Blocked", resolved: "Resolved", superseded: "Superseded",
  new: "New", accepted: "Accepted", done: "Done", declined: "Declined",
  critical: "Critical", high: "High", medium: "Medium", low: "Low",
};
export const TONE = {
  open: "warn", in_progress: "info", waiting_client: "warn", blocked: "bad", resolved: "good", superseded: "info",
  new: "warn", accepted: "info", done: "good", declined: "info",
  critical: "bad", high: "bad", medium: "warn", low: "info",
};
