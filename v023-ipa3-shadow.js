'use strict';

/* AML Workbench v0.23.0 · IPA 3.0 shadow
 * - Keeps the current Entity 360 score visible and unchanged.
 * - Adds governed IPA 3.0 as a parallel analytical-priority score.
 * - Shows mark-level explanations, absorption-aware groups, confidence and coverage.
 * - Never presents IPA as probability of LA/FT.
 */
const V023='0.23.0';
const V023_SCORE_VIEW='aml_v_ipa3_entity_score_v0_3';
const V023_MARK_VIEW='aml_v_ipa3_mark_scores_v0_3';
const V023_COMPARE_VIEW='aml_v_ipa3_compare_ipa2_v0_3';
const V023_LABELS={
  M00:'Sujeto obligado UAF',
  M01:'SO UAF con término de giro SII',
  M03:'Contracción económica significativa',
  M04:'Expansión económica significativa',
  M05:'Entidad joven con crecimiento extraordinario',
  M06:'Cambio abrupto de ventas vs pares',
  M16:'Recurrencia sancionatoria',
  M17:'Sanción AML/LAFT directa · en validación',
  M18:'Convergencia sancionatoria multirregulador',
  M19:'OSFL reciente con crecimiento acelerado'
};
const V023_BANDS={MUY_ALTA:'Muy alta',ALTA:'Alta',MEDIA:'Media',BAJA:'Baja',SIN_MARCA_SHADOW:'Sin marca scoring'};

const v023BaseShell=shell;
const v023BaseRenderEntity=v0203RenderEntity;

function v023ApplyVersion(){
  try{
    if(typeof V0206_VERSION_OBSERVER!=='undefined'&&V0206_VERSION_OBSERVER){
      V0206_VERSION_OBSERVER.disconnect();
      V0206_VERSION_OBSERVER=null;
    }
  }catch{}
  const label=`Operational Radar · v${V023}`;
  const badge=document.querySelector('.v019-brand small');
  if(badge){badge.textContent=label;badge.setAttribute('aria-label',label);}
  document.title=`AML Analytical Workbench · v${V023}`;
  document.documentElement.setAttribute('data-aml-build',V023);
}

shell=function(title,subtitle){
  v023BaseShell(title,subtitle);
  v023ApplyVersion();
};
if(typeof v0211ApplyVersion==='function'){
  v0211ApplyVersion=v023ApplyVersion;
}

function v023Num(v,d=1){
  const n=Number(v);return Number.isFinite(n)?n.toLocaleString('es-CL',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
}
function v023MarkLabel(id,name){return name||V023_LABELS[id]||id||'Marca';}
function v023BandLabel(v){return V023_BANDS[v]||String(v||'—').replaceAll('_',' ');}
function v023MarkEvidence(mark){
  const ev=mark?.evidence||{};
  const bits=[];
  if(ev.driver_year)bits.push(`año ${esc(String(ev.driver_year))}`);
  if(Number.isFinite(Number(ev.sales_band_delta)))bits.push(`Δ ventas ${Number(ev.sales_band_delta)>0?'+':''}${esc(String(ev.sales_band_delta))} tramos`);
  if(Number.isFinite(Number(ev.peer_percentile)))bits.push(`percentil ${v023Num(Number(ev.peer_percentile)*100,0)} pares`);
  if(Number.isFinite(Number(ev.entity_age_years)))bits.push(`edad ${v023Num(ev.entity_age_years,0)} años`);
  if(ev.termination_date)bits.push(`término SII ${esc(String(ev.termination_date))}`);
  if(Number.isFinite(Number(ev.procedures_60m)))bits.push(`${v023Num(ev.procedures_60m,0)} procedimientos / 60m`);
  if(Array.isArray(ev.regulators)&&ev.regulators.length)bits.push(ev.regulators.map(esc).join(' + '));
  if(Number.isFinite(Number(ev.recency_factor)))bits.push(`recencia ×${v023Num(ev.recency_factor,2)}`);
  return bits.length?bits.join(' · '):'Evidencia gobernada disponible en el detalle de la marca.';
}
function v023MarkRow(mark){
  const contributes=mark.included_in_score&&Number(mark.contribution)>0;
  const role=mark.semantic_class==='ROLE_CONTEXT';
  const cls=role?'context':(contributes?'scoring':'diagnostic');
  const right=role?'Contexto':(contributes?`aporte ${v023Num(mark.contribution,1)}`:'No puntúa');
  return `<article class="v023-mark ${cls}">
    <div class="v023-mark-head"><div><span>${esc(mark.mark_id)}</span><b>${esc(v023MarkLabel(mark.mark_id,mark.mark_name))}</b></div><strong>${esc(right)}</strong></div>
    <div class="v023-mark-metrics">${role?'':`<span>Intensidad <b>${v023Num(mark.raw_intensity,1)}</b></span>`}<span>${esc(String(mark.readiness||''))}</span></div>
    <p>${v023MarkEvidence(mark)}</p>
  </article>`;
}
function v023GroupRow(label,value,driver){
  const n=Math.max(0,Math.min(100,Number(value)||0));
  return `<div class="v023-group-row"><div><span>${esc(label)}</span><small>${driver?`conduce ${esc(driver)}`:'sin marca activa'}</small></div><progress max="100" value="${n}"></progress><b>${v023Num(n,1)}</b></div>`;
}
function v023ScorePanel(score,marks,compare){
  const active=(marks||[]).filter(m=>m.included_in_score&&Number(m.contribution)>0).sort((a,b)=>Number(b.contribution)-Number(a.contribution));
  const context=(marks||[]).filter(m=>m.semantic_class==='ROLE_CONTEXT');
  const diagnostics=(marks||[]).filter(m=>!m.included_in_score&&m.semantic_class!=='ROLE_CONTEXT');
  const hasScore=Number(score?.ipa3_score)>0;
  const oldScore=Number(compare?.ipa2_score);
  const old=Number.isFinite(oldScore)?v023Num(oldScore,1):'—';
  return `<section class="v023-ipa3" data-v023-ipa3>
    <div class="v023-title">
      <div><span>IPA 3.0 · SHADOW</span><h2>Prioridad analítica gobernada</h2><p>Marcas únicas por entidad, absorción de evidencia correlacionada y convergencia independiente.</p></div>
      <div class="v023-score"><b>${hasScore?v023Num(score.ipa3_score,1):'0,0'}</b><span>${esc(v023BandLabel(score?.priority_band_shadow))}</span><small>experimental · no probabilidad LA/FT</small></div>
    </div>
    <div class="v023-kpis">
      <div><span>Confianza</span><b>${v023Num(score?.score_confidence_pct,1)}%</b><small>no aumenta el IPA</small></div>
      <div><span>Cobertura</span><b>${v023Num(score?.coverage_index_pct,1)}%</b><small>calidad/alcance del dato</small></div>
      <div><span>Grupos independientes</span><b>${v023Num(score?.independent_group_count,0)}</b><small>registro · economía · sanciones</small></div>
      <div><span>Score actual</span><b>${old}</b><small>referencia Entity 360</small></div>
    </div>
    <div class="v023-groups">
      ${v023GroupRow('Registro / vigencia',score?.registry_group_score,score?.registry_driver_mark)}
      ${v023GroupRow('Trayectoria económica',score?.economic_group_score,score?.economic_driver_mark)}
      ${v023GroupRow('Sanciones',score?.sanctions_group_score,score?.sanctions_driver_mark)}
    </div>
    <div class="v023-formula"><b>Consolidación:</b> grupo dominante + 25% del segundo + 10% del tercero. Dentro de cada grupo se conserva sólo el fenómeno gobernado que mejor explica la evidencia; no se suman alertas repetidas.</div>
    <div class="v023-columns">
      <div><div class="v023-subhead"><b>Marcas que explican el IPA</b><span>${v019Fmt(active.length)} observadas</span></div><div class="v023-mark-list">${active.length?active.map(v023MarkRow).join(''):'<div class="v019-empty">Sin marcas scoring activas en este corte.</div>'}</div></div>
      <div><div class="v023-subhead"><b>Contexto y calibración</b><span>aporte 0</span></div><div class="v023-mark-list">${[...context,...diagnostics].length?[...context,...diagnostics].map(v023MarkRow).join(''):'<div class="v019-empty">Sin marcas contextuales/diagnósticas materializadas.</div>'}</div></div>
    </div>
    <div class="v023-guard">IPA 3.0 v0.3 ordena prioridad de revisión con información abierta/materializada. No acredita delito, incumplimiento ni probabilidad de LA/FT y todavía no reemplaza el score productivo.</div>
  </section>`;
}
async function v023LoadEntityIpa3(entityId){
  const id=String(entityId||'');if(!id)return;
  const host=document.querySelector('.v0209-score-explain')||document.querySelector('.v0203-entity-kpis')||document.querySelector('.v0203-hero-score');
  if(!host)return;
  document.querySelector('[data-v023-ipa3]')?.remove();
  const loading=document.createElement('div');loading.className='v023-loading';loading.dataset.v023Ipa3='';loading.textContent='Calculando IPA 3.0 shadow…';host.insertAdjacentElement('afterend',loading);
  try{
    const [scoreRes,marksRes,compareRes]=await Promise.all([
      sb.from(V023_SCORE_VIEW).select('entity_id,ipa3_score,priority_band_shadow,registry_group_score,registry_driver_mark,economic_group_score,economic_driver_mark,sanctions_group_score,sanctions_driver_mark,dominant_mark_id,included_mark_count,independent_group_count,absorbed_or_correlated_mark_count,diagnostic_mark_count,context_mark_count,score_confidence_pct,coverage_index_pct,score_as_of,score_version,production_enabled').eq('entity_id',id).maybeSingle(),
      sb.from(V023_MARK_VIEW).select('mark_id,mark_name,semantic_class,primary_dimension,score_group,included_in_score,raw_intensity,standalone_cap,contribution,confidence,readiness,source_ids,evidence,score_version').eq('entity_id',id).order('contribution',{ascending:false}),
      sb.from(V023_COMPARE_VIEW).select('ipa2_score,score_delta,ipa3_rank,ipa3_percentile,ipa2_rank,ipa2_percentile,rank_improvement').eq('entity_id',id).maybeSingle()
    ]);
    if(scoreRes.error)throw scoreRes.error;if(marksRes.error)throw marksRes.error;
    const score=scoreRes.data||{ipa3_score:0,priority_band_shadow:'SIN_MARCA_SHADOW'};
    loading.outerHTML=v023ScorePanel(score,marksRes.data||[],compareRes.error?null:compareRes.data);
  }catch(error){
    loading.className='v023-loading error';loading.textContent=`IPA 3.0 no disponible en este corte: ${error?.message||String(error)}`;
  }
}

v0203RenderEntity=function(pkg){
  v023BaseRenderEntity(pkg);
  const entity=pkg?.e||pkg?.entity;
  setTimeout(()=>{void v023LoadEntityIpa3(entity?.entity_id);},0);
};

window.__AML_ACTIVE_VERSION__=V023;
window.__AML_BUILD__=V023;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(v023ApplyVersion,0),{once:true});
else setTimeout(v023ApplyVersion,0);
