'use strict';

(function installAtlasV2ExploreBaseline(global) {
  if (global.__ATLAS_V2_EXPLORE_BASELINE__) return;

  const VERSION = 'v2-primary-7-explorar-baseline-1';
  const scriptBase = new URL('./', document.currentScript?.src || document.baseURI);
  const DATA_URLS = Object.freeze({
    reportability: new URL('../data/uaf_reportability_sector_2025.json', scriptBase).href,
    uafSnapshot: new URL('../data/uaf_dashboard_snapshot.json', scriptBase).href,
  });
  const NF = new Intl.NumberFormat('es-CL');
  let renderSerial = 0;
  const cache = new Map();

  function node(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value == null) return;
      if (key === 'class') el.className = value;
      else if (key === 'text') el.textContent = String(value);
      else if (key === 'dataset' && value && typeof value === 'object') Object.entries(value).forEach(([name, entry]) => { el.dataset[name] = String(entry); });
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
  function arr(value) { return Array.isArray(value) ? value : []; }
  function num(value) { const n = Number(value); return Number.isFinite(n) ? n : null; }
  function fmt(value, digits = 0) { const n = num(value); return n == null ? '—' : n.toLocaleString('es-CL', { maximumFractionDigits: digits, minimumFractionDigits: digits }); }
  function compact(value) {
    const n = num(value);
    if (n == null) return '—';
    if (Math.abs(n) >= 1e6) return `${(n / 1e6).toLocaleString('es-CL', { maximumFractionDigits: 2 })} M`;
    if (Math.abs(n) >= 1e3) return `${(n / 1e3).toLocaleString('es-CL', { maximumFractionDigits: 1 })} mil`;
    return NF.format(n);
  }
  function pct(value, digits = 1) { const n = num(value); return n == null ? '—' : `${n.toLocaleString('es-CL', { maximumFractionDigits: digits, minimumFractionDigits: digits })}%`; }
  function dateText(value) {
    if (!value) return 'corte no informado';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('es-CL');
  }

  async function localJson(url) {
    if (cache.has(url)) return cache.get(url);
    const request = fetch(url, { cache: 'no-store', headers: { accept: 'application/json' } }).then(async response => {
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      return response.json();
    });
    cache.set(url, request);
    try { return await request; }
    catch (error) { cache.delete(url); throw error; }
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
    input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); run(); } });
    return node('section', { class: 'exb-search' }, [
      node('div', { class: 'exb-search-label' }, [node('span', { class: 'exb-eyebrow', text: 'EXPLORAR' }), node('strong', { text: 'Atlas' })]),
      node('div', { class: 'exb-search-box' }, [node('span', { class: 'exb-search-icon', text: '⌕', 'aria-hidden': 'true' }), input, node('button', { type: 'button', class: 'exb-search-go', text: 'Buscar', onclick: run })]),
    ]);
  }

  function sectionHead(index, tag, title, subtitle, action) {
    return node('header', { class: 'exb-section-head' }, [
      node('span', { class: 'exb-index', text: index }),
      node('div', { class: 'exb-section-copy' }, [node('span', { class: 'exb-eyebrow', text: tag }), node('h2', { text: title }), subtitle ? node('p', { text: subtitle }) : null]),
      action || null,
    ]);
  }

  function actionButton(label, handler) {
    return node('button', { class: 'exb-link', type: 'button', text: `${label} →`, onclick: handler });
  }

  function metric(label, value, detail = '', cls = '') {
    return node('div', { class: `exb-metric ${cls}`.trim() }, [node('span', { text: label }), node('b', { text: value }), detail ? node('small', { text: detail }) : null]);
  }

  function skeleton(title = 'Cargando lectura…') {
    return node('article', { class: 'exb-panel exb-loading', 'aria-busy': 'true' }, [node('strong', { text: title }), node('div', { class: 'exb-skeleton wide' }), node('div', { class: 'exb-skeleton short' })]);
  }

  function errorPanel(title, detail = 'La lectura no respondió en esta ejecución.') {
    return node('article', { class: 'exb-panel exb-error' }, [node('span', { class: 'exb-eyebrow', text: 'NO DISPONIBLE' }), node('h3', { text: title }), node('p', { text: detail })]);
  }

  function reportabilityPanel(data, api) {
    const totals = data?.totals || {};
    const sectors = arr(data?.sectors);
    const series = [2021, 2022, 2023, 2024, 2025].map(year => ({
      label: String(year),
      value: Number(totals[`ros_${year}`] || 0),
      display: fmt(totals[`ros_${year}`]),
      year,
    }));
    const ros2025 = Number(totals.ros_2025 || 0);
    const ros2024 = Number(totals.ros_2024 || 0);
    const registered = Number(totals.registered_so_2025 || 0);
    const delta = ros2024 > 0 ? 100 * (ros2025 / ros2024 - 1) : null;
    const intensity = registered > 0 ? ros2025 / registered : null;
    const silent5y = sectors.filter(row => row?.silence_5y === true).length;
    const zero2025 = sectors.filter(row => Number(row?.ros_2025 || 0) === 0).length;
    const top = sectors.filter(row => Number(row?.ros_2025 || 0) > 0).sort((a, b) => Number(b.ros_2025 || 0) - Number(a.ros_2025 || 0)).slice(0, 8);
    const topShare = ros2025 > 0 && top.length ? 100 * Number(top[0].ros_2025 || 0) / ros2025 : null;

    const panel = node('section', { class: 'exb-section exb-reportability' }, [
      sectionHead('01', 'REPORTABILIDAD ROS', 'Evolución y concentración sectorial', 'La portada vuelve a partir por la reportabilidad agregada UAF, como punto de entrada para detectar cambios y sectores que ameritan lectura.', actionButton('Universo UAF', () => api.navigate('universos', { lens: 'UAF' }))),
      node('div', { class: 'exb-metrics exb-metrics-five' }, [
        metric('ROS 2025', fmt(ros2025), delta == null ? 'último corte anual' : `${delta >= 0 ? '+' : ''}${pct(delta)} vs 2024`, 'primary'),
        metric('ROS 2021–2025', fmt(totals.ros_total_2021_2025), 'acumulado quinquenal'),
        metric('SO inscritos 2025', fmt(registered), 'padrón estadístico UAF'),
        metric('ROS / SO 2025', intensity == null ? '—' : fmt(intensity, 2), 'intensidad agregada; no es cumplimiento'),
        metric('Sectores sin ROS 2025', fmt(zero2025), `${fmt(silent5y)} sin ROS en todo 2021–2025`, zero2025 ? 'attention' : ''),
      ]),
      node('div', { class: 'exb-report-grid' }, [
        node('article', { class: 'exb-panel exb-chart-panel exb-wide' }, [
          node('div', { class: 'exb-panel-head' }, [node('div', {}, [node('span', { class: 'exb-eyebrow', text: 'SERIE ANUAL' }), node('h3', { text: 'ROS recibidos por año' })]), node('span', { class: 'exb-chip', text: '2021–2025' })]),
          global.AtlasV2Viz.lineChart(series, { ariaLabel: 'Evolución anual de reportes de operaciones sospechosas entre 2021 y 2025', caption: 'Número total de ROS por año. La serie describe volumen de reporte, no calidad ni riesgo.' }),
        ]),
        node('article', { class: 'exb-panel exb-chart-panel' }, [
          node('div', { class: 'exb-panel-head' }, [node('div', {}, [node('span', { class: 'exb-eyebrow', text: 'CONCENTRACIÓN' }), node('h3', { text: 'Sectores con más ROS en 2025' })]), topShare == null ? null : node('span', { class: 'exb-chip warn', text: `${pct(topShare)} líder` })]),
          global.AtlasV2Viz.horizontalBars(top.map(row => ({ label: row.sector_name, value: Number(row.ros_2025 || 0), display: fmt(row.ros_2025), detail: `${fmt(row.registered_so_2025)} SO` })), { limit: 8 }),
        ]),
      ]),
      node('div', { class: 'exb-rule' }, [node('strong', { text: 'Lectura. ' }), 'Reportabilidad es una señal agregada sectorial. Un sector con bajo volumen o silencio estadístico no implica incumplimiento individual.']),
      node('small', { class: 'exb-source', text: `${data?.generated_from || 'Fuente UAF'} · período ${data?.period || '2021–2025'} · padrón ${data?.registered_snapshot || '2025'}` }),
    ]);
    return panel;
  }

  function reconciliationPanel(out, dashboard, api) {
    const summary = out?.summary || {};
    const sectors = arr(out?.sectors || out?.data?.sectors);
    const rows = [
      { label: 'Activos en SII', value: Number(summary.active || 0), display: fmt(summary.active), status: 'ACTIVE' },
      { label: 'Término de giro', value: Number(summary.terminated || 0), display: fmt(summary.terminated), status: 'TERMINATED' },
      { label: 'Sin perfil SII', value: Number(summary.no_sii || 0), display: fmt(summary.no_sii), status: 'NO_SII' },
    ];
    const yearRows = arr(out?.terminatedByYear).slice().sort((a, b) => Number(a.termination_year || 0) - Number(b.termination_year || 0)).filter(item => Number(item.termination_year || 0) >= 2019).map(item => ({ label: String(item.termination_year), value: Number(item.entity_count || 0), display: fmt(item.entity_count) }));
    const sectorRows = sectors.filter(row => Number(row?.terminated_count || 0) > 0).sort((a, b) => Number(b.terminated_count || 0) - Number(a.terminated_count || 0)).slice(0, 8).map(row => ({
      label: row.sector_name,
      value: Number(row.terminated_count || 0),
      display: fmt(row.terminated_count),
      detail: `${pct(row.terminated_pct || (Number(row.entity_count || 0) ? 100 * Number(row.terminated_count || 0) / Number(row.entity_count || 1) : 0))} del sector`,
    }));
    const total = Number(summary.total || 0);
    const coverage = total > 0 ? 100 * Number(summary.matched || 0) / total : null;
    const operational = Number(dashboard?.kpis?.registered_total_latest || 0);
    const reference2025 = 9911;
    const operationalDelta = operational ? operational - reference2025 : null;

    return node('section', { class: 'exb-section' }, [
      sectionHead('02', 'CONCILIACIÓN UAF ↔ SII', 'Vigencia tributaria del padrón', 'Cruce por RUT para reconocer rápidamente sujetos obligados activos, con término de giro o sin perfil SII materializado.', actionButton('Abrir UAF', () => api.navigate('universos', { lens: 'UAF' }))),
      node('div', { class: 'exb-metrics exb-metrics-five' }, [
        metric('Padrón operativo UAF', operational ? fmt(operational) : fmt(total), dashboard?.kpis?.registered_total_as_of ? `corte ${dateText(dashboard.kpis.registered_total_as_of)}` : 'último corte disponible', 'primary'),
        metric('Con perfil SII', fmt(summary.matched), coverage == null ? 'conciliación por RUT' : `${pct(coverage)} del padrón conciliado`),
        metric('Término de giro', fmt(summary.terminated), total ? `${pct(100 * Number(summary.terminated || 0) / total)} del padrón` : 'estado tributario', Number(summary.terminated || 0) ? 'attention' : ''),
        metric('Sin perfil SII', fmt(summary.no_sii), total ? `${pct(100 * Number(summary.no_sii || 0) / total)} requiere revisión` : 'requiere revisión'),
        metric('Variación vs 2025', operationalDelta == null ? '—' : `${operationalDelta >= 0 ? '+' : ''}${fmt(operationalDelta)}`, '9.911 = referencia estadística 2025'),
      ]),
      node('div', { class: 'exb-recon-main' }, [
        node('article', { class: 'exb-panel exb-chart-panel exb-recon-status' }, [
          node('div', { class: 'exb-panel-head' }, [node('div', {}, [node('span', { class: 'exb-eyebrow', text: 'ESTADO DEL PADRÓN' }), node('h3', { text: 'Distribución UAF según SII' })]), node('span', { class: 'exb-chip', text: `${fmt(total)} entidades` })]),
          global.AtlasV2Viz.segmented(rows, { onSelect: item => api.navigate('universos', { lens: 'UAF', sii_status: item.status }) }),
          node('p', { class: 'exb-copy', text: 'Selecciona una categoría para profundizar el universo. Término de giro es una condición tributaria, no una señal AML/FT por sí sola.' }),
        ]),
        node('article', { class: 'exb-panel exb-chart-panel' }, [
          node('div', { class: 'exb-panel-head' }, [node('div', {}, [node('span', { class: 'exb-eyebrow', text: 'SECTORES' }), node('h3', { text: 'Dónde se concentran los términos de giro' })])]),
          global.AtlasV2Viz.horizontalBars(sectorRows, { limit: 8 }),
        ]),
      ]),
      node('div', { class: 'exb-recon-secondary' }, [
        node('article', { class: 'exb-panel exb-chart-panel' }, [
          node('div', { class: 'exb-panel-head' }, [node('div', {}, [node('span', { class: 'exb-eyebrow', text: 'EVOLUCIÓN' }), node('h3', { text: 'Términos de giro por año' })])]),
          global.AtlasV2Viz.lineChart(yearRows, { ariaLabel: 'Términos de giro observados por año en la conciliación UAF SII', caption: 'Fecha tributaria observada en SII para entidades presentes en el padrón UAF.' }),
        ]),
        node('article', { class: 'exb-panel exb-recent' }, [
          node('div', { class: 'exb-panel-head' }, [node('div', {}, [node('span', { class: 'exb-eyebrow', text: 'RECIENTES' }), node('h3', { text: 'Últimos términos observados' })])]),
          ...arr(out?.recentTerminated).slice(0, 6).map(item => node('button', { type: 'button', class: 'exb-recent-row', onclick: () => api.navigate('entidad', { entity_id: item.entity_id || '', rut: item.rut || '', q: item.resolved_name || '' }) }, [node('span', {}, [node('strong', { text: item.resolved_name || item.rut || 'Entidad' }), node('small', { text: `${dateText(item.termination_date)} · ${item.uaf_sector_label || 'sector UAF'}` })]), node('b', { text: 'Abrir →' })])),
        ]),
      ]),
      node('small', { class: 'exb-source', text: `Conciliación gobernada por RUT · ${dateText(out?.generatedAt)}` }),
    ]);
  }

  function universesPanel(out, api) {
    const rows = arr(out?.items).map(item => ({ label: ({ SII: 'SII', UAF: 'UAF / SO', OSFL: 'OSFL', RES: 'RES', SANCIONES: 'Sanciones' })[String(item.lens || '').toUpperCase()] || item.lens, value: Number(item.total_count || 0), display: compact(item.total_count), lens: String(item.lens || '').toUpperCase(), detail: 'entidades observadas' })).sort((a, b) => b.value - a.value);
    return node('article', { class: 'exb-panel exb-chart-panel' }, [
      node('div', { class: 'exb-panel-head' }, [node('div', {}, [node('span', { class: 'exb-eyebrow', text: 'COBERTURA ATLAS' }), node('h3', { text: 'Universos disponibles' })]), actionButton('Universos', () => api.navigate('universos'))]),
      global.AtlasV2Viz.horizontalBars(rows, { limit: 7, onSelect: item => api.navigate('universos', { lens: item.lens }) }),
    ]);
  }

  function watchPanel(out, api) {
    const s = out?.summary || {};
    const other = Math.max(0, Number(s.alert_count || 0) - Number(s.very_high_count || 0) - Number(s.high_count || 0));
    const rows = [
      { label: 'Muy alta', value: Number(s.very_high_count || 0), display: fmt(s.very_high_count), severity: 'VERY_HIGH' },
      { label: 'Alta', value: Number(s.high_count || 0), display: fmt(s.high_count), severity: 'HIGH' },
      { label: 'Otras vigentes', value: other, display: fmt(other), severity: 'OTHER' },
    ];
    return node('article', { class: 'exb-panel exb-chart-panel' }, [
      node('div', { class: 'exb-panel-head' }, [node('div', {}, [node('span', { class: 'exb-eyebrow', text: 'VIGILANCIA' }), node('h3', { text: 'Señales vigentes' })]), actionButton('Vigilancia', () => api.navigate('vigilancia'))]),
      node('div', { class: 'exb-panel-number' }, [node('strong', { text: fmt(s.alert_count) }), node('span', { text: `${fmt(s.family_count)} familias observadas` })]),
      global.AtlasV2Viz.segmented(rows, { onSelect: item => api.navigate('vigilancia', { severity: item.severity }) }),
      node('p', { class: 'exb-copy', text: out?.comparison?.available ? 'Comparación de snapshots disponible.' : 'Baseline inicial: no se infiere estabilidad a partir de la ausencia de comparación.' }),
    ]);
  }

  function territoryPanel(out, api) {
    const rows = arr(out?.items).filter(item => item.region).sort((a, b) => Number(b.igr_mean || 0) - Number(a.igr_mean || 0)).slice(0, 7).map(item => ({ label: item.region, value: Number(item.igr_mean || 0), display: fmt(item.igr_mean, 1), detail: `${fmt(item.commune_count)} comunas`, region: item.region }));
    return node('article', { class: 'exb-panel exb-chart-panel' }, [
      node('div', { class: 'exb-panel-head' }, [node('div', {}, [node('span', { class: 'exb-eyebrow', text: 'TERRITORIO' }), node('h3', { text: 'Contexto geográfico' })]), actionButton('Territorio', () => api.navigate('territorio'))]),
      global.AtlasV2Viz.horizontalBars(rows, { limit: 7, onSelect: item => api.navigate('territorio', { region: item.region }) }),
      node('p', { class: 'exb-copy', text: 'IGR aporta contexto territorial y no se hereda como riesgo individual.' }),
    ]);
  }

  function publicSpendPanel(out, api) {
    const procurement = out?.data?.domains?.procurement?.summary || {};
    const availability = out?.data?.availability || {};
    const rows = [
      { label: 'Proveedores', value: Number(procurement.supplier_count || 0), display: compact(procurement.supplier_count), tab: 'suppliers' },
      { label: 'Compradores', value: Number(procurement.buyer_count || 0), display: compact(procurement.buyer_count), tab: 'buyers' },
    ];
    return node('article', { class: 'exb-panel exb-chart-panel' }, [
      node('div', { class: 'exb-panel-head' }, [node('div', {}, [node('span', { class: 'exb-eyebrow', text: 'GASTO PÚBLICO' }), node('h3', { text: 'Compras y proveedores' })]), actionButton('Gasto público', () => api.navigate('gasto-publico'))]),
      node('div', { class: 'exb-status-row' }, [node('span', { text: `ChileCompra · ${availability.procurement || 'sin estado'}` }), node('span', { text: `Presupuesto · ${availability.budget_execution || 'sin estado'}` })]),
      global.AtlasV2Viz.horizontalBars(rows, { limit: 2, onSelect: item => api.navigate('gasto-publico', { tab: item.tab }) }),
    ]);
  }

  async function timed(label, reader) {
    const started = performance.now();
    try { return { label, status: 'fulfilled', value: await reader(), ms: Math.round(performance.now() - started) }; }
    catch (reason) { return { label, status: 'rejected', reason, ms: Math.round(performance.now() - started) }; }
  }

  async function hydrate(root, api, serial) {
    const reportSlot = root.querySelector('[data-slot="reportability"]');
    const reconSlot = root.querySelector('[data-slot="reconciliation"]');
    const coverageSlot = root.querySelector('[data-slot="coverage"]');
    const watchSlot = root.querySelector('[data-slot="watch"]');
    const territorySlot = root.querySelector('[data-slot="territory"]');
    const spendSlot = root.querySelector('[data-slot="spend"]');

    const results = await Promise.all([
      timed('reportability', () => localJson(DATA_URLS.reportability)),
      timed('uafSnapshot', () => localJson(DATA_URLS.uafSnapshot)),
      timed('attention', () => global.AtlasV2Universes.attention({ route: 'explorar:baseline:uaf-sii' })),
      timed('universes', () => global.AtlasV2Universes.overview({ route: 'explorar:baseline:universes' })),
      timed('watch', () => global.AtlasV2Watch.overview({ route: 'explorar:baseline:watch' })),
      timed('territory', () => global.AtlasV2Territory.overview({ route: 'explorar:baseline:territory' })),
      timed('spend', () => global.AtlasV2Access.data().publicSpend.monitor({ route: 'explorar:baseline:spend' })),
    ]);
    if (serial !== renderSerial || !root.isConnected) return;
    const by = label => results.find(item => item.label === label);

    const report = by('reportability');
    clear(reportSlot);
    reportSlot.append(report?.status === 'fulfilled' ? reportabilityPanel(report.value, api) : errorPanel('Reportabilidad ROS', 'No fue posible leer el snapshot estadístico UAF 2021–2025.'));

    const attention = by('attention');
    const dashboard = by('uafSnapshot');
    clear(reconSlot);
    reconSlot.append(attention?.status === 'fulfilled' ? reconciliationPanel(attention.value, dashboard?.status === 'fulfilled' ? dashboard.value : null, api) : errorPanel('Conciliación UAF ↔ SII', attention?.reason?.message || 'No fue posible consultar el read model de conciliación.'));

    const universes = by('universes');
    clear(coverageSlot);
    coverageSlot.append(universes?.status === 'fulfilled' ? universesPanel(universes.value, api) : errorPanel('Cobertura ATLAS'));

    const watch = by('watch');
    clear(watchSlot);
    watchSlot.append(watch?.status === 'fulfilled' ? watchPanel(watch.value, api) : errorPanel('Vigilancia'));

    const territory = by('territory');
    clear(territorySlot);
    territorySlot.append(territory?.status === 'fulfilled' ? territoryPanel(territory.value, api) : errorPanel('Territorio'));

    const spend = by('spend');
    clear(spendSlot);
    spendSlot.append(spend?.status === 'fulfilled' ? publicSpendPanel(spend.value, api) : errorPanel('Gasto público'));

    global.__ATLAS_V2_EXPLORE_BASELINE_DIAGNOSTICS__ = Object.freeze({
      checkedAt: new Date().toISOString(),
      version: VERSION,
      timings: Object.freeze(Object.fromEntries(results.map(item => [item.label, { status: item.status, ms: item.ms }]))),
    });
  }

  function render(container, _route, api) {
    const serial = ++renderSerial;
    clear(container);
    container.dataset.exploreAuthority = VERSION;
    const root = node('div', { class: 'exb', dataset: { authority: VERSION } });
    root.append(compactSearch(api));

    const reportSlot = node('div', { class: 'exb-slot', dataset: { slot: 'reportability' } }, [skeleton('Recuperando reportabilidad ROS…')]);
    const reconSlot = node('div', { class: 'exb-slot', dataset: { slot: 'reconciliation' } }, [skeleton('Conciliando padrón UAF con SII…')]);
    const coverageSlot = node('div', { class: 'exb-slot', dataset: { slot: 'coverage' } }, [skeleton('Leyendo universos…')]);
    const watchSlot = node('div', { class: 'exb-slot', dataset: { slot: 'watch' } }, [skeleton('Leyendo señales…')]);
    const territorySlot = node('div', { class: 'exb-slot', dataset: { slot: 'territory' } }, [skeleton('Leyendo territorio…')]);
    const spendSlot = node('div', { class: 'exb-slot', dataset: { slot: 'spend' } }, [skeleton('Leyendo gasto público…')]);

    root.append(
      reportSlot,
      reconSlot,
      node('section', { class: 'exb-section exb-compact-section' }, [sectionHead('03', 'COBERTURA Y CAMBIOS', 'Qué está observando Atlas', 'Una segunda capa para abrir universos o cambios sólo cuando el pulso inicial lo justifica.'), node('div', { class: 'exb-two-grid' }, [coverageSlot, watchSlot])]),
      node('section', { class: 'exb-section exb-compact-section' }, [sectionHead('04', 'CONTEXTO', 'Territorio y gasto público', 'Capas complementarias para interpretar hallazgos sin transferir riesgo automáticamente.'), node('div', { class: 'exb-two-grid' }, [territorySlot, spendSlot])]),
      node('div', { class: 'exb-footer-rule' }, [node('strong', { text: 'Criterio de portada. ' }), 'Primero reportabilidad; luego conciliación UAF–SII; después cobertura, cambios y contexto. Las cifras orientan preguntas analíticas y no constituyen conclusiones automáticas.']),
    );
    container.append(root);
    void hydrate(root, api, serial);
  }

  function bind() {
    if (!global.AtlasV2Shell?.registerSurface) return false;
    global.AtlasV2Shell.registerSurface('explorar', render);
    global.__ATLAS_V2_EXPLORE_BASELINE__ = Object.freeze({
      installed: true,
      version: VERSION,
      route: 'explorar',
      mode: 'REPORTABILITY_FIRST_UAF_SII_SECOND',
      search: 'COMPACT',
      reportabilitySource: 'UAF_SECTOR_REPORTABILITY_V1',
      uafSiiSource: 'ATLAS_UNIVERSES_QUERY_V2:attention',
    });
    return true;
  }

  if (!bind()) global.addEventListener('atlas:v2-shell-ready', bind, { once: true });
})(window);
