'use strict';

/* v0.33.1 · final visible runtime authority after OSFL framing hardening. */
const V0331_RUNTIME='0.33.1';
const V0331_RUNTIME_BUILD='0331';
function v0331RuntimeApplyVersion(){
  try{if(typeof V0206_VERSION_OBSERVER!=='undefined'&&V0206_VERSION_OBSERVER){V0206_VERSION_OBSERVER.disconnect();V0206_VERSION_OBSERVER=null;}}catch{}
  window.__AML_ACTIVE_VERSION__=V0331_RUNTIME;window.__AML_BUILD__=V0331_RUNTIME_BUILD;
  const label=`Operational Radar · v${V0331_RUNTIME}`;
  const badge=document.querySelector('.v019-brand small');
  if(badge){badge.setAttribute('data-runtime-label',label);badge.setAttribute('aria-label',label);badge.dataset.activeVersion=V0331_RUNTIME;badge.textContent=label;}
  document.title=`AML Analytical Workbench · v${V0331_RUNTIME}`;
  document.documentElement.setAttribute('data-aml-version',V0331_RUNTIME);
  document.documentElement.setAttribute('data-aml-build',V0331_RUNTIME_BUILD);
}
const v0331RuntimeBaseShell=shell;
shell=function(title,subtitle){v0331RuntimeBaseShell(title,subtitle);v0331RuntimeApplyVersion();};
if(typeof v0211ApplyVersion==='function')v0211ApplyVersion=v0331RuntimeApplyVersion;
window.__AML_RUNTIME_VERSION_APPLIER__=v0331RuntimeApplyVersion;
v0331RuntimeApplyVersion();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',v0331RuntimeApplyVersion,{once:true});
