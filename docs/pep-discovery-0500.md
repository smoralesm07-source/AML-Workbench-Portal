# ATLAS AML 0.50.0 — Personas, PEP, propiedad y compras

## Propósito

`Personas y control` es una vista analítica de descubrimiento dentro de **Análisis**. No es una cola de trabajo, no crea casos operativos y no modifica la navegación ni el comportamiento de Explorar, Radares u otras vistas.

Integra el contrato `ATLAS_PEP_DISCOVERY_LATEST_V1` producido por `Intelligence_Fusion_Layer`, que consolida resolución PEP, control declarado, beneficiario final económico directo/indirecto y órdenes de compra públicas.

## Arquitectura UX

La lectura sigue una progresión estable y explicable:

1. **Resolver PEP** — personas que cumplen categorías gobernadas de Circular UAF 62.
2. **Propiedad** — sociedades con control declarado o BF económico calculado con porcentajes explícitos.
3. **Compras** — proveedores públicos encontrados por RUT exacto en los períodos efectivamente cargados.
4. **Lectura** — relaciones consolidadas en `CONTEXT` o `REVIEW`.

La cabecera resume esta cadena como flujo visual. A continuación aparecen KPIs, mezcla de vínculos, cobertura temporal, materialidad de órdenes, filtros interactivos y fichas de detalle.

## Elementos gráficos

- Funnel de cuatro etapas PEP → propiedad → compras → lectura.
- KPIs de PEP resueltas, BF downstream, proveedores con BF PEP, contexto, revisión y órdenes cargadas.
- Donut de composición: BF directo, BF indirecto y control declarado.
- Cobertura mensual ChileCompra con estados de período.
- Barras de materialidad de órdenes en los casos visibles.
- Tarjetas filtrables por texto, nivel, vínculo y señal.
- Drawer investigativo con camino de propiedad, porcentaje BF, compras y guardrails.

Los gráficos usan CSS/DOM nativo y tokens visuales de ATLAS: no agregan nuevas dependencias ni librerías de gráficos.

## Semántica AML

- La condición PEP **no es adversa** y aporta cero por sí misma a un score AML.
- `PEP-01`, `PEP-02` y `PEP-05` son relación/contexto y no elevan `review_level`.
- Sólo `PEP-03` y `PEP-04` llevan la lectura a `REVIEW`.
- El BF económico se calcula únicamente con porcentajes explícitos; control declarado sin porcentaje no entra a la matemática BF.
- No se realizan joins por nombre para relacionar sociedades con compras públicas.
- Los montos ChileCompra representan compromisos de órdenes, no evidencia de pago.
- La ausencia de una coincidencia se limita a los períodos cargados; `missing` nunca equivale automáticamente a cero.
- La prioridad de compra es triage analítico, no probabilidad de delito ni riesgo LA/FT.

## Seguridad y privacidad

El frontend **no publica** el universo persona–empresa como JSON de GitHub Pages.

El canal productivo es `public.aml_pep_discovery_snapshot` en Supabase:

- RLS habilitado;
- sin `SELECT` para `anon`;
- `SELECT` para `authenticated` únicamente cuando el usuario existe habilitado en `aml_allowed_users`;
- sin permisos de escritura para el navegador;
- sólo existe la clave lógica `latest`;
- contrato de payload restringido a `ATLAS_PEP_DISCOVERY_LATEST_V1`.

La UI mantiene el payload sólo en memoria durante la sesión. No utiliza `localStorage` ni otro cache persistente para datos persona–empresa.

El DDL reproducible se conserva en `sql/atlas_v0500_pep_discovery_snapshot.sql`.

## Integración y aislamiento

La vista usa `pep-discovery` como view id e instala una extensión post-runtime event-driven. Envuelve `shell()` y `navigate()` sólo para interceptar su propia vista; cualquier otra navegación se delega intacta al runtime vigente.

No utiliza `MutationObserver` autosostenido. Tampoco altera los arreglos centrales del runtime compilado. CSS y JS están completamente aislados bajo `.atlas-pep` / `AtlasPepDiscovery` y se publican como assets actuales, siguiendo el patrón de extensiones post-runtime ya usado por ATLAS.

Si el feed no existe, RLS deniega acceso o la consulta falla, la vista entra a **degradación local** y muestra un mensaje operativo. No bloquea sesión, shell, navegación ni otros radares.

## Rendimiento

- carga del snapshot sólo al entrar a la vista;
- una única fila `latest` desde Supabase;
- cache únicamente en memoria durante la sesión;
- filtros locales sobre los `top_cases` materializados;
- sin polling ni observadores permanentes;
- sin dependencias visuales adicionales.

## Accesibilidad y responsive

- tarjetas activables con teclado;
- foco visible;
- labels y `aria` en navegación y filtros;
- layouts adaptativos a 1180, 760 y 480 px;
- soporte `prefers-reduced-motion`;
- contraste heredado del sistema de temas ATLAS.

## Estado del dato

Al construir ATLAS 0.50.0 la tabla segura está preparada pero no se carga con información sintética. El primer snapshot real depende de la materialización de `pep_discovery_latest.json` en `Intelligence_Fusion_Layer`. Mientras la incidencia de ejecución de Actions de ese repositorio permanezca activa, la vista mostrará el estado degradado sin inventar resultados.
