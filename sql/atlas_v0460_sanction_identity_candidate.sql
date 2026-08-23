-- ATLAS AML 0.46.0 · build 0460
-- Etapa 1 · cola de validación de identidad candidata en sanciones.
--
-- Por qué NO se corrige identity_status
-- -------------------------------------
-- El pipeline SANCTION_IDENTITY reporta 657 resueltas y aml_sanctions marca
-- sólo 257 como RESOLVED. Los dos campos NO están en contradicción: significan
-- cosas distintas y ambos son correctos.
--
--   RESOLVED_SOURCE (257)        el productor entregó entity_id. Identidad firme.
--   RESOLVED_CONSERVATIVE (400)  calce exacto y único POR NOMBRE, confianza 0,95–0,98.
--
-- El guardrail declarado del sistema es NO_PROMOVER_IDENTIDAD_SOLO_POR_NOMBRE.
-- Mantener esas 400 como UNRESOLVED_CANDIDATE en aml_sanctions es la conducta
-- correcta; sobrescribir identity_status habría violado la propia metodología.
--
-- Cuál es entonces el problema real
-- ---------------------------------
-- Que el portal no muestra NADA de esas 400. La candidata existe, con método y
-- confianza, y el analista no puede verla ni validarla. Entre ellas hay 216
-- eventos laft_direct resueltos contra el registro UAF con confianza 0,98: el
-- 65% de todas las sanciones con vínculo LA/FT directo del sistema.
--
-- Esta vista las expone COMO CANDIDATAS, coherente con la política declarada
-- CANDIDATE_IDENTITY_STAYS_CANDIDATE. La promoción a identidad firme la decide
-- un analista y esa decisión queda registrada en aml_disposition.
--
-- Volumen al 23-08-2026:
--   UAF_REGISTRY_NAME_EXACT_UNIQUE  216 candidatas · 216 LA/FT · conf 0,980 · 189 entidades
--   ENTITY_NAME_EXACT_UNIQUE        184 candidatas ·  16 LA/FT · conf 0,950 · 105 entidades

create or replace view public.aml_v0460_sanction_identity_candidate
with (security_invoker = true) as
select
  s.sanction_id,
  s.event_date,
  s.regulator,
  s.entity_name          as sanctioned_name,
  s.subject,
  s.laft_direct,
  s.identity_status      as portal_identity_status,
  r.resolution_status,
  r.resolution_method,
  r.confidence,
  r.candidate_count,
  r.resolved_entity_id   as candidate_entity_id,
  r.resolved_rut         as candidate_rut,
  e.name                 as candidate_entity_name,
  e.region               as candidate_region,
  e.is_uaf_observed      as candidate_is_uaf_observed,
  d.verdict              as validation_verdict,
  d.created_at           as validated_at
from public.aml_sanctions s
join public.aml_sanction_identity_resolution r using (sanction_id)
left join public.aml_entities e on e.entity_id = r.resolved_entity_id
left join public.aml_v0460_entity_disposition_current d on d.entity_id = r.resolved_entity_id
where s.entity_id is null
  and r.resolved_entity_id is not null
  and r.resolution_status = 'RESOLVED_CONSERVATIVE';

comment on view public.aml_v0460_sanction_identity_candidate is
  'Cola de validación: sanciones con identidad candidata por calce exacto de nombre, no promovida a identidad firme. CANDIDATE_IDENTITY_STAYS_CANDIDATE. La promoción la decide un analista y queda en aml_disposition.';
