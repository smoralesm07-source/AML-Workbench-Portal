'use strict';

(function configureAtlasV2Preview(global) {
  global.__ATLAS_V2_PREVIEW_MODE__ = 'public-spend';
  global.__ATLAS_V2_CONFIG__ = Object.freeze({
    supabaseUrl: location.origin + '/__atlas_v2',
    publishableKey: 'sb_publishable_3nrUSbZMWfTYUtXnyjDklg_EjyZIzko',
    sessionExchangeUrl: location.origin + '/__atlas_v2/functions/v1/atlas-v2-session-exchange',
  });
  global.__ATLAS_V2_PREVIEW_CONFIG__ = Object.freeze({
    status: 'ready',
    mode: 'public-spend',
    configuredAt: new Date().toISOString(),
  });
})(window);
