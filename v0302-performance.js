'use strict';

/* AML Workbench v0.30.2 · runtime performance + reliable audit
 * Read paths use materialized snapshots. Context sources never block the structured app.
 */
const V0302='0.30.2';
const V0302_BUILD='0302';
const V0302_IPA_SNAPSHOT='aml_ipa3_entity_score_snapshot_v0_4';
const V0302_OSFL_DASH='aml_osfl_dashboard_runtime_snapshot';
const V0302_OVERVIEW='aml_overview_runtime_snapshot';
const V0302_HEALTH_VIEW='aml_v0302_runtime_health';
const V0302_PIPELINES=['AML_MAIN','SII_ENTITY_YEAR','OSFL_PROFILE','SANCTION_IDENTITY','RUNTIME_SNAPSHOT'];
let V0302_OVERVIEW_PROMISE=null;
let V0302_HEALTH_PROMISE=null;

function v0302Timeout(promise,ms,fallback){
  return Promise.race([promise,new Promise(resolve=>setTimeout(()=>resolve(fallback),ms))]);
}
async function v0302OverviewSnapshot(force=false){
  if(V0302_OVERVIEW_PROMISE&&!force)return V0302_OVERVIEW_PROMISE;
  V0302_OVERVIEW_PROMISE=(async()=>{const {data,error}=await sb.from(V0302_OVERVIEW).select('generated_at,core,analytics,meta').eq('snapshot_key','CURRENT').maybeSingle();if(error)throw error;return data||{core:{},analytics:{},meta:{}};})();
  try{return await V0302_OVERVIEW_PROMISE;}catch(e){V0302_OVERVIEW_PROMISE=null;throw e;}
}

/* One structured DB request instead of the historical fan-out. */
v019LoadCore=async function(force=false){
  if(v019Cache.core&&!force)return v019Cache.core;
  const snap=await v0302OverviewSnapshot(force),core=snap.core||{};
  const [press,economy]=await Promise.all([
    v0302Timeout(typeof v019FetchPress==='function'?v019FetchPress():Promise.resolve(null),1800,{error:'Contexto Prensa pendiente',phenomena:[]}),
    v0302Timeout(typeof v0191FetchEconomy==='function'?v0191FetchEconomy():Promise.resolve(null),1800,{error:'Context Hub pendiente'})
  ]);
  const status={findings:true,regions:true,gaps:true,gapSectors:true,uafRegions:true,uafCross:true,patterns:true,press:!press?.error,economy:!economy?.error};
  if(typeof V0222_STATUS!=='undefined')V0222_STATUS.core=status;
  v019Cache.core={findings:core.findings||[],regions:core.regions||[],gaps:core.gaps||[],gapSectors:core.gapSectors||[],uafRegions:core.uafRegions||[],uafCross:core.uafCross||[],patterns:core.patterns||[],press:press||{error:'pending',phenomena:[]},economy:economy||{error:'pending'},sourceStatus:status,runtimeGeneratedAt:snap.generated_at};
  return v019Cache.core;
};

v020LoadAnalytics=async function(force=false){
  if(V020_CACHE&&!force)return V020_CACHE;
  const snap=await v0302OverviewSnapshot(force),a=snap.analytics||{};
  const budget=await v0302Timeout(typeof v020FetchBudget==='function'?v020FetchBudget():Promise.resolve(null),1800,{error:'Presupuesto pendiente',metrics:{},priority_tiers:{},top_signals:[]});
  const status={mix:true,bands:true,families:true,sanYears:true,producers:true,budget:!budget?.error};
  if(typeof V0222_STATUS!=='undefined')V0222_STATUS.analytics=status;
  V020_CACHE={mix:a.mix||[],bands:a.bands||[],families:a.families||[],sanYears:a.sanYears||[],producers:a.producers||[],budget:budget||{error:'pending',metrics:{},priority_tiers:{},top_signals:[]},sourceStatus:status,runtimeGeneratedAt:snap.generated_at};
  return V020_CACHE;
};

v0194HomeMeta=async function(force=false){
  const snap=await v0302OverviewSnapshot(force);V0194_HOME_META=snap.meta||{};return V0194_HOME_META;
};

/* OSFL opens with one compact row and pages entities from its runtime table. */
v030LoadMeta=async function(force=false){
  if(V030_CACHE.meta&&!force)return V030_CACHE;
  const {data,error}=await sb.from(V0302_OSFL_DASH).select('generated_at,source_snapshot,ipa3_version,meta,regions,activities,years,bands,quality,source_coverage').eq('snapshot_key','CURRENT').maybeSingle();
  if(error)throw error;if(!data)throw new Error('Snapshot OSFL runtime no materializado');
  V030_CACHE.meta=data.meta||{};V030_CACHE.regions=Array.isArray(data.regions)?data.regions:[];V030_CACHE.activities=Array.isArray(data.activities)?data.activities:[];V030_CACHE.years=Array.isArray(data.years)?data.years:[];V030_CACHE.bands=Array.isArray(data.bands)?data.bands:[];V030_CACHE.quality=data.quality||{};V030_CACHE.sourceCoverage=data.source_coverage||{};V030_CACHE.runtimeGeneratedAt=data.generated_at;V030_CACHE.runtimeSourceSnapshot=data.source_snapshot;return V030_CACHE;
};

/* Global IPA hydration uses the fast score snapshot. Detailed marks remain governed live on Entity 360. */
v028FetchScores=async function(ids){
  const unique=[...new Set((ids||[]).map(String).filter(Boolean))];if(!unique.length)return;
  for(let i=0;i<unique.length;i+=100){
    const batch=unique.slice(i,i+100);
    const {data,error}=await sb.from(V0302_IPA_SNAPSHOT).select('entity_id,ipa3_score,priority_band_shadow,score_confidence_pct,coverage_index_pct,dominant_mark_id,included_mark_count,independent_group_count,registry_group_score,economic_group_score,sanctions_group_score,score_as_of,score_version,production_enabled').in('entity_id',batch);
    if(error){batch.forEach(id=>v028RenderError(id,error.message||String(error)));continue;}
    const map=new Map((data||[]).map(r=>[String(r.entity_id),r]));
    for(const id of batch){const row=map.get(id)||v028DefaultScore(id);V028_CACHE.set(id,row);const slots=V028_SLOTS.get(id)||[];for(const el of slots)v028RenderSlot(el,row);}
  }
};
if(window.AML_IPA3){window.AML_IPA3.scoreView=V0302_IPA_SNAPSHOT;window.AML_IPA3.get=async id=>{id=String(id||'');if(!id)return null;if(!V028_CACHE.has(id))await v028FetchScores([id]);return V028_CACHE.get(id)||null;};window.AML_IPA3.batch=async ids=>{await v028FetchScores(ids);return (ids||[]).map(id=>V028_CACHE.get(String(id))||null);};}

function v0302AgeLabel(value){if(!value)return 'sin sello';const ms=Date.now()-new Date(value).getTime();if(!Number.isFinite(ms))return 'sello informado';const min=Math.max(0,Math.floor(ms/60000));if(min<60)return `hace ${min} min`;const h=Math.floor(min/60);if(h<48)return `hace ${h} h`;return `hace ${Math.floor(h/24)} d`;}
async function v0302PipelineHealth(force=false){
  if(V0302_HEALTH_PROMISE&&!force)return V0302_HEALTH_PROMISE;
  V0302_HEALTH_PROMISE=(async()=>{const {data,error}=await sb.from(V0302_HEALTH_VIEW).select('pipeline,status,updated_at,detail').in('pipeline',V0302_PIPELINES);if(error)throw error;return new Map((data||[]).map(r=>[r.pipeline,r]));})();
  try{return await V0302_HEALTH_PROMISE;}catch(e){V0302_HEALTH_PROMISE=null;throw e;}
}
function v0302PipeStatus(r){if(!r)return {cls:'pending',label:'Sin sello'};return String(r.status).toUpperCase()==='SUCCESS'?{cls:'ok',label:'Sincronizado'}:{cls:'pending',label:String(r.status||'Pendiente')};}
function v0302RuntimeStatus(runtime,sources){
  const base=v0302PipeStatus(runtime);if(base.cls!=='ok')return base;
  const rt=new Date(runtime?.updated_at||0).getTime();const sourceTimes=(sources||[]).map(r=>new Date(r?.updated_at||0).getTime()).filter(Number.isFinite);const latest=sourceTimes.length?Math.max(...sourceTimes):0;
  if(latest&&(!Number.isFinite(rt)||rt+5*60*1000<latest))return {cls:'pending',label:'Snapshot actualizando'};
  return {cls:'ok',label:'Snapshot vigente'};
}

/* Audit is based on pipeline state, never on expensive reconciliation fallbacks. */
v0207LoadFreshness=async function(force=false){
  if(V0207_FRESHNESS_CACHE&&!force)return V0207_FRESHNESS_CACHE;
  const [health,uaf]=await Promise.all([v0302PipelineHealth(force),v0302Timeout(v0193LoadUafData(force),2200,null)]);
  const main=health.get('AML_MAIN'),sii=health.get('SII_ENTITY_YEAR'),osfl=health.get('OSFL_PROFILE'),san=health.get('SANCTION_IDENTITY'),runtime=health.get('RUNTIME_SNAPSHOT');
  const dash=uaf?.dashboard||{},k=dash.kpis||{};
  V0207_FRESHNESS_CACHE={uafCut:k.registered_total_as_of||k.registered_private_as_of||null,uafRadarGenerated:dash.generated_at||main?.updated_at||null,uafScope:uaf?.dashboard_scope||uaf?.asset_scope||'WORKBENCH',siiRetrieved:sii?.updated_at||null,siiLatestYear:2024,fusionMaterialized:main?.updated_at||null,siiMaterialized:sii?.updated_at||null,explicitSync:!!main,syncStatus:main?.status||null,snapshotId:main?.detail?.snapshot_version||null,fusionRunId:main?.detail?.github_sync_run_id||null,siiSourceRunId:sii?.detail?.source_run_id||null,uafStatus:v0302PipeStatus(main),siiStatus:v0302PipeStatus(sii),pipelineHealth:{main,sii,osfl,san,runtime},runtimeStatus:v0302RuntimeStatus(runtime,[main,sii,osfl,san])};
  return V0207_FRESHNESS_CACHE;
};

v024AuditHtml=function(f){
  if(!f)return `<section class="v024-audit pending"><div class="v024-audit-summary"><span class="v024-audit-title">${v024StatusDot('pending','Auditoría de datos')}</span><b>Consultando sellos…</b></div></section>`;
  const h=f.pipelineHealth||{},rows=[{label:'Fusion',row:h.main,status:v0302PipeStatus(h.main)},{label:'SII',row:h.sii,status:v0302PipeStatus(h.sii)},{label:'OSFL',row:h.osfl,status:v0302PipeStatus(h.osfl)},{label:'Sanciones',row:h.san,status:v0302PipeStatus(h.san)},{label:'Runtime',row:h.runtime,status:f.runtimeStatus||v0302PipeStatus(h.runtime)}];const bad=rows.some(x=>x.status.cls!=='ok');
  const context=[];if(typeof V0222_STATUS!=='undefined'){if(V0222_STATUS.core?.press===false)context.push('Prensa');if(V0222_STATUS.core?.economy===false)context.push('Context Hub');if(V0222_STATUS.analytics?.budget===false)context.push('Presupuesto');}
  return `<section class="v024-audit ${bad?'pending':'ok'}"><button type="button" class="v024-audit-summary" data-v024-audit-toggle aria-expanded="false"><span class="v024-audit-title">${v024StatusDot(bad?'pending':'ok','Auditoría de datos')}</span><span class="v024-audit-lights">${rows.map(x=>v024StatusDot(x.status.cls,x.label)).join('')}</span><b>${bad?'Actualizando':'Operativa'}</b><small>clic para detalle</small></button><div class="v024-audit-detail" data-v024-audit-detail hidden>${rows.map(x=>`<div><span>${esc(x.label)}</span><b>${esc(x.status.label)}</b><small>${esc(v0302AgeLabel(x.row?.updated_at))}${x.row?.detail?.rows?` · ${v019Fmt(x.row.detail.rows)} filas`:''}</small></div>`).join('')}${context.length?`<p><b>Contexto no bloqueante:</b> ${esc(context.join(' · '))}. La ausencia contextual no invalida los datos estructurados.</p>`:'<p>Todos los sellos estructurados y el snapshot de lectura están vigentes.</p>'}</div></section>`;
};

/* Only structural failures produce the global "Carga parcial" banner. */
v024Unavailable=function(){
  if(typeof V0222_STATUS==='undefined')return [];
  const labels={findings:'Hallazgos',regions:'Prioridad regional',gaps:'Brecha regional',gapSectors:'Brecha sectorial',uafRegions:'UAF regional',uafCross:'Cruce UAF-radares',patterns:'Patrones',mix:'Composición',bands:'Bandas IPA',families:'Familias de patrones',sanYears:'Serie de sanciones',producers:'Productores',reportability:'Reportabilidad UAF',dashboard:'Dashboard UAF',rules:'Reglas UAF'};
  const structural=['findings','regions','gaps','gapSectors','uafRegions','uafCross','patterns','mix','bands','families','sanYears','producers','reportability','dashboard','rules'],out=[];
  for(const group of Object.values(V0222_STATUS))for(const key of structural)if(group?.[key]===false&&!out.includes(labels[key]))out.push(labels[key]);
  return out;
};

window.AML_RUNTIME_SNAPSHOTS={version:V0302,overview:V0302_OVERVIEW,osfl:V0302_OSFL_DASH,ipa3:V0302_IPA_SNAPSHOT,health:V0302_HEALTH_VIEW};
