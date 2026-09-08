'use strict';

(function installAtlasV2Entity360Expediente(global) {
  if (global.__ATLAS_V2_ENTITY360_EXPEDIENTE__?.installed) return;

  const VERSION = 'ENTITY360_EXPEDIENTE_EXECUTIVE_V2_20260908';
  const STYLE_VERSION = 'entity360-expediente-20260908-1';
  const SALES = {
    1: 'Sin información de ventas', 2: 'Micro 1 · 0,01–200 UF/año', 3: 'Micro 2 · 200,01–600 UF/año',
    4: 'Micro 3 · 600,01–2.400 UF/año', 5: 'Pequeña 1 · 2.400,01–5.000 UF/año',
    6: 'Pequeña 2 · 5.000,01–10.000 UF/año', 7: 'Pequeña 3 · 10.000,01–25.000 UF/año',
    8: 'Mediana 1 · 25.000,01–50.000 UF/año', 9: 'Mediana 2 · 50.000,01–100.000 UF/año',
    10: 'Grande 1 · 100.000,01–200.000 UF/año', 11: 'Grande 2 · 200.000,01–600.000 UF/año',
    12: 'Grande 3 · 600.000,01–1.000.000 UF/año', 13: 'Grande 4 · Más de 1.000.000 UF/año',
  };
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
  function arr(value) { return Array.isArray(value) ? value : value == null ? [] : [value]; }
  function num(value) { if (value === null || value === undefined || value === '') return null; const n = Number(value); return Number.isFinite(n) ? n : null; }
  function fmt(value, digits = 0) { const n = num(value); return n == null ? '—' : n.toLocaleString('es-CL', { minimumFractionDigits: digits, maximumFractionDigits: digits }); }
  function text(value, fallback = '—') { const out = String(value ?? '').trim(); return out || fallback; }
  function dateText(value) { if (!value) return '—'; const d = new Date(value); return Number.isNaN(d.getTime()) ? String(value).slice(0, 10) : d.toLocaleDateString('es-CL'); }
  function money(value) { const n = num(value); if (n == null) return '—'; const a = Math.abs(n); if (a >= 1e12) return `$${(n / 1e12).toLocaleString('es-CL', { maximumFractionDigits: 1 })} bill.`; if (a >= 1e9) return `$${(n / 1e9).toLocaleString('es-CL', { maximumFractionDigits: 1 })} mil MM`; if (a >= 1e6) return `$${(n / 1e6).toLocaleString('es-CL', { maximumFractionDigits: 1 })} MM`; return `$${Math.round(n).toLocaleString('es-CL')}`; }
  function canonicalRut(value) { return global.AtlasV2Entity360?.canonicalRut ? global.AtlasV2Entity360.canonicalRut(value) : String(value || '').trim(); }
  function percent01(value) { const n = num(value); if (n == null) return null; return Math.max(0, Math.min(100, n <= 1 ? n * 100 : n)); }
  function split(value) { if (Array.isArray(value)) return value.map(String).map(v => v.trim()).filter(Boolean); return String(value || '').split('|').map(v => v.trim()).filter(Boolean); }
  function salesLabel(tax) { const raw = text(tax?.sales_band || tax?.sales_band_code, ''); if (!raw) return '—'; if (/\bUF\b/i.test(raw)) return raw; const code = /^([1-9]|1[0-3])$/.test(raw) ? Number(raw) : null; return code && SALES[code] ? SALES[code] : raw; }

  function injectStyle() {
    if (document.getElementById('atlas-v2-entity360-expediente-style')) return;
    const base = new URL('./', document.currentScript?.src || document.baseURI);
    document.head.appendChild(node('link', { id: 'atlas-v2-entity360-expediente-style', rel: 'stylesheet', href: new URL(`entity360-expediente-surface.css?v=${STYLE_VERSION}`, base).href }));
  }

  function empty(message) { return node('div', { class: 'e36x-empty', text: message }); }
  function card(title, source, body, cls = '') {
    return node('article', { class: `e36x-card ${cls}`.trim() }, [
      node('header', {}, [node('h3', { text: title }), source ? node('span', { text: source }) : null]),
      node('div', { class: 'e36x-card-body' }, body),
    ]);
  }
  function metric(label, value, detail = '', tone = '') {
    return node('article', { class: `e36x-kpi ${tone}`.trim() }, [
      node('div', { class: 'e36x-kpi-dot' }),
      node('div', {}, [node('span', { text: label }), node('strong', { text: value || '—' }), detail ? node('small', { text: detail }) : null]),
    ]);
  }
  function kv(rows) {
    const dl = node('dl', { class: 'e36x-kv' });
    rows.forEach(([label, value]) => dl.append(node('dt', { text: label }), node('dd', { text: value == null || value === '' ? '—' : value })));
    return dl;
  }
  function pill(label, active = false) { return node('span', { class: `e36x-pill ${active ? 'present' : 'missing'}`, text: label }); }

  function getData(core, intelligence) {
    const base = intelligence?.data?.base || core?.data || {};
    const dossier = intelligence?.data?.dossier || {};
    const recon = intelligence?.data?.uaf_sii_reconciliation || {};
    const reporting = intelligence?.data?.reporting_behavior || {};
    const identity = core?.identity || base?.identity || {};
    const tax = base.tax || core?.data?.tax || {};
    const spend = base.spend || core?.data?.spend || dossier.public_spend || {};
    return { base, dossier, recon, reporting, identity, tax, spend };
  }

  function activities(data) {
    const tax = data.tax || {};
    const names = split(tax.activity_names || tax.activities || tax.activity_labels);
    const codes = split(tax.activity_codes || tax.codes);
    const main = text(tax.main_activity, '');
    const rows = names.map((name, index) => ({ name, code: codes[index] || '', principal: main ? name.trim().toLocaleLowerCase('es-CL') === main.toLocaleLowerCase('es-CL') : index === 0 }));
    if (main && !rows.some(row => row.principal)) rows.unshift({ name: main, code: codes[0] || '', principal: true });
    return rows;
  }

  function sourcePresence(data, screening) {
    const { dossier, recon, identity, spend } = data;
    const sourceStatus = data.base?.sourceStatus || {};
    const sourceNames = arr(identity.sources).map(v => String(v).toUpperCase());
    const has = key => sourceNames.some(v => v.includes(key)) || Object.entries(sourceStatus).some(([name, status]) => name.toUpperCase().includes(key) && status === 'AVAILABLE');
    return [
      ['SII', Boolean(Object.keys(data.tax || {}).length) || has('SII')],
      ['UAF', Boolean(Object.keys(dossier.uaf_profile || {}).length) || Boolean(Object.keys(recon || {}).length) || has('UAF')],
      ['OSFL', Boolean(dossier.osfl_profile) || has('OSFL')],
      ['RES', Boolean(dossier.res_profile || dossier.res_lifecycle) || has('RES')],
      ['Sanciones', arr(dossier.sanction_resolution).length > 0 || Boolean(dossier.sanction_summary) || has('SANC')],
      ['Compras públicas', Boolean(Object.keys(spend || {}).length) || has('SPEND') || has('COMPRA')],
      ['Prensa', pressItems(data).length > 0 || has('PRESS') || has('PRENSA')],
      ['Screening', screening?.status === 'ready'],
    ];
  }

  function pressItems(data) {
    const profile = data.base?.identity?.profile || data.identity?.profile || {};
    const candidates = [
      ...arr(profile.eventos),
      ...arr(profile.events),
      ...arr(data.dossier.press_evidence),
      ...arr(data.dossier.press_events),
    ];
    const out = [];
    const seen = new Set();
    candidates.forEach(item => {
      const title = text(item?.title || item?.titulo || item?.headline || item?.tipo, '');
      if (!title) return;
      const url = text(item?.url || item?.link || item?.source_url || item?.article_url, '');
      const key = `${title}|${url}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ title, summary: text(item?.summary || item?.resumen || item?.description || item?.detalle, ''), media: text(item?.media || item?.medio || item?.source_name || item?.source, 'Radar Prensa'), date: item?.date || item?.fecha || item?.published_at || item?.event_date || '', url: /^https?:\/\//i.test(url) ? url : '' });
    });
    return out.sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 12);
  }

  function timeline(data, screening) {
    const events = [];
    const push = (date, title, detail, source, tone = 'blue', url = '') => { if (title) events.push({ date, title, detail, source, tone, url }); };
    const { tax, dossier, recon, spend, base } = data;
    if (tax.activity_start_date || tax.first_activity_registration_date) push(tax.activity_start_date || tax.first_activity_registration_date, 'Inicio de actividades SII', text(tax.main_activity, 'Actividad principal no materializada.'), 'SII');
    const resDate = dossier.res_profile?.constitution_date || dossier.res_profile?.res_constitution_date || dossier.res_lifecycle?.constitution_date || base?.identity?.res_constitution_date;
    if (resDate) push(resDate, 'Constitución societaria observada', 'Hecho registral materializado en RES.', 'RES');
    arr(base.history).forEach(row => {
      const year = num(row.commercial_year);
      const date = year ? `${year}-12-31` : row.updated_at;
      if (row.main_activity_changed) push(date, 'Cambio de actividad principal', `${text(row.prior_main_activity, 'Actividad previa no materializada')} → ${text(row.main_activity, 'Actividad no materializada')}`, 'SII histórico', 'amber');
      if (row.region_changed) push(date, 'Cambio territorial', `${text(row.prior_region)} → ${text(row.region)}`, 'SII histórico', 'amber');
    });
    const termination = recon.termination_date || tax.termination_date;
    if (termination) push(termination, 'Término de giro publicado en SII', recon.suggested_action || 'Contrastar vigencia registral.', 'SII ↔ UAF', 'critical');
    arr(dossier.sanction_resolution).forEach(item => push(item.source_event_date || item.event_date || item.date, `Antecedente sancionatorio · ${text(item.regulator, 'regulador')}`, text(item.reason || item.subject || item.source_entity_name || item.resolution_status, 'Evidencia administrativa materializada.'), 'Sanciones', 'critical', item.document_url || item.source_url || ''));
    if (spend.first_order_date) push(spend.first_order_date, 'Primera compra pública materializada', `${fmt(spend.order_count)} orden(es) en el corte disponible.`, 'Compras públicas', 'amber');
    if (spend.last_order_date && spend.last_order_date !== spend.first_order_date) push(spend.last_order_date, 'Última compra pública materializada', `Monto acumulado observado: ${money(spend.total_clp)}.`, 'Compras públicas', 'amber');
    pressItems(data).slice(0, 6).forEach(item => push(item.date, item.title, item.summary || 'Coincidencia de prensa materializada.', item.media, 'press', item.url));
    const candidates = screeningRecords(screening);
    if (candidates.length) push(screening.checkedAt, 'Coincidencia técnica en screening internacional', `${candidates.length} candidato(s) requieren revisión analítica.`, 'Screening live', 'critical');
    return events.filter(event => event.date).sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 24);
  }

  function screeningRecords(screening) {
    const out = [];
    Object.entries(screening?.sources || {}).forEach(([code, source]) => arr(source?.records || source?.candidates || source?.matches || source?.items).forEach(record => out.push({ code, ...record })));
    return out.sort((a, b) => Number(b.match_confidence || b.score || 0) - Number(a.match_confidence || a.score || 0));
  }

  function hero(data, screening, api, query) {
    const identity = data.identity || {};
    const sourceRows = sourcePresence(data, screening);
    const coverage = sourceRows.filter(([, present]) => present).length;
    const name = identity.name || data.recon.resolved_name || 'Entidad';
    const statusText = data.recon.reconciliation_label || data.tax.current_status || identity.status || 'Estado no materializado';
    return node('section', { class: 'e36x-hero' }, [
      node('div', { class: 'e36x-hero-main' }, [
        node('button', { type: 'button', class: 'e36x-back', text: '← Entidades', onclick: () => api.navigate('entidad', query ? { q: query } : {}) }),
        node('span', { class: 'e36x-eyebrow', text: 'ENTIDAD 360 · EXPEDIENTE ANALÍTICO' }),
        node('div', { class: 'e36x-titleline' }, [node('h1', { text: name }), node('span', { class: 'e36x-state', text: statusText })]),
        node('p', { text: [identity.rut || data.recon.rut, identity.entityType, identity.commune, identity.region].filter(Boolean).join(' · ') || 'Identidad materializada sin metadatos territoriales completos.' }),
        node('div', { class: 'e36x-source-strip' }, sourceRows.map(([label, present]) => pill(label, present))),
      ]),
      node('aside', { class: 'e36x-coverage' }, [node('span', { text: 'Cobertura ejecutiva' }), node('strong', {}, [String(coverage), node('small', { text: ` / ${sourceRows.length}` })]), node('div', {}, [node('i', { style: { width: `${Math.round(coverage / sourceRows.length * 100)}%` } })]), node('small', { text: 'fuentes con dato materializado' })]),
    ]);
  }

  function kpis(data) {
    const sanctions = arr(data.dossier.sanction_resolution).length || num(data.dossier.sanction_summary?.procedure_count);
    const uaf = data.dossier.uaf_profile || {};
    return node('section', { class: 'e36x-kpis' }, [
      metric('Ventas anuales', salesLabel(data.tax), data.tax.commercial_year ? `Año ${data.tax.commercial_year}` : ''),
      metric('Trabajadores', data.tax.workers_numeric != null ? fmt(data.tax.workers_numeric) : '—', data.tax.commercial_year ? `Año ${data.tax.commercial_year}` : ''),
      metric('Registro UAF', Object.keys(uaf).length || Object.keys(data.recon).length ? 'Materializado' : '—', text(uaf.registry_class || data.recon.uaf_sector_label, '')),
      metric('Sanciones', sanctions != null ? fmt(sanctions) : '—', sanctions > 0 ? 'evento(s) materializados' : '', sanctions > 0 ? 'critical' : ''),
      metric('Compras públicas', data.spend.order_count != null ? fmt(data.spend.order_count) : '—', data.spend.order_count != null ? 'órdenes materializadas' : ''),
    ]);
  }

  function taxCard(data) {
    const tax = data.tax || {};
    if (!Object.keys(tax).length) return card('Ficha tributaria', 'SII', empty('Perfil tributario no materializado para esta identidad.'));
    return card('Ficha tributaria', 'SII', kv([
      ['Estado', text(tax.current_status)], ['Inicio de actividades', dateText(tax.activity_start_date || tax.first_activity_registration_date)],
      ['Término de giro', tax.termination_date ? dateText(tax.termination_date) : 'No materializado'], ['Tipo contribuyente', text(tax.taxpayer_type)],
      ['Sector económico', text(tax.economic_sector)], ['Región', text(tax.region || data.identity.region)], ['Comuna', text(tax.commune || data.identity.commune)],
      ['Domicilios observados', tax.address_count != null ? fmt(tax.address_count) : '—'],
    ]));
  }

  function activityCard(data) {
    const rows = activities(data);
    if (!rows.length) return card('Actividades económicas', 'SII · giros declarados', empty('Actividades SII no materializadas.'));
    return card('Actividades económicas', 'SII · giros declarados', node('div', { class: 'e36x-activities' }, rows.slice(0, 12).map(row => node('div', { class: row.principal ? 'principal' : '' }, [node('span', { text: row.code || '—' }), node('b', { text: row.name }), row.principal ? node('em', { text: 'Principal' }) : null]))));
  }

  function registersCard(data) {
    const uaf = data.dossier.uaf_profile || {};
    const osfl = data.dossier.osfl_profile || null;
    const res = data.dossier.res_profile || data.dossier.res_lifecycle || null;
    const sanctions = arr(data.dossier.sanction_resolution).length || num(data.dossier.sanction_summary?.procedure_count);
    const row = (label, present, detail) => node('div', { class: `e36x-register ${present ? 'present' : ''}` }, [node('i'), node('div', {}, [node('b', { text: label }), node('small', { text: detail })]), node('strong', { text: present ? 'Disponible' : '—' })]);
    return card('Registros integrados', 'Cobertura cruzada', node('div', { class: 'e36x-registers' }, [
      row('UAF', Object.keys(uaf).length > 0 || Object.keys(data.recon).length > 0, text(uaf.registry_class || data.recon.uaf_sector_label, 'Registro institucional')),
      row('OSFL', Boolean(osfl), text(osfl?.activity_group || osfl?.organization_type || osfl?.confirmation_level, 'Perfil OSFL')),
      row('RES', Boolean(res), res ? 'Registro de Empresas y Sociedades materializado' : 'No materializado'),
      row('Compras públicas', Object.keys(data.spend || {}).length > 0, Object.keys(data.spend || {}).length ? `${fmt(data.spend.order_count)} órdenes · ${money(data.spend.total_clp)}` : 'No materializado'),
      row('Sanciones', sanctions != null, sanctions != null ? `${fmt(sanctions)} evento(s)` : 'Resumen no materializado'),
    ]));
  }

  function timelineCard(data, screening, limit = 8) {
    const events = timeline(data, screening).slice(0, limit);
    if (!events.length) return card('Línea de tiempo', 'Hechos materializados', empty('No hay hitos cronológicos materializados.'), 'wide');
    return card('Línea de tiempo', 'Hechos materializados', node('div', { class: 'e36x-timeline' }, events.map(event => node('article', { class: event.tone }, [
      node('time', { text: dateText(event.date) }), node('i'), node('div', {}, [node('b', { text: event.title }), node('p', { text: event.detail }), node('small', { text: event.source }), event.url && /^https?:\/\//i.test(event.url) ? node('a', { href: event.url, target: '_blank', rel: 'noopener noreferrer', text: 'Fuente ↗' }) : null]),
    ]))));
  }

  function pressCard(data) {
    const rows = pressItems(data);
    if (!rows.length) return card('Prensa coincidente', 'Radar Prensa', empty('Sin coincidencias de prensa materializadas para esta identidad.'));
    return card('Prensa coincidente', 'Radar Prensa', node('div', { class: 'e36x-news' }, rows.slice(0, 6).map(item => node('article', {}, [
      node('div', {}, [node('time', { text: dateText(item.date) }), node('span', { text: item.media })]), node('b', { text: item.title }), item.summary ? node('p', { text: item.summary }) : null,
      item.url ? node('a', { href: item.url, target: '_blank', rel: 'noopener noreferrer', text: 'Abrir noticia ↗' }) : null,
    ]))));
  }

  function uafPanel(data, screening) {
    const uaf = data.dossier.uaf_profile || {};
    const reporting = data.reporting || {};
    const records = screeningRecords(screening);
    return node('div', { class: 'e36x-grid two' }, [
      card('Registro UAF', 'UAF', Object.keys(uaf).length || Object.keys(data.recon).length ? kv([
        ['Clase de registro', text(uaf.registry_class)], ['Sectores', arr(uaf.sector_names).join(' · ') || text(data.recon.uaf_sector_label)],
        ['Conciliación UAF ↔ SII', text(data.recon.reconciliation_label || data.recon.reconciliation_status)], ['Acción sugerida', text(data.recon.suggested_action)],
      ]) : empty('Registro UAF no materializado para esta identidad.')),
      card('Reportabilidad ROS / ROE', 'UAF', reporting.behavior_source_state === 'OBSERVED' ? kv([['ROS total', fmt(reporting.ros_total)], ['ROS 12m', fmt(reporting.ros_12m)], ['ROE total', fmt(reporting.roe_total)], ['ROE 12m', fmt(reporting.roe_12m)]]) : empty('Ausencia de dato ≠ cero ROS/ROE. No hay observación individual gobernada materializada.')),
      card('Screening internacional', 'Consulta live', screening?.status === 'ready' ? (records.length ? node('div', { class: 'e36x-screen-list' }, records.slice(0, 8).map(record => node('div', {}, [node('b', { text: text(record.name || record.caption || record.entity_name, record.code) }), node('span', { text: record.code }), node('strong', { text: percent01(record.match_confidence || record.score) == null ? '—' : `${Math.round(percent01(record.match_confidence || record.score))}%` })]))) : empty('Sin coincidencias técnicas observadas en esta ejecución.')) : empty('El screening live no respondió en esta ejecución.'), 'span2'),
    ]);
  }

  function sanctionsPanel(data) {
    const rows = arr(data.dossier.sanction_resolution);
    const sum = data.dossier.sanction_summary || {};
    return node('div', { class: 'e36x-grid two' }, [
      card('Resumen sancionatorio', 'Radar Sancionatorio', Object.keys(sum).length || rows.length ? kv([['Eventos', fmt(sum.procedure_count ?? rows.length)], ['Último evento', dateText(sum.latest_sanction_date)], ['Reguladores', arr(sum.regulators).join(' · ') || '—'], ['LA/FT directo', sum.laft_direct_count != null ? fmt(sum.laft_direct_count) : '—']]) : empty('Resumen sancionatorio no materializado.')),
      card('Eventos materializados', 'Radar Sancionatorio', rows.length ? node('div', { class: 'e36x-event-list' }, rows.slice(0, 20).map(item => node('article', {}, [node('div', {}, [node('b', { text: text(item.regulator, 'Supervisor') }), node('time', { text: dateText(item.source_event_date || item.event_date || item.date) })]), node('p', { text: text(item.reason || item.subject || item.source_entity_name || item.resolution_status, 'Antecedente materializado.') }), item.document_url && /^https?:\/\//i.test(item.document_url) ? node('a', { href: item.document_url, target: '_blank', rel: 'noopener noreferrer', text: 'Abrir documento ↗' }) : null]))) : empty('Eventos detallados no materializados.')),
    ]);
  }

  function spendPanel(data, api) {
    const spend = data.spend || {};
    return node('div', { class: 'e36x-grid two' }, [
      card('Compras públicas', 'ChileCompra', Object.keys(spend).length ? kv([['Órdenes', fmt(spend.order_count)], ['Compradores', fmt(spend.buyer_count)], ['Monto acumulado', money(spend.total_clp)], ['Trato directo', spend.direct_order_count != null ? fmt(spend.direct_order_count) : '—'], ['Primera orden', dateText(spend.first_order_date)], ['Última orden', dateText(spend.last_order_date)]]) : empty('Actividad como proveedor no materializada en esta vista.')),
      card('Profundización', 'Gasto público', node('div', { class: 'e36x-actionbox' }, [node('p', { text: 'La ficha mantiene el contexto ejecutivo. El módulo de Gasto público conserva el análisis detallado de compradores, pares y señales.' }), node('button', { type: 'button', text: 'Abrir Gasto público →', onclick: () => api.navigate('gasto-publico', data.identity.rut ? { rut: data.identity.rut } : {}) })])),
    ]);
  }

  function registryPanel(data) {
    const osfl = data.dossier.osfl_profile;
    const res = data.dossier.res_profile;
    const life = data.dossier.res_lifecycle;
    return node('div', { class: 'e36x-grid two' }, [
      card('Perfil OSFL', 'OSFL', osfl ? kv([['Grupo actividad', text(osfl.activity_group)], ['Confirmación', text(osfl.confirmation_level)], ['Fuente', text(osfl.source_name)], ['Ley 21.440', osfl.law21440_active ? 'Vigente/materializada' : '—'], ['Registro 19.862', osfl.registro19862 ? 'Materializado' : '—']]) : empty('Perfil OSFL no materializado para esta identidad.')),
      card('Registro RES', 'Empresa en un Día', res || life ? kv([['Constitución', dateText(res?.constitution_date || res?.res_constitution_date || life?.constitution_date)], ['Capital', res?.capital != null ? money(res.capital) : '—'], ['Comuna social', text(res?.social_commune)], ['Actuaciones', life?.actuation_count != null ? fmt(life.actuation_count) : '—'], ['Modificaciones', life?.modification_count != null ? fmt(life.modification_count) : '—'], ['Último cambio', dateText(life?.last_change_date)]]) : empty('Registro RES no materializado para esta identidad.')),
    ]);
  }

  function historyPanel(data, screening) {
    const history = arr(data.base.history).slice().sort((a, b) => Number(a.commercial_year || 0) - Number(b.commercial_year || 0));
    const chart = history.length && global.AtlasV2Viz ? global.AtlasV2Viz.lineChart(history.map(row => ({ label: row.commercial_year, value: num(row.sales_band_rank) || 0, display: row.sales_band_code || fmt(row.sales_band_rank) })), { ariaLabel: 'Trayectoria del tramo de ventas' }) : empty('Serie histórica SII no materializada.');
    return node('div', { class: 'e36x-grid history' }, [card('Trayectoria tributaria', 'SII histórico', chart), timelineCard(data, screening, 24)]);
  }

  function sourcesPanel(data, screening) {
    return node('div', { class: 'e36x-sources' }, sourcePresence(data, screening).map(([label, present]) => node('article', { class: present ? 'present' : '' }, [node('i'), node('span', { text: label }), node('b', { text: present ? 'Dato materializado' : 'No materializado' }), node('small', { text: present ? 'Disponible en el expediente gobernado.' : 'La ausencia no se interpreta como cero ni inexistencia.' })])));
  }

  function renderExpediente(container, data, screening, api, query) {
    clear(container);
    container.dataset.entity360Authority = VERSION;
    const root = node('div', { class: 'e36x', 'data-authority': VERSION });
    const tabs = [
      ['resumen', 'Resumen'], ['tributario', 'Tributario'], ['uaf', 'UAF'], ['sanciones', 'Sanciones'],
      ['compras', 'Compras públicas'], ['registros', 'OSFL / RES'], ['historico', 'Histórico'], ['fuentes', 'Fuentes'],
    ];
    const nav = node('nav', { class: 'e36x-tabs', 'aria-label': 'Secciones del expediente' });
    const panels = node('div', { class: 'e36x-panels' });
    const panelMap = new Map();
    const addPanel = (id, content) => { const p = node('section', { class: 'e36x-panel', 'data-panel': id }); if (id !== 'resumen') p.hidden = true; p.append(content); panelMap.set(id, p); panels.append(p); };
    tabs.forEach(([id, label], index) => {
      const button = node('button', { type: 'button', text: label, 'aria-selected': index === 0 ? 'true' : 'false', onclick: () => {
        nav.querySelectorAll('button').forEach(btn => btn.setAttribute('aria-selected', btn === button ? 'true' : 'false'));
        panelMap.forEach((panelNode, key) => { panelNode.hidden = key !== id; });
      } });
      nav.append(button);
    });
    addPanel('resumen', node('div', { class: 'e36x-summary' }, [kpis(data), node('div', { class: 'e36x-grid top' }, [taxCard(data), activityCard(data), registersCard(data)]), node('div', { class: 'e36x-grid main' }, [timelineCard(data, screening, 8), pressCard(data)])]));
    addPanel('tributario', node('div', { class: 'e36x-grid two' }, [taxCard(data), activityCard(data), card('Ventas y dotación', 'SII', kv([['Ventas anuales', salesLabel(data.tax)], ['Trabajadores', data.tax.workers_numeric != null ? fmt(data.tax.workers_numeric) : '—'], ['Año comercial', text(data.tax.commercial_year)], ['Giros / actividades', data.tax.activity_count != null ? fmt(data.tax.activity_count) : fmt(activities(data).length)]]))]));
    addPanel('uaf', uafPanel(data, screening));
    addPanel('sanciones', sanctionsPanel(data));
    addPanel('compras', spendPanel(data, api));
    addPanel('registros', registryPanel(data));
    addPanel('historico', historyPanel(data, screening));
    addPanel('fuentes', sourcesPanel(data, screening));
    root.append(hero(data, screening, api, query), nav, panels, node('footer', { class: 'e36x-foot', text: 'Hecho observado ≠ conclusión. Dato no materializado ≠ cero o inexistencia. Una sanción administrativa o una coincidencia de screening no acredita delito ni LA/FT. El bloque de relaciones permanece fuera de esta vista hasta contar con resolución de identidad suficientemente confiable.' }));
    container.append(root);
  }

  async function load(container, route, api, serial) {
    const entityId = route.params.get('entity_id') || '';
    const rut = canonicalRut(route.params.get('rut') || '');
    const query = route.params.get('q') || '';
    const reference = { entityId, rut, name: query };
    clear(container);
    container.append(node('div', { class: 'e36x-loading', text: 'Construyendo expediente 360…' }));
    const [core, intelligence] = await Promise.all([
      global.AtlasV2Entity360.readCore(reference, { timeoutMs: 12000 }),
      global.AtlasV2Entity360.readIntelligence(reference, { timeoutMs: 18000 }),
    ]);
    if (serial !== renderSerial) return;
    if (core?.status !== 'ready' || intelligence?.status !== 'ready') {
      clear(container);
      container.append(node('div', { class: 'e36x-error' }, [node('strong', { text: 'No fue posible abrir el expediente' }), node('p', { text: core?.message || intelligence?.message || 'La lectura gobernada no respondió.' }), node('button', { type: 'button', text: 'Volver a Entidades', onclick: () => api.navigate('entidad', query ? { q: query } : {}) })]));
      return;
    }
    const data = getData(core, intelligence);
    const resolved = { name: data.identity?.name || query, rut: data.identity?.rut || rut, entityType: data.identity?.entityType || '' };
    let screening = { status: 'unavailable', sources: {} };
    try { screening = await global.AtlasV2Entity360.readScreening(resolved, { timeoutMs: 30000 }); } catch (_error) { /* degradación explícita */ }
    if (serial !== renderSerial) return;
    renderExpediente(container, data, screening, api, query);
  }

  function render(container, route, api) {
    injectStyle();
    const selected = route.params.get('entity_id') || route.params.get('rut');
    if (!selected) {
      clear(container);
      container.append(node('div', { class: 'e36x-loading', text: 'Abriendo Explorador de Entidades…' }));
      return;
    }
    const serial = ++renderSerial;
    void load(container, route, api, serial);
  }

  function register() {
    if (!global.AtlasV2Shell?.registerSurface) return false;
    global.AtlasV2Shell.registerSurface('entidad', render);
    global.__ATLAS_V2_ENTITY360_EXPEDIENTE__ = Object.freeze({ installed: true, version: VERSION, route: 'entidad', mode: 'EXPEDIENTE_EXECUTIVE_V2', relationsVisible: false, identityPolicy: 'GOVERNED_ENTITY_ID_OR_CANONICAL_RUT', missingSemantic: 'MISSING_IS_NOT_ZERO_OR_ABSENCE' });
    return true;
  }

  if (!register()) global.addEventListener('atlas:v2-shell-ready', register, { once: true });
})(window);