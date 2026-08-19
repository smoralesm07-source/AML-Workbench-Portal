const APP_SELECTOR = '#app';

function iso() { return new Date().toISOString(); }
function appNode() { return document.querySelector(APP_SELECTOR); }

function health(stage, extra = {}) {
  window.__ATLAS_SESSION_STABILITY__ = {
    active:true,
    stage,
    authMutation:false,
    refreshTokenReplay:false,
    at:iso(),
    ...extra
  };
}

/*
 * Final runtime pin.
 * This module is intentionally auth-passive: it never mutates the Supabase
 * session and never replays refresh tokens. It only freezes the Entity 360
 * authority that is present after every classic feature layer has finished.
 */
let entityRenderAuthority = null;

function installEntityAuthority() {
  const entry = window.__ATLAS_ENTITY_ENTRY__;
  if (!entry || typeof entry.load !== 'function') {
    health('entity-authority-missing');
    return false;
  }

  const stableLoad = async (...args) => entry.load(...args);
  const stableSearch = typeof entry.search === 'function' ? ((...args) => entry.search(...args)) : null;
  const stableOpen = typeof entry.open === 'function' ? ((...args) => entry.open(...args)) : null;

  /* At module evaluation time all classic runtime fragments have loaded, so the
     current v0203 renderer is the 0.44.5 six-lens authority installed by v0391.
     Capture it once and re-pin it after shell mutations/navigation. */
  if (!entityRenderAuthority && typeof window.v0203RenderEntity === 'function') {
    entityRenderAuthority = window.v0203RenderEntity;
  }

  window.loadEntities = stableLoad;
  if (stableSearch) window.searchEntities = stableSearch;
  if (stableOpen) window.openEntity = stableOpen;
  if (entityRenderAuthority) window.v0203RenderEntity = entityRenderAuthority;

  try { loadEntities = stableLoad; } catch (_error) {}
  if (stableSearch) { try { searchEntities = stableSearch; } catch (_error) {} }
  if (stableOpen) { try { openEntity = stableOpen; } catch (_error) {} }
  if (entityRenderAuthority) { try { v0203RenderEntity = entityRenderAuthority; } catch (_error) {} }

  window.__ATLAS_ENTITY_AUTHORITY_FINAL__ = {
    active:true,
    authority:entry.authority || 'ENTITY360_REFERENCE_0445',
    release:entry.release || '0.44.5',
    version:entry.version || '0445',
    sixLensRendererPinned:!!entityRenderAuthority,
    landingPinned:true,
    searchPinned:!!stableSearch,
    openPinned:!!stableOpen,
    installedAt:iso()
  };
  return true;
}

installEntityAuthority();

const target = appNode();
if (target) {
  let timer = null;
  const observer = new MutationObserver(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => installEntityAuthority(), 80);
  });
  observer.observe(target, { childList:true, subtree:false });
  window.addEventListener('beforeunload', () => observer.disconnect(), { once:true });
}

window.__ATLAS_RUNTIME_RELIABILITY__ = {
  active:true,
  releaseGuard:'NO_ACTIVE_SESSION_RELOAD',
  authGuard:'PASSIVE_FINAL_MODULE',
  refreshTokenPolicy:'SUPABASE_CLIENT_ONLY_NO_MANUAL_REPLAY',
  entityAuthority:'ENTITY360_REFERENCE_0445_SIX_LENSES',
  installedAt:iso()
};

health('installed-entity360-0445-authority-only');
