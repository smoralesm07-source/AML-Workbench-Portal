'use strict';
/* ATLAS AML 0.54.8 · Identificación visual reforzada de Sujetos Obligados UAF
 * 0.96.3: this source is UI-only. Historical Entidad 360 Executive/Trajectory
 * dynamic loaders are permanently retired; Historia Inteligente is the sole
 * Entity 360 authority.
 */
(function atlasEntityUafHighlight0548(){
  const VERSION='ENTITY-UAF-HIGHLIGHT-0548.2';
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
  window.__ATLAS_ENTITY_UAF_HIGHLIGHT__={active:true,version:VERSION,policy:'VISIBLE_SO_UAF_IN_SEARCH_SHEET_DOSSIER',entity360Loader:'RETIRED_0963',getActiveEntityId:()=>activeEntityId};
})();

/* ATLAS AML 0.55.0 · canonical autocomplete selection.
 * A suggestion already came from aml_entities and carries entity_id. Re-running
 * the same selection as free text can lose the match on diacritics/punctuation
 * (e.g. NUÑEZ / E.I.R.L.). Exact suggestion selection therefore opens the
 * canonical entity directly by entity_id and never re-enters fuzzy/OSINT routing.
 */
(function atlasEntityCanonicalSuggestion0550(){
  const VERSION='ENTITY-CANONICAL-SUGGESTION-0550.1';
  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('.aex-suggest-item[data-aex-suggest-id]');
    if(!button)return;
    const entityId=String(button.dataset.aexSuggestId||'').trim();
    const displayName=String(button.dataset.aexSuggestName||button.querySelector('b')?.textContent||entityId).trim();
    const entry=window.__ATLAS_ENTITY_ENTRY__;
    const open=entry?.explorer?.open;
    if(!entityId||typeof open!=='function')return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const input=document.querySelector('#aex-q');
    if(input)input.value=displayName;
    document.querySelector('#aex-suggest')?.classList.remove('open');
    window.__ATLAS_ENTITY_CANONICAL_SELECTION_0550__={active:true,version:VERSION,entityId,displayName,route:'canonical_entity_id',selectedAt:new Date().toISOString()};
    void Promise.resolve(open(entityId)).catch(error=>{
      console.error('[ATLAS] canonical entity open failed',error);
      window.__ATLAS_ENTITY_CANONICAL_SELECTION_0550__={active:true,version:VERSION,entityId,displayName,route:'canonical_entity_id',error:String(error?.message||error),selectedAt:new Date().toISOString()};
    });
  },true);
  window.__ATLAS_ENTITY_CANONICAL_SELECTION_0550__={active:true,version:VERSION,route:'canonical_entity_id',installedAt:new Date().toISOString()};
})();

/* ATLAS AML 0.55.6 · carga transversal RES después de instalar las autoridades
 * de Entidades. El bootstrap sólo solicita assets same-origin permitidos por CSP. */
(function atlasEntityResBootstrapHook0556(){
  if(document.getElementById('atlas-entity-res-bootstrap-0553-js'))return;
  const s=document.createElement('script');
  s.id='atlas-entity-res-bootstrap-0553-js';
  s.src='./assets/atlas-entity-res-bootstrap-0553.js?v=0556-1';
  document.body.appendChild(s);
})();

/* 0.96.3 · IMPORTANT: the former atlasEntity360ExecutiveLoader20260903 block
 * was intentionally deleted. Nothing in this source may dynamically load or
 * replace the current Entidad 360 renderer. */
window.__ATLAS_ENTITY360_LEGACY_LOADER_RETIRED__={active:true,build:'0963',policy:'NO_DYNAMIC_EXECUTIVE_OR_TRAJECTORY_LOAD'};

/* ATLAS AML 0.96.4 · Entidad 360 hydration placeholder
 * ---------------------------------------------------
 * Historia Inteligente intentionally mounts a null package while its governed
 * sources are being resolved. Rendering the normal dossier against that null
 * package makes the analyst see "No materializado" everywhere and incorrectly
 * infer that ATLAS found no data. This presentation-only guard replaces that
 * transient null render with an explicit loading state. It does not load data,
 * change joins, mutate RLS/Auth or alter the final dossier.
 */
(function atlasEntity360HydrationPlaceholder0964(){
  const VERSION='ENTITY360-HYDRATION-PLACEHOLDER-0964.1';
  const VARIANT='HISTORY_INTELLIGENCE_ATLAS_V1';
  const STYLE_ID='atlas-e360-hydration-placeholder-style';
  let queued=false;

  function ensureStyle(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      #atlas-entity360-executive .e360-hydration-loading{min-height:520px;display:grid;place-items:center;padding:36px 24px;border:1px solid var(--atlas-line,#1e3247);border-radius:14px;background:linear-gradient(180deg,rgba(12,23,37,.98),rgba(7,17,29,.98));text-align:center}
      #atlas-entity360-executive .e360-hydration-card{width:min(520px,100%);display:flex;flex-direction:column;align-items:center;justify-content:center}
      #atlas-entity360-executive .aex-blank-icon.e360-hydration-icon{width:56px;height:56px;margin:0 0 16px;display:grid;place-items:center;border:1px solid var(--atlas-line,#26384b);border-radius:14px;background:var(--atlas-panel-lift,#122234);color:var(--atlas-accent-hi,#5bb4f5);box-shadow:0 0 0 5px rgba(59,152,224,.05)}
      #atlas-entity360-executive .e360-hydration-spinner{width:26px;height:26px;border:2px solid var(--atlas-line,#26384b);border-top-color:var(--atlas-accent-hi,#5bb4f5);border-right-color:var(--atlas-accent,#3b98e0);border-radius:50%;animation:atlasE360HydrationSpin .72s linear infinite}
      #atlas-entity360-executive .e360-hydration-eyebrow{font-size:9px;letter-spacing:.17em;text-transform:uppercase;font-weight:800;color:var(--atlas-faint,#5b7188)}
      #atlas-entity360-executive .e360-hydration-card h3{margin:8px 0 7px;color:var(--atlas-ink,#e6eef7);font-size:18px;font-weight:700}
      #atlas-entity360-executive .e360-hydration-card p{margin:0;max-width:480px;color:var(--atlas-muted,#8397ad);font-size:11.5px;line-height:1.55}
      #atlas-entity360-executive .e360-hydration-sources{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;margin-top:16px}
      #atlas-entity360-executive .e360-hydration-sources span{padding:4px 8px;border:1px solid var(--atlas-line,#1e3247);border-radius:999px;background:var(--atlas-panel-lift,#122234);color:var(--atlas-ink2,#b3c4d5);font-size:8.5px;font-weight:700}
      @keyframes atlasE360HydrationSpin{to{transform:rotate(360deg)}}
      @media(prefers-reduced-motion:reduce){#atlas-entity360-executive .e360-hydration-spinner{animation-duration:1.8s}}
    `;
    document.head.appendChild(style);
  }

  function executiveState(){return window.__ATLAS_ENTITY360_EXECUTIVE_STATE__||null;}

  function isHydrating(host){
    const st=executiveState();
    if(!host||host.dataset?.e360Variant!==VARIANT||!st)return false;
    if(st.variant!==VARIANT||st.hydrated!==false)return false;
    const hostId=String(host.dataset?.entityId||'');
    const stateId=String(st.entityId||'');
    return !hostId||!stateId||hostId===stateId;
  }

  function render(){
    queued=false;
    const host=document.querySelector('#atlas-entity360-executive.e360-history-host');
    if(!host)return false;
    if(!isHydrating(host)){
      if(host.dataset.e360HydrationLoader===VERSION)delete host.dataset.e360HydrationLoader;
      return false;
    }
    if(host.dataset.e360HydrationLoader===VERSION&&host.querySelector('.e360-hydration-loading'))return true;
    ensureStyle();
    host.dataset.e360HydrationLoader=VERSION;
    host.setAttribute('aria-busy','true');
    host.innerHTML=`<div class="e360-hydration-loading aex-blank" role="status" aria-live="polite" aria-label="Cargando Entidad 360">
      <div class="e360-hydration-card">
        <div class="aex-blank-icon e360-hydration-icon" aria-hidden="true"><span class="e360-hydration-spinner"></span></div>
        <span class="e360-hydration-eyebrow">ENTIDAD 360</span>
        <h3>Cargando Entidad 360</h3>
        <p>ATLAS está integrando los antecedentes disponibles. Los campos vacíos todavía no representan ausencia de información.</p>
        <div class="e360-hydration-sources" aria-hidden="true"><span>SII</span><span>UAF</span><span>Sanciones</span><span>RES</span><span>Compras públicas</span><span>Historia</span></div>
      </div>
    </div>`;
    window.__ATLAS_ENTITY360_HYDRATION_PLACEHOLDER__={active:true,version:VERSION,entityId:executiveState()?.entityId||null,shownAt:new Date().toISOString()};
    return true;
  }

  function schedule(){
    if(queued)return;
    queued=true;
    queueMicrotask(render);
  }

  const observer=new MutationObserver(schedule);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('atlas:entity-workspace-ready',schedule);
  document.addEventListener('atlas:entity-entry-ready',schedule);
  [0,80,220,600,1400].forEach(ms=>setTimeout(schedule,ms));
  schedule();

  window.__ATLAS_ENTITY360_HYDRATION_PLACEHOLDER_API__={active:true,version:VERSION,render,schedule,installedAt:new Date().toISOString()};
})();
