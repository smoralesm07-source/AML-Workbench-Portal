'use strict';

/* ATLAS AML · Entidad 360 route-scope authority · 2026-09-04
 * Presentation/lifecycle authority only. Does not change Supabase, RLS, Auth,
 * scoring, joins or materialized analytical data.
 */
(function atlasEntity360ScopeAuthority20260904(){
  const BUILD='20260904-e360-scope3-status-es';
  const AUTHORITY='ENTITY360_ROUTE_SCOPE_AUTHORITY_20260904';
  const ENTITY_VIEWS=new Set(['entities','entity','entity360']);
  const ENTITY_ONLY_SELECTOR=[
    '#atlas-entity360-executive','#a47-entity-search-host','.e360-history-host',
    '[data-e360-variant]','[data-atlas-entity360-only]','[data-entity360]',
    '.v038-entity','.v0203-entity','.a45'
  ].join(',');
  const IPA_CONTEXT_SELECTOR=[
    'article','tr','td','li','[data-so-entity]','[data-open-so]','[data-open-entity]',
    '[data-v0205-entity]','[data-v024-cross-entity]','[data-v024-sanction-entity]',
    '[data-entity-id]','[data-v028-entity-root]','[data-aex-open]','[data-aex-peek]',
    '[data-aex-suggest-id]'
  ].join(',');
  const IPA_TEXT_RE=/^ipa(?:\s*3(?:\.0)?)?\s+\d+(?:[.,]\d+)?\s*[·•\-]\s*(?:baja|media|alta|muy\s+alta)$/i;
  let queued=false,observer=null,lastInactiveReason='';

  const norm=v=>String(v??'').trim().toLowerCase();
  const compactText=v=>String(v??'').trim().replace(/\s+/g,' ');
  const statusKey=v=>compactText(v).toLowerCase().replace(/[_.-]+/g,' ').replace(/\s+/g,' ');

  function canonicalState(){
    try{if(typeof state!=='undefined'&&state)return state;}catch(_error){}
    return window.state||window.amlState||null;
  }
  function allStates(){
    const rows=[];
    try{if(typeof state!=='undefined'&&state)rows.push(state);}catch(_error){}
    try{if(window.state)rows.push(window.state);}catch(_error){}
    try{if(window.amlState)rows.push(window.amlState);}catch(_error){}
    return [...new Set(rows.filter(Boolean))];
  }
  function currentView(){const s=canonicalState();return norm(s?.view||s?.route||s?.currentView||'');}
  function isEntityActive(){const view=currentView();return !!view&&ENTITY_VIEWS.has(view);}
  function selectedEntityId(){
    const s=canonicalState();
    return s?.selectedEntity||window.__ATLAS_ENTITY360_CURRENT__?.entityId||window.__ATLAS_ENTITY360_CURRENT__?.selectedEntity||null;
  }

  function statusCopy(raw){
    const key=statusKey(raw);
    if(!key)return null;
    if(key==='sii no materializado')return {label:'Estado tributario no disponible',detail:'No hay un estado tributario SII materializado para esta entidad.'};
    if(key==='perfil tributario disponible')return {label:'Perfil tributario disponible',detail:'La entidad cuenta con información tributaria disponible para revisión.'};
    if((/terminated|closed|ceased|inactive|ended/.test(key))&&/published/.test(key))return {label:'Publicada · sin actividad vigente',detail:'El perfil está publicado, pero la entidad no registra actividad vigente.'};
    if((/active|open|current/.test(key))&&/published/.test(key))return {label:'Publicada · actividad vigente',detail:'El perfil está publicado y la entidad registra actividad vigente.'};
    if(/terminated|closed|ceased|inactive|ended|deregistered/.test(key))return {label:'Sin actividad vigente',detail:'La entidad registra término, cese o ausencia de actividad vigente.'};
    if(/suspend/.test(key))return {label:'Actividad suspendida',detail:'La entidad registra una condición de actividad suspendida.'};
    if(/cancel/.test(key))return {label:'Registro cancelado',detail:'La entidad registra una condición de cancelación.'};
    if(/active|open|current/.test(key))return {label:'Actividad vigente',detail:'La entidad registra actividad vigente.'};
    if(/published/.test(key))return {label:'Perfil publicado',detail:'La ficha Entidad 360 está publicada y disponible para revisión.'};
    if(/processing|loading|pending|updating/.test(key))return {label:'Actualización en curso',detail:'La información de la entidad se está consolidando.'};
    if(/draft/.test(key))return {label:'Perfil en preparación',detail:'La ficha fue identificada y aún está en proceso de consolidación.'};
    if(/warning|review|observed/.test(key))return {label:'Perfil con observaciones',detail:'La ficha contiene antecedentes que requieren revisión.'};
    if(/partial/.test(key))return {label:'Información parcial',detail:'La ficha está disponible, pero algunas fuentes presentan información parcial.'};
    if(/empty|no data|not found/.test(key))return {label:'Información insuficiente',detail:'No hay información suficiente para completar el estado de la entidad.'};
    if(/error|failed|failure/.test(key))return {label:'Error de carga',detail:'No fue posible completar la carga del estado de la entidad.'};
    if(/vigente|tributari|materializ|actividad|perfil|publicad|suspendid|cancelad|termin|cesad|inactiv|sin actividad|no disponible/.test(key))return {label:compactText(raw),detail:compactText(raw)};
    return {label:'Estado por confirmar',detail:'El estado registrado requiere revisión en la fuente de origen.'};
  }

  function localizeEntityStatuses(){
    let changed=0;
    document.querySelectorAll('#atlas-entity360-executive .eh-status').forEach(el=>{
      const visible=compactText(el.textContent);
      const raw=(el.dataset.e360StatusEs===visible&&el.dataset.e360RawStatus)?el.dataset.e360RawStatus:visible;
      const copy=statusCopy(raw);if(!copy)return;
      el.dataset.e360RawStatus=raw;
      el.dataset.e360StatusEs=copy.label;
      if(visible!==copy.label){el.textContent=copy.label;changed++;}
      el.lang='es';
      el.setAttribute('aria-label',`Estado de la entidad: ${copy.detail}`);
      el.setAttribute('title',copy.detail);
    });
    return changed;
  }

  function clearEntityRouteState(reason='route-left'){
    for(const s of allStates()){
      try{s.selectedEntity=null;}catch(_error){}
      try{if('entityId' in s)s.entityId=null;}catch(_error){}
      try{if('selectedEntityId' in s)s.selectedEntityId=null;}catch(_error){}
    }
    const current=window.__ATLAS_ENTITY360_CURRENT__||{};
    window.__ATLAS_ENTITY360_CURRENT__={...current,mode:'inactive-outside-entity-route',selectedEntity:null,entityId:null,pressEntityId:null,routeActive:false,deactivatedBy:AUTHORITY,deactivatedReason:reason,deactivatedAt:new Date().toISOString()};
    lastInactiveReason=reason;
  }

  function boundedAncestor(el,maxHeight){
    let node=el,candidate=el;
    while(node&&node!==document.body&&node.id!=='app'&&node.id!=='content'){
      const h=node.getBoundingClientRect?.().height||0,text=compactText(node.textContent);
      if(h>0&&h<=maxHeight&&text.length<900&&node.children.length<=12)candidate=node;
      else if(h>maxHeight)break;
      node=node.parentElement;
    }
    return candidate;
  }
  function exactTextAncestor(el,maxHeight){
    const wanted=compactText(el?.textContent);let node=el,candidate=el;
    while(node&&node!==document.body&&node.id!=='app'&&node.id!=='content'){
      if(compactText(node.textContent)!==wanted)break;
      const h=node.getBoundingClientRect?.().height||0;
      if(h>0&&h<=maxHeight&&node.children.length<=4)candidate=node;else if(h>maxHeight)break;
      node=node.parentElement;
    }
    return candidate;
  }
  function purgeEntityOnlySurfaces(){
    let removed=0;
    document.querySelectorAll(ENTITY_ONLY_SELECTOR).forEach(node=>{if(node?.isConnected){node.remove();removed++;}});
    document.querySelectorAll('strong,b,h1,h2,h3,span,p').forEach(node=>{
      if(!node?.isConnected)return;
      const text=norm(node.textContent).replace(/\s+/g,' ');if(!text.includes('entidad 360 renovada'))return;
      const shell=boundedAncestor(node,180);if(shell&&shell.id!=='app'&&shell.id!=='content'){shell.remove();removed++;}
    });
    return removed;
  }
  function isContextualIpa(el){return !!el?.closest?.(IPA_CONTEXT_SELECTOR);}
  function purgeOrphanIpa(){
    let removed=0;
    document.querySelectorAll('.v028-ipa3-chip,[data-v028-ipa-entity]').forEach(el=>{
      if(!el?.isConnected||isContextualIpa(el))return;
      const shell=exactTextAncestor(el,64);if(shell&&shell.id!=='app'&&shell.id!=='content'){shell.remove();removed++;}
    });
    document.querySelectorAll('span,b,strong,small,div').forEach(el=>{
      if(!el?.isConnected||el.children.length>3||isContextualIpa(el))return;
      if(!IPA_TEXT_RE.test(compactText(el.textContent)))return;
      const shell=exactTextAncestor(el,64);if(shell&&shell.id!=='app'&&shell.id!=='content'){shell.remove();removed++;}
    });
    return removed;
  }

  function enforce(reason='enforce'){
    if(isEntityActive()){
      document.documentElement.removeAttribute('data-entity360-scope-inactive');
      const statusesLocalized=localizeEntityStatuses();
      return {active:true,view:currentView(),entityId:selectedEntityId(),statusesLocalized};
    }
    clearEntityRouteState(reason);
    const entityRemoved=purgeEntityOnlySurfaces(),ipaRemoved=purgeOrphanIpa();
    document.documentElement.setAttribute('data-entity360-scope-inactive','true');
    window.__ATLAS_ENTITY360_SCOPE_LAST__={active:false,view:currentView()||null,reason,entityRemoved,ipaRemoved,checkedAt:new Date().toISOString()};
    return window.__ATLAS_ENTITY360_SCOPE_LAST__;
  }
  function schedule(reason='scheduled'){
    if(queued)return;queued=true;queueMicrotask(()=>{queued=false;enforce(reason);});
  }
  function routeToken(target){
    const node=target?.closest?.('[data-view],[data-route],[data-app]');
    return node?norm(node.dataset.view||node.dataset.route||node.dataset.app||''):'';
  }
  function installNavigationBoundary(){
    document.addEventListener('click',event=>{
      const route=routeToken(event.target);if(!route||ENTITY_VIEWS.has(route))return;
      clearEntityRouteState(`navigation:${route}`);queueMicrotask(()=>enforce(`navigation-settle:${route}`));
    },true);
    ['atlas:navigate','atlas:routechange','atlas:nav-refresh','atlas:app-changed'].forEach(name=>{
      window.addEventListener(name,()=>schedule(name));document.addEventListener(name,()=>schedule(name));
    });
    window.addEventListener('popstate',()=>schedule('popstate'));
    window.addEventListener('hashchange',()=>schedule('hashchange'));
    window.addEventListener('pageshow',()=>schedule('pageshow'));
  }
  function installMutationGuard(){
    if(observer)return;
    observer=new MutationObserver(()=>{
      if(isEntityActive()){localizeEntityStatuses();return;}
      clearEntityRouteState('non-entity-dom-mutation');purgeEntityOnlySurfaces();purgeOrphanIpa();
    });
    observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  }

  installNavigationBoundary();installMutationGuard();enforce('install');
  [0,80,220,600,1400,3000].forEach(ms=>setTimeout(()=>enforce(`settle-${ms}`),ms));

  window.__ATLAS_ENTITY360_SCOPE_AUTHORITY__={
    active:true,build:BUILD,authority:AUTHORITY,
    policy:'ENTITY360_ONLY_ON_POSITIVE_ENTITY_ROUTE',
    orphanIpaPolicy:'REMOVE_SHELL_ORPHANS_KEEP_CONTEXTUAL_IPA',
    statusLanguagePolicy:'SPANISH_EXPLICIT_MEANING_NOT_COLOR_DEPENDENT',
    isEntityActive,enforce,localizeEntityStatuses,
    getLastInactiveReason:()=>lastInactiveReason,
    installedAt:new Date().toISOString()
  };
})();
