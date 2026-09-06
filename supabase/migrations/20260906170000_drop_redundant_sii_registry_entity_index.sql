-- aml_sii_registry_company_entity_idx is btree(entity_id), identical in column
-- and method to the unique index aml_sii_registry_company_entity_id_key.
-- The unique index serves every lookup the plain one would, so the duplicate
-- only cost storage: 184 MB on a project that had governed writes disabled
-- under ATLAS_DATABASE_RECOVERY_LOCKDOWN for storage/WAL pressure.
drop index if exists public.aml_sii_registry_company_entity_idx;
