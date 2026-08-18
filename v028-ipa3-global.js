'use strict';

/* AML Workbench v0.28.0 · IPA 3.0 global entity contract
 * IPA3 v0.4-shadow becomes a transversal entity attribute across the UI.
 * - One governed score source: aml_v_ipa3_entity_score_v0_4.
 * - Batch/cached hydration by entity_id; no local score recalculation.
 * - Finding cards show IPA3 entity priority as primary and IPA2 finding score only as reference.
 * - Entity controls across listings/drill-downs expose an IPA3 chip.
 * - Entity 360 reads v0.4 score/marks/compare views.
 */
const V028='0.28.0';
const V028_BUILD='0280';
const V028_SCORE_VIEW='aml_v_ipa3_entity_score_v0_4';
const V028_MARK_VIEW='aml_v_ipa3_mark_scores_v0_4';
const V028_COMPARE_VIEW='aml_v_ipa3_compare_ipa2_v0_4';
const V028_CACHE=new Map();
const V028_SLOTS=new Map();
const V028_PENDING=new Set();
let V028_FETCH_TIMER=null;
let V028_SCAN_TIMER=null;

function v028Num(v,d=1){
  const n=Number(v);
  return Number.isFinite(n)?n.toLocaleString('es-CL',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
}
function v028BandLabel(v){
  const m={MUY_ALTA:'Muy alta',ALTA:'Alta',MEDIA:'Media',BAJA:'Baja',SIN_MARCA_SHADOW:'Sin marca'};
  return m[v]||String(v||'Sin marca').replaceAll('_',' ');
}
function v028BandClass(v){
  const k=String(v||'').toUpperCase();
  if(k==='MUY_ALTA')return 'very-high';
  if(k==='ALTA')return 'high';
  if(k==='MEDIA')return 'medium';
  if(k==='BAJA')return 'low';
  return 'zero';
}
function v028ScoreTitle(s){
  if(!s)return 'IPA 3.0 no disponible en este corte';
  const bits=[`IPA3 ${v028Num(s.ipa3_score,1)} · ${v028BandLabel(s.priority_band_shadow)}`];
  if(s.dominant_mark_id)bits.push(`marca conductora ${s.dominant_mark_id}`);
  if(s.score_confidence_pct!=null)bits.push(`confianza ${v028Num(s.score_confidence_pct,0)}%`);
  if(s.coverage_index_pct!=null)bits.push(`cobertura ${v028Num(s.coverage_index_pct,0)}%`);
  bits.push('prioridad analítica; no probabilidad LA/FT');
  return bits.join(' · ');
}
function v028DefaultScore(id){
  return {entity_id:id,ipa3_score:0,priority_band_shadow:'SIN_MARCA_SHADOW',score_confidence_pct:null,coverage_index_pct:null,dominant_mark_id:null,score_version:'0.4-shadow',production_enabled:false};
}
function v028RegisterSlot(id,el,mode='chip'){
  if(!id||!el)return;
  el.dataset.v028IpaEntity=id;
  el.dataset.v028IpaMode=mode;
  if(!V028_SLOTS.has(id))V028_SLOTS.set(id,new Set());
  V028_SLOTS.get(id).add(el);
  const cached=V028_CACHE.get(id);
  if(cached)v028RenderSlot(el,cached);
  else{V028_PENDING.add(id);v028ScheduleFetch();}
}
function v028RenderSlot(el,s){
  if(!el?.isConnected)return;
  const mode=el.dataset.v028IpaMode||'chip';
  const score=Number(s?.ipa3_score);
  const has=Number.isFinite(score);
  const cls=v028BandClass(s?.priority_band_shadow);
  el.classList.remove('very-high','high','medium','low','zero','error');
  el.classList.add(cls);
  el.title=v028ScoreTitle(s);
  el.setAttribute('aria-label',v028ScoreTitle(s));
  if(mode==='finding'){
    const b=el.querySelector('[data-v028-score-value]');
    const band=el.querySelector('[data-v028-score-band]');
    const ref=el.querySelector('[data-v028-ipa2-ref]');
    if(b)b.textContent=has?v028Num(score,1):'—';
    if(band)band.textContent=`IPA 3.0 · ${v028BandLabel(s?.priority_band_shadow)}`;
    if(ref){const old=el.dataset.v028Ipa2||'—';ref.textContent=`IPA2 hallazgo ref. ${old}`;}
    return;
  }
  el.textContent=has?`IPA3 ${v028Num(score,1)} · ${v028BandLabel(s?.priority_band_shadow)}`:'IPA3 —';
}
function v028RenderError(id,message){
  const slots=V028_SLOTS.get(id)||[];
  for(const el of slots){
    if(!el?.isConnected)continue;
    el.classList.add('error');
    if(el.dataset.v028IpaMode==='finding'){
      const b=el.querySelector('[data-v028-score-value]');if(b)b.textContent='—';
      const band=el.querySelector('[data-v028-score-band]');if(band)band.textContent='IPA 3.0 · no disponible';
    }else el.textContent='IPA3 no disponible';
    el.title=message||'No fue posible consultar IPA 3.0';
  }
}
async function v028FetchScores(ids){
  const unique=[...new Set((ids||[]).map(String).filter(Boolean))];
  if(!unique.length)return;
  for(let i=0;i<unique.length;i+=80){
    const batch=unique.slice(i,i+80);
    const {data,error}=await sb.from(V028_SCORE_VIEW).select('entity_id,ipa3_score,priority_band_shadow,score_confidence_pct,coverage_index_pct,dominant_mark_id,included_mark_count,independent_group_count,registry_group_score,economic_group_score,sanctions_group_score,score_as_of,score_version,production_enabled').in('entity_id',batch);
    if(error){batch.forEach(id=>v028RenderError(id,error.message||String(error)));continue;}
    const map=new Map((data||[]).map(r=>[String(r.entity_id),r]));
    for(const id of batch){
      const row=map.get(id)||v028DefaultScore(id);
      V028_CACHE.set(id,row);
      const slots=V028_SLOTS.get(id)||[];
      for(const el of slots)v028RenderSlot(el,row);
    }
  }
}
function v028ScheduleFetch(){
  if(V028_FETCH_TIMER)return;
  V028_FETCH_TIMER=setTimeout(async()=>{
    V028_FETCH_TIMER=null;
    const ids=[...V028_PENDING];V028_PENDING.clear();
    try{await v028FetchScores(ids);}catch(error){ids.forEach(id=>v028RenderError(id,error?.message||String(error)));}
  },35);
}
function v028FindingEntityId(el){
  const key=el?.dataset?.v0202Finding;
  if(!key||typeof V0202_FINDINGS==='undefined')return '';
  return String(V0202_FINDINGS.get(key)?.entity_id||'');
}
function v028EntityId(el){
  if(!el)return '';
  const d=el.dataset||{};
  return String(d.v028EntityRoot||d.openEntity||d.v0205Entity||d.v024CrossEntity||d.v024SanctionEntity||d.soEntity||d.openSo||d.entityId||d.entity||v028FindingEntityId(el)||'');
}
function v028CreateFindingSlot(scoreBox,id){
  if(!scoreBox||scoreBox.dataset.v028IpaBound)return;
  const old=scoreBox.querySelector('b')?.textContent?.trim()||'—';
  scoreBox.dataset.v028IpaBound='1';
  scoreBox.dataset.v028Ipa2=old;
  scoreBox.classList.add('v028-ipa3-primary');
  scoreBox.innerHTML='<b data-v028-score-value>…</b><span data-v028-score-band>IPA 3.0</span><small data-v028-ipa2-ref></small>';
  v028RegisterSlot(id,scoreBox,'finding');
}
function v028CreateChip(host,id,placement='append'){
  if(!host||!id)return;
  if(host.querySelector?.(`.v028-ipa3-chip[data-v028-ipa-entity="${CSS.escape(id)}"]`))return;
  const chip=document.createElement('span');
  chip.className='v028-ipa3-chip zero';
  chip.dataset.v028IpaEntity=id;
  chip.textContent='IPA3 …';
  if(placement==='prepend')host.prepend(chip);else host.append(chip);
  v028RegisterSlot(id,chip,'chip');
}
function v028Decorate(el){
  if(!el?.isConnected||el.dataset.v028Decorated==='1')return;
  const id=v028EntityId(el);if(!id)return;
  el.dataset.v028Decorated='1';
  if(el.matches('.v0202-alert[data-v0202-finding],[data-v028-entity-root].v0202-alert')){
    const scoreBox=el.querySelector('.v0202-alert-score');
    if(scoreBox)v028CreateFindingSlot(scoreBox,id);
    else v028CreateChip(el,id);
    return;
  }
  if(el.matches('[data-v028-entity-root]')&&el.classList.contains('v0201-finding')){
    const scoreBox=el.querySelector('.v0201-score');
    if(scoreBox)v028CreateFindingSlot(scoreBox,id);else v028CreateChip(el,id,'prepend');
    return;
  }
  if(el.matches('[data-so-entity]')){
    v028CreateChip(el.querySelector('.v0192-so-signals')||el,id);
    return;
  }
  if(el.matches('[data-open-so]')&&el.closest('[data-so-entity]'))return;
  if(el.matches('[data-v0205-entity]')){
    v028CreateChip(el.parentElement||el,id,'prepend');return;
  }
  if(el.matches('[data-v024-sanction-entity]')){
    v028CreateChip(el.closest('article')?.lastElementChild||el.parentElement||el,id,'prepend');return;
  }
  if(el.matches('[data-v024-cross-entity]')){
    v028CreateChip(el,id);return;
  }
  if(el.matches('[data-open-entity]')){
    const host=el.closest('article,[data-entity-row],tr')||el;
    v028CreateChip(host,id);return;
  }
  v028CreateChip(el,id);
}
const V028_ENTITY_SELECTOR='[data-v028-entity-root],.v0202-alert[data-v0202-finding],[data-open-entity],[data-v0205-entity],[data-v024-cross-entity],[data-v024-sanction-entity],[data-so-entity],[data-open-so],[data-entity-id]';
function v028Scan(root=document){
  if(root?.matches?.(V028_ENTITY_SELECTOR))v028Decorate(root);
  root?.querySelectorAll?.(V028_ENTITY_SELECTOR).forEach(v028Decorate);
}
function v028ScheduleScan(root=document){
  if(V028_SCAN_TIMER)return;
  V028_SCAN_TIMER=setTimeout(()=>{V028_SCAN_TIMER=null;v028Scan(root);},20);
}

/* Finding renderers: mark the root so drawers/cards always resolve entity_id. */
if(typeof v0202FindingAlert==='function'){
  const v028BaseFindingAlert=v0202FindingAlert;
  v0202FindingAlert=function(f,rank=null,compact=false){
    const html=v028BaseFindingAlert(f,rank,compact);
    const id=String(f?.entity_id||'');
    if(!id)return html;
    return html.replace('<article class="v0202-alert ',`<article data-v028-entity-root="${esc(id)}" class="v0202-alert `);
  };
}
if(typeof v0201FindingDrawerHtml==='function'){
  const v028BaseFindingDrawer=v0201FindingDrawerHtml;
  v0201FindingDrawerHtml=function(f,ctx){
    const html=v028BaseFindingDrawer(f,ctx),id=String(f?.entity_id||'');
    if(!id)return html;
    return html.replace('<div class="v0201-finding ',`<div data-v028-entity-root="${esc(id)}" class="v0201-finding `);
  };
}

/* Entity 360: switch the detailed IPA panel to the governed v0.4 views. */
async function v028LoadEntityIpa3(entityId){
  const id=String(entityId||'');if(!id)return;
  const host=document.querySelector('.v0209-score-explain')||document.querySelector('.v0203-entity-kpis')||document.querySelector('.v0203-hero-score');
  if(!host)return;
  document.querySelector('[data-v023-ipa3]')?.remove();
  const loading=document.createElement('div');loading.className='v023-loading';loading.dataset.v023Ipa3='';loading.textContent='Consultando IPA 3.0 v0.4…';host.insertAdjacentElement('afterend',loading);
  try{
    const [scoreRes,marksRes,compareRes]=await Promise.all([
      sb.from(V028_SCORE_VIEW).select('*').eq('entity_id',id).maybeSingle(),
      sb.from(V028_MARK_VIEW).select('mark_id,mark_name,semantic_class,primary_dimension,score_group,correlation_group,included_in_score,raw_intensity,standalone_cap,contribution,confidence,readiness,source_ids,evidence,score_version').eq('entity_id',id).order('contribution',{ascending:false}),
      sb.from(V028_COMPARE_VIEW).select('ipa2_score,score_delta,ipa3_rank,ipa3_percentile,ipa2_rank,ipa2_percentile,rank_improvement,ipa3_version,ipa2_version').eq('entity_id',id).maybeSingle()
    ]);
    if(scoreRes.error)throw scoreRes.error;if(marksRes.error)throw marksRes.error;
    const score=scoreRes.data||v028DefaultScore(id);
    V028_CACHE.set(id,score);
    let panel=typeof v023ScorePanel==='function'?v023ScorePanel(score,marksRes.data||[],compareRes.error?null:compareRes.data):'';
    panel=panel.replaceAll('IPA 3.0 v0.3','IPA 3.0 v0.4-shadow').replaceAll('v0.3 ordena','v0.4-shadow ordena');
    loading.outerHTML=panel||'<div class="v019-empty">IPA 3.0 sin panel de detalle disponible.</div>';
  }catch(error){loading.className='v023-loading error';loading.textContent=`IPA 3.0 v0.4 no disponible: ${error?.message||String(error)}`;}
}
if(typeof v023LoadEntityIpa3==='function')v023LoadEntityIpa3=v028LoadEntityIpa3;

/* Public client contract for any future module. */
window.AML_IPA3={
  version:'0.4-shadow',scoreView:V028_SCORE_VIEW,markView:V028_MARK_VIEW,compareView:V028_COMPARE_VIEW,
  get:async entityId=>{const id=String(entityId||'');if(!id)return null;if(!V028_CACHE.has(id))await v028FetchScores([id]);return V028_CACHE.get(id)||null;},
  batch:async ids=>{await v028FetchScores(ids);return (ids||[]).map(id=>V028_CACHE.get(String(id))||null);},
  refresh:async entityId=>{const id=String(entityId||'');V028_CACHE.delete(id);await v028FetchScores([id]);return V028_CACHE.get(id)||null;},
  scan:v028Scan
};

const V028_OBSERVER=new MutationObserver(mutations=>{
  for(const m of mutations)for(const n of m.addedNodes)if(n.nodeType===1)v028ScheduleScan(n);
});
V028_OBSERVER.observe(document.documentElement,{childList:true,subtree:true});

/* v0.28.0 is the final runtime/version authority. */
function v028ApplyVersion(){
  window.__AML_ACTIVE_VERSION__=V028;
  window.__AML_BUILD__=V028_BUILD;
  const label=`Operational Radar · v${V028}`;
  const badge=document.querySelector('.v019-brand small');
  if(badge){badge.setAttribute('data-runtime-label',label);badge.setAttribute('aria-label',label);badge.dataset.activeVersion=V028;}
  document.title=`AML Analytical Workbench · v${V028}`;
  document.documentElement.setAttribute('data-aml-version',V028);
  document.documentElement.setAttribute('data-aml-build',V028_BUILD);
}
window.__AML_RUNTIME_VERSION_APPLIER__=v028ApplyVersion;
v028ApplyVersion();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{v028ApplyVersion();v028Scan(document);},{once:true});
else v028Scan(document);
