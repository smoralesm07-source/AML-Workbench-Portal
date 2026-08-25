# Universo SO 0.65 · potenciales por ACTECO

## Definición

Desde 0.65, Atlas considera **potencial sujeto obligado** a una entidad que cumple simultáneamente:

1. registra al menos un ACTECO relacionado con categorías de la Ley 19.913 según la política gobernada de Radar SII (`candidate_use=SI`);
2. figura vigente en la nómina SII del corte; y
3. su RUT no es observado en el padrón UAF utilizado por Atlas.

El universo de referencia del último screening disponible es **79.449**.

## Criterios retirados

El universo de 2.033 de la versión 0.64 deja de ser una población válida de Potenciales SO. Atlas no exige concentración mínima del giro, coherencia por tipo de entidad, coherencia sectorial, IVO, materialidad ni niveles A/B/C para que una entidad ingrese al screening.

Esas variables pueden utilizarse posteriormente para describir, ordenar o priorizar trabajo fiscalizador, pero no para recortar la población base.

## Semántica

Potencial SO es una **hipótesis de screening**, no una conclusión jurídica. Tener un ACTECO vinculado a la Ley 19.913 no prueba por sí solo que una entidad tenga la calidad jurídica de sujeto obligado, deba inscribirse o se encuentre incumpliendo.

## Fuentes

- Política ACTECO: `smoralesm07-source/Radar_SII/config/uaf_sii_screening_policy.csv`
- Regla de inclusión: `candidate_use=SI`
- Corte SII utilizado por el screening vigente: 2026-05
- Padrón UAF: corte UAF disponible en el pipeline de conciliación.

## Estado de materialización

Atlas ya gobierna y muestra el total 79.449 y deja de exponer la cola restrictiva de 2.033. La nómina completa de 79.449 RUT debe materializarse desde el dataset de actividades vigente de Radar SII para habilitar navegación individual, filtros y gestión masiva sobre todas las filas. Mientras esa materialización no exista, Atlas no sustituye el universo amplio con la antigua lista restrictiva.
