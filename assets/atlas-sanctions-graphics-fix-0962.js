'use strict';
/* ATLAS AML · Sanciones graphics hardening 0.96.2
 * Presentation-only. Converts dynamic inline widths/heat variables emitted by
 * Sanciones 0.96.1 into CSP-safe native progress elements and CSS classes.
 */
(function atlasSanctionsGraphicsFix0962(){
  const VERSION='0.96.2';
  let raf=0,observer=null;

  const intText=node=>{
    const raw=String(node?.textContent||'').replace(/[^0-9-]/g,'');
    const n=Number(raw);
    return Number.isFinite(n)?Math.max(0,n):0;
  };
  const heat=(value,max)=>value<=0?0:Math.max(1,Math.min(5,Math.ceil((value/Math.max(1,max))*5)));
  const clearHeat=el=>{
    for(let i=0;i<=5;i++)el.classList.remove(`heat-${i}`);
  };

  function decorateSourceCards(root){
    root.querySelectorAll('.san96-source[data-src]').forEach(el=>el.removeAttribute('style'));
  }

  function decorateLegend(root){
    root.querySelectorAll('.san96-legend [data-reg-legend] i[style]').forEach(el=>el.removeAttribute('style'));
  }

  function decorateMatrix(root){
    const cells=[...root.querySelectorAll('.san96-matrix .cell[data-mreg]')];
    if(!cells.length)return;
    const values=cells.map(intText),max=Math.max(1,...values);
    cells.forEach((cell,i)=>{
      cell.removeAttribute('style');
      clearHeat(cell);
      cell.classList.add(`heat-${heat(values[i],max)}`);
    });
  }

  function makeProgress(cls,value,max,label){
    const p=document.createElement('progress');
    p.className=cls;
    p.max=Math.max(1,max);
    p.value=Math.max(0,value);
    p.setAttribute('aria-label',label);
    return p;
  }

  function decorateRegions(root){
    const rows=[...root.querySelectorAll('.san96-region-row[data-region]')];
    if(!rows.length)return;
    const values=rows.map(row=>intText(row.querySelector(':scope > b'))),max=Math.max(1,...values);
    rows.forEach((row,i)=>{
      row.removeAttribute('style');
      row.querySelectorAll('[style]').forEach(el=>el.removeAttribute('style'));
      const track=row.querySelector('.san96-region-track');
      if(!track)return;
      let p=track.querySelector('progress.san96-region-progress');
      if(!p){
        track.replaceChildren();
        p=makeProgress('san96-region-progress',values[i],max,`${row.dataset.region||'Región'}: ${values[i]} eventos`);
        track.appendChild(p);
      }else{
        p.max=max;p.value=values[i];
        p.setAttribute('aria-label',`${row.dataset.region||'Región'}: ${values[i]} eventos`);
      }
    });
  }

  function decorateSectors(root){
    const rows=[...root.querySelectorAll('.san96-sector-bars button[data-so-sector]')];
    if(!rows.length)return;
    const values=rows.map(row=>intText(row.querySelector(':scope > b'))),max=Math.max(1,...values);
    rows.forEach((row,i)=>{
      row.removeAttribute('style');
      row.querySelectorAll('[style]').forEach(el=>el.removeAttribute('style'));
      const holder=row.querySelector(':scope > i');
      if(!holder)return;
      let p=holder.querySelector('progress.san96-sector-progress');
      if(!p){
        holder.replaceChildren();
        p=makeProgress('san96-sector-progress',values[i],max,`${row.dataset.soSector||'Sector'}: ${values[i]} eventos`);
        holder.appendChild(p);
      }else{
        p.max=max;p.value=values[i];
        p.setAttribute('aria-label',`${row.dataset.soSector||'Sector'}: ${values[i]} eventos`);
      }
    });
  }

  function decorate(){
    const root=document.querySelector('.san96');
    if(!root)return null;
    decorateSourceCards(root);
    decorateLegend(root);
    decorateMatrix(root);
    decorateRegions(root);
    decorateSectors(root);
    root.dataset.sanctionsGraphics='0962';
    const inline=[...root.querySelectorAll('[style]')].filter(el=>!el.closest('svg'));
    inline.forEach(el=>el.removeAttribute('style'));
    const health={
      status:'ready',version:VERSION,
      regionRows:root.querySelectorAll('.san96-region-row').length,
      regionProgress:root.querySelectorAll('progress.san96-region-progress').length,
      matrixCells:root.querySelectorAll('.san96-matrix .cell').length,
      sectorProgress:root.querySelectorAll('progress.san96-sector-progress').length,
      remainingInlineStyles:[...root.querySelectorAll('[style]')].filter(el=>!el.closest('svg')).length,
      checkedAt:new Date().toISOString()
    };
    window.__ATLAS_SANCTIONS_GRAPHICS__=health;
    return health;
  }

  function queue(){
    if(raf)return;
    raf=requestAnimationFrame(()=>{raf=0;decorate();});
  }

  function wrapCurrentLoader(){
    const api=window.ATLAS_SANCTIONS_CURRENT;
    if(!api||typeof api.load!=='function'||api.__graphicsFix0962)return;
    const original=api.load;
    const wrapped=async function(...args){
      const out=await original.apply(this,args);
      queue();setTimeout(queue,0);setTimeout(queue,80);
      return out;
    };
    api.load=wrapped;
    api.reload=wrapped;
    api.__graphicsFix0962=true;
  }

  function observe(){
    if(observer)return;
    const target=document.querySelector('#content')||document.body||document.documentElement;
    observer=new MutationObserver(records=>{
      if(records.some(r=>r.addedNodes.length||r.removedNodes.length))queue();
      wrapCurrentLoader();
    });
    observer.observe(target,{subtree:true,childList:true});
  }

  wrapCurrentLoader();
  observe();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{wrapCurrentLoader();observe();queue();},{once:true});
  else queue();
  window.addEventListener('atlas:nav-refresh',()=>{wrapCurrentLoader();queue();});
  window.addEventListener('atlas:routechange',()=>{wrapCurrentLoader();queue();});
  window.addEventListener('atlas:themechange',queue);
  window.addEventListener('pageshow',()=>{wrapCurrentLoader();queue();});

  window.ATLAS_SANCTIONS_GRAPHICS_FIX={version:VERSION,refresh:()=>{wrapCurrentLoader();return decorate();},health:()=>window.__ATLAS_SANCTIONS_GRAPHICS__||null};
})();

/* 0.96.3 late visual/interactivity bootstrap.
 * This is intentionally owned by the already-published 0.96.2 entry point so
 * Pages can pick up the correction without depending on historical index order.
 */
(function atlasSanctionsDrilldownBootstrap0963(){
  const CSS='./assets/atlas-sanctions-drilldown-0963.css?v=0963-1';
  const JS='./assets/atlas-sanctions-drilldown-0963.js?v=0963-1';
  function ensureCss(){
    if(document.querySelector('link[data-atlas-sanctions-drilldown="0963"]'))return;
    const link=document.createElement('link');link.rel='stylesheet';link.href=CSS;link.dataset.atlasSanctionsDrilldown='0963';document.head.appendChild(link);
  }
  function ensureJs(){
    if(window.ATLAS_SANCTIONS_DRILLDOWN?.version==='0.96.3')return;
    if(document.querySelector('script[data-atlas-sanctions-drilldown="0963"]'))return;
    const script=document.createElement('script');script.src=JS;script.defer=true;script.dataset.atlasSanctionsDrilldown='0963';document.body.appendChild(script);
  }
  function boot(){ensureCss();ensureJs();}
  boot();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  window.addEventListener('pageshow',boot);
  window.addEventListener('atlas:nav-refresh',boot);
})();
