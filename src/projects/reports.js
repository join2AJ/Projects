/*
 * Custom reports that some projects carry beyond the standard tabs. A project points at one with
 * projects.report_key in the database. Tabs: [id, label, Component, studioOnly].
 *
 * Report code ships to every visitor's browser, so private analysis must not live in the deployed build.
 * Studio-only tabs and speaker notes appear only in local dev (npm run dev); production builds drop them.
 * For private notes on the live site, use updates with "Client can see this" switched off.
 */
import * as tailbone from "./tailbone/audit.jsx";
import { MeetingBrief } from "./tailbone/meeting.jsx";
import { History } from "./tailbone/history.jsx";

export const REPORTS = {
  "tailbone-ads-2026-10": {
    label: "Google Ads audit, Oct 2026",
    tabs: [
      ["meeting", "Kick-off update, 19 Oct", MeetingBrief],
      ["rw", "What works and what to improve", tailbone.RightWrong],
      ["verdict", "Verdict", tailbone.Verdict],
      ["issues", "Issues and fixes", tailbone.Issues],
      ["owner", "Campaign set-up", tailbone.OwnerBrief],
      ["roi", "Campaign ROI", tailbone.RoiTab],
      ["history", "Account history 2014–2026", History],
      ["audit", "Conversion audit", tailbone.ConvAudit],
      ["habits", "Spending habits", tailbone.Habits],
      ["budget", "Future budget", tailbone.Budget],
      ["plan", "12-month plan", tailbone.Plan12],
      ["actions", "Action plan", tailbone.Actions],
      ["basics", "Google Ads basics", tailbone.Basics],
      ["framework", "How we check", tailbone.Framework],
      ...(import.meta.env.DEV ? [["conv", "Conversion check", tailbone.ConvCheck, true]] : []),
    ],
  },
};
