'use strict';
(function atlasUniversoSO0650(){
  const core=window.__ATLAS_OBLIGATED__;
  if(!core){window.__ATLAS_UNIVERSO_SO_0650__={active:false,reason:'obligated-core-unavailable'};return;}
  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_e){return window.sb||null;}};
  const fmt=core.fmt||((v)=>Number(v||0).toLocaleString('es-CL'));
  let cache=null,loading=false;
  async function summary(){
    if(cache||loading)return cache;const c=db();if(!c)return null;loading=true;
    try{const {data,error}=await c.from('aml_v_uaf_potential_registry_summary_v0650').select('*').maybeSingle();if(error)throw error;cache=data||null;return cache;}catch(_e){return null;}finally{loading=false;}
  }
  function html(s){
    const strict=Number(s.potential_a_not_uaf||0),supported=Number(s.potential_ab_not_uaf||0),all=Number(s.potential_all_not_uaf||0);
    return `<section class="uso64-tier-strip uso65-registry-potential">
      <h3>Potenciales SO no inscritos · padrón SII completo</h3>
      <p>RUT activos con actividad económica compatible y ausencia exacta en los ${fmt(s.uaf_registered_operational)} RUT inscritos UAF. La cifra no usa coincidencias de nombre.</p>
      <div class="uso64-tiers">
        <div class="uso64-tier total"><b>${fmt(strict)}</b><span>A · potencial fuerte no inscrito</span></div>
        <div class="uso64-tier"><b>${fmt(supported)}</b><span>A+B · universo respaldado</span></div>
        <div class="uso64-tier"><b>${fmt(all)}</b><span>A+B+C · screening ampliado</span></div>
        <div class="uso64-tier"><b>${fmt(s.potential_active_res_overlap)}</b><span>Potenciales activos también observados en RES</span></div>
      </div>
      <div class="uso64-note">Base SII: ${fmt(s.sii_legal_entities)} personas jurídicas · activas ${fmt(s.sii_active_legal_entities)} · término de giro ${fmt(s.sii_terminated_legal_entities)}. Se excluyen por RUT los inscritos UAF. Nivel C es exploratorio; “potencial” no acredita incumplimiento legal.</div>
    </section>`;
  }
  async function patch(){
    const host=document.querySelector('#so-potential');if(!host)return;const s=await summary();
    if(!s||Number(s.sii_legal_entities||0)===0)return;
    host.querySelectorAll('.uso64-tier-strip').forEach(n=>n.remove());
    if(host.querySelector('.uso65-registry-potential'))return;
    const kpis=host.querySelector('.so-kpis');if(kpis)kpis.insertAdjacentHTML('afterend',html(s));else host.insertAdjacentHTML('afterbegin',html(s));
  }
  const obs=new MutationObserver(()=>{void patch();});
  const start=()=>{const c=document.querySelector('#content')||document.body;obs.observe(c,{childList:true,subtree:true});void patch();};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.__ATLAS_UNIVERSO_SO_0650__={active:true,version:'0.65.0',identityPolicy:'RUT_EXACTO_ONLY',registeredUniverse:10294,semantics:'POTENTIAL_SO_BY_PUBLIC_ACTIVITY_NOT_LEGAL_BREACH'};
})();
