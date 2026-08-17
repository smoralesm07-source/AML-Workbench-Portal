'use strict';

/* AML Workbench v0.20.6 · deployment stability
 * - Serves UAF reportability assets from the same GitHub Pages origin.
 * - Neutralizes the legacy v0.19.2 version badge timer without adding another polling loop.
 * - Exposes the active build for lightweight runtime diagnostics.
 */
const V0206='0.20.6';
const V0206_REPORT_URL='./data/uaf_reportability_sector_2025.json?build=0206';
const V0206_DASH_URL='./data/uaf_dashboard_snapshot.json?build=0206';
let V0206_VERSION_OBSERVER=null;
const v0206BaseShell=shell;

function v0206ApplyVersion(){
  const el=document.querySelector('.v019-brand small');
  if(!el)return null;
  const wanted=`Operational Radar · v${V0206}`;
  if(el.textContent!==wanted)el.textContent=wanted;
  return el;
}

function v0206WatchVersion(){
  const el=v0206ApplyVersion();
  if(!el||V0206_VERSION_OBSERVER)return;
  V0206_VERSION_OBSERVER=new MutationObserver(()=>{
    const wanted=`Operational Radar · v${V0206}`;
    if(el.textContent!==wanted)el.textContent=wanted;
  });
  V0206_VERSION_OBSERVER.observe(el,{childList:true,characterData:true,subtree:true});
}

shell=function(title,subtitle){
  v0206BaseShell(title,subtitle);
  v0206WatchVersion();
};

/* Replace the remote raw.githubusercontent loader with same-origin governed snapshots. */
v0193LoadUafData=async function(force=false){
  if(V0193_UAF_CACHE&&!force)return V0193_UAF_CACHE;
  const [reportRes,dashRes,rulesRes]=await Promise.all([
    fetch(V0206_REPORT_URL,{cache:'no-store'}),
    fetch(V0206_DASH_URL,{cache:'no-store'}),
    sb.from('aml_reporting_rules').select('sector_name,sector_group,ros_required,ros_trigger,roe_required,roe_frequency,roe_threshold_usd,roe_deadline,legal_basis,as_of_date,notes')
  ]);
  if(!reportRes.ok)throw new Error(`No fue posible cargar la matriz sectorial UAF local (${reportRes.status}).`);
  if(rulesRes.error)throw rulesRes.error;
  const report=await reportRes.json();
  let dashboard=null;
  try{if(dashRes.ok)dashboard=await dashRes.json();}catch{}
  const sectors=v019Array(report.sectors).map(r=>({...r}));
  const comparable=sectors.filter(r=>v019Num(r.registered_so_2025)>=10&&!r.silence_5y);
  const q1=v0193Quantile(comparable.map(r=>v019Num(r.ros_per_100_so_2025)),.25);
  const median=v0193Median(comparable.map(r=>v019Num(r.ros_per_100_so_2025)).sort((a,b)=>a-b));
  V0193_UAF_CACHE={report,dashboard,rules:rulesRes.data||[],ruleMap:v0193RuleMap(rulesRes.data||[]),sectors,q1,median,asset_scope:'SAME_ORIGIN_V0206'};
  return V0193_UAF_CACHE;
};

window.__AML_BUILD__=V0206;
window.__AML_UAF_ASSET_SCOPE__='same-origin';
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(v0206WatchVersion,0));
else setTimeout(v0206WatchVersion,0);
