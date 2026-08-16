'use strict';

/* AML Analytical Workbench v0.17
   UX layer focused on analyst language, traceability and normalized export.
   It reuses the existing authenticated Supabase client, Entra session, RLS and audit helpers.
*/

const V17 = '0.17.0';
const V17_INFO = new Map();
let V17_INFO_SEQ = 0;
let V17_FINDING_MODE = 'investigate';
let V17_FINDINGS_CACHE = [];
let V17_FINDINGS_TOTAL = 0;
let V17_ENTITY_CACHE = null;

const V17_MODE = {
  explore: {
    label: 'Explorar',
    scoreField: 'score_explore',
    weights: { rule_strength:35, independent_sources:25, evidence_breadth:20, recurrence:15, network_context:5 },
    purpose: 'Encontrar señales que merecen una primera mirada.'
  },
  supervise: {
    label: 'Fiscalizar',
    scoreField: 'score_supervise',
    weights: { rule_strength:45, recurrence:20, independent_sources:15, evidence_breadth:15, network_context:5 },
    purpose: 'Priorizar cobertura regulatoria, reiteración y evidencia observable.'
  },
  investigate: {
    label: 'Investigar',
    scoreField: 'score_investigate',
    weights: { independent_sources:30, rule_strength:25, recurrence:20, network_context:15, evidence_breadth:10 },
    purpose: 'Priorizar entidades o hechos que justifican profundización analítica.'
  }
};

const V17_FEATURE_LABELS = {
  rule_strength: 'Intensidad de la regla',
  independent_sources: 'Fuentes independientes',
  evidence_breadth: 'Amplitud de evidencia',
  recurrence: 'Reiteración observada',
  network_context: 'Contexto relacional'
};

const V17_FINDING_LABELS = {
  GOVERNED_AML_SIGNAL: 'Señal AML respaldada por regla',
  DIRECT_AML_SIGNAL: 'Señal AML directa',
  ENTITY_CONVERGENCE: 'Misma entidad observada en varias fuentes',
  CONVERGENCIA_3PLUS: 'Misma entidad observada en 3 o más fuentes',
  PRUDENTIAL_SANCTION: 'Sanción administrativa relevante',
  SANCTION_CONVERGENCE: 'Acumulación de sanciones',
  SANCTION_ACCUMULATION: 'Acumulación de sanciones',
  CONTEXTUAL_ANOMALY: 'Cambio o inconsistencia que merece revisión',
  REGULATORY_GAP: 'Posible brecha de cobertura UAF',
  SUPERVISORY_GAP: 'Posible brecha de cobertura UAF',
  TERRITORY_EMERGENCE: 'Cambio relevante en un territorio',
  TERRITORIAL_CONVERGENCE: 'Acumulación de señales en un territorio',
  SECTOR_CONCENTRATION: 'Concentración inusual en un sector',
  PUBLIC_SPEND_ANOMALY: 'Comportamiento inusual en gasto público',
  BEHAVIOR_CHANGE: 'Cambio relevante de comportamiento',
  PERSISTENCE: 'Señal persistente en el tiempo',
  NETWORK_PATTERN: 'Patrón relacional que merece revisión',
  NETWORK_CONTEXT: 'Relaciones observadas que aportan contexto',
  REPORTING_ANOMALY: 'Reportabilidad agregada fuera de sus pares',
  CRIME_CONTEXT_SHIFT: 'Cambio en contexto delictual territorial',
  OSFL_PATTERN: 'Patrón relevante en organizaciones sin fines de lucro'
};

const V17_PATTERN_LABELS = {
  OUTLIER_INTENSIDAD_ROS: 'Intensidad de ROS fuera de sus pares',
  ACELERACION_ROS: 'Aumento acelerado de ROS',
  CAIDA_ROS: 'Caída relevante de ROS',
  CONCENTRACION_SANCIONES: 'Sanciones concentradas en un sector',
  OUTLIER_DENSIDAD_ANOMALIAS: 'Mayor densidad de anomalías en un territorio',
  OUTLIER_DENSIDAD_BRECHA: 'Mayor densidad de posibles brechas en un territorio',
  RECURRENCIA_SANCIONATORIA: 'Reiteración de sanciones en una entidad',
  CONCENTRACION_TERRITORIAL: 'Actividad fuertemente concentrada territorialmente',
  CONVERGENCIA_MULTIFUENTE: 'Acumulación de evidencia desde varias fuentes',
  CONVERGENCIA_3PLUS: 'Entidad observada en 3 o más fuentes',
  PERSISTENCIA_HALLAZGOS: 'Hallazgo persistente en el tiempo',
  DENSIDAD_SANCIONES: 'Densidad de sanciones fuera de sus pares',
  OUTLIER_REPORTABILIDAD: 'Reportabilidad agregada fuera de sus pares',
  COBERTURA_BAJA: 'Cobertura pública UAF menor a sus pares',
  HUB_TOPOLOGICO: 'Conectividad relacional destacada',
  MATERIALIDAD_PENDIENTE: 'Materialidad monetaria aún no comparable',
  OUTLIER_ANOMALIAS: 'Densidad de anomalías fuera de sus pares',
  OUTLIER_BRECHA: 'Brecha observable fuera de sus pares',
  SEÑAL_GOBERNADA: 'Señal AML gobernada',
  SILENCIO_PERSISTENTE_ROS: 'Serie sectorial sin ROS agregados observados',
  CAPACIDAD_TEMPORAL_PARCIAL: 'Cobertura temporal incompleta'
};

function v17HasNumber(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}
function v17FmtScore(value) {
  return v17HasNumber(value) ? Number(value).toFixed(1) : '—';
}

const V17_PRODUCER_LABELS = {
  RADAR_SII: 'Servicio de Impuestos Internos',
  RADAR_UAF: 'Unidad de Análisis Financiero',
  RADAR_CGR: 'Contraloría General de la República',
  RADAR_SANCIONES: 'Radar de sanciones',
  RADAR_DELICTUAL: 'Radar delictual',
  RADAR_OSFL: 'Radar OSFL',
  RADAR_PRENSA: 'Radar de prensa',
  PRESUPUESTO_ABIERTO: 'Presupuesto Abierto'
};

function v17FindingLabel(type) {
  return V17_FINDING_LABELS[type] || v16FindingLabel(type) || String(type || 'Hallazgo').replaceAll('_',' ');
}
function v17PatternLabel(type, fallback='') {
  return V17_PATTERN_LABELS[type] || fallback || String(type || 'Fenómeno').replaceAll('_',' ');
}
function v17ProducerLabel(id) {
  return V17_PRODUCER_LABELS[id] || String(id || '').replace(/^RADAR_/,'').replaceAll('_',' ');
}
function v17InfoButton(label, html, compact=false) {
  const id = `v17-info-${++V17_INFO_SEQ}`;
  V17_INFO.set(id, { label, html });
  return `<button type="button" class="info-btn ${compact?'compact':''}" data-v17-info="${id}">${esc(label)}</button>`;
}
function v17ShowInfo(id) {
  const item = V17_INFO.get(id);
  if (!item) return;
  document.querySelector('#v17-modal')?.remove();
  document.body.insertAdjacentHTML('beforeend', `<div class="v17-modal-backdrop" id="v17-modal">
    <section class="v17-modal" role="dialog" aria-modal="true" aria-label="${esc(item.label)}">
      <div class="v17-modal-head"><h2>${esc(item.label)}</h2><button type="button" class="modal-close" data-v17-close aria-label="Cerrar">×</button></div>
      <div class="v17-modal-body">${item.html}</div>
    </section>
  </div>`);
}
document.addEventListener('click', (ev) => {
  const info = ev.target.closest('[data-v17-info]');
  if (info) { ev.preventDefault(); v17ShowInfo(info.dataset.v17Info); return; }
  if (ev.target.matches('[data-v17-close]') || ev.target.id === 'v17-modal') document.querySelector('#v17-modal')?.remove();
});

function v17SafeLinks(payload={}) {
  const urls = [];
  const add = (u) => {
    if (typeof u === 'string' && /^https:\/\//i.test(u) && !urls.includes(u)) urls.push(u);
  };
  add(payload.source_url);
  (Array.isArray(payload.source_urls) ? payload.source_urls : []).forEach(add);
  (Array.isArray(payload.evidence_urls) ? payload.evidence_urls : []).forEach(add);
  return urls;
}

function v17FeatureFormula(key, facts={}) {
  const nSources = Number(facts.independent_sources ?? 0);
  const nEvidence = Number(facts.evidence_count ?? 0);
  const recurrence = Number(facts.direct_aml_signals ?? 0) + Number(facts.contextual_anomalies ?? 0) + Number(facts.sanctions ?? 0);
  const relations = Number(facts.observed_relationships ?? 0);
  if (key === 'independent_sources') return `min(100, 25 × fuentes). Con ${fmtNum(nSources)} fuente(s), la escala se construye directamente desde ese conteo.`;
  if (key === 'evidence_breadth') return nEvidence > 0
    ? `min(100, 18 + 17 × log₂(1 + evidencias)). Evidencias observadas: ${fmtNum(nEvidence)}.`
    : '0 cuando no existen evidencias asociadas.';
  if (key === 'recurrence') return recurrence > 0
    ? `min(100, 10 + 20 × log₂(1 + reiteraciones)). Reiteraciones observadas: ${fmtNum(recurrence)}.`
    : '0 cuando no existen señales, anomalías o sanciones reiteradas.';
  if (key === 'network_context') return relations > 0
    ? `min(100, 18 × log₂(1 + relaciones)). Relaciones observadas: ${fmtNum(relations)}.`
    : '0 cuando no existen relaciones materializadas.';
  return 'La intensidad depende de la regla específica que originó el hallazgo.';
}

function v17RuleStrengthFormula(f) {
  const p = f.payload || {};
  const facts = p.decision_facts || {};
  const type = f.finding_type;
  if (type === 'GOVERNED_AML_SIGNAL' || type === 'DIRECT_AML_SIGNAL') return 'Valor 100 cuando el hallazgo proviene de una señal AML gobernada.';
  if (type === 'SUPERVISORY_GAP' || type === 'REGULATORY_GAP') return `min(100, 30 + 18 × log₂(1 + candidatos)). Candidatos observados: ${fmtNum(facts.supervisory_gap_candidates ?? 1)}.`;
  if (type === 'PRUDENTIAL_SANCTION') return 'min(100, 48 + 12 × recurrencia de sanciones + 12 si existe clasificación LA/FT directa), con recurrencia acotada a 4 eventos.';
  if (type === 'CONTEXTUAL_ANOMALY') return `min(88, 30 + 16 × log₂(1 + anomalías)). Anomalías observadas: ${fmtNum(facts.contextual_anomalies ?? 1)}.`;
  if (type === 'ENTITY_CONVERGENCE') return `min(100, 28 + 11×fuentes + 10×señales AML directas (máx.2) + 4×anomalías (máx.8) + 7×sanciones (máx.4)).`;
  return 'Regla base del motor: 50 cuando el tipo aún no tiene una función específica en IPA 2.0.';
}

function v17ScoreExplanation(f, modeKey='investigate') {
  const mode = V17_MODE[modeKey] || V17_MODE.investigate;
  const p = f.payload || {};
  const features = p.decision_features || {};
  const facts = p.decision_facts || {};
  const keys = Object.keys(mode.weights).filter(k => v17HasNumber(features[k]));
  if (!keys.length) {
    return `<div class="explain-callout">Este registro no contiene el desglose necesario para reconstruir el cálculo. El puntaje se muestra sólo cuando viene materializado desde Fusion.</div>`;
  }
  const denominator = keys.reduce((a,k)=>a + Number(mode.weights[k]), 0);
  const numerator = keys.reduce((a,k)=>a + Number(features[k]) * Number(mode.weights[k]), 0);
  const reconstructed = denominator ? numerator / denominator : 0;
  const rows = keys.map(k => {
    const value = Number(features[k]);
    const weight = Number(mode.weights[k]);
    const contribution = denominator ? value * weight / denominator : 0;
    return `<tr><td>${esc(V17_FEATURE_LABELS[k] || k)}</td><td>${value.toFixed(1)}</td><td>${weight}%</td><td>${contribution.toFixed(1)}</td></tr>`;
  }).join('');
  const raw = keys.map(k => `<details class="formula-detail"><summary>${esc(V17_FEATURE_LABELS[k] || k)}</summary><p>${esc(k==='rule_strength' ? v17RuleStrengthFormula(f) : v17FeatureFormula(k,facts))}</p></details>`).join('');
  return `<div class="formula-summary">
    <div><span>Qué representa</span><strong>Prioridad para ${esc(mode.label.toLowerCase())}</strong></div>
    <div><span>Resultado materializado</span><strong>${v17FmtScore(f[mode.scoreField])}/100</strong></div>
    <div><span>Resultado reconstruido</span><strong>${reconstructed.toFixed(1)}/100</strong></div>
  </div>
  <p class="plain-note">${esc(mode.purpose)} No es probabilidad de delito, LA/FT o incumplimiento.</p>
  <div class="formula-box"><code>Prioridad = Σ(valor del factor × peso) / Σ(pesos disponibles)</code></div>
  <div class="table-wrap"><table class="table calc-table"><thead><tr><th>Factor</th><th>Valor</th><th>Peso</th><th>Aporte</th></tr></thead><tbody>${rows}</tbody></table></div>
  <h3 class="modal-subtitle">Cómo se obtiene cada factor</h3>${raw}
  <div class="plain-note">Modelo: ${esc(p.score_model || 'IPA_2_0_OBSERVABLE_FACTS')} · sólo usa hechos observables materializados.</div>`;
}

function v17EvidenceExplanation(f) {
  const p = f.payload || {};
  const facts = p.decision_facts || {};
  const producers = p.producer_ids || [];
  const evidence = p.evidence_ids || [];
  const links = v17SafeLinks(p);
  const producerHtml = producers.length ? producers.map(x=>`<li><strong>${esc(v17ProducerLabel(x))}</strong><span class="mono">${esc(x)}</span></li>`).join('') : '<li>No se materializó el productor en este registro.</li>';
  const evidenceHtml = evidence.length ? evidence.map(x=>`<li class="mono">${esc(x)}</li>`).join('') : '<li>No se materializó un identificador de evidencia.</li>';
  const linksHtml = links.length ? `<h3 class="modal-subtitle">Enlaces de origen disponibles</h3><div class="source-links">${links.map((u,i)=>`<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">Abrir fuente ${i+1}</a>`).join('')}</div>` : '';
  return `<div class="formula-summary">
      <div><span>Fuentes independientes</span><strong>${esc(facts.independent_sources ?? p.source_independence_count ?? producers.length ?? '—')}</strong></div>
      <div><span>Evidencias</span><strong>${fmtNum(f.evidence_count || evidence.length)}</strong></div>
      <div><span>Snapshot</span><strong>${esc(f.snapshot_id || '—')}</strong></div>
    </div>
    <h3 class="modal-subtitle">Fuentes utilizadas</h3><ul class="source-list">${producerHtml}</ul>
    <h3 class="modal-subtitle">Identificadores de evidencia</h3><ul class="evidence-list">${evidenceHtml}</ul>
    ${linksHtml}
    <p class="plain-note">Cuando el portal no dispone del enlace directo, conserva el Evidence ID para trazabilidad hacia la capa Fusion.</p>`;
}

function v17PlainFindingSummary(f) {
  const p = f.payload || {};
  if (p.explanation) return p.explanation;
  const facts = p.decision_facts || {};
  const bits = [];
  if (facts.independent_sources) bits.push(`${fmtNum(facts.independent_sources)} fuentes independientes`);
  if (facts.evidence_count) bits.push(`${fmtNum(facts.evidence_count)} evidencias`);
  if (facts.contextual_anomalies) bits.push(`${fmtNum(facts.contextual_anomalies)} anomalías contextuales`);
  if (facts.sanctions) bits.push(`${fmtNum(facts.sanctions)} sanciones`);
  return bits.length ? `El sistema reúne ${bits.join(', ')} para priorizar revisión.` : 'Hallazgo generado desde hechos observables y evidencia trazable.';
}
