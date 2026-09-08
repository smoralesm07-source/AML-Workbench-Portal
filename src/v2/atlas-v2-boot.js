'use strict';

(function bootAtlasV2() {
  const baseUrl = new URL('./', document.currentScript?.src || document.baseURI);
  const STRUCTURAL_VERSION = 'v2-primary-5';
  const SURFACE_VERSION = 'v2-primary-7-executive-pulse-entity360-classic-1';
  const ASSET_REVISION = 'universos-intelligence-osfl-sanctions-1';
  const LEGACY_ASSET_REVISION_MARKER = "ASSET_REVISION = 'executive-pulse-entity360-classic-1'";
  void LEGACY_ASSET_REVISION_MARKER;
  const STRUCTURAL_SURFACES = Object.freeze([
    'atlas-v2-access.js',
    'atlas-v2-viz.js',
    'entity-search-adapter.js',
    'explore-surface.js',
    'entity360-adapter.js',
    'entity360-surface.js',
    // La Entidad 360 histórica/paridad se registra después de la vista ejecutiva:
    // queda como autoridad visible del expediente profundo sin reactivar runtime legacy.
    'entity360-parity-surface.js',
    'public-spend-surface.js',
    'relations-surface.js',
    'universes-adapter.js',
    'universes-surface.js',
    'osfl-adapter.js',
    'osfl-surface.js',
    'sanctions-adapter.js',
    'sanctions-surface.js',
    'territory-adapter.js',
    'territory-surface.js',
    'watch-adapter.js',
    'watch-surface.js',
  ]);

  function emit(outcome, detail = {}) {
    window.dispatchEvent(new CustomEvent('atlas:v2-boot', {
      detail: { outcome, route: window.AtlasV2Shell?.currentRoute?.().id || 'boot', ...detail },
    }));
  }

  function loadScript(file) {
    return new Promise((resolve, reject) => {
      const src = new URL(`${file}?v=${SURFACE_VERSION}&r=${ASSET_REVISION}`, baseUrl).href;
      const existing = Array.from(document.scripts).find(script => script.src === src);
      if (existing) {
        if (existing.dataset.atlasLoaded === 'true') return resolve();
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', () => reject(new Error(`No fue posible cargar ${file}`)), { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.dataset.atlasV2Extension = file;
      script.addEventListener('load', () => { script.dataset.atlasLoaded = 'true'; resolve(); }, { once: true });
      script.addEventListener('error', () => reject(new Error(`No fue posible cargar ${file}`)), { once: true });
      document.head.appendChild(script);
    });
  }

  async function installAnalyticalSurfaces() {
    const failed = [];
    for (const file of STRUCTURAL_SURFACES) {
      try {
        await loadScript(file);
      } catch (error) {
        failed.push(file);
        console.error('[ATLAS v2] structural analytical surface failed to load', file, error);
      }
    }
    if (failed.length) {
      const error = new Error(`ATLAS v2 structural surfaces unavailable: ${failed.join(', ')}`);
      error.code = 'STRUCTURAL_SURFACE_LOAD_FAILED';
      throw error;
    }
  }

  async function warmFederatedSession() {
    if (!window.AtlasV2Session?.getAccessToken || !window.AtlasCoreSession?.getAccessToken) return false;
    const started = performance.now();
    try {
      const token = await window.AtlasV2Session.getAccessToken(() => window.AtlasCoreSession.getAccessToken());
      const durationMs = Math.round(performance.now() - started);
      if (token) emit('federation_ready', { code: 'FEDERATION_WARM', durationMs });
      return Boolean(token);
    } catch (error) {
      const durationMs = Math.round(performance.now() - started);
      console.warn('[ATLAS v2] federation prewarm did not complete', error?.code || error?.message || error);
      emit('federation_degraded', { code: error?.code || 'FEDERATION_WARM_FAILED', durationMs });
      return false;
    }
  }

  function renderFatal(error) {
    const root = document.getElementById('atlas-v2-root');
    if (!root) return;
    while (root.firstChild) root.removeChild(root.firstChild);
    const main = document.createElement('main');
    main.className = 'atlas-v2-auth-screen';
    const card = document.createElement('section');
    card.className = 'atlas-v2-auth-card';
    const brand = document.createElement('div'); brand.className = 'atlas-v2-auth-brand'; brand.textContent = 'ATLAS';
    const eyebrow = document.createElement('div'); eyebrow.className = 'atlas-v2-eyebrow'; eyebrow.textContent = 'INICIO BLOQUEADO';
    const title = document.createElement('h1'); title.textContent = 'La plataforma no pudo iniciar de forma segura';
    const body = document.createElement('p'); body.textContent = 'Una capacidad estructural de Atlas v2 no está disponible. Se bloqueó el inicio para evitar una sesión analítica parcial o inconsistente.';
    const retry = document.createElement('button'); retry.className = 'atlas-v2-button'; retry.type = 'button'; retry.textContent = 'Reintentar'; retry.addEventListener('click', () => location.reload());
    card.append(brand, eyebrow, title, body, retry); main.append(card); root.append(main);
    emit('error', { code: error?.code || 'BOOT_FAILED' });
  }

  async function mount() {
    const root = document.getElementById('atlas-v2-root');
    if (!root) throw new Error('ATLAS v2 root is missing');
    if (!window.AtlasCoreSession?.ready) throw new Error('ATLAS v2 core auth boundary failed to load');
    const access = await window.AtlasCoreSession.ready();
    if (!access) return;
    if (!window.AtlasV2Shell?.mount) throw new Error('ATLAS v2 shell failed to load');

    const federationWarm = warmFederatedSession();
    await installAnalyticalSurfaces();
    if (!window.AtlasV2Viz?.installed || !window.AtlasV2EntitySearch?.installed || !window.__ATLAS_V2_ENTITY360_PARITY__?.installed || !window.AtlasV2Osfl || !window.__ATLAS_V2_OSFL_SURFACE__ || !window.AtlasV2Sanctions || !window.__ATLAS_V2_SANCTIONS_SURFACE__) {
      const error = new Error('ATLAS v2 visual/search/entity360/osfl/sanctions capabilities failed to initialize');
      error.code = 'VISUAL_SEARCH_CAPABILITY_MISSING';
      throw error;
    }
    window.AtlasV2Shell.mount(root);
    emit('ok', {
      code: 'SHELL_READY', visualNavigation: true, entitySearch: true, entityIntelligence: true,
      entity360: 'ENTITY360_LEGACY_PARITY_V2', osfl: true, sanctions: true, assetRevision: ASSET_REVISION,
    });
    window.dispatchEvent(new CustomEvent('atlas:v2-shell-ready', {
      detail: {
        route: window.AtlasV2Shell.currentRoute?.().id || 'explorar',
        role: access.role || 'viewer',
        runtime: 'analytics-primary',
        visualNavigation: true,
        entitySearch: true,
        entityIntelligence: true,
        entity360: 'ENTITY360_LEGACY_PARITY_V2',
        osfl: true,
        sanctions: true,
        assetRevision: ASSET_REVISION,
      },
    }));
    void federationWarm;
  }

  const start = () => {
    void mount().catch(error => {
      console.error('[ATLAS v2] boot failed', error);
      renderFatal(error);
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();