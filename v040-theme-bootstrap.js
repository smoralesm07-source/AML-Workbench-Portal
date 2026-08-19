(function(){
  'use strict';

  const KEY='atlas-aml:theme:v1';
  let theme='dark';
  try{
    const saved=localStorage.getItem(KEY);
    if(saved==='light'||saved==='dark')theme=saved;
  }catch{}
  document.documentElement.setAttribute('data-atlas-theme',theme);
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

  /* Styles may load immediately; behavior waits until the legacy/runtime scripts
   * have completed so the AIE brand layer is the final authority in the header. */
  addStyle('./v0401-radar-graphics-fix.css?b=0401','radar-graphics-css');
  addStyle('./v0402-aie-brand.css?b=0402','aie-brand-css');

  function loadRuntimeFixes(){
    addScript('./v0401-radar-graphics-fix.js?b=0401','radar-graphics-js');
    addScript('./v0402-aie-brand.js?b=0402','aie-brand-js');
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',loadRuntimeFixes,{once:true});
  else loadRuntimeFixes();
})();
