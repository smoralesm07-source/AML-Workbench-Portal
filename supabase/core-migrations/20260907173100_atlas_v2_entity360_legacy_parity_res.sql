-- ATLAS v2 · Entity 360 legacy parity · RES lifecycle extension

create or replace function atlas_v2_private.entity_dossier_legacy_parity(
  p_entity_id text,
  p_rut text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'atlas_v2_private'
as $$
declare
  v_rut text := upper(regexp_replace(coalesce(p_rut,''),'[^0-9Kk]','','g'));
  v_score jsonb := null;
  v_marks jsonb := '[]'::jsonb;
  v_peers jsonb := '[]'::jsonb;
  v_structure jsonb := null;
  v_trajectory jsonb := null;
  v_sanction_summary jsonb := null;
  v_sanction_resolution jsonb := '[]'::jsonb;
  v_links jsonb := '[]'::jsonb;
  v_uaf jsonb := null;
  v_osfl jsonb := null;
  v_disposition jsonb := null;
  v_res_profile jsonb := null;
  v_res_lifecycle jsonb := null;
  v_res_relationships jsonb := '[]'::jsonb;
  v_res_evidence jsonb := '[]'::jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from public.aml_allowed_users u
    where u.user_id = auth.uid() and u.enabled
  ) then
    raise exception 'ATLAS_CORE_FORBIDDEN' using errcode='42501';
  end if;

  if v_rut = '' then
    select upper(regexp_replace(coalesce(r.rut,''),'[^0-9Kk]','','g')) into v_rut
    from public.aml_entity_resolution_index_v1 r
    where r.entity_id = p_entity_id
    limit 1;
  end if;

  select to_jsonb(s) into v_score
  from public.aml_ipa3_entity_score_snapshot_v0_4 s
  where s.entity_id = p_entity_id limit 1;

  select coalesce(jsonb_agg(to_jsonb(m) order by m.contribution desc nulls last, m.mark_id), '[]'::jsonb) into v_marks
  from (
    select * from public.aml_ipa3_mark_scores_snapshot_v0_4
    where entity_id = p_entity_id
    order by contribution desc nulls last, mark_id
    limit 24
  ) m;

  select coalesce(jsonb_agg(to_jsonb(p) order by p.commercial_year desc), '[]'::jsonb) into v_peers
  from (
    select * from public.aml_entity_peer_position_snapshot
    where entity_id = p_entity_id
    order by commercial_year desc
    limit 8
  ) p;

  select to_jsonb(s) into v_structure
  from public.aml_v_ipa3_structure_peer_benchmark s
  where s.entity_id = p_entity_id
  order by s.commercial_year desc nulls last
  limit 1;

  select to_jsonb(t) into v_trajectory
  from public.aml_v_ipa3_sii_trajectory_summary t
  where t.entity_id = p_entity_id limit 1;

  select to_jsonb(s) into v_sanction_summary
  from public.aml_v_ipa3_sanction_entity_summary s
  where s.entity_id = p_entity_id limit 1;

  select coalesce(jsonb_agg(to_jsonb(s) order by s.source_event_date desc nulls last), '[]'::jsonb) into v_sanction_resolution
  from (
    select * from public.aml_sanction_identity_resolution
    where resolved_entity_id = p_entity_id
    order by source_event_date desc nulls last
    limit 20
  ) s;

  select coalesce(jsonb_agg(to_jsonb(l) order by l.refreshed_at desc nulls last), '[]'::jsonb) into v_links
  from (
    select * from public.aml_entity_identity_link_snapshot
    where entidad_origen_id = p_entity_id or entidad_destino_id = p_entity_id
    order by refreshed_at desc nulls last
    limit 20
  ) l;

  if v_rut <> '' then
    select to_jsonb(u) into v_uaf
    from public.aml_uaf_entity_profile u
    where upper(regexp_replace(coalesce(u.rut,''),'[^0-9Kk]','','g')) = v_rut
    limit 1;
  end if;

  select to_jsonb(o) into v_osfl
  from public.aml_osfl_profile o
  where o.entity_id = p_entity_id
     or (v_rut <> '' and upper(regexp_replace(coalesce(o.rut,''),'[^0-9Kk]','','g')) = v_rut)
  order by case when o.entity_id = p_entity_id then 0 else 1 end
  limit 1;

  select to_jsonb(d) into v_disposition
  from public.aml_v0460_entity_disposition_current d
  where d.entity_id = p_entity_id limit 1;

  select to_jsonb(r) into v_res_profile
  from public.aml_res_entity_profile_v1 r
  where r.entity_id = p_entity_id
     or (v_rut <> '' and upper(regexp_replace(coalesce(r.rut,''),'[^0-9Kk]','','g')) = v_rut)
  order by case when r.entity_id = p_entity_id then 0 else 1 end
  limit 1;

  select to_jsonb(r) into v_res_lifecycle
  from public.aml_entity_res_lifecycle_v0556 r
  where r.entity_id = p_entity_id
     or (v_rut <> '' and upper(regexp_replace(coalesce(r.rut,''),'[^0-9Kk]','','g')) = v_rut)
  order by case when r.entity_id = p_entity_id then 0 else 1 end
  limit 1;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.valid_from desc nulls last, r.refreshed_at desc nulls last), '[]'::jsonb) into v_res_relationships
  from (
    select * from public.aml_entity_res_relationship_v0556
    where entity_id = p_entity_id
    order by valid_from desc nulls last, refreshed_at desc nulls last
    limit 24
  ) r;

  select coalesce(jsonb_agg(to_jsonb(e) order by e.actuation_date desc nulls last, e.refreshed_at desc nulls last), '[]'::jsonb) into v_res_evidence
  from (
    select * from public.aml_entity_res_evidence_v0556
    where entity_id = p_entity_id
    order by actuation_date desc nulls last, refreshed_at desc nulls last
    limit 12
  ) e;

  return jsonb_build_object(
    'mode','ENTITY360_LEGACY_PARITY_V2',
    'entity_id',p_entity_id,
    'resolved_rut',case when v_rut='' then null else v_rut end,
    'ipa3_score',v_score,
    'ipa3_marks',v_marks,
    'peer_positions',v_peers,
    'structure_benchmark',v_structure,
    'trajectory_summary',v_trajectory,
    'sanction_summary',v_sanction_summary,
    'sanction_resolution',v_sanction_resolution,
    'identity_links',v_links,
    'uaf_profile',v_uaf,
    'osfl_profile',v_osfl,
    'disposition',v_disposition,
    'res_profile',v_res_profile,
    'res_lifecycle',v_res_lifecycle,
    'res_relationships',v_res_relationships,
    'res_evidence',v_res_evidence,
    'read_status',jsonb_build_object(
      'ipa3',case when v_score is null then 'EMPTY' else 'AVAILABLE' end,
      'peers',case when jsonb_array_length(v_peers)=0 then 'EMPTY' else 'AVAILABLE' end,
      'structure',case when v_structure is null then 'EMPTY' else 'AVAILABLE' end,
      'trajectory',case when v_trajectory is null then 'EMPTY' else 'AVAILABLE' end,
      'sanctions',case when v_sanction_summary is null and jsonb_array_length(v_sanction_resolution)=0 then 'EMPTY' else 'AVAILABLE' end,
      'identity_links',case when jsonb_array_length(v_links)=0 then 'EMPTY' else 'AVAILABLE' end,
      'uaf',case when v_uaf is null then 'EMPTY' else 'AVAILABLE' end,
      'osfl',case when v_osfl is null then 'EMPTY' else 'AVAILABLE' end,
      'res',case when v_res_profile is null and v_res_lifecycle is null then 'EMPTY' else 'AVAILABLE' end
    ),
    'semantics',jsonb_build_object(
      'priority_is_not_probability',true,
      'peer_percentile_is_position_not_performance',true,
      'relationship_does_not_transfer_risk',true,
      'candidate_identity_stays_candidate',true,
      'administrative_sanction_is_not_crime',true,
      'missing_is_not_zero',true
    )
  );
end;
$$;
