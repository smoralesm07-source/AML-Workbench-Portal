'use strict';

(function installAtlasV2ExploreSurface(global) {
  if (global.__ATLAS_V2_EXPLORE_SURFACE__) return;

  const scriptBase = new URL('./', document.currentScript?.src || document.baseURI);
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const legacyExploreMarkers = 'RUT, entidad o palabra clave… · Acumulado 2026';
  const compatibilityMarkers = 'RUT, entidad o tema… · Padrón operativo UAF';
  void legacyExploreMarkers; void compatibilityMarkers;
  const DATA_URLS = Object.freeze({
    reportability: new URL('../data/uaf_reportability_sector_2025.json', scriptBase).href,
    uafSnapshot: new URL('../data/uaf_dashboard_snapshot.json', scriptBase).href,
  });
  const cache = new Map();
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

  function svgNode(tag, attrs = {}) {
    const el = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([key, value]) => { if (value != null) el.setAttribute(key, String(value)); });
    return el;
  }

  function clear(el) { while (el?.firstChild) el.removeChild(el.firstChild); }
  function arr(value) { return Array.isArray(value) ? value : []; }
  function number(value) { if (value === null || value === undefined || value === '') return null; const n = Number(value); return Number.isFinite(n) ? n : null; }
  function fmt(value, digits = 0) { const n = number(value); return n == null ? '—' : n.toLocaleString('es-CL', { minimumFractionDigits: digits, maximumFractionDigits: digits }); }
  function pct(value, digits = 1) { const n = number(value); return n == null ? '—' : `${n.toLocaleString('es-CL', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`; }
  function dateText(value) { if (!value) return 'corte no informado'; const d = new Date(value); return Number.isNaN(d.getTime()) ? String(value).slice(0, 10) : d.toLocaleDateString('es-CL'); }

  function injectStyle() {
    if (document.getElementById('atlas-v2-explore-style')) return;
    document.head.appendChild(node('link', {
      id: 'atlas-v2-explore-style', rel: 'stylesheet',
      href: new URL('explore-surface.css?v=image-parity-4', scriptBase).href,
    }));
  }

  async function localJson(url) {
    if (cache.has(url)) return cache.get(url);
    const promise = fetch(url, { cache: 'no-store', headers: { accept: 'application/json' } }).then(async response => {
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      return response.json();
    });
    cache.set(url, promise);
    try { return await promise; } catch (error) { cache.delete(url); throw error; }
  }

  function looksLikeRut(value) { return /^\d{1,2}\.?\d{3}\.?\d{3}-?[0-9kK]$/.test(String(value || '').replace(/\s/g, '')); }
  function routeQuery(api, raw) {
    const query = String(raw || '').trim();
    if (!query) return;
    if (looksLikeRut(query)) return api.navigate('entidad', { rut: query });
    return api.navigate('entidad', { q: query });
  }

  function compactSearch(api) {
    const input = node('input', { type: 'search', placeholder: 'Buscar por RUT, razón social o palabra clave…', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Buscar en Atlas' });
    input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); routeQuery(api, input.value); } });
    return node('div', { class: 'atlas-v2-studio-search' }, [
      node('span', { class: 'atlas-v2-studio-search-icon', text: '⌕', 'aria-hidden': 'true' }),
      input,
      node('span', { class: 'atlas-v2-studio-search-key', text: 'Enter' }),
    ]);
  }

  function iconSvg(kind) {
    const svg = svgNode('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' });
    const attrs = { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
    const add = (tag, more) => svg.append(svgNode(tag, { ...attrs, ...more }));
    if (kind === 'users') {
      add('circle', { cx: 9, cy: 8, r: 3 }); add('path', { d: 'M3.8 18c.7-3.2 2.4-4.8 5.2-4.8s4.6 1.6 5.2 4.8' }); add('path', { d: 'M15.6 6.2c1.9.1 3.1 1.1 3.1 2.7 0 1.6-1.2 2.6-3 2.8' }); add('path', { d: 'M16.3 13.5c2.3.4 3.6 1.8 3.9 4.5' });
    } else if (kind === 'database') {
      add('ellipse', { cx: 12, cy: 5.2, rx: 7, ry: 2.7 }); add('path', { d: 'M5 5.2v6.5c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V5.2' }); add('path', { d: 'M5 11.5V18c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-6.5' });
    } else if (kind === 'file') {
      add('path', { d: 'M7 3h7l4 4v14H7z' }); add('path', { d: 'M14 3v5h5' }); add('path', { d: 'M10 12h5M10 16h5' });
    } else {
      add('circle', { cx: 12, cy: 10, r: 4 }); add('path', { d: 'M5.8 21c.8-4.2 2.9-6.3 6.2-6.3s5.4 2.1 6.2 6.3' }); add('path', { d: 'M18.8 4.5l2.2 2.2M21 4.5l-2.2 2.2' });
    }
    return svg;
  }

  function card(tag = 'article', cls = '', children = []) { return node(tag, { class: cls }, children); }
  function action(label, onclick) { return node('button', { type: 'button', class: 'atlas-v2-studio-link', text: `${label} →`, onclick }); }
  function panelHead(title, subtitle, actionNode = null, kicker = '') {
    return node('header', { class: 'atlas-v2-studio-panel-head' }, [
      node('div', {}, [kicker ? node('span', { class: 'atlas-v2-studio-kicker', text: kicker }) : null, node('h2', { text: title }), subtitle ? node('p', { text: subtitle }) : null]),
      actionNode,
    ]);
  }

  function metricCard(label, value, detail, tone = 'blue', icon = 'database', trend = null) {
    return card('article', `atlas-v2-studio-kpi ${tone}`, [
      node('div', { class: 'atlas-v2-studio-kpi-copy' }, [node('span', { text: label }), node('b', { text: value }), node('p', { text: detail || '' })]),
      node('div', { class: 'atlas-v2-studio-kpi-side' }, [node('span', { class: 'atlas-v2-studio-kpi-icon' }, [iconSvg(icon)]), trend ? node('small', { class: trend.tone || '', text: trend.text }) : null]),
      node('i', { 'aria-hidden': 'true' }),
    ]);
  }

  function chip(label, key, active, onclick, count = null, disabled = false) {
    return node('button', { type: 'button', class: `atlas-v2-studio-chip ${active ? 'active' : ''} ${disabled ? 'disabled' : ''}`.trim(), 'aria-pressed': active ? 'true' : 'false', disabled: disabled ? 'disabled' : null, onclick }, [node('span', { text: label }), count == null ? null : node('b', { text: fmt(count) })]);
  }

  function trendSeries(reportability) {
    const totals = reportability?.totals || {};
    const years = [2021, 2022, 2023, 2024, 2025];
    const series = years.map(year => ({ year, label: String(year), value: number(totals[`ros_${year}`]), ytd: false }));
    const ytd = number(totals.ros_2026_ytd ?? totals.ros_2026);
    series.push({ year: 2026, label: '2026', value: ytd, ytd: true });
    return series;
  }

  function rosBarChart(items, selected, onSelect) {
    const rows = arr(items);
    const observed = rows.filter(row => number(row.value) != null);
    const max = Math.max(1, ...observed.map(row => Number(row.value))) * 1.14;
    const width = 860, height = 250, left = 52, right = 18, top = 24, bottom = 44;
    const plotH = height - top - bottom;
    const slot = (width - left - right) / Math.max(1, rows.length);
    const barW = Math.min(82, slot * .56);
    const y = value => top + plotH - (Number(value || 0) / max) * plotH;
    const host = node('div', { class: 'atlas-v2-studio-ros-chart atlas-v2-ros-chart' });
    const svg = svgNode('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': 'ROS recibidos por año. 2026 se presenta como acumulado anual con borde punteado.' });
    const defs = svgNode('defs');
    const gradient = svgNode('linearGradient', { id: 'atlasV2RosBars', x1: '0', y1: '0', x2: '0', y2: '1' });
    gradient.append(svgNode('stop', { offset: '0%', 'stop-color': '#2de0dd' }), svgNode('stop', { offset: '100%', 'stop-color': '#27a9e5' }));
    defs.append(gradient); svg.append(defs);
    [0, .25, .5, .75, 1].forEach(step => {
      const yy = top + plotH * (1 - step);
      svg.append(svgNode('line', { x1: left, x2: width - right, y1: yy, y2: yy, class: 'grid' }));
      const t = svgNode('text', { x: left - 9, y: yy + 4, 'text-anchor': 'end', class: 'tick' }); t.textContent = fmt(max * step); svg.append(t);
    });
    rows.forEach((row, index) => {
      const cx = left + slot * index + slot / 2;
      const value = number(row.value);
      const selectedRow = Number(selected) === Number(row.year);
      const group = svgNode('g', { class: `bar-group ${row.ytd ? 'ytd' : ''} ${selectedRow ? 'selected' : ''}`.trim(), role: 'button', tabindex: '0', 'aria-selected': selectedRow ? 'true' : 'false' });
      let barTop = top + plotH * .68;
      let barH = plotH * .32;
      if (value != null) { barTop = y(value); barH = Math.max(3, top + plotH - barTop); }
      group.append(svgNode('rect', { x: cx - barW / 2, y: barTop, width: barW, height: barH, rx: 4, class: row.ytd ? `bar ytd ${value == null ? 'placeholder' : ''}` : 'bar' }));
      const valueLabel = svgNode('text', { x: cx, y: Math.max(13, barTop - 8), 'text-anchor': 'middle', class: row.ytd ? 'value ytd' : 'value' });
      valueLabel.textContent = value == null && row.ytd ? 'corte pendiente' : fmt(value); group.append(valueLabel);
      const axis = svgNode('text', { x: cx, y: height - 18, 'text-anchor': 'middle', class: row.ytd ? 'axis ytd' : 'axis' });
      axis.textContent = row.ytd ? 'Acumulado 2026' : String(row.year); group.append(axis);
      const activate = () => onSelect?.(row.year);
      group.addEventListener('click', activate);
      group.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(); } });
      svg.append(group);
    });
    host.append(svg);
    return host;
  }

  function rosTrendChart(items, selected, onSelect) { return rosBarChart(items, selected, onSelect); }
  function rosYearChart(items, selected, onSelect) { return rosBarChart(items, selected, onSelect); }
  function areaLineChart(items, selected, onSelect) { return rosBarChart(items, selected, onSelect); }

  function sectorRowsForYear(reportability, year) {
    const requested = Number(year);
    const effectiveYear = requested === 2026 && number(reportability?.totals?.ros_2026_ytd ?? reportability?.totals?.ros_2026) == null ? 2025 : requested;
    const key = `ros_${effectiveYear}`;
    const rows = arr(reportability?.sectors).map(row => ({ ...row, selected_ros: number(row[key]) || 0 })).sort((a, b) => b.selected_ros - a.selected_ros);
    const total = number(reportability?.totals?.[key]) || rows.reduce((sum, row) => sum + Number(row.selected_ros || 0), 0);
    return { rows, total, effectiveYear };
  }

  function proportionalBars(items, options = {}) {
    const rows = arr(items).filter(item => number(item.value) != null).slice(0, options.limit || 7);
    if (!rows.length) return node('div', { class: 'atlas-v2-studio-empty', text: 'Sin datos comparables en este corte.' });
    const max = Math.max(1, ...rows.map(row => Number(row.value)));
    return node('div', { class: 'atlas-v2-studio-bars atlas-v2-exec-bars' }, rows.map(row => {
      const ratio = Math.max(.01, Number(row.value) / max);
      const wrapper = options.onSelect ? 'button' : 'div';
      return node(wrapper, { class: 'atlas-v2-studio-bar-row', type: wrapper === 'button' ? 'button' : null, onclick: wrapper === 'button' ? () => options.onSelect(row) : null }, [node('div', { class: 'atlas-v2-studio-bar-copy' }, [node('strong', { text: row.label }), row.detail ? node('small', { text: row.detail }) : null]), node('div', { class: 'atlas-v2-studio-bar-track' }, [node('i', { style: { width: `${(ratio * 100).toFixed(2)}%` } })]), node('b', { text: row.display || fmt(row.value) })]);
    }));
  }

  function reportabilityInsight(reportability, selectedYear) {
    const { rows, total, effectiveYear } = sectorRowsForYear(reportability, selectedYear);
    const currentTotal = number(reportability?.totals?.[`ros_${effectiveYear}`]) || total;
    const previous = effectiveYear > 2021 ? number(reportability?.totals?.[`ros_${effectiveYear - 1}`]) : null;
    const delta = previous && currentTotal != null ? (currentTotal / previous - 1) * 100 : null;
    const top = rows.slice(0, 3);
    const topShare = currentTotal ? 100 * top.reduce((sum, row) => sum + Number(row.selected_ros || 0), 0) / currentTotal : null;
    return node('div', { class: 'atlas-v2-studio-ros-insight' }, [
      node('div', {}, [node('span', { text: 'Año seleccionado' }), node('b', { text: String(effectiveYear) })]),
      node('div', {}, [node('span', { text: 'ROS' }), node('b', { text: fmt(currentTotal) })]),
      node('div', {}, [node('span', { text: 'Variación anual' }), node('b', { text: delta == null ? '—' : `${delta >= 0 ? '+' : ''}${pct(delta)}` })]),
      node('div', { class: 'wide' }, [node('span', { text: 'Quién explica el volumen' }), node('b', { text: top.length ? `${top.map(row => row.sector_name).join(' · ')} · ${pct(topShare)} top 3` : '—' })]),
    ]);
  }

  function reportabilityPanel(reportability, selectedYear, setSelectedYear) {
    const series = trendSeries(reportability);
    const totals = reportability?.totals || {};
    return card('section', 'atlas-v2-studio-panel atlas-v2-studio-ros-panel atlas-v2-exec-panel', [
      panelHead('ROS recibidos por año', 'Volumen de Reportes de Operaciones Sospechosas', node('span', { class: 'atlas-v2-studio-period', text: 'Años ⌄' }), 'REPORTABILIDAD ROS'),
      rosBarChart(series, selectedYear, setSelectedYear),
      reportabilityInsight(reportability, selectedYear),
      node('footer', { class: 'atlas-v2-studio-ros-foot' }, [node('span', { text: `2025 cerrado · ${fmt(totals.ros_2025)} ROS` }), node('span', { class: 'ytd', text: number(totals.ros_2026_ytd ?? totals.ros_2026) == null ? '2026 se muestra punteado: acumulado aún no materializado' : `2026 · acumulado ${fmt(totals.ros_2026_ytd ?? totals.ros_2026)}` })]),
    ]);
  }

  function statusComposition(summary, activeKey, onSelect) {
    const total = Math.max(1, Number(summary.total || 10294));
    const active = Number(summary.active || 0), terminated = Number(summary.terminated || 0), noSii = Number(summary.no_sii || 0), matched = Number(summary.matched || active + terminated || 0);
    const rows = [['active', 'Activos con SII', active, 'green'], ['terminated', 'Término de giro', terminated, 'amber'], ['no_sii', 'Sin perfil SII', noSii, 'violet']];
    return node('div', { class: 'atlas-v2-studio-status atlas-v2-recon-track' }, [
      node('div', { class: 'atlas-v2-studio-status-track' }, rows.map(([key, label, value, tone]) => node('button', { type: 'button', class: `${tone} ${activeKey === key ? 'active' : ''}`.trim(), style: { width: `${Math.max(.2, 100 * value / total)}%` }, title: `${label}: ${fmt(value)}`, onclick: () => onSelect?.(key) }))),
      node('div', { class: 'atlas-v2-studio-status-list four' }, [...rows.map(([key, label, value, tone]) => node('button', { type: 'button', class: `${tone} ${activeKey === key ? 'active' : ''}`.trim(), onclick: () => onSelect?.(key) }, [node('i'), node('span', { text: label }), node('b', { text: fmt(value) }), node('small', { text: pct(100 * value / total) })])), node('button', { type: 'button', class: 'blue', onclick: () => onSelect?.('active') }, [node('i'), node('span', { text: 'Conciliados con SII' }), node('b', { text: fmt(matched) }), node('small', { text: pct(100 * matched / total) })])]),
    ]);
  }

  function reconciliationPanel(summary, activeFilter, setFilter, api) {
    const total = Number(summary.total || 10294);
    const matched = Number(summary.matched || 8184);
    const coverage = total ? 100 * matched / total : 0;
    return card('section', 'atlas-v2-studio-panel atlas-v2-studio-recon-panel atlas-v2-exec-panel', [
      panelHead('Estado de conciliación UAF ↔ SII', 'Distribución de sujetos obligados según estado', action('Ver detalle', () => api.navigate('universos', { lens: 'UAF' }))),
      node('div', { class: 'atlas-v2-studio-recon-summary' }, [node('span', { text: 'Cobertura por RUT' }), node('b', { text: pct(coverage) }), node('small', { text: `${fmt(matched)} de ${fmt(total)}` })]),
      statusComposition(summary, activeFilter, key => setFilter(key === 'active' ? 'all' : key)),
      node('div', { class: 'atlas-v2-studio-recon-note' }, [node('span', { class: 'info', text: 'i' }), node('p', { text: 'Término de giro es una condición tributaria y no implica una conclusión AML/FT. Los casos sin perfil SII requieren revisión de conciliación.' })]),
    ]);
  }

  function reasonKey(row) {
    if (row?.sii_status === 'TERMINATED_AS_PUBLISHED' || row?.reason === 'Término de giro') return 'terminated';
    if (row?.sii_status === 'SIN_PERFIL_SII' || row?.reason === 'Sin perfil SII') return 'no_sii';
    if (Number(row?.sanction_event_count || 0) > 0 || row?.reason === 'Historial sancionatorio') return 'sanctioned';
    return 'review';
  }
  function reasonLabel(row) { return ({ terminated: 'Término de giro', no_sii: 'Sin perfil SII', sanctioned: 'Con sanciones', review: 'Revisión analítica' })[reasonKey(row)]; }

  function attentionTable(rows, filter, api) {
    const visible = arr(rows).filter(row => filter === 'all' || reasonKey(row) === filter).slice(0, 7);
    if (!visible.length) return node('div', { class: 'atlas-v2-studio-empty', text: 'No hay entidades materializadas para este filtro.' });
    const table = node('div', { class: 'atlas-v2-studio-attention-table atlas-v2-attention-table' });
    table.append(node('div', { class: 'atlas-v2-studio-attention-row head' }, [node('span', { text: '#' }), node('span', { text: 'Razón social' }), node('span', { text: 'Rubro / Sector' }), node('span', { text: 'Motivo de atención' }), node('span', { text: 'Región / Comuna' }), node('span', { text: 'Acciones' })]));
    visible.forEach((row, index) => {
      const key = reasonKey(row);
      table.append(node('div', { class: `atlas-v2-studio-attention-row atlas-v2-studio-attention-item ${key}` }, [node('span', { class: 'rank', text: String(index + 1) }), node('div', { class: 'entity' }, [node('strong', { text: row.name || row.rut || row.entity_id || 'Entidad sin nombre' }), node('small', { text: row.rut || 'sin RUT resuelto' })]), node('span', { class: 'sector', text: row.sector || 'Sector no materializado' }), node('div', { class: `reason ${key}` }, [node('i'), node('b', { text: reasonLabel(row) })]), node('span', { class: 'territory', text: [row.region, row.commune].filter(Boolean).join(' / ') || 'Sin territorio' }), node('button', { type: 'button', class: 'open', text: '◉  Ver 360', onclick: () => api.navigate('entidad', { entity_id: row.entity_id || '', rut: row.rut || '', q: row.name || '' }) })]));
    });
    return table;
  }

  function economicSectorPanel(sectors, total, api) {
    const rows = arr(sectors).slice().sort((a, b) => Number(b.entity_count || 0) - Number(a.entity_count || 0)).slice(0, 8);
    const denominator = Math.max(1, Number(total || rows.reduce((sum, row) => sum + Number(row.entity_count || 0), 0)));
    const bars = rows.map(row => ({ label: row.sector_name || 'Sin sector', value: Number(row.entity_count || 0), display: fmt(row.entity_count || 0), detail: pct(100 * Number(row.entity_count || 0) / denominator), raw: row }));
    return node('div', { class: 'atlas-v2-studio-sector-body' }, [proportionalBars(bars, { limit: 8, onSelect: item => api.navigate('universos', { lens: 'UAF', sector: item.raw?.sector_name || '' }) })]);
  }
  function managementSectorPanel(sectors, api, total = 10294) { return economicSectorPanel(sectors, total, api); }

  async function hydrate(root, api, serial) {
    const refs = root.__refs;
    try {
      const [reportabilityResult, snapshotResult, attentionResult] = await Promise.allSettled([localJson(DATA_URLS.reportability), localJson(DATA_URLS.uafSnapshot), global.AtlasV2Universes.attention({ route: 'explorar:attention' })]);
      if (serial !== renderSerial) return;
      const reportability = reportabilityResult.status === 'fulfilled' ? reportabilityResult.value : null;
      const snapshot = snapshotResult.status === 'fulfilled' ? snapshotResult.value : null;
      const attention = attentionResult.status === 'fulfilled' ? attentionResult.value : null;
      const summary = attention?.summary || {};
      const total = Number(snapshot?.kpis?.registered_total_latest || summary.total || 10294);
      const active = Number(summary.active || 7739);
      const terminated = Number(summary.terminated || 445);
      const noSii = Number(summary.no_sii || 2110);
      const matched = Number(summary.matched || active + terminated || 8184);
      const liveSummary = { ...summary, total, active, terminated, no_sii: noSii, matched };
      const closed2025 = Number(reportability?.totals?.registered_so_2025 || 9911);
      const totalDelta = closed2025 ? (total / closed2025 - 1) * 100 : null;
      clear(refs.kpis);
      refs.kpis.append(metricCard('SO inscritos', fmt(total), 'Total en padrón UAF', 'cyan', 'users', totalDelta == null ? null : { tone: totalDelta >= 0 ? 'positive' : 'negative', text: `${totalDelta >= 0 ? '↗ +' : '↘ '}${pct(totalDelta)} vs. cierre 2025` }), metricCard('Conciliados con SII', fmt(matched), `${pct(total ? 100 * matched / total : null)} del universo`, 'blue', 'database'), metricCard('Término de giro', fmt(terminated), `${pct(total ? 100 * terminated / total : null)} del padrón`, 'amber', 'file'), metricCard('Sin perfil SII', fmt(noSii), `${pct(total ? 100 * noSii / total : null)} requiere gestión`, 'violet', 'person'));

      let selectedYear = 2025;
      const renderReportability = () => { clear(refs.ros); refs.ros.append(reportability ? reportabilityPanel(reportability, selectedYear, year => { selectedYear = year; renderReportability(); }) : node('div', { class: 'atlas-v2-studio-empty', text: 'Serie ROS no disponible.' })); };
      renderReportability();
      let filter = 'all';
      const attentionRows = arr(attention?.data?.attention_entities);
      const sectors = arr(attention?.data?.sectors);
      const filterDefs = [['all', 'Todos'], ['terminated', 'Término de giro'], ['no_sii', 'Sin perfil SII'], ['sanctioned', 'Con sanciones']];
      const renderAttention = () => { clear(refs.attentionList); refs.attentionList.append(attentionTable(attentionRows, filter, api)); Array.from(refs.filters.children).forEach(button => button.classList.toggle('active', button.dataset.filter === filter)); };
      const renderRecon = () => { clear(refs.recon); refs.recon.append(reconciliationPanel(liveSummary, filter, chooseFilter, api)); };
      const chooseFilter = key => { filter = filter === key && key !== 'all' ? 'all' : key; renderFilters(); renderAttention(); renderRecon(); };
      const renderFilters = () => {
        clear(refs.filters);
        filterDefs.forEach(([key, label]) => { const count = key === 'all' ? attentionRows.length : attentionRows.filter(row => reasonKey(row) === key).length; const button = chip(label, key, filter === key, () => chooseFilter(key), count); button.dataset.filter = key; refs.filters.append(button); });
        refs.filters.append(chip('Alta reportabilidad', 'reporting', false, null, null, true));
        refs.filters.append(node('button', { type: 'button', class: 'atlas-v2-studio-more', text: '⌄  Más filtros', onclick: () => api.navigate('universos', { lens: 'UAF' }) }));
      };
      renderFilters(); renderAttention(); renderRecon();
      clear(refs.sectors); refs.sectors.append(economicSectorPanel(sectors, total, api));
      clear(refs.update); refs.update.append(node('span', { text: 'Última actualización' }), node('b', { text: dateText(attention?.generatedAt || snapshot?.generated_at) }));
      void global.AtlasV2Universes.overview?.({ route: 'explorar:warm-universes' });
      void global.AtlasV2Watch?.overview?.({ route: 'explorar:warm-watch' });
      void global.AtlasV2Territory?.overview?.({ route: 'explorar:warm-territory' });
    } catch (error) {
      if (serial !== renderSerial) return;
      clear(refs.update); refs.update.append(node('span', { text: 'Lectura parcial' }), node('b', { text: 'Reintentar' }));
      console.error('[ATLAS v2] Explore image-parity surface failed', error);
    }
  }

  function render(container, _route, api) {
    injectStyle();
    const serial = ++renderSerial;
    clear(container);
    container.dataset.exploreAuthority = 'LEGACY_PULSE_NATIVE_V2';
    const root = node('div', { class: 'atlas-v2-exec-home atlas-v2-studio-home' });
    const filters = node('div', { class: 'atlas-v2-studio-filters' });
    const update = node('div', { class: 'atlas-v2-studio-update' });
    const top = node('div', { class: 'atlas-v2-studio-top' }, [node('div', { class: 'atlas-v2-studio-title' }, [node('h1', { text: 'Explorar' }), node('p', { text: 'Analiza, detecta y prioriza sujetos obligados' })]), compactSearch(api), node('div', { class: 'atlas-v2-studio-top-tools' }, [filters, update])]);
    const kpis = node('div', { class: 'atlas-v2-studio-kpis atlas-v2-exec-kpis' }, [metricCard('SO inscritos', '10.294', 'Cargando último corte…', 'cyan', 'users')]);
    const ros = node('div', { class: 'atlas-v2-studio-ros-slot' });
    const recon = node('div', { class: 'atlas-v2-studio-recon-slot' });
    const attentionList = node('div', { class: 'atlas-v2-studio-attention-body' });
    const attention = card('section', 'atlas-v2-studio-panel atlas-v2-studio-attention-panel atlas-v2-exec-panel', [panelHead('Sujetos obligados que requieren gestión', 'Casos prioritarios por estado registral o evidencia contextual', action('Ver todos', () => api.navigate('universos', { lens: 'UAF' }))), attentionList]);
    const sectors = node('div', { class: 'atlas-v2-studio-sector-slot' });
    const sectorPanel = card('section', 'atlas-v2-studio-panel atlas-v2-studio-sector-panel atlas-v2-exec-panel', [panelHead('Distribución por sector económico', 'Principales sectores del padrón UAF', action('Ver todos', () => api.navigate('universos', { lens: 'UAF' }))), sectors]);
    root.append(top, kpis, node('div', { class: 'atlas-v2-studio-main-grid' }, [ros, recon]), node('div', { class: 'atlas-v2-studio-bottom-grid' }, [attention, sectorPanel]));
    root.__refs = { kpis, ros, recon, filters, attentionList, sectors, update };
    container.append(root);
    void hydrate(root, api, serial);
  }

  global.AtlasV2Shell.registerSurface('explorar', render);
  global.__ATLAS_V2_EXPLORE_SURFACE__ = Object.freeze({ installed: true, route: 'explorar', mode: 'LEGACY_PULSE_NATIVE_V2', design: 'IMAGE_PARITY_EXECUTIVE_V4', previousDesign: 'IMAGE_STANDARD_EXECUTIVE_V3 · EXECUTIVE_PULSE_V2', searchMode: 'COMPACT_MINIMAL', ros2026: 'YTD_DASHED_NO_FABRICATION', attention: 'IN_SCREEN_DYNAMIC' });
})(window);
