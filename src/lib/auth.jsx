/* Login state: who is signed in, and whether they are the admin. */
import { createContext, useContext, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase, configured } from "./supabase.js";
import { P, Box } from "../components/ui.jsx";

/* Usernames sign in as <username>@u.portal (see the admin-users Edge Function). */
export const LOGIN_DOMAIN = "u.portal";
export const loginToEmail = (login) => {
  const l = String(login || "").trim().toLowerCase();
  if (!l) return null;
  return l.includes("@") ? l : `${l}@${LOGIN_DOMAIN}`;
};
export const emailToLogin = (email) => (email?.endsWith(`@${LOGIN_DOMAIN}`) ? email.split("@")[0] : email);

const AuthCtx = createContext({ loading: true, session: null, profile: null });
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: configured, session: null, profile: null });

  useEffect(() => {
    if (!configured) return;
    const load = async (session) => {
      if (!session) return setState({ loading: false, session: null, profile: null });
      const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
      if (data?.status === "disabled") { await supabase.auth.signOut(); return; }
      setState({ loading: false, session, profile: data });
    };
    supabase.auth.getSession().then(({ data }) => load(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") return; // same person, nothing to reload
      // Defer the query: Supabase warns against awaiting inside this callback.
      setTimeout(() => load(session), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return <AuthCtx.Provider value={state}>{children}</AuthCtx.Provider>;
}

export const signOut = async () => {
  await supabase.rpc("log_event", { kind: "sign_out" }); // recorded in the audit trail
  return supabase.auth.signOut();
};

export function NotConfigured() {
  return (
    <Box tone="warn" title="Database not connected yet">
      Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the environment (see README), then reload.
    </Box>
  );
}

/* Gate a page: signed in (and admin, if `owner`). */
export function Require({ owner = false, children }) {
  const { loading, session, profile } = useAuth();
  const loc = useLocation();
  if (!configured) return <NotConfigured />;
  if (loading || (session && !profile)) return <P>Loading…</P>;
  if (!session) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if (owner && !profile?.is_owner) return <Navigate to="/portal" replace />;
  return children;
}

/* "/" sends people where they belong. */
export function Entry() {
  const { loading, session, profile } = useAuth();
  if (!configured) return <NotConfigured />;
  if (loading || (session && !profile)) return <P>Loading…</P>;
  if (!session) return <Navigate to="/login" replace />;
  return <Navigate to={profile?.is_owner ? "/studio" : "/portal"} replace />;
}
