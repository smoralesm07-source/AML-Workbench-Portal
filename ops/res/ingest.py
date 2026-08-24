#!/usr/bin/env python3
"""Carga operativa del Registro de Empresas y Sociedades (RES) en Atlas.

Principios:
- Consume exclusivamente recursos oficiales publicados en Datos.gob.cl.
- NO automatiza ni raspa registrodeempresasysociedades.cl.
- Usa GitHub OIDC para escribir a Supabase; no requiere service_role en GitHub.
- La identidad societaria se enlaza sólo por RUT exacto.
- No infiere socios/accionistas/administradores desde datos que no los contienen.

Uso:
  python ops/res/ingest.py --year current
  python ops/res/ingest.py --year 2025
  python ops/res/ingest.py --all
  python ops/res/ingest.py --self-test
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import hashlib
import json
import os
import re
import shutil
import tempfile
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

DATASET_ID = "363edd60-4919-4ff1-b85f-f8e14d61285a"
INGEST = "https://ldmtlwzqaqmegedktlxr.supabase.co/functions/v1/aml-res-ingest"
AUD = "atlas-res-ingest"
UA = "Atlas-RES-Ingest/1.0 (+Datos.gob.cl; no-RES-site-scraping)"
CKAN_ENDPOINTS = (
    "https://datos.gob.cl/api/3/action/package_show",
    "https://datos.gob.cl/es/api/3/action/package_show",
)
TOK = {"value": None, "at": 0.0}

ALIASES = {
    "source_record_id": ("ID", "_id", "id"),
    "rut": ("RUT", "Rut"),
    "legal_name": ("Razon Social", "Razón Social", "RazonSocial"),
    "constitution_date": ("Fecha de actuacion (1era firma)", "Fecha de actuación (1era firma)", "Fecha de actuacion"),
    "registry_date": ("Fecha de registro (ultima firma)", "Fecha de registro (última firma)", "Fecha de registro"),
    "sii_approval_date": ("Fecha de aprobacion x SII", "Fecha de aprobación x SII"),
    "source_year": ("Anio", "Año", "Ano"),
    "source_month": ("Mes",),
    "tax_commune": ("Comuna Tributaria",),
    "tax_region": ("Region Tributaria", "Región Tributaria"),
    "company_code": ("Codigo de sociedad", "Código de sociedad", "Codigo sociedad"),
    "actuation_type": ("Tipo de actuacion", "Tipo de actuación", "Tipo actuacion"),
    "capital": ("Capital",),
    "social_commune": ("Comuna Social",),
    "social_region": ("Region Social", "Región Social"),
}


def norm(value: object) -> str:
    text = unicodedata.normalize("NFD", str(value or ""))
    return text.encode("ascii", "ignore").decode().lower()


def key(value: object) -> str:
    return re.sub(r"[^a-z0-9]", "", norm(value))


def resolve(fields: list[str] | None) -> dict[str, str]:
    by = {key(x): x for x in (fields or []) if x}
    out: dict[str, str] = {}
    for canonical, aliases in ALIASES.items():
        for alias in aliases:
            if key(alias) in by:
                out[canonical] = by[key(alias)]
                break
    return out


def rut_parts(value: object) -> tuple[str | None, str | None]:
    cleaned = re.sub(r"[^0-9Kk]", "", str(value or "")).upper()
    if len(cleaned) < 2:
        return None, None
    return f"{cleaned[:-1]}-{cleaned[-1]}", cleaned


def date_iso(value: object) -> str | None:
    text = str(value or "").strip()
    if not text:
        return None
    for fmt in (None, "%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y %H:%M:%S", "%d/%m/%Y %H:%M:%S"):
        try:
            parsed = dt.datetime.fromisoformat(text.replace("Z", "+00:00")) if fmt is None else dt.datetime.strptime(text, fmt)
            return parsed.date().isoformat()
        except (ValueError, TypeError):
            pass
    return None


def integer(value: object) -> int | None:
    text = re.sub(r"[^0-9-]", "", str(value or "").strip())
    try:
        return int(text) if text else None
    except ValueError:
        return None


def number(value: object) -> float | None:
    text = str(value or "").strip().replace("\xa0", "").replace(" ", "")
    if not text:
        return None
    if "," in text and "." in text:
        text = text.replace(".", "").replace(",", ".") if text.rfind(",") > text.rfind(".") else text.replace(",", "")
    elif "," in text:
        text = text.replace(",", ".")
    text = re.sub(r"[^0-9.\-]", "", text)
    try:
        return float(text) if text else None
    except ValueError:
        return None


def token() -> str:
    now = time.time()
    if TOK["value"] and now - float(TOK["at"]) < 210:
        return str(TOK["value"])
    base = os.environ.get("ACTIONS_ID_TOKEN_REQUEST_URL", "")
    secret = os.environ.get("ACTIONS_ID_TOKEN_REQUEST_TOKEN", "")
    if not base or not secret:
        raise RuntimeError("GitHub OIDC unavailable")
    sep = "&" if "?" in base else "?"
    req = urllib.request.Request(
        base + sep + "audience=" + urllib.parse.quote(AUD),
        headers={"Authorization": "bearer " + secret, "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=30) as response:
        value = json.load(response).get("value")
    if not value:
        raise RuntimeError("OIDC token missing")
    TOK.update(value=value, at=now)
    return str(value)


def api(payload: dict, timeout: int = 180) -> dict:
    raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), default=str).encode()
    for _ in range(2):
        req = urllib.request.Request(
            INGEST,
            data=raw,
            headers={"Authorization": "Bearer " + token(), "Content-Type": "application/json", "User-Agent": UA},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as response:
                out = json.load(response)
            if not out.get("ok"):
                raise RuntimeError(out.get("error") or "RES ingest rejected")
            return out
        except urllib.error.HTTPError as exc:
            if exc.code == 401:
                TOK.update(value=None, at=0.0)
                continue
            body = exc.read().decode("utf-8", "replace")[:700]
            raise RuntimeError(f"RES ingest HTTP {exc.code}: {body}") from exc
    raise RuntimeError("OIDC authentication failed")


def package_show() -> dict:
    query = urllib.parse.urlencode({"id": DATASET_ID})
    last: Exception | None = None
    for base in CKAN_ENDPOINTS:
        req = urllib.request.Request(f"{base}?{query}", headers={"User-Agent": UA, "Accept": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=60) as response:
                payload = json.load(response)
            if payload.get("success") and isinstance(payload.get("result"), dict):
                return payload["result"]
        except Exception as exc:
            last = exc
    raise RuntimeError(f"CKAN RES unavailable: {type(last).__name__ if last else 'unknown'}")


def resource_year(resource: dict) -> int | None:
    text = " ".join(str(resource.get(k) or "") for k in ("name", "url", "description"))
    years = [int(x) for x in re.findall(r"\b20\d{2}\b", text)]
    return max(years) if years else None


def is_res_csv(resource: dict) -> bool:
    fmt = str(resource.get("format") or "").lower()
    text = " ".join(str(resource.get(k) or "") for k in ("name", "url", "description")).lower()
    return fmt == "csv" and ("constit" in text or "sociedad" in text or "empresa" in text)


def select_resources(package: dict, year: str | None, all_years: bool) -> list[dict]:
    resources = [r for r in package.get("resources") or [] if isinstance(r, dict) and is_res_csv(r)]
    if not resources:
        raise RuntimeError("No RES CSV resources discovered in official package")
    if all_years:
        return sorted(resources, key=lambda r: (resource_year(r) or 0, str(r.get("name") or "")))
    target = dt.date.today().year if year in (None, "current") else int(str(year))
    selected = [r for r in resources if resource_year(r) == target]
    if not selected:
        raise RuntimeError(f"Official RES package has no CSV resource resolved for year {target}")
    # A year may have superseded files. Prefer newest metadata timestamp/name.
    selected.sort(key=lambda r: str(r.get("last_modified") or r.get("created") or ""), reverse=True)
    return [selected[0]]


def valid_source_url(url: str) -> None:
    parsed = urllib.parse.urlsplit(url)
    host = (parsed.hostname or "").lower()
    if parsed.scheme != "https" or host != "datos.gob.cl":
        raise ValueError("Unexpected RES source URL; only datos.gob.cl is allowed")


def download(url: str, dest: Path) -> tuple[str, int]:
    valid_source_url(url)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    sha = hashlib.sha256()
    size = 0
    with urllib.request.urlopen(req, timeout=600) as response, dest.open("wb") as out:
        while True:
            block = response.read(1024 * 1024)
            if not block:
                break
            out.write(block)
            sha.update(block)
            size += len(block)
    return sha.hexdigest(), size


def encoding(path: Path) -> str:
    raw = path.open("rb").read(65536)
    try:
        raw.decode("utf-8-sig")
        return "utf-8-sig"
    except UnicodeDecodeError:
        return "latin-1"


def dialect(sample: str):
    try:
        return csv.Sniffer().sniff(sample[:12000], delimiters=";,\t|")
    except csv.Error:
        class Semi(csv.excel):
            delimiter = ";"
        return Semi()


def batches(rows: list[dict], size: int):
    for i in range(0, len(rows), size):
        yield rows[i:i + size]


def parse_csv(path: Path, snapshot_id: str, source_url: str, sha256: str) -> tuple[list[dict], dict]:
    rows: list[dict] = []
    total = with_rut = with_name = with_date = 0
    min_date: str | None = None
    max_date: str | None = None
    with path.open("r", encoding=encoding(path), newline="") as fh:
        sample = fh.read(12000)
        fh.seek(0)
        reader = csv.DictReader(fh, dialect=dialect(sample))
        mapping = resolve(reader.fieldnames)
        required = {"rut", "legal_name"}
        if not required.issubset(mapping):
            raise RuntimeError("RES required columns unresolved: " + ",".join(sorted(required - set(mapping))))

        def get(row: dict, canonical: str):
            raw = mapping.get(canonical)
            return row.get(raw) if raw else None

        for raw_row in reader:
            total += 1
            formatted_rut, rut_key = rut_parts(get(raw_row, "rut"))
            legal_name = str(get(raw_row, "legal_name") or "").strip()
            if not formatted_rut or not rut_key or not legal_name:
                continue
            with_rut += 1
            with_name += 1
            constitution_date = date_iso(get(raw_row, "constitution_date"))
            if constitution_date:
                with_date += 1
                min_date = constitution_date if min_date is None or constitution_date < min_date else min_date
                max_date = constitution_date if max_date is None or constitution_date > max_date else max_date
            actuation = str(get(raw_row, "actuation_type") or "CONSTITUCIÓN").strip() or "CONSTITUCIÓN"
            row = {
                "rut": formatted_rut,
                "rut_key": rut_key,
                "source_record_id": str(get(raw_row, "source_record_id") or "").strip() or None,
                "legal_name": legal_name,
                "constitution_date": constitution_date,
                "registry_date": date_iso(get(raw_row, "registry_date")),
                "sii_approval_date": date_iso(get(raw_row, "sii_approval_date")),
                "source_year": integer(get(raw_row, "source_year")),
                "source_month": str(get(raw_row, "source_month") or "").strip() or None,
                "tax_commune": str(get(raw_row, "tax_commune") or "").strip() or None,
                "tax_region": integer(get(raw_row, "tax_region")),
                "company_code": str(get(raw_row, "company_code") or "").strip() or None,
                "capital": number(get(raw_row, "capital")),
                "social_commune": str(get(raw_row, "social_commune") or "").strip() or None,
                "social_region": integer(get(raw_row, "social_region")),
                "source_snapshot_id": snapshot_id,
                "source_payload": {
                    "actuation_type": actuation,
                    "source_url": source_url,
                    "source_sha256": sha256,
                    "collection_mode": "DATOS_GOB_CKAN",
                },
            }
            rows.append(row)
    stats = {
        "rows_observed": total,
        "rows_accepted": len(rows),
        "rut_coverage": round(with_rut / total, 6) if total else 0,
        "legal_name_coverage": round(with_name / total, 6) if total else 0,
        "constitution_date_coverage": round(with_date / total, 6) if total else 0,
        "min_constitution_date": min_date,
        "max_constitution_date": max_date,
        "resolved_columns": sorted(mapping),
    }
    return rows, stats


def snapshot_id(resource: dict, source_hash: str) -> str:
    return f"res:{resource.get('id')}:{source_hash}"


def ingest_resource(resource: dict, license_title: str | None) -> dict:
    resource_id = str(resource.get("id") or "")
    url = str(resource.get("url") or "")
    ckan_hash = str(resource.get("hash") or "").strip()
    if not resource_id or not url:
        raise RuntimeError("RES resource missing id/url")
    valid_source_url(url)

    if ckan_hash:
        existing = api({"action": "snapshot_status", "resource_id": resource_id, "source_hash": ckan_hash})
        if existing.get("exists") and (existing.get("snapshot") or {}).get("status") == "NORMALIZED":
            print(f"[RES] {resource_id}: hash {ckan_hash} already NORMALIZED; skip")
            return {"ok": True, "skipped": True, "resource_id": resource_id, "snapshot": existing.get("snapshot")}

    with tempfile.TemporaryDirectory() as td0:
        target = Path(td0) / (Path(urllib.parse.urlsplit(url).path).name or f"{resource_id}.csv")
        sha256, size = download(url, target)
        source_hash = ckan_hash or sha256
        sid = snapshot_id(resource, source_hash)
        api({"action": "snapshot", "row": {
            "snapshot_id": sid,
            "dataset_id": DATASET_ID,
            "resource_id": resource_id,
            "resource_name": resource.get("name"),
            "resource_url": url,
            "source_hash": source_hash,
            "source_updated_at": resource.get("last_modified") or resource.get("metadata_modified") or resource.get("created"),
            "file_bytes": size,
            "license": license_title,
            "status": "INGESTING",
            "metadata": {"sha256": sha256, "ckan_hash": ckan_hash or None, "year": resource_year(resource)},
        }})
        try:
            rows, stats = parse_csv(target, sid, url, sha256)
            if not rows:
                raise RuntimeError("RES resource produced zero accepted companies")
            for batch in batches(rows, 400):
                api({"action": "company_batch", "rows": batch}, timeout=240)
            cutoff = stats.get("max_constitution_date")
            final = api({"action": "finalize", "snapshot_id": sid, "record_count": len(rows), "cutoff_date": cutoff,
                         "metadata": {"sha256": sha256, "ckan_hash": ckan_hash or None, "resource_year": resource_year(resource), "coverage": stats}}, timeout=240)
            out = {"ok": True, "resource_id": resource_id, "snapshot_id": sid, "sha256": sha256, "bytes": size, "stats": stats, "final": final}
            print(json.dumps(out, ensure_ascii=False))
            return out
        except Exception as exc:
            try:
                api({"action": "fail", "snapshot_id": sid, "error": f"{type(exc).__name__}: {exc}"})
            except Exception:
                pass
            raise


def self_test() -> None:
    assert rut_parts("78.325.627-4") == ("78325627-4", "783256274")
    assert date_iso("24-08-2026") == "2026-08-24"
    assert integer("Región 13") == 13
    sample = "ID;RUT;Razon Social;Fecha de actuacion (1era firma);Fecha de registro (ultima firma);Fecha de aprobacion x SII;Anio;Mes;Comuna Tributaria;Region Tributaria;Codigo de sociedad;Tipo de actuacion;Capital;Comuna Social;Region Social\n1;78.325.627-4;Astraly SpA;01-01-2026;02-01-2026;03-01-2026;2026;Enero;EST CENTRAL;13;SpA;CONSTITUCION;1.000.000;SANTIAGO;13\n"
    with tempfile.TemporaryDirectory() as td:
        p = Path(td) / "sample.csv"
        p.write_text(sample, encoding="utf-8")
        rows, stats = parse_csv(p, "test-snapshot", "https://datos.gob.cl/test.csv", "abc")
        assert len(rows) == 1, rows
        row = rows[0]
        assert row["rut"] == "78325627-4"
        assert row["rut_key"] == "783256274"
        assert row["legal_name"] == "Astraly SpA"
        assert row["constitution_date"] == "2026-01-01"
        assert row["capital"] == 1000000.0
        assert stats["rows_accepted"] == 1
    print("[OK] RES ingest self-test")


def main() -> int:
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--year", default="current", help="current o año calendario")
    group.add_argument("--all", action="store_true", help="procesa todos los CSV RES descubiertos")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return 0
    api({"action": "health"})
    package = package_show()
    resources = select_resources(package, args.year, args.all)
    results = [ingest_resource(resource, package.get("license_title") or package.get("license_id")) for resource in resources]
    print(json.dumps({"ok": True, "resources": len(results), "skipped": sum(1 for r in results if r.get("skipped"))}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
