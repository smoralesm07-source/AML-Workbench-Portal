'use strict';

(function installAtlasV2Entity360Surface(global) {
  if (global.__ATLAS_V2_ENTITY360_SURFACE__) return;
  const scriptBase = new URL('./', document.currentScript?.src || document.baseURI);
  const NF = new Intl.NumberFormat('es-CL');
  let renderSerial = 0;
  let searchSerial = 0;

  function node(tag, attrs = {}, children = []) {
    const element = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value == null) return;
      if (key === 'class') element.className = value;
      else if (key === 'text') element.textContent = String(value);
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

  function injectStyle() {
    if (document.getElementById('atlas-v2-entity360-style')) return;
    const link = document.createElement('link');
    link.id = 'atlas-v2-entity360-style';
    link.rel = 'stylesheet';
    link.href = new URL('entity360-surface.css?v=legacy-power-1', scriptBase).href;
    document.head.appendChild(link);
  }

  function money(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n === 0) return '—';
    const a = Math.abs(n);
    if (a >= 1e12) return `$${(n / 1e12).toLocaleString('es-CL', { maximumFractionDigits: 2 })} bill.`;
    if (a >= 1e9) return `$${(n / 1e9).toLocaleString('es-CL', { maximumFractionDigits: 1 })} mil M`;
    if (a >= 1e6) return `$${(n / 1e6).toLocaleString('es-CL', { maximumFractionDigits: 1 })} M`;
    return `$${NF.format(Math.round(n))}`;
  }

  function fmt(value, digits = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString('es-CL', { maximumFractionDigits: digits }) : '—';
  }

  function normalizedSources(item) {
    const values = Array.isArray(item?.sources) ? item.sources : [];
    return values.map(value => String(value || '').trim().toUpperCase()).filter(Boolean);
  }

  function sourceLabel(source) {
    const key = String(source || '').toUpperCase();
    return ({ PRESS: 'Radar Prensa', RADAR_PRENSA: 'Radar Prensa', UAF_NAME: 'Nombre UAF', UAF: 'UAF', CANONICAL: 'Entidad canónica', SII: 'SII', RES: 'RES', OSFL: 'OSFL', SANCTIONS: 'Sanciones', SANCIONES: 'Sanciones' })[key] || String(source || 'Entidad').replace(/_/g, ' ');
  }

  function matchLabel(type) {
    return ({ rut_exact: 'RUT exacto', name_exact: 'Nombre exacto', name_prefix: 'Nombre comienza con', name_fuzzy: 'Nombre similar', alias_exact: 'Denominación UAF exacta', alias_prefix: 'Denominación UAF relacionada' })[type] || 'Coincidencia';
  }

  function sourceClass(source) {
    const key = String(source || '').toUpperCase();
    if (/PRESS|PRENSA/.test(key)) return 'press';
    if (/UAF/.test(key)) return 'uaf';
    if (/SII/.test(key)) return 'sii';
    if (/RES/.test(key)) return 'res';
    if (/OSFL/.test(key)) return 'osfl';
    if (/SANC/.test(key)) return 'san';
    return 'other';
  }

  function pageHead(reference = {}, api = null) {
    const label = reference.name || reference.rut || '';
    const back = api && label ? node('button', {
      type: 'button', class: 'atlas-v2-e360-back', text: '← Volver al explorador',
      onclick: () => api.navigate('entidad', reference.q ? { q: reference.q } : {}),
    }) : null;
    return node('header', { class: 'atlas-v2-e360-pagehead' }, [
      back,
      node('div', { class: 'atlas-v2-eyebrow', text: label ? 'ENTIDAD 360 · EXPEDIENTE ANALÍTICO' : 'EXPLORADOR DE ENTIDADES · IDENTIDAD DIGITAL' }),
      node('h1', { text: label || 'Entidades' }),
      node('p', { text: label
        ? 'Identidad, trayectoria, fuentes y contexto en una sola ficha. Atlas mantiene separada la evidencia de cada dominio y no resuelve identidades por mera similitud nominal.'
        : 'Recupera el explorador avanzado de la versión anterior: busca por RUT, razón social, denominaciones, entidades UAF y nombres observados en Radar Prensa; revisa por qué coincidieron antes de profundizar.' }),
    ]);
  }

  function routeForResult(item, query) {
    const params = { entity_id: item.entityId, q: query || item.name || item.matchedLabel || '' };
    if (item.rut) params.rut = item.rut;
    return params;
  }

  function facetMatches(item, facet) {
    const sources = normalizedSources(item);
    if (facet === 'rut') return Boolean(item.rut);
    if (facet === 'no-rut') return !item.rut;
    if (facet === 'press') return item.matchSource === 'PRESS' || sources.some(source => /PRESS|PRENSA/.test(source));
    if (facet === 'uaf') return item.matchSource === 'UAF_NAME' || sources.some(source => /UAF/.test(source));
    if (facet === 'multi') return Number(item.sourceCount || 0) >= 2 || sources.length >= 2;
    return true;
  }

  function sourceMarks(item) {
    const marks = normalizedSources(item).slice(0, 6);
    if (!marks.length && item.matchSource) marks.push(item.matchSource);
    return node('div', { class: 'atlas-v2-e360-source-marks', 'aria-label': 'Fuentes observadas' }, marks.map(source => node('span', {
      class: `atlas-v2-e360-source-mark ${sourceClass(source)}`,
      title: sourceLabel(source),
      text: sourceLabel(source),
    })));
  }

  function previewCard(api, item, query) {
    if (!item) return node('div', { class: 'atlas-v2-e360-preview-empty' }, [
      node('div', { class: 'atlas-v2-e360-preview-icon', text: '⌕' }),
      node('strong', { text: 'Selecciona “Vista rápida” para inspeccionar una coincidencia' }),
      node('p', { text: 'El expediente sólo se abre cuando tú lo decides. La búsqueda conserva fuente, método de coincidencia y estado de resolución de identidad.' }),
    ]);
    const sources = normalizedSources(item);
    const confidence = Math.round((Number(item.matchScore || 0)) * 100);
    return node('article', { class: 'atlas-v2-e360-preview-card' }, [
      node('div', { class: 'atlas-v2-e360-preview-kicker', text: sourceLabel(item.matchSource) }),
      node('h2', { text: item.name || item.matchedLabel || 'Entidad sin etiqueta' }),
      node('p', { class: 'atlas-v2-e360-preview-id', text: item.rut || 'Sin RUT resuelto' }),
      sourceMarks(item),
      node('div', { class: 'atlas-v2-e360-preview-grid' }, [
        node('div', {}, [node('span', { text: 'Coincidencia' }), node('strong', { text: matchLabel(item.matchType) })]),
        node('div', {}, [node('span', { text: 'Calidad match' }), node('strong', { text: `${confidence}%` })]),
        node('div', {}, [node('span', { text: 'Fuentes' }), node('strong', { text: fmt(item.sourceCount || sources.length) })]),
        node('div', {}, [node('span', { text: 'Eventos' }), node('strong', { text: fmt(item.eventCount) })]),
      ]),
      item.matchedLabel && item.matchedLabel !== item.name ? node('div', { class: 'atlas-v2-e360-preview-match' }, [node('span', { text: 'Coincidió como' }), node('b', { text: item.matchedLabel })]) : null,
      item.roles?.length ? node('div', { class: 'atlas-v2-e360-role-list' }, item.roles.slice(0, 5).map(role => node('span', { text: role }))) : null,
      node('div', { class: 'atlas-v2-e360-preview-rule' }, [
        node('strong', { text: 'Identidad: ' }),
        item.rut ? 'hay RUT resuelto en esta coincidencia.' : 'se mantiene como entidad de fuente; Atlas no inventa ni fuerza un RUT.'
      ]),
      node('button', { class: 'atlas-v2-button primary atlas-v2-e360-preview-open', type: 'button', text: 'Abrir Entidad 360 →', onclick: () => api.navigate('entidad', routeForResult(item, query)) }),
    ]);
  }

  function resultRow(api, item, query, previewHost) {
    const source = sourceLabel(item.matchSource);
    const pressOnly = item.matchSource === 'PRESS' && !item.rut;
    const confidence = Math.round((item.matchScore || 0) * 100);
    const row = node('article', { class: `atlas-v2-e360-result ${pressOnly ? 'is-press' : ''}` }, [
      node('button', {
        type: 'button', class: `atlas-v2-e360-result-open atlas-v2-e360-search-result ${pressOnly ? 'is-press' : ''}`,
        onclick: () => api.navigate('entidad', routeForResult(item, query)),
      }, [
        node('div', { class: 'atlas-v2-e360-result-main' }, [
          node('div', { class: 'atlas-v2-e360-result-title' }, [
            node('strong', { text: item.name || item.matchedLabel || 'Entidad sin etiqueta' }),
            node('span', { class: `atlas-v2-e360-source-tag ${sourceClass(item.matchSource)}`, text: source }),
          ]),
          node('p', { text: [item.rut || 'Sin RUT resuelto', item.entityType, item.commune, item.region].filter(Boolean).join(' · ') }),
          sourceMarks(item),
        ]),
        node('div', { class: 'atlas-v2-e360-result-score' }, [
          node('b', { text: `${confidence}%` }),
          node('span', { text: matchLabel(item.matchType) }),
          item.eventCount ? node('small', { text: `${fmt(item.eventCount)} evento(s)` }) : null,
        ]),
      ]),
      node('button', {
        type: 'button', class: 'atlas-v2-e360-result-preview', text: 'Vista rápida',
        onclick: () => { clear(previewHost); previewHost.append(previewCard(api, item, query)); },
      }),
    ]);
    return row;
  }

  function filterBar(items, listHost, countHost, previewHost, api, query) {
    let active = 'all';
    const filters = [
      ['all', 'Todos'], ['rut', 'Con RUT'], ['no-rut', 'Sin RUT'], ['press', 'Radar Prensa'], ['uaf', 'UAF'], ['multi', 'Multi-fuente'],
    ];
    const bar = node('div', { class: 'atlas-v2-e360-filters' });
    const render = () => {
      const visible = items.filter(item => facetMatches(item, active));
      clear(listHost);
      countHost.textContent = `${fmt(visible.length)} de ${fmt(items.length)} coincidencia(s)`;
      if (!visible.length) {
        listHost.append(node('div', { class: 'atlas-v2-e360-search-empty' }, [
          node('strong', { text: 'Sin coincidencias para este filtro' }),
          node('span', { text: 'Cambia el filtro sin perder la búsqueda.' }),
        ]));
        return;
      }
      visible.forEach(item => listHost.append(resultRow(api, item, query, previewHost)));
    };
    filters.forEach(([key, label]) => {
      const total = items.filter(item => facetMatches(item, key)).length;
      const button = node('button', {
        type: 'button', class: key === active ? 'is-active' : '',
        onclick: () => {
          active = key;
          Array.from(bar.children).forEach(child => child.classList.remove('is-active'));
          button.classList.add('is-active');
          render();
        },
      }, [node('span', { text: label }), node('b', { text: fmt(total) })]);
      bar.append(button);
    });
    render();
    return bar;
  }

  async function runSearch(api, query, host, serial) {
    const q = String(query || '').trim();
    if (q.length < 2) { clear(host); return; }
    clear(host);
    host.append(node('div', { class: 'atlas-v2-e360-search-loading', text: 'Buscando en entidades, UAF, índices canónicos y Radar Prensa…' }));
    try {
      const out = await global.AtlasV2EntitySearch.search(q, { limit: 50, route: `entidad:search:${q.slice(0, 48)}` });
      if (serial !== searchSerial || !host.isConnected) return;
      clear(host);
      const items = out.items || [];
      if (!items.length) {
        host.append(node('div', { class: 'atlas-v2-e360-search-empty' }, [
          node('strong', { text: 'Sin coincidencias en los índices disponibles' }),
          node('span', { text: 'Esto no confirma inexistencia. Prueba otra denominación, alias o RUT.' }),
        ]));
        return;
      }
      const countHost = node('strong', { text: `${fmt(items.length)} coincidencia(s)` });
      const listHost = node('div', { class: 'atlas-v2-e360-results-list' });
      const previewHost = node('aside', { class: 'atlas-v2-e360-preview' }, [previewCard(api, null, q)]);
      const facets = filterBar(items, listHost, countHost, previewHost, api, q);
      host.append(
        node('div', { class: 'atlas-v2-e360-search-summary' }, [
          node('div', {}, [countHost, node('span', { text: 'Ordenadas por calidad de resolución, nunca por riesgo.' })]),
          node('small', { text: 'Entidad · UAF · Radar Prensa · fuentes canónicas' }),
        ]),
        facets,
        node('div', { class: 'atlas-v2-e360-search-workspace' }, [listHost, previewHost]),
        node('div', { class: 'atlas-v2-e360-rule' }, [
          node('strong', { text: 'Cómo leer los resultados. ' }),
          'Una coincidencia aproximada sólo propone una ruta de exploración. Coincidencia nominal ≠ identidad confirmada. Las entidades de Radar Prensa sin RUT permanecen separadas de una identidad tributaria hasta que exista evidencia de resolución.',
        ]),
      );
    } catch (error) {
      if (serial !== searchSerial || !host.isConnected) return;
      clear(host);
      host.append(node('div', { class: 'atlas-v2-e360-source-error' }, [
        node('strong', { text: 'No fue posible completar la búsqueda transversal.' }),
        node('span', { text: String(error?.message || error) }),
      ]));
    }
  }

  function searchBox(api, initial = '', resultsHost = null) {
    const input = node('input', {
      type: 'search', value: initial,
      placeholder: 'RUT, razón social, denominación UAF o entidad observada en prensa…',
      'aria-label': 'Buscar entidad por RUT, nombre o fuente', autocomplete: 'off',
    });
    let timer = null;
    const submit = () => {
      const value = input.value.trim();
      if (!value) return;
      if (global.AtlasV2Entity360?.validRutShape(value)) return api.navigate('entidad', { rut: global.AtlasV2Entity360.canonicalRut(value) });
      api.navigate('entidad', { q: value });
    };
    input.addEventListener('keydown', event => { if (event.key === 'Enter') submit(); });
    if (resultsHost) {
      input.addEventListener('input', () => {
        clearTimeout(timer);
        const q = input.value.trim();
        if (q.length < 2) { clear(resultsHost); return; }
        const serial = ++searchSerial;
        timer = setTimeout(() => void runSearch(api, q, resultsHost, serial), 180);
      });
    }
    return node('div', { class: 'atlas-v2-e360-query atlas-v2-entity-search' }, [
      node('span', { class: 'atlas-v2-e360-query-icon', text: '⌕' }),
      input,
      node('button', { class: 'atlas-v2-button primary', type: 'button', text: 'Buscar entidad', onclick: submit }),
    ]);
  }

  function discovery(api, host) {
    const examples = ['Buscar por RUT', 'Razón social o nombre', 'Denominación UAF', 'Radar Prensa sin RUT'];
    return node('section', { class: 'atlas-v2-e360-discovery' }, [
      node('div', { class: 'atlas-v2-e360-discovery-icon', text: '◎' }),
      node('div', {}, [
        node('h2', { text: 'Explorador transversal de identidad' }),
        node('p', { text: 'La búsqueda recupera entidades aun cuando no exista RUT, explica la fuente de coincidencia y permite distinguir identidad resuelta de contexto OSINT.' }),
        node('div', { class: 'atlas-v2-e360-discovery-chips' }, examples.map(text => node('span', { text }))),
      ]),
      node('button', { class: 'atlas-v2-e360-discovery-action', type: 'button', text: 'Ir a Relaciones →', onclick: () => api.navigate('relaciones') }),
    ]);
  }

  function lensBar(core) {
    const available = core?.sourceStatus || {};
    const spec = [
      ['Identidad', 'identity'], ['Tributario', 'tax'], ['UAF', 'uaf'], ['RES', 'res'], ['Sanciones', 'sanctions'], ['Gasto público', 'spend'], ['Relaciones', 'relations'], ['Cronología', 'history'],
    ];
    return node('div', { class: 'atlas-v2-e360-lensbar' }, spec.map(([label, key]) => node('span', {
      class: `atlas-v2-e360-lens ${available[key] === 'AVAILABLE' ? 'is-live' : ''}`, text: label,
    })));
  }

  function statusBadge(status) {
    const labels = { ready: 'Conectado', unavailable: 'No publicado', error: 'Error de lectura', invalid: 'Entrada inválida', skipped: 'No aplica' };
    return node('span', { class: `atlas-v2-e360-status ${status || 'unavailable'}`, text: labels[status] || status || 'Sin estado' });
  }

  function analyticalMoves(api, reference) {
    const params = {};
    if (reference?.rut) params.rut = reference.rut;
    if (reference?.entityId) params.entity_id = reference.entityId;
    const grid = node('div', { class: 'atlas-v2-e360-move-grid' });
    [
      ['GASTO PÚBLICO', 'Comportamiento económico', 'Compras, dependencia y contexto presupuestario.', 'gasto-publico'],
      ['RELACIONES', 'Red de vínculos', 'Representantes, sociedades, domicilios y contrapartes.', 'relaciones'],
      ['TERRITORIO', 'Contexto territorial', 'Región, comuna y patrones geográficos comparables.', 'territorio'],
    ].forEach(([tag, title, description, route]) => {
      grid.append(node('button', { class: 'atlas-v2-e360-move', type: 'button', onclick: () => api.navigate(route, params) }, [
        node('span', { class: 'atlas-v2-card-tag', text: tag }), node('h3', { text: title }), node('p', { text: description }), node('b', { text: 'Abrir manteniendo contexto →' }),
      ]));
    });
    return node('section', { class: 'atlas-v2-e360-section' }, [
      node('div', { class: 'atlas-v2-e360-section-head' }, [node('h2', { text: 'Seguir investigando' }), node('p', { text: 'La identidad viaja con la navegación; ninguna acción crea un caso o tarea.' })]),
      grid,
    ]);
  }

  function identityHero(core) {
    const identity = core?.identity || {};
    const sources = Array.isArray(identity.sources) ? identity.sources : [];
    const press = sources.includes('RADAR_PRENSA') || sources.includes('PRESS');
    const sourcePills = sources.length ? sources : Object.entries(core?.sourceStatus || {}).filter(([, value]) => value === 'AVAILABLE').map(([key]) => key.toUpperCase());
    return node('section', { class: 'atlas-v2-e360-hero' }, [
      node('div', { class: 'atlas-v2-e360-hero-main' }, [
        node('span', { class: 'atlas-v2-card-tag', text: press && !identity.rut ? 'ENTIDAD OBSERVADA · PRENSA' : 'IDENTIDAD ANALÍTICA' }),
        node('h2', { text: identity.name || 'Entidad sin nombre publicado' }),
        node('p', { text: [identity.rut, identity.entityType, identity.activity].filter(Boolean).join(' · ') || 'Sin RUT resuelto; se conserva como entidad de fuente.' }),
        node('div', { class: 'atlas-v2-e360-source-pills' }, sourcePills.map(source => node('span', { class: sourceClass(source), text: sourceLabel(source) }))),
      ]),
      node('div', { class: 'atlas-v2-e360-hero-kpis' }, [
        node('div', {}, [node('span', { text: 'Fuentes' }), node('strong', { text: fmt(sourcePills.length) })]),
        node('div', {}, [node('span', { text: press ? 'Eventos fuente' : 'Estado' }), node('strong', { text: press ? fmt(identity.eventCount) : (identity.status || 'No informado') })]),
        node('div', {}, [node('span', { text: 'Territorio' }), node('strong', { text: [identity.commune, identity.region].filter(Boolean).join(' · ') || 'No informado' })]),
      ]),
    ]);
  }

  function metric(label, value, detail = '') {
    return node('div', { class: 'atlas-v2-e360-metric' }, [node('span', { text: label }), node('strong', { text: value || '—' }), detail ? node('small', { text: detail }) : null]);
  }

  function taxPanel(core) {
    const tax = core?.data?.tax || {};
    return node('section', { class: 'atlas-v2-e360-panel' }, [
      node('div', { class: 'atlas-v2-e360-panel-head' }, [
        node('div', {}, [node('span', { class: 'atlas-v2-card-tag', text: 'SII' }), node('h2', { text: 'Perfil tributario' })]),
        statusBadge(core?.sourceStatus?.tax === 'AVAILABLE' ? 'ready' : 'unavailable'),
      ]),
      node('div', { class: 'atlas-v2-e360-metric-grid' }, [
        metric('Tramo ventas', tax.sales_band || tax.sales_band_code), metric('Trabajadores', fmt(tax.workers_numeric)),
        metric('Inicio actividades', tax.activity_start_date), metric('Término giro', tax.termination_date || 'No observado'),
        metric('Giros / actividades', fmt(tax.activity_count)), metric('Domicilios', fmt(tax.address_count)),
      ]),
      tax.main_activity ? node('p', { class: 'atlas-v2-e360-panel-note', text: tax.main_activity }) : null,
    ]);
  }

  function trajectoryPanel(core) {
    const history = Array.isArray(core?.data?.history) ? core.data.history.slice().sort((a, b) => Number(a.commercial_year) - Number(b.commercial_year)) : [];
    const panel = node('section', { class: 'atlas-v2-e360-panel atlas-v2-e360-trajectory' }, [
      node('div', { class: 'atlas-v2-e360-panel-head' }, [
        node('div', {}, [node('span', { class: 'atlas-v2-card-tag', text: 'TRAYECTORIA SII' }), node('h2', { text: 'Evolución de escala y empleo' }), node('p', { text: 'Selecciona un año para leer el cambio sin abandonar la ficha.' })]),
        statusBadge(history.length ? 'ready' : 'unavailable'),
      ]),
    ]);
    if (!history.length || !global.AtlasV2Viz) {
      panel.append(node('div', { class: 'atlas-v2-e360-empty' }, [node('strong', { text: 'Sin serie histórica disponible' }), node('span', { text: 'La ausencia de historia no se interpreta como estabilidad.' })]));
      return panel;
    }
    const detail = node('div', { class: 'atlas-v2-e360-year-detail' });
    const showYear = row => {
      clear(detail);
      detail.append(metric('Año', String(row.commercial_year || '—')), metric('Tramo ventas', row.sales_band_code || `Rango ${fmt(row.sales_band_rank)}`), metric('Trabajadores', fmt(row.workers_numeric)), metric('Actividad', row.main_activity || 'No informada'));
    };
    showYear(history[history.length - 1]);
    const charts = node('div', { class: 'atlas-v2-e360-chart-grid' }, [
      node('div', { class: 'atlas-v2-e360-chart-block' }, [
        node('h3', { text: 'Escala de ventas' }),
        global.AtlasV2Viz.lineChart(history.map(row => ({ label: row.commercial_year, value: row.sales_band_rank || 0, display: row.sales_band_code || fmt(row.sales_band_rank), raw: row })), { ariaLabel: 'Evolución del tramo de ventas', onSelect: item => showYear(item.raw) }),
      ]),
      node('div', { class: 'atlas-v2-e360-chart-block' }, [
        node('h3', { text: 'Trabajadores informados' }),
        global.AtlasV2Viz.lineChart(history.map(row => ({ label: row.commercial_year, value: row.workers_numeric || 0, display: fmt(row.workers_numeric), raw: row })), { ariaLabel: 'Evolución de trabajadores', onSelect: item => showYear(item.raw) }),
      ]),
    ]);
    panel.append(charts, detail);
    return panel;
  }

  function contextPanel(core, api, resolved) {
    const uaf = core?.data?.uaf || {};
    const sanctions = core?.data?.sanctions || {};
    const spend = core?.data?.spend || {};
    const cards = [
      { tag: 'UAF', title: Array.isArray(uaf.sector_names) && uaf.sector_names.length ? uaf.sector_names.join(' · ') : 'Sin sector observado', value: Array.isArray(uaf.registry_names) ? `${uaf.registry_names.length} denominación(es)` : '—', status: core?.sourceStatus?.uaf, route: 'universos' },
      { tag: 'SANCIONES', title: `${fmt(sanctions.sanction_event_count)} evento(s)`, value: Array.isArray(sanctions.regulators) && sanctions.regulators.length ? sanctions.regulators.join(' · ') : 'Sin regulador observado', status: core?.sourceStatus?.sanctions, route: 'vigilancia' },
      { tag: 'GASTO', title: money(spend.total_clp), value: spend.order_count ? `${fmt(spend.order_count)} orden(es) · ${fmt(spend.buyer_count)} comprador(es)` : 'Sin monto materializado', status: core?.sourceStatus?.spend, route: 'gasto-publico' },
    ];
    const params = {};
    if (resolved?.rut) params.rut = resolved.rut;
    if (resolved?.entityId) params.entity_id = resolved.entityId;
    return node('section', { class: 'atlas-v2-e360-context-grid' }, cards.map(card => node('button', { class: 'atlas-v2-e360-context-card', type: 'button', onclick: () => api.navigate(card.route, params) }, [
      node('div', { class: 'atlas-v2-e360-context-top' }, [node('span', { class: 'atlas-v2-card-tag', text: card.tag }), statusBadge(card.status === 'AVAILABLE' ? 'ready' : 'unavailable')]),
      node('strong', { text: card.title }), node('p', { text: card.value }), node('small', { text: 'Profundizar →' }),
    ])));
  }

  function publicSpendPanel(state, api, rut) {
    const panel = node('section', { class: 'atlas-v2-e360-panel' }, [
      node('div', { class: 'atlas-v2-e360-panel-head' }, [
        node('div', {}, [node('span', { class: 'atlas-v2-card-tag', text: 'GASTO PÚBLICO' }), node('h2', { text: 'Huella como proveedor' }), node('p', { text: 'Compras y ejecución permanecen separadas por dominio.' })]),
        statusBadge(state?.status),
      ]),
    ]);
    if (state?.status === 'skipped') {
      panel.append(node('div', { class: 'atlas-v2-e360-empty' }, [node('strong', { text: 'Sin RUT resuelto para cruzar gasto público' }), node('span', { text: 'La entidad permanece explorable en su fuente original; Atlas no fuerza una identidad tributaria.' })]));
      return panel;
    }
    const all = [
      ...(state?.procurement?.items || []).map(item => ({ ...item, source: 'ChileCompra' })),
      ...(state?.budget?.items || []).map(item => ({ ...item, source: 'Presupuesto Abierto' })),
    ].filter(item => item.amount > 0).sort((a, b) => b.amount - a.amount).slice(0, 8);
    if (!all.length || !global.AtlasV2Viz) {
      panel.append(node('div', { class: 'atlas-v2-e360-empty' }, [node('strong', { text: 'Sin coincidencias materializadas' }), node('span', { text: 'No observado en esta lectura no equivale a inexistencia.' })]));
      return panel;
    }
    panel.append(global.AtlasV2Viz.horizontalBars(all.map(item => ({ label: item.name || item.rut || 'Proveedor', detail: item.source, value: item.amount, display: money(item.amount), raw: item })), {
      limit: 8, onSelect: () => api.navigate('gasto-publico', { rut }),
    }));
    return panel;
  }

  function loadingPanel() {
    return node('div', { class: 'atlas-v2-e360-loading', role: 'status' }, [node('strong', { text: 'Construyendo Entidad 360…' }), node('span', { text: 'Identidad, tributario, UAF, sanciones, trayectoria y gasto se leen por separado.' })]);
  }

  async function resolve(container, api, reference, serial) {
    const host = node('div', { class: 'atlas-v2-e360-live' }, [loadingPanel()]);
    container.append(host);
    let result;
    try { result = await global.AtlasV2Entity360.read(reference, { timeoutMs: 12000 }); }
    catch (error) { result = { status: 'unavailable', reference, core: { status: 'error', message: String(error?.message || error) }, publicSpend: {} }; }
    if (serial !== renderSerial || !host.isConnected) return;
    clear(host);
    if (result.status === 'invalid') {
      host.append(node('div', { class: 'atlas-v2-notice' }, [node('strong', { text: result.message })]));
      return;
    }
    const resolved = { entityId: result.entityId || reference.entityId, rut: result.rut || reference.rut, name: result.core?.identity?.name || reference.name };
    host.append(
      identityHero(result.core),
      lensBar(result.core),
      node('div', { class: 'atlas-v2-e360-grid' }, [taxPanel(result.core), trajectoryPanel(result.core)]),
      contextPanel(result.core, api, resolved),
      publicSpendPanel(result.publicSpend, api, resolved.rut),
      node('div', { class: 'atlas-v2-e360-rule' }, [
        node('strong', { text: 'Regla de interpretación. ' }),
        'Prensa, sanciones, concentración económica, trayectoria tributaria y relaciones son contextos distintos. Ninguno se convierte automáticamente en señal LA/FT ni transfiere riesgo entre entidades.',
      ]),
      analyticalMoves(api, resolved),
    );
  }

  function renderSearch(container, api, query) {
    const host = node('div', { class: 'atlas-v2-e360-search-host' });
    container.append(pageHead({}, api), searchBox(api, query, host), host);
    if (query) {
      const serial = ++searchSerial;
      void runSearch(api, query, host, serial);
    } else container.append(discovery(api, host));
  }

  function render(container, route, api) {
    injectStyle();
    const serial = ++renderSerial;
    const rutRaw = route.params.get('rut') || '';
    const entityId = route.params.get('entity_id') || '';
    const query = route.params.get('q') || '';
    const rut = global.AtlasV2Entity360?.validRutShape(rutRaw) ? global.AtlasV2Entity360.canonicalRut(rutRaw) : '';

    if (!entityId && !rut) {
      renderSearch(container, api, query);
      return;
    }

    const reference = { entityId: entityId || global.AtlasV2Entity360.entityIdFromRut(rut), rut, name: query, q: query };
    container.append(pageHead(reference, api), searchBox(api, query || rut));
    void resolve(container, api, reference, serial);
  }

  function register() {
    if (!global.AtlasV2Shell?.registerSurface) return false;
    global.AtlasV2Shell.registerSurface('entidad', render);
    global.__ATLAS_V2_ENTITY360_SURFACE__ = Object.freeze({ installed: true, route: 'entidad', mode: 'advanced-identity-explorer' });
    return true;
  }

  if (!register()) global.addEventListener('atlas:v2-shell-ready', register, { once: true });
})(window);
