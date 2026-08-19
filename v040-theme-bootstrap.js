(function(){
  'use strict';

  /* First-paint theme bootstrap only. Runtime/UI assets are loaded by the
   * canonical ATLAS manifest; this file must not inject scripts or styles. */
  const KEY='atlas-aml:theme:v1';
  let theme='dark';
  try{
    const saved=localStorage.getItem(KEY);
    if(saved==='light'||saved==='dark')theme=saved;
  }catch{}
  const root=document.documentElement;
  if(root.getAttribute('data-atlas-theme')!==theme)root.setAttribute('data-atlas-theme',theme);
  root.style.colorScheme=theme;
  window.__ATLAS_THEME__=theme;
  window.__ATLAS_THEME_BOOTSTRAP__={status:'ready',mode:'FIRST_PAINT_ONLY',theme};
})();
