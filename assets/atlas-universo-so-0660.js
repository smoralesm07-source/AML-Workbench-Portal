'use strict';
(function atlasUniversoSO0672Evidence(){
  const core=window.__ATLAS_OBLIGATED__;
  if(!core){window.__ATLAS_UNIVERSO_SO_0660__={active:false};return;}
  const VIEW='aml_v_uaf_universe_current_v0671';
  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_e){return window.sb||null;}};
  const fmt=core.fmt||((v)=>Number(v||0).toLocaleString('es-CL'));
  let cache=null,loadPromise=null,queued=false,running=false;

  function load0700(){
    if(window.__ATLAS_UNIVERSO_SO_0700__?.active||document.querySelector('script[data-atlas-uso70]'))return;
    const s=document.createElement('script');s.src='./assets/atlas-universo-so-workbench-0700.js?v=0703-1';s.dataset.atlasUso70='1';document.head.appendChild(s);
  }

  async function load(){
    if(cache)return cache;if(loadPromise)return loadPromise;
    const client=db();if(!client)return null;
    loadPromise=(async()=>{try{const {data,error}=await client.from(VIEW).select('*').maybeSingle();if(error)throw error;cache=data||null;return cache;}catch(_e){return null;}finally{loadPromise=null;}})();
    return loadPromise;
  }

  function card(row){
    const potential=Number(row?.potential_ruts||0),obligated=Number(row?.obligated_ruts||0),res=Number(row?.potential_res_overlap_ruts||0);
    if(!potential)return '';
    const coverage=potential?Math.round(res*10000/potential)/100:0;
    return `<section class="uso66-multi">
      <div class="uso66-title"><div><span>COBERTURA DE FUENTES</span><h3>Universo potencial materializado por RUT</h3><p>El screening SII está materializado individualmente. RES se utiliza como enriquecimiento societario y no como gatillante autónomo de obligación.</p></div><div class="uso66-total"><b>${fmt(potential)}</b><small>RUT potenciales vigentes</small></div></div>
      <div class="uso66-sources">
        <div class="uso66-source ready"><i></i><div><strong>SII · ACTECO</strong><span>${fmt(potential)} RUT únicos · corte ${row?.sii_cutoff||'vigente'}</span></div><em>MATERIALIZADO</em></div>
        <div class="uso66-source ready"><i></i><div><strong>RES · Registro de Empresas y Sociedades</strong><span>${fmt(res)} potenciales con enriquecimiento societario · ${coverage.toLocaleString('es-CL')}% de cobertura</span></div><em>ENRIQUECIMIENTO</em></div>
        <div class="uso66-source ready"><i></i><div><strong>UAF · padrón inscrito</strong><span>${fmt(obligated)} RUT usados para exclusión exacta del screening potencial</span></div><em>ANTI-JOIN RUT</em></div>
      </div>
      <div class="uso66-rule"><b>Control de integridad:</b> los potenciales se deduplican por RUT y todo RUT observado en el padrón UAF queda excluido. La presencia en RES no incorpora por sí sola una entidad al universo potencial.</div>
      <details><summary>Cómo interpreta Atlas el universo</summary><p>El total publicado corresponde al último snapshot materializado con ACTECO candidate_use=SI, estado SII ACTIVE_AS_PUBLISHED y exclusión exacta del padrón UAF. La distribución sectorial puede contar un RUT en más de un sector cuando tiene varias actividades elegibles; el headline, en cambio, siempre cuenta RUT únicos.</p></details>
    </section>`;
  }

  async function patch(){
    if(running)return;const host=document.querySelector('#so-potential');if(!host||host.querySelector('.uso66-multi'))return;
    running=true;try{const row=await load();if(!row||!document.contains(host)||host.querySelector('.uso66-multi'))return;const html=card(row);if(!html)return;const first=host.querySelector('.uso65-screening')||host.firstElementChild;if(first)first.insertAdjacentHTML('afterend',html);else host.insertAdjacentHTML('afterbegin',html);}finally{running=false;}
  }
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;void patch();});}
  const obs=new MutationObserver(schedule);
  const start=()=>{load0700();const c=document.querySelector('#content')||document.body;obs.observe(c,{childList:true,subtree:true});schedule();};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.__ATLAS_UNIVERSO_SO_0660__={active:true,version:'0.67.2',view:VIEW,patch,schedule,load0700};
})();