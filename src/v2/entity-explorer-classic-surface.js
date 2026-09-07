'use strict';

(function installAtlasV2ClassicEntityExplorer(global) {
  if (global.__ATLAS_V2_ENTITY_EXPLORER_CLASSIC__) return;

  const VERSION = 'v2-primary-6-entidades-classic-1';
  const PAGE = 25;
  const PRODUCERS = Object.freeze([
    ['sii', 'RADAR_SII', 'SII'],
    ['uaf', 'RADAR_UAF', 'UAF'],
    ['osfl', 'RADAR_OSFL', 'OSFL'],
    ['press', 'RADAR_PRENSA', 'Radar Prensa'],
    ['san', 'RADAR_SANCIONES', 'Sanciones'],
  ]);
  const BAND_ORDER = ['MUY_ALTA', 'ALTA', 'MEDIA', 'BAJA', 'NONE'];
  const BAND_LABEL = Object.freeze({ MUY_ALTA: 'Muy alta', ALTA: 'Alta', MEDIA: 'Media', BAJA: 'Baja', NONE: 'Sin marca' });
  const state = {
    meta: null,
    metaPromise: null,
    serial: 0,
    suggestSerial: 0,
    suggestTimer: null,
    rows: [],
    total: null,
    query: '',
    mode: 'idle',
    sheetItem: null,
    bound: false,
  };

  function node(tag, attrs = {}, children = []) {
    const element = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value == null) return;
      if (key === 'class') element.className = value;
      else if (key === 'text') element.textContent = String(value);
      else if (key === 'dataset' && value && typeof value === 'object') Object.entries(value).forEach(([name, entry]) => { element.dataset[name] = String(entry); });
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
  function arr(value) { return Array.isArray(value) ? value : []; }
  function numeric(value) { if (value === null || value === undefined || value === '') return null; const out = Number(value); return Number.isFinite(out) ? out : null; }
  function fmt(value, digits = 0) { const out = numeric(value); return out == null ? '—' : out.toLocaleString('es-CL', { maximumFractionDigits: digits, minimumFractionDigits: digits }); }
  function pct(value) { const out = numeric(value); if (out == null) return null; return Math.max(0, Math.min(100, out <= 1 ? out * 100 : out)); }
  function text(value, fallback = '—') { const out = String(value ?? '').trim(); return out || fallback; }
  function shortDate(value) { if (!value) return '—'; const d = new Date(value); return Number.isNaN(d.getTime()) ? String(value).slice(0, 10) : d.toLocaleDateString('es-CL'); }
  function bandKey(value) { const key = String(value || '').toUpperCase(); return BAND_ORDER.includes(key) ? key : 'NONE'; }
  function bandClass(value) { const key = bandKey(value); return key === 'MUY_ALTA' ? 'very-high' : key === 'ALTA' ? 'high' : key === 'MEDIA' ? 'medium' : key === 'BAJA' ? 'low' : 'none'; }
  function sourceSet(item) { return new Set(arr(item?.sources).map(value => String(value).toUpperCase())); }
  function isUaf(item) { return item?.isUafObserved === true || sourceSet(item).has('RADAR_UAF'); }
  function isSanctioned(item) { return item?.isSanctioned === true || sourceSet(item).has('RADAR_SANCIONES'); }
  function modeLabel(query) {
    const q = String(query || '').trim();
    if (!q) return ['Sin término', 'empty'];
    if (/^@/.test(q)) return ['Identidad digital', 'digital'];
    const compact = q.replace(/[.\s-]/g, '');
    if (/^[0-9K]+$/i.test(compact)) return ['RUT', 'rut'];
    if (/^ENT-/i.test(q)) return ['Entity ID', 'entity'];
    return ['Razón social', 'name'];
  }

  function routeState() {
    const raw = String(location.hash || '#/explorar').replace(/^#\/?/, '');
    const [path, queryString = ''] = raw.split('?');
    const id = path.split('/').filter(Boolean)[0] || 'explorar';
    const params = new URLSearchParams(queryString);
    return { id, params };
  }

  function selectedEntity(route) {
    return Boolean(route.params.get('entity_id') || route.params.get('rut'));
  }

  function filtersFrom(route) {
    return {
      region: route.params.get('region') || '',
      entityType: route.params.get('type') || '',
      minSources: Number(route.params.get('min') || 0) || 0,
      uaf: route.params.get('uaf') === '1',
      sanctioned: route.params.get('san') === '1',
      sort: ['coverage', 'name', 'updated', 'priority'].includes(route.params.get('sort')) ? route.params.get('sort') : 'coverage',
      limit: PAGE,
      offset: Number(route.params.get('offset') || 0) || 0,
    };
  }

  function hasFilters(filters) {
    return Boolean(filters.region || filters.entityType || filters.minSources || filters.uaf || filters.sanctioned || filters.sort !== 'coverage');
  }

  function navigateExplorer(api, current, patch = {}, options = {}) {
    const next = {
      q: patch.q !== undefined ? patch.q : current.params.get('q') || '',
      region: patch.region !== undefined ? patch.region : current.params.get('region') || '',
      type: patch.type !== undefined ? patch.type : current.params.get('type') || '',
      min: patch.min !== undefined ? patch.min : current.params.get('min') || '',
      uaf: patch.uaf !== undefined ? patch.uaf : current.params.get('uaf') || '',
      san: patch.san !== undefined ? patch.san : current.params.get('san') || '',
      sort: patch.sort !== undefined ? patch.sort : current.params.get('sort') || '',
      offset: patch.offset !== undefined ? patch.offset : current.params.get('offset') || '',
    };
    if (options.clearQuery) next.q = '';
    if (options.clearFilters) Object.assign(next, { region: '', type: '', min: '', uaf: '', san: '', sort: '', offset: '' });
    api.navigate('entidad', next);
  }

  function renameSection() {
    const title = document.querySelector('.atlas-v2-topbar-title');
    if (routeState().id === 'entidad' && title) title.textContent = 'Entidades';
    document.querySelectorAll('.atlas-v2-nav button').forEach(button => {
      const spans = button.querySelectorAll(':scope > span');
      if (spans.length >= 2 && spans[1].textContent?.trim() === 'Entidad 360') spans[1].textContent = 'Entidades';
    });
  }

  async function ensureMeta() {
    if (state.meta) return state.meta;
    if (state.metaPromise) return state.metaPromise;
    if (!global.AtlasV2EntityExplorer?.meta) throw new Error('Explorador gobernado de entidades no disponible');
    state.metaPromise = global.AtlasV2EntityExplorer.meta({ route: 'entidad:classic-meta' })
      .then(out => { state.meta = out; return out; })
      .finally(() => { state.metaPromise = null; });
    return state.metaPromise;
  }

  function producerFingerprint(item) {
    const sources = sourceSet(item);
    const host = node('div', { class: 'aex2-fingerprint', role: 'img', 'aria-label': `Fuentes observadas: ${item.sourceCount || sources.size || 0}` });
    PRODUCERS.forEach(([cls, code, label]) => host.append(node('i', { class: sources.has(code) ? `on ${cls}` : '', title: `${label}: ${sources.has(code) ? 'con dato materializado' : 'sin dato materializado'}` })));
    host.append(node('b', { text: String(item.sourceCount || sources.size || 0) }));
    return host;
  }

  function scoreSignature(item) {
    const values = [
      ['registry', numeric(item.registryGroupScore) || 0],
      ['economic', numeric(item.economicGroupScore) || 0],
      ['sanctions', numeric(item.sanctionsGroupScore) || 0],
    ];
    const total = values.reduce((sum, [, value]) => sum + value, 0);
    const host = node('div', { class: `aex2-signature ${total ? '' : 'empty'}`.trim(), title: total ? 'Composición registral · económica · sancionatoria' : 'Sin marca IPA3 materializada' });
    if (total) values.filter(([, value]) => value > 0).forEach(([cls, value]) => host.append(node('i', { class: cls, style: `--aex2-part:${value / total}` })));
    return host;
  }

  function scoreGauge(item) {
    const value = numeric(item.ipa3Score);
    const cls = bandClass(item.priorityBand);
    return node('div', { class: 'aex2-score-cell' }, [
      node('b', { class: cls, text: value == null || value <= 0 ? '—' : fmt(value, 1), title: value == null || value <= 0 ? 'Ninguna marca IPA3 activa en el corte' : `IPA3 ${fmt(value, 1)} · ${BAND_LABEL[bandKey(item.priorityBand)]}` }),
      node('span', { class: `aex2-gauge ${cls}` }, value == null || value <= 0 ? [] : [node('i', { style: `--aex2-score:${Math.max(0.04, Math.min(1, value / 100))}` })]),
    ]);
  }

  function statusChips(item) {
    const host = node('div', { class: 'aex2-status-chips' });
    if (isUaf(item)) host.append(node('span', { class: 'uaf', text: 'UAF' }));
    if (isSanctioned(item)) host.append(node('span', { class: 'san', text: 'Sanción' }));
    if (item.resultTier === 'PRESS_CONTEXT') host.append(node('span', { class: 'press', text: 'Prensa · contexto' }));
    if (item.resultTier === 'EXACT_IDENTITY') host.append(node('span', { class: 'exact', text: 'Identidad exacta' }));
    return host;
  }

  function searchMatchChip(item) {
    const score = pct(item?.raw?.match_score ?? item?.matchScore);
    if (score == null) return null;
    return node('span', { class: 'aex2-match', text: `Coincidencia ${Math.round(score)}%`, title: 'Coincidencia de identidad o contexto nominal; no es probabilidad de riesgo.' });
  }

  function resultRow(item, api, quickSheet) {
    const identity = node('div', { class: 'aex2-result-id' }, [
      node('div', { class: 'aex2-result-name' }, [node('strong', { text: item.name || item.entityId || 'Entidad sin etiqueta' }), searchMatchChip(item)]),
      node('span', { text: [item.rut || 'sin RUT', item.region || 'sin territorio', item.commune].filter(Boolean).join(' · ') }),
      statusChips(item),
    ]);
    const actions = node('div', { class: 'aex2-result-actions' }, [
      node('button', { type: 'button', class: 'aex2-act', text: 'Ficha', onclick: () => quickSheet.open(item) }),
      node('button', { type: 'button', class: 'aex2-act primary', text: 'Expediente', onclick: () => api.navigate('entidad', { entity_id: item.entityId, rut: item.rut || '', q: state.query || item.name || '' }) }),
    ]);
    return node('article', { class: 'aex2-result-row' }, [
      node('div', { class: 'aex2-result-source' }, [producerFingerprint(item)]),
      identity,
      node('div', { class: 'aex2-result-signature' }, [scoreSignature(item)]),
      scoreGauge(item),
      actions,
    ]);
  }

  function legend() {
    const print = node('span', { class: 'aex2-fingerprint sample' });
    PRODUCERS.forEach(([cls, , label]) => print.append(node('i', { class: `on ${cls}`, title: label })));
    const signature = node('span', { class: 'aex2-signature sample' }, [node('i', { class: 'registry', style: '--aex2-part:1' }), node('i', { class: 'economic', style: '--aex2-part:1' }), node('i', { class: 'sanctions', style: '--aex2-part:1' })]);
    const gauge = node('span', { class: 'aex2-gauge sample high' }, [node('i', { style: '--aex2-score:.62' })]);
    return node('div', { class: 'aex2-legend' }, [
      node('span', {}, [print, ' huella de productores']),
      node('span', {}, [signature, ' registral · económica · sancionatoria']),
      node('span', {}, [gauge, ' IPA3 v0.4-shadow']),
    ]);
  }

  function histogram(rows) {
    const counts = Object.fromEntries(BAND_ORDER.map(key => [key, 0]));
    rows.forEach(item => { counts[bandKey(item.priorityBand)] += 1; });
    const max = Math.max(1, ...Object.values(counts));
    return node('div', { class: 'aex2-hist' }, BAND_ORDER.map(key => node('div', { class: 'aex2-hist-col' }, [
      node('b', { text: fmt(counts[key]) }),
      node('i', { class: bandClass(key), style: `--aex2-height:${Math.max(0.05, counts[key] / max)}` }),
      node('span', { text: BAND_LABEL[key] }),
    ])));
  }

  function conditionMatrix(rows) {
    const buckets = [
      ['1 fuente', item => Number(item.sourceCount || 0) <= 1],
      ['2 fuentes', item => Number(item.sourceCount || 0) === 2],
      ['3+ fuentes', item => Number(item.sourceCount || 0) >= 3],
    ];
    const conditions = [
      ['Base', item => !isUaf(item) && !isSanctioned(item)],
      ['UAF', item => isUaf(item) && !isSanctioned(item)],
      ['Sanción', item => !isUaf(item) && isSanctioned(item)],
      ['Ambos', item => isUaf(item) && isSanctioned(item)],
    ];
    const host = node('div', { class: 'aex2-matrix' }, [node('span')]);
    conditions.forEach(([label]) => host.append(node('span', { class: 'head', text: label })));
    buckets.forEach(([label, bucket]) => {
      host.append(node('span', { class: 'side', text: label }));
      conditions.forEach(([, condition]) => {
        const count = rows.filter(item => bucket(item) && condition(item)).length;
        host.append(node('i', { class: count ? '' : 'zero', style: `--aex2-heat:${Math.min(1, count / Math.max(1, rows.length / 3))}`, text: fmt(count) }));
      });
    });
    return host;
  }

  function territoryBars(rows) {
    const counts = new Map();
    rows.forEach(item => {
      const label = item.region || 'Sin región';
      counts.set(label, (counts.get(label) || 0) + 1);
    });
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7);
    const max = Math.max(1, ...ranked.map(([, value]) => value));
    if (!ranked.length) return node('div', { class: 'aex2-empty-mini', text: 'Sin territorio materializado en los resultados.' });
    return node('div', { class: 'aex2-bars' }, ranked.map(([label, value]) => node('div', { class: 'aex2-bar' }, [
      node('span', { text: label }),
      node('em', {}, [node('i', { style: `--aex2-width:${value / max}` })]),
      node('b', { text: fmt(value) }),
    ])));
  }

  function panorama(rows) {
    if (!rows.length) return node('div', { class: 'aex2-panorama' });
    return node('section', { class: 'aex2-panorama' }, [
      node('article', { class: 'aex2-card' }, [node('h3', { text: 'Prioridad analítica' }), histogram(rows), node('small', { text: 'Distribución sobre filas cargadas. IPA3 ordena revisión; no es probabilidad.' })]),
      node('article', { class: 'aex2-card' }, [node('h3', { text: 'Cobertura × condición' }), conditionMatrix(rows), node('small', { text: 'Cobertura describe observación de fuentes, no riesgo.' })]),
      node('article', { class: 'aex2-card' }, [node('h3', { text: 'Territorios observados' }), territoryBars(rows), node('small', { text: 'Composición de los resultados cargados.' })]),
    ]);
  }

  function summaryStrip(rows, total) {
    return node('div', { class: 'aex2-strip' }, [
      node('div', {}, [node('b', { text: fmt(rows.length) }), node('span', { text: 'cargadas' })]),
      node('div', {}, [node('b', { text: total == null ? '—' : fmt(total) }), node('span', { text: 'en universo filtrado' })]),
      node('div', {}, [node('b', { text: fmt(rows.filter(item => Number(item.sourceCount || 0) >= 3).length) }), node('span', { text: '3+ fuentes' })]),
      node('div', {}, [node('b', { text: fmt(rows.filter(isUaf).length) }), node('span', { text: 'UAF' })]),
      node('div', {}, [node('b', { text: fmt(rows.filter(isSanctioned).length) }), node('span', { text: 'sanciones' })]),
    ]);
  }

  function resultState(title, message, cls = '') {
    return node('div', { class: `aex2-state ${cls}`.trim() }, [node('strong', { text: title }), node('span', { text: message })]);
  }

  function resultContainer() {
    return node('section', { class: 'aex2-results' }, [legend(), node('div', { class: 'aex2-results-body' })]);
  }

  function renderRows(host, rows, api, quickSheet) {
    clear(host);
    if (!rows.length) {
      host.append(resultState('Sin coincidencias bajo los criterios activos.', 'Prueba con otra identidad o retira una faceta.'));
      return;
    }
    rows.forEach(item => host.append(resultRow(item, api, quickSheet)));
  }

  function applyLocalFilters(rows, filters) {
    return rows.filter(item => {
      if (filters.region && item.region !== filters.region) return false;
      if (filters.entityType && item.entityType !== filters.entityType) return false;
      if (filters.minSources && Number(item.sourceCount || 0) < filters.minSources) return false;
      if (filters.uaf && !isUaf(item)) return false;
      if (filters.sanctioned && !isSanctioned(item)) return false;
      return true;
    });
  }

  function screeningPanel() {
    const body = node('div', { class: 'aex2-screen-body' }, [node('span', { class: 'aex2-loading-inline', text: 'El screening se ejecuta al buscar una identidad.' })]);
    return { root: node('section', { class: 'aex2-screening' }, [node('header', {}, [node('div', {}, [node('span', { class: 'aex2-eyebrow', text: 'SCREENING INTERNACIONAL' }), node('h3', { text: 'Listas oficiales y fuentes de contexto' })]), node('span', { class: 'aex2-live', text: 'ON DEMAND' })]), body]), body };
  }

  function renderScreening(body, screening) {
    clear(body);
    if (!screening || screening.status !== 'ready') {
      body.append(resultState('Screening no completado', screening?.message || screening?.code || 'No fue posible completar la consulta de listas en esta ejecución.', 'warning'));
      return;
    }
    const entries = Object.entries(screening.sources || {});
    const officialCodes = new Set(['UN_SANCTIONS', 'OFAC', 'EU_SANCTIONS', 'UK_SANCTIONS', 'IDB_SANCTIONS', 'WORLD_BANK', 'OPENSANCTIONS']);
    const official = entries.filter(([code]) => officialCodes.has(code));
    const context = entries.filter(([code]) => !officialCodes.has(code));
    const candidates = official.flatMap(([code, source]) => arr(source?.records).map(record => ({ code, source, record })));
    const maxConfidence = candidates.reduce((max, item) => Math.max(max, pct(item.record?.match_confidence) || 0), 0);
    const executed = official.filter(([, source]) => String(source?.status || '') === 'fresh').length;
    const degraded = official.filter(([, source]) => !['fresh', 'no_identity', 'no_name'].includes(String(source?.status || '')));
    body.append(node('div', { class: 'aex2-screen-metrics' }, [
      node('div', {}, [node('b', { text: fmt(executed) }), node('span', { text: 'fuentes ejecutadas' })]),
      node('div', {}, [node('b', { text: fmt(candidates.length) }), node('span', { text: 'candidatos' })]),
      node('div', {}, [node('b', { text: candidates.length ? `${Math.round(maxConfidence)}%` : '—' }), node('span', { text: 'máx. coincidencia' })]),
      node('div', {}, [node('b', { text: fmt(degraded.length) }), node('span', { text: 'fuentes degradadas' })]),
    ]));

    if (candidates.length) {
      const details = node('div', { class: 'aex2-screen-details', dataset: { open: 'false' } });
      const toggle = node('button', { class: 'aex2-screen-toggle', type: 'button', text: `Ver ${candidates.length} coincidencia(s)`, onclick: () => { const open = details.dataset.open !== 'true'; details.dataset.open = open ? 'true' : 'false'; toggle.textContent = open ? 'Ocultar resultados' : `Ver ${candidates.length} coincidencia(s)`; } });
      candidates.sort((a, b) => (pct(b.record?.match_confidence) || 0) - (pct(a.record?.match_confidence) || 0)).slice(0, 30).forEach(item => {
        const confidence = pct(item.record?.match_confidence);
        const link = item.record?.source_url ? node('a', { href: item.record.source_url, target: '_blank', rel: 'noopener noreferrer', text: 'Abrir fuente' }) : null;
        details.append(node('article', { class: 'aex2-screen-row' }, [
          node('div', {}, [node('span', { class: 'aex2-eyebrow', text: item.code.replace(/_/g, ' ') }), node('strong', { text: item.record?.related_entity_name || item.record?.title || 'Candidato' }), node('small', { text: item.record?.match_method || item.record?.summary || 'Coincidencia candidata' })]),
          node('div', { class: 'aex2-screen-row-side' }, [node('b', { text: confidence == null ? '—' : `${Math.round(confidence)}%` }), link]),
        ]));
      });
      body.append(toggle, details);
    } else if (executed) {
      body.append(node('div', { class: 'aex2-screen-clear' }, [node('strong', { text: 'Sin candidatos en las fuentes que respondieron como frescas.' }), node('span', { text: 'Esto no equivale a ausencia absoluta ni reemplaza revisión adicional.' })]));
    }

    if (context.length) {
      const contextCandidates = context.flatMap(([code, source]) => arr(source?.records).map(record => ({ code, record })));
      if (contextCandidates.length) body.append(node('div', { class: 'aex2-context-note', text: `${fmt(contextCandidates.length)} coincidencia(s) adicional(es) en fuentes de contexto no sancionatorias.` }));
    }
    body.append(node('div', { class: 'aex2-guardrail' }, [node('strong', { text: 'Coincidencia ≠ identidad firme ni riesgo. ' }), 'El porcentaje expresa similitud de la coincidencia y cada candidato requiere revisión del analista.']));
  }

  function digitalPanel() {
    const root = node('section', { class: 'aex2-digital', dataset: { open: 'false' } });
    const input = node('input', { type: 'search', placeholder: 'alias o username, sin @', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Alias o username' });
    const body = node('div', { class: 'aex2-digital-body' });
    const run = async depth => {
      const username = input.value.trim().replace(/^@/, '');
      if (username.length < 2) return;
      clear(body); body.append(node('span', { class: 'aex2-loading-inline', text: `Buscando @${username}…` }));
      const out = await global.AtlasV2Entity360.searchDigitalIdentity(username, { depth });
      clear(body);
      if (out.status !== 'ready') { body.append(resultState('Identidad digital no disponible', out.message || out.code || 'No fue posible completar la consulta.', 'warning')); return; }
      body.append(node('div', { class: 'aex2-guardrail' }, [node('strong', { text: `${fmt(out.records?.length)} perfil(es) técnico(s) observado(s). ` }), 'Username ≠ identidad; exige corroboración independiente.']));
      arr(out.records).slice(0, 24).forEach(record => {
        const confidence = pct(record.match_confidence);
        body.append(node('article', { class: 'aex2-digital-row' }, [
          node('div', {}, [node('span', { class: 'aex2-eyebrow', text: record?.evidence?.platform || 'PERFIL PÚBLICO' }), node('strong', { text: record.title || `@${username}` }), node('small', { text: arr(record?.evidence?.engines).join(' + ') || record.summary || '' })]),
          node('b', { text: confidence == null ? '—' : `${Math.round(confidence)}%` }),
        ]));
      });
    };
    input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); void run('quick'); } });
    root.append(node('header', {}, [node('div', {}, [node('span', { class: 'aex2-eyebrow', text: 'IDENTIDAD DIGITAL' }), node('h3', { text: 'Buscar alias públicos' })]), node('button', { type: 'button', class: 'aex2-close-inline', text: 'Cerrar', onclick: () => { root.dataset.open = 'false'; } })]), node('div', { class: 'aex2-digital-command' }, [input, node('button', { type: 'button', text: 'Búsqueda rápida', onclick: () => void run('quick') }), node('button', { type: 'button', text: 'Profundizar', onclick: () => void run('deep') })]), body);
    return { root, input, body, open: () => { root.dataset.open = 'true'; setTimeout(() => input.focus(), 0); } };
  }

  function quickSheet(root, api) {
    const scrim = node('div', { class: 'aex2-scrim', dataset: { open: 'false' } });
    const sheet = node('aside', { class: 'aex2-sheet', 'aria-hidden': 'true', 'aria-label': 'Ficha rápida de entidad' });
    const kicker = node('span', { class: 'aex2-eyebrow', text: 'FICHA RÁPIDA' });
    const title = node('h3', { text: '—' });
    const sub = node('p');
    const body = node('div', { class: 'aex2-sheet-body' });
    const openDossier = node('button', { type: 'button', class: 'aex2-btn primary', text: 'Abrir Expediente 360' });
    const close = () => { sheet.classList.remove('open'); sheet.setAttribute('aria-hidden', 'true'); scrim.dataset.open = 'false'; state.sheetItem = null; };
    const closeButton = node('button', { type: 'button', class: 'aex2-sheet-close', text: '×', 'aria-label': 'Cerrar ficha rápida', onclick: close });
    sheet.append(node('header', {}, [node('div', {}, [kicker, title, sub]), closeButton]), body, node('footer', {}, [openDossier, node('button', { type: 'button', class: 'aex2-btn', text: 'Cerrar', onclick: close })]));
    scrim.addEventListener('click', close);
    root.append(scrim, sheet);

    const pair = (label, value) => node('div', { class: 'aex2-dl-row' }, [node('dt', { text: label }), node('dd', { text: value || '—' })]);
    const section = (heading, children) => node('section', { class: 'aex2-sheet-section' }, [node('h4', { text: heading }), ...(Array.isArray(children) ? children : [children])]);

    const open = item => {
      state.sheetItem = item;
      kicker.textContent = item.resultTier === 'PRESS_CONTEXT' ? 'CONTEXTO NOMINAL · PRENSA' : 'FICHA RÁPIDA';
      title.textContent = item.name || item.entityId;
      sub.textContent = `${item.rut || 'RUT no resuelto'} · ${item.entityId || 'sin Entity ID'}`;
      clear(body);
      body.append(node('div', { class: 'aex2-sheet-visual' }, [producerFingerprint(item), scoreSignature(item), scoreGauge(item)]));
      body.append(section('Identidad y procedencia', node('dl', { class: 'aex2-dl' }, [pair('Entity ID', item.entityId), pair('RUT', item.rut || 'no resuelto'), pair('Territorio', [item.commune, item.region].filter(Boolean).join(' · ') || 'no materializado'), pair('Cobertura', `${item.sourceCount || 0} fuente(s)`), pair('Confianza identidad', item.identityConfidence == null ? '—' : `${Math.round(pct(item.identityConfidence) || 0)}%`)])));
      body.append(section('Roles y fuentes', node('div', { class: 'aex2-chipset' }, [...item.roles, ...item.sources].slice(0, 16).map(value => node('span', { text: value.replace(/^RADAR_/, '') })) )));
      const live = node('div', { class: 'aex2-sheet-live' }, [node('span', { class: 'aex2-loading-inline', text: 'Consultando perfil tributario, UAF, IPA3 y sanciones…' })]);
      body.append(live);
      openDossier.onclick = () => api.navigate('entidad', { entity_id: item.entityId, rut: item.rut || '', q: state.query || item.name || '' });
      sheet.classList.add('open'); sheet.setAttribute('aria-hidden', 'false'); scrim.dataset.open = 'true';

      const reference = { entityId: item.entityId, rut: item.rut || '', name: item.name || '' };
      Promise.all([global.AtlasV2Entity360.readCore(reference, { timeoutMs: 12000 }), global.AtlasV2Entity360.readIntelligence(reference, { timeoutMs: 16000 })]).then(([core, intelligence]) => {
        if (state.sheetItem?.entityId !== item.entityId) return;
        clear(live);
        const tax = core?.data?.tax || {};
        const dossier = intelligence?.data?.dossier || {};
        const score = dossier.ipa3_score || {};
        const marks = arr(dossier.ipa3_marks);
        const uaf = dossier.uaf_profile || {};
        const sanctions = dossier.sanction_summary || {};
        live.append(section('Situación tributaria observada', node('dl', { class: 'aex2-dl' }, [pair('Estado', tax.current_status || tax.status || 'no materializado'), pair('Tramo ventas', tax.sales_band || tax.sales_band_code || '—'), pair('Trabajadores', tax.workers_numeric == null ? '—' : fmt(tax.workers_numeric)), pair('Actividad principal', tax.main_activity || '—'), pair('Inicio actividades', shortDate(tax.activity_start_date)), pair('Término de giro', tax.termination_date ? shortDate(tax.termination_date) : 'no observado')])));
        live.append(section('Perímetro UAF', node('dl', { class: 'aex2-dl' }, [pair('Sector(es)', arr(uaf.sector_names).join(' · ') || '—'), pair('Denominaciones', arr(uaf.registry_names).length ? fmt(arr(uaf.registry_names).length) : '—'), pair('Clase registral', uaf.registry_class || '—')])));
        live.append(section('Prioridad analítica IPA3', node('div', { class: 'aex2-sheet-score' }, [node('strong', { text: numeric(score.ipa3_score) > 0 ? fmt(score.ipa3_score, 1) : '—' }), node('span', { text: numeric(score.ipa3_score) > 0 ? String(score.priority_band_shadow || '').replace(/_/g, ' ') : 'ninguna marca activa' }), node('small', { text: marks.length ? `${marks.length} marca(s) incluidas · ${marks.slice(0, 4).map(mark => mark.mark_id).join(' · ')}` : 'Sin marcas publicadas en el corte.' })])));
        live.append(section('Sanciones resueltas', node('dl', { class: 'aex2-dl' }, [pair('Eventos', sanctions.sanction_event_count == null ? '—' : fmt(sanctions.sanction_event_count)), pair('36 meses', sanctions.sanction_count_36m == null ? '—' : fmt(sanctions.sanction_count_36m)), pair('Reguladores 60m', sanctions.regulator_count_60m == null ? '—' : fmt(sanctions.regulator_count_60m)), pair('LA/FT directo resuelto', sanctions.laft_direct_count == null ? '—' : fmt(sanctions.laft_direct_count))])));
        live.append(node('div', { class: 'aex2-guardrail' }, [node('strong', { text: 'Ficha rápida ≠ conclusión. ' }), 'Sirve para decidir si abrir el expediente completo y revisar evidencia.']));
      }).catch(error => {
        if (state.sheetItem?.entityId !== item.entityId) return;
        clear(live); live.append(resultState('Perfil ampliado no disponible', error?.message || 'La ficha base permanece utilizable.', 'warning'));
      });
    };

    return { open, close };
  }

  function commandBar(route, api, digital) {
    const filters = filtersFrom(route);
    const q = route.params.get('q') || '';
    const [label, modeClass] = modeLabel(q);
    const input = node('input', { type: 'search', value: q, placeholder: 'Razón social, RUT o Entity ID', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Buscar entidad por razón social, RUT o Entity ID' });
    const suggest = node('div', { class: 'aex2-suggest', role: 'listbox' });
    const mode = node('span', { class: `aex2-mode ${modeClass}`, text: label });
    const updateMode = () => { const [nextLabel, nextClass] = modeLabel(input.value); mode.textContent = nextLabel; mode.className = `aex2-mode ${nextClass}`; };
    const execute = () => { const value = input.value.trim(); if (!value) return; if (value.startsWith('@')) { digital.open(); digital.input.value = value.replace(/^@/, ''); return; } navigateExplorer(api, route, { q: value, offset: '' }); };
    input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); execute(); } else if (event.key === 'Escape') { suggest.dataset.open = 'false'; } });
    input.addEventListener('input', () => {
      updateMode();
      clearTimeout(state.suggestTimer);
      const value = input.value.trim();
      if (value.length < 2 || value.startsWith('@')) { clear(suggest); suggest.dataset.open = 'false'; return; }
      state.suggestTimer = setTimeout(async () => {
        const serial = ++state.suggestSerial;
        try {
          const out = await global.AtlasV2EntityExplorer.suggest(value, { route: 'entidad:classic-suggest' });
          if (serial !== state.suggestSerial) return;
          clear(suggest);
          if (!out.items.length) { suggest.append(node('div', { class: 'aex2-suggest-empty', text: 'Sin prefijos consolidados' })); suggest.dataset.open = 'true'; return; }
          out.items.forEach(item => suggest.append(node('button', { type: 'button', onclick: () => { input.value = item.name || item.rut || item.entityId; updateMode(); suggest.dataset.open = 'false'; execute(); } }, [node('span', {}, [node('b', { text: item.name || item.entityId }), node('small', { text: [item.rut || 'sin RUT', item.region || 'sin territorio'].join(' · ') })]), node('em', { text: item.entityType || 'Entidad' })])));
          suggest.dataset.open = 'true';
        } catch (_error) { clear(suggest); suggest.dataset.open = 'false'; }
      }, 180);
    });

    const region = node('select', { 'aria-label': 'Territorio' }, [node('option', { value: '', text: 'Todo el territorio' })]);
    const type = node('select', { 'aria-label': 'Tipo de entidad' }, [node('option', { value: '', text: 'Todo tipo' })]);
    const min = node('select', { 'aria-label': 'Cobertura mínima' }, [['0', 'Sin mínimo'], ['2', '2 o más fuentes'], ['3', '3 o más fuentes'], ['4', '4 o más fuentes']].map(([value, textValue]) => node('option', { value, text: textValue, selected: String(filters.minSources) === value ? 'selected' : null })));
    const sort = node('select', { 'aria-label': 'Ordenar resultados' }, [['coverage', 'Cobertura de fuentes'], ['priority', 'Prioridad IPA3'], ['name', 'Razón social (A–Z)'], ['updated', 'Actualización del corte']].map(([value, textValue]) => node('option', { value, text: textValue, selected: filters.sort === value ? 'selected' : null })));
    region.value = filters.region; type.value = filters.entityType;
    region.addEventListener('change', () => navigateExplorer(api, route, { region: region.value, offset: '' }));
    type.addEventListener('change', () => navigateExplorer(api, route, { type: type.value, offset: '' }));
    min.addEventListener('change', () => navigateExplorer(api, route, { min: min.value === '0' ? '' : min.value, offset: '' }));
    sort.addEventListener('change', () => navigateExplorer(api, route, { sort: sort.value === 'coverage' ? '' : sort.value, offset: '' }));

    const uaf = node('button', { type: 'button', class: `aex2-toggle uaf ${filters.uaf ? 'on' : ''}`.trim(), 'aria-pressed': filters.uaf ? 'true' : 'false', onclick: () => navigateExplorer(api, route, { uaf: filters.uaf ? '' : '1', offset: '' }) }, [node('i'), 'UAF']);
    const san = node('button', { type: 'button', class: `aex2-toggle san ${filters.sanctioned ? 'on' : ''}`.trim(), 'aria-pressed': filters.sanctioned ? 'true' : 'false', onclick: () => navigateExplorer(api, route, { san: filters.sanctioned ? '' : '1', offset: '' }) }, [node('i'), 'Sanciones']);
    const reset = hasFilters(filters) || q ? node('button', { type: 'button', class: 'aex2-reset', text: 'Limpiar búsqueda y filtros', onclick: () => navigateExplorer(api, route, {}, { clearQuery: true, clearFilters: true }) }) : null;

    const quick = node('div', { class: 'aex2-quick' }, [node('span', { text: 'Nóminas rápidas' })]);
    const quickDefs = [
      ['uaf', 'Observadas UAF', () => navigateExplorer(api, route, { q: '', uaf: '1', san: '', type: '', min: '', offset: '' }, { clearQuery: true })],
      ['sanctioned', 'Con sanciones', () => navigateExplorer(api, route, { q: '', san: '1', uaf: '', type: '', min: '', offset: '' }, { clearQuery: true })],
      ['uaf_and_sanctioned', 'UAF + sanciones', () => navigateExplorer(api, route, { q: '', uaf: '1', san: '1', type: '', min: '', offset: '' }, { clearQuery: true })],
      ['multi_source_3', 'Multi-fuente 3+', () => navigateExplorer(api, route, { q: '', min: '3', uaf: '', san: '', type: '', offset: '' }, { clearQuery: true })],
      ['osfl', 'OSFL', () => navigateExplorer(api, route, { q: '', type: 'OSFL', uaf: '', san: '', min: '', offset: '' }, { clearQuery: true })],
      ['public_bodies', 'Organismos públicos', () => navigateExplorer(api, route, { q: '', type: 'Organismo público', uaf: '', san: '', min: '', offset: '' }, { clearQuery: true })],
    ];
    quickDefs.forEach(([key, labelText, handler]) => quick.append(node('button', { type: 'button', dataset: { quickKey: key }, onclick: handler }, [node('span', { text: labelText }), node('b', { text: '—' })])));
    quick.append(node('button', { type: 'button', class: 'digital', onclick: digital.open }, [node('span', { text: 'Identidad digital' }), node('b', { text: '@' })]));

    const command = node('section', { class: 'aex2-command' }, [
      node('div', { class: 'aex2-command-top' }, [
        node('div', { class: 'aex2-brand' }, [node('span', { class: 'aex2-eyebrow', text: 'ENTIDADES' }), node('h2', { text: 'Explorador' })]),
        node('div', { class: 'aex2-input' }, [node('i', { text: '⌕', 'aria-hidden': 'true' }), input, mode, node('button', { type: 'button', text: '×', 'aria-label': 'Limpiar término', onclick: () => { input.value = ''; updateMode(); navigateExplorer(api, route, { q: '' }); } }), suggest]),
        node('button', { type: 'button', class: 'aex2-btn primary', text: 'Buscar', onclick: execute }),
      ]),
      node('div', { class: 'aex2-command-bottom' }, [node('div', { class: 'aex2-facets' }, [region, type, min, sort, uaf, san, reset]), quick]),
    ]);

    ensureMeta().then(meta => {
      const facets = meta.facets || {};
      const currentRegion = filters.region;
      const currentType = filters.entityType;
      arr(facets.regions).forEach(entry => region.append(node('option', { value: entry.value, text: `${entry.value} · ${fmt(entry.count)}` })));
      arr(facets.entity_types).forEach(entry => type.append(node('option', { value: entry.value, text: `${entry.value} · ${fmt(entry.count)}` })));
      region.value = currentRegion; type.value = currentType;
      const counts = facets.quick_counts || {};
      quick.querySelectorAll('[data-quick-key]').forEach(button => { const badge = button.querySelector('b'); if (badge) badge.textContent = fmt(counts[button.dataset.quickKey]); });
    }).catch(() => undefined);

    return command;
  }

  function blankState() {
    return node('div', { class: 'aex2-blank' }, [node('div', { class: 'aex2-blank-icon', text: '⌕' }), node('h3', { text: 'Busca una entidad o explora una nómina' }), node('p', { text: 'La pantalla se completa cuando buscas una identidad, cambias una faceta o eliges un fenómeno de interés.' })]);
  }

  async function loadSearch(route, api, hosts, quickSheet, serial) {
    const q = route.params.get('q') || '';
    const filters = filtersFrom(route);
    state.query = q;
    state.mode = 'search';
    clear(hosts.resultsBody); hosts.resultsBody.append(resultState('Resolviendo identidad…', 'Primero se consulta el universo reconciliado. Sólo si no existe coincidencia exacta se habilita Radar Prensa con umbral alto.'));
    clear(hosts.panorama); clear(hosts.strip);
    clear(hosts.screen.body); hosts.screen.body.append(node('span', { class: 'aex2-loading-inline', text: 'El screening internacional se ejecutará sobre la identidad resuelta o el nombre consultado.' }));
    try {
      const search = await global.AtlasV2EntitySearch.search(q, { limit: 50, route: 'entidad:classic-search' });
      if (serial !== state.serial) return;
      const visible = applyLocalFilters(search.items, filters);
      state.rows = visible;
      state.total = visible.length;
      clear(hosts.strip); hosts.strip.append(summaryStrip(visible, visible.length));
      clear(hosts.panorama); hosts.panorama.append(panorama(visible));
      renderRows(hosts.resultsBody, visible, api, quickSheet);
      const stage = search.semantics?.search_stage;
      hosts.searchPolicy.textContent = stage === 'EXACT_RECONCILED'
        ? 'IDENTIDAD EXACTA · UNIVERSO RECONCILIADO'
        : stage === 'PRESS_HIGH'
          ? 'SIN EXACTA · RADAR PRENSA ≥ 86%'
          : 'BÚSQUEDA DE IDENTIDAD';
      hosts.searchPolicy.className = `aex2-search-policy ${stage === 'PRESS_HIGH' ? 'press' : 'exact'}`;

      const best = search.items.find(item => item.resultTier === 'EXACT_IDENTITY') || null;
      const screeningInput = best ? { name: best.name || q, rut: best.rut || '', entityType: best.entityType || '' } : { name: q };
      const screening = await global.AtlasV2Entity360.readScreening(screeningInput, { timeoutMs: 45000 });
      if (serial !== state.serial) return;
      renderScreening(hosts.screen.body, screening);
    } catch (error) {
      if (serial !== state.serial) return;
      clear(hosts.resultsBody); hosts.resultsBody.append(resultState('Búsqueda no disponible', error?.message || 'No fue posible resolver la identidad.', 'error'));
      clear(hosts.screen.body); hosts.screen.body.append(resultState('Screening pendiente', 'No se ejecutó porque la búsqueda principal no pudo completarse.', 'warning'));
    }
  }

  async function loadExplorer(route, api, hosts, quickSheet, serial) {
    const filters = filtersFrom(route);
    state.query = '';
    state.mode = 'explorer';
    clear(hosts.resultsBody); hosts.resultsBody.append(resultState('Consultando nómina…', 'Aplicando facetas sobre el universo consolidado de entidades.'));
    clear(hosts.screen.body); hosts.screen.body.append(node('span', { class: 'aex2-loading-inline', text: 'El screening internacional se ejecuta al buscar una identidad concreta.' }));
    try {
      const out = await global.AtlasV2EntityExplorer.explore(filters, { route: 'entidad:classic-explorer' });
      if (serial !== state.serial) return;
      state.rows = out.items;
      state.total = numeric(out.page?.total);
      clear(hosts.strip); hosts.strip.append(summaryStrip(out.items, state.total));
      clear(hosts.panorama); hosts.panorama.append(panorama(out.items));
      renderRows(hosts.resultsBody, out.items, api, quickSheet);
      hosts.searchPolicy.textContent = 'NÓMINA FILTRADA · UNIVERSO CONSOLIDADO';
      hosts.searchPolicy.className = 'aex2-search-policy explorer';
      const nextOffset = filters.offset + out.items.length;
      if (out.items.length && state.total != null && nextOffset < state.total) {
        hosts.resultsBody.append(node('div', { class: 'aex2-more' }, [node('button', { type: 'button', class: 'aex2-btn', text: `Cargar ${PAGE} siguientes`, onclick: () => navigateExplorer(api, route, { offset: String(nextOffset) }) })]));
      }
    } catch (error) {
      if (serial !== state.serial) return;
      clear(hosts.resultsBody); hosts.resultsBody.append(resultState('No fue posible cargar la nómina', error?.message || 'Revisa la sesión de datos y vuelve a intentar.', 'error'));
    }
  }

  function renderClassic(content, route, api) {
    const serial = ++state.serial;
    clear(content);
    content.dataset.entityExplorerAuthority = VERSION;
    const root = node('div', { class: 'aex2', dataset: { authority: VERSION } });
    const digital = digitalPanel();
    const command = commandBar(route, api, digital);
    const searchPolicy = node('span', { class: 'aex2-search-policy', text: 'EXPLORADOR DE IDENTIDADES' });
    const strip = node('div', { class: 'aex2-strip-host' });
    const panoramaHost = node('div', { class: 'aex2-panorama-host' });
    const results = resultContainer();
    const resultsBody = results.querySelector('.aex2-results-body');
    const screen = screeningPanel();
    root.append(command, digital.root, node('div', { class: 'aex2-statebar' }, [searchPolicy, strip]), panoramaHost, results, screen.root);
    const sheet = quickSheet(root, api);
    content.append(root);

    const q = route.params.get('q') || '';
    const filters = filtersFrom(route);
    if (q) void loadSearch(route, api, { resultsBody, panorama: panoramaHost, strip, screen, searchPolicy }, sheet, serial);
    else if (hasFilters(filters) || route.params.get('offset')) void loadExplorer(route, api, { resultsBody, panorama: panoramaHost, strip, screen, searchPolicy }, sheet, serial);
    else {
      clear(resultsBody); resultsBody.append(blankState());
      clear(strip); clear(panoramaHost);
      searchPolicy.textContent = 'SIN CONSULTA · ESPERANDO INTENCIÓN DEL ANALISTA';
      clear(screen.body); screen.body.append(node('span', { class: 'aex2-loading-inline', text: 'Las listas internacionales se consultan automáticamente al ejecutar una búsqueda de identidad.' }));
    }
  }

  function sync() {
    renameSection();
    const route = routeState();
    if (route.id !== 'entidad' || selectedEntity(route)) return;
    if (!global.AtlasV2Shell?.navigate || !global.AtlasV2EntityExplorer?.installed || !global.AtlasV2EntitySearch?.installed || !global.AtlasV2Entity360?.installed) return;
    const content = document.querySelector('.atlas-v2-content');
    if (!content) return;
    renderClassic(content, route, global.AtlasV2Shell);
  }

  function bindAfterShell() {
    if (state.bound) return;
    state.bound = true;
    global.addEventListener('hashchange', () => setTimeout(sync, 0));
    renameSection();
    setTimeout(sync, 0);
    global.__ATLAS_V2_ENTITY_EXPLORER_CLASSIC__ = Object.freeze({
      installed: true,
      version: VERSION,
      route: 'entidad',
      listMode: 'ENTITY_EXPLORER_CLASSIC_V2',
      dossierMode: 'ENTITY360_LEGACY_PARITY_V2',
      searchPolicy: 'EXACT_RECONCILED_THEN_PRESS_HIGH',
      internationalScreening: 'EVERY_IDENTITY_SEARCH',
      digitalIdentity: true,
    });
  }

  if (document.querySelector('.atlas-v2-content')) bindAfterShell();
  else global.addEventListener('atlas:v2-shell-ready', bindAfterShell, { once: true });
})(window);
