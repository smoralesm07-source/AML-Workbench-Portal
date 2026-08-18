# Módulo OSFL · AML Workbench v0.30.1

## Propósito

OSFL es una superficie especializada de exploración sobre el mismo modelo canónico del AML Workbench. No es una aplicación paralela ni un padrón estático publicado en GitHub Pages.

La condición OSFL, la presencia en registros públicos y el cribado FATF R.8 son hechos de caracterización/contexto. No constituyen por sí solos señal adversa, riesgo FT ni aporte directo a IPA 3.0.

## Universo y reconciliación

- Universo fuente Radar_OSFL v0.3: **37.164 perfiles**.
- Perfiles enlazados a Entity Hub por RUT: **37.164**.
- OSFL sustantivas después de aplicar tipología canónica: **37.146**.
- Registros reclasificados canónicamente como organismo público: **18**; se conservan como control de calidad y se excluyen del explorador sustantivo.
- Pendientes de Entity Hub: **0**.

La diferencia entre universo fuente y universo sustantivo es explícita y trazable; no se fuerza una entidad pública a adoptar tipo OSFL por aparecer en un screening económico.

## Fuentes autoritativas

| Hecho | Fuente autoritativa en Workbench |
|---|---|
| Pertenencia/confirmación OSFL, R.8, Ley 21.440, Ley 19.862 | `aml_osfl_profile` · Radar_OSFL |
| Identidad, nombre, tipo, región/comuna | `aml_entities` · Entity Hub |
| Trayectoria económica 2020–2024 | `aml_sii_entity_year` / `aml_entity_tax_profile` |
| Condición y sector UAF | `aml_uaf_entity_profile` + Entity Hub |
| Sanciones | `aml_sanction_identity_resolution` / `aml_v028_sanctions_with_identity` |
| Prioridad analítica | IPA 3.0 `v0.4-shadow` |
| Contexto territorial | modelo Territory / Context Hub |

No se copian ventas, condición UAF, sanciones ni IPA dentro del perfil OSFL de origen.

## Read-models

La interfaz consume exclusivamente bajo RLS:

- `aml_osfl_snapshot`
- `aml_v029_osfl_entity`
- `aml_v029_osfl_region`
- `aml_v029_osfl_activity`
- `aml_v029_osfl_year`
- `aml_v029_osfl_ipa_band`
- `aml_v029_osfl_quality`
- `aml_v029_osfl_source_coverage`

Las vistas son `security_invoker=true`. `anon` no tiene acceso; `authenticated` tiene únicamente `SELECT` y la visibilidad efectiva depende de las políticas de las tablas base.

## Diseño funcional

El módulo conserva la lógica de la propuesta OSFL adjunta:

1. panorama nacional;
2. mapa vectorial de Chile por regiones;
3. ranking territorial interactivo;
4. composición por actividad;
5. trayectoria SII 2020–2024;
6. exposición en registros públicos y cribado R.8;
7. distribución IPA 3.0;
8. explorador de organizaciones;
9. `OSFL 360` y acceso al `Entity 360` canónico.

El mapa utiliza 16 geometrías regionales independientes. La región elegida filtra el mismo read-model que alimenta el ranking y el explorador.

## IPA 3.0

IPA 3.0 pertenece a la entidad, no al registro OSFL. El módulo consume `v0.4-shadow` y muestra score, banda, confianza, cobertura, marca conductora y marcas detalladas en OSFL 360.

Guardrails:

- `OSFL_MEMBERSHIP_DOES_NOT_SCORE`
- `FATF_R8_SCREENING_DIRECT_IPA_CONTRIBUTION_ZERO`
- `PUBLIC_REGISTRY_PRESENCE_IS_CONTEXT`
- `IPA3_IS_ANALYTICAL_PRIORITY_NOT_LAFT_PROBABILITY`
- `MISSING_IS_NOT_ZERO`
- `PUBLIC_BODY_CANONICAL_TYPE_OVERRIDES_OSFL_SCREENING`

## Integración futura

M20 (OSFL + contratación pública material) y M21 (OSFL + complejidad relacional) deben incorporarse al Registry IPA3/Fusion y luego aparecer automáticamente en OSFL 360 como marcas de entidad. El módulo no debe crear scores propios alternativos ni sumar exposición pública al IPA fuera del motor gobernado.
