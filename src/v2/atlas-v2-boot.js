'use strict';

(function bootAtlasV2() {
  const baseUrl = new URL('./', document.currentScript?.src || document.baseURI);

  function loadScript(file) {
    return new Promise((resolve, reject) => {
      const src = new URL(file, baseUrl).href;
      const existing = Array.from(document.scripts).find(script => script.src === src);
      if (existing) {
        if (existing.dataset.atlasLoaded === 'true') return resolve();
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
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
    for (const file of [
      'atlas-v2-access.js',
      'entity360-adapter.js',
      'entity360-surface.js',
      'public-spend-surface.js',
      'relations-surface.js',
      'universes-adapter.js',
      'universes-surface.js',
    ]) {
      try {
        await loadScript(file);
      } catch (error) {
        console.warn('[ATLAS v2] optional analytical surface failed to load', file, error);
      }
    }
  }

  async function mount() {
    const root = document.getElementById('atlas-v2-root');
    if (!root) throw new Error('ATLAS v2 root is missing');
    if (!window.AtlasV2Shell?.mount) throw new Error('ATLAS v2 shell failed to load');
    await installAnalyticalSurfaces();
    window.AtlasV2Shell.mount(root);
    window.dispatchEvent(new CustomEvent('atlas:v2-shell-ready', { detail: { route: window.AtlasV2Shell.currentRoute?.().id || 'explorar' } }));
  }

  const start = () => { void mount().catch(error => console.error('[ATLAS v2] boot failed', error)); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();