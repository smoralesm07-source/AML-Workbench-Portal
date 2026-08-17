'use strict';

/* AML Workbench v0.22.2 · Radar integrado timeout hardening */
const V0222='0.22.2';
const V0222_STATUS={core:{},analytics:{},uaf:{}};

function v0222Warn(scope,label,error){console.warn(`v${V0222} ${scope} source unavailable: ${label}`,error||'unknown error');}
function v0222Rows(result,label,scope,status){
  if(result?.status==='fulfilled'&&!result.value?.error){status[label]=true;return result.value?.data||[];}
  status[label]=false;v0222Warn(scope,label,result?.status==='rejected'?result.reason:result?.value?.error);return [];
}
function v0222Value(result,label,scope,status,fallback=null){
  if(result?.status==='fulfilled'){status[label]=true;return result.value;}
  status[label]=false;v0222Warn(scope,label,result?.reason);return fallback;
}

v019LoadCore=async function(force=false){
  if(v019Cache.core&&!force)return v019Cache.core;
  const specs=[
    ['findings',()=>sb.from('aml_findings').select('finding_key,finding_type,entity_id,title,region,commune,score_explore,score_supervise,score_investigate,source_count,evidence_count,payload').order('score_investigate',{ascending:false,nullsFirst:false}).limit(50)],
    ['regions',()=>sb.from('aml_v019_region_priority').select('*').order('attention_index',{ascending:false,nullsFirst:false})],
    ['gaps',()=>sb.from('aml_v019_gap_region').select('*').order('gap_attention_index',{ascending:false,nullsFirst:false})],
    ['gapSectors',()=>sb.from('aml_v019_gap_sector').select('*').order('candidate_pairs',{ascending:false})],
    ['uafRegions',()=>sb.from('aml_v019_uaf_region').select('*').order('uaf_observed',{ascending:false})],
    ['uafCross',()=>sb.from('aml_v019_uaf_cross_radar').select('*').order('uaf_entities',{ascending:false})],
    ['patterns',()=>sb.from('aml_pattern_alerts').select('alert_id,family,pattern_type,scope_type,scope_id,scope_label,strength,priority,title,summary,payload').order('strength',{ascending:false,nullsFirst:false}).limit(100)]
  ];
  const [db,pressSet,econSet]=await Promise.all([
    Promise.allSettled(specs.map(([,run])=>run())),
    Promise.allSettled([v019FetchPress()]),
    Promise.allSettled([typeof v0191FetchEconomy==='function'?v0191FetchEconomy():Promise.resolve({error:'Context Hub loader unavailable'})])
  ]);
  const status={},data={};
  specs.forEach(([key],i)=>{data[key]=v0222Rows(db[i],key,'core',status);});
  const press=v0222Value(pressSet[0],'press','core',status,{error:'Radar Prensa no disponible',phenomena:[]});
  const economy=v0222Value(econSet[0],'economy','core',status,{error:'Context Hub económico no disponible'});
  if(press?.error)status.press=false;if(economy?.error)status.economy=false;
  V0222_STATUS.core=status;
  v019Cache.core={...data,press,economy,sourceStatus:status};
  return v019Cache.core;
};

v020LoadAnalytics=async function(force=false){
  if(V020_CACHE&&!force)return V020_CACHE;
  const specs=[
    ['mix',()=>sb.from('aml_v020_finding_mix').select('*').order('finding_count',{ascending:false})],
    ['bands',()=>sb.from('aml_v020_score_band').select('*')],
    ['families',()=>sb.from('aml_v020_pattern_family').select('*').order('max_strength',{ascending:false})],
    ['sanYears',()=>sb.from('aml_v020_sanction_year').select('*').order('year',{ascending:true})],
    ['producers',()=>sb.from('aml_v020_producer_findings').select('*').order('finding_count',{ascending:false})]
  ];
  const [db,budgetSet]=await Promise.all([Promise.allSettled(specs.map(([,run])=>run())),Promise.allSettled([v020FetchBudget()])]);
  const status={},data={};
  specs.forEach(([key],i)=>{data[key]=v0222Rows(db[i],key,'analytics',status);});
  const budget=v0222Value(budgetSet[0],'budget','analytics',status,{error:'Preview de Presupuesto no disponible',metrics:{},priority_tiers:{},top_signals:[]});
  if(budget?.error)status.budget=false;
  V0222_STATUS.analytics=status;V020_CACHE={...data,budget,sourceStatus:status};return V020_CACHE;
};

v0193LoadUafData=async function(force=false){
  if(V0193_UAF_CACHE&&!force)return V0193_UAF_CACHE;
  const [reportRes,dashRes,rulesRes]=await Promise.allSettled([
    fetch(V0193_REPORT_URL,{cache:'no-store'}).then(async r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json();}),
    fetch(V0193_DASH_URL,{cache:'no-store'}).then(async r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json();}),
    sb.from('aml_reporting_rules').select('sector_name,sector_group,ros_required,ros_trigger,roe_required,roe_frequency,roe_threshold_usd,roe_deadline,legal_basis,as_of_date,notes')
  ]);
  const status={};
  const report=v0222Value(reportRes,'reportability','uaf',status,{sectors:[],totals:{}})||{sectors:[],totals:{}};
  const dashboard=v0222Value(dashRes,'dashboard','uaf',status,null);
  let rules=[];
  if(rulesRes.status==='fulfilled'&&!rulesRes.value?.error){status.rules=true;rules=rulesRes.value?.data||[];}
  else{status.rules=false;v0222Warn('uaf','rules',rulesRes.status==='rejected'?rulesRes.reason:rulesRes.value?.error);}
  const sectors=v019Array(report.sectors).map(r=>({...r}));
  const comparable=sectors.filter(r=>v019Num(r.registered_so_2025)>=10&&!r.silence_5y);
  const q1=v0193Quantile(comparable.map(r=>v019Num(r.ros_per_100_so_2025)),.25);
  const median=v0193Median(comparable.map(r=>v019Num(r.ros_per_100_so_2025)).sort((a,b)=>a-b));
  V0222_STATUS.uaf=status;V0193_UAF_CACHE={report,dashboard,rules,ruleMap:v0193RuleMap(rules),sectors,q1,median,sourceStatus:status};return V0193_UAF_CACHE;
};

function v0222Unavailable(){
  const labels={findings:'Hallazgos',regions:'Prioridad regional',gaps:'Brecha regional',gapSectors:'Brecha sectorial',uafRegions:'UAF regional',uafCross:'Cruce UAF-radares',patterns:'Patrones',press:'Prensa',economy:'Context Hub',mix:'Composición',bands:'Bandas IPA',families:'Familias de patrones',sanYears:'Serie de sanciones',producers:'Productores',budget:'Presupuesto',reportability:'Reportabilidad UAF',dashboard:'Dashboard UAF',rules:'Reglas UAF'};
  const out=[];for(const group of Object.values(V0222_STATUS))for(const [key,ok] of Object.entries(group))if(ok===false&&!out.includes(labels[key]||key))out.push(labels[key]||key);return out;
}
const v0222BaseOverview=v019LoadOverview;
v019LoadOverview=async function(){
  await v0222BaseOverview();const unavailable=v0222Unavailable(),content=v019Content();
  if(!content||!unavailable.length||content.querySelector('.v019-error'))return;
  const note=document.createElement('div');note.className='v019-note warn';note.textContent=`Carga parcial: ${unavailable.join(', ')} no disponible(s) en este corte. La portada mantiene las fuentes restantes; ausencia de dato no se interpreta como cero.`;content.prepend(note);
};
loadOverview=v019LoadOverview;

const v0222BaseShell=shell;
shell=function(title,subtitle){v0222BaseShell(title,subtitle);const label=`Operational Radar · v${V0222}`;const badge=document.querySelector('.v019-brand small');if(badge){badge.textContent=label;badge.setAttribute('aria-label',label);}document.title=`AML Analytical Workbench · v${V0222}`;};
if(typeof v0211ApplyVersion==='function')v0211ApplyVersion=function(){const label=`Operational Radar · v${V0222}`;const badge=document.querySelector('.v019-brand small');if(badge){badge.textContent=label;badge.setAttribute('aria-label',label);}document.title=`AML Analytical Workbench · v${V0222}`;};
window.__AML_ACTIVE_VERSION__=V0222;window.__AML_BUILD__=V0222;
