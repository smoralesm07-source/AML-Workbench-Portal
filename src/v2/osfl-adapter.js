'use strict';

(function installAtlasV2OsflAdapter(global) {
  if (global.AtlasV2Osfl?.installed) return;

  const DEFAULT_URL = 'https://bzqxvidggykkdouotylg.supabase.co';
  const DEFAULT_PUBLISHABLE_KEY = 'sb_publishable_3nrUSbZMWfTYUtXnyjDklg_EjyZIzko';
  const ENDPOINT = '/functions/v1/atlas-v2-read';
  const CONTRACT = 'ATLAS_OSFL_QUERY_V2';
  const DEFAULT_TIMEOUT_MS = 12000;
  const CACHE_MS = 30000;
  let dashboardCache = null;
  let overviewCache = null;

  function clean(value, max = 180) {
    const out = String(value ?? '').trim();
    return out && out.length <= max ? out : '';
  }

  async function coreAccessToken() {
    if (!global.AtlasV2Access?.getAccessToken) return null;
    return global.AtlasV2Access.getAccessToken();
  }

  async function v2AccessToken(coreToken) {
    if (global.AtlasV2Session?.getAccessToken) {
      return global.AtlasV2Session.getAccessToken(async () => coreToken);
    }
    return coreToken;
  }

  async function query(kind, payload = {}, options = {}) {
    const coreToken = await coreAccessToken();
    if (!coreToken) {
      const error = new Error('ATLAS core session is unavailable');
      error.code = 'OSFL_CORE_AUTH_REQUIRED';
      throw error;
    }
    const token = await v2AccessToken(coreToken);
    if (!token) {
      const error = new Error('ATLAS v2 session is unavailable');
      error.code = 'OSFL_V2_AUTH_REQUIRED';
      throw error;
    }

    const config = global.__ATLAS_V2_CONFIG__ || {};
    const supabaseUrl = String(config.supabaseUrl || DEFAULT_URL).replace(/\/$/, '');
    const publishableKey = String(config.publishableKey || DEFAULT_PUBLISHABLE_KEY);
    const controller = new AbortController();
    const timeoutMs = Math.max(1000, Math.min(Number(options.timeoutMs || DEFAULT_TIMEOUT_MS), 30000));
    const timer = setTimeout(() => controller.abort(new DOMException('ATLAS_V2_TIMEOUT', 'TimeoutError')), timeoutMs);
    if (options.signal) {
      if (options.signal.aborted) controller.abort(options.signal.reason);
      else options.signal.addEventListener('abort', () => controller.abort(options.signal.reason), { once: true });
    }

    try {
      const res = await fetch(`${supabaseUrl}${ENDPOINT}`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          apikey: publishableKey,
          'content-type': 'application/json',
          'x-client-info': 'atlas-v2/osfl-adapter/3.0',
          'x-atlas-core-authorization': `Bearer ${coreToken}`,
        },
        body: JSON.stringify({
          operation: 'osfl_query',
          query: { ...payload, kind },
          route: clean(options.route || location.hash || 'osfl', 120) || 'osfl',
        }),
        signal: controller.signal,
        cache: 'no-store',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const error = new Error(body?.error || `OSFL read failed (${res.status})`);
        error.code = body?.error || 'OSFL_READ_FAILED';
        error.status = res.status;
        error.traceId = body?.trace_id || res.headers.get('x-atlas-trace-id') || null;
        throw error;
      }
      if (body?.schema !== CONTRACT || body?.kind !== kind) {
        const error = new Error('OSFL contract mismatch');
        error.code = 'OSFL_CONTRACT_MISMATCH';
        throw error;
      }
      if (body?.error) {
        const error = new Error(body.error);
        error.code = body.error;
        error.traceId = body?.trace_id || null;
        throw error;
      }
      return body;
    } catch (error) {
      if (controller.signal.aborted && error?.name !== 'AbortError') {
        const timeout = new Error('OSFL read timed out or was cancelled');
        timeout.code = 'OSFL_TIMEOUT_OR_CANCELLED';
        throw timeout;
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async function dashboard(options = {}) {
    const now = Date.now();
    if (!options.force && dashboardCache && now - dashboardCache.at < CACHE_MS) return dashboardCache.value;
    const value = await query('dashboard', {}, options);
    dashboardCache = { at: Date.now(), value };
    return value;
  }

  function search(filters = {}, options = {}) {
    return query('search', filters, options);
  }

  function detail(entityId, options = {}) {
    return query('detail', { entity_id: clean(entityId, 180) }, options);
  }

  // Backward compatibility for previous OSFL surface and external callers.
  async function overview(options = {}) {
    const now = Date.now();
    if (!options.force && overviewCache && now - overviewCache.at < CACHE_MS) return overviewCache.value;
    const value = await query('overview', {}, options);
    overviewCache = { at: Date.now(), value };
    return value;
  }

  function entities(filters = {}, options = {}) {
    return query('entities', filters, options);
  }

  function clearCache() {
    dashboardCache = null;
    overviewCache = null;
  }

  global.AtlasV2Osfl = Object.freeze({
    installed: true,
    contract: CONTRACT,
    dashboard,
    search,
    detail,
    overview,
    entities,
    query,
    clearCache,
  });
})(window);