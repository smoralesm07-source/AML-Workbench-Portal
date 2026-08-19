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
    classic=sorted(root.glob('atlas-runtime-current-*.js'))
    modules=sorted(root.glob('atlas-module-current-*.js'))
    files=classic+modules
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

    # Reliability contract 1: a release publication must never evict an active session.
    release_guard=root/'atlas-release-guard.js'
    if not release_guard.is_file():
        raise SystemExit('Missing compiled atlas-release-guard.js')
    guard_text=release_guard.read_text(encoding='utf-8')
    forbidden_reload=[token for token in ('location.replace(', 'location.reload(', 'location.href=') if token in guard_text]
    if forbidden_reload:
        raise SystemExit(f'Active-session reload authority is forbidden in atlas-release-guard.js: {forbidden_reload}')
    if 'NO_ACTIVE_SESSION_RELOAD' not in guard_text:
        raise SystemExit('atlas-release-guard.js is missing NO_ACTIVE_SESSION_RELOAD reliability contract')

    # Reliability contract 2: the final module must own auth recovery + approved Entity 360.
    if not modules:
        raise SystemExit('No compiled ATLAS modules found; final reliability authority missing')
    final_module=modules[-1]
    final_text=final_module.read_text(encoding='utf-8')
    required_final_markers=(
        '__ATLAS_RUNTIME_RELIABILITY__',
        'DOUBLE_SESSION_CHECK+SERVER_TOKEN_VERIFY',
        'V0391_ENTRY+V038_ENTITY360',
        '__ATLAS_ENTITY_AUTHORITY_FINAL__',
    )
    missing=[m for m in required_final_markers if m not in final_text]
    if missing:
        raise SystemExit(f'Final runtime module {final_module.name} is missing reliability authority markers: {missing}')

    # Reliability contract 3: expert Entity 360 source must be present in compiled classic runtime.
    classic_text='\n'.join(p.read_text(encoding='utf-8') for p in classic)
    entity_markers=(
        'ENTITY 360 · ACCESO ANALÍTICO',
        'ENTITY360_EXPERT_CURRENT',
        'PLANNED_LANDING_EXACT_ON_DEMAND_ONLY',
    )
    missing_entity=[m for m in entity_markers if m not in classic_text]
    if missing_entity:
        raise SystemExit(f'Compiled Entity 360 authority is incomplete: {missing_entity}')

    print(
        f'ATLAS compiled runtime authority OK: {len(files)} bundle/module asset(s); '
        'atlas-release-guard.js remains the sole version authority; '
        f'{final_module.name} owns final session/Entity 360 reliability authority'
    )


if __name__=='__main__':
    main()
