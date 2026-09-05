'use strict';

(function installAtlasV2PublicSpendRouteBridge(global) {
  const ACTIVE = global.__ATLAS_V2_PREVIEW_MODE__ === 'public-spend' || new URLSearchParams(location.search).get('atlasv2') === 'public-spend';
  if (!ACTIVE) return;

  const VIEW = 'public-spend';
  let delegatedNavigate = typeof global.navigate === 'function' ? global.navigate : null;
  let opening = false;
  let legacyAssignmentsBlocked = 0;

  function publish(status, extra = {}) {
    global.__ATLAS_V2_PUBLIC_SPEND_ROUTE_BRIDGE__ = {
      status,
      mode: 'v2-preview',
      view: VIEW,
      opening,
      navigateWrapped: !!global.navigate?.__atlasV2PublicSpendRouteBridge,
      deterministicAuthority: true,
      legacyAssignmentsBlocked,
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

  const wrapper = function atlasV2Navigate(view, ...args) {
    if (view === VIEW) return open('window.navigate');
    if (typeof delegatedNavigate !== 'function' || delegatedNavigate === wrapper) return false;
    return delegatedNavigate.call(this, view, ...args);
  };
  Object.defineProperty(wrapper, '__atlasV2PublicSpendRouteBridge', { value: true });

  function isLegacyPublicSpendWrapper(candidate) {
    return !!(
      candidate?.__atlasGpAuthority1300 ||
      candidate?.__atlasPublicSpendRouteAuthority ||
      candidate?.__atlasPublicSpendV2RouteAuthority
    );
  }

  function protectNavigate(source = 'install') {
    const descriptor = Object.getOwnPropertyDescriptor(global, 'navigate');
    if (descriptor?.get?.__atlasV2PublicSpendAccessor) {
      publish('authority-confirmed', { source });
      return true;
    }

    const current = global.navigate;
    if (typeof current === 'function' && current !== wrapper && !isLegacyPublicSpendWrapper(current)) delegatedNavigate = current;

    const getter = function atlasV2NavigateGetter() { return wrapper; };
    Object.defineProperty(getter, '__atlasV2PublicSpendAccessor', { value: true });
    try {
      Object.defineProperty(global, 'navigate', {
        configurable: true,
        enumerable: true,
        get: getter,
        set(candidate) {
          if (candidate === wrapper) return;
          if (isLegacyPublicSpendWrapper(candidate)) {
            legacyAssignmentsBlocked += 1;
            publish('legacy-authority-blocked', { source: 'navigate-setter', legacyAssignmentsBlocked });
            return;
          }
          if (typeof candidate === 'function') delegatedNavigate = candidate;
        },
      });
      publish('authority-installed', { source });
      return true;
    } catch (error) {
      publish('authority-install-error', { source, error: String(error?.message || error) });
      return false;
    }
  }

  /* The preview is a deterministic cutover simulation. It owns only the
     public-spend route. Legacy public-spend navigate wrappers are rejected by
     the accessor above, while every non-public-spend route is delegated to the
     latest core navigate function assigned by ATLAS. */
  global.addEventListener('click', event => {
    const target = event.target?.closest?.('[data-view="public-spend"],[data-atlas-mobile-view="public-spend"]');
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void open('window-capture-click').catch(() => {});
  }, true);

  ['pageshow', 'atlas:nav-refresh', 'atlas:v2-public-spend-adapter-ready'].forEach(name => {
    global.addEventListener(name, () => protectNavigate(name));
  });

  protectNavigate('initial');
  [0, 120, 400, 1200].forEach(ms => setTimeout(() => protectNavigate(`deferred-${ms}`), ms));

  global.AtlasV2PublicSpendRouteBridge = Object.freeze({
    open,
    installNavigate: protectNavigate,
    health: () => global.__ATLAS_V2_PUBLIC_SPEND_ROUTE_BRIDGE__ || null,
  });
  publish('installed');
})(window);
