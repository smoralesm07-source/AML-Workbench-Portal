# Sanciones v12 · route fix 0.43.5

Root cause: `v019-live.js` captured `loadSanctions` in `v019LegacyLoadSanctions` before the approved v12 runtime loaded. Its navigation function continued calling that frozen historical reference.

Fix: compile `atlas-sanctions-v12-route.js` immediately after `atlas-sanctions-v12-approved-06.js` and immediately before `atlas-current-ui.js`. The route authority intercepts `navigate('sanctions')` and direct navigation clicks and calls `window.AML_SANCTIONS_V12_APPROVED.reload`.

No other ATLAS route is changed.
