(function(){
  'use strict';

  const KEY='atlas-aml:theme:v1';
  const RELEASE_BUILD='0422';
  let theme='dark';
  try{
    const saved=localStorage.getItem(KEY);
    if(saved==='light'||saved==='dark')theme=saved;
  }catch{}
  if(document.documentElement.getAttribute('data-atlas-theme')!==theme)document.documentElement.setAttribute('data-atlas-theme',theme);
  document.documentElement.style.colorScheme=theme;

  function addStyle(href,key){
    if(document.querySelector(`link[data-atlas-asset="${key}"]`))return;
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href=href;
    link.dataset.atlasAsset=key;
    document.head.appendChild(link);
  }
  function addScript(src,key){
    if(document.querySelector(`script[data-atlas-asset="${key}"]`))return;
    const script=document.createElement('script');
    script.src=src;
    script.async=false;
    script.dataset.atlasAsset=key;
    document.head.appendChild(script);
  }

  addStyle(`./v0401-radar-graphics-fix.css?r=${RELEASE_BUILD}`,'radar-graphics-css');
  addStyle(`./v0402-aie-brand.css?r=${RELEASE_BUILD}`,'aie-brand-css');

  function loadRuntimeFixes(){
    addScript(`./v0401-radar-graphics-fix.js?r=${RELEASE_BUILD}`,'radar-graphics-js');
    addScript(`./v0402-aie-brand.js?r=${RELEASE_BUILD}`,'aie-brand-js');
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',loadRuntimeFixes,{once:true});
  else loadRuntimeFixes();
})();
