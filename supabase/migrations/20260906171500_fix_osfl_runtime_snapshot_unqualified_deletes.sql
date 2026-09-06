-- Same safeupdate guard as 20260906170500: an unqualified DELETE aborts with
-- 21000 when the statement reaches Postgres through PostgREST, because the
-- authenticator role preloads safeupdate as a session hook.
--
-- Patching finalize_aml_osfl_profile_v0711 alone left the chain broken: it
-- calls refresh_aml_osfl_runtime_snapshots, which calls
-- refresh_aml_osfl_region_runtime_snapshot, and both truncate their snapshot
-- table with a bare DELETE.
--
-- "where true" is semantically identical and satisfies the guard. The pattern
-- only matches statements ending in ";" straight after the table name, so
-- DELETEs that already carry a WHERE clause are left untouched.
do $patch$
declare
  fn record;
  src text;
  patched text;
  n_before integer;
begin
  for fn in
    select p.oid, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'refresh_aml_osfl_runtime_snapshots',
        'refresh_aml_osfl_region_runtime_snapshot'
      )
  loop
    src := pg_get_functiondef(fn.oid);

    select count(*) into n_before
    from regexp_matches(src, 'delete\s+from\s+[a-zA-Z0-9_."]+\s*;', 'gi');

    if n_before = 0 then
      raise notice 'no unqualified DELETE in %, skipping', fn.proname;
      continue;
    end if;

    patched := regexp_replace(
      src,
      '(delete\s+from\s+[a-zA-Z0-9_."]+)\s*;',
      '\1 where true;',
      'gi'
    );

    execute patched;
    raise notice 'patched % (% unqualified DELETE)', fn.proname, n_before;
  end loop;
end
$patch$;
