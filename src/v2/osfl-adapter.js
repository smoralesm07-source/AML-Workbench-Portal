'use strict';

(function installAtlasV2OsflAdapter(global) {
  if (global.AtlasV2Osfl) return;

  const PROJECT_URL = 'https://bzqxvidggykkdouotylg.supabase.co';
  const PUBLISHABLE_KEY = 'sb_publishable_3nrUSbZMWfTYUtXnyjDklg_EjyZIzko';
  const ENDPOINT = `${PROJECT_URL}/functions/v1/atlas-v2-read`;
  const CONTRACT = 'ATLAS_OSFL_QUERY_V2';
  const CACHE_MS = 30_000;
  let overviewCache = null;

  async function token(provider, label) {
    const value = await provider?.getAccessToken?.();
    if (!value) throw Object.assign(new Error(`${label}_AUTH_REQUIRED`), { code: `${label}_AUTH_REQUIRED` });
    return value;
  }

  async function query(kind, payload = {}, options = {}) {
    const coreToken = await token(global.AtlasV2Access, 'CORE');
    const v2Token = await token(global.AtlasV2Session, 'V2');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Number(options.timeoutMs || 12_000));
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${v2Token}`,
          apikey: PUBLISHABLE_KEY,
          'content-type': 'application/json',
          'x-client-info': 'atlas-v2/osfl-adapter',
          'x-atlas-core-authorization': `Bearer ${coreToken}`,
        },
        body: JSON.stringify({ operation: 'osfl_query', query: { ...payload, kind }, route: options.route || 'osfl' }),
        signal: controller.signal,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const error = new Error(body?.error || `OSFL_HTTP_${res.status}`);
        error.status = res.status;
        error.traceId = body?.trace_id || res.headers.get('x-atlas-trace-id') || '';
        throw error;
      }
      if (body?.schema !== CONTRACT || body?.kind !== kind) throw new Error('OSFL_CONTRACT_MISMATCH');
      return body;
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('OSFL_TIMEOUT');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function overview(options = {}) {
    if (!options.force && overviewCache && Date.now() - overviewCache.at < CACHE_MS) return overviewCache.value;
    const value = await query('overview', {}, options);
    overviewCache = { at: Date.now(), value };
    return value;
  }

  function entities(filters = {}, options = {}) {
    return query('entities', filters, options);
  }

  global.AtlasV2Osfl = Object.freeze({ contract: CONTRACT, overview, entities, query });
})(window);
