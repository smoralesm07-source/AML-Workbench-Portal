'use strict';
/* ATLAS AML · Pulso Estratégico. Presentation layer over governed Radar Integrado data. */
(function(){
  let scheduled=false,lastSig='',screeningMeta=null,screeningLoading=false,missingOpen=false;
  const SII_SCREENING_META_URL='https://raw.githubusercontent.com/smoralesm07-source/Radar_SII/main/docs/data/uaf_sii_empirical_summary.json';
  const MISSING_CANONICAL_2025=[
    'Administradoras de Fondos Mutuos',
    'Armas: Personas que se Dediquen a la Fabricación de Armas',
    'Clubes de Caza',
    'Clubes de Pesca',
    'Fintec: Custodia de Instrumentos Financieros',
    'Fintec: Plataformas de Financiamiento Colectivo',
    'Fintec: Sistemas Alternativos de Transacción',
    'Fintec: Iniciación de Pagos'
  ];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=v=>Number(v||0).toLocaleString('es-CL',{maximumFractionDigits:0});
  const pct=v=>Number(v||0).toLocaleString('es-CL',{maximumFractionDigits:1})+'%';
  const HIST=[{y:2021,v:8137},{y:2022,v:8379},{y:2023,v:8729},{y:2024,v:9136},{y:2025,v:9911}];

  async function loadScreeningMeta(){
    if(screeningLoading||screeningMeta)return;
    screeningLoading=true;
    try{
      const r=await fetch(SII_SCREENING_META_URL,{cache:'no-store'});
      if(r.ok)screeningMeta=await r.json();
    }catch(e){console.warn('[ATLAS pulse] screening metadata unavailable',e);}
    finally{screeningLoading=false;queue();}
  }

  function currentCandidateUniverse(ctx){
    const regions=(Array.isArray(ctx?.core?.gaps)?ctx.core.gaps:[]).filter(r=>String(r?.region||'').trim()&&String(r.region)!=='Sin región');
    const regionTotal=regions.reduce((a,r)=>a+(Number(r?.candidate_pairs)||0),0);
    if(regionTotal>0)return regionTotal;
    const sectors=Array.isArray(ctx?.core?.gapSectors)?ctx.core.gapSectors:[];
    return sectors.reduce((a,r)=>a+(Number(r?.candidate_pairs)||0),0);
  }

  function screeningDate(){
    const raw=screeningMeta?.sources?.sii?.published_update;
    if(!raw)return 'último corte SII disponible';
    const m=String(raw).match(/^(\d{4})-(\d{2})$/);
    return m?`${m[2]}/${m[1]}`:String(raw);
  }

  function chart(points){
    const w=1120,h=122,pad={l:42,r:40,t:18,b:24};
    const vals=points.map(d=>d.v),min=Math.min(...vals)*.97,max=Math.max(...vals)*1.015,span=Math.max(1,max-min);
    const x=i=>pad.l+i*(w-pad.l-pad.r)/(points.length-1);
    const y=v=>pad.t+(max-v)/span*(h-pad.t-pad.b);
    const p2025=points.findIndex(d=>d.y===2025),pcur=points.length-1;
    const path=points.slice(0,p2025+1).map((d,i)=>`${i?'L':'M'} ${x(i).toFixed(1)} ${y(d.v).toFixed(1)}`).join(' ');
    const curPath=pcur>p2025?`M ${x(p2025).toFixed(1)} ${y(points[p2025].v).toFixed(1)} L ${x(pcur).toFixed(1)} ${y(points[pcur].v).toFixed(1)}`:'';
    const area=`${path} L ${x(p2025).toFixed(1)} ${h-pad.b} L ${x(0).toFixed(1)} ${h-pad.b} Z`;
    const grids=[0,.5,1].map(t=>{const yy=pad.t+t*(h-pad.t-pad.b);return `<line class="grid" x1="${pad.l}" y1="${yy}" x2="${w-pad.r}" y2="${yy}"/>`;}).join('');
    const dots=points.map((d,i)=>{
      const cls=d.y===2025?'dot-2025':i===pcur&&d.y===2026?'dot-current':'dot';
      const vcls=d.y===2025?'value value-2025':i===pcur&&d.y===2026?'value value-current':'value';
      const anchor=i===0?'start':i===points.length-1?'end':'middle';
      return `<circle class="${cls}" cx="${x(i)}" cy="${y(d.v)}" r="${d.y===2025?4.5:3.5}"/><text class="${vcls}" x="${x(i)}" y="${y(d.v)-8}" text-anchor="${anchor}">${fmt(d.v)}</text><text class="axis" x="${x(i)}" y="${h-6}" text-anchor="${anchor}">${d.y===2026?'2026 · actual':d.y}</text>`;
    }).join('');
    return `<svg class="atlas-pulse-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Evolución de sujetos obligados inscritos 2021 a 2026"><defs><linearGradient id="atlasPulseArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b98e0" stop-opacity=".20"/><stop offset="1" stop-color="#3b98e0" stop-opacity="0"/></linearGradient></defs>${grids}<path class="area" d="${area}"/><path class="line" d="${path}"/>${curPath?`<path class="line-current" d="${curPath}"/>`:''}${dots}</svg>`;
  }

  function missingPanel(){
    return `<div class="atlas-pulse-missing-panel" data-pulse-missing-panel ${missingOpen?'':'hidden'}><div class="atlas-pulse-missing-head"><div><span>Cobertura sectorial · corte 2025</span><b>8 sectores canónicos sin representación observada</b></div><button type="button" data-pulse-missing-close aria-label="Cerrar">×</button></div><ol>${MISSING_CANONICAL_2025.map(x=>`<li>${esc(x)}</li>`).join('')}</ol><p>La ausencia de representación significa que el corte estadístico 2025 no materializa sujetos obligados inscritos para esa categoría. No implica que la actividad esté fuera de la Ley 19.913 ni constituye por sí sola incumplimiento o riesgo.</p></div>`;
  }

  function render(){
    const hero=document.querySelector('.v036-hero'),ctx=window.__AML_V036_CONTEXT;
    if(!hero||!ctx)return;
    loadScreeningMeta();
    document.querySelectorAll('.atlas-sector-representation').forEach(n=>n.remove());
    const k=ctx.uaf?.dashboard?.kpis||{},regLatest=Number(k.registered_total_latest)||Number(ctx.counts?.total)||9911;
    const latestDate=String(k.registered_total_as_of||'último corte operativo');
    const noSii=Number(ctx.counts?.noSii)||0,totalRecon=Number(ctx.counts?.total)||0,coverage=totalRecon?100*(totalRecon-noSii)/totalRecon:0;
    const potential=currentCandidateUniverse(ctx),potentialCut=screeningDate();
    const growth=100*(9911/8137-1),delta=9911-8137;
    const points=[...HIST];if(regLatest&&regLatest!==9911)points.push({y:2026,v:regLatest});
    const sig=[regLatest,latestDate,potential,potentialCut,noSii,totalRecon,missingOpen].join('|');
    if(sig===lastSig&&hero.dataset.atlasPulse==='1')return;
    lastSig=sig;hero.dataset.atlasPulse='1';hero.classList.add('atlas-pulse-hero');
    hero.innerHTML=`<div class="atlas-pulse"><div class="atlas-pulse-top"><div><div class="atlas-pulse-kicker">Supervisión y reportabilidad · Chile</div><h1 class="atlas-pulse-title">Pulso Estratégico</h1></div><div class="atlas-pulse-meta"><span><i></i><b>Corte estadístico</b> 2025</span><span><i></i><b>Actualización UAF</b> ${esc(latestDate)}</span><span><i></i><b>Screening SII</b> ${esc(potentialCut)}</span><span><i></i><b>Fuente</b> Radar UAF · Radar SII</span></div></div><div class="atlas-pulse-kpis"><article class="atlas-pulse-kpi sii"><span>Potenciales SO vigentes · screening</span><b>${potential?fmt(potential):'—'}</b><small>pares candidatos sobre nómina vigente de personas jurídicas SII · <strong>${esc(potentialCut)}</strong></small></article><article class="atlas-pulse-kpi stat"><span>SO inscritos · corte 2025</span><b>9.911</b><small>padrón estadístico UAF · valor de referencia</small></article><article class="atlas-pulse-kpi live"><span>SO inscritos · padrón operativo</span><b>${fmt(regLatest)}</b><small>${esc(latestDate)} · <strong>2026 en curso</strong></small></article><article class="atlas-pulse-kpi growth"><span>Variación 2021 → 2025</span><b>+${pct(growth)}</b><small>+${fmt(delta)} sujetos obligados inscritos</small></article><button type="button" class="atlas-pulse-kpi missing" data-pulse-missing aria-expanded="${missingOpen?'true':'false'}"><span>Sectores sin representación</span><b>8</b><small>categorías canónicas ausentes del corte 2025 · <strong>ver sectores</strong></small></button></div>${missingPanel()}<div class="atlas-pulse-chart"><div class="atlas-pulse-chart-head"><div><h3>Evolución de sujetos obligados inscritos</h3><p>Serie histórica 2021–2025 y último padrón operativo disponible de 2026.</p></div><div class="atlas-pulse-chart-legend"><span><i></i>histórico UAF</span><span class="historical"><i></i>9.911 · corte 2025</span><span class="current"><i></i>2026 operativo</span></div></div>${chart(points)}<div class="atlas-pulse-callout"><span><b>9.911</b> permanece como referencia estadística 2025.</span><span>${potential?`Potenciales SO: <strong>screening</strong>, no condición jurídica confirmada.`:''}${coverage?` · Conciliación SII observable ${pct(coverage)}.`:''}</span></div></div></div>`;
  }

  document.addEventListener('click',e=>{
    const open=e.target?.closest?.('[data-pulse-missing]');
    const close=e.target?.closest?.('[data-pulse-missing-close]');
    if(!open&&!close)return;
    missingOpen=open?!missingOpen:false;
    lastSig='';
    render();
  });

  function queue(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;render();});}
  const obs=new MutationObserver(queue);obs.observe(document.documentElement,{subtree:true,childList:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',queue,{once:true});else queue();
  window.addEventListener('hashchange',queue);window.addEventListener('popstate',queue);
})();
