'use strict';

/* ATLAS · Entity workspace bootstrap · production compatibility layer
 * 2026-09-03: Entidad 360 Executive is loaded independently of the legacy
 * renderer and hooks the canonical __ATLAS_ENTITY_ENTRY__ authority.
 */
(function atlasEntityWorkspaceBootstrap20260828(){
  const BOOT_FLAG='__ATLAS_ENTITY_WORKSPACE_BOOTSTRAP_20260828__';
  const LOADING_FLAG='__ATLAS_ENTITY_WORKSPACE_LOADING_20260828__';
  const LOADED_FLAG='__ATLAS_ENTITY_WORKSPACE_LOADED_20260828__';
  const PRESS_COMPAT_FLAG='__ATLAS_PRESS_SCHEMA_COMPAT_20260828__';
  const BRIDGE_LOADING_FLAG='__ATLAS_ENTITY_PRESS_SEARCH_BRIDGE_LOADING_20260828__';
  const PRESS_VIEW_LOADING_FLAG='__ATLAS_ENTITY_PRESS_VIEW_LOADING_0951__';
  const PRESS_RACEFIX_LOADING_FLAG='__ATLAS_ENTITY_PRESS_SEARCH_RACEFIX_LOADING_20260828__';
  const PRESS_FEED_URL='https://raw.githubusercontent.com/smoralesm07-source/Monitor/atlas-press-state/atlas_prensa.json';
  const WORKSPACE_SRC='./v0447-entity-workspace.js?v=20260828-fodich4';
  const PRESS_SEARCH_BRIDGE_SRC='./assets/atlas-entity-press-search-bridge-20260828.js?v=20260828-perf1';
  const PRESS_SEARCH_RACEFIX_SRC='./assets/atlas-entity-press-search-racefix-20260828.js?v=20260828-racefix1';
  const PRESS_VIEW_JS_SRC='./assets/atlas-entity-press-view-0951.js?v=0951-1';
  const PRESS_VIEW_CSS_SRC='./assets/atlas-entity-press-view-0951.css?v=0951-1';
  const BUILD='20260903-e360-entry5';

  if(window[BOOT_FLAG])return;
  window[BOOT_FLAG]=true;

  function installPressView0951(){
    if(!document.querySelector('link[data-atlas-entity-press-view="0951"]')){
      const css=document.createElement('link');
      css.rel='stylesheet';
      css.href=PRESS_VIEW_CSS_SRC;
      css.dataset.atlasEntityPressView='0951';
      document.head.appendChild(css);
    }
    if(window.__ATLAS_ENTITY_PRESS_VIEW_0951__||window[PRESS_VIEW_LOADING_FLAG])return;
    window[PRESS_VIEW_LOADING_FLAG]=true;
    const script=document.createElement('script');
    script.src=PRESS_VIEW_JS_SRC;
    script.async=false;
    script.dataset.atlasEntityPressView='0951';
    script.onload=()=>{window[PRESS_VIEW_LOADING_FLAG]=false;};
    script.onerror=()=>{window[PRESS_VIEW_LOADING_FLAG]=false;};
    document.body.appendChild(script);
  }

  function installPressSearchRacefix(){
    if(window.__ATLAS_ENTITY_PRESS_SEARCH_RACEFIX__||window[PRESS_RACEFIX_LOADING_FLAG])return;
    window[PRESS_RACEFIX_LOADING_FLAG]=true;
    const script=document.createElement('script');
    script.src=PRESS_SEARCH_RACEFIX_SRC;
    script.async=false;
    script.dataset.atlasEntityPressSearchRacefix='1';
    script.onload=()=>{
      window[PRESS_RACEFIX_LOADING_FLAG]=false;
      if(window.__ATLAS_ENTITY_WORKSPACE_BOOTSTRAP_STATE__)window.__ATLAS_ENTITY_WORKSPACE_BOOTSTRAP_STATE__.pressSearchRacefix=true;
    };
    script.onerror=()=>{
      window[PRESS_RACEFIX_LOADING_FLAG]=false;
      if(window.__ATLAS_ENTITY_WORKSPACE_BOOTSTRAP_STATE__)window.__ATLAS_ENTITY_WORKSPACE_BOOTSTRAP_STATE__.pressSearchRacefix=false;
    };
    document.body.appendChild(script);
  }

  function installPressSchemaCompatibility(){
    if(window[PRESS_COMPAT_FLAG]||typeof window.fetch!=='function')return;
    window[PRESS_COMPAT_FLAG]=true;
    const nativeFetch=window.fetch.bind(window);
    if(typeof window.__ATLAS_PRESS_NATIVE_FETCH__!=='function')window.__ATLAS_PRESS_NATIVE_FETCH__=nativeFetch;
    window.fetch=async function atlasPressCompatibleFetch(input,init){
      const requestUrl=typeof input==='string'?input:String(input?.url||'');
      const response=await nativeFetch(input,init);
      if(!requestUrl.startsWith(PRESS_FEED_URL))return response;
      try{
        const raw=await response.clone().json();
        const articles=(Array.isArray(raw?.articles)?raw.articles:[]).map((article,index)=>({
          ...article,
          article_id:String(article?.article_id||article?.id||`PRESS-ARTICLE-${index}`),
          published_at:article?.published_at||article?.observed_at||article?.date||article?.fecha||'',
          headline:article?.headline||article?.title||article?.titular||'',
          summary:article?.summary||article?.bajada||article?.description||article?.excerpt||article?.lead||'',
          source:article?.source||article?.source_name||article?.media||article?.medio||'',
          source_url:article?.source_url||article?.canonical_url||article?.url||article?.link||''
        }));
        const headers=new Headers(response.headers);
        headers.set('content-type','application/json; charset=utf-8');
        return new Response(JSON.stringify({...raw,articles}),{status:response.status,statusText:response.statusText,headers});
      }catch(_error){return response;}
    };
  }

  function dispatchReady(){document.dispatchEvent(new CustomEvent('atlas:entity-workspace-ready'));}
  function setState(extra){window.__ATLAS_ENTITY_WORKSPACE_BOOTSTRAP_STATE__={ready:true,pressSchemaCompatible:true,pressSearchBridge:false,pressSearchRacefix:!!window.__ATLAS_ENTITY_PRESS_SEARCH_RACEFIX__,pressView0951:!!window.__ATLAS_ENTITY_PRESS_VIEW_0951__,build:BUILD,...extra};}

  function loadPressSearchBridge(){
    installPressView0951();
    if(window.__ATLAS_ENTITY_PRESS_SEARCH_BRIDGE_20260828__){
      if(window.__ATLAS_ENTITY_WORKSPACE_BOOTSTRAP_STATE__)window.__ATLAS_ENTITY_WORKSPACE_BOOTSTRAP_STATE__.pressSearchBridge=true;
      installPressSearchRacefix();dispatchReady();return;
    }
    if(window[BRIDGE_LOADING_FLAG])return;
    window[BRIDGE_LOADING_FLAG]=true;
    const bridge=document.createElement('script');
    bridge.src=PRESS_SEARCH_BRIDGE_SRC;
    bridge.async=false;
    bridge.dataset.atlasEntityPressSearchBridge='1';
    bridge.onload=()=>{window[BRIDGE_LOADING_FLAG]=false;if(window.__ATLAS_ENTITY_WORKSPACE_BOOTSTRAP_STATE__)window.__ATLAS_ENTITY_WORKSPACE_BOOTSTRAP_STATE__.pressSearchBridge=true;installPressSearchRacefix();dispatchReady();};
    bridge.onerror=()=>{window[BRIDGE_LOADING_FLAG]=false;if(window.__ATLAS_ENTITY_WORKSPACE_BOOTSTRAP_STATE__)window.__ATLAS_ENTITY_WORKSPACE_BOOTSTRAP_STATE__.pressSearchBridge=false;installPressSearchRacefix();dispatchReady();};
    document.body.appendChild(bridge);
  }

  function reuseCompiledWorkspace(entry){
    if(!entry||typeof entry.openPressObservation!=='function')return false;
    window[LOADED_FLAG]=true;
    setState({reusedCompiledAuthority:true,fallbackReload:false,loadedAt:new Date().toISOString()});
    loadPressSearchBridge();
    return true;
  }

  function loadWorkspaceWhenReady(){
    installPressView0951();
    if(window[LOADED_FLAG]){loadPressSearchBridge();return true;}
    if(window[LOADING_FLAG])return true;
    const entry=window.__ATLAS_ENTITY_ENTRY__;
    if(!entry||typeof entry.open!=='function')return false;
    installPressSchemaCompatibility();
    if(reuseCompiledWorkspace(entry))return true;
    window[LOADING_FLAG]=true;
    const script=document.createElement('script');
    script.src=WORKSPACE_SRC;
    script.async=false;
    script.onload=()=>{window[LOADING_FLAG]=false;window[LOADED_FLAG]=true;setState({reusedCompiledAuthority:false,fallbackReload:true,loadedAt:new Date().toISOString()});loadPressSearchBridge();};
    script.onerror=()=>{window[LOADING_FLAG]=false;window.__ATLAS_ENTITY_WORKSPACE_BOOTSTRAP_STATE__={ready:false,pressSchemaCompatible:true,pressSearchBridge:false,pressSearchRacefix:!!window.__ATLAS_ENTITY_PRESS_SEARCH_RACEFIX__,pressView0951:!!window.__ATLAS_ENTITY_PRESS_VIEW_0951__,reusedCompiledAuthority:false,fallbackReload:true,error:'workspace-load-failed',failedAt:new Date().toISOString(),build:BUILD};loadPressSearchBridge();};
    document.body.appendChild(script);
    return true;
  }

  installPressView0951();
  installPressSchemaCompatibility();
  if(!loadWorkspaceWhenReady()){
    let attempts=0;
    const timer=setInterval(()=>{attempts+=1;if(loadWorkspaceWhenReady()||attempts>=300)clearInterval(timer);},100);
    window.addEventListener('load',loadWorkspaceWhenReady,{once:true});
    document.addEventListener('atlas:entity-entry-ready',loadWorkspaceWhenReady);
  }
})();

/* Sanciones chart authority 0.96.2 */
(function atlasSanctionsChartsLoader0962(){
  if(window.__ATLAS_SANCTIONS_CHARTS_0962_LOADER__)return;
  window.__ATLAS_SANCTIONS_CHARTS_0962_LOADER__=true;
  const script=document.createElement('script');
  script.src='./assets/atlas-sanctions-charts-0962.js?v=0962-20260828';
  script.async=false;
  script.dataset.atlasSanctionsCharts='0962';
  document.body.appendChild(script);
})();

/* Entidad 360 Executive · canonical production loader.
 * It refuses stale 360 APIs and always installs the exact production build.
 */
(function atlasEntity360ExecutiveProductionLoader20260903(){
  const FLAG='__ATLAS_ENTITY360_EXECUTIVE_ACTIVE_LOADER__';
  const BUILD='20260903-e360-entry5';
  const MODULE_BUILD='20260903-e360-3';
  const CSS='./assets/atlas-entity360-executive-20260903.css?v=20260903-entry5';
  const JS='./assets/atlas-entity360-executive-20260903.js?v=20260903-entry5';

  if(window[FLAG]?.build===BUILD)return;
  window[FLAG]={active:true,build:BUILD,moduleBuildRequired:MODULE_BUILD,installed:false,startedAt:new Date().toISOString()};

  if(!document.querySelector('link[data-atlas-e360-executive-active]')){
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href=CSS;
    link.dataset.atlasE360ExecutiveActive='1';
    document.head.appendChild(link);
  }

  function connect(){
    const api=window.__ATLAS_ENTITY360_EXECUTIVE__;
    if(api?.active&&api.build===MODULE_BUILD){
      window[FLAG].installed=true;
      window[FLAG].moduleBuild=api.build;
      window[FLAG].entryHooked=api.hookEntry?.()||!!window.__ATLAS_ENTITY_ENTRY__?.open?.__atlasE360Executive;
      window[FLAG].connectedAt=new Date().toISOString();
      return true;
    }
    if(api?.active&&api.build!==MODULE_BUILD){
      window[FLAG].staleModuleBuild=api.build||'unknown';
      window[FLAG].installed=false;
    }
    return false;
  }

  if(connect())return;
  const prior=document.querySelector('script[data-atlas-e360-executive-active]');
  if(prior)prior.remove();
  const script=document.createElement('script');
  script.src=JS;
  script.async=false;
  script.dataset.atlasE360ExecutiveActive='1';
  script.onload=()=>{window[FLAG].loadedAt=new Date().toISOString();connect();};
  script.onerror=()=>{window[FLAG].error='asset-load-failed';window[FLAG].failedAt=new Date().toISOString();};
  document.body.appendChild(script);

  document.addEventListener('atlas:entity-workspace-ready',connect);
  document.addEventListener('atlas:entity-entry-ready',connect);
  window.addEventListener('load',connect,{once:true});
  [250,1000,2500,5000].forEach(ms=>setTimeout(connect,ms));
})();

/* Entidad 360 · FINAL VISUAL AUTHORITY
 * The canonical 0.44.7 workspace captures BASE_OPEN before late loaders run.
 * Therefore a function wrapper alone can be bypassed. This observer works at
 * the final DOM layer: after any entity renderer/hydrator paints #content, it
 * guarantees the executive summary is present for the active selectedEntity.
 */
(function atlasEntity360FinalVisualAuthority20260903(){
  const FLAG='__ATLAS_ENTITY360_FINAL_VISUAL_AUTHORITY__';
  const BUILD='20260903-e360-final5';
  const MODULE_BUILD='20260903-e360-3';
  if(window[FLAG]?.build===BUILD)return;

  let timer=null;
  let inflight=false;
  let waits=0;
  let observer=null;

  function selectedEntity(){
    try{if(typeof state!=='undefined'&&state?.selectedEntity)return String(state.selectedEntity);}catch(_error){}
    const current=window.__ATLAS_ENTITY360_CURRENT__?.selectedEntity;
    return current?String(current):'';
  }

  function hasRenderedEntity(){
    const c=document.querySelector('#content');
    if(!c)return false;
    return !!c.querySelector('.a45:not(.a47-entity-empty), .v0203-entity, .v038-entity');
  }

  function schedule(reason='mutation',delay=70){
    clearTimeout(timer);
    timer=setTimeout(()=>void reconcile(reason),delay);
  }

  async function reconcile(reason){
    if(inflight)return;
    const entityId=selectedEntity();
    if(!entityId||!hasRenderedEntity())return;

    const api=window.__ATLAS_ENTITY360_EXECUTIVE__;
    if(!api?.active||api.build!==MODULE_BUILD){
      waits+=1;
      if(waits<80)schedule('api-wait',150);
      window[FLAG]={active:true,build:BUILD,moduleBuildRequired:MODULE_BUILD,entityId,waitingForApi:true,waits,lastReason:reason,checkedAt:new Date().toISOString()};
      return;
    }
    waits=0;

    const host=document.querySelector('#atlas-entity360-executive');
    const current=window.__ATLAS_ENTITY360_EXECUTIVE_STATE__;
    if(host&&current?.build===MODULE_BUILD&&String(current.entityId||'')===entityId){
      host.dataset.e360FinalAuthority=BUILD;
      window[FLAG]={active:true,build:BUILD,moduleBuildRequired:MODULE_BUILD,entityId,present:true,waitingForApi:false,lastReason:reason,checkedAt:new Date().toISOString()};
      return;
    }

    inflight=true;
    try{
      await api.open(entityId,{entity_id:entityId});
      const mounted=document.querySelector('#atlas-entity360-executive');
      if(mounted)mounted.dataset.e360FinalAuthority=BUILD;
      window[FLAG]={active:true,build:BUILD,moduleBuildRequired:MODULE_BUILD,entityId,present:!!mounted,waitingForApi:false,lastReason:reason,mountedAt:new Date().toISOString()};
    }catch(error){
      window[FLAG]={active:true,build:BUILD,moduleBuildRequired:MODULE_BUILD,entityId,present:false,error:String(error?.message||error),lastReason:reason,failedAt:new Date().toISOString()};
    }finally{
      inflight=false;
    }
  }

  function install(){
    if(observer)return;
    const app=document.querySelector('#app');
    if(!app){setTimeout(install,100);return;}
    observer=new MutationObserver(()=>schedule('dom-mutation'));
    observer.observe(app,{childList:true,subtree:true});
    window[FLAG]={active:true,build:BUILD,moduleBuildRequired:MODULE_BUILD,observer:true,installedAt:new Date().toISOString()};
    schedule('install',100);
    [300,1000,2500,5000].forEach(ms=>setTimeout(()=>schedule(`startup-${ms}`,0),ms));
  }

  install();
  document.addEventListener('atlas:entity-workspace-ready',()=>schedule('workspace-ready',0));
  document.addEventListener('atlas:entity-entry-ready',()=>schedule('entry-ready',0));
  window.addEventListener('load',()=>schedule('window-load',0),{once:true});
})();
