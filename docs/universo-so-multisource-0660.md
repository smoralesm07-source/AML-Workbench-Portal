# Universo SO 0.66 · arquitectura multisource

## Objetivo

Permitir que el universo de Potenciales SO crezca con nuevas fuentes —partiendo por SII y RES— sin perder trazabilidad, sin duplicar RUT y sin volver a imponer filtros restrictivos sobre la población base.

## Modelo

La arquitectura separa tres conceptos:

1. **Productor de candidatos**: SII ACTECO, RES y futuras fuentes.
2. **Evidencia de candidatura**: cada fuente entrega una observación con RUT, regla de calificación, sectores implicados, tipo de evidencia, confianza, referencia y corte.
3. **Entidad potencial consolidada**: Atlas agrupa por RUT todas las evidencias elegibles y excluye los RUT observados en el padrón UAF.

La misma entidad puede ser detectada por SII y RES y cuenta una sola vez. La multiplicidad de fuentes queda preservada como huella de evidencia.

## Regla RES

RES está habilitado como productor, pero la mera existencia de una sociedad en el Registro de Empresas y Sociedades **no** la convierte en Potencial SO. El adaptador RES sólo debe emitir `ELIGIBLE` cuando exista evidencia que vincule a la entidad con una categoría o actividad alcanzada por la Ley 19.913. Los registros societarios que sólo aportan contexto deben ingresar como `CONTEXT_ONLY` o `PENDING_VALIDATION`.

## Tablas y vistas

- `aml_uaf_potential_source_registry_v0660`: catálogo de productores y estado de cada adaptador.
- `aml_uaf_potential_candidate_evidence_v0660`: staging gobernado de evidencias por fuente.
- `aml_v_uaf_potential_multisource_current_v0660`: unión deduplicada por RUT, sólo evidencia elegible, excluyendo inscritos UAF.
- `aml_v_uaf_potential_architecture_status_v0660`: estado de materialización y autoridad del conteo consolidado.

## Conteo y transición

Los 79.449 del screening SII siguen siendo el piso operativo. Atlas no suma candidatos RES al total mientras el universo SII no esté materializado individualmente, porque sin los RUT base no puede calcular el solapamiento exacto. Cuando los 79.449 RUT estén materializados, el total pasa automáticamente a `COUNT(DISTINCT rut)` de la unión multisource y el conteo se vuelve autoritativo.

## Capacidad

La capa de evidencia está indexada por RUT, fuente/estado y `entity_id`; permite ingestiones incrementales y `upsert` por `(source_id, source_candidate_key)`. El historial de evidencias no se sustituye al incorporar nuevas fuentes.

## Semántica

`Potencial SO` continúa siendo una hipótesis de screening. Una evidencia RES, SII o de cualquier otra fuente no constituye por sí sola una conclusión jurídica de obligación, incumplimiento ni necesidad de inscripción.
