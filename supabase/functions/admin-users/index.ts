// Admin-only account management: list, create, update, delete users.
// Runs with the service key (set automatically by Supabase), so the browser never holds it.
// Every call must come from a signed-in, active admin (profiles.is_owner).
import { createClient } from "jsr:@supabase/supabase-js@2";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const USERNAME = /^[a-z0-9._-]{3,32}$/;
const DOMAIN = "u.portal"; // usernames sign in as <username>@u.portal; no email is ever sent there
const FOREVER = "876000h";

function loginEmail(login: string) {
  const l = String(login || "").trim().toLowerCase();
  if (l.includes("@")) return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(l) ? l : null;
  return USERNAME.test(l) ? `${l}@${DOMAIN}` : null;
}

// Profile fields the admin may set. Anything else in the request is ignored.
function profileFields(b: Record<string, unknown>) {
  const out: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of ["full_name", "phone", "contact_email", "client_id", "notes", "status", "is_owner"]) {
    if (k in b) out[k] = b[k] === "" ? null : b[k];
  }
  if ("contact_email" in out && typeof out.contact_email === "string") out.contact_email = out.contact_email.toLowerCase();
  return out;
}

// Account changes are written to the audit trail here, with the admin's name (the database
// triggers skip them because this function runs with the service key, not as the admin).
async function audit(actor: { id: string; name: string }, action: string, summary: string, rowId: string | null, projectId: string | null = null) {
  await admin.from("audit_log").insert({
    actor_id: actor.id, actor_name: actor.name, actor_role: "admin", action, table_name: "profiles",
    row_id: rowId, project_id: projectId, summary, client_visible: false,
  });
}

async function syncProjects(email: string, projectIds: string[]) {
  const { data: now, error } = await admin.from("project_members").select("project_id").eq("email", email);
  if (error) throw error;
  const have = new Set((now || []).map((r) => r.project_id));
  const want = new Set(projectIds);
  const drop = [...have].filter((id) => !want.has(id));
  const add = [...want].filter((id) => !have.has(id));
  if (drop.length) {
    const r = await admin.from("project_members").delete().eq("email", email).in("project_id", drop);
    if (r.error) throw r.error;
  }
  if (add.length) {
    const r = await admin.from("project_members").insert(add.map((project_id) => ({ project_id, email, role: "client" })));
    if (r.error) throw r.error;
  }
  return { add, drop };
}

const loginOf = (email: string) => (email.endsWith(`@${DOMAIN}`) ? email.split("@")[0] : email);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "Use POST" });

  // Who is calling?
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: who } = await admin.auth.getUser(token);
  if (!who?.user) return json(401, { error: "Sign in again" });
  const { data: me } = await admin.from("profiles").select("is_owner,status,full_name,email").eq("id", who.user.id).single();
  if (!me?.is_owner || me.status !== "active") return json(403, { error: "Only the admin can manage users" });
  const actor = { id: who.user.id, name: me.full_name || me.email };
  const logAccess = async (email: string, ch: { add: string[]; drop: string[] }) => {
    for (const pid of ch.add) await audit(actor, "access.grant", `Gave ${loginOf(email)} access to the project`, email, pid);
    for (const pid of ch.drop) await audit(actor, "access.remove", `Removed ${loginOf(email)}'s access to the project`, email, pid);
  };

  let b: Record<string, any>;
  try { b = await req.json(); } catch { return json(400, { error: "Bad request" }); }

  try {
    switch (b.action) {
      case "list": {
        const [{ data: users, error: e1 }, { data: profiles, error: e2 }, { data: members, error: e3 }] = await Promise.all([
          admin.auth.admin.listUsers({ perPage: 1000 }),
          admin.from("profiles").select("*"),
          admin.from("project_members").select("project_id,email"),
        ]);
        if (e1 || e2 || e3) throw e1 || e2 || e3;
        const byId = new Map((profiles || []).map((p) => [p.id, p]));
        return json(200, users.users.map((u) => {
          const p = byId.get(u.id) || {};
          return {
            ...p, id: u.id, login: u.email?.endsWith(`@${DOMAIN}`) ? u.email.split("@")[0] : u.email,
            email: u.email, last_sign_in_at: u.last_sign_in_at, created_at: u.created_at,
            project_ids: (members || []).filter((m) => m.email === u.email).map((m) => m.project_id),
          };
        }));
      }

      case "create": {
        const email = loginEmail(b.login);
        if (!email) return json(400, { error: "Login must be 3–32 letters, numbers, dots, dashes or underscores, or an email" });
        if (!b.password || String(b.password).length < 8) return json(400, { error: "Password must be at least 8 characters" });
        const { data, error } = await admin.auth.admin.createUser({
          email, password: String(b.password), email_confirm: true,
          user_metadata: { full_name: b.full_name || null },
          ...(b.status === "disabled" ? { ban_duration: FOREVER } : {}),
        });
        if (error) return json(400, { error: error.message.includes("already") ? "That login is already taken" : error.message });
        const r = await admin.from("profiles").update(profileFields(b)).eq("id", data.user.id);
        if (r.error) throw r.error;
        await audit(actor, "user.create", `Created account ${loginOf(email)} (${b.is_owner ? "admin" : "client"}${b.status === "disabled" ? ", disabled" : ""})`, data.user.id);
        if (Array.isArray(b.project_ids)) await logAccess(email, await syncProjects(email, b.project_ids));
        return json(200, { id: data.user.id });
      }

      case "update": {
        if (!b.id) return json(400, { error: "Missing user" });
        const self = b.id === who.user.id;
        if (self && (b.status === "disabled" || b.is_owner === false)) return json(400, { error: "You cannot disable or demote your own account" });
        const { data: u, error } = await admin.auth.admin.getUserById(b.id);
        if (error || !u?.user) return json(404, { error: "User not found" });
        const attrs: Record<string, unknown> = {};
        if (b.password) {
          if (String(b.password).length < 8) return json(400, { error: "Password must be at least 8 characters" });
          attrs.password = String(b.password);
        }
        if (b.status) attrs.ban_duration = b.status === "disabled" ? FOREVER : "none";
        if (Object.keys(attrs).length) {
          const r = await admin.auth.admin.updateUserById(b.id, attrs);
          if (r.error) return json(400, { error: r.error.message });
        }
        const { data: before } = await admin.from("profiles").select("*").eq("id", b.id).single();
        const r = await admin.from("profiles").update(profileFields(b)).eq("id", b.id);
        if (r.error) throw r.error;
        const changed = Object.keys(profileFields(b)).filter((k) => k !== "updated_at" && before && String(before[k] ?? "") !== String(profileFields(b)[k] ?? ""));
        const what = [
          ...(b.password ? ["password reset"] : []),
          ...(changed.includes("status") ? [b.status === "disabled" ? "disabled" : "enabled"] : []),
          ...(changed.includes("is_owner") ? [b.is_owner ? "made admin" : "made client"] : []),
          ...changed.filter((k) => !["status", "is_owner"].includes(k)).map((k) => k.replace("_", " ")),
        ];
        if (what.length) await audit(actor, "user.update", `Updated account ${loginOf(u.user.email!)}: ${what.join(", ")}`, b.id);
        if (Array.isArray(b.project_ids)) await logAccess(u.user.email!, await syncProjects(u.user.email!, b.project_ids));
        return json(200, { ok: true });
      }

      case "delete": {
        if (!b.id) return json(400, { error: "Missing user" });
        if (b.id === who.user.id) return json(400, { error: "You cannot delete your own account" });
        const { data: u } = await admin.auth.admin.getUserById(b.id);
        if (u?.user?.email) await admin.from("project_members").delete().eq("email", u.user.email);
        const r = await admin.auth.admin.deleteUser(b.id);
        if (r.error) return json(400, { error: r.error.message });
        await audit(actor, "user.delete", `Deleted account ${loginOf(u?.user?.email || b.id)}`, b.id);
        return json(200, { ok: true });
      }

      default:
        return json(400, { error: "Unknown action" });
    }
  } catch (e) {
    return json(500, { error: (e as Error).message || "Something went wrong" });
  }
});
