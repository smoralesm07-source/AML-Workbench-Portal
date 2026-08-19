'use strict';

/* ATLAS AML 0.43.3 · current analytics runtime
 * Purpose: keep visual encodings CSP-safe without weakening style-src 'self'.
 * Gasto Publico legacy renderers still emit inline width/stroke-width values;
 * this authority converts them to native progress/SVG presentation attributes.
 */
(function atlasCurrentAnalytics(){
  const VERSION='0.43.3';
  let queued=false;

  function clamp(v,min=0,max=100){const n=Number(v);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):0;}
  function widthFromStyle(el){
    const raw=String(el?.getAttribute?.('style')||'');
    const m=raw.match(/(?:^|;)\s*width\s*:\s*([0-9]+(?:\.[0-9]+)?)%/i);
    return m?clamp(m[1]):null;
  }
  function strokeFromStyle(el){
    const raw=String(el?.getAttribute?.('style')||'');
    const m=raw.match(/(?:^|;)\s*stroke-width\s*:\s*([0-9]+(?:\.[0-9]+)?)/i);
    return m?Math.max(.5,Math.min(14,Number(m[1]))):null;
  }
  function labelFor(row){return String(row?.querySelector?.('span')?.textContent||'Magnitud').trim();}

  function convertMeter(row){
    const track=row?.querySelector?.(':scope > i');
    const fill=track?.querySelector?.(':scope > b');
    if(!track||!fill)return false;
    const value=widthFromStyle(fill);
    if(value==null)return false;
    const progress=document.createElement('progress');
    progress.className=`atlas-v037-progress${fill.classList.contains('neg')?' neg':''}`;
    progress.max=100;
    progress.value=value;
    progress.setAttribute('aria-label',`${labelFor(row)} · escala relativa ${value.toLocaleString('es-CL',{maximumFractionDigits:1})}%`);
    progress.dataset.atlasScale=String(value);
    track.replaceWith(progress);
    return true;
  }

  function convertEdges(root){
    let changed=0;
    root.querySelectorAll?.('.v037-edge[style]').forEach(edge=>{
      const value=strokeFromStyle(edge);
      if(value==null)return;
      edge.setAttribute('stroke-width',String(value));
      edge.removeAttribute('style');
      edge.dataset.atlasStrokeWidth=String(value);
      changed++;
    });
    return changed;
  }

  function audit(root){
    const meters=[...root.querySelectorAll?.('.atlas-v037-progress')||[]];
    const values=meters.map(p=>Number(p.value)).filter(Number.isFinite);
    const unique=new Set(values.map(v=>v.toFixed(3))).size;
    const bars=[...root.querySelectorAll?.('.v037-bar,.v037-markbar,.v037-grow')||[]].length;
    const unresolved=[...root.querySelectorAll?.('.v037-bar i b[style],.v037-markbar i b[style],.v037-grow i b[style]')||[]].length;
    const status=!bars?'idle':unresolved?'degraded':'ready';
    const health={status,version:VERSION,bars,meters,unresolved,uniqueScaleValues:unique,checkedAt:new Date().toISOString()};
    window.__ATLAS_PUBLIC_SPEND_GRAPHICS__=health;
    const spend=root.querySelector?.('.v037-spend');
    if(spend){spend.dataset.atlasGraphicsHealth=status;spend.dataset.atlasGraphicsVersion=VERSION;}
    return health;
  }

  function syncPublicSpend(){
    const root=document.querySelector('#content')||document;
    if(!root.querySelector?.('.v037-spend'))return audit(root);
    let converted=0;
    root.querySelectorAll('.v037-bar,.v037-markbar,.v037-grow').forEach(row=>{if(convertMeter(row))converted++;});
    const edges=convertEdges(root);
    const health=audit(root);
    health.convertedMeters=converted;
    health.convertedEdges=edges;
    return health;
  }

  function queueSync(){
    if(queued)return;
    queued=true;
    queueMicrotask(()=>{queued=false;syncPublicSpend();});
  }

  function wrap(name){
    const fn=window[name];
    if(typeof fn!=='function'||fn.__atlas0433)return;
    const wrapped=function(...args){
      const out=fn.apply(this,args);
      queueSync();
      return out;
    };
    Object.defineProperty(wrapped,'__atlas0433',{value:true});
    window[name]=wrapped;
  }

  ['v037RenderAll','v037RenderFlow','v037RenderRank','v037RenderMarks','v037RenderGrowth'].forEach(wrap);
  window.addEventListener('atlas:themechange',queueSync);
  window.addEventListener('atlas:nav-refresh',queueSync);
  window.AtlasAnalyticsVisuals={version:VERSION,refresh:syncPublicSpend,health:()=>window.__ATLAS_PUBLIC_SPEND_GRAPHICS__||null};
  queueSync();
})();
