'use strict';

/* AML Workbench v0.22.1 · Territory load hotfix
 * - reads snapshot-backed territorial views
 * - degrades per source instead of failing the whole page
 * - exposes source failures in sourceStatus for coverage handling
 */
const V0221='0.22.1';

v022LoadRaw=async function(){
  if(V022_CACHE.raw)return V022_CACHE.raw;

  const dbSpecs=[
    ['economicRegion','aml_v022_geo_economic_region','region,entity_count,active_entity_count,avg_sales_band_rank,median_sales_band_rank,workers_total,entities_started_since_2020,entities_started_since_2024,latest_commercial_year,updated_at'],
    ['economicCommune','aml_v022_geo_economic_commune','region,commune,entity_count,active_entity_count,avg_sales_band_rank,workers_total,entities_started_since_2020,entities_started_since_2024,latest_commercial_year,updated_at'],
    ['activityRegion','aml_v022_geo_activity_region','region,activity_code,entity_count,active_entity_count,entities_started_since_2020,entities_started_since_2024,avg_sales_band_rank,workers_total,updated_at'],
    ['activityCommune','aml_v022_geo_activity_commune','region,commune,activity_code,entity_count,active_entity_count,entities_started_since_2020,entities_started_since_2024,updated_at'],
    ['contextRegion','aml_v022_geo_context_region','region,finding_count,osfl_entity_count,press_finding_count,press_territorial_count,max_investigate_score,updated_at']
  ];

  const [dbSettled,ext]=await Promise.all([
    Promise.allSettled(dbSpecs.map(([,table,columns])=>v022FetchAll(table,columns))),
    Promise.allSettled([
      v022FetchText(V022_CONTEXT_BASE+'sector_sii_mapping_v1.jsonl'),
      v022FetchText(V022_CONTEXT_BASE+'dim_territory.jsonl'),
      v022FetchJson(V022_CEAD_URL),
      v022FetchJson(V022_BUDGET_URL),
      v022FetchJson(V022_BUDGET_PREVIEW_URL),
      v022FetchText(V022_CGR_BASE+'events_fusion_v1.jsonl'),
      v022FetchText(V022_CGR_BASE+'findings.jsonl')
    ])
  ]);

  const db={};
  const dbStatus={};
  dbSettled.forEach((result,i)=>{
    const key=dbSpecs[i][0];
    if(result.status==='fulfilled'){
      db[key]=result.value||[];
      dbStatus[key]=true;
    }else{
      console.warn(`v0.22.1 territorial source unavailable: ${key}`,result.reason);
      db[key]=[];
      dbStatus[key]=false;
    }
  });
  const value=i=>ext[i].status==='fulfilled'?ext[i].value:null;

  V022_CACHE.raw={
    economicRegion:db.economicRegion,
    economicCommune:db.economicCommune,
    activityRegion:db.activityRegion,
    activityCommune:db.activityCommune,
    contextRegion:db.contextRegion,
    sectorMap:value(0)?v022Jsonl(value(0)):[],
    territories:value(1)?v022Jsonl(value(1)):[],
    cead:value(2)||[],
    budget:value(3),
    budgetPreview:value(4),
    cgrEvents:value(5)?v022Jsonl(value(5)):[],
    cgrFindings:value(6)?v022Jsonl(value(6)):[],
    sourceStatus:{
      economic:dbStatus.economicRegion&&dbStatus.economicCommune,
      activities:dbStatus.activityRegion&&dbStatus.activityCommune,
      contextDb:dbStatus.contextRegion,
      sectorMap:!!value(0),
      territories:!!value(1),
      cead:!!value(2),
      budget:!!value(3),
      budgetPreview:!!value(4),
      cgr:!!value(5)&&!!value(6)
    }
  };

  if(!V022_CACHE.raw.economicRegion.length&&!V022_CACHE.raw.cead.length){
    throw new Error('No hay fuentes territoriales críticas disponibles para construir el score.');
  }
  return V022_CACHE.raw;
};

if(typeof v0211ApplyVersion==='function'){
  v0211ApplyVersion=function(){
    const label=`Operational Radar · v${V0221}`;
    const badge=document.querySelector('.v019-brand small');
    if(badge){badge.textContent=label;badge.setAttribute('aria-label',label);}
    document.title=`AML Analytical Workbench · v${V0221}`;
  };
}

window.__AML_ACTIVE_VERSION__=V0221;
window.__AML_BUILD__=V0221;
