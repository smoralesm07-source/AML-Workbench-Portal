#!/usr/bin/env python3
"""Reintento resiliente de recursos RES históricos puntuales.

Reutiliza el loader oficial de Atlas, sin scraping del sitio RES. Normaliza
variantes antiguas de URL de datos.gob.cl a HTTPS y reintenta fallos de red.
"""
from __future__ import annotations

import argparse
import json
import time
import urllib.parse

import ingest

ALLOWED_HOSTS = {"datos.gob.cl", "www.datos.gob.cl"}
DEFAULT_YEARS = (2018, 2019, 2020)


def canonical_url(value: object) -> str:
    raw = str(value or "").strip()
    parsed = urllib.parse.urlsplit(raw)
    host = (parsed.hostname or "").lower()
    if host not in ALLOWED_HOSTS or parsed.scheme.lower() not in {"http", "https"}:
        raise ValueError(f"Unexpected RES source URL: {raw[:180]}")
    # Datos.gob.cl has historical CKAN resources whose metadata may retain
    # http:// or www. variants. Always use the canonical HTTPS origin.
    return urllib.parse.urlunsplit(("https", "datos.gob.cl", parsed.path, parsed.query, parsed.fragment))


def run_year(package: dict, year: int, attempts: int) -> dict:
    resource = dict(ingest.select_resources(package, str(year), False)[0])
    original = str(resource.get("url") or "")
    resource["url"] = canonical_url(original)
    last: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            print(f"[RES-RETRY] {year} attempt {attempt}/{attempts} resource={resource.get('id')}")
            result = ingest.ingest_resource(resource, package.get("license_title") or package.get("license_id"))
            return {"year": year, "ok": True, "attempt": attempt, "result": result}
        except Exception as exc:
            last = exc
            print(f"[RES-RETRY] {year} attempt {attempt} failed: {type(exc).__name__}: {exc}")
            if attempt < attempts:
                time.sleep(min(20, 2 ** attempt))
    return {"year": year, "ok": False, "error": f"{type(last).__name__}: {last}" if last else "unknown"}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--years", nargs="+", type=int, default=list(DEFAULT_YEARS))
    parser.add_argument("--attempts", type=int, default=4)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        assert canonical_url("http://www.datos.gob.cl/a/b.csv") == "https://datos.gob.cl/a/b.csv"
        assert canonical_url("https://datos.gob.cl/x?q=1") == "https://datos.gob.cl/x?q=1"
        print("[OK] RES historical retry self-test")
        return 0
    if args.attempts < 1 or args.attempts > 8:
        raise SystemExit("--attempts must be between 1 and 8")
    ingest.api({"action": "health"})
    package = ingest.package_show()
    results = [run_year(package, year, args.attempts) for year in args.years]
    print(json.dumps({"ok": all(r["ok"] for r in results), "results": results}, ensure_ascii=False, default=str))
    return 0 if all(r["ok"] for r in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
