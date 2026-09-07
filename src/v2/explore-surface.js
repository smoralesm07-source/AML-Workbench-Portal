'use strict';

(function installAtlasV2ExploreSurface(global) {
  if (global.__ATLAS_V2_EXPLORE_SURFACE__) return;

  const scriptBase = new URL('./', document.currentScript?.src || document.baseURI);
  const NF = new Intl.NumberFormat('es-CL');
  let renderSerial = 0;

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
    if (document.getElementById('atlas-v2-explore-style')) return;
    document.head.appendChild(node('link', {
      id: 'atlas-v2-explore-style',
      rel: 'stylesheet',
      href: new URL('explore-surface.css?v=legacy-power-1', scriptBase).href,
    }));
  }

  function fmt(value, digits = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString('es-CL', { maximumFractionDigits: digits }) : '—';
  }

  function compact(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    if (Math.abs(n) >= 1e6) return `${(n / 1e6).toLocaleString('es-CL', { maximumFractionDigits: 2 })} M`;
    if (Math.abs(n) >= 1e3) return `${(n / 1e3).toLocaleString('es-CL', { maximumFractionDigits: 1 })} mil`;
    return NF.format(n);
  }

  function formatDate(value) {
    if (!value) return 'corte no informado';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  function looksLikeRut(value) {
    return /^\d{1,2}\.?\d{3}\.?\d{3}-?[0-9kK]$/.test(String(value || '').replace(/\s/g, ''));
  }

  function routeQuery(api, value) {
    const query = String(value || '').trim();
    if (!query) return;
    if (looksLikeRut(query)) return api.navigate('entidad', { rut: query });
    const normalized = query.toLocaleLowerCase('es-CL');
    if (/compra|proveedor|licit|gasto|presupuesto/.test(normalized)) return api.navigate('gasto-publico', { q: query });
    if (/comuna|regi[oó]n|territor|geograf/.test(normalized)) return api.navigate('territorio', { q: query });
    if (/relaci|red|v[ií]ncul|representante|socio/.test(normalized)) return api.navigate('relaciones', { q: query });
    if (/cambio|señal|senal|vigil|snapshot|fuente/.test(normalized)) return api.navigate('vigilancia', { q: query });
    return api.navigate('entidad', { q: query });
  }

  function queryBox(api) {
    const input = node('input', {
      type: 'search',
      placeholder: 'RUT, razón social, entidad en prensa, proveedor, sector, región o pregunta analítica…',
      'aria-label': 'Buscar o iniciar una pregunta analítica',
      autocomplete: 'off',
    });
    const submit = () => routeQuery(api, input.value);
    input.addEventListener('keydown', event => { if (event.key === 'Enter') submit(); });
    return node('div', { class: 'atlas-v2-explore-query' }, [
      node('span', { class: 'atlas-v2-explore-query-icon', text: '⌕' }),
      input,
      node('button', { class: 'atlas-v2-button primary', type: 'button', text: 'Explorar', onclick: submit }),
    ]);
  }

  function hero(api, live) {
    return node('header', { class: 'atlas-v2-explore-hero' }, [
      node('div', { class: 'atlas-v2-explore-hero-grid' }, [
        node('div', { class: 'atlas-v2-explore-hero-copy' }, [
          node('div', { class: 'atlas-v2-eyebrow', text: 'ATLAS 2 · RADAR INTEGRADO' }),
          node('h1', { text: 'Inteligencia analítica, en una sola superficie' }),
          node('p', { text: 'Recuperamos la lógica de la portada original de Atlas: lectura rápida del universo, señales, territorio y gasto público, con cada gráfico actuando como control para profundizar sin perder el contexto.' }),
          queryBox(api),
          node('div', { class: 'atlas-v2-explore-meta' }, [
            node('span', { text: 'Universos gobernados' }),
            node('span', { text: 'Vigilancia por snapshot' }),
            node('span', { text: 'Territorio contextual' }),
            node('span', { text: 'Gasto público' }),
          ]),
        ]),
        node('div', { class: 'atlas-v2-explore-hero-stat' }, [
          node('span', { text: 'SEÑALES VIGENTES' }),
          live.alerts,
          live.alertDetail,
          node('small', { text: 'Indicador de atención del snapshot, no probabilidad ni atribución LA/FT.' }),
        ]),
      ]),
      node('div', { class: 'atlas-v2-explore-finding' }, [
        node('div', { class: 'atlas-v2-explore-finding-icon', text: '◎' }),
        node('div', {}, [
          node('strong', { text: 'Lectura integrada' }),
          live.finding,
        ]),
      ]),
    ]);
  }

  function deckHead(index, title, description, action) {
    return node('div', { class: 'atlas-v2-explore-deck-head' }, [
      node('span', { class: 'atlas-v2-explore-deck-index', text: index }),
      node('h2', { text: title }),
      node('p', { text: description }),
      action ? node('button', { class: 'atlas-v2-explore-link', type: 'button', text: 'Abrir análisis →', onclick: action }) : null,
    ]);
  }

  function skeleton(label) {
    return node('article', { class: 'atlas-v2-explore-panel is-loading', 'aria-busy': 'true' }, [
      node('div', { class: 'atlas-v2-explore-panel-head' }, [
        node('div', {}, [node('span', { class: 'atlas-v2-card-tag', text: label }), node('h3', { text: 'Actualizando…' })]),
        node('span', { class: 'atlas-v2-explore-status', text: 'LEYENDO' }),
      ]),
      node('div', { class: 'atlas-v2-explore-skeleton chart' }),
      node('div', { class: 'atlas-v2-explore-skeleton short' }),
    ]);
  }

  function unavailable(label, title, error, retry) {
    return node('article', { class: 'atlas-v2-explore-panel is-error' }, [
      node('div', { class: 'atlas-v2-explore-panel-head' }, [
        node('div', {}, [node('span', { class: 'atlas-v2-card-tag', text: label }), node('h3', { text: title })]),
        node('span', { class: 'atlas-v2-explore-status', text: 'NO DISPONIBLE' }),
      ]),
      node('p', { class: 'atlas-v2-explore-copy', text: 'Esta lectura no respondió ahora. El resto del radar continúa operativo.' }),
      node('div', { class: 'atlas-v2-explore-foot' }, [
        error?.traceId ? node('small', { text: `Trazabilidad: ${error.traceId}` }) : node('small', { text: 'No se infiere ausencia de datos.' }),
        node('button', { class: 'atlas-v2-button', type: 'button', text: 'Reintentar', onclick: retry }),
      ]),
    ]);
  }

  function universePanel(out, api) {
    const rows = (out.items || []).map(item => ({
      label: ({ SII: 'SII', UAF: 'UAF / SO', OSFL: 'OSFL', RES: 'RES', SANCIONES: 'Sanciones' })[String(item.lens || '').toUpperCase()] || item.lens,
      detail: 'personas / entidades observadas',
      value: Number(item.total_count || 0),
      display: compact(item.total_count),
      lens: String(item.lens || '').toUpperCase(),
    })).sort((a, b) => b.value - a.value);
    const totalLargest = rows[0]?.value || 0;
    const panel = node('article', { class: 'atlas-v2-explore-panel atlas-v2-explore-panel-primary' }, [
      node('div', { class: 'atlas-v2-explore-panel-head' }, [
        node('div', {}, [node('span', { class: 'atlas-v2-card-tag', text: 'UNIVERSOS' }), node('h3', { text: 'Cobertura observada' })]),
        node('button', { class: 'atlas-v2-explore-link', type: 'button', text: 'Ver universos →', onclick: () => api.navigate('universos') }),
      ]),
      node('p', { class: 'atlas-v2-explore-panel-intro', text: 'Lectura comparativa de las lentes poblacionales disponibles. Selecciona una barra para entrar directamente a ese universo.' }),
    ]);
    panel.append(node('div', { class: 'atlas-v2-explore-chart atlas-v2-explore-chart-tall' }, [
      global.AtlasV2Viz.horizontalBars(rows, { limit: 7, onSelect: item => api.navigate('universos', { lens: item.lens }) }),
    ]));
    panel.append(node('div', { class: 'atlas-v2-explore-panel-summary' }, [
      node('span', {}, [node('b', { text: compact(totalLargest) }), ' mayor cobertura individual']),
      node('span', {}, [node('b', { text: fmt(rows.length) }), ' lentes observadas']),
    ]));
    panel.append(node('small', { class: 'atlas-v2-explore-source', text: `Corte read model · ${formatDate(out.generatedAt || out.meta?.snapshot)}` }));
    return panel;
  }

  function watchPanel(out, api) {
    const s = out.summary || {};
    const other = Math.max(0, Number(s.alert_count || 0) - Number(s.very_high_count || 0) - Number(s.high_count || 0));
    const rows = [
      { label: 'Muy alta', value: Number(s.very_high_count || 0), display: fmt(s.very_high_count), severity: 'VERY_HIGH' },
      { label: 'Alta', value: Number(s.high_count || 0), display: fmt(s.high_count), severity: 'HIGH' },
      { label: 'Otras vigentes', value: other, display: fmt(other), severity: 'OTHER' },
    ];
    const panel = node('article', { class: 'atlas-v2-explore-panel atlas-v2-explore-panel-watch' }, [
      node('div', { class: 'atlas-v2-explore-panel-head' }, [
        node('div', {}, [node('span', { class: 'atlas-v2-card-tag', text: 'VIGILANCIA' }), node('h3', { text: 'Señales que cambiaron la atención' })]),
        node('button', { class: 'atlas-v2-explore-link', type: 'button', text: 'Abrir vigilancia →', onclick: () => api.navigate('vigilancia') }),
      ]),
      node('div', { class: 'atlas-v2-explore-bigline' }, [
        node('strong', { text: fmt(s.alert_count) }),
        node('span', { text: `señales vigentes · ${fmt(s.family_count)} familias` }),
      ]),
    ]);
    panel.append(node('div', { class: 'atlas-v2-explore-chart' }, [
      global.AtlasV2Viz.segmented(rows, { onSelect: item => api.navigate('vigilancia', { severity: item.severity }) }),
    ]));
    panel.append(node('div', { class: 'atlas-v2-explore-watch-stats' }, rows.map(row => node('button', {
      type: 'button',
      onclick: () => api.navigate('vigilancia', { severity: row.severity }),
    }, [node('span', { text: row.label }), node('b', { text: row.display })]))));
    panel.append(node('p', { class: 'atlas-v2-explore-copy', text: out.comparison?.available
      ? 'La comparación está habilitada: abre Vigilancia para revisar NEW, CHANGED y REMOVED.'
      : 'Baseline inicial: todavía no corresponde inferir estabilidad ni ausencia de cambios.' }));
    panel.append(node('small', { class: 'atlas-v2-explore-source', text: `Snapshot · ${out.snapshotId || formatDate(out.generatedAt)}` }));
    return panel;
  }

  function territoryPanel(out, api) {
    const rows = (out.items || []).filter(item => item.region)
      .sort((a, b) => Number(b.igr_mean || 0) - Number(a.igr_mean || 0)).slice(0, 8)
      .map(item => ({
        label: item.region,
        detail: `${fmt(item.commune_count)} comuna(s)`,
        value: Number(item.igr_mean || 0),
        display: fmt(item.igr_mean, 1),
        region: item.region,
      }));
    const panel = node('article', { class: 'atlas-v2-explore-panel' }, [
      node('div', { class: 'atlas-v2-explore-panel-head' }, [
        node('div', {}, [node('span', { class: 'atlas-v2-card-tag', text: 'TERRITORIO' }), node('h3', { text: 'Contexto geográfico' })]),
        node('button', { class: 'atlas-v2-explore-link', type: 'button', text: 'Abrir territorio →', onclick: () => api.navigate('territorio') }),
      ]),
    ]);
    panel.append(node('div', { class: 'atlas-v2-explore-chart' }, [
      global.AtlasV2Viz.horizontalBars(rows, { limit: 7, onSelect: item => api.navigate('territorio', { region: item.region }) }),
    ]));
    panel.append(node('div', { class: 'atlas-v2-explore-guardrail', text: 'IGR = contexto territorial beta. No se hereda como riesgo de una entidad.' }));
    panel.append(node('small', { class: 'atlas-v2-explore-source', text: `Corte territorial · ${formatDate(out.generatedAt || out.meta?.snapshot)}` }));
    return panel;
  }

  function publicSpendPanel(out, api) {
    const availability = out?.data?.availability || {};
    const procurement = out?.data?.domains?.procurement?.summary || {};
    const rows = [
      { label: 'Proveedores', value: Number(procurement.supplier_count || 0), display: compact(procurement.supplier_count), view: 'suppliers' },
      { label: 'Compradores', value: Number(procurement.buyer_count || 0), display: compact(procurement.buyer_count), view: 'buyers' },
    ];
    const panel = node('article', { class: 'atlas-v2-explore-panel' }, [
      node('div', { class: 'atlas-v2-explore-panel-head' }, [
        node('div', {}, [node('span', { class: 'atlas-v2-card-tag', text: 'GASTO PÚBLICO' }), node('h3', { text: 'Compras y ejecución' })]),
        node('button', { class: 'atlas-v2-explore-link', type: 'button', text: 'Abrir gasto público →', onclick: () => api.navigate('gasto-publico') }),
      ]),
      node('div', { class: 'atlas-v2-explore-spend-status' }, [
        node('span', {}, [node('i', { class: availability.procurement ? 'ok' : '' }), `ChileCompra · ${availability.procurement || 'sin estado'}`]),
        node('span', {}, [node('i', { class: availability.budget_execution ? 'ok' : '' }), `Presupuesto Abierto · ${availability.budget_execution || 'sin estado'}`]),
      ]),
    ]);
    panel.append(node('div', { class: 'atlas-v2-explore-chart' }, [
      global.AtlasV2Viz.horizontalBars(rows, { limit: 2, onSelect: item => api.navigate('gasto-publico', { tab: item.view }) }),
    ]));
    panel.append(node('div', { class: 'atlas-v2-explore-panel-summary' }, [
      node('span', {}, [node('b', { text: compact(procurement.supplier_count) }), ' proveedores']),
      node('span', {}, [node('b', { text: compact(procurement.buyer_count) }), ' compradores']),
    ]));
    panel.append(node('p', { class: 'atlas-v2-explore-copy', text: 'Compras y ejecución permanecen como dominios paralelos; sus montos no se mezclan.' }));
    panel.append(node('small', { class: 'atlas-v2-explore-source', text: `Monitor · ${out.snapshotId || out.meta?.snapshot || 'snapshot no informado'}` }));
    return panel;
  }

  function analysisCard(tag, title, description, signal, action) {
    return node('button', { class: 'atlas-v2-explore-analysis-card', type: 'button', onclick: action }, [
      node('span', { class: 'atlas-v2-card-tag', text: tag }),
      node('h3', { text: title }),
      node('p', { text: description }),
      node('div', { class: 'atlas-v2-explore-analysis-foot' }, [node('span', { text: signal }), node('b', { text: 'Abrir →' })]),
    ]);
  }

  function analysisMatrix(api) {
    return node('section', { class: 'atlas-v2-explore-deck' }, [
      deckHead('03', 'Matriz de análisis', 'Entradas directas a las capacidades de Atlas, sin convertir la exploración en un flujo obligatorio.'),
      node('div', { class: 'atlas-v2-explore-analysis-grid' }, [
        analysisCard('ENTIDAD 360', 'Explorar una entidad', 'RUT, razón social, denominaciones UAF y entidades observadas en Radar Prensa.', 'Identidad + fuentes + trayectoria', () => api.navigate('entidad')),
        analysisCard('RELACIONES', 'Cruzar vínculos', 'Representantes, sociedades, domicilios y contrapartes documentadas.', 'Convergencias explicables', () => api.navigate('relaciones')),
        analysisCard('UNIVERSOS', 'Comparar coberturas', 'SII, UAF/SO, OSFL, RES y sanciones como lentes poblacionales separadas.', 'Cobertura por fuente', () => api.navigate('universos')),
        analysisCard('VIGILANCIA', 'Revisar cambios', 'Señales vigentes y diferencias entre snapshots cuando existe baseline comparable.', 'NEW · CHANGED · REMOVED', () => api.navigate('vigilancia', { mode: 'changes' })),
      ]),
    ]);
  }

  function replace(slot, next) { slot.replaceWith(next); }

  async function timed(label, reader) {
    const started = performance.now();
    try { return { label, status: 'fulfilled', value: await reader(), ms: Math.round(performance.now() - started) }; }
    catch (reason) { return { label, status: 'rejected', reason, ms: Math.round(performance.now() - started) }; }
  }

  function updateHeroLive(live, results) {
    const watch = results.find(result => result.label === 'watch' && result.status === 'fulfilled')?.value;
    const universes = results.find(result => result.label === 'universes' && result.status === 'fulfilled')?.value;
    const territory = results.find(result => result.label === 'territory' && result.status === 'fulfilled')?.value;
    const alertCount = Number(watch?.summary?.alert_count || 0);
    const familyCount = Number(watch?.summary?.family_count || 0);
    live.alerts.textContent = alertCount ? fmt(alertCount) : '—';
    live.alertDetail.textContent = alertCount ? `${fmt(familyCount)} familias activas en el snapshot` : 'Snapshot sin resumen de señales disponible';
    const lensCount = Array.isArray(universes?.items) ? universes.items.length : 0;
    const regionCount = Array.isArray(territory?.items) ? territory.items.filter(item => item.region).length : 0;
    live.finding.textContent = ` ${lensCount ? `${lensCount} lentes poblacionales` : 'Lentes poblacionales'} y ${regionCount ? `${regionCount} lecturas territoriales` : 'contexto territorial'} están disponibles como puntos de entrada. Usa la selección gráfica para conservar el foco al profundizar.`;
  }

  async function loadPulse(primaryGrid, contextGrid, api, serial, live) {
    const slots = {
      universes: skeleton('UNIVERSOS'), watch: skeleton('VIGILANCIA'),
      territory: skeleton('TERRITORIO'), spend: skeleton('GASTO PÚBLICO'),
    };
    clear(primaryGrid); clear(contextGrid);
    primaryGrid.append(slots.universes, slots.watch);
    contextGrid.append(slots.territory, slots.spend);

    const tasks = [
      timed('universes', () => global.AtlasV2Universes.overview({ route: 'explorar:pulse:universos' })),
      timed('watch', () => global.AtlasV2Watch.overview({ route: 'explorar:pulse:vigilancia' })),
      timed('territory', () => global.AtlasV2Territory.overview({ route: 'explorar:pulse:territorio' })),
      timed('spend', () => global.AtlasV2Access.data().publicSpend.monitor({ route: 'explorar:pulse:gasto-publico' })),
    ];
    const results = await Promise.all(tasks);
    if (serial !== renderSerial || !primaryGrid.isConnected) return;
    const retry = () => { if (serial === renderSerial && primaryGrid.isConnected) void loadPulse(primaryGrid, contextGrid, api, serial, live); };
    results.forEach(result => {
      const slot = slots[result.label];
      if (!slot?.isConnected) return;
      if (result.status === 'fulfilled') {
        if (result.label === 'universes') replace(slot, universePanel(result.value, api));
        else if (result.label === 'watch') replace(slot, watchPanel(result.value, api));
        else if (result.label === 'territory') replace(slot, territoryPanel(result.value, api));
        else replace(slot, publicSpendPanel(result.value, api));
      } else {
        const titles = { universes: 'Cobertura observada', watch: 'Señales que cambiaron la atención', territory: 'Contexto geográfico', spend: 'Compras y ejecución' };
        replace(slot, unavailable(result.label.toUpperCase(), titles[result.label], result.reason, retry));
      }
    });
    updateHeroLive(live, results);
    global.__ATLAS_V2_EXPLORE_DIAGNOSTICS__ = Object.freeze({
      checkedAt: new Date().toISOString(),
      timings: Object.freeze(Object.fromEntries(results.map(result => [result.label, { status: result.status, ms: result.ms }]))),
    });
  }

  function render(container, _route, api) {
    injectStyle();
    const serial = ++renderSerial;
    clear(container);

    const live = {
      alerts: node('b', { text: '…' }),
      alertDetail: node('em', { text: 'Leyendo snapshot…' }),
      finding: node('p', { text: ' Integrando cobertura, vigilancia, territorio y gasto público…' }),
    };
    container.append(hero(api, live));

    const primaryGrid = node('div', { class: 'atlas-v2-explore-grid atlas-v2-explore-grid-primary' });
    const primaryDeck = node('section', { class: 'atlas-v2-explore-deck' }, [
      deckHead('01', 'Pulso de atención', 'Cobertura y señales en una lectura conjunta. Cada elemento es interactivo.', null),
      primaryGrid,
    ]);

    const contextGrid = node('div', { class: 'atlas-v2-explore-grid atlas-v2-explore-grid-context' });
    const contextDeck = node('section', { class: 'atlas-v2-explore-deck' }, [
      deckHead('02', 'Contexto para interpretar', 'Territorio y gasto público aportan contexto; no transfieren riesgo a personas o entidades.', null),
      contextGrid,
    ]);

    const refresh = node('button', {
      class: 'atlas-v2-button atlas-v2-explore-refresh', type: 'button', text: 'Actualizar radar',
      onclick: () => { if (serial === renderSerial) void loadPulse(primaryGrid, contextGrid, api, serial, live); },
    });
    container.append(node('div', { class: 'atlas-v2-explore-toolbar' }, [
      node('span', { text: 'Los gráficos son controles de navegación analítica.' }), refresh,
    ]));
    container.append(primaryDeck, contextDeck, analysisMatrix(api));
    container.append(node('div', { class: 'atlas-v2-explore-rule' }, [
      node('strong', { text: 'Regla de lectura. ' }),
      'Prioridad orienta atención; faltante no equivale a cero; sanción administrativa no constituye por sí sola evidencia AML/FT; IGR es contexto territorial y no riesgo individual. Guardar o seguir una exploración continúa siendo opcional.',
    ]));
    void loadPulse(primaryGrid, contextGrid, api, serial, live);
  }

  function register() {
    if (!global.AtlasV2Shell?.registerSurface) return false;
    global.AtlasV2Shell.registerSurface('explorar', render);
    global.__ATLAS_V2_EXPLORE_SURFACE__ = Object.freeze({ installed: true, route: 'explorar', mode: 'integrated-radar', semantics: 'ANALYTICS_FIRST' });
    return true;
  }

  if (!register()) global.addEventListener('atlas:v2-shell-ready', register, { once: true });
})(window);
