/* How client data is protected. Every statement here is backed by the setup in this repo or by Supabase's published security page. */
import { useAuth } from "../lib/auth.jsx";
import { C, H1, H2, P, T, Box } from "../components/ui.jsx";

const ROWS = [
  ["In transit", "Every connection is encrypted with HTTPS (TLS 1.2 or 1.3): this website, the database and file downloads. Browsers are told to always use HTTPS for this site (HSTS)."],
  ["At rest", "The database and stored files are encrypted with AES-256 by our hosting provider, Supabase, in its Mumbai (India) region."],
  ["Passwords", "Never stored as text: only a one-way hash (bcrypt). Nobody, including Ajay, can read your password. Ajay can set a new one if you forget it."],
  ["Who sees what", "The database itself checks every request: you see only your own projects, and only what has been shared or approved for you. Private working notes stay private."],
  ["Files", "Kept in private storage. Each download link works for 5 minutes only."],
  ["Accounts", "Created only by Ajay. An account that is switched off loses access immediately, even if it was signed in."],
  ["Audit trail", "Every change is recorded with the time, who made it and what changed. Records cannot be edited or deleted. You can see your project’s history on its Timeline tab."],
  ["Browser protections", "The site blocks being embedded in other sites and only loads its own code, which protects against common web attacks."],
];

export default function Security() {
  const { profile } = useAuth();
  return (
    <div>
      <H1>How your data is protected</H1>
      <P>Your project information is kept private and encrypted, both while it travels and while it is stored.</P>
      <T head={["", "What is in place"]} rows={ROWS.map(([a, b]) => [<b key={a}>{a}</b>, b])} />
      <P style={{ color: C.mute }}>Source for hosting encryption: <a className="underline" href="https://supabase.com/security" target="_blank" rel="noreferrer">supabase.com/security</a>.</P>
      {profile?.is_owner && (<>
        <H2>Admin checklist</H2>
        <Box tone="warn" title="Settings only you can switch on">
          Supabase → client-portal → Database → Settings → <b>Enforce SSL on incoming connections</b>: turn it on, so direct database connections without encryption are refused (the website already uses HTTPS only).
          Also keep your own password long and unique, and change it under Account.
        </Box>
        <P style={{ color: C.mute }}>Encryption at rest protects disks and backups. Access to the data itself is controlled by the access rules and the audit trail above. For extra-sensitive fields (for example medical details), add field-level encryption before storing them.</P>
      </>)}
    </div>
  );
}
