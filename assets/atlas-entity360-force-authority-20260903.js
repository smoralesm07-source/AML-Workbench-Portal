'use strict';

/* ATLAS AML · Entidad 360 · final production authority · 2026-09-03
 * Purpose: guarantee the renovated 360 after the canonical 0.44.7 workspace
 * paints an entity. The canonical workspace calls a lexical openWorkspace()
 * and can bypass late ENTRY.open wrappers, so this authority observes the
 * actual entity identity/state and reconciles the final DOM directly.
 * Read-only. No identity inference: entity_id comes only from governed state
 * or the canonical dossier DOM already rendered by ATLAS.
 */
(function atlasEntity360ForceAuthority20260903(){
  const FLAG='__ATLAS_ENTITY360_FORCE_AUTHORITY__';
  const BUILD='20260903-e360-force1';
  const MODULE_BUILD='20260903-e360-3';
  const EXEC_JS='./assets/atlas-entity360-executive-20260903.js?v=20260903-force1';
  const EXEC_CSS='./assets/atlas-entity360-executive-20260903.css?v=20260903-force1';
  const FORCE_CSS='./assets/atlas-entity360-force-authority-20260903.css?v=20260903-force1';
  if(window[FLAG]?.build===BUILD)return;

  let observer=null;
  let timer=null;
  let loading=false;
  let inflight=false;
  let lastEntity='';
  let lastRenderStamp='';

  const now=()=>new Date().toISOString();

  function stateEntity(){
    try{if(typeof state!=='undefined'&&state?.selectedEntity)return String(state.selectedEntity);}catch(_e){}
    if(window.state?.selectedEntity)return String(window.state.selectedEntity);
    const current=window.__ATLAS_ENTITY360_CURRENT__;
    if(current?.entityId)return String(current.entityId);
    if(current?.selectedEntity)return String(current.selectedEntity);
    const exec=window.__ATLAS_ENTITY360_EXECUTIVE_STATE__;
    if(exec?.entityId)return String(exec.entityId);
    const selected=document.querySelector('#a47-selected small')?.textContent||'';
    const selectedMatch=selected.match(/\bENT-[A-Z0-9-]{3,}\b/i);
    if(selectedMatch)return selectedMatch[0];
    const canonical=document.querySelector('#content .a45-identity code')?.textContent||'';
    const canonicalMatch=canonical.match(/\bENT-[A-Z0-9-]{3,}\b/i);
    if(canonicalMatch)return canonicalMatch[0];
    const attributed=document.querySelector('#content [data-entity-id]')?.getAttribute('data-entity-id');
    return attributed?String(attributed):'';
  }

  function entityRoute(){
    try{if(typeof state!=='undefined'&&['entities','entity','entity360'].includes(String(state?.view||'')))return true;}catch(_e){}
    if(['entities','entity','entity360'].includes(String(window.state?.view||'')))return true;
    const current=window.__ATLAS_ENTITY360_CURRENT__;
    if(current?.entityId)return true;
    return !!document.querySelector('#a47-entity-search-host, #content .a45-identity, #content .v0203-entity, #content .v038-entity');
  }

  function ensureLink(href,key){
    if(document.querySelector(`link[data-${key}]`))return;
    const link=document.createElement('link');
    link.rel='stylesheet';link.href=href;link.setAttribute(`data-${key}`,'1');
    document.head.appendChild(link);
  }

  function ensureAssets(){
    ensureLink(EXEC_CSS,'atlas-e360-force-exec-css');
    ensureLink(FORCE_CSS,'atlas-e360-force-css');
    const api=window.__ATLAS_ENTITY360_EXECUTIVE__;
    if(api?.active&&api.build===MODULE_BUILD)return true;
    if(loading||document.querySelector('script[data-atlas-e360-force-exec-js]'))return false;
    loading=true;
    const script=document.createElement('script');
    script.src=EXEC_JS;script.async=false;script.setAttribute('data-atlas-e360-force-exec-js','1');
    script.onload=()=>{loading=false;schedule('executive-loaded',0);};
    script.onerror=()=>{loading=false;window[FLAG]={...window[FLAG],error:'executive-asset-load-failed',failedAt:now()};};
    document.body.appendChild(script);
    return false;
  }

  function rootForEntity(){
    return document.querySelector('#content .a45')||document.querySelector('#content .aed-dossier')||document.querySelector('#content .v0203-entity')||document.querySelector('#content .v038-entity')||document.querySelector('#content');
  }

  function ensurePlaceholder(entityId){
    const root=rootForEntity();if(!root||!entityId)return null;
    root.classList.add('e360-modern');
    let host=root.querySelector(':scope > #atlas-entity360-executive');
    if(!host){
      host=document.createElement('section');
      host.id='atlas-entity360-executive';host.className='e360-executive e360-force-placeholder';
      host.innerHTML=`<div class="e360-force-loading"><span class="e360-force-badge">360 NUEVO · PRODUCCIÓN</span><div><b>Entidad 360 renovada</b><small>Cargando perfil tributario, UAF, sanciones, RES y compras públicas…</small></div></div>`;
      root.insertBefore(host,root.firstChild);
    }
    host.dataset.e360ForceAuthority=BUILD;
    host.dataset.entityId=entityId;
    return host;
  }

  function markProduction(entityId){
    const root=rootForEntity();const host=document.querySelector('#atlas-entity360-executive');
    if(root)root.classList.add('e360-modern');
    if(!host)return;
    host.dataset.e360ForceAuthority=BUILD;host.dataset.entityId=entityId;
    let badge=host.querySelector('.e360-force-production-badge');
    if(!badge){
      badge=document.createElement('span');badge.className='e360-force-production-badge';badge.textContent='360 NUEVO · PRODUCCIÓN';
      const target=host.querySelector('.e360-head-side')||host.querySelector('.e360-head')||host;
      target.insertBefore(badge,target.firstChild);
    }
  }

  function ensureAdvancedReturn(root){
    if(!root||root.querySelector(':scope > .e360-advanced-returnbar'))return;
    const main=root.querySelector(':scope > main');if(!main)return;
    const bar=document.createElement('div');bar.className='e360-advanced-returnbar';
    bar.innerHTML='<button type="button" data-e360-return-summary>← Volver al resumen 360</button><span>Análisis avanzado del expediente</span>';
    root.insertBefore(bar,main);
  }

  function openAdvanced(button){
    const root=rootForEntity();if(!root)return;
    root.classList.add('e360-advanced-open');ensureAdvancedReturn(root);
    const key=button?.dataset?.e360Lens;
    setTimeout(()=>{
      if(key)root.querySelector(`[data-a45-panel="${key}"]`)?.scrollIntoView({behavior:'smooth',block:'start'});
    },50);
  }

  async function reconcile(reason='poll'){
    if(inflight||!entityRoute())return;
    const entityId=stateEntity();if(!entityId)return;
    ensureAssets();ensurePlaceholder(entityId);
    const api=window.__ATLAS_ENTITY360_EXECUTIVE__;
    if(!api?.active||api.build!==MODULE_BUILD){
      window[FLAG]={active:true,build:BUILD,moduleBuildRequired:MODULE_BUILD,entityId,waitingForExecutive:true,lastReason:reason,checkedAt:now()};
      return;
    }
    const current=window.__ATLAS_ENTITY360_EXECUTIVE_STATE__;
    const host=document.querySelector('#atlas-entity360-executive');
    const correct=host&&String(current?.entityId||host.dataset.entityId||'')===entityId&&current?.build===MODULE_BUILD&&!host.classList.contains('e360-force-placeholder');
    if(correct){markProduction(entityId);window[FLAG]={active:true,build:BUILD,moduleBuild:MODULE_BUILD,entityId,present:true,hydrated:!!current?.hydrated,lastReason:reason,checkedAt:now()};return;}
    inflight=true;
    try{
      if(entityId!==lastEntity){rootForEntity()?.classList.remove('e360-advanced-open');lastEntity=entityId;}
      await api.open(entityId,{entity_id:entityId});
      markProduction(entityId);
      const finalState=window.__ATLAS_ENTITY360_EXECUTIVE_STATE__;
      window[FLAG]={active:true,build:BUILD,moduleBuild:MODULE_BUILD,entityId,present:!!document.querySelector('#atlas-entity360-executive'),hydrated:!!finalState?.hydrated,lastReason:reason,mountedAt:now()};
    }catch(error){
      window[FLAG]={active:true,build:BUILD,moduleBuild:MODULE_BUILD,entityId,present:!!document.querySelector('#atlas-entity360-executive'),error:String(error?.message||error),lastReason:reason,failedAt:now()};
    }finally{inflight=false;}
  }

  function schedule(reason='mutation',delay=40){clearTimeout(timer);timer=setTimeout(()=>void reconcile(reason),delay);}

  function install(){
    ensureAssets();
    const app=document.querySelector('#app');
    if(!app){setTimeout(install,100);return;}
    if(!observer){observer=new MutationObserver(()=>schedule('dom-mutation'));observer.observe(app,{childList:true,subtree:true});}
    document.addEventListener('click',event=>{
      const advanced=event.target.closest?.('[data-e360-lens]');if(advanced)openAdvanced(advanced);
      const back=event.target.closest?.('[data-e360-return-summary]');if(back){const root=rootForEntity();root?.classList.remove('e360-advanced-open');document.querySelector('#atlas-entity360-executive')?.scrollIntoView({behavior:'smooth',block:'start'});}
    },true);
    window[FLAG]={active:true,build:BUILD,moduleBuildRequired:MODULE_BUILD,observer:true,installedAt:now()};
    [0,60,180,450,1000,2500,5000].forEach(ms=>setTimeout(()=>schedule(`startup-${ms}`,0),ms));
    setInterval(()=>{
      const stamp=String(window.__ATLAS_ENTITY360_CURRENT__?.renderedAt||'');
      const id=stateEntity();
      if(id!==lastEntity||stamp!==lastRenderStamp||!document.querySelector('#atlas-entity360-executive')){lastRenderStamp=stamp;schedule('state-poll',0);}
      else if(entityRoute())markProduction(id);
    },250);
  }

  install();
  document.addEventListener('atlas:entity-workspace-ready',()=>schedule('workspace-ready',0));
  document.addEventListener('atlas:entity-entry-ready',()=>schedule('entry-ready',0));
  window.addEventListener('load',()=>schedule('window-load',0),{once:true});
})();
