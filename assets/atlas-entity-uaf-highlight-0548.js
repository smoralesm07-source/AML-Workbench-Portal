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
    dossier.querySelectorAll('.a45-identity .a45-chip,.a45-identity [class*="chip"],.a45-cover [class*="chip"]').forEach(chip=>{
      if(isSoText(chip.textContent))chip.classList.add('asuaf-existing-so');
    });
  }

  function run(){scheduled=false;decorateSearch();decorateSuggestions();decorateSheet();decorateDossier();}
  function schedule(){if(scheduled)return;scheduled=true;setTimeout(run,60);}

  document.addEventListener('click',event=>{
    const target=event.target.closest?.('[data-aex-open],[data-aex-peek],[data-aex-suggest-id]');
    if(target){activeEntityId=target.dataset.aexOpen||target.dataset.aexPeek||target.dataset.aexSuggestId||activeEntityId;schedule();setTimeout(schedule,350);}
  },true);
  const obs=new MutationObserver(schedule);
  obs.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-hidden']});
  schedule();
  window.__ATLAS_ENTITY_UAF_HIGHLIGHT__={active:true,version:VERSION,policy:'VISIBLE_SO_UAF_IN_SEARCH_SHEET_DOSSIER',getActiveEntityId:()=>activeEntityId};
})();
