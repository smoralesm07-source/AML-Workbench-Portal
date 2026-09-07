'use strict';

(function installAtlasV2UniversesAdapter(global) {
  if (global.AtlasV2Universes?.installed) return;

  const DEFAULT_URL = 'https://bzqxvidggykkdouotylg.supabase.co';
  const DEFAULT_PUBLISHABLE_KEY = 'sb_publishable_3nrUSbZMWfTYUtXnyjDklg_EjyZIzko';
  const ENDPOINT = '/functions/v1/atlas-v2-read';
  const DEFAULT_TIMEOUT_MS = 12000;

  function clean(value, max = 180) {
    const out = String(value ?? '').trim();
    return out && out.length <= max ? out : '';
  }

  function canonicalRut(value) {
    const compact = String(value ?? '').toUpperCase().replace(/[^0-9K]/g, '');
    if (compact.length < 2) return '';
    return `${compact.slice(0, -1)}-${compact.slice(-1)}`;
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
    if (!coreToken) throw new Error('ATLAS core session is unavailable');
    const token = await v2AccessToken(coreToken);
    if (!token) throw new Error('ATLAS v2 session is unavailable');

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
          'x-client-info': 'atlas-v2-universes/1.0',
          'x-atlas-core-authorization': `Bearer ${coreToken}`,
        },
        body: JSON.stringify({
          operation: 'universes_query',
          query: { ...payload, kind },
          route: clean(options.route || location.hash || 'universos', 120) || 'universos',
        }),
        signal: controller.signal,
        cache: 'no-store',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const error = new Error(body?.error || `ATLAS Universes read failed (${res.status})`);
        error.code = body?.error || 'UNIVERSES_READ_FAILED';
        error.status = res.status;
        error.traceId = body?.trace_id || res.headers.get('x-atlas-trace-id') || null;
        throw error;
      }
      if (body?.schema !== 'ATLAS_UNIVERSES_QUERY_V2' || body?.kind !== kind) {
        const error = new Error('ATLAS Universes contract mismatch');
        error.code = 'CONTRACT_MISMATCH';
        throw error;
      }
      return {
        contract: body.schema,
        kind: body.kind,
        lens: body.lens || null,
        dimension: body.dimension || null,
        generatedAt: body.generated_at || null,
        items: Array.isArray(body.items) ? body.items : [],
        membership: body.membership || null,
        rut: body.rut || null,
        page: body.page || null,
        semantics: body.semantics || {},
        data: body,
        meta: {
          traceId: body.trace_id || res.headers.get('x-atlas-trace-id') || null,
          serverTiming: res.headers.get('server-timing'),
          snapshot: res.headers.get('x-atlas-snapshot') || body.generated_at || null,
        },
      };
    } catch (error) {
      if (controller.signal.aborted && error?.name !== 'AbortError') {
        const timeout = new Error('ATLAS Universes read timed out or was cancelled');
        timeout.code = 'TIMEOUT_OR_CANCELLED';
        throw timeout;
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  const api = Object.freeze({
    overview: (options = {}) => query('overview', {}, options),
    distribution: (lens, dimension, options = {}) => query('distribution', {
      lens: clean(lens, 40).toUpperCase(),
      dimension: clean(dimension, 80).toLowerCase(),
      limit: Math.max(1, Math.min(Number(options.limit || 30), 100)),
      offset: Math.max(0, Number(options.offset || 0)),
    }, options),
    entities: (lens, search = '', options = {}) => query('entities', {
      lens: clean(lens, 40).toUpperCase(),
      search: clean(search, 180),
      limit: Math.max(1, Math.min(Number(options.limit || 40), 100)),
      offset: Math.max(0, Number(options.offset || 0)),
    }, options),
    membership: (rut, options = {}) => query('membership', { rut: canonicalRut(rut) }, options),
  });

  global.AtlasV2Universes = Object.freeze({ installed: true, canonicalRut, ...api });
})(window);
