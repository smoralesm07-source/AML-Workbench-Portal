'use strict';

(function installAtlasV2TerritorySurface(global) {
  if (global.__ATLAS_V2_TERRITORY_SURFACE__) return;
  const scriptBase = new URL('./', document.currentScript?.src || document.baseURI);
  const NF = new Intl.NumberFormat('es-CL');
  let renderSerial = 0;
  const MODES = Object.freeze([['overview','Panorama'],['communes','Comunas'],['signals','Señales'],['entities','Entidades'],['method','Método']]);

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
  function clear(el) { while (el?.firstChild) el.removeChild(el.firstChild); }
  function injectStyle() {
    if (document.getElementById('atlas-v2-territory-style')) return;
    const link = node('link', { id: 'atlas-v2-territory-style', rel: 'stylesheet', href: new URL('territory-surface.css?v=1', scriptBase).href });
    document.head.appendChild(link);
  }
  function fmt(value, digits = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString('es-CL', { maximumFractionDigits: digits }) : '—';
  }
  function formatDate(value) {
    if (!value) return 'Sin fecha publicada';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('es-CL', { year: 'numeric', month: 'short', day: '2-digit' });
  }
  function stateFrom(route) {
    const requested = String(route.params.get('mode') || 'overview').toLowerCase();
    return {
      mode: MODES.some(([id]) => id === requested) ? requested : 'overview',
      region: route.params.get('region') || '',
      commune: route.params.get('commune') || '',
      communeCode: route.params.get('commune_code') || '',
      q: route.params.get('q') || '',
      priority: route.params.get('priority') || '',
    };
  }
  function nav(api, state, patch) { api.navigate('territorio', { ...state, ...patch }); }
  function pageHead() {
    return node('header', { class: 'atlas-v2-pagehead' }, [
      node('div', { class: 'atlas-v2-eyebrow', text: 'LENTE GEOGRÁFICA · TERRITORIO V2' }),
      node('h1', { text: 'Territorio' }),
      node('p', { text: 'Explora exposición, concentración y contexto geográfico. El IGR v4 es un indicador territorial beta/contextual: describe lugares y no se imputa automáticamente como riesgo de las entidades presentes en ellos.' }),
    ]);
  }
  function toolbar(api, state) {
    return node('div', { class: 'atlas-v2-territory-toolbar', role: 'navigation', 'aria-label': 'Modos territoriales' }, MODES.map(([id,label]) => node('button', {
      type: 'button', text: label, 'aria-current': state.mode === id ? 'true' : 'false', onclick: () => nav(api, state, { mode: id }),
    })));
  }
  function guard(text) { return node('div', { class: 'atlas-v2-territory-guard' }, [node('strong', { text: 'Regla de lectura. ' }), text]); }
  function loading() { return node('div', { class: 'atlas-v2-territory-loading', text: 'Consultando read model territorial gobernado…' }); }
  function errorBox(error) { return node('div', { class: 'atlas-v2-notice' }, [node('strong', { text: 'No fue posible leer Territorio. ' }), node('span', { text: String(error?.message || error || 'Error') }), error?.traceId ? node('small', { text: ` · trace ${error.traceId}` }) : null]); }

  async function renderOverview(host, api, state, serial) {
    host.append(loading());
    try {
      const out = await global.AtlasV2Territory.overview({ route: 'territorio:overview' });
      if (serial !== renderSerial || !host.isConnected) return;
      clear(host);
      const s = out.summary || {};
      host.append(node('div', { class: 'atlas-v2-territory-summary' }, [
        node('article', { class: 'atlas-v2-territory-stat' }, [node('span', { text: 'Comunas observadas' }), node('strong', { text: fmt(s.commune_count) })]),
        node('article', { class: 'atlas-v2-territory-stat' }, [node('span', { text: 'Regiones observadas' }), node('strong', { text: fmt(s.region_count) })]),
        node('article', { class: 'atlas-v2-territory-stat' }, [node('span', { text: 'Señales territoriales' }), node('strong', { text: fmt(s.territorial_alert_count) })]),
        node('article', { class: 'atlas-v2-territory-stat' }, [node('span', { text: 'Cobertura geo UAF' }), node('strong', { text: s.geo_coverage_pct == null ? '—' : `${fmt(s.geo_coverage_pct,1)}%` })]),
      ]));
      const grid = node('div', { class: 'atlas-v2-territory-grid' });
      out.items.forEach(item => grid.append(node('article', { class: 'atlas-v2-territory-card' }, [
        node('span', { class: 'atlas-v2-territory-badge', text: 'IGR BETA · CONTEXTO' }),
        node('h3', { text: item.region || 'Región' }),
        node('div', { class: 'atlas-v2-territory-score', text: fmt(item.igr_mean,1) }),
        node('div', { class: 'atlas-v2-territory-meta', text: `IGR medio · máximo ${fmt(item.igr_max,1)} · ${fmt(item.commune_count)} comunas` }),
        node('div', { class: 'atlas-v2-territory-meta', text: `Vulnerabilidad ${fmt(item.vulnerability_mean,1)} · Amenaza ${fmt(item.threat_mean,1)} · Brecha ${fmt(item.gap_mean,1)}` }),
        node('div', { class: 'atlas-v2-territory-meta', text: `SO observados ${fmt(item.uaf_observed)} · potenciales ${fmt(item.potential_total)} · entidades económicas ${fmt(item.economic_entities)}` }),
        node('button', { class: 'atlas-v2-button', type: 'button', text: 'Explorar región', onclick: () => nav(api, state, { mode: 'communes', region: item.region || '' }) }),
      ])));
      host.append(grid, guard('El IGR se interpreta a nivel territorial. Vivir, operar o aparecer en una comuna con IGR alto no transmite automáticamente ese valor a una entidad. Los faltantes tampoco equivalen a cero.'), node('small', { text: `Snapshot: ${formatDate(out.generatedAt)} · CEAD se usa como contexto territorial, no como atribución individual.` }));
    } catch (error) { if (serial === renderSerial && host.isConnected) { clear(host); host.append(errorBox(error)); } }
  }

  function searchControls(api, state, { entityMode = false } = {}) {
    const region = node('input', { type: 'search', value: state.region, placeholder: 'Región exacta', 'aria-label': 'Región' });
    const query = node('input', { type: 'search', value: state.q, placeholder: entityMode ? 'Nombre o RUT' : 'Comuna o código', 'aria-label': 'Buscar' });
    const submit = () => nav(api, state, { region: region.value.trim(), q: query.value.trim() });
    [region, query].forEach(input => input.addEventListener('keydown', event => { if (event.key === 'Enter') submit(); }));
    return node('div', { class: 'atlas-v2-territory-search' }, [region, query, node('button', { class: 'atlas-v2-button primary', type: 'button', text: 'Aplicar', onclick: submit })]);
  }

  async function renderCommunes(host, api, state, serial) {
    host.append(searchControls(api, state));
    const live = node('div', {}, [loading()]); host.append(live);
    try {
      const out = await global.AtlasV2Territory.communes({ region: state.region, search: state.q, limit: 100, route: 'territorio:communes' });
      if (serial !== renderSerial || !live.isConnected) return;
      clear(live);
      if (!out.items.length) { live.append(node('div', { class: 'atlas-v2-territory-empty', text: 'No hay comunas observadas para los filtros del snapshot actual.' })); return; }
      const table = node('table', { class: 'atlas-v2-territory-table' });
      table.append(node('thead', {}, node('tr', {}, ['Región','Comuna','IGR','Vulnerabilidad','Amenaza','SO obs.','Calidad'].map(x => node('th', { text: x })) )));
      const body = node('tbody');
      out.items.forEach(item => body.append(node('tr', {}, [
        node('td', { text: item.region }),
        node('td', {}, node('button', { class: 'atlas-v2-button', type: 'button', text: item.commune || '—', onclick: () => nav(api, state, { mode: 'entities', region: item.region || '', commune: item.commune || '', communeCode: item.commune_code || '' }) })),
        node('td', { text: fmt(item.igr,1) }), node('td', { text: fmt(item.vulnerability,1) }), node('td', { text: fmt(item.threat,1) }), node('td', { text: fmt(item.uaf_observed) }), node('td', { text: `${fmt(item.mapping_quality,1)}%` }),
      ])));
      table.append(body); live.append(table, guard('El ranking ordena contexto territorial observado. No es un ranking de personas o empresas y no debe usarse como probabilidad LA/FT.'));
    } catch (error) { if (serial === renderSerial && live.isConnected) { clear(live); live.append(errorBox(error)); } }
  }

  async function renderSignals(host, api, state, serial) {
    const priority = node('select', { 'aria-label': 'Prioridad' }, [
      node('option', { value: '', text: 'Todas las prioridades' }), node('option', { value: 'MUY ALTA', text: 'Muy alta' }), node('option', { value: 'ALTA', text: 'Alta' }), node('option', { value: 'MEDIA', text: 'Media' }),
    ]); priority.value = state.priority;
    const region = node('input', { type: 'search', value: state.region, placeholder: 'Filtrar región', 'aria-label': 'Región' });
    const apply = () => nav(api, state, { region: region.value.trim(), priority: priority.value });
    host.append(node('div', { class: 'atlas-v2-territory-search' }, [region, priority, node('button', { class: 'atlas-v2-button primary', type: 'button', text: 'Aplicar', onclick: apply })]));
    const live = node('div', {}, [loading()]); host.append(live);
    try {
      const out = await global.AtlasV2Territory.signals({ region: state.region, priority: state.priority, limit: 100, route: 'territorio:signals' });
      if (serial !== renderSerial || !live.isConnected) return;
      clear(live);
      if (!out.items.length) { live.append(node('div', { class: 'atlas-v2-territory-empty', text: 'No hay señales territoriales observadas para este filtro.' })); return; }
      out.items.forEach(item => live.append(node('article', { class: 'atlas-v2-territory-signal' }, [
        node('header', {}, [node('strong', { text: item.title || item.pattern_type || 'Señal territorial' }), node('span', { class: 'atlas-v2-territory-badge', text: item.priority || 'SIN PRIORIDAD' })]),
        node('p', { text: item.summary || 'Sin síntesis publicada.' }),
        node('div', { class: 'atlas-v2-territory-meta', text: `${item.scope_label || item.scope_id || 'Ámbito territorial'} · fuerza ${fmt(item.strength,2)} · patrón ${item.pattern_type || '—'}` }),
      ])));
      live.append(guard('Una señal territorial abre una pregunta analítica. No es un hallazgo acreditado, no crea un caso y su prioridad no equivale a probabilidad.'));
    } catch (error) { if (serial === renderSerial && live.isConnected) { clear(live); live.append(errorBox(error)); } }
  }

  async function renderEntities(host, api, state, serial) {
    host.append(searchControls(api, state, { entityMode: true }));
    if (!state.region) { host.append(node('div', { class: 'atlas-v2-territory-empty' }, [node('strong', { text: 'Selecciona una región.' }), node('span', { text: 'La exploración de entidades exige contexto territorial explícito para evitar barridos masivos.' })])); return; }
    const live = node('div', {}, [loading()]); host.append(live);
    try {
      const out = await global.AtlasV2Territory.entities({ region: state.region, commune: state.commune, search: state.q, limit: 100, route: 'territorio:entities' });
      if (serial !== renderSerial || !live.isConnected) return;
      clear(live);
      const table = node('table', { class: 'atlas-v2-territory-table' });
      table.append(node('thead', {}, node('tr', {}, ['Entidad','RUT','Comuna','Fuentes','Señales','Hallazgos','Acción'].map(x => node('th', { text: x })) )));
      const body = node('tbody');
      out.items.forEach(item => body.append(node('tr', {}, [
        node('td', { text: item.name || 'Sin nombre' }), node('td', { text: item.rut || '—' }), node('td', { text: item.commune || '—' }), node('td', { text: fmt(item.source_count) }), node('td', { text: fmt(item.alert_count) }), node('td', { text: fmt(item.finding_count) }),
        node('td', {}, item.rut ? node('button', { class: 'atlas-v2-button', type: 'button', text: 'Entidad 360', onclick: () => api.navigate('entidad', { rut: item.rut }) }) : 'Sin RUT'),
      ])));
      table.append(body); live.append(table, guard('El orden usa observabilidad (señales, hallazgos y fuentes) para priorizar exploración. No constituye un score de riesgo ni hereda el IGR de la comuna.'));
    } catch (error) { if (serial === renderSerial && live.isConnected) { clear(live); live.append(errorBox(error)); } }
  }

  function renderMethod(host) {
    host.append(node('div', { class: 'atlas-v2-territory-method' }, [
      node('article', {}, [node('h3', { text: 'IGR beta/contextual' }), node('p', { text: 'IGR v4 resume dimensiones territoriales observadas. BETA_CONTEXTUAL significa que sirve para orientar preguntas y comparar territorios, no para atribuir riesgo individual.' })]),
      node('article', {}, [node('h3', { text: 'CEAD es contexto' }), node('p', { text: 'Las métricas CEAD contribuyen al contexto territorial del corte. No prueban conducta de una entidad localizada en esa comuna.' })]),
      node('article', {}, [node('h3', { text: 'Sin herencia automática' }), node('p', { text: 'Una entidad no recibe el riesgo de su región o comuna por domicilio, actividad o relación. La evidencia de entidad se analiza en su propio nivel.' })]),
      node('article', {}, [node('h3', { text: 'Faltante ≠ cero' }), node('p', { text: 'Ausencia de cobertura o dato no se interpreta como exposición nula. Atlas mantiene visible cobertura, snapshot y calidad.' })]),
    ]));
  }

  function render(container, route, api) {
    injectStyle(); const serial = ++renderSerial; const state = stateFrom(route);
    container.append(pageHead(), toolbar(api, state));
    const host = node('section', { class: 'atlas-v2-section' }); container.append(host);
    if (!global.AtlasV2Territory?.installed) { host.append(node('div', { class: 'atlas-v2-notice', text: 'Adapter de Territorio no disponible.' })); return; }
    if (state.mode === 'overview') void renderOverview(host, api, state, serial);
    else if (state.mode === 'communes') void renderCommunes(host, api, state, serial);
    else if (state.mode === 'signals') void renderSignals(host, api, state, serial);
    else if (state.mode === 'entities') void renderEntities(host, api, state, serial);
    else renderMethod(host);
  }

  function register() {
    if (!global.AtlasV2Shell?.registerSurface) return false;
    global.AtlasV2Shell.registerSurface('territorio', render);
    global.__ATLAS_V2_TERRITORY_SURFACE__ = Object.freeze({ installed: true, route: 'territorio', mode: 'analytics-first', semantics: 'BETA_CONTEXTUAL' });
    return true;
  }
  if (!register()) global.addEventListener('atlas:v2-shell-ready', register, { once: true });
})(window);
