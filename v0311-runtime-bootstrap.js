'use strict';

/* v0.31.1 · final and only visible runtime/version authority. */
const V0311_RUNTIME='0.31.1';
const V0311_RUNTIME_BUILD='0311';
function v0311ApplyVersion(){
  try{if(typeof V0206_VERSION_OBSERVER!=='undefined'&&V0206_VERSION_OBSERVER){V0206_VERSION_OBSERVER.disconnect();V0206_VERSION_OBSERVER=null;}}catch{}
  window.__AML_ACTIVE_VERSION__=V0311_RUNTIME;window.__AML_BUILD__=V0311_RUNTIME_BUILD;
  const label=`Operational Radar · v${V0311_RUNTIME}`;
  const badge=document.querySelector('.v019-brand small');
  if(badge){badge.setAttribute('data-runtime-label',label);badge.setAttribute('aria-label',label);badge.dataset.activeVersion=V0311_RUNTIME;badge.textContent=label;}
  document.title=`AML Analytical Workbench · v${V0311_RUNTIME}`;
  document.documentElement.setAttribute('data-aml-version',V0311_RUNTIME);
  document.documentElement.setAttribute('data-aml-build',V0311_RUNTIME_BUILD);
}
const v0311RuntimeBaseShell=shell;
shell=function(title,subtitle){v0311RuntimeBaseShell(title,subtitle);v0311ApplyVersion();};
if(typeof v0211ApplyVersion==='function')v0211ApplyVersion=v0311ApplyVersion;
window.__AML_RUNTIME_VERSION_APPLIER__=v0311ApplyVersion;
v0311ApplyVersion();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',v0311ApplyVersion,{once:true});
