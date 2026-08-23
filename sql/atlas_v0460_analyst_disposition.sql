-- ATLAS AML 0.46.0 · build 0460
-- Etapa 1 · captura de desenlace del analista y calibración de bandas de score.
--
-- Por qué existe este archivo
-- ---------------------------
-- Hasta 0.45.0 el sistema registraba QUÉ se miró (SESSION_START, OPEN_ENTITY,
-- SEARCH) pero nunca QUÉ se concluyó. Sin desenlace no hay etiqueta, y sin
-- etiqueta el score no se puede calibrar ni defender ante un tercero.
--
-- El backtest de la metodología ya demostró que la sanción administrativa es la
-- etiqueta equivocada para las tipologías estructurales. El juicio del analista
-- es la única etiqueta viable, y sólo se acumula hacia adelante.
--
-- Semántica deliberada
-- --------------------
-- - Una disposición es un juicio analítico trazable. NO es un ROS, NO es una
--   denuncia y NO es una decisión institucional.
-- - El registro es de sólo anexado: no hay UPDATE ni DELETE. Una rectificación
--   se expresa anexando una disposición posterior que supersede a la anterior.
-- - La justificación es obligatoria y tiene largo mínimo: una etiqueta sin
--   razón no sirve para calibrar nada.

begin;

-- ---------------------------------------------------------------------------
-- 1. Registro de desenlaces
-- ---------------------------------------------------------------------------
create table if not exists public.aml_disposition (
  disposition_id     uuid primary key default gen_random_uuid(),
  entity_id          text        not null,
  user_id            uuid        not null default auth.uid(),
  verdict            text        not null,
  rationale          text        not null,
  -- Contexto que el analista tenía a la vista al decidir. Sin esto la etiqueta
  -- no es reproducible: no se sabría contra qué evidencia se emitió el juicio.
  marks_in_view      jsonb       not null default '[]'::jsonb,
  score_at_decision  numeric,
  score_model        text,
  snapshot_id        text,
  release            text,
  created_at         timestamptz not null default now(),

  constraint aml_disposition_verdict_check
    check (verdict in ('RELEVANTE','NO_RELEVANTE','REQUIERE_MAS_INFORMACION')),
  -- La justificación obligatoria es el mecanismo que convierte un clic en una
  -- etiqueta utilizable. 20 caracteres descarta "ok" y "revisado".
  constraint aml_disposition_rationale_check
    check (char_length(btrim(rationale)) >= 20)
);

comment on table public.aml_disposition is
  'Desenlace analítico del triage. Juicio trazable del analista, de sólo anexado. No es ROS, no es denuncia, no es decisión institucional.';
comment on column public.aml_disposition.marks_in_view is
  'Marcas y hallazgos visibles al momento de decidir. Hace reproducible la etiqueta.';
comment on column public.aml_disposition.score_at_decision is
  'Score mostrado al analista en ese corte. Permite medir precisión del modelo a posteriori.';

create index if not exists aml_disposition_entity_created_idx
  on public.aml_disposition (entity_id, created_at desc);
create index if not exists aml_disposition_user_created_idx
  on public.aml_disposition (user_id, created_at desc);
create index if not exists aml_disposition_verdict_idx
  on public.aml_disposition (verdict);

alter table public.aml_disposition enable row level security;

-- Lectura: cualquier analista habilitado ve todos los desenlaces. El triage es
-- un registro compartido; ocultarlo entre analistas produciría trabajo duplicado.
drop policy if exists aml_disposition_allowed_read on public.aml_disposition;
create policy aml_disposition_allowed_read
  on public.aml_disposition for select
  using (exists (select 1 from public.aml_allowed_users au
                 where au.user_id = (select auth.uid()) and au.enabled));

-- Escritura: sólo a nombre propio y sólo si está habilitado.
drop policy if exists aml_disposition_self_insert on public.aml_disposition;
create policy aml_disposition_self_insert
  on public.aml_disposition for insert
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.aml_allowed_users au
                          where au.user_id = (select auth.uid()) and au.enabled));

-- Sin políticas de UPDATE ni DELETE: el registro es inmutable por diseño.

-- ---------------------------------------------------------------------------
-- 2. Vista de estado vigente por entidad
-- ---------------------------------------------------------------------------
create or replace view public.aml_v0460_entity_disposition_current
with (security_invoker = true) as
select distinct on (entity_id)
  entity_id, disposition_id, user_id, verdict, rationale,
  score_at_decision, snapshot_id, created_at
from public.aml_disposition
order by entity_id, created_at desc;

comment on view public.aml_v0460_entity_disposition_current is
  'Última disposición vigente por entidad. Las anteriores se conservan en aml_disposition.';

-- ---------------------------------------------------------------------------
-- 3. Calibración de bandas contra la distribución real
-- ---------------------------------------------------------------------------
-- El umbral absoluto >=75 nunca se alcanza: el máximo observado de
-- score_investigate es 69,2. La banda superior es código muerto y el 97% de los
-- hallazgos se pinta en el mismo color, de modo que el color no informa nada.
--
-- Se reemplaza por corte por percentil del corte vigente. Robusto a que la
-- escala del score cambie más adelante.
--
-- IMPORTANTE: la banda expresa POSICIÓN RELATIVA en la cola de prioridad del
-- corte, no probabilidad de LA/FT ni gravedad. "Decil superior" es una
-- afirmación sobre el orden, no sobre el riesgo.
create or replace view public.aml_v0460_score_calibration
with (security_invoker = true) as
with findings as (
  select score_investigate::numeric s
  from public.aml_findings
  where score_investigate is not null
),
-- En IPA3 el 96,7% de las entidades puntúa exactamente 0. Ese 0 significa
-- "ninguna marca se activó", no "riesgo bajo". Calcular percentiles sobre el
-- universo completo devolvería p70=p90=0 y sería inútil. Se calibra sólo sobre
-- la población con marcas materializadas; el resto se muestra como "—",
-- respetando la regla missing != zero.
ipa3 as (
  select ipa3_score::numeric s
  from public.aml_ipa3_entity_score_snapshot_v0_4
  where ipa3_score is not null and ipa3_score > 0
)
select
  'aml_findings.score_investigate'::text            as metric,
  count(*)                                          as n_scored,
  round(percentile_cont(0.70) within group (order by s)::numeric, 2) as p70,
  round(percentile_cont(0.90) within group (order by s)::numeric, 2) as p90,
  round(percentile_cont(0.99) within group (order by s)::numeric, 2) as p99,
  round(min(s), 2) as min_observed,
  round(max(s), 2) as max_observed,
  round(avg(s), 2) as mean_observed,
  round(stddev(s), 2) as sd_observed
from findings
union all
select
  'aml_ipa3.ipa3_score_nonzero'::text,
  count(*),
  round(percentile_cont(0.70) within group (order by s)::numeric, 2),
  round(percentile_cont(0.90) within group (order by s)::numeric, 2),
  round(percentile_cont(0.99) within group (order by s)::numeric, 2),
  round(min(s), 2), round(max(s), 2), round(avg(s), 2), round(stddev(s), 2)
from ipa3;

comment on view public.aml_v0460_score_calibration is
  'Cortes por percentil del corte vigente para las bandas de la interfaz. Banda = posición relativa en la cola, no probabilidad de LA/FT. IPA3 se calibra sólo sobre puntajes > 0 porque el 0 significa ausencia de marcas, no riesgo bajo.';

commit;
