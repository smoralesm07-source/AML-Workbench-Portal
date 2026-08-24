-- ATLAS AML 0.46.0 · build 0460 — revisado en 0.50.0
-- Calibración de bandas de score contra la distribución real del corte.
--
-- Nota de historia
-- ----------------
-- Hasta 0.49.0 este archivo se llamaba atlas_v0460_analyst_disposition.sql y
-- definía además la captura de desenlace del analista (aml_disposition y
-- aml_v0460_entity_disposition_current). Esa captura se retiró en 0.50.0 por la
-- misma razón que las colas de validación y descubrimiento: la aplicación no
-- hace gestión de casos. Los DROP correspondientes están en
-- atlas_v0500_drop_analyst_disposition.sql y la definición retirada queda en el
-- historial de git. Aquí sobrevive sólo la vista de calibración, que sigue
-- alimentando el rebandeo de la interfaz.

begin;

-- ---------------------------------------------------------------------------
-- Calibración de bandas contra la distribución real
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
