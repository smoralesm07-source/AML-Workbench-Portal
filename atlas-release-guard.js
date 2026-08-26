'use strict';
/* ATLAS AML · single active release authority 0.90.1 · freeze-safe */
(function atlasSingleReleaseAuthority(){
  const PRODUCT='ATLAS AML',TAGLINE='Plataforma Integrada de Inteligencia y Riesgo',MANIFEST='./atlas-release.json';
  const root=document.documentElement;
  const active={release:'0.90.1',build:'0901'};
  let applying=false,observer=null,queued=false;

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
      window.__AML_VERSION_SOURCE__='atlas-release-guard-0901-freeze-safe';
      const wantedTitle=`${PRODUCT} · v${active.release}`;
      if(document.title!==wantedTitle)document.title=wantedTitle;
      const meta=document.querySelector('meta[name="application-name"]');
      if(meta&&meta.content!==`${PRODUCT} · ${TAGLINE}`)meta.content=`${PRODUCT} · ${TAGLINE}`;
      applyVisibleIdentity();
      window.__ATLAS_RELEASE_GUARD_HEALTH__={status:'ready',release:active.release,build:active.build,visibleVersionPolicy:'ATLAS_RELEASE_GUARD_0901_ONLY',runtimePolicy:'CANONICAL_COMPILED_RUNTIME_ONLY',freezeGuard:'NO_GLOBAL_CHILD_MUTATION_OBSERVER',checkedAt:new Date().toISOString()};
    }finally{applying=false;}
  }

  function queueApply(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;applyRelease();});}
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
      window.__ATLAS_RELEASE_GUARD_HEALTH__={status:'manifest-unavailable',release:active.release,build:active.build,freezeGuard:'NO_GLOBAL_CHILD_MUTATION_OBSERVER',error:String(error?.message||error),checkedAt:new Date().toISOString()};
      applyRelease();return false;
    }
  }

  const api={product:PRODUCT,policy:'SINGLE_ACTIVE_RELEASE',runtimePolicy:'CANONICAL_COMPILED_RUNTIME_ONLY',apply:applyRelease,verify:verifyManifest};
  Object.defineProperties(api,{version:{get:()=>active.release},build:{get:()=>active.build}});
  window.AtlasRelease=api;
  applyRelease();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watchRootAttributes,{once:true});else watchRootAttributes();
  window.addEventListener('pageshow',()=>{applyRelease();void verifyManifest();});
  window.addEventListener('focus',()=>void verifyManifest());
  window.addEventListener('atlas:themechange',queueApply);
  void verifyManifest();
  for(const ms of [120,500,1500,4000])setTimeout(applyRelease,ms);
})();
