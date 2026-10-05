'use strict';

(function installMunicipalSearchHotfix(global) {
  if (global.__ATLAS_V2_MUNICIPAL_SEARCH_HOTFIX__?.installed) return;

  const VERSION = 'MUNICIPAL_SEARCH_HOTFIX_20261005_1';
  const DEFAULT_URL = 'https://bzqxvidggykkdouotylg.supabase.co';
  const DEFAULT_KEY = 'sb_publishable_3nrUSbZMWfTYUtXnyjDklg_EjyZIzko';
  const ENDPOINT = '/functions/v1/atlas-v2-municipal-read';
  let timer = null;
  let observer = null;
  let lastSignature = '';

  const clean = value => String(value ?? '').trim();
  const normalize = value => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleUpperCase('es-CL').replace(/\s+/g, ' ');
  const money = value => Number.isFinite(Number(value)) ? `$${Math.round(Number(value)).toLocaleString('es-CL')}` : '—';
  const integer = value => Number.isFinite(Number(value)) ? Math.round(Number(value)).toLocaleString('es-CL') : '—';

  function routeParam(route, key) {
    const params = route?.params;
    if (params?.get) return clean(params.get(key));
    return clean(params?.[key] || route?.[key] || '');
  }

  function isPublicSpend(route) {
    return ['gasto-publico', 'huella-publica', 'huella'].includes(route?.id);
  }

  function config() {
    const current = global.__ATLAS_V2_CONFIG__ || {};
    return {
      url: String(current.supabaseUrl || DEFAULT_URL).replace(/\/$/, ''),
      key: String(current.publishableKey || DEFAULT_KEY),
    };
  }

  async function tokens() {
    const coreProvider = global.AtlasV2Access?.getAccessToken;
    const federation = global.AtlasV2Session?.getAccessToken;
    if (typeof coreProvider !== 'function' || typeof federation !== 'function') return null;
    const coreToken = await coreProvider();
    if (!coreToken) return null;
    const v2Token = await federation(() => coreProvider());
    if (!v2Token) return null;
    return { coreToken, v2Token };
  }

  async function municipalBuyers(search) {
    const auth = await tokens();
    if (!auth) return [];
    const c = config();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch(`${c.url}${ENDPOINT}`, {
        method: 'POST',
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          authorization: `Bearer ${auth.v2Token}`,
          apikey: c.key,
          'content-type': 'application/json',
          'x-atlas-core-authorization': `Bearer ${auth.coreToken}`,
          'x-client-info': 'atlas-v2-municipal-search-hotfix/1.0',
        },
        body: JSON.stringify({ kind: 'municipal_buyers', search, offset: 0, limit: 20 }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body?.schema !== 'ATLAS_PUBLIC_SPEND_QUERY_V2' || body?.domain !== 'municipal_dte') return [];
      return Array.isArray(body.items) ? body.items : [];
    } finally {
      clearTimeout(timeout);
    }
  }

  function findSearchInput(host) {
    return host.querySelector('input[type="search"], input[placeholder*="Buscar" i]');
  }

  function visibleMunicipality(host) {
    const candidates = Array.from(host.querySelectorAll('strong,h1,h2,h3,h4,span'))
      .map(el => clean(el.textContent))
      .filter(text => /municipalidad/i.test(text) && !/presupuesto abierto municipal/i.test(text))
      .sort((a, b) => a.length - b.length);
    return candidates[0] || '';
  }

  function activeSearch(route, host) {
    const input = findSearchInput(host);
    const live = clean(input?.value);
    const routeSearch = routeParam(route, 'q') || routeParam(route, 'rut');
    const service = routeParam(route, 'service');
    const visible = visibleMunicipality(host);
    return routeSearch || live || service || visible;
  }

  function bindInput(host) {
    const input = findSearchInput(host);
    if (!input || input.dataset.munSearchHotfixBound === '1') return;
    input.dataset.munSearchHotfixBound = '1';
    input.addEventListener('input', schedule, { passive: true });
    input.addEventListener('change', schedule, { passive: true });
  }

  function matchTarget(host, buyer) {
    const name = normalize(buyer?.buyer_name || buyer?.organization_name || '');
    if (!name) return null;
    const candidates = Array.from(host.querySelectorAll('article,li,button,[role="button"],div'))
      .filter(el => !el.closest('[data-mun-search-hotfix-panel]'))
      .filter(el => normalize(el.textContent).includes(name))
      .sort((a, b) => clean(a.textContent).length - clean(b.textContent).length);
    return candidates.find(el => /mercado\s+p[uú]blico/i.test(el.textContent || '')) || candidates[0] || null;
  }

  function decorateCandidate(host, buyer) {
    const target = matchTarget(host, buyer);
    if (!target || target.querySelector('[data-mun-search-source]')) return;
    const first = Number(buyer.first_year || 0);
    const last = Number(buyer.last_year || 0);
    const range = first && last ? (first === last ? String(first) : `${first}–${last}`) : '';
    const wrap = document.createElement('div');
    wrap.dataset.munSearchSource = '1';
    wrap.className = 'munv2-inline-source';
    const badge = document.createElement('span');
    badge.className = 'munv2-source-badge';
    badge.textContent = 'Presupuesto Abierto Municipal';
    const detail = document.createElement('small');
    detail.textContent = `DTE observados${range ? ` · ${range}` : ''}`;
    wrap.append(badge, detail);
    target.append(wrap);
  }

  function renderPanel(host, buyers, search) {
    let panel = host.querySelector('[data-mun-search-hotfix-panel]');
    if (!buyers.length) {
      panel?.remove();
      return;
    }
    if (!panel) {
      panel = document.createElement('section');
      panel.dataset.munSearchHotfixPanel = '1';
      panel.className = 'munv2-panel';
      host.append(panel);
    }
    panel.replaceChildren();
    const head = document.createElement('header');
    head.className = 'munv2-head';
    const titleWrap = document.createElement('div');
    const eyebrow = document.createElement('span');
    eyebrow.textContent = 'PRESUPUESTO ABIERTO MUNICIPAL';
    const title = document.createElement('h2');
    title.textContent = `Municipalidades encontradas para “${search}”`;
    const subtitle = document.createElement('p');
    subtitle.textContent = 'DTE municipales observados; esta evidencia no acredita pago efectivo.';
    titleWrap.append(eyebrow, title, subtitle);
    const count = document.createElement('b');
    count.textContent = `${integer(buyers.length)} resultados`;
    head.append(titleWrap, count);
    panel.append(head);

    const list = document.createElement('div');
    list.className = 'munv2-list';
    buyers.slice(0, 18).forEach(buyer => {
      const row = document.createElement('article');
      row.className = 'munv2-row';
      const main = document.createElement('div');
      main.className = 'munv2-row-main';
      const strong = document.createElement('strong');
      strong.textContent = buyer.buyer_name || buyer.organization_name || 'Municipalidad';
      const meta = document.createElement('span');
      meta.textContent = [buyer.region, buyer.buyer_rut, `${integer(buyer.provider_count)} proveedores`].filter(Boolean).join(' · ');
      main.append(strong, meta);
      const value = document.createElement('div');
      value.className = 'munv2-row-value';
      const amount = document.createElement('b');
      amount.textContent = money(buyer.amount_clp);
      const docs = document.createElement('span');
      docs.textContent = `${integer(buyer.document_count)} DTE`;
      value.append(amount, docs);
      row.append(main, value);
      list.append(row);
    });
    panel.append(list);
    const footer = document.createElement('footer');
    footer.textContent = 'DTE municipal observado ≠ pago efectivo. Ausencia de datos no se interpreta como monto cero.';
    panel.append(footer);
  }

  async function run() {
    const route = global.AtlasV2Shell?.currentRoute?.();
    if (!route || !isPublicSpend(route)) return;
    const host = document.querySelector('.atlas-v2-gp-host');
    if (!host) return;
    bindInput(host);
    const search = activeSearch(route, host);
    if (!search || search.length < 3) return;
    const signature = `${route.id}|${normalize(search)}`;
    if (signature === lastSignature && host.querySelector('[data-mun-search-source]')) return;
    lastSignature = signature;
    try {
      const buyers = await municipalBuyers(search);
      if (!document.contains(host)) return;
      buyers.forEach(buyer => decorateCandidate(host, buyer));
      renderPanel(host, buyers, search);
    } catch (error) {
      console.warn('[ATLAS municipal hotfix] unavailable', error?.message || error);
    }
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => { void run(); }, 180);
  }

  function observe() {
    const root = document.getElementById('atlas-v2-root');
    if (!root || observer) return;
    observer = new MutationObserver(schedule);
    observer.observe(root, { childList: true, subtree: true });
    global.addEventListener('hashchange', schedule);
    global.addEventListener('atlas:v2-shell-ready', schedule);
    schedule();
  }

  global.__ATLAS_V2_MUNICIPAL_SEARCH_HOTFIX__ = Object.freeze({ installed: true, version: VERSION, refresh: schedule });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observe, { once: true });
  else observe();
})(window);
