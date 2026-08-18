# IRG-LA/FT territorial · metodología v0.32.0

## 1. Cambio metodológico

v0.32.0 reemplaza como indicador visible principal el esquema territorial `Score B / IPT` por el **IRG-LA/FT** definido en la propuesta territorial original aportada por el usuario.

La fórmula principal se conserva sin reponderar:

`IRG = 0.45 V + 0.20 D + 0.20 B + 0.15 A`

donde:

- `V` = Vulnerabilidad / exposición territorial (0–100).
- `D` = Densidad observada de Sujetos Obligados (0–100).
- `B` = Brecha potencial de cobertura (0–100).
- `A` = Amenaza territorial CEAD (0–100).

**No se renormalizan los pesos cuando falta una dimensión.** Si cualquiera de las cuatro dimensiones requeridas no puede calcularse, `IRG = null`. Missing nunca se convierte silenciosamente en cero.

## 2. Vulnerabilidad / exposición · 45%

La fuente metodológica es el catálogo de 55 actividades obligadas de la Ley 19.913 aportado por el usuario.

El catálogo define `Riesgo inherente preliminar` en escala 1–5, obtenido como promedio simple de seis dimensiones estructurales. v0.32.0 conserva el resultado publicado y solo aplica una transformación lineal para llevarlo a la escala común 0–100:

`riesgo_0_100 = (riesgo_1_5 - 1) / 4 * 100`

El territorio se calcula como promedio ponderado por las presencias potenciales SII de cada sector:

`V = Σ(presencia_sector × riesgo_sector_0_100) / Σ(presencia_sector)`

Solo participan homologaciones Context Hub con:

- `mapping_status = VALIDATED_RULE`;
- `mapping_confidence >= 0.85`;
- código SII de seis dígitos.

Una actividad SII es un **proxy de universo potencial**, no una afirmación jurídica de que la entidad sea Sujeto Obligado UAF.

## 3. Densidad de Sujetos Obligados · 20%

Métrica base:

`densidad_raw = 1000 × SO_UAF_localizados / entidades_activas_SII`

La densidad raw se transforma a percentil nacional 0–100, separadamente para regiones y comunas.

En el corte de implementación existen 10.294 entidades UAF observadas; 8.117 cuentan con región/comuna localizable. Los registros sin territorio **no se imputan** a ningún territorio.

## 4. Brecha potencial de cobertura · 20%

La brecha se calcula únicamente en sectores con homologación fuerte UAF↔SII.

Por sector:

- `potencial` = presencias activas SII bajo códigos homologados.
- `observado` = Sujetos Obligados UAF localizados y clasificados en ese sector.
- `cubierto = min(potencial, observado)`.

Agregado territorial:

`B = 100 × (Σ potencial - Σ cubierto) / Σ potencial`

El indicador se denomina **brecha potencial** porque actividad tributaria y condición jurídica de Sujeto Obligado son conceptos distintos. Un valor alto orienta validación/fiscalización, no prueba incumplimiento.

Si `observado > potencial`, la diferencia se conserva como `overhang` diagnóstico y la brecha del sector se acota en cero; nunca se genera una brecha negativa.

## 5. Amenaza territorial · 15%

Se conserva el cálculo CEAD gobernado que ya estaba materializado en el módulo:

- 70% percentil nacional de intensidad;
- 30% percentil nacional de tendencia positiva.

La intensidad utiliza casos policiales de familias clasificadas `predicate_family_direct`, normalizados por 1.000 entidades activas SII.

La ficha CEAD mantiene casos, período previo, variación, familias delictuales, subtipos cuando el catálogo los permite y acceso a fuente/dataset.

CEAD es contexto delictual territorial; no se atribuye a entidades por ubicación.

## 6. Confianza del resultado

Se respeta la ponderación de la propuesta:

`CONF = 0.35 Completitud + 0.30 Calidad geográfica + 0.20 Calidad del mapeo sectorial + 0.15 Actualidad`

Adaptadores v0.32.0:

- **Completitud**: 25 puntos por cada dimensión IRG disponible.
- **Calidad geográfica**: cobertura geográfica publicada del padrón UAF utilizado para densidad/brecha.
- **Calidad de mapeo**: promedio de `mapping_confidence` ponderado por presencias SII que contribuyen al territorio.
- **Actualidad**: promedio de bandas de recencia de SII, UAF y CEAD: ≤180 días=100; ≤365=75; ≤730=50; >730=25.

La confianza se informa separadamente y **no incrementa ni reduce el IRG**.

## 7. Señales que dejan de puntuar

v0.32.0 no inventa nuevos ponderadores para fuentes que la propuesta no incorporó en la fórmula principal.

Se mantienen como **Señales y evidencia complementaria, aporte IRG directo = 0%**:

- Presupuesto Abierto;
- hallazgos CGR;
- IPA3 / sanciones;
- prensa regional;
- presencia OSFL.

Estas fuentes permiten explicar fenómenos, priorizar verificaciones y abrir investigaciones, pero no se mezclan con el índice sin una modificación metodológica gobernada.

## 8. Read model UAF territorial

Supabase publica `aml_v032_geo_uaf_territory`, respaldado por `aml_v032_geo_uaf_territory_snapshot`.

El snapshot contiene:

- nivel `REGION` / `COMMUNE`;
- región y comuna;
- número de SO UAF observados;
- número con perfil sectorial;
- conteos por sector en JSONB;
- total fuente UAF;
- total UAF localizado;
- porcentaje de cobertura geográfica;
- fecha de materialización.

RLS usa la allowlist `aml_allowed_users`. El refresh es exclusivo de `service_role`.

## 9. Guardrails

- `MISSING_IS_NOT_ZERO_STRICT`
- `SII_ACTIVITY_IS_NOT_UAF_LEGAL_STATUS`
- `UAF_UNLOCATED_RECORDS_ARE_NOT_IMPUTED`
- `CEAD_CASES_ARE_TERRITORIAL_NOT_ENTITY_ATTRIBUTION`
- `TERRITORIAL_RISK_IS_NOT_ENTITY_RISK`
- `CGR_BUDGET_IPA_PRESS_OSFL_DIRECT_IRG_WEIGHT_IS_ZERO`

## 10. Exportación

CSV/JSON exportan región y comuna con:

- IRG y banda;
- cuatro dimensiones;
- aporte ponderado de cada dimensión;
- confianza y sus cuatro componentes;
- denominadores SII/UAF;
- casos CEAD;
- contexto Presupuesto/CGR/OSFL/prensa;
- versión `IRG-LAFT-0.32.0`.

La exportación territorial no agrega RUT ni transfiere el IRG a la matriz individual de una entidad.
