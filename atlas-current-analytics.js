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

/* ATLAS AML 0.45.0 · canonical bootstrap for Territory CEAD analytics.
 * The production runtime compiles manifest sources before the v032 Territory module
 * finishes its deferred initialization. The feature asset must therefore be loaded
 * after DOMContentLoaded, when AML_IRG_TERRITORY exists, so it can wrap render() and
 * replace the legacy CEAD panel reliably. External self-hosted assets preserve CSP.
 */
(function atlasTerritoryAnalyticsCanonicalBootstrap(){
  const CSS='./assets/atlas-territory-threat-analytics-v2.css?v=0450-2';
  const JS='./assets/atlas-territory-threat-analytics-v2.js?v=0450-2';
  function ensureCss(){
    if(document.querySelector('link[data-atlas-territory-analytics="0450"]'))return;
    const link=document.createElement('link');
    link.rel='stylesheet';link.href=CSS;link.dataset.atlasTerritoryAnalytics='0450';
    document.head.appendChild(link);
  }
  function loadAfterTerritory(){
    ensureCss();
    const prior=document.querySelector('script[data-atlas-territory-analytics="0450"]');
    if(prior)prior.remove();
    const script=document.createElement('script');
    script.type='module';script.src=JS;script.dataset.atlasTerritoryAnalytics='0450';
    document.body.appendChild(script);
  }
  ensureCss();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(loadAfterTerritory,0),{once:true});
  else setTimeout(loadAfterTerritory,0);
  window.ATLAS_TERRITORY_ANALYTICS_BOOTSTRAP={release:'0.45.0',build:'0450',mode:'POST_TERRITORY_MODULE'};
})();

/* ATLAS AML 0.45.0 · canonical bootstrap for Public Spend visible taxonomy.
 * The approved mark taxonomy must govern native filters/KPIs after v037 initializes.
 */
(function atlasPublicSpendTaxonomyCanonicalBootstrap(){
  const JS='./assets/atlas-public-spend-mark-taxonomy-v4.js?v=0450-4';
  function load(){
    const prior=document.querySelector('script[data-atlas-public-spend-taxonomy="v4"]');
    if(prior)prior.remove();
    const script=document.createElement('script');
    script.src=JS;script.dataset.atlasPublicSpendTaxonomy='v4';
    document.body.appendChild(script);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(load,0),{once:true});
  else setTimeout(load,0);
  window.ATLAS_PUBLIC_SPEND_TAXONOMY_BOOTSTRAP={release:'0.45.0',build:'0450',mode:'POST_V037_VISIBLE_TAXONOMY'};
})();

/* ATLAS AML 0.69.2 · canonical production bootstrap for sector representation.
 * Pages publishes the compiled manifest runtime as the authority. Loading the
 * sector coverage overlay from this manifest-owned file guarantees that the
 * 55/47/8 coverage card is present in the actual production runtime, instead of
 * depending only on historical <script> tags retained in index.html.
 */
(function atlasSectorRepresentationCanonicalBootstrap(){
  const JS='./assets/atlas-radar-layout-so-history.js?v=0692-1';
  const CSS='./assets/atlas-radar-layout-so-history.css?v=0692-1';
  function ensureCss(){
    if(document.querySelector('link[data-atlas-sector-representation="0692"]'))return;
    const link=document.createElement('link');
    link.rel='stylesheet';link.href=CSS;link.dataset.atlasSectorRepresentation='0692';
    document.head.appendChild(link);
  }
  function load(){
    ensureCss();
    document.querySelectorAll('script[data-atlas-sector-representation]').forEach(n=>n.remove());
    const script=document.createElement('script');
    script.src=JS;script.dataset.atlasSectorRepresentation='0692';
    document.body.appendChild(script);
  }
  ensureCss();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(load,0),{once:true});
  else setTimeout(load,0);
  window.ATLAS_SECTOR_REPRESENTATION_BOOTSTRAP={release:'0.69.2',mode:'CANONICAL_COMPILED_RUNTIME_BOOTSTRAP',catalog:55,represented:47,missing:8};
})();
