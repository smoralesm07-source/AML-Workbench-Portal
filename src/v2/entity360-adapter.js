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

  function normalizeReference(input, options = {}) {
    if (input && typeof input === 'object') {
      const rut = canonicalRut(input.rut || options.rut || '');
      const entityId = text(input.entityId || input.entity_id || options.entityId || '', 220) || (validRutShape(rut) ? entityIdFromRut(rut) : '');
      return { entityId, rut: validRutShape(rut) ? rut : '', name: text(input.name || options.name || '', 280) };
    }
    const raw = text(input, 220);
    const rut = validRutShape(raw) ? canonicalRut(raw) : canonicalRut(options.rut || '');
    const entityId = text(options.entityId || (!validRutShape(raw) ? raw : ''), 220) || (validRutShape(rut) ? entityIdFromRut(rut) : '');
    return { entityId, rut: validRutShape(rut) ? rut : '', name: text(options.name || '', 280) };
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

  function normalizeEntityCore(out, reference = {}) {
    const data = out?.data && typeof out.data === 'object' ? out.data : {};
    const identity = data.identity || data.entity || data.subject || {};
    const profile = identity.profile && typeof identity.profile === 'object' ? identity.profile : {};
    const tax = data.tax || {};
    const resolvedRut = canonicalRut(identity.rut || tax.rut || data.resolved_rut || data.rut || reference.rut || '');
    const sourceStatus = data.source_status || {};
    return {
      status: 'ready',
      model: out.model || 'atlas_v2_entity360_read',
      contract: data.contract || out.contract || null,
      snapshotId: out.snapshotId || data.generated_at || null,
      generatedAt: out.generatedAt || data.generated_at || null,
      sourceVersions: out.sourceVersions || {},
      sourceStatus,
      traceId: out.traceId || null,
      data,
      identity: {
        entityId: text(data.entity_id || identity.entity_id || reference.entityId, 220),
        name: text(identity.name || identity.legal_name || identity.razon_social || profile.nombre || tax.legal_name || tax.name || data.name || data.legal_name || reference.name, 280),
        rut: validRutShape(resolvedRut) ? resolvedRut : '',
        status: text(identity.status || identity.tax_status || tax.current_status || tax.status || data.status, 120),
        region: text(identity.region || profile?.ubicacion?.region || tax.region || data.region, 120),
        commune: text(identity.commune || identity.comuna || profile?.ubicacion?.comuna || tax.commune || tax.comuna || data.commune || data.comuna, 120),
        activity: text(identity.activity || identity.giro || tax.activity || tax.main_activity || tax.giro || data.activity || data.giro, 280),
        entityType: text(identity.entity_type || identity.tipo_entidad_es || profile.tipo_entidad_es || data.entity_type, 120),
        sources: Array.isArray(profile.fuentes) ? profile.fuentes.map(value => text(value, 80)).filter(Boolean) : [],
        roles: Array.isArray(profile.roles) ? profile.roles.map(value => text(value, 100)).filter(Boolean) : [],
        eventCount: Number(profile.event_count || 0) || 0,
        identityConfidence: Number(profile.identity_confidence ?? identity.identity_confidence ?? 0) || 0,
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

  async function gateway(operation, query, options = {}, expectedContract = null, defaultRoute = 'entity360') {
    const coreToken = await coreAccessToken();
    if (!coreToken) throw Object.assign(new Error('ATLAS core session is unavailable'), { code: 'CORE_SESSION_UNAVAILABLE' });
    const token = await v2AccessToken(coreToken);
    if (!token) throw Object.assign(new Error('ATLAS v2 session is unavailable'), { code: 'V2_SESSION_UNAVAILABLE' });
    const config = global.__ATLAS_V2_CONFIG__ || {};
    const supabaseUrl = String(config.supabaseUrl || DEFAULT_URL).replace(/\/$/, '');
    const publishableKey = String(config.publishableKey || DEFAULT_PUBLISHABLE_KEY);
    const controller = new AbortController();
    const timeoutMs = Math.max(1000, Math.min(Number(options.timeoutMs || DEFAULT_TIMEOUT_MS), 50000));
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
          'x-client-info': 'atlas-v2-entity360/2.2',
          'x-atlas-core-authorization': `Bearer ${coreToken}`,
        },
        body: JSON.stringify({ operation, query, route: text(options.route || defaultRoute, 120) || defaultRoute }),
        signal: controller.signal,
        cache: 'no-store',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const error = new Error(body?.error || `ATLAS ${operation} failed (${res.status})`);
        error.code = body?.error || 'ENTITY_READ_FAILED';
        error.status = res.status;
        error.traceId = body?.trace_id || res.headers.get('x-atlas-trace-id') || null;
        throw error;
      }
      if (expectedContract && body?.contract !== expectedContract) {
        const error = new Error(`ATLAS ${operation} contract mismatch`);
        error.code = 'CONTRACT_MISMATCH';
        error.traceId = body?.trace_id || res.headers.get('x-atlas-trace-id') || null;
        throw error;
      }
      return {
        body,
        traceId: body?.trace_id || res.headers.get('x-atlas-trace-id') || null,
        snapshotId: res.headers.get('x-atlas-snapshot') || body?.generated_at || null,
        serverTiming: res.headers.get('server-timing'),
      };
    } catch (error) {
      if (controller.signal.aborted && error?.name !== 'AbortError') {
        const timeout = new Error('ATLAS Entity 360 read timed out or was cancelled');
        timeout.code = 'TIMEOUT_OR_CANCELLED';
        throw timeout;
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async function readCore(input, options = {}) {
    const reference = normalizeReference(input, options);
    if (!reference.entityId) return { status: 'invalid', code: 'INVALID_ENTITY', message: 'Se requiere RUT o identificador de entidad para Entidad 360.' };
    try {
      const out = await gateway('entity360_read', { entity_id: reference.entityId, rut: reference.rut || null }, options, 'ATLAS_ENTITY360_READ_V2', `entity360:core:${reference.entityId}`);
      return normalizeEntityCore({ contract: out.body.contract, model: 'atlas_v2_entity360_read', snapshotId: out.snapshotId, generatedAt: out.body.generated_at || null, sourceVersions: out.body.source_status || {}, traceId: out.traceId, data: out.body }, reference);
    } catch (error) {
      return errorState(error);
    }
  }

  async function readIntelligence(input, options = {}) {
    const reference = normalizeReference(input, options);
    if (!reference.entityId) return { status: 'invalid', message: 'Se requiere identidad resuelta para consultar inteligencia contextual.' };
    try {
      const out = await gateway('entity_intelligence', { entity_id: reference.entityId, rut: reference.rut || null }, { ...options, timeoutMs: options.timeoutMs || 16000 }, 'ATLAS_ENTITY_INTELLIGENCE_V2', `entity360:intelligence:${reference.entityId}`);
      return { status: 'ready', contract: out.body.contract, data: out.body, traceId: out.traceId, snapshotId: out.snapshotId };
    } catch (error) {
      return errorState(error);
    }
  }

  async function readScreening(input, options = {}) {
    const name = text(input?.name || '', 280);
    const rut = validRutShape(input?.rut) ? canonicalRut(input.rut) : '';
    const entityType = text(input?.entityType || input?.entity_type || '', 100);
    if (!name && !rut) return { status: 'skipped', reason: 'IDENTITY_NOT_RESOLVED', sources: {} };
    try {
      const out = await gateway('entity_screening_live', { name: name || null, rut: rut || null, entity_type: entityType || null }, { ...options, timeoutMs: options.timeoutMs || 45000 }, 'ATLAS_ENTITY_SCREENING_LIVE_V2', `entity360:screening:${rut || name}`);
      return { status: 'ready', contract: out.body.contract, checkedAt: out.body.checked_at || null, mode: out.body.mode || null, sources: out.body.sources || {}, routing: out.body.routing || {}, guardrails: out.body.guardrails || {}, data: out.body, traceId: out.traceId };
    } catch (error) {
      return errorState(error);
    }
  }

  async function searchDigitalIdentity(usernameInput, options = {}) {
    const username = text(usernameInput, 80).replace(/^@/, '');
    if (username.length < 2) return { status: 'invalid', code: 'USERNAME_REQUIRED', message: 'Ingresa un alias o username de al menos 2 caracteres.' };
    try {
      const out = await gateway('digital_identity_live', { username, depth: options.depth === 'deep' ? 'deep' : 'quick' }, { ...options, timeoutMs: options.timeoutMs || 30000 }, 'ATLAS_DIGITAL_IDENTITY_LIVE_V2', `entity360:digital:${username}`);
      return { status: 'ready', contract: out.body.contract, username, checkedAt: out.body.checked_at || null, analytics: out.body.analytics || {}, records: Array.isArray(out.body.records) ? out.body.records : [], graph: out.body.graph || {}, engineHealth: out.body.engine_health || {}, guardrails: out.body.guardrails || {}, data: out.body, traceId: out.traceId };
    } catch (error) {
      return errorState(error);
    }
  }

  function compactItem(row = {}, domain) {
    const amount = Number(row._context_amount ?? row.context_amount ?? row.amount_l12 ?? row.amount_clp ?? row.total_amount ?? 0);
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

  async function readPublicSpend(rutInput, options = {}) {
    const rut = canonicalRut(rutInput);
    if (!validRutShape(rut)) {
      return { status: 'skipped', reason: 'RUT_NOT_RESOLVED', budget: { status: 'skipped', items: [] }, procurement: { status: 'skipped', items: [] } };
    }
    const query = { search: rut, offset: 0, limit: Math.max(1, Math.min(Number(options.limit || DEFAULT_LIMIT), 20)) };
    let data;
    try { data = api(); } catch (error) {
      const failed = errorState(error);
      return { status: 'error', budget: failed, procurement: failed };
    }

    const [budget, procurement] = await Promise.allSettled([
      data.publicSpend.budgetProviders({ filters: {}, query, signal: options.signal, route: `entity360:budget-provider:${rut}` }),
      data.publicSpend.suppliers({ query, signal: options.signal, route: `entity360:procurement-supplier:${rut}` }),
    ]);

    const budgetState = fulfilled(budget, 'budget_execution');
    const procurementState = fulfilled(procurement, 'procurement');
    const ready = [budgetState, procurementState].filter(part => part.status === 'ready');
    return { status: ready.length ? 'ready' : 'error', budget: budgetState, procurement: procurementState };
  }

  async function read(input, options = {}) {
    const reference = normalizeReference(input, options);
    if (!reference.entityId) return { status: 'invalid', reference, message: 'Selecciona una coincidencia de entidad o ingresa un RUT válido.' };

    const core = await readCore(reference, options);
    const resolvedRut = core?.identity?.rut || reference.rut || '';
    const resolved = {
      entityId: core?.identity?.entityId || reference.entityId,
      rut: resolvedRut,
      name: core?.identity?.name || reference.name,
      entityType: core?.identity?.entityType || '',
    };
    const [publicSpend, intelligence, screening] = await Promise.all([
      validRutShape(resolvedRut) ? readPublicSpend(resolvedRut, options) : Promise.resolve({ status: 'skipped', reason: 'RUT_NOT_RESOLVED', budget: { status: 'skipped', items: [] }, procurement: { status: 'skipped', items: [] } }),
      readIntelligence(resolved, options),
      readScreening(resolved, options),
    ]);

    const hasLiveLens = publicSpend.status === 'ready' || core.status === 'ready' || intelligence.status === 'ready' || screening.status === 'ready';
    return {
      status: hasLiveLens ? 'ready' : 'unavailable',
      reference: { ...reference, ...resolved },
      rut: resolvedRut || reference.rut,
      entityId: resolved.entityId,
      core,
      intelligence,
      screening,
      publicSpend,
      checkedAt: new Date().toISOString(),
    };
  }

  global.AtlasV2Entity360 = Object.freeze({
    installed: true,
    canonicalRut,
    validRutShape,
    entityIdFromRut,
    normalizeReference,
    read,
    readCore,
    readIntelligence,
    readScreening,
    searchDigitalIdentity,
    readPublicSpend,
  });
})(window);