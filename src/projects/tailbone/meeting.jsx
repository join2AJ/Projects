/* Kick-off update brief for Dr Rajveer, Mon 19 Oct 2026: are we on track, and why the two big decisions were right. */
import { C, inr, Chip, H1, H2, P, Box, T, OL, Status, StudioOnly, useStudio } from "../../components/ui.jsx";
import { CAMP, TOTAL_COST, ALL, LEDGER, LEDGER_TOTAL, GST, DAYS } from "./audit.jsx";

const DAILY = 200;
const CEILING = 10000;

export function MeetingBrief() {
  const studio = useStudio();
  const month = DAILY * DAYS * GST;
  const maxDaily = Math.floor(CEILING / (DAYS * GST));
  const l12 = ALL.slice(-12).reduce((a, b) => a + b, 0) / 12;
  const p5 = LEDGER[0], vv = LEDGER[1], yt = LEDGER[2], p4 = LEDGER[3];
  const pct = (v) => `${((v / LEDGER_TOTAL) * 100).toFixed(0)}%`;
  const [cp5, cp4] = CAMP;

  return (
    <div>
      <div className="text-xs mb-2" style={{ color: C.mute }}>Kick-off update · Mon 19 Oct 2026 · Dr Rajveer and Ajay · then every Tuesday at 11:00</div>
      <H1>We are on track: ad money now goes to people searching for tailbone treatment, with a hard monthly ceiling</H1>
      <P>
        Since 1 August, {inr(LEDGER_TOTAL)} (before GST) went to campaigns that mostly bought cheap clicks and video views. On 18 Oct we paused all of them
        and built one Search campaign for Delhi NCR at ₹{DAILY} a day, about {inr(month)} a month with GST, never more than {inr(CEILING)}.
        Two things stand between it and launch: the old website text, and the ₹3,500 top-up.
      </P>

      <H2>Decision 1: stopping the old ads was right</H2>
      <T head={["Campaign", "Spend since 1 Aug", "What it was buying", "Call"]} right={[1]} rows={[
        [<b key="a">PMax-5 Website traffic</b>, `${inr(p5[1])} (${pct(p5[1])})`,
          `${cp5.cpc} clicks at a ${cp5.ctr} CTR, which is far too cheap and too high for a clinic. Its ${cp5.conv} “conversions” carry no value, and the only actions recording in the account are soft ones (map taps, YouTube subscriptions).`,
          <Chip key="1" tone="good">Right to stop</Chip>],
        [<b key="b">YouTube Promotion</b>, `${inr(yt[1])} (${pct(yt[1])}) in 7 days`,
          "Views at about ₹0.08 each, climbing from ₹72 to ₹262 a day. It had become the largest daily spender and buys views, not appointments.",
          <Chip key="2" tone="good">Right to stop</Chip>],
        [<b key="c">Video Views Camp 1</b>, `${inr(vv[1])} (${pct(vv[1])})`, "Views only. Already ended on 6 Sep.", <Chip key="3" tone="info">Already ended</Chip>],
        [<b key="d">PMax-4 Tailbone Treatment</b>, `${inr(p4[1])} (${pct(p4[1])})`,
          `The most promising: ${cp4.clicks} clicks at ${cp4.cpc} and ${cp4.conv} conversions, but only 3 live days and policy-limited assets.`,
          <Chip key="4" tone="warn">Paused for clean measurement</Chip>],
      ]} />
      <Box tone="info" title={studio ? "Be straight about PMax-4" : "About PMax-4"}>
        PMax-4 was not failing. It was paused so that one clean campaign runs alone, every rupee can be traced to calls, and the monthly cap is easy to hold.
        It is the first candidate to bring back after 30 days of Search data and working call tracking (decision on 18 Nov).
      </Box>

      <H2>Decision 2: one Search campaign with a monthly cap is the right shape</H2>
      <T head={["Point", "Number", "Why it matters"]} right={[1]} rows={[
        ["Daily budget", `₹${DAILY}`, "An average. One day can reach ₹400, but Google cannot charge more than 30.4 days’ worth in a month."],
        ["Month with 18% GST", inr(month), `Comfortably under the ${inr(CEILING)} ceiling.`],
        ["Highest daily budget that still fits the cap", `₹${maxDaily}`, "So budget can grow about 39% before the cap is in danger."],
        ["Last 12 months, average per month", inr(l12), `The new plan costs about ${Math.abs(((month - l12) / l12) * 100).toFixed(0)}% ${month < l12 ? "less" : "more"} than that, and every rupee has one job: phone calls.`],
        ["Hard stop", "Prepay balance", "Ads pause when the loaded money runs out, so the cap cannot be overrun by mistake."],
        ["Who sees the ads", "Google Search, Delhi NCR", "Only people typing tailbone-related searches near the Delhi clinic. No Display, no Search Partners, no video."],
      ]} />

      <H2>{studio ? "Honest risks to raise in the update" : "Risks and open points"}</H2>
      <T head={["Risk", "What we do", "Status"]} rows={[
        ["The ad sends people to tailbonetreatment.com, which still lists Bangalore and says “India’s No. 1”", "Doctor’s web person removes those lines, or we point the ad at the new site. Must happen before launch.", <Status key="1" s="Before launch" />],
        ["Only calls from the ad’s own call button are counted (60 s or more)", "Website bookings, WhatsApp and calls dialled from the page are not tracked yet. Ask how each new patient found the clinic until website tracking exists.", <Status key="2" s="Open" />],
        ["No ad schedule is set", "Recommend showing ads only in clinic hours, so every call is answered. Needs the clinic’s phone hours.", <Status key="3" s="Needs client" />],
        ["Call number 9886688323 on the ad", "Confirm it rings at the Delhi clinic and someone answers during ad hours.", <Status key="4" s="Needs client" />],
        ["No negative keywords at launch", "Read the real searches on day 3 (21 Oct) and agree which to block.", <Status key="5" s="Scheduled" />],
        ["Fewer clicks than Google’s estimate", "Three common keywords were removed by a health-policy flag. Expect a slower first week.", <Status key="6" s="Open" />],
        ["Changes are made from the doctor’s own login", "Add Ajay with Standard access by email invite (Admin > Access and security). Safer and traceable for both sides.", <Status key="7" s="Needs client" />],
      ]} />

      <H2>Agenda (30 minutes)</H2>
      <OL items={[
        "5 min: what we found (Right vs wrong tab). Spend went to cheap clicks and views, and the numbers could not be trusted.",
        "5 min: what we did on 18 Oct. Old ads paused, Search campaign built, monthly cap set.",
        "5 min: the risks above, and the website fix needed before launch.",
        "10 min: what is needed from you (list below), and agree the scope and fees (Plan and pricing tab).",
        "5 min: dates. 21 Oct search review, Tue 3 Nov first full review, Tue 17 Nov budget decision. Written update every Tuesday at 11:00.",
      ]} />

      <H2>{studio ? "What to ask for" : "What we need from you"}</H2>
      <T head={["#", "Ask", "Why"]} rows={[
        ["1", "Remove Bangalore and “No. 1” from tailbonetreatment.com, or approve pointing the ad at the new site", "Launch blocker and policy risk"],
        ["2", "Load ₹3,500 on 19 Oct before 10:00, nothing more in October", "October stays near ₹8,770 incl. GST"],
        ["3", "Call and WhatsApp log for 17 Sep – 16 Oct", "Shows how many real enquiries the old ads produced"],
        ["4", "Revenue per patient: visits per patient and fee per visit", "Sets the break-even cost per enquiry"],
        ["5", "Clinic phone hours", "For the ad schedule"],
        ["6", "Standard access invite to Ajay’s email, and who edits the website and Tag Manager", "Safer access, and website call tracking"],
        ["7", "Approval of the monthly cap and the fees in writing (WhatsApp is fine)", "Protects both sides"],
      ]} />

      {import.meta.env.DEV && (<StudioOnly>
      <H2>Five sentences to open with</H2>
      <OL items={[
        "“The old ads were spending most of the money on cheap clicks and views that we cannot link to patients.”",
        `“Since 1 August that was about ${inr(LEDGER_TOTAL * GST)} with GST, so we stopped it.”`,
        `“The new campaign shows only to people in Delhi NCR searching for tailbone treatment, and costs about ${inr(month)} a month, never above ${inr(CEILING)}.”`,
        "“Before it starts, the old website must stop mentioning Bangalore.”",
        "“Every Tuesday at 11:00 you get a written update on your project page, and I will not change the budget without your approval.”",
      ]} />
      </StudioOnly>)}
      <P style={{ color: C.mute }}>30-day figures (17 Sep – 16 Oct, ex-GST): {inr(TOTAL_COST)} across the three campaigns in the report. Ledger figures are 1 Aug – 17 Oct, net of credits.</P>
    </div>
  );
}
