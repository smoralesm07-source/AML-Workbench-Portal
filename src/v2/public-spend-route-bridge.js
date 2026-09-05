'use strict';

(function installAtlasV2PublicSpendRouteBridge(global) {
  const ACTIVE = global.__ATLAS_V2_PREVIEW_MODE__ === 'public-spend' || new URLSearchParams(location.search).get('atlasv2') === 'public-spend';
  if (!ACTIVE) return;

  const VIEW = 'public-spend';
  let delegatedNavigate = null;
  let opening = false;

  function publish(status, extra = {}) {
    global.__ATLAS_V2_PUBLIC_SPEND_ROUTE_BRIDGE__ = {
      status,
      mode: 'v2-preview',
      view: VIEW,
      opening,
      navigateWrapped: !!global.navigate?.__atlasV2PublicSpendRouteBridge,
      checkedAt: new Date().toISOString(),
      ...extra,
    };
  }

  async function open(source = 'route-bridge') {
    if (opening) return false;
    const adapter = global.AtlasV2PublicSpendAdapter;
    if (!adapter?.open) {
      publish('adapter-missing', { source });
      return false;
    }
    opening = true;
    publish('opening', { source });
    try {
      const ok = await adapter.open();
      publish(ok === false ? 'open-incomplete' : 'ready', { source });
      return ok;
    } catch (error) {
      publish('error', { source, error: String(error?.message || error) });
      throw error;
    } finally {
      opening = false;
    }
  }

  function installNavigate(source = 'install') {
    const current = global.navigate;
    if (typeof current !== 'function') {
      publish('navigate-missing', { source });
      return false;
    }
    if (current.__atlasV2PublicSpendRouteBridge) {
      publish('authority-confirmed', { source });
      return true;
    }
    delegatedNavigate = current;
    const wrapper = function atlasV2Navigate(view, ...args) {
      if (view === VIEW) return open('window.navigate');
      return delegatedNavigate.call(this, view, ...args);
    };
    Object.defineProperty(wrapper, '__atlasV2PublicSpendRouteBridge', { value: true });
    global.navigate = wrapper;
    publish('authority-installed', { source });
    return true;
  }

  /* Window capture is intentional. The legacy Gasto Público authority also owns
     a window-capture listener; this bridge is mounted earlier in the isolated
     v2 preview so it becomes the sole route authority for public-spend there. */
  global.addEventListener('click', event => {
    const target = event.target?.closest?.('[data-view="public-spend"],[data-atlas-mobile-view="public-spend"]');
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void open('window-capture-click').catch(() => {});
  }, true);

  ['pageshow', 'atlas:nav-refresh', 'atlas:v2-public-spend-adapter-ready'].forEach(name => {
    global.addEventListener(name, () => installNavigate(name));
  });
  [0, 120, 400, 1200].forEach(ms => setTimeout(() => installNavigate(`deferred-${ms}`), ms));

  global.AtlasV2PublicSpendRouteBridge = Object.freeze({ open, installNavigate, health: () => global.__ATLAS_V2_PUBLIC_SPEND_ROUTE_BRIDGE__ || null });
  publish('installed');
})(window);
