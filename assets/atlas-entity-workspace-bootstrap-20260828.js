'use strict';

/* ATLAS · Entity workspace bootstrap · 2026-08-28 · perf1+press0951+racefix1
 * Production-safe compatibility layer for Entidades.
 * The canonical Pages runtime already compiles v0447 before later standalone
 * explorer enhancers. If its press authority survived, reuse it instead of
 * attempting to reload a root source fragment that Pages does not publish.
 * PRESS_ONLY observations remain non-reconciled and receive no inferred RUT.
 *
 * perf1 exposes the original fetch implementation to the lightweight 0512
 * press bridge. This prevents that bridge from paying the compatibility
 * parse+serialize cost a second time; v0447 continues using the normalized
 * compatibility response unchanged.
 *
 * press0951 loads the Entidades press-observation presentation layer: compact
 * governed hierarchy, denser press evidence and an explicit return control.
 * racefix1 keeps press-only suggestions stable across the 0512 canonical
 * autocomplete rewrite and makes Enter wait only when canonical search is empty
 * or the press-only search is already pending.
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
  const BUILD='20260828-perf1+press0951+racefix1';

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
        const normalized={...raw,articles};
        const headers=new Headers(response.headers);
        headers.set('content-type','application/json; charset=utf-8');
        return new Response(JSON.stringify(normalized),{
          status:response.status,
          statusText:response.statusText,
          headers
        });
      }catch(_error){
        return response;
      }
    };
  }

  function dispatchReady(){
    document.dispatchEvent(new CustomEvent('atlas:entity-workspace-ready'));
  }

  function setState(extra){
    window.__ATLAS_ENTITY_WORKSPACE_BOOTSTRAP_STATE__={
      ready:true,
      pressSchemaCompatible:true,
      pressSearchBridge:false,
      pressSearchRacefix:!!window.__ATLAS_ENTITY_PRESS_SEARCH_RACEFIX__,
      pressView0951:!!window.__ATLAS_ENTITY_PRESS_VIEW_0951__,
      build:BUILD,
      ...extra
    };
  }

  function loadPressSearchBridge(){
    installPressView0951();
    if(window.__ATLAS_ENTITY_PRESS_SEARCH_BRIDGE_20260828__){
      if(window.__ATLAS_ENTITY_WORKSPACE_BOOTSTRAP_STATE__)window.__ATLAS_ENTITY_WORKSPACE_BOOTSTRAP_STATE__.pressSearchBridge=true;
      installPressSearchRacefix();
      dispatchReady();
      return;
    }
    if(window[BRIDGE_LOADING_FLAG])return;
    window[BRIDGE_LOADING_FLAG]=true;
    const bridge=document.createElement('script');
    bridge.src=PRESS_SEARCH_BRIDGE_SRC;
    bridge.async=false;
    bridge.dataset.atlasEntityPressSearchBridge='1';
    bridge.onload=()=>{
      window[BRIDGE_LOADING_FLAG]=false;
      if(window.__ATLAS_ENTITY_WORKSPACE_BOOTSTRAP_STATE__)window.__ATLAS_ENTITY_WORKSPACE_BOOTSTRAP_STATE__.pressSearchBridge=true;
      installPressSearchRacefix();
      dispatchReady();
    };
    bridge.onerror=()=>{
      window[BRIDGE_LOADING_FLAG]=false;
      if(window.__ATLAS_ENTITY_WORKSPACE_BOOTSTRAP_STATE__)window.__ATLAS_ENTITY_WORKSPACE_BOOTSTRAP_STATE__.pressSearchBridge=false;
      installPressSearchRacefix();
      dispatchReady();
    };
    document.body.appendChild(bridge);
  }

  function reuseCompiledWorkspace(entry){
    if(!entry||typeof entry.openPressObservation!=='function')return false;
    window[LOADED_FLAG]=true;
    setState({
      reusedCompiledAuthority:true,
      fallbackReload:false,
      loadedAt:new Date().toISOString()
    });
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

    /* Development/source fallback only. Canonical Pages normally never enters
       this branch because v0447 is already part of the compiled 0.90.1 runtime. */
    window[LOADING_FLAG]=true;
    const script=document.createElement('script');
    script.src=WORKSPACE_SRC;
    script.async=false;
    script.onload=()=>{
      window[LOADING_FLAG]=false;
      window[LOADED_FLAG]=true;
      setState({
        reusedCompiledAuthority:false,
        fallbackReload:true,
        loadedAt:new Date().toISOString()
      });
      loadPressSearchBridge();
    };
    script.onerror=()=>{
      window[LOADING_FLAG]=false;
      window.__ATLAS_ENTITY_WORKSPACE_BOOTSTRAP_STATE__={
        ready:false,
        pressSchemaCompatible:true,
        pressSearchBridge:false,
        pressSearchRacefix:!!window.__ATLAS_ENTITY_PRESS_SEARCH_RACEFIX__,
        pressView0951:!!window.__ATLAS_ENTITY_PRESS_VIEW_0951__,
        reusedCompiledAuthority:false,
        fallbackReload:true,
        error:'workspace-load-failed',
        failedAt:new Date().toISOString(),
        build:BUILD
      };
      /* Do not alter the existing Entidades explorer when fallback is absent. */
      loadPressSearchBridge();
    };
    document.body.appendChild(script);
    return true;
  }

  installPressView0951();
  installPressSchemaCompatibility();
  if(loadWorkspaceWhenReady())return;

  let attempts=0;
  const timer=setInterval(()=>{
    attempts+=1;
    if(loadWorkspaceWhenReady()||attempts>=300)clearInterval(timer);
  },100);

  window.addEventListener('load',loadWorkspaceWhenReady,{once:true});
  document.addEventListener('atlas:entity-entry-ready',loadWorkspaceWhenReady);
})();

/* ATLAS · Sanciones chart authority 0.96.2 loader.
 * Kept here as a late production bootstrap so it can enhance Sanciones whether
 * the section authority is loaded before or after the main portal runtime.
 */
(function atlasSanctionsChartsLoader0962(){
  if(window.__ATLAS_SANCTIONS_CHARTS_0962_LOADER__)return;
  window.__ATLAS_SANCTIONS_CHARTS_0962_LOADER__=true;
  const script=document.createElement('script');
  script.src='./assets/atlas-sanctions-charts-0962.js?v=0962-20260828';
  script.async=false;
  script.dataset.atlasSanctionsCharts='0962';
  document.body.appendChild(script);
})();
