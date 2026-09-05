'use strict';

(function installAtlasV2Session(global) {
  if (!global.AtlasV2Data?.create) throw new Error('AtlasV2Data must load before AtlasV2Session');
  if (global.AtlasV2Session?.installed) return;

  const DEFAULT_URL = 'https://bzqxvidggykkdouotylg.supabase.co';
  const DEFAULT_PUBLISHABLE_KEY = 'sb_publishable_3nrUSbZMWfTYUtXnyjDklg_EjyZIzko';
  const EXCHANGE_PATH = '/functions/v1/atlas-v2-session-exchange';
  const RENEW_SKEW_MS = 60 * 1000;
  const original = global.AtlasV2Data;
  let grant = null;
  let pending = null;

  function config() {
    const c = global.__ATLAS_V2_CONFIG__ || {};
    const supabaseUrl = String(c.supabaseUrl || DEFAULT_URL).replace(/\/$/, '');
    return {
      supabaseUrl,
      publishableKey: String(c.publishableKey || DEFAULT_PUBLISHABLE_KEY),
      exchangeUrl: String(c.sessionExchangeUrl || `${supabaseUrl}${EXCHANGE_PATH}`),
    };
  }

  function decodeSubject(token) {
    try {
      const part = String(token || '').split('.')[1];
      if (!part) return '';
      const base64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
      const json = typeof global.atob === 'function' ? global.atob(base64) : Buffer.from(base64, 'base64').toString('utf8');
      return String(JSON.parse(json)?.sub || '');
    } catch (_) {
      return '';
    }
  }

  function clear() {
    grant = null;
    pending = null;
    global.__ATLAS_V2_SESSION__ = { status: 'empty', checkedAt: new Date().toISOString() };
  }

  function usable(coreSubject) {
    if (!grant?.accessToken || !grant?.grantExpiresAt) return false;
    if (grant.coreSubject !== coreSubject) return false;
    return Date.parse(grant.grantExpiresAt) - Date.now() > RENEW_SKEW_MS;
  }

  async function exchange(coreToken, coreSubject) {
    const c = config();
    const res = await fetch(c.exchangeUrl, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${coreToken}`,
        apikey: c.publishableKey,
        'content-type': 'application/json',
        'x-client-info': 'atlas-v2-session/1.0',
      },
      body: '{}',
      cache: 'no-store',
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = new Error(body?.error || `ATLAS v2 session exchange failed (${res.status})`);
      error.code = body?.error || 'SESSION_EXCHANGE_FAILED';
      error.status = res.status;
      throw error;
    }
    if (body?.schema !== 'ATLAS_V2_SESSION_EXCHANGE_V1' || !body?.access_token || !body?.grant_expires_at) {
      const error = new Error('ATLAS v2 session exchange contract mismatch');
      error.code = 'SESSION_CONTRACT_MISMATCH';
      throw error;
    }
    if (Date.parse(body.grant_expires_at) - Date.now() <= RENEW_SKEW_MS) {
      const error = new Error('ATLAS v2 session grant is already stale');
      error.code = 'SESSION_GRANT_STALE';
      throw error;
    }
    grant = {
      accessToken: body.access_token,
      grantExpiresAt: body.grant_expires_at,
      tokenExpiresAt: body.expires_at || null,
      coreSubject,
      role: body.identity?.role || null,
    };
    global.__ATLAS_V2_SESSION__ = {
      status: 'ready',
      grantExpiresAt: grant.grantExpiresAt,
      tokenExpiresAt: grant.tokenExpiresAt,
      coreSubject: grant.coreSubject,
      role: grant.role,
      checkedAt: new Date().toISOString(),
    };
    return grant.accessToken;
  }

  async function getAccessToken(coreTokenProvider) {
    if (typeof coreTokenProvider !== 'function') throw new TypeError('ATLAS v2 federation requires the core token provider');
    const coreToken = await coreTokenProvider();
    if (!coreToken) {
      clear();
      return null;
    }
    const coreSubject = decodeSubject(coreToken);
    if (!coreSubject) {
      clear();
      const error = new Error('ATLAS core session token is malformed');
      error.code = 'CORE_TOKEN_MALFORMED';
      throw error;
    }
    if (usable(coreSubject)) return grant.accessToken;
    if (pending?.coreSubject === coreSubject) return pending.promise;

    const promise = exchange(coreToken, coreSubject).finally(() => {
      if (pending?.promise === promise) pending = null;
    });
    pending = { coreSubject, promise };
    return promise;
  }

  function createFederated(configInput = {}) {
    const rawProvider = configInput.getAccessToken;
    if (typeof rawProvider !== 'function') throw new TypeError('AtlasV2Data.create requires getAccessToken()');
    const c = config();
    return original.create({
      ...configInput,
      supabaseUrl: configInput.supabaseUrl || c.supabaseUrl,
      publishableKey: configInput.publishableKey || c.publishableKey,
      getAccessToken: () => getAccessToken(rawProvider),
    });
  }

  global.AtlasV2Data = Object.freeze({ ...original, create: createFederated });
  global.AtlasV2Session = Object.freeze({ installed: true, getAccessToken, clear, state: () => ({ ...(global.__ATLAS_V2_SESSION__ || {}) }) });
  clear();
})(window);
