'use strict';
/* ATLAS AML · 0.95.0 · final UI/runtime hygiene authority */
(function atlasUiAuthority0950(){
  const RELEASE='0.95.0';
  const BUILD='0950';
  const CSS='./assets/atlas-ui-authority-0901.css?v=0950-1';
  const LIGHT_CSS='./assets/atlas-light-authority-0901.css?v=0950-1';
  const LIGHT_MODULE_CSS='./assets/atlas-light-modules-0901.css?v=0950-1';
  const VERSION_RE=/\bv?(?:0\.)?(?:16|17|18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39|40|41|42|43|44|45|46|49|50|51|52|53|54|56|57|58|64|69|70|71|72|80|81|82|83|84|90|91|92|93|94|95)(?:\.\d+){0,2}\b/gi;
  const VERSION_SELECTORS='.atlas-version,.version-badge,.app-version,.v019-brand small,[data-atlas-version-label]';
  const AUDIT_SELECTORS='.v024-audit,.a57-data-audit';

  function ensureCss(selector,href,datasetKey,datasetValue){
    const old=document.querySelector(selector);
    if(old){
      if(!old.href.includes(href.split('?').pop())) old.href=href;
      return old;
    }
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href=href;
    link.dataset[datasetKey]=datasetValue;
    document.head.appendChild(link);
    return link;
  }

  function installCss(){
    ensureCss('link[data-atlas-ui-authority="0950"]',CSS,'atlasUiAuthority','0950');
    ensureCss('link[data-atlas-light-authority="0950"]',LIGHT_CSS,'atlasLightAuthority','0950');
    ensureCss('link[data-atlas-light-modules="0950"]',LIGHT_MODULE_CSS,'atlasLightModules','0950');
  }

  function ensureBrandVersion(label){
    const brand=document.querySelector('.v019-brand');
    if(!brand)return;
    let badge=brand.querySelector('small[data-atlas-version-label],small');
    if(!badge){
      badge=document.createElement('small');
      brand.appendChild(badge);
    }
    badge.setAttribute('data-atlas-version-label','1');
    badge.textContent=label;
    badge.setAttribute('data-runtime-label',label);
    badge.setAttribute('aria-label',`Versión ${RELEASE}`);
  }

  function normalizeIdentity(){
    const label=`v${RELEASE}`;
    document.documentElement.setAttribute('data-atlas-release',RELEASE);
    document.documentElement.setAttribute('data-aml-version',RELEASE);
    document.documentElement.setAttribute('data-aml-build',BUILD);
    ensureBrandVersion(label);
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

  function isGlobalSourceHealth(el){
    if(!el)return false;
    if(el.matches('.ash-audit,[data-ash0536],[data-atlas-audit-seed],[data-global-audit],[data-topbar-mode]'))return true;
    return !!el.closest('[data-atlas-global-audit-host],.v019-top,.topbar,.v18-appbar,.app-topbar,.atlas-topbar');
  }

  function retireLegacyMainAudit(){
    let removed=0;
    document.querySelectorAll(AUDIT_SELECTORS).forEach(el=>{
      if(isGlobalSourceHealth(el))return;
      el.remove();
      removed++;
    });
    const noAudit=()=>'';
    try{window.v024AuditHtml=noAudit;}catch(_e){}
    try{if(typeof v024AuditHtml!=='undefined')v024AuditHtml=noAudit;}catch(_e){}
    window.__ATLAS_MAIN_DATA_AUDIT_RETIRED__={status:'retired',release:RELEASE,removed,authority:'GLOBAL_SOURCE_HEALTH_TOPBAR_ONLY',checkedAt:new Date().toISOString()};
  }

  function markHealth(){
    window.__ATLAS_UI_AUTHORITY__={release:RELEASE,build:BUILD,status:'ready',css:CSS,lightCss:LIGHT_CSS,lightModulesCss:LIGHT_MODULE_CSS,lightTheme:'NEUTRAL_GREY_WHITE_ORANGE',mainDataAudit:'retired',globalSourceHealth:'preserved',osflEconomic:'0950-current',sanctionsSpectrum:'0940-current',checkedAt:new Date().toISOString()};
  }

  function apply(){
    installCss();
    normalizeIdentity();
    retireLegacyMainAudit();
    window.AtlasRelease?.apply?.();
    window.AtlasGlobalSourceHealth?.schedule?.();
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