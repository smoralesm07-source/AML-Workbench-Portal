-- ATLAS AML 0.53.0 · Resolución transversal de identidad ER-1.2
--
-- Objetivo: aproximar registros observados sin RUT a entidades canónicas con RUT
-- sin fusionar datos, redirigir automáticamente ni transferir señales/riesgo.
-- La implementación productiva se despliega mediante migraciones Supabase.
-- Este archivo documenta el contrato estable consumido por el portal.
--
-- Objetos gobernados:
--   aml_entity_resolution_key_v1(text)
--   aml_entity_resolution_tokens_v1(text)
--   aml_entity_resolution_index_v1
--   aml_entity_resolution_token_v1
--   aml_entity_resolution_candidate_v1
--   refresh_aml_entity_resolution_index_v1()
--   refresh_aml_entity_resolution_v1()
--   aml_v_entity_resolution_top_v1
--
-- Semántica del score:
--   90-100  MUY_ALTA     -> PROBABLE_MISMA_ENTIDAD si no existe ambigüedad
--   70-89   ALTA
--   50-69   POSIBLE      -> POSIBLE_MISMA_ENTIDAD
--   <50     INSUFICIENTE -> EVIDENCIA_INSUFICIENTE
--
-- El score es confianza heurística explicable, no probabilidad estadística
-- calibrada. Un RUT exacto continúa siendo la autoridad determinística.

begin;

create or replace function public.aml_entity_resolution_key_v1(p_nombre text)
returns text language sql immutable parallel safe strict
set search_path to 'pg_catalog','public'
as $function$
  with n as (select public.aml_normalizar_nombre_entidad(p_nombre) v),
  e as (select regexp_replace(v,'(^| )AGF($| )','\1ADMINISTRADORA GENERAL DE FONDOS\2','g') v from n),
  s1 as (select regexp_replace(v,' (S A|SA|SPA|LTDA|LIMITADA|EIRL|SOCIEDAD ANONIMA)$','') v from e),
  q as (select regexp_replace(v,' EN LIQUIDACION$','') v from s1),
  s2 as (select regexp_replace(v,' (S A|SA|SPA|LTDA|LIMITADA|EIRL|SOCIEDAD ANONIMA)$','') v from q)
  select nullif(trim(regexp_replace(v,'\s+',' ','g')),'') from s2;
$function$;

create or replace function public.aml_entity_resolution_tokens_v1(p_key text)
returns text[] language sql immutable parallel safe strict
set search_path to 'pg_catalog'
as $function$
  select coalesce(array_agg(distinct t order by t),array[]::text[])
  from unnest(string_to_array(p_key,' ')) t
  where length(t)>=4 and t not in (
    'ADMINISTRADORA','ADMINISTRADOR','GENERAL','FONDOS','FONDO','INVERSION','INVERSIONES',
    'ASESORIAS','ASESORIA','SOCIEDAD','EMPRESA','EMPRESAS','SERVICIO','SERVICIOS','COMERCIAL',
    'INMOBILIARIA','CONSTRUCTORA','TRANSPORTES','TRANSPORTE','BANCO','BANCOS','GRUPO','GROUP',
    'MANAGEMENT','GESTION','ACTIVOS','CAPITAL','LIMITADA','CHILE','PARA','DEL','LAS','LOS','UNA','UNO');
$function$;

create table if not exists public.aml_entity_resolution_index_v1 (
  entity_id text primary key,rut text,name text not null,entity_type text,region text,commune text,
  source_count integer,source_identity_confidence numeric,resolution_key text not null,
  refreshed_at timestamptz not null default now());
create index if not exists aml_entity_resolution_index_key_trgm_idx
  on public.aml_entity_resolution_index_v1 using gin(resolution_key extensions.gin_trgm_ops);
create index if not exists aml_entity_resolution_index_key_gist_canonical_idx
  on public.aml_entity_resolution_index_v1 using gist(resolution_key extensions.gist_trgm_ops) where rut is not null;
create index if not exists aml_entity_resolution_index_rut_idx on public.aml_entity_resolution_index_v1(rut);
alter table public.aml_entity_resolution_index_v1 enable row level security;
revoke all on public.aml_entity_resolution_index_v1 from anon,authenticated;

create table if not exists public.aml_entity_resolution_token_v1 (
  entity_id text not null,token text not null,refreshed_at timestamptz not null default now(),primary key(entity_id,token));
create index if not exists aml_entity_resolution_token_token_idx on public.aml_entity_resolution_token_v1(token,entity_id);
alter table public.aml_entity_resolution_token_v1 enable row level security;
revoke all on public.aml_entity_resolution_token_v1 from anon,authenticated;

create table if not exists public.aml_entity_resolution_candidate_v1 (
  observed_entity_id text not null,canonical_entity_id text not null,rank smallint not null,
  score numeric(5,2) not null check(score between 0 and 100),confidence_band text not null,
  resolution_state text not null,requires_review boolean not null default true,ambiguous boolean not null default false,
  score_margin numeric(5,2),evidence jsonb not null default '{}'::jsonb,model_version text not null default 'ER-1.2',
  refreshed_at timestamptz not null default now(),primary key(observed_entity_id,canonical_entity_id));
create index if not exists aml_entity_resolution_candidate_observed_idx on public.aml_entity_resolution_candidate_v1(observed_entity_id,rank,score desc);
create index if not exists aml_entity_resolution_candidate_canonical_idx on public.aml_entity_resolution_candidate_v1(canonical_entity_id,score desc);
alter table public.aml_entity_resolution_candidate_v1 enable row level security;
revoke all on public.aml_entity_resolution_candidate_v1 from anon;
grant select on public.aml_entity_resolution_candidate_v1 to authenticated;
drop policy if exists aml_entity_resolution_candidate_v1_allowed_read on public.aml_entity_resolution_candidate_v1;
create policy aml_entity_resolution_candidate_v1_allowed_read on public.aml_entity_resolution_candidate_v1
for select to authenticated using(exists(select 1 from public.aml_allowed_users au where au.user_id=(select auth.uid()) and au.enabled));

-- El refresco productivo reconstruye primero índice + tokens, genera pares sólo
-- con al menos un token distintivo común, conserva hasta tres candidatos y
-- persiste evidencia de similitud, cobertura, tipo, territorio, ambigüedad y
-- conflictos semánticos. Ver migraciones Supabase atlas_v0530_* para el cuerpo
-- operativo vigente ER-1.2.

create or replace view public.aml_v_entity_resolution_top_v1 with (security_invoker=true) as
select r.observed_entity_id,r.canonical_entity_id,r.score,r.confidence_band,r.resolution_state,
       r.requires_review,r.ambiguous,r.score_margin,r.evidence,r.model_version,r.refreshed_at,
       c.rut canonical_rut,c.name canonical_name,c.entity_type canonical_type,
       o.name observed_name,o.entity_type observed_type
from public.aml_entity_resolution_candidate_v1 r
join public.aml_entities o on o.entity_id=r.observed_entity_id
join public.aml_entities c on c.entity_id=r.canonical_entity_id
where r.rank=1;
grant select on public.aml_v_entity_resolution_top_v1 to authenticated;
revoke all on public.aml_v_entity_resolution_top_v1 from anon;

commit;
