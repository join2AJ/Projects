import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { C, FB, FH } from "./ui.jsx";
import { STUDIO } from "../data/studio.js";
import { useAuth, emailToLogin, signOut } from "../lib/auth.jsx";
import { ConsentGate } from "./collab.jsx";

const ADMIN = [["/studio", "Dashboard"], ["/studio/users", "People"], ["/studio/pricing", "Price list"], ["/studio/activity", "Activity"], ["/studio/compare", "Compare"], ["/security", "Security"], ["/account", "Account"]];
const CLIENT = [["/portal", "My projects"], ["/services", "Services"], ["/process", "How we work"], ["/security", "Security"], ["/account", "Account"]];

export default function Layout() {
  const { session, profile } = useAuth();
  const links = !session || !profile ? [] : profile.is_owner ? ADMIN : CLIENT;
  const open = ["/login", "/privacy"].includes(useLocation().pathname);
  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: FB, color: C.ink }}>
      <header style={{ background: C.card, borderBottom: `1px solid ${C.rule}` }}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <Link to={session ? "/" : "/login"} style={{ fontFamily: FH, color: C.deep, fontWeight: 600, fontSize: 18 }}>{STUDIO.name}</Link>
          <nav className="flex flex-wrap gap-4 text-sm">
            {links.map(([to, l]) => (
              <NavLink key={to} to={to} end style={({ isActive }) => ({ color: isActive ? C.deep : C.mute, fontWeight: isActive ? 700 : 400 })}>{l}</NavLink>
            ))}
          </nav>
        </div>
        {session && profile && (
          <div style={{ background: profile.is_owner ? C.deep : C.goodBg, color: profile.is_owner ? "#fff" : C.good }}>
            <div className="max-w-5xl mx-auto px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs" aria-label="Who is signed in">
              <span>
                Signed in as <b>{profile.full_name || emailToLogin(session.user.email)}</b>
                {" "}({emailToLogin(session.user.email)}) · {profile.is_owner ? "Admin" : "Client"}
              </span>
              <button onClick={signOut} className="underline" style={{ color: "inherit" }}>Sign out</button>
            </div>
          </div>
        )}
      </header>
      <main className="max-w-5xl mx-auto px-4 pt-6 pb-12">
        {open || !session || !profile ? <Outlet /> : <ConsentGate><Outlet /></ConsentGate>}
      </main>
      <footer className="max-w-5xl mx-auto px-4 pb-8 text-xs" style={{ color: C.mute }}>
        {STUDIO.name} · {STUDIO.email} · {STUDIO.gstNote} · <Link to="/privacy" className="underline">Privacy notice</Link>
      </footer>
    </div>
  );
}
