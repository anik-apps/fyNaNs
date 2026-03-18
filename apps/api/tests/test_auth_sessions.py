import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_sessions(client: AsyncClient):
    # Register + login
    await client.post("/api/auth/register", json={
        "email": "session@example.com", "password": "SecurePass123!", "name": "Session User"
    })
    login = await client.post("/api/auth/login", json={
        "email": "session@example.com", "password": "SecurePass123!"
    })
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    response = await client.get("/api/auth/sessions", headers=headers)
    assert response.status_code == 200
    sessions = response.json()
    assert len(sessions) >= 1
    assert "device_info" in sessions[0]
    assert "created_at" in sessions[0]


@pytest.mark.asyncio
async def test_revoke_session(client: AsyncClient):
    await client.post("/api/auth/register", json={
        "email": "revoke@example.com", "password": "SecurePass123!", "name": "Revoke User"
    })
    login = await client.post("/api/auth/login", json={
        "email": "revoke@example.com", "password": "SecurePass123!"
    })
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    sessions = (await client.get("/api/auth/sessions", headers=headers)).json()
    session_id = sessions[0]["id"]

    response = await client.delete(f"/api/auth/sessions/{session_id}", headers=headers)
    assert response.status_code == 200
