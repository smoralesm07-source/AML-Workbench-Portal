# ATLAS · Ingesta Registro Nacional OSFL 0.94

## Propósito

Incorporar a Atlas el padrón fila a fila del Registro Nacional de Personas Jurídicas sin Fines de Lucro (RNPJSFL) del Servicio de Registro Civil e Identificación sin confundir una referencia estadística con una base efectivamente cargada.

El diseño mantiene tres estados explícitos:

- `REFERENCE_ONLY`: Atlas conoce un total oficial de referencia, pero no posee el archivo fila a fila vigente.
- `PARTIAL`: reservado para cargas parciales controladas que nunca sustituyen el maestro nacional.
- `COMPLETE`: el archivo oficial completo superó los controles de calidad y fue promovido atómicamente al maestro.

## Fuente oficial y restricción de acceso

Registro Civil informó en 2025 que el poblamiento del RPJ se publica en su portal de transparencia proactiva como **Planilla RPJ Excel** y que se actualiza quincenalmente. El portal público actual puede interponer un desafío web/CAPTCHA antes del acceso al archivo.

Atlas no intenta eludir ese control. Tampoco utiliza copias históricas encontradas en terceros para declarar un padrón vigente.

## Flujo implementado

1. GitHub Action obtiene un token OIDC con audiencia `atlas-osfl-registry-ingest`.
2. La Edge Function `aml-osfl-registry-ingest` acepta únicamente tokens emitidos para `smoralesm07-source/AML-Workbench-Portal`, rama `main` y eventos permitidos.
3. El archivo oficial se procesa localmente en el runner. Se admiten `.rar`, `.zip`, `.xlsx`, `.xls` y `.csv`.
4. Se detectan encabezados con alias tolerantes y hojas regionales.
5. Cada fila conserva hoja, número de fila y SHA-256 de registro.
6. El RUT original se conserva en `rut_raw`; solo un RUT con dígito verificador válido se utiliza para `MATCH_EXACT`.
7. Las filas se cargan a `aml_osfl_registry_stage`.
8. `aml_finalize_osfl_registry_load_0940` ejecuta el quality gate dentro de una transacción.
9. Solo después de aprobarlo se sustituye el maestro jurídico y se actualiza el snapshot nacional a `COMPLETE`.
10. Se ejecuta conciliación de identidad conservadora contra Entity Hub/OSFL observable.

## Quality gate

Una carga completa se rechaza antes de tocar el maestro si ocurre cualquiera de estas condiciones:

- menos de 250.000 filas observadas;
- menos de 200.000 organizaciones marcadas como vigentes;
- menos de 98% de filas con número de inscripción y nombre legal;
- duplicidad de números de inscripción por sobre la tolerancia definida;
- cuando se informa un total oficial esperado, desviación mayor a 8% entre ese total y las vigentes del archivo.

El archivo completo nunca se promueve parcialmente.

## Matching de identidad

### `MATCH_EXACT`

RUT con checksum válido en Registro Civil y coincidencia exacta en Entity Hub. Confianza 1,00.

### `MATCH_HIGH`

Se utiliza únicamente cuando existe un candidato único:

- nombre normalizado exacto + comuna exacta: 0,97;
- nombre normalizado exacto + región exacta: 0,94.

### `MATCH_PROBABLE`

La función `aml_generate_osfl_registry_probable_links_0941` genera candidatos con:

- similitud nominal `pg_trgm` >= 0,86;
- coincidencia territorial por comuna o región;
- margen mínimo de 0,04 frente al segundo mejor candidato.

Todo `MATCH_PROBABLE` queda como `PENDING_REVIEW`. No existe merge automático por similitud.

## Automatización

Workflow: `.github/workflows/osfl-registry-ingest.yml`.

- Días 1 y 16 de cada mes: prueba disponibilidad del portal oficial y registra el estado de la fuente.
- `workflow_dispatch` con `source_url` + `snapshot_date`: carga completa desde una URL HTTPS directa de `registrocivil.cl`.
- `expected_active_total` es opcional; cuando se entrega activa el control de desviación ±8%.

La descarga por workflow está restringida a host HTTPS de Registro Civil y formatos de archivo permitidos.

## Salud de fuente

`aml_external_source_health.source_code = REGISTRO_CIVIL_OSFL` distingue:

- `watch / unknown / protected_portal`: la fuente oficial existe, pero el acceso automatizado al archivo está protegido; no equivale a fuente caída.
- `healthy / fresh / official_full_file`: un archivo oficial completo fue descargado, validado y promovido correctamente.

## Contratos principales

- `aml_osfl_registry_ingest_run`: auditoría de intentos y métricas de calidad.
- `aml_osfl_registry_stage`: staging de servicio, con RLS y sin políticas de acceso de usuario.
- `aml_osfl_registry_master`: maestro jurídico nacional.
- `aml_osfl_registry_entity_link`: enlaces Atlas ↔ Registro Civil y estado de revisión.
- `aml_v_osfl_registry_ingest_status_current`: estado operativo para auditoría interna.
- `aml_v_osfl_national_monitor_current`: monitor nacional que cambia automáticamente de referencia estadística a padrón cargado cuando el snapshot queda `COMPLETE`.

## Regla metodológica

Vigencia jurídica, existencia de RUT, coincidencia con Entity Hub, pertenencia a R.8 o compatibilidad con sectores de la Ley 19.913 no constituyen por sí mismas señales de riesgo, sospecha, incumplimiento o ilicitud.
