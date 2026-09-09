#!/usr/bin/env python3
"""ATLAS v2 primary build entrypoint.

Keeps the historical build implementation intact while adapting the current
OSFL and Entity 360 surface contracts expected by CI and the live authority.
"""
from __future__ import annotations

import json

import build_atlas_v2_primary_core as _core
from build_atlas_v2_primary_core import *  # noqa: F401,F403

EXPEDIENTE_FILES = (
    "entity360-expediente-surface.js",
    "entity360-expediente-surface.css",
    "entity360-resilience-hotfix.js",
)
ENTITY360_AUTHORITY = "ENTITY360_EXPEDIENTE_EXECUTIVE_V2_20260908"
for _asset in EXPEDIENTE_FILES:
    if _asset not in _core.V2_FILES:
        _core.V2_FILES.append(_asset)
V2_FILES = _core.V2_FILES

_original_require = _core.require
_original_validate = _core.validate
_original_update_report = _core.update_report


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
    elif label == "boot authority":
        markers = list(markers) + [
            "entity360-expediente-surface.js",
            "ASSET_REVISION = 'entity360-expediente-1'",
        ]
    _original_require(source, markers, label)


def _validate_current_surface(out_dir, html, legacy, published_v2, *, e2e_proxy=False) -> None:
    _original_validate(out_dir, html, legacy, published_v2, e2e_proxy=e2e_proxy)
    expediente = (out_dir / "v2" / "entity360-expediente-surface.js").read_text(encoding="utf-8")
    expediente_css = (out_dir / "v2" / "entity360-expediente-surface.css").read_text(encoding="utf-8")
    resilience = (out_dir / "v2" / "entity360-resilience-hotfix.js").read_text(encoding="utf-8")
    boot = (out_dir / "v2" / "atlas-v2-boot.js").read_text(encoding="utf-8")
    _original_require(expediente, [
        ENTITY360_AUTHORITY,
        "registerSurface('entidad'",
        "__ATLAS_V2_ENTITY360_EXPEDIENTE__",
    ], "Entity 360 expediente executive surface")
    _original_require(expediente_css, [
        ".e36x{",
        ".e36x-hero",
        ".e36x-tabs",
        ".e36x-timeline",
    ], "Entity 360 expediente visual contract")
    _original_require(resilience, [
        "ENTITY360_RESILIENCE_CORE_FALLBACK_20260909_1",
        "CORE_READ_IS_SUFFICIENT_TO_OPEN_EXPEDIENTE",
        "readIntelligenceResilient",
    ], "Entity 360 resilient intelligence fallback")
    if boot.index("'entity360-expediente-surface.js'") <= boot.index("'entity360-parity-surface.js'"):
        raise SystemExit("v2 primary build: Entity 360 expediente must register after historical parity")


def _update_current_report(out_dir, published_v2, primary_release, legacy_release, *, e2e_proxy=False) -> None:
    _original_update_report(
        out_dir,
        published_v2,
        primary_release,
        legacy_release,
        e2e_proxy=e2e_proxy,
    )
    path = out_dir / "atlas-runtime-report.json"
    report = json.loads(path.read_text(encoding="utf-8"))
    report.update({
        "v2_entity360_authority": ENTITY360_AUTHORITY,
        "v2_entity360_dossier": ENTITY360_AUTHORITY,
        "v2_entity360_design": "EXECUTIVE_360_DOSSIER",
        "v2_entity360_historical_parity": "ENTITY360_LEGACY_PARITY_V2",
        "v2_entity360_asset_revision": "entity360-expediente-1",
        "v2_entity360_resilience": "ENTITY360_RESILIENCE_CORE_FALLBACK_20260909_1",
    })
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")


_core.require = _require_current_surface
_core.validate = _validate_current_surface
_core.update_report = _update_current_report
require = _require_current_surface
validate = _validate_current_surface
update_report = _update_current_report


if __name__ == "__main__":
    _core.main()
