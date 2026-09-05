'use strict';

(function installAtlasV2Data(global) {
  const DEFAULT_URL = 'https://bzqxvidggykkdouotylg.supabase.co';
  const DEFAULT_PUBLISHABLE_KEY = 'sb_publishable_Nu21dZFBM3NwtIvOwIM8ag_9tyfDJyR';
  const ENDPOINT = '/functions/v1/atlas-v2-read';
  const DEFAULT_TIMEOUT_MS = 8000;
  const cache = new Map();

  class AtlasV2ReadError extends Error {
    constructor(message, detail = {}) {
      super(message);
      this.name = 'AtlasV2ReadError';
      this.code = detail.code || 'ATLAS_V2_READ_FAILED';
      this.status = detail.status || 0;
      this.traceId = detail.traceId || null;
      this.cause = detail.cause;
    }
  }

  function clean(value, max = 120) {
    const s = String(value ?? '').trim();
    return s && s.length <= max ? s : '';
  }

  function cacheKey(model, scope) {
    return `${model}::${scope}`;
  }

  function makeController(timeoutMs, externalSignal) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new DOMException('ATLAS_V2_TIMEOUT', 'TimeoutError')), timeoutMs);
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort(externalSignal.reason);
      else externalSignal.addEventListener('abort', () => controller.abort(externalSignal.reason), { once: true });
    }
    return { controller, clear: () => clearTimeout(timeout) };
  }

  function create(config = {}) {
    const supabaseUrl = String(config.supabaseUrl || DEFAULT_URL).replace(/\/$/, '');
    const publishableKey = String(config.publishableKey || DEFAULT_PUBLISHABLE_KEY);
    const getAccessToken = config.getAccessToken;

    if (typeof getAccessToken !== 'function') {
      throw new TypeError('AtlasV2Data.create requires getAccessToken()');
    }

    async function readModel(modelName, options = {}) {
      const model = clean(modelName);
      const scope = clean(options.scope || 'global');
      const route = clean(options.route || location.hash || location.pathname || 'unknown');
      const timeoutMs = Math.max(500, Math.min(Number(options.timeoutMs || DEFAULT_TIMEOUT_MS), 30000));
      if (!model || !scope) throw new AtlasV2ReadError('Invalid ATLAS v2 model request', { code: 'INVALID_MODEL' });

      const token = await getAccessToken();
      if (!token) throw new AtlasV2ReadError('Authenticated session is unavailable', { code: 'NO_SESSION' });

      const key = cacheKey(model, scope);
      const prior = cache.get(key);
      const { controller, clear } = makeController(timeoutMs, options.signal);
      const started = performance.now();

      try {
        const headers = {
          'authorization': `Bearer ${token}`,
          'apikey': publishableKey,
          'content-type': 'application/json',
          'x-client-info': 'atlas-v2-data/1.0',
        };
        if (prior?.etag && !options.force) headers['if-none-match'] = prior.etag;

        const res = await fetch(`${supabaseUrl}${ENDPOINT}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ model, scope, route }),
          signal: controller.signal,
          cache: 'no-store',
        });

        const traceId = res.headers.get('x-atlas-trace-id');
        const serverTiming = res.headers.get('server-timing');
        const snapshot = res.headers.get('x-atlas-snapshot');

        if (res.status === 304 && prior) {
          return {
            ...prior.value,
            meta: {
              ...prior.value.meta,
              cacheStatus: 'validated',
              clientMs: Math.round(performance.now() - started),
              serverTiming,
              traceId: traceId || prior.value.meta?.traceId || null,
            },
          };
        }

        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new AtlasV2ReadError(body?.error || `ATLAS v2 read failed (${res.status})`, {
            code: body?.error || 'HTTP_ERROR',
            status: res.status,
            traceId: body?.trace_id || traceId,
          });
        }

        if (body?.schema !== 'ATLAS_READ_API_V2' || body?.model !== model || body?.scope !== scope) {
          throw new AtlasV2ReadError('ATLAS v2 contract mismatch', {
            code: 'CONTRACT_MISMATCH',
            status: res.status,
            traceId: body?.trace_id || traceId,
          });
        }

        const value = {
          contract: body.schema,
          model: body.model,
          scope: body.scope,
          snapshotId: body.snapshot_id,
          modelVersion: body.model_version,
          generatedAt: body.generated_at,
          refreshedAt: body.refreshed_at,
          sourceVersions: body.source_versions || {},
          checksum: body.payload_checksum || null,
          data: body.data,
          meta: {
            traceId: body.trace_id || traceId || null,
            serverTiming,
            clientMs: Math.round(performance.now() - started),
            snapshot: snapshot || body.snapshot_id || null,
            cacheStatus: 'network',
          },
        };

        cache.set(key, { etag: res.headers.get('etag'), value });
        return value;
      } catch (error) {
        if (error instanceof AtlasV2ReadError) throw error;
        if (controller.signal.aborted) {
          throw new AtlasV2ReadError('ATLAS v2 read timed out or was cancelled', {
            code: 'TIMEOUT_OR_CANCELLED',
            cause: error,
          });
        }
        throw new AtlasV2ReadError(error?.message || 'ATLAS v2 network failure', {
          code: 'NETWORK_ERROR',
          cause: error,
        });
      } finally {
        clear();
      }
    }

    function invalidate(modelName, scope = 'global') {
      cache.delete(cacheKey(clean(modelName), clean(scope)));
    }

    function clearCache() {
      cache.clear();
    }

    return Object.freeze({ readModel, invalidate, clearCache });
  }

  global.AtlasV2Data = Object.freeze({ create, AtlasV2ReadError });
})(window);
