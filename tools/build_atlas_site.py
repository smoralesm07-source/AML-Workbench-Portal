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


def build(out_dir: Path):
    release = load_json("atlas-release.json")
    runtime = load_json("atlas-runtime-manifest.json")
    build_meta = load_json("build.json")

    rel = str(release["release"])
    build_id = str(release["build"])
    assert runtime["release"] == rel and runtime["build"] == build_id
    assert build_meta["app_version"] == rel and build_meta["build"] == build_id
    assert release["deployment_policy"] == "SINGLE_ACTIVE_RELEASE"
    assert runtime["policy"] == "CANONICAL_ACTIVE_RUNTIME_ONLY"

    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True)

    # Canonical non-manifest boot files.
    boot_files = [
        "atlas-release.json",
        "atlas-runtime-manifest.json",
        "build.json",
        "atlas-release-guard.js",
        "v040-theme-bootstrap.js",
    ]
    for name in boot_files:
        copy_file(ROOT / name, out_dir / name)

    # Only declared active runtime assets are published. Historical overlays
    # remain in Git for traceability but are absent from the Pages artifact.
    active = []
    for name in runtime["styles"]:
        active.append(name)
        copy_file(ROOT / name, out_dir / name)
    for item in runtime["scripts"]:
        name = item["path"]
        active.append(name)
        copy_file(ROOT / name, out_dir / name)

    forbidden = set(runtime.get("forbidden_runtime_assets", []))
    collision = forbidden.intersection(active)
    if collision:
        raise SystemExit(f"forbidden runtime assets declared active: {sorted(collision)}")

    # Same-origin governed snapshots stay available to active features.
    data_dir = ROOT / "data"
    if data_dir.exists():
        shutil.copytree(data_dir, out_dir / "data", dirs_exist_ok=True)

    # Optional static media are safe to publish; no historical JS/CSS/HTML are
    # copied outside the explicit manifest.
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

    # Pin canonical boot assets to the same release build.
    template = re.sub(r'\.\/atlas-release-guard\.js(?:\?[^"\']*)?', f'./atlas-release-guard.js?r={build_id}', template)
    template = re.sub(r'\.\/v040-theme-bootstrap\.js(?:\?[^"\']*)?', f'./v040-theme-bootstrap.js?r={build_id}', template)

    styles = "\n".join(
        f'  <link rel="stylesheet" href="./{name}?r={build_id}" data-atlas-runtime-asset="{name}" />'
        for name in runtime["styles"]
    )
    scripts = []
    for item in runtime["scripts"]:
        name = item["path"]
        typ = item.get("type", "classic")
        type_attr = ' type="module"' if typ == "module" else ""
        scripts.append(f'  <script{type_attr} src="./{name}?r={build_id}" data-atlas-runtime-asset="{name}"></script>')
    scripts = "\n".join(scripts)

    if "<!-- ATLAS_RUNTIME_STYLES -->" not in template or "<!-- ATLAS_RUNTIME_SCRIPTS -->" not in template:
        raise SystemExit("index.html is missing ATLAS runtime placeholders")
    template = template.replace("<!-- ATLAS_RUNTIME_STYLES -->", styles)
    template = template.replace("<!-- ATLAS_RUNTIME_SCRIPTS -->", scripts)

    if "?b=" in template:
        raise SystemExit("legacy ?b= cache key remains in built index")
    for name in forbidden:
        if name in template:
            raise SystemExit(f"forbidden runtime asset leaked into built index: {name}")
    for name in active:
        if f'./{name}?r={build_id}' not in template:
            raise SystemExit(f"active runtime asset missing from built index: {name}")

    (out_dir / "index.html").write_text(template, encoding="utf-8")
    (out_dir / ".nojekyll").write_text("", encoding="utf-8")

    runtime_report = {
        "release": rel,
        "build": build_id,
        "policy": runtime["policy"],
        "active_style_count": len(runtime["styles"]),
        "active_script_count": len(runtime["scripts"]),
        "forbidden_runtime_assets": sorted(forbidden),
    }
    (out_dir / "atlas-runtime-report.json").write_text(
        json.dumps(runtime_report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(runtime_report, ensure_ascii=False))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="_site")
    args = parser.parse_args()
    build((ROOT / args.out).resolve() if not Path(args.out).is_absolute() else Path(args.out))


if __name__ == "__main__":
    main()
