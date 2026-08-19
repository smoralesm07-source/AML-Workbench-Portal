const APP_SELECTOR = '#app';
const LOGIN_SELECTOR = '#login';
const RETRY_COOLDOWN_MS = 1200;
const SESSION_RECHECK_MS = 900;
const USER_VERIFY_TIMEOUT_MS = 4500;

let recovering = false;
let lastRecovery = 0;
let lastKnownSession = null;
let explicitLogout = false;

function now() { return Date.now(); }
function iso() { return new Date().toISOString(); }
function appNode() { return document.querySelector(APP_SELECTOR); }
function loginVisible() { return !!document.querySelector(LOGIN_SELECTOR); }
function shellVisible() { return !!document.querySelector(`${APP_SELECTOR} .shell`); }
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function health(stage, extra = {}) {
  window.__ATLAS_SESSION_SHELL_GUARD__ = { active:true, stage, at:iso(), ...extra };
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

async function captureSession() {
  try {
    const session = (await window.sb?.auth?.getSession?.())?.data?.session || null;
    if (session?.access_token) lastKnownSession = session;
    return session;
  } catch (_error) { return null; }
}

async function verifyCachedAccessToken() {
  if (!lastKnownSession?.access_token) return false;
  const base = window.SUPABASE_URL || 'https://ldmtlwzqaqmegedktlxr.supabase.co';
  const key = window.SUPABASE_KEY || '';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), USER_VERIFY_TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/auth/v1/user`, {
      method:'GET',
      headers:{ Authorization:`Bearer ${lastKnownSession.access_token}`, ...(key ? { apikey:key } : {}) },
      cache:'no-store',
      signal:controller.signal
    });
    return res.ok;
  } catch (_error) { return false; }
  finally { clearTimeout(timer); }
}

async function restoreClientSessionFromCache() {
  if (!lastKnownSession?.access_token || !lastKnownSession?.refresh_token) return false;
  try {
    const { data, error } = await window.sb.auth.setSession({
      access_token:lastKnownSession.access_token,
      refresh_token:lastKnownSession.refresh_token
    });
    if (error || !data?.session) return false;
    lastKnownSession = data.session;
    return true;
  } catch (_error) { return false; }
}

async function recoverFalseLoginTransition(reason = 'login-card-detected') {
  if (recovering || shellVisible() || !loginVisible() || explicitLogout) return;
  if (now() - lastRecovery < RETRY_COOLDOWN_MS) return;
  recovering = true;
  lastRecovery = now();
  health('verifying-false-login', { reason });
  try {
    let session = await captureSession();
    if (!session) {
      await sleep(SESSION_RECHECK_MS);
      session = await captureSession();
    }

    if (!session && await verifyCachedAccessToken()) {
      health('cached-token-still-valid', { reason });
      await restoreClientSessionFromCache();
      session = await captureSession();
    }

    if (!session) {
      health('login-confirmed-no-session', { reason });
      return;
    }

    const rescue = window.AtlasAuthBootstrap;
    if (!rescue || typeof rescue.retry !== 'function') {
      health('session-valid-rescue-unavailable', { reason, userId:session.user?.id || null });
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

/* Explicit user logout is the only path that disables false-login recovery. */
document.addEventListener('click', event => {
  if (event.target?.closest?.('#logout')) {
    explicitLogout = true;
    health('explicit-logout');
  }
}, true);

/* Keep the last server-issued session only for recovery of a transient client state.
   No new privilege is created: /auth/v1/user and all data requests still validate
   the original Supabase access token and RLS remains authoritative. */
if (window.sb?.auth?.onAuthStateChange) {
  window.sb.auth.onAuthStateChange((event, session) => {
    if (session?.access_token) lastKnownSession = session;
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') explicitLogout = false;
    if (event === 'SIGNED_OUT' && !explicitLogout) {
      setTimeout(() => void recoverFalseLoginTransition('auth-signed-out-event'), 50);
    }
  });
}
void captureSession();

/* Final UI authority: the expert Entity 360 landing (0391) + detailed dossier (038)
   is the production authority. The later simplified search-only screen is retained
   only as a fallback source fragment and must not overwrite the approved module. */
installEntityAuthority();

const target = appNode();
if (target) {
  let timer = null;
  const observer = new MutationObserver(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      installEntityAuthority();
      if (loginVisible() && !shellVisible()) void recoverFalseLoginTransition();
    }, 40);
  });
  observer.observe(target, { childList:true, subtree:false });
  window.addEventListener('beforeunload', () => observer.disconnect(), { once:true });
  if (loginVisible() && !shellVisible()) void recoverFalseLoginTransition('module-start');
}

window.__ATLAS_RUNTIME_RELIABILITY__ = {
  active:true,
  releaseGuard:'NO_ACTIVE_SESSION_RELOAD',
  authGuard:'DOUBLE_SESSION_CHECK+SERVER_TOKEN_VERIFY',
  entityAuthority:'V0391_ENTRY+V038_ENTITY360',
  installedAt:iso()
};
