(function(){
  'use strict';

  const RELEASE=document.documentElement.getAttribute('data-atlas-release')||'current';
  const BUILD=document.documentElement.getAttribute('data-aml-build')||'current';
  const HARD_WATCHDOG=22000;
  const MAX_RECOVERY_RELOADS=2;
  const RECOVERY_KEY='atlas-auth-stability-reloads:v0440';

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
      t==='No fue posible abrir el Workbench'||
      t==='No fue posible completar el inicio seguro'||
      t==='La sesión no respondió';
  }
  function setDetail(text){
    const p=host()?.querySelector('.auth-card p');
    if(p)p.textContent=text;
  }
  function clearRecovery(){
    try{sessionStorage.removeItem(RECOVERY_KEY);}catch(_error){}
  }
  function recoveryCount(){
    try{return Number(sessionStorage.getItem(RECOVERY_KEY)||0)||0;}catch(_error){return 0;}
  }
  function setRecoveryCount(value){
    try{sessionStorage.setItem(RECOVERY_KEY,String(value));}catch(_error){}
  }
  function escText(value){
    return String(value??'').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function showTerminalDiagnostic(last){
    const root=host();
    if(!root)return;
    const message=String(last?.message||'La validación de acceso no respondió dentro del tiempo esperado.');
    status('recovery-required',{error:message,reloads:recoveryCount()});
    root.innerHTML=`<section class="auth-screen"><div class="auth-card">
      <div class="brand-mark">ATLAS</div>
      <div class="eyebrow">Recuperación de acceso</div>
      <h1>El servicio de autorización está demorando más de lo esperado</h1>
      <p>ATLAS mantuvo la sesión segura. La autorización o la base de datos no respondió a tiempo; puedes reintentar sin cerrar tu sesión Microsoft.</p>
      <p class="error">${escText(message)}</p>
      <button class="primary" type="button" id="atlas-auth-retry">Reintentar acceso</button>
    </div></section>`;
    document.querySelector('#atlas-auth-retry')?.addEventListener('click',()=>{
      clearRecovery();
      location.reload();
    });
  }

  function boundedReload(reason){
    const attempts=recoveryCount();
    const last=window.__ATLAS_LAST_RUNTIME_ERROR__;
    if(attempts<MAX_RECOVERY_RELOADS){
      const next=attempts+1;
      setRecoveryCount(next);
      status('recovering',{reason,reload:next,maxReloads:MAX_RECOVERY_RELOADS,lastError:last?.message||null});
      setDetail(`El servicio está respondiendo con lentitud. Reintentando acceso seguro (${next}/${MAX_RECOVERY_RELOADS})…`);
      window.setTimeout(()=>location.reload(),900+(next*350));
      return;
    }
    showTerminalDiagnostic(last||{message:reason});
  }

  async function verifyPendingAccess(){
    /* app.js historically mapped both "disabled" and transient PostgREST errors
       to the same pending screen. Re-check only after that first request ended. */
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
        clearRecovery();
        status('access-pending');
        return true;
      }
      state.access=access;
      clearRecovery();
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
      boundedReload('La verificación de autorización/RLS falló de forma transitoria.');
      return true;
    }
  }

  async function watchdog(){
    if(hasShell()){
      clearRecovery();
      status('rendered');
      return;
    }
    if(hasLogin()){
      clearRecovery();
      status('login-required');
      return;
    }
    if(isPending()){
      await verifyPendingAccess();
      return;
    }
    if(!isRecoverable())return;
    boundedReload('El arranque no completó la transición de interfaz dentro del tiempo esperado.');
  }

  window.addEventListener('error',event=>{
    window.__ATLAS_LAST_RUNTIME_ERROR__={message:event.message||String(event.error||'error'),source:event.filename||null,line:event.lineno||null,column:event.colno||null,at:now()};
  });
  window.addEventListener('unhandledrejection',event=>{
    window.__ATLAS_LAST_RUNTIME_ERROR__={message:String(event.reason?.message||event.reason||'unhandled rejection'),source:'promise',at:now()};
  });

  /* Single canonical app boot. This guard never races the initial allowlist query.
     It acts only after the initial flow resolves to pending/error or remains stalled. */
  status('watchdog-scheduled',{watchdogMs:HARD_WATCHDOG});
  window.setTimeout(()=>void watchdog(),HARD_WATCHDOG);

  window.AtlasAuthBootstrap={
    release:RELEASE,
    build:BUILD,
    retry:()=>{clearRecovery();location.reload();},
    status:()=>window.__ATLAS_AUTH_BOOT__
  };
})();
