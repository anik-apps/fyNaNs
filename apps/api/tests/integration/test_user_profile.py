"""Integration tests for user profile and settings."""

import httpx


def test_get_profile(client: httpx.Client, auth_headers, test_user):
    resp = client.get("/user/profile", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == test_user["email"]
    assert data["name"] == test_user["name"]
    assert "id" in data


def test_update_profile(client: httpx.Client, auth_headers, test_user):
    original_name = test_user["name"]

    try:
        resp = client.put("/user/profile", headers=auth_headers, json={
            "name": "Updated Integration Name"
        })
        assert resp.status_code == 200
        assert resp.json()["name"] == "Updated Integration Name"

        # Verify it persisted
        resp = client.get("/user/profile", headers=auth_headers)
        assert resp.json()["name"] == "Updated Integration Name"
    finally:
        # Restore original name even if assertions fail
        client.put("/user/profile", headers=auth_headers, json={"name": original_name})


def test_get_settings(client: httpx.Client, auth_headers):
    resp = client.get("/user/settings", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["theme"] == "system"
    assert data["notify_bill_reminders"] is True
    assert data["notify_budget_alerts"] is True


def test_update_settings(client: httpx.Client, auth_headers):
    try:
        resp = client.put("/user/settings", headers=auth_headers, json={
            "theme": "dark",
            "notify_push": False,
        })
        assert resp.status_code == 200
        assert resp.json()["theme"] == "dark"
        assert resp.json()["notify_push"] is False

        # Verify persistence
        resp = client.get("/user/settings", headers=auth_headers)
        assert resp.json()["theme"] == "dark"
    finally:
        # Restore defaults even if assertions fail
        client.put("/user/settings", headers=auth_headers, json={
            "theme": "system", "notify_push": True
        })


def test_update_settings_invalid_theme(client: httpx.Client, auth_headers):
    resp = client.put("/user/settings", headers=auth_headers, json={
        "theme": "neon",
    })
    assert resp.status_code == 422
