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
      href: new URL('explore-surface.css?v=1', scriptBase).href,
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
    return api.navigate('universos', { q: query });
  }

  function queryBox(api) {
    const input = node('input', {
      type: 'search',
      placeholder: 'RUT, entidad, proveedor, sector, región o pregunta…',
      'aria-label': 'Buscar o iniciar una pregunta analítica',
      autocomplete: 'off',
    });
    const submit = () => routeQuery(api, input.value);
    input.addEventListener('keydown', event => { if (event.key === 'Enter') submit(); });
    return node('div', { class: 'atlas-v2-explore-query' }, [
      input,
      node('button', { class: 'atlas-v2-button primary', type: 'button', text: 'Explorar', onclick: submit }),
    ]);
  }

  function pageHead(api) {
    return node('header', { class: 'atlas-v2-pagehead atlas-v2-explore-head' }, [
      node('div', { class: 'atlas-v2-eyebrow', text: 'ATLAS 2 · PULSO ANALÍTICO' }),
      node('h1', { text: '¿Qué merece una mirada hoy?' }),
      node('p', { text: 'Parte por una pregunta o usa el pulso vivo para detectar dónde profundizar. Las cifras permanecen separadas por fuente y grano: Atlas orienta exploración, no transforma señales en conclusiones.' }),
      queryBox(api),
    ]);
  }

  function skeleton(label) {
    return node('article', { class: 'atlas-v2-explore-panel is-loading', 'aria-busy': 'true' }, [
      node('div', { class: 'atlas-v2-explore-panel-head' }, [
        node('div', {}, [node('span', { class: 'atlas-v2-card-tag', text: label }), node('h2', { text: 'Actualizando…' })]),
        node('span', { class: 'atlas-v2-explore-status', text: 'LEYENDO' }),
      ]),
      node('div', { class: 'atlas-v2-explore-skeleton' }),
      node('div', { class: 'atlas-v2-explore-skeleton short' }),
    ]);
  }

  function unavailable(label, title, error, retry) {
    return node('article', { class: 'atlas-v2-explore-panel is-error' }, [
      node('div', { class: 'atlas-v2-explore-panel-head' }, [
        node('div', {}, [node('span', { class: 'atlas-v2-card-tag', text: label }), node('h2', { text: title })]),
        node('span', { class: 'atlas-v2-explore-status', text: 'NO DISPONIBLE' }),
      ]),
      node('p', { class: 'atlas-v2-explore-copy', text: 'Esta lectura no respondió ahora. El resto del pulso sigue disponible.' }),
      node('div', { class: 'atlas-v2-explore-foot' }, [
        error?.traceId ? node('small', { text: `Trazabilidad: ${error.traceId}` }) : node('small', { text: 'No se infiere ausencia de datos.' }),
        node('button', { class: 'atlas-v2-button', type: 'button', text: 'Reintentar', onclick: retry }),
      ]),
    ]);
  }

  function metric(label, value, detail = '') {
    return node('div', { class: 'atlas-v2-explore-metric' }, [
      node('span', { text: label }),
      node('strong', { text: value }),
      detail ? node('small', { text: detail }) : null,
    ]);
  }

  function universePanel(out, api) {
    const byLens = new Map((out.items || []).map(item => [String(item.lens || '').toUpperCase(), item]));
    const specs = [
      ['SII', 'SII'], ['UAF', 'UAF / SO'], ['OSFL', 'OSFL'], ['RES', 'RES'], ['SANCIONES', 'Sanciones'],
    ];
    return node('article', { class: 'atlas-v2-explore-panel' }, [
      node('div', { class: 'atlas-v2-explore-panel-head' }, [
        node('div', {}, [node('span', { class: 'atlas-v2-card-tag', text: 'UNIVERSOS' }), node('h2', { text: 'Cobertura observada' })]),
        node('button', { class: 'atlas-v2-explore-link', type: 'button', text: 'Abrir →', onclick: () => api.navigate('universos') }),
      ]),
      node('div', { class: 'atlas-v2-explore-metrics five' }, specs.map(([id, label]) => metric(label, compact(byLens.get(id)?.total_count)))),
      node('p', { class: 'atlas-v2-explore-copy', text: 'Cada total pertenece a su propia fuente. No se suman para construir un “universo Atlas”.' }),
      node('small', { class: 'atlas-v2-explore-source', text: `Corte read model · ${formatDate(out.generatedAt || out.meta?.snapshot)}` }),
    ]);
  }

  function watchPanel(out, api) {
    const s = out.summary || {};
    const comparison = out.comparison || {};
    return node('article', { class: 'atlas-v2-explore-panel' }, [
      node('div', { class: 'atlas-v2-explore-panel-head' }, [
        node('div', {}, [node('span', { class: 'atlas-v2-card-tag', text: 'VIGILANCIA' }), node('h2', { text: 'Señales que cambiaron la atención' })]),
        node('button', { class: 'atlas-v2-explore-link', type: 'button', text: 'Abrir →', onclick: () => api.navigate('vigilancia') }),
      ]),
      node('div', { class: 'atlas-v2-explore-metrics' }, [
        metric('Vigentes', fmt(s.alert_count)),
        metric('Muy alta', fmt(s.very_high_count)),
        metric('Alta', fmt(s.high_count)),
        metric('Familias', fmt(s.family_count)),
      ]),
      node('p', { class: 'atlas-v2-explore-copy', text: comparison.available ? 'Hay snapshots comparables: puedes revisar NEW, CHANGED y REMOVED.' : 'Atlas está en baseline inicial para esta serie; todavía no corresponde inferir estabilidad ni ausencia de cambios.' }),
      node('small', { class: 'atlas-v2-explore-source', text: `Snapshot · ${out.snapshotId || formatDate(out.generatedAt)}` }),
    ]);
  }

  function territoryPanel(out, api) {
    const s = out.summary || {};
    const highest = (out.items || []).slice().sort((a, b) => Number(b?.igr_mean || 0) - Number(a?.igr_mean || 0))[0];
    return node('article', { class: 'atlas-v2-explore-panel' }, [
      node('div', { class: 'atlas-v2-explore-panel-head' }, [
        node('div', {}, [node('span', { class: 'atlas-v2-card-tag', text: 'TERRITORIO' }), node('h2', { text: 'Contexto geográfico' })]),
        node('button', { class: 'atlas-v2-explore-link', type: 'button', text: 'Abrir →', onclick: () => api.navigate('territorio') }),
      ]),
      node('div', { class: 'atlas-v2-explore-metrics' }, [
        metric('Regiones', fmt(s.region_count)),
        metric('Comunas', fmt(s.commune_count)),
        metric('Señales', fmt(s.territorial_alert_count)),
        metric('Cobertura UAF', s.geo_coverage_pct == null ? '—' : `${fmt(s.geo_coverage_pct, 1)}%`),
      ]),
      node('p', { class: 'atlas-v2-explore-copy', text: highest?.region ? `Mayor IGR medio observado: ${highest.region} (${fmt(highest.igr_mean, 1)}). Es contexto territorial beta, no riesgo individual.` : 'El IGR territorial se usa como contexto y nunca se hereda automáticamente a una entidad.' }),
      node('small', { class: 'atlas-v2-explore-source', text: `Corte territorial · ${formatDate(out.generatedAt || out.meta?.snapshot)}` }),
    ]);
  }

  function publicSpendPanel(out, api) {
    const availability = out?.data?.availability || {};
    const procurement = out?.data?.domains?.procurement?.summary || {};
    const budgetQuality = out?.data?.domains?.budget_execution?.quality || {};
    const procurementReady = availability.procurement || 'sin estado';
    const budgetReady = availability.budget_execution || 'sin estado';
    return node('article', { class: 'atlas-v2-explore-panel' }, [
      node('div', { class: 'atlas-v2-explore-panel-head' }, [
        node('div', {}, [node('span', { class: 'atlas-v2-card-tag', text: 'GASTO PÚBLICO' }), node('h2', { text: 'Compras y ejecución' })]),
        node('button', { class: 'atlas-v2-explore-link', type: 'button', text: 'Abrir →', onclick: () => api.navigate('gasto-publico') }),
      ]),
      node('div', { class: 'atlas-v2-explore-metrics' }, [
        metric('Proveedores', compact(procurement.supplier_count), 'ChileCompra'),
        metric('Compradores', compact(procurement.buyer_count), 'ChileCompra'),
        metric('Compras', procurementReady, 'disponibilidad'),
        metric('Presupuesto', budgetReady, budgetQuality.detail_mode || 'disponibilidad'),
      ]),
      node('p', { class: 'atlas-v2-explore-copy', text: 'Compras públicas y ejecución presupuestaria permanecen como dominios paralelos; Atlas no suma montos de granos incompatibles.' }),
      node('small', { class: 'atlas-v2-explore-source', text: `Monitor · ${out.snapshotId || out.meta?.snapshot || 'snapshot no informado'}` }),
    ]);
  }

  function questionCard(tag, title, text, action) {
    return node('button', { class: 'atlas-v2-explore-question', type: 'button', onclick: action }, [
      node('span', { class: 'atlas-v2-card-tag', text: tag }),
      node('strong', { text: title }),
      node('p', { text }),
      node('span', { class: 'atlas-v2-explore-arrow', text: 'Profundizar →' }),
    ]);
  }

  function questions(api) {
    return node('section', { class: 'atlas-v2-explore-questions' }, [
      node('div', { class: 'atlas-v2-explore-section-head' }, [
        node('div', {}, [node('h2', { text: 'Preguntas para continuar' }), node('p', { text: 'Atajos hacia análisis, no hacia tareas ni casos.' })]),
      ]),
      node('div', { class: 'atlas-v2-explore-question-grid' }, [
        questionCard('CONCENTRACIÓN', '¿Dónde se concentra el gasto?', 'Proveedores, compradores y relaciones con dependencia material.', () => api.navigate('gasto-publico', { tab: 'overview' })),
        questionCard('CONVERGENCIA', '¿Qué entidades comparten relaciones?', 'Profundiza redes documentadas sin transferir riesgo entre nodos.', () => api.navigate('relaciones')),
        questionCard('CAMBIO', '¿Qué apareció o cambió?', 'Compara señales entre snapshots cuando exista baseline comparable.', () => api.navigate('vigilancia', { mode: 'changes' })),
        questionCard('POBLACIÓN', '¿Dónde están los outliers?', 'Abre una lente SII, UAF, OSFL, RES o sanciones y conserva su semántica.', () => api.navigate('universos')),
      ]),
    ]);
  }

  function replace(slot, next) {
    slot.replaceWith(next);
  }

  async function timed(label, reader) {
    const started = performance.now();
    try {
      const value = await reader();
      return { label, status: 'fulfilled', value, ms: Math.round(performance.now() - started) };
    } catch (reason) {
      return { label, status: 'rejected', reason, ms: Math.round(performance.now() - started) };
    }
  }

  async function loadPulse(grid, api, serial) {
    const slots = {
      universes: skeleton('UNIVERSOS'),
      watch: skeleton('VIGILANCIA'),
      territory: skeleton('TERRITORIO'),
      spend: skeleton('GASTO PÚBLICO'),
    };
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

    global.__ATLAS_V2_EXPLORE_DIAGNOSTICS__ = Object.freeze({
      checkedAt: new Date().toISOString(),
      timings: Object.freeze(Object.fromEntries(results.map(result => [result.label, { status: result.status, ms: result.ms }]))),
    });
  }

  function render(container, _route, api) {
    injectStyle();
    const serial = ++renderSerial;
    clear(container);
    container.append(pageHead(api));

    const pulseHead = node('div', { class: 'atlas-v2-explore-section-head' }, [
      node('div', {}, [node('h2', { text: 'Pulso vivo' }), node('p', { text: 'Cuatro lecturas independientes para decidir dónde profundizar.' })]),
      node('button', { class: 'atlas-v2-button', type: 'button', text: 'Actualizar', onclick: () => { if (serial === renderSerial) void loadPulse(grid, api, serial); } }),
    ]);
    const grid = node('div', { class: 'atlas-v2-explore-grid' });
    container.append(node('section', { class: 'atlas-v2-explore-pulse' }, [pulseHead, grid]), questions(api));
    container.append(node('div', { class: 'atlas-v2-notice atlas-v2-explore-guard' }, [
      node('strong', { text: 'Cómo leer esta portada. ' }),
      'Una prioridad orienta atención; un faltante no equivale a cero; una sanción administrativa no constituye por sí sola evidencia AML/FT; el contexto territorial no se hereda a la entidad. Guardar o seguir sigue siendo opcional.',
    ]));
    void loadPulse(grid, api, serial);
  }

  function register() {
    if (!global.AtlasV2Shell?.registerSurface) return false;
    global.AtlasV2Shell.registerSurface('explorar', render);
    global.__ATLAS_V2_EXPLORE_SURFACE__ = Object.freeze({ installed: true, route: 'explorar', mode: 'live-pulse', semantics: 'ANALYTICS_FIRST' });
    return true;
  }

  if (!register()) global.addEventListener('atlas:v2-shell-ready', register, { once: true });
})(window);
