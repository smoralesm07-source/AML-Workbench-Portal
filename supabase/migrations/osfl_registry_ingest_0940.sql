-- ATLAS OSFL National Registry Ingest 0.94.0
-- Official RNPJSFL file -> audited staging -> quality gate -> atomic legal master -> conservative identity links.

alter table public.aml_osfl_registry_master
  add column if not exists rut_raw text,
  add column if not exists rut_is_valid boolean,
  add column if not exists source_sheet text,
  add column if not exists source_row_number integer,
  add column if not exists source_sha256 text;

alter table public.aml_osfl_registry_source_snapshot
  add column if not exists source_sha256 text,
  add column if not exists source_file_name text,
  add column if not exists source_bytes bigint,
  add column if not exists last_successful_ingest_at timestamptz,
  add column if not exists automation_status text;

create table if not exists public.aml_osfl_registry_ingest_run (
  load_id text primary key,
  snapshot_date date not null,
  source_url text,
  source_file_name text not null,
  source_sha256 text not null,
  source_bytes bigint check (source_bytes is null or source_bytes >= 0),
  status text not null check (status in ('PROBING','RECEIVING','STAGED','VALIDATING','COMPLETE','FAILED','BLOCKED_SOURCE')),
  observed_rows integer not null default 0 check (observed_rows >= 0),
  accepted_rows integer not null default 0 check (accepted_rows >= 0),
  active_rows integer not null default 0 check (active_rows >= 0),
  inactive_rows integer not null default 0 check (inactive_rows >= 0),
  rows_with_rut integer not null default 0 check (rows_with_rut >= 0),
  rows_with_valid_rut integer not null default 0 check (rows_with_valid_rut >= 0),
  duplicate_registry_numbers integer not null default 0 check (duplicate_registry_numbers >= 0),
  expected_active_total integer check (expected_active_total is null or expected_active_total >= 0),
  quality jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.aml_osfl_registry_stage (
  load_id text not null references public.aml_osfl_registry_ingest_run(load_id) on delete cascade,
  source_sheet text not null default 'SIN_HOJA',
  source_row_number integer not null,
  registry_number text,
  legal_name text,
  rut_raw text,
  rut text,
  rut_is_valid boolean not null default false,
  origin text,
  commune text,
  region text,
  address text,
  organization_type text,
  classification text,
  grant_date date,
  registration_date date,
  legal_status text,
  is_active boolean,
  source_record_hash text not null,
  staged_at timestamptz not null default now(),
  primary key (load_id, source_sheet, source_row_number)
);

create index if not exists aml_osfl_registry_stage_load_registry_idx on public.aml_osfl_registry_stage(load_id,registry_number);
create index if not exists aml_osfl_registry_stage_load_active_idx on public.aml_osfl_registry_stage(load_id,is_active);
create index if not exists aml_osfl_registry_ingest_run_snapshot_idx on public.aml_osfl_registry_ingest_run(snapshot_date desc,started_at desc);
create index if not exists aml_osfl_registry_master_valid_rut_0940_idx on public.aml_osfl_registry_master(rut_is_valid,rut);

alter table public.aml_osfl_registry_ingest_run enable row level security;
alter table public.aml_osfl_registry_stage enable row level security;
revoke all on public.aml_osfl_registry_ingest_run from anon,authenticated;
revoke all on public.aml_osfl_registry_stage from anon,authenticated;

create or replace function public.aml_norm_osfl_registry_text_0940(p_text text)
returns text language sql immutable parallel safe as $$
  select regexp_replace(
    translate(upper(coalesce(p_text,'')),'ÁÀÄÂÉÈËÊÍÌÏÎÓÒÖÔÚÙÜÛÑÇ','AAAAEEEEIIIIOOOOUUUUNC'),
    '[^A-Z0-9]+','','g'
  )
$$;

create index if not exists aml_osfl_registry_master_name_norm_0940_idx
  on public.aml_osfl_registry_master(public.aml_norm_osfl_registry_text_0940(legal_name));
create index if not exists aml_osfl_registry_master_name_trgm_0940_idx
  on public.aml_osfl_registry_master using gin(public.aml_norm_osfl_registry_text_0940(legal_name) gin_trgm_ops);
create index if not exists aml_osfl_runtime_name_norm_0940_idx
  on public.aml_osfl_entity_runtime_snapshot(public.aml_norm_osfl_registry_text_0940(name));

create or replace function public.aml_finalize_osfl_registry_load_0940(p_load_id text,p_expected_active_total integer default null)
returns jsonb
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_run public.aml_osfl_registry_ingest_run%rowtype;
  v_observed integer:=0;
  v_accepted integer:=0;
  v_active integer:=0;
  v_inactive integer:=0;
  v_with_rut integer:=0;
  v_valid_rut integer:=0;
  v_duplicates integer:=0;
  v_missing_names integer:=0;
  v_exact integer:=0;
  v_high_commune integer:=0;
  v_high_region integer:=0;
  v_high integer:=0;
  v_ref integer;
  v_diff numeric;
begin
  perform pg_advisory_xact_lock(hashtext('ATLAS_OSFL_REGISTRY_PROMOTION_0940'));
  select * into v_run from public.aml_osfl_registry_ingest_run where load_id=p_load_id for update;
  if not found then raise exception 'OSFL load % not found',p_load_id; end if;
  if v_run.status not in ('RECEIVING','STAGED','VALIDATING') then raise exception 'OSFL load % invalid status %',p_load_id,v_run.status; end if;
  update public.aml_osfl_registry_ingest_run set status='VALIDATING',updated_at=now() where load_id=p_load_id;

  select count(*)::integer,
    count(*) filter(where nullif(btrim(registry_number),'') is not null and nullif(btrim(legal_name),'') is not null)::integer,
    count(*) filter(where is_active is true)::integer,
    count(*) filter(where is_active is false)::integer,
    count(*) filter(where nullif(btrim(rut_raw),'') is not null)::integer,
    count(*) filter(where rut_is_valid is true and nullif(btrim(rut),'') is not null)::integer,
    count(*) filter(where nullif(btrim(legal_name),'') is null)::integer
  into v_observed,v_accepted,v_active,v_inactive,v_with_rut,v_valid_rut,v_missing_names
  from public.aml_osfl_registry_stage where load_id=p_load_id;

  select coalesce(sum(n-1),0)::integer into v_duplicates from (
    select registry_number,count(*) n from public.aml_osfl_registry_stage
    where load_id=p_load_id and nullif(btrim(registry_number),'') is not null
    group by registry_number having count(*)>1
  ) d;

  v_ref:=coalesce(p_expected_active_total,v_run.expected_active_total);
  if v_ref is not null and v_ref>0 then v_diff:=abs(v_active-v_ref)::numeric/v_ref; end if;

  if v_observed<250000 then raise exception 'OSFL source too small for national promotion: % rows',v_observed; end if;
  if v_active<200000 then raise exception 'OSFL active population too small for national promotion: %',v_active; end if;
  if v_accepted::numeric/nullif(v_observed,0)<0.98 then raise exception 'OSFL accepted ratio below 98 percent: %/%',v_accepted,v_observed; end if;
  if v_duplicates>greatest(10,floor(v_accepted*0.0005)::integer) then raise exception 'OSFL duplicate registry numbers exceed tolerance: %',v_duplicates; end if;
  if v_ref is not null and v_diff>0.08 then raise exception 'OSFL active count differs more than 8 percent from expected: active %, expected %',v_active,v_ref; end if;

  -- Preserve analyst-reviewed links. Rebuild only automatic links.
  delete from public.aml_osfl_registry_entity_link where review_status='AUTO';
  delete from public.aml_osfl_registry_master;

  insert into public.aml_osfl_registry_master(
    registry_number,legal_name,rut,rut_raw,rut_is_valid,origin,commune,region,address,organization_type,classification,
    grant_date,registration_date,legal_status,is_active,source_snapshot_date,source_file_name,source_record_hash,
    source_sheet,source_row_number,source_sha256,ingested_at,updated_at
  )
  select distinct on (registry_number)
    btrim(registry_number),btrim(legal_name),nullif(btrim(rut),''),nullif(btrim(rut_raw),''),rut_is_valid,
    nullif(btrim(origin),''),nullif(btrim(commune),''),nullif(btrim(region),''),nullif(btrim(address),''),
    nullif(btrim(organization_type),''),nullif(btrim(classification),''),grant_date,registration_date,nullif(btrim(legal_status),''),is_active,
    v_run.snapshot_date,v_run.source_file_name,source_record_hash,source_sheet,source_row_number,v_run.source_sha256,now(),now()
  from public.aml_osfl_registry_stage
  where load_id=p_load_id and nullif(btrim(registry_number),'') is not null and nullif(btrim(legal_name),'') is not null
  order by registry_number,source_sheet,source_row_number;

  insert into public.aml_osfl_registry_entity_link(registry_number,entity_id,rut,match_status,match_method,match_confidence,review_status,match_basis,linked_at)
  select m.registry_number,e.entity_id,m.rut,'MATCH_EXACT','RUT_VALIDATED_EXACT',1.0000,'AUTO',
    jsonb_build_object('registry_rut',m.rut,'entity_rut',e.rut,'source_snapshot_date',m.source_snapshot_date),now()
  from public.aml_osfl_registry_master m
  join public.aml_entity_master_v0650 e on e.rut_key=regexp_replace(upper(m.rut),'[^0-9K]','','g')
  where m.rut_is_valid is true and nullif(m.rut,'') is not null
  on conflict(registry_number,entity_id) do nothing;
  get diagnostics v_exact=row_count;

  with c as (
    select m.registry_number,o.entity_id,o.rut,count(*) over(partition by m.registry_number) candidate_n
    from public.aml_osfl_registry_master m
    join public.aml_osfl_entity_runtime_snapshot o
      on public.aml_norm_osfl_registry_text_0940(o.name)=public.aml_norm_osfl_registry_text_0940(m.legal_name)
     and public.aml_norm_osfl_registry_text_0940(o.commune)=public.aml_norm_osfl_registry_text_0940(m.commune)
    where nullif(public.aml_norm_osfl_registry_text_0940(m.commune),'') is not null
      and not exists(select 1 from public.aml_osfl_registry_entity_link l where l.registry_number=m.registry_number)
  )
  insert into public.aml_osfl_registry_entity_link(registry_number,entity_id,rut,match_status,match_method,match_confidence,review_status,match_basis,linked_at)
  select registry_number,entity_id,rut,'MATCH_HIGH','NAME_EXACT_COMMUNE_EXACT',0.9700,'AUTO',jsonb_build_object('name_exact',true,'commune_exact',true),now()
  from c where candidate_n=1 on conflict(registry_number,entity_id) do nothing;
  get diagnostics v_high_commune=row_count;

  with c as (
    select m.registry_number,o.entity_id,o.rut,count(*) over(partition by m.registry_number) candidate_n
    from public.aml_osfl_registry_master m
    join public.aml_osfl_entity_runtime_snapshot o
      on public.aml_norm_osfl_registry_text_0940(o.name)=public.aml_norm_osfl_registry_text_0940(m.legal_name)
     and public.aml_norm_osfl_registry_text_0940(o.region)=public.aml_norm_osfl_registry_text_0940(m.region)
    where nullif(public.aml_norm_osfl_registry_text_0940(m.region),'') is not null
      and not exists(select 1 from public.aml_osfl_registry_entity_link l where l.registry_number=m.registry_number)
  )
  insert into public.aml_osfl_registry_entity_link(registry_number,entity_id,rut,match_status,match_method,match_confidence,review_status,match_basis,linked_at)
  select registry_number,entity_id,rut,'MATCH_HIGH','NAME_EXACT_REGION_EXACT',0.9400,'AUTO',jsonb_build_object('name_exact',true,'region_exact',true),now()
  from c where candidate_n=1 on conflict(registry_number,entity_id) do nothing;
  get diagnostics v_high_region=row_count;
  v_high:=v_high_commune+v_high_region;

  insert into public.aml_osfl_registry_source_snapshot(
    snapshot_date,official_active_total,source_name,source_url,evidence_url,ingestion_status,ingested_row_count,notes,
    source_sha256,source_file_name,source_bytes,last_successful_ingest_at,automation_status,created_at,updated_at
  ) values (
    v_run.snapshot_date,v_active,'Servicio de Registro Civil e Identificación · Registro Nacional de Personas Jurídicas sin Fines de Lucro',
    coalesce(v_run.source_url,'ARCHIVO_OFICIAL_CARGADO'),
    'https://www.registrocivil.cl/principal/nuestras-oficinas/portal-registro-nacional-de-personas-juridicas-sin-fines-de-lucro',
    'COMPLETE',v_accepted,
    'Padrón fila a fila promovido tras controles de volumen, unicidad, vigencia e identidad. Vigencia jurídica no implica actividad económica ni riesgo AML.',
    v_run.source_sha256,v_run.source_file_name,v_run.source_bytes,now(),'FULL_FILE_VALIDATED',now(),now()
  ) on conflict(snapshot_date) do update set
    official_active_total=excluded.official_active_total,source_url=excluded.source_url,ingestion_status='COMPLETE',
    ingested_row_count=excluded.ingested_row_count,notes=excluded.notes,source_sha256=excluded.source_sha256,
    source_file_name=excluded.source_file_name,source_bytes=excluded.source_bytes,last_successful_ingest_at=now(),
    automation_status='FULL_FILE_VALIDATED',updated_at=now();

  update public.aml_osfl_registry_ingest_run set
    status='COMPLETE',observed_rows=v_observed,accepted_rows=v_accepted,active_rows=v_active,inactive_rows=v_inactive,
    rows_with_rut=v_with_rut,rows_with_valid_rut=v_valid_rut,duplicate_registry_numbers=v_duplicates,
    expected_active_total=coalesce(p_expected_active_total,expected_active_total),
    quality=jsonb_build_object(
      'accepted_ratio',round(v_accepted::numeric/nullif(v_observed,0),6),'active_ratio',round(v_active::numeric/nullif(v_accepted,0),6),
      'rut_valid_ratio',round(v_valid_rut::numeric/nullif(v_with_rut,0),6),'missing_names',v_missing_names,
      'exact_links',v_exact,'high_links',v_high,'unlinked',v_accepted-v_exact-v_high
    ),finished_at=now(),updated_at=now(),error=null
  where load_id=p_load_id;

  insert into public.aml_external_source_health(
    source_code,source_name,source_class,integration_mode,authoritative_source,enabled,software_status,data_status,last_source_record_at,
    last_successful_ingest_at,last_check_at,notes,metadata,refreshed_at
  ) values (
    'REGISTRO_CIVIL_OSFL','Registro Civil · RNPJSFL','official_list','scheduled','Servicio de Registro Civil e Identificación',true,
    'healthy','fresh',v_run.snapshot_date::timestamptz,now(),now(),
    'Padrón nacional OSFL cargado y validado. La vigencia jurídica no constituye señal de riesgo.',
    jsonb_build_object('snapshot_date',v_run.snapshot_date,'source_sha256',v_run.source_sha256,'active_rows',v_active,'accepted_rows',v_accepted,'access_mode','official_full_file'),now()
  ) on conflict(source_code) do update set
    software_status='healthy',data_status='fresh',last_source_record_at=excluded.last_source_record_at,last_successful_ingest_at=now(),
    last_check_at=now(),notes=excluded.notes,metadata=excluded.metadata,refreshed_at=now();

  return jsonb_build_object('ok',true,'load_id',p_load_id,'observed_rows',v_observed,'accepted_rows',v_accepted,'active_rows',v_active,
    'inactive_rows',v_inactive,'rows_with_rut',v_with_rut,'valid_ruts',v_valid_rut,'duplicates',v_duplicates,'exact_links',v_exact,
    'high_links',v_high,'unlinked',v_accepted-v_exact-v_high);
end
$$;

revoke all on function public.aml_finalize_osfl_registry_load_0940(text,integer) from public,anon,authenticated;
grant execute on function public.aml_finalize_osfl_registry_load_0940(text,integer) to service_role;

create or replace view public.aml_v_osfl_registry_ingest_status_current
with (security_invoker=true)
as
with r as (select * from public.aml_osfl_registry_ingest_run order by started_at desc limit 1),
s as (select * from public.aml_osfl_registry_source_snapshot order by snapshot_date desc limit 1),
m as (select count(*)::bigint master_rows,count(*) filter(where coalesce(is_active,false))::bigint master_active,count(*) filter(where rut_is_valid is true)::bigint master_valid_rut from public.aml_osfl_registry_master),
l as (select count(*) filter(where match_status='MATCH_EXACT')::bigint exact_links,count(*) filter(where match_status='MATCH_HIGH')::bigint high_links,count(*) filter(where match_status='MATCH_PROBABLE')::bigint probable_links,count(*) filter(where review_status='PENDING_REVIEW')::bigint pending_review from public.aml_osfl_registry_entity_link)
select s.snapshot_date,s.ingestion_status,s.official_active_total,s.ingested_row_count,s.source_file_name,s.source_sha256,s.last_successful_ingest_at,s.automation_status,
  r.load_id last_load_id,r.status last_load_status,r.started_at last_load_started_at,r.finished_at last_load_finished_at,r.error last_load_error,r.quality last_load_quality,
  m.master_rows,m.master_active,m.master_valid_rut,l.exact_links,l.high_links,l.probable_links,l.pending_review,now() refreshed_at
from s cross join m cross join l left join r on true;

grant select on public.aml_v_osfl_registry_ingest_status_current to authenticated;

insert into public.aml_external_source_health(
  source_code,source_name,source_class,integration_mode,authoritative_source,enabled,software_status,data_status,last_check_at,notes,metadata,refreshed_at
) values (
  'REGISTRO_CIVIL_OSFL','Registro Civil · RNPJSFL','official_list','scheduled','Servicio de Registro Civil e Identificación',true,'watch','unknown',now(),
  'Fuente oficial vigente. El portal publica Planilla RPJ Excel con actualización quincenal; el acceso automatizado puede requerir desafío web. Atlas no sustituye el padrón por fuentes históricas.',
  jsonb_build_object('access_mode','protected_portal','ingestion_state','REFERENCE_ONLY','portal','https://www.registrocivil.cl/principal/nuestras-oficinas/portal-registro-nacional-de-personas-juridicas-sin-fines-de-lucro'),now()
) on conflict(source_code) do update set source_name=excluded.source_name,source_class=excluded.source_class,integration_mode=excluded.integration_mode,
  authoritative_source=excluded.authoritative_source,enabled=true,notes=excluded.notes,metadata=coalesce(public.aml_external_source_health.metadata,'{}'::jsonb)||excluded.metadata,last_check_at=now(),refreshed_at=now();

comment on table public.aml_osfl_registry_stage is 'Staging del padrón RNPJSFL. Nunca alimenta analítica hasta superar quality gate y promoción atómica.';
comment on table public.aml_osfl_registry_ingest_run is 'Auditoría de intentos de carga del padrón nacional OSFL: fuente, hash, cobertura, calidad y resultado.';
