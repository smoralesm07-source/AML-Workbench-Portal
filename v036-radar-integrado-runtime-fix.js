'use strict';

/* v0.36.0 runtime fix · app.js exposes `state` as a global lexical binding,
 * not as window.state. This final classic-script layer makes post-render
 * enhancements depend on the actual governed view state. */
const v036RuntimeBaseOverview=v019LoadOverview;
v019LoadOverview=async function(...args){
  const result=await v036RuntimeBaseOverview(...args);
  const ctx=window.__AML_V036_CONTEXT;
  if(ctx&&typeof state!=='undefined'&&state.view==='overview'&&!Array.isArray(ctx.crossSector)){
    try{
      ctx.crossSector=await v036LoadCrossSector();
      V036_STATE.ctx=ctx;
      v036RenderFilteredConvergence();
    }catch(error){
      console.warn('[AML v0.36] governed sector convergence unavailable',error);
    }
  }
  if(typeof v036DecorateNativeSpendCard==='function')v036DecorateNativeSpendCard();
  const strip=document.querySelector('#v0344-public-overview');
  const slot=document.querySelector('.v036-public-slot');
  if(strip&&slot&&strip.parentElement!==slot)slot.appendChild(strip);
  return result;
};
loadOverview=v019LoadOverview;

const v036RuntimeObserver=new MutationObserver(()=>{
  if(typeof state==='undefined'||state.view!=='overview')return;
  if(typeof v036DecorateNativeSpendCard==='function')v036DecorateNativeSpendCard();
  const strip=document.querySelector('#v0344-public-overview');
  const slot=document.querySelector('.v036-public-slot');
  if(strip&&slot&&strip.parentElement!==slot)slot.appendChild(strip);
});
v036RuntimeObserver.observe(document.documentElement,{childList:true,subtree:true});

window.__AML_V036_RUNTIME_FIX__={stateBinding:'GLOBAL_LEXICAL_STATE',windowStateDependency:false,crossSectorRetry:true};
