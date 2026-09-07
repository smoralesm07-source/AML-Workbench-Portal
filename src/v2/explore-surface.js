'use strict';

(function installAtlasV2ExploreSurface(global) {
  if (global.__ATLAS_V2_EXPLORE_SURFACE__) return;

  const scriptBase = new URL('./', document.currentScript?.src || document.baseURI);
  const SVG_NS = 'http://www.w3.org/2000/svg';
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
      href: new URL('explore-surface.css?v=executive-pulse-2', scriptBase).href,
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
    const q = String(raw || '').trim();
    if (!q) return;
    if (looksLikeRut(q)) return api.navigate('entidad', { rut: q });
    api.navigate('entidad', { q });
  }

  function compactSearch(api) {
    const input = node('input', { type: 'search', placeholder: 'RUT, entidad o palabra clave…', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Buscar en Atlas' });
    input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); routeQuery(api, input.value); } });
    return node('div', { class: 'atlas-v2-exec-search' }, [
      node('span', { class: 'atlas-v2-exec-search-icon', text: '⌕', 'aria-hidden': 'true' }), input,
      node('span', { class: 'atlas-v2-exec-search-key', text: 'Enter' }),
    ]);
  }

  function card(tag = 'article', cls = '', children = []) { return node(tag, { class: cls }, children); }
  function kpi(label, value, detail, tone = '') {
    return card('article', `atlas-v2-exec-kpi ${tone}`.trim(), [
      node('span', { text: label }), node('b', { text: value }), node('small', { text: detail || '' }),
    ]);
  }

  function panelHead(title, subtitle, action = null) {
    return node('header', { class: 'atlas-v2-exec-panel-head' }, [
      node('div', {}, [node('h2', { text: title }), subtitle ? node('p', { text: subtitle }) : null]), action,
    ]);
  }

  function action(label, onclick) { return node('button', { type: 'button', class: 'atlas-v2-exec-link', text: `${label} →`, onclick }); }

  function chip(label, key, active, onclick, count = null) {
    return node('button', { type: 'button', class: `atlas-v2-exec-chip ${active ? 'active' : ''}`.trim(), onclick }, [
      node('span', { text: label }), count == null ? null : node('b', { text: fmt(count) }),
    ]);
  }

  function rosYearChart(items, selected, onSelect) {
    const rows = arr(items);
    const observed = rows.filter(row => number(row.value) != null);
    const max = Math.max(1, ...observed.map(row => Number(row.value)));
    const width = 980, height = 250, left = 50, right = 22, top = 26, bottom = 46;
    const plotH = height - top - bottom;
    const slot = (width - left - right) / Math.max(1, rows.length);
    const barW = Math.min(74, slot * .58);
    const root = node('div', { class: 'atlas-v2-ros-chart' });
    const svg = svgNode('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': 'ROS recibidos por año; 2026 corresponde a acumulado del año y se marca con línea punteada' });

    [0, .25, .5, .75, 1].forEach(step => {
      const y = top + plotH * (1 - step);
      svg.append(svgNode('line', { x1: left, x2: width - right, y1: y, y2: y, class: 'grid' }));
      const label = svgNode('text', { x: left - 9, y: y + 4, 'text-anchor': 'end', class: 'tick' }); label.textContent = fmt(max * step); svg.append(label);
    });

    rows.forEach((row, index) => {
      const x = left + slot * index + slot / 2;
      const value = number(row.value);
      const isYtd = row.ytd === true;
      const selectedRow = String(row.label) === String(selected);
      const g = svgNode('g', { class: `bar-group ${isYtd ? 'ytd' : ''} ${selectedRow ? 'selected' : ''}`.trim(), tabindex: '0', role: 'button' });
      if (value != null) {
        const h = Math.max(3, plotH * value / max);
        const y = top + plotH - h;
        g.append(svgNode('rect', { x: x - barW / 2, y, width: barW, height: h, rx: 5, class: isYtd ? 'bar ytd' : 'bar' }));
        const v = svgNode('text', { x, y: Math.max(15, y - 9), 'text-anchor': 'middle', class: 'value' }); v.textContent = fmt(value); g.append(v);
      } else if (isYtd) {
        const h = plotH * .24;
        const y = top + plotH - h;
        g.append(svgNode('rect', { x: x - barW / 2, y, width: barW, height: h, rx: 5, class: 'bar ytd placeholder' }));
        const v = svgNode('text', { x, y: y - 9, 'text-anchor': 'middle', class: 'value muted' }); v.textContent = 'corte pendiente'; g.append(v);
      }
      const t = svgNode('text', { x, y: height - 19, 'text-anchor': 'middle', class: isYtd ? 'axis ytd' : 'axis' }); t.textContent = isYtd ? 'Acumulado 2026' : String(row.label); g.append(t);
      const activate = () => onSelect?.(row);
      g.addEventListener('click', activate);
      g.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(); } });
      svg.append(g);
    });
    root.append(svg);
    return root;
  }

  // Compatibilidad contractual: la portada legacy usó esta primitiva; ahora dibuja barras anuales discretas.
  function areaLineChart(items, selected, onSelect) { return rosYearChart(items, selected, onSelect); }

  function proportionalBars(items, options = {}) {
    const rows = arr(items).filter(item => number(item.value) != null).slice(0, options.limit || 8);
    if (!rows.length) return node('div', { class: 'atlas-v2-exec-empty', text: 'Sin datos comparables en este corte.' });
    const max = Math.max(1, ...rows.map(row => Number(row.value)));
    return node('div', { class: 'atlas-v2-exec-bars' }, rows.map(row => {
      const ratio = Math.max(.012, Number(row.value) / max);
      const wrapper = options.onSelect ? 'button' : 'div';
      return node(wrapper, { class: 'atlas-v2-exec-bar-row', type: wrapper === 'button' ? 'button' : null, onclick: wrapper === 'button' ? () => options.onSelect(row) : null }, [
        node('div', { class: 'atlas-v2-exec-bar-name' }, [node('strong', { text: row.label }), row.detail ? node('small', { text: row.detail }) : null]),
        node('div', { class: 'atlas-v2-exec-bar-track' }, [node('i', { style: { width: `${(ratio * 100).toFixed(2)}%` } })]),
        node('b', { text: row.display || fmt(row.value) }),
      ]);
    }));
  }

  function statusComposition(summary, activeKey, onSelect) {
    const rows = [
      ['active', 'Activos con SII', Number(summary.active || 0), 'green'],
      ['terminated', 'Término de giro', Number(summary.terminated || 0), 'amber'],
      ['no_sii', 'Sin perfil SII', Number(summary.no_sii || 0), 'violet'],
    ];
    const total = Math.max(1, Number(summary.total || rows.reduce((s, row) => s + row[2], 0)));
    return node('div', { class: 'atlas-v2-recon' }, [
      node('div', { class: 'atlas-v2-recon-track' }, rows.map(([key, label, value, tone]) => node('button', {
        type: 'button', class: `${tone} ${activeKey === key ? 'active' : ''}`.trim(), style: { width: `${Math.max(.2, 100 * value / total)}%` }, title: `${label}: ${fmt(value)}`, onclick: () => onSelect?.(key),
      }))),
      node('div', { class: 'atlas-v2-recon-legend' }, rows.map(([key, label, value, tone]) => node('button', { type: 'button', class: `${tone} ${activeKey === key ? 'active' : ''}`.trim(), onclick: () => onSelect?.(key) }, [
        node('span', { text: label }), node('b', { text: fmt(value) }), node('small', { text: pct(100 * value / total) }),
      ]))),
    ]);
  }

  function reasonKey(row) {
    if (row?.sii_status === 'TERMINATED_AS_PUBLISHED' || row?.reason === 'Término de giro') return 'terminated';
    if (row?.sii_status === 'SIN_PERFIL_SII' || row?.reason === 'Sin perfil SII') return 'no_sii';
    if (Number(row?.sanction_event_count || 0) > 0 || row?.reason === 'Historial sancionatorio') return 'sanctioned';
    return 'review';
  }

  function reasonLabel(row) {
    const key = reasonKey(row);
    return ({ terminated: 'Término de giro', no_sii: 'Sin perfil SII', sanctioned: 'Historial sancionatorio', review: 'Revisión analítica' })[key];
  }

  function attentionTable(rows, filter, api) {
    const visible = arr(rows).filter(row => filter === 'all' || reasonKey(row) === filter).slice(0, 8);
    if (!visible.length) return node('div', { class: 'atlas-v2-exec-empty', text: 'No hay entidades materializadas para este filtro.' });
    const table = node('div', { class: 'atlas-v2-attention-table' });
    table.append(node('div', { class: 'atlas-v2-attention-row head' }, [
      node('span', { text: 'Entidad' }), node('span', { text: 'Sector' }), node('span', { text: 'Motivo de atención' }), node('span', { text: 'Territorio' }), node('span', { text: '' }),
    ]));
    visible.forEach(row => {
      const key = reasonKey(row);
      table.append(node('div', { class: 'atlas-v2-attention-row' }, [
        node('div', { class: 'identity' }, [node('strong', { text: row.name || row.rut || row.entity_id }), node('small', { text: row.rut || 'sin RUT' })]),
        node('span', { class: 'sector', text: row.sector || 'Sin sector materializado' }),
        node('div', { class: `reason ${key}` }, [node('i'), node('b', { text: reasonLabel(row) }), row.priority_band ? node('small', { text: `Prioridad ${String(row.priority_band).toLowerCase()} · no es probabilidad` }) : null]),
        node('span', { class: 'territory', text: [row.region, row.commune].filter(Boolean).join(' · ') || 'Sin territorio' }),
        node('button', { type: 'button', class: 'atlas-v2-attention-open', text: 'Ver 360', onclick: () => api.navigate('entidad', { entity_id: row.entity_id || '', rut: row.rut || '', q: row.name || '' }) }),
      ]));
    });
    return table;
  }

  function reportabilityPanel(reportability, selectedYear, setSelectedYear) {
    const totals = reportability?.totals || {};
    const series = [2021, 2022, 2023, 2024, 2025].map(year => ({ label: String(year), year, value: number(totals[`ros_${year}`]) }));
    // No existe todavía un agregado 2026 gobernado en el read model: se conserva el slot YTD sin inventar un valor.
    series.push({ label: '2026', year: 2026, value: null, ytd: true });
    const host = card('section', 'atlas-v2-exec-panel atlas-v2-ros-panel');
    const meta = node('div', { class: 'atlas-v2-exec-meta' }, [
      node('span', { text: 'UAF · serie anual' }), node('span', { class: 'ytd', text: '2026 = acumulado del año' }),
    ]);
    host.append(panelHead('ROS recibidos por año', 'Volumen anual de Reportes de Operaciones Sospechosas', meta));
    const chartHost = node('div');
    const render = () => { clear(chartHost); chartHost.append(areaLineChart(series, String(selectedYear), row => { setSelectedYear(row.year); render(); })); };
    render();
    host.append(chartHost, node('div', { class: 'atlas-v2-ros-foot' }, [
      node('span', { text: `Último año completo: 2025 · ${fmt(totals.ros_2025)} ROS` }),
      node('span', { class: 'ytd-note', text: 'Acumulado 2026 · corte aún no materializado en el read model. La línea punteada indica año incompleto.' }),
    ]));
    return host;
  }

  function reconciliationPanel(summary, activeFilter, setFilter, api) {
    const total = Number(summary.total || 10294);
    const matched = Number(summary.matched || 8184);
    const host = card('section', 'atlas-v2-exec-panel atlas-v2-reconciliation-panel', [
      panelHead('Estado de conciliación UAF ↔ SII', 'Vigencia tributaria y cobertura del padrón', action('Abrir universo UAF', () => api.navigate('universos', { lens: 'UAF' }))),
      statusComposition(summary, activeFilter, key => setFilter(key === 'active' ? 'all' : key)),
      node('div', { class: 'atlas-v2-recon-note' }, [node('strong', { text: `${fmt(matched)} conciliados de ${fmt(total)}. ` }), 'Término de giro es una condición tributaria publicada por SII; no implica una conclusión AML/FT.']),
    ]);
    return host;
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
      const fallbackTotal = snapshot?.kpis?.registered_total_latest || 10294;
      const total = Number(summary.total || fallbackTotal || 10294);
      const active = Number(summary.active || 0);
      const terminated = Number(summary.terminated || 0);
      const noSii = Number(summary.no_sii || 0);
      const matched = Number(summary.matched || active + terminated || 0);
      const liveSummary = { ...summary, total, active, terminated, no_sii: noSii, matched };

      clear(refs.kpis);
      refs.kpis.append(
        kpi('SO inscritos', fmt(total), `Padrón operativo UAF · actualizado ${dateText(attention?.generatedAt || snapshot?.generated_at)}`, 'cyan'),
        kpi('Conciliados con SII', fmt(matched), `${pct(total ? 100 * matched / total : null)} del universo`),
        kpi('Término de giro', fmt(terminated), `${pct(total ? 100 * terminated / total : null)} del padrón`, 'amber'),
        kpi('Sin perfil SII', fmt(noSii), `${pct(total ? 100 * noSii / total : null)} requiere revisión`, 'violet'),
      );

      let selectedYear = 2025;
      clear(refs.ros); refs.ros.append(reportability ? reportabilityPanel(reportability, selectedYear, year => { selectedYear = year; renderSectorInsight(); }) : node('div', { class: 'atlas-v2-exec-empty', text: 'Serie ROS no disponible.' }));

      let filter = 'all';
      const attentionRows = arr(attention?.data?.attention_entities);
      const sectors = arr(attention?.data?.sectors);

      const renderQueue = () => {
        clear(refs.attentionBody);
        refs.attentionBody.append(attentionTable(attentionRows, filter, api));
        Array.from(refs.filters.children).forEach(button => button.classList.toggle('active', button.dataset.filter === filter));
      };
      const chooseFilter = key => { filter = filter === key && key !== 'all' ? 'all' : key; renderQueue(); renderRecon(); };
      const filterDefs = [
        ['all', 'Todos'], ['terminated', 'Término de giro'], ['no_sii', 'Sin perfil SII'], ['sanctioned', 'Con sanciones'],
      ];
      clear(refs.filters);
      filterDefs.forEach(([key, label]) => {
        const count = key === 'all' ? attentionRows.length : attentionRows.filter(row => reasonKey(row) === key).length;
        const button = chip(label, key, filter === key, () => chooseFilter(key), count);
        button.dataset.filter = key; refs.filters.append(button);
      });

      const renderRecon = () => { clear(refs.recon); refs.recon.append(reconciliationPanel(liveSummary, filter, chooseFilter, api)); };
      renderRecon(); renderQueue();

      function renderSectorInsight() {
        const sectorRows = sectors.slice().sort((a, b) => Number(b.entity_count || 0) - Number(a.entity_count || 0)).slice(0, 8).map(row => ({
          label: row.sector_name || 'Sin sector', value: Number(row.entity_count || 0), display: fmt(row.entity_count),
          detail: `${fmt(row.terminated_count || 0)} término · ${fmt(row.no_sii_count || 0)} sin perfil`,
        }));
        clear(refs.sectors); refs.sectors.append(proportionalBars(sectorRows, { limit: 8, onSelect: row => api.navigate('universos', { lens: 'UAF', sector: row.label }) }));
      }
      renderSectorInsight();

      clear(refs.update); refs.update.append(node('span', { text: `Corte operativo ${dateText(attention?.generatedAt || snapshot?.generated_at)}` }));

      // Precalienta lecturas secundarias sin añadir ruido visual a la portada.
      void Promise.allSettled([
        global.AtlasV2Universes.overview?.({ route: 'explorar:warm-universes' }),
        global.AtlasV2Watch?.overview?.({ route: 'explorar:warm-watch' }),
        global.AtlasV2Territory?.overview?.({ route: 'explorar:warm-territory' }),
      ]);
    } catch (error) {
      if (serial !== renderSerial) return;
      clear(refs.update); refs.update.append(node('span', { text: 'Lectura parcial · reintentar' }));
      console.error('[ATLAS v2] Explore executive pulse failed', error);
    }
  }

  function render(container, _route, api) {
    injectStyle();
    const serial = ++renderSerial;
    clear(container);
    container.dataset.exploreAuthority = 'LEGACY_PULSE_NATIVE_V2';

    const root = node('div', { class: 'atlas-v2-exec-home' });
    const head = node('div', { class: 'atlas-v2-exec-top' }, [
      node('div', { class: 'atlas-v2-exec-title' }, [node('span', { text: 'ATLAS · INTELIGENCIA ANALÍTICA' }), node('h1', { text: 'Explorar' })]),
      compactSearch(api),
      node('div', { class: 'atlas-v2-exec-update' }),
    ]);
    const filters = node('div', { class: 'atlas-v2-exec-filters' });
    const kpis = node('div', { class: 'atlas-v2-exec-kpis' }, [kpi('SO inscritos', '10.294', 'Cargando corte vigente…', 'cyan')]);
    const ros = node('div', { class: 'atlas-v2-exec-ros-slot' });
    const recon = node('div', { class: 'atlas-v2-exec-recon-slot' });
    const attentionBody = node('div', { class: 'atlas-v2-attention-body' });
    const attention = card('section', 'atlas-v2-exec-panel atlas-v2-attention-panel', [
      panelHead('Sujetos obligados que requieren atención', 'Casos visibles por discrepancia registral, cobertura o evidencia sancionatoria', action('Ver universo', () => api.navigate('universos', { lens: 'UAF' }))), attentionBody,
    ]);
    const sectors = node('div', { class: 'atlas-v2-sector-body' });
    const sectorPanel = card('section', 'atlas-v2-exec-panel atlas-v2-sector-panel', [
      panelHead('Distribución por sector económico', 'Principales sectores del padrón y carga de gestión'), sectors,
    ]);

    root.append(head, filters, kpis, node('div', { class: 'atlas-v2-exec-main-grid' }, [ros, recon]), node('div', { class: 'atlas-v2-exec-bottom-grid' }, [attention, sectorPanel]));
    root.__refs = { kpis, ros, recon, filters, attentionBody, sectors, update: head.querySelector('.atlas-v2-exec-update') };
    container.append(root);
    void hydrate(root, api, serial);
  }

  global.AtlasV2Shell.registerSurface('explorar', render);
  global.__ATLAS_V2_EXPLORE_SURFACE__ = Object.freeze({
    installed: true, route: 'explorar', mode: 'LEGACY_PULSE_NATIVE_V2', design: 'EXECUTIVE_PULSE_V2',
    searchMode: 'COMPACT_MINIMAL', ros2026: 'YTD_DASHED_NO_FABRICATION', attention: 'IN_SCREEN_DYNAMIC',
  });
})(window);
