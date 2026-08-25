/* ATLAS AML · Radar Integrado refinement · compact sanctions + sector coverage */
(() => {
  'use strict';

  let raf=0;
  const CANONICAL_SECTORS=55;
  const CANONICAL_REPRESENTED_2025=47;
  const NON_CANONICAL_ROWS_2025=['Instituciones Públicas'];
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

  const fmt=(v,d=0)=>Number(v).toLocaleString('es-CL',{minimumFractionDigits:d,maximumFractionDigits:d});
  const pct=(v,d=1)=>`${v>=0?'+':''}${fmt(v,d)}%`;

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

  function representedSectorCount(root){
    const state=root.querySelector('#v036-fstate')?.textContent||'';
    const match=state.match(/Mostrando\s+[\d.]+\s+de\s+([\d.]+)\s+sectores/i);
    if(match)return Number(match[1].replace(/\./g,''))||0;
    return root.querySelectorAll('.v036-mxrow').length;
  }

  function refineSectorRepresentation(root){
    const statisticalRows=representedSectorCount(root);
    if(!statisticalRows)return;
    const canonicalRepresented=statisticalRows===48?CANONICAL_REPRESENTED_2025:Math.min(CANONICAL_SECTORS,statisticalRows);
    const missing=statisticalRows===48?MISSING_CANONICAL_2025.length:Math.max(0,CANONICAL_SECTORS-canonicalRepresented);
    const coverage=100*canonicalRepresented/CANONICAL_SECTORS;
    const nonCanonical=statisticalRows===48?NON_CANONICAL_ROWS_2025:[];
    let card=root.querySelector('.atlas-sector-representation');

    if(!card){
      const cards=[...root.querySelectorAll('.v036-card')];
      const historyCard=cards.find(c=>c.querySelector('h3')?.textContent.includes('Capacidad supervisiva frente al padrón'))
        ||cards.find(c=>(c.textContent||'').includes('2021–2025'));
      const anchor=historyCard?.closest('.v036-grid2eq,.v036-grid2')||historyCard;
      if(!anchor)return;
      card=document.createElement('article');
      card.className='v036-card atlas-sector-representation';
      anchor.insertAdjacentElement('afterend',card);
    }

    const signature=`${statisticalRows}|${canonicalRepresented}|${missing}`;
    if(card.dataset.signature===signature)return;
    card.dataset.signature=signature;
    const missingList=statisticalRows===48
      ? `<details class="v036-hint" style="margin-top:12px"><summary style="cursor:pointer"><b>Ver los ${missing} sectores canónicos sin representación observada</b></summary><ol style="margin:10px 0 0 22px;display:grid;gap:5px">${MISSING_CANONICAL_2025.map(x=>`<li>${x}</li>`).join('')}</ol></details>`
      : '';
    const extraNote=nonCanonical.length
      ? `<div class="v036-hint" style="margin-top:10px"><b>Por qué 48 filas no equivalen a 48 de 55:</b> el contrato 2025 incorpora además <b>${nonCanonical.join(', ')}</b>, categoría estadística que no forma parte del catálogo canónico de 55 usado por esta comparación. Por eso hay 47 categorías canónicas representadas y 8 ausentes.</div>`
      : '';
    card.innerHTML=`<header class="v036-cardhead"><div><span class="v036-kicker">Cobertura sectorial</span><h3>Sectores económicos sin representación</h3><p class="v036-hint">Catálogo canónico Ley 19.913 vs categorías canónicas con sujetos obligados inscritos observadas en el corte estadístico 2025.</p></div></header>
      <div class="v036-stats">
        <div class="v036-stat"><div><span>Catálogo canónico</span><small>Actividades/sectores gobernados en Atlas</small></div><b>${fmt(CANONICAL_SECTORS)}</b></div>
        <div class="v036-stat"><div><span>Filas sectoriales del contrato</span><small>Incluye categorías estadísticas adicionales</small></div><b>${fmt(statisticalRows)}</b></div>
        <div class="v036-stat"><div><span>Canónicos representados</span><small>Coinciden con el catálogo de 55</small></div><b>${fmt(canonicalRepresented)}</b></div>
        <div class="v036-stat crit"><div><span>Sin representación observada</span><small>Canónicos ausentes del corte 2025</small></div><b>${fmt(missing)}</b></div>
        <div class="v036-stat"><div><span>Cobertura sectorial</span><small>Canónicos representados / 55</small></div><b>${fmt(coverage,1)}%</b></div>
      </div>
      ${missingList}${extraNote}
      <div class="v036-hint" style="margin-top:10px"><b>Cómo leer este dato:</b> “sin representación” significa que el contrato estadístico 2025 no materializa sujetos obligados inscritos para esa categoría canónica. No implica que la actividad esté fuera de la Ley 19.913 ni constituye por sí sola incumplimiento o riesgo.</div>`;
  }

  function apply(){
    raf=0;
    const root=document.querySelector('.v036-real');
    if(!root) return;
    refineSanctions(root);
    refineSectorRepresentation(root);
  }

  function schedule(){if(!raf)raf=requestAnimationFrame(apply);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
})();
