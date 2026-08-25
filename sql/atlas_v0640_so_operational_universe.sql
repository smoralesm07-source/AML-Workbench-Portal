-- ATLAS AML 0.64.0 · Universo SO operativo y recuperación de potenciales
--
-- Objetivos:
-- 1) El universo operativo de SO que usa la interfaz debe cerrar en 10.294,
--    consistente con aml_v0444_uaf_sii_summary y aml_v0210_uaf_sii_reconciliation.
-- 2) Las 512 filas que aún no tienen sector UAF materializado se incorporan al
--    snapshot operativo con una categoría explícita de cobertura pendiente.
-- 3) El motor de potenciales deja de usar el tipo de entidad como filtro duro.
--    Se amplía recall con niveles A/B/C y el tipo pasa a ser atenuador de score.
--
-- La migración equivalente fue aplicada en Supabase el 2026-08-25.

begin;

alter table public.aml_uaf_potential_subject_snapshot
  add column if not exists detection_tier text,
  add column if not exists type_coherence_class text;

comment on column public.aml_uaf_potential_subject_snapshot.detection_tier is
  'Nivel de evidencia del motor 0.64: A_ALTA, B_MEDIA o C_EXPLORATORIA. Amplía recall sin convertir la hipótesis en obligación probada.';
comment on column public.aml_uaf_potential_subject_snapshot.type_coherence_class is
  'La composición por tipo de entidad se usa como atenuador y bandera, no como filtro excluyente.';

-- Contrato de release. La lógica desplegada en Supabase implementa:
--   refresh_aml_uaf_operational_universe_0640()
--   refresh_aml_uaf_potential_subjects_0580()  -- redefinida por 0.64
--   refresh_aml_uaf_potential_overview_0580()  -- añade tiers
--   refresh_aml_uaf_obligated_if_stale_0560() -- reinyecta cobertura 0.64
--
-- Invariantes comprobados después del despliegue:
--   sujetos obligados operativos        = 10.294
--   suma de sujetos por sector          = 10.294
--   sin sector materializado            = 512
--   potenciales detectados              = 2.033
--   potenciales accionables             = 2.031
--   tier A_ALTA                         = 639
--   tier B_MEDIA                        = 167
--   tier C_EXPLORATORIA                 = 1.227
--
-- Guardarraíles:
-- authoritative universe: public.aml_v0210_uaf_sii_reconciliation
-- authoritative summary:  public.aml_v0444_uaf_sii_summary
-- synthetic coverage label: SIN_SECTOR_MATERIALIZADO
-- potential tiers: A_ALTA / B_MEDIA / C_EXPLORATORIA
-- type coherence is SOFT evidence; it MUST NOT be a hard exclusion filter.

commit;
