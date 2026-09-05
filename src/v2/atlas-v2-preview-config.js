'use strict';

(function configureAtlasV2Preview(global) {
  const scriptUrl = document.currentScript?.src || location.href;
  const adapterStyleUrl = new URL('./public-spend-adapter.css?v=v2-csp-2', scriptUrl).href;

  if (!document.getElementById('atlas-v2-public-spend-adapter-style')) {
    const link = document.createElement('link');
    link.id = 'atlas-v2-public-spend-adapter-style';
    link.rel = 'stylesheet';
    link.href = adapterStyleUrl;
    link.dataset.atlasV2PreviewStyle = 'public-spend';
    document.head.appendChild(link);
  }

  global.__ATLAS_V2_PREVIEW_MODE__ = 'public-spend';
  global.__ATLAS_V2_CONFIG__ = Object.freeze({
    supabaseUrl: location.origin + '/__atlas_v2',
    publishableKey: 'sb_publishable_3nrUSbZMWfTYUtXnyjDklg_EjyZIzko',
    sessionExchangeUrl: location.origin + '/__atlas_v2/functions/v1/atlas-v2-session-exchange',
  });
  global.__ATLAS_V2_PREVIEW_CONFIG__ = Object.freeze({
    status: 'ready',
    mode: 'public-spend',
    adapterStyleUrl,
    configuredAt: new Date().toISOString(),
  });
})(window);
