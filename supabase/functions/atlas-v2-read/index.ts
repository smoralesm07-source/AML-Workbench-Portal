import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const ALLOWED_MODELS = new Set(["public_spend_overview", "public_spend_monitor"]);
const CORE_URL = "https://ldmtlwzqaqmegedktlxr.supabase.co";
const CORE_PUBLISHABLE_KEY = "sb_publishable_Nu21dZFBM3NwtIvOwIM8ag_9tyfDJyR";

const QUERY_OPERATIONS = Object.freeze({
  public_spend_query: { rpc: "atlas_v2_public_spend_query", contract: "ATLAS_PUBLIC_SPEND_QUERY_V2", error: "PUBLIC_SPEND_QUERY_ERROR" },
  relations_query: { rpc: "atlas_v2_relations_query", contract: "ATLAS_RELATIONS_QUERY_V2", error: "RELATIONS_QUERY_ERROR" },
});
const CORE_QUERY_OPERATIONS = Object.freeze({
  universes_query: { rpc: "atlas_v2_universes_query", contract: "ATLAS_UNIVERSES_QUERY_V2", error: "UNIVERSES_QUERY_ERROR" },
  territory_query: { rpc: "atlas_v2_territory_query", contract: "ATLAS_TERRITORY_QUERY_V2", error: "TERRITORY_QUERY_ERROR" },
  watch_query: { rpc: "atlas_v2_watch_query", contract: "ATLAS_WATCH_QUERY_V2", error: "WATCH_QUERY_ERROR" },
  entity_search: { rpc: "atlas_v2_entity_search", contract: "ATLAS_ENTITY_SEARCH_V2", error: "ENTITY_SEARCH_ERROR" },
});
const CORS = {
  "access-control-allow-origin": "https://smoralesm07-source.github.io",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type, if-none-match, x-atlas-core-authorization",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-expose-headers": "etag, server-timing, x-atlas-trace-id, x-atlas-snapshot",
};
function response(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(body === null ? null : JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json; charset=utf-8", "cache-control": "private, max-age=15, must-revalidate", ...extra } });
}
function clean(value: unknown, max = 120) { const s = String(value ?? "").trim(); return s && s.length <= max ? s : ""; }
function canonicalRut(value: unknown) { const compact = String(value ?? "").toUpperCase().replace(/[^0-9K]/g, ""); return compact.length < 2 ? "" : `${compact.slice(0, -1)}-${compact.slice(-1)}`; }
function entityIdFromRut(rut: string) { const canonical = canonicalRut(rut); if (!/^\d{7,8}-[0-9K]$/.test(canonical)) return ""; const [body, dv] = canonical.split("-"); return `ENT-RUT-${body}-${dv}`; }
function userClient(url: string, key: string, auth: string) { return createClient(url, key, { global: { headers: { Authorization: auth } }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }); }
function persistTelemetry(sb: any, event: Record<string, unknown>, traceId: string) {
  const pending = sb.from("atlas_v2_client_event").insert(event).then(({ error }: any) => { if (error) console.warn(JSON.stringify({ type: "atlas_v2_telemetry", trace_id: traceId, code: error.code })); }).catch(() => undefined);
  const edgeRuntime = (globalThis as any).EdgeRuntime; if (edgeRuntime?.waitUntil) edgeRuntime.waitUntil(pending);
}
async function handleGovernedQuery(sb: any, operation: keyof typeof QUERY_OPERATIONS, query: Record<string, unknown>, route: string, traceId: string, started: number) {
  const spec = QUERY_OPERATIONS[operation]; const kind = clean(query?.kind, 80);
  if (!kind) return response({ error: "INVALID_QUERY", trace_id: traceId }, 400, { "x-atlas-trace-id": traceId });
  const dbStarted = performance.now(); const { data, error } = await sb.rpc(spec.rpc, { p_request: query }); const dbMs = Math.round(performance.now() - dbStarted); const totalMs = Math.round(performance.now() - started);
  if (error) { const status = error.code === "42501" ? 403 : 500; console.error(JSON.stringify({ type: "atlas_v2_read", trace_id: traceId, operation, kind, route, status: "ERROR", db_ms: dbMs, total_ms: totalMs, code: error.code })); return response({ error: status === 403 ? "FORBIDDEN" : spec.error, trace_id: traceId }, status, { "x-atlas-trace-id": traceId, "server-timing": `db;dur=${dbMs}, total;dur=${totalMs}`, "cache-control": "private, no-store" }); }
  if (data?.schema !== spec.contract || data?.kind !== kind) return response({ error: "CONTRACT_MISMATCH", trace_id: traceId }, 502, { "x-atlas-trace-id": traceId, "server-timing": `db;dur=${dbMs}, total;dur=${totalMs}`, "cache-control": "private, no-store" });
  const snapshotId = String(data?.snapshot_id || data?.generated_at || "");
  persistTelemetry(sb, { trace_id: traceId, route, operation: `${operation}:${kind}`, phase: "edge_read", duration_ms: totalMs, status: "OK", metadata: { kind, snapshot_id: snapshotId, db_ms: dbMs, contract: spec.contract } }, traceId);
  return response({ ...data, trace_id: traceId }, 200, { "x-atlas-trace-id": traceId, "x-atlas-snapshot": snapshotId, "server-timing": `db;dur=${dbMs}, total;dur=${totalMs}`, "cache-control": "private, no-store" });
}
async function handleCoreQuery(v2Client: any, operation: keyof typeof CORE_QUERY_OPERATIONS, coreAuth: string, query: Record<string, unknown>, route: string, traceId: string, started: number) {
  const spec = CORE_QUERY_OPERATIONS[operation]; const kind = clean(query?.kind, 80);
  if (!kind) return response({ error: "INVALID_QUERY", trace_id: traceId }, 400, { "x-atlas-trace-id": traceId });
  if (!coreAuth.startsWith("Bearer ")) return response({ error: "MISSING_CORE_AUTH", trace_id: traceId }, 401, { "x-atlas-trace-id": traceId });
  const core = userClient(CORE_URL, CORE_PUBLISHABLE_KEY, coreAuth); const dbStarted = performance.now(); const { data, error } = await core.rpc(spec.rpc, { p_request: query }); const dbMs = Math.round(performance.now() - dbStarted); const totalMs = Math.round(performance.now() - started);
  if (error) { const status = error.code === "42501" ? 403 : 500; console.error(JSON.stringify({ type: "atlas_v2_read", trace_id: traceId, operation, kind, route, status: "ERROR", db_ms: dbMs, total_ms: totalMs, code: error.code })); return response({ error: status === 403 ? "FORBIDDEN" : spec.error, trace_id: traceId }, status, { "x-atlas-trace-id": traceId, "server-timing": `coredb;dur=${dbMs}, total;dur=${totalMs}`, "cache-control": "private, no-store" }); }
  if (data?.schema !== spec.contract || data?.kind !== kind) return response({ error: `${operation.toUpperCase()}_CONTRACT_MISMATCH`, trace_id: traceId }, 502, { "x-atlas-trace-id": traceId, "server-timing": `coredb;dur=${dbMs}, total;dur=${totalMs}`, "cache-control": "private, no-store" });
  const snapshotId = String(data?.snapshot_id || data?.generated_at || ""); persistTelemetry(v2Client, { trace_id: traceId, route, operation: `${operation}:${kind}`, phase: "edge_read", duration_ms: totalMs, status: "OK", metadata: { kind, snapshot_id: snapshotId, core_db_ms: dbMs, contract: spec.contract } }, traceId);
  return response({ ...data, trace_id: traceId }, 200, { "x-atlas-trace-id": traceId, "x-atlas-snapshot": snapshotId, "server-timing": `coredb;dur=${dbMs}, total;dur=${totalMs}`, "cache-control": "private, no-store" });
}
async function handleEntity360(v2Client: any, coreAuth: string, query: Record<string, unknown>, route: string, traceId: string, started: number) {
  if (!coreAuth.startsWith("Bearer ")) return response({ error: "MISSING_CORE_AUTH", trace_id: traceId }, 401, { "x-atlas-trace-id": traceId });
  const rut = canonicalRut(query?.rut); const entityId = clean(query?.entity_id, 180) || entityIdFromRut(rut);
  if (!entityId || (rut && !/^\d{7,8}-[0-9K]$/.test(rut))) return response({ error: "INVALID_ENTITY", trace_id: traceId }, 400, { "x-atlas-trace-id": traceId });
  const core = userClient(CORE_URL, CORE_PUBLISHABLE_KEY, coreAuth); const dbStarted = performance.now(); const { data, error } = await core.rpc("atlas_v2_entity360_read", { p_entity_id: entityId, p_rut: rut || null }); const dbMs = Math.round(performance.now() - dbStarted); const totalMs = Math.round(performance.now() - started);
  if (error) { const status = error.code === "42501" ? 403 : 500; console.error(JSON.stringify({ type: "atlas_v2_read", trace_id: traceId, operation: "entity360_read", route, status: "ERROR", db_ms: dbMs, total_ms: totalMs, code: error.code })); return response({ error: status === 403 ? "FORBIDDEN" : "ENTITY360_READ_ERROR", trace_id: traceId }, status, { "x-atlas-trace-id": traceId, "server-timing": `coredb;dur=${dbMs}, total;dur=${totalMs}`, "cache-control": "private, no-store" }); }
  if (data?.contract !== "ATLAS_ENTITY360_READ_V2") return response({ error: "ENTITY360_CONTRACT_MISMATCH", trace_id: traceId }, 502, { "x-atlas-trace-id": traceId, "server-timing": `coredb;dur=${dbMs}, total;dur=${totalMs}`, "cache-control": "private, no-store" });
  const snapshotId = String(data?.generated_at || ""); persistTelemetry(v2Client, { trace_id: traceId, route, operation: "entity360_read", phase: "edge_read", duration_ms: totalMs, status: "OK", metadata: { snapshot_id: snapshotId, core_db_ms: dbMs, contract: "ATLAS_ENTITY360_READ_V2" } }, traceId);
  return response({ ...data, trace_id: traceId }, 200, { "x-atlas-trace-id": traceId, "x-atlas-snapshot": snapshotId, "server-timing": `coredb;dur=${dbMs}, total;dur=${totalMs}`, "cache-control": "private, no-store" });
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return response({ error: "METHOD_NOT_ALLOWED" }, 405);
  const started = performance.now(); const traceId = crypto.randomUUID(); const auth = req.headers.get("authorization") || ""; const coreAuth = req.headers.get("x-atlas-core-authorization") || ""; const url = Deno.env.get("SUPABASE_URL") || ""; const publishableKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!auth.startsWith("Bearer ")) return response({ error: "MISSING_AUTH", trace_id: traceId }, 401, { "x-atlas-trace-id": traceId });
  if (!url || !publishableKey) return response({ error: "SERVER_CONFIG", trace_id: traceId }, 500, { "x-atlas-trace-id": traceId });
  try {
    const body = await req.json().catch(() => ({})); const requestedOperation = clean(body?.operation || "read_model", 80); const route = clean(body?.route || "unknown", 120) || "unknown"; const sb = userClient(url, publishableKey, auth); const query = body?.query && typeof body.query === "object" ? body.query : {};
    const operationAliases: Record<string, string> = { public_spend: "public_spend_query", relations: "relations_query", universes: "universes_query", universe_explorer: "universes_query", territory: "territory_query", territory_explorer: "territory_query", watch: "watch_query", vigilance: "watch_query", entity_search: "entity_search", search_entities: "entity_search", entity360: "entity360_read", entity: "entity360_read" };
    const operation = operationAliases[requestedOperation] || requestedOperation;
    if (operation === "public_spend_query" || operation === "relations_query") return await handleGovernedQuery(sb, operation, query, route, traceId, started);
    if (operation === "universes_query" || operation === "territory_query" || operation === "watch_query" || operation === "entity_search") return await handleCoreQuery(sb, operation, coreAuth, query, route, traceId, started);
    if (operation === "entity360_read") return await handleEntity360(sb, coreAuth, query, route, traceId, started);
    if (operation !== "read_model") return response({ error: "INVALID_OPERATION", trace_id: traceId }, 400, { "x-atlas-trace-id": traceId });
    const model = clean(body?.model); const scope = clean(body?.scope || "global"); if (!ALLOWED_MODELS.has(model) || !scope) return response({ error: "INVALID_MODEL", trace_id: traceId }, 400, { "x-atlas-trace-id": traceId });
    const dbStarted = performance.now(); const { data, error } = await sb.rpc("atlas_v2_get_read_model", { p_model_key: model, p_scope_key: scope }); const dbMs = Math.round(performance.now() - dbStarted);
    if (error) { const totalMs = Math.round(performance.now() - started); console.error(JSON.stringify({ type: "atlas_v2_read", trace_id: traceId, model, scope, route, status: "ERROR", db_ms: dbMs, total_ms: totalMs, code: error.code })); return response({ error: "READ_MODEL_ERROR", trace_id: traceId }, 500, { "x-atlas-trace-id": traceId, "server-timing": `db;dur=${dbMs}, total;dur=${totalMs}` }); }
    if (!data) { const totalMs = Math.round(performance.now() - started); console.warn(JSON.stringify({ type: "atlas_v2_read", trace_id: traceId, model, scope, route, status: "NOT_AVAILABLE", db_ms: dbMs, total_ms: totalMs })); return response({ error: "MODEL_NOT_AVAILABLE", trace_id: traceId }, 404, { "x-atlas-trace-id": traceId, "server-timing": `db;dur=${dbMs}, total;dur=${totalMs}` }); }
    const checksum = String(data.payload_checksum || ""); const etag = checksum ? `\"${checksum}\"` : ""; const ifNoneMatch = req.headers.get("if-none-match") || ""; const totalMs = Math.round(performance.now() - started);
    persistTelemetry(sb, { trace_id: traceId, route, operation: `read_model:${model}`, phase: "edge_read", duration_ms: totalMs, status: "OK", metadata: { model, scope, snapshot_id: data.snapshot_id, db_ms: dbMs, contract: "ATLAS_READ_API_V2" } }, traceId);
    const headers: Record<string, string> = { "x-atlas-trace-id": traceId, "x-atlas-snapshot": String(data.snapshot_id || ""), "server-timing": `db;dur=${dbMs}, total;dur=${totalMs}` }; if (etag) headers.etag = etag; if (etag && ifNoneMatch === etag) return response(null, 304, headers); return response({ ...data, trace_id: traceId }, 200, headers);
  } catch (e) {
    const totalMs = Math.round(performance.now() - started); console.error(JSON.stringify({ type: "atlas_v2_read", trace_id: traceId, status: "UNHANDLED", total_ms: totalMs, detail: e instanceof Error ? e.message.slice(0, 180) : String(e).slice(0, 180) })); return response({ error: "UNEXPECTED_ERROR", trace_id: traceId }, 500, { "x-atlas-trace-id": traceId, "server-timing": `total;dur=${totalMs}` });
  }
});
