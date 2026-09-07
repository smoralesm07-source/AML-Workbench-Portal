'use strict';

(function installAtlasV2EntityExplorer(global) {
  if (global.AtlasV2EntityExplorer?.installed) return;

  const DEFAULT_URL = 'https://bzqxvidggykkdouotylg.supabase.co';
  const DEFAULT_PUBLISHABLE_KEY = 'sb_publishable_3nrUSbZMWfTYUtXnyjDklg_EjyZIzko';
  const ENDPOINT = '/functions/v1/atlas-v2-read';
  const DEFAULT_TIMEOUT_MS = 12000;

  function clean(value, max = 180) {
    const out = String(value ?? '').trim();
    return out && out.length <= max ? out : '';
  }

  function numeric(value) {
    if (value === null || value === undefined || value === '') return null;
    const out = Number(value);
    return Number.isFinite(out) ? out : null;
  }

  async function coreAccessToken() {
    return global.AtlasV2Access?.getAccessToken ? global.AtlasV2Access.getAccessToken() : null;
  }

  async function v2AccessToken(coreToken) {
    return global.AtlasV2Session?.getAccessToken
      ? global.AtlasV2Session.getAccessToken(async () => coreToken)
      : coreToken;
  }

  function normalizeItem(item = {}) {
    return {
      entityId: clean(item.entity_id, 220),
      rut: clean(item.rut, 32),
      name: clean(item.name, 280),
      entityType: clean(item.entity_type, 100),
      region: clean(item.region, 120),
      commune: clean(item.commune, 120),
      sourceCount: Number(item.source_count || 0) || 0,
      isUafObserved: item.is_uaf_observed === true,
      isSanctioned: item.is_sanctioned === true,
      updatedAt: clean(item.updated_at, 80),
      identityConfidence: numeric(item.identity_confidence),
      sources: Array.isArray(item.sources) ? item.sources.map(value => clean(value, 80)).filter(Boolean) : [],
      roles: Array.isArray(item.roles) ? item.roles.map(value => clean(value, 120)).filter(Boolean) : [],
      eventCount: Number(item.event_count || 0) || 0,
      ipa3Score: numeric(item.ipa3_score),
      priorityBand: clean(item.priority_band_shadow, 40).toUpperCase(),
      registryGroupScore: numeric(item.registry_group_score),
      economicGroupScore: numeric(item.economic_group_score),
      sanctionsGroupScore: numeric(item.sanctions_group_score),
      dominantMarkId: clean(item.dominant_mark_id, 80),
      scoreConfidencePct: numeric(item.score_confidence_pct),
      coverageIndexPct: numeric(item.coverage_index_pct),
      resultTier: clean(item.result_tier, 60).toUpperCase(),
      matchSource: clean(item.match_source, 60).toUpperCase(),
      matchType: clean(item.match_type, 60),
      raw: item,
    };
  }

  async function request(kind, payload = {}, options = {}) {
    const coreToken = await coreAccessToken();
    if (!coreToken) throw Object.assign(new Error('ATLAS core session is unavailable'), { code: 'CORE_SESSION_UNAVAILABLE' });
    const token = await v2AccessToken(coreToken);
    if (!token) throw Object.assign(new Error('ATLAS v2 session is unavailable'), { code: 'V2_SESSION_UNAVAILABLE' });

    const config = global.__ATLAS_V2_CONFIG__ || {};
    const supabaseUrl = String(config.supabaseUrl || DEFAULT_URL).replace(/\/$/, '');
    const publishableKey = String(config.publishableKey || DEFAULT_PUBLISHABLE_KEY);
    const controller = new AbortController();
    const timeoutMs = Math.max(1000, Math.min(Number(options.timeoutMs || DEFAULT_TIMEOUT_MS), 25000));
    const timer = setTimeout(() => controller.abort(new DOMException('ATLAS_V2_TIMEOUT', 'TimeoutError')), timeoutMs);
    if (options.signal) {
      if (options.signal.aborted) controller.abort(options.signal.reason);
      else options.signal.addEventListener('abort', () => controller.abort(options.signal.reason), { once: true });
    }

    try {
      const response = await fetch(`${supabaseUrl}${ENDPOINT}`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          apikey: publishableKey,
          'content-type': 'application/json',
          'x-client-info': 'atlas-v2-entity-explorer/1.0',
          'x-atlas-core-authorization': `Bearer ${coreToken}`,
        },
        body: JSON.stringify({
          operation: 'entity_search',
          query: { kind, ...payload },
          route: clean(options.route || location.hash || `entidad:${kind}`, 120) || `entidad:${kind}`,
        }),
        signal: controller.signal,
        cache: 'no-store',
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(body?.error || `ATLAS entity explorer failed (${response.status})`);
        error.code = body?.error || 'ENTITY_EXPLORER_FAILED';
        error.status = response.status;
        error.traceId = body?.trace_id || response.headers.get('x-atlas-trace-id') || null;
        throw error;
      }
      if (body?.schema !== 'ATLAS_ENTITY_SEARCH_V2' || body?.kind !== kind) {
        throw Object.assign(new Error('ATLAS entity explorer contract mismatch'), { code: 'CONTRACT_MISMATCH' });
      }
      return {
        contract: body.schema,
        kind: body.kind,
        generatedAt: body.generated_at || null,
        items: (Array.isArray(body.items) ? body.items : []).map(normalizeItem),
        facets: body.facets || {},
        page: body.page || {},
        semantics: body.semantics || {},
        meta: {
          traceId: body.trace_id || response.headers.get('x-atlas-trace-id') || null,
          snapshot: response.headers.get('x-atlas-snapshot') || body.generated_at || null,
          serverTiming: response.headers.get('server-timing'),
        },
      };
    } finally {
      clearTimeout(timer);
    }
  }

  function meta(options = {}) {
    return request('explorer_meta', {}, options);
  }

  function explore(filters = {}, options = {}) {
    return request('explorer', {
      region: clean(filters.region, 120),
      entity_type: clean(filters.entityType || filters.entity_type, 100),
      uaf: filters.uaf === true,
      sanctioned: filters.sanctioned === true,
      min_sources: Math.max(0, Math.min(Number(filters.minSources || filters.min_sources || 0), 5)),
      sort: ['coverage', 'name', 'updated', 'priority'].includes(filters.sort) ? filters.sort : 'coverage',
      limit: Math.max(1, Math.min(Number(filters.limit || 25), 50)),
      offset: Math.max(0, Number(filters.offset || 0)),
    }, options);
  }

  function suggest(search, options = {}) {
    const q = clean(search, 180);
    if (q.length < 2) return Promise.resolve({ contract: 'ATLAS_ENTITY_SEARCH_V2', kind: 'suggest', generatedAt: null, items: [], page: { returned: 0 }, semantics: { query_status: 'INVALID_OR_TOO_SHORT' }, facets: {}, meta: {} });
    return request('suggest', { search: q, limit: 7, offset: 0 }, options);
  }

  global.AtlasV2EntityExplorer = Object.freeze({
    installed: true,
    contract: 'ATLAS_ENTITY_SEARCH_V2',
    mode: 'ENTITY_EXPLORER_CLASSIC_V2',
    meta,
    explore,
    suggest,
  });
})(window);
