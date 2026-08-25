-- Cierre de exposición detectada por Supabase advisor en tabla auxiliar UAF.
alter table public.aml_uaf_reporting_sector_alias_0620 enable row level security;
revoke all on public.aml_uaf_reporting_sector_alias_0620 from anon;
revoke all on public.aml_uaf_reporting_sector_alias_0620 from authenticated;
grant select on public.aml_uaf_reporting_sector_alias_0620 to authenticated;
grant all on public.aml_uaf_reporting_sector_alias_0620 to service_role;
drop policy if exists aml_uaf_reporting_sector_alias_0620_allowed_read on public.aml_uaf_reporting_sector_alias_0620;
create policy aml_uaf_reporting_sector_alias_0620_allowed_read
on public.aml_uaf_reporting_sector_alias_0620
for select to authenticated
using (exists (
  select 1 from public.aml_allowed_users au
  where au.user_id=(select auth.uid()) and au.enabled
));
