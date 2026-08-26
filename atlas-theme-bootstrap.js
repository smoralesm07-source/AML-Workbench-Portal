(function(){
  'use strict';
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
  window.__ATLAS_THEME_BOOTSTRAP__={status:'ready',mode:'FIRST_PAINT_PLUS_SHELL_HANDOFF',theme};

  /*
   * Runtime shell handoff.
   * app.js is intentionally part of the very small authentication bootstrap and can
   * render its historical .shell before the current Atlas shell authority arrives in
   * the deferred runtime. As soon as v019-live is available, re-render once through
   * the current navigation authority. This prevents users from remaining in the
   * legacy "Analytical Workbench" chrome while keeping the critical bundle small.
   */
  let handedOff=false;
  const started=performance.now();
  const MAX_WAIT_MS=15000;

  function legacyShellVisible(){
    return !!document.querySelector('#app .shell') && !document.querySelector('#app .v019-shell');
  }
  function currentAuthorityReady(){
    return typeof window.v019LoadCore==='function' && typeof window.navigate==='function';
  }
  function handoff(){
    if(handedOff)return true;
    if(!legacyShellVisible()||!currentAuthorityReady())return false;
    handedOff=true;
    window.__ATLAS_SHELL_HANDOFF__={
      status:'switching',
      from:'legacy-app-shell',
      to:'atlas-current-shell',
      elapsedMs:Math.round(performance.now()-started),
      at:new Date().toISOString()
    };
    try{
      Promise.resolve(window.navigate('overview'))
        .then(()=>{
          window.AtlasCurrentUI?.refresh?.();
          window.__ATLAS_SHELL_HANDOFF__={
            ...window.__ATLAS_SHELL_HANDOFF__,
            status:'ready',
            completedAt:new Date().toISOString()
          };
        })
        .catch(error=>{
          handedOff=false;
          window.__ATLAS_SHELL_HANDOFF__={
            status:'error',
            error:String(error?.message||error),
            at:new Date().toISOString()
          };
        });
      return true;
    }catch(error){
      handedOff=false;
      window.__ATLAS_SHELL_HANDOFF__={status:'error',error:String(error?.message||error),at:new Date().toISOString()};
      return false;
    }
  }

  const timer=setInterval(()=>{
    if(handoff()||performance.now()-started>MAX_WAIT_MS)clearInterval(timer);
  },75);

  window.addEventListener('atlas:runtime-ready',()=>{
    handoff();
    window.AtlasCurrentUI?.refresh?.();
  });
})();