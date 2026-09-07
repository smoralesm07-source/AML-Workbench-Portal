'use strict';

(function installAtlasV2UniversesSurface(global) {
  if (global.__ATLAS_V2_UNIVERSES_SURFACE__) return;
  const scriptBase = new URL('./', document.currentScript?.src || document.baseURI);
  const NF = new Intl.NumberFormat('es-CL');
  let renderSerial = 0;

  const LENSES = Object.freeze({
    SII: { label: 'SII', detail: 'Tributario', dimensions: [['region','Región'],['sector','Sector económico'],['status','Estado']] },
    UAF: { label: 'UAF / SO', detail: 'Sujetos obligados', dimensions: [['region','Región'],['sector','Sector UAF'],['band','Banda IPF']] },
    OSFL: { label: 'OSFL', detail: 'Universo observado', dimensions: [['region','Región'],['activity','Actividad'],['confirmation','Confirmación']] },
    RES: { label: 'RES', detail: 'Sociedades', dimensions: [['region','Región social'],['constitution_year','Año constitución']] },
    SANCIONES: { label: 'Sanciones', detail: 'Eventos administrativos', dimensions: [['region','Región'],['entity_type','Tipo entidad']] },
  });
  const MODES = Object.freeze([
    ['overview','Panorama'],['distribution','Distribución'],['entities','Entidades'],['membership','Cruces'],['method','Método'],
  ]);

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
    if (document.getElementById('atlas-v2-universes-style')) return;
    const link = document.createElement('link');
    link.id = 'atlas-v2-universes-style';
    link.rel = 'stylesheet';
    link.href = new URL('universes-surface.css?v=1', scriptBase).href;
    document.head.appendChild(link);
  }

  function formatCount(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    if (n >= 1e6) return `${(n / 1e6).toLocaleString('es-CL', { maximumFractionDigits: 2 })} M`;
    if (n >= 1e3) return `${(n / 1e3).toLocaleString('es-CL', { maximumFractionDigits: 1 })} mil`;
    return NF.format(n);
  }

  function formatDate(value) {
    if (!value) return 'Sin fecha publicada';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('es-CL', { year: 'numeric', month: 'short', day: '2-digit' });
  }

  function pageHead(lens) {
    return node('header', { class: 'atlas-v2-pagehead' }, [
      node('div', { class: 'atlas-v2-eyebrow', text: 'ANÁLISIS POBLACIONAL · UNIVERSOS V2' }),
      node('h1', { text: 'Universos' }),
      node('p', { text: `${LENSES[lens].label} es una lente sobre su propia fuente y grano. Cambiar de lente no transforma SII, UAF, OSFL, RES y sanciones en una única tabla ni homologa automáticamente sus significados.` }),
    ]);
  }

  function paramsFrom(route) {
    const requestedLens = String(route.params.get('lens') || 'SII').toUpperCase();
    const lens = LENSES[requestedLens] ? requestedLens : 'SII';
    const requestedMode = String(route.params.get('mode') || 'overview').toLowerCase();
    const mode = MODES.some(([id]) => id === requestedMode) ? requestedMode : 'overview';
    const allowedDimensions = LENSES[lens].dimensions.map(([id]) => id);
    const requestedDimension = String(route.params.get('dimension') || allowedDimensions[0]).toLowerCase();
    const dimension = allowedDimensions.includes(requestedDimension) ? requestedDimension : allowedDimensions[0];
    return {
      lens,
      mode,
      dimension,
      q: route.params.get('q') || '',
      rut: route.params.get('rut') || '',
    };
  }

  function nav(api, state, patch = {}) {
    api.navigate('universos', { ...state, ...patch });
  }

  function lensToolbar(api, state) {
    return node('div', { class: 'atlas-v2-univ-toolbar', role: 'navigation', 'aria-label': 'Lentes poblacionales' },
      Object.entries(LENSES).map(([id, lens]) => node('button', {
        type: 'button',
        'aria-current': state.lens === id ? 'true' : 'false',
        text: `${lens.label} · ${lens.detail}`,
        onclick: () => nav(api, state, { lens: id, dimension: LENSES[id].dimensions[0][0], q: '', rut: '' }),
      })));
  }

  function modeToolbar(api, state) {
    return node('div', { class: 'atlas-v2-univ-toolbar', role: 'navigation', 'aria-label': 'Modos de análisis' },
      MODES.map(([id, label]) => node('button', {
        type: 'button', 'aria-current': state.mode === id ? 'true' : 'false', text: label,
        onclick: () => nav(api, state, { mode: id }),
      })));
  }

  function loading() {
    return node('div', { class: 'atlas-v2-univ-loading', role: 'status' }, [
      node('strong', { text: 'Consultando read model gobernado…' }),
      node('div', { text: 'Los agregados se calculan fuera del navegador; la vista sólo recibe resultados acotados.' }),
    ]);
  }

  function errorBox(error) {
    return node('div', { class: 'atlas-v2-notice' }, [
      node('strong', { text: 'No fue posible leer Universos. ' }),
      node('span', { text: String(error?.message || error || 'Error de lectura') }),
      error?.traceId ? node('small', { text: ` · trace ${error.traceId}` }) : null,
    ]);
  }

  function qualityText(item) {
    const q = item?.quality || {};
    if (item?.lens === 'SII') {
      const future = Number(q.future_activity_start_dates || 0) + Number(q.future_termination_dates || 0);
      return future ? `${NF.format(future)} fecha(s) futura(s) detectadas como incidencia de calidad.` : 'Sin incidencias temporales futuras en el read model.';
    }
    if (item?.lens === 'OSFL') return `RUT observado: ${formatCount(q.with_rut)} · Región observada: ${formatCount(q.with_region)}.`;
    if (item?.lens === 'SANCIONES') return `${formatCount(q.events_outside_or_unresolved_universe)} evento(s) fuera o no resueltos contra el universo unificado.`;
    if (item?.lens === 'UAF') return `Cobertura SII: ${q.sii_coverage_pct ?? '—'}% · Sin territorio: ${formatCount(q.without_territory)}.`;
    if (item?.lens === 'RES') return `${formatCount(q.future_constitution_dates)} constitución(es) futuras detectadas como incidencia de calidad.`;
    return 'Calidad publicada por la fuente.';
  }

  function auxLine(item) {
    const a = item?.aux || {};
    if (item?.lens === 'UAF') {
      return `50 sectores observados · potenciales de screening: ${formatCount(a.potential_actionable)} (hipótesis, no SO acreditados).`;
    }
    if (item?.lens === 'OSFL') {
      return `Perfiles expandidos: ${formatCount(a.expanded_profiles)} · candidatos R.8: ${formatCount(a.r8_candidates)}.`;
    }
    if (item?.lens === 'SANCIONES') {
      return `${formatCount(a.event_count)} eventos · ${formatCount(a.regulatory_events)} sancionatorios · ${formatCount(a.cgr_enforcement_events)} CGR/enforcement.`;
    }
    if (item?.lens === 'RES') return `Corte de fuente: ${a.cutoff_date || 'no informado'}.`;
    if (item?.lens === 'SII') return `Registros fuente: ${formatCount(a.record_count)} · aceptados: ${formatCount(a.accepted_count)}.`;
    return '';
  }

  async function renderOverview(host, api, state, serial) {
    host.append(loading());
    try {
      const out = await global.AtlasV2Universes.overview({ route: 'universos:overview' });
      if (serial !== renderSerial || !host.isConnected) return;
      clear(host);
      const grid = node('div', { class: 'atlas-v2-univ-summary' });
      out.items.forEach(item => {
        const id = String(item.lens || '').toUpperCase();
        if (!LENSES[id]) return;
        grid.append(node('article', { class: 'atlas-v2-univ-card' }, [
          node('span', { class: 'atlas-v2-card-tag', text: LENSES[id].detail.toUpperCase() }),
          node('h3', { text: LENSES[id].label }),
          node('div', { class: 'atlas-v2-univ-number', text: formatCount(item.total_count) }),
          node('div', { class: 'atlas-v2-univ-meta', text: auxLine(item) }),
          node('div', { class: 'atlas-v2-univ-meta', text: `Actualización fuente: ${formatDate(item.source_refreshed_at)}` }),
          node('div', { class: 'atlas-v2-univ-quality', text: qualityText(item) }),
          node('button', { class: 'atlas-v2-button', type: 'button', text: 'Abrir lente', onclick: () => nav(api, state, { lens: id, mode: 'distribution', dimension: LENSES[id].dimensions[0][0] }) }),
        ]));
      });
      host.append(grid, node('div', { class: 'atlas-v2-univ-guard' }, [
        node('strong', { text: 'Lectura correcta. ' }),
        'Los totales pertenecen a fuentes y materializaciones distintas. No deben sumarse para obtener un “total Atlas”. OSFL corresponde al universo observado/materializado del corte, no al universo legal nacional completo.',
      ]));
    } catch (error) {
      if (serial !== renderSerial || !host.isConnected) return;
      clear(host); host.append(errorBox(error));
    }
  }

  async function renderDistribution(host, api, state, serial) {
    const dimensions = LENSES[state.lens].dimensions;
    host.append(node('div', { class: 'atlas-v2-univ-toolbar' }, dimensions.map(([id,label]) => node('button', {
      type: 'button', 'aria-current': state.dimension === id ? 'true' : 'false', text: label,
      onclick: () => nav(api, state, { dimension: id }),
    }))));
    const live = node('div', {}, [loading()]);
    host.append(live);
    try {
      const out = await global.AtlasV2Universes.distribution(state.lens, state.dimension, { limit: 40, route: `universos:${state.lens}:${state.dimension}` });
      if (serial !== renderSerial || !live.isConnected) return;
      clear(live);
      const max = Math.max(1, ...out.items.map(item => Number(item.entity_count) || 0));
      const chart = node('div', { class: 'atlas-v2-univ-chart' });
      out.items.forEach(item => chart.append(node('div', { class: 'atlas-v2-univ-row' }, [
        node('strong', { text: item.label || item.key || 'Sin etiqueta' }),
        node('meter', { min: '0', max: String(max), value: String(Number(item.entity_count) || 0), title: `${NF.format(Number(item.entity_count) || 0)} entidades` }),
        node('span', { text: formatCount(item.entity_count) }),
      ])));
      live.append(chart, node('div', { class: 'atlas-v2-univ-guard' }, [
        node('strong', { text: 'Distribución de snapshot. ' }),
        'La categoría describe la fuente seleccionada. Comparar lentes requiere conservar diferencias de cobertura, fecha y definición.',
      ]));
    } catch (error) {
      if (serial !== renderSerial || !live.isConnected) return;
      clear(live); live.append(errorBox(error));
    }
  }

  function searchBar(api, state, placeholder) {
    const input = node('input', { type: 'search', value: state.q, placeholder, 'aria-label': placeholder });
    const submit = () => nav(api, state, { q: input.value.trim() });
    input.addEventListener('keydown', event => { if (event.key === 'Enter') submit(); });
    return node('div', { class: 'atlas-v2-univ-search' }, [
      input,
      node('button', { class: 'atlas-v2-button primary', type: 'button', text: 'Buscar', onclick: submit }),
    ]);
  }

  function entityFields(item, lens) {
    if (lens === 'UAF') return [item.sector, item.region, item.ipf_band ? `IPF ${item.ipf_band}` : ''].filter(Boolean).join(' · ');
    if (lens === 'OSFL') return [item.main_activity, item.region, item.confirmation_level].filter(Boolean).join(' · ');
    if (lens === 'RES') return [item.constitution_date ? `Constitución ${item.constitution_date}` : '', item.region ? `Región ${item.region}` : ''].filter(Boolean).join(' · ');
    if (lens === 'SANCIONES') return [`${NF.format(Number(item.event_count) || 0)} evento(s)`, item.region, item.last_event_date ? `Último ${item.last_event_date}` : ''].filter(Boolean).join(' · ');
    return [item.status, item.sector, item.region, item.sales_band].filter(Boolean).join(' · ');
  }

  async function renderEntities(host, api, state, serial) {
    host.append(searchBar(api, state, 'Buscar por RUT o nombre dentro de la lente'));
    if ((state.lens === 'SII' || state.lens === 'RES') && state.q.trim().length < 2) {
      host.append(node('div', { class: 'atlas-v2-empty' }, [
        node('strong', { text: 'Escribe al menos 2 caracteres' }),
        node('span', { text: 'SII y RES son universos masivos; Atlas exige búsqueda acotada para evitar barridos innecesarios.' }),
      ]));
      return;
    }
    const live = node('div', {}, [loading()]); host.append(live);
    try {
      const out = await global.AtlasV2Universes.entities(state.lens, state.q, { limit: 40, route: `universos:${state.lens}:entities` });
      if (serial !== renderSerial || !live.isConnected) return;
      clear(live);
      if (!out.items.length) {
        live.append(node('div', { class: 'atlas-v2-empty' }, [node('strong', { text: 'Sin resultados en este snapshot' }), node('span', { text: 'No observado aquí no equivale a inexistencia fuera de esta fuente o corte.' })]));
        return;
      }
      const table = node('div', { class: 'atlas-v2-univ-table' });
      out.items.forEach(item => {
        const rut = String(item.rut || '').trim();
        table.append(node('article', { class: 'atlas-v2-univ-entity' }, [
          node('div', {}, [node('strong', { text: item.name || item.legal_name || item.entity_id || 'Entidad sin etiqueta' }), node('small', { text: rut || item.entity_id || 'Sin RUT publicado' })]),
          node('div', { text: entityFields(item, state.lens) || 'Sin atributos adicionales publicados' }),
          node('div', { class: 'atlas-v2-univ-meta', text: state.lens === 'SANCIONES' ? 'Evento administrativo: revisar evidencia antes de interpretar.' : `Lente ${LENSES[state.lens].label}` }),
          node('div', { class: 'atlas-v2-univ-actions' }, [
            rut ? node('button', { class: 'atlas-v2-button', type: 'button', text: 'Entidad 360', onclick: () => api.navigate('entidad', { rut }) }) : null,
            rut ? node('button', { class: 'atlas-v2-button', type: 'button', text: 'Relaciones', onclick: () => api.navigate('relaciones', { rut }) }) : null,
          ]),
        ]));
      });
      live.append(table);
    } catch (error) {
      if (serial !== renderSerial || !live.isConnected) return;
      clear(live); live.append(errorBox(error));
    }
  }

  function validRutShape(value) {
    const compact = String(value || '').toUpperCase().replace(/[^0-9K]/g, '');
    return /^\d{7,8}[0-9K]$/.test(compact);
  }

  async function renderMembership(host, api, state, serial) {
    const value = state.rut || state.q;
    const input = node('input', { type: 'search', value, placeholder: 'RUT exacto para cruzar lentes', 'aria-label': 'RUT exacto para cruzar lentes' });
    const submit = () => nav(api, state, { rut: input.value.trim(), q: '' });
    input.addEventListener('keydown', event => { if (event.key === 'Enter') submit(); });
    host.append(node('div', { class: 'atlas-v2-univ-search' }, [input, node('button', { class: 'atlas-v2-button primary', type: 'button', text: 'Cruzar RUT', onclick: submit })]));
    if (!value) {
      host.append(node('div', { class: 'atlas-v2-empty' }, [node('strong', { text: 'Cruce exacto entre lentes' }), node('span', { text: 'No se concilian entidades por similitud nominal en esta vista.' })]));
      return;
    }
    if (!validRutShape(value)) {
      host.append(node('div', { class: 'atlas-v2-notice' }, [node('strong', { text: 'Formato de RUT no válido para cruce exacto.' })]));
      return;
    }
    const live = node('div', {}, [loading()]); host.append(live);
    try {
      const out = await global.AtlasV2Universes.membership(value, { route: 'universos:membership' });
      if (serial !== renderSerial || !live.isConnected) return;
      clear(live);
      const grid = node('div', { class: 'atlas-v2-univ-membership' });
      Object.keys(LENSES).forEach(id => {
        const item = out.membership?.[id] || { present: false };
        grid.append(node('article', { class: `atlas-v2-univ-member ${item.present ? 'present' : ''}` }, [
          node('strong', { text: LENSES[id].label }),
          node('div', { text: item.present ? 'Observado en este snapshot' : 'No observado en este snapshot' }),
          item.name ? node('small', { text: item.name }) : null,
          item.sector ? node('small', { text: item.sector }) : null,
          item.event_count != null ? node('small', { text: `${NF.format(Number(item.event_count) || 0)} evento(s)` }) : null,
        ]));
      });
      live.append(grid, node('div', { class: 'atlas-v2-univ-guard' }, [
        node('strong', { text: 'Identidad por RUT exacto. ' }),
        '“No observado” significa ausencia en el snapshot consultado, no inexistencia jurídica, tributaria ni material. La presencia en Sanciones tampoco transmite condición AML/FT.',
      ]), node('button', { class: 'atlas-v2-button', type: 'button', text: 'Abrir Entidad 360', onclick: () => api.navigate('entidad', { rut: value }) }));
    } catch (error) {
      if (serial !== renderSerial || !live.isConnected) return;
      clear(live); live.append(errorBox(error));
    }
  }

  function renderMethod(host) {
    host.append(node('div', { class: 'atlas-v2-univ-method' }, [
      node('article', {}, [node('h3', { text: 'Lentes, no una megatabla' }), node('p', { text: 'SII, UAF, OSFL, RES y Sanciones mantienen población, cobertura, fecha y significado propios. Los totales no son aditivos.' })]),
      node('article', {}, [node('h3', { text: 'Pertenencia exacta' }), node('p', { text: 'El cruce transversal usa RUT exacto. La similitud de nombre puede servir como pista en otros procesos, pero no crea pertenencia ni identidad aquí.' })]),
      node('article', {}, [node('h3', { text: 'OSFL observado' }), node('p', { text: 'La lente OSFL reporta la materialización actualmente disponible en Atlas. No debe describirse como el total legal nacional de organizaciones sin fines de lucro.' })]),
      node('article', {}, [node('h3', { text: 'Sanciones' }), node('p', { text: 'CMF/UAF/SCJ y enforcement CGR son antecedentes administrativos con semántica propia. Una sanción no equivale por sí sola a riesgo o evidencia LA/FT.' })]),
      node('article', {}, [node('h3', { text: 'Potenciales SO' }), node('p', { text: 'El screening de potenciales sujetos obligados es una hipótesis basada en actividad y reglas de inclusión/exclusión; nunca se mezcla con el padrón UAF acreditado.' })]),
      node('article', {}, [node('h3', { text: 'Calidad visible' }), node('p', { text: 'Fechas futuras, ausencia territorial y registros no resueltos se exponen como incidencias de calidad. Atlas no los corrige ni transforma silenciosamente.' })]),
    ]));
  }

  function render(container, route, api) {
    injectStyle();
    const serial = ++renderSerial;
    const state = paramsFrom(route);
    container.append(pageHead(state.lens), lensToolbar(api, state), modeToolbar(api, state));
    const host = node('section', { class: 'atlas-v2-section' });
    container.append(host);
    if (!global.AtlasV2Universes?.installed) {
      host.append(node('div', { class: 'atlas-v2-notice' }, [node('strong', { text: 'Adapter de Universos no disponible.' })]));
      return;
    }
    if (state.mode === 'overview') void renderOverview(host, api, state, serial);
    else if (state.mode === 'distribution') void renderDistribution(host, api, state, serial);
    else if (state.mode === 'entities') void renderEntities(host, api, state, serial);
    else if (state.mode === 'membership') void renderMembership(host, api, state, serial);
    else renderMethod(host);
  }

  function register() {
    if (!global.AtlasV2Shell?.registerSurface) return false;
    global.AtlasV2Shell.registerSurface('universos', render);
    global.__ATLAS_V2_UNIVERSES_SURFACE__ = Object.freeze({ installed: true, route: 'universos', mode: 'analytics-first' });
    return true;
  }

  if (!register()) global.addEventListener('atlas:v2-shell-ready', register, { once: true });
})(window);
