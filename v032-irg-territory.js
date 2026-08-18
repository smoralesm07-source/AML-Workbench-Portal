'use strict';

/* AML Workbench v0.32.0 · IRG-LA/FT territorial model
 * Implements the user-provided geographic-risk proposal as the primary territorial model.
 * Exact top-level weights:
 *   45% Vulnerabilidad/Exposición
 *   20% Densidad de Sujetos Obligados
 *   20% Brecha potencial de cobertura
 *   15% Amenaza territorial
 * Confidence weights:
 *   35% Completitud + 30% Calidad geográfica + 20% Calidad de mapeo + 15% Actualidad
 *
 * CGR, Presupuesto, IPA3/sanciones, prensa and OSFL remain evidence/context and DO NOT
 * receive an invented IRG weight.
 */
const V032='0.32.0';
const V032_BUILD='0320';
const V032_METHOD='IRG-LAFT-0.32.0';
const V032_UAF_VIEW='aml_v032_geo_uaf_territory';
const V032_SECTOR_CATALOG='./data/irg_sector_vulnerability_v1.json';
const V032_WEIGHTS={vulnerability:0.45,density:0.20,gap:0.20,threat:0.15};
const V032_CONF_WEIGHTS={completeness:0.35,geo:0.30,mapping:0.20,freshness:0.15};
const V032_LAYERS={
  irg:{label:'IRG-LA/FT',short:'IRG',kind:'model'},
  vulnerability:{label:'Vulnerabilidad / exposición',short:'V/E',kind:'model'},
  density:{label:'Densidad de Sujetos Obligados',short:'Densidad SO',kind:'model'},
  gap:{label:'Brecha potencial de cobertura',short:'Brecha',kind:'model'},
  threat:{label:'Amenaza territorial CEAD',short:'Amenaza',kind:'model'}
};
const V032_STATE={layer:'irg',selectedRegion:'Metropolitana de Santiago',raw:null,computed:null};
const V032_CACHE={raw:null};
const V032_BASE_LOAD_RAW=v022LoadRaw;
const V032_BASE_SHELL=shell;

function v032ApplyVersion(){
  try{if(typeof V0206_VERSION_OBSERVER!=='undefined'&&V0206_VERSION_OBSERVER){V0206_VERSION_OBSERVER.disconnect();V0206_VERSION_OBSERVER=null;}}catch{}
  window.__AML_ACTIVE_VERSION__=V032;window.__AML_BUILD__=V032_BUILD;
  const label=`Operational Radar · v${V032}`;const badge=document.querySelector('.v019-brand small');
  if(badge){badge.setAttribute('data-runtime-label',label);badge.setAttribute('aria-label',label);badge.dataset.activeVersion=V032;badge.textContent=label;}
  document.title=`AML Analytical Workbench · v${V032}`;
  document.documentElement.setAttribute('data-aml-version',V032);document.documentElement.setAttribute('data-aml-build',V032_BUILD);
}
shell=function(title,subtitle){V032_BASE_SHELL(title,subtitle);v032ApplyVersion();};
if(typeof v0211ApplyVersion==='function')v0211ApplyVersion=v032ApplyVersion;
window.__AML_RUNTIME_VERSION_APPLIER__=v032ApplyVersion;

function v032Finite(v){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));}
function v032Num(v,d=1){return v032Finite(v)?Number(v).toLocaleString('es-CL',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';}
function v032Pct(v,d=0){return v032Finite(v)?`${v032Num(v,d)}%`:'—';}
function v032Mean(xs){const a=xs.filter(v032Finite).map(Number);return a.length?a.reduce((s,x)=>s+x,0)/a.length:null;}
function v032Norm(v){return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').replace(/\s+/g,' ').trim();}
function v032Clamp(v,a=0,b=100){return v032Finite(v)?Math.max(a,Math.min(b,Number(v))):null;}
function v032Band(v){const n=Number(v);if(!Number.isFinite(n))return 'Sin cálculo';if(n>=80)return 'Crítico';if(n>=60)return 'Alto';if(n>=40)return 'Medio';if(n>=20)return 'Moderado';return 'Bajo';}
function v032Tone(v){const n=Number(v);if(!Number.isFinite(n))return 'missing';if(n>=80)return 'critical';if(n>=60)return 'high';if(n>=40)return 'medium';if(n>=20)return 'guarded';return 'low';}
function v032Color(v){return ({critical:'#9f2d2d',high:'#cf5b42',medium:'#e4934e',guarded:'#e4c889',low:'#a9c8bc',missing:'#d7dde2'})[v032Tone(v)];}
function v032Percentiles(rows,getter,setter){
  const valid=rows.map(r=>({r,v:Number(getter(r))})).filter(x=>Number.isFinite(x.v)).sort((a,b)=>a.v-b.v);
  if(!valid.length)return;
  const groups=new Map();
  valid.forEach((x,i)=>{const k=String(x.v);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(i);});
  valid.forEach(x=>{const is=groups.get(String(x.v));const rank=is.reduce((s,i)=>s+i,0)/is.length;setter(x.r,valid.length===1?50:100*rank/(valid.length-1));});
}
function v032StrictIRG(parts){
  if(!Object.keys(V032_WEIGHTS).every(k=>v032Finite(parts[k])))return null;
  return Object.entries(V032_WEIGHTS).reduce((s,[k,w])=>s+Number(parts[k])*w,0);
}
function v032Contribution(row,key){return v032Finite(row?.parts?.[key])?Number(row.parts[key])*V032_WEIGHTS[key]:null;}
function v032AgeScore(value){
  if(!value)return null;let d;
  if(/^\d{4}$/.test(String(value)))d=new Date(`${value}-12-31T12:00:00Z`);else d=new Date(value);
  if(Number.isNaN(d.getTime()))return null;const days=Math.max(0,(Date.now()-d.getTime())/86400000);
  if(days<=180)return 100;if(days<=365)return 75;if(days<=730)return 50;return 25;
}
function v032Confidence(parts,meta){
  const completeness=25*Object.keys(V032_WEIGHTS).filter(k=>v032Finite(parts[k])).length;
  const geo=v032Clamp(meta.geo_quality);
  const mapping=v032Clamp(meta.mapping_quality);
  const freshness=v032Clamp(meta.freshness);
  const inputs={completeness,geo,mapping,freshness};
  const score=Object.entries(V032_CONF_WEIGHTS).reduce((s,[k,w])=>s+(v032Finite(inputs[k])?Number(inputs[k]):0)*w,0);
  return {score,inputs,label:score>=85?'Alta':score>=70?'Media':'Baja'};
}
function v032Shape(region){
  const m={
    'Metropolitana de Santiago':'Metropolitana',
    "Libertador General Bernardo O'Higgins":"O'Higgins",
    'Aysén del General Carlos Ibáñez del Campo':'Aysén',
    'Magallanes y de la Antártica Chilena':'Magallanes'
  };
  return m[region]||region;
}

async function v032LoadRaw(){
  if(V032_CACHE.raw)return V032_CACHE.raw;
  const base=await V032_BASE_LOAD_RAW();
  const [uaf,catalog]=await Promise.allSettled([
    v022FetchAll(V032_UAF_VIEW,'territory_key,level,region,commune,uaf_observed,uaf_profiled,sector_entity_count,sector_counts,uaf_source_total,uaf_located_total,geo_coverage_pct,snapshot_generated_at'),
    v022FetchJson(V032_SECTOR_CATALOG)
  ]);
  const raw={...base,
    uafTerritory:uaf.status==='fulfilled'?(uaf.value||[]):[],
    irgSectorCatalog:catalog.status==='fulfilled'?catalog.value:null,
    sourceStatus:{...(base.sourceStatus||{}),uafTerritory:uaf.status==='fulfilled',irgSectorCatalog:catalog.status==='fulfilled'}
  };
  V032_CACHE.raw=raw;return raw;
}
v022LoadRaw=v032LoadRaw;

function v032Catalog(raw){
  const rows=raw.irgSectorCatalog?.sectors||[],byId=new Map(),nameToId=new Map();
  for(const s of rows){
    const id=Number(s.uaf_sector_id);if(!Number.isFinite(id))continue;
    const risk=Number(s.risk_inherent_1_5),risk100=Number.isFinite(risk)?100*(risk-1)/4:null;
    const rec={...s,uaf_sector_id:id,risk_0_100:risk100};byId.set(id,rec);
    for(const n of [s.sector_name,...(s.aliases||[])])nameToId.set(v032Norm(n),id);
  }
  for(const m of raw.sectorMap||[]){
    const id=Number(m.uaf_sector_id);if(Number.isFinite(id)&&m.uaf_activity_name)nameToId.set(v032Norm(m.uaf_activity_name),id);
  }
  return {byId,nameToId};
}
function v032UafIndex(raw,index,catalog){
  const region=new Map(),commune=new Map();
  for(const x of raw.uafTerritory||[]){
    const rn=v022RegionName(x.region)||x.region;if(!rn)continue;
    const counts=new Map();
    for(const [name,n] of Object.entries(x.sector_counts||{})){
      const id=catalog.nameToId.get(v032Norm(name));if(id)counts.set(id,(counts.get(id)||0)+(Number(n)||0));
    }
    const rec={...x,region:rn,uaf_observed:Number(x.uaf_observed)||0,uaf_profiled:Number(x.uaf_profiled)||0,sectorCounts:counts,
      geo_coverage_pct:v032Finite(x.geo_coverage_pct)?Number(x.geo_coverage_pct):null};
    if(x.level==='REGION')region.set(rn,rec);
    else if(x.level==='COMMUNE'){
      const t=v022ResolveCommune(index,rn,x.commune);if(t)commune.set(t.territory_id,rec);
    }
  }
  return {region,commune};
}
function v032BuildSectorExposure(raw,level,index,catalog,economy){
  const strong=v022StrongMappings(raw),byCode=new Map();
  for(const m of strong){
    const code=String(m.sii_activity_code||''),sid=Number(m.uaf_sector_id);
    if(!catalog.byId.has(sid))continue;
    if(!byCode.has(code))byCode.set(code,new Map());
    const prev=byCode.get(code).get(sid);
    if(!prev||Number(m.mapping_confidence)>Number(prev.mapping_confidence))byCode.get(code).set(sid,m);
  }
  const rows=level==='region'?raw.activityRegion:raw.activityCommune,agg=new Map();
  for(const r of rows||[]){
    const maps=byCode.get(String(r.activity_code));if(!maps?.size)continue;
    const rn=v022RegionName(r.region);if(!rn)continue;let id=rn,name=rn;
    if(level==='commune'){const t=v022ResolveCommune(index,rn,r.commune);if(!t)continue;id=t.territory_id;name=t.canonical_name;}
    if(!agg.has(id))agg.set(id,{region:rn,name,bySector:new Map(),potential_total:0,weightedRisk:0,weightedMapping:0,started_2024:0});
    const a=agg.get(id),active=Number(r.active_entity_count)||0,started=Number(r.entities_started_since_2024)||0;
    for(const [sid,m] of maps){
      const c=catalog.byId.get(sid),prev=a.bySector.get(sid)||{sector_id:sid,name:c.sector_name,potential:0,started_2024:0,risk_0_100:c.risk_0_100,mapping_confidence:Number(m.mapping_confidence)||0};
      prev.potential+=active;prev.started_2024+=started;prev.mapping_confidence=Math.max(prev.mapping_confidence,Number(m.mapping_confidence)||0);a.bySector.set(sid,prev);
      a.potential_total+=active;a.weightedRisk+=active*Number(c.risk_0_100);a.weightedMapping+=active*(Number(m.mapping_confidence)||0);a.started_2024+=started;
    }
  }
  for(const [id,a] of agg){
    a.vulnerability=a.potential_total>0?a.weightedRisk/a.potential_total:null;
    a.mapping_quality=a.potential_total>0?100*a.weightedMapping/a.potential_total:null;
    a.top_sectors=[...a.bySector.values()].sort((x,y)=>y.potential-x.potential).slice(0,10);
    const e=economy.get(id);a.potential_per_1000=e?.active_entities>0?1000*a.potential_total/e.active_entities:null;
  }
  return agg;
}
function v032CoverageGap(exposure,uaf){
  if(!exposure?.bySector?.size)return {gap:null,potential:0,observed:0,covered:0,overhang:0,rows:[]};
  let potential=0,observed=0,covered=0,overhang=0;const rows=[];
  for(const s of exposure.bySector.values()){
    const o=uaf?.sectorCounts?.get(s.sector_id)||0,p=Number(s.potential)||0,c=Math.min(p,o),extra=Math.max(0,o-p);
    potential+=p;observed+=o;covered+=c;overhang+=extra;
    rows.push({...s,uaf_observed:o,covered:c,gap_count:Math.max(0,p-o),coverage_pct:p>0?100*c/p:null});
  }
  return {gap:potential>0?100*(potential-covered)/potential:null,potential,observed,covered,overhang,rows:rows.sort((a,b)=>b.gap_count-a.gap_count||b.potential-a.potential)};
}
function v032BuildLevel(raw,level,index,catalog,uafIndex){
  const economy=v022BuildEconomic(raw,level,index);const exposure=v032BuildSectorExposure(raw,level,index,catalog,economy);
  const cead=v022BuildCead(raw,level,index,economy),budget=v022BuildBudget(raw,level,index),cgr=v022BuildCgr(raw,level,index,economy);
  const context=level==='region'?v022BuildContext(raw,economy):new Map();
  const ipaByRegion=new Map((raw.ipaRegion||[]).map(x=>[v022RegionName(x.region)||x.region,x]));
  const uafMap=level==='region'?uafIndex.region:uafIndex.commune;
  const ids=new Set([...economy.keys(),...exposure.keys(),...cead.keys(),...uafMap.keys()]),out=[];
  for(const id of ids){
    const e=economy.get(id)||{},x=exposure.get(id)||null,d=cead.get(id)||null,u=uafMap.get(id)||null;
    const region=e.region||x?.region||d?.region||u?.region||(level==='region'?id:null),name=e.name||x?.name||d?.name||(level==='region'?region:id);
    const active=Number(e.active_entities);
    const densityRaw=raw.sourceStatus?.uafTerritory&&Number.isFinite(active)&&active>0?1000*(u?.uaf_observed||0)/active:null;
    const cov=v032CoverageGap(x,u);
    const parts={vulnerability:x?.vulnerability??null,density:null,gap:raw.sourceStatus?.uafTerritory?cov.gap:null,threat:d?.score??null};
    const fres=v032Mean([v032AgeScore(e.updated_at),v032AgeScore(u?.snapshot_generated_at),v032AgeScore(d?.year)]);
    const meta={density_raw_per_1000:densityRaw,coverage:cov,geo_quality:raw.sourceStatus?.uafTerritory?(u?.geo_coverage_pct??raw.uafTerritory?.[0]?.geo_coverage_pct??null):null,
      mapping_quality:x?.mapping_quality??null,freshness:fres};
    out.push({id,territory_id:e.territory_id||(level==='region'?`CL-REG-${V022_REGION_CODE[region]}`:id),level:level==='region'?'REGION':'COMMUNE',region,name,economy:e,
      exposure:x,uaf:u,cead:d,budget:budget.get(id)||null,cgr:cgr.get(id)||null,context:context.get(id)||null,ipa:level==='region'?(ipaByRegion.get(region)||null):null,
      parts,meta,irg:null,confidence:null});
  }
  v032Percentiles(out,r=>r.meta.density_raw_per_1000,(r,p)=>{r.parts.density=p;});
  for(const r of out){
    r.irg=v032StrictIRG(r.parts);r.confidence=v032Confidence(r.parts,r.meta);
    if(r.exposure){
      const covById=new Map((r.meta.coverage?.rows||[]).map(s=>[s.sector_id,s]));
      r.exposure.top_sectors=(r.exposure.top_sectors||[]).map(s=>({...s,...(covById.get(s.sector_id)||{})}));
    }
  }
  return out;
}
function v032Compute(raw){
  const index=v022TerritoryIndex(raw),catalog=v032Catalog(raw),uafIndex=v032UafIndex(raw,index,catalog);
  const regions=v032BuildLevel(raw,'region',index,catalog,uafIndex),communes=v032BuildLevel(raw,'commune',index,catalog,uafIndex);
  return {index,catalog,uafIndex,regions,communes};
}
v022Compute=v032Compute;

function v032Metric(row,key){if(!row)return null;if(key==='irg')return row.irg;return row.parts?.[key]??null;}
function v032MetricButtons(){return `<div class="v032-layer-buttons">${Object.entries(V032_LAYERS).map(([k,m])=>`<button type="button" data-v032-layer="${k}" class="${V032_STATE.layer===k?'active':''}"><b>${esc(m.short)}</b><span>${esc(m.label)}</span></button>`).join('')}</div>`;}
function v032Map(rows){
  if(typeof V030_CHILE==='undefined')return '<div class="v032-empty">Geometría regional no disponible.</div>';
  const byShape=new Map(rows.map(r=>[v032Shape(r.region),r]));
  const paths=V030_CHILE.order.map(shape=>{const r=byShape.get(shape),value=v032Metric(r,V032_STATE.layer),selected=r?.region===V032_STATE.selectedRegion;
    return `<path class="v032-region ${selected?'selected':''}" data-v032-region="${r?esc(r.region):''}" d="${esc(V030_CHILE.paths[shape])}" fill="${v032Color(value)}" tabindex="${r?'0':'-1'}"><title>${r?`${esc(r.region)} · ${esc(V032_LAYERS[V032_STATE.layer].short)} ${v032Num(value,1)}`:`${esc(shape)} · sin dato`}</title></path>`;}).join('');
  return `<svg class="v032-map" viewBox="${esc(V030_CHILE.viewBox)}" role="img" aria-label="Mapa IRG-LA/FT de Chile">${paths}</svg>`;
}
function v032Formula(){
  return `<section class="v032-formula"><div><span>MODELO PRINCIPAL · ${V032_METHOD}</span><h2>IRG-LA/FT</h2><p>Índice de Riesgo Geográfico LA/FT. Respeta la estructura y ponderaciones de la propuesta territorial original; no es probabilidad de delito ni atribución a una entidad.</p></div><div class="v032-formula-eq">IRG = <b>45%</b> V/E + <b>20%</b> Densidad SO + <b>20%</b> Brecha + <b>15%</b> Amenaza</div></section>`;
}
function v032SourceStrip(raw){
  const s=raw.sourceStatus||{};
  return `<div class="v032-source-strip"><span class="${s.irgSectorCatalog&&s.sectorMap?'ok':'miss'}">Vulnerabilidad sectorial</span><span class="${s.uafTerritory?'ok':'miss'}">UAF territorial</span><span class="${s.cead?'ok':'miss'}">CEAD</span><span class="${s.cgr?'context':'miss'}">CGR · evidencia</span><span class="${s.budget?'context':'partial'}">Presupuesto · evidencia</span><span class="${s.ipa?'context':'miss'}">IPA3/sanciones · evidencia</span><span class="${raw.contextRegion?.length?'context':'miss'}">Prensa/OSFL · contexto</span></div>`;
}
function v032Summary(regions){
  const valid=regions.filter(r=>v032Finite(r.irg)).sort((a,b)=>b.irg-a.irg);
  const gap=[...regions].filter(r=>v032Finite(r.parts.gap)).sort((a,b)=>b.parts.gap-a.parts.gap)[0];
  const threat=[...regions].filter(r=>v032Finite(r.parts.threat)).sort((a,b)=>b.parts.threat-a.parts.threat)[0];
  const dense=[...regions].filter(r=>v032Finite(r.meta.density_raw_per_1000)).sort((a,b)=>b.meta.density_raw_per_1000-a.meta.density_raw_per_1000)[0];
  const card=(label,r,value,sub)=>`<button type="button" ${r?`data-v032-region="${esc(r.region)}"`:''}><span>${esc(label)}</span><b>${r?esc(v031Short(r.region)):'—'}</b><small>${r?`${esc(value)} · ${esc(sub)}`:'sin dato comparable'}</small></button>`;
  return `<div class="v032-insights">${card('Mayor IRG',valid[0],valid[0]?v032Num(valid[0].irg,1):'',valid[0]?v032Band(valid[0].irg):'')}${card('Mayor brecha potencial',gap,gap?v032Pct(gap.parts.gap,1):'',gap?`${v032Num(gap.meta.coverage.potential,0)} presencias potenciales`:'')}${card('Mayor amenaza CEAD',threat,threat?v032Num(threat.parts.threat,1):'',threat?`${v032Num(threat.cead?.cases,0)} casos`:'')}${card('Mayor densidad observada SO',dense,dense?v032Num(dense.meta.density_raw_per_1000,1):'',dense?'SO por 1.000 activas SII':'')}</div>`;
}
function v032Components(r){
  const labels={vulnerability:['Vulnerabilidad / exposición','Riesgo inherente sectorial ponderado por presencia SII'],density:['Densidad de Sujetos Obligados','Percentil nacional de SO UAF observados por 1.000 entidades activas'],gap:['Brecha potencial de cobertura','Brecha UAF↔universo SII en homologaciones fuertes; screening, no incumplimiento'],threat:['Amenaza territorial','CEAD: 70% intensidad relativa + 30% tendencia positiva']};
  return `<div class="v032-components">${Object.entries(labels).map(([k,[label,desc]])=>{const v=r.parts[k],w=100*V032_WEIGHTS[k],c=v032Contribution(r,k);return `<article class="${v032Tone(v)}"><header><span>${esc(label)}</span><b>${v032Num(v,1)}</b></header><progress max="100" value="${v032Finite(v)?Number(v):0}"></progress><div><strong>Peso ${v032Num(w,0)}%</strong><em>Aporte ${v032Finite(c)?v032Num(c,1):'—'} pts IRG</em></div><small>${esc(desc)}</small></article>`;}).join('')}</div>`;
}
function v032ConfidencePanel(r){
  const c=r.confidence,inp=c?.inputs||{};
  return `<section class="v032-confidence"><div><span>CONFIANZA DEL RESULTADO</span><b>${v032Num(c?.score,0)}/100 · ${esc(c?.label||'—')}</b><small>Se calcula aparte del IRG; más datos no incrementan el riesgo.</small></div><dl><div><dt>Completitud · 35%</dt><dd>${v032Pct(inp.completeness)}</dd></div><div><dt>Calidad geográfica · 30%</dt><dd>${v032Pct(inp.geo,1)}</dd></div><div><dt>Mapeo sectorial · 20%</dt><dd>${v032Pct(inp.mapping,1)}</dd></div><div><dt>Actualidad · 15%</dt><dd>${v032Pct(inp.freshness,0)}</dd></div></dl></section>`;
}
function v032Dossier(r){
  if(!r)return '<aside class="v032-card v032-dossier"><div class="v032-empty">Selecciona una región.</div></aside>';
  return `<aside class="v032-card v032-dossier"><header><div><span>FICHA TERRITORIAL</span><h3>${esc(v031Short(r.region))}</h3><p>El resultado surge únicamente de las cuatro dimensiones del IRG. Las señales complementarias se muestran después y tienen aporte directo 0 al índice.</p></div><div class="v032-score ${v032Tone(r.irg)}"><span>IRG-LA/FT</span><b>${v032Num(r.irg,1)}</b><small>${esc(v032Band(r.irg))}</small></div></header>${v032Components(r)}${v032ConfidencePanel(r)}</aside>`;
}
function v032SectorPanel(r){
  if(!r)return '';
  const rows=r.meta.coverage?.rows||[];
  return `<section class="v032-card"><header class="v032-card-head"><div><span>VULNERABILIDAD / EXPOSICIÓN · 45%</span><h3>Qué sectores sostienen el componente</h3><p>El riesgo inherente proviene del catálogo sectorial de 55 actividades. Se pondera por presencias potenciales SII solo cuando la homologación UAF↔SII es VALIDATED_RULE.</p></div><b>${v032Num(r.parts.vulnerability,1)}</b></header><div class="v032-sector-grid">${rows.slice(0,8).map(s=>`<article><header><span>${esc(s.name)}</span><b>${v032Num(s.risk_0_100,0)}</b></header><dl><div><dt>Potencial SII</dt><dd>${v032Num(s.potential,0)}</dd></div><div><dt>SO UAF observados</dt><dd>${v032Num(s.uaf_observed,0)}</dd></div><div><dt>Cobertura proxy</dt><dd>${v032Pct(s.coverage_pct,0)}</dd></div><div><dt>Inicios 2024+</dt><dd>${v032Num(s.started_2024,0)}</dd></div></dl></article>`).join('')||'<div class="v032-empty">Sin homologaciones fuertes observadas.</div>'}</div><footer>Actividad SII ≠ condición jurídica de sujeto obligado. La brecha es una señal de screening y debe validarse contra registros especializados cuando existan.</footer></section>`;
}
function v032UafPanel(r){
  const u=r?.uaf,c=r?.meta?.coverage;
  if(!r)return '';
  return `<section class="v032-card v032-uaf-card"><header class="v032-card-head"><div><span>UAF · DENSIDAD Y COBERTURA</span><h3>Dos preguntas distintas</h3><p>Densidad mide concentración de SO observados; brecha contrasta el padrón localizado con el universo potencial SII de reglas fuertes.</p></div></header><div class="v032-uaf-grid"><div><span>SO UAF localizados</span><b>${v032Num(u?.uaf_observed||0,0)}</b><small>de ${v032Num(u?.uaf_source_total||V032_STATE.raw?.uafTerritory?.[0]?.uaf_source_total,0)} a nivel fuente</small></div><div><span>Densidad observada</span><b>${v032Num(r.meta.density_raw_per_1000,1)}</b><small>SO por 1.000 entidades activas SII · pctl ${v032Num(r.parts.density,1)}</small></div><div><span>Universo potencial validado</span><b>${v032Num(c?.potential,0)}</b><small>presencias sectoriales SII</small></div><div><span>Brecha potencial</span><b>${v032Pct(r.parts.gap,1)}</b><small>${v032Num(c?.covered,0)} cubiertas · ${v032Num(c?.overhang,0)} sobrehang diagnóstico</small></div></div><footer>La cobertura geográfica actual del padrón UAF es ${v032Pct(u?.geo_coverage_pct||V032_STATE.raw?.uafTerritory?.[0]?.geo_coverage_pct,2)}. Los registros sin territorio no se imputan a una región o comuna; esa limitación reduce la confianza.</footer></section>`;
}
function v032CeadPanel(r){
  if(!r)return '';
  const rows=typeof v0312CeadRows==='function'?v0312CeadRows(r.region):[];
  const total=rows.reduce((s,x)=>s+(Number(x.cases)||0),0),year=r.cead?.year||rows[0]?.year||'—';
  const cards=rows.map(x=>{const mapping=x.mappings?.[0]||'',subs=typeof v0312CeadCatalogSubgroups==='function'?v0312CeadCatalogSubgroups(mapping):[];
    return `<article><header><div><span>FAMILIA DELICTUAL</span><h4>${esc(x.category)}</h4></div><b>${v032Num(x.cases,0)}</b></header><div class="v032-cead-metrics"><span>${esc(String(x.year||year))} · ${v032Num(x.cases,0)} casos</span><span>${v032Finite(x.yoy)?`${Number(x.yoy)>=0?'+':''}${v032Num(x.yoy,1)}% interanual`:'variación no disponible'}</span><span>${v032Finite(x.share)?`${v032Num(x.share,1)}% del total regional`:''}</span></div>${subs.length?`<ul>${subs.map(s=>`<li><b>${esc(s.label)}</b><small>${esc(typeof v0312CeadClassLabel==='function'?v0312CeadClassLabel(s):'subtipo CEAD')}</small></li>`).join('')}</ul>`:'<p>Sin desglose adicional publicado en este corte.</p>'}</article>`;}).join('');
  const official=typeof V0312_CEAD_OFFICIAL!=='undefined'?V0312_CEAD_OFFICIAL:'https://cead.spd.gov.cl/estadisticas-delictuales/?r=1';
  const dataset=typeof V0312_CEAD_DATASET!=='undefined'?V0312_CEAD_DATASET:'https://github.com/smoralesm07-source/Radar_delictual/blob/radar-data/data/processed/cead_current_predicate_activity_v4.json';
  return `<section class="v032-card v032-cead"><header class="v032-card-head"><div><span>AMENAZA TERRITORIAL · 15%</span><h3>CEAD: delitos detrás del componente</h3><p>La amenaza conserva el cálculo gobernado: 70% percentil de intensidad y 30% percentil de tendencia positiva. Volumen y detalle quedan visibles para auditar el resultado.</p></div><div class="v032-links"><a href="${official}" target="_blank" rel="noopener noreferrer">CEAD oficial ↗</a><a href="${dataset}" target="_blank" rel="noopener noreferrer">Dataset usado ↗</a></div></header><div class="v032-cead-summary"><div><span>Casos ${esc(String(year))}</span><b>${v032Num(total||r.cead?.cases,0)}</b></div><div><span>Casos / 1.000 activas</span><b>${v032Num(r.cead?.cases_per_1000_entities,1)}</b></div><div><span>Percentil amenaza</span><b>${v032Num(r.parts.threat,1)}</b></div><div><span>Aporte IRG</span><b>${v032Num(v032Contribution(r,'threat'),1)}</b></div></div><div class="v032-cead-grid">${cards||'<div class="v032-empty">No hay detalle CEAD para esta región.</div>'}</div><footer>Los casos policiales describen presión territorial y no se atribuyen a personas o entidades ubicadas en el territorio.</footer></section>`;
}
function v032SecondarySignals(r){
  if(!r)return '';
  const marks=Array.isArray(r.ipa?.top_marks)?r.ipa.top_marks.slice(0,5):[];
  return `<section class="v032-card v032-secondary"><header class="v032-card-head"><div><span>SEÑALES Y EVIDENCIA COMPLEMENTARIA</span><h3>Contexto que orienta investigación, pero no altera el IRG</h3><p>Estas fuentes siguen disponibles para explicar fenómenos y abrir líneas de revisión. Su aporte directo a la fórmula es 0% porque la propuesta no les asignó una ponderación.</p></div><span class="v032-zero">APORTE IRG 0%</span></header><div class="v032-secondary-grid"><article><span>Presupuesto Abierto</span><b>${v032Num(r.budget?.p1_signals,0)} P1</b><small>${v032Num(r.budget?.anomaly_signals,0)} señales · prioridad media ${v032Num(r.budget?.avg_priority,1)}</small></article><article><span>CGR</span><b>${v032Num(r.cgr?.findings,0)} hallazgos</b><small>${v032Num(r.cgr?.high,0)} severidad alta · AML medio ${v032Num(r.cgr?.avg_aml_score,1)}</small></article><article><span>IPA3 / sanciones</span><b>${v032Num(r.ipa?.scored_entities,0)} entidades marcadas</b><small>${marks.length?marks.map(m=>m.mark_id).filter(Boolean).join(' · '):'sin marcas dominantes publicadas'}</small></article><article><span>OSFL</span><b>${v032Num(r.context?.osfl_count,0)}</b><small>presencia contextual; no señal adversa por sí misma</small></article><article><span>Prensa regional</span><b>${v032Num(r.context?.press_count,0)}</b><small>contexto OSINT; no acredita hechos</small></article></div></section>`;
}
function v032Comparator(rows){
  const sorted=[...rows].sort((a,b)=>(b.irg??-1)-(a.irg??-1));
  return `<section class="v032-card"><header class="v032-card-head"><div><span>COMPARADOR REGIONAL</span><h3>Las cuatro dimensiones del IRG, completas en una pantalla</h3><p>El orden se determina por IRG; un valor nulo no se reemplaza por cero.</p></div></header><div class="v032-comparator"><table><thead><tr><th>#</th><th>Región</th><th>IRG</th><th>V/E ·45%</th><th>Densidad ·20%</th><th>Brecha ·20%</th><th>Amenaza ·15%</th><th>Conf.</th></tr></thead><tbody>${sorted.map((r,i)=>`<tr data-v032-region="${esc(r.region)}"><td>${i+1}</td><td><b>${esc(v031Short(r.region))}</b></td><td><strong class="${v032Tone(r.irg)}">${v032Num(r.irg,1)}</strong><small>${esc(v032Band(r.irg))}</small></td><td>${v032Num(r.parts.vulnerability,1)}<small>${v032Num(v032Contribution(r,'vulnerability'),1)} pts</small></td><td>${v032Num(r.parts.density,1)}<small>${v032Num(r.meta.density_raw_per_1000,1)}/1.000</small></td><td>${v032Num(r.parts.gap,1)}<small>${v032Num(r.meta.coverage?.potential,0)} potencial</small></td><td>${v032Num(r.parts.threat,1)}<small>${v032Num(r.cead?.cases,0)} casos</small></td><td>${v032Num(r.confidence?.score,0)}<small>${esc(r.confidence?.label||'—')}</small></td></tr>`).join('')}</tbody></table></div></section>`;
}
function v032CommuneTable(r,communes){
  if(!r)return '';
  const rows=communes.filter(c=>c.region===r.region).sort((a,b)=>(b.irg??-1)-(a.irg??-1)).slice(0,12);
  return `<section class="v032-card"><header class="v032-card-head"><div><span>PROFUNDIZACIÓN COMUNAL</span><h3>Comunas prioritarias de ${esc(v031Short(r.region))}</h3><p>Usan la misma fórmula 45/20/20/15; no una metodología paralela.</p></div></header><div class="v032-comparator commune"><table><thead><tr><th>#</th><th>Comuna</th><th>IRG</th><th>V/E</th><th>Densidad</th><th>Brecha</th><th>Amenaza</th><th>Conf.</th></tr></thead><tbody>${rows.map((c,i)=>`<tr><td>${i+1}</td><td><b>${esc(c.name)}</b></td><td><strong class="${v032Tone(c.irg)}">${v032Num(c.irg,1)}</strong></td><td>${v032Num(c.parts.vulnerability,1)}</td><td>${v032Num(c.parts.density,1)}</td><td>${v032Num(c.parts.gap,1)}</td><td>${v032Num(c.parts.threat,1)}</td><td>${v032Num(c.confidence?.score,0)}</td></tr>`).join('')||'<tr><td colspan="8">Sin comunas comparables.</td></tr>'}</tbody></table></div></section>`;
}
function v032SectorMatrix(r,communes){
  if(!r)return '';
  const local=communes.filter(c=>c.region===r.region),totals=new Map();
  for(const c of local)for(const s of c.meta.coverage?.rows||[])totals.set(s.sector_id,(totals.get(s.sector_id)||0)+(Number(s.potential)||0));
  const sectors=[...totals].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([id])=>V032_STATE.computed.catalog.byId.get(id)).filter(Boolean);
  const rows=[...local].sort((a,b)=>(b.irg??-1)-(a.irg??-1)).slice(0,8);
  if(!sectors.length)return '';
  return `<section class="v032-card"><header class="v032-card-head"><div><span>MATRIZ SECTOR–COMUNA</span><h3>Dónde se concentra cada exposición sectorial</h3><p>No crea un score nuevo: cada celda muestra presencia potencial SII / SO UAF observados y conserva el riesgo inherente del catálogo como contexto.</p></div></header><div class="v032-matrix"><table><thead><tr><th>Comuna</th>${sectors.map(s=>`<th title="${esc(s.sector_name)}">${esc(s.sector_name.length>21?s.sector_name.slice(0,19)+'…':s.sector_name)}</th>`).join('')}</tr></thead><tbody>${rows.map(c=>{const by=new Map((c.meta.coverage?.rows||[]).map(s=>[s.sector_id,s]));return `<tr><td><b>${esc(c.name)}</b><small>IRG ${v032Num(c.irg,1)}</small></td>${sectors.map(sec=>{const s=by.get(sec.uaf_sector_id);return `<td title="${esc(sec.sector_name)} · riesgo inherente ${v032Num(sec.risk_0_100,0)}/100">${s?`<b>${v032Num(s.potential,0)} / ${v032Num(s.uaf_observed,0)}</b><small>R ${v032Num(sec.risk_0_100,0)}</small>`:'—'}</td>`;}).join('')}</tr>`;}).join('')}</tbody></table></div></section>`;
}
function v032MapCard(regions){
  const selected=regions.find(r=>r.region===V032_STATE.selectedRegion)||regions[0];
  const ranked=[...regions].filter(r=>v032Finite(v032Metric(r,V032_STATE.layer))).sort((a,b)=>Number(v032Metric(b,V032_STATE.layer))-Number(v032Metric(a,V032_STATE.layer))).slice(0,7);
  return `<section class="v032-map-grid"><div class="v032-card v032-map-card"><header class="v032-card-head"><div><span>MAPA GEOGRÁFICO</span><h3>${esc(V032_LAYERS[V032_STATE.layer].label)}</h3><p>Las capas corresponden exactamente a las dimensiones del modelo, no a scores paralelos.</p></div>${v032MetricButtons()}</header><div class="v032-map-layout"><div class="v032-map-stage">${v032Map(regions)}<div class="v032-legend"><span>0</span><i></i><span>100</span></div></div><div class="v032-map-ranking">${ranked.map((r,i)=>`<button type="button" data-v032-region="${esc(r.region)}" class="${r.region===V032_STATE.selectedRegion?'active':''}"><em>${i+1}</em><span><b>${esc(v031Short(r.region))}</b><small>${esc(v032Band(r.irg))}</small></span><strong>${v032Num(v032Metric(r,V032_STATE.layer),1)}</strong></button>`).join('')}</div></div></div>${v032Dossier(selected)}</section>`;
}
function v032ExportRows(level){
  const rows=level==='region'?V032_STATE.computed.regions:V032_STATE.computed.communes;
  return rows.map(r=>({territory_id:r.territory_id,territory_level:r.level,region:r.region,territory_name:r.name,indicator:'IRG-LA/FT',method_version:V032_METHOD,
    irg:v032Finite(r.irg)?Number(r.irg.toFixed(4)):null,risk_band:v032Band(r.irg),
    vulnerability_exposure:r.parts.vulnerability,density_so_percentile:r.parts.density,coverage_gap_potential:r.parts.gap,territorial_threat:r.parts.threat,
    contribution_vulnerability:v032Contribution(r,'vulnerability'),contribution_density:v032Contribution(r,'density'),contribution_gap:v032Contribution(r,'gap'),contribution_threat:v032Contribution(r,'threat'),
    confidence_score:r.confidence?.score??null,confidence_label:r.confidence?.label??null,completeness:r.confidence?.inputs?.completeness??null,geographic_quality:r.confidence?.inputs?.geo??null,mapping_quality:r.confidence?.inputs?.mapping??null,freshness:r.confidence?.inputs?.freshness??null,
    active_entities:r.economy?.active_entities??null,uaf_observed:r.uaf?.uaf_observed??0,uaf_density_per_1000:r.meta?.density_raw_per_1000??null,potential_sector_presences:r.meta?.coverage?.potential??null,uaf_covered_presences:r.meta?.coverage?.covered??null,
    cead_cases:r.cead?.cases??null,cead_yoy_pct:r.cead?.yoy_pct??null,
    budget_p1_context:r.budget?.p1_signals??null,cgr_findings_context:r.cgr?.findings??null,osfl_context:r.context?.osfl_count??null,press_context:r.context?.press_count??null,
    guardrail:'TERRITORIAL_PRIORITY_NOT_ENTITY_ATTRIBUTION'}));
}
function v032Csv(rows){if(!rows.length)return '';const cols=Object.keys(rows[0]),q=v=>{if(v===null||v===undefined)return '';const s=String(v);return /[",\n]/.test(s)?`"${s.replaceAll('"','""')}"`:s;};return [cols.join(','),...rows.map(r=>cols.map(c=>q(r[c])).join(','))].join('\n');}
function v032Download(name,text,type){const b=new Blob([text],{type}),url=URL.createObjectURL(b),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);}
function v032ExportCsv(){v032Download(`irg_laft_territorial_${new Date().toISOString().slice(0,10)}.csv`,v032Csv([...v032ExportRows('region'),...v032ExportRows('commune')]),'text/csv;charset=utf-8');}
function v032ExportJson(){
  const payload={schema:'IRG_LAFT_TERRITORIAL_V1',generated_at:new Date().toISOString(),method:{version:V032_METHOD,formula:'0.45*VULNERABILITY_EXPOSURE + 0.20*SO_DENSITY + 0.20*COVERAGE_GAP + 0.15*TERRITORIAL_THREAT',weights:V032_WEIGHTS,confidence_formula:'0.35*COMPLETENESS + 0.30*GEOGRAPHIC_QUALITY + 0.20*MAPPING_QUALITY + 0.15*FRESHNESS',confidence_weights:V032_CONF_WEIGHTS},
    semantics:'TERRITORIAL_RISK_PRIORITIZATION_NOT_ENTITY_AML_PROBABILITY',secondary_sources_direct_weight:0,guardrails:['MISSING_IS_NOT_ZERO_STRICT','SII_ACTIVITY_IS_NOT_UAF_LEGAL_STATUS','UAF_UNLOCATED_RECORDS_ARE_NOT_IMPUTED','CEAD_CASES_ARE_TERRITORIAL_NOT_ENTITY_ATTRIBUTION','CGR_BUDGET_IPA_PRESS_OSFL_DO_NOT_RECEIVE_INVENTED_IRG_WEIGHTS'],
    region_rows:v032ExportRows('region'),commune_rows:v032ExportRows('commune')};
  v032Download(`irg_laft_territorial_${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(payload,null,2),'application/json;charset=utf-8');
}
function v032Bind(root){
  root.querySelectorAll('[data-v032-layer]').forEach(b=>b.addEventListener('click',()=>{V032_STATE.layer=b.dataset.v032Layer;v032Render();}));
  root.querySelectorAll('[data-v032-region]').forEach(b=>{const go=()=>{if(b.dataset.v032Region){V032_STATE.selectedRegion=b.dataset.v032Region;v032Render();}};b.addEventListener('click',go);b.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}});});
  root.querySelector('#v032-export-csv')?.addEventListener('click',v032ExportCsv);root.querySelector('#v032-export-json')?.addEventListener('click',v032ExportJson);
}
function v032Render(){
  const root=v019Content();if(!root||!V032_STATE.computed)return;
  const {regions,communes}=V032_STATE.computed,selected=regions.find(r=>r.region===V032_STATE.selectedRegion)||regions[0];if(selected)V032_STATE.selectedRegion=selected.region;
  root.innerHTML=`<section class="v032-hero"><div><span>RIESGO GEOGRÁFICO · MODELO TERRITORIAL</span><h1>Índice de Riesgo Geográfico LA/FT</h1><p>Una sola lógica de cálculo, cuatro dimensiones y evidencia auditable. Se abandona el esquema IPT/Score B como indicador principal del módulo.</p></div><div class="v032-actions"><button type="button" id="v032-export-csv">Exportar CSV</button><button type="button" id="v032-export-json">Exportar JSON + metodología</button></div></section>
    ${v032Formula()}${v032SourceStrip(V032_STATE.raw)}${v032Summary(regions)}${v032MapCard(regions)}
    ${v032UafPanel(selected)}${v032SectorPanel(selected)}${v032CeadPanel(selected)}${v032SecondarySignals(selected)}
    ${v032Comparator(regions)}${v032CommuneTable(selected,communes)}${v032SectorMatrix(selected,communes)}
    <section class="v032-method-note"><b>Lectura metodológica</b><span>IRG solo se calcula cuando las cuatro dimensiones están disponibles. No se renormalizan pesos por ausencia de una fuente. La confianza se informa aparte y nunca aumenta el riesgo. CGR, Presupuesto, IPA3/sanciones, prensa y OSFL permanecen como evidencia/contexto con peso directo 0%.</span></section>`;
  v032Bind(root);
}
v022Render=v032Render;

async function v032LoadTerritory(){
  state.view='territory';shell('Riesgo geográfico','IRG-LA/FT · vulnerabilidad/exposición, densidad SO, brecha de cobertura y amenaza territorial');
  const root=v019Content();root.innerHTML='<div class="v019-loading">Construyendo IRG-LA/FT con la metodología territorial original…</div>';
  try{
    const raw=await v032LoadRaw();V032_STATE.raw=raw;V022_STATE.data=raw;
    const computed=v032Compute(raw);V032_STATE.computed=computed;V022_STATE.computed=computed;
    v032Render();
  }catch(error){console.error('v0.32 IRG territorial',error);root.innerHTML=`<div class="v019-empty"><b>No fue posible construir IRG-LA/FT.</b><br>${esc(String(error?.message||error))}</div>`;}
}
v019LoadTerritory=v032LoadTerritory;

window.AML_IRG_TERRITORY={version:V032_METHOD,weights:V032_WEIGHTS,confidenceWeights:V032_CONF_WEIGHTS,state:V032_STATE,compute:v032Compute,render:v032Render};
v032ApplyVersion();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',v032ApplyVersion,{once:true});
else setTimeout(v032ApplyVersion,0);
