# IRG-LA/FT territorial · V/E v2 · metodología 0.33.0 — ARCHIVADA

> **Estado:** RETIRADA del IGR productivo el 26-08-2026.  
> **Reemplazo:** `IGR-2A-1.0.0`.  
> **Autoridad vigente:** `docs/atlas-indicator-architecture-v1.md` y `data/atlas_igr_v2a_contract.json`.

## Motivo del retiro

Esta versión utilizaba la estructura:

`IGR histórico = 45% V/E + 20% Densidad SO + 20% Brecha + 15% Amenaza`

La fórmula fue retirada para evitar doble conteo entre territorio, riesgo sectorial y señales de entidad. En particular, V/E incorporaba vulnerabilidad/materialidad sectorial e IRAR, mientras Densidad SO y Brecha correspondían a dimensiones de cobertura/regulación que ahora tienen residencia metodológica propia.

## Arquitectura vigente

El IGR productivo es exclusivamente territorial:

`IGR v2A = 100% Amenaza territorial CEAD-LA`

CEAD-LA se compone de:

- 55% Amenazas precedentes LA;
- 35% Economía criminal / facilitadores;
- 10% Contexto criminógeno.

Cada driver utiliza 40% intensidad, 25% persistencia, 20% tendencia y 15% anomalía. La confianza se publica separadamente.

La evolución gobernada prevista es:

- v2A: 100% CEAD-LA;
- v2B: 85% CEAD-LA + 15% exposición transfronteriza/logística;
- v2C: 75% CEAD-LA + 15% exposición transfronteriza/logística + 10% evidencia territorial LA.

Las capas futuras no reciben valores neutros ni pesos renormalizados hasta contar con datos reales y cobertura suficiente.

## Destino de los componentes retirados

- Vulnerabilidad/materialidad sectorial → **IRAR-E**.
- IRAR → **Reportabilidad**, sin aporte al IGR.
- Densidad SO → descriptivo territorial, sin aporte al IGR.
- Brecha de cobertura → **BCR / Potenciales SO**, sin aporte al IGR.
- Señales individuales → **IPA**, sin aporte al IGR.

Este archivo se conserva sólo como registro de la evolución metodológica y **no debe utilizarse para recalcular el IGR vigente**.
