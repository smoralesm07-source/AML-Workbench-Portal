'use strict';

(function installEntity360ResilienceHotfix(global) {
  const HOTFIX = 'ENTITY360_RESILIENCE_CORE_FALLBACK_20260909_1';
  if (global.__ATLAS_V2_ENTITY360_RESILIENCE__?.installed) return;

  let currentApi = global.AtlasV2Entity360 || null;

  function nonEmpty(value) {
    if (value === null || value === undefined) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return String(value).trim() !== '';
  }

  function safeCode(errorLike) {
    return String(errorLike?.code || 'ENTITY_INTELLIGENCE_UNAVAILABLE').slice(0, 96);
  }

  function safeMessage(errorLike) {
    return String(errorLike?.message || 'La inteligencia avanzada no respondió en esta ejecución.').slice(0, 240);
  }

  function baseFallback(core, failure, input) {
    const base = core?.data && typeof core.data === 'object' ? core.data : {};
    const identity = core?.identity || base.identity || {};
    const entityId = String(identity.entityId || base.entity_id || input?.entityId || input?.entity_id || '').trim();
    const rut = String(identity.rut || base.resolved_rut || base.rut || input?.rut || '').trim();
    const uaf = base.uaf ?? null;
    const sanctions = base.sanctions ?? null;
    const spend = base.spend ?? null;
    const generatedAt = new Date().toISOString();

    return {
      status: 'ready',
      contract: 'ATLAS_ENTITY_INTELLIGENCE_V2',
      traceId: failure?.traceId || core?.traceId || null,
      snapshotId: core?.snapshotId || base.generated_at || generatedAt,
      data: {
        contract: 'ATLAS_ENTITY_INTELLIGENCE_V2',
        entity_id: entityId || null,
        resolved_rut: rut || null,
        generated_at: generatedAt,
        base,
        dossier: {
          mode: 'ENTITY360_CLIENT_BASE_FALLBACK_V2',
          entity_id: entityId || null,
          resolved_rut: rut || null,
          uaf_profile: uaf,
          sanction_summary: sanctions,
          sanction_resolution: [],
          public_spend: spend,
          read_status: {
            uaf: nonEmpty(uaf) ? 'AVAILABLE' : 'EMPTY',
            sanctions: nonEmpty(sanctions) ? 'AVAILABLE' : 'EMPTY',
            spend: nonEmpty(spend) ? 'AVAILABLE' : 'EMPTY',
          },
        },
        intelligence_status: 'CLIENT_BASE_FALLBACK',
        intelligence_error: {
          code: safeCode(failure),
          message: safeMessage(failure),
        },
        semantics: {
          partial_intelligence_does_not_block_entity360: true,
          missing_is_not_zero_or_absence: true,
          press_context_not_identity: true,
          screening_candidate_requires_review: true,
        },
      },
    };
  }

  function wrap(api) {
    if (!api || !api.installed || api.resilienceHotfix === HOTFIX) return api;
    if (typeof api.readIntelligence !== 'function' || typeof api.readCore !== 'function') return api;

    const originalReadIntelligence = api.readIntelligence.bind(api);
    const readCore = api.readCore.bind(api);

    async function readIntelligenceResilient(input, options = {}) {
      let intelligence;
      try {
        intelligence = await originalReadIntelligence(input, options);
      } catch (error) {
        intelligence = {
          status: 'error',
          code: safeCode(error),
          message: safeMessage(error),
          traceId: error?.traceId || null,
        };
      }

      if (intelligence?.status === 'ready') return intelligence;

      let core;
      try {
        core = await readCore(input, { ...options, timeoutMs: Math.max(12000, Number(options.timeoutMs || 0)) });
      } catch (error) {
        core = { status: 'error', code: safeCode(error), message: safeMessage(error) };
      }

      if (core?.status !== 'ready') return intelligence;
      return baseFallback(core, intelligence, input);
    }

    return Object.freeze({
      ...api,
      readIntelligence: readIntelligenceResilient,
      resilienceHotfix: HOTFIX,
    });
  }

  const descriptor = Object.getOwnPropertyDescriptor(global, 'AtlasV2Entity360');
  if (!descriptor || descriptor.configurable !== false) {
    currentApi = wrap(currentApi);
    Object.defineProperty(global, 'AtlasV2Entity360', {
      configurable: true,
      enumerable: true,
      get() { return currentApi; },
      set(next) { currentApi = wrap(next); },
    });
  } else {
    try { global.AtlasV2Entity360 = wrap(global.AtlasV2Entity360); } catch (_) { /* best effort */ }
  }

  global.__ATLAS_V2_ENTITY360_RESILIENCE__ = Object.freeze({
    installed: true,
    version: HOTFIX,
    policy: 'CORE_READ_IS_SUFFICIENT_TO_OPEN_EXPEDIENTE',
  });
})(window);
