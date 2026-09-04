'use strict';
/* ATLAS AML · Entidad 360 · resilient materialization authority 0.96.4
 * Corrección del bloqueo observado en el loader legado de Entidad 360.
 * - Renderiza inmediatamente una ficha válida, sin esperar al renderer legado.
 * - Consulta fuentes en paralelo con timeout por fuente y degradación parcial.
 * - Nunca deja la vista bloqueada si una fuente demora o falla.
 * - Reaplica la ficha si un renderer tardío intenta sobrescribirla.
 * - Conserva RLS, cruces exactos y semántica vacío != ausencia/cero.
 */
(function atlasEntity360Resilience0964(){
  const BUILD='0964-e360-resilience-1';
  const MASTER='aml_entity_master_v0553';
  const TAX='aml_entity_tax_profile';
  const UAF='aml_uaf_entity_profile';
  const SAN='aml_v_ipa3_sanction_entity_summary';
  const SPEND='aml_v_public_spend_provider_intel_0720';
  const HISTORY='aml_sii_entity_year';
  const CACHE_TTL=5*60*1000;
  const SOURCE_TIMEOUT=2800;
  const MASTER_TIMEOUT=1500;
  const HARD_LOADING_TIMEOUT=4300;
  if(window.__ATLAS_ENTITY360_RESILIENCE_0964__?.build===BUILD)return;

  const CACHE=new Map();
  let token=0,lastId='',observer=null,poll=null,activeJob=null;

  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_e){return window.sb||null;}};
  const appState=()=>{try{return window.amlState||(typeof state!=='undefined'?state:window.state)||null;}catch(_e){return window.amlState||window.state||null;}};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const rootHost=()=>document.querySelector('#content')||document.querySelector('#app')||document.body;
  const historyApi=()=>window.__ATLAS_ENTITY360_EXECUTIVE__;
  const profileHost=()=>document.querySelector('#atlas-entity360-executive');
  const inEntities=()=>{const v=String(appState()?.view||'').toLowerCase();return !v||['entities','entity','entity360'].includes(v)||document.body.classList.contains('view-entities');};

  function idValue(value){
    if(value&&typeof value==='object')return String(value.entity_id||value.entityId||value.id||'');
    return String(value||'');
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
    const dom=domSelection();
    if(dom.id)return dom.id;
    const s=appState();
    return idValue(s?.selectedEntityId||s?.selectedEntity||window.__ATLAS_ENTITY360_CURRENT__?.entityId||window.__ATLAS_ENTITY360_CURRENT__?.selectedEntity||window.__ATLAS_ENTITY360_EXECUTIVE_STATE__?.entityId);
  }

  function metaFor(id,extra={}){
    const dom=domSelection();
    return {
      ...(extra||{}),
      entity_id:id,
      name:extra?.name||extra?.legal_name||dom.name||id,
      rut:extra?.rut||dom.rut||null
    };
  }

  function rutVariants(value){
    const raw=String(value||'').trim().toUpperCase();
    if(!raw)return [];
    const clean=raw.replace(/[^0-9K]/g,'');
    if(clean.length<2)return [raw];
    const body=clean.slice(0,-1),dv=clean.slice(-1);
    const dashed=`${body}-${dv}`;
    const dotted=body.replace(/\B(?=(\d{3})+(?!\d))/g,'.')+`-${dv}`;
    return [...new Set([raw,dashed,dotted,clean])];
  }

  function friendlyError(label,kind){return `${label}: ${kind==='timeout'?'fuente sin respuesta dentro del tiempo de espera':'fuente no disponible en esta carga'}`;}

  function timed(label,queryFactory,ms=SOURCE_TIMEOUT){
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
    return {entityId:id,entity:{...(meta||{}),entity_id:id},master:null,tax:null,uaf:null,sanctions:null,spend:null,history:[],errors:[],loadedAt:Date.now(),partial:true};
  }

  function ensureStyle(){
    if(document.getElementById('atlas-e360-resilience-0964-style'))return;
    const style=document.createElement('style');
    style.id='atlas-e360-resilience-0964-style';
    style.textContent=`
      #content[data-e360-resilient-loading="1"]{position:relative!important;min-height:64vh}
      .atlas-e360-resilient-loader{position:absolute;inset:0;z-index:2900;display:grid;place-items:center;min-height:60vh;padding:28px;background:rgba(6,15,25,.94);backdrop-filter:blur(3px)}
      .atlas-e360-resilient-loader-card{width:min(500px,calc(100vw - 48px));display:flex;flex-direction:column;align-items:center;text-align:center;gap:12px;padding:30px;border:1px solid rgba(148,163,184,.16);border-radius:18px;background:rgba(14,26,40,.96);box-shadow:0 24px 80px rgba(0,0,0,.34)}
      .atlas-e360-resilient-spinner{width:54px;height:54px;border-radius:50%;border:3px solid rgba(148,163,184,.18);border-top-color:#f59e0b;border-right-color:#fbbf24;animation:atlasE360ResilientSpin .75s linear infinite}
      .atlas-e360-resilient-loader-card span{font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#fbbf24}
      .atlas-e360-resilient-loader-card h3{margin:0;color:#f8fafc;font-size:20px}.atlas-e360-resilient-loader-card p{margin:0;color:#a8b7ca;font-size:13px;line-height:1.5;max-width:410px}
      .atlas-e360-resilient-loader-card small{color:#d8e3ef;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      @keyframes atlasE360ResilientSpin{to{transform:rotate(360deg)}}
      @media(prefers-reduced-motion:reduce){.atlas-e360-resilient-spinner{animation:none}}
    `;
    document.head.appendChild(style);
  }

  function showLoader(id,meta){
    ensureStyle();
    try{window.AtlasEntity360Loading?.hide?.();}catch(_e){}
    const root=rootHost();if(!root)return;
    root.setAttribute('data-e360-resilient-loading','1');
    let loader=document.querySelector('[data-atlas-e360-resilient-loader="0964"]');
    if(!loader){loader=document.createElement('div');loader.className='atlas-e360-resilient-loader';loader.dataset.atlasE360ResilientLoader='0964';loader.setAttribute('role','status');loader.setAttribute('aria-live','polite');root.appendChild(loader);}
    loader.dataset.entityId=id;
    loader.innerHTML=`<div class="atlas-e360-resilient-loader-card"><div class="atlas-e360-resilient-spinner" aria-hidden="true"></div><span>Entidad 360</span><h3>Procesando entidad seleccionada</h3><p>ATLAS está materializando las fuentes disponibles. Una fuente lenta no bloqueará el expediente completo.</p><small>${esc([meta?.name,meta?.rut].filter(Boolean).join(' · ')||id)}</small></div>`;
  }

  function hideLoader(id){
    const loader=document.querySelector('[data-atlas-e360-resilient-loader="0964"]');
    if(loader&&(!id||loader.dataset.entityId===String(id)))loader.remove();
    const root=rootHost();if(root)root.removeAttribute('data-e360-resilient-loading');
    try{window.AtlasEntity360Loading?.hide?.();}catch(_e){}
  }

  function decorate(){
    const host=profileHost();
    if(!host)return;
    try{window.AtlasEntity360Drilldown?.decorate?.(host);}catch(error){console.warn('[ATLAS E360 0964] drilldown decorate',error);}
  }

  function mount(id,meta,data){
    const api=historyApi();
    if(!api||typeof api.mount!=='function')return false;
    if(!inEntities()||String(selected()||id)!==String(id))return false;
    api.mount(id,meta,data);
    decorate();
    return true;
  }

  function cacheAndMount(id,meta,data){
    data.loadedAt=Date.now();
    CACHE.set(id,data);
    mount(id,meta,data);
  }

  async function loadResilient(id,meta,runToken){
    const client=db();
    let data=emptyPackage(id,meta);
    cacheAndMount(id,meta,data);
    if(!client){
      data.errors=['Datos: sesión RLS no disponible en esta carga'];
      cacheAndMount(id,meta,data);hideLoader(id);return data;
    }

    const masterP=timed('Identidad',()=>client.from(MASTER).select('*').eq('entity_id',id).maybeSingle(),MASTER_TIMEOUT);
    const taxP=timed('SII',()=>client.from(TAX).select('entity_id,commercial_year,sales_band,sales_band_code,sales_band_rank,workers_numeric,region,province,commune,economic_sector,economic_subsector,main_activity,taxpayer_type,taxpayer_subtype,activity_start_date,termination_date,current_status,activity_count,activity_codes,activity_names,address_count,current_address_count,communes,address_regions,ownership_edge_count,legal_entity_partner_count,societies_as_partner_count,signal_count,signal_types,updated_at').eq('entity_id',id).maybeSingle());
    const sanP=timed('Sanciones',()=>client.from(SAN).select('*').eq('entity_id',id).maybeSingle());
    const spendP=timed('Compras públicas',()=>client.from(SPEND).select('supplier_rut,supplier_name,order_count,buyer_count,total_clp,first_order_date,last_order_date,direct_order_count,entity_id,region,commune,lobby_count,cgr_count,presupuesto_signal_count,attention_score,signal_codes').eq('entity_id',id).limit(1).maybeSingle());
    const historyP=timed('Historia SII',()=>client.from(HISTORY).select('*').eq('entity_id',id).order('commercial_year',{ascending:false}).limit(8));

    const master=await masterP;
    if(runToken!==token)return null;
    data.master=master.data||null;
    data.entity={...(data.master||{}),...(meta||{}),entity_id:id,name:meta?.name||data.master?.name||data.master?.res_legal_name||id,rut:meta?.rut||data.master?.rut||null};
    if(master.error)data.errors.push(master.error);
    cacheAndMount(id,data.entity,data);

    const uafP=data.entity.rut?timed('UAF',()=>client.from(UAF).select('*').in('rut',rutVariants(data.entity.rut)).limit(1).maybeSingle()):Promise.resolve({data:null,error:null});
    const names=['tax','sanctions','spend','history','uaf'];
    const results=await Promise.allSettled([taxP,sanP,spendP,historyP,uafP]);
    if(runToken!==token)return null;

    results.forEach((result,index)=>{
      const r=result.status==='fulfilled'?result.value:{data:null,error:friendlyError(names[index],'error')};
      if(index===0)data.tax=r.data||null;
      if(index===1)data.sanctions=r.data||null;
      if(index===2)data.spend=r.data||null;
      if(index===3)data.history=Array.isArray(r.data)?r.data:[];
      if(index===4)data.uaf=r.data||null;
      if(r.error)data.errors.push(r.error);
    });
    data.partial=data.errors.length>0;
    cacheAndMount(id,data.entity,data);
    hideLoader(id);
    window.dispatchEvent(new CustomEvent('atlas:entity360-ready',{detail:{entityId:id,partial:data.partial,errors:[...data.errors],build:BUILD}}));
    return data;
  }

  function keepMounted(id,meta,data){
    [250,900,1800,3500,7000,12000].forEach(ms=>setTimeout(()=>{
      if(String(selected()||'')!==String(id)||!inEntities())return;
      const host=profileHost();
      if(!host||host.dataset.entityId!==String(id)||host.dataset.e360Variant!=='HISTORY_INTELLIGENCE_ATLAS_V1')mount(id,meta,data);
      else decorate();
    },ms));
  }

  function start(id,extraMeta={}){
    id=String(id||'').trim();
    if(!id||!inEntities())return Promise.resolve(false);
    const meta=metaFor(id,extraMeta);
    const hit=CACHE.get(id);
    const fresh=hit&&Date.now()-hit.loadedAt<CACHE_TTL;
    const runToken=++token;lastId=id;
    if(fresh){mount(id,hit.entity||meta,hit);decorate();hideLoader(id);keepMounted(id,hit.entity||meta,hit);return Promise.resolve(true);}
    showLoader(id,meta);
    const scaffold=emptyPackage(id,meta);
    mount(id,meta,scaffold);
    const hardTimer=setTimeout(()=>{if(runToken===token){hideLoader(id);mount(id,meta,CACHE.get(id)||scaffold);}},HARD_LOADING_TIMEOUT);
    const job=loadResilient(id,meta,runToken).then(data=>{
      clearTimeout(hardTimer);
      if(data){hideLoader(id);keepMounted(id,data.entity||meta,data);}
      return !!data;
    }).catch(error=>{
      clearTimeout(hardTimer);
      console.error('[ATLAS E360 0964] resilient load',error);
      if(runToken===token){scaffold.errors=['Entidad 360: una fuente falló, se muestra el expediente parcial'];cacheAndMount(id,meta,scaffold);hideLoader(id);keepMounted(id,meta,scaffold);}
      return false;
    });
    activeJob=job;return job;
  }

  function reconcile(reason='runtime'){
    if(!inEntities())return;
    const id=String(selected()||'').trim();
    if(!id)return;
    const host=profileHost();
    const loaderText=String(document.querySelector('#content')?.textContent||'');
    const stuck=/Cargando\s+Entidad\s+360/i.test(loaderText);
    const wrong=!host||host.dataset.entityId!==id||host.dataset.e360Variant!=='HISTORY_INTELLIGENCE_ATLAS_V1';
    const hydrated=host&&window.__ATLAS_ENTITY360_EXECUTIVE_STATE__?.hydrated===true&&String(window.__ATLAS_ENTITY360_EXECUTIVE_STATE__?.entityId||'')===id;
    if(id!==lastId||wrong||stuck||!hydrated){
      const hit=CACHE.get(id);
      if(hit&&Date.now()-hit.loadedAt<CACHE_TTL){mount(id,hit.entity||metaFor(id),hit);decorate();hideLoader(id);lastId=id;return;}
      if(!activeJob||id!==lastId)void start(id,{reason});
    }
  }

  function wrapEntry(){
    const entry=window.__ATLAS_ENTITY_ENTRY__;
    if(!entry||typeof entry.open!=='function'||entry.open.__atlasE360Resilience0964)return false;
    const base=entry.open;
    const wrapped=function(entityId,meta,...rest){
      const id=String(entityId||meta?.entity_id||'').trim();
      if(id)void start(id,meta||{});
      let result;
      try{result=base.apply(this,[entityId,meta,...rest]);}catch(error){console.warn('[ATLAS E360 0964] base open failed; resilient dossier remains active',error);return Promise.resolve(false);}
      return Promise.race([
        Promise.resolve(result).catch(error=>{console.warn('[ATLAS E360 0964] legacy open rejected; resilient dossier remains active',error);return false;}),
        new Promise(resolve=>setTimeout(()=>resolve(true),3600))
      ]);
    };
    Object.defineProperty(wrapped,'__atlasE360Resilience0964',{value:true});
    Object.defineProperty(wrapped,'__atlasE360ResilienceBase',{value:base});
    entry.open=wrapped;
    return true;
  }

  function install(){
    ensureStyle();wrapEntry();reconcile('install');
    const app=document.querySelector('#app')||document.body;
    if(!observer){
      let queued=false;
      observer=new MutationObserver(()=>{
        if(queued)return;queued=true;
        setTimeout(()=>{queued=false;wrapEntry();reconcile('mutation');},80);
      });
      observer.observe(app,{childList:true,subtree:true,characterData:false});
    }
    if(!poll)poll=setInterval(()=>{wrapEntry();reconcile('poll');},500);
  }

  const API={build:BUILD,start,reconcile,clear:()=>CACHE.clear(),get activeEntity(){return lastId;},get activeJob(){return activeJob;}};
  window.__ATLAS_ENTITY360_RESILIENCE_0964__=API;
  window.AtlasEntity360Resilience=API;
  ['atlas:entity-workspace-ready','atlas:entity-entry-ready','atlas:entity360-open'].forEach(name=>document.addEventListener(name,()=>{wrapEntry();reconcile(name);}));
  window.addEventListener('pageshow',()=>{wrapEntry();reconcile('pageshow');});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
