# Radar Integrado 0.69 · representación sectorial

Atlas distingue tres conceptos que no deben confundirse:

- **Catálogo canónico:** 55 actividades/sectores gobernados por el contrato sectorial de Atlas.
- **Sectores representados:** sectores que aparecen con sujetos obligados inscritos en el corte o contrato estadístico consultado.
- **Grafías/agrupaciones de fuente:** etiquetas tal como son publicadas por la fuente, que pueden variar según normalización y producto estadístico.

Por esta razón, un análisis puede mostrar 48 sectores en el contrato `uaf_reportability_sector_2025.json` y 49 en el snapshot operacional de sujetos obligados, sin que ello reduzca el catálogo canónico de 55.

El Radar Integrado incorpora el cuadro **Sectores económicos sin representación** después del bloque histórico 2021–2025. El valor se calcula como `55 - sectores representados` utilizando el total del propio contrato mostrado por la matriz, no el número de filas resultante de un filtro interactivo.

En el contrato estadístico 2025 actualmente materializado, 48 sectores representados equivalen a 7 sectores sin representación observada. La expresión “sin representación” no implica que la actividad esté fuera de la Ley 19.913 ni constituye por sí sola incumplimiento o riesgo.

No se construye una serie anual 2021–2025 de sectores sin representación porque el contrato histórico actual contiene series ROS por sector y padrón al cierre 2025, pero no un padrón sectorial completo para cada uno de los cinco años. La posición visual del nuevo cuadro es posterior al bloque histórico; su corte de representación es 2025.
