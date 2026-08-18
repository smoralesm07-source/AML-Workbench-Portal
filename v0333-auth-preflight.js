'use strict';

/* v0.33.3 · auth dependency preflight + Supabase auth deadlock/session guard.
 * Supabase documents a deadlock if async Supabase API work is started directly
 * inside onAuthStateChange. The legacy app callback calls boot(), which then
 * performs getSession/PostgREST. We wrap createClient before app.js runs so
 * every auth callback executes on the next macrotask, outside the auth lock.
 * If a persisted refresh session still stalls the initial boot, clear only this
 * project's local Supabase session once and return the user to Microsoft login.
 */
(function authPreflight(){
  const PROJECT_REF='ldmtlwzqaqmegedktlxr';
  const RECOVERY_KEY='aml-auth-recovery-attempted:v0333';
  const app=document.querySelector('#app');
  const sdk=window.supabase;
  const sdkReady=!!(sdk&&typeof sdk.createClient==='function');
  window.__AML_SUPABASE_SDK_READY__=sdkReady;

  function clearPersistedSupabaseAuth(){
    try{
      Object.keys(localStorage)
        .filter((key)=>key.startsWith(`sb-${PROJECT_REF}-auth-token`))
        .forEach((key)=>localStorage.removeItem(key));
    }catch(error){
      console.warn('[AML v0.33.3] unable to clear persisted Supabase auth state',error);
    }
  }

  if(!sdkReady){
    console.error('[AML v0.33.3] Supabase JS SDK unavailable; authentication bootstrap aborted.');
    if(!app)return;
    app.innerHTML=`<section class="auth-screen"><div class="auth-card">
      <div class="brand-mark">AML</div><div class="eyebrow">Error de inicialización</div>
      <h1>No fue posible iniciar el acceso seguro</h1>
      <p>El componente de autenticación no pudo cargarse. Recarga la aplicación; si el problema persiste, revisa la disponibilidad del SDK de Supabase.</p>
      <button class="primary" type="button" id="auth-preflight-reload">Recargar</button>
    </div></section>`;
    document.querySelector('#auth-preflight-reload')?.addEventListener('click',()=>location.reload());
    return;
  }

  if(!sdk.__AML_AUTH_SAFE_0333__){
    const originalCreateClient=sdk.createClient.bind(sdk);
    sdk.createClient=function(...args){
      const client=originalCreateClient(...args);
      const auth=client?.auth;
      if(auth&&typeof auth.onAuthStateChange==='function'&&!auth.__AML_AUTH_SAFE_0333__){
        const originalOnAuthStateChange=auth.onAuthStateChange.bind(auth);
        auth.onAuthStateChange=function(callback){
          return originalOnAuthStateChange((event,session)=>{
            window.setTimeout(()=>{
              try{callback(event,session);}catch(error){console.error('[AML v0.33.3] deferred auth callback failed',error);}
            },0);
          });
        };
        auth.__AML_AUTH_SAFE_0333__=true;
      }
      return client;
    };
    sdk.__AML_AUTH_SAFE_0333__=true;
  }

  /* Never leave the user indefinitely on the static boot card. */
  window.setTimeout(()=>{
    if(!app)return;
    if(app.querySelector('.shell')||app.querySelector('#login')||app.querySelector('#logout')){
      sessionStorage.removeItem(RECOVERY_KEY);
      return;
    }
    const title=app.querySelector('.auth-card h1')?.textContent?.trim();
    if(title!=='Iniciando sesión segura…')return;

    if(!sessionStorage.getItem(RECOVERY_KEY)){
      console.warn('[AML v0.33.3] auth bootstrap stalled; clearing this portal persisted session once and retrying.');
      sessionStorage.setItem(RECOVERY_KEY,'1');
      clearPersistedSupabaseAuth();
      location.reload();
      return;
    }

    app.innerHTML=`<section class="auth-screen"><div class="auth-card">
      <div class="brand-mark">AML</div><div class="eyebrow">Recuperación de acceso</div>
      <h1>La sesión no respondió</h1>
      <p>El Workbench no pudo completar la validación. Restablece la sesión local de este portal y vuelve a autenticarte con Microsoft.</p>
      <button class="primary" type="button" id="auth-preflight-reset">Restablecer sesión</button>
    </div></section>`;
    document.querySelector('#auth-preflight-reset')?.addEventListener('click',()=>{
      clearPersistedSupabaseAuth();
      sessionStorage.removeItem(RECOVERY_KEY);
      location.reload();
    });
  },9000);
})();
