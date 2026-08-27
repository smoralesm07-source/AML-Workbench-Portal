# ATLAS · Monitor Nacional OSFL 0.93.1

## Objetivo

Transformar la sección OSFL desde un universo tributario observable a un monitor nacional que separe explícitamente:

1. **Universo jurídico**: personas jurídicas sin fines de lucro vigentes en el Registro Civil.
2. **Universo observable Atlas**: OSFL con identidad y huella en las fuentes integradas actuales.
3. **Universo enriquecido**: OSFL observables con dos o más fuentes disponibles.
4. **Puente Ley 19.913**: relación registral o compatibilidad de actividad con sectores sujetos a la Ley 19.913.
5. **Inteligencia AML**: señales analíticas y tratamiento de evidencia, separadas de la condición jurídica o regulatoria.

## Fuente nacional

La referencia inicial es de **363.703 organizaciones vigentes al 31-08-2025**, informada por la División de Organizaciones Sociales a partir de una descarga del Registro Nacional de Personas Jurídicas sin Fines de Lucro del Servicio de Registro Civil e Identificación.

El portal del Registro Civil requiere interacción web para obtener el archivo. Mientras el padrón fila a fila no esté incorporado, el monitor utiliza `REFERENCE_ONLY`: el total nacional se usa como denominador de cobertura, pero nunca se presenta como si Atlas tuviera 363.703 registros individualizados.

Estados de ingestión:

- `REFERENCE_ONLY`: existe total oficial, pero no padrón fila a fila en Atlas.
- `PARTIAL`: existe una carga parcial; el total oficial sigue siendo el denominador nacional.
- `COMPLETE`: el padrón completo está cargado; el monitor puede calcular cobertura, tipos y territorio directamente desde el maestro.

## Contratos de datos

### `aml_osfl_registry_source_snapshot`
Control de corte, fuente, total oficial y estado de ingestión.

### `aml_osfl_registry_master`
Maestro jurídico del Registro Civil. Campos previstos: número de inscripción, nombre legal, RUT cuando exista, origen, comuna, región, dirección, tipo, clasificación, fechas, estado y vigencia.

### `aml_osfl_registry_entity_link`
Resolución de identidad Registro Civil ↔ Entity Hub. Estados previstos:

- `MATCH_EXACT`: RUT exacto validado.
- `MATCH_HIGH`: identidad de alta confianza.
- `MATCH_PROBABLE`: candidato probabilístico que requiere revisión.
- `UNMATCHED`: sin contraparte observable.
- `REJECTED`: candidato descartado.

La ausencia de match no es una señal adversa.

## Puente Ley 19.913

La vista `aml_v_osfl_law19913_bridge_current` cruza OSFL observables con los universos ya gobernados de sujetos obligados y potenciales sujetos.

Clases principales:

- `DIRECT_OBLIGATED`: coincidencia exacta de identidad con sujeto obligado UAF registrado.
- `POTENTIAL_SUBJECT`: coincidencia con el motor Atlas de potenciales sujetos.
- `AML_ANALYTIC_SIGNAL`: señal analítica Atlas sin inferencia de calidad regulatoria.
- `FATF_R8_CONTEXT`: contexto funcional Recomendación 8; no puntúa por sí solo.
- `GENERAL_OSFL`: sin relación directa observada en las fuentes actuales.

### Estratificación de potenciales sujetos OSFL

No todas las coincidencias del motor general tienen la misma fuerza para una OSFL. Se agrega `potential_relevance_tier`:

- `HIGH`: giro **principal** característico y detección A/B.
- `MEDIUM`: detección A/B con evidencia menos directa, por ejemplo giro secundario.
- `EXPLORATORY`: coincidencia amplia que debe corroborarse antes de priorizar.

Esta estratificación evita que una OSFL que administra o arrienda inmuebles incidentalmente sea tratada de la misma manera que una organización cuya actividad principal observada es característica de un sector regulado.

## Corte inicial validado

Sobre 36.843 OSFL observables en Atlas:

- 36.512 están enriquecidas con dos o más fuentes.
- 11 coinciden con sujetos obligados UAF registrados.
- 2.522 coinciden con el universo amplio de potenciales sujetos.
- De esas 2.522: 140 son `HIGH`, 640 `MEDIUM` y 1.742 `EXPLORATORY`.
- **Núcleo 19.913**: 151 = 11 directas + 140 potenciales `HIGH`.
- **Perímetro de revisión**: 791 = directas + `HIGH` + `MEDIUM`.
- Cobertura observable frente al universo jurídico oficial de referencia: 10,13%.

## Reglas de interpretación

- Vigencia jurídica **no implica** actividad económica.
- Ser candidato FATF R.8 **no implica** riesgo o sospecha.
- Coincidir con un sector o giro de la Ley 19.913 **no prueba** obligación legal; es una hipótesis de aplicabilidad que debe corroborarse.
- Ser sujeto obligado UAF **no es** una señal adversa.
- Falta de información **no equivale** a bajo riesgo.
- Prioridad analítica, cobertura de evidencia y condición regulatoria deben permanecer separadas.

## Siguiente hito de datos

Incorporar la descarga completa del Registro Civil a `aml_osfl_registry_master` y ejecutar resolución de identidad en este orden:

1. RUT normalizado exacto.
2. Nombre normalizado + comuna/región.
3. Nombre + tipo/clasificación + territorio.
4. Match probabilístico con revisión para casos ambiguos.

Una vez que la carga se valide contra totales, unicidad, vigencia y distribución territorial, actualizar el corte a `COMPLETE`. El frontend cambiará automáticamente desde “Referencia oficial” a “Padrón nacional cargado”.
