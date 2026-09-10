'use strict';

(function configureAtlasV2Production(global) {
  const V2_PROJECT_URL = 'https://bzqxvidggykkdouotylg.supabase.co';
  const V2_PUBLISHABLE_KEY = 'sb_publishable_3nrUSbZMWfTYUtXnyjDklg_EjyZIzko';
  const CORE_URL = 'https://ldmtlwzqaqmegedktlxr.supabase.co';
  const CORE_PUBLISHABLE_KEY = 'sb_publishable_Nu21dZFBM3NwtIvOwIM8ag_9tyfDJyR';
  // AML-Workbench-Portal is no longer an authentication destination.
  // All interactive authentication returns to the canonical ATLAS Observatorio app.
  const REDIRECT_TO = 'https://atlasobservatorio.app/';

  global.__ATLAS_V2_PRIMARY__ = true;
  global.__ATLAS_V2_CONFIG__ = Object.freeze({
    supabaseUrl: V2_PROJECT_URL,
    publishableKey: V2_PUBLISHABLE_KEY,
    sessionExchangeUrl: V2_PROJECT_URL + '/functions/v1/atlas-v2-session-exchange',
  });
  global.__ATLAS_V2_PRODUCTION_CONFIG__ = Object.freeze({
    status: 'ready',
    mode: 'analytics-primary',
    project: 'bzqxvidggykkdouotylg',
    coreUrl: CORE_URL,
    corePublishableKey: CORE_PUBLISHABLE_KEY,
    redirectTo: REDIRECT_TO,
    legacyFallbackPath: './legacy.html',
    configuredAt: new Date().toISOString(),
  });
})(window);
