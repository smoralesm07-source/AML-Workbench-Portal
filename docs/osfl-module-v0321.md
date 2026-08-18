# OSFL Intelligence · v0.32.1

## Propósito

OSFL es una superficie especializada de AML Workbench para explorar el universo canónico de organizaciones sin fines de lucro, detectar concentraciones y cambios, priorizar revisión mediante IPA 3.0 y profundizar hasta Entity 360. La pertenencia al universo OSFL no constituye una señal adversa.

## Universo visible

La interfaz utiliza un único universo analítico: 37.146 entidades OSFL canónicas presentes en el snapshot Radar_OSFL. Las reclasificaciones de calidad no se mezclan en los denominadores gráficos. Los controles redundantes “OSFL sustantivas” y “Perfiles enlazados” se retiran de la cabecera.

## Navegación y filtros

El mapa utiliza geometrías regionales y una selección regional común. Al seleccionar una región se actualizan de manera coordinada: mapa/ranking, actividad, distribución IPA3, trayectoria SII, exposición pública y explorador de organizaciones. La selección territorial nunca se transfiere como atributo de riesgo a una entidad individual.

## IPA 3.0

IPA 3.0 v0.4-shadow continúa siendo prioridad analítica, no probabilidad LA/FT. Las bandas son controles exactos de filtro y el panel muestra entidades priorizadas navegables a OSFL 360. R.8, pertenencia OSFL y recepción de recursos públicos tienen aporte directo IPA igual a cero salvo que otra marca gobernada establezca un fenómeno independiente.

## Trayectoria SII

La capa regional resume 2020–2024 con cobertura entity-year, tramo mediano de ventas, trabajadores, movimientos de dos o más tramos y cambios de actividad. OSFL 360 presenta la trayectoria anual individual. Los datos SII corresponden a tramos/rangos de ventas; la interfaz no inventa ni estima un monto exacto de ventas a partir del tramo.

## Exposición pública

La vista distingue Ley 21.440, Registro Ley 19.862, doble registro, condición de sujeto obligado UAF, sanciones reconciliadas y cribado FATF R.8. Estas condiciones son contexto/exposición y no equivalen a riesgo, incumplimiento ni conducta sospechosa.

## Presupuesto Abierto en OSFL 360

La ficha consulta por RUT la cola pública materializada por Radar Presupuesto Abierto y agrupa las transacciones señalizadas por organismo, monto, período y tipología de señal. Este cruce permite saber si el RUT aparece como proveedor o receptor en transacciones presentes en la cola de señales.

La cobertura NO equivale al total histórico de recursos públicos recibidos: una ausencia en la cola no demuestra que la OSFL nunca haya recibido recursos del Estado, y un match no acredita irregularidad. El Radar Presupuesto Abierto mantiene su propia metodología de prioridad investigativa y sus señales siguen siendo evidencia contextual hasta una integración canónica transaccional completa.

## Rendimiento y frescura

La carga normal utiliza snapshots rápidos de IPA3, OSFL, portada y agregados regionales. `pg_cron` ejecuta cada dos minutos una comprobación condicional de frescura; el trabajo pesado sólo se ejecuta cuando una fuente estructural es más nueva que el snapshot runtime. Auditoría distingue fuente estructural, runtime y contexto no bloqueante.

## Seguridad

Las tablas runtime OSFL usan RLS y autorización por `aml_allowed_users`. `anon` no recibe acceso; `authenticated` dispone sólo de lectura. Los snapshots no se publican como JSON enriquecido en GitHub Pages.
