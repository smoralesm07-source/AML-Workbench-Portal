'use strict';

/* AML Workbench v0.27.0 · model consistency hardening
 * MISSING_IS_NOT_ZERO_STRICT: null/undefined/blank are never coerced to numeric zero.
 * Geographic Score B consumes IPA3 v0.4 regional snapshot and measures coverage on scoring components.
 * IPA3 Entity 360 consumes explicit absorption/effective-driver semantics v0.4.
 * NO_SII_PROFILE_TECHNICAL_ONLY: technical coverage state is not exposed as analytical reconciliation.
 */
const V027='0.27.0';
const V027_GEO_METHOD='GEO-RISK-B-0.27.0';
const V027_IPA_SCORE_VERSION='0.4-shadow';
const V027_IPA_REGION_VIEW='aml_v026_geo_ipa_region';
const V027_IPA_SCORE_VIEW='aml_v_ipa3_entity_score_v0_4';
const V027_IPA_MARK_VIEW='aml_v_ipa3_mark_scores_v0_4';
const V027_IPA_COMPARE_VIEW='aml_v_ipa3_compare_ipa2_v0_4';
let V027_IPA_REGION_CACHE=null;

const v027BaseShell=shell;
function v027ApplyVersion(){
  try{if(typeof V0206_VERSION_OBSERVER!=='undefined'&&V0206_VERSION_OBSERVER){V0206_VERSION_OBSERVER.disconnect();V0206_VERSION_OBSERVER=null;}}catch{}
  const label=`Operational Radar · v${V027}`;
  const badge=document.querySelector('.v019-brand small');
  if(badge){badge.textContent=label;badge.setAttribute('aria-label',label);}
  document.title=`AML Analytical Workbench · v${V027}`;
  document.documentElement.setAttribute('data-aml-build',V027);
}
shell=function(title,subtitle){v027BaseShell(title,subtitle);v027ApplyVersion();};
if(typeof v0211ApplyVersion==='function')v0211ApplyVersion=v027ApplyVersion;

/* ---------- Strict missing-value semantics ---------- */
function v027Finite(v){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));}
function v027Number(v){return v027Finite(v)?Number(v):null;}

v022Clamp=function(v,min=0,max=100){const n=v027Number(v);return n===null?null:Math.max(min,Math.min(max,n));};
v022Mean=function(xs){const vals=(xs||[]).filter(v027Finite).map(Number);return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null;};
v022Fmt=function(v,d=0){const n=v027Number(v);return n===null?'—':n.toLocaleString('es-CL',{minimumFractionDigits:d,maximumFractionDigits:d});};
v022Band=function(v){const n=v027Number(v);if(n===null)return 'Sin dato';return n>=75?'Muy alto':n>=60?'Alto':n>=40?'Medio':n>=20?'Bajo':'Muy bajo';};
v022Tone=function(v){const n=v027Number(v);if(n===null)return 'nodata';return n>=75?'very-high':n>=60?'high':n>=40?'medium':n>=20?'low':'very-low';};

v022PercentileMap=function(rows,valueKey,outKey){
  const valid=(rows||[]).map(r=>({r,v:v027Number(typeof valueKey==='function'?valueKey(r):r[valueKey])})).filter(x=>x.v!==null).sort((a,b)=>a.v-b.v);
  for(const r of rows||[])r[outKey]=null;
  if(!valid.length)return;
  const positions=new Map();
  valid.forEach((x,i)=>{const k=String(x.v);const a=positions.get(k)||[];a.push(i);positions.set(k,a);});
  for(const x of valid){const inds=positions.get(String(x.v));const rank=inds.reduce((a,b)=>a+b,0)/inds.length;x.r[outKey]=valid.length===1?50:100*rank/(valid.length-1);}
};

v022Weighted=function(parts,weights){
  let sum=0,weight=0;
  for(const [k,w] of Object.entries(weights||{})){const n=v027Number(parts?.[k]);if(n===null)continue;sum+=n*Number(w);weight+=Number(w);}
  return weight>0?sum/weight:null;
};

v022Cross=function(parts){
  const observed=['sector','cead','budget','cgr'].map(k=>v027Number(parts?.[k])).filter(v=>v!==null);
  if(observed.length<2)return null;
  const elevated=observed.filter(v=>v>=60);
  return elevated.length>=2?v022Mean(elevated):0;
};

const v027BaseMethodScore=v022MethodScore;
v022MethodScore=function(parts,method,level){
  if(method!=='C')return v027BaseMethodScore(parts,method,level);
  const sector=v027Number(parts?.sector);let prior=.15;if(sector!==null)prior=.12+.28*(sector/100);let z=Math.log(prior/(1-prior));
  for(const [k,a] of Object.entries({cead:1.15,budget:1,cgr:.8,cross:.6})){const v=v027Number(parts?.[k]);if(v!==null)z+=a*((v-50)/50);}
  return 100/(1+Math.exp(-z));
};

v022Coverage=function(parts,level){
  const weights=level==='COMMUNE'?{sector:25,cead:35,budget:25,cgr:5,cross:10}:{sector:20,cead:30,budget:25,cgr:15,cross:10};
  let have=0,total=0;for(const [k,w] of Object.entries(weights)){total+=w;if(v027Finite(parts?.[k]))have+=w;}return total?100*have/total:0;
};

/* ---------- Geographic model: IPA3 v0.4 + exact coverage ---------- */
function v025Num(v,d=1){const n=v027Number(v);return n===null?'—':n.toLocaleString('es-CL',{minimumFractionDigits:d,maximumFractionDigits:d});}
function v025Signed(v,d=1){const n=v027Number(v);return n===null?'—':`${n>0?'+':''}${v025Num(n,d)}`;}
v025IpaRecord=function(r){
  if(!r)return null;const num=k=>v027Number(r[k]);
  return {...r,entity_universe:num('entity_universe'),scored_entities:num('scored_entities'),scored_per_10k:num('scored_per_10k'),high_entities:num('high_entities'),high_per_10k:num('high_per_10k'),very_high_entities:num('very_high_entities'),multi_group_entities:num('multi_group_entities'),multi_group_per_10k:num('multi_group_per_10k'),ipa_pressure_mean_all:num('ipa_pressure_mean_all'),avg_ipa_scored:num('avg_ipa_scored'),max_ipa:num('max_ipa'),registry_pressure_mean_all:num('registry_pressure_mean_all'),economic_pressure_mean_all:num('economic_pressure_mean_all'),sanctions_pressure_mean_all:num('sanctions_pressure_mean_all'),avg_score_confidence_pct:num('avg_score_confidence_pct'),avg_coverage_index_pct:num('avg_coverage_index_pct'),top_marks:Array.isArray(r.top_marks)?r.top_marks:[]};
};
v025RegionCoverage=function(parts){
  const weights={sector:17,cead:25.5,budget:21.25,cgr:12.75,cross:8.5,ipa:15};let have=0,total=0;
  for(const [k,w] of Object.entries(weights)){total+=w;if(v027Finite(parts?.[k]))have+=w;}return total?100*have/total:0;
};
v025PrimaryDriver=function(parts){
  const labels={sector:'Sectores 19.913',cead:'CEAD',budget:'Presupuesto',cgr:'CGR',ipa:'Marcas IPA3'};
  return Object.keys(labels).map(k=>({key:k,label:labels[k],value:v027Number(parts?.[k])})).filter(x=>x.value!==null).sort((a,b)=>b.value-a.value)[0]||null;
};
v025Elevated=function(parts){return ['sector','cead','budget','cgr','ipa'].filter(k=>{const v=v027Number(parts?.[k]);return v!==null&&v>=60;});};
function v025CeadDetail(r){const cases=v027Number(r?.cead?.cases),yoy=v027Number(r?.cead?.yoy_pct);return `${cases===null?'sin casos comparables':v025Num(cases,0)+' casos'}${yoy===null?'':` · ${v025Signed(yoy,1)}%`}`;}
function v025BudgetDetail(r){const p1=v027Number(r?.budget?.p1_signals);return p1===null?'fuente no materializada':`P1 ${v025Num(p1,0)}`;}
function v025CgrDetail(r){const n=v027Number(r?.cgr?.findings);return n===null?'sin métrica comparable':`${v025Num(n,0)} hallazgos 2020+`;}
function v025SectorDetail(r){const n=v027Number(r?.sector?.started_2024);return n===null?'sin métrica comparable':`${v025Num(n,0)} inicios desde 2024`;}

const v027BaseLoadRaw=typeof v025BaseLoadRaw==='function'?v025BaseLoadRaw:v022LoadRaw;
v022LoadRaw=async function(){
  const raw=await v027BaseLoadRaw();
  try{
    if(!V027_IPA_REGION_CACHE)V027_IPA_REGION_CACHE=await v022FetchAll(V027_IPA_REGION_VIEW,'region,entity_universe,scored_entities,scored_per_10k,high_entities,high_per_10k,very_high_entities,multi_group_entities,multi_group_per_10k,ipa_pressure_mean_all,avg_ipa_scored,max_ipa,registry_pressure_mean_all,economic_pressure_mean_all,sanctions_pressure_mean_all,avg_score_confidence_pct,avg_coverage_index_pct,top_marks,score_version,snapshot_generated_at');
    raw.ipaRegion=V027_IPA_REGION_CACHE;raw.sourceStatus={...(raw.sourceStatus||{}),ipa:Array.isArray(raw.ipaRegion)&&raw.ipaRegion.length>0};
  }catch(error){console.warn('v0.27 IPA3 v0.4 regional snapshot unavailable',error);raw.ipaRegion=[];raw.sourceStatus={...(raw.sourceStatus||{}),ipa:false};}
  return raw;
};

const v027BaseCompute=v022Compute;
v022Compute=function(raw){
  const computed=v027BaseCompute(raw);
  for(const r of computed.regions||[]){
    r.coverage=v025RegionCoverage(r.parts,raw);
    r.confidence=r.coverage>=90?'ALTA':r.coverage>=75?'MEDIA':'BAJA';
    r.fit_for_secure_matrix=r.coverage>=80&&['sector','cead','budget','cgr','cross','ipa'].every(k=>v027Finite(r.parts?.[k]));
    r.export_status=r.fit_for_secure_matrix?'APTO':'PROVISIONAL_NO_APTO';
    if(typeof v026Profile==='function')r.explanatory_profile=v026Profile(r);
  }
  return computed;
};

V022_METHODS.B.note='Score regional v0.27: estructura B + 15% IPA3 v0.4. Los pesos se renormalizan sólo entre componentes realmente observados; ausencia de dato nunca equivale a cero. Cobertura usa exactamente Sector, CEAD, Presupuesto, CGR, Convergencia e IPA.';
const v027BaseSources=v022Sources;
v022Sources=function(raw){return v027BaseSources(raw).replaceAll('v0.3 shadow','v0.4 shadow');};
const v027BaseMarkTitle=v025MarkTitle;
v025MarkTitle=function(id){return v027BaseMarkTitle(id).replaceAll('v0.3','v0.4');};

const v027BaseExportRows=v022ExportRows;
v022ExportRows=function(level='region'){
  return v027BaseExportRows(level).map(x=>level==='region'?{...x,method_version:V022_STATE.method==='B'?V027_GEO_METHOD:x.method_version,score_formula_version:V022_STATE.method==='B'?V027_GEO_METHOD:x.score_formula_version,ipa_score_version:V027_IPA_SCORE_VERSION}:x);
};
v022ExportJson=function(){
  const methodVersion=V022_STATE.method==='B'?V027_GEO_METHOD:V022_METHOD_VERSION;
  const payload={schema:'AML_GEOGRAPHIC_RISK_EXPORT_V4',generated_at:new Date().toISOString(),method:{id:V022_STATE.method,name:V022_METHODS[V022_STATE.method].name,version:methodVersion,score_formula_version:V022_STATE.method==='B'?V027_GEO_METHOD:null,experimental:V022_STATE.method==='C'},explanatory_profile:{version:typeof V026_PROFILE_VERSION!=='undefined'?V026_PROFILE_VERSION:null,semantics:'DETERMINISTIC_SCORE_DRIVER_ATTRIBUTION_NOT_CAUSAL_INFERENCE'},ipa3:{score_version:V027_IPA_SCORE_VERSION,production_enabled:false,regional_weight_pct:V022_STATE.method==='B'?15:0,aggregation:'ENTITY_IPA3_EFFECTIVE_GROUP_DRIVERS_THEN_REGIONAL_PRESSURE_PERCENTILE',semantics:'PRIORIDAD_ANALITICA_NO_PROBABILIDAD_LAFT'},semantics:'TERRITORIAL_SUPERVISORY_CONTEXT_NOT_ENTITY_AML_PROBABILITY',guardrails:['MISSING_IS_NOT_ZERO_STRICT','EXPLANATORY_PROFILE_IS_NOT_CAUSAL_INFERENCE','IPA3_SHADOW_NOT_LAFT_PROBABILITY','COMPOSITE_MARKS_ABSORB_REUSED_EVIDENCE','ONE_EFFECTIVE_DRIVER_PER_IPA_GROUP','PRESS_DOES_NOT_EVIDENCE_CRIME','OSFL_PRESENCE_IS_EXPOSURE_NOT_ADVERSE_BY_ITSELF','CEAD_IS_TERRITORIAL_ACTIVITY_NOT_ATTRIBUTION','BUDGET_ANOMALY_IS_NOT_ILLEGALITY','CGR_FINDINGS_REQUIRE_DOCUMENTARY_TRACEABILITY'],region_rows:v022ExportRows('region'),commune_rows:v022ExportRows('commune')};
  v022Download(`aml_geographic_risk_${V022_STATE.method}_${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(payload,null,2),'application/json;charset=utf-8');
};

/* ---------- IPA3 Entity 360 v0.4 ---------- */
const v027BaseMarkEvidence=v023MarkEvidence;
v023MarkEvidence=function(mark){
  let text=v027BaseMarkEvidence(mark);const ev=mark?.evidence||{};
  if(ev.absorbed_by)text+=` · Absorbida por ${esc(String(ev.absorbed_by))} bajo Regla B`;
  if(ev.effective_group_driver)text+=` · No aditiva; conduce ${esc(String(ev.effective_group_driver))}`;
  return text;
};
const v027BaseMarkRow=v023MarkRow;
v023MarkRow=function(mark){let html=v027BaseMarkRow(mark);if(mark?.readiness==='ABSORBED_BY_COMPOSITE')html=html.replace('No puntúa','Absorbida');if(mark?.readiness==='CORRELATED_GROUP_NOT_ADDITIVE')html=html.replace('No puntúa','No aditiva');return html;};
const v027BaseScorePanel=v023ScorePanel;
v023ScorePanel=function(score,marks,compare){return v027BaseScorePanel(score,marks,compare).replaceAll('IPA 3.0 v0.3','IPA 3.0 v0.4');};
v023LoadEntityIpa3=async function(entityId){
  const id=String(entityId||'');if(!id)return;const host=document.querySelector('.v0209-score-explain')||document.querySelector('.v0203-entity-kpis')||document.querySelector('.v0203-hero-score');if(!host)return;
  document.querySelector('[data-v023-ipa3]')?.remove();const loading=document.createElement('div');loading.className='v023-loading';loading.dataset.v023Ipa3='';loading.textContent='Calculando IPA 3.0 v0.4 shadow…';host.insertAdjacentElement('afterend',loading);
  try{
    const [scoreRes,marksRes,compareRes]=await Promise.all([
      sb.from(V027_IPA_SCORE_VIEW).select('entity_id,ipa3_score,priority_band_shadow,registry_group_score,registry_driver_mark,economic_group_score,economic_driver_mark,sanctions_group_score,sanctions_driver_mark,dominant_mark_id,included_mark_count,independent_group_count,absorbed_or_correlated_mark_count,diagnostic_mark_count,context_mark_count,score_confidence_pct,coverage_index_pct,score_as_of,score_version,production_enabled').eq('entity_id',id).maybeSingle(),
      sb.from(V027_IPA_MARK_VIEW).select('mark_id,mark_name,semantic_class,primary_dimension,score_group,included_in_score,raw_intensity,standalone_cap,contribution,confidence,readiness,source_ids,evidence,score_version').eq('entity_id',id).order('contribution',{ascending:false}),
      sb.from(V027_IPA_COMPARE_VIEW).select('ipa2_score,score_delta,ipa3_rank,ipa3_percentile,ipa2_rank,ipa2_percentile,rank_improvement').eq('entity_id',id).maybeSingle()
    ]);
    if(scoreRes.error)throw scoreRes.error;if(marksRes.error)throw marksRes.error;const score=scoreRes.data||{ipa3_score:0,priority_band_shadow:'SIN_MARCA_SHADOW'};loading.outerHTML=v023ScorePanel(score,marksRes.data||[],compareRes.error?null:compareRes.data);
  }catch(error){loading.className='v023-loading error';loading.textContent=`IPA 3.0 v0.4 no disponible: ${error?.message||String(error)}`;}
};

/* ---------- UAF↔SII reconciliation: analytical surface only on comparable universe ---------- */
const v027BaseReconciliation=v0205LoadReconciliation;
function v027ReconciliationFilter(k){return ['matched','active','terminated'].includes(k)?k:(k==='all'?'matched':'terminated');}
async function v027SanitizeReconciliation(){
  const c=await v0205LoadCounts();
  document.querySelectorAll('[data-v0205-filter="all"],[data-v0205-filter="unmatched"],[data-v0205-filter="review"]').forEach(el=>el.remove());
  const review=document.querySelector('.v0205-review');if(review)review.innerHTML=`<span>Universo comparable</span><b>${v019Fmt(c.matched)}</b><small>${v019Fmt(c.active)} activos + ${v019Fmt(c.terminated)} con término publicado</small>`;
  const heroP=document.querySelector('.v0205-hero p');if(heroP)heroP.textContent='La conciliación visible compara sólo SO UAF con perfil SII materializado. El término de giro orienta revisión de vigencia/actualización y no implica incumplimiento.';
}
v0205LoadReconciliation=async function(filter='terminated',initialSearch=''){await v027BaseReconciliation(v027ReconciliationFilter(filter),initialSearch);await v027SanitizeReconciliation();v027ApplyVersion();};

const v027BaseAppendEntityReconciliation=v0205AppendEntityReconciliation;
v0205AppendEntityReconciliation=async function(e){
  if(!e?.is_uaf_observed)return;
  try{
    const {data:r,error}=await sb.from('aml_v0210_uaf_sii_reconciliation').select('rut,reconciliation_status,uaf_category_hint').eq('entity_id',e.entity_id).maybeSingle();
    if(error||!r)return;
    if(r.reconciliation_status==='NO_SII_PROFILE'){
      const hero=document.querySelector('.v0203-entity-hero');if(!hero)return;const h=hero.querySelector('h1'),p=hero.querySelector('p');if(h)h.textContent=`RUT ${r.rut||'—'}`;if(p&&r.uaf_category_hint)p.textContent=`Categoría UAF: ${r.uaf_category_hint} · identidad pendiente de enriquecimiento tributario`;return;
    }
    await v027BaseAppendEntityReconciliation(e);
  }catch{}
};

/* ---------- Final rendering/version wrapper ---------- */
const v027BaseRender=v022Render;
v022Render=function(){
  v027BaseRender();const root=v019Content();if(root){const eyebrow=root.querySelector('.v022-eyebrow');if(eyebrow)eyebrow.textContent=`TERRITORIAL INTELLIGENCE · ${V027_GEO_METHOD}`;const hero=root.querySelector('.v022-hero p');if(hero)hero.textContent='Score B territorial explicable con IPA3 v0.4. Ausencia de una fuente permanece nula y los pesos se renormalizan sólo entre componentes observados; el perfil conductor es descriptivo, no inferencia causal ni probabilidad de LA/FT.';}v027ApplyVersion();
};

window.__AML_ACTIVE_VERSION__=V027;
window.__AML_BUILD__=V027;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(v027ApplyVersion,0),{once:true});else setTimeout(v027ApplyVersion,0);
