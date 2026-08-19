'use strict';

/* ATLAS auth dependency preflight + Supabase auth callback deadlock guard.
 * Stability policy:
 * - never clear a valid persisted session merely because PostgREST is slow;
 * - defer onAuthStateChange callbacks to the next macrotask;
 * - leave the canonical boot/watchdog layer in charge of bounded retries;
 * - preserve Microsoft Entra + Supabase Auth + allowlist/RLS separation.
 */
(function authPreflight(){
  const app=document.querySelector('#app');
  const sdk=window.supabase;
  const sdkReady=!!(sdk&&typeof sdk.createClient==='function');
  window.__AML_SUPABASE_SDK_READY__=sdkReady;

  if(!sdkReady){
    console.error('[ATLAS] Supabase JS SDK unavailable; authentication bootstrap aborted.');
    if(!app)return;
    app.innerHTML=`<section class="auth-screen"><div class="auth-card">
      <div class="brand-mark">ATLAS</div><div class="eyebrow">Error de inicialización</div>
      <h1>No fue posible iniciar el acceso seguro</h1>
      <p>El componente de autenticación no pudo cargarse. Recarga ATLAS; si el problema persiste, revisa la disponibilidad del SDK de Supabase.</p>
      <button class="primary" type="button" id="auth-preflight-reload">Recargar</button>
    </div></section>`;
    document.querySelector('#auth-preflight-reload')?.addEventListener('click',()=>location.reload());
    return;
  }

  if(!sdk.__ATLAS_AUTH_CALLBACK_SAFE__){
    const originalCreateClient=sdk.createClient.bind(sdk);
    sdk.createClient=function(...args){
      const client=originalCreateClient(...args);
      const auth=client?.auth;
      if(auth&&typeof auth.onAuthStateChange==='function'&&!auth.__ATLAS_AUTH_CALLBACK_SAFE__){
        const originalOnAuthStateChange=auth.onAuthStateChange.bind(auth);
        auth.onAuthStateChange=function(callback){
          return originalOnAuthStateChange((event,session)=>{
            window.setTimeout(()=>{
              try{callback(event,session);}catch(error){console.error('[ATLAS] deferred auth callback failed',error);}
            },0);
          });
        };
        auth.__ATLAS_AUTH_CALLBACK_SAFE__=true;
      }
      return client;
    };
    sdk.__ATLAS_AUTH_CALLBACK_SAFE__=true;
  }

  /* Informational only. Do not mutate or clear auth state on a slow backend. */
  window.setTimeout(()=>{
    if(!app)return;
    if(app.querySelector('.shell')||app.querySelector('#login')||app.querySelector('#logout'))return;
    const title=app.querySelector('.auth-card h1')?.textContent?.trim();
    if(title!=='Iniciando sesión segura…')return;
    const p=app.querySelector('.auth-card p');
    if(p)p.textContent='La sesión sigue siendo válida. ATLAS está esperando respuesta de autorización y datos protegidos…';
    window.__ATLAS_AUTH_PREFLIGHT__={stage:'backend-wait',checkedAt:new Date().toISOString()};
  },9000);
})();
