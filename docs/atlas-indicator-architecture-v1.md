# ATLAS AML · Arquitectura gobernada de indicadores v1

**Vigencia metodológica:** 26-08-2026  
**Autoridad máquina:** `data/atlas_indicator_methodology_v1.json`  
**Autoridad IGR:** `assets/atlas-territory-threat-cead-v1.js` → IGR v2A  
**Autoridad de presentación:** `assets/atlas-indicator-methodology-0910.js`

## Objetivo

ATLAS separa las preguntas de riesgo y supervisión para evitar doble conteo, falsas equivalencias y proliferación de scores. Cada indicador tiene un único propósito. La integración ocurre sólo en la capa de priorización supervisora y únicamente cuando los insumos tienen cobertura suficiente.

## Arquitectura

| Dominio | Indicador | Estado | Pregunta que responde |
|---|---|---|---|
| Sector | **IRAR-E** | Fórmula gobernada; materialización de insumos pendiente | ¿Qué tan expuesta inherentemente está esta actividad a LA/FT/FP? |
| Territorio | **IGR** | **Activo · v2A gobernado** | ¿Dónde existe mayor amenaza territorial relevante para LA? |
| Entidad | **IPA** | Activo/shadow | ¿Qué entidades concentran señales que justifican revisión? |
| Potenciales SO | **IVO** | Activo/screening | ¿Qué tan verosímil es que una entidad corresponda a una actividad obligada? |
| Reportabilidad | **IRAR** | Activo | ¿Qué rendimiento analítico agregado muestran los ROS? |
| Controles | **Mitigación / Cumplimiento** | Creado/shadow, sin score hasta cobertura | ¿Qué tan robusta o débil es la capacidad mitigadora observada? |
| Cobertura | **BCR** | Creado/derivado | ¿Qué tan amplia parece la brecha entre inscritos y potenciales plausibles? |
| Supervisión | **Prioridad de Fiscalización** | Creada/gobernada, sin pesos por defecto | ¿Qué casos deben priorizarse cuando convergen sector, territorio, entidad y controles? |

## 1. IRAR-E · Riesgo inherente sectorial

Se crea como autoridad sectorial y **no reemplaza al IRAR de ROS**.

`IRAR-E = 0,40 × Vulnerabilidad estructural + 0,30 × Materialidad + 0,30 × Amenaza LA/FT/FP`

- **Vulnerabilidad estructural:** efectivo, anonimato/opacidad, internacionalidad, velocidad y transferibilidad, intervención de terceros, complejidad jurídica/societaria, canales y productos propios del sector.
- **Materialidad:** escala y relevancia económica normalizadas, sin convertir tamaño en sinónimo de riesgo.
- **Amenaza:** exposición sectorial demostrada a amenazas LA/FT/FP con ENR Chile, evaluaciones/estándares GAFI-GAFILAT, tipologías UAF y evidencia LA/FT. CEAD o criminalidad general aislada no son suficientes para asignar amenaza sectorial.

Los tres componentes son obligatorios. Un faltante no se imputa como cero ni provoca renormalización silenciosa.

## 2. IGR · Índice de Riesgo Geográfico

Desde IGR v2A, el indicador territorial queda **deliberadamente separado del riesgo sectorial y del riesgo/prioridad individual**. Se retiran del IGR la antigua V/E sectorial, la densidad de sujetos obligados, la brecha potencial de cobertura y cualquier enriquecimiento con ICR/IRAR.

### 2.1 Fórmula vigente · IGR v2A

`IGR v2A = 1,00 × Amenaza territorial CEAD-LA`

La capa CEAD-LA mantiene:

- **55% Amenazas precedentes LA**.
- **35% Economía criminal / facilitadores**.
- **10% Contexto criminógeno**.

Cada driver se caracteriza con:

- **40% intensidad territorial**;
- **25% persistencia**;
- **20% tendencia**;
- **15% anomalía**.

La capa de amenazas precedentes está materializada actualmente principalmente con tráfico, microtráfico y elaboración/producción de drogas. ATLAS no presenta todavía fraude, corrupción, delitos económicos, contrabando u otras amenazas ENR como si existiera cobertura territorial suficiente: esas familias deberán incorporarse cuando exista una fuente trazable.

La historia 2020–2025 se reconstruye con casos policiales CEAD reales y la misma lógica anual. No se usan series sintéticas para completar años faltantes.

### 2.2 Agregación regional

El dato comunal es la unidad territorial base. El IGR regional se obtiene como **media comunal ponderada por la confianza CEAD disponible**. Una evidencia solamente regional no se fuerza a una comuna.

### 2.3 Confianza

La confianza se publica separadamente del score. Menor cobertura no se convierte en menor riesgo y `missing != 0` permanece como regla global.

### 2.4 Evolución gobernada

ATLAS no reserva pesos con valores 0/50 ni renormaliza silenciosamente dimensiones aún inexistentes.

- **v2A:** `100% CEAD-LA`.
- **v2B:** `85% CEAD-LA + 15% Exposición transfronteriza/logística`.
- **v2C:** `75% CEAD-LA + 15% Exposición transfronteriza/logística + 10% Evidencia territorial LA`.

Las capas futuras sólo entrarán al score cuando sus pipelines tengan datos reales, trazabilidad y cobertura suficientes.

### 2.5 Guardarraíles

- El IGR es **contexto territorial**, no atribución de conducta a una persona o empresa.
- No incorpora IRAR-E ni otra vulnerabilidad sectorial.
- No incorpora IPA, IVO, sanciones individuales o comportamiento de una entidad.
- No incorpora densidad SO ni brecha regulatoria.
- No es probabilidad de LA/FT.
- La presencia de criminalidad es una señal de amenaza territorial; por sí sola no acredita lavado de activos.

Con esto, la arquitectura queda ortogonal:

`IRAR-E = sector`  
`IGR = territorio`  
`IPA = entidad`  
`Mitigación = controles`

## 3. IPA · Índice de Prioridad Analítica

Desde esta versión, el nombre visible es **IPA**. `IPA3`, `ipa3` y `ipa3_*` permanecen exclusivamente como aliases técnicos para no romper vistas, tablas, snapshots, pruebas ni históricos.

IPA conserva la metodología del motor vigente: marcas registrales, económicas y sancionatorias gobernadas, topes, recencia, absorción de señales correlacionadas y comparación entre pares cuando corresponde.

Guardarraíles permanentes:

- IPA **ordena una cola de revisión**; no estima probabilidad de LA/FT.
- Cero significa ausencia de marcas activas, no “riesgo cero”.
- Ausencia de fuente no equivale a cero.
- Una sanción administrativa es contexto supervisor, no prueba de delito.

## 4. IVO · Índice de Verosimilitud de Obligación

IVO permanece en el carril de **Potenciales SO**. Es screening registral/sectorial y no forma parte del riesgo LA/FT ni de la Prioridad de Fiscalización de SO ya inscritos.

La **materialidad de incorporación** continúa separada de IVO. Una entidad puede ser muy verosímil como SO y poco accionable, o viceversa.

## 5. IRAR · Rendimiento Analítico de ROS

IRAR conserva su significado actual: rendimiento analítico agregado de la reportabilidad ROS. La semejanza de siglas con IRAR-E no implica relación jerárquica ni sustitución.

- `IRAR` → reportabilidad ROS.
- `IRAR-E` → riesgo inherente sectorial.

IRAR ya no alimenta IGR desde v2A.

## 6. Mitigación / Cumplimiento

Se crea la dimensión de controles, separada del riesgo inherente. Sus fuentes objetivo son:

1. resultados de fiscalización y corrección de hallazgos;
2. calidad, oportunidad y comportamiento de reporte;
3. madurez preventiva observable;
4. sanciones/reincidencia como contexto, nunca como único conductor.

**No se publica un score numérico hasta disponer de cobertura suficiente y una regla de agregación validada.** La ausencia de evidencia de controles no se interpreta como buena mitigación.

## 7. BCR · Brecha de Cobertura Regulatoria

Métrica sectorial derivada:

`BCR = 100 × potenciales plausibles / (SO inscritos + potenciales plausibles)`

El numerador debe usar un criterio de potencial plausible documentado para el corte; IVO y materialidad pueden apoyar la lectura, pero no convierten al candidato en obligado. BCR es una señal de cobertura y **no prueba subregistro, incumplimiento o LA/FT**.

BCR permanece fuera del IGR desde v2A.

## 8. Prioridad de Fiscalización

Se crea como capa final de síntesis:

`Prioridad de Fiscalización = f(IRAR-E, IGR, IPA, debilidad mitigadora)`

No se fijan ponderadores por defecto. El cálculo queda **gated** hasta que exista una ponderación aprobada, cobertura mínima y trazabilidad completa de los cuatro insumos.

IVO queda explícitamente excluido: pertenece al flujo de detección/incorporación de potenciales SO.

## Política de presentación y compatibilidad

1. Toda mención visible a `IPA3` se normaliza a **IPA**.
2. Los nombres técnicos `ipa3_*` no se renombran en base de datos ni contratos existentes.
3. Toda aparición de IRAR-E, IGR, IPA, IVO, IRAR, Mitigación/Cumplimiento, BCR o Prioridad de Fiscalización recibe ayuda metodológica.
4. Para IGR, toda vista debe consumir la autoridad `IGR-2A-1.0.0`; el contrato histórico 45/20/20/15 queda retirado.
5. La ayuda distingue score, cobertura, confianza y estado de materialización.
6. `missing != 0` es una regla global.
7. Ningún score de esta arquitectura debe presentarse como probabilidad de LA/FT.

## Flujo supervisor objetivo

### SO inscritos

`IRAR-E (sector) + IGR (territorio) + IPA (entidad) + Mitigación/Cumplimiento → Prioridad de Fiscalización`

### Potenciales SO

`ACTECO / evidencia registral + IVO + Materialidad de incorporación → screening y gestión de incorporación`

La separación evita que una señal de posible obligación se transforme artificialmente en riesgo LA/FT y evita contar dos veces sector o territorio dentro del riesgo individual.

## Implementación vigente

- Registro metodológico machine-readable.
- **IGR v2A como autoridad territorial única de ATLAS**.
- Nueva sección Territorio basada en mapa comunal, ficha explicable, historia real 2020–2025, drivers, matriz Exposición × Dinámica y confianza separada.
- Compatibilidad para consumidores históricos mediante `AML_IRG_TERRITORY`, conservando `regions`, `communes`, `irg` y `confidence`, pero alimentados por el nuevo score.
- Motores heredados V/E e IRAR→IGR retirados como fuentes de cálculo.
- Alias visible `IPA`; compatibilidad técnica con `IPA3`.
- Calculador gobernado de IRAR-E, que devuelve `null` si falta cualquiera de sus tres componentes.
- Calculador derivado de BCR.
- Calculador de Prioridad de Fiscalización **sólo** cuando el módulo llamador entrega ponderadores explícitos que suman 1 y todos los insumos están disponibles.
- Mitigación/Cumplimiento queda creada como dimensión shadow sin score automático hasta validar cobertura y agregación.
