'use strict';

/* ATLAS AML 0.53.0 · Transversal Entity Resolution UI
 * Reads governed candidates from aml_v_entity_resolution_top_v1.
 * Never rewrites, redirects or merges the observed entity automatically.
 */
(function atlasEntityResolution0530(){
  const VERSION='ENTITY-RESOLUTION-0530.1';
  const VIEW='aml_v_entity_resolution_top_v1';
  const cache=new Map();
  const pending=new Set();
  let scheduled=false;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const client=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_e){return window.sb||null;}};
  const buttons=()=>[...document.querySelectorAll('[data-atlas-entity-suggestion],[data-atlas-entity-result]')];
  const entityId=el=>el?.dataset?.atlasEntitySuggestion||el?.dataset?.atlasEntityResult||'';
  const open=id=>{if(typeof window.openEntity==='function')return window.openEntity(id);if(typeof window.v0203OpenEntity==='function')return window.v0203OpenEntity(id);};

  function label(row){
    if(Number(row.score)>=90&&!row.ambiguous)return 'Coincidencia muy alta';
    if(Number(row.score)>=70&&!row.ambiguous)return 'Coincidencia alta';
    return 'Posible correspondencia';
  }
  function tone(row){
    if(Number(row.score)>=90&&!row.ambiguous)return 'very-high';
    if(Number(row.score)>=70&&!row.ambiguous)return 'high';
    return 'possible';
  }
  function detail(row){
    const e=row.evidence||{};
    const bits=[];
    if(e.exact_resolution_key)bits.push('nombre normalizado equivalente');
    if(e.shared_distinctive_tokens)bits.push(`${e.shared_distinctive_tokens} ancla${Number(e.shared_distinctive_tokens)===1?'':'s'} distintiva${Number(e.shared_distinctive_tokens)===1?'':'s'}`);
    if(e.type_compatible)bits.push('tipo compatible');
    if(e.region_match)bits.push('misma región');
    if(e.commune_match)bits.push('misma comuna');
    if(row.ambiguous)bits.push('existen alternativas cercanas');
    return bits.join(' · ')||'coincidencia heurística gobernada';
  }
  function markup(row){
    if(!row||Number(row.score)<50)return '';
    const ambiguous=row.ambiguous?'<span class="atlas-er-ambiguous">Ambigua</span>':'';
    return `<span class="atlas-er-match ${tone(row)}" data-atlas-er-candidate="${esc(row.canonical_entity_id)}" role="button" tabindex="0" aria-label="Abrir entidad canónica sugerida"><span class="atlas-er-kicker">${esc(label(row))}${ambiguous}</span><span class="atlas-er-main"><b>${esc(row.canonical_name)}</b><em>${esc(row.canonical_rut||'RUT no materializado')}</em><strong>${Number(row.score).toLocaleString('es-CL',{maximumFractionDigits:1})}/100</strong></span><small>${esc(detail(row))} · no fusiona ni transfiere riesgo</small></span>`;
  }
  function decorate(el,row){
    if(!el||el.dataset.atlasErDecorated===VERSION)return;
    el.querySelector('.atlas-er-match')?.remove();
    const html=markup(row);
    if(html){
      const target=el.querySelector('.chips')?.parentElement||el.firstElementChild||el;
      target.insertAdjacentHTML('beforeend',html);
      const hit=target.querySelector('.atlas-er-match');
      const activate=ev=>{ev.preventDefault();ev.stopPropagation();open(hit?.dataset?.atlasErCandidate);};
      hit?.addEventListener('click',activate);
      hit?.addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' '){activate(ev);}});
    }
    el.dataset.atlasErDecorated=VERSION;
  }
  function applyCached(){
    buttons().forEach(el=>{
      const id=entityId(el);if(!id)return;
      if(cache.has(id))decorate(el,cache.get(id));
      else if(!el.dataset.atlasErRequested)pending.add(id);
    });
  }
  async function flush(){
    scheduled=false;
    const db=client();if(!db)return;
    const ids=[...pending].filter(Boolean).slice(0,80);ids.forEach(id=>pending.delete(id));
    if(!ids.length)return;
    buttons().forEach(el=>{if(ids.includes(entityId(el)))el.dataset.atlasErRequested='1';});
    try{
      const {data,error}=await db.from(VIEW)
        .select('observed_entity_id,canonical_entity_id,score,confidence_band,resolution_state,requires_review,ambiguous,score_margin,evidence,model_version,canonical_rut,canonical_name')
        .in('observed_entity_id',ids);
      if(error)throw error;
      ids.forEach(id=>cache.set(id,null));
      (data||[]).forEach(row=>cache.set(row.observed_entity_id,row));
      applyCached();
    }catch(error){
      console.warn('[ATLAS] Entity resolution candidates unavailable',error);
      ids.forEach(id=>cache.set(id,null));
    }
    if(pending.size)schedule();
  }
  function schedule(){
    if(scheduled)return;scheduled=true;
    queueMicrotask(()=>void flush());
  }
  function scan(){applyCached();if(pending.size)schedule();}

  const observer=new MutationObserver(()=>scan());
  function bind(){observer.observe(document.documentElement,{childList:true,subtree:true});scan();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
  window.addEventListener('atlas:nav-refresh',scan);
  window.__ATLAS_ENTITY_RESOLUTION__={active:true,version:VERSION,view:VIEW,policy:'OBSERVED_ENTITY_PRESERVED+NO_AUTO_MERGE+NO_RISK_TRANSFER',scoreSemantics:'HEURISTIC_CONFIDENCE_NOT_CALIBRATED_PROBABILITY',cache};
})();
