'use strict';

/* AML Workbench v0.20 · graphical intelligence landing
 * Visualises governed aggregates instead of downloading large fact sets.
 * Scores keep separate semantics: IPA, pattern strength, Fusion coverage,
 * and Workbench exposure are never merged into a universal risk score.
 */

const V020='0.20.0';
const V020_BUDGET_URL='https://raw.githubusercontent.com/smoralesm07-source/Rada_Presupuesto_Abierto/main/docs/data/fusion_preview.json';
let V020_CACHE=null;
const v020BaseShell=shell;

const V020_SYSTEM=[
  {id:'RADAR_SII',label:'SII',fusion:'ready',workbench:'direct',note:'Trayectoria empresarial, actividades, domicilios y señales.'},
  {id:'RADAR_UAF',label:'UAF',fusion:'ready',workbench:'direct',note:'SO inscritos, reportabilidad y reglas ROS/ROE.'},
  {id:'RADAR_OSFL',label:'OSFL',fusion:'ready',workbench:'direct',note:'Universo OSFL y priorización OSINT.'},
  {id:'RADAR_SANCIONES',label:'Sanciones',fusion:'ready',workbench:'direct',note:'Eventos regulatorios, recurrencia y entidades.'},
  {id:'RADAR_CGR',label:'CGR',fusion:'partial',workbench:'pending',note:'Fusion operativo; identidad relacional y exposición Workbench aún parciales.'},
  {id:'RADAR_DELICTUAL',label:'Delictual',fusion:'ready',workbench:'pending',note:'Contexto territorial elegible Art. 27; aún no expuesto como vista propia.'},
  {id:'RADAR_PRENSA',label:'Prensa',fusion:'context',workbench:'context',note:'Momentum y recurrencia longitudinal CONTEXT_ONLY.'},
  {id:'CONTEXT_HUB',label:'Context Hub',fusion:'context',workbench:'context',note:'Contexto económico y dimensiones conformadas.'},
  {id:'PRESUPUESTO_ABIERTO',label:'Presupuesto',fusion:'pending',workbench:'preview',note:'Radar operacional; preview visible, adaptador canónico Fusion pendiente.'}
];

shell=function(title,subtitle){
  v020BaseShell(title,subtitle);
  const version=document.querySelector('.v019-brand small');
  if(version)version.textContent=`Operational Radar · v${V020}`;
};

function v020Num(v){const n=Number(v);return Number.isFinite(n)?n:0;}
function v020Clamp(v){return Math.max(0,Math.min(100,v020Num(v)));}
function v020Compact(v){const n=v020Num(v);return Intl.NumberFormat('es-CL',{notation:'compact',maximumFractionDigits:1}).format(n);}
function v020Percent(a,b){return v020Num(b)>0?100*v020Num(a)/v020Num(b):0;}
function v020ScoreHelp(title,body){return v17InfoButton(title,`<div class="v0192-help-copy">${body}</div>`,true);}

function v020Gauge(value,label,caption,kind='neutral',help=''){
  const v=v020Clamp(value),rest=Math.max(0,100-v);
  return `<div class="v020-gauge-card ${esc(kind)}"><div class="v020-gauge-wrap"><svg class="v020-gauge" viewBox="0 0 42 42" aria-label="${esc(label)} ${v019Fmt(v,0)} sobre 100"><circle class="track" cx="21" cy="21" r="15.9"></circle><circle class="meter" cx="21" cy="21" r="15.9" pathLength="100" stroke-dasharray="${v.toFixed(1)} ${rest.toFixed(1)}" stroke-dashoffset="25"></circle></svg><div class="v020-gauge-number"><b>${v019Fmt(v,0)}</b><span>/100</span></div></div><div class="v020-gauge-copy"><span>${esc(label)} ${help}</span><small>${esc(caption)}</small></div></div>`;
}

async function v020FetchBudget(){
  try{const r=await fetch(V020_BUDGET_URL,{cache:'no-store'});if(!r.ok)throw new Error('preview no disponible');return await r.json();}
  catch(error){return {error:String(error?.message||error),integration_status:'UNAVAILABLE',metrics:{},priority_tiers:{},top_signals:[]};}
}

async function v020LoadAnalytics(force=false){
  if(V020_CACHE&&!force)return V020_CACHE;
  const [mix,bands,families,sanYears,producers,budget]=await Promise.all([
    sb.from('aml_v020_finding_mix').select('*').order('finding_count',{ascending:false}),
    sb.from('aml_v020_score_band').select('*'),
    sb.from('aml_v020_pattern_family').select('*').order('max_strength',{ascending:false}),
    sb.from('aml_v020_sanction_year').select('*').order('year',{ascending:true}),
    sb.from('aml_v020_producer_findings').select('*').order('finding_count',{ascending:false}),
    v020FetchBudget()
  ]);
  for(const q of [mix,bands,families,sanYears,producers])if(q.error)throw q.error;
  V020_CACHE={mix:mix.data||[],bands:bands.data||[],families:families.data||[],sanYears:sanYears.data||[],producers:producers.data||[],budget};
  return V020_CACHE;
}

function v020FindingBars(rows){
  const max=Math.max(...rows.map(r=>v020Num(r.finding_count)),1);
  return `<div class="v020-bars">${rows.map(r=>`<div class="v020-bar-row"><div class="v020-bar-copy"><b>${esc(v019FindingType(r.finding_type))}</b><small>IPA medio ${v019Fmt(r.avg_ipa,1)} · máx. ${v019Fmt(r.max_ipa,1)}</small></div><div class="v020-bar-track"><i class="v020-bar-fill ${v019Width(r.finding_count,max)}"></i></div><strong>${v019Fmt(r.finding_count)}</strong></div>`).join('')}</div>`;
}

function v020BandBars(rows){
  const order=['0-29','30-39','40-49','50-59','60+','SIN_SCORE'];
  const map=new Map(rows.map(r=>[r.score_band,r]));
  const data=order.map(k=>map.get(k)).filter(Boolean),max=Math.max(...data.map(r=>v020Num(r.finding_count)),1);
  return `<div class="v020-score-bands">${data.map(r=>`<div><span>${esc(r.score_band==='SIN_SCORE'?'Sin score':r.score_band)}</span><div class="v020-band-track"><i class="${v019Width(r.finding_count,max)}"></i></div><b>${v019Fmt(r.finding_count)}</b><small>${v019Fmt(r.avg_sources,1)} fuentes prom.</small></div>`).join('')}</div><div class="v020-chart-foot">Bandas descriptivas del IPA ya calculado; no son umbrales normativos ni probabilidad de delito.</div>`;
}

function v020LineChart(rows,xKey,yKey){
  if(!rows.length)return '<div class="v019-empty">Serie no disponible.</div>';
  const W=520,H=190,pL=42,pR=18,pT=22,pB=34,max=Math.max(...rows.map(r=>v020Num(r[yKey])),1),n=Math.max(1,rows.length-1);
  const pts=rows.map((r,i)=>{const x=pL+(W-pL-pR)*(i/n),y=pT+(H-pT-pB)*(1-v020Num(r[yKey])/max);return {...r,x,y};});
  return `<div class="v020-svg-chart"><svg viewBox="0 0 ${W} ${H}" role="img"><line class="axis" x1="${pL}" y1="${H-pB}" x2="${W-pR}" y2="${H-pB}"></line><line class="grid" x1="${pL}" y1="${pT}" x2="${W-pR}" y2="${pT}"></line><text class="ymax" x="${pL-5}" y="${pT+4}" text-anchor="end">${v020Compact(max)}</text><polyline class="series" points="${pts.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}"></polyline>${pts.map(p=>`<g><circle class="point" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4"></circle><text class="value" x="${p.x.toFixed(1)}" y="${Math.max(12,p.y-9).toFixed(1)}" text-anchor="middle">${v020Compact(p[yKey])}</text><text class="xlabel" x="${p.x.toFixed(1)}" y="${H-11}" text-anchor="middle">${esc(String(p[xKey]))}</text></g>`).join('')}</svg></div>`;
}

function v020SanctionChart(rows){
  if(!rows.length)return '<div class="v019-empty">Serie no disponible.</div>';
  const W=520,H=190,pL=36,pR=14,pT=18,pB=36,max=Math.max(...rows.map(r=>v020Num(r.sanction_count)),1),slot=(W-pL-pR)/rows.length,bw=Math.min(42,slot*.58);
  return `<div class="v020-svg-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Eventos sancionatorios por año"><line class="axis" x1="${pL}" y1="${H-pB}" x2="${W-pR}" y2="${H-pB}"></line>${rows.map((r,i)=>{const x=pL+slot*i+(slot-bw)/2,h=(H-pT-pB)*v020Num(r.sanction_count)/max,y=H-pB-h,dh=(H-pT-pB)*v020Num(r.laft_direct_count)/max,dy=H-pB-dh;return `<g><rect class="bar" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="5"></rect><rect class="bar-direct" x="${(x+bw*.28).toFixed(1)}" y="${dy.toFixed(1)}" width="${(bw*.44).toFixed(1)}" height="${dh.toFixed(1)}" rx="3"></rect><text class="value" x="${(x+bw/2).toFixed(1)}" y="${Math.max(12,y-6).toFixed(1)}" text-anchor="middle">${v019Fmt(r.sanction_count)}</text><text class="xlabel" x="${(x+bw/2).toFixed(1)}" y="${H-13}" text-anchor="middle">${esc(String(r.year))}${Number(r.year)===2026?'*':''}</text></g>`;}).join('')}</svg><div class="v020-legend"><span><i class="all"></i>Eventos</span><span><i class="direct"></i>LA/FT directo materializado</span><span>* 2026 parcial</span></div></div>`;
}

function v020PatternFamilies(rows){
  const data=rows.slice(0,8),max=Math.max(...data.map(r=>v020Num(r.pattern_count)),1);
  return `<div class="v020-patterns">${data.map(r=>`<div><div><b>${esc(r.family||'Sin familia')}</b><small>${v019Fmt(r.pattern_count)} patrones</small></div><div class="v020-bar-track"><i class="v020-pattern-fill ${v019Width(r.pattern_count,max)}"></i></div><strong>${v019Fmt(r.max_strength,1)}</strong><span>fuerza máx.</span></div>`).join('')}</div>`;
}

function v020Coverage(core,a){
  const pmap=new Map(a.producers.map(p=>[p.producer_id,p]));
  const pressOk=Boolean(core.press&&!core.press.error),ctxOk=Boolean(core.economy&&!core.economy.error);
  const wbDirect=pmap.size+(pressOk?1:0)+(ctxOk?1:0);
  const wbScore=100*wbDirect/V020_SYSTEM.length;
  const fusionScore=100*8/V020_SYSTEM.length;
  const rows=V020_SYSTEM.map(r=>{
    const p=pmap.get(r.id);let wb=r.workbench;
    if(r.id==='RADAR_PRENSA'&&!pressOk)wb='unavailable';if(r.id==='CONTEXT_HUB'&&!ctxOk)wb='unavailable';
    const fusionLabel={ready:'Fusion listo',partial:'Fusion parcial',context:'Contexto',pending:'Fusion pendiente'}[r.fusion]||r.fusion;
    const wbLabel={direct:'Dato directo',context:'Contexto visible',preview:'Preview',pending:'No expuesto',unavailable:'No disponible'}[wb]||wb;
    return `<div class="v020-source-row"><span class="v020-source-dot ${esc(r.fusion)}"></span><div><b>${esc(r.label)}</b><small>${esc(r.note)}</small></div><div class="v020-source-states"><span class="${esc(r.fusion)}">${esc(fusionLabel)}</span><span class="${esc(wb)}">${esc(wbLabel)}</span></div><strong>${p?v019Fmt(p.finding_count):r.id==='PRESUPUESTO_ABIERTO'?v019Fmt(a.budget?.metrics?.signals):'—'}</strong></div>`;
  }).join('');
  return {fusionScore,wbScore,html:`<div class="v020-source-matrix">${rows}</div><div class="v020-chart-foot">Conteo final = hallazgos Workbench para productores directos; Presupuesto muestra señales de su preview y no se suma como hallazgo canónico.</div>`};
}

function v020Budget(a){
  const b=a.budget;if(!b||b.error)return `<div class="v019-empty">Preview de Presupuesto Abierto no disponible.</div>`;
  const tiers=['P1','P2','P3'].map(k=>({k,v:v020Num(b.priority_tiers?.[k])})),max=Math.max(...tiers.map(x=>x.v),1);
  return `<div class="v020-budget"><div class="v020-budget-head"><div><span>PREVIEW · FUERA DE FUSION</span><h3>Gasto público</h3></div><b>${v019Fmt(b.metrics?.priority_p1)}</b><small>P1</small></div><div class="v020-budget-tiers">${tiers.map(x=>`<div><span>${x.k}</span><div class="v020-bar-track"><i class="v020-budget-fill ${v019Width(x.v,max)}"></i></div><b>${v019Fmt(x.v)}</b></div>`).join('')}</div><div class="v020-budget-kpis"><span><b>${v020Compact(b.metrics?.transactions)}</b> transacciones</span><span><b>${v019Fmt(b.metrics?.cgr_candidate_links)}</b> enlaces CGR candidatos</span><span><b>${v019Fmt(b.metrics?.signals)}</b> señales</span></div><div class="v020-budget-list">${v019Array(b.top_signals).slice(0,3).map((s,i)=>`<button type="button" data-v020-budget="${i}"><span><b>${esc(v019Truncate(s.provider_or_recipient_name||s.organization_name||s.signal_type,58))}</b><small>${esc(s.signal_type||'Señal')} · ${esc(s.organization_name||'')}</small></span><strong>${v019Fmt(s.investigation_priority_score)}</strong></button>`).join('')}</div><div class="v019-note warn">El score de Presupuesto es prioridad investigativa propia del radar. Hasta completar su adaptador, estas señales <b>no son hallazgos Fusion</b>.</div>`;
}

function v020OpenBudgetSignal(i,budget){
  const s=v019Array(budget?.top_signals)[i];if(!s)return;
  v019OpenDrawer(`<div class="ey">Presupuesto Abierto · preview</div><h2>${esc(s.provider_or_recipient_name||s.organization_name||'Señal')}</h2><p class="lead">${esc(s.why_flagged||'Señal priorizada por Radar Presupuesto Abierto.')}</p><div class="v019-dscore"><b>${v019Fmt(s.investigation_priority_score)}</b><span>prioridad del radar / 100</span></div><div class="v019-dbox"><h3>Contexto</h3><div class="v019-plain">${esc(s.organization_name||'—')} · ${esc(s.signal_type||'—')} · período ${esc(s.periodo||'—')}${s.transaction_amount!=null?` · monto $${v019Fmt(s.transaction_amount)}`:''}.</div></div><div class="v019-dbox"><h3>Explicación</h3><div class="v019-plain">${esc(s.priority_explanation||'—')}</div>${v020Num(s.cgr_match_count)>0?`<div class="v019-plain">Cruce CGR candidato: ${v019Fmt(s.cgr_match_count)} enlace(s), ${v019Fmt(s.cgr_finding_count)} hallazgo(s) asociados en el radar de origen.</div>`:''}</div><div class="v019-dbox warn"><h3>Guardrail</h3><div class="v019-plain">${esc(budget.guardrail||'Preview no canónico; requiere integración y verificación documental.')}</div></div>`);
}

function v020Entry(meta,uaf,a){
  const cards=[
    ['uaf','UAF','Inteligencia UAF',`${v019Fmt(uaf.sectors.length)} sectores · SO, ROS/ROE, silencios y brechas`],
    ['territory','Territorio','Territorio','16 regiones · fenómenos, hallazgos y contexto económico'],
    ['entities','Entidades','Entidades',`${meta.entities==null?'Universo autorizado':v019Fmt(meta.entities)+' entidades'} · ficha 360 y evidencia directa`],
    ['sanctions','Sanciones','Sanciones',`${meta.sanctions==null?'Eventos materializados':v019Fmt(meta.sanctions)+' eventos'} · serie y recurrencia`],
    ['questions','Preguntas','Preguntas analíticas','Entrar por hipótesis y necesidad de análisis'],
    ['budget','Gasto','Presupuesto Abierto',`${v019Fmt(a.budget?.metrics?.priority_p1)} P1 · preview mientras se completa Fusion`]
  ];
  return `<div class="v020-entry-grid">${cards.map(([view,code,title,desc])=>`<button type="button" class="v020-entry-card" ${view==='budget'?'data-v020-budget-entry="1"':`data-home-view="${view}"`}><span>${esc(code)}</span><b>${esc(title)}</b><small>${esc(desc)}</small><strong>Abrir →</strong></button>`).join('')}</div>`;
}

function v020Bind(core,uaf,a){
  document.querySelectorAll('[data-home-view]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.homeView)));
  document.querySelectorAll('[data-finding]').forEach(b=>b.addEventListener('click',()=>{const f=core.findings.find(x=>x.finding_key===b.dataset.finding);if(f)v019OpenFinding(f);}));
  document.querySelectorAll('[data-pattern]').forEach(b=>b.addEventListener('click',()=>{const p=core.patterns.find(x=>x.alert_id===b.dataset.pattern);if(p)v019OpenPattern(p);}));
  document.querySelectorAll('[data-uaf-sector-home]').forEach(b=>b.addEventListener('click',async()=>{await v019LoadUaf();setTimeout(()=>v0193OpenSector(b.dataset.uafSectorHome,uaf),0);}));
  document.querySelectorAll('[data-v020-budget]').forEach(b=>b.addEventListener('click',()=>v020OpenBudgetSignal(v020Num(b.dataset.v020Budget),a.budget)));
  document.querySelector('[data-v020-budget-entry]')?.addEventListener('click',()=>{const host=document.querySelector('.v020-budget-card');host?.scrollIntoView({behavior:'smooth',block:'center'});});
  document.querySelectorAll('[data-press-home]').forEach(b=>b.addEventListener('click',()=>v019OpenPress(v020Num(b.dataset.pressHome),core.press)));
}

v019LoadOverview=async function(){
  state.view='overview';shell('Radar integrado','Entrada ejecutiva al ecosistema AML: hallazgos, scores explicables, UAF, tendencias, cobertura y contexto.');
  try{
    const [core,uaf,meta,a]=await Promise.all([v019LoadCore(),v0193LoadUafData(),v0194HomeMeta(),v020LoadAnalytics()]);
    const nonUaf=v0194NonUafFindings(core),top=nonUaf.find(f=>f.entity_id)||nonUaf[0],patterns=v0194NonUafPatterns(core),topPat=patterns[0];
    const coverage=v020Coverage(core,a),rosRows=[2021,2022,2023,2024,2025].map(year=>({year,ros:v020Num(uaf.report?.totals?.[`ros_${year}`])}));
    const ipaHelp=v020ScoreHelp('IPA · prioridad analítica','<p>Ordena revisión a partir de factores explicables de un hallazgo. <strong>No estima probabilidad de delito o LA/FT.</strong></p>');
    const patHelp=v020ScoreHelp('Fuerza de patrón','<p>Mide intensidad comparativa de una regla/patrón dentro del universo materializado. <strong>No es riesgo ni probabilidad.</strong></p>');
    const fusionHelp=v020ScoreHelp('Cobertura Fusion','<p>Porcentaje de los 9 productores objetivo que el audit de interoperabilidad declara listos o disponibles como contexto en Fusion. Es una métrica <strong>técnica de integración</strong>.</p>');
    const wbHelp=v020ScoreHelp('Cobertura Workbench','<p>Productores que hoy entregan datos directos o contexto visible a esta aplicación. Presupuesto se muestra como preview, pero no se cuenta como hallazgo canónico.</p>');
    v019Content().innerHTML=`
      <section class="v020-intro"><div><span>RADAR · v0.20</span><h2>De señales dispersas a una lectura operativa</h2><p>Primero identifica qué merece revisión; después muestra tendencia, cobertura y la ruta adecuada para profundizar. Ningún indicador mezcla contexto con riesgo.</p></div><div class="v020-intro-kpis"><span><b>${v019Fmt(meta.findings)}</b> hallazgos</span><span><b>${v019Fmt(meta.entities)}</b> entidades</span><span><b>${v019Fmt(meta.sanctions)}</b> sanciones</span></div></section>
      <section class="v020-score-grid">
        ${v020Gauge(top?.score_investigate||0,'IPA máximo visible',top?v019Truncate(top.title||'Hallazgo',48):'Sin hallazgo','ipa',ipaHelp)}
        ${v020Gauge(topPat?.strength||0,'Patrón más fuerte',topPat?v019Truncate(topPat.title||topPat.scope_label||'Patrón',48):'Sin patrón','pattern',patHelp)}
        ${v020Gauge(coverage.fusionScore,'Cobertura Fusion','8 de 9 productores objetivo','fusion',fusionHelp)}
        ${v020Gauge(coverage.wbScore,'Cobertura Workbench',`${Math.round(coverage.wbScore*V020_SYSTEM.length/100)} de 9 productores visibles de forma canónica/contextual`,'coverage',wbHelp)}
      </section>
      <section class="v0194-main-grid v020-main-grid">
        <article class="v019-card"><div class="v019-card-head"><div><h2>Qué revisar ahora</h2><p>Entidades/hallazgos ordenados por IPA y evidencia observable.</p></div><span class="hint">clic → explicación</span></div>${v0194Priority(core)}</article>
        <article class="v019-card v0194-uaf-card">${v0194UafEnvironment(uaf,core)}</article>
      </section>
      <section class="v020-chart-grid">
        <article class="v019-card"><div class="v019-card-head"><div><h2>Composición de hallazgos</h2><p>Qué tipo de objeto domina el universo actual y qué IPA promedio presenta.</p></div><span class="hint">18.231 actuales</span></div>${v020FindingBars(a.mix)}</article>
        <article class="v019-card"><div class="v019-card-head"><div><h2>Distribución IPA</h2><p>Concentración de prioridades; evita leer sólo el máximo.</p></div><span class="hint">distribución</span></div>${v020BandBars(a.bands)}</article>
        <article class="v019-card"><div class="v019-card-head"><div><h2>Reportes ROS · UAF</h2><p>Evolución anual 2021–2025. Flujo de reportes, no nivel de riesgo.</p></div>${v0193ReportHelp()}</div>${v020LineChart(rosRows,'year','ros')}</article>
        <article class="v019-card"><div class="v019-card-head"><div><h2>Sanciones · serie temporal</h2><p>Eventos materializados 2020–2026 y subconjunto LA/FT directo.</p></div><span class="hint">2026 parcial</span></div>${v020SanctionChart(a.sanYears)}</article>
      </section>
      <section class="v020-system-grid">
        <article class="v019-card"><div class="v019-card-head"><div><h2>Cobertura real del sistema</h2><p>Distingue productor operativo, integración Fusion y exposición efectiva en el Workbench.</p></div><span class="hint">missing ≠ zero</span></div>${coverage.html}</article>
        <article class="v019-card v020-budget-card"><div class="v019-card-head"><div><h2>Señales de gasto público</h2><p>Visibilidad temprana del radar mientras se completa su adaptador Fusion.</p></div><span class="hint">preview</span></div>${v020Budget(a)}</article>
      </section>
      <section class="v020-secondary-grid">
        <article class="v019-card"><div class="v019-card-head"><div><h2>Familias de patrones</h2><p>Volumen y fuerza máxima por familia analítica.</p></div><span class="hint">fuerza ≠ riesgo</span></div>${v020PatternFamilies(a.families)}</article>
        <article class="v019-card"><div class="v019-card-head"><div><h2>Contexto económico y prensa</h2><p>Capas explicativas independientes de los scores AML.</p></div><span class="hint">CONTEXT_ONLY</span></div>${v0194Context(core)}</article>
      </section>
      <section class="v019-card v020-entry"><div class="v019-card-head"><div><h2>Entrar al análisis</h2><p>La portada orienta; las vistas especializadas conservan el detalle y la trazabilidad.</p></div><span class="hint">profundizar</span></div>${v020Entry(meta,uaf,a)}</section>`;
    v020Bind(core,uaf,a);
  }catch(e){v019Content().innerHTML=`<div class="v019-error">${esc(e?.message||String(e))}</div>`;}
};
loadOverview=v019LoadOverview;
