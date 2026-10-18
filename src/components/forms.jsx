/*
 * Client forms. On Netlify, submissions land in the site's Forms tab (and your email, if you turn on
 * notifications). Each form also needs its hidden twin in index.html so Netlify can detect it.
 * Anywhere else, the form shows the filled-in text for the client to copy and send.
 */
import { useState } from "react";
import { C, Box } from "./ui.jsx";
import { STUDIO } from "../data/studio.js";

const encode = (data) => new URLSearchParams(data).toString();

// In the share build (a single page with no server), forms skip Netlify and show the text to copy and send.
const SHARE = import.meta.env.VITE_SHARE === "1";

function useNetlifyForm(name) {
  const [state, setState] = useState({ s: "idle" });
  const submit = async (e) => {
    e.preventDefault();
    const data = { "form-name": name, ...Object.fromEntries(new FormData(e.target)) };
    const text = Object.entries(data).filter(([k, v]) => !["form-name", "bot-field"].includes(k) && v).map(([k, v]) => `${k}: ${v}`).join("\n");
    if (SHARE) return setState({ s: "copy", text });
    setState({ s: "sending" });
    try {
      const r = await fetch("/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: encode(data) });
      if (!r.ok) throw new Error(r.status);
      setState({ s: "sent" });
      e.target.reset();
    } catch {
      setState({ s: "copy", text });
    }
  };
  return [state, submit];
}

const field = "mt-1 w-full px-2 py-2 rounded text-sm";
const fieldStyle = { border: `1px solid ${C.rule}`, color: C.ink, background: "#fff" };
const Label = ({ text, children }) => (
  <label className="block text-xs mb-3" style={{ color: C.mute }}>{text}{children}</label>
);

function Sent({ state }) {
  const [copied, setCopied] = useState(false);
  if (state.s === "sent") return <Box tone="good" title="Received">Thank you. I reply the same working day.</Box>;
  if (state.s !== "copy") return null;
  const copy = () => navigator.clipboard?.writeText(state.text).then(() => setCopied(true), () => setCopied(false));
  return (
    <Box tone="info" title="Almost done: send this to me">
      Copy the text below and send it on WhatsApp or by email to <b style={{ userSelect: "all" }}>{STUDIO.email}</b>.
      <textarea readOnly value={state.text} rows={6} className={field} style={fieldStyle} onFocus={(e) => e.target.select()} />
      <button type="button" onClick={copy} className="mt-2 px-3 py-1 rounded text-sm" style={{ border: `1px solid ${C.deep}`, color: C.deep, background: "#fff" }}>
        {copied ? "Copied" : "Copy text"}
      </button>
    </Box>
  );
}

export function RequestForm({ project = "" }) {
  const [state, submit] = useNetlifyForm("request");
  return (
    <form name="request" method="POST" data-netlify="true" netlify-honeypot="bot-field" onSubmit={submit} className="max-w-xl">
      <input type="hidden" name="form-name" value="request" />
      <p className="hidden"><label>Leave empty <input name="bot-field" /></label></p>
      <Label text="Project"><input name="project" defaultValue={project} required className={field} style={fieldStyle} /></Label>
      <Label text="Your name"><input name="name" required className={field} style={fieldStyle} /></Label>
      <Label text="What kind of request?">
        <select name="type" className={field} style={fieldStyle}>
          <option>New work</option><option>Change to something existing</option><option>Something is broken</option><option>Question</option>
        </select>
      </Label>
      <Label text="How urgent?">
        <select name="priority" className={field} style={fieldStyle}>
          <option>This week</option><option>This month</option><option>Whenever</option><option>Urgent: today</option>
        </select>
      </Label>
      <Label text="What would you like me to work on?"><textarea name="details" rows={5} required className={field} style={fieldStyle} /></Label>
      <Label text="Link to a file, page or screenshot (optional)"><input name="link" type="url" className={field} style={fieldStyle} /></Label>
      <button type="submit" disabled={state.s === "sending"} className="px-4 py-2 rounded text-sm font-semibold mb-4" style={{ background: C.deep, color: "#fff" }}>
        {state.s === "sending" ? "Sending…" : "Send request"}
      </button>
      <Sent state={state} />
    </form>
  );
}

export function FeedbackForm({ project = "" }) {
  const [state, submit] = useNetlifyForm("feedback");
  return (
    <form name="feedback" method="POST" data-netlify="true" netlify-honeypot="bot-field" onSubmit={submit} className="max-w-xl">
      <input type="hidden" name="form-name" value="feedback" />
      <p className="hidden"><label>Leave empty <input name="bot-field" /></label></p>
      <Label text="Project"><input name="project" defaultValue={project} required className={field} style={fieldStyle} /></Label>
      <Label text="How did it go, from 1 to 5?">
        <select name="score" className={field} style={fieldStyle}><option>5</option><option>4</option><option>3</option><option>2</option><option>1</option></select>
      </Label>
      <Label text="What worked well?"><textarea name="worked" rows={3} className={field} style={fieldStyle} /></Label>
      <Label text="What should I do better?"><textarea name="better" rows={3} className={field} style={fieldStyle} /></Label>
      <Label text="May I quote you as a testimonial? If yes, write it here"><textarea name="testimonial" rows={3} className={field} style={fieldStyle} /></Label>
      <button type="submit" disabled={state.s === "sending"} className="px-4 py-2 rounded text-sm font-semibold mb-4" style={{ background: C.deep, color: "#fff" }}>
        {state.s === "sending" ? "Sending…" : "Send feedback"}
      </button>
      <Sent state={state} />
    </form>
  );
}
