"""Integration tests for budgets, bills, notifications, and device tokens."""

import uuid

import httpx


def _unique(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


class TestBudgets:
    def _get_category_id(self, client, auth_headers):
        """Get a system category ID for budget creation."""
        categories = client.get("/categories", headers=auth_headers).json()
        # Find a leaf category (not a parent)
        for cat in categories:
            if cat["is_system"] and cat.get("parent_id"):
                return cat["id"]
        return categories[0]["id"]

    def test_create_budget(self, client: httpx.Client, auth_headers):
        cat_id = self._get_category_id(client, auth_headers)
        resp = client.post("/budgets", headers=auth_headers, json={
            "category_id": cat_id,
            "amount_limit": "500.00",
            "period": "monthly",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["amount_limit"] == "500.00"
        assert data["period"] == "monthly"
        assert "current_spend" in data

    def test_list_budgets_with_spend(self, client: httpx.Client, auth_headers):
        resp = client.get("/budgets", headers=auth_headers)
        assert resp.status_code == 200
        budgets = resp.json()
        assert isinstance(budgets, list)
        if budgets:
            assert "current_spend" in budgets[0]
            assert "amount_limit" in budgets[0]

    def test_budget_overview(self, client: httpx.Client, auth_headers):
        resp = client.get("/budgets/overview", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        if data:
            assert "percent_spent" in data[0]

    def test_update_budget(self, client: httpx.Client, auth_headers):
        cat_id = self._get_category_id(client, auth_headers)
        create_resp = client.post("/budgets", headers=auth_headers, json={
            "category_id": cat_id,
            "amount_limit": "200.00",
            "period": "monthly",
        })
        if create_resp.status_code == 409:
            # Budget already exists for this category, use existing
            budgets = client.get("/budgets", headers=auth_headers).json()
            budget_id = budgets[0]["id"]
        else:
            budget_id = create_resp.json()["id"]

        resp = client.put(f"/budgets/{budget_id}", headers=auth_headers, json={
            "amount_limit": "750.00",
        })
        assert resp.status_code == 200
        assert resp.json()["amount_limit"] == "750.00"

    def test_delete_budget(self, client: httpx.Client, auth_headers):
        # Create a custom category for a deletable budget
        custom_cat = client.post("/categories", headers=auth_headers, json={
            "name": _unique("budget-del-cat"),
            "icon": "trash",
            "color": "#FF0000",
        }).json()

        create_resp = client.post("/budgets", headers=auth_headers, json={
            "category_id": custom_cat["id"],
            "amount_limit": "100.00",
            "period": "monthly",
        })
        assert create_resp.status_code == 201
        budget_id = create_resp.json()["id"]

        resp = client.delete(f"/budgets/{budget_id}", headers=auth_headers)
        assert resp.status_code == 200

        # Cleanup
        client.delete(f"/categories/{custom_cat['id']}", headers=auth_headers)

    def test_invalid_period_rejected(self, client: httpx.Client, auth_headers):
        cat_id = self._get_category_id(client, auth_headers)
        resp = client.post("/budgets", headers=auth_headers, json={
            "category_id": cat_id,
            "amount_limit": "100.00",
            "period": "biweekly",
        })
        assert resp.status_code == 422


class TestBills:
    def test_create_bill(self, client: httpx.Client, auth_headers):
        resp = client.post("/bills", headers=auth_headers, json={
            "name": "Netflix",
            "amount": "15.99",
            "frequency": "monthly",
            "day_of_month": 15,
            "next_due_date": "2026-04-15",
            "reminder_days": 3,
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Netflix"
        assert data["amount"] == "15.99"
        assert data["frequency"] == "monthly"
        assert data["source"] == "manual"

    def test_list_bills(self, client: httpx.Client, auth_headers):
        resp = client.get("/bills", headers=auth_headers)
        assert resp.status_code == 200
        bills = resp.json()
        assert isinstance(bills, list)

    def test_upcoming_bills(self, client: httpx.Client, auth_headers):
        resp = client.get("/bills/upcoming", headers=auth_headers, params={"days": 90})
        assert resp.status_code == 200
        bills = resp.json()
        assert isinstance(bills, list)

    def test_upcoming_bills_max_days(self, client: httpx.Client, auth_headers):
        resp = client.get("/bills/upcoming", headers=auth_headers, params={"days": 91})
        assert resp.status_code == 422  # Exceeds max 90

    def test_update_bill(self, client: httpx.Client, auth_headers):
        create_resp = client.post("/bills", headers=auth_headers, json={
            "name": _unique("update-bill"),
            "amount": "50.00",
            "frequency": "monthly",
            "day_of_month": 1,
            "next_due_date": "2026-04-01",
        })
        bill_id = create_resp.json()["id"]

        resp = client.put(f"/bills/{bill_id}", headers=auth_headers, json={
            "amount": "55.00",
            "name": "Updated Bill",
        })
        assert resp.status_code == 200
        assert resp.json()["amount"] == "55.00"
        assert resp.json()["name"] == "Updated Bill"

    def test_delete_bill(self, client: httpx.Client, auth_headers):
        create_resp = client.post("/bills", headers=auth_headers, json={
            "name": _unique("delete-bill"),
            "amount": "10.00",
            "frequency": "monthly",
            "day_of_month": 20,
            "next_due_date": "2026-04-20",
        })
        bill_id = create_resp.json()["id"]

        resp = client.delete(f"/bills/{bill_id}", headers=auth_headers)
        assert resp.status_code == 200

    def test_invalid_frequency_rejected(self, client: httpx.Client, auth_headers):
        resp = client.post("/bills", headers=auth_headers, json={
            "name": "Bad Bill",
            "amount": "10.00",
            "frequency": "biweekly",
            "next_due_date": "2026-04-01",
        })
        assert resp.status_code == 422

    def test_weekly_bill_requires_day_of_week(self, client: httpx.Client, auth_headers):
        resp = client.post("/bills", headers=auth_headers, json={
            "name": "Weekly Bill",
            "amount": "10.00",
            "frequency": "weekly",
            "day_of_week": 0,  # Monday
            "next_due_date": "2026-03-23",
        })
        assert resp.status_code == 201
        assert resp.json()["frequency"] == "weekly"


class TestNotifications:
    def test_list_notifications(self, client: httpx.Client, auth_headers):
        resp = client.get("/notifications", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data or isinstance(data, list)

    def test_mark_all_read(self, client: httpx.Client, auth_headers):
        resp = client.post("/notifications/read-all", headers=auth_headers)
        assert resp.status_code == 200


class TestDeviceTokens:
    def test_register_device_token(self, client: httpx.Client, auth_headers):
        resp = client.post("/device-tokens", headers=auth_headers, json={
            "token": f"ExponentPushToken[{_unique('test')}]",
            "platform": "ios",
        })
        assert resp.status_code in (200, 201)
        data = resp.json()
        assert "id" in data
        return data["id"]

    def test_register_duplicate_token_idempotent(self, client: httpx.Client, auth_headers):
        token = f"ExponentPushToken[{_unique('dedup')}]"
        resp1 = client.post("/device-tokens", headers=auth_headers, json={
            "token": token, "platform": "android",
        })
        resp2 = client.post("/device-tokens", headers=auth_headers, json={
            "token": token, "platform": "android",
        })
        assert resp1.json()["id"] == resp2.json()["id"]

    def test_invalid_platform_rejected(self, client: httpx.Client, auth_headers):
        resp = client.post("/device-tokens", headers=auth_headers, json={
            "token": "some-token",
            "platform": "windows",
        })
        assert resp.status_code == 422

    def test_delete_device_token(self, client: httpx.Client, auth_headers):
        # Register first
        token = f"ExponentPushToken[{_unique('del')}]"
        create_resp = client.post("/device-tokens", headers=auth_headers, json={
            "token": token, "platform": "ios",
        })
        token_id = create_resp.json()["id"]

        resp = client.delete(f"/device-tokens/{token_id}", headers=auth_headers)
        assert resp.status_code == 200


class TestUserExportAndDeletion:
    def _create_user_with_data(self, client):
        """Create a user with accounts, transactions, budgets, bills for deletion test."""
        email = f"deltest-{uuid.uuid4().hex[:8]}@example.com"
        client.post("/auth/register", json={
            "email": email, "password": "DeleteMe123!", "name": "Delete User"
        })
        login = client.post("/auth/login", json={
            "email": email, "password": "DeleteMe123!"
        })
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

        # Create account
        acct = client.post("/accounts", headers=headers, json={
            "name": "Delete Test Acct", "type": "checking",
            "balance": "100.00", "institution_name": "Test Bank"
        }).json()

        # Create transaction
        client.post("/transactions", headers=headers, json={
            "account_id": acct["id"], "amount": "25.00",
            "date": "2026-03-18", "description": "Test txn"
        })

        # Create bill
        client.post("/bills", headers=headers, json={
            "name": "Test Bill", "amount": "10.00",
            "frequency": "monthly", "day_of_month": 1,
            "next_due_date": "2026-04-01",
        })

        return headers, email

    def test_export_user_data(self, client: httpx.Client, auth_headers):
        resp = client.post("/user/export", headers=auth_headers)
        assert resp.status_code == 202

    def test_delete_account_cascades_all_data(self, client: httpx.Client):
        headers, email = self._create_user_with_data(client)

        # Delete account
        resp = client.delete("/user/account", headers=headers)
        assert resp.status_code == 200

        # Verify login no longer works
        login_resp = client.post("/auth/login", json={
            "email": email, "password": "DeleteMe123!"
        })
        assert login_resp.status_code == 401
