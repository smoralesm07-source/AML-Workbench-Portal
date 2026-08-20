'use strict';
/* ATLAS AML · Pulso Estratégico. Presentation layer over governed Radar Integrado data. */
(function(){
  let scheduled=false,lastSig='';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
  const fmt=v=>Number(v||0).toLocaleString('es-CL',{maximumFractionDigits:0});
  const pct=v=>Number(v||0).toLocaleString('es-CL',{maximumFractionDigits:1})+'%';
  const HIST=[{y:2021,v:8137},{y:2022,v:8379},{y:2023,v:8729},{y:2024,v:9136},{y:2025,v:9911}];
  function chart(points){
    const w=1120,h=150,pad={l:42,r:40,t:22,b:28};
    const vals=points.map(d=>d.v),min=Math.min(...vals)*.97,max=Math.max(...vals)*1.015,span=Math.max(1,max-min);
    const x=i=>pad.l+i*(w-pad.l-pad.r)/(points.length-1);
    const y=v=>pad.t+(max-v)/span*(h-pad.t-pad.b);
    const p2025=points.findIndex(d=>d.y===2025),pcur=points.length-1;
    const path=points.slice(0,p2025+1).map((d,i)=>`${i?'L':'M'} ${x(i).toFixed(1)} ${y(d.v).toFixed(1)}`).join(' ');
    const curPath=pcur>p2025?`M ${x(p2025).toFixed(1)} ${y(points[p2025].v).toFixed(1)} L ${x(pcur).toFixed(1)} ${y(points[pcur].v).toFixed(1)}`:'';
    const area=`${path} L ${x(p2025).toFixed(1)} ${h-pad.b} L ${x(0).toFixed(1)} ${h-pad.b} Z`;
    const grids=[0,.5,1].map(t=>{const yy=pad.t+t*(h-pad.t-pad.b);return `<line class="grid" x1="${pad.l}" y1="${yy}" x2="${w-pad.r}" y2="${yy}"/>`;}).join('');
    const dots=points.map((d,i)=>{const cls=d.y===2025?'dot-2025':i===pcur&&d.y===2026?'dot-current':'dot';const vcls=d.y===2025?'value value-2025':i===pcur&&d.y===2026?'value value-current':'value';const anchor=i===0?'start':i===points.length-1?'end':'middle';return `<circle class="${cls}" cx="${x(i)}" cy="${y(d.v)}" r="${d.y===2025?5:4}"/><text class="${vcls}" x="${x(i)}" y="${y(d.v)-10}" text-anchor="${anchor}">${fmt(d.v)}</text><text class="axis" x="${x(i)}" y="${h-8}" text-anchor="${anchor}">${d.y===2026?'2026 · actual':d.y}</text>`;}).join('');
    return `<svg class="atlas-pulse-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Evolución de sujetos obligados inscritos 2021 a 2026"><defs><linearGradient id="atlasPulseArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b98e0" stop-opacity=".22"/><stop offset="1" stop-color="#3b98e0" stop-opacity="0"/></linearGradient></defs>${grids}<path class="area" d="${area}"/><path class="line" d="${path}"/>${curPath?`<path class="line-current" d="${curPath}"/>`:''}${dots}</svg>`;
  }
  function render(){
    const hero=document.querySelector('.v036-hero');const ctx=window.__AML_V036_CONTEXT;if(!hero||!ctx)return;
    const k=ctx.uaf?.dashboard?.kpis||{},regLatest=Number(k.registered_total_latest)||Number(ctx.counts?.total)||9911;
    const latestDate=String(k.registered_total_as_of||'último corte operativo');
    const sii=Number(ctx.sii?.kpis?.entities)||0;
    const noSii=Number(ctx.counts?.noSii)||0,totalRecon=Number(ctx.counts?.total)||0,coverage=totalRecon?100*(totalRecon-noSii)/totalRecon:0;
    const growth=100*(9911/8137-1),delta=9911-8137;
    const points=[...HIST];if(regLatest&&regLatest!==9911)points.push({y:2026,v:regLatest});
    const sig=[regLatest,latestDate,sii,noSii,totalRecon].join('|');if(sig===lastSig&&hero.dataset.atlasPulse==='1')return;lastSig=sig;hero.dataset.atlasPulse='1';hero.classList.add('atlas-pulse-hero');
    hero.innerHTML=`<div class="atlas-pulse"><div class="atlas-pulse-top"><div><div class="atlas-pulse-kicker">Supervisión y reportabilidad · Chile</div><h1 class="atlas-pulse-title">Pulso Estratégico</h1></div><div class="atlas-pulse-meta"><span><i></i><b>Corte estadístico</b> 2025</span><span><i></i><b>Actualización operativa</b> ${esc(latestDate)}</span><span><i></i><b>Fuente</b> Radar UAF · Radar SII</span></div></div><div class="atlas-pulse-kpis"><article class="atlas-pulse-kpi sii"><span>Personas jurídicas SII</span><b>${sii?fmt(sii):'—'}</b><small>universo publicado por Radar SII</small></article><article class="atlas-pulse-kpi stat"><span>SO inscritos · corte 2025</span><b>9.911</b><small>padrón estadístico UAF · valor destacado</small></article><article class="atlas-pulse-kpi live"><span>SO inscritos · padrón operativo</span><b>${fmt(regLatest)}</b><small>${esc(latestDate)} · <strong>2026 en curso</strong></small></article><article class="atlas-pulse-kpi growth"><span>Variación 2021 → 2025</span><b>+${pct(growth)}</b><small>+${fmt(delta)} sujetos obligados inscritos</small></article></div><div class="atlas-pulse-chart"><div class="atlas-pulse-chart-head"><div><h3>Evolución de sujetos obligados inscritos</h3><p>Serie histórica 2021–2025 y último padrón operativo disponible de 2026.</p></div><div class="atlas-pulse-chart-legend"><span><i></i>histórico UAF</span><span class="historical"><i></i>9.911 · corte 2025</span><span class="current"><i></i>2026 operativo</span></div></div>${chart(points)}<div class="atlas-pulse-callout"><span><b>9.911</b> se mantiene como referencia estadística 2025.</span><span>${coverage?`Conciliación SII observable: <strong>${pct(coverage)}</strong> del padrón materializado con perfil SII.`:''}</span></div></div></div>`;
  }
  function queue(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;render();});}
  const obs=new MutationObserver(queue);obs.observe(document.documentElement,{subtree:true,childList:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',queue,{once:true});else queue();
  window.addEventListener('hashchange',queue);window.addEventListener('popstate',queue);
})();
