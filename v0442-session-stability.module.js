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
 * session and never replays refresh tokens. It freezes the final Entity 360
 * authority only after every classic feature layer and deferred module has
 * finished. The 0.44.8 route pin bypasses the historical v019 closure, while
 * 0.44.9 keeps the governed SII document-authorization renderer in the final
 * Entity 360 chain. 0.51.1 additionally preserves the isolated Personas y
 * control analytical route instead of overwriting it after its classic script
 * has installed.
 */
let entityRenderAuthority = null;
const navigationDelegate = typeof window.navigate === 'function' ? window.navigate : null;

function installEntityAuthority() {
  const entry = window.__ATLAS_ENTITY_ENTRY__;
  if (!entry || typeof entry.load !== 'function') {
    health('entity-authority-missing');
    return false;
  }

  const stableLoad = async (...args) => entry.load(...args);
  const stableSearch = typeof entry.search === 'function' ? ((...args) => entry.search(...args)) : null;
  const stableOpen = typeof entry.open === 'function' ? ((...args) => entry.open(...args)) : null;
  const stableNavigate = async (view, ...args) => {
    if (view === 'entities') return stableLoad(...args);
    if (view === 'pep-discovery' && typeof window.AtlasPepDiscovery?.open === 'function') {
      return window.AtlasPepDiscovery.open(false);
    }
    if (navigationDelegate) return navigationDelegate(view, ...args);
  };

  /* At module evaluation time all classic runtime fragments have loaded. Capture
     the final renderer once so later shell navigation cannot restore a legacy
     white landing/detail renderer or remove the 0.44.9 tax context decorator. */
  if (!entityRenderAuthority && typeof window.v0203RenderEntity === 'function') {
    entityRenderAuthority = window.v0203RenderEntity;
  }

  window.loadEntities = stableLoad;
  window.navigate = stableNavigate;
  if (stableSearch) window.searchEntities = stableSearch;
  if (stableOpen) window.openEntity = stableOpen;
  if (entityRenderAuthority) window.v0203RenderEntity = entityRenderAuthority;

  try { loadEntities = stableLoad; } catch (_error) {}
  try { navigate = stableNavigate; } catch (_error) {}
  if (stableSearch) { try { searchEntities = stableSearch; } catch (_error) {} }
  if (stableOpen) { try { openEntity = stableOpen; } catch (_error) {} }
  if (entityRenderAuthority) { try { v0203RenderEntity = entityRenderAuthority; } catch (_error) {} }

  window.__ATLAS_ENTITY_AUTHORITY_FINAL__ = {
    active:true,
    authority:entry.authority || 'ENTITY360_INLINE_AUTOCOMPLETE_0447',
    release:entry.release || '0.44.9',
    version:entry.version || '0449',
    sixLensRendererPinned:!!entityRenderAuthority,
    singleWorkspacePinned:true,
    landingPinned:false,
    routePinned:true,
    legacyCapturedLoaderBypassed:true,
    pepDiscoveryRoutePinned:typeof window.AtlasPepDiscovery?.open === 'function',
    searchPinned:!!stableSearch,
    autocompletePinned:String(entry.searchPolicy||'').includes('AUTOCOMPLETE'),
    siiDocumentAuthorizationPinned:typeof window.AtlasSiiDocumentAuthorization==='object',
    documentAuthorizationSemantic:'LATEST_OBSERVED_AUTHORIZATION_NOT_ABSOLUTE_LAST_TIMBRAJE',
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
  entityAuthority:'ENTITY360_REFERENCE_0445_SIX_LENSES+ENTITY360_INLINE_AUTOCOMPLETE_0447+ENTITY360_ROUTE_AUTHORITY_0448+ENTITY360_SII_DOCUMENT_AUTH_0449',
  entityWorkspace:'SINGLE_DARK_DOSSIER+PERSISTENT_RLS_AUTOCOMPLETE+CURRENT_ENTITIES_ROUTE+SII_DOCUMENT_AUTHORIZATION_CONTEXT',
  pepDiscoveryRoute:'PRESERVED_BY_FINAL_NAVIGATION_AUTHORITY',
  installedAt:iso()
};

health('installed-entity360-0449-document-authorization-authority');
