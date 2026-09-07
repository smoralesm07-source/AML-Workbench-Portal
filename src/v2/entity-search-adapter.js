'use strict';

(function installAtlasV2EntitySearch(global) {
  if (global.AtlasV2EntitySearch?.installed) return;

  const DEFAULT_URL = 'https://bzqxvidggykkdouotylg.supabase.co';
  const DEFAULT_PUBLISHABLE_KEY = 'sb_publishable_3nrUSbZMWfTYUtXnyjDklg_EjyZIzko';
  const ENDPOINT = '/functions/v1/atlas-v2-read';
  const DEFAULT_TIMEOUT_MS = 10000;

  function clean(value, max = 180) {
    const out = String(value ?? '').trim();
    return out && out.length <= max ? out : '';
  }

  async function coreAccessToken() {
    return global.AtlasV2Access?.getAccessToken ? global.AtlasV2Access.getAccessToken() : null;
  }

  async function v2AccessToken(coreToken) {
    return global.AtlasV2Session?.getAccessToken
      ? global.AtlasV2Session.getAccessToken(async () => coreToken)
      : coreToken;
  }

  function normalize(item = {}) {
    return {
      entityId: clean(item.entity_id, 220),
      rut: clean(item.rut, 32),
      name: clean(item.name, 280),
      entityType: clean(item.entity_type, 100),
      region: clean(item.region, 120),
      commune: clean(item.commune, 120),
      sourceCount: Number(item.source_count || 0) || 0,
      identityConfidence: Number(item.identity_confidence ?? 0) || 0,
      matchedLabel: clean(item.matched_label, 280),
      matchSource: clean(item.match_source, 40).toUpperCase(),
      matchType: clean(item.match_type, 60),
      matchScore: Number(item.match_score || 0) || 0,
      registryClass: clean(item.registry_class, 100),
      resultTier: clean(item.result_tier, 60).toUpperCase() || 'IDENTITY',
      tierPriority: Number(item.tier_priority || 9) || 9,
      digitalIdentity: item.digital_identity && typeof item.digital_identity === 'object' ? item.digital_identity : null,
      sources: Array.isArray(item.sources) ? item.sources.map(value => clean(value, 80)).filter(Boolean) : [],
      roles: Array.isArray(item.roles) ? item.roles.map(value => clean(value, 100)).filter(Boolean) : [],
      eventCount: Number(item.event_count || 0) || 0,
      raw: item,
    };
  }

  function sortItems(items) {
    return items.sort((a, b) => {
      const tier = Number(a.tierPriority || 9) - Number(b.tierPriority || 9);
      if (tier) return tier;
      const score = Number(b.matchScore || 0) - Number(a.matchScore || 0);
      if (score) return score;
      return String(a.name || a.matchedLabel || '').localeCompare(String(b.name || b.matchedLabel || ''), 'es');
    });
  }

  async function search(searchInput, options = {}) {
    const search = clean(searchInput, 180);
    if (search.length < 2) return { contract: 'ATLAS_ENTITY_SEARCH_V2', kind: 'results', items: [], page: { returned: 0 }, semantics: { query_status: 'INVALID_OR_TOO_SHORT' }, screeningSources: [] };
    const coreToken = await coreAccessToken();
    if (!coreToken) throw Object.assign(new Error('ATLAS core session is unavailable'), { code: 'CORE_SESSION_UNAVAILABLE' });
    const token = await v2AccessToken(coreToken);
    if (!token) throw Object.assign(new Error('ATLAS v2 session is unavailable'), { code: 'V2_SESSION_UNAVAILABLE' });

    const config = global.__ATLAS_V2_CONFIG__ || {};
    const supabaseUrl = String(config.supabaseUrl || DEFAULT_URL).replace(/\/$/, '');
    const publishableKey = String(config.publishableKey || DEFAULT_PUBLISHABLE_KEY);
    const controller = new AbortController();
    const timeoutMs = Math.max(1000, Math.min(Number(options.timeoutMs || DEFAULT_TIMEOUT_MS), 20000));
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
          'x-client-info': 'atlas-v2-entity-search/1.1',
          'x-atlas-core-authorization': `Bearer ${coreToken}`,
        },
        body: JSON.stringify({
          operation: 'entity_search',
          query: {
            kind: 'results',
            search,
            limit: Math.max(1, Math.min(Number(options.limit || 20), 50)),
            offset: Math.max(0, Number(options.offset || 0)),
          },
          route: clean(options.route || location.hash || 'entidad:search', 120) || 'entidad:search',
        }),
        signal: controller.signal,
        cache: 'no-store',
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(body?.error || `ATLAS entity search failed (${response.status})`);
        error.code = body?.error || 'ENTITY_SEARCH_FAILED';
        error.status = response.status;
        error.traceId = body?.trace_id || response.headers.get('x-atlas-trace-id') || null;
        throw error;
      }
      if (body?.schema !== 'ATLAS_ENTITY_SEARCH_V2' || body?.kind !== 'results') {
        throw Object.assign(new Error('ATLAS entity search contract mismatch'), { code: 'CONTRACT_MISMATCH' });
      }
      const semantics = body.semantics || {};
      return {
        contract: body.schema,
        kind: body.kind,
        generatedAt: body.generated_at || null,
        items: sortItems((Array.isArray(body.items) ? body.items : []).map(normalize)),
        page: body.page || null,
        semantics,
        screeningSources: Array.isArray(semantics.screening_sources) ? semantics.screening_sources : [],
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

  global.AtlasV2EntitySearch = Object.freeze({ installed: true, search });
})(window);