'use strict';
/* ATLAS AML · Entidad 360 · single-read resilient authority 0.96.4
 * Primary path: one governed RPC returning the complete executive dossier.
 * Fallback path: parallel source reads preserving the existing RLS semantics.
 * Empty source != loading/failure. The loader remains visible until completion.
 */
(function atlasEntity360Resilience0964(){
  const BUILD='0964-e360-single-read-5';
  const READ_RPC='atlas_v2_entity360_read';
  const MASTER='aml_entity_master_v0553';
  const TAX='aml_entity_tax_profile';
  const UAF='aml_uaf_entity_profile';
  const SAN='aml_v_ipa3_sanction_entity_summary';
  const SPEND='aml_v_public_spend_provider_intel_0720';
  const HISTORY='aml_sii_entity_year';
  const CACHE_TTL=5*60*1000;
  const READ_TIMEOUT=1400;
  const SOURCE_TIMEOUT=2800;
  const MASTER_TIMEOUT=1500;
  const HARD_LOADING_TIMEOUT=3200;
  if(window.__ATLAS_ENTITY360_RESILIENCE_0964__?.build===BUILD)return;

  const CACHE=new Map();
  let token=0,lastId='',observer=null,poll=null,activeJob=null,activeJobId='',loadingId='',loadingMeta=null;

  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_e){return window.sb||null;}};
  const appState=()=>{try{return window.amlState||(typeof state!=='undefined'?state:window.state)||null;}catch(_e){return window.amlState||window.state||null;}};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
  const rootHost=()=>document.querySelector('#content')||document.querySelector('#app')||document.body;
  const historyApi=()=>window.__ATLAS_ENTITY360_EXECUTIVE__;
  const profileHost=()=>document.querySelector('#atlas-entity360-executive');
  const inEntities=()=>{const v=String(appState()?.view||'').toLowerCase();return !v||['entities','entity','entity360'].includes(v)||document.body.classList.contains('view-entities');};

  function idValue(value){
    if(value&&typeof value==='object')return String(value.entity_id||value.entityId||value.id||'');
    return String(value||'');
  }
  function rutFromEntityId(value){
    const match=String(value||'').trim().toUpperCase().match(/^ENT-RUT-(\d+)-([0-9K])$/);
    return match?`${match[1]}-${match[2]}`:'';
  }
  function domSelection(){
    const node=document.querySelector('#a47-selected');
    if(!node)return {id:'',name:'',rut:''};
    const name=String(node.querySelector('b')?.textContent||'').trim();
    const small=String(node.querySelector('small')?.textContent||'').trim();
    const parts=small.split('·').map(x=>x.trim()).filter(Boolean);
    const rut=parts[0]&&!/RUT no materializado/i.test(parts[0])?parts[0]:'';
    const id=parts.length>1?parts[parts.length-1]:'';
    return {id,name,rut};
  }
  function selected(){
    const dom=domSelection();if(dom.id)return dom.id;
    const s=appState();
    return idValue(s?.selectedEntityId||s?.selectedEntity||window.__ATLAS_ENTITY360_CURRENT__?.entityId||window.__ATLAS_ENTITY360_CURRENT__?.selectedEntity||window.__ATLAS_ENTITY360_EXECUTIVE_STATE__?.entityId);
  }
  function metaFor(id,extra={}){
    const dom=domSelection();
    return {...(extra||{}),entity_id:id,name:extra?.name||extra?.legal_name||dom.name||id,rut:extra?.rut||dom.rut||rutFromEntityId(id)||null};
  }
  function rutVariants(value){
    const raw=String(value||'').trim().toUpperCase();if(!raw)return [];
    const clean=raw.replace(/[^0-9K]/g,'');if(clean.length<2)return [raw];
    const body=clean.slice(0,-1),dv=clean.slice(-1);
    return [...new Set([raw,`${body}-${dv}`,body.replace(/\B(?=(\d{3})+(?!\d))/g,'.')+`-${dv}`,clean])];
  }
  function friendlyError(label,kind){return `${label}: ${kind==='timeout'?'fuente sin respuesta dentro del tiempo de espera':'fuente no disponible en esta carga'}`;}
  function timed(label,queryFactory,ms){
    return new Promise(resolve=>{
      let settled=false;
      const finish=value=>{if(settled)return;settled=true;clearTimeout(timer);resolve(value);};
      const timer=setTimeout(()=>finish({data:null,error:friendlyError(label,'timeout'),timedOut:true}),ms);
      Promise.resolve().then(queryFactory).then(result=>{
        if(result?.error)finish({data:result.data??null,error:friendlyError(label,'error'),rawError:result.error});
        else finish({data:result?.data??null,error:null});
      }).catch(error=>finish({data:null,error:friendlyError(label,'error'),rawError:error}));
    });
  }
  function emptyPackage(id,meta){
    return {entityId:id,entity:{...(meta||{}),entity_id:id},master:null,tax:null,uaf:null,sanctions:null,spend:null,history:[],sourceStatus:{},errors:[],loadedAt:Date.now(),partial:true,readMode:'LOADING'};
  }

  function ensureStyle(){
    if(document.getElementById('atlas-e360-resilience-0964-style'))return;
    const style=document.createElement('style');style.id='atlas-e360-resilience-0964-style';
    style.textContent=`#content[data-e360-resilient-loading="1"]{position:relative!important;min-height:64vh}.atlas-e360-resilient-loader{position:absolute;inset:0;z-index:2900;display:grid;place-items:start center;min-height:60vh;padding:clamp(78px,12vh,132px) 20px 32px;background:rgba(6,15,25,.88);backdrop-filter:blur(2px)}.atlas-e360-resilient-loader-card{width:min(540px,calc(100vw - 32px));display:grid;grid-template-columns:54px 1fr;grid-template-areas:'spin tag' 'spin title' 'spin text' 'spin meta' 'sources sources';align-items:center;column-gap:16px;row-gap:5px;padding:20px;border:1px solid rgba(56,189,248,.25);border-radius:18px;background:rgba(14,26,40,.98);box-shadow:0 24px 80px rgba(0,0,0,.36)}.atlas-e360-resilient-spinner{grid-area:spin;width:46px;height:46px;border-radius:50%;border:3px solid rgba(148,163,184,.18);border-top-color:#38bdf8;border-right-color:#fbbf24;animation:atlasE360ResilientSpin .75s linear infinite}.atlas-e360-resilient-loader-card span{grid-area:tag;font-size:10px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:#7dd3fc}.atlas-e360-resilient-loader-card h3{grid-area:title;margin:0;color:#f8fafc;font-size:18px;line-height:1.2}.atlas-e360-resilient-loader-card p{grid-area:text;margin:0;color:#a8b7ca;font-size:13px;line-height:1.42}.atlas-e360-resilient-loader-card small{grid-area:meta;color:#d8e3ef;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.atlas-e360-resilient-sources{grid-area:sources;display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;padding-top:11px;border-top:1px solid rgba(148,163,184,.12)}.atlas-e360-resilient-sources i{font-style:normal;font-size:10px;font-weight:700;color:#8da3ba;padding:5px 8px;border-radius:999px;background:rgba(15,36,55,.8);border:1px solid rgba(148,163,184,.12)}@keyframes atlasE360ResilientSpin{to{transform:rotate(360deg)}}@media(max-width:560px){.atlas-e360-resilient-loader{padding-top:70px}.atlas-e360-resilient-loader-card{grid-template-columns:42px 1fr;padding:16px}.atlas-e360-resilient-spinner{width:38px;height:38px}.atlas-e360-resilient-loader-card h3{font-size:16px}}@media(prefers-reduced-motion:reduce){.atlas-e360-resilient-spinner{animation:none}}`;
    document.head.appendChild(style);
  }
  function showLoader(id,meta){
    ensureStyle();loadingId=String(id||'');loadingMeta=meta||loadingMeta;
    try{window.AtlasEntity360Loading?.hide?.();}catch(_e){}
    const root=rootHost();if(!root)return;root.setAttribute('data-e360-resilient-loading','1');
    let loader=document.querySelector('[data-atlas-e360-resilient-loader="0964"]');
    if(!loader){loader=document.createElement('div');loader.className='atlas-e360-resilient-loader';loader.dataset.atlasE360ResilientLoader='0964';loader.setAttribute('role','status');loader.setAttribute('aria-live','polite');root.appendChild(loader);}
    loader.dataset.entityId=id;
    loader.innerHTML=`<div class="atlas-e360-resilient-loader-card"><div class="atlas-e360-resilient-spinner" aria-hidden="true"></div><span>Entidad 360 · lectura consolidada</span><h3>Construyendo expediente ejecutivo</h3><p>ATLAS está solicitando una lectura única de identidad, SII, UAF, sanciones, compras públicas e historia. Los vacíos visibles debajo aún son preliminares.</p><small>${esc([meta?.name,meta?.rut].filter(Boolean).join(' · ')||id)}</small><div class="atlas-e360-resilient-sources"><i>1 solicitud</i><i>Identidad</i><i>SII</i><i>UAF</i><i>Sanciones</i><i>Compras</i><i>Historia</i></div></div>`;
  }
  function hideLoader(id){
    const sid=String(id||''),loader=document.querySelector('[data-atlas-e360-resilient-loader="0964"]');
    const matches=!id||loadingId===sid;
    if(loader&&(!id||loader.dataset.entityId===sid))loader.remove();
    if(matches){loadingId='';loadingMeta=null;rootHost()?.removeAttribute?.('data-e360-resilient-loading');try{window.AtlasEntity360Loading?.hide?.();}catch(_e){}}
  }
  function decorate(){const host=profileHost();if(host)try{window.AtlasEntity360Drilldown?.decorate?.(host);}catch(error){console.warn('[ATLAS E360] drilldown decorate',error);}}
  function mount(id,meta,data){
    const api=historyApi();if(!api||typeof api.mount!=='function')return false;
    if(!inEntities()||String(selected()||id)!==String(id))return false;
    api.mount(id,meta,data);decorate();if(loadingId===String(id))showLoader(id,loadingMeta||meta);return true;
  }
  function cacheAndMount(id,meta,data){data.loadedAt=Date.now();CACHE.set(id,data);mount(id,meta,data);}

  function fromEnvelope(id,meta,envelope){
    if(!envelope||envelope.contract!=='ATLAS_ENTITY360_READ_V2')return null;
    const master=envelope.identity||null;
    const entity={...(master||{}),...(meta||{}),entity_id:id,name:meta?.name||master?.name||master?.res_legal_name||id,rut:meta?.rut||envelope.resolved_rut||master?.rut||rutFromEntityId(id)||null};
    return {entityId:id,entity,master,tax:envelope.tax||null,uaf:envelope.uaf||null,sanctions:envelope.sanctions||null,spend:envelope.spend||null,history:Array.isArray(envelope.history)?envelope.history:[],sourceStatus:envelope.source_status||{},errors:[],loadedAt:Date.now(),partial:false,readMode:'SINGLE_READ_V2',generatedAt:envelope.generated_at||null};
  }

  async function fallbackParallel(id,meta,runToken,client){
    const data=emptyPackage(id,meta),initialRut=meta?.rut||rutFromEntityId(id)||'';
    const masterP=timed('Identidad',()=>client.from(MASTER).select('*').eq('entity_id',id).maybeSingle(),MASTER_TIMEOUT);
    const taxP=timed('SII',()=>client.from(TAX).select('*').eq('entity_id',id).maybeSingle(),SOURCE_TIMEOUT);
    const sanP=timed('Sanciones',()=>client.from(SAN).select('*').eq('entity_id',id).maybeSingle(),SOURCE_TIMEOUT);
    const spendP=timed('Compras públicas',()=>client.from(SPEND).select('*').eq('entity_id',id).limit(1).maybeSingle(),SOURCE_TIMEOUT);
    const historyP=timed('Historia SII',()=>client.from(HISTORY).select('*').eq('entity_id',id).order('commercial_year',{ascending:false}).limit(8),SOURCE_TIMEOUT);
    let uafP=initialRut?timed('UAF',()=>client.from(UAF).select('*').in('rut',rutVariants(initialRut)).limit(1).maybeSingle(),SOURCE_TIMEOUT):null;
    const master=await masterP;if(runToken!==token)return null;
    data.master=master.data||null;data.entity={...(data.master||{}),...(meta||{}),entity_id:id,name:meta?.name||data.master?.name||data.master?.res_legal_name||id,rut:initialRut||data.master?.rut||null};
    if(master.error)data.errors.push(master.error);cacheAndMount(id,data.entity,data);
    if(!uafP&&data.entity.rut)uafP=timed('UAF',()=>client.from(UAF).select('*').in('rut',rutVariants(data.entity.rut)).limit(1).maybeSingle(),SOURCE_TIMEOUT);
    if(!uafP)uafP=Promise.resolve({data:null,error:null});
    const results=await Promise.allSettled([taxP,sanP,spendP,historyP,uafP]);if(runToken!==token)return null;
    const names=['tax','sanctions','spend','history','uaf'];
    results.forEach((result,index)=>{const r=result.status==='fulfilled'?result.value:{data:null,error:friendlyError(names[index],'error')};if(index===0)data.tax=r.data||null;if(index===1)data.sanctions=r.data||null;if(index===2)data.spend=r.data||null;if(index===3)data.history=Array.isArray(r.data)?r.data:[];if(index===4)data.uaf=r.data||null;if(r.error)data.errors.push(r.error);});
    data.partial=data.errors.length>0;data.readMode='PARALLEL_FALLBACK';return data;
  }

  async function loadResilient(id,meta,runToken){
    const client=db(),started=performance.now();let scaffold=emptyPackage(id,meta);cacheAndMount(id,meta,scaffold);
    if(!client){scaffold.errors=['Datos: sesión RLS no disponible en esta carga'];cacheAndMount(id,meta,scaffold);hideLoader(id);return scaffold;}
    const aggregate=await timed('Entidad 360',()=>client.rpc(READ_RPC,{p_entity_id:id,p_rut:meta?.rut||rutFromEntityId(id)||null}),READ_TIMEOUT);
    if(runToken!==token)return null;
    if(!aggregate.error){
      const data=fromEnvelope(id,meta,aggregate.data);
      if(data){cacheAndMount(id,data.entity,data);hideLoader(id);window.dispatchEvent(new CustomEvent('atlas:entity360-ready',{detail:{entityId:id,partial:false,errors:[],build:BUILD,readMode:data.readMode,durationMs:Math.round(performance.now()-started)}}));return data;}
    }
    const data=await fallbackParallel(id,meta,runToken,client);if(!data)return null;
    if(aggregate.error)data.errors.unshift('Lectura consolidada: se utilizó el fallback paralelo');
    data.partial=data.errors.length>1;cacheAndMount(id,data.entity||meta,data);hideLoader(id);
    window.dispatchEvent(new CustomEvent('atlas:entity360-ready',{detail:{entityId:id,partial:data.partial,errors:[...data.errors],build:BUILD,readMode:data.readMode,durationMs:Math.round(performance.now()-started)}}));
    return data;
  }

  function keepMounted(id,meta,data){[300,1200,3500].forEach(ms=>setTimeout(()=>{if(String(selected()||'')!==String(id)||!inEntities())return;const host=profileHost();if(!host||host.dataset.entityId!==String(id)||host.dataset.e360Variant!=='HISTORY_INTELLIGENCE_ATLAS_V1')mount(id,meta,data);else decorate();},ms));}
  function start(id,extraMeta={}){
    id=String(id||'').trim();if(!id||!inEntities())return Promise.resolve(false);
    if(activeJob&&activeJobId===id)return activeJob;
    const meta=metaFor(id,extraMeta),hit=CACHE.get(id),fresh=hit&&Date.now()-hit.loadedAt<CACHE_TTL,runToken=++token;lastId=id;
    if(fresh){mount(id,hit.entity||meta,hit);decorate();hideLoader(id);keepMounted(id,hit.entity||meta,hit);return Promise.resolve(true);}
    const scaffold=emptyPackage(id,meta);loadingId=id;loadingMeta=meta;mount(id,meta,scaffold);showLoader(id,meta);
    const hardTimer=setTimeout(()=>{if(runToken===token){hideLoader(id);mount(id,meta,CACHE.get(id)||scaffold);}},HARD_LOADING_TIMEOUT);
    const job=loadResilient(id,meta,runToken).then(data=>{clearTimeout(hardTimer);if(data){hideLoader(id);keepMounted(id,data.entity||meta,data);}return !!data;}).catch(error=>{clearTimeout(hardTimer);console.error('[ATLAS E360] load',error);if(runToken===token){scaffold.errors=['Entidad 360: una fuente falló, se muestra el expediente parcial'];cacheAndMount(id,meta,scaffold);hideLoader(id);keepMounted(id,meta,scaffold);}return false;});
    activeJobId=id;activeJob=job.finally(()=>{if(activeJob===job||activeJobId===id){activeJob=null;activeJobId='';}});return activeJob;
  }
  function reconcile(reason='runtime'){
    if(!inEntities())return;const id=String(selected()||'').trim();if(!id)return;
    const host=profileHost(),wrong=!host||host.dataset.entityId!==id||host.dataset.e360Variant!=='HISTORY_INTELLIGENCE_ATLAS_V1',hydrated=host&&window.__ATLAS_ENTITY360_EXECUTIVE_STATE__?.hydrated===true&&String(window.__ATLAS_ENTITY360_EXECUTIVE_STATE__?.entityId||'')===id;
    if(id!==lastId||wrong||!hydrated){const hit=CACHE.get(id);if(hit&&Date.now()-hit.loadedAt<CACHE_TTL){mount(id,hit.entity||metaFor(id),hit);decorate();hideLoader(id);lastId=id;return;}if(!activeJob||activeJobId!==id)void start(id,{reason});}
  }
  function wrapEntry(){
    const entry=window.__ATLAS_ENTITY_ENTRY__;if(!entry||typeof entry.open!=='function'||entry.open.__atlasE360Resilience0964)return false;
    const base=entry.open;const wrapped=function(entityId,meta,...rest){const id=String(entityId||meta?.entity_id||'').trim();if(id)void start(id,meta||{});let result;try{result=base.apply(this,[entityId,meta,...rest]);}catch(error){console.warn('[ATLAS E360] base open failed',error);return Promise.resolve(false);}return Promise.race([Promise.resolve(result).catch(()=>false),new Promise(resolve=>setTimeout(()=>resolve(true),3200))]);};
    Object.defineProperty(wrapped,'__atlasE360Resilience0964',{value:true});Object.defineProperty(wrapped,'__atlasE360ResilienceBase',{value:base});entry.open=wrapped;return true;
  }
  function install(){
    ensureStyle();wrapEntry();reconcile('install');const app=document.querySelector('#app')||document.body;
    if(!observer){let queued=false;observer=new MutationObserver(()=>{if(queued||!inEntities())return;queued=true;setTimeout(()=>{queued=false;wrapEntry();reconcile('mutation');},220);});observer.observe(app,{childList:true,subtree:true,characterData:false});}
    if(!poll)poll=setInterval(()=>{if(!inEntities())return;wrapEntry();reconcile('poll');},2500);
  }

  const API={build:BUILD,start,reconcile,clear:()=>CACHE.clear(),get activeEntity(){return lastId;},get activeJob(){return activeJob;},get loadingEntity(){return loadingId;}};
  window.__ATLAS_ENTITY360_RESILIENCE_0964__=API;window.AtlasEntity360Resilience=API;
  ['atlas:entity-workspace-ready','atlas:entity-entry-ready','atlas:entity360-open'].forEach(name=>document.addEventListener(name,()=>{wrapEntry();reconcile(name);}));window.addEventListener('pageshow',()=>{wrapEntry();reconcile('pageshow');});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();