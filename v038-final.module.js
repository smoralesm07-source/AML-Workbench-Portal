'use strict';

/* AML Workbench v0.38.0 · final runtime authority + Entity 360 cleanup */
const VERSION='0.38.0';
const BUILD='0380';

function cleanLegacyEntityBridge(){
  document.querySelectorAll('[data-v037-entity-bridge]').forEach(el=>el.remove());
}
function applyVersion(){
  window.__AML_ACTIVE_VERSION__=VERSION;
  window.__AML_BUILD__=BUILD;
  window.__AML_VERSION_SOURCE__='v038-final.module';
  document.title=`AML Analytical Workbench · v${VERSION}`;
  document.documentElement.setAttribute('data-aml-version',VERSION);
  document.documentElement.setAttribute('data-aml-build',BUILD);
  document.querySelectorAll('.v019-brand small').forEach(el=>{el.textContent=`Operational Radar · v${VERSION}`;el.dataset.activeVersion=VERSION;});
  document.querySelectorAll('.topbar .eyebrow').forEach(el=>{el.textContent=`AML Analytical Workbench · v${VERSION}`;});
  cleanLegacyEntityBridge();
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
