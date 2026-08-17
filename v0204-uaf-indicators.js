'use strict';

/* AML Workbench v0.20.4 · UAF monitor drill-down
 * Makes the three landing UAF indicators self-explanatory and clickable.
 * Origin remains UAF (violet); cards explain the analytical condition in plain language.
 */

const V0204='0.20.4';
const v0204BaseShell=shell;

shell=function(title,subtitle){
  v0204BaseShell(title,subtitle);
  const version=document.querySelector('.v019-brand small');
  if(version)version.textContent=`Operational Radar · v${V0204}`;
};

function v0204Rows(kind,uaf){
  const sectors=v019Array(uaf?.sectors);
  if(kind==='silence')return sectors.filter(r=>r.silence_5y).sort((a,b)=>v019Num(b.registered_so_2025)-v019Num(a.registered_so_2025));
  if(kind==='low')return sectors.filter(r=>v0193Flags(r,uaf).some(x=>x.k==='low')).sort((a,b)=>v019Num(a.ros_per_100_so_2025)-v019Num(b.ros_per_100_so_2025));
  if(kind==='down')return sectors.filter(r=>v0193Flags(r,uaf).some(x=>x.k==='down')).sort((a,b)=>Number(a.delta_ros_2025_vs_2024_pct)-Number(b.delta_ros_2025_vs_2024_pct));
  return [];
}

function v0204SoTotal(rows){return rows.reduce((a,r)=>a+v019Num(r.registered_so_2025),0);}
function v0204RosTotal(rows,year){return rows.reduce((a,r)=>a+v019Num(r[`ros_${year}`]),0);}

function v0204Meta(kind,rows,uaf){
  const so=v0204SoTotal(rows),n=rows.length;
  if(kind==='silence')return {
    title:'Sectores sin ROS en 5 años',
    value:n,
    secondary:`${v019Fmt(so)} SO inscritos en esos sectores`,
    meaning:'Tienen sujetos obligados inscritos, pero registran 0 ROS agregados en cada año entre 2021 y 2025.',
    drawerTitle:'Sectores con 0 ROS agregados durante 2021–2025',
    guard:'Es una señal agregada de revisión. No significa que cada SO del sector haya incumplido: el ROS se envía cuando se detecta una operación sospechosa.',
    tone:'silence'
  };
  if(kind==='low')return {
    title:'Sectores con ROS bajos frente a sus pares',
    value:n,
    secondary:`${v019Fmt(so)} SO inscritos en esos sectores`,
    meaning:`Su intensidad de ROS por cada 100 SO está en el 25% inferior entre sectores comparables con al menos 10 SO.`,
    drawerTitle:'Sectores en el 25% inferior de intensidad ROS',
    guard:`La comparación es relativa entre sectores comparables. El umbral Q1 actual es ${v019Fmt(uaf?.q1,2)} ROS por cada 100 SO y no constituye un mínimo normativo.`,
    tone:'low'
  };
  const worst=rows.length?Number(rows[0].delta_ros_2025_vs_2024_pct):null;
  return {
    title:'Sectores con caída fuerte de ROS',
    value:n,
    secondary:`${v019Fmt(so)} SO inscritos en esos sectores`,
    meaning:`En 2025 recibieron al menos 30% menos ROS que en 2024${Number.isFinite(worst)?`; la mayor caída fue ${v0193Pct(worst)}`:''}.`,
    drawerTitle:'Sectores con caída de ROS de 30% o más',
    guard:'Una caída interanual merece contexto: puede reflejar cambios operativos, de detección o del universo reportante. No se interpreta automáticamente como deterioro de cumplimiento.',
    tone:'down'
  };
}

function v0204Indicator(kind,uaf){
  const rows=v0204Rows(kind,uaf),m=v0204Meta(kind,rows,uaf);
  return `<button type="button" class="v0204-uaf-indicator ${esc(m.tone)}" data-v0204-uaf-indicator="${esc(kind)}">
    <div class="v0204-indicator-top"><span class="v0204-uaf-dot"></span><span>UAF · MONITOREO SECTORIAL</span><strong>Ver sectores →</strong></div>
    <div class="v0204-indicator-main"><b>${v019Fmt(m.value)}</b><div><h3>${esc(m.title)}</h3><span>${esc(m.secondary)}</span></div></div>
    <p>${esc(m.meaning)}</p>
  </button>`;
}

function v0204SectorRow(row,kind){
  const delta=Number(row.delta_ros_2025_vs_2024_pct),flags=v0193Flags(row,{...window.V0193_UAF_CACHE,q1:window.V0193_UAF_CACHE?.q1});
  let main='';
  if(kind==='silence')main='0 ROS acumulados en 2021–2025';
  else if(kind==='low')main=`${v019Fmt(row.ros_per_100_so_2025,2)} ROS por cada 100 SO`;
  else main=`${Number.isFinite(delta)?v0193Pct(delta):'—'} vs 2024`;
  return `<button type="button" class="v0204-sector-row" data-v0204-uaf-sector="${esc(row.sector_name)}">
    <div class="v0204-sector-head"><div>${v0202SourceBadges(['RADAR_UAF'])}<span class="v0202-type-badge">${kind==='silence'?'Sin ROS 5 años':kind==='low'?'Intensidad baja':'Caída interanual'}</span></div><strong>Abrir sector →</strong></div>
    <h3>${esc(row.sector_name)}</h3>
    <p>${esc(main)}</p>
    <div class="v0204-sector-metrics">
      <span><b>${v019Fmt(row.registered_so_2025)}</b> SO 2025</span>
      <span><b>${v019Fmt(row.ros_2024)}</b> ROS 2024</span>
      <span><b>${v019Fmt(row.ros_2025)}</b> ROS 2025</span>
      <span><b>${v019Fmt(row.ros_per_100_so_2025,2)}</b> ROS/100 SO</span>
      <span><b>${Number.isFinite(delta)?v0193Pct(delta):'—'}</b> variación</span>
    </div>
    ${typeof v0193Spark==='function'?v0193Spark(row):''}
  </button>`;
}

async function v0204OpenIndicator(kind){
  const uaf=await v0193LoadUafData(),rows=v0204Rows(kind,uaf),m=v0204Meta(kind,rows,uaf);
  const so=v0204SoTotal(rows),ros24=v0204RosTotal(rows,2024),ros25=v0204RosTotal(rows,2025);
  v019OpenDrawer(`<div class="v0204-drawer">
    <div class="v0204-drawer-head">${v0202SourceBadges(['RADAR_UAF'])}<span class="v0202-type-badge">Monitoreo sectorial</span></div>
    <h2>${esc(m.drawerTitle)}</h2>
    <p class="v0204-lead">${esc(m.meaning)}</p>
    <div class="v0204-drawer-kpis">
      <div><span>Sectores</span><b>${v019Fmt(rows.length)}</b></div>
      <div><span>SO inscritos 2025</span><b>${v019Fmt(so)}</b></div>
      <div><span>ROS 2024 → 2025</span><b>${v019Fmt(ros24)} → ${v019Fmt(ros25)}</b></div>
    </div>
    <div class="v0204-explain"><b>Cómo leerlo</b><p>${esc(m.guard)}</p></div>
    <div class="v0204-sector-list">${rows.map(r=>v0204SectorRow(r,kind)).join('')||'<div class="v019-empty">No hay sectores que cumplan esta condición en el corte actual.</div>'}</div>
  </div>`);
}

/* Replace only the bottom indicator row of the v0.20.3 UAF monitor; keep the rest of the monitor intact. */
const v0204BaseUafMonitor=v0203UafMonitor;
v0203UafMonitor=function(core,uaf){
  const html=v0204BaseUafMonitor(core,uaf);
  const start=html.indexOf('<div class="v0203-uaf-alerts">');
  const endMarker='<div class="v0203-guard">';
  const end=html.indexOf(endMarker,start);
  if(start<0||end<0)return html;
  const replacement=`<div class="v0204-uaf-indicators">${v0204Indicator('silence',uaf)}${v0204Indicator('low',uaf)}${v0204Indicator('down',uaf)}</div>`;
  return html.slice(0,start)+replacement+html.slice(end);
};

if(!window.__V0204_UAF_EVENTS){
  window.__V0204_UAF_EVENTS=true;
  document.addEventListener('click',async e=>{
    const indicator=e.target.closest('[data-v0204-uaf-indicator]');
    if(indicator){e.preventDefault();await v0204OpenIndicator(indicator.dataset.v0204UafIndicator);return;}
    const sector=e.target.closest('[data-v0204-uaf-sector]');
    if(sector){
      e.preventDefault();
      const uaf=await v0193LoadUafData();
      v019CloseDrawer();
      await v019LoadUaf();
      setTimeout(()=>v0193OpenSector(sector.dataset.v0204UafSector,uaf),0);
    }
  });
}
