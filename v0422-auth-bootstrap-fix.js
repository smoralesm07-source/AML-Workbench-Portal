(function(){
  'use strict';

  const RELEASE=document.documentElement.getAttribute('data-atlas-release')||'current';
  const BUILD=document.documentElement.getAttribute('data-aml-build')||'current';
  const HARD_WATCHDOG=30000;

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
    return String(value??'').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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
      <p>ATLAS mantuvo tu sesión Microsoft. La autorización o la base de datos no respondió a tiempo; no se realizará ninguna recarga automática.</p>
      <p class="error">${escText(message)}</p>
      <button class="primary" type="button" id="atlas-auth-retry">Reintentar validación</button>
      <button class="ghost" type="button" id="atlas-auth-signout">Cerrar sesión</button>
    </div></section>`;
    document.querySelector('#atlas-auth-retry')?.addEventListener('click',()=>{
      try{
        if(typeof boot==='function')Promise.resolve(boot()).catch((retryError)=>console.warn('[ATLAS auth] retry failed',retryError));
        else location.reload();
      }catch(retryError){
        console.warn('[ATLAS auth] retry failed',retryError);
        location.reload();
      }
    });
    document.querySelector('#atlas-auth-signout')?.addEventListener('click',()=>{
      if(typeof signOut==='function')signOut();
      else location.reload();
    });
  }

  async function verifyPendingAccess(){
    if(!isPending())return false;
    if(typeof sb==='undefined'||!sb?.from||typeof state==='undefined'||!state?.user?.id)return false;
    status('pending-recheck',{userId:state.user.id});
    try{
      const {data:access,error}=await sb.from('aml_allowed_users')
        .select('role,enabled')
        .eq('user_id',state.user.id)
        .maybeSingle();
      if(error)throw error;
      if(!access?.enabled){
        status('access-pending');
        return true;
      }
      state.access=access;
      status('authorized-after-recheck',{role:access.role||'viewer'});
      if(typeof auditSession==='function')Promise.resolve().then(()=>auditSession()).catch(error=>console.warn('[ATLAS] deferred session audit failed',error));
      if(typeof loadOverview==='function'){
        await Promise.resolve(loadOverview());
        status('rendered',{role:access.role||'viewer',recovered:true});
        return true;
      }
      throw new Error('Vista principal no disponible tras recuperar autorización.');
    }catch(error){
      window.__ATLAS_LAST_RUNTIME_ERROR__={message:String(error?.message||error),source:'allowlist-recheck',at:now()};
      showRecovery(error);
      return true;
    }
  }

  async function watchdog(){
    if(hasShell())return status('rendered');
    if(hasLogin())return status('login-required');
    if(isPending()){
      await verifyPendingAccess();
      return;
    }
    if(!isRecoverable())return;
    showRecovery(window.__ATLAS_LAST_RUNTIME_ERROR__?.message||'El arranque no completó la transición de interfaz dentro del tiempo esperado.');
  }

  window.addEventListener('error',event=>{
    window.__ATLAS_LAST_RUNTIME_ERROR__={message:event.message||String(event.error||'error'),source:event.filename||null,line:event.lineno||null,column:event.colno||null,at:now()};
  });
  window.addEventListener('unhandledrejection',event=>{
    window.__ATLAS_LAST_RUNTIME_ERROR__={message:String(event.reason?.message||event.reason||'unhandled rejection'),source:'promise',at:now()};
  });

  /* Passive stability policy: never auto-reload or clear an authenticated session. */
  status('watchdog-scheduled',{watchdogMs:HARD_WATCHDOG});
  window.setTimeout(()=>void watchdog(),HARD_WATCHDOG);

  window.AtlasAuthBootstrap={
    release:RELEASE,
    build:BUILD,
    retry:()=>{if(typeof boot==='function')return boot(); location.reload();},
    status:()=>window.__ATLAS_AUTH_BOOT__
  };
})();
