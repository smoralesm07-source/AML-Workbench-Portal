-- ATLAS AML 0.48.0 · build 0480 · separación de la cola de descubrimiento y el contexto.
--
-- El problema
-- -----------
-- De 28.937 hallazgos, 27.829 (96%) son ENTITY_CONVERGENCE y CONTEXTUAL_ANOMALY.
-- Los guardrails del propio sistema dicen que esos dos NO son riesgo:
--   «convergencia = visibilidad, no riesgo»
--   «anomalía contextual ≠ señal AML»
-- La cola de trabajo estaba compuesta casi enteramente por artefactos de
-- visibilidad, de modo que no era recorrible ni significativa.
--
-- La solución
-- -----------
-- No se borra ni se oculta nada. Se hace EXPLÍCITO en datos el rol que cada tipo
-- ya tenía en la prosa metodológica, y la cola filtra por rol. El catálogo es una
-- tabla editable y auditable, no lógica enterrada en una vista: cambiar la
-- doctrina es un UPDATE, no un redespliegue.
--
-- Resultado al 23-08-2026:
--   VISIBILITY      27.829 hallazgos · 8.943 entidades · fuera de la cola
--   SECTOR_CONTEXT     906 hallazgos · sin entity_id
--   KNOWN_CONTEXT      166 hallazgos ·    97 entidades
--   SOURCE_CONTEXT      31 hallazgos ·     6 entidades
--   DISCOVERY            5 hallazgos ·     5 entidades
--
--   Cola resultante: 17 entidades en tier DISCOVERY, 104 en KNOWN_CONTEXT.
--
-- Que la cola de descubrimiento sea de 17 entidades es el resultado honesto, no
-- un filtro mal calibrado: el sistema produce pocas señales de descubrimiento
-- porque le faltan las fuentes que las generan (listas designadas, PEP,
-- beneficiario final).

begin;

create table if not exists public.aml_finding_role (
  finding_type       text primary key,
  role               text        not null,
  in_discovery_queue boolean     not null,
  rationale          text        not null,
  updated_at         timestamptz not null default now(),
  constraint aml_finding_role_check
    check (role in ('DISCOVERY','KNOWN_CONTEXT','VISIBILITY','SECTOR_CONTEXT','SOURCE_CONTEXT'))
);

comment on table public.aml_finding_role is
  'Catálogo gobernado del rol analítico de cada tipo de hallazgo. DISCOVERY entra a la cola; el resto es contexto. Editable: cambiar la doctrina es un UPDATE.';

insert into public.aml_finding_role (finding_type, role, in_discovery_queue, rationale) values
  ('GOVERNED_AML_SIGNAL','DISCOVERY',true,
   'Única señal AML canónica del catálogo. Es descubrimiento por definición.'),
  ('PRUDENTIAL_SANCTION','KNOWN_CONTEXT',false,
   'Sanción administrativa no es LA/FT. El backtest demostró que la recurrencia sancionatoria es autocorrelación de atención supervisora, no descubrimiento: precisión@10 cae a 0% sin ella porque el modelo sólo redescubre entidades muy supervisadas.'),
  ('ENTITY_CONVERGENCE','VISIBILITY',false,
   'Convergencia describe que la entidad es visible en varias fuentes, no que sea riesgosa. Guardrail declarado: convergencia = visibilidad, no riesgo.'),
  ('CONTEXTUAL_ANOMALY','VISIBILITY',false,
   'Guardrail declarado: anomalía contextual != señal AML. Útil como contexto del dossier, no como cabeza de cola.'),
  ('PRESS_ENTITY_CONVERGENCE','SOURCE_CONTEXT',false,
   'Radar Prensa es evidencia secundaria. Recurrencia mediática no prueba hechos ni atribuye conducta.'),
  ('PRESS_TERRITORIAL_CONVERGENCE','SECTOR_CONTEXT',false,
   'Grano territorial, sin entity_id. Contexto delictual territorial no atribuye conducta a una entidad.'),
  ('SUPERVISORY_GAP','SECTOR_CONTEXT',false,
   'Grano sectorial, sin entity_id. Brecha supervisiva no es incumplimiento individual.')
on conflict (finding_type) do nothing;

alter table public.aml_finding_role enable row level security;

drop policy if exists aml_finding_role_allowed_read on public.aml_finding_role;
create policy aml_finding_role_allowed_read
  on public.aml_finding_role for select
  using (exists (select 1 from public.aml_allowed_users au
                 where au.user_id = (select auth.uid()) and au.enabled));

-- Hallazgos con su rol. Un tipo que aún no esté en el catálogo queda como
-- UNCLASSIFIED y fuera de la cola: un tipo nuevo nunca entra por defecto.
create or replace view public.aml_v0480_finding_classified
with (security_invoker = true) as
select
  f.finding_key, f.finding_id, f.finding_type, f.entity_id, f.title,
  f.region, f.commune, f.score_explore, f.score_supervise, f.score_investigate,
  f.source_count, f.evidence_count, f.snapshot_id, f.updated_at,
  coalesce(r.role,'UNCLASSIFIED')      as analytical_role,
  coalesce(r.in_discovery_queue,false) as in_discovery_queue,
  r.rationale                          as role_rationale
from public.aml_findings f
left join public.aml_finding_role r on r.finding_type = f.finding_type;

-- Cola de descubrimiento, grano ENTIDAD.
--   DISCOVERY      entra por mérito propio: señal AML gobernada o patrón
--                  estructural de entidad (hub topológico).
--   KNOWN_CONTEXT  riesgo real pero ya conocido y autocorrelacionado con la
--                  atención supervisora. Se muestra aparte, nunca arriba.
create or replace view public.aml_v0480_discovery_queue
with (security_invoker = true) as
with governed as (
  select entity_id, count(*) n, max(score_investigate) top_score
  from public.aml_v0480_finding_classified
  where in_discovery_queue and entity_id is not null group by entity_id
),
structural as (
  select scope_id as entity_id, count(*) n, max(strength) top_strength
  from public.aml_pattern_alerts
  where scope_type='ENTITY' and pattern_type='HUB_TOPOLOGICO' group by scope_id
),
recurrence as (
  select scope_id as entity_id, count(*) n, max(strength) top_strength
  from public.aml_pattern_alerts
  where scope_type='ENTITY' and pattern_type='RECURRENCIA_SANCIONATORIA' group by scope_id
),
prudential as (
  select entity_id, count(*) n from public.aml_v0480_finding_classified
  where analytical_role='KNOWN_CONTEXT' and entity_id is not null group by entity_id
),
visibility as (
  select entity_id, count(*) n from public.aml_v0480_finding_classified
  where analytical_role='VISIBILITY' and entity_id is not null group by entity_id
),
universe as (
  select entity_id from governed
  union select entity_id from structural
  union select entity_id from recurrence
  union select entity_id from prudential
)
select
  u.entity_id, e.name, e.rut, e.region, e.entity_type,
  e.is_uaf_observed, e.is_sanctioned, e.source_count,
  case when g.entity_id is not null or s.entity_id is not null
       then 'DISCOVERY' else 'KNOWN_CONTEXT' end as tier,
  coalesce(g.n,0) as governed_signals,             g.top_score      as governed_top_score,
  coalesce(s.n,0) as structural_patterns,          s.top_strength   as structural_top_strength,
  coalesce(r.n,0) as sanction_recurrence_patterns,
  coalesce(p.n,0) as prudential_findings,
  coalesce(v.n,0) as visibility_findings,
  d.verdict       as disposition_verdict,
  d.created_at    as disposition_at,
  (d.verdict is null) as pending
from universe u
left join public.aml_entities e on e.entity_id = u.entity_id
left join governed   g on g.entity_id = u.entity_id
left join structural s on s.entity_id = u.entity_id
left join recurrence r on r.entity_id = u.entity_id
left join prudential p on p.entity_id = u.entity_id
left join visibility v on v.entity_id = u.entity_id
left join public.aml_v0460_entity_disposition_current d on d.entity_id = u.entity_id;

comment on view public.aml_v0480_discovery_queue is
  'Cola de descubrimiento a grano entidad. Tier DISCOVERY entra por señal AML gobernada o patrón estructural; KNOWN_CONTEXT es riesgo conocido y autocorrelacionado con atención supervisora. Los artefactos de visibilidad no entran a la cola pero siguen en el dossier.';

commit;
