# ATLAS Architecture v2

**Status:** foundation implemented in parallel; production routes remain on the current runtime until each module passes contract, performance and regression gates.

## 1. Objective

ATLAS v2 separates source ingestion, normalization, canonical Fusion data, analytical computation, read-model publication and analyst interaction. Heavy computation must not occur on the interactive request path.

Canonical flow:

`SOURCE -> LANDING -> NORMALIZE -> FUSION -> ANALYTICS -> READ MODEL -> READ API -> ATLAS -> DRILL-DOWN`

The migration is incremental. No big-bang rewrite, no duplicated source of truth and no permanent `fix/hardening/authority` layer when a module is migrated.

## 2. Engineering rules

1. **Compute, publish, display.** Interactive routes consume precomputed/versioned read models whenever a result can be materialized ahead of time.
2. **Snapshot atomicity.** Every read model declares `snapshot_id`, `model_version`, `generated_at`, `source_versions` and `payload_checksum`.
3. **Thin browser.** The frontend manages navigation, filters, presentation and drill-down; it does not reconstruct analytical universes through large client-side joins.
4. **Read/write separation.** Pipeline/service credentials may ingest and materialize, but end-user reads use the analyst JWT and remain subject to RLS.
5. **Stable contracts.** A screen consumes a named contract, not implementation tables. Contract changes require a new model version.
6. **Asynchronous heavy work.** Jobs that are not interactive are queued. PGMQ is the initial durable queue; no external broker is required.
7. **Fail closed for authorization, fail soft for presentation.** Missing/slow secondary components may render as unavailable when the contract permits it, but authorization never degrades.
8. **Observable by default.** Reads expose a `trace_id`, `Server-Timing`, snapshot identity and structured telemetry.
9. **Deletion of legacy authority is part of migration.** A v2 module is not complete while the old renderer/loader remains an active competing authority.

## 3. Implemented foundation

### Database

- `public.atlas_v2_read_model`: immutable-by-contract materialized payloads keyed by model, scope, snapshot and model version.
- `public.atlas_v2_model_head`: pointer to the currently publishable model revision.
- `public.atlas_v2_client_event`: trace/performance events from authenticated analyst reads.
- `public.atlas_v2_get_read_model(model, scope)`: `SECURITY INVOKER` read contract; RLS remains authoritative.
- `public.atlas_v2_materialize_public_spend_overview(snapshot)`: first materializer. It reads already-materialized `ps_*` metrics and never scans `provider_analyzer.pair_month` on the analyst request path.
- `pgmq` + durable queue `atlas_v2_jobs`.
- `public.atlas_v2_enqueue_job(...)` and `public.atlas_v2_process_jobs(...)`, executable only by `service_role`.

### Read API

Edge Function: `atlas-v2-read`.

- `verify_jwt=true`.
- End-user Authorization token is forwarded to Supabase; no service-role key is used to serve analyst reads.
- Initial allowlist: `public_spend_overview`.
- Response contract: `ATLAS_READ_API_V2`.
- Supports `ETag`/`If-None-Match` for unchanged snapshots.
- Emits `x-atlas-trace-id`, `x-atlas-snapshot` and `Server-Timing`.
- Telemetry is fail-soft and is not on the response critical path.

## 4. First vertical slice: Gasto Público

The current public-spend analytical snapshot remains the computation source. v2 publishes a compact overview containing:

- 12-month summary and source coverage;
- finding totals, families and severity;
- top 30 findings;
- top 20 suppliers;
- top 20 buyers;
- top 20 buyer-supplier pairs;
- hypothesis/source readiness;
- methodological guardrail.

The first materialized payload for `PS-2026-07-V1` is approximately 69 KB. PostgreSQL retrieval of the published model measured about 4 ms in the initial `EXPLAIN ANALYZE`, versus tens of seconds for previous large analytical rebuilds over the operational pair history.

## 5. Target module boundary

Each migrated module should converge on this shape:

```
module/
  contract
  data-client
  view-state
  view
  charts
  drilldown
  tests
```

A module may use direct Supabase table reads only for bounded/simple drill-downs with an explicit query budget. Aggregate dashboards and dossiers should prefer read models.

## 6. Performance gates

Initial targets (to be measured under authenticated production-like sessions):

- read-model PostgreSQL lookup: p95 <= 50 ms;
- read API server execution: p95 <= 300 ms excluding client network;
- initial usable module render: p95 <= 1.5 s;
- no interactive query with an expected full scan of a multi-million-row operational table;
- bounded payload per overview contract, target <= 250 KB before compression;
- every route read must expose snapshot and trace identifiers.

These are engineering SLOs, not analytical guarantees.

## 7. Migration sequence

1. **Gasto Público** — first v2 consumer and performance reference.
2. **Entidad 360** — replace multi-source browser orchestration with a dossier read model plus bounded drill-down contracts.
3. **OSFL** — one current renderer and one data contract; retire 0.92/0.93/legacy recovery authorities after parity testing.
4. **Sanciones** — canonical event/timeline read models and sector aggregates.
5. **Universo SO / Reportabilidad** — separate registry facts, inferred obligation evidence and analyst workflow state.
6. **Territorio** — precomputed contextual aggregates, never inherited as entity risk.
7. **Inicio / cross-module overview** — assembled only from model heads, never from raw producer tables.

## 8. Release gates for migrating a module

A v2 module can replace its current route only when all are true:

- contract/schema validation passes;
- authorization/RLS tests pass;
- current-vs-v2 analytical parity checks pass for declared metrics;
- p95 latency and payload budgets pass;
- browser E2E route test passes;
- stale-response/race test passes;
- rollback path is documented;
- the previous competing runtime authority is removed from the production manifest in the same migration or immediately after a controlled compatibility window.

## 9. What remains intentionally unchanged in this foundation

- GitHub Pages remains the frontend host.
- Microsoft Entra + Supabase Auth remain the authentication mechanism.
- Existing Fusion/source tables remain the canonical analytical inputs.
- Current ATLAS production routes continue untouched until v2 consumers are validated.
- Existing Provider Analyzer ingestion remains operational; its ingest/query contract split will be tightened in a later infrastructure slice.

## 10. Next engineering slice

Connect the Gasto Público route on the v2 branch to `AtlasV2Data.readModel('public_spend_overview')`, add authenticated E2E tests and compare visual/analytical parity against the current GP implementation. Once those gates pass, switch only that route to v2 and remove its legacy competing loaders.