'use strict';
/* ATLAS OSFL 0.93.1 · presentation cleanup
 * Removes the legacy "Priorizar con evidencia" card from the OSFL view without
 * changing governed OSFL data, scoring, queries or adjacent analytical modules.
 */
(function atlasOsflRemoveEvidencePriority0931(){
  if(window.AtlasOsflRemoveEvidencePriority0931)return;
  const VERSION='0931.1';
  const TITLE='priorizar con evidencia';
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase();

  function findCard(root,label){
    const direct=label.closest('article,[class*="card" i],[class*="panel" i],[class*="module" i],[class*="box" i]');
    if(direct&&direct!==root&&root.contains(direct))return direct;
    let node=label.parentElement;
    while(node&&node!==root){
      if((node.tagName==='ARTICLE'||node.tagName==='SECTION'||node.tagName==='DIV')&&norm(node.textContent).includes(TITLE))return node;
      node=node.parentElement;
    }
    return null;
  }

  function removeCard(){
    const root=document.querySelector('.v030-osfl');
    if(!root)return false;
    const labels=[...root.querySelectorAll('h1,h2,h3,h4,h5,h6,strong,b,span,p')];
    const label=labels.find(el=>norm(el.textContent).includes(TITLE));
    if(!label)return false;
    const card=findCard(root,label);
    if(!card)return false;
    const parent=card.parentElement;
    card.remove();
    if(parent&&parent.children.length===0&&parent!==root&&norm(parent.textContent)==='')parent.remove();
    root.dataset.atlasEvidencePriorityCard='removed';
    return true;
  }

  function cleanup(){
    removeCard();
    requestAnimationFrame(removeCard);
    setTimeout(removeCard,80);
    setTimeout(removeCard,300);
  }

  if(typeof v030LoadOsfl==='function'){
    const baseLoad=v030LoadOsfl;
    v030LoadOsfl=async function(){
      const out=await baseLoad.apply(this,arguments);
      cleanup();
      return out;
    };
  }
  if(typeof v030SyncMapAndCharts==='function'){
    const baseSync=v030SyncMapAndCharts;
    v030SyncMapAndCharts=async function(){
      const out=await baseSync.apply(this,arguments);
      cleanup();
      return out;
    };
  }
  window.addEventListener('atlas:nav-refresh',cleanup);
  window.addEventListener('pageshow',cleanup);
  cleanup();
  window.AtlasOsflRemoveEvidencePriority0931={version:VERSION,cleanup,removeCard};
})();
