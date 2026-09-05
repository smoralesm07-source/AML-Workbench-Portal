# ATLAS Architecture v2

**Status:** foundation + first full data boundary implemented in parallel. Production routes remain on the current runtime until each module passes contract, security, performance and regression gates.

## 1. Objective

ATLAS v2 separates source ingestion, normalization, canonical Fusion data, analytical computation, read-model publication and analyst interaction. Heavy computation must not occur on the interactive request path.

Canonical flow:

`SOURCE -> LANDING -> NORMALIZE -> FUSION -> ANALYTICS -> READ MODEL -> READ API -> ATLAS -> DRILL-DOWN`

The migration is incremental. No big-bang rewrite, no duplicated source of truth and no permanent `fix/hardening/authority` layer when a module is migrated.

## 2. Engineering rules

1. **Compute, publish, display.** Interactive routes consume precomputed/versioned read models whenever a result can be materialized ahead of time.
2. **Snapshot atomicity.** Every read model declares `snapshot_id`, `model_version`, `generated_at`, `source_versions` and `payload_checksum`.
3. **Thin browser.** The frontend manages navigation, filters, presentation and drill-down; it does not reconstruct analytical universes through large client-side joins.
4. **Read/write separation.** Pipeline/service credentials may ingest and materialize, but end-user reads use the analyst JWT and remain subject to authorization controls.
5. **Stable contracts.** A screen consumes a named contract, not implementation tables. Contract changes require a new model version.
6. **Asynchronous heavy work.** Jobs that are not interactive are queued. PGMQ is the initial durable queue; no external broker is required.
7. **Fail closed for authorization, fail soft for presentation.** Missing/slow secondary components may render as unavailable when the contract permits it, but authorization never degrades.
8. **Observable by default.** Reads expose a `trace_id`, `Server-Timing`, snapshot identity and structured telemetry.
9. **Deletion of legacy authority is part of migration.** A v2 module is not complete while the old renderer/loader remains an active competing authority.
10. **Different source universes stay explicit.** ATLAS may connect sources analytically without pretending their amounts, populations or grains are directly comparable.

## 3. Implemented foundation

### Database and jobs

- `public.atlas_v2_read_model`: versioned published payloads keyed by model, scope, snapshot and model version.
- `public.atlas_v2_model_head`: pointer to the currently publishable model revision.
- `public.atlas_v2_client_event`: trace/performance events from authenticated analyst reads; 30-day retention.
- `public.atlas_v2_get_read_model(model, scope)`: `SECURITY INVOKER` read contract.
- `pgmq` durable queue `atlas_v2_jobs` + `pg_cron` worker.
- completeness guard for public-spend analytical snapshots before publication.
- `atlas_v2_private.source_snapshot`: private landing/published-source bridge for compact producer contracts.

### Read API

Edge Function: `atlas-v2-read`.

- `verify_jwt=true`.
- Analyst Authorization token is forwarded to Supabase; no service-role key is used to serve analyst reads.
- Read models: `public_spend_overview`, `public_spend_monitor`.
- Operations: `read_model`, `public_spend_query`.
- Read-model response contract: `ATLAS_READ_API_V2`.
- Public-spend drill-down contract: `ATLAS_PUBLIC_SPEND_QUERY_V2`.
- `ETag` / `If-None-Match` for unchanged read models.
- `x-atlas-trace-id`, `x-atlas-snapshot`, `Server-Timing` and fail-soft telemetry.

### Source ingestion

Edge Function: `atlas-v2-source-ingest`.

- custom GitHub Actions OIDC verification; `verify_jwt=false` is intentional because Supabase user JWT is not the principal for this service-to-service endpoint.
- issuer: GitHub Actions OIDC.
- audience: `atlas-v2-source-ingest`.
- source repository restricted to `smoralesm07-source/Rada_Presupuesto_Abierto`.
- branch restricted to `refs/heads/main`.
- workflow allowlist is explicit.
- privileged database credentials remain server-side only.
- accepted producer contract: `ATLAS_BUDGET_EXECUTION_SOURCE_V2`.

## 4. First vertical slice: Gasto Público

Gasto Público v2 is intentionally modeled as **two parallel analytical domains**.

### 4.1 Budget execution domain

Producer: Presupuesto Abierto / DIPRES.

Contract: `ATLAS_BUDGET_EXECUTION_SOURCE_V2`.

The corrected source pipeline publishes a compact contract containing:

- L12 execution overview;
- monthly series;
- top services;
- top providers/receptors;
- source grain and coverage metadata;
- source-parity/quality metadata.

The browser no longer needs to treat a raw GitHub JSON URL as an application database. The producer publishes to ATLAS through GitHub Actions OIDC; ATLAS persists the compact source snapshot privately.

### 4.2 Procurement analytical domain

Producer: ChileCompra/provider-analyzer materializations.

Read model: `public_spend_overview` / contract `ATLAS_PUBLIC_SPEND_OVERVIEW_V2`.

Contains:

- 12-month procurement summary and source coverage;
- findings by family/severity;
- top findings;
- top suppliers;
- top buyers;
- top buyer-supplier pairs;
- hypothesis/source readiness;
- methodological guardrail.

For `PS-2026-07-V1` the universe is approximately 2,005 buyers, 72,802 suppliers and 494,867 buyer-supplier pairs. The overview payload is about 62 KB. Published-model PostgreSQL lookup measured about 4 ms in the initial benchmark.

### 4.3 Combined monitor

Read model: `public_spend_monitor`.

Contract: `ATLAS_PUBLIC_SPEND_MONITOR_V2`.

The monitor includes both domains with explicit availability, source versions and a comparability rule:

- budget-execution amounts are not procurement amounts;
- the domains must not be added/subtracted or presented as an equivalent universe without an explicit coverage bridge;
- analytical convergence is allowed only when the entity/grain relationship is documented.

Current combined payload is approximately 65 KB.

### 4.4 Drill-down boundary

Lists and detail are not embedded as hundreds of thousands of rows in the monitor. `public_spend_query` provides bounded server-side access to already-materialized `ps_*` tables.

Supported kinds:

- `buyers`
- `suppliers`
- `pairs`
- `findings`
- `buyer_detail`
- `supplier_detail`
- `pair_detail`

Maximum page size is 100. Raw `ps_*` tables are not browser APIs. The private gateway checks the authenticated analyst against the ATLAS allowlist before reading privileged tables.

Measured database execution in the first slice:

- priority pair page: ~10.5 ms;
- supplier list: ~85.5 ms;
- supplier text search before indexing: ~215.8 ms;
- same text search after trigram indexes: ~14.0 ms.

## 5. Frontend contract

`src/v2/atlas-v2-data.js` is the application boundary. Views should call:

- `publicSpend.monitor()`
- `publicSpend.overview()`
- `publicSpend.buyers()`
- `publicSpend.suppliers()`
- `publicSpend.pairs()`
- `publicSpend.findings()`
- detail helpers

The view must not know source repository URLs, service credentials, provider-analyzer storage tables or SQL/RPC implementation details.

## 6. Target module boundary

Each migrated module should converge on:

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

Aggregate dashboards and dossiers use read models. Bounded drill-downs use explicit query contracts with a query/payload budget.

## 7. Performance gates

Initial engineering SLOs:

- read-model PostgreSQL lookup: p95 <= 50 ms;
- bounded drill-down database execution: p95 <= 250 ms;
- read API server execution: p95 <= 300 ms excluding client network;
- initial usable module render: p95 <= 1.5 s;
- no interactive query with an expected full scan of a multi-million-row operational table;
- overview payload target <= 250 KB before compression;
- every route read exposes snapshot and trace identifiers.

## 8. Migration sequence

1. **Gasto Público** — first v2 consumer and performance reference.
2. **Entidad 360** — replace multi-source browser orchestration with a dossier read model plus bounded drill-down contracts.
3. **OSFL** — one current renderer and one data contract; retire legacy recovery authorities after parity testing.
4. **Sanciones** — canonical event/timeline read models and sector aggregates.
5. **Universo SO / Reportabilidad** — separate registry facts, inferred obligation evidence and analyst workflow state.
6. **Territorio** — precomputed contextual aggregates, never inherited as entity risk.
7. **Inicio / cross-module overview** — assembled only from model heads, never from raw producer tables.

## 9. Release gates for migrating a module

A v2 module can replace its current route only when all are true:

- producer/source contract validation passes;
- read contract/schema validation passes;
- authorization tests pass for allowed and denied identities;
- current-vs-v2 parity is defined only for metrics with equivalent source/grain;
- non-equivalent source domains are visibly identified, not force-matched;
- p95 latency and payload budgets pass;
- browser E2E route test passes;
- stale-response/race test passes;
- rollback path is documented;
- the previous competing runtime authority is removed after the controlled compatibility window.

## 10. Current cutover state

- Supabase v2 data boundary: active.
- queue/worker: active.
- `public_spend_overview`: READY.
- `public_spend_monitor`: READY.
- authenticated drill-down gateway: active and tested.
- Presupuesto Abierto OIDC publisher: implemented on isolated source-repository branch, awaiting its controlled merge to main.
- current GP2 production renderer: intentionally unchanged.
- branch-only shadow/runtime integration: next gate.

Production cutover must remove the direct `raw.githubusercontent.com/.../spend_view_v2.json` dependency from the active ATLAS route. Until then, legacy GP2 remains the visible authority and v2 remains the candidate authority.
