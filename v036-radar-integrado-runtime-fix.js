'use strict';

/* v0.36.0 runtime fix · app.js exposes `state` as a global lexical binding,
 * not as window.state. This final classic-script layer makes post-render
 * enhancements depend on the actual governed view state. */
const V036_CROSS_ENTITY_VIEW='aml_v024_uaf_cross_entity';
const V036_UNIQUE_CROSS_CACHE=new Map();
let V036_UNIQUE_CROSS_TOKEN=0;
const V036_UNIQUE_RADARS=['RADAR_SII','RADAR_SANCIONES','RADAR_OSFL','RADAR_PRENSA'];
const V036_UNIQUE_CARD={RADAR_SII:'entities',RADAR_SANCIONES:'sanctions',RADAR_OSFL:'osfl',RADAR_PRENSA:'press'};

function v036CanonicalActiveSectors(ctx){
  const active=v036Filtered();
  const names=new Set();
  for(const x of v019Array(ctx?.crossSector)){
    if(active.some(r=>v036SectorEquivalent(r.name,x.sector_name)))names.add(String(x.sector_name));
  }
  return [...names].sort((a,b)=>a.localeCompare(b,'es',{sensitivity:'base'}));
}
async function v036UniqueCrossCounts(ctx){
  const sectors=v036CanonicalActiveSectors(ctx);
  if(!sectors.length)return Object.fromEntries(V036_UNIQUE_RADARS.map(r=>[r,0]));
  const key=sectors.join('\u001f');
  if(V036_UNIQUE_CROSS_CACHE.has(key))return V036_UNIQUE_CROSS_CACHE.get(key);
  const promise=Promise.all(V036_UNIQUE_RADARS.map(async radar=>{
    let q=sb.from(V036_CROSS_ENTITY_VIEW).select('entity_id',{count:'exact',head:true}).eq('radar_id',radar).overlaps('uaf_sector_names',sectors);
    const {count,error}=await q;
    if(error)throw error;
    return [radar,count||0];
  })).then(rows=>Object.fromEntries(rows));
  V036_UNIQUE_CROSS_CACHE.set(key,promise);
  try{return await promise;}catch(error){V036_UNIQUE_CROSS_CACHE.delete(key);throw error;}
}
function v036MarkCrossCardsLoading(){
  for(const radar of V036_UNIQUE_RADARS){
    const card=document.querySelector(`[data-v036-radar="${V036_UNIQUE_CARD[radar]}"]`);
    if(!card)continue;
    const stateLabel=card.querySelector('.v036-rcard-head span');
    const big=card.querySelector('strong');
    const copy=card.querySelector('p');
    if(stateLabel)stateLabel.textContent='entidades únicas';
    if(big)big.textContent='…';
    if(copy)copy.textContent='Calculando entidades únicas para el recorte sectorial activo…';
  }
}
async function v036HydrateUniqueCrossCounts(ctx){
  if(!ctx||!Array.isArray(ctx.crossSector))return;
  const token=++V036_UNIQUE_CROSS_TOKEN;
  v036MarkCrossCardsLoading();
  try{
    const counts=await v036UniqueCrossCounts(ctx);
    if(token!==V036_UNIQUE_CROSS_TOKEN||typeof state==='undefined'||state.view!=='overview')return;
    const labels={
      RADAR_SII:'Entidades únicas UAF del recorte con perfil/cruce SII materializado.',
      RADAR_SANCIONES:'Entidades únicas del recorte con sanción materializada.',
      RADAR_OSFL:'Entidades únicas del recorte observadas también en el universo OSFL.',
      RADAR_PRENSA:'Entidades únicas del recorte con observación de prensa materializada; prensa conserva aporte 0 al score.'
    };
    for(const radar of V036_UNIQUE_RADARS){
      const card=document.querySelector(`[data-v036-radar="${V036_UNIQUE_CARD[radar]}"]`);
      if(!card)continue;
      const big=card.querySelector('strong');
      const copy=card.querySelector('p');
      if(big)big.textContent=v036F(counts[radar]||0);
      if(copy)copy.textContent=labels[radar];
    }
  }catch(error){
    if(token!==V036_UNIQUE_CROSS_TOKEN)return;
    console.warn('[AML v0.36] exact unique cross-radar counts unavailable',error);
    for(const radar of V036_UNIQUE_RADARS){
      const card=document.querySelector(`[data-v036-radar="${V036_UNIQUE_CARD[radar]}"]`);
      if(!card)continue;
      const stateLabel=card.querySelector('.v036-rcard-head span');
      const copy=card.querySelector('p');
      if(stateLabel)stateLabel.textContent='presencias sectoriales';
      if(copy)copy.textContent='Conteo sectorial disponible; el conteo único no pudo materializarse en esta consulta. No se interpreta como número de personas distintas.';
    }
  }
}

/* Hydrate exact unique counts every time matrix filters redraw deck 04. */
const v036RuntimeBaseFilteredConvergence=v036RenderFilteredConvergence;
v036RenderFilteredConvergence=function(){
  const result=v036RuntimeBaseFilteredConvergence();
  const ctx=V036_STATE.ctx;
  if(ctx&&Array.isArray(ctx.crossSector))void v036HydrateUniqueCrossCounts(ctx);
  if(typeof v036DecorateNativeSpendCard==='function')v036DecorateNativeSpendCard();
  return result;
};

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

window.__AML_V036_RUNTIME_FIX__={
  stateBinding:'GLOBAL_LEXICAL_STATE',
  windowStateDependency:false,
  crossSectorRetry:true,
  uniqueCrossEntityView:V036_CROSS_ENTITY_VIEW,
  uniqueCrossCounts:'HEAD_COUNT_WITH_ARRAY_OVERLAP',
  sectorSumIsNotUniqueEntityCount:true
};
