'use strict';

(function installAtlasV2MunicipalFootprint(global) {
  if (global.__ATLAS_V2_MUNICIPAL_FOOTPRINT__?.installed) return;

  const VERSION = 'MUNICIPAL_FOOTPRINT_V2_20261005_2';
  const DEFAULT_URL = 'https://bzqxvidggykkdouotylg.supabase.co';
  const DEFAULT_KEY = 'sb_publishable_3nrUSbZMWfTYUtXnyjDklg_EjyZIzko';
  const ENDPOINT = '/functions/v1/atlas-v2-municipal-read';
  const cache = new Map();
  let observer = null;
  let timer = null;

  function clean(value) { return String(value ?? '').trim(); }
  function num(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
  function money(value) { const n = Number(value); return Number.isFinite(n) ? `$${Math.round(n).toLocaleString('es-CL')}` : '—'; }
  function integer(value) { const n = Number(value); return Number.isFinite(n) ? Math.round(n).toLocaleString('es-CL') : '—'; }
  function config() {
    const current = global.__ATLAS_V2_CONFIG__ || {};
    return { url: String(current.supabaseUrl || DEFAULT_URL).replace(/\/$/, ''), key: String(current.publishableKey || DEFAULT_KEY) };
  }
  function node(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value == null) return;
      if (key === 'class') el.className = value;
      else if (key === 'text') el.textContent = String(value);
      else if (key === 'dataset') Object.entries(value).forEach(([name, entry]) => { el.dataset[name] = String(entry); });
      else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
      else el.setAttribute(key, String(value));
    });
    (Array.isArray(children) ? children : [children]).flat().forEach(child => { if (child != null) el.append(child instanceof Node ? child : document.createTextNode(String(child))); });
    return el;
  }
  function injectStyle() {
    if (document.getElementById('atlas-v2-municipal-footprint-style')) return;
    const base = new URL('./', document.currentScript?.src || document.baseURI);
    document.head.appendChild(node('link', { id: 'atlas-v2-municipal-footprint-style', rel: 'stylesheet', href: new URL('municipal-footprint-v2.css?v=20261005-2', base).href }));
  }

  async function tokens() {
    const coreProvider = global.AtlasV2Access?.getAccessToken;
    const federation = global.AtlasV2Session?.getAccessToken;
    if (typeof coreProvider !== 'function' || typeof federation !== 'function') throw new Error('ATLAS_SESSION_UNAVAILABLE');
    const coreToken = await coreProvider();
    if (!coreToken) throw new Error('CORE_SESSION_UNAVAILABLE');
    const v2Token = await federation(() => coreProvider());
    if (!v2Token) throw new Error('V2_SESSION_UNAVAILABLE');
    return { coreToken, v2Token };
  }
  async function query(kind, search = '', limit = 100) {
    const normalized = clean(search);
    const cacheKey = `${kind}|${normalized.toLocaleUpperCase('es-CL')}|${limit}`;
    const prior = cache.get(cacheKey);
    if (prior && Date.now() - prior.at < 5 * 60 * 1000) return prior.value;
    const { coreToken, v2Token } = await tokens();
    const c = config();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch(`${c.url}${ENDPOINT}`, {
        method: 'POST', cache: 'no-store', signal: controller.signal,
        headers: { authorization: `Bearer ${v2Token}`, apikey: c.key, 'content-type': 'application/json', 'x-atlas-core-authorization': `Bearer ${coreToken}`, 'x-client-info': 'atlas-v2-municipal-footprint/1.2' },
        body: JSON.stringify({ kind, search: normalized || undefined, offset: 0, limit }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body?.schema !== 'ATLAS_PUBLIC_SPEND_QUERY_V2' || body?.domain !== 'municipal_dte') throw Object.assign(new Error(body?.error || `MUNICIPAL_READ_${res.status}`), { code: body?.error || 'MUNICIPAL_READ_FAILED' });
      cache.set(cacheKey, { at: Date.now(), value: body });
      return body;
    } finally { clearTimeout(timeout); }
  }

  function coverageLabel(value) {
    if (value === 'partial_period') return 'corte parcial';
    if (value === 'complete') return 'cobertura completa';
    return 'cobertura no determinada';
  }
  function yearsText(row) {
    const years = Array.isArray(row?.years) ? row.years : [];
    if (years.length) return years.map(item => `${item.year}: ${money(item.amount_clp)} · ${integer(item.document_count)} DTE${item.coverage_status === 'partial_period' ? ' · parcial' : ''}`).join(' | ');
    const first = Number(row?.first_year || 0), last = Number(row?.last_year || 0);
    return first && last ? (first === last ? String(first) : `${first}–${last}`) : 'Período no determinado';
  }
  function relationRow(row) {
    return node('article', { class: 'munv2-row' }, [
      node('div', { class: 'munv2-row-main' }, [node('strong', { text: row.buyer_name || row.organization_name || 'Municipalidad' }), node('span', { text: [row.region, row.buyer_rut].filter(Boolean).join(' · ') }), node('small', { text: yearsText(row) })]),
      node('div', { class: 'munv2-row-value' }, [node('b', { text: money(row.amount_clp) }), node('span', { text: `${integer(row.document_count)} DTE` }), node('em', { class: `munv2-coverage ${row.coverage_status || 'unknown'}`, text: coverageLabel(row.coverage_status) })]),
    ]);
  }
  function buyerRow(row) {
    return node('article', { class: 'munv2-row' }, [
      node('div', { class: 'munv2-row-main' }, [node('strong', { text: row.buyer_name || row.organization_name || 'Municipalidad' }), node('span', { text: [row.region, row.buyer_rut, `${integer(row.provider_count)} proveedores`].filter(Boolean).join(' · ') }), node('small', { text: yearsText(row) })]),
      node('div', { class: 'munv2-row-value' }, [node('b', { text: money(row.amount_clp) }), node('span', { text: `${integer(row.document_count)} DTE` }), node('em', { class: `munv2-coverage ${row.coverage_status || 'unknown'}`, text: coverageLabel(row.coverage_status) })]),
    ]);
  }
  function providerRow(row, api) {
    const rut = row.provider_rut || row.supplier_rut || '';
    return node('article', { class: 'munv2-row' }, [
      node('div', { class: 'munv2-row-main' }, [node('strong', { text: row.provider_name || row.supplier_name || rut || 'Proveedor' }), node('span', { text: [rut, `${integer(row.buyer_count)} municipios`].filter(Boolean).join(' · ') }), node('small', { text: row.first_year && row.last_year ? `${row.first_year}–${row.last_year}` : 'Período disponible' })]),
      node('div', { class: 'munv2-row-value' }, [node('b', { text: money(row.amount_clp) }), node('span', { text: `${integer(row.document_count)} DTE` }), rut && api?.navigate ? node('button', { type: 'button', text: 'Entidad 360', onclick: () => api.navigate('entidad', { rut }) }) : null]),
    ]);
  }
  function panel(title, subtitle, items, renderer, signature, className = '') {
    const section = node('section', { class: `munv2-panel ${className}`.trim(), dataset: { munv2: signature } });
    section.append(node('header', { class: 'munv2-head' }, [node('div', {}, [node('span', { text: 'PRESUPUESTO ABIERTO MUNICIPAL' }), node('h2', { text: title }), node('p', { text: subtitle })]), node('b', { text: `${integer(items.length)} resultados` })]));
    if (!items.length) section.append(node('div', { class: 'munv2-empty', text: 'No se observaron DTE municipales para este criterio en el corte materializado. Ausencia de registro no se interpreta como pago $0.' }));
    else {
      const list = node('div', { class: 'munv2-list' });
      const visible = 18;
      items.forEach((item, index) => { const row = renderer(item); if (index >= visible) row.hidden = true; list.append(row); });
      section.append(list);
      if (items.length > visible) {
        let open = false;
        section.append(node('button', { type: 'button', class: 'munv2-more', text: `Ver ${items.length - visible} más`, onclick: event => { open = !open; Array.from(list.children).forEach((row, index) => { if (index >= visible) row.hidden = !open; }); event.currentTarget.textContent = open ? 'Ver menos' : `Ver ${items.length - visible} más`; } }));
      }
    }
    section.append(node('footer', { text: 'DTE municipal observado ≠ pago efectivo. El año en curso se presenta como corte parcial y la ausencia de datos no se transforma en cero.' }));
    return section;
  }

  function ensureSourceChip(selector, datasetName = 'munv2Source') {
    const strip = document.querySelector(selector);
    if (!strip || strip.querySelector(`[data-${datasetName.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}]`)) return;
    strip.append(node('span', { class: selector.includes('e36x') ? 'e36x-pill present' : 'live', dataset: { [datasetName]: '1' }, text: 'Presupuesto Abierto Municipal · DTE' }));
  }
  function routeIsPublicSpend(route) { return ['gasto-publico', 'huella-publica', 'huella'].includes(route?.id); }

  async function enhancePublicSpend(route) {
    const host = document.querySelector('.atlas-v2-gp-host');
    if (!host) return;
    ensureSourceChip('.atlas-v2-gp-source-strip');
    const search = clean(route.params.get('q') || route.params.get('rut') || '');
    const tab = route.params.get('tab') || (route.params.get('rut') ? 'providers' : 'overview');
    const signature = `gp:${tab}:${search.toLocaleUpperCase('es-CL')}`;
    const current = host.querySelector('[data-munv2-wrap]');
    if (current?.dataset.munv2Wrap === signature) return;
    current?.remove();
    if (!search && !['overview', 'providers', 'buyers'].includes(tab)) return;
    const wrap = node('div', { dataset: { munv2Wrap: signature } });
    try {
      if (search) {
        const [buyersBody, relationsBody] = await Promise.all([query('municipal_buyers', search, 100), query('municipal_relations', search, 100)]);
        const buyers = Array.isArray(buyersBody.items) ? buyersBody.items : [];
        const relations = Array.isArray(relationsBody.items) ? relationsBody.items : [];
        if (buyers.length) wrap.append(panel('Municipalidades encontradas', `Coincidencias para “${search}”. Búsqueda por nombre o RUT municipal.`, buyers, buyerRow, `${signature}:buyers`));
        if (relations.length) wrap.append(panel('Municipios con DTE del proveedor', `Relaciones municipales observadas para “${search}”.`, relations, relationRow, `${signature}:relations`));
        if (!buyers.length && !relations.length) wrap.append(panel('Presupuesto Abierto Municipal', `Sin coincidencias municipales para “${search}”.`, [], buyerRow, `${signature}:empty`));
      } else if (tab === 'providers') {
        const body = await query('municipal_providers', '', 40);
        wrap.append(panel('Proveedores observados por municipios', 'Monto neto de DTE observados; no acredita pago.', Array.isArray(body.items) ? body.items : [], row => providerRow(row, global.AtlasV2Shell), `${signature}:providers`));
      } else {
        const body = await query('municipal_buyers', '', 100);
        wrap.append(panel('Municipalidades · Presupuesto Abierto', 'Universo municipal consultable. Usa el buscador para municipios fuera del top visible.', Array.isArray(body.items) ? body.items : [], buyerRow, `${signature}:buyers`));
      }
      if (routeIsPublicSpend(global.AtlasV2Shell?.currentRoute?.())) host.append(wrap);
    } catch (error) { console.warn('[ATLAS municipal] public-spend unavailable', error?.code || error?.message || error); }
  }

  function municipalRange(items) {
    const years = items.flatMap(item => Array.isArray(item.years) ? item.years.map(y => Number(y.year)) : [Number(item.first_year), Number(item.last_year)]).filter(Number.isFinite);
    if (!years.length) return '';
    const min = Math.min(...years), max = Math.max(...years);
    return min === max ? String(min) : `${min}–${max}`;
  }
  function reconcileEntityKpi(items) {
    if (!items.length) return;
    const cards = Array.from(document.querySelectorAll('.e36x-kpi'));
    const target = cards.find(card => /huella\s+p[uú]blica/i.test(card.textContent || ''));
    if (!target) return;
    const strong = target.querySelector('strong');
    const small = target.querySelector('small');
    if (strong) strong.textContent = 'Registra';
    if (small) small.textContent = `DTE municipales observados${municipalRange(items) ? ` · ${municipalRange(items)}` : ''}`;
    target.classList.add('present');
    target.dataset.munv2Kpi = '1';
  }
  async function enhanceEntity(route) {
    const root = document.querySelector('.e36x');
    if (!root) return;
    const rut = clean(route.params.get('rut') || root.querySelector('.e36x-hero p')?.textContent?.match(/\b\d{7,8}-[0-9K]\b/i)?.[0] || '');
    if (!rut) return;
    try {
      const body = await query('municipal_relations', rut, 100);
      if (global.AtlasV2Shell?.currentRoute?.().id !== 'entidad') return;
      const items = Array.isArray(body.items) ? body.items : [];
      if (!items.length) return;
      ensureSourceChip('.e36x-source-strip', 'munv2EntitySource');
      reconcileEntityKpi(items);
      const purchases = root.querySelector('[data-panel="compras"]');
      if (purchases) {
        const signature = `entity:${rut.toUpperCase()}`;
        const current = purchases.querySelector('[data-munv2]');
        if (!current || current.dataset.munv2 !== signature) {
          current?.remove();
          purchases.append(panel('Municipios con DTE observados', 'Contrapartes municipales identificadas por DTE emitidos y no rechazados. Esta evidencia no acredita pago efectivo.', items, relationRow, signature, 'munv2-entity'));
        }
      }
    } catch (error) { console.warn('[ATLAS municipal] entity parity unavailable', error?.code || error?.message || error); }
  }

  function enhance() {
    const route = global.AtlasV2Shell?.currentRoute?.();
    if (!route) return;
    if (routeIsPublicSpend(route)) void enhancePublicSpend(route);
    else if (route.id === 'entidad') void enhanceEntity(route);
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(enhance, 120); }
  function observe() {
    const root = document.getElementById('atlas-v2-root');
    if (!root || observer) return;
    observer = new MutationObserver(schedule);
    observer.observe(root, { childList: true, subtree: true });
    global.addEventListener('hashchange', schedule);
    schedule();
  }

  injectStyle();
  global.__ATLAS_V2_MUNICIPAL_FOOTPRINT__ = Object.freeze({ installed: true, version: VERSION, endpoint: ENDPOINT, semantics: 'DTE observado; no acredita pago efectivo', refresh: schedule });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observe, { once: true }); else observe();
  global.addEventListener('atlas:v2-shell-ready', schedule);
})(window);
