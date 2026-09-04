#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def fail(message: str) -> None:
    raise SystemExit(f"[SECURITY-PREQA] FAIL: {message}")


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def scan_source_tree() -> list[str]:
    findings: list[str] = []
    secret_patterns = {
        "Supabase secret key": re.compile(r"\bsb_secret_[A-Za-z0-9._-]+"),
        "Supabase service role assignment": re.compile(r"SUPABASE_SERVICE_ROLE_KEY\s*="),
        "private key material": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    }
    dynamic_code = {
        "eval": re.compile(r"\beval\s*\("),
        "Function constructor": re.compile(r"\bnew\s+Function\s*\("),
    }
    ignored = {"_site", "_site-security", ".git", "node_modules"}
    for path in ROOT.rglob("*"):
        if not path.is_file() or any(part in ignored for part in path.parts):
            continue
        if path.suffix.lower() not in {".js", ".mjs", ".html", ".yml", ".yaml", ".py"}:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        rel = path.relative_to(ROOT).as_posix()
        for label, pattern in secret_patterns.items():
            if pattern.search(text):
                findings.append(f"{label}: {rel}")
        if path.suffix.lower() in {".js", ".mjs", ".html"}:
            for label, pattern in dynamic_code.items():
                if pattern.search(text):
                    findings.append(f"dynamic code ({label}): {rel}")
    return findings


def validate_site(site: Path) -> None:
    if not site.is_dir():
        fail(f"built site not found: {site}")

    release = load_json(ROOT / "atlas-release.json")
    runtime = load_json(ROOT / "atlas-runtime-manifest.json")
    build = load_json(ROOT / "build.json")
    rel = str(release["release"])
    bid = str(release["build"])

    if runtime.get("release") != rel or str(runtime.get("build")) != bid:
        fail("atlas-runtime-manifest.json does not match atlas-release.json")
    if build.get("app_version") != rel or str(build.get("build")) != bid:
        fail("build.json does not match atlas-release.json")

    html_path = site / "index.html"
    if not html_path.is_file():
        fail("built index.html is missing")
    html = html_path.read_text(encoding="utf-8")

    required = [
        f'data-aml-version="{rel}"',
        f'data-aml-build="{bid}"',
        f'data-atlas-release="{rel}"',
        f'<title>ATLAS AML · v{rel}</title>',
        "object-src 'none'",
        "base-uri 'none'",
    ]
    for token in required:
        if token not in html:
            fail(f"built index is missing security/release token: {token}")

    if "'unsafe-eval'" in html or "'unsafe-inline'" in html:
        fail("CSP enables unsafe-eval or unsafe-inline")

    scripts = re.findall(r'<script\b[^>]*\bsrc=["\']([^"\']+)["\']', html, flags=re.I)
    styles = re.findall(r'<link\b[^>]*\brel=["\']stylesheet["\'][^>]*\bhref=["\']([^"\']+)["\']', html, flags=re.I)
    for kind, values in (("script", scripts), ("stylesheet", styles)):
        duplicates = [x for x, n in Counter(values).items() if n > 1]
        if duplicates:
            fail(f"duplicate {kind} references in built index: {duplicates}")

    remote_scripts = [src for src in scripts if re.match(r"^https?://", src, flags=re.I)]
    if remote_scripts:
        fail(f"remote executable scripts present in built index: {remote_scripts}")

    declared = [x["path"] for x in runtime.get("scripts", [])] + list(runtime.get("styles", []))
    leaked = [name for name in declared if (site / name).is_file()]
    if leaked:
        fail(f"runtime source fragments leaked into published artifact: {leaked[:20]}")

    legacy = [
        "v037-public-spend.js",
        "atlas-auth-stability-0440.js",
        "atlas-public-spend-mobile-route-0573.js",
        "atlas-public-spend-guided-0570.js",
        "atlas-data-audit.js",
    ]
    for name in legacy:
        if name in html:
            fail(f"retired runtime referenced by built index: {name}")

    op = (ROOT / "assets" / "atlas-operational-recovery-0704.js").read_text(encoding="utf-8")
    if f"RELEASE='{rel}',BUILD='{bid}'" not in op:
        fail("operational recovery runtime publishes stale release/build metadata")

    source_findings = scan_source_tree()
    if source_findings:
        fail("source scan findings: " + "; ".join(source_findings[:20]))

    print(json.dumps({
        "status": "ok",
        "release": rel,
        "build": bid,
        "script_refs": len(scripts),
        "stylesheet_refs": len(styles),
        "checks": [
            "release coherence",
            "CSP unsafe directives",
            "duplicate executable/style references",
            "no remote executable scripts",
            "no manifest source fragments in Pages artifact",
            "retired runtime exclusion",
            "runtime release metadata coherence",
            "high-risk secret/dynamic-code source scan",
        ],
    }, ensure_ascii=False))


def main() -> None:
    parser = argparse.ArgumentParser(description="ATLAS security pre-QA validator")
    parser.add_argument("--site", default="_site-security", help="built Pages artifact directory")
    args = parser.parse_args()
    validate_site(ROOT / args.site)


if __name__ == "__main__":
    main()
