'use strict';

/* ATLAS AML 0.52.1 · Consolidación de Personas y control en Entidad 360
 * Retira la navegación heredada independiente sin eliminar datos ni relaciones.
 * La capacidad permanece en el expediente: vínculos de identidad, estructura,
 * propiedad y red de exposición.
 */
(function atlasEntityConsolidation0521(){
  const VERSION='ENTITY-CONSOLIDATION-0521.1';
  const RETIRED_LABELS=new Set(['personas y control','personas & control']);
  const RETIRED_VIEWS=new Set(['people-control','persons-control','personas-control','personas-y-control']);

  function key(value){
    return String(value||'')
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .toLowerCase().replace(/\s+/g,' ').trim();
  }

  function retireStandalonePeopleControl(){
    const nav=document.querySelector('.v019-nav');
    if(!nav)return 0;
    let removed=0;
    nav.querySelectorAll('.v019-nav-btn[data-view]').forEach(button=>{
      const view=key(button.dataset.view);
      const label=key(button.getAttribute('aria-label')||button.querySelector('.atlas-nav-text')?.textContent||button.textContent);
      if(RETIRED_VIEWS.has(view)||RETIRED_LABELS.has(label)){
        button.remove();
        removed++;
      }
    });
    return removed;
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
    const dossier=consolidateDossier();
    window.__ATLAS_ENTITY_CONSOLIDATION_0521__={
      active:true,
      version:VERSION,
      standalonePeopleControl:false,
      retiredNavEntries:removed,
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

  const navObserver=new MutationObserver(()=>queueMicrotask(apply));
  function bind(){
    apply();
    const nav=document.querySelector('.v019-nav');
    if(nav)navObserver.observe(nav,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
  window.addEventListener('atlas:nav-refresh',apply);
})();
