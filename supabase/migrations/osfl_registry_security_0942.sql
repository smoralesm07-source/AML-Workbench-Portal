-- ATLAS OSFL Registry 0.94.2 · advisor hardening.
alter function public.aml_norm_osfl_registry_text_0940(text) set search_path=pg_catalog;
comment on table public.aml_osfl_registry_stage is 'Ingestion-only staging. RLS has intentionally no user policy; access is service_role through the OIDC-protected Edge Function.';
