#!/usr/bin/env python3
import json
import re
import shutil
import subprocess
import sys
import tempfile
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlparse

SAFE_ALIAS = re.compile(r"^[A-Za-z0-9._-]{2,80}$")
BLOCKED_TAGS = {"porn", "nsfw", "adult", "dating"}
URL_RE = re.compile(r"^https?://", re.I)

FIELD_LABELS = {
    "fullname": "Nombre mostrado",
    "full_name": "Nombre mostrado",
    "display_name": "Nombre mostrado",
    "name": "Nombre mostrado",
    "location": "Ubicación declarada",
    "city": "Ciudad declarada",
    "country": "País declarado",
    "bio": "Bio pública",
    "description": "Descripción pública",
    "about": "Descripción pública",
    "email": "Email público",
    "website": "Sitio web",
    "url": "Sitio web",
    "company": "Organización declarada",
    "organization": "Organización declarada",
    "occupation": "Ocupación declarada",
    "language": "Idioma declarado",
    "languages": "Idiomas declarados",
}


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


def scalar_values(value):
    if value is None:
        return []
    if isinstance(value, (str, int, float, bool)):
        text = str(value).strip()
        return [text] if text and len(text) <= 500 else []
    if isinstance(value, list):
        out = []
        for item in value[:12]:
            out.extend(scalar_values(item))
        return out[:20]
    if isinstance(value, dict):
        out = []
        for item in list(value.values())[:12]:
            out.extend(scalar_values(item))
        return out[:20]
    return []


def field_label(raw_key):
    key = str(raw_key or "").strip().lower().replace("-", "_").replace(" ", "_")
    if "username" in key or key in {"id", "uid", "user_id"}:
        return None
    if key in FIELD_LABELS:
        return FIELD_LABELS[key]
    if any(x in key for x in ("avatar", "image", "photo", "picture")):
        return None
    if any(x in key for x in ("fullname", "displayname", "realname")):
        return "Nombre mostrado"
    if any(x in key for x in ("location", "address", "city", "country")):
        return "Ubicación declarada"
    if any(x in key for x in ("bio", "about", "description")):
        return "Bio pública"
    if "email" in key:
        return "Email público"
    if any(x in key for x in ("company", "organization", "occupation", "work")):
        return "Organización / ocupación"
    return str(raw_key or "Dato público").replace("_", " ").strip().title()[:80]


def canonical_value(value):
    return re.sub(r"\s+", " ", str(value or "").strip()).lower()


def host_of(url):
    try:
        return urlparse(url).netloc.lower().removeprefix("www.")
    except Exception:
        return ""


def build_intelligence(profiles, aliases_seen):
    attribute_hits = defaultdict(lambda: {"label": "", "value": "", "profiles": set(), "aliases": set()})
    link_hits = defaultdict(lambda: {"url": "", "host": "", "profiles": set(), "aliases": set()})
    alias_hits = defaultdict(lambda: {"alias": "", "profiles": set(), "origin_aliases": set(), "types": set()})

    for p in profiles:
        alias = str(p.get("alias") or "")
        platform = str(p.get("platform") or "Perfil")
        extracted = p.get("extracted") or {}
        if isinstance(extracted, dict):
            for raw_key, raw_value in extracted.items():
                label = field_label(raw_key)
                if not label:
                    continue
                for value in scalar_values(raw_value):
                    if URL_RE.match(value):
                        key = value.rstrip("/")
                        hit = link_hits[key]
                        hit["url"] = value
                        hit["host"] = host_of(value)
                        hit["profiles"].add(platform)
                        hit["aliases"].add(alias)
                        continue
                    if len(value) < 2:
                        continue
                    key = f"{label.lower()}|{canonical_value(value)}"
                    hit = attribute_hits[key]
                    hit["label"] = label
                    hit["value"] = value
                    hit["profiles"].add(platform)
                    hit["aliases"].add(alias)

        for url in p.get("derived_links") or []:
            text = str(url or "").strip()
            if not URL_RE.match(text):
                continue
            key = text.rstrip("/")
            hit = link_hits[key]
            hit["url"] = text
            hit["host"] = host_of(text)
            hit["profiles"].add(platform)
            hit["aliases"].add(alias)

        usernames = p.get("derived_usernames") or {}
        if isinstance(usernames, dict):
            iterable = usernames.items()
        elif isinstance(usernames, list):
            iterable = ((x, "username") for x in usernames)
        else:
            iterable = []
        for candidate, kind in iterable:
            try:
                candidate = clean_alias(candidate)
            except Exception:
                continue
            if candidate == alias:
                continue
            hit = alias_hits[candidate]
            hit["alias"] = candidate
            hit["profiles"].add(platform)
            hit["origin_aliases"].add(alias)
            hit["types"].add(str(kind or "username"))

    attributes = []
    for hit in attribute_hits.values():
        profiles_list = sorted(hit["profiles"])
        aliases_list = sorted(a for a in hit["aliases"] if a)
        strength = min(100, 35 + len(profiles_list) * 20 + max(0, len(aliases_list) - 1) * 10)
        attributes.append({
            "field": hit["label"],
            "value": hit["value"],
            "source_count": len(profiles_list),
            "profiles": profiles_list[:12],
            "aliases": aliases_list[:8],
            "corroborated": len(profiles_list) >= 2,
            "evidence_strength": strength,
        })
    attributes.sort(key=lambda x: (-x["source_count"], -x["evidence_strength"], x["field"], x["value"]))

    links = []
    for hit in link_hits.values():
        profiles_list = sorted(hit["profiles"])
        aliases_list = sorted(a for a in hit["aliases"] if a)
        links.append({
            "url": hit["url"],
            "host": hit["host"],
            "source_count": len(profiles_list),
            "profiles": profiles_list[:12],
            "aliases": aliases_list[:8],
            "corroborated": len(profiles_list) >= 2,
        })
    links.sort(key=lambda x: (-x["source_count"], x["host"], x["url"]))

    alias_candidates = []
    for hit in alias_hits.values():
        profiles_list = sorted(hit["profiles"])
        alias_candidates.append({
            "alias": hit["alias"],
            "source_count": len(profiles_list),
            "profiles": profiles_list[:12],
            "origin_aliases": sorted(hit["origin_aliases"])[:8],
            "types": sorted(hit["types"])[:8],
            "searched_recursively": hit["alias"] in aliases_seen,
            "corroborated": len(profiles_list) >= 2,
        })
    alias_candidates.sort(key=lambda x: (-x["source_count"], not x["searched_recursively"], x["alias"]))

    return {
        "attributes": attributes[:40],
        "links": links[:40],
        "alias_candidates": alias_candidates[:30],
        "summary": {
            "public_attributes": len(attributes),
            "corroborated_attributes": len([x for x in attributes if x["corroborated"]]),
            "link_pivots": len(links),
            "alias_candidates": len(alias_candidates),
            "recursive_aliases_searched": len([x for x in alias_candidates if x["searched_recursively"]]),
        },
        "methodology": {
            "evidence_strength_not_identity_probability": True,
            "corroborated_requires_independent_profiles": 2,
            "automatic_identity_assertion": False,
        },
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
    intelligence = build_intelligence(profiles, aliases_seen)
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
        "intelligence": intelligence,
        "graph": {"nodes": nodes, "edges": edges},
        "analytics": {
            "profiles": len(profiles),
            "aliases_searched": len(aliases_seen),
            "derived_aliases": len([a for a in aliases_seen if a != username]),
            "public_attributes": intelligence["summary"]["public_attributes"],
            "corroborated_attributes": intelligence["summary"]["corroborated_attributes"],
            "link_pivots": intelligence["summary"]["link_pivots"],
            "alias_candidates": intelligence["summary"]["alias_candidates"],
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
            "evidence_strength_not_identity_probability": True,
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
