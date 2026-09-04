const APP_SELECTOR = '#app';
const HISTORY_VARIANT = 'HISTORY_INTELLIGENCE_ATLAS_V1';
const ADVANCED_ENTITY_PATCH = 'ADVANCED_ENTITY_EXPLORER_PRESERVED_20260904';

function iso() { return new Date().toISOString(); }
function appNode() { return document.querySelector(APP_SELECTOR); }

function health(stage, extra = {}) {
  window.__ATLAS_SESSION_STABILITY__ = {
    active:true,
    stage,
    authMutation:false,
    refreshTokenReplay:false,
    entityRendererMutation:'HISTORY_ONLY_FINAL_GUARD',
    advancedEntityExplorer:true,
    digitalIdentityExplorer:true,
    at:iso(),
    ...extra
  };
}

/*
 * Final runtime/session authority.
 *
 * Auth-passive: never mutates Supabase sessions or replays refresh tokens.
 * Entity 360 visual authority remains HISTORY_INTELLIGENCE_ATLAS_V1.
 *
 * 2026-09-04 correction:
 * The previous fresh-entry normalizer unconditionally emptied #content after
 * ENTRY.load(). That destroyed the 0512 Entidades explorer (and therefore the
 * Entidad | Identidad digital selector) and left the older 0447 search surface.
 * Fresh entry now clears the prior dossier BEFORE load and preserves a live
 * .aex AFTER load. Only stale Entity 360 dossier nodes are removed.
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

function allKnownStates() {
  const rows = [];
  try { if (typeof state !== 'undefined' && state) rows.push(state); } catch (_error) {}
  try { if (window.state) rows.push(window.state); } catch (_error) {}
  try { if (window.amlState) rows.push(window.amlState); } catch (_error) {}
  return [...new Set(rows.filter(Boolean))];
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
  return !!host && host.isConnected && host.dataset?.e360Variant === HISTORY_VARIANT &&
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
  const s = canonicalState();
  if (!s || !['entities','entity','entity360'].includes(String(s.view || ''))) return;
  const legacy = window.amlState;
  if (legacy && legacy !== s) {
    try { legacy.view = s.view; legacy.selectedEntity = id; } catch (_error) {}
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
  if (hostIsCurrent(existing, id)) { cachedHistoryHost = existing; return true; }
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
  healTimer = setTimeout(() => requestAnimationFrame(() => { void healHistory(reason); }), delay);
}

function getEntityRenderer() {
  try { if (typeof v0203RenderEntity === 'function') return v0203RenderEntity; } catch (_error) {}
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
  for (const s of allKnownStates()) {
    try { s.view = 'entities'; s.selectedEntity = null; } catch (_error) {}
    try { if ('entityId' in s) s.entityId = null; } catch (_error) {}
    try { if ('selectedEntityId' in s) s.selectedEntityId = null; } catch (_error) {}
  }
  try { document.querySelector('#a47-entity-search-host')?.remove(); } catch (_error) {}
  const content = entityContent();
  if (content) {
    try { content.replaceChildren(); }
    catch (_error) { content.innerHTML = ''; }
  }
  cachedHistoryHost = null;
  try {
    document.querySelectorAll('[data-entity-id].active, [data-selected-entity="true"]')
      .forEach(node => { node.classList.remove('active'); node.removeAttribute('data-selected-entity'); });
  } catch (_error) {}
}

function removeStaleDossiers(content) {
  if (!content) return;
  content.querySelectorAll('#atlas-entity360-executive,.a45,.aed-dossier,.v0203-entity,.v038-entity,[data-entity360]')
    .forEach(node => { if (!node.closest('.aex')) node.remove(); });
}

function normalizeAdvancedExplorer(advanced) {
  if (!advanced) return false;
  removeStaleDossiers(entityContent());
  document.querySelector('#a47-entity-search-host')?.remove();
  const input = advanced.querySelector('#aex-q');
  const suggest = advanced.querySelector('#aex-suggest');
  if (suggest) { suggest.innerHTML = ''; suggest.classList.remove('open'); }
  if (input) {
    input.disabled = false;
    input.removeAttribute('aria-activedescendant');
    setTimeout(() => input.focus(), 0);
  }
  return true;
}

function normalizeLegacySearchFallback() {
  const content = entityContent();
  if (content) {
    try { content.replaceChildren(); }
    catch (_error) { content.innerHTML = ''; }
  }
  const host = document.querySelector('#a47-entity-search-host');
  if (!host) return false;
  host.classList.remove('busy');
  const input = host.querySelector('#a47-entity-q');
  if (input) { input.value = ''; input.disabled = false; input.removeAttribute('aria-activedescendant'); }
  const status = host.querySelector('#a47-search-status');
  if (status) status.textContent = 'Escribe al menos 2 caracteres para recibir sugerencias.';
  const selected = host.querySelector('#a47-selected'); if (selected) selected.innerHTML = '';
  const suggestions = host.querySelector('#a47-suggestions');
  if (suggestions) { suggestions.innerHTML = ''; suggestions.hidden = true; }
  host.querySelector('.a47-combobox')?.setAttribute('aria-expanded', 'false');
  setTimeout(() => input?.focus(), 0);
  return true;
}

function normalizeCleanEntitySearch() {
  const content = entityContent();
  const advanced = content?.querySelector?.('.aex') || null;
  const advancedPreserved = advanced ? normalizeAdvancedExplorer(advanced) : false;
  const legacyFallback = advancedPreserved ? false : normalizeLegacySearchFallback();

  try {
    window.__ATLAS_ENTITY360_CURRENT__ = {
      ...(window.__ATLAS_ENTITY360_CURRENT__ || {}),
      mode:advancedPreserved ? 'entities-advanced-explorer-final' : 'entities-clean-search-final',
      selectedEntity:null,
      entityId:null,
      cleanEntry:true,
      finalAuthority:true,
      advancedExplorerPreserved,
      digitalIdentityPreserved:advancedPreserved,
      patch:ADVANCED_ENTITY_PATCH,
      renderedAt:iso()
    };
  } catch (_error) {}

  window.__ATLAS_ENTITY_ENTRY_SURFACE__ = {
    advancedExplorer:advancedPreserved,
    legacyFallback,
    digitalIdentity:advancedPreserved && !!window.__ATLAS_DIGITAL_IDENTITY_0524__,
    updatedAt:iso()
  };
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
    authority:entry.authority || 'ENTITY_EXPLORER_CURRENT',
    release:entry.release || '0.51.1',
    version:entry.version || '0512',
    sixLensRendererPinned:false,
    legacyRendererPinRetired:true,
    historyVariant:HISTORY_VARIANT,
    historyFinalGuard:true,
    singleWorkspacePinned:false,
    landingPinned:true,
    advancedExplorerPinned:true,
    digitalIdentityPinned:!!window.__ATLAS_DIGITAL_IDENTITY_0524__,
    routePinned:true,
    entitiesFreshSearchBoundary:true,
    previousEntityClearedOnMenuEntry:true,
    finalCleanEntryAuthority:'FINAL_CLEAN_ENTITY_ENTRY_ADVANCED_PRESERVING',
    legacyCapturedLoaderBypassed:true,
    pepDiscoveryRoutePinned:typeof window.AtlasPepDiscovery?.open === 'function',
    searchPinned:!!stableSearch,
    autocompletePinned:true,
    siiDocumentAuthorizationPinned:typeof window.AtlasSiiDocumentAuthorization==='object',
    documentAuthorizationSemantic:'LATEST_OBSERVED_AUTHORIZATION_NOT_ABSOLUTE_LAST_TIMBRAJE',
    openPinned:!!stableOpen,
    patch:ADVANCED_ENTITY_PATCH,
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
  entityAuthority:'ENTITY360_HISTORY_INTELLIGENCE+ENTITY_EXPLORER_0512+DIGITAL_IDENTITY_0526+ENTITY360_ROUTE_AUTHORITY_0448+FINAL_ADVANCED_PRESERVING_GUARD',
  entityWorkspace:'ADVANCED_ENTITY_EXPLORER+ENTITY_OR_DIGITAL_IDENTITY_SEARCH+CURRENT_HISTORY_360+FRESH_ENTRY_WITHOUT_STALE_DOSSIER',
  legacyRendererPolicy:'NEVER_PIN_LEGACY_RENDERER+SELF_HEAL_TO_HISTORY_VARIANT',
  pepDiscoveryRoute:'PRESERVED_BY_FINAL_NAVIGATION_AUTHORITY',
  patch:ADVANCED_ENTITY_PATCH,
  installedAt:iso()
};

health('installed-entity360-history-and-advanced-explorer-final-guard');