# Metodología de riesgo geográfico v1

**Versión de cálculo:** `GEO-RISK-0.22.0`  
**Producto:** AML Workbench Portal / Territorio  
**Semántica:** índice territorial de contexto y priorización supervisiva. No es probabilidad de LA/FT y no modifica por sí mismo el riesgo AML canónico de una entidad.

## Objetivo

Ordenar regiones y comunas de Chile según señales territoriales explicables, manteniendo separadas cuatro categorías: riesgo/señal, exposición económica, contexto y cobertura de datos. El producto está diseñado para poder exportarse y reutilizarse en un ambiente seguro como insumo de una matriz de riesgo de fiscalización, sujeto a las reglas de cobertura y confianza.

## Fuentes

- **Context Hub:** dimensión territorial CUT y homologación SII ↔ sectores UAF.
- **SII / Entity Hub:** entidades activas, fechas de inicio, tramos de ventas, trabajadores y actividades económicas.
- **Radar Delictual / CEAD:** familias de delitos base vinculadas al artículo 27 de la Ley 19.913, a nivel comunal.
- **Radar Presupuesto Abierto:** volumen transaccional, señales analíticas, señales P1 e intensidad normalizada de anomalías.
- **Radar CGR:** hallazgos territorializados, severidad, relevancia AML y familias de riesgo; el cálculo prioriza antecedentes 2020+ cuando existe anclaje temporal.
- **Radar Prensa:** contexto territorial. No acredita delito y, en el método recomendado, no incrementa directamente el score.
- **Radar OSFL:** exposición/presencia territorial. Una mayor cantidad de OSFL no es una señal adversa por sí sola.

## Sectores económicos Ley 19.913

El componente sectorial usa únicamente homologaciones del Context Hub con `mapping_status = VALIDATED_RULE` y confianza alta. La coincidencia de actividad SII identifica **candidatos de actividad-sector**; no permite afirmar que una entidad sea sujeto obligado, esté inscrita en la UAF o incumpla una obligación legal.

Se miden, entre otros:

1. presencia relativa de actividades fuertemente homologadas en el territorio;
2. constitución/inicio de actividades reciente, con énfasis desde 2024;
3. concentración territorial de esa exposición.

## Tres alternativas de cálculo

### A. Ponderado auditable

Modelo baseline de suma ponderada. Favorece máxima transparencia y permite explicar exactamente cuánto aporta cada componente.

**Región:** sectores 20%, CEAD 25%, Presupuesto 20%, CGR 15%, prensa 5%, OSFL 5%, convergencia 10%.

**Comuna:** sectores 25%, CEAD 30%, Presupuesto 25%, CGR 10%, convergencia 10%.

Uso recomendado: comparación metodológica, auditoría y ejercicios de sensibilidad.

### B. Percentil robusto — recomendado

Modelo de producción. Antes de combinar componentes, transforma tasas e intensidades a posiciones percentilares nacionales para reducir el efecto del tamaño absoluto de Santiago u otros territorios grandes.

**Región:** sectores 20%, CEAD 30%, Presupuesto 25%, CGR 15%, convergencia 10%.

**Comuna:** sectores 25%, CEAD 35%, Presupuesto 25%, CGR 5%, convergencia 10%.

Prensa, OSFL y capacidad económica permanecen como capas observables, pero no impulsan directamente el score B por volumen bruto.

### C. Acumulación de evidencia — experimental

Usa la exposición sectorial para formar un prior territorial y acumula evidencia estructurada de CEAD, Presupuesto, CGR y convergencia en escala logística. Su resultado sigue expresándose 0–100 para comparabilidad, pero **no está calibrado como probabilidad de LA/FT**.

Uso recomendado: laboratorio metodológico y evaluación retrospectiva antes de cualquier uso operativo.

## Normalización y denominadores

- CEAD se compara mediante intensidad relativa y tendencia, no solo casos brutos.
- Presupuesto usa señales y P1 por volumen transaccional; el monto ejecutado es exposición, no riesgo por sí mismo.
- CGR se normaliza respecto de la exposición económica territorial y combina frecuencia, severidad y relevancia AML.
- Sectores 19.913 se normalizan respecto del universo económico observado y se pondera la creación reciente.
- Convergencia aparece cuando dos o más dimensiones estructuradas presentan intensidad elevada en el mismo territorio.

## Cobertura y confianza

Cada resultado incluye `coverage_pct`, `confidence`, `method_version` y `export_status`.

- Una fuente ausente queda `NULL`; **missing no equivale a cero**.
- `APTO` requiere cobertura suficiente y presencia de las dimensiones críticas exigidas por el nivel territorial.
- `PROVISIONAL_NO_APTO` impide tratar como definitivo un score calculado con fuentes aún no materializadas.

## Reglas de exportación al ambiente seguro

El CSV y el JSON exportan agregados territoriales, no RUT. Cada fila conserva:

- territorio y nivel;
- score, banda, método y versión;
- cobertura, confianza y estado de aptitud;
- componentes separados;
- métricas observadas usadas para explicar el resultado.

El JSON agrega los guardrails metodológicos para que la matriz de fiscalización pueda rechazar automáticamente cortes incompletos o metodologías no aprobadas.

## Guardrails

1. `MISSING_IS_NOT_ZERO`.
2. Prensa no acredita hechos delictivos.
3. Presencia OSFL es exposición, no señal adversa por sí sola.
4. Capacidad económica es contexto/exposición.
5. CEAD describe actividad territorial y no atribuye conductas a residentes o empresas.
6. Una anomalía de Presupuesto no acredita irregularidad.
7. Los hallazgos y cruces CGR mantienen trazabilidad documental.
8. El mapa es una visualización; la identidad territorial utilizada en el cálculo y la exportación proviene del CUT/Context Hub.
