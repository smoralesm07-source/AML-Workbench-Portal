'use strict';

/* ATLAS AML · Entidad 360 retired compatibility marker + loading bridge · 2026-09-04
 *
 * The former force authority dynamically reloaded an older Executive 360 build
 * and maintained a permanent DOM observer/poller. That behavior remains retired.
 *
 * This late compatibility asset now has one presentation-only responsibility:
 * while an analyst opens Entidad 360, show the same ATLAS/Entidades loading
 * treatment until the current Historia Inteligente authority reports a hydrated
 * dossier. This prevents the initial null package from looking like a genuine
 * "sin información" result while SII, UAF, sanciones, RES, compras públicas and
 * the historical series are still being resolved.
 *
 * No Auth, Supabase, RLS, scoring, joins or analytical semantics are modified.
 */
(function retireAtlasEntity360ForceAuthority(){
  const LOADER_ID='atlas-entity360-loading';
  const STYLE_ID='atlas-entity360-loading-style';
  const HISTORY_VARIANT='HISTORY_INTELLIGENCE_ATLAS_V1';
  const BUILD='20260904-e360-loading1';
  let readinessObserver=null;
  let readinessTimer=null;
  let slowTimer=null;

  function now(){return new Date().toISOString();}

  function content(){
    try{if(typeof v019Content==='function')return v019Content();}catch(_error){}
    return document.querySelector('#content');
  }

  function ensureStyle(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      #${LOADER_ID}{position:fixed;z-index:96;left:224px;right:0;top:54px;bottom:0;display:grid;place-items:center;padding:24px;background:rgba(7,17,29,.86);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)}
      #${LOADER_ID}[hidden]{display:none!important}
      #${LOADER_ID} .e360-loading-card{width:min(430px,calc(100vw - 44px));display:flex;flex-direction:column;align-items:center;text-align:center;padding:30px 28px 27px;border:1px solid var(--atlas-line,#1e3247);border-radius:16px;background:linear-gradient(180deg,var(--atlas-panel,#0c1725),var(--atlas-side,#08111c));box-shadow:0 24px 64px rgba(0,0,0,.34)}
      #${LOADER_ID} .aex-blank-icon.e360-loading-icon{position:relative;width:54px;height:54px;margin:0 0 16px;display:grid;place-items:center;border-radius:15px;color:transparent}
      #${LOADER_ID} .e360-loading-spinner{width:25px;height:25px;border:2px solid var(--atlas-line,#26384b);border-top-color:var(--atlas-accent-hi,#5bb4f5);border-right-color:var(--atlas-accent,#3b98e0);border-radius:50%;animation:atlasE360LoadingSpin .72s linear infinite}
      #${LOADER_ID} .e360-loading-eyebrow{font-size:9px;letter-spacing:.16em;text-transform:uppercase;font-weight:800;color:var(--atlas-faint,#5b7188)}
      #${LOADER_ID} h3{margin:7px 0 6px;color:var(--atlas-ink,#e6eef7);font-size:17px;font-weight:680}
      #${LOADER_ID} p{margin:0;max-width:370px;color:var(--atlas-muted,#8397ad);font-size:11.5px;line-height:1.55}
      #${LOADER_ID} .e360-loading-sources{display:flex;flex-wrap:wrap;justify-content:center;gap:5px;margin-top:15px}
      #${LOADER_ID} .e360-loading-sources span{border:1px solid var(--atlas-line,#1e3247);border-radius:999px;padding:4px 7px;background:var(--atlas-panel-lift,#122234);color:var(--atlas-ink2,#b3c4d5);font-size:8.5px;font-weight:700}
      #${LOADER_ID}.slow p:after{content:' La carga está tomando más tiempo de lo habitual.';color:var(--atlas-warn,#dcb445)}
      @keyframes atlasE360LoadingSpin{to{transform:rotate(360deg)}}
      @media(max-width:900px){#${LOADER_ID}{left:0}}
      @media(prefers-reduced-motion:reduce){#${LOADER_ID} .e360-loading-spinner{animation-duration:1.8s}}
    `;
    document.head.appendChild(style);
  }

  function loaderNode(){return document.getElementById(LOADER_ID);}

  function isHistoryHydrated(entityId=null){
    const host=document.querySelector('#atlas-entity360-executive');
    const state=window.__ATLAS_ENTITY360_EXECUTIVE_STATE__||{};
    if(!host||state.variant!==HISTORY_VARIANT||state.hydrated!==true)return false;
    if(entityId&&String(state.entityId||host.dataset?.entityId||'')!==String(entityId))return false;
    return true;
  }

  function stopReadinessWatch(){
    if(readinessObserver){try{readinessObserver.disconnect();}catch(_error){}readinessObserver=null;}
    if(readinessTimer){clearTimeout(readinessTimer);readinessTimer=null;}
    if(slowTimer){clearTimeout(slowTimer);slowTimer=null;}
  }

  function hideLoading(reason='hydrated'){
    stopReadinessWatch();
    const node=loaderNode();
    if(node)node.remove();
    const c=content();
    if(c)c.removeAttribute('aria-busy');
    window.__ATLAS_ENTITY360_LOADING__={active:false,reason,build:BUILD,endedAt:now()};
  }

  function watchReadiness(entityId=null){
    stopReadinessWatch();
    const check=()=>{
      if(isHistoryHydrated(entityId)){hideLoading('history-hydrated');return true;}
      return false;
    };
    if(check())return;
    const app=document.querySelector('#app')||document.body;
    readinessObserver=new MutationObserver(()=>{check();});
    readinessObserver.observe(app,{childList:true,subtree:true,attributes:true});
    slowTimer=setTimeout(()=>loaderNode()?.classList.add('slow'),5500);
    readinessTimer=setTimeout(()=>{
      /* Never keep the analyst trapped behind a loader. If the current history
         authority has not hydrated within the guard window, release the UI and
         let its normal error/partial-state semantics take over. */
      hideLoading('readiness-timeout');
    },20000);
  }

  function showLoading(entityId=null,label='Cargando Entidad 360'){
    ensureStyle();
    let node=loaderNode();
    if(!node){
      node=document.createElement('section');
      node.id=LOADER_ID;
      node.setAttribute('role','status');
      node.setAttribute('aria-live','polite');
      node.innerHTML=`<div class="e360-loading-card aex-state">
        <div class="aex-blank-icon e360-loading-icon" aria-hidden="true"><span class="e360-loading-spinner"></span></div>
        <span class="e360-loading-eyebrow">ENTIDAD 360</span>
        <h3>${label}</h3>
        <p>Integrando antecedentes disponibles antes de mostrar la ficha. Un vacío durante esta etapa no se interpreta como ausencia de información.</p>
        <div class="e360-loading-sources" aria-hidden="true"><span>SII</span><span>UAF</span><span>Sanciones</span><span>RES</span><span>Compras públicas</span><span>Historia</span></div>
      </div>`;
      document.body.appendChild(node);
    }
    node.classList.remove('slow');
    const title=node.querySelector('h3');if(title)title.textContent=label;
    const c=content();if(c)c.setAttribute('aria-busy','true');
    window.__ATLAS_ENTITY360_LOADING__={active:true,entityId:entityId||null,build:BUILD,startedAt:now()};
    watchReadiness(entityId);
    return node;
  }

  function idFromTrigger(trigger){
    return trigger?.dataset?.aexOpen||trigger?.dataset?.entityId||trigger?.dataset?.aexSuggestId||null;
  }

  function installClickBridge(){
    if(window.__ATLAS_ENTITY360_LOADING_CLICK_BRIDGE__)return;
    document.addEventListener('click',event=>{
      const trigger=event.target?.closest?.('[data-aex-open],#aex-sheet-open,.a47-suggestion,[data-open-entity360]');
      if(!trigger)return;
      showLoading(idFromTrigger(trigger));
    },true);
    window.__ATLAS_ENTITY360_LOADING_CLICK_BRIDGE__={active:true,build:BUILD,installedAt:now()};
  }

  function installEntryBridge(){
    const entry=window.__ATLAS_ENTITY_ENTRY__;
    if(!entry||typeof entry.open!=='function'||entry.open.__atlasE360LoadingBridge)return false;
    const base=entry.open;
    const wrapped=async function atlasEntity360OpenWithLoading(entityId,...rest){
      showLoading(entityId||null);
      try{
        const result=await base.apply(this,[entityId,...rest]);
        if(isHistoryHydrated(entityId))hideLoading('entry-open-complete');
        return result;
      }catch(error){
        hideLoading('entry-open-error');
        throw error;
      }
    };
    wrapped.__atlasE360LoadingBridge=true;
    wrapped.__atlasE360LoadingBase=base;
    entry.open=wrapped;
    try{window.openEntity=wrapped;}catch(_error){}
    return true;
  }

  installClickBridge();
  installEntryBridge();
  document.addEventListener('atlas:entity-workspace-ready',()=>installEntryBridge());
  document.addEventListener('atlas:entity-entry-ready',()=>installEntryBridge());

  window.__ATLAS_ENTITY360_FORCE_AUTHORITY__={
    active:false,
    retired:true,
    replacement:'ENTITY360_HISTORY_INTELLIGENCE',
    presentationBridge:'ENTITY360_LOADING_UNTIL_HISTORY_HYDRATED',
    policy:'SINGLE_COMPILED_AUTHORITY_NO_LATE_RELOAD',
    build:BUILD,
    retiredAt:now()
  };
  window.__ATLAS_ENTITY360_LOADING_API__={show:showLoading,hide:hideLoading,isHydrated:isHistoryHydrated,build:BUILD};
})();