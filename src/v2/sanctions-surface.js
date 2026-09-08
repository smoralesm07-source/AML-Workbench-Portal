'use strict';

(function installAtlasV2SanctionsSurface(global) {
  if (global.__ATLAS_V2_SANCTIONS_SURFACE__) return;
  const scriptBase = new URL('./', document.currentScript?.src || document.baseURI);
  const NF = new Intl.NumberFormat('es-CL');
  let renderSerial = 0;

  function node(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value == null) return;
      if (key === 'class') el.className = value;
      else if (key === 'text') el.textContent = String(value);
      else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
      else el.setAttribute(key, String(value));
    });
    (Array.isArray(children) ? children : [children]).forEach(child => {
      if (child == null) return;
      el.append(child instanceof Node ? child : document.createTextNode(String(child)));
    });
    return el;
  }
  function clear(el) { while (el?.firstChild) el.removeChild(el.firstChild); }
  function injectStyle() {
    if (document.getElementById('atlas-v2-sanctions-style')) return;
    const link = document.createElement('link'); link.id = 'atlas-v2-sanctions-style'; link.rel = 'stylesheet'; link.href = new URL('sanctions-surface.css?v=2', scriptBase).href; document.head.appendChild(link);
  }
  function count(v) { const n = Number(v); return Number.isFinite(n) ? NF.format(n) : '—'; }
  function amountUF(v) { const n = Number(v); return Number.isFinite(n) ? `${n.toLocaleString('es-CL', { maximumFractionDigits: 1 })} UF` : '—'; }
  function amountCLP(v) { const n = Number(v); return Number.isFinite(n) ? `$${NF.format(Math.round(n))}` : '—'; }
  function date(v) { if (!v) return 'Sin fecha'; const d = new Date(v); return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('es-CL', { year: 'numeric', month: 'short', day: '2-digit' }); }
  function stateFrom(route) {
    return { q: route.params.get('q') || '', regulator: (route.params.get('regulator') || '').toUpperCase(), year: route.params.get('year') || '', region: route.params.get('region') || '', event_class: (route.params.get('event_class') || '').toUpperCase(), subject_condition: (route.params.get('subject_condition') || '').toUpperCase(), offset: Math.max(0, Number(route.params.get('offset') || 0) || 0) };
  }
  function nav(api, state, patch = {}) { api.navigate('sanciones', { ...state, ...patch }); }
  function loading(text = 'Consultando sanciones…') { return node('div', { class: 'san-loading', text }); }
  function errorBox(error) { return node('div', { class: 'san-error' }, [node('strong', { text: 'No fue posible leer Sanciones. ' }), node('span', { text: String(error?.message || error || 'Error') }), error?.traceId ? node('small', { text: ` · trace ${error.traceId}` }) : null]); }
  function kpi(label, value, detail) { return node('article', { class: 'san-kpi' }, [node('small', { text: label }), node('strong', { text: value }), node('span', { text: detail })]); }

  function sourceSummary(yearRows) {
    const totals = new Map();
    (yearRows || []).forEach(r => totals.set(r.regulator || 'SIN FUENTE', (totals.get(r.regulator || 'SIN FUENTE') || 0) + Number(r.event_count || 0)));
    return node('div', { class: 'san-source-grid' }, [...totals.entries()].sort((a,b) => b[1]-a[1]).slice(0, 8).map(([name,total]) => node('div', { class: 'san-source' }, [node('strong', { text: count(total) }), node('span', { text: name })])));
  }

  function timelinePanel(yearRows) {
    const byYear = new Map();
    (yearRows || []).forEach(r => byYear.set(r.event_year, (byYear.get(r.event_year) || 0) + Number(r.event_count || 0)));
    const rows = [...byYear.entries()].sort((a,b) => a[0]-b[0]); const max = Math.max(1, ...rows.map(([,n]) => n));
    return node('section', { class: 'san-panel' }, [node('h2', { text: 'Serie anual por fuente' }), node('p', { text: 'Eventos regulatorios y acciones CGR permanecen tipológicamente separados en la evidencia.' }), sourceSummary(yearRows), node('div', { class: 'san-bars' }, rows.map(([year,n]) => node('div', { class: 'san-bar' }, [node('strong', { text: String(year || 'S/F') }), node('div', { class: 'san-track' }, node('div', { class: 'san-fill', style: `width:${Math.max(1, n/max*100)}%` })), node('span', { text: count(n) })])))]);
  }

  function regionPanel(regions) {
    const grouped = new Map();
    (regions || []).forEach(r => { const key = r.region || 'Sin región'; grouped.set(key, (grouped.get(key) || 0) + Number(r.event_count || 0)); });
    const rows = [...grouped.entries()].sort((a,b) => b[1]-a[1]).slice(0, 10); const max = Math.max(1, ...rows.map(([,n]) => n));
    return node('section', { class: 'san-panel' }, [node('h2', { text: 'Concentración regional' }), node('p', { text: 'Territorio sólo cuando existe base de resolución o atribución registrada.' }), node('div', { class: 'san-bars' }, rows.map(([region,n]) => node('div', { class: 'san-bar' }, [node('span', { text: region }), node('div', { class: 'san-track' }, node('div', { class: 'san-fill', style: `width:${Math.max(1,n/max*100)}%` })), node('strong', { text: count(n) })])))]);
  }

  function filters(api, state, overview) {
    const search = node('input', { type: 'search', value: state.q, placeholder: 'Entidad, RUT, motivo o resolución', 'aria-label': 'Buscar sanción' });
    const regulator = node('select', { 'aria-label': 'Organismo' }, [node('option', { value: '', text: 'Todos los organismos' }), ...['CMF','UAF','SCJ','CGR','SP'].map(v => node('option', { value: v, text: v }))]); regulator.value = state.regulator;
    const years = [...new Set((overview.year_source || []).map(r => String(r.event_year || '')).filter(Boolean))].sort((a,b)=>Number(b)-Number(a));
    const year = node('select', { 'aria-label': 'Año' }, [node('option', { value: '', text: 'Todos los años' }), ...years.map(v => node('option', { value: v, text: v }))]); year.value = state.year;
    const subject = node('select', { 'aria-label': 'Condición' }, [node('option', { value: '', text: 'Toda condición' }), node('option', { value: 'SO', text: 'Sujeto obligado UAF' }), node('option', { value: 'POTENTIAL_SO', text: 'Potencial SO' }), node('option', { value: 'OSFL', text: 'OSFL observada' }), node('option', { value: 'RES', text: 'RES observado' })]); subject.value = state.subject_condition;
    const klass = node('select', { 'aria-label': 'Clase de evento' }, [node('option', { value: '', text: 'Toda clase' }), node('option', { value: 'REGULATORY_SANCTION', text: 'Sanción regulatoria' }), node('option', { value: 'CGR_ENFORCEMENT', text: 'CGR / enforcement' })]); klass.value = state.event_class;
    const submit = () => nav(api, state, { q: search.value.trim(), regulator: regulator.value, year: year.value, subject_condition: subject.value, event_class: klass.value, offset: 0 });
    search.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    return node('div', { class: 'san-filters' }, [search, regulator, year, subject, klass, node('button', { class: 'san-action', type: 'button', text: 'Aplicar', onclick: submit })]);
  }

  function eventCard(api, item) {
    const isCgr = item.event_class === 'CGR_ENFORCEMENT' || item.regulator === 'CGR';
    const badges = [node('span', { class: `san-badge ${isCgr ? 'cgr' : 'reg'}`, text: isCgr ? 'CGR / enforcement' : 'Sanción regulatoria' }), node('span', { class: 'san-badge', text: item.regulator || 'Sin organismo' })];
    if (item.is_uaf_registered) badges.push(node('span', { class: 'san-badge', text: 'SO UAF' }));
    if (item.is_potential_screening) badges.push(node('span', { class: 'san-badge', text: 'Potencial SO' }));
    if (item.is_osfl_observed) badges.push(node('span', { class: 'san-badge', text: 'OSFL' }));
    if (item.is_res_observed) badges.push(node('span', { class: 'san-badge', text: 'RES' }));
    const links = [];
    if (item.rut) links.push(node('button', { type: 'button', text: 'Entidad 360', onclick: () => api.navigate('entidad', { rut: item.rut }) }));
    if (item.document_url) links.push(node('a', { class: 'san-link', href: item.document_url, target: '_blank', rel: 'noopener noreferrer', text: 'Abrir documento público' }));
    return node('article', { class: 'san-event' }, [
      node('div', { class: 'san-event-top' }, [
        node('div', {}, [node('h3', { text: item.canonical_name || item.source_entity_name || 'Entidad no resuelta' }), node('p', { text: item.rut || item.identity_status || 'Identidad no resuelta' }), node('div', { class: 'san-badges' }, badges)]),
        node('div', {}, [node('strong', { text: date(item.event_date) }), node('p', { text: item.resolution_ref ? `Resolución ${item.resolution_ref}` : item.event_kind || 'Sin referencia' })]),
        node('div', {}, [node('strong', { text: item.amount_uf != null ? amountUF(item.amount_uf) : item.amount_clp != null ? amountCLP(item.amount_clp) : 'Monto no publicado' }), node('p', { text: item.region || item.territory_basis || 'Territorio no resuelto' })]),
        node('div', { class: 'san-event-links' }, links),
      ]),
      node('p', { text: item.reason || item.document_excerpt || 'Sin resumen documental publicado en el índice.' }),
      isCgr ? node('div', { class: 'san-callout', text: `CGR: ${[item.cgr_stage, item.cgr_risk_family, item.cgr_severity].filter(Boolean).join(' · ') || 'acción de enforcement contextual'}. No se promueve automáticamente a sanción regulatoria firme.` }) : null,
    ]);
  }

  async function renderEvents(host, api, state, overview, serial) {
    const panel = node('section', { class: 'san-panel' }, [node('h2', { text: 'Expedientes y eventos' }), node('p', { text: 'Filtra organismos, año y condición. Cada documento se abre desde su evidencia pública cuando está disponible.' }), filters(api, state, overview)]);
    const live = node('div', {}, loading('Cargando expedientes…')); panel.append(live); host.append(panel);
    try {
      const out = await global.AtlasV2Sanctions.events({ search: state.q, regulator: state.regulator, year: state.year, region: state.region, event_class: state.event_class, subject_condition: state.subject_condition, limit: 30, offset: state.offset }, { route: 'sanciones:events' });
      if (serial !== renderSerial || !live.isConnected) return;
      clear(live);
      if (!out.items?.length) { live.append(node('div', { class: 'san-empty', text: 'Sin eventos para los filtros seleccionados.' })); return; }
      live.append(node('div', { class: 'san-events' }, out.items.map(item => eventCard(api, item))));
      const total = Number(out.page?.total || 0), limit = Number(out.page?.limit || 30), offset = Number(out.page?.offset || 0);
      live.append(node('div', { class: 'san-pager' }, [node('span', { text: `${count(offset + 1)}–${count(Math.min(total, offset + limit))} de ${count(total)}` }), node('div', {}, [node('button', { type: 'button', text: 'Anterior', disabled: offset <= 0 ? 'disabled' : null, onclick: () => nav(api, state, { offset: Math.max(0, offset - limit) }) }), ' ', node('button', { type: 'button', text: 'Siguiente', disabled: offset + limit >= total ? 'disabled' : null, onclick: () => nav(api, state, { offset: offset + limit }) })]) ]));
    } catch (error) { if (serial === renderSerial && live.isConnected) { clear(live); live.append(errorBox(error)); } }
  }

  async function render(root, route, api) {
    injectStyle(); const serial = ++renderSerial; const state = stateFrom(route); clear(root);
    const page = node('div', { class: 'atlas-v2-sanctions' }); root.append(page);
    page.append(node('header', { class: 'san-head' }, [node('div', {}, [node('div', { class: 'atlas-v2-eyebrow', text: 'RADAR · SANCIONES V2' }), node('h1', { text: 'Sanciones y enforcement' }), node('p', { text: 'Radiografía sobre el universo SII + UAF + OSFL, con resolución de identidad, concentración temporal y territorial, condición SO/potencial SO y evidencia documental pública.' })])]), loading('Cargando radiografía…'));
    try {
      const out = await global.AtlasV2Sanctions.overview({ route: 'sanciones:overview' });
      if (serial !== renderSerial || !page.isConnected) return;
      page.lastChild?.remove();
      const o = out.overview || {}, u = out.universe || {};
      page.append(node('div', { class: 'san-kpis' }, [
        kpi('Universo unificado', count(u.unified_universe_count || o.unified_universe_count), 'SII + UAF + OSFL deduplicados por RUT'),
        kpi('Sanciones regulatorias', count(o.regulatory_sanction_event_count), 'CMF · UAF · SCJ · otras fuentes regulatorias'),
        kpi('Acciones CGR', count(o.cgr_enforcement_event_count), 'Contexto enforcement separado'),
        kpi('Entidades sancionadas', count(o.sanctioned_universe_entity_count), `${count(o.events_in_unified_universe)} eventos dentro del universo`),
        kpi('Documentos públicos', count(o.events_with_document), `Corte ${date(o.refreshed_at || out.snapshot_id)}`),
      ]));
      page.append(node('div', { class: 'san-grid' }, [timelinePanel(out.year_source), regionPanel(out.regions)]));
      page.append(node('div', { class: 'san-callout', text: out.semantics?.cgr || 'Las acciones CGR se muestran separadas y no se interpretan automáticamente como sanciones regulatorias firmes.' }));
      await renderEvents(page, api, state, out, serial);
      page.append(node('div', { class: 'san-callout', text: `${out.semantics?.universe || ''} ${out.semantics?.aml || ''}`.trim() }));
    } catch (error) { if (serial === renderSerial && page.isConnected) { clear(page); page.append(errorBox(error)); } }
  }

  function install() {
    if (!global.AtlasV2Shell?.registerSurface || !global.AtlasV2Sanctions) return false;
    global.AtlasV2Shell.registerSurface('sanciones', render);
    global.__ATLAS_V2_SANCTIONS_SURFACE__ = true;
    return true;
  }
  if (!install()) global.addEventListener('atlas:v2:ready', install, { once: true });
})(window);
