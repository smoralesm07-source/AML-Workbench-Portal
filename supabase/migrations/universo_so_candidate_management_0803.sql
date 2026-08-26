begin;

alter table public.aml_uaf_potential_review
  drop constraint if exists aml_uaf_potential_review_review_state_check;

alter table public.aml_uaf_potential_review
  add constraint aml_uaf_potential_review_review_state_check
  check (review_state = any (array[
    'REVISADO','ELEGIBLE','PRIORIZADO','SELECCIONADO_PARA_INSCRIPCION',
    'INVITACION_PREPARADA','INVITADO','EN_SEGUIMIENTO','INSCRITO','CERRADO',
    'DESCARTADO','NO_APLICA','YA_INSCRITO','SIN_ACTIVIDAD_VIGENTE',
    'CANDIDATO_SELECCIONADO','NO_CANDIDATO'
  ]::text[]));

alter table public.aml_uaf_potential_review
  drop constraint if exists aml_uaf_potential_review_no_candidato_motivado;

alter table public.aml_uaf_potential_review
  add constraint aml_uaf_potential_review_no_candidato_motivado
  check (
    review_state <> 'NO_CANDIDATO'
    or (reason_code is not null and length(coalesce(rationale,'')) >= 3)
  );

create index if not exists aml_uaf_potential_review_rut_created_idx
  on public.aml_uaf_potential_review (rut, created_at desc);

create or replace view public.aml_v_uaf_potential_management_current as
select
  p.*,
  case
    when p.review_state = 'CANDIDATO_SELECCIONADO' then 'CANDIDATO_SELECCIONADO'
    when p.review_state = 'NO_CANDIDATO' then 'NO_CANDIDATO'
    else 'POTENCIAL_PENDIENTE'
  end as management_bucket
from public.aml_v_uaf_potential_current p;

create or replace view public.aml_v_uaf_potential_pending_v0803 as
select *
from public.aml_v_uaf_potential_management_current
where management_bucket = 'POTENCIAL_PENDIENTE';

create or replace view public.aml_v_uaf_candidate_selected_v0803 as
select *
from public.aml_v_uaf_potential_management_current
where management_bucket = 'CANDIDATO_SELECCIONADO';

create or replace view public.aml_v_uaf_not_candidate_v0803 as
select *
from public.aml_v_uaf_potential_management_current
where management_bucket = 'NO_CANDIDATO';

create or replace view public.aml_v_uaf_potential_management_summary_v0803 as
select
  count(*) filter (where management_bucket='POTENCIAL_PENDIENTE')::bigint as potential_pending,
  count(*) filter (where management_bucket='CANDIDATO_SELECCIONADO')::bigint as selected_candidates,
  count(*) filter (where management_bucket='NO_CANDIDATO')::bigint as not_candidates,
  count(*)::bigint as screened_total,
  now() as calculated_at
from public.aml_v_uaf_potential_management_current;

grant select on public.aml_v_uaf_potential_management_current to authenticated;
grant select on public.aml_v_uaf_potential_pending_v0803 to authenticated;
grant select on public.aml_v_uaf_candidate_selected_v0803 to authenticated;
grant select on public.aml_v_uaf_not_candidate_v0803 to authenticated;
grant select on public.aml_v_uaf_potential_management_summary_v0803 to authenticated;

commit;
