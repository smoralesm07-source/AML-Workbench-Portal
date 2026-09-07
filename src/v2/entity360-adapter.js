'use strict';

(function installAtlasV2Entity360Adapter(global) {
  if (global.AtlasV2Entity360?.installed) return;

  const DEFAULT_LIMIT = 8;

  function text(value, max = 180) {
    const out = String(value ?? '').trim();
    return out && out.length <= max ? out : '';
  }

  function canonicalRut(value) {
    const clean = String(value ?? '').toUpperCase().replace(/[^0-9K]/g, '');
    if (clean.length < 2) return '';
    const body = clean.slice(0, -1).replace(/^0+/, '') || '0';
    const dv = clean.slice(-1);
    return `${body}-${dv}`;
  }

  function validRutShape(value) {
    return /^\d{7,8}-[0-9K]$/.test(canonicalRut(value));
  }

  function api() {
    if (!global.AtlasV2Access?.data) throw new Error('ATLAS v2 access bridge no está disponible');
    return global.AtlasV2Access.data();
  }

  function errorState(error) {
    return {
      status: 'error',
      code: text(error?.code || 'READ_FAILED', 80),
      message: text(error?.message || error || 'No fue posible consultar la fuente', 260),
      traceId: text(error?.traceId || '', 120) || null,
    };
  }

  function normalizeEntityCore(out) {
    const data = out?.data && typeof out.data === 'object' ? out.data : {};
    const identity = data.identity || data.entity || data.subject || {};
    return {
      status: 'ready',
      model: out.model,
      snapshotId: out.snapshotId || null,
      generatedAt: out.generatedAt || null,
      sourceVersions: out.sourceVersions || {},
      data,
      identity: {
        name: text(identity.name || identity.legal_name || identity.razon_social || data.name || data.legal_name, 240),
        rut: canonicalRut(identity.rut || data.rut || ''),
        status: text(identity.status || identity.tax_status || data.status, 120),
        region: text(identity.region || data.region, 120),
        commune: text(identity.commune || identity.comuna || data.commune || data.comuna, 120),
        activity: text(identity.activity || identity.giro || data.activity || data.giro, 240),
      },
    };
  }

  async function readCore(rut, options = {}) {
    const configuredModel = text(
      options.model || global.__ATLAS_V2_ENTITY360_MODEL__ || global.__ATLAS_V2_CONFIG__?.entity360Model,
      120,
    );
    if (!configuredModel) {
      return {
        status: 'unavailable',
        code: 'ENTITY360_MODEL_NOT_PUBLISHED',
        message: 'El núcleo consolidado de Entidad 360 aún no tiene un read model v2 publicado. ATLAS no simula datos tributarios, UAF, RES ni sancionatorios.',
      };
    }
    try {
      const out = await api().readModel(configuredModel, {
        scope: rut,
        force: !!options.force,
        signal: options.signal,
        route: `entity360:core:${rut}`,
      });
      return normalizeEntityCore(out);
    } catch (error) {
      return errorState(error);
    }
  }

  function compactItem(row = {}, domain) {
    const amount = Number(
      row._context_amount ?? row.context_amount ?? row.amount_l12 ?? row.amount_clp ?? row.total_amount ?? 0,
    );
    return {
      domain,
      id: text(row.provider_id || row.supplier_id || row.id || row.rut || '', 220),
      name: text(row.provider_name || row.supplier_name || row.name || row.legal_name || row.razon_social || '', 260),
      rut: canonicalRut(row.rut || row.provider_rut || row.supplier_rut || ''),
      amount: Number.isFinite(amount) ? amount : 0,
      serviceCount: Number(row._context_service_count ?? row.service_count ?? row.buyer_count ?? 0) || 0,
      raw: row,
    };
  }

  function fulfilled(result, domain) {
    if (result.status !== 'fulfilled') return errorState(result.reason);
    const value = result.value;
    return {
      status: 'ready',
      contract: value?.contract || null,
      snapshotId: value?.snapshotId || null,
      items: (Array.isArray(value?.items) ? value.items : []).map(row => compactItem(row, domain)),
      page: value?.page || null,
      traceId: value?.meta?.traceId || null,
    };
  }

  async function readPublicSpend(rut, options = {}) {
    const query = { search: rut, offset: 0, limit: Math.max(1, Math.min(Number(options.limit || DEFAULT_LIMIT), 20)) };
    let data;
    try {
      data = api();
    } catch (error) {
      const failed = errorState(error);
      return { status: 'error', budget: failed, procurement: failed };
    }

    const [budget, procurement] = await Promise.allSettled([
      data.publicSpend.budgetProviders({
        filters: {},
        query,
        signal: options.signal,
        route: `entity360:budget-provider:${rut}`,
      }),
      data.publicSpend.suppliers({
        query,
        signal: options.signal,
        route: `entity360:procurement-supplier:${rut}`,
      }),
    ]);

    const budgetState = fulfilled(budget, 'budget_execution');
    const procurementState = fulfilled(procurement, 'procurement');
    const ready = [budgetState, procurementState].filter(part => part.status === 'ready');
    return {
      status: ready.length ? 'ready' : 'error',
      budget: budgetState,
      procurement: procurementState,
    };
  }

  async function read(rutInput, options = {}) {
    const rut = canonicalRut(rutInput);
    if (!validRutShape(rut)) {
      return {
        status: 'invalid',
        rut,
        message: 'Ingresa un RUT con formato válido para iniciar la lectura analítica.',
      };
    }

    const [core, publicSpend] = await Promise.all([
      readCore(rut, options),
      readPublicSpend(rut, options),
    ]);

    const hasLiveLens = publicSpend.status === 'ready' || core.status === 'ready';
    return {
      status: hasLiveLens ? 'ready' : 'unavailable',
      rut,
      core,
      publicSpend,
      checkedAt: new Date().toISOString(),
    };
  }

  global.AtlasV2Entity360 = Object.freeze({
    installed: true,
    canonicalRut,
    validRutShape,
    read,
    readCore,
    readPublicSpend,
  });
})(window);
