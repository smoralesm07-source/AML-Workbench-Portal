'use strict';

/* AML Workbench v0.35.0 · final runtime authority */
const VERSION='0.35.0';
const BUILD='0350';

function applyVersion(){
  window.__AML_ACTIVE_VERSION__=VERSION;
  window.__AML_BUILD__=BUILD;
  window.__AML_VERSION_SOURCE__='v035-final.module';
  document.title=`AML Analytical Workbench · v${VERSION}`;
  document.documentElement.setAttribute('data-aml-version',VERSION);
  document.documentElement.setAttribute('data-aml-build',BUILD);
  const label=`Operational Radar · v${VERSION}`;
  document.querySelectorAll('.v019-brand small').forEach(el=>{
    el.textContent=label;
    el.setAttribute('aria-label',label);
    el.setAttribute('data-runtime-label',label);
    el.dataset.activeVersion=VERSION;
  });
  document.querySelectorAll('.topbar .eyebrow').forEach(el=>{el.textContent=`AML Analytical Workbench · v${VERSION}`;});
  document.querySelectorAll('.v019-nav [data-view="uaf"],.nav [data-view="uaf"]').forEach(el=>el.remove());
}

if(typeof window.shell==='function'){
  const baseShell=window.shell;
  window.shell=function(...args){const result=baseShell(...args);applyVersion();return result;};
}
if(typeof window.navigate==='function'){
  const baseNavigate=window.navigate;
  window.navigate=async function(view,...args){
    const target=view==='uaf'?'overview':view;
    const result=await baseNavigate(target,...args);
    applyVersion();
    return result;
  };
}
window.__AML_RUNTIME_VERSION_APPLIER__=applyVersion;
applyVersion();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{applyVersion();setTimeout(applyVersion,0);setTimeout(applyVersion,150);setTimeout(applyVersion,350);},{once:true});
else{setTimeout(applyVersion,0);setTimeout(applyVersion,150);setTimeout(applyVersion,350);}
