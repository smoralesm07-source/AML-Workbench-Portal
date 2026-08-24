#!/usr/bin/env python3
"""Resilient wrapper for Mercado Público history ingestion.

The analytical load must not fail only because the optional RAW archive in R2
is temporarily unavailable. Source URL + SHA-256 remain recorded by the base
loader, while RAW archival can be repaired independently.
"""
from __future__ import annotations
import importlib.util
from pathlib import Path

BASE = Path(__file__).with_name('history_ingest.py')
spec = importlib.util.spec_from_file_location('atlas_mp_history_base', BASE)
if spec is None or spec.loader is None:
    raise RuntimeError('cannot load base Mercado Público history loader')
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

_state = {'raw_fallback': False, 'raw_error': None}
_original_upload = mod.upload_r2
_original_api = mod.api

def resilient_upload(path: Path, year: int, month: int) -> str:
    try:
        return _original_upload(path, year, month)
    except Exception as exc:
        _state['raw_fallback'] = True
        _state['raw_error'] = type(exc).__name__
        print(f'::warning::R2 RAW archival unavailable ({type(exc).__name__}); continuing analytical ingest with source hash traceability.')
        return f'source://mercado-publico/{year}/{month:02d}/{path.name}'

def resilient_api(payload: dict, timeout: int = 180):
    if payload.get('action') == 'finalize' and _state['raw_fallback']:
        payload = dict(payload)
        meta = dict(payload.get('metadata') or {})
        meta.update({
            'raw_backend': 'source_hash_only',
            'raw_archive_status': 'PENDING',
            'raw_archive_target': 'cloudflare_r2',
            'raw_archive_error_class': _state['raw_error'],
            'analytics_ingest_independent_of_raw_archive': True,
        })
        payload['metadata'] = meta
    return _original_api(payload, timeout=timeout)

mod.upload_r2 = resilient_upload
mod.api = resilient_api

if __name__ == '__main__':
    mod.main()
