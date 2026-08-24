'use strict';
/* ATLAS AML 0.53.5 · gated Entity Explorer search + OSINT review threshold.
 * Search path: Atlas internal -> external OSINT query -> classify before rendering.
 * Exact normalized name matches are shown immediately. Approximate candidates remain
 * behind an analyst action and never create/promote canonical identity or mutate IPA3.
 */
(function atlasEntityOsintSearchGate0535(){
  const RELEASE='0.53.5';
  const MIN_LEN=3;
  const FN='aml-entity-global-watchlists-live';
  let seq=0;
  let bypass=false;
  let activePromise=null;
  const osintCache=new Map();

  const client=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_e){return window.sb||null;}};
  const clean=v=>String(v||'').trim().replace(/\s+/g,' ');
  const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pct=v=>Number.isFinite(Number(v))?Math.round(Number(v)*100)+'%':'—';
  const resultsHost=()=>document.querySelector('.aex-results')||document.querySelector('#content');
  const runButton=()=>document.querySelector('#aex-run');
  const input=()=>document.querySelector('#aex-q');
  const families=[['UN_SANCTIONS','ONU'],['OFAC','OFAC'],['EU_SANCTIONS','UE'],['UK_SANCTIONS','UK'],['WORLD_BANK','Banco Mundial'],['IDB_SANCTIONS','BID']];

  function sourceLabel(code){return code==='ICIJ_OFFSHORE'?'ICIJ Offshore Leaks':code==='UN_SANCTIONS'?'ONU':code==='EU_SANCTIONS'?'UE':code==='UK_SANCTIONS'?'UK':code==='WORLD_BANK'?'Banco Mundial':code==='IDB_SANCTIONS'?'BID':code==='OPENSANCTIONS'?'OpenSanctions':code;}
  function flatten(data){
    const out=[];
    Object.entries(data?.sources||{}).forEach(([code,s])=>(Array.isArray(s?.records)?s.records:[]).forEach(r=>out.push({...r,source_code:r.source_code||code})));
    const seen=new Set();
    return out.filter(r=>{const k=[r.source_code,r.source_record_id,r.related_entity_name].join('|');if(seen.has(k))return false;seen.add(k);return true;});
  }
  function exactRows(q,rows){const nq=norm(q);return rows.filter(r=>nq&&norm(r.related_entity_name||r.title||'')===nq);}
  function approximateRows(q,rows){const exact=new Set(exactRows(q,rows).map(r=>`${r.source_code}|${r.source_record_id}`));return rows.filter(r=>!exact.has(`${r.source_code}|${r.source_record_id}`));}

  function setBusy(q,stage='atlas'){
    const btn=runButton();
    if(btn){btn.disabled=true;btn.setAttribute('aria-busy','true');btn.dataset.originalLabel=btn.dataset.originalLabel||btn.textContent||'Buscar';btn.textContent='Buscando…';}
    const host=resultsHost();
    if(host){
      const label=stage==='osint'?'Sin coincidencia interna. Verificando OSINT y listas internacionales…':'Buscando primero en el universo interno de Atlas…';
      host.innerHTML=`<section class="agw-card"><div class="agw-loading"><b>${label}</b><br><small>${esc(q)} · Atlas responderá cuando finalice la ruta de búsqueda</small></div></section>`;
    }
  }
  function clearBusy(){const btn=runButton();if(btn){btn.disabled=false;btn.removeAttribute('aria-busy');btn.textContent=btn.dataset.originalLabel||'Buscar';}}

  async function hasInternalCandidate(q){
    const db=client();if(!db)throw new Error('Supabase no disponible');
    const safe=clean(q).replace(/[%_,()*"']/g,' ').trim().slice(0,100);if(!safe)return false;
    const compact=safe.replace(/[.\s-]/g,'');
    let query=db.from('aml_entities').select('entity_id').limit(1);
    if(/^[0-9K]+$/i.test(compact))query=query.ilike('rut',`%${safe.replace(/[.\s-]/g,'')}%`);
    else query=query.ilike('name',`%${safe}%`);
    const {data,error}=await query;if(error)throw error;
    return Array.isArray(data)&&data.length>0;
  }

  async function queryOsint(q){
    const key=norm(q),cached=osintCache.get(key);
    if(cached&&Date.now()-cached.at<5*60*1000)return cached.data;
    const db=client();if(!db)throw new Error('Supabase no disponible');
    const res=await db.functions.invoke(FN,{body:{name:q,rut:'',entity_type:'Person'}});
    if(res.error)throw res.error;
    if(!res.data?.ok)throw new Error(res.data?.error||'Respuesta internacional no válida');
    osintCache.set(key,{at:Date.now(),data:res.data});
    return res.data;
  }

  function findingMarkup(r){return `<article class="agw-finding"><div class="agw-finding-top"><span>${esc(sourceLabel(r.source_code))}</span><strong>${esc(r.related_entity_name||r.title||'Candidato internacional')}</strong><em>${pct(r.match_confidence)}</em></div><p>${esc(r.summary||r.title||'Sin resumen adicional.')}</p><dl><dt>Estado</dt><dd>candidato; requiere revisión</dd><dt>Método</dt><dd>${esc(r.match_method||'—')}</dd></dl>${r.source_url?`<a href="${esc(r.source_url)}" target="_blank" rel="noopener noreferrer">Abrir evidencia de origen ↗</a>`:''}</article>`;}

  function sourceRail(data,rows){
    const os=data?.sources?.OPENSANCTIONS||{};
    return `<div class="agw-family-rail">${families.map(([code,label])=>{const n=rows.filter(r=>r.source_code===code).length;const direct=data?.sources?.[code]?.coverage?.mode?.includes?.('official');const ready=os?.status==='fresh'||direct;return `<span class="${n?'hit':ready?'ready':'pending'}"><i></i><b>${label}</b><small>${n?`${n} candidato(s)`:ready?'sin coincidencia exacta':'sin materializar'}</small></span>`;}).join('')}</div>`;
  }

  function renderExact(q,data,rows){
    const host=resultsHost();if(!host)return;
    host.innerHTML=`<section class="agw-card agw-external"><header class="agw-main-head"><div><span class="agw-eyebrow">OSINT EXTERNO · COINCIDENCIA NOMINAL EXACTA</span><h3>Coincidencia exacta encontrada</h3><p>Atlas no encontró una entidad interna para <b>${esc(q)}</b>, pero encontró ${rows.length===1?'una coincidencia':'coincidencias'} cuyo nombre normalizado es idéntico al consultado. Esto sigue siendo evidencia para revisión, no identidad confirmada.</p></div><div class="agw-kpis"><span><b>${rows.length}</b><small>exacta(s)</small></span><span><b>100%</b><small>igualdad nominal</small></span></div></header>${sourceRail(data,rows)}<section class="agw-evidence"><header><h4>Coincidencias exactas para revisión</h4><span>no crean entidad ni alteran IPA3</span></header>${rows.slice(0,24).map(findingMarkup).join('')}</section><div class="agw-rule"><b>Regla de lectura:</b> 100% significa igualdad del nombre normalizado. Aun así, la identidad debe corroborarse con fecha de nacimiento, documento, nacionalidad u otros identificadores.</div></section>`;
  }

  function renderApproxGate(q,data,rows){
    const host=resultsHost();if(!host)return;
    const max=Math.max(0,...rows.map(r=>Number(r.match_confidence)||0));
    const bySource=[...new Set(rows.map(r=>sourceLabel(r.source_code)))];
    host.innerHTML=`<section class="agw-card agw-external"><header class="agw-main-head"><div><span class="agw-eyebrow">OSINT EXTERNO · REVISIÓN OPCIONAL</span><h3>Sin coincidencia exacta</h3><p>No existe una entidad Atlas ni una coincidencia nominal 100% para <b>${esc(q)}</b>. Hay candidatos aproximados que pueden revisarse de forma opcional.</p></div><div class="agw-kpis"><span><b>${rows.length}</b><small>aproximados</small></span><span><b>${pct(max)}</b><small>máx. similitud</small></span></div></header><div class="agw-rule"><b>No se muestran automáticamente</b> para evitar ruido y falsos positivos. Fuentes con candidatos: ${esc(bySource.join(', ')||'—')}.</div><div style="display:flex;gap:10px;align-items:center;margin-top:14px"><button type="button" class="aex-osint-btn" data-agw-show-approx>Ver ${rows.length} coincidencia${rows.length===1?'':'s'} OSINT aproximada${rows.length===1?'':'s'}</button><span style="font-size:12px;color:#8fa3bd">Revisión analítica voluntaria · no promueve identidad</span></div><div data-agw-approx-results style="display:none;margin-top:16px"><section class="agw-evidence"><header><h4>Candidatos aproximados</h4><span>ordenados por similitud</span></header>${rows.slice().sort((a,b)=>(Number(b.match_confidence)||0)-(Number(a.match_confidence)||0)).slice(0,24).map(findingMarkup).join('')}</section>${sourceRail(data,rows)}</div></section>`;
    host.querySelector('[data-agw-show-approx]')?.addEventListener('click',e=>{const box=host.querySelector('[data-agw-approx-results]');if(!box)return;box.style.display=box.style.display==='none'?'block':'none';e.currentTarget.textContent=box.style.display==='none'?`Ver ${rows.length} coincidencia${rows.length===1?'':'s'} OSINT aproximada${rows.length===1?'':'s'}`:'Ocultar coincidencias aproximadas';});
  }

  function renderEmpty(q,data){
    const host=resultsHost();if(!host)return;
    host.innerHTML=`<section class="agw-card agw-external"><header class="agw-main-head"><div><span class="agw-eyebrow">BÚSQUEDA INTEGRADA COMPLETADA</span><h3>Sin resultados</h3><p>No se encontraron entidades internas ni coincidencias OSINT para <b>${esc(q)}</b> en las fuentes disponibles.</p></div></header>${sourceRail(data,[])}</section>`;
  }

  function continueInternal(){const btn=runButton();if(!btn)return;bypass=true;try{btn.click();}finally{queueMicrotask(()=>{bypass=false;});}}

  async function execute(raw){
    const q=clean(raw);if(q.length<MIN_LEN)return;
    if(activePromise)return activePromise;
    const token=++seq;
    activePromise=(async()=>{
      try{
        setBusy(q,'atlas');
        const found=await hasInternalCandidate(q);if(token!==seq)return;
        if(found){clearBusy();continueInternal();window.__ATLAS_ENTITY_OSINT_AUTO_FALLBACK_0532__={active:true,release:RELEASE,lastQuery:q,route:'internal',escalated:false,checkedAt:new Date().toISOString(),identityPromotion:false,scoreMutation:false};return;}
        setBusy(q,'osint');
        const data=await queryOsint(q);if(token!==seq)return;
        const all=flatten(data),exact=exactRows(q,all),approx=approximateRows(q,all);
        if(exact.length)renderExact(q,data,exact);
        else if(approx.length)renderApproxGate(q,data,approx);
        else renderEmpty(q,data);
        window.__ATLAS_ENTITY_OSINT_AUTO_FALLBACK_0532__={active:true,release:RELEASE,lastQuery:q,route:exact.length?'external_exact':approx.length?'external_approximate_review':'empty',escalated:true,exactCount:exact.length,approximateCount:approx.length,checkedAt:new Date().toISOString(),canonicalEntityCreated:false,identityPromotion:false,scoreMutation:false};
      }catch(error){
        const host=resultsHost();if(host)host.innerHTML=`<section class="agw-card"><div class="agw-error">No fue posible completar la búsqueda integrada: ${esc(error?.message||error)}</div></section>`;
        window.__ATLAS_ENTITY_OSINT_AUTO_FALLBACK_0532__={active:true,release:RELEASE,lastQuery:q,route:'error',escalated:false,error:String(error?.message||error),checkedAt:new Date().toISOString(),identityPromotion:false,scoreMutation:false};
      }finally{clearBusy();activePromise=null;}
    })();
    return activePromise;
  }

  document.addEventListener('click',event=>{const target=event.target?.closest?.('#aex-run');if(!target||bypass)return;const q=clean(input()?.value||'');if(q.length<MIN_LEN)return;event.preventDefault();event.stopImmediatePropagation();void execute(q);},true);
  document.addEventListener('keydown',event=>{if(event.key!=='Enter'||event.target?.id!=='aex-q'||bypass)return;const q=clean(input()?.value||'');if(q.length<MIN_LEN)return;event.preventDefault();event.stopImmediatePropagation();void execute(q);},true);

  const obs=new MutationObserver(()=>{const manual=document.querySelector('#aex-osint-run');if(manual)manual.style.display='none';const hint=document.querySelector('[data-osint-hint]');if(hint)hint.style.display='none';});
  obs.observe(document.documentElement,{subtree:true,childList:true});

  window.__ATLAS_ENTITY_OSINT_AUTO_FALLBACK_0532__={active:true,release:RELEASE,automaticFallback:true,gatedSearch:true,exactAutoOpen:true,approximateRequiresReview:true,exactDefinition:'normalized_name_equality',duplicateSearchSuppression:true,whileTyping:false,identityPromotion:false,scoreMutation:false,installedAt:new Date().toISOString()};
})();
