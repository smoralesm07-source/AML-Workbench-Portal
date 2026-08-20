# IRG-LA/FT territorial · V/E v2 · metodología 0.33.0

## 1. Objetivo

La versión `IRG-LAFT-0.33.0` mantiene intacta la estructura superior del Índice de Riesgo Geográfico:

`IRG = 45% V/E + 20% Densidad SO + 20% Brecha + 15% Amenaza`

El cambio se limita al interior de **V/E (Vulnerabilidad / Exposición)**. La versión previa ponderaba principalmente el riesgo inherente sectorial por presencia potencial SII. V/E v2 agrega evidencia de exposición sectorial, convertibilidad histórica y materialidad/dinamismo económico para mejorar discriminación territorial sin convertir el índice en una medida de sospecha individual.

## 2. Fórmula de V/E v2

`V/E = 85% Núcleo sectorial enriquecido + 15% Materialidad territorial SII`

### 2.1 Núcleo sectorial enriquecido · 85% de V/E

Para cada sector UAF:

`Núcleo sectorial = 35% Base estructural + 25% ENR Chile + 20% ICR + 20% Materialidad GAFILAT`

El puntaje territorial se obtiene ponderando ese núcleo por las presencias potenciales SII de cada sector bajo homologaciones UAF↔SII fuertes y validadas.

### 2.2 Base estructural · 35% del núcleo

Conserva el catálogo sectorial anterior de 55 actividades y su riesgo inherente preliminar 1–5, transformado a 0–100.

No se pierde trazabilidad: en el runtime se conserva tanto el valor base como el valor sectorial enriquecido.

### 2.3 ENR Chile · 25% del núcleo + proxy territorial

Fuente: **Evaluación Nacional de Riesgos de Lavado de Activos de Chile**, actualización 2023, publicada por la UAF el 9 de enero de 2024.

ATLAS utiliza cinco vulnerabilidades de la ENR con capacidad de discriminar exposición entre sectores:

- utilización de efectivo;
- mercado financiero y comercio internacional;
- nuevos productos y servicios de pago;
- zonas de libre comercio;
- extensas fronteras.

La vulnerabilidad sistémica asociada a deficiencias del marco normativo nacional ALA/CFT no se usa para diferenciar sectores, porque opera a nivel país.

La ENR también identifica una vulnerabilidad **asociada con la constitución de personas jurídicas**. ATLAS la representa en la capa territorial mediante el percentil de `entities_started_since_2024 / potential_total` dentro de las actividades SII homologadas. Es un proxy operativo de dinamismo reciente porque está disponible y es actualizable territorialmente; **inicio de actividades SII no equivale a fecha legal de constitución de una persona jurídica**.

La ENR no publica un score numérico oficial para cada uno de los 55 sectores UAF. Por tanto, ATLAS aplica adaptadores explícitos y auditables. Estos puntajes no deben presentarse como calificaciones oficiales de la UAF.

### 2.4 ICR · Índice de Convertibilidad de ROS · 20% del núcleo

Período: 2021–2025.

Conceptualmente:

`ICR = ROS con indicios LA/FT / ROS enviados a UAF`

Para evitar que un sector con pocos ROS obtenga valores extremos por denominadores pequeños, ATLAS utiliza una tasa suavizada con enfoque Empirical Bayes:

`ICR posterior = (indicios sector + k × tasa nacional) / (ROS sector + k)`

con `k = 100 ROS`.

Posteriormente, el ICR posterior se transforma a percentil sectorial 0–100. Sectores sin ROS enviados en el período reciben un valor neutral de 50 en esta dimensión, en vez de ser tratados como cero.

**Guardrail:** ICR es una tasa histórica agregada de conversión analítica. No mide calidad de un ROS individual, riesgo de una entidad ni cumplimiento del sujeto obligado.

### 2.5 Materialidad sectorial GAFILAT · 20% del núcleo

Fuente: Informe de Evaluación Mutua de Chile, GAFILAT 2021.

La evaluación identifica diferencias de peso relativo entre sectores. ATLAS las transforma en cuatro niveles transparentes:

- **100**: mayor peso relativo, incluyendo banca, mercado de valores, notarios y corredores de propiedades;
- **75**: casas de cambio, transferencias de dinero y casinos;
- **50**: pensiones, seguros y conservadores;
- **25**: resto de sectores.

Es un **adaptador ATLAS de materialidad relativa**, no un score numérico oficial de GAFILAT.

## 3. Materialidad territorial SII · 15% de V/E

La segunda capa evita que dos territorios con una composición sectorial parecida sean tratados como equivalentes cuando difieren en escala y dinamismo económico.

`Materialidad SII = 50% pctl tramo medio de ventas + 30% pctl trabajadores por entidad activa + 20% pctl inicios de actividad 2024+ en universo potencial`

Variables:

- `avg_sales_band_rank`;
- `workers_total / active_entity_count`;
- `entities_started_since_2024 / potential_total` para actividades homologadas a sectores UAF.

La normalización se realiza como percentil nacional separadamente para regiones y comunas.

El componente se limita a 15% de V/E para impedir que el tamaño o dinamismo económico general de una región domine el riesgo geográfico por sí solo. El tercer indicador es un proxy de formación/dinamismo reciente y no una fecha jurídica de constitución.

## 4. Agregación territorial

Por territorio:

1. se identifican presencias activas SII en actividades homologadas a sectores UAF mediante reglas `VALIDATED_RULE` con confianza mínima 0,85;
2. cada presencia se pondera por el núcleo sectorial enriquecido;
3. se calcula el promedio ponderado del núcleo sectorial;
4. se incorpora la materialidad territorial SII del territorio;
5. el V/E resultante reemplaza únicamente el componente de 45% de la fórmula original;
6. Densidad SO, Brecha y Amenaza CEAD conservan su metodología vigente.

## 5. Fuentes

- UAF Chile · Evaluación Nacional de Riesgos de Lavado de Activos, actualización 2023: `https://www.uaf.cl/media/ArchivoEstatico/ENR_LA_5552.pdf`
- GAFILAT · Informe de Evaluación Mutua de Chile 2021: `https://www.uaf.cl/ArchivoEstatico/InformeEvaluacionChile2021.pdf`
- UAF · Informe Estadístico 2025, ROS sectoriales y ROS con indicios: `https://www.uaf.cl/media/documentos/Informe_Estadistico_2025.pdf`
- Radar UAF · `reportability_sector_2025.json`
- Radar UAF · `ros_conversion_sector_2021_2025.json`
- Radar SII / Supabase · `aml_v022_geo_economic_region`, `aml_v022_geo_economic_commune`, `aml_v022_geo_activity_region` y `aml_v022_geo_activity_commune`.

## 6. Qué se mantiene fuera de V/E

Para evitar doble conteo y circularidad no se incorporan dentro de V/E:

- Densidad de SO, porque ya pesa 20% del IRG;
- Brecha UAF↔SII, porque ya pesa 20%;
- delitos CEAD, porque ya pesan 15% como Amenaza;
- sanciones o supervisiones, para no convertir consecuencias regulatorias en vulnerabilidad inherente;
- prensa, CGR, Presupuesto Abierto y OSFL, que continúan como evidencia/contexto complementario con aporte directo 0 al IRG.

## 7. Lectura correcta

V/E v2 busca responder mejor tres preguntas:

1. **¿Qué tan vulnerables/materiales son los sectores presentes en el territorio?**
2. **¿Qué escala económica tiene esa exposición?**
3. **¿Está creciendo recientemente el universo potencial en actividades sensibles?**

No responde si una empresa concreta lava activos ni si un territorio es responsable de actividad criminal.

## 8. Guardrails

- `TOP_LEVEL_IRG_WEIGHTS_UNCHANGED_45_20_20_15`
- `ENR_ADAPTER_IS_NOT_OFFICIAL_UAF_SECTOR_SCORE`
- `GAFILAT_TIER_IS_ANALYTICAL_ADAPTER_NOT_OFFICIAL_NUMERIC_SCORE`
- `ICR_IS_AGGREGATE_HISTORICAL_CONVERSION_NOT_ENTITY_RISK`
- `ECONOMIC_SCALE_IS_EXPOSURE_NOT_SUSPICION`
- `SII_ACTIVITY_IS_NOT_UAF_LEGAL_STATUS`
- `SII_ACTIVITY_START_IS_NOT_LEGAL_INCORPORATION_DATE`
- `TERRITORIAL_RISK_IS_NOT_ENTITY_RISK`

## 9. Trazabilidad y exportación

La interfaz muestra en la ficha V/E:

- V/E final;
- núcleo sectorial;
- materialidad territorial SII;
- percentil de ventas;
- percentil de trabajadores por entidad;
- percentil de inicios de actividad 2024+ en universo potencial;
- para los sectores principales: Base, ENR, ICR y GAFILAT.

La exportación CSV/JSON de Territorio se intercepta en V/E v2 y publica la versión metodológica `IRG-LAFT-0.33.0` junto con los componentes internos disponibles.
