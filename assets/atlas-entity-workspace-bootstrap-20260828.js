'use strict';

/* ATLAS · Entity workspace bootstrap · 2026-08-28
 * Production-safe compatibility layer for Entidades.
 * The canonical Pages runtime already compiles v0447 before later standalone
 * explorer enhancers. If its press authority survived, reuse it instead of
 * attempting to reload a root source fragment that Pages does not publish.
 * PRESS_ONLY observations remain non-reconciled and receive no inferred RUT.
 */
(function atlasEntityWorkspaceBootstrap20260828(){
  const BOOT_FLAG='__ATLAS_ENTITY_WORKSPACE_BOOTSTRAP_20260828__';
  const LOADING_FLAG='__ATLAS_ENTITY_WORKSPACE_LOADING_20260828__';
  const LOADED_FLAG='__ATLAS_ENTITY_WORKSPACE_LOADED_20260828__';
  const PRESS_COMPAT_FLAG='__ATLAS_PRESS_SCHEMA_COMPAT_20260828__';
  const BRIDGE_LOADING_FLAG='__ATLAS_ENTITY_PRESS_SEARCH_BRIDGE_LOADING_20260828__';
  const PRESS_FEED_URL='https://raw.githubusercontent.com/smoralesm07-source/Monitor/atlas-press-state/atlas_prensa.json';
  const WORKSPACE_SRC='./v0447-entity-workspace.js?v=20260828-fodich4';
  const PRESS_SEARCH_BRIDGE_SRC='./assets/atlas-entity-press-search-bridge-20260828.js?v=20260828-fodich7';

  if(window[BOOT_FLAG])return;
  window[BOOT_FLAG]=true;

  function installPressSchemaCompatibility(){
    if(window[PRESS_COMPAT_FLAG]||typeof window.fetch!=='function')return;
    window[PRESS_COMPAT_FLAG]=true;
    const nativeFetch=window.fetch.bind(window);

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
      build:'20260828-fodich7',
      ...extra
    };
  }

  function loadPressSearchBridge(){
    if(window.__ATLAS_ENTITY_PRESS_SEARCH_BRIDGE_20260828__){
      if(window.__ATLAS_ENTITY_WORKSPACE_BOOTSTRAP_STATE__)window.__ATLAS_ENTITY_WORKSPACE_BOOTSTRAP_STATE__.pressSearchBridge=true;
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
      dispatchReady();
    };
    bridge.onerror=()=>{
      window[BRIDGE_LOADING_FLAG]=false;
      if(window.__ATLAS_ENTITY_WORKSPACE_BOOTSTRAP_STATE__)window.__ATLAS_ENTITY_WORKSPACE_BOOTSTRAP_STATE__.pressSearchBridge=false;
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
        reusedCompiledAuthority:false,
        fallbackReload:true,
        error:'workspace-load-failed',
        failedAt:new Date().toISOString(),
        build:'20260828-fodich7'
      };
      /* Do not alter the existing Entidades explorer when fallback is absent. */
      loadPressSearchBridge();
    };
    document.body.appendChild(script);
    return true;
  }

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
