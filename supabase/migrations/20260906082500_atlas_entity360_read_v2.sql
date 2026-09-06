-- ATLAS Entidad 360 aggregated read contract v2.
-- Canonical browser path: one RPC call for identity, SII, UAF, sanctions,
-- public spend and recent history. SECURITY INVOKER preserves caller RLS.

create or replace function public.atlas_entity360_read_v2(p_entity_id text)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
with identity_row as (
  select to_jsonb(m) as j
  from public.aml_entity_master_v0553 m
  where m.entity_id = p_entity_id
  limit 1
), resolved as (
  select coalesce(
    nullif((select j->>'rut' from identity_row), ''),
    case
      when p_entity_id ~ '^ENT-RUT-[0-9]+-[0-9Kk]$'
      then regexp_replace(p_entity_id, '^ENT-RUT-', '')
      else null
    end
  ) as rut
), tax_row as (
  select to_jsonb(t) as j
  from public.aml_entity_tax_profile t
  where t.entity_id = p_entity_id
  limit 1
), uaf_row as (
  select to_jsonb(u) as j
  from public.aml_uaf_entity_profile u, resolved r
  where regexp_replace(upper(u.rut), '[^0-9K]', '', 'g') = regexp_replace(upper(r.rut), '[^0-9K]', '', 'g')
  limit 1
), sanctions_row as (
  select to_jsonb(s) as j
  from public.aml_v_ipa3_sanction_entity_summary s
  where s.entity_id = p_entity_id
  limit 1
), spend_row as (
  select to_jsonb(s) as j
  from public.aml_v_public_spend_provider_intel_0720 s
  where s.entity_id = p_entity_id
  limit 1
), history_rows as (
  select coalesce(jsonb_agg(to_jsonb(h) order by h.commercial_year desc), '[]'::jsonb) as j
  from (
    select *
    from public.aml_sii_entity_year
    where entity_id = p_entity_id
    order by commercial_year desc
    limit 8
  ) h
)
select jsonb_build_object(
  'contract', 'ATLAS_ENTITY360_READ_V2',
  'generated_at', now(),
  'entity_id', p_entity_id,
  'resolved_rut', (select rut from resolved),
  'identity', (select j from identity_row),
  'tax', (select j from tax_row),
  'uaf', (select j from uaf_row),
  'sanctions', (select j from sanctions_row),
  'spend', (select j from spend_row),
  'history', (select j from history_rows),
  'source_status', jsonb_build_object(
    'identity', case when exists(select 1 from identity_row) then 'AVAILABLE' else 'EMPTY' end,
    'tax', case when exists(select 1 from tax_row) then 'AVAILABLE' else 'EMPTY' end,
    'uaf', case when exists(select 1 from uaf_row) then 'AVAILABLE' else 'EMPTY' end,
    'sanctions', case when exists(select 1 from sanctions_row) then 'AVAILABLE' else 'EMPTY' end,
    'spend', case when exists(select 1 from spend_row) then 'AVAILABLE' else 'EMPTY' end,
    'history', case when coalesce(jsonb_array_length((select j from history_rows)),0) > 0 then 'AVAILABLE' else 'EMPTY' end
  )
);
$$;

grant execute on function public.atlas_entity360_read_v2(text) to authenticated;
revoke execute on function public.atlas_entity360_read_v2(text) from anon;
