'use strict';

/* v0.32.1 · final and only visible runtime/version authority. */
const V0321_RUNTIME='0.32.1';
const V0321_RUNTIME_BUILD='0321';
function v0321ApplyVersion(){
  try{if(typeof V0206_VERSION_OBSERVER!=='undefined'&&V0206_VERSION_OBSERVER){V0206_VERSION_OBSERVER.disconnect();V0206_VERSION_OBSERVER=null;}}catch{}
  window.__AML_ACTIVE_VERSION__=V0321_RUNTIME;window.__AML_BUILD__=V0321_RUNTIME_BUILD;
  const label=`Operational Radar · v${V0321_RUNTIME}`;const badge=document.querySelector('.v019-brand small');
  if(badge){badge.setAttribute('data-runtime-label',label);badge.setAttribute('aria-label',label);badge.dataset.activeVersion=V0321_RUNTIME;badge.textContent=label;}
  document.title=`AML Analytical Workbench · v${V0321_RUNTIME}`;
  document.documentElement.setAttribute('data-aml-version',V0321_RUNTIME);document.documentElement.setAttribute('data-aml-build',V0321_RUNTIME_BUILD);
}
const v0321RuntimeBaseShell=shell;shell=function(title,subtitle){v0321RuntimeBaseShell(title,subtitle);v0321ApplyVersion();};
if(typeof v0211ApplyVersion==='function')v0211ApplyVersion=v0321ApplyVersion;
window.__AML_RUNTIME_VERSION_APPLIER__=v0321ApplyVersion;
v0321ApplyVersion();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',v0321ApplyVersion,{once:true});
