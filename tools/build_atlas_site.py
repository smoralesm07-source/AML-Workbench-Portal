#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LEGACY_UNPUBLISHED_ASSETS = {"atlas-auth-stability-0440.js"}
RETIRED_PUBLIC_SPEND_FRAGMENTS = {"v037-public-spend.css", "v037-public-spend.js"}
GP2_CSS = "assets/atlas-public-spend-v2.css"
GP2_JS = "assets/atlas-public-spend-v2.js"
GP2_AUTH = "assets/atlas-public-spend-route-authority-0578.js"
GP2_VERSION = "gp2-2"
GP2_AUTH_VERSION = "gp2-a3"
CRITICAL_RUNTIME_PATHS = {
    "v0333-auth-preflight.js",
    "app.js",
    "v0422-auth-bootstrap-fix.js",
}
MAX_DEFERRED_CLASSIC_BYTES = 110 * 1024
LEGACY_PUBLIC_SPEND_STANDALONES = [
    "atlas-public-spend-signal-command-v2",
    "atlas-public-spend-mark-taxonomy-v3",
    "atlas-public-spend-audit-0550",
    "atlas-public-spend-peers-0551",
    "atlas-public-spend-prices-0552",
    "atlas-public-spend-guided-0570",
    "atlas-public-spend-context-0571",
    "atlas-public-spend-progressive-0577",
    "atlas-public-spend-mobile-route-0573",
    "atlas-public-spend-route-authority-0578",
]


def load_json(name: str):
    return json.loads((ROOT / name).read_text(encoding="utf-8"))


def copy_file(src: Path, dst: Path):
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)


def sanitize_legacy_authority(text: str) -> str:
    """Turn historical version writers into delegates to the current guard."""
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


def strip_legacy_public_spend_tags(template: str) -> str:
    for stem in LEGACY_PUBLIC_SPEND_STANDALONES:
        template = re.sub(
            rf"\s*<link[^>]+href=['\"]\.\/assets\/{re.escape(stem)}\.css(?:\?[^'\"]*)?['\"][^>]*>\s*",
            "\n",
            template,
            flags=re.I,
        )
        template = re.sub(
            rf"\s*<script[^>]+src=['\"]\.\/assets\/{re.escape(stem)}\.js(?:\?[^'\"]*)?['\"][^>]*>\s*<\/script>\s*",
            "\n",
            template,
            flags=re.I,
        )
    return template


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

    for name in ["atlas-release.json", "atlas-runtime-manifest.json", "build.json", "atlas-release-guard.js", "atlas-theme-bootstrap.js"]:
        copy_file(ROOT / name, out_dir / name)

    runtime_styles = [name for name in runtime["styles"] if name not in RETIRED_PUBLIC_SPEND_FRAGMENTS]
    runtime_scripts = [item for item in runtime["scripts"] if item["path"] not in RETIRED_PUBLIC_SPEND_FRAGMENTS]
    forbidden = set(runtime.get("forbidden_runtime_assets", []))
    source_assets = [*runtime_styles, *[item["path"] for item in runtime_scripts]]
    collision = forbidden.intersection(source_assets)
    if collision:
        raise SystemExit(f"forbidden runtime assets declared as source fragments: {sorted(collision)}")

    declared_critical = [item["path"] for item in runtime_scripts if item["path"] in CRITICAL_RUNTIME_PATHS]
    if declared_critical != ["v0333-auth-preflight.js", "app.js", "v0422-auth-bootstrap-fix.js"]:
        raise SystemExit(f"critical startup order changed unexpectedly: {declared_critical}")

    css_parts = ["/* ATLAS AML compiled current stylesheet. Source fragments are Git-only. */"]
    for name in runtime_styles:
        src = ROOT / name
        if not src.is_file():
            raise SystemExit(f"missing style source fragment: {name}")
        css_parts.append(f"\n/* ---- source: {name} ---- */\n{src.read_text(encoding='utf-8')}\n")
    compiled_css = "atlas-runtime-current.css"
    (out_dir / compiled_css).write_text("\n".join(css_parts), encoding="utf-8")

    compiled_js: list[str] = []
    critical_parts: list[str] = []
    deferred_entries: list[dict[str, str]] = []
    deferred_parts: list[str] = []
    deferred_bytes = 0
    deferred_index = 0
    module_index = 0

    def transformed_boundary(source_name: str) -> str:
        src = ROOT / source_name
        if not src.is_file():
            raise SystemExit(f"missing script source fragment: {source_name}")
        transformed = sanitize_legacy_authority(src.read_text(encoding="utf-8"))
        return f"/* ---- source fragment: {source_name} ---- */\n{transformed}\nwindow.AtlasRelease?.apply?.();"

    for item in runtime_scripts:
        if item["path"] in CRITICAL_RUNTIME_PATHS:
            if item.get("type", "classic") != "classic":
                raise SystemExit(f"critical startup script must be classic: {item['path']}")
            critical_parts.append(transformed_boundary(item["path"]))

    critical_name = "atlas-runtime-critical.js"
    critical_body = [
        "'use strict';",
        "/* ATLAS AML critical startup runtime: auth preflight + core + bounded auth rescue only. */",
        *critical_parts,
        "window.AtlasRelease?.apply?.();",
    ]
    (out_dir / critical_name).write_text("\n\n".join(critical_body) + "\n", encoding="utf-8")
    compiled_js.append(critical_name)

    def flush_deferred():
        nonlocal deferred_index, deferred_parts, deferred_bytes
        if not deferred_parts:
            return
        deferred_index += 1
        name = f"atlas-runtime-deferred-{deferred_index:02d}.js"
        body = [
            "'use strict';",
            "/* ATLAS AML deferred feature runtime chunk. */",
            *deferred_parts,
            "window.AtlasRelease?.apply?.();",
        ]
        (out_dir / name).write_text("\n\n".join(body) + "\n", encoding="utf-8")
        compiled_js.append(name)
        deferred_entries.append({"src": f"./{name}?r={build_id}", "type": "classic"})
        deferred_parts = []
        deferred_bytes = 0

    for item in runtime_scripts:
        source_name = item["path"]
        if source_name in CRITICAL_RUNTIME_PATHS:
            continue
        boundary = transformed_boundary(source_name)
        if item.get("type", "classic") == "module":
            flush_deferred()
            module_index += 1
            module_name = f"atlas-module-deferred-{module_index:02d}.js"
            transformed = sanitize_legacy_authority((ROOT / source_name).read_text(encoding="utf-8"))
            (out_dir / module_name).write_text(
                f"/* ATLAS AML deferred module. Source: {source_name} */\n{transformed}\n",
                encoding="utf-8",
            )
            compiled_js.append(module_name)
            deferred_entries.append({"src": f"./{module_name}?r={build_id}", "type": "module"})
            continue

        boundary_bytes = len(boundary.encode("utf-8"))
        if deferred_parts and deferred_bytes + boundary_bytes > MAX_DEFERRED_CLASSIC_BYTES:
            flush_deferred()
        deferred_parts.append(boundary)
        deferred_bytes += boundary_bytes
    flush_deferred()

    deferred_entries.extend([
        {"src": f"./{GP2_JS}?v={GP2_VERSION}", "type": "classic"},
        {"src": f"./{GP2_AUTH}?v={GP2_AUTH_VERSION}", "type": "classic"},
    ])

    loader_name = "atlas-runtime-loader.js"
    loader_entries = json.dumps(deferred_entries, ensure_ascii=False, separators=(",", ":"))
    loader_body = f"""'use strict';
/* ATLAS AML cooperative deferred loader. Never block first paint/auth bootstrap with feature layers. */
(function(){{
  const entries={loader_entries};
  const started=performance.now();
  const state=window.__ATLAS_RUNTIME_LOAD__={{phase:'waiting-for-shell',total:entries.length,loaded:0,startedAt:new Date().toISOString()}};
  const sleep=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
  const yieldThread=()=>new Promise(resolve=>{{
    if('requestIdleCallback' in window) requestIdleCallback(()=>resolve(),{{timeout:250}});
    else setTimeout(resolve,0);
  }});
  const ready=()=>!!document.querySelector('#app .shell, #app #login, #app #logout');
  async function waitForBootSurface(){{
    const deadline=performance.now()+2600;
    while(!ready()&&performance.now()<deadline) await sleep(50);
  }}
  function loadOne(entry){{
    return new Promise((resolve,reject)=>{{
      const script=document.createElement('script');
      if(entry.type==='module') script.type='module';
      script.src=entry.src;
      script.async=false;
      script.dataset.atlasRuntime='deferred';
      script.onload=()=>resolve();
      script.onerror=()=>reject(new Error(`No fue posible cargar ${{entry.src}}`));
      document.body.appendChild(script);
    }});
  }}
  async function run(){{
    await waitForBootSurface();
    state.phase='loading';
    for(const entry of entries){{
      await yieldThread();
      try{{ await loadOne(entry); }}
      catch(error){{
        console.error('[ATLAS] deferred runtime chunk failed',entry.src,error);
        state.lastError=String(error?.message||error);
      }}
      state.loaded++;
    }}
    state.phase='ready';
    state.durationMs=Math.round(performance.now()-started);
    state.completedAt=new Date().toISOString();
    window.dispatchEvent(new CustomEvent('atlas:runtime-ready',{{detail:state}}));
  }}
  setTimeout(()=>void run(),0);
}})();
"""
    (out_dir / loader_name).write_text(loader_body, encoding="utf-8")
    compiled_js.append(loader_name)

    data_dir = ROOT / "data"
    if data_dir.exists():
        shutil.copytree(data_dir, out_dir / "data", dirs_exist_ok=True)

    assets_dir = ROOT / "assets"
    if assets_dir.exists():
        shutil.copytree(
            assets_dir,
            out_dir / "assets",
            dirs_exist_ok=True,
            ignore=shutil.ignore_patterns(*sorted(LEGACY_UNPUBLISHED_ASSETS)),
        )
    for pattern in ("*.png", "*.svg", "*.ico", "*.webp", "*.jpg", "*.jpeg"):
        for src in ROOT.glob(pattern):
            copy_file(src, out_dir / src.name)

    for required in [GP2_CSS, GP2_JS, GP2_AUTH]:
        if not (ROOT / required).is_file():
            raise SystemExit(f"missing native public-spend asset: {required}")

    template = (ROOT / "index.html").read_text(encoding="utf-8")
    template = strip_legacy_public_spend_tags(template)
    template = re.sub(r'data-aml-version="[^"]+"', f'data-aml-version="{rel}"', template, count=1)
    template = re.sub(r'data-aml-build="[^"]+"', f'data-aml-build="{build_id}"', template, count=1)
    template = re.sub(r'data-atlas-release="[^"]+"', f'data-atlas-release="{rel}"', template, count=1)
    template = re.sub(r'<title>.*?</title>', f'<title>ATLAS AML · v{rel}</title>', template, count=1, flags=re.S)
    template = re.sub(r'\.\/atlas-release-guard\.js(?:\?[^"\']*)?', f'./atlas-release-guard.js?r={build_id}', template)
    template = re.sub(r'\.\/atlas-theme-bootstrap\.js(?:\?[^"\']*)?', f'./atlas-theme-bootstrap.js?r={build_id}', template)

    styles_tag = "\n".join([
        f'  <link rel="stylesheet" href="./{compiled_css}?r={build_id}" data-atlas-runtime="current" />',
        f'  <link rel="stylesheet" href="./{GP2_CSS}?v={GP2_VERSION}" data-atlas-public-spend="GP2" />',
    ])
    scripts = "\n".join([
        f'  <script src="./{critical_name}?r={build_id}" data-atlas-runtime="critical"></script>',
        f'  <script src="./{loader_name}?r={build_id}" data-atlas-runtime="loader"></script>',
    ])
    if "<!-- ATLAS_RUNTIME_STYLES -->" not in template or "<!-- ATLAS_RUNTIME_SCRIPTS -->" not in template:
        raise SystemExit("index.html is missing ATLAS runtime placeholders")
    template = template.replace("<!-- ATLAS_RUNTIME_STYLES -->", styles_tag)
    template = template.replace("<!-- ATLAS_RUNTIME_SCRIPTS -->", scripts)

    if "?b=" in template:
        raise SystemExit("legacy ?b= cache key remains in built index")
    if "atlas-auth-stability-0440.js" in template:
        raise SystemExit("legacy standalone auth runtime remains in built index")
    for legacy in ["v037-public-spend.js", "atlas-public-spend-mobile-route-0573.js", "atlas-public-spend-guided-0570.js", "atlas-public-spend-audit-0550.js", "atlas-public-spend-progressive-0577.css"]:
        if legacy in template:
            raise SystemExit(f"legacy public-spend runtime remains in built index: {legacy}")
    if f"{GP2_CSS}?v={GP2_VERSION}" not in template:
        raise SystemExit("native public-spend GP2 stylesheet missing from built index")
    for retired in RETIRED_PUBLIC_SPEND_FRAGMENTS:
        compiled_targets = [out_dir / compiled_css, *[out_dir / name for name in compiled_js]]
        if any(retired in p.read_text(encoding="utf-8", errors="ignore") for p in compiled_targets if p.is_file()):
            raise SystemExit(f"retired public-spend fragment leaked into compiled runtime: {retired}")
    for source_name in source_assets:
        if f"./{source_name}" in template:
            raise SystemExit(f"source fragment leaked into production index: {source_name}")
    for name in forbidden:
        if name in template or (out_dir / name).exists():
            raise SystemExit(f"forbidden runtime asset leaked into Pages artifact: {name}")
    for name in LEGACY_UNPUBLISHED_ASSETS:
        if (out_dir / "assets" / name).exists():
            raise SystemExit(f"legacy executable asset leaked into Pages artifact: assets/{name}")

    (out_dir / "index.html").write_text(template, encoding="utf-8")
    (out_dir / ".nojekyll").write_text("", encoding="utf-8")

    critical_kib = round((out_dir / critical_name).stat().st_size / 1024, 1)
    runtime_report = {
        "release": rel,
        "build": build_id,
        "policy": release["runtime_policy"],
        "publish_mode": runtime["publish_mode"],
        "startup_policy": "CRITICAL_BOOT_ONLY_THEN_COOPERATIVE_DEFERRED_FEATURE_CHUNKS",
        "source_style_fragments": len(runtime_styles),
        "source_script_fragments": len(runtime_scripts),
        "critical_source_fragments": declared_critical,
        "critical_bundle": critical_name,
        "critical_bundle_kib": critical_kib,
        "deferred_chunk_count": len(deferred_entries),
        "deferred_chunk_max_source_bytes": MAX_DEFERRED_CLASSIC_BYTES,
        "retired_public_spend_fragments": sorted(RETIRED_PUBLIC_SPEND_FRAGMENTS),
        "published_css": [compiled_css, GP2_CSS],
        "published_js": compiled_js,
        "historical_source_assets_published": False,
        "legacy_auth_runtime_published": False,
        "public_spend_runtime": f"{GP2_JS}?v={GP2_VERSION}",
        "public_spend_authority": f"{GP2_AUTH}?v={GP2_AUTH_VERSION}",
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
