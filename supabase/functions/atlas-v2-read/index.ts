import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const ALLOWED_MODELS = new Set(["public_spend_overview"]);
const CORS = {
  "access-control-allow-origin": "https://smoralesm07-source.github.io",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type, if-none-match",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-expose-headers": "etag, server-timing, x-atlas-trace-id, x-atlas-snapshot",
};

function response(body: unknown, status = 200, extra: Record<string,string> = {}) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: {
      ...CORS,
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, max-age=15, must-revalidate",
      ...extra,
    },
  });
}

function clean(value: unknown, max = 120) {
  const s = String(value ?? "").trim();
  return s && s.length <= max ? s : "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return response({ error: "METHOD_NOT_ALLOWED" }, 405);

  const started = performance.now();
  const traceId = crypto.randomUUID();
  const auth = req.headers.get("authorization") || "";
  const url = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";

  if (!auth.startsWith("Bearer ")) return response({ error: "MISSING_AUTH", trace_id: traceId }, 401, { "x-atlas-trace-id": traceId });
  if (!url || !anonKey) return response({ error: "SERVER_CONFIG", trace_id: traceId }, 500, { "x-atlas-trace-id": traceId });

  try {
    const body = await req.json().catch(() => ({}));
    const model = clean(body?.model);
    const scope = clean(body?.scope || "global");
    const route = clean(body?.route || "unknown", 120) || "unknown";

    if (!ALLOWED_MODELS.has(model) || !scope) {
      return response({ error: "INVALID_MODEL", trace_id: traceId }, 400, { "x-atlas-trace-id": traceId });
    }

    const sb = createClient(url, anonKey, {
      global: { headers: { Authorization: auth } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const dbStarted = performance.now();
    const { data, error } = await sb.rpc("atlas_v2_get_read_model", {
      p_model_key: model,
      p_scope_key: scope,
    });
    const dbMs = Math.round(performance.now() - dbStarted);

    if (error) {
      const totalMs = Math.round(performance.now() - started);
      console.error(JSON.stringify({ type: "atlas_v2_read", trace_id: traceId, model, scope, route, status: "ERROR", db_ms: dbMs, total_ms: totalMs, code: error.code }));
      return response({ error: "READ_MODEL_ERROR", trace_id: traceId }, 500, {
        "x-atlas-trace-id": traceId,
        "server-timing": `db;dur=${dbMs}, total;dur=${totalMs}`,
      });
    }

    if (!data) {
      const totalMs = Math.round(performance.now() - started);
      console.warn(JSON.stringify({ type: "atlas_v2_read", trace_id: traceId, model, scope, route, status: "NOT_AVAILABLE", db_ms: dbMs, total_ms: totalMs }));
      return response({ error: "MODEL_NOT_AVAILABLE", trace_id: traceId }, 404, {
        "x-atlas-trace-id": traceId,
        "server-timing": `db;dur=${dbMs}, total;dur=${totalMs}`,
      });
    }

    const checksum = String(data.payload_checksum || "");
    const etag = checksum ? `\"${checksum}\"` : "";
    const ifNoneMatch = req.headers.get("if-none-match") || "";
    const totalMs = Math.round(performance.now() - started);

    const event = {
      trace_id: traceId,
      route,
      operation: `read_model:${model}`,
      phase: "edge_read",
      duration_ms: totalMs,
      status: "OK",
      metadata: { model, scope, snapshot_id: data.snapshot_id, db_ms: dbMs, contract: "ATLAS_READ_API_V2" },
    };
    const telemetry = sb.from("atlas_v2_client_event").insert(event).then(({ error: telemetryError }) => {
      if (telemetryError) console.warn(JSON.stringify({ type: "atlas_v2_telemetry", trace_id: traceId, code: telemetryError.code }));
    }).catch(() => undefined);
    const edgeRuntime = (globalThis as any).EdgeRuntime;
    if (edgeRuntime?.waitUntil) edgeRuntime.waitUntil(telemetry);

    const headers: Record<string,string> = {
      "x-atlas-trace-id": traceId,
      "x-atlas-snapshot": String(data.snapshot_id || ""),
      "server-timing": `db;dur=${dbMs}, total;dur=${totalMs}`,
    };
    if (etag) headers.etag = etag;

    if (etag && ifNoneMatch === etag) return response(null, 304, headers);
    return response({ ...data, trace_id: traceId }, 200, headers);
  } catch (e) {
    const totalMs = Math.round(performance.now() - started);
    console.error(JSON.stringify({ type: "atlas_v2_read", trace_id: traceId, status: "UNHANDLED", total_ms: totalMs, detail: e instanceof Error ? e.message.slice(0,180) : String(e).slice(0,180) }));
    return response({ error: "UNEXPECTED_ERROR", trace_id: traceId }, 500, {
      "x-atlas-trace-id": traceId,
      "server-timing": `total;dur=${totalMs}`,
    });
  }
});
