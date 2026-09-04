'use strict';

/* ATLAS AML 0.44.8 · Entity route authority
 *
 * 2026-09-04 advanced explorer restoration
 * -----------------------------------------
 * Entidades keeps a hard fresh-start boundary when the analyst enters from the
 * principal menu, but the boundary MUST preserve the current .aex explorer.
 * The previous hardening captured the older 0447 workspace loader and then
 * cleared #content after load. That forced the legacy inline-autocomplete view
 * and erased the 0512 + Identidad Digital surface that is loaded later.
 *
 * This authority now resolves ENTRY.load dynamically at navigation time. Once
 * 0510/0512 are installed, the menu therefore enters the governed advanced
 * explorer (including the Entidad | Identidad digital selector). Cleanup only
 * removes stale Entity 360 dossier surfaces; it never deletes a live .aex.
 *
 * Auth, Supabase session state, RLS, scores and analytical semantics are not
 * modified.
 */
(function atlasEntityRouteAuthority0448(){
  const RELEASE='0.44.8';
  const BUILD='0448-advanced-20260904';
  const PATCH='ENTITIES_HARD_CLEAN_BOUNDARY_20260904';
  const ADVANCED_PATCH='ADVANCED_ENTITY_EXPLORER_PRESERVED_20260904';
  const ENTRY=window.__ATLAS_ENTITY_ENTRY__;
  if(!ENTRY||typeof ENTRY.load!=='function'){
    window.__ATLAS_ENTITY_ROUTE_0448__={active:false,reason:'entity-entry-unavailable',installedAt:new Date().toISOString()};
    return;
  }

  const previousNavigate=typeof window.navigate==='function'?window.navigate:null;
  const fallbackEntityLoad=ENTRY.load.bind(ENTRY);
  let cleanEpoch=0;

  function entityContent(){
    try{if(typeof v019Content==='function')return v019Content();}catch(_error){}
    return document.querySelector('#content');
  }

  function allKnownStates(){
    const rows=[];
    try{if(typeof state!=='undefined'&&state)rows.push(state);}catch(_error){}
    try{if(window.state)rows.push(window.state);}catch(_error){}
    try{if(window.amlState)rows.push(window.amlState);}catch(_error){}
    return [...new Set(rows.filter(Boolean))];
  }

  function selectedEntityId(){
    for(const s of allKnownStates())if(s?.selectedEntity)return String(s.selectedEntity);
    const current=window.__ATLAS_ENTITY360_CURRENT__||{};
    return current.entityId||current.selectedEntity||null;
  }

  function setCleanBoundary(active,reason=''){
    const current=window.__ATLAS_ENTITIES_CLEAN_BOUNDARY__||{};
    window.__ATLAS_ENTITIES_CLEAN_BOUNDARY__={
      ...current,active:!!active,epoch:cleanEpoch,reason,patch:PATCH,
      advancedPatch:ADVANCED_PATCH,updatedAt:new Date().toISOString()
    };
  }

  function clearPriorEntityState(reason='entities-entry'){
    cleanEpoch+=1;
    for(const s of allKnownStates()){
      try{s.view='entities';s.selectedEntity=null;}catch(_error){}
      try{if('entityId' in s)s.entityId=null;}catch(_error){}
      try{if('selectedEntityId' in s)s.selectedEntityId=null;}catch(_error){}
    }
    window.__ATLAS_ENTITY360_CURRENT__={
      ...(window.__ATLAS_ENTITY360_CURRENT__||{}),
      mode:'entities-clean-search-boundary',selectedEntity:null,entityId:null,
      pressEntityId:null,cleanEntry:true,hardBoundary:true,patch:PATCH,
      advancedExplorerPreserved:true,renderedAt:new Date().toISOString()
    };
    setCleanBoundary(true,reason);
    try{document.querySelector('#a47-entity-search-host')?.remove();}catch(_error){}
    const c=entityContent();
    if(c)try{c.replaceChildren();}catch(_error){c.innerHTML='';}
  }

  function normalizeEntityShell(){
    try{
      const top=document.querySelector('.v019-top > strong');
      if(top)top.textContent='Entidades';
      const title=document.querySelector('.v019-title h1');
      if(title)title.textContent='Entidades';
      const subtitle=document.querySelector('.v019-title p');
      if(subtitle)subtitle.textContent='Explora entidades por nombre o RUT, o cambia a Identidad digital para investigar aliases públicos con los motores OSINT de ATLAS.';
    }catch(_error){}
  }

  function resetAdvancedExplorer(root){
    if(!root)return false;
    const input=root.querySelector('#aex-q');
    const suggest=root.querySelector('#aex-suggest');
    if(suggest){suggest.innerHTML='';suggest.classList.remove('open');}

    /* 0512 renders a fresh prequery itself. We avoid replacing its DOM; the
       digital extension sees the new .aex through its MutationObserver and
       rebinds the Entidad | Identidad digital selector automatically. */
    const entityMode=root.querySelector('[data-aex-search-mode="entity"]');
    const aliasMode=root.querySelector('[data-aex-search-mode="alias"]');
    if(aliasMode?.classList.contains('active')&&entityMode){
      try{entityMode.click();}catch(_error){}
    }
    if(input){
      input.disabled=false;
      input.removeAttribute('aria-activedescendant');
      setTimeout(()=>input.focus(),0);
    }
    return true;
  }

  function removeStaleEntityDossiers(content){
    if(!content)return;
    content.querySelectorAll('#atlas-entity360-executive,.a45,.aed-dossier,.v0203-entity,.v038-entity,[data-entity360]')
      .forEach(node=>{if(!node.closest('.aex'))node.remove();});
  }

  function enforceCleanSearchSurface(reason='normalize'){
    for(const s of allKnownStates()){
      try{s.view='entities';s.selectedEntity=null;}catch(_error){}
    }

    const c=entityContent();
    const advanced=c?.querySelector?.('.aex')||null;
    if(advanced){
      /* Current path: preserve the full 0512 explorer and its digital mode. */
      removeStaleEntityDossiers(c);
      document.querySelector('#a47-entity-search-host')?.remove();
      resetAdvancedExplorer(advanced);
    }else{
      /* Compatibility fallback: only the old 0447 host exists. Do not create a
         legacy dossier, but keep its search field usable if advanced scripts
         failed to initialize for an unrelated reason. */
      if(c)try{c.replaceChildren();}catch(_error){c.innerHTML='';}
      const host=document.querySelector('#a47-entity-search-host');
      if(host){
        host.classList.remove('busy');host.classList.add('a47-clean-entry');
        const copy=host.querySelector('.a47-search-copy');
        const eyebrow=copy?.querySelector('span');
        const heading=copy?.querySelector('strong');
        if(eyebrow)eyebrow.textContent='ENTIDADES · BÚSQUEDA';
        if(heading)heading.textContent='Buscar entidad';
        const input=host.querySelector('#a47-entity-q');
        if(input){input.value='';input.disabled=false;input.removeAttribute('aria-activedescendant');}
        const status=host.querySelector('#a47-search-status');
        if(status)status.textContent='Escribe al menos 2 caracteres para recibir sugerencias.';
        const selected=host.querySelector('#a47-selected');if(selected)selected.innerHTML='';
        const suggestions=host.querySelector('#a47-suggestions');
        if(suggestions){suggestions.innerHTML='';suggestions.hidden=true;}
        host.querySelector('.a47-combobox')?.setAttribute('aria-expanded','false');
        setTimeout(()=>input?.focus(),0);
      }
    }

    normalizeEntityShell();
    window.__ATLAS_ENTITY360_CURRENT__={
      ...(window.__ATLAS_ENTITY360_CURRENT__||{}),
      mode:'entities-clean-search-boundary',selectedEntity:null,entityId:null,
      pressEntityId:null,cleanEntry:true,hardBoundary:true,patch:PATCH,
      advancedExplorerPreserved:!!advanced,renderedAt:new Date().toISOString()
    };
    setCleanBoundary(true,reason);
  }

  function currentEntityLoader(){
    /* The 0510/0512 assets are intentionally loaded after this compiled
       authority in current Pages. Resolve ENTRY.load at click time so the menu
       uses the newest installed explorer instead of the historical 0447 closure. */
    const live=ENTRY.load;
    return typeof live==='function'&&live!==entityLoad?live.bind(ENTRY):fallbackEntityLoad;
  }

  async function entityLoad(...args){
    clearPriorEntityState('route-load');
    let result;
    try{
      result=await currentEntityLoader()(...args);
    }finally{
      enforceCleanSearchSurface('route-load-complete');
      queueMicrotask(()=>{
        if(window.__ATLAS_ENTITIES_CLEAN_BOUNDARY__?.active)enforceCleanSearchSurface('route-load-microtask');
      });
      requestAnimationFrame(()=>{
        if(window.__ATLAS_ENTITIES_CLEAN_BOUNDARY__?.active)enforceCleanSearchSurface('route-load-frame');
      });
      setTimeout(()=>{
        if(window.__ATLAS_ENTITIES_CLEAN_BOUNDARY__?.active)enforceCleanSearchSurface('route-load-settle');
      },80);
    }
    return result;
  }

  async function navigate0448(view,...args){
    if(view==='entities')return entityLoad(...args);
    if(previousNavigate)return previousNavigate(view,...args);
  }

  function entitiesMenuTrigger(target){
    const el=target?.closest?.('[data-view="entities"]');
    if(!el)return null;
    return el.closest('nav,[role="navigation"],.v019-side,.atlas-mobile-nav')?el:null;
  }

  function installDirectMenuBoundary(){
    if(window.__ATLAS_ENTITIES_DIRECT_MENU_BOUNDARY_0448__)return;
    const onClick=e=>{
      const trigger=entitiesMenuTrigger(e.target);
      if(!trigger)return;
      e.preventDefault();e.stopImmediatePropagation();void entityLoad();
    };
    const onSelection=e=>{
      if(e.target?.closest?.('.a47-suggestion,[data-aex-open],[data-aex-suggest-id]'))setCleanBoundary(false,'explicit-entity-selection');
    };
    const onKey=e=>{
      if(e.key==='Enter'&&e.target?.matches?.('#a47-entity-q'))setCleanBoundary(false,'explicit-search-enter');
    };
    document.addEventListener('click',onClick,true);
    document.addEventListener('click',onSelection,true);
    document.addEventListener('keydown',onKey,true);
    window.__ATLAS_ENTITIES_DIRECT_MENU_BOUNDARY_0448__={active:true,patch:PATCH,advancedPatch:ADVANCED_PATCH,installedAt:new Date().toISOString()};
  }

  function installLatePaintGuard(){
    if(window.__ATLAS_ENTITIES_LATE_PAINT_GUARD_0448__)return;
    const root=document.querySelector('#app')||document.body;if(!root)return;
    let queued=false;
    const observer=new MutationObserver(()=>{
      if(queued||!window.__ATLAS_ENTITIES_CLEAN_BOUNDARY__?.active)return;
      queued=true;
      queueMicrotask(()=>{
        queued=false;
        if(!window.__ATLAS_ENTITIES_CLEAN_BOUNDARY__?.active)return;
        if(selectedEntityId()){setCleanBoundary(false,'new-entity-selected');return;}
        const c=entityContent();if(!c)return;
        const stale=c.querySelector('#atlas-entity360-executive,.a45,.aed-dossier,.v0203-entity,.v038-entity,[data-entity360]');
        if(stale)enforceCleanSearchSurface('late-entity360-paint-rejected');
      });
    });
    observer.observe(root,{childList:true,subtree:true});
    window.__ATLAS_ENTITIES_LATE_PAINT_GUARD_0448__={active:true,patch:PATCH,advancedPatch:ADVANCED_PATCH,observer,installedAt:new Date().toISOString()};
  }

  try{navigate=navigate0448;}catch(_error){}
  window.navigate=navigate0448;
  try{loadEntities=entityLoad;}catch(_error){}
  window.loadEntities=entityLoad;
  ENTRY.load=entityLoad;

  ENTRY.version='0448';
  ENTRY.release=RELEASE;
  ENTRY.routeAuthority='ENTITY360_ROUTE_AUTHORITY_0448';
  ENTRY.legacyLandingBypassed=true;
  ENTRY.entitiesEntryPolicy='HARD_CLEAN_SEARCH_NO_PERSISTED_ENTITY360+ADVANCED_EXPLORER_PRESERVED';

  installDirectMenuBoundary();
  installLatePaintGuard();

  ENTRY.open=(function(baseOpen){
    return async function openWithCleanBoundaryRelease(...args){
      setCleanBoundary(false,'entity-open');
      return baseOpen.apply(this,args);
    };
  })(ENTRY.open);

  window.__ATLAS_ENTITY_ROUTE_0448__={
    active:true,release:RELEASE,build:BUILD,patch:PATCH,advancedPatch:ADVANCED_PATCH,
    authority:'ENTITY360_ROUTE_AUTHORITY_0448',
    entitiesRoute:'HARD_CLEAN_SEARCH_CURRENT_ENTRY',
    cleanSearchOnEveryEntry:true,directMenuCapture:true,latePaintGuard:true,
    previousEntityCleared:true,legacyCapturedLoaderBypassed:true,
    dynamicEntryLoader:true,advancedExplorerPreserved:true,digitalIdentityPreserved:true,
    authMutation:false,installedAt:new Date().toISOString()
  };
})();