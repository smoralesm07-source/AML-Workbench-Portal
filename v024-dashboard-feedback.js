'use strict';

/* AML Workbench v0.24.0 · dashboard feedback implementation
 * Implements the nine UX changes requested in the 2026-08-17 review document.
 * IPA 3.0 remains unchanged and continues in shadow mode.
 */
const V024='0.24.0';
const V024_CROSS_VIEW='aml_v024_uaf_cross_entity';
const V024_CROSS_SECTOR_VIEW='aml_v024_uaf_cross_sector';
const V024_CROSS_PAGE_SIZE=50;
const V024_LABELS={
  RADAR_SII:'SII',
  RADAR_SANCIONES:'Sanciones',
  RADAR_OSFL:'OSFL',
  RADAR_PRENSA:'Prensa'
};
let V024_CONTEXT={core:null,uaf:null,analytics:null,meta:null,freshness:null};
let V024_CROSS_STATE={radarId:null,page:0,search:'',total:0};

const v024BaseShell=shell;
const v024BaseReconciliation=typeof v0205LoadReconciliation==='function'?v0205LoadReconciliation:null;

function v024ApplyVersion(){
  try{
    if(typeof V0206_VERSION_OBSERVER!=='undefined'&&V0206_VERSION_OBSERVER){
      V0206_VERSION_OBSERVER.disconnect();
      V0206_VERSION_OBSERVER=null;
    }
  }catch{}
  const label=`Operational Radar · v${V024}`;
  const badge=document.querySelector('.v019-brand small');
  if(badge){badge.textContent=label;badge.setAttribute('aria-label',label);}
  document.title=`AML Analytical Workbench · v${V024}`;
  document.documentElement.setAttribute('data-aml-build',V024);
}

shell=function(title,subtitle){v024BaseShell(title,subtitle);v024ApplyVersion();};
if(typeof v0211ApplyVersion==='function')v0211ApplyVersion=v024ApplyVersion;

function v024Safe(result,fallback){return result?.status==='fulfilled'?result.value:fallback;}
function v024Pct(a,b,d=1){
  const x=Number(a),y=Number(b);
  return Number.isFinite(x)&&Number.isFinite(y)&&y>0?`${(100*x/y).toLocaleString('es-CL',{minimumFractionDigits:d,maximumFractionDigits:d})}%`:'—';
}
function v024Delta(a,b){
  const x=Number(a),y=Number(b);return Number.isFinite(x)&&Number.isFinite(y)&&y!==0?100*(x-y)/y:null;
}
function v024StatusDot(cls,label){return `<span class="v024-dot ${esc(cls||'info')}"></span><span>${esc(label)}</span>`;}

/* 2. Compact data-audit semaphore; detail only on demand. */
function v024AuditHtml(f){
  if(!f)return `<section class="v024-audit"><button type="button" class="v024-audit-summary" data-v024-audit-toggle aria-expanded="false"><span>${v024StatusDot('info','Auditoría de datos')}</span><b>Sin sello disponible</b><small>ver detalle</small></button><div class="v024-audit-detail" data-v024-audit-detail hidden><p>No fue posible leer el estado de sincronización en este corte.</p></div></section>`;
  const pending=f.uafStatus?.cls==='pending'||f.siiStatus?.cls==='pending';
  const overall=pending?'pending':'ok';
  const fusion=f.explicitSync?'ok':'info';
  return `<section class="v024-audit ${esc(overall)}">
    <button type="button" class="v024-audit-summary" data-v024-audit-toggle aria-expanded="false">
      <span class="v024-audit-title">${v024StatusDot(overall,'Auditoría de datos')}</span>
      <span class="v024-audit-lights">${v024StatusDot(f.uafStatus?.cls||'info','UAF')}${v024StatusDot(f.siiStatus?.cls||'info','SII')}${v024StatusDot(fusion,'Fusion')}</span>
      <b>${pending?'Revisar sincronización':'Sincronizado'}</b><small>clic para detalle</small>
    </button>
    <div class="v024-audit-detail" data-v024-audit-detail hidden>
      <div><span>UAF</span><b>Corte ${esc(v0207CutDate(f.uafCut))}</b><small>Radar ${esc(v0207Date(f.uafRadarGenerated,true))} · ${esc(f.uafStatus?.label||'—')}</small></div>
      <div><span>SII</span><b>Descarga ${esc(v0207Date(f.siiRetrieved,true))}</b><small>Historia hasta ${esc(String(f.siiLatestYear||'—'))} · ${esc(f.siiStatus?.label||'—')}</small></div>
      <div><span>Fusion</span><b>${esc(v0207Date(f.fusionMaterialized,true))}</b><small>${f.explicitSync?`Run ${esc(String(f.fusionRunId||'—'))}`:'Sello explícito pendiente'}</small></div>
    </div>
  </section>`;
}

/* 4. Cross-radar rows are actual drill-down controls. */
function v024CrossRow(id,count,total){
  const src=v0202Source(id),label=V024_LABELS[id]||src.label||id;
  return `<button type="button" class="v024-cross-row" data-v024-cross="${esc(id)}" aria-label="Abrir ${esc(label)}: ${v019Fmt(count)} sujetos obligados">
    <span class="v024-cross-label">${v0202SourceBadges([id])}<b>${esc(label)}</b></span>
    <progress class="${esc(src.cls||'')}" max="${Math.max(1,v019Num(total))}" value="${v019Num(count)}"></progress>
    <strong>${v019Fmt(count)}</strong><small>${v024Pct(count,total)}</small><em>ver SO →</em>
  </button>`;
}

/* 9. ROS points expose industry detail. */
function v024RosChart(rows){
  if(!rows.length)return '<div class="v019-empty">Serie ROS no disponible.</div>';
  const W=520,H=190,pL=42,pR=18,pT=22,pB=34,max=Math.max(...rows.map(r=>v019Num(r.ros)),1),n=Math.max(1,rows.length-1);
  const pts=rows.map((r,i)=>{const x=pL+(W-pL-pR)*(i/n),y=pT+(H-pT-pB)*(1-v019Num(r.ros)/max);return {...r,x,y};});
  return `<div class="v024-ros-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="ROS recibidos por año; cada punto abre detalle por sector UAF">
    <line class="axis" x1="${pL}" y1="${H-pB}" x2="${W-pR}" y2="${H-pB}"></line>
    <line class="grid" x1="${pL}" y1="${pT}" x2="${W-pR}" y2="${pT}"></line>
    <text class="ymax" x="${pL-5}" y="${pT+4}" text-anchor="end">${v020Compact(max)}</text>
    <polyline class="series" points="${pts.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}"></polyline>
    ${pts.map(p=>`<g class="v024-ros-point" data-v024-ros-year="${esc(String(p.year))}" role="button" tabindex="0" aria-label="${esc(String(p.year))}: ${v019Fmt(p.ros)} ROS. Abrir detalle por industria"><circle class="point-hit" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="13"></circle><circle class="point" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.5"></circle><text class="value" x="${p.x.toFixed(1)}" y="${Math.max(12,p.y-10).toFixed(1)}" text-anchor="middle">${v020Compact(p.ros)}</text><text class="xlabel" x="${p.x.toFixed(1)}" y="${H-11}" text-anchor="middle">${esc(String(p.year))}</text></g>`).join('')}
  </svg><div class="v024-chart-hint">Selecciona un punto para ver ROS por sector UAF.</div></div>`;
}

function v024UafMonitor(core,uaf){
  const totals=uaf?.report?.totals||{},dash=uaf?.dashboard?.kpis||{};
  const total=v019Num(dash.registered_total_latest)||v019Array(core?.uafRegions).reduce((a,r)=>a+v019Num(r.uaf_observed),0);
  const cross=new Map(v019Array(core?.uafCross).map(r=>[String(r.radar_id),v019Num(r.uaf_entities)]));
  const cross3=v019Array(core?.uafRegions).reduce((a,r)=>a+v019Num(r.uaf_three_plus_sources),0);
  const sanctioned=v019Array(core?.uafRegions).reduce((a,r)=>a+v019Num(r.uaf_sanctioned),0);
  const silence=v019Array(uaf?.sectors).filter(r=>r.silence_5y).sort((a,b)=>v019Num(b.registered_so_2025)-v019Num(a.registered_so_2025));
  const low=v019Array(uaf?.sectors).filter(r=>v0193Flags(r,uaf).some(x=>x.k==='low')).length;
  const down=v019Array(uaf?.sectors).filter(r=>v0193Flags(r,uaf).some(x=>x.k==='down')).length;
  const ros=[2021,2022,2023,2024,2025].map(year=>({year,ros:v019Num(totals[`ros_${year}`])}));
  const rosDelta=v024Delta(totals.ros_2025,totals.ros_2024);
  const radars=['RADAR_SII','RADAR_SANCIONES','RADAR_OSFL','RADAR_PRENSA'];
  return `<div class="v024-uaf-monitor">
    <div class="v024-card-title"><div><span>INTELIGENCIA UAF</span><h2>Sujetos obligados y reportabilidad</h2><p>Presencia cruzada y evolución ROS con navegación directa al detalle.</p></div><button type="button" class="v0203-link" data-home-view="uaf">Abrir módulo UAF →</button></div>
    <div class="v024-uaf-kpis"><div><span>SO inscritos</span><b>${v019Fmt(total)}</b><small>${esc(dash.registered_total_as_of||'último corte')}</small></div><div><span>Con 3+ fuentes</span><b>${v019Fmt(cross3)}</b><small>convergencia observable</small></div><div><span>Con sanciones</span><b>${v019Fmt(sanctioned)}</b><small>contexto administrativo</small></div></div>
    <div class="v024-uaf-grid">
      <section><div class="v024-subhead"><b>SO UAF en otros radares</b><span>clic → entidades</span></div><div class="v024-cross-list">${radars.map(id=>v024CrossRow(id,cross.get(id)||0,total)).join('')}</div></section>
      <section><div class="v024-subhead"><b>ROS recibidos</b><span>${rosDelta==null?'—':v0193Pct(rosDelta)} · 2025 vs 2024</span></div>${v024RosChart(ros)}</section>
    </div>
    <div class="v024-uaf-signals"><button type="button" data-home-view="uaf"><span>Silencio ROS 5 años</span><b>${v019Fmt(silence.length)}</b><small>sectores</small></button><button type="button" data-home-view="uaf"><span>Q1 intensidad ROS</span><b>${v019Fmt(low)}</b><small>sectores comparables</small></button><button type="button" data-home-view="uaf"><span>Caída ROS ≥30%</span><b>${v019Fmt(down)}</b><small>2025 vs 2024</small></button>${silence[0]?`<button type="button" data-v024-uaf-sector="${esc(silence[0].sector_name)}"><span>Mayor silencio</span><b>${esc(v019Truncate(silence[0].sector_name,26))}</b><small>${v019Fmt(silence[0].registered_so_2025)} SO</small></button>`:''}</div>
  </div>`;
}

/* 6. Sanction chart becomes a drill-down by year. */
function v024SanctionChart(rows){
  if(!rows.length)return '<div class="v019-empty">Serie de sanciones no disponible.</div>';
  const W=620,H=220,pL=38,pR=16,pT=22,pB=40,max=Math.max(...rows.map(r=>v019Num(r.sanction_count)),1),slot=(W-pL-pR)/rows.length,bw=Math.min(48,slot*.58);
  return `<div class="v024-sanction-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Sanciones por año; cada barra abre el detalle de eventos">
    <line class="axis" x1="${pL}" y1="${H-pB}" x2="${W-pR}" y2="${H-pB}"></line>
    ${rows.map((r,i)=>{const x=pL+slot*i+(slot-bw)/2,h=(H-pT-pB)*v020Num(r.sanction_count)/max,y=H-pB-h,dh=(H-pT-pB)*v020Num(r.laft_direct_count)/max,dy=H-pB-dh;return `<g class="v024-sanction-year" data-v024-sanction-year="${esc(String(r.year))}" role="button" tabindex="0" aria-label="${esc(String(r.year))}: ${v019Fmt(r.sanction_count)} eventos; abrir detalle"><rect class="hit" x="${(x-7).toFixed(1)}" y="${pT}" width="${(bw+14).toFixed(1)}" height="${(H-pT-pB).toFixed(1)}" rx="8"></rect><rect class="bar" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="5"></rect><rect class="bar-direct" x="${(x+bw*.28).toFixed(1)}" y="${dy.toFixed(1)}" width="${(bw*.44).toFixed(1)}" height="${dh.toFixed(1)}" rx="3"></rect><text class="value" x="${(x+bw/2).toFixed(1)}" y="${Math.max(14,y-7).toFixed(1)}" text-anchor="middle">${v019Fmt(r.sanction_count)}</text><text class="xlabel" x="${(x+bw/2).toFixed(1)}" y="${H-14}" text-anchor="middle">${esc(String(r.year))}${Number(r.year)===2026?'*':''}</text></g>`;}).join('')}
  </svg><div class="v020-legend"><span><i class="all"></i>Eventos</span><span><i class="direct"></i>Flag LA/FT materializado</span><span>* 2026 parcial</span><strong>Selecciona un año →</strong></div></div>`;
}

/* 8. Economy + press becomes a strategic, interactive context block. */
function v024EconomyPress(core){
  const econ=core?.economy||{},history=econ.history_entities||{};
  const y24=v019Num(history['2024']),y23=v019Num(history['2023']),delta=v024Delta(y24,y23);
  const press=v019Array(core?.press?.phenomena).slice(0,4);
  const recent=press.reduce((a,p)=>a+v019Num(p.recent_count),0);
  const maxRatio=Math.max(0,...press.map(p=>Number(p.recent_vs_baseline_ratio)).filter(Number.isFinite));
  return `<div class="v024-context">
    <div class="v024-context-head"><div><span>CONTEXTO · APORTE 0 AL IPA</span><h2>Economía y prensa</h2><p>Cambios de entorno útiles para interpretar señales y decidir dónde profundizar.</p></div><button type="button" class="v0203-link" data-home-view="territory">Abrir contexto territorial →</button></div>
    <div class="v024-context-kpis">
      <button type="button" data-home-view="territory"><span>Empresas-año SII 2024</span><b>${econ.error?'—':v019Fmt(econ.company_year_rows_2024||y24)}</b><small>explorar distribución territorial →</small></button>
      <button type="button" data-home-view="territory"><span>Variación 2023→2024</span><b>${econ.error||delta==null?'—':v0193Pct(delta)}</b><small>ver contexto económico →</small></button>
      <div><span>Publicaciones recientes</span><b>${v019Fmt(recent)}</b><small>${v019Fmt(press.length)} fenómenos visibles</small></div>
      <div><span>Mayor momentum</span><b>${maxRatio?v019Fmt(maxRatio,1)+'×':'—'}</b><small>vs baseline de prensa</small></div>
    </div>
    <div class="v024-press-list"><div class="v024-subhead"><b>Qué está ganando intensidad en prensa</b><span>clic → evidencia</span></div>${press.length?press.map((p,i)=>`<button type="button" data-v024-press="${i}"><span class="v024-press-state">${esc(v019PressStatus(p.status))}</span><span class="v024-press-copy"><b>${esc(v019Truncate(p.phenomenon,72))}</b><small>${v019Fmt(p.recent_count)} publicaciones · ${v019Fmt(p.recent_source_count)} fuentes${Number.isFinite(Number(p.recent_vs_baseline_ratio))?` · ${v019Fmt(p.recent_vs_baseline_ratio,2)}× baseline`:''}</small></span><strong>abrir →</strong></button>`).join(''):'<div class="v019-empty">Radar Prensa no disponible en este corte.</div>'}</div>
  </div>`;
}

function v024Priority(core){
  const rows=v0194NonUafFindings(core).filter(f=>f.entity_id).slice(0,5);
  return rows.length?v0202FindingList(rows,5):'<div class="v019-empty">Sin alertas individualizables en este corte.</div>';
}

function v024Unavailable(){
  return typeof v0222Unavailable==='function'?v0222Unavailable():[];
}

/* 1,5,7. No general KPI strip, no finding-composition card, no Entry/Fenómenos blocks. */
v019LoadOverview=async function(){
  state.view='overview';
  shell('Radar integrado','Vista operativa: qué revisar, qué SO cruzan otros radares y qué contexto cambió.');
  const settled=await Promise.allSettled([
    v019LoadCore(),
    v0193LoadUafData(),
    v0194HomeMeta(),
    v020LoadAnalytics(),
    typeof v0207LoadFreshness==='function'?v0207LoadFreshness():Promise.resolve(null)
  ]);
  const core=v024Safe(settled[0],{findings:[],patterns:[],uafRegions:[],uafCross:[],press:{phenomena:[]},economy:{error:'unavailable'}});
  const uaf=v024Safe(settled[1],{report:{totals:{}},dashboard:{kpis:{}},sectors:[],rules:[]});
  const meta=v024Safe(settled[2],{entities:null,sanctions:null,findings:null});
  const analytics=v024Safe(settled[3],{sanYears:[],budget:{error:'unavailable'},mix:[],bands:[],families:[],producers:[]});
  const freshness=v024Safe(settled[4],null);
  V024_CONTEXT={core,uaf,analytics,meta,freshness};
  const missing=v024Unavailable();
  v019Content().innerHTML=`
    ${missing.length?`<div class="v024-source-warning"><b>Carga parcial</b><span>${esc(missing.join(' · '))}</span></div>`:''}
    ${v024AuditHtml(freshness)}
    <section class="v024-main-grid">
      <article class="v019-card v024-priority"><div class="v019-card-head"><div><h2>Qué revisar primero</h2><p>Alertas concretas ordenadas para iniciar revisión.</p></div><span class="hint">clic → detalle</span></div>${v024Priority(core)}</article>
      <article class="v019-card v024-uaf-card">${v024UafMonitor(core,uaf)}</article>
    </section>
    <section class="v024-analysis-grid">
      <article class="v019-card v024-sanctions"><div class="v019-card-head"><div><h2>Sanciones en el tiempo</h2><p>Selecciona un año para ver entidades, reguladores y eventos.</p></div><span class="hint">interactivo</span></div>${v024SanctionChart(v019Array(analytics.sanYears))}</article>
      <article class="v019-card v024-context-card">${v024EconomyPress(core)}</article>
    </section>
    <section class="v019-card v024-budget"><div class="v019-card-head"><div><h2>Gasto público</h2><p>Preview de Presupuesto Abierto mientras completa su adaptación canónica Fusion.</p></div><span class="hint">preview</span></div>${v020Budget(analytics)}</section>`;
  v024BindOverview(core,uaf,analytics);
  v024ApplyVersion();
};
loadOverview=v019LoadOverview;

function v024BindOverview(core,uaf,analytics){
  if(typeof v020Bind==='function')v020Bind(core,uaf,analytics);
  const audit=document.querySelector('[data-v024-audit-toggle]');
  audit?.addEventListener('click',()=>{
    const detail=document.querySelector('[data-v024-audit-detail]');if(!detail)return;
    const expanded=audit.getAttribute('aria-expanded')==='true';audit.setAttribute('aria-expanded',String(!expanded));detail.hidden=expanded;
  });
  document.querySelectorAll('[data-v024-cross]').forEach(b=>b.addEventListener('click',()=>void v024OpenCrossRadar(b.dataset.v024Cross)));
  document.querySelectorAll('[data-v024-ros-year]').forEach(g=>{
    const open=()=>v024OpenRosYear(Number(g.dataset.v024RosYear),uaf);
    g.addEventListener('click',open);g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});
  });
  document.querySelectorAll('[data-v024-sanction-year]').forEach(g=>{
    const open=()=>void v024OpenSanctionYear(Number(g.dataset.v024SanctionYear));
    g.addEventListener('click',open);g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});
  });
  document.querySelectorAll('[data-v024-press]').forEach(b=>b.addEventListener('click',()=>v019OpenPress(v019Num(b.dataset.v024Press),core.press)));
  document.querySelectorAll('[data-v024-uaf-sector]').forEach(b=>b.addEventListener('click',()=>v0193OpenSector(b.dataset.v024UafSector,uaf)));
}

function v024CrossSectorHtml(rows){
  if(!rows.length)return '<div class="v019-empty">Sin clasificación sectorial materializada.</div>';
  const max=Math.max(...rows.map(r=>v019Num(r.entity_count)),1);
  return `<div class="v024-sector-bars">${rows.map(r=>`<div><span>${esc(v019Truncate(r.sector_name,48))}</span><progress max="${max}" value="${v019Num(r.entity_count)}"></progress><b>${v019Fmt(r.entity_count)}</b></div>`).join('')}</div>`;
}

async function v024FetchCrossRows(){
  const s=V024_CROSS_STATE,from=s.page*V024_CROSS_PAGE_SIZE,to=from+V024_CROSS_PAGE_SIZE-1;
  let q=sb.from(V024_CROSS_VIEW).select('entity_id,rut,entity_name,region,commune,uaf_sector_label,source_count',{count:'exact'}).eq('radar_id',s.radarId);
  const term=String(s.search||'').trim().replace(/,/g,' ');
  if(term)q=q.or(`entity_name.ilike.%${term}%,rut.ilike.%${term}%,uaf_sector_label.ilike.%${term}%`);
  const {data,count,error}=await q.order('entity_name',{ascending:true,nullsFirst:false}).order('rut',{ascending:true}).range(from,to);
  if(error)throw error;s.total=count||0;return data||[];
}
function v024CrossRowsHtml(rows){
  const s=V024_CROSS_STATE,pages=Math.max(1,Math.ceil(s.total/V024_CROSS_PAGE_SIZE));
  return `<div class="v024-cross-results-head"><span>${v019Fmt(s.total)} SO · página ${s.page+1}/${pages}</span><div><button type="button" data-v024-cross-page="prev" ${s.page<=0?'disabled':''}>←</button><button type="button" data-v024-cross-page="next" ${s.page>=pages-1?'disabled':''}>→</button></div></div>
    <div class="v024-cross-entities">${rows.length?rows.map(r=>`<button type="button" data-v024-cross-entity="${esc(r.entity_id)}"><span><b>${esc(r.entity_name||`RUT ${r.rut||'—'}`)}</b><small>${esc(r.rut||'—')} · ${esc(r.uaf_sector_label||'Sector UAF no materializado')}</small></span><span><b>${esc(r.region||'Sin región')}</b><small>${esc(r.commune||'—')} · ${v019Fmt(r.source_count)} fuentes</small></span><strong>360 →</strong></button>`).join(''):'<div class="v019-empty">Sin resultados para el filtro.</div>'}</div>`;
}
async function v024RefreshCrossRows(){
  const host=document.querySelector('[data-v024-cross-results]');if(!host)return;host.innerHTML='<div class="v019-loading">Consultando SO autorizados…</div>';
  try{host.innerHTML=v024CrossRowsHtml(await v024FetchCrossRows());}catch(e){host.innerHTML=`<div class="v019-error">${esc(e?.message||String(e))}</div>`;}
}
async function v024OpenCrossRadar(radarId){
  const label=V024_LABELS[radarId]||radarId;V024_CROSS_STATE={radarId,page:0,search:'',total:0};
  const {data:sectors,error}=await sb.from(V024_CROSS_SECTOR_VIEW).select('sector_name,entity_count').eq('radar_id',radarId).order('entity_count',{ascending:false}).limit(12);
  v019OpenDrawer(`<div class="v024-drawer"><div class="ey">SO UAF · cruce ${esc(label)}</div><h2>Sujetos obligados también presentes en ${esc(label)}</h2><p class="lead">Detalle navegable por entidad y distribución según categoría UAF.</p><section class="v024-drawer-section"><div class="v024-subhead"><b>Principales sectores UAF</b><span>entidades del cruce</span></div>${error?'<div class="v019-empty">Distribución sectorial no disponible.</div>':v024CrossSectorHtml(sectors||[])}</section><section class="v024-drawer-section"><div class="v024-cross-search"><input type="search" data-v024-cross-search placeholder="Buscar nombre, RUT o sector UAF"><button type="button" data-v024-cross-search-btn>Buscar</button></div><div data-v024-cross-results></div></section></div>`);
  await v024RefreshCrossRows();
}

function v024RosSectorRows(year,uaf){
  return v019Array(uaf?.sectors).map(r=>({
    sector:r.sector_name,
    ros:v019Num(r[`ros_${year}`]),
    so2025:v019Num(r.registered_so_2025),
    intensity2025:year===2025?v019Num(r.ros_per_100_so_2025):null
  })).sort((a,b)=>b.ros-a.ros||String(a.sector).localeCompare(String(b.sector),'es'));
}
function v024OpenRosYear(year,uaf){
  const rows=v024RosSectorRows(year,uaf),total=rows.reduce((a,r)=>a+r.ros,0),active=rows.filter(r=>r.ros>0).length;
  v019OpenDrawer(`<div class="v024-drawer"><div class="ey">UAF · ROS ${esc(String(year))}</div><h2>Detalle por industria</h2><p class="lead">Distribución sectorial de los ROS materializados para el año seleccionado.</p><div class="v024-drawer-kpis"><div><span>ROS</span><b>${v019Fmt(total)}</b></div><div><span>Sectores con ROS</span><b>${v019Fmt(active)}</b></div><div><span>Sin ROS</span><b>${v019Fmt(rows.length-active)}</b></div></div><div class="v024-ros-sector-list">${rows.map(r=>`<button type="button" data-v024-sector-name="${esc(r.sector)}"><span><b>${esc(r.sector)}</b><small>${v019Fmt(r.so2025)} SO en base 2025${r.intensity2025!=null?` · ${v019Fmt(r.intensity2025,1)} ROS/100 SO`:''}</small></span><strong>${v019Fmt(r.ros)}</strong><em>${v024Pct(r.ros,total)}</em></button>`).join('')}</div></div>`);
}

async function v024OpenSanctionYear(year){
  const start=`${year}-01-01`,end=`${year}-12-31`;
  const {data,error}=await sb.from('aml_sanctions').select('sanction_id,event_date,regulator,entity_name,entity_id,laft_direct,amount_uf,subject').gte('event_date',start).lte('event_date',end).order('event_date',{ascending:false}).limit(500);
  if(error){v019OpenDrawer(`<div class="v019-error">${esc(error.message||String(error))}</div>`);return;}
  const rows=data||[],reg=new Map();for(const r of rows)reg.set(r.regulator||'Sin regulador',(reg.get(r.regulator||'Sin regulador')||0)+1);
  const regulators=[...reg.entries()].sort((a,b)=>b[1]-a[1]);
  const direct=rows.filter(r=>r.laft_direct).length;
  v019OpenDrawer(`<div class="v024-drawer"><div class="ey">Sanciones · ${esc(String(year))}</div><h2>${v019Fmt(rows.length)} eventos materializados</h2><p class="lead">Selecciona una entidad para abrir Entity 360 o continúa al módulo sancionatorio.</p><div class="v024-drawer-kpis"><div><span>Eventos</span><b>${v019Fmt(rows.length)}</b></div><div><span>Reguladores</span><b>${v019Fmt(regulators.length)}</b></div><div><span>Flag LA/FT</span><b>${v019Fmt(direct)}</b></div></div><div class="v024-regulators">${regulators.slice(0,8).map(([name,count])=>`<span><b>${esc(name)}</b>${v019Fmt(count)}</span>`).join('')}</div><div class="v024-drawer-actions"><button type="button" data-v024-open-sanctions>Abrir módulo Sanciones →</button></div><div class="v024-sanction-events">${rows.map(r=>`<article><div><span>${esc(r.event_date||'—')}</span><b>${esc(r.entity_name||'Entidad no resuelta')}</b><small>${esc(r.regulator||'—')} · ${esc(v019Truncate(r.subject||'Sin materia',96))}</small></div><div>${r.laft_direct?'<em>LA/FT</em>':''}${r.amount_uf!=null?`<span>${v019Fmt(r.amount_uf,1)} UF</span>`:''}${r.entity_id?`<button type="button" data-v024-sanction-entity="${esc(r.entity_id)}">360 →</button>`:''}</div></article>`).join('')}</div></div>`);
}

/* 3. Remove verbose methodological comments from the operational reconciliation surface. */
function v024RemoveVerboseNotes(){document.querySelectorAll('.v0209-method-inline,.v0205-method-note').forEach(el=>el.remove());}
if(v024BaseReconciliation){
  v0205LoadReconciliation=async function(...args){await v024BaseReconciliation(...args);v024RemoveVerboseNotes();v024ApplyVersion();};
}

if(!window.__V024_EVENTS){
  window.__V024_EVENTS=true;
  document.addEventListener('click',e=>{
    const entity=e.target.closest('[data-v024-cross-entity],[data-v024-sanction-entity]');
    if(entity){e.preventDefault();const id=entity.dataset.v024CrossEntity||entity.dataset.v024SanctionEntity;if(id)openEntity(id);return;}
    const page=e.target.closest('[data-v024-cross-page]');
    if(page){e.preventDefault();V024_CROSS_STATE.page=Math.max(0,V024_CROSS_STATE.page+(page.dataset.v024CrossPage==='next'?1:-1));void v024RefreshCrossRows();return;}
    const search=e.target.closest('[data-v024-cross-search-btn]');
    if(search){const input=document.querySelector('[data-v024-cross-search]');V024_CROSS_STATE.search=input?.value||'';V024_CROSS_STATE.page=0;void v024RefreshCrossRows();return;}
    const sector=e.target.closest('[data-v024-sector-name]');
    if(sector){e.preventDefault();const name=sector.dataset.v024SectorName;if(name&&V024_CONTEXT.uaf)v0193OpenSector(name,V024_CONTEXT.uaf);return;}
    const openSan=e.target.closest('[data-v024-open-sanctions]');if(openSan){e.preventDefault();navigate('sanctions');return;}
  });
  document.addEventListener('keydown',e=>{
    if(e.key==='Enter'&&e.target.matches('[data-v024-cross-search]')){e.preventDefault();V024_CROSS_STATE.search=e.target.value||'';V024_CROSS_STATE.page=0;void v024RefreshCrossRows();}
  });
}

window.__AML_ACTIVE_VERSION__=V024;
window.__AML_BUILD__=V024;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(v024ApplyVersion,0),{once:true});
else setTimeout(v024ApplyVersion,0);
