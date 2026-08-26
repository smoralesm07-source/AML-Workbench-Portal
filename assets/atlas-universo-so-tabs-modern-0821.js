'use strict';
/* ATLAS AML · Universo SO tabs compatibility shim 0.82.6
 * Hotfix de estabilidad: esta capa deja de observar o mutar el DOM.
 * La navegación vuelve a quedar bajo la autoridad del render canónico de Universo SO
 * y del módulo de Gestión candidatos. Sin observers, polling, microtasks ni timers.
 */
(function atlasUniversoSOTabsCompatibility0826(){
  if(window.AtlasUniversoSOTabsStable0826)return;
  const api={
    version:'0.82.6',
    mode:'PASSIVE_COMPATIBILITY_ONLY',
    reconcile:()=>false,
    decorate:()=>false
  };
  window.AtlasUniversoSOTabsStable0826=api;
  window.AtlasUniversoSOTabsStable0825=api;
  window.AtlasUniversoSOTabsStable0824=api;
  window.AtlasUniversoSOTabsModern0823=api;
  window.AtlasUniversoSOTabsModern0822=api;
})();
