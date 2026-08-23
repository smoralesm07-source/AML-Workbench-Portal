-- ATLAS AML 0.47.0 · build 0470 · validación de identidad candidata en sanciones.
--
-- Por qué es una tabla distinta de aml_disposition
-- ------------------------------------------------
-- Son dos juicios diferentes y confundirlos degradaría ambos:
--   aml_disposition                    «¿esta entidad amerita atención AML?»
--   aml_sanction_identity_validation   «¿esta sanción es de esta entidad?»
-- La primera es triage; la segunda es resolución de identidad. Una entidad puede
-- tener identidad confirmada y ser irrelevante, o al revés.
--
-- Qué NO hace confirmar
-- ---------------------
-- Confirmar aquí NO reescribe aml_sanctions.entity_id ni identity_status. Deja
-- registrado el juicio del analista como evidencia trazable. La promoción a
-- identidad firme corresponde a un paso gobernado del pipeline que puede leer
-- estas validaciones; el portal no promueve identidad por sí mismo, coherente
-- con NO_PROMOVER_IDENTIDAD_SOLO_POR_NOMBRE.
--
-- Volumen de la cola al 23-08-2026: 400 pendientes sobre 294 entidades.
--   UAF_REGISTRY_NAME_EXACT_UNIQUE  216 · todas laft_direct · confianza 0,98
--   ENTITY_NAME_EXACT_UNIQUE         16 ·      laft_direct · confianza 0,95
--   ENTITY_NAME_EXACT_UNIQUE        168 ·   no laft_direct · confianza 0,95

begin;

create table if not exists public.aml_sanction_identity_validation (
  validation_id           uuid primary key default gen_random_uuid(),
  sanction_id             text        not null,
  candidate_entity_id     text        not null,
  user_id                 uuid        not null default auth.uid(),
  verdict                 text        not null,
  rationale               text        not null,
  -- Se congela el estado del algoritmo al momento de decidir: si el pipeline
  -- cambia de método o de umbral, la etiqueta sigue siendo interpretable.
  method_at_decision      text,
  confidence_at_decision  numeric,
  laft_direct_at_decision boolean,
  release                 text,
  created_at              timestamptz not null default now(),

  constraint aml_siv_verdict_check
    check (verdict in ('CONFIRMADA','RECHAZADA','INSUFICIENTE')),
  constraint aml_siv_rationale_check
    check (char_length(btrim(rationale)) >= 20)
);

comment on table public.aml_sanction_identity_validation is
  'Juicio del analista sobre si una sanción corresponde a la entidad candidata. De sólo anexado. Confirmar NO promueve identidad en aml_sanctions: es evidencia para un paso gobernado posterior.';

create index if not exists aml_siv_sanction_created_idx
  on public.aml_sanction_identity_validation (sanction_id, created_at desc);
create index if not exists aml_siv_entity_idx
  on public.aml_sanction_identity_validation (candidate_entity_id);
create index if not exists aml_siv_verdict_idx
  on public.aml_sanction_identity_validation (verdict);

alter table public.aml_sanction_identity_validation enable row level security;

drop policy if exists aml_siv_allowed_read on public.aml_sanction_identity_validation;
create policy aml_siv_allowed_read
  on public.aml_sanction_identity_validation for select
  using (exists (select 1 from public.aml_allowed_users au
                 where au.user_id = (select auth.uid()) and au.enabled));

drop policy if exists aml_siv_self_insert on public.aml_sanction_identity_validation;
create policy aml_siv_self_insert
  on public.aml_sanction_identity_validation for insert
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.aml_allowed_users au
                          where au.user_id = (select auth.uid()) and au.enabled));

-- Sin políticas de UPDATE ni DELETE: el registro es inmutable por diseño.

create or replace view public.aml_v0470_identity_validation_current
with (security_invoker = true) as
select distinct on (sanction_id)
  sanction_id, validation_id, candidate_entity_id, user_id, verdict,
  rationale, confidence_at_decision, created_at
from public.aml_sanction_identity_validation
order by sanction_id, created_at desc;

-- Cola de trabajo: candidatas más su estado de validación. Se ordena por
-- laft_direct y confianza para que lo de mayor valor AML quede arriba, y por
-- pendiente primero: la cola existe para vaciarse.
create or replace view public.aml_v0470_identity_validation_queue
with (security_invoker = true) as
select
  c.sanction_id, c.event_date, c.regulator, c.sanctioned_name, c.subject,
  c.laft_direct, c.resolution_method, c.confidence,
  c.candidate_entity_id, c.candidate_rut, c.candidate_entity_name,
  c.candidate_region, c.candidate_is_uaf_observed,
  v.verdict    as validation_verdict,
  v.rationale  as validation_rationale,
  v.created_at as validated_at,
  (v.verdict is null) as pending
from public.aml_v0460_sanction_identity_candidate c
left join public.aml_v0470_identity_validation_current v using (sanction_id);

comment on view public.aml_v0470_identity_validation_queue is
  'Cola de validación de identidad. Ordenar por pending desc, laft_direct desc, confidence desc. Banda y confianza describen el algoritmo de calce, no riesgo AML.';

commit;
