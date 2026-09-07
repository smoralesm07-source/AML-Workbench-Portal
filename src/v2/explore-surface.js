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
    document.head.appendChild(node('link', { id: 'atlas-v2-explore-style', rel: 'stylesheet', href: new URL('explore-surface.css?v=2', scriptBase).href }));
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
      placeholder: 'RUT, razón social, nombre en prensa, proveedor, sector, región o pregunta…',
      'aria-label': 'Buscar o iniciar una pregunta analítica',
      autocomplete: 'off',
    });
    const submit = () => routeQuery(api, input.value);
    input.addEventListener('keydown', event => { if (event.key === 'Enter') submit(); });
    return node('div', { class: 'atlas-v2-explore-query' }, [input, node('button', { class: 'atlas-v2-button primary', type: 'button', text: 'Explorar', onclick: submit })]);
  }

  function pageHead(api) {
    return node('header', { class: 'atlas-v2-pagehead atlas-v2-explore-head' }, [
      node('div', { class: 'atlas-v2-eyebrow', text: 'ATLAS 2 · PULSO ANALÍTICO' }),
      node('h1', { text: '¿Qué merece una mirada hoy?' }),
      node('p', { text: 'Empieza por una entidad o navega directamente sobre las distribuciones. Los gráficos funcionan como controles: seleccionar una barra o segmento conserva la pregunta y abre el análisis correspondiente.' }),
      queryBox(api),
    ]);
  }

  function skeleton(label) {
    return node('article', { class: 'atlas-v2-explore-panel is-loading', 'aria-busy': 'true' }, [
      node('div', { class: 'atlas-v2-explore-panel-head' }, [node('div', {}, [node('span', { class: 'atlas-v2-card-tag', text: label }), node('h2', { text: 'Actualizando…' })]), node('span', { class: 'atlas-v2-explore-status', text: 'LEYENDO' })]),
      node('div', { class: 'atlas-v2-explore-skeleton chart' }), node('div', { class: 'atlas-v2-explore-skeleton short' }),
    ]);
  }

  function unavailable(label, title, error, retry) {
    return node('article', { class: 'atlas-v2-explore-panel is-error' }, [
      node('div', { class: 'atlas-v2-explore-panel-head' }, [node('div', {}, [node('span', { class: 'atlas-v2-card-tag', text: label }), node('h2', { text: title })]), node('span', { class: 'atlas-v2-explore-status', text: 'NO DISPONIBLE' })]),
      node('p', { class: 'atlas-v2-explore-copy', text: 'Esta lectura no respondió ahora. El resto del pulso sigue disponible.' }),
      node('div', { class: 'atlas-v2-explore-foot' }, [error?.traceId ? node('small', { text: `Trazabilidad: ${error.traceId}` }) : node('small', { text: 'No se infiere ausencia de datos.' }), node('button', { class: 'atlas-v2-button', type: 'button', text: 'Reintentar', onclick: retry })]),
    ]);
  }

  function panelHead(tag, title, action) {
    return node('div', { class: 'atlas-v2-explore-panel-head' }, [
      node('div', {}, [node('span', { class: 'atlas-v2-card-tag', text: tag }), node('h2', { text: title })]),
      node('button', { class: 'atlas-v2-explore-link', type: 'button', text: 'Abrir análisis →', onclick: action }),
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
    const panel = node('article', { class: 'atlas-v2-explore-panel atlas-v2-explore-panel-visual' }, [panelHead('UNIVERSOS', 'Cobertura observada', () => api.navigate('universos'))]);
    panel.append(node('div', { class: 'atlas-v2-explore-chart' }, [global.AtlasV2Viz.horizontalBars(rows, { limit: 7, onSelect: item => api.navigate('universos', { lens: item.lens }) })]));
    panel.append(node('p', { class: 'atlas-v2-explore-copy', text: 'Selecciona una barra para entrar a ese universo. Los totales conservan su fuente y no se suman entre sí.' }), node('small', { class: 'atlas-v2-explore-source', text: `Corte read model · ${formatDate(out.generatedAt || out.meta?.snapshot)}` }));
    return panel;
  }

  function watchPanel(out, api) {
    const s = out.summary || {};
    const rows = [
      { label: 'Muy alta', value: Number(s.very_high_count || 0), display: fmt(s.very_high_count), severity: 'VERY_HIGH' },
      { label: 'Alta', value: Number(s.high_count || 0), display: fmt(s.high_count), severity: 'HIGH' },
      { label: 'Otras vigentes', value: Math.max(0, Number(s.alert_count || 0) - Number(s.very_high_count || 0) - Number(s.high_count || 0)), display: fmt(Math.max(0, Number(s.alert_count || 0) - Number(s.very_high_count || 0) - Number(s.high_count || 0))), severity: 'OTHER' },
    ];
    const panel = node('article', { class: 'atlas-v2-explore-panel atlas-v2-explore-panel-visual' }, [panelHead('VIGILANCIA', 'Señales que cambiaron la atención', () => api.navigate('vigilancia'))]);
    panel.append(node('div', { class: 'atlas-v2-explore-chart' }, [global.AtlasV2Viz.segmented(rows, { onSelect: item => api.navigate('vigilancia', { severity: item.severity }) })]));
    panel.append(node('div', { class: 'atlas-v2-explore-bigline' }, [node('strong', { text: fmt(s.alert_count) }), node('span', { text: `señales vigentes · ${fmt(s.family_count)} familias` })]));
    panel.append(node('p', { class: 'atlas-v2-explore-copy', text: out.comparison?.available ? 'Selecciona una severidad o abre Vigilancia para revisar NEW, CHANGED y REMOVED.' : 'Baseline inicial: aún no corresponde inferir estabilidad ni ausencia de cambios.' }), node('small', { class: 'atlas-v2-explore-source', text: `Snapshot · ${out.snapshotId || formatDate(out.generatedAt)}` }));
    return panel;
  }

  function territoryPanel(out, api) {
    const rows = (out.items || []).filter(item => item.region).sort((a, b) => Number(b.igr_mean || 0) - Number(a.igr_mean || 0)).slice(0, 8).map(item => ({
      label: item.region,
      detail: `${fmt(item.commune_count)} comuna(s)`,
      value: Number(item.igr_mean || 0),
      display: fmt(item.igr_mean, 1),
      region: item.region,
    }));
    const panel = node('article', { class: 'atlas-v2-explore-panel atlas-v2-explore-panel-visual' }, [panelHead('TERRITORIO', 'Contexto geográfico', () => api.navigate('territorio'))]);
    panel.append(node('div', { class: 'atlas-v2-explore-chart' }, [global.AtlasV2Viz.horizontalBars(rows, { limit: 7, onSelect: item => api.navigate('territorio', { region: item.region }) })]));
    panel.append(node('p', { class: 'atlas-v2-explore-copy', text: 'Ranking por IGR medio observado. El clic abre la región; el indicador es contexto territorial beta y no riesgo individual.' }), node('small', { class: 'atlas-v2-explore-source', text: `Corte territorial · ${formatDate(out.generatedAt || out.meta?.snapshot)}` }));
    return panel;
  }

  function publicSpendPanel(out, api) {
    const availability = out?.data?.availability || {};
    const procurement = out?.data?.domains?.procurement?.summary || {};
    const rows = [
      { label: 'Proveedores', value: Number(procurement.supplier_count || 0), display: compact(procurement.supplier_count), view: 'suppliers' },
      { label: 'Compradores', value: Number(procurement.buyer_count || 0), display: compact(procurement.buyer_count), view: 'buyers' },
    ];
    const panel = node('article', { class: 'atlas-v2-explore-panel atlas-v2-explore-panel-visual' }, [panelHead('GASTO PÚBLICO', 'Compras y ejecución', () => api.navigate('gasto-publico'))]);
    panel.append(node('div', { class: 'atlas-v2-explore-spend-status' }, [
      node('span', {}, [node('i', { class: availability.procurement ? 'ok' : '' }), `ChileCompra · ${availability.procurement || 'sin estado'}`]),
      node('span', {}, [node('i', { class: availability.budget_execution ? 'ok' : '' }), `Presupuesto Abierto · ${availability.budget_execution || 'sin estado'}`]),
    ]));
    panel.append(node('div', { class: 'atlas-v2-explore-chart' }, [global.AtlasV2Viz.horizontalBars(rows, { limit: 2, onSelect: item => api.navigate('gasto-publico', { tab: item.view }) })]));
    panel.append(node('p', { class: 'atlas-v2-explore-copy', text: 'Selecciona proveedores o compradores para profundizar. Compras y ejecución permanecen como dominios paralelos: sus montos no se mezclan.' }), node('small', { class: 'atlas-v2-explore-source', text: `Monitor · ${out.snapshotId || out.meta?.snapshot || 'snapshot no informado'}` }));
    return panel;
  }

  function questionCard(tag, title, text, action) {
    return node('button', { class: 'atlas-v2-explore-question', type: 'button', onclick: action }, [node('span', { class: 'atlas-v2-card-tag', text: tag }), node('strong', { text: title }), node('p', { text }), node('span', { class: 'atlas-v2-explore-arrow', text: 'Profundizar →' })]);
  }

  function questions(api) {
    return node('section', { class: 'atlas-v2-explore-questions' }, [
      node('div', { class: 'atlas-v2-explore-section-head' }, [node('div', {}, [node('h2', { text: 'Preguntas para continuar' }), node('p', { text: 'Atajos hacia análisis, no hacia tareas ni casos.' })])]),
      node('div', { class: 'atlas-v2-explore-question-grid' }, [
        questionCard('ENTIDAD', '¿Quién aparece en Atlas?', 'Busca por nombre, RUT, denominación UAF o coincidencia en Radar Prensa.', () => api.navigate('entidad')),
        questionCard('CONCENTRACIÓN', '¿Dónde se concentra el gasto?', 'Proveedores, compradores y relaciones con dependencia material.', () => api.navigate('gasto-publico', { tab: 'overview' })),
        questionCard('CONVERGENCIA', '¿Qué entidades comparten relaciones?', 'Profundiza redes documentadas sin transferir riesgo entre nodos.', () => api.navigate('relaciones')),
        questionCard('CAMBIO', '¿Qué apareció o cambió?', 'Compara señales entre snapshots cuando exista baseline comparable.', () => api.navigate('vigilancia', { mode: 'changes' })),
      ]),
    ]);
  }

  function replace(slot, next) { slot.replaceWith(next); }

  async function timed(label, reader) {
    const started = performance.now();
    try { return { label, status: 'fulfilled', value: await reader(), ms: Math.round(performance.now() - started) }; }
    catch (reason) { return { label, status: 'rejected', reason, ms: Math.round(performance.now() - started) }; }
  }

  async function loadPulse(grid, api, serial) {
    const slots = { universes: skeleton('UNIVERSOS'), watch: skeleton('VIGILANCIA'), territory: skeleton('TERRITORIO'), spend: skeleton('GASTO PÚBLICO') };
    clear(grid);
    grid.append(slots.universes, slots.watch, slots.territory, slots.spend);

    const tasks = [
      timed('universes', () => global.AtlasV2Universes.overview({ route: 'explorar:pulse:universos' })),
      timed('watch', () => global.AtlasV2Watch.overview({ route: 'explorar:pulse:vigilancia' })),
      timed('territory', () => global.AtlasV2Territory.overview({ route: 'explorar:pulse:territorio' })),
      timed('spend', () => global.AtlasV2Access.data().publicSpend.monitor({ route: 'explorar:pulse:gasto-publico' })),
    ];
    const results = await Promise.all(tasks);
    if (serial !== renderSerial || !grid.isConnected) return;
    const retry = () => { if (serial === renderSerial && grid.isConnected) void loadPulse(grid, api, serial); };
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
    global.__ATLAS_V2_EXPLORE_DIAGNOSTICS__ = Object.freeze({ checkedAt: new Date().toISOString(), timings: Object.freeze(Object.fromEntries(results.map(result => [result.label, { status: result.status, ms: result.ms }]))) });
  }

  function render(container, _route, api) {
    injectStyle();
    const serial = ++renderSerial;
    clear(container);
    container.append(pageHead(api));
    const pulseHead = node('div', { class: 'atlas-v2-explore-section-head' }, [
      node('div', {}, [node('h2', { text: 'Pulso vivo' }), node('p', { text: 'Cuatro visualizaciones independientes. Haz clic sobre los datos para profundizar.' })]),
      node('button', { class: 'atlas-v2-button', type: 'button', text: 'Actualizar', onclick: () => { if (serial === renderSerial) void loadPulse(grid, api, serial); } }),
    ]);
    const grid = node('div', { class: 'atlas-v2-explore-grid' });
    container.append(node('section', { class: 'atlas-v2-explore-pulse' }, [pulseHead, grid]), questions(api));
    container.append(node('div', { class: 'atlas-v2-notice atlas-v2-explore-guard' }, [node('strong', { text: 'Cómo leer esta portada. ' }), 'Una prioridad orienta atención; un faltante no equivale a cero; una sanción administrativa no constituye por sí sola evidencia AML/FT; el contexto territorial no se hereda a la entidad. Guardar o seguir sigue siendo opcional.']));
    void loadPulse(grid, api, serial);
  }

  function register() {
    if (!global.AtlasV2Shell?.registerSurface) return false;
    global.AtlasV2Shell.registerSurface('explorar', render);
    global.__ATLAS_V2_EXPLORE_SURFACE__ = Object.freeze({ installed: true, route: 'explorar', mode: 'interactive-live-pulse', semantics: 'ANALYTICS_FIRST' });
    return true;
  }

  if (!register()) global.addEventListener('atlas:v2-shell-ready', register, { once: true });
})(window);