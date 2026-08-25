'use strict';
(function atlasUniversoSO0660(){
  const core=window.__ATLAS_OBLIGATED__;
  if(!core){window.__ATLAS_UNIVERSO_SO_0660__={active:false};return;}
  const VIEW='aml_v_uaf_potential_architecture_status_v0660';
  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_e){return window.sb||null;}};
  const fmt=core.fmt||((v)=>Number(v||0).toLocaleString('es-CL'));
  const esc=core.esc||((v)=>String(v??''));
  let cache=null,loadPromise=null,queued=false,running=false;

  function load0700(){
    if(window.__ATLAS_UNIVERSO_SO_0700__?.active||document.querySelector('script[data-atlas-uso70]'))return;
    const s=document.createElement('script');
    s.src='./assets/atlas-universo-so-workbench-0700.js?v=0700-1';
    s.dataset.atlasUso70='1';
    document.head.appendChild(s);
  }

  async function load(){
    if(cache)return cache;
    if(loadPromise)return loadPromise;
    const client=db();if(!client)return null;
    loadPromise=(async()=>{
      try{
        const {data,error}=await client.from(VIEW).select('*').order('source_id');
        if(error)throw error;
        cache=data||[];
        return cache;
      }catch(_e){return null;}
      finally{loadPromise=null;}
    })();
    return loadPromise;
  }

  function card(rows){
    const sii=rows.find(r=>r.source_id==='SII_ACTECO')||{};
    const res=rows.find(r=>r.source_id==='RES')||{};
    const authoritative=Boolean(sii.unified_count_authoritative);
    const unified=Number(sii.unified_materialized_ruts||0);
    const baseline=Number(sii.baseline_declared_ruts||79449);
    const resN=Number(res.eligible_materialized_ruts||0);
    return `<section class="uso66-multi">
      <div class="uso66-title"><div><span>ARQUITECTURA MULTIFUENTE</span><h3>Potenciales SO preparados para SII + RES + nuevas fuentes</h3><p>Los productores agregan evidencia sobre un mismo RUT. Atlas deduplica la entidad y conserva todas las fuentes que justifican su incorporación al screening.</p></div><div class="uso66-total"><b>${fmt(authoritative?unified:baseline)}</b><small>${authoritative?'universo consolidado':'piso vigente de screening'}</small></div></div>
      <div class="uso66-sources">
        <div class="uso66-source ready"><i></i><div><strong>SII · ACTECO</strong><span>${fmt(baseline)} declarados · ${fmt(sii.eligible_materialized_ruts||0)} RUT materializados en la nueva capa</span></div><em>${esc(sii.source_status||'BASELINE_DECLARED')}</em></div>
        <div class="uso66-source ${resN?'ready':'standby'}"><i></i><div><strong>RES · Registro de Empresas y Sociedades</strong><span>${resN?fmt(resN)+' candidatos RES calificados':'adaptador preparado; aún sin candidatos RES calificados'}</span></div><em>${esc(res.source_status||'ADAPTER_READY')}</em></div>
      </div>
      <div class="uso66-rule"><b>Regla de expansión:</b> una entidad nueva se suma sólo si una fuente produce evidencia que la vincula con una categoría o actividad de la Ley 19.913 y no aparece inscrita en UAF. <b>Estar en RES, por sí solo, no basta.</b></div>
      <details><summary>Cómo evita Atlas duplicar o inflar el universo</summary><p>Cada productor registra evidencia con identificador de fuente y clave propia, pero la unión operacional se hace por RUT. Si SII y RES detectan la misma entidad, cuenta una sola vez y aumenta su huella de fuentes. Mientras los 79.449 RUT SII no estén individualmente materializados, Atlas mantiene ese total como piso y no suma RES a ciegas, porque todavía no puede medir el solapamiento exacto.</p></details>
    </section>`;
  }

  async function patch(){
    if(running)return;
    const host=document.querySelector('#so-potential');
    if(!host||host.querySelector('.uso66-multi'))return;
    running=true;
    try{
      const rows=await load();if(!rows||!document.contains(host)||host.querySelector('.uso66-multi'))return;
      const first=host.querySelector('.uso65-screening')||host.firstElementChild;
      if(first)first.insertAdjacentHTML('afterend',card(rows));else host.insertAdjacentHTML('afterbegin',card(rows));
    }finally{running=false;}
  }

  function schedule(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;void patch();});
  }

  const obs=new MutationObserver(schedule);
  const start=()=>{load0700();const c=document.querySelector('#content')||document.body;obs.observe(c,{childList:true,subtree:true});schedule();};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.__ATLAS_UNIVERSO_SO_0660__={active:true,version:'0.70.0',view:VIEW,patch,schedule,load0700};
})();