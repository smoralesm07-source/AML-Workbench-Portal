# RES · backlog para demo experimental separado de ATLAS

Decisión de producto: **no incorporar estas analíticas al alcance operativo de ATLAS AML** en esta etapa. Pueden evaluarse posteriormente en un demo autónomo para evitar distorsionar la semántica actual del sistema.

## Fuera de ATLAS por ahora

1. Sociedades de constitución reciente con actividad intensa.
2. Término de giro y sociedades de vida corta como patrón analítico.
3. Cambios societarios alrededor de eventos relevantes.
4. Capital social versus magnitud económica.
5. Clústeres territoriales societarios.
6. Beneficiario final probabilístico, separado de evidencia jurídica.
7. Índice de complejidad societaria.

## Regla para ATLAS

ATLAS puede mostrar **hechos fuente** necesarios para caracterizar una entidad —por ejemplo, fecha de constitución RES, estado SII, término de giro publicado, presencia UAF, órdenes de compra y relaciones documentadas—, pero no debe convertir esos hechos en las hipótesis, ratios, scores o alertas anteriores.

El módulo RES 0.68 se limita a:

- línea de tiempo factual RES + SII + UAF + Mercado Público;
- contexto cruzado por RUT exacto;
- red societaria documentada;
- accesos rápidos por cobertura de fuentes;
- screening de potencial SO ya aprobado, con semántica `POTENTIAL_SO != LEGAL_BREACH`.

Toda extensión futura debe preservar `RUT_EXACTO_ONLY`, `DOCUMENTED_ONLY` para relaciones y `scoreMutation=false` para el contexto RES.
