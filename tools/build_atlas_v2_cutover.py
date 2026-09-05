#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import shutil
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


def _strip_legacy_public_spend_tags(html: str) -> str:
    # Architecture v2 becomes the only Gasto Público route authority in this
    # opt-in artifact. Other ATLAS modules remain byte-for-byte owned by the
    # canonical builder.
    patterns = [
        r"\s*<link[^>]+href=['\"]\.\/assets\/(?:atlas-public-spend|atlas-gasto-publico)[^'\"]*['\"][^>]*>\s*",
        r"\s*<script[^>]+src=['\"]\.\/assets\/(?:atlas-public-spend|atlas-gasto-publico)[^'\"]*['\"][^>]*>\s*<\/script>\s*",
    ]
    for pattern in patterns:
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


def _productionize_js(name: str, text: str) -> str:
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
    return text


def _copy_v2_runtime(out_dir: Path) -> list[str]:
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
            text = _productionize_js(name, text)
        dst.write_text(text, encoding="utf-8")
        published.append(f"{V2_DIR}/{name}")
    return published


def _remove_legacy_public_spend_assets(out_dir: Path) -> list[str]:
    assets = out_dir / "assets"
    removed = []
    if not assets.exists():
        return removed
    for pattern in ("atlas-public-spend*", "atlas-gasto-publico*"):
        for path in assets.glob(pattern):
            if path.is_file():
                removed.append(str(path.relative_to(out_dir)))
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


def _validate_cutover(out_dir: Path, html: str, removed_assets: list[str]) -> None:
    if re.search(r"\.\/assets\/(?:atlas-public-spend|atlas-gasto-publico)", html, flags=re.I):
        raise SystemExit("cutover build: competing Gasto Público asset remains mounted")
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

    for pattern in ("atlas-public-spend*", "atlas-gasto-publico*"):
        leftovers = [str(path.relative_to(out_dir)) for path in (out_dir / "assets").glob(pattern) if path.is_file()]
        if leftovers:
            raise SystemExit(f"cutover build: legacy public-spend assets remain publishable: {leftovers[:10]}")

    if not removed_assets:
        raise SystemExit("cutover build: no legacy public-spend assets were retired; source contract may have drifted")


def _update_report(out_dir: Path, published_v2: list[str], removed_assets: list[str]) -> None:
    path = out_dir / "atlas-runtime-report.json"
    report = json.loads(path.read_text(encoding="utf-8"))
    report["public_spend_cutover"] = "ARCHITECTURE_V2"
    report["public_spend_runtime"] = f"v2/public-spend-adapter.js?v={V2_VERSION}"
    report["public_spend_authority"] = f"v2/public-spend-route-bridge.js?v={V2_VERSION}"
    report["public_spend_source"] = "BACKEND_READ_MODELS"
    report["public_spend_legacy_assets_retired"] = removed_assets
    report["published_css"] = [
        item for item in report.get("published_css", [])
        if "atlas-public-spend" not in item and "atlas-gasto-publico" not in item
    ] + ["v2/public-spend-adapter.css"]
    report["published_js"] = [
        item for item in report.get("published_js", [])
        if "atlas-public-spend" not in item and "atlas-gasto-publico" not in item
    ] + [item for item in published_v2 if item.endswith(".js")]
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")


def build_cutover(out_dir: Path) -> None:
    build_current(out_dir)
    html_path = out_dir / "index.html"
    html = html_path.read_text(encoding="utf-8")
    html = _strip_legacy_public_spend_tags(html)
    html = _extend_csp(html)
    removed_assets = _remove_legacy_public_spend_assets(out_dir)
    published_v2 = _copy_v2_runtime(out_dir)
    html = _mount_v2(html)
    _validate_cutover(out_dir, html, removed_assets)
    html_path.write_text(html, encoding="utf-8")
    _update_report(out_dir, published_v2, removed_assets)
    print(json.dumps({
        "cutover": "ARCHITECTURE_V2",
        "public_spend_authority": "v2/public-spend-route-bridge.js",
        "published_v2": published_v2,
        "retired_legacy_asset_count": len(removed_assets),
        "main_build_default_unchanged": True,
    }, ensure_ascii=False))


def main() -> None:
    parser = argparse.ArgumentParser(description="Build an opt-in ATLAS artifact with Gasto Público Architecture v2.")
    parser.add_argument("--out", default="_site-v2-cutover")
    args = parser.parse_args()
    target = Path(args.out)
    if not target.is_absolute():
        target = (ROOT / target).resolve()
    build_cutover(target)


if __name__ == "__main__":
    main()
