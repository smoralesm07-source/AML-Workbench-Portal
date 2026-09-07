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
7. **Vigilancia** — optional saved rules and changes over time.

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

## 7. Technical invariants

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

## 8. Migration order under this contract

1. Foundation: shell, router, command palette, tokens, loading/error/empty primitives.
2. Explore: analytical landing and universal search; no task inbox.
3. Entidad 360: first complete cross-source v2 experience.
4. Gasto Público: move the existing v2 data boundary into the new shell.
5. Universos: population analysis with source lenses.
6. Territorio and Relaciones.
7. Vigilancia and optional saved analytical objects.
8. Outcome capture as a contextual action, not a mandatory workflow.
9. Delete legacy authority as each route completes parity/security/performance gates.

## 9. Acceptance test

A new analyst must be able to open ATLAS, search or browse a universe, find an anomaly, drill into an entity, inspect its evidence and move to another analytical question **without once being asked to take, assign, close or manage a case**.

If that test fails, the product has drifted from analytics into case management and the change must not ship.
