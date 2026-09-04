'use strict';

/* ATLAS AML · Entidad 360 route-scope authority · 2026-09-04
 * Presentation/lifecycle authority only. Does not change Supabase, RLS, Auth,
 * scoring, joins or materialized analytical data.
 */
(function atlasEntity360ScopeAuthority20260904(){
  const BUILD='20260904-e360-scope4-loading';
  const AUTHORITY='ENTITY360_ROUTE_SCOPE_AUTHORITY_20260904';
  const ENTITY_VIEWS=new Set(['entities','entity','entity360']);
  const HISTORY_VARIANT='HISTORY_INTELLIGENCE_ATLAS_V1';
  const LOADER_ID='atlas-entity360-loading';
  const LOADER_STYLE_ID='atlas-entity360-loading-style';
  const MIN_LOADER_MS=520;
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
  let loadingObserver=null,loadingTimeout=null,loadingSlowTimer=null,loadingHideTimer=null,loadingStartedAt=0;

  const norm=v=>String(v??'').trim().toLowerCase();
  const compactText=v=>String(v??'').trim().replace(/\s+/g,' ');
  const statusKey=v=>compactText(v).toLowerCase().replace(/[_.-]+/g,' ').replace(/\s+/g,' ');
  const now=()=>new Date().toISOString();

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

  /* ------------------------------------------------------------------
   * Entidad 360 loading state
   * ------------------------------------------------------------------
   * The history authority deliberately mounts a null package before fetching
   * the governed sources. Without an explicit loading state, those temporary
   * blanks look like real absence. This bridge is compiled in the same runtime
   * authority that already governs the route, so it cannot be omitted by the
   * canonical manifest. It uses the Entidades visual language (.aex-blank-icon)
   * and remains visible for a short minimum interval so the analyst perceives
   * the transition even when the cache resolves immediately.
   */
  function content(){
    try{if(typeof v019Content==='function')return v019Content();}catch(_error){}
    return document.querySelector('#content');
  }

  function ensureLoadingStyle(){
    if(document.getElementById(LOADER_STYLE_ID))return;
    const style=document.createElement('style');
    style.id=LOADER_STYLE_ID;
    style.textContent=`
      #${LOADER_ID}{position:fixed;z-index:96;left:224px;right:0;top:54px;bottom:0;display:grid;place-items:center;padding:24px;background:rgba(7,17,29,.9);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)}
      #${LOADER_ID}[hidden]{display:none!important}
      #${LOADER_ID} .e360-loading-card{width:min(440px,calc(100vw - 44px));display:flex;flex-direction:column;align-items:center;text-align:center;padding:31px 28px 28px;border:1px solid var(--atlas-line,#1e3247);border-radius:16px;background:linear-gradient(180deg,var(--atlas-panel,#0c1725),var(--atlas-side,#08111c));box-shadow:0 24px 64px rgba(0,0,0,.35)}
      #${LOADER_ID} .aex-blank-icon.e360-loading-icon{position:relative;width:54px;height:54px;margin:0 0 15px;display:grid;place-items:center;border:1px solid var(--line,#26384b);border-radius:14px;background:var(--panel-2,#152334);color:var(--accent-hi,#5bb4f5)}
      #${LOADER_ID} .e360-loading-spinner{width:25px;height:25px;border:2px solid var(--atlas-line,#26384b);border-top-color:var(--atlas-accent-hi,#5bb4f5);border-right-color:var(--atlas-accent,#3b98e0);border-radius:50%;animation:atlasE360LoadingSpin .72s linear infinite}
      #${LOADER_ID} .e360-loading-eyebrow{font-size:9px;letter-spacing:.16em;text-transform:uppercase;font-weight:800;color:var(--atlas-faint,#5b7188)}
      #${LOADER_ID} h3{margin:7px 0 6px;color:var(--atlas-ink,#e6eef7);font-size:17px;font-weight:680}
      #${LOADER_ID} p{margin:0;max-width:380px;color:var(--atlas-muted,#8397ad);font-size:11.5px;line-height:1.55}
      #${LOADER_ID} .e360-loading-sources{display:flex;flex-wrap:wrap;justify-content:center;gap:5px;margin-top:15px}
      #${LOADER_ID} .e360-loading-sources span{border:1px solid var(--atlas-line,#1e3247);border-radius:999px;padding:4px 7px;background:var(--atlas-panel-lift,#122234);color:var(--atlas-ink2,#b3c4d5);font-size:8.5px;font-weight:700}
      #${LOADER_ID}.slow p:after{content:' La carga está tomando más tiempo de lo habitual.';color:var(--atlas-warn,#dcb445)}
      @keyframes atlasE360LoadingSpin{to{transform:rotate(360deg)}}
      @media(max-width:900px){#${LOADER_ID}{left:0}}
      @media(prefers-reduced-motion:reduce){#${LOADER_ID} .e360-loading-spinner{animation-duration:1.8s}}
    `;
    document.head.appendChild(style);
  }

  function loaderNode(){return document.getElementById(LOADER_ID);}

  function isHistoryHydrated(entityId=null){
    const host=document.querySelector('#atlas-entity360-executive');
    const st=window.__ATLAS_ENTITY360_EXECUTIVE_STATE__||{};
    if(!host||st.variant!==HISTORY_VARIANT||st.hydrated!==true)return false;
    if(entityId&&String(st.entityId||host.dataset?.entityId||'')!==String(entityId))return false;
    return true;
  }

  function stopLoadingWatch(){
    if(loadingObserver){try{loadingObserver.disconnect();}catch(_error){}loadingObserver=null;}
    if(loadingTimeout){clearTimeout(loadingTimeout);loadingTimeout=null;}
    if(loadingSlowTimer){clearTimeout(loadingSlowTimer);loadingSlowTimer=null;}
  }

  function finishHideLoading(reason='history-hydrated'){
    if(loadingHideTimer){clearTimeout(loadingHideTimer);loadingHideTimer=null;}
    stopLoadingWatch();
    loaderNode()?.remove();
    content()?.removeAttribute('aria-busy');
    window.__ATLAS_ENTITY360_LOADING__={active:false,reason,build:BUILD,endedAt:now()};
  }

  function hideLoading(reason='history-hydrated',immediate=false){
    const node=loaderNode();
    if(!node){stopLoadingWatch();return;}
    const remaining=immediate?0:Math.max(0,MIN_LOADER_MS-(Date.now()-loadingStartedAt));
    if(remaining>0){
      if(loadingHideTimer)clearTimeout(loadingHideTimer);
      loadingHideTimer=setTimeout(()=>finishHideLoading(reason),remaining);
      return;
    }
    finishHideLoading(reason);
  }

  function watchLoadingReadiness(entityId=null){
    stopLoadingWatch();
    const check=()=>{
      if(isHistoryHydrated(entityId)){hideLoading('history-hydrated');return true;}
      return false;
    };
    if(check())return;
    const app=document.querySelector('#app')||document.body;
    loadingObserver=new MutationObserver(()=>{check();});
    loadingObserver.observe(app,{childList:true,subtree:true,attributes:true});
    loadingSlowTimer=setTimeout(()=>loaderNode()?.classList.add('slow'),5500);
    loadingTimeout=setTimeout(()=>hideLoading('readiness-timeout',true),20000);
  }

  function showLoading(entityId=null){
    ensureLoadingStyle();
    if(loadingHideTimer){clearTimeout(loadingHideTimer);loadingHideTimer=null;}
    let node=loaderNode();
    if(!node){
      node=document.createElement('section');
      node.id=LOADER_ID;
      node.setAttribute('role','status');
      node.setAttribute('aria-live','polite');
      node.setAttribute('aria-label','Cargando Entidad 360');
      node.innerHTML=`<div class="e360-loading-card aex-state">
        <div class="aex-blank-icon e360-loading-icon" aria-hidden="true"><span class="e360-loading-spinner"></span></div>
        <span class="e360-loading-eyebrow">ENTIDAD 360</span>
        <h3>Cargando Entidad 360</h3>
        <p>Integrando antecedentes disponibles antes de mostrar la ficha. Los campos vacíos durante esta etapa todavía están en consulta.</p>
        <div class="e360-loading-sources" aria-hidden="true"><span>SII</span><span>UAF</span><span>Sanciones</span><span>RES</span><span>Compras públicas</span><span>Historia</span></div>
      </div>`;
      document.body.appendChild(node);
    }
    node.classList.remove('slow');
    loadingStartedAt=Date.now();
    content()?.setAttribute('aria-busy','true');
    window.__ATLAS_ENTITY360_LOADING__={active:true,entityId:entityId||null,build:BUILD,startedAt:now()};
    watchLoadingReadiness(entityId);
    return node;
  }

  function idFromOpenTrigger(trigger){
    return trigger?.dataset?.aexOpen||trigger?.dataset?.entityId||trigger?.dataset?.openEntity360||selectedEntityId()||null;
  }

  function installLoadingClickBridge(){
    if(window.__ATLAS_ENTITY360_LOADING_CLICK_BRIDGE__)return;
    document.addEventListener('click',event=>{
      const trigger=event.target?.closest?.('[data-aex-open],#aex-sheet-open,.a47-suggestion,[data-open-entity360]');
      if(!trigger)return;
      showLoading(idFromOpenTrigger(trigger));
    },true);
    window.__ATLAS_ENTITY360_LOADING_CLICK_BRIDGE__={active:true,build:BUILD,installedAt:now()};
  }

  function installLoadingEntryBridge(){
    const entry=window.__ATLAS_ENTITY_ENTRY__;
    if(!entry||typeof entry.open!=='function')return false;
    if(entry.open.__atlasE360LoadingBridge)return true;
    const base=entry.open;
    const wrapped=async function atlasEntity360OpenWithLoading(entityId,...rest){
      showLoading(entityId||selectedEntityId()||null);
      try{
        const result=await base.apply(this,[entityId,...rest]);
        if(isHistoryHydrated(entityId))hideLoading('entry-open-complete');
        return result;
      }catch(error){
        hideLoading('entry-open-error',true);
        throw error;
      }
    };
    wrapped.__atlasE360LoadingBridge=true;
    wrapped.__atlasE360LoadingBase=base;
    entry.open=wrapped;
    return true;
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
    window.__ATLAS_ENTITY360_CURRENT__={...current,mode:'inactive-outside-entity-route',selectedEntity:null,entityId:null,pressEntityId:null,routeActive:false,deactivatedBy:AUTHORITY,deactivatedReason:reason,deactivatedAt:now()};
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
    hideLoading('route-left',true);
    clearEntityRouteState(reason);
    const entityRemoved=purgeEntityOnlySurfaces(),ipaRemoved=purgeOrphanIpa();
    document.documentElement.setAttribute('data-entity360-scope-inactive','true');
    window.__ATLAS_ENTITY360_SCOPE_LAST__={active:false,view:currentView()||null,reason,entityRemoved,ipaRemoved,checkedAt:now()};
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
      hideLoading(`navigation:${route}`,true);
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
      hideLoading('non-entity-dom-mutation',true);
      clearEntityRouteState('non-entity-dom-mutation');purgeEntityOnlySurfaces();purgeOrphanIpa();
    });
    observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  }

  installNavigationBoundary();
  installMutationGuard();
  installLoadingClickBridge();
  installLoadingEntryBridge();
  document.addEventListener('atlas:entity-workspace-ready',()=>installLoadingEntryBridge());
  document.addEventListener('atlas:entity-entry-ready',()=>installLoadingEntryBridge());
  [0,120,450,1200].forEach(ms=>setTimeout(()=>installLoadingEntryBridge(),ms));
  enforce('install');
  [0,80,220,600,1400,3000].forEach(ms=>setTimeout(()=>enforce(`settle-${ms}`),ms));

  window.__ATLAS_ENTITY360_LOADING_API__={show:showLoading,hide:hideLoading,isHydrated:isHistoryHydrated,build:BUILD};
  window.__ATLAS_ENTITY360_SCOPE_AUTHORITY__={
    active:true,build:BUILD,authority:AUTHORITY,
    policy:'ENTITY360_ONLY_ON_POSITIVE_ENTITY_ROUTE',
    orphanIpaPolicy:'REMOVE_SHELL_ORPHANS_KEEP_CONTEXTUAL_IPA',
    statusLanguagePolicy:'SPANISH_EXPLICIT_MEANING_NOT_COLOR_DEPENDENT',
    loadingPolicy:'ENTITY360_LOADING_UNTIL_HISTORY_HYDRATED',
    loadingMinVisibleMs:MIN_LOADER_MS,
    isEntityActive,enforce,localizeEntityStatuses,showLoading,hideLoading,
    getLastInactiveReason:()=>lastInactiveReason,
    installedAt:now()
  };
})();
