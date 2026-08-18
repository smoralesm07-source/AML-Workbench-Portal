'use strict';

/* AML Workbench v0.29.0 · Territory Analytics
 * Production UX for the definitive geographic Score B.
 * - Score B is locked as the only visible/interactive method.
 * - Adds deterministic phenomenon marks that explain notable territorial patterns.
 * - Cross-filtering is client-side across map, charts and regional table.
 * - Phenomena do not change Score B; they are explanatory analytical labels.
 */
const V029='0.29.0';
const V029_BUILD='0290';
const V029_ANALYTICS_VERSION='TERRITORY-ANALYTICS-0.29.0';
const V029_SCORE_FORMULA_VERSION=typeof V027_GEO_METHOD!=='undefined'?V027_GEO_METHOD:'GEO-RISK-B-0.27.0';

const V029_FILTERS={region:null,profiles:new Set(),phenomena:new Set(),drivers:new Set(),matrix:new Set()};

const V029_PHENOMENA={
  HIGH_CONFIDENCE_RISK:{label:'Riesgo alto + explicación sólida',short:'Riesgo sólido',group:'priority',desc:'Score B ≥60 y confianza del perfil ≥70. Prioridad territorial con explicación comparativamente estable.'},
  MULTISOURCE_CONVERGENCE:{label:'Convergencia multifuente',short:'Multifuente',group:'convergence',desc:'Tres o más familias explicativas elevadas simultáneamente. Es convergencia de señales, no prueba de relación causal.'},
  DRIVER_TENSION:{label:'Tensión entre drivers',short:'Drivers próximos',group:'convergence',desc:'Dos familias elevadas están separadas por 10 puntos o menos. El territorio no presenta un único conductor claramente dominante.'},
  CEAD_HIGH:{label:'Presión CEAD elevada',short:'CEAD alto',group:'crime',desc:'El componente CEAD se ubica en percentil 75 o superior entre regiones comparables.'},
  CEAD_ACCELERATION:{label:'Aceleración delictual reciente',short:'CEAD acelera',group:'crime',desc:'La variación interanual CEAD es ≥20% con un volumen observado mínimo. Señala aceleración del fenómeno territorial, no atribución individual.'},
  BUDGET_HIGH:{label:'Presión presupuestaria elevada',short:'Presupuesto alto',group:'public',desc:'El componente de señales de Presupuesto Abierto se ubica en percentil 75 o superior.'},
  CGR_HIGH:{label:'Presión CGR elevada',short:'CGR alto',group:'public',desc:'Los hallazgos CGR normalizados territorialmente se ubican en percentil 75 o superior.'},
  IPA_REGISTRY:{label:'Dominancia IPA registral',short:'IPA registral',group:'ipa',desc:'IPA3 presenta presión elevada y su patrón interno es principalmente supervisivo/registral, por ejemplo M01.'},
  IPA_SANCTIONS:{label:'Dominancia IPA sancionatoria',short:'IPA sanciones',group:'ipa',desc:'IPA3 presenta presión elevada y el patrón interno está conducido por recurrencia o convergencia sancionatoria, como M16/M18.'},
  IPA_HIGH:{label:'Presión IPA3 muy elevada',short:'IPA muy alto',group:'ipa',desc:'El percentil territorial de presión IPA3 es ≥80. IPA3 sigue siendo prioridad analítica shadow, no probabilidad LA/FT.'},
  SECTOR_HIGH:{label:'Alta exposición sectorial 19.913',short:'Sector 19.913',group:'economic',desc:'La presencia relativa de actividades fuertemente homologadas con sectores 19.913 está en percentil 75 o superior.'},
  RECENT_FORMATION:{label:'Formación reciente intensa',short:'Formación reciente',group:'economic',desc:'La razón de inicios recientes dentro de la exposición sectorial se ubica en el quintil superior del corte regional.'},
  HIGH_RISK_UNSTABLE:{label:'Riesgo alto con explicación inestable',short:'Explicación frágil',group:'quality',desc:'Score B ≥60 pero confianza del perfil <60. El nivel territorial merece atención, pero su explicación dominante aún es inestable.'},
  COVERAGE_FRAGILE:{label:'Cobertura analítica frágil',short:'Cobertura frágil',group:'quality',desc:'La cobertura de componentes del Score B es <75%. La ausencia de una fuente nunca se interpreta como riesgo cero.'}
};

const V029_PRIORITY={
  PRIORITIZE:{label:'Priorizar',desc:'Score y evidencia convergente justifican revisión territorial prioritaria.'},
  DEEPEN:{label:'Profundizar',desc:'Hay señales suficientes para profundizar antes de una conclusión operativa.'},
  MONITOR:{label:'Monitorear',desc:'El territorio presenta señales intermedias o parciales que conviene seguir.'},
  CONTEXT:{label:'Contexto',desc:'Sin señal territorial suficientemente intensa en el corte actual.'}
};

V022_STATE.method='B';
V022_METHODS.B.tag='oficial';
V022_METHODS.B.name='Percentil robusto';
V022_METHODS.B.note='Método territorial definitivo. Score B usa percentiles robustos, componentes observados y presión IPA3 gobernada; los filtros y marcas analíticas explican el corte, pero no modifican la fórmula.';

const v029BaseCompute=v022Compute;
const v029BaseRender=v022Render;
const v029BaseMapSvg=v022MapSvg;
const v029BaseExportRows=v022ExportRows;

function v029Finite(v){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));}
function v029Num(v,d=1){const n=v029Finite(v)?Number(v):null;return n===null?'—':n.toLocaleString('es-CL',{minimumFractionDigits:d,maximumFractionDigits:d});}
function v029ScoreBand(v){const n=v029Finite(v)?Number(v):null;if(n===null)return 'SIN_DATO';if(n>=75)return 'MUY_ALTO';if(n>=60)return 'ALTO';if(n>=40)return 'MEDIO';if(n>=20)return 'BAJO';return 'MUY_BAJO';}
function v029ScoreBandLabel(code){return ({MUY_ALTO:'Muy alto',ALTO:'Alto',MEDIO:'Medio',BAJO:'Bajo',MUY_BAJO:'Muy bajo',SIN_DATO:'Sin dato'})[code]||code;}
function v029ConfidenceBand(v){const n=v029Finite(v)?Number(v):null;if(n===null)return 'SIN_DATO';return n>=80?'ALTA':n>=60?'MEDIA':'BAJA';}
function v029Profile(row){return row?.explanatory_profile||(typeof v026Profile==='function'?v026Profile(row):null);}
function v029IpaSubprofile(row){return typeof v026IpaSubprofile==='function'?v026IpaSubprofile(row):{code:'IPA_MIXTO'};}
function v029PhenomenonMeta(code){return V029_PHENOMENA[code]||{label:code,short:code,group:'other',desc:'Marca analítica territorial.'};}
function v029Percentiles(rows,valueFn){
  const valid=(rows||[]).map(r=>({r,v:valueFn(r)})).filter(x=>v029Finite(x.v)).map(x=>({...x,v:Number(x.v)})).sort((a,b)=>a.v-b.v);
  const out=new Map();if(!valid.length)return out;
  const pos=new Map();valid.forEach((x,i)=>{const k=String(x.v);const a=pos.get(k)||[];a.push(i);pos.set(k,a);});
  for(const x of valid){const inds=pos.get(String(x.v)),rank=inds.reduce((a,b)=>a+b,0)/inds.length;out.set(x.r,valid.length===1?50:100*rank/(valid.length-1));}
  return out;
}
function v029RecentFormationRatio(r){
  const started=Number(r?.sector?.started_2024),base=Number(r?.sector?.active_activity_candidates);
  return Number.isFinite(started)&&Number.isFinite(base)&&base>0?started/base:null;
}
function v029PhenomenaFor(r,formationPct){
  const p=v029Profile(r),score=v029Finite(r?.scores?.B)?Number(r.scores.B):null,conf=v029Finite(p?.confidence_score)?Number(p.confidence_score):null;
  const out=[];
  if(score!==null&&score>=60&&conf!==null&&conf>=70)out.push('HIGH_CONFIDENCE_RISK');
  if(p?.code==='MULTIFUENTE'||Number(p?.elevated_family_count)>=3)out.push('MULTISOURCE_CONVERGENCE');
  if(p?.primary&&p?.secondary&&Number(p.gap)<=10&&Number(p.primary.value)>=60&&Number(p.secondary.value)>=60)out.push('DRIVER_TENSION');
  if(Number(r?.parts?.cead)>=75)out.push('CEAD_HIGH');
  const yoy=Number(r?.cead?.yoy_pct),cases=Number(r?.cead?.cases);if(Number.isFinite(yoy)&&yoy>=20&&Number.isFinite(cases)&&cases>=10)out.push('CEAD_ACCELERATION');
  if(Number(r?.parts?.budget)>=75)out.push('BUDGET_HIGH');
  if(Number(r?.parts?.cgr)>=75)out.push('CGR_HIGH');
  const ipaSub=v029IpaSubprofile(r),ipa=Number(r?.parts?.ipa);
  if(Number.isFinite(ipa)&&ipa>=60&&ipaSub?.code==='SUPERVISIVO_REGISTRAL')out.push('IPA_REGISTRY');
  if(Number.isFinite(ipa)&&ipa>=60&&ipaSub?.code==='SANCIONATORIO')out.push('IPA_SANCTIONS');
  if(Number.isFinite(ipa)&&ipa>=80)out.push('IPA_HIGH');
  if(Number(r?.parts?.sector)>=75)out.push('SECTOR_HIGH');
  if(v029Finite(formationPct)&&Number(formationPct)>=80&&Number(r?.sector?.started_2024)>=5)out.push('RECENT_FORMATION');
  if(score!==null&&score>=60&&conf!==null&&conf<60)out.push('HIGH_RISK_UNSTABLE');
  if(Number(r?.coverage)<75)out.push('COVERAGE_FRAGILE');
  return [...new Set(out)];
}
function v029Priority(r){
  const score=v029Finite(r?.scores?.B)?Number(r.scores.B):null,p=v029Profile(r),conf=v029Finite(p?.confidence_score)?Number(p.confidence_score):0;
  const material=(r?.phenomena||[]).filter(code=>!['COVERAGE_FRAGILE','HIGH_RISK_UNSTABLE'].includes(code)).length;
  if(score!==null&&score>=70&&conf>=70&&material>=2)return 'PRIORITIZE';
  if(score!==null&&score>=55&&(conf>=60||material>=2))return 'DEEPEN';
  if(score!==null&&score>=40)return 'MONITOR';
  return 'CONTEXT';
}
function v029Annotate(regions){
  const pct=v029Percentiles(regions,v029RecentFormationRatio);
  for(const r of regions||[]){
    r.recent_formation_ratio=v029RecentFormationRatio(r);
    r.recent_formation_percentile=pct.get(r)??null;
    r.phenomena=v029PhenomenaFor(r,r.recent_formation_percentile);
    r.analytical_priority=v029Priority(r);
  }
}

v022Compute=function(raw){const computed=v029BaseCompute(raw);v029Annotate(computed?.regions||[]);return computed;};

v022Color=function(score){
  const n=v029Finite(score)?Number(score):null;
  if(n===null)return '#D7DEE3';
  if(n>=75)return '#9E3D25';
  if(n>=60)return '#D9672D';
  if(n>=40)return '#E9B45B';
  if(n>=20)return '#9BBFD4';
  return '#DCEAF2';
};
if(typeof v026ProfileColor==='function'){
  v026ProfileColor=function(code){return ({MULTIFUENTE:'#5B3C6B',MIXTO:'#8B6740',DELICTUAL:'#A43C35',GASTO_PUBLICO:'#D27A2F',CONTROL_PUBLICO:'#6C568B',SUPERVISIVO_REGISTRAL:'#3F6F8F',SANCIONATORIO:'#7D3F68',ECONOMICO_SECTORIAL:'#477765',IPA_MIXTO:'#626D82',SIN_PREDOMINIO:'#8D9AA1',EVIDENCIA_INSUFICIENTE:'#D7DEE3'})[code]||'#8D9AA1';};
}

function v029Rows(all,omit=null){
  return (all||[]).filter(r=>{
    const p=v029Profile(r),profile=p?.code||'EVIDENCIA_INSUFICIENTE',driver=p?.primary?.code||'SIN_DRIVER';
    if(omit!=='region'&&V029_FILTERS.region&&r.region!==V029_FILTERS.region)return false;
    if(omit!=='profiles'&&V029_FILTERS.profiles.size&&!V029_FILTERS.profiles.has(profile))return false;
    if(omit!=='drivers'&&V029_FILTERS.drivers.size&&!V029_FILTERS.drivers.has(driver))return false;
    if(omit!=='phenomena'&&V029_FILTERS.phenomena.size&&![...V029_FILTERS.phenomena].some(code=>(r.phenomena||[]).includes(code)))return false;
    if(omit!=='matrix'&&V029_FILTERS.matrix.size){const token=`${v029ScoreBand(r.scores?.B)}|${v029ConfidenceBand(p?.confidence_score)}`;if(!V029_FILTERS.matrix.has(token))return false;}
    return true;
  });
}
function v029AllRegions(){const rows=V022_STATE.computed?.regions||[];v029Annotate(rows);return rows;}
function v029ClearFilters(){V029_FILTERS.region=null;V029_FILTERS.profiles.clear();V029_FILTERS.phenomena.clear();V029_FILTERS.drivers.clear();V029_FILTERS.matrix.clear();}
function v029ToggleSet(set,value){if(set.has(value))set.delete(value);else set.add(value);}
function v029ToggleFilter(dim,value){
  if(dim==='region')V029_FILTERS.region=V029_FILTERS.region===value?null:value;
  else if(dim==='profiles')v029ToggleSet(V029_FILTERS.profiles,value);
  else if(dim==='phenomena')v029ToggleSet(V029_FILTERS.phenomena,value);
  else if(dim==='drivers')v029ToggleSet(V029_FILTERS.drivers,value);
  else if(dim==='matrix')v029ToggleSet(V029_FILTERS.matrix,value);
  v022Render();
}
function v029SetSingle(dim,value){
  if(dim==='region')V029_FILTERS.region=value||null;
  else if(dim==='profiles'){V029_FILTERS.profiles.clear();if(value)V029_FILTERS.profiles.add(value);}
  else if(dim==='phenomena'){V029_FILTERS.phenomena.clear();if(value)V029_FILTERS.phenomena.add(value);}
  else if(dim==='drivers'){V029_FILTERS.drivers.clear();if(value)V029_FILTERS.drivers.add(value);}
  v022Render();
}

function v029PhenomenonChip(code,compact=false){
  const m=v029PhenomenonMeta(code),active=V029_FILTERS.phenomena.has(code);
  return `<button type="button" class="v029-phenomenon ${esc(m.group)} ${active?'active':''} ${compact?'compact':''}" data-v029-filter="phenomena" data-v029-value="${esc(code)}" title="${esc(m.label+'. '+m.desc)}" aria-label="${esc(m.label+'. '+m.desc)}"><b>${esc(m.short)}</b></button>`;
}
function v029PriorityChip(code){const m=V029_PRIORITY[code]||V029_PRIORITY.CONTEXT;return `<span class="v029-priority ${String(code||'CONTEXT').toLowerCase()}" title="${esc(m.desc)}">${esc(m.label)}</span>`;}

function v029ProfileCounts(all){
  const rows=v029Rows(all,'profiles'),m=new Map();for(const r of rows){const code=v029Profile(r)?.code||'EVIDENCIA_INSUFICIENTE';m.set(code,(m.get(code)||0)+1);}return [...m].map(([code,count])=>({code,count})).sort((a,b)=>b.count-a.count);
}
function v029PhenomenonCounts(all){
  const rows=v029Rows(all,'phenomena'),m=new Map();for(const r of rows)for(const code of r.phenomena||[])m.set(code,(m.get(code)||0)+1);return [...m].map(([code,count])=>({code,count})).sort((a,b)=>b.count-a.count);
}
function v029DriverCounts(all){
  const rows=v029Rows(all,'drivers'),m=new Map();for(const r of rows){const p=v029Profile(r),code=p?.primary?.code||'SIN_DRIVER',label=p?.primary?.label||'Sin driver';const x=m.get(code)||{code,label,count:0};x.count++;m.set(code,x);}return [...m.values()].sort((a,b)=>b.count-a.count);
}
function v029MatrixCounts(all){
  const rows=v029Rows(all,'matrix'),bands=['MUY_ALTO','ALTO','MEDIO','BAJO','MUY_BAJO'],confs=['ALTA','MEDIA','BAJA'];const m=new Map();
  for(const r of rows){const p=v029Profile(r),token=`${v029ScoreBand(r.scores?.B)}|${v029ConfidenceBand(p?.confidence_score)}`;m.set(token,(m.get(token)||0)+1);}
  return {bands,confs,m};
}
function v029OptionCounts(all,dim,extract){const rows=v029Rows(all,dim),m=new Map();for(const r of rows){for(const v of extract(r)||[])m.set(v,(m.get(v)||0)+1);}return m;}

function v029ActiveFilters(){
  const chips=[];
  if(V029_FILTERS.region)chips.push(`<button type="button" data-v029-filter="region" data-v029-value="${esc(V029_FILTERS.region)}">Región · ${esc(V029_FILTERS.region)} ×</button>`);
  for(const code of V029_FILTERS.profiles)chips.push(`<button type="button" data-v029-filter="profiles" data-v029-value="${esc(code)}">Perfil · ${esc(v026Meta(code).short)} ×</button>`);
  for(const code of V029_FILTERS.phenomena)chips.push(`<button type="button" data-v029-filter="phenomena" data-v029-value="${esc(code)}">Fenómeno · ${esc(v029PhenomenonMeta(code).short)} ×</button>`);
  for(const code of V029_FILTERS.drivers)chips.push(`<button type="button" data-v029-filter="drivers" data-v029-value="${esc(code)}">Driver · ${esc(v026Meta(code).short)} ×</button>`);
  for(const token of V029_FILTERS.matrix){const [s,c]=token.split('|');chips.push(`<button type="button" data-v029-filter="matrix" data-v029-value="${esc(token)}">${esc(v029ScoreBandLabel(s))} / ${esc(c)} ×</button>`);}
  return chips.length?`<div class="v029-active-filters"><span>Filtros activos</span>${chips.join('')}<button type="button" class="clear" data-v029-clear>Limpiar todo</button></div>`:'<div class="v029-active-filters empty"><span>Sin filtros activos · todos los gráficos están sincronizados</span></div>';
}
function v029SelectBar(all){
  const regionCounts=v029OptionCounts(all,'region',r=>[r.region]);
  const profileCounts=v029OptionCounts(all,'profiles',r=>[v029Profile(r)?.code||'EVIDENCIA_INSUFICIENTE']);
  const phenCounts=v029OptionCounts(all,'phenomena',r=>r.phenomena||[]);
  const driverCounts=v029OptionCounts(all,'drivers',r=>[v029Profile(r)?.primary?.code||'SIN_DRIVER']);
  const regionOptions=[...regionCounts.entries()].sort((a,b)=>a[0].localeCompare(b[0],'es')).map(([v,n])=>`<option value="${esc(v)}" ${V029_FILTERS.region===v?'selected':''}>${esc(v)} (${n})</option>`).join('');
  const profileOptions=[...profileCounts.entries()].sort((a,b)=>b[1]-a[1]).map(([v,n])=>`<option value="${esc(v)}" ${V029_FILTERS.profiles.has(v)&&V029_FILTERS.profiles.size===1?'selected':''}>${esc(v026Meta(v).label)} (${n})</option>`).join('');
  const phenOptions=[...phenCounts.entries()].sort((a,b)=>b[1]-a[1]).map(([v,n])=>`<option value="${esc(v)}" ${V029_FILTERS.phenomena.has(v)&&V029_FILTERS.phenomena.size===1?'selected':''}>${esc(v029PhenomenonMeta(v).label)} (${n})</option>`).join('');
  const driverOptions=[...driverCounts.entries()].sort((a,b)=>b[1]-a[1]).filter(([v])=>v!=='SIN_DRIVER').map(([v,n])=>`<option value="${esc(v)}" ${V029_FILTERS.drivers.has(v)&&V029_FILTERS.drivers.size===1?'selected':''}>${esc(v026Meta(v).label)} (${n})</option>`).join('');
  return `<div class="v029-filterbar"><label><span>Región</span><select data-v029-select="region"><option value="">Todas</option>${regionOptions}</select></label><label><span>Perfil conductor</span><select data-v029-select="profiles"><option value="">Todos</option>${profileOptions}</select></label><label><span>Fenómeno</span><select data-v029-select="phenomena"><option value="">Todos</option>${phenOptions}</select></label><label><span>Driver principal</span><select data-v029-select="drivers"><option value="">Todos</option>${driverOptions}</select></label><div class="v029-filter-result"><b>${v029Rows(all).length}</b><span>de ${all.length} regiones</span></div></div>`;
}

function v029HeadlineCards(all){
  const rows=v029Rows(all),ph=v029PhenomenonCounts(all),topPhen=ph[0]||null;
  const strongest=[...rows].filter(r=>v029Finite(r.scores?.B)&&v029Finite(v029Profile(r)?.confidence_score)).sort((a,b)=>(Number(b.scores.B)*Number(v029Profile(b).confidence_score))-(Number(a.scores.B)*Number(v029Profile(a).confidence_score)))[0];
  const convergence=[...rows].sort((a,b)=>Number(v029Profile(b)?.elevated_family_count||0)-Number(v029Profile(a)?.elevated_family_count||0)||Number(b.scores?.B||0)-Number(a.scores?.B||0))[0];
  const tension=[...rows].filter(r=>v029Profile(r)?.primary&&v029Profile(r)?.secondary&&v029Finite(v029Profile(r)?.gap)).sort((a,b)=>Number(v029Profile(a).gap)-Number(v029Profile(b).gap))[0];
  return `<div class="v029-headlines">
    <article>${topPhen?`<button type="button" data-v029-filter="phenomena" data-v029-value="${esc(topPhen.code)}"><span>Fenómeno más extendido</span><b>${esc(v029PhenomenonMeta(topPhen.code).label)}</b><small>${topPhen.count} regiones del universo visible</small></button>`:'<div><span>Fenómeno más extendido</span><b>Sin fenómeno dominante</b></div>'}</article>
    <article>${strongest?`<button type="button" data-v029-filter="region" data-v029-value="${esc(strongest.region)}"><span>Evidencia más consistente</span><b>${esc(strongest.region)}</b><small>Score B ${v029Num(strongest.scores.B,1)} · confianza ${v029Num(v029Profile(strongest).confidence_score,0)}</small></button>`:'<div><span>Evidencia más consistente</span><b>Sin comparación</b></div>'}</article>
    <article>${convergence?`<button type="button" data-v029-filter="region" data-v029-value="${esc(convergence.region)}"><span>Mayor convergencia</span><b>${esc(convergence.region)}</b><small>${v029Profile(convergence).elevated_family_count||0} familias elevadas · ${esc(v029Profile(convergence).label)}</small></button>`:'<div><span>Mayor convergencia</span><b>Sin comparación</b></div>'}</article>
    <article>${tension?`<button type="button" data-v029-filter="region" data-v029-value="${esc(tension.region)}"><span>Mayor tensión de drivers</span><b>${esc(tension.region)}</b><small>brecha ${v029Num(v029Profile(tension).gap,1)} · ${esc(v029Profile(tension).primary.label)} vs ${esc(v029Profile(tension).secondary.label)}</small></button>`:'<div><span>Mayor tensión de drivers</span><b>Sin segundo driver</b></div>'}</article>
  </div>`;
}
function v029ProfileChart(all){const rows=v029ProfileCounts(all),max=Math.max(1,...rows.map(x=>x.count));return `<article class="v029-chart"><header><span>PERFILES</span><h4>Qué conduce el riesgo</h4><small>clic para filtrar</small></header><div class="v029-bars">${rows.slice(0,7).map(x=>`<div class="v029-bar"><button type="button" class="${V029_FILTERS.profiles.has(x.code)?'active':''}" data-v029-filter="profiles" data-v029-value="${esc(x.code)}"><span>${esc(v026Meta(x.code).short)}</span><i><em data-width="${Math.round(100*x.count/max)}"></em></i><b>${x.count}</b></button></div>`).join('')}</div></article>`;}
function v029PhenomenaChart(all){const rows=v029PhenomenonCounts(all),max=Math.max(1,...rows.map(x=>x.count));return `<article class="v029-chart"><header><span>FENÓMENOS</span><h4>Marcas evidentes del corte</h4><small>hover explica · clic filtra</small></header><div class="v029-bars phenomena">${rows.slice(0,7).map(x=>{const m=v029PhenomenonMeta(x.code);return `<div class="v029-bar"><button type="button" class="${V029_FILTERS.phenomena.has(x.code)?'active':''}" data-v029-filter="phenomena" data-v029-value="${esc(x.code)}" title="${esc(m.label+'. '+m.desc)}"><span>${esc(m.short)}</span><i><em data-width="${Math.round(100*x.count/max)}"></em></i><b>${x.count}</b></button></div>`;}).join('')||'<div class="v029-empty">Sin fenómenos comparables.</div>'}</div></article>`;}
function v029DriversChart(all){const rows=v029DriverCounts(all).filter(x=>x.code!=='SIN_DRIVER'),max=Math.max(1,...rows.map(x=>x.count));return `<article class="v029-chart"><header><span>DRIVERS</span><h4>Conductor principal</h4><small>familia dominante</small></header><div class="v029-bars">${rows.slice(0,7).map(x=>`<div class="v029-bar"><button type="button" class="${V029_FILTERS.drivers.has(x.code)?'active':''}" data-v029-filter="drivers" data-v029-value="${esc(x.code)}"><span>${esc(v026Meta(x.code).short)}</span><i><em data-width="${Math.round(100*x.count/max)}"></em></i><b>${x.count}</b></button></div>`).join('')||'<div class="v029-empty">Sin drivers comparables.</div>'}</div></article>`;}
function v029MatrixChart(all){
  const {bands,confs,m}=v029MatrixCounts(all);
  return `<article class="v029-chart matrix"><header><span>CONSISTENCIA</span><h4>Score B × confianza</h4><small>priorización explicable</small></header><div class="v029-matrix"><div></div>${confs.map(c=>`<b>${c}</b>`).join('')}${bands.map(s=>`<span>${v029ScoreBandLabel(s)}</span>${confs.map(c=>{const token=`${s}|${c}`,n=m.get(token)||0;return `<button type="button" class="score-${s.toLowerCase().replaceAll('_','-')} ${V029_FILTERS.matrix.has(token)?'active':''}" data-v029-filter="matrix" data-v029-value="${esc(token)}"><b>${n}</b><small>reg.</small></button>`;}).join('')}`).join('')}</div></article>`;
}

v022Kpis=function(regions){v029Annotate(regions);return `<section class="v029-analytics">${v029SelectBar(regions)}${v029ActiveFilters()}${v029HeadlineCards(regions)}<div class="v029-chart-grid">${v029ProfileChart(regions)}${v029PhenomenaChart(regions)}${v029DriversChart(regions)}${v029MatrixChart(regions)}</div></section>`;};

v022MethodControls=function(){return `<div class="v029-score-lock"><span>MODELO OFICIAL</span><div><b>Score B · Percentil robusto</b><small>${esc(V029_SCORE_FORMULA_VERSION)} · único método territorial activo</small></div><p>Normalización robusta + evidencia multifuente + IPA3 gobernado. Las marcas de fenómeno explican el corte y no alteran el score.</p></div>`;};

function v029MetricCell(score,detail){return `<span class="v029-metric-value">${v022Fmt(score,1)}</span><small>${detail||'—'}</small>`;}
function v029TablePhenomena(r){const arr=(r.phenomena||[]).slice(0,4);return arr.length?`<div class="v029-phenomena-inline">${arr.map(c=>v029PhenomenonChip(c,true)).join('')}</div>`:'<span class="v029-muted">Sin marca destacada</span>';}
v022Ranking=function(regions){
  v029Annotate(regions);const rows=v029Rows(regions).sort((a,b)=>(Number(b.scores?.B)||-1)-(Number(a.scores?.B)||-1));
  return `<div class="v029-table-meta"><span><b>${rows.length}</b> regiones visibles</span><small>Ordenadas por Score B · clic en una fila filtra mapa y gráficos</small></div><div class="v022-tablewrap v025-ranking-wrap v029-ranking-wrap"><table class="v025-risk-table v026-risk-table v029-risk-table"><thead><tr><th>#</th><th>Región</th><th>Score B</th><th>Perfil conductor</th><th>Fenómenos</th><th>Driver 2 / brecha</th><th>IPA3</th><th>CEAD</th><th>Presupuesto</th><th>CGR</th><th>Sector</th><th>Prioridad</th></tr></thead><tbody>${rows.map((r,i)=>{const p=v029Profile(r);return `<tr data-georisk-region="${esc(r.region)}" class="${V029_FILTERS.region===r.region?'v029-row-selected':''}"><td>${i+1}</td><td><b>${esc(r.region)}</b><small>Cob. ${v029Num(r.coverage,0)}% · perfil ${esc(p?.confidence_label||'—')} ${v029Num(p?.confidence_score,0)}</small></td><td>${v022ScoreBadge(r.scores.B)}<small>${esc(v029ScoreBandLabel(v029ScoreBand(r.scores.B)))}</small></td><td>${v026ProfileChip(p,false)}</td><td>${v029TablePhenomena(r)}</td><td><b class="v029-secondary">${esc(p?.secondary?.label||'—')}</b><small>${p?.secondary?`brecha ${v029Num(p.gap,1)} pts`:`${p?.available_component_count||0}/5 componentes`}</small></td><td>${v029MetricCell(r.parts?.ipa,r.ipa?`${v029Num(r.ipa.scored_per_10k,1)}/10k con marca`:'sin snapshot')}</td><td>${v029MetricCell(r.parts?.cead,typeof v025CeadDetail==='function'?v025CeadDetail(r):'')}</td><td>${v029MetricCell(r.parts?.budget,typeof v025BudgetDetail==='function'?v025BudgetDetail(r):'')}</td><td>${v029MetricCell(r.parts?.cgr,typeof v025CgrDetail==='function'?v025CgrDetail(r):'')}</td><td>${v029MetricCell(r.parts?.sector,typeof v025SectorDetail==='function'?v025SectorDetail(r):'')}</td><td>${v029PriorityChip(r.analytical_priority)}</td></tr>`;}).join('')}</tbody></table></div>`;
};

v022MapSvg=function(regions){return v029BaseMapSvg(regions);};

function v029RegionNarrative(row){
  if(!row)return '';
  const p=v029Profile(row),phen=row.phenomena||[],top=phen.slice(0,3).map(c=>v029PhenomenonMeta(c).label);
  const score=v029Num(row.scores?.B,1),driver=p?.primary?.label||'sin conductor claro';
  const second=p?.secondary?.label?` El segundo driver es ${p.secondary.label}, a ${v029Num(p.gap,1)} puntos.`:'';
  const marks=top.length?` Fenómenos destacados: ${top.join('; ')}.`:' No se detectan marcas de fenómeno fuertes en el corte.';
  return `Score B ${score}. El patrón territorial está conducido por ${driver}.${second}${marks}`;
}
function v029NarrativePanel(row){
  if(!row)return '';
  const p=v029Profile(row),phen=row.phenomena||[];
  return `<section class="v029-narrative"><div class="v029-narrative-head"><div><span>LECTURA DEL CORTE</span><h3>Qué está pasando en ${esc(row.region)}</h3><p>${esc(v029RegionNarrative(row))}</p></div>${v029PriorityChip(row.analytical_priority)}</div><div class="v029-narrative-grid"><div><span>Driver principal</span><b>${esc(p?.primary?.label||'—')}</b><small>${v029Num(p?.primary?.value,1)} pctl</small></div><div><span>Segundo driver</span><b>${esc(p?.secondary?.label||'—')}</b><small>${p?.secondary?`brecha ${v029Num(p.gap,1)}`:'sin segundo comparable'}</small></div><div><span>Confianza explicativa</span><b>${esc(p?.confidence_label||'—')}</b><small>${v029Num(p?.confidence_score,0)}/100</small></div><div><span>Convergencia</span><b>${p?.elevated_family_count||0} familias</b><small>${p?.elevated_component_count||0}/5 componentes ≥60</small></div></div><div class="v029-narrative-marks"><span>Fenómenos</span>${phen.length?phen.map(c=>v029PhenomenonChip(c,false)).join(''):'<small>Sin marcas destacadas.</small>'}</div></section>`;
}
const v029BaseRegionDetail=v022RegionDetail;
v022RegionDetail=function(row,communes){let html=v029BaseRegionDetail(row,communes);return `${v029NarrativePanel(row)}${html}`;};

v022ExportRows=function(level='region'){
  const base=v029BaseExportRows(level);if(level!=='region')return base;
  const map=new Map(v029AllRegions().map(r=>[r.territory_id,r]));
  return base.map(x=>{const r=map.get(x.territory_id);return r?{...x,analytical_view_version:V029_ANALYTICS_VERSION,definitive_method:'B',phenomena_codes:(r.phenomena||[]).join('|'),phenomena_labels:(r.phenomena||[]).map(c=>v029PhenomenonMeta(c).label).join('|'),analytical_priority:r.analytical_priority,profile_confidence_score:v029Profile(r)?.confidence_score??x.profile_confidence_score??null}:x;});
};

function v029ApplyVersion(){
  window.__AML_ACTIVE_VERSION__=V029;window.__AML_BUILD__=V029_BUILD;window.__AML_RUNTIME_VERSION_APPLIER__=v029ApplyVersion;
  const label=`Operational Radar · v${V029}`,badge=document.querySelector('.v019-brand small');
  if(badge){badge.setAttribute('data-runtime-label',label);badge.setAttribute('aria-label',label);badge.dataset.activeVersion=V029;}
  document.title=`AML Analytical Workbench · v${V029}`;
  document.documentElement.setAttribute('data-aml-version',V029);document.documentElement.setAttribute('data-aml-build',V029_BUILD);
}
function v029AdjustModelCard(root){
  const card=root.querySelector('.v022-model-card');if(!card)return;
  const title=card.querySelector('.v022-section-title h3');if(title)title.textContent='Score B · modelo territorial definitivo';
  const p=card.querySelector('.v022-section-title p');if(p)p.textContent='La interfaz ya no ofrece modelos alternativos. Toda la analítica, filtros y exportación se construyen sobre Score B.';
}
function v029UpdateMapFilter(root){
  const all=v029AllRegions(),visible=new Set(v029Rows(all).map(r=>r.region));
  root.querySelectorAll('.v022-map [data-georisk-region]').forEach(el=>{const name=el.getAttribute('data-georisk-region');el.classList.toggle('v029-filtered-out',!visible.has(name));el.classList.toggle('v029-filtered-in',visible.has(name));});
}
function v029ApplyBarWidths(root){root.querySelectorAll('.v029-bar em[data-width]').forEach(el=>{const w=Math.max(2,Math.min(100,Number(el.dataset.width)||0));el.className=`w${Math.round(w/5)*5}`;});}
function v029Bind(root){
  root.querySelectorAll('[data-v029-filter]').forEach(el=>el.addEventListener('click',ev=>{ev.preventDefault();ev.stopPropagation();v029ToggleFilter(el.dataset.v029Filter,el.dataset.v029Value);}));
  root.querySelectorAll('[data-v029-select]').forEach(el=>el.addEventListener('change',()=>v029SetSingle(el.dataset.v029Select,el.value)));
  root.querySelectorAll('[data-v029-clear]').forEach(el=>el.addEventListener('click',()=>{v029ClearFilters();v022Render();}));
  root.querySelectorAll('.v022-map [data-georisk-region],.v029-risk-table [data-georisk-region]').forEach(el=>{
    const region=el.getAttribute('data-georisk-region');
    const act=ev=>{if(ev.target?.closest?.('[data-v029-filter],[data-v029-select],[data-v029-clear]'))return;ev.preventDefault();ev.stopImmediatePropagation();V022_STATE.selectedRegion=region;v029ToggleFilter('region',region);};
    el.addEventListener('click',act,{capture:true});
    el.addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' '){act(ev);}}, {capture:true});
  });
}
function v029EnhanceTerritory(){
  const root=v019Content();if(!root||!root.querySelector('.v022-hero'))return;
  v029Annotate(v029AllRegions());root.classList.add('v029-territory');
  const eyebrow=root.querySelector('.v022-eyebrow');if(eyebrow)eyebrow.textContent=`TERRITORIO ANALÍTICO · SCORE B · ${V029_ANALYTICS_VERSION}`;
  const title=root.querySelector('.v022-hero h2');if(title)title.textContent='Qué está pasando territorialmente';
  const intro=root.querySelector('.v022-hero p');if(intro)intro.textContent='Lectura dinámica de Score B, drivers y fenómenos territoriales. Todos los gráficos, el mapa y la tabla se filtran entre sí; las marcas explican señales y no constituyen conclusiones LA/FT.';
  v029AdjustModelCard(root);
  const mapTitle=root.querySelector('.v022-map-card .v022-section-title h3');if(mapTitle)mapTitle.textContent='Mapa analítico territorial';
  const mapNote=root.querySelector('.v022-map-card .v022-section-title p');if(mapNote)mapNote.textContent='Mapa principal de Score B y capas explicativas. Al seleccionar una región o un fenómeno, el resto de la vista se recalcula sobre el mismo subconjunto.';
  const legend=root.querySelector('.v022-legend');if(legend&&V022_STATE.layer!=='profile')legend.innerHTML='<i class="very-low"></i>Muy bajo <i class="low"></i>Bajo <i class="medium"></i>Medio <i class="high"></i>Alto <i class="very-high"></i>Muy alto';
  const asideTitle=root.querySelector('.v022-map-layout aside h4');if(asideTitle)asideTitle.textContent=V022_STATE.layer==='total'?'Ranking analítico · Score B':`${V022_LAYERS[V022_STATE.layer]?.label||'Capa'} · regiones filtradas`;
  const asideP=root.querySelector('.v022-map-layout aside>p');if(asideP&&V022_STATE.layer!=='profile')asideP.textContent='La tabla comparte exactamente los filtros del mapa y gráficos. Las marcas de fenómeno no suman puntos al Score B.';
  v029UpdateMapFilter(root);v029ApplyBarWidths(root);v029Bind(root);v029ApplyVersion();
}

v022Render=function(){V022_STATE.method='B';v029BaseRender();v029EnhanceTerritory();};

window.AML_TERRITORY_ANALYTICS={version:V029_ANALYTICS_VERSION,scoreFormula:V029_SCORE_FORMULA_VERSION,filters:V029_FILTERS,phenomena:V029_PHENOMENA,clear:()=>{v029ClearFilters();v022Render();},rows:()=>v029Rows(v029AllRegions())};

v029ApplyVersion();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{v029ApplyVersion();setTimeout(()=>{if(v019Content()?.querySelector('.v022-hero'))v022Render();},0);},{once:true});
else setTimeout(()=>{v029ApplyVersion();if(v019Content()?.querySelector('.v022-hero'))v022Render();},0);
