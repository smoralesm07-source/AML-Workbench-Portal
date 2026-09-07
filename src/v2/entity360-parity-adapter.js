'use strict';

(function installAtlasV2Entity360ParityAdapter(global) {
  if (global.AtlasV2Entity360Parity?.installed) return;
  const DEFAULT_URL = 'https://bzqxvidggykkdouotylg.supabase.co';
  const DEFAULT_KEY = 'sb_publishable_3nrUSbZMWfTYUtXnyjDklg_EjyZIzko';
  const ENDPOINT = '/functions/v1/atlas-v2-entity-intelligence';

  function text(v, max = 240) { const s = String(v ?? '').trim(); return s && s.length <= max ? s : ''; }
  function rut(v) { return global.AtlasV2Entity360?.canonicalRut?.(v) || ''; }
  async function tokens() {
    const core = await global.AtlasV2Access?.getAccessToken?.();
    if (!core) throw Object.assign(new Error('Sesión core no disponible'), { code:'CORE_SESSION_UNAVAILABLE' });
    const v2 = global.AtlasV2Session?.getAccessToken ? await global.AtlasV2Session.getAccessToken(async () => core) : core;
    if (!v2) throw Object.assign(new Error('Sesión v2 no disponible'), { code:'V2_SESSION_UNAVAILABLE' });
    return { core, v2 };
  }
  async function call(operation, query = {}, options = {}) {
    const { core, v2 } = await tokens();
    const cfg = global.__ATLAS_V2_CONFIG__ || {};
    const base = String(cfg.supabaseUrl || DEFAULT_URL).replace(/\/$/, '');
    const key = String(cfg.publishableKey || DEFAULT_KEY);
    const controller = new AbortController();
    const timeoutMs = Math.max(2500, Math.min(Number(options.timeoutMs || (operation === 'digital_identity_deep' ? 30000 : 22000)), 35000));
    const timer = setTimeout(() => controller.abort(new DOMException('ATLAS_TIMEOUT','TimeoutError')), timeoutMs);
    if (options.signal) {
      if (options.signal.aborted) controller.abort(options.signal.reason);
      else options.signal.addEventListener('abort', () => controller.abort(options.signal.reason), { once:true });
    }
    try {
      const res = await fetch(`${base}${ENDPOINT}`, {
        method:'POST',
        headers:{ authorization:`Bearer ${v2}`, apikey:key, 'content-type':'application/json', 'x-atlas-core-authorization':`Bearer ${core}`, 'x-client-info':'atlas-v2-entity360-parity/2.1' },
        body:JSON.stringify({ operation, query, route:text(options.route || `entidad:${operation}`,120) || 'entidad:parity' }),
        signal:controller.signal,
        cache:'no-store',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const error = new Error(body?.error || `Lectura ${operation} falló (${res.status})`);
        error.code = body?.error || 'ENTITY_INTELLIGENCE_FAILED';
        error.status = res.status;
        error.traceId = body?.trace_id || res.headers.get('x-atlas-trace-id') || null;
        throw error;
      }
      return { ...body, traceId:body?.trace_id || res.headers.get('x-atlas-trace-id') || null };
    } finally { clearTimeout(timer); }
  }
  function reference(input = {}) {
    const ref = global.AtlasV2Entity360?.normalizeReference?.(input) || {};
    return { entity_id:text(ref.entityId || input.entity_id,220), rut:rut(ref.rut || input.rut), name:text(ref.name || input.name,280) };
  }
  async function read(input, options = {}) {
    const ref = reference(input);
    if (!ref.entity_id) throw Object.assign(new Error('Selecciona una entidad'), { code:'INVALID_ENTITY' });
    return call('entity_intelligence_read', ref, options);
  }
  async function watchlists(input, options = {}) {
    return call('watchlists_live', { name:text(input?.name,240), rut:rut(input?.rut), entity_type:text(input?.entityType || input?.entity_type,100) }, { ...options, timeoutMs:22000 });
  }
  async function digital(username, depth = 'quick', options = {}) {
    const u = text(username,80);
    if (u.length < 2) throw Object.assign(new Error('Ingresa un alias de al menos 2 caracteres'), { code:'USERNAME_REQUIRED' });
    if (depth === 'deep') {
      const [base, deep] = await Promise.allSettled([
        call('digital_identity_live', { username:u, depth:'deep' }, { ...options, timeoutMs:26000 }),
        call('digital_identity_deep', { username:u }, { ...options, timeoutMs:32000 }),
      ]);
      return { mode:'deep', base:base.status==='fulfilled'?base.value:null, deep:deep.status==='fulfilled'?deep.value:null, errors:[base,deep].filter(x=>x.status==='rejected').map(x=>String(x.reason?.message||x.reason)) };
    }
    return { mode:'quick', base:await call('digital_identity_live', { username:u, depth:'quick' }, options), deep:null, errors:[] };
  }
  global.AtlasV2Entity360Parity = Object.freeze({ installed:true, read, watchlists, digital, call });
})(window);
