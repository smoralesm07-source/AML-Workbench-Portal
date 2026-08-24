(function(){
  'use strict';
  try {
    // El runtime principal puede mantener estas autoridades como bindings
    // globales léxicos. La extensión PEP trabaja sobre window para permanecer
    // aislada del bundle base, por lo que las exponemos sin reimplementarlas.
    if (!Object.prototype.hasOwnProperty.call(window, 'state')) {
      if (typeof state !== 'undefined' && state && typeof state === 'object') {
        Object.defineProperty(window, 'state', {
          configurable: true,
          enumerable: false,
          get: function(){ return state; }
        });
      }
    }
    if (typeof window.navigate !== 'function' && typeof navigate === 'function') {
      window.navigate = function(...args){ return navigate(...args); };
    }
    if (typeof window.shell !== 'function' && typeof shell === 'function') {
      window.shell = function(...args){ return shell(...args); };
    }
  } catch (_error) {
    // Fail soft: el resto de ATLAS debe permanecer operativo si el puente no
    // puede resolver alguna autoridad del runtime.
  }
})();
