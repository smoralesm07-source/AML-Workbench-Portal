'use strict';

(function installAtlasV2WatchAdapter(global) {
  if (global.AtlasV2Watch?.installed) return;

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
          'x-client-info': 'atlas-v2-watch/1.0',
          'x-atlas-core-authorization': `Bearer ${coreToken}`,
        },
        body: JSON.stringify({ operation: 'watch_query', query: { ...payload, kind }, route: clean(options.route || location.hash || 'vigilancia', 120) || 'vigilancia' }),
        signal: controller.signal,
        cache: 'no-store',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const error = new Error(body?.error || `ATLAS Watch read failed (${res.status})`);
        error.code = body?.error || 'WATCH_READ_FAILED';
        error.status = res.status;
        error.traceId = body?.trace_id || res.headers.get('x-atlas-trace-id') || null;
        throw error;
      }
      if (body?.schema !== 'ATLAS_WATCH_QUERY_V2' || body?.kind !== kind) {
        const error = new Error('ATLAS Watch contract mismatch');
        error.code = 'CONTRACT_MISMATCH';
        throw error;
      }
      return {
        contract: body.schema,
        kind: body.kind,
        snapshotId: body.snapshot_id || null,
        generatedAt: body.generated_at || null,
        items: Array.isArray(body.items) ? body.items : [],
        summary: body.summary || {},
        families: Array.isArray(body.families) ? body.families : [],
        comparison: body.comparison || {},
        page: body.page || null,
        semantics: body.semantics || {},
        data: body,
        meta: { traceId: body.trace_id || res.headers.get('x-atlas-trace-id') || null, snapshot: res.headers.get('x-atlas-snapshot') || body.snapshot_id || null },
      };
    } finally {
      clearTimeout(timer);
    }
  }

  function filters(options = {}) {
    return {
      family: clean(options.family, 80).toUpperCase(),
      priority: clean(options.priority, 40).toUpperCase(),
      scope_type: clean(options.scopeType, 80).toUpperCase(),
      search: clean(options.search, 160),
      limit: Math.max(1, Math.min(Number(options.limit || 60), 200)),
      offset: Math.max(0, Number(options.offset || 0)),
    };
  }

  global.AtlasV2Watch = Object.freeze({
    installed: true,
    overview: (options = {}) => query('overview', {}, options),
    signals: (options = {}) => query('signals', filters(options), options),
    changes: (options = {}) => query('changes', filters(options), options),
    sources: (options = {}) => query('sources', { search: clean(options.search, 160), limit: Math.max(1, Math.min(Number(options.limit || 100), 200)), offset: Math.max(0, Number(options.offset || 0)) }, options),
    timeline: (options = {}) => query('timeline', { limit: Math.max(1, Math.min(Number(options.limit || 30), 100)), offset: Math.max(0, Number(options.offset || 0)) }, options),
  });
})(window);
