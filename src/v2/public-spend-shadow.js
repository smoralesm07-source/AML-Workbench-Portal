'use strict';

(function installPublicSpendV2Shadow(global) {
  let client = null;
  let inflight = null;

  function publish(status, extra = {}) {
    global.__ATLAS_V2_PUBLIC_SPEND_SHADOW__ = {
      status,
      mode: 'shadow',
      contract: 'ATLAS_PUBLIC_SPEND_MONITOR_V2',
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

  function finite(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function normalizeMonth(value) {
    return String(value || '').slice(0, 7) || null;
  }

  function legacySnapshot() {
    const state = global.AtlasPublicSpendV2?.state;
    const idx = state?.idx;
    const data = state?.data || {};
    const overview = data?.overview || {};
    const windowData = data?.window || {};
    return {
      runtime: global.__ATLAS_PUBLIC_SPEND_V2__?.version || null,
      schema: data?.schema || null,
      source: 'legacy-presupuesto-spend-view-v2',
      services: idx?.services?.length ?? null,
      providers: idx?.providers?.length ?? null,
      relations: idx?.flows?.length ?? null,
      overview: {
        amountL12Clp: finite(overview.amount_l12_clp),
        providerAmountL12Clp: finite(overview.provider_amount_l12_clp),
        transactionsL12: finite(overview.transactions_l12),
        organizationsL12: finite(overview.organizations_l12),
        providersL12: finite(overview.providers_l12),
        variationL12: finite(overview.variation_l12),
        providerHhi: finite(overview.provider_hhi),
        top10ProviderShare: finite(overview.top10_provider_share),
      },
      window: {
        startMonth: normalizeMonth(windowData.start_month || windowData.months?.[0]),
        endMonth: normalizeMonth(windowData.end_month || windowData.months?.[windowData.months?.length - 1]),
        monthCount: Array.isArray(windowData.months) ? windowData.months.length : null,
      },
      topServices: Array.isArray(data?.services) ? data.services.length : null,
      topProviders: Array.isArray(data?.providers) ? data.providers.length : null,
    };
  }

  function closeEnough(a, b, relativeTolerance = 1e-9, absoluteTolerance = 0) {
    if (a == null || b == null) return null;
    const diff = Math.abs(a - b);
    const scale = Math.max(Math.abs(a), Math.abs(b), 1);
    return diff <= Math.max(absoluteTolerance, scale * relativeTolerance);
  }

  function metric(name, legacy, v2, options = {}) {
    const equal = options.kind === 'month'
      ? (legacy && v2 ? normalizeMonth(legacy) === normalizeMonth(v2) : null)
      : closeEnough(finite(legacy), finite(v2), options.relativeTolerance ?? 1e-9, options.absoluteTolerance ?? 0);
    return {
      name,
      legacy: legacy ?? null,
      v2: v2 ?? null,
      status: equal == null ? 'NOT_COMPARABLE' : equal ? 'MATCH' : 'MISMATCH',
    };
  }

  function compareBudgetDomain(legacy, budget) {
    const overview = budget?.overview || {};
    const windowData = budget?.window || {};
    const metrics = [
      metric('amount_l12_clp', legacy.overview.amountL12Clp, overview.amount_l12_clp),
      metric('provider_amount_l12_clp', legacy.overview.providerAmountL12Clp, overview.provider_amount_l12_clp),
      metric('transactions_l12', legacy.overview.transactionsL12, overview.transactions_l12),
      metric('organizations_l12', legacy.overview.organizationsL12, overview.organizations_l12),
      metric('providers_l12', legacy.overview.providersL12, overview.providers_l12),
      metric('variation_l12', legacy.overview.variationL12, overview.variation_l12, { relativeTolerance: 1e-8 }),
      metric('provider_hhi', legacy.overview.providerHhi, overview.provider_hhi, { relativeTolerance: 1e-8 }),
      metric('top10_provider_share', legacy.overview.top10ProviderShare, overview.top10_provider_share, { relativeTolerance: 1e-8 }),
      metric('window_start', legacy.window.startMonth, windowData.start_month || windowData.months?.[0], { kind: 'month' }),
      metric('window_end', legacy.window.endMonth, windowData.end_month || windowData.months?.[windowData.months?.length - 1], { kind: 'month' }),
      metric('window_month_count', legacy.window.monthCount, Array.isArray(windowData.months) ? windowData.months.length : null),
    ];

    const comparable = metrics.filter(x => x.status !== 'NOT_COMPARABLE');
    const mismatches = comparable.filter(x => x.status === 'MISMATCH');
    const sourceTopServices = Array.isArray(budget?.top_services) ? budget.top_services.length : null;
    const sourceTopProviders = Array.isArray(budget?.top_providers) ? budget.top_providers.length : null;
    const detailCoverage = sourceTopServices > 0 && sourceTopProviders > 0 ? 'READY' : 'INCOMPLETE';

    let status = 'NOT_ASSERTED';
    if (comparable.length && mismatches.length === 0) status = detailCoverage === 'READY' ? 'MATCH' : 'PARTIAL';
    else if (mismatches.length) status = 'MISMATCH';

    return {
      status,
      comparableMetrics: comparable.length,
      matchedMetrics: comparable.filter(x => x.status === 'MATCH').length,
      mismatchedMetrics: mismatches.length,
      detailCoverage,
      sourceTopServices,
      sourceTopProviders,
      metrics,
      cutoverEligible: status === 'MATCH' && detailCoverage === 'READY',
      cutoverBlocker: status === 'PARTIAL'
        ? 'Budget overview matches, but the v2 budget source does not yet publish service/provider drill-down coverage.'
        : status === 'MISMATCH'
          ? 'One or more comparable budget metrics differ between GP2 and Architecture v2.'
          : status === 'MATCH' ? null : 'Semantic parity has not been established.',
    };
  }

  async function recordParity(parity, monitor, legacy) {
    if (typeof sb === 'undefined' || !sb?.from) return;
    const traceId = monitor?.meta?.traceId || crypto.randomUUID();
    const event = {
      trace_id: traceId,
      route: 'public-spend:shadow-parity',
      operation: 'shadow_parity:public_spend',
      phase: 'client_compare',
      duration_ms: monitor?.meta?.clientMs ?? null,
      status: parity.status === 'MISMATCH' ? 'WARN' : 'OK',
      metadata: {
        semantic_parity: parity.status,
        cutover_eligible: parity.cutoverEligible,
        matched_metrics: parity.matchedMetrics,
        mismatched_metrics: parity.mismatchedMetrics,
        detail_coverage: parity.detailCoverage,
        monitor_snapshot: monitor?.snapshotId || null,
        legacy_schema: legacy.schema,
      },
    };
    try { await sb.from('atlas_v2_client_event').insert(event); } catch (_) { /* fail-soft */ }
  }

  async function probe({ force = false } = {}) {
    if (inflight && !force) return inflight;
    const v2 = getClient();
    if (!v2) {
      publish('unavailable', { reason: 'ATLAS_V2_DATA_CLIENT_NOT_INSTALLED' });
      return null;
    }

    const legacy = legacySnapshot();
    publish('loading', { legacy });
    inflight = (async () => {
      try {
        const monitor = await v2.publicSpend.monitor({
          route: 'public-spend:shadow',
          force,
          timeoutMs: 8000,
        });
        const data = monitor?.data || {};
        const budget = data?.domains?.budget_execution || null;
        const procurement = data?.domains?.procurement || null;
        const parity = budget ? compareBudgetDomain(legacy, budget) : {
          status: 'NOT_ASSERTED',
          comparableMetrics: 0,
          matchedMetrics: 0,
          mismatchedMetrics: 0,
          detailCoverage: 'UNAVAILABLE',
          cutoverEligible: false,
          cutoverBlocker: 'Budget execution domain is unavailable in the v2 monitor.',
          metrics: [],
        };

        const diagnostic = {
          status: 'ready',
          model: monitor.model,
          snapshotId: monitor.snapshotId,
          modelVersion: monitor.modelVersion,
          checksum: monitor.checksum,
          traceId: monitor.meta?.traceId || null,
          clientMs: monitor.meta?.clientMs ?? null,
          serverTiming: monitor.meta?.serverTiming || null,
          sourceVersions: monitor.sourceVersions,
          availability: data?.availability || {},
          comparability: data?.comparability || {},
          procurementSnapshot: procurement?.summary?.snapshot_id || monitor.sourceVersions?.procurement?.snapshot_id || null,
          legacy,
          semanticParity: parity.status,
          parity,
        };
        publish('ready', diagnostic);
        recordParity(parity, monitor, legacy).catch(() => undefined);
        global.dispatchEvent(new CustomEvent('atlas:v2-public-spend-shadow-ready', { detail: diagnostic }));
        return diagnostic;
      } catch (error) {
        const detail = {
          reason: error?.code || 'SHADOW_READ_FAILED',
          message: String(error?.message || error),
          traceId: error?.traceId || null,
          legacy,
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
  global.AtlasV2PublicSpendShadow = Object.freeze({
    probe,
    compareBudgetDomain,
    health: () => global.__ATLAS_V2_PUBLIC_SPEND_SHADOW__ || null,
  });
  publish('installed');
})(window);
