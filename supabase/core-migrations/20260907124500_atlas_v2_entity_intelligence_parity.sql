begin;
create schema if not exists atlas_v2_private;

create or replace function atlas_v2_private.entity_intelligence(p_entity_id text, p_rut text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, atlas_v2_private
as $$
declare
  v_base jsonb;
  v_rut text;
  v_marks jsonb := '[]'::jsonb;
  v_peers jsonb := '[]'::jsonb;
  v_links jsonb := '[]'::jsonb;
  v_res_timeline jsonb := '[]'::jsonb;
  v_res_documents jsonb := '[]'::jsonb;
  v_sanctions jsonb := '[]'::jsonb;
  v_sanction_evidence jsonb := '[]'::jsonb;
  v_press_events jsonb := '[]'::jsonb;
  v_timeline jsonb := '[]'::jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from public.aml_allowed_users u where u.user_id = auth.uid() and u.enabled
  ) then
    raise exception 'ATLAS_CORE_FORBIDDEN' using errcode='42501';
  end if;
  if coalesce(btrim(p_entity_id),'') = '' then
    raise exception 'ENTITY_REQUIRED' using errcode='22023';
  end if;

  v_base := public.atlas_v2_entity360_read(p_entity_id, p_rut);
  v_rut := coalesce(nullif(btrim(p_rut),''), nullif(v_base->>'resolved_rut',''));

  select coalesce(jsonb_agg(to_jsonb(x) order by x.contribution desc nulls last), '[]'::jsonb)
  into v_marks
  from (
    select mark_code, mark_group, mark_label, contribution, confidence, evidence, refreshed_at
    from public.aml_ipa3_mark_scores_snapshot_v0_4
    where entity_id=p_entity_id
    order by contribution desc nulls last
    limit 24
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.commercial_year desc), '[]'::jsonb)
  into v_peers
  from (
    select commercial_year, peer_level, peer_n, size_bucket, sales_peer_percentile, workers_peer_percentile,
           address_peer_percentile, activity_peer_percentile, refreshed_at
    from public.aml_entity_peer_position_snapshot
    where entity_id=p_entity_id
    order by commercial_year desc
    limit 8
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.actualizado_en desc nulls last), '[]'::jsonb)
  into v_links
  from (
    select relacion_id, entidad_origen_id, entidad_destino_id, tipo_relacion, estado_relacion, metodo_relacion,
           confianza, utilizable_en_analisis, requiere_revision, detalle, actualizado_en
    from public.aml_entity_identity_link_snapshot
    where entidad_origen_id=p_entity_id or entidad_destino_id=p_entity_id
    order by actualizado_en desc nulls last
    limit 40
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.actuation_date desc nulls last, x.registry_date desc nulls last), '[]'::jsonb)
  into v_res_timeline
  from (
    select actuation_id, rut, actuation_type, actuation_category, actuation_date, registry_date,
           source_record_id, source_snapshot_id, source_document_id, public_document_url,
           document_type, cve, document_review_status, evidence_status, structured_payload,
           source_cutoff_date, resource_id, refreshed_at
    from public.aml_entity_res_timeline_v0556
    where entity_id=p_entity_id
    order by actuation_date desc nulls last, registry_date desc nulls last
    limit 80
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.actuation_date desc nulls last, x.registry_date desc nulls last), '[]'::jsonb)
  into v_res_documents
  from (
    select document_id, company_rut, document_type, actuation_type, actuation_date, registry_date,
           document_title, source_url, source_domain, cve, document_hash, ingestion_method,
           extraction_status, review_status, notes, structured_payload, refreshed_at
    from public.aml_entity_res_evidence_v0556
    where entity_id=p_entity_id
    order by actuation_date desc nulls last, registry_date desc nulls last
    limit 60
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.event_date desc nulls last), '[]'::jsonb)
  into v_sanctions
  from (
    select sanction_id, event_date, regulator, entity_name, identity_status, laft_direct, amount_uf, subject, payload, snapshot_id
    from public.aml_sanctions
    where entity_id=p_entity_id
    order by event_date desc nulls last
    limit 50
  ) x;

  select coalesce(jsonb_agg(to_jsonb(e) order by e.published_at desc nulls last), '[]'::jsonb)
  into v_sanction_evidence
  from public.aml_sanction_evidence_v0960 e
  where e.evidence_id in (
    select jsonb_array_elements_text(coalesce(s.payload->'evidence_ids','[]'::jsonb))
    from public.aml_sanctions s
    where s.entity_id=p_entity_id
  );

  select coalesce(e.profile->'eventos','[]'::jsonb)
  into v_press_events
  from public.aml_entities e
  where e.entity_id=p_entity_id
  limit 1;
  v_press_events := coalesce(v_press_events,'[]'::jsonb);

  with events as (
    select jsonb_build_object(
      'event_id','sii:'||p_entity_id||':'||coalesce(h.commercial_year::text,'unknown'),
      'source','SII','event_type','SII_YEAR','event_year',h.commercial_year,'event_date',null,
      'title','Año comercial SII '||coalesce(h.commercial_year::text,'—'),
      'summary',concat_ws(' · ', nullif(h.sales_band_code,''), case when h.workers_numeric is not null then h.workers_numeric::text||' trabajadores' end, nullif(h.main_activity,'')),
      'document_id',null,'source_url',null,'payload',to_jsonb(h)
    ) as event, make_date(h.commercial_year,1,1) as sort_date
    from public.aml_sii_entity_year h where h.entity_id=p_entity_id
    union all
    select jsonb_build_object(
      'event_id','res:'||coalesce(r.actuation_id,r.source_record_id,'unknown'),'source','RES','event_type',coalesce(r.actuation_type,'RES_ACTUATION'),
      'event_year',extract(year from coalesce(r.actuation_date,r.registry_date))::int,'event_date',coalesce(r.actuation_date,r.registry_date),
      'title',coalesce(r.actuation_type,r.actuation_category,'Actuación RES'),
      'summary',concat_ws(' · ',nullif(r.document_type,''),case when r.cve is not null then 'CVE '||r.cve end),
      'document_id',r.source_document_id,'source_url',r.public_document_url,'payload',to_jsonb(r)
    ), coalesce(r.actuation_date,r.registry_date)
    from public.aml_entity_res_timeline_v0556 r where r.entity_id=p_entity_id
    union all
    select jsonb_build_object(
      'event_id',s.sanction_id,'source','SANCIONES','event_type','REGULATORY_SANCTION','event_year',extract(year from s.event_date)::int,
      'event_date',s.event_date,'title',coalesce(s.regulator,'Sanción')||' · '||coalesce(s.subject,'Evento sancionatorio'),
      'summary',coalesce(s.payload->'attributes'->>'summary',s.subject),'document_id',coalesce(s.payload->'evidence_ids'->>0,null),
      'source_url',(select e.source_url from public.aml_sanction_evidence_v0960 e where e.evidence_id=coalesce(s.payload->'evidence_ids'->>0,'') limit 1),
      'payload',to_jsonb(s)
    ), s.event_date
    from public.aml_sanctions s where s.entity_id=p_entity_id
    union all
    select jsonb_build_object(
      'event_id',coalesce(p.ev->>'event_id','press:'||p.ord::text),'source','RADAR_PRENSA','event_type',coalesce(p.ev->>'tipo','PRESS_CONTEXT_EVENT'),
      'event_year',case when coalesce(p.ev->>'fecha','') ~ '^\d{4}' then left(p.ev->>'fecha',4)::int else null end,
      'event_date',case when coalesce(p.ev->>'fecha','') ~ '^\d{4}-\d{2}-\d{2}' then (left(p.ev->>'fecha',10))::date else null end,
      'title',coalesce(p.ev->>'titulo','Mención en Radar Prensa'),'summary',coalesce(p.ev->>'tipo_es','Contexto de prensa'),
      'document_id',null,'source_url',null,'payload',p.ev
    ), case when coalesce(p.ev->>'fecha','') ~ '^\d{4}-\d{2}-\d{2}' then (left(p.ev->>'fecha',10))::date else null end
    from jsonb_array_elements(v_press_events) with ordinality p(ev,ord)
  )
  select coalesce(jsonb_agg(event order by sort_date desc nulls last),'[]'::jsonb) into v_timeline from events;

  return jsonb_build_object(
    'contract','ATLAS_ENTITY_INTELLIGENCE_V2','entity_id',p_entity_id,'resolved_rut',v_rut,'generated_at',now(),
    'base',v_base,'marks',v_marks,'peers',v_peers,'identity_links',v_links,
    'timeline',v_timeline,'res_timeline',v_res_timeline,'documents',v_res_documents,
    'sanctions',v_sanctions,'sanction_evidence',v_sanction_evidence,'press_events',v_press_events,
    'semantics',jsonb_build_object(
      'priority_not_probability',true,'identity_not_similarity',true,'watchlist_candidate_requires_review',true,
      'sanction_not_crime',true,'press_context_not_identity',true,'year_only_sii_events_not_exact_dates',true
    )
  );
end;
$$;

revoke all on function atlas_v2_private.entity_intelligence(text,text) from public, anon;
grant execute on function atlas_v2_private.entity_intelligence(text,text) to authenticated;

create or replace function public.atlas_v2_entity_intelligence_read(p_entity_id text, p_rut text default null)
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$ select atlas_v2_private.entity_intelligence(p_entity_id,p_rut); $$;
revoke all on function public.atlas_v2_entity_intelligence_read(text,text) from public, anon;
grant execute on function public.atlas_v2_entity_intelligence_read(text,text) to authenticated;
commit;
