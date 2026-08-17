'use strict';

/* AML Workbench v0.25.0 · Geographic Risk B + IPA 3.0
 * - Reweights regional method B with a governed IPA3 mark-pressure percentile.
 * - Consumes a compact regional snapshot; never computes entity IPA3 live in Territory.
 * - Keeps IPA3 shadow semantics: analytical priority, not LA/FT probability.
 * - Keeps press, OSFL and economic capacity as context/exposure.
 */
const V025='0.25.0';
const V025_METHOD_VERSION='GEO-RISK-B-0.25.0';
const V025_IPA_VIEW='aml_v023_geo_ipa_region';
const V025_B_REGION_WEIGHTS={sector:17,cead:25.5,budget:21.25,cgr:12.75,cross:8.5,ipa:15};
const V025_B_BASE_WEIGHTS={sector:20,cead:30,budget:25,cgr:15,cross:10};

const V025_MARKS={
  M00:{label:'Entidad inscrita como sujeto obligado UAF',kind:'context',desc:'Rol regulatorio. Ser sujeto obligado no implica riesgo y esta marca aporta 0 al IPA.'},
  M01:{label:'SO UAF con término de giro publicado en SII',kind:'scoring',desc:'Desalineación registral entre inscripción UAF y término de giro SII. Es una señal de revisión, no prueba de incumplimiento.'},
  M02:{label:'Posible desalineación de actividad UAF–SII',kind:'blocked',desc:'Marca pendiente de un crosswalk temporal UAF–SII validado; actualmente no puntúa.'},
  M03:{label:'Contracción económica significativa',kind:'scoring',desc:'Caída material de ventas y/o dotación, con reglas conservadoras y factor de recencia.'},
  M04:{label:'Expansión económica significativa',kind:'scoring',desc:'Aumento material de ventas y/o dotación. Puede ser absorbida por una marca compuesta más específica.'},
  M05:{label:'Entidad joven con crecimiento extraordinario',kind:'scoring',desc:'Entidad de hasta 2 años con salto de ventas de al menos 2 tramos y percentil 95 o superior frente a pares. Absorbe M04 cuando comparte evidencia.'},
  M06:{label:'Cambio abrupto de ventas respecto de pares',kind:'diagnostic',desc:'Cambio de tramo de ventas inusual frente a pares. Está en redefinición diagnóstica y no puntúa en IPA3 v0.3.'},
  M07:{label:'Dispersión o cambio anómalo de domicilios',kind:'blocked',desc:'Proxy estructural aún sin temporalidad suficiente; no está habilitada para scoring.'},
  M08:{label:'Diversificación acelerada de actividades',kind:'blocked',desc:'Proxy estructural aún sin trayectoria temporal validada; no está habilitada para scoring.'},
  M09:{label:'Entidad joven con contratación estatal elevada',kind:'blocked',desc:'Requiere materialización contractual entity-level de Presupuesto Abierto antes de puntuar.'},
  M10:{label:'Crecimiento posterior a contratación pública relevante',kind:'blocked',desc:'Requiere secuencia contractual proveedor–tiempo validada; no puntúa actualmente.'},
  M11:{label:'Alta concentración de contratación en un organismo',kind:'blocked',desc:'Requiere universo contractual entity-level para medir concentración y materialidad.'},
  M12:{label:'Crecimiento abrupto de contratación pública',kind:'blocked',desc:'Requiere longitudinalidad contractual entity-level; no puntúa actualmente.'},
  M13:{label:'Entidad reciente con rápida expansión entre organismos',kind:'blocked',desc:'Requiere diversidad y velocidad de compradores públicos por entidad.'},
  M14:{label:'Proveedor vinculado a antecedente CGR',kind:'context',desc:'Contexto documental: no transfiere a un proveedor el riesgo de un organismo o proceso observado por CGR.'},
  M15:{label:'Entidad individualizada directamente por CGR',kind:'blocked',desc:'Requiere identidad entity-level CGR con confianza alta antes de habilitar scoring.'},
  M16:{label:'Recurrencia sancionatoria',kind:'scoring',desc:'Dos o más procedimientos confirmados y deduplicados en 36 meses, o tres en 60 meses. M18 la absorbe cuando existe multirregulador.'},
  M17:{label:'Sanción directamente relacionada con AML/LAFT',kind:'diagnostic',desc:'Candidato sujeto a revisión semántica de cargo, obligación y base legal; el flag documental por sí solo no puntúa.'},
  M18:{label:'Convergencia sancionatoria multirregulador',kind:'scoring',desc:'Procedimientos sancionatorios confirmados de al menos dos reguladores independientes en 60 meses. Absorbe M16.'},
  M19:{label:'OSFL reciente con crecimiento económico acelerado',kind:'scoring',desc:'OSFL de hasta 3 años con salto de ventas de al menos 2 tramos y percentil 95 o superior frente a pares. Absorbe M04 cuando reutiliza la trayectoria.'},
  M20:{label:'OSFL con contratación pública material',kind:'blocked',desc:'Pendiente de materialidad contractual comparable para OSFL.'},
  M21:{label:'OSFL con complejidad relacional elevada',kind:'blocked',desc:'Requiere grafo entity-level gobernado; no se propaga riesgo desde vecinos o relaciones.'},
  M22:{label:'Territorio con aumento de delitos base elegibles',kind:'context',desc:'Presión delictual territorial elegible. No atribuye delitos a empresas o residentes y aporta 0 al IPA de entidad.'},
  M23:{label:'Expansión hacia territorios con mayor presión delictual',kind:'context',desc:'Contexto territorial de expansión; requiere secuencia de presencia y no atribuye conducta delictiva.'},
  M24:{label:'Recurrencia pública multifuente en fenómeno gobernado',kind:'context',desc:'Contexto de fuentes abiertas. Prensa y recurrencia pública no acreditan hechos ni incrementan IPA sustantivo.'}
};

V022_METHODS.B.name='Percentil robusto + IPA3';
V022_METHODS.B.tag='recomendado';
V022_METHODS.B.note='Score regional: conserva 85% de la estructura B original y asigna 15% al percentil de presión de marcas IPA3 v0.3. IPA3 ya aplica caps, recencia, absorción y convergencia entre grupos; no se vuelven a contar alertas. El ajuste IPA aplica por región; las comunas mantienen B territorial hasta contar con materialización IPA comunal.';
V022_METHODS.B.regionWeights=V025_B_REGION_WEIGHTS;
V022_LAYERS.ipa={label:'Marcas IPA3',kind:'risk'};

const v025BaseShell=shell;
const v025BaseLoadRaw=v022LoadRaw;
const v025BaseCompute=v022Compute;
const v025BaseSources=v022Sources;
const v025BaseRegionDetail=v022RegionDetail;
const v025BaseRender=v022Render;
const v025BaseExportRows=v022ExportRows;

function v025ApplyVersion(){
  try{
    if(typeof V0206_VERSION_OBSERVER!=='undefined'&&V0206_VERSION_OBSERVER){V0206_VERSION_OBSERVER.disconnect();V0206_VERSION_OBSERVER=null;}
  }catch{}
  const label=`Operational Radar · v${V025}`;
  const badge=document.querySelector('.v019-brand small');
  if(badge){badge.textContent=label;badge.setAttribute('aria-label',label);}
  document.title=`AML Analytical Workbench · v${V025}`;
  document.documentElement.setAttribute('data-aml-build',V025);
}

shell=function(title,subtitle){v025BaseShell(title,subtitle);v025ApplyVersion();};
if(typeof v0211ApplyVersion==='function')v0211ApplyVersion=v025ApplyVersion;

function v025Num(v,d=1){const n=Number(v);return Number.isFinite(n)?n.toLocaleString('es-CL',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';}
function v025Signed(v,d=1){const n=Number(v);return Number.isFinite(n)?`${n>0?'+':''}${v025Num(n,d)}`:'—';}
function v025MarkMeta(id){return V025_MARKS[id]||{label:id||'Marca',kind:'diagnostic',desc:'Marca gobernada del catálogo IPA.'};}
function v025MarkTitle(id){const m=v025MarkMeta(id);const suffix=m.kind==='scoring'?'Puntúa cuando cumple las reglas IPA3.':m.kind==='context'?'Contexto: aporte IPA directo = 0.':m.kind==='blocked'?'No habilitada para scoring en el corte actual.':'Diagnóstica: no puntúa en IPA3 v0.3.';return `${id} · ${m.label}. ${m.desc} ${suffix}`;}
function v025MarkChip(mark,showCount=false){
  const id=typeof mark==='string'?mark:mark?.mark_id;if(!id)return '';
  const meta=v025MarkMeta(id),count=Number(mark?.entity_count),share=Number(mark?.share_pct);
  const extra=showCount&&Number.isFinite(count)?`<small>${v025Num(count,0)} · ${Number.isFinite(share)?v025Num(share,1)+'%':'—'}</small>`:'';
  const title=v025MarkTitle(id);
  return `<span class="v025-mark-chip ${esc(meta.kind)}" tabindex="0" title="${esc(title)}" aria-label="${esc(title)}"><b>${esc(id)}</b>${extra}</span>`;
}
function v025MarkList(row,n=3,showCount=false){const marks=Array.isArray(row?.ipa?.top_marks)?row.ipa.top_marks:[];return marks.length?marks.slice(0,n).map(m=>v025MarkChip(m,showCount)).join(''):'<span class="v025-muted">—</span>';}

v022LoadRaw=async function(){
  const raw=await v025BaseLoadRaw();
  if(Array.isArray(raw.ipaRegion)){raw.sourceStatus={...(raw.sourceStatus||{}),ipa:true};return raw;}
  try{
    raw.ipaRegion=await v022FetchAll(V025_IPA_VIEW,'region,entity_universe,scored_entities,scored_per_10k,high_entities,high_per_10k,very_high_entities,multi_group_entities,multi_group_per_10k,ipa_pressure_mean_all,avg_ipa_scored,max_ipa,registry_pressure_mean_all,economic_pressure_mean_all,sanctions_pressure_mean_all,avg_score_confidence_pct,avg_coverage_index_pct,top_marks,score_version,snapshot_generated_at');
    raw.sourceStatus={...(raw.sourceStatus||{}),ipa:true};
  }catch(error){
    console.warn('v0.25 IPA regional snapshot unavailable',error);
    raw.ipaRegion=[];raw.sourceStatus={...(raw.sourceStatus||{}),ipa:false};
  }
  return raw;
};

function v025IpaRecord(r){
  if(!r)return null;
  const num=k=>Number.isFinite(Number(r[k]))?Number(r[k]):null;
  return {...r,entity_universe:num('entity_universe'),scored_entities:num('scored_entities'),scored_per_10k:num('scored_per_10k'),high_entities:num('high_entities'),high_per_10k:num('high_per_10k'),very_high_entities:num('very_high_entities'),multi_group_entities:num('multi_group_entities'),multi_group_per_10k:num('multi_group_per_10k'),ipa_pressure_mean_all:num('ipa_pressure_mean_all'),avg_ipa_scored:num('avg_ipa_scored'),max_ipa:num('max_ipa'),registry_pressure_mean_all:num('registry_pressure_mean_all'),economic_pressure_mean_all:num('economic_pressure_mean_all'),sanctions_pressure_mean_all:num('sanctions_pressure_mean_all'),avg_score_confidence_pct:num('avg_score_confidence_pct'),avg_coverage_index_pct:num('avg_coverage_index_pct'),top_marks:Array.isArray(r.top_marks)?r.top_marks:[]};
}
function v025RegionCoverage(parts,raw){
  const weights={sector:17,cead:25.5,budget:21.25,cgr:12.75,ipa:15,context:8.5};let have=0,total=0;
  for(const [k,w] of Object.entries(weights)){
    total+=w;
    if(k==='context'){if(raw.sourceStatus?.territories&&raw.contextRegion?.length)have+=w;}
    else if(Number.isFinite(Number(parts[k])))have+=w;
  }
  return total?100*have/total:0;
}
function v025PrimaryDriver(parts){
  const labels={sector:'Sectores 19.913',cead:'CEAD',budget:'Presupuesto',cgr:'CGR',ipa:'Marcas IPA3'};
  const valid=Object.keys(labels).map(k=>({key:k,label:labels[k],value:Number(parts[k])})).filter(x=>Number.isFinite(x.value)).sort((a,b)=>b.value-a.value);
  return valid[0]||null;
}
function v025Elevated(parts){return ['sector','cead','budget','cgr','ipa'].filter(k=>Number.isFinite(Number(parts[k]))&&Number(parts[k])>=60);}

v022Compute=function(raw){
  const computed=v025BaseCompute(raw);
  const ipaByRegion=new Map((raw.ipaRegion||[]).map(x=>[v022RegionName(x.region)||x.region,v025IpaRecord(x)]));
  for(const r of computed.regions){
    r.ipa=ipaByRegion.get(r.region)||null;
    r.ipa_metric=r.ipa?.ipa_pressure_mean_all??null;
    r.score_b_without_ipa=v022Weighted(r.parts,V025_B_BASE_WEIGHTS);
  }
  v022PercentileMap(computed.regions,'ipa_metric','ipa_percentile');
  for(const r of computed.regions){
    if(r.ipa&&Number.isFinite(Number(r.ipa_metric))){r.ipa.score=r.ipa_percentile;r.parts.ipa=r.ipa_percentile;}else{r.parts.ipa=null;}
    r.scores.B=v022Weighted(r.parts,V025_B_REGION_WEIGHTS);
    r.score_b_ipa_delta=Number.isFinite(Number(r.scores.B))&&Number.isFinite(Number(r.score_b_without_ipa))?r.scores.B-r.score_b_without_ipa:null;
    r.primary_driver=v025PrimaryDriver(r.parts);
    r.elevated_components=v025Elevated(r.parts);
    r.coverage=v025RegionCoverage(r.parts,raw);
    r.confidence=r.coverage>=90?'ALTA':r.coverage>=75?'MEDIA':'BAJA';
    r.fit_for_secure_matrix=r.coverage>=80&&['sector','cead','budget','cgr','ipa'].every(k=>Number.isFinite(Number(r.parts[k])));
    r.export_status=r.fit_for_secure_matrix?'APTO':'PROVISIONAL_NO_APTO';
  }
  return computed;
};

v022ComponentRows=function(row){
  const labels={sector:'Sectores 19.913',cead:'Delictual CEAD',budget:'Presupuesto',cgr:'Hallazgos CGR',ipa:'Marcas IPA3',cross:'Convergencia',press:'Prensa',osfl:'OSFL'};
  return Object.entries(labels).map(([k,label])=>{const v=row.parts[k];return `<div class="v022-component ${k==='ipa'?'v025-ipa-component':''}"><span>${esc(label)}</span><progress max="100" value="${Number.isFinite(Number(v))?Number(v):0}"></progress><b>${v022Fmt(v,1)}</b></div>`;}).join('');
};

v022Sources=function(raw){
  const s=raw.sourceStatus||{},budget=s.budget?'materializado':s.budgetPreview?'preview parcial':'no disponible';
  return `<div class="v022-source-strip"><span class="${s.sectorMap?'ok':'miss'}">Context Hub</span><span class="${s.cead?'ok':'miss'}">CEAD</span><span class="${s.budget?'ok':'partial'}">Presupuesto · ${esc(budget)}</span><span class="${s.cgr?'ok':'miss'}">CGR</span><span class="${raw.contextRegion?.length?'ok':'miss'}">Prensa/OSFL</span><span class="${s.ipa?'ok':'miss'}">IPA3 marcas · v0.3 shadow</span></div>`;
};

function v025MetricCell(score,detail){return `<span class="v025-metric-score">${v022Fmt(score,1)}</span><small>${detail||'—'}</small>`;}
function v025CeadDetail(r){const cases=Number(r.cead?.cases),yoy=Number(r.cead?.yoy_pct);return `${Number.isFinite(cases)?v025Num(cases,0)+' casos':'sin casos comparables'}${Number.isFinite(yoy)?` · ${v025Signed(yoy,1)}%` :''}`;}
function v025BudgetDetail(r){const p1=Number(r.budget?.p1_signals);return Number.isFinite(p1)?`P1 ${v025Num(p1,0)}`:'fuente no materializada';}
function v025CgrDetail(r){const n=Number(r.cgr?.findings);return Number.isFinite(n)?`${v025Num(n,0)} hallazgos 2020+`:'sin métrica comparable';}
function v025SectorDetail(r){const n=Number(r.sector?.started_2024);return Number.isFinite(n)?`${v025Num(n,0)} inicios desde 2024`:'sin métrica comparable';}

v022Ranking=function(regions){
  const method=V022_STATE.method,rows=[...regions].sort((a,b)=>(b.scores[method]??-1)-(a.scores[method]??-1));
  return `<div class="v022-tablewrap v025-ranking-wrap"><table class="v025-risk-table"><thead><tr><th>#</th><th>Región</th><th>Score ${esc(method)}</th><th>Δ IPA</th><th>Marcas IPA3</th><th>IPA</th><th>Sector 19.913</th><th>CEAD</th><th>Presupuesto</th><th>CGR</th><th>Conv.</th><th>Cob.</th></tr></thead><tbody>${rows.map((r,i)=>{
    const delta=method==='B'?r.score_b_ipa_delta:null,deltaCls=Number(delta)>0?'up':Number(delta)<0?'down':'flat';
    return `<tr data-georisk-region="${esc(r.region)}"><td>${i+1}</td><td><b>${esc(r.region)}</b><small class="v025-driver">${r.primary_driver?`driver: ${esc(r.primary_driver.label)}`:'sin driver'}</small></td><td>${v022ScoreBadge(r.scores[method])}</td><td><span class="v025-delta ${deltaCls}">${method==='B'?v025Signed(delta,1):'—'}</span><small>${method==='B'?'vs B sin IPA':'solo B'}</small></td><td><div class="v025-mark-inline">${v025MarkList(r,3,false)}</div></td><td>${v025MetricCell(r.parts.ipa,r.ipa?`${v025Num(r.ipa.scored_per_10k,1)}/10k con marca`:'sin snapshot')}</td><td>${v025MetricCell(r.parts.sector,v025SectorDetail(r))}</td><td>${v025MetricCell(r.parts.cead,v025CeadDetail(r))}</td><td>${v025MetricCell(r.parts.budget,v025BudgetDetail(r))}</td><td>${v025MetricCell(r.parts.cgr,v025CgrDetail(r))}</td><td>${v025MetricCell(r.parts.cross,`${r.elevated_components?.length||0}/5 capas ≥60`)}</td><td><span class="v025-coverage">${v022Fmt(r.coverage,0)}%</span><small>${esc(r.confidence)}</small></td></tr>`;
  }).join('')}</tbody></table></div>`;
};

function v025ChartRows(rows,max,formatter){
  if(!rows.length)return '<div class="v025-chart-empty">Sin datos comparables.</div>';
  const den=Math.max(Number(max)||0,1);
  return `<div class="v025-mini-bars">${rows.map(x=>`<div><span>${esc(v019RegionShort(x.region))}</span><progress max="${den}" value="${Math.max(0,Number(x.value)||0)}"></progress><b>${formatter?formatter(x):v025Num(x.value,1)}</b></div>`).join('')}</div>`;
}
function v025NationalMarks(regions){
  const m=new Map();for(const r of regions)for(const mark of r.ipa?.top_marks||[]){const id=mark.mark_id;if(!id)continue;m.set(id,(m.get(id)||0)+(Number(mark.entity_count)||0));}
  return [...m].map(([id,count])=>({id,count,meta:v025MarkMeta(id)})).sort((a,b)=>b.count-a.count);
}
function v025ConvergenceRows(regions){return regions.map(r=>({region:r.region,value:r.elevated_components?.length||0,score:r.scores.B,labels:(r.elevated_components||[]).join(', ')})).sort((a,b)=>b.value-a.value||Number(b.score)-Number(a.score)).slice(0,5);}

v022Kpis=function(regions){
  const valid=regions.filter(r=>Number.isFinite(Number(r.scores.B)));
  const impacts=valid.filter(r=>Number.isFinite(Number(r.score_b_ipa_delta))).map(r=>({region:r.region,value:Math.abs(r.score_b_ipa_delta),signed:r.score_b_ipa_delta})).sort((a,b)=>b.value-a.value).slice(0,5);
  const pressure=valid.filter(r=>Number.isFinite(Number(r.ipa?.ipa_pressure_mean_all))).map(r=>({region:r.region,value:r.ipa.ipa_pressure_mean_all,pct:r.parts.ipa,rate:r.ipa.scored_per_10k})).sort((a,b)=>b.value-a.value).slice(0,5);
  const marks=v025NationalMarks(valid).slice(0,5),conv=v025ConvergenceRows(valid);
  const maxImpact=Math.max(1,...impacts.map(x=>x.value)),maxPressure=Math.max(1,...pressure.map(x=>x.value)),maxMark=Math.max(1,...marks.map(x=>x.count));
  return `<section class="v025-insights">
    <article><div class="v025-insight-head"><span>HALLAZGO</span><h4>Impacto IPA sobre Score B</h4><small>mayor cambio absoluto</small></div>${v025ChartRows(impacts,maxImpact,x=>v025Signed(x.signed,1))}<p>${impacts[0]?`${esc(impacts[0].region)} cambia ${v025Signed(impacts[0].signed,1)} puntos frente a B sin IPA.`:'Sin comparación disponible.'}</p></article>
    <article><div class="v025-insight-head"><span>PRESIÓN IPA3</span><h4>Marcas por universo regional</h4><small>score IPA agregado / entidad</small></div>${v025ChartRows(pressure,maxPressure,x=>`${v025Num(x.pct,0)} pctl`)}<p>${pressure[0]?`${esc(pressure[0].region)}: ${v025Num(pressure[0].rate,1)} entidades con marca scoring por 10 mil.`:'Sin snapshot IPA regional.'}</p></article>
    <article><div class="v025-insight-head"><span>CATÁLOGO</span><h4>Marcas conductoras nacionales</h4><small>driver dominante por entidad</small></div><div class="v025-mark-bars">${marks.length?marks.map(x=>`<div><span>${v025MarkChip(x.id,false)}<em>${esc(x.meta.label)}</em></span><progress max="${maxMark}" value="${x.count}"></progress><b>${v025Num(x.count,0)}</b></div>`).join(''):'<div class="v025-chart-empty">Sin marcas.</div>'}</div><p>${marks[0]?`${esc(marks[0].id)} es el driver dominante más frecuente del corte; pasar el mouse sobre la marca muestra su definición.`:'Sin marcas disponibles.'}</p></article>
    <article><div class="v025-insight-head"><span>CONVERGENCIA</span><h4>Capas de riesgo elevadas</h4><small>Sector · CEAD · Presupuesto · CGR · IPA</small></div>${v025ChartRows(conv,5,x=>`${v025Num(x.value,0)}/5`)}<p>${conv[0]?`${esc(conv[0].region)} concentra ${v025Num(conv[0].value,0)} capas en percentil ≥60; la convergencia no duplica la evidencia IPA interna.`:'Sin convergencia comparable.'}</p></article>
  </section>`;
};

function v025IpaPanel(row){
  if(!row?.ipa)return `<section class="v025-ipa-panel missing"><div><span>IPA 3.0 · SHADOW</span><h3>Presión de marcas no disponible</h3><p>El componente queda nulo; ausencia de dato no se interpreta como riesgo cero.</p></div></section>`;
  const i=row.ipa;
  return `<section class="v025-ipa-panel"><div class="v025-ipa-title"><div><span>IPA 3.0 · SHADOW · APORTE REGIONAL MÁX. 15%</span><h3>Presión de marcas gobernadas</h3><p>Percentil regional calculado desde la suma de IPA3 de entidad sobre el universo regional completo. IPA3 ya aplica caps, recencia, absorción de correlaciones y convergencia limitada entre grupos.</p></div><strong>${v025Num(row.parts.ipa,1)}<small>percentil</small></strong></div>
    <div class="v025-ipa-stats"><div><span>Entidades con marca</span><b>${v025Num(i.scored_entities,0)}</b><small>${v025Num(i.scored_per_10k,1)} / 10 mil</small></div><div><span>Prioridad alta+</span><b>${v025Num(i.high_entities,0)}</b><small>${v025Num(i.high_per_10k,1)} / 10 mil</small></div><div><span>IPA medio marcadas</span><b>${v025Num(i.avg_ipa_scored,1)}</b><small>máx. ${v025Num(i.max_ipa,1)}</small></div><div><span>Convergencia grupos</span><b>${v025Num(i.multi_group_entities,0)}</b><small>${v025Num(i.multi_group_per_10k,1)} / 10 mil</small></div></div>
    <div class="v025-ipa-body"><div><h4>Marcas que conducen el territorio</h4><div class="v025-mark-detail">${(i.top_marks||[]).map(m=>`<div>${v025MarkChip(m,true)}<span>${esc(v025MarkMeta(m.mark_id).label)}</span><b>IPA μ ${v025Num(m.avg_entity_ipa,1)}</b></div>`).join('')||'<div class="v025-chart-empty">Sin marcas scoring dominantes.</div>'}</div></div><div><h4>Presión por grupo IPA3</h4><div class="v025-group-bars">${[['Registro',i.registry_pressure_mean_all],['Trayectoria económica',i.economic_pressure_mean_all],['Sanciones',i.sanctions_pressure_mean_all]].map(([label,v])=>`<div><span>${esc(label)}</span><progress max="${Math.max(1,i.ipa_pressure_mean_all||1)}" value="${Math.max(0,Number(v)||0)}"></progress><b>${v025Num(v,3)}</b></div>`).join('')}</div><p class="v025-guard">Una región puede quedar alta por desalineación registral, trayectoria económica o sanciones. La tabla y estas marcas permiten distinguir cuál fenómeno conduce el percentil antes de interpretar el score.</p></div></div>
  </section>`;
}

v022RegionDetail=function(row,communes){
  let html=v025BaseRegionDetail(row,communes);html=html.replaceAll(V022_METHOD_VERSION,V025_METHOD_VERSION);
  const panel=v025IpaPanel(row);const needle='<div class="v022-detail-grid">';
  return html.includes(needle)?html.replace(needle,`${panel}${needle}`):panel+html;
};

v022ExportRows=function(level='region'){
  const base=v025BaseExportRows(level),computed=level==='region'?V022_STATE.computed?.regions:V022_STATE.computed?.communes;
  const map=new Map((computed||[]).map(r=>[r.territory_id,r]));
  return base.map(x=>{const r=map.get(x.territory_id);if(level!=='region'||!r)return x;return {...x,method_version:V022_STATE.method==='B'?V025_METHOD_VERSION:x.method_version,ipa_mark_percentile:r.parts.ipa??null,ipa_pressure_mean_all:r.ipa?.ipa_pressure_mean_all??null,ipa_scored_entities:r.ipa?.scored_entities??null,ipa_scored_per_10k:r.ipa?.scored_per_10k??null,ipa_high_per_10k:r.ipa?.high_per_10k??null,ipa_multi_group_per_10k:r.ipa?.multi_group_per_10k??null,ipa_top_marks:(r.ipa?.top_marks||[]).map(m=>m.mark_id).join('|'),score_b_without_ipa:r.score_b_without_ipa??null,score_b_ipa_delta:r.score_b_ipa_delta??null};});
};

v022ExportJson=function(){
  const version=V022_STATE.method==='B'?V025_METHOD_VERSION:V022_METHOD_VERSION;
  const payload={schema:'AML_GEOGRAPHIC_RISK_EXPORT_V2',generated_at:new Date().toISOString(),method:{id:V022_STATE.method,name:V022_METHODS[V022_STATE.method].name,version,experimental:V022_STATE.method==='C'},ipa3:{score_version:'0.3-shadow',production_enabled:false,regional_weight_pct:V022_STATE.method==='B'?15:0,aggregation:'SUM_ENTITY_IPA3_OVER_FULL_REGIONAL_ENTITY_UNIVERSE_THEN_NATIONAL_PERCENTILE',semantics:'PRIORIDAD_ANALITICA_NO_PROBABILIDAD_LAFT'},semantics:'TERRITORIAL_SUPERVISORY_CONTEXT_NOT_ENTITY_AML_PROBABILITY',guardrails:['MISSING_IS_NOT_ZERO','IPA3_SHADOW_NOT_LAFT_PROBABILITY','CORRELATED_IPA_MARKS_ARE_ABSORBED_BEFORE_TERRITORIAL_AGGREGATION','PRESS_DOES_NOT_EVIDENCE_CRIME','OSFL_PRESENCE_IS_EXPOSURE_NOT_ADVERSE_BY_ITSELF','ECONOMIC_CAPACITY_IS_EXPOSURE','CEAD_IS_TERRITORIAL_ACTIVITY_NOT_ATTRIBUTION','BUDGET_ANOMALY_IS_NOT_ILLEGALITY','CGR_FINDINGS_REQUIRE_DOCUMENTARY_TRACEABILITY'],region_rows:v022ExportRows('region'),commune_rows:v022ExportRows('commune')};
  v022Download(`aml_geographic_risk_${V022_STATE.method}_${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(payload,null,2),'application/json;charset=utf-8');
};

v022Render=function(){
  v025BaseRender();const root=v019Content();if(!root)return;
  const eyebrow=root.querySelector('.v022-eyebrow');if(eyebrow)eyebrow.textContent=`TERRITORIAL INTELLIGENCE · ${V025_METHOD_VERSION}`;
  const hero=root.querySelector('.v022-hero p');if(hero)hero.textContent='Score territorial explicable para priorización. El método B incorpora presión de marcas IPA3 gobernadas con un peso regional acotado de 15%, sin convertir prioridad analítica en probabilidad de LA/FT.';
  const mapNote=root.querySelector('.v022-map-card .v022-section-title p');if(mapNote)mapNote.textContent='El color cambia según la capa activa. En Score B regional, IPA3 se integra después de aplicar caps, recencia y absorción a nivel entidad. La identidad territorial del cálculo usa CUT/Context Hub.';
  v025ApplyVersion();
};

window.__AML_ACTIVE_VERSION__=V025;
window.__AML_BUILD__=V025;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(v025ApplyVersion,0),{once:true});
else setTimeout(v025ApplyVersion,0);
