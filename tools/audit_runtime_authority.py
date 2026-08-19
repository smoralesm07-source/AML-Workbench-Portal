#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
from pathlib import Path

PATTERNS = {
    'writes_active_version': re.compile(r'(?:window\.)?__AML_ACTIVE_VERSION__\s*='),
    'writes_build': re.compile(r'(?:window\.)?__AML_BUILD__\s*='),
    'writes_atlas_version': re.compile(r'(?:window\.)?__ATLAS_ACTIVE_VERSION__\s*='),
    'writes_document_title': re.compile(r'document\.title\s*='),
    'writes_runtime_applier': re.compile(r'__AML_RUNTIME_VERSION_APPLIER__\s*='),
    'writes_root_version_attr': re.compile(r'(?:setAttribute\s*\(\s*["\']data-(?:aml-version|aml-build|atlas-release)["\']|dataset\.(?:amlVersion|amlBuild|atlasRelease)\s*=)'),
    'legacy_visible_version_literal': re.compile(r'Operational\s+Radar\s*·\s*v', re.I),
}


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--root',default='_site-test')
    args=parser.parse_args()
    root=Path(args.root)
    files=sorted(root.glob('atlas-runtime-current-*.js'))+sorted(root.glob('atlas-module-current-*.js'))
    if not files:
        raise SystemExit(f'No compiled ATLAS runtime files found in {root}')

    violations=[]
    for path in files:
        text=path.read_text(encoding='utf-8')
        for rule,pattern in PATTERNS.items():
            matches=list(pattern.finditer(text))
            if matches:
                lines=[text.count('\n',0,m.start())+1 for m in matches[:8]]
                violations.append((path.name,rule,lines))

    if violations:
        print('Compiled ATLAS runtime authority violations detected:')
        for path,rule,lines in violations:
            print(f' - {path}: {rule} at line(s) {lines}')
        raise SystemExit(1)

    print(f'ATLAS compiled runtime authority OK: {len(files)} bundle/module asset(s); atlas-release-guard.js remains the sole version authority')


if __name__=='__main__':
    main()
