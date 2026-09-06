-- The authenticator role preloads safeupdate (session_preload_libraries =
-- supautils, safeupdate), which aborts any unqualified DELETE with
-- 21000: DELETE requires a WHERE clause. The guard is a session hook, not a
-- permission check, so it fires inside SECURITY DEFINER functions too.
--
-- finalize_aml_osfl_profile_v0711 rebuilds aml_osfl_profile from staging and
-- truncates it first with a bare DELETE, so every finalize failed. Staged rows
-- kept arriving and never got promoted: aml_osfl_profile served data from
-- 2026-08-18 while a newer snapshot waited in aml_osfl_profile_stage_v0712.
--
-- The function was created directly against the database and is not versioned
-- in any migration, so this patches the live definition in place rather than
-- restating a body that has no tracked source.
do $patch$
declare
  src text;
  patched text;
  needle constant text := 'delete from public.aml_osfl_profile;';
  replacement constant text := 'delete from public.aml_osfl_profile where true;';
begin
  select pg_get_functiondef(p.oid) into src
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'finalize_aml_osfl_profile_v0711';

  if src is null then
    raise exception 'finalize_aml_osfl_profile_v0711 not found';
  end if;

  if position(needle in src) = 0 then
    raise exception 'unqualified DELETE not found: already patched or definition drifted';
  end if;

  patched := replace(src, needle, replacement);
  execute patched;
end
$patch$;
