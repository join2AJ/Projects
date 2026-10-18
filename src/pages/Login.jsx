/* The only public page: sign in with a username (or email) and password. Accounts are created by the admin. */
import { useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { supabase, configured } from "../lib/supabase.js";
import { useAuth, NotConfigured, loginToEmail } from "../lib/auth.jsx";
import { C, FH, Box } from "../components/ui.jsx";
import { STUDIO } from "../data/studio.js";

const fs = { border: `1px solid ${C.rule}`, background: "#fff" };

export default function Login() {
  const { session, profile, loading } = useAuth();
  const [q] = useSearchParams();
  // Only same-site paths: blocks open redirects like ?next=//evil.com or ?next=/\evil.com
  const raw = q.get("next") || "";
  const next = /^\/(?![\/\\])[\w\-/]*$/.test(raw) ? raw : null;
  const [login, setLogin] = useState(q.get("user") || "");
  const [password, setPassword] = useState("");
  const [state, setState] = useState(["idle"]);

  if (!configured) return <NotConfigured />;
  if (!loading && session && profile) return <Navigate to={next || (profile.is_owner ? "/studio" : "/portal")} replace />;

  const send = async (e) => {
    e.preventDefault();
    const email = loginToEmail(login);
    if (!email) return setState(["error", "Enter your username or email"]);
    setState(["sending"]);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) return setState(["idle"]);
    const banned = /banned/i.test(error.message);
    setState(["error", banned ? "This account is switched off. Contact Ajay." : "Username or password is wrong"]);
  };

  return (
    <div className="max-w-sm mx-auto pt-6">
      <div className="text-center mb-6">
        <div style={{ fontFamily: FH, color: C.deep, fontWeight: 600, fontSize: 28 }}>{STUDIO.name}</div>
        <div className="text-sm" style={{ color: C.mute }}>Client projects</div>
      </div>
      <form onSubmit={send} className="p-5" style={{ background: C.card, border: `1px solid ${C.rule}`, borderRadius: 6 }}>
        <label htmlFor="login-user" className="block text-xs mb-3" style={{ color: C.mute }}>
          Username or email
          <input id="login-user" required autoComplete="username" autoCapitalize="none" spellCheck="false" value={login}
            onChange={(e) => setLogin(e.target.value)} className="mt-1 w-full px-2 py-2 rounded text-sm" style={fs} />
        </label>
        <label htmlFor="login-password" className="block text-xs mb-4" style={{ color: C.mute }}>
          Password
          <input id="login-password" type="password" required autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full px-2 py-2 rounded text-sm" style={fs} />
        </label>
        <button type="submit" disabled={state[0] === "sending"} className="w-full px-4 py-2 rounded text-sm font-semibold" style={{ background: C.deep, color: "#fff" }}>
          {state[0] === "sending" ? "Signing in…" : "Sign in"}
        </button>
        {state[0] === "error" && <div className="mt-3"><Box tone="bad">{state[1]}</Box></div>}
      </form>
      <p className="text-xs text-center mt-4" style={{ color: C.mute }}>
        No account or forgot your password? Ask Ajay at {STUDIO.email}.
      </p>
    </div>
  );
}
