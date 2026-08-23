'use strict';

/* ATLAS AML 0.44.4 · backend stability layer
 * - Replaces exact-count reconciliation scans with one lightweight governed summary view.
 * - Keeps the v0435 sequential/fail-soft aggregate loader intact.
 * - Adds a bounded recovery backoff so an unavailable database is not hammered by repeated reads.
 * - Does not alter Auth, allowlist, RLS or entity authorization.
 */
(function atlasBackendStability0444(){
  const RELEASE='0.44.4';
  const BUILD='0444';
  const SUMMARY_VIEW='aml_v0444_uaf_sii_summary';
  const TTL=5*60*1000;
  const FAILURE_BACKOFF=2*60*1000;
  let cached=null;
  let cachedAt=0;
  let inFlight=null;
  let failedAt=0;
  let lastFailure='';

  function now(){return Date.now();}
  function health(stage,extra={}){
    window.__ATLAS_BACKEND_STABILITY__={
      active:true,
      release:RELEASE,
      build:BUILD,
      stage,
      summaryView:SUMMARY_VIEW,
      exactReconciliationCounts:false,
      reconciliationSectorView:'aml_v0434_uaf_sii_sector',
      reconciliationMatrixView:'aml_v0434_uaf_sii_sector_matrix',
      failureBackoffMs:FAILURE_BACKOFF,
      checkedAt:new Date().toISOString(),
      ...extra
    };
  }
  function normalize(row){
    const total=Number(row?.total)||0;
    const active=Number(row?.active)||0;
    const terminated=Number(row?.terminated)||0;
    const noSii=Number(row?.no_sii)||0;
    const matched=Number(row?.matched)||active+terminated;
    const review=Number(row?.review)||terminated+noSii;
    return {total,active,terminated,noSii,matched,review,__source:SUMMARY_VIEW};
  }
  function unavailable(error,backoff=false){
    const elapsed=failedAt?Math.max(0,now()-failedAt):0;
    return {
      total:0,active:0,terminated:0,noSii:0,matched:0,review:0,
      __unavailable:true,
      __source:SUMMARY_VIEW,
      __backoff:backoff,
      __retryAfterMs:backoff?Math.max(0,FAILURE_BACKOFF-elapsed):0,
      __error:String(error?.message||error||'summary unavailable')
    };
  }

  async function loadSummary(force=false){
    if(!force&&cached&&(now()-cachedAt)<TTL)return cached;
    if(inFlight&&!force)return inFlight;
    if(!force&&!cached&&failedAt&&(now()-failedAt)<FAILURE_BACKOFF){
      const result=unavailable(lastFailure||'backend recovery backoff',true);
      health('summary-backoff',{error:result.__error,retryAfterMs:result.__retryAfterMs});
      return result;
    }
    inFlight=(async()=>{
      try{
        const {data,error}=await sb.from(SUMMARY_VIEW)
          .select('total,active,terminated,no_sii,matched,review')
          .limit(1);
        if(error)throw error;
        const row=Array.isArray(data)?data[0]:data;
        const result=normalize(row||{});
        if(result.total<=0)throw new Error('Resumen UAF–SII sin universo materializado');
        cached=result;
        cachedAt=now();
        failedAt=0;
        lastFailure='';
        try{V0205_COUNTS=result;}catch(_error){}
        health('summary-ok',{total:result.total,review:result.review});
        return result;
      }catch(error){
        failedAt=now();
        lastFailure=String(error?.message||error||'summary unavailable');
        if(cached){
          const stale={...cached,__stale:true,__error:lastFailure,__retryAfterMs:FAILURE_BACKOFF};
          health('summary-stale',{error:stale.__error,total:stale.total,retryAfterMs:FAILURE_BACKOFF});
          return stale;
        }
        const result=unavailable(error,false);
        health('summary-unavailable',{error:result.__error,retryAfterMs:FAILURE_BACKOFF});
        return result;
      }finally{
        inFlight=null;
      }
    })();
    return inFlight;
  }

  try{
    v0205LoadCounts=async function(force=false){
      return loadSummary(force);
    };
  }catch(error){
    health('install-failed',{error:String(error?.message||error)});
    return;
  }

  /* Remove stale load-shed flags left by an earlier in-memory attempt. */
  try{
    if(V0205_COUNTS?.__unavailable)V0205_COUNTS=null;
    if(V0434_CACHE?.counts?.__unavailable){
      V0434_CACHE.counts=null;
      V0434_CACHE.__v0440Ready=false;
      V0434_CACHE.__v0437Ready=false;
    }
  }catch(_error){}

  window.AtlasBackendStability={
    release:RELEASE,
    build:BUILD,
    refresh:()=>loadSummary(true),
    snapshot:()=>cached?{...cached}:null,
    recovery:()=>({failedAt:failedAt||null,lastFailure:lastFailure||null,backoffMs:FAILURE_BACKOFF})
  };
  health('installed');
})();