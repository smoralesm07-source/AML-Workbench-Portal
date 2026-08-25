'use strict';
(function atlasUniversoSO0650(){
  const core=window.__ATLAS_OBLIGATED__;
  if(!core){window.__ATLAS_UNIVERSO_SO_0640__={active:false,reason:'obligated-core-unavailable'};return;}
  const SCOPE='aml_uaf_potential_screening_scope_0650';
  const FALLBACK_COUNT=79449;
  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_e){return window.sb||null;}};
  const fmt=core.fmt||((v)=>Number(v||0).toLocaleString('es-CL'));
  const esc=core.esc||((v)=>String(v??''));
  let scopeCache=null,loading=false;

  function cleanLegacyCards(){
    document.querySelectorAll('.uso61-truth,.uso63-scope,.uso64-tier-strip').forEach(n=>n.remove());
  }

  function humanizePendingSector(){
    document.querySelectorAll('.so-row .label, option').forEach(n=>{
      if((n.textContent||'').trim()==='SIN_SECTOR_MATERIALIZADO')n.textContent='Sector UAF pendiente de materialización';
    });
  }

  async function loadScope(){
    if(scopeCache||loading)return scopeCache;
    const client=db();
    loading=true;
    try{
      if(client){
        const {data,error}=await client.from(SCOPE).select('*').eq('snapshot_key','CURRENT').maybeSingle();
        if(!error&&data){scopeCache=data;return data;}
      }
    }catch(_e){}
    finally{loading=false;}
    scopeCache={potential_count:FALLBACK_COUNT,sii_cutoff:'2026-05',criteria:{acteco_policy:'candidate_use=SI',sii_status:'ACTIVE_AS_PUBLISHED',uaf_exclusion:'RUT no observado en padrón UAF'}};
    return scopeCache;
  }

  function patchOverviewState(scope){
    const p=core.state?.overview?.potential;
    if(!p)return;
    p.universe=p.universe||{};
    p.universe.candidates=Number(scope?.potential_count||FALLBACK_COUNT);
    p.universe.actionable=Number(scope?.potential_count||FALLBACK_COUNT);
    p.universe.definition='ACTECO_19913_VIGENTE_SII_NO_UAF';
    delete p.tiers;
  }

  function criteriaHtml(scope){
    const count=Number(scope?.potential_count||FALLBACK_COUNT);
    return `<section class="uso65-screening">
      <div class="uso65-head"><div><span>SCREENING VIGENTE</span><strong>${fmt(count)}</strong><small>Potenciales SO en el último corte disponible</small></div><div class="uso65-cut"><b>SII ${esc(scope?.sii_cutoff||'2026-05')}</b><small>Fuente de actividad económica vigente</small></div></div>
      <div class="uso65-criteria">
        <div><b>1</b><strong>ACTECO relacionado con Ley 19.913</strong><small>Se usa la política Radar SII con <code>candidate_use=SI</code>.</small></div>
        <div><b>2</b><strong>Vigente ante el SII</strong><small>La entidad debe estar activa en el corte tributario publicado.</small></div>
        <div><b>3</b><strong>No inscrito en UAF</strong><small>Se excluye todo RUT observado en el padrón UAF del corte.</small></div>
      </div>
      <div class="uso65-rule">No se aplican filtros de concentración, tipo de entidad, coherencia sectorial, IVO, materialidad ni niveles A/B/C para decidir quién entra al universo potencial.</div>
    </section>`;
  }

  function renderPotential(scope){
    const host=document.querySelector('#so-potential');
    if(!host||host.dataset.uso65==='1')return;
    host.dataset.uso65='1';
    host.innerHTML=`${criteriaHtml(scope)}
      <section class="so-card uso65-definition"><h2>Universo de potenciales sujetos obligados</h2><p>Esta sección trabaja con el universo amplio de screening: entidades con una actividad económica ACTECO vinculada a categorías de la Ley 19.913, vigentes ante el SII y no observadas en el padrón UAF del corte.</p>
      <div class="uso65-facts"><div><b>${fmt(scope?.potential_count||FALLBACK_COUNT)}</b><span>Potenciales SO vigentes</span></div><div><b>ACTECO</b><span>Criterio de entrada</span></div><div><b>SII vigente</b><span>Condición operativa</span></div><div><b>Fuera de UAF</b><span>Exclusión registral</span></div></div>
      <details><summary>Ayuda metodológica</summary><p>“Potencial SO” es una población de screening. No afirma que la entidad esté obligada jurídicamente, que deba inscribirse ni que exista incumplimiento. El criterio deliberadamente amplio permite que la revisión fiscalizadora opere después, no antes de construir el universo.</p></details></section>`;
  }

  function renderCoverage(scope){
    const content=document.querySelector('#content');if(!content)return;
    content.innerHTML=`<section class="so-root uso65-coverage"><div class="so-modes"><button type="button" data-uso65-back>← Potenciales SO</button><button class="on" type="button">Gestión de cobertura</button></div>${criteriaHtml(scope)}<section class="so-card"><h2>Gestión sobre universo amplio</h2><p>La gestión individual ya no usa el universo legado de 2.033 candidatos. El universo válido es el screening ACTECO + vigencia SII + exclusión UAF. Hasta que la nómina individual completa de ${fmt(scope?.potential_count||FALLBACK_COUNT)} filas esté materializada en la capa operativa, Atlas no reutiliza la antigua cola restrictiva.</p></section></section>`;
    content.querySelector('[data-uso65-back]')?.addEventListener('click',()=>{core.state.mode='potenciales';void core.render();});
  }

  function patchPanoramaCopy(){
    const root=document.querySelector('.so-root');
    if(!root)return;
    const firstKpi=root.querySelector('.so-kpis .so-kpi:first-child b');
    const firstLabel=root.querySelector('.so-kpis .so-kpi:first-child span');
    if(firstKpi&&core.state?.overview?.registry?.subjects!=null)firstKpi.textContent=fmt(core.state.overview.registry.subjects);
    if(firstLabel)firstLabel.textContent='Sujetos obligados inscritos';
  }

  async function patch(){
    cleanLegacyCards();
    humanizePendingSector();
    const scope=await loadScope();
    patchOverviewState(scope);
    patchPanoramaCopy();
    renderPotential(scope);
  }

  document.addEventListener('click',async(e)=>{
    const b=e.target?.closest?.('[data-atlas-coverage]');
    if(!b)return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    renderCoverage(await loadScope());
  },true);

  const obs=new MutationObserver(()=>{void patch();});
  const start=()=>{const c=document.querySelector('#content')||document.body;obs.observe(c,{childList:true,subtree:true});void patch();};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.__ATLAS_UNIVERSO_SO_0640__={active:true,version:'0.65.0',operationalSO:10294,potentialSO:79449,potentialDefinition:'ACTECO_19913_VIGENTE_SII_NO_UAF',legacy2033:false,patch};
})();
