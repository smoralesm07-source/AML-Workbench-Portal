'use strict';

/* ATLAS AML · Entidad 360 route-scope authority · 2026-09-04
 *
 * Purpose
 * - Entity 360 is route-scoped UI, never shell-global UI.
 * - Leaving Entidades clears the selected Entity 360 identity and removes any
 *   stale Entity 360 surface that an older async callback/observer tries to paint.
 * - IPA remains transversal inside legitimate entity rows/cards, but an orphan
 *   shell-level IPA chip/strip is removed outside the Entidad 360 route.
 *
 * This authority is presentation/lifecycle only. It does not change Supabase,
 * RLS, Auth, scoring formulas, entity joins or materialized analytical data.
 */
(function atlasEntity360ScopeAuthority20260904(){
  const BUILD='20260904-e360-scope2';
  const AUTHORITY='ENTITY360_ROUTE_SCOPE_AUTHORITY_20260904';
  const ENTITY_VIEWS=new Set(['entities','entity','entity360']);
  const ENTITY_ONLY_SELECTOR=[
    '#atlas-entity360-executive',
    '#a47-entity-search-host',
    '.e360-history-host',
    '[data-e360-variant]',
    '[data-atlas-entity360-only]',
    '[data-entity360]',
    '.v038-entity',
    '.v0203-entity',
    '.a45'
  ].join(',');
  const IPA_CONTEXT_SELECTOR=[
    'article','tr','td','li',
    '[data-so-entity]','[data-open-so]','[data-open-entity]',
    '[data-v0205-entity]','[data-v024-cross-entity]',
    '[data-v024-sanction-entity]','[data-entity-id]',
    '[data-v028-entity-root]','[data-aex-open]','[data-aex-peek]',
    '[data-aex-suggest-id]'
  ].join(',');
  const IPA_TEXT_RE=/^ipa(?:\s*3(?:\.0)?)?\s+\d+(?:[.,]\d+)?\s*[·•\-]\s*(?:baja|media|alta|muy\s+alta)$/i;
  let queued=false;
  let observer=null;
  let lastInactiveReason='';

  const norm=v=>String(v??'').trim().toLowerCase();
  const compactText=v=>String(v??'').trim().replace(/\s+/g,' ');

  function canonicalState(){
    try{if(typeof state!=='undefined'&&state)return state;}catch(_error){}
    if(window.state)return window.state;
    return window.amlState||null;
  }

  function allStates(){
    const rows=[];
    try{if(typeof state!=='undefined'&&state)rows.push(state);}catch(_error){}
    try{if(window.state)rows.push(window.state);}catch(_error){}
    try{if(window.amlState)rows.push(window.amlState);}catch(_error){}
    return [...new Set(rows.filter(Boolean))];
  }

  function currentView(){
    const s=canonicalState();
    return norm(s?.view||s?.route||s?.currentView||'');
  }

  function isEntityActive(){
    /* Positive-only rule: an empty/unknown route never authorizes Entidad 360.
       This intentionally reverses the historical `!view || entities` behavior
       that allowed stale dossiers to become shell-global. */
    const view=currentView();
    return !!view&&ENTITY_VIEWS.has(view);
  }

  function selectedEntityId(){
    const s=canonicalState();
    return s?.selectedEntity||window.__ATLAS_ENTITY360_CURRENT__?.entityId||window.__ATLAS_ENTITY360_CURRENT__?.selectedEntity||null;
  }

  function clearEntityRouteState(reason='route-left'){
    for(const s of allStates()){
      try{s.selectedEntity=null;}catch(_error){}
      try{if('entityId' in s)s.entityId=null;}catch(_error){}
      try{if('selectedEntityId' in s)s.selectedEntityId=null;}catch(_error){}
    }

    const current=window.__ATLAS_ENTITY360_CURRENT__||{};
    window.__ATLAS_ENTITY360_CURRENT__={
      ...current,
      mode:'inactive-outside-entity-route',
      selectedEntity:null,
      entityId:null,
      pressEntityId:null,
      routeActive:false,
      deactivatedBy:AUTHORITY,
      deactivatedReason:reason,
      deactivatedAt:new Date().toISOString()
    };
    lastInactiveReason=reason;
  }

  function boundedAncestor(el,maxHeight){
    let node=el,candidate=el;
    while(node&&node!==document.body&&node.id!=='app'&&node.id!=='content'){
      const rect=node.getBoundingClientRect?.();
      const h=rect?.height||0;
      const text=compactText(node.textContent);
      if(h>0&&h<=maxHeight&&text.length<900&&node.children.length<=12)candidate=node;
      else if(h>maxHeight)break;
      node=node.parentElement;
    }
    return candidate;
  }

  function exactTextAncestor(el,maxHeight){
    const wanted=compactText(el?.textContent);
    let node=el,candidate=el;
    while(node&&node!==document.body&&node.id!=='app'&&node.id!=='content'){
      if(compactText(node.textContent)!==wanted)break;
      const h=node.getBoundingClientRect?.().height||0;
      if(h>0&&h<=maxHeight&&node.children.length<=4)candidate=node;
      else if(h>maxHeight)break;
      node=node.parentElement;
    }
    return candidate;
  }

  function purgeEntityOnlySurfaces(){
    let removed=0;
    document.querySelectorAll(ENTITY_ONLY_SELECTOR).forEach(node=>{
      if(!node?.isConnected)return;
      node.remove();removed++;
    });

    /* Compatibility fallback for the small historical status banner whose
       classes changed between Entity 360 builds. It is intentionally bounded
       so a module page/container can never be removed by text matching. */
    document.querySelectorAll('strong,b,h1,h2,h3,span,p').forEach(node=>{
      if(!node?.isConnected)return;
      const text=norm(node.textContent).replace(/\s+/g,' ');
      if(!text.includes('entidad 360 renovada'))return;
      const shell=boundedAncestor(node,180);
      if(shell&&shell.id!=='app'&&shell.id!=='content'){
        shell.remove();removed++;
      }
    });
    return removed;
  }

  function isContextualIpa(el){
    return !!el?.closest?.(IPA_CONTEXT_SELECTOR);
  }

  function purgeOrphanIpa(){
    let removed=0;

    /* Primary path: IPA3 chips created by the transversal IPA authority. Keep
       them inside entity rows/cards; remove only shell-level orphan chips.
       The wrapper is removed only when it contains exactly the same IPA text,
       so a topbar or unrelated shell can never disappear with the chip. */
    document.querySelectorAll('.v028-ipa3-chip,[data-v028-ipa-entity]').forEach(el=>{
      if(!el?.isConnected||isContextualIpa(el))return;
      const shell=exactTextAncestor(el,64);
      if(shell&&shell.id!=='app'&&shell.id!=='content'){
        shell.remove();removed++;
      }
    });

    /* Historical fallback for the white `IPA 9.0 · Baja` strip. Restrict the
       scan to leaf-ish elements and exact-text wrappers, avoiding analytical
       cards/tables that legitimately contain IPA alongside other content. */
    document.querySelectorAll('span,b,strong,small,div').forEach(el=>{
      if(!el?.isConnected||el.children.length>3||isContextualIpa(el))return;
      const text=compactText(el.textContent);
      if(!IPA_TEXT_RE.test(text))return;
      const shell=exactTextAncestor(el,64);
      if(shell&&shell.id!=='app'&&shell.id!=='content'){
        shell.remove();removed++;
      }
    });
    return removed;
  }

  function enforce(reason='enforce'){
    if(isEntityActive()){
      document.documentElement.removeAttribute('data-entity360-scope-inactive');
      return {active:true,view:currentView(),entityId:selectedEntityId()};
    }

    clearEntityRouteState(reason);
    const entityRemoved=purgeEntityOnlySurfaces();
    const ipaRemoved=purgeOrphanIpa();
    document.documentElement.setAttribute('data-entity360-scope-inactive','true');
    window.__ATLAS_ENTITY360_SCOPE_LAST__={
      active:false,
      view:currentView()||null,
      reason,
      entityRemoved,
      ipaRemoved,
      checkedAt:new Date().toISOString()
    };
    return window.__ATLAS_ENTITY360_SCOPE_LAST__;
  }

  function schedule(reason='scheduled'){
    if(queued)return;
    queued=true;
    queueMicrotask(()=>{
      queued=false;
      enforce(reason);
    });
  }

  function routeToken(target){
    const node=target?.closest?.('[data-view],[data-route],[data-app]');
    if(!node)return '';
    return norm(node.dataset.view||node.dataset.route||node.dataset.app||'');
  }

  function installNavigationBoundary(){
    document.addEventListener('click',event=>{
      const route=routeToken(event.target);
      if(!route||ENTITY_VIEWS.has(route))return;
      /* Clear the old entity synchronously in capture phase, before historical
         observers have a chance to heal/repaint the old dossier. */
      clearEntityRouteState(`navigation:${route}`);
      queueMicrotask(()=>enforce(`navigation-settle:${route}`));
    },true);

    ['atlas:navigate','atlas:routechange','atlas:nav-refresh','atlas:app-changed'].forEach(name=>{
      window.addEventListener(name,()=>schedule(name));
      document.addEventListener(name,()=>schedule(name));
    });
    window.addEventListener('popstate',()=>schedule('popstate'));
    window.addEventListener('hashchange',()=>schedule('hashchange'));
    window.addEventListener('pageshow',()=>schedule('pageshow'));
  }

  function installMutationGuard(){
    if(observer)return;
    observer=new MutationObserver(()=>{
      if(isEntityActive())return;
      /* Run synchronously in the mutation callback. Existing Entidad 360 polish
         observers schedule their heal in a microtask; clearing first makes late
         async paint id-less, then the purge removes anything already inserted. */
      clearEntityRouteState('non-entity-dom-mutation');
      purgeEntityOnlySurfaces();
      purgeOrphanIpa();
    });
    observer.observe(document.documentElement,{childList:true,subtree:true});
  }

  installNavigationBoundary();
  installMutationGuard();
  enforce('install');
  [0,80,220,600,1400,3000].forEach(ms=>setTimeout(()=>enforce(`settle-${ms}`),ms));

  window.__ATLAS_ENTITY360_SCOPE_AUTHORITY__={
    active:true,
    build:BUILD,
    authority:AUTHORITY,
    policy:'ENTITY360_ONLY_ON_POSITIVE_ENTITY_ROUTE',
    orphanIpaPolicy:'REMOVE_SHELL_ORPHANS_KEEP_CONTEXTUAL_IPA',
    isEntityActive,
    enforce,
    getLastInactiveReason:()=>lastInactiveReason,
    installedAt:new Date().toISOString()
  };
})();
