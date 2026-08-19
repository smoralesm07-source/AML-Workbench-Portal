(function(){
  'use strict';

  const RELEASE=document.documentElement.getAttribute('data-atlas-release')||'current';
  const BUILD=document.documentElement.getAttribute('data-aml-build')||'current';
  const HARD_WATCHDOG=12000;
  const DIRECT_TIMEOUT=7000;

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
    return t==='Iniciando sesión segura…'||
      t==='Validando acceso seguro…'||
      t==='No fue posible abrir el Workbench'||
      t==='No fue posible completar el inicio seguro'||
      t==='La sesión no respondió';
  }
  function escText(value){
    return String(value??'').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
  }
  function setDetail(text){
    const p=host()?.querySelector('.auth-card p');
    if(p)p.textContent=text;
  }
  function showRecovery(error){
    const root=host();
    if(!root)return;
    const message=String(error?.message||error||'La validación de acceso no respondió dentro del tiempo esperado.');
    status('recovery-required',{error:message});
    root.innerHTML=`<section class="auth-screen"><div class="auth-card">
      <div class="brand-mark">ATLAS</div>
      <div class="eyebrow">Acceso seguro</div>
      <h1>La validación está tardando más de lo habitual</h1>
      <p>Tu sesión Microsoft sigue activa. ATLAS no cerrará ni recargará automáticamente la sesión.</p>
      <p class="error">${escText(message)}</p>
      <button class="primary" type="button" id="atlas-auth-retry">Reintentar validación</button>
      <button class="ghost" type="button" id="atlas-auth-signout">Cerrar sesión</button>
    </div></section>`;
    document.querySelector('#atlas-auth-retry')?.addEventListener('click',()=>void recoverAccess(true));
    document.querySelector('#atlas-auth-signout')?.addEventListener('click',()=>{
      if(typeof signOut==='function')signOut();
      else location.reload();
    });
  }

  async function directAllowlist(session){
    if(!session?.access_token||!session?.user?.id)throw new Error('Sesión autenticada no disponible para validar autorización.');
    const base=(typeof SUPABASE_URL!=='undefined'&&SUPABASE_URL)||'https://ldmtlwzqaqmegedktlxr.supabase.co';
    const key=(typeof SUPABASE_KEY!=='undefined'&&SUPABASE_KEY)||'';
    const url=`${base}/rest/v1/aml_allowed_users?select=role,enabled&user_id=eq.${encodeURIComponent(session.user.id)}`;
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),DIRECT_TIMEOUT);
    try{
      const response=await fetch(url,{
        method:'GET',
        headers:{
          'Accept':'application/json',
          'Authorization':`Bearer ${session.access_token}`,
          ...(key?{'apikey':key}:{})
        },
        cache:'no-store',
        signal:controller.signal
      });
      if(!response.ok)throw new Error(`Autorización respondió HTTP ${response.status}.`);
      const rows=await response.json();
      return Array.isArray(rows)?rows[0]||null:null;
    }finally{
      clearTimeout(timer);
    }
  }

  async function recoverAccess(manual=false){
    if(hasShell())return status('rendered');
    status(manual?'manual-recovery':'active-recovery');
    setDetail('Autenticación correcta. Recuperando validación de autorización/RLS…');
    try{
      if(typeof sb==='undefined'||!sb?.auth)throw new Error('Cliente de autenticación no disponible.');
      const sessionResult=await sb.auth.getSession();
      if(sessionResult?.error)throw sessionResult.error;
      const session=sessionResult?.data?.session||null;
      if(!session){
        if(typeof renderLogin==='function')return renderLogin();
        throw new Error('No existe una sesión activa.');
      }
      if(typeof state!=='undefined')state.user=session.user;

      let access=null;
      let lastError=null;
      for(let attempt=1;attempt<=2&&!access;attempt++){
        try{
          status('allowlist-direct',{attempt,userId:session.user.id});
          access=await directAllowlist(session);
        }catch(error){
          lastError=error;
          if(attempt<2)await new Promise(resolve=>setTimeout(resolve,700));
        }
      }
      if(!access){
        if(lastError)throw lastError;
        if(typeof renderPending==='function')return renderPending();
        throw new Error('Cuenta autenticada sin habilitación vigente.');
      }
      if(!access.enabled){
        status('access-pending');
        if(typeof renderPending==='function')return renderPending();
        throw new Error('Cuenta autenticada sin habilitación vigente.');
      }

      if(typeof state!=='undefined')state.access=access;
      status('authorized-recovered',{role:access.role||'viewer'});
      setDetail('Autorización confirmada. Abriendo ATLAS AML…');

      if(typeof loadOverview!=='function')throw new Error('Vista principal no disponible.');
      const overview=loadOverview();
      status('rendered',{role:access.role||'viewer',recovered:true});
      Promise.resolve(overview).catch(error=>{
        console.error('[ATLAS] overview hydration failed after recovered shell render',error);
        if(typeof showContentError==='function')showContentError(error);
      });
      if(typeof auditSession==='function'){
        Promise.resolve().then(()=>auditSession()).catch(error=>console.warn('[ATLAS] deferred session audit failed',error));
      }
    }catch(error){
      window.__ATLAS_LAST_RUNTIME_ERROR__={message:String(error?.name==='AbortError'?'La autorización excedió el tiempo de respuesta.':error?.message||error),source:'active-auth-recovery',at:now()};
      showRecovery(window.__ATLAS_LAST_RUNTIME_ERROR__.message);
    }
  }

  async function watchdog(){
    if(hasShell())return status('rendered');
    if(hasLogin())return status('login-required');
    if(isPending()||isRecoverable()){
      await recoverAccess(false);
      return;
    }
  }

  window.addEventListener('error',event=>{
    window.__ATLAS_LAST_RUNTIME_ERROR__={message:event.message||String(event.error||'error'),source:event.filename||null,line:event.lineno||null,column:event.colno||null,at:now()};
  });
  window.addEventListener('unhandledrejection',event=>{
    window.__ATLAS_LAST_RUNTIME_ERROR__={message:String(event.reason?.message||event.reason||'unhandled rejection'),source:'promise',at:now()};
  });

  /* Active recovery does not race initial boot until the 12 s watchdog threshold.
     It uses an abortable direct RLS request so a hung Supabase query cannot leave
     the authenticated user indefinitely on "Validando acceso seguro…". */
  status('watchdog-scheduled',{watchdogMs:HARD_WATCHDOG});
  window.setTimeout(()=>void watchdog(),HARD_WATCHDOG);

  window.AtlasAuthBootstrap={
    release:RELEASE,
    build:BUILD,
    retry:()=>recoverAccess(true),
    status:()=>window.__ATLAS_AUTH_BOOT__
  };
})();
