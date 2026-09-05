'use strict';

(function installPublicSpendV2Shadow(global) {
  let client = null;
  let inflight = null;

  function publish(status, extra = {}) {
    global.__ATLAS_V2_PUBLIC_SPEND_SHADOW__ = {
      status,
      mode: 'shadow',
      contract: 'ATLAS_PUBLIC_SPEND_OVERVIEW_V2',
      checkedAt: new Date().toISOString(),
      ...extra,
    };
  }

  async function getAccessToken() {
    if (typeof sb === 'undefined' || !sb?.auth?.getSession) return null;
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;
    return data?.session?.access_token || null;
  }

  function getClient() {
    if (client) return client;
    if (!global.AtlasV2Data?.create) return null;
    client = global.AtlasV2Data.create({ getAccessToken });
    return client;
  }

  function legacySnapshot() {
    const state = global.AtlasPublicSpendV2?.state;
    const idx = state?.idx;
    return {
      runtime: global.__ATLAS_PUBLIC_SPEND_V2__?.version || null,
      schema: state?.data?.schema || null,
      services: idx?.services?.length ?? null,
      providers: idx?.providers?.length ?? null,
      relations: idx?.flows?.length ?? null,
      source: 'legacy-presupuesto-spend-view-v2',
    };
  }

  async function probe({ force = false } = {}) {
    if (inflight && !force) return inflight;
    const v2 = getClient();
    if (!v2) {
      publish('unavailable', { reason: 'ATLAS_V2_DATA_CLIENT_NOT_INSTALLED' });
      return null;
    }

    publish('loading', { legacy: legacySnapshot() });
    inflight = (async () => {
      try {
        const model = await v2.readModel('public_spend_overview', {
          route: 'public-spend:shadow',
          force,
          timeoutMs: 8000,
        });
        const summary = model?.data?.summary || {};
        const diagnostic = {
          status: 'ready',
          model: model.model,
          snapshotId: model.snapshotId,
          modelVersion: model.modelVersion,
          checksum: model.checksum,
          traceId: model.meta?.traceId || null,
          clientMs: model.meta?.clientMs ?? null,
          serverTiming: model.meta?.serverTiming || null,
          sourceVersions: model.sourceVersions,
          summary: {
            periodStart: summary.period_start || null,
            periodEnd: summary.period_end || null,
            buyers: summary.buyer_count ?? null,
            suppliers: summary.supplier_count ?? null,
            pairs: summary.pair_count ?? null,
            findings: summary.finding_count ?? null,
            signals: summary.signal_count ?? null,
          },
          legacy: legacySnapshot(),
          semanticParity: 'NOT_ASSERTED',
          semanticParityReason: 'The current GP2 browser snapshot and the v2 analytical snapshot have different producer contracts; parity must be established metric-by-metric before cutover.',
        };
        publish('ready', diagnostic);
        global.dispatchEvent(new CustomEvent('atlas:v2-public-spend-shadow-ready', { detail: diagnostic }));
        return diagnostic;
      } catch (error) {
        const detail = {
          reason: error?.code || 'SHADOW_READ_FAILED',
          message: String(error?.message || error),
          traceId: error?.traceId || null,
          legacy: legacySnapshot(),
        };
        publish('error', detail);
        console.warn('[ATLAS v2 shadow] public-spend probe failed', detail);
        return null;
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  }

  global.addEventListener('atlas:public-spend-v2-ready', () => { probe().catch(() => undefined); });
  global.AtlasV2PublicSpendShadow = Object.freeze({ probe, health: () => global.__ATLAS_V2_PUBLIC_SPEND_SHADOW__ || null });
  publish('installed');
})(window);
