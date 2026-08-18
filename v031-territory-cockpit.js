'use strict';

/* AML Workbench v0.31.0 · Geographic Risk Cockpit
 * Complete territorial UX redesign using the native OSFL visual grammar and polygon map.
 * Score B / GEO-RISK-B-0.27.0 remains the definitive geographic score.
 * This layer changes exploration, not scoring.
 */
const V031='0.31.0';
const V031_BUILD='0310';
const V031_VIEW='TERRITORY-COCKPIT-0.31.0';
const V031_SCORE_FORMULA=typeof V027_GEO_METHOD!=='undefined'?V027_GEO_METHOD:'GEO-RISK-B-0.27.0';
const V031_STATE={mapMetric:'score'};

const V031_METRICS={
  score:{label:'Score B',short:'Score B',kind:'risk',get:r=>r?.scores?.B},
  cead:{label:'Presión CEAD',short:'CEAD',kind:'risk',get:r=>r?.parts?.cead},
  budget:{label:'Presupuesto Abierto',short:'Presupuesto',kind:'risk',get:r=>r?.parts?.budget},
  cgr:{label:'Hallazgos CGR',short:'CGR',kind:'risk',get:r=>r?.parts?.cgr},
  ipa:{label:'Presión IPA3',short:'IPA3',kind:'risk',get:r=>r?.parts?.ipa},
  sector:{label:'Sectores Ley 19.913',short:'Sector 19.913',kind:'risk',get:r=>r?.parts?.sector},
  cross:{label:'Convergencia',short:'Convergencia',kind:'risk',get:r=>r?.parts?.cross},
  profile:{label:'Perfil conductor',short:'Perfil',kind:'profile',get:r=>v031Profile(r)?.code},
  osfl:{label:'Contexto OSFL',short:'OSFL',kind:'context',get:r=>r?.parts?.osfl},
  press:{label:'Prensa territorial',short:'Prensa',kind:'context',get:r=>r?.parts?.press}
};

const V031_CORE_COMPONENTS=[
  ['cead','CEAD'],['budget','Presupuesto'],['cgr','CGR'],['ipa','IPA3'],['sector','Sector 19.913'],['cross','Convergencia']
];

const v031LegacyRender=v022Render;
const v031BaseExportRows=v022ExportRows;
const v031BaseShell=shell;

function v031ApplyVersion(){
  try{if(typeof V0206_VERSION_OBSERVER!=='undefined'&&V0206_VERSION_OBSERVER){V0206_VERSION_OBSERVER.disconnect();V0206_VERSION_OBSERVER=null;}}catch{}
  window.__AML_ACTIVE_VERSION__=V031;window.__AML_BUILD__=V031_BUILD;
  const label=`Operational Radar · v${V031}`;const badge=document.querySelector('.v019-brand small');
  if(badge){badge.setAttribute('data-runtime-label',label);badge.setAttribute('aria-label',label);badge.dataset.activeVersion=V031;badge.textContent=label;}
  document.title=`AML Analytical Workbench · v${V031}`;
  document.documentElement.setAttribute('data-aml-version',V031);document.documentElement.setAttribute('data-aml-build',V031_BUILD);
}
shell=function(title,subtitle){v031BaseShell(title,subtitle);v031ApplyVersion();};
if(typeof v0211ApplyVersion==='function')v0211ApplyVersion=v031ApplyVersion;
window.__AML_RUNTIME_VERSION_APPLIER__=v031ApplyVersion;

function v031Finite(v){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));}
function v031Num(v,d=1){const n=v031Finite(v)?Number(v):null;return n===null?'—':n.toLocaleString('es-CL',{minimumFractionDigits:d,maximumFractionDigits:d});}
function v031Pct(v){return v031Finite(v)?`${v031Num(v,0)}%`:'—';}
function v031Profile(r){return r?.explanatory_profile||(typeof v026Profile==='function'?v026Profile(r):null);}
function v031Phen(code){return typeof v029PhenomenonMeta==='function'?v029PhenomenonMeta(code):(V029_PHENOMENA?.[code]||{label:code,short:code,desc:''});}
function v031Priority(r){const code=r?.analytical_priority||'CONTEXT';return V029_PRIORITY?.[code]||{label:code,desc:''};}
function v031Band(v){const n=v031Finite(v)?Number(v):null;if(n===null)return 'SIN_DATO';if(n>=75)return 'MUY_ALTO';if(n>=60)return 'ALTO';if(n>=40)return 'MEDIO';if(n>=20)return 'BAJO';return 'MUY_BAJO';}
function v031BandLabel(v){return ({MUY_ALTO:'Muy alto',ALTO:'Alto',MEDIO:'Medio',BAJO:'Bajo',MUY_BAJO:'Muy bajo',SIN_DATO:'Sin dato'})[v031Band(v)]||'Sin dato';}
function v031Tone(v){return v031Band(v).toLowerCase().replaceAll('_','-');}
function v031MetricValue(r,id){return V031_METRICS[id]?.get(r);}
function v031MetricText(r,id){const v=v031MetricValue(r,id);if(id==='profile')return v031Profile(r)?.label||'Sin perfil';return v031Finite(v)?v031Num(v,1):'Sin dato';}
function v031Shape(region){
  const k=String(region||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ');
  if(k.includes('ARICA'))return 'Arica y Parinacota';if(k.includes('TARAPACA'))return 'Tarapacá';if(k.includes('ANTOFAGASTA'))return 'Antofagasta';
  if(k.includes('ATACAMA'))return 'Atacama';if(k.includes('COQUIMBO'))return 'Coquimbo';if(k.includes('VALPARAISO'))return 'Valparaíso';
  if(k.includes('METROPOLITANA'))return 'Metropolitana';if(k.includes('HIGGINS')||k.includes('LIBERTADOR'))return "O'Higgins";if(k.includes('MAULE'))return 'Maule';
  if(k.includes('NUBLE'))return 'Ñuble';if(k.includes('BIOBIO')||k.includes('BIO BIO'))return 'Biobío';if(k.includes('ARAUCANIA'))return 'La Araucanía';
  if(k.includes('LOS RIOS'))return 'Los Ríos';if(k.includes('LOS LAGOS'))return 'Los Lagos';if(k.includes('AYSEN')||k.includes('AISEN'))return 'Aysén';
  if(k.includes('MAGALLANES'))return 'Magallanes';return null;
}
function v031Short(region){const s=v031Shape(region);return s==='Metropolitana'?'Metropolitana':s==="O'Higgins"?"O'Higgins":s||region||'—';}
function v031Heat(v){if(!v031Finite(v))return 'q0';const n=Number(v);return n<20?'q1':n<40?'q2':n<60?'q3':n<75?'q4':'q5';}
function v031Filtered(all,omit=null){return typeof v029Rows==='function'?v029Rows(all,omit):all;}
function v031All(){const rows=V022_STATE.computed?.regions||[];if(typeof v029Annotate==='function')v029Annotate(rows);return rows;}
function v031Selected(all){
  const visible=v031Filtered(all);if(!visible.length)return null;
  if(V029_FILTERS?.region){const x=all.find(r=>r.region===V029_FILTERS.region);if(x)return x;}
  const current=visible.find(r=>r.region===V022_STATE.selectedRegion);if(current)return current;
  return [...visible].sort((a,b)=>(Number(b.scores?.B)||-1)-(Number(a.scores?.B)||-1))[0]||visible[0];
}
function v031Mean(rows,get){const a=rows.map(get).filter(v031Finite).map(Number);return a.length?a.reduce((s,x)=>s+x,0)/a.length:null;}
function v031SetRegion(region){
  if(!region)return;const turningOff=V029_FILTERS.region===region;V029_FILTERS.region=turningOff?null:region;
  V022_STATE.selectedRegion=region;v022Render();
}
function v031SetSingle(dim,value){
  if(dim==='region'){V029_FILTERS.region=value||null;if(value)V022_STATE.selectedRegion=value;}
  else if(dim==='profiles'){V029_FILTERS.profiles.clear();if(value)V029_FILTERS.profiles.add(value);}
  else if(dim==='phenomena'){V029_FILTERS.phenomena.clear();if(value)V029_FILTERS.phenomena.add(value);}
  else if(dim==='drivers'){V029_FILTERS.drivers.clear();if(value)V029_FILTERS.drivers.add(value);}
  v022Render();
}
function v031Toggle(dim,value){if(typeof v029ToggleFilter==='function')v029ToggleFilter(dim,value);}
function v031Clear(){if(typeof v029ClearFilters==='function')v029ClearFilters();V031_STATE.mapMetric='score';v022Render();}

function v031SourceStrip(){
  const s=V022_STATE.data?.sourceStatus||{};const items=[['sectorMap','Sectores 19.913'],['cead','CEAD'],['budget','Presupuesto'],['cgr','CGR'],['ipa','IPA3'],['territories','Context Hub']];
  return `<div class="v031-sources">${items.map(([k,l])=>`<span class="${s[k]?'ok':'miss'}"><i></i>${esc(l)}<b>${s[k]?'activo':'sin corte'}</b></span>`).join('')}<small>Ausencia de fuente baja cobertura; nunca equivale a riesgo cero.</small></div>`;
}
function v031OptionCounts(all,omit,extract){const map=new Map();for(const r of v031Filtered(all,omit)){for(const value of extract(r)||[]){if(!value)continue;map.set(value,(map.get(value)||0)+1);}}return map;}
function v031FilterRail(all){
  const rc=v031OptionCounts(all,'region',r=>[r.region]),pc=v031OptionCounts(all,'profiles',r=>[v031Profile(r)?.code||'EVIDENCIA_INSUFICIENTE']),fc=v031OptionCounts(all,'phenomena',r=>r.phenomena||[]),dc=v031OptionCounts(all,'drivers',r=>[v031Profile(r)?.primary?.code||'']);
  const regions=[...rc].sort((a,b)=>a[0].localeCompare(b[0],'es')).map(([v,n])=>`<option value="${esc(v)}" ${V029_FILTERS.region===v?'selected':''}>${esc(v031Short(v))} · ${n}</option>`).join('');
  const profiles=[...pc].sort((a,b)=>b[1]-a[1]).map(([v,n])=>`<option value="${esc(v)}" ${V029_FILTERS.profiles.size===1&&V029_FILTERS.profiles.has(v)?'selected':''}>${esc(v026Meta(v).label)} · ${n}</option>`).join('');
  const phenomena=[...fc].sort((a,b)=>b[1]-a[1]).map(([v,n])=>`<option value="${esc(v)}" ${V029_FILTERS.phenomena.size===1&&V029_FILTERS.phenomena.has(v)?'selected':''}>${esc(v031Phen(v).label)} · ${n}</option>`).join('');
  const drivers=[...dc].filter(([v])=>v).sort((a,b)=>b[1]-a[1]).map(([v,n])=>`<option value="${esc(v)}" ${V029_FILTERS.drivers.size===1&&V029_FILTERS.drivers.has(v)?'selected':''}>${esc(v026Meta(v).label)} · ${n}</option>`).join('');
  const visible=v031Filtered(all).length;
  return `<section class="v031-filter-shell"><div class="v031-filter-grid"><label><span>Región</span><select data-v031-select="region"><option value="">Todo Chile</option>${regions}</select></label><label><span>Perfil conductor</span><select data-v031-select="profiles"><option value="">Todos los perfiles</option>${profiles}</select></label><label><span>Fenómeno</span><select data-v031-select="phenomena"><option value="">Todos los fenómenos</option>${phenomena}</select></label><label><span>Driver principal</span><select data-v031-select="drivers"><option value="">Todos los drivers</option>${drivers}</select></label><div class="v031-visible"><b>${visible}</b><span>de ${all.length}<br>regiones</span></div></div>${v031ActiveFilters()}</section>`;
}
function v031ActiveFilters(){
  const chips=[];if(V029_FILTERS.region)chips.push(`<button type="button" data-v031-filter="region" data-v031-value="${esc(V029_FILTERS.region)}">${esc(v031Short(V029_FILTERS.region))} ×</button>`);
  for(const v of V029_FILTERS.profiles)chips.push(`<button type="button" data-v031-filter="profiles" data-v031-value="${esc(v)}">Perfil · ${esc(v026Meta(v).short)} ×</button>`);
  for(const v of V029_FILTERS.phenomena)chips.push(`<button type="button" data-v031-filter="phenomena" data-v031-value="${esc(v)}">${esc(v031Phen(v).short)} ×</button>`);
  for(const v of V029_FILTERS.drivers)chips.push(`<button type="button" data-v031-filter="drivers" data-v031-value="${esc(v)}">Driver · ${esc(v026Meta(v).short)} ×</button>`);
  for(const v of V029_FILTERS.matrix){const [s,c]=v.split('|');chips.push(`<button type="button" data-v031-filter="matrix" data-v031-value="${esc(v)}">${esc(s.replaceAll('_',' '))} · ${esc(c)} ×</button>`);}
  return chips.length?`<div class="v031-filter-chips"><span>Filtros activos</span>${chips.join('')}<button type="button" class="clear" data-v031-clear>Limpiar todo</button></div>`:`<div class="v031-filter-chips empty"><span>Exploración nacional · mapa, gráficos y tabla comparten el mismo filtro</span></div>`;
}
function v031Headline(all){
  const rows=v031Filtered(all);if(!rows.length)return {top:null,phen:null,conv:null};
  const top=[...rows].filter(r=>v031Finite(r.scores?.B)).sort((a,b)=>(Number(b.scores.B)||0)-(Number(a.scores.B)||0))[0];
  const pm=new Map();for(const r of rows)for(const c of r.phenomena||[])pm.set(c,(pm.get(c)||0)+1);const phen=[...pm].sort((a,b)=>b[1]-a[1])[0]||null;
  const conv=[...rows].sort((a,b)=>Number(v031Profile(b)?.elevated_family_count||0)-Number(v031Profile(a)?.elevated_family_count||0)||Number(b.scores?.B||0)-Number(a.scores?.B||0))[0];
  return {top,phen,conv};
}
function v031Hero(all){
  const h=v031Headline(all),visible=v031Filtered(all).length;
  return `<section class="v031-hero"><div class="v031-hero-copy"><span class="v031-kicker">RIESGO GEOGRÁFICO · INTELIGENCIA TERRITORIAL</span><h2>Dónde concentrar revisión y qué lo está explicando</h2><p>Score B compara territorios mediante percentiles robustos y evidencia estructurada. La vista separa drivers de riesgo, exposición y contexto para priorizar profundización sin transferir características territoriales a una entidad individual.</p><div class="v031-hero-tags"><span>Score B oficial</span><span>${esc(V031_SCORE_FORMULA)}</span><span>IPA3 v0.4 shadow</span><span>Missing ≠ 0</span></div></div><aside class="v031-official"><span>MODELO TERRITORIAL</span><b>Score B</b><strong>Percentil robusto</strong><small>Único score geográfico activo</small></aside><div class="v031-insight-strip"><button type="button" ${h.top?`data-v031-region="${esc(h.top.region)}"`:''}><span>Mayor señal visible</span><b>${h.top?esc(v031Short(h.top.region)):'—'}</b><small>${h.top?`Score ${v031Num(h.top.scores.B,1)} · ${esc(v031Profile(h.top)?.label||'sin perfil')}`:'Sin región comparable'}</small></button><button type="button" ${h.phen?`data-v031-filter="phenomena" data-v031-value="${esc(h.phen[0])}"`:''}><span>Fenómeno dominante</span><b>${h.phen?esc(v031Phen(h.phen[0]).short):'—'}</b><small>${h.phen?`${h.phen[1]} de ${visible} regiones visibles`:'Sin marca dominante'}</small></button><button type="button" ${h.conv?`data-v031-region="${esc(h.conv.region)}"`:''}><span>Mayor convergencia</span><b>${h.conv?esc(v031Short(h.conv.region)):'—'}</b><small>${h.conv?`${v031Profile(h.conv)?.elevated_family_count||0} familias elevadas`:'Sin comparación'}</small></button></div></section>`;
}
function v031MetricButtons(){return `<div class="v031-map-metrics">${Object.entries(V031_METRICS).map(([id,m])=>`<button type="button" class="${V031_STATE.mapMetric===id?'active':''} ${m.kind==='context'?'context':''}" data-v031-metric="${esc(id)}">${esc(m.short)}${m.kind==='context'?'<small>contexto</small>':''}</button>`).join('')}</div>`;}
function v031MapLegend(){const m=V031_METRICS[V031_STATE.mapMetric];if(m.kind==='profile')return `<div class="v031-profile-legend"><span><i class="multi"></i>Multifuente</span><span><i class="crime"></i>Delictual</span><span><i class="public"></i>Público</span><span><i class="super"></i>Supervisivo</span><span><i class="san"></i>Sancionatorio</span><span><i class="econ"></i>Económico</span></div>`;return `<div class="v031-map-legend"><span>muy bajo</span><i class="q1"></i><i class="q2"></i><i class="q3"></i><i class="q4"></i><i class="q5"></i><span>muy alto</span>${m.kind==='context'?'<b>contexto · no puntúa</b>':''}</div>`;}
function v031Map(all){
  if(typeof V030_CHILE==='undefined')return '<div class="v031-empty">Geometría regional no disponible.</div>';
  const metric=V031_STATE.mapMetric,m=V031_METRICS[metric],byShape=new Map(all.map(r=>[v031Shape(r.region),r]).filter(x=>x[0]));const visibleSet=new Set(v031Filtered(all).map(r=>r.region));
  const paths=V030_CHILE.order.map(shape=>{const r=byShape.get(shape),raw=v031MetricValue(r,metric),selected=r?.region===V029_FILTERS.region||r?.region===V022_STATE.selectedRegion,dim=r&&!visibleSet.has(r.region);const profile=v031Profile(r);const cls=m.kind==='profile'?'profile':v031Heat(raw);const fill=m.kind==='profile'&&profile&&typeof v026ProfileColor==='function'?` fill="${v026ProfileColor(profile.code)}"`:'';const title=r?`${v031Short(r.region)} · ${m.label}: ${v031MetricText(r,metric)}${m.kind==='context'?' · contexto no puntuante':''}`:`${shape} · sin dato`;return `<path class="v031-region ${cls} ${selected?'selected':''} ${dim?'dim':''}" data-v031-region="${r?esc(r.region):''}" d="${esc(V030_CHILE.paths[shape])}" tabindex="${r?'0':'-1'}"${fill}><title>${esc(title)}</title></path>`;}).join('');
  const ranked=[...v031Filtered(all)].filter(r=>metric==='profile'||v031Finite(v031MetricValue(r,metric))).sort((a,b)=>metric==='profile'?(Number(b.scores?.B)||0)-(Number(a.scores?.B)||0):Number(v031MetricValue(b,metric))-Number(v031MetricValue(a,metric))).slice(0,7);
  return `<section class="v031-card v031-map-card"><header class="v031-card-head"><div><span>TERRITORIO</span><h3>Mapa nacional de riesgo y contexto</h3><p>Geometría regional del módulo OSFL. Cambia de capa sin recalcular Score B; selecciona una región para cruzar toda la vista.</p></div>${v031MetricButtons()}</header><div class="v031-map-layout"><div class="v031-map-stage"><svg viewBox="${esc(V030_CHILE.viewBox)}" role="img" aria-label="Mapa de Chile por ${esc(m.label)}">${paths}</svg>${v031MapLegend()}</div><aside class="v031-map-side"><div class="v031-side-title"><div><span>CAPA ACTIVA</span><b>${esc(m.label)}</b></div><small>${m.kind==='risk'?'driver/score normalizado':m.kind==='context'?'contexto visible · aporte 0':'clasificación explicativa'}</small></div><div class="v031-ranking">${ranked.map((r,i)=>`<button type="button" class="${V029_FILTERS.region===r.region?'active':''}" data-v031-region="${esc(r.region)}"><em>${i+1}</em><span><b>${esc(v031Short(r.region))}</b><small>${esc(v031Profile(r)?.label||'sin perfil')}</small></span><strong>${metric==='profile'?v031Num(r.scores?.B,1):v031MetricText(r,metric)}</strong></button>`).join('')||'<div class="v031-empty">Sin regiones comparables con los filtros actuales.</div>'}</div></aside></div><footer>El mapa describe territorio. CEAD, CGR, Presupuesto, prensa y OSFL no atribuyen conducta a personas o entidades por proximidad geográfica.</footer></section>`;
}
function v031ScoreBadge(r){return `<div class="v031-score ${v031Tone(r?.scores?.B)}"><span>SCORE B</span><b>${v031Num(r?.scores?.B,1)}</b><small>${esc(v031BandLabel(r?.scores?.B))}</small></div>`;}
function v031PhenChip(code){const m=v031Phen(code),active=V029_FILTERS.phenomena.has(code);return `<button type="button" class="v031-phen ${active?'active':''}" data-v031-filter="phenomena" data-v031-value="${esc(code)}" title="${esc(m.label+'. '+m.desc)}" aria-label="${esc(m.label+'. '+m.desc)}">${esc(m.short)}</button>`;}
function v031Components(r){return `<div class="v031-component-list">${V031_CORE_COMPONENTS.map(([k,label])=>{const v=r?.parts?.[k];return `<button type="button" data-v031-metric="${esc(k)}"><span>${esc(label)}</span>${v031Finite(v)?`<progress max="100" value="${Number(v)}"></progress><b>${v031Num(v,1)}</b>`:'<em>Sin dato</em>'}</button>`;}).join('')}</div>`;}
function v031TopCommunes(r){if(!r)return '';const rows=(V022_STATE.computed?.communes||[]).filter(c=>c.region===r.region&&v031Finite(c.scores?.B)).sort((a,b)=>Number(b.scores.B)-Number(a.scores.B)).slice(0,5);return `<div class="v031-mini-list">${rows.map((c,i)=>`<div><em>${i+1}</em><span><b>${esc(c.name)}</b><small>Cob. ${v031Pct(c.coverage)} · CEAD ${v031Num(c.parts?.cead,0)} · Sector ${v031Num(c.parts?.sector,0)}</small></span><strong>${v031Num(c.scores.B,1)}</strong></div>`).join('')||'<p>Sin comunas comparables.</p>'}</div>`;}
function v031TopSectors(r){const rows=r?.sector?.top_sectors||[];return `<div class="v031-mini-list sectors">${rows.slice(0,4).map((s,i)=>`<div><em>${i+1}</em><span><b>${esc(s.name)}</b><small>${v031Num(s.started_2024,0)} inicios desde 2024 · ${v031Num(s.active,0)} presencias actividad-sector</small></span></div>`).join('')||'<p>Sin actividad fuertemente homologada en este corte.</p>'}</div>`;}
function v031Dossier(r){
  if(!r)return `<aside class="v031-card v031-dossier"><div class="v031-empty">Selecciona una región para abrir su lectura AML.</div></aside>`;
  const p=v031Profile(r),priority=v031Priority(r),phen=r.phenomena||[],second=p?.secondary;const ceadYoy=v031Finite(r.cead?.yoy_pct)?`${Number(r.cead.yoy_pct)>=0?'+':''}${v031Num(r.cead.yoy_pct,1)}%`:'—';
  return `<aside class="v031-card v031-dossier"><header><div><span>LECTURA AML · REGIÓN</span><h3>${esc(v031Short(r.region))}</h3><p>${esc(typeof v029RegionNarrative==='function'?v029RegionNarrative(r):'Lectura territorial del Score B.')}</p></div>${v031ScoreBadge(r)}</header><div class="v031-priority ${String(r.analytical_priority||'CONTEXT').toLowerCase()}"><span>Prioridad analítica</span><b>${esc(priority.label)}</b><small>${esc(priority.desc)}</small></div><div class="v031-driver-grid"><div><span>Driver principal</span><b>${esc(p?.primary?.label||'—')}</b><small>${v031Num(p?.primary?.value,1)} pctl</small></div><div><span>Segundo driver</span><b>${esc(second?.label||'—')}</b><small>${second?`brecha ${v031Num(p.gap,1)} pts`:'sin segundo comparable'}</small></div><div><span>Confianza explicativa</span><b>${esc(p?.confidence_label||'—')}</b><small>${v031Num(p?.confidence_score,0)}/100</small></div><div><span>Cobertura Score B</span><b>${v031Pct(r.coverage)}</b><small>missing nunca es 0</small></div></div><section><div class="v031-section-label"><span>HUELLA DE RIESGO</span><small>clic → proyectar capa en mapa</small></div>${v031Components(r)}</section><section><div class="v031-section-label"><span>FENÓMENOS EVIDENTES</span><small>hover explica · clic filtra</small></div><div class="v031-phen-list">${phen.map(v031PhenChip).join('')||'<span class="v031-muted">Sin marca destacada.</span>'}</div></section><div class="v031-facts"><div><span>CEAD último corte</span><b>${v031Num(r.cead?.cases,0)}</b><small>variación ${ceadYoy}</small></div><div><span>OSFL observadas</span><b>${v031Num(r.context?.osfl_count,0)}</b><small>contexto · no puntúa</small></div><div><span>Prensa territorial</span><b>${v031Num(r.context?.press_count,0)}</b><small>contexto · no evidencia</small></div></div></aside>`;
}
function v031CountChart(all,type){
  const rows=v031Filtered(all,type),map=new Map();let label='';
  for(const r of rows){let values=[];if(type==='phenomena'){values=r.phenomena||[];label='Fenómenos que más se repiten';}else if(type==='profiles'){values=[v031Profile(r)?.code].filter(Boolean);label='Perfiles que conducen el riesgo';}else{values=[v031Profile(r)?.primary?.code].filter(Boolean);label='Drivers dominantes';}for(const v of values)map.set(v,(map.get(v)||0)+1);}
  const data=[...map].sort((a,b)=>b[1]-a[1]).slice(0,7),max=Math.max(1,...data.map(x=>x[1]));
  return `<section class="v031-card v031-chart"><header class="v031-card-head"><div><span>${type==='phenomena'?'FENÓMENOS':type==='profiles'?'PERFILES':'DRIVERS'}</span><h3>${esc(label)}</h3><p>${type==='phenomena'?'Las marcas son explicativas y no suman puntos.':'Distribución recalculada con los filtros activos.'}</p></div><small>clic → filtrar</small></header><div class="v031-bar-list">${data.map(([code,n])=>{const text=type==='phenomena'?v031Phen(code).short:v026Meta(code).short;const dim=type;const active=V029_FILTERS[dim]?.has(code);return `<button type="button" class="${active?'active':''}" data-v031-filter="${esc(dim)}" data-v031-value="${esc(code)}" ${type==='phenomena'?`title="${esc(v031Phen(code).label+'. '+v031Phen(code).desc)}"`:''}><span>${esc(text)}</span><progress max="${max}" value="${n}"></progress><b>${n}</b></button>`;}).join('')||'<div class="v031-empty">Sin datos comparables.</div>'}</div></section>`;
}
function v031Matrix(all){
  const rows=v031Filtered(all,'matrix'),bands=['MUY_ALTO','ALTO','MEDIO','BAJO','MUY_BAJO'],confs=['ALTA','MEDIA','BAJA'],map=new Map();
  for(const r of rows){const p=v031Profile(r),s=v031Band(r.scores?.B),c=v031Finite(p?.confidence_score)?(Number(p.confidence_score)>=80?'ALTA':Number(p.confidence_score)>=60?'MEDIA':'BAJA'):'BAJA';map.set(`${s}|${c}`,(map.get(`${s}|${c}`)||0)+1);}
  return `<section class="v031-card v031-chart"><header class="v031-card-head"><div><span>CONSISTENCIA</span><h3>Score B × confianza explicativa</h3><p>Separa señal territorial fuerte de explicaciones todavía inestables.</p></div><small>clic → filtrar</small></header><div class="v031-matrix"><div></div>${confs.map(c=>`<b>${c}</b>`).join('')}${bands.map(s=>`<span>${esc(s.replaceAll('_',' '))}</span>${confs.map(c=>{const token=`${s}|${c}`,n=map.get(token)||0;return `<button type="button" class="${V029_FILTERS.matrix.has(token)?'active':''} ${s.toLowerCase().replaceAll('_','-')}" data-v031-filter="matrix" data-v031-value="${esc(token)}"><b>${n}</b><small>reg.</small></button>`;}).join('')}`).join('')}</div></section>`;
}
function v031Pressure(all){
  const rows=v031Filtered(all),data=V031_CORE_COMPONENTS.map(([k,label])=>({k,label,value:v031Mean(rows,r=>r.parts?.[k])})).filter(x=>v031Finite(x.value)).sort((a,b)=>b.value-a.value);
  return `<section class="v031-card v031-chart"><header class="v031-card-head"><div><span>PRESIÓN DEL CORTE</span><h3>Qué componentes están arriba</h3><p>Media de percentiles entre las regiones visibles; sirve para cambiar la capa del mapa, no para recalcular Score B.</p></div></header><div class="v031-pressure">${data.map(x=>`<button type="button" class="${V031_STATE.mapMetric===x.k?'active':''}" data-v031-metric="${esc(x.k)}"><span>${esc(x.label)}</span><progress max="100" value="${Number(x.value)}"></progress><b>${v031Num(x.value,1)}</b></button>`).join('')}</div></section>`;
}
function v031RegionalTable(all){
  const rows=[...v031Filtered(all)].sort((a,b)=>(Number(b.scores?.B)||-1)-(Number(a.scores?.B)||-1));
  return `<section class="v031-card v031-table-card"><header class="v031-card-head"><div><span>COMPARADOR REGIONAL</span><h3>Regiones ordenadas por Score B</h3><p>La tabla resume la señal y su explicación. Seleccionar una fila actualiza mapa, dossier y gráficos.</p></div><b>${rows.length} visibles</b></header><div class="v031-tablewrap"><table><thead><tr><th>#</th><th>Región</th><th>Score B</th><th>Perfil / confianza</th><th>Driver principal</th><th>Fenómenos</th><th>CEAD</th><th>Presupuesto</th><th>CGR</th><th>IPA3</th><th>Sector</th><th>Prioridad</th></tr></thead><tbody>${rows.map((r,i)=>{const p=v031Profile(r),pri=v031Priority(r);return `<tr tabindex="0" data-v031-row-region="${esc(r.region)}" class="${V029_FILTERS.region===r.region?'selected':''}"><td>${i+1}</td><td><b>${esc(v031Short(r.region))}</b><small>Cobertura ${v031Pct(r.coverage)}</small></td><td><strong class="v031-table-score ${v031Tone(r.scores.B)}">${v031Num(r.scores.B,1)}</strong><small>${esc(v031BandLabel(r.scores.B))}</small></td><td><b>${esc(p?.label||'—')}</b><small>${esc(p?.confidence_label||'—')} · ${v031Num(p?.confidence_score,0)}/100</small></td><td><b>${esc(p?.primary?.label||'—')}</b><small>${p?.secondary?`2º ${esc(p.secondary.label)} · brecha ${v031Num(p.gap,1)}`:'sin segundo comparable'}</small></td><td><div class="v031-table-phen">${(r.phenomena||[]).slice(0,3).map(v031PhenChip).join('')||'<span>—</span>'}</div></td><td>${v031Num(r.parts?.cead,1)}</td><td>${v031Num(r.parts?.budget,1)}</td><td>${v031Num(r.parts?.cgr,1)}</td><td>${v031Num(r.parts?.ipa,1)}</td><td>${v031Num(r.parts?.sector,1)}</td><td><span class="v031-priority-pill ${String(r.analytical_priority||'CONTEXT').toLowerCase()}" title="${esc(pri.desc)}">${esc(pri.label)}</span></td></tr>`;}).join('')||'<tr><td colspan="12">Sin regiones comparables.</td></tr>'}</tbody></table></div></section>`;
}
function v031DeepDive(r){if(!r)return '';return `<section class="v031-deep-grid"><article class="v031-card"><header class="v031-card-head"><div><span>COMUNAS</span><h3>Focos internos de ${esc(v031Short(r.region))}</h3><p>Ranking comunal por Score B disponible. Una comuna sin dato no se materializa como cero.</p></div></header>${v031TopCommunes(r)}</article><article class="v031-card"><header class="v031-card-head"><div><span>EXPOSICIÓN ECONÓMICA</span><h3>Sectores Ley 19.913</h3><p>Homologaciones VALIDATED_RULE; presencia actividad-sector no afirma inscripción UAF.</p></div></header>${v031TopSectors(r)}</article></section>`;}
function v031Guardrails(){return `<section class="v031-guard"><div><b>Score B es relativo</b><span>Ordena territorios por evidencia comparable; no es probabilidad de LA/FT.</span></div><div><b>Contexto no es señal adversa</b><span>OSFL y prensa se visualizan como contexto y aportan 0 al Score B.</span></div><div><b>Geografía no atribuye conducta</b><span>La señal territorial no se transfiere automáticamente a una entidad ubicada allí.</span></div><div><b>Missing ≠ 0</b><span>Falta de fuente reduce cobertura y permanece explícita.</span></div></section>`;}
function v031Exports(){return `<div class="v031-actions"><button type="button" data-v031-export="csv">Exportar CSV</button><button type="button" data-v031-export="json">Exportar JSON + metodología</button></div>`;}

function v031Bind(root){
  root.querySelectorAll('[data-v031-region]').forEach(el=>{const go=()=>{const r=el.dataset.v031Region;if(r)v031SetRegion(r);};el.addEventListener('click',go);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}});});
  root.querySelectorAll('[data-v031-row-region]').forEach(el=>{const go=e=>{if(e?.target?.closest?.('button'))return;v031SetRegion(el.dataset.v031RowRegion);};el.addEventListener('click',go);el.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!e.target.closest('button')){e.preventDefault();go(e);}});});
  root.querySelectorAll('[data-v031-filter]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();const dim=el.dataset.v031Filter,val=el.dataset.v031Value;if(dim==='region'){V029_FILTERS.region=null;v022Render();return;}v031Toggle(dim,val);}));
  root.querySelectorAll('[data-v031-select]').forEach(el=>el.addEventListener('change',()=>v031SetSingle(el.dataset.v031Select,el.value)));
  root.querySelectorAll('[data-v031-metric]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();V031_STATE.mapMetric=el.dataset.v031Metric;v022Render();}));
  root.querySelector('[data-v031-clear]')?.addEventListener('click',v031Clear);
  root.querySelectorAll('[data-v031-export]').forEach(el=>el.addEventListener('click',()=>el.dataset.v031Export==='csv'?v022ExportCsv():v022ExportJson()));
}

v022ExportRows=function(level='region'){return v031BaseExportRows(level).map(x=>level==='region'?{...x,analytical_view_version:V031_VIEW,score_formula_version:V031_SCORE_FORMULA}:x);};

v022Render=function(){
  V022_STATE.method='B';
  const root=v019Content();
  if(!root||!V022_STATE.computed){v031LegacyRender();v031ApplyVersion();return;}
  if(typeof V030_CHILE==='undefined'){v031LegacyRender();v031ApplyVersion();return;}
  const all=v031All(),selected=v031Selected(all);if(selected)V022_STATE.selectedRegion=selected.region;
  root.classList.remove('v029-territory','v030-osfl');root.classList.add('v031-territory');
  root.innerHTML=`${v031Hero(all)}${v031SourceStrip()}${v031FilterRail(all)}<div class="v031-main-grid">${v031Map(all)}${v031Dossier(selected)}</div><section class="v031-analytics-grid">${v031CountChart(all,'phenomena')}${v031CountChart(all,'drivers')}${v031Matrix(all)}${v031Pressure(all)}</section>${v031RegionalTable(all)}${v031DeepDive(selected)}${v031Guardrails()}${v031Exports()}`;
  v031Bind(root);v031ApplyVersion();
};

window.AML_TERRITORY_COCKPIT={version:V031_VIEW,scoreFormula:V031_SCORE_FORMULA,state:V031_STATE,metrics:V031_METRICS,render:v022Render,clear:v031Clear};
v031ApplyVersion();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{v031ApplyVersion();setTimeout(()=>{if(v019Content()?.querySelector('.v022-hero')||state?.view==='territory')v022Render();},0);},{once:true});
else setTimeout(()=>{v031ApplyVersion();if(state?.view==='territory')v022Render();},0);
