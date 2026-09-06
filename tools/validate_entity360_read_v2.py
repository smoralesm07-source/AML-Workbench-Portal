#!/usr/bin/env python3
from pathlib import Path

js = Path('assets/atlas-entity360-resilience-0964.js').read_text(encoding='utf-8')
sql = Path('supabase/migrations/20260906082500_atlas_entity360_read_v2.sql').read_text(encoding='utf-8')

assert "READ_RPC='atlas_entity360_read_v2'" in js
assert "AGGREGATED_RPC_V2" in js
assert "LEGACY_FANOUT_FALLBACK" in js
assert "RPC_TIMEOUT" in js
assert "client.rpc(READ_RPC" in js
assert "security invoker" in sql.lower()
assert "grant execute on function public.atlas_entity360_read_v2(text) to authenticated" in sql.lower()
assert "revoke execute on function public.atlas_entity360_read_v2(text) from anon" in sql.lower()
print('Entidad 360 aggregated read v2 contract OK')
