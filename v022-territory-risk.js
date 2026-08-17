'use strict';

/* AML Workbench · Geographic Risk v0.22.0
 * Territorial supervisory-context score. It does not modify canonical entity AML risk.
 * Default model: robust percentile composite with explicit coverage/confidence.
 */
const V022_GEO='0.22.0';
const V022_METHOD_VERSION='GEO-RISK-0.22.0';
const V022_CONTEXT_BASE='https://raw.githubusercontent.com/smoralesm07-source/Context-Hub/main/data/silver/';
const V022_CEAD_URL='https://raw.githubusercontent.com/smoralesm07-source/Radar_delictual/radar-data/data/processed/cead_current_predicate_activity_v4.json';
const V022_BUDGET_URL='https://raw.githubusercontent.com/smoralesm07-source/Rada_Presupuesto_Abierto/main/docs/data/territorial_context_v1.json';
const V022_BUDGET_PREVIEW_URL='https://raw.githubusercontent.com/smoralesm07-source/Rada_Presupuesto_Abierto/main/docs/data/dashboard.json';
const V022_CGR_BASE='https://raw.githubusercontent.com/smoralesm07-source/Radar-CGR/main/data/silver/';
const V022_REGION_CODE={
  'Tarapacá':'01','Antofagasta':'02','Atacama':'03','Coquimbo':'04','Valparaíso':'05',
  "Libertador General Bernardo O'Higgins":'06','Maule':'07','Biobío':'08','La Araucanía':'09',
  'Los Lagos':'10','Aysén del General Carlos Ibáñez del Campo':'11','Magallanes y de la Antártica Chilena':'12',
  'Metropolitana de Santiago':'13','Los Ríos':'14','Arica y Parinacota':'15','Ñuble':'16'
};
const V022_REGION_BY_CODE=Object.fromEntries(Object.entries(V022_REGION_CODE).map(([name,code])=>[code,name]));
const V022_REGION_GEO=typeof V0191_REGION_GEO!=='undefined'?V0191_REGION_GEO:{
  'Arica y Parinacota':[-70.31,-18.48],'Tarapacá':[-70.14,-20.22],'Antofagasta':[-70.4,-23.65],
  'Atacama':[-70.33,-27.37],'Coquimbo':[-71.25,-29.9],'Valparaíso':[-71.62,-33.05],
  'Metropolitana de Santiago':[-70.67,-33.45],"Libertador General Bernardo O'Higgins":[-70.74,-34.17],
  'Maule':[-71.67,-35.43],'Ñuble':[-72.1,-36.61],'Biobío':[-73.05,-36.82],
  'La Araucanía':[-72.59,-38.74],'Los Ríos':[-73.25,-39.81],'Los Lagos':[-72.94,-41.47],
  'Aysén del General Carlos Ibáñez del Campo':[-72.07,-45.57],'Magallanes y de la Antártica Chilena':[-70.91,-53.16]
};
const V022_METHODS={
  A:{id:'A',name:'Ponderado auditable',tag:'baseline',note:'Pesos fijos y lectura directa. Incluye prensa y OSFL con peso bajo como contexto territorial.',regionWeights:{sector:20,cead:25,budget:20,cgr:15,press:5,osfl:5,cross:10},communeWeights:{sector:25,cead:30,budget:25,cgr:10,cross:10}},
  B:{id:'B',name:'Percentil robusto',tag:'recomendado',note:'Normaliza intensidades y tasas entre territorios. Prensa y OSFL se muestran como capas, pero no impulsan el score por sí solas.',regionWeights:{sector:20,cead:30,budget:25,cgr:15,cross:10},communeWeights:{sector:25,cead:35,budget:25,cgr:5,cross:10}},
  C:{id:'C',name:'Acumulación de evidencia',tag:'experimental',note:'Prior territorial + evidencia estructurada en escala logística. No es una probabilidad calibrada de LA/FT.',regionWeights:{},communeWeights:{}}
};
const V022_LAYERS={
  total:{label:'Riesgo total',kind:'risk'},economy:{label:'Capacidad económica',kind:'exposure'},sector:{label:'Sectores 19.913',kind:'risk'},
  cead:{label:'Delictual CEAD',kind:'risk'},budget:{label:'Presupuesto',kind:'risk'},cgr:{label:'CGR',kind:'risk'},
  press:{label:'Prensa regional',kind:'context'},osfl:{label:'OSFL',kind:'exposure'},cross:{label:'Convergencia',kind:'risk'}
};
const V022_STATE={method:'B',layer:'total',selectedRegion:'Metropolitana de Santiago',data:null,computed:null};
const V022_CACHE={raw:null};

function v022TextKey(v){return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9Ñ]+/g,' ').replace(/\s+/g,' ').trim();}
function v022RegionName(v){
  const raw=String(v??'').trim();if(!raw)return null;
  const code=raw.match(/^(?:CL-REG-)?(\d{1,2})$/i)?.[1];if(code)return V022_REGION_BY_CODE[String(code).padStart(2,'0')]||null;
  if(V022_REGION_CODE[raw])return raw;
  const k=v022TextKey(raw);
  const tests=[
    ['ARICA Y PARINACOTA','Arica y Parinacota'],['TARAPACA','Tarapacá'],['ANTOFAGASTA','Antofagasta'],['ATACAMA','Atacama'],['COQUIMBO','Coquimbo'],
    ['VALPARAISO','Valparaíso'],['METROPOLITANA','Metropolitana de Santiago'],['O HIGGINS',"Libertador General Bernardo O'Higgins"],['LIBERTADOR GENERAL BERNARDO','Libertador General Bernardo O\'Higgins'],
    ['ÑUBLE','Ñuble'],['NUBLE','Ñuble'],['BIO BIO','Biobío'],['BIOBIO','Biobío'],['ARAUCANIA','La Araucanía'],['LOS RIOS','Los Ríos'],['LOS LAGOS','Los Lagos'],
    ['AYSEN','Aysén del General Carlos Ibáñez del Campo'],['MAGALLANES','Magallanes y de la Antártica Chilena'],['MAULE','Maule']
  ];
  for(const [needle,name] of tests)if(k.includes(v022TextKey(needle)))return name;
  return null;
}
function v022Clamp(v,a=0,b=100){const n=Number(v);return Number.isFinite(n)?Math.max(a,Math.min(b,n)):null;}
function v022Mean(xs){const a=xs.map(Number).filter(Number.isFinite);return a.length?a.reduce((s,x)=>s+x,0)/a.length:null;}
function v022PercentileMap(rows,key,outKey){
  const valid=rows.map(r=>({r,v:Number(r[key])})).filter(x=>Number.isFinite(x.v)).sort((a,b)=>a.v-b.v);
  if(!valid.length){for(const r of rows)r[outKey]=null;return;}
  const groups=new Map();valid.forEach((x,i)=>{const k=String(x.v);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(i);});
  for(const x of valid){const inds=groups.get(String(x.v));const rank=inds.reduce((s,i)=>s+i,0)/inds.length;x.r[outKey]=valid.length===1?50:100*rank/(valid.length-1);}
}
function v022Weighted(parts,weights){
  let num=0,den=0;for(const [key,w] of Object.entries(weights)){const v=Number(parts[key]);if(Number.isFinite(v)){num+=v*w;den+=w;}}
  return den?num/den:null;
}
function v022Cross(parts){const vals=['sector','cead','budget','cgr'].map(k=>Number(parts[k])).filter(Number.isFinite);const hi=vals.filter(v=>v>=60);return hi.length>=2?v022Mean(hi):0;}
function v022Band(score){const n=Number(score);if(!Number.isFinite(n))return 'Sin score';if(n>=80)return 'Muy alto';if(n>=65)return 'Alto';if(n>=50)return 'Medio';if(n>=30)return 'Moderado';return 'Bajo';}
function v022Tone(score){const n=Number(score);if(!Number.isFinite(n))return 'missing';if(n>=80)return 'veryhigh';if(n>=65)return 'high';if(n>=50)return 'elevated';if(n>=30)return 'guarded';return 'low';}
function v022Color(score){return ({veryhigh:'#8b2f2f',high:'#c6533f',elevated:'#df8a45',guarded:'#e4c78f',low:'#b8cbc4',missing:'#d8dde0'})[v022Tone(score)];}
function v022Fmt(v,d=0){const n=Number(v);return Number.isFinite(n)?n.toLocaleString('es-CL',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';}
function v022Jsonl(text){return String(text||'').split(/\r?\n/).filter(Boolean).map(line=>{try{return JSON.parse(line)}catch{return null}}).filter(Boolean);}
async function v022FetchText(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(`${r.status} ${url}`);return r.text();}
async function v022FetchJson(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(`${r.status} ${url}`);return r.json();}
async function v022FetchAll(table,columns='*',page=1000){const out=[];for(let from=0;;from+=page){const q=await sb.from(table).select(columns).range(from,from+page-1);if(q.error)throw q.error;out.push(...(q.data||[]));if(!q.data||q.data.length<page)break;}return out;}

async function v022LoadRaw(){
  if(V022_CACHE.raw)return V022_CACHE.raw;
  const dbPromise=Promise.all([
    v022FetchAll('aml_v022_geo_economic_region','region,entity_count,active_entity_count,avg_sales_band_rank,median_sales_band_rank,workers_total,entities_started_since_2020,entities_started_since_2024,latest_commercial_year,updated_at'),
    v022FetchAll('aml_v022_geo_economic_commune','region,commune,entity_count,active_entity_count,avg_sales_band_rank,workers_total,entities_started_since_2020,entities_started_since_2024,latest_commercial_year,updated_at'),
    v022FetchAll('aml_v022_geo_activity_region','region,activity_code,entity_count,active_entity_count,entities_started_since_2020,entities_started_since_2024,avg_sales_band_rank,workers_total,updated_at'),
    v022FetchAll('aml_v022_geo_activity_commune','region,commune,activity_code,entity_count,active_entity_count,entities_started_since_2020,entities_started_since_2024,updated_at'),
    v022FetchAll('aml_v022_geo_context_region','region,finding_count,osfl_entity_count,press_finding_count,press_territorial_count,max_investigate_score,updated_at')
  ]);
  const ext=await Promise.allSettled([
    v022FetchText(V022_CONTEXT_BASE+'sector_sii_mapping_v1.jsonl'),
    v022FetchText(V022_CONTEXT_BASE+'dim_territory.jsonl'),
    v022FetchJson(V022_CEAD_URL),
    v022FetchJson(V022_BUDGET_URL),
    v022FetchJson(V022_BUDGET_PREVIEW_URL),
    v022FetchText(V022_CGR_BASE+'events_fusion_v1.jsonl'),
    v022FetchText(V022_CGR_BASE+'findings.jsonl')
  ]);
  const [economicRegion,economicCommune,activityRegion,activityCommune,contextRegion]=await dbPromise;
  const value=i=>ext[i].status==='fulfilled'?ext[i].value:null;
  V022_CACHE.raw={economicRegion,economicCommune,activityRegion,activityCommune,contextRegion,
    sectorMap:value(0)?v022Jsonl(value(0)):[],territories:value(1)?v022Jsonl(value(1)):[],cead:value(2)||[],budget:value(3),budgetPreview:value(4),
    cgrEvents:value(5)?v022Jsonl(value(5)):[],cgrFindings:value(6)?v022Jsonl(value(6)):[],
    sourceStatus:{sectorMap:!!value(0),territories:!!value(1),cead:!!value(2),budget:!!value(3),budgetPreview:!!value(4),cgr:!!value(5)&&!!value(6)}
  };
  return V022_CACHE.raw;
}

function v022TerritoryIndex(raw){
  const byCode=new Map(),byName=new Map();
  for(const t of raw.territories||[]){if(t.territory_level!=='COMMUNE')continue;const region=v022RegionName(t.region_name)||t.region_name;const rec={...t,region};byCode.set(String(t.commune_code),rec);byName.set(`${region}|${v022TextKey(t.canonical_name)}`,rec);}
  return {byCode,byName};
}
function v022ResolveCommune(index,region,name,code){
  if(code&&index.byCode.has(String(code)))return index.byCode.get(String(code));const r=v022RegionName(region)||region;return index.byName.get(`${r}|${v022TextKey(name)}`)||null;
}
function v022StrongMappings(raw){return (raw.sectorMap||[]).filter(x=>x.mapping_status==='VALIDATED_RULE'&&Number(x.mapping_confidence)>=0.85&&/^\d{6}$/.test(String(x.sii_activity_code||'')));}

function v022BuildEconomic(raw,level,index){
  const rows=level==='region'?raw.economicRegion:raw.economicCommune;const out=new Map();
  for(const r of rows){const region=v022RegionName(r.region);if(!region)continue;let id=region,name=region,territoryId=`CL-REG-${V022_REGION_CODE[region]}`;
    if(level==='commune'){const t=v022ResolveCommune(index,region,r.commune);if(!t)continue;id=t.territory_id;name=t.canonical_name;territoryId=t.territory_id;}
    out.set(id,{territory_id:territoryId,level:level.toUpperCase(),region,name,active_entities:Number(r.active_entity_count)||0,entity_count:Number(r.entity_count)||0,
      avg_sales_band_rank:Number(r.avg_sales_band_rank),workers:Number(r.workers_total)||0,started_2020:Number(r.entities_started_since_2020)||0,started_2024:Number(r.entities_started_since_2024)||0,
      latest_commercial_year:r.latest_commercial_year,updated_at:r.updated_at});}
  return out;
}
function v022BuildSector(raw,level,index,economy){
  const strong=v022StrongMappings(raw),mapByCode=new Map();for(const m of strong){const code=String(m.sii_activity_code);if(!mapByCode.has(code))mapByCode.set(code,[]);mapByCode.get(code).push(m);}
  const rows=level==='region'?raw.activityRegion:raw.activityCommune;const agg=new Map();
  for(const r of rows){const maps=mapByCode.get(String(r.activity_code));if(!maps)continue;const region=v022RegionName(r.region);if(!region)continue;let id=region,name=region;if(level==='commune'){const t=v022ResolveCommune(index,region,r.commune);if(!t)continue;id=t.territory_id;name=t.canonical_name;}
    if(!agg.has(id))agg.set(id,{region,name,active_activity_candidates:0,started_2020:0,started_2024:0,sectors:new Map(),mapping_codes:new Set()});const a=agg.get(id);a.mapping_codes.add(String(r.activity_code));
    a.active_activity_candidates+=Number(r.active_entity_count)||0;a.started_2020+=Number(r.entities_started_since_2020)||0;a.started_2024+=Number(r.entities_started_since_2024)||0;
    for(const m of maps){const s=m.uaf_activity_name||m.sector_id;const prev=a.sectors.get(s)||{name:s,active:0,started_2020:0,started_2024:0,codes:new Set()};prev.active+=Number(r.active_entity_count)||0;prev.started_2020+=Number(r.entities_started_since_2020)||0;prev.started_2024+=Number(r.entities_started_since_2024)||0;prev.codes.add(String(r.activity_code));a.sectors.set(s,prev);}
  }
  const records=[];for(const [id,a] of agg){const e=economy.get(id);const base=Math.max(1,e?.active_entities||0);a.sector_share_per_1000=1000*a.active_activity_candidates/base;a.formation_2024_per_10000=10000*a.started_2024/base;a.top_sectors=[...a.sectors.values()].map(s=>({...s,codes:[...s.codes]})).sort((x,y)=>y.started_2024-x.started_2024||y.active-x.active).slice(0,8);records.push(a);}
  v022PercentileMap(records,'sector_share_per_1000','share_pct');v022PercentileMap(records,'formation_2024_per_10000','formation_pct');for(const a of records)a.score=0.4*a.share_pct+0.6*a.formation_pct;
  return agg;
}
function v022BuildCead(raw,level,index,economy){
  const agg=new Map();
  for(const r of raw.cead||[]){if(r.aml_class!=='predicate_family_direct')continue;const region=v022RegionName(r.region_name);if(!region)continue;let id=region,name=region;if(level==='commune'){const t=v022ResolveCommune(index,region,r.commune_name,r.commune_code);if(!t)continue;id=t.territory_id;name=t.canonical_name;}
    if(!agg.has(id))agg.set(id,{region,name,cases:0,previous_cases:0,categories:new Map(),year:r.year});const a=agg.get(id);a.cases+=Number(r.cases_policiales)||0;a.previous_cases+=Number(r.previous_cases_policiales)||0;const c=r.crime_category||'Sin categoría';a.categories.set(c,(a.categories.get(c)||0)+(Number(r.cases_policiales)||0));}
  const recs=[];for(const [id,a] of agg){const e=economy.get(id);const base=Math.max(1,e?.active_entities||0);a.cases_per_1000_entities=1000*a.cases/base;a.yoy_pct=a.previous_cases>0?100*(a.cases-a.previous_cases)/a.previous_cases:null;a.intensity_metric=Math.log1p(a.cases_per_1000_entities);a.positive_trend=Math.max(0,Number(a.yoy_pct)||0);a.top_categories=[...a.categories.entries()].sort((x,y)=>y[1]-x[1]).slice(0,6);recs.push(a);}
  v022PercentileMap(recs,'intensity_metric','intensity_pct');v022PercentileMap(recs,'positive_trend','trend_pct');for(const a of recs)a.score=0.7*a.intensity_pct+0.3*a.trend_pct;
  return agg;
}
function v022BuildBudget(raw,level,index){
  const agg=new Map();if(!raw.budget||raw.budget.schema!=='PRESUPUESTO_TERRITORIAL_CONTEXT_V1')return agg;
  const rows=level==='region'?(raw.budget.regions||[]):(raw.budget.geographic_units||[]);
  for(const r of rows){const region=v022RegionName(r.region);if(!region)continue;let id=region,name=region;if(level==='commune'){const t=v022ResolveCommune(index,region,r.geographic_unit_name,r.geographic_unit_code);if(!t)continue;id=t.territory_id;name=t.canonical_name;}
    const rec={region,name,transactions:Number(r.transactions)||0,amount_clp:Number(r.amount_clp)||0,anomaly_signals:Number(r.anomaly_signals)||0,p1_signals:Number(r.p1_signals)||0,
      avg_priority:Number(r.avg_investigation_priority),p1_rate:Number(r.p1_per_100k_transactions),signal_rate:Number(r.signals_per_100k_transactions)};
    agg.set(id,rec);
  }
  const recs=[...agg.values()];v022PercentileMap(recs,'p1_rate','p1_pct');v022PercentileMap(recs,'signal_rate','signal_pct');v022PercentileMap(recs,'avg_priority','priority_pct');for(const a of recs)a.score=0.6*(a.p1_pct??0)+0.25*(a.signal_pct??0)+0.15*(a.priority_pct??0);
  return agg;
}
function v022BuildCgr(raw,level,index,economy){
  const eventTerr=new Map();for(const e of raw.cgrEvents||[]){const ids=Array.isArray(e.territory_ids)?e.territory_ids:[];const regs=ids.map(x=>String(x).match(/^CL-REG-(\d{2})$/)?.[1]).filter(Boolean);const coms=ids.map(x=>String(x).match(/^CL-(?:COM-)?(\d{5})$/)?.[1]).filter(Boolean);let region=regs.length?V022_REGION_BY_CODE[regs[0]]:v022RegionName(e.attributes?.region_name);let commune=null;if(coms.length)commune=index.byCode.get(coms[0])||null;if(commune)region=commune.region;eventTerr.set(e.event_id,{region,commune,date:e.temporal?.source_published_at||e.temporal?.valid_from});}
  const agg=new Map();
  for(const f of raw.cgrFindings||[]){const et=eventTerr.get(f.event_id);if(!et?.region)continue;const date=String(f.occurrence_date_to||f.occurrence_date_from||f.occurrence_date_anchor||et.date||'');const year=Number(date.slice(0,4));if(Number.isFinite(year)&&year<2020)continue;let id=et.region,name=et.region;if(level==='commune'){if(!et.commune)continue;id=et.commune.territory_id;name=et.commune.canonical_name;}
    if(!agg.has(id))agg.set(id,{region:et.region,name,findings:0,high:0,aml_scores:[],amount_clp:0,risk_families:new Map()});const a=agg.get(id);a.findings+=1;if(String(f.severity).toUpperCase()==='HIGH')a.high+=1;const s=Number(f.aml_score);if(Number.isFinite(s))a.aml_scores.push(s);a.amount_clp+=Number(f.amount_clp)||0;const rf=f.risk_family||'OTHER';a.risk_families.set(rf,(a.risk_families.get(rf)||0)+1);}
  const recs=[];for(const [id,a] of agg){const e=economy.get(id);const base=Math.max(1,e?.active_entities||0);a.findings_per_10000_entities=10000*a.findings/base;a.avg_aml_score=v022Mean(a.aml_scores);a.high_share=a.findings?100*a.high/a.findings:0;a.top_families=[...a.risk_families.entries()].sort((x,y)=>y[1]-x[1]).slice(0,5);recs.push(a);}
  v022PercentileMap(recs,'findings_per_10000_entities','finding_pct');v022PercentileMap(recs,'avg_aml_score','aml_pct');v022PercentileMap(recs,'high_share','high_pct');for(const a of recs)a.score=0.6*a.finding_pct+0.25*a.aml_pct+0.15*a.high_pct;
  return agg;
}
function v022BuildContext(raw,economy){const agg=new Map();const recs=[];for(const r of raw.contextRegion||[]){const region=v022RegionName(r.region);if(!region)continue;const e=economy.get(region);const base=Math.max(1,e?.active_entities||0);const a={region,name:region,osfl_count:Number(r.osfl_entity_count)||0,press_count:Number(r.press_territorial_count)||Number(r.press_finding_count)||0,finding_count:Number(r.finding_count)||0,max_investigate:Number(r.max_investigate_score),osfl_per_1000:1000*(Number(r.osfl_entity_count)||0)/base};agg.set(region,a);recs.push(a);}v022PercentileMap(recs,'osfl_per_1000','osfl_score');v022PercentileMap(recs,'press_count','press_score');return agg;}
function v022EconomyLayer(economy){const recs=[...economy.values()];for(const a of recs){a.capacity_metric=Math.log1p(a.active_entities)*(Number.isFinite(a.avg_sales_band_rank)?Math.max(1,a.avg_sales_band_rank):1);}v022PercentileMap(recs,'capacity_metric','capacity_score');}

function v022MethodScore(parts,method,level){
  if(method==='C'){
    const sector=Number(parts.sector);let prior=0.15;if(Number.isFinite(sector))prior=0.12+0.28*(sector/100);let z=Math.log(prior/(1-prior));
    const factors={cead:1.15,budget:1.0,cgr:0.8,cross:0.6};for(const [k,a] of Object.entries(factors)){const v=Number(parts[k]);if(Number.isFinite(v))z+=a*((v-50)/50);}
    return 100/(1+Math.exp(-z));
  }
  const weights=level==='REGION'?V022_METHODS[method].regionWeights:V022_METHODS[method].communeWeights;return v022Weighted(parts,weights);
}
function v022Coverage(parts,level,raw){
  const weights=level==='REGION'?{sector:20,cead:30,budget:25,cgr:15,context:10}:{sector:25,cead:35,budget:25,cgr:15};let have=0,total=0;
  for(const [k,w] of Object.entries(weights)){total+=w;if(k==='context'){if(raw.sourceStatus.territories&&raw.contextRegion?.length)have+=w;}else if(Number.isFinite(Number(parts[k])))have+=w;}
  return total?100*have/total:0;
}
function v022AssembleLevel(raw,level,index){
  const economy=v022BuildEconomic(raw,level,index);v022EconomyLayer(economy);const sector=v022BuildSector(raw,level,index,economy);const cead=v022BuildCead(raw,level,index,economy);const budget=v022BuildBudget(raw,level,index);const cgr=v022BuildCgr(raw,level,index,economy);const context=level==='region'?v022BuildContext(raw,economy):new Map();
  const ids=new Set([...economy.keys(),...sector.keys(),...cead.keys(),...budget.keys(),...cgr.keys()]);const rows=[];
  for(const id of ids){const e=economy.get(id)||{};const s=sector.get(id),d=cead.get(id),b=budget.get(id),g=cgr.get(id),ctx=context.get(id);const sectorObserved=raw.sourceStatus.sectorMap&&raw.activityRegion?.length;const budgetObserved=raw.sourceStatus.budget&&(level==='region'||Number(raw.budget?.coverage?.source_geographic_units)>0);const parts={sector:s?.score??(sectorObserved?0:null),cead:d?.score??null,budget:b?.score??(budgetObserved&&level==='region'?0:null),cgr:g?.score??null,press:ctx?.press_score??null,osfl:ctx?.osfl_score??null};parts.cross=v022Cross(parts);const scores={};for(const m of Object.keys(V022_METHODS))scores[m]=v022MethodScore(parts,m,level==='region'?'REGION':'COMMUNE');const coverage=v022Coverage(parts,level==='region'?'REGION':'COMMUNE',raw);const fit=coverage>=80&&Number.isFinite(parts.sector)&&Number.isFinite(parts.cead)&&Number.isFinite(parts.budget)&&(level==='commune'||Number.isFinite(parts.cgr));rows.push({id,territory_id:e.territory_id||(level==='region'?`CL-REG-${V022_REGION_CODE[e.region||id]}`:id),level:level==='region'?'REGION':'COMMUNE',region:e.region||s?.region||d?.region||b?.region||g?.region,name:e.name||s?.name||d?.name||b?.name||g?.name||id,economy:e,sector:s,cead:d,budget:b,cgr:g,context:ctx,parts,scores,coverage,confidence:coverage>=90?'ALTA':coverage>=75?'MEDIA':'BAJA',fit_for_secure_matrix:fit,export_status:fit?'APTO':'PROVISIONAL_NO_APTO'});}
  return rows;
}
function v022Compute(raw){const index=v022TerritoryIndex(raw);const regions=v022AssembleLevel(raw,'region',index);const communes=v022AssembleLevel(raw,'commune',index);return {index,regions,communes};}

function v022LayerScore(row,layer,method){if(layer==='total')return row.scores[method];if(layer==='economy')return row.economy?.capacity_score??null;if(layer==='press')return row.context?.press_score??null;if(layer==='osfl')return row.context?.osfl_score??null;return row.parts[layer]??null;}
function v022MapPoint(lon,lat){if(typeof v0191MapPoint==='function')return v0191MapPoint(lon,lat);const b={minLon:-75.644395,minLat:-55.611830,maxLon:-66.959920,maxLat:-17.580012,x0:36,x1:765,y0:42,y1:224};return{x:b.x0+(b.maxLat-lat)/(b.maxLat-b.minLat)*(b.x1-b.x0),y:b.y1-(lon-b.minLon)/(b.maxLon-b.minLon)*(b.y1-b.y0)}}
function v022ChilePaths(){return typeof V0191_MAP_PATHS!=='undefined'?V0191_MAP_PATHS:[];}
function v022MapSvg(regions){
  const ordered=Object.entries(V022_REGION_GEO).map(([name,[lon,lat]])=>({name,p:v022MapPoint(lon,lat)})).sort((a,b)=>a.p.x-b.p.x);const byName=new Map(regions.map(r=>[r.region,r]));const paths=v022ChilePaths();
  const bands=ordered.map((x,i)=>{const prev=i?ordered[i-1].p.x:24,next=i<ordered.length-1?ordered[i+1].p.x:796;const x0=i?(prev+x.p.x)/2:24,x1=i<ordered.length-1?(x.p.x+next)/2:796;const r=byName.get(x.name);const score=r?v022LayerScore(r,V022_STATE.layer,V022_STATE.method):null;return `<rect data-georisk-region="${esc(x.name)}" x="${x0.toFixed(1)}" y="28" width="${Math.max(1,x1-x0).toFixed(1)}" height="210" fill="${v022Color(score)}"><title>${esc(x.name)} · ${esc(V022_LAYERS[V022_STATE.layer].label)} ${v022Fmt(score,1)}</title></rect>`;}).join('');
  const markers=ordered.map(x=>{const r=byName.get(x.name);const score=r?v022LayerScore(r,V022_STATE.layer,V022_STATE.method):null;const selected=x.name===V022_STATE.selectedRegion;return `<g data-georisk-region="${esc(x.name)}" class="v022-marker ${selected?'selected':''}" tabindex="0"><circle cx="${x.p.x.toFixed(1)}" cy="${x.p.y.toFixed(1)}" r="${selected?8:5}" fill="${v022Color(score)}"></circle><title>${esc(x.name)} · ${v022Fmt(score,1)}</title></g>`;}).join('');
  return `<svg class="v022-map" viewBox="0 0 820 282" role="img" aria-label="Mapa de Chile por riesgo geográfico"><defs><clipPath id="v022ChileClip">${paths.map(d=>`<path d="${d}"></path>`).join('')}</clipPath></defs><g clip-path="url(#v022ChileClip)">${bands}</g><g class="v022-outline">${paths.map(d=>`<path d="${d}"></path>`).join('')}</g>${markers}</svg>`;
}
function v022MethodControls(){return `<div class="v022-methods">${Object.values(V022_METHODS).map(m=>`<button type="button" data-geo-method="${m.id}" class="${V022_STATE.method===m.id?'active':''}"><span>${m.id}</span><b>${esc(m.name)}</b><small>${esc(m.tag)}</small></button>`).join('')}</div><p class="v022-method-note">${esc(V022_METHODS[V022_STATE.method].note)}</p>`;}
function v022LayerControls(){return `<div class="v022-layers">${Object.entries(V022_LAYERS).map(([id,l])=>`<button type="button" data-geo-layer="${id}" class="${V022_STATE.layer===id?'active':''}">${esc(l.label)}<small>${esc(l.kind)}</small></button>`).join('')}</div>`;}
function v022ScoreBadge(score){return `<span class="v022-risk-badge ${v022Tone(score)}">${esc(v022Band(score))} · ${v022Fmt(score,1)}</span>`;}
function v022ComponentRows(row){const labels={sector:'Sectores 19.913',cead:'Delictual CEAD',budget:'Presupuesto',cgr:'Hallazgos CGR',press:'Prensa',osfl:'OSFL',cross:'Convergencia'};return Object.entries(labels).map(([k,label])=>{const v=row.parts[k];return `<div class="v022-component"><span>${esc(label)}</span><progress max="100" value="${Number.isFinite(Number(v))?Number(v):0}"></progress><b>${v022Fmt(v,1)}</b></div>`;}).join('');}
function v022SectorList(row){const list=row.sector?.top_sectors||[];if(!list.length)return '<div class="v022-empty">Sin actividad fuertemente homologada en este corte.</div>';return `<div class="v022-sector-list">${list.slice(0,6).map(s=>`<div><span>${esc(s.name)}</span><b>${v022Fmt(s.started_2024)}</b><small>inicios desde 2024 · ${v022Fmt(s.active)} presencias actividad-sector</small></div>`).join('')}</div>`;}
function v022RegionDetail(row,communes){if(!row)return '<div class="v022-empty">Selecciona una región.</div>';const score=row.scores[V022_STATE.method];const topCom=communes.filter(c=>c.region===row.region).sort((a,b)=>(b.scores[V022_STATE.method]??-1)-(a.scores[V022_STATE.method]??-1)).slice(0,8);return `<div class="v022-detail-head"><div><span>Región seleccionada</span><h2>${esc(row.region)}</h2><p>${esc(V022_METHODS[V022_STATE.method].name)} · ${esc(V022_METHOD_VERSION)}</p></div><div>${v022ScoreBadge(score)}<small>Cobertura ${v022Fmt(row.coverage,0)}% · confianza ${esc(row.confidence)}</small></div></div>
  <div class="v022-detail-grid"><section><h3>Descomposición explicable</h3>${v022ComponentRows(row)}</section><section><h3>Contexto económico</h3><dl><div><dt>Entidades activas publicadas</dt><dd>${v022Fmt(row.economy?.active_entities)}</dd></div><div><dt>Rango medio de ventas</dt><dd>${v022Fmt(row.economy?.avg_sales_band_rank,2)}</dd></div><div><dt>Trabajadores informados</dt><dd>${v022Fmt(row.economy?.workers)}</dd></div><div><dt>Inicios desde 2024</dt><dd>${v022Fmt(row.economy?.started_2024)}</dd></div></dl></section></div>
  <div class="v022-detail-grid"><section><h3>Actividad en sectores sujetos a Ley 19.913</h3><p class="v022-guard">Solo homologaciones VALIDATED_RULE; son candidatos por actividad SII, no una afirmación de inscripción/obligación UAF.</p>${v022SectorList(row)}</section><section><h3>Señales territoriales observadas</h3><dl><div><dt>CEAD delitos base (último corte)</dt><dd>${v022Fmt(row.cead?.cases)}</dd></div><div><dt>Variación CEAD</dt><dd>${Number.isFinite(Number(row.cead?.yoy_pct))?(row.cead.yoy_pct>=0?'+':'')+v022Fmt(row.cead.yoy_pct,1)+'%':'—'}</dd></div><div><dt>Presupuesto P1</dt><dd>${v022Fmt(row.budget?.p1_signals)}</dd></div><div><dt>Hallazgos CGR 2020+</dt><dd>${v022Fmt(row.cgr?.findings)}</dd></div><div><dt>OSFL observadas</dt><dd>${v022Fmt(row.context?.osfl_count)}</dd></div><div><dt>Prensa territorial</dt><dd>${v022Fmt(row.context?.press_count)}</dd></div></dl></section></div>
  <section class="v022-communes"><div class="v022-section-title"><div><h3>Comunas con mayor score disponible</h3><p>Percentiles nacionales; Presupuesto solo entra cuando el código de fuente valida contra CUT del Context Hub.</p></div></div><div class="v022-tablewrap"><table><thead><tr><th>Comuna</th><th>Score</th><th>Cobertura</th><th>CEAD</th><th>Sectores 19.913</th><th>Presupuesto</th><th>CGR</th></tr></thead><tbody>${topCom.map(c=>`<tr><td>${esc(c.name)}</td><td>${v022ScoreBadge(c.scores[V022_STATE.method])}</td><td>${v022Fmt(c.coverage,0)}%</td><td>${v022Fmt(c.parts.cead,1)}</td><td>${v022Fmt(c.parts.sector,1)}</td><td>${v022Fmt(c.parts.budget,1)}</td><td>${v022Fmt(c.parts.cgr,1)}</td></tr>`).join('')||'<tr><td colspan="7">Sin comunas comparables en este corte.</td></tr>'}</tbody></table></div></section>`;}
function v022Ranking(regions){const rows=[...regions].sort((a,b)=>(b.scores[V022_STATE.method]??-1)-(a.scores[V022_STATE.method]??-1));return `<div class="v022-tablewrap"><table><thead><tr><th>#</th><th>Región</th><th>Score</th><th>Cobertura</th><th>Sector</th><th>CEAD</th><th>Presupuesto</th><th>CGR</th><th>Estado exportación</th></tr></thead><tbody>${rows.map((r,i)=>`<tr data-georisk-region="${esc(r.region)}"><td>${i+1}</td><td><b>${esc(r.region)}</b></td><td>${v022ScoreBadge(r.scores[V022_STATE.method])}</td><td>${v022Fmt(r.coverage,0)}%</td><td>${v022Fmt(r.parts.sector,1)}</td><td>${v022Fmt(r.parts.cead,1)}</td><td>${v022Fmt(r.parts.budget,1)}</td><td>${v022Fmt(r.parts.cgr,1)}</td><td><span class="v022-export-state ${r.fit_for_secure_matrix?'ok':'warn'}">${esc(r.export_status)}</span></td></tr>`).join('')}</tbody></table></div>`;}
function v022Sources(raw){const s=raw.sourceStatus;const budget=s.budget?'materializado':s.budgetPreview?'preview parcial':'no disponible';return `<div class="v022-source-strip"><span class="${s.sectorMap?'ok':'miss'}">Context Hub</span><span class="${s.cead?'ok':'miss'}">CEAD</span><span class="${s.budget?'ok':'partial'}">Presupuesto · ${budget}</span><span class="${s.cgr?'ok':'miss'}">CGR</span><span class="${raw.contextRegion?.length?'ok':'miss'}">Prensa/OSFL</span></div>`;}
function v022Kpis(regions){const method=V022_STATE.method;const valid=regions.filter(r=>Number.isFinite(Number(r.scores[method])));const sorted=[...valid].sort((a,b)=>b.scores[method]-a.scores[method]);const avg=v022Mean(valid.map(r=>r.coverage));const apt=regions.filter(r=>r.fit_for_secure_matrix).length;return `<div class="v022-kpis"><div><span>Regiones evaluadas</span><b>${valid.length}/16</b><small>con score disponible</small></div><div><span>Cobertura media</span><b>${v022Fmt(avg,0)}%</b><small>fuentes requeridas</small></div><div><span>Aptas para matriz segura</span><b>${apt}</b><small>cobertura ≥80% + fuentes críticas</small></div><div><span>Mayor score actual</span><b>${sorted[0]?v022Fmt(sorted[0].scores[method],1):'—'}</b><small>${sorted[0]?esc(sorted[0].region):'sin dato'}</small></div></div>`;}

function v022ExportRows(level='region'){const rows=level==='region'?V022_STATE.computed.regions:V022_STATE.computed.communes;const m=V022_STATE.method;return rows.map(r=>({territory_id:r.territory_id,territory_level:r.level,region:r.region,territory_name:r.name,method:m,method_name:V022_METHODS[m].name,method_version:V022_METHOD_VERSION,score:Number.isFinite(Number(r.scores[m]))?Number(r.scores[m].toFixed(4)):null,risk_band:v022Band(r.scores[m]),confidence:r.confidence,coverage_pct:Number(r.coverage.toFixed(2)),fit_for_secure_matrix:r.fit_for_secure_matrix,export_status:r.export_status,sector_score:r.parts.sector,cead_score:r.parts.cead,budget_score:r.parts.budget,cgr_score:r.parts.cgr,press_context_score:r.parts.press,osfl_exposure_score:r.parts.osfl,convergence_score:r.parts.cross,active_entities:r.economy?.active_entities??null,avg_sales_band_rank:r.economy?.avg_sales_band_rank??null,workers:r.economy?.workers??null,sector_activity_candidates:r.sector?.active_activity_candidates??null,sector_started_since_2024:r.sector?.started_2024??null,cead_cases:r.cead?.cases??null,cead_yoy_pct:r.cead?.yoy_pct??null,budget_p1:r.budget?.p1_signals??null,budget_p1_per_100k:r.budget?.p1_rate??null,cgr_findings_2020_plus:r.cgr?.findings??null,osfl_count:r.context?.osfl_count??null,press_territorial_count:r.context?.press_count??null}));}
function v022Csv(rows){if(!rows.length)return '';const cols=Object.keys(rows[0]);const q=v=>{if(v===null||v===undefined)return '';const s=String(v);return /[",\n]/.test(s)?`"${s.replaceAll('"','""')}"`:s;};return [cols.join(','),...rows.map(r=>cols.map(c=>q(r[c])).join(','))].join('\n');}
function v022Download(name,text,type){const blob=new Blob([text],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);}
function v022ExportCsv(){const rows=[...v022ExportRows('region'),...v022ExportRows('commune')];v022Download(`aml_geographic_risk_${V022_STATE.method}_${new Date().toISOString().slice(0,10)}.csv`,v022Csv(rows),'text/csv;charset=utf-8');}
function v022ExportJson(){const payload={schema:'AML_GEOGRAPHIC_RISK_EXPORT_V1',generated_at:new Date().toISOString(),method:{id:V022_STATE.method,name:V022_METHODS[V022_STATE.method].name,version:V022_METHOD_VERSION,experimental:V022_STATE.method==='C'},semantics:'TERRITORIAL_SUPERVISORY_CONTEXT_NOT_ENTITY_AML_PROBABILITY',guardrails:['MISSING_IS_NOT_ZERO','PRESS_DOES_NOT_EVIDENCE_CRIME','OSFL_PRESENCE_IS_EXPOSURE_NOT_ADVERSE_BY_ITSELF','ECONOMIC_CAPACITY_IS_EXPOSURE','CEAD_IS_TERRITORIAL_ACTIVITY_NOT_ATTRIBUTION','BUDGET_ANOMALY_IS_NOT_ILLEGALITY','CGR_FINDINGS_REQUIRE_DOCUMENTARY_TRACEABILITY'],region_rows:v022ExportRows('region'),commune_rows:v022ExportRows('commune')};v022Download(`aml_geographic_risk_${V022_STATE.method}_${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(payload,null,2),'application/json;charset=utf-8');}

function v022Render(){const root=v019Content();if(!root||!V022_STATE.computed)return;const regions=V022_STATE.computed.regions,communes=V022_STATE.computed.communes;const selected=regions.find(r=>r.region===V022_STATE.selectedRegion)||regions[0];if(selected)V022_STATE.selectedRegion=selected.region;root.innerHTML=`<section class="v022-hero"><div><span class="v022-eyebrow">TERRITORIAL INTELLIGENCE · ${esc(V022_METHOD_VERSION)}</span><h2>Riesgo geográfico</h2><p>Índice territorial explicable para priorización y fiscalización. Separa riesgo, exposición, contexto y cobertura; no se propaga al score AML de una entidad.</p></div><div class="v022-actions"><button type="button" id="v022-export-csv">Exportar CSV</button><button type="button" id="v022-export-json">Exportar JSON + metodología</button></div></section>
  ${v022Sources(V022_STATE.data)}${v022Kpis(regions)}<section class="v022-model-card"><div class="v022-section-title"><div><h3>3 alternativas de cálculo</h3><p>B es la recomendada para producción; A queda como baseline auditable y C como escenario experimental.</p></div></div>${v022MethodControls()}</section>
  <section class="v022-map-card"><div class="v022-section-title"><div><h3>Mapa multicapa de Chile</h3><p>El color cambia según la capa activa. La segmentación visual del contorno es aproximada por latitud; el score y la exportación usan CUT/Context Hub, no esta geometría visual.</p></div><span class="v022-legend"><i class="low"></i>Bajo <i class="guarded"></i>Moderado <i class="elevated"></i>Medio <i class="high"></i>Alto <i class="veryhigh"></i>Muy alto</span></div>${v022LayerControls()}<div class="v022-map-layout"><div>${v022MapSvg(regions)}</div><aside><h4>${esc(V022_LAYERS[V022_STATE.layer].label)}</h4><p>${V022_LAYERS[V022_STATE.layer].kind==='risk'?'Componente de riesgo/alerta territorial normalizado.':'Capa de exposición/contexto; no implica riesgo adverso por sí sola.'}</p>${v022Ranking(regions)}</aside></div></section>
  <section class="v022-detail-card" id="v022-region-detail">${v022RegionDetail(selected,communes)}</section>
  <section class="v022-methodology"><h3>Reglas de robustez para uso en Fiscalización</h3><div><article><b>1. Missing ≠ 0</b><p>Si un radar no está disponible, el componente queda nulo y baja la cobertura. No se interpreta como ausencia de riesgo.</p></article><article><b>2. Denominadores</b><p>CEAD, sectores y Presupuesto se normalizan por exposición económica o volumen transaccional antes del percentil.</p></article><article><b>3. Separación semántica</b><p>Prensa, OSFL y capacidad económica permanecen visibles, pero el modelo B evita que su volumen bruto infle el riesgo.</p></article><article><b>4. Exportación gobernada</b><p>Cada fila lleva método, versión, cobertura, confianza y estado APTO/PROVISIONAL. El JSON incorpora guardrails.</p></article></div></section>`;
  root.querySelectorAll('[data-geo-method]').forEach(b=>b.addEventListener('click',()=>{V022_STATE.method=b.dataset.geoMethod;v022Render();}));
  root.querySelectorAll('[data-geo-layer]').forEach(b=>b.addEventListener('click',()=>{V022_STATE.layer=b.dataset.geoLayer;v022Render();}));
  root.querySelectorAll('[data-georisk-region]').forEach(el=>el.addEventListener('click',()=>{V022_STATE.selectedRegion=el.dataset.georiskRegion;v022Render();}));
  root.querySelector('#v022-export-csv')?.addEventListener('click',v022ExportCsv);root.querySelector('#v022-export-json')?.addEventListener('click',v022ExportJson);
}

async function v022LoadTerritory(){
  state.view='territory';shell('Riesgo geográfico','Territorio · contexto económico, delitos base, gasto público, CGR, prensa, OSFL y sectores Ley 19.913');const root=v019Content();root.innerHTML='<div class="v019-loading">Construyendo score territorial gobernado…</div>';
  try{const raw=await v022LoadRaw();V022_STATE.data=raw;V022_STATE.computed=v022Compute(raw);v022Render();}catch(error){console.error('v0.22 geographic risk',error);root.innerHTML=`<div class="v019-empty"><b>No fue posible construir Riesgo geográfico.</b><br>${esc(String(error?.message||error))}</div>`;}
}

/* Activate only the Territory route; other views keep the existing v0.21.1 implementation. */
v019LoadTerritory=v022LoadTerritory;
if(typeof v0211ApplyVersion==='function'){
  v0211ApplyVersion=function(){const label=`Operational Radar · v${V022_GEO}`;const badge=document.querySelector('.v019-brand small');if(badge){badge.textContent=label;badge.setAttribute('aria-label',label);}document.title=`AML Analytical Workbench · v${V022_GEO}`;};
}
window.__AML_ACTIVE_VERSION__=V022_GEO;window.__AML_BUILD__=V022_GEO;
