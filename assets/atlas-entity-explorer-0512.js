'use strict';
/* ATLAS AML · Entidades 0512
 * Entrada sin consulta de entidades hasta que exista intención del usuario.
 * Autocompletado, nóminas rápidas y lectura contextual de fuentes de datos.
 */
(function atlasEntityExplorer0512(){
  const ENTRY=window.__ATLAS_ENTITY_ENTRY__;
  if(!ENTRY||typeof ENTRY.load!=='function'||!ENTRY.explorer)return;

  const VERSION='ENTITY-EXPLORER-0512.2';
  const BASE_LOAD=ENTRY.load;
  const REGION_VIEW='aml_v019_gap_region';
  const PRODUCERS=[['sii','Radar SII'],['uaf','Radar UAF'],['osfl','Radar OSFL'],['press','Radar Prensa'],['san','Radar Sanciones']];
  const TYPES=['Persona jurídica','OSFL','Organismo público','Tipo no resuelto'];
  const COVERAGE_STEPS=[['0','Sin mínimo'],['2','2 o más fuentes'],['3','3 o más fuentes'],['4','4 o más fuentes']];
  let suggestTimer=null;
  let suggestSeq=0;
  let activating=false;
  let regionCache=null;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const client=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_error){return window.sb||null;}};
  const explorerRoot=()=>document.querySelector('.aex');
  const workspace=()=>{try{return typeof v019Content==='function'?v019Content():document.querySelector('#content');}catch(_error){return document.querySelector('#content');}};
  const scheduleEnhance=(delay=0)=>setTimeout(()=>enhance(),delay);

  async function prequeryRegions(){
    if(regionCache)return regionCache;
    const db=client();
    if(!db)return[];
    try{
      const {data,error}=await db.from(REGION_VIEW).select('region,entity_universe').order('entity_universe',{ascending:false});
      if(error)throw error;
      regionCache=(data||[]).filter(r=>r.region);
    }catch(_error){regionCache=[];}
    return regionCache;
  }

  function quickListsMarkup(){
    return `<div class="aex-quick-lists" aria-label="Nóminas de interés">
      <span>Nóminas rápidas</span>
      <button type="button" data-aex-quick="uaf">Observadas UAF</button>
      <button type="button" data-aex-quick="san">Con sanciones</button>
      <button type="button" data-aex-quick="both">UAF + sanciones</button>
      <button type="button" data-aex-quick="multi">Multi-fuente 3+</button>
      <button type="button" data-aex-quick="osfl">OSFL</button>
      <button type="button" data-aex-quick="public">Organismos públicos</button>
    </div>`;
  }

  function blankMarkup(){
    return `<div class="aex-blank">
      <div class="aex-blank-icon" aria-hidden="true">⌕</div>
      <h3>Busca una entidad o explora una nómina</h3>
      <p>La vista se completa cuando buscas una entidad, cambias un filtro o eliges un fenómeno de interés.</p>
    </div>`;
  }

  function prequeryMarkup(regions){
    return `<div class="aex aex-prequery">
      <section class="aex-command">
        <div class="aex-command-top">
          <div class="aex-brand"><span class="aex-eyebrow">ENTIDADES</span><h2>Explorador</h2></div>
          <div class="aex-input">
            <i aria-hidden="true">⌕</i>
            <input id="aex-q" type="search" autocomplete="off" spellcheck="false" placeholder="Razón social, RUT o Entity ID" aria-label="Buscar entidad por razón social, RUT o Entity ID" />
            <span class="aex-mode empty">Sin término</span>
            <button type="button" id="aex-clear" aria-label="Limpiar término">×</button>
            <div id="aex-suggest" class="aex-suggest" role="listbox"></div>
          </div>
          <button type="button" class="aex-btn primary" id="aex-run">Buscar</button>
        </div>
        <div class="aex-command-bottom">
          <div class="aex-facets">
            <select id="aex-region" aria-label="Territorio"><option value="">Todo el territorio</option>${regions.map(r=>`<option value="${esc(r.region)}">${esc(r.region)}${r.entity_universe!=null?` · ${Number(r.entity_universe).toLocaleString('es-CL')}`:''}</option>`).join('')}</select>
            <select id="aex-type" aria-label="Tipo de entidad"><option value="">Todo tipo</option>${TYPES.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('')}</select>
            <select id="aex-min" aria-label="Cobertura mínima de fuentes">${COVERAGE_STEPS.map(([v,l])=>`<option value="${v}">${esc(l)}</option>`).join('')}</select>
            <button type="button" class="aex-toggle uaf" id="aex-uaf" aria-pressed="false"><i></i>UAF</button>
            <button type="button" class="aex-toggle san" id="aex-san" aria-pressed="false"><i></i>Sanciones</button>
          </div>
          ${quickListsMarkup()}
        </div>
      </section>
      <section class="aex-results">${blankMarkup()}</section>
    </div>`;
  }

  function updateMode(input){
    const mode=document.querySelector('.aex-mode');
    if(!mode)return;
    const q=String(input?.value||'').trim();
    if(!q){mode.textContent='Sin término';return;}
    const compact=q.replace(/[.\s-]/g,'');
    mode.textContent=/^[0-9K]+$/i.test(compact)?'RUT':'Razón social';
  }

  async function renderPrequery(){
    const current=(()=>{try{return typeof state!=='undefined'?state:(window.state||null);}catch(_error){return window.state||null;}})();
    if(current){current.view='entities';current.selectedEntity=null;}
    if(typeof shell==='function')shell('Entidades','Exploración gobernada de identidades: búsqueda, facetas, lectura del conjunto y Expediente Analítico 360.');
    document.querySelector('#a47-entity-search-host')?.remove();
    const host=workspace();
    if(!host)return;
    host.innerHTML=prequeryMarkup(await prequeryRegions());
    bindPrequery();
    setTimeout(()=>document.querySelector('#aex-q')?.focus(),0);
    window.__ATLAS_ENTITY360_CURRENT__={...(window.__ATLAS_ENTITY360_CURRENT__||{}),release:'0.51.1',build:'0511',authority:'ENTITY_EXPLORER_0512',mode:'idle',loadedRows:0,renderedAt:new Date().toISOString()};
  }

  async function suggest(value){
    const q=String(value||'').trim();
    const host=document.querySelector('#aex-suggest');
    if(!host)return;
    if(q.length<2){host.innerHTML='';host.classList.remove('open');return;}
    const db=client();
    if(!db)return;
    const token=++suggestSeq;
    try{
      const safe=q.replace(/[%_,()*"']/g,' ').replace(/\s+/g,' ').trim().slice(0,80);
      let query=db.from('aml_entities').select('entity_id,rut,name,entity_type,region,source_count').limit(7);
      const compact=safe.replace(/[.\s-]/g,'');
      if(/^[0-9K]+$/i.test(compact))query=query.ilike('rut',`%${safe.replace(/[.\s]/g,'')}%`);
      else query=query.ilike('name',`%${safe}%`);
      const {data,error}=await query;
      if(token!==suggestSeq)return;
      if(error||!Array.isArray(data)){host.innerHTML='';host.classList.remove('open');return;}
      host.innerHTML=data.length?data.map(row=>`<button type="button" class="aex-suggest-item" data-aex-suggest-id="${esc(row.entity_id)}" data-aex-suggest-name="${esc(row.name||'')}">
        <span><b>${esc(row.name||row.entity_id)}</b><small>${esc(row.rut||'sin RUT')} · ${esc(row.region||'sin territorio')}</small></span>
        <em>${esc(row.entity_type||'Entidad')}</em>
      </button>`).join(''):'<div class="aex-suggest-empty">Sin coincidencias aproximadas</div>';
      host.classList.add('open');
      host.querySelectorAll('[data-aex-suggest-id]').forEach(button=>button.addEventListener('click',()=>{
        const input=document.querySelector('#aex-q');
        if(input)input.value=button.dataset.aexSuggestName||button.dataset.aexSuggestId||'';
        host.classList.remove('open');
        if(explorerRoot()?.classList.contains('aex-prequery'))void activate({q:input?.value||''});
        else document.querySelector('#aex-run')?.click();
      }));
    }catch(_error){host.innerHTML='';host.classList.remove('open');}
  }

  function intentForQuick(kind){
    if(kind==='uaf')return{uaf:true};
    if(kind==='san')return{sanctioned:true};
    if(kind==='both')return{uaf:true,sanctioned:true};
    if(kind==='multi')return{minSources:'3'};
    if(kind==='osfl')return{type:'OSFL'};
    if(kind==='public')return{type:'Organismo público'};
    return{};
  }

  function bindPrequery(){
    const input=document.querySelector('#aex-q');
    if(input){
      input.addEventListener('input',()=>{updateMode(input);clearTimeout(suggestTimer);suggestTimer=setTimeout(()=>void suggest(input.value),180);});
      input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();const q=input.value.trim();if(q)void activate({q});}});
    }
    document.querySelector('#aex-run')?.addEventListener('click',()=>{const q=input?.value.trim()||'';if(q)void activate({q});});
    document.querySelector('#aex-clear')?.addEventListener('click',()=>{if(input)input.value='';updateMode(input);document.querySelector('#aex-suggest')?.classList.remove('open');});
    document.querySelector('#aex-region')?.addEventListener('change',event=>{if(event.target.value)void activate({region:event.target.value});});
    document.querySelector('#aex-type')?.addEventListener('change',event=>{if(event.target.value)void activate({type:event.target.value});});
    document.querySelector('#aex-min')?.addEventListener('change',event=>{if(event.target.value!=='0')void activate({minSources:event.target.value});});
    document.querySelector('#aex-uaf')?.addEventListener('click',()=>void activate({uaf:true}));
    document.querySelector('#aex-san')?.addEventListener('click',()=>void activate({sanctioned:true}));
    document.querySelectorAll('[data-aex-quick]').forEach(btn=>btn.addEventListener('click',()=>void activate(intentForQuick(btn.dataset.aexQuick))));
  }

  function applyIntent(intent){
    const stateNow=ENTRY.explorer?.state?.()||{};
    const input=document.querySelector('#aex-q');
    if(input)input.value=String(intent.q||'');
    const region=document.querySelector('#aex-region');
    if(region&&region.value!==String(intent.region||'')){region.value=String(intent.region||'');region.dispatchEvent(new Event('change',{bubbles:true}));}
    const type=document.querySelector('#aex-type');
    if(type&&type.value!==String(intent.type||'')){type.value=String(intent.type||'');type.dispatchEvent(new Event('change',{bubbles:true}));}
    const min=document.querySelector('#aex-min');
    const targetMin=String(intent.minSources||'0');
    if(min&&min.value!==targetMin){min.value=targetMin;min.dispatchEvent(new Event('change',{bubbles:true}));}
    if(Boolean(stateNow.uaf)!==Boolean(intent.uaf))document.querySelector('#aex-uaf')?.click();
    const stateAfterUaf=ENTRY.explorer?.state?.()||{};
    if(Boolean(stateAfterUaf.sanctioned)!==Boolean(intent.sanctioned))document.querySelector('#aex-san')?.click();
    document.querySelector('#aex-run')?.click();
  }

  async function activate(intent){
    if(activating)return;
    activating=true;
    document.documentElement.classList.add('aex-activation-mask');
    try{
      await BASE_LOAD();
      applyIntent(intent||{});
      setTimeout(()=>{enhance();document.documentElement.classList.remove('aex-activation-mask');activating=false;},750);
    }catch(_error){
      document.documentElement.classList.remove('aex-activation-mask');
      activating=false;
    }
  }

  function producerTooltipHtml(print){
    const cells=[...print.querySelectorAll(':scope > i')];
    return `<span class="aex-source-pop-title">Fuentes de datos</span>${PRODUCERS.map(([key,label],idx)=>{
      const on=cells[idx]?.classList.contains('on');
      return `<span class="aex-source-pop-row"><i class="${key} ${on?'on':''}"></i><span>${esc(label)}</span><b>${on?'con dato':'sin dato'}</b></span>`;
    }).join('')}`;
  }

  function installSourcePopups(root){
    root.querySelectorAll('.aex-print:not(.sample)').forEach(print=>{
      if(print.dataset.aexSourceBound==='1')return;
      print.dataset.aexSourceBound='1';
      print.tabIndex=0;
      print.setAttribute('aria-label',(print.getAttribute('aria-label')||'Fuentes de datos')+'. Pase el cursor o enfoque para ver el detalle.');
      print.insertAdjacentHTML('beforeend',`<span class="aex-source-pop-inline" role="tooltip">${producerTooltipHtml(print)}</span>`);
    });
  }

  function applyQuickActive(kind){
    const type=document.querySelector('#aex-type');
    const min=document.querySelector('#aex-min');
    const uaf=document.querySelector('#aex-uaf');
    const san=document.querySelector('#aex-san');
    const stateNow=ENTRY.explorer?.state?.()||{};
    if(kind==='uaf'&&!stateNow.uaf)uaf?.click();
    else if(kind==='san'&&!stateNow.sanctioned)san?.click();
    else if(kind==='both'){
      if(!stateNow.uaf)uaf?.click();
      setTimeout(()=>{const now=ENTRY.explorer?.state?.()||{};if(!now.sanctioned)document.querySelector('#aex-san')?.click();scheduleEnhance(650);},180);
    }else if(kind==='multi'&&min){min.value='3';min.dispatchEvent(new Event('change',{bubbles:true}));}
    else if(kind==='osfl'&&type){type.value='OSFL';type.dispatchEvent(new Event('change',{bubbles:true}));}
    else if(kind==='public'&&type){type.value='Organismo público';type.dispatchEvent(new Event('change',{bubbles:true}));}
    scheduleEnhance(650);
  }

  function enhance(){
    const root=explorerRoot();
    if(!root||root.classList.contains('aex-prequery'))return;
    const input=root.querySelector('#aex-q');
    const inputBox=input?.closest('.aex-input');
    if(inputBox&&!inputBox.querySelector('#aex-suggest'))inputBox.insertAdjacentHTML('beforeend','<div id="aex-suggest" class="aex-suggest" role="listbox"></div>');
    if(input&&input.dataset.aex0512!=='1'){
      input.dataset.aex0512='1';
      input.addEventListener('input',()=>{clearTimeout(suggestTimer);suggestTimer=setTimeout(()=>void suggest(input.value),180);});
      input.addEventListener('focus',()=>{if(input.value.trim().length>=2)void suggest(input.value);});
    }
    const facets=root.querySelector('.aex-facets');
    if(facets&&!root.querySelector('.aex-quick-lists'))facets.insertAdjacentHTML('afterend',quickListsMarkup());
    root.querySelectorAll('[data-aex-quick]').forEach(btn=>{
      if(btn.dataset.aexBound==='1')return;
      btn.dataset.aexBound='1';
      btn.addEventListener('click',()=>applyQuickActive(btn.dataset.aexQuick));
    });
    const legend=root.querySelector('.aex-legend-item');
    if(legend)[...legend.childNodes].filter(n=>n.nodeType===3).forEach(n=>{if(n.textContent.includes('huella de productores'))n.textContent='Fuentes de datos';});
    installSourcePopups(root);
    ['#aex-region','#aex-type','#aex-min','#aex-uaf','#aex-san','#aex-run'].forEach(selector=>{
      const el=root.querySelector(selector);
      if(el&&el.dataset.aex0512Enhance!=='1'){
        el.dataset.aex0512Enhance='1';
        const evt=el.tagName==='SELECT'?'change':'click';
        el.addEventListener(evt,()=>scheduleEnhance(650),{capture:true});
      }
    });
    const clear=root.querySelector('#aex-clear');
    if(clear&&clear.dataset.aex0512Blank!=='1'){
      clear.dataset.aex0512Blank='1';
      clear.addEventListener('click',()=>setTimeout(()=>{const s=ENTRY.explorer?.state?.()||{};if(!String(s.q||'').trim()&&!s.region&&!s.type&&!s.uaf&&!s.sanctioned&&String(s.minSources||'0')==='0')void renderPrequery();},700));
    }
    const reset=root.querySelector('#aex-reset');
    if(reset&&reset.dataset.aex0512Blank!=='1'){
      reset.dataset.aex0512Blank='1';
      reset.addEventListener('click',()=>setTimeout(()=>void renderPrequery(),700));
    }
    root.querySelector('#aex-rules')?.addEventListener('click',()=>setTimeout(()=>{
      document.querySelectorAll('.aex-dl dt').forEach(dt=>{if(dt.textContent.trim()==='Huella')dt.textContent='Fuentes de datos';});
    },30),{once:true});
  }

  ENTRY.load=async function atlasEntityExplorer0512Load(){await renderPrequery();};
  try{loadEntities=ENTRY.load;}catch(_error){}
  window.loadEntities=ENTRY.load;

  window.__ATLAS_ENTITY_EXPLORER_0512__={version:VERSION,blankInitial:true,noEntityPrequery:true,autocomplete:true,quickLists:true,sourceLegend:true,cspSafe:true,installedAt:new Date().toISOString()};
})();