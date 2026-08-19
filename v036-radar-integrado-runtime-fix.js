'use strict';

/* v0.36.0 runtime fix · app.js exposes `state` as a global lexical binding,
 * not as window.state. This final classic-script layer makes post-render
 * enhancements depend on the actual governed view state. */
const V036_CROSS_ENTITY_VIEW='aml_v024_uaf_cross_entity';
const V036_RECON_VIEW='aml_v0210_uaf_sii_reconciliation';
const V036_UNIQUE_CROSS_CACHE=new Map();
let V036_UNIQUE_CROSS_TOKEN=0;
let V036_RECON_LAST_GOOD=null;
let V036_RECON_TOKEN=0;
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

async function v036ReconCount(status){
  let q=sb.from(V036_RECON_VIEW).select('entity_id',{count:'exact',head:true});
  if(status)q=q.eq('reconciliation_status',status);
  const {count,error}=await q;
  if(error)throw error;
  return count||0;
}
async function v036LoadLiveReconciliationCounts(){
  const auth=await sb.auth.getSession();
  if(auth.error)throw auth.error;
  if(!auth.data?.session)throw new Error('Sesión Supabase no disponible para conciliación UAF↔SII.');
  const [total,active,terminated,noSii]=await Promise.all([
    v036ReconCount(),
    v036ReconCount('SII_ACTIVE'),
    v036ReconCount('SII_TERMINATED'),
    v036ReconCount('NO_SII_PROFILE')
  ]);
  if(!total)throw new Error('La vista de conciliación devolvió 0 filas bajo la sesión actual.');
  const counts={total,active,terminated,noSii,matched:active+terminated,review:terminated+noSii};
  V036_RECON_LAST_GOOD=counts;
  try{if(typeof V0205_COUNTS!=='undefined')V0205_COUNTS=counts;}catch{}
  return counts;
}
function v036BindReconciliationButtons(scope){
  scope?.querySelectorAll('[data-v036-recon]').forEach(b=>{
    if(b.dataset.v036ReconBound)return;
    b.addEventListener('click',()=>{if(typeof v0205LoadReconciliation==='function')void v0205LoadReconciliation(b.dataset.v036Recon);});
    b.dataset.v036ReconBound='1';
  });
}
function v036RenderLiveReconciliation(ctx,counts){
  if(!ctx||!counts)return;
  ctx.counts=counts;
  V036_STATE.ctx=ctx;
  const flow=document.querySelector('.v036-flow');
  const card=flow?.closest('.v036-card');
  if(!card)return;
  const keys=card.querySelector('.v036-flowkeys');
  const guard=card.querySelector('.v036-guard');
  if(!guard)return;
  flow?.remove();
  keys?.remove();
  guard.insertAdjacentHTML('beforebegin',v036Reconciliation(counts));
  const copy=card.querySelector('.v036-card-head p');
  if(copy)copy.textContent=`${v036F(counts.total)} SO materializados · ${v036F(counts.matched)} con cruce SII · unidad: RUT/entity_id.`;
  card.dataset.reconciliationHealth='live';
  card.dataset.reconciliationTotal=String(counts.total);
  card.dataset.reconciliationMatched=String(counts.matched);
  v036BindReconciliationButtons(card);
}
function v036MarkReconciliationUnavailable(error){
  const flow=document.querySelector('.v036-flow');
  const card=flow?.closest('.v036-card');
  if(!card)return;
  card.dataset.reconciliationHealth='degraded';
  const copy=card.querySelector('.v036-card-head p');
  if(copy)copy.textContent='Conciliación temporalmente no disponible bajo la sesión actual; no se interpreta como cero.';
  console.warn('[AML v0.36] UAF↔SII live reconciliation unavailable',error);
}
async function v036HydrateLiveReconciliation(ctx){
  const token=++V036_RECON_TOKEN;
  try{
    const counts=await v036LoadLiveReconciliationCounts();
    if(token!==V036_RECON_TOKEN||typeof state==='undefined'||state.view!=='overview')return counts;
    v036RenderLiveReconciliation(ctx,counts);
    window.__AML_UAF_SII_RECONCILIATION__={status:'success',source:V036_RECON_VIEW,...counts,checkedAt:new Date().toISOString()};
    return counts;
  }catch(error){
    if(token!==V036_RECON_TOKEN)return null;
    if(V036_RECON_LAST_GOOD&&typeof state!=='undefined'&&state.view==='overview'){
      v036RenderLiveReconciliation(ctx,V036_RECON_LAST_GOOD);
      return V036_RECON_LAST_GOOD;
    }
    v036MarkReconciliationUnavailable(error);
    window.__AML_UAF_SII_RECONCILIATION__={status:'degraded',source:V036_RECON_VIEW,error:String(error?.message||error),checkedAt:new Date().toISOString()};
    return null;
  }
}

/* Replace the legacy reconciliation cache with a session-aware live read.
 * A zero result is never cached as authoritative because RLS/auth can still be settling. */
if(typeof v0205LoadCounts==='function'){
  const v036BaseLoadCounts=v0205LoadCounts;
  v0205LoadCounts=async function(force=false){
    if(!force&&V036_RECON_LAST_GOOD?.total>0)return V036_RECON_LAST_GOOD;
    try{return await v036LoadLiveReconciliationCounts();}
    catch(error){
      if(V036_RECON_LAST_GOOD?.total>0)return V036_RECON_LAST_GOOD;
      return v036BaseLoadCounts(true);
    }
  };
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
  if(ctx&&typeof state!=='undefined'&&state.view==='overview'){
    await v036HydrateLiveReconciliation(ctx);
  }
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

try{
  sb.auth.onAuthStateChange((event,session)=>{
    if(event==='SIGNED_OUT'){
      V036_RECON_LAST_GOOD=null;
      try{if(typeof V0205_COUNTS!=='undefined')V0205_COUNTS=null;}catch{}
      return;
    }
    if(event==='SIGNED_IN'&&session){
      setTimeout(()=>{
        const ctx=window.__AML_V036_CONTEXT;
        if(ctx&&typeof state!=='undefined'&&state.view==='overview')void v036HydrateLiveReconciliation(ctx);
      },0);
    }
  });
}catch(error){console.warn('[AML v0.36] reconciliation auth observer unavailable',error);}

for(const ms of [120,500,1200])setTimeout(()=>{
  const ctx=window.__AML_V036_CONTEXT;
  if(ctx&&typeof state!=='undefined'&&state.view==='overview')void v036HydrateLiveReconciliation(ctx);
},ms);

window.__AML_V036_RUNTIME_FIX__={
  stateBinding:'GLOBAL_LEXICAL_STATE',
  windowStateDependency:false,
  crossSectorRetry:true,
  uniqueCrossEntityView:V036_CROSS_ENTITY_VIEW,
  uniqueCrossCounts:'HEAD_COUNT_WITH_ARRAY_OVERLAP',
  sectorSumIsNotUniqueEntityCount:true,
  reconciliationView:V036_RECON_VIEW,
  reconciliationPolicy:'SESSION_AWARE_LIVE_COUNTS_NO_ZERO_CACHE',
  reconciliationRetryAfterAuth:true
};
