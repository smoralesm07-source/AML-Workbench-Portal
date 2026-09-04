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
 * Entity 360 chain. 0.51.1 additionally preserves the Personas y control route
 * after the final deferred navigation pin is installed.
 *
 * 2026-09-04 FINAL_CLEAN_ENTITY_ENTRY:
 * The Entidades menu is a fresh-search boundary. A previously opened Entity 360
 * must never survive a new navigation to `entities`, regardless of which route
 * opened the dossier (Universo SO, search, direct entity open, etc.). This final
 * module therefore clears the selected entity, the detached autocomplete host,
 * the previous dossier DOM, query text and suggestions before delegating to the
 * governed entry loader, and clears the historical empty dossier afterwards so
 * the analyst sees only a clean search surface until selecting another entity.
 */
let entityRenderAuthority = null;
const navigationDelegate = typeof window.navigate === 'function' ? window.navigate : null;

function entityContent() {
  try {
    if (typeof window.v019Content === 'function') return window.v019Content();
  } catch (_error) {}
  return document.querySelector('#content');
}

function clearEntityNavigationState() {
  try {
    if (typeof window.state === 'object' && window.state) {
      window.state.view = 'entities';
      window.state.selectedEntity = null;
    } else if (typeof state !== 'undefined' && state) {
      state.view = 'entities';
      state.selectedEntity = null;
    }
  } catch (_error) {}

  try { document.querySelector('#a47-entity-search-host')?.remove(); } catch (_error) {}

  const content = entityContent();
  if (content) {
    try { content.replaceChildren(); }
    catch (_error) { content.innerHTML = ''; }
  }

  /* Retire any stale visual markers left by an Entity 360 dossier. */
  try {
    document.querySelectorAll('[data-entity-id].active, [data-selected-entity="true"]')
      .forEach(node => {
        node.classList.remove('active');
        node.removeAttribute('data-selected-entity');
      });
  } catch (_error) {}
}

function normalizeCleanEntitySearch() {
  const content = entityContent();

  /* The 0.44.7 loader historically mounts an empty 360 dossier together with
     the search host. Entidades is intentionally search-only on fresh entry. */
  if (content) {
    try { content.replaceChildren(); }
    catch (_error) { content.innerHTML = ''; }
  }

  const host = document.querySelector('#a47-entity-search-host');
  if (host) {
    host.classList.remove('busy');

    const input = host.querySelector('#a47-entity-q');
    if (input) {
      input.value = '';
      input.disabled = false;
      input.removeAttribute('aria-activedescendant');
    }

    const status = host.querySelector('#a47-search-status');
    if (status) status.textContent = 'Escribe al menos 2 caracteres para recibir sugerencias.';

    const selected = host.querySelector('#a47-selected');
    if (selected) selected.innerHTML = '';

    const suggestions = host.querySelector('#a47-suggestions');
    if (suggestions) {
      suggestions.innerHTML = '';
      suggestions.hidden = true;
    }

    host.querySelector('.a47-combobox')?.setAttribute('aria-expanded', 'false');
    setTimeout(() => input?.focus(), 0);
  }

  try {
    window.__ATLAS_ENTITY360_CURRENT__ = {
      ...(window.__ATLAS_ENTITY360_CURRENT__ || {}),
      mode:'entities-clean-search-final',
      selectedEntity:null,
      cleanEntry:true,
      finalAuthority:true,
      renderedAt:iso()
    };
  } catch (_error) {}
}

function installEntityAuthority() {
  const entry = window.__ATLAS_ENTITY_ENTRY__;
  if (!entry || typeof entry.load !== 'function') {
    health('entity-authority-missing');
    return false;
  }

  /* Do not replace entry.load here. It remains the governed 0.44.8/0.44.7
     authority. The final global route wraps it with an idempotent clean-entry
     boundary, avoiding recursion when this module is re-pinned by its observer. */
  const stableLoad = async (...args) => {
    clearEntityNavigationState();
    const result = await entry.load(...args);
    normalizeCleanEntitySearch();
    return result;
  };
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
    entitiesFreshSearchBoundary:true,
    previousEntityClearedOnMenuEntry:true,
    finalCleanEntryAuthority:'FINAL_CLEAN_ENTITY_ENTRY',
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
  entityAuthority:'ENTITY360_REFERENCE_0445_SIX_LENSES+ENTITY360_INLINE_AUTOCOMPLETE_0447+ENTITY360_ROUTE_AUTHORITY_0448+ENTITY360_SII_DOCUMENT_AUTH_0449+FINAL_CLEAN_ENTITY_ENTRY',
  entityWorkspace:'SINGLE_DARK_DOSSIER+PERSISTENT_RLS_AUTOCOMPLETE+CURRENT_ENTITIES_ROUTE+SII_DOCUMENT_AUTHORIZATION_CONTEXT+CLEAN_SEARCH_ON_MENU_ENTRY',
  pepDiscoveryRoute:'PRESERVED_BY_FINAL_NAVIGATION_AUTHORITY',
  installedAt:iso()
};

health('installed-entity360-final-clean-entry-authority');
