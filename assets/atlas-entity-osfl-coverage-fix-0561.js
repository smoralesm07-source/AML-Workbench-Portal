'use strict';
/* ATLAS AML · Entity 360 OSFL coverage bridge 0561
 * Source coverage is independent from findings. An entity present in the
 * governed OSFL profile must be shown as observed even when it has no OSFL
 * finding and direct_confirmed=false.
 */
(function atlasEntityOsflCoverageFix0561(){
  const CACHE=new Map();
  const INFLIGHT=new Map();

  function db(){
    try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_e){return window.sb||null;}
  }
  function entityId(){
    const code=document.querySelector('.a45-identity code');
    if(code?.textContent?.trim())return code.textContent.trim();
    const active=document.querySelector('[data-entity-id].active,[data-entity-id][aria-current="true"]');
    return active?.dataset?.entityId||window.state?.selectedEntity||null;
  }
  async function osflProfile(id){
    if(!id)return null;
    if(CACHE.has(id))return CACHE.get(id);
    if(INFLIGHT.has(id))return INFLIGHT.get(id);
    const client=db();
    if(!client)return null;
    const job=(async()=>{
      try{
        const {data,error}=await client.from('aml_osfl_profile')
          .select('entity_id,rut,direct_confirmed,confirmation_level,detail_profile,source_detail,source_snapshot,updated_at')
          .eq('entity_id',id).maybeSingle();
        if(error)throw error;
        const row=data||null;
        CACHE.set(id,row);
        return row;
      }catch(_e){return null;}
      finally{INFLIGHT.delete(id);}
    })();
    INFLIGHT.set(id,job);
    return job;
  }
  function stateText(row){
    if(!row)return null;
    return row.direct_confirmed===true?'RESUELTA':'OBSERVADA';
  }
  function detailText(row){
    if(!row)return'';
    if(row.direct_confirmed===true)return row.source_detail||'OSFL confirmada por fuente directa';
    if(String(row.confirmation_level||'').toUpperCase()==='CORE_SII_ONLY')return 'Identificada por SII · confirmación OSFL directa pendiente';
    return row.detail_profile||row.source_detail||'Evidencia OSFL materializada';
  }
  function updateCount(){
    const ribbon=document.querySelector('.a45-source-ribbon');
    if(!ribbon)return;
    const buttons=[...ribbon.querySelectorAll('.a45-source')];
    const resolved=buttons.filter(b=>{
      const s=b.querySelector('span')?.textContent?.trim().toUpperCase()||'';
      return s&&s!=='SIN DATO'&&s!=='CARGANDO';
    }).length;
    const strong=document.querySelector('.a45-readings > div:first-child strong');
    if(!strong)return;
    const small=strong.querySelector('small');
    strong.childNodes.forEach(n=>{if(n.nodeType===Node.TEXT_NODE)n.remove();});
    strong.insertBefore(document.createTextNode(String(resolved)),small||null);
  }
  function apply(row,id){
    if(!row||!id)return;
    const tile=document.querySelector('.a45-source[data-a45-source="OSFL"]');
    if(!tile)return;
    const currentEntity=entityId();
    if(currentEntity!==id)return;
    tile.classList.remove('muted');
    const status=tile.querySelector('span');
    if(status)status.textContent=stateText(row);
    const small=tile.querySelector('small');
    if(small)small.textContent=row.updated_at||row.source_snapshot||'perfil OSFL materializado';
    tile.title=detailText(row);
    tile.dataset.osflCoverage='materialized';
    tile.dataset.osflConfirmation=String(row.confirmation_level||'');
    updateCount();
  }
  async function reconcile(){
    const tile=document.querySelector('.a45-source[data-a45-source="OSFL"]');
    if(!tile)return;
    const id=entityId();
    if(!id)return;
    const row=await osflProfile(id);
    if(row)apply(row,id);
  }
  let scheduled=false;
  function schedule(){
    if(scheduled)return;
    scheduled=true;
    setTimeout(()=>{scheduled=false;reconcile();},40);
  }
  const observer=new MutationObserver(schedule);
  function install(){
    observer.observe(document.documentElement,{subtree:true,childList:true});
    schedule();
    window.__ATLAS_ENTITY_OSFL_COVERAGE_0561__={active:true,reconcile,cache:CACHE};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
