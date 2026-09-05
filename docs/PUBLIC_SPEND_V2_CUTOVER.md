# Gasto Público · Architecture v2 cutover gate

Estado: **PREVIEW / NO PRODUCTIVO**. Esta evidencia habilita el cierre técnico del módulo, pero no modifica `main` ni autoriza por sí sola el corte de producción.

## Objetivo

Reemplazar el runtime GP2 que descarga un JSON agregado desde GitHub y reconstruye índices analíticos en el navegador por una arquitectura `calcular → publicar → mostrar`, con contratos estables, filtros sincronizados, consultas acotadas y autorización gobernada por el backend.

## Contratos v2

- `public_spend_monitor`: monitor liviano de disponibilidad y salud de dominios.
- `budget_context`: KPIs, tendencia, rankings, opciones y contexto activo de Presupuesto Abierto.
- `budget_services`: servicios paginados dentro del contexto activo.
- `budget_providers`: proveedores paginados dentro del contexto activo.
- `budget_flows`: relaciones paginadas y buscables dentro del contexto activo.
- `budget_service_detail`, `budget_provider_detail`, `budget_flow_detail`: fichas que heredan región, clasificador, período y focos activos.

Los filtros de Presupuesto Abierto y las métricas de ChileCompra pertenecen a dominios distintos. ATLAS puede mostrarlos en un monitor común, pero no fusiona métricas con definiciones incompatibles.

## Paridad numérica verificada

Snapshot de detalle usado en la comprobación: `PA-202607-361f8fd38e98` (agosto 2025 a julio 2026).

Se recalcularon de forma independiente, directamente desde las tablas normalizadas, los siguientes siete indicadores:

1. ejecución visible de servicios;
2. flujo materializado a proveedores;
3. cantidad de servicios;
4. cantidad de proveedores;
5. cantidad de relaciones;
6. participación Top-10 de proveedores;
7. HHI de proveedores.

Los siete valores coincidieron exactamente con `budget_context` en siete escenarios representativos:

| Escenario | Resultado |
| --- | --- |
| Global L12 | 7/7 exactos |
| Región Metropolitana | 7/7 exactos |
| Clasificador `GASTOS EN PERSONAL` | 7/7 exactos |
| Julio 2026 | 7/7 exactos |
| Foco por servicio | 7/7 exactos |
| Foco por proveedor | 7/7 exactos |
| Región Metropolitana + julio 2026 | 7/7 exactos |

Adicionalmente, para Región Metropolitana + julio 2026, el primer servicio, proveedor y relación devueltos por las consultas paginadas coincidieron exactamente —identificador y monto contextual— con los respectivos rankings de `budget_context`.

La búsqueda de relaciones por nombre de proveedor también fue comprobada contra el mismo snapshot y la ficha `budget_flow_detail` devolvió exactamente el monto contextual del ranking.

## Diferencia semántica deliberada respecto de GP2

GP2 mezclaba dos bases en un caso particular: al fijar un servicio, el KPI de ejecución podía usar el monto presupuestario del servicio, mientras la serie mensual se construía desde sus flujos proveedor. Architecture v2 corrige esa inconsistencia:

- sin foco proveedor, la tendencia sigue la ejecución mensual de los servicios seleccionados;
- con foco proveedor, la tendencia sigue el flujo mensual materializado hacia ese proveedor.

La diferencia queda documentada como **corrección semántica**, no como error de paridad.

Un caso real del snapshot demuestra por qué esta separación es necesaria: existen servicios con ejecución presupuestaria relevante y sin relaciones proveedor materializadas. V2 conserva ambos hechos sin imputar montos inexistentes a proveedores.

## Rendimiento observado

Una consulta autenticada representativa de `budget_services` para Región Metropolitana + julio 2026, límite 40, registró aproximadamente **24,5 ms de ejecución PostgreSQL** (`EXPLAIN ANALYZE`).

El objetivo no es que todas las consultas tengan el mismo tiempo exacto, sino que el navegador deje de descargar y reindexar el universo completo y reciba sólo el contexto o página requerida.

## Paridad funcional del preview

El preview v2 exige:

- Resumen con región, clasificador, período, servicio y proveedor sincronizados;
- Servicios, Proveedores y Relaciones dentro del mismo contexto activo;
- búsqueda backend en listas; Relaciones busca además por servicio, proveedor y RUT;
- paginación acotada;
- detalles de servicio, proveedor y relación que heredan el foco;
- pestaña Metodología;
- preservación del valor seleccionado si un conjunto de opciones facetadas cambia;
- `FULL_BACKEND` como condición obligatoria de apertura;
- trazabilidad de `traceId` y tiempos del contexto;
- ausencia de `raw.githubusercontent.com` en el runtime v2;
- ChileCompra y Presupuesto Abierto claramente separados por dominio.

## Seguridad

La lectura visible continúa pasando por `atlas-v2-read` con JWT del usuario. El dispatcher público es `SECURITY INVOKER`; las funciones privadas aplican `atlas_v2_private.is_allowed()` y no conceden ejecución a `anon`.

Los advisors ejecutados después de las migraciones no introdujeron una advertencia nueva atribuible a Architecture v2. Permanece deuda preexistente que debe tratarse en una fase separada: `public.aml_is_allowed()` como `SECURITY DEFINER` expuesto, RLS initPlan históricos, leaked-password protection y el FK sin índice de `public.dispositions`.

## Gates de corte

- [x] Contratos backend v2.
- [x] Ingesta y snapshot de detalle Presupuesto Abierto.
- [x] `budget_context` sincronizado.
- [x] Drill-down contextual paginado.
- [x] búsqueda y ficha contextual de relación.
- [x] paridad numérica independiente en contextos representativos.
- [x] metodología y guardrails de interpretación.
- [x] CI de sintaxis, arquitectura y aislamiento de preview.
- [x] preview branch-only; no cambio de manifest productivo.
- [ ] E2E autenticado en navegador: login → Gasto Público → filtros → Servicios → Proveedores → Relaciones → detalle → volver.
- [ ] Verificación de consola sin errores y comportamiento ante respuestas obsoletas/canceladas.
- [ ] Corte controlado a `main`.
- [ ] Retiro del loader GP2 anterior como autoridad de runtime una vez validado el corte.

Hasta completar los dos gates E2E, **el PR debe permanecer draft y `main` sin cambios**.
