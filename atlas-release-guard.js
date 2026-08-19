'use strict';

/* ATLAS AML · single active release authority.
 * From v0.42.0 onward, historical source layers may remain in Git history or as
 * internal compatibility dependencies, but they are not allowed to reclaim the
 * visible/runtime release or keep a stale document alive.
 */
(function atlasSingleReleaseAuthority(){
  const RELEASE='0.42.0';
  const BUILD='0420';
  const PRODUCT='ATLAS AML';
  const TAGLINE='Plataforma Integrada de Inteligencia y Riesgo';
  const MANIFEST='./atlas-release.json';
  const MAX_RELOADS=2;
  const RELOAD_KEY='atlas-release-reload-count';
  const root=document.documentElement;
  let applying=false;
  let observer=null;

  function applyRelease(){
    if(applying)return;
    applying=true;
    try{
      root.setAttribute('data-aml-version',RELEASE);
      root.setAttribute('data-aml-build',BUILD);
      root.setAttribute('data-atlas-release',RELEASE);
      root.setAttribute('data-atlas-release-policy','single-active');
      window.__AML_ACTIVE_VERSION__=RELEASE;
      window.__AML_BUILD__=BUILD;
      window.__ATLAS_ACTIVE_VERSION__=RELEASE;
      window.__ATLAS_RELEASE_BUILD__=BUILD;
      window.__AML_VERSION_SOURCE__='atlas-release-guard';

      const wantedTitle=`${PRODUCT} · v${RELEASE}`;
      if(document.title!==wantedTitle)document.title=wantedTitle;
      const meta=document.querySelector('meta[name="application-name"]');
      if(meta)meta.content=`${PRODUCT} · ${TAGLINE}`;

      document.querySelectorAll('.topbar .eyebrow,.v18-pagehead .eyebrow').forEach(el=>{
        if(el.textContent!==wantedTitle)el.textContent=wantedTitle;
      });
      document.querySelectorAll('.v019-brand').forEach(brand=>{
        const strong=brand.querySelector('strong');
        if(strong&&strong.textContent!==PRODUCT)strong.textContent=PRODUCT;
        const small=brand.querySelector('small');
        if(small){
          if(/(?:Operational Radar|WorkBench|Workbench|\bv?0\.\d+)/i.test(small.textContent||''))small.textContent=TAGLINE;
          small.dataset.activeVersion=RELEASE;
        }
      });
    }finally{applying=false;}
  }

  function watchRelease(){
    applyRelease();
    if(observer)return;
    observer=new MutationObserver(()=>queueMicrotask(applyRelease));
    observer.observe(root,{attributes:true,attributeFilter:['data-aml-version','data-aml-build','data-atlas-release'],childList:true,subtree:true});
  }

  function reloadCurrent(manifest){
    const key=`${manifest.release}:${manifest.build}`;
    const count=Number(sessionStorage.getItem(RELOAD_KEY)||0);
    const url=new URL(location.href);
    if(url.searchParams.get('atlas_release')===key)return;
    if(count>=MAX_RELOADS)return;
    sessionStorage.setItem(RELOAD_KEY,String(count+1));
    url.searchParams.set('atlas_release',key);
    url.searchParams.set('_atlas',Date.now().toString(36));
    location.replace(url.toString());
  }

  async function verifyManifest(){
    try{
      const url=new URL(MANIFEST,location.href);
      url.searchParams.set('_atlas',Date.now().toString(36));
      const res=await fetch(url.toString(),{cache:'no-store',headers:{'Cache-Control':'no-cache'}});
      if(!res.ok)throw new Error(`release manifest HTTP ${res.status}`);
      const manifest=await res.json();
      window.__ATLAS_RELEASE_MANIFEST__=manifest;
      if(manifest.release!==RELEASE||manifest.build!==BUILD){
        reloadCurrent(manifest);
        return false;
      }
      sessionStorage.removeItem(RELOAD_KEY);
      applyRelease();
      return true;
    }catch(error){
      console.warn('[ATLAS] release manifest check unavailable',error);
      applyRelease();
      return false;
    }
  }

  window.AtlasRelease={
    version:RELEASE,
    build:BUILD,
    product:PRODUCT,
    policy:'SINGLE_ACTIVE_RELEASE',
    apply:applyRelease,
    verify:verifyManifest
  };

  applyRelease();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watchRelease,{once:true});
  else watchRelease();
  window.addEventListener('pageshow',()=>void verifyManifest());
  window.addEventListener('focus',()=>void verifyManifest());
  void verifyManifest();
  for(const ms of [0,120,350,900,1800,4000,8000])setTimeout(applyRelease,ms);
})();
