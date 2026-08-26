(function(){
  'use strict';

  const RELEASE=document.documentElement.getAttribute('data-atlas-release')||'current';
  const BUILD=document.documentElement.getAttribute('data-aml-build')||'current';
  const FAST_PATH_DELAY=250;
  const HARD_WATCHDOG=2600;
  const SDK_SESSION_TIMEOUT=700;
  const DIRECT_TIMEOUT=1800;
  const STORAGE_KEY=window.__ATLAS_AUTH_STORAGE_KEY__||'atlas-aml-auth-session-v2';

  function now(){return new Date().toISOString();}
  function status(stage,extra={}){
    window.__ATLAS_AUTH_BOOT__={release:RELEASE,build:BUILD,stage,authMutation:false,refreshTokenReplay:false,checkedAt:now(),...extra};
  }
  function host(){return document.querySelector('#app');}
  function title(){return host()?.querySelector('.auth-card h1')?.textContent?.trim()||'';}
  function hasShell(){return !!host()?.querySelector('.shell');}
  function hasLogin(){return !!host()?.querySelector('#login');}
  function isPending(){return title()==='Acceso pendiente de habilitación';}
  function isRecoverable(){
    const t=title();
    return t==='Iniciando sesión segura…'||t==='Validando acceso seguro…'||t==='No fue posible abrir el Workbench'||t==='No fue posible completar el inicio seguro'||t==='La sesión no respondió'||t==='La validación está tardando más de lo habitual';
  }
  function setDetail(text){const p=host()?.querySelector('.auth-card p');if(p)p.textContent=text;}
  function withTimeout(promise,ms,label){
    let timer;
    return Promise.race([
      Promise.resolve(promise).finally(()=>clearTimeout(timer)),
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`${label||'operación'} excedió ${ms} ms`)),ms);})
    ]);
  }

  function persistedSession(){
    try{
      const raw=localStorage.getItem(STORAGE_KEY);
      if(!raw)return null;
      const parsed=JSON.parse(raw);
      const candidates=[parsed,parsed?.currentSession,parsed?.session,parsed?.data?.session];
      for(const candidate of candidates){
        if(candidate?.access_token&&candidate?.user?.id)return candidate;
      }
    }catch(error){console.warn('[ATLAS] persisted auth session could not be read',error);}
    return null;
  }

  function installRenderGuards(){
    try{
      if(typeof renderPending==='function'&&!renderPending.__atlasGuarded){
        const originalPending=renderPending;
        renderPending=function(){if(hasShell())return;return originalPending.apply(this,arguments);};
        renderPending.__atlasGuarded=true;
      }
      if(typeof renderError==='function'&&!renderError.__atlasGuarded){
        const originalError=renderError;
        renderError=function(){if(hasShell())return;return originalError.apply(this,arguments);};
        renderError.__atlasGuarded=true;
      }
    }catch(error){console.warn('[ATLAS] render guard unavailable',error);}
  }
  installRenderGuards();

  function installReconciliationCircuitBreaker(){
    if(typeof sb==='undefined'||!sb?.from||sb.__atlasReconCircuitBreaker)return;
    const guarded=new Set(['aml_v0205_uaf_sii_reconciliation','aml_v0210_uaf_sii_reconciliation']);
    const originalFrom=sb.from.bind(sb);
    const emptyResult={data:null,count:0,error:null,status:200,statusText:'OK'};
    function noopQuery(){
      const q={};
      ['eq','neq','gt','gte','lt','lte','in','is','or','contains','order','range','limit','match','filter','not'].forEach(method=>{q[method]=()=>q;});
      q.then=(resolve,reject)=>Promise.resolve(emptyResult).then(resolve,reject);
      q.catch=reject=>Promise.resolve(emptyResult).catch(reject);
      q.finally=handler=>Promise.resolve(emptyResult).finally(handler);
      return q;
    }
    sb.from=function(table){
      const builder=originalFrom(table);
      if(!guarded.has(String(table))||!builder?.select)return builder;
      const originalSelect=builder.select.bind(builder);
      builder.select=function(columns,options){
        const exact=options&&options.count==='exact';
        if(!exact)return originalSelect(columns,options);
        if(options.head===true){window.__ATLAS_RECONCILIATION_CIRCUIT_BREAKER__.blockedHeadCounts++;return noopQuery();}
        window.__ATLAS_RECONCILIATION_CIRCUIT_BREAKER__.downgradedExactCounts++;
        const safe={...options};delete safe.count;safe.head=false;return originalSelect(columns,safe);
      };
      return builder;
    };
    sb.__atlasReconCircuitBreaker=true;
    window.__ATLAS_RECONCILIATION_CIRCUIT_BREAKER__={active:true,release:RELEASE,build:BUILD,tables:[...guarded],blockedHeadCounts:0,downgradedExactCounts:0,installedAt:now()};
  }
  try{installReconciliationCircuitBreaker();}catch(error){console.warn('[ATLAS] reconciliation circuit breaker unavailable',error);}

  async function directAllowlist(session){
    if(!session?.access_token||!session?.user?.id)throw new Error('Sesión autenticada no disponible.');
    const base=(typeof SUPABASE_URL!=='undefined'&&SUPABASE_URL)||'https://ldmtlwzqaqmegedktlxr.supabase.co';
    const key=(typeof SUPABASE_KEY!=='undefined'&&SUPABASE_KEY)||'';
    const url=`${base}/rest/v1/aml_allowed_users?select=role,enabled&user_id=eq.${encodeURIComponent(session.user.id)}`;
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),DIRECT_TIMEOUT);
    try{
      const response=await fetch(url,{method:'GET',headers:{Accept:'application/json',Authorization:`Bearer ${session.access_token}`,...(key?{apikey:key}:{})},cache:'no-store',signal:controller.signal});
      if(!response.ok)throw new Error(`Autorización respondió HTTP ${response.status}.`);
      const rows=await response.json();
      return Array.isArray(rows)?rows[0]||null:null;
    }finally{clearTimeout(timer);}
  }

  function openProtectedDegraded(session,error){
    if(typeof state!=='undefined'){
      state.user=session.user;
      state.access={role:'viewer',enabled:true,provisional:true};
    }
    window.__ATLAS_DEGRADED_AUTH__={active:true,reason:String(error?.message||error||'backend-timeout'),at:now()};
    status('protected-degraded',{reason:window.__ATLAS_DEGRADED_AUTH__.reason});
    if(typeof loadOverview==='function'){
      try{Promise.resolve(loadOverview()).catch(err=>console.warn('[ATLAS] degraded overview hydration failed',err));}
      catch(err){console.warn('[ATLAS] degraded overview render failed',err);}
    }else if(typeof shell==='function'){
      shell('Resumen operativo','ATLAS abierto en modo protegido; la base de datos está respondiendo con lentitud.');
    }
  }

  async function resolveSession(){
    let sdkError=null;
    try{
      if(typeof sb!=='undefined'&&sb?.auth?.getSession){
        const result=await withTimeout(sb.auth.getSession(),SDK_SESSION_TIMEOUT,'Supabase getSession');
        if(result?.error)throw result.error;
        if(result?.data?.session)return {session:result.data.session,source:'sdk'};
      }
    }catch(error){sdkError=error;}
    const stored=persistedSession();
    if(stored)return {session:stored,source:'storage',sdkError};
    return {session:null,source:'none',sdkError};
  }

  async function recoverAccess(options={}){
    const force=options?.force===true;
    if(hasShell()&&!force)return status('rendered');
    if(!hasShell())setDetail('Autenticación correcta. Verificando autorización…');
    try{
      const resolved=await resolveSession();
      const session=resolved.session;
      if(!session){
        status('session-unresolved',{source:resolved.source,error:String(resolved.sdkError?.message||'')});
        if(!resolved.sdkError&&typeof renderLogin==='function')renderLogin();
        return;
      }
      if(typeof state!=='undefined')state.user=session.user;

      let access=null;
      let lastError=null;
      try{access=await directAllowlist(session);}catch(error){lastError=error;}

      if(access&&access.enabled){
        if(typeof state!=='undefined')state.access=access;
        status('authorized',{role:access.role||'viewer',sessionSource:resolved.source});
        if(!hasShell()&&typeof loadOverview==='function'){
          Promise.resolve(loadOverview()).catch(error=>console.warn('[ATLAS] overview hydration failed',error));
        }
        if(typeof auditSession==='function')setTimeout(()=>Promise.resolve(auditSession()).catch(()=>{}),0);
        return;
      }
      if(access&&access.enabled===false){
        status('access-pending',{sessionSource:resolved.source});
        if(typeof renderPending==='function')return renderPending();
        return;
      }
      if(!access&&!lastError){
        status('access-pending',{sessionSource:resolved.source});
        if(typeof renderPending==='function')return renderPending();
        return;
      }

      if(hasShell()){
        window.__ATLAS_DEGRADED_AUTH__={active:true,reason:String(lastError?.message||lastError||'backend-timeout'),at:now()};
        status('protected-degraded-shell-retained',{reason:window.__ATLAS_DEGRADED_AUTH__.reason,sessionSource:resolved.source});
        return;
      }
      openProtectedDegraded(session,lastError);
    }catch(error){
      status('bootstrap-error',{error:String(error?.message||error)});
      setDetail('El inicio seguro encontró una demora inesperada. Reintentando…');
    }
  }

  async function watchdog(){
    if(hasShell())return status('rendered');
    if(hasLogin())return status('login-required');
    if(isPending()||isRecoverable())await recoverAccess({force:true});
  }

  window.addEventListener('error',event=>{window.__ATLAS_LAST_RUNTIME_ERROR__={message:event.message||String(event.error||'error'),at:now()};});
  window.addEventListener('unhandledrejection',event=>{window.__ATLAS_LAST_RUNTIME_ERROR__={message:String(event.reason?.message||event.reason||'unhandled rejection'),at:now()};});

  status('fast-path-scheduled',{fastPathMs:FAST_PATH_DELAY,watchdogMs:HARD_WATCHDOG,sdkSessionTimeoutMs:SDK_SESSION_TIMEOUT,directTimeoutMs:DIRECT_TIMEOUT,storageKey:STORAGE_KEY});
  window.setTimeout(()=>{if(!hasShell()&&!hasLogin()&&isRecoverable())void recoverAccess();},FAST_PATH_DELAY);
  window.setTimeout(()=>void watchdog(),HARD_WATCHDOG);
  window.AtlasAuthBootstrap={release:RELEASE,build:BUILD,retry:()=>recoverAccess({force:true}),status:()=>window.__ATLAS_AUTH_BOOT__};
})();
