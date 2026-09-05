-- Cover atlas_v2_model_head -> atlas_v2_read_model FK for parent maintenance.
create index if not exists atlas_v2_model_head_read_model_fk_idx
  on public.atlas_v2_model_head(model_key, scope_key, snapshot_id, model_version);
