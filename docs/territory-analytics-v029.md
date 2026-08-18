# Territorio analítico v0.29.0

## Propósito

La versión `TERRITORY-ANALYTICS-0.29.0` convierte la vista Territorio en una superficie analítica interactiva orientada a responder **qué está pasando territorialmente**, manteniendo un único modelo oficial de riesgo geográfico: **Score B · Percentil robusto**.

La fórmula numérica no se recalibra en esta versión. El contrato de score se conserva como `GEO-RISK-B-0.27.0`; v0.29 agrega interacción, explicación y marcas de fenómenos sobre ese resultado.

## Modelo definitivo

- Método visible y operativo: **B**.
- No se muestran alternativas A/C en Territorio.
- IPA3 continúa usando semántica `0.4-shadow`: prioridad analítica, no probabilidad de LA/FT.
- Las marcas de fenómeno **no suman puntos** al Score B.

Guardrail: `PHENOMENA_DO_NOT_CHANGE_SCORE_B`.

## Marcas de fenómenos

Las marcas son reglas determinísticas y explicables. Se calculan sólo con información ya presente en el modelo territorial y sirven para resaltar patrones evidentes del corte.

- `HIGH_CONFIDENCE_RISK`: Score B ≥60 y confianza explicativa ≥70.
- `MULTISOURCE_CONVERGENCE`: tres o más familias elevadas.
- `DRIVER_TENSION`: dos drivers elevados separados por ≤10 puntos.
- `CEAD_HIGH`: CEAD en percentil ≥75.
- `CEAD_ACCELERATION`: variación interanual CEAD ≥20% con volumen mínimo observado.
- `BUDGET_HIGH`: Presupuesto en percentil ≥75.
- `CGR_HIGH`: CGR en percentil ≥75.
- `IPA_REGISTRY`: presión IPA elevada con patrón supervisivo/registral.
- `IPA_SANCTIONS`: presión IPA elevada con patrón sancionatorio.
- `IPA_HIGH`: presión IPA territorial ≥80.
- `SECTOR_HIGH`: exposición sectorial 19.913 ≥75.
- `RECENT_FORMATION`: razón de inicios recientes en quintil superior regional.
- `HIGH_RISK_UNSTABLE`: Score B alto con confianza explicativa baja.
- `COVERAGE_FRAGILE`: cobertura de componentes <75%.

Cada marca incorpora una descripción breve disponible mediante hover/foco y puede actuar como filtro.

## Cross-filtering

Mapa, tabla, perfiles, fenómenos, drivers y matriz Score B × confianza comparten un mismo estado de filtros.

Reglas:

1. Dentro de una misma dimensión, selecciones múltiples se interpretan como OR.
2. Entre dimensiones distintas, los filtros se combinan como AND.
3. Los conteos de cada gráfico se recalculan excluyendo temporalmente su propia dimensión, para evitar falsos ceros y permitir exploración iterativa.
4. Seleccionar una región en mapa o tabla filtra toda la vista y actualiza la lectura narrativa.
5. Los filtros pueden limpiarse individualmente o en conjunto.

## Priorización analítica

La etiqueta de prioridad (`Priorizar`, `Profundizar`, `Monitorear`, `Contexto`) es una ayuda de navegación. Se deriva de Score B, confianza explicativa y cantidad de fenómenos materiales. No reemplaza criterios formales de Fiscalización ni constituye una conclusión sobre personas o entidades.

## Lectura narrativa

La ficha regional presenta:

- Score B;
- driver principal;
- segundo driver y brecha;
- confianza del perfil;
- convergencia de familias;
- marcas de fenómeno visibles;
- prioridad analítica sugerida.

La narrativa describe conductores del score y no relaciones causales entre fenómenos.

Guardrail: `EXPLANATORY_PROFILE_IS_NOT_CAUSAL_INFERENCE`.

## Semántica y cautelas

- `MISSING_IS_NOT_ZERO_STRICT`.
- `PHENOMENA_DO_NOT_CHANGE_SCORE_B`.
- `EXPLANATORY_PROFILE_IS_NOT_CAUSAL_INFERENCE`.
- `IPA3_SHADOW_NOT_LAFT_PROBABILITY`.
- CEAD describe actividad territorial y no atribuye delitos a residentes o entidades.
- Una anomalía de Presupuesto no implica ilegalidad.
- Un hallazgo CGR requiere trazabilidad documental.
- Exposición sectorial y capacidad económica no son adversas por sí mismas.

## Exportación

Las filas regionales incorporan:

- `analytical_view_version`;
- `definitive_method = B`;
- `phenomena_codes`;
- `phenomena_labels`;
- `analytical_priority`;
- `profile_confidence_score`.

La exportación conserva la versión de fórmula del score separada de la versión de la experiencia analítica para mantener trazabilidad.
