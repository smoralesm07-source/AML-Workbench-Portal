'use strict';
/* ATLAS AML · Empresas (RES) · cartogram scale fix 0.97.0 */
(function atlasResCartogramFix0970(){
  if(window.__ATLAS_RES_CARTOGRAM_FIX_0954__) return;
  window.__ATLAS_RES_CARTOGRAM_FIX_0954__=true;
  const VERSION='0.97.0';
  const data=()=>window.AtlasRes0952?.data||window.AtlasRes0950?.data||null;
  const growth=(a,b)=>b?((Number(a)/Number(b)-1)*100):0;
  function regionPeak(d,code){let best=-Infinity;(d?.regionMonthly?.[code]||[]).forEach(r=>{const g=growth(r[1],r[2]);if(Number.isFinite(g)&&g>best)best=g;});return Number.isFinite(best)?best:0;}
  function metricValue(d,code,metric){const row=(d?.regions||[]).find(r=>Number(r[0])===Number(code));if(!row)return 0;if(metric==='growth')return growth(row[1],row[2]);if(metric==='burst')return regionPeak(d,Number(code));return Number(row[1]||0);}
  function normalize(values,metric){const t=values.map(v=>metric==='volume'?Math.log1p(Math.max(0,v)):Number(v||0));const min=Math.min(...t),max=Math.max(...t),span=Math.max(1e-9,max-min);return t.map(v=>{let n=(v-min)/span;if(metric!=='volume')n=Math.pow(Math.max(0,n),.72);return Math.max(0,Math.min(1,n));});}
  function apply(){const box=document.querySelector('#res952-chile');if(!box)return false;const nodes=[...box.querySelectorAll('.res952-region-node[data-res952-region]')];if(!nodes.length)return false;const d=data();if(!d)return false;const metric=document.querySelector('#res952-territory-metric')?.value||'volume';const values=nodes.map(n=>metricValue(d,Number(n.dataset.res952Region),metric)),levels=normalize(values,metric);nodes.forEach((node,i)=>{const width=12+levels[i]*78;node.style.setProperty('--res954-bar-width',`${width.toFixed(1)}%`);node.style.setProperty('--level',String((width/100).toFixed(3)));node.dataset.res954Value=String(values[i]);node.dataset.res954Metric=metric;});box.dataset.res954Scale=metric==='volume'?'logarithmic':'normalized';window.__ATLAS_RES_CARTOGRAM__={version:VERSION,status:'ready',metric,scale:box.dataset.res954Scale,observer:'none',checkedAt:new Date().toISOString()};return true;}
  function bindMetric(){const select=document.querySelector('#res952-territory-metric');if(!select||select.dataset.res954Bound==='1')return;select.dataset.res954Bound='1';select.addEventListener('change',()=>requestAnimationFrame(apply));}
  let timers=[];
  function bounded(){timers.forEach(clearTimeout);timers=[0,80,220,600,1200].map(ms=>setTimeout(()=>{bindMetric();apply();},ms));}
  bounded();
  document.addEventListener('atlas:routechange',bounded);
  document.addEventListener('click',e=>{if(e.target?.closest?.('[data-res952-route="territory"]'))setTimeout(bounded,0);},true);
})();
