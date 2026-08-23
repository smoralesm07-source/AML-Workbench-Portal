-- ATLAS AML 0.46.0 · build 0460 · higiene de esquema.

-- 1. public_integrity_month_coverage tenía 49 filas de datos reales pero RLS
--    habilitado sin ninguna política, de modo que era ilegible para todos.
--    No se toca el dato: se le da la misma política de lectura que el resto
--    de las tablas del dominio.
drop policy if exists public_integrity_month_coverage_allowed_read
  on public.public_integrity_month_coverage;
create policy public_integrity_month_coverage_allowed_read
  on public.public_integrity_month_coverage for select
  using (exists (select 1 from public.aml_allowed_users au
                 where au.user_id = (select auth.uid()) and au.enabled));

-- 2. Tablas ajenas al dominio AML, residuo de otro proyecto en la misma base.
--    Verificadas con 0 filas antes de eliminar. Sin dependencias en el esquema
--    AML ni presencia en ninguna vista.
drop table if exists public."Children" cascade;
drop table if exists public."Pets" cascade;
drop table if exists public."Task" cascade;
drop table if exists public."Users" cascade;
