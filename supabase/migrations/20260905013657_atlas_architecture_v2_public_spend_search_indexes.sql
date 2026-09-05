create extension if not exists pg_trgm with schema extensions;

create index if not exists ps_supplier_metric_label_trgm_idx
  on public.ps_supplier_metric using gin ((coalesce(supplier_label,'')) extensions.gin_trgm_ops);

create index if not exists ps_supplier_metric_id_trgm_idx
  on public.ps_supplier_metric using gin (supplier_id extensions.gin_trgm_ops);

create index if not exists ps_buyer_metric_label_trgm_idx
  on public.ps_buyer_metric using gin ((coalesce(buyer_label,'')) extensions.gin_trgm_ops);

create index if not exists ps_buyer_metric_id_trgm_idx
  on public.ps_buyer_metric using gin (buyer_id extensions.gin_trgm_ops);