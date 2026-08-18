'use strict';

/* AML Workbench v0.34.2 · single visible runtime/version authority.
 * Historical feature modules remain loaded for compatibility, but they are not
 * allowed to become visible version authorities. This layer is loaded last.
 */
const V0342_RUNTIME='0.34.2';
const V0342_BUILD='0342';

function v0342ApplyVersion(){
  try{
    if(typeof V0206_VERSION_OBSERVER!=='undefined'&&V0206_VERSION_OBSERVER){
      V0206_VERSION_OBSERVER.disconnect();
      V0206_VERSION_OBSERVER=null;
    }
  }catch{}

  window.__AML_ACTIVE_VERSION__=V0342_RUNTIME;
  window.__AML_BUILD__=V0342_BUILD;
  window.__AML_VERSION_SOURCE__='v0342-runtime';

  document.title=`AML Analytical Workbench · v${V0342_RUNTIME}`;
  document.documentElement.setAttribute('data-aml-version',V0342_RUNTIME);
  document.documentElement.setAttribute('data-aml-build',V0342_BUILD);

  const runtimeLabel=`Operational Radar · v${V0342_RUNTIME}`;
  document.querySelectorAll('.v019-brand small').forEach((el)=>{
    el.textContent=runtimeLabel;
    el.setAttribute('data-runtime-label',runtimeLabel);
    el.setAttribute('aria-label',runtimeLabel);
    el.dataset.activeVersion=V0342_RUNTIME;
  });

  document.querySelectorAll('.topbar .eyebrow').forEach((el)=>{
    const text=String(el.textContent||'');
    if(/AML Analytical Workbench/i.test(text)||/\bv\d+\.\d+(?:\.\d+)?\b/.test(text)){
      el.textContent=`AML Analytical Workbench · v${V0342_RUNTIME}`;
    }
  });
}

if(typeof shell==='function'){
  const v0342BaseShell=shell;
  shell=function(...args){
    v0342BaseShell(...args);
    v0342ApplyVersion();
  };
}

try{
  if(typeof v0211ApplyVersion==='function')v0211ApplyVersion=v0342ApplyVersion;
}catch{}

window.__AML_RUNTIME_VERSION_APPLIER__=v0342ApplyVersion;
v0342ApplyVersion();

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',v0342ApplyVersion,{once:true});
}
