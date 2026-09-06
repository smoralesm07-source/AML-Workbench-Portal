create index if not exists aml_mv_gp12_supplier_entity_id_idx
on atlas_private.aml_mv_gp12_supplier (entity_id)
where entity_id is not null;

create or replace function public.atlas_v2_entity360_read(p_entity_id text, p_rut text default null)
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
with identity_row as (
  select to_jsonb(m) as payload
  from public.aml_entity_master_v0553 m
  where m.entity_id = p_entity_id
  limit 1
), resolved as (
  select coalesce(
    nullif(btrim(p_rut), ''),
    nullif((select payload->>'rut' from identity_row), ''),
    case
      when upper(p_entity_id) ~ '^ENT-RUT-[0-9]+-[0-9K]$'
      then regexp_replace(upper(p_entity_id), '^ENT-RUT-([0-9]+)-([0-9K])$', '\1-\2')
      else null
    end
  ) as rut
), tax_row as (
  select to_jsonb(t) as payload
  from public.aml_entity_tax_profile t
  where t.entity_id = p_entity_id
  limit 1
), sanctions_row as (
  select to_jsonb(s) as payload
  from public.aml_v_ipa3_sanction_entity_summary s
  where s.entity_id = p_entity_id
  limit 1
), spend_row as (
  select jsonb_strip_nulls(jsonb_build_object(
    'supplier_rut', s.supplier_key,
    'supplier_name', s.supplier_name,
    'order_count', s.order_count,
    'buyer_count', s.buyer_count,
    'total_clp', s.total_clp,
    'first_order_date', s.first_order_date,
    'last_order_date', s.last_order_date,
    'entity_id', s.entity_id,
    'region', s.region,
    'lobby_count', s.lobby_count,
    'cgr_count', s.ctx_cgr_count,
    'attention_score', s.attention_score,
    'signal_codes', s.signal_codes,
    'segment', s.segment,
    'segment_label', s.segment_label,
    'ipf_score', s.ipf_score,
    'ipf_band', s.ipf_band,
    'uaf_sector', s.uaf_sector,
    'sii_sector', s.sii_sector,
    'sii_workers', s.sii_workers,
    'is_obligated_subject', s.is_obligated_subject,
    'traits', s.traits
  )) as payload
  from public.aml_mv_gp12_supplier s
  where s.entity_id = p_entity_id
  limit 1
), history_rows as (
  select coalesce(jsonb_agg(to_jsonb(h) order by h.commercial_year desc), '[]'::jsonb) as payload
  from (
    select * from public.aml_sii_entity_year h
    where h.entity_id = p_entity_id
    order by h.commercial_year desc
    limit 8
  ) h
), uaf_row as (
  select to_jsonb(u) as payload
  from public.aml_uaf_entity_profile u, resolved r
  where r.rut is not null
    and u.rut = any(array[
      upper(r.rut),
      regexp_replace(upper(r.rut), '[^0-9K]', '', 'g'),
      case
        when regexp_replace(upper(r.rut), '[^0-9K]', '', 'g') ~ '^[0-9]+[0-9K]$'
        then regexp_replace(regexp_replace(upper(r.rut), '[^0-9K]', '', 'g'), '^([0-9]+)([0-9K])$', '\1-\2')
        else null
      end
    ]::text[])
  limit 1
)
select jsonb_build_object(
  'contract', 'ATLAS_ENTITY360_READ_V2',
  'entity_id', p_entity_id,
  'resolved_rut', (select rut from resolved),
  'generated_at', now(),
  'identity', (select payload from identity_row),
  'tax', (select payload from tax_row),
  'uaf', (select payload from uaf_row),
  'sanctions', (select payload from sanctions_row),
  'spend', (select payload from spend_row),
  'history', (select payload from history_rows),
  'source_status', jsonb_build_object(
    'identity', case when exists(select 1 from identity_row) then 'AVAILABLE' else 'EMPTY' end,
    'tax', case when exists(select 1 from tax_row) then 'AVAILABLE' else 'EMPTY' end,
    'uaf', case when exists(select 1 from uaf_row) then 'AVAILABLE' else 'EMPTY' end,
    'sanctions', case when exists(select 1 from sanctions_row) then 'AVAILABLE' else 'EMPTY' end,
    'spend', case when exists(select 1 from spend_row) then 'AVAILABLE' else 'EMPTY' end,
    'history', case when jsonb_array_length((select payload from history_rows)) > 0 then 'AVAILABLE' else 'EMPTY' end
  )
);
$$;

revoke all on function public.atlas_v2_entity360_read(text,text) from public, anon;
grant execute on function public.atlas_v2_entity360_read(text,text) to authenticated, service_role;
