import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@6.2.5";

const ISSUER = "https://token.actions.githubusercontent.com";
const AUDIENCE = "atlas-v2-source-ingest";
const REPOSITORY = "smoralesm07-source/Rada_Presupuesto_Abierto";
const ALLOWED_WORKFLOW_REFS = new Set([
  `${REPOSITORY}/.github/workflows/atlas-v2-publish.yml@refs/heads/main`,
  `${REPOSITORY}/.github/workflows/spend-view-corrected-v3.yml@refs/heads/main`,
]);
const JWKS = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks`));

function respond(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function clean(v: unknown, max = 220) {
  const s = String(v ?? "").trim();
  return s && s.length <= max ? s : "";
}

async function principal(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) throw new Error("MISSING_OIDC");
  const { payload } = await jwtVerify(auth.slice(7), JWKS, {
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  if (payload.repository !== REPOSITORY) throw new Error("WRONG_REPOSITORY");
  if (String(payload.ref || "") !== "refs/heads/main") throw new Error("WRONG_REF");
  if (!["push", "workflow_dispatch", "schedule", "workflow_run"].includes(String(payload.event_name || ""))) {
    throw new Error("WRONG_EVENT");
  }
  const workflowRef = String(payload.workflow_ref || "");
  if (!workflowRef || !ALLOWED_WORKFLOW_REFS.has(workflowRef)) throw new Error("WRONG_WORKFLOW");
  return payload;
}

function admin() {
  const url = Deno.env.get("SUPABASE_URL") || "";
  let key = "";
  try {
    const parsed = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    key = String(parsed.default || Object.values(parsed)[0] || "");
  } catch (_) {
    key = "";
  }
  if (!key) key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !key) throw new Error("SERVER_CREDENTIALS_UNAVAILABLE");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return respond({ error: "METHOD_NOT_ALLOWED" }, 405);
  try {
    const p = await principal(req);
    const body = await req.json().catch(() => ({}));
    const sourceKey = clean(body?.source_key, 120);
    const snapshotId = clean(body?.snapshot_id, 180);
    const contract = clean(body?.contract, 120);
    const generatedAt = clean(body?.generated_at, 80);
    const payload = body?.payload;
    const sourceVersions = body?.source_versions && typeof body.source_versions === "object" ? body.source_versions : {};

    if (sourceKey !== "presupuesto_abierto_l12") return respond({ error: "INVALID_SOURCE" }, 400);
    if (contract !== "ATLAS_BUDGET_EXECUTION_SOURCE_V2") return respond({ error: "INVALID_CONTRACT" }, 400);
    if (!snapshotId || !generatedAt || !payload || typeof payload !== "object") return respond({ error: "INVALID_PAYLOAD" }, 400);
    if (payload.contract !== contract) return respond({ error: "PAYLOAD_CONTRACT_MISMATCH" }, 400);

    const sb = admin();
    const { data, error } = await sb.rpc("atlas_v2_ingest_source_snapshot", {
      p_source_key: sourceKey,
      p_snapshot_id: snapshotId,
      p_contract: contract,
      p_generated_at: generatedAt,
      p_payload: payload,
      p_source_versions: {
        ...sourceVersions,
        github_repository: p.repository,
        github_ref: p.ref,
        github_sha: p.sha,
        github_event: p.event_name,
        github_workflow_ref: p.workflow_ref,
      },
    });
    if (error) throw new Error(`${error.code || "RPC"}:${error.message}`);
    return respond({ ok: true, ingest: data });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.error("atlas-v2-source-ingest", detail);
    return respond({ error: "INGEST_REJECTED", detail: detail.slice(0, 220) }, 403);
  }
});