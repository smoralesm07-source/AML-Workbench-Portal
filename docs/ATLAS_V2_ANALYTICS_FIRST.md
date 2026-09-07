# ATLAS v2 · Analytics-first product contract

**Status:** binding product constraint for the reengineering branch.

## 1. Product identity

ATLAS is an analytical intelligence platform first. It must let an analyst enter, ask what is happening, traverse universes, test hypotheses, compare entities, inspect signals and drill into evidence **without accepting ownership of a case or entering a workflow**.

Case-like functions are secondary conveniences. They must never become the main information architecture or a prerequisite for analysis.

## 2. Non-negotiable rule

> Exploration is free; follow-up is optional.

An analyst may navigate every analytical surface without assigning an owner, selecting a status, opening a task, setting an SLA, closing a case or recording a disposition.

ATLAS may offer contextual actions such as:

- save this view;
- follow this entity;
- save this hypothesis;
- add an analyst note;
- record the outcome of a review when the analyst chooses to do so.

These actions enrich continuity and future model evaluation, but they do not gate analysis.

## 3. Primary analytical loop

`QUESTION -> UNIVERSE -> SIGNAL -> EVIDENCE -> RELATION -> DRILL-DOWN -> NEW QUESTION`

This loop is the default interaction model.

The optional continuity loop is separate:

`SAVE / FOLLOW / NOTE / RECORD OUTCOME`

It can be entered or ignored at any point.

## 4. Information architecture

### Primary navigation

1. **Explorar** — default landing. Answers “¿qué está pasando?” and provides universal search plus analytical entry points.
2. **Universos** — population analysis. SII, UAF, OSFL, RES and sanctions are lenses/contexts, not independent applications.
3. **Entidad 360** — individual dossier and cross-source evidence.
4. **Gasto público** — specialized procurement/budget analytical workspace.
5. **Territorio** — contextual geographic analysis; context is never inherited as entity risk.
6. **Relaciones** — graph/network and convergence analysis.
7. **Vigilancia** — detection of signals, source health and changes across published snapshots.

### Secondary utilities

- **Guardados** — saved views, entities and hypotheses. No queue semantics.
- **Método y datos** — source coverage, freshness, contracts, formulas and guardrails.

There is deliberately no top-level `Casos`, `Tareas`, `Cola`, `Asignaciones` or `SLA` route.

## 5. Explore landing contract

The v2 landing page is not a KPI mosaic and not a task inbox. Its job is to support discovery.

It must progressively converge on four analytical blocks backed by versioned read models:

- **Cambios relevantes** — material changes since the last published snapshot.
- **Señales en movimiento** — signals whose incidence, severity or concentration changed materially.
- **Universos en movimiento** — population/sector/territory shifts worth inspection.
- **Convergencias** — entities or groups where independent evidence sources converge.

Until a governed cross-module read model exists, the UI must expose capabilities and availability states rather than inventing figures in the browser.

## 6. Follow-up without case management

Follow-up is modeled as small, append-only analytical objects rather than a workflow engine.

Minimum future objects:

- `saved_view`
- `followed_entity`
- `saved_hypothesis`
- `analyst_note`
- `review_outcome`

Forbidden as mandatory fields for analytical access:

- owner;
- due date;
- SLA;
- workflow status;
- task queue;
- closure reason.

`review_outcome` is optional but valuable for model evaluation. An analyst decision is never automated risk truth and must retain evidence/version context.

## 7. Territory analytical contract

Territory is a contextual lens, not an entity-risk engine.

The native v2 contract is `ATLAS_TERRITORY_QUERY_V2`. It exposes bounded operations for regional overview, communes, commune detail, territorial signals and entity drill-down.

Binding semantics:

- `IGR v4` is labeled **BETA_CONTEXTUAL** until explicitly promoted by methodology/version governance;
- a territorial score describes the observed territory, not every person or entity present there;
- territorial context never inherits automatically to entity risk;
- CEAD contributes contextual evidence and never proves conduct by an entity located in the territory;
- missing geographic coverage or missing data does not equal zero exposure;
- ordering entities inside a territory is based on observability for exploration, not a probability of LA/FT;
- every view preserves snapshot, coverage and source semantics.

## 8. Vigilance analytical contract

Vigilance is a detector of change and analytical attention, not a workflow authority.

The native v2 contract is `ATLAS_WATCH_QUERY_V2`. It exposes overview, current signals, changes, source health and snapshot timeline.

Binding semantics:

- signal ≠ finding;
- priority ≠ probability;
- a signal may be explored or ignored without changing its analytical state;
- no signal requires owner, assignment, due date, SLA, closure or disposition;
- every published `READY` Observatorio snapshot is captured immutably for future comparison;
- changes are represented as `NEW`, `CHANGED` and `REMOVED`;
- `REMOVED` means not present in the latest published snapshot, never “resolved” or “closed”;
- until two comparable snapshots exist, the UI must show `BASELINE_ONLY`; it must not translate missing history into “no changes”;
- source health is shown alongside signals because source silence limits interpretation;
- absence of changes does not imply low risk or absence of phenomena outside coverage.

## 9. Technical invariants

The analytics-first shell must follow `docs/ARCHITECTURE_V2.md`:

- one shell authority;
- URL-addressable state;
- thin browser;
- named read contracts;
- bounded drill-downs;
- snapshot/trace/freshness visibility;
- no direct raw-source URLs in views;
- no competing legacy renderer after cutover;
- no self-sustaining MutationObserver repair layer.

### Primary runtime authority

The integration artifact makes the analytics-first v2 shell the only runtime authority mounted at `/`.

- `index.html` mounts only the v2 auth, session, shell and native analytical surfaces;
- Microsoft Entra + Supabase Auth + `aml_allowed_users` form the autonomous core authorization boundary;
- analytical adapters continue to use governed v2 gateway/read contracts rather than direct operational-table reads;
- the compiled 0.96.4 runtime is retained only as `legacy.html` for controlled rollback and does not execute in the primary page;
- rollback availability must never be used as justification for layering a legacy renderer back into a v2 route;
- production authority changes only after merge/deploy and launch-hardening gates pass.

## 10. Migration order under this contract

1. Foundation: shell, router, command palette, tokens, loading/error/empty primitives. **Complete in branch.**
2. Entidad 360: complete cross-source v2 experience. **Complete in branch.**
3. Gasto Público: existing v2 data boundary mounted in the new shell. **Complete in branch.**
4. Relaciones: governed network/convergence analysis. **Complete in branch.**
5. Universos: SII, UAF/SO, OSFL, RES and Sanciones as population lenses. **Complete in branch.**
6. Territorio: governed contextual geographic analysis. **Complete in branch.**
7. Vigilancia: snapshot-based signals/change/source-health surface. **Complete in branch.**
8. Integration cut: autonomous authentication, v2 primary build authority and explicit non-competing legacy rollback. **Complete in branch; pending launch hardening and merge.**
9. Launch hardening: authenticated browser E2E, regression, observability, performance, error handling, responsive behavior and controlled production cutover.
10. Optional continuity/outcome objects may be added contextually after launch gates, without becoming mandatory workflow.

## 11. Acceptance test

A new analyst must be able to open ATLAS, search or browse a universe, find an anomaly, drill into an entity, inspect its evidence and move to another analytical question **without once being asked to take, assign, close or manage a case**.

A second acceptance test applies to Vigilancia: the analyst must be able to inspect a new or changed signal, examine its evidence and pivot to another analytical surface **without changing a workflow state or accepting responsibility for the signal**.

If either test fails, the product has drifted from analytics into case management and the change must not ship.
