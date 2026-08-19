'use strict';

/* Legacy Entity 360 compatibility layer.
 * Keeps Entity 360 cleanup/assets, but delegates all visible/runtime identity to
 * the current ATLAS release. No historical 0.39 authority remains here.
 */

function cleanLegacyEntityBridge(){
  document.querySelectorAll('[data-v037-entity-bridge]').forEach(el=>el.remove());
}

function ensureAtlasAssets(){
  if(!document.querySelector('link[href*="v039-atlas-brand.css"]')){
    const link=document.createElement('link');
    link.rel='stylesheet';
    const build=String(window.__ATLAS_RELEASE_BUILD__||document.documentElement.getAttribute('data-aml-build')||'current');
    link.href=`./v039-atlas-brand.css?r=${build}`;
    link.dataset.atlasV039='1';
    document.head.appendChild(link);
  }
}

function applyCurrentRelease(){
  if(window.AtlasRelease&&typeof window.AtlasRelease.apply==='function')window.AtlasRelease.apply();
  cleanLegacyEntityBridge();
  ensureAtlasAssets();
  window.__AML_VERSION_SOURCE__='atlas-release-guard-via-v038-compat';
}

if(typeof window.shell==='function'){
  const baseShell=window.shell;
  window.shell=function(...args){
    const result=baseShell(...args);
    applyCurrentRelease();
    return result;
  };
}
if(typeof window.navigate==='function'){
  const baseNavigate=window.navigate;
  window.navigate=async function(...args){
    const result=await baseNavigate(...args);
    applyCurrentRelease();
    return result;
  };
}
if(typeof window.openEntity==='function'&&!window.openEntity.__v038Entity360){
  const baseOpen=window.openEntity;
  const wrapped=async function(...args){
    const result=await baseOpen(...args);
    cleanLegacyEntityBridge();
    queueMicrotask(cleanLegacyEntityBridge);
    return result;
  };
  wrapped.__v038Entity360=true;
  window.openEntity=wrapped;
}

window.__AML_RUNTIME_VERSION_APPLIER__=()=>window.AtlasRelease?.apply?.();
applyCurrentRelease();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',applyCurrentRelease,{once:true});
