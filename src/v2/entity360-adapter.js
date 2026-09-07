'use strict';

(function installAtlasV2Entity360Adapter(global) {
  if (global.AtlasV2Entity360?.installed) return;

  const DEFAULT_LIMIT = 8;
  const DEFAULT_URL = 'https://bzqxvidggykkdouotylg.supabase.co';
  const DEFAULT_PUBLISHABLE_KEY = 'sb_publishable_3nrUSbZMWfTYUtXnyjDklg_EjyZIzko';
  const ENDPOINT = '/functions/v1/atlas-v2-read';
  const DEFAULT_TIMEOUT_MS = 12000;

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

  function entityIdFromRut(value) {
    const rut = canonicalRut(value);
    if (!validRutShape(rut)) return '';
    const [body, dv] = rut.split('-');
    return `ENT-RUT-${body}-${dv}`;
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
    const tax = data.tax || {};
    return {
      status: 'ready',
      model: out.model || 'atlas_v2_entity360_read',
      contract: data.contract || out.contract || null,
      snapshotId: out.snapshotId || data.generated_at || null,
      generatedAt: out.generatedAt || data.generated_at || null,
      sourceVersions: out.sourceVersions || {},
      sourceStatus: data.source_status || {},
      traceId: out.traceId || null,
      data,
      identity: {
        name: text(identity.name || identity.legal_name || identity.razon_social || tax.legal_name || tax.name || data.name || data.legal_name, 240),
        rut: canonicalRut(identity.rut || tax.rut || data.resolved_rut || data.rut || ''),
        status: text(identity.status || identity.tax_status || tax.current_status || tax.status || data.status, 120),
        region: text(identity.region || tax.region || data.region, 120),
        commune: text(identity.commune || identity.comuna || tax.commune || tax.comuna || data.commune || data.comuna, 120),
        activity: text(identity.activity || identity.giro || tax.activity || tax.main_activity || tax.giro || data.activity || data.giro, 240),
      },
    };
  }

  async function coreAccessToken() {
    if (!global.AtlasV2Access?.getAccessToken) return null;
    return global.AtlasV2Access.getAccessToken();
  }

  async function v2AccessToken(coreToken) {
    if (global.AtlasV2Session?.getAccessToken) return global.AtlasV2Session.getAccessToken(async () => coreToken);
    return coreToken;
  }

  async function readCore(rutInput, options = {}) {
    const rut = canonicalRut(rutInput);
    if (!validRutShape(rut)) return { status: 'invalid', code: 'INVALID_RUT', message: 'RUT inválido para Entidad 360.' };
    const coreToken = await coreAccessToken();
    if (!coreToken) return errorState(Object.assign(new Error('ATLAS core session is unavailable'), { code: 'CORE_SESSION_UNAVAILABLE' }));

    try {
      const token = await v2AccessToken(coreToken);
      if (!token) throw Object.assign(new Error('ATLAS v2 session is unavailable'), { code: 'V2_SESSION_UNAVAILABLE' });
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
            'x-client-info': 'atlas-v2-entity360/2.0',
            'x-atlas-core-authorization': `Bearer ${coreToken}`,
          },
          body: JSON.stringify({
            operation: 'entity360_read',
            query: { entity_id: text(options.entityId, 180) || entityIdFromRut(rut), rut },
            route: text(options.route || `entity360:core:${rut}`, 120) || 'entity360:core',
          }),
          signal: controller.signal,
          cache: 'no-store',
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          const error = new Error(body?.error || `ATLAS Entity 360 read failed (${res.status})`);
          error.code = body?.error || 'ENTITY360_READ_FAILED';
          error.status = res.status;
          error.traceId = body?.trace_id || res.headers.get('x-atlas-trace-id') || null;
          throw error;
        }
        if (body?.contract !== 'ATLAS_ENTITY360_READ_V2') {
          const error = new Error('ATLAS Entity 360 contract mismatch');
          error.code = 'CONTRACT_MISMATCH';
          error.traceId = body?.trace_id || res.headers.get('x-atlas-trace-id') || null;
          throw error;
        }
        return normalizeEntityCore({
          contract: body.contract,
          model: 'atlas_v2_entity360_read',
          snapshotId: res.headers.get('x-atlas-snapshot') || body.generated_at || null,
          generatedAt: body.generated_at || null,
          sourceVersions: body.source_status || {},
          traceId: body.trace_id || res.headers.get('x-atlas-trace-id') || null,
          data: body,
        });
      } catch (error) {
        if (controller.signal.aborted && error?.name !== 'AbortError') {
          const timeout = new Error('ATLAS Entity 360 read timed out or was cancelled');
          timeout.code = 'TIMEOUT_OR_CANCELLED';
          return errorState(timeout);
        }
        return errorState(error);
      } finally {
        clearTimeout(timer);
      }
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
    entityIdFromRut,
    read,
    readCore,
    readPublicSpend,
  });
})(window);
