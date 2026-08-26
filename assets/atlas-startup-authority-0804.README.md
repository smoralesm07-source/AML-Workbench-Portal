ATLAS startup authority 0.80.4

Purpose: prevent historical overview renderers from becoming visible while the compiled runtime is still installing the final route authorities.

The legacy source fragments remain in the repository for dependency compatibility and traceability, but startup presentation is gated until the atomic runtime barrier marks `body.aml-runtime-ready`. The final operational recovery layer also neutralizes the v0.24 version writer so an intermediate source fragment cannot overwrite the active release metadata during refresh.

Policy: ONE_VISIBLE_RENDER_AFTER_FINAL_RUNTIME.
