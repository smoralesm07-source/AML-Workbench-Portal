'use strict';

/* ATLAS AML · single active release authority.
 * v0.42.5 keeps ATLAS as the only visible/runtime version authority, pins the
 * complete local asset graph, and delegates final navigation presentation to
 * atlas-current-ui.
 */
(function atlasSingleReleaseAuthority(){
  const RELEASE='0.42.5';
  const BUILD='0425';
  const PRODUCT='ATLAS AML';
  const TAGLINE='Plataforma Integrada de Inteligencia y Riesgo';
  const MANIFEST='./atlas-release.json';
  const MAX_RELOADS=2;
  const RELOAD_KEY='atlas-release-reload-count';
  const root=document.documentElement;
  let applying=false;
  let observer=null;
  let queued=false;

  function setAttrIfChanged(name,value){if(root.getAttribute(name)!==value)root.setAttribute(name,value);}

  function applyRelease(){
    if(applying)return;
    applying=true;
    try{
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
        const strong=brand.querySelector('strong');
        if(strong&&strong.textContent!==PRODUCT)strong.textContent=PRODUCT;
        const small=brand.querySelector('small');
        if(small){
          const label=`v${RELEASE}`;
          if(small.textContent!==label)small.textContent=label;
          if(small.dataset.activeVersion!==RELEASE)small.dataset.activeVersion=RELEASE;
          if(small.getAttribute('aria-label')!==`Versión ${RELEASE}`)small.setAttribute('aria-label',`Versión ${RELEASE}`);
          if(small.getAttribute('data-runtime-label')!==label)small.setAttribute('data-runtime-label',label);
        }
      });
      window.__ATLAS_RELEASE_GUARD_HEALTH__={status:'ready',release:RELEASE,build:BUILD,mutationPolicy:'ROOT_ATTRIBUTES_ONLY',visibleVersionPolicy:'ATLAS_RELEASE_GUARD_ONLY',assetCoherency:'ALL_LOCAL_JS_CSS_PINNED_TO_CURRENT_BUILD',uiAuthority:'ATLAS_CURRENT_UI_LAST_WRITER',checkedAt:new Date().toISOString()};
    }finally{applying=false;}
  }

  function queueApply(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;applyRelease();});}
  function watchRelease(){
    applyRelease();
    if(observer)return;
    observer=new MutationObserver(()=>{
      if(root.getAttribute('data-aml-version')!==RELEASE||root.getAttribute('data-aml-build')!==BUILD||root.getAttribute('data-atlas-release')!==RELEASE)queueApply();
    });
    observer.observe(root,{attributes:true,attributeFilter:['data-aml-version','data-aml-build','data-atlas-release']});
  }
  function reloadCurrent(manifest){
    const key=`${manifest.release}:${manifest.build}`;
    const count=Number(sessionStorage.getItem(RELOAD_KEY)||0);
    const url=new URL(location.href);
    if(url.searchParams.get('atlas_release')===key||count>=MAX_RELOADS)return;
    sessionStorage.setItem(RELOAD_KEY,String(count+1));
    url.searchParams.set('atlas_release',key);
    url.searchParams.set('_atlas',Date.now().toString(36));
    location.replace(url.toString());
  }
  async function verifyManifest(){
    try{
      const url=new URL(MANIFEST,location.href);url.searchParams.set('_atlas',Date.now().toString(36));
      const res=await fetch(url.toString(),{cache:'no-store',headers:{'Cache-Control':'no-cache'}});
      if(!res.ok)throw new Error(`release manifest HTTP ${res.status}`);
      const manifest=await res.json();window.__ATLAS_RELEASE_MANIFEST__=manifest;
      if(manifest.release!==RELEASE||manifest.build!==BUILD){reloadCurrent(manifest);return false;}
      sessionStorage.removeItem(RELOAD_KEY);applyRelease();return true;
    }catch(error){
      console.warn('[ATLAS] release manifest check unavailable',error);
      window.__ATLAS_RELEASE_GUARD_HEALTH__={status:'manifest-unavailable',release:RELEASE,build:BUILD,error:String(error?.message||error),checkedAt:new Date().toISOString()};
      applyRelease();return false;
    }
  }
  window.AtlasRelease={version:RELEASE,build:BUILD,product:PRODUCT,policy:'SINGLE_ACTIVE_RELEASE',apply:applyRelease,verify:verifyManifest};
  applyRelease();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watchRelease,{once:true});else watchRelease();
  window.addEventListener('pageshow',()=>void verifyManifest());
  window.addEventListener('focus',()=>void verifyManifest());
  window.addEventListener('atlas:themechange',queueApply);
  void verifyManifest();
  for(const ms of [0,120,350,900,1800,4000,8000])setTimeout(applyRelease,ms);
})();