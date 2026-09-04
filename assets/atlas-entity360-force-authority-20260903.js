'use strict';

/* ATLAS AML · Entidad 360 retired compatibility marker · 2026-09-04
 *
 * The former force authority dynamically reloaded an older Executive 360 build
 * and maintained a permanent DOM observer/poller. That could resurrect stale
 * Entity 360 surfaces after the current workspace had already rendered.
 *
 * Entidad 360 is now compiled once from atlas-runtime-manifest.json using
 * ENTITY360_HISTORY_INTELLIGENCE before v0447 captures the entry authority.
 * This file intentionally performs no rendering, loading, polling or mutation.
 */
(function retireAtlasEntity360ForceAuthority(){
  window.__ATLAS_ENTITY360_FORCE_AUTHORITY__={
    active:false,
    retired:true,
    replacement:'ENTITY360_HISTORY_INTELLIGENCE',
    policy:'SINGLE_COMPILED_AUTHORITY_NO_LATE_RELOAD',
    build:'20260904-e360-retired1',
    retiredAt:new Date().toISOString()
  };
})();
