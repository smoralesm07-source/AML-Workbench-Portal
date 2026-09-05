#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from build_atlas_site import build as build_current

ROOT = Path(__file__).resolve().parents[1]
V2_HOST = "https://bzqxvidggykkdouotylg.supabase.co"
V2_VERSION = "v2-cutover-1"
V2_DIR = "v2"
V2_FILES = [
    "atlas-v2-production-config.js",
    "atlas-v2-data.js",
    "atlas-v2-session.js",
    "public-spend-adapter.js",
    "public-spend-route-bridge.js",
    "public-spend-adapter.css",
]

# Only these files can own or directly bootstrap the visible Gasto Público route.
# Shared public-spend support assets (taxonomy, intelligence helpers, etc.) are
# deliberately preserved because other ATLAS runtime fragments may consume them.
COMPETING_PUBLIC_SPEND_ASSETS = (
    "assets/atlas-public-spend-v2.css",
    "assets/atlas-public-spend-v2.js",
    "assets/atlas-public-spend-route-authority-0578.js",
    "assets/atlas-gasto-publico-1300.css",
    "assets/atlas-gasto-publico-1300.js",
)
CORE_COMPETING_PUBLIC_SPEND_ASSETS = {
    "assets/atlas-public-spend-v2.css",
    "assets/atlas-public-spend-v2.js",
    "assets/atlas-public-spend-route-authority-0578.js",
}


def _strip_legacy_public_spend_tags(html: str) -> str:
    # Architecture v2 becomes the only Gasto Público route authority in this
    # opt-in artifact. Shared helpers with a public-spend name remain available.
    for asset in COMPETING_PUBLIC_SPEND_ASSETS:
        escaped = re.escape(asset)
        if asset.endswith(".css"):
            pattern = rf"\s*<link[^>]+href=['\"]\./{escaped}(?:\?[^'\"]*)?['\"][^>]*>\s*"
        else:
            pattern = rf"\s*<script[^>]+src=['\"]\./{escaped}(?:\?[^'\"]*)?['\"][^>]*>\s*</script>\s*"
        html = re.sub(pattern, "\n", html, flags=re.I)
    return html


def _extend_csp(html: str) -> str:
    match = re.search(r"connect-src\s+([^;]+);", html, flags=re.I)
    if not match:
        raise SystemExit("cutover build: CSP connect-src directive missing")
    sources = match.group(1).split()
    if V2_HOST not in sources:
        sources.append(V2_HOST)
    replacement = "connect-src " + " ".join(sources) + ";"
    return html[: match.start()] + replacement + html[match.end() :]


def _productionize_js(name: str, text: str, *, e2e_proxy: bool = False) -> str:
    if name == "public-spend-adapter.js":
        old = "const ACTIVE = global.__ATLAS_V2_PREVIEW_MODE__ === 'public-spend' || new URLSearchParams(location.search).get('atlasv2') === 'public-spend';"
        new = "const ACTIVE = global.__ATLAS_V2_PUBLIC_SPEND_CUTOVER__ === true;"
        if old not in text:
            raise SystemExit("cutover build: adapter activation contract drifted")
        text = text.replace(old, new, 1)
        text = text.replace("Architecture v2 preview", "Architecture v2")
        text = text.replace("v2-preview", "v2-production")
    elif name == "public-spend-route-bridge.js":
        old = "const ACTIVE = global.__ATLAS_V2_PREVIEW_MODE__ === 'public-spend' || new URLSearchParams(location.search).get('atlasv2') === 'public-spend';"
        new = "const ACTIVE = global.__ATLAS_V2_PUBLIC_SPEND_CUTOVER__ === true;"
        if old not in text:
            raise SystemExit("cutover build: route bridge activation contract drifted")
        text = text.replace(old, new, 1)
        text = text.replace("v2-preview", "v2-production")
    elif name == "atlas-v2-production-config.js" and e2e_proxy:
        old = "const PROJECT_URL = 'https://bzqxvidggykkdouotylg.supabase.co';"
        new = "const PROJECT_URL = location.origin + '/__atlas_v2';"
        if old not in text:
            raise SystemExit("cutover build: production config endpoint contract drifted")
        text = text.replace(old, new, 1)
        text = text.replace("mode: 'public-spend-cutover',", "mode: 'public-spend-cutover-e2e-proxy',", 1)
    return text


def _copy_v2_runtime(out_dir: Path, *, e2e_proxy: bool = False) -> list[str]:
    target = out_dir / V2_DIR
    target.mkdir(parents=True, exist_ok=True)
    published = []
    for name in V2_FILES:
        src = ROOT / "src" / "v2" / name
        if not src.is_file():
            raise SystemExit(f"cutover build: missing v2 source asset: {src.relative_to(ROOT)}")
        dst = target / name
        text = src.read_text(encoding="utf-8")
        if name.endswith(".js"):
            text = _productionize_js(name, text, e2e_proxy=e2e_proxy)
        dst.write_text(text, encoding="utf-8")
        published.append(f"{V2_DIR}/{name}")
    return published


def _remove_legacy_public_spend_assets(out_dir: Path) -> list[str]:
    removed = []
    for asset in COMPETING_PUBLIC_SPEND_ASSETS:
        path = out_dir / asset
        if path.is_file():
            removed.append(asset)
            path.unlink()
    return sorted(removed)


def _mount_v2(html: str) -> str:
    style_tag = (
        f'  <link id="atlas-v2-public-spend-adapter-style" rel="stylesheet" '
        f'href="./v2/public-spend-adapter.css?v={V2_VERSION}" data-atlas-v2-cutover="public-spend" />\n'
    )
    if "</head>" not in html:
        raise SystemExit("cutover build: </head> missing")
    html = html.replace("</head>", style_tag + "</head>", 1)

    ordered_scripts = [
        "atlas-v2-production-config.js",
        "atlas-v2-data.js",
        "atlas-v2-session.js",
        "public-spend-adapter.js",
        "public-spend-route-bridge.js",
    ]
    script_tags = "\n".join(
        f'  <script src="./v2/{name}?v={V2_VERSION}" data-atlas-v2-cutover="public-spend"></script>'
        for name in ordered_scripts
    ) + "\n"
    if "</body>" not in html:
        raise SystemExit("cutover build: </body> missing")
    return html.replace("</body>", script_tags + "</body>", 1)


def _validate_cutover(out_dir: Path, html: str, removed_assets: list[str], *, e2e_proxy: bool = False) -> None:
    if V2_HOST not in html:
        raise SystemExit("cutover build: v2 Supabase host missing from CSP")

    expected = [out_dir / V2_DIR / name for name in V2_FILES]
    missing = [str(path.relative_to(out_dir)) for path in expected if not path.is_file()]
    if missing:
        raise SystemExit(f"cutover build: v2 assets missing: {missing}")

    adapter = (out_dir / V2_DIR / "public-spend-adapter.js").read_text(encoding="utf-8")
    bridge = (out_dir / V2_DIR / "public-spend-route-bridge.js").read_text(encoding="utf-8")
    config = (out_dir / V2_DIR / "atlas-v2-production-config.js").read_text(encoding="utf-8")
    for name, text in (("adapter", adapter), ("route bridge", bridge)):
        if "__ATLAS_V2_PUBLIC_SPEND_CUTOVER__ === true" not in text:
            raise SystemExit(f"cutover build: {name} is not cutover-gated")
        if "v2-preview" in text:
            raise SystemExit(f"cutover build: preview marker remains in production {name}")
    if "__ATLAS_V2_PUBLIC_SPEND_CUTOVER__ = true" not in config:
        raise SystemExit("cutover build: production config does not enable cutover")
    if "__ATLAS_V2_PREVIEW_MODE__" in config:
        raise SystemExit("cutover build: preview activation leaked into production config")
    if e2e_proxy:
        if "location.origin + '/__atlas_v2'" not in config:
            raise SystemExit("cutover build: E2E proxy endpoint was not applied")
        if "public-spend-cutover-e2e-proxy" not in config:
            raise SystemExit("cutover build: E2E proxy mode marker missing")
    elif "const PROJECT_URL = 'https://bzqxvidggykkdouotylg.supabase.co';" not in config:
        raise SystemExit("cutover build: production config no longer points at the v2 project")

    for asset in COMPETING_PUBLIC_SPEND_ASSETS:
        if (out_dir / asset).is_file():
            raise SystemExit(f"cutover build: competing Gasto Público asset remains publishable: {asset}")
        if f"./{asset}" in html:
            raise SystemExit(f"cutover build: competing Gasto Público asset remains mounted: {asset}")

    retired = set(removed_assets)
    if not CORE_COMPETING_PUBLIC_SPEND_ASSETS.issubset(retired):
        missing_core = sorted(CORE_COMPETING_PUBLIC_SPEND_ASSETS - retired)
        raise SystemExit(f"cutover build: canonical competing assets were not retired: {missing_core}")
    unexpected = retired - set(COMPETING_PUBLIC_SPEND_ASSETS)
    if unexpected:
        raise SystemExit(f"cutover build: non-authority support assets were retired: {sorted(unexpected)}")


def _update_report(out_dir: Path, published_v2: list[str], removed_assets: list[str], *, e2e_proxy: bool = False) -> None:
    path = out_dir / "atlas-runtime-report.json"
    report = json.loads(path.read_text(encoding="utf-8"))
    retired = set(removed_assets)
    report["public_spend_cutover"] = "ARCHITECTURE_V2"
    report["public_spend_runtime"] = f"v2/public-spend-adapter.js?v={V2_VERSION}"
    report["public_spend_authority"] = f"v2/public-spend-route-bridge.js?v={V2_VERSION}"
    report["public_spend_source"] = "BACKEND_READ_MODELS"
    report["public_spend_e2e_proxy"] = e2e_proxy
    report["public_spend_legacy_assets_retired"] = removed_assets
    report["published_css"] = [
        item for item in report.get("published_css", []) if item not in retired
    ] + ["v2/public-spend-adapter.css"]
    report["published_js"] = [
        item for item in report.get("published_js", []) if item not in retired
    ] + [item for item in published_v2 if item.endswith(".js")]
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")


def build_cutover(out_dir: Path, *, e2e_proxy: bool = False) -> None:
    build_current(out_dir)
    html_path = out_dir / "index.html"
    html = html_path.read_text(encoding="utf-8")
    html = _strip_legacy_public_spend_tags(html)
    html = _extend_csp(html)
    removed_assets = _remove_legacy_public_spend_assets(out_dir)
    published_v2 = _copy_v2_runtime(out_dir, e2e_proxy=e2e_proxy)
    html = _mount_v2(html)
    _validate_cutover(out_dir, html, removed_assets, e2e_proxy=e2e_proxy)
    html_path.write_text(html, encoding="utf-8")
    _update_report(out_dir, published_v2, removed_assets, e2e_proxy=e2e_proxy)
    print(json.dumps({
        "cutover": "ARCHITECTURE_V2",
        "public_spend_authority": "v2/public-spend-route-bridge.js",
        "published_v2": published_v2,
        "retired_legacy_assets": removed_assets,
        "retired_legacy_asset_count": len(removed_assets),
        "e2e_proxy": e2e_proxy,
        "shared_support_assets_preserved": True,
        "main_build_default_unchanged": True,
    }, ensure_ascii=False))


def main() -> None:
    parser = argparse.ArgumentParser(description="Build an opt-in ATLAS artifact with Gasto Público Architecture v2.")
    parser.add_argument("--out", default="_site-v2-cutover")
    parser.add_argument(
        "--e2e-proxy",
        action="store_true",
        help="Rewrite only the generated production config to use the local E2E reverse proxy.",
    )
    args = parser.parse_args()
    target = Path(args.out)
    if not target.is_absolute():
        target = (ROOT / target).resolve()
    build_cutover(target, e2e_proxy=args.e2e_proxy)


if __name__ == "__main__":
    main()
