"""Integration tests for health check."""

import httpx


def test_health_endpoint(client: httpx.Client):
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["database"] == "connected"
