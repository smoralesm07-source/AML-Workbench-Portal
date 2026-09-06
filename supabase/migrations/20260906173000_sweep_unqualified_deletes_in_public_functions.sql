-- Schema-wide sweep of the safeupdate hazard already fixed in the OSFL chain
-- by 20260906170500 and 20260906171500.
--
-- The authenticator role preloads safeupdate (session_preload_libraries =
-- supautils, safeupdate), which aborts any unqualified DELETE with 21000. It is
-- a session hook, not a permission check, so it fires inside SECURITY DEFINER
-- functions and applies to every statement reaching Postgres through PostgREST.
-- Functions invoked by pg_cron run as postgres and never hit it, which is why
-- these kept working: the failure only appears when a pipeline calls them over
-- rpc/, and then it is total, as OSFL showed for 19 days.
--
-- "delete from t where true" is semantically identical to "delete from t" (the
-- planner folds the constant qual away) and satisfies the guard. The pattern
-- only matches a table name followed directly by ";", so DELETEs that already
-- carry a WHERE clause are untouched. Unqualified UPDATEs were checked in the
-- same pass: there are none.
--
-- Idempotent: a second run finds no unqualified DELETE and patches nothing.
do $sweep$
declare
  fn record;
  src text;
  patched text;
  n_before integer;
  n_after integer;
  n_true_before integer;
  n_true_after integer;
  total_fn integer := 0;
  total_stmt integer := 0;
begin
  for fn in
    select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_language l on l.oid = p.prolang
    where n.nspname = 'public'
      and p.prokind = 'f'
      and l.lanname in ('plpgsql', 'sql')
      and pg_get_functiondef(p.oid) ~* 'delete\s+from\s+[a-zA-Z0-9_."]+\s*;'
    order by p.proname
  loop
    src := pg_get_functiondef(fn.oid);

    select count(*) into n_before
      from regexp_matches(src, 'delete\s+from\s+[a-zA-Z0-9_."]+\s*;', 'gi');
    select count(*) into n_true_before
      from regexp_matches(src, 'delete\s+from\s+[a-zA-Z0-9_."]+\s+where\s+true\s*;', 'gi');

    patched := regexp_replace(
      src,
      '(delete\s+from\s+[a-zA-Z0-9_."]+)\s*;',
      '\1 where true;',
      'gi'
    );

    select count(*) into n_after
      from regexp_matches(patched, 'delete\s+from\s+[a-zA-Z0-9_."]+\s*;', 'gi');
    select count(*) into n_true_after
      from regexp_matches(patched, 'delete\s+from\s+[a-zA-Z0-9_."]+\s+where\s+true\s*;', 'gi');

    if n_after <> 0 then
      raise exception 'sweep: %(%) still carries % unqualified DELETE after patch',
        fn.proname, fn.args, n_after;
    end if;

    if n_true_after - n_true_before <> n_before then
      raise exception 'sweep: %(%) expected % newly guarded DELETE, got %',
        fn.proname, fn.args, n_before, n_true_after - n_true_before;
    end if;

    execute patched;

    total_fn := total_fn + 1;
    total_stmt := total_stmt + n_before;
    raise notice 'patched %(%): % statement(s)', fn.proname, fn.args, n_before;
  end loop;

  raise notice 'sweep complete: % function(s), % statement(s)', total_fn, total_stmt;
end
$sweep$;
