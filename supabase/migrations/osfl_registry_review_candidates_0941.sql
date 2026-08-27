-- ATLAS OSFL Registry 0.94.1 · read audit + candidate-only probabilistic identity resolution.

drop policy if exists aml_osfl_registry_ingest_run_authorized_select on public.aml_osfl_registry_ingest_run;
create policy aml_osfl_registry_ingest_run_authorized_select on public.aml_osfl_registry_ingest_run
for select to authenticated using (
  exists(select 1 from public.aml_allowed_users au where au.user_id=(select auth.uid()) and au.enabled)
);
grant select on public.aml_osfl_registry_ingest_run to authenticated;

create or replace function public.aml_generate_osfl_registry_probable_links_0941(p_limit integer default 500)
returns jsonb
language plpgsql
security invoker
set search_path=public
as $$
declare v_inserted integer:=0;
begin
  p_limit:=greatest(1,least(coalesce(p_limit,500),5000));
  with unresolved as (
    select m.* from public.aml_osfl_registry_master m
    where not exists(select 1 from public.aml_osfl_registry_entity_link l where l.registry_number=m.registry_number)
      and nullif(public.aml_norm_osfl_registry_text_0940(m.legal_name),'') is not null
    order by m.registry_number limit p_limit
  ), candidate_pool as (
    select u.registry_number,o.entity_id,o.rut,u.legal_name registry_name,o.name entity_name,
      u.region registry_region,o.region entity_region,u.commune registry_commune,o.commune entity_commune,
      similarity(public.aml_norm_osfl_registry_text_0940(u.legal_name),public.aml_norm_osfl_registry_text_0940(o.name)) sim
    from unresolved u
    join public.aml_osfl_entity_runtime_snapshot o on (
      (nullif(public.aml_norm_osfl_registry_text_0940(u.commune),'') is not null and public.aml_norm_osfl_registry_text_0940(u.commune)=public.aml_norm_osfl_registry_text_0940(o.commune))
      or
      (nullif(public.aml_norm_osfl_registry_text_0940(u.region),'') is not null and public.aml_norm_osfl_registry_text_0940(u.region)=public.aml_norm_osfl_registry_text_0940(o.region))
    )
    where similarity(public.aml_norm_osfl_registry_text_0940(u.legal_name),public.aml_norm_osfl_registry_text_0940(o.name))>=0.86
  ), ranked as (
    select *,row_number() over(partition by registry_number order by sim desc,entity_id) rn,
      lead(sim) over(partition by registry_number order by sim desc,entity_id) next_sim
    from candidate_pool
  )
  insert into public.aml_osfl_registry_entity_link(
    registry_number,entity_id,rut,match_status,match_method,match_confidence,review_status,match_basis,linked_at
  )
  select registry_number,entity_id,rut,'MATCH_PROBABLE','NAME_TRGM_TERRITORY',least(sim,0.9399),'PENDING_REVIEW',
    jsonb_build_object('similarity',sim,'next_best_similarity',next_sim,'registry_name',registry_name,'entity_name',entity_name,
      'registry_region',registry_region,'entity_region',entity_region,'registry_commune',registry_commune,'entity_commune',entity_commune),now()
  from ranked where rn=1 and (next_sim is null or sim-next_sim>=0.04)
  on conflict(registry_number,entity_id) do nothing;
  get diagnostics v_inserted=row_count;
  return jsonb_build_object('ok',true,'review_candidates_created',v_inserted,'review_status','PENDING_REVIEW','auto_merge',false);
end
$$;

revoke all on function public.aml_generate_osfl_registry_probable_links_0941(integer) from public,anon,authenticated;
grant execute on function public.aml_generate_osfl_registry_probable_links_0941(integer) to service_role;
comment on function public.aml_generate_osfl_registry_probable_links_0941(integer) is 'Crea candidatos MATCH_PROBABLE dentro de territorio con margen contra segundo candidato; siempre PENDING_REVIEW, nunca consolida identidad.';
