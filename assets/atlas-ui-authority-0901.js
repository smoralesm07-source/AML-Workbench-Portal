'use strict';
/* ATLAS AML · 0.90.1 · final UI/runtime hygiene authority */
(function atlasUiAuthority0901(){
  const RELEASE='0.90.1';
  const BUILD='0901';
  const CSS='./assets/atlas-ui-authority-0901.css?v=0901-2';
  const VERSION_RE=/\bv?(?:0\.)?(?:16|17|18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39|40|41|42|43|44|45|46|49|50|51|52|53|54|56|57|58|64|69|70|71|72|80|81|82|83|84)(?:\.\d+){0,2}\b/gi;
  const VERSION_SELECTORS='.atlas-version,.version-badge,.app-version,.v019-brand small,[data-atlas-version-label]';
  const RETIRED_MAIN_AUDIT_SELECTOR='#app .v024-audit,main .v024-audit,.v024-audit.a57-data-audit';

  function installCss(){
    const old=document.querySelector('link[data-atlas-ui-authority="0901"]');
    if(old){
      if(!old.href.includes('0901-2')) old.href=CSS;
      return;
    }
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

  function retireLegacyMainAudit(){
    let removed=0;
    document.querySelectorAll(RETIRED_MAIN_AUDIT_SELECTOR).forEach(el=>{
      el.remove();
      removed++;
    });
    const noAudit=()=>'';
    try{window.v024AuditHtml=noAudit;}catch(_e){}
    try{if(typeof v024AuditHtml!=='undefined')v024AuditHtml=noAudit;}catch(_e){}
    window.__ATLAS_MAIN_DATA_AUDIT_RETIRED__={status:'retired',release:RELEASE,removed,authority:'GLOBAL_SOURCE_HEALTH_TOPBAR_ONLY',checkedAt:new Date().toISOString()};
  }

  function markHealth(){
    window.__ATLAS_UI_AUTHORITY__={release:RELEASE,build:BUILD,status:'ready',css:CSS,mainDataAudit:'retired',checkedAt:new Date().toISOString()};
  }

  function apply(){
    installCss();
    normalizeIdentity();
    retireLegacyMainAudit();
    window.AtlasRelease?.apply?.();
    markHealth();
  }

  apply();
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply,{once:true});
  for(const ms of [0,80,250,700,1000,1800,2500,3500]) setTimeout(apply,ms);
  window.addEventListener('pageshow',apply);
  window.addEventListener('atlas:navigate',apply);
  window.addEventListener('atlas:routechange',apply);
  window.addEventListener('atlas:nav-refresh',apply);
})();
