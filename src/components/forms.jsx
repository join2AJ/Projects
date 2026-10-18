/*
 * Client forms. On Netlify, submissions land in the site's Forms tab (and your email, if you turn on
 * notifications). Each form also needs its hidden twin in index.html so Netlify can detect it.
 * Anywhere else, the form falls back to opening an email.
 */
import { useState } from "react";
import { C, Box } from "./ui.jsx";
import { STUDIO } from "../data/studio.js";

const encode = (data) => new URLSearchParams(data).toString();

function useNetlifyForm(name) {
  const [state, setState] = useState("idle");
  const submit = async (e) => {
    e.preventDefault();
    const data = { "form-name": name, ...Object.fromEntries(new FormData(e.target)) };
    setState("sending");
    try {
      const r = await fetch("/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: encode(data) });
      if (!r.ok) throw new Error(r.status);
      setState("sent");
      e.target.reset();
    } catch {
      const body = Object.entries(data).filter(([k]) => k !== "form-name").map(([k, v]) => `${k}: ${v}`).join("\n");
      window.location.href = `mailto:${STUDIO.email}?subject=${encodeURIComponent(`[${name}] ${data.project || ""}`)}&body=${encodeURIComponent(body)}`;
      setState("mail");
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
  if (state === "sent") return <Box tone="good" title="Received">Thank you. I reply the same working day.</Box>;
  if (state === "mail") return <Box tone="info" title="Opening your email">If nothing opened, write to {STUDIO.email}.</Box>;
  return null;
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
      <button type="submit" disabled={state === "sending"} className="px-4 py-2 rounded text-sm font-semibold mb-4" style={{ background: C.deep, color: "#fff" }}>
        {state === "sending" ? "Sending…" : "Send request"}
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
      <button type="submit" disabled={state === "sending"} className="px-4 py-2 rounded text-sm font-semibold mb-4" style={{ background: C.deep, color: "#fff" }}>
        {state === "sending" ? "Sending…" : "Send feedback"}
      </button>
      <Sent state={state} />
    </form>
  );
}
