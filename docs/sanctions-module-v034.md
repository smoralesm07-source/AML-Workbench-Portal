# Sanciones v12 · integración AML Workbench v0.34.1

## Objetivo
Reemplaza la sección histórica **Sanciones** por la interfaz v12 aprobada, manteniendo la arquitectura gobernada del Workbench y conectándola al contrato real de Radar Sanciones.

## Autoridad e interoperabilidad de datos
1. **Radar Sanciones** (`Radar_sanciones/docs/data/events.json`) gobierna los eventos y se refresca con su propia cadencia.
2. El adaptador reconoce explícitamente `rut_fuente`, `entity_id`, `source_record_id`, `evidence_id`, `document_status` y `document_confidence` del feed real del radar.
3. **Radar Sanciones Entity Hub v1** (`docs/data/entity_hub_v1.json`) aporta identidad interoperable para eventos todavía no materializados en Workbench. Los RUT se normalizan al identificador canónico `ENT-RUT-<RUT>`.
4. **`aml_v028_sanctions_with_identity`** aporta identidad gobernada y materialización Workbench. Cuando existe coincidencia, prevalece la identidad gobernada sin perder la evidencia original del radar.
5. **`aml_v0205_uaf_sii_reconciliation`** gobierna la condición visible **SO inscrito**. La ausencia de coincidencia no se interpreta automáticamente como incumplimiento.
6. **Potencial SO** es una señal de *screening*, nunca una determinación jurídica. Se usa evidencia conservadora: sanción UAF sin inscripción vigente observable, marca LA/FT directa, sector analítico compatible o referencias explícitas al perímetro UAF.
7. La actividad SII/ACTECO puede apoyar screening, pero no acredita por sí sola la calidad jurídica de sujeto obligado.

## IER
El **Índice de Exposición Relativa** es una prioridad analítica de entidad, no una probabilidad de LA/FT. Se recalcula cuando cambia la evidencia disponible del módulo y utiliza la historia completa de la entidad; los filtros de pantalla no reescriben el score.

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
- Si el radar está adelantado, los eventos directos siguen visibles y la interfaz advierte que la identidad/materialización puede estar pendiente.
- Si falla Entity Hub, se conserva la identidad disponible por Workbench/RUT y se muestra la degradación.
- Fallos de Radar Sanciones o de identidad gobernada se muestran explícitamente.
- La clasificación UAF es requisito crítico; ante fallo se ofrece la sección anterior como fallback técnico para evitar etiquetado silencioso incorrecto.

## Seguridad y trazabilidad
- Los enlaces de evidencia se restringen a `http`/`https` antes de renderizarse.
- La ficha de entidad expone, cuando está disponible, `entity_id`, estado/método/confianza de identidad, `source_record_id`, `evidence_id` y estado/confianza documental.
- Se preserva la diferencia entre dato fuente, identidad reconciliada, señal de screening y score analítico.

## Contrato UX
- Universo: **SO inscritos / Otras entidades / Potenciales SO**.
- Supervisores: multiselección, todos por defecto.
- Búsqueda RUT/entidad: prominente y desplaza a la tabla.
- Top 5: responde a período, universo y supervisor activos.
- Gráficos secundarios actúan como filtros reversibles.
- IER incluye ayuda contextual y explicación de cálculo.
- La tabla mantiene centrados eventos, UF, IER y última fecha.

## Validación
El workflow `validate-v034-sanctions.yml` valida sintaxis, carga en `index.html`, contrato de interoperabilidad, normalización de RUT/Entity Hub, sanitización de URL y una prueba runtime con fixture equivalente al esquema real de Radar Sanciones.
