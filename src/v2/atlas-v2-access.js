'use strict';

(function installAtlasV2Access(global) {
  if (global.AtlasV2Access?.installed) return;
  let client = null;

  async function getAccessToken() {
    if (typeof global.__ATLAS_V2_ACCESS_TOKEN_PROVIDER__ === 'function') {
      return global.__ATLAS_V2_ACCESS_TOKEN_PROVIDER__();
    }
    if (global.sb?.auth?.getSession) {
      const { data, error } = await global.sb.auth.getSession();
      if (error) throw error;
      return data?.session?.access_token || null;
    }
    if (global.AtlasCoreSession?.getAccessToken) {
      return global.AtlasCoreSession.getAccessToken();
    }
    return null;
  }

  function data() {
    if (client) return client;
    if (!global.AtlasV2Data?.create) throw new Error('ATLAS v2 data client no está disponible');
    const config = global.__ATLAS_V2_CONFIG__ || {};
    client = global.AtlasV2Data.create({
      supabaseUrl: config.supabaseUrl,
      publishableKey: config.publishableKey,
      getAccessToken,
    });
    return client;
  }

  function reset() {
    client?.clearCache?.();
    client = null;
  }

  global.AtlasV2Access = Object.freeze({
    installed: true,
    getAccessToken,
    data,
    reset,
  });
})(window);
