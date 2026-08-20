'use strict';
/* ATLAS AML · IRG refinement.
 * Keeps the numeric IRG unchanged and improves interpretation by:
 *  - forcing the formula to one line with help for every term;
 *  - coloring the regional map by comparative quintile so national dispersion is visible;
 *  - explicitly documenting that official cash-use evidence is macrozone-level, not regional.
 */
(function(){
  const HELP={
    irg:{title:'IRG · Índice de Riesgo Geográfico LA/FT',body:'Score territorial compuesto. Mantiene la estructura 45% V/E + 20% Densidad SO + 20% Brecha + 15% Amenaza.',note:'No es probabilidad de delito ni atribución de riesgo a una entidad específica.'},
    ve:{title:'V/E · Vulnerabilidad / Exposición',body:'Riesgo inherente de los sectores económicos sensibles a LA/FT, ponderado por la presencia potencial SII derivada de homologaciones UAF↔SII validadas.',note:'El componente vale 45% del IRG. El uso de efectivo puede ser un intensificador útil, pero el Banco Central publica evidencia representativa por macrozona y no un stock de efectivo por región; por eso ATLAS no inventa una asignación regional.'},
    density:{title:'Densidad SO · Sujetos Obligados',body:'Percentil nacional de sujetos obligados UAF observados por cada 1.000 entidades activas SII de la región.',note:'Mide concentración relativa, no incumplimiento. Peso: 20%.'},
    gap:{title:'Brecha potencial de cobertura',body:'Diferencia entre el universo potencial SII en actividades homologadas y los sujetos obligados UAF observados/localizados.',note:'Es una señal de screening y requiere validación documental. Peso: 20%.'},
    threat:{title:'Amenaza territorial',body:'Componente CEAD construido con 70% de intensidad relativa y 30% de tendencia positiva de delitos pertinentes al marco LA/FT.',note:'Aporta contexto delictual territorial; por sí solo no acredita LA/FT. Peso: 15%.'}
  };
  const COLORS=['#8fb8a8','#d7c67d','#e59a55','#cf6548','#a43a38'];
  let tip=null,scheduled=false;
  function ensureTip(){if(tip)return tip;tip=document.createElement('div');tip.className='v032-irg-tip';document.body.appendChild(tip);return tip;}
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function showTip(el,key){const h=HELP[key];if(!h)return;const t=ensureTip(),r=el.getBoundingClientRect();t.innerHTML=`<b>${esc(h.title)}</b><div>${esc(h.body)}</div><small>${esc(h.note)}</small>`;t.style.left=`${Math.min(window.innerWidth-355,Math.max(8,r.left))}px`;t.style.top=`${Math.min(window.innerHeight-150,r.bottom+8)}px`;t.classList.add('on');}
  function hideTip(){tip?.classList.remove('on');}
  function help(key,label){return `<span class="v032-term">${label}<span class="v032-help" tabindex="0" role="button" aria-label="Ayuda ${label}" data-v032-help="${key}">i</span></span>`;}
  function patchFormula(){
    document.querySelectorAll('.v032-formula-eq').forEach(eq=>{
      if(eq.dataset.atlasIrgRefined==='1')return;
      eq.dataset.atlasIrgRefined='1';
      eq.innerHTML=`${help('irg','IRG')} = <b>45%</b>&nbsp;${help('ve','V/E')} + <b>20%</b>&nbsp;${help('density','Densidad SO')} + <b>20%</b>&nbsp;${help('gap','Brecha')} + <b>15%</b>&nbsp;${help('threat','Amenaza')}`;
    });
    document.querySelectorAll('[data-v032-help]').forEach(el=>{
      if(el.dataset.helpBound==='1')return;el.dataset.helpBound='1';
      const key=el.dataset.v032Help;el.addEventListener('mouseenter',()=>showTip(el,key));el.addEventListener('mouseleave',hideTip);el.addEventListener('focus',()=>showTip(el,key));el.addEventListener('blur',hideTip);
    });
  }
  function parseValue(path){const s=path.querySelector('title')?.textContent||'';const m=s.match(/(?:IRG|V\/E|Densidad SO|Brecha|Amenaza)\s+(-?\d+(?:[.,]\d+)?)/i);return m?Number(m[1].replace(',','.')):NaN;}
  function quantileRank(values,v){if(values.length<=1)return .5;let below=0,equal=0;for(const x of values){if(x<v)below++;else if(x===v)equal++;}return (below+(equal-1)/2)/(values.length-1);}
  function patchMap(){
    const map=document.querySelector('.v032-map');if(!map)return;
    const paths=[...map.querySelectorAll('path.v032-region')].map(p=>({p,v:parseValue(p)})).filter(x=>Number.isFinite(x.v));
    if(paths.length<3)return;
    const vals=paths.map(x=>x.v).sort((a,b)=>a-b);
    paths.forEach(({p,v})=>{const q=quantileRank(vals,v);const band=Math.min(4,Math.max(0,Math.floor(q*5)));p.setAttribute('fill',COLORS[band]);p.dataset.v032RelativeBand=`q${band+1}`;const title=p.querySelector('title');if(title&&!/quintil comparativo/i.test(title.textContent))title.textContent+=` · color: quintil comparativo ${band+1}/5`;});
    const legend=document.querySelector('.v032-legend');if(legend&&!legend.querySelector('.v032-rel-note')){const note=document.createElement('span');note.className='v032-rel-note';note.innerHTML='<b>Color</b> = quintil relativo nacional';legend.appendChild(note);}
  }
  function run(){scheduled=false;patchFormula();patchMap();}
  function queue(){if(scheduled)return;scheduled=true;requestAnimationFrame(run);}
  const obs=new MutationObserver(queue);obs.observe(document.documentElement,{subtree:true,childList:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',queue,{once:true});else queue();
  window.addEventListener('hashchange',queue);window.addEventListener('popstate',queue);
})();
