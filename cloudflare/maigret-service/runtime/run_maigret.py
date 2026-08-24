#!/usr/bin/env python3
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

SAFE_ALIAS = re.compile(r"^[A-Za-z0-9._-]{2,80}$")
BLOCKED_TAGS = {"porn", "nsfw", "adult", "dating"}


def clean_alias(value):
    value = str(value or "").strip()
    if not SAFE_ALIAS.fullmatch(value):
        raise ValueError("INVALID_USERNAME")
    return value


def is_blocked(record):
    tags = set()
    site = record.get("site") or {}
    status = record.get("status") or {}
    for source in (site.get("tags"), status.get("tags")):
        if isinstance(source, list):
            tags.update(str(x).lower() for x in source)
    return any(any(blocked in tag for blocked in BLOCKED_TAGS) for tag in tags)


def normalize_profile(alias, site_name, record):
    status = record.get("status") or {}
    return {
        "alias": alias,
        "platform": site_name,
        "url": record.get("url_user") or status.get("site_url_user") or "",
        "url_main": record.get("url_main") or "",
        "http_status": record.get("http_status"),
        "tags": status.get("tags") or [],
        "extracted": status.get("ids_data") or {},
        "derived_usernames": record.get("ids_usernames") or {},
        "derived_links": record.get("ids_links") or [],
    }


def main():
    if len(sys.argv) != 2:
        raise SystemExit("usage: run_maigret.py REQUEST_JSON")
    request = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    username = clean_alias(request.get("username"))
    top_sites = max(50, min(int(request.get("top_sites", 180)), 350))
    site_timeout = max(3, min(int(request.get("site_timeout", 6)), 12))
    total_timeout = max(45, min(int(request.get("total_timeout", 105)), 150))
    recursive = bool(request.get("recursive", True))

    out_dir = tempfile.mkdtemp(prefix="atlas-maigret-")
    cmd = [
        "maigret", username,
        "--top-sites", str(top_sites),
        "--timeout", str(site_timeout),
        "--retries", "1",
        "--max-connections", "20",
        "--no-progressbar",
        "--no-color",
        "--json", "simple",
        "--folderoutput", out_dir,
    ]
    if not recursive:
        cmd.append("--no-recursion")

    timed_out = False
    return_code = None
    stderr_tail = ""
    try:
        proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=total_timeout, check=False)
        return_code = proc.returncode
        stderr_tail = (proc.stderr or "")[-3000:]
    except subprocess.TimeoutExpired as exc:
        timed_out = True
        stderr_tail = str(exc)

    profiles = []
    aliases_seen = set()
    graph_nodes = {username: {"id": f"alias:{username}", "type": "alias", "label": username, "root": True}}
    graph_edges = []

    for report in sorted(Path(out_dir).glob("report_*_simple.json")):
        alias = report.name[len("report_"):-len("_simple.json")]
        if not alias:
            continue
        aliases_seen.add(alias)
        if alias not in graph_nodes:
            graph_nodes[alias] = {"id": f"alias:{alias}", "type": "derived_alias", "label": alias, "root": False}
            graph_edges.append({"from": f"alias:{username}", "to": f"alias:{alias}", "type": "ALIAS_DERIVADO_POR_MAIGRET"})
        try:
            data = json.loads(report.read_text(encoding="utf-8"))
        except Exception:
            continue
        if not isinstance(data, dict):
            continue
        for site_name, record in data.items():
            if not isinstance(record, dict) or is_blocked(record):
                continue
            p = normalize_profile(alias, site_name, record)
            if not p["url"]:
                continue
            profiles.append(p)
            pid = f"profile:{alias}:{site_name}"[:240]
            graph_nodes[pid] = {"id": pid, "type": "profile", "label": site_name, "platform": site_name, "url": p["url"]}
            graph_edges.append({"from": f"alias:{alias}", "to": pid, "type": "OBSERVADO_EN"})
            for child in (p.get("derived_usernames") or {}).keys():
                try:
                    child = clean_alias(child)
                except Exception:
                    continue
                if child == alias:
                    continue
                if child not in graph_nodes:
                    graph_nodes[child] = {"id": f"alias:{child}", "type": "derived_alias", "label": child, "root": False}
                graph_edges.append({"from": f"alias:{alias}", "to": f"alias:{child}", "type": "ALIAS_EXTRAIDO_DE_PERFIL"})

    profiles = profiles[:180]
    nodes = list(graph_nodes.values())[:120]
    allowed_ids = {n["id"] for n in nodes}
    edges = [e for e in graph_edges if e["from"] in allowed_ids and e["to"] in allowed_ids][:240]

    result = {
        "ok": True,
        "source": "MAIGRET_FULL_RUNTIME",
        "username": username,
        "recursive": recursive,
        "timed_out": timed_out,
        "return_code": return_code,
        "profiles": profiles,
        "derived_aliases": sorted(a for a in aliases_seen if a != username)[:30],
        "graph": {"nodes": nodes, "edges": edges},
        "analytics": {
            "profiles": len(profiles),
            "aliases_searched": len(aliases_seen),
            "derived_aliases": len([a for a in aliases_seen if a != username]),
        },
        "runtime": {
            "top_sites": top_sites,
            "site_timeout": site_timeout,
            "total_timeout": total_timeout,
            "bounded": True,
            "stderr_tail": stderr_tail if return_code not in (0, None) else "",
        },
        "guardrails": {
            "identity_assertion": False,
            "score_mutation": False,
            "persisted": False,
            "nsfw_filtered": True,
        },
    }
    print(json.dumps(result, ensure_ascii=False))
    shutil.rmtree(out_dir, ignore_errors=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False))
        raise
