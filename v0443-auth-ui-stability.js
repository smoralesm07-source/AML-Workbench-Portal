'use strict';

/* ATLAS 0.44.3 authenticated-shell stability guard.
 * A transient/local SIGNED_OUT event must not immediately replace a working,
 * RLS-authorized shell with the login screen. The canonical Supabase client
 * remains the session authority; this guard never creates or replays tokens.
 */
(function atlasAuthUiStability(){
  if(typeof sb==='undefined' || !sb?.auth || typeof renderLogin!=='function'){
    window.__ATLAS_AUTH_UI_STABILITY__={active:false,stage:'core-auth-unavailable',at:new Date().toISOString()};
    return;
  }

  const originalRenderLogin=renderLogin;
  let generation=0;
  let explicitLogout=false;

  const wait=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
  const health=(stage,extra={})=>{
    window.__ATLAS_AUTH_UI_STABILITY__={active:true,stage,at:new Date().toISOString(),...extra};
  };

  async function getLocalSession(){
    try{return (await sb.auth.getSession())?.data?.session||null;}
    catch(_error){return null;}
  }

  async function confirmSignedOut(ticket){
    for(const delay of [250,750,1500]){
      await wait(delay);
      if(ticket!==generation)return false;
      const session=await getLocalSession();
      if(session?.access_token){
        health('session-preserved-after-transient-signout',{userId:session.user?.id||null});
        return false;
      }
    }
    return ticket===generation;
  }

  renderLogin=function guardedRenderLogin(...args){
    const shell=document.querySelector('#app .shell');
    const hadAuthenticatedState=!!shell && typeof state!=='undefined' && !!state.user;

    if(explicitLogout || !hadAuthenticatedState){
      health(explicitLogout?'explicit-login-render':'login-render-no-active-shell');
      return originalRenderLogin(...args);
    }

    const ticket=++generation;
    health('login-render-deferred',{reason:'authenticated-shell-present',userId:state.user?.id||null});
    void (async()=>{
      if(await confirmSignedOut(ticket)){
        health('confirmed-session-ended',{userId:state.user?.id||null});
        originalRenderLogin(...args);
      }
    })();
  };

  document.addEventListener('click',event=>{
    if(event.target?.closest?.('#logout')){
      explicitLogout=true;
      generation++;
      health('explicit-logout');
    }
  },true);

  sb.auth.onAuthStateChange((event,session)=>{
    if(session?.access_token || event==='SIGNED_IN' || event==='TOKEN_REFRESHED' || event==='INITIAL_SESSION'){
      explicitLogout=false;
      generation++;
      health('auth-session-active',{event,userId:session?.user?.id||null});
    }
  });

  health('installed');
})();
