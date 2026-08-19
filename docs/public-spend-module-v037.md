# Gasto Público v13.1 · integración AML Workbench v0.37.0

## Objetivo

Incorpora **Gasto Público** como sección nativa del AML Workbench, utilizando la experiencia analítica v13.1 de Radar Presupuesto Abierto y manteniendo la arquitectura gobernada del portal. No se implementa como iframe: la navegación, el drawer, la auditoría, Entity 360 y la resolución de identidad forman parte del runtime del Workbench.

## Autoridad e interoperabilidad de datos

1. **Radar Presupuesto Abierto** (`Rada_Presupuesto_Abierto/docs/data/spend_years_v1.json`) gobierna el universo multianual de servicios públicos, proveedores, relaciones, meses de pago y marcas propias del radar.
2. **`spend_corrected_v3_status.json`** gobierna el contrato semántico de la materialización. La sección espera `validation=success`, servicio a nivel `PARTIDA_CAPITULO`, métricas de proveedor calculadas sobre `FULL_PRIVATE_RELATION_UNIVERSE` y meses de pago basados en `FECHA_PAGO_AND_MONTO_PAGO`.
3. **`entity_enrichment_v1.json`** aporta el extracto tributario SII selectivo de los RUT observados en el radar. Se usa para situación tributaria, inicio de actividades, nivel de ventas publicado como rango UF, trabajadores, región, actividad principal, ACTECO y marcas SII.
4. **`spend_v131_status.json`** gobierna el contrato UX aprobado: una marca activa a la vez con toggle reversible, sincronización entre vistas y referencia UAF opcional e independiente.
5. **`aml_entities`** gobierna la identidad Workbench. El enlace de un proveedor de Gasto Público a Entity 360 se habilita sólo con coincidencia exacta por RUT. No se usa similitud de nombre para producir identidad gobernada.
6. **`aml_v0205_uaf_sii_reconciliation`** aporta el contexto gobernado de conciliación UAF↔SII una vez resuelta la identidad. La ausencia de coincidencia no equivale a ausencia de inscripción UAF ni a incumplimiento.
7. **`aml_v028_sanctions_with_identity`** aporta el conteo sancionatorio de la entidad resuelta. Una sanción no se transforma por sí sola en evidencia de LA/FT.
8. El enlace inverso **Entity 360 → Gasto Público** usa el RUT de la entidad gobernada. Si ese RUT no aparece en el payload publicado del radar, se trata como cobertura y no como señal adversa.

## Semántica de gasto

- **Servicio público:** `Partida + Capítulo`. Área se conserva como nivel inferior/drill-down y no se presenta como servicio independiente.
- **Proveedor analítico:** `PROVEEDOR=1`, `INTRAESTADO=0` y exclusión nominal pública de alta precisión. Por ello, el universo analítico de proveedor privado no es idéntico al universo `Proveedor/Receptor` de la web fuente.
- **Devengo:** magnitud de gasto/exposición. No es una anomalía.
- **Meses con pagos:** se calculan desde fecha de pago y monto pagado; no desde el mes de devengo.
- **Dependencia:** participación del principal comprador público en el flujo estatal observado del proveedor dentro del contrato publicado.
- **Influencia:** participación del proveedor dentro del flujo a proveedores del comprador público observado.

## Marcas

La sección reutiliza el catálogo gobernado de Radar Presupuesto Abierto y Radar SII, incluyendo cuando existen: `NEW_TO_SERIES_HIGH_SPEND`, `PROVIDER_CONCENTRATION`, `YEAR_END_SPIKE`, `SALES_BAND_JUMP`, `HIGH_SALES_LOW_WORKFORCE`, `RECENT_START_HIGH_SALES`, `WORKFORCE_DROP_STABLE_SALES`, `MAIN_ACTIVITY_CHANGE`, `REGION_CHANGE`, `ACTIVITY_BREADTH`, `REACTIVATION_PATTERN`, `HIGH_SALES_NEGATIVE_EQUITY`, `AMOUNT_OUTLIER`, `POTENTIAL_FRAGMENTATION` y `PAYMENT_DELAY_OUTLIER`.

Las marcas son **criterios explicables de priorización/revisión**. No son hallazgos de irregularidad, incumplimiento ni probabilidad de LA/FT. Las marcas contextuales `Inicio reciente` y `Nuevo en serie` deben mantener esa condición visible. `Nuevo en serie` significa primera aparición dentro de la serie cargada, no necesariamente empresa recién constituida.

## Contrato UX v13.1

- Nueva navegación principal: **Gasto Público**, ubicada en el bloque Radar junto a Territorio.
- Buscador abierto de servicio/proveedor por nombre o RUT.
- Región y selección multiaño: todos, uno o varios años.
- **Referencia UAF** desactivada por defecto y activable a demanda; no altera el universo base cuando está apagada.
- Botones/chips de marcas en el grafo: una marca activa a la vez, segundo clic desfiltra, `Todas` limpia el filtro.
- El filtro de marca sincroniza flujo, KPI, lectura inmediata, ranking de servicios, cambio de escala, dependencia/influencia y tabla.
- En dependencia/influencia la selección resalta el punto sin borrar los demás puntos del contexto.
- Ficha proveedor: flujo con el Estado, meses con pagos, situación tributaria, inicio, ventas como rango UF oficial, trabajadores, región, actividad principal, actividades vigentes, marcas y conexión Workbench.
- Desde una ficha de proveedor puede abrirse **Entity 360** cuando existe identidad exacta.
- Desde **Entity 360** se ofrece abrir Gasto Público usando el RUT gobernado.

## Freshness y degradación

- La UI muestra el último mes de devengo y la última fecha de pago declarados por el payload multianual.
- `source_parity.json` distingue bulk oficial alcanzable de verificación de la página web dinámica. No se declara paridad visual automática cuando la interfaz oficial no es verificable desde Actions.
- Si falla el extracto SII, el análisis de gasto sigue disponible y la ficha muestra la ausencia de materialización tributaria; no rellena valores por inferencia.
- Si falla la resolución Workbench, la ficha conserva la evidencia del radar y señala que la identidad no está materializada.
- Si el contrato corregido del radar no está validado, el workflow de Workbench debe fallar antes de considerar válida la integración.

## Guardrails

- `MISSING_IS_NOT_ZERO`: ausencia de dato no se convierte en cero.
- Gasto/magnitud no equivale a irregularidad.
- Dependencia e influencia son relaciones económicas observadas, no relaciones societarias.
- Ser SO UAF es contexto de rol, no riesgo.
- Ausencia de coincidencia UAF/Entity Hub no se interpreta como incumplimiento.
- Más fuentes o cruces implican mayor visibilidad, no mayor riesgo por sí mismos.
- Los enlaces entre módulos usan identidad exacta; no se crean vínculos gobernados por similitud de nombre.

## Exposición técnica

El runtime expone `window.__AML_PUBLIC_SPEND__` con:

- `version = 13.1`;
- `view = public-spend`;
- `load()`;
- `focusRut(rut)` para interoperabilidad desde Entity 360;
- URLs de los contratos fuente;
- metadatos de autoridad, granularidad, regla de proveedor, identidad, marcas y referencia UAF.
