'use strict';
/* ATLAS AML · Gasto Público · cargador GP12 */
(function atlasGastoPublicoLoader1200(){
  if(window.__ATLAS_GP12_LOADER__)return;
  window.__ATLAS_GP12_LOADER__=true;
  const origin=(document.currentScript&&document.currentScript.src)||location.href;
  const append=(name,done)=>{
    const s=document.createElement('script');
    s.src=new URL(name,origin).href;
    s.onload=()=>done&&done();
    s.onerror=()=>{console.error('[ATLAS] No fue posible cargar',name);};
    document.head.appendChild(s);
  };
  append('./atlas-gasto-publico-gp11-base.js?v=1200',()=>{
    append('./atlas-gasto-publico-interactions-1200.js?v=1200');
  });
})();