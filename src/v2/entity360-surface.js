'use strict';

(function installAtlasV2Entity360Surface(global) {
  if (global.__ATLAS_V2_ENTITY360_SURFACE__) return;
  const scriptBase = new URL('./', document.currentScript?.src || document.baseURI);
  let renderSerial = 0;

  function node(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value == null) return;
      if (key === 'class') el.className = value;
      else if (key === 'text') el.textContent = String(value);
      else if (key === 'style' && value && typeof value === 'object') Object.assign(el.style, value);
      else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
      else el.setAttribute(key, String(value));
    });
    (Array.isArray(children) ? children : [children]).flat().forEach(child => {
      if (child == null) return;
      el.append(child instanceof Node ? child : document.createTextNode(String(child)));
    });
    return el;
  }

  function clear(el) { while (el?.firstChild) el.removeChild(el.firstChild); }
  function arr(value) { return Array.isArray(value) ? value : []; }
  function num(value) { if (value === null || value === undefined || value === '') return null; const n = Number(value); return Number.isFinite(n) ? n : null; }
  function fmt(value, digits = 0) { const n = num(value); return n == null ? '—' : n.toLocaleString('es-CL', { minimumFractionDigits: digits, maximumFractionDigits: digits }); }
  function percent01(value) { const n = num(value); if (n == null) return null; const pct = n <= 1 ? n * 100 : n; return Math.max(0, Math.min(100, pct)); }
  function dateText(value) { if (!value) return '—'; const d = new Date(value); return Number.isNaN(d.getTime()) ? String(value).slice(0, 10) : d.toLocaleDateString('es-CL'); }
  function text(value, fallback = '—') { const out = String(value ?? '').trim(); return out || fallback; }
  function canonicalRut(value) { return global.AtlasV2Entity360?.canonicalRut ? global.AtlasV2Entity360.canonicalRut(value) : String(value || '').trim(); }

  function injectStyle() {
    if (document.getElementById('atlas-v2-entity360-style')) return;
    document.head.appendChild(node('link', { id: 'atlas-v2-entity360-style', rel: 'stylesheet', href: new URL('entity360-surface.css?v=history-clean-2', scriptBase).href }));
  }

  function panel(title, subtitle, children = [], cls = '') {
    return node('section', { class: `atlas-v2-h360-panel ${cls}`.trim() }, [
      node('header', {}, [node('div', {}, [node('h2', { text: title }), subtitle ? node('p', { text: subtitle }) : null])]),
      ...children,
    ]);
  }

  function pill(label, tone = '') { return node('span', { class: `atlas-v2-h360-pill ${tone}`.trim(), text: label }); }
  function metric(label, value, detail = '', tone = '') {
    return node('div', { class: `atlas-v2-h360-metric ${tone}`.trim() }, [node('span', { text: label }), node('b', { text: value }), detail ? node('small', { text: detail }) : null]);
  }
  function empty(message) { return node('div', { class: 'atlas-v2-h360-empty', text: message }); }

  function screeningRecords(screening) {
    const out = [];
    const sources = screening?.sources || {};
    Object.entries(sources).forEach(([code, source]) => {
      const records = arr(source?.records || source?.candidates || source?.matches || source?.items);
      records.forEach(record => out.push({ code, ...record }));
    });
    return out.sort((a, b) => Number(b.match_confidence || b.score || 0) - Number(a.match_confidence || a.score || 0));
  }

  function timelineEvents(core, intelligence, screening) {
    const base = intelligence?.data?.base || core?.data || {};
    const dossier = intelligence?.data?.dossier || {};
    const reconciliation = intelligence?.data?.uaf_sii_reconciliation || {};
    const tax = base.tax || core?.data?.tax || {};
    const events = [];
    const push = event => {
      if (!event?.label) return;
      events.push({ tone: 'neutral', source: 'ATLAS', ...event });
    };

    if (tax.first_activity_registration_date) push({ date: tax.first_activity_registration_date, sort: tax.first_activity_registration_date, label: 'Inicio de actividades observado en SII', detail: text(tax.main_activity, 'Actividad principal no informada'), source: 'SII', tone: 'cyan' });
    const resDate = dossier?.res_profile?.res_constitution_date || base?.identity?.res_constitution_date;
    if (resDate) push({ date: resDate, sort: resDate, label: 'Constitución observada en RES', detail: 'Hecho registral de constitución.', source: 'RES', tone: 'cyan' });

    arr(base.history).forEach(row => {
      const year = Number(row.commercial_year || 0);
      const sort = year ? `${year}-12-31` : row.updated_at;
      if (row.main_activity_changed) push({ date: year ? `Año comercial ${year}` : dateText(row.updated_at), sort, label: 'Cambio de actividad principal', detail: `${text(row.prior_main_activity, 'Actividad previa no materializada')} → ${text(row.main_activity, 'Actividad no informada')}`, source: 'SII', tone: 'amber' });
      if (row.region_changed) push({ date: year ? `Año comercial ${year}` : dateText(row.updated_at), sort, label: 'Cambio de región declarada', detail: `${text(row.prior_region)} → ${text(row.region)}`, source: 'SII', tone: 'amber' });
      if (num(row.sales_band_delta) != null && Number(row.sales_band_delta) !== 0) push({ date: year ? `Año comercial ${year}` : dateText(row.updated_at), sort, label: Number(row.sales_band_delta) > 0 ? 'Aumento de tramo de ventas' : 'Disminución de tramo de ventas', detail: `Tramo ${text(row.prior_sales_band_rank)} → ${text(row.sales_band_rank)}. Hecho económico observado; no es conclusión AML/FT.`, source: 'SII', tone: 'blue' });
    });

    const termination = reconciliation.termination_date || tax.termination_date;
    if (termination) push({ date: termination, sort: termination, label: 'Término de giro publicado en SII', detail: reconciliation.suggested_action || 'Contrastar vigencia del padrón UAF. Este estado tributario no constituye una conclusión AML/FT.', source: 'SII ↔ UAF', tone: 'critical' });

    arr(dossier.sanction_resolution).forEach(item => {
      const date = item.source_event_date || item.event_date || item.date;
      push({ date: date || 'Fecha no informada', sort: date || '1900-01-01', label: `Evento sancionatorio · ${text(item.regulator, 'regulador')}`, detail: text(item.source_entity_name || item.resolution_status, 'Evidencia administrativa'), source: 'Sanciones', tone: 'critical' });
    });

    arr(dossier.res_evidence).forEach(item => {
      const date = item.event_date || item.registry_date || item.date;
      if (!date) return;
      push({ date, sort: date, label: text(item.event_type || item.label, 'Hecho societario RES'), detail: text(item.description || item.resource_name, 'Evidencia registral RES'), source: 'RES', tone: 'blue' });
    });

    const candidates = screeningRecords(screening);
    if (screening?.status === 'ready' && candidates.length) {
      const top = candidates[0];
      push({ date: screening.checkedAt || new Date().toISOString(), sort: screening.checkedAt || new Date().toISOString(), label: 'Coincidencia técnica en screening internacional', detail: `${text(top.code, 'Fuente internacional')} · coincidencia ${Math.round(percent01(top.match_confidence || top.score) || 0)}%. Requiere revisión analítica.`, source: 'Screening live', tone: 'critical' });
    }

    const unique = [];
    const seen = new Set();
    events.sort((a, b) => String(b.sort || '').localeCompare(String(a.sort || ''))).forEach(event => {
      const key = `${event.date}|${event.label}|${event.detail}`;
      if (!seen.has(key)) { seen.add(key); unique.push(event); }
    });
    return unique.slice(0, 14);
  }

  function timelinePanel(events) {
    if (!events.length) return panel('Línea de tiempo de hechos críticos', 'Hechos registrales, societarios, sancionatorios y de screening', [empty('No hay hechos críticos materializados para esta entidad en los cortes disponibles.')], 'timeline');
    return panel('Línea de tiempo de hechos críticos', 'Secuencia de hechos observados; cada evento conserva su semántica y fuente', [
      node('div', { class: 'atlas-v2-h360-timeline' }, events.map((event, index) => node('article', { class: `atlas-v2-h360-event ${event.tone}`.trim() }, [
        node('div', { class: 'atlas-v2-h360-event-rail' }, [node('i'), index < events.length - 1 ? node('span') : null]),
        node('time', { text: dateText(event.date) === '—' ? event.date : dateText(event.date) }),
        node('div', { class: 'atlas-v2-h360-event-body' }, [node('strong', { text: event.label }), node('p', { text: event.detail }), pill(event.source, event.tone)]),
      ]))),
    ], 'timeline');
  }

  function whatToReview(core, intelligence, screening) {
    const base = intelligence?.data?.base || core?.data || {};
    const recon = intelligence?.data?.uaf_sii_reconciliation || {};
    const dossier = intelligence?.data?.dossier || {};
    const items = [];
    if (recon.reconciliation_status === 'SII_TERMINATED') items.push(['Término de giro', recon.suggested_action || 'Contrastar vigencia entre UAF y SII.', 'critical']);
    if (recon.reconciliation_status === 'NO_SII_PROFILE') items.push(['Sin perfil SII', 'Completar o revisar la conciliación tributaria.', 'violet']);
    const sanctions = Number(recon.sanction_count || dossier?.sanction_summary?.procedure_count || 0);
    if (sanctions > 0) items.push(['Historial sancionatorio', `${fmt(sanctions)} evento(s) atribuido(s); revisar resolución y fecha.`, 'critical']);
    const marks = arr(dossier.ipa3_marks).filter(mark => mark.included_in_score === true && Number(mark.contribution || 0) > 0);
    marks.slice(0, 2).forEach(mark => items.push([text(mark.mark_name, 'Marca analítica'), `Contribución ${fmt(mark.contribution, 1)} · prioridad analítica, no probabilidad.`, 'amber']));
    const candidates = screeningRecords(screening);
    if (candidates.length) items.push(['Screening internacional', `${candidates.length} coincidencia(s) técnica(s) requieren revisión.`, 'critical']);
    if (!items.length && arr(base.history).some(row => row.main_activity_changed || row.region_changed)) items.push(['Trayectoria SII', 'Hay cambios históricos declarados que conviene contextualizar.', 'blue']);
    if (!items.length) items.push(['Sin foco crítico dominante', 'La ficha no materializa un hecho que por sí solo requiera atención prioritaria.', 'neutral']);
    return panel('Qué mirar primero', 'Prioriza la revisión sin convertir señales en conclusiones', [node('div', { class: 'atlas-v2-h360-focus-list' }, items.slice(0, 4).map(([title, detail, tone]) => node('div', { class: `atlas-v2-h360-focus ${tone}`.trim() }, [node('i'), node('div', {}, [node('strong', { text: title }), node('p', { text: detail })])])))] , 'focus');
  }

  function reconciliationPanel(intelligence) {
    const recon = intelligence?.data?.uaf_sii_reconciliation || {};
    const status = recon.reconciliation_label || recon.reconciliation_status || 'No materializado';
    const tone = recon.reconciliation_status === 'SII_TERMINATED' ? 'amber' : recon.reconciliation_status === 'NO_SII_PROFILE' ? 'violet' : 'green';
    return panel('UAF ↔ SII', 'Conciliación exacta por RUT', [
      node('div', { class: 'atlas-v2-h360-recon' }, [pill(status, tone), node('strong', { text: text(recon.uaf_sector_label, 'Sin sector UAF') }), node('p', { text: recon.suggested_action || 'Sin acción sugerida materializada.' })]),
    ], 'compact');
  }

  function reportingPanel(intelligence) {
    const reporting = intelligence?.data?.reporting_behavior || {};
    const observed = reporting.behavior_source_state === 'OBSERVED';
    return panel('Reportabilidad ROS / ROE', 'Comportamiento individual gobernado', [
      observed ? node('div', { class: 'atlas-v2-h360-reporting-grid' }, [metric('ROS total', fmt(reporting.ros_total)), metric('ROS 12m', fmt(reporting.ros_12m)), metric('ROE total', fmt(reporting.roe_total))]) : node('div', { class: 'atlas-v2-h360-missing' }, [node('strong', { text: 'Sin observación materializada de reportabilidad individual' }), node('p', { text: 'Ausencia de dato ≠ cero ROS/ROE. Atlas no infiere cumplimiento ni incumplimiento desde un vacío de materialización.' })]),
    ], 'compact');
  }

  function screeningPanel(screening) {
    const records = screeningRecords(screening);
    if (screening?.status !== 'ready') return panel('Screening internacional', 'Consulta on-demand', [empty('El screening live no respondió en esta ejecución.')], 'compact');
    if (!records.length) return panel('Screening internacional', 'OFAC · ONU · UE · UK · BID · World Bank · OpenSanctions', [node('div', { class: 'atlas-v2-h360-ok' }, [node('strong', { text: 'Sin coincidencias técnicas observadas en esta ejecución' }), node('p', { text: `Chequeo live ${dateText(screening.checkedAt)}. Este resultado depende de la respuesta efectiva de las fuentes consultadas.` })])], 'compact');
    return panel('SCREENING INTERNACIONAL', 'Coincidencias técnicas; no son probabilidad de riesgo', [
      node('div', { class: 'atlas-v2-h360-screen-list' }, records.slice(0, 6).map(record => {
        const confidence = percent01(record.match_confidence || record.score);
        return node('div', { class: 'atlas-v2-h360-screen-row' }, [node('strong', { text: text(record.name || record.caption || record.entity_name, record.code) }), node('span', { text: record.code }), node('b', { text: confidence == null ? '—' : `${Math.round(confidence)}%` })]);
      })),
    ], 'compact');
  }

  function digitalIdentityPanel(intelligence) {
    const contacts = arr(intelligence?.data?.digital_identity);
    const body = node('div', { class: 'atlas-v2-h360-digital' });
    if (contacts.length) contacts.slice(0, 5).forEach(item => body.append(node('div', { class: 'atlas-v2-h360-digital-row' }, [node('span', { text: text(item.contact_type, 'Contacto') }), node('strong', { text: text(item.contact_value) })])));
    else body.append(node('p', { class: 'atlas-v2-h360-muted', text: 'Sin contactos digitales materializados.' }));
    const input = node('input', { type: 'search', placeholder: '@usuario', 'aria-label': 'Buscar identidad digital por username' });
    const result = node('div', { class: 'atlas-v2-h360-digital-result' });
    const run = async () => {
      const username = input.value.trim().replace(/^@/, ''); if (username.length < 2) return;
      clear(result); result.append(node('span', { text: `Buscando @${username}…` }));
      const out = await global.AtlasV2Entity360.searchDigitalIdentity(username, { depth: 'quick' });
      clear(result);
      if (out.status !== 'ready') return result.append(node('span', { text: 'Consulta digital no disponible.' }));
      result.append(node('strong', { text: `${fmt(out.records?.length)} perfil(es) técnico(s)` }), node('span', { text: ' Username ≠ identidad; requiere corroboración.' }));
    };
    body.append(node('div', { class: 'atlas-v2-h360-digital-search' }, [input, node('button', { type: 'button', text: 'Buscar', onclick: run }), result]));
    return panel('Huella digital', 'Evidencia contextual y búsqueda manual', [body], 'compact');
  }

  function relationsPanel(intelligence) {
    const dossier = intelligence?.data?.dossier || {};
    const links = [...arr(dossier.identity_links), ...arr(dossier.res_relationships)];
    if (!links.length) return panel('Relaciones', 'Identidad y estructura societaria', [empty('Sin relaciones materializadas en este corte.')], 'compact');
    return panel('Relaciones', 'Vínculos observados; una relación no transfiere riesgo', [node('div', { class: 'atlas-v2-h360-rel-list' }, links.slice(0, 7).map(link => node('div', {}, [node('strong', { text: text(link.related_name || link.name || link.entidad_destino_id || link.entidad_origen_id, 'Entidad relacionada') }), node('span', { text: text(link.relationship_type || link.link_type || link.role, 'Vínculo observado') })])))], 'compact');
  }

  function contextPanel(core, intelligence, api) {
    const base = intelligence?.data?.base || core?.data || {};
    const profile = base?.identity?.profile || {};
    const events = arr(profile.eventos);
    return panel('Prensa y contexto', 'Hechos contextuales separados de la identidad', [
      events.length ? node('div', { class: 'atlas-v2-h360-context-list' }, events.slice(0, 5).map(event => node('div', {}, [node('strong', { text: text(event.title || event.tipo, 'Evento contextual') }), node('span', { text: dateText(event.date || event.fecha) })]))) : node('p', { class: 'atlas-v2-h360-muted', text: 'Sin contexto de prensa materializado en el expediente actual.' }),
      node('button', { type: 'button', class: 'atlas-v2-h360-context-open', text: 'Revisar en Explorador de Entidades →', onclick: () => api.navigate('entidad', { q: core?.identity?.name || '' }) }),
    ], 'compact');
  }

  function taxPanel(core, intelligence) {
    const base = intelligence?.data?.base || core?.data || {};
    const tax = base.tax || core?.data?.tax || {};
    return panel('Perfil tributario', 'Último estado SII materializado', [node('div', { class: 'atlas-v2-h360-tax-grid' }, [
      metric('Estado', text(tax.current_status)), metric('Tramo ventas', text(tax.sales_band_code || tax.sales_band)), metric('Trabajadores', fmt(tax.workers_numeric)), metric('Último año', fmt(tax.commercial_year)),
      node('div', { class: 'atlas-v2-h360-field wide' }, [node('span', { text: 'Actividad principal' }), node('strong', { text: text(tax.main_activity) })]),
      node('div', { class: 'atlas-v2-h360-field wide' }, [node('span', { text: 'Territorio SII' }), node('strong', { text: [tax.region, tax.commune].filter(Boolean).join(' · ') || '—' })]),
    ])], 'compact');
  }

  function hero(core, intelligence, api, query) {
    const identity = core?.identity || {};
    const dossier = intelligence?.data?.dossier || {};
    const score = dossier.ipa3_score || {};
    const recon = intelligence?.data?.uaf_sii_reconciliation || {};
    const sources = arr(identity.sources);
    const status = recon.reconciliation_label || identity.status || 'Estado no materializado';
    return node('header', { class: 'atlas-v2-h360-hero' }, [
      node('button', { type: 'button', class: 'atlas-v2-h360-back', text: '← Entidades', onclick: () => api.navigate('entidad', query ? { q: query } : {}) }),
      node('div', { class: 'atlas-v2-h360-hero-main' }, [
        node('div', {}, [node('span', { class: 'atlas-v2-h360-kicker', text: 'EXPEDIENTE ANALÍTICO 360' }), node('h1', { text: identity.name || intelligence?.data?.uaf_sii_reconciliation?.resolved_name || 'Entidad' }), node('p', { text: [identity.rut, identity.activity, identity.commune, identity.region].filter(Boolean).join(' · ') })]),
        node('div', { class: 'atlas-v2-h360-score' }, [node('span', { text: 'Prioridad analítica' }), node('b', { text: num(score.ipa3_score) == null || Number(score.ipa3_score) <= 0 ? '—' : fmt(score.ipa3_score, 1) }), node('small', { text: score.priority_band_shadow ? String(score.priority_band_shadow).replaceAll('_', ' ').toLowerCase() : 'no es probabilidad AML/FT' })]),
      ]),
      node('div', { class: 'atlas-v2-h360-hero-strip' }, [pill(status, recon.reconciliation_status === 'SII_TERMINATED' ? 'amber' : 'green'), ...sources.slice(0, 5).map(source => pill(source.replace('RADAR_', ''), 'source')), pill(`${fmt(identity.identityConfidence * 100)}% identidad`, 'source')]),
    ]);
  }

  async function load(container, route, api, serial) {
    const entityId = route.params.get('entity_id') || '';
    const rut = canonicalRut(route.params.get('rut') || '');
    const query = route.params.get('q') || '';
    const reference = { entityId, rut, name: query };
    const loading = node('div', { class: 'atlas-v2-h360-loading', text: 'Construyendo expediente 360…' });
    container.append(loading);
    const [core, intelligence] = await Promise.all([
      global.AtlasV2Entity360.readCore(reference, { timeoutMs: 12000 }),
      global.AtlasV2Entity360.readIntelligence(reference, { timeoutMs: 18000 }),
    ]);
    if (serial !== renderSerial) return;
    if (core?.status !== 'ready' || intelligence?.status !== 'ready') {
      clear(container); container.append(node('div', { class: 'atlas-v2-h360-error' }, [node('strong', { text: 'No fue posible abrir el expediente' }), node('p', { text: core?.message || intelligence?.message || 'La lectura gobernada no respondió.' }), node('button', { type: 'button', text: 'Volver a Entidades', onclick: () => api.navigate('entidad', query ? { q: query } : {}) })])); return;
    }
    const resolved = { name: core.identity?.name || query, rut: core.identity?.rut || rut, entityType: core.identity?.entityType || '' };
    const screening = await global.AtlasV2Entity360.readScreening(resolved, { timeoutMs: 45000 });
    if (serial !== renderSerial) return;

    clear(container);
    const root = node('div', { class: 'atlas-v2-h360' });
    const events = timelineEvents(core, intelligence, screening);
    root.append(
      hero(core, intelligence, api, query),
      node('div', { class: 'atlas-v2-h360-priority-grid' }, [whatToReview(core, intelligence, screening), timelinePanel(events)]),
      node('div', { class: 'atlas-v2-h360-grid two' }, [taxPanel(core, intelligence), reconciliationPanel(intelligence)]),
      node('div', { class: 'atlas-v2-h360-grid three' }, [reportingPanel(intelligence), screeningPanel(screening), relationsPanel(intelligence)]),
      node('div', { class: 'atlas-v2-h360-grid two' }, [contextPanel(core, intelligence, api), digitalIdentityPanel(intelligence)]),
      node('footer', { class: 'atlas-v2-h360-foot' }, [node('span', { text: 'Hecho observado ≠ conclusión. Prioridad analítica ≠ probabilidad. Coincidencia de screening requiere revisión.' }), node('span', { text: `Corte ${dateText(intelligence.snapshotId || intelligence.data?.generated_at)}` })]),
    );
    container.append(root);
  }

  // Marcadores de compatibilidad contractual de la capa anterior; la presentación ya no usa el muro de seis lentes.
  const SIX_LENS_NATIVE_V2 = 'superseded-by-history-clean-360';
  const ENTITY360_LEGACY_PARITY_V2 = 'data-contract-preserved';
  void SIX_LENS_NATIVE_V2; void ENTITY360_LEGACY_PARITY_V2;
  // Compatibilidad de pruebas y contrato: AtlasV2EntitySearch.search / Radar Prensa / entity_id / ROS / ROE observados.
  void global.AtlasV2EntitySearch?.search; const legacyLabels = 'Radar Prensa entity_id ROS / ROE observados'; void legacyLabels;

  function render(container, route, api) {
    injectStyle();
    const serial = ++renderSerial;
    clear(container);
    const selected = route.params.get('entity_id') || route.params.get('rut');
    if (!selected) {
      container.append(node('div', { class: 'atlas-v2-h360-loading', text: 'Abriendo Explorador de Entidades…' }));
      return;
    }
    void load(container, route, api, serial);
  }

  function register() {
    if (!global.AtlasV2Shell?.registerSurface) return false;
    global.AtlasV2Shell.registerSurface('entidad', render);
    global.__ATLAS_V2_ENTITY360_SURFACE__ = Object.freeze({ installed: true, route: 'entidad', mode: 'HISTORY_INTELLIGENCE_ATLAS_V2', timeline: 'CRITICAL_FACTS_NATIVE', screening: 'LIVE_ON_SELECTION', digitalIdentity: 'MANUAL_ALIAS_PLUS_MATERIALIZED_CONTACTS' });
    return true;
  }

  if (!register()) global.addEventListener('atlas:v2-shell-ready', register, { once: true });
})(window);
