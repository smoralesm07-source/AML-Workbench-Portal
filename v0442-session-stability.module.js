const APP_SELECTOR = '#app';
const HISTORY_VARIANT = 'HISTORY_INTELLIGENCE_ATLAS_V1';

function iso() { return new Date().toISOString(); }
function appNode() { return document.querySelector(APP_SELECTOR); }

function health(stage, extra = {}) {
  window.__ATLAS_SESSION_STABILITY__ = {
    active:true,
    stage,
    authMutation:false,
    refreshTokenReplay:false,
    entityRendererMutation:'HISTORY_ONLY_FINAL_GUARD',
    at:iso(),
    ...extra
  };
}

/*
 * Final runtime/session authority.
 *
 * This module is auth-passive: it never mutates the Supabase session and never
 * replays refresh tokens. Since 0.96.2 it also DOES NOT pin a historical
 * v0203RenderEntity function. The previous renderer pin could execute after the
 * current Historia Inteligente 360 had already mounted and repaint the legacy
 * dossier, which is exactly the visible "current -> old" regression.
 *
 * The only Entity 360 visual authority allowed here is
 * HISTORY_INTELLIGENCE_ATLAS_V1. Legacy/base renderers may still run as internal
 * workspace helpers, but every such render is immediately reconciled back to
 * the current history surface.
 */
const navigationDelegate = typeof window.navigate === 'function' ? window.navigate : null;
let cachedHistoryHost = null;
let healTimer = null;
let healing = false;

function entityContent() {
  try {
    if (typeof window.v019Content === 'function') return window.v019Content();
  } catch (_error) {}
  return document.querySelector('#content');
}

function canonicalState() {
  try {
    if (typeof state !== 'undefined' && state) return state;
  } catch (_error) {}
  if (window.state) return window.state;
  return window.amlState || null;
}

function selectedEntityId() {
  const s = canonicalState();
  return s?.selectedEntity ||
    window.__ATLAS_ENTITY360_CURRENT__?.entityId ||
    window.__ATLAS_ENTITY360_CURRENT__?.selectedEntity ||
    null;
}

function currentView() {
  return String(canonicalState()?.view || '');
}

function entitySurfaceVisible() {
  const id = selectedEntityId();
  if (!id) return false;
  const view = currentView();
  if (['entities','entity','entity360'].includes(view)) return true;
  const content = entityContent();
  return !!content?.querySelector?.('.a45, .aed-dossier, .v0203-entity, .v038-entity, #atlas-entity360-executive');
}

function historyApi() {
  const api = window.__ATLAS_ENTITY360_EXECUTIVE__;
  return api?.active && api?.variant === HISTORY_VARIANT && typeof api.open === 'function' ? api : null;
}

function historyHost() {
  return document.querySelector('#atlas-entity360-executive');
}

function hostIsCurrent(host, id = selectedEntityId()) {
  return !!host &&
    host.isConnected &&
    host.dataset?.e360Variant === HISTORY_VARIANT &&
    (!id || String(host.dataset?.entityId || '') === String(id));
}

function entityRoot() {
  const content = entityContent();
  return content?.querySelector?.('.a45') ||
    content?.querySelector?.('.aed-dossier') ||
    content?.querySelector?.('.v0203-entity') ||
    content?.querySelector?.('.v038-entity') ||
    content || null;
}

function syncHistoryCompatibilityState(id) {
  /* Historia 360 0.72 historically checked window.amlState before the canonical
     lexical state. Keep the compatibility mirror aligned only while the
     canonical route is an entity route; this is UI navigation state only. */
  const s = canonicalState();
  if (!s || !['entities','entity','entity360'].includes(String(s.view || ''))) return;
  const legacy = window.amlState;
  if (legacy && legacy !== s) {
    try {
      legacy.view = s.view;
      legacy.selectedEntity = id;
    } catch (_error) {}
  }
}

function restoreCachedHistoryHost(id) {
  if (!cachedHistoryHost || String(cachedHistoryHost.dataset?.entityId || '') !== String(id)) return false;
  const root = entityRoot();
  if (!root) return false;
  const stale = root.querySelector?.('#atlas-entity360-executive');
  if (stale && stale !== cachedHistoryHost) stale.remove();
  if (!cachedHistoryHost.isConnected) root.insertBefore(cachedHistoryHost, root.firstChild || null);
  return cachedHistoryHost.isConnected;
}

async function healHistory(reason = 'mutation') {
  if (healing || !entitySurfaceVisible()) return false;
  const id = selectedEntityId();
  if (!id) return false;

  const existing = historyHost();
  if (hostIsCurrent(existing, id)) {
    cachedHistoryHost = existing;
    return true;
  }

  syncHistoryCompatibilityState(id);
  restoreCachedHistoryHost(id);

  const api = historyApi();
  if (!api) return false;

  healing = true;
  try {
    api.hookEntry?.();
    await api.open(String(id), { entity_id:String(id), source:`final-session-guard:${reason}` });
    const mounted = historyHost();
    if (hostIsCurrent(mounted, id)) cachedHistoryHost = mounted;
    return hostIsCurrent(mounted, id);
  } catch (_error) {
    return false;
  } finally {
    healing = false;
  }
}

function scheduleHistoryHeal(reason = 'mutation', delay = 0) {
  if (!entitySurfaceVisible()) return;
  if (healTimer) clearTimeout(healTimer);
  healTimer = setTimeout(() => {
    requestAnimationFrame(() => { void healHistory(reason); });
  }, delay);
}

function getEntityRenderer() {
  try {
    if (typeof v0203RenderEntity === 'function') return v0203RenderEntity;
  } catch (_error) {}
  return typeof window.v0203RenderEntity === 'function' ? window.v0203RenderEntity : null;
}

function setEntityRenderer(fn) {
  if (typeof fn !== 'function') return;
  window.v0203RenderEntity = fn;
  try { v0203RenderEntity = fn; } catch (_error) {}
}

function installEntityRendererGuard() {
  const renderer = getEntityRenderer();
  if (!renderer || renderer.__atlasHistoryFinalGuard === HISTORY_VARIANT) return !!renderer;

  const guarded = function atlasHistoryFinalRendererGuard(...args) {
    const idBefore = selectedEntityId();
    const current = historyHost();
    if (hostIsCurrent(current, idBefore)) cachedHistoryHost = current;

    const result = renderer.apply(this, args);

    const entity = args[0];
    const id = entity?.entity_id || selectedEntityId() || idBefore;
    if (id && entitySurfaceVisible()) {
      syncHistoryCompatibilityState(id);
      restoreCachedHistoryHost(id);
      queueMicrotask(() => scheduleHistoryHeal('legacy-render', 0));
    }
    return result;
  };
  guarded.__atlasHistoryFinalGuard = HISTORY_VARIANT;
  guarded.__atlasHistoryBaseRenderer = renderer;
  setEntityRenderer(guarded);
  return true;
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

  cachedHistoryHost = null;

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
      entityId:null,
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

  const stableLoad = async (...args) => {
    clearEntityNavigationState();
    const result = await entry.load(...args);
    normalizeCleanEntitySearch();
    return result;
  };
  const stableSearch = typeof entry.search === 'function' ? ((...args) => entry.search(...args)) : null;
  const stableOpen = typeof entry.open === 'function' ? (async (...args) => {
    const result = await entry.open(...args);
    installEntityRendererGuard();
    scheduleHistoryHeal('entry-open', 0);
    return result;
  }) : null;
  const stableNavigate = async (view, ...args) => {
    if (view === 'entities') return stableLoad(...args);
    if (view === 'pep-discovery' && typeof window.AtlasPepDiscovery?.open === 'function') {
      return window.AtlasPepDiscovery.open(false);
    }
    if (navigationDelegate) return navigationDelegate(view, ...args);
  };

  window.loadEntities = stableLoad;
  window.navigate = stableNavigate;
  if (stableSearch) window.searchEntities = stableSearch;
  if (stableOpen) window.openEntity = stableOpen;

  try { loadEntities = stableLoad; } catch (_error) {}
  try { navigate = stableNavigate; } catch (_error) {}
  if (stableSearch) { try { searchEntities = stableSearch; } catch (_error) {} }
  if (stableOpen) { try { openEntity = stableOpen; } catch (_error) {} }

  installEntityRendererGuard();
  window.__ATLAS_ENTITY360_EXECUTIVE__?.hookEntry?.();
  scheduleHistoryHeal('authority-install', 0);

  window.__ATLAS_ENTITY_AUTHORITY_FINAL__ = {
    active:true,
    authority:entry.authority || 'ENTITY360_INLINE_AUTOCOMPLETE_0447',
    release:entry.release || '0.44.9',
    version:entry.version || '0449',
    sixLensRendererPinned:false,
    legacyRendererPinRetired:true,
    historyVariant:HISTORY_VARIANT,
    historyFinalGuard:true,
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
    timer = setTimeout(() => {
      installEntityAuthority();
      installEntityRendererGuard();
      const id = selectedEntityId();
      const host = historyHost();
      if (hostIsCurrent(host, id)) cachedHistoryHost = host;
      else scheduleHistoryHeal('dom-repaint', 0);
    }, 20);
  });
  observer.observe(target, { childList:true, subtree:true });
  window.addEventListener('beforeunload', () => observer.disconnect(), { once:true });
}

document.addEventListener('atlas:entity-workspace-ready', () => {
  installEntityRendererGuard();
  scheduleHistoryHeal('workspace-ready', 0);
});
document.addEventListener('atlas:entity-entry-ready', () => {
  installEntityAuthority();
  scheduleHistoryHeal('entry-ready', 0);
});
window.addEventListener('load', () => scheduleHistoryHeal('window-load', 0), { once:true });

window.__ATLAS_RUNTIME_RELIABILITY__ = {
  active:true,
  releaseGuard:'NO_ACTIVE_SESSION_RELOAD',
  authGuard:'PASSIVE_FINAL_MODULE',
  refreshTokenPolicy:'SUPABASE_CLIENT_ONLY_NO_MANUAL_REPLAY',
  entityAuthority:'ENTITY360_HISTORY_INTELLIGENCE+ENTITY360_INLINE_AUTOCOMPLETE_0447+ENTITY360_ROUTE_AUTHORITY_0448+ENTITY360_SII_DOCUMENT_AUTH_0449+FINAL_CLEAN_ENTITY_ENTRY+HISTORY_FINAL_RENDER_GUARD',
  entityWorkspace:'SINGLE_DARK_DOSSIER+PERSISTENT_RLS_AUTOCOMPLETE+CURRENT_HISTORY_ONLY+SII_DOCUMENT_AUTHORIZATION_CONTEXT+CLEAN_SEARCH_ON_MENU_ENTRY',
  legacyRendererPolicy:'NEVER_PIN_LEGACY_RENDERER+SELF_HEAL_TO_HISTORY_VARIANT',
  pepDiscoveryRoute:'PRESERVED_BY_FINAL_NAVIGATION_AUTHORITY',
  installedAt:iso()
};

health('installed-entity360-history-final-render-guard');
