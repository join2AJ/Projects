import { useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { supabase, configured } from "../lib/supabase.js";
import { useAuth, NotConfigured } from "../lib/auth.jsx";
import { C, H1, P, Box } from "../components/ui.jsx";

export default function Login() {
  const { session, profile, loading } = useAuth();
  const [q] = useSearchParams();
  // Only same-site paths: blocks open redirects like ?next=//evil.com or ?next=/\evil.com
  const raw = q.get("next") || "";
  const next = /^\/(?![\/\\])[\w\-/]*$/.test(raw) ? raw : "/portal";
  const [email, setEmail] = useState("");
  const [state, setState] = useState(["idle"]);

  if (!configured) return <NotConfigured />;
  if (!loading && session) return <Navigate to={profile?.is_owner && next === "/portal" ? "/studio" : next} replace />;

  const send = async (e) => {
    e.preventDefault();
    setState(["sending"]);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}${next}`, shouldCreateUser: true },
    });
    setState(error ? ["error", error.message] : ["sent"]);
  };

  return (
    <div className="max-w-md">
      <H1>Sign in</H1>
      <P>Enter the email your project is shared with. You will get a sign-in link, no password needed.</P>
      <form onSubmit={send}>
        <label htmlFor="login-email" className="block text-xs mb-3" style={{ color: C.mute }}>
          Email
          <input id="login-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full px-2 py-2 rounded text-sm" style={{ border: `1px solid ${C.rule}`, background: "#fff" }} />
        </label>
        <button type="submit" disabled={state[0] === "sending"} className="px-4 py-2 rounded text-sm font-semibold mb-4" style={{ background: C.deep, color: "#fff" }}>
          {state[0] === "sending" ? "Sending…" : "Email me a sign-in link"}
        </button>
      </form>
      {state[0] === "sent" && <Box tone="good" title="Check your email">Open the link from the same device and browser. It works once and expires in an hour.</Box>}
      {state[0] === "error" && <Box tone="bad" title="Could not send the link">{state[1]}. Wait a minute and try again.</Box>}
      <P style={{ color: C.mute }}>Signed in but see no project? Ask Ajay to add your email to it.</P>
    </div>
  );
}
