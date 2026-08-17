# Perfil explicativo del riesgo geográfico · v1

**Portal:** AML Analytical Workbench v0.26.0  
**Score:** B · Percentil robusto + IPA3  
**Versión de fórmula numérica:** `GEO-RISK-B-0.25.0`  
**Versión del producto explicativo:** `GEO-RISK-B-0.26.0` / `TERRITORIAL-EXPLANATORY-PROFILE-1.0`

## Objetivo

El perfil explicativo responde una pregunta distinta del score: **¿qué familia de señales está conduciendo el resultado de una región?**

No aumenta ni reduce el Score B. La ponderación regional se mantiene:

- Sectores Ley 19.913: 17,00%
- CEAD: 25,50%
- Presupuesto Abierto: 21,25%
- CGR: 12,75%
- Convergencia territorial: 8,50%
- IPA3: 15,00%

El término “causal” se usa solo como abreviatura operativa de *perfil conductor*. **No se realiza inferencia causal estadística**, no se demuestra que una fuente produzca otra y no se atribuye conducta a personas o entidades.

## Familias explicativas

| Código | Perfil | Evidencia principal |
|---|---|---|
| `DELICTUAL` | Delictual | Percentil CEAD de delitos base elegibles |
| `GASTO_PUBLICO` | Gasto público | Señales priorizadas de Presupuesto Abierto |
| `CONTROL_PUBLICO` | Control público / CGR | Hallazgos documentales CGR |
| `SUPERVISIVO_REGISTRAL` | Supervisivo / registral | IPA3 conducido por señales registrales; actualmente M01 es la principal marca scoring de esta familia |
| `SANCIONATORIO` | Sancionatorio | IPA3 conducido por M16/M18 o presión del grupo sanciones |
| `ECONOMICO_SECTORIAL` | Económico-sectorial | Sector 19.913 y/o IPA3 económico (M03/M04/M05/M19) |
| `IPA_MIXTO` | IPA3 mixto | IPA3 elevado sin grupo interno claramente dominante |
| `MIXTO` | Mixto de dos drivers | Dos familias elevadas y cercanas |
| `MULTIFUENTE` | Multifuente | Tres o más familias distintas elevadas simultáneamente |
| `SIN_PREDOMINIO` | Sin predominio claro | Cobertura suficiente pero ninguna familia alcanza el umbral explicativo |
| `EVIDENCIA_INSUFICIENTE` | Evidencia insuficiente | Cobertura <60% o menos de 3 componentes comparables |

## Regla determinística

1. Se toman los cinco componentes estructurados: Sector 19.913, CEAD, Presupuesto, CGR e IPA3.
2. IPA3 se descompone en la familia que lo conduce:
   - M01 → supervisivo/registral;
   - M03, M04, M05, M19 → económico-sectorial;
   - M16, M18 → sancionatorio;
   - en ausencia de marcas suficientes, se usa el mayor grupo agregado entre Registro, Trayectoria económica y Sanciones.
3. Los componentes se agrupan por familia. Cuando Sector 19.913 e IPA económico apuntan a la misma familia, se consideran evidencias de una misma explicación y no dos familias distintas.
4. Una familia se considera elevada si al menos uno de sus componentes alcanza percentil 60.
5. Clasificación:
   - cobertura <60% o <3 componentes comparables → `EVIDENCIA_INSUFICIENTE`;
   - ninguna familia ≥60 → `SIN_PREDOMINIO`;
   - 3 o más familias ≥60 → `MULTIFUENTE`;
   - exactamente 2 familias ≥60 y brecha entre las dos primeras ≤12 puntos → `MIXTO`;
   - en los demás casos se asigna la familia dominante.

## Confianza del perfil

La confianza es independiente de la cobertura del score y mide cuán estable es la explicación propuesta. Usa:

- cobertura de fuentes;
- intensidad del conductor principal;
- brecha frente al segundo conductor;
- número de familias elevadas cuando el perfil es mixto/multifuente;
- convergencia territorial.

Tramos de lectura:

- **Alta:** ≥80
- **Media:** 60–79,9
- **Baja:** <60

Si hay menos de cuatro componentes comparables la confianza se limita a 70. Si la cobertura es inferior a 75%, se limita a 55.

## Lectura recomendada

Un score regional alto con perfil `DELICTUAL` no significa que las entidades de la región hayan cometido delitos; significa que la presión CEAD es el conductor relativo más fuerte del score. Un perfil `SUPERVISIVO_REGISTRAL` indica que la dimensión IPA3 está dominada por desalineaciones registrales/supervisivas, no por evidencia delictiva. Un perfil `MULTIFUENTE` indica convergencia de familias independientes y merece mayor revisión estratégica, pero tampoco constituye prueba de LA/FT.

## Interfaz

La v0.26 incorpora:

- capa de mapa **Perfil conductor** con colores categóricos;
- perfil y confianza en la tabla regional;
- conductor principal, segundo conductor y brecha;
- panel explicativo para la región seleccionada;
- gráfico nacional de distribución de perfiles;
- gráfico de perfiles mixtos/multifuente;
- gráfico de regiones con menor estabilidad explicativa;
- descripciones emergentes de perfiles y marcas IPA3.

## Exportación

`AML_GEOGRAPHIC_RISK_EXPORT_V3` agrega por región:

- `explanatory_profile_code`
- `explanatory_profile_label`
- `profile_confidence_score`
- `profile_confidence_label`
- `dominant_driver`
- `dominant_driver_score`
- `secondary_driver`
- `secondary_driver_score`
- `driver_gap`
- `elevated_family_count`
- `profile_explanation`
- `score_formula_version`
- `profile_method_version`

El perfil se mantiene regional. Las comunas conservan el Score B territorial previo hasta disponer de IPA comunal gobernado y suficiente cobertura para aplicar la misma lógica sin imputaciones.

## Guardrails

- `MISSING_IS_NOT_ZERO`
- `EXPLANATORY_PROFILE_IS_NOT_CAUSAL_INFERENCE`
- `IPA3_SHADOW_NOT_LAFT_PROBABILITY`
- las marcas IPA correlacionadas se absorben antes de agregarse territorialmente;
- prensa no acredita delitos;
- presencia OSFL no es adversa por sí sola;
- capacidad económica es exposición, no riesgo;
- CEAD describe actividad territorial, no atribución individual;
- una anomalía presupuestaria no equivale a ilegalidad;
- hallazgos CGR requieren trazabilidad documental.
