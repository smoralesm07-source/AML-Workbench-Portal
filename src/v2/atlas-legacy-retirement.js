'use strict';

(function retireLegacyAtlasPortal() {
  const legacyHost = 'smoralesm07-source.github.io';
  const legacyPath = '/AML-Workbench-Portal/';
  const canonicalUrl = 'https://atlasobservatorio.app/';

  if (location.hostname !== legacyHost || !location.pathname.startsWith(legacyPath)) return;

  const destination = new URL(canonicalUrl);
  // Preserve Supabase callback parameters so a stale legacy auth link cannot
  // trap the user in AML-Workbench-Portal. ATLAS Observatorio remains the only
  // interactive login destination.
  destination.search = location.search;
  destination.hash = location.hash;
  location.replace(destination.href);
})();
