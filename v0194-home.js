'use strict';

/* AML Workbench v0.19.4 · Radar Home
 * Radar becomes the executive entry point to the whole intelligence environment.
 * Territorial attention is intentionally removed from the landing page.
 * A compact UAF environment is always visible, while deep UAF analysis stays in its section.
 */

const V0194='0.19.4';
const v0194BaseShell=shell;
let V0194_HOME_META=null;

shell=function(title,subtitle){
  v0194BaseShell(title,subtitle);
  const version=document.querySelector('.v019-brand small');
  if(version)version.textContent=`Operational Radar · v${V0194}`;
};

async function v0194HomeMeta(force=false){
  if(V0194_HOME_META&&!force)return V0194_HOME_META;
  const [entities,sanctions,findings]=await Promise.all([
    sb.from('aml_entities').select('*',{count:'exact',head:true}),
    sb.from('aml_sanctions').select('*',{count:'exact',head:true}),
    sb.from('aml_findings').select('*',{count:'exact',head:true})
  ]);
  V0194_HOME_META={
    entities:entities.error?null:entities.count,
    sanctions:sanctions.error?null:sanctions.count,
    findings:findings.error?null:findings.count
  };
  return V0194_HOME_META;
}

function v0194Delta(a,b){return v019Num(b)>0?100*(v019Num(a)-v019Num(b))/v019Num(b):null;}
function v0194SignalCount(uaf,key){return uaf.sectors.filter(r=>v0193Flags(r,uaf).some(x=>x.k===key)).length;}
function v0194NonUafFindings(core){return core.findings.filter(f=>!v0193FindingIsUaf(f));}
function v0194NonUafPatterns(core){return core.patterns.filter(p=>p.scope_type!=='SYSTEM'&&!v0193PatternIsUaf(p));}

function v0194Pulse(core,uaf,meta){
  const findings=v0194NonUafFindings(core),top=findings.find(f=>f.entity_id)||findings[0];
  const totals=uaf.report?.totals||{},dash=uaf.dashboard?.kpis||{};
  const rosDelta=v0194Delta(totals.ros_2025,totals.ros_2024);
  const press=core.press?.phenomena?.[0];
  return `<section class="v0194-pulse">
    <button type="button" class="v0194-pulse-card primary" data-home-action="top-finding" data-finding="${esc(top?.finding_key||'')}">
      <span>Prioridad analítica</span><b>${top?v019Fmt(top.score_investigate,1):'—'}</b><small>${esc(v019Truncate(top?.title||'Sin hallazgo priorizado',58))}</small>
    </button>
    <button type="button" class="v0194-pulse-card uaf" data-home-view="uaf">
      <span>SO inscritos · último corte</span><b>${v019Fmt(dash.registered_total_latest)}</b><small>${esc(dash.registered_total_as_of||'corte vigente')} · abrir Inteligencia UAF</small>
    </button>
    <button type="button" class="v0194-pulse-card uaf" data-home-view="uaf">
      <span>ROS recibidos 2025</span><b>${v019Fmt(totals.ros_2025)}</b><small>${rosDelta==null?'—':v0193Pct(rosDelta)} vs 2024 · ${v019Fmt(totals.registered_so_2025)} SO comparables</small>
    </button>
    <button type="button" class="v0194-pulse-card context" data-home-action="press">
      <span>Radar Prensa · contexto</span><b>${press?esc(v019PressStatus(press.status)):'—'}</b><small>${press?esc(v019Truncate(press.phenomenon,55)):'Sin fenómeno disponible'}</small>
    </button>
  </section>`;
}

function v0194Priority(core){
  const rows=v0194NonUafFindings(core).filter(f=>f.entity_id).slice(0,7);
  if(!rows.length)return '<div class="v019-empty">No hay hallazgos individualizables en el corte actual.</div>';
  return `<div class="v0194-priority-list">${rows.map((f,i)=>`<article class="v0194-priority" data-finding="${esc(f.finding_key)}"><span class="v0194-rank">${i+1}</span><div class="v0194-priority-main"><small>${esc(v019FindingType(f.finding_type))}</small><b>${esc(v019Truncate(f.payload?.entity_label||f.title||f.entity_id,82))}</b><span>${esc(v019RegionShort(f.region||'Sin región'))}</span></div><div class="v0194-priority-proof"><b>${v019Fmt(f.score_investigate,1)}</b><span>IPA</span><small>${v019Fmt(f.source_count)} fuentes · ${v019Fmt(f.evidence_count)} evidencias</small></div></article>`).join('')}</div>`;
}

function v0194UafEnvironment(uaf,core){
  const totals=uaf.report?.totals||{},dash=uaf.dashboard?.kpis||{};
  const silence=uaf.sectors.filter(r=>r.silence_5y).sort((a,b)=>v019Num(b.registered_so_2025)-v019Num(a.registered_so_2025));
  const silenceSO=silence.reduce((a,r)=>a+v019Num(r.registered_so_2025),0);
  const low=v0194SignalCount(uaf,'low'),down=v0194SignalCount(uaf,'down');
  const cross3=core.uafRegions.reduce((a,r)=>a+v019Num(r.uaf_three_plus_sources),0);
  const sanctioned=core.uafRegions.reduce((a,r)=>a+v019Num(r.uaf_sanctioned),0);
  return `<div class="v0194-uaf-env">
    <div class="v0194-uaf-head"><div><span>Ambiente UAF</span><h3>Registro, reportabilidad y silencios</h3></div><button type="button" class="v0194-text-action" data-home-view="uaf">Abrir inteligencia UAF →</button></div>
    <div class="v0194-uaf-grid">
      <div><span>SO último corte</span><b>${v019Fmt(dash.registered_total_latest)}</b><small>${esc(dash.registered_total_as_of||'vigente')}</small></div>
      <div><span>Base comparable 2025</span><b>${v019Fmt(totals.registered_so_2025)}</b><small>denominador reportabilidad</small></div>
      <div class="signal"><span>Silencio ROS 5 años</span><b>${v019Fmt(silence.length)}</b><small>sectores · ${v019Fmt(silenceSO)} SO</small></div>
      <div><span>Q1 intensidad ROS</span><b>${v019Fmt(low)}</b><small>sectores comparables</small></div>
    </div>
    <div class="v0194-uaf-signals">
      <div class="v0194-uaf-signal-title"><b>Señales que conviene revisar</b><span>${v019Fmt(down)} sectores con caída ROS ≥30%</span></div>
      ${silence.slice(0,3).map(r=>`<button type="button" data-uaf-sector-home="${esc(r.sector_name)}"><span><b>${esc(v019Truncate(r.sector_name,52))}</b><small>${v019Fmt(r.registered_so_2025)} SO · 0 ROS agregados 2021–2025</small></span><strong>silencio</strong></button>`).join('')||'<div class="v019-empty">Sin silencios persistentes materializados.</div>'}
    </div>
    <div class="v0194-uaf-foot"><span><b>${v019Fmt(cross3)}</b> SO con convergencia 3+ productores</span><span><b>${v019Fmt(sanctioned)}</b> SO con contexto sancionatorio</span></div>
    <div class="v019-note warn"><b>Lectura correcta:</b> silencio sectorial o baja intensidad no equivalen a incumplimiento. ROS depende de la detección de operaciones sospechosas; la sección UAF conserva la metodología y reglas ROE/ROS.</div>
  </div>`;
}

function v0194Entry(meta,uaf){
  const sectors=uaf.sectors.length;
  const cards=[
    ['uaf','UAF','Inteligencia UAF',`${v019Fmt(sectors)} sectores · reportabilidad, silencios, brechas y SO inscritos`],
    ['territory','Territorio','Territorio','16 regiones · concentraciones, fenómenos y contexto económico'],
    ['entities','Entidades','Entidades',`${meta.entities==null?'Universo autorizado':v019Fmt(meta.entities)+' entidades'} · Entity 360 y convergencia directa`],
    ['sanctions','Sanciones','Sanciones',`${meta.sanctions==null?'Eventos materializados':v019Fmt(meta.sanctions)+' eventos'} · recurrencia y trazabilidad`],
    ['questions','Preguntas','Preguntas analíticas','Entrar por hipótesis, fenómeno o necesidad de supervisión']
  ];
  return `<div class="v0194-entry-grid">${cards.map(([view,code,title,desc])=>`<button type="button" class="v0194-entry-card" data-home-view="${view}"><span class="v0194-entry-code">${esc(code)}</span><b>${esc(title)}</b><small>${esc(desc)}</small><strong>Abrir →</strong></button>`).join('')}</div>`;
}

function v0194Context(core){
  const pats=v0194NonUafPatterns(core).slice(0,5);
  const econ=core.economy||{},h=econ.history_entities||{},y24=v019Num(h['2024']),y23=v019Num(h['2023']);
  const econDelta=v0194Delta(y24,y23);
  const press=core.press?.phenomena?.slice(0,2)||[];
  return `<div class="v0194-context-grid">
    <div class="v0194-context-panel"><div class="v0194-mini-head"><span>Fenómenos</span><b>Patrones comparativos</b></div>${pats.length?v019PatternList(pats,5):'<div class="v019-empty">Sin patrones comparativos disponibles.</div>'}</div>
    <div class="v0194-context-panel"><div class="v0194-mini-head"><span>Contexto</span><b>Economía y prensa</b></div>
      <div class="v0194-econ-mini"><div><span>Empresas-año SII 2024</span><b>${econ.error?'—':v019Fmt(econ.company_year_rows_2024)}</b></div><div><span>Variación 2023→2024</span><b>${econ.error||econDelta==null?'—':v0193Pct(econDelta)}</b></div></div>
      <div class="v0194-press-mini">${press.map((p,i)=>`<button type="button" data-press-home="${i}"><span>${esc(v019PressStatus(p.status))}</span><b>${esc(v019Truncate(p.phenomenon,56))}</b><small>${v019Fmt(p.recent_count)} publicaciones · ${v019Fmt(p.recent_source_count)} fuentes · ${Number.isFinite(Number(p.recent_vs_baseline_ratio))?v019Fmt(p.recent_vs_baseline_ratio,2)+'× baseline':'baseline —'}</small></button>`).join('')||'<div class="v019-empty">Radar Prensa no disponible en este corte.</div>'}</div>
      <div class="v0194-context-guard">Economía y prensa son capas contextuales. No incrementan automáticamente un score AML.</div>
    </div>
  </div>`;
}

function v0194BindHome(core,uaf){
  document.querySelectorAll('[data-home-view]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.homeView)));
  document.querySelectorAll('[data-finding]').forEach(b=>b.addEventListener('click',()=>{const f=core.findings.find(x=>x.finding_key===b.dataset.finding);if(f)v019OpenFinding(f);}));
  document.querySelectorAll('[data-pattern]').forEach(b=>b.addEventListener('click',()=>{const p=core.patterns.find(x=>x.alert_id===b.dataset.pattern);if(p)v019OpenPattern(p);}));
  document.querySelectorAll('[data-press-home]').forEach(b=>b.addEventListener('click',()=>v019OpenPress(v019Num(b.dataset.pressHome),core.press)));
  document.querySelector('[data-home-action="press"]')?.addEventListener('click',()=>v019OpenPress(0,core.press));
  document.querySelectorAll('[data-uaf-sector-home]').forEach(b=>b.addEventListener('click',async()=>{await v019LoadUaf();setTimeout(()=>v0193OpenSector(b.dataset.uafSectorHome,uaf),0);}));
}

v019LoadOverview=async function(){
  state.view='overview';
  shell('Radar integrado','Vista ejecutiva del ecosistema AML: señales prioritarias, ambiente UAF, fenómenos y accesos para profundizar.');
  try{
    const [core,uaf,meta]=await Promise.all([v019LoadCore(),v0193LoadUafData(),v0194HomeMeta()]);
    v019Content().innerHTML=`
      <section class="v0194-intro">
        <div><span class="v0194-kicker">INTELLIGENCE ENTRY POINT</span><h2>Qué requiere atención y dónde profundizar</h2><p>La portada resume sólo lo necesario para orientar la siguiente decisión. No reemplaza las vistas especializadas ni convierte señales en conclusiones.</p></div>
        <div class="v0194-system"><span>Universo integrado</span><b>${meta.findings==null?'—':v019Fmt(meta.findings)}</b><small>hallazgos materializados · datos autorizados por RLS</small></div>
      </section>
      ${v0194Pulse(core,uaf,meta)}
      <section class="v0194-main-grid">
        <article class="v019-card v0194-priority-card"><div class="v019-card-head"><div><h2>Qué revisar ahora</h2><p>Hallazgos concretos priorizados por evidencia y convergencia. Sin ranking territorial en la portada.</p></div><span class="hint">clic → explicación</span></div>${v0194Priority(core)}</article>
        <article class="v019-card v0194-uaf-card">${v0194UafEnvironment(uaf,core)}</article>
      </section>
      <section class="v019-card v0194-entry"><div class="v019-card-head"><div><h2>Entrar al análisis</h2><p>Cada módulo responde una pregunta distinta; Radar funciona como índice operativo de toda la información disponible.</p></div><span class="hint">seleccione profundidad</span></div>${v0194Entry(meta,uaf)}</section>
      <section class="v019-card v0194-context-card"><div class="v019-card-head"><div><h2>Fenómenos y contexto</h2><p>Patrones comparativos, evolución económica y señales de prensa para interpretar los hallazgos sin mezclarlos con evidencia individual.</p></div><span class="hint">contexto ≠ conclusión</span></div>${v0194Context(core)}</section>`;
    v0194BindHome(core,uaf);
  }catch(e){v019Content().innerHTML=`<div class="v019-error">${esc(e?.message||String(e))}</div>`;}
};
loadOverview=v019LoadOverview;
