'use strict';

/* ATLAS AML · Entidad 360 visual/runtime polish authority · 2026-09-04
 * Presentation-first repair. It does not alter AML data, scoring, RLS, auth or
 * identity joins. The only runtime intervention is synchronising the historical
 * `window.amlState` compatibility mirror from the canonical application state
 * before Historia Inteligente is asked to render.
 */
(function atlasEntity360Polish20260904(){
  const BUILD='20260904-e360-polish3';
  const PATCH='ENTITY360_CANONICAL_STATE_BRIDGE_20260904';
  const VARIANT='HISTORY_INTELLIGENCE_ATLAS_V1';
  if(window.__ATLAS_ENTITY360_POLISH__?.build===BUILD)return;

  function canonicalState(){
    try{if(typeof state!=='undefined'&&state)return state;}catch(_error){}
    if(window.state)return window.state;
    return window.amlState||null;
  }

  function canonicalEntityId(fallback=null){
    const s=canonicalState();
    return s?.selectedEntity||fallback||window.__ATLAS_ENTITY360_CURRENT__?.entityId||window.__ATLAS_ENTITY360_CURRENT__?.selectedEntity||null;
  }

  function syncCompatibility(entityId=null,reason='sync'){
    const s=canonicalState();
    const id=entityId||s?.selectedEntity||null;
    if(s){
      try{
        if(id)s.selectedEntity=id;
        if(id)s.view='entities';
      }catch(_error){}
    }
    const legacy=window.amlState;
    if(legacy&&legacy!==s){
      try{
        if(id)legacy.selectedEntity=id;
        if(id)legacy.view='entities';
      }catch(_error){}
    }
    window.__ATLAS_ENTITY360_STATE_BRIDGE__={
      active:true,patch:PATCH,entityId:id||null,reason,
      canonicalView:s?.view||null,
      compatibilityMirrored:!!legacy&&legacy!==s,
      updatedAt:new Date().toISOString()
    };
    return id;
  }

  function historyApi(){
    const api=window.__ATLAS_ENTITY360_EXECUTIVE__;
    return api?.active&&api?.variant===VARIANT&&typeof api.open==='function'?api:null;
  }

  function currentHistoryHost(id=null){
    const host=document.querySelector('#atlas-entity360-executive');
    if(!host||host.dataset?.e360Variant!==VARIANT)return null;
    if(id&&String(host.dataset?.entityId||'')!==String(id))return null;
    return host;
  }

  async function healHistory(entityId=null,reason='heal'){
    const id=syncCompatibility(entityId||canonicalEntityId(),reason);
    if(!id)return false;
    if(currentHistoryHost(id))return true;
    const api=historyApi();
    if(!api)return false;
    try{
      await api.open(String(id),{entity_id:String(id),source:`${PATCH}:${reason}`});
      return !!currentHistoryHost(id);
    }catch(_error){return false;}
  }

  function installEntryBridge(){
    const entry=window.__ATLAS_ENTITY_ENTRY__;
    if(!entry||typeof entry.open!=='function')return false;
    if(entry.open.__atlasCanonicalStateBridge===PATCH)return true;
    const base=entry.open;
    const wrapped=async function atlasEntity360CanonicalStateBridge(entityId,meta,...rest){
      const id=entityId||meta?.entity_id||canonicalEntityId();
      syncCompatibility(id,'entry-open-before');
      const result=await base.apply(this,[entityId,meta,...rest]);
      syncCompatibility(id||canonicalEntityId(),'entry-open-after');
      if(id&&!currentHistoryHost(id))await healHistory(id,'entry-open-settle');
      return result;
    };
    wrapped.__atlasCanonicalStateBridge=PATCH;
    wrapped.__atlasCanonicalStateBase=base;
    entry.open=wrapped;
    return true;
  }

  /* v0447 captures ENTRY.open when it boots. This file is compiled immediately
     after Historia Inteligente and before v0447, so install the bridge now. */
  installEntryBridge();

  const svg=(name)=>{
    const common='viewBox="0 0 24 24" aria-hidden="true" focusable="false"';
    const p={
      building:`<svg ${common}><path d="M4 21V8.5L12 4l8 4.5V21M8 21v-4h8v4M8 10h2m4 0h2M8 13.5h2m4 0h2"/></svg>`,
      user:`<svg ${common}><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8c.8-4 3.1-6 7-6s6.2 2 7 6"/></svg>`,
      star:`<svg ${common}><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.4l6.1-.9L12 3Z"/></svg>`,
      trend:`<svg ${common}><path d="M4 17 9 12l3.5 3.5L20 8m-5 0h5v5"/></svg>`,
      constitution:`<svg ${common}><path d="M5 20V8l7-4 7 4v12M8 11h2m4 0h2M8 14h2m4 0h2M9 20v-3h6v3"/></svg>`,
      start:`<svg ${common}><path d="M8 5.5 18 12 8 18.5v-13Z"/></svg>`,
      tax:`<svg ${common}><path d="M5 18 10 13l3 3 6-7m-5 0h5v5"/></svg>`,
      uaf:`<svg ${common}><path d="M12 3 19 6v5c0 4.6-2.5 7.8-7 10-4.5-2.2-7-5.4-7-10V6l7-3Z"/><path d="m9.5 12 1.7 1.7 3.6-4"/></svg>`,
      sanctions:`<svg ${common}><path d="M12 4v10m0 4v2M5 8h14M7 8l-3 6h6L7 8Zm10 0-3 6h6l-3-6Z"/></svg>`,
      spend:`<svg ${common}><path d="M5 8h14l-1 11H6L5 8Zm2 0 1-3h8l1 3M9 12h6"/></svg>`,
      relations:`<svg ${common}><circle cx="12" cy="5" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M10.8 7 7.2 15.7M13.2 7l3.6 8.7M8.5 18h7"/></svg>`,
      document:`<svg ${common}><path d="M7 3h7l4 4v14H7V3Zm7 0v5h5M10 12h5m-5 4h5"/></svg>`,
      compare:`<svg ${common}><path d="M5 7h11m0 0-3-3m3 3-3 3M19 17H8m0 0 3-3m-3 3 3 3"/></svg>`,
      pin:`<svg ${common}><path d="M12 21s6-5.3 6-11a6 6 0 1 0-12 0c0 5.7 6 11 6 11Z"/><circle cx="12" cy="10" r="2"/></svg>`,
      calendar:`<svg ${common}><path d="M6 3v3m12-3v3M4 8h16v12H4V8Zm0 4h16"/></svg>`,
      workers:`<svg ${common}><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.7-3.5 2.5-5.2 5.5-5.2s4.8 1.7 5.5 5.2M16 7a2.5 2.5 0 0 1 0 5m1 2c2 .5 3.1 2.2 3.5 5"/></svg>`,
      sales:`<svg ${common}><path d="M4 19V9m5 10V5m5 14v-7m5 7V3"/></svg>`,
      arrow:`<svg ${common}><path d="M7 17 17 7m-7 0h7v7"/></svg>`
    };
    return p[name]||p.star;
  };

  const setIcon=(node,name)=>{if(node)node.innerHTML=svg(name);};

  function polishCharacterRows(host){
    const iconByLabel={'Actividad económica':'building','Otras actividades':'building','Tramo de ventas':'sales','Ventas anuales (UF)':'sales','Trabajadores':'workers','Región':'pin','Comuna':'pin','Inicio actividades':'calendar','Término de giro':'calendar'};
    host.querySelectorAll('.eh-character-row').forEach(row=>{
      if(row.querySelector('.eh-row-icon'))return;
      const label=(row.querySelector('span')?.textContent||'').trim();
      const icon=document.createElement('i');icon.className='eh-row-icon';icon.innerHTML=svg(iconByLabel[label]||'document');row.prepend(icon);
    });
  }

  function polishSectionHeaders(host){
    [['.eh-san','sanctions'],['.eh-res','building'],['.eh-spend','spend'],['.eh-docs','document'],['.eh-compare','compare']].forEach(([selector,name])=>{
      const card=host.querySelector(selector),box=card?.querySelector(':scope > header');
      if(!box||box.querySelector('.eh-section-icon'))return;
      const i=document.createElement('i');i.className='eh-section-icon';i.innerHTML=svg(name);box.prepend(i);
    });
  }

  function polishTimeline(host){
    const kindIcons={constitution:'constitution',start:'start',tax:'tax',uaf:'uaf',sanctions:'sanctions',spend:'spend',relations:'relations'};
    host.querySelectorAll('.eh-event').forEach(event=>{
      const kind=Object.keys(kindIcons).find(k=>event.classList.contains(k));
      setIcon(event.querySelector('.eh-event-icon'),kindIcons[kind]||'star');
    });
    host.querySelectorAll('.eh-insight').forEach((card,index)=>setIcon(card.querySelector('.eh-insight-icon'),['user','star','trend'][index]||'star'));
    setIcon(host.querySelector('.eh-entity-icon'),'building');
  }

  function polishSanctionBars(host){
    const cells=[...host.querySelectorAll('.eh-san-bars > div')];
    const values=cells.map(c=>Number((c.querySelector('b')?.textContent||'').replace(/[^0-9,.-]/g,'').replace(',','.'))||0);
    const max=Math.max(1,...values);
    cells.forEach((cell,i)=>cell.style.setProperty('--eh-meter',`${Math.max(6,Math.round(values[i]/max*100))}%`));
  }

  function countryCompare(host){
    const tab=host.querySelector('[data-eh-compare="territory"]');if(!tab)return;
    tab.textContent='País';tab.setAttribute('aria-label','Comparar con País');
    if(tab.__atlasCountryBound)return;
    tab.__atlasCountryBound=true;
    tab.addEventListener('click',event=>{
      event.stopImmediatePropagation();
      host.querySelectorAll('[data-eh-compare]').forEach(b=>b.classList.toggle('active',b===tab));
      const body=host.querySelector('[data-eh-compare-body]');if(!body)return;
      body.dataset.mode='country';
      body.innerHTML='<div><span>País</span><b>Chile</b><small>Referencia nacional</small></div><p>Referencia nacional de pares no materializada en Entidad 360. ATLAS no estima un benchmark sin una base gobernada.</p>';
    },true);
  }

  function polishButtons(host){
    host.querySelectorAll('.eh-secondary').forEach(btn=>{
      const arrow=btn.querySelector('span');if(arrow){arrow.classList.add('eh-button-arrow');arrow.innerHTML=svg('arrow');}
    });
  }

  function retireLegacyActions(host){
    host.querySelectorAll('[data-e360-lens],[data-e360-go="e360-advanced"],#e360-advanced').forEach(node=>node.remove());
    const root=host.closest('.a45');
    if(root){root.classList.remove('e360-advanced-open');root.querySelector(':scope > .e360-advanced-returnbar')?.remove();}
  }

  function apply(){
    installEntryBridge();
    const id=canonicalEntityId();
    if(id)syncCompatibility(id,'polish-apply');
    const host=document.querySelector('#atlas-entity360-executive.e360-history-host');
    if(!host){if(id)queueMicrotask(()=>void healHistory(id,'polish-missing-host'));return false;}
    host.dataset.e360Polish=BUILD;
    retireLegacyActions(host);
    polishTimeline(host);polishCharacterRows(host);polishSectionHeaders(host);polishSanctionBars(host);countryCompare(host);polishButtons(host);
    return true;
  }

  let queued=false,healQueued=false;
  const schedule=()=>{
    if(queued)return;queued=true;
    requestAnimationFrame(()=>{queued=false;apply();});
  };
  const scheduleHeal=(reason='mutation')=>{
    if(healQueued)return;healQueued=true;
    queueMicrotask(async()=>{healQueued=false;installEntryBridge();const id=canonicalEntityId();if(id&&!currentHistoryHost(id))await healHistory(id,reason);schedule();});
  };

  const observer=new MutationObserver(()=>scheduleHeal('dom-mutation'));
  observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('atlas:entity-workspace-ready',()=>scheduleHeal('workspace-ready'));
  document.addEventListener('atlas:entity-entry-ready',()=>scheduleHeal('entry-ready'));
  window.addEventListener('load',()=>scheduleHeal('window-load'),{once:true});
  [0,80,220,600,1400,3000].forEach(ms=>setTimeout(()=>scheduleHeal('startup'),ms));

  window.__ATLAS_ENTITY360_POLISH__={
    active:true,build:BUILD,patch:PATCH,
    authority:'ENTITY360_PROPOSAL3_POLISH_ATLAS+CANONICAL_STATE_BRIDGE',
    canonicalStateFirst:true,compatibilityStateMirrored:true,
    apply,heal:healHistory,sync:syncCompatibility,installedAt:new Date().toISOString()
  };
})();
