import { Link, NavLink, Outlet } from "react-router-dom";
import { C, FB, FH } from "./ui.jsx";
import { STUDIO } from "../data/studio.js";
import { useAuth } from "../lib/auth.jsx";

const nav = [["/services", "Services and pricing"], ["/process", "How we work"]];

export default function Layout() {
  const { session, profile } = useAuth();
  const account = session ? (profile?.is_owner ? ["/studio", "Dashboard"] : ["/portal", "My projects"]) : ["/login", "Client sign in"];
  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: FB, color: C.ink }}>
      <header style={{ background: C.card, borderBottom: `1px solid ${C.rule}` }}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <Link to="/" style={{ fontFamily: FH, color: C.deep, fontWeight: 600, fontSize: 18 }}>{STUDIO.name}</Link>
          <nav className="flex flex-wrap gap-4 text-sm">
            {[...nav, account].map(([to, l]) => (
              <NavLink key={to} to={to} style={({ isActive }) => ({ color: isActive ? C.deep : C.mute, fontWeight: isActive ? 700 : 400 })}>{l}</NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 pt-6 pb-12">
        <Outlet />
      </main>
      <footer className="max-w-5xl mx-auto px-4 pb-8 text-xs" style={{ color: C.mute }}>
        {STUDIO.name} · {STUDIO.email} · {STUDIO.gstNote}
      </footer>
    </div>
  );
}
