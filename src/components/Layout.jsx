import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { C, FB, FH } from "./ui.jsx";
import { STUDIO } from "../data/studio.js";
import { useAuth, emailToLogin, signOut } from "../lib/auth.jsx";
import { ConsentGate } from "./collab.jsx";
import { track } from "../lib/track.js";
import { useBusiness } from "../lib/tax.js";

// A link, or [label, [links…]] for a menu. Account sits in the signed-in bar; Security is in the admin footer.
const ADMIN = [["/studio", "Dashboard"], ["/studio/users", "People & clinics"], ["Business", [["/studio/pricing", "Price list"], ["/studio/compare", "Compare"], ["/studio/overheads", "Overheads"], ["/studio/tax", "Business & tax details"], ["/studio/activity", "All activity"]]]];
const CLIENT = [["/portal", "My project"], ["Help", [["/process", "How we work"], ["/services", "Services"], ["/security", "Security"], ["/privacy", "Privacy notice"]]]];

function Menu({ label, items, path }) {
  const [open, setOpen] = useState(false);
  const on = items.some(([to]) => path === to);
  useEffect(() => setOpen(false), [path]);
  return (
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} style={{ color: on ? C.deep : C.mute, fontWeight: on ? 700 : 400, background: "transparent" }}>
        {label} <span aria-hidden="true" style={{ fontSize: 10 }}>▾</span>
      </button>
      {open && (
        <div role="menu" aria-label={label} className="absolute right-0 z-30 py-1" style={{ top: "100%", minWidth: 180, background: C.card, border: `1px solid ${C.rule}`, borderRadius: 4, boxShadow: "0 6px 18px rgba(0,0,0,.08)" }}>
          {items.map(([to, l]) => <Link key={to} role="menuitem" to={to} className="block px-3 py-2" style={{ color: path === to ? C.deep : C.ink, fontWeight: path === to ? 700 : 400 }}>{l}</Link>)}
        </div>
      )}
    </div>
  );
}


/*
 * Everyone except the admin: no right-click menu, no copying, cutting, dragging or selecting page text, and no
 * save / view-source / select-all shortcuts. Typing, copying and pasting inside form fields still works.
 * This stops casual copying; it cannot stop screenshots.
 */
const inField = (e) => !!e.target?.closest?.("input, textarea, select, [contenteditable=true]");
function protectContent() {
  const block = (e) => { if (!inField(e)) e.preventDefault(); };
  const keys = (e) => {
    const k = e.key?.toLowerCase();
    if (k === "f12" || ((e.ctrlKey || e.metaKey) && e.shiftKey && ["i", "j", "c"].includes(k))) return e.preventDefault();
    if ((e.ctrlKey || e.metaKey) && ["c", "x", "a", "s", "u"].includes(k) && !inField(e)) e.preventDefault();
  };
  const evs = ["contextmenu", "copy", "cut", "dragstart", "selectstart"];
  evs.forEach((t) => document.addEventListener(t, block));
  document.addEventListener("keydown", keys);
  document.body.classList.add("no-copy");
  return () => { evs.forEach((t) => document.removeEventListener(t, block)); document.removeEventListener("keydown", keys); document.body.classList.remove("no-copy"); };
}

export default function Layout() {
  const { session, profile } = useAuth();
  const links = !session || !profile ? [] : profile.is_owner ? ADMIN : CLIENT;
  const path = useLocation().pathname;
  const business = useBusiness(session?.user.id || null);
  const open = ["/login", "/privacy"].includes(path);
  // Client page views (project sections are recorded by the project page itself)
  useEffect(() => { if (profile && !profile.is_owner && !path.startsWith("/portal/p/")) track(path); }, [path, profile]);
  const admin = !!profile?.is_owner;
  useEffect(() => (admin ? undefined : protectContent()), [admin]);
  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: FB, color: C.ink }}>
      <header style={{ background: C.card, borderBottom: `1px solid ${C.rule}` }}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <Link to={session ? "/" : "/login"} style={{ fontFamily: FH, color: C.deep, fontWeight: 600, fontSize: 18 }}>{STUDIO.name}</Link>
          <nav className="flex flex-wrap gap-4 text-sm">
            {links.map(([to, l]) => Array.isArray(l) ? <Menu key={to} label={to} items={l} path={path} /> : (
              <NavLink key={to} to={to} end={to === "/studio"} style={({ isActive }) => ({ color: isActive ? C.deep : C.mute, fontWeight: isActive ? 700 : 400 })}>{l}</NavLink>
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
              <span className="flex gap-4"><Link to="/account" className="underline" style={{ color: "inherit" }}>Account</Link><button onClick={signOut} className="underline" style={{ color: "inherit" }}>Sign out</button></span>
            </div>
          </div>
        )}
      </header>
      <main className="max-w-5xl mx-auto px-4 pt-6 pb-12">
        {open || !session || !profile ? <Outlet /> : <ConsentGate><Outlet /></ConsentGate>}
      </main>
      <footer className="max-w-5xl mx-auto px-4 pb-8 text-xs" style={{ color: C.mute }}>
        {business?.company_name || STUDIO.name} · {STUDIO.email} · {business?.gstin ? `GSTIN ${business.gstin}` : "Not GST-registered: no GST is charged"} · <Link to="/privacy" className="underline">Privacy notice</Link>{profile?.is_owner && <> · <Link to="/security" className="underline">Security</Link></>}
      </footer>
    </div>
  );
}
