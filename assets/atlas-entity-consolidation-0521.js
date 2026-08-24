'use strict';

/* ATLAS AML · Consolidación de Personas y control en Entidad 360
 * Retira cualquier entrada de navegación heredada "Personas y control" sin
 * eliminar datos, relaciones ni la lectura societaria dentro del expediente.
 */
(function atlasEntityConsolidation0521(){
  const VERSION='ENTITY-CONSOLIDATION-0521.2';
  const RETIRED_LABELS=new Set(['personas y control','personas & control','personas, control']);
  const RETIRED_VIEWS=new Set(['people-control','persons-control','personas-control','personas-y-control','people_control','persons_control']);

  function key(value){
    return String(value||'')
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .toLowerCase().replace(/\s+/g,' ').trim();
  }

  function isRetiredControl(node){
    if(!node)return false;
    const view=key(node.getAttribute?.('data-view')||node.dataset?.view||node.getAttribute?.('href')||'');
    const label=key(node.getAttribute?.('aria-label')||node.querySelector?.('.atlas-nav-text')?.textContent||node.textContent||'');
    return RETIRED_VIEWS.has(view)||RETIRED_LABELS.has(label)||[...RETIRED_VIEWS].some(v=>view.includes(v));
  }

  function retireStandalonePeopleControl(){
    const scopes=[...document.querySelectorAll('aside,nav,.sidebar,.v019-nav,.nav,[role="navigation"]')];
    let removed=0;
    scopes.forEach(scope=>{
      scope.querySelectorAll('button,a,[role="button"],[data-view]').forEach(node=>{
        if(isRetiredControl(node)){
          node.remove();
          removed++;
        }
      });
    });
    return removed;
  }

  function guardRetiredRoute(){
    let current='';
    try{current=key((typeof state!=='undefined'?state:window.state)?.view||'');}catch(_error){}
    if(!RETIRED_VIEWS.has(current))return false;
    try{
      if(typeof navigate==='function'){navigate('entities');return true;}
      const btn=document.querySelector('[data-view="entities"]');
      if(btn){btn.click();return true;}
    }catch(_error){}
    return false;
  }

  function consolidateDossier(){
    const root=document.querySelector('#content .a45');
    if(!root)return false;
    const structure=root.querySelector('#aed-structure');
    const title=structure?.querySelector('header h3');
    if(title&&title.textContent!=='Personas, propiedad y control')title.textContent='Personas, propiedad y control';
    if(structure&&!structure.querySelector('[data-aec-control-note]')){
      const note=document.createElement('p');
      note.dataset.aecControlNote='1';
      note.className='aed-note';
      note.textContent='Este bloque concentra la lectura societaria y de control de la entidad. Los vínculos candidatos conservan su estado y nunca transfieren riesgo ni atributos.';
      structure.appendChild(note);
    }
    const links=root.querySelector('#aed-links header h3');
    if(links&&links.textContent==='Vínculos de identidad gobernados')links.textContent='Vínculos de identidad y relaciones gobernadas';
    return true;
  }

  function apply(){
    const removed=retireStandalonePeopleControl();
    const redirected=guardRetiredRoute();
    const dossier=consolidateDossier();
    window.__ATLAS_ENTITY_CONSOLIDATION_0521__={
      active:true,
      version:VERSION,
      standalonePeopleControl:false,
      retiredNavEntries:removed,
      retiredRouteRedirected:redirected,
      dossierConsolidated:dossier,
      dataDeletion:false,
      relationshipDeletion:false,
      checkedAt:new Date().toISOString()
    };
  }

  const BASE_RENDER=typeof window.v0203RenderEntity==='function'?window.v0203RenderEntity:null;
  if(BASE_RENDER){
    const wrapped=function(...args){
      const result=BASE_RENDER.apply(this,args);
      queueMicrotask(apply);
      return result;
    };
    try{v0203RenderEntity=wrapped;}catch(_error){}
    window.v0203RenderEntity=wrapped;
  }

  const observer=new MutationObserver(()=>queueMicrotask(apply));
  function bind(){
    apply();
    observer.observe(document.documentElement,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
  window.addEventListener('atlas:nav-refresh',apply);
  window.addEventListener('hashchange',apply);
  window.addEventListener('popstate',apply);
})();
