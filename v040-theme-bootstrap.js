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
})();
