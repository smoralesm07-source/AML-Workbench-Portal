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

function installEntityAuthority() {
  const entry = window.__ATLAS_ENTITY_ENTRY__;
  if (!entry || typeof entry.load !== 'function') {
    health('entity-authority-missing');
    return false;
  }
  const stableLoad = async (...args) => entry.load(...args);
  const stableSearch = typeof entry.search === 'function' ? ((...args) => entry.search(...args)) : null;
  window.loadEntities = stableLoad;
  if (stableSearch) window.searchEntities = stableSearch;
  try { loadEntities = stableLoad; } catch (_error) {}
  if (stableSearch) { try { searchEntities = stableSearch; } catch (_error) {} }
  window.__ATLAS_ENTITY_AUTHORITY_FINAL__ = {
    active:true,
    authority:'V0391_ENTRY+V038_ENTITY360',
    replacedSimplifiedSearchLanding:true,
    installedAt:iso()
  };
  return true;
}

/* Final module is intentionally auth-passive. Session lifecycle belongs only to
   the canonical Supabase client and the classic UI guard. This module exists to
   pin Entity 360 authority after all feature modules finish loading. */
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
  entityAuthority:'V0391_ENTRY+V038_ENTITY360',
  installedAt:iso()
};

health('installed-entity-authority-only');
