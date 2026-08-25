-- ATLAS AML 0.55.6 · contrato reproducible de ciclo de vida/evidencia RES
-- Aplicado en producción el 2026-08-24.
-- Este archivo NO habilita scraping: los documentos específicos se registran como enlaces oficiales.

create table if not exists public.aml_res_document_evidence (
  document_id text primary key,
  company_rut text not null,
  company_rut_key text not null,
  entity_id text,
  document_type text not null,
  actuation_type text not null,
  actuation_date date,
  registry_date date,
  document_title text,
  source_url text not null,
  source_domain text not null,
  cve text,
  document_hash text,
  ingestion_method text not null default 'MANUAL_STRUCTURED',
  extraction_status text not null default 'STRUCTURED',
  review_status text not null default 'PENDING',
  notes text,
  structured_payload jsonb not null default '{}'::jsonb,
  submitted_by uuid,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  refreshed_at timestamptz not null default now(),
  constraint aml_res_document_type_chk check (document_type in ('CONSTITUCION','MODIFICACION','TRANSFORMACION','FUSION','DIVISION','RECTIFICACION_SANEAMIENTO','DISOLUCION','MIGRACION','PODER','ACCIONISTAS','OTRO')),
  constraint aml_res_document_ingestion_chk check (ingestion_method in ('DATOS_GOB_CKAN','MANUAL_STRUCTURED','AUTHORIZED_API','DOCUMENT_IMPORT')),
  constraint aml_res_document_extract_chk check (extraction_status in ('PENDING','STRUCTURED','PARTIAL','ERROR')),
  constraint aml_res_document_review_chk check (review_status in ('PENDING','REVIEWED','REJECTED'))
);
alter table public.aml_res_document_evidence enable row level security;
drop policy if exists aml_res_document_evidence_allowed_read on public.aml_res_document_evidence;
create policy aml_res_document_evidence_allowed_read on public.aml_res_document_evidence for select to authenticated using (exists (select 1 from public.aml_allowed_users au where au.user_id=(select auth.uid()) and au.enabled));
grant select on public.aml_res_document_evidence to authenticated;
grant all on public.aml_res_document_evidence to service_role;

alter table public.aml_res_actuation add column if not exists source_document_id text;
alter table public.aml_res_actuation add column if not exists evidence_status text not null default 'OBSERVADO';
alter table public.aml_res_relationship add column if not exists source_document_id text;
alter table public.aml_res_relationship add column if not exists related_entity_type text not null default 'UNKNOWN';
alter table public.aml_res_relationship add column if not exists role_label text;
alter table public.aml_res_relationship add column if not exists relationship_basis text not null default 'DOCUMENTO_EXPLICITO';

create index if not exists aml_res_doc_company_idx on public.aml_res_document_evidence(company_rut_key,actuation_date desc);
create index if not exists aml_res_doc_entity_idx on public.aml_res_document_evidence(entity_id,actuation_date desc);
create index if not exists aml_res_actuation_rut_date_idx on public.aml_res_actuation(rut_key,actuation_date desc);
create index if not exists aml_res_actuation_doc_idx on public.aml_res_actuation(source_document_id) where source_document_id is not null;
create index if not exists aml_res_relationship_company_idx on public.aml_res_relationship(company_rut,valid_from desc);
create index if not exists aml_res_relationship_related_idx on public.aml_res_relationship(related_entity_id) where related_entity_id is not null;
create index if not exists aml_res_relationship_doc_idx on public.aml_res_relationship(source_document_id) where source_document_id is not null;

-- Views v0556 are security-invoker so authenticated reads continue to respect RLS.
-- Timeline: categoriza actuaciones y enlaza documento/CVE/estado de revisión.
create or replace view public.aml_entity_res_timeline_v0556 with (security_invoker=true) as
select b.entity_id,a.actuation_id,a.rut,a.actuation_type,
  case when upper(a.actuation_type) like '%CONSTIT%' then 'CONSTITUCION'
       when upper(a.actuation_type) like '%MODIF%' then 'MODIFICACION'
       when upper(a.actuation_type) like '%TRANSFORM%' then 'TRANSFORMACION'
       when upper(a.actuation_type) like '%FUS%' then 'FUSION'
       when upper(a.actuation_type) like '%DIVI%' then 'DIVISION'
       when upper(a.actuation_type) like '%RECTIF%' or upper(a.actuation_type) like '%SANE%' then 'RECTIFICACION_SANEAMIENTO'
       when upper(a.actuation_type) like '%DISOL%' then 'DISOLUCION'
       when upper(a.actuation_type) like '%MIGRA%' then 'MIGRACION'
       when upper(a.actuation_type) like '%PODER%' then 'PODER'
       when upper(a.actuation_type) like '%ACCIONIST%' then 'ACCIONISTAS'
       else 'OTRO' end as actuation_category,
  a.actuation_date,a.registry_date,a.source_record_id,a.source_snapshot_id,a.source_document_id,
  coalesce(d.source_url,a.public_document_url) as public_document_url,d.document_type,d.cve,d.review_status as document_review_status,
  a.evidence_status,a.structured_payload,s.cutoff_date as source_cutoff_date,s.resource_id,a.refreshed_at
from public.aml_res_actuation a
join public.aml_res_entity_bridge b on b.rut=a.rut
left join public.aml_res_source_snapshot s on s.snapshot_id=a.source_snapshot_id
left join public.aml_res_document_evidence d on d.document_id=a.source_document_id;
grant select on public.aml_entity_res_timeline_v0556 to authenticated;

create or replace view public.aml_entity_res_relationship_v0556 with (security_invoker=true) as
select b.entity_id,r.relationship_id,r.company_rut,r.related_entity_id,r.related_rut,r.related_name,r.related_entity_type,r.relationship_type,r.role_label,
  r.ownership_pct,r.shares_count,r.valid_from,r.valid_to,r.relationship_status,r.relationship_basis,r.source_actuation_id,r.source_document_id,
  coalesce(d.source_url,r.source_document_url) as source_document_url,d.document_type,d.cve,d.review_status as document_review_status,
  r.extraction_method,r.confidence,r.requires_review,r.evidence,r.refreshed_at
from public.aml_res_relationship r join public.aml_res_entity_bridge b on b.rut=r.company_rut
left join public.aml_res_document_evidence d on d.document_id=r.source_document_id;
grant select on public.aml_entity_res_relationship_v0556 to authenticated;

create or replace view public.aml_entity_res_evidence_v0556 with (security_invoker=true) as
select b.entity_id,d.document_id,d.company_rut,d.document_type,d.actuation_type,d.actuation_date,d.registry_date,d.document_title,d.source_url,d.source_domain,d.cve,d.document_hash,d.ingestion_method,d.extraction_status,d.review_status,d.notes,d.structured_payload,d.submitted_by,d.submitted_at,d.reviewed_at,d.refreshed_at
from public.aml_res_document_evidence d join public.aml_res_entity_bridge b on b.rut=d.company_rut;
grant select on public.aml_entity_res_evidence_v0556 to authenticated;

-- Lifecycle summary. Exact per-category counters prevent treating OTHER/POWER as constitution.
create or replace view public.aml_entity_res_lifecycle_v0556 with (security_invoker=true) as
with act as (
 select entity_id,count(*)::int actuation_count,
  count(*) filter(where actuation_category='CONSTITUCION')::int constitution_count,
  count(*) filter(where actuation_category='MODIFICACION')::int modification_count,
  count(*) filter(where actuation_category='TRANSFORMACION')::int transformation_count,
  count(*) filter(where actuation_category='FUSION')::int merger_count,
  count(*) filter(where actuation_category='DIVISION')::int division_count,
  count(*) filter(where actuation_category='RECTIFICACION_SANEAMIENTO')::int rectification_count,
  count(*) filter(where actuation_category='DISOLUCION')::int dissolution_count,
  count(*) filter(where actuation_category='MIGRACION')::int migration_count,
  count(*) filter(where actuation_category='PODER')::int power_count,
  count(*) filter(where actuation_category='ACCIONISTAS')::int shareholder_event_count,
  count(*) filter(where actuation_category='OTRO')::int other_actuation_count,
  min(actuation_date) first_actuation_date,max(actuation_date) last_actuation_date,max(actuation_date) filter(where actuation_category<>'CONSTITUCION') last_change_date
 from public.aml_entity_res_timeline_v0556 group by entity_id
), rel as (
 select entity_id,count(*)::int relationship_count,
  count(*) filter(where relationship_status='VIGENTE_CONFIRMADO')::int confirmed_current_relationship_count,
  count(*) filter(where relationship_status='HISTORICO')::int historical_relationship_count,
  count(*) filter(where requires_review)::int review_required_relationship_count,
  count(*) filter(where relationship_type in ('SOCIO_DE','ACCIONISTA_DE','ACCIONISTA_CONSTITUYENTE_DE'))::int ownership_relationship_count,
  count(*) filter(where relationship_type in ('ADMINISTRA','REPRESENTA','DIRECTOR_DE','APODERADO_DE','LIQUIDADOR_DE'))::int governance_relationship_count
 from public.aml_entity_res_relationship_v0556 group by entity_id
), doc as (
 select entity_id,count(*)::int evidence_document_count,count(*) filter(where review_status='REVIEWED')::int reviewed_document_count,max(actuation_date) last_evidence_date
 from public.aml_entity_res_evidence_v0556 group by entity_id
)
select b.entity_id,c.rut,c.legal_name,c.constitution_date,case when c.constitution_date is not null then current_date-c.constitution_date end company_age_days,
 coalesce(act.actuation_count,0) actuation_count,coalesce(act.modification_count,0) modification_count,coalesce(act.transformation_count,0) transformation_count,
 coalesce(act.merger_count,0) merger_count,coalesce(act.division_count,0) division_count,coalesce(act.dissolution_count,0) dissolution_count,
 act.first_actuation_date,act.last_actuation_date,act.last_change_date,case when act.last_change_date is not null then current_date-act.last_change_date end days_since_last_change,
 coalesce(doc.evidence_document_count,0) evidence_document_count,coalesce(doc.reviewed_document_count,0) reviewed_document_count,doc.last_evidence_date,
 coalesce(rel.relationship_count,0) relationship_count,coalesce(rel.confirmed_current_relationship_count,0) confirmed_current_relationship_count,
 coalesce(rel.historical_relationship_count,0) historical_relationship_count,coalesce(rel.review_required_relationship_count,0) review_required_relationship_count,
 coalesce(rel.ownership_relationship_count,0) ownership_relationship_count,coalesce(rel.governance_relationship_count,0) governance_relationship_count,
 case when coalesce(act.dissolution_count,0)>0 then 'DISOLUCION_OBSERVADA'
      when coalesce(act.modification_count,0)+coalesce(act.transformation_count,0)+coalesce(act.merger_count,0)+coalesce(act.division_count,0)+coalesce(act.rectification_count,0)+coalesce(act.migration_count,0)+coalesce(act.power_count,0)+coalesce(act.shareholder_event_count,0)+coalesce(act.other_actuation_count,0)>0 then 'CAMBIOS_POST_CONSTITUCION_OBSERVADOS'
      else 'SOLO_CONSTITUCION_OBSERVADA' end observed_lifecycle_state,
 'La ausencia de una actuación o relación en esta vista no acredita su inexistencia en RES.'::text coverage_note,
 coalesce(act.constitution_count,0) constitution_count,coalesce(act.rectification_count,0) rectification_count,coalesce(act.migration_count,0) migration_count,
 coalesce(act.power_count,0) power_count,coalesce(act.shareholder_event_count,0) shareholder_event_count,coalesce(act.other_actuation_count,0) other_actuation_count
from public.aml_res_company c join public.aml_res_entity_bridge b on b.rut=c.rut
left join act on act.entity_id=b.entity_id left join rel on rel.entity_id=b.entity_id left join doc on doc.entity_id=b.entity_id;
grant select on public.aml_entity_res_lifecycle_v0556 to authenticated;

create or replace view public.aml_entity_res_graph_v0556 with (security_invoker=true) as
select r.entity_id source_entity_id,r.company_rut source_rut,c.legal_name source_name,r.relationship_id,r.related_entity_id target_entity_id,r.related_rut target_rut,r.related_name target_name,r.related_entity_type target_type,r.relationship_type,r.role_label,r.ownership_pct,r.shares_count,r.valid_from,r.valid_to,r.relationship_status,r.confidence,r.requires_review,r.source_document_id,r.source_document_url,r.document_type,r.cve,r.document_review_status
from public.aml_entity_res_relationship_v0556 r left join public.aml_res_company c on c.rut=r.company_rut;
grant select on public.aml_entity_res_graph_v0556 to authenticated;
