'use strict';

/* AML Workbench v0.33.3 · final visible runtime/version authority. */
const V0333_RUNTIME='0.33.3';
const V0333_RUNTIME_BUILD='0333';
function v0333ApplyVersion(){
  try{if(typeof V0206_VERSION_OBSERVER!=='undefined'&&V0206_VERSION_OBSERVER){V0206_VERSION_OBSERVER.disconnect();V0206_VERSION_OBSERVER=null;}}catch{}
  window.__AML_ACTIVE_VERSION__=V0333_RUNTIME;
  window.__AML_BUILD__=V0333_RUNTIME_BUILD;
  const label=`Operational Radar · v${V0333_RUNTIME}`;
  const badge=document.querySelector('.v019-brand small');
  if(badge){badge.textContent=label;badge.setAttribute('aria-label',label);badge.setAttribute('data-runtime-label',label);badge.dataset.activeVersion=V0333_RUNTIME;}
  document.title=`AML Analytical Workbench · v${V0333_RUNTIME}`;
  document.documentElement.setAttribute('data-aml-version',V0333_RUNTIME);
  document.documentElement.setAttribute('data-aml-build',V0333_RUNTIME_BUILD);
}
const v0333BaseShell=shell;
shell=function(...args){v0333BaseShell(...args);v0333ApplyVersion();};
if(typeof v0211ApplyVersion==='function')v0211ApplyVersion=v0333ApplyVersion;
window.__AML_RUNTIME_VERSION_APPLIER__=v0333ApplyVersion;
v0333ApplyVersion();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',v0333ApplyVersion,{once:true});
