#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = json.loads((ROOT / 'atlas-runtime-manifest.json').read_text(encoding='utf-8'))

# Active feature modules are never allowed to become release/version authorities.
# atlas-release-guard.js is intentionally outside the runtime manifest and is the
# sole owner of release globals, document title and visible version labels.
PATTERNS = {
    'writes_active_version': re.compile(r'(?:window\.)?__AML_ACTIVE_VERSION__\s*='),
    'writes_build': re.compile(r'(?:window\.)?__AML_BUILD__\s*='),
    'writes_atlas_version': re.compile(r'(?:window\.)?__ATLAS_ACTIVE_VERSION__\s*='),
    'writes_document_title': re.compile(r'document\.title\s*='),
    'writes_runtime_applier': re.compile(r'__AML_RUNTIME_VERSION_APPLIER__\s*='),
    'writes_root_version_attr': re.compile(r'(?:setAttribute\s*\(\s*["\']data-(?:aml-version|aml-build|atlas-release)["\']|dataset\.(?:amlVersion|amlBuild|atlasRelease)\s*=)'),
    'legacy_visible_version_literal': re.compile(r'Operational\s+Radar\s*·\s*v', re.I),
}

# Current UI may request the canonical guard to re-apply after shell rebuilds,
# but it must not own version globals/title itself.
violations = []
for item in MANIFEST['scripts']:
    path = ROOT / item['path']
    text = path.read_text(encoding='utf-8')
    for rule, pattern in PATTERNS.items():
        matches = list(pattern.finditer(text))
        if matches:
            lines = []
            for match in matches[:5]:
                line = text.count('\n', 0, match.start()) + 1
                lines.append(line)
            violations.append((item['path'], rule, lines))

if violations:
    print('ATLAS runtime authority violations detected:')
    for path, rule, lines in violations:
        print(f' - {path}: {rule} at line(s) {lines}')
    raise SystemExit(1)

print(f"ATLAS runtime authority OK: {len(MANIFEST['scripts'])} active scripts delegate version identity to atlas-release-guard.js")
