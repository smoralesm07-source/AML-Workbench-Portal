(function(){
  'use strict';
  try {
    if (Object.prototype.hasOwnProperty.call(window, 'state')) return;
    if (typeof state === 'undefined' || !state || typeof state !== 'object') return;
    Object.defineProperty(window, 'state', {
      configurable: true,
      enumerable: false,
      get: function(){ return state; }
    });
  } catch (_error) {
    // Fail soft: the rest of ATLAS must remain unaffected if the bridge is unavailable.
  }
})();
