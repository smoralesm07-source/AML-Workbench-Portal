'use strict';

/* ATLAS AML 0.44.8 · Entity route authority
 * Root cause fixed: v019Navigate retained a closure over the pre-Entity360
 * loadEntities function. The 0.44.7 CSS correctly hid that legacy white landing,
 * which exposed an empty page when the legacy route was still invoked.
 *
 * This late classic authority routes only `entities` to the current governed
 * Entity 360 entry. Every other route is delegated unchanged. It does not touch
 * Auth, Supabase session state, RLS, refresh tokens or analytical semantics.
 */
(function atlasEntityRouteAuthority0448(){
  const RELEASE='0.44.8';
  const BUILD='0448';
  const ENTRY=window.__ATLAS_ENTITY_ENTRY__;
  if(!ENTRY||typeof ENTRY.load!=='function'){
    window.__ATLAS_ENTITY_ROUTE_0448__={active:false,reason:'entity-entry-unavailable',installedAt:new Date().toISOString()};
    return;
  }

  const previousNavigate=typeof window.navigate==='function'?window.navigate:null;
  const entityLoad=(...args)=>ENTRY.load(...args);

  async function navigate0448(view,...args){
    if(view==='entities')return entityLoad(...args);
    if(previousNavigate)return previousNavigate(view,...args);
  }

  /* Global classic identifiers and window properties are pinned together because
     historical shell listeners call the identifier `navigate` dynamically. */
  try{navigate=navigate0448;}catch(_error){}
  window.navigate=navigate0448;
  try{loadEntities=entityLoad;}catch(_error){}
  window.loadEntities=entityLoad;

  ENTRY.version='0448';
  ENTRY.release=RELEASE;
  ENTRY.routeAuthority='ENTITY360_ROUTE_AUTHORITY_0448';
  ENTRY.legacyLandingBypassed=true;

  window.__ATLAS_ENTITY_ROUTE_0448__={
    active:true,
    release:RELEASE,
    build:BUILD,
    authority:'ENTITY360_ROUTE_AUTHORITY_0448',
    entitiesRoute:'CURRENT_ENTRY_LOAD',
    legacyCapturedLoaderBypassed:true,
    authMutation:false,
    installedAt:new Date().toISOString()
  };
})();
