const APP_SELECTOR = '#app';
const LOGIN_SELECTOR = '#login';
const RETRY_COOLDOWN_MS = 1200;

let recovering = false;
let lastRecovery = 0;

function now() { return Date.now(); }
function appNode() { return document.querySelector(APP_SELECTOR); }
function loginVisible() { return !!document.querySelector(LOGIN_SELECTOR); }
function shellVisible() { return !!document.querySelector(`${APP_SELECTOR} .shell`); }

async function recoverFalseLoginTransition(reason = 'login-card-detected') {
  if (recovering || shellVisible() || !loginVisible()) return;
  if (now() - lastRecovery < RETRY_COOLDOWN_MS) return;
  recovering = true;
  lastRecovery = now();
  try {
    const rescue = window.AtlasAuthBootstrap;
    if (!rescue || typeof rescue.retry !== 'function') return;
    window.__ATLAS_SESSION_SHELL_GUARD__ = {
      active: true,
      reason,
      at: new Date().toISOString(),
      action: 'retry-authenticated-shell'
    };
    await rescue.retry();
  } catch (error) {
    window.__ATLAS_SESSION_SHELL_GUARD__ = {
      active: true,
      reason,
      at: new Date().toISOString(),
      action: 'retry-failed',
      error: String(error?.message || error)
    };
  } finally {
    recovering = false;
  }
}

const target = appNode();
if (target) {
  const observer = new MutationObserver(() => {
    if (loginVisible() && !shellVisible()) void recoverFalseLoginTransition();
  });
  observer.observe(target, { childList: true, subtree: true });
  window.addEventListener('beforeunload', () => observer.disconnect(), { once: true });
  if (loginVisible() && !shellVisible()) void recoverFalseLoginTransition('module-start');
}
