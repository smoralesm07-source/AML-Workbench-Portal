'use strict';

/* v0.27.0 source-builder hardening.
 * Completes MISSING_IS_NOT_ZERO_STRICT before percentile/scoring stages.
 * Missing CEAD trend, Budget rates/priorities and CGR aml_score remain null.
 */

v022BuildEconomic=function(raw,level,index){
  const rows=level==='region'?raw.economicRegion:raw.economicCommune,out=new Map();
  for(const r of rows||[]){
    const region=v022RegionName(r.region);if(!region)continue;let id=region,name=region,territoryId=`CL-REG-${V022_REGION_CODE[region]}`;
    if(level==='commune'){const t=v022ResolveCommune(index,region,r.commune);if(!t)continue;id=t.territory_id;name=t.canonical_name;territoryId=t.territory_id;}
    out.set(id,{territory_id:territoryId,level:level.toUpperCase(),region,name,
      active_entities:v027Number(r.active_entity_count),entity_count:v027Number(r.entity_count),avg_sales_band_rank:v027Number(r.avg_sales_band_rank),workers:v027Number(r.workers_total),
      started_2020:v027Number(r.entities_started_since_2020),started_2024:v027Number(r.entities_started_since_2024),latest_commercial_year:r.latest_commercial_year,updated_at:r.updated_at});
  }
  return out;
};

v022BuildSector=function(raw,level,index,economy){
  const strong=v022StrongMappings(raw),mapByCode=new Map();for(const m of strong){const code=String(m.sii_activity_code);if(!mapByCode.has(code))mapByCode.set(code,[]);mapByCode.get(code).push(m);}
  const rows=level==='region'?raw.activityRegion:raw.activityCommune,agg=new Map();
  for(const r of rows||[]){
    const maps=mapByCode.get(String(r.activity_code));if(!maps)continue;const region=v022RegionName(r.region);if(!region)continue;let id=region,name=region;
    if(level==='commune'){const t=v022ResolveCommune(index,region,r.commune);if(!t)continue;id=t.territory_id;name=t.canonical_name;}
    if(!agg.has(id))agg.set(id,{region,name,active_activity_candidates:0,started_2020:0,started_2024:0,sectors:new Map(),mapping_codes:new Set()});const a=agg.get(id);a.mapping_codes.add(String(r.activity_code));
    const active=v027Number(r.active_entity_count),s20=v027Number(r.entities_started_since_2020),s24=v027Number(r.entities_started_since_2024);
    if(active!==null)a.active_activity_candidates+=active;if(s20!==null)a.started_2020+=s20;if(s24!==null)a.started_2024+=s24;
    for(const m of maps){const s=m.uaf_activity_name||m.sector_id,prev=a.sectors.get(s)||{name:s,active:0,started_2020:0,started_2024:0,codes:new Set()};if(active!==null)prev.active+=active;if(s20!==null)prev.started_2020+=s20;if(s24!==null)prev.started_2024+=s24;prev.codes.add(String(r.activity_code));a.sectors.set(s,prev);}
  }
  const records=[];for(const [id,a] of agg){
    const base=v027Number(economy.get(id)?.active_entities);
    a.sector_share_per_1000=base!==null&&base>0?1000*a.active_activity_candidates/base:null;
    a.formation_2024_per_10000=base!==null&&base>0?10000*a.started_2024/base:null;
    a.top_sectors=[...a.sectors.values()].map(s=>({...s,codes:[...s.codes]})).sort((x,y)=>y.started_2024-x.started_2024||y.active-x.active).slice(0,8);records.push(a);
  }
  v022PercentileMap(records,'sector_share_per_1000','share_pct');v022PercentileMap(records,'formation_2024_per_10000','formation_pct');
  for(const a of records)a.score=v022Weighted({share:a.share_pct,formation:a.formation_pct},{share:40,formation:60});
  return agg;
};

v022BuildCead=function(raw,level,index,economy){
  const agg=new Map();
  for(const r of raw.cead||[]){
    if(r.aml_class!=='predicate_family_direct')continue;const region=v022RegionName(r.region_name);if(!region)continue;let id=region,name=region;
    if(level==='commune'){const t=v022ResolveCommune(index,region,r.commune_name,r.commune_code);if(!t)continue;id=t.territory_id;name=t.canonical_name;}
    if(!agg.has(id))agg.set(id,{region,name,cases:0,previous_cases:0,cases_observed:0,previous_observed:0,categories:new Map(),year:r.year});const a=agg.get(id);
    const cases=v027Number(r.cases_policiales),prev=v027Number(r.previous_cases_policiales);if(cases!==null){a.cases+=cases;a.cases_observed++;}if(prev!==null){a.previous_cases+=prev;a.previous_observed++;}
    const c=r.crime_category||'Sin categoría';if(cases!==null)a.categories.set(c,(a.categories.get(c)||0)+cases);
  }
  const recs=[];for(const [id,a] of agg){
    if(!a.cases_observed)a.cases=null;if(!a.previous_observed)a.previous_cases=null;const base=v027Number(economy.get(id)?.active_entities);
    a.cases_per_1000_entities=a.cases!==null&&base!==null&&base>0?1000*a.cases/base:null;
    a.yoy_pct=a.cases!==null&&a.previous_cases!==null&&a.previous_cases>0?100*(a.cases-a.previous_cases)/a.previous_cases:null;
    a.intensity_metric=a.cases_per_1000_entities===null?null:Math.log1p(a.cases_per_1000_entities);
    a.positive_trend=a.yoy_pct===null?null:Math.max(0,a.yoy_pct);
    a.top_categories=[...a.categories.entries()].sort((x,y)=>y[1]-x[1]).slice(0,6);recs.push(a);
  }
  v022PercentileMap(recs,'intensity_metric','intensity_pct');v022PercentileMap(recs,'positive_trend','trend_pct');
  for(const a of recs)a.score=v022Weighted({intensity:a.intensity_pct,trend:a.trend_pct},{intensity:70,trend:30});
  return agg;
};

v022BuildBudget=function(raw,level,index){
  const agg=new Map();if(!raw.budget||raw.budget.schema!=='PRESUPUESTO_TERRITORIAL_CONTEXT_V1')return agg;
  const rows=level==='region'?(raw.budget.regions||[]):(raw.budget.geographic_units||[]);
  for(const r of rows){
    const region=v022RegionName(r.region);if(!region)continue;let id=region,name=region;if(level==='commune'){const t=v022ResolveCommune(index,region,r.geographic_unit_name,r.geographic_unit_code);if(!t)continue;id=t.territory_id;name=t.canonical_name;}
    agg.set(id,{region,name,transactions:v027Number(r.transactions),amount_clp:v027Number(r.amount_clp),anomaly_signals:v027Number(r.anomaly_signals),p1_signals:v027Number(r.p1_signals),avg_priority:v027Number(r.avg_investigation_priority),p1_rate:v027Number(r.p1_per_100k_transactions),signal_rate:v027Number(r.signals_per_100k_transactions)});
  }
  const recs=[...agg.values()];v022PercentileMap(recs,'p1_rate','p1_pct');v022PercentileMap(recs,'signal_rate','signal_pct');v022PercentileMap(recs,'avg_priority','priority_pct');
  for(const a of recs)a.score=v022Weighted({p1:a.p1_pct,signal:a.signal_pct,priority:a.priority_pct},{p1:60,signal:25,priority:15});
  return agg;
};

v022BuildCgr=function(raw,level,index,economy){
  const eventTerr=new Map();for(const e of raw.cgrEvents||[]){const ids=Array.isArray(e.territory_ids)?e.territory_ids:[],regs=ids.map(x=>String(x).match(/^CL-REG-(\d{2})$/)?.[1]).filter(Boolean),coms=ids.map(x=>String(x).match(/^CL-(?:COM-)?(\d{5})$/)?.[1]).filter(Boolean);let region=regs.length?V022_REGION_BY_CODE[regs[0]]:v022RegionName(e.attributes?.region_name),commune=null;if(coms.length)commune=index.byCode.get(coms[0])||null;if(commune)region=commune.region;eventTerr.set(e.event_id,{region,commune,date:e.temporal?.source_published_at||e.temporal?.valid_from});}
  const agg=new Map();
  for(const f of raw.cgrFindings||[]){
    const et=eventTerr.get(f.event_id);if(!et?.region)continue;const date=String(f.occurrence_date_to||f.occurrence_date_from||f.occurrence_date_anchor||et.date||''),year=Number(date.slice(0,4));if(Number.isFinite(year)&&year<2020)continue;let id=et.region,name=et.region;if(level==='commune'){if(!et.commune)continue;id=et.commune.territory_id;name=et.commune.canonical_name;}
    if(!agg.has(id))agg.set(id,{region:et.region,name,findings:0,high:0,aml_scores:[],amount_clp:0,risk_families:new Map()});const a=agg.get(id);a.findings++;if(String(f.severity).toUpperCase()==='HIGH')a.high++;
    const s=v027Number(f.aml_score);if(s!==null)a.aml_scores.push(s);const amount=v027Number(f.amount_clp);if(amount!==null)a.amount_clp+=amount;const rf=f.risk_family||'OTHER';a.risk_families.set(rf,(a.risk_families.get(rf)||0)+1);
  }
  const recs=[];for(const [id,a] of agg){const base=v027Number(economy.get(id)?.active_entities);a.findings_per_10000_entities=base!==null&&base>0?10000*a.findings/base:null;a.avg_aml_score=v022Mean(a.aml_scores);a.high_share=a.findings?100*a.high/a.findings:null;a.top_families=[...a.risk_families.entries()].sort((x,y)=>y[1]-x[1]).slice(0,5);recs.push(a);}
  v022PercentileMap(recs,'findings_per_10000_entities','finding_pct');v022PercentileMap(recs,'avg_aml_score','aml_pct');v022PercentileMap(recs,'high_share','high_pct');
  for(const a of recs)a.score=v022Weighted({findings:a.finding_pct,aml:a.aml_pct,high:a.high_pct},{findings:60,aml:25,high:15});
  return agg;
};

v022BuildContext=function(raw,economy){
  const agg=new Map(),recs=[];for(const r of raw.contextRegion||[]){const region=v022RegionName(r.region);if(!region)continue;const base=v027Number(economy.get(region)?.active_entities),osfl=v027Number(r.osfl_entity_count),press=v027Number(r.press_territorial_count)??v027Number(r.press_finding_count);const a={region,name:region,osfl_count:osfl,press_count:press,finding_count:v027Number(r.finding_count),max_investigate:v027Number(r.max_investigate_score),osfl_per_1000:osfl!==null&&base!==null&&base>0?1000*osfl/base:null};agg.set(region,a);recs.push(a);}v022PercentileMap(recs,'osfl_per_1000','osfl_score');v022PercentileMap(recs,'press_count','press_score');return agg;
};

v022EconomyLayer=function(economy){const recs=[...economy.values()];for(const a of recs){const active=v027Number(a.active_entities),sales=v027Number(a.avg_sales_band_rank);a.capacity_metric=active!==null&&sales!==null?Math.log1p(active)*Math.max(1,sales):null;}v022PercentileMap(recs,'capacity_metric','capacity_score');};
