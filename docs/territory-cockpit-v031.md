# Riesgo geográfico · Cockpit territorial v0.31.0

## Objetivo

La versión 0.31.0 rediseña completamente la experiencia de **Riesgo geográfico** para responder, en este orden:

1. **Dónde** se concentra la señal territorial.
2. **Qué driver** explica principalmente esa posición relativa.
3. **Qué fenómenos** son evidentes en el corte.
4. **Qué tan consistente** es la explicación.
5. **Dónde profundizar** dentro de la región.

La vista toma como referencia la gramática visual del módulo OSFL nativo: mapa regional por polígonos, selector de métrica, ranking lateral, ficha de territorio, tarjetas de composición y listas compactas. La semántica AML permanece separada de OSFL.

## Contrato metodológico

- Score territorial definitivo: **B · Percentil robusto**.
- Fórmula: `GEO-RISK-B-0.27.0`.
- Versión de experiencia analítica: `TERRITORY-COCKPIT-0.31.0`.
- IPA3: `0.4-shadow`.
- v0.31.0 **no modifica pesos, percentiles ni reglas de Score B**.

### Componentes Score B regional

| Componente | Peso |
|---|---:|
| CEAD | 25,50% |
| Presupuesto Abierto | 21,25% |
| Sectores asociados a Ley 19.913 | 17,00% |
| IPA3 | 15,00% |
| CGR | 12,75% |
| Convergencia | 8,50% |

Los pesos se renormalizan sólo entre componentes realmente observados según el contrato vigente. Un dato ausente no se transforma en cero.

## Mapa

El cockpit reutiliza la geometría regional `V030_CHILE` del módulo OSFL, con 16 polígonos regionales. El mapa de Riesgo geográfico puede proyectar las siguientes capas sin recalcular Score B:

- Score B.
- CEAD.
- Presupuesto Abierto.
- CGR.
- IPA3.
- Sectores Ley 19.913.
- Convergencia.
- Perfil conductor.
- OSFL como **contexto no puntuante**.
- Prensa como **contexto no puntuante**.

Las capas numéricas usan umbrales estables 0–20–40–60–75–100. No se reescala el color contra el máximo visible, para que el mismo color conserve significado al cambiar filtros.

## Filtros sincronizados

La vista mantiene un único estado de filtros compartido por:

- mapa;
- ranking lateral;
- dossier regional;
- fenómenos;
- drivers;
- matriz Score B × confianza;
- tabla regional.

Dimensiones disponibles:

- región;
- perfil conductor;
- fenómeno;
- driver principal;
- cuadrante Score B × confianza.

Cada gráfico recalcula su distribución sobre el subconjunto visible. Al contabilizar opciones de una dimensión, se omite temporalmente el propio filtro de esa dimensión para evitar filtros autodestructivos.

## Dossier AML regional

La región seleccionada expone:

- Score B y banda;
- prioridad analítica;
- driver principal;
- segundo driver y brecha;
- confianza explicativa;
- cobertura del Score B;
- huella de los seis componentes;
- fenómenos evidentes;
- CEAD observado y variación disponible;
- OSFL y prensa como contexto;
- comunas de mayor Score B disponible;
- principales sectores homologados `VALIDATED_RULE`.

La prioridad analítica (`Priorizar`, `Profundizar`, `Monitorear`, `Contexto`) es una ayuda de navegación y no altera Score B.

## Fenómenos

v0.31.0 reutiliza el catálogo determinístico gobernado de v0.29.0, incluyendo, entre otros:

- riesgo alto con explicación sólida;
- convergencia multifuente;
- tensión entre drivers;
- presión CEAD elevada;
- aceleración CEAD reciente;
- presión presupuestaria elevada;
- presión CGR elevada;
- dominancia IPA registral;
- dominancia IPA sancionatoria;
- presión IPA3 muy elevada;
- alta exposición sectorial Ley 19.913;
- formación reciente intensa;
- riesgo alto con explicación inestable;
- cobertura analítica frágil.

Las marcas son explicativas y **no suman puntos al score**.

## Guardrails

1. `MISSING_IS_NOT_ZERO_STRICT`
2. `PHENOMENA_DO_NOT_CHANGE_SCORE_B`
3. `EXPLANATORY_PROFILE_IS_NOT_CAUSAL_INFERENCE`
4. `IPA3_SHADOW_NOT_LAFT_PROBABILITY`
5. `TERRITORIAL_SIGNAL_IS_NOT_ENTITY_ATTRIBUTION`
6. `OSFL_CONTEXT_DOES_NOT_SCORE`
7. `PRESS_CONTEXT_DOES_NOT_SCORE`

### Regla de atribución

Una región con Score B alto no convierte automáticamente en riesgosa a una persona o entidad por estar domiciliada, operar o aparecer vinculada territorialmente a ella. El territorio sirve para **priorizar preguntas y profundización**, no para atribuir conducta.

### Contexto OSFL

La presencia de OSFL es una capa descriptiva de exposición territorial. Pertenecer al universo OSFL, estar inscrito en un registro público o ser candidata funcional bajo FATF R.8 no constituye señal adversa por sí mismo.

### Prensa

La prensa orienta contexto y búsqueda de evidencia, pero no acredita delito, irregularidad o responsabilidad.

## UX

La jerarquía de lectura queda definida como:

1. hero y hallazgos del corte;
2. estado de fuentes;
3. filtros globales;
4. mapa + dossier regional;
5. gráficos de fenómenos, drivers, consistencia y presión de componentes;
6. comparador regional;
7. comunas y sectores para profundización;
8. guardrails y exportación.

Se priorizan tipografías legibles, contraste WCAG razonable, foco de teclado, `title`/`aria-label` en marcas y navegación de mapa mediante Enter/Espacio.

## Exportación

Las filas regionales mantienen `score_formula_version=GEO-RISK-B-0.27.0` e incorporan `analytical_view_version=TERRITORY-COCKPIT-0.31.0`.

La versión de experiencia nunca debe confundirse con una nueva calibración del score.
