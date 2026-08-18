# Riesgo geográfico · refinamiento v0.31.2

## Objetivo

Simplificar la lectura del módulo territorial y hacer trazable el componente CEAD sin modificar el cálculo gobernado existente.

## 1. Nueva marca visible

La interfaz deja de presentar `Score B` como denominación de negocio.

**Marca visible:** `Índice de Prioridad Territorial (IPT)`.

El IPT expresa una posición relativa para priorizar territorios que merecen profundización. No representa probabilidad de LA/FT.

Por compatibilidad y trazabilidad, el motor mantiene internamente:

- `scores.B`;
- método interno `B`;
- fórmula `GEO-RISK-B-0.27.0`.

La capa visual no modifica pesos ni valores.

## 2. Simplificación analítica

Se eliminan de la vista:

- cuadro `Drivers dominantes`;
- cuadro `Consistencia`;
- filtro por driver;
- filtro por matriz score/confianza.

Los estados heredados de esos filtros se limpian antes de renderizar para evitar filtros invisibles.

Permanecen como gráficos de decisión:

1. fenómenos territoriales que más se repiten;
2. componentes que elevan la prioridad territorial.

En la ficha regional se reemplaza el lenguaje `driver` por `factor principal` y `segundo factor`.

## 3. CEAD · ficha de evidencia

La vista CEAD pasa de un único percentil a una ficha con tres niveles:

### Señal normalizada

- percentil CEAD utilizado por el IPT;
- intensidad por 1.000 entidades activas;
- variación interanual.

### Hecho observado

- casos policiales del último corte;
- casos del período comparable anterior;
- participación de cada familia en el total regional;
- cantidad de comunas observadas.

### Delitos detrás de la familia

Se utiliza el catálogo gobernado `cead_catalog_art27_v4.json` para presentar los subgrupos comprendidos por la familia CEAD y su condición de homologación jurídica.

Para `family:4`, por ejemplo, la ficha permite distinguir:

- tráfico de sustancias;
- microtráfico de sustancias;
- elaboración o producción de sustancias;
- otras infracciones a la Ley 20.000, identificadas como categoría que requiere mayor precisión penal.

La ficha no inventa un conteo por subgrupo cuando el corte utilizado está agregado a nivel de familia.

## 4. Trazabilidad CEAD

La ficha incorpora accesos a:

- Portal oficial CEAD de estadísticas delictuales;
- dataset exacto consumido por Radar Delictual;
- catálogo CEAD ↔ artículo 27 utilizado para la lectura AML.

Semántica obligatoria:

`CEAD_CASES_ARE_TERRITORIAL_NOT_ENTITY_ATTRIBUTION`

Un caso policial territorial no acredita delito base de una persona o entidad, ni se transfiere automáticamente como riesgo LA/FT.

## 5. Comparador regional

La tabla se reconstruye para caber en el ancho útil de escritorio sin desplazamiento horizontal.

Se eliminó la columna de driver y se agruparon métricas relacionadas:

- Presupuesto / CGR;
- IPA3 / Sector.

La tabla usa `table-layout: fixed`, anchos relativos y texto truncado controlado. En pantallas pequeñas puede habilitar desplazamiento horizontal como mecanismo responsive, pero en escritorio el contrato UX es `NO_HORIZONTAL_SCROLL`.

## 6. Exportación

Los archivos pasan a denominarse `aml_indice_prioridad_territorial_*` y agregan:

- `indicator_name = Índice de Prioridad Territorial`;
- `indicator_acronym = IPT`;
- `ipt_value`;
- `analytical_view_version = TERRITORY-CLARITY-0.31.2`.

El identificador interno `B` se conserva únicamente dentro de `technical_contract` para trazabilidad retrospectiva.
