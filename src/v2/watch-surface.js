'use strict';

(function installAtlasV2WatchSurface(global) {
  if (global.__ATLAS_V2_WATCH_SURFACE__) return;
  const scriptBase = new URL('./', document.currentScript?.src || document.baseURI);
  const NF = new Intl.NumberFormat('es-CL');
  let renderSerial = 0;
  const MODES = Object.freeze([['overview','Resumen'],['changes','Cambios'],['signals','Señales'],['sources','Fuentes'],['timeline','Historial'],['method','Método']]);

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
    if (document.getElementById('atlas-v2-watch-style')) return;
    document.head.appendChild(node('link', { id: 'atlas-v2-watch-style', rel: 'stylesheet', href: new URL('watch-surface.css?v=1', scriptBase).href }));
  }
  function fmt(value, digits = 0) { const n = Number(value); return Number.isFinite(n) ? n.toLocaleString('es-CL', { maximumFractionDigits: digits }) : '—'; }
  function formatDate(value) {
    if (!value) return 'Sin fecha publicada';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString('es-CL', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
  function stateFrom(route) {
    const requested = String(route.params.get('mode') || 'overview').toLowerCase();
    return {
      mode: MODES.some(([id]) => id === requested) ? requested : 'overview',
      family: route.params.get('family') || '',
      priority: route.params.get('priority') || '',
      q: route.params.get('q') || '',
    };
  }
  function nav(api, state, patch) { api.navigate('vigilancia', { ...state, ...patch }); }
  function pageHead() {
    return node('header', { class: 'atlas-v2-pagehead' }, [
      node('div', { class: 'atlas-v2-eyebrow', text: 'DETECCIÓN DE CAMBIOS · VIGILANCIA V2' }),
      node('h1', { text: 'Vigilancia' }),
      node('p', { text: 'Observa señales, cambios entre snapshots y salud de fuentes para decidir dónde explorar. Una señal es una pregunta analítica priorizada: no es un hallazgo, una probabilidad ni una obligación de seguimiento.' }),
    ]);
  }
  function toolbar(api, state) {
    return node('div', { class: 'atlas-v2-watch-toolbar', role: 'navigation', 'aria-label': 'Modos de vigilancia' }, MODES.map(([id,label]) => node('button', {
      type: 'button', text: label, 'aria-current': state.mode === id ? 'true' : 'false', onclick: () => nav(api, state, { mode: id }),
    })));
  }
  function guard(text) { return node('div', { class: 'atlas-v2-watch-guard' }, [node('strong', { text: 'Regla de lectura. ' }), text]); }
  function loading() { return node('div', { class: 'atlas-v2-watch-loading', text: 'Leyendo snapshot y señales gobernadas…' }); }
  function errorBox(error) { return node('div', { class: 'atlas-v2-notice' }, [node('strong', { text: 'No fue posible leer Vigilancia. ' }), node('span', { text: String(error?.message || error || 'Error') }), error?.traceId ? node('small', { text: ` · trace ${error.traceId}` }) : null]); }

  function filters(api, state) {
    const family = node('input', { type: 'search', value: state.family, placeholder: 'Familia (ej. TERRITORIO)', 'aria-label': 'Familia' });
    const priority = node('select', { 'aria-label': 'Prioridad' }, [
      node('option', { value: '', text: 'Todas las prioridades' }), node('option', { value: 'MUY ALTA', text: 'Muy alta' }), node('option', { value: 'ALTA', text: 'Alta' }), node('option', { value: 'MEDIA', text: 'Media' }), node('option', { value: 'BAJA', text: 'Baja' }),
    ]); priority.value = state.priority;
    const q = node('input', { type: 'search', value: state.q, placeholder: 'Buscar señal o ámbito', 'aria-label': 'Buscar señal' });
    const apply = () => nav(api, state, { family: family.value.trim(), priority: priority.value, q: q.value.trim() });
    [family,q].forEach(input => input.addEventListener('keydown', event => { if (event.key === 'Enter') apply(); }));
    return node('div', { class: 'atlas-v2-watch-filter' }, [family, priority, q, node('button', { class: 'atlas-v2-button primary', type: 'button', text: 'Aplicar', onclick: apply })]);
  }

  async function renderOverview(host, api, state, serial) {
    host.append(loading());
    try {
      const out = await global.AtlasV2Watch.overview({ route: 'vigilancia:overview' });
      if (serial !== renderSerial || !host.isConnected) return;
      clear(host);
      const s = out.summary || {};
      host.append(node('div', { class: 'atlas-v2-watch-summary' }, [
        node('article', { class: 'atlas-v2-watch-stat' }, [node('span', { text: 'Señales vigentes' }), node('strong', { text: fmt(s.alert_count) })]),
        node('article', { class: 'atlas-v2-watch-stat' }, [node('span', { text: 'Prioridad muy alta' }), node('strong', { text: fmt(s.very_high_count) })]),
        node('article', { class: 'atlas-v2-watch-stat' }, [node('span', { text: 'Prioridad alta' }), node('strong', { text: fmt(s.high_count) })]),
        node('article', { class: 'atlas-v2-watch-stat' }, [node('span', { text: 'Familias de señal' }), node('strong', { text: fmt(s.family_count) })]),
        node('article', { class: 'atlas-v2-watch-stat' }, [node('span', { text: 'Fuentes observadas' }), node('strong', { text: fmt(s.source_count) })]),
        node('article', { class: 'atlas-v2-watch-stat' }, [node('span', { text: 'Snapshots historizados' }), node('strong', { text: fmt(s.history_snapshot_count) })]),
      ]));
      if (!out.comparison?.available) host.append(node('div', { class: 'atlas-v2-watch-baseline' }, [
        node('strong', { text: 'Baseline inicial. ' }),
        'El snapshot vigente ya fue historizado, pero todavía no existe un snapshot anterior comparable. Esto no significa que no hayan ocurrido cambios; significa que Atlas aún no dispone de una base histórica comparable para calcularlos.',
      ]));
      const families = node('div', { class: 'atlas-v2-watch-families' });
      out.families.forEach(item => families.append(node('article', { class: 'atlas-v2-watch-card' }, [
        node('span', { class: 'atlas-v2-watch-badge', text: item.family || 'SIN FAMILIA' }),
        node('h3', { text: `${fmt(item.n)} señales` }),
        node('div', { class: 'atlas-v2-watch-meta', text: `${fmt(item.high_priority)} de prioridad alta/muy alta · fuerza media ${fmt(item.avg_strength,2)}` }),
        node('button', { class: 'atlas-v2-button', type: 'button', text: 'Explorar familia', onclick: () => nav(api, state, { mode: 'signals', family: item.family || '' }) }),
      ])));
      host.append(families, guard('Prioridad ordena la atención analítica; no expresa probabilidad LA/FT. Abrir, guardar o ignorar una señal no cambia su estado porque Vigilancia no impone workflow.'));
    } catch (error) { if (serial === renderSerial && host.isConnected) { clear(host); host.append(errorBox(error)); } }
  }

  function signalCard(item) {
    return node('article', { class: 'atlas-v2-watch-item' }, [
      node('header', {}, [
        node('div', {}, [node('strong', { text: item.title || item.pattern_type || 'Señal' }), node('div', { class: 'atlas-v2-watch-meta', text: item.scope_label || item.scope_id || item.scope_type || 'Ámbito no informado' })]),
        node('div', { class: 'atlas-v2-watch-badges' }, [node('span', { class: 'atlas-v2-watch-badge', text: item.family || 'SIN FAMILIA' }), node('span', { class: 'atlas-v2-watch-badge', text: item.priority || 'SIN PRIORIDAD' })]),
      ]),
      node('p', { text: item.summary || 'Sin síntesis publicada.' }),
      node('div', { class: 'atlas-v2-watch-meta', text: `Patrón ${item.pattern_type || '—'} · fuerza ${fmt(item.strength,2)} · ${item.scope_type || 'ámbito'} · snapshot ${item.snapshot_id || '—'}` }),
    ]);
  }

  async function renderSignals(host, api, state, serial) {
    host.append(filters(api, state));
    const live = node('div', {}, [loading()]); host.append(live);
    try {
      const out = await global.AtlasV2Watch.signals({ family: state.family, priority: state.priority, search: state.q, limit: 100, route: 'vigilancia:signals' });
      if (serial !== renderSerial || !live.isConnected) return;
      clear(live);
      if (!out.items.length) { live.append(node('div', { class: 'atlas-v2-watch-empty', text: 'No hay señales observadas con estos filtros en el snapshot vigente.' })); return; }
      out.items.forEach(item => live.append(signalCard(item)));
      live.append(guard('La señal apunta a evidencia que conviene explorar. No sustituye la revisión del origen, no equivale a hallazgo y no crea obligación de hacerse cargo de ella.'));
    } catch (error) { if (serial === renderSerial && live.isConnected) { clear(live); live.append(errorBox(error)); } }
  }

  async function renderChanges(host, api, state, serial) {
    host.append(filters(api, state));
    const live = node('div', {}, [loading()]); host.append(live);
    try {
      const out = await global.AtlasV2Watch.changes({ family: state.family, priority: state.priority, search: state.q, limit: 100, route: 'vigilancia:changes' });
      if (serial !== renderSerial || !live.isConnected) return;
      clear(live);
      if (!out.comparison?.available) {
        live.append(node('div', { class: 'atlas-v2-watch-baseline' }, [node('strong', { text: 'BASELINE_ONLY. ' }), 'Se requiere al menos una publicación READY adicional para comparar snapshots. No hay inferencia de estabilidad ni de ausencia de cambios.']));
        return;
      }
      if (!out.items.length) { live.append(node('div', { class: 'atlas-v2-watch-empty' }, [node('strong', { text: 'Sin diferencias observadas entre estos dos snapshots.' }), node('span', { text: 'Esto describe solamente las señales historizadas y no implica bajo riesgo ni ausencia de cambios fuera de la cobertura.' })])); return; }
      out.items.forEach(item => {
        const kind = String(item.change_type || '').toUpperCase();
        const cls = kind === 'NEW' ? 'atlas-v2-watch-change-new' : kind === 'CHANGED' ? 'atlas-v2-watch-change-changed' : 'atlas-v2-watch-change-removed';
        live.append(node('article', { class: `atlas-v2-watch-item ${cls}` }, [
          node('header', {}, [node('strong', { text: item.title || item.pattern_type || 'Cambio' }), node('div', { class: 'atlas-v2-watch-badges' }, [node('span', { class: 'atlas-v2-watch-badge', text: kind || 'CAMBIO' }), node('span', { class: 'atlas-v2-watch-badge', text: item.family || 'SIN FAMILIA' })])]),
          node('p', { text: item.summary || 'Sin síntesis publicada.' }),
          node('div', { class: 'atlas-v2-watch-meta', text: `Fuerza ${fmt(item.previous_strength,2)} → ${fmt(item.current_strength,2)} · prioridad ${item.previous_priority || '—'} → ${item.current_priority || '—'} · ${item.scope_label || item.scope_id || 'ámbito'}` }),
        ]));
      });
      live.append(guard('NEW, CHANGED y REMOVED describen presencia y contenido entre snapshots. REMOVED significa “ya no aparece en el snapshot más reciente”; no significa resuelto, descartado ni cerrado.'));
    } catch (error) { if (serial === renderSerial && live.isConnected) { clear(live); live.append(errorBox(error)); } }
  }

  async function renderSources(host, api, state, serial) {
    const q = node('input', { type: 'search', value: state.q, placeholder: 'Buscar fuente', 'aria-label': 'Buscar fuente' });
    const apply = () => nav(api, state, { q: q.value.trim() }); q.addEventListener('keydown', event => { if (event.key === 'Enter') apply(); });
    host.append(node('div', { class: 'atlas-v2-watch-filter' }, [q, node('button', { class: 'atlas-v2-button primary', type: 'button', text: 'Buscar', onclick: apply })]));
    const live = node('div', {}, [loading()]); host.append(live);
    try {
      const out = await global.AtlasV2Watch.sources({ search: state.q, limit: 150, route: 'vigilancia:sources' });
      if (serial !== renderSerial || !live.isConnected) return;
      clear(live);
      const table = node('table', { class: 'atlas-v2-watch-table' });
      table.append(node('thead', {}, node('tr', {}, ['Fuente','Clase','Datos','Software','Último registro','Última ingesta','Registros 24h'].map(x => node('th', { text: x })) )));
      const body = node('tbody');
      out.items.forEach(item => body.append(node('tr', {}, [
        node('td', {}, [node('strong', { text: item.source_name || item.source_code }), node('div', { class: 'atlas-v2-watch-meta', text: item.authoritative_source || item.integration_mode || '' })]),
        node('td', { text: item.source_class || '—' }), node('td', { text: item.data_status || '—' }), node('td', { text: item.software_status || '—' }), node('td', { text: formatDate(item.last_source_record_at) }), node('td', { text: formatDate(item.last_successful_ingest_at) }), node('td', { text: NF.format(Number(item.records_24h) || 0) }),
      ])));
      table.append(body); live.append(table, guard('Silencio o atraso de una fuente afecta cobertura y debe verse antes de interpretar señales. Salud de fuente no es riesgo de entidad.'));
    } catch (error) { if (serial === renderSerial && live.isConnected) { clear(live); live.append(errorBox(error)); } }
  }

  async function renderTimeline(host, serial) {
    host.append(loading());
    try {
      const out = await global.AtlasV2Watch.timeline({ limit: 50, route: 'vigilancia:timeline' });
      if (serial !== renderSerial || !host.isConnected) return;
      clear(host);
      const table = node('table', { class: 'atlas-v2-watch-table' });
      table.append(node('thead', {}, node('tr', {}, ['Snapshot','Publicado','Señales','Muy alta','Alta','Familias'].map(x => node('th', { text: x })) )));
      const body = node('tbody');
      out.items.forEach(item => body.append(node('tr', {}, [node('td', { text: item.snapshot_id }), node('td', { text: formatDate(item.published_at) }), node('td', { text: fmt(item.alert_count) }), node('td', { text: fmt(item.very_high_count) }), node('td', { text: fmt(item.high_count) }), node('td', { text: fmt(item.family_count) })])));
      table.append(body); host.append(table, guard('El historial comienza desde la activación de esta bitácora v2. La ausencia de snapshots históricos previos no se rellena ni reconstruye artificialmente.'));
    } catch (error) { if (serial === renderSerial && host.isConnected) { clear(host); host.append(errorBox(error)); } }
  }

  function renderMethod(host) {
    host.append(node('div', { class: 'atlas-v2-watch-method' }, [
      node('article', {}, [node('h3', { text: 'Señal ≠ hallazgo' }), node('p', { text: 'Las alertas del Observatorio sirven para orientar exploración. Requieren revisar evidencia y fuente antes de extraer conclusiones.' })]),
      node('article', {}, [node('h3', { text: 'Prioridad ≠ probabilidad' }), node('p', { text: 'La prioridad sirve para ordenar atención por reglas y fuerza observada. No es una estimación probabilística de LA/FT.' })]),
      node('article', {}, [node('h3', { text: 'Cambios reproducibles' }), node('p', { text: 'Cada publicación READY se captura de forma inmutable. NEW, CHANGED y REMOVED se calculan comparando snapshots publicados.' })]),
      node('article', {}, [node('h3', { text: 'Explorar sin gestión obligatoria' }), node('p', { text: 'El analista puede abrir una señal, volver a universos, territorio, relaciones o entidad y seguir preguntando. El seguimiento es opcional y no altera la señal.' })]),
      node('article', {}, [node('h3', { text: 'Cobertura visible' }), node('p', { text: 'La salud de fuentes se presenta junto a las señales. Ausencia de novedad con una fuente silenciosa no debe interpretarse como ausencia de fenómeno.' })]),
      node('article', {}, [node('h3', { text: 'Baseline honesto' }), node('p', { text: 'Hasta contar con dos snapshots historizados comparables, Atlas muestra BASELINE_ONLY. No inventa una historia anterior.' })]),
    ]));
  }

  function render(container, route, api) {
    injectStyle(); const serial = ++renderSerial; const state = stateFrom(route);
    container.append(pageHead(), toolbar(api, state));
    const host = node('section', { class: 'atlas-v2-section' }); container.append(host);
    if (!global.AtlasV2Watch?.installed) { host.append(node('div', { class: 'atlas-v2-notice', text: 'Adapter de Vigilancia no disponible.' })); return; }
    if (state.mode === 'overview') void renderOverview(host, api, state, serial);
    else if (state.mode === 'changes') void renderChanges(host, api, state, serial);
    else if (state.mode === 'signals') void renderSignals(host, api, state, serial);
    else if (state.mode === 'sources') void renderSources(host, api, state, serial);
    else if (state.mode === 'timeline') void renderTimeline(host, serial);
    else renderMethod(host);
  }

  function register() {
    if (!global.AtlasV2Shell?.registerSurface) return false;
    global.AtlasV2Shell.registerSurface('vigilancia', render);
    global.__ATLAS_V2_WATCH_SURFACE__ = Object.freeze({ installed: true, route: 'vigilancia', mode: 'analytics-first', comparison: 'snapshot-diff' });
    return true;
  }
  if (!register()) global.addEventListener('atlas:v2-shell-ready', register, { once: true });
})(window);
