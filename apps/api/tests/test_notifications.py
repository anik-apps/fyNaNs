import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.notification import Notification


@pytest.fixture
async def auth_and_notifications(
    client: AsyncClient, db_session: AsyncSession
) -> tuple[dict, list]:
    """Register user, create some notifications. Returns (headers, notification_ids)."""
    await client.post("/api/auth/register", json={
        "email": "notif@example.com",
        "password": "SecurePass123!",
        "name": "Notif User",
    })
    login = await client.post("/api/auth/login", json={
        "email": "notif@example.com",
        "password": "SecurePass123!",
    })
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Get user_id from profile
    profile = await client.get("/api/user/profile", headers=headers)
    user_id = uuid.UUID(profile.json()["id"])

    # Create notifications directly in DB
    notif_ids = []
    for i, ntype in enumerate(["budget_80", "bill_reminder", "budget_100"]):
        notif = Notification(
            user_id=user_id,
            type=ntype,
            reference_id=uuid.uuid4(),
            period_key=f"2026-03-{i}",
            channel="push",
        )
        db_session.add(notif)
        await db_session.flush()
        notif_ids.append(notif.id)

    await db_session.commit()
    return headers, notif_ids


@pytest.mark.asyncio
async def test_list_notifications(client: AsyncClient, auth_and_notifications):
    headers, _ = auth_and_notifications

    response = await client.get("/api/notifications", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 3
    assert "unread_count" in data
    assert data["unread_count"] == 3


@pytest.mark.asyncio
async def test_mark_notification_as_read(client: AsyncClient, auth_and_notifications):
    headers, notif_ids = auth_and_notifications

    response = await client.patch(
        f"/api/notifications/{notif_ids[0]}", headers=headers
    )
    assert response.status_code == 200
    assert response.json()["read_at"] is not None

    # Verify unread count decreased
    list_resp = await client.get("/api/notifications", headers=headers)
    assert list_resp.json()["unread_count"] == 2


@pytest.mark.asyncio
async def test_mark_all_as_read(client: AsyncClient, auth_and_notifications):
    headers, _ = auth_and_notifications

    response = await client.post("/api/notifications/read-all", headers=headers)
    assert response.status_code == 200

    list_resp = await client.get("/api/notifications", headers=headers)
    assert list_resp.json()["unread_count"] == 0
