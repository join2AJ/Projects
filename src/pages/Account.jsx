/* Your account: who you are signed in as, and a password change. */
import { useState } from "react";
import { supabase } from "../lib/supabase.js";
import { useAuth, emailToLogin, signOut } from "../lib/auth.jsx";
import { C, H1, H2, P, Box, Card } from "../components/ui.jsx";
import { MySignIns } from "../components/activity.jsx";

const fs = { border: `1px solid ${C.rule}`, background: "#fff" };

export default function Account() {
  const { session, profile } = useAuth();
  const [pw, setPw] = useState({ a: "", b: "" });
  const [msg, setMsg] = useState(null);

  const change = async (e) => {
    e.preventDefault();
    if (pw.a.length < 8) return setMsg(["bad", "Use at least 8 characters."]);
    if (pw.a !== pw.b) return setMsg(["bad", "The two passwords do not match."]);
    const { error } = await supabase.auth.updateUser({ password: pw.a });
    if (error) return setMsg(["bad", error.message]);
    setPw({ a: "", b: "" });
    setMsg(["good", "Password changed. Use it next time you sign in."]);
  };

  return (
    <div className="max-w-md">
      <H1>Your account</H1>
      <Card className="mb-4">
        <div className="text-sm"><b>{profile?.full_name || "—"}</b></div>
        <div className="text-sm" style={{ color: C.mute }}>Signs in as <b style={{ color: C.ink }}>{emailToLogin(session?.user.email)}</b></div>
        <div className="text-xs mt-1" style={{ color: C.mute }}>{profile?.is_owner ? "Admin" : "Client"}</div>
      </Card>
      <H2>Change password</H2>
      <form onSubmit={change}>
        <label htmlFor="pw-a" className="block text-xs mb-3" style={{ color: C.mute }}>New password
          <input id="pw-a" type="password" autoComplete="new-password" value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} className="mt-1 w-full px-2 py-2 rounded text-sm" style={fs} />
        </label>
        <label htmlFor="pw-b" className="block text-xs mb-3" style={{ color: C.mute }}>Type it again
          <input id="pw-b" type="password" autoComplete="new-password" value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} className="mt-1 w-full px-2 py-2 rounded text-sm" style={fs} />
        </label>
        <button type="submit" className="px-4 py-2 rounded text-sm font-semibold mb-3" style={{ background: C.deep, color: "#fff" }}>Change password</button>
      </form>
      {msg && <Box tone={msg[0]}>{msg[1]}</Box>}
      <H2>Your recent sign-ins</H2>
      <MySignIns userId={session?.user.id} />
      <P><button className="underline" style={{ color: C.mute }} onClick={signOut}>Sign out</button></P>
    </div>
  );
}
