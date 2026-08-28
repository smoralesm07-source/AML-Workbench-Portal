'use strict';

/* ATLAS · Entity workspace bootstrap · 2026-08-28
 * Fixes two production failure modes without changing identity governance:
 * 1) v0447 used to execute once and exit forever when __ATLAS_ENTITY_ENTRY__
 *    was not ready yet.
 * 2) Monitor's current press bridge exports article fields as
 *    id/date/title/media/url, while the v0447 consumer still expects
 *    article_id/published_at/headline/source/source_url.
 *
 * The compatibility layer is intentionally scoped to the Atlas press feed.
 * PRESS_ONLY observations remain non-reconciled and receive no inferred RUT.
 */
(function atlasEntityWorkspaceBootstrap20260828(){
  const BOOT_FLAG='__ATLAS_ENTITY_WORKSPACE_BOOTSTRAP_20260828__';
  const LOADING_FLAG='__ATLAS_ENTITY_WORKSPACE_LOADING_20260828__';
  const LOADED_FLAG='__ATLAS_ENTITY_WORKSPACE_LOADED_20260828__';
  const PRESS_COMPAT_FLAG='__ATLAS_PRESS_SCHEMA_COMPAT_20260828__';
  const PRESS_FEED_URL='https://raw.githubusercontent.com/smoralesm07-source/Monitor/atlas-press-state/atlas_prensa.json';
  const WORKSPACE_SRC='./v0447-entity-workspace.js?v=20260828-fodich4';

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
          published_at:article?.published_at||article?.observed_at||article?.date||'',
          headline:article?.headline||article?.title||'',
          source:article?.source||article?.media||'',
          source_url:article?.source_url||article?.canonical_url||article?.url||''
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

  function loadWorkspaceWhenReady(){
    if(window[LOADED_FLAG]||window[LOADING_FLAG])return true;
    const entry=window.__ATLAS_ENTITY_ENTRY__;
    if(!entry||typeof entry.open!=='function')return false;

    installPressSchemaCompatibility();
    window[LOADING_FLAG]=true;
    const script=document.createElement('script');
    script.src=WORKSPACE_SRC;
    script.async=false;
    script.onload=()=>{
      window[LOADING_FLAG]=false;
      window[LOADED_FLAG]=true;
      window.__ATLAS_ENTITY_WORKSPACE_BOOTSTRAP_STATE__={
        ready:true,
        pressSchemaCompatible:true,
        loadedAt:new Date().toISOString(),
        build:'20260828-fodich4'
      };
      document.dispatchEvent(new CustomEvent('atlas:entity-workspace-ready'));
    };
    script.onerror=()=>{
      window[LOADING_FLAG]=false;
      window.__ATLAS_ENTITY_WORKSPACE_BOOTSTRAP_STATE__={
        ready:false,
        pressSchemaCompatible:true,
        error:'workspace-load-failed',
        failedAt:new Date().toISOString(),
        build:'20260828-fodich4'
      };
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
