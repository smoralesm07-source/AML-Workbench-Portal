(function(){
  'use strict';

  const STARTED_AT=Date.now();
  const TRANSIENT_TITLE='Validando acceso seguro…';
  const CHECK_MS=750;
  const SOFT_NOTICE_MS=12000;
  const RECOVERY_UI_MS=45000;
  let stopped=false;
  let recoveryShown=false;

  function app(){return document.querySelector('#app');}
  function card(){return app()?.querySelector('.auth-card');}
  function titleNode(){return card()?.querySelector('h1');}
  function detailNode(){return card()?.querySelector('p');}
  function currentTitle(){return titleNode()?.textContent?.trim()||'';}
  function resolved(){
    const root=app();
    if(!root)return true;
    return !!(root.querySelector('.shell')||root.querySelector('#login')||currentTitle()==='Acceso pendiente de habilitación');
  }
  function transientTimeoutError(){
    const root=app();
    if(!root)return false;
    const text=(root.textContent||'').toLowerCase();
    return (currentTitle()==='No fue posible abrir el Workbench'||currentTitle()==='No fue posible completar el inicio seguro') &&
      (text.includes('allowlist/rls')||text.includes('autorización/rls')||text.includes('excedió 7 s')||text.includes('excedió 6 s'));
  }
  function markWaiting(message){
    const h=titleNode();
    if(h)h.textContent=TRANSIENT_TITLE;
    const p=detailNode();
    if(p)p.textContent=message;
    card()?.querySelector('.error')?.remove();
  }
  function recoverTransientUi(){
    const t=currentTitle();
    if(t==='Iniciando sesión segura…'){
      markWaiting('Validando Microsoft Entra, autorización y RLS. La sesión se mantiene activa mientras el servicio responde.');
      return true;
    }
    if(transientTimeoutError()){
      markWaiting('La autorización está respondiendo con lentitud. ATLAS mantiene la sesión y espera la validación sin cerrar ni recargar automáticamente.');
      return true;
    }
    return false;
  }
  function escapeHtml(value){
    return String(value??'').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function showRecovery(){
    if(recoveryShown||resolved())return;
    recoveryShown=true;
    const root=app();
    if(!root)return;
    const last=window.__ATLAS_LAST_RUNTIME_ERROR__?.message||'El servicio de autorización continúa respondiendo con lentitud.';
    root.innerHTML=`<section class="auth-screen"><div class="auth-card">
      <div class="brand-mark">ATLAS</div>
      <div class="eyebrow">Acceso seguro</div>
      <h1>La validación está tardando más de lo habitual</h1>
      <p>Tu sesión Microsoft no será eliminada. Puedes reintentar únicamente la validación de ATLAS sin cerrar sesión.</p>
      <p class="error">${escapeHtml(last)}</p>
      <button class="primary" type="button" id="atlas-auth-stability-retry">Reintentar validación</button>
      <button class="ghost" type="button" id="atlas-auth-stability-signout">Cerrar sesión</button>
    </div></section>`;
    document.querySelector('#atlas-auth-stability-retry')?.addEventListener('click',()=>{
      recoveryShown=false;
      markWaiting('Reintentando validación de autorización y RLS…');
      try{
        if(typeof window.boot==='function'){
          Promise.resolve(window.boot()).catch((error)=>console.warn('[ATLAS auth stability] retry failed',error));
        }else{
          location.reload();
        }
      }catch(error){
        console.warn('[ATLAS auth stability] retry failed',error);
        location.reload();
      }
    });
    document.querySelector('#atlas-auth-stability-signout')?.addEventListener('click',()=>{
      if(typeof window.signOut==='function')window.signOut();
      else location.reload();
    });
  }
  function tick(){
    if(stopped)return;
    if(resolved()){
      stopped=true;
      window.__ATLAS_AUTH_STABILITY__={status:'resolved',elapsedMs:Date.now()-STARTED_AT};
      return;
    }
    recoverTransientUi();
    const elapsed=Date.now()-STARTED_AT;
    if(elapsed>=SOFT_NOTICE_MS && currentTitle()===TRANSIENT_TITLE){
      const p=detailNode();
      if(p)p.textContent='Autenticación correcta. Esperando respuesta de autorización/RLS; ATLAS no cerrará ni recargará tu sesión por una demora transitoria.';
    }
    if(elapsed>=RECOVERY_UI_MS)showRecovery();
    window.__ATLAS_AUTH_STABILITY__={status:recoveryShown?'recovery':'waiting',elapsedMs:elapsed};
    if(!stopped)setTimeout(tick,CHECK_MS);
  }

  /* Neutralize legacy short watchdogs without weakening Auth/RLS. */
  recoverTransientUi();
  setTimeout(tick,CHECK_MS);
})();
