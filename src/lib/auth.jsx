/* Login state: who is signed in, and whether they are the studio owner. */
import { createContext, useContext, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase, configured } from "./supabase.js";
import { P, Box } from "../components/ui.jsx";

const AuthCtx = createContext({ loading: true, session: null, profile: null });
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: configured, session: null, profile: null });

  useEffect(() => {
    if (!configured) return;
    const load = async (session) => {
      if (!session) return setState({ loading: false, session: null, profile: null });
      const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
      setState({ loading: false, session, profile: data });
    };
    supabase.auth.getSession().then(({ data }) => load(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      // Defer the query: Supabase warns against awaiting inside this callback.
      setTimeout(() => load(session), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return <AuthCtx.Provider value={state}>{children}</AuthCtx.Provider>;
}

export const signOut = () => supabase.auth.signOut();

export function NotConfigured() {
  return (
    <Box tone="warn" title="Database not connected yet">
      Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the environment (see README), then reload.
    </Box>
  );
}

/* Gate a page: signed in (and owner, if `owner`). */
export function Require({ owner = false, children }) {
  const { loading, session, profile } = useAuth();
  const loc = useLocation();
  if (!configured) return <NotConfigured />;
  if (loading) return <P>Loading…</P>;
  if (!session) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  if (owner && !profile?.is_owner) return <Navigate to="/portal" replace />;
  return children;
}
