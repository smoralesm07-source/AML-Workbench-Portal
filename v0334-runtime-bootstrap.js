'use strict';

/* AML Workbench v0.33.4 · final visible runtime/version authority. */
const V0334_RUNTIME='0.33.4';
const V0334_RUNTIME_BUILD='0334';
function v0334ApplyVersion(){
  try{if(typeof V0206_VERSION_OBSERVER!=='undefined'&&V0206_VERSION_OBSERVER){V0206_VERSION_OBSERVER.disconnect();V0206_VERSION_OBSERVER=null;}}catch{}
  window.__AML_ACTIVE_VERSION__=V0334_RUNTIME;
  window.__AML_BUILD__=V0334_RUNTIME_BUILD;
  const label=`Operational Radar · v${V0334_RUNTIME}`;
  const badge=document.querySelector('.v019-brand small');
  if(badge){badge.textContent=label;badge.setAttribute('aria-label',label);badge.setAttribute('data-runtime-label',label);badge.dataset.activeVersion=V0334_RUNTIME;}
  document.title=`AML Analytical Workbench · v${V0334_RUNTIME}`;
  document.documentElement.setAttribute('data-aml-version',V0334_RUNTIME);
  document.documentElement.setAttribute('data-aml-build',V0334_RUNTIME_BUILD);
}
const v0334BaseShell=shell;
shell=function(...args){v0334BaseShell(...args);v0334ApplyVersion();};
if(typeof v0211ApplyVersion==='function')v0211ApplyVersion=v0334ApplyVersion;
window.__AML_RUNTIME_VERSION_APPLIER__=v0334ApplyVersion;
v0334ApplyVersion();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',v0334ApplyVersion,{once:true});
