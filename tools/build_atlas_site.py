#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load_json(name: str):
    return json.loads((ROOT / name).read_text(encoding="utf-8"))


def copy_file(src: Path, dst: Path):
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)


def sanitize_legacy_authority(text: str) -> str:
    """Turn historical version writers into delegates to the current guard.

    Source fragments remain unchanged in Git for traceability. Only compiled
    production copies are transformed. The transformation deliberately targets
    version/branding authority operations and leaves analytical/data logic intact.
    """
    delegate = "window.AtlasRelease?.apply?.();"
    assignment_patterns = [
        r"(?<![\w.])(?:window\.)?__AML_ACTIVE_VERSION__\s*=\s*[^;\n]+;",
        r"(?<![\w.])(?:window\.)?__AML_BUILD__\s*=\s*[^;\n]+;",
        r"(?<![\w.])(?:window\.)?__ATLAS_ACTIVE_VERSION__\s*=\s*[^;\n]+;",
        r"document\.title\s*=\s*[^;\n]+;",
    ]
    for pattern in assignment_patterns:
        text = re.sub(pattern, delegate, text)

    text = re.sub(
        r"(?:window\.)?__AML_RUNTIME_VERSION_APPLIER__\s*=\s*[^;\n]+;",
        "/* version applier owned by atlas-release-guard.js */",
        text,
    )
    text = re.sub(
        r"document\.documentElement\.setAttribute\(\s*(['\"])(?:data-aml-version|data-aml-build|data-atlas-release)\1\s*,[^;\n]*?\);",
        delegate,
        text,
    )
    text = re.sub(
        r"Operational\s+Radar\s*·\s*v\$\{[^}\n]+\}",
        'v${window.AtlasRelease?.version||document.documentElement.getAttribute("data-atlas-release")||""}',
        text,
        flags=re.I,
    )
    return text


def build(out_dir: Path):
    release = load_json("atlas-release.json")
    runtime = load_json("atlas-runtime-manifest.json")
    build_meta = load_json("build.json")

    rel = str(release["release"])
    build_id = str(release["build"])
    assert runtime["release"] == rel and runtime["build"] == build_id
    assert build_meta["app_version"] == rel and build_meta["build"] == build_id
    assert release["deployment_policy"] == "SINGLE_ACTIVE_RELEASE"
    assert release["runtime_policy"] == "CANONICAL_COMPILED_RUNTIME_ONLY"
    assert release["pages_artifact_policy"] == "COMPILED_CURRENT_BUNDLES_ONLY"
    assert runtime["policy"] == "CANONICAL_SOURCE_MANIFEST_FOR_COMPILED_RUNTIME"
    assert runtime["publish_mode"] == "COMPILED_BUNDLES_ONLY"

    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True)

    # Canonical boot/control files. No version-named runtime JS/CSS is copied.
    for name in ["atlas-release.json", "atlas-runtime-manifest.json", "build.json", "atlas-release-guard.js", "atlas-theme-bootstrap.js"]:
        copy_file(ROOT / name, out_dir / name)

    forbidden = set(runtime.get("forbidden_runtime_assets", []))
    source_assets = [*runtime["styles"], *[item["path"] for item in runtime["scripts"]]]
    collision = forbidden.intersection(source_assets)
    if collision:
        raise SystemExit(f"forbidden runtime assets declared as source fragments: {sorted(collision)}")

    # Compile all CSS source fragments, preserving declaration order. This makes
    # historical style filenames source-only and gives the browser one CSS asset.
    css_parts = ["/* ATLAS AML compiled current stylesheet. Source fragments are Git-only. */"]
    for name in runtime["styles"]:
        src = ROOT / name
        if not src.is_file():
            raise SystemExit(f"missing style source fragment: {name}")
        css_parts.append(f"\n/* ---- source: {name} ---- */\n{src.read_text(encoding='utf-8')}\n")
    compiled_css = "atlas-runtime-current.css"
    (out_dir / compiled_css).write_text("\n".join(css_parts), encoding="utf-8")

    # Compile classic scripts into ordered segments. Module boundaries are kept
    # because module execution semantics differ from classic scripts. Each module
    # is copied under a canonical, non-versioned production name.
    script_tags = []
    compiled_js = []
    classic_parts = []
    classic_index = 0
    module_index = 0

    def flush_classic():
        nonlocal classic_index, classic_parts
        if not classic_parts:
            return
        classic_index += 1
        name = f"atlas-runtime-current-{classic_index:02d}.js"
        body = ["'use strict';", "/* ATLAS AML compiled current runtime segment. */", *classic_parts, "window.AtlasRelease?.apply?.();"]
        (out_dir / name).write_text("\n\n".join(body) + "\n", encoding="utf-8")
        compiled_js.append(name)
        script_tags.append(f'  <script src="./{name}?r={build_id}" data-atlas-runtime="current"></script>')
        classic_parts = []

    for item in runtime["scripts"]:
        source_name = item["path"]
        src = ROOT / source_name
        if not src.is_file():
            raise SystemExit(f"missing script source fragment: {source_name}")
        transformed = sanitize_legacy_authority(src.read_text(encoding="utf-8"))
        boundary = f"/* ---- source fragment: {source_name} ---- */\n{transformed}\nwindow.AtlasRelease?.apply?.();"
        if item.get("type", "classic") == "module":
            flush_classic()
            module_index += 1
            module_name = f"atlas-module-current-{module_index:02d}.js"
            (out_dir / module_name).write_text(f"/* ATLAS AML compiled current module. Source: {source_name} */\n{transformed}\n", encoding="utf-8")
            compiled_js.append(module_name)
            script_tags.append(f'  <script type="module" src="./{module_name}?r={build_id}" data-atlas-runtime="current"></script>')
        else:
            classic_parts.append(boundary)
    flush_classic()

    # Same-origin governed snapshots stay available to active features.
    data_dir = ROOT / "data"
    if data_dir.exists():
        shutil.copytree(data_dir, out_dir / "data", dirs_exist_ok=True)

    # Static media are current assets and may be published as-is.
    assets_dir = ROOT / "assets"
    if assets_dir.exists():
        shutil.copytree(assets_dir, out_dir / "assets", dirs_exist_ok=True)
    for pattern in ("*.png", "*.svg", "*.ico", "*.webp", "*.jpg", "*.jpeg"):
        for src in ROOT.glob(pattern):
            copy_file(src, out_dir / src.name)

    template = (ROOT / "index.html").read_text(encoding="utf-8")
    template = re.sub(r'data-aml-version="[^"]+"', f'data-aml-version="{rel}"', template, count=1)
    template = re.sub(r'data-aml-build="[^"]+"', f'data-aml-build="{build_id}"', template, count=1)
    template = re.sub(r'data-atlas-release="[^"]+"', f'data-atlas-release="{rel}"', template, count=1)
    template = re.sub(r'<title>.*?</title>', f'<title>ATLAS AML · v{rel}</title>', template, count=1, flags=re.S)
    template = re.sub(r'\.\/atlas-release-guard\.js(?:\?[^"\']*)?', f'./atlas-release-guard.js?r={build_id}', template)
    template = re.sub(r'\.\/atlas-theme-bootstrap\.js(?:\?[^"\']*)?', f'./atlas-theme-bootstrap.js?r={build_id}', template)

    styles_tag = f'  <link rel="stylesheet" href="./{compiled_css}?r={build_id}" data-atlas-runtime="current" />'
    scripts = "\n".join(script_tags)
    if "<!-- ATLAS_RUNTIME_STYLES -->" not in template or "<!-- ATLAS_RUNTIME_SCRIPTS -->" not in template:
        raise SystemExit("index.html is missing ATLAS runtime placeholders")
    template = template.replace("<!-- ATLAS_RUNTIME_STYLES -->", styles_tag)
    template = template.replace("<!-- ATLAS_RUNTIME_SCRIPTS -->", scripts)

    if "?b=" in template:
        raise SystemExit("legacy ?b= cache key remains in built index")
    for source_name in source_assets:
        if f"./{source_name}" in template:
            raise SystemExit(f"source fragment leaked into production index: {source_name}")
    for name in forbidden:
        if name in template or (out_dir / name).exists():
            raise SystemExit(f"forbidden runtime asset leaked into Pages artifact: {name}")

    (out_dir / "index.html").write_text(template, encoding="utf-8")
    (out_dir / ".nojekyll").write_text("", encoding="utf-8")

    runtime_report = {
        "release": rel,
        "build": build_id,
        "policy": release["runtime_policy"],
        "publish_mode": runtime["publish_mode"],
        "source_style_fragments": len(runtime["styles"]),
        "source_script_fragments": len(runtime["scripts"]),
        "published_css": [compiled_css],
        "published_js": compiled_js,
        "historical_source_assets_published": False,
        "visible_version_authority": "atlas-release-guard.js",
    }
    (out_dir / "atlas-runtime-report.json").write_text(json.dumps(runtime_report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(runtime_report, ensure_ascii=False))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="_site")
    args = parser.parse_args()
    target = Path(args.out)
    if not target.is_absolute():
        target = (ROOT / target).resolve()
    build(target)


if __name__ == "__main__":
    main()
