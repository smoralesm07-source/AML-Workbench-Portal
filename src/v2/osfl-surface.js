'use strict';

(function installAtlasV2OsflSurface(global) {
  if (global.__ATLAS_V2_OSFL_SURFACE__) return;

  const scriptBase = new URL('./', document.currentScript?.src || document.baseURI);
  const NF = new Intl.NumberFormat('es-CL');
  const CLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
  const DONUT_COLORS = ['#ff891d', '#18d3df', '#4b93ff', '#7b78ff', '#55d49d', '#e4b441', '#8fa3b5', '#f0618f'];
  const PAGE_SIZE = 10;
  let renderSerial = 0;
  let detailSerial = 0;

  function node(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value == null || value === false) return;
      if (key === 'class') el.className = value;
      else if (key === 'text') el.textContent = String(value);
      else if (key === 'style') el.style.cssText = String(value);
      else if (key === 'dataset') Object.entries(value).forEach(([name, entry]) => { el.dataset[name] = String(entry); });
      else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
      else if (key === 'checked' || key === 'selected' || key === 'disabled') el[key] = Boolean(value);
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
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, String(value)));
    return el;
  }

  function clear(el) { while (el?.firstChild) el.removeChild(el.firstChild); }

  function injectStyle() {
    if (document.getElementById('atlas-v2-osfl-style')) return;
    const link = document.createElement('link');
    link.id = 'atlas-v2-osfl-style';
    link.rel = 'stylesheet';
    link.href = new URL('osfl-surface.css?v=panorama-4', scriptBase).href;
    document.head.appendChild(link);
  }

  function count(value) {
    const n = Number(value);
    return Number.isFinite(n) ? NF.format(n) : '—';
  }

  function pct(value) {
    const n = Number(value);
    return Number.isFinite(n) ? `${n.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` : '—';
  }

  function share(value, total) {
    const n = Number(value), d = Number(total);
    return Number.isFinite(n) && d > 0 ? pct(n / d * 100) : '0,0%';
  }

  function compact(value) {
    const n = Number(value);
    return Number.isFinite(n) ? new Intl.NumberFormat('es-CL', { notation: 'compact', maximumFractionDigits: 1 }).format(n) : '—';
  }

  function money(value) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? CLP.format(Math.round(n)) : '—';
  }

  function date(value, withTime = false) {
    if (!value) return '—';
    const text = String(value);
    const d = new Date(text.length === 10 ? `${text}T12:00:00` : text);
    if (Number.isNaN(d.getTime())) return text;
    return withTime
      ? d.toLocaleString('es-CL', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString('es-CL', { year: 'numeric', month: 'short', day: '2-digit' });
  }

  function titleCase(value) {
    return String(value || '').toLocaleLowerCase('es-CL').replace(/(^|[\s(/-])([a-záéíóúñ])/g, (_, prefix, letter) => prefix + letter.toLocaleUpperCase('es-CL'));
  }

  function shortRegion(value) {
    if (!value) return 'Sin región';
    return String(value)
      .replace('Metropolitana de Santiago', 'Metropolitana')
      .replace('Libertador Gral. Bernardo O’Higgins', "O'Higgins")
      .replace("Libertador Gral. Bernardo O'Higgins", "O'Higgins")
      .replace('Aysén del General Carlos Ibáñez del Campo', 'Aysén')
      .replace('Magallanes y de la Antártica Chilena', 'Magallanes');
  }

  function stateFrom(route) {
    return {
      q: route.params.get('q') || '',
      region: route.params.get('region') || '',
      type: route.params.get('type') || '',
      activity: route.params.get('activity') || '',
      source: (route.params.get('source') || '').toUpperCase(),
      uaf: (route.params.get('uaf') || 'TODAS').toUpperCase(),
      public_funds: (route.params.get('public_funds') || 'TODOS').toUpperCase(),
      sanctions: (route.params.get('sanctions') || 'TODAS').toUpperCase(),
      offset: Math.max(0, Number(route.params.get('offset') || 0) || 0),
    };
  }

  function nav(api, state, patch = {}) {
    const next = { ...state, ...patch };
    if (next.uaf === 'TODAS') delete next.uaf;
    if (next.public_funds === 'TODOS') delete next.public_funds;
    if (next.sanctions === 'TODAS') delete next.sanctions;
    if (!next.offset) delete next.offset;
    api.navigate('osfl', next);
  }

  function reset(api) { api.navigate('osfl'); }

  function loading(text = 'Cargando universo OSFL…') {
    return node('div', { class: 'osfl-loading' }, [node('span', { class: 'osfl-spinner', 'aria-hidden': 'true' }), node('strong', { text })]);
  }

  function errorBox(error, retry) {
    return node('div', { class: 'osfl-error' }, [
      node('div', {}, [node('strong', { text: 'No fue posible cargar OSFL.' }), node('span', { text: String(error?.message || error || 'Error no identificado') })]),
      error?.traceId ? node('small', { text: `Traza ${error.traceId}` }) : null,
      retry ? node('button', { type: 'button', text: 'Reintentar', onclick: retry }) : null,
    ]);
  }

  function icon(glyph, tone = 'cyan') { return node('span', { class: `osfl-icon ${tone}`, text: glyph, 'aria-hidden': 'true' }); }

  function section(index, title, subtitle, body) {
    return node('section', { class: 'osfl-section' }, [
      node('div', { class: 'osfl-section-head' }, [
        node('div', {}, [node('h2', {}, [node('span', { text: `${index}.` }), ` ${title}`]), node('p', { text: subtitle })]),
      ]),
      body,
    ]);
  }

  function kpi(label, value, detail, glyph, tone = 'cyan', onClick = null) {
    return node(onClick ? 'button' : 'article', {
      class: `osfl-kpi ${tone}`,
      type: onClick ? 'button' : null,
      onclick: onClick || null,
    }, [
      icon(glyph, tone),
      node('div', {}, [node('small', { text: label }), node('strong', { text: value }), node('span', { text: detail })]),
    ]);
  }

  function contextStrip(api, state, data) {
    const n = data.national || {};
    return node('div', { class: 'osfl-kpis' }, [
      kpi('Universo OSFL Chile', count(n.official_total), 'Registro Civil · universo nacional de referencia', '◇', 'orange', () => reset(api)),
      kpi('Atlas observado', count(n.observed), `Cobertura individualizada · ${pct(n.coverage_pct)}`, '▥', 'cyan', () => reset(api)),
      kpi('Conciliadas SII', count(n.sii_reconciled), `${count(n.sii_history)} con historia anual de ventas/trabajadores`, '▦', 'cyan', () => nav(api, state, { source: 'SII', offset: 0 })),
      kpi('Puente Ley 19.913', count(n.law19913_bridge), `${count(n.direct_uaf)} SO registrados · ${count(n.potential_uaf)} potenciales`, '◉', 'cyan', () => nav(api, state, { source: 'UAF', offset: 0 })),
      kpi('Registro 19.862', count(n.registro19862), `${share(n.registro19862, n.observed)} del universo observado`, '▤', 'cyan', () => nav(api, state, { source: '19862', offset: 0 })),
      kpi('OSFL con sanciones', count(n.sanctioned), 'Antecedentes sancionatorios publicados', '⚠', 'alert', () => nav(api, state, { sanctions: 'SI', offset: 0 })),
    ]);
  }

  function sourceTable(api, state, sources) {
    const mapCode = code => code === 'SANC' ? 'SANCIONES' : code;
    return node('div', { class: 'osfl-panel osfl-sources' }, [
      node('div', { class: 'osfl-panel-head' }, [node('div', {}, [node('h3', { text: 'Fuentes de información' }), node('p', { text: 'Rol analítico de cada fuente; Registro Civil se mantiene como referencia nacional mientras no exista carga individual completa.' })])]),
      node('div', { class: 'osfl-source-head' }, [node('span', { text: 'Fuente' }), node('span', { text: 'Aporte al análisis' }), node('span', { text: 'Volumen' })]),
      ...(sources || []).map(source => node('button', {
        type: 'button',
        class: `osfl-source-row ${source.code === 'RC' ? 'reference' : ''} ${state.source === mapCode(source.code) ? 'active' : ''}`,
        title: source.detail || '',
        onclick: () => source.code === 'RC' ? reset(api) : nav(api, state, { source: state.source === mapCode(source.code) ? '' : mapCode(source.code), offset: 0 }),
      }, [
        node('span', { class: `osfl-source-mark src-${String(source.code).toLowerCase()}`, text: source.code === '19862' ? '19' : String(source.code).slice(0, 3) }),
        node('strong', { text: source.label }),
        node('span', { class: 'osfl-source-role', text: source.role }),
        node('b', { text: count(source.volume) }),
      ])),
    ]);
  }

  function evolutionChart(points, officialTotal, note) {
    const data = (points || []).filter(item => Number.isFinite(Number(item.year)));
    const panel = node('div', { class: 'osfl-panel osfl-evolution', title: note || '' }, [
      node('div', { class: 'osfl-panel-head' }, [
        node('div', {}, [node('h3', { text: 'Evolución del universo OSFL' }), node('p', { text: 'Stock observable con fecha de inicio válida y nuevos inicios por año.' })]),
        node('div', { class: 'osfl-reference' }, [node('small', { text: 'Referencia nacional actual' }), node('strong', { text: count(officialTotal) })]),
      ]),
    ]);
    if (!data.length) {
      panel.append(node('div', { class: 'osfl-empty', text: 'Sin serie temporal disponible para el corte actual.' }));
      return panel;
    }

    const W = 760, H = 230, L = 50, R = 24, T = 30, B = 36;
    const stockMax = Math.max(1, ...data.map(item => Number(item.stock || 0)));
    const startsMax = Math.max(1, ...data.map(item => Number(item.starts || 0)));
    const x = index => L + index * ((W - L - R) / Math.max(1, data.length - 1));
    const yStock = value => T + (H - T - B) * (1 - Number(value || 0) / stockMax);
    const yStarts = value => T + (H - T - B) * (1 - Number(value || 0) / startsMax);
    const svg = svgNode('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Evolución anual del universo OSFL observado' });

    [0, .25, .5, .75, 1].forEach(ratio => {
      const yy = T + (H - T - B) * ratio;
      svg.append(svgNode('line', { x1: L, x2: W - R, y1: yy, y2: yy, class: 'osfl-gridline' }));
      const label = svgNode('text', { x: L - 7, y: yy + 4, 'text-anchor': 'end', class: 'osfl-axis' });
      label.textContent = compact(Math.round(stockMax * (1 - ratio)));
      svg.append(label);
    });

    data.forEach((item, index) => {
      const yy = yStarts(item.starts);
      const bar = svgNode('rect', { x: x(index) - 6, y: yy, width: 12, height: Math.max(1, H - B - yy), rx: 3, class: 'osfl-start-bar' });
      const tip = svgNode('title'); tip.textContent = `${item.year}: ${count(item.starts)} nuevos inicios`; bar.append(tip); svg.append(bar);
    });

    const path = svgNode('path', {
      d: data.map((item, index) => `${index ? 'L' : 'M'} ${x(index).toFixed(1)} ${yStock(item.stock).toFixed(1)}`).join(' '),
      class: 'osfl-stock-line',
    });
    svg.append(path);

    data.forEach((item, index) => {
      const dot = svgNode('circle', { cx: x(index), cy: yStock(item.stock), r: 4, class: 'osfl-stock-dot' });
      const tip = svgNode('title'); tip.textContent = `${item.year}: stock ${count(item.stock)} · ${count(item.starts)} inicios`; dot.append(tip); svg.append(dot);
      const label = svgNode('text', { x: x(index), y: H - 11, 'text-anchor': 'middle', class: 'osfl-axis' }); label.textContent = String(item.year); svg.append(label);
    });

    const last = data[data.length - 1];
    const lastText = svgNode('text', { x: Math.min(W - 55, x(data.length - 1)), y: Math.max(T + 14, yStock(last.stock) - 10), 'text-anchor': 'end', class: 'osfl-last-label' });
    lastText.textContent = count(last.stock); svg.append(lastText);

    panel.append(node('div', { class: 'osfl-legend' }, [node('span', { class: 'line' }), 'Stock observado', node('span', { class: 'bar' }), 'Nuevos inicios/año']), svg);
    return panel;
  }

  function typeDonut(api, state, rows, total, note) {
    const data = (rows || []).filter(item => Number(item.count || 0) > 0).slice(0, 8);
    const sum = data.reduce((acc, item) => acc + Number(item.count || 0), 0) || Number(total || 1);
    let cursor = 0;
    const stops = data.map((item, index) => {
      const start = cursor;
      cursor += Number(item.count || 0) / sum * 100;
      return `${DONUT_COLORS[index % DONUT_COLORS.length]} ${start}% ${cursor}%`;
    }).join(', ');
    return node('div', { class: 'osfl-panel osfl-character-card', title: note || '' }, [
      node('div', { class: 'osfl-panel-head' }, [node('div', {}, [node('h3', { text: 'Tipos de OSFL observadas' }), node('p', { text: 'Tipología disponible/inferida para el universo individualizado.' })])]),
      node('div', { class: 'osfl-donut-layout' }, [
        node('div', { class: 'osfl-donut', style: `background:conic-gradient(${stops || '#314550 0 100%'})` }, node('span', {}, [node('strong', { text: count(total) }), node('small', { text: 'OSFL' })])),
        node('div', { class: 'osfl-donut-legend' }, data.map((item, index) => node('button', {
          type: 'button',
          class: state.type === item.label ? 'active' : '',
          onclick: () => nav(api, state, { type: state.type === item.label ? '' : item.label, offset: 0 }),
        }, [node('i', { style: `background:${DONUT_COLORS[index % DONUT_COLORS.length]}` }), node('span', { text: item.label }), node('b', { text: count(item.count) }), node('small', { text: share(item.count, total) })]))),
      ]),
    ]);
  }

  function activityBars(api, state, rows, total) {
    const data = (rows || []).slice(0, 6);
    const max = Math.max(1, ...data.map(item => Number(item.count || 0)));
    return node('div', { class: 'osfl-panel osfl-character-card' }, [
      node('div', { class: 'osfl-panel-head' }, [node('div', {}, [node('h3', { text: 'Principales actividades económicas' }), node('p', { text: 'Actividad principal observable en SII; seleccionar una barra filtra el explorador.' })])]),
      node('div', { class: 'osfl-bars' }, data.map(item => node('button', {
        type: 'button',
        class: state.activity === item.label ? 'active' : '',
        title: item.label,
        onclick: () => nav(api, state, { activity: state.activity === item.label ? '' : item.label, offset: 0 }),
      }, [
        node('span', { text: titleCase(item.label) }),
        node('i', {}, node('b', { style: `width:${Math.max(2, Number(item.count || 0) / max * 100)}%` })),
        node('strong', { text: count(item.count) }),
        node('small', { text: share(item.count, total) }),
      ]))),
    ]);
  }

  function regionRanking(api, state, rows, total) {
    const data = (rows || []).filter(item => item.label !== 'Sin región observada').slice(0, 6);
    const max = Math.max(1, ...data.map(item => Number(item.count || 0)));
    return node('div', { class: 'osfl-panel osfl-character-card' }, [
      node('div', { class: 'osfl-panel-head' }, [node('div', {}, [node('h3', { text: 'Regiones con mayor presencia' }), node('p', { text: 'Distribución del universo observado; sin mapa para privilegiar espacio analítico.' })])]),
      node('div', { class: 'osfl-region-list' }, data.map((item, index) => node('button', {
        type: 'button',
        class: state.region === item.label ? 'active' : '',
        onclick: () => nav(api, state, { region: state.region === item.label ? '' : item.label, offset: 0 }),
      }, [
        node('b', { text: String(index + 1) }), node('span', { text: shortRegion(item.label) }), node('i', {}, node('em', { style: `width:${Math.max(2, Number(item.count || 0) / max * 100)}%` })), node('strong', { text: count(item.count) }), node('small', { text: share(item.count, total) }),
      ]))),
    ]);
  }

  function filterSelect(label, value, options, onChange, labels = {}) {
    const select = node('select', { 'aria-label': label, onchange: event => onChange(event.target.value) }, [
      node('option', { value: '', text: 'Todas' }),
      ...options.map(option => node('option', { value: option, text: labels[option] || titleCase(option) })),
    ]);
    select.value = value;
    return node('label', { class: 'osfl-filter' }, [node('span', { text: label }), select]);
  }

  function filterBar(api, state, dashboard) {
    const opts = dashboard.filters || {};
    const search = node('input', { type: 'search', value: state.q, placeholder: 'Buscar por nombre o RUT…', 'aria-label': 'Buscar OSFL' });
    const submit = () => nav(api, state, { q: search.value.trim(), offset: 0 });
    search.addEventListener('keydown', event => { if (event.key === 'Enter') submit(); });
    const directSelect = (label, value, options, patchKey, labels) => filterSelect(label, value, options, v => nav(api, state, { [patchKey]: v, offset: 0 }), labels);
    const uaf = node('select', { 'aria-label': 'Condición UAF', onchange: event => nav(api, state, { uaf: event.target.value, offset: 0 }) }, [
      node('option', { value: 'TODAS', text: 'Todas' }), node('option', { value: 'DIRECTA', text: 'SO registrado' }), node('option', { value: 'POTENCIAL', text: 'Potencial sujeto' }), node('option', { value: 'SIN_PUENTE', text: 'Sin puente 19.913' }),
    ]); uaf.value = state.uaf;
    const funds = node('select', { 'aria-label': 'Fondos públicos', onchange: event => nav(api, state, { public_funds: event.target.value, offset: 0 }) }, [
      node('option', { value: 'TODOS', text: 'Todos' }), node('option', { value: 'SI', text: 'Transferencia confirmada' }), node('option', { value: 'NO', text: 'Sin transferencia confirmada' }),
    ]); funds.value = state.public_funds;
    const sanctions = node('select', { 'aria-label': 'Sanciones', onchange: event => nav(api, state, { sanctions: event.target.value, offset: 0 }) }, [
      node('option', { value: 'TODAS', text: 'Todas' }), node('option', { value: 'SI', text: 'Con sanciones' }), node('option', { value: 'NO', text: 'Sin sanciones' }),
    ]); sanctions.value = state.sanctions;
    return node('div', { class: 'osfl-filterbar' }, [
      node('label', { class: 'osfl-filter osfl-search-filter' }, [node('span', { text: 'Entidad' }), node('div', { class: 'osfl-search-box' }, [search, node('button', { type: 'button', text: 'Buscar', onclick: submit })])]),
      directSelect('Región', state.region, opts.regions || [], 'region'),
      directSelect('Tipo OSFL', state.type, opts.types || [], 'type'),
      directSelect('Actividad SII', state.activity, opts.activities || [], 'activity'),
      directSelect('Fuente', state.source, ['SII', 'UAF', '19862', 'SANCIONES'], 'source', { '19862': 'Registro 19.862', SANCIONES: 'Sanciones' }),
      node('label', { class: 'osfl-filter' }, [node('span', { text: 'Condición UAF' }), uaf]),
      node('label', { class: 'osfl-filter' }, [node('span', { text: 'Fondos públicos' }), funds]),
      node('label', { class: 'osfl-filter' }, [node('span', { text: 'Sanciones' }), sanctions]),
      node('button', { class: 'osfl-reset', type: 'button', text: 'Limpiar', onclick: () => reset(api) }),
    ]);
  }

  function sourceBadges(sources = {}) {
    const defs = [
      ['SII', 'SII', 'cyan'], ['SII_HISTORY', 'Hist. SII', 'soft'], ['UAF', 'UAF', 'cyan'], ['POTENTIAL_UAF', 'UAF?', 'soft'], ['19862', '19.862', 'violet'], ['SANCIONES', 'SAN', 'alert'],
    ];
    const active = defs.filter(([key]) => Boolean(sources[key]));
    return node('div', { class: 'osfl-badges' }, active.length ? active.map(([key, label, tone]) => node('span', { class: tone, text: label, title: key === 'SII_HISTORY' ? 'Historia económica anual SII disponible' : '' })) : node('em', { text: 'Atlas' }));
  }

  function statusLabel(value) {
    if (value === 'ACTIVE_AS_PUBLISHED') return ['Activa', 'active'];
    if (value === 'TERMINATED_AS_PUBLISHED') return ['Término de giro', 'ended'];
    return ['Observada', 'neutral'];
  }

  function resultTable(rows, onSelect, selectedId) {
    const wrap = node('div', { class: 'osfl-table-wrap' });
    const table = node('table', { class: 'osfl-table' });
    table.append(node('thead', {}, node('tr', {}, ['Entidad', 'RUT', 'Tipo', 'Región', 'Actividad principal', 'Fuentes', 'Estado', ''].map(label => node('th', { text: label })))));
    const body = node('tbody');
    (rows || []).forEach(row => {
      const [label, tone] = statusLabel(row.status);
      const tr = node('tr', { class: row.entity_id === selectedId ? 'selected' : '', onclick: () => onSelect(row, tr) }, [
        node('td', { class: 'entity-name', text: row.name || 'Entidad sin nombre' }),
        node('td', { class: 'mono', text: row.rut || '—' }),
        node('td', { text: row.type || '—' }),
        node('td', { text: shortRegion(row.region) }),
        node('td', { class: 'activity', text: row.main_activity ? titleCase(row.main_activity) : 'Sin actividad detallada', title: row.main_activity || '' }),
        node('td', {}, sourceBadges(row.sources || {})),
        node('td', {}, node('span', { class: `osfl-status ${tone}`, text: label })),
        node('td', {}, node('button', { type: 'button', class: 'osfl-row-open', text: '›', 'aria-label': 'Caracterizar entidad', onclick: event => { event.stopPropagation(); onSelect(row, tr); } })),
      ]);
      body.append(tr);
    });
    if (!(rows || []).length) body.append(node('tr', {}, node('td', { class: 'osfl-empty', colspan: '8', text: 'No hay entidades para los filtros seleccionados.' })));
    table.append(body); wrap.append(table); return wrap;
  }

  function fact(label, value, wide = false, tone = '') {
    return node('div', { class: `osfl-fact ${wide ? 'wide' : ''} ${tone}` }, [node('span', { text: label }), node('strong', { text: value || '—' })]);
  }

  function timeline(events, note) {
    if (!(events || []).length) return node('div', { class: 'osfl-no-timeline' }, [icon('◷', 'cyan'), node('strong', { text: 'Sin hitos fechados suficientes' }), node('span', { text: note || 'La línea de tiempo sólo incorpora hechos con fecha verificable.' })]);
    return node('div', {}, [
      node('div', { class: 'osfl-timeline' }, events.map(event => node('div', { class: `osfl-timeline-event kind-${String(event.kind || 'hito').toLowerCase()}` }, [
        node('i'), node('time', { text: date(event.date) }), node('strong', { text: event.label || 'Hito' }), node('small', { text: [event.source, event.detail].filter(Boolean).join(' · ') }),
      ]))),
      node('p', { class: 'osfl-timeline-note', text: note || 'Sólo se muestran hitos con fecha disponible.' }),
    ]);
  }

  function backgroundRow(label, value, meta, alert = false) {
    return node('div', { class: `osfl-background-row ${alert ? 'alert' : ''}` }, [node('span', { text: label }), node('strong', { text: value }), meta ? node('small', { text: meta }) : null]);
  }

  function renderDetailBody(host, detail, tab) {
    clear(host);
    const entity = detail.entity || {};
    if (tab === 'timeline') {
      host.append(timeline(detail.timeline || [], detail.timeline_note));
    } else if (tab === 'economic') {
      const economic = detail.economic || {};
      host.append(node('div', { class: 'osfl-facts-grid' }, [
        fact('Inicio de actividades', date(entity.activity_start_date)),
        fact('Término de giro', date(entity.termination_date)),
        fact('Estado SII', statusLabel(entity.status)[0]),
        fact('Tramo de ventas', entity.sales_band || '—'),
        fact('Tamaño SII', entity.size_class || '—'),
        fact('Trabajadores', entity.workers == null ? '—' : count(entity.workers)),
        fact('Último año económico', economic.latest_year == null ? '—' : String(economic.latest_year)),
        fact('Escala operacional', economic.operational_scale || '—'),
        fact('Giros observados', economic.activity_names ? String(economic.activity_names).split('|').map(v => titleCase(v.trim())).join(' · ') : '—', true),
      ]));
    } else {
      const uaf = detail.uaf || {}, funds = detail.public_funds || {}, sanc = detail.sanctions || {}, sources = detail.sources || {};
      host.append(node('div', { class: 'osfl-background' }, [
        backgroundRow('Padrón SII', sources.SII ? 'Conciliada con SII' : 'Sin conciliación observada', sources.SII_HISTORY ? 'Historia anual económica disponible' : 'Sin historia anual disponible'),
        backgroundRow('Ley 19.913', uaf.label || 'Sin puente identificado', uaf.sector || ''),
        backgroundRow('Registro 19.862', sources.REGISTRO_19862 ? 'Presente' : 'Sin coincidencia observada'),
        backgroundRow('Fondos públicos', funds.confirmed ? `${count(funds.transfer_count)} transferencias confirmadas` : 'Sin transferencia confirmada', Number(funds.amount_clp || 0) > 0 ? money(funds.amount_clp) : ''),
        backgroundRow('Sanciones', Number(sanc.event_count || 0) ? `${count(sanc.event_count)} evento(s)` : 'Sin antecedentes observados', (sanc.regulators || []).join(' · '), Number(sanc.event_count || 0) > 0),
      ]));
    }
  }

  function quickPanel(detail, api) {
    const entity = detail.entity || {};
    const sources = detail.sources || {};
    const panel = node('aside', { class: 'osfl-detail-panel' });
    panel.append(node('div', { class: 'osfl-detail-head' }, [
      node('div', {}, [node('small', { text: 'Entidad seleccionada' }), node('h3', { text: entity.name || 'OSFL' }), node('p', { text: `RUT ${entity.rut || '—'} · ${entity.type || 'OSFL'} · ${shortRegion(entity.region)}` })]),
      entity.rut ? node('button', { type: 'button', text: '↗', title: 'Abrir Entidad 360', onclick: () => api.navigate('entidad', { rut: entity.rut }) }) : null,
    ]));
    panel.append(node('div', { class: 'osfl-detail-summary' }, [fact('Región', shortRegion(entity.region)), fact('Comuna', entity.commune || '—'), fact('Actividad principal', entity.main_activity ? titleCase(entity.main_activity) : 'Sin actividad detallada', true)]));
    panel.append(node('div', { class: 'osfl-detail-crosses' }, [
      node('div', { class: 'wide' }, [node('span', { text: 'Fuentes' }), sourceBadges({ SII: sources.SII, SII_HISTORY: sources.SII_HISTORY, UAF: sources.UAF_DIRECT, POTENTIAL_UAF: sources.UAF_POTENTIAL, '19862': sources.REGISTRO_19862, SANCIONES: sources.SANCIONES })]),
      fact('Condición UAF', detail.uaf?.label || 'Sin puente 19.913'),
      fact('Fondos públicos', detail.public_funds?.confirmed ? 'Transferencia confirmada' : sources.REGISTRO_19862 ? 'Presencia Registro 19.862' : 'Sin evidencia confirmada'),
      fact('Sanciones', Number(detail.sanctions?.event_count || 0) ? `${count(detail.sanctions.event_count)} evento(s)` : 'Sin antecedentes observados', false, Number(detail.sanctions?.event_count || 0) ? 'alert' : ''),
    ]));

    const body = node('div', { class: 'osfl-detail-body' });
    const tabs = node('div', { class: 'osfl-detail-tabs' });
    const renderTab = selected => {
      Array.from(tabs.querySelectorAll('button')).forEach(button => button.classList.toggle('active', button.dataset.tab === selected));
      renderDetailBody(body, detail, selected);
    };
    [['timeline', 'Línea de tiempo'], ['economic', 'Actividad económica'], ['background', 'Antecedentes']].forEach(([key, label]) => tabs.append(node('button', { type: 'button', text: label, dataset: { tab: key }, onclick: () => renderTab(key) })));
    panel.append(tabs, body);
    renderTab('timeline');
    if (entity.rut) panel.append(node('button', { class: 'osfl-full-button', type: 'button', onclick: () => api.navigate('entidad', { rut: entity.rut }) }, ['Abrir ficha completa de la entidad', node('span', { text: '→' })]));
    return panel;
  }

  async function loadDetail(host, api, item, selectedRow) {
    const serial = ++detailSerial;
    Array.from(host.closest('.osfl-workspace')?.querySelectorAll('.osfl-table tbody tr') || []).forEach(row => row.classList.remove('selected'));
    selectedRow?.classList.add('selected');
    clear(host); host.append(loading('Cargando caracterización…'));
    try {
      const detail = await global.AtlasV2Osfl.detail(item.entity_id, { route: 'osfl:detail' });
      if (serial !== detailSerial || !host.isConnected) return;
      clear(host); host.append(quickPanel(detail, api));
    } catch (error) {
      if (serial !== detailSerial || !host.isConnected) return;
      clear(host); host.append(errorBox(error, () => loadDetail(host, api, item, selectedRow)));
    }
  }

  async function explorer(api, state, dashboard, serial) {
    const sectionHost = node('div', { class: 'osfl-explorer' });
    sectionHost.append(filterBar(api, state, dashboard));
    const workspace = node('div', { class: 'osfl-workspace' });
    const results = node('div', { class: 'osfl-panel osfl-results-panel' }, loading('Buscando OSFL…'));
    const detailHost = node('div', { class: 'osfl-detail-host' }, node('aside', { class: 'osfl-detail-panel placeholder' }, [icon('◎', 'cyan'), node('strong', { text: 'Seleccione una OSFL' }), node('span', { text: 'La caracterización mostrará fuentes, situación económica, antecedentes y línea de tiempo.' })]));
    workspace.append(results, detailHost); sectionHost.append(workspace);

    try {
      const out = await global.AtlasV2Osfl.search({
        q: state.q,
        region: state.region,
        type: state.type,
        activity: state.activity,
        source: state.source,
        uaf: state.uaf,
        public_funds: state.public_funds,
        sanctions: state.sanctions,
        limit: PAGE_SIZE,
        offset: state.offset,
      }, { route: 'osfl:search' });
      if (serial !== renderSerial || !results.isConnected) return sectionHost;
      clear(results);
      const rows = out.rows || [];
      const total = Number(out.total || 0);
      results.append(node('div', { class: 'osfl-results-head' }, [node('div', {}, [node('h3', { text: 'Resultados' }), node('span', { text: `${count(total)} entidades` })]), node('small', { text: total ? `${count(state.offset + 1)}–${count(Math.min(total, state.offset + PAGE_SIZE))}` : '0 resultados' })]));
      const select = (item, tr) => loadDetail(detailHost, api, item, tr);
      results.append(resultTable(rows, select, rows[0]?.entity_id || null));
      results.append(node('div', { class: 'osfl-pager' }, [
        node('span', { text: `Página ${total ? Math.floor(state.offset / PAGE_SIZE) + 1 : 1} de ${Math.max(1, Math.ceil(total / PAGE_SIZE))}` }),
        node('div', {}, [
          node('button', { type: 'button', text: '‹ Anterior', disabled: state.offset <= 0, onclick: () => nav(api, state, { offset: Math.max(0, state.offset - PAGE_SIZE) }) }),
          node('button', { type: 'button', text: 'Siguiente ›', disabled: state.offset + PAGE_SIZE >= total, onclick: () => nav(api, state, { offset: state.offset + PAGE_SIZE }) }),
        ]),
      ]));
      if (rows[0]) {
        const firstRow = results.querySelector('tbody tr');
        void loadDetail(detailHost, api, rows[0], firstRow);
      }
    } catch (error) {
      if (serial === renderSerial && results.isConnected) { clear(results); results.append(errorBox(error)); }
    }
    return sectionHost;
  }

  async function render(root, route, api) {
    injectStyle();
    const serial = ++renderSerial;
    const state = stateFrom(route);
    clear(root);
    const page = node('div', { class: 'atlas-v2-osfl' });
    root.append(page);
    page.append(node('header', { class: 'osfl-command-head' }, [
      node('div', {}, [node('div', { class: 'atlas-v2-eyebrow', text: 'ATLAS · ORGANIZACIONES SIN FINES DE LUCRO' }), node('h1', {}, ['OSFL ', node('span', { text: '| Panorama y caracterización' })]), node('p', { text: 'Del contexto nacional a la entidad: fuentes, cobertura, actividad económica, cruces regulatorios y trayectoria verificable.' })]),
      node('div', { class: 'osfl-freshness' }, [node('small', { text: 'Cargando corte…' })]),
    ]), loading('Construyendo panorama nacional de OSFL…'));

    try {
      const data = await global.AtlasV2Osfl.dashboard({ route: 'osfl:dashboard' });
      if (serial !== renderSerial || !page.isConnected) return;
      page.lastChild?.remove();
      const n = data.national || {};
      const freshness = page.querySelector('.osfl-freshness');
      clear(freshness);
      freshness.append(node('span', {}, [node('b', { text: 'Corte legal' }), date(n.official_snapshot_date)]), node('span', {}, [node('b', { text: 'Atlas actualizado' }), date(n.refreshed_at, true)]));

      page.append(section('1', 'Contexto nacional', 'El universo legal se muestra como referencia; la capa navegable corresponde a entidades individualizadas en Atlas.', contextStrip(api, state, data)));
      page.append(section('2', 'Fuentes y evolución', 'Qué aporta cada fuente y cómo evoluciona el universo individualizado disponible para análisis.', node('div', { class: 'osfl-source-evolution' }, [sourceTable(api, state, data.sources || []), evolutionChart(data.evolution || [], n.official_total, data.semantics?.evolution)])));
      page.append(section('3', 'Caracterización del universo observado', 'Los gráficos son controles analíticos: seleccionar tipo, actividad o región filtra el explorador inferior.', node('div', { class: 'osfl-character-grid' }, [
        typeDonut(api, state, data.types || [], n.observed, data.semantics?.type_inference),
        activityBars(api, state, data.activities || [], n.observed),
        regionRanking(api, state, data.regions || [], n.observed),
      ])));
      page.append(section('4', 'Explorar y caracterizar OSFL', 'Aplica filtros combinados, selecciona una entidad y revisa su línea de tiempo sólo con hechos fechados.', await explorer(api, state, data, serial)));
      page.append(node('div', { class: 'osfl-method-note' }, [node('strong', { text: 'Lectura metodológica. ' }), data.semantics?.sii_reconciliation || 'Conciliación SII y disponibilidad de historia económica anual son dimensiones distintas.', ' ', data.semantics?.official_universe || 'El universo Registro Civil es una referencia nacional mientras no exista carga individualizada completa.']));
    } catch (error) {
      if (serial === renderSerial && page.isConnected) { clear(page); page.append(errorBox(error, () => render(root, route, api))); }
    }
  }

  function install() {
    if (!global.AtlasV2Shell?.registerSurface || !global.AtlasV2Osfl) return false;
    global.AtlasV2Shell.registerSurface('osfl', render);
    global.__ATLAS_V2_OSFL_SURFACE__ = true;
    return true;
  }

  if (!install()) global.addEventListener('atlas:v2:ready', install, { once: true });
})(window);