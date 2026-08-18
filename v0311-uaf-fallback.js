'use strict';

/* v0.31.1 · UAF availability hardening.
 * Remote Radar_UAF is preferred, but governed local assets keep the app operational.
 */
const V0311_UAF_REPORT_LOCAL='./data/uaf_reportability_sector_2025.json';
const V0311_UAF_DASH_LOCAL='./data/uaf_dashboard_snapshot.json';

async function v0311JsonWithFallback(primary,fallback,timeoutMs=900){
  const load=async url=>{const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(`${url}: HTTP ${r.status}`);return r.json();};
  const remote=await v0302Timeout(load(primary).then(data=>({data,scope:'REMOTE'})).catch(()=>null),timeoutMs,null);
  if(remote)return remote;
  try{return {data:await load(fallback),scope:'LOCAL_FALLBACK'};}catch(error){return {data:null,scope:'UNAVAILABLE',error};}
}

v0193LoadUafData=async function(force=false){
  if(V0193_UAF_CACHE&&!force)return V0193_UAF_CACHE;
  const [reportLoad,dashLoad,rulesRes]=await Promise.all([
    v0311JsonWithFallback(V0193_REPORT_URL,V0311_UAF_REPORT_LOCAL),
    v0311JsonWithFallback(V0193_DASH_URL,V0311_UAF_DASH_LOCAL),
    sb.from('aml_reporting_rules').select('sector_name,sector_group,ros_required,ros_trigger,roe_required,roe_frequency,roe_threshold_usd,roe_deadline,legal_basis,as_of_date,notes')
  ]);
  const status={reportability:!!reportLoad.data,dashboard:!!dashLoad.data,rules:!rulesRes.error};
  if(typeof V0222_STATUS!=='undefined')V0222_STATUS.uaf=status;
  const report=reportLoad.data||{sectors:[],totals:{}};
  const dashboard=dashLoad.data||{kpis:{}};
  const rules=rulesRes.error?[]:(rulesRes.data||[]);
  const sectors=v019Array(report.sectors).map(r=>({...r}));
  const comparable=sectors.filter(r=>v019Num(r.registered_so_2025)>=10&&!r.silence_5y);
  const q1=v0193Quantile(comparable.map(r=>v019Num(r.ros_per_100_so_2025)),.25);
  const median=v0193Median(comparable.map(r=>v019Num(r.ros_per_100_so_2025)).sort((a,b)=>a-b));
  V0193_UAF_CACHE={report,dashboard,rules,ruleMap:v0193RuleMap(rules),sectors,q1,median,sourceStatus:status,
    asset_scope:reportLoad.scope,dashboard_scope:dashLoad.scope,
    availability_note:(reportLoad.scope==='LOCAL_FALLBACK'||dashLoad.scope==='LOCAL_FALLBACK')?'Radar_UAF remoto lento; se utilizó snapshot local gobernado.':null};
  return V0193_UAF_CACHE;
};
