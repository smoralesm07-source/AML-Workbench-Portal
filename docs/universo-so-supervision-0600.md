# Universo SO · Supervision 360 · build 0600

## Objetivo

Universo SO deja de ser sólo un padrón priorizado y pasa a operar como centro de cobertura y supervisión. Mantiene dos universos gobernados: inscritos UAF y potenciales SO, con una lectura 360° común y un workflow de incorporación trazable.

## Cambios del build

1. **Contrato de verdad visible.** La pantalla declara la diferencia entre el snapshot materializado y la referencia operacional de 10.294 inscritos. Una brecha de cobertura no reduce silenciosamente el universo.
2. **Vista 360 común.** `aml_v_uaf_supervision_360_current` unifica inscritos y potenciales y agrega contexto SII, territorial, sancionatorio, Mercado Público/Lobby/CGR, OSFL y RES.
3. **Fuentes de datos por entidad.** Cada expediente muestra qué fuentes tienen evidencia enlazada y cuáles todavía carecen de snapshot común. Ausencia de snapshot no equivale a ausencia de información.
4. **Expediente adaptativo.** La lente OSFL sólo aparece cuando corresponde. Mercado Público/Lobby/CGR y RES se muestran como contexto, no como imputación de riesgo LA/FT.
5. **Línea de tiempo societaria.** Se incorporan actuaciones RES como secuencia temporal para facilitar lectura de cambios.
6. **Gestión de cobertura.** Se agrega una superficie operacional separada de Potenciales SO con embudo, backlog y estados persistentes.
7. **Workflow ampliado.** Además de revisado/seleccionado/descartado se admiten elegible, priorizado, invitación preparada, invitado, seguimiento, inscrito y cerrado, más salidas administrativas.
8. **Append-only.** Cada gestión se inserta como nueva anotación; el navegador no envía `user_id` y no almacena decisiones en local/session storage.

## Regla de diseño

Si Atlas sabe algo de una entidad, esa evidencia debe poder incorporarse a la ficha independientemente de que la entidad esté inscrita o sea candidata. Los indicadores contextuales conservan su semántica original y no se convierten automáticamente en riesgo LA/FT.

## Limitaciones declaradas del corte

Al desplegar 0.60, la base materializada contiene 9.782 inscritos y 64 potenciales. La referencia operacional informada para el padrón completo es 10.294. El build no inventa los 512 registros faltantes: hace visible la brecha para impedir que se interprete el snapshot como universo total.

La reportabilidad UAF existe en Atlas a nivel sectorial, pero no existe aún un snapshot gobernado por entidad en la base consultada. La prensa por entidad está implementada en el módulo Entidades, pero tampoco existe todavía una tabla común para incorporarla de forma segura a la vista 360. Ambos dominios aparecen como brecha de cobertura hasta que se materialicen explícitamente.

## Siguiente hito de datos

P0 de datos para completar el diseño: cargar el padrón canónico de 10.294 sujetos, reconciliarlo contra `aml_uaf_obligated_subject_snapshot`, y materializar dos contratos adicionales: reportabilidad por entidad y prensa por entidad con resolución de identidad y confianza explícitas. Esos datos podrán conectarse a la vista 360 sin rediseñar la interfaz.
