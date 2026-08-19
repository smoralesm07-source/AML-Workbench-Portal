'use strict';

/* ATLAS AML 0.43.7 · reconciliation hardening
 * - Termination cohorts filter the governed termination_year field.
 * - Help affordances avoid nested interactive <button> markup inside KPI buttons.
 * - The selected termination cohort is visible and reset with the lens.
 * - Reconciliation network work is view-scoped so late responses cannot overwrite another route.
 * - Aggregate analytical views fail soft; the governed entity reconciliation remains operational.
 */
(function atlasReconciliation0437(){
  if(typeof V0434_STATE==='undefined')return;
  V0434_STATE.year=V0434_STATE.year||'';

  if(typeof v0434Help==='function'){
    v0434Help=function(key){
      return `<span class="v0434-help" data-v0434-help="${v0434Esc(key)}" role="button" tabindex="0" aria-label="Ayuda metodológica">?</span>`;
    };
  }

  if(typeof v0434Timeline==='function'){
    v0434Timeline=function(){
      const rows=V0434_CACHE.years||[],max=Math.max(1,...rows.map(r=>v0434N(r.entity_count))),now=new Date().getFullYear();
      return `<div class="v0434-timeline">${rows.map(r=>{const y=String(r.termination_year),age=now-v0434N(r.termination_year),cls=age>=10?'old':age>=5?'mid':'recent',active=String(V0434_STATE.year)===y;return `<button class="${cls} ${active?'active':''}" data-v0434-year="${v0434Esc(y)}"><span>${v0434Esc(y)}</span><progress max="${max}" value="${v0434N(r.entity_count)}"></progress><b>${v0434Fmt(r.entity_count)}</b><small>${age} años</small></button>`;}).join('')}</div>`;
    };
  }

  v0434FetchEntities=async function(){
    const s=V0434_STATE,from=s.page*V0434_PAGE_SIZE,to=from+V0434_PAGE_SIZE-1;
    let q=sb.from(V0434_RECON_VIEW).select('entity_id,rut,resolved_name,uaf_sector_names,uaf_sector_label,reconciliation_status,sii_current_status,termination_date,termination_year,activity_start_date,main_activity,economic_sector,economic_subsector,sales_band_code,sales_band_rank,workers_numeric,sii_region,sii_commune,sii_signal_count,sii_signal_types,source_count,sanction_count,max_finding_sources',{count:'exact'});
    if(s.lens==='terminated')q=q.eq('reconciliation_status','SII_TERMINATED');
    else if(s.status==='active')q=q.eq('reconciliation_status','SII_ACTIVE');
    else if(s.status==='terminated')q=q.eq('reconciliation_status','SII_TERMINATED');
    else if(s.status==='missing')q=q.eq('reconciliation_status','NO_SII_PROFILE');
    if(s.lens==='terminated'&&s.year)q=q.eq('termination_year',Number(s.year));
    if(s.sector)q=q.contains('uaf_sector_names',[s.sector]);
    if(s.economic)q=q.eq('economic_sector',s.economic);
    const term=String(s.query||'').trim().replace(/,/g,' ');
    if(term)q=q.or(`rut.ilike.%${term}%,resolved_name.ilike.%${term}%,main_activity.ilike.%${term}%`);
    q=q.order(s.lens==='terminated'?'termination_date':'resolved_name',{ascending:s.lens!=='terminated',nullsFirst:false}).order('rut',{ascending:true}).range(from,to);
    const {data,count,error}=await q;if(error)throw error;s.total=count||0;return data||[];
  };

  const baseSetLens=typeof v0434SetLens==='function'?v0434SetLens:null;
  if(baseSetLens){
    v0434SetLens=function(lens){
      if(lens!=='terminated')V0434_STATE.year='';
      return baseSetLens(lens);
    };
  }

  document.addEventListener('click',async e=>{
    const year=e.target.closest?.('[data-v0434-year]');
    if(year){
      e.preventDefault();e.stopImmediatePropagation();
      const selected=String(year.dataset.v0434Year||'');
      V0434_STATE.year=V0434_STATE.year===selected?'':selected;
      V0434_STATE.query='';V0434_STATE.page=0;V0434_STATE.lens='terminated';V0434_STATE.status='terminated';
      await v0434RenderWorkspace();
      return;
    }
    if(e.target.closest?.('[data-v0434-reset]'))V0434_STATE.year='';
  },true);

  document.addEventListener('keydown',e=>{
    const help=e.target.closest?.('[data-v0434-help]');
    if(!help||!['Enter',' '].includes(e.key))return;
    e.preventDefault();e.stopPropagation();v0434ShowHelp(help.dataset.v0434Help);
  },true);

  const RELEASE='0.43.7',BUILD='0437';
  let navigationToken=0;
  let metaDiagnostics=[];

  function errorText(error){
    if(error==null)return 'Error no especificado';
    if(typeof error==='string')return error;
    const parts=[error.message,error.details,error.hint,error.code]
      .filter(v=>v!==undefined&&v!==null&&String(v).trim())
      .map(v=>String(v).trim());
    if(parts.length)return [...new Set(parts)].join(' · ');
    try{return JSON.stringify(error);}catch{return String(error);}
  }
  function isCurrent(token){return token===navigationToken&&typeof state!=='undefined'&&state?.view==='reconciliation';}
  async function directCount(status){
    let q=sb.from(V0434_RECON_VIEW).select('entity_id',{count:'exact',head:true});
    if(status)q=q.eq('reconciliation_status',status);
    const {count,error}=await q;if(error)throw error;return count||0;
  }
  async function resilientCounts(force=false){
    try{
      if(typeof v0205LoadCounts==='function'){
        const c=await v0205LoadCounts(force);
        if(c&&Number(c.total)>0)return c;
      }
    }catch(error){metaDiagnostics.push({source:'counts-primary',error:errorText(error)});}
    const [total,active,terminated,noSii]=await Promise.all([directCount(),directCount('SII_ACTIVE'),directCount('SII_TERMINATED'),directCount('NO_SII_PROFILE')]);
    if(!total)throw new Error('La conciliación no devolvió filas bajo la sesión autenticada actual.');
    return {total,active,terminated,noSii,matched:active+terminated,review:terminated+noSii};
  }
  async function safeRows(promise,source){
    try{const result=await promise;if(result?.error)throw result.error;return result?.data||[];}
    catch(error){metaDiagnostics.push({source,error:errorText(error)});console.warn(`[ATLAS] Conciliación agregado no disponible: ${source}`,error);return [];}
  }

  v0434LoadMeta=async function(force=false){
    if(V0434_CACHE.counts&&!force&&V0434_CACHE.__v0437Ready)return V0434_CACHE;
    metaDiagnostics=[];
    const counts=await resilientCounts(force);
    const [sectors,matrix,years,gaps]=await Promise.all([
      safeRows(sb.from(V0434_SECTOR_VIEW).select('*').order('entity_count',{ascending:false}),'sector'),
      safeRows(sb.from(V0434_MATRIX_VIEW).select('*').order('entity_count',{ascending:false}),'matrix'),
      safeRows(sb.from(V0434_YEAR_VIEW).select('termination_year,entity_count').order('termination_year',{ascending:true}),'termination-year'),
      safeRows(sb.from(V0434_GAP_VIEW).select('*').order('candidate_pairs',{ascending:false}),'gap-sector')
    ]);
    V0434_CACHE.counts=counts;V0434_CACHE.sectors=sectors;V0434_CACHE.matrix=matrix;V0434_CACHE.years=years;V0434_CACHE.gaps=gaps;
    V0434_CACHE.__v0437Ready=true;V0434_CACHE.__v0437Diagnostics=[...metaDiagnostics];
    if(!V0434_STATE.candidateSector&&gaps.length)V0434_STATE.candidateSector=gaps[0].sector_name;
    window.__ATLAS_RECONCILIATION_HEALTH__={release:RELEASE,build:BUILD,status:metaDiagnostics.length?'degraded-aggregate':'ok',diagnostics:[...metaDiagnostics],counts:{...counts},checkedAt:new Date().toISOString()};
    return V0434_CACHE;
  };

  function loadingSurface(){const content=document.querySelector('#content');if(content)content.innerHTML='<div class="v0434-recon"><section class="v0434-card"><div class="v0434-loading">Cargando situación tributaria UAF ↔ SII…</div></section></div>';}
  function renderFatal(error,token){
    if(!isCurrent(token))return;
    const content=document.querySelector('#content');if(!content)return;
    const detail=errorText(error);
    content.innerHTML=`<div class="v0434-recon"><section class="v0434-card"><div class="v019-error"><b>No fue posible cargar la conciliación en este momento.</b><br>${v0434Esc(detail)}</div><div class="v0434-guard">La vista anterior no será modificada por respuestas tardías. Puedes reintentar sin salir de ATLAS.</div><button type="button" class="v0203-link" data-v0437-retry>Reintentar conciliación</button></section></div>`;
    window.__ATLAS_RECONCILIATION_HEALTH__={release:RELEASE,build:BUILD,status:'error',error:detail,checkedAt:new Date().toISOString()};
  }

  v0434LoadReconciliation=async function(filter='all',initialSearch=''){
    const token=++navigationToken;
    state.view='reconciliation';
    V0434_STATE.lens=filter==='terminated'?'terminated':filter==='candidates'?'candidates':'tax';
    V0434_STATE.status=filter==='active'?'active':filter==='unmatched'||filter==='missing'?'missing':filter==='terminated'?'terminated':'all';
    V0434_STATE.query=initialSearch||'';V0434_STATE.page=0;V0434_STATE.sector='';V0434_STATE.economic='';V0434_STATE.year='';
    shell('Conciliación UAF ↔ SII','Situación tributaria del padrón, términos de giro y screening explicable de potenciales sujetos obligados.');
    loadingSurface();
    try{
      await v0434LoadMeta();
      if(!isCurrent(token))return;
      await v0434RenderPage();
      if(!isCurrent(token))return;
      const page=document.querySelector('.v0434-recon');
      if(page&&metaDiagnostics.length){const banner=document.createElement('div');banner.className='v0434-guard';banner.dataset.v0437Degraded='1';banner.textContent='Algunos agregados analíticos están temporalmente no disponibles; el explorador y los conteos operativos continúan usando la conciliación gobernada.';page.prepend(banner);}
    }catch(error){console.error('[ATLAS] Conciliación UAF↔SII',error);renderFatal(error,token);}
  };

  try{v0205LoadReconciliation=v0434LoadReconciliation;}catch{}
  window.v0205LoadReconciliation=v0434LoadReconciliation;

  document.addEventListener('click',event=>{
    const retry=event.target?.closest?.('[data-v0437-retry]');if(!retry)return;
    event.preventDefault();V0434_CACHE.__v0437Ready=false;
    void v0434LoadReconciliation(V0434_STATE.lens==='terminated'?'terminated':V0434_STATE.lens==='candidates'?'candidates':V0434_STATE.status||'all',V0434_STATE.query||'');
  },true);

  if(window.__ATLAS_RECONCILIATION__){
    window.__ATLAS_RECONCILIATION__.release=RELEASE;
    window.__ATLAS_RECONCILIATION__.version=RELEASE;
    window.__ATLAS_RECONCILIATION__.build=BUILD;
    window.__ATLAS_RECONCILIATION__.load=v0434LoadReconciliation;
    window.__ATLAS_RECONCILIATION__.yearFilter='GOVERNED_TERMINATION_YEAR';
    window.__ATLAS_RECONCILIATION__.candidatePolicy='RADAR_SII_CANDIDATE_USE_SI_ONLY';
    window.__ATLAS_RECONCILIATION__.runtimeGuard='VIEW_SCOPED_TOKEN+FAIL_SOFT_AGGREGATES+STRUCTURED_ERRORS';
  }
})();
