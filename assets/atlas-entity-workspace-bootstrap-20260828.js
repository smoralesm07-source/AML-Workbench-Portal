'use strict';

/* ATLAS · Entity workspace compatibility bootstrap · current
 * 2026-09-04: the Entity 360 renderer is no longer loaded here.
 * The canonical Historia Inteligente authority is compiled before v0447.
 * This compatibility file preserves only press adapters and sanctions charts.
 */
(function atlasEntityWorkspaceCompatibilityCurrent(){
  const BOOT_FLAG='__ATLAS_ENTITY_WORKSPACE_BOOTSTRAP_20260828__';
  const PRESS_COMPAT_FLAG='__ATLAS_PRESS_SCHEMA_COMPAT_20260828__';
  const BRIDGE_LOADING_FLAG='__ATLAS_ENTITY_PRESS_SEARCH_BRIDGE_LOADING_20260828__';
  const PRESS_VIEW_LOADING_FLAG='__ATLAS_ENTITY_PRESS_VIEW_LOADING_0951__';
  const PRESS_RACEFIX_LOADING_FLAG='__ATLAS_ENTITY_PRESS_SEARCH_RACEFIX_LOADING_20260828__';
  const PRESS_FEED_URL='https://raw.githubusercontent.com/smoralesm07-source/Monitor/atlas-press-state/atlas_prensa.json';
  const PRESS_SEARCH_BRIDGE_SRC='./assets/atlas-entity-press-search-bridge-20260828.js?v=20260904-current1';
  const PRESS_SEARCH_RACEFIX_SRC='./assets/atlas-entity-press-search-racefix-20260828.js?v=20260904-current1';
  const PRESS_VIEW_JS_SRC='./assets/atlas-entity-press-view-0951.js?v=20260904-current1';
  const PRESS_VIEW_CSS_SRC='./assets/atlas-entity-press-view-0951.css?v=20260904-current1';
  const BUILD='20260904-entity-compat-current1';

  if(window[BOOT_FLAG])return;
  window[BOOT_FLAG]=true;

  function setState(extra={}){
    window.__ATLAS_ENTITY_WORKSPACE_BOOTSTRAP_STATE__={
      ready:true,
      build:BUILD,
      entity360Authority:'ENTITY360_HISTORY_INTELLIGENCE',
      entity360LateLoader:false,
      entity360Observer:false,
      pressSchemaCompatible:!!window[PRESS_COMPAT_FLAG],
      pressSearchBridge:!!window.__ATLAS_ENTITY_PRESS_SEARCH_BRIDGE_20260828__,
      pressSearchRacefix:!!window.__ATLAS_ENTITY_PRESS_SEARCH_RACEFIX__,
      pressView0951:!!window.__ATLAS_ENTITY_PRESS_VIEW_0951__,
      ...extra
    };
  }

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
    script.onload=()=>{window[PRESS_VIEW_LOADING_FLAG]=false;setState({pressView0951:true});};
    script.onerror=()=>{window[PRESS_VIEW_LOADING_FLAG]=false;setState({pressView0951:false,pressViewError:true});};
    document.body.appendChild(script);
  }

  function installPressSchemaCompatibility(){
    if(window[PRESS_COMPAT_FLAG]||typeof window.fetch!=='function')return;
    window[PRESS_COMPAT_FLAG]=true;
    const nativeFetch=window.__ATLAS_PRESS_NATIVE_FETCH__||window.fetch.bind(window);
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
      }catch(_error){
        return response;
      }
    };
  }

  function installPressSearchRacefix(){
    if(window.__ATLAS_ENTITY_PRESS_SEARCH_RACEFIX__||window[PRESS_RACEFIX_LOADING_FLAG])return;
    window[PRESS_RACEFIX_LOADING_FLAG]=true;
    const script=document.createElement('script');
    script.src=PRESS_SEARCH_RACEFIX_SRC;
    script.async=false;
    script.dataset.atlasEntityPressSearchRacefix='1';
    script.onload=()=>{window[PRESS_RACEFIX_LOADING_FLAG]=false;setState({pressSearchRacefix:true});};
    script.onerror=()=>{window[PRESS_RACEFIX_LOADING_FLAG]=false;setState({pressSearchRacefix:false,pressRacefixError:true});};
    document.body.appendChild(script);
  }

  function loadPressSearchBridge(){
    installPressView0951();
    if(window.__ATLAS_ENTITY_PRESS_SEARCH_BRIDGE_20260828__){
      installPressSearchRacefix();
      setState({pressSearchBridge:true});
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
      installPressSearchRacefix();
      setState({pressSearchBridge:true});
      document.dispatchEvent(new CustomEvent('atlas:entity-workspace-ready'));
    };
    bridge.onerror=()=>{
      window[BRIDGE_LOADING_FLAG]=false;
      installPressSearchRacefix();
      setState({pressSearchBridge:false,pressBridgeError:true});
      document.dispatchEvent(new CustomEvent('atlas:entity-workspace-ready'));
    };
    document.body.appendChild(bridge);
  }

  installPressSchemaCompatibility();
  installPressView0951();
  loadPressSearchBridge();
  setState({installedAt:new Date().toISOString()});
})();

/* Sanciones chart authority 0.96.2 · retained compatibility loader. */
(function atlasSanctionsChartsLoader0962(){
  if(window.__ATLAS_SANCTIONS_CHARTS_0962_LOADER__)return;
  window.__ATLAS_SANCTIONS_CHARTS_0962_LOADER__=true;
  const script=document.createElement('script');
  script.src='./assets/atlas-sanctions-charts-0962.js?v=0962-20260904-current1';
  script.async=false;
  script.dataset.atlasSanctionsCharts='0962';
  document.body.appendChild(script);
})();
