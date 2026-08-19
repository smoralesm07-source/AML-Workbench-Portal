(function(){
  'use strict';

  const RELEASE=document.documentElement.getAttribute('data-atlas-release')||'current';
  const BUILD=document.documentElement.getAttribute('data-aml-build')||'current';
  const HARD_WATCHDOG=18000;
  const MAX_RECOVERY_RELOADS=2;
  const RECOVERY_KEY='atlas-auth-stability-reloads:v0439';

  function now(){return new Date().toISOString();}
  function status(stage,extra={}){
    window.__ATLAS_AUTH_BOOT__={release:RELEASE,build:BUILD,stage,checkedAt:now(),...extra};
  }
  function host(){return document.querySelector('#app');}
  function title(){return host()?.querySelector('.auth-card h1')?.textContent?.trim()||'';}
  function hasShell(){return !!host()?.querySelector('.shell');}
  function hasLogin(){return !!host()?.querySelector('#login');}
  function isPending(){return title()==='Acceso pendiente de habilitación';}
  function isResolved(){return hasShell()||hasLogin()||isPending();}
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
  function showTerminalDiagnostic(last){
    const root=host();
    if(!root)return;
    const message=String(last?.message||'La validación de acceso no respondió dentro del tiempo esperado.');
    status('recovery-required',{error:message,reloads:recoveryCount()});
    root.innerHTML=`<section class="auth-screen"><div class="auth-card">
      <div class="brand-mark">ATLAS</div>
      <div class="eyebrow">Recuperación de acceso</div>
      <h1>El servicio de autorización está demorando más de lo esperado</h1>
      <p>ATLAS mantuvo la sesión segura, pero la validación de acceso no logró completar el arranque. Puedes reintentar sin cerrar tu sesión Microsoft.</p>
      <p class="error">${String(message).replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</p>
      <button class="primary" type="button" id="atlas-auth-retry">Reintentar acceso</button>
    </div></section>`;
    document.querySelector('#atlas-auth-retry')?.addEventListener('click',()=>{
      clearRecovery();
      location.reload();
    });
  }

  function watchdog(){
    if(isResolved()){
      clearRecovery();
      status(hasShell()?'rendered':hasLogin()?'login-required':'access-pending');
      return;
    }
    if(!isRecoverable())return;

    const attempts=recoveryCount();
    const last=window.__ATLAS_LAST_RUNTIME_ERROR__;
    if(attempts<MAX_RECOVERY_RELOADS){
      const next=attempts+1;
      setRecoveryCount(next);
      status('recovering',{reload:next,maxReloads:MAX_RECOVERY_RELOADS,lastError:last?.message||null});
      setDetail(`El servicio está respondiendo con lentitud. Reintentando acceso seguro (${next}/${MAX_RECOVERY_RELOADS})…`);
      window.setTimeout(()=>location.reload(),900+(next*350));
      return;
    }
    showTerminalDiagnostic(last);
  }

  window.addEventListener('error',event=>{
    window.__ATLAS_LAST_RUNTIME_ERROR__={message:event.message||String(event.error||'error'),source:event.filename||null,line:event.lineno||null,column:event.colno||null,at:now()};
  });
  window.addEventListener('unhandledrejection',event=>{
    window.__ATLAS_LAST_RUNTIME_ERROR__={message:String(event.reason?.message||event.reason||'unhandled rejection'),source:'promise',at:now()};
  });

  /*
   * v0.43.9 stability policy:
   * - app.js remains the single authority that reads getSession + aml_allowed_users.
   * - this guard NEVER launches a second allowlist/RLS query in parallel.
   * - on a transient backend stall it performs bounded whole-boot retries.
   * This removes the former v0.42.2 race where app.js and the rescue routine
   * queried aml_allowed_users concurrently and the rescue failed after 6.5 s.
   */
  status('watchdog-scheduled',{watchdogMs:HARD_WATCHDOG});
  window.setTimeout(watchdog,HARD_WATCHDOG);

  window.AtlasAuthBootstrap={
    release:RELEASE,
    build:BUILD,
    retry:()=>{clearRecovery();location.reload();},
    status:()=>window.__ATLAS_AUTH_BOOT__
  };
})();
