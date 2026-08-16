'use strict';

const V019='0.19.0';
const V019_PRESS_BASE='https://raw.githubusercontent.com/smoralesm07-source/Radar_prensa/radar-state/data/exports/';
const v019LegacyLoadEntities=typeof loadEntities==='function'?loadEntities:null;
const v019LegacyLoadSanctions=typeof loadSanctions==='function'?loadSanctions:null;
const v019LegacyOpenEntity=typeof openEntity==='function'?openEntity:null;
const v019Cache={core:null,press:null,territory:new Map()};

function v019Fmt(v,d=0){const n=Number(v);if(!Number.isFinite(n))return '—';return n.toLocaleString('es-CL',{minimumFractionDigits:d,maximumFractionDigits:d});}
function v019Num(v){return Number(v)||0;}
function v019Truncate(v,n=100){const s=String(v??'');return s.length>n?s.slice(0,n-1)+'…':s;}
function v019Width(v,max=100){const n=max>0?Math.max(0,Math.min(100,100*v019Num(v)/max)):0;return `w${Math.round(n/5)*5}`;}
function v019Tone(v){const n=v019Num(v);return n>=80?'veryhigh':n>=60?'high':n>=40?'mid':'low';}
function v019ScoreTone(v){const n=v019Num(v);return n>=80?'hot':n>=60?'warn':n>=40?'':'ok';}
function v019Array(v){return Array.isArray(v)?v:[];}
function v019RegionNorm(v){return String(v||'Sin región').replace('Libertador Gral. Bernardo O\'Higgins','Libertador General Bernardo O\'Higgins');}
function v019RegionShort(v){const s=v019RegionNorm(v);const m={"Metropolitana de Santiago":'RM',"Libertador General Bernardo O'Higgins":'O’Higgins','Aysén del General Carlos Ibáñez del Campo':'Aysén','Magallanes y de la Antártica Chilena':'Magallanes'};return m[s]||s;}
function v019FindingType(v){return ({ENTITY_CONVERGENCE:'Convergencia de fuentes',CONTEXTUAL_ANOMALY:'Anomalía contextual',SUPERVISORY_GAP:'Brecha supervisiva',PRUDENTIAL_SANCTION:'Sanción observada',GOVERNED_AML_SIGNAL:'Señal AML gobernada'})[v]||String(v||'Hallazgo');}
function v019PatternType(v){return String(v||'').replaceAll('_',' ').toLowerCase().replace(/^./,c=>c.toUpperCase());}
function v019PressStatus(v){return ({NEW_ACTIVITY:'Actividad nueva',ELEVATED:'Cobertura elevada',STABLE:'Estable',LOW_VOLUME:'Bajo volumen',INSUFFICIENT_BASELINE:'Baseline insuficiente'})[v]||String(v||'Sin estado');}
function v019PressRank(v){return ({NEW_ACTIVITY:5,ELEVATED:4,STABLE:3,LOW_VOLUME:2,INSUFFICIENT_BASELINE:1})[v]||0;}
function v019Content(){return document.querySelector('#content');}

function v019NavButton(view,label,count=''){
  return `<button type="button" class="v019-nav-btn ${state.view===view?'active':''}" data-view="${esc(view)}">${esc(label)}${count!==''?`<span class="n">${esc(String(count))}</span>`:''}</button>`;
}

function v019Shell(title,subtitle){
  const role=state.access?.role||'viewer';
  const email=state.user?.email||'usuario';
  app.innerHTML=`<div class="v019-shell">
    <aside class="v019-side">
      <div class="v019-brand"><div class="mark">AML</div><small>Operational Radar · v${V019}</small><strong>Intelligence Workbench</strong></div>
      <nav class="v019-nav" aria-label="Navegación principal">
        <span class="v019-nav-label">Radar</span>
        ${v019NavButton('overview','Radar integrado')}
        ${v019NavButton('territory','Territorio')}
        ${v019NavButton('uaf','Supervisión UAF')}
        <span class="v019-nav-label">Profundizar</span>
        ${v019NavButton('entities','Entidades')}
        ${v019NavButton('sanctions','Sanciones')}
        ${v019NavButton('questions','Preguntas')}
      </nav>
      <div class="v019-side-foot"><b>Regla de lectura</b><br>Prioridad analítica ≠ probabilidad de delito. Prensa es contexto y no incrementa los scores AML.</div>
    </aside>
    <main class="v019-main">
      <header class="v019-top">
        <strong>${esc(title)}</strong><span class="grow"></span>
        <input id="v019-search" type="search" placeholder="Buscar entidad o RUT" aria-label="Buscar entidad o RUT">
        <span class="v019-user"><span class="v019-secure">●</span>${esc(role)}</span>
        <button type="button" id="v019-logout" title="${esc(email)}">Salir</button>
      </header>
      <section class="v019-content">
        <div class="v019-title"><div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div><div class="v019-asof"><b>Lectura analítica, no conclusión</b>Datos autorizados por RLS · contexto de prensa público</div></div>
        <section id="content"><div class="v019-loading">Consultando datos autorizados…</div></section>
      </section>
    </main>
    <aside class="v019-drawer" id="v019-drawer"><button type="button" class="v019-drawer-close" id="v019-drawer-close">Cerrar</button><div id="v019-drawer-body"></div></aside>
  </div>`;
  document.querySelector('#v019-logout').addEventListener('click',signOut);
  document.querySelector('#v019-drawer-close').addEventListener('click',v019CloseDrawer);
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.view)));
  const search=document.querySelector('#v019-search');
  search.addEventListener('keydown',e=>{if(e.key==='Enter'&&search.value.trim())v019SearchEntity(search.value.trim());});
}
shell=v019Shell;

async function v019Navigate(view){
  state.view=view;
  if(view==='overview')return v019LoadOverview();
  if(view==='territory')return v019LoadTerritory();
  if(view==='uaf')return v019LoadUaf();
  if(view==='questions')return v019LoadQuestions();
  if(view==='entities'&&v019LegacyLoadEntities)return v019LegacyLoadEntities();
  if(view==='sanctions'&&v019LegacyLoadSanctions)return v019LegacyLoadSanctions();
  return v019LoadOverview();
}
navigate=v019Navigate;

function v019OpenDrawer(html){const d=document.querySelector('#v019-drawer'),b=document.querySelector('#v019-drawer-body');if(!d||!b)return;b.innerHTML=html;d.classList.add('open');}
function v019CloseDrawer(){document.querySelector('#v019-drawer')?.classList.remove('open');}

async function v019FetchPress(){
  if(v019Cache.press)return v019Cache.press;
  try{
    const [mr,pr]=await Promise.all([fetch(V019_PRESS_BASE+'manifest.json',{cache:'no-store'}),fetch(V019_PRESS_BASE+'phenomenon_windows.jsonl',{cache:'no-store'})]);
    if(!mr.ok||!pr.ok)throw new Error('Radar Prensa no disponible');
    const manifest=await mr.json();
    const txt=await pr.text();
    const phenomena=txt.split(/\r?\n/).filter(Boolean).map(line=>{try{return JSON.parse(line)}catch{return null}}).filter(Boolean)
      .filter(x=>x.stable_signal_taxonomy===true)
      .sort((a,b)=>v019PressRank(b.status)-v019PressRank(a.status)||(v019Num(b.recent_vs_baseline_ratio)-v019Num(a.recent_vs_baseline_ratio))||(v019Num(b.recent_count)-v019Num(a.recent_count)));
    v019Cache.press={manifest,phenomena};
  }catch(error){v019Cache.press={error,manifest:null,phenomena:[]};}
  return v019Cache.press;
}

async function v019LoadCore(force=false){
  if(v019Cache.core&&!force)return v019Cache.core;
  const queries=[
    sb.from('aml_findings').select('finding_key,finding_type,entity_id,title,region,commune,score_explore,score_supervise,score_investigate,source_count,evidence_count,payload').order('score_investigate',{ascending:false,nullsFirst:false}).limit(50),
    sb.from('aml_v019_region_priority').select('*').order('attention_index',{ascending:false,nullsFirst:false}),
    sb.from('aml_v019_gap_region').select('*').order('gap_attention_index',{ascending:false,nullsFirst:false}),
    sb.from('aml_v019_gap_sector').select('*').order('candidate_pairs',{ascending:false}),
    sb.from('aml_v019_uaf_region').select('*').order('uaf_observed',{ascending:false}),
    sb.from('aml_v019_uaf_cross_radar').select('*').order('uaf_entities',{ascending:false}),
    sb.from('aml_pattern_alerts').select('alert_id,family,pattern_type,scope_type,scope_id,scope_label,strength,priority,title,summary,payload').order('strength',{ascending:false,nullsFirst:false}).limit(100)
  ];
  const [findings,regions,gaps,gapSectors,uafRegions,uafCross,patterns,press]=await Promise.all([...queries,v019FetchPress()]);
  for(const q of [findings,regions,gaps,gapSectors,uafRegions,uafCross,patterns])if(q.error)throw q.error;
  v019Cache.core={findings:findings.data||[],regions:regions.data||[],gaps:gaps.data||[],gapSectors:gapSectors.data||[],uafRegions:uafRegions.data||[],uafCross:uafCross.data||[],patterns:patterns.data||[],press};
  return v019Cache.core;
}

function v019ScoreCard(kind,label,score,title,detail,attrs=''){
  return `<article class="v019-scorecard ${v019ScoreTone(score)}" ${attrs}><span class="go">→</span><div class="ey">${esc(label)}</div><div class="row"><span class="score">${esc(v019Fmt(score,1))}</span><span class="unit">/ 100</span></div><h3>${esc(title)}</h3><p>${esc(detail)}</p></article>`;
}

function v019PatternList(patterns,n=6){
  return `<div class="v019-stack">${patterns.slice(0,n).map((p,i)=>`<article class="v019-listitem ${v019Num(p.strength)>=99?'hot':''}" data-pattern="${esc(p.alert_id)}"><span class="stripe"></span><div><h3>${esc(p.title||p.scope_label||'Patrón')}</h3><p>${esc(p.summary||'')}</p><div class="v019-chips"><span class="v019-chip">${esc(p.family||'Patrón')}</span><span class="v019-chip">${esc(p.scope_type||'')}</span></div></div><div class="value"><b>${v019Fmt(p.strength,1)}</b><span>fuerza</span></div></article>`).join('')}</div>`;
}

function v019RegionBars(rows,n=8){
  const valid=rows.filter(r=>v019RegionNorm(r.region)!=='Sin región').slice(0,n);const max=Math.max(...valid.map(r=>v019Num(r.attention_index)),1);
  return `<div class="v019-bars">${valid.map(r=>`<div class="v019-barrow" data-region="${esc(v019RegionNorm(r.region))}"><span class="v019-barlabel">${esc(v019RegionShort(r.region))}</span><div class="v019-track"><div class="v019-fill ${v019Width(r.attention_index,max)}"></div></div><span class="v019-barvalue">${v019Fmt(r.attention_index,1)}</span></div>`).join('')}</div>`;
}

function v019GapBars(rows,n=9){
  const valid=rows.filter(r=>v019RegionNorm(r.region)!=='Sin región'&&r.gap_attention_index!==null).slice(0,n);const max=Math.max(...valid.map(r=>v019Num(r.gap_attention_index)),1);
  return `<div class="v019-bars">${valid.map(r=>`<div class="v019-barrow" data-gap-region="${esc(v019RegionNorm(r.region))}"><span class="v019-barlabel">${esc(v019RegionShort(r.region))}</span><div class="v019-track"><div class="v019-fill amber ${v019Width(r.gap_attention_index,max)}"></div></div><span class="v019-barvalue">${v019Fmt(r.gap_attention_index,1)}</span></div>`).join('')}</div>`;
}

function v019UafCrossBars(core){
  const total=core.uafRegions.reduce((a,r)=>a+v019Num(r.uaf_observed),0)||1;
  const rows=core.uafCross.filter(r=>r.radar_id!=='RADAR_UAF');
  return `<div class="v019-uaf-summary"><div class="v019-uafbox"><span>Observados en corte UAF</span><b>${v019Fmt(total)}</b><small>universo público observado</small></div><div class="v019-uafbox"><span>Con 3+ productores</span><b>${v019Fmt(core.uafRegions.reduce((a,r)=>a+v019Num(r.uaf_three_plus_sources),0))}</b><small>convergencia de fuentes</small></div><div class="v019-uafbox"><span>UAF + sanción</span><b>${v019Fmt(core.uafRegions.reduce((a,r)=>a+v019Num(r.uaf_sanctioned),0))}</b><small>contexto sancionatorio</small></div></div><div class="v019-bars">${rows.map(r=>`<div class="v019-barrow"><span class="v019-barlabel">${esc(String(r.radar_id).replace('RADAR_',''))}</span><div class="v019-track"><div class="v019-fill green ${v019Width(r.uaf_entities,total)}"></div></div><span class="v019-barvalue">${v019Fmt(r.uaf_entities)}</span></div>`).join('')}</div>`;
}

function v019PressCards(press){
  if(!press||press.error)return `<div class="v019-empty">El contexto longitudinal de Radar Prensa no pudo cargarse. Los scores estructurados siguen operativos.</div>`;
  const rows=press.phenomena.slice(0,4);
  if(!rows.length)return `<div class="v019-empty">No hay fenómenos de taxonomía gobernada en el corte actual.</div>`;
  return `<div class="v019-press-cards">${rows.map((p,i)=>`<article class="v019-press-card" data-press-index="${i}"><div class="status">${esc(v019PressStatus(p.status))}</div><h3>${esc(p.phenomenon)}</h3><p>Ventana reciente de 7 días comparada con baseline previo. No modifica el score AML.</p><div class="nums"><span><b>${v019Fmt(p.recent_count)}</b><br>noticias</span><span><b>${v019Fmt(p.recent_source_count)}</b><br>fuentes</span><span><b>${Number.isFinite(Number(p.recent_vs_baseline_ratio))?v019Fmt(p.recent_vs_baseline_ratio,2)+'×':'—'}</b><br>vs baseline</span></div></article>`).join('')}</div><div class="v019-press-warning">Radar Prensa describe cambio de cobertura periodística. No acredita hechos, incidencia delictual ni riesgo LA/FT.</div>`;
}

function v019QuestionsMini(){
 const qs=[
  ['priority','¿Qué entidades tienen mayor prioridad investigativa y por qué?','Convergencia / IPA'],
  ['multisource','¿Qué entidades aparecen en 3 o más fuentes independientes?','Convergencia'],
  ['gap','¿Dónde existe mayor brecha potencial de cobertura UAF?','Supervisión UAF'],
  ['emerging','¿Dónde están emergiendo fenómenos nuevos?','Territorio + Prensa'],
  ['uaf-cross','¿Cómo se mueven los sujetos observados UAF en los otros radares?','UAF'],
  ['sanctions','¿Qué señales sancionatorias merecen revisión primero?','Sanciones']
 ];
 return `<div class="v019-questions">${qs.map(q=>`<button type="button" class="v019-question" data-question="${q[0]}"><b>${esc(q[1])}</b><span>${esc(q[2])}</span></button>`).join('')}</div>`;
}

async function v019LoadOverview(){
 state.view='overview';shell('Radar integrado','Indicadores explicables, fenómenos comparativos, supervisión UAF y contexto longitudinal de prensa.');
 try{
  const core=await v019LoadCore();
  const topFinding=core.findings.find(f=>f.entity_id)||core.findings[0];
  const topRegion=core.regions.find(r=>v019RegionNorm(r.region)!=='Sin región');
  const topGap=core.gaps.find(r=>v019RegionNorm(r.region)!=='Sin región'&&r.gap_attention_index!==null);
  const topPattern=core.patterns.find(p=>p.scope_type!=='SYSTEM')||core.patterns[0];
  const pressTop=core.press?.phenomena?.[0];
  const pressMsg=pressTop?`${v019PressStatus(pressTop.status)} en “${pressTop.phenomenon}”: ${v019Fmt(pressTop.recent_count)} publicaciones recientes en ${v019Fmt(pressTop.recent_source_count)} fuentes.`:'Contexto de Radar Prensa no disponible en este corte.';
  v019Content().innerHTML=`
   <div class="v019-press-strip"><span class="label">RADAR PRENSA</span><span class="msg">${esc(pressMsg)}</span><button type="button" data-open-press="0">Ver contexto →</button></div>
   <section class="v019-scoregrid">
    ${v019ScoreCard('finding','Prioridad investigativa',topFinding?.score_investigate||0,v019Truncate(topFinding?.payload?.entity_label||topFinding?.title||'Sin hallazgo',58),`${v019FindingType(topFinding?.finding_type)} · ${v019Fmt(topFinding?.source_count)} fuentes`,`data-finding="${esc(topFinding?.finding_key||'')}"`)}
    ${v019ScoreCard('territory','Atención territorial',topRegion?.attention_index||0,v019RegionShort(topRegion?.region),`${v019Fmt(topRegion?.high_priority_count)} hallazgos ≥60 · P90 ${v019Fmt(topRegion?.p90_investigate,1)}`,`data-region="${esc(v019RegionNorm(topRegion?.region))}"`)}
    ${v019ScoreCard('gap','Brecha supervisiva',topGap?.gap_attention_index||0,v019RegionShort(topGap?.region),`${v019Fmt(topGap?.candidate_pairs)} pares RUT–actividad candidatos`,`data-gap-region="${esc(v019RegionNorm(topGap?.region))}"`)}
    ${v019ScoreCard('pattern','Fuerza de patrón',topPattern?.strength||0,v019Truncate(topPattern?.scope_label||topPattern?.title||'Patrón',58),v019Truncate(topPattern?.title||'',82),`data-pattern="${esc(topPattern?.alert_id||'')}"`)}
   </section>
   <section class="v019-grid">
    <article class="v019-card"><div class="v019-card-head"><div><h2>Fenómenos que justifican mirar</h2><p>Patrones comparativos ya materializados en Fusion.</p></div><span class="hint">fuerza ≠ probabilidad</span></div>${v019PatternList(core.patterns.filter(p=>p.scope_type!=='SYSTEM'),7)}</article>
    <article class="v019-card"><div class="v019-card-head"><div><h2>Dónde mirar primero</h2><p>Índice de Atención Territorial, sin componente de prensa.</p></div><span class="hint">clic en región</span></div>${v019RegionBars(core.regions,9)}</article>
    <article class="v019-card"><div class="v019-card-head"><div><h2>Brecha potencial UAF por región</h2><p>Screening fuerte SII no observado en el corte público UAF.</p></div><span class="hint">pares RUT–actividad</span></div>${v019GapBars(core.gaps,9)}</article>
    <article class="v019-card"><div class="v019-card-head"><div><h2>Sujetos observados UAF en otros radares</h2><p>Lectura simple de interoperabilidad del universo UAF observado.</p></div><span class="hint">no implica hallazgo</span></div>${v019UafCrossBars(core)}</article>
    <article class="v019-card v019-full"><div class="v019-card-head"><div><h2>Contexto longitudinal de prensa</h2><p>Momentum de fenómenos: reciente 7 días vs baseline previo de 28 días.</p></div><span class="hint">CONTEXT_ONLY</span></div>${v019PressCards(core.press)}</article>
    <article class="v019-card v019-full"><div class="v019-card-head"><div><h2>Preguntas para entrar al análisis</h2><p>Accesos directos a respuestas calculadas con los datos hoy materializados.</p></div><span class="hint">pregunta → evidencia</span></div>${v019QuestionsMini()}</article>
   </section>`;
  v019BindCommon(core);
 }catch(e){v019Content().innerHTML=`<div class="v019-error">${esc(e?.message||String(e))}</div>`;}
}
loadOverview=v019LoadOverview;

function v019BindCommon(core){
 document.querySelectorAll('[data-finding]').forEach(el=>el.addEventListener('click',()=>{const f=core.findings.find(x=>x.finding_key===el.dataset.finding);if(f)v019OpenFinding(f);}));
 document.querySelectorAll('[data-pattern]').forEach(el=>el.addEventListener('click',()=>{const p=core.patterns.find(x=>x.alert_id===el.dataset.pattern);if(p)v019OpenPattern(p);}));
 document.querySelectorAll('[data-region]').forEach(el=>el.addEventListener('click',()=>v019OpenRegion(el.dataset.region,core)));
 document.querySelectorAll('[data-gap-region]').forEach(el=>el.addEventListener('click',()=>v019OpenGapRegion(el.dataset.gapRegion,core)));
 document.querySelectorAll('[data-press-index]').forEach(el=>el.addEventListener('click',()=>v019OpenPress(v019Num(el.dataset.pressIndex),core.press)));
 document.querySelectorAll('[data-open-press]').forEach(el=>el.addEventListener('click',()=>v019OpenPress(v019Num(el.dataset.openPress),core.press)));
 document.querySelectorAll('[data-question]').forEach(el=>el.addEventListener('click',()=>v019AnswerQuestion(el.dataset.question,core)));
}

function v019OpenFinding(f){
 const p=f.payload||{},features=p.decision_features||{},facts=p.decision_facts||{};
 const weights={independent_sources:.30,rule_strength:.25,recurrence:.20,network_context:.15,evidence_breadth:.10};
 const parts=Object.entries(weights).map(([k,w])=>({k,v:v019Num(features[k]),w,c:v019Num(features[k])*w}));
 const calc=parts.reduce((a,x)=>a+x.c,0);
 const factorNames={independent_sources:'Fuentes independientes',rule_strength:'Fuerza de regla',recurrence:'Recurrencia',network_context:'Contexto de red',evidence_breadth:'Amplitud de evidencia'};
 v019OpenDrawer(`<div class="ey">${esc(v019FindingType(f.finding_type))}</div><h2>${esc(p.entity_label||f.title||'Hallazgo')}</h2><p class="lead">${esc(p.explanation||'Hallazgo priorizado para revisión analítica.')}</p><div class="v019-dscore"><b>${v019Fmt(f.score_investigate,1)}</b><span>IPA · INVESTIGAR / 100</span></div><div class="v019-dbox"><h3>Cómo se formó</h3>${parts.map(x=>`<div class="v019-factor"><span>${esc(factorNames[x.k])}: ${v019Fmt(x.v,2)} × ${v019Fmt(x.w,2)}</span><b>${v019Fmt(x.c,2)}</b></div>`).join('')}<div class="v019-factor"><span><b>Resultado ponderado</b></span><b>${v019Fmt(calc,2)}</b></div></div><div class="v019-dbox"><h3>Hechos observables</h3><div class="v019-plain">${esc(v019Fmt(f.source_count))} fuentes · ${esc(v019Fmt(f.evidence_count))} evidencias · ${esc(v019Fmt(facts.contextual_anomalies||0))} anomalías contextuales · ${esc(v019Fmt(facts.sanctions||0))} sanciones · ${esc(v019Fmt(facts.observed_relationships||0))} relaciones observadas.</div><div class="v019-chips">${v019Array(p.producer_ids).map(x=>`<span class="v019-chip">${esc(String(x).replace('RADAR_',''))}</span>`).join('')}</div></div>${v019Array(p.supporting_factors).length?`<div class="v019-dbox"><h3>Qué sostiene la prioridad</h3>${v019Array(p.supporting_factors).map(x=>`<div class="v019-plain">• ${esc(x)}</div>`).join('')}</div>`:''}<div class="v019-dbox warn"><h3>Qué NO significa</h3>${v019Array(p.contradicting_factors).map(x=>`<div class="v019-plain">• ${esc(x)}</div>`).join('')||'<div class="v019-plain">El score ordena revisión; no estima probabilidad de delito ni acredita conducta.</div>'}</div><div class="v019-actions">${f.entity_id?'<button type="button" class="v019-action" id="v019-open-entity">Abrir Entidad 360</button>':''}<button type="button" class="v019-action" id="v019-go-findings">Ver hallazgos</button></div>`);
 document.querySelector('#v019-open-entity')?.addEventListener('click',()=>{v019CloseDrawer();if(v019LegacyOpenEntity)v019LegacyOpenEntity(f.entity_id);});
 document.querySelector('#v019-go-findings')?.addEventListener('click',()=>{v019CloseDrawer(); if(typeof loadFindings==='function'){state.view='findings';loadFindings();}});
}

function v019OpenRegion(region,core){
 const r=core.regions.find(x=>v019RegionNorm(x.region)===v019RegionNorm(region));if(!r)return;
 const maxHigh=Math.max(...core.regions.filter(x=>v019RegionNorm(x.region)!=='Sin región').map(x=>v019Num(x.high_priority_count)),1);
 const p90=v019Num(r.p90_investigate),volume=100*Math.log1p(v019Num(r.high_priority_count))/Math.log1p(maxHigh),sources=Math.min(100,25*v019Num(r.avg_sources));
 const calc=.65*p90+.25*volume+.10*sources;
 const gap=core.gaps.find(x=>v019RegionNorm(x.region)===v019RegionNorm(region));
 const uaf=core.uafRegions.find(x=>v019RegionNorm(x.region)===v019RegionNorm(region));
 v019OpenDrawer(`<div class="ey">Atención territorial</div><h2>${esc(v019RegionShort(region))}</h2><p class="lead">Índice para ordenar revisión regional usando sólo hallazgos estructurados de Fusion. Prensa no participa del cálculo.</p><div class="v019-dscore"><b>${v019Fmt(r.attention_index,1)}</b><span>IAT / 100</span></div><div class="v019-dbox"><h3>Fórmula</h3><div class="v019-factor"><span>P90 prioridad investigativa · ${v019Fmt(p90,1)} × 0,65</span><b>${v019Fmt(.65*p90,2)}</b></div><div class="v019-factor"><span>Volumen relativo de hallazgos ≥60 · ${v019Fmt(volume,1)} × 0,25</span><b>${v019Fmt(.25*volume,2)}</b></div><div class="v019-factor"><span>Diversidad media de fuentes · ${v019Fmt(sources,1)} × 0,10</span><b>${v019Fmt(.10*sources,2)}</b></div><div class="v019-factor"><span><b>Resultado</b></span><b>${v019Fmt(calc,2)}</b></div></div><div class="v019-dbox"><h3>Lectura rápida</h3><div class="v019-plain">${v019Fmt(r.finding_count)} hallazgos · ${v019Fmt(r.high_priority_count)} con prioridad investigativa ≥60 · máximo ${v019Fmt(r.max_investigate,1)}.</div>${gap?`<div class="v019-plain">Brecha supervisiva: ${v019Fmt(gap.candidate_pairs)} pares RUT–actividad candidatos.</div>`:''}${uaf?`<div class="v019-plain">Observados UAF en la región: ${v019Fmt(uaf.uaf_observed)}.</div>`:''}</div><div class="v019-dbox warn"><h3>Guardrail</h3><div class="v019-plain">Concentración territorial de hallazgos no implica causalidad ni mayor incidencia LA/FT. El índice ordena dónde revisar primero.</div></div><div class="v019-actions"><button class="v019-action" type="button" id="v019-open-territory">Abrir territorio</button></div>`);
 document.querySelector('#v019-open-territory')?.addEventListener('click',()=>{v019CloseDrawer();v019LoadTerritory(region);});
}

function v019OpenGapRegion(region,core){
 const rows=core.gaps.filter(x=>v019RegionNorm(x.region)!=='Sin región'&&x.gap_attention_index!==null);const g=rows.find(x=>v019RegionNorm(x.region)===v019RegionNorm(region));if(!g)return;
 const maxPairs=Math.max(...rows.map(x=>v019Num(x.candidate_pairs)),1),maxDensity=Math.max(...rows.map(x=>v019Num(x.candidate_pairs_per_1000_entities)),1),maxBreadth=Math.max(...rows.map(x=>v019Num(x.sector_breadth)),1);
 const density=100*v019Num(g.candidate_pairs_per_1000_entities)/maxDensity,volume=100*Math.log1p(v019Num(g.candidate_pairs))/Math.log1p(maxPairs),breadth=100*v019Num(g.sector_breadth)/maxBreadth;const calc=.30*density+.50*volume+.20*breadth;
 v019OpenDrawer(`<div class="ey">Supervisión UAF</div><h2>${esc(v019RegionShort(region))}</h2><p class="lead">Índice de atención de brecha supervisiva para ordenar screening. No es un índice de incumplimiento.</p><div class="v019-dscore"><b>${v019Fmt(g.gap_attention_index,1)}</b><span>IBS / 100</span></div><div class="v019-dbox"><h3>Qué se está contando</h3><div class="v019-plain"><b>${v019Fmt(g.candidate_pairs)}</b> pares RUT–actividad con match fuerte SII no observados en el corte público UAF, distribuidos en ${v019Fmt(g.sector_breadth)} sectores. Universo Fusion regional: ${v019Fmt(g.entity_universe)} entidades.</div></div><div class="v019-dbox"><h3>Fórmula del IBS</h3><div class="v019-factor"><span>Densidad relativa de pares · ${v019Fmt(density,1)} × 0,30</span><b>${v019Fmt(.30*density,2)}</b></div><div class="v019-factor"><span>Volumen log-normalizado · ${v019Fmt(volume,1)} × 0,50</span><b>${v019Fmt(.50*volume,2)}</b></div><div class="v019-factor"><span>Amplitud sectorial · ${v019Fmt(breadth,1)} × 0,20</span><b>${v019Fmt(.20*breadth,2)}</b></div><div class="v019-factor"><span><b>Resultado</b></span><b>${v019Fmt(calc,2)}</b></div></div><div class="v019-dbox warn"><h3>Limitación clave</h3><div class="v019-plain">Estos son <b>pares RUT–actividad candidatos</b>, no personas jurídicas únicas y no prueba de que una entidad esté jurídicamente “no inscrita”. Actividad SII ≠ obligación UAF por sí sola; no observado en el corte UAF ≠ no inscrito.</div></div><div class="v019-actions"><button class="v019-action" type="button" id="v019-open-uaf">Abrir supervisión UAF</button></div>`);
 document.querySelector('#v019-open-uaf')?.addEventListener('click',()=>{v019CloseDrawer();v019LoadUaf(region);});
}

function v019OpenPattern(p){
 v019OpenDrawer(`<div class="ey">${esc(p.family||'Patrón')}</div><h2>${esc(p.title||p.scope_label||'Patrón')}</h2><p class="lead">${esc(p.summary||'')}</p><div class="v019-dscore"><b>${v019Fmt(p.strength,1)}</b><span>fuerza comparativa / 100</span></div><div class="v019-dbox"><h3>Ámbito</h3><div class="v019-plain">${esc(p.scope_type||'—')} · ${esc(p.scope_label||'—')} · prioridad ${esc(p.priority||'—')}.</div></div><div class="v019-dbox"><h3>Tipo de patrón</h3><div class="v019-plain">${esc(v019PatternType(p.pattern_type))}</div></div><div class="v019-dbox warn"><h3>Cómo leerlo</h3><div class="v019-plain">La fuerza compara la intensidad de una regla/patrón dentro del universo disponible. No es probabilidad de LA/FT, delito, incumplimiento ni responsabilidad.</div></div>`);
}

function v019OpenPress(i,press){
 const p=press?.phenomena?.[i];if(!p){v019OpenDrawer(`<h2>Radar Prensa</h2><div class="v019-empty">Contexto longitudinal no disponible.</div>`);return;}
 const w=p.window||{};
 v019OpenDrawer(`<div class="ey">Radar Prensa · CONTEXT_ONLY</div><h2>${esc(p.phenomenon)}</h2><p class="lead">${esc(v019PressStatus(p.status))}. La señal describe cambio de cobertura periodística, no cambio probado de incidencia.</p><div class="v019-dbox press"><h3>Ventana reciente</h3><div class="v019-plain">${esc(w.recent_from||'—')} → ${esc(w.recent_to||'—')} · ${v019Fmt(p.recent_count)} publicaciones · ${v019Fmt(p.recent_source_count)} fuentes · ${v019Fmt(p.recent_active_days)} días activos.</div></div><div class="v019-dbox"><h3>Baseline</h3><div class="v019-plain">${esc(w.baseline_from||'—')} → ${esc(w.baseline_to||'—')} · ${v019Fmt(p.baseline_count)} publicaciones · ${v019Fmt(p.baseline_source_count)} fuentes · calidad ${esc(w.baseline_quality||'—')}.</div><div class="v019-plain">Ratio reciente / baseline semanal: <b>${Number.isFinite(Number(p.recent_vs_baseline_ratio))?v019Fmt(p.recent_vs_baseline_ratio,2)+'×':'—'}</b>.</div></div><div class="v019-dbox warn"><h3>Guardrail metodológico</h3><div class="v019-plain">${esc(p.interpretation_guardrail||'Prensa es contexto y evidencia secundaria; no acredita hechos por sí sola.')}</div></div>`);
}

async function v019LoadUaf(selectedRegion=''){
 state.view='uaf';shell('Supervisión UAF','Sujetos observados en el corte público, cruces con otros radares y brecha potencial por región/sector.');
 try{
  const core=await v019LoadCore();const total=core.uafRegions.reduce((a,r)=>a+v019Num(r.uaf_observed),0);const gapTotal=core.gaps.reduce((a,r)=>a+v019Num(r.candidate_pairs),0);
  const maxGap=Math.max(...core.gaps.filter(r=>r.gap_attention_index!==null).map(r=>v019Num(r.gap_attention_index)),1);
  v019Content().innerHTML=`<section class="v019-grid"><article class="v019-card v019-full"><div class="v019-card-head"><div><h2>Cómo se mueve el universo UAF observado</h2><p>Intersección de entidades observadas UAF con los demás productores materializados.</p></div><span class="hint">corte público</span></div>${v019UafCrossBars(core)}</article><article class="v019-card"><div class="v019-card-head"><div><h2>Brecha potencial por región</h2><p>Índice IBS + pares RUT–actividad candidatos.</p></div><span class="hint">clic para fórmula</span></div>${v019GapBars(core.gaps,16)}</article><article class="v019-card"><div class="v019-card-head"><div><h2>Sectores con mayor volumen de screening</h2><p>Acumulado territorial de pares RUT–actividad.</p></div><span class="hint">no son personas únicas</span></div><div class="v019-bars">${core.gapSectors.slice(0,12).map(s=>`<div class="v019-barrow"><span class="v019-barlabel">${esc(v019Truncate(s.sector_name,34))}</span><div class="v019-track"><div class="v019-fill amber ${v019Width(s.candidate_pairs,Math.max(...core.gapSectors.map(x=>v019Num(x.candidate_pairs)),1))}"></div></div><span class="v019-barvalue">${v019Fmt(s.candidate_pairs)}</span></div>`).join('')}</div></article><article class="v019-card v019-full"><div class="v019-card-head"><div><h2>Lectura regional UAF</h2><p>Observados UAF, sanciones y convergencia en otras fuentes.</p></div><span class="hint">ausencia ≠ cero</span></div><div class="v019-tablewrap"><table class="v019-table"><thead><tr><th>Región</th><th>Universo Fusion</th><th>Observados UAF</th><th>UAF + sanción</th><th>UAF 3+ fuentes</th><th>Brecha IBS</th></tr></thead><tbody>${core.uafRegions.slice().sort((a,b)=>v019Num(b.uaf_observed)-v019Num(a.uaf_observed)).map(r=>{const g=core.gaps.find(x=>v019RegionNorm(x.region)===v019RegionNorm(r.region));return `<tr data-region="${esc(v019RegionNorm(r.region))}"><td><b>${esc(v019RegionShort(r.region))}</b></td><td>${v019Fmt(r.entity_universe)}</td><td>${v019Fmt(r.uaf_observed)}</td><td>${v019Fmt(r.uaf_sanctioned)}</td><td>${v019Fmt(r.uaf_three_plus_sources)}</td><td>${g?.gap_attention_index!==null&&g?.gap_attention_index!==undefined?v019Fmt(g.gap_attention_index,1):'<span class="v019-na">—</span>'}</td></tr>`}).join('')}</tbody></table></div><div class="v019-note warn"><b>Importante:</b> ${v019Fmt(gapTotal)} es la suma de pares RUT–actividad candidatos de todos los screenings, no el número de personas jurídicas “no inscritas”. La deduplicación jurídica a persona única no está materializada en esta capa.</div></article></section>`;
  v019BindCommon(core);
  if(selectedRegion)setTimeout(()=>v019OpenGapRegion(selectedRegion,core),0);
 }catch(e){v019Content().innerHTML=`<div class="v019-error">${esc(e?.message||String(e))}</div>`;}
}

const V019_REGION_ORDER=['Arica y Parinacota','Tarapacá','Antofagasta','Atacama','Coquimbo','Valparaíso','Metropolitana de Santiago',"Libertador General Bernardo O'Higgins",'Maule','Ñuble','Biobío','La Araucanía','Los Ríos','Los Lagos','Aysén del General Carlos Ibáñez del Campo','Magallanes y de la Antártica Chilena'];
function v019TerritoryMap(core,selected){
 const by=new Map(core.regions.map(r=>[v019RegionNorm(r.region),r]));
 return `<div class="v019-chile">${V019_REGION_ORDER.map((name,i)=>{const r=by.get(name);return `<button type="button" class="v019-region r${i+1} ${v019Tone(r?.attention_index)} ${name===selected?'active':''}" data-territory-select="${esc(name)}">${esc(v019RegionShort(name))}</button>`}).join('')}</div>`;
}

async function v019LoadTerritory(initial=''){
 state.view='territory';shell('Territorio','Mapa analítico de 16 regiones: prioridad, brecha UAF, patrones y hallazgos sin propagar riesgo por proximidad geográfica.');
 try{
  const core=await v019LoadCore();const selected=initial||v019RegionNorm(core.regions.find(r=>v019RegionNorm(r.region)!=='Sin región')?.region)||'Metropolitana de Santiago';
  v019Content().innerHTML=`<section class="v019-grid"><article class="v019-card"><div class="v019-card-head"><div><h2>Chile · 16 regiones</h2><p>Color = Índice de Atención Territorial.</p></div><span class="hint">seleccione región</span></div><div class="v019-territory-layout">${v019TerritoryMap(core,selected)}<div class="v019-region-detail" id="v019-territory-detail"><div class="v019-loading">Preparando lectura regional…</div></div></div></article><article class="v019-card"><div class="v019-card-head"><div><h2>Ranking nacional</h2><p>Prioridad territorial explicable.</p></div><span class="hint">IAT / 100</span></div>${v019RegionBars(core.regions,16)}</article><article class="v019-card v019-full"><div class="v019-card-head"><div><h2>Principio territorial</h2><p>La geografía ayuda a localizar concentraciones; no crea causalidad ni relación entre entidades.</p></div></div><div class="v019-note">El mapa reutiliza la lógica de lectura regional del ecosistema Radar: seleccionar territorio → ver indicador → revisar hechos y fuentes → profundizar. La ausencia de georreferenciación no se interpreta como cero.</div></article></section>`;
  document.querySelectorAll('[data-territory-select]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-territory-select]').forEach(x=>x.classList.remove('active'));b.classList.add('active');v019RenderTerritoryDetail(b.dataset.territorySelect,core);}));
  document.querySelectorAll('[data-region]').forEach(el=>el.addEventListener('click',()=>{v019RenderTerritoryDetail(el.dataset.region,core);document.querySelectorAll('[data-territory-select]').forEach(x=>x.classList.toggle('active',x.dataset.territorySelect===el.dataset.region));}));
  await v019RenderTerritoryDetail(selected,core);
 }catch(e){v019Content().innerHTML=`<div class="v019-error">${esc(e?.message||String(e))}</div>`;}
}

async function v019RenderTerritoryDetail(region,core){
 const box=document.querySelector('#v019-territory-detail');if(!box)return;box.innerHTML='<div class="v019-loading">Consultando región…</div>';
 try{
  let cached=v019Cache.territory.get(region);
  if(!cached){const [f,p]=await Promise.all([sb.from('aml_findings').select('finding_key,finding_type,entity_id,title,region,commune,score_investigate,source_count,evidence_count,payload').eq('region',region).order('score_investigate',{ascending:false,nullsFirst:false}).limit(8),sb.from('aml_pattern_alerts').select('alert_id,family,pattern_type,scope_type,scope_label,strength,priority,title,summary,payload').eq('scope_type','REGION').eq('scope_label',region).order('strength',{ascending:false}).limit(8)]);if(f.error)throw f.error;if(p.error)throw p.error;cached={findings:f.data||[],patterns:p.data||[]};v019Cache.territory.set(region,cached);}
  const r=core.regions.find(x=>v019RegionNorm(x.region)===region),g=core.gaps.find(x=>v019RegionNorm(x.region)===region),u=core.uafRegions.find(x=>v019RegionNorm(x.region)===region);
  box.innerHTML=`<h3>${esc(v019RegionShort(region))}</h3><div class="v019-facts"><div class="v019-fact"><span>Atención territorial</span><b>${v019Fmt(r?.attention_index,1)}</b></div><div class="v019-fact"><span>Máx. prioridad</span><b>${v019Fmt(r?.max_investigate,1)}</b></div><div class="v019-fact"><span>Brecha IBS</span><b>${g?.gap_attention_index!==null&&g?.gap_attention_index!==undefined?v019Fmt(g.gap_attention_index,1):'—'}</b></div><div class="v019-fact"><span>Observados UAF</span><b>${v019Fmt(u?.uaf_observed)}</b></div></div><div class="v019-note">${cached.patterns[0]?`Patrón regional destacado: <b>${esc(cached.patterns[0].title)}</b>.`:`No hay patrón regional materializado en Pattern Intelligence para este corte.`}</div><div class="v019-stack v019-section-gap">${cached.findings.slice(0,4).map(f=>`<article class="v019-listitem" data-territory-finding="${esc(f.finding_key)}"><span class="stripe"></span><div><h3>${esc(v019Truncate(f.payload?.entity_label||f.title,55))}</h3><p>${esc(v019FindingType(f.finding_type))} · ${v019Fmt(f.source_count)} fuentes</p></div><div class="value"><b>${v019Fmt(f.score_investigate,1)}</b><span>investigar</span></div></article>`).join('')||'<div class="v019-empty">Sin hallazgos regionales en el corte.</div>'}</div>`;
  box.querySelectorAll('[data-territory-finding]').forEach(el=>el.addEventListener('click',()=>{const f=cached.findings.find(x=>x.finding_key===el.dataset.territoryFinding);if(f)v019OpenFinding(f);}));
 }catch(e){box.innerHTML=`<div class="v019-error">${esc(e?.message||String(e))}</div>`;}
}

async function v019LoadQuestions(){
 state.view='questions';shell('Preguntas','La interfaz responde desde preguntas analíticas; cada respuesta declara cobertura, cálculo y límites de los datos disponibles.');
 try{const core=await v019LoadCore();const q=[['priority','¿Qué entidades tienen mayor prioridad investigativa y por qué?','Disponible','Convergencia'],['change','¿Qué cambió recientemente?','Disponible parcial','Temporalidad'],['emerging','¿Dónde están emergiendo fenómenos nuevos?','Disponible','Territorio + Prensa'],['multisource','¿Qué entidades tienen señales procedentes de 3 o más fuentes independientes?','Disponible','Convergencia'],['uaf-cross','¿Cómo se mueven los sujetos observados UAF en el resto de los radares?','Disponible','Supervisión UAF'],['gap','¿Dónde existe mayor brecha potencial UAF?','Disponible','Supervisión UAF'],['sanctions','¿Qué sanciones o recurrencias merecen revisión primero?','Disponible','Sanciones'],['territory','¿Qué regiones concentran mayor prioridad analítica?','Disponible','Territorio'],['osfl','¿Qué OSFL aparecen en convergencia con otros radares?','Disponible','OSFL'],['budget','¿Qué proveedores muestran gasto inusual y antecedentes en otros radares?','Pendiente de Fusion','Presupuesto Abierto'],['cgr','¿Qué proveedores/organismos combinan hallazgos CGR con otras señales?','Pendiente de Fusion','CGR'],['delictual','¿Qué cambios económicos coinciden con presión delictual comunal?','Pendiente de Fusion','Delictual']];v019Content().innerHTML=`<section class="v019-grid"><article class="v019-card v019-full"><div class="v019-card-head"><div><h2>Matriz de preguntas</h2><p>Familias recuperadas del trabajo del viernes; se marca explícitamente lo todavía no materializado.</p></div><span class="hint">clic para responder</span></div><div class="v019-questions">${q.map(x=>`<button type="button" class="v019-question ${x[2].startsWith('Pendiente')?'pending':''}" data-question="${x[0]}"><b>${esc(x[1])}</b><span>${esc(x[3])} · ${esc(x[2])}</span></button>`).join('')}</div></article><article class="v019-card v019-full" id="v019-question-answer"><div class="v019-empty">Selecciona una pregunta para construir la respuesta.</div></article></section>`;document.querySelectorAll('[data-question]').forEach(b=>b.addEventListener('click',()=>v019AnswerQuestion(b.dataset.question,core,true)));}catch(e){v019Content().innerHTML=`<div class="v019-error">${esc(e?.message||String(e))}</div>`;}
}

async function v019AnswerQuestion(id,core,inPage=false){
 let html='';
 if(id==='priority'){const rows=core.findings.filter(f=>f.entity_id).slice(0,8);html=`<div class="v019-answer"><div class="q">Respuesta</div><h2>Entidades con mayor prioridad investigativa</h2><p>Ordenadas por IPA INVESTIGAR; el score se abre para ver fórmula y factores.</p></div>${v019FindingTable(rows)}`;}
 else if(id==='multisource'){const {data,error}=await sb.from('aml_findings').select('finding_key,finding_type,entity_id,title,region,commune,score_investigate,source_count,evidence_count,payload').gte('source_count',3).not('entity_id','is',null).order('score_investigate',{ascending:false,nullsFirst:false}).limit(15);if(error)throw error;html=`<div class="v019-answer"><div class="q">Respuesta</div><h2>Convergencia de 3+ fuentes</h2><p>${v019Fmt(data?.length||0)} primeros hallazgos por prioridad dentro del corte mostrado.</p></div>${v019FindingTable(data||[])}`;}
 else if(id==='gap'){html=`<div class="v019-answer"><div class="q">Respuesta</div><h2>Brecha potencial UAF por región</h2><p>Se usa IBS para ordenar screening; los conteos son pares RUT–actividad candidatos, no personas jurídicas no inscritas.</p></div>${v019GapBars(core.gaps,16)}`;}
 else if(id==='uaf-cross'){html=`<div class="v019-answer"><div class="q">Respuesta</div><h2>Universo UAF observado en otros radares</h2><p>Intersecciones canónicas hoy materializadas.</p></div>${v019UafCrossBars(core)}`;}
 else if(id==='emerging'){html=`<div class="v019-answer"><div class="q">Respuesta</div><h2>Fenómenos nuevos o en movimiento</h2><p>Pattern Intelligence aporta cambios estructurados; Radar Prensa agrega momentum periodístico sin modificar riesgo.</p></div>${v019PatternList(core.patterns.filter(p=>['TERRITORIO','REPORTABILIDAD','INTELIGENCIA'].includes(p.family)),8)}<div class="v019-section-gap">${v019PressCards(core.press)}</div>`;}
 else if(id==='change'){html=`<div class="v019-answer"><div class="q">Cobertura parcial</div><h2>Qué cambió recientemente</h2><p>Prensa dispone de ventana reciente 7d/baseline 28d; otras familias conservan principalmente snapshot o series específicas. No se fabrica una serie común cuando no existe fecha gobernada comparable.</p></div>${v019PressCards(core.press)}<div class="v019-section-gap">${v019PatternList(core.patterns.filter(p=>String(p.pattern_type).includes('ACELERACION')||String(p.pattern_type).includes('CAIDA')),6)}</div>`;}
 else if(id==='sanctions'){const {data,error,count}=await sb.from('aml_sanctions').select('sanction_id,event_date,regulator,entity_name,entity_id,laft_direct,amount_uf,subject',{count:'exact'}).order('event_date',{ascending:false,nullsFirst:false}).limit(15);if(error)throw error;const recurrent=core.patterns.filter(p=>p.pattern_type==='RECURRENCIA_SANCIONATORIA').slice(0,6);html=`<div class="v019-answer"><div class="q">Respuesta</div><h2>Sanciones y recurrencia</h2><p>${v019Fmt(count||0)} eventos sancionatorios materializados. La recurrencia prioriza repetición observable, no culpabilidad.</p></div>${v019PatternList(recurrent,6)}<div class="v019-tablewrap v019-section-gap"><table class="v019-table"><thead><tr><th>Fecha</th><th>Entidad</th><th>Regulador</th><th>LA/FT directo</th></tr></thead><tbody>${(data||[]).map(x=>`<tr><td>${esc(x.event_date||'—')}</td><td><b>${esc(v019Truncate(x.entity_name,48))}</b></td><td>${esc(x.regulator||'—')}</td><td>${x.laft_direct?'Sí':'No'}</td></tr>`).join('')}</tbody></table></div>`;}
 else if(id==='territory'){html=`<div class="v019-answer"><div class="q">Respuesta</div><h2>Regiones con mayor atención analítica</h2><p>IAT combina P90 de prioridad, volumen de hallazgos ≥60 y diversidad media de fuentes.</p></div>${v019RegionBars(core.regions,16)}`;}
 else if(id==='osfl'){const {data,error}=await sb.from('aml_findings').select('finding_key,finding_type,entity_id,title,region,commune,score_investigate,source_count,evidence_count,payload').contains('payload',{producer_ids:['RADAR_OSFL']}).order('score_investigate',{ascending:false,nullsFirst:false}).limit(15);if(error)throw error;html=`<div class="v019-answer"><div class="q">Respuesta</div><h2>OSFL con convergencia observable</h2><p>Hallazgos donde Radar OSFL participa junto con otros productores.</p></div>${v019FindingTable(data||[])}`;}
 else if(['budget','cgr','delictual'].includes(id)){const name={budget:'Presupuesto Abierto',cgr:'CGR',delictual:'Delictual'}[id];html=`<div class="v019-answer pending"><div class="q">Cobertura pendiente</div><h2>${esc(name)} todavía no está materializado como productor en los hallazgos actuales de Fusion</h2><p>La pregunta es válida, pero esta versión no la responde con un cero ni con una inferencia. Se requiere incorporar eventos/evidencia del radar correspondiente al modelo canónico y luego construir la vista comparativa.</p></div><div class="v019-note warn">Estado: pregunta conservada en la matriz; respuesta operacional pendiente de interoperabilidad del productor.</div>`;}
 else return;
 if(inPage){const a=document.querySelector('#v019-question-answer');if(a){a.innerHTML=html;v019BindQuestionResult(a,core);a.scrollIntoView({behavior:'smooth',block:'start'});}}else{v019OpenDrawer(`<h2>Respuesta</h2>${html}`);v019BindQuestionResult(document.querySelector('#v019-drawer-body'),core);}
}

function v019FindingTable(rows){return `<div class="v019-tablewrap"><table class="v019-table"><thead><tr><th>Entidad / hallazgo</th><th>Región</th><th>Fuentes</th><th>IPA investigar</th></tr></thead><tbody>${rows.map(f=>`<tr data-finding-result="${esc(f.finding_key)}"><td><b>${esc(v019Truncate(f.payload?.entity_label||f.title,64))}</b><br>${esc(v019FindingType(f.finding_type))}</td><td>${esc(v019RegionShort(f.region))}</td><td>${v019Fmt(f.source_count)}</td><td><b>${v019Fmt(f.score_investigate,1)}</b></td></tr>`).join('')}</tbody></table></div>`;}
function v019BindQuestionResult(root,core){if(!root)return;root.querySelectorAll('[data-finding-result]').forEach(el=>el.addEventListener('click',async()=>{let f=core.findings.find(x=>x.finding_key===el.dataset.findingResult);if(!f){const {data}=await sb.from('aml_findings').select('finding_key,finding_type,entity_id,title,region,commune,score_explore,score_supervise,score_investigate,source_count,evidence_count,payload').eq('finding_key',el.dataset.findingResult).maybeSingle();f=data;}if(f)v019OpenFinding(f);}));root.querySelectorAll('[data-gap-region]').forEach(el=>el.addEventListener('click',()=>v019OpenGapRegion(el.dataset.gapRegion,core)));root.querySelectorAll('[data-region]').forEach(el=>el.addEventListener('click',()=>v019OpenRegion(el.dataset.region,core)));root.querySelectorAll('[data-pattern]').forEach(el=>el.addEventListener('click',()=>{const p=core.patterns.find(x=>x.alert_id===el.dataset.pattern);if(p)v019OpenPattern(p);}));root.querySelectorAll('[data-press-index]').forEach(el=>el.addEventListener('click',()=>v019OpenPress(v019Num(el.dataset.pressIndex),core.press)));}

async function v019SearchEntity(term){
 try{let q=sb.from('aml_entities').select('entity_id,rut,name,entity_type,region,commune,source_count,is_uaf_observed,is_sanctioned,profile').limit(15);const isRut=/^[0-9kK.\-]+$/.test(term);q=isRut?q.ilike('rut',`%${term.replace(/[%_,]/g,'')}%`):q.ilike('name',`%${term.replace(/[%_,]/g,' ')}%`);const {data,error}=await q;if(error)throw error;v019OpenDrawer(`<div class="ey">Búsqueda</div><h2>${esc(term)}</h2>${data?.length?`<div class="v019-stack">${data.map(e=>`<article class="v019-listitem" data-search-entity="${esc(e.entity_id)}"><span class="stripe"></span><div><h3>${esc(e.name||'Sin nombre')}</h3><p>${esc(e.rut||'—')} · ${esc(v019RegionShort(e.region))}</p><div class="v019-chips"><span class="v019-chip">${v019Fmt(e.source_count)} fuentes</span>${e.is_uaf_observed?'<span class="v019-chip green">UAF observado</span>':''}${e.is_sanctioned?'<span class="v019-chip red">Sanción</span>':''}</div></div><div class="value"><b>→</b></div></article>`).join('')}</div>`:'<div class="v019-empty">Sin coincidencias en el universo autorizado.</div>'}`);document.querySelectorAll('[data-search-entity]').forEach(el=>el.addEventListener('click',()=>{v019CloseDrawer();if(v019LegacyOpenEntity)v019LegacyOpenEntity(el.dataset.searchEntity);}));}catch(e){v019OpenDrawer(`<h2>Error de búsqueda</h2><div class="v019-error">${esc(e?.message||String(e))}</div>`);}
}

// Defensive takeover: the legacy boot starts before this file, but resolves asynchronously.
(function v019EnsureActive(){let tries=0;const timer=setInterval(()=>{tries+=1;try{if(state?.user&&state?.access){clearInterval(timer);if(!document.querySelector('.v019-shell'))v019LoadOverview();}}catch{}if(tries>24)clearInterval(timer);},250);})();
