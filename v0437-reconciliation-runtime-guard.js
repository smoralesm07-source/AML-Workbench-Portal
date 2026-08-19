'use strict';

/* ATLAS AML 0.43.7 · Conciliación UAF ↔ SII runtime guard
 * Fixes two production failure modes observed after 0.43.6:
 * 1) a late reconciliation request could write into another active view (e.g. Sanciones);
 * 2) one unavailable aggregate view could abort the whole reconciliation page.
 *
 * Policy: the entity reconciliation view remains the authoritative operational
 * source. Sector/matrix/year/gap aggregates are progressive enhancements and
 * must never replace or blank another ATLAS route when temporarily unavailable.
 */
(function atlasReconciliation0437RuntimeGuard(){
  if(typeof V0434_STATE==='undefined'||typeof V0434_CACHE==='undefined')return;

  const RELEASE='0.43.7';
  const BUILD='0437';
  let navigationToken=0;
  let metaDiagnostics=[];

  function errorText(error){
    if(error==null)return 'Error no especificado';
    if(typeof error==='string')return error;
    const parts=[error.message,error.details,error.hint,error.code]
      .filter(v=>v!==undefined&&v!==null&&String(v).trim())
      .map(v=>String(v).trim());
    if(parts.length)return [...new Set(parts)].join(' · ');
    try{return JSON.stringify(error);}
    catch{return String(error);}
  }

  function isCurrent(token){
    return token===navigationToken && typeof state!=='undefined' && state?.view==='reconciliation';
  }

  async function directCount(status){
    let q=sb.from(V0434_RECON_VIEW).select('entity_id',{count:'exact',head:true});
    if(status)q=q.eq('reconciliation_status',status);
    const {count,error}=await q;
    if(error)throw error;
    return count||0;
  }

  async function resilientCounts(force=false){
    try{
      if(typeof v0205LoadCounts==='function'){
        const c=await v0205LoadCounts(force);
        if(c&&Number(c.total)>0)return c;
      }
    }catch(error){metaDiagnostics.push({source:'counts-primary',error:errorText(error)});}

    const [total,active,terminated,noSii]=await Promise.all([
      directCount(),directCount('SII_ACTIVE'),directCount('SII_TERMINATED'),directCount('NO_SII_PROFILE')
    ]);
    if(!total)throw new Error('La conciliación no devolvió filas bajo la sesión autenticada actual.');
    return {total,active,terminated,noSii,matched:active+terminated,review:terminated+noSii};
  }

  async function safeRows(promise,source){
    try{
      const result=await promise;
      if(result?.error)throw result.error;
      return result?.data||[];
    }catch(error){
      metaDiagnostics.push({source,error:errorText(error)});
      console.warn(`[ATLAS] Conciliación agregado no disponible: ${source}`,error);
      return [];
    }
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
    V0434_CACHE.counts=counts;
    V0434_CACHE.sectors=sectors;
    V0434_CACHE.matrix=matrix;
    V0434_CACHE.years=years;
    V0434_CACHE.gaps=gaps;
    V0434_CACHE.__v0437Ready=true;
    V0434_CACHE.__v0437Diagnostics=[...metaDiagnostics];
    if(!V0434_STATE.candidateSector&&gaps.length)V0434_STATE.candidateSector=gaps[0].sector_name;
    window.__ATLAS_RECONCILIATION_HEALTH__={
      release:RELEASE,
      build:BUILD,
      status:metaDiagnostics.length?'degraded-aggregate':'ok',
      diagnostics:[...metaDiagnostics],
      counts:{...counts},
      checkedAt:new Date().toISOString()
    };
    return V0434_CACHE;
  };

  function loadingSurface(){
    const content=document.querySelector('#content');
    if(!content)return;
    content.innerHTML='<div class="v0434-recon"><section class="v0434-card"><div class="v0434-loading">Cargando situación tributaria UAF ↔ SII…</div></section></div>';
  }

  function renderFatal(error,token){
    if(!isCurrent(token))return;
    const content=document.querySelector('#content');
    if(!content)return;
    const detail=errorText(error);
    content.innerHTML=`<div class="v0434-recon"><section class="v0434-card"><div class="v019-error"><b>No fue posible cargar la conciliación en este momento.</b><br>${v0434Esc(detail)}</div><div class="v0434-guard">La vista anterior no será modificada por respuestas tardías. Puedes reintentar sin salir de ATLAS.</div><button type="button" class="v0203-link" data-v0437-retry>Reintentar conciliación</button></section></div>`;
    window.__ATLAS_RECONCILIATION_HEALTH__={release:RELEASE,build:BUILD,status:'error',error:detail,checkedAt:new Date().toISOString()};
  }

  v0434LoadReconciliation=async function(filter='all',initialSearch=''){
    const token=++navigationToken;
    state.view='reconciliation';
    V0434_STATE.lens=filter==='terminated'?'terminated':filter==='candidates'?'candidates':'tax';
    V0434_STATE.status=filter==='active'?'active':filter==='unmatched'||filter==='missing'?'missing':filter==='terminated'?'terminated':'all';
    V0434_STATE.query=initialSearch||'';
    V0434_STATE.page=0;V0434_STATE.sector='';V0434_STATE.economic='';
    try{V0434_STATE.year='';}catch{}

    /* Update route chrome before any network request so the previous page title
       can never remain visible while reconciliation is loading. */
    shell('Conciliación UAF ↔ SII','Situación tributaria del padrón, términos de giro y screening explicable de potenciales sujetos obligados.');
    loadingSurface();

    try{
      await v0434LoadMeta();
      if(!isCurrent(token))return;
      await v0434RenderPage();
      if(!isCurrent(token))return;
      const page=document.querySelector('.v0434-recon');
      if(page&&metaDiagnostics.length){
        const banner=document.createElement('div');
        banner.className='v0434-guard';
        banner.dataset.v0437Degraded='1';
        banner.textContent='Algunos agregados analíticos están temporalmente no disponibles; el explorador y los conteos operativos continúan usando la conciliación gobernada.';
        page.prepend(banner);
      }
    }catch(error){
      console.error('[ATLAS] Conciliación UAF↔SII',error);
      renderFatal(error,token);
    }
  };

  /* Keep both the historical callable and public runtime authority aligned. */
  try{v0205LoadReconciliation=v0434LoadReconciliation;}catch{}
  window.v0205LoadReconciliation=v0434LoadReconciliation;

  document.addEventListener('click',event=>{
    const retry=event.target?.closest?.('[data-v0437-retry]');
    if(!retry)return;
    event.preventDefault();
    V0434_CACHE.__v0437Ready=false;
    void v0434LoadReconciliation(V0434_STATE.lens==='terminated'?'terminated':V0434_STATE.lens==='candidates'?'candidates':V0434_STATE.status||'all',V0434_STATE.query||'');
  },true);

  if(window.__ATLAS_RECONCILIATION__){
    window.__ATLAS_RECONCILIATION__.version=RELEASE;
    window.__ATLAS_RECONCILIATION__.build=BUILD;
    window.__ATLAS_RECONCILIATION__.load=v0434LoadReconciliation;
    window.__ATLAS_RECONCILIATION__.runtimeGuard='VIEW_SCOPED_TOKEN+FAIL_SOFT_AGGREGATES+STRUCTURED_ERRORS';
  }
})();
