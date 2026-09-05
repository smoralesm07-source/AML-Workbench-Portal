import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const CORE_URL = "https://ldmtlwzqaqmegedktlxr.supabase.co";
const CORE_PUBLISHABLE_KEY = "sb_publishable_Nu21dZFBM3NwtIvOwIM8ag_9tyfDJyR";
const ALLOWED_ORIGIN = "https://smoralesm07-source.github.io";
const SOURCE_PROJECT = "ldmtlwzqaqmegedktlxr";
const GRANT_TTL_MS = 10 * 60 * 1000;

function parseKeySet(name: string) {
  try { return JSON.parse(Deno.env.get(name) || "{}"); } catch (_) { return {}; }
}
function firstKey(values: Record<string, unknown>) { return String(values.default || Object.values(values)[0] || ""); }
function admin() {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = firstKey(parseKeySet("SUPABASE_SECRET_KEYS"));
  if (!url || !key) throw new Error("SERVER_CREDENTIALS_UNAVAILABLE");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
function userClient() {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = firstKey(parseKeySet("SUPABASE_PUBLISHABLE_KEYS"));
  if (!url || !key) throw new Error("PUBLIC_CREDENTIALS_UNAVAILABLE");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
function cors(origin: string) {
  const headers: Record<string, string> = {
    "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
    "access-control-allow-methods": "POST, OPTIONS", "access-control-max-age": "600", vary: "Origin",
  };
  if (origin === ALLOWED_ORIGIN) headers["access-control-allow-origin"] = ALLOWED_ORIGIN;
  return headers;
}
function respond(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors(req.headers.get("origin") || ""), "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}
function bearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  if (!h.startsWith("Bearer ")) throw new Error("CORE_SESSION_REQUIRED");
  const token = h.slice(7).trim();
  if (!token) throw new Error("CORE_SESSION_REQUIRED");
  return token;
}
async function coreIdentity(token: string) {
  const res = await fetch(`${CORE_URL}/auth/v1/user`, { method: "GET", headers: { apikey: CORE_PUBLISHABLE_KEY, authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!res.ok) throw new Error("CORE_SESSION_INVALID");
  const user = await res.json();
  const id = String(user?.id || "");
  const email = String(user?.email || "").trim().toLowerCase();
  if (!id || !email) throw new Error("CORE_IDENTITY_INCOMPLETE");
  return { id, email };
}
async function coreAccess(token: string, user: { id: string; email: string }) {
  const params = new URLSearchParams({ select: "user_id,email,role,enabled", user_id: `eq.${user.id}`, enabled: "eq.true", limit: "1" });
  const res = await fetch(`${CORE_URL}/rest/v1/aml_allowed_users?${params.toString()}`, { method: "GET", headers: { apikey: CORE_PUBLISHABLE_KEY, authorization: `Bearer ${token}`, accept: "application/json" }, cache: "no-store" });
  if (!res.ok) throw new Error("CORE_ALLOWLIST_UNAVAILABLE");
  const rows = await res.json();
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row || row.enabled !== true) throw new Error("CORE_ACCESS_DENIED");
  if (String(row.user_id || "") !== user.id || String(row.email || "").trim().toLowerCase() !== user.email) throw new Error("CORE_ACCESS_MISMATCH");
  return { role: String(row.role || "viewer").trim().toLowerCase() };
}
function v2Role(coreRole: string) { return coreRole === "admin" ? "admin" : coreRole === "reviewer" ? "reviewer" : "analyst"; }
async function ensureV2User(sb: ReturnType<typeof admin>, email: string) {
  let link = await sb.auth.admin.generateLink({ type: "magiclink", email });
  if (!link.error && link.data?.properties?.hashed_token) return link.data;
  const created = await sb.auth.admin.createUser({ email, email_confirm: true });
  if (created.error && !/already|registered|exists/i.test(created.error.message || "")) throw new Error(`V2_USER_CREATE_FAILED:${created.error.message}`);
  link = await sb.auth.admin.generateLink({ type: "magiclink", email });
  if (link.error || !link.data?.properties?.hashed_token) throw new Error(`V2_LINK_FAILED:${link.error?.message || "missing token hash"}`);
  return link.data;
}
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== "POST") return respond(req, { error: "METHOD_NOT_ALLOWED" }, 405);
  if (origin && origin !== ALLOWED_ORIGIN) return respond(req, { error: "ORIGIN_NOT_ALLOWED" }, 403);
  try {
    const coreToken = bearer(req);
    const identity = await coreIdentity(coreToken);
    const access = await coreAccess(coreToken, identity);
    const role = v2Role(access.role);
    const sbAdmin = admin();
    const linkData = await ensureV2User(sbAdmin, identity.email);
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + GRANT_TTL_MS);
    const { error: allowError } = await sbAdmin.from("aml_allowed_users").upsert({ email: identity.email, role, enabled: true, notes: `federated:${SOURCE_PROJECT}:${identity.id}` }, { onConflict: "email" });
    if (allowError) throw new Error(`V2_ALLOWLIST_SYNC_FAILED:${allowError.message}`);
    const { error: grantError } = await sbAdmin.from("atlas_v2_session_grant").upsert({ email: identity.email, core_user_id: identity.id, core_role: access.role, source_project: SOURCE_PROJECT, issued_at: issuedAt.toISOString(), expires_at: expiresAt.toISOString() }, { onConflict: "email" });
    if (grantError) throw new Error(`V2_GRANT_FAILED:${grantError.message}`);
    const sbUser = userClient();
    const verified = await sbUser.auth.verifyOtp({ token_hash: String(linkData.properties?.hashed_token || ""), type: String(linkData.properties?.verification_type || "magiclink") as any });
    const session = verified.data?.session;
    if (verified.error || !session?.access_token) {
      await sbAdmin.from("atlas_v2_session_grant").delete().eq("email", identity.email);
      throw new Error(`V2_SESSION_MINT_FAILED:${verified.error?.message || "missing access token"}`);
    }
    return respond(req, { schema: "ATLAS_V2_SESSION_EXCHANGE_V1", access_token: session.access_token, expires_at: session.expires_at || null, grant_expires_at: expiresAt.toISOString(), identity: { email: identity.email, role } });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const denied = /CORE_(SESSION|ACCESS|IDENTITY)|ORIGIN/.test(detail);
    console.warn("atlas-v2-session-exchange", detail.slice(0, 180));
    return respond(req, { error: denied ? "ACCESS_DENIED" : "SESSION_EXCHANGE_FAILED" }, denied ? 403 : 500);
  }
});
