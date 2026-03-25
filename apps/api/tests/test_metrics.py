import pytest


@pytest.mark.asyncio
async def test_metrics_endpoint_returns_prometheus_format(client):
    resp = await client.get("/metrics")
    assert resp.status_code == 200
    assert "text/plain" in resp.headers.get("content-type", "")
    body = resp.text
    assert "process_" in body or "python_" in body


@pytest.mark.asyncio
async def test_metrics_endpoint_tracks_requests(client):
    await client.get("/api/health")
    resp = await client.get("/metrics")
    assert resp.status_code == 200
    assert "http_requests_total" in resp.text


@pytest.mark.asyncio
async def test_metrics_endpoint_excluded_from_rate_limit(client):
    for _ in range(20):
        resp = await client.get("/metrics")
        assert resp.status_code == 200
