'use strict';
/* ATLAS AML · 0.90.1 · final UI/runtime hygiene authority */
(function atlasUiAuthority0901(){
  const RELEASE='0.90.1';
  const BUILD='0901';
  const CSS='./assets/atlas-ui-authority-0901.css?v=0901-1';
  const VERSION_RE=/\bv?(?:0\.)?(?:16|17|18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39|40|41|42|43|44|45|46|49|50|51|52|53|54|56|57|58|64|69|70|71|72|80|81|82|83|84)(?:\.\d+){0,2}\b/gi;
  const VERSION_SELECTORS='.atlas-version,.version-badge,.app-version,.v019-brand small,[data-atlas-version-label]';

  function installCss(){
    if(document.querySelector('link[data-atlas-ui-authority="0901"]')) return;
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href=CSS;
    link.dataset.atlasUiAuthority='0901';
    document.head.appendChild(link);
  }

  function normalizeIdentity(){
    const label=`v${RELEASE}`;
    document.documentElement.setAttribute('data-atlas-release',RELEASE);
    document.documentElement.setAttribute('data-aml-version',RELEASE);
    document.documentElement.setAttribute('data-aml-build',BUILD);
    document.querySelectorAll(VERSION_SELECTORS).forEach(el=>{
      const text=(el.textContent||'').trim();
      if(!text || VERSION_RE.test(text) || /^v?\d+(?:\.\d+)+$/i.test(text)) el.textContent=label;
      VERSION_RE.lastIndex=0;
      el.setAttribute('data-runtime-label',label);
      el.setAttribute('aria-label',`Versión ${RELEASE}`);
    });
    document.querySelectorAll('.topbar .eyebrow,.v18-pagehead .eyebrow').forEach(el=>{
      if(/ATLAS|AML|Operational Radar/i.test(el.textContent||'')) el.textContent=`ATLAS AML · ${label}`;
    });
  }

  function markHealth(){
    window.__ATLAS_UI_AUTHORITY__={release:RELEASE,build:BUILD,status:'ready',css:CSS,checkedAt:new Date().toISOString()};
  }

  function apply(){
    installCss();
    normalizeIdentity();
    window.AtlasRelease?.apply?.();
    markHealth();
  }

  apply();
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply,{once:true});
  for(const ms of [250,1000,2500]) setTimeout(apply,ms);
  window.addEventListener('pageshow',apply);
  window.addEventListener('atlas:navigate',apply);
  window.addEventListener('atlas:routechange',apply);
})();
