"""Prometheus metrics endpoint."""

from fastapi import APIRouter, Response
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

from src.core.database import collect_pool_stats

router = APIRouter(tags=["metrics"])


@router.get("/metrics")
async def metrics():
    collect_pool_stats()
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)
