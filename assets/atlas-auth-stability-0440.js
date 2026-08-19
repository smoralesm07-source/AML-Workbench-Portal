(function(){
  'use strict';

  const STARTED_AT=Date.now();
  const TRANSIENT_TITLE='Validando acceso seguro…';
  const CHECK_MS=750;
  const SOFT_NOTICE_MS=12000;
  const PENDING_RECHECK_TIMEOUT_MS=20000;
  const RECOVERY_UI_MS=45000;
  let stopped=false;
  let recoveryShown=false;
  let pendingCheckStarted=false;

  function app(){return document.querySelector('#app');}
  function card(){return app()?.querySelector('.auth-card');}
  function titleNode(){return card()?.querySelector('h1');}
  function detailNode(){return card()?.querySelector('p');}
  function currentTitle(){return titleNode()?.textContent?.trim()||'';}
  function isPendingTitle(){return currentTitle()==='Acceso pendiente de habilitación';}
  function resolved(){
    const root=app();
    if(!root)return true;
    return !!(root.querySelector('.shell')||root.querySelector('#login')||window.__ATLAS_CONFIRMED_PENDING__===true);
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
  function withTimeout(promise,ms){
    let timer;
    const guard=new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`Validación de autorización excedió ${Math.round(ms/1000)} s.`)),ms);});
    return Promise.race([Promise.resolve(promise),guard]).finally(()=>clearTimeout(timer));
  }
  async function recheckPending(){
    if(pendingCheckStarted||!isPendingTitle())return;
    pendingCheckStarted=true;
    markWaiting('Confirmando si la pantalla de habilitación corresponde a una cuenta realmente pendiente o a una demora transitoria del backend…');
    try{
      if(typeof sb==='undefined'||!sb?.from||typeof state==='undefined'||!state?.user?.id)throw new Error('El contexto autenticado aún no está disponible.');
      const result=await withTimeout(
        sb.from('aml_allowed_users').select('role,enabled').eq('user_id',state.user.id).maybeSingle(),
        PENDING_RECHECK_TIMEOUT_MS
      );
      if(result?.error)throw result.error;
      const access=result?.data||null;
      if(access?.enabled){
        state.access=access;
        window.__ATLAS_CONFIRMED_PENDING__=false;
        if(typeof auditSession==='function')Promise.resolve().then(()=>auditSession()).catch((error)=>console.warn('[ATLAS auth stability] deferred audit failed',error));
        if(typeof loadOverview!=='function')throw new Error('Vista principal no disponible tras validar autorización.');
        await Promise.resolve(loadOverview());
        return;
      }
      window.__ATLAS_CONFIRMED_PENDING__=true;
      if(typeof renderPending==='function')renderPending();
    }catch(error){
      window.__ATLAS_LAST_RUNTIME_ERROR__={message:String(error?.message||error),source:'auth-stability-pending-recheck',at:new Date().toISOString()};
      markWaiting('La autorización sigue respondiendo con lentitud. ATLAS conservará la sesión y no recargará automáticamente.');
    }
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
      pendingCheckStarted=false;
      window.__ATLAS_CONFIRMED_PENDING__=false;
      markWaiting('Reintentando validación de autorización y RLS…');
      try{
        if(typeof boot==='function')Promise.resolve(boot()).catch((error)=>console.warn('[ATLAS auth stability] retry failed',error));
        else location.reload();
      }catch(error){
        console.warn('[ATLAS auth stability] retry failed',error);
        location.reload();
      }
    });
    document.querySelector('#atlas-auth-stability-signout')?.addEventListener('click',()=>{
      if(typeof signOut==='function')signOut();
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
    if(isPendingTitle())void recheckPending();
    recoverTransientUi();
    const elapsed=Date.now()-STARTED_AT;
    if(elapsed>=SOFT_NOTICE_MS && currentTitle()===TRANSIENT_TITLE){
      const p=detailNode();
      if(p)p.textContent='Autenticación correcta. Esperando respuesta de autorización/RLS; ATLAS no cerrará ni recargará tu sesión por una demora transitoria.';
    }
    if(elapsed>=RECOVERY_UI_MS)showRecovery();
    window.__ATLAS_AUTH_STABILITY__={status:recoveryShown?'recovery':'waiting',elapsedMs:elapsed,pendingRecheck:pendingCheckStarted};
    if(!stopped)setTimeout(tick,CHECK_MS);
  }

  /* Neutralize legacy short watchdogs without weakening Entra, allowlist or RLS. */
  recoverTransientUi();
  if(isPendingTitle())void recheckPending();
  setTimeout(tick,CHECK_MS);
})();
