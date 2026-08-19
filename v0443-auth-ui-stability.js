'use strict';

/* ATLAS authenticated-shell stability guard.
 * Single responsibility: prevent a transient SIGNED_OUT/renderLogin request from
 * immediately replacing an authenticated shell. It never creates, restores,
 * replays, rotates or submits refresh tokens. Supabase remains the sole token
 * lifecycle authority and RLS remains the data-access boundary.
 */
(function atlasAuthUiStability(){
  if(typeof sb==='undefined' || !sb?.auth || typeof renderLogin!=='function'){
    window.__ATLAS_AUTH_UI_STABILITY__={active:false,stage:'core-auth-unavailable',at:new Date().toISOString()};
    return;
  }

  const originalRenderLogin=renderLogin;
  let generation=0;
  let explicitLogout=false;
  let verificationInFlight=false;

  const wait=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
  const health=(stage,extra={})=>{
    window.__ATLAS_AUTH_UI_STABILITY__={
      active:true,
      authority:'SUPABASE_CLIENT_ONLY',
      refreshTokenReplay:false,
      stage,
      at:new Date().toISOString(),
      ...extra
    };
  };

  async function sessionOnce(){
    try{return (await sb.auth.getSession())?.data?.session||null;}
    catch(_error){return null;}
  }

  async function confirmSessionEnded(ticket){
    for(const delay of [250,750,1500]){
      await wait(delay);
      if(ticket!==generation)return false;
      const session=await sessionOnce();
      if(session?.access_token){
        health('session-preserved',{userId:session.user?.id||null});
        return false;
      }
    }
    return ticket===generation;
  }

  renderLogin=function guardedRenderLogin(...args){
    const shell=document.querySelector('#app .shell');
    const hadAuthenticatedState=!!shell && typeof state!=='undefined' && !!state.user;

    if(explicitLogout || !hadAuthenticatedState){
      health(explicitLogout?'explicit-logout-login':'login-no-authenticated-shell');
      return originalRenderLogin(...args);
    }

    if(verificationInFlight){
      health('duplicate-login-transition-ignored');
      return;
    }

    verificationInFlight=true;
    const ticket=++generation;
    health('verifying-session-before-login',{userId:state.user?.id||null});
    void (async()=>{
      try{
        if(await confirmSessionEnded(ticket)){
          health('session-ended-confirmed',{userId:state.user?.id||null});
          originalRenderLogin(...args);
        }
      }finally{
        if(ticket===generation)verificationInFlight=false;
      }
    })();
  };

  document.addEventListener('click',event=>{
    if(event.target?.closest?.('#logout')){
      explicitLogout=true;
      generation++;
      verificationInFlight=false;
      health('explicit-logout');
    }
  },true);

  /* This listener is observational only. The legacy/core listener remains the
     event consumer; this guard only controls whether renderLogin may replace the
     shell. No auth mutation is performed here. */
  sb.auth.onAuthStateChange((event,session)=>{
    if(session?.access_token || event==='SIGNED_IN' || event==='TOKEN_REFRESHED' || event==='INITIAL_SESSION'){
      explicitLogout=false;
      generation++;
      verificationInFlight=false;
      health('auth-session-active',{event,userId:session?.user?.id||null});
    }else if(event==='SIGNED_OUT'){
      health('signed-out-observed');
    }
  });

  health('installed');
})();
