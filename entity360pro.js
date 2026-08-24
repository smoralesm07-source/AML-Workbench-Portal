/* ============================================================================
   ENTITY 360 PRO — Main Engine
   State · Enrichment pipeline · Tab renderers · Skeletons · Shortcuts · Export
   Loads AFTER app.js + enhancements.js. Overrides WB.openEntity / showEntityBrief.
   ============================================================================ */
(() => {
'use strict';

const D = window.WB_CORE;
const A = window.WB_ADVANCED || {};
const BASE = window.WB;
if (!D || !BASE) { console.error('Entity360Pro: base unavailable'); return; }

/* ── Helpers ── */
const $ = s => document.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const fmt = n => new Intl.NumberFormat('es-CL').format(Number(n || 0));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const attr = s => String(s ?? '').replace(/'/g, "\\'").replace(/"/g, '&quot;');

const PROD_LABEL = { RADAR_SII: 'SII', RADAR_UAF: 'UAF', RADAR_SANCIONES: 'Sanciones', RADAR_CGR: 'CGR', RADAR_DELICTUAL: 'Delictual', RADAR_OSFL: 'OSFL' };
const PROD_CLASS = { RADAR_SII: 'sii', RADAR_UAF: 'uaf', RADAR_SANCIONES: 'sanciones', RADAR_CGR: 'cgr', RADAR_DELICTUAL: 'delictual', RADAR_OSFL: 'osfl' };
const TYPE_LABEL = { ENTITY_CONVERGENCE: 'Convergencia multifuente', CONTEXTUAL_ANOMALY: 'Anomalía contextual', SUPERVISORY_GAP: 'Brecha supervisiva', PRUDENTIAL_SANCTION: 'Sanción prudencial', GOVERNED_AML_SIGNAL: 'Señal AML gobernada' };
const FINDING_FILE = { ENTITY_CONVERGENCE: 'ENTITY_CONVERGENCE', CONTEXTUAL_ANOMALY: 'CONTEXTUAL_ANOMALY', SUPERVISORY_GAP: 'SUPERVISORY_GAP', PRUDENTIAL_SANCTION: 'PRUDENTIAL_SANCTION', GOVERNED_AML_SIGNAL: 'GOVERNED_AML_SIGNAL' };
const REGION_ALIAS = { "Libertador Gral. Bernardo O'Higgins": "Libertador General Bernardo O'Higgins" };
const canonRegion = x => REGION_ALIAS[x] || x || '';

/* ============================================================================
   DATA LOADERS (independent of app.js private cache; reuse window globals)
   ============================================================================ */
const loaded = new Set();
const cache = { searchById: null, entity: new Map(), evidence: null, anomalies: null, sanctions: null, findingsByType: {} };

function loadScript(src, key) {
  if (loaded.has(key)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const sc = document.createElement('script'); sc.src = src; sc.async = true;
    sc.onload = () => { loaded.add(key); resolve(); };
    sc.onerror = () => reject(new Error(`No se pudo leer ${src}.`));
    document.head.appendChild(sc);
  });
}
async function ensureSearch() {
  if (cache.searchById) return;
  if (!window.WB_SEARCH) await loadScript('./data/search.js', 'search');
  cache.searchById = new Map((window.WB_SEARCH || []).map(x => [x[0], x]));
}
// Harvest any shard app.js has already loaded into the shared global, so we
// never fetch the same ~150 KB fragment twice.
function harvestShards() {
  const shards = window.WB_ENTITY_SHARDS || {};
  for (const k of Object.keys(shards)) {
    if (loaded.has(`entity-${k}`)) continue;
    for (const e of (shards[k] || [])) cache.entity.set(e.entity_id, e);
    loaded.add(`entity-${k}`);
  }
}
async function ensureEntity(id) {
  harvestShards();
  if (cache.entity.has(id)) return cache.entity.get(id);
  await ensureSearch();
  const stub = cache.searchById.get(id);
  if (!stub) return null;
  const shard = stub[7];
  await loadScript(`./data/entities/${shard}.js`, `entity-${shard}`);
  for (const e of (window.WB_ENTITY_SHARDS?.[shard] || [])) cache.entity.set(e.entity_id, e);
  return cache.entity.get(id) || null;
}
async function ensureEvidence() {
  if (cache.evidence) return;
  if (!window.WB_EVIDENCE) await loadScript('./data/evidence.js', 'evidence');
  cache.evidence = new Map((window.WB_EVIDENCE || []).map(x => [x.evidence_id, x]));
}
async function ensureAnomalies() {
  if (cache.anomalies) return;
  if (!window.WB_ANOMALIES) await loadScript('./data/anomalies.js', 'anomalies');
  cache.anomalies = window.WB_ANOMALIES || [];
}
async function ensureSanctions() {
  if (cache.sanctions) return;
  if (!window.WB_SANCTIONS) await loadScript('./data/sanctions.js', 'sanctions');
  cache.sanctions = window.WB_SANCTIONS || [];
}
async function ensureFindingType(type) {
  if (cache.findingsByType[type]) return cache.findingsByType[type];
  const fn = FINDING_FILE[type]; if (!fn) return [];
  await loadScript(`./data/findings_${fn}.js`, `finding-${fn}`);
  cache.findingsByType[type] = window.WB_FINDINGS_BY_TYPE?.[type] || [];
  return cache.findingsByType[type];
}
function sanctionDecoded(r) { return { id: r[0], date: r[1], supervisor: r[2], subject: r[3], resolution: r[4], category: r[5], identity: r[6], laft: r[7], entity: r[8], summary: r[9], evidence: r[10], amount: r[11], status: r[12] }; }

/* ============================================================================
   STATE
   ============================================================================ */
let S = {
  entity: null,          // current enriched entity
  tab: 'summary',        // active tab
  loading: {},           // per-tab loading flags
  data: {},              // per-tab loaded data
  timelineFilter: 'all',
  net: null              // network graph controller
};
const TABS = [
  { id: 'summary',   label: 'Resumen',    icon: '◫', always: true },
  { id: 'network',   label: 'Red',        icon: '◉' },
  { id: 'timeline',  label: 'Timeline',   icon: '◷' },
  { id: 'evidence',  label: 'Evidencia',  icon: '❑' },
  { id: 'signals',   label: 'Señales',    icon: '◆' },
  { id: 'findings',  label: 'Hallazgos',  icon: '⌕' },
  { id: 'sanctions', label: 'Sanciones',  icon: '§' },
  { id: 'anomalies', label: 'Anomalías',  icon: '~' }
];

/* ============================================================================
   ENRICHMENT PIPELINE
   ============================================================================ */
async function enrich(entity) {
  // Base signals already in entity; compute derived risk profile.
  const rels = entity.relaciones || [];
  const signals = entity.senales || [];
  const evidence = entity.evidence_ids || [];
  const score = entity.aml?.score || null;

  const riskProfile = computeRiskProfile(entity);
  const readiness = computeReadiness(entity);

  return {
    ...entity,
    _pro: {
      riskProfile,
      readiness,
      counts: {
        events: entity.event_count || 0,
        relations: rels.length,
        signals: signals.length,
        evidence: evidence.length,
        sanctions: (entity.roles || []).includes('SANCTIONED_ENTITY') ? (entity.event_count || 1) : 0
      },
      sources: entity.fuentes || [],
      hasNetwork: rels.length > 0 || (entity.red?.degree || 0) > 0
    }
  };
}

function computeRiskProfile(e) {
  const score = e.aml?.score;
  const band = score?.risk_band || (score ? 'INSUFFICIENT_DATA' : 'NONE');
  const bandMap = {
    CRITICAL: { cls: 'critical', es: 'Crítico', level: 5 },
    HIGH: { cls: 'high', es: 'Alto', level: 4 },
    MEDIUM: { cls: 'medium', es: 'Medio', level: 3 },
    LOW: { cls: 'low', es: 'Bajo', level: 2 },
    NONE: { cls: 'none', es: 'Sin señal', level: 1 },
    INSUFFICIENT_DATA: { cls: 'unknown', es: 'Datos insuficientes', level: 0 }
  };
  const b = bandMap[band] || bandMap.INSUFFICIENT_DATA;
  return {
    band, cls: b.cls, es: score?.risk_band_es || b.es, level: b.level,
    threat: score?.threat, vulnerability: score?.vulnerability,
    exposure: score?.exposure, overall: score?.overall_risk,
    confidence: score?.confidence, coverage: score?.coverage,
    displayValue: score?.overall_risk ?? score?.vulnerability ?? null
  };
}

function computeReadiness(e) {
  const dims = [
    { key: 'identity', ok: (e.identity_confidence || 0) >= 0.9, label: 'Identidad' },
    { key: 'sources', ok: (e.fuentes || []).length > 0, label: 'Fuentes' },
    { key: 'location', ok: !!e.ubicacion?.comuna, label: 'Territorio' },
    { key: 'evidence', ok: (e.evidence_ids || []).length > 0, label: 'Evidencia' },
    { key: 'events', ok: (e.event_count || 0) > 0, label: 'Eventos' },
    { key: 'relations', ok: (e.relaciones || []).length > 0, label: 'Red' },
    { key: 'roles', ok: (e.roles || []).length > 0, label: 'Roles' }
  ];
  return { dims, pct: Math.round(dims.filter(d => d.ok).length / dims.length * 100) };
}

/* ============================================================================
   ENTRY POINT — open a full Entity 360 Pro view
   ============================================================================ */
async function openEntity360(id) {
  S.entity = null; S.tab = 'summary'; S.data = {}; S.loading = {};
  renderShell(true);
  try {
    const raw = await ensureEntity(id);
    if (!raw) { $('#canvas').innerHTML = errorState('Entidad no disponible en el fragmento esperado.'); return; }
    S.entity = await enrich(raw);
    renderShell(false);
    renderTab('summary');
  } catch (err) {
    $('#canvas').innerHTML = errorState(err.message);
  }
}

/* ============================================================================
   SHELL RENDER (identity + kpi + tabs + context bar)
   ============================================================================ */
function renderShell(loading) {
  if (loading) { $('#canvas').innerHTML = shellSkeleton(); return; }
  const e = S.entity, p = e._pro, rp = p.riskProfile;
  const avatarClass = (e.roles || []).includes('SANCTIONED_ENTITY') ? 'sanctioned'
    : e.contexto?.sujeto_obligado ? 'so'
    : (e.tipo_entidad === 'OSFL') ? 'osfl'
    : (e.tipo_entidad === 'UNKNOWN') ? 'unknown' : '';
  const initials = (e.nombre || e.rut || '?').trim().slice(0, 2).toUpperCase();

  $('#canvas').innerHTML = `
    <div class="e360">
      ${identityCard(e, p, rp, avatarClass, initials)}
      ${kpiStrip(e, p)}
      ${contextBar(e)}
      <div class="e360-tabs" id="e360Tabs">${TABS.map(tabBtn).join('')}</div>
      <div id="e360TabContent"></div>
    </div>`;
  $('#context').innerHTML = contextPanel(e);
}

function identityCard(e, p, rp, avatarClass, initials) {
  const dv = rp.displayValue;
  return `
    <div class="e360-identity">
      <div class="e360-avatar ${avatarClass}">${esc(initials)}</div>
      <div class="e360-id-main">
        <h1 class="e360-id-name">${esc(e.nombre || e.rut || e.entity_id)}</h1>
        <div class="e360-id-rut">${esc(e.rut || e.entity_id)} · ${esc(e.tipo_entidad_es || e.tipo_entidad)}</div>
        <div class="e360-id-badges">
          ${(e.roles_es || e.roles || []).slice(0, 4).map(r => `<span class="badge badge-gray">${esc(r)}</span>`).join('')}
          <span class="risk-band risk-band-${rp.cls}">${esc(rp.es)}</span>
        </div>
      </div>
      <div class="e360-id-score">
        <div class="e360-score-value e360-score-${rp.cls}">${dv == null ? '—' : Number(dv).toFixed(0)}</div>
        <div class="e360-score-label">${dv == null ? 'Sin score' : 'Riesgo AML'}</div>
      </div>
    </div>
    <div class="e360-actions" style="margin-top:0;border-top:none;padding-top:8px">
      <button class="e360-btn primary" onclick="WB.caseEntity('${esc(e.entity_id)}')">★ Guardar en Casos</button>
      <button class="e360-btn" onclick="E360.exportEntity('${esc(e.entity_id)}','json')">↓ JSON</button>
      <button class="e360-btn" onclick="E360.exportEntity('${esc(e.entity_id)}','csv')">↓ CSV evidencia</button>
      <button class="e360-btn" onclick="window.print()">⎙ Imprimir</button>
    </div>`;
}

function kpiStrip(e, p) {
  const c = p.counts;
  const k = (val, label, sub, tab, cls = '') => `<div class="e360-kpi clickable" onclick="E360.go('${tab}')"><div class="e360-kpi-value ${cls}">${val}</div><div class="e360-kpi-label">${label}</div><div class="e360-kpi-sublabel">${sub}</div></div>`;
  const gap = e.contexto?.sujeto_obligado ? 'Sujeto obligado' : 'No observado';
  return `<div class="e360-kpi-strip">
    ${k(fmt(c.events), 'Eventos', 'asociados', 'timeline')}
    ${k(fmt(c.relations), 'Relaciones', `grado ${e.red?.degree || 0}`, 'network')}
    ${k(fmt(c.signals), 'Señales', p.riskProfile.vulnerability != null ? `vuln ${p.riskProfile.vulnerability}` : 'AML', 'signals', c.signals ? 'e360-score-high' : '')}
    ${k(fmt(c.evidence), 'Evidencia', 'referencias', 'evidence')}
    ${k(esc(gap), 'UAF', e.contexto?.sujeto_obligado ? 'inscrito' : 'screening', 'summary')}
  </div>`;
}

function contextBar(e) {
  const u = e.ubicacion || {};
  const items = [];
  items.push(`<div class="e360-context-item"><span class="e360-context-label">Ubicación</span><span class="e360-context-value">${esc(u.comuna || '—')}${u.region ? ', ' + esc(u.region) : ''}</span></div>`);
  items.push(`<div class="e360-context-item ${e.contexto?.sujeto_obligado ? 'so' : ''}"><span class="e360-context-label">Sujeto obl.</span><span class="e360-context-value">${e.contexto?.sujeto_obligado ? 'Sí' : 'No / no obs.'}</span></div>`);
  items.push(`<div class="e360-context-item"><span class="e360-context-label">Identidad</span><span class="e360-context-value">${esc(e.identity_method_es || e.identity_method)} · ${e.identity_confidence != null ? (e.identity_confidence * 100).toFixed(0) + '%' : '—'}</span></div>`);
  const srcs = (e.fuentes || []).map(s => `<span class="source-chip ${PROD_CLASS[s] || ''}">${esc(PROD_LABEL[s] || s)}</span>`).join(' ');
  items.push(`<div class="e360-context-item" style="gap:6px"><span class="e360-context-label">Fuentes</span>${srcs || '—'}</div>`);
  return `<div class="e360-context-bar">${items.join('')}</div>`;
}

function tabBtn(t) {
  const count = tabCount(t.id);
  const badge = count != null ? `<span class="badge">${count}</span>` : '';
  return `<button class="e360-tab ${t.id === S.tab ? 'active' : ''}" data-tab="${t.id}" onclick="E360.go('${t.id}')">${t.icon} ${t.label}${badge}</button>`;
}
function tabCount(id) {
  const e = S.entity; if (!e) return null; const c = e._pro.counts;
  switch (id) {
    case 'network': return c.relations || null;
    case 'evidence': return c.evidence || null;
    case 'signals': return c.signals || null;
    case 'timeline': return c.events || null;
    default: return null;
  }
}

/* ============================================================================
   CONTEXT PANEL (right sidebar)
   ============================================================================ */
function contextPanel(e) {
  const rp = e._pro.riskProfile;
  return `
    <div class="section">
      <h3 class="section-title">Perfil de riesgo</h3>
      ${riskProfileCard(e)}
    </div>
    <div class="section">
      <h3 class="section-title">Cobertura de ficha</h3>
      ${readinessCard(e._pro.readiness)}
    </div>
    <div class="section">
      <h3 class="section-title">Marcas</h3>
      <div style="display:flex;flex-wrap:wrap;gap:4px">${entityMarks(e).map(m => `<span class="badge badge-${m[1]}">${esc(m[0])}</span>`).join('') || '<span style="font-size:8px;color:var(--muted)">Sin marcas adicionales</span>'}</div>
    </div>
    <div class="e360-error" style="background:#fff9ef">
      <span class="e360-error-icon">⚠</span>
      <span class="e360-error-text">Prioridad analítica ≠ riesgo o ilegalidad. Sanción ≠ LA/FT. Missing ≠ cero. Relación ≠ propagación de riesgo.</span>
    </div>`;
}

function riskProfileCard(e) {
  const rp = e._pro.riskProfile;
  if (rp.band === 'NONE') return `<div class="e360-empty" style="padding:16px"><div class="e360-empty-desc">Sin score AML materializado para esta entidad.</div></div>`;
  const dim = (label, val) => `<div class="e360-finding-factor"><span class="e360-finding-factor-label">${label}</span><div class="e360-finding-factor-bar"><div class="e360-finding-factor-fill" style="width:${val || 0}%"></div></div><span class="e360-finding-factor-value">${val == null ? '—' : Number(val).toFixed(0)}</span></div>`;
  return `<div class="card panel" style="padding:12px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
      <span class="risk-band risk-band-${rp.cls}">${esc(rp.es)}</span>
      <span style="font-size:8px;color:var(--muted)">conf. ${rp.confidence != null ? (rp.confidence * 100).toFixed(0) + '%' : '—'} · cob. ${rp.coverage != null ? (rp.coverage * 100).toFixed(0) + '%' : '—'}</span>
    </div>
    ${dim('Amenaza', rp.threat)}
    ${dim('Vulnerabilidad', rp.vulnerability)}
    ${dim('Exposición', rp.exposure)}
    ${dim('Riesgo global', rp.overall)}
  </div>`;
}

function readinessCard(r) {
  return `<div class="card panel" style="padding:12px">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
      ${donut(r.pct)}
      <div><b style="font-size:14px">${r.pct}%</b><div style="font-size:7px;color:var(--muted)">dimensiones disponibles<br>no es score de riesgo</div></div>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:4px">
      ${r.dims.map(d => `<span class="badge ${d.ok ? 'badge-green' : 'badge-gray'}" style="opacity:${d.ok ? 1 : 0.5}">${d.ok ? '✓' : '○'} ${esc(d.label)}</span>`).join('')}
    </div>
  </div>`;
}

function donut(v) {
  const color = v >= 70 ? 'var(--green)' : v >= 40 ? 'var(--amber)' : 'var(--red)';
  return `<svg width="48" height="48" viewBox="0 0 48 48"><circle cx="24" cy="24" r="20" fill="none" stroke="var(--line)" stroke-width="5"/><circle cx="24" cy="24" r="20" fill="none" stroke="${color}" stroke-width="5" stroke-dasharray="${v / 100 * 125.6} 125.6" stroke-linecap="round" transform="rotate(-90 24 24)"/><text x="24" y="27" text-anchor="middle" font-size="12" font-weight="800" fill="var(--ink)">${v}</text></svg>`;
}

function entityMarks(e) {
  const a = [];
  if (e.contexto?.sujeto_obligado) a.push(['UAF observado', 'green']);
  if ((e.roles || []).includes('SANCTIONED_ENTITY')) a.push(['Sancionada', 'red']);
  if ((e.senales || []).length) a.push(['Señal AML', 'red']);
  if ((e.fuentes || []).length >= 2) a.push([`${e.fuentes.length} fuentes`, 'blue']);
  if ((e.relaciones || []).length) a.push(['Con red', 'purple']);
  if ((e.contexto?.sii_flags || []).length) a.push([`${e.contexto.sii_flags.length} marcas SII`, 'amber']);
  if ((e.identity_confidence || 0) >= 0.99) a.push(['Identidad exacta', 'green']);
  if (e.red?.direct_signal_neighbor_count) a.push(['Vecino de señal', 'purple']);
  return a;
}

/* ============================================================================
   TAB ROUTER
   ============================================================================ */
function go(tabId) {
  S.tab = tabId;
  document.querySelectorAll('.e360-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
  renderTab(tabId);
  const content = $('#e360TabContent');
  if (content) content.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function renderTab(tabId) {
  const box = $('#e360TabContent'); if (!box) return;
  const e = S.entity;
  switch (tabId) {
    case 'summary': box.innerHTML = tabSummary(e); break;
    case 'network': box.innerHTML = tabNetwork(e); initNetwork(e); break;
    case 'timeline': box.innerHTML = '<div class="loadingmini">Construyendo cronología…</div>'; await tabTimeline(e, box); break;
    case 'evidence': box.innerHTML = '<div class="loadingmini">Cargando evidencia…</div>'; await tabEvidence(e, box); break;
    case 'signals': box.innerHTML = tabSignals(e); break;
    case 'findings': box.innerHTML = '<div class="loadingmini">Buscando hallazgos vinculados…</div>'; await tabFindings(e, box); break;
    case 'sanctions': box.innerHTML = '<div class="loadingmini">Cargando sanciones…</div>'; await tabSanctions(e, box); break;
    case 'anomalies': box.innerHTML = '<div class="loadingmini">Cargando anomalías…</div>'; await tabAnomalies(e, box); break;
  }
}

/* ============================================================================
   TAB — SUMMARY
   ============================================================================ */
function tabSummary(e) {
  const p = e._pro, rels = e.relaciones || [];
  const brief = buildBrief(e);
  const flags = e.contexto?.sii_flags_es || [];
  return `<div class="grid grid-2 gap-3" style="align-items:start">
    <div>
      <section class="card panel">
        <div class="panel-header"><div><div class="panel-title">Síntesis determinística</div><div class="panel-subtitle">Generada desde datos materializados</div></div></div>
        <div class="panel-body">${brief}</div>
      </section>
      ${flags.length ? `<section class="card panel section"><div class="panel-title">Marcas SII contextuales</div><div class="panel-subtitle" style="margin-bottom:8px">Descriptivas — no son señales AML</div><div style="display:flex;flex-wrap:wrap;gap:4px">${flags.map(f => `<span class="badge badge-amber">${esc(f)}</span>`).join('')}</div></section>` : ''}
      <section class="card panel section">
        <div class="panel-title">Siguientes pasos sugeridos</div>
        <ul style="font-size:9px;color:var(--ink);line-height:1.7;margin:8px 0 0;padding-left:18px">${nextSteps(e).map(s => `<li>${esc(s)}</li>`).join('')}</ul>
      </section>
      ${reportabilityPanel(e)}
    </div>
    <div>
      ${p.riskProfile.band !== 'NONE' && p.riskProfile.band !== 'INSUFFICIENT_DATA' || (e.senales || []).length ? `<section class="card panel"><div class="panel-title">Radar de dimensiones AML</div>${signalRadar(e)}</section>` : ''}
      <section class="card panel ${(e.senales || []).length ? 'section' : ''}">
        <div class="panel-header"><div><div class="panel-title">Red observada</div><div class="panel-subtitle">${rels.length} contraparte(s) · pincha para navegar</div></div></div>
        ${rels.length ? miniNetworkList(rels) : emptyState('◉', 'Sin relaciones observadas', 'Esta entidad no tiene contrapartes entidad-entidad en el snapshot.')}
      </section>
    </div>
  </div>`;
}

function buildBrief(e) {
  const marks = entityMarks(e).map(x => x[0]);
  return `<b>${esc(e.nombre || e.rut)}</b> aparece en <b>${(e.fuentes || []).length}</b> fuente(s), con <b>${e.event_count || 0}</b> evento(s), <b>${(e.relaciones || []).length}</b> relación(es) y <b>${(e.evidence_ids || []).length}</b> evidencia(s). Marcas: ${esc(marks.join(', ') || 'sin marcas adicionales')}.`;
}
function nextSteps(e) {
  const n = [];
  if ((e.relaciones || []).length) n.push('Explorar contrapartes en la pestaña Red');
  if (e.event_count) n.push('Revisar cronología y evidencia en Timeline');
  if ((e.contexto?.sii_flags || []).length) n.push('Contrastar marcas SII con otra fuente independiente');
  if ((e.senales || []).length) n.push('Revisar señal gobernada y fuente primaria en Señales');
  if ((e.roles || []).includes('SANCTIONED_ENTITY')) n.push('Abrir el detalle sancionatorio y su resolución');
  if (!n.length) n.push('Mantener como contexto; no hay disparador adicional materializado');
  return n;
}

/* Reportabilidad individual — reemplaza la tarjeta que enhancements.js
   inyectaba en el render antiguo, con el mismo contenido y guardrails. */
function reportabilityPanel(e) {
  const isUaf = !!e.contexto?.sujeto_obligado;
  const cell = (v, label, cls) => `<div class="e360-context-item" style="flex-direction:column;align-items:flex-start;gap:2px"><b style="font-size:9px;color:${cls || 'var(--ink)'}">${esc(v)}</b><span style="font-size:7px;color:var(--muted)">${esc(label)}</span></div>`;
  return `<section class="card panel section">
    <div class="panel-header"><div><div class="panel-title">Reportabilidad individual</div><div class="panel-subtitle">Disponibilidad pública en la ficha del sujeto</div></div></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      ${cell(isUaf ? 'Sí' : 'No / no observado', 'Sujeto obligado UAF en Fusion', isUaf ? 'var(--green)' : 'var(--muted)')}
      ${cell('Reservado', 'autoría/cantidad ROS individual')}
      ${cell('No evaluable', 'cumplimiento ROE individual')}
      ${cell('Pendiente', 'sector/cadencia ROE a nivel entidad')}
    </div>
    <div class="e360-error" style="margin-top:10px;background:#fff9ef"><span class="e360-error-icon">⚠</span><span class="e360-error-text">No se genera una marca “no reportó ROS”. Para alertar ROE vencido se requiere materializar sector, periodicidad y evidencia de presentación por sujeto.</span></div>
    <div class="e360-actions"><button class="e360-btn" onclick="WB.showApp('reportability')">Abrir Observatorio de reportabilidad</button></div>
  </section>`;
}

function miniNetworkList(rels) {
  return `<div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">${rels.slice(0, 8).map(r => {
    const tipo = r.tipo_es || r.tipo || '';
    return `<div class="e360-finding" style="margin:0;padding:8px;cursor:pointer" onclick="WB.openEntity('${esc(r.contraparte_id)}')">
      <div style="display:flex;align-items:center;gap:8px">
        <div style="width:26px;height:26px;border-radius:50%;background:var(--cyan);color:#fff;display:grid;place-items:center;font-size:9px;font-weight:800;flex-shrink:0">${esc((r.contraparte_nombre || '?').slice(0, 2).toUpperCase())}</div>
        <div style="flex:1;min-width:0">
          <div class="truncate" style="font-size:8px;font-weight:700">${esc(r.contraparte_nombre || r.contraparte_id)}</div>
          <div style="font-size:7px;color:var(--muted)">${esc(tipo)} · ${esc(r.sentido_es || '')}</div>
        </div>
        <span class="badge badge-gray">${esc(r.assertion_type_es || 'Obs.')}</span>
      </div>
    </div>`;
  }).join('')}${rels.length > 8 ? `<button class="e360-btn ghost" onclick="E360.go('network')">Ver las ${rels.length} relaciones en el grafo →</button>` : ''}</div>`;
}

/* ── Signal Radar (SVG) ── */
function signalRadar(e) {
  const rp = e._pro.riskProfile;
  const axes = [
    { label: 'Amenaza', value: rp.threat },
    { label: 'Vulnerab.', value: rp.vulnerability },
    { label: 'Exposición', value: rp.exposure },
    { label: 'Red', value: e.red?.degree ? Math.min(100, e.red.degree * 20) : 0 },
    { label: 'Global', value: rp.overall }
  ];
  const cx = 100, cy = 100, R = 70, n = axes.length;
  const pt = (i, r) => { const a = Math.PI * 2 * i / n - Math.PI / 2; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; };
  const gridRings = [0.25, 0.5, 0.75, 1].map(f => `<polygon class="e360-radar-grid" points="${axes.map((_, i) => pt(i, R * f).map(v => v.toFixed(1)).join(',')).join(' ')}" fill="none"/>`).join('');
  const axesLines = axes.map((_, i) => { const [x, y] = pt(i, R); return `<line class="e360-radar-axis" x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`; }).join('');
  const dataPoly = `<polygon class="e360-radar-polygon" points="${axes.map((a, i) => pt(i, R * Math.min(1, (a.value || 0) / 100)).map(v => v.toFixed(1)).join(',')).join(' ')}"/>`;
  const labels = axes.map((a, i) => { const [x, y] = pt(i, R + 14); return `<text class="e360-radar-label" x="${x.toFixed(1)}" y="${y.toFixed(1)}">${esc(a.label)}</text>`; }).join('');
  return `<div class="e360-radar"><svg class="e360-radar-svg" viewBox="0 0 200 200">${gridRings}${axesLines}${dataPoly}${labels}</svg></div><div style="font-size:7px;color:var(--muted);text-align:center;margin-top:4px">Valores 0–100 · dimensiones con datos insuficientes se muestran en 0</div>`;
}

/* ============================================================================
   TAB — NETWORK (Canvas force-directed)
   ============================================================================ */
function tabNetwork(e) {
  const rels = e.relaciones || [];
  if (!rels.length) return `<section class="card panel">${emptyState('◉', 'Sin red observada', 'No hay relaciones entidad-entidad materializadas para esta entidad.')}</section>`;
  return `<section class="card panel">
    <div class="panel-header"><div><div class="panel-title">Grafo de relaciones</div><div class="panel-subtitle">${rels.length} contrapartes · grado ${e.red?.degree || 0} · componente ${esc((e.red?.component_id || '—').slice(-8))}</div></div>
    <span class="pill">Arrastra · rueda para zoom</span></div>
    <div class="e360-network" id="e360Net">
      <canvas class="e360-network-canvas" id="e360NetCanvas"></canvas>
      <div class="e360-network-tooltip" id="e360NetTip"></div>
      <div class="e360-network-legend">
        <div class="e360-network-legend-item"><span class="e360-network-legend-dot" style="background:var(--blue)"></span>Entidad focal</div>
        <div class="e360-network-legend-item"><span class="e360-network-legend-dot" style="background:var(--red)"></span>Sancionada</div>
        <div class="e360-network-legend-item"><span class="e360-network-legend-dot" style="background:var(--green)"></span>Sujeto obligado</div>
        <div class="e360-network-legend-item"><span class="e360-network-legend-dot" style="background:var(--cyan)"></span>Otra contraparte</div>
      </div>
    </div>
    <div style="margin-top:10px">${relationTable(rels)}</div>
  </section>`;
}

function relationTable(rels) {
  return `<div class="tablewrap" style="max-height:280px"><table class="e360-evidence-table"><thead><tr><th>Contraparte</th><th>Tipo</th><th>Sentido</th><th>Aserción</th><th>Conf.</th></tr></thead><tbody>${rels.map(r => `<tr style="cursor:pointer" onclick="WB.openEntity('${esc(r.contraparte_id)}')"><td><b>${esc(r.contraparte_nombre || r.contraparte_id)}</b></td><td>${esc(r.tipo_es || r.tipo || '—')}</td><td>${esc(r.sentido_es || '—')}</td><td><span class="badge badge-gray">${esc(r.assertion_type_es || '—')}</span></td><td>${r.confidence != null ? (r.confidence * 100).toFixed(0) + '%' : '—'}</td></tr>`).join('')}</tbody></table></div>`;
}

function initNetwork(e) {
  const canvas = $('#e360NetCanvas'); if (!canvas) return;
  const box = $('#e360Net'); const tip = $('#e360NetTip');
  const rels = (e.relaciones || []).slice(0, 40);
  const dpr = window.devicePixelRatio || 1;
  let W = box.clientWidth, H = box.clientHeight;
  canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);

  // Nodes: center + counterparties on a spring layout
  const nodes = [{ id: e.entity_id, name: e.nombre || e.rut, focal: true, x: W / 2, y: H / 2, vx: 0, vy: 0, r: 22, color: '#2b6ff3' }];
  rels.forEach((r, i) => {
    const ang = Math.PI * 2 * i / rels.length;
    const color = /SANC/i.test(r.contraparte_id) ? '#c94b55' : '#1495a3';
    nodes.push({ id: r.contraparte_id, name: r.contraparte_nombre || r.contraparte_id, rel: r, x: W / 2 + Math.cos(ang) * 140, y: H / 2 + Math.sin(ang) * 100, vx: 0, vy: 0, r: 13, color });
  });
  const edges = rels.map((r, i) => ({ a: 0, b: i + 1, label: r.tipo_es || r.tipo }));

  let view = { x: 0, y: 0, scale: 1 };
  let dragNode = null, panning = false, last = null, hoverNode = null;

  function tick() {
    // Simple force sim: repulsion + spring to center
    for (let i = 1; i < nodes.length; i++) {
      const n = nodes[i];
      let fx = 0, fy = 0;
      for (let j = 1; j < nodes.length; j++) {
        if (i === j) continue; const o = nodes[j];
        let dx = n.x - o.x, dy = n.y - o.y, d = Math.hypot(dx, dy) || 1;
        const rep = 2600 / (d * d); fx += dx / d * rep; fy += dy / d * rep;
      }
      // spring to center
      const c = nodes[0]; let dx = c.x - n.x, dy = c.y - n.y, d = Math.hypot(dx, dy) || 1;
      const targetD = 130; const spring = (d - targetD) * 0.015; fx += dx / d * spring; fy += dy / d * spring;
      if (n !== dragNode) { n.vx = (n.vx + fx) * 0.82; n.vy = (n.vy + fy) * 0.82; n.x += n.vx; n.y += n.vy; }
    }
    draw();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(view.x, view.y); ctx.scale(view.scale, view.scale);
    // edges
    edges.forEach(ed => {
      const a = nodes[ed.a], b = nodes[ed.b];
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = 'rgba(150,165,185,.45)'; ctx.lineWidth = 1.2; ctx.stroke();
    });
    // nodes
    nodes.forEach(n => {
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = n.color; ctx.fill();
      ctx.lineWidth = n === hoverNode ? 4 : 3; ctx.strokeStyle = '#fff'; ctx.stroke();
      if (n.focal || n === hoverNode) {
        ctx.fillStyle = '#5a6678'; ctx.font = '8px Inter, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText((n.name || '').slice(0, 22), n.x, n.y + n.r + 11);
      }
    });
    ctx.restore();
  }

  function toWorld(px, py) { return { x: (px - view.x) / view.scale, y: (py - view.y) / view.scale }; }
  function nodeAt(px, py) { const w = toWorld(px, py); return nodes.find(n => Math.hypot(n.x - w.x, n.y - w.y) <= n.r + 3); }

  canvas.onmousedown = ev => { const r = canvas.getBoundingClientRect(); const n = nodeAt(ev.clientX - r.left, ev.clientY - r.top); if (n) dragNode = n; else { panning = true; } last = { x: ev.clientX, y: ev.clientY }; };
  canvas.onmousemove = ev => {
    const r = canvas.getBoundingClientRect(); const mx = ev.clientX - r.left, my = ev.clientY - r.top;
    if (dragNode) { const w = toWorld(mx, my); dragNode.x = w.x; dragNode.y = w.y; dragNode.vx = dragNode.vy = 0; }
    else if (panning && last) { view.x += ev.clientX - last.x; view.y += ev.clientY - last.y; last = { x: ev.clientX, y: ev.clientY }; }
    else {
      const n = nodeAt(mx, my); hoverNode = n;
      if (n && !n.focal) { canvas.style.cursor = 'pointer'; showTip(n, mx, my); } else { canvas.style.cursor = n ? 'grab' : 'default'; tip.classList.remove('visible'); }
    }
  };
  canvas.onmouseup = ev => {
    if (dragNode) { const r = canvas.getBoundingClientRect(); const n = nodeAt(ev.clientX - r.left, ev.clientY - r.top); if (n === dragNode && !n.focal && Math.hypot(dragNode.vx, dragNode.vy) < 1) { /* click */ } }
    dragNode = null; panning = false; last = null;
  };
  canvas.onclick = ev => { const r = canvas.getBoundingClientRect(); const n = nodeAt(ev.clientX - r.left, ev.clientY - r.top); if (n && !n.focal && n.rel) BASE.openEntity(n.rel.contraparte_id); };
  canvas.onwheel = ev => { ev.preventDefault(); const r = canvas.getBoundingClientRect(); const mx = ev.clientX - r.left, my = ev.clientY - r.top; const before = toWorld(mx, my); view.scale = Math.max(0.4, Math.min(3, view.scale * (ev.deltaY < 0 ? 1.1 : 0.9))); const after = toWorld(mx, my); view.x += (after.x - before.x) * view.scale; view.y += (after.y - before.y) * view.scale; };
  canvas.onmouseleave = () => { tip.classList.remove('visible'); hoverNode = null; };

  function showTip(n, mx, my) {
    const r = n.rel;
    tip.innerHTML = `<div class="e360-tooltip-title">${esc(n.name)}</div><div style="font-size:7px;color:#aebbd0">${esc(r?.tipo_es || '')} · ${esc(r?.sentido_es || '')}</div>`;
    tip.style.left = Math.min(mx + 12, W - 200) + 'px'; tip.style.top = (my + 12) + 'px'; tip.classList.add('visible');
  }

  if (S.net) cancelAnimationFrame(S.net);
  let frames = 0;
  (function loop() { tick(); frames++; if (frames < 400) S.net = requestAnimationFrame(loop); })();
  window.addEventListener('resize', () => { W = box.clientWidth; H = box.clientHeight; canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.width = W + 'px'; canvas.style.height = H + 'px'; ctx.scale(dpr, dpr); draw(); }, { once: true });
}

/* ============================================================================
   TAB — TIMELINE (unified, lazy)
   ============================================================================ */
async function tabTimeline(e, box) {
  const items = [];
  (e.eventos || []).forEach(ev => items.push({ date: ev.fecha, type: sourceToTimelineType(ev.productor), icon: eventIcon(ev.tipo), title: ev.tipo_es || ev.tipo, meta: [PROD_LABEL[ev.productor] || ev.productor, ev.titulo].filter(Boolean), raw: ev }));

  // Enrich with anomalies + sanctions + evidence for this entity
  try {
    await ensureAnomalies();
    (cache.anomalies || []).filter(a => a.entity_id === e.entity_id).forEach(a => items.push({ date: null, type: 'anomalia', icon: '~', title: a.titulo, meta: ['SII', a.region].filter(Boolean), raw: a }));
  } catch (_) {}
  if ((e.evidence_ids || []).length) {
    try {
      await ensureEvidence();
      (e.evidence_ids || []).map(id => cache.evidence.get(id)).filter(Boolean).forEach(ev => items.push({ date: ev.source_published_at, type: 'evidence', icon: '❑', title: 'Evidencia · ' + (PROD_LABEL[ev.producer_id] || ev.producer_id), meta: [ev.source_tier, ev.quality_status].filter(Boolean), url: ev.source_url, raw: ev }));
    } catch (_) {}
  }

  items.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  if (!items.length) { box.innerHTML = `<section class="card panel">${emptyState('◷', 'Sin cronología', 'No hay eventos, anomalías ni evidencia con fecha para esta entidad.')}</section>`; return; }

  const types = [...new Set(items.map(i => i.type))];
  const filters = `<div class="e360-timeline-filters"><span class="e360-timeline-filter ${S.timelineFilter === 'all' ? 'active' : ''}" onclick="E360.timelineFilter('all',this)">Todo (${items.length})</span>${types.map(t => `<span class="e360-timeline-filter ${S.timelineFilter === t ? 'active' : ''}" onclick="E360.timelineFilter('${t}',this)">${timelineTypeLabel(t)} (${items.filter(i => i.type === t).length})</span>`).join('')}</div>`;
  S._timelineItems = items;
  box.innerHTML = `<section class="card panel"><div class="panel-header"><div><div class="panel-title">Cronología unificada</div><div class="panel-subtitle">Eventos · anomalías · evidencia — ordenados por fecha</div></div></div>${filters}<div id="e360TimelineList">${renderTimelineList(items)}</div></section>`;
}

function renderTimelineList(items) {
  const filtered = S.timelineFilter === 'all' ? items : items.filter(i => i.type === S.timelineFilter);
  if (!filtered.length) return emptyState('◷', 'Sin registros', 'No hay elementos para este filtro.');
  return `<div class="e360-timeline">${filtered.map(i => `
    <div class="e360-timeline-item ${i.type}">
      <div class="e360-timeline-date">${esc((i.date || 'sin fecha').slice(0, 10))}</div>
      <div class="e360-timeline-title">${esc(i.title)}</div>
      <div class="e360-timeline-meta">${i.meta.map(m => `<span>${esc(m)}</span>`).join('<span>·</span>')}</div>
      ${i.url ? `<a class="e360-timeline-expand" href="${esc(i.url)}" target="_blank" rel="noopener">Abrir fuente ↗</a>` : ''}
    </div>`).join('')}</div>`;
}
function timelineFilter(t, node) {
  S.timelineFilter = t;
  const list = $('#e360TimelineList');
  if (list && S._timelineItems) list.innerHTML = renderTimelineList(S._timelineItems);
  document.querySelectorAll('.e360-timeline-filter').forEach(f => f.classList.remove('active'));
  if (node) node.classList.add('active');
}
function sourceToTimelineType(prod) { return prod === 'RADAR_SANCIONES' ? 'sancion' : prod === 'RADAR_SII' ? 'anomalia' : 'finding'; }
function timelineTypeLabel(t) { return { sancion: 'Sanciones', anomalia: 'Anomalías', finding: 'Hallazgos', evidence: 'Evidencia', signal: 'Señales' }[t] || t; }
function eventIcon(tipo) { return /SANC/i.test(tipo) ? '§' : /RELAT|OWN/i.test(tipo) ? '◉' : '•'; }

/* ============================================================================
   TAB — EVIDENCE (lazy)
   ============================================================================ */
async function tabEvidence(e, box) {
  const ids = e.evidence_ids || [];
  if (!ids.length) { box.innerHTML = `<section class="card panel">${emptyState('❑', 'Sin evidencia', 'Esta entidad no tiene referencias de evidencia en el índice.')}</section>`; return; }
  try {
    await ensureEvidence();
    const evs = ids.map(id => cache.evidence.get(id)).filter(Boolean);
    if (!evs.length) { box.innerHTML = `<section class="card panel">${emptyState('❑', 'Referencias sin detalle', `${ids.length} referencia(s) sin registro en el índice liviano.`)}</section>`; return; }
    box.innerHTML = `<section class="card panel"><div class="panel-header"><div><div class="panel-title">Evidencia (${evs.length})</div><div class="panel-subtitle">${evs.filter(x => x.source_url).length} con URL directa · ordenada por fecha</div></div></div>
      <div class="tablewrap" style="max-height:520px"><table class="e360-evidence-table"><thead><tr><th>Fuente</th><th>Extracto</th><th>Tier</th><th>Calidad</th><th>Fecha</th><th>Fuente ↗</th></tr></thead><tbody>${evs.sort((a, b) => String(b.source_published_at || '').localeCompare(String(a.source_published_at || ''))).map((x, i) => `<tr>
        <td><span class="source-chip ${PROD_CLASS[x.producer_id] || ''}">${esc(PROD_LABEL[x.producer_id] || x.producer_id)}</span></td>
        <td><div class="e360-evidence-excerpt truncate-2" id="exc${i}">${esc(x.excerpt || x.source_id || '—')}</div>${(x.excerpt || '').length > 120 ? `<span class="e360-timeline-expand" onclick="E360.toggleExcerpt(${i})">Ver completo</span>` : ''}</td>
        <td><span class="badge ${x.source_tier === 'OFFICIAL' ? 'badge-green' : 'badge-gray'}">${esc(x.source_tier || '—')}</span></td>
        <td><span class="badge ${x.quality_status === 'COMPLETE' ? 'badge-green' : 'badge-amber'}">${esc(x.quality_status || '—')}</span></td>
        <td style="font-family:var(--font-mono);font-size:7px">${esc((x.source_published_at || '—').slice(0, 10))}</td>
        <td>${x.source_url ? `<a class="e360-evidence-url" href="${esc(x.source_url)}" target="_blank" rel="noopener">Abrir ↗</a>` : '<span style="color:var(--muted)">—</span>'}</td>
      </tr>`).join('')}</tbody></table></div></section>`;
  } catch (err) { box.innerHTML = errorState(err.message); }
}
function toggleExcerpt(i) { const el = $('#exc' + i); if (el) el.classList.toggle('truncate-2'); }

/* ============================================================================
   TAB — SIGNALS
   ============================================================================ */
function tabSignals(e) {
  const signals = e.senales || [], score = e.aml?.score;
  if (!signals.length && !score) return `<section class="card panel">${emptyState('◆', 'Sin señales AML', 'No hay señales gobernadas ni score AML materializado para esta entidad.')}</section>`;
  const dimLabel = { VULNERABILITY: 'Vulnerabilidad', THREAT: 'Amenaza', EXPOSURE: 'Exposición' };
  return `<div class="grid grid-2 gap-3" style="align-items:start">
    <section class="card panel">
      <div class="panel-title">Señales gobernadas (${signals.length})</div>
      <div style="margin-top:10px;display:flex;flex-direction:column;gap:8px">${signals.map(s => `<div class="e360-finding" style="margin:0">
        <div class="e360-finding-header"><div class="e360-finding-title">${esc(s.dimension_es || dimLabel[s.dimension] || s.dimension)}</div><div class="e360-finding-score e360-score-high">${Number(s.value || 0).toFixed(0)}</div></div>
        <div class="e360-finding-meta"><span class="badge badge-purple">${esc(s.signal_id)}</span><span class="badge badge-gray">conf. ${(s.confidence * 100).toFixed(0)}%</span></div>
      </div>`).join('') || '<div style="font-size:8px;color:var(--muted)">Sin instancias de señal.</div>'}</div>
    </section>
    <section class="card panel">
      <div class="panel-title">Descomposición del score AML</div>
      ${score ? `<div style="margin-top:10px">${signalRadar(e)}
        <div style="margin-top:12px">${['threat', 'vulnerability', 'exposure', 'overall_risk'].map(k => { const labels = { threat: 'Amenaza', vulnerability: 'Vulnerabilidad', exposure: 'Exposición', overall_risk: 'Riesgo global' }; const v = score[k]; return `<div class="e360-finding-factor"><span class="e360-finding-factor-label">${labels[k]}</span><div class="e360-finding-factor-bar"><div class="e360-finding-factor-fill" style="width:${v || 0}%"></div></div><span class="e360-finding-factor-value">${v == null ? '—' : Number(v).toFixed(0)}</span></div>`; }).join('')}</div>
        <div class="e360-error" style="margin-top:12px;background:#fff9ef"><span class="e360-error-icon">ⓘ</span><span class="e360-error-text">Banda <b>${esc(score.risk_band_es || score.risk_band)}</b> · confianza ${(score.confidence * 100).toFixed(0)}% · cobertura ${(score.coverage * 100).toFixed(0)}%. Modelo ${esc(score.model_version || '—')}. Cobertura baja implica que el score es indicativo, no concluyente.</span></div>` : '<div style="font-size:8px;color:var(--muted);margin-top:10px">Sin score materializado.</div>'}
    </section>
  </div>`;
}

/* ============================================================================
   TAB — FINDINGS (lazy, scan all finding types for this entity)
   ============================================================================ */
async function tabFindings(e, box) {
  const results = [];
  try {
    for (const type of Object.keys(FINDING_FILE)) {
      const arr = await ensureFindingType(type);
      arr.forEach(f => { if ((f.scope?.entity_ids || []).includes(e.entity_id) || f.entity_rut === e.rut) results.push(f); });
    }
  } catch (err) { box.innerHTML = errorState(err.message); return; }
  if (!results.length) { box.innerHTML = `<section class="card panel">${emptyState('⌕', 'Sin hallazgos vinculados', 'No hay findings que referencien directamente a esta entidad en el snapshot.')}</section>`; return; }
  results.sort((a, b) => (b.decision_scores?.EXPLORAR || 0) - (a.decision_scores?.EXPLORAR || 0));
  box.innerHTML = `<section class="card panel"><div class="panel-header"><div><div class="panel-title">Hallazgos vinculados (${results.length})</div><div class="panel-subtitle">Ordenados por IPA 2.0</div></div></div><div style="margin-top:10px">${results.map(findingCard).join('')}</div></section>`;
}
function findingCard(f) {
  const score = Number(f.decision_scores?.EXPLORAR || 0);
  const features = f.decision_features || {};
  return `<div class="e360-finding">
    <div class="e360-finding-header"><div class="e360-finding-title">${esc(f.title)}</div><div class="e360-finding-score">${score.toFixed(1)}</div></div>
    <div class="e360-finding-meta"><span class="badge badge-blue">${esc(TYPE_LABEL[f.finding_type] || f.finding_type)}</span>${(f.producer_ids || []).map(p => `<span class="source-chip ${PROD_CLASS[p] || ''}">${esc(PROD_LABEL[p] || p)}</span>`).join('')}<span class="badge badge-gray">${f.source_independence_count || 1} fuente(s)</span></div>
    <div class="e360-finding-explanation">${esc(f.explanation || '')}</div>
    <div class="e360-finding-factors">${Object.entries(features).slice(0, 5).map(([k, v]) => `<div class="e360-finding-factor"><span class="e360-finding-factor-label">${esc(k.replaceAll('_', ' '))}</span><div class="e360-finding-factor-bar"><div class="e360-finding-factor-fill" style="width:${Math.min(100, Number(v || 0))}%"></div></div><span class="e360-finding-factor-value">${Number(v || 0).toFixed(0)}</span></div>`).join('')}</div>
    <div class="e360-actions"><button class="e360-btn" onclick="WB.openFinding('${esc(f.finding_id)}','${esc(f.finding_type)}')">Abrir análisis completo</button></div>
  </div>`;
}

/* ============================================================================
   TAB — SANCTIONS (lazy)
   ============================================================================ */
async function tabSanctions(e, box) {
  if (!(e.roles || []).includes('SANCTIONED_ENTITY') && !(e.fuentes || []).includes('RADAR_SANCIONES')) {
    box.innerHTML = `<section class="card panel">${emptyState('§', 'Sin sanciones', 'Esta entidad no está marcada como sancionada en el snapshot.')}</section>`; return;
  }
  try {
    await ensureSanctions();
    const sancs = (cache.sanctions || []).map(sanctionDecoded).filter(s => s.entity === e.entity_id);
    if (!sancs.length) { box.innerHTML = `<section class="card panel">${emptyState('§', 'Rol sancionada sin detalle', 'La entidad tiene rol sancionada pero no hay resolución individualizada en el índice liviano.')}</section>`; return; }
    box.innerHTML = `<section class="card panel"><div class="panel-header"><div><div class="panel-title">Eventos sancionatorios (${sancs.length})</div><div class="panel-subtitle">Sanción administrativa ≠ LA/FT</div></div></div><div style="margin-top:10px;display:flex;flex-direction:column;gap:8px">${sancs.map(x => `<div class="e360-finding">
      <div class="e360-finding-header"><div class="e360-finding-title">${esc(x.subject || 'Resolución ' + (x.resolution || ''))}</div><div class="e360-finding-score" style="font-size:9px;color:var(--muted)">${esc(x.date || '')}</div></div>
      <div class="e360-finding-meta"><span class="badge badge-red">${esc(x.supervisor || '')}</span><span class="badge badge-gray">Res. ${esc(x.resolution || '—')}</span>${x.laft ? '<span class="badge badge-red">LAFT directa</span>' : '<span class="badge badge-gray">Administrativa</span>'}</div>
      <div class="e360-finding-explanation">${esc(x.summary || 'Sin resumen disponible.')}</div>
      ${x.evidence ? `<div class="e360-actions"><button class="e360-btn" onclick="WB.openEvidence('${esc(x.evidence)}')">Abrir evidencia ↗</button></div>` : ''}
    </div>`).join('')}</div></section>`;
  } catch (err) { box.innerHTML = errorState(err.message); }
}

/* ============================================================================
   TAB — ANOMALIES (lazy)
   ============================================================================ */
async function tabAnomalies(e, box) {
  try {
    await ensureAnomalies();
    const anoms = (cache.anomalies || []).filter(a => a.entity_id === e.entity_id);
    if (!anoms.length) { box.innerHTML = `<section class="card panel">${emptyState('~', 'Sin anomalías SII', 'No hay marcas contextuales SII asociadas a esta entidad.')}</section>`; return; }
    box.innerHTML = `<section class="card panel"><div class="panel-header"><div><div class="panel-title">Anomalías contextuales SII (${anoms.length})</div><div class="panel-subtitle">Descriptivas · no son señales AML</div></div></div><div style="margin-top:10px;display:flex;flex-direction:column;gap:8px">${anoms.map(a => `<div class="e360-finding">
      <div class="e360-finding-header"><div class="e360-finding-title">${esc(a.titulo)}</div><span class="badge badge-amber">${esc(a.codigo_tecnico || 'SII')}</span></div>
      <div class="e360-finding-explanation">${esc(a.explicacion || '')}</div>
      <div class="e360-finding-meta"><span class="badge badge-gray">${esc(a.region || '—')} · ${esc(a.comuna || '—')}</span>${a.nivel_revision ? `<span class="badge badge-blue">${esc(a.nivel_revision)}</span>` : ''}</div>
    </div>`).join('')}</div></section>`;
  } catch (err) { box.innerHTML = errorState(err.message); }
}

/* ============================================================================
   SKELETON / EMPTY / ERROR
   ============================================================================ */
function shellSkeleton() {
  return `<div class="e360">
    <div class="e360-identity"><div class="skeleton skeleton-avatar"></div><div style="flex:1"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-text" style="width:40%"></div><div class="skeleton-row" style="margin-top:8px"><div class="skeleton skeleton-badge"></div><div class="skeleton skeleton-badge"></div><div class="skeleton skeleton-badge"></div></div></div><div class="skeleton" style="width:60px;height:40px"></div></div>
    <div class="e360-kpi-strip">${Array(5).fill('<div class="skeleton skeleton-kpi"></div>').join('')}</div>
    <div class="skeleton" style="height:38px;margin-bottom:16px"></div>
    <div class="grid grid-2 gap-3"><div class="skeleton skeleton-card" style="height:200px"></div><div class="skeleton skeleton-card" style="height:200px"></div></div>
  </div>`;
}
function emptyState(icon, title, desc, action = '') {
  return `<div class="e360-empty"><div class="e360-empty-icon">${icon}</div><div class="e360-empty-title">${esc(title)}</div><div class="e360-empty-desc">${esc(desc)}</div>${action}</div>`;
}
function errorState(msg) {
  return `<div class="e360-error"><span class="e360-error-icon">⚠</span><span class="e360-error-text"><b>No se pudo cargar este detalle.</b><br>${esc(msg)}<br><small>La mesa principal sigue operativa.</small></span></div>`;
}

/* ============================================================================
   EXPORT
   ============================================================================ */
async function exportEntity(id, fmtType) {
  const e = cache.entity.get(id); if (!e) return;
  if (fmtType === 'json') {
    const blob = new Blob([JSON.stringify({ snapshot: D.manifest, entity: e, marks: entityMarks(e).map(x => x[0]), risk_profile: computeRiskProfile(e), exported_at: new Date().toISOString() }, null, 2)], { type: 'application/json' });
    download(blob, `entity360_${(e.rut || id).replace(/[^0-9A-Za-z-]/g, '_')}.json`);
  } else if (fmtType === 'csv') {
    await ensureEvidence();
    const evs = (e.evidence_ids || []).map(x => cache.evidence.get(x)).filter(Boolean);
    const head = ['Fuente', 'Tier', 'Calidad', 'Publicado', 'Extracto', 'URL'];
    const rows = evs.map(x => [PROD_LABEL[x.producer_id] || x.producer_id, x.source_tier, x.quality_status, x.source_published_at, (x.excerpt || '').replace(/\s+/g, ' '), x.source_url || '']);
    const q = v => '"' + String(v ?? '').replaceAll('"', '""') + '"';
    const csv = [head, ...rows].map(r => r.map(q).join(';')).join('\r\n');
    download(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }), `evidencia_${(e.rut || id).replace(/[^0-9A-Za-z-]/g, '_')}.csv`);
  }
}
function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 500); }

/* ============================================================================
   KEYBOARD SHORTCUTS
   ============================================================================ */
document.addEventListener('keydown', ev => {
  if (!S.entity) return;
  const tag = (ev.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
  if (ev.key === 'e' && !ev.metaKey && !ev.ctrlKey) { exportEntity(S.entity.entity_id, 'json'); }
  else if (ev.key === 'c' && !ev.metaKey && !ev.ctrlKey) { BASE.caseEntity(S.entity.entity_id); }
  else if (ev.key >= '1' && ev.key <= '8') { const t = TABS[Number(ev.key) - 1]; if (t) go(t.id); }
});

/* ============================================================================
   PUBLIC API + OVERRIDE
   ============================================================================ */
window.E360 = { open: openEntity360, go, timelineFilter, toggleExcerpt, exportEntity };

/* We intentionally delegate to the previous openEntity FIRST. At this point in
   the load order that is enhancements.js' wrapper, so the routing/back-button
   stack, the focus rail and app.js' private entity cache (which caseEntity,
   exportEntity and showEntityBrief all read from) are all populated exactly as
   before. Only then do we replace the canvas with the Pro view. The shard is
   fetched once — harvestShards() reuses what app.js already loaded. */
const _prevOpenEntity = BASE.openEntity;
BASE.openEntity = async function (id) {
  try { await _prevOpenEntity(id); } catch (_) { /* base render failed; Pro view still tries */ }
  return openEntity360(id);
};

console.log('Entity 360 Pro ready · 1-8 = pestañas, e = exportar, c = guardar caso');
})();