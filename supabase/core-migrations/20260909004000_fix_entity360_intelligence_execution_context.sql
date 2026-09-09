create or replace function public.atlas_v2_entity_intelligence_read(p_entity_id text, p_rut text default null::text)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, atlas_v2_private
as $function$
declare
  v_base jsonb;
  v_dossier jsonb;
  v_extensions jsonb := '{}'::jsonb;
  v_allowed boolean := false;
  v_status text := 'FULL';
  v_error_code text := null;
  v_error_message text := null;
begin
  v_allowed := auth.role() = 'service_role'
    or (
      auth.uid() is not null
      and exists (
        select 1
        from public.aml_allowed_users u
        where u.user_id = auth.uid()
          and u.enabled
      )
    );

  if not v_allowed then
    raise exception 'ATLAS_CORE_FORBIDDEN' using errcode='42501';
  end if;

  v_base := public.atlas_v2_entity360_read(p_entity_id, p_rut);

  begin
    v_dossier := atlas_v2_private.entity_dossier_legacy_parity(p_entity_id, p_rut);
  exception when others then
    v_status := 'DEGRADED';
    v_error_code := sqlstate;
    v_error_message := left(sqlerrm, 180);
    v_dossier := jsonb_strip_nulls(jsonb_build_object(
      'mode', 'ENTITY360_BASE_FALLBACK_V2',
      'entity_id', p_entity_id,
      'resolved_rut', coalesce(nullif(btrim(p_rut), ''), v_base->>'resolved_rut'),
      'uaf_profile', v_base->'uaf',
      'sanction_summary', v_base->'sanctions',
      'sanction_resolution', '[]'::jsonb,
      'public_spend', v_base->'spend',
      'read_status', jsonb_build_object(
        'uaf', case when v_base->'uaf' is null or v_base->'uaf' = 'null'::jsonb then 'EMPTY' else 'AVAILABLE' end,
        'sanctions', case when v_base->'sanctions' is null or v_base->'sanctions' = 'null'::jsonb then 'EMPTY' else 'AVAILABLE' end,
        'spend', case when v_base->'spend' is null or v_base->'spend' = 'null'::jsonb then 'EMPTY' else 'AVAILABLE' end
      )
    ));
  end;

  begin
    v_extensions := atlas_v2_private.entity_context_extensions_final(p_entity_id, p_rut);
  exception when others then
    v_status := 'DEGRADED';
    if v_error_code is null then
      v_error_code := sqlstate;
      v_error_message := left(sqlerrm, 180);
    end if;
    v_extensions := '{}'::jsonb;
  end;

  return jsonb_build_object(
    'contract', 'ATLAS_ENTITY_INTELLIGENCE_V2',
    'entity_id', p_entity_id,
    'resolved_rut', coalesce(nullif(btrim(p_rut), ''), v_base->>'resolved_rut'),
    'generated_at', now(),
    'base', v_base,
    'semantics', jsonb_build_object(
      'identity_not_similarity', true,
      'screening_candidate_requires_review', true,
      'press_context_not_identity', true,
      'termination_is_tax_status_not_aml_signal', true,
      'legacy_entity360_parity', true,
      'partial_intelligence_does_not_block_entity360', true
    ),
    'dossier', coalesce(v_dossier, '{}'::jsonb),
    'intelligence_status', v_status,
    'intelligence_error', case when v_error_code is null then null else jsonb_build_object('code', v_error_code, 'message', v_error_message) end
  ) || coalesce(v_extensions, '{}'::jsonb);
end;
$function$;

revoke all on function public.atlas_v2_entity_intelligence_read(text,text) from public, anon;
grant execute on function public.atlas_v2_entity_intelligence_read(text,text) to authenticated, service_role;
