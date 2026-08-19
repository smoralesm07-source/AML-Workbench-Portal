const APP_SELECTOR = '#app';
const LOGIN_SELECTOR = '#login';
const RETRY_COOLDOWN_MS = 1400;
const SESSION_RECHECK_MS = 700;

let recovering = false;
let lastRecovery = 0;
let explicitLogout = false;

function now() { return Date.now(); }
function iso() { return new Date().toISOString(); }
function appNode() { return document.querySelector(APP_SELECTOR); }
function loginVisible() { return !!document.querySelector(LOGIN_SELECTOR); }
function shellVisible() { return !!document.querySelector(`${APP_SELECTOR} .shell`); }
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function health(stage, extra = {}) {
  window.__ATLAS_SESSION_STABILITY__ = { active:true, stage, at:iso(), ...extra };
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

async function currentSession() {
  try {
    return (await window.sb?.auth?.getSession?.())?.data?.session || null;
  } catch (_error) {
    return null;
  }
}

async function recoverFalseLoginTransition(reason = 'login-card-detected') {
  if (recovering || shellVisible() || !loginVisible() || explicitLogout) return;
  if (now() - lastRecovery < RETRY_COOLDOWN_MS) return;
  recovering = true;
  lastRecovery = now();
  health('checking-current-session', { reason });
  try {
    let session = await currentSession();
    if (!session) {
      await sleep(SESSION_RECHECK_MS);
      session = await currentSession();
    }
    if (!session) {
      health('no-current-session', { reason });
      return;
    }
    const rescue = window.AtlasAuthBootstrap;
    if (!rescue || typeof rescue.retry !== 'function') {
      health('session-present-rescue-unavailable', { reason, userId:session.user?.id || null });
      return;
    }
    health('restoring-authenticated-shell', { reason, userId:session.user?.id || null });
    await rescue.retry();
    installEntityAuthority();
  } catch (error) {
    health('recovery-failed', { reason, error:String(error?.message || error) });
  } finally {
    recovering = false;
  }
}

/* Refresh-token lifecycle belongs exclusively to the Supabase client.
   This module never copies, replays, restores, or manually submits refresh tokens. */
document.addEventListener('click', event => {
  if (event.target?.closest?.('#logout')) {
    explicitLogout = true;
    health('explicit-logout');
  }
}, true);

if (window.sb?.auth?.onAuthStateChange) {
  window.sb.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
      explicitLogout = false;
      health('auth-session-active', { event, userId:session?.user?.id || null });
    }
    if (event === 'SIGNED_OUT' && !explicitLogout) {
      setTimeout(() => void recoverFalseLoginTransition('auth-signed-out-event'), 120);
    }
  });
}

installEntityAuthority();

const target = appNode();
if (target) {
  let timer = null;
  const observer = new MutationObserver(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      installEntityAuthority();
      if (loginVisible() && !shellVisible()) void recoverFalseLoginTransition();
    }, 60);
  });
  observer.observe(target, { childList:true, subtree:false });
  window.addEventListener('beforeunload', () => observer.disconnect(), { once:true });
  if (loginVisible() && !shellVisible()) void recoverFalseLoginTransition('module-start');
}

window.__ATLAS_RUNTIME_RELIABILITY__ = {
  active:true,
  releaseGuard:'NO_ACTIVE_SESSION_RELOAD',
  authGuard:'SUPABASE_SESSION_SOURCE_OF_TRUTH+DOUBLE_LOCAL_RECHECK',
  refreshTokenPolicy:'SUPABASE_CLIENT_ONLY_NO_MANUAL_REPLAY',
  entityAuthority:'V0391_ENTRY+V038_ENTITY360',
  installedAt:iso()
};
