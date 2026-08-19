'use strict';

/* ATLAS AML · single active release authority.
 * The guard is release-agnostic: the built HTML provides the initial release and
 * atlas-release.json is the source of truth. Future releases do not require
 * editing this file.
 */
(function atlasSingleReleaseAuthority(){
  const PRODUCT='ATLAS AML';
  const TAGLINE='Plataforma Integrada de Inteligencia y Riesgo';
  const MANIFEST='./atlas-release.json';
  const MAX_RELOADS=2;
  const RELOAD_KEY='atlas-release-reload-count';
  const root=document.documentElement;
  const active={
    release:String(root.getAttribute('data-atlas-release')||root.getAttribute('data-aml-version')||'current'),
    build:String(root.getAttribute('data-aml-build')||'current')
  };
  let applying=false,observer=null,queued=false;

  function setAttrIfChanged(name,value){if(root.getAttribute(name)!==value)root.setAttribute(name,value);}
  function applyRelease(){
    if(applying)return;
    applying=true;
    try{
      const RELEASE=active.release,BUILD=active.build;
      setAttrIfChanged('data-aml-version',RELEASE);
      setAttrIfChanged('data-aml-build',BUILD);
      setAttrIfChanged('data-atlas-release',RELEASE);
      setAttrIfChanged('data-atlas-release-policy','single-active');
      window.__AML_ACTIVE_VERSION__=RELEASE;
      window.__AML_BUILD__=BUILD;
      window.__ATLAS_ACTIVE_VERSION__=RELEASE;
      window.__ATLAS_RELEASE_BUILD__=BUILD;
      window.__AML_VERSION_SOURCE__='atlas-release-guard';
      const wantedTitle=`${PRODUCT} · v${RELEASE}`;
      if(document.title!==wantedTitle)document.title=wantedTitle;
      const meta=document.querySelector('meta[name="application-name"]');
      if(meta&&meta.content!==`${PRODUCT} · ${TAGLINE}`)meta.content=`${PRODUCT} · ${TAGLINE}`;
      document.querySelectorAll('.topbar .eyebrow,.v18-pagehead .eyebrow').forEach(el=>{if(el.textContent!==wantedTitle)el.textContent=wantedTitle;});
      document.querySelectorAll('.v019-brand').forEach(brand=>{
        const strong=brand.querySelector('strong');if(strong&&strong.textContent!==PRODUCT)strong.textContent=PRODUCT;
        const small=brand.querySelector('small');if(small){
          const label=`v${RELEASE}`;
          if(small.textContent!==label)small.textContent=label;
          if(small.dataset.activeVersion!==RELEASE)small.dataset.activeVersion=RELEASE;
          if(small.getAttribute('aria-label')!==`Versión ${RELEASE}`)small.setAttribute('aria-label',`Versión ${RELEASE}`);
          if(small.getAttribute('data-runtime-label')!==label)small.setAttribute('data-runtime-label',label);
        }
      });
      window.__ATLAS_RELEASE_GUARD_HEALTH__={
        status:'ready',release:RELEASE,build:BUILD,mutationPolicy:'ROOT_ATTRIBUTES_ONLY',
        visibleVersionPolicy:'ATLAS_RELEASE_GUARD_ONLY',assetCoherency:'ALL_ACTIVE_LOCAL_JS_CSS_PINNED_TO_CURRENT_BUILD',
        runtimePolicy:'CANONICAL_ACTIVE_RUNTIME_ONLY',uiAuthority:'ATLAS_CURRENT_UI_LAST_WRITER',checkedAt:new Date().toISOString()
      };
    }finally{applying=false;}
  }
  function queueApply(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;applyRelease();});}
  function watchRelease(){
    applyRelease();
    if(observer)return;
    observer=new MutationObserver(()=>{
      if(root.getAttribute('data-aml-version')!==active.release||root.getAttribute('data-aml-build')!==active.build||root.getAttribute('data-atlas-release')!==active.release)queueApply();
    });
    observer.observe(root,{attributes:true,attributeFilter:['data-aml-version','data-aml-build','data-atlas-release']});
  }
  function reloadCurrent(manifest){
    const key=`${manifest.release}:${manifest.build}`;
    const count=Number(sessionStorage.getItem(RELOAD_KEY)||0);
    const url=new URL(location.href);
    if(url.searchParams.get('atlas_release')===key||count>=MAX_RELOADS)return;
    sessionStorage.setItem(RELOAD_KEY,String(count+1));
    url.searchParams.set('atlas_release',key);url.searchParams.set('_atlas',Date.now().toString(36));
    location.replace(url.toString());
  }
  async function verifyManifest(){
    try{
      const url=new URL(MANIFEST,location.href);url.searchParams.set('_atlas',Date.now().toString(36));
      const res=await fetch(url.toString(),{cache:'no-store',headers:{'Cache-Control':'no-cache'}});
      if(!res.ok)throw new Error(`release manifest HTTP ${res.status}`);
      const manifest=await res.json();window.__ATLAS_RELEASE_MANIFEST__=manifest;
      if(String(manifest.release)!==active.release||String(manifest.build)!==active.build){reloadCurrent(manifest);return false;}
      sessionStorage.removeItem(RELOAD_KEY);applyRelease();return true;
    }catch(error){
      console.warn('[ATLAS] release manifest check unavailable',error);
      window.__ATLAS_RELEASE_GUARD_HEALTH__={status:'manifest-unavailable',release:active.release,build:active.build,error:String(error?.message||error),checkedAt:new Date().toISOString()};
      applyRelease();return false;
    }
  }
  const api={product:PRODUCT,policy:'SINGLE_ACTIVE_RELEASE',runtimePolicy:'CANONICAL_ACTIVE_RUNTIME_ONLY',apply:applyRelease,verify:verifyManifest};
  Object.defineProperties(api,{version:{get:()=>active.release},build:{get:()=>active.build}});
  window.AtlasRelease=api;
  applyRelease();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watchRelease,{once:true});else watchRelease();
  window.addEventListener('pageshow',()=>void verifyManifest());
  window.addEventListener('focus',()=>void verifyManifest());
  window.addEventListener('atlas:themechange',queueApply);
  void verifyManifest();
  for(const ms of [0,120,350,900,1800,4000,8000])setTimeout(applyRelease,ms);
})();
