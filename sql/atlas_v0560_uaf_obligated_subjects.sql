-- ATLAS AML 0.56.0 · build 0560
-- Sujetos Obligados: caracterización completa y priorización fiscalizadora del
-- padrón inscrito en la UAF.
--
-- Por qué existe este archivo
-- ---------------------------
-- El registro público de sujetos obligados vive en aml_uaf_entity_profile: 9.782
-- RUT, cada uno con el sector por el cual quedó obligado. Hasta 0.55 ese registro
-- sólo se usaba como una bandera booleana (is_uaf_observed) para teñir otras
-- pantallas. Ninguna superficie respondía la pregunta que un fiscalizador hace
-- primero: "de este sujeto obligado, ¿qué sabemos, qué no sabemos, y por qué
-- debería mirarlo antes que a los otros 9.781".
--
-- Lo que el esquema ya tenía, disperso:
--   aml_uaf_entity_profile        padrón e inscripción sectorial
--   aml_entity_tax_profile        giro, escala, estructura y estado tributario
--   aml_sii_entity_year           trayectoria por año comercial
--   aml_sanctions (regulator UAF) 324 eventos, todos con entity_id nulo
--   aml_ipa3_entity_score_...     prioridad analítica de entidad
--   data/irg_sector_vulnerability_v1.json  vulnerabilidad estructural del sector
--
-- Este archivo no inventa datos: los reúne por sujeto obligado, resuelve la
-- atribución de los eventos sancionatorios de la UAF, y deja tres tablas de
-- lectura que la sección puede consultar sin recomputar nada en pantalla.
--
-- Los tres hechos que motivaron el diseño
-- ---------------------------------------
--   1. 429 sujetos obligados registran término de giro publicado en SII y siguen
--      figurando en el padrón UAF vigente.
--   2. 2.110 sujetos obligados no tienen perfil tributario observable: el
--      supervisor no puede caracterizarlos con la información disponible.
--   3. Los 324 eventos sancionatorios publicados por la UAF llegan con
--      identity_status = UNRESOLVED_CANDIDATE y entity_id nulo. Ninguna pantalla
--      podía decir a qué sujeto obligado corresponde una sanción de la UAF.
--
-- Semántica deliberada
-- --------------------
-- - El IPF ordena esfuerzo de fiscalización. No es probabilidad de LA/FT, no es
--   imputación de incumplimiento y no es una decisión institucional.
-- - La vulnerabilidad sectorial describe al sector, no la conducta de la entidad
--   inscrita en él. Es contexto estructural, y así se declara en la ficha.
-- - Un evento sancionatorio atribuido por nombre normalizado es candidato. No
--   promueve identidad canónica ni escribe entity_id en aml_sanctions.
-- - Ausencia de dato no es cero. Un componente sin evidencia queda nulo, sale
--   del promedio ponderado y baja la credibilidad declarada del índice.
-- - Término de giro publicado en SII no es baja del registro UAF: es una
--   discrepancia entre dos registros públicos, y se lee como tal.
-- - La atipicidad de giro es una posición dentro del propio sector obligado.
--   No es incumplimiento ni sospecha.
--
-- Seguridad: sólo lectura para el navegador, RLS con la misma política de
-- usuarios habilitados que el resto de los objetos analíticos.

begin;

-- ---------------------------------------------------------------------------
-- 0. Normalización de nombre sectorial
-- ---------------------------------------------------------------------------
-- El padrón escribe el sector con la grafía de la publicación UAF; el mapa de
-- vulnerabilidad usa una grafía canónica más sus alias conocidos. Se cruzan por
-- nombre normalizado (mayúsculas, sin tildes ni puntuación). No se usa
-- aml_entity_resolution_key_v1 aquí: esa función poda sufijos societarios, lo
-- que es correcto para razones sociales y equivocado para nombres de sector.
create or replace function public.aml_uaf_sector_key_v1(p_sector text)
returns text
language sql
immutable
set search_path to 'public'
as $function$
  select nullif(trim(regexp_replace(public.aml_normalizar_nombre_entidad(p_sector), '\s+', ' ', 'g')), '');
$function$;

comment on function public.aml_uaf_sector_key_v1(text) is
  'Clave de cruce para nombres de sector UAF. Normaliza grafía; no poda sufijos societarios.';

-- ---------------------------------------------------------------------------
-- 1. Vulnerabilidad estructural del sector obligado
-- ---------------------------------------------------------------------------
-- Copia gobernada de data/irg_sector_vulnerability_v1.json. Una fila por clave
-- de cruce (nombre canónico y cada alias publicado), todas apuntando al mismo
-- sector canónico.
create table if not exists public.aml_uaf_sector_vulnerability_ref (
  lookup_key            text primary key,
  uaf_sector_id         integer not null,
  sector_canonical_name text    not null,
  risk_inherent_1_5     numeric not null,
  vulnerability_index   numeric not null,
  key_role              text    not null,
  source_schema         text    not null default 'IRG_SECTOR_VULNERABILITY_V1',
  refreshed_at          timestamptz not null default now()
);

comment on table public.aml_uaf_sector_vulnerability_ref is
  'Vulnerabilidad estructural por sector obligado (media simple de seis dimensiones, escala 1-5, adaptada a 0-100). Describe el sector, nunca la conducta de una entidad inscrita.';

create index if not exists aml_uaf_sector_vulnerability_sector_idx
  on public.aml_uaf_sector_vulnerability_ref (uaf_sector_id);

-- ---------------------------------------------------------------------------
-- 2. Atribución de eventos sancionatorios UAF al padrón
-- ---------------------------------------------------------------------------
create table if not exists public.aml_uaf_sanction_subject_link_snapshot (
  sanction_id        text primary key,
  event_date         date,
  source_entity_name text,
  resolution_ref     text,
  event_status       text,
  event_category     text,
  matched_rut        text,
  matched_registry_name text,
  matched_sector     text,
  candidate_rut_count integer not null default 0,
  resolution_status  text    not null,
  resolution_method  text    not null,
  confidence         numeric,
  promotes_identity  boolean not null default false,
  refreshed_at       timestamptz not null default now()
);

comment on table public.aml_uaf_sanction_subject_link_snapshot is
  'Atribución candidata de eventos sancionatorios UAF al padrón de sujetos obligados por nombre normalizado. Un candidato sigue siendo candidato: no promueve identidad ni escribe entity_id en aml_sanctions.';

create index if not exists aml_uaf_sanction_link_rut_idx
  on public.aml_uaf_sanction_subject_link_snapshot (matched_rut, event_date desc);
create index if not exists aml_uaf_sanction_link_status_idx
  on public.aml_uaf_sanction_subject_link_snapshot (resolution_status);

-- ---------------------------------------------------------------------------
-- 3. Caracterización por sujeto obligado
-- ---------------------------------------------------------------------------
create table if not exists public.aml_uaf_obligated_subject_snapshot (
  rut                       text primary key,
  entity_id                 text,
  registry_name             text,
  entity_name               text,
  entity_type               text,
  subject_nature            text,
  uaf_sector                text,
  uaf_sector_canonical      text,
  uaf_sector_id             integer,
  registry_source_ref       text,
  registry_document_ids     text[],
  registry_observed_at      timestamptz,

  region                    text,
  commune                   text,
  territory_basis           text,

  sii_status                text,
  sii_commercial_year       integer,
  sii_main_activity         text,
  sii_economic_sector       text,
  sii_economic_subsector    text,
  sii_taxpayer_type         text,
  sii_activity_start_date   date,
  sii_termination_date      date,
  sii_sales_band            text,
  sii_sales_band_rank       integer,
  sii_workers               bigint,
  sii_activity_count        integer,
  sii_address_count         integer,
  sii_region_changed        boolean,
  sii_activity_changed      boolean,
  sii_signal_count          integer,
  entity_age_years          integer,
  ownership_edge_count      integer,
  legal_entity_partner_count integer,
  societies_as_partner_count integer,
  society_type              text,

  activity_peer_share       numeric,
  activity_atypicality      numeric,
  activity_peer_basis       text,

  sanction_event_count      integer not null default 0,
  sanction_event_count_5y   integer not null default 0,
  sanction_last_event_date  date,
  sanction_resolution_refs  text[],
  sanction_attribution      text,

  source_count              integer,
  ipa3_score                numeric,
  ipa3_band                 text,
  ipa3_dominant_mark        text,

  sector_vulnerability      numeric,
  ipf_supervision_history   numeric,
  ipf_registry_coherence    numeric,
  ipf_scale_complexity      numeric,
  ipf_observability_gap     numeric,
  ipf_score                 numeric,
  ipf_band                  text,
  ipf_credibility_pct       numeric,
  ipf_percentile            numeric,
  ipf_sector_percentile     numeric,
  ipf_components            jsonb,
  ipf_flags                 text[],
  ipf_version               text not null default 'IPF-1.0',
  semantics                 text not null default 'SUPERVISORY_PRIORITIZATION_NOT_LAFT_PROBABILITY',
  refreshed_at              timestamptz not null default now()
);

comment on table public.aml_uaf_obligated_subject_snapshot is
  'Caracterización por sujeto obligado inscrito en la UAF e Índice de Priorización Fiscalizadora (IPF-1.0). El IPF ordena esfuerzo de fiscalización; no es probabilidad de LA/FT ni imputación de incumplimiento.';

comment on column public.aml_uaf_obligated_subject_snapshot.subject_nature is
  'Naturaleza jurídica derivada de la estructura del RUT chileno (cuerpo < 50.000.000 = persona natural). Un notario o corredor persona natural no tiene perfil tributario de empresa: su ausencia no es una brecha registral y no puntúa como tal.';
comment on column public.aml_uaf_obligated_subject_snapshot.ipf_percentile is
  'Posición del sujeto obligado dentro del padrón completo según IPF. Es posición relativa, no nivel absoluto de riesgo.';
comment on column public.aml_uaf_obligated_subject_snapshot.ipf_sector_percentile is
  'Posición dentro de su propio sector obligado. Compara pares reales sin arrastrar la vulnerabilidad sectorial común.';

create index if not exists aml_uaf_obligated_ipf_idx
  on public.aml_uaf_obligated_subject_snapshot (ipf_score desc nulls last);
create index if not exists aml_uaf_obligated_sector_idx
  on public.aml_uaf_obligated_subject_snapshot (uaf_sector_canonical, ipf_score desc nulls last);
create index if not exists aml_uaf_obligated_region_idx
  on public.aml_uaf_obligated_subject_snapshot (region);
create index if not exists aml_uaf_obligated_entity_idx
  on public.aml_uaf_obligated_subject_snapshot (entity_id);
create index if not exists aml_uaf_obligated_status_idx
  on public.aml_uaf_obligated_subject_snapshot (sii_status);
create index if not exists aml_uaf_obligated_percentile_idx
  on public.aml_uaf_obligated_subject_snapshot (ipf_percentile desc nulls last);
create index if not exists aml_uaf_obligated_nature_idx
  on public.aml_uaf_obligated_subject_snapshot (subject_nature);
create index if not exists aml_uaf_obligated_name_trgm_idx
  on public.aml_uaf_obligated_subject_snapshot using gin (registry_name extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- 4. Lectura del universo por sector obligado
-- ---------------------------------------------------------------------------
create table if not exists public.aml_uaf_obligated_sector_snapshot (
  uaf_sector_canonical   text primary key,
  uaf_sector_id          integer,
  registry_labels        text[],
  subject_count          integer not null,
  vulnerability_index    numeric,
  ipf_mean               numeric,
  ipf_p90                numeric,
  band_muy_alta          integer not null default 0,
  band_alta              integer not null default 0,
  band_media             integer not null default 0,
  band_baja              integer not null default 0,
  band_minima            integer not null default 0,
  sanctioned_subjects    integer not null default 0,
  sanction_events        integer not null default 0,
  sanction_rate_per_100  numeric,
  sii_active             integer not null default 0,
  sii_terminated         integer not null default 0,
  sii_absent             integer not null default 0,
  sii_coverage_pct       numeric,
  atypical_activity_subjects integer not null default 0,
  natural_person_subjects integer not null default 0,
  median_sales_band_rank numeric,
  top_region             text,
  top_region_share_pct   numeric,
  refreshed_at           timestamptz not null default now()
);

comment on table public.aml_uaf_obligated_sector_snapshot is
  'Lectura del padrón por sector obligado: carga, cobertura, presión supervisora observada y distribución del IPF. La tasa sancionatoria describe lo publicado por la UAF, no la conducta agregada del sector.';

-- ---------------------------------------------------------------------------
-- 5. Autorización: la misma política de los demás objetos analíticos
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'aml_uaf_sector_vulnerability_ref',
    'aml_uaf_sanction_subject_link_snapshot',
    'aml_uaf_obligated_subject_snapshot',
    'aml_uaf_obligated_sector_snapshot'
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

commit;

-- ---------------------------------------------------------------------------
-- 6. Carga del mapa de vulnerabilidad sectorial
-- ---------------------------------------------------------------------------
-- Fuente: data/irg_sector_vulnerability_v1.json (55 sectores de la Ley 19.913,
-- media simple de seis dimensiones estructurales, escala 1-5). La adaptación a
-- 0-100 es la ya declarada por ese esquema: (r - 1) / 4 * 100.
begin;

create temporary table tmp_uaf_sector_seed(
  uaf_sector_id integer,
  sector_canonical_name text,
  lookup_label text,
  risk_inherent_1_5 numeric,
  key_role text
) on commit drop;

insert into tmp_uaf_sector_seed(uaf_sector_id, sector_canonical_name, lookup_label, risk_inherent_1_5, key_role) values
  (1, 'Administradoras de Fondos de Inversión', 'Administradoras de Fondos de Inversión', 3.67, 'CANONICO'),
  (1, 'Administradoras de Fondos de Inversión', 'Administradoras de fondos de inversión', 3.67, 'ALIAS'),
  (2, 'Administradoras de Fondos de Pensiones', 'Administradoras de Fondos de Pensiones', 3.0, 'CANONICO'),
  (2, 'Administradoras de Fondos de Pensiones', 'Administradores de Fondos de Pensiones (AFP)', 3.0, 'ALIAS'),
  (2, 'Administradoras de Fondos de Pensiones', 'Administradoras de Fondos de Pensiones (AFP)', 3.0, 'ALIAS'),
  (3, 'Administradoras de Fondos Mutuos', 'Administradoras de Fondos Mutuos', 3.83, 'CANONICO'),
  (4, 'Administradoras de Mutuos Hipotecarios', 'Administradoras de Mutuos Hipotecarios', 3.0, 'CANONICO'),
  (5, 'Administradoras Generales de Fondos', 'Administradoras Generales de Fondos', 3.67, 'CANONICO'),
  (5, 'Administradoras Generales de Fondos', 'Administradoras generales de fondos', 3.67, 'ALIAS'),
  (6, 'Agentes de Aduana', 'Agentes de Aduana', 3.83, 'CANONICO'),
  (6, 'Agentes de Aduana', 'Agentes de aduana', 3.83, 'ALIAS'),
  (7, 'Agentes de Valores', 'Agentes de Valores', 3.5, 'CANONICO'),
  (7, 'Agentes de Valores', 'Agentes de valores', 3.5, 'ALIAS'),
  (8, 'Armas: Personas que se Dediquen a la Fabricación de Armas', 'Armas: Personas que se Dediquen a la Fabricación de Armas', 4.0, 'CANONICO'),
  (9, 'Armas: Personas que se Dediquen a la Venta de Armas', 'Armas: Personas que se Dediquen a la Venta de Armas', 4.33, 'CANONICO'),
  (10, 'Bancos', 'Bancos', 3.67, 'CANONICO'),
  (11, 'Bolsas de Productos', 'Bolsas de Productos', 3.5, 'CANONICO'),
  (11, 'Bolsas de Productos', 'Bolsas de productos', 3.5, 'ALIAS'),
  (12, 'Bolsas de Valores', 'Bolsas de Valores', 3.5, 'CANONICO'),
  (12, 'Bolsas de Valores', 'Bolsas de valores', 3.5, 'ALIAS'),
  (13, 'Cajas de Compensación', 'Cajas de Compensación', 2.83, 'CANONICO'),
  (14, 'Casas de Cambio', 'Casas de Cambio', 4.33, 'CANONICO'),
  (14, 'Casas de Cambio', 'Casas de cambio', 4.33, 'ALIAS'),
  (15, 'Casas de Remate y Martillo', 'Casas de Remate y Martillo', 4.17, 'CANONICO'),
  (15, 'Casas de Remate y Martillo', 'Casas de remate y martillo', 4.17, 'ALIAS'),
  (16, 'Casinos de Juego', 'Casinos de Juego', 4.0, 'CANONICO'),
  (17, 'Casinos Flotantes de Juego', 'Casinos Flotantes de Juego', 4.5, 'CANONICO'),
  (17, 'Casinos Flotantes de Juego', 'Casinos flotantes de Juegos', 4.5, 'ALIAS'),
  (18, 'Clubes de Caza', 'Clubes de Caza', 3.67, 'CANONICO'),
  (19, 'Clubes de Pesca', 'Clubes de Pesca', 3.0, 'CANONICO'),
  (20, 'Clubes de Tiro', 'Clubes de Tiro', 3.67, 'CANONICO'),
  (21, 'Comerciantes de Joyas y Piedras Preciosas', 'Comerciantes de Joyas y Piedras Preciosas', 4.83, 'CANONICO'),
  (22, 'Comerciantes de Metales Preciosos', 'Comerciantes de Metales Preciosos', 4.83, 'CANONICO'),
  (23, 'Compañías de Seguros', 'Compañías de Seguros', 3.33, 'CANONICO'),
  (23, 'Compañías de Seguros', 'Compañías de Seguro', 3.33, 'ALIAS'),
  (24, 'Conservadores', 'Conservadores', 3.0, 'CANONICO'),
  (25, 'Cooperativas de Ahorro y Crédito', 'Cooperativas de Ahorro y Crédito', 3.33, 'CANONICO'),
  (25, 'Cooperativas de Ahorro y Crédito', 'Cooperativas (instituciones financieras)', 3.33, 'ALIAS'),
  (26, 'Corredores de Bolsas de Productos', 'Corredores de Bolsas de Productos', 3.5, 'CANONICO'),
  (26, 'Corredores de Bolsas de Productos', 'Corredores de bolsas de productos', 3.5, 'ALIAS'),
  (27, 'Corredores de Bolsas de Valores', 'Corredores de Bolsas de Valores', 3.5, 'CANONICO'),
  (27, 'Corredores de Bolsas de Valores', 'Corredores de bolsa de valores', 3.5, 'ALIAS'),
  (28, 'Corredores de Propiedades', 'Corredores de Propiedades', 4.17, 'CANONICO'),
  (28, 'Corredores de Propiedades', 'Corredores de propiedades', 4.17, 'ALIAS'),
  (29, 'Emisoras y Operadoras de Tarjetas de Pago', 'Emisoras y Operadoras de Tarjetas de Pago', 3.67, 'CANONICO'),
  (29, 'Emisoras y Operadoras de Tarjetas de Pago', 'Emisoras de tarjetas de crédito', 3.67, 'ALIAS'),
  (29, 'Emisoras y Operadoras de Tarjetas de Pago', 'Operadoras de tarjetas de crédito', 3.67, 'ALIAS'),
  (29, 'Emisoras y Operadoras de Tarjetas de Pago', 'Emisores de Tarjetas de Pago con provisión de fondos, o cualquier otro sistema similar a los referidos medios de pago', 3.67, 'ALIAS'),
  (29, 'Emisoras y Operadoras de Tarjetas de Pago', 'Operadores de Tarjetas de Pago con provisión de fondos, o cualquier otro sistema similar a los referidos medios de pago', 3.67, 'ALIAS'),
  (30, 'Empresas de Arrendamiento Financiero (Leasing)', 'Empresas de Arrendamiento Financiero (Leasing)', 2.83, 'CANONICO'),
  (30, 'Empresas de Arrendamiento Financiero (Leasing)', 'Empresas de arrendamiento financiero (Leasing)', 2.83, 'ALIAS'),
  (31, 'Empresas de Depósitos de Valores', 'Empresas de Depósitos de Valores', 3.5, 'CANONICO'),
  (31, 'Empresas de Depósitos de Valores', 'Depósitos de Valores', 3.5, 'ALIAS'),
  (32, 'Empresas de Factoraje (Factoring)', 'Empresas de Factoraje (Factoring)', 3.33, 'CANONICO'),
  (32, 'Empresas de Factoraje (Factoring)', 'Empresas de factoraje (Factoring)', 3.33, 'ALIAS'),
  (33, 'Empresas de Securitización', 'Empresas de Securitización', 3.5, 'CANONICO'),
  (33, 'Empresas de Securitización', 'Empresas de securitización', 3.5, 'ALIAS'),
  (34, 'Empresas de Transferencia de Dinero', 'Empresas de Transferencia de Dinero', 4.17, 'CANONICO'),
  (34, 'Empresas de Transferencia de Dinero', 'Empresas de transferencia de dinero', 4.17, 'ALIAS'),
  (35, 'Empresas de Transporte de Valores', 'Empresas de Transporte de Valores', 3.67, 'CANONICO'),
  (35, 'Empresas de Transporte de Valores', 'Empresas de transporte de valores', 3.67, 'ALIAS'),
  (36, 'Empresas Dedicadas a la Gestión Inmobiliaria', 'Empresas Dedicadas a la Gestión Inmobiliaria', 4.0, 'CANONICO'),
  (36, 'Empresas Dedicadas a la Gestión Inmobiliaria', 'Empresas dedicadas a la gestión inmobiliaria', 4.0, 'ALIAS'),
  (37, 'Fintec: Custodia de Instrumentos Financieros', 'Fintec: Custodia de Instrumentos Financieros', 4.33, 'CANONICO'),
  (37, 'Fintec: Custodia de Instrumentos Financieros', 'Fintec: Prestadores del servicio de Custodia de Instrumentos Financieros', 4.33, 'ALIAS'),
  (38, 'Fintec: Intermediación de Instrumentos Financieros', 'Fintec: Intermediación de Instrumentos Financieros', 4.0, 'CANONICO'),
  (38, 'Fintec: Intermediación de Instrumentos Financieros', 'Fintec: Prestadores del servicio de Intermediación de Instrumentos Financieros', 4.0, 'ALIAS'),
  (39, 'Fintec: Plataformas de Financiamiento Colectivo', 'Fintec: Plataformas de Financiamiento Colectivo', 4.0, 'CANONICO'),
  (39, 'Fintec: Plataformas de Financiamiento Colectivo', 'Fintec: Prestadores del servicio de Plataforma de Financiamiento Colectivo', 4.0, 'ALIAS'),
  (40, 'Fintec: Sistemas Alternativos de Transacción', 'Fintec: Sistemas Alternativos de Transacción', 4.17, 'CANONICO'),
  (40, 'Fintec: Sistemas Alternativos de Transacción', 'Fintec: Prestadores del servicio de Sistemas Alternativos de Transacción', 4.17, 'ALIAS'),
  (41, 'Fintec: Iniciación de Pagos', 'Fintec: Iniciación de Pagos', 4.17, 'CANONICO'),
  (41, 'Fintec: Iniciación de Pagos', 'Fintec: Prestadores del servicio de Iniciación de Pagos', 4.17, 'ALIAS'),
  (42, 'Fintec: Otros Fiscalizados por la CMF', 'Fintec: Otros Fiscalizados por la CMF', 4.17, 'CANONICO'),
  (42, 'Fintec: Otros Fiscalizados por la CMF', 'Fintec: Otros fiscalizados por la Comisión para el Mercado Financiero (CMF)', 4.17, 'ALIAS'),
  (43, 'Hipódromos', 'Hipódromos', 3.83, 'CANONICO'),
  (44, 'Instituciones Financieras', 'Instituciones Financieras', 3.5, 'CANONICO'),
  (44, 'Instituciones Financieras', 'Institución Financiera', 3.5, 'ALIAS'),
  (45, 'Notarios', 'Notarios', 3.67, 'CANONICO'),
  (46, 'Operadores de Mercados de Futuro y de Opciones', 'Operadores de Mercados de Futuro y de Opciones', 3.83, 'CANONICO'),
  (46, 'Operadores de Mercados de Futuro y de Opciones', 'Operadores de mercados de futuro y de opciones', 3.83, 'ALIAS'),
  (47, 'Organizaciones Deportivas Profesionales regidas por la Ley N° 20.019', 'Organizaciones Deportivas Profesionales regidas por la Ley N° 20.019', 4.17, 'CANONICO'),
  (47, 'Organizaciones Deportivas Profesionales regidas por la Ley N° 20.019', 'Organizaciones Deportivas Profesionales', 4.17, 'ALIAS'),
  (48, 'Otras Entidades Facultadas para Recibir Moneda Extranjera', 'Otras Entidades Facultadas para Recibir Moneda Extranjera', 3.67, 'CANONICO'),
  (48, 'Otras Entidades Facultadas para Recibir Moneda Extranjera', 'Otras entidades facultadas para recibir moneda extranjera', 3.67, 'ALIAS'),
  (49, 'Personas que se Dediquen a la Compraventa de Equinos de Raza Pura', 'Personas que se Dediquen a la Compraventa de Equinos de Raza Pura', 4.17, 'CANONICO'),
  (50, 'Representaciones de Bancos Extranjeros', 'Representaciones de Bancos Extranjeros', 2.83, 'CANONICO'),
  (51, 'Sociedades Administradoras de Zonas Francas', 'Sociedades Administradoras de Zonas Francas', 3.5, 'CANONICO'),
  (51, 'Sociedades Administradoras de Zonas Francas', 'Sociedades administradoras de zonas francas', 3.5, 'ALIAS'),
  (52, 'Usuarios de Zonas Francas', 'Usuarios de Zonas Francas', 4.33, 'CANONICO'),
  (52, 'Usuarios de Zonas Francas', 'Usuarios de zonas francas', 4.33, 'ALIAS'),
  (53, 'Vehículos: Automotoras', 'Vehículos: Automotoras', 3.83, 'CANONICO'),
  (54, 'Vehículos: Comercializadoras de Vehículos Nuevos o Usados', 'Vehículos: Comercializadoras de Vehículos Nuevos o Usados', 4.33, 'CANONICO'),
  (55, 'Vehículos: Empresas de Arriendo de Vehículos', 'Vehículos: Empresas de Arriendo de Vehículos', 4.17, 'CANONICO');

delete from public.aml_uaf_sector_vulnerability_ref;
insert into public.aml_uaf_sector_vulnerability_ref
  (lookup_key, uaf_sector_id, sector_canonical_name, risk_inherent_1_5, vulnerability_index, key_role, refreshed_at)
select distinct on (public.aml_uaf_sector_key_v1(s.lookup_label))
       public.aml_uaf_sector_key_v1(s.lookup_label),
       s.uaf_sector_id,
       s.sector_canonical_name,
       s.risk_inherent_1_5,
       round((s.risk_inherent_1_5 - 1) / 4 * 100, 2),
       s.key_role,
       now()
from tmp_uaf_sector_seed s
where public.aml_uaf_sector_key_v1(s.lookup_label) is not null
order by public.aml_uaf_sector_key_v1(s.lookup_label), (s.key_role = 'CANONICO') desc;

commit;

-- ---------------------------------------------------------------------------
-- 7. Refresco
-- ---------------------------------------------------------------------------
-- IPF-1.0 · Índice de Priorización Fiscalizadora
--
--   VSE  Vulnerabilidad sectorial estructural   peso 25
--   HSU  Historial de supervisión UAF           peso 25
--   CRG  Coherencia registral UAF <-> SII       peso 20
--   EEC  Escala, exposición y complejidad       peso 18
--   OBS  Brecha de observabilidad               peso 12
--
-- El puntaje es el promedio ponderado de los componentes con evidencia. Un
-- componente sin evidencia queda nulo, sale del promedio y baja la credibilidad
-- declarada. Nunca se imputa cero para completar el índice.
create or replace function public.refresh_aml_uaf_obligated_subjects_0560()
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare links integer; subjects integer; sectors integer;
begin
  -- A) Atribución de eventos sancionatorios UAF al padrón --------------------
  delete from public.aml_uaf_sanction_subject_link_snapshot;

  insert into public.aml_uaf_sanction_subject_link_snapshot
    (sanction_id, event_date, source_entity_name, resolution_ref, event_status,
     event_category, matched_rut, matched_registry_name, matched_sector,
     candidate_rut_count, resolution_status, resolution_method, confidence,
     promotes_identity, refreshed_at)
  with san as (
    select s.sanction_id,
           s.event_date,
           s.entity_name,
           s.payload->'attributes'->>'resolution' as resolution_ref,
           s.payload->'attributes'->>'status'     as event_status,
           s.payload->'attributes'->>'category'   as event_category,
           public.aml_entity_resolution_key_v1(s.entity_name) as match_key
    from public.aml_sanctions s
    where s.regulator = 'UAF'
  ),
  reg as (
    select u.rut,
           rn as registry_name,
           u.sector_names[1] as sector,
           public.aml_entity_resolution_key_v1(rn) as match_key
    from public.aml_uaf_entity_profile u,
         lateral unnest(u.registry_names) rn
  ),
  reg_unique as (
    select match_key,
           count(distinct rut) as rut_count,
           min(rut) as rut_min,
           min(registry_name) as registry_name_min,
           min(sector) as sector_min
    from reg
    where match_key is not null
    group by match_key
  )
  select san.sanction_id,
         san.event_date,
         san.entity_name,
         san.resolution_ref,
         san.event_status,
         san.event_category,
         case when r.rut_count = 1 then r.rut_min end,
         case when r.rut_count = 1 then r.registry_name_min end,
         case when r.rut_count = 1 then r.sector_min end,
         coalesce(r.rut_count, 0),
         case
           when r.rut_count = 1 then 'CANDIDATO_UNICO'
           when r.rut_count > 1 then 'CANDIDATO_AMBIGUO'
           else 'SIN_CANDIDATO_EN_PADRON'
         end,
         'NOMBRE_NORMALIZADO_PADRON_UAF',
         case when r.rut_count = 1 then 0.72 when r.rut_count > 1 then 0.35 end,
         false,
         now()
  from san
  left join reg_unique r on r.match_key = san.match_key;

  get diagnostics links = row_count;

  -- B) Caracterización y IPF por sujeto obligado -----------------------------
  delete from public.aml_uaf_obligated_subject_snapshot;

  insert into public.aml_uaf_obligated_subject_snapshot (
    rut, entity_id, registry_name, entity_name, entity_type, subject_nature,
    uaf_sector, uaf_sector_canonical, uaf_sector_id,
    registry_source_ref, registry_document_ids, registry_observed_at,
    region, commune, territory_basis,
    sii_status, sii_commercial_year, sii_main_activity, sii_economic_sector,
    sii_economic_subsector, sii_taxpayer_type, sii_activity_start_date,
    sii_termination_date, sii_sales_band, sii_sales_band_rank, sii_workers,
    sii_activity_count, sii_address_count, sii_region_changed, sii_activity_changed,
    sii_signal_count, entity_age_years, ownership_edge_count,
    legal_entity_partner_count, societies_as_partner_count, society_type,
    activity_peer_share, activity_atypicality, activity_peer_basis,
    sanction_event_count, sanction_event_count_5y, sanction_last_event_date,
    sanction_resolution_refs, sanction_attribution,
    source_count, ipa3_score, ipa3_band, ipa3_dominant_mark,
    sector_vulnerability, ipf_supervision_history, ipf_registry_coherence,
    ipf_scale_complexity, ipf_observability_gap,
    ipf_score, ipf_band, ipf_credibility_pct, ipf_percentile, ipf_sector_percentile,
    ipf_components, ipf_flags,
    ipf_version, semantics, refreshed_at
  )
  with base as (
    select u.rut,
           e.entity_id,
           u.registry_names[1]                as registry_name,
           e.name                             as entity_name,
           e.entity_type,
           u.sector_names[1]                  as uaf_sector,
           public.aml_uaf_sector_key_v1(u.sector_names[1]) as sector_key,
           u.source_ref                       as registry_source_ref,
           u.source_document_ids              as registry_document_ids,
           u.updated_at                       as registry_observed_at,
           e.source_count,
           coalesce(nullif(e.region, ''), nullif(t.region, ''))   as region,
           coalesce(nullif(e.commune, ''), nullif(t.commune, '')) as commune,
           case
             when nullif(e.region, '') is not null then 'PADRON_ENTIDAD'
             when nullif(t.region, '') is not null then 'PERFIL_SII'
             else 'NO_OBSERVADO'
           end as territory_basis,
           case
             when t.entity_id is null then 'SIN_PERFIL_SII'
             when t.current_status = 'TERMINATED_AS_PUBLISHED' then 'TERMINATED_AS_PUBLISHED'
             else coalesce(t.current_status, 'ACTIVE_AS_PUBLISHED')
           end as sii_status,
           t.commercial_year        as sii_commercial_year,
           t.main_activity          as sii_main_activity,
           t.economic_sector        as sii_economic_sector,
           t.economic_subsector     as sii_economic_subsector,
           t.taxpayer_type          as sii_taxpayer_type,
           t.activity_start_date    as sii_activity_start_date,
           t.termination_date       as sii_termination_date,
           t.sales_band             as sii_sales_band,
           t.sales_band_rank        as sii_sales_band_rank,
           t.workers_numeric        as sii_workers,
           t.activity_count         as sii_activity_count,
           t.address_count          as sii_address_count,
           t.signal_count           as sii_signal_count,
           t.ownership_edge_count,
           t.legal_entity_partner_count,
           t.societies_as_partner_count,
           t.society_type,
           case when t.activity_start_date is not null
                then floor(extract(epoch from (now() - t.activity_start_date::timestamptz)) / 31557600)::integer
           end as entity_age_years,
           y.region_changed        as sii_region_changed,
           y.main_activity_changed as sii_activity_changed,
           -- Convención del RUT chileno: los cuerpos bajo 50.000.000 se asignan
           -- a personas naturales. Un notario o un corredor persona natural no
           -- tiene perfil tributario de empresa, y ese vacío no debe leerse
           -- como incoherencia registral ni inflar su prioridad.
           case when u.rut ~ '^[0-9]'
                 and (regexp_replace(split_part(u.rut, '-', 1), '[^0-9]', '', 'g'))::bigint < 50000000
                then 'PERSONA_NATURAL' else 'PERSONA_JURIDICA' end as subject_nature
    from public.aml_uaf_entity_profile u
    join public.aml_entities e on e.rut = u.rut
    left join public.aml_entity_tax_profile t on t.entity_id = e.entity_id
    left join lateral (
      select yy.region_changed, yy.main_activity_changed
      from public.aml_sii_entity_year yy
      where yy.entity_id = e.entity_id
      order by yy.commercial_year desc
      limit 1
    ) y on true
  ),
  -- Atipicidad de giro: posición del subsector económico declarado dentro del
  -- propio sector obligado. No es incumplimiento; es rareza observada entre
  -- pares del mismo sector, y sólo se afirma con base suficiente.
  peer as (
    select sector_key, sii_economic_subsector, count(*)::numeric as n
    from base
    where sector_key is not null and sii_economic_subsector is not null
    group by 1, 2
  ),
  peer_total as (
    select sector_key, sum(n) as observed_total
    from peer
    group by 1
  ),
  sanction as (
    select l.matched_rut as rut,
           count(*)::integer as event_count,
           count(*) filter (
             where l.event_date is not null
               and l.event_date >= (current_date - interval '5 years')::date
           )::integer as event_count_5y,
           max(l.event_date) as last_event_date,
           array_remove(array_agg(distinct l.resolution_ref), null) as resolution_refs
    from public.aml_uaf_sanction_subject_link_snapshot l
    where l.matched_rut is not null
      and l.resolution_status = 'CANDIDATO_UNICO'
    group by 1
  ),
  enriched as (
    select b.*,
           v.uaf_sector_id,
           v.sector_canonical_name,
           v.vulnerability_index,
           case when pt.observed_total >= 20 and p.n is not null
                then round(p.n / pt.observed_total, 4) end as activity_peer_share,
           case when pt.observed_total >= 20 and p.n is not null
                then round(1 - p.n / pt.observed_total, 4) end as activity_atypicality,
           case
             when b.sii_economic_subsector is null then 'SIN_GIRO_OBSERVADO'
             when pt.observed_total is null or pt.observed_total < 20 then 'BASE_SECTORIAL_INSUFICIENTE'
             else 'PARES_DEL_SECTOR_OBLIGADO'
           end as activity_peer_basis,
           coalesce(s.event_count, 0)    as sanction_event_count,
           coalesce(s.event_count_5y, 0) as sanction_event_count_5y,
           s.last_event_date             as sanction_last_event_date,
           s.resolution_refs             as sanction_resolution_refs,
           i.ipa3_score,
           i.priority_band_shadow as ipa3_band,
           i.dominant_mark_id     as ipa3_dominant_mark
    from base b
    left join public.aml_uaf_sector_vulnerability_ref v on v.lookup_key = b.sector_key
    left join peer p on p.sector_key = b.sector_key
                    and p.sii_economic_subsector is not distinct from b.sii_economic_subsector
    left join peer_total pt on pt.sector_key = b.sector_key
    left join sanction s on s.rut = b.rut
    left join public.aml_ipa3_entity_score_snapshot_v0_4 i on i.entity_id = b.entity_id
  ),
  scored as (
    select en.*,
           -- VSE: contexto estructural del sector, no conducta de la entidad.
           en.vulnerability_index as c_vse,
           -- HSU: eventos sancionatorios UAF atribuidos de forma unívoca,
           -- ponderados por recencia (horizonte 6 años) y por reiteración.
           case
             when en.sanction_event_count = 0 then 0::numeric
             when en.sanction_last_event_date is null
               then round(100 * 0.40 * least(1, en.sanction_event_count / 3.0), 2)
             else round(100 * (
                    0.60 * greatest(0, 1 - (current_date - en.sanction_last_event_date)::numeric / 2190.0)
                  + 0.40 * least(1, en.sanction_event_count / 3.0)), 2)
           end as c_hsu,
           -- CRG: discrepancias observables entre el padrón UAF y el registro
           -- tributario. Siempre evaluable: la ausencia de perfil SII es en sí
           -- misma una observación sobre el par de registros.
           least(100, (
               case when en.sii_status = 'TERMINATED_AS_PUBLISHED' then 45 else 0 end
             + case when en.sii_status = 'SIN_PERFIL_SII'
                    and en.subject_nature = 'PERSONA_JURIDICA' then 30 else 0 end
             + case when en.activity_atypicality is not null
                    then round(30 * en.activity_atypicality) else 0 end
             + case when en.sii_region_changed is true then 10 else 0 end
             + case when en.sii_activity_changed is true then 10 else 0 end
           ))::numeric as c_crg,
           -- EEC: sólo con perfil tributario observable.
           case when en.sii_status = 'SIN_PERFIL_SII'
                  or en.subject_nature = 'PERSONA_NATURAL' then null else least(100, (
               case when en.sii_sales_band_rank is not null
                    then round(40 * (en.sii_sales_band_rank - 1)::numeric / 12.0, 2) else 0 end
             + case when coalesce(en.sii_workers, 0) > 0
                    then round(least(20, 20 * ln((1 + en.sii_workers)::numeric) / ln(3001::numeric)), 2) else 0 end
             + least(30,
                 least(12, coalesce(en.ownership_edge_count, 0)::numeric)
               + least(10, coalesce(en.legal_entity_partner_count, 0)::numeric * 2)
               + least(8,  coalesce(en.societies_as_partner_count, 0)::numeric * 2))
             + case when en.entity_age_years is not null and en.entity_age_years <= 3 then 10 else 0 end
           )) end as c_eec,
           -- OBS: cuánto de este sujeto obligado el supervisor no puede ver.
           least(100, (
               case when en.sii_status = 'SIN_PERFIL_SII'
                      and en.subject_nature = 'PERSONA_JURIDICA' then 40 else 0 end
             + case when coalesce(en.source_count, 0) <= 1 then 20 else 0 end
             + case when en.region is null then 20 else 0 end
             + case when en.registry_observed_at is null
                      or en.registry_observed_at < now() - interval '180 days' then 20 else 0 end
           ))::numeric as c_obs
    from enriched en
  ),
  weighted as (
    select sc.*,
           (case when sc.c_vse is not null then 25 else 0 end
          + case when sc.c_hsu is not null then 25 else 0 end
          + case when sc.c_crg is not null then 20 else 0 end
          + case when sc.c_eec is not null then 18 else 0 end
          + case when sc.c_obs is not null then 12 else 0 end)::numeric as available_weight,
           (coalesce(sc.c_vse, 0) * 25
          + coalesce(sc.c_hsu, 0) * 25
          + coalesce(sc.c_crg, 0) * 20
          + coalesce(sc.c_eec, 0) * 18
          + coalesce(sc.c_obs, 0) * 12)::numeric as weighted_sum
    from scored sc
  ),
  absolute_score as (
    select w.*,
           case when w.available_weight > 0
                then round(w.weighted_sum / w.available_weight, 2) end as ipf_score
    from weighted w
  ),
  -- El puntaje absoluto del IPF se comprime: la vulnerabilidad sectorial es
  -- casi constante dentro de un sector y los demás componentes son bajos para
  -- la mayoría del padrón. Un fiscalizador necesita una lista de trabajo
  -- ordenada, no un medidor absoluto, así que la banda se ancla en la posición
  -- dentro del padrón vigente y así se declara en pantalla.
  final as (
    select a.*,
           round((percent_rank() over (order by a.ipf_score nulls first) * 100)::numeric, 2) as ipf_percentile,
           round((percent_rank() over (partition by a.sector_canonical_name order by a.ipf_score nulls first) * 100)::numeric, 2) as ipf_sector_percentile
    from absolute_score a
  )
  select f.rut,
         f.entity_id,
         f.registry_name,
         f.entity_name,
         f.entity_type,
         f.subject_nature,
         f.uaf_sector,
         coalesce(f.sector_canonical_name, f.uaf_sector),
         f.uaf_sector_id,
         f.registry_source_ref,
         f.registry_document_ids,
         f.registry_observed_at,
         f.region,
         f.commune,
         f.territory_basis,
         f.sii_status,
         f.sii_commercial_year,
         f.sii_main_activity,
         f.sii_economic_sector,
         f.sii_economic_subsector,
         f.sii_taxpayer_type,
         f.sii_activity_start_date,
         f.sii_termination_date,
         f.sii_sales_band,
         f.sii_sales_band_rank,
         f.sii_workers,
         f.sii_activity_count,
         f.sii_address_count,
         f.sii_region_changed,
         f.sii_activity_changed,
         f.sii_signal_count,
         f.entity_age_years,
         f.ownership_edge_count,
         f.legal_entity_partner_count,
         f.societies_as_partner_count,
         f.society_type,
         f.activity_peer_share,
         f.activity_atypicality,
         f.activity_peer_basis,
         f.sanction_event_count,
         f.sanction_event_count_5y,
         f.sanction_last_event_date,
         f.sanction_resolution_refs,
         case when f.sanction_event_count > 0
              then 'CANDIDATO_POR_NOMBRE_NORMALIZADO'
              else 'SIN_EVENTO_ATRIBUIDO_EN_EL_CORTE' end,
         f.source_count,
         f.ipa3_score,
         f.ipa3_band,
         f.ipa3_dominant_mark,
         f.c_vse,
         f.c_hsu,
         f.c_crg,
         f.c_eec,
         f.c_obs,
         f.ipf_score,
         case
           when f.ipf_score is null then 'NO_CALCULABLE'
           when f.ipf_percentile >= 99 then 'MUY_ALTA'
           when f.ipf_percentile >= 95 then 'ALTA'
           when f.ipf_percentile >= 80 then 'MEDIA'
           when f.ipf_percentile >= 50 then 'BAJA'
           else 'MINIMA'
         end,
         round(f.available_weight, 2),
         f.ipf_percentile,
         f.ipf_sector_percentile,
         jsonb_build_array(
           jsonb_build_object(
             'code','VSE','label','Vulnerabilidad sectorial estructural','weight',25,
             'value',f.c_vse,
             'contribution', case when f.available_weight > 0 and f.c_vse is not null
                                  then round(f.c_vse * 25 / f.available_weight, 2) end,
             'basis', case when f.c_vse is null then 'SECTOR_NO_MAPEADO' else 'MAPA_SECTORIAL_IRG_V1' end,
             'evidence', jsonb_build_object('sector', f.uaf_sector,
                                            'sector_canonico', f.sector_canonical_name,
                                            'escala_origen_1_5', case when f.c_vse is not null
                                                                 then round(1 + f.c_vse * 4 / 100, 2) end),
             'reading','Describe el sector obligado, no la conducta de la entidad inscrita.'),
           jsonb_build_object(
             'code','HSU','label','Historial de supervisión UAF','weight',25,
             'value',f.c_hsu,
             'contribution', case when f.available_weight > 0 and f.c_hsu is not null
                                  then round(f.c_hsu * 25 / f.available_weight, 2) end,
             'basis', case when f.sanction_event_count > 0
                           then 'EVENTOS_UAF_ATRIBUIDOS_CANDIDATO_UNICO'
                           else 'SIN_EVENTOS_EN_LA_VENTANA_PUBLICADA' end,
             'evidence', jsonb_build_object('eventos', f.sanction_event_count,
                                            'eventos_5a', f.sanction_event_count_5y,
                                            'ultimo_evento', f.sanction_last_event_date,
                                            'resoluciones', to_jsonb(coalesce(f.sanction_resolution_refs, array[]::text[]))),
             'reading','Sanción administrativa no es delito. La atribución es candidata y no promueve identidad.'),
           jsonb_build_object(
             'code','CRG','label','Coherencia registral UAF ↔ SII','weight',20,
             'value',f.c_crg,
             'contribution', case when f.available_weight > 0 and f.c_crg is not null
                                  then round(f.c_crg * 20 / f.available_weight, 2) end,
             'basis','REGISTROS_PUBLICOS_CONTRASTADOS',
             'evidence', jsonb_build_object('naturaleza', f.subject_nature,
                                            'estado_sii', f.sii_status,
                                            'termino_giro', f.sii_termination_date,
                                            'atipicidad_giro', f.activity_atypicality,
                                            'base_atipicidad', f.activity_peer_basis,
                                            'cambio_region', f.sii_region_changed,
                                            'cambio_giro', f.sii_activity_changed),
             'reading','Una discrepancia entre dos registros públicos no es incumplimiento acreditado.'),
           jsonb_build_object(
             'code','EEC','label','Escala, exposición y complejidad','weight',18,
             'value',f.c_eec,
             'contribution', case when f.available_weight > 0 and f.c_eec is not null
                                  then round(f.c_eec * 18 / f.available_weight, 2) end,
             'basis', case when f.subject_nature = 'PERSONA_NATURAL' then 'PERSONA_NATURAL_SIN_PERFIL_DE_EMPRESA'
                           when f.c_eec is null then 'SIN_PERFIL_TRIBUTARIO_OBSERVABLE'
                           else 'PERFIL_TRIBUTARIO_ULTIMO_CORTE' end,
             'evidence', jsonb_build_object('tramo_ventas', f.sii_sales_band,
                                            'tramo_rank', f.sii_sales_band_rank,
                                            'trabajadores', f.sii_workers,
                                            'aristas_propiedad', f.ownership_edge_count,
                                            'socias_juridicas', f.legal_entity_partner_count,
                                            'participa_en_sociedades', f.societies_as_partner_count,
                                            'antiguedad_anios', f.entity_age_years),
             'reading','Tramo de ventas no es monto exacto. Escala mide exposición supervisable, no riesgo.'),
           jsonb_build_object(
             'code','OBS','label','Brecha de observabilidad','weight',12,
             'value',f.c_obs,
             'contribution', case when f.available_weight > 0 and f.c_obs is not null
                                  then round(f.c_obs * 12 / f.available_weight, 2) end,
             'basis','COBERTURA_DE_FUENTES_DEL_CORTE',
             'evidence', jsonb_build_object('fuentes', f.source_count,
                                            'territorio', f.territory_basis,
                                            'perfil_sii', f.sii_status <> 'SIN_PERFIL_SII',
                                            'corte_padron', f.registry_observed_at),
             'reading','Mide lo que el supervisor no puede ver. Opacidad no es indicio de conducta.')
         ),
         array_remove(array[
           case when f.sii_status = 'TERMINATED_AS_PUBLISHED' then 'TERMINO_GIRO_VIGENTE_EN_PADRON' end,
           case when f.sii_status = 'SIN_PERFIL_SII' and f.subject_nature = 'PERSONA_JURIDICA'
                then 'SIN_PERFIL_SII_EN_PERSONA_JURIDICA' end,
           case when f.subject_nature = 'PERSONA_NATURAL' then 'PERSONA_NATURAL_OBLIGADA' end,
           case when f.activity_atypicality >= 0.90 then 'GIRO_ATIPICO_EN_SECTOR' end,
           case when f.sanction_event_count > 0 then 'HISTORIAL_SANCIONATORIO_UAF' end,
           case when f.sanction_event_count_5y >= 2 then 'REITERACION_5_ANIOS' end,
           case when f.region is null then 'SIN_TERRITORIO_OBSERVADO' end,
           case when coalesce(f.source_count, 0) <= 1 then 'FUENTE_UNICA' end,
           case when f.c_vse >= 80 then 'SECTOR_ALTA_VULNERABILIDAD' end,
           case when f.entity_age_years is not null and f.entity_age_years <= 3 then 'INSCRIPCION_RECIENTE' end,
           case when coalesce(f.legal_entity_partner_count, 0) >= 3
                  or coalesce(f.societies_as_partner_count, 0) >= 5 then 'ESTRUCTURA_SOCIETARIA_COMPLEJA' end,
           case when f.sii_region_changed is true then 'CAMBIO_DE_REGION' end,
           case when f.sii_activity_changed is true then 'CAMBIO_DE_GIRO' end
         ], null),
         'IPF-1.0',
         'SUPERVISORY_PRIORITIZATION_NOT_LAFT_PROBABILITY',
         now()
  from final f;

  get diagnostics subjects = row_count;

  -- C) Lectura del padrón por sector obligado --------------------------------
  delete from public.aml_uaf_obligated_sector_snapshot;

  insert into public.aml_uaf_obligated_sector_snapshot (
    uaf_sector_canonical, uaf_sector_id, registry_labels, subject_count,
    vulnerability_index, ipf_mean, ipf_p90,
    band_muy_alta, band_alta, band_media, band_baja, band_minima,
    sanctioned_subjects, sanction_events, sanction_rate_per_100,
    sii_active, sii_terminated, sii_absent, sii_coverage_pct,
    atypical_activity_subjects, natural_person_subjects, median_sales_band_rank,
    top_region, top_region_share_pct, refreshed_at
  )
  with agg as (
    select s.uaf_sector_canonical,
           min(s.uaf_sector_id) as uaf_sector_id,
           array_remove(array_agg(distinct s.uaf_sector), null) as registry_labels,
           count(*)::integer as subject_count,
           max(s.sector_vulnerability) as vulnerability_index,
           round(avg(s.ipf_score), 2) as ipf_mean,
           round(percentile_cont(0.90) within group (order by s.ipf_score)::numeric, 2) as ipf_p90,
           count(*) filter (where s.ipf_band = 'MUY_ALTA')::integer as band_muy_alta,
           count(*) filter (where s.ipf_band = 'ALTA')::integer     as band_alta,
           count(*) filter (where s.ipf_band = 'MEDIA')::integer    as band_media,
           count(*) filter (where s.ipf_band = 'BAJA')::integer     as band_baja,
           count(*) filter (where s.ipf_band = 'MINIMA')::integer   as band_minima,
           count(*) filter (where s.sanction_event_count > 0)::integer as sanctioned_subjects,
           coalesce(sum(s.sanction_event_count), 0)::integer as sanction_events,
           count(*) filter (where s.sii_status not in ('SIN_PERFIL_SII','TERMINATED_AS_PUBLISHED'))::integer as sii_active,
           count(*) filter (where s.sii_status = 'TERMINATED_AS_PUBLISHED')::integer as sii_terminated,
           count(*) filter (where s.sii_status = 'SIN_PERFIL_SII')::integer as sii_absent,
           count(*) filter (where s.activity_atypicality >= 0.90)::integer as atypical_activity_subjects,
           count(*) filter (where s.subject_nature = 'PERSONA_NATURAL')::integer as natural_person_subjects,
           round(percentile_cont(0.50) within group (order by s.sii_sales_band_rank)::numeric, 1) as median_sales_band_rank
    from public.aml_uaf_obligated_subject_snapshot s
    group by s.uaf_sector_canonical
  ),
  top_region as (
    select distinct on (uaf_sector_canonical)
           uaf_sector_canonical, region, count(*)::numeric as n
    from public.aml_uaf_obligated_subject_snapshot
    where region is not null
    group by uaf_sector_canonical, region
    order by uaf_sector_canonical, count(*) desc, region
  )
  select a.uaf_sector_canonical,
         a.uaf_sector_id,
         a.registry_labels,
         a.subject_count,
         a.vulnerability_index,
         a.ipf_mean,
         a.ipf_p90,
         a.band_muy_alta, a.band_alta, a.band_media, a.band_baja, a.band_minima,
         a.sanctioned_subjects,
         a.sanction_events,
         case when a.subject_count > 0
              then round(a.sanction_events::numeric * 100 / a.subject_count, 2) end,
         a.sii_active,
         a.sii_terminated,
         a.sii_absent,
         case when a.subject_count > 0
              then round((a.subject_count - a.sii_absent)::numeric * 100 / a.subject_count, 2) end,
         a.atypical_activity_subjects,
         a.natural_person_subjects,
         a.median_sales_band_rank,
         tr.region,
         case when a.subject_count > 0 and tr.n is not null
              then round(tr.n * 100 / a.subject_count, 2) end,
         now()
  from agg a
  left join top_region tr on tr.uaf_sector_canonical = a.uaf_sector_canonical;

  get diagnostics sectors = row_count;

  perform public.refresh_aml_uaf_obligated_overview_0560();

  return jsonb_build_object('sanction_links', links,
                            'obligated_subjects', subjects,
                            'obligated_sectors', sectors);
end;
$function$;

-- ---------------------------------------------------------------------------
-- 8. Panorama del padrón en una sola lectura
-- ---------------------------------------------------------------------------
-- Sin esta tabla, dibujar el panorama obliga al navegador a traer las 9.782
-- filas del padrón sólo para contar bandas, brechas y territorios. Una fila
-- con el documento ya agregado deja la apertura de la sección en una consulta.
create table if not exists public.aml_uaf_obligated_overview_snapshot (
  snapshot_key text primary key default 'CURRENT',
  payload      jsonb not null,
  refreshed_at timestamptz not null default now()
);

comment on table public.aml_uaf_obligated_overview_snapshot is
  'Carga única del panorama de Sujetos Obligados. Toda cifra que declara proviene del mismo corte que aml_uaf_obligated_subject_snapshot.';

alter table public.aml_uaf_obligated_overview_snapshot enable row level security;
revoke all on public.aml_uaf_obligated_overview_snapshot from anon;
grant select on public.aml_uaf_obligated_overview_snapshot to authenticated;
drop policy if exists aml_uaf_obligated_overview_snapshot_allowed_read on public.aml_uaf_obligated_overview_snapshot;
create policy aml_uaf_obligated_overview_snapshot_allowed_read
  on public.aml_uaf_obligated_overview_snapshot for select
  using (exists (select 1 from public.aml_allowed_users au
                 where au.user_id = (select auth.uid()) and au.enabled));

create or replace function public.refresh_aml_uaf_obligated_overview_0560()
returns integer
language plpgsql
set search_path to 'public'
as $function$
declare doc jsonb;
begin
  select jsonb_build_object(
    'schema', 'ATLAS_UAF_OBLIGATED_OVERVIEW_V1',
    'index_version', 'IPF-1.0',
    'registry', (
      select jsonb_build_object(
        'subjects', count(*),
        'sectors', count(distinct uaf_sector_canonical),
        'legal_persons', count(*) filter (where subject_nature = 'PERSONA_JURIDICA'),
        'natural_persons', count(*) filter (where subject_nature = 'PERSONA_NATURAL'),
        'observed_at', max(registry_observed_at),
        'source_ref', min(registry_source_ref),
        'refreshed_at', max(refreshed_at))
      from public.aml_uaf_obligated_subject_snapshot),
    'sii', (
      select jsonb_build_object(
        'active', count(*) filter (where sii_status = 'ACTIVE_AS_PUBLISHED'),
        'terminated', count(*) filter (where sii_status = 'TERMINATED_AS_PUBLISHED'),
        'absent', count(*) filter (where sii_status = 'SIN_PERFIL_SII'),
        'coverage_pct', round(count(*) filter (where sii_status <> 'SIN_PERFIL_SII')::numeric * 100 / nullif(count(*), 0), 2))
      from public.aml_uaf_obligated_subject_snapshot),
    'bands', (
      select jsonb_object_agg(ipf_band, n)
      from (select ipf_band, count(*) n from public.aml_uaf_obligated_subject_snapshot group by 1) b),
    'supervision', (
      select jsonb_build_object(
        'events_total', count(*),
        'events_attributed', count(*) filter (where resolution_status = 'CANDIDATO_UNICO'),
        'events_ambiguous', count(*) filter (where resolution_status = 'CANDIDATO_AMBIGUO'),
        'events_unmatched', count(*) filter (where resolution_status = 'SIN_CANDIDATO_EN_PADRON'),
        'subjects_with_history', (select count(*) from public.aml_uaf_obligated_subject_snapshot where sanction_event_count > 0),
        'subjects_repeat_5y', (select count(*) from public.aml_uaf_obligated_subject_snapshot where sanction_event_count_5y >= 2),
        'first_event', min(event_date),
        'last_event', max(event_date))
      from public.aml_uaf_sanction_subject_link_snapshot),
    'gaps', (
      select jsonb_agg(g order by g->>'ord')
      from (
        select jsonb_build_object('ord','1','code','TERMINO_GIRO_VIGENTE_EN_PADRON',
                 'label','Término de giro publicado en SII, inscripción vigente en el padrón',
                 'count', count(*) filter (where sii_status = 'TERMINATED_AS_PUBLISHED'),
                 'reading','Discrepancia entre dos registros públicos. No acredita incumplimiento ni baja del registro.') g
          from public.aml_uaf_obligated_subject_snapshot
        union all
        select jsonb_build_object('ord','2','code','GIRO_ATIPICO_EN_SECTOR',
                 'label','Giro declarado atípico dentro de su propio sector obligado',
                 'count', count(*) filter (where activity_atypicality >= 0.90),
                 'reading','Rareza observada entre pares del sector. No es incumplimiento.')
          from public.aml_uaf_obligated_subject_snapshot
        union all
        select jsonb_build_object('ord','3','code','SIN_TERRITORIO_OBSERVADO',
                 'label','Sin territorio observable en el corte',
                 'count', count(*) filter (where region is null),
                 'reading','Limita la asignación territorial de la fiscalización.')
          from public.aml_uaf_obligated_subject_snapshot
        union all
        select jsonb_build_object('ord','4','code','FUENTE_UNICA',
                 'label','Observado por una sola fuente',
                 'count', count(*) filter (where coalesce(source_count, 0) <= 1),
                 'reading','El padrón es la única evidencia disponible sobre el sujeto.')
          from public.aml_uaf_obligated_subject_snapshot
        union all
        select jsonb_build_object('ord','5','code','CAMBIO_DE_GIRO',
                 'label','Cambio de giro en el último año comercial observado',
                 'count', count(*) filter (where sii_activity_changed is true),
                 'reading','Cambio declarado ante el SII. Es un hecho registral, no una señal AML.')
          from public.aml_uaf_obligated_subject_snapshot
        union all
        select jsonb_build_object('ord','6','code','CAMBIO_DE_REGION',
                 'label','Cambio de región en el último año comercial observado',
                 'count', count(*) filter (where sii_region_changed is true),
                 'reading','Cambio declarado ante el SII. Es un hecho registral, no una señal AML.')
          from public.aml_uaf_obligated_subject_snapshot
        union all
        select jsonb_build_object('ord','7','code','ESTRUCTURA_SOCIETARIA_COMPLEJA',
                 'label','Estructura societaria declarada compleja',
                 'count', count(*) filter (where coalesce(legal_entity_partner_count, 0) >= 3
                                              or coalesce(societies_as_partner_count, 0) >= 5),
                 'reading','Complejidad describe la estructura declarada, no su licitud.')
          from public.aml_uaf_obligated_subject_snapshot
      ) q),
    'regions', (
      select jsonb_agg(r order by (r->>'subjects')::integer desc)
      from (
        select jsonb_build_object(
                 'region', coalesce(region, 'Sin territorio observado'),
                 'subjects', count(*)::integer,
                 'priority', count(*) filter (where ipf_band in ('MUY_ALTA','ALTA'))::integer,
                 'terminated', count(*) filter (where sii_status = 'TERMINATED_AS_PUBLISHED')::integer,
                 'sanctioned', count(*) filter (where sanction_event_count > 0)::integer) r
        from public.aml_uaf_obligated_subject_snapshot
        group by coalesce(region, 'Sin territorio observado')
      ) x),
    'sanction_years', (
      select jsonb_agg(y order by (y->>'year')::integer)
      from (
        select jsonb_build_object(
                 'year', extract(year from event_date)::integer,
                 'events', count(*)::integer,
                 'attributed', count(*) filter (where resolution_status = 'CANDIDATO_UNICO')::integer) y
        from public.aml_uaf_sanction_subject_link_snapshot
        where event_date is not null
        group by extract(year from event_date)::integer
      ) z),
    'watchlist', (
      select jsonb_agg(w)
      from (
        select jsonb_build_object(
                 'rut', rut, 'name', coalesce(registry_name, entity_name),
                 'sector', uaf_sector_canonical, 'region', region,
                 'ipf', ipf_score, 'band', ipf_band, 'percentile', ipf_percentile,
                 'events', sanction_event_count, 'flags', to_jsonb(ipf_flags)) w
        from public.aml_uaf_obligated_subject_snapshot
        order by ipf_score desc nulls last
        limit 12
      ) v)
  ) into doc;

  insert into public.aml_uaf_obligated_overview_snapshot(snapshot_key, payload, refreshed_at)
  values('CURRENT', doc, now())
  on conflict(snapshot_key) do update
    set payload = excluded.payload, refreshed_at = excluded.refreshed_at;

  return 1;
end;
$function$;

-- Disparo condicional propio, con la misma disciplina del 0510: una falla aquí
-- no puede arrastrar los snapshots de los que depende el resto del portal.
create or replace function public.refresh_aml_uaf_obligated_if_stale_0560()
returns text
language plpgsql
set search_path to 'public'
as $function$
declare
  own_at    timestamptz;
  source_at timestamptz;
  result    jsonb;
begin
  if not pg_try_advisory_xact_lock(8142, 5600) then
    return 'SKIPPED_LOCKED';
  end if;

  select updated_at into own_at from public.aml_sync_state where pipeline = 'UAF_OBLIGATED_0560';
  select max(updated_at) into source_at from public.aml_sync_state
   where pipeline in ('AML_MAIN','SII_ENTITY_YEAR','SANCTION_IDENTITY','UAF_SECTOR_PROFILE');

  if source_at is null then return 'NO_SOURCE_SEAL'; end if;
  if own_at is not null and own_at >= source_at then return 'CURRENT'; end if;

  result := public.refresh_aml_uaf_obligated_subjects_0560();

  insert into public.aml_sync_state(pipeline, status, detail, updated_at)
  values('UAF_OBLIGATED_0560','SUCCESS',
         jsonb_build_object('version','0.56.0','build','0560','rows',result,
                            'index_version','IPF-1.0',
                            'refresh_mode','PG_CRON_CONDITIONAL_LOCKED',
                            'source_max_updated_at', source_at),
         now())
  on conflict(pipeline) do update
    set status = excluded.status, detail = excluded.detail, updated_at = excluded.updated_at;

  return 'REFRESHED ' || result::text;
exception when others then
  insert into public.aml_sync_state(pipeline, status, detail, updated_at)
  values('UAF_OBLIGATED_0560','ERROR',
         jsonb_build_object('version','0.56.0','build','0560','error', left(sqlerrm, 300)),
         now())
  on conflict(pipeline) do update
    set status = excluded.status, detail = excluded.detail, updated_at = excluded.updated_at;
  raise;
end;
$function$;

-- Programación (fuera de la transacción, idempotente):
--   select cron.schedule('aml-uaf-obligated-0560-if-stale','*/20 * * * *',
--                        'select public.refresh_aml_uaf_obligated_if_stale_0560();');
