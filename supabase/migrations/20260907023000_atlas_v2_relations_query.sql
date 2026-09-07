-- ATLAS v2 · governed Relations read contract
-- Documented edges are observed source relationships. Convergences are analytical
-- dimensions on observed edges. Hypotheses are never materialized automatically.

create or replace function atlas_v2_private.relations_query(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public'
as $function$
declare
  v_kind text := lower(trim(coalesce(p_request->>'kind','')));
  v_search text := nullif(trim(coalesce(p_request->>'search','')),'');
  v_rut text := nullif(trim(coalesce(p_request->>'rut','')),'');
  v_entity_id text := nullif(trim(coalesce(p_request->>'entity_id','')),'');
  v_buyer_id text := nullif(trim(coalesce(p_request->>'buyer_id','')),'');
  v_supplier_id text := nullif(trim(coalesce(p_request->>'supplier_id','')),'');
  v_relation_id text := nullif(trim(coalesce(p_request->>'relation_id','')),'');
  v_limit integer := greatest(1, least(coalesce(nullif(p_request->>'limit','')::integer,40),100));
  v_offset integer := greatest(0, least(coalesce(nullif(p_request->>'offset','')::integer,0),10000));
  v_min_priority numeric := case when p_request ? 'min_priority' then nullif(p_request->>'min_priority','')::numeric else null end;
  v_min_convergence integer := greatest(1, least(coalesce(nullif(p_request->>'min_convergence','')::integer,2),20));
  v_snapshot_id text;
  v_items jsonb := '[]'::jsonb;
  v_nodes jsonb := '[]'::jsonb;
  v_edges jsonb := '[]'::jsonb;
  v_evidence jsonb := '[]'::jsonb;
  v_center jsonb;
  v_detail jsonb;
  v_count integer := 0;
begin
  if not atlas_v2_private.is_allowed() then
    raise exception 'ATLAS_V2_FORBIDDEN' using errcode='42501';
  end if;

  select h.snapshot_id into v_snapshot_id
  from public.atlas_v2_model_head h
  where h.model_key='public_spend_overview'
    and h.scope_key='global'
    and h.status='READY'
  limit 1;

  if v_kind in ('search','neighborhood','convergences','relation_detail') and v_snapshot_id is null then
    raise exception 'ATLAS_V2_RELATIONS_SOURCE_NOT_READY';
  end if;

  if v_kind='search' then
    with candidates as (
      select 'supplier:'||s.supplier_id as node_id,'SUPPLIER'::text as node_type,
             coalesce(nullif(s.supplier_label,''),s.supplier_id) as label,
             case when s.supplier_id ~ '^[0-9]+-[0-9Kk]$' then upper(s.supplier_id) else null end as rut,
             'procurement'::text as source_domain,s.amount_12m,s.buyer_count as relation_count,
             null::integer as source_count,s.review_priority,null::text as region,null::text as commune
      from public.ps_supplier_metric s
      where s.snapshot_id=v_snapshot_id
        and (v_search is null or s.supplier_id ilike '%'||v_search||'%' or coalesce(s.supplier_label,'') ilike '%'||v_search||'%')
        and (v_min_priority is null or s.review_priority>=v_min_priority)
      union all
      select 'buyer:'||b.buyer_id,'BUYER'::text,coalesce(nullif(b.buyer_label,''),b.buyer_id),
             case when b.buyer_id ~ '^[0-9]+-[0-9Kk]$' then upper(b.buyer_id) else null end,
             'procurement'::text,b.amount_12m,b.supplier_count,null::integer,b.review_priority,null::text,null::text
      from public.ps_buyer_metric b
      where b.snapshot_id=v_snapshot_id
        and (v_search is null or b.buyer_id ilike '%'||v_search||'%' or coalesce(b.buyer_label,'') ilike '%'||v_search||'%')
        and (v_min_priority is null or b.review_priority>=v_min_priority)
      union all
      select 'entity:'||e.entity_id,'ENTITY'::text,coalesce(nullif(e.name,''),e.entity_id),e.rut,
             'atlas_observation'::text,null::numeric,null::integer,e.source_count,e.max_finding_score,e.region,e.commune
      from public.obs_entity e
      where v_search is not null
        and (e.entity_id ilike '%'||v_search||'%' or coalesce(e.rut,'') ilike '%'||v_search||'%' or coalesce(e.name_search,e.name,'') ilike '%'||v_search||'%')
    ), ranked as (
      select * from candidates
      order by review_priority desc nulls last, amount_12m desc nulls last, label
      limit v_limit offset v_offset
    )
    select coalesce(jsonb_agg(to_jsonb(ranked)),'[]'::jsonb),count(*) into v_items,v_count from ranked;

    return jsonb_build_object(
      'schema','ATLAS_RELATIONS_QUERY_V2','snapshot_id',v_snapshot_id,'kind',v_kind,'items',v_items,
      'page',jsonb_build_object('offset',v_offset,'limit',v_limit,'returned',v_count,'has_more',v_count=v_limit,'next_offset',case when v_count=v_limit then v_offset+v_limit else null end),
      'semantics',jsonb_build_object('identity_join','EXACT_IDENTIFIERS_ONLY','context_inheritance',false)
    );

  elsif v_kind='neighborhood' then
    if v_supplier_id is null and v_rut is not null then
      select s.supplier_id into v_supplier_id from public.ps_supplier_metric s
      where s.snapshot_id=v_snapshot_id and upper(s.supplier_id)=upper(v_rut) limit 1;
    end if;
    if v_buyer_id is null and v_supplier_id is null and v_rut is not null then
      select b.buyer_id into v_buyer_id from public.ps_buyer_metric b
      where b.snapshot_id=v_snapshot_id and upper(b.buyer_id)=upper(v_rut) limit 1;
    end if;
    if v_entity_id is null and v_rut is not null then
      select e.entity_id into v_entity_id from public.obs_entity e
      where upper(coalesce(e.rut,''))=upper(v_rut) limit 1;
    end if;

    if v_supplier_id is not null then
      select jsonb_build_object('node_id','supplier:'||s.supplier_id,'node_type','SUPPLIER','label',coalesce(nullif(s.supplier_label,''),s.supplier_id),
        'rut',case when s.supplier_id ~ '^[0-9]+-[0-9Kk]$' then upper(s.supplier_id) else null end,'source_domain','procurement',
        'amount_12m',s.amount_12m,'relation_count',s.buyer_count,'review_priority',s.review_priority)
      into v_center from public.ps_supplier_metric s where s.snapshot_id=v_snapshot_id and s.supplier_id=v_supplier_id;

      with top_pairs as (
        select p.* from public.ps_pair_metric p
        where p.snapshot_id=v_snapshot_id and p.supplier_id=v_supplier_id
          and (v_min_priority is null or p.review_priority>=v_min_priority)
        order by p.review_priority desc nulls last,p.amount_12m desc,p.pair_id limit v_limit
      )
      select coalesce(jsonb_agg(jsonb_build_object('node_id','buyer:'||p.buyer_id,'node_type','BUYER','label',coalesce(nullif(p.buyer_label,''),p.buyer_id),
               'rut',case when p.buyer_id ~ '^[0-9]+-[0-9Kk]$' then upper(p.buyer_id) else null end,'source_domain','procurement')),'[]'::jsonb),
             coalesce(jsonb_agg(jsonb_build_object('relation_id',p.pair_id,'relation_class','DOCUMENTED','relation_type','PROCUREMENT_BUYER_SUPPLIER',
               'source_domain','procurement','source_code','CHILECOMPRA','from_node_id','buyer:'||p.buyer_id,'to_node_id','supplier:'||p.supplier_id,
               'from_label',coalesce(nullif(p.buyer_label,''),p.buyer_id),'to_label',coalesce(nullif(p.supplier_label,''),p.supplier_id),
               'amount_clp',p.amount_12m,'event_count',p.order_count_12m,'first_seen',p.first_seen,'last_seen',p.last_seen,
               'review_priority',p.review_priority,'convergence_count',p.convergence_count,'price_signal_count',p.price_signal_count,
               'acceleration_ratio',p.acceleration_ratio,'flags',p.flags,'risk_inheritance',false)),'[]'::jsonb)
      into v_nodes,v_edges from top_pairs p;

      select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into v_evidence from (
        select finding_id,finding_type,family,supplier_id,buyer_id,pair_id,review_priority,severity_band,materiality_clp,title,summary,source_status,created_at
        from public.ps_finding where snapshot_id=v_snapshot_id and supplier_id=v_supplier_id
        order by review_priority desc nulls last,materiality_clp desc nulls last limit 30
      ) x;

    elsif v_buyer_id is not null then
      select jsonb_build_object('node_id','buyer:'||b.buyer_id,'node_type','BUYER','label',coalesce(nullif(b.buyer_label,''),b.buyer_id),
        'rut',case when b.buyer_id ~ '^[0-9]+-[0-9Kk]$' then upper(b.buyer_id) else null end,'source_domain','procurement',
        'amount_12m',b.amount_12m,'relation_count',b.supplier_count,'review_priority',b.review_priority)
      into v_center from public.ps_buyer_metric b where b.snapshot_id=v_snapshot_id and b.buyer_id=v_buyer_id;

      with top_pairs as (
        select p.* from public.ps_pair_metric p
        where p.snapshot_id=v_snapshot_id and p.buyer_id=v_buyer_id
          and (v_min_priority is null or p.review_priority>=v_min_priority)
        order by p.review_priority desc nulls last,p.amount_12m desc,p.pair_id limit v_limit
      )
      select coalesce(jsonb_agg(jsonb_build_object('node_id','supplier:'||p.supplier_id,'node_type','SUPPLIER','label',coalesce(nullif(p.supplier_label,''),p.supplier_id),
               'rut',case when p.supplier_id ~ '^[0-9]+-[0-9Kk]$' then upper(p.supplier_id) else null end,'source_domain','procurement')),'[]'::jsonb),
             coalesce(jsonb_agg(jsonb_build_object('relation_id',p.pair_id,'relation_class','DOCUMENTED','relation_type','PROCUREMENT_BUYER_SUPPLIER',
               'source_domain','procurement','source_code','CHILECOMPRA','from_node_id','buyer:'||p.buyer_id,'to_node_id','supplier:'||p.supplier_id,
               'from_label',coalesce(nullif(p.buyer_label,''),p.buyer_id),'to_label',coalesce(nullif(p.supplier_label,''),p.supplier_id),
               'amount_clp',p.amount_12m,'event_count',p.order_count_12m,'first_seen',p.first_seen,'last_seen',p.last_seen,
               'review_priority',p.review_priority,'convergence_count',p.convergence_count,'price_signal_count',p.price_signal_count,
               'acceleration_ratio',p.acceleration_ratio,'flags',p.flags,'risk_inheritance',false)),'[]'::jsonb)
      into v_nodes,v_edges from top_pairs p;

      select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into v_evidence from (
        select finding_id,finding_type,family,supplier_id,buyer_id,pair_id,review_priority,severity_band,materiality_clp,title,summary,source_status,created_at
        from public.ps_finding where snapshot_id=v_snapshot_id and buyer_id=v_buyer_id
        order by review_priority desc nulls last,materiality_clp desc nulls last limit 30
      ) x;

    elsif v_entity_id is not null then
      select jsonb_build_object('node_id','entity:'||e.entity_id,'node_type','ENTITY','label',coalesce(nullif(e.name,''),e.entity_id),'rut',e.rut,
        'source_domain','atlas_observation','region',e.region,'commune',e.commune,'source_count',e.source_count,'finding_count',e.finding_count,
        'alert_count',e.alert_count,'review_priority',e.max_finding_score)
      into v_center from public.obs_entity e where e.entity_id=v_entity_id;

      select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into v_evidence from (
        select 'SOURCE'::text as evidence_type,source_code as evidence_id,status,record_count,last_event_at,detail
        from public.obs_entity_source where entity_id=v_entity_id
        union all
        select 'FINDING'::text,finding_id,'OBSERVED'::text,evidence_count,refreshed_at,
               jsonb_build_object('finding_type',finding_type,'title',title,'score_explore',score_explore,'score_supervise',score_supervise,
                 'score_investigate',score_investigate,'source_count',source_count)
        from public.obs_finding where entity_id=v_entity_id
      ) x;
    end if;

    return jsonb_build_object(
      'schema','ATLAS_RELATIONS_QUERY_V2','snapshot_id',v_snapshot_id,'kind',v_kind,'center',v_center,'nodes',v_nodes,'edges',v_edges,'evidence',v_evidence,
      'availability',jsonb_build_object('procurement_pairs',true,'entity_observations',exists(select 1 from public.obs_entity limit 1),
        'representatives',false,'domiciles',false,'shareholding',false,'society_control',false),
      'semantics',jsonb_build_object('documented_relation','observed relationship in a published source',
        'convergence','multiple analytical signals on an observed relationship; not necessarily independent sources',
        'hypothesis','never auto-created as an edge in this cut','risk_inheritance',false)
    );

  elsif v_kind='convergences' then
    with ranked as (
      select p.* from public.ps_pair_metric p
      where p.snapshot_id=v_snapshot_id and p.convergence_count>=v_min_convergence
        and (v_supplier_id is null or p.supplier_id=v_supplier_id)
        and (v_buyer_id is null or p.buyer_id=v_buyer_id)
        and (v_rut is null or p.supplier_id=v_rut or p.buyer_id=v_rut)
        and (v_min_priority is null or p.review_priority>=v_min_priority)
      order by p.convergence_count desc,p.review_priority desc nulls last,p.amount_12m desc,p.pair_id
      limit v_limit offset v_offset
    )
    select coalesce(jsonb_agg(jsonb_build_object('relation_id',p.pair_id,'relation_class','CONVERGENCE','relation_type','PROCUREMENT_SIGNAL_CONVERGENCE',
      'source_domain','procurement','source_code','CHILECOMPRA','independent_sources',false,'buyer_id',p.buyer_id,'supplier_id',p.supplier_id,
      'buyer_label',p.buyer_label,'supplier_label',p.supplier_label,'amount_clp',p.amount_12m,'event_count',p.order_count_12m,
      'convergence_count',p.convergence_count,'price_signal_count',p.price_signal_count,'acceleration_ratio',p.acceleration_ratio,
      'review_priority',p.review_priority,'flags',p.flags,'risk_inheritance',false)),'[]'::jsonb),count(*) into v_items,v_count from ranked p;

    return jsonb_build_object('schema','ATLAS_RELATIONS_QUERY_V2','snapshot_id',v_snapshot_id,'kind',v_kind,'items',v_items,
      'page',jsonb_build_object('offset',v_offset,'limit',v_limit,'returned',v_count,'has_more',v_count=v_limit,'next_offset',case when v_count=v_limit then v_offset+v_limit else null end),
      'semantics',jsonb_build_object('independent_sources',false,'risk_inheritance',false,'meaning','multiple analytical dimensions within procurement; not proof of irregularity'));

  elsif v_kind='relation_detail' then
    if v_relation_id is null then raise exception 'ATLAS_V2_RELATION_ID_REQUIRED'; end if;
    select jsonb_build_object(
      'relation',jsonb_build_object('relation_id',p.pair_id,'relation_class','DOCUMENTED','relation_type','PROCUREMENT_BUYER_SUPPLIER',
        'source_domain','procurement','source_code','CHILECOMPRA','buyer_id',p.buyer_id,'supplier_id',p.supplier_id,
        'buyer_label',p.buyer_label,'supplier_label',p.supplier_label,'amount_clp',p.amount_12m,'event_count',p.order_count_12m,
        'buyer_share',p.buyer_share,'supplier_share',p.supplier_share,'active_months',p.active_months,'first_seen',p.first_seen,'last_seen',p.last_seen,
        'recent_3m_amount',p.recent_3m_amount,'previous_3m_amount',p.previous_3m_amount,'acceleration_ratio',p.acceleration_ratio,
        'price_signal_count',p.price_signal_count,'max_price_ratio',p.max_price_ratio,'convergence_count',p.convergence_count,
        'review_priority',p.review_priority,'flags',p.flags,'risk_inheritance',false),
      'findings',coalesce((select jsonb_agg(to_jsonb(f)) from (
        select finding_id,finding_type,family,supplier_id,buyer_id,pair_id,review_priority,severity_band,materiality_clp,title,summary,metrics,evidence,source_status,created_at
        from public.ps_finding where snapshot_id=v_snapshot_id and pair_id=v_relation_id
        order by review_priority desc nulls last,materiality_clp desc nulls last limit 50
      ) f),'[]'::jsonb)
    ) into v_detail from public.ps_pair_metric p where p.snapshot_id=v_snapshot_id and p.pair_id=v_relation_id;

    return jsonb_build_object('schema','ATLAS_RELATIONS_QUERY_V2','snapshot_id',v_snapshot_id,'kind',v_kind,'detail',v_detail,
      'semantics',jsonb_build_object('risk_inheritance',false));

  elsif v_kind='hypotheses' then
    return jsonb_build_object('schema','ATLAS_RELATIONS_QUERY_V2','snapshot_id',v_snapshot_id,'kind',v_kind,'items','[]'::jsonb,
      'availability',jsonb_build_object('generated',false,'reason','NO_GOVERNED_IDENTITY_RELATION_MODEL',
        'pending_relation_families',jsonb_build_array('REPRESENTATIVE','DOMICILE','SHAREHOLDING','SOCIETY_CONTROL')),
      'semantics',jsonb_build_object('hypothesis_is_edge',false,'identity_inference','DISABLED','risk_inheritance',false));
  else
    raise exception 'ATLAS_V2_RELATIONS_QUERY_KIND_INVALID';
  end if;
end;
$function$;

revoke all on function atlas_v2_private.relations_query(jsonb) from public, anon;
grant execute on function atlas_v2_private.relations_query(jsonb) to authenticated, service_role;

create or replace function public.atlas_v2_relations_query(p_request jsonb)
returns jsonb
language sql
set search_path to 'pg_catalog','public','atlas_v2_private'
as $function$
  select atlas_v2_private.relations_query(p_request);
$function$;

revoke all on function public.atlas_v2_relations_query(jsonb) from public, anon;
grant execute on function public.atlas_v2_relations_query(jsonb) to authenticated, service_role;
