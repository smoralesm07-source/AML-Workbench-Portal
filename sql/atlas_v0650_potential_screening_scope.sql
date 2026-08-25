-- ATLAS AML 0.65.0 · Potenciales SO por screening ACTECO
--
-- Definición operacional aprobada:
--   potencial SO = RUT con ACTECO relacionado con categorías de la Ley 19.913
--                  + vigente ante SII
--                  + no observado en el padrón UAF del corte.
--
-- El universo vigente de referencia es 79.449. Se retira como universo válido
-- el modelo restrictivo 0.64 de 2.033 casos y sus tiers A/B/C. Concentración del
-- giro, tipo de entidad, coherencia sectorial, IVO y materialidad pueden servir
-- después para lectura/priorización, pero no excluyen entidades del screening.
--
-- Fuente gobernada de ACTECO:
-- Radar_SII/config/uaf_sii_screening_policy.csv
-- candidate_use=SI
-- SHA fuente observado: a69d5e0406674d9a72215cc19ce9f73ec0306327

begin;

create table if not exists public.aml_uaf_potential_screening_scope_0650 (
  snapshot_key text primary key,
  potential_count integer not null,
  sii_cutoff text not null,
  source_policy_url text not null,
  source_policy_sha text,
  criteria jsonb not null,
  semantics text not null default 'SCREENING_HYPOTHESIS_NOT_PROVEN_OBLIGATION',
  refreshed_at timestamptz not null default now()
);

alter table public.aml_uaf_potential_screening_scope_0650 enable row level security;
revoke all on public.aml_uaf_potential_screening_scope_0650 from anon;
grant select on public.aml_uaf_potential_screening_scope_0650 to authenticated;

drop policy if exists aml_uaf_potential_screening_scope_0650_allowed_read
  on public.aml_uaf_potential_screening_scope_0650;
create policy aml_uaf_potential_screening_scope_0650_allowed_read
  on public.aml_uaf_potential_screening_scope_0650 for select
  using (exists (
    select 1 from public.aml_allowed_users au
    where au.user_id=(select auth.uid()) and au.enabled
  ));

insert into public.aml_uaf_potential_screening_scope_0650
(snapshot_key,potential_count,sii_cutoff,source_policy_url,source_policy_sha,criteria,semantics,refreshed_at)
values(
  'CURRENT',79449,'2026-05',
  'https://raw.githubusercontent.com/smoralesm07-source/Radar_SII/main/config/uaf_sii_screening_policy.csv',
  'a69d5e0406674d9a72215cc19ce9f73ec0306327',
  jsonb_build_object(
    'acteco_policy','candidate_use=SI',
    'sii_status','ACTIVE_AS_PUBLISHED',
    'uaf_exclusion','RUT no observado en el padrón UAF del corte',
    'restrictive_filters',false,
    'excluded_legacy_model','IVO-2.0_RECALL_TIERS / universo 2.033'
  ),
  'SCREENING_HYPOTHESIS_NOT_PROVEN_OBLIGATION',now()
)
on conflict(snapshot_key) do update set
  potential_count=excluded.potential_count,
  sii_cutoff=excluded.sii_cutoff,
  source_policy_url=excluded.source_policy_url,
  source_policy_sha=excluded.source_policy_sha,
  criteria=excluded.criteria,
  semantics=excluded.semantics,
  refreshed_at=excluded.refreshed_at;

update public.aml_uaf_obligated_overview_snapshot
set payload = jsonb_set(
      jsonb_set(
        jsonb_set(coalesce(payload,'{}'::jsonb),'{potential,universe,candidates}','79449'::jsonb,true),
        '{potential,universe,actionable}','79449'::jsonb,true),
      '{potential,universe,definition}',to_jsonb('ACTECO_19913_VIGENTE_SII_NO_UAF'::text),true),
    refreshed_at=now()
where snapshot_key='CURRENT';

commit;
