#!/usr/bin/env python3
"""Carga completa de actividades económicas SII para Nóminas Atlas.

Mantiene separado el screening UAF del universo analítico general:
- ingest.py sigue pudiendo cargar/recalcular el subconjunto de screening SO;
- este loader materializa TODAS las actividades válidas publicadas por SII.
"""
from __future__ import annotations

import hashlib
import json
import re
import tempfile
from pathlib import Path

import ingest as core

SOURCE_KIND = "ACTIVITIES_FULL"


def load_full_activities(path: Path, sha: str, size: int, headers: dict) -> dict:
    sid, skip, old = core.snapshot(SOURCE_KIND, core.ACT_URL, sha, size, headers)
    if skip:
        return {
            "skipped": True,
            "snapshot_id": sid,
            "observed": old.get("record_count"),
            "accepted": old.get("accepted_count"),
        }

    z, stream, dialect = core.open_zip_text(path, "PUB_NOM_ACTECOS.txt")
    observed = 0
    accepted = 0

    def rows():
        nonlocal observed, accepted
        for r in core.canonical_reader(stream, dialect):
            observed += 1
            code = re.sub(
                r"\D",
                "",
                str(
                    core.pick(
                        r,
                        "codigo_actividad",
                        "codigo_actividad_economica",
                        "actividad_codigo",
                        "codigo",
                    )
                    or ""
                ),
            )
            if not code:
                continue
            rut = core.rut_valid(
                core.pick(r, "rut", "rut_contribuyente"),
                core.pick(r, "dv", "digito_verificador"),
            )
            if not rut:
                continue
            name = str(
                core.pick(
                    r,
                    "desc_actividad_economica",
                    "actividad_economica",
                    "glosa_actividad",
                    "descripcion_actividad",
                    "actividad",
                )
                or ""
            ).strip()
            date = core.iso_date(core.pick(r, "fecha", "fecha_actividad", "fecha_inscripcion"))
            accepted += 1
            rid = "SII-ACT-" + hashlib.sha1(
                (rut + "|" + code + "|" + (date or "") + "|" + core.upper_norm(name)).encode()
            ).hexdigest()[:28]
            yield {
                "activity_record_id": rid,
                "rut": rut,
                "entity_id": "ENT-RUT-" + rut,
                "activity_code": code,
                "activity_name": name or None,
                "activity_registration_date": date,
                "vat_affected": core.pick(r, "afecta_a_iva", "afecta_iva") or None,
                "activity_category": core.pick(r, "categoria_tributaria", "categoria") or None,
                "activity_status": core.pick(r, "vigencia", "estado", "estado_actividad")
                or "VIGENTE_AS_PUBLISHED",
                "source_snapshot_id": sid,
            }

    try:
        for batch_no, batch in enumerate(core.batches(rows(), 2500), start=1):
            core.api({"action": "activity_batch", "rows": batch})
            if batch_no % 100 == 0:
                print(json.dumps({"progress_batches": batch_no, "accepted": accepted}, ensure_ascii=False))
    finally:
        stream.close()
        z.close()

    core.api(
        {
            "action": "finalize",
            "source_kind": SOURCE_KIND,
            "snapshot_id": sid,
            "source_hash": sha,
            "record_count": observed,
            "accepted_count": accepted,
            "metadata": {
                "coverage": "ALL_VALID_PUBLISHED_ACTIVITIES",
                "filtered_to_candidate_use_si": False,
                "official": "SII",
                "last_modified": headers.get("Last-Modified"),
            },
        }
    )
    return {"snapshot_id": sid, "observed": observed, "accepted": accepted}


def run() -> None:
    with tempfile.TemporaryDirectory() as td:
        path = Path(td) / "activities.zip"
        sha, size, headers = core.download(core.ACT_URL, path)
        result = load_full_activities(path, sha, size, headers)
        print(json.dumps({"ok": True, "activities_full": result}, ensure_ascii=False))


if __name__ == "__main__":
    run()
