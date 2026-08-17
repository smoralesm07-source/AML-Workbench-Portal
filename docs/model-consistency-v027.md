# AML Workbench · revisión integral de consistencia v0.27.0

Corte: 2026-08-17

## Propósito

Esta revisión valida que la capa de aplicación, los contratos Supabase, IPA 3.0, conciliación UAF↔SII, sanciones y el modelo territorial mantengan una semántica única y trazable. Las correcciones de v0.27.0 no convierten prioridad analítica en probabilidad de LA/FT ni alteran guardrails jurídicos.

## Hallazgos corregidos

### 1. Ausencia de dato tratada como cero en territorio

JavaScript `Number(null) === 0` hacía posible que valores ausentes participaran como cero en percentiles, ponderaciones, convergencia, bandas y cobertura. Esto contradecía el guardrail `MISSING_IS_NOT_ZERO`.

**Corrección:** v0.27.0 introduce `MISSING_IS_NOT_ZERO_STRICT`: null, undefined y blank permanecen nulos. Los pesos se renormalizan sólo entre componentes realmente observados. La convergencia requiere al menos dos componentes observados.

### 2. Cobertura regional no correspondía a las variables del Score B

El 8,5% reservado a `cross` en la fórmula B estaba siendo medido en cobertura como disponibilidad de contexto Prensa/OSFL. Eso podía inflar cobertura sin que la variable scoring de convergencia estuviera disponible.

**Corrección:** cobertura regional usa exactamente: Sector 17%, CEAD 25,5%, Presupuesto 21,25%, CGR 12,75%, Convergencia 8,5% e IPA3 15%. Prensa/OSFL permanecen contexto y no sustituyen cobertura de riesgo.

### 3. IPA3 mostraba marcas absorbidas como incluidas

IPA3 v0.3 ya consolidaba numéricamente por grupo, pero algunas marcas componentes seguían expuestas con `included_in_score=true` aunque una compuesta reutilizara su evidencia. También podían quedar varias marcas económicas como incluidas aunque una sola conducía el grupo.

**Corrección:** IPA3 v0.4 hace explícita la Regla B:
- `ABSORBED_BY_COMPOSITE`: marca visible, aporte 0.
- `CORRELATED_GROUP_NOT_ADDITIVE`: marca visible, aporte 0; se informa el driver efectivo del grupo.
- sólo el driver efectivo de REGISTRY / ECONOMIC_TRAJECTORY / SANCTIONS queda incluido en el score.

La corrección cambia explicación y conteos, no el valor numérico de IPA3 frente a v0.3.

### 4. Snapshot territorial consumía semántica IPA3 anterior

El snapshot regional v0.3 incluía en `top_marks` marcas posteriormente absorbidas.

**Corrección:** `aml_v026_geo_ipa_region` se genera desde IPA3 v0.4 y `aml_refresh_ipa3_geo_v026()` se ejecuta automáticamente al finalizar historia SII o conciliación sancionatoria. El snapshot deja de depender de refrescos manuales.

### 5. Conciliación UAF↔SII mezclaba estado técnico con análisis

La portada v0.24.1 ya había restaurado el universo comparable, pero la vista profunda heredaba controles de v0.20.5 que permitían volver a `NO_SII_PROFILE` y lo presentaban como categoría analítica.

**Corrección:** la superficie analítica visible sólo expone `matched`, `active` y `terminated`. `NO_SII_PROFILE` continúa disponible internamente como dato de cobertura, pero no como señal ni hallazgo. Para entidades UAF sin perfil materializado sólo se conserva el tratamiento de identidad/RUT, sin panel de conciliación adversa.

### 6. Privilegios Supabase más amplios que el contrato de aplicación

Había grants nominales de escritura para `authenticated` sobre objetos AML y al menos una exposición nominal a `anon`, aunque RLS limitara su utilización.

**Corrección:** `anon` no posee grants AML; `authenticated` queda read-only en el modelo AML, salvo `INSERT` legítimo en `aml_audit_log`. `aml_sync_state` y `aml_uaf_entity_profile` exigen además usuario habilitado en `aml_allowed_users`.

### 7. Snapshots geográficos sin clave primaria

Cinco snapshots tenían claves naturales únicas/no nulas pero no PK formal.

**Corrección:** se promovieron las claves naturales a PK y se eliminaron índices redundantes equivalentes.

## Integridad verificada

En el corte auditado:
- 0 RUT duplicados tras normalización.
- 0 hallazgos huérfanos respecto de Entity Hub.
- 0 sanciones resueltas huérfanas.
- 0 filas SII entity-year huérfanas.
- 0 duplicados `entity_id + commercial_year`.
- 0 IPA3 fuera de rango 0–100.
- IPA3 continúa `production_enabled=false`.

## Versiones después de la revisión

- Aplicación: `v0.27.0`.
- IPA3 entidad: `0.4-shadow`.
- Score territorial B: `GEO-RISK-B-0.27.0`.
- Perfil explicativo: `TERRITORIAL-EXPLANATORY-PROFILE-1.0`.
- Conciliación visible UAF↔SII: universo comparable SII materializado; estado técnico sin perfil no se interpreta analíticamente.

## Guardrails

- IPA = prioridad analítica, no probabilidad de LA/FT.
- Contexto territorial no se atribuye como conducta de una entidad.
- Prensa no acredita hechos ni aumenta IPA sustantivo.
- Ser SO UAF es contexto de rol, no riesgo.
- Término de giro SII + SO UAF identifica una posible desalineación registral que requiere verificación; no prueba incumplimiento.
- Ausencia de fuente o dato no se transforma en cero.
