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

    async function request(body, options = {}) {
      const route = clean(options.route || location.hash || location.pathname || 'unknown');
      const timeoutMs = Math.max(500, Math.min(Number(options.timeoutMs || DEFAULT_TIMEOUT_MS), 30000));
      const token = await getAccessToken();
      if (!token) throw new AtlasV2ReadError('Authenticated session is unavailable', { code: 'NO_SESSION' });

      const { controller, clear } = makeController(timeoutMs, options.signal);
      const started = performance.now();
      try {
        const headers = {
          authorization: `Bearer ${token}`,
          apikey: publishableKey,
          'content-type': 'application/json',
          'x-client-info': 'atlas-v2-data/2.2',
        };
        if (options.etag) headers['if-none-match'] = options.etag;

        const res = await fetch(`${supabaseUrl}${ENDPOINT}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ ...body, route }),
          signal: controller.signal,
          cache: 'no-store',
        });

        const traceId = res.headers.get('x-atlas-trace-id');
        const serverTiming = res.headers.get('server-timing');
        const snapshot = res.headers.get('x-atlas-snapshot');
        const meta = {
          traceId,
          serverTiming,
          snapshot,
          clientMs: Math.round(performance.now() - started),
          etag: res.headers.get('etag'),
        };

        if (res.status === 304) return { status: 304, body: null, meta };

        const responseBody = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new AtlasV2ReadError(responseBody?.error || `ATLAS v2 read failed (${res.status})`, {
            code: responseBody?.error || 'HTTP_ERROR',
            status: res.status,
            traceId: responseBody?.trace_id || traceId,
          });
        }
        return { status: res.status, body: responseBody, meta: { ...meta, traceId: responseBody?.trace_id || traceId } };
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

    async function readModel(modelName, options = {}) {
      const model = clean(modelName);
      const scope = clean(options.scope || 'global');
      if (!model || !scope) throw new AtlasV2ReadError('Invalid ATLAS v2 model request', { code: 'INVALID_MODEL' });

      const key = cacheKey(model, scope);
      const prior = cache.get(key);
      const out = await request(
        { operation: 'read_model', model, scope },
        { ...options, etag: prior?.etag && !options.force ? prior.etag : null },
      );

      if (out.status === 304 && prior) {
        return {
          ...prior.value,
          meta: {
            ...prior.value.meta,
            ...out.meta,
            traceId: out.meta.traceId || prior.value.meta?.traceId || null,
            cacheStatus: 'validated',
          },
        };
      }

      const body = out.body;
      if (body?.schema !== 'ATLAS_READ_API_V2' || body?.model !== model || body?.scope !== scope) {
        throw new AtlasV2ReadError('ATLAS v2 contract mismatch', {
          code: 'CONTRACT_MISMATCH',
          status: out.status,
          traceId: body?.trace_id || out.meta.traceId,
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
          ...out.meta,
          snapshot: out.meta.snapshot || body.snapshot_id || null,
          cacheStatus: 'network',
        },
      };

      cache.set(key, { etag: out.meta.etag, value });
      return value;
    }

    async function publicSpendQuery(query = {}, options = {}) {
      if (!query || typeof query !== 'object') {
        throw new AtlasV2ReadError('Invalid public-spend query', { code: 'INVALID_QUERY' });
      }
      const kind = clean(query.kind, 80);
      if (!kind) throw new AtlasV2ReadError('Public-spend query requires kind', { code: 'INVALID_QUERY' });

      const out = await request({ operation: 'public_spend_query', query: { ...query, kind } }, options);
      const body = out.body;
      if (body?.schema !== 'ATLAS_PUBLIC_SPEND_QUERY_V2' || body?.kind !== kind) {
        throw new AtlasV2ReadError('ATLAS public-spend contract mismatch', {
          code: 'CONTRACT_MISMATCH',
          status: out.status,
          traceId: body?.trace_id || out.meta.traceId,
        });
      }

      return {
        contract: body.schema,
        domain: body.domain || (String(query.domain || '') || 'procurement'),
        snapshotId: body.snapshot_id,
        kind: body.kind,
        items: Array.isArray(body.items) ? body.items : [],
        detail: body.detail ?? null,
        page: body.page ?? null,
        data: body,
        meta: {
          ...out.meta,
          snapshot: out.meta.snapshot || body.snapshot_id || null,
          cacheStatus: 'no-store',
        },
      };
    }

    const publicSpend = Object.freeze({
      monitor: options => readModel('public_spend_monitor', options),
      overview: options => readModel('public_spend_overview', options),
      buyers: (options = {}) => publicSpendQuery({ kind: 'buyers', ...options.query }, options),
      suppliers: (options = {}) => publicSpendQuery({ kind: 'suppliers', ...options.query }, options),
      pairs: (options = {}) => publicSpendQuery({ kind: 'pairs', ...options.query }, options),
      findings: (options = {}) => publicSpendQuery({ kind: 'findings', ...options.query }, options),
      buyerDetail: (buyerId, options = {}) => publicSpendQuery({ kind: 'buyer_detail', buyer_id: clean(buyerId, 180) }, options),
      supplierDetail: (supplierId, options = {}) => publicSpendQuery({ kind: 'supplier_detail', supplier_id: clean(supplierId, 180) }, options),
      pairDetail: (pairId, options = {}) => publicSpendQuery({ kind: 'pair_detail', pair_id: clean(pairId, 260) }, options),
      budgetContext: (filters = {}, options = {}) => publicSpendQuery({
        domain: 'budget_execution',
        kind: 'budget_context',
        region: clean(filters.region, 40) || undefined,
        category: clean(filters.category, 180) || undefined,
        month: clean(filters.month, 20) || undefined,
        service_id: clean(filters.serviceId || filters.service_id, 180) || undefined,
        provider_id: clean(filters.providerId || filters.provider_id, 180) || undefined,
      }, options),
      budgetServices: (options = {}) => publicSpendQuery({ domain: 'budget_execution', kind: 'budget_services', ...options.query }, options),
      budgetProviders: (options = {}) => publicSpendQuery({ domain: 'budget_execution', kind: 'budget_providers', ...options.query }, options),
      budgetFlows: (options = {}) => publicSpendQuery({ domain: 'budget_execution', kind: 'budget_flows', ...options.query }, options),
      budgetServiceDetail: (serviceId, options = {}) => publicSpendQuery({ domain: 'budget_execution', kind: 'budget_service_detail', service_id: clean(serviceId, 180) }, options),
      budgetProviderDetail: (providerId, options = {}) => publicSpendQuery({ domain: 'budget_execution', kind: 'budget_provider_detail', provider_id: clean(providerId, 180) }, options),
    });

    function invalidate(modelName, scope = 'global') {
      cache.delete(cacheKey(clean(modelName), clean(scope)));
    }

    function clearCache() {
      cache.clear();
    }

    return Object.freeze({ readModel, publicSpendQuery, publicSpend, invalidate, clearCache });
  }

  global.AtlasV2Data = Object.freeze({ create, AtlasV2ReadError });
})(window);
