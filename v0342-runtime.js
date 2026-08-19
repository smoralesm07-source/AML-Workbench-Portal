'use strict';

/* Legacy v0.34.2 compatibility layer.
 * ATLAS current release is the ONLY visible/runtime version authority.
 * This file preserves the historical shell sequencing but must never write
 * 0.34.2 into document metadata, globals or visible branding again.
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

  if(window.AtlasRelease&&typeof window.AtlasRelease.apply==='function'){
    window.AtlasRelease.apply();
  }

  const current=String(
    window.__ATLAS_ACTIVE_VERSION__ ||
    document.documentElement.getAttribute('data-atlas-release') ||
    document.documentElement.getAttribute('data-aml-version') ||
    'current'
  );
  const build=String(
    window.__ATLAS_RELEASE_BUILD__ ||
    document.documentElement.getAttribute('data-aml-build') ||
    ''
  );

  window.__AML_ACTIVE_VERSION__=current;
  if(build)window.__AML_BUILD__=build;
  window.__AML_VERSION_SOURCE__='atlas-release-guard-via-v0342-compat';
  document.title=`ATLAS AML · v${current}`;

  document.querySelectorAll('.v019-brand').forEach((brand)=>{
    const strong=brand.querySelector('strong');
    if(strong&&strong.textContent!=='ATLAS AML')strong.textContent='ATLAS AML';
    const small=brand.querySelector('small');
    if(small){
      const label=`v${current}`;
      if(small.textContent!==label)small.textContent=label;
      small.setAttribute('data-runtime-label',label);
      small.setAttribute('aria-label',`Versión ${current}`);
      small.dataset.activeVersion=current;
    }
  });

  document.querySelectorAll('.topbar .eyebrow').forEach((el)=>{
    const wanted=`ATLAS AML · v${current}`;
    if(el.textContent!==wanted)el.textContent=wanted;
  });
}

if(typeof shell==='function'){
  const v0342BaseShell=shell;
  shell=function(...args){
    const result=v0342BaseShell(...args);
    v0342ApplyVersion();
    return result;
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
