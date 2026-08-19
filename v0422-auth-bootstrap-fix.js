(function(){
  'use strict';

  const RELEASE=document.documentElement.getAttribute('data-atlas-release')||'current';
  const BUILD=document.documentElement.getAttribute('data-aml-build')||'current';
  const HARD_WATCHDOG=10000;
  const DIRECT_TIMEOUT=4500;
  const SESSION_RECHECK_MS=1200;

  function now(){return new Date().toISOString();}
  function status(stage,extra={}){
    window.__ATLAS_AUTH_BOOT__={release:RELEASE,build:BUILD,stage,checkedAt:now(),...extra};
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
  function setDetail(text){
    const p=host()?.querySelector('.auth-card p');
    if(p)p.textContent=text;
  }
  function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}

  /* Startup circuit breaker.
     The legacy reconciliation code can issue multiple PostgREST count=exact
     requests while the home screen is hydrating. On the current dataset those
     scans are expensive enough to degrade PostgreSQL/Auth. Install this guard
     before feature bundles run so those requests can never participate in boot.
     RLS and the underlying governed views remain unchanged. */
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
        if(options.head===true){
          window.__ATLAS_RECONCILIATION_CIRCUIT_BREAKER__.blockedHeadCounts++;
          return noopQuery();
        }
        window.__ATLAS_RECONCILIATION_CIRCUIT_BREAKER__.downgradedExactCounts++;
        const safe={...options};
        delete safe.count;
        safe.head=false;
        return originalSelect(columns,safe);
      };
      return builder;
    };
    sb.__atlasReconCircuitBreaker=true;
    window.__ATLAS_RECONCILIATION_CIRCUIT_BREAKER__={
      active:true,
      release:RELEASE,
      build:BUILD,
      tables:[...guarded],
      blockedHeadCounts:0,
      downgradedExactCounts:0,
      installedAt:now()
    };
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

  const originalRenderLogin=typeof renderLogin==='function'?renderLogin:null;
  let loginValidationInFlight=false;
  let explicitLogout=false;

  document.addEventListener('click',event=>{
    if(event.target?.closest?.('#logout')){
      explicitLogout=true;
      try{sessionStorage.setItem('atlas-explicit-logout','1');}catch(_error){}
      status('explicit-logout');
    }
  },true);

  async function readStableSession(){
    if(typeof sb==='undefined'||!sb?.auth)return null;
    let first=null;
    try{first=(await sb.auth.getSession())?.data?.session||null;}catch(_error){}
    if(first)return first;
    await sleep(SESSION_RECHECK_MS);
    try{return (await sb.auth.getSession())?.data?.session||null;}catch(_error){return null;}
  }

  function renderVerifiedLogin(){
    if(originalRenderLogin)return originalRenderLogin();
  }

  async function guardedRenderLogin(){
    if(explicitLogout){
      status('login-after-explicit-logout');
      return renderVerifiedLogin();
    }
    if(loginValidationInFlight)return;
    loginValidationInFlight=true;
    status('login-transition-verifying-session');
    try{
      const session=await readStableSession();
      if(session){
        try{sessionStorage.removeItem('atlas-explicit-logout');}catch(_error){}
        if(typeof state!=='undefined')state.user=session.user;
        status('login-suppressed-session-still-valid',{userId:session.user?.id||null});
        await recoverAccess({force:true});
        return;
      }
      status('login-confirmed-no-session');
      renderVerifiedLogin();
    }finally{
      loginValidationInFlight=false;
    }
  }

  /* The legacy auth listener may ask to render the login card on a transient
     SIGNED_OUT-like client event even though the persisted Supabase session is
     still valid. Never discard an authenticated shell until the local session
     has been checked twice. Explicit logout is never intercepted. */
  if(originalRenderLogin){
    try{renderLogin=guardedRenderLogin;}catch(_error){window.renderLogin=guardedRenderLogin;}
  }

  function openProtectedDegraded(session,error){
    if(typeof state!=='undefined'){
      state.user=session.user;
      state.access={role:'viewer',enabled:true,provisional:true};
    }
    window.__ATLAS_DEGRADED_AUTH__={active:true,reason:String(error?.message||error||'backend-timeout'),at:now()};
    status('protected-degraded',{reason:window.__ATLAS_DEGRADED_AUTH__.reason});
    if(typeof loadOverview==='function'){
      try{
        const result=loadOverview();
        Promise.resolve(result).catch(err=>console.warn('[ATLAS] degraded overview hydration failed',err));
      }catch(err){console.warn('[ATLAS] degraded overview render failed',err);}
    }else if(typeof shell==='function'){
      shell('Resumen operativo','ATLAS abierto en modo protegido; la base de datos está respondiendo con lentitud.');
    }
    window.setTimeout(()=>{
      const contentNode=document.querySelector('#content');
      if(contentNode&&!contentNode.querySelector('.atlas-backend-warning')){
        const note=document.createElement('div');
        note.className='notice atlas-backend-warning';
        note.textContent='Modo protegido: la autenticación Microsoft está activa, pero Supabase está degradado. RLS continúa protegiendo los datos; algunos módulos pueden tardar o no responder hasta que se recupere la base.';
        contentNode.prepend(note);
      }
    },250);
  }

  async function recoverAccess(options={}){
    const force=options?.force===true;
    if(hasShell()&&!force)return status('rendered');
    if(!hasShell())setDetail('Autenticación correcta. Verificando autorización…');
    try{
      if(typeof sb==='undefined'||!sb?.auth)throw new Error('Cliente de autenticación no disponible.');
      const sessionResult=await sb.auth.getSession();
      if(sessionResult?.error)throw sessionResult.error;
      const session=sessionResult?.data?.session||null;
      if(!session){
        status('no-session-after-verification');
        return renderVerifiedLogin();
      }
      explicitLogout=false;
      try{sessionStorage.removeItem('atlas-explicit-logout');}catch(_error){}
      if(typeof state!=='undefined')state.user=session.user;

      let access=null;
      let lastError=null;
      try{access=await directAllowlist(session);}catch(error){lastError=error;}

      if(access&&access.enabled){
        if(typeof state!=='undefined')state.access=access;
        status('authorized',{role:access.role||'viewer'});
        if(!hasShell()&&typeof loadOverview==='function'){
          const result=loadOverview();
          Promise.resolve(result).catch(error=>console.warn('[ATLAS] overview hydration failed',error));
        }
        if(typeof auditSession==='function')Promise.resolve().then(()=>auditSession()).catch(()=>{});
        return;
      }
      if(access&&access.enabled===false){
        status('access-pending');
        if(typeof renderPending==='function')return renderPending();
        return;
      }
      if(!access&&!lastError){
        status('access-pending');
        if(typeof renderPending==='function')return renderPending();
        return;
      }

      /* A backend timeout is not an authorization denial. Keep the authenticated
         shell available; every data request is still enforced by Supabase RLS. */
      if(hasShell()){
        window.__ATLAS_DEGRADED_AUTH__={active:true,reason:String(lastError?.message||lastError||'backend-timeout'),at:now()};
        status('protected-degraded-shell-retained',{reason:window.__ATLAS_DEGRADED_AUTH__.reason});
        return;
      }
      openProtectedDegraded(session,lastError);
    }catch(error){
      const session=await readStableSession();
      if(session){
        if(hasShell()){
          window.__ATLAS_DEGRADED_AUTH__={active:true,reason:String(error?.message||error),at:now()};
          status('protected-degraded-shell-retained',{reason:window.__ATLAS_DEGRADED_AUTH__.reason});
          return;
        }
        openProtectedDegraded(session,error);
        return;
      }
      status('login-confirmed-after-session-check');
      renderVerifiedLogin();
    }
  }

  async function watchdog(){
    if(hasShell())return status('rendered');
    if(hasLogin())return status('login-required');
    if(isPending()||isRecoverable())await recoverAccess();
  }

  window.addEventListener('error',event=>{window.__ATLAS_LAST_RUNTIME_ERROR__={message:event.message||String(event.error||'error'),at:now()};});
  window.addEventListener('unhandledrejection',event=>{window.__ATLAS_LAST_RUNTIME_ERROR__={message:String(event.reason?.message||event.reason||'unhandled rejection'),at:now()};});

  status('watchdog-scheduled',{watchdogMs:HARD_WATCHDOG});
  window.setTimeout(()=>void watchdog(),HARD_WATCHDOG);
  window.AtlasAuthBootstrap={release:RELEASE,build:BUILD,retry:()=>recoverAccess({force:true}),status:()=>window.__ATLAS_AUTH_BOOT__};
})();
