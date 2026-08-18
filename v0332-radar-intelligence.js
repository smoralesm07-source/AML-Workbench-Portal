'use strict';

/* AML Workbench v0.33.2 · Radar Integrado intelligence + chart legibility pass. */
const V0332='0.33.2';
const V0332_BUILD='0332';
const v0332BaseShell=shell;
const v0332BaseOverview=v019LoadOverview;

function v0332ApplyVersion(){
  window.__AML_ACTIVE_VERSION__=V0332;
  window.__AML_BUILD__=V0332_BUILD;
  const label=`Operational Radar · v${V0332}`;
  const badge=document.querySelector('.v019-brand small');
  if(badge){
    badge.textContent=label;
    badge.setAttribute('aria-label',label);
    badge.setAttribute('data-runtime-label',label);
    badge.dataset.activeVersion=V0332;
  }
  document.title=`AML Analytical Workbench · v${V0332}`;
  document.documentElement.setAttribute('data-aml-version',V0332);
  document.documentElement.setAttribute('data-aml-build',V0332_BUILD);
}

shell=function(...args){v0332BaseShell(...args);v0332ApplyVersion();};
if(typeof v0211ApplyVersion==='function')v0211ApplyVersion=v0332ApplyVersion;
window.__AML_RUNTIME_VERSION_APPLIER__=v0332ApplyVersion;

/* Compact priority surface: three highest-priority entity-linked findings. */
v024Priority=function(core){
  const rows=v0194NonUafFindings(core).filter(f=>f.entity_id).slice(0,3);
  return rows.length?v0202FindingList(rows,3):'<div class="v019-empty">Sin alertas individualizables en este corte.</div>';
};

/* Safer ROS framing: labels live in dedicated plot margins, never over marks. */
v024RosChart=function(rows){
  if(!rows.length)return '<div class="v019-empty">Serie ROS no disponible.</div>';
  const W=560,H=210,pL=48,pR=22,pT=38,pB=40,max=Math.max(...rows.map(r=>v019Num(r.ros)),1),n=Math.max(1,rows.length-1);
  const plotH=H-pT-pB;
  const pts=rows.map((r,i)=>{const x=pL+(W-pL-pR)*(i/n),y=pT+plotH*(1-v019Num(r.ros)/max);return {...r,x,y};});
  return `<div class="v024-ros-chart v0332-chart-safe"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="ROS recibidos por año; cada punto abre detalle por sector UAF">
    <line class="axis" x1="${pL}" y1="${H-pB}" x2="${W-pR}" y2="${H-pB}"></line>
    <line class="grid" x1="${pL}" y1="${pT}" x2="${W-pR}" y2="${pT}"></line>
    <text class="ymax" x="${pL-7}" y="${pT+4}" text-anchor="end">${v020Compact(max)}</text>
    <polyline class="series" points="${pts.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}"></polyline>
    ${pts.map(p=>`<g class="v024-ros-point" data-v024-ros-year="${esc(String(p.year))}" role="button" tabindex="0" aria-label="${esc(String(p.year))}: ${v019Fmt(p.ros)} ROS. Abrir detalle por industria"><circle class="point-hit" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="14"></circle><circle class="point" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.5"></circle><text class="value v0332-mark-label" x="${p.x.toFixed(1)}" y="${Math.max(17,p.y-13).toFixed(1)}" text-anchor="middle">${v020Compact(p.ros)}</text><text class="xlabel" x="${p.x.toFixed(1)}" y="${H-13}" text-anchor="middle">${esc(String(p.year))}</text></g>`).join('')}
  </svg><div class="v024-chart-hint">Selecciona un punto para ver ROS por sector UAF.</div></div>`;
};

/* UAF KPI becomes a real drill-down into the existing UAF↔Sanciones cross view. */
v024UafMonitor=function(core,uaf){
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
    <div class="v024-uaf-kpis"><div><span>SO inscritos</span><b>${v019Fmt(total)}</b><small>${esc(dash.registered_total_as_of||'último corte')}</small></div><div><span>Con 3+ fuentes</span><b>${v019Fmt(cross3)}</b><small>convergencia observable</small></div><button type="button" class="v0332-uaf-kpi-action" data-v0332-uaf-sanctioned aria-label="Ver ${v019Fmt(sanctioned)} sujetos obligados con sanciones"><span>Con sanciones</span><b>${v019Fmt(sanctioned)}</b><small>ver quiénes son →</small></button></div>
    <div class="v024-uaf-grid">
      <section><div class="v024-subhead"><b>SO UAF en otros radares</b><span>clic → entidades</span></div><div class="v024-cross-list">${radars.map(id=>v024CrossRow(id,cross.get(id)||0,total)).join('')}</div></section>
      <section><div class="v024-subhead"><b>ROS recibidos</b><span>${rosDelta==null?'—':v0193Pct(rosDelta)} · 2025 vs 2024</span></div>${v024RosChart(ros)}</section>
    </div>
    <div class="v024-uaf-signals"><button type="button" data-home-view="uaf"><span>Silencio ROS 5 años</span><b>${v019Fmt(silence.length)}</b><small>sectores</small></button><button type="button" data-home-view="uaf"><span>Q1 intensidad ROS</span><b>${v019Fmt(low)}</b><small>sectores comparables</small></button><button type="button" data-home-view="uaf"><span>Caída ROS ≥30%</span><b>${v019Fmt(down)}</b><small>2025 vs 2024</small></button>${silence[0]?`<button type="button" data-v024-uaf-sector="${esc(silence[0].sector_name)}"><span>Mayor silencio</span><b>${esc(v019Truncate(silence[0].sector_name,26))}</b><small>${v019Fmt(silence[0].registered_so_2025)} SO</small></button>`:''}</div>
  </div>`;
};

function v0332DeltaLabel(value){
  if(value==null||!Number.isFinite(value))return 'sin base comparable';
  const sign=value>0?'+':'';
  return `${sign}${value.toLocaleString('es-CL',{maximumFractionDigits:1})}% vs año previo`;
}

/* Sanctions: trend + concentration cues before the chart. */
v024SanctionChart=function(rows){
  const data=v019Array(rows).filter(r=>Number.isFinite(Number(r.year))).sort((a,b)=>Number(a.year)-Number(b.year));
  if(!data.length)return '<div class="v019-empty">Serie de sanciones no disponible.</div>';
  const completed=data.filter(r=>Number(r.year)<2026);
  const latestCompleted=completed[completed.length-1]||data[data.length-1];
  const priorCompleted=completed[completed.length-2]||null;
  const latestCount=v019Num(latestCompleted?.sanction_count);
  const priorCount=v019Num(priorCompleted?.sanction_count);
  const delta=priorCompleted&&priorCount>0?100*(latestCount-priorCount)/priorCount:null;
  const peak=data.reduce((best,r)=>v019Num(r.sanction_count)>v019Num(best?.sanction_count)?r:best,data[0]);
  const total=data.reduce((a,r)=>a+v019Num(r.sanction_count),0);
  const direct=data.reduce((a,r)=>a+v019Num(r.laft_direct_count),0);
  const directShare=total>0?100*direct/total:0;
  const W=650,H=238,pL=44,pR=18,pT=42,pB=46,max=Math.max(...data.map(r=>v019Num(r.sanction_count)),1),slot=(W-pL-pR)/data.length,bw=Math.min(46,slot*.54),plotH=H-pT-pB;
  return `<div class="v0332-sanction-intel">
    <div class="v0332-mini-kpis"><div><span>Último año completo</span><b>${esc(String(latestCompleted?.year||'—'))}</b><small>${v019Fmt(latestCount)} eventos · ${esc(v0332DeltaLabel(delta))}</small></div><div><span>Máximo de la serie</span><b>${esc(String(peak?.year||'—'))}</b><small>${v019Fmt(peak?.sanction_count)} eventos</small></div><div><span>Flag LA/FT</span><b>${v019Fmt(directShare,1)}%</b><small>${v019Fmt(direct)} de ${v019Fmt(total)} eventos</small></div></div>
    <div class="v0332-insight-line"><b>Lectura:</b> ${delta==null?'la serie no tiene una base anual comparable suficiente.':delta>15?'el último año completo muestra un aumento material frente al año previo.':delta<-15?'el último año completo muestra una caída material frente al año previo.':'el último año completo se mantiene relativamente estable frente al año previo.'} El máximo observado corresponde a ${esc(String(peak?.year||'—'))}.</div>
    <div class="v024-sanction-chart v0332-chart-safe"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Sanciones por año; cada barra abre el detalle de eventos">
      <line class="axis" x1="${pL}" y1="${H-pB}" x2="${W-pR}" y2="${H-pB}"></line>
      ${data.map((r,i)=>{const x=pL+slot*i+(slot-bw)/2,h=plotH*v019Num(r.sanction_count)/max,y=H-pB-h,dh=plotH*v019Num(r.laft_direct_count)/max,dy=H-pB-dh,labelY=Math.max(18,y-11);return `<g class="v024-sanction-year" data-v024-sanction-year="${esc(String(r.year))}" role="button" tabindex="0" aria-label="${esc(String(r.year))}: ${v019Fmt(r.sanction_count)} eventos; abrir detalle"><rect class="hit" x="${(x-7).toFixed(1)}" y="${pT}" width="${(bw+14).toFixed(1)}" height="${plotH.toFixed(1)}" rx="8"></rect><rect class="bar" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="5"></rect><rect class="bar-direct" x="${(x+bw*.29).toFixed(1)}" y="${dy.toFixed(1)}" width="${(bw*.42).toFixed(1)}" height="${dh.toFixed(1)}" rx="3"></rect><text class="value v0332-mark-label" x="${(x+bw/2).toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="middle">${v019Fmt(r.sanction_count)}</text><text class="xlabel" x="${(x+bw/2).toFixed(1)}" y="${H-16}" text-anchor="middle">${esc(String(r.year))}${Number(r.year)===2026?'*':''}</text></g>`;}).join('')}
    </svg><div class="v020-legend"><span><i class="all"></i>Eventos</span><span><i class="direct"></i>Flag LA/FT materializado</span><span>* 2026 parcial</span><strong>Selecciona un año →</strong></div></div>
  </div>`;
};

/* Spending: expose scale, priority mix and strongest observable signal immediately. */
v020Budget=function(a){
  const b=a?.budget;
  if(!b||b.error)return '<div class="v019-empty">Preview de Presupuesto Abierto no disponible.</div>';
  const tiers=['P1','P2','P3'].map(k=>({k,v:v020Num(b.priority_tiers?.[k])}));
  const max=Math.max(...tiers.map(x=>x.v),1);
  const signals=v020Num(b.metrics?.signals),p1=v020Num(b.metrics?.priority_p1),p1Share=signals>0?100*p1/signals:0;
  const links=v020Num(b.metrics?.cgr_candidate_links),transactions=v020Num(b.metrics?.transactions);
  const top=v019Array(b.top_signals).slice(0,3),leader=top[0];
  return `<div class="v020-budget v0332-budget-intel">
    <div class="v0332-mini-kpis v0332-budget-kpis"><div><span>Señales</span><b>${v019Fmt(signals)}</b><small>sobre ${v020Compact(transactions)} transacciones</small></div><div><span>Prioridad P1</span><b>${v019Fmt(p1Share,1)}%</b><small>${v019Fmt(p1)} señales</small></div><div><span>Enlaces CGR</span><b>${v019Fmt(links)}</b><small>candidatos a contraste</small></div></div>
    ${leader?`<button type="button" class="v0332-budget-lead" data-v020-budget="0"><span><small>SEÑAL CON MAYOR PRIORIDAD</small><b>${esc(v019Truncate(leader.provider_or_recipient_name||leader.organization_name||leader.signal_type,70))}</b><em>${esc(v019Truncate(leader.signal_type||'Señal',58))}${leader.organization_name?` · ${esc(v019Truncate(leader.organization_name,52))}`:''}</em></span><strong>${v019Fmt(leader.investigation_priority_score)}</strong></button>`:''}
    <div class="v020-budget-tiers v0332-budget-tiers">${tiers.map(x=>`<div><span>${x.k}</span><div class="v020-bar-track"><i class="v020-budget-fill ${v019Width(x.v,max)}"></i></div><b>${v019Fmt(x.v)}</b></div>`).join('')}</div>
    <div class="v0332-insight-line"><b>Lectura:</b> ${p1Share>=30?'una proporción relevante de las señales visibles está en P1; conviene priorizar revisión por entidad/organismo.':p1Share>0?'las P1 son una fracción acotada del universo visible, lo que permite una revisión focalizada.':'no hay P1 materializadas en este corte.'}${links>0?` Además existen ${v019Fmt(links)} enlaces candidatos con CGR para contraste documental.`:''}</div>
    <div class="v020-budget-list">${top.slice(1).map((s,i)=>`<button type="button" data-v020-budget="${i+1}"><span><b>${esc(v019Truncate(s.provider_or_recipient_name||s.organization_name||s.signal_type,58))}</b><small>${esc(s.signal_type||'Señal')} · ${esc(s.organization_name||'')}</small></span><strong>${v019Fmt(s.investigation_priority_score)}</strong></button>`).join('')}</div>
    <div class="v019-note warn">El score de Presupuesto es prioridad investigativa propia del radar. Hasta completar su adaptador, estas señales <b>no son hallazgos Fusion</b>.</div>
  </div>`;
};

if(!window.__V0332_EVENTS){
  window.__V0332_EVENTS=true;
  document.addEventListener('click',e=>{
    const sanctioned=e.target.closest('[data-v0332-uaf-sanctioned]');
    if(sanctioned){e.preventDefault();void v024OpenCrossRadar('RADAR_SANCIONES');}
  });
}

v019LoadOverview=async function(...args){
  await v0332BaseOverview(...args);
  v0332ApplyVersion();
};
loadOverview=v019LoadOverview;

v0332ApplyVersion();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',v0332ApplyVersion,{once:true});
