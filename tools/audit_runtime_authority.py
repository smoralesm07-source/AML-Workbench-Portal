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

SESSION_FORBIDDEN_PATTERNS = {
    'manual_set_session': re.compile(r'auth\.setSession\s*\('),
    'manual_refresh_token_payload': re.compile(r'refresh_token\s*:'),
}

LEGACY_AUTH_ASSET = 'assets/atlas-auth-stability-0440.js'
CURRENT_FINAL_AUTH_MARKER = 'SUPABASE_CLIENT_ONLY_NO_MANUAL_REPLAY'


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

    session_violations=[]
    for path in files:
        text=path.read_text(encoding='utf-8')
        for rule,pattern in SESSION_FORBIDDEN_PATTERNS.items():
            matches=list(pattern.finditer(text))
            if matches:
                lines=[text.count('\n',0,m.start())+1 for m in matches[:8]]
                session_violations.append((path.name,rule,lines))
    if session_violations:
        print('Compiled ATLAS session-authority violations detected:')
        for path,rule,lines in session_violations:
            print(f' - {path}: {rule} at line(s) {lines}')
        raise SystemExit(1)

    legacy_asset=root/LEGACY_AUTH_ASSET
    if legacy_asset.exists():
        raise SystemExit(f'Legacy auth runtime unexpectedly published: {LEGACY_AUTH_ASSET}')
    index_path=root/'index.html'
    if not index_path.is_file():
        raise SystemExit('Missing compiled index.html')
    index_text=index_path.read_text(encoding='utf-8')
    if 'atlas-auth-stability-0440.js' in index_text:
        raise SystemExit('Legacy auth runtime is still referenced by compiled index.html')

    release_guard=root/'atlas-release-guard.js'
    if not release_guard.is_file():
        raise SystemExit('Missing compiled atlas-release-guard.js')
    guard_text=release_guard.read_text(encoding='utf-8')
    forbidden_reload=[token for token in ('location.replace(', 'location.reload(', 'location.href=') if token in guard_text]
    if forbidden_reload:
        raise SystemExit(f'Active-session reload authority is forbidden in atlas-release-guard.js: {forbidden_reload}')
    if 'NO_ACTIVE_SESSION_RELOAD' not in guard_text:
        raise SystemExit('atlas-release-guard.js is missing NO_ACTIVE_SESSION_RELOAD reliability contract')

    if not modules:
        raise SystemExit('No compiled ATLAS modules found; final reliability authority missing')
    final_module=modules[-1]
    final_text=final_module.read_text(encoding='utf-8')
    required_final_markers=(
        '__ATLAS_RUNTIME_RELIABILITY__',
        CURRENT_FINAL_AUTH_MARKER,
        'ENTITY360_REFERENCE_0445_SIX_LENSES',
        'ENTITY360_INLINE_AUTOCOMPLETE_0447',
        'ENTITY360_ROUTE_AUTHORITY_0448',
        'ENTITY360_SII_DOCUMENT_AUTH_0449',
        '__ATLAS_ENTITY_AUTHORITY_FINAL__',
        'sixLensRendererPinned',
        'singleWorkspacePinned',
        'autocompletePinned',
        'siiDocumentAuthorizationPinned',
        'LATEST_OBSERVED_AUTHORIZATION_NOT_ABSOLUTE_LAST_TIMBRAJE',
    )
    missing=[m for m in required_final_markers if m not in final_text]
    if missing:
        raise SystemExit(f'Final runtime module {final_module.name} is missing reliability authority markers: {missing}')

    classic_text='\n'.join(p.read_text(encoding='utf-8') for p in classic)
    entity_markers=(
        'ENTITY360_HTML_PRODUCTION_ADAPTATION_0445',
        "['identity','01','Identidad']",
        "['character','02','Caracterización']",
        "['timeline','03','Cronología']",
        "['network','04','Red de exposición']",
        "['signals','05','Señales y convergencia']",
        "['evidence','06','Evidencia y decisión']",
        'ENTITY360_INLINE_AUTOCOMPLETE_0447',
        'SINGLE_DARK_DOSSIER_NO_SEPARATE_SEARCH_LANDING',
        'DEBOUNCED_AUTOCOMPLETE_RLS_NAME_RUT_ENTITY_ID_NO_FUZZY_JOIN',
        'selectionScopesAllEntityGraphics:true',
        'a47-entity-q',
        'ENTITY360_ROUTE_AUTHORITY_0448',
        'legacyCapturedLoaderBypassed:true',
        "if(view==='entities')return entityLoad(...args)",
        'aml_v0449_sii_latest_document_authorization',
        'LATEST_OBSERVED_AUTHORIZATION_NOT_ABSOLUTE_LAST_TIMBRAJE',
        'Última autorización documental observada',
        'MISSING_IS_NOT_NO_TIMBRAJE',
    )
    # MISSING_IS_NOT_NO_TIMBRAJE is a release/build contract rather than JS text.
    release_text=(root/'atlas-release.json').read_text(encoding='utf-8') if (root/'atlas-release.json').is_file() else ''
    missing_entity=[m for m in entity_markers if m not in classic_text and m not in release_text]
    if missing_entity:
        raise SystemExit(f'Compiled Entity 360 authority is incomplete: {missing_entity}')

    css_path=root/'atlas-runtime-current.css'
    if not css_path.is_file():
        raise SystemExit('Compiled current CSS missing')
    css_text=css_path.read_text(encoding='utf-8')
    for marker in ('.a47-search-shell','.a49-docauth'):
        if marker not in css_text:
            raise SystemExit(f'Compiled Entity 360 CSS missing marker: {marker}')

    reconciliation_markers=(
        'AtlasReconciliationFilters',
        "matrixVisible:false",
        "v0434Matrix=()=>''",
        'Filtros interactivos',
    )
    missing_recon=[m for m in reconciliation_markers if m not in classic_text]
    if missing_recon:
        raise SystemExit(f'Compiled reconciliation interaction authority is incomplete: {missing_recon}')

    print(
        f'ATLAS compiled runtime authority OK: {len(files)} bundle/module asset(s); '
        'atlas-release-guard.js remains the sole version authority; '
        f'{final_module.name} owns passive final session/Entity 360 authority; '
        'Entity 360 uses the six-lens dossier with persistent RLS autocomplete; '
        'the Entidades route bypasses the historical captured legacy loader; '
        'SII document authorization is read-only and explicitly latest-observed, not absolute last timbraje; '
        'reconciliation bubble matrix is removed and reversible cross-filters are active; '
        'legacy auth replay/reload runtime is absent'
    )


if __name__=='__main__':
    main()
