# Universo SO · Reportabilidad 0.62

## Resultado

El build 0.62 separa tres conceptos: regla normativa, comportamiento observado y ausencia de fuente.

La conciliación de `aml_uaf_obligated_subject_snapshot` con `aml_reporting_rules` dejaba 81 sujetos sin correspondencia exacta. Se resolvieron 78 mediante equivalencias gobernadas y explícitas:

- 43 `Emisoras y Operadoras de Tarjetas de Pago`.
- 30 `Organizaciones Deportivas Profesionales regidas por la Ley N° 20.019`.
- 5 `Fintec: Otros Fiscalizados por la CMF`.

Quedan 3 sujetos en categorías para las que la tabla de reglas vigente no contiene una regla sectorial acreditada: `Clubes de Tiro`, `Empresas de Depósitos de Valores` y `Fintec: Custodia de Instrumentos Financieros`. Atlas no hereda ni inventa una regla por similitud.

## Comportamiento ROS/ROE

Se crea `aml_uaf_entity_reporting_observation_0620` como contrato de ingesta por RUT y período. La tabla es append-only desde la perspectiva del usuario autenticado: RLS habilitado y sólo lectura para `authenticated`.

La vista `aml_v_uaf_entity_reporting_behavior_0620` calcula, sólo cuando existen observaciones reales, totales históricos, últimos 12 meses y posición percentilar dentro del sector. Si no existe una fuente cargada por RUT, el estado es `NOT_MATERIALIZED`; nunca se convierte ausencia de dato en cero reportes.

Al momento de este build existen 0 filas de comportamiento materializadas. La interfaz por tanto muestra correctamente la brecha de fuente y queda preparada para recibir una exportación gobernada de ROS/ROE por entidad cuando esté disponible.
