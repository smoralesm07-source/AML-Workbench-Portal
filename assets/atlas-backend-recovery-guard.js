'use strict';
(function atlasBackendRecoveryGuard(){
  const SUPABASE_ORIGIN='https://ldmtlwzqaqmegedktlxr.supabase.co';
  const ACTIVATED_AT='2026-08-22T19:13:00Z';
  const reason='POSTGRES_CRASH_RECOVERY_LOAD_SHED';

  const state=window.__ATLAS_BACKEND_RECOVERY_MODE__||{
    active:true,
    reason,
    activatedAt:ACTIVATED_AT,
    blockedRequests:0,
    blockedAuthRefresh:0,
    sdkPatched:false,
    fetchPatched:false
  };
  state.active=true;
  state.reason=reason;
  window.__ATLAS_BACKEND_RECOVERY_MODE__=state;

  function requestUrl(input){
    try{
      if(typeof input==='string')return input;
      if(input instanceof URL)return input.href;
      if(input&&typeof input.url==='string')return input.url;
    }catch(_error){}
    return '';
  }

  if(!state.fetchPatched&&typeof window.fetch==='function'){
    const originalFetch=window.fetch.bind(window);
    window.__ATLAS_RECOVERY_ORIGINAL_FETCH__=originalFetch;
    window.fetch=function recoveryIsolatedFetch(input,init){
      const url=requestUrl(input);
      if(url.startsWith(SUPABASE_ORIGIN)){
        state.blockedRequests+=1;
        if(url.includes('/auth/v1/token'))state.blockedAuthRefresh+=1;
        state.lastBlockedAt=new Date().toISOString();
        state.lastBlockedUrl=url.replace(/([?&](?:code|token|access_token|refresh_token)=)[^&]+/gi,'$1[redacted]');
        return Promise.resolve(new Response(JSON.stringify({
          error:'ATLAS_BACKEND_RECOVERY',
          message:'ATLAS mantiene temporalmente aislado Supabase mientras PostgreSQL completa crash recovery.'
        }),{
          status:503,
          statusText:'ATLAS Backend Recovery',
          headers:{'content-type':'application/json','cache-control':'no-store'}
        }));
      }
      return originalFetch(input,init);
    };
    state.fetchPatched=true;
  }

  const sdk=window.supabase;
  if(sdk&&typeof sdk.createClient==='function'&&!sdk.__ATLAS_RECOVERY_CREATE_CLIENT_PATCHED__){
    const originalCreateClient=sdk.createClient.bind(sdk);
    sdk.createClient=function(url,key,options={}){
      const priorAuth=(options&&options.auth)||{};
      const client=originalCreateClient(url,key,{
        ...options,
        auth:{
          ...priorAuth,
          persistSession:true,
          autoRefreshToken:false,
          detectSessionInUrl:false
        }
      });
      const auth=client&&client.auth;
      if(auth){
        try{auth.stopAutoRefresh?.();}catch(_error){}
        if(typeof auth.startAutoRefresh==='function')auth.startAutoRefresh=()=>{};
        if(typeof auth.refreshSession==='function'){
          auth.refreshSession=async()=>({
            data:{user:null,session:null},
            error:new Error('ATLAS_BACKEND_RECOVERY')
          });
        }
        if(typeof auth.signInWithOAuth==='function'){
          auth.signInWithOAuth=async()=>({
            data:{provider:null,url:null},
            error:new Error('ATLAS_BACKEND_RECOVERY')
          });
        }
      }
      return client;
    };
    sdk.__ATLAS_RECOVERY_CREATE_CLIENT_PATCHED__=true;
    state.sdkPatched=true;
  }

  window.AtlasBackendRecovery={
    active:()=>true,
    state:()=>({...state}),
    reason:()=>reason
  };
})();
