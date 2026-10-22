/*
 * Index of a project's tabs: what each one is for, with a direct link (?tab=…) that opens it.
 * The admin index also gives the client's link to the same tab, ready to paste into WhatsApp.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { C, P, Card } from "./ui.jsx";

const ADMIN = {
  overview: "Project details, the client’s services and fees, and whether Money shows to the client.",
  meetings: "Notes after each call: discussion, action and workable points with priority; share point by point.",
  promotion: "Every promotion channel and strategy, with status, budget against the client’s limit, and how it is measured.",
  decisions: "Yes / No / Other questions for the client; close each one with the final decision.",
  updates: "Work updates and the weekly Tuesday update; approve before the client sees them. Skip or move updates here.",
  issues: "Problems found, how serious, who fixes them and the latest status.",
  money: "Invoices and expenses, and the switch for the client’s Money tab.",
  time: "Your timer and hours (private).",
  files: "Reports, data and designs; choose which the client can download.",
  requests: "The client’s requests as conversations, with prepared draft replies to edit and share.",
  work: "Every audit, report and piece of work done, with dates.",
  numbers: "Figures since the project started, as charts; paste new numbers here.",
  report: "Earlier figures and the Google Ads audit report, including the account history since 2014.",
  gantt: "Action points, strategies, updates and decisions on a timeline.",
  shared: "Everything in this project tagged Shared or Private, with filters.",
  timeline: "Exactly what the client sees on their timeline.",
  seen: "Which pages the client opens, when and for how long, with charts and filters.",
  activity: "Full audit trail: every change, by whom and when.",
  access: "Who can sign in to this project.",
  logins: "Tools you have access to, and passwords kept encrypted (private).",
  index: "This page.",
};
const CLIENT = {
  overview: "Where the project stands, your services, the next weekly update and anything waiting for you.",
  timeline: "What is coming up and everything that has happened, by date.",
  meetings: "Notes from our calls: what we discussed, who does what by when, and ideas we are working on.",
  promotion: "How we are promoting your clinic, channel by channel.",
  decisions: "Questions for you: answer Yes, No or Other.",
  updates: "Work done and the weekly update every Tuesday at 11:00.",
  issues: "Problems found and how they are being fixed.",
  money: "Your fees, invoices and payments.",
  files: "Reports and files you can download.",
  requests: "Ask for something and follow the replies.",
  work: "Every audit, report and piece of work done for you.",
  numbers: "Your current figures and charts.",
  report: "Earlier figures and the Google Ads audit report.",
  gantt: "The plan and next steps on a timeline.",
  data: "Your personal data and privacy rights; download everything.",
  index: "This page.",
};

export function TabIndex({ tabs, admin = false, slug, onOpen }) {
  const [copied, setCopied] = useState(null);
  const text = admin ? ADMIN : CLIENT;
  const clientTabs = new Set(["overview", "timeline", "meetings", "promotion", "decisions", "gantt", "updates", "issues", "money", "files", "requests", "work", "numbers", "report", "data"]);
  const copy = async (key) => {
    const url = `${window.location.origin}/portal/p/${slug}?tab=${key}`;
    try { await navigator.clipboard.writeText(url); setCopied(key); } catch { setCopied(null); }
  };
  return (
    <div>
      <P>{admin ? "What each tab is for. Open it here, or copy the client’s link to the same tab to send on WhatsApp." : "What each section of your project page is for. Tap a name to open it."}</P>
      <div className="grid gap-3 md:grid-cols-2">
        {tabs.filter(([k]) => k !== "index").map(([k, label]) => (
          <Card key={k}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Link to={`?tab=${k}`} className="font-semibold underline" style={{ color: C.deep }}>{label}</Link>
              {admin && clientTabs.has(k) && (
                <button className="text-xs underline" style={{ color: C.mute }} onClick={() => copy(k)}>{copied === k ? "Copied" : "Copy client link"}</button>
              )}
            </div>
            <div className="text-sm mt-1" style={{ color: C.ink, lineHeight: 1.5 }}>{text[k] || ""}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
