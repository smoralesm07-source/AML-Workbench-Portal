import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const CORE_URL = "https://ldmtlwzqaqmegedktlxr.supabase.co";
const CORE_PUBLISHABLE_KEY = "sb_publishable_Nu21dZFBM3NwtIvOwIM8ag_9tyfDJyR";
const ALLOWED_ORIGIN = "https://smoralesm07-source.github.io";
const EDGE_MAP: Record<string, string> = Object.freeze({
  watchlists_live: "aml-entity-global-watchlists-live",
  digital_identity_live: "aml-digital-identity-live",
  digital_identity_deep: "aml-digital-identity-deep",
});
const CORS = {
  "access-control-allow-origin": ALLOWED_ORIGIN,
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, x-atlas-core-authorization",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-expose-headers": "server-timing, x-atlas-trace-id",
};
function json(body: unknown, status = 200, extra: Record<string,string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store", ...extra } });
}
function clean(value: unknown, max = 240) { const s = String(value ?? "").trim(); return s && s.length <= max ? s : ""; }
function canonicalRut(value: unknown) { const compact = String(value ?? "").toUpperCase().replace(/[^0-9K]/g, ""); return compact.length < 2 ? "" : `${compact.slice(0,-1)}-${compact.slice(-1)}`; }
function coreClient(coreAuth: string) { return createClient(CORE_URL, CORE_PUBLISHABLE_KEY, { global: { headers: { Authorization: coreAuth } }, auth: { persistSession:false, autoRefreshToken:false, detectSessionInUrl:false } }); }
async function invokeCoreEdge(slug: string, coreAuth: string, body: Record<string,unknown>) {
  const r = await fetch(`${CORE_URL}/functions/v1/${slug}`, {
    method: "POST",
    headers: { authorization: coreAuth, apikey: CORE_PUBLISHABLE_KEY, "content-type":"application/json", "x-client-info":"atlas-v2-entity-intelligence/2.1" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(slug === "aml-digital-identity-deep" ? 28000 : 20000),
  });
  const payload = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(String(payload?.error || `CORE_EDGE_${r.status}`)), { status:r.status });
  return payload;
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers:CORS });
  if (req.method !== "POST") return json({ error:"METHOD_NOT_ALLOWED" },405);
  const started = performance.now();
  const traceId = crypto.randomUUID();
  const coreAuth = req.headers.get("x-atlas-core-authorization") || "";
  if (!coreAuth.startsWith("Bearer ")) return json({ error:"MISSING_CORE_AUTH", trace_id:traceId },401,{"x-atlas-trace-id":traceId});
  try {
    const input = await req.json().catch(() => ({}));
    const operation = clean(input?.operation,80);
    const query = input?.query && typeof input.query === "object" ? input.query : {};
    if (operation === "entity_intelligence_read") {
      const entityId = clean(query?.entity_id,220);
      const rut = canonicalRut(query?.rut);
      if (!entityId) return json({ error:"INVALID_ENTITY", trace_id:traceId },400,{"x-atlas-trace-id":traceId});
      const dbStarted = performance.now();
      const { data, error } = await coreClient(coreAuth).rpc("atlas_v2_entity_intelligence_read", { p_entity_id:entityId, p_rut:rut || null });
      const dbMs = Math.round(performance.now()-dbStarted);
      if (error) {
        const status = error.code === "42501" ? 403 : 500;
        return json({ error:status===403?"FORBIDDEN":"ENTITY_INTELLIGENCE_READ_ERROR", trace_id:traceId },status,{"x-atlas-trace-id":traceId,"server-timing":`coredb;dur=${dbMs}`});
      }
      if (data?.contract !== "ATLAS_ENTITY_INTELLIGENCE_V2") return json({ error:"CONTRACT_MISMATCH", trace_id:traceId },502,{"x-atlas-trace-id":traceId});
      const totalMs = Math.round(performance.now()-started);
      console.log(JSON.stringify({type:"atlas_v2_entity_intelligence",trace_id:traceId,operation,status:"OK",db_ms:dbMs,total_ms:totalMs}));
      return json({ ...data, trace_id:traceId },200,{"x-atlas-trace-id":traceId,"server-timing":`coredb;dur=${dbMs}, total;dur=${totalMs}`});
    }
    if (!(operation in EDGE_MAP)) return json({ error:"INVALID_OPERATION", trace_id:traceId },400,{"x-atlas-trace-id":traceId});
    let body: Record<string,unknown>;
    if (operation === "watchlists_live") {
      const name=clean(query?.name,240), rut=canonicalRut(query?.rut), entityType=clean(query?.entity_type,100);
      if (!name && !rut) return json({ error:"ENTITY_REQUIRED", trace_id:traceId },400,{"x-atlas-trace-id":traceId});
      body={name,rut:rut||null,entity_type:entityType||null};
    } else {
      const username=clean(query?.username,80);
      if (username.length<2) return json({ error:"USERNAME_REQUIRED", trace_id:traceId },400,{"x-atlas-trace-id":traceId});
      body=operation==="digital_identity_live"?{username,depth:query?.depth==="deep"?"deep":"quick"}:{username};
    }
    const edgeStarted=performance.now();
    const payload=await invokeCoreEdge(EDGE_MAP[operation],coreAuth,body);
    const edgeMs=Math.round(performance.now()-edgeStarted), totalMs=Math.round(performance.now()-started);
    console.log(JSON.stringify({type:"atlas_v2_entity_intelligence",trace_id:traceId,operation,status:"OK",core_edge_ms:edgeMs,total_ms:totalMs}));
    return json({ contract:"ATLAS_ENTITY_LIVE_OSINT_V2", operation, data:payload, trace_id:traceId },200,{"x-atlas-trace-id":traceId,"server-timing":`coreedge;dur=${edgeMs}, total;dur=${totalMs}`});
  } catch (error) {
    const message=error instanceof Error?error.message:String(error);
    const status=Number((error as any)?.status)||500;
    console.warn(JSON.stringify({type:"atlas_v2_entity_intelligence",trace_id:traceId,status:"ERROR",code:message.slice(0,80)}));
    return json({ error:status===403?"FORBIDDEN":"ENTITY_INTELLIGENCE_ERROR", trace_id:traceId },status,{"x-atlas-trace-id":traceId});
  }
});
