'use strict';

(function installAtlasV2CoreAuth(global) {
  if (global.AtlasCoreSession?.installed) return;

  let client = null;
  let current = { status: 'booting', user: null, role: null, checkedAt: null };

  function cfg() {
    const c = global.__ATLAS_V2_PRODUCTION_CONFIG__ || {};
    return {
      coreUrl: String(c.coreUrl || '').replace(/\/$/, ''),
      corePublishableKey: String(c.corePublishableKey || ''),
      redirectTo: String(c.redirectTo || `${location.origin}${location.pathname}`),
    };
  }

  function node(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value == null) return;
      if (key === 'class') el.className = value;
      else if (key === 'text') el.textContent = String(value);
      else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
      else el.setAttribute(key, String(value));
    });
    (Array.isArray(children) ? children : [children]).forEach(child => {
      if (child == null) return;
      el.append(child instanceof Node ? child : document.createTextNode(String(child)));
    });
    return el;
  }

  function clear(el) { while (el?.firstChild) el.removeChild(el.firstChild); }
  function root() { return document.getElementById('atlas-v2-root'); }

  function renderGate(kind, title, body, action) {
    const host = root();
    if (!host) return;
    clear(host);
    const card = node('section', { class: 'atlas-v2-auth-card' }, [
      node('div', { class: 'atlas-v2-auth-brand', text: 'ATLAS' }),
      node('div', { class: 'atlas-v2-eyebrow', text: kind }),
      node('h1', { text: title }),
      node('p', { text: body }),
      action || null,
    ]);
    host.append(node('main', { class: 'atlas-v2-auth-screen' }, [card]));
  }

  function ensureClient() {
    if (client) return client;
    if (!global.supabase?.createClient) throw new Error('Supabase Auth runtime no está disponible');
    const c = cfg();
    if (!c.coreUrl || !c.corePublishableKey) throw new Error('ATLAS v2 core auth configuration is incomplete');
    client = global.supabase.createClient(c.coreUrl, c.corePublishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    global.sb = client;
    return client;
  }

  function resetFederatedSession() {
    try { global.AtlasV2Access?.reset?.(); } catch (_) {}
    try { global.AtlasV2Session?.clear?.(); } catch (_) {}
  }

  async function signIn() {
    const sb = ensureClient();
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'azure',
      options: { scopes: 'email', redirectTo: cfg().redirectTo },
    });
    if (error) throw error;
  }

  async function signOut() {
    resetFederatedSession();
    const sb = ensureClient();
    await sb.auth.signOut();
    location.href = cfg().redirectTo;
  }

  async function getAccessToken() {
    const sb = ensureClient();
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;
    return data?.session?.access_token || null;
  }

  async function verifiedUser() {
    const sb = ensureClient();
    const { data, error } = await sb.auth.getUser();
    if (error) throw error;
    return data?.user || null;
  }

  async function authorize(user) {
    const sb = ensureClient();
    const userId = user?.id;
    if (!userId) return null;
    const { data, error } = await sb
      .from('aml_allowed_users')
      .select('role,enabled')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data?.enabled ? data : null;
  }

  async function auditSession(user, role) {
    if (!user?.id) return;
    const key = `atlas-v2-session-audited:${user.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    try {
      await ensureClient().from('aml_audit_log').insert({
        user_id: user.id,
        event_type: 'V2_SESSION_START',
        object_type: 'atlas_v2',
        object_id: 'analytics-primary',
        payload: { role: role || 'viewer' },
      });
    } catch (_) {
      // Audit is best-effort; authorization and data access remain independently enforced.
    }
  }

  async function ready() {
    try {
      const sb = ensureClient();
      const { data: { session }, error } = await sb.auth.getSession();
      if (error) throw error;
      if (!session?.access_token) {
        current = { status: 'signed_out', user: null, role: null, checkedAt: new Date().toISOString() };
        const button = node('button', { class: 'atlas-v2-button primary', type: 'button', text: 'Ingresar con Microsoft' });
        button.addEventListener('click', () => { void signIn().catch(err => renderError(err)); });
        renderGate('ACCESO CONTROLADO', 'ATLAS · Inteligencia analítica', 'Autenticación mediante Microsoft Entra y Supabase Auth. La identidad autenticada debe estar además habilitada en la allowlist institucional.', button);
        return null;
      }

      // getSession() is used only to obtain the raw token. Identity used for authorization
      // is revalidated against Supabase Auth before consulting the institutional allowlist.
      const user = await verifiedUser();
      if (!user?.id) throw new Error('La sesión no pudo ser verificada por el servidor de identidad');
      const access = await authorize(user);
      if (!access) {
        current = { status: 'denied', user, role: null, checkedAt: new Date().toISOString() };
        const button = node('button', { class: 'atlas-v2-button', type: 'button', text: 'Cerrar sesión', onclick: () => { void signOut(); } });
        renderGate('AUTENTICACIÓN CORRECTA', 'Acceso no habilitado', 'La identidad fue autenticada, pero la autorización analítica permanece cerrada por allowlist/RLS.', button);
        return null;
      }

      current = { status: 'ready', user, role: access.role || 'viewer', checkedAt: new Date().toISOString() };
      global.__ATLAS_V2_ACCESS_TOKEN_PROVIDER__ = getAccessToken;
      await auditSession(user, current.role);
      return { user, role: current.role };
    } catch (error) {
      renderError(error);
      return null;
    }
  }

  function renderError(error) {
    current = { ...current, status: 'error', checkedAt: new Date().toISOString() };
    const retry = node('button', { class: 'atlas-v2-button', type: 'button', text: 'Reintentar', onclick: () => location.reload() });
    renderGate('ERROR DE ACCESO', 'No fue posible iniciar ATLAS v2', String(error?.message || error || 'Error desconocido'), retry);
  }

  function installAccountControl() {
    const topbar = document.querySelector('.atlas-v2-topbar');
    if (!topbar || topbar.querySelector('[data-atlas-v2-account]')) return;
    const user = current.user;
    const label = user?.email ? String(user.email) : 'Sesión';
    const account = node('button', {
      class: 'atlas-v2-button atlas-v2-account',
      type: 'button',
      'data-atlas-v2-account': 'true',
      title: `${label} · ${current.role || 'viewer'} · cerrar sesión`,
      text: `${current.role || 'viewer'} · salir`,
      onclick: () => { void signOut(); },
    });
    topbar.append(account);
  }

  const sb = ensureClient();
  sb.auth.onAuthStateChange((event) => {
    if (event === 'TOKEN_REFRESHED') resetFederatedSession();
    if (event === 'SIGNED_OUT') {
      resetFederatedSession();
      current = { status: 'signed_out', user: null, role: null, checkedAt: new Date().toISOString() };
      location.href = cfg().redirectTo;
    }
  });
  global.addEventListener('atlas:v2-shell-ready', installAccountControl);

  global.AtlasCoreSession = Object.freeze({
    installed: true,
    ready,
    getAccessToken,
    signIn,
    signOut,
    state: () => ({ ...current }),
  });
})(window);
