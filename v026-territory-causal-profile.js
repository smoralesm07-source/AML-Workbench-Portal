'use strict';

/* AML Workbench v0.26.0 · Territorial explanatory profile
 * Explains what drives Score B by region without changing the v0.25 weighting formula.
 * “Causal” is an operational shorthand only: this is deterministic attribution of score drivers,
 * not causal inference, proof of LA/FT, or attribution of conduct to persons/entities.
 */
const V026='0.26.0';
const V026_METHOD_VERSION='GEO-RISK-B-0.26.0';
const V026_SCORE_FORMULA_VERSION=typeof V025_METHOD_VERSION!=='undefined'?V025_METHOD_VERSION:'GEO-RISK-B-0.25.0';
const V026_PROFILE_VERSION='TERRITORIAL-EXPLANATORY-PROFILE-1.0';

const V026_PROFILES={
  MULTIFUENTE:{label:'Multifuente',short:'Multifuente',desc:'Tres o más familias de señal están elevadas simultáneamente. Describe convergencia; no demuestra relación causal entre fenómenos.'},
  MIXTO:{label:'Mixto de dos drivers',short:'Mixto',desc:'Dos familias de señal elevadas presentan intensidades cercanas y ninguna domina con claridad suficiente.'},
  DELICTUAL:{label:'Delictual',short:'Delictual',desc:'La presión relativa de delitos base elegibles CEAD es el principal conductor territorial del corte.'},
  GASTO_PUBLICO:{label:'Gasto público',short:'Gasto público',desc:'Las anomalías priorizadas de ejecución presupuestaria son el principal conductor territorial del corte.'},
  CONTROL_PUBLICO:{label:'Control público / CGR',short:'CGR',desc:'Los hallazgos documentales de Contraloría, normalizados territorialmente, son el principal conductor del corte.'},
  SUPERVISIVO_REGISTRAL:{label:'Supervisivo / registral',short:'Supervisivo',desc:'La presión IPA3 está conducida principalmente por señales registrales o de alineación supervisiva, como M01.'},
  SANCIONATORIO:{label:'Sancionatorio',short:'Sancionatorio',desc:'La presión IPA3 está conducida principalmente por recurrencia o convergencia sancionatoria gobernada.'},
  ECONOMICO_SECTORIAL:{label:'Económico-sectorial',short:'Económico',desc:'La estructura de sectores 19.913 y/o la trayectoria económica IPA3 es el principal conductor territorial.'},
  IPA_MIXTO:{label:'IPA3 mixto',short:'IPA3 mixto',desc:'IPA3 conduce el territorio, pero sus grupos internos no presentan un único patrón suficientemente dominante.'},
  SIN_PREDOMINIO:{label:'Sin predominio claro',short:'Sin predominio',desc:'Existe cobertura suficiente, pero ninguna familia de señal alcanza un nivel elevado que justifique atribuir un conductor principal.'},
  EVIDENCIA_INSUFICIENTE:{label:'Evidencia insuficiente',short:'Datos insuf.',desc:'La cobertura o el número de componentes comparables no permiten asignar un perfil explicativo robusto.'}
};

V022_LAYERS.profile={label:'Perfil conductor',kind:'explain'};

const v026BaseShell=shell;
const v026BaseCompute=v022Compute;
const v026BaseMapSvg=v022MapSvg;
const v026BaseRegionDetail=v022RegionDetail;
const v026BaseExportRows=v022ExportRows;
const v026BaseRender=v022Render;

function v026ApplyVersion(){
  try{if(typeof V0206_VERSION_OBSERVER!=='undefined'&&V0206_VERSION_OBSERVER){V0206_VERSION_OBSERVER.disconnect();V0206_VERSION_OBSERVER=null;}}catch{}
  const label=`Operational Radar · v${V026}`;
  const badge=document.querySelector('.v019-brand small');
  if(badge){badge.textContent=label;badge.setAttribute('aria-label',label);}
  document.title=`AML Analytical Workbench · v${V026}`;
  document.documentElement.setAttribute('data-aml-build',V026);
}

shell=function(title,subtitle){v026BaseShell(title,subtitle);v026ApplyVersion();};
if(typeof v0211ApplyVersion==='function')v0211ApplyVersion=v026ApplyVersion;

function v026Meta(code){return V026_PROFILES[code]||V026_PROFILES.SIN_PREDOMINIO;}
function v026Finite(v){return v!==null&&v!==undefined&&Number.isFinite(Number(v));}
function v026ProfileColor(code){return ({MULTIFUENTE:'#5d3b5f',MIXTO:'#8a6b44',DELICTUAL:'#9b3d3d',GASTO_PUBLICO:'#b77635',CONTROL_PUBLICO:'#6d578b',SUPERVISIVO_REGISTRAL:'#466f8b',SANCIONATORIO:'#7d4268',ECONOMICO_SECTORIAL:'#4d7c68',IPA_MIXTO:'#677286',SIN_PREDOMINIO:'#a5afb4',EVIDENCIA_INSUFICIENTE:'#d8dde0'})[code]||'#a5afb4';}
function v026ProfileClass(code){return String(code||'SIN_PREDOMINIO').toLowerCase().replaceAll('_','-');}
function v026ProfileChip(profile,compact=false){
  const p=profile||{code:'EVIDENCIA_INSUFICIENTE',confidence_label:'BAJA'},m=v026Meta(p.code);
  const title=`${m.label}. ${m.desc} Confianza del perfil: ${p.confidence_label||'—'}${v026Finite(p.confidence_score)?` (${v025Num(p.confidence_score,0)}/100)`:''}. Perfil explicativo, no inferencia causal.`;
  return `<span class="v026-profile-chip ${v026ProfileClass(p.code)} ${compact?'compact':''}" tabindex="0" title="${esc(title)}" aria-label="${esc(title)}"><b>${esc(compact?m.short:m.label)}</b>${compact?'':`<small>${esc(p.confidence_label||'—')} · ${v026Finite(p.confidence_score)?v025Num(p.confidence_score,0):'—'}</small>`}</span>`;
}

function v026MarkFamily(markId){
  if(markId==='M01')return 'SUPERVISIVO_REGISTRAL';
  if(['M03','M04','M05','M19'].includes(markId))return 'ECONOMICO_SECTORIAL';
  if(['M16','M18'].includes(markId))return 'SANCIONATORIO';
  return 'IPA_MIXTO';
}
function v026IpaSubprofile(row){
  if(!row?.ipa)return {code:'IPA_MIXTO',label:'IPA3',evidence:'sin snapshot IPA3'};
  const counts=new Map();
  for(const m of row.ipa.top_marks||[]){
    const code=v026MarkFamily(m.mark_id),n=Number(m.entity_count)||0;
    counts.set(code,(counts.get(code)||0)+n);
  }
  const byMarks=[...counts.entries()].sort((a,b)=>b[1]-a[1]);
  if(byMarks.length&&byMarks[0][1]>0){
    const code=byMarks[0][0],mark=(row.ipa.top_marks||[]).find(m=>v026MarkFamily(m.mark_id)===code);
    return {code,label:v026Meta(code).label,evidence:mark?`${mark.mark_id} · ${v025MarkMeta(mark.mark_id).label}`:'marcas IPA3'};
  }
  const groups=[
    {code:'SUPERVISIVO_REGISTRAL',label:'Registro',value:row.ipa.registry_pressure_mean_all},
    {code:'ECONOMICO_SECTORIAL',label:'Trayectoria económica',value:row.ipa.economic_pressure_mean_all},
    {code:'SANCIONATORIO',label:'Sanciones',value:row.ipa.sanctions_pressure_mean_all}
  ].filter(x=>v026Finite(x.value)).sort((a,b)=>Number(b.value)-Number(a.value));
  if(groups.length&&Number(groups[0].value)>0)return {code:groups[0].code,label:groups[0].label,evidence:`grupo IPA3 ${groups[0].label.toLowerCase()}`};
  return {code:'IPA_MIXTO',label:'IPA3',evidence:'sin grupo IPA3 dominante'};
}

function v026Components(row){
  const ipa=v026IpaSubprofile(row),raw=[
    {key:'sector',label:'Sectores 19.913',family:'ECONOMICO_SECTORIAL',value:row.parts?.sector},
    {key:'cead',label:'CEAD',family:'DELICTUAL',value:row.parts?.cead},
    {key:'budget',label:'Presupuesto',family:'GASTO_PUBLICO',value:row.parts?.budget},
    {key:'cgr',label:'CGR',family:'CONTROL_PUBLICO',value:row.parts?.cgr},
    {key:'ipa',label:'IPA3',family:ipa.code,value:row.parts?.ipa,evidence:ipa.evidence}
  ];
  return raw.filter(x=>v026Finite(x.value)).map(x=>({...x,value:Number(x.value)})).sort((a,b)=>b.value-a.value);
}
function v026Families(components){
  const map=new Map();
  for(const c of components){
    if(!map.has(c.family))map.set(c.family,{code:c.family,label:v026Meta(c.family).label,value:c.value,components:[c]});
    else{const f=map.get(c.family);f.value=Math.max(f.value,c.value);f.components.push(c);}
  }
  return [...map.values()].sort((a,b)=>b.value-a.value);
}
function v026ConfidenceLabel(v){const n=Number(v);return n>=80?'ALTA':n>=60?'MEDIA':'BAJA';}
function v026Profile(row){
  const components=v026Components(row),families=v026Families(components),coverage=v026Finite(row.coverage)?Number(row.coverage):0;
  const top=families[0]||null,second=families[1]||null,gap=top&&second?top.value-second.value:top?top.value:null;
  const elevatedFamilies=families.filter(f=>f.components.some(c=>c.value>=60));
  const elevatedComponents=components.filter(c=>c.value>=60);
  let code='SIN_PREDOMINIO';
  if(coverage<60||components.length<3)code='EVIDENCIA_INSUFICIENTE';
  else if(!top||top.value<60)code='SIN_PREDOMINIO';
  else if(elevatedFamilies.length>=3)code='MULTIFUENTE';
  else if(elevatedFamilies.length===2&&second&&gap<=12)code='MIXTO';
  else code=top.code;

  const cross=v026Finite(row.parts?.cross)?Number(row.parts.cross):0;
  let conf=0;
  if(code==='EVIDENCIA_INSUFICIENTE')conf=Math.min(45,coverage*.45+components.length*5);
  else if(code==='MULTIFUENTE')conf=.45*coverage+.30*Math.min(100,elevatedFamilies.length/4*100)+.25*Math.max(cross,top?.value||0);
  else if(code==='MIXTO')conf=.45*coverage+.30*Math.max(0,100-(gap||0)*5)+.25*((top?.value||0)+(second?.value||0))/2;
  else if(code==='SIN_PREDOMINIO')conf=.55*coverage+.45*Math.max(0,100-(top?.value||0));
  else conf=.40*coverage+.35*Math.min(100,(gap||0)*5)+.25*(top?.value||0);
  conf=Math.max(0,Math.min(100,conf));
  if(components.length<4)conf=Math.min(conf,70);
  if(coverage<75)conf=Math.min(conf,55);

  const primary=top?{code:top.code,label:top.label,value:top.value,components:top.components}:null;
  const secondary=second?{code:second.code,label:second.label,value:second.value,components:second.components}:null;
  const meta=v026Meta(code);
  let explanation='';
  if(code==='EVIDENCIA_INSUFICIENTE')explanation=`Cobertura ${v025Num(coverage,0)}% y ${components.length}/5 componentes comparables: no se asigna un conductor robusto.`;
  else if(code==='SIN_PREDOMINIO')explanation=`Cobertura suficiente, pero la familia más alta (${primary?.label||'—'}) alcanza ${v025Num(primary?.value,1)} y no supera el umbral explicativo de 60.`;
  else if(code==='MULTIFUENTE')explanation=`Convergen ${elevatedFamilies.length} familias elevadas: ${elevatedFamilies.map(f=>f.label).join(', ')}. El conductor de mayor intensidad es ${primary?.label||'—'} (${v025Num(primary?.value,1)}).`;
  else if(code==='MIXTO')explanation=`Dos familias elevadas presentan una brecha de solo ${v025Num(gap,1)} puntos: ${primary?.label||'—'} y ${secondary?.label||'—'}.`;
  else explanation=`Predomina ${meta.label} (${v025Num(primary?.value,1)}), con una brecha de ${v025Num(gap,1)} puntos frente a ${secondary?.label||'la siguiente familia'}.`;
  return {code,label:meta.label,description:meta.desc,confidence_score:conf,confidence_label:v026ConfidenceLabel(conf),primary,secondary,gap,elevated_family_count:elevatedFamilies.length,elevated_component_count:elevatedComponents.length,available_component_count:components.length,components,families,explanation};
}

v022Compute=function(raw){
  const computed=v026BaseCompute(raw);
  for(const r of computed.regions)r.explanatory_profile=v026Profile(r);
  return computed;
};

function v026ProfileLegend(){
  const codes=['MULTIFUENTE','MIXTO','DELICTUAL','GASTO_PUBLICO','CONTROL_PUBLICO','SUPERVISIVO_REGISTRAL','SANCIONATORIO','ECONOMICO_SECTORIAL','SIN_PREDOMINIO','EVIDENCIA_INSUFICIENTE'];
  return `<div class="v026-profile-legend" aria-label="Leyenda de perfiles explicativos">${codes.map(code=>`<span><i class="${v026ProfileClass(code)}"></i>${esc(v026Meta(code).short)}</span>`).join('')}</div>`;
}

v022MapSvg=function(regions){
  if(V022_STATE.layer!=='profile')return v026BaseMapSvg(regions);
  const ordered=Object.entries(V022_REGION_GEO).map(([name,[lon,lat]])=>({name,p:v022MapPoint(lon,lat)})).sort((a,b)=>a.p.x-b.p.x),byName=new Map(regions.map(r=>[r.region,r])),paths=v022ChilePaths();
  const bands=ordered.map((x,i)=>{const prev=i?ordered[i-1].p.x:24,next=i<ordered.length-1?ordered[i+1].p.x:796,x0=i?(prev+x.p.x)/2:24,x1=i<ordered.length-1?(x.p.x+next)/2:796,r=byName.get(x.name),p=r?.explanatory_profile,fill=v026ProfileColor(p?.code||'EVIDENCIA_INSUFICIENTE');return `<rect data-georisk-region="${esc(x.name)}" x="${x0.toFixed(1)}" y="28" width="${Math.max(1,x1-x0).toFixed(1)}" height="210" fill="${fill}"><title>${esc(x.name)} · ${esc(p?.label||'Evidencia insuficiente')} · confianza ${esc(p?.confidence_label||'BAJA')}</title></rect>`;}).join('');
  const markers=ordered.map(x=>{const r=byName.get(x.name),p=r?.explanatory_profile,selected=x.name===V022_STATE.selectedRegion;return `<g data-georisk-region="${esc(x.name)}" class="v022-marker ${selected?'selected':''}" tabindex="0"><circle cx="${x.p.x.toFixed(1)}" cy="${x.p.y.toFixed(1)}" r="${selected?8:5}" fill="${v026ProfileColor(p?.code||'EVIDENCIA_INSUFICIENTE')}"></circle><title>${esc(x.name)} · ${esc(p?.label||'Evidencia insuficiente')}</title></g>`;}).join('');
  return `<svg class="v022-map" viewBox="0 0 820 282" role="img" aria-label="Mapa de Chile por perfil explicativo del riesgo"><defs><clipPath id="v022ChileClip">${paths.map(d=>`<path d="${d}"></path>`).join('')}</clipPath></defs><g clip-path="url(#v022ChileClip)">${bands}</g><g class="v022-outline">${paths.map(d=>`<path d="${d}"></path>`).join('')}</g>${markers}</svg>`;
};

function v026MetricCell(score,detail){return `<span class="v025-metric-score">${v022Fmt(score,1)}</span><small>${detail||'—'}</small>`;}
v022Ranking=function(regions){
  const method=V022_STATE.method,rows=[...regions].sort((a,b)=>(b.scores[method]??-1)-(a.scores[method]??-1));
  return `<div class="v022-tablewrap v025-ranking-wrap"><table class="v025-risk-table v026-risk-table"><thead><tr><th>#</th><th>Región</th><th>Perfil conductor</th><th>Score ${esc(method)}</th><th>Marcas IPA3</th><th>IPA</th><th>Sector 19.913</th><th>CEAD</th><th>Presupuesto</th><th>CGR</th><th>Conv.</th><th>Cob.</th></tr></thead><tbody>${rows.map((r,i)=>{
    const p=r.explanatory_profile||v026Profile(r),delta=method==='B'?r.score_b_ipa_delta:null;
    return `<tr data-georisk-region="${esc(r.region)}"><td>${i+1}</td><td><b>${esc(r.region)}</b><small>${p.primary?`principal: ${esc(p.primary.label)}`:'sin conductor'}</small></td><td>${v026ProfileChip(p,false)}<small>${p.secondary?`2º ${esc(p.secondary.label)} · brecha ${v025Num(p.gap,1)}`:`${p.available_component_count}/5 componentes`}</small></td><td>${v022ScoreBadge(r.scores[method])}<small>${method==='B'?`Δ IPA ${v025Signed(delta,1)}`:'perfil aplica a B'}</small></td><td><div class="v025-mark-inline">${v025MarkList(r,3,false)}</div></td><td>${v026MetricCell(r.parts.ipa,r.ipa?`${v025Num(r.ipa.scored_per_10k,1)}/10k con marca`:'sin snapshot')}</td><td>${v026MetricCell(r.parts.sector,v025SectorDetail(r))}</td><td>${v026MetricCell(r.parts.cead,v025CeadDetail(r))}</td><td>${v026MetricCell(r.parts.budget,v025BudgetDetail(r))}</td><td>${v026MetricCell(r.parts.cgr,v025CgrDetail(r))}</td><td>${v026MetricCell(r.parts.cross,`${p.elevated_family_count} familias · ${p.elevated_component_count}/5 capas ≥60`)}</td><td><span class="v025-coverage">${v022Fmt(r.coverage,0)}%</span><small>${esc(r.confidence)}</small></td></tr>`;
  }).join('')}</tbody></table></div>`;
};

function v026ProfileCounts(regions){const m=new Map();for(const r of regions){const code=r.explanatory_profile?.code||'EVIDENCIA_INSUFICIENTE';m.set(code,(m.get(code)||0)+1);}return [...m].map(([code,count])=>({code,count})).sort((a,b)=>b.count-a.count);}
function v026ProfileBars(rows){const max=Math.max(1,...rows.map(x=>x.count));return `<div class="v026-profile-bars">${rows.slice(0,6).map(x=>`<div>${v026ProfileChip({code:x.code,confidence_label:'',confidence_score:null},true)}<progress max="${max}" value="${x.count}"></progress><b>${x.count}</b></div>`).join('')}</div>`;}
function v026AmbiguityRows(regions){return regions.filter(r=>r.explanatory_profile?.code!=='EVIDENCIA_INSUFICIENTE').map(r=>({region:r.region,value:100-r.explanatory_profile.confidence_score,confidence:r.explanatory_profile.confidence_score,profile:r.explanatory_profile})).sort((a,b)=>b.value-a.value).slice(0,5);}
function v026MultiRows(regions){return regions.filter(r=>['MULTIFUENTE','MIXTO'].includes(r.explanatory_profile?.code)).map(r=>({region:r.region,value:r.explanatory_profile.elevated_family_count,profile:r.explanatory_profile,score:r.scores.B})).sort((a,b)=>b.value-a.value||Number(b.score)-Number(a.score)).slice(0,5);}

v022Kpis=function(regions){
  const valid=regions.filter(r=>Number.isFinite(Number(r.scores.B))),profiles=v026ProfileCounts(valid),multi=v026MultiRows(valid),amb=v026AmbiguityRows(valid);
  const pressure=valid.filter(r=>v026Finite(r.ipa?.ipa_pressure_mean_all)).map(r=>({region:r.region,value:r.ipa.ipa_pressure_mean_all,pct:r.parts.ipa,rate:r.ipa.scored_per_10k})).sort((a,b)=>b.value-a.value).slice(0,5),maxPressure=Math.max(1,...pressure.map(x=>x.value));
  return `<section class="v025-insights v026-insights">
    <article><div class="v025-insight-head"><span>PERFILES</span><h4>Conductores territoriales</h4><small>distribución nacional</small></div>${v026ProfileBars(profiles)}<p>${profiles[0]?`${profiles[0].count} regiones quedan clasificadas principalmente como ${esc(v026Meta(profiles[0].code).label)}.`:'Sin perfiles comparables.'}</p></article>
    <article><div class="v025-insight-head"><span>CONVERGENCIA</span><h4>Perfiles mixtos y multifuente</h4><small>familias elevadas ≥60</small></div>${multi.length?v025ChartRows(multi,4,x=>`${v025Num(x.value,0)} fam.`):'<div class="v025-chart-empty">Sin perfiles mixtos/multifuente en este corte.</div>'}<p>${multi[0]?`${esc(multi[0].region)} presenta ${v025Num(multi[0].value,0)} familias elevadas y se clasifica ${esc(multi[0].profile.label)}.`:'No hay convergencia suficiente para un perfil multifuente.'}</p></article>
    <article><div class="v025-insight-head"><span>PRESIÓN IPA3</span><h4>Marcas por universo regional</h4><small>score IPA agregado / entidad</small></div>${v025ChartRows(pressure,maxPressure,x=>`${v025Num(x.pct,0)} pctl`)}<p>${pressure[0]?`${esc(pressure[0].region)}: ${v025Num(pressure[0].rate,1)} entidades con marca scoring por 10 mil.`:'Sin snapshot IPA regional.'}</p></article>
    <article><div class="v025-insight-head"><span>REVISIÓN</span><h4>Perfiles menos estables</h4><small>menor confianza explicativa</small></div>${amb.length?v025ChartRows(amb,100,x=>`${v025Num(x.confidence,0)} conf.`):'<div class="v025-chart-empty">Sin perfiles comparables.</div>'}<p>${amb[0]?`${esc(amb[0].region)} requiere más cautela interpretativa: confianza de perfil ${v025Num(amb[0].confidence,0)}/100.`:'Sin ambigüedad evaluable.'}</p></article>
  </section>`;
};

function v026ProfilePanel(row){
  const p=row?.explanatory_profile||v026Profile(row||{}),families=p.families||[];
  return `<section class="v026-profile-panel"><div class="v026-profile-head"><div><span>PERFIL EXPLICATIVO · ${esc(V026_PROFILE_VERSION)}</span><h3>¿Qué está conduciendo el riesgo de esta región?</h3><p>${esc(p.explanation)} La clasificación explica la composición del score y no constituye inferencia causal ni atribución de conducta.</p></div>${v026ProfileChip(p,false)}</div>
    <div class="v026-profile-body"><div><h4>Familias conductoras</h4><div class="v026-driver-bars">${families.map(f=>`<div><span>${esc(f.label)}</span><progress max="100" value="${Math.max(0,Math.min(100,Number(f.value)||0))}"></progress><b>${v025Num(f.value,1)}</b><small>${f.components.map(c=>c.label).join(' + ')}</small></div>`).join('')||'<div class="v025-chart-empty">Sin familias comparables.</div>'}</div></div>
      <div class="v026-profile-read"><h4>Lectura estratégica</h4><dl><div><dt>Conductor principal</dt><dd>${esc(p.primary?.label||'—')}</dd></div><div><dt>Segundo conductor</dt><dd>${esc(p.secondary?.label||'—')}</dd></div><div><dt>Brecha</dt><dd>${v025Num(p.gap,1)} pts</dd></div><div><dt>Familias elevadas</dt><dd>${v025Num(p.elevated_family_count,0)}</dd></div><div><dt>Confianza del perfil</dt><dd>${v025Num(p.confidence_score,0)}/100 · ${esc(p.confidence_label)}</dd></div></dl><p>${esc(p.description)}</p>${row?.ipa?`<div class="v026-profile-marks"><span>Marcas IPA3 relevantes</span>${v025MarkList(row,4,true)}</div>`:''}</div></div>
  </section>`;
}

v022RegionDetail=function(row,communes){
  const html=v026BaseRegionDetail(row,communes),panel=v026ProfilePanel(row),needle='<section class="v025-ipa-panel';
  return html.includes(needle)?html.replace(needle,`${panel}${needle}`):panel+html;
};

v022ExportRows=function(level='region'){
  const base=v026BaseExportRows(level),computed=level==='region'?V022_STATE.computed?.regions:V022_STATE.computed?.communes,map=new Map((computed||[]).map(r=>[r.territory_id,r]));
  return base.map(x=>{const r=map.get(x.territory_id);if(level!=='region'||!r)return x;const p=r.explanatory_profile||v026Profile(r);return {...x,method_version:V022_STATE.method==='B'?V026_METHOD_VERSION:x.method_version,score_formula_version:V022_STATE.method==='B'?V026_SCORE_FORMULA_VERSION:null,profile_method_version:V026_PROFILE_VERSION,explanatory_profile_code:p.code,explanatory_profile_label:p.label,profile_confidence_score:p.confidence_score,profile_confidence_label:p.confidence_label,dominant_driver:p.primary?.label||null,dominant_driver_score:p.primary?.value??null,secondary_driver:p.secondary?.label||null,secondary_driver_score:p.secondary?.value??null,driver_gap:p.gap??null,elevated_family_count:p.elevated_family_count,profile_explanation:p.explanation};});
};

v022ExportJson=function(){
  const version=V022_STATE.method==='B'?V026_METHOD_VERSION:V022_METHOD_VERSION;
  const payload={schema:'AML_GEOGRAPHIC_RISK_EXPORT_V3',generated_at:new Date().toISOString(),method:{id:V022_STATE.method,name:V022_METHODS[V022_STATE.method].name,version,score_formula_version:V022_STATE.method==='B'?V026_SCORE_FORMULA_VERSION:null,experimental:V022_STATE.method==='C'},explanatory_profile:{version:V026_PROFILE_VERSION,semantics:'DETERMINISTIC_SCORE_DRIVER_ATTRIBUTION_NOT_CAUSAL_INFERENCE',families:Object.fromEntries(Object.entries(V026_PROFILES).map(([k,v])=>[k,{label:v.label,description:v.desc}]))},ipa3:{score_version:'0.3-shadow',production_enabled:false,regional_weight_pct:V022_STATE.method==='B'?15:0,aggregation:'SUM_ENTITY_IPA3_OVER_FULL_REGIONAL_ENTITY_UNIVERSE_THEN_NATIONAL_PERCENTILE',semantics:'PRIORIDAD_ANALITICA_NO_PROBABILIDAD_LAFT'},semantics:'TERRITORIAL_SUPERVISORY_CONTEXT_NOT_ENTITY_AML_PROBABILITY',guardrails:['MISSING_IS_NOT_ZERO','EXPLANATORY_PROFILE_IS_NOT_CAUSAL_INFERENCE','IPA3_SHADOW_NOT_LAFT_PROBABILITY','CORRELATED_IPA_MARKS_ARE_ABSORBED_BEFORE_TERRITORIAL_AGGREGATION','PRESS_DOES_NOT_EVIDENCE_CRIME','OSFL_PRESENCE_IS_EXPOSURE_NOT_ADVERSE_BY_ITSELF','ECONOMIC_CAPACITY_IS_EXPOSURE','CEAD_IS_TERRITORIAL_ACTIVITY_NOT_ATTRIBUTION','BUDGET_ANOMALY_IS_NOT_ILLEGALITY','CGR_FINDINGS_REQUIRE_DOCUMENTARY_TRACEABILITY'],region_rows:v022ExportRows('region'),commune_rows:v022ExportRows('commune')};
  v022Download(`aml_geographic_risk_${V022_STATE.method}_${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(payload,null,2),'application/json;charset=utf-8');
};

v022Render=function(){
  v026BaseRender();const root=v019Content();if(!root)return;
  const eyebrow=root.querySelector('.v022-eyebrow');if(eyebrow)eyebrow.textContent=`TERRITORIAL INTELLIGENCE · ${V026_METHOD_VERSION}`;
  const hero=root.querySelector('.v022-hero p');if(hero)hero.textContent='Score B territorial explicable con IPA3 y perfil conductor por región. El perfil identifica qué familia de señales está impulsando el resultado, separa convergencia de dominancia y nunca se interpreta como inferencia causal o probabilidad de LA/FT.';
  const layers=root.querySelector('.v022-layers');if(layers&&V022_STATE.layer==='profile')layers.insertAdjacentHTML('afterend',v026ProfileLegend());
  const mapNote=root.querySelector('.v022-map-card .v022-section-title p');if(mapNote&&V022_STATE.layer==='profile')mapNote.textContent='La capa Perfil conductor colorea cada región por la familia que explica su composición de riesgo. Es una clasificación analítica determinística; no prueba causalidad entre fenómenos.';
  v026ApplyVersion();
};

window.__AML_ACTIVE_VERSION__=V026;
window.__AML_BUILD__=V026;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(v026ApplyVersion,0),{once:true});
else setTimeout(v026ApplyVersion,0);
