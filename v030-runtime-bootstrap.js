'use strict';

/* v0.30.0 · final and only visible runtime/version authority. */
const V030_RUNTIME='0.30.0';
const V030_RUNTIME_BUILD='0300';
function v030ApplyVersion(){
  try{if(typeof V0206_VERSION_OBSERVER!=='undefined'&&V0206_VERSION_OBSERVER){V0206_VERSION_OBSERVER.disconnect();V0206_VERSION_OBSERVER=null;}}catch{}
  window.__AML_ACTIVE_VERSION__=V030_RUNTIME;window.__AML_BUILD__=V030_RUNTIME_BUILD;
  const label=`Operational Radar · v${V030_RUNTIME}`;const badge=document.querySelector('.v019-brand small');
  if(badge){badge.setAttribute('data-runtime-label',label);badge.setAttribute('aria-label',label);badge.dataset.activeVersion=V030_RUNTIME;badge.textContent=label;}
  document.title=`AML Analytical Workbench · v${V030_RUNTIME}`;
  document.documentElement.setAttribute('data-aml-version',V030_RUNTIME);document.documentElement.setAttribute('data-aml-build',V030_RUNTIME_BUILD);
}
const v030RuntimeBaseShell=shell;shell=function(title,subtitle){v030RuntimeBaseShell(title,subtitle);v030ApplyVersion();};
if(typeof v0211ApplyVersion==='function')v0211ApplyVersion=v030ApplyVersion;
window.__AML_RUNTIME_VERSION_APPLIER__=v030ApplyVersion;
v030ApplyVersion();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',v030ApplyVersion,{once:true});
