'use strict';

(function installAtlasV2UafReportingWatch(global) {
  if (global.__ATLAS_V2_UAF_REPORTING_WATCH_0908__) return;
  global.__ATLAS_V2_UAF_REPORTING_WATCH_0908__ = Object.freeze({ installed: true, revision: '2026-09-08-3' });

  const scriptBase = new URL('./', document.currentScript?.src || document.baseURI);
  const REPORTABILITY_URL = new URL('../data/uaf_reportability_sector_2025.json', scriptBase).href;
  const YEARS = Object.freeze([2021, 2022, 2023, 2024, 2025]);
  const NO_REGISTERED = Object.freeze([
    'ADMINISTRADORAS DE FONDOS MUTUOS',
    'ARMAS: PERSONAS QUE SE DEDIQUEN A LA FABRICACIÓN DE ARMAS',
    'CLUBES DE CAZA',
    'CLUBES DE PESCA',
    'FINTEC: PRESTADORES DEL SERVICIO DE PLATAFORMA DE FINANCIAMIENTO COLECTIVO',
    'FINTEC: PROVEEDORES DEL SERVICIO DE INICIACIÓN DE PAGOS',
  ]);

  let reportabilityPromise = null;
  let observer = null;
  let installTimer = null;
  const sectorKeyCache = new Map();

  function node(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value == null) return;
      if (key === 'class') el.className = value;
      else if (key === 'text') el.textContent = String(value);
      else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
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
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, String(value)));
    return el;
  }

  function clear(el) { while (el?.firstChild) el.removeChild(el.firstChild); }
  function number(value) { const n = Number(value); return Number.isFinite(n) ? n : null; }
  function fmt(value, digits = 0) {
    const n = number(value);
    return n == null ? '—' : n.toLocaleString('es-CL', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }
  function normalize(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-CL').replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function lastRosYear(row) {
    for (const year of [2025, 2024, 2023, 2022, 2021]) if ((number(row?.[`ros_${year}`]) || 0) > 0) return year;
    return null;
  }
  function totalSubjects(rows) { return rows.reduce((sum, row) => sum + (number(row.registered_so_2025) || 0), 0); }
  function shortSectorName(value) {
    return String(value || 'Sector sin nombre')
      .replace(/^FINTEC:\s*/i, '')
      .replace(/^ARMAS:\s*/i, '')
      .replace(/^PERSONAS QUE SE DEDIQUEN A LA\s*/i, '')
      .replace(/^EMPRESAS DEDICADAS A LA\s*/i, '')
      .replace(/^VEHÍCULOS:\s*/i, '')
      .trim();
  }

  async function reportability() {
    if (!reportabilityPromise) {
      reportabilityPromise = fetch(REPORTABILITY_URL, { cache: 'no-store', headers: { accept: 'application/json' } })
        .then(response => { if (!response.ok) throw new Error(`REPORTABILITY_${response.status}`); return response.json(); })
        .catch(error => { reportabilityPromise = null; throw error; });
    }
    return reportabilityPromise;
  }

  function groupsFrom(data) {
    const sectors = Array.isArray(data?.sectors) ? data.sectors : [];
    const silent = sectors
      .filter(row => (number(row.registered_so_2025) || 0) > 0 && (row.silence_5y === true || number(row.ros_total_2021_2025) === 0))
      .sort((a, b) => (number(b.registered_so_2025) || 0) - (number(a.registered_so_2025) || 0));

    const low = sectors
      .filter(row => {
        const registered = number(row.registered_so_2025) || 0;
        const total = number(row.ros_total_2021_2025);
        const intensity = number(row.ros_per_100_so_2025);
        const ros2025 = number(row.ros_2025);
        if (!registered || total == null || row.silence_5y === true) return false;
        return (intensity != null && intensity < 1) || (ros2025 === 0 && total > 0);
      })
      .sort((a, b) => (number(b.registered_so_2025) || 0) - (number(a.registered_so_2025) || 0));

    const noRegistered = NO_REGISTERED.map(name => ({ sector_name: name, registered_so_2025: 0, no_registered: true }));

    return [
      {
        id: 'no-registered', tone: 'no-registered', icon: '◎', eyebrow: 'BRECHA DE PADRÓN',
        title: 'Sectores sin inscritos', subtitle: 'Brecha de padrón UAF',
        rows: noRegistered, subjectCount: 0, cta: 'Ver sectores',
      },
      {
        id: 'low', tone: 'low', icon: '↘', eyebrow: 'VIGILANCIA SECTORIAL',
        title: 'Sectores con baja reportabilidad', subtitle: 'Reportan poco o con rezago',
        rows: low, subjectCount: totalSubjects(low), cta: 'Explorar detalle',
      },
      {
        id: 'silent', tone: 'silent', icon: '∅', eyebrow: 'SILENCIO 2021–2025',
        title: 'Sectores sin ROS en la serie', subtitle: 'Con inscritos · 0 ROS agregados',
        rows: silent, subjectCount: totalSubjects(silent), cta: 'Ver sectores',
      },
    ];
  }

  function noRegisteredVisual(group) {
    const rows = group.rows.slice(0, 3);
    return node('div', { class: 'atlas-v2-uaf-watch-visual no-reg-visual' }, [
      node('div', { class: 'atlas-v2-uaf-watch-visual-head' }, [
        node('strong', { text: 'Sectores detectados' }),
        node('small', { text: 'inscritos' }),
      ]),
      node('div', { class: 'atlas-v2-uaf-watch-sector-list' }, rows.map(row => node('div', { class: 'atlas-v2-uaf-watch-sector-line', title: row.sector_name }, [
        node('span', { class: 'dot', 'aria-hidden': 'true' }),
        node('span', { class: 'label', text: shortSectorName(row.sector_name) }),
        node('b', { text: '0' }),
      ]))),
      node('p', { class: 'atlas-v2-uaf-watch-note', text: `${fmt(group.rows.length)} categorías sin sujetos inscritos observados en el padrón UAF.` }),
    ]);
  }

  function trendSeries(rows) {
    const divisor = Math.max(1, rows.length);
    return YEARS.map(year => rows.reduce((sum, row) => sum + (number(row[`ros_${year}`]) || 0), 0) / divisor);
  }

  function trendChart(rows) {
    const values = trendSeries(rows);
    const width = 320;
    const height = 92;
    const padX = 18;
    const top = 10;
    const bottom = 22;
    const plotH = height - top - bottom;
    const max = Math.max(1, ...values);
    const x = index => padX + (width - padX * 2) * index / (YEARS.length - 1);
    const y = value => top + plotH * (1 - value / max);
    const points = values.map((value, index) => [x(index), y(value)]);
    const lineD = points.map((point, index) => `${index ? 'L' : 'M'}${point[0].toFixed(1)},${point[1].toFixed(1)}`).join(' ');
    const areaD = `${lineD} L${points[points.length - 1][0].toFixed(1)},${(top + plotH).toFixed(1)} L${points[0][0].toFixed(1)},${(top + plotH).toFixed(1)} Z`;
    const svg = svgNode('svg', { class: 'atlas-v2-uaf-watch-trend-svg', viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': 'Evolución promedio de ROS de los sectores seleccionados entre 2021 y 2025' });

    [0, .5, 1].forEach(ratio => {
      const gy = top + plotH * ratio;
      svg.append(svgNode('line', { x1: padX, y1: gy, x2: width - padX, y2: gy, class: 'grid' }));
    });
    svg.append(svgNode('path', { d: areaD, class: 'area' }));
    svg.append(svgNode('path', { d: lineD, class: 'line' }));
    points.forEach(([px, py], index) => {
      svg.append(svgNode('circle', { cx: px, cy: py, r: 3.2, class: 'point' }));
      const label = svgNode('text', { x: px, y: height - 4, class: 'year', 'text-anchor': 'middle' });
      label.textContent = String(YEARS[index]);
      svg.append(label);
    });
    return { svg, values };
  }

  function lowVisual(group) {
    const chart = trendChart(group.rows);
    const previous = chart.values[3] || 0;
    const current = chart.values[4] || 0;
    const delta = previous > 0 ? ((current - previous) / previous) * 100 : null;
    const withoutRos2025 = group.rows.filter(row => (number(row.ros_2025) || 0) === 0).length;
    const deltaText = delta == null ? '—' : `${delta > 0 ? '+' : ''}${fmt(delta, 0)}%`;

    return node('div', { class: 'atlas-v2-uaf-watch-visual low-visual' }, [
      node('div', { class: 'atlas-v2-uaf-watch-visual-head' }, [
        node('strong', { text: 'Evolución de ROS' }),
        node('small', { text: 'promedio sectorial' }),
      ]),
      node('div', { class: 'atlas-v2-uaf-watch-trend' }, [chart.svg]),
      node('div', { class: 'atlas-v2-uaf-watch-insights' }, [
        node('span', {}, [node('b', { text: fmt(withoutRos2025) }), document.createTextNode(' sin ROS 2025')]),
        node('span', {}, [node('b', { text: deltaText }), document.createTextNode(' variación 24/25')]),
      ]),
    ]);
  }

  function silentVisual(group) {
    const rows = group.rows.slice(0, 4);
    const max = Math.max(1, ...rows.map(row => number(row.registered_so_2025) || 0));
    return node('div', { class: 'atlas-v2-uaf-watch-visual silent-visual' }, [
      node('div', { class: 'atlas-v2-uaf-watch-period', text: 'Periodo 2021–2025' }),
      node('div', { class: 'atlas-v2-uaf-watch-visual-head' }, [
        node('strong', { text: 'SO inscritos por sector' }),
        node('small', { text: 'Nº SO' }),
      ]),
      node('div', { class: 'atlas-v2-uaf-watch-bars' }, rows.map(row => {
        const count = number(row.registered_so_2025) || 0;
        return node('div', { class: 'atlas-v2-uaf-watch-bar-row', title: row.sector_name }, [
          node('span', { class: 'label', text: shortSectorName(row.sector_name) }),
          node('span', { class: 'track' }, [node('i', { style: { width: `${Math.max(5, count / max * 100)}%` } })]),
          node('b', { text: fmt(count) }),
        ]);
      })),
      node('p', { class: 'atlas-v2-uaf-watch-note', text: `${fmt(group.subjectCount)} SO inscritos pertenecen a estos sectores; la señal es sectorial, no individual.` }),
    ]);
  }

  function cardVisual(group) {
    if (group.id === 'no-registered') return noRegisteredVisual(group);
    if (group.id === 'low') return lowVisual(group);
    return silentVisual(group);
  }

  function groupCard(group, state, selectGroup) {
    const active = state.groupId === group.id;
    return node('article', {
      class: `atlas-v2-uaf-watch-card ${group.tone} ${active ? 'active' : ''}`.trim(),
    }, [
      node('div', { class: 'atlas-v2-uaf-watch-card-head' }, [
        node('span', { class: 'atlas-v2-uaf-watch-icon', text: group.icon, 'aria-hidden': 'true' }),
        node('div', { class: 'atlas-v2-uaf-watch-card-copy' }, [
          node('h4', { text: group.title }),
          node('p', { text: group.subtitle }),
        ]),
        node('b', { class: 'atlas-v2-uaf-watch-card-count', text: fmt(group.rows.length) }),
      ]),
      cardVisual(group),
      node('button', {
        type: 'button',
        class: 'atlas-v2-uaf-watch-cta',
        'aria-expanded': active ? 'true' : 'false',
        onclick: () => selectGroup(group.id),
      }, [node('span', { text: active ? 'Cerrar detalle' : group.cta }), node('span', { text: active ? '×' : '→', 'aria-hidden': 'true' })]),
    ]);
  }

  async function resolveSectorKey(sectorName) {
    const cacheKey = normalize(sectorName);
    if (sectorKeyCache.has(cacheKey)) return sectorKeyCache.get(cacheKey);
    const api = global.AtlasV2Universes;
    if (!api?.distribution) return sectorName;
    const out = await api.distribution('UAF', 'sector', { limit: 100, route: 'explorar:reporting-watch:resolve' });
    const items = Array.isArray(out?.items) ? out.items : [];
    const exact = items.find(item => normalize(item.label || item.key) === cacheKey);
    const fuzzy = exact || items.find(item => {
      const value = normalize(item.label || item.key);
      return value.includes(cacheKey) || cacheKey.includes(value);
    });
    const key = String(fuzzy?.key || fuzzy?.label || sectorName).trim();
    sectorKeyCache.set(cacheKey, key);
    return key;
  }

  function entityMeta(item) {
    return [item.rut || item.entity_id || '', item.region ? `Región ${item.region}` : '', item.commune || '', item.sii_status || item.status || ''].filter(Boolean).join(' · ');
  }

  async function renderEntities(host, sector, api) {
    clear(host);
    if (sector.no_registered) {
      host.append(node('div', { class: 'atlas-v2-uaf-watch-empty' }, [
        node('strong', { text: 'No existe una cohorte de entidades inscritas que desplegar.' }),
        document.createTextNode(' Esta señal identifica una categoría sectorial sin inscritos observados en el padrón UAF actual. Debe leerse como brecha de cobertura registral, no como incumplimiento de una entidad.'),
      ]));
      return;
    }

    host.append(node('div', { class: 'atlas-v2-uaf-watch-loading', text: `Cargando entidades de ${sector.sector_name}…` }));
    try {
      const key = await resolveSectorKey(sector.sector_name);
      const out = await global.AtlasV2Universes.slice('UAF', 'sector', key, { limit: 40, route: 'explorar:reporting-watch:slice' });
      if (!host.isConnected) return;
      clear(host);
      const items = Array.isArray(out?.items) ? out.items : [];
      const head = node('div', { class: 'atlas-v2-uaf-watch-entity-head' }, [
        node('strong', { text: `${sector.sector_name} · ${fmt(items.length)} entidades cargadas` }),
        node('button', { type: 'button', class: 'atlas-v2-uaf-watch-open', text: 'Abrir sector en Universos →', onclick: () => api.navigate('universos', { lens: 'UAF', dimension: 'sector', key }) }),
      ]);
      host.append(head);
      if (!items.length) {
        host.append(node('div', { class: 'atlas-v2-uaf-watch-empty', text: 'No se materializaron entidades para este sector en la lectura gobernada actual.' }));
        return;
      }
      host.append(node('div', { class: 'atlas-v2-uaf-watch-entity-list' }, items.slice(0, 20).map(item => node('article', { class: 'atlas-v2-uaf-watch-entity' }, [
        node('div', {}, [
          node('strong', { text: item.name || item.legal_name || item.entity_id || 'Entidad sin nombre' }),
          node('small', { text: entityMeta(item) || 'Sin metadatos adicionales' }),
        ]),
        node('button', { type: 'button', text: 'Ver 360', onclick: () => api.navigate('entidad', { entity_id: item.entity_id || '', rut: item.rut || '', q: item.name || item.legal_name || '' }) }),
      ]))));
    } catch (error) {
      if (!host.isConnected) return;
      clear(host);
      host.append(node('div', { class: 'atlas-v2-uaf-watch-empty', text: `No fue posible abrir la cohorte del sector en este momento (${error?.code || error?.message || 'lectura no disponible'}).` }));
    }
  }

  function explorer(group, state, api, close) {
    const host = node('div', { class: 'atlas-v2-uaf-watch-explorer' });
    const entityHost = node('div', { class: 'atlas-v2-uaf-watch-entity-host' });
    const chooseSector = sector => {
      state.sectorName = sector.sector_name;
      Array.from(host.querySelectorAll('.atlas-v2-uaf-watch-sector')).forEach(button => button.classList.toggle('active', button.dataset.sector === sector.sector_name));
      void renderEntities(entityHost, sector, api);
    };

    host.append(node('div', { class: 'atlas-v2-uaf-watch-explorer-head' }, [
      node('div', {}, [
        node('span', { text: group.eyebrow }),
        node('h4', { text: group.title }),
        node('p', { text: `${fmt(group.rows.length)} sectores · ${group.id === 'no-registered' ? 'sin cohorte inscrita' : `${fmt(group.subjectCount)} SO inscritos en los sectores seleccionados`}` }),
      ]),
      node('button', { type: 'button', class: 'atlas-v2-uaf-watch-close', text: 'Cerrar', onclick: close }),
    ]));

    const strip = node('div', { class: 'atlas-v2-uaf-watch-sector-strip' }, group.rows.map(row => {
      const btn = node('button', { type: 'button', class: 'atlas-v2-uaf-watch-sector', text: row.sector_name, title: row.sector_name, onclick: () => chooseSector(row) });
      btn.dataset.sector = row.sector_name;
      return btn;
    }));
    host.append(strip, entityHost);
    const first = group.rows.find(row => row.sector_name === state.sectorName) || group.rows[0];
    if (first) queueMicrotask(() => chooseSector(first));
    return host;
  }

  function buildWatch(data, api) {
    const groups = groupsFrom(data);
    const state = { groupId: '', sectorName: '' };
    const root = node('section', { class: 'atlas-v2-uaf-watch', 'aria-label': 'Brechas de cobertura y reportabilidad sectorial UAF' });
    const grid = node('div', { class: 'atlas-v2-uaf-watch-grid' });
    const explorerHost = node('div');

    const repaintCards = () => {
      clear(grid);
      groups.forEach(group => grid.append(groupCard(group, state, selectGroup)));
    };
    const closeExplorer = () => {
      state.groupId = '';
      state.sectorName = '';
      clear(explorerHost);
      repaintCards();
    };
    const selectGroup = id => {
      const next = groups.find(group => group.id === id);
      if (!next) return;
      if (state.groupId === id) return closeExplorer();
      state.groupId = id;
      state.sectorName = '';
      repaintCards();
      clear(explorerHost);
      explorerHost.append(explorer(next, state, api, closeExplorer));
    };

    root.append(
      node('div', { class: 'atlas-v2-uaf-watch-head' }, [
        node('div', {}, [node('span', { text: 'LECTURA SECTORIAL' }), node('h3', { text: 'Brechas de padrón y reportabilidad' })]),
        node('p', { text: 'Tres señales · un detalle desplegable por sector' }),
      ]),
      grid,
      explorerHost,
      node('p', { class: 'atlas-v2-uaf-watch-guardrail' }, [
        node('strong', { text: 'Lectura analítica. ' }),
        'Los ROS disponibles están agregados por sector; una baja o nula reportabilidad sectorial no demuestra incumplimiento individual. La serie observada cubre 2021–2025.',
      ]),
    );
    repaintCards();
    return root;
  }

  async function attachToReconciliation(panel) {
    if (!panel || panel.dataset.uafReportingWatch === 'true') return;
    panel.dataset.uafReportingWatch = 'loading';
    const api = global.AtlasV2Shell;
    if (!api?.navigate) return;
    const placeholder = node('div', { class: 'atlas-v2-uaf-watch-loading', text: 'Cargando lectura sectorial de cobertura y reportabilidad…' });
    panel.append(placeholder);
    try {
      const data = await reportability();
      if (!panel.isConnected) return;
      placeholder.replaceWith(buildWatch(data, api));
      panel.dataset.uafReportingWatch = 'true';
    } catch (error) {
      if (!panel.isConnected) return;
      placeholder.textContent = 'No fue posible cargar la lectura sectorial en este corte.';
      panel.dataset.uafReportingWatch = 'error';
      console.error('[ATLAS v2] UAF reporting watch failed', error);
    }
  }

  function install() {
    const route = global.AtlasV2Shell?.currentRoute?.();
    if (route?.id && route.id !== 'explorar') return;
    const panels = Array.from(document.querySelectorAll('.atlas-v2-studio-recon-panel'));
    panels.forEach(panel => { if (panel.dataset.uafReportingWatch !== 'true' && panel.dataset.uafReportingWatch !== 'loading') void attachToReconciliation(panel); });
  }

  function scheduleInstall() {
    clearTimeout(installTimer);
    installTimer = setTimeout(install, 30);
  }

  function startObserver() {
    scheduleInstall();
    if (observer) return;
    const root = document.getElementById('atlas-v2-root');
    if (!root) return;
    observer = new MutationObserver(scheduleInstall);
    observer.observe(root, { childList: true, subtree: true });
    global.addEventListener('hashchange', scheduleInstall);
  }

  global.addEventListener('atlas:v2-shell-ready', startObserver);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startObserver, { once: true });
  else startObserver();
})(window);
