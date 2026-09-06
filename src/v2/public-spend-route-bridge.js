'use strict';
// ATLAS Architecture v2 · public-spend route bridge · non-invasive navigation authority.

(function installAtlasV2PublicSpendRouteBridge(global) {
  const ACTIVE = global.__ATLAS_V2_PREVIEW_MODE__ === 'public-spend' || new URLSearchParams(location.search).get('atlasv2') === 'public-spend';
  if (!ACTIVE) return;

  const VIEW = 'public-spend';
  let opening = false;

  function publish(status, extra = {}) {
    global.__ATLAS_V2_PUBLIC_SPEND_ROUTE_BRIDGE__ = {
      status,
      mode: 'v2-preview',
      view: VIEW,
      opening,
      navigationPolicy: 'CAPTURE_ONLY_NO_GLOBAL_NAVIGATE_WRAP',
      navigateWrapped: false,
      deterministicAuthority: true,
      compatibilityFacade: !!global.AtlasPublicSpendV2?.__atlasV2PublicSpendFacade,
      checkedAt: new Date().toISOString(),
      ...extra,
    };
  }

  async function open(source = 'route-bridge', force = false) {
    if (opening) return false;
    const adapter = global.AtlasV2PublicSpendAdapter;
    if (!adapter?.open) {
      publish('adapter-missing', { source });
      return false;
    }
    opening = true;
    publish('opening', { source });
    try {
      const ok = await adapter.open(!!force);
      publish(ok === false ? 'open-incomplete' : 'ready', { source });
      return ok;
    } catch (error) {
      publish('error', { source, error: String(error?.message || error) });
      throw error;
    } finally {
      opening = false;
    }
  }

  function installCompatibilityFacade() {
    const facade = Object.freeze({
      version: 'ARCHITECTURE_V2',
      authority: 'ATLAS_V2_PUBLIC_SPEND',
      __atlasV2PublicSpendFacade: true,
      open: force => open('AtlasPublicSpendV2.open', !!force),
      load: force => open('AtlasPublicSpendV2.load', !!force),
      health: () => global.__ATLAS_V2_PUBLIC_SPEND_ADAPTER__ || null,
      state: () => global.AtlasV2PublicSpendAdapter?.state || null,
    });
    try {
      global.AtlasPublicSpendV2 = facade;
      if (global.AtlasPublicSpendV2 !== facade) throw new Error('AtlasPublicSpendV2 compatibility facade assignment was rejected');
      return true;
    } catch (error) {
      publish('compatibility-facade-error', { error: String(error?.message || error) });
      return false;
    }
  }

  /* v2 owns the public-spend UI route without owning window.navigate.
     The previous accessor/watchdog design could capture wrappers installed by
     RES/session-stability and create a cycle (bridge -> wrapper -> bridge),
     producing Maximum call stack size exceeded on unrelated routes and a 200ms
     watchdog tax. Capture-phase routing keeps Gasto Público deterministic while
     leaving the shell's canonical navigation chain untouched. */
  global.addEventListener('click', event => {
    const target = event.target?.closest?.('[data-view="public-spend"],[data-atlas-mobile-view="public-spend"]');
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void open('window-capture-click').catch(() => {});
  }, true);

  installCompatibilityFacade();
  global.AtlasV2PublicSpendRouteBridge = Object.freeze({
    open,
    installNavigate: () => true,
    health: () => global.__ATLAS_V2_PUBLIC_SPEND_ROUTE_BRIDGE__ || null,
  });
  publish('installed');
})(window);
