drop policy if exists atlas_v2_e2e_principal_deny_all on public.atlas_v2_e2e_principal;
create policy atlas_v2_e2e_principal_deny_all
on public.atlas_v2_e2e_principal
for all
to public
using (false)
with check (false);

revoke all on table public.atlas_v2_e2e_principal from public, anon, authenticated;
