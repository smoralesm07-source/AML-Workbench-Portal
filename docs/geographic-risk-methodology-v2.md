# Metodología de riesgo geográfico v2

**Versión regional recomendada:** `GEO-RISK-B-0.25.0`  
**Producto:** AML Workbench Portal / Territorio  
**Semántica:** índice territorial de contexto y priorización. No es probabilidad de LA/FT y no transfiere automáticamente riesgo territorial a una entidad.

## Cambio principal

El método **B · Percentil robusto** incorpora una nueva dimensión regional basada en las **marcas gobernadas de IPA 3.0 v0.3 shadow**. No se cuentan alertas, noticias ni coincidencias en bruto. Primero IPA3 consolida evidencia por entidad; después Territorio agrega esa prioridad a nivel regional y la transforma en percentil nacional.

El objetivo es capturar fenómenos que el modelo geográfico anterior no distinguía suficientemente —desalineación registral, trayectoria económica inusual y recurrencia/convergencia sancionatoria— sin permitir que el tamaño absoluto de una región determine el resultado.

## Fórmula Score B regional v2

Se conserva el **85% de la estructura relativa** del Score B anterior y se reserva un **15% máximo** al componente IPA3:

| Componente | Peso regional |
|---|---:|
| Sectores Ley 19.913 | 17,00% |
| CEAD / delitos base elegibles | 25,50% |
| Presupuesto Abierto | 21,25% |
| CGR | 12,75% |
| Convergencia territorial | 8,50% |
| Marcas IPA3 | **15,00%** |
| **Total** | **100,00%** |

La reducción de los cinco componentes originales es proporcional; no altera sus relaciones internas. Si una fuente está ausente, su valor permanece `NULL` y el cálculo disponible se renormaliza sobre componentes observados, mientras la cobertura baja explícitamente. `MISSING_IS_NOT_ZERO` sigue vigente.

### Comunas

El ajuste IPA3 se aplica inicialmente **solo al nivel regional**, porque la materialización gobernada disponible es regional y los denominadores comunales pequeños pueden introducir inestabilidad. Las comunas mantienen la versión territorial previa del Percentil robusto hasta disponer de un snapshot IPA comunal evaluado.

## Construcción del componente IPA territorial

Para cada entidad, IPA 3.0 v0.3 aplica primero sus reglas de gobierno:

1. cada marca se computa una sola vez por entidad;
2. evidencia repetida no incrementa el score;
3. marcas correlacionadas dentro del mismo grupo se absorben;
4. trayectoria económica aplica factor de recencia;
5. confianza y cobertura no aumentan IPA;
6. contexto y roles regulatorios tienen aporte 0;
7. la convergencia entre grupos independientes es limitada: grupo dominante + 25% del segundo + 10% del tercero.

Después se calcula, por región:

`presión_IPA_regional = Σ IPA3_entidad / universo_entidades_región`

La presión utiliza **todo el universo regional**, no solo las entidades marcadas. Así combina prevalencia e intensidad sin favorecer automáticamente territorios grandes. Finalmente, las 16 presiones regionales se convierten a **percentiles nacionales 0–100**. Ese percentil es el componente que recibe un peso máximo de 15% en Score B.

El componente IPA **no entra nuevamente en la fórmula de convergencia territorial**. Esto evita duplicar la misma evidencia, pues IPA3 ya controla convergencia entre Registro, Trayectoria económica y Sanciones.

## Marcas IPA3 con scoring en v0.3

| Marca | Fenómeno | Regla de gobierno relevante |
|---|---|---|
| M01 | SO UAF con término de giro publicado SII | Desalineación registral; cap y antigüedad del término de giro. No prueba incumplimiento. |
| M03 | Contracción económica significativa | Trayectoria económica con factor de recencia. |
| M04 | Expansión económica significativa | Trayectoria económica; puede ser absorbida por M05 o M19. |
| M05 | Entidad joven con crecimiento extraordinario | Entidad ≤2 años, salto ≥2 tramos y percentil ≥95 entre pares; absorbe M04. |
| M16 | Recurrencia sancionatoria | Procedimientos confirmados/deduplicados en 36/60 meses; M18 puede absorberla. |
| M18 | Convergencia sancionatoria multirregulador | Al menos dos reguladores independientes en 60 meses; absorbe M16. |
| M19 | OSFL reciente con crecimiento acelerado | OSFL ≤3 años, salto ≥2 tramos y percentil ≥95 entre pares; absorbe M04 cuando corresponde. |

Las marcas contextuales, diagnósticas o bloqueadas del catálogo permanecen visibles para explicación, pero **no generan puntos** mientras su estado de gobierno no permita scoring.

## Lectura del riesgo regional

Un Score B alto no debe interpretarse sin revisar su composición. La nueva tabla y el detalle regional muestran:

- score final y variación respecto de B sin IPA3;
- percentil de presión IPA3 y entidades marcadas por 10 mil;
- marcas IPA3 que conducen el territorio;
- sector Ley 19.913 y constituciones/inicios recientes;
- CEAD: percentil, casos y variación temporal;
- Presupuesto: percentil y señales P1 cuando existe materialización completa;
- CGR: percentil y hallazgos territorializados;
- convergencia y cobertura.

Cada marca visible incorpora una descripción breve al pasar el cursor o enfocarla con teclado. Esto permite distinguir, por ejemplo, una región elevada principalmente por **M01 desalineación registral** de otra impulsada por **M18 convergencia sancionatoria**, aun si ambas alcanzan un percentil IPA similar.

## Visualización ejecutiva

Los antiguos KPI de cantidad de regiones, cobertura media, aptitud de exportación y máximo score se reemplazan por cuatro micrográficos orientados a hallazgos:

1. regiones donde IPA3 modifica más el Score B;
2. presión regional de marcas IPA3 normalizada por universo;
3. marcas conductoras más frecuentes del corte;
4. regiones con mayor convergencia de capas estructuradas elevadas.

La columna visible `Estado exportación` se elimina del ranking regional. El estado de aptitud se conserva únicamente en el **contrato de exportación máquina-a-máquina**, porque sigue siendo útil para rechazar cortes incompletos en el ambiente seguro.

## Read-model y rendimiento

Territorio no consulta `aml_v_ipa3_entity_score_v0_3` en vivo. La agregación completa se materializa en el snapshot RLS:

- `aml_v023_geo_ipa_region_snapshot`
- vista de lectura `aml_v023_geo_ipa_region`

La función de refresco queda reservada a `service_role`. El navegador recibe solo agregados regionales y no necesita descargar RUT ni scores entity-level para construir el mapa.

## Guardrails

1. `MISSING_IS_NOT_ZERO`.
2. `IPA3_SHADOW_NOT_LAFT_PROBABILITY`.
3. Las marcas IPA correlacionadas se absorben antes de la agregación territorial.
4. IPA3 v0.3 continúa en modo shadow y no reemplaza el score productivo de Entity 360.
5. Prensa no acredita hechos delictivos.
6. Presencia OSFL es exposición, no señal adversa por sí sola.
7. Capacidad económica es contexto/exposición.
8. CEAD describe actividad territorial; no atribuye conducta a residentes o empresas.
9. Una anomalía de Presupuesto no acredita irregularidad.
10. CGR mantiene trazabilidad documental.
11. La identidad territorial del cálculo y la exportación proviene de CUT / Context Hub.
