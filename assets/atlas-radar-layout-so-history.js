/* ATLAS AML · Radar Integrado refinement · compact sanctions + SO history */
(() => {
  'use strict';

  const SO_YEARS=[2021,2022,2023,2024,2025];
  const SO_VALUES=[8137,8379,8729,9136,9911];
  let raf=0;

  const fmt=(v,d=0)=>Number(v).toLocaleString('es-CL',{minimumFractionDigits:d,maximumFractionDigits:d});
  const pct=(v,d=1)=>`${v>=0?'+':''}${fmt(v,d)}%`;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function findDeck(title){
    return [...document.querySelectorAll('.v036-real .v036-deck')].find(deck=>deck.querySelector('.v036-deck-head h2')?.textContent.trim().startsWith(title));
  }

  function parseSanctions(card){
    return [...card.querySelectorAll('.v036-chart rect[data-v036-tip]')].map(rect=>{
      const p=String(rect.dataset.v036Tip||'').split('|');
      const num=s=>Number(String(s||'').replace(/[^0-9-]/g,''))||0;
      return {year:num(p[0]),total:num(p[1]),direct:num(p[2])};
    }).filter(r=>r.year&&r.total).sort((a,b)=>a.year-b.year);
  }

  function refineSanctions(root){
    const cards=[...root.querySelectorAll('.v036-card')];
    const sanctions=cards.find(card=>card.querySelector('h3')?.textContent.includes('Eventos sancionatorios materializados'));
    const radarStatus=cards.find(card=>card.querySelector('h3')?.textContent.trim()==='Estado de los radares');
    if(radarStatus) radarStatus.remove();
    if(!sanctions) return;

    sanctions.classList.add('atlas-sanctions-wide');
    const parent=sanctions.parentElement;
    if(parent?.classList.contains('v036-grid2')) parent.classList.add('atlas-sanctions-single');
    if(sanctions.querySelector('.atlas-sanctions-body')) return;

    const chart=sanctions.querySelector('.v036-chart');
    const legend=sanctions.querySelector('.v036-chart-legend');
    if(!chart) return;
    const data=parseSanctions(sanctions);
    if(!data.length) return;

    const total=data.reduce((a,r)=>a+r.total,0);
    const direct=data.reduce((a,r)=>a+r.direct,0);
    const peak=data.reduce((a,r)=>r.total>a.total?r:a,data[0]);
    const y24=data.find(r=>r.year===2024),y25=data.find(r=>r.year===2025),y26=data.find(r=>r.year===2026);
    const yoy=y24?.total?100*(y25.total/y24.total-1):null;
    const directShare=total?100*direct/total:0;

    const body=document.createElement('div');
    body.className='atlas-sanctions-body';
    const main=document.createElement('div');
    main.className='atlas-sanctions-main';
    chart.before(body);
    main.append(chart);
    if(legend) main.append(legend);
    body.append(main);

    const aside=document.createElement('aside');
    aside.className='atlas-sanctions-read';
    aside.innerHTML=`<header><span>Lectura rápida</span><b>serie materializada</b></header><div class="atlas-sanctions-kpis">
      <div class="atlas-sanctions-kpi"><span>Año peak</span><b>${peak.year}</b><small>${fmt(peak.total)} eventos</small></div>
      <div class="atlas-sanctions-kpi ${yoy!==null&&yoy<0?'warn':''}"><span>2025 vs 2024</span><b>${yoy===null?'—':pct(yoy,1)}</b><small>${y25?fmt(y25.total):'—'} eventos en 2025</small></div>
      <div class="atlas-sanctions-kpi crit"><span>LA/FT directo</span><b>${fmt(directShare,1)}%</b><small>${fmt(direct)} de ${fmt(total)} eventos</small></div>
      <div class="atlas-sanctions-kpi"><span>2026 parcial</span><b>${y26?fmt(y26.total):'—'}</b><small>no comparable con año cerrado</small></div>
    </div>`;
    body.append(aside);
  }

  function soChart(){
    const W=900,H=210,pL=52,pR=32,pT=28,pB=38;
    const min=Math.min(...SO_VALUES)*.985,max=Math.max(...SO_VALUES)*1.015;
    const x=i=>pL+(W-pL-pR)*(i/(SO_VALUES.length-1));
    const y=v=>pT+(H-pT-pB)*(1-(v-min)/(max-min||1));
    const pts=SO_VALUES.map((v,i)=>[x(i),y(v)]);
    const area=`M ${pts[0][0]} ${H-pB} L ${pts.map(p=>p.join(' ')).join(' L ')} L ${pts.at(-1)[0]} ${H-pB} Z`;
    const line=pts.map(p=>p.join(',')).join(' ');
    const grids=[0,.25,.5,.75,1].map(t=>{const v=min+(max-min)*t,yy=y(v);return `<line class="atlas-so-grid" x1="${pL}" y1="${yy}" x2="${W-pR}" y2="${yy}"/>`;}).join('');
    const marks=pts.map((p,i)=>{
      const delta=i?SO_VALUES[i]-SO_VALUES[i-1]:0;
      const tip=`Sujetos obligados · ${SO_YEARS[i]}|${fmt(SO_VALUES[i])} inscritos|${i?`+${fmt(delta)} frente a ${SO_YEARS[i-1]}`:'base de la serie'}`;
      return `<circle class="atlas-so-dot-halo" cx="${p[0]}" cy="${p[1]}" r="10"/><circle class="atlas-so-dot ${i===pts.length-1?'last':''}" cx="${p[0]}" cy="${p[1]}" r="4.3" data-v036-tip="${esc(tip)}"/><text class="atlas-so-val ${i===pts.length-1?'last':''}" x="${p[0]}" y="${p[1]-13}" text-anchor="middle">${fmt(SO_VALUES[i])}</text><text class="atlas-so-axis" x="${p[0]}" y="${H-12}" text-anchor="middle">${SO_YEARS[i]}</text>`;
    }).join('');
    return `<svg class="atlas-so-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolución agregada de sujetos obligados inscritos entre 2021 y 2025"><defs><linearGradient id="atlasSoArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3b98e0" stop-opacity=".28"/><stop offset="100%" stop-color="#3b98e0" stop-opacity=".015"/></linearGradient></defs>${grids}<path class="atlas-so-area" d="${area}"/><polyline class="atlas-so-line" points="${line}"/>${marks}</svg>`;
  }

  function insertSOEvolution(root){
    if(root.querySelector('[data-atlas-so-evolution]')) return;
    const reportDeck=findDeck('Análisis de reportabilidad');
    const signalDeck=findDeck('Señales del sistema');
    if(!reportDeck||!signalDeck) return;

    const first=SO_VALUES[0],last=SO_VALUES.at(-1),net=last-first;
    const growth=100*(last/first-1);
    const cagr=100*(Math.pow(last/first,1/(SO_VALUES.length-1))-1);
    const diffs=SO_VALUES.slice(1).map((v,i)=>v-SO_VALUES[i]);
    const maxDiff=Math.max(...diffs);
    const maxIndex=diffs.indexOf(maxDiff)+1;
    const maxSpeed=Math.max(...diffs);
    const velocity=diffs.map((v,i)=>`<div class="atlas-so-step"><span>${SO_YEARS[i]}→${SO_YEARS[i+1]}</span><i style="--atlas-so-speed:${Math.max(8,100*v/maxSpeed).toFixed(1)}%"></i><b>+${fmt(v)}</b></div>`).join('');

    const section=document.createElement('section');
    section.className='v036-deck atlas-so-evolution';
    section.dataset.atlasSoEvolution='true';
    section.innerHTML=`<div class="v036-deck-head"><span class="v036-deck-idx">02A</span><h2>Evolución del padrón de sujetos obligados</h2><p>Serie agregada UAF · crecimiento, velocidad de incorporación y cambio de escala.</p></div>
      <article class="v036-card atlas-so-card"><div class="v036-card-head"><div><h3>SO inscritos · trayectoria 2021–2025</h3><p>Lectura del tamaño del universo obligado antes de interpretar reportabilidad y capacidad supervisiva.</p></div><span class="v036-hint">corte estadístico UAF</span></div>
        <div class="atlas-so-layout"><div class="atlas-so-visual">${soChart()}<div class="atlas-so-velocity">${velocity}</div></div>
          <aside class="atlas-so-side"><div class="atlas-so-kpi primary"><span>Padrón 2025</span><b>${fmt(last)}</b><small>SO inscritos en el corte estadístico.</small></div><div class="atlas-so-kpi growth"><span>Crecimiento 2021→2025</span><b>${pct(growth,1)}</b><small>+${fmt(net)} sujetos en cuatro años.</small></div><div class="atlas-so-kpi speed"><span>Mayor expansión anual</span><b>+${fmt(maxDiff)}</b><small>${SO_YEARS[maxIndex-1]}→${SO_YEARS[maxIndex]}.</small></div><div class="atlas-so-kpi"><span>CAGR del padrón</span><b>${pct(cagr,1)}</b><small>crecimiento anual compuesto.</small></div><div class="atlas-so-note"><b>Lectura metodológica:</b> esta es la serie histórica del corte estadístico UAF 2025. No debe confundirse con el padrón operativo más reciente; sirve para comparar la expansión del universo con ROS, ROE y esfuerzo supervisivo.</div></aside>
        </div></article>`;
    signalDeck.before(section);
  }

  function apply(){
    raf=0;
    const root=document.querySelector('.v036-real');
    if(!root) return;
    refineSanctions(root);
    insertSOEvolution(root);
  }

  function schedule(){if(!raf)raf=requestAnimationFrame(apply);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
})();
