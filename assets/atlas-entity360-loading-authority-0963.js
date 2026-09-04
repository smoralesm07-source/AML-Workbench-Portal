'use strict';
/* ATLAS AML · Entidad 360 · loading/materialization authority 0.96.3
 * Evita mostrar datos de la entidad anterior mientras se procesa una nueva selección.
 * Refuerza, al hidratarse la ficha, la decoración gobernada de Volver / drill-down / ventas UF.
 */
(function atlasEntity360LoadingAuthority0963(){
  const BUILD='0963-e360-loading-1';
  if(window.__ATLAS_ENTITY360_LOADING_0963__?.build===BUILD)return;

  let seq=0,installTimer=null,installAttempts=0,observer=null;
  const STYLE_ID='atlas-e360-loading-0963-style';

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const stateNow=()=>{try{return typeof state!=='undefined'?state:(window.state||window.amlState||null);}catch(_e){return window.state||window.amlState||null;}};
  const selectedId=()=>String(stateNow()?.selectedEntityId||stateNow()?.selectedEntity||window.__ATLAS_ENTITY360_CURRENT__?.entityId||'');
  const contentHost=()=>document.querySelector('#content')||document.querySelector('#app')||document.body;
  const profileHost=()=>document.querySelector('#atlas-entity360-executive');

  function ensureStyle(){
    if(document.getElementById(STYLE_ID))return;
    const s=document.createElement('style');
    s.id=STYLE_ID;
    s.textContent=`
      [data-e360-loading-host="1"]{position:relative!important;}
      .atlas-e360-loading-0963{position:absolute;inset:0;z-index:2140;min-height:64vh;display:flex;align-items:center;justify-content:center;padding:32px;background:linear-gradient(180deg,rgba(9,16,27,.985),rgba(10,18,30,.97));backdrop-filter:blur(3px);}
      .atlas-e360-loading-card{width:min(520px,calc(100vw - 48px));display:flex;flex-direction:column;align-items:center;text-align:center;gap:13px;padding:34px 30px;border:1px solid rgba(255,255,255,.10);border-radius:20px;background:rgba(18,28,43,.92);box-shadow:0 24px 70px rgba(0,0,0,.34);}
      .atlas-e360-loading-mark{position:relative;width:58px;height:58px;display:grid;place-items:center;}
      .atlas-e360-loading-ring{position:absolute;inset:0;border-radius:50%;border:3px solid rgba(255,255,255,.10);border-top-color:#f59e0b;border-right-color:rgba(245,158,11,.55);animation:atlasE360Spin0963 .82s linear infinite;}
      .atlas-e360-loading-core{width:22px;height:22px;border-radius:8px;background:#f59e0b;box-shadow:0 0 0 8px rgba(245,158,11,.10);animation:atlasE360Pulse0963 1.2s ease-in-out infinite;}
      .atlas-e360-loading-kicker{font-size:11px;letter-spacing:.16em;font-weight:800;color:#fbbf24;text-transform:uppercase;}
      .atlas-e360-loading-card h3{margin:0;font-size:21px;line-height:1.18;color:#f8fafc;}
      .atlas-e360-loading-card p{margin:0;max-width:420px;color:#aebbd0;font-size:13px;line-height:1.55;}
      .atlas-e360-loading-entity{margin-top:2px;padding:7px 11px;border-radius:999px;background:rgba(255,255,255,.055);color:#dce7f5;font-size:12px;font-weight:700;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .atlas-e360-loading-steps{display:flex;align-items:center;gap:6px;margin-top:4px;}
      .atlas-e360-loading-steps i{width:6px;height:6px;border-radius:50%;background:#64748b;animation:atlasE360Dot0963 1.05s ease-in-out infinite;}
      .atlas-e360-loading-steps i:nth-child(2){animation-delay:.14s}.atlas-e360-loading-steps i:nth-child(3){animation-delay:.28s}
      @keyframes atlasE360Spin0963{to{transform:rotate(360deg)}}
      @keyframes atlasE360Pulse0963{0%,100%{transform:scale(.9);opacity:.72}50%{transform:scale(1.08);opacity:1}}
      @keyframes atlasE360Dot0963{0%,100%{transform:translateY(0);opacity:.45}50%{transform:translateY(-4px);opacity:1;background:#f59e0b}}
      @media (prefers-reduced-motion:reduce){.atlas-e360-loading-ring,.atlas-e360-loading-core,.atlas-e360-loading-steps i{animation:none!important}}
    `;
    document.head.appendChild(s);
  }

  function loadingOverlay(){return document.querySelector('[data-atlas-e360-loading="0963"]');}

  function hideLoading(token){
    if(token!=null&&token!==seq)return;
    const overlay=loadingOverlay();
    if(overlay)overlay.remove();
    const host=document.querySelector('[data-e360-loading-host="1"]');
    if(host)host.removeAttribute('data-e360-loading-host');
  }

  function entityLabel(id,meta){
    const name=meta?.name||meta?.legal_name||meta?.razon_social||meta?.label||'';
    const rut=meta?.rut||meta?.tax_id||'';
    return [name,rut].filter(Boolean).join(' · ')||(`ID ${id}`);
  }

  function showLoading(id,meta={}){
    ensureStyle();
    const token=++seq;
    try{window.AtlasEntity360Drilldown?.close?.();}catch(_e){}
    const host=contentHost();
    if(!host)return token;
    host.setAttribute('data-e360-loading-host','1');
    let overlay=loadingOverlay();
    if(!overlay){overlay=document.createElement('div');overlay.className='atlas-e360-loading-0963';overlay.dataset.atlasE360Loading='0963';overlay.setAttribute('role','status');overlay.setAttribute('aria-live','polite');host.appendChild(overlay);}
    overlay.dataset.entityId=String(id||'');
    overlay.innerHTML=`<div class="atlas-e360-loading-card"><div class="atlas-e360-loading-mark" aria-hidden="true"><span class="atlas-e360-loading-ring"></span><span class="atlas-e360-loading-core"></span></div><span class="atlas-e360-loading-kicker">Entidad 360</span><h3>Procesando entidad seleccionada</h3><p>Consolidando identidad, situación tributaria, UAF, sanciones, RES y compras públicas. La ficha anterior se mantiene oculta hasta completar la nueva materialización.</p><div class="atlas-e360-loading-entity">${esc(entityLabel(id,meta))}</div><div class="atlas-e360-loading-steps" aria-hidden="true"><i></i><i></i><i></i></div></div>`;
    return token;
  }

  function isHydrated(id){
    const root=profileHost();
    if(!root)return false;
    const wanted=String(id||'');
    const rootId=String(root.dataset?.entityId||'');
    const active=selectedId();
    if(wanted&&rootId&&rootId!==wanted)return false;
    if(wanted&&active&&active!==wanted)return false;
    return !!root.querySelector('.eh-character,.eh-card,.eh-hero,.eh-grid');
  }

  function reinforceMaterializedProfile(){
    const root=profileHost();
    if(!root)return false;
    try{window.AtlasEntity360Drilldown?.decorate?.(root);}catch(error){console.warn('[ATLAS E360 0963] decorate',error);}
    return true;
  }

  function waitForHydration(id,token){
    const started=Date.now();
    const settle=()=>{
      if(token!==seq)return true;
      if(isHydrated(id)){
        reinforceMaterializedProfile();
        hideLoading(token);
        return true;
      }
      if(Date.now()-started>15000){hideLoading(token);return true;}
      return false;
    };
    if(settle())return;
    const root=contentHost();
    const mo=new MutationObserver(()=>{if(settle())mo.disconnect();});
    mo.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['data-entity-id','class']});
    setTimeout(()=>{mo.disconnect();settle();},15250);
  }

  function wrapEntry(){
    const entry=window.__ATLAS_ENTITY_ENTRY__;
    if(!entry||typeof entry.open!=='function')return false;
    if(entry.open.__atlasE360Loading0963)return true;
    const base=entry.open;
    const wrapped=async function(...args){
      const id=String(args[0]||'');
      const meta=args[1]&&typeof args[1]==='object'?args[1]:{};
      const token=showLoading(id,meta);
      try{
        const result=await base.apply(this,args);
        waitForHydration(id,token);
        return result;
      }catch(error){
        setTimeout(()=>hideLoading(token),350);
        throw error;
      }
    };
    Object.defineProperty(wrapped,'__atlasE360Loading0963',{value:true});
    Object.defineProperty(wrapped,'__atlasE360LoadingBase',{value:base});
    entry.open=wrapped;
    return true;
  }

  function install(){
    ensureStyle();
    wrapEntry();
    reinforceMaterializedProfile();
    if(!observer){
      const app=document.querySelector('#app')||document.body;
      observer=new MutationObserver(()=>{wrapEntry();if(profileHost())reinforceMaterializedProfile();});
      observer.observe(app,{childList:true,subtree:true});
    }
    if(!installTimer){
      installTimer=setInterval(()=>{
        installAttempts++;
        wrapEntry();
        if(profileHost())reinforceMaterializedProfile();
        if(installAttempts>=48){clearInterval(installTimer);installTimer=null;}
      },250);
    }
  }

  ['atlas:entity-entry-ready','atlas:entity-workspace-ready'].forEach(name=>document.addEventListener(name,()=>{wrapEntry();reinforceMaterializedProfile();}));
  window.addEventListener('pageshow',()=>{wrapEntry();reinforceMaterializedProfile();});

  const API={build:BUILD,show:showLoading,hide:hideLoading,wrap:wrapEntry,reinforce:reinforceMaterializedProfile};
  window.__ATLAS_ENTITY360_LOADING_0963__=API;
  window.AtlasEntity360Loading=API;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();