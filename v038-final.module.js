'use strict';

/* ATLAS AML v0.39.0 · final visible runtime authority
 * Compatibility note: technical AML identifiers remain unchanged.
 * This compatibility shim is still named v038-final.module.js because it is
 * already part of the stable portal boot chain.
 */
const VERSION='0.39.0';
const BUILD='0390';
const PRODUCT='ATLAS AML';
const TAGLINE='Plataforma Integrada de Inteligencia y Riesgo';

function cleanLegacyEntityBridge(){
  document.querySelectorAll('[data-v037-entity-bridge]').forEach(el=>el.remove());
}
function ensureAtlasAssets(){
  if(!document.querySelector('link[href*="v039-atlas-brand.css"]')){
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='./v039-atlas-brand.css?b=0390';
    link.dataset.atlasV039='1';
    document.head.appendChild(link);
  }
  if(!window.__ATLAS_V039_LOADING__){
    window.__ATLAS_V039_LOADING__=true;
    import('./v039-atlas-brand.js?b=0390').catch(error=>{
      window.__ATLAS_V039_LOADING__=false;
      console.warn('ATLAS visible layer could not load:',error);
    });
  }
}
function applyVersion(){
  window.__AML_ACTIVE_VERSION__=VERSION;
  window.__AML_BUILD__=BUILD;
  window.__AML_VERSION_SOURCE__='v038-final.module/atlas-v039';
  window.__ATLAS_ACTIVE_VERSION__=VERSION;
  document.title=`${PRODUCT} · v${VERSION}`;
  document.documentElement.setAttribute('data-aml-version',VERSION);
  document.documentElement.setAttribute('data-aml-build',BUILD);
  document.documentElement.setAttribute('data-product','atlas-aml');
  const meta=document.querySelector('meta[name="application-name"]');
  if(meta)meta.content=`${PRODUCT} · ${TAGLINE}`;
  document.querySelectorAll('.v019-brand .mark').forEach(el=>{el.textContent='A';});
  document.querySelectorAll('.v019-brand strong').forEach(el=>{el.textContent=PRODUCT;});
  document.querySelectorAll('.v019-brand small').forEach(el=>{el.textContent=TAGLINE;el.dataset.activeVersion=VERSION;});
  document.querySelectorAll('.topbar .eyebrow,.v18-pagehead .eyebrow').forEach(el=>{el.textContent=`${PRODUCT} · v${VERSION}`;});
  document.querySelectorAll('.auth-card .brand-mark').forEach(el=>{el.textContent='ATLAS';});
  cleanLegacyEntityBridge();
  ensureAtlasAssets();
}

if(typeof window.shell==='function'){
  const baseShell=window.shell;
  window.shell=function(...args){const result=baseShell(...args);applyVersion();return result;};
}
if(typeof window.navigate==='function'){
  const baseNavigate=window.navigate;
  window.navigate=async function(...args){const result=await baseNavigate(...args);applyVersion();return result;};
}
if(typeof window.openEntity==='function'&&!window.openEntity.__v038Entity360){
  const baseOpen=window.openEntity;
  const wrapped=async function(...args){const result=await baseOpen(...args);cleanLegacyEntityBridge();setTimeout(cleanLegacyEntityBridge,0);setTimeout(cleanLegacyEntityBridge,80);return result;};
  wrapped.__v038Entity360=true;
  window.openEntity=wrapped;
}

window.__AML_RUNTIME_VERSION_APPLIER__=applyVersion;
applyVersion();
for(const ms of [0,160,420,900])setTimeout(()=>{applyVersion();cleanLegacyEntityBridge();},ms);
