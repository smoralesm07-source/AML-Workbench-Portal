#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import shutil
from pathlib import Path

from build_atlas_site import build as build_legacy

ROOT = Path(__file__).resolve().parents[1]
V2_VERSION = "v2-primary-5"
V2_RELEASE_FILE = "atlas-v2-release.json"
V2_FILES = [
    "atlas-v2-production-config.js",
    "atlas-v2-health.js",
    "atlas-v2-core-auth.js",
    "atlas-v2-core-auth.css",
    "atlas-v2-data.js",
    "atlas-v2-session.js",
    "atlas-v2-access.js",
    "atlas-v2-shell.js",
    "atlas-v2-shell.css",
    "atlas-v2-boot.js",
    "atlas-v2-viz.js",
    "atlas-v2-viz.css",
    "entity-search-adapter.js",
    "explore-surface.js",
    "explore-surface.css",
    "entity360-adapter.js",
    "entity360-surface.js",
    "entity360-surface.css",
    "public-spend-surface.js",
    "public-spend-surface.css",
    "relations-surface.js",
    "relations-surface.css",
    "universes-adapter.js",
    "universes-surface.js",
    "universes-surface.css",
    "territory-adapter.js",
    "territory-surface.js",
    "territory-surface.css",
    "watch-adapter.js",
    "watch-surface.js",
    "watch-surface.css",
]


def load_json(path: str):
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


def productionize(name: str, text: str, *, e2e_proxy: bool = False) -> str:
    if name == "atlas-v2-production-config.js" and e2e_proxy:
        old = "const V2_PROJECT_URL = 'https://bzqxvidggykkdouotylg.supabase.co';"
        new = "const V2_PROJECT_URL = location.origin + '/__atlas_v2';"
        if old not in text:
            raise SystemExit("v2 primary build: v2 endpoint contract drifted")
        text = text.replace(old, new, 1)
        text = text.replace("mode: 'analytics-primary',", "mode: 'analytics-primary-e2e-proxy',", 1)
    return text


def copy_v2(out_dir: Path, *, e2e_proxy: bool = False) -> list[str]:
    target = out_dir / "v2"
    target.mkdir(parents=True, exist_ok=True)
    published: list[str] = []
    for name in V2_FILES:
        src = ROOT / "src" / "v2" / name
        if not src.is_file():
            raise SystemExit(f"v2 primary build: missing source {src.relative_to(ROOT)}")
        dst = target / name
        dst.write_text(productionize(name, src.read_text(encoding="utf-8"), e2e_proxy=e2e_proxy), encoding="utf-8")
        published.append(f"v2/{name}")
    return published


def production_index(primary_release: dict) -> str:
    html = (ROOT / "atlas-v2.html").read_text(encoding="utf-8")
    rel = str(primary_release["release"])
    bid = str(primary_release["build"])
    if 'data-atlas-v2-primary="analytics"' not in html:
        raise SystemExit("v2 primary build: atlas-v2.html is not marked as primary")
    return re.sub(
        r'<html lang="es"',
        f'<html lang="es" data-aml-version="{rel}" data-aml-build="{bid}" data-atlas-release="{rel}"',
        html,
        count=1,
    )


def require(source: str, markers: list[str], label: str) -> None:
    missing = [marker for marker in markers if marker not in source]
    if missing:
        raise SystemExit(f"v2 primary build: {label} missing: {', '.join(missing)}")


def validate(out_dir: Path, html: str, legacy: str, published_v2: list[str], *, e2e_proxy: bool = False) -> None:
    require(html, [
        'data-atlas-v2-primary="analytics"',
        './v2/atlas-v2-production-config.js?v=v2-primary-5',
        './v2/atlas-v2-health.js?v=v2-primary-5',
        './v2/atlas-v2-core-auth.js?v=v2-primary-5',
        './v2/atlas-v2-shell.js?v=v2-primary-5',
        './v2/atlas-v2-boot.js?v=v2-primary-5-entity-intelligence-1',
        './v2/atlas-v2-viz.css?v=v2-primary-5-viz1',
        './assets/supabase-js-2.111.0.umd.js?v=v2-primary-5',
    ], "root authority")

    for marker in [
        "ATLAS_RUNTIME_SCRIPTS", "atlas-runtime-current-", "atlas-module-current-",
        "atlas-public-spend-route-authority-0578.js", "atlas-gasto-publico-1000.js", "raw.githubusercontent.com",
    ]:
        if marker in html:
            raise SystemExit(f"v2 primary build: legacy authority leaked into root: {marker}")

    if "atlas-runtime-current-" not in legacy:
        raise SystemExit("v2 primary build: explicit legacy fallback lost compiled runtime")
    if 'data-atlas-v2-primary="analytics"' in legacy:
        raise SystemExit("v2 primary build: legacy fallback incorrectly marked as primary")

    for item in published_v2:
        if not (out_dir / item).is_file():
            raise SystemExit(f"v2 primary build: published asset missing: {item}")
    if not (out_dir / V2_RELEASE_FILE).is_file():
        raise SystemExit("v2 primary build: primary release manifest missing")

    def read(name: str) -> str:
        return (out_dir / "v2" / name).read_text(encoding="utf-8")

    auth = read("atlas-v2-core-auth.js")
    boot = read("atlas-v2-boot.js")
    explore = read("explore-surface.js")
    entity = read("entity360-surface.js")
    entity_adapter = read("entity360-adapter.js")
    search = read("entity-search-adapter.js")
    universes = read("universes-adapter.js")
    viz = read("atlas-v2-viz.js")
    config = read("atlas-v2-production-config.js")
    health = read("atlas-v2-health.js")

    require(auth, ["aml_allowed_users", "signInWithOAuth", "provider: 'azure'", ".auth.getUser()"], "auth contract")
    require(boot, [
        "AtlasCoreSession.ready", "STRUCTURAL_SURFACE_LOAD_FAILED", "warmFederatedSession",
        "atlas-v2-viz.js", "entity-search-adapter.js", "VISUAL_SEARCH_CAPABILITY_MISSING",
        "STRUCTURAL_VERSION = 'v2-primary-5'", "SURFACE_VERSION = 'v2-primary-5-entity-intelligence-1'",
    ], "boot authority")
    require(explore, [
        "registerSurface('explorar'", "AtlasV2Universes.overview", "AtlasV2Watch.overview", "AtlasV2Territory.overview",
        "AtlasV2Universes.attention", "attentionPanel", "SO UAF ↔ SII", "AtlasV2Viz.horizontalBars", "AtlasV2Viz.segmented",
    ], "Explore intelligence pulse")
    require(search, ["ATLAS_ENTITY_SEARCH_V2", "operation: 'entity_search'", "resultTier", "tierPriority"], "entity search")
    require(universes, ["attention: (options = {}) => query('attention'", "recentTerminated", "terminatedByYear"], "UAF-SII attention adapter")
    require(entity_adapter, ["entity_intelligence", "entity_screening_live", "digital_identity_live", "searchDigitalIdentity"], "Entity 360 intelligence adapter")
    require(entity, [
        "AtlasV2EntitySearch.search", "Radar Prensa", "entity_id", "reconciliationPanel", "reportingPanel",
        "screeningPanel", "digitalIdentityPanel", "searchDigitalIdentity", "SCREENING INTERNACIONAL", "ROS / ROE observados",
    ], "Entity 360 intelligence surface")
    require(viz, ["horizontalBars", "lineChart", "segmented"], "visualization primitives")
    require(health, ["ATLAS_V2_RUNTIME_HEALTH_V1"], "runtime health")

    if e2e_proxy:
        require(config, ["location.origin + '/__atlas_v2'", "mode: 'analytics-primary-e2e-proxy'"], "E2E proxy config")
    else:
        require(config, ["mode: 'analytics-primary'"], "production config")
    require(config, ["legacyFallbackPath: './legacy.html'"], "legacy fallback contract")

    for source in (auth, explore, entity, entity_adapter, search, universes, viz):
        if "MutationObserver" in source or ".innerHTML" in source:
            raise SystemExit("v2 primary build: runtime repair/HTML injection reintroduced")


def update_report(out_dir: Path, published_v2: list[str], primary_release: dict, legacy_release: dict, *, e2e_proxy: bool = False) -> None:
    path = out_dir / "atlas-runtime-report.json"
    report = json.loads(path.read_text(encoding="utf-8"))
    report.update({
        "release": str(primary_release["release"]),
        "build": str(primary_release["build"]),
        "release_schema": primary_release.get("schema", "ATLAS_V2_RELEASE_V1"),
        "primary_release_manifest": V2_RELEASE_FILE,
        "primary_runtime": "ATLAS_V2_ANALYTICS",
        "primary_entry": "index.html",
        "legacy_fallback": "legacy.html",
        "legacy_release": str(legacy_release["release"]),
        "legacy_build": str(legacy_release["build"]),
        "legacy_release_manifest": "atlas-release.json",
        "legacy_fallback_policy": "FROZEN_ROLLBACK_ONLY",
        "legacy_authority_active_on_primary": False,
        "legacy_runtime_published_as_fallback": True,
        "v2_auth_boundary": "ENTRA_SUPABASE_ALLOWLIST_VERIFIED_USER",
        "v2_data_boundary": "ATLAS_V2_READ_GATEWAY",
        "v2_runtime_health": "SANITIZED_IN_MEMORY",
        "v2_structural_surface_policy": "FAIL_CLOSED",
        "v2_followup_policy": "OPTIONAL_NOT_WORKFLOW",
        "v2_explore_mode": "LIVE_PULSE_VISUAL_UAF_SII",
        "v2_visual_navigation": "INTERACTIVE_FIRST",
        "v2_entity_search": "IDENTITY_TIERED_DIGITAL_PRESS",
        "v2_entity_intelligence": "UAF_SII_REPORTING_SCREENING_DIGITAL",
        "v2_federation_prewarm": True,
        "v2_e2e_proxy": e2e_proxy,
        "v2_version": V2_VERSION,
        "published_v2": published_v2,
    })
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")


def build_primary(out_dir: Path, *, e2e_proxy: bool = False) -> None:
    primary_release = load_json(V2_RELEASE_FILE)
    legacy_release = load_json("atlas-release.json")
    fallback = primary_release.get("legacy_fallback") or {}
    if str(fallback.get("release")) != str(legacy_release.get("release")) or str(fallback.get("build")) != str(legacy_release.get("build")):
        raise SystemExit("v2 primary build: frozen legacy release contract drifted")

    build_legacy(out_dir)
    legacy_path = out_dir / "index.html"
    legacy = legacy_path.read_text(encoding="utf-8")
    if f'data-aml-version="{legacy_release["release"]}"' not in legacy or f'data-aml-build="{legacy_release["build"]}"' not in legacy:
        raise SystemExit("v2 primary build: legacy fallback identity is not frozen to its release")
    (out_dir / "legacy.html").write_text(legacy, encoding="utf-8")

    shutil.copy2(ROOT / V2_RELEASE_FILE, out_dir / V2_RELEASE_FILE)
    published_v2 = copy_v2(out_dir, e2e_proxy=e2e_proxy)
    html = production_index(primary_release)
    validate(out_dir, html, legacy, published_v2, e2e_proxy=e2e_proxy)
    legacy_path.write_text(html, encoding="utf-8")
    update_report(out_dir, published_v2, primary_release, legacy_release, e2e_proxy=e2e_proxy)

    print(json.dumps({
        "primary_runtime": "ATLAS_V2_ANALYTICS",
        "root": "index.html",
        "release": primary_release["release"],
        "build": primary_release["build"],
        "legacy_fallback": "legacy.html",
        "legacy_release": legacy_release["release"],
        "legacy_build": legacy_release["build"],
        "legacy_authority_active_on_primary": False,
        "published_v2_count": len(published_v2),
        "visual_navigation": "INTERACTIVE_FIRST",
        "entity_search": "IDENTITY_TIERED_DIGITAL_PRESS",
        "entity_intelligence": "UAF_SII_REPORTING_SCREENING_DIGITAL",
        "e2e_proxy": e2e_proxy,
    }, ensure_ascii=False))


def main() -> None:
    parser = argparse.ArgumentParser(description="Build ATLAS with the analytics-first v2 runtime as the primary Pages authority.")
    parser.add_argument("--out", default="_site-v2-primary")
    parser.add_argument("--e2e-proxy", action="store_true", help="Route generated v2 gateway traffic through the local E2E proxy.")
    args = parser.parse_args()
    target = Path(args.out)
    if not target.is_absolute():
        target = (ROOT / target).resolve()
    build_primary(target, e2e_proxy=args.e2e_proxy)


if __name__ == "__main__":
    main()
