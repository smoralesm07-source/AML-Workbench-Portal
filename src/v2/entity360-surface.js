'use strict';

(function installAtlasV2Entity360Surface(global) {
  if (global.__ATLAS_V2_ENTITY360_SURFACE__) return;
  const scriptBase = new URL('./', document.currentScript?.src || document.baseURI);
  const NF = new Intl.NumberFormat('es-CL');
  let renderSerial = 0;
  let searchSerial = 0;

  function node(tag, attrs = {}, children = []) {
    const element = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value == null) return;
      if (key === 'class') element.className = value;
      else if (key === 'text') element.textContent = String(value);
      else if (key.startsWith('on') && typeof value === 'function') element.addEventListener(key.slice(2).toLowerCase(), value);
      else element.setAttribute(key, String(value));
    });
    (Array.isArray(children) ? children : [children]).forEach(child => {
      if (child == null) return;
      element.append(child instanceof Node ? child : document.createTextNode(String(child)));
    });
    return element;
  }

  function clear(element) { while (element?.firstChild) element.removeChild(element.firstChild); }

  function injectStyle() {
    if (document.getElementById('atlas-v2-entity360-style')) return;
    const link = document.createElement('link');
    link.id = 'atlas-v2-entity360-style';
    link.rel = 'stylesheet';
    link.href = new URL('entity360-surface.css?v=2', scriptBase).href;
    document.head.appendChild(link);
  }

  function money(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n === 0) return '—';
    const a = Math.abs(n);
    if (a >= 1e12) return `$${(n / 1e12).toLocaleString('es-CL', { maximumFractionDigits: 2 })} bill.`;
    if (a >= 1e9) return `$${(n / 1e9).toLocaleString('es-CL', { maximumFractionDigits: 1 })} mil M`;
    if (a >= 1e6) return `$${(n / 1e6).toLocaleString('es-CL', { maximumFractionDigits: 1 })} M`;
    return `$${NF.format(Math.round(n))}`;
  }

  function fmt(value, digits = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString('es-CL', { maximumFractionDigits: digits }) : '—';
  }

  function sourceLabel(source) {
    return ({ PRESS: 'Radar Prensa', UAF_NAME: 'Nombre UAF', CANONICAL: 'Entidad canónica' })[String(source || '').toUpperCase()] || 'Entidad';
  }

  function matchLabel(type) {
    return ({ rut_exact: 'RUT exacto', name_exact: 'Nombre exacto', name_prefix: 'Nombre comienza con', name_fuzzy: 'Nombre similar', alias_exact: 'Denominación UAF exacta', alias_prefix: 'Denominación UAF relacionada' })[type] || 'Coincidencia';
  }

  function pageHead(reference = {}) {
    const label = reference.name || reference.rut || '';
    return node('header', { class: 'atlas-v2-pagehead atlas-v2-e360-pagehead' }, [
      node('div', { class: 'atlas-v2-eyebrow', text: 'EXPLORADOR DE IDENTIDAD · ENTIDAD 360' }),
      node('h1', { text: label || 'Entidad 360' }),
      node('p', { text: label
        ? 'Concentra identidad, trayectoria y contexto por fuente. Una coincidencia nominal o de prensa se mantiene separada de una identidad resuelta.'
        : 'Busca por RUT, razón social, denominación UAF o entidad observada en prensa. Atlas explica por qué encontró cada coincidencia antes de abrir el expediente analítico.' }),
    ]);
  }

  function routeForResult(item) {
    const params = { entity_id: item.entityId, q: item.name || item.matchedLabel || '' };
    if (item.rut) params.rut = item.rut;
    return params;
  }

  function resultRow(api, item) {
    const source = sourceLabel(item.matchSource);
    const pressOnly = item.matchSource === 'PRESS' && !item.rut;
    return node('button', {
      type: 'button',
      class: `atlas-v2-e360-search-result ${pressOnly ? 'is-press' : ''}`,
      onclick: () => api.navigate('entidad', routeForResult(item)),
    }, [
      node('span', { class: `atlas-v2-e360-source-tag ${String(item.matchSource || '').toLowerCase()}`, text: source }),
      node('div', { class: 'atlas-v2-e360-search-copy' }, [
        node('strong', { text: item.name || item.matchedLabel || 'Entidad sin etiqueta' }),
        node('span', { text: [item.rut, item.entityType, item.commune, item.region].filter(Boolean).join(' · ') || 'Sin RUT resuelto' }),
        item.matchedLabel && item.matchedLabel !== item.name ? node('small', { text: `Coincidió como: ${item.matchedLabel}` }) : null,
      ]),
      node('div', { class: 'atlas-v2-e360-match' }, [
        node('b', { text: matchLabel(item.matchType) }),
        node('span', { text: `${Math.round((item.matchScore || 0) * 100)}% similitud` }),
        pressOnly && item.eventCount ? node('small', { text: `${NF.format(item.eventCount)} evento(s) de prensa` }) : null,
      ]),
    ]);
  }

  async function runSearch(api, query, host, serial) {
    const q = String(query || '').trim();
    if (q.length < 2) { clear(host); return; }
    clear(host);
    host.append(node('div', { class: 'atlas-v2-e360-search-loading', text: 'Buscando coincidencias en entidades, UAF y prensa…' }));
    try {
      const out = await global.AtlasV2EntitySearch.search(q, { limit: 20, route: `entidad:search:${q.slice(0, 48)}` });
      if (serial !== searchSerial || !host.isConnected) return;
      clear(host);
      const items = out.items || [];
      if (!items.length) {
        host.append(node('div', { class: 'atlas-v2-empty' }, [
          node('strong', { text: 'Sin coincidencias en los índices disponibles' }),
          node('span', { text: 'Esto no confirma inexistencia. Prueba otra denominación, alias o RUT.' }),
        ]));
        return;
      }
      host.append(node('div', { class: 'atlas-v2-e360-search-head' }, [
        node('div', {}, [node('strong', { text: `${NF.format(items.length)} coincidencia(s)` }), node('span', { text: 'Ordenadas por calidad de resolución, no por riesgo.' })]),
        node('small', { text: 'Entidad · UAF · Radar Prensa' }),
      ]));
      const list = node('div', { class: 'atlas-v2-e360-search-results' });
      items.forEach(item => list.append(resultRow(api, item)));
      host.append(list, node('div', { class: 'atlas-v2-e360-rule' }, [
        node('strong', { text: 'Cómo leer esto. ' }),
        'Una coincidencia aproximada sólo propone una ruta de exploración. Las entidades de prensa sin RUT permanecen como contexto OSINT y no se fusionan automáticamente con una identidad tributaria.',
      ]));
    } catch (error) {
      if (serial !== searchSerial || !host.isConnected) return;
      clear(host);
      host.append(node('div', { class: 'atlas-v2-e360-source-error' }, [
        node('strong', { text: 'No fue posible completar la búsqueda transversal.' }),
        node('span', { text: String(error?.message || error) }),
      ]));
    }
  }

  function searchBox(api, initial = '', resultsHost = null) {
    const input = node('input', {
      type: 'search',
      value: initial,
      placeholder: 'RUT, razón social, nombre UAF o entidad en prensa…',
      'aria-label': 'Buscar entidad por RUT, nombre o fuente',
      autocomplete: 'off',
    });
    let timer = null;
    const submit = () => {
      const value = input.value.trim();
      if (!value) return;
      if (global.AtlasV2Entity360?.validRutShape(value)) return api.navigate('entidad', { rut: global.AtlasV2Entity360.canonicalRut(value) });
      api.navigate('entidad', { q: value });
    };
    input.addEventListener('keydown', event => { if (event.key === 'Enter') submit(); });
    if (resultsHost) {
      input.addEventListener('input', () => {
        clearTimeout(timer);
        const q = input.value.trim();
        if (q.length < 2) { clear(resultsHost); return; }
        const serial = ++searchSerial;
        timer = setTimeout(() => void runSearch(api, q, resultsHost, serial), 220);
      });
    }
    return node('div', { class: 'atlas-v2-querybox atlas-v2-entity-search' }, [
      input,
      node('button', { class: 'atlas-v2-button primary', type: 'button', text: 'Buscar', onclick: submit }),
    ]);
  }

  function lensBar(core) {
    const available = core?.sourceStatus || {};
    const spec = [
      ['Identidad', 'identity'], ['Tributario', 'tax'], ['UAF', 'uaf'], ['RES', 'identity'], ['Sanciones', 'sanctions'], ['Gasto público', 'spend'], ['Relaciones', 'relations'], ['Cronología', 'history'],
    ];
    return node('div', { class: 'atlas-v2-lensbar' }, spec.map(([label, key]) => node('span', {
      class: `atlas-v2-chip ${available[key] === 'AVAILABLE' ? 'is-live' : ''}`,
      text: label,
    })));
  }

  function statusBadge(status) {
    const labels = { ready: 'Conectado', unavailable: 'No publicado', error: 'Error de lectura', invalid: 'Entrada inválida', skipped: 'No aplica' };
    return node('span', { class: `atlas-v2-e360-status ${status || 'unavailable'}`, text: labels[status] || status || 'Sin estado' });
  }

  function analyticalMoves(api, reference) {
    const params = {};
    if (reference?.rut) params.rut = reference.rut;
    if (reference?.entityId) params.entity_id = reference.entityId;
    const wrap = node('section', { class: 'atlas-v2-section atlas-v2-e360-moves' }, [
      node('div', { class: 'atlas-v2-section-head' }, [
        node('div', {}, [node('h2', { text: 'Seguir investigando' }), node('p', { text: 'La identidad viaja con la navegación; ninguna acción crea un caso o tarea.' })]),
      ]),
    ]);
    const grid = node('div', { class: 'atlas-v2-grid three' });
    [
      ['GASTO PÚBLICO', 'Comportamiento económico', 'Compras, dependencia y contexto presupuestario.', 'gasto-publico'],
      ['RELACIONES', 'Red de vínculos', 'Representantes, sociedades, domicilios y contrapartes.', 'relaciones'],
      ['TERRITORIO', 'Contexto territorial', 'Región, comuna y patrones geográficos comparables.', 'territorio'],
    ].forEach(([tag, title, description, route]) => {
      grid.append(node('button', { class: 'atlas-v2-card', type: 'button', onclick: () => api.navigate(route, params) }, [
        node('span', { class: 'atlas-v2-card-tag', text: tag }), node('h3', { text: title }), node('p', { text: description }), node('div', { class: 'atlas-v2-card-foot', text: 'Abrir manteniendo contexto →' }),
      ]));
    });
    wrap.append(grid);
    return wrap;
  }

  function identityHero(core) {
    const identity = core?.identity || {};
    const press = identity.sources.includes('RADAR_PRENSA');
    return node('section', { class: 'atlas-v2-e360-hero' }, [
      node('div', { class: 'atlas-v2-e360-hero-main' }, [
        node('span', { class: 'atlas-v2-card-tag', text: press && !identity.rut ? 'ENTIDAD OBSERVADA · PRENSA' : 'IDENTIDAD RESUELTA' }),
        node('h2', { text: identity.name || 'Entidad sin nombre publicado' }),
        node('p', { text: [identity.rut, identity.entityType, identity.activity].filter(Boolean).join(' · ') || 'Sin RUT resuelto; se conserva como entidad de fuente.' }),
        node('div', { class: 'atlas-v2-e360-source-pills' }, identity.sources.map(source => node('span', { text: source.replace(/^RADAR_/, '') }))),
      ]),
      node('div', { class: 'atlas-v2-e360-hero-kpis' }, [
        node('div', {}, [node('span', { text: 'Fuentes' }), node('strong', { text: fmt(identity.sources.length || Object.values(core?.sourceStatus || {}).filter(v => v === 'AVAILABLE').length) })]),
        node('div', {}, [node('span', { text: press ? 'Eventos fuente' : 'Estado' }), node('strong', { text: press ? fmt(identity.eventCount) : (identity.status || 'No informado') })]),
        node('div', {}, [node('span', { text: 'Territorio' }), node('strong', { text: [identity.commune, identity.region].filter(Boolean).join(' · ') || 'No informado' })]),
      ]),
    ]);
  }

  function metric(label, value, detail = '') {
    return node('div', { class: 'atlas-v2-e360-metric' }, [node('span', { text: label }), node('strong', { text: value || '—' }), detail ? node('small', { text: detail }) : null]);
  }

  function taxPanel(core) {
    const tax = core?.data?.tax || {};
    return node('section', { class: 'atlas-v2-e360-panel' }, [
      node('div', { class: 'atlas-v2-e360-panel-head' }, [node('div', {}, [node('span', { class: 'atlas-v2-card-tag', text: 'SII' }), node('h2', { text: 'Perfil tributario' })]), statusBadge(core?.sourceStatus?.tax === 'AVAILABLE' ? 'ready' : 'unavailable')]),
      node('div', { class: 'atlas-v2-e360-metric-grid' }, [
        metric('Tramo ventas', tax.sales_band || tax.sales_band_code),
        metric('Trabajadores', fmt(tax.workers_numeric)),
        metric('Inicio actividades', tax.activity_start_date),
        metric('Término giro', tax.termination_date || 'No observado'),
        metric('Giros / actividades', fmt(tax.activity_count)),
        metric('Domicilios', fmt(tax.address_count)),
      ]),
      tax.main_activity ? node('p', { class: 'atlas-v2-e360-panel-note', text: tax.main_activity }) : null,
    ]);
  }

  function trajectoryPanel(core) {
    const history = Array.isArray(core?.data?.history) ? core.data.history.slice().sort((a, b) => Number(a.commercial_year) - Number(b.commercial_year)) : [];
    const panel = node('section', { class: 'atlas-v2-e360-panel atlas-v2-e360-trajectory' }, [
      node('div', { class: 'atlas-v2-e360-panel-head' }, [
        node('div', {}, [node('span', { class: 'atlas-v2-card-tag', text: 'TRAYECTORIA SII' }), node('h2', { text: 'Evolución de escala y empleo' }), node('p', { text: 'Selecciona un año para leer el cambio sin abandonar la ficha.' })]),
        statusBadge(history.length ? 'ready' : 'unavailable'),
      ]),
    ]);
    if (!history.length || !global.AtlasV2Viz) {
      panel.append(node('div', { class: 'atlas-v2-empty' }, [node('strong', { text: 'Sin serie histórica disponible' }), node('span', { text: 'La ausencia de historia no se interpreta como estabilidad.' })]));
      return panel;
    }
    const detail = node('div', { class: 'atlas-v2-e360-year-detail' });
    const showYear = row => {
      clear(detail);
      detail.append(
        metric('Año', String(row.commercial_year || '—')),
        metric('Tramo ventas', row.sales_band_code || `Rango ${fmt(row.sales_band_rank)}`),
        metric('Trabajadores', fmt(row.workers_numeric)),
        metric('Actividad', row.main_activity || 'No informada'),
      );
    };
    showYear(history[history.length - 1]);
    const charts = node('div', { class: 'atlas-v2-e360-chart-grid' }, [
      node('div', { class: 'atlas-v2-e360-chart-block' }, [
        node('h3', { text: 'Escala de ventas' }),
        global.AtlasV2Viz.lineChart(history.map(row => ({ label: row.commercial_year, value: row.sales_band_rank || 0, display: row.sales_band_code || fmt(row.sales_band_rank), raw: row })), { ariaLabel: 'Evolución del tramo de ventas', onSelect: item => showYear(item.raw) }),
      ]),
      node('div', { class: 'atlas-v2-e360-chart-block' }, [
        node('h3', { text: 'Trabajadores informados' }),
        global.AtlasV2Viz.lineChart(history.map(row => ({ label: row.commercial_year, value: row.workers_numeric || 0, display: fmt(row.workers_numeric), raw: row })), { ariaLabel: 'Evolución de trabajadores', onSelect: item => showYear(item.raw) }),
      ]),
    ]);
    panel.append(charts, detail);
    return panel;
  }

  function contextPanel(core) {
    const uaf = core?.data?.uaf || {};
    const sanctions = core?.data?.sanctions || {};
    const spend = core?.data?.spend || {};
    const cards = [
      { tag: 'UAF', title: Array.isArray(uaf.sector_names) ? uaf.sector_names.join(' · ') : 'Sin sector observado', value: Array.isArray(uaf.registry_names) ? `${uaf.registry_names.length} denominación(es)` : '—', status: core?.sourceStatus?.uaf },
      { tag: 'SANCIONES', title: `${fmt(sanctions.sanction_event_count)} evento(s)`, value: Array.isArray(sanctions.regulators) ? sanctions.regulators.join(' · ') : 'Sin regulador observado', status: core?.sourceStatus?.sanctions },
      { tag: 'GASTO', title: money(spend.total_clp), value: spend.order_count ? `${fmt(spend.order_count)} orden(es) · ${fmt(spend.buyer_count)} comprador(es)` : 'Sin monto materializado', status: core?.sourceStatus?.spend },
    ];
    return node('section', { class: 'atlas-v2-e360-context-grid' }, cards.map(card => node('article', { class: 'atlas-v2-e360-context-card' }, [
      node('div', { class: 'atlas-v2-e360-context-top' }, [node('span', { class: 'atlas-v2-card-tag', text: card.tag }), statusBadge(card.status === 'AVAILABLE' ? 'ready' : 'unavailable')]),
      node('strong', { text: card.title }), node('p', { text: card.value }),
    ])));
  }

  function publicSpendPanel(state, api, rut) {
    const panel = node('section', { class: 'atlas-v2-e360-panel' }, [
      node('div', { class: 'atlas-v2-e360-panel-head' }, [
        node('div', {}, [node('span', { class: 'atlas-v2-card-tag', text: 'GASTO PÚBLICO' }), node('h2', { text: 'Huella como proveedor' }), node('p', { text: 'Compras y ejecución permanecen separadas por dominio.' })]),
        statusBadge(state?.status),
      ]),
    ]);
    if (state?.status === 'skipped') {
      panel.append(node('div', { class: 'atlas-v2-empty' }, [node('strong', { text: 'Sin RUT resuelto para cruzar gasto público' }), node('span', { text: 'La entidad permanece explorable en su fuente original; Atlas no fuerza una identidad tributaria.' })]));
      return panel;
    }
    const all = [
      ...(state?.procurement?.items || []).map(item => ({ ...item, source: 'ChileCompra' })),
      ...(state?.budget?.items || []).map(item => ({ ...item, source: 'Presupuesto Abierto' })),
    ].filter(item => item.amount > 0).sort((a, b) => b.amount - a.amount).slice(0, 8);
    if (!all.length || !global.AtlasV2Viz) {
      panel.append(node('div', { class: 'atlas-v2-empty' }, [node('strong', { text: 'Sin coincidencias materializadas' }), node('span', { text: 'No observado en esta lectura no equivale a inexistencia.' })]));
      return panel;
    }
    panel.append(global.AtlasV2Viz.horizontalBars(all.map(item => ({ label: item.name || item.rut || 'Proveedor', detail: item.source, value: item.amount, display: money(item.amount), raw: item })), {
      limit: 8,
      onSelect: () => api.navigate('gasto-publico', { rut }),
    }));
    return panel;
  }

  function loadingPanel() {
    return node('div', { class: 'atlas-v2-e360-loading', role: 'status' }, [node('strong', { text: 'Construyendo vista 360…' }), node('span', { text: 'Identidad, tributario, UAF, sanciones, trayectoria y gasto se leen por separado.' })]);
  }

  async function resolve(container, api, reference, serial) {
    const host = node('div', { class: 'atlas-v2-e360-live' }, [loadingPanel()]);
    container.append(host);
    let result;
    try { result = await global.AtlasV2Entity360.read(reference); }
    catch (error) { result = { status: 'unavailable', reference, core: { status: 'error', message: String(error?.message || error) }, publicSpend: {} }; }
    if (serial !== renderSerial || !host.isConnected) return;
    clear(host);
    if (result.status === 'invalid') {
      host.append(node('div', { class: 'atlas-v2-notice' }, [node('strong', { text: result.message })]));
      return;
    }
    const resolved = { entityId: result.entityId || reference.entityId, rut: result.rut || reference.rut, name: result.core?.identity?.name || reference.name };
    host.append(
      identityHero(result.core),
      lensBar(result.core),
      node('div', { class: 'atlas-v2-e360-grid' }, [taxPanel(result.core), trajectoryPanel(result.core)]),
      contextPanel(result.core),
      publicSpendPanel(result.publicSpend, api, resolved.rut),
      node('div', { class: 'atlas-v2-e360-rule' }, [
        node('strong', { text: 'Regla de interpretación. ' }),
        'Prensa, sanciones, concentración económica, trayectoria tributaria y relaciones son contextos distintos. Ninguno se convierte automáticamente en señal LA/FT ni transfiere riesgo entre entidades.',
      ]),
      analyticalMoves(api, resolved),
    );
  }

  function renderSearch(container, route, api, query) {
    const host = node('div', { class: 'atlas-v2-e360-search-host' });
    container.append(pageHead({}), searchBox(api, query, host), host);
    const serial = ++searchSerial;
    void runSearch(api, query, host, serial);
  }

  function render(container, route, api) {
    injectStyle();
    const serial = ++renderSerial;
    const rutRaw = route.params.get('rut') || '';
    const entityId = route.params.get('entity_id') || '';
    const query = route.params.get('q') || '';
    const rut = global.AtlasV2Entity360?.validRutShape(rutRaw) ? global.AtlasV2Entity360.canonicalRut(rutRaw) : '';

    if (!entityId && !rut && query) {
      renderSearch(container, route, api, query);
      return;
    }

    if (!entityId && !rut) {
      const host = node('div', { class: 'atlas-v2-e360-search-host' });
      container.append(pageHead({}), searchBox(api, '', host), host, node('section', { class: 'atlas-v2-e360-discovery' }, [
        node('strong', { text: 'Una sola puerta de entrada a la identidad' }),
        node('p', { text: 'Busca nombres exactos o aproximados, RUT, denominaciones UAF y entidades observadas en Radar Prensa. Cada resultado conserva su método de coincidencia.' }),
      ]));
      return;
    }

    const reference = { entityId: entityId || global.AtlasV2Entity360.entityIdFromRut(rut), rut, name: query };
    container.append(pageHead(reference), searchBox(api, query || rut));
    void resolve(container, api, reference, serial);
  }

  function register() {
    if (!global.AtlasV2Shell?.registerSurface) return false;
    global.AtlasV2Shell.registerSurface('entidad', render);
    global.__ATLAS_V2_ENTITY360_SURFACE__ = Object.freeze({ installed: true, route: 'entidad', mode: 'identity-explorer' });
    return true;
  }

  if (!register()) global.addEventListener('atlas:v2-shell-ready', register, { once: true });
})(window);