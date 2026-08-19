'use strict';

/* ATLAS AML 0.44.0 · reconciliation load-shedding hardening
 * Goal: keep ATLAS responsive when PostgreSQL is under pressure.
 * - Never launch four parallel exact-count scans against the reconciliation view.
 * - Never request an exact count on every entity page.
 * - Secondary analytical aggregates are loaded sequentially and fail soft.
 * - Existing governed/RLS-protected views remain authoritative; this patch only
 *   changes request concurrency and pagination behavior.
 */
(function atlasReconciliation0440(){
  if(typeof V0434_STATE==='undefined')return;
  V0434_STATE.year=V0434_STATE.year||'';

  const RELEASE='0.44.0',BUILD='0440';
  let navigationToken=0;
  let metaDiagnostics=[];
  let countSnapshot=null;
  let countSnapshotAt=0;
  const COUNT_TTL=5*60*1000;

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
  function diagnostic(source,error){
    const row={source,error:errorText(error)};
    metaDiagnostics.push(row);
    console.warn(`[ATLAS] Conciliación degradada: ${source}`,error);
  }
  async function safeRows(factory,source){
    try{
      const result=await factory();
      if(result?.error)throw result.error;
      return result?.data||[];
    }catch(error){diagnostic(source,error);return [];}
  }

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

  /* One primary count path only. The old fallback launched 4 concurrent exact
     HEAD scans over aml_v0210_uaf_sii_reconciliation; that behavior is disabled. */
  async function lowLoadCounts(force=false){
    const now=Date.now();
    if(!force&&countSnapshot&&(now-countSnapshotAt)<COUNT_TTL)return countSnapshot;
    if(typeof V0205_COUNTS!=='undefined'&&V0205_COUNTS&&!force){
      countSnapshot=V0205_COUNTS;countSnapshotAt=now;return countSnapshot;
    }
    try{
      if(typeof v0205LoadCounts==='function'&&v0205LoadCounts!==lowLoadCounts){
        const c=await v0205LoadCounts(force);
        if(c&&Number(c.total)>0){countSnapshot=c;countSnapshotAt=now;return c;}
      }
    }catch(error){diagnostic('counts-primary',error);}
    /* Do not amplify a backend incident. Counts remain explicitly unavailable
       until the governed aggregate path recovers. */
    const unavailable={total:0,active:0,terminated:0,noSii:0,matched:0,review:0,__unavailable:true};
    countSnapshot=unavailable;countSnapshotAt=now;return unavailable;
  }

  /* Replace the legacy four-way count loader used by home hydration too. */
  try{
    v0205LoadCounts=async function(force=false){
      const now=Date.now();
      if(!force&&countSnapshot&&(now-countSnapshotAt)<COUNT_TTL)return countSnapshot;
      if(typeof V0205_COUNTS!=='undefined'&&V0205_COUNTS&&!force){countSnapshot=V0205_COUNTS;countSnapshotAt=now;return countSnapshot;}
      const unavailable={total:0,active:0,terminated:0,noSii:0,matched:0,review:0,__unavailable:true};
      countSnapshot=unavailable;countSnapshotAt=now;
      return unavailable;
    };
  }catch(_error){}

  /* Entity paging no longer asks PostgREST for count=exact. A page fetch is one
     governed SELECT. We keep a has-next hint using PAGE_SIZE+1, which is enough
     for navigation without forcing an aggregate count scan. */
  v0434FetchEntities=async function(){
    const s=V0434_STATE,from=s.page*V0434_PAGE_SIZE,to=from+V0434_PAGE_SIZE;
    let q=sb.from(V0434_RECON_VIEW).select('entity_id,rut,resolved_name,uaf_sector_names,uaf_sector_label,reconciliation_status,sii_current_status,termination_date,termination_year,activity_start_date,main_activity,economic_sector,economic_subsector,sales_band_code,sales_band_rank,workers_numeric,sii_region,sii_commune,sii_signal_count,sii_signal_types,source_count,sanction_count,max_finding_sources');
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
    const {data,error}=await q;if(error)throw error;
    const rows=data||[];
    s.__hasNext=rows.length>V0434_PAGE_SIZE;
    const visible=rows.slice(0,V0434_PAGE_SIZE);
    s.total=Math.max(s.total||0,from+visible.length+(s.__hasNext?1:0));
    return visible;
  };

  const baseSetLens=typeof v0434SetLens==='function'?v0434SetLens:null;
  if(baseSetLens){
    v0434SetLens=function(lens){if(lens!=='terminated')V0434_STATE.year='';return baseSetLens(lens);};
  }

  document.addEventListener('click',async e=>{
    const year=e.target.closest?.('[data-v0434-year]');
    if(year){
      e.preventDefault();e.stopImmediatePropagation();
      const selected=String(year.dataset.v0434Year||'');
      V0434_STATE.year=V0434_STATE.year===selected?'':selected;
      V0434_STATE.query='';V0434_STATE.page=0;V0434_STATE.lens='terminated';V0434_STATE.status='terminated';
      await v0434RenderWorkspace();return;
    }
    if(e.target.closest?.('[data-v0434-reset]'))V0434_STATE.year='';
  },true);

  document.addEventListener('keydown',e=>{
    const help=e.target.closest?.('[data-v0434-help]');
    if(!help||!['Enter',' '].includes(e.key))return;
    e.preventDefault();e.stopPropagation();v0434ShowHelp(help.dataset.v0434Help);
  },true);

  v0434LoadMeta=async function(force=false){
    if(V0434_CACHE.__v0440Ready&&!force)return V0434_CACHE;
    metaDiagnostics=[];
    const counts=await lowLoadCounts(force);

    /* Sequential rather than bursty: one secondary request at a time. */
    const sectors=await safeRows(()=>sb.from(V0434_SECTOR_VIEW).select('*').order('entity_count',{ascending:false}),'sector');
    const years=await safeRows(()=>sb.from(V0434_YEAR_VIEW).select('termination_year,entity_count').order('termination_year',{ascending:true}),'termination-year');
    let matrix=[],gaps=[];
    if(!counts.__unavailable){
      matrix=await safeRows(()=>sb.from(V0434_MATRIX_VIEW).select('*').order('entity_count',{ascending:false}),'matrix');
      gaps=await safeRows(()=>sb.from(V0434_GAP_VIEW).select('*').order('candidate_pairs',{ascending:false}),'gap-sector');
    }else{
      diagnostic('load-shed','Conteos primarios no disponibles; matriz y brechas diferidas para proteger PostgreSQL.');
    }

    V0434_CACHE.counts=counts;V0434_CACHE.sectors=sectors;V0434_CACHE.matrix=matrix;V0434_CACHE.years=years;V0434_CACHE.gaps=gaps;
    V0434_CACHE.__v0440Ready=true;V0434_CACHE.__v0437Ready=true;V0434_CACHE.__v0437Diagnostics=[...metaDiagnostics];
    if(!V0434_STATE.candidateSector&&gaps.length)V0434_STATE.candidateSector=gaps[0].sector_name;
    window.__ATLAS_RECONCILIATION_HEALTH__={release:RELEASE,build:BUILD,status:counts.__unavailable?'load-shed':metaDiagnostics.length?'degraded-aggregate':'ok',diagnostics:[...metaDiagnostics],checkedAt:new Date().toISOString()};
    return V0434_CACHE;
  };

  function loadingSurface(){const c=document.querySelector('#content');if(c)c.innerHTML='<div class="v0434-recon"><section class="v0434-card"><div class="v0434-loading">Cargando conciliación en modo de baja carga…</div></section></div>';}
  function renderFatal(error,token){
    if(!isCurrent(token))return;
    const c=document.querySelector('#content');if(!c)return;
    const detail=errorText(error);
    c.innerHTML=`<div class="v0434-recon"><section class="v0434-card"><div class="v019-error"><b>Conciliación temporalmente diferida para proteger la estabilidad de ATLAS.</b><br>${v0434Esc(detail)}</div><div class="v0434-guard">RLS y la sesión permanecen activos. Este módulo puede reintentarse sin recargar la aplicación.</div><button type="button" class="v0203-link" data-v0437-retry>Reintentar conciliación</button></section></div>`;
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
      await v0434LoadMeta();if(!isCurrent(token))return;
      await v0434RenderPage();if(!isCurrent(token))return;
      const page=document.querySelector('.v0434-recon');
      if(page&&metaDiagnostics.length){const banner=document.createElement('div');banner.className='v0434-guard';banner.dataset.v0437Degraded='1';banner.textContent='Modo de baja carga activo: ATLAS prioriza disponibilidad y difiere agregados costosos mientras PostgreSQL se recupera.';page.prepend(banner);}
    }catch(error){console.error('[ATLAS] Conciliación UAF↔SII',error);renderFatal(error,token);}
  };

  try{v0205LoadReconciliation=v0434LoadReconciliation;}catch{}
  window.v0205LoadReconciliation=v0434LoadReconciliation;

  document.addEventListener('click',event=>{
    const retry=event.target?.closest?.('[data-v0437-retry]');if(!retry)return;
    event.preventDefault();V0434_CACHE.__v0440Ready=false;countSnapshot=null;
    void v0434LoadReconciliation(V0434_STATE.lens==='terminated'?'terminated':V0434_STATE.lens==='candidates'?'candidates':V0434_STATE.status||'all',V0434_STATE.query||'');
  },true);

  window.__ATLAS_RECONCILIATION_LOAD_SHED__={release:RELEASE,build:BUILD,parallelExactCounts:false,pageExactCount:false,secondaryConcurrency:1};
  if(window.__ATLAS_RECONCILIATION__){
    window.__ATLAS_RECONCILIATION__.release=RELEASE;
    window.__ATLAS_RECONCILIATION__.version=RELEASE;
    window.__ATLAS_RECONCILIATION__.build=BUILD;
    window.__ATLAS_RECONCILIATION__.load=v0434LoadReconciliation;
    window.__ATLAS_RECONCILIATION__.runtimeGuard='VIEW_SCOPED+LOAD_SHEDDING+NO_PARALLEL_EXACT_COUNTS+FAIL_SOFT';
  }
})();
