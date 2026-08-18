'use strict';

/* AML Workbench v0.31.2 · Territory clarity + CEAD evidence detail
 * UX-only refinement over the governed GEO-RISK-B-0.27.0 calculation.
 * Visible brand: Índice de Prioridad Territorial (IPT).
 * Internal scores.B remains unchanged for backwards compatibility and auditability.
 */
const V0312='0.31.2';
const V0312_BUILD='0312';
const V0312_VIEW='TERRITORY-CLARITY-0.31.2';
const V0312_INDICATOR='Índice de Prioridad Territorial';
const V0312_INDICATOR_SHORT='IPT';
const V0312_CEAD_OFFICIAL='https://cead.spd.gov.cl/estadisticas-delictuales/?r=1';
const V0312_CEAD_DATASET='https://github.com/smoralesm07-source/Radar_delictual/blob/radar-data/data/processed/cead_current_predicate_activity_v4.json';
const V0312_CEAD_CATALOG_PAGE='https://github.com/smoralesm07-source/Radar_delictual/blob/radar-data/data/processed/cead_catalog_art27_v4.json';
const V0312_CEAD_CATALOG_RAW='https://raw.githubusercontent.com/smoralesm07-source/Radar_delictual/radar-data/data/processed/cead_catalog_art27_v4.json';
const V0312_CACHE={ceadCatalog:null,ceadCatalogLoading:false};
const V0312_FALLBACK_SUBGROUPS={
  'family:4':[
    {id:'40101',label:'Tráfico de sustancias',class:'predicate_direct',eligible:true},
    {id:'40102',label:'Microtráfico de sustancias',class:'predicate_direct',eligible:true},
    {id:'40103',label:'Elaboración o producción de sustancias',class:'predicate_direct',eligible:true},
    {id:'40104',label:'Otras infracciones a la Ley 20.000',class:'predicate_candidate',eligible:false}
  ]
};

const v0312BaseExportRows=v022ExportRows;
const v0312BaseShell=shell;

/* Keep technical key, change the language presented to analysts. */
if(typeof V031_METRICS!=='undefined'){
  V031_METRICS.score.label=V0312_INDICATOR;
  V031_METRICS.score.short=V0312_INDICATOR_SHORT;
  if(V031_METRICS.profile){V031_METRICS.profile.label='Perfil territorial';V031_METRICS.profile.short='Perfil';}
}

function v0312ApplyVersion(){
  try{if(typeof V0206_VERSION_OBSERVER!=='undefined'&&V0206_VERSION_OBSERVER){V0206_VERSION_OBSERVER.disconnect();V0206_VERSION_OBSERVER=null;}}catch{}
  window.__AML_ACTIVE_VERSION__=V0312;window.__AML_BUILD__=V0312_BUILD;
  const label=`Operational Radar · v${V0312}`;const badge=document.querySelector('.v019-brand small');
  if(badge){badge.setAttribute('data-runtime-label',label);badge.setAttribute('aria-label',label);badge.dataset.activeVersion=V0312;badge.textContent=label;}
  document.title=`AML Analytical Workbench · v${V0312}`;
  document.documentElement.setAttribute('data-aml-version',V0312);document.documentElement.setAttribute('data-aml-build',V0312_BUILD);
}
shell=function(title,subtitle){v0312BaseShell(title,subtitle);v0312ApplyVersion();};
if(typeof v0211ApplyVersion==='function')v0211ApplyVersion=v0312ApplyVersion;

function v0312NoLegacyFilters(){
  if(typeof V029_FILTERS==='undefined')return;
  V029_FILTERS.drivers?.clear?.();V029_FILTERS.matrix?.clear?.();
}
function v0312Narrative(r){
  if(!r)return '';
  const p=v031Profile(r),main=p?.primary?.label||'sin un factor dominante',second=p?.secondary?.label;
  const factors=second?` El segundo factor es ${second}, con una brecha de ${v031Num(p?.gap,1)} puntos.`:'';
  const phen=(r.phenomena||[]).slice(0,3).map(c=>v031Phen(c).label);
  const marks=phen.length?` Señales visibles: ${phen.join('; ')}.`:' No hay una marca territorial dominante adicional en este corte.';
  return `${V0312_INDICATOR_SHORT} ${v031Num(r.scores?.B,1)} (${v031BandLabel(r.scores?.B)}). El principal factor que explica la posición relativa es ${main}.${factors}${marks}`;
}
function v0312FilterRail(all){
  const rc=v031OptionCounts(all,'region',r=>[r.region]),pc=v031OptionCounts(all,'profiles',r=>[v031Profile(r)?.code||'EVIDENCIA_INSUFICIENTE']),fc=v031OptionCounts(all,'phenomena',r=>r.phenomena||[]);
  const regions=[...rc].sort((a,b)=>a[0].localeCompare(b[0],'es')).map(([v,n])=>`<option value="${esc(v)}" ${V029_FILTERS.region===v?'selected':''}>${esc(v031Short(v))} · ${n}</option>`).join('');
  const profiles=[...pc].sort((a,b)=>b[1]-a[1]).map(([v,n])=>`<option value="${esc(v)}" ${V029_FILTERS.profiles.size===1&&V029_FILTERS.profiles.has(v)?'selected':''}>${esc(v026Meta(v).label)} · ${n}</option>`).join('');
  const phenomena=[...fc].sort((a,b)=>b[1]-a[1]).map(([v,n])=>`<option value="${esc(v)}" ${V029_FILTERS.phenomena.size===1&&V029_FILTERS.phenomena.has(v)?'selected':''}>${esc(v031Phen(v).label)} · ${n}</option>`).join('');
  const visible=v031Filtered(all).length;
  return `<section class="v031-filter-shell v0312-filter-shell"><div class="v031-filter-grid"><label><span>Región</span><select data-v031-select="region"><option value="">Todo Chile</option>${regions}</select></label><label><span>Perfil territorial</span><select data-v031-select="profiles"><option value="">Todos los perfiles</option>${profiles}</select></label><label><span>Fenómeno</span><select data-v031-select="phenomena"><option value="">Todos los fenómenos</option>${phenomena}</select></label><div class="v031-visible"><b>${visible}</b><span>de ${all.length}<br>regiones</span></div></div>${v0312ActiveFilters()}</section>`;
}
function v0312ActiveFilters(){
  const chips=[];
  if(V029_FILTERS.region)chips.push(`<button type="button" data-v031-filter="region" data-v031-value="${esc(V029_FILTERS.region)}">${esc(v031Short(V029_FILTERS.region))} ×</button>`);
  for(const v of V029_FILTERS.profiles)chips.push(`<button type="button" data-v031-filter="profiles" data-v031-value="${esc(v)}">Perfil · ${esc(v026Meta(v).short)} ×</button>`);
  for(const v of V029_FILTERS.phenomena)chips.push(`<button type="button" data-v031-filter="phenomena" data-v031-value="${esc(v)}">${esc(v031Phen(v).short)} ×</button>`);
  return chips.length?`<div class="v031-filter-chips"><span>Filtros activos</span>${chips.join('')}<button type="button" class="clear" data-v031-clear>Limpiar todo</button></div>`:`<div class="v031-filter-chips empty"><span>Mapa, fenómenos y comparador comparten los mismos filtros</span></div>`;
}
function v0312Hero(all){
  const h=v031Headline(all),visible=v031Filtered(all).length;
  return `<section class="v031-hero"><div class="v031-hero-copy"><span class="v031-kicker">RIESGO GEOGRÁFICO · INTELIGENCIA TERRITORIAL</span><h2>Dónde concentrar revisión y qué señales lo explican</h2><p>El ${V0312_INDICATOR} ordena territorios mediante percentiles robustos y evidencia estructurada. Es una herramienta de priorización: no expresa probabilidad de LA/FT ni transfiere características territoriales a una entidad individual.</p><div class="v031-hero-tags"><span>${V0312_INDICATOR_SHORT} · indicador oficial</span><span>Percentil robusto</span><span>IPA3 v0.4 shadow</span><span>Missing ≠ 0</span></div></div><aside class="v031-official"><span>INDICADOR TERRITORIAL</span><b>${V0312_INDICATOR_SHORT}</b><strong>${V0312_INDICATOR}</strong><small>Prioriza territorios para profundización</small></aside><div class="v031-insight-strip"><button type="button" ${h.top?`data-v031-region="${esc(h.top.region)}"`:''}><span>Mayor prioridad visible</span><b>${h.top?esc(v031Short(h.top.region)):'—'}</b><small>${h.top?`${V0312_INDICATOR_SHORT} ${v031Num(h.top.scores.B,1)} · ${esc(v031Profile(h.top)?.label||'sin perfil')}`:'Sin región comparable'}</small></button><button type="button" ${h.phen?`data-v031-filter="phenomena" data-v031-value="${esc(h.phen[0])}"`:''}><span>Fenómeno dominante</span><b>${h.phen?esc(v031Phen(h.phen[0]).short):'—'}</b><small>${h.phen?`${h.phen[1]} de ${visible} regiones visibles`:'Sin marca dominante'}</small></button><button type="button" ${h.conv?`data-v031-region="${esc(h.conv.region)}"`:''}><span>Mayor convergencia</span><b>${h.conv?esc(v031Short(h.conv.region)):'—'}</b><small>${h.conv?`${v031Profile(h.conv)?.elevated_family_count||0} familias elevadas`:'Sin comparación'}</small></button></div></section>`;
}
function v0312Map(all){
  if(typeof V030_CHILE==='undefined')return '<div class="v031-empty">Geometría regional no disponible.</div>';
  const metric=V031_STATE.mapMetric,m=V031_METRICS[metric],byShape=new Map(all.map(r=>[v031Shape(r.region),r]).filter(x=>x[0]));const visibleSet=new Set(v031Filtered(all).map(r=>r.region));
  const paths=V030_CHILE.order.map(shape=>{const r=byShape.get(shape),raw=v031MetricValue(r,metric),selected=r?.region===V029_FILTERS.region||r?.region===V022_STATE.selectedRegion,dim=r&&!visibleSet.has(r.region);const profile=v031Profile(r);const cls=m.kind==='profile'?'profile':v031Heat(raw);const fill=m.kind==='profile'&&profile&&typeof v026ProfileColor==='function'?` fill="${v026ProfileColor(profile.code)}"`:'';const title=r?`${v031Short(r.region)} · ${m.label}: ${v031MetricText(r,metric)}${m.kind==='context'?' · contexto no puntuante':''}`:`${shape} · sin dato`;return `<path class="v031-region ${cls} ${selected?'selected':''} ${dim?'dim':''}" data-v031-region="${r?esc(r.region):''}" d="${esc(V030_CHILE.paths[shape])}" tabindex="${r?'0':'-1'}"${fill}><title>${esc(title)}</title></path>`;}).join('');
  const ranked=[...v031Filtered(all)].filter(r=>metric==='profile'||v031Finite(v031MetricValue(r,metric))).sort((a,b)=>metric==='profile'?(Number(b.scores?.B)||0)-(Number(a.scores?.B)||0):Number(v031MetricValue(b,metric))-Number(v031MetricValue(a,metric))).slice(0,7);
  return `<section class="v031-card v031-map-card"><header class="v031-card-head"><div><span>TERRITORIO</span><h3>Mapa nacional de prioridad y contexto</h3><p>Cambia la capa para entender qué señal está detrás de la posición territorial. El ${V0312_INDICATOR_SHORT} no se recalcula al cambiar de capa.</p></div>${v031MetricButtons()}</header><div class="v031-map-layout"><div class="v031-map-stage"><svg viewBox="${esc(V030_CHILE.viewBox)}" role="img" aria-label="Mapa de Chile por ${esc(m.label)}">${paths}</svg>${v031MapLegend()}</div><aside class="v031-map-side"><div class="v031-side-title"><div><span>CAPA ACTIVA</span><b>${esc(m.label)}</b></div><small>${m.kind==='risk'?'señal normalizada':m.kind==='context'?'contexto visible · aporte 0':'clasificación explicativa'}</small></div><div class="v031-ranking">${ranked.map((r,i)=>`<button type="button" class="${V029_FILTERS.region===r.region?'active':''}" data-v031-region="${esc(r.region)}"><em>${i+1}</em><span><b>${esc(v031Short(r.region))}</b><small>${esc(v031Profile(r)?.label||'sin perfil')}</small></span><strong>${metric==='profile'?`${V0312_INDICATOR_SHORT} ${v031Num(r.scores?.B,1)}`:v031MetricText(r,metric)}</strong></button>`).join('')||'<div class="v031-empty">Sin regiones comparables con los filtros actuales.</div>'}</div></aside></div><footer>La geografía orienta revisión. CEAD, CGR, Presupuesto, prensa y OSFL describen el territorio; no atribuyen conducta a personas o entidades por proximidad.</footer></section>`;
}
function v0312ScoreBadge(r){return `<div class="v031-score ${v031Tone(r?.scores?.B)}"><span>${V0312_INDICATOR_SHORT}</span><b>${v031Num(r?.scores?.B,1)}</b><small>${esc(v031BandLabel(r?.scores?.B))}</small></div>`;}
function v0312Dossier(r){
  if(!r)return `<aside class="v031-card v031-dossier"><div class="v031-empty">Selecciona una región para abrir su lectura AML.</div></aside>`;
  const p=v031Profile(r),priority=v031Priority(r),phen=r.phenomena||[],second=p?.secondary;
  return `<aside class="v031-card v031-dossier"><header><div><span>LECTURA AML · REGIÓN</span><h3>${esc(v031Short(r.region))}</h3><p>${esc(v0312Narrative(r))}</p></div>${v0312ScoreBadge(r)}</header><div class="v031-priority ${String(r.analytical_priority||'CONTEXT').toLowerCase()}"><span>Prioridad analítica</span><b>${esc(priority.label)}</b><small>${esc(priority.desc)}</small></div><div class="v031-driver-grid"><div><span>Factor principal</span><b>${esc(p?.primary?.label||'—')}</b><small>${v031Num(p?.primary?.value,1)} pctl</small></div><div><span>Segundo factor</span><b>${esc(second?.label||'—')}</b><small>${second?`brecha ${v031Num(p.gap,1)} pts`:'sin segundo comparable'}</small></div><div><span>Solidez de la explicación</span><b>${esc(p?.confidence_label||'—')}</b><small>${v031Num(p?.confidence_score,0)}/100</small></div><div><span>Cobertura del ${V0312_INDICATOR_SHORT}</span><b>${v031Pct(r.coverage)}</b><small>missing nunca es 0</small></div></div><section><div class="v031-section-label"><span>HUELLA TERRITORIAL</span><small>clic → proyectar capa en mapa</small></div>${v031Components(r)}</section><section><div class="v031-section-label"><span>FENÓMENOS EVIDENTES</span><small>hover explica · clic filtra</small></div><div class="v031-phen-list">${phen.map(v031PhenChip).join('')||'<span class="v031-muted">Sin marca destacada.</span>'}</div></section><div class="v031-facts"><div><span>CEAD · casos</span><b>${v031Num(r.cead?.cases,0)}</b><small>abrir ficha debajo</small></div><div><span>OSFL observadas</span><b>${v031Num(r.context?.osfl_count,0)}</b><small>contexto · no puntúa</small></div><div><span>Prensa territorial</span><b>${v031Num(r.context?.press_count,0)}</b><small>contexto · no evidencia</small></div></div></aside>`;
}

function v0312CeadCatalogSubgroups(mappingKey){
  const catalog=V0312_CACHE.ceadCatalog,model=catalog?.cead_model||{},mapping=catalog?.aml_mapping||{};
  const hit=/^(family|group|subgroup):(\d+)$/.exec(String(mappingKey||''));
  if(!hit)return V0312_FALLBACK_SUBGROUPS[mappingKey]||[];
  const [_,type,id]=hit;if(type==='subgroup')return [{id,label:model.subgroups?.[id]||id,...(mapping[`subgroup:${id}`]||{})}];
  let groupIds=[];if(type==='group')groupIds=[id];else groupIds=Object.keys(model.groups||{}).filter(g=>g.startsWith(id));
  const out=[];for(const [sid,label] of Object.entries(model.subgroups||{})){if(!groupIds.some(g=>sid.startsWith(g)))continue;const mm=mapping[`subgroup:${sid}`]||{};out.push({id:sid,label,class:mm.class||'context_or_unresolved',eligible:mm.score_eligible===true,confidence:mm.confidence,basis:mm.basis});}
  return out.length?out:(V0312_FALLBACK_SUBGROUPS[mappingKey]||[]);
}
function v0312CeadRows(region){
  const all=V022_STATE.data?.cead||[],agg=new Map();
  for(const x of all){if(x?.aml_class!=='predicate_family_direct')continue;const rn=typeof v022RegionName==='function'?v022RegionName(x.region_name):x.region_name;if(rn!==region)continue;const key=x.crime_category||'Sin categoría';if(!agg.has(key))agg.set(key,{category:key,cases:0,previous:0,year:null,previousYear:null,mappings:new Set(),sources:new Set(),tiers:new Set(),qualities:new Set(),communes:new Set(),interpretation:x.interpretation||''});const a=agg.get(key);a.cases+=Number(x.cases_policiales)||0;a.previous+=Number(x.previous_cases_policiales)||0;a.year=Math.max(Number(a.year)||0,Number(x.year)||0)||x.year;a.previousYear=Math.max(Number(a.previousYear)||0,Number(x.previous_year)||0)||x.previous_year;if(x.article27_mapping_key)a.mappings.add(x.article27_mapping_key);if(x.source_id)a.sources.add(x.source_id);if(x.source_tier)a.tiers.add(x.source_tier);if(x.quality_status)a.qualities.add(x.quality_status);if(x.commune_code||x.commune_name)a.communes.add(String(x.commune_code||x.commune_name));}
  const rows=[...agg.values()];const total=rows.reduce((s,x)=>s+x.cases,0);for(const x of rows){x.yoy=x.previous>0?100*(x.cases-x.previous)/x.previous:null;x.share=total>0?100*x.cases/total:null;x.mappings=[...x.mappings];x.sources=[...x.sources];x.tiers=[...x.tiers];x.qualities=[...x.qualities];x.communeCount=x.communes.size;delete x.communes;}return rows.sort((a,b)=>b.cases-a.cases);
}
function v0312CeadClassLabel(x){if(x.eligible||x.score_eligible===true)return 'homologación directa';if(String(x.class||'').includes('candidate'))return 'requiere precisión penal';if(String(x.class||'').includes('context'))return 'solo contexto';return 'clasificación pendiente';}
function v0312CeadPanel(r){
  if(!r)return '';
  const rows=v0312CeadRows(r.region),total=v031Finite(r.cead?.cases)?Number(r.cead.cases):rows.reduce((s,x)=>s+x.cases,0),previous=v031Finite(r.cead?.previous_cases)?Number(r.cead.previous_cases):rows.reduce((s,x)=>s+x.previous,0),yoy=previous>0?100*(total-previous)/previous:null,year=r.cead?.year||rows[0]?.year||'—';
  const cards=rows.map(x=>{const mapping=x.mappings[0]||'',sub=v0312CeadCatalogSubgroups(mapping),mapMeta=V0312_CACHE.ceadCatalog?.aml_mapping?.[mapping]||{};return `<article class="v0312-cead-evidence"><header><div><span>FAMILIA DELICTUAL</span><h4>${esc(x.category)}</h4></div><strong>${v031Num(x.cases,0)}</strong></header><div class="v0312-cead-metrics"><div><span>${esc(String(x.year||year))}</span><b>${v031Num(x.cases,0)}</b><small>casos policiales</small></div><div><span>${esc(String(x.previousYear||'prev.'))}</span><b>${v031Num(x.previous,0)}</b><small>comparación</small></div><div><span>Variación</span><b>${v031Finite(x.yoy)?`${Number(x.yoy)>=0?'+':''}${v031Num(x.yoy,1)}%`:'—'}</b><small>interanual</small></div><div><span>Peso regional</span><b>${v031Finite(x.share)?`${v031Num(x.share,1)}%`:'—'}</b><small>${x.communeCount} comunas observadas</small></div></div><div class="v0312-cead-subtypes"><span>Qué delitos comprende esta familia</span>${sub.length?`<ul>${sub.map(s=>`<li class="${s.eligible||s.score_eligible===true?'eligible':String(s.class||'').includes('candidate')?'candidate':'context'}"><b>${esc(s.label)}</b><small>${esc(v0312CeadClassLabel(s))}</small></li>`).join('')}</ul>`:'<p>El corte disponible no incorpora un desglose más granular para esta familia.</p>'}</div><footer><span>${mapping?`Homologación ${esc(mapping)}`:'Sin clave jurídica'}${mapMeta?.confidence?` · confianza ${esc(mapMeta.confidence)}`:''}</span>${mapMeta?.basis?`<small>${esc(mapMeta.basis)}</small>`:''}</footer></article>`;}).join('');
  return `<section class="v031-card v0312-cead-panel" id="v0312-cead-detail"><header class="v031-card-head"><div><span>CEAD · EVIDENCIA DELICTUAL</span><h3>Qué delitos están detrás de la señal en ${esc(v031Short(r.region))}</h3><p>El componente CEAD del ${V0312_INDICATOR_SHORT} usa casos policiales asociados a familias homologadas con delitos base. Aquí se muestra el volumen observado antes de normalizarlo en percentiles.</p></div><div class="v0312-cead-actions"><a href="${V0312_CEAD_OFFICIAL}" target="_blank" rel="noopener noreferrer">Abrir CEAD oficial ↗</a><a href="${V0312_CEAD_DATASET}" target="_blank" rel="noopener noreferrer">Ver dataset usado ↗</a></div></header><div class="v0312-cead-summary"><div><span>Casos policiales ${esc(String(year))}</span><b>${v031Num(total,0)}</b><small>denuncias + detenciones flagrantes conocidas por policías</small></div><div><span>Variación interanual</span><b>${v031Finite(yoy)?`${Number(yoy)>=0?'+':''}${v031Num(yoy,1)}%`:'—'}</b><small>sobre el mismo corte comparable</small></div><div><span>Presión relativa CEAD</span><b>${v031Num(r.parts?.cead,1)}</b><small>percentil usado por el ${V0312_INDICATOR_SHORT}</small></div><div><span>Intensidad</span><b>${v031Num(r.cead?.cases_per_1000_entities,1)}</b><small>casos por 1.000 entidades activas</small></div></div><div class="v0312-cead-grid">${cards||'<div class="v031-empty">No hay detalle CEAD disponible para la región seleccionada.</div>'}</div><div class="v0312-cead-provenance"><div><b>Cómo leerlo</b><span>Un caso policial territorial no acredita delito base de una entidad ni riesgo de LA/FT. Sirve como contexto delictual para priorizar territorio.</span></div><div><b>Trazabilidad</b><span>El Workbench consume una réplica pública documentada del CEAD; el enlace oficial permite contrastar la estadística y el dataset enlazado permite auditar el corte exacto.</span></div><a href="${V0312_CEAD_CATALOG_PAGE}" target="_blank" rel="noopener noreferrer">Ver catálogo CEAD ↔ artículo 27 ↗</a></div></section>`;
}

function v0312Pressure(all){
  const rows=v031Filtered(all),data=V031_CORE_COMPONENTS.map(([k,label])=>({k,label,value:v031Mean(rows,r=>r.parts?.[k])})).filter(x=>v031Finite(x.value)).sort((a,b)=>b.value-a.value);
  return `<section class="v031-card v031-chart"><header class="v031-card-head"><div><span>COMPONENTES</span><h3>Señales que elevan la prioridad territorial</h3><p>Media de percentiles entre las regiones visibles. Cambiar de componente solo cambia la capa del mapa; no recalcula el ${V0312_INDICATOR_SHORT}.</p></div></header><div class="v031-pressure">${data.map(x=>`<button type="button" class="${V031_STATE.mapMetric===x.k?'active':''}" data-v031-metric="${esc(x.k)}"><span>${esc(x.label)}</span><progress max="100" value="${Number(x.value)}"></progress><b>${v031Num(x.value,1)}</b></button>`).join('')}</div></section>`;
}
function v0312RegionalTable(all){
  const rows=[...v031Filtered(all)].sort((a,b)=>(Number(b.scores?.B)||-1)-(Number(a.scores?.B)||-1));
  return `<section class="v031-card v031-table-card v0312-table-card"><header class="v031-card-head"><div><span>COMPARADOR REGIONAL</span><h3>Regiones ordenadas por ${V0312_INDICATOR_SHORT}</h3><p>Vista compacta sin desplazamiento horizontal. Las métricas se agrupan para mantener todo el comparador visible.</p></div><b>${rows.length} visibles</b></header><div class="v031-tablewrap v0312-tablewrap"><table><colgroup><col class="rank"><col class="region"><col class="ipt"><col class="profile"><col class="phen"><col class="cead"><col class="public"><col class="other"><col class="priority"></colgroup><thead><tr><th>#</th><th>Región</th><th>${V0312_INDICATOR_SHORT}</th><th>Perfil</th><th>Fenómenos</th><th>CEAD</th><th>Ppto. / CGR</th><th>IPA3 / Sector</th><th>Prioridad</th></tr></thead><tbody>${rows.map((r,i)=>{const p=v031Profile(r),pri=v031Priority(r);return `<tr tabindex="0" data-v031-row-region="${esc(r.region)}" class="${V029_FILTERS.region===r.region?'selected':''}"><td>${i+1}</td><td><b>${esc(v031Short(r.region))}</b><small>Cob. ${v031Pct(r.coverage)}</small></td><td><strong class="v031-table-score ${v031Tone(r.scores.B)}">${v031Num(r.scores.B,1)}</strong><small>${esc(v031BandLabel(r.scores.B))}</small></td><td><b>${esc(p?.label||'—')}</b><small>${esc(p?.confidence_label||'—')} · ${v031Num(p?.confidence_score,0)}/100</small></td><td><div class="v031-table-phen">${(r.phenomena||[]).slice(0,2).map(v031PhenChip).join('')||'<span>—</span>'}</div></td><td><b>${v031Num(r.parts?.cead,1)}</b><small>${v031Num(r.cead?.cases,0)} casos</small></td><td><b>P ${v031Num(r.parts?.budget,0)}</b><small>CGR ${v031Num(r.parts?.cgr,0)}</small></td><td><b>IPA ${v031Num(r.parts?.ipa,0)}</b><small>Sec ${v031Num(r.parts?.sector,0)}</small></td><td><span class="v031-priority-pill ${String(r.analytical_priority||'CONTEXT').toLowerCase()}" title="${esc(pri.desc)}">${esc(pri.label)}</span></td></tr>`;}).join('')||'<tr><td colspan="9">Sin regiones comparables.</td></tr>'}</tbody></table></div></section>`;
}
function v0312DeepDive(r){if(!r)return '';return `<section class="v031-deep-grid"><article class="v031-card"><header class="v031-card-head"><div><span>COMUNAS</span><h3>Focos internos de ${esc(v031Short(r.region))}</h3><p>Ranking comunal por ${V0312_INDICATOR_SHORT} disponible. Una comuna sin dato no se materializa como cero.</p></div></header>${v031TopCommunes(r)}</article><article class="v031-card"><header class="v031-card-head"><div><span>EXPOSICIÓN ECONÓMICA</span><h3>Sectores Ley 19.913</h3><p>Homologaciones VALIDATED_RULE; presencia actividad-sector no afirma inscripción UAF.</p></div></header>${v031TopSectors(r)}</article></section>`;}
function v0312Guardrails(){return `<section class="v031-guard"><div><b>El ${V0312_INDICATOR_SHORT} es relativo</b><span>Ordena territorios para priorizar revisión; no es una probabilidad de LA/FT.</span></div><div><b>CEAD muestra casos policiales</b><span>El volumen delictual territorial no acredita conducta de una entidad ubicada allí.</span></div><div><b>Contexto no es señal adversa</b><span>OSFL y prensa permanecen visibles como contexto y aportan 0 al ${V0312_INDICATOR_SHORT}.</span></div><div><b>Missing ≠ 0</b><span>Falta de fuente reduce cobertura y permanece explícita.</span></div></section>`;}

function v0312BindExtra(root){
  root.querySelectorAll('[data-v0312-cead]').forEach(el=>el.addEventListener('click',()=>root.querySelector('#v0312-cead-detail')?.scrollIntoView({behavior:'smooth',block:'start'})));
}

v022ExportRows=function(level='region'){
  const rows=v0312BaseExportRows(level),source=level==='region'?(V022_STATE.computed?.regions||[]):(V022_STATE.computed?.communes||[]),byId=new Map(source.map(r=>[String(r.territory_id||r.id||r.name),r]));
  return rows.map(x=>{const r=byId.get(String(x.territory_id||x.id||x.name))||source.find(r0=>r0.region===x.region&&r0.name===x.name);return {...x,indicator_name:V0312_INDICATOR,indicator_acronym:V0312_INDICATOR_SHORT,ipt_value:r?.scores?.B??null,analytical_view_version:V0312_VIEW,score_formula_version:V031_SCORE_FORMULA};});
};
v022ExportCsv=function(){const rows=[...v022ExportRows('region'),...v022ExportRows('commune')];v022Download(`aml_indice_prioridad_territorial_${new Date().toISOString().slice(0,10)}.csv`,v022Csv(rows),'text/csv;charset=utf-8');};
v022ExportJson=function(){const payload={schema:'AML_GEOGRAPHIC_RISK_EXPORT_V1',generated_at:new Date().toISOString(),indicator:{name:V0312_INDICATOR,acronym:V0312_INDICATOR_SHORT,analytical_view_version:V0312_VIEW},technical_contract:{internal_method_id:'B',formula_version:V031_SCORE_FORMULA},semantics:'TERRITORIAL_PRIORITIZATION_NOT_ENTITY_AML_PROBABILITY',guardrails:['MISSING_IS_NOT_ZERO_STRICT','TERRITORIAL_SIGNAL_IS_NOT_ENTITY_ATTRIBUTION','CEAD_CASES_ARE_TERRITORIAL_NOT_ENTITY_ATTRIBUTION','OSFL_CONTEXT_DOES_NOT_SCORE','PRESS_CONTEXT_DOES_NOT_SCORE'],region_rows:v022ExportRows('region'),commune_rows:v022ExportRows('commune')};v022Download(`aml_indice_prioridad_territorial_${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(payload,null,2),'application/json;charset=utf-8');};

v022Render=function(){
  V022_STATE.method='B';v0312NoLegacyFilters();
  const root=v019Content();
  if(!root||!V022_STATE.computed||typeof V030_CHILE==='undefined'){v0312ApplyVersion();return;}
  const all=v031All(),selected=v031Selected(all);if(selected)V022_STATE.selectedRegion=selected.region;
  root.classList.remove('v029-territory','v030-osfl');root.classList.add('v031-territory','v0312-territory');
  root.innerHTML=`${v0312Hero(all)}${v031SourceStrip()}${v0312FilterRail(all)}<div class="v031-main-grid">${v0312Map(all)}${v0312Dossier(selected)}</div>${v0312CeadPanel(selected)}<section class="v031-analytics-grid v0312-analytics-grid">${v031CountChart(all,'phenomena')}${v0312Pressure(all)}</section>${v0312RegionalTable(all)}${v0312DeepDive(selected)}${v0312Guardrails()}${v031Exports()}`;
  v031Bind(root);v0312BindExtra(root);v0312ApplyVersion();
};

window.AML_TERRITORY_COCKPIT={version:V0312_VIEW,indicator:{name:V0312_INDICATOR,short:V0312_INDICATOR_SHORT},scoreFormula:V031_SCORE_FORMULA,state:V031_STATE,metrics:V031_METRICS,render:v022Render,clear:v031Clear};
window.AML_TERRITORY_CEAD={official:V0312_CEAD_OFFICIAL,dataset:V0312_CEAD_DATASET,catalog:V0312_CEAD_CATALOG_PAGE,rows:v0312CeadRows};

async function v0312LoadCeadCatalog(){
  if(V0312_CACHE.ceadCatalog||V0312_CACHE.ceadCatalogLoading)return;V0312_CACHE.ceadCatalogLoading=true;
  try{const r=await fetch(V0312_CEAD_CATALOG_RAW,{cache:'no-store'});if(r.ok)V0312_CACHE.ceadCatalog=await r.json();}catch(e){console.warn('CEAD catalog context unavailable',e);}finally{V0312_CACHE.ceadCatalogLoading=false;if(state?.view==='territory'&&V022_STATE.computed)v022Render();}
}
v0312ApplyVersion();v0312LoadCeadCatalog();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{v0312ApplyVersion();setTimeout(()=>{if(state?.view==='territory'&&V022_STATE.computed)v022Render();},0);},{once:true});
else setTimeout(()=>{v0312ApplyVersion();if(state?.view==='territory'&&V022_STATE.computed)v022Render();},0);
