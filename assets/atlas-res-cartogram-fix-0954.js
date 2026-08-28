'use strict';
/* ATLAS AML · Empresas (RES) · cartogram scale fix 0.95.4 */
(function atlasResCartogramFix0954(){
  if(window.__ATLAS_RES_CARTOGRAM_FIX_0954__) return;
  window.__ATLAS_RES_CARTOGRAM_FIX_0954__=true;

  const VERSION='0.95.4';
  const data=()=>window.AtlasRes0952?.data||window.AtlasRes0950?.data||null;
  const growth=(a,b)=>b?((Number(a)/Number(b)-1)*100):0;

  function regionPeak(d,code){
    const rows=d?.regionMonthly?.[code]||[];
    let best=-Infinity;
    rows.forEach(r=>{const g=growth(r[1],r[2]);if(Number.isFinite(g)&&g>best)best=g;});
    return Number.isFinite(best)?best:0;
  }

  function metricValue(d,code,metric){
    const row=(d?.regions||[]).find(r=>Number(r[0])===Number(code));
    if(!row) return 0;
    if(metric==='growth') return growth(row[1],row[2]);
    if(metric==='burst') return regionPeak(d,Number(code));
    return Number(row[1]||0);
  }

  function normalize(values,metric){
    const transformed=values.map(v=>metric==='volume'?Math.log1p(Math.max(0,v)):Number(v||0));
    const min=Math.min(...transformed),max=Math.max(...transformed),span=Math.max(1e-9,max-min);
    return transformed.map(v=>{
      let n=(v-min)/span;
      if(metric!=='volume') n=Math.pow(Math.max(0,n),0.72);
      return Math.max(0,Math.min(1,n));
    });
  }

  function apply(){
    const box=document.querySelector('#res952-chile');
    if(!box) return false;
    const nodes=[...box.querySelectorAll('.res952-region-node[data-res952-region]')];
    if(!nodes.length) return false;
    const d=data();
    if(!d) return false;
    const metric=document.querySelector('#res952-territory-metric')?.value||'volume';
    const values=nodes.map(n=>metricValue(d,Number(n.dataset.res952Region),metric));
    const levels=normalize(values,metric);
    nodes.forEach((node,i)=>{
      const width=12+(levels[i]*78); // 12%–90%: visible difference without hiding low-volume regions.
      node.style.setProperty('--res954-bar-width',`${width.toFixed(1)}%`);
      node.style.setProperty('--level',String((width/100).toFixed(3)));
      node.dataset.res954Value=String(values[i]);
      node.dataset.res954Metric=metric;
    });
    box.dataset.res954Scale=metric==='volume'?'logarithmic':'normalized';
    window.__ATLAS_RES_CARTOGRAM__={version:VERSION,status:'ready',metric,scale:box.dataset.res954Scale,minWidthPct:12,maxWidthPct:90,checkedAt:new Date().toISOString()};
    return true;
  }

  function bindMetric(){
    const select=document.querySelector('#res952-territory-metric');
    if(!select||select.dataset.res954Bound==='1') return;
    select.dataset.res954Bound='1';
    select.addEventListener('change',()=>requestAnimationFrame(()=>apply()));
  }

  const observer=new MutationObserver(()=>{bindMetric();requestAnimationFrame(()=>apply());});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('atlas:routechange',()=>{bindMetric();requestAnimationFrame(()=>apply());});
  window.addEventListener('atlas:nav-refresh',()=>{bindMetric();requestAnimationFrame(()=>apply());});
  for(const ms of [0,80,180,350,700,1200,2200]) setTimeout(()=>{bindMetric();apply();},ms);
})();
