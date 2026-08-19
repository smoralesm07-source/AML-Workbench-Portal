(function(){
  'use strict';

  const RELEASE='0.42.2';
  const BUILD='0422';
  const AUTH_TIMEOUT=6500;
  const ACCESS_TIMEOUT=6500;
  const HARD_WATCHDOG=8500;

  function now(){return new Date().toISOString();}
  function status(stage,extra={}){
    window.__ATLAS_AUTH_BOOT__={release:RELEASE,build:BUILD,stage,checkedAt:now(),...extra};
  }
  function timeout(promise,ms,label){
    let timer;
    const guard=new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`${label} excedió ${Math.round(ms/1000)} s.`)),ms);});
    return Promise.race([Promise.resolve(promise),guard]).finally(()=>clearTimeout(timer));
  }
  function hasResolvedUi(){
    const host=document.querySelector('#app');
    if(!host)return true;
    return !!(host.querySelector('.shell')||host.querySelector('#login')||host.querySelector('#logout')||host.querySelector('.error'));
  }
  function isStaticBoot(){
    const title=document.querySelector('#app .auth-card h1')?.textContent?.trim()||'';
    return title==='Iniciando sesión segura…';
  }
  function setBootDetail(text){
    const p=document.querySelector('#app .auth-card p');
    if(p&&isStaticBoot()&&p.textContent!==text)p.textContent=text;
  }
  function diagnostic(error,stage){
    const message=String(error?.message||error||'Error desconocido');
    status('error',{failedStage:stage,error:message});
    console.error('[ATLAS 0.42.2] auth bootstrap failed',stage,error);
    if(typeof renderError==='function'){
      renderError(`${stage}: ${message}`);
      return;
    }
    const host=document.querySelector('#app');
    if(!host)return;
    host.innerHTML=`<section class="auth-screen"><div class="auth-card"><div class="brand-mark">ATLAS</div><div class="eyebrow">Diagnóstico de acceso</div><h1>No fue posible completar el inicio seguro</h1><p>${stage}: ${message}</p><button class="primary" type="button" id="atlas-auth-retry">Reintentar</button></div></section>`;
    document.querySelector('#atlas-auth-retry')?.addEventListener('click',()=>location.reload());
  }

  async function rescueBoot(){
    if(hasResolvedUi())return;
    let stage='session';
    try{
      status('checking-session');
      setBootDetail('Validando sesión Microsoft Entra y Supabase Auth…');
      if(typeof sb==='undefined'||!sb?.auth)throw new Error('Cliente Supabase no disponible.');

      const authResult=await timeout(sb.auth.getSession(),AUTH_TIMEOUT,'Validación de sesión Supabase');
      if(authResult?.error)throw authResult.error;
      const session=authResult?.data?.session||null;
      if(!session){
        status('login-required');
        if(typeof renderLogin==='function')return renderLogin();
        throw new Error('No existe sesión activa y no está disponible la pantalla de acceso.');
      }

      if(typeof state==='undefined')throw new Error('Estado de aplicación no disponible.');
      state.user=session.user;

      stage='allowlist/RLS';
      status('checking-access',{userId:session.user?.id||null});
      setBootDetail('Sesión válida. Verificando autorización y RLS…');
      const accessResult=await timeout(
        sb.from('aml_allowed_users').select('role,enabled').eq('user_id',state.user.id).maybeSingle(),
        ACCESS_TIMEOUT,
        'Validación de autorización/RLS'
      );
      if(accessResult?.error)throw accessResult.error;
      if(!accessResult?.data?.enabled){
        status('access-pending');
        if(typeof renderPending==='function')return renderPending();
        throw new Error('Cuenta autenticada sin habilitación vigente.');
      }
      state.access=accessResult.data;

      stage='render';
      status('authorized',{role:state.access?.role||'viewer'});
      setBootDetail('Autorización confirmada. Abriendo ATLAS AML…');

      /* Critical fix: audit is best-effort and MUST NOT block first paint. */
      if(typeof auditSession==='function'){
        Promise.resolve().then(()=>auditSession()).catch(error=>console.warn('[ATLAS] session audit deferred/failed',error));
      }

      if(typeof loadOverview!=='function')throw new Error('Vista principal no disponible.');
      const overviewPromise=loadOverview();
      status('rendered',{role:state.access?.role||'viewer'});
      Promise.resolve(overviewPromise).catch(error=>{
        console.error('[ATLAS] overview hydration failed after shell render',error);
        if(typeof showContentError==='function')showContentError(error);
      });
    }catch(error){
      diagnostic(error,stage);
    }
  }

  window.addEventListener('error',event=>{
    window.__ATLAS_LAST_RUNTIME_ERROR__={message:event.message||String(event.error||'error'),source:event.filename||null,line:event.lineno||null,column:event.colno||null,at:now()};
  });
  window.addEventListener('unhandledrejection',event=>{
    window.__ATLAS_LAST_RUNTIME_ERROR__={message:String(event.reason?.message||event.reason||'unhandled rejection'),source:'promise',at:now()};
  });

  status('scheduled');
  setTimeout(()=>void rescueBoot(),0);
  setTimeout(()=>{
    if(!hasResolvedUi()&&isStaticBoot()){
      const last=window.__ATLAS_LAST_RUNTIME_ERROR__;
      diagnostic(new Error(last?.message||'El arranque no completó ninguna transición de interfaz.'),'watchdog');
    }
  },HARD_WATCHDOG);

  window.AtlasAuthBootstrap={release:RELEASE,build:BUILD,retry:rescueBoot,status:()=>window.__ATLAS_AUTH_BOOT__};
})();
