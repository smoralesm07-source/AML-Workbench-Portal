'use strict';

(function installAtlasV2SanctionsSurface(global) {
  if (global.__ATLAS_V2_SANCTIONS_SURFACE__) return;
  const scriptBase = new URL('./', document.currentScript?.src || document.baseURI);
  const NF = new Intl.NumberFormat('es-CL');
  const CLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
  const TYPE_COLORS = ['#ff8a1f', '#19c6df', '#7b78ff', '#f0618f', '#79d59c', '#8fa3b5', '#e3b341'];
  let renderSerial = 0;

  function node(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value == null || value === false) return;
      if (key === 'class') el.className = value;
      else if (key === 'text') el.textContent = String(value);
      else if (key === 'dataset') Object.entries(value).forEach(([name, entry]) => { el.dataset[name] = entry; });
      else if (key === 'style') el.style.cssText = String(value);
      else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
      else if (key === 'checked' || key === 'selected') el[key] = Boolean(value);
      else el.setAttribute(key, String(value));
    });
    (Array.isArray(children) ? children : [children]).forEach(child => {
      if (child == null || child === false) return;
      el.append(child instanceof Node ? child : document.createTextNode(String(child)));
    });
    return el;
  }
  function svgNode(tag, attrs = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, String(v)));
    return el;
  }
  function clear(el) { while (el?.firstChild) el.removeChild(el.firstChild); }
  function injectStyle() {
    if (document.getElementById('atlas-v2-sanctions-style')) return;
    const link = document.createElement('link');
    link.id = 'atlas-v2-sanctions-style'; link.rel = 'stylesheet';
    link.href = new URL('sanctions-surface.css?v=command-center-2', scriptBase).href;
    document.head.appendChild(link);
  }
  function count(v) { const n = Number(v); return Number.isFinite(n) ? NF.format(n) : '—'; }
  function pct(v) { const n = Number(v); return Number.isFinite(n) ? `${n.toLocaleString('es-CL', { maximumFractionDigits: 1 })}%` : '—'; }
  function amountCLP(v, compact = false) {
    const n = Number(v); if (!Number.isFinite(n) || n <= 0) return '—';
    if (compact && n >= 1e6) return `$ ${Number(n / 1e6).toLocaleString('es-CL', { maximumFractionDigits: 1 })} MM`;
    return CLP.format(Math.round(n));
  }
  function amountUF(v) { const n = Number(v); return Number.isFinite(n) && n > 0 ? `${n.toLocaleString('es-CL', { maximumFractionDigits: 1 })} UF` : '—'; }
  function date(v, long = false) {
    if (!v) return 'Sin fecha'; const d = new Date(v); if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleDateString('es-CL', long ? { year: 'numeric', month: 'short', day: '2-digit' } : { year: 'numeric', month: '2-digit', day: '2-digit' });
  }
  function stateFrom(route) {
    return {
      q: route.params.get('q') || '', universe: (route.params.get('universe') || '').toUpperCase(),
      regulator: (route.params.get('regulator') || '').toUpperCase(), region: route.params.get('region') || '',
      event_kind: route.params.get('event_kind') || '', year: route.params.get('year') || '',
      amount_band: (route.params.get('amount_band') || '').toUpperCase(), event_class: (route.params.get('event_class') || '').toUpperCase(),
      offset: Math.max(0, Number(route.params.get('offset') || 0) || 0),
    };
  }
  function queryPayload(state) {
    return { q: state.q, search: state.q, universe: state.universe, regulator: state.regulator, region: state.region, event_kind: state.event_kind, year: state.year, amount_band: state.amount_band, event_class: state.event_class };
  }
  function nav(api, state, patch = {}) { api.navigate('sanciones', { ...state, ...patch }); }
  function loading(text = 'Cargando inteligencia sancionatoria…') {
    return node('div', { class: 'san-loading' }, [node('span', { class: 'san-spinner', 'aria-hidden': 'true' }), node('strong', { text })]);
  }
  function errorBox(error) {
    return node('div', { class: 'san-error' }, [node('strong', { text: 'No fue posible cargar Sanciones.' }), node('span', { text: String(error?.message || error || 'Error no identificado') }), error?.traceId ? node('small', { text: `Traza ${error.traceId}` }) : null]);
  }
  function icon(text, tone = '') { return node('span', { class: `san-icon ${tone}`, text, 'aria-hidden': 'true' }); }
  function panelTitle(title, subtitle, action) {
    return node('div', { class: 'san-panel-head' }, [node('div', {}, [node('h2', { text: title }), subtitle ? node('p', { text: subtitle }) : null]), action || null]);
  }
  function priority(score) {
    const n = Number(score || 0); if (n >= 70) return ['Alta', 'high']; if (n >= 45) return ['Media', 'medium']; return ['Contextual', 'low'];
  }
  function universeLabel(item) {
    const memberships = [];
    if (item.in_uaf_registry) memberships.push('UAF');
    if (item.in_sii_registry) memberships.push('SII');
    if (item.in_osfl_registry) memberships.push('OSFL');
    return memberships.join(' · ') || 'Fuera de padrón consolidado';
  }

  function filterSelect(label, value, options, onChange) {
    const select = node('select', { 'aria-label': label, onchange: e => onChange(e.target.value) }, [
      node('option', { value: '', text: label === 'Región' ? 'Todas' : 'Todos' }),
      ...options.map(item => typeof item === 'string' ? node('option', { value: item, text: item }) : node('option', { value: item.value, text: item.label })),
    ]);
    select.value = value;
    return node('label', { class: 'san-filter' }, [node('span', { text: label }), select]);
  }

  function filterBar(api, state, dashboard) {
    const opts = dashboard.filters || {};
    const search = node('input', { type: 'search', value: state.q, placeholder: 'Buscar por RUT, entidad, motivo o resolución…', 'aria-label': 'Buscar sanciones' });
    const submitSearch = () => nav(api, state, { q: search.value.trim(), offset: 0 });
    search.addEventListener('keydown', e => { if (e.key === 'Enter') submitSearch(); });
    const reset = () => api.navigate('sanciones');
    return node('section', { class: 'san-filterbar' }, [
      filterSelect('Universo', state.universe, ['UAF', 'SII', 'OSFL'], v => nav(api, state, { universe: v, offset: 0 })),
      filterSelect('Supervisor', state.regulator, opts.regulators || [], v => nav(api, state, { regulator: v, offset: 0 })),
      filterSelect('Región', state.region, opts.regions || [], v => nav(api, state, { region: v, offset: 0 })),
      filterSelect('Tipo de sanción', state.event_kind, (opts.types || []).map(v => ({ value: v, label: v.length > 34 ? `${v.slice(0, 31)}…` : v })), v => nav(api, state, { event_kind: v, offset: 0 })),
      filterSelect('Año', state.year, (opts.years || []).map(v => String(v)), v => nav(api, state, { year: v, offset: 0 })),
      filterSelect('Monto multa', state.amount_band, [{ value: 'CLP', label: 'Con monto CLP' }, { value: 'UF', label: 'Con monto UF' }, { value: 'NO_AMOUNT', label: 'Sin monto publicado' }], v => nav(api, state, { amount_band: v, offset: 0 })),
      node('div', { class: 'san-filter-search' }, [search, node('button', { type: 'button', class: 'san-search-button', text: 'Buscar', onclick: submitSearch })]),
      node('button', { type: 'button', class: 'san-reset', text: 'Limpiar', onclick: reset }),
    ]);
  }

  function kpi(label, value, detail, glyph, tone = '') {
    return node('article', { class: 'san-kpi' }, [icon(glyph, tone), node('div', {}, [node('small', { text: label }), node('strong', { text: value }), node('span', { text: detail })])]);
  }

  function kpiStrip(m) {
    const totalAmounts = [amountCLP(m.amount_clp, true) !== '—' ? `${amountCLP(m.amount_clp, true)} CLP` : '', amountUF(m.amount_uf) !== '—' ? amountUF(m.amount_uf) : ''].filter(Boolean).join(' · ') || 'Sin monto agregado';
    return node('div', { class: 'san-kpis' }, [
      kpi('Entidades evaluadas', count(m.unified_universe_count), 'Universo SII + UAF + OSFL deduplicado', '▤', 'cyan'),
      kpi('Entidades sancionadas', count(m.entity_count), m.unified_universe_count ? `${pct(Number(m.entity_count || 0) / Number(m.unified_universe_count) * 100)} del universo` : 'Identidad resuelta', '◎', 'orange'),
      kpi('Eventos sancionatorios', count(m.event_count), `${count(m.regulatory_event_count)} regulatorios · ${count(m.cgr_event_count)} CGR`, '⚖', 'cyan'),
      kpi('Monto total multas', totalAmounts, 'UF y CLP se mantienen separados', '◉', 'orange'),
      kpi('Supervisores activos', count(m.supervisor_count), 'CMF · UAF · SCJ · CGR', '✦', 'cyan'),
    ]);
  }

  function universeCards(api, state, rows) {
    return node('section', { class: 'san-panel san-universes' }, [
      panelTitle('Universos analizados', 'Membresías superpuestas: no deben sumarse entre sí.'),
      node('div', { class: 'san-universe-grid' }, (rows || []).map(row => {
        const ratio = Number(row.evaluated_count) ? Number(row.entity_count || 0) / Number(row.evaluated_count) * 100 : 0;
        return node('button', { type: 'button', class: `san-universe ${state.universe === row.code ? 'active' : ''}`, onclick: () => nav(api, state, { universe: state.universe === row.code ? '' : row.code, offset: 0 }) }, [
          node('div', { class: 'san-universe-title' }, [icon(row.code === 'OSFL' ? '◇' : row.code === 'UAF' ? '◉' : '▦', row.code === 'OSFL' ? 'orange' : 'cyan'), node('strong', { text: row.code })]),
          node('strong', { class: 'san-universe-total', text: count(row.evaluated_count) }), node('span', { text: 'evaluadas' }),
          node('div', { class: 'san-universe-foot' }, [node('strong', { text: `${count(row.entity_count)} sancionadas` }), node('span', { text: pct(ratio) })]),
          node('div', { class: 'san-mini-track' }, node('span', { style: `width:${Math.max(1, Math.min(100, ratio))}%` })),
        ]);
      }))
    ]);
  }

  function supervisorChart(api, state, rows) {
    const data = rows || []; const max = Math.max(1, ...data.map(r => Number(r.event_count || 0)));
    return node('section', { class: 'san-panel san-supervisors' }, [
      panelTitle('Sanciones por supervisor', 'Naranja: sanción regulatoria · Cian: acciones CGR / enforcement'),
      node('div', { class: 'san-supervisor-chart' }, data.map(r => {
        const regulatory = Number(r.regulatory_event_count || 0), cgr = Number(r.cgr_event_count || 0), total = Number(r.event_count || 0);
        const height = Math.max(8, total / max * 100); const regShare = total ? regulatory / total * 100 : 0;
        return node('button', { type: 'button', class: `san-supervisor-column ${state.regulator === r.regulator ? 'active' : ''}`, onclick: () => nav(api, state, { regulator: state.regulator === r.regulator ? '' : r.regulator, offset: 0 }) }, [
          node('strong', { text: count(total) }),
          node('div', { class: 'san-stack', style: `height:${height}%` }, [
            regulatory ? node('span', { class: 'regulatory', style: `height:${regShare}%`, title: `${count(regulatory)} sanciones regulatorias` }) : null,
            cgr ? node('span', { class: 'cgr', style: `height:${100 - regShare}%`, title: `${count(cgr)} acciones CGR` }) : null,
          ]),
          node('span', { text: r.regulator || 'S/F' }),
        ]);
      }))
    ]);
  }

  function chileRibbon(regions) {
    const top = (regions || []).filter(r => r.region !== 'Sin región informada').slice(0, 16); const max = Math.max(1, ...top.map(r => Number(r.event_count || 0)));
    return node('div', { class: 'san-chile' }, top.map((r, i) => {
      const intensity = Math.max(.15, Number(r.event_count || 0) / max);
      return node('span', { class: 'san-chile-segment', style: `--i:${intensity};margin-left:${[18,11,23,8,19,14,27,10,22,16,28,13,20,25,17,29][i] || 15}px`, title: `${r.region}: ${count(r.event_count)}` });
    }));
  }

  function regionPanel(api, state, rows) {
    const data = (rows || []).filter(r => r.region !== 'Sin región informada').slice(0, 10); const max = Math.max(1, ...data.map(r => Number(r.event_count || 0)));
    return node('section', { class: 'san-panel san-regions' }, [
      panelTitle('Sanciones por región', 'Concentración territorial de eventos con base geográfica informada.'),
      node('div', { class: 'san-region-layout' }, [
        node('div', { class: 'san-region-list' }, data.map((r, i) => node('button', { type: 'button', class: state.region === r.region ? 'active' : '', onclick: () => nav(api, state, { region: state.region === r.region ? '' : r.region, offset: 0 }) }, [node('b', { text: String(i + 1) }), node('span', { text: r.region }), node('i', {}, node('em', { style: `width:${Math.max(2, Number(r.event_count || 0) / max * 100)}%` })), node('strong', { text: count(r.event_count) })]))),
        chileRibbon(rows),
      ])
    ]);
  }

  function typeDonut(api, state, rows) {
    const top = (rows || []).slice(0, 6); const total = top.reduce((s, r) => s + Number(r.event_count || 0), 0) || 1;
    let acc = 0; const parts = top.map((r, i) => { const start = acc; acc += Number(r.event_count || 0) / total * 100; return `${TYPE_COLORS[i % TYPE_COLORS.length]} ${start}% ${acc}%`; });
    return node('section', { class: 'san-panel san-types' }, [
      panelTitle('Sanciones por tipo', 'Tipología observada en las fuentes públicas.'),
      node('div', { class: 'san-type-layout' }, [
        node('button', { type: 'button', class: 'san-donut', style: `background:conic-gradient(${parts.join(',')})`, title: 'Filtrar desde la leyenda' }, node('span', {}, [node('strong', { text: count(total) }), node('small', { text: 'eventos' })])),
        node('div', { class: 'san-type-legend' }, top.map((r, i) => node('button', { type: 'button', class: state.event_kind === r.event_kind ? 'active' : '', onclick: () => nav(api, state, { event_kind: state.event_kind === r.event_kind ? '' : r.event_kind, offset: 0 }) }, [node('i', { style: `background:${TYPE_COLORS[i % TYPE_COLORS.length]}` }), node('span', { text: r.event_kind }), node('strong', { text: count(r.event_count) })]))),
      ])
    ]);
  }

  function evolutionChart(api, state, rows) {
    const data = rows || []; const width = 520, height = 210, pad = 28; const max = Math.max(1, ...data.map(r => Number(r.event_count || 0))); const innerW = width - pad * 2, innerH = height - 54;
    const svg = svgNode('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': 'Evolución anual de sanciones' });
    const points = [];
    data.forEach((r, i) => {
      const x = pad + (data.length <= 1 ? innerW / 2 : i * innerW / (data.length - 1)); const barW = Math.max(8, innerW / Math.max(12, data.length) * .58); const y = 12 + innerH - Number(r.event_count || 0) / max * innerH;
      const rect = svgNode('rect', { x: x - barW / 2, y, width: barW, height: 12 + innerH - y, rx: 3, class: 'san-year-bar' }); rect.addEventListener('click', () => nav(api, state, { year: state.year === String(r.event_year) ? '' : String(r.event_year), offset: 0 })); svg.append(rect);
      const entitiesY = 12 + innerH - Number(r.entity_count || 0) / max * innerH; points.push(`${x},${entitiesY}`);
      const label = svgNode('text', { x, y: height - 13, 'text-anchor': 'middle', class: 'san-chart-label' }); label.textContent = String(r.event_year || ''); svg.append(label);
    });
    if (points.length > 1) svg.append(svgNode('polyline', { points: points.join(' '), fill: 'none', class: 'san-year-line' }));
    points.forEach(p => { const [cx, cy] = p.split(','); svg.append(svgNode('circle', { cx, cy, r: 4, class: 'san-year-point' })); });
    return node('section', { class: 'san-panel san-evolution' }, [panelTitle('Evolución de sanciones', 'Barras: eventos · línea: entidades identificadas'), svg]);
  }

  function eventRow(item, selectEvent) {
    const [pLabel, pClass] = priority(item.priority_score); const amount = Number(item.amount_clp) > 0 ? amountCLP(item.amount_clp, true) : Number(item.amount_uf) > 0 ? amountUF(item.amount_uf) : '—';
    return node('button', { type: 'button', class: 'san-event', onclick: () => selectEvent(item) }, [
      node('span', { class: 'san-cell entity' }, [node('strong', { text: item.canonical_name || item.source_entity_name || 'Entidad no resuelta' }), node('small', { text: item.rut || item.identity_status || 'Sin RUT' })]),
      node('span', { class: 'san-cell', text: universeLabel(item) }), node('span', { class: 'san-cell', text: item.regulator || '—' }), node('span', { class: 'san-cell', text: item.region || 'Sin región' }),
      node('span', { class: 'san-cell type', text: item.event_kind || item.event_class || 'Sin clasificación' }), node('span', { class: 'san-cell', text: amount }), node('span', { class: 'san-cell', text: date(item.event_date) }),
      node('span', { class: `san-priority ${pClass}` }, [node('i'), node('b', { text: `${pLabel} ${count(item.priority_score)}` })]), node('span', { class: 'san-row-arrow', text: '›' }),
    ]);
  }

  function detailField(label, value) { return node('div', { class: 'san-detail-field' }, [node('span', { text: label }), node('strong', { text: value || '—' })]); }
  function detailPlaceholder() { return node('aside', { class: 'san-detail san-detail-empty' }, [icon('⚖', 'cyan'), node('h2', { text: 'Ficha de sanción' }), node('p', { text: 'Selecciona un evento de la tabla para revisar identidad, resolución, motivo, recurrencia y documento público.' })]); }

  async function loadDetail(host, api, item, serial) {
    clear(host); host.append(loading('Abriendo ficha…'));
    try {
      const out = await global.AtlasV2Sanctions.detail(item.event_id, { route: 'sanciones:detail' });
      if (serial !== renderSerial || !host.isConnected) return;
      const e = out.event || item, related = out.related_events || []; clear(host);
      const [pLabel, pClass] = priority(item.priority_score);
      host.append(node('aside', { class: 'san-detail' }, [
        node('div', { class: 'san-detail-head' }, [node('div', {}, [node('small', { text: e.event_id || 'EVENTO' }), node('h2', { text: 'Ficha de sanción' })]), node('span', { class: `san-priority ${pClass}` }, [node('i'), node('b', { text: `${pLabel} · prioridad analítica` })])]),
        node('div', { class: 'san-detail-entity' }, [icon('▦', 'cyan'), node('div', {}, [node('strong', { text: e.canonical_name || e.source_entity_name || 'Entidad no resuelta' }), node('span', { text: e.rut || e.identity_status || 'Sin RUT resuelto' })])]),
        node('div', { class: 'san-detail-grid' }, [detailField('Universo', universeLabel(e)), detailField('Supervisor', e.regulator), detailField('Región', e.region), detailField('Fecha', date(e.event_date, true)), detailField('Tipo', e.event_kind || e.event_class), detailField('Resolución', e.resolution_ref)]),
        node('section', { class: 'san-detail-block' }, [node('h3', { text: 'Monto informado' }), node('div', { class: 'san-amount-pair' }, [node('strong', { text: amountCLP(e.amount_clp) }), node('span', { text: 'CLP' }), node('strong', { text: amountUF(e.amount_uf) }), node('span', { text: 'UF' })]), node('small', { text: 'Las monedas permanecen separadas; Atlas no realiza conversión implícita.' })]),
        node('section', { class: 'san-detail-block' }, [node('h3', { text: 'Motivo / evidencia textual' }), node('p', { text: e.reason || e.document_excerpt || 'La fuente no publica un resumen textual adicional.' })]),
        e.event_class === 'CGR_ENFORCEMENT_ACTION' ? node('div', { class: 'san-cgr-note' }, [node('strong', { text: 'CGR · enforcement' }), node('span', { text: [e.cgr_stage, e.cgr_risk_family, e.cgr_severity].filter(Boolean).join(' · ') || 'Acción administrativa contextual' }), node('small', { text: 'No se interpreta automáticamente como sanción regulatoria firme.' })]) : null,
        node('section', { class: 'san-detail-block' }, [node('h3', { text: `Recurrencia observada · ${count(related.length)} eventos` }), node('div', { class: 'san-timeline' }, related.slice(0, 6).map(r => node('div', {}, [node('i'), node('time', { text: date(r.event_date) }), node('span', { text: `${r.regulator || ''} · ${r.event_kind || r.event_class || ''}` })]))) ]),
        node('section', { class: 'san-document' }, [node('h3', { text: 'Documento de la sanción' }), e.document_url ? node('a', { href: e.document_url, target: '_blank', rel: 'noopener noreferrer' }, [icon('↗', 'orange'), node('div', {}, [node('strong', { text: e.resolution_ref || 'Documento público' }), node('span', { text: e.document_quality || 'Evidencia pública registrada' })])]) : node('p', { text: 'Sin enlace documental publicado.' })]),
        e.rut ? node('button', { type: 'button', class: 'san-detail-cta', text: 'Abrir detalle en Entidad 360 →', onclick: () => api.navigate('entidad', { rut: e.rut }) }) : null,
        node('small', { class: 'san-guardrail', text: 'Prioridad analítica ≠ probabilidad LA/FT. Una sanción administrativa no equivale por sí sola a evidencia LA/FT.' }),
      ]));
    } catch (error) { if (serial === renderSerial && host.isConnected) { clear(host); host.append(errorBox(error)); } }
  }

  function eventsPanel(api, state, out, detailHost, serial) {
    const items = out.items || [], page = out.page || {}; const header = node('div', { class: 'san-table-head' }, [node('span', { text: 'Entidad / RUT' }), node('span', { text: 'Universo' }), node('span', { text: 'Supervisor' }), node('span', { text: 'Región' }), node('span', { text: 'Tipo de sanción' }), node('span', { text: 'Monto' }), node('span', { text: 'Fecha' }), node('span', { text: 'Prioridad' }), node('span')]);
    const selectEvent = item => loadDetail(detailHost, api, item, serial);
    const panel = node('section', { class: 'san-panel san-events' }, [
      panelTitle(`Casos prioritarios · ${count(page.total)}`, 'Orden explicable para revisión: recurrencia, condición UAF/OSFL, monto, evidencia e identidad.'), header,
      node('div', { class: 'san-event-rows' }, items.length ? items.map(i => eventRow(i, selectEvent)) : [node('div', { class: 'san-empty', text: 'Sin eventos para los filtros seleccionados.' })]),
      node('div', { class: 'san-pager' }, [node('span', { text: page.total ? `${count(Number(page.offset || 0) + 1)}–${count(Math.min(Number(page.total), Number(page.offset || 0) + Number(page.limit || 20)))} de ${count(page.total)}` : '0 resultados' }), node('div', {}, [node('button', { type: 'button', disabled: Number(page.offset || 0) <= 0 ? 'disabled' : null, text: '← Anterior', onclick: () => nav(api, state, { offset: Math.max(0, Number(page.offset || 0) - Number(page.limit || 20)) }) }), node('button', { type: 'button', disabled: Number(page.offset || 0) + Number(page.limit || 20) >= Number(page.total || 0) ? 'disabled' : null, text: 'Siguiente →', onclick: () => nav(api, state, { offset: Number(page.offset || 0) + Number(page.limit || 20) }) })])]),
    ]);
    if (items[0]) setTimeout(() => { if (serial === renderSerial && detailHost.isConnected) loadDetail(detailHost, api, items[0], serial); }, 0);
    return panel;
  }

  async function render(root, route, api) {
    injectStyle(); const serial = ++renderSerial; const state = stateFrom(route); clear(root);
    const page = node('div', { class: 'atlas-v2-sanctions san-command-center' }); root.append(page);
    const splash = loading('Construyendo monitor de sanciones…'); page.append(splash);
    try {
      const payload = queryPayload(state);
      const [dashboard, events] = await Promise.all([
        global.AtlasV2Sanctions.dashboard(payload, { route: 'sanciones:dashboard' }),
        global.AtlasV2Sanctions.events({ ...payload, limit: 12, offset: state.offset }, { route: 'sanciones:events' }),
      ]);
      if (serial !== renderSerial || !page.isConnected) return;
      clear(page);
      const m = dashboard.metrics || {};
      page.append(node('header', { class: 'san-command-head' }, [
        node('div', {}, [node('div', { class: 'atlas-v2-eyebrow', text: 'RADAR SANCIONATORIO · V2' }), node('h1', { text: 'Sanciones' }), node('p', { text: 'Monitoreo consolidado de sanciones sobre universos UAF, SII y OSFL.' })]),
        node('div', { class: 'san-freshness' }, [node('span', { text: 'Última actualización' }), node('strong', { text: date(dashboard.snapshot_id, true) }), node('small', { text: `${count(m.document_count)} eventos con documento público` })]),
      ]));
      page.append(filterBar(api, state, dashboard), kpiStrip(m));
      const top = node('div', { class: 'san-top-grid' }, [universeCards(api, state, dashboard.universes), supervisorChart(api, state, dashboard.supervisors)]); page.append(top);
      page.append(node('div', { class: 'san-analytics-grid' }, [regionPanel(api, state, dashboard.regions), typeDonut(api, state, dashboard.types), evolutionChart(api, state, dashboard.years)]));
      const workspace = node('div', { class: 'san-workspace' }); const detailHost = node('div', { class: 'san-detail-host' }, detailPlaceholder());
      workspace.append(eventsPanel(api, state, events, detailHost, serial), detailHost); page.append(workspace);
      page.append(node('div', { class: 'san-method-note' }, [node('strong', { text: 'Lectura metodológica. ' }), node('span', { text: `${dashboard.semantics?.regulatory || ''} ${dashboard.semantics?.cgr || ''} ${dashboard.semantics?.currency || ''}`.trim() })]));
    } catch (error) { if (serial === renderSerial && page.isConnected) { clear(page); page.append(errorBox(error)); } }
  }

  function register() {
    const api = global.AtlasV2Shell; if (!api?.registerSurface) return false;
    api.registerSurface('sanciones', render);
    global.__ATLAS_V2_SANCTIONS_SURFACE__ = Object.freeze({ installed: true, schema: 'SANCTIONS_COMMAND_CENTER_V2', source: 'AtlasV2Sanctions', supervisors: ['CMF', 'UAF', 'SCJ', 'CGR'], drilldown: 'Entidad 360', semantics: 'CGR separated from regulatory sanctions' });
    return true;
  }
  if (!register()) global.addEventListener('atlas:v2-shell-ready', register, { once: true });
})(window);