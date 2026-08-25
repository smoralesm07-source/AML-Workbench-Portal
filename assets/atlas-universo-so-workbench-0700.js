'use strict';
/* ATLAS AML · Universo SO · Hotfix 0.70.1
 * La capa Workbench 0.70 se desactiva temporalmente para preservar la
 * disponibilidad de la sección Universo SO mientras se reimplementa su
 * montaje sin observers ni doble carga. El módulo base 0.56–0.67 conserva
 * toda la funcionalidad de padrón, potenciales y expediente.
 */
(function atlasUniversoSOHotfix0701(){
  window.__ATLAS_UNIVERSO_SO_0700__={
    active:false,
    version:'0.70.1-hotfix',
    reason:'workbench-disabled-for-stable-base-render',
    safeFallback:true
  };
})();
