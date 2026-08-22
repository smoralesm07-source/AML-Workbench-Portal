'use strict';

/* AML Workbench v0.20.8 · freshness + explicit synchronization state
 * - UAF assets: Radar_UAF Pages first, local governed fallback.
 * - Source cut / radar retrieval / Workbench synchronization are separate clocks.
 * - aml_sync_state is the authoritative Workbench sync clock after the first successful automated cycle.
 * - During database recovery, a bounded circuit breaker prevents repeated Supabase reads.
 */
const V0207='0.20.8';
const V0207_UAF_REPORT_REMOTE='/Radar_UAF/data/reportability_sector_2025.json';
const V0207_UAF_DASH_REMOTE='/Radar_UAF/data/dashboard.json';
const V0207_UAF_REPORT_LOCAL='./data/uaf_reportability_sector_2025.json';
const V0207_UAF_DASH_LOCAL='./data/uaf_dashboard_snapshot.json';
const V0207_SII_MANIFEST='/Radar_SII/data/snapshot_manifest.json';
const V0207_DB_BACKOFF=5*60*1000;
let V0207_FRESHNESS_CACHE=null;
let V0207_FRESHNESS_INFLIGHT=null;
let V0207_FRESHNESS_FAILED_AT=0;
let V0207_FRESHNESS_LAST_ERROR='';

const v0207BaseShell=shell;
const v0207BaseOverview=v019LoadOverview;
const v0207BaseReconciliation=v0205LoadReconciliation;

function v0207StopPreviousVersionObserver(){
  try{
    if(typeof V0206_VERSION_OBSERVER!=='undefined'&&V0206_VERSION_OBSERVER){
      V0206_VERSION_OBSERVER.disconnect();
      V0206_VERSION_OBSERVER=null;
    }
  }catch{}
}
function v0207ApplyVersion(){
  v0207StopPreviousVersionObserver();
  const el=document.querySelector('.v019-brand small');
  if(el)el.textContent=`Operational Radar · v${V0207}`;
}
shell=function(title,subtitle){v0207BaseShell(title,subtitle);v0207ApplyVersion();};

async function v0207FetchJson(primary,fallback=null){
  const stamp=`_=${Date.now()}`;const urls=[primary,fallback].filter(Boolean);let last=null;
  for(const url of urls){
    try{const res=await fetch(`${url}${url.includes('?')?'&':'?'}${stamp}`,{cache:'no-store'});if(!res.ok){last=new Error(`${url}: HTTP ${res.status}`);continue;}return {data:await res.json(),url};}
    catch(e){last=e;}
  }
  throw last||new Error('Fuente JSON no disponible.');
}

v0193LoadUafData=async function(force=false){
  if(V0193_UAF_CACHE&&!force)return V0193_UAF_CACHE;
  const [reportLoad,dashLoad,rulesRes]=await Promise.all([
    v0207FetchJson(V0207_UAF_REPORT_REMOTE,V0207_UAF_REPORT_LOCAL),
    v0207FetchJson(V0207_UAF_DASH_REMOTE,V0207_UAF_DASH_LOCAL),
    sb.from('aml_reporting_rules').select('sector_name,sector_group,ros_required,ros_trigger,roe_required,roe_frequency,roe_threshold_usd,roe_deadline,legal_basis,as_of_date,notes')
  ]);
  if(rulesRes.error)throw rulesRes.error;
  const report=reportLoad.data,dashboard=dashLoad.data,sectors=v019Array(report.sectors).map(r=>({...r}));
  const comparable=sectors.filter(r=>v019Num(r.registered_so_2025)>=10&&!r.silence_5y);
  const q1=v0193Quantile(comparable.map(r=>v019Num(r.ros_per_100_so_2025)),.25);
  const median=v0193Median(comparable.map(r=>v019Num(r.ros_per_100_so_2025)).sort((a,b)=>a-b));
  V0193_UAF_CACHE={report,dashboard,rules:rulesRes.data||[],ruleMap:v0193RuleMap(rulesRes.data||[]),sectors,q1,median,
    asset_scope:reportLoad.url===V0207_UAF_REPORT_REMOTE?'RADAR_UAF_LIVE_WITH_LOCAL_FALLBACK':'LOCAL_FALLBACK',
    dashboard_scope:dashLoad.url===V0207_UAF_DASH_REMOTE?'RADAR_UAF_LIVE':'LOCAL_FALLBACK'};
  return V0193_UAF_CACHE;
};

function v0207Date(value,withTime=false){
  if(!value)return '—';const d=new Date(value);if(Number.isNaN(d.getTime()))return String(value);
  return new Intl.DateTimeFormat('es-CL',{day:'2-digit',month:'short',year:'numeric',...(withTime?{hour:'2-digit',minute:'2-digit'}:{})}).format(d);
}
function v0207CutDate(value){
  if(!value)return '—';const d=new Date(`${String(value).slice(0,10)}T12:00:00Z`);
  return Number.isNaN(d.getTime())?String(value):new Intl.DateTimeFormat('es-CL',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(d);
}
function v0207MaxIso(rows,key){const vals=v019Array(rows).map(x=>x?.[key]).filter(Boolean).map(String).sort();return vals.length?vals[vals.length-1]:null;}
function v0207Status(sourceTime,materializedTime){
  if(!sourceTime||!materializedTime)return {label:'Pendiente de sello explícito',cls:'info'};
  const s=new Date(sourceTime).getTime(),m=new Date(materializedTime).getTime();
  if(!Number.isFinite(s)||!Number.isFinite(m))return {label:'Corte informado',cls:'info'};
  return s>m+5*60*1000?{label:'Fuente más nueva que Workbench',cls:'pending'}:{label:'Sincronizado',cls:'ok'};
}
function v0207RecoveryState(error=''){
  const elapsed=V0207_FRESHNESS_FAILED_AT?Math.max(0,Date.now()-V0207_FRESHNESS_FAILED_AT):0;
  const retryAfter=Math.max(0,V0207_DB_BACKOFF-elapsed);
  const message=String(error||V0207_FRESHNESS_LAST_ERROR||'Supabase temporalmente no disponible');
  window.__ATLAS_FRESHNESS_RECOVERY__={
    active:true,failedAt:V0207_FRESHNESS_FAILED_AT||null,lastError:message,
    backoffMs:V0207_DB_BACKOFF,retryAfterMs:retryAfter,checkedAt:new Date().toISOString()
  };
  if(V0207_FRESHNESS_CACHE){
    return {...V0207_FRESHNESS_CACHE,__stale:true,__unavailable:true,__error:message,__retryAfterMs:retryAfter};
  }
  const waiting={label:'Backend en recuperación',cls:'info'};
  return {
    uafCut:null,uafRadarGenerated:null,uafScope:'RECOVERY_BACKOFF',
    siiRetrieved:null,siiLatestYear:null,fusionMaterialized:null,siiMaterialized:null,
    explicitSync:false,syncStatus:'RECOVERY_BACKOFF',snapshotId:null,fusionRunId:null,siiSourceRunId:null,
    uafStatus:waiting,siiStatus:waiting,__unavailable:true,__error:message,__retryAfterMs:retryAfter
  };
}

async function v0207LoadFreshness(force=false){
  if(V0207_FRESHNESS_CACHE&&!force)return V0207_FRESHNESS_CACHE;
  if(V0207_FRESHNESS_FAILED_AT&&(Date.now()-V0207_FRESHNESS_FAILED_AT)<V0207_DB_BACKOFF){
    return v0207RecoveryState();
  }
  if(V0207_FRESHNESS_INFLIGHT)return V0207_FRESHNESS_INFLIGHT;
  V0207_FRESHNESS_INFLIGHT=(async()=>{
    try{
      const [uaf,siiManifest,syncRes,fallbackFusionRes,fallbackSiiRes]=await Promise.all([
        v0193LoadUafData(force),
        v0207FetchJson(V0207_SII_MANIFEST).catch(()=>({data:[],url:null})),
        sb.from('aml_sync_state').select('*').eq('pipeline','AML_MAIN').maybeSingle(),
        sb.from(V0205_VIEW).select('entity_updated_at').not('entity_updated_at','is',null).order('entity_updated_at',{ascending:false}).limit(1),
        sb.from(V0205_VIEW).select('sii_updated_at,sii_latest_commercial_year').not('sii_updated_at','is',null).order('sii_updated_at',{ascending:false}).limit(1)
      ]);
      if(syncRes.error)throw syncRes.error;if(fallbackFusionRes.error)throw fallbackFusionRes.error;if(fallbackSiiRes.error)throw fallbackSiiRes.error;
      const sync=syncRes.data||null,manifestRows=v019Array(siiManifest.data),siiRetrieved=v0207MaxIso(manifestRows,'downloaded_at');
      const fusionMaterialized=sync?.fusion_synced_at||fallbackFusionRes.data?.[0]?.entity_updated_at||null;
      const siiMaterialized=sync?.sii_synced_at||fallbackSiiRes.data?.[0]?.sii_updated_at||null;
      const dash=uaf.dashboard||{},k=dash.kpis||{},uafRadarGenerated=dash.generated_at||null,uafCut=k.registered_total_as_of||k.registered_private_as_of||null;
      V0207_FRESHNESS_CACHE={
        uafCut,uafRadarGenerated,uafScope:uaf.dashboard_scope||uaf.asset_scope,
        siiRetrieved,siiLatestYear:fallbackSiiRes.data?.[0]?.sii_latest_commercial_year||null,
        fusionMaterialized,siiMaterialized,
        explicitSync:!!sync,syncStatus:sync?.status||null,snapshotId:sync?.snapshot_id||null,fusionRunId:sync?.fusion_run_id||null,siiSourceRunId:sync?.sii_source_run_id||null,
        uafStatus:v0207Status(uafRadarGenerated,fusionMaterialized),siiStatus:v0207Status(siiRetrieved,siiMaterialized)
      };
      V0207_FRESHNESS_FAILED_AT=0;V0207_FRESHNESS_LAST_ERROR='';
      window.__ATLAS_FRESHNESS_RECOVERY__={active:false,backoffMs:V0207_DB_BACKOFF,checkedAt:new Date().toISOString()};
      return V0207_FRESHNESS_CACHE;
    }catch(error){
      V0207_FRESHNESS_FAILED_AT=Date.now();
      V0207_FRESHNESS_LAST_ERROR=String(error?.message||error||'Supabase temporalmente no disponible');
      return v0207RecoveryState(V0207_FRESHNESS_LAST_ERROR);
    }finally{
      V0207_FRESHNESS_INFLIGHT=null;
    }
  })();
  return V0207_FRESHNESS_INFLIGHT;
}

function v0207FreshnessHtml(f,compact=false){
  const recovery=!!f.__unavailable;
  const overall=recovery?'pending':((f.uafStatus.cls==='pending'||f.siiStatus.cls==='pending')?'pending':'ok');
  const syncSub=recovery?'Sin nuevas consultas hasta terminar la ventana de backoff':(f.explicitSync?`Run Fusion ${f.fusionRunId||'—'}${f.snapshotId?` · ${v019Truncate(f.snapshotId,24)}`:''}`:'Fallback temporal hasta primer ciclo automatizado');
  const title=recovery?'Backend en recuperación; se preserva la última lectura disponible':(overall==='ok'?'Fuentes y conciliación sincronizadas':'Hay una fuente más nueva que la materialización');
  return `<section class="v0207-freshness ${compact?'compact':''}">
    <div class="v0207-fresh-head"><div><span>VIGENCIA DE LOS DATOS</span><h3>${esc(title)}</h3></div><span class="v0207-fresh-state ${overall}">${recovery?'En pausa':(overall==='ok'?'Actualizado':'Actualizando')}</span></div>
    <div class="v0207-fresh-grid">
      <div><div><span>UAF</span><em class="${esc(f.uafStatus.cls)}">${esc(f.uafStatus.label)}</em></div><b>Corte oficial ${esc(v0207CutDate(f.uafCut))}</b><small>Radar consultado ${esc(v0207Date(f.uafRadarGenerated,true))}</small></div>
      <div><div><span>SII</span><em class="${esc(f.siiStatus.cls)}">${esc(f.siiStatus.label)}</em></div><b>Radar descargado ${esc(v0207Date(f.siiRetrieved,true))}</b><small>Historia empresarial hasta ${esc(String(f.siiLatestYear||'—'))}${f.siiSourceRunId?` · bundle ${esc(f.siiSourceRunId)}`:''}</small></div>
      <div><div><span>Conciliación</span><em class="info">${recovery?'Circuit breaker':(f.explicitSync?'Sello explícito':'Fallback')}</em></div><b>Fusion ${esc(v0207Date(f.fusionMaterialized,true))}</b><small>Perfil SII ${esc(v0207Date(f.siiMaterialized,true))} · ${esc(syncSub)}</small></div>
    </div>
    <p>${recovery?'ATLAS suspendió temporalmente nuevas lecturas de vigencia para no añadir presión mientras PostgreSQL se recupera.':'La fecha de corte oficial puede ser anterior al barrido del radar. Si una fuente aparece más nueva, la conciliación se mantiene identificada como pendiente hasta que el snapshot validado y el enriquecimiento SII terminen de materializarse en Supabase.'}</p>
  </section>`;
}

v019LoadOverview=async function(){
  await v0207BaseOverview();v0207ApplyVersion();const top=document.querySelector('.v0203-topline');
  if(top&&!document.querySelector('.v0207-freshness')){try{const f=await v0207LoadFreshness();top.insertAdjacentHTML('afterend',v0207FreshnessHtml(f,true));}catch{}}
};
loadOverview=v019LoadOverview;

v0205LoadReconciliation=async function(filter='review',initialSearch=''){
  await v0207BaseReconciliation(filter,initialSearch);v0207ApplyVersion();const command=document.querySelector('.v0205-command');
  if(command&&!document.querySelector('.v0207-freshness')){try{const f=await v0207LoadFreshness();command.insertAdjacentHTML('afterend',v0207FreshnessHtml(f,false));}catch(e){command.insertAdjacentHTML('afterend','<div class="v0207-fresh-error">No fue posible leer vigencia de fuentes.</div>');}}
};

window.__AML_BUILD__=V0207;
window.__AML_UAF_ASSET_SCOPE__='radar-uaf-pages-with-local-fallback';
setTimeout(v0207ApplyVersion,0);
