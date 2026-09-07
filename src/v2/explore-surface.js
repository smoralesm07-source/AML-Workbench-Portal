'use strict';

(function installAtlasV2ExploreSurface(global) {
  if (global.__ATLAS_V2_EXPLORE_SURFACE__) return;

  const scriptBase = new URL('./', document.currentScript?.src || document.baseURI);
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const DATA_URLS = Object.freeze({
    reportability: new URL('../data/uaf_reportability_sector_2025.json', scriptBase).href,
    uafSnapshot: new URL('../data/uaf_dashboard_snapshot.json', scriptBase).href,
  });
  const localCache = new Map();
  let renderSerial = 0;

  function node(tag, attrs = {}, children = []) {
    const element = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value == null) return;
      if (key === 'class') element.className = value;
      else if (key === 'text') element.textContent = String(value);
      else if (key === 'dataset' && value && typeof value === 'object') Object.entries(value).forEach(([name, entry]) => { element.dataset[name] = String(entry); });
      else if (key === 'style' && value && typeof value === 'object') Object.assign(element.style, value);
      else if (key.startsWith('on') && typeof value === 'function') element.addEventListener(key.slice(2).toLowerCase(), value);
      else element.setAttribute(key, String(value));
    });
    (Array.isArray(children) ? children : [children]).flat().forEach(child => {
      if (child == null) return;
      element.append(child instanceof Node ? child : document.createTextNode(String(child)));
    });
    return element;
  }

  function svgNode(tag, attrs = {}) {
    const element = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([key, value]) => { if (value != null) element.setAttribute(key, String(value)); });
    return element;
  }

  function clear(element) { while (element?.firstChild) element.removeChild(element.firstChild); }
  function arr(value) { return Array.isArray(value) ? value : []; }
  function numeric(value) { const n = Number(value); return Number.isFinite(n) ? n : null; }
  function fmt(value, digits = 0) {
    const n = numeric(value);
    return n == null ? '—' : n.toLocaleString('es-CL', { maximumFractionDigits: digits, minimumFractionDigits: digits });
  }
  function compact(value) {
    const n = numeric(value);
    if (n == null) return '—';
    if (Math.abs(n) >= 1e6) return `${(n / 1e6).toLocaleString('es-CL', { maximumFractionDigits: 2 })} M`;
    if (Math.abs(n) >= 1e3) return `${(n / 1e3).toLocaleString('es-CL', { maximumFractionDigits: 1 })} mil`;
    return fmt(n);
  }
  function pct(value, digits = 1) {
    const n = numeric(value);
    return n == null ? '—' : `${n.toLocaleString('es-CL', { maximumFractionDigits: digits, minimumFractionDigits: digits })}%`;
  }
  function dateText(value) {
    if (!value) return 'corte no informado';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('es-CL');
  }

  function injectStyle() {
    if (document.getElementById('atlas-v2-explore-style')) return;
    document.head.appendChild(node('link', {
      id: 'atlas-v2-explore-style',
      rel: 'stylesheet',
      href: new URL('explore-surface.css?v=legacy-pulse-native-1', scriptBase).href,
    }));
  }

  async function localJson(url) {
    if (localCache.has(url)) return localCache.get(url);
    const request = fetch(url, { cache: 'no-store', headers: { accept: 'application/json' } }).then(async response => {
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      return response.json();
    });
    localCache.set(url, request);
    try { return await request; }
    catch (error) { localCache.delete(url); throw error; }
  }

  function looksLikeRut(value) {
    return /^\d{1,2}\.?\d{3}\.?\d{3}-?[0-9kK]$/.test(String(value || '').replace(/\s/g, ''));
  }

  function routeQuery(api, raw) {
    const query = String(raw || '').trim();
    if (!query) return;
    if (looksLikeRut(query)) return api.navigate('entidad', { rut: query });
    const normalized = query.toLocaleLowerCase('es-CL');
    if (/compra|proveedor|licit|gasto|presupuesto/.test(normalized)) return api.navigate('gasto-publico', { q: query });
    if (/comuna|regi[oó]n|territor|geograf/.test(normalized)) return api.navigate('territorio', { q: query });
    if (/relaci|red|v[ií]ncul|representante|socio/.test(normalized)) return api.navigate('relaciones', { q: query });
    return api.navigate('entidad', { q: query });
  }

  function compactSearch(api) {
    const input = node('input', {
      type: 'search',
      placeholder: 'RUT, entidad o tema…',
      autocomplete: 'off',
      spellcheck: 'false',
      'aria-label': 'Buscar en Atlas',
    });
    const run = () => routeQuery(api, input.value);
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); run(); }
    });
    return node('div', { class: 'atlas-v2-home-search' }, [
      node('span', { class: 'atlas-v2-home-search-icon', text: '⌕', 'aria-hidden': 'true' }),
      input,
      node('button', { type: 'button', class: 'atlas-v2-home-search-go', text: 'Buscar', onclick: run }),
    ]);
  }

  function metaChip(label, value, tone = '') {
    return node('span', { class: `atlas-v2-pulse-meta-chip ${tone}`.trim() }, [
      node('i'), node('b', { text: label }), value ? ` ${value}` : '',
    ]);
  }

  function pulseHead(kicker, title, meta = [], action = null) {
    return node('div', { class: 'atlas-v2-pulse-head' }, [
      node('div', { class: 'atlas-v2-pulse-title-wrap' }, [
        node('span', { class: 'atlas-v2-pulse-kicker', text: kicker }),
        node('h1', { class: 'atlas-v2-pulse-title', text: title }),
      ]),
      node('div', { class: 'atlas-v2-pulse-head-right' }, [
        node('div', { class: 'atlas-v2-pulse-meta' }, meta),
        action,
      ]),
    ]);
  }

  function actionButton(label, handler) {
    return node('button', { class: 'atlas-v2-pulse-action', type: 'button', text: `${label} →`, onclick: handler });
  }

  function kpi(label, value, detail = '', tone = '') {
    return node('article', { class: `atlas-v2-pulse-kpi ${tone}`.trim() }, [
      node('span', { text: label }),
      node('b', { text: value }),
      detail ? node('small', { text: detail }) : null,
    ]);
  }

  function skeleton(title = 'Cargando lectura…') {
    return node('article', { class: 'atlas-v2-home-skeleton', 'aria-busy': 'true' }, [
      node('strong', { text: title }),
      node('div', { class: 'atlas-v2-home-skeleton-block' }),
    ]);
  }

  function errorPanel(title, detail = 'La lectura no respondió en esta ejecución.') {
    return node('article', { class: 'atlas-v2-home-error' }, [
      node('span', { class: 'atlas-v2-pulse-kicker', text: 'NO DISPONIBLE' }),
      node('h3', { text: title }),
      node('p', { text: detail }),
    ]);
  }

  function areaLineChart(items, selectedLabel, onSelect) {
    const rows = arr(items).filter(item => numeric(item.value) != null);
    const width = 1120;
    const height = 196;
    const pad = { left: 52, right: 28, top: 24, bottom: 30 };
    const maxValue = Math.max(1, ...rows.map(row => Number(row.value)));
    const max = maxValue * 1.12;
    const x = index => pad.left + (rows.length <= 1 ? 0 : index * ((width - pad.left - pad.right) / (rows.length - 1)));
    const y = value => pad.top + (max - Number(value)) / max * (height - pad.top - pad.bottom);
    const root = node('div', { class: 'atlas-v2-pulse-line-wrap' });
    const svg = svgNode('svg', { class: 'atlas-v2-pulse-svg', viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': 'Evolución anual de reportabilidad ROS' });

    [0, .5, 1].forEach(frac => {
      const gy = pad.top + frac * (height - pad.top - pad.bottom);
      svg.append(svgNode('line', { x1: pad.left, y1: gy, x2: width - pad.right, y2: gy, class: 'grid' }));
    });
    const points = rows.map((row, index) => `${x(index).toFixed(1)},${y(row.value).toFixed(1)}`).join(' ');
    if (rows.length > 1) {
      const areaPoints = `${points} ${x(rows.length - 1).toFixed(1)},${(height - pad.bottom).toFixed(1)} ${x(0).toFixed(1)},${(height - pad.bottom).toFixed(1)}`;
      svg.append(svgNode('polygon', { points: areaPoints, class: 'area' }));
      svg.append(svgNode('polyline', { points, class: 'line' }));
    }

    rows.forEach((row, index) => {
      const cx = x(index);
      const cy = y(row.value);
      const selected = String(row.label) === String(selectedLabel);
      const group = svgNode('g', { class: selected ? 'point selected' : 'point', tabindex: '0', role: 'button', 'aria-label': `${row.label}: ${row.display || fmt(row.value)} ROS` });
      group.append(svgNode('circle', { cx, cy, r: 14, class: 'hit' }));
      group.append(svgNode('circle', { cx, cy, r: selected ? 6 : 4.5, class: 'dot' }));
      const valueLabel = svgNode('text', { x: cx, y: cy - 12, 'text-anchor': index === 0 ? 'start' : index === rows.length - 1 ? 'end' : 'middle', class: 'value' });
      valueLabel.textContent = row.display || fmt(row.value);
      group.append(valueLabel);
      const axisLabel = svgNode('text', { x: cx, y: height - 8, 'text-anchor': index === 0 ? 'start' : index === rows.length - 1 ? 'end' : 'middle', class: 'axis' });
      axisLabel.textContent = String(row.label);
      group.append(axisLabel);
      const activate = () => onSelect?.(row);
      group.addEventListener('click', activate);
      group.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(); }
      });
      svg.append(group);
    });
    root.append(svg);
    return root;
  }

  function proportionalBars(items, options = {}) {
    const rows = arr(items).filter(item => numeric(item.value) != null && Number(item.value) >= 0).slice(0, options.limit || 7);
    const max = Math.max(1, ...rows.map(item => Number(item.value)));
    if (!rows.length) return node('div', { class: 'atlas-v2-home-empty', text: 'Sin datos comparables.' });
    return node('div', { class: 'atlas-v2-pulse-bars' }, rows.map(item => {
      const ratio = Math.max(0, Math.min(1, Number(item.value) / max));
      const tag = typeof options.onSelect === 'function' ? 'button' : 'div';
      return node(tag, {
        class: 'atlas-v2-pulse-bar-row',
        ...(tag === 'button' ? { type: 'button', onclick: () => options.onSelect(item) } : {}),
      }, [
        node('div', { class: 'atlas-v2-pulse-bar-label' }, [node('strong', { text: item.label }), item.detail ? node('small', { text: item.detail }) : null]),
        node('div', { class: 'atlas-v2-pulse-bar-track' }, [node('i', { style: { width: `${(ratio * 100).toFixed(2)}%` } })]),
        node('b', { text: item.display ?? fmt(item.value) }),
      ]);
    }));
  }

  function reportabilityPanel(data, api) {
    const totals = data?.totals || {};
    const sectors = arr(data?.sectors);
    const years = [2021, 2022, 2023, 2024, 2025];
    const series = years.map(year => ({ label: String(year), year, value: Number(totals[`ros_${year}`] || 0), display: fmt(totals[`ros_${year}`]) }));
    const ros2025 = Number(totals.ros_2025 || 0);
    const ros2024 = Number(totals.ros_2024 || 0);
    const registered = Number(totals.registered_so_2025 || 0);
    const delta = ros2024 > 0 ? 100 * (ros2025 / ros2024 - 1) : null;
    const silent5y = sectors.filter(row => row?.silence_5y === true).length;
    const top2025 = sectors.slice().sort((a, b) => Number(b.ros_2025 || 0) - Number(a.ros_2025 || 0))[0];
    const topShare2025 = ros2025 > 0 ? 100 * Number(top2025?.ros_2025 || 0) / ros2025 : null;
    let selectedYear = 2025;

    const panel = node('section', { class: 'atlas-v2-home-pulse atlas-v2-home-reportability' });
    panel.append(
      pulseHead('SUPERVISIÓN Y REPORTABILIDAD · CHILE', 'Reportabilidad ROS', [
        metaChip('Serie', '2021–2025'),
        metaChip('Corte', '2025'),
        metaChip('Fuente', 'UAF', 'source'),
      ], actionButton('Abrir universo UAF', () => api.navigate('universos', { lens: 'UAF' }))),
      node('div', { class: 'atlas-v2-pulse-kpis' }, [
        kpi('ROS recibidos · 2025', fmt(ros2025), delta == null ? 'último corte anual' : `${delta >= 0 ? '+' : ''}${pct(delta)} vs 2024`, 'primary'),
        kpi('ROS · 2021–2025', fmt(totals.ros_total_2021_2025), 'acumulado quinquenal'),
        kpi('SO inscritos · 2025', fmt(registered), 'padrón estadístico UAF'),
        kpi('Concentración líder', pct(topShare2025), top2025?.sector_name || 'sin sector', 'focus'),
        kpi('Sectores sin ROS · 5 años', fmt(silent5y), 'silencio agregado; requiere contexto', silent5y ? 'warning' : ''),
      ]),
    );

    const chartSlot = node('div', { class: 'atlas-v2-home-chart-slot' });
    const rankSlot = node('div', { class: 'atlas-v2-home-rank-slot' });
    const yearTabs = node('div', { class: 'atlas-v2-home-year-tabs', role: 'tablist', 'aria-label': 'Año de análisis sectorial' });
    const insight = node('div', { class: 'atlas-v2-home-insight' });

    function renderSelection() {
      clear(chartSlot); clear(rankSlot); clear(yearTabs); clear(insight);
      chartSlot.append(areaLineChart(series, selectedYear, item => { selectedYear = Number(item.year); renderSelection(); }));
      years.forEach(year => yearTabs.append(node('button', {
        type: 'button',
        role: 'tab',
        'aria-selected': year === selectedYear ? 'true' : 'false',
        class: year === selectedYear ? 'active' : '',
        text: String(year),
        onclick: () => { selectedYear = year; renderSelection(); },
      })));
      const key = `ros_${selectedYear}`;
      const yearTotal = Number(totals[key] || 0);
      const ranking = sectors
        .filter(row => Number(row?.[key] || 0) > 0)
        .sort((a, b) => Number(b[key] || 0) - Number(a[key] || 0))
        .slice(0, 7)
        .map(row => ({
          label: row.sector_name,
          value: Number(row[key] || 0),
          display: fmt(row[key]),
          detail: yearTotal > 0 ? `${pct(100 * Number(row[key] || 0) / yearTotal)} del total` : '',
        }));
      rankSlot.append(proportionalBars(ranking, { limit: 7 }));
      const leader = ranking[0];
      const previous = series.find(item => item.year === selectedYear - 1);
      const current = series.find(item => item.year === selectedYear);
      const yoy = previous?.value > 0 ? 100 * (current.value / previous.value - 1) : null;
      insight.append(
        node('span', { text: `Año seleccionado · ${selectedYear}` }),
        node('b', { text: `${fmt(current?.value || 0)} ROS` }),
        node('small', { text: `${yoy == null ? 'sin comparación anual' : `${yoy >= 0 ? '+' : ''}${pct(yoy)} vs ${selectedYear - 1}`} · líder: ${leader?.label || '—'}` }),
      );
    }

    panel.append(node('div', { class: 'atlas-v2-home-report-grid' }, [
      node('article', { class: 'atlas-v2-pulse-chart-card' }, [
        node('div', { class: 'atlas-v2-pulse-card-head' }, [
          node('div', {}, [node('span', { class: 'atlas-v2-pulse-kicker', text: 'EVOLUCIÓN' }), node('h3', { text: 'ROS recibidos por año' })]),
          yearTabs,
        ]),
        chartSlot,
        insight,
      ]),
      node('article', { class: 'atlas-v2-pulse-rank-card' }, [
        node('div', { class: 'atlas-v2-pulse-card-head' }, [
          node('div', {}, [node('span', { class: 'atlas-v2-pulse-kicker', text: 'CONCENTRACIÓN SECTORIAL' }), node('h3', { text: 'Quién explica el volumen' })]),
          node('span', { class: 'atlas-v2-pulse-mini-chip', text: 'selecciona un año' }),
        ]),
        rankSlot,
      ]),
    ]));
    panel.append(node('div', { class: 'atlas-v2-pulse-foot' }, [
      node('span', { text: 'El volumen ROS describe reportabilidad agregada; no equivale a calidad, incumplimiento ni riesgo individual.' }),
      node('span', { text: `${data?.generated_from || 'Fuente UAF'} · ${data?.period || '2021–2025'}` }),
    ]));
    renderSelection();
    return panel;
  }

  function statusComposition(rows, api) {
    const total = rows.reduce((sum, item) => sum + Math.max(0, Number(item.value || 0)), 0);
    const track = node('div', { class: 'atlas-v2-recon-track' });
    rows.forEach((item, index) => {
      if (!item.value || !total) return;
      track.append(node('button', {
        type: 'button',
        class: `tone-${index}`,
        style: { width: `${(100 * item.value / total).toFixed(3)}%` },
        title: `${item.label}: ${fmt(item.value)}`,
        'aria-label': `${item.label}: ${fmt(item.value)}`,
        onclick: () => api.navigate('universos', { lens: 'UAF', sii_status: item.status }),
      }));
    });
    const legend = node('div', { class: 'atlas-v2-recon-legend' }, rows.map((item, index) => node('button', {
      type: 'button',
      onclick: () => api.navigate('universos', { lens: 'UAF', sii_status: item.status }),
    }, [node('i', { class: `tone-${index}` }), node('span', { text: item.label }), node('b', { text: fmt(item.value) }), node('small', { text: total ? pct(100 * item.value / total) : '—' })])));
    return node('div', { class: 'atlas-v2-recon-composition' }, [track, legend]);
  }

  function miniColumns(items) {
    const rows = arr(items).filter(item => numeric(item.value) != null && Number(item.value) >= 0);
    const max = Math.max(1, ...rows.map(item => Number(item.value)));
    return node('div', { class: 'atlas-v2-mini-columns' }, rows.map(item => {
      const ratio = Math.max(.035, Number(item.value) / max);
      return node('div', { class: 'atlas-v2-mini-column' }, [
        node('b', { text: item.display ?? fmt(item.value) }),
        node('div', { class: 'atlas-v2-mini-column-track' }, [node('i', { style: { height: `${(ratio * 100).toFixed(2)}%` } })]),
        node('span', { text: item.label }),
      ]);
    }));
  }

  function attentionPanel(out, dashboard, api) {
    const summary = out?.summary || {};
    const total = Number(summary.total || 0);
    const matched = Number(summary.matched || 0);
    const terminated = Number(summary.terminated || 0);
    const noSii = Number(summary.no_sii || 0);
    const active = Number(summary.active || 0);
    const operational = Number(dashboard?.kpis?.registered_total_latest || 0) || total;
    const coverage = total > 0 ? 100 * matched / total : null;
    const rows = [
      { label: 'Activos en SII', value: active, status: 'ACTIVE' },
      { label: 'Término de giro', value: terminated, status: 'TERMINATED' },
      { label: 'Sin perfil SII', value: noSii, status: 'NO_SII' },
    ];
    const sectorRows = arr(out?.sectors)
      .filter(row => Number(row?.terminated_count || 0) > 0)
      .sort((a, b) => Number(b.terminated_count || 0) - Number(a.terminated_count || 0))
      .slice(0, 7)
      .map(row => ({
        label: row.sector_name,
        value: Number(row.terminated_count || 0),
        display: fmt(row.terminated_count),
        detail: `${pct(row.terminated_pct || (Number(row.entity_count || 0) ? 100 * Number(row.terminated_count || 0) / Number(row.entity_count) : 0))} del sector`,
      }));
    const years = arr(out?.terminatedByYear)
      .slice()
      .sort((a, b) => Number(a.termination_year || 0) - Number(b.termination_year || 0))
      .filter(item => Number(item.termination_year || 0) >= 2019)
      .map(item => ({ label: String(item.termination_year), value: Number(item.entity_count || 0), display: fmt(item.entity_count) }));

    return node('section', { class: 'atlas-v2-home-pulse atlas-v2-home-reconciliation' }, [
      pulseHead('CONCILIACIÓN DE PADRONES · UAF ↔ SII', 'Vigencia tributaria de sujetos obligados', [
        metaChip('Cruce', 'RUT'),
        metaChip('Cobertura', pct(coverage)),
        metaChip('Estado', 'operativo', 'source'),
      ], actionButton('Abrir universo UAF', () => api.navigate('universos', { lens: 'UAF' }))),
      node('div', { class: 'atlas-v2-pulse-kpis atlas-v2-pulse-kpis-four' }, [
        kpi('Padrón operativo UAF', fmt(operational), dashboard?.kpis?.registered_total_as_of ? `corte ${dateText(dashboard.kpis.registered_total_as_of)}` : 'último corte disponible', 'primary'),
        kpi('Conciliados con SII', fmt(matched), coverage == null ? 'cruce por RUT' : `${pct(coverage)} del universo`),
        kpi('Término de giro', fmt(terminated), total ? `${pct(100 * terminated / total)} del padrón` : 'estado tributario', terminated ? 'warning' : ''),
        kpi('Sin perfil SII', fmt(noSii), total ? `${pct(100 * noSii / total)} requiere revisión` : 'requiere revisión', 'focus'),
      ]),
      node('div', { class: 'atlas-v2-recon-grid' }, [
        node('article', { class: 'atlas-v2-pulse-card atlas-v2-recon-status-card' }, [
          node('div', { class: 'atlas-v2-pulse-card-head' }, [node('div', {}, [node('span', { class: 'atlas-v2-pulse-kicker', text: 'ESTADO DEL PADRÓN' }), node('h3', { text: 'Distribución UAF según SII' })])]),
          statusComposition(rows, api),
          node('p', { class: 'atlas-v2-pulse-note', text: 'Selecciona un estado para abrir el universo correspondiente. Término de giro es una condición tributaria y no una conclusión AML/FT.' }),
        ]),
        node('article', { class: 'atlas-v2-pulse-card' }, [
          node('div', { class: 'atlas-v2-pulse-card-head' }, [node('div', {}, [node('span', { class: 'atlas-v2-pulse-kicker', text: 'EVOLUCIÓN' }), node('h3', { text: 'Términos de giro observados' })])]),
          miniColumns(years),
        ]),
        node('article', { class: 'atlas-v2-pulse-card atlas-v2-recon-sector-card' }, [
          node('div', { class: 'atlas-v2-pulse-card-head' }, [node('div', {}, [node('span', { class: 'atlas-v2-pulse-kicker', text: 'CONCENTRACIÓN' }), node('h3', { text: 'Sectores con más términos de giro' })])]),
          proportionalBars(sectorRows, { limit: 7 }),
        ]),
        node('article', { class: 'atlas-v2-pulse-card atlas-v2-recon-recent-card' }, [
          node('div', { class: 'atlas-v2-pulse-card-head' }, [node('div', {}, [node('span', { class: 'atlas-v2-pulse-kicker', text: 'RECIENTES' }), node('h3', { text: 'Últimos términos observados' })])]),
          node('div', { class: 'atlas-v2-recent-list' }, arr(out?.recentTerminated).slice(0, 5).map(item => node('button', {
            type: 'button',
            onclick: () => api.navigate('entidad', { entity_id: item.entity_id || '', rut: item.rut || '', q: item.resolved_name || '' }),
          }, [
            node('span', {}, [node('strong', { text: item.resolved_name || item.rut || 'Entidad' }), node('small', { text: `${dateText(item.termination_date)} · ${item.uaf_sector_label || 'sector UAF'}` })]),
            node('b', { text: '→' }),
          ]))),
        ]),
      ]),
      node('div', { class: 'atlas-v2-pulse-foot' }, [node('span', { text: 'Conciliación por RUT para detectar vigencia tributaria y casos que ameritan revisión.' }), node('span', { text: dateText(out?.generatedAt) })]),
    ]);
  }

  function contextCard(kicker, title, value, detail, actionLabel, handler, tone = '') {
    return node('button', { type: 'button', class: `atlas-v2-context-card ${tone}`.trim(), onclick: handler }, [
      node('span', { class: 'atlas-v2-pulse-kicker', text: kicker }),
      node('div', { class: 'atlas-v2-context-value', text: value }),
      node('h3', { text: title }),
      node('p', { text: detail }),
      node('b', { text: `${actionLabel} →` }),
    ]);
  }

  function contextDeck(universes, watch, territory, spend, api) {
    const universeItems = arr(universes?.items).filter(item => Number(item.total_count || 0) > 0);
    const watchSummary = watch?.summary || {};
    const topRegion = arr(territory?.items).filter(item => item.region).sort((a, b) => Number(b.igr_mean || 0) - Number(a.igr_mean || 0))[0];
    const procurement = spend?.data?.domains?.procurement?.summary || {};
    return node('section', { class: 'atlas-v2-home-context' }, [
      node('div', { class: 'atlas-v2-home-context-head' }, [
        node('div', {}, [node('span', { class: 'atlas-v2-pulse-kicker', text: 'CAPAS DE PROFUNDIZACIÓN' }), node('h2', { text: 'Abrir sólo cuando el pulso lo justifique' })]),
        node('small', { text: 'Atajos analíticos; sin mezclar señales entre dominios.' }),
      ]),
      node('div', { class: 'atlas-v2-context-grid' }, [
        contextCard('UNIVERSOS', 'Cobertura ATLAS', fmt(universeItems.length), 'universos materializados disponibles para explorar y filtrar.', 'Explorar universos', () => api.navigate('universos'), 'blue'),
        contextCard('VIGILANCIA', 'Señales vigentes', fmt(watchSummary.alert_count), `${fmt(watchSummary.very_high_count)} de severidad muy alta · ${fmt(watchSummary.high_count)} alta.`, 'Abrir vigilancia', () => api.navigate('vigilancia'), 'amber'),
        contextCard('TERRITORIO', topRegion?.region || 'Contexto geográfico', topRegion ? fmt(topRegion.igr_mean, 1) : '—', topRegion ? `IGR medio más alto observado · ${fmt(topRegion.commune_count)} comunas.` : 'Sin lectura territorial disponible.', 'Abrir territorio', () => api.navigate('territorio'), 'green'),
        contextCard('GASTO PÚBLICO', 'Proveedores observados', compact(procurement.supplier_count), `${compact(procurement.buyer_count)} compradores en el dominio de compras públicas.`, 'Abrir gasto público', () => api.navigate('gasto-publico'), 'violet'),
      ]),
    ]);
  }

  async function timed(label, reader) {
    const started = performance.now();
    try { return { label, status: 'fulfilled', value: await reader(), ms: Math.round(performance.now() - started) }; }
    catch (reason) { return { label, status: 'rejected', reason, ms: Math.round(performance.now() - started) }; }
  }

  async function hydrate(root, api, serial) {
    const reportSlot = root.querySelector('[data-slot="reportability"]');
    const attentionSlot = root.querySelector('[data-slot="attention"]');
    const contextSlot = root.querySelector('[data-slot="context"]');
    const results = await Promise.all([
      timed('reportability', () => localJson(DATA_URLS.reportability)),
      timed('uafSnapshot', () => localJson(DATA_URLS.uafSnapshot)),
      timed('attention', () => global.AtlasV2Universes.attention({ route: 'explorar:legacy-pulse:uaf-sii' })),
      timed('universes', () => global.AtlasV2Universes.overview({ route: 'explorar:legacy-pulse:universes' })),
      timed('watch', () => global.AtlasV2Watch.overview({ route: 'explorar:legacy-pulse:watch' })),
      timed('territory', () => global.AtlasV2Territory.overview({ route: 'explorar:legacy-pulse:territory' })),
      timed('spend', () => global.AtlasV2Access.data().publicSpend.monitor({ route: 'explorar:legacy-pulse:spend' })),
    ]);
    if (serial !== renderSerial || !root.isConnected) return;
    const by = label => results.find(item => item.label === label);

    clear(reportSlot);
    const report = by('reportability');
    reportSlot.append(report?.status === 'fulfilled' ? reportabilityPanel(report.value, api) : errorPanel('Reportabilidad ROS', 'No fue posible leer el snapshot estadístico UAF 2021–2025.'));

    clear(attentionSlot);
    const attention = by('attention');
    const dashboard = by('uafSnapshot');
    attentionSlot.append(attention?.status === 'fulfilled' ? attentionPanel(attention.value, dashboard?.status === 'fulfilled' ? dashboard.value : null, api) : errorPanel('Conciliación UAF ↔ SII', attention?.reason?.message || 'No fue posible consultar el read model de conciliación.'));

    clear(contextSlot);
    const universes = by('universes');
    const watch = by('watch');
    const territory = by('territory');
    const spend = by('spend');
    contextSlot.append(contextDeck(
      universes?.status === 'fulfilled' ? universes.value : null,
      watch?.status === 'fulfilled' ? watch.value : null,
      territory?.status === 'fulfilled' ? territory.value : null,
      spend?.status === 'fulfilled' ? spend.value : null,
      api,
    ));

    global.__ATLAS_V2_EXPLORE_DIAGNOSTICS__ = Object.freeze({
      checkedAt: new Date().toISOString(),
      mode: 'LEGACY_PULSE_NATIVE_V2',
      timings: Object.freeze(Object.fromEntries(results.map(item => [item.label, { status: item.status, ms: item.ms }]))),
    });
  }

  function render(container, _route, api) {
    injectStyle();
    const serial = ++renderSerial;
    clear(container);
    container.dataset.exploreAuthority = 'LEGACY_PULSE_NATIVE_V2';
    const root = node('div', { class: 'atlas-v2-home' });
    root.append(
      compactSearch(api),
      node('div', { class: 'atlas-v2-home-slot', dataset: { slot: 'reportability' } }, [skeleton('Recuperando reportabilidad ROS…')]),
      node('div', { class: 'atlas-v2-home-slot', dataset: { slot: 'attention' } }, [skeleton('Conciliando padrón UAF con SII…')]),
      node('div', { class: 'atlas-v2-home-slot', dataset: { slot: 'context' } }, [skeleton('Preparando capas de profundización…')]),
    );
    container.append(root);
    void hydrate(root, api, serial);
  }

  global.AtlasV2Shell.registerSurface('explorar', render);
  global.__ATLAS_V2_EXPLORE_SURFACE__ = Object.freeze({
    installed: true,
    route: 'explorar',
    mode: 'LEGACY_PULSE_NATIVE_V2',
    searchMode: 'COMPACT_MINIMAL',
    reportabilitySource: 'UAF_SECTOR_REPORTABILITY_V1',
    attentionSource: 'ATLAS_UNIVERSES_QUERY_V2',
    legacyVisualReference: 'atlas-strategic-pulse',
  });
})(window);
