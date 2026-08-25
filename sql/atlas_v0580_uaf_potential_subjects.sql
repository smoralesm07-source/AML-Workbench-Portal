-- ATLAS AML · build 0580
-- Universo SO: potenciales sujetos obligados y su gestión fiscalizadora.
--
-- Por qué existe este archivo
-- ---------------------------
-- 0560 caracterizó a los 9.782 sujetos obligados inscritos. Queda la pregunta
-- inversa, que es la que abre trabajo de campo: qué entidades conoce Atlas que
-- se comportan como sujetos obligados y no aparecen en el corte público del
-- padrón UAF.
--
-- El portal ya declara un guardarraíl para esto y este archivo lo respeta al
-- pie: "no observado en el corte público UAF ≠ no inscrito / no obligado". El
-- padrón que tenemos es una publicación, no el registro vivo de la UAF. Por eso
-- nada de lo que sigue afirma que una entidad esté incumpliendo: afirma que hay
-- evidencia suficiente para que un fiscalizador la mire y decida.
--
-- Cómo se detecta, sin taxonomías hechas a mano
-- ---------------------------------------------
-- No se escribe una tabla de correspondencias entre giro económico y sector
-- obligado: sería frágil y no gobernada. Se deriva de los propios inscritos.
-- Si el 88% de las entidades que declaran "COMPRA, VENTA Y ALQUILER DE
-- INMUEBLES" están inscritas como gestión inmobiliaria, ese giro es
-- característico de ese sector, y las que lo declaran sin figurar en el padrón
-- son candidatas. La concentración observada es a la vez el criterio y la
-- evidencia que se muestra en pantalla.
--
-- Tres clases de evidencia, de más a menos concluyente
-- ---------------------------------------------------
--   1. La UAF sancionó a la entidad y no aparece en el corte del padrón. La
--      propia autoridad la trató como sujeto obligado. 10 casos en el corte.
--   2. Su giro principal SII es característico de un sector obligado. 194 casos.
--   3. Alguno de sus giros secundarios lo es. 875 casos, señal más débil.
--
-- Dos índices separados a propósito
-- ---------------------------------
-- Mezclar "qué tan plausible es que deba estar inscrito" con "cuánto pesa
-- incorporarlo" en un solo número las vuelve indistinguibles. Se declaran por
-- separado:
--   IVO  Verosimilitud de obligación   ¿debería estar inscrito?
--   MAT  Materialidad de incorporación  si lo está, ¿cuánto pesa traerlo?
-- El cruce de ambos es lo que ordena el trabajo de campo.
--
-- Gestión
-- -------
-- aml_uaf_potential_review es de sólo anexado, con la misma disciplina de
-- aml_disposition: un fiscalizador anexa su lectura, nadie edita ni borra la de
-- otro, y el estado vigente de una candidata es simplemente su última anotación.
-- Así Atlas recuerda qué potenciales ya fueron vistos y por quién.

begin;

-- ---------------------------------------------------------------------------
-- 1. Perfil de actividad característica por sector obligado
-- ---------------------------------------------------------------------------
create table if not exists public.aml_uaf_sector_activity_profile (
  activity_name        text primary key,
  uaf_sector_canonical text    not null,
  registered_count     integer not null,
  universe_count       integer not null,
  concentration        numeric not null,
  sector_total         integer,
  sector_support       numeric,
  sector_activity_coherence numeric,
  refreshed_at         timestamptz not null default now()
);

comment on table public.aml_uaf_sector_activity_profile is
  'Giros económicos característicos de cada sector obligado, derivados de la concentración observada entre los inscritos. No es una tabla normativa de correspondencias: es una medición del padrón vigente.';

-- ---------------------------------------------------------------------------
-- 2. Potenciales sujetos obligados
-- ---------------------------------------------------------------------------
create table if not exists public.aml_uaf_potential_subject_snapshot (
  rut                    text primary key,
  entity_id              text,
  entity_name            text,
  entity_type            text,
  subject_nature         text,
  is_actionable          boolean,
  actionability_basis    text,
  type_share_in_sector   numeric,

  implied_sector         text,
  evidence_class         text    not null,
  matched_activity       text,
  activity_concentration numeric,
  activity_registered_n  integer,
  activity_universe_n    integer,

  uaf_sanction_events    integer not null default 0,
  uaf_sanction_last_date date,
  uaf_sanction_refs      text[],

  region                 text,
  commune                text,
  sii_status             text,
  sii_main_activity      text,
  sii_activity_names     text,
  sii_sales_band         text,
  sii_sales_band_rank    integer,
  sii_workers            bigint,
  sii_activity_start_date date,
  sii_termination_date   date,
  ownership_edge_count   integer,
  legal_entity_partner_count integer,
  societies_as_partner_count integer,
  source_count           integer,
  ipa3_score             numeric,
  ipa3_band              text,

  ivo_regulatory_evidence numeric,
  ivo_activity_match      numeric,
  ivo_operational_status  numeric,
  ivo_score               numeric,
  ivo_band                text,
  ivo_credibility_pct     numeric,
  ivo_components          jsonb,

  materiality_score       numeric,
  materiality_components  jsonb,

  flags                   text[],
  index_version           text not null default 'IVO-1.0',
  semantics               text not null default 'REGISTRATION_HYPOTHESIS_NOT_PROVEN_NON_COMPLIANCE',
  refreshed_at            timestamptz not null default now()
);

comment on column public.aml_uaf_sector_activity_profile.sector_support is
  'Proporción de los inscritos del sector que declaran este giro. Sin esta prueba, un sector definido por condición territorial —como Usuarios de Zonas Francas— presta su alta precisión a decenas de giros del comercio local que no lo caracterizan.';
comment on column public.aml_uaf_sector_activity_profile.sector_activity_coherence is
  'Cuota del giro dominante entre los inscritos del sector. Mide si el sector está definido por su actividad económica. Usuarios de Zonas Francas declara 197 giros distintos y su dominante cubre 25,8%: es una condición territorial y operativa, no una actividad, de modo que ningún giro suyo permite inferir obligación.';

comment on table public.aml_uaf_potential_subject_snapshot is
  'Entidades que Atlas observa con comportamiento de sujeto obligado y que no figuran en el corte público del padrón UAF. Es una hipótesis de inscripción para fiscalizar, no una afirmación de incumplimiento: ausencia del corte público no equivale a no inscrito ni a no obligado.';

comment on column public.aml_uaf_potential_subject_snapshot.is_actionable is
  'Si la entidad es incorporable hoy. Una con término de giro publicado puede ser plausiblemente un sujeto obligado —un banco lo es— y aun así no ser candidata a inscripción. Verosimilitud y accionabilidad se declaran por separado.';
comment on column public.aml_uaf_potential_subject_snapshot.type_share_in_sector is
  'Cuota que el tipo de entidad de esta candidata representa entre los inscritos del sector implicado. Un obispado o un sindicato declara el mismo giro inmobiliario que una inmobiliaria y sólo el tipo los separa: las OSFL son el 0,13% de ese sector.';

create index if not exists aml_uaf_potential_ivo_idx
  on public.aml_uaf_potential_subject_snapshot (ivo_score desc nulls last);
create index if not exists aml_uaf_potential_sector_idx
  on public.aml_uaf_potential_subject_snapshot (implied_sector, ivo_score desc nulls last);
create index if not exists aml_uaf_potential_region_idx
  on public.aml_uaf_potential_subject_snapshot (region);
create index if not exists aml_uaf_potential_class_idx
  on public.aml_uaf_potential_subject_snapshot (evidence_class);
create index if not exists aml_uaf_potential_actionable_idx
  on public.aml_uaf_potential_subject_snapshot (is_actionable, ivo_score desc nulls last);
create index if not exists aml_uaf_potential_name_trgm_idx
  on public.aml_uaf_potential_subject_snapshot using gin (entity_name extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- 3. Gestión fiscalizadora · sólo anexado
-- ---------------------------------------------------------------------------
create table if not exists public.aml_uaf_potential_review (
  review_id        uuid primary key default gen_random_uuid(),
  rut              text not null,
  entity_id        text,
  user_id          uuid not null default auth.uid(),
  review_state     text not null
    check (review_state in ('REVISADO','SELECCIONADO_PARA_INSCRIPCION','DESCARTADO')),
  reason_code      text
    check (reason_code is null or reason_code in
      ('YA_INSCRITO_EN_REGISTRO_VIGENTE','NO_ES_SUJETO_OBLIGADO','SIN_OPERACION_VIGENTE',
       'FUERA_DE_COMPETENCIA','EVIDENCIA_INSUFICIENTE','OTRO')),
  rationale        text,
  ivo_at_decision  numeric,
  materiality_at_decision numeric,
  sector_at_decision text,
  evidence_class_at_decision text,
  index_version    text,
  release          text,
  created_at       timestamptz not null default now(),
  -- Un descarte sin motivo no es trazable: el juicio tiene que poder auditarse.
  constraint aml_uaf_potential_review_descarte_motivado
    check (review_state <> 'DESCARTADO' or (reason_code is not null and length(coalesce(rationale,'')) >= 3))
);

comment on table public.aml_uaf_potential_review is
  'Lectura fiscalizadora sobre una potencial inscripción. Sólo anexado: nadie edita ni borra la anotación de otro, y el estado vigente de una candidata es su última anotación. No es una decisión institucional, no es un requerimiento de inscripción y no es un ROS.';

create index if not exists aml_uaf_potential_review_rut_idx
  on public.aml_uaf_potential_review (rut, created_at desc);
create index if not exists aml_uaf_potential_review_user_idx
  on public.aml_uaf_potential_review (user_id, created_at desc);
create index if not exists aml_uaf_potential_review_state_idx
  on public.aml_uaf_potential_review (review_state);

-- ---------------------------------------------------------------------------
-- 4. Estado vigente de cada candidata
-- ---------------------------------------------------------------------------
create or replace view public.aml_v_uaf_potential_current as
select p.*,
       coalesce(r.review_state, 'PENDIENTE') as review_state,
       r.reason_code       as review_reason_code,
       r.rationale         as review_rationale,
       r.created_at        as reviewed_at,
       r.user_id           as reviewed_by_user_id,
       au.email            as reviewed_by_email,
       coalesce(c.review_count, 0)     as review_count,
       coalesce(c.reviewer_count, 0)   as reviewer_count
from public.aml_uaf_potential_subject_snapshot p
left join lateral (
  select rr.review_state, rr.reason_code, rr.rationale, rr.created_at, rr.user_id
  from public.aml_uaf_potential_review rr
  where rr.rut = p.rut
  order by rr.created_at desc
  limit 1
) r on true
left join lateral (
  select count(*)::integer as review_count,
         count(distinct rr.user_id)::integer as reviewer_count
  from public.aml_uaf_potential_review rr
  where rr.rut = p.rut
) c on true
left join public.aml_allowed_users au on au.user_id = r.user_id;

comment on view public.aml_v_uaf_potential_current is
  'Cada potencial sujeto obligado con su última lectura fiscalizadora. PENDIENTE significa que ningún fiscalizador la ha mirado todavía en este corte.';

-- ---------------------------------------------------------------------------
-- 5. Autorización
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'aml_uaf_sector_activity_profile',
    'aml_uaf_potential_subject_snapshot'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('drop policy if exists %I on public.%I', t||'_allowed_read', t);
    execute format($p$create policy %I on public.%I for select
      using (exists (select 1 from public.aml_allowed_users au
                     where au.user_id = (select auth.uid()) and au.enabled))$p$, t||'_allowed_read', t);
  end loop;
end $$;

-- La tabla de gestión es la primera superficie de escritura de esta sección.
-- Sólo anexado, y de forma estructural: el privilegio de update y delete se
-- revoca, de modo que no dependa únicamente de que exista o no una política.
alter table public.aml_uaf_potential_review enable row level security;
revoke all on public.aml_uaf_potential_review from anon;
revoke update, delete on public.aml_uaf_potential_review from authenticated;
grant select, insert on public.aml_uaf_potential_review to authenticated;

drop policy if exists aml_uaf_potential_review_allowed_read on public.aml_uaf_potential_review;
create policy aml_uaf_potential_review_allowed_read
  on public.aml_uaf_potential_review for select
  using (exists (select 1 from public.aml_allowed_users au
                 where au.user_id = (select auth.uid()) and au.enabled));

-- Un fiscalizador sólo puede anexar bajo su propia identidad.
drop policy if exists aml_uaf_potential_review_self_insert on public.aml_uaf_potential_review;
create policy aml_uaf_potential_review_self_insert
  on public.aml_uaf_potential_review for insert
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.aml_allowed_users au
                          where au.user_id = (select auth.uid()) and au.enabled));

commit;

-- ---------------------------------------------------------------------------
-- 6. Cómputo de candidatas
-- ---------------------------------------------------------------------------
-- La calibración de esta función fue el trabajo real de este build, y las tres
-- pruebas que impone existen porque las tres fallaron primero en los datos:
--
--   Coherencia de actividad del sector (>= 0,35). Usuarios de Zonas Francas
--   agrupa 2.840 inscritos con 197 giros distintos y un dominante que cubre
--   25,8%: es una condición territorial, no una actividad. Sin esta prueba
--   prestaba su precisión a giros del comercio de Iquique y proponía sindicatos
--   de taxis colectivos como potenciales sujetos obligados.
--
--   Soporte del giro dentro del sector (>= 0,05). Un giro puede tener 100% de
--   precisión y explicar el 0,4% del sector: eso es ruido, no característica.
--
--   Coherencia de tipo de entidad (>= 0,05). Un obispado que posee inmuebles
--   declara el mismo giro que una inmobiliaria. Las OSFL son el 0,13% del sector
--   de gestión inmobiliaria, y sin esta prueba el listado se llenaba de
--   congregaciones, sindicatos y corporaciones municipales.
--
-- Las tres son mediciones del propio padrón, no criterios escritos a mano.
create or replace function public.refresh_aml_uaf_potential_subjects_0580()
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare acts integer; cands integer;
begin
  delete from public.aml_uaf_sector_activity_profile;

  insert into public.aml_uaf_sector_activity_profile
    (activity_name, uaf_sector_canonical, registered_count, universe_count, concentration,
     sector_total, sector_support, sector_activity_coherence, refreshed_at)
  with base as (
    select main_activity act, count(*)::integer n_universo
    from public.aml_entity_tax_profile
    where main_activity is not null
    group by 1
  ),
  pares as (
    select s.sii_main_activity act, s.uaf_sector_canonical sector, count(*)::integer n_so
    from public.aml_uaf_obligated_subject_snapshot s
    where s.sii_main_activity is not null
    group by 1, 2
  ),
  coherencia as (
    select sector,
           round(max(n_so)::numeric / sum(n_so), 4) as cuota_dominante
    from pares
    group by sector
  )
  select distinct on (p.act)
         p.act, p.sector, p.n_so, b.n_universo,
         round(p.n_so::numeric / b.n_universo, 4),
         st.subject_count,
         round(p.n_so::numeric / st.subject_count, 4),
         co.cuota_dominante,
         now()
  from pares p
  join base b on b.act = p.act
  join public.aml_uaf_obligated_sector_snapshot st
       on st.uaf_sector_canonical = p.sector
  join coherencia co on co.sector = p.sector
  where co.cuota_dominante >= 0.35
    and p.n_so >= 10
    and p.n_so::numeric / b.n_universo >= 0.35
    and p.n_so::numeric / st.subject_count >= 0.05
  order by p.act, p.n_so desc;

  get diagnostics acts = row_count;

  create temporary table tmp_fuera_padron on commit drop as
  select e.entity_id, e.rut, e.name, e.entity_type, e.region, e.commune, e.source_count,
         public.aml_entity_resolution_key_v1(e.name) as match_key
  from public.aml_entities e
  where not exists (
    select 1 from public.aml_uaf_obligated_subject_snapshot o where o.rut = e.rut)
    and coalesce(e.entity_type, '') <> 'Organismo público';

  create index on tmp_fuera_padron (match_key);
  create index on tmp_fuera_padron (entity_id);
  create unique index on tmp_fuera_padron (rut);
  analyze tmp_fuera_padron;

  create temporary table tmp_sancionadas on commit drop as
  with clave as (
    select l.sanction_id, l.event_date, l.resolution_ref,
           public.aml_entity_resolution_key_v1(l.source_entity_name) as match_key
    from public.aml_uaf_sanction_subject_link_snapshot l
    where l.resolution_status = 'SIN_CANDIDATO_EN_PADRON'
  ),
  unicas as (
    select c.sanction_id, c.event_date, c.resolution_ref, f.rut
    from clave c
    join tmp_fuera_padron f on f.match_key = c.match_key
    where c.match_key is not null
      and (select count(*) from tmp_fuera_padron ff where ff.match_key = c.match_key) = 1
  )
  select rut,
         count(*)::integer as eventos,
         max(event_date) as ultimo,
         array_remove(array_agg(distinct resolution_ref), null) as refs
  from unicas
  group by rut;

  create unique index on tmp_sancionadas (rut);
  analyze tmp_sancionadas;

  delete from public.aml_uaf_potential_subject_snapshot;

  insert into public.aml_uaf_potential_subject_snapshot (
    rut, entity_id, entity_name, entity_type, subject_nature, is_actionable, actionability_basis,
    type_share_in_sector,
    implied_sector, evidence_class, matched_activity, activity_concentration,
    activity_registered_n, activity_universe_n,
    uaf_sanction_events, uaf_sanction_last_date, uaf_sanction_refs,
    region, commune, sii_status, sii_main_activity, sii_activity_names,
    sii_sales_band, sii_sales_band_rank, sii_workers, sii_activity_start_date,
    sii_termination_date, ownership_edge_count, legal_entity_partner_count,
    societies_as_partner_count, source_count, ipa3_score, ipa3_band,
    ivo_regulatory_evidence, ivo_activity_match, ivo_operational_status,
    ivo_score, ivo_band, ivo_credibility_pct, ivo_components,
    materiality_score, materiality_components, flags,
    index_version, semantics, refreshed_at
  )
  with tipo_sector as (
    select o.uaf_sector_canonical sector,
           coalesce(e.entity_type, '(sin tipo)') tipo,
           round(count(*)::numeric
                 / sum(count(*)) over (partition by o.uaf_sector_canonical), 4) cuota
    from public.aml_uaf_obligated_subject_snapshot o
    join public.aml_entities e on e.rut = o.rut
    group by o.uaf_sector_canonical, coalesce(e.entity_type, '(sin tipo)')
  ),
  giro_principal as (
    select f.rut, a.uaf_sector_canonical sector, a.activity_name act,
           a.concentration conc, a.registered_count reg_n, a.universe_count uni_n
    from tmp_fuera_padron f
    join public.aml_entity_tax_profile t on t.entity_id = f.entity_id
    join public.aml_uaf_sector_activity_profile a on a.activity_name = t.main_activity
    join tipo_sector ts on ts.sector = a.uaf_sector_canonical
                       and ts.tipo = coalesce(f.entity_type, '(sin tipo)')
                       and ts.cuota >= 0.05
  ),
  giro_secundario as (
    select distinct on (f.rut) f.rut, a.uaf_sector_canonical sector, a.activity_name act,
           a.concentration conc, a.registered_count reg_n, a.universe_count uni_n
    from tmp_fuera_padron f
    join public.aml_entity_tax_profile t on t.entity_id = f.entity_id
    cross join lateral unnest(string_to_array(coalesce(t.activity_names, ''), ' | ')) s(nombre)
    join public.aml_uaf_sector_activity_profile a on a.activity_name = trim(s.nombre)
    join tipo_sector ts on ts.sector = a.uaf_sector_canonical
                       and ts.tipo = coalesce(f.entity_type, '(sin tipo)')
                       and ts.cuota >= 0.05
    where t.main_activity is distinct from trim(s.nombre)
      and not exists (select 1 from giro_principal g where g.rut = f.rut)
    order by f.rut, a.concentration desc
  ),
  union_candidatas as (
    select rut, sector, act, conc, reg_n, uni_n, 'GIRO_PRINCIPAL_CARACTERISTICO' clase from giro_principal
    union all
    select rut, sector, act, conc, reg_n, uni_n, 'GIRO_SECUNDARIO_CARACTERISTICO' from giro_secundario
    union all
    select s.rut, null, null, null, null, null, 'SANCION_UAF_SIN_INSCRIPCION' from tmp_sancionadas s
  ),
  consolidadas as (
    select rut,
           min(case clase when 'SANCION_UAF_SIN_INSCRIPCION' then 1
                          when 'GIRO_PRINCIPAL_CARACTERISTICO' then 2 else 3 end) as rango,
           max(sector) filter (where sector is not null) as sector,
           max(act) filter (where act is not null) as act,
           max(conc) as conc,
           max(reg_n) as reg_n,
           max(uni_n) as uni_n,
           bool_or(clase = 'GIRO_PRINCIPAL_CARACTERISTICO') as por_principal
    from union_candidatas
    group by rut
  ),
  enriquecidas as (
    select c.rut,
           (select ts.cuota from tipo_sector ts
             where ts.sector = c.sector
               and ts.tipo = coalesce(f.entity_type, '(sin tipo)')) as tipo_cuota,
           case c.rango when 1 then 'SANCION_UAF_SIN_INSCRIPCION'
                        when 2 then 'GIRO_PRINCIPAL_CARACTERISTICO'
                        else 'GIRO_SECUNDARIO_CARACTERISTICO' end as evidence_class,
           c.sector, c.act, c.conc, c.reg_n, c.uni_n, coalesce(c.por_principal, false) as por_principal,
           f.entity_id, f.name, f.entity_type, f.region, f.commune, f.source_count,
           case when f.rut ~ '^[0-9]'
                 and (regexp_replace(split_part(f.rut, '-', 1), '[^0-9]', '', 'g'))::bigint < 50000000
                then 'PERSONA_NATURAL' else 'PERSONA_JURIDICA' end as subject_nature,
           coalesce(s.eventos, 0) as eventos, s.ultimo, s.refs,
           case when t.entity_id is null then 'SIN_PERFIL_SII'
                when t.current_status = 'TERMINATED_AS_PUBLISHED' then 'TERMINATED_AS_PUBLISHED'
                else coalesce(t.current_status, 'ACTIVE_AS_PUBLISHED') end as sii_status,
           t.main_activity, t.activity_names, t.sales_band, t.sales_band_rank,
           t.workers_numeric, t.activity_start_date, t.termination_date,
           t.ownership_edge_count, t.legal_entity_partner_count, t.societies_as_partner_count,
           i.ipa3_score, i.priority_band_shadow as ipa3_band
    from consolidadas c
    join tmp_fuera_padron f on f.rut = c.rut
    left join public.aml_entity_tax_profile t on t.entity_id = f.entity_id
    left join tmp_sancionadas s on s.rut = c.rut
    left join public.aml_ipa3_entity_score_snapshot_v0_4 i on i.entity_id = f.entity_id
  ),
  puntuadas as (
    select en.*,
           case when en.eventos > 0 then 100::numeric else 0::numeric end as c_evr,
           case when en.conc is null then null
                else round(en.conc * 100 * (case when en.por_principal then 1.0 else 0.55 end), 2)
           end as c_cga,
           case when en.sii_status = 'SIN_PERFIL_SII' then null
                when en.sii_status = 'TERMINATED_AS_PUBLISHED' then 0::numeric
                else 100::numeric end as c_vig,
           case when en.sii_status = 'SIN_PERFIL_SII' then null else
             round(least(100,
                 case when en.sales_band_rank is not null
                      then 45 * (en.sales_band_rank - 1)::numeric / 12.0 else 0 end
               + case when coalesce(en.workers_numeric, 0) > 0
                      then least(25, 25 * ln((1 + en.workers_numeric)::numeric) / ln(3001::numeric)) else 0 end
               + least(20, coalesce(en.ownership_edge_count, 0)::numeric
                         + coalesce(en.legal_entity_partner_count, 0)::numeric * 2
                         + coalesce(en.societies_as_partner_count, 0)::numeric * 2)
               + least(10, coalesce(en.source_count, 0)::numeric * 2.5)
             ), 2) end as materialidad
    from enriquecidas en
  ),
  ponderadas as (
    select p.*,
           (case when p.c_evr is not null then 40 else 0 end
          + case when p.c_cga is not null then 45 else 0 end
          + case when p.c_vig is not null then 15 else 0 end)::numeric as peso_disponible,
           (coalesce(p.c_evr, 0) * 40
          + coalesce(p.c_cga, 0) * 45
          + coalesce(p.c_vig, 0) * 15)::numeric as suma_ponderada
    from puntuadas p
  ),
  final as (
    select w.*,
           case when w.peso_disponible > 0
                then round(w.suma_ponderada / w.peso_disponible, 2) end as ivo
    from ponderadas w
  )
  select f.rut, f.entity_id, f.name, f.entity_type, f.subject_nature,
         f.sii_status not in ('TERMINATED_AS_PUBLISHED'),
         case when f.sii_status = 'TERMINATED_AS_PUBLISHED' then 'TERMINO_DE_GIRO_PUBLICADO_NO_INCORPORABLE'
              when f.sii_status = 'SIN_PERFIL_SII' then 'SIN_PERFIL_TRIBUTARIO_OBSERVABLE'
              else 'OPERACION_VIGENTE_EN_EL_CORTE' end,
         f.tipo_cuota,
         f.sector, f.evidence_class, f.act, f.conc, f.reg_n, f.uni_n,
         f.eventos, f.ultimo, f.refs,
         f.region, f.commune, f.sii_status, f.main_activity, f.activity_names,
         f.sales_band, f.sales_band_rank, f.workers_numeric, f.activity_start_date,
         f.termination_date, f.ownership_edge_count, f.legal_entity_partner_count,
         f.societies_as_partner_count, f.source_count, f.ipa3_score, f.ipa3_band,
         f.c_evr, f.c_cga, f.c_vig,
         f.ivo,
         case when f.ivo is null then 'NO_CALCULABLE'
              when f.ivo >= 75 then 'MUY_ALTA'
              when f.ivo >= 55 then 'ALTA'
              when f.ivo >= 40 then 'MEDIA'
              else 'BAJA' end,
         round(f.peso_disponible, 2),
         jsonb_build_array(
           jsonb_build_object(
             'code','EVR','label','Evidencia regulatoria directa','weight',40,
             'value',f.c_evr,
             'contribution', case when f.peso_disponible > 0 and f.c_evr is not null
                                  then round(f.c_evr * 40 / f.peso_disponible, 2) end,
             'basis', case when f.eventos > 0 then 'SANCION_UAF_SIN_INSCRIPCION_OBSERVADA'
                           else 'SIN_EVENTO_UAF_ATRIBUIDO' end,
             'evidence', jsonb_build_object('eventos', f.eventos, 'ultimo_evento', f.ultimo,
                                            'resoluciones', to_jsonb(coalesce(f.refs, array[]::text[]))),
             'reading','La UAF sancionó a esta entidad y no figura en el corte público del padrón. Es la evidencia más concluyente disponible, y aun así no acredita que hoy no esté inscrita.'),
           jsonb_build_object(
             'code','CGA','label','Coincidencia de giro con sector obligado','weight',45,
             'value',f.c_cga,
             'contribution', case when f.peso_disponible > 0 and f.c_cga is not null
                                  then round(f.c_cga * 45 / f.peso_disponible, 2) end,
             'basis', case when f.c_cga is null then 'SIN_GIRO_CARACTERISTICO_OBSERVADO'
                           when f.por_principal then 'GIRO_PRINCIPAL_DECLARADO_EN_SII'
                           else 'GIRO_SECUNDARIO_DECLARADO_EN_SII' end,
             'evidence', jsonb_build_object('giro', f.act, 'sector_implicado', f.sector,
                                            'concentracion', f.conc,
                                            'inscritos_con_ese_giro', f.reg_n,
                                            'universo_con_ese_giro', f.uni_n),
             'reading','La concentración es la proporción de entidades con ese giro que sí están inscritas. Describe al giro, no a esta entidad.'),
           jsonb_build_object(
             'code','VIG','label','Vigencia operativa','weight',15,
             'value',f.c_vig,
             'contribution', case when f.peso_disponible > 0 and f.c_vig is not null
                                  then round(f.c_vig * 15 / f.peso_disponible, 2) end,
             'basis', case when f.c_vig is null then 'SIN_PERFIL_TRIBUTARIO_OBSERVABLE'
                           else 'ESTADO_TRIBUTARIO_DEL_CORTE' end,
             'evidence', jsonb_build_object('estado_sii', f.sii_status,
                                            'termino_giro', f.termination_date,
                                            'inicio_actividades', f.activity_start_date),
             'reading','Una entidad con término de giro publicado no es candidata a incorporación, aunque su giro sea característico.')
         ),
         f.materialidad,
         jsonb_build_object(
           'escala', jsonb_build_object('tramo', f.sales_band, 'rank', f.sales_band_rank, 'peso', 45),
           'dotacion', jsonb_build_object('trabajadores', f.workers_numeric, 'peso', 25),
           'complejidad', jsonb_build_object('aristas_propiedad', f.ownership_edge_count,
                                             'socias_juridicas', f.legal_entity_partner_count,
                                             'participa_en_sociedades', f.societies_as_partner_count,
                                             'peso', 20),
           'cobertura', jsonb_build_object('fuentes', f.source_count, 'peso', 10),
           'reading','Materialidad mide cuánto pesaría incorporar a esta entidad, no qué tan plausible es que deba estarlo.'),
         array_remove(array[
           case when f.eventos > 0 then 'SANCIONADO_POR_UAF_SIN_INSCRIPCION' end,
           case when f.por_principal then 'GIRO_PRINCIPAL_CARACTERISTICO' end,
           case when not f.por_principal and f.act is not null then 'SOLO_GIRO_SECUNDARIO' end,
           case when f.conc >= 0.80 then 'GIRO_MUY_CONCENTRADO_EN_EL_SECTOR' end,
           case when f.sii_status = 'TERMINATED_AS_PUBLISHED' then 'TERMINO_DE_GIRO_PUBLICADO' end,
           case when f.sales_band_rank >= 8 then 'ESCALA_RELEVANTE' end,
           case when coalesce(f.legal_entity_partner_count, 0) >= 3
                  or coalesce(f.societies_as_partner_count, 0) >= 5 then 'ESTRUCTURA_SOCIETARIA_COMPLEJA' end,
           case when f.region is null then 'SIN_TERRITORIO_OBSERVADO' end,
           case when f.subject_nature = 'PERSONA_NATURAL' then 'PERSONA_NATURAL' end
         ], null),
         'IVO-1.0',
         'REGISTRATION_HYPOTHESIS_NOT_PROVEN_NON_COMPLIANCE',
         now()
  from final f;

  get diagnostics cands = row_count;

  return jsonb_build_object('characteristic_activities', acts, 'potential_subjects', cands);
end;
$function$;

-- Programación (fuera de la transacción, idempotente):
--   select cron.schedule('aml-uaf-potential-0580-if-stale','*/20 * * * *',
--                        'select public.refresh_aml_uaf_potential_if_stale_0580();');
