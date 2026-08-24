'use strict';
/* ATLAS AML · Entidades 0512
 * Refinamiento no destructivo sobre ENTITY_EXPLORER_0510:
 * - entrada visual en blanco hasta que exista intención de consulta;
 * - autocompletado aproximado de entidades mientras se escribe;
 * - accesos rápidos a nóminas de interés;
 * - “Huella de productores” pasa a “Fuentes de datos” con leyenda contextual.
 */
(function atlasEntityExplorer0512(){
  const ENTRY=window.__ATLAS_ENTITY_ENTRY__;
  if(!ENTRY||typeof ENTRY.load!=='function'||!ENTRY.explorer)return;

  const VERSION='ENTITY-EXPLORER-0512.1';
  const BASE_LOAD=ENTRY.load;
  const PRODUCERS=[
    ['sii','Radar SII'],['uaf','Radar UAF'],['osfl','Radar OSFL'],['press','Radar Prensa'],['san','Radar Sanciones']
  ];
  let hasIntent=false;
  let suggestTimer=null;
  let suggestSeq=0;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const client=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_error){return window.sb||null;}};
  const content=()=>document.querySelector('.aex');
  const scheduleEnhance=(delay=0)=>setTimeout(()=>enhance(),delay);

  function currentFilters(){
    const state=ENTRY.explorer?.state?.()||{};
    return Boolean(String(state.q||'').trim()||state.region||state.type||state.uaf||state.sanctioned||String(state.minSources||'0')!=='0');
  }

  function setBlankState(){
    hasIntent=false;
    const root=content();
    if(!root)return;
    const panorama=root.querySelector('#aex-panorama');
    if(panorama)panorama.innerHTML='';
    const results=root.querySelector('.aex-results');
    if(results)results.innerHTML=`<div class="aex-blank">
      <div class="aex-blank-icon" aria-hidden="true">⌕</div>
      <h3>Busca una entidad o explora una nómina</h3>
      <p>La vista se completa cuando escribes una entidad, cambias un filtro o eliges un fenómeno de interés.</p>
    </div>`;
    root.querySelectorAll('.aex-strip>div').forEach(node=>{
      const b=node.querySelector('b');
      if(b)b.textContent='—';
    });
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
        hasIntent=true;
        document.querySelector('#aex-run')?.click();
        scheduleEnhance(650);
      }));
    }catch(_error){host.innerHTML='';host.classList.remove('open');}
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

  function applyQuick(kind){
    const type=document.querySelector('#aex-type');
    const min=document.querySelector('#aex-min');
    const uaf=document.querySelector('#aex-uaf');
    const san=document.querySelector('#aex-san');
    const state=ENTRY.explorer?.state?.()||{};
    hasIntent=true;
    if(kind==='uaf'&&!state.uaf)uaf?.click();
    else if(kind==='san'&&!state.sanctioned)san?.click();
    else if(kind==='both'){
      if(!state.uaf)uaf?.click();
      setTimeout(()=>{const now=ENTRY.explorer?.state?.()||{};if(!now.sanctioned)document.querySelector('#aex-san')?.click();scheduleEnhance(650);},180);
    }else if(kind==='multi'&&min){min.value='3';min.dispatchEvent(new Event('change',{bubbles:true}));}
    else if(kind==='osfl'&&type){type.value='OSFL';type.dispatchEvent(new Event('change',{bubbles:true}));}
    else if(kind==='public'&&type){type.value='Organismo público';type.dispatchEvent(new Event('change',{bubbles:true}));}
    scheduleEnhance(650);
  }

  function enhance(){
    const root=content();
    if(!root)return;
    const input=root.querySelector('#aex-q');
    const inputBox=input?.closest('.aex-input');
    if(inputBox&&!inputBox.querySelector('#aex-suggest'))inputBox.insertAdjacentHTML('beforeend','<div id="aex-suggest" class="aex-suggest" role="listbox"></div>');

    if(input&&input.dataset.aex0512!=='1'){
      input.dataset.aex0512='1';
      input.addEventListener('input',()=>{
        clearTimeout(suggestTimer);
        suggestTimer=setTimeout(()=>void suggest(input.value),180);
      });
      input.addEventListener('focus',()=>{if(input.value.trim().length>=2)void suggest(input.value);});
    }

    const facets=root.querySelector('.aex-facets');
    if(facets&&!root.querySelector('.aex-quick-lists'))facets.insertAdjacentHTML('afterend',quickListsMarkup());
    root.querySelectorAll('[data-aex-quick]').forEach(btn=>{
      if(btn.dataset.aexBound==='1')return;
      btn.dataset.aexBound='1';
      btn.addEventListener('click',()=>applyQuick(btn.dataset.aexQuick));
    });

    const legend=root.querySelector('.aex-legend-item');
    if(legend){
      [...legend.childNodes].filter(n=>n.nodeType===3).forEach(n=>{if(n.textContent.includes('huella de productores'))n.textContent='Fuentes de datos';});
    }
    installSourcePopups(root);

    ['#aex-region','#aex-type','#aex-min'].forEach(selector=>{
      const el=root.querySelector(selector);
      if(el&&el.dataset.aex0512!=='1'){
        el.dataset.aex0512='1';
        el.addEventListener('change',()=>{hasIntent=true;scheduleEnhance(650);},{capture:true});
      }
    });
    ['#aex-uaf','#aex-san','#aex-run'].forEach(selector=>{
      const el=root.querySelector(selector);
      if(el&&el.dataset.aex0512!=='1'){
        el.dataset.aex0512='1';
        el.addEventListener('click',()=>{hasIntent=true;scheduleEnhance(650);},{capture:true});
      }
    });
    const clear=root.querySelector('#aex-clear');
    if(clear&&clear.dataset.aex0512!=='1'){
      clear.dataset.aex0512='1';
      clear.addEventListener('click',()=>setTimeout(()=>{if(!currentFilters())setBlankState();enhance();},650));
    }
    const reset=root.querySelector('#aex-reset');
    if(reset&&reset.dataset.aex0512!=='1'){
      reset.dataset.aex0512='1';
      reset.addEventListener('click',()=>setTimeout(()=>{setBlankState();enhance();},650));
    }
    root.querySelector('#aex-rules')?.addEventListener('click',()=>setTimeout(()=>{
      document.querySelectorAll('.aex-dl dt').forEach(dt=>{if(dt.textContent.trim()==='Huella')dt.textContent='Fuentes de datos';});
    },30),{once:true});
  }

  ENTRY.load=async function atlasEntityExplorer0512Load(...args){
    await BASE_LOAD(...args);
    setBlankState();
    enhance();
    setTimeout(()=>document.querySelector('#aex-q')?.focus(),0);
  };
  try{loadEntities=ENTRY.load;}catch(_error){}
  window.loadEntities=ENTRY.load;

  window.__ATLAS_ENTITY_EXPLORER_0512__={version:VERSION,blankInitial:true,autocomplete:true,quickLists:true,sourceLegend:true,cspSafe:true,installedAt:new Date().toISOString()};
})();