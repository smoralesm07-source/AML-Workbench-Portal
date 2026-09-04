'use strict';
/* ATLAS AML 0.54.8 · Identificación visual reforzada de Sujetos Obligados UAF */
(function atlasEntityUafHighlight0548(){
  const VERSION='ENTITY-UAF-HIGHLIGHT-0548.1';
  const cache=new Map();
  const pending=new Set();
  let activeEntityId='';
  let scheduled=false;

  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch{return window.sb||null;}};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim();
  const isSoText=v=>/\b(SO|SUJETO OBLIGADO)\b/.test(norm(v))&&/\bUAF\b/.test(norm(v));

  function badge(compact=false){
    return `<span class="asuaf-badge${compact?' compact':''}" title="Sujeto obligado inscrito/observado en la UAF"><i aria-hidden="true">✓</i><span>${compact?'SO · UAF':'SUJETO OBLIGADO UAF'}</span></span>`;
  }

  async function hydrate(ids){
    const wanted=[...new Set((ids||[]).filter(Boolean).map(String).filter(id=>!cache.has(id)&&!pending.has(id)))];
    if(!wanted.length)return;
    const client=db();if(!client)return;
    wanted.forEach(id=>pending.add(id));
    try{
      const {data,error}=await client.from('aml_entities').select('entity_id,is_uaf_observed,profile').in('entity_id',wanted);
      if(error)throw error;
      const found=new Map((data||[]).map(r=>[String(r.entity_id),r]));
      wanted.forEach(id=>{
        const r=found.get(id);
        const roles=[...(Array.isArray(r?.profile?.roles_es)?r.profile.roles_es:[]),...(Array.isArray(r?.profile?.roles)?r.profile.roles:[])];
        cache.set(id,Boolean(r?.is_uaf_observed===true||roles.some(isSoText)));
      });
    }catch(_error){wanted.forEach(id=>cache.set(id,false));}
    finally{wanted.forEach(id=>pending.delete(id));schedule();}
  }

  function decorateSearch(){
    const rows=[...document.querySelectorAll('.aex-row')];
    const ids=[];
    rows.forEach(row=>{
      const btn=row.querySelector('[data-aex-open],[data-aex-peek]');
      const id=btn?.dataset.aexOpen||btn?.dataset.aexPeek||'';
      if(!id)return;ids.push(id);
      const so=cache.get(String(id));
      row.classList.toggle('asuaf-so',so===true);
      const name=row.querySelector('.aex-id');
      if(name){
        name.querySelector('.asuaf-badge')?.remove();
        if(so===true)name.insertAdjacentHTML('beforeend',badge(true));
      }
    });
    void hydrate(ids);
  }

  function decorateSuggestions(){
    const buttons=[...document.querySelectorAll('.aex-suggest-item[data-aex-suggest-id]')];
    const ids=buttons.map(b=>b.dataset.aexSuggestId).filter(Boolean);
    buttons.forEach(b=>{
      const so=cache.get(String(b.dataset.aexSuggestId||''));
      b.classList.toggle('asuaf-so',so===true);
      b.querySelector('.asuaf-badge')?.remove();
      if(so===true)b.insertAdjacentHTML('beforeend',badge(true));
    });
    void hydrate(ids);
  }

  function sheetEntityId(){return activeEntityId||'';}
  function decorateSheet(){
    const sheet=document.querySelector('#aex-sheet');
    if(!sheet||sheet.getAttribute('aria-hidden')==='true')return;
    const id=sheetEntityId();
    if(id&&!cache.has(id)){void hydrate([id]);return;}
    const body=sheet.querySelector('#aex-sheet-body');
    const textual=isSoText(sheet.textContent);
    const so=(id&&cache.get(id)===true)||textual;
    sheet.classList.toggle('asuaf-so-sheet',so);
    sheet.querySelector('.asuaf-sheet-callout')?.remove();
    if(so&&body)body.insertAdjacentHTML('afterbegin',`<div class="asuaf-sheet-callout">${badge(false)}<div><b>Entidad inscrita como sujeto obligado</b><span>Condición UAF destacada para lectura inmediata del expediente.</span></div></div>`);
  }

  function dossierId(dossier){
    const txt=dossier?.textContent||'';
    const match=txt.match(/\bENT-[A-Z0-9-]+\b/i);
    return match?match[0].toUpperCase():activeEntityId;
  }
  function decorateDossier(){
    const dossier=document.querySelector('.a45');if(!dossier)return;
    const id=dossierId(dossier);
    if(id&&!cache.has(id)){void hydrate([id]);return;}
    const textual=isSoText(dossier.textContent);
    const so=(id&&cache.get(id)===true)||textual;
    dossier.classList.toggle('asuaf-so-dossier',so);
    dossier.querySelector('.asuaf-dossier-ribbon')?.remove();
    if(!so)return;
    const identity=dossier.querySelector('.a45-identity')||dossier.querySelector('.a45-cover')||dossier.firstElementChild;
    identity?.insertAdjacentHTML('afterbegin',`<div class="asuaf-dossier-ribbon">${badge(false)}<span>INSCRITO EN UAF</span></div>`);
    dossier.querySelectorAll('.a45-identity .a45-chip,.a45-identity [class*="chip"],.a45-cover [class*="chip"]').forEach(chip=>{if(isSoText(chip.textContent))chip.classList.add('asuaf-existing-so');});
  }

  function run(){scheduled=false;decorateSearch();decorateSuggestions();decorateSheet();decorateDossier();}
  function schedule(){if(scheduled)return;scheduled=true;setTimeout(run,60);}
  document.addEventListener('click',event=>{const target=event.target.closest?.('[data-aex-open],[data-aex-peek],[data-aex-suggest-id]');if(target){activeEntityId=target.dataset.aexOpen||target.dataset.aexPeek||target.dataset.aexSuggestId||activeEntityId;schedule();setTimeout(schedule,350);}},true);
  const obs=new MutationObserver(schedule);obs.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-hidden']});schedule();
  window.__ATLAS_ENTITY_UAF_HIGHLIGHT__={active:true,version:VERSION,policy:'VISIBLE_SO_UAF_IN_SEARCH_SHEET_DOSSIER',getActiveEntityId:()=>activeEntityId};
})();

/* ATLAS AML 0.55.0 · canonical autocomplete selection. */
(function atlasEntityCanonicalSuggestion0550(){
  const VERSION='ENTITY-CANONICAL-SUGGESTION-0550.1';
  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('.aex-suggest-item[data-aex-suggest-id]');if(!button)return;
    const entityId=String(button.dataset.aexSuggestId||'').trim(),displayName=String(button.dataset.aexSuggestName||button.querySelector('b')?.textContent||entityId).trim(),entry=window.__ATLAS_ENTITY_ENTRY__,open=entry?.explorer?.open;
    if(!entityId||typeof open!=='function')return;event.preventDefault();event.stopImmediatePropagation();
    const input=document.querySelector('#aex-q');if(input)input.value=displayName;document.querySelector('#aex-suggest')?.classList.remove('open');
    window.__ATLAS_ENTITY_CANONICAL_SELECTION_0550__={active:true,version:VERSION,entityId,displayName,route:'canonical_entity_id',selectedAt:new Date().toISOString()};
    void Promise.resolve(open(entityId)).catch(error=>{console.error('[ATLAS] canonical entity open failed',error);window.__ATLAS_ENTITY_CANONICAL_SELECTION_0550__={active:true,version:VERSION,entityId,displayName,route:'canonical_entity_id',error:String(error?.message||error),selectedAt:new Date().toISOString()};});
  },true);
  window.__ATLAS_ENTITY_CANONICAL_SELECTION_0550__={active:true,version:VERSION,route:'canonical_entity_id',installedAt:new Date().toISOString()};
})();

/* ATLAS AML 0.55.6 · carga transversal RES. */
(function atlasEntityResBootstrapHook0556(){if(document.getElementById('atlas-entity-res-bootstrap-0553-js'))return;const s=document.createElement('script');s.id='atlas-entity-res-bootstrap-0553-js';s.src='./assets/atlas-entity-res-bootstrap-0553.js?v=0556-1';document.body.appendChild(s);})();

/* ATLAS AML 0.71.0 · Entidad 360 Executive. Se instala al completar la carga
 * para envolver la autoridad final de Entidades y evitar carreras entre capas. */
(function atlasEntity360ExecutiveLoader20260903(){
  const FLAG='__ATLAS_ENTITY360_EXECUTIVE_LOADER__';if(window[FLAG])return;
  window[FLAG]={active:true,installed:false,trajectory:false,build:'20260903-e360-loader2'};
  const CSS='./assets/atlas-entity360-executive-20260903.css?v=20260903-2',JS='./assets/atlas-entity360-executive-20260903.js?v=20260903-2',TRAJECTORY='./assets/atlas-entity360-trajectory-20260903.js?v=20260903-1';
  function installTrajectory(){if(window.__ATLAS_ENTITY360_TRAJECTORY__?.active){window[FLAG].trajectory=true;return;}if(document.querySelector('script[data-atlas-e360-trajectory]'))return;const t=document.createElement('script');t.src=TRAJECTORY;t.async=false;t.dataset.atlasE360Trajectory='1';t.onload=()=>{window[FLAG].trajectory=!!window.__ATLAS_ENTITY360_TRAJECTORY__?.active;};t.onerror=()=>{window[FLAG].trajectoryError='asset-load-failed';};document.body.appendChild(t);}
  function install(){
    if(window[FLAG].installed||window.__ATLAS_ENTITY360_EXECUTIVE__?.active){installTrajectory();return;}
    if(typeof window.v0203RenderEntity!=='function'){setTimeout(install,120);return;}
    if(!document.querySelector('link[data-atlas-e360-executive]')){const link=document.createElement('link');link.rel='stylesheet';link.href=CSS;link.dataset.atlasE360Executive='1';document.head.appendChild(link);}
    if(document.querySelector('script[data-atlas-e360-executive]'))return;
    const script=document.createElement('script');script.src=JS;script.async=false;script.dataset.atlasE360Executive='1';script.onload=()=>{window[FLAG].installed=!!window.__ATLAS_ENTITY360_EXECUTIVE__?.active;window[FLAG].loadedAt=new Date().toISOString();installTrajectory();};script.onerror=()=>{window[FLAG].error='asset-load-failed';window[FLAG].failedAt=new Date().toISOString();};document.body.appendChild(script);
  }
  if(document.readyState==='complete')setTimeout(install,0);else window.addEventListener('load',()=>setTimeout(install,0),{once:true});
  document.addEventListener('atlas:entity-workspace-ready',()=>setTimeout(install,0));
})();
