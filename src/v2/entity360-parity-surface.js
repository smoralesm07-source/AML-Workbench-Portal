'use strict';

(function installAtlasV2Entity360Parity(global) {
  if (global.__ATLAS_V2_ENTITY360_PARITY__) return;

  const VERSION = 'v2-primary-5-entity360-parity-1';
  const NF = new Intl.NumberFormat('es-CL');
  let renderSerial = 0;
  let searchSerial = 0;

  function node(tag, attrs = {}, children = []) {
    const element = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value == null) return;
      if (key === 'class') element.className = value;
      else if (key === 'text') element.textContent = String(value);
      else if (key === 'dataset' && value && typeof value === 'object') Object.entries(value).forEach(([name, entry]) => { element.dataset[name] = String(entry); });
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
  function arr(value) { return Array.isArray(value) ? value : []; }
  function num(value) { if (value === null || value === undefined || value === '') return null; const out = Number(value); return Number.isFinite(out) ? out : null; }
  function fmt(value, digits = 0) { const out = num(value); return out == null ? '—' : out.toLocaleString('es-CL', { maximumFractionDigits: digits }); }
  function money(value) { const out = num(value); return out == null ? '—' : `$${NF.format(Math.round(out))}`; }
  function dateLabel(value) { if (!value) return '—'; const d = new Date(value); return Number.isNaN(d.getTime()) ? String(value).slice(0, 10) : d.toLocaleDateString('es-CL'); }
  function percentValue(value) { const out = num(value); if (out == null) return null; return Math.max(0, Math.min(100, out <= 1 ? out * 100 : out)); }
  function text(value, fallback = '—') { const out = String(value ?? '').trim(); return out || fallback; }
  function sourceClass(value) { const key = String(value || '').toUpperCase(); if (/SII/.test(key)) return 'sii'; if (/UAF/.test(key)) return 'uaf'; if (/PRESS|PRENSA/.test(key)) return 'press'; if (/RES/.test(key)) return 'res'; if (/OSFL/.test(key)) return 'osfl'; if (/SANC|OFAC|UN_|EU_|UK_|WORLD|IDB|OPEN/.test(key)) return 'san'; return 'other'; }
  function sourceLabel(value) { const key = String(value || '').toUpperCase(); return ({ SII: 'SII', RADAR_SII: 'SII', UAF: 'UAF', RADAR_UAF: 'UAF', UAF_NAME: 'UAF', PRESS: 'Radar Prensa', RADAR_PRENSA: 'Radar Prensa', RES: 'RES', OSFL: 'OSFL', SANCTIONS: 'Sanciones', SANCIONES: 'Sanciones', DIGITAL_IDENTITY: 'Identidad digital', CANONICAL: 'Entidad canónica' })[key] || String(value || 'Fuente').replace(/_/g, ' '); }

  function metric(label, value, note = '') {
    return node('div', { class: 'e360p-metric' }, [node('span', { text: label }), node('strong', { text: value || '—' }), note ? node('small', { text: note }) : null]);
  }

  function status(label, live = true) {
    return node('span', { class: `e360p-status ${live ? 'is-live' : 'is-empty'}`, text: label });
  }

  function empty(title, message) {
    return node('div', { class: 'e360p-empty' }, [node('strong', { text: title }), node('span', { text: message })]);
  }

  function card(kicker, title, source, body, cls = '') {
    return node('article', { class: `e360p-card ${cls}`.trim() }, [
      node('header', { class: 'e360p-card-head' }, [node('div', {}, [node('span', { class: 'e360p-kicker', text: kicker }), node('h3', { text: title })]), source ? node('span', { class: 'e360p-source', text: source }) : null]),
      body,
    ]);
  }

  function section(id, index, title, subtitle, children) {
    return node('section', { class: 'e360p-lens-section', id }, [
      node('header', { class: 'e360p-section-head' }, [
        node('div', { class: 'e360p-section-index', text: index }),
        node('div', {}, [node('h2', { text: title }), node('p', { text: subtitle })]),
      ]),
      ...(Array.isArray(children) ? children : [children]),
    ]);
  }

  function sourcePills(core) {
    const identity = core?.identity || {};
    const listed = arr(identity.sources);
    const inferred = Object.entries(core?.sourceStatus || {}).filter(([, state]) => state === 'AVAILABLE').map(([key]) => key.toUpperCase());
    const sources = [...new Set([...listed, ...inferred])].filter(Boolean);
    return node('div', { class: 'e360p-source-pills' }, sources.length ? sources.map(source => node('span', { class: sourceClass(source), text: sourceLabel(source) })) : [node('span', { class: 'other', text: 'Fuente no declarada' })]);
  }

  function scoreBandClass(band) {
    const key = String(band || '').toUpperCase();
    return key === 'MUY_ALTA' ? 'very-high' : key === 'ALTA' ? 'high' : key === 'MEDIA' ? 'medium' : key === 'BAJA' ? 'low' : 'empty';
  }

  function scoreRing(score) {
    const value = num(score?.ipa3_score);
    const pct = Math.max(0, Math.min(100, value || 0));
    return node('div', { class: `e360p-score-ring ${scoreBandClass(score?.priority_band_shadow)}`, style: `--e360p-score:${pct}deg` }, [
      node('div', { class: 'e360p-score-ring-core' }, [node('strong', { text: value == null || value === 0 ? '—' : fmt(value, 1) }), node('span', { text: 'IPA3' })]),
    ]);
  }

  function rail(label, value, note = '') {
    const pct = percentValue(value);
    return node('div', { class: 'e360p-rail-block' }, [
      node('div', { class: 'e360p-rail-head' }, [node('span', { text: label }), node('b', { text: pct == null ? '—' : `p${Math.round(pct)}` })]),
      node('div', { class: 'e360p-rail' }, [node('i', { class: 'tick q1' }), node('i', { class: 'tick q2' }), node('i', { class: 'tick q3' }), pct == null ? null : node('i', { class: 'needle', style: `left:${pct.toFixed(1)}%` })]),
      node('div', { class: 'e360p-rail-scale' }, [node('span', { text: 'p0' }), node('span', { text: 'p50' }), node('span', { text: 'p100' })]),
      note ? node('small', { text: note }) : null,
    ]);
  }

  function hero(result) {
    const identity = result.core?.identity || {};
    const dossier = result.intelligence?.data?.dossier || {};
    const score = dossier.ipa3_score || {};
    return node('section', { class: 'e360p-hero' }, [
      node('div', { class: 'e360p-hero-main' }, [
        node('span', { class: 'e360p-eyebrow', text: 'ENTIDAD 360 · EXPEDIENTE ANALÍTICO' }),
        node('h1', { text: identity.name || result.reference?.name || 'Entidad sin nombre publicado' }),
        node('p', { text: [identity.rut || result.rut || 'Sin RUT resuelto', identity.entityType, identity.activity].filter(Boolean).join(' · ') }),
        sourcePills(result.core),
      ]),
      node('div', { class: 'e360p-hero-side' }, [
        scoreRing(score),
        node('div', { class: 'e360p-hero-facts' }, [
          metric('Territorio', [identity.commune, identity.region].filter(Boolean).join(' · ') || 'No informado'),
          metric('Estado', identity.status || 'No informado'),
          metric('Confianza identidad', identity.identityConfidence ? `${Math.round(Number(identity.identityConfidence) * 100)}%` : 'No informada'),
        ]),
      ]),
    ]);
  }

  function lensNav() {
    const items = [
      ['e360p-identidad', '01', 'Identidad'],
      ['e360p-caracterizacion', '02', 'Caracterización'],
      ['e360p-relaciones', '03', 'Relaciones'],
      ['e360p-contexto', '04', 'Contexto externo'],
      ['e360p-senales', '05', 'Señales y score'],
      ['e360p-evidencia', '06', 'Evidencia'],
    ];
    return node('nav', { class: 'e360p-lens-nav', 'aria-label': 'Lentes de Entidad 360' }, items.map(([id, idx, label]) => node('button', { type: 'button', onclick: () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, [node('b', { text: idx }), node('span', { text: label })])));
  }

  function identityProvenance(result) {
    const identity = result.core?.identity || {};
    const dossier = result.intelligence?.data?.dossier || {};
    const links = arr(dossier.identity_links);
    const sourceCount = arr(identity.sources).length || Object.values(result.core?.sourceStatus || {}).filter(value => value === 'AVAILABLE').length;
    return node('div', { class: 'e360p-metrics four' }, [
      metric('Entity ID', identity.entityId || result.entityId),
      metric('RUT', identity.rut || result.rut || 'No resuelto'),
      metric('Fuentes observadas', fmt(sourceCount)),
      metric('Vínculos gobernados', fmt(links.length)),
    ]);
  }

  function uafProfile(dossier, intelligence) {
    const uaf = dossier.uaf_profile || {};
    const rec = intelligence?.uaf_sii_reconciliation || null;
    const names = arr(uaf.registry_names);
    const sectors = arr(uaf.sector_names);
    if (!Object.keys(uaf).length && !rec) return empty('Sin perfil UAF materializado', 'No observado no equivale a ausencia del registro fuente.');
    return node('div', { class: 'e360p-stack' }, [
      node('div', { class: 'e360p-metrics three' }, [
        metric('Sector UAF', sectors.join(' · ') || rec?.uaf_sector_label || 'No informado'),
        metric('Denominaciones', names.length ? fmt(names.length) : '—'),
        metric('Clase registral', uaf.registry_class || 'No informada'),
      ]),
      names.length ? node('div', { class: 'e360p-chipset' }, names.slice(0, 10).map(name => node('span', { text: name }))) : null,
      rec ? node('div', { class: 'e360p-callout' }, [node('strong', { text: 'Conciliación UAF ↔ SII' }), node('span', { text: [rec.reconciliation_label || rec.reconciliation_status, rec.sii_current_status, rec.termination_date ? `término ${dateLabel(rec.termination_date)}` : 'sin término observado'].filter(Boolean).join(' · ') })]) : null,
    ]);
  }

  function taxCharacterization(core) {
    const tax = core?.data?.tax || {};
    if (!Object.keys(tax).length) return empty('Sin perfil tributario materializado', 'La ausencia del corte no se representa como cero.');
    return node('div', { class: 'e360p-stack' }, [
      node('div', { class: 'e360p-metrics three' }, [
        metric('Tramo ventas', tax.sales_band || tax.sales_band_code),
        metric('Trabajadores', fmt(tax.workers_numeric)),
        metric('Inicio actividades', dateLabel(tax.activity_start_date)),
        metric('Término de giro', tax.termination_date ? dateLabel(tax.termination_date) : 'No observado'),
        metric('Giros / actividades', fmt(tax.activity_count)),
        metric('Domicilios', fmt(tax.address_count)),
      ]),
      tax.main_activity ? node('div', { class: 'e360p-callout neutral' }, [node('strong', { text: 'Actividad principal' }), node('span', { text: tax.main_activity })]) : null,
    ]);
  }

  function trajectory(core, dossier) {
    const history = arr(core?.data?.history).slice().sort((a, b) => Number(a.commercial_year) - Number(b.commercial_year));
    const summary = dossier.trajectory_summary || {};
    if (!history.length || !global.AtlasV2Viz) return empty('Sin serie histórica disponible', 'Ausencia de historia no equivale a estabilidad.');
    return node('div', { class: 'e360p-stack' }, [
      node('div', { class: 'e360p-chart-grid' }, [
        node('div', { class: 'e360p-chart' }, [node('h4', { text: 'Escala de ventas' }), global.AtlasV2Viz.lineChart(history.map(row => ({ label: row.commercial_year, value: num(row.sales_band_rank) || 0, display: row.sales_band_code || fmt(row.sales_band_rank) })), { ariaLabel: 'Trayectoria del tramo de ventas' })]),
        node('div', { class: 'e360p-chart' }, [node('h4', { text: 'Dotación informada' }), global.AtlasV2Viz.lineChart(history.map(row => ({ label: row.commercial_year, value: num(row.workers_numeric) || 0, display: fmt(row.workers_numeric) })), { ariaLabel: 'Trayectoria de trabajadores' })]),
      ]),
      node('div', { class: 'e360p-metrics four' }, [metric('Años observados', fmt(summary.year_count || history.length)), metric('Cambios de actividad', fmt(arr(summary.main_activity_change_years).length)), metric('Cambios de región', fmt(arr(summary.region_change_years).length)), metric('Caídas dotación/ventas estables', fmt(arr(summary.workforce_drop_stable_sales_years).length))]),
    ]);
  }

  function peerPosition(dossier) {
    const peers = arr(dossier.peer_positions);
    const latest = peers[0] || {};
    const structure = dossier.structure_benchmark || {};
    if (!peers.length && !Object.keys(structure).length) return empty('Benchmark de pares no materializado', 'No se completa por analogía ni promedio.');
    return node('div', { class: 'e360p-stack' }, [
      rail('Ventas frente a pares', latest.sales_peer_percentile, latest.peer_level ? `${text(latest.peer_level)} · n=${fmt(latest.peer_n)}` : ''),
      rail('Domicilios frente a pares', structure.address_peer_percentile, structure.peer_level ? `${text(structure.peer_level)} · n=${fmt(structure.peer_n)}` : ''),
      rail('Amplitud de actividades', structure.activity_peer_percentile, structure.size_bucket ? `grupo ${text(structure.size_bucket)}` : ''),
      node('div', { class: 'e360p-guardrail' }, [node('strong', { text: 'Percentil ≠ desempeño ni riesgo. ' }), 'Sólo expresa posición dentro del grupo comparable del corte.']),
    ]);
  }

  function structureCard(dossier) {
    const s = dossier.structure_benchmark || {};
    if (!Object.keys(s).length) return empty('Estructura no materializada', 'El corte vigente no contiene esta caracterización.');
    return node('div', { class: 'e360p-metrics three' }, [
      metric('Domicilios', fmt(s.address_count)), metric('Actividades', fmt(s.activity_count)), metric('Relaciones societarias', fmt(s.ownership_edge_count)),
      metric('Socios persona jurídica', fmt(s.legal_entity_partner_count)), metric('Sociedades como socio', fmt(s.societies_as_partner_count)), metric('Tipo societario', [s.society_type, s.society_subtype].filter(Boolean).join(' · ') || '—'),
    ]);
  }

  function osflCard(dossier) {
    const o = dossier.osfl_profile || null;
    if (!o) return empty('Sin perfil OSFL materializado', 'Este bloque sólo aparece con evidencia específica del universo OSFL.');
    const flags = [o.fatf_r8_candidate ? 'Candidata FATF R8' : '', o.law21440_active ? 'Ley 21.440 vigente' : '', o.registro19862 ? 'Registro 19.862' : '', o.direct_confirmed ? 'Confirmación directa' : '', o.source_uaf_so ? 'Coincidencia SO UAF' : ''].filter(Boolean);
    return node('div', { class: 'e360p-stack' }, [
      node('div', { class: 'e360p-metrics three' }, [metric('Grupo actividad', o.activity_group), metric('Confirmación', o.confirmation_level), metric('Fuente', o.source_name)]),
      flags.length ? node('div', { class: 'e360p-chipset' }, flags.map(flag => node('span', { class: 'warn', text: flag }))) : null,
      node('div', { class: 'e360p-guardrail' }, [node('strong', { text: 'FATF R8 no es acusación. ' }), 'La clasificación delimita un universo de revisión y no imputa financiamiento del terrorismo.']),
    ]);
  }

  function resCharacterization(dossier) {
    const profile = dossier.res_profile || null;
    const life = dossier.res_lifecycle || null;
    if (!profile && !life) return empty('Sin registro RES materializado', 'No observado no equivale a inexistencia registral.');
    return node('div', { class: 'e360p-stack' }, [
      node('div', { class: 'e360p-metrics three' }, [
        metric('Constitución', dateLabel(profile?.constitution_date || life?.constitution_date)),
        metric('Capital', profile?.capital != null ? money(profile.capital) : '—'),
        metric('Comuna social', profile?.social_commune || '—'),
        metric('Actuaciones', fmt(life?.actuation_count)),
        metric('Modificaciones', fmt(life?.modification_count)),
        metric('Relaciones vigentes', fmt(life?.confirmed_current_relationship_count)),
      ]),
      life ? node('div', { class: 'e360p-callout neutral' }, [node('strong', { text: 'Ciclo societario observado' }), node('span', { text: [life.observed_lifecycle_state, life.last_change_date ? `último cambio ${dateLabel(life.last_change_date)}` : '', life.coverage_note].filter(Boolean).join(' · ') })]) : null,
    ]);
  }

  function relationshipList(dossier, result) {
    const links = arr(dossier.identity_links);
    const res = arr(dossier.res_relationships);
    const rows = [];
    links.forEach(link => rows.push({ type: link.tipo_relacion || 'Vínculo de identidad', name: link.entidad_origen_id === result.entityId ? link.entidad_destino_id : link.entidad_origen_id, status: link.estado_relacion || (link.requiere_revision ? 'Requiere revisión' : 'Observado'), confidence: link.confianza, basis: link.metodo_relacion || link.detalle }));
    res.forEach(link => rows.push({ type: link.role_label || link.relationship_type || 'Relación RES', name: link.related_name || link.related_rut || link.related_entity_id, status: link.relationship_status || (link.requires_review ? 'Requiere revisión' : 'Observada'), confidence: link.confidence, basis: link.relationship_basis || link.document_type }));
    if (!rows.length) return empty('Sin relaciones materializadas', 'La ausencia de vínculos en el corte no demuestra aislamiento de la entidad.');
    return node('div', { class: 'e360p-rel-list' }, rows.slice(0, 30).map(row => node('article', { class: 'e360p-rel-row' }, [
      node('div', {}, [node('span', { class: 'e360p-kicker', text: row.type }), node('strong', { text: row.name || 'Entidad relacionada' }), node('small', { text: [row.status, row.basis].filter(Boolean).join(' · ') })]),
      node('b', { text: num(row.confidence) == null ? '—' : `${Math.round(Number(row.confidence) * 100)}%` }),
    ])));
  }

  function reportingCard(intelligence) {
    const report = intelligence?.reporting_behavior || null;
    if (!report || report.behavior_source_state !== 'OBSERVED') return empty('Sin observación materializada de ROS / ROE', 'ATLAS no representa un faltante como “0”.');
    return node('div', { class: 'e360p-metrics three' }, [metric('ROS total', fmt(report.ros_total)), metric('ROS últimos 12m', fmt(report.ros_12m)), metric('ROE total', fmt(report.roe_total)), metric('ROE últimos 12m', fmt(report.roe_12m)), metric('Periodos observados', fmt(report.observed_periods)), metric('Corte fuente', dateLabel(report.source_cutoff_date))]);
  }

  function screeningCard(result) {
    const screening = result.screening || {};
    const sourceEntries = Object.entries(screening.sources || {}).filter(([code]) => code !== 'ICIJ_OFFSHORE');
    if (screening.status !== 'ready') return empty('Screening actual no completado', 'Disponibilidad de una fuente no equivale a resultado negativo.');
    if (!sourceEntries.length) return empty('Sin fuentes respondidas', 'No existe resultado actual verificable.');
    return node('div', { class: 'e360p-source-grid' }, sourceEntries.map(([code, source]) => {
      const records = arr(source?.records);
      const fresh = String(source?.status || '') === 'fresh';
      return node('article', { class: 'e360p-source-card' }, [
        node('header', {}, [node('strong', { text: sourceLabel(code) }), status(fresh ? 'EJECUTADO' : String(source?.status || 'SIN ESTADO').toUpperCase(), fresh)]),
        node('b', { class: 'e360p-source-number', text: records.length ? fmt(records.length) : fresh ? '0 candidatos' : '—' }),
        node('p', { text: records.length ? `${records.slice(0, 2).map(record => record.related_entity_name || record.summary || 'Candidato').join(' · ')}` : fresh ? 'Sin candidatos en esta ejecución.' : 'La fuente no respondió como fresca.' }),
      ]);
    }));
  }

  function digitalIdentityCard(result) {
    const observed = arr(result.intelligence?.data?.digital_identity);
    const host = node('div', { class: 'e360p-stack' });
    if (observed.length) host.append(node('div', { class: 'e360p-rel-list' }, observed.slice(0, 12).map(item => node('article', { class: 'e360p-rel-row' }, [node('div', {}, [node('span', { class: 'e360p-kicker', text: item.contact_type || 'CONTACTO' }), node('strong', { text: item.contact_value || 'Contacto' }), node('small', { text: [item.verification_status, item.source_label].filter(Boolean).join(' · ') })]), node('b', { text: item.confidence_pct == null ? '—' : `${fmt(item.confidence_pct)}%` })]))));
    else host.append(empty('Sin contactos digitales materializados', 'Puedes consultar manualmente un alias conocido.'));

    const live = node('div', { class: 'e360p-digital-live' });
    const input = node('input', { type: 'search', placeholder: 'alias o username, sin @', autocomplete: 'off', 'aria-label': 'Alias para identidad digital' });
    const run = async () => {
      const username = input.value.trim().replace(/^@/, '');
      if (username.length < 2) return;
      clear(live); live.append(node('span', { class: 'e360p-loading-inline', text: `Buscando @${username}…` }));
      const out = await global.AtlasV2Entity360.searchDigitalIdentity(username, { depth: 'quick' });
      clear(live);
      if (out.status !== 'ready') { live.append(empty('Búsqueda digital no disponible', out.message || out.code || 'No fue posible completar la consulta.')); return; }
      live.append(node('div', { class: 'e360p-guardrail' }, [node('strong', { text: `${fmt(out.records?.length)} perfil(es) técnico(s) observado(s). ` }), 'Username ≠ identidad; exige corroboración independiente.']));
      arr(out.records).slice(0, 12).forEach(record => live.append(node('article', { class: 'e360p-rel-row' }, [node('div', {}, [node('span', { class: 'e360p-kicker', text: record?.evidence?.platform || 'PERFIL PÚBLICO' }), node('strong', { text: record.title || `@${username}` }), node('small', { text: arr(record?.evidence?.engines).join(' + ') || record.summary || '' })]), node('b', { text: `${Math.round(Number(record.match_confidence || 0) * 100)}%` })])));
    };
    input.addEventListener('keydown', event => { if (event.key === 'Enter') void run(); });
    host.append(node('div', { class: 'e360p-inline-query' }, [input, node('button', { type: 'button', text: 'Buscar identidad digital', onclick: () => void run() })]), live);
    return host;
  }

  function spendCard(result, api) {
    const spend = result.core?.data?.spend || {};
    const publicSpend = result.publicSpend || {};
    const rows = [...arr(publicSpend.procurement?.items), ...arr(publicSpend.budget?.items)].slice(0, 8);
    if (!Object.keys(spend).length && !rows.length) return empty('Sin gasto público materializado', 'No observado no se representa como monto cero.');
    return node('div', { class: 'e360p-stack' }, [
      node('div', { class: 'e360p-metrics three' }, [metric('Monto observado', spend.total_clp ? money(spend.total_clp) : '—'), metric('Órdenes', fmt(spend.order_count)), metric('Compradores', fmt(spend.buyer_count))]),
      rows.length ? node('div', { class: 'e360p-chipset' }, rows.map(row => node('span', { text: row.name || row.domain }))) : null,
      node('button', { class: 'e360p-link-button', type: 'button', text: 'Profundizar en Gasto público →', onclick: () => api.navigate('gasto-publico', result.rut ? { rut: result.rut } : {}) }),
    ]);
  }

  function groupComposition(score) {
    const groups = [
      ['Registral', num(score?.registry_group_score) || 0, 'registry'],
      ['Económica', num(score?.economic_group_score) || 0, 'economic'],
      ['Sancionatoria', num(score?.sanctions_group_score) || 0, 'sanctions'],
    ];
    const total = groups.reduce((sum, item) => sum + item[1], 0);
    return node('div', { class: 'e360p-group-composition' }, [
      node('div', { class: 'e360p-group-bar' }, groups.filter(item => item[1] > 0).map(item => node('i', { class: item[2], style: `width:${total ? (item[1] / total * 100).toFixed(1) : 0}%` }))),
      node('div', { class: 'e360p-group-grid' }, groups.map(item => node('div', {}, [node('span', { class: item[2], text: item[0] }), node('strong', { text: item[1] ? fmt(item[1], 1) : '—' })]))),
    ]);
  }

  function markEvidence(evidence) {
    if (!evidence || typeof evidence !== 'object') return 'Sin evidencia estructurada adicional.';
    const pairs = Object.entries(evidence).slice(0, 8).map(([key, value]) => `${String(key).replace(/_/g, ' ')}: ${Array.isArray(value) ? value.join(', ') : typeof value === 'object' ? '[detalle estructurado]' : String(value)}`);
    return pairs.join(' · ') || 'Sin evidencia estructurada adicional.';
  }

  function ipa3Card(dossier) {
    const score = dossier.ipa3_score || null;
    const marks = arr(dossier.ipa3_marks);
    if (!score) return empty('IPA3 no materializado para esta entidad', 'Ausencia del snapshot no equivale a puntaje cero.');
    const scoreValue = num(score.ipa3_score);
    return node('div', { class: 'e360p-stack' }, [
      node('div', { class: 'e360p-score-layout' }, [
        scoreRing(score),
        node('div', { class: 'e360p-score-metrics' }, [metric('Banda shadow', scoreValue ? String(score.priority_band_shadow || '—').replace(/_/g, ' ') : 'Sin marca activa'), metric('Confianza cálculo', score.score_confidence_pct == null ? '—' : `${fmt(score.score_confidence_pct)}%`), metric('Cobertura cálculo', score.coverage_index_pct == null ? '—' : `${fmt(score.coverage_index_pct)}%`), metric('Cobertura económica', score.economic_coverage_pct == null ? '—' : `${fmt(score.economic_coverage_pct)}%`)]),
        groupComposition(score),
      ]),
      marks.length ? node('div', { class: 'e360p-marks' }, marks.map(mark => {
        const contribution = num(mark.contribution) || 0;
        const max = Math.max(1, ...marks.map(item => num(item.contribution) || 0));
        const details = node('details', { class: `e360p-mark ${mark.included_in_score === true ? '' : 'is-excluded'}` }, [
          node('summary', {}, [
            node('div', {}, [node('code', { text: mark.mark_id }), node('strong', { text: mark.mark_name || 'Marca' }), node('small', { text: [mark.primary_dimension, mark.readiness, mark.confidence != null ? `confianza ${fmt(mark.confidence, 2)}` : ''].filter(Boolean).join(' · ') })]),
            node('b', { text: contribution ? fmt(contribution, 1) : '—' }),
          ]),
          node('div', { class: 'e360p-mark-evidence' }, [node('p', { text: markEvidence(mark.evidence) }), node('div', { class: 'e360p-mark-track' }, [node('i', { class: String(mark.score_group || '').toLowerCase(), style: `width:${Math.max(2, contribution / max * 100).toFixed(1)}%` })])]),
        ]);
        return details;
      })) : empty('Ninguna marca publicada', 'No se interpreta como prioridad baja ni ausencia de riesgo.'),
      node('div', { class: 'e360p-guardrail hot' }, [node('strong', { text: 'IPA3 = prioridad analítica, no probabilidad LA/FT. ' }), 'Ordena revisión del corte y no acredita conducta.']),
    ]);
  }

  function sanctionTimeline(dossier) {
    const rows = arr(dossier.sanction_resolution).filter(row => row.source_event_date);
    if (!rows.length) return null;
    const stamps = rows.map(row => new Date(row.source_event_date).getTime()).filter(Number.isFinite);
    if (!stamps.length) return null;
    const min = Math.min(...stamps), max = Math.max(...stamps), span = Math.max(1, max - min);
    return node('div', { class: 'e360p-timeline' }, [
      node('div', { class: 'e360p-timeline-track' }, rows.map(row => {
        const stamp = new Date(row.source_event_date).getTime();
        const left = (stamp - min) / span * 100;
        return node('i', { class: 'e360p-timeline-dot', style: `left:${left.toFixed(1)}%`, title: `${dateLabel(row.source_event_date)} · ${row.regulator || 'Supervisor'}` });
      })),
      node('div', { class: 'e360p-timeline-scale' }, [node('span', { text: dateLabel(new Date(min).toISOString()) }), node('span', { text: dateLabel(new Date(max).toISOString()) })]),
    ]);
  }

  function sanctionEvidence(dossier) {
    const summary = dossier.sanction_summary || null;
    const rows = arr(dossier.sanction_resolution);
    if (!summary && !rows.length) return empty('Sin eventos sancionatorios resueltos', 'Ningún evento del corte quedó resuelto contra este Entity ID.');
    const table = node('div', { class: 'e360p-table-wrap' }, [node('table', { class: 'e360p-table' }, [
      node('thead', {}, [node('tr', {}, ['Evento', 'Regulador', 'Fecha', 'Resolución', 'Confianza'].map(label => node('th', { text: label })))]),
      node('tbody', {}, rows.slice(0, 20).map(row => node('tr', {}, [node('td', { text: row.sanction_id || '—' }), node('td', { text: row.regulator || '—' }), node('td', { text: dateLabel(row.source_event_date) }), node('td', { text: String(row.resolution_status || '—').replace(/_/g, ' ') }), node('td', { text: num(row.confidence) == null ? '—' : `${Math.round(Number(row.confidence) * 100)}%` })]))),
    ])]);
    return node('div', { class: 'e360p-stack' }, [
      summary ? node('div', { class: 'e360p-metrics four' }, [metric('Eventos', fmt(summary.sanction_event_count)), metric('36 meses', fmt(summary.sanction_count_36m)), metric('Reguladores 60m', fmt(summary.regulator_count_60m)), metric('LA/FT directo resuelto', fmt(summary.laft_direct_count))]) : null,
      sanctionTimeline(dossier),
      rows.length ? table : null,
      node('div', { class: 'e360p-guardrail hot' }, [node('strong', { text: 'Sanción administrativa ≠ delito. ' }), 'Una resolución conservadora mantiene su condición candidata y exige revisión.']),
    ]);
  }

  function resEvidence(dossier) {
    const rows = arr(dossier.res_evidence);
    if (!rows.length) return empty('Sin documentos RES materializados', 'La ausencia de evidencia en este corte no se interpreta como ausencia registral.');
    return node('div', { class: 'e360p-evidence-list' }, rows.map(row => node('article', {}, [
      node('div', {}, [node('span', { class: 'e360p-kicker', text: row.document_type || 'DOCUMENTO RES' }), node('strong', { text: row.document_title || row.actuation_type || 'Actuación registral' })]),
      node('small', { text: [dateLabel(row.actuation_date || row.registry_date), row.review_status, row.extraction_status].filter(Boolean).join(' · ') }),
    ])));
  }

  function methodology(dossier) {
    const disposition = dossier.disposition || null;
    return node('div', { class: 'e360p-stack' }, [
      disposition ? node('div', { class: 'e360p-callout neutral' }, [node('strong', { text: 'Última disposición analítica' }), node('span', { text: [String(disposition.verdict || '').replace(/_/g, ' '), dateLabel(disposition.created_at), disposition.rationale].filter(Boolean).join(' · ') })]) : null,
      node('div', { class: 'e360p-method-grid' }, [
        metric('Prioridad ≠ probabilidad', 'IPA3 ordena revisión'),
        metric('Percentil ≠ desempeño', 'posición entre pares'),
        metric('Relación ≠ transferencia', 'el vínculo no hereda riesgo'),
        metric('Candidato ≠ identidad firme', 'requiere corroboración'),
        metric('Sanción ≠ delito', 'evento administrativo'),
        metric('Ausencia ≠ cero', 'dato no materializado'),
      ]),
    ]);
  }

  function analyticalActions(api, result) {
    const params = {}; if (result.rut) params.rut = result.rut; if (result.entityId) params.entity_id = result.entityId;
    return node('div', { class: 'e360p-actions' }, [
      node('button', { type: 'button', text: 'Abrir Relaciones', onclick: () => api.navigate('relaciones', params) }),
      node('button', { type: 'button', text: 'Abrir Gasto público', onclick: () => api.navigate('gasto-publico', params) }),
      node('button', { type: 'button', text: 'Abrir Vigilancia', onclick: () => api.navigate('vigilancia', params) }),
      node('button', { type: 'button', text: 'Volver al explorador', onclick: () => api.navigate('entidad') }),
    ]);
  }

  function renderDossier(container, api, result) {
    const intelligence = result.intelligence?.data || {};
    const dossier = intelligence.dossier || {};
    const identity = result.core?.identity || {};
    container.append(hero(result), lensNav());

    container.append(section('e360p-identidad', '01', 'Identidad', 'Quién es la entidad, de dónde proviene su resolución y qué registro UAF se observa.', [
      node('div', { class: 'e360p-grid two' }, [
        card('PROCEDENCIA', 'Identidad resuelta', 'FUSION · PERFIL', identityProvenance(result)),
        card('PERÍMETRO UAF', 'Registro UAF y vigencia', 'RADAR UAF', uafProfile(dossier, intelligence)),
      ]),
    ]));

    container.append(section('e360p-caracterizacion', '02', 'Caracterización', 'Situación tributaria, trayectoria, pares, estructura, OSFL y RES en el mismo expediente.', [
      node('div', { class: 'e360p-grid two' }, [
        card('SII', 'Perfil tributario', 'RADAR SII', taxCharacterization(result.core)),
        card('PARES', 'Posición frente a comparables', 'IPA3 · PARES', peerPosition(dossier)),
      ]),
      card('TRAYECTORIA', 'Evolución observada', 'SII · HISTORIA', trajectory(result.core, dossier), 'wide'),
      node('div', { class: 'e360p-grid two' }, [
        card('ESTRUCTURA', 'Estructura declarada', 'SII · ESTRUCTURA', structureCard(dossier)),
        card('RES', 'Sociedad y ciclo registral', 'REGISTRO RES', resCharacterization(dossier)),
      ]),
      card('OSFL', 'Perfil OSFL y FATF R8', 'RADAR OSFL', osflCard(dossier), 'wide'),
    ]));

    container.append(section('e360p-relaciones', '03', 'Relaciones', 'Vínculos de identidad y relaciones societarias preservando estado, método y confianza.', [
      card('GRAFO', 'Vínculos gobernados', 'FUSION · RES', relationshipList(dossier, result), 'wide'),
      node('div', { class: 'e360p-guardrail' }, [node('strong', { text: 'Relación ≠ transferencia de riesgo. ' }), 'Un vínculo candidato no promueve identidad ni transfiere atributos entre entidades.']),
    ]));

    container.append(section('e360p-contexto', '04', 'Contexto externo', 'Reportabilidad, listas, identidad digital y compras públicas se mantienen como dominios separados.', [
      node('div', { class: 'e360p-grid two' }, [
        card('REPORTABILIDAD', 'ROS / ROE observados', 'UAF · MATERIALIZADO', reportingCard(intelligence)),
        card('GASTO PÚBLICO', 'Compras y presupuesto', 'ATLAS · GASTO', spendCard(result, api)),
      ]),
      card('SCREENING', 'Listas y fuentes internacionales', 'LIVE · ON DEMAND', screeningCard(result), 'wide'),
      card('IDENTIDAD DIGITAL', 'Contactos y alias observados', 'OSINT · CONTEXTO', digitalIdentityCard(result), 'wide'),
    ]));

    container.append(section('e360p-senales', '05', 'Señales y score', 'Descomposición explicable de IPA3 con grupos, marcas, confianza y evidencia de cálculo.', [
      card('IPA3 v0.4-shadow', 'Prioridad analítica de la entidad', 'IPA3 · SNAPSHOT', ipa3Card(dossier), 'wide'),
    ]));

    container.append(section('e360p-evidencia', '06', 'Evidencia', 'Resolución sancionatoria, documentos RES y reglas de lectura del expediente.', [
      node('div', { class: 'e360p-grid two' }, [
        card('SANCIONES', 'Resolución de identidad', 'RADAR SANCIONES', sanctionEvidence(dossier)),
        card('RES', 'Documentos y actuaciones', 'REGISTRO RES', resEvidence(dossier)),
      ]),
      card('MÉTODO', 'Cómo se lee esta ficha', 'ATLAS · CONTRATO', methodology(dossier), 'wide'),
      analyticalActions(api, result),
    ]));
  }

  async function resolve(container, api, reference, serial) {
    const host = node('div', { class: 'e360p-live' });
    container.append(host);
    host.append(node('div', { class: 'e360p-loading' }, [node('strong', { text: 'Construyendo Expediente Analítico 360…' }), node('span', { text: 'Identidad, SII, UAF, RES, OSFL, pares, IPA3, sanciones, reportabilidad y contexto externo.' })]));
    const result = await global.AtlasV2Entity360.read(reference, { timeoutMs: 18000 });
    if (serial !== renderSerial) return;
    clear(host);
    if (result.status !== 'ready') {
      host.append(empty('No fue posible materializar el expediente', result.message || result.core?.message || 'Revisa la identidad seleccionada y vuelve a intentar.'));
      return;
    }
    renderDossier(host, api, result);
  }

  function searchFingerprint(item) {
    const sources = [...new Set(arr(item.sources).concat(item.matchSource ? [item.matchSource] : []))].slice(0, 6);
    return node('div', { class: 'e360p-fingerprint' }, sources.map(source => node('i', { class: sourceClass(source), title: sourceLabel(source) })));
  }

  function searchResult(api, item, query) {
    const score = Math.round(Number(item.matchScore || 0) * 100);
    return node('article', { class: 'e360p-search-row' }, [
      node('button', { type: 'button', onclick: () => api.navigate('entidad', { entity_id: item.entityId, rut: item.rut || '', q: query || item.name || item.matchedLabel || '' }) }, [
        node('div', { class: 'e360p-search-main' }, [
          node('div', { class: 'e360p-search-title' }, [node('strong', { text: item.name || item.matchedLabel || 'Entidad sin etiqueta' }), node('span', { class: sourceClass(item.matchSource), text: item.resultTier === 'PRESS_CONTEXT' ? 'PRENSA · CONTEXTO' : item.resultTier === 'DIGITAL_IDENTITY' ? 'IDENTIDAD DIGITAL' : item.resultTier === 'EXACT_IDENTITY' ? 'IDENTIDAD EXACTA' : 'IDENTIDAD' })]),
          node('p', { text: [item.rut || 'Sin RUT resuelto', item.entityType, item.commune, item.region].filter(Boolean).join(' · ') }),
          searchFingerprint(item),
        ]),
        node('div', { class: 'e360p-search-score' }, [node('b', { text: `${score}%` }), node('span', { text: String(item.matchType || 'coincidencia').replace(/_/g, ' ') })]),
      ]),
    ]);
  }

  async function runSearch(api, query, host, serial) {
    clear(host); host.append(node('div', { class: 'e360p-loading compact' }, [node('strong', { text: 'Resolviendo identidad…' }), node('span', { text: 'RUT, razón social, denominaciones UAF, identidad digital y Radar Prensa.' })]));
    try {
      const out = await global.AtlasV2EntitySearch.search(query, { limit: 50, route: 'entidad:parity-search' });
      if (serial !== searchSerial) return;
      clear(host);
      const items = arr(out.items);
      if (!items.length) { host.append(empty('Sin coincidencias', 'Prueba con RUT, razón social, una denominación UAF o un nombre observado en prensa.')); return; }
      const toolbar = node('div', { class: 'e360p-search-toolbar' });
      const list = node('div', { class: 'e360p-search-list' });
      const filters = [['all', 'Todos'], ['exact', 'Exactos'], ['rut', 'Con RUT'], ['uaf', 'UAF'], ['press', 'Radar Prensa'], ['digital', 'Identidad digital']];
      const matches = (item, key) => {
        if (key === 'exact') return item.resultTier === 'EXACT_IDENTITY';
        if (key === 'rut') return Boolean(item.rut);
        if (key === 'uaf') return /UAF/.test(item.matchSource) || arr(item.sources).some(source => /UAF/.test(String(source).toUpperCase()));
        if (key === 'press') return item.resultTier === 'PRESS_CONTEXT' || /PRESS|PRENSA/.test(item.matchSource);
        if (key === 'digital') return item.resultTier === 'DIGITAL_IDENTITY';
        return true;
      };
      const paint = key => {
        clear(list);
        const visible = items.filter(item => matches(item, key));
        visible.forEach(item => list.append(searchResult(api, item, query)));
        if (!visible.length) list.append(empty('Sin coincidencias para este filtro', 'Cambia de lente sin perder la búsqueda.'));
      };
      filters.forEach(([key, label], index) => {
        const button = node('button', { type: 'button', class: index === 0 ? 'is-active' : '', onclick: () => { Array.from(toolbar.children).forEach(child => child.classList.remove('is-active')); button.classList.add('is-active'); paint(key); } }, [node('span', { text: label }), node('b', { text: fmt(items.filter(item => matches(item, key)).length) })]);
        toolbar.append(button);
      });
      host.append(node('div', { class: 'e360p-search-summary' }, [node('strong', { text: `${fmt(items.length)} coincidencia(s)` }), node('span', { text: 'Identidad primero; contexto nominal después.' })]), toolbar, list);
      paint('all');
    } catch (error) {
      if (serial !== searchSerial) return;
      clear(host); host.append(empty('Búsqueda no disponible', error?.message || 'No fue posible consultar el índice de identidad.'));
    }
  }

  function renderSearch(container, route, api) {
    const query = route.params.get('q') || '';
    const host = node('div', { class: 'e360p-search-host' });
    const input = node('input', { type: 'search', value: query, placeholder: 'Razón social, RUT, Entity ID, denominación UAF o entidad observada…', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Buscar entidad' });
    const execute = () => { const q = input.value.trim(); if (!q) return; api.navigate('entidad', { q }); const serial = ++searchSerial; void runSearch(api, q, host, serial); };
    input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); execute(); } });
    container.append(node('section', { class: 'e360p-explorer' }, [
      node('header', {}, [node('div', {}, [node('span', { class: 'e360p-eyebrow', text: 'ENTIDADES' }), node('h1', { text: 'Explorador' }), node('p', { text: 'Exploración gobernada de identidades y acceso directo al Expediente Analítico 360.' })])]),
      node('div', { class: 'e360p-search-command' }, [node('span', { class: 'e360p-search-icon', text: '⌕' }), input, node('button', { type: 'button', text: 'Buscar', onclick: execute })]),
      node('div', { class: 'e360p-quick' }, [node('span', { text: 'Nóminas y lentes rápidos' }), ...['Identidad exacta', 'UAF', 'Radar Prensa', 'Identidad digital', 'Multi-fuente'].map(label => node('button', { type: 'button', text: label, onclick: () => input.focus() }))]),
    ]), host);
    if (query) { const serial = ++searchSerial; void runSearch(api, query, host, serial); }
    else host.append(node('div', { class: 'e360p-explorer-blank' }, [node('div', { text: '⌕' }), node('strong', { text: 'Busca una entidad para abrir su expediente' }), node('p', { text: 'La ficha recupera los seis lentes del despliegue anterior: identidad, caracterización, relaciones, contexto externo, señales/score y evidencia.' })]));
  }

  function render(container, route, api) {
    const serial = ++renderSerial;
    const rawRut = route.params.get('rut') || '';
    const entityId = route.params.get('entity_id') || '';
    const query = route.params.get('q') || '';
    const rut = global.AtlasV2Entity360?.validRutShape(rawRut) ? global.AtlasV2Entity360.canonicalRut(rawRut) : '';
    if (!entityId && !rut) { renderSearch(container, route, api); return; }
    const reference = { entityId: entityId || global.AtlasV2Entity360.entityIdFromRut(rut), rut, name: query, q: query };
    container.append(node('button', { class: 'e360p-back', type: 'button', text: '← Volver al explorador', onclick: () => api.navigate('entidad', query ? { q: query } : {}) }));
    void resolve(container, api, reference, serial);
  }

  function register() {
    if (!global.AtlasV2Shell?.registerSurface || !global.AtlasV2Entity360?.installed || !global.AtlasV2EntitySearch?.installed) return false;
    global.AtlasV2Shell.registerSurface('entidad', render);
    global.__ATLAS_V2_ENTITY360_PARITY__ = Object.freeze({ installed: true, version: VERSION, route: 'entidad', mode: 'SIX_LENS_NATIVE_V2', dossier: 'ENTITY360_LEGACY_PARITY_V2' });
    return true;
  }

  if (!register()) global.addEventListener('atlas:v2-shell-ready', register, { once: true });
})(window);
