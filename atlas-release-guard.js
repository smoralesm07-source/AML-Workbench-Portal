'use strict';
/* ATLAS AML · single active release authority 0.96.2 · build 0964 · freeze-safe
 * NO_ACTIVE_SESSION_RELOAD: authenticated sessions are never reloaded to enforce version identity.
 * RES_BOOTSTRAP_0954: guarantees the Empresas (RES) runtime even when index.html omits its late assets.
 */
(function atlasSingleReleaseAuthority(){
  const PRODUCT='ATLAS AML',TAGLINE='Plataforma Integrada de Inteligencia y Riesgo',MANIFEST='./atlas-release.json';
  const root=document.documentElement;
  const active={release:'0.96.2',build:'0964'};
  let applying=false,observer=null,queued=false,resRuntimePromise=null;

  function setRootAttr(name,value){if(root.getAttribute(name)!==value)root.setAttribute(name,value);}
  function setText(el,value){if(el&&el.textContent!==value)el.textContent=value;}
  function setAttr(el,name,value){if(el&&el.getAttribute(name)!==value)el.setAttribute(name,value);}

  function applyVisibleIdentity(){
    const versionLabel=`v${active.release}`;
    document.querySelectorAll('.topbar .eyebrow,.v18-pagehead .eyebrow').forEach(el=>setText(el,`${PRODUCT} · ${versionLabel}`));
    document.querySelectorAll('.v019-brand').forEach(brand=>{
      setText(brand.querySelector('strong'),PRODUCT);
      const small=brand.querySelector('small');
      if(!small)return;
      setText(small,versionLabel);
      if(small.dataset.activeVersion!==active.release)small.dataset.activeVersion=active.release;
      setAttr(small,'aria-label',`Versión ${active.release}`);
      setAttr(small,'data-runtime-label',versionLabel);
    });
    document.querySelectorAll('[data-atlas-version-label],.atlas-version,.version-badge,.app-version').forEach(el=>{
      const text=(el.textContent||'').trim();
      if(!text || /(?:^|\s)v?\d+(?:\.\d+){1,3}(?:\s|$)/i.test(text))setText(el,versionLabel);
      setAttr(el,'data-runtime-label',versionLabel);
      setAttr(el,'aria-label',`Versión ${active.release}`);
    });
  }

  function applyRelease(){
    if(applying)return;
    applying=true;
    try{
      setRootAttr('data-aml-version',active.release);
      setRootAttr('data-aml-build',active.build);
      setRootAttr('data-atlas-release',active.release);
      setRootAttr('data-atlas-release-policy','single-active');
      window.__AML_ACTIVE_VERSION__=active.release;
      window.__AML_BUILD__=active.build;
      window.__ATLAS_ACTIVE_VERSION__=active.release;
      window.__ATLAS_RELEASE_BUILD__=active.build;
      window.__AML_VERSION_SOURCE__='atlas-release-guard-0964-freeze-safe';
      const wantedTitle=`${PRODUCT} · v${active.release}`;
      if(document.title!==wantedTitle)document.title=wantedTitle;
      const meta=document.querySelector('meta[name="application-name"]');
      if(meta&&meta.content!==`${PRODUCT} · ${TAGLINE}`)meta.content=`${PRODUCT} · ${TAGLINE}`;
      applyVisibleIdentity();
      window.__ATLAS_RELEASE_GUARD_HEALTH__={status:'ready',release:active.release,build:active.build,visibleVersionPolicy:'ATLAS_RELEASE_GUARD_0964_ONLY',runtimePolicy:'CANONICAL_COMPILED_RUNTIME_ONLY',sessionPolicy:'NO_ACTIVE_SESSION_RELOAD',freezeGuard:'NO_GLOBAL_CHILD_MUTATION_OBSERVER',resBootstrap:window.AtlasRes0952?.open?'ready':'loading',checkedAt:new Date().toISOString()};
    }finally{applying=false;}
  }

  function queueApply(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;applyRelease();});}

  function ensureResCss(selector,href,datasetKey,datasetValue){
    if(document.querySelector(selector))return;
    const link=document.createElement('link');
    link.rel='stylesheet';link.href=href;link.dataset[datasetKey]=datasetValue;
    document.head.appendChild(link);
  }
  function loadResScript(selector,src,datasetKey,datasetValue,ready){
    if(ready())return Promise.resolve(true);
    const existing=document.querySelector(selector);
    if(existing)return Promise.resolve(ready());
    return new Promise(resolve=>{
      const script=document.createElement('script');
      script.src=src;script.defer=true;script.dataset[datasetKey]=datasetValue;
      script.addEventListener('load',()=>resolve(ready()),{once:true});
      script.addEventListener('error',()=>resolve(false),{once:true});
      document.head.appendChild(script);
    });
  }
  function ensureResRuntime(){
    ensureResCss('link[data-atlas-res-intelligence="0952"]','./assets/atlas-res-intelligence-0952.css?v=0952-resboot1','atlasResIntelligence','0952');
    ensureResCss('link[data-atlas-res-refinement="0953"]','./assets/atlas-res-refinement-0953.css?v=0953-resboot1','atlasResRefinement','0953');
    ensureResCss('link[data-atlas-res-cartogram="0954"]','./assets/atlas-res-cartogram-fix-0954.css?v=0954-resboot1','atlasResCartogram','0954');
    if(window.AtlasRes0952?.open){
      window.__ATLAS_RES_BOOTSTRAP__={status:'ready',version:'0.95.4',source:'release-guard',checkedAt:new Date().toISOString()};
      return Promise.resolve(true);
    }
    if(resRuntimePromise)return resRuntimePromise;
    resRuntimePromise=(async()=>{
      const core=await loadResScript('script[data-atlas-res-intelligence="0952"]','./assets/atlas-res-intelligence-0952.js?v=0952-resboot1','atlasResIntelligence','0952',()=>!!window.AtlasRes0952?.open);
      if(!core)throw new Error('RES intelligence 0.95.2 no disponible');
      await loadResScript('script[data-atlas-res-refinement="0953"]','./assets/atlas-res-refinement-0953.js?v=0953-resboot1','atlasResRefinement','0953',()=>!!window.__ATLAS_RES_REFINEMENT_0953__);
      await loadResScript('script[data-atlas-res-cartogram="0954"]','./assets/atlas-res-cartogram-fix-0954.js?v=0954-resboot1','atlasResCartogram','0954',()=>!!window.__ATLAS_RES_CARTOGRAM_FIX_0954__);
      window.__ATLAS_RES_BOOTSTRAP__={status:'ready',version:'0.95.4',source:'release-guard',core:!!window.AtlasRes0952?.open,refinement:!!window.__ATLAS_RES_REFINEMENT_0953__,cartogram:!!window.__ATLAS_RES_CARTOGRAM_FIX_0954__,checkedAt:new Date().toISOString()};
      applyRelease();
      window.dispatchEvent(new CustomEvent('atlas:nav-refresh'));
      return !!window.AtlasRes0952?.open;
    })().catch(error=>{
      resRuntimePromise=null;
      window.__ATLAS_RES_BOOTSTRAP__={status:'error',version:'0.95.4',source:'release-guard',error:String(error?.message||error),checkedAt:new Date().toISOString()};
      console.error('[ATLAS RES bootstrap]',error);
      return false;
    });
    return resRuntimePromise;
  }

  function watchRootAttributes(){
    applyRelease();
    if(observer)return;
    observer=new MutationObserver(()=>{
      if(root.getAttribute('data-aml-version')!==active.release||root.getAttribute('data-aml-build')!==active.build||root.getAttribute('data-atlas-release')!==active.release)queueApply();
    });
    observer.observe(root,{attributes:true,attributeFilter:['data-aml-version','data-aml-build','data-atlas-release']});
  }

  async function verifyManifest(){
    try{
      const url=new URL(MANIFEST,location.href);url.searchParams.set('_atlas',Date.now().toString(36));
      const res=await fetch(url.toString(),{cache:'no-store',headers:{'Cache-Control':'no-cache'}});
      if(!res.ok)throw new Error(`release manifest HTTP ${res.status}`);
      const manifest=await res.json();window.__ATLAS_RELEASE_MANIFEST__=manifest;
      const mismatch=String(manifest.release)!==active.release||String(manifest.build)!==active.build;
      window.__ATLAS_RELEASE_MISMATCH__=mismatch?{active:{...active},manifest:{release:String(manifest.release),build:String(manifest.build)},checkedAt:new Date().toISOString()}:null;
      applyRelease();return !mismatch;
    }catch(error){
      window.__ATLAS_RELEASE_GUARD_HEALTH__={status:'manifest-unavailable',release:active.release,build:active.build,sessionPolicy:'NO_ACTIVE_SESSION_RELOAD',freezeGuard:'NO_GLOBAL_CHILD_MUTATION_OBSERVER',error:String(error?.message||error),checkedAt:new Date().toISOString()};
      applyRelease();return false;
    }
  }

  document.addEventListener('click',event=>{
    const target=event.target?.closest?.('[data-view="res"]');
    if(!target||window.AtlasRes0952?.open)return;
    event.preventDefault();event.stopImmediatePropagation();
    void ensureResRuntime().then(ok=>{if(ok)window.AtlasRes0952.open();});
  },true);

  const api={product:PRODUCT,policy:'SINGLE_ACTIVE_RELEASE',runtimePolicy:'CANONICAL_COMPILED_RUNTIME_ONLY',sessionPolicy:'NO_ACTIVE_SESSION_RELOAD',apply:applyRelease,verify:verifyManifest,ensureResRuntime};
  Object.defineProperties(api,{version:{get:()=>active.release},build:{get:()=>active.build}});
  window.AtlasRelease=api;
  applyRelease();
  void ensureResRuntime();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{watchRootAttributes();void ensureResRuntime();},{once:true});else{watchRootAttributes();void ensureResRuntime();}
  window.addEventListener('pageshow',()=>{applyRelease();void verifyManifest();void ensureResRuntime();});
  window.addEventListener('focus',()=>void verifyManifest());
  window.addEventListener('atlas:themechange',queueApply);
  void verifyManifest();
  for(const ms of [120,500,1500,4000])setTimeout(()=>{applyRelease();void ensureResRuntime();},ms);
})();