'use strict';

/* ATLAS AML · Entidades · Press observation view 0.95.1
 * Presentation-only refinement for unreconciled press observations.
 * Keeps identity governance intact: no RUT/Entity ID inference and no automatic reconciliation.
 */
(function atlasEntityPressView0951(){
  const ACTIVE_CLASS='atlas-entity-press-view-0951';
  const ROOT_SELECTOR='.a47-press-observation';
  const ORIGINAL_SEARCH_COPY={
    title:'Buscar o cambiar entidad',
    help:'Escribe nombre, RUT o Entity ID. ATLAS busca identidades canónicas y observaciones de prensa; las coincidencias sin conciliación se muestran expresamente como “No conciliada”.'
  };
  let raf=0;

  function restoreSearchCopy(){
    const host=document.querySelector('#a47-entity-search-host');
    if(!host)return;
    const title=host.querySelector('.a47-search-copy strong');
    const help=host.querySelector('.a47-search-copy small');
    if(title&&title.dataset.a951==='1'){title.textContent=ORIGINAL_SEARCH_COPY.title;delete title.dataset.a951;}
    if(help&&help.dataset.a951==='1'){help.textContent=ORIGINAL_SEARCH_COPY.help;delete help.dataset.a951;}
  }

  function compactSearchCopy(){
    const host=document.querySelector('#a47-entity-search-host');
    if(!host)return;
    const title=host.querySelector('.a47-search-copy strong');
    const help=host.querySelector('.a47-search-copy small');
    if(title){title.textContent='Cambiar identidad';title.dataset.a951='1';}
    if(help){help.textContent='Busca por nombre, RUT o Entity ID. Las observaciones sin conciliación permanecen separadas de la identidad canónica.';help.dataset.a951='1';}
  }

  function makeToolbar(root){
    let bar=root.querySelector(':scope > .a951-press-toolbar');
    if(bar)return bar;
    bar=document.createElement('div');
    bar.className='a951-press-toolbar';
    bar.innerHTML=`
      <button type="button" class="a951-back-entities" data-a951-back aria-label="Volver a Entidades">
        <span aria-hidden="true">←</span><b>Volver a Entidades</b>
      </button>
      <div class="a951-press-context">
        <span>ENTIDADES · FUENTE ABIERTA</span>
        <strong>Observación de prensa</strong>
      </div>
      <div class="a951-governance" title="La observación no está conciliada con una identidad canónica">
        <i aria-hidden="true"></i><span>Identidad</span><b>NO CONCILIADA</b>
      </div>`;
    root.insertBefore(bar,root.firstChild);
    return bar;
  }

  function tagEvidence(root){
    const radar=root.querySelector('.a528-press');
    root.classList.toggle('a951-has-radar',!!radar);
    if(!radar)return;
    radar.classList.add('a951-radar');
    const list=radar.querySelector('.a528-news');
    list?.querySelectorAll(':scope > article').forEach((article,index)=>{
      article.classList.add('a951-news-row');
      article.dataset.a951Index=String(index+1).padStart(2,'0');
    });
  }

  function enhance(){
    raf=0;
    const root=document.querySelector(ROOT_SELECTOR);
    if(!root){
      document.body.classList.remove(ACTIVE_CLASS);
      restoreSearchCopy();
      return;
    }
    document.body.classList.add(ACTIVE_CLASS);
    root.classList.add('a951-press-view');
    makeToolbar(root);
    compactSearchCopy();
    tagEvidence(root);
  }

  function scheduleEnhance(){
    if(raf)return;
    raf=requestAnimationFrame(enhance);
  }

  function goBackToEntities(event){
    event?.preventDefault?.();
    document.body.classList.remove(ACTIVE_CLASS);
    restoreSearchCopy();
    const entry=window.__ATLAS_ENTITY_ENTRY__;
    const loader=typeof window.loadEntities==='function'
      ? window.loadEntities
      : (entry&&typeof entry.load==='function'?entry.load.bind(entry):null);
    if(loader){
      try{
        const result=loader();
        if(result&&typeof result.catch==='function')result.catch(()=>{});
        return;
      }catch(_error){}
    }
    const candidates=[...document.querySelectorAll('button,a')];
    const target=candidates.find(node=>String(node.textContent||'').trim().toLocaleLowerCase('es-CL')==='entidades');
    target?.click();
  }

  document.addEventListener('click',event=>{
    const button=event.target.closest?.('[data-a951-back]');
    if(button)goBackToEntities(event);
  });
  document.addEventListener('atlas:entity-workspace-ready',scheduleEnhance);
  window.addEventListener('popstate',scheduleEnhance);

  const observer=new MutationObserver(scheduleEnhance);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  scheduleEnhance();

  window.__ATLAS_ENTITY_PRESS_VIEW_0951__={
    active:true,
    governance:'presentation-only; no automatic identity reconciliation',
    installedAt:new Date().toISOString()
  };
})();
