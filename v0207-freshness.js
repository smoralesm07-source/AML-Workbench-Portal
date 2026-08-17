'use strict';

/* AML Workbench v0.20.7 · freshness + automated source visibility
 * - UAF assets: Radar_UAF Pages first, local governed fallback.
 * - Freshness stamps distinguish official source cut, radar retrieval and Workbench materialization.
 * - Reconciliation stays live because it reads the Supabase security-invoker view.
 */
const V0207='0.20.7';
const V0207_UAF_REPORT_REMOTE='/Radar_UAF/data/reportability_sector_2025.json';
const V0207_UAF_DASH_REMOTE='/Radar_UAF/data/dashboard.json';
const V0207_UAF_REPORT_LOCAL='./data/uaf_reportability_sector_2025.json';
const V0207_UAF_DASH_LOCAL='./data/uaf_dashboard_snapshot.json';
const V0207_SII_MANIFEST='/Radar_SII/data/snapshot_manifest.json';
let V0207_FRESHNESS_CACHE=null;

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
shell=function(title,subtitle){
  v0207BaseShell(title,subtitle);
  v0207ApplyVersion();
};

async function v0207FetchJson(primary,fallback=null){
  const stamp=`_=${Date.now()}`;
  const urls=[primary,fallback].filter(Boolean);
  let last=null;
  for(const url of urls){
    try{
      const res=await fetch(`${url}${url.includes('?')?'&':'?'}${stamp}`,{cache:'no-store'});
      if(!res.ok){last=new Error(`${url}: HTTP ${res.status}`);continue;}
      return {data:await res.json(),url};
    }catch(e){last=e;}
  }
  throw last||new Error('Fuente JSON no disponible.');
}

/* Remote-first UAF loader. Same-host GitHub Pages avoids the raw.githubusercontent dependency,
 * while the local copies preserve availability if Radar_UAF Pages is temporarily unavailable. */
v0193LoadUafData=async function(force=false){
  if(V0193_UAF_CACHE&&!force)return V0193_UAF_CACHE;
  const [reportLoad,dashLoad,rulesRes]=await Promise.all([
    v0207FetchJson(V0207_UAF_REPORT_REMOTE,V0207_UAF_REPORT_LOCAL),
    v0207FetchJson(V0207_UAF_DASH_REMOTE,V0207_UAF_DASH_LOCAL),
    sb.from('aml_reporting_rules').select('sector_name,sector_group,ros_required,ros_trigger,roe_required,roe_frequency,roe_threshold_usd,roe_deadline,legal_basis,as_of_date,notes')
  ]);
  if(rulesRes.error)throw rulesRes.error;
  const report=reportLoad.data,dashboard=dashLoad.data;
  const sectors=v019Array(report.sectors).map(r=>({...r}));
  const comparable=sectors.filter(r=>v019Num(r.registered_so_2025)>=10&&!r.silence_5y);
  const q1=v0193Quantile(comparable.map(r=>v019Num(r.ros_per_100_so_2025)),.25);
  const median=v0193Median(comparable.map(r=>v019Num(r.ros_per_100_so_2025)).sort((a,b)=>a-b));
  V0193_UAF_CACHE={
    report,dashboard,rules:rulesRes.data||[],ruleMap:v0193RuleMap(rulesRes.data||[]),sectors,q1,median,
    asset_scope:reportLoad.url===V0207_UAF_REPORT_REMOTE?'RADAR_UAF_LIVE_WITH_LOCAL_FALLBACK':'LOCAL_FALLBACK',
    dashboard_scope:dashLoad.url===V0207_UAF_DASH_REMOTE?'RADAR_UAF_LIVE':'LOCAL_FALLBACK'
  };
  return V0193_UAF_CACHE;
};

function v0207Date(value,withTime=false){
  if(!value)return '—';
  const d=new Date(value);if(Number.isNaN(d.getTime()))return String(value);
  return new Intl.DateTimeFormat('es-CL',{day:'2-digit',month:'short',year:'numeric',...(withTime?{hour:'2-digit',minute:'2-digit'}:{})}).format(d);
}
function v0207CutDate(value){
  if(!value)return '—';
  const d=new Date(`${String(value).slice(0,10)}T12:00:00Z`);
  return Number.isNaN(d.getTime())?String(value):new Intl.DateTimeFormat('es-CL',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(d);
}
function v0207MaxIso(rows,key){
  const vals=v019Array(rows).map(x=>x?.[key]).filter(Boolean).map(String).sort();
  return vals.length?vals[vals.length-1]:null;
}
function v0207Status(sourceTime,materializedTime){
  if(!sourceTime||!materializedTime)return {label:'Corte informado',cls:'info'};
  const s=new Date(sourceTime).getTime(),m=new Date(materializedTime).getTime();
  if(!Number.isFinite(s)||!Number.isFinite(m))return {label:'Corte informado',cls:'info'};
  return s>m+5*60*1000?{label:'Fuente más nueva que Workbench',cls:'pending'}:{label:'Sincronizado',cls:'ok'};
}

async function v0207LoadFreshness(force=false){
  if(V0207_FRESHNESS_CACHE&&!force)return V0207_FRESHNESS_CACHE;
  const uafPromise=v0193LoadUafData(force);
  const siiManifestPromise=v0207FetchJson(V0207_SII_MANIFEST).catch(()=>({data:[],url:null}));
  const fusionPromise=sb.from(V0205_VIEW).select('entity_updated_at').not('entity_updated_at','is',null).order('entity_updated_at',{ascending:false}).limit(1);
  const siiMaterializedPromise=sb.from(V0205_VIEW).select('sii_updated_at,sii_latest_commercial_year').not('sii_updated_at','is',null).order('sii_updated_at',{ascending:false}).limit(1);
  const [uaf,siiManifest,fusionRes,siiRes]=await Promise.all([uafPromise,siiManifestPromise,fusionPromise,siiMaterializedPromise]);
  if(fusionRes.error)throw fusionRes.error;
  if(siiRes.error)throw siiRes.error;
  const manifestRows=v019Array(siiManifest.data);
  const siiRetrieved=v0207MaxIso(manifestRows,'downloaded_at');
  const fusionMaterialized=fusionRes.data?.[0]?.entity_updated_at||null;
  const siiMaterialized=siiRes.data?.[0]?.sii_updated_at||null;
  const dash=uaf.dashboard||{},k=dash.kpis||{};
  const uafRadarGenerated=dash.generated_at||null;
  const uafCut=k.registered_total_as_of||k.registered_private_as_of||null;
  V0207_FRESHNESS_CACHE={
    uafCut,uafRadarGenerated,uafScope:uaf.dashboard_scope||uaf.asset_scope,
    siiRetrieved,siiLatestYear:siiRes.data?.[0]?.sii_latest_commercial_year||null,
    fusionMaterialized,siiMaterialized,
    uafStatus:v0207Status(uafRadarGenerated,fusionMaterialized),
    siiStatus:v0207Status(siiRetrieved,siiMaterialized)
  };
  return V0207_FRESHNESS_CACHE;
}

function v0207FreshnessHtml(f,compact=false){
  const overall=(f.uafStatus.cls==='pending'||f.siiStatus.cls==='pending')?'pending':'ok';
  return `<section class="v0207-freshness ${compact?'compact':''}">
    <div class="v0207-fresh-head"><div><span>VIGENCIA DE LOS DATOS</span><h3>${overall==='ok'?'Fuentes y conciliación sincronizadas':'Hay una fuente más nueva que la materialización'}</h3></div><span class="v0207-fresh-state ${overall}">${overall==='ok'?'Actualizado':'Actualizando'}</span></div>
    <div class="v0207-fresh-grid">
      <div><div><span>UAF</span><em class="${esc(f.uafStatus.cls)}">${esc(f.uafStatus.label)}</em></div><b>Corte oficial ${esc(v0207CutDate(f.uafCut))}</b><small>Radar consultado ${esc(v0207Date(f.uafRadarGenerated,true))}</small></div>
      <div><div><span>SII</span><em class="${esc(f.siiStatus.cls)}">${esc(f.siiStatus.label)}</em></div><b>Radar descargado ${esc(v0207Date(f.siiRetrieved,true))}</b><small>Historia empresarial hasta ${esc(String(f.siiLatestYear||'—'))}</small></div>
      <div><div><span>Conciliación</span><em class="info">Supabase</em></div><b>Fusion ${esc(v0207Date(f.fusionMaterialized,true))}</b><small>Perfil SII materializado ${esc(v0207Date(f.siiMaterialized,true))}</small></div>
    </div>
    <p>La fecha de corte oficial puede ser anterior al barrido del radar. La conciliación cambia cuando el nuevo snapshot Fusion y el enriquecimiento SII terminan de materializarse en Supabase.</p>
  </section>`;
}

async function v0207InjectFreshness(target,position='afterbegin',compact=false){
  try{
    const f=await v0207LoadFreshness();
    const host=document.querySelector(target);if(host)host.insertAdjacentHTML(position,v0207FreshnessHtml(f,compact));
  }catch(e){
    const host=document.querySelector(target);
    if(host)host.insertAdjacentHTML(position,`<div class="v0207-fresh-error">No fue posible leer los sellos de actualización: ${esc(e?.message||String(e))}</div>`);
  }
}

v019LoadOverview=async function(){
  await v0207BaseOverview();
  v0207ApplyVersion();
  const top=document.querySelector('.v0203-topline');
  if(top&&!document.querySelector('.v0207-freshness')){
    try{const f=await v0207LoadFreshness();top.insertAdjacentHTML('afterend',v0207FreshnessHtml(f,true));}catch{}
  }
};
loadOverview=v019LoadOverview;

v0205LoadReconciliation=async function(filter='review',initialSearch=''){
  await v0207BaseReconciliation(filter,initialSearch);
  v0207ApplyVersion();
  const command=document.querySelector('.v0205-command');
  if(command&&!document.querySelector('.v0207-freshness')){
    try{const f=await v0207LoadFreshness();command.insertAdjacentHTML('afterend',v0207FreshnessHtml(f,false));}catch(e){command.insertAdjacentHTML('afterend',`<div class="v0207-fresh-error">No fue posible leer vigencia de fuentes.</div>`);}
  }
};

window.__AML_BUILD__=V0207;
window.__AML_UAF_ASSET_SCOPE__='radar-uaf-pages-with-local-fallback';
setTimeout(v0207ApplyVersion,0);
