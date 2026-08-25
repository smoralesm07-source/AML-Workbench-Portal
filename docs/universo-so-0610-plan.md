# Universo SO · build 0.61.0

## Hallazgo estructural

La diferencia 9.782 vs 10.294 no correspondía a 512 sujetos obligados perdidos. La conciliación directa de Supabase mostró:

- **9.782** RUT en `aml_uaf_entity_profile`: padrón materializado de sujetos obligados.
- **512** entidades adicionales con `is_uaf_observed=true`, todas clasificadas como **Organismo público**, sin fila en `aml_uaf_entity_profile` y sin sector UAF de sujeto obligado.
- **10.294** es por tanto el total de entidades observadas por la fuente UAF en el maestro Atlas: 9.782 SO + 512 organismos públicos. No debe mostrarse como número de SO inscritos.

El build 0.61 reemplaza la alerta provisional de 0.60 por un contrato de verdad registral que separa explícitamente estas poblaciones.

## Sectores

También se separan tres magnitudes que antes se confundían:

- **52** grafías sectoriales presentes en el padrón.
- **49** sectores canónicos actualmente poblados por el snapshot de supervisión.
- **55** categorías/sectores del catálogo canónico Atlas.

Un conteo de sectores poblados nunca debe reducir el tamaño del catálogo metodológico.

## Reportabilidad

Se crea `aml_v_uaf_reporting_obligation_0610`, que enlaza cada SO con la regla sectorial vigente disponible en `aml_reporting_rules`.

Cobertura observada al crear el build:

- 9.701 SO con regla sectorial enlazada por correspondencia exacta del sector canónico.
- 81 SO en sectores cuya regla aún no tiene correspondencia exacta materializada.

La lente distingue **obligación de reportar** de **conducta efectiva de reportabilidad**. Hasta disponer de ROS/ROE por RUT, Atlas no infiere cumplimiento o incumplimiento desde esta tabla.

## Prensa

La prensa individual sigue gobernada por el feed del Monitor y por la política de resolución estricta de `atlas-entity-press-current-0527.js`. Universo SO incorpora una lente de prensa sólo para coincidencias nominales exactas normalizadas o alias exactos del feed; no promueve identidad canónica ni modifica IPF/IVO.

## Guardarraíles

- 10.294 ≠ SO inscritos.
- Organismo público observado por fuente UAF ≠ sujeto obligado.
- 49 sectores poblados ≠ catálogo de 55 sectores.
- Obligación ROS/ROE ≠ reportabilidad efectivamente observada.
- Mención de prensa ≠ hecho acreditado, sanción ni delito.
