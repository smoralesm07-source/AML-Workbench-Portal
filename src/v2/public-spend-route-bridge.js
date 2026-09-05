'use strict';
// Gate trace: full legacy-owner retirement + descriptor-safe canonical route takeover.

(function installAtlasV2PublicSpendRouteBridge(global) {
  const ACTIVE = global.__ATLAS_V2_PREVIEW_MODE__ === 'public-spend' || new URLSearchParams(location.search).get('atlasv2') === 'public-spend';
  if (!ACTIVE) return;

  const VIEW = 'public-spend';
  const WATCHDOG_MS = 200;
  let delegatedNavigate = typeof global.navigate === 'function' ? global.navigate : null;
  let opening = false;
  let legacyAssignmentsBlocked = 0;
  let navigateInstallMode = 'pending';
  let watchdogReclaims = 0;
  let watchdogId = null;

  function navigateDescriptor() {
    const descriptor = Object.getOwnPropertyDescriptor(global, 'navigate');
    if (!descriptor) return { exists: false };
    return {
      exists: true,
      configurable: !!descriptor.configurable,
      enumerable: !!descriptor.enumerable,
      writable: Object.prototype.hasOwnProperty.call(descriptor, 'writable') ? !!descriptor.writable : null,
      hasGetter: typeof descriptor.get === 'function',
      hasSetter: typeof descriptor.set === 'function',
    };
  }

  function publish(status, extra = {}) {
    global.__ATLAS_V2_PUBLIC_SPEND_ROUTE_BRIDGE__ = {
      status,
      mode: 'v2-preview',
      view: VIEW,
      opening,
      navigateWrapped: !!global.navigate?.__atlasV2PublicSpendRouteBridge,
      navigateInstallMode,
      navigateDescriptor: navigateDescriptor(),
      deterministicAuthority: true,
      compatibilityFacade: !!global.AtlasPublicSpendV2?.__atlasV2PublicSpendFacade,
      legacyAssignmentsBlocked,
      watchdogMs: WATCHDOG_MS,
      watchdogReclaims,
      watchdogActive: watchdogId !== null,
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

  function installAccessor(descriptor, source) {
    const getter = function atlasV2NavigateGetter() { return wrapper; };
    Object.defineProperty(getter, '__atlasV2PublicSpendAccessor', { value: true });
    Object.defineProperty(global, 'navigate', {
      configurable: true,
      enumerable: descriptor?.enumerable ?? true,
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
    navigateInstallMode = 'configurable-accessor';
  }

  function installByAssignment(descriptor) {
    if (descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'writable') && descriptor.writable !== true) return false;
    global.navigate = wrapper;
    if (global.navigate !== wrapper) return false;
    navigateInstallMode = descriptor?.configurable === false ? 'nonconfigurable-writable-assignment' : 'direct-assignment';
    return true;
  }

  function installThroughSetter(descriptor) {
    if (typeof descriptor?.set !== 'function') return false;
    global.navigate = wrapper;
    if (global.navigate !== wrapper) return false;
    navigateInstallMode = 'nonconfigurable-setter-assignment';
    return true;
  }

  function protectNavigate(source = 'install') {
    const descriptor = Object.getOwnPropertyDescriptor(global, 'navigate');
    if (descriptor?.get?.__atlasV2PublicSpendAccessor || global.navigate === wrapper) {
      publish('authority-confirmed', { source });
      return true;
    }

    const current = global.navigate;
    if (typeof current === 'function' && current !== wrapper && !isLegacyPublicSpendWrapper(current)) delegatedNavigate = current;

    try {
      if (!descriptor || descriptor.configurable) {
        installAccessor(descriptor, source);
      } else if (Object.prototype.hasOwnProperty.call(descriptor, 'writable') && descriptor.writable) {
        if (!installByAssignment(descriptor)) throw new Error('non-configurable writable navigate rejected assignment');
      } else if (descriptor.set) {
        if (!installThroughSetter(descriptor)) throw new Error('non-configurable navigate setter rejected assignment');
      } else {
        throw new Error('navigate is non-configurable and cannot be reassigned');
      }
      publish('authority-installed', { source });
      return true;
    } catch (error) {
      navigateInstallMode = 'failed';
      publish('authority-install-error', { source, error: String(error?.message || error) });
      return false;
    }
  }

  function ensureNavigateAuthority(source = 'watchdog') {
    if (global.navigate?.__atlasV2PublicSpendRouteBridge) return true;
    const before = global.navigate;
    const ok = protectNavigate(source);
    if (ok && before !== wrapper && global.navigate === wrapper) {
      watchdogReclaims += 1;
      publish('authority-reclaimed', { source, watchdogReclaims });
    }
    return ok;
  }

  function startAuthorityWatchdog() {
    if (watchdogId !== null) return;
    watchdogId = global.setInterval(() => {
      if (global.navigate?.__atlasV2PublicSpendRouteBridge) return;
      ensureNavigateAuthority('watchdog');
    }, WATCHDOG_MS);
    publish('watchdog-started');
  }

  /* Architecture v2 owns only the public-spend route. UI clicks are intercepted
     at window capture before the canonical document router. Programmatic calls
     retain the canonical global navigate contract: configurable properties use
     a guarded accessor, while the shell's non-configurable+writable function is
     reclaimed by assignment if shell hydration refreshes it. Every non-public-
     spend view continues to delegate to the latest canonical router captured. */
  global.addEventListener('click', event => {
    const target = event.target?.closest?.('[data-view="public-spend"],[data-atlas-mobile-view="public-spend"]');
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    ensureNavigateAuthority('window-capture-click');
    void open('window-capture-click').catch(() => {});
  }, true);

  function protectAfterDispatch(name) {
    ensureNavigateAuthority(`${name}:sync`);
    const run = () => ensureNavigateAuthority(`${name}:post-dispatch`);
    if (typeof global.queueMicrotask === 'function') global.queueMicrotask(run);
    else Promise.resolve().then(run);
  }

  ['pageshow', 'focus', 'load', 'atlas:nav-refresh', 'atlas:v2-public-spend-adapter-ready'].forEach(name => {
    global.addEventListener(name, () => protectAfterDispatch(name));
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') protectAfterDispatch('visibilitychange');
  });

  installCompatibilityFacade();
  ensureNavigateAuthority('initial');
  [0, 120, 400, 1200, 2500, 5000].forEach(ms => setTimeout(() => ensureNavigateAuthority(`deferred-${ms}`), ms));
  startAuthorityWatchdog();

  global.AtlasV2PublicSpendRouteBridge = Object.freeze({
    open,
    installNavigate: ensureNavigateAuthority,
    health: () => global.__ATLAS_V2_PUBLIC_SPEND_ROUTE_BRIDGE__ || null,
  });
  publish('installed');
})(window);