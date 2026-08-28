#!/usr/bin/env python3
"""ATLAS · Registro Civil RNPJSFL national ingest.

Downloads the most recent official Planilla RPJ published by Servicio de Registro
Civil e Identificación, normalizes it, validates identity/coverage and stages it
through the OIDC-protected Supabase Edge Function aml-osfl-registry-ingest.

The source is public transparency data. The workflow keeps the Registro Civil
legal registry separate from the SII-observable OSFL universe.
"""
from __future__ import annotations

import calendar
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata
import uuid
import zipfile
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import quote

import pandas as pd
import requests

EDGE_AUDIENCE = "atlas-osfl-registry-ingest"
EDGE_PATH = "/functions/v1/aml-osfl-registry-ingest"
OFFICIAL_HOSTS = ("transparencia.srcei.cl", "www.registrocivil.cl", "registrocivil.cl")
MIN_SOURCE_BYTES = 250_000
BATCH_SIZE = 1000


def norm_text(value: Any) -> str:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return ""
    s = unicodedata.normalize("NFKD", str(value))
    s = "".join(c for c in s if not unicodedata.combining(c)).upper().strip()
    return re.sub(r"[^A-Z0-9]+", " ", s).strip()


def clean(value: Any) -> str | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    s = re.sub(r"\s+", " ", str(value).strip())
    if not s or s.upper() in {"NAN", "NONE", "NULL", "S/I", "SIN INFORMACION"}:
        return None
    return s


def clean_registry_number(value: Any) -> str | None:
    s = clean(value)
    if not s:
        return None
    s = re.sub(r"\.0$", "", s)
    s = re.sub(r"^(NRO?\.?|N[°º]?|NUMERO)\s*", "", s, flags=re.I).strip()
    return s or None


def normalize_rut(value: Any) -> tuple[str | None, bool]:
    raw = clean(value)
    if not raw:
        return None, False
    compact = re.sub(r"[^0-9Kk]", "", raw).upper()
    if len(compact) < 2:
        return compact or None, False
    body, dv = compact[:-1], compact[-1]
    if not body.isdigit():
        return compact, False
    total, factor = 0, 2
    for ch in reversed(body):
        total += int(ch) * factor
        factor = 2 if factor == 7 else factor + 1
    mod = 11 - (total % 11)
    expected = "0" if mod == 11 else "K" if mod == 10 else str(mod)
    pretty = f"{int(body)}-{dv}"
    return pretty, dv == expected


def parse_date(value: Any) -> str | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    if isinstance(value, (pd.Timestamp, datetime, date)):
        return pd.Timestamp(value).date().isoformat()
    s = clean(value)
    if not s:
        return None
    # Excel serial dates occasionally survive as numeric strings.
    if re.fullmatch(r"\d{5}(?:\.0+)?", s):
        try:
            d = pd.Timestamp("1899-12-30") + pd.to_timedelta(float(s), unit="D")
            if 1900 <= d.year <= 2100:
                return d.date().isoformat()
        except Exception:
            pass
    try:
        d = pd.to_datetime(s, dayfirst=True, errors="coerce")
        if pd.isna(d) or not (1800 <= d.year <= 2100):
            return None
        return d.date().isoformat()
    except Exception:
        return None


def active_from_status(value: Any) -> bool | None:
    s = norm_text(value)
    if not s:
        return None
    inactive_tokens = (
        "NO VIGENTE", "DISUEL", "EXTING", "CANCEL", "ELIMIN", "CADUC",
        "RECHAZ", "INACTIV", "TERMIN", "ANULAD", "REVOC",
    )
    if any(t in s for t in inactive_tokens):
        return False
    if "VIGENTE" in s or "ACTIVA" in s or s == "ACTIVO":
        return True
    return None


ALIASES: dict[str, list[str]] = {
    "registry_number": [
        "NUMERO INSCRIPCION", "NRO INSCRIPCION", "N INSCRIPCION", "INSCRIPCION",
        "NUMERO DE INSCRIPCION", "NRO DE INSCRIPCION", "NUMERO REGISTRO", "NRO REGISTRO",
    ],
    "legal_name": [
        "NOMBRE PJ", "NOMBRE PERSONA JURIDICA", "NOMBRE DE PERSONA JURIDICA",
        "NOMBRE ORGANIZACION", "RAZON SOCIAL", "DENOMINACION",
    ],
    "rut_raw": ["RUT PJ", "RUT PERSONA JURIDICA", "RUT DE LA PERSONA JURIDICA", "RUT"],
    "origin": ["ORIGEN PJ", "ORIGEN PERSONA JURIDICA", "ORIGEN", "ORGANISMO DE ORIGEN", "MUNICIPALIDAD U ORGANISMO PUBLICO"],
    "commune": ["COMUNA PJ", "COMUNA PERSONA JURIDICA", "COMUNA DE LA PERSONA JURIDICA", "COMUNA DOMICILIO", "COMUNA"],
    "region": ["REGION PJ", "REGION PERSONA JURIDICA", "REGION DE LA PERSONA JURIDICA", "REGION"],
    "address": ["DOMICILIO PJ", "DOMICILIO PERSONA JURIDICA", "DOMICILIO DE LA PERSONA JURIDICA", "DIRECCION PJ", "DOMICILIO", "DIRECCION"],
    "organization_type": ["NATURALEZA PJ", "NATURALEZA", "TIPO PERSONA JURIDICA", "TIPO PJ", "TIPO DE PERSONA JURIDICA"],
    "classification": ["CLASIFICACION PJ", "CLASIFICACION", "CATEGORIA", "CLASE"],
    "grant_date": ["FECHA CONCESION PJ", "FECHA DE CONCESION PJ", "FECHA CONCESION", "FECHA ADQUISICION PJ", "FECHA OTORGAMIENTO"],
    "registration_date": ["FECHA INSCRIPCION", "FECHA DE INSCRIPCION", "FECHA REGISTRO", "FECHA DE REGISTRO"],
    "legal_status": ["ESTADO PJ", "TIPO ESTADO", "ESTADO PERSONA JURIDICA", "ESTADO"],
}


def alias_score(header: Iterable[Any]) -> int:
    hs = {norm_text(x) for x in header if clean(x)}
    score = 0
    for target, aliases in ALIASES.items():
        if any(a in hs for a in aliases):
            score += 3 if target in {"registry_number", "legal_name", "legal_status"} else 1
    return score


def choose_columns(columns: Iterable[Any]) -> dict[str, Any]:
    normed = [(c, norm_text(c)) for c in columns]
    out: dict[str, Any] = {}
    for target, aliases in ALIASES.items():
        # Exact normalized alias first.
        for alias in aliases:
            hit = next((orig for orig, n in normed if n == alias), None)
            if hit is not None:
                out[target] = hit
                break
        if target in out:
            continue
        # Then conservative containment for long labels.
        for alias in aliases:
            if len(alias) < 7:
                continue
            hit = next((orig for orig, n in normed if alias in n or n in alias), None)
            if hit is not None:
                out[target] = hit
                break
    return out


def month_ends_back(count: int = 24) -> list[date]:
    today = date.today()
    y, m = today.year, today.month - 1
    if m == 0:
        y, m = y - 1, 12
    out = []
    for _ in range(count):
        out.append(date(y, m, calendar.monthrange(y, m)[1]))
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    return out


def candidate_urls(d: date) -> list[str]:
    dd, mm, yyyy = f"{d.day:02d}", f"{d.month:02d}", str(d.year)
    names = [
        f"RPJ_desde_Febrero2012_hasta_{dd}_{mm}_{yyyy}.rar",
        f"RPJ_desde_Febrero2012_hasta_{dd}-{mm}-{yyyy}.rar",
        f"RPJ-desde_Febrero2012-hasta_{dd}_{mm}_{yyyy}.rar",
        f"RPJ-desde_Febrero2012-hasta-{dd}-{mm}-{yyyy}.rar",
        f"RPJ_desde_2012-02_hasta_{dd}_{mm}_{yyyy}.rar",
        f"RPJ-desde_2012-03_{dd}_{mm}_{yyyy}.rar",
    ]
    roots = [
        "https://transparencia.srcei.cl/docs/Transparencia_Activa/Personas_Juridicas",
        "http://transparencia.srcei.cl/docs/Transparencia_Activa/Personas_Juridicas",
    ]
    return [f"{root}/{quote(name)}" for root in roots for name in names]


def file_signature(chunk: bytes) -> bool:
    return (
        chunk.startswith(b"Rar!\x1a\x07")
        or chunk.startswith(b"PK\x03\x04")
        or chunk.startswith(bytes.fromhex("D0CF11E0A1B11AE1"))
    )


@dataclass
class SourceFile:
    url: str
    snapshot_date: date
    path: Path
    sha256: str
    size: int


def discover_source(work: Path) -> SourceFile:
    explicit = os.getenv("OSFL_REGISTRY_SOURCE_URL", "").strip()
    candidates: list[tuple[str, date]] = []
    if explicit:
        ds = os.getenv("OSFL_REGISTRY_SNAPSHOT_DATE", "").strip()
        snap = date.fromisoformat(ds) if ds else month_ends_back(1)[0]
        candidates.append((explicit, snap))
    else:
        for d in month_ends_back(int(os.getenv("OSFL_REGISTRY_LOOKBACK_MONTHS", "24"))):
            candidates.extend((u, d) for u in candidate_urls(d))

    session = requests.Session()
    session.headers.update({"User-Agent": "ATLAS-UAF-OSFL/1.0 public-transparency-ingest"})
    failures: list[str] = []
    for idx, (url, snap) in enumerate(candidates, start=1):
        host = requests.utils.urlparse(url).hostname or ""
        if host not in OFFICIAL_HOSTS:
            raise RuntimeError(f"Unapproved OSFL source host: {host}")
        try:
            print(f"[source] probe {idx}/{len(candidates)} {url}", flush=True)
            with session.get(url, stream=True, allow_redirects=True, timeout=(10, 45)) as r:
                if r.status_code != 200:
                    failures.append(f"{snap} HTTP {r.status_code} {url}")
                    continue
                final_host = requests.utils.urlparse(r.url).hostname or ""
                if final_host not in OFFICIAL_HOSTS:
                    failures.append(f"{snap} redirected outside official host: {r.url}")
                    continue
                it = r.iter_content(chunk_size=1024 * 1024)
                first = next(it, b"")
                ctype = (r.headers.get("content-type") or "").lower()
                if not first or ("text/html" in ctype) or not file_signature(first[:16]):
                    failures.append(f"{snap} non-file response {ctype} {url}")
                    continue
                target = work / Path(requests.utils.urlparse(url).path).name
                h = hashlib.sha256()
                size = 0
                with target.open("wb") as f:
                    for chunk in (first, *it):
                        if not chunk:
                            continue
                        f.write(chunk); h.update(chunk); size += len(chunk)
                if size < MIN_SOURCE_BYTES:
                    failures.append(f"{snap} file too small {size} {url}")
                    target.unlink(missing_ok=True)
                    continue
                print(f"[source] selected {url} bytes={size} sha256={h.hexdigest()}", flush=True)
                return SourceFile(url, snap, target, h.hexdigest(), size)
        except Exception as e:
            failures.append(f"{snap} {type(e).__name__}: {e} {url}")
    tail = "\n".join(failures[-20:])
    raise RuntimeError("No current official Planilla RPJ could be downloaded. Last probes:\n" + tail)


def extract_source(src: SourceFile, work: Path) -> list[Path]:
    out = work / "extracted"; out.mkdir(exist_ok=True)
    p = src.path
    low = p.name.lower()
    if low.endswith(".rar"):
        cmd = shutil.which("unar")
        if not cmd:
            raise RuntimeError("unar is required to extract Registro Civil RAR")
        subprocess.run([cmd, "-quiet", "-force-overwrite", "-output-directory", str(out), str(p)], check=True)
    elif low.endswith(".zip"):
        with zipfile.ZipFile(p) as z:
            z.extractall(out)
    else:
        shutil.copy2(p, out / p.name)
    files = [x for x in out.rglob("*") if x.is_file() and x.suffix.lower() in {".xls", ".xlsx", ".csv"}]
    if not files:
        raise RuntimeError("Official archive did not contain XLS/XLSX/CSV files")
    return sorted(files, key=lambda x: x.stat().st_size, reverse=True)


def read_tables(path: Path) -> list[tuple[str, pd.DataFrame]]:
    if path.suffix.lower() == ".csv":
        for enc in ("utf-8-sig", "latin-1"):
            try:
                raw = pd.read_csv(path, header=None, dtype=object, encoding=enc, sep=None, engine="python", nrows=60)
                header_idx = max(range(min(40, len(raw))), key=lambda i: alias_score(raw.iloc[i].tolist()))
                df = pd.read_csv(path, header=header_idx, dtype=object, encoding=enc, sep=None, engine="python")
                return [(path.stem, df)]
            except Exception:
                continue
        raise RuntimeError(f"Cannot parse CSV {path.name}")

    engine = "xlrd" if path.suffix.lower() == ".xls" else "openpyxl"
    xl = pd.ExcelFile(path, engine=engine)
    tables: list[tuple[str, pd.DataFrame]] = []
    for sheet in xl.sheet_names:
        raw = pd.read_excel(path, sheet_name=sheet, header=None, dtype=object, engine=engine, nrows=60)
        if raw.empty:
            continue
        max_scan = min(40, len(raw))
        scores = [(alias_score(raw.iloc[i].tolist()), i) for i in range(max_scan)]
        score, header_idx = max(scores)
        if score < 6:
            continue
        df = pd.read_excel(path, sheet_name=sheet, header=header_idx, dtype=object, engine=engine)
        tables.append((str(sheet), df))
    return tables


def normalize_rows(files: list[Path], load_id: str) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    sheets: list[dict[str, Any]] = []
    for file in files:
        for sheet, df in read_tables(file):
            mapping = choose_columns(df.columns)
            core = {"registry_number", "legal_name", "legal_status"}
            if not core.issubset(mapping):
                print(f"[parse] skip {file.name}/{sheet}: missing {sorted(core-set(mapping))}; columns={list(map(str,df.columns))[:30]}", flush=True)
                continue
            print(f"[parse] {file.name}/{sheet}: rows={len(df)} mapping={mapping}", flush=True)
            sheets.append({"file": file.name, "sheet": sheet, "rows": int(len(df)), "mapping": {k: str(v) for k,v in mapping.items()}})
            for pos, (_, r) in enumerate(df.iterrows(), start=1):
                reg = clean_registry_number(r.get(mapping["registry_number"]))
                name = clean(r.get(mapping["legal_name"]))
                status = clean(r.get(mapping["legal_status"]))
                rut_raw = clean(r.get(mapping.get("rut_raw"))) if mapping.get("rut_raw") is not None else None
                rut, rut_valid = normalize_rut(rut_raw)
                payload = {
                    "load_id": load_id,
                    "source_sheet": f"{file.name}::{sheet}"[:160],
                    "source_row_number": pos,
                    "registry_number": reg,
                    "legal_name": name,
                    "rut_raw": rut_raw,
                    "rut": rut,
                    "rut_is_valid": rut_valid,
                    "origin": clean(r.get(mapping.get("origin"))) if mapping.get("origin") is not None else None,
                    "commune": clean(r.get(mapping.get("commune"))) if mapping.get("commune") is not None else None,
                    "region": clean(r.get(mapping.get("region"))) if mapping.get("region") is not None else None,
                    "address": clean(r.get(mapping.get("address"))) if mapping.get("address") is not None else None,
                    "organization_type": clean(r.get(mapping.get("organization_type"))) if mapping.get("organization_type") is not None else None,
                    "classification": clean(r.get(mapping.get("classification"))) if mapping.get("classification") is not None else None,
                    "grant_date": parse_date(r.get(mapping.get("grant_date"))) if mapping.get("grant_date") is not None else None,
                    "registration_date": parse_date(r.get(mapping.get("registration_date"))) if mapping.get("registration_date") is not None else None,
                    "legal_status": status,
                    "is_active": active_from_status(status),
                }
                stable = json.dumps({k: payload[k] for k in payload if k not in {"load_id", "source_sheet", "source_row_number"}}, ensure_ascii=False, sort_keys=True, default=str)
                payload["source_record_hash"] = hashlib.sha256(stable.encode("utf-8")).hexdigest()
                rows.append(payload)
    if not rows:
        raise RuntimeError("No usable Registro Civil rows found")
    return rows, {"sheets": sheets}


def oidc_token() -> str:
    url = os.environ.get("ACTIONS_ID_TOKEN_REQUEST_URL")
    bearer = os.environ.get("ACTIONS_ID_TOKEN_REQUEST_TOKEN")
    if not url or not bearer:
        raise RuntimeError("GitHub Actions OIDC environment unavailable")
    sep = "&" if "?" in url else "?"
    r = requests.get(f"{url}{sep}audience={quote(EDGE_AUDIENCE)}", headers={"Authorization": f"Bearer {bearer}"}, timeout=30)
    r.raise_for_status()
    return r.json()["value"]


class Edge:
    def __init__(self) -> None:
        base = os.environ["ATLAS_SUPABASE_URL"].rstrip("/")
        self.url = base + EDGE_PATH
        self.token = oidc_token()
        self.s = requests.Session()
        self.s.headers.update({"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"})

    def call(self, body: dict[str, Any], timeout: int = 120) -> dict[str, Any]:
        r = self.s.post(self.url, json=body, timeout=timeout)
        try:
            data = r.json()
        except Exception:
            data = {"raw": r.text[:2000]}
        if not r.ok or data.get("ok") is False:
            raise RuntimeError(f"Edge {body.get('action')} HTTP {r.status_code}: {json.dumps(data, ensure_ascii=False)[:2500]}")
        return data


def chunks(rows: list[dict[str, Any]], n: int) -> Iterable[list[dict[str, Any]]]:
    for i in range(0, len(rows), n):
        yield rows[i:i+n]


def main() -> int:
    edge = Edge()
    with tempfile.TemporaryDirectory(prefix="atlas-osfl-rpj-") as td:
        work = Path(td)
        try:
            src = discover_source(work)
        except Exception as e:
            try:
                edge.call({"action":"probe_status","blocked":True,"portal":"https://www.registrocivil.cl/principal/nuestras-oficinas/portal-registro-nacional-de-personas-juridicas-sin-fines-de-lucro","detail":str(e)[:850]})
            except Exception:
                pass
            raise

        edge.call({"action":"probe_status","blocked":False,"portal":src.url,"http_status":200,"detail":f"Official full file reachable; snapshot={src.snapshot_date}; sha256={src.sha256}"})
        files = extract_source(src, work)
        load_id = str(uuid.uuid4())
        rows, quality = normalize_rows(files, load_id)
        observed = len(rows)
        accepted = sum(1 for r in rows if r["registry_number"] and r["legal_name"])
        active = sum(1 for r in rows if r["is_active"] is True)
        inactive = sum(1 for r in rows if r["is_active"] is False)
        with_rut = sum(1 for r in rows if r["rut_raw"])
        valid_rut = sum(1 for r in rows if r["rut_is_valid"] and r["rut"])
        regs = [r["registry_number"] for r in rows if r["registry_number"]]
        duplicate_regs = len(regs) - len(set(regs))
        quality.update({
            "parser":"ATLAS_REGISTRO_CIVIL_RPJ_1.0",
            "observed":observed,"accepted":accepted,"active":active,"inactive":inactive,
            "unknown_status":observed-active-inactive,"rows_with_rut":with_rut,"valid_rut":valid_rut,
            "duplicate_registry_numbers":duplicate_regs,
        })
        print("[quality] " + json.dumps(quality, ensure_ascii=False)[:8000], flush=True)
        if observed < 250000:
            raise RuntimeError(f"Refusing national ingest: only {observed} rows parsed")
        if accepted / max(observed,1) < 0.98:
            raise RuntimeError(f"Refusing national ingest: accepted ratio {accepted/observed:.4f}")
        if active < 200000:
            raise RuntimeError(f"Refusing national ingest: only {active} active rows derived")

        expected = 363703 if src.snapshot_date.isoformat() == "2025-08-31" else None
        edge.call({"action":"begin","run":{
            "load_id":load_id,"snapshot_date":src.snapshot_date.isoformat(),"source_url":src.url,
            "source_file_name":src.path.name,"source_sha256":src.sha256,"source_bytes":src.size,
            "expected_active_total":expected,"quality":quality,
        }})
        try:
            total_batches = (len(rows) + BATCH_SIZE - 1) // BATCH_SIZE
            for i, batch in enumerate(chunks(rows, BATCH_SIZE), start=1):
                edge.call({"action":"stage_batch","rows":batch}, timeout=120)
                if i == 1 or i % 25 == 0 or i == total_batches:
                    print(f"[stage] batch {i}/{total_batches} rows={min(i*BATCH_SIZE,len(rows))}", flush=True)
            edge.call({"action":"stage_complete","load_id":load_id,"observed_rows":observed,"accepted_rows":accepted,
                       "active_rows":active,"inactive_rows":inactive,"rows_with_rut":with_rut,"rows_with_valid_rut":valid_rut,
                       "duplicate_registry_numbers":duplicate_regs,"quality":quality})
            final = edge.call({"action":"finalize","load_id":load_id,"expected_active_total":expected}, timeout=180)
        except Exception as e:
            try:
                edge.call({"action":"fail","load_id":load_id,"error":str(e)[:1700]})
            except Exception:
                pass
            raise
        print("ATLAS_OSFL_REGISTRY_RESULT=" + json.dumps({"source":src.url,"snapshot_date":src.snapshot_date.isoformat(),"sha256":src.sha256,"bytes":src.size,"quality":quality,"finalize":final}, ensure_ascii=False), flush=True)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ATLAS_OSFL_REGISTRY_ERROR={type(exc).__name__}: {exc}", file=sys.stderr, flush=True)
        raise
