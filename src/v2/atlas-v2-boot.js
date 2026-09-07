'use strict';

(function bootAtlasV2() {
  function mount() {
    const root = document.getElementById('atlas-v2-root');
    if (!root) throw new Error('ATLAS v2 root is missing');
    if (!window.AtlasV2Shell?.mount) throw new Error('ATLAS v2 shell failed to load');
    window.AtlasV2Shell.mount(root);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
