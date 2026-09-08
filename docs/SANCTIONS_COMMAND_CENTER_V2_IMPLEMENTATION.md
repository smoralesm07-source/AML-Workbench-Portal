# Implementación

La superficie usa exclusivamente DOM APIs; no reintroduce `innerHTML`, `MutationObserver`, llamadas directas a tablas Core ni URLs raw. La autenticación federada mantiene el proveedor del token Core en `AtlasV2Session.getAccessToken(...)` y las lecturas viajan por `atlas-v2-read` con operación `sanctions_query`.

El backend `public.atlas_v2_sanctions_query(jsonb)` conserva allowlist y expone cuatro lecturas: `overview`, `dashboard`, `events` y `detail`. Los filtros de la interfaz se propagan tanto a los agregados como a la tabla para que KPIs y gráficos compartan contexto.
