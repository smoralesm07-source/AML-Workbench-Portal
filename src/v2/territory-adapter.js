'use strict';

(function installAtlasV2TerritoryAdapter(global) {
  if (global.AtlasV2Territory?.installed) return;

  const DEFAULT_URL = 'https://bzqxvidggykkdouotylg.supabase.co';
  const DEFAULT_PUBLISHABLE_KEY = 'sb_publishable_3nrUSbZMWfTYUtXnyjDklg_EjyZIzko';
  const ENDPOINT = '/functions/v1/atlas-v2-read';
  const DEFAULT_TIMEOUT_MS = 12000;

  function clean(value, max = 180) {
    const out = String(value ?? '').trim();
    return out && out.length <= max ? out : '';
  }

  async function coreAccessToken() {
    if (!global.AtlasV2Access?.getAccessToken) return null;
    return global.AtlasV2Access.getAccessToken();
  }

  async function v2AccessToken(coreToken) {
    if (global.AtlasV2Session?.getAccessToken) return global.AtlasV2Session.getAccessToken(async () => coreToken);
    return coreToken;
  }

  async function query(kind, payload = {}, options = {}) {
    const coreToken = await coreAccessToken();
    if (!coreToken) throw new Error('ATLAS core session is unavailable');
    const token = await v2AccessToken(coreToken);
    if (!token) throw new Error('ATLAS v2 session is unavailable');

    const config = global.__ATLAS_V2_CONFIG__ || {};
    const supabaseUrl = String(config.supabaseUrl || DEFAULT_URL).replace(/\/$/, '');
    const publishableKey = String(config.publishableKey || DEFAULT_PUBLISHABLE_KEY);
    const controller = new AbortController();
    const timeoutMs = Math.max(1000, Math.min(Number(options.timeoutMs || DEFAULT_TIMEOUT_MS), 30000));
    const timer = setTimeout(() => controller.abort(new DOMException('ATLAS_V2_TIMEOUT', 'TimeoutError')), timeoutMs);

    try {
      const res = await fetch(`${supabaseUrl}${ENDPOINT}`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          apikey: publishableKey,
          'content-type': 'application/json',
          'x-client-info': 'atlas-v2-territory/1.0',
          'x-atlas-core-authorization': `Bearer ${coreToken}`,
        },
        body: JSON.stringify({ operation: 'territory_query', query: { ...payload, kind }, route: clean(options.route || location.hash || 'territorio', 120) || 'territorio' }),
        signal: controller.signal,
        cache: 'no-store',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const error = new Error(body?.error || `ATLAS Territory read failed (${res.status})`);
        error.code = body?.error || 'TERRITORY_READ_FAILED';
        error.status = res.status;
        error.traceId = body?.trace_id || res.headers.get('x-atlas-trace-id') || null;
        throw error;
      }
      if (body?.schema !== 'ATLAS_TERRITORY_QUERY_V2' || body?.kind !== kind) {
        const error = new Error('ATLAS Territory contract mismatch');
        error.code = 'CONTRACT_MISMATCH';
        throw error;
      }
      return {
        contract: body.schema,
        kind: body.kind,
        generatedAt: body.generated_at || null,
        items: Array.isArray(body.items) ? body.items : [],
        item: body.item || null,
        summary: body.summary || {},
        page: body.page || null,
        semantics: body.semantics || {},
        data: body,
        meta: { traceId: body.trace_id || res.headers.get('x-atlas-trace-id') || null, snapshot: res.headers.get('x-atlas-snapshot') || body.generated_at || null },
      };
    } finally {
      clearTimeout(timer);
    }
  }

  global.AtlasV2Territory = Object.freeze({
    installed: true,
    overview: (options = {}) => query('overview', {}, options),
    regions: (options = {}) => query('regions', { region: clean(options.region, 120) }, options),
    communes: (options = {}) => query('communes', { region: clean(options.region, 120), search: clean(options.search, 120), limit: Math.max(1, Math.min(Number(options.limit || 60), 200)), offset: Math.max(0, Number(options.offset || 0)) }, options),
    detail: (options = {}) => query('detail', { region: clean(options.region, 120), commune: clean(options.commune, 120), commune_code: clean(options.communeCode, 20) }, options),
    signals: (options = {}) => query('signals', { region: clean(options.region, 120), priority: clean(options.priority, 40).toUpperCase(), limit: Math.max(1, Math.min(Number(options.limit || 60), 200)), offset: Math.max(0, Number(options.offset || 0)) }, options),
    entities: (options = {}) => query('entities', { region: clean(options.region, 120), commune: clean(options.commune, 120), search: clean(options.search, 160), limit: Math.max(1, Math.min(Number(options.limit || 60), 200)), offset: Math.max(0, Number(options.offset || 0)) }, options),
  });
})(window);
