'use strict';

(function installAtlasV2UniversesSurface(global) {
  if (global.__ATLAS_V2_UNIVERSES_SURFACE__) return;
  const scriptBase = new URL('./', document.currentScript?.src || document.baseURI);
  const NF = new Intl.NumberFormat('es-CL');
  const CLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
  let renderSerial = 0;

  const LENSES = Object.freeze({
    SII: {
      label: 'SII', title: 'Universo tributario', short: 'Tributario', icon: '▦',
      description: 'Empresas y contribuyentes observados en el padrón SII materializado.',
      dimensions: [['region','Región'],['sector','Sector económico'],['status','Estado tributario']],
    },
    UAF: {
      label: 'UAF / SO', title: 'Sujetos obligados', short: 'SO', icon: '◎',
      description: 'Padrón UAF reconciliado con SII, supervisión y contexto multifuente.',
      dimensions: [['sector','Sector UAF'],['region','Región'],['band','Banda IPF']],
    },
    OSFL: {
      label: 'OSFL', title: 'Organizaciones sin fines de lucro', short: 'OSFL', icon: '◇',
      description: 'Universo OSFL observado y materializado; no equivale al total legal nacional.',
      dimensions: [['activity','Actividad'],['region','Región'],['confirmation','Confirmación']],
    },
    RES: {
      label: 'RES', title: 'Empresas y sociedades', short: 'RES', icon: '⬡',
      description: 'Constituciones y presencia registral del Registro de Empresas y Sociedades.',
      dimensions: [['constitution_year','Año de constitución'],['region','Región social']],
    },
    SANCIONES: {
      label: 'Sanciones', title: 'Antecedentes administrativos', short: 'Sanciones', icon: '!',
      description: 'Entidades con eventos sancionatorios o de enforcement, preservando su semántica propia.',
      dimensions: [['region','Región'],['entity_type','Tipo de entidad']],
    },
  });

  function node(tag, attrs = {}, children = []) {
    const element = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value == null) return;
      if (key === 'class') element.className = value;
      else if (key === 'text') element.textContent = String(value);
      else if (key === 'style' && typeof value === 'object') Object.assign(element.style, value);
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
    if (document.getElementById('atlas-v2-universes-style')) return;
    const link = document.createElement('link');
    link.id = 'atlas-v2-universes-style';
    link.rel = 'stylesheet';
    link.href = new URL('universes-surface.css?v=population-intelligence-1', scriptBase).href;
    document.head.appendChild(link);
  }

  function count(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    return NF.format(n);
  }

  function compact(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    if (Math.abs(n) >= 1e6) return `${(n / 1e6).toLocaleString('es-CL', { maximumFractionDigits: 2 })} M`;
    if (Math.abs(n) >= 1e3) return `${(n / 1e3).toLocaleString('es-CL', { maximumFractionDigits: 1 })} mil`;
    return NF.format(n);
  }

  function pct(part, total, digits = 1) {
    const p = Number(part), t = Number(total);
    if (!Number.isFinite(p) || !Number.isFinite(t) || t <= 0) return '—';
    return `${(100 * p / t).toLocaleString('es-CL', { maximumFractionDigits: digits })}%`;
  }

  function date(value) {
    if (!value) return 'Sin fecha';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
    return d.toLocaleDateString('es-CL', { year: 'numeric', month: 'short', day: '2-digit' });
  }

  function money(value) {
    const n = Number(value);
    return Number.isFinite(n) ? CLP.format(n) : '—';
  }

  function validRut(value) {
    const compactRut = String(value || '').toUpperCase().replace(/[^0-9K]/g, '');
    return /^\d{7,8}[0-9K]$/.test(compactRut);
  }

  function paramsFrom(route) {
    const requested = String(route.params.get('lens') || 'UAF').toUpperCase();
    const lens = LENSES[requested] ? requested : 'UAF';
    const dims = LENSES[lens].dimensions.map(([id]) => id);
    const requestedDim = String(route.params.get('dimension') || dims[0]).toLowerCase();
    return {
      lens,
      dimension: dims.includes(requestedDim) ? requestedDim : dims[0],
      key: route.params.get('key') || '',
      q: route.params.get('q') || '',
    };
  }

  function nav(api, state, patch = {}) {
    const next = { lens: state.lens, dimension: state.dimension, key: state.key, q: state.q, ...patch };
    Object.keys(next).forEach(k => { if (next[k] == null || next[k] === '') delete next[k]; });
    api.navigate('universos', next);
  }

  function loading(label = 'Construyendo lectura poblacional…') {
    return node('div', { class: 'uiv2-loading', role: 'status' }, [
      node('span', { class: 'uiv2-spinner' }),
      node('div', {}, [node('strong', { text: label }), node('small', { text: 'Agregados gobernados · sin cálculo masivo en navegador' })]),
    ]);
  }

  function errorBox(error) {
    return node('div', { class: 'uiv2-error' }, [
      node('strong', { text: 'Universos no pudo completar la lectura. ' }),
      node('span', { text: String(error?.message || error || 'Error de lectura') }),
      error?.traceId ? node('small', { text: `trace ${error.traceId}` }) : null,
    ]);
  }

  function lensRail(api, state) {
    return node('nav', { class: 'uiv2-lens-rail', 'aria-label': 'Seleccionar universo' },
      Object.entries(LENSES).map(([id, lens]) => node('button', {
        type: 'button', class: state.lens === id ? 'active' : '', 'aria-current': state.lens === id ? 'true' : 'false',
        onclick: () => nav(api, state, { lens: id, dimension: LENSES[id].dimensions[0][0], key: '', q: '' }),
      }, [
        node('span', { class: 'uiv2-lens-icon', text: lens.icon }),
        node('span', {}, [node('strong', { text: lens.label }), node('small', { text: lens.short })]),
      ])));
  }

  function pageHead(api, state) {
    const lens = LENSES[state.lens];
    const search = node('input', { type: 'search', value: state.q, placeholder: 'RUT o razón social…', 'aria-label': 'Buscar en universo' });
    const submit = () => nav(api, state, { q: search.value.trim(), key: '' });
    search.addEventListener('keydown', event => { if (event.key === 'Enter') submit(); });
    return node('header', { class: 'uiv2-head' }, [
      node('div', { class: 'uiv2-head-copy' }, [
        node('span', { class: 'uiv2-eyebrow', text: 'UNIVERSOS · INTELIGENCIA POBLACIONAL' }),
        node('h1', { text: lens.title }),
        node('p', { text: lens.description }),
      ]),
      node('div', { class: 'uiv2-search' }, [
        search,
        node('button', { type: 'button', class: 'uiv2-icon-button', title: 'Buscar', onclick: submit, text: '⌕' }),
        state.q ? node('button', { type: 'button', class: 'uiv2-clear', onclick: () => nav(api, state, { q: '', key: '' }), text: 'Limpiar' }) : null,
      ]),
    ]);
  }

  function kpiConfig(lens, s) {
    if (lens === 'SII') return [
      ['Padrón materializado', s.total, 'Entidades únicas observadas', 'accent'],
      ['Vigentes', s.active, pct(s.active, s.total), 'good'],
      ['Término de giro', s.terminated, pct(s.terminated, s.total), 'warn'],
      [`Perfil anual ${s.latest_profile_year || '—'}`, s.profiled_latest_year, `${s.profile_coverage_pct ?? '—'}% del padrón`, 'info'],
    ];
    if (lens === 'UAF') return [
      ['SO inscritos', s.total, 'Padrón operativo actual', 'accent'],
      ['Conciliados activos', s.active_sii, pct(s.active_sii, s.total), 'good'],
      ['Término de giro', s.terminated_sii, pct(s.terminated_sii, s.total), 'warn'],
      ['Sin perfil SII', s.without_sii, pct(s.without_sii, s.total), 'violet'],
    ];
    if (lens === 'OSFL') return [
      ['OSFL observadas', s.total, 'Materialización actual', 'accent'],
      ['Con territorio', s.with_region, pct(s.with_region, s.total), 'good'],
      ['Candidatas R.8', s.r8_candidates, pct(s.r8_candidates, s.total), 'warn'],
      ['Confirmadas directas', s.direct_confirmed, pct(s.direct_confirmed, s.total), 'info'],
    ];
    if (lens === 'RES') return [
      ['Sociedades materializadas', s.total, 'Todos los archivos observados', 'accent'],
      ['Último año', s.latest_constitution_year, 'Año máximo observado', 'info'],
      ['Constituciones último año', s.latest_year_count, pct(s.latest_year_count, s.total), 'good'],
      ['Con región social', s.with_region, pct(s.with_region, s.total), 'violet'],
    ];
    return [
      ['Entidades observadas', s.total, 'Dossier sancionatorio', 'accent'],
      ['Eventos', s.events, 'Eventos administrativos', 'warn'],
      ['SO UAF', s.uaf_registered, pct(s.uaf_registered, s.total), 'info'],
      ['Monto CLP observado', money(s.amount_clp_total), 'Acumulado en eventos con monto', 'violet'],
    ];
  }

  function kpiStrip(lens, summary) {
    return node('section', { class: 'uiv2-kpis' }, kpiConfig(lens, summary).map(([label, value, sub, tone]) =>
      node('article', { class: `uiv2-kpi ${tone}` }, [
        node('span', { text: label }),
        node('strong', { text: typeof value === 'number' ? count(value) : value ?? '—' }),
        node('small', { text: sub }),
      ])
    ));
  }

  function dimensionTabs(api, state) {
    return node('div', { class: 'uiv2-dim-tabs', role: 'tablist' }, LENSES[state.lens].dimensions.map(([id, label]) =>
      node('button', {
        type: 'button', role: 'tab', 'aria-selected': state.dimension === id ? 'true' : 'false',
        class: state.dimension === id ? 'active' : '', text: label,
        onclick: () => nav(api, state, { dimension: id, key: '', q: '' }),
      })
    ));
  }

  function distributionBasis(state, out, rows) {
    const sum = rows.reduce((acc, item) => acc + (Number(item.entity_count) || 0), 0);
    if (state.lens === 'SII' && ['region','sector'].includes(state.dimension)) {
      const coverage = out.semantics?.regional_sector_coverage_pct;
      return `Perfil anual observado · ${compact(sum)} entidades · cobertura ${coverage ?? '—'}% del padrón`;
    }
    return `${compact(sum)} observaciones en esta dimensión`;
  }

  function distributionChart(api, state, out) {
    const rows = Array.isArray(out.distributions?.[state.dimension]) ? out.distributions[state.dimension] : [];
    const top = rows.slice(0, state.dimension === 'sector' ? 12 : 16);
    const max = Math.max(1, ...top.map(item => Number(item.entity_count) || 0));
    const section = node('section', { class: 'uiv2-panel uiv2-distribution' }, [
      node('header', { class: 'uiv2-panel-head' }, [
        node('div', {}, [node('span', { class: 'uiv2-panel-kicker', text: 'COMPOSICIÓN' }), node('h2', { text: 'Dónde se concentra el universo' })]),
        dimensionTabs(api, state),
      ]),
      node('div', { class: 'uiv2-panel-note', text: distributionBasis(state, out, rows) }),
    ]);
    const chart = node('div', { class: 'uiv2-bar-chart' });
    top.forEach((item, index) => {
      const n = Number(item.entity_count) || 0;
      const selected = state.key && String(item.key) === state.key;
      const row = node('button', {
        type: 'button', class: `uiv2-bar-row ${selected ? 'selected' : ''}`,
        title: `${item.label || item.key}: ${count(n)}`,
        onclick: () => nav(api, state, { key: selected ? '' : String(item.key || ''), q: '' }),
      }, [
        node('span', { class: 'uiv2-bar-rank', text: String(index + 1).padStart(2, '0') }),
        node('span', { class: 'uiv2-bar-label', text: item.label || item.key || 'Sin etiqueta' }),
        node('span', { class: 'uiv2-bar-track' }, [node('i', { style: { width: `${Math.max(2, 100 * n / max)}%` } })]),
        node('strong', { text: compact(n) }),
        node('small', { text: pct(n, rows.reduce((a, b) => a + (Number(b.entity_count) || 0), 0)) }),
      ]);
      chart.append(row);
    });
    if (!top.length) chart.append(node('div', { class: 'uiv2-empty', text: 'Sin distribución materializada para esta dimensión.' }));
    section.append(chart);
    return section;
  }

  function intersectionsPanel(api, state, out) {
    const total = Number(out.summary?.total) || 0;
    const rows = [...(out.intersections || [])].sort((a, b) => (Number(b.entity_count) || 0) - (Number(a.entity_count) || 0));
    const max = Math.max(1, ...rows.map(item => Number(item.entity_count) || 0));
    return node('section', { class: 'uiv2-panel uiv2-overlaps' }, [
      node('header', { class: 'uiv2-panel-head' }, [
        node('div', {}, [node('span', { class: 'uiv2-panel-kicker', text: 'CRUCES EXACTOS' }), node('h2', { text: 'Presencia en otros universos' })]),
        node('span', { class: 'uiv2-badge', text: 'RUT exacto' }),
      ]),
      node('div', { class: 'uiv2-overlap-list' }, rows.map(item => {
        const n = Number(item.entity_count) || 0;
        const target = LENSES[item.lens] || { label: item.lens };
        return node('button', {
          type: 'button', class: 'uiv2-overlap-row',
          onclick: () => nav(api, state, { lens: item.lens, dimension: LENSES[item.lens]?.dimensions?.[0]?.[0] || 'region', key: '', q: '' }),
        }, [
          node('span', { class: 'uiv2-overlap-name', text: target.label }),
          node('span', { class: 'uiv2-overlap-track' }, [node('i', { style: { width: `${Math.max(2, 100 * n / max)}%` } })]),
          node('strong', { text: compact(n) }),
          node('small', { text: pct(n, total) }),
        ]);
      })),
      node('p', { class: 'uiv2-footnote', text: 'El cruce sólo usa RUT exacto. Presencia compartida no transmite riesgo ni condición entre fuentes.' }),
    ]);
  }

  function deriveInsights(state, out) {
    const s = out.summary || {};
    const dist = out.distributions || {};
    const current = Array.isArray(dist[state.dimension]) ? dist[state.dimension] : [];
    const currentTotal = current.reduce((a, b) => a + (Number(b.entity_count) || 0), 0);
    const top = current[0];
    const top3 = current.slice(0, 3).reduce((a, b) => a + (Number(b.entity_count) || 0), 0);
    const intersections = [...(out.intersections || [])].sort((a, b) => (Number(b.entity_count) || 0) - (Number(a.entity_count) || 0));
    const items = [];

    if (top) items.push({ level: 'info', title: 'Mayor concentración', body: `${top.label || top.key} concentra ${pct(top.entity_count, currentTotal)} de la dimensión seleccionada (${compact(top.entity_count)} entidades).` });
    if (current.length >= 3) items.push({ level: top3 / Math.max(1, currentTotal) >= .6 ? 'warn' : 'ctx', title: 'Concentración Top 3', body: `Las tres primeras categorías explican ${pct(top3, currentTotal)} de la distribución visible.` });
    if (intersections[0]) items.push({ level: 'ctx', title: 'Cruce dominante', body: `${LENSES[intersections[0].lens]?.label || intersections[0].lens} comparte ${compact(intersections[0].entity_count)} RUT con este universo.` });

    if (state.lens === 'UAF') {
      if (Number(s.terminated_sii)) items.unshift({ level: 'warn', title: 'Vigencia tributaria a revisar', body: `${count(s.terminated_sii)} SO presentan término de giro publicado en SII.` });
      if (Number(s.without_sii)) items.push({ level: 'violet', title: 'Brecha de conciliación', body: `${count(s.without_sii)} SO no tienen perfil SII materializado en el corte.` });
    } else if (state.lens === 'SII') {
      items.unshift({ level: 'ctx', title: 'Cobertura anual desigual', body: `Región y sector corresponden al perfil comercial ${s.latest_profile_year || 'más reciente'} y cubren ${s.profile_coverage_pct ?? '—'}% del padrón materializado. Estado tributario usa el padrón completo.` });
    } else if (state.lens === 'OSFL') {
      items.unshift({ level: 'warn', title: 'Candidatas R.8', body: `${count(s.r8_candidates)} entidades cumplen reglas de candidatura R.8; es una hipótesis de revisión, no una clasificación jurídica.` });
    } else if (state.lens === 'RES') {
      items.unshift({ level: 'info', title: 'Pulso de constituciones', body: `${count(s.latest_year_count)} sociedades corresponden al último año observado (${s.latest_constitution_year || '—'}).` });
    } else if (state.lens === 'SANCIONES') {
      items.unshift({ level: 'warn', title: 'Volumen administrativo', body: `${count(s.events)} eventos se agrupan en ${count(s.total)} entidades; sanción administrativa no equivale a señal LA/FT.` });
    }
    return items.slice(0, 5);
  }

  function insightsPanel(state, out) {
    return node('section', { class: 'uiv2-panel uiv2-insights' }, [
      node('header', { class: 'uiv2-panel-head' }, [node('div', {}, [node('span', { class: 'uiv2-panel-kicker', text: 'LECTURA AUTOMÁTICA' }), node('h2', { text: 'Qué mirar primero' })])]),
      node('div', { class: 'uiv2-insight-list' }, deriveInsights(state, out).map((item, i) => node('article', { class: `uiv2-insight ${item.level}` }, [
        node('span', { class: 'uiv2-insight-index', text: String(i + 1).padStart(2, '0') }),
        node('div', {}, [node('strong', { text: item.title }), node('p', { text: item.body })]),
      ]))),
    ]);
  }

  function entityMeta(item, lens) {
    const bits = [];
    if (item.sector) bits.push(item.sector);
    if (item.region != null && item.region !== '') bits.push(`Región ${item.region}`);
    if (item.commune) bits.push(item.commune);
    if (lens === 'UAF' && item.ipf_band) bits.push(`IPF ${item.ipf_band}`);
    if (lens === 'SANCIONES' && item.event_count != null) bits.push(`${count(item.event_count)} evento(s)`);
    if (lens === 'RES' && item.constitution_date) bits.push(`Constitución ${String(item.constitution_date).slice(0, 10)}`);
    if (lens === 'SII' && item.status) bits.push(item.status === 'TERMINATED_AS_PUBLISHED' ? 'Término de giro' : 'Vigente');
    return bits.join(' · ');
  }

  function entityRows(api, state, items, title, subtitle) {
    const section = node('section', { class: 'uiv2-panel uiv2-entities' }, [
      node('header', { class: 'uiv2-panel-head' }, [
        node('div', {}, [node('span', { class: 'uiv2-panel-kicker', text: 'DRILL-DOWN' }), node('h2', { text: title }), node('p', { text: subtitle })]),
      ]),
    ]);
    const list = node('div', { class: 'uiv2-entity-list' });
    (items || []).slice(0, 24).forEach(item => {
      const rut = String(item.rut || '').trim();
      list.append(node('article', { class: 'uiv2-entity-row' }, [
        node('div', { class: 'uiv2-entity-main' }, [
          node('strong', { text: item.name || item.legal_name || item.entity_id || 'Entidad sin nombre' }),
          node('small', { text: rut || item.entity_id || 'Sin RUT observado' }),
        ]),
        node('div', { class: 'uiv2-entity-context' }, [
          node('span', { text: item.reason || entityMeta(item, state.lens) || 'Entidad del universo seleccionado' }),
          item.reason && entityMeta(item, state.lens) ? node('small', { text: entityMeta(item, state.lens) }) : null,
        ]),
        node('div', { class: 'uiv2-entity-score' }, [
          item.ipf_score != null ? node('span', {}, [node('small', { text: 'IPF' }), node('strong', { text: Number(item.ipf_score).toLocaleString('es-CL', { maximumFractionDigits: 1 }) })]) : null,
          item.ipa3_score != null ? node('span', {}, [node('small', { text: 'IPA3' }), node('strong', { text: Number(item.ipa3_score).toLocaleString('es-CL', { maximumFractionDigits: 1 }) })]) : null,
          item.sanction_event_count > 0 ? node('span', { class: 'warn' }, [node('small', { text: 'Sanc.' }), node('strong', { text: count(item.sanction_event_count) })]) : null,
        ]),
        node('div', { class: 'uiv2-entity-actions' }, [
          rut ? node('button', { type: 'button', text: 'Ver 360', onclick: () => api.navigate('entidad', { rut }) }) : null,
          rut ? node('button', { type: 'button', text: 'Relaciones', onclick: () => api.navigate('relaciones', { rut }) }) : null,
        ]),
      ]));
    });
    if (!items?.length) list.append(node('div', { class: 'uiv2-empty', text: 'No hay entidades para esta selección.' }));
    section.append(list);
    return section;
  }

  function membershipPanel(out, rut) {
    const map = out?.membership || {};
    return node('section', { class: 'uiv2-membership' }, [
      node('div', {}, [node('span', { class: 'uiv2-panel-kicker', text: 'CRUCE DE IDENTIDAD' }), node('strong', { text: `RUT ${rut}` })]),
      node('div', { class: 'uiv2-membership-grid' }, Object.entries(LENSES).map(([id, lens]) => {
        const item = map[id] || { present: false };
        return node('article', { class: item.present ? 'present' : '' }, [
          node('span', { text: lens.label }), node('strong', { text: item.present ? 'Observado' : 'No observado' }),
          item.name ? node('small', { text: item.name }) : null,
        ]);
      })),
      node('small', { text: '“No observado” significa ausencia en el snapshot consultado; no inexistencia jurídica ni material.' }),
    ]);
  }

  async function renderEntityWorkbench(host, api, state, intelligence, serial) {
    const q = state.q.trim();
    if (q) {
      if ((state.lens === 'SII' || state.lens === 'RES') && q.length < 2) {
        host.append(entityRows(api, state, [], 'Búsqueda acotada', 'Escribe al menos 2 caracteres para consultar universos masivos.'));
        return;
      }
      const holder = node('div', {}, [loading('Buscando entidades…')]); host.append(holder);
      try {
        const jobs = [global.AtlasV2Universes.entities(state.lens, q, { limit: 40, route: `universos:${state.lens}:search` })];
        if (validRut(q)) jobs.push(global.AtlasV2Universes.membership(q, { route: 'universos:membership' }));
        const results = await Promise.all(jobs);
        if (serial !== renderSerial || !holder.isConnected) return;
        clear(holder);
        const entities = results[0];
        if (results[1]) holder.append(membershipPanel(results[1], global.AtlasV2Universes.canonicalRut(q)));
        holder.append(entityRows(api, state, entities.items, 'Resultados de búsqueda', `${entities.items.length} resultado(s) en la lente ${LENSES[state.lens].label}.`));
      } catch (error) {
        if (serial !== renderSerial || !holder.isConnected) return;
        clear(holder); holder.append(errorBox(error));
      }
      return;
    }

    if (state.key) {
      const selected = intelligence.distributions?.[state.dimension]?.find(item => String(item.key) === state.key);
      const holder = node('div', {}, [loading('Abriendo selección…')]); host.append(holder);
      try {
        const out = await global.AtlasV2Universes.slice(state.lens, state.dimension, state.key, { limit: 40, route: `universos:${state.lens}:slice` });
        if (serial !== renderSerial || !holder.isConnected) return;
        clear(holder);
        holder.append(entityRows(
          api, state, out.items,
          selected?.label || state.key,
          `${count(out.summary?.entity_count)} entidades en esta categoría · ${out.items.length} visibles para revisión.`,
        ));
      } catch (error) {
        if (serial !== renderSerial || !holder.isConnected) return;
        clear(holder); holder.append(errorBox(error));
      }
      return;
    }

    host.append(entityRows(api, state, intelligence.items, 'Entidades que conviene mirar', 'Selección priorizada por hechos o condiciones observables de esta lente; no constituye una conclusión AML/FT.'));
  }

  function secondaryDistribution(state, out) {
    const dims = LENSES[state.lens].dimensions.filter(([id]) => id !== state.dimension);
    if (!dims.length) return null;
    const [dim, label] = dims[0];
    const rows = Array.isArray(out.distributions?.[dim]) ? out.distributions[dim].slice(0, 8) : [];
    const total = rows.reduce((a, b) => a + (Number(b.entity_count) || 0), 0);
    return node('section', { class: 'uiv2-panel uiv2-mini-distribution' }, [
      node('header', { class: 'uiv2-panel-head' }, [node('div', {}, [node('span', { class: 'uiv2-panel-kicker', text: 'SEGUNDA LECTURA' }), node('h2', { text: label })])]),
      node('div', { class: 'uiv2-mini-list' }, rows.map(item => node('div', {}, [
        node('span', { text: item.label || item.key }),
        node('strong', { text: compact(item.entity_count) }),
        node('small', { text: pct(item.entity_count, total) }),
      ]))),
    ]);
  }

  function methodology(out) {
    const basis = out.semantics?.population_basis || 'Fuente materializada';
    return node('details', { class: 'uiv2-method' }, [
      node('summary', { text: 'Método, cobertura y cautelas' }),
      node('div', {}, [
        node('p', { text: `Base poblacional: ${basis}. Las lentes conservan su propio grano y no deben sumarse entre sí.` }),
        node('p', { text: 'Los cruces entre universos usan RUT exacto. Una coincidencia de presencia no hereda sanción, riesgo ni condición desde otra fuente.' }),
        out.semantics?.regional_sector_basis ? node('p', { text: `Región/sector SII: ${out.semantics.regional_sector_basis}; cobertura ${out.semantics.regional_sector_coverage_pct ?? '—'}%.` }) : null,
      ]),
    ]);
  }

  async function render(container, route, api) {
    injectStyle();
    const serial = ++renderSerial;
    const state = paramsFrom(route);
    container.append(node('main', { class: 'uiv2-shell' }, [pageHead(api, state), lensRail(api, state)]));
    const shell = container.querySelector('.uiv2-shell');
    const live = node('section', { class: 'uiv2-live' }, [loading()]);
    shell.append(live);

    if (!global.AtlasV2Universes?.intelligence) {
      clear(live); live.append(errorBox(new Error('Adapter de inteligencia poblacional no disponible.'))); return;
    }

    try {
      const out = await global.AtlasV2Universes.intelligence(state.lens, { route: `universos:${state.lens}:intelligence` });
      if (serial !== renderSerial || !live.isConnected) return;
      clear(live);
      live.append(
        kpiStrip(state.lens, out.summary || {}),
        node('section', { class: 'uiv2-grid-main' }, [distributionChart(api, state, out), intersectionsPanel(api, state, out)]),
        node('section', { class: 'uiv2-grid-secondary' }, [insightsPanel(state, out), secondaryDistribution(state, out)]),
      );
      const entitiesHost = node('section', { class: 'uiv2-workbench' });
      live.append(entitiesHost, methodology(out));
      void renderEntityWorkbench(entitiesHost, api, state, out, serial);
      global.__ATLAS_V2_UNIVERSES_SURFACE__ = Object.freeze({
        installed: true,
        route: 'universos',
        mode: 'POPULATION_INTELLIGENCE_V2',
        lens: state.lens,
        interactiveDrilldown: true,
      });
    } catch (error) {
      if (serial !== renderSerial || !live.isConnected) return;
      clear(live); live.append(errorBox(error));
    }
  }

  function register() {
    if (!global.AtlasV2Shell?.registerSurface) return false;
    global.AtlasV2Shell.registerSurface('universos', render);
    global.__ATLAS_V2_UNIVERSES_SURFACE__ = Object.freeze({ installed: true, route: 'universos', mode: 'POPULATION_INTELLIGENCE_V2' });
    return true;
  }

  if (!register()) global.addEventListener('atlas:v2-shell-ready', register, { once: true });
})(window);