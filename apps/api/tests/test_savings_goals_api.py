from decimal import Decimal

import pytest
from httpx import AsyncClient


# Per-file fixtures. auth_headers pattern matches apps/api/tests/test_bills.py:7-19.
@pytest.fixture
async def auth_headers(client: AsyncClient) -> dict:
    await client.post("/api/auth/register", json={
        "email": "goals@example.com",
        "password": "SecurePass123!",
        "name": "Goals User",
    })
    login = await client.post("/api/auth/login", json={
        "email": "goals@example.com",
        "password": "SecurePass123!",
    })
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def other_user_auth_headers(client: AsyncClient) -> dict:
    await client.post("/api/auth/register", json={
        "email": "goals-other@example.com",
        "password": "SecurePass123!",
        "name": "Other",
    })
    login = await client.post("/api/auth/login", json={
        "email": "goals-other@example.com",
        "password": "SecurePass123!",
    })
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_create_goal_minimal(client: AsyncClient, auth_headers):
    resp = await client.post("/api/goals", headers=auth_headers, json={
        "name": "Emergency",
        "target_amount": "10000.00",
    })
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["name"] == "Emergency"
    assert Decimal(str(data["target_amount"])) == Decimal("10000.00")
    assert data["status"] == "active"
    assert data["progress_pct"] == 0


@pytest.mark.asyncio
async def test_create_goal_rejects_zero_target(client, auth_headers):
    resp = await client.post("/api/goals", headers=auth_headers, json={
        "name": "Nope", "target_amount": "0",
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_list_goals_filters_by_status(client, auth_headers):
    await client.post("/api/goals", headers=auth_headers, json={
        "name": "A", "target_amount": "100",
    })
    r = await client.get("/api/goals?status=active", headers=auth_headers)
    assert r.status_code == 200
    assert all(g["status"] == "active" for g in r.json())


@pytest.mark.asyncio
async def test_detail_returns_history_and_notes(client, auth_headers):
    create = await client.post("/api/goals", headers=auth_headers, json={
        "name": "D", "target_amount": "100", "notes": "hi",
    })
    gid = create.json()["id"]
    r = await client.get(f"/api/goals/{gid}", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["notes"] == "hi"
    assert r.json()["contributions"] == []


@pytest.mark.asyncio
async def test_patch_goal_never_mutates_status(client, auth_headers):
    create = await client.post("/api/goals", headers=auth_headers, json={
        "name": "P", "target_amount": "100",
    })
    gid = create.json()["id"]
    r = await client.patch(f"/api/goals/{gid}", headers=auth_headers, json={
        "status": "completed",  # schema has no `status` field; ignored
        "name": "P2",
    })
    assert r.status_code == 200
    assert r.json()["name"] == "P2"
    assert r.json()["status"] == "active"


@pytest.mark.asyncio
async def test_patch_null_linked_account_unlinks(client, auth_headers, db_session):
    # Setting linked_account_id to null in a PATCH body clears the link;
    # omitting the field leaves it untouched.
    from decimal import Decimal

    from sqlalchemy import select

    from src.models.account import Account
    from src.models.user import User

    user = (await db_session.execute(
        select(User).where(User.email == "goals@example.com")
    )).scalar_one()
    acct = Account(
        user_id=user.id, name="Link", institution_name="Chase",
        type="savings", balance=Decimal("0"), is_manual=True,
    )
    db_session.add(acct)
    await db_session.commit()

    c = await client.post("/api/goals", headers=auth_headers, json={
        "name": "PL", "target_amount": "100",
        "linked_account_id": str(acct.id),
    })
    gid = c.json()["id"]

    r = await client.patch(f"/api/goals/{gid}", headers=auth_headers, json={
        "linked_account_id": None,
    })
    assert r.status_code == 200
    assert r.json()["linked_account"] is None


@pytest.mark.asyncio
async def test_archive_flips_status(client, auth_headers):
    c = await client.post("/api/goals", headers=auth_headers, json={
        "name": "Q", "target_amount": "50",
    })
    gid = c.json()["id"]
    r = await client.post(f"/api/goals/{gid}/archive", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "archived"


@pytest.mark.asyncio
async def test_delete_goal(client, auth_headers):
    c = await client.post("/api/goals", headers=auth_headers, json={
        "name": "X", "target_amount": "1",
    })
    gid = c.json()["id"]
    r = await client.delete(f"/api/goals/{gid}", headers=auth_headers)
    assert r.status_code == 200

    r2 = await client.get(f"/api/goals/{gid}", headers=auth_headers)
    assert r2.status_code == 404


@pytest.mark.asyncio
async def test_cannot_access_other_users_goal(
    client, auth_headers, other_user_auth_headers
):
    c = await client.post("/api/goals", headers=auth_headers, json={
        "name": "Mine", "target_amount": "1",
    })
    gid = c.json()["id"]
    r = await client.get(f"/api/goals/{gid}", headers=other_user_auth_headers)
    assert r.status_code == 404
