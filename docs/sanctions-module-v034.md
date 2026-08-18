# Sanciones v12 · integración AML Workbench v0.34.0

## Objetivo
Reemplaza la sección histórica **Sanciones** por la interfaz v12 aprobada, manteniendo la arquitectura gobernada del Workbench.

## Autoridad y actualización de datos
1. **Radar Sanciones** (`Radar_sanciones/docs/data/events.json`) es la fuente autoritativa de eventos y se refresca con su propia cadencia.
2. **`aml_v028_sanctions_with_identity`** aporta identidad gobernada y materialización Workbench. La vista v12 mezcla el evento más reciente del radar con esta capa sin borrar eventos aún no materializados.
3. **`aml_v0205_uaf_sii_reconciliation`** gobierna la condición visible **SO inscrito**. Si esta fuente no está disponible, la clasificación SO no se infiere y el módulo cae a la vista anterior.
4. **Potencial SO** es una señal de *screening*, nunca una determinación jurídica. Se usa evidencia conservadora: sanción UAF sin inscripción vigente, marca LA/FT directa, sector analítico compatible o referencias explícitas al perímetro UAF.
5. La ausencia del puerto detallado **RUT↔ACTECO** impide considerar ACTECO como confirmación automática.

## IER
El **Índice de Exposición Relativa** se recalcula al cargar la vista. Es una prioridad analítica, no probabilidad de LA/FT.

Factores:
- recurrencia sancionatoria: 22;
- severidad/magnitud UF: 20;
- materia LA/FT directa: 18;
- convergencia supervisora: 12;
- recencia: 15;
- vinculación documental/co-resolución: 8;
- señal de brecha de perímetro: 15.

El resultado se acota a 0–100 y expone sus factores en la ficha.

## Freshness y degradación
- El módulo compara `latest_event_date` del Radar Sanciones con la última fecha materializada en Workbench.
- Si el radar está adelantado, los eventos directos siguen visibles pero la interfaz advierte que la identidad/materialización puede estar pendiente.
- Fallos de Radar Sanciones o de identidad gobernada se muestran explícitamente.
- La clasificación UAF es requisito crítico; ante fallo se ofrece la sección anterior para evitar etiquetado silencioso incorrecto.

## Contrato UX
- Universo: **SO inscritos / Otras entidades / Potenciales SO**.
- Supervisores: multiselección, todos por defecto.
- Búsqueda RUT/entidad: prominente y desplaza a la tabla.
- Top 5: responde exclusivamente a período, universo y supervisor.
- Gráficos secundarios actúan como filtros reversibles.
- IER incluye ayuda por hover y explicación de cálculo.
