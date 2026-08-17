# Auditoría del ecosistema AML · v0.20

**Corte:** 2026-08-17  
**Objetivo:** revisar productores, interoperabilidad, materialización y experiencia Workbench para priorizar mejoras sin mezclar hechos, contexto y riesgo.

## 1. Conclusión ejecutiva

El ecosistema tiene más capacidad analítica en los radares de origen que la actualmente expuesta como objetos de primera clase en el Workbench. La brecha principal ya no es de recolección general: es de **materialización selectiva, experiencia visual y contratos compactos de consumo**.

La regla de evolución es:

`RADAR FUENTE -> CONTRATO COMPACTO -> FUSION -> AGREGADO AUTORIZADO -> WORKBENCH -> DRILL-DOWN`

No se recomienda copiar bases masivas a la aplicación ni construir un score universal que mezcle señales de distinta semántica.

## 2. Estado por productor

| Productor | Activo principal | Fusion | Workbench v0.20 | Mejora prioritaria |
|---|---|---|---|---|
| Radar SII | Historia empresa-año, actividades, domicilios, ownership y señales | Listo / Parquet nativo | Directo en hallazgos + perfil tributario | Incorporar microseries 2020-2024 y comparables en Entity 360 |
| Radar UAF | SO inscritos, estadísticas, ROS/ROE, normativa | Listo | Directo + Inteligencia UAF | Consolidar snapshots semestrales de registro y reportabilidad longitudinal |
| Radar OSFL | Universo OSFL, candidatos R.8 y señales de exposición | Listo | Directo en hallazgos | Vista OSFL específica y explicación de candidatura R.8 |
| Radar Sanciones | Casos/hechos, temporalidad, recurrencia | Listo | Directo + tabla de sanciones | Mejorar timeline, regulador y recurrencia por entidad |
| Radar CGR | Temporalidad, WATCH, enforcement, FAU | Listo con identidad relacional parcial | No expuesto como vista propia | Materializar enforcement/early warning y vínculos confiables en Workbench |
| Radar Delictual | CEAD comunal, Art. 27, contexto territorial | Listo como contexto territorial | No expuesto como vista propia | Añadir presión delictual elegible como contexto territorial, nunca heredada por entidad |
| Radar Prensa | Recurrencia, momentum y clusters | Context signal listo | Contexto visible | Añadir recurrencia de entidad en 360 sin modificar score AML |
| Context Hub | Territorio, Sector Hub, benchmark económico, contexto | Proveedor de contexto | Contexto económico visible | Incorporar benchmark de pares y nuevas capas sólo cuando tengan cobertura suficiente |
| Presupuesto Abierto | 14,1 M transacciones, 79.871 señales, prioridad 0-100 y CGR | Adaptador pendiente | Preview v0.20, no canónico | Completar adaptador Fusion de señales/evidencia/lineage |

## 3. Hallazgos de materialización

En el Workbench actual existen 47.186 entidades, 18.231 hallazgos, 974 sanciones y 95 patrones materializados.

Participación de productores en `aml_findings` al corte auditado:

- Radar SII: 18.097 hallazgos.
- Radar UAF: 5.596.
- Radar OSFL: 3.726.
- Radar Sanciones: 324.

CGR y Delictual están verificados en Fusion, pero todavía no participan como productores de hallazgos en la materialización Supabase consumida por la interfaz. Prensa y Context Hub se consumen como contexto separado. Presupuesto Abierto se expone desde v0.20 mediante preview explícitamente no canónico.

## 4. Cambios v0.20

### Visualización

La portada incorpora cuatro lecturas 0-100 con semánticas separadas:

1. **IPA**: prioridad de revisión de hallazgos.
2. **Fuerza de patrón**: intensidad comparativa de reglas/patrones.
3. **Cobertura Fusion**: madurez técnica de integración de productores.
4. **Cobertura Workbench**: productores efectivamente visibles en la aplicación.

Los dos últimos son scores de ingeniería, no scores AML.

Gráficos agregados:

- composición de hallazgos por tipo;
- distribución de IPA;
- evolución ROS 2021-2025;
- sanciones 2020-2026, diferenciando LA/FT directo materializado;
- familias de patrones;
- matriz de cobertura por productor;
- preview de prioridades P1/P2/P3 de Presupuesto Abierto.

### Datos

Se crean vistas agregadas `security_invoker` para evitar descargar hechos masivos al navegador:

- `aml_v020_finding_mix`
- `aml_v020_score_band`
- `aml_v020_pattern_family`
- `aml_v020_sanction_year`
- `aml_v020_producer_findings`

Acceso: `authenticated`; `anon` revocado.

### Presupuesto Abierto

Se incorpora `docs/data/fusion_preview.json`, regenerado por `dashboard.py` en futuras corridas. El preview contiene métricas, tiers y un top acotado de señales. No promueve señales a `finding` y declara explícitamente que el adaptador Fusion sigue pendiente.

## 5. Backlog recomendado

### P0 · integración

1. **Adaptador Fusion para Presupuesto Abierto**: hechos, señales, evidencia y lineage; mantener score propio de prioridad sin transformarlo en score AML.
2. **CGR como objeto de primera clase en Workbench**: enforcement, WATCH→informe y remisiones MP/CDE.
3. **Delictual como contexto territorial gobernado**: artículo 27, temporalidad y cobertura; nunca propagar a entidades por residencia.

### P1 · experiencia analítica

4. **Entity 360 longitudinal SII**: ventas por tramo, trabajadores, actividad, domicilio y señales 2020-2024 en micrográficos.
5. **Entity 360 temporal de sanciones/CGR/prensa**: una línea de tiempo común de eventos con semántica por fuente.
6. **Vista Redes**: activar sólo relaciones con endpoints canónicos; distinguir observada, candidata y contextual.
7. **Explorador sectorial**: combinar UAF, SII, sanciones, anomalías y contexto por sector sin sumar scores incompatibles.

### P2 · arquitectura

8. **Consolidar front-end**: las capas v0.16-v0.20 son deuda técnica. Después de estabilizar v0.20, migrar a módulos `data`, `domain`, `views`, `charts`, `navigation` y `entity360`, manteniendo el comportamiento actual.
9. **Contrato `producer_status` automatizado**: publicar desde Fusion un snapshot público/consumible con cobertura y frescura para reemplazar el audit snapshot manual.
10. **Quality/Freshness visible**: fecha del último snapshot y cobertura por productor como dimensión separada de riesgo y confianza.

## 6. Guardrails permanentes

- `missing != zero`.
- Actividad SII no determina por sí sola condición jurídica UAF.
- Silencio ROS no prueba incumplimiento individual.
- Sanción administrativa no acredita LA/FT.
- Contexto territorial/delictual no se hereda a entidades.
- Prensa es contexto secundario y no modifica scores AML.
- Confianza, cobertura y frescura no son riesgo.
- Un score de priorización ordena trabajo: no representa probabilidad de delito.
