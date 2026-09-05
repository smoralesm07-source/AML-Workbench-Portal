'use strict';

(function configureAtlasV2Production(global) {
  const PROJECT_URL = 'https://bzqxvidggykkdouotylg.supabase.co';
  const PUBLISHABLE_KEY = 'sb_publishable_3nrUSbZMWfTYUtXnyjDklg_EjyZIzko';

  global.__ATLAS_V2_PUBLIC_SPEND_CUTOVER__ = true;
  global.__ATLAS_V2_CONFIG__ = Object.freeze({
    supabaseUrl: PROJECT_URL,
    publishableKey: PUBLISHABLE_KEY,
    sessionExchangeUrl: PROJECT_URL + '/functions/v1/atlas-v2-session-exchange',
  });
  global.__ATLAS_V2_PRODUCTION_CONFIG__ = Object.freeze({
    status: 'ready',
    mode: 'public-spend-cutover',
    project: 'bzqxvidggykkdouotylg',
    configuredAt: new Date().toISOString(),
  });
})(window);
