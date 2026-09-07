'use strict';

(function installAtlasV2PublicSpendSurface(global) {
  if (global.__ATLAS_V2_PUBLIC_SPEND_SURFACE__) return;
  const scriptBase = new URL('./', document.currentScript?.src || document.baseURI);
  const NF = new Intl.NumberFormat('es-CL');
  const VALID_TABS = new Set(['overview', 'findings', 'providers', 'buyers', 'relations', 'method']);
  const REGION_LABELS = Object.freeze({
    '01': 'Tarapacá', '1': 'Tarapacá', '02': 'Antofagasta', '2': 'Antofagasta', '03': 'Atacama', '3': 'Atacama',
    '04': 'Coquimbo', '4': 'Coquimbo', '05': 'Valparaíso', '5': 'Valparaíso', '06': "O’Higgins", '6': "O’Higgins",
    '07': 'Maule', '7': 'Maule', '08': 'Biobío', '8': 'Biobío', '09': 'La Araucanía', '9': 'La Araucanía',
    '10': 'Los Lagos', '11': 'Aysén', '12': 'Magallanes', '13': 'Metropolitana', '14': 'Los Ríos',
    '15': 'Arica y Parinacota', '16': 'Ñuble',
  });
  let renderSerial = 0;
  let controller = null;

  function node(tag, attrs = {}, children = []) {
    const element = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value == null) return;
      if (key === 'class') element.className = value;
      else if (key === 'text') element.textContent = String(value);
      else if (key === 'dataset') Object.entries(value).forEach(([name, entry]) => { element.dataset[name] = entry; });
      else if (key.startsWith('on') && typeof value === 'function') element.addEventListener(key.slice(2).toLowerCase(), value);
      else element.setAttribute(key, String(value));
    });
    (Array.isArray(children) ? children : [children]).forEach(child => {
      if (child == null) return;
      element.append(child instanceof Node ? child : document.createTextNode(String(child)));
    });
    return element;
  }

  function svgNode(tag, attrs = {}, children = []) {
    const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value != null) element.setAttribute(key, String(value));
    });
    (Array.isArray(children) ? children : [children]).forEach(child => { if (child) element.append(child); });
    return element;
  }

  function clear(element) {
    while (element?.firstChild) element.removeChild(element.firstChild);
  }

  function injectStyle() {
    if (document.getElementById('atlas-v2-public-spend-surface-style')) return;
    const link = document.createElement('link');
    link.id = 'atlas-v2-public-spend-surface-style';
    link.rel = 'stylesheet';
    link.href = new URL('public-spend-surface.css?v=2', scriptBase).href;
    document.head.appendChild(link);
  }

  function num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function money(value) {
    const n = num(value);
    if (!n) return '—';
    const a = Math.abs(n);
    if (a >= 1e12) return `$${(n / 1e12).toLocaleString('es-CL', { maximumFractionDigits: 2 })} bill.`;
    if (a >= 1e9) return `$${(n / 1e9).toLocaleString('es-CL', { maximumFractionDigits: 1 })} mil M`;
    if (a >= 1e6) return `$${(n / 1e6).toLocaleString('es-CL', { maximumFractionDigits: 1 })} M`;
    return `$${NF.format(Math.round(n))}`;
  }

  function pct(value) {
    const n = Number(value);
    return Number.isFinite(n) ? `${(100 * n).toLocaleString('es-CL', { maximumFractionDigits: 1 })}%` : '—';
  }

  function regionLabel(value) {
    return REGION_LABELS[String(value || '')] || String(value || 'Sin región');
  }

  function first(row, keys, fallback = '') {
    for (const key of keys) {
      const value = row?.[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') return value;
    }
    return fallback;
  }

  function amount(row) {
    return first(row, ['_context_amount', 'context_amount', 'amount_l12', 'amount_total_clp', 'amount_clp', 'total_amount', 'amount'], 0);
  }

  function routeState(route) {
    const params = route.params;
    const rut = params.get('rut') || '';
    const requestedTab = params.get('tab') || (rut ? 'providers' : 'overview');
    return {
      tab: VALID_TABS.has(requestedTab) ? requestedTab : 'overview',
      q: params.get('q') || rut,
      rut,
      region: params.get('region') || '',
      category: params.get('category') || '',
      month: params.get('month') || '',
      service: params.get('service') || '',
      provider: params.get('provider') || '',
    };
  }

  function routePayload(state, patch = {}) {
    const next = { ...state, ...patch };
    return {
      tab: next.tab,
      q: next.q,
      rut: next.rut,
      region: next.region,
      category: next.category,
      month: next.month,
      service: next.service,
      provider: next.provider,
    };
  }

  function navigate(api, state, patch) {
    api.navigate('gasto-publico', routePayload(state, patch));
  }

  function pageHead() {
    return node('header', { class: 'atlas-v2-pagehead' }, [
      node('div', { class: 'atlas-v2-eyebrow', text: 'WORKSPACE ESPECIALIZADO · GASTO PÚBLICO' }),
      node('h1', { text: 'Compras, concentración y relaciones económicas' }),
      node('p', { text: 'Explora ChileCompra y Presupuesto Abierto como dominios paralelos. Atlas permite descubrir concentración, cambios y relaciones sin convertir una señal en irregularidad ni abrir un caso.' }),
    ]);
  }

  function tabs(api, state) {
    const labels = [
      ['overview', 'Resumen'], ['findings', 'Hallazgos'], ['providers', 'Proveedores'],
      ['buyers', 'Compradores'], ['relations', 'Relaciones'], ['method', 'Método'],
    ];
    return node('nav', { class: 'atlas-v2-gp-tabs', 'aria-label': 'Vistas de Gasto Público' }, labels.map(([id, label]) =>
      node('button', {
        type: 'button',
        class: state.tab === id ? 'active' : '',
        text: label,
        onclick: () => navigate(api, state, { tab: id }),
      }),
    ));
  }

  function sourceStrip(monitor, context) {
    const availability = monitor?.data?.availability || {};
    const budgetQuality = monitor?.data?.domains?.budget_execution?.quality || {};
    return node('div', { class: 'atlas-v2-gp-source-strip' }, [
      node('span', { class: availability.procurement === 'READY' ? 'live' : '', text: `ChileCompra · ${availability.procurement || 'sin estado'}` }),
      node('span', { class: availability.budget_execution === 'READY' ? 'live' : '', text: `Presupuesto Abierto · ${availability.budget_execution || 'sin estado'}` }),
      node('span', { text: `Detalle presupuestario · ${budgetQuality.detail_mode || 'sin estado'}` }),
      node('span', { text: `Snapshot · ${monitor?.snapshotId || context?.snapshotId || 'no disponible'}` }),
    ]);
  }

  function option(value, label, selected) {
    return node('option', { value, text: label, selected: String(value) === String(selected) ? 'selected' : null });
  }

  function budgetFilters(api, state, context) {
    const options = context?.data?.options || {};
    const form = node('div', { class: 'atlas-v2-gp-filters' });
    const specs = [
      ['region', 'Región', options.regions || [], regionLabel],
      ['category', 'Clasificador', options.categories || [], value => value],
      ['month', 'Período', options.months || [], value => value],
    ];
    specs.forEach(([key, label, values, formatter]) => {
      const select = node('select', { 'aria-label': label }, [option('', key === 'month' ? 'Últimos 12 meses' : 'Todos', state[key])]);
      const list = Array.isArray(values) ? values.slice() : [];
      if (state[key] && !list.some(value => String(value) === String(state[key]))) list.unshift(state[key]);
      list.forEach(value => select.append(option(value, formatter(value), state[key])));
      select.addEventListener('change', () => {
        const patch = { [key]: select.value };
        if (key === 'region' || key === 'category') Object.assign(patch, { service: '', provider: '' });
        navigate(api, state, patch);
      });
      form.append(node('label', {}, [node('span', { text: label }), select]));
    });

    if (state.service || state.provider) {
      const focus = node('div', { class: 'atlas-v2-gp-focus' });
      if (state.service) focus.append(node('button', { type: 'button', text: `Servicio: ${state.service} ×`, onclick: () => navigate(api, state, { service: '' }) }));
      if (state.provider) focus.append(node('button', { type: 'button', text: `Proveedor: ${state.provider} ×`, onclick: () => navigate(api, state, { provider: '' }) }));
      form.append(focus);
    }
    return form;
  }

  function searchBox(api, state) {
    const input = node('input', { type: 'search', value: state.q, placeholder: 'Buscar proveedor, comprador, RUT o relación…', 'aria-label': 'Buscar en Gasto Público' });
    const submit = () => navigate(api, state, { q: input.value.trim(), rut: '' });
    input.addEventListener('keydown', event => { if (event.key === 'Enter') submit(); });
    return node('div', { class: 'atlas-v2-gp-search' }, [
      input,
      node('button', { type: 'button', class: 'atlas-v2-button primary', text: 'Buscar', onclick: submit }),
      state.q ? node('button', { type: 'button', class: 'atlas-v2-button', text: 'Limpiar', onclick: () => navigate(api, state, { q: '', rut: '' }) }) : null,
    ]);
  }

  function kpi(label, value, detail) {
    return node('article', { class: 'atlas-v2-gp-kpi' }, [
      node('span', { text: label }), node('strong', { text: value }), node('small', { text: detail }),
    ]);
  }

  function metricGrid(context, monitor) {
    const m = context?.data?.metrics || {};
    const procurement = monitor?.data?.domains?.procurement?.summary || {};
    return node('div', { class: 'atlas-v2-gp-kpis' }, [
      kpi('Ejecución visible', money(m.service_amount_total), `${NF.format(num(m.service_count))} servicios`),
      kpi('Flujo a proveedores', money(m.provider_flow_total), `${NF.format(num(m.provider_count))} proveedores materializados`),
      kpi('Relaciones presupuestarias', NF.format(num(m.relation_count)), 'servicio–proveedor'),
      kpi('Top 10 proveedores', pct(m.top10_provider_share), 'concentración del contexto'),
      kpi('HHI proveedores', Number.isFinite(Number(m.provider_hhi)) ? Number(m.provider_hhi).toLocaleString('es-CL', { maximumFractionDigits: 4 }) : '—', 'concentración del contexto'),
      kpi('Proveedores ChileCompra', NF.format(num(procurement.supplier_count)), `${NF.format(num(procurement.buyer_count))} compradores`),
    ]);
  }

  function trend(rows) {
    const data = Array.isArray(rows) ? rows : [];
    const section = node('section', { class: 'atlas-v2-gp-panel' }, [
      node('div', { class: 'atlas-v2-gp-panel-head' }, [node('div', {}, [node('h2', { text: 'Tendencia del contexto' }), node('p', { text: 'Serie servida por el mismo budget_context que alimenta KPIs y rankings.' })])]),
    ]);
    if (!data.length) {
      section.append(node('div', { class: 'atlas-v2-empty' }, [node('strong', { text: 'Sin serie temporal' }), node('span', { text: 'No hay meses publicados para este contexto.' })]));
      return section;
    }
    const max = Math.max(...data.map(row => num(row.amount_clp)), 1);
    const chart = node('div', { class: 'atlas-v2-gp-trend' });
    data.forEach(row => {
      const value = num(row.amount_clp);
      const height = Math.max(3, Math.round((value / max) * 100));
      const y = 100 - height;
      const svg = svgNode('svg', { viewBox: '0 0 24 100', preserveAspectRatio: 'none', 'aria-hidden': 'true' }, [
        svgNode('rect', { x: 2, y, width: 20, height, rx: 3 }),
      ]);
      chart.append(node('div', { class: 'atlas-v2-gp-trend-col', title: `${row.period || ''} · ${money(value)}` }, [
        node('div', { class: 'atlas-v2-gp-trend-value', text: money(value) }),
        node('div', { class: 'atlas-v2-gp-barbox' }, [svg]),
        node('small', { text: String(row.period || '').slice(5) || '—' }),
      ]));
    });
    section.append(chart);
    return section;
  }

  function rankPanel(title, subtitle, rows, kind, api, state) {
    const panel = node('section', { class: 'atlas-v2-gp-panel' }, [
      node('div', { class: 'atlas-v2-gp-panel-head' }, [node('div', {}, [node('h2', { text: title }), node('p', { text: subtitle })])]),
    ]);
    const list = node('div', { class: 'atlas-v2-gp-list' });
    const data = Array.isArray(rows) ? rows : [];
    if (!data.length) {
      list.append(node('div', { class: 'atlas-v2-empty' }, [node('strong', { text: 'Sin resultados' }), node('span', { text: 'No hay filas publicadas para el contexto activo.' })]));
      panel.append(list);
      return panel;
    }
    data.slice(0, 20).forEach(row => list.append(resultRow(row, kind, api, state)));
    panel.append(list);
    return panel;
  }

  function entityButton(api, rut) {
    if (!rut) return null;
    return node('button', { type: 'button', text: 'Entidad 360', onclick: () => api.navigate('entidad', { rut }) });
  }

  function resultRow(row, kind, api, state) {
    const serviceId = first(row, ['organization_id', 'buyer_id', 'service_id']);
    const providerId = first(row, ['provider_id', 'supplier_id']);
    const rut = first(row, ['rut', 'provider_rut', 'supplier_rut']);
    const buyerName = first(row, ['organization_name', 'buyer_name', 'service_name', 'name'], serviceId);
    const providerName = first(row, ['provider_name', 'supplier_name', 'name'], providerId || rut);
    const actions = node('div', { class: 'atlas-v2-gp-row-actions' });
    let title = providerName || buyerName || first(row, ['title', 'rule_name', 'finding_type', 'signal'], 'Resultado');
    let detail = '';

    if (kind === 'service') {
      title = buyerName;
      detail = `${regionLabel(first(row, ['main_region', 'region']))} · ${first(row, ['dominant_subtitle', 'category'], 'sin clasificador')}`;
      if (serviceId) actions.append(node('button', { type: 'button', text: 'Fijar contexto', onclick: () => navigate(api, state, { service: serviceId, tab: 'overview' }) }));
    } else if (kind === 'provider' || kind === 'supplier') {
      title = providerName;
      detail = [rut, num(first(row, ['_context_service_count', 'service_count', 'buyer_count'])) ? `${NF.format(num(first(row, ['_context_service_count', 'service_count', 'buyer_count'])))} contrapartes` : ''].filter(Boolean).join(' · ');
      if (kind === 'provider' && providerId) actions.append(node('button', { type: 'button', text: 'Fijar contexto', onclick: () => navigate(api, state, { provider: providerId, tab: 'overview' }) }));
      const entity = entityButton(api, rut); if (entity) actions.append(entity);
      actions.append(node('button', { type: 'button', text: 'Relaciones', onclick: () => api.navigate('relaciones', { rut, provider: providerId || '' }) }));
    } else if (kind === 'buyer') {
      title = buyerName;
      detail = [first(row, ['rut', 'buyer_rut']), first(row, ['region', 'main_region']) ? regionLabel(first(row, ['region', 'main_region'])) : ''].filter(Boolean).join(' · ');
      actions.append(node('button', { type: 'button', text: 'Relaciones', onclick: () => api.navigate('relaciones', { buyer: serviceId || '' }) }));
    } else if (kind === 'relation' || kind === 'pair') {
      title = `${buyerName || serviceId || 'Comprador'} → ${providerName || providerId || 'Proveedor'}`;
      detail = rut || first(row, ['pair_id', 'id'], 'relación publicada');
      const entity = entityButton(api, rut); if (entity) actions.append(entity);
      actions.append(node('button', { type: 'button', text: 'Abrir relación', onclick: () => api.navigate('relaciones', { buyer: serviceId || '', provider: providerId || '', rut: rut || '' }) }));
    } else if (kind === 'finding') {
      title = first(row, ['title', 'finding_type', 'signal', 'rule_name', 'name'], 'Hallazgo');
      detail = first(row, ['description', 'reason', 'explanation', 'detail'], 'Señal publicada para revisión analítica.');
      const entity = entityButton(api, rut); if (entity) actions.append(entity);
      actions.append(node('button', { type: 'button', text: 'Explorar evidencia', onclick: () => api.navigate('relaciones', { buyer: serviceId || '', provider: providerId || '', rut: rut || '' }) }));
    }

    const meta = node('div', { class: 'atlas-v2-gp-row-main' }, [node('strong', { text: title || 'Sin etiqueta' }), node('span', { text: detail || 'Sin metadatos adicionales' }), actions]);
    const right = node('div', { class: 'atlas-v2-gp-row-value' }, [
      kind === 'finding' ? node('b', { text: String(first(row, ['severity', 'level', 'priority'], 'señal')) }) : node('b', { text: money(amount(row)) }),
      kind === 'finding' && num(amount(row)) ? node('small', { text: money(amount(row)) }) : null,
    ]);
    return node('article', { class: 'atlas-v2-gp-row' }, [meta, right]);
  }

  function overviewView(api, state, monitor, context) {
    const ctx = context?.data || {};
    return node('div', { class: 'atlas-v2-gp-stack' }, [
      metricGrid(context, monitor),
      trend(ctx.trend),
      node('div', { class: 'atlas-v2-gp-grid' }, [
        rankPanel('Servicios con mayor ejecución', 'Ranking de Presupuesto Abierto dentro del contexto activo.', ctx.top_services, 'service', api, state),
        rankPanel('Proveedores con mayor flujo', 'Ranking de flujo materializado; no se imputa ejecución no observada.', ctx.top_providers, 'provider', api, state),
      ]),
      rankPanel('Relaciones dominantes', 'Relaciones servicio–proveedor visibles en Presupuesto Abierto.', ctx.top_relations, 'relation', api, state),
    ]);
  }

  function dualProviderView(api, state, procurement, budget) {
    return node('div', { class: 'atlas-v2-gp-grid' }, [
      rankPanel('Proveedores · ChileCompra', state.q ? `Búsqueda: “${state.q}”` : 'Dominio de compras públicas.', procurement?.items, 'supplier', api, state),
      rankPanel('Proveedores · Presupuesto Abierto', state.q ? `Búsqueda: “${state.q}” bajo filtros presupuestarios activos.` : 'Flujo a proveedores bajo los filtros presupuestarios activos.', budget?.items, 'provider', api, state),
    ]);
  }

  function methodView() {
    const rules = [
      ['Dos dominios, una superficie', 'ChileCompra y Presupuesto Abierto se muestran juntos, pero sus métricas no se suman ni se fuerzan a un mismo grano.'],
      ['Concentración ≠ irregularidad', 'Top 10, HHI, materialidad y recurrencia priorizan exploración. No prueban fraude, conflicto de interés ni LA/FT.'],
      ['Ejecución ≠ flujo proveedor', 'La ejecución presupuestaria visible y el flujo materializado a proveedores son medidas distintas; Atlas no rellena la diferencia.'],
      ['URL como estado', 'Pestaña, búsqueda y filtros quedan en la URL para compartir y reproducir el contexto sin depender de una sesión de trabajo.'],
      ['Drill-down analítico', 'Proveedor, comprador y relación pueden abrir Entidad 360 o Relaciones. El salto no crea un caso ni cambia el significado del dato.'],
      ['Ausencia ≠ cero', 'Una búsqueda sin coincidencias significa no observado en el snapshot consultado, no inexistencia confirmada.'],
    ];
    return node('div', { class: 'atlas-v2-gp-method' }, rules.map(([title, body]) => node('article', { class: 'atlas-v2-gp-panel' }, [node('h2', { text: title }), node('p', { text: body })])));
  }

  function loading() {
    return node('div', { class: 'atlas-v2-gp-loading', role: 'status' }, [node('strong', { text: 'Consultando read models v2…' }), node('span', { text: 'El navegador sólo solicita páginas y agregados preparados en backend.' })]);
  }

  function errorView(error, api, state) {
    const code = String(error?.code || 'READ_FAILED');
    const noSession = code === 'NO_SESSION';
    return node('div', { class: 'atlas-v2-gp-error' }, [
      node('strong', { text: noSession ? 'La sesión de datos v2 no está disponible en este contexto.' : 'No fue posible consultar Gasto Público v2.' }),
      node('p', { text: noSession
        ? 'La superficie está conectada al cliente gobernado, pero este preview no recibió un token autenticado. No se sustituyen los datos con mocks ni consultas directas.'
        : String(error?.message || error) }),
      node('button', { class: 'atlas-v2-button', type: 'button', text: 'Reintentar', onclick: () => navigate(api, state, {}) }),
      error?.traceId ? node('small', { text: `Trace ${error.traceId}` }) : null,
    ]);
  }

  async function load(api, host, state, serial, signal) {
    const data = global.AtlasV2Access?.data?.();
    if (!data) throw new Error('ATLAS v2 access bridge no está disponible');
    const filters = { region: state.region, category: state.category, month: state.month, serviceId: state.service, providerId: state.provider };
    const common = { signal, route: `gasto-publico:${state.tab}` };

    if (state.tab === 'method') {
      clear(host); host.append(methodView()); return;
    }

    const [monitorResult, contextResult] = await Promise.all([
      data.publicSpend.monitor(common),
      data.publicSpend.budgetContext(filters, { ...common, route: 'gasto-publico:budget-context' }),
    ]);
    if (serial !== renderSerial || signal.aborted || !host.isConnected) return;
    const monitor = monitorResult;
    const context = contextResult;

    let extraA = null;
    let extraB = null;
    const query = { search: state.q || undefined, offset: 0, limit: 40 };
    if (state.tab === 'providers') {
      [extraA, extraB] = await Promise.all([
        data.publicSpend.suppliers({ query, ...common, route: 'gasto-publico:providers:procurement' }),
        data.publicSpend.budgetProviders({ filters, query, ...common, route: 'gasto-publico:providers:budget' }),
      ]);
    } else if (state.tab === 'buyers') {
      extraA = await data.publicSpend.buyers({ query, ...common, route: 'gasto-publico:buyers' });
    } else if (state.tab === 'relations') {
      [extraA, extraB] = await Promise.all([
        data.publicSpend.pairs({ query, ...common, route: 'gasto-publico:relations:procurement' }),
        data.publicSpend.budgetFlows({ filters, query, ...common, route: 'gasto-publico:relations:budget' }),
      ]);
    } else if (state.tab === 'findings') {
      extraA = await data.publicSpend.findings({ query, ...common, route: 'gasto-publico:findings' });
    }
    if (serial !== renderSerial || signal.aborted || !host.isConnected) return;

    clear(host);
    host.append(sourceStrip(monitor, context), budgetFilters(api, state, context));
    if (state.tab !== 'overview') host.append(searchBox(api, state));

    if (state.tab === 'overview') host.append(overviewView(api, state, monitor, context));
    else if (state.tab === 'providers') host.append(dualProviderView(api, state, extraA, extraB));
    else if (state.tab === 'buyers') host.append(rankPanel('Compradores · ChileCompra', state.q ? `Búsqueda: “${state.q}”` : 'Organismos compradores publicados por el contrato v2.', extraA?.items, 'buyer', api, state));
    else if (state.tab === 'relations') host.append(node('div', { class: 'atlas-v2-gp-grid' }, [
      rankPanel('Pares comprador–proveedor · ChileCompra', 'Relaciones de compra pública.', extraA?.items, 'pair', api, state),
      rankPanel('Flujos servicio–proveedor · Presupuesto Abierto', 'Relaciones presupuestarias materializadas.', extraB?.items, 'relation', api, state),
    ]));
    else if (state.tab === 'findings') host.append(rankPanel('Hallazgos explicables', 'Señales de priorización publicadas por backend. Deben contrastarse antes de cualquier inferencia.', extraA?.items, 'finding', api, state));
  }

  function render(container, route, api) {
    injectStyle();
    controller?.abort();
    controller = new AbortController();
    const serial = ++renderSerial;
    const state = routeState(route);
    container.append(pageHead(), tabs(api, state));
    const host = node('div', { class: 'atlas-v2-gp-host' }, [loading()]);
    container.append(host);
    const signal = controller.signal;
    void load(api, host, state, serial, signal).catch(error => {
      if (serial !== renderSerial || signal.aborted || !host.isConnected) return;
      clear(host); host.append(errorView(error, api, state));
    });
  }

  function register() {
    if (!global.AtlasV2Shell?.registerSurface) return false;
    global.AtlasV2Shell.registerSurface('gasto-publico', render);
    global.__ATLAS_V2_PUBLIC_SPEND_SURFACE__ = Object.freeze({ installed: true, route: 'gasto-publico', mode: 'native-v2' });
    return true;
  }

  if (!register()) global.addEventListener('atlas:v2-shell-ready', register, { once: true });
})(window);
