'use strict';
/* ATLAS AML 0.55.4 · Contexto canónico transversal de entidad.
 *
 * Resolución estricta por RUT válido. Esta API permite que radares y módulos
 * operativos consuman el mismo contexto de `aml_entity_master_v0553` sin
 * implementar joins de nombre ni reglas de identidad locales.
 */
(function atlasEntityContext0554(){
  const VIEW='aml_entity_master_v0553',TTL=5*60*1000;
  const CACHE=new Map(),INFLIGHT=new Map();
  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_e){return window.sb||null;}};
  const normalizeRut=v=>String(v||'').toUpperCase().replace(/[^0-9K]/g,'');
  function validRut(v){
    const k=normalizeRut(v);if(k.length<8||k.length>9)return false;
    const body=k.slice(0,-1),dv=k.slice(-1);if(!/^\d+$/.test(body))return false;
    let sum=0,mul=2;for(let i=body.length-1;i>=0;i--){sum+=Number(body[i])*mul;mul=mul===7?2:mul+1;}
    const r=11-(sum%11),calc=r===11?'0':r===10?'K':String(r);return calc===dv;
  }
  async function fetchByRut(rut){
    const client=db(),rutKey=normalizeRut(rut);if(!client||!validRut(rutKey))return null;
    const res=await client.from(VIEW).select('*').eq('rut_key',rutKey).maybeSingle();
    if(res.error)throw res.error;
    const registry=res.data||null;if(!registry)return null;
    const api=window.__ATLAS_ENTITY_RES__;
    if(api?.active&&typeof api.load==='function'){
      try{const pkg=await api.load(registry.entity_id);if(pkg)return {...pkg,registry:pkg.registry||registry,rutKey};}catch(_e){}
    }
    return {entityId:registry.entity_id,registry,timeline:[],relations:[],rutKey,loadedAt:Date.now()};
  }
  async function loadByRut(rut){
    const key=normalizeRut(rut);if(!validRut(key))return null;
    const hit=CACHE.get(key);if(hit&&Date.now()-hit.loadedAt<TTL)return hit;
    if(INFLIGHT.has(key))return INFLIGHT.get(key);
    const job=fetchByRut(key).then(data=>{if(data){data.loadedAt=Date.now();CACHE.set(key,data);}return data;}).finally(()=>INFLIGHT.delete(key));
    INFLIGHT.set(key,job);return job;
  }
  function openEntity(entityId){
    if(!entityId)return false;
    const entry=window.__ATLAS_ENTITY_ENTRY__?.explorer?.open;
    if(typeof entry==='function'){void Promise.resolve(entry(entityId));return true;}
    if(typeof window.v0391Open==='function'){void Promise.resolve(window.v0391Open(entityId));return true;}
    if(typeof window.v0203OpenEntity==='function'){void Promise.resolve(window.v0203OpenEntity(entityId));return true;}
    return false;
  }
  window.__ATLAS_ENTITY_CONTEXT_0554__={active:true,release:'0.55.4',view:VIEW,normalizeRut,validRut,loadByRut,openEntity,clear:()=>CACHE.clear(),identityPolicy:'RUT_VALIDO_EXACTO_ONLY',nameMatching:false,scoreMutation:false,installedAt:new Date().toISOString()};
})();
