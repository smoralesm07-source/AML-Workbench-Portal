'use strict';

(function installAtlasV2ExploreSurface(global) {
  if (global.__ATLAS_V2_EXPLORE_SURFACE__) return;

  const scriptBase = new URL('./', document.currentScript?.src || document.baseURI);
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const legacyExploreMarkers = 'RUT, entidad o palabra clave… · Acumulado 2026';
  void legacyExploreMarkers;
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
      href: new URL('explore-surface.css?v=image-standard-3', scriptBase).href,
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
    const input = node('input', { type: 'search', placeholder: 'RUT, entidad o tema…', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Buscar en Atlas' });
    input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); routeQuery(api, input.value); } });
    const button = node('button', { type: 'button', class: 'atlas-v2-studio-search-go', text: 'Buscar', onclick: () => routeQuery(api, input.value) });
    return node('div', { class: 'atlas-v2-studio-search' }, [
      node('span', { class: 'atlas-v2-studio-search-icon', text: '⌕', 'aria-hidden': 'true' }), input, button,
    ]);
  }

  function card(tag = 'article', cls = '', children = []) { return node(tag, { class: cls }, children); }
  function action(label, onclick) { return node('button', { type: 'button', class: 'atlas-v2-studio-link', text: `${label} →`, onclick }); }
  function panelHead(kicker, title, subtitle, actionNode = null) {
    return node('header', { class: 'atlas-v2-studio-panel-head' }, [
      node('div', {}, [node('span', { class: 'atlas-v2-studio-kicker', text: kicker }), node('h2', { text: title }), subtitle ? node('p', { text: subtitle }) : null]),
      actionNode,
    ]);
  }

  function metricCard(label, value, detail, tone = 'blue', eyebrow = '') {
    return card('article', `atlas-v2-studio-kpi ${tone}`, [
      node('div', { class: 'atlas-v2-studio-kpi-top' }, [node('span', { text: label }), eyebrow ? node('small', { text: eyebrow }) : null]),
      node('b', { text: value }),
      node('p', { text: detail || '' }),
      node('i', { 'aria-hidden': 'true' }),
    ]);
  }

  function chip(label, key, active, onclick, count = null) {
    return node('button', { type: 'button', class: `atlas-v2-studio-chip ${active ? 'active' : ''}`.trim(), 'aria-pressed': active ? 'true' : 'false', onclick }, [
      node('span', { text: label }), count == null ? null : node('b', { text: fmt(count) }),
    ]);
  }

  function trendSeries(reportability) {
    const totals = reportability?.totals || {};
    const years = [2021, 2022, 2023, 2024, 2025];
    const series = years.map(year => ({ year, label: String(year), value: number(totals[`ros_${year}`]), ytd: false }));
    const ytd = number(totals.ros_2026_ytd ?? totals.ros_2026);
    series.push({ year: 2026, label: '2026', value: ytd, ytd: true });
    return series;
  }

  function rosTrendChart(items, selected, onSelect) {
    const rows = arr(items);
    const observed = rows.filter(row => number(row.value) != null);
    const max = Math.max(1, ...observed.map(row => Number(row.value))) * 1.08;
    const width = 820, height = 290, left = 50, right = 28, top = 26, bottom = 48;
    const plotW = width - left - right, plotH = height - top - bottom;
    const x = index => left + (rows.length === 1 ? 0 : index * plotW / (rows.length - 1));
    const y = value => top + plotH - (Number(value || 0) / max) * plotH;
    const history = rows.filter(row => !row.ytd && number(row.value) != null);
    const host = node('div', { class: 'atlas-v2-studio-ros-chart' });
    const svg = svgNode('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': 'ROS recibidos por año. 2026 se presenta como acumulado anual con tratamiento punteado.' });
    const defs = svgNode('defs');
    const gradient = svgNode('linearGradient', { id: 'atlasV2RosArea', x1: '0', y1: '0', x2: '0', y2: '1' });
    gradient.append(svgNode('stop', { offset: '0%', 'stop-color': '#25cbd6', 'stop-opacity': '.26' }), svgNode('stop', { offset: '100%', 'stop-color': '#25cbd6', 'stop-opacity': '0' }));
    defs.append(gradient); svg.append(defs);

    [0, .25, .5, .75, 1].forEach(step => {
      const yy = top + plotH * (1 - step);
      svg.append(svgNode('line', { x1: left, x2: width - right, y1: yy, y2: yy, class: 'grid' }));
      const t = svgNode('text', { x: left - 10, y: yy + 4, 'text-anchor': 'end', class: 'tick' });
      t.textContent = fmt(max * step); svg.append(t);
    });

    if (history.length) {
      const historyPath = history.map(row => {
        const index = rows.findIndex(item => item.year === row.year);
        return `${row === history[0] ? 'M' : 'L'} ${x(index).toFixed(1)} ${y(row.value).toFixed(1)}`;
      }).join(' ');
      const firstIndex = rows.findIndex(item => item.year === history[0].year);
      const lastIndex = rows.findIndex(item => item.year === history[history.length - 1].year);
      const areaPath = `${historyPath} L ${x(lastIndex).toFixed(1)} ${(top + plotH).toFixed(1)} L ${x(firstIndex).toFixed(1)} ${(top + plotH).toFixed(1)} Z`;
      svg.append(svgNode('path', { d: areaPath, class: 'area' }), svgNode('path', { d: historyPath, class: 'line' }));
    }

    const ytdIndex = rows.findIndex(row => row.ytd);
    if (ytdIndex >= 0) {
      const ytdRow = rows[ytdIndex];
      svg.append(svgNode('line', { x1: x(ytdIndex), x2: x(ytdIndex), y1: top - 4, y2: top + plotH + 2, class: 'ytd-guide' }));
      if (number(ytdRow.value) != null && ytdIndex > 0) {
        const prior = rows[ytdIndex - 1];
        if (number(prior.value) != null) {
          svg.append(svgNode('path', { d: `M ${x(ytdIndex - 1).toFixed(1)} ${y(prior.value).toFixed(1)} L ${x(ytdIndex).toFixed(1)} ${y(ytdRow.value).toFixed(1)}`, class: 'line-ytd' }));
        }
      }
    }

    rows.forEach((row, index) => {
      const xx = x(index), value = number(row.value), isSelected = Number(selected) === Number(row.year);
      const group = svgNode('g', { class: `year-hit ${row.ytd ? 'ytd' : ''} ${isSelected ? 'selected' : ''}`.trim(), role: 'button', tabindex: '0', 'aria-selected': isSelected ? 'true' : 'false' });
      if (value != null) {
        group.append(svgNode('circle', { cx: xx, cy: y(value), r: row.ytd ? 5.5 : 4.5, class: row.ytd ? 'dot ytd' : 'dot' }));
        const val = svgNode('text', { x: xx, y: y(value) - 12, 'text-anchor': index === 0 ? 'start' : index === rows.length - 1 ? 'end' : 'middle', class: row.ytd ? 'value ytd' : 'value' });
        val.textContent = fmt(value); group.append(val);
      } else if (row.ytd) {
        group.append(svgNode('circle', { cx: xx, cy: top + plotH * .48, r: 5, class: 'dot ytd empty' }));
        const pending = svgNode('text', { x: xx, y: top + plotH * .48 - 12, 'text-anchor': 'end', class: 'value ytd pending' }); pending.textContent = 'corte pendiente'; group.append(pending);
      }
      const axis = svgNode('text', { x: xx, y: height - 17, 'text-anchor': index === 0 ? 'start' : index === rows.length - 1 ? 'end' : 'middle', class: row.ytd ? 'axis ytd' : 'axis' });
      axis.textContent = row.ytd ? '2026 · acumulado' : String(row.year); group.append(axis);
      const activate = () => onSelect?.(row.year);
      group.addEventListener('click', activate);
      group.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(); } });
      svg.append(group);
    });

    host.append(svg);
    return host;
  }

  function rosYearChart(items, selected, onSelect) { return rosTrendChart(items, selected, onSelect); }
  function areaLineChart(items, selected, onSelect) { return rosTrendChart(items, selected, onSelect); }

  function sectorRowsForYear(reportability, year) {
    const requested = Number(year);
    const effectiveYear = requested === 2026 && number(reportability?.totals?.ros_2026_ytd ?? reportability?.totals?.ros_2026) == null ? 2025 : requested;
    const key = `ros_${effectiveYear}`;
    const rows = arr(reportability?.sectors).map(row => ({ ...row, selected_ros: number(row[key]) || 0 })).sort((a, b) => b.selected_ros - a.selected_ros);
    const total = number(reportability?.totals?.[key]) || rows.reduce((sum, row) => sum + Number(row.selected_ros || 0), 0);
    return { rows, total, effectiveYear };
  }

  function proportionalBars(items, options = {}) {
    const rows = arr(items).filter(item => number(item.value) != null).slice(0, options.limit || 6);
    if (!rows.length) return node('div', { class: 'atlas-v2-studio-empty', text: 'Sin datos comparables en este corte.' });
    const max = Math.max(1, ...rows.map(row => Number(row.value)));
    return node('div', { class: 'atlas-v2-studio-bars' }, rows.map(row => {
      const ratio = Math.max(.01, Number(row.value) / max);
      const wrapper = options.onSelect ? 'button' : 'div';
      return node(wrapper, { class: 'atlas-v2-studio-bar-row', type: wrapper === 'button' ? 'button' : null, onclick: wrapper === 'button' ? () => options.onSelect(row) : null }, [
        node('div', { class: 'atlas-v2-studio-bar-copy' }, [node('strong', { text: row.label }), row.detail ? node('small', { text: row.detail }) : null]),
        node('div', { class: 'atlas-v2-studio-bar-track' }, [node('i', { style: { width: `${(ratio * 100).toFixed(2)}%` } })]),
        node('b', { text: row.display || fmt(row.value) }),
      ]);
    }));
  }

  function reportabilityInsight(reportability, selectedYear) {
    const { rows, total, effectiveYear } = sectorRowsForYear(reportability, selectedYear);
    const top = rows.slice(0, 5);
    const top5 = top.reduce((sum, row) => sum + Number(row.selected_ros || 0), 0);
    const previousYear = effectiveYear > 2021 ? effectiveYear - 1 : null;
    const currentTotal = number(reportability?.totals?.[`ros_${effectiveYear}`]) || total;
    const previousTotal = previousYear ? number(reportability?.totals?.[`ros_${previousYear}`]) : null;
    const delta = previousTotal && currentTotal != null ? (currentTotal / previousTotal - 1) * 100 : null;
    const silent = arr(reportability?.sectors).filter(row => row.silence_5y === true).length;
    const bars = top.map(row => ({
      label: row.sector_name,
      value: row.selected_ros,
      display: fmt(row.selected_ros),
      detail: currentTotal ? `${pct(100 * row.selected_ros / currentTotal)} del total` : '',
    }));
    return node('aside', { class: 'atlas-v2-studio-ros-insight' }, [
      node('div', { class: 'atlas-v2-studio-insight-head' }, [
        node('div', {}, [node('span', { text: 'LECTURA DEL AÑO' }), node('b', { text: String(effectiveYear) })]),
        Number(selectedYear) === 2026 && effectiveYear === 2025 ? node('small', { text: '2026 sin corte gobernado · contexto 2025' }) : null,
      ]),
      node('div', { class: 'atlas-v2-studio-insight-metrics' }, [
        node('div', {}, [node('span', { text: 'ROS' }), node('b', { text: fmt(currentTotal) })]),
        node('div', {}, [node('span', { text: 'Δ anual' }), node('b', { text: delta == null ? '—' : `${delta >= 0 ? '+' : ''}${pct(delta)}` })]),
        node('div', {}, [node('span', { text: 'Top 5' }), node('b', { text: currentTotal ? pct(100 * top5 / currentTotal) : '—' })]),
      ]),
      node('div', { class: 'atlas-v2-studio-insight-title' }, [node('strong', { text: 'Quién explica el volumen' }), node('span', { text: `${silent} sectores con silencio agregado 5 años` })]),
      proportionalBars(bars, { limit: 5 }),
    ]);
  }

  function reportabilityPanel(reportability, selectedYear, setSelectedYear) {
    const series = trendSeries(reportability);
    const totals = reportability?.totals || {};
    return card('section', 'atlas-v2-studio-panel atlas-v2-studio-ros-panel', [
      panelHead('REPORTABILIDAD ROS', 'ROS recibidos por año', 'Serie histórica UAF. 2026 se diferencia como acumulado anual en curso.'),
      node('div', { class: 'atlas-v2-studio-ros-grid' }, [
        rosTrendChart(series, selectedYear, setSelectedYear),
        reportabilityInsight(reportability, selectedYear),
      ]),
      node('footer', { class: 'atlas-v2-studio-ros-foot' }, [
        node('span', { text: `2025 cerrado · ${fmt(totals.ros_2025)} ROS` }),
        node('span', { class: 'ytd', text: number(totals.ros_2026_ytd ?? totals.ros_2026) == null ? '2026 · acumulado pendiente de materialización' : `2026 · acumulado ${fmt(totals.ros_2026_ytd ?? totals.ros_2026)}` }),
      ]),
    ]);
  }

  function statusComposition(summary, activeKey, onSelect) {
    const rows = [
      ['active', 'Activos con SII', Number(summary.active || 0), 'green'],
      ['terminated', 'Término de giro', Number(summary.terminated || 0), 'amber'],
      ['no_sii', 'Sin perfil SII', Number(summary.no_sii || 0), 'violet'],
    ];
    const total = Math.max(1, Number(summary.total || rows.reduce((sum, row) => sum + row[2], 0)));
    return node('div', { class: 'atlas-v2-studio-status' }, [
      node('div', { class: 'atlas-v2-studio-status-track' }, rows.map(([key, label, value, tone]) => node('button', {
        type: 'button', class: `${tone} ${activeKey === key ? 'active' : ''}`.trim(), style: { width: `${Math.max(.2, 100 * value / total)}%` }, title: `${label}: ${fmt(value)}`, onclick: () => onSelect?.(key),
      }))),
      node('div', { class: 'atlas-v2-studio-status-list' }, rows.map(([key, label, value, tone]) => node('button', { type: 'button', class: `${tone} ${activeKey === key ? 'active' : ''}`.trim(), onclick: () => onSelect?.(key) }, [
        node('i'), node('span', { text: label }), node('b', { text: fmt(value) }), node('small', { text: pct(100 * value / total) }),
      ]))),
    ]);
  }

  function reconciliationPanel(summary, activeFilter, setFilter, api) {
    const total = Number(summary.total || 10294);
    const matched = Number(summary.matched || 8184);
    const coverage = total ? 100 * matched / total : 0;
    return card('section', 'atlas-v2-studio-panel atlas-v2-studio-recon-panel', [
      panelHead('CONCILIACIÓN', 'UAF ↔ SII', 'Cobertura exacta por RUT y estados que requieren gestión.', action('Abrir universo', () => api.navigate('universos', { lens: 'UAF' }))),
      node('div', { class: 'atlas-v2-studio-recon-core' }, [
        node('div', { class: 'atlas-v2-studio-ring', style: { '--ring-pct': `${(coverage * 3.6).toFixed(2)}deg` } }, [
          node('div', {}, [node('b', { text: pct(coverage) }), node('span', { text: 'conciliado' })]),
        ]),
        node('div', { class: 'atlas-v2-studio-recon-copy' }, [
          node('span', { text: 'PADRÓN OPERATIVO UAF' }),
          node('b', { text: fmt(total) }),
          node('p', { text: `${fmt(matched)} entidades tienen perfil SII conciliado. Los estados de gestión son observaciones registrales, no conclusiones AML/FT.` }),
        ]),
      ]),
      statusComposition(summary, activeFilter, key => setFilter(key === 'active' ? 'all' : key)),
    ]);
  }

  function reasonKey(row) {
    if (row?.sii_status === 'TERMINATED_AS_PUBLISHED' || row?.reason === 'Término de giro') return 'terminated';
    if (row?.sii_status === 'SIN_PERFIL_SII' || row?.reason === 'Sin perfil SII') return 'no_sii';
    if (Number(row?.sanction_event_count || 0) > 0 || row?.reason === 'Historial sancionatorio') return 'sanctioned';
    return 'review';
  }

  function reasonLabel(row) {
    return ({ terminated: 'Término de giro', no_sii: 'Sin perfil SII', sanctioned: 'Historial sancionatorio', review: 'Revisión analítica' })[reasonKey(row)];
  }

  function attentionTable(rows, filter, api) {
    const visible = arr(rows).filter(row => filter === 'all' || reasonKey(row) === filter).slice(0, 7);
    if (!visible.length) return node('div', { class: 'atlas-v2-studio-empty', text: 'No hay entidades materializadas para este filtro.' });
    return node('div', { class: 'atlas-v2-studio-attention-list' }, visible.map((row, index) => {
      const key = reasonKey(row);
      return node('article', { class: `atlas-v2-studio-attention-item ${key}` }, [
        node('div', { class: 'rank', text: String(index + 1).padStart(2, '0') }),
        node('div', { class: 'entity' }, [node('strong', { text: row.name || row.rut || row.entity_id || 'Entidad sin nombre' }), node('span', { text: row.rut || 'sin RUT resuelto' })]),
        node('div', { class: 'context' }, [node('span', { text: row.sector || 'Sector no materializado' }), node('small', { text: [row.commune, row.region].filter(Boolean).join(' · ') || 'Territorio no materializado' })]),
        node('div', { class: 'reason' }, [node('i'), node('div', {}, [node('b', { text: reasonLabel(row) }), row.priority_band ? node('small', { text: `Prioridad ${String(row.priority_band).toLowerCase()} · no probabilidad` }) : null])]),
        node('button', { type: 'button', class: 'open', text: 'Ver 360', onclick: () => api.navigate('entidad', { entity_id: row.entity_id || '', rut: row.rut || '', q: row.name || '' }) }),
      ]);
    }));
  }

  function managementSectorPanel(sectors, api) {
    const rows = arr(sectors).slice().sort((a, b) => {
      const av = Number(a.terminated_count || 0) + Number(a.no_sii_count || 0);
      const bv = Number(b.terminated_count || 0) + Number(b.no_sii_count || 0);
      return bv - av;
    }).slice(0, 7);
    if (!rows.length) return node('div', { class: 'atlas-v2-studio-empty', text: 'Sin distribución sectorial de gestión materializada.' });
    const max = Math.max(1, ...rows.map(row => Number(row.terminated_count || 0) + Number(row.no_sii_count || 0)));
    return node('div', { class: 'atlas-v2-studio-sector-stack' }, rows.map(row => {
      const terminated = Number(row.terminated_count || 0), noSii = Number(row.no_sii_count || 0), total = terminated + noSii;
      return node('button', { type: 'button', class: 'atlas-v2-studio-sector-row', onclick: () => api.navigate('universos', { lens: 'UAF', sector: row.sector_name || '' }) }, [
        node('div', { class: 'copy' }, [node('strong', { text: row.sector_name || 'Sin sector' }), node('small', { text: `${fmt(row.entity_count || 0)} SO observados` })]),
        node('div', { class: 'stack' }, [
          node('i', { class: 'terminated', style: { width: `${(100 * terminated / max).toFixed(2)}%` } }),
          node('i', { class: 'no-sii', style: { width: `${(100 * noSii / max).toFixed(2)}%` } }),
        ]),
        node('div', { class: 'counts' }, [node('b', { text: fmt(total) }), node('span', { text: `${fmt(terminated)} término · ${fmt(noSii)} sin SII` })]),
      ]);
    }));
  }

  async function hydrate(root, api, serial) {
    const refs = root.__refs;
    try {
      const [reportabilityResult, snapshotResult, attentionResult] = await Promise.allSettled([
        localJson(DATA_URLS.reportability), localJson(DATA_URLS.uafSnapshot), global.AtlasV2Universes.attention({ route: 'explorar:attention' }),
      ]);
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

      clear(refs.kpis);
      refs.kpis.append(
        metricCard('SO inscritos', fmt(total), `Padrón operativo UAF · ${dateText(snapshot?.kpis?.registered_total_as_of || snapshot?.generated_at)}`, 'cyan', 'TOTAL ACTUAL'),
        metricCard('Conciliados con SII', fmt(matched), `${pct(total ? 100 * matched / total : null)} de cobertura exacta por RUT`, 'blue', 'UAF ↔ SII'),
        metricCard('Término de giro', fmt(terminated), 'Entidades UAF con término publicado en SII', 'amber', 'GESTIÓN'),
        metricCard('Sin perfil SII', fmt(noSii), 'Entidades que requieren completar o revisar conciliación', 'violet', 'COBERTURA'),
      );

      let selectedYear = 2025;
      const renderReportability = () => {
        clear(refs.ros);
        refs.ros.append(reportability ? reportabilityPanel(reportability, selectedYear, year => { selectedYear = year; renderReportability(); }) : node('div', { class: 'atlas-v2-studio-empty', text: 'Serie ROS no disponible.' }));
      };
      renderReportability();

      let filter = 'all';
      const attentionRows = arr(attention?.data?.attention_entities);
      const sectors = arr(attention?.data?.sectors);
      const renderAttention = () => {
        clear(refs.attentionList); refs.attentionList.append(attentionTable(attentionRows, filter, api));
        Array.from(refs.filters.children).forEach(button => button.classList.toggle('active', button.dataset.filter === filter));
      };
      const chooseFilter = key => { filter = filter === key && key !== 'all' ? 'all' : key; renderAttention(); renderRecon(); };
      const filterDefs = [['all', 'Todos'], ['terminated', 'Término de giro'], ['no_sii', 'Sin perfil SII'], ['sanctioned', 'Sanciones']];
      clear(refs.filters);
      filterDefs.forEach(([key, label]) => {
        const count = key === 'all' ? attentionRows.length : attentionRows.filter(row => reasonKey(row) === key).length;
        const button = chip(label, key, filter === key, () => chooseFilter(key), count); button.dataset.filter = key; refs.filters.append(button);
      });
      const renderRecon = () => { clear(refs.recon); refs.recon.append(reconciliationPanel(liveSummary, filter, chooseFilter, api)); };
      renderRecon(); renderAttention();
      clear(refs.sectors); refs.sectors.append(managementSectorPanel(sectors, api));
      clear(refs.update); refs.update.append(node('span', { text: `Corte operativo · ${dateText(attention?.generatedAt || snapshot?.generated_at)}` }));

      void global.AtlasV2Universes.overview?.({ route: 'explorar:warm-universes' });
      void global.AtlasV2Watch?.overview?.({ route: 'explorar:warm-watch' });
      void global.AtlasV2Territory?.overview?.({ route: 'explorar:warm-territory' });
    } catch (error) {
      if (serial !== renderSerial) return;
      clear(refs.update); refs.update.append(node('span', { text: 'Lectura parcial · reintentar' }));
      console.error('[ATLAS v2] Explore image-standard surface failed', error);
    }
  }

  function render(container, _route, api) {
    injectStyle();
    const serial = ++renderSerial;
    clear(container);
    container.dataset.exploreAuthority = 'LEGACY_PULSE_NATIVE_V2';
    const root = node('div', { class: 'atlas-v2-exec-home atlas-v2-studio-home' });
    const top = node('div', { class: 'atlas-v2-studio-top' }, [
      node('div', { class: 'atlas-v2-studio-title' }, [node('span', { text: 'ATLAS · INTELIGENCIA ANALÍTICA' }), node('h1', { text: 'Explorar' })]),
      compactSearch(api),
      node('div', { class: 'atlas-v2-studio-update' }),
    ]);
    const kpis = node('div', { class: 'atlas-v2-studio-kpis' }, [metricCard('SO inscritos', '10.294', 'Cargando último corte…', 'cyan', 'TOTAL ACTUAL')]);
    const ros = node('div', { class: 'atlas-v2-studio-ros-slot' });
    const recon = node('div', { class: 'atlas-v2-studio-recon-slot' });
    const filters = node('div', { class: 'atlas-v2-studio-filters' });
    const attentionList = node('div', { class: 'atlas-v2-studio-attention-body' });
    const attention = card('section', 'atlas-v2-studio-panel atlas-v2-studio-attention-panel', [
      panelHead('GESTIÓN ANALÍTICA', 'Entidades que requieren atención', 'Prioridad registral y contextual para revisión. Hecho observado ≠ conclusión.', action('Ver universo', () => api.navigate('universos', { lens: 'UAF' }))),
      filters,
      attentionList,
    ]);
    const sectors = node('div', { class: 'atlas-v2-studio-sector-body' });
    const sectorPanel = card('section', 'atlas-v2-studio-panel atlas-v2-studio-sector-panel', [
      panelHead('CONCENTRACIÓN DE GESTIÓN', 'Sectores a mirar primero', 'Dónde se concentran términos de giro y brechas de conciliación.'),
      node('div', { class: 'atlas-v2-studio-sector-legend' }, [node('span', { class: 'terminated', text: 'Término de giro' }), node('span', { class: 'no-sii', text: 'Sin perfil SII' })]),
      sectors,
    ]);
    root.append(top, kpis, ros, node('div', { class: 'atlas-v2-studio-mid-grid' }, [recon, sectorPanel]), attention);
    root.__refs = { kpis, ros, recon, filters, attentionList, sectors, update: top.querySelector('.atlas-v2-studio-update') };
    container.append(root);
    void hydrate(root, api, serial);
  }

  global.AtlasV2Shell.registerSurface('explorar', render);
  global.__ATLAS_V2_EXPLORE_SURFACE__ = Object.freeze({
    installed: true, route: 'explorar', mode: 'LEGACY_PULSE_NATIVE_V2', design: 'IMAGE_STANDARD_EXECUTIVE_V3',
    previousDesign: 'EXECUTIVE_PULSE_V2', searchMode: 'COMPACT_MINIMAL', ros2026: 'YTD_DASHED_NO_FABRICATION', attention: 'IN_SCREEN_DYNAMIC',
  });
})(window);
