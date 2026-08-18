'use strict';

/* AML Workbench v0.33.3 · Supabase Auth deadlock guard.
 * Supabase documents a deadlock when async API work is started directly from
 * onAuthStateChange. The legacy app callback invokes boot(), which performs
 * getSession/PostgREST. Wrap every auth callback and execute it on the next
 * macrotask, outside the internal auth lock.
 */
(function installAuthDeadlockGuard(){
  const sdk=window.supabase;
  if(!sdk||typeof sdk.createClient!=='function')return;
  if(sdk.__AML_AUTH_SAFE_0333__)return;
  const originalCreateClient=sdk.createClient.bind(sdk);
  sdk.createClient=function(...args){
    const client=originalCreateClient(...args);
    const auth=client?.auth;
    if(auth&&typeof auth.onAuthStateChange==='function'&&!auth.__AML_AUTH_SAFE_0333__){
      const originalOnAuthStateChange=auth.onAuthStateChange.bind(auth);
      auth.onAuthStateChange=function(callback){
        return originalOnAuthStateChange((event,session)=>{
          window.setTimeout(()=>{
            try{callback(event,session);}catch(error){console.error('Deferred auth callback failed',error);}
          },0);
        });
      };
      auth.__AML_AUTH_SAFE_0333__=true;
    }
    return client;
  };
  sdk.__AML_AUTH_SAFE_0333__=true;
})();
