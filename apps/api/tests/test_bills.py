from datetime import date, timedelta

import pytest
from httpx import AsyncClient


@pytest.fixture
async def auth_headers(client: AsyncClient) -> dict:
    await client.post("/api/auth/register", json={
        "email": "bills@example.com",
        "password": "SecurePass123!",
        "name": "Bills User",
    })
    login = await client.post("/api/auth/login", json={
        "email": "bills@example.com",
        "password": "SecurePass123!",
    })
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_create_bill(client: AsyncClient, auth_headers: dict):
    response = await client.post("/api/bills", headers=auth_headers, json={
        "name": "Netflix",
        "amount": "15.99",
        "frequency": "monthly",
        "day_of_month": 15,
        "next_due_date": "2026-04-15",
        "reminder_days": 3,
    })
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Netflix"
    assert data["amount"] == "15.99"
    assert data["frequency"] == "monthly"
    assert data["is_active"] is True
    assert data["source"] == "manual"


@pytest.mark.asyncio
async def test_list_bills(client: AsyncClient, auth_headers: dict):
    await client.post("/api/bills", headers=auth_headers, json={
        "name": "Electric",
        "amount": "120.00",
        "frequency": "monthly",
        "day_of_month": 1,
        "next_due_date": "2026-04-01",
    })
    await client.post("/api/bills", headers=auth_headers, json={
        "name": "Internet",
        "amount": "60.00",
        "frequency": "monthly",
        "day_of_month": 5,
        "next_due_date": "2026-04-05",
    })

    response = await client.get("/api/bills", headers=auth_headers)
    assert response.status_code == 200
    assert len(response.json()) == 2


@pytest.mark.asyncio
async def test_update_bill(client: AsyncClient, auth_headers: dict):
    create = await client.post("/api/bills", headers=auth_headers, json={
        "name": "Old Bill",
        "amount": "50.00",
        "frequency": "monthly",
        "day_of_month": 10,
        "next_due_date": "2026-04-10",
    })
    bill_id = create.json()["id"]

    response = await client.put(f"/api/bills/{bill_id}", headers=auth_headers, json={
        "name": "Updated Bill",
        "amount": "55.00",
    })
    assert response.status_code == 200
    assert response.json()["name"] == "Updated Bill"
    assert response.json()["amount"] == "55.00"


@pytest.mark.asyncio
async def test_delete_bill(client: AsyncClient, auth_headers: dict):
    create = await client.post("/api/bills", headers=auth_headers, json={
        "name": "To Delete",
        "amount": "10.00",
        "frequency": "monthly",
        "day_of_month": 1,
        "next_due_date": "2026-04-01",
    })
    bill_id = create.json()["id"]

    response = await client.delete(f"/api/bills/{bill_id}", headers=auth_headers)
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_upcoming_bills(client: AsyncClient, auth_headers: dict):
    # Create a bill due soon (5 days from now — always within 30-day window)
    soon = (date.today() + timedelta(days=5)).isoformat()
    await client.post("/api/bills", headers=auth_headers, json={
        "name": "Due Soon",
        "amount": "25.00",
        "frequency": "monthly",
        "day_of_month": 20,
        "next_due_date": soon,
    })
    # Create a bill due far away (120 days out — always outside 30-day window)
    later = (date.today() + timedelta(days=120)).isoformat()
    await client.post("/api/bills", headers=auth_headers, json={
        "name": "Due Later",
        "amount": "100.00",
        "frequency": "monthly",
        "day_of_month": 15,
        "next_due_date": later,
    })

    response = await client.get(
        "/api/bills/upcoming?days=30", headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    names = [b["name"] for b in data]
    assert "Due Soon" in names
    assert "Due Later" not in names
