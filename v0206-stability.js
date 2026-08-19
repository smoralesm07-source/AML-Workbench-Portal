'use strict';

/* AML Workbench v0.20.6 · deployment stability compatibility layer.
 * ATLAS current release owns version/build and visible identity. This layer keeps
 * only the same-origin UAF data loader; all historical version mutation watchers
 * are permanently neutralized to avoid bootstrap/UI mutation loops.
 */
const V0206='0.20.6';
const V0206_REPORT_URL='./data/uaf_reportability_sector_2025.json?build=0206';
const V0206_DASH_URL='./data/uaf_dashboard_snapshot.json?build=0206';
let V0206_VERSION_OBSERVER=null;
const v0206BaseShell=shell;

function v0206ApplyVersion(){
  return document.querySelector('.v019-brand small')||null;
}
function v0206WatchVersion(){
  if(V0206_VERSION_OBSERVER){
    try{V0206_VERSION_OBSERVER.disconnect();}catch{}
    V0206_VERSION_OBSERVER=null;
  }
  return v0206ApplyVersion();
}

shell=function(title,subtitle){
  v0206BaseShell(title,subtitle);
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

window.__AML_UAF_ASSET_SCOPE__='same-origin';
window.__ATLAS_LEGACY_VERSION_WATCHERS_DISABLED__=true;
