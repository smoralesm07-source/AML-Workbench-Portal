from __future__ import annotations

import asyncio
import hashlib
import os
import re
import time
from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import Any

import jwt
from fastapi import Depends, FastAPI, Header, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sherlock_project import __version__ as SHERLOCK_VERSION
from sherlock_project.notify import QueryNotify
from sherlock_project.result import QueryStatus
from sherlock_project.sherlock import sherlock
from sherlock_project.sites import SitesInformation

APP_VERSION = "0.52.0"
SCHEMA = "ATLAS_OSINT_USERNAME_V1"
USERNAME_RE = re.compile(r"^[A-Za-z0-9_.-]{2,64}$")
SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
ALLOWED_ORIGINS = [x.strip() for x in os.getenv("ATLAS_ALLOWED_ORIGINS", "").split(",") if x.strip()]
RATE_LIMIT_PER_HOUR = max(1, int(os.getenv("ATLAS_OSINT_RATE_LIMIT_PER_HOUR", "30")))
MAX_CONCURRENCY = max(1, min(8, int(os.getenv("ATLAS_OSINT_MAX_CONCURRENCY", "3"))))
SITE_TIMEOUT_SECONDS = max(3, min(30, int(os.getenv("ATLAS_OSINT_SITE_TIMEOUT_SECONDS", "8"))))

if not SUPABASE_URL:
    raise RuntimeError("SUPABASE_URL is required")

JWKS_URL = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
JWKS_CLIENT = jwt.PyJWKClient(JWKS_URL, cache_jwk_set=True, lifespan=3600)
SEM = asyncio.Semaphore(MAX_CONCURRENCY)
RATE_BUCKETS: dict[str, deque[float]] = defaultdict(deque)

app = FastAPI(
    title="ATLAS OSINT · Sherlock",
    version=APP_VERSION,
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    max_age=600,
)


class SilentNotify(QueryNotify):
    def start(self, _message: str) -> None:
        return None

    def update(self, _result: Any) -> None:
        return None

    def finish(self, _message: str | None = None) -> None:
        return None


class UsernameRequest(BaseModel):
    username: str = Field(min_length=2, max_length=64)
    entity_id: str | None = Field(default=None, max_length=120)


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def bearer_token(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="missing_bearer_token")
    token = authorization[7:].strip()
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="missing_bearer_token")
    return token


def verify_session(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    token = bearer_token(authorization)
    try:
        signing_key = JWKS_CLIENT.get_signing_key_from_jwt(token).key
        payload = jwt.decode(
            token,
            signing_key,
            algorithms=["RS256", "ES256"],
            audience="authenticated",
            options={"require": ["exp", "sub"]},
        )
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_session") from exc
    if payload.get("role") not in (None, "authenticated"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="invalid_role")
    return payload


def enforce_rate_limit(subject: str) -> None:
    now = time.monotonic()
    bucket = RATE_BUCKETS[subject]
    while bucket and now - bucket[0] > 3600:
        bucket.popleft()
    if len(bucket) >= RATE_LIMIT_PER_HOUR:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="rate_limit_exceeded")
    bucket.append(now)


def sanitize_username(raw: str) -> str:
    username = raw.strip()
    if not USERNAME_RE.fullmatch(username):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="invalid_username")
    return username


def load_sites() -> dict[str, dict[str, Any]]:
    sites = SitesInformation(honor_exclusions=True)
    sites.remove_nsfw_sites()
    return {site.name: dict(site.information) for site in sites}


def execute_sherlock(username: str) -> dict[str, Any]:
    sites = load_sites()
    started = time.perf_counter()
    raw = sherlock(
        username=username,
        site_data=sites,
        query_notify=SilentNotify(),
        dump_response=False,
        proxy=None,
        timeout=SITE_TIMEOUT_SECONDS,
    )
    duration_ms = round((time.perf_counter() - started) * 1000)

    found: list[dict[str, Any]] = []
    unknown = 0
    blocked = 0
    illegal = 0
    available = 0

    for platform, result in raw.items():
        query_result = result.get("status")
        query_status = getattr(query_result, "status", None)
        if query_status == QueryStatus.CLAIMED:
            found.append(
                {
                    "platform": platform,
                    "url": result.get("url_user") or getattr(query_result, "site_url_user", None),
                    "status": "FOUND",
                    "http_status": result.get("http_status"),
                    "query_time_ms": round((getattr(query_result, "query_time", 0) or 0) * 1000),
                }
            )
        elif query_status == QueryStatus.AVAILABLE:
            available += 1
        elif query_status == QueryStatus.WAF:
            blocked += 1
        elif query_status == QueryStatus.ILLEGAL:
            illegal += 1
        else:
            unknown += 1

    found.sort(key=lambda row: str(row["platform"]).casefold())
    return {
        "found": found,
        "sites_checked": len(raw),
        "available": available,
        "unknown": unknown,
        "blocked": blocked,
        "illegal": illegal,
        "duration_ms": duration_ms,
    }


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response


@app.get("/health")
async def health() -> dict[str, Any]:
    return {
        "ok": True,
        "service": "atlas-osint-sherlock",
        "version": APP_VERSION,
        "engine": {"name": "sherlock", "version": SHERLOCK_VERSION},
    }


@app.post("/v1/username")
async def username_search(
    body: UsernameRequest,
    session: dict[str, Any] = Depends(verify_session),
) -> dict[str, Any]:
    username = sanitize_username(body.username)
    subject = str(session["sub"])
    enforce_rate_limit(subject)
    query_hash = sha256_text(username.casefold())
    entity_hash = sha256_text(body.entity_id) if body.entity_id else None

    async with SEM:
        try:
            result = await asyncio.wait_for(asyncio.to_thread(execute_sherlock, username), timeout=75)
        except asyncio.TimeoutError as exc:
            raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail="engine_timeout") from exc
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="engine_failure") from exc

    # Log only hashes and counts. Never persist the raw username or entity identifier.
    print(
        {
            "event": "atlas_osint_username_query",
            "subject_hash": sha256_text(subject),
            "query_hash": query_hash,
            "entity_hash": entity_hash,
            "found_count": len(result["found"]),
            "sites_checked": result["sites_checked"],
            "duration_ms": result["duration_ms"],
            "observed_at": utc_now(),
        },
        flush=True,
    )

    return {
        "schema": SCHEMA,
        "engine": {"name": "sherlock", "version": SHERLOCK_VERSION},
        "query": {"sha256": query_hash, "length": len(username)},
        "summary": {
            "sites_checked": result["sites_checked"],
            "found_count": len(result["found"]),
            "available_count": result["available"],
            "unknown_count": result["unknown"],
            "blocked_count": result["blocked"],
            "illegal_count": result["illegal"],
            "duration_ms": result["duration_ms"],
        },
        "results": result["found"],
        "evidence": {
            "observed_at": utc_now(),
            "identity_semantics": "USERNAME_COINCIDENCE_ONLY",
            "identity_promoted": False,
            "source_type": "PUBLIC_OSINT",
        },
    }
