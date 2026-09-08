#!/usr/bin/env python3
"""ATLAS v2 primary build entrypoint.

Keeps the historical build implementation intact while updating only the OSFL
surface contract expected by CI after the Panorama/Caracterización redesign.
"""
from __future__ import annotations

import build_atlas_v2_primary_core as _core
from build_atlas_v2_primary_core import *  # noqa: F401,F403

_original_require = _core.require


def _require_current_surface(source: str, markers: list[str], label: str) -> None:
    if label == "OSFL native surface":
        markers = [
            "registerSurface('osfl'",
            "AtlasV2Osfl.dashboard",
            "AtlasV2Osfl.search",
            "AtlasV2Osfl.detail",
            "Contexto nacional",
            "Fuentes y evolución",
            "Caracterización del universo observado",
            "Explorar y caracterizar OSFL",
            "Línea de tiempo",
        ]
        label = "OSFL panorama native surface"
    elif label == "OSFL visual contract":
        markers = [
            ".atlas-v2-osfl",
            ".osfl-kpis",
            ".osfl-source-evolution",
            ".osfl-character-grid",
            ".osfl-explorer",
            ".osfl-workspace",
            ".osfl-detail-panel",
            ".osfl-timeline",
        ]
        label = "OSFL panorama visual contract"
    _original_require(source, markers, label)


_core.require = _require_current_surface
require = _require_current_surface


if __name__ == "__main__":
    _core.main()
