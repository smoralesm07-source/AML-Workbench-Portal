#!/usr/bin/env python3
from pathlib import Path

js = Path('assets/atlas-entity360-resilience-0964.js').read_text(encoding='utf-8')
sql = Path('supabase/migrations/20260906082450_atlas_v2_entity360_single_read_backend.sql').read_text(encoding='utf-8')
fast = Path('supabase/migrations/20260906083150_atlas_v2_entity360_fast_spend_read.sql').read_text(encoding='utf-8')

assert "READ_RPC='atlas_v2_entity360_read'" in js
assert "SINGLE_READ_V2" in js
assert "PARALLEL_FALLBACK" in js
assert "READ_TIMEOUT=1400" in js
assert "client.rpc(READ_RPC" in js
assert "security invoker" in sql.lower()
assert "grant execute on function public.atlas_v2_entity360_read(text,text) to authenticated, service_role" in sql.lower()
assert "revoke all on function public.atlas_v2_entity360_read(text,text) from public, anon" in sql.lower()
assert "aml_mv_gp12_supplier_entity_id_idx" in fast
assert "from public.aml_mv_gp12_supplier" in fast
print('Entidad 360 single-read v2 contract OK')
