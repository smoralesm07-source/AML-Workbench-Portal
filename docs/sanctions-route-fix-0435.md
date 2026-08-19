# Sanciones v12 route fix · ATLAS 0.43.5

Root cause: `v019Navigate()` retained a frozen `v019LegacyLoadSanctions` reference captured before the approved v12 runtime loaded. The approved v12 bundle was present in production, but ordinary navigation bypassed it.

Fix: `atlas-sanctions-v12-route.js` becomes the canonical route authority for `data-view="sanctions"` and programmatic `navigate('sanctions')`, targeting `window.AML_SANCTIONS_V12_APPROVED.reload()` directly.
