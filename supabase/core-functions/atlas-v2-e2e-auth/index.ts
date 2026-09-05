import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@6.2.5";

const ISSUER = "https://token.actions.githubusercontent.com";
const JWKS = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks`));
const AUDIENCE = "atlas-v2-e2e";
const REPOSITORY = "smoralesm07-source/AML-Workbench-Portal";
const REF = "refs/heads/atlas-architecture-v2";
const WORKFLOW_REF = `${REPOSITORY}/.github/workflows/e2e-atlas-v2-public-spend.yml@${REF}`;
const ALLOWED_EVENTS = new Set(["push", "workflow_dispatch"]);
const TTL_MS = 20 * 60 * 1000;

function parseKeySet(name: string) {
  try { return JSON.parse(Deno.env.get(name) || "{}"); } catch (_) { return {}; }
}
function firstKey(values: Record<string, unknown>) { return String(values.default || Object.values(values)[0] || ""); }
function client(secret: boolean) {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = firstKey(parseKeySet(secret ? "SUPABASE_SECRET_KEYS" : "SUPABASE_PUBLISHABLE_KEYS"));
  if (!url || !key) throw new Error(secret ? "SERVER_CREDENTIALS_UNAVAILABLE" : "PUBLIC_CREDENTIALS_UNAVAILABLE");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
function bearer(req: Request) {
  const header = req.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) throw new Error("OIDC_TOKEN_REQUIRED");
  return header.slice(7).trim();
}
async function authorize(req: Request) {
  const { payload } = await jwtVerify(bearer(req), JWKS, { issuer: ISSUER, audience: AUDIENCE });
  if (payload.repository !== REPOSITORY) throw new Error("OIDC_REPOSITORY_DENIED");
  if (payload.ref !== REF) throw new Error("OIDC_REF_DENIED");
  if (payload.workflow_ref !== WORKFLOW_REF) throw new Error("OIDC_WORKFLOW_DENIED");
  if (!ALLOWED_EVENTS.has(String(payload.event_name || ""))) throw new Error("OIDC_EVENT_DENIED");
}
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}
async function cleanup(sb: ReturnType<typeof client>, userId: string, email: string) {
  await sb.from("aml_allowed_users").delete().eq("user_id", userId).eq("email", email);
  await sb.from("atlas_v2_e2e_principal").delete().eq("user_id", userId).eq("email", email);
  const deleted = await sb.auth.admin.deleteUser(userId);
  return !deleted.error || /not found/i.test(deleted.error.message || "");
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  try {
    await authorize(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "issue");
    const sbAdmin = client(true);

    if (action === "cleanup") {
      const userId = String(body?.user_id || "");
      const email = String(body?.email || "").toLowerCase();
      if (!/^[0-9a-f-]{36}$/i.test(userId) || !/^atlas-v2-e2e-[a-z0-9-]+@example\.invalid$/.test(email)) return json({ error: "INVALID_CLEANUP_TARGET" }, 400);
      const ok = await cleanup(sbAdmin, userId, email);
      return json({ schema: "ATLAS_V2_E2E_AUTH_V1", action: "cleanup", ok });
    }

    if (action !== "issue") return json({ error: "INVALID_ACTION" }, 400);
    const email = `atlas-v2-e2e-${crypto.randomUUID().toLowerCase()}@example.invalid`;
    const expiresAt = new Date(Date.now() + TTL_MS);
    const created = await sbAdmin.auth.admin.createUser({ email, email_confirm: true });
    if (created.error || !created.data?.user?.id) throw new Error(`E2E_USER_CREATE_FAILED:${created.error?.message || "missing user"}`);
    const userId = created.data.user.id;

    try {
      const principal = await sbAdmin.from("atlas_v2_e2e_principal").insert({ user_id: userId, email, expires_at: expiresAt.toISOString() });
      if (principal.error) throw new Error(`E2E_PRINCIPAL_FAILED:${principal.error.message}`);
      const allow = await sbAdmin.from("aml_allowed_users").insert({ user_id: userId, email, role: "viewer", enabled: true });
      if (allow.error) throw new Error(`E2E_ALLOWLIST_FAILED:${allow.error.message}`);

      const link = await sbAdmin.auth.admin.generateLink({ type: "magiclink", email });
      if (link.error || !link.data?.properties?.hashed_token) throw new Error(`E2E_LINK_FAILED:${link.error?.message || "missing token"}`);
      const sbPublic = client(false);
      const verified = await sbPublic.auth.verifyOtp({ token_hash: String(link.data.properties.hashed_token), type: String(link.data.properties.verification_type || "magiclink") as any });
      const session = verified.data?.session;
      if (verified.error || !session?.access_token || !session?.refresh_token) throw new Error(`E2E_SESSION_FAILED:${verified.error?.message || "missing session"}`);

      return json({
        schema: "ATLAS_V2_E2E_AUTH_V1", action: "issue", user_id: userId, email,
        access_token: session.access_token, refresh_token: session.refresh_token, expires_at: expiresAt.toISOString(),
      });
    } catch (error) {
      await cleanup(sbAdmin, userId, email);
      throw error;
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.warn("atlas-v2-e2e-auth", detail.slice(0, 160));
    const denied = /^OIDC_|JWT|signature|audience|issuer/i.test(detail);
    return json({ error: denied ? "OIDC_DENIED" : "E2E_AUTH_FAILED" }, denied ? 403 : 500);
  }
});
