#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import shutil
from pathlib import Path

from build_atlas_site import build as build_legacy

ROOT = Path(__file__).resolve().parents[1]
V2_VERSION = "v2-primary-2"
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
        text = src.read_text(encoding="utf-8")
        dst.write_text(productionize(name, text, e2e_proxy=e2e_proxy), encoding="utf-8")
        published.append(f"v2/{name}")
    return published


def production_index(primary_release: dict) -> str:
    html = (ROOT / "atlas-v2.html").read_text(encoding="utf-8")
    rel = str(primary_release["release"])
    bid = str(primary_release["build"])
    if "data-atlas-v2-primary=\"analytics\"" not in html:
        raise SystemExit("v2 primary build: atlas-v2.html is not marked as primary")
    html = re.sub(
        r"<html lang=\"es\"",
        f'<html lang="es" data-aml-version="{rel}" data-aml-build="{bid}" data-atlas-release="{rel}"',
        html,
        count=1,
    )
    return html


def validate(out_dir: Path, html: str, legacy: str, published_v2: list[str], *, e2e_proxy: bool = False) -> None:
    required_markers = [
        'data-atlas-v2-primary="analytics"',
        './v2/atlas-v2-production-config.js?v=v2-primary-2',
        './v2/atlas-v2-health.js?v=v2-primary-2',
        './v2/atlas-v2-core-auth.js?v=v2-primary-2',
        './v2/atlas-v2-shell.js?v=v2-primary-2',
        './v2/atlas-v2-boot.js?v=v2-primary-2',
        './assets/supabase-js-2.111.0.umd.js?v=v2-primary-2',
    ]
    for marker in required_markers:
        if marker not in html:
            raise SystemExit(f"v2 primary build: root marker missing: {marker}")

    forbidden_root = [
        "ATLAS_RUNTIME_SCRIPTS",
        "atlas-runtime-current-",
        "atlas-module-current-",
        "atlas-public-spend-route-authority-0578.js",
        "atlas-gasto-publico-1000.js",
        "raw.githubusercontent.com",
    ]
    for marker in forbidden_root:
        if marker in html:
            raise SystemExit(f"v2 primary build: legacy authority leaked into root: {marker}")

    if "atlas-runtime-current-" not in legacy:
        raise SystemExit("v2 primary build: explicit legacy fallback lost compiled runtime")
    if "data-atlas-v2-primary=\"analytics\"" in legacy:
        raise SystemExit("v2 primary build: legacy fallback incorrectly marked as primary")

    for item in published_v2:
        if not (out_dir / item).is_file():
            raise SystemExit(f"v2 primary build: published asset missing: {item}")
    if not (out_dir / V2_RELEASE_FILE).is_file():
        raise SystemExit("v2 primary build: primary release manifest missing")

    auth = (out_dir / "v2" / "atlas-v2-core-auth.js").read_text(encoding="utf-8")
    boot = (out_dir / "v2" / "atlas-v2-boot.js").read_text(encoding="utf-8")
    explore = (out_dir / "v2" / "explore-surface.js").read_text(encoding="utf-8")
    config = (out_dir / "v2" / "atlas-v2-production-config.js").read_text(encoding="utf-8")
    health = (out_dir / "v2" / "atlas-v2-health.js").read_text(encoding="utf-8")
    if "aml_allowed_users" not in auth or "signInWithOAuth" not in auth or "provider: 'azure'" not in auth or ".auth.getUser()" not in auth:
        raise SystemExit("v2 primary build: autonomous verified Entra/allowlist auth contract missing")
    if "AtlasCoreSession.ready" not in boot or "STRUCTURAL_SURFACE_LOAD_FAILED" not in boot:
        raise SystemExit("v2 primary build: shell is not auth-gated/fail-closed")
    if "warmFederatedSession" not in boot:
        raise SystemExit("v2 primary build: federation prewarm missing")
    if "registerSurface('explorar'" not in explore or "AtlasV2Universes.overview" not in explore or "AtlasV2Watch.overview" not in explore or "AtlasV2Territory.overview" not in explore:
        raise SystemExit("v2 primary build: live Explore pulse contract missing")
    if "ATLAS_V2_RUNTIME_HEALTH_V1" not in health:
        raise SystemExit("v2 primary build: sanitized runtime health boundary missing")
    if e2e_proxy:
        if "location.origin + '/__atlas_v2'" not in config or "mode: 'analytics-primary-e2e-proxy'" not in config:
            raise SystemExit("v2 primary build: E2E proxy config missing")
    elif "mode: 'analytics-primary'" not in config:
        raise SystemExit("v2 primary build: production mode contract missing")
    if "legacyFallbackPath: './legacy.html'" not in config:
        raise SystemExit("v2 primary build: production fallback contract missing")
    if "MutationObserver" in auth or ".innerHTML" in auth or "MutationObserver" in explore or ".innerHTML" in explore:
        raise SystemExit("v2 primary build: runtime repair/HTML injection reintroduced")


def update_report(
    out_dir: Path,
    published_v2: list[str],
    primary_release: dict,
    legacy_release: dict,
    *,
    e2e_proxy: bool = False,
) -> None:
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
        "v2_explore_mode": "LIVE_PULSE",
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
