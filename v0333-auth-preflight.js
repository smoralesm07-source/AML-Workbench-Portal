'use strict';

/* v0.33.3 · auth dependency preflight.
 * Prevents the portal from remaining indefinitely on the static authorization
 * screen when the Supabase browser SDK cannot be loaded or initialized.
 */
(function authPreflight(){
  const app = document.querySelector('#app');
  const sdkReady = !!(window.supabase && typeof window.supabase.createClient === 'function');
  window.__AML_SUPABASE_SDK_READY__ = sdkReady;

  if (sdkReady) return;

  console.error('[AML v0.33.3] Supabase JS SDK unavailable; authentication bootstrap aborted.');
  if (!app) return;

  app.innerHTML = `
    <section class="auth-screen">
      <div class="auth-card">
        <div class="brand-mark">AML</div>
        <div class="eyebrow">Error de inicialización</div>
        <h1>No fue posible iniciar el acceso seguro</h1>
        <p>El componente de autenticación no pudo cargarse. Recarga la aplicación; si el problema persiste, revisa la disponibilidad del SDK de Supabase.</p>
        <button class="primary" type="button" id="auth-preflight-reload">Recargar</button>
      </div>
    </section>`;

  document.querySelector('#auth-preflight-reload')?.addEventListener('click', () => location.reload());
})();
