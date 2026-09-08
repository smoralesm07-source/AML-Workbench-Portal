'use strict';

(function installAtlasV2SanctionsAdapter(global) {
  if (global.AtlasV2Sanctions?.installed) return;

  const DEFAULT_URL = 'https://bzqxvidggykkdouotylg.supabase.co';
  const DEFAULT_PUBLISHABLE_KEY = 'sb_publishable_3nrUSbZMWfTYUtXnyjDklg_EjyZIzko';
  const ENDPOINT = '/functions/v1/atlas-v2-read';
  const CONTRACT = 'ATLAS_SANCTIONS_QUERY_V2';
  const DEFAULT_TIMEOUT_MS = 12000;
  const CACHE_MS = 30000;
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
      error.code = 'SANCTIONS_CORE_AUTH_REQUIRED';
      throw error;
    }
    const token = await v2AccessToken(coreToken);
    if (!token) {
      const error = new Error('ATLAS v2 session is unavailable');
      error.code = 'SANCTIONS_V2_AUTH_REQUIRED';
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
          'x-client-info': 'atlas-v2/sanctions-adapter/2.0',
          'x-atlas-core-authorization': `Bearer ${coreToken}`,
        },
        body: JSON.stringify({
          operation: 'sanctions_query',
          query: { ...payload, kind },
          route: clean(options.route || location.hash || 'sanciones', 120) || 'sanciones',
        }),
        signal: controller.signal,
        cache: 'no-store',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const error = new Error(body?.error || `Sanctions read failed (${res.status})`);
        error.code = body?.error || 'SANCTIONS_READ_FAILED';
        error.status = res.status;
        error.traceId = body?.trace_id || res.headers.get('x-atlas-trace-id') || null;
        throw error;
      }
      if (body?.schema !== CONTRACT || body?.kind !== kind) {
        const error = new Error('Sanctions contract mismatch');
        error.code = 'SANCTIONS_CONTRACT_MISMATCH';
        throw error;
      }
      return body;
    } catch (error) {
      if (controller.signal.aborted && error?.name !== 'AbortError') {
        const timeout = new Error('Sanctions read timed out or was cancelled');
        timeout.code = 'SANCTIONS_TIMEOUT_OR_CANCELLED';
        throw timeout;
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async function overview(options = {}) {
    const now = Date.now();
    if (!options.force && overviewCache && now - overviewCache.at < CACHE_MS) return overviewCache.value;
    const value = await query('overview', {}, options);
    overviewCache = { at: Date.now(), value };
    return value;
  }

  function events(filters = {}, options = {}) {
    return query('events', filters, options);
  }

  function clearCache() { overviewCache = null; }

  global.AtlasV2Sanctions = Object.freeze({
    installed: true,
    contract: CONTRACT,
    overview,
    events,
    query,
    clearCache,
  });
})(window);
