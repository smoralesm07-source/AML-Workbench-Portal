'use strict';
/* ATLAS AML · legacy public-spend compatibility shim.
 * Production uses atlas-public-spend-v2.js directly. This file exists only so an
 * older source/dev reference to 0573 resolves forward to GP2 instead of restoring
 * the retired v037/Audit/Guided route.
 */
(function(){
  const VERSION='0573-GP2-SHIM';
  const SCRIPT_ID='atlas-public-spend-v2-shim-script';
  const api=()=>window.AtlasPublicSpendV2||null;
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  function publish(status,extra={}){window.__ATLAS_PUBLIC_SPEND_MOBILE_0573__={status,version:VERSION,target:'GP2.1',checkedAt:new Date().toISOString(),...extra};}
  async function ensure(){
    if(api())return api();
    let script=document.getElementById(SCRIPT_ID);
    if(!script){
      script=document.createElement('script');script.id=SCRIPT_ID;script.src='./assets/atlas-public-spend-v2.js?v=gp2-1';script.async=false;
      document.head.appendChild(script);
    }
    for(let i=0;i<80&&!api();i++)await wait(50);
    if(!api())throw new Error('No fue posible inicializar Gasto Público v2');
    return api();
  }
  const proxy={
    open:async(...args)=>(await ensure()).open(...args),
    load:async(...args)=>(await ensure()).load(...args),
    render:(...args)=>api()?.render?.(...args)??false,
    recover:async()=>{const x=await ensure();return x.render?.()??x.open?.();},
    health:()=>api()?.health?.()||window.__ATLAS_PUBLIC_SPEND_MOBILE_0573__||null
  };
  window.AtlasPublicSpendMobile0573=proxy;
  window.AtlasPublicSpendRoute0573=proxy;
  publish('compatibility-shim-installed');
})();
