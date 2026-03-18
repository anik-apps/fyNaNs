"""Integration tests for accounts, transactions, and categories."""

import httpx


class TestCategories:
    def test_list_system_categories(self, client: httpx.Client, auth_headers):
        resp = client.get("/categories", headers=auth_headers)
        assert resp.status_code == 200
        categories = resp.json()
        assert len(categories) > 10  # We seeded 40+ categories
        # Check some expected system categories exist
        names = [c["name"] for c in categories]
        assert "Income" in names
        assert "Food & Drink" in names
        assert "Uncategorized" in names

    def test_create_and_delete_custom_category(self, client: httpx.Client, auth_headers):
        resp = client.post("/categories", headers=auth_headers, json={
            "name": "Integration Test Category",
            "icon": "test",
            "color": "#FF0000",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Integration Test Category"
        assert data["is_system"] is False

        # Clean up — delete the custom category
        del_resp = client.delete(f"/categories/{data['id']}", headers=auth_headers)
        assert del_resp.status_code == 200

    def test_cannot_delete_system_category(self, client: httpx.Client, auth_headers):
        # Get a system category
        categories = client.get("/categories", headers=auth_headers).json()
        system_cat = next(c for c in categories if c["is_system"])

        resp = client.delete(f"/categories/{system_cat['id']}", headers=auth_headers)
        assert resp.status_code in (403, 400)


class TestAccounts:
    def test_create_manual_account(self, client: httpx.Client, auth_headers):
        resp = client.post("/accounts", headers=auth_headers, json={
            "name": "Test Checking",
            "type": "checking",
            "balance": "1500.00",
            "institution_name": "Test Bank",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Test Checking"
        assert data["type"] == "checking"
        assert data["balance"] == "1500.00"
        assert data["is_manual"] is True
        return data["id"]

    def test_list_accounts(self, client: httpx.Client, auth_headers):
        resp = client.get("/accounts", headers=auth_headers)
        assert resp.status_code == 200
        accounts = resp.json()
        assert isinstance(accounts, list)

    def test_create_multiple_account_types(self, client: httpx.Client, auth_headers):
        for acct_type in ["savings", "credit"]:
            resp = client.post("/accounts", headers=auth_headers, json={
                "name": f"Test {acct_type.title()}",
                "type": acct_type,
                "balance": "500.00",
                "institution_name": "Test Bank",
            })
            assert resp.status_code == 201, f"Failed to create {acct_type}: {resp.text}"

    def test_update_account(self, client: httpx.Client, auth_headers):
        # Create one first
        create_resp = client.post("/accounts", headers=auth_headers, json={
            "name": "To Update",
            "type": "checking",
            "balance": "100.00",
            "institution_name": "Old Bank",
        })
        account_id = create_resp.json()["id"]

        # Update
        resp = client.put(f"/accounts/{account_id}", headers=auth_headers, json={
            "name": "Updated Account",
            "balance": "999.99",
        })
        assert resp.status_code == 200
        assert resp.json()["name"] == "Updated Account"
        assert resp.json()["balance"] == "999.99"

    def test_delete_account(self, client: httpx.Client, auth_headers):
        create_resp = client.post("/accounts", headers=auth_headers, json={
            "name": "To Delete",
            "type": "checking",
            "balance": "0.00",
            "institution_name": "Temp Bank",
        })
        account_id = create_resp.json()["id"]

        resp = client.delete(f"/accounts/{account_id}", headers=auth_headers)
        assert resp.status_code == 200

        # Verify gone
        resp = client.get(f"/accounts/{account_id}/balance", headers=auth_headers)
        assert resp.status_code == 404


class TestTransactions:
    def _get_or_create_account(self, client, auth_headers):
        """Get first account or create one."""
        accounts = client.get("/accounts", headers=auth_headers).json()
        if accounts:
            return accounts[0]["id"]
        resp = client.post("/accounts", headers=auth_headers, json={
            "name": "Txn Test Account",
            "type": "checking",
            "balance": "5000.00",
            "institution_name": "Test Bank",
        })
        return resp.json()["id"]

    def test_create_manual_transaction(self, client: httpx.Client, auth_headers):
        account_id = self._get_or_create_account(client, auth_headers)

        resp = client.post("/transactions", headers=auth_headers, json={
            "account_id": account_id,
            "amount": "42.50",
            "date": "2026-03-15",
            "description": "Coffee Shop",
            "merchant_name": "Starbucks",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["amount"] == "42.50"
        assert data["description"] == "Coffee Shop"
        assert data["is_manual"] is True

    def test_list_transactions_with_pagination(self, client: httpx.Client, auth_headers):
        account_id = self._get_or_create_account(client, auth_headers)

        # Create a few transactions
        for i in range(5):
            client.post("/transactions", headers=auth_headers, json={
                "account_id": account_id,
                "amount": f"{10 + i}.00",
                "date": f"2026-03-{10 + i:02d}",
                "description": f"Transaction {i}",
            })

        # List with limit
        resp = client.get("/transactions", headers=auth_headers, params={"limit": 3})
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["items"]) <= 3

    def test_list_transactions_filter_by_date(self, client: httpx.Client, auth_headers):
        resp = client.get("/transactions", headers=auth_headers, params={
            "start_date": "2026-03-01",
            "end_date": "2026-03-31",
        })
        assert resp.status_code == 200
        for txn in resp.json()["items"]:
            assert txn["date"].startswith("2026-03")

    def test_list_transactions_search(self, client: httpx.Client, auth_headers):
        resp = client.get("/transactions", headers=auth_headers, params={
            "search": "Coffee"
        })
        assert resp.status_code == 200
        # Should find the coffee shop transaction
        items = resp.json()["items"]
        if items:
            assert any("Coffee" in t["description"] for t in items)

    def test_update_transaction(self, client: httpx.Client, auth_headers):
        account_id = self._get_or_create_account(client, auth_headers)

        # Create
        create_resp = client.post("/transactions", headers=auth_headers, json={
            "account_id": account_id,
            "amount": "25.00",
            "date": "2026-03-16",
            "description": "Unknown Purchase",
        })
        txn_id = create_resp.json()["id"]

        # Update description and add notes
        resp = client.put(f"/transactions/{txn_id}", headers=auth_headers, json={
            "description": "Grocery Store",
            "notes": "Weekly groceries",
        })
        assert resp.status_code == 200
        assert resp.json()["description"] == "Grocery Store"
        assert resp.json()["notes"] == "Weekly groceries"

    def test_delete_transaction(self, client: httpx.Client, auth_headers):
        account_id = self._get_or_create_account(client, auth_headers)

        create_resp = client.post("/transactions", headers=auth_headers, json={
            "account_id": account_id,
            "amount": "5.00",
            "date": "2026-03-17",
            "description": "To Delete",
        })
        txn_id = create_resp.json()["id"]

        resp = client.delete(f"/transactions/{txn_id}", headers=auth_headers)
        assert resp.status_code == 200

    def test_transaction_summary(self, client: httpx.Client, auth_headers):
        resp = client.get("/transactions/summary", headers=auth_headers, params={
            "period_start": "2026-03-01",
            "period_end": "2026-03-31",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert "period_start" in data
        assert "period_end" in data

    def test_import_csv(self, client: httpx.Client, auth_headers):
        account_id = self._get_or_create_account(client, auth_headers)

        csv_content = (
            "Date,Amount,Description\n"
            "03/01/2026,15.99,Netflix Subscription\n"
            "03/02/2026,45.00,Gas Station\n"
            "03/03/2026,-2000.00,Paycheck\n"
        )

        resp = client.post(
            "/transactions/import",
            headers=auth_headers,
            params={"account_id": account_id},
            files={"file": ("transactions.csv", csv_content, "text/csv")},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["imported"] >= 3
        assert "skipped_duplicates" in data

    def test_import_csv_deduplication(self, client: httpx.Client, auth_headers):
        """Importing the same CSV twice should skip duplicates."""
        account_id = self._get_or_create_account(client, auth_headers)

        csv_content = (
            "Date,Amount,Description\n"
            "03/18/2026,99.99,Unique Dedup Test\n"
        )

        # First import
        resp1 = client.post(
            "/transactions/import",
            headers=auth_headers,
            params={"account_id": account_id},
            files={"file": ("dedup.csv", csv_content, "text/csv")},
        )
        assert resp1.json()["imported"] >= 1

        # Second import — should be deduplicated
        resp2 = client.post(
            "/transactions/import",
            headers=auth_headers,
            params={"account_id": account_id},
            files={"file": ("dedup.csv", csv_content, "text/csv")},
        )
        assert resp2.json()["skipped_duplicates"] >= 1


class TestCrossUserIsolation:
    """Verify that users cannot access each other's data."""

    def _create_user(self, client, suffix):
        email = f"isolation-{suffix}@example.com"
        client.post("/auth/register", json={
            "email": email, "password": "IsolationTest123!", "name": f"User {suffix}"
        })
        login = client.post("/auth/login", json={
            "email": email, "password": "IsolationTest123!"
        })
        return {"Authorization": f"Bearer {login.json()['access_token']}"}

    def test_user_cannot_see_other_users_accounts(self, client: httpx.Client, unique_suffix):
        headers_a = self._create_user(client, f"a-{unique_suffix}")
        headers_b = self._create_user(client, f"b-{unique_suffix}")

        # User A creates an account
        resp = client.post("/accounts", headers=headers_a, json={
            "name": "User A Private",
            "type": "checking",
            "balance": "10000.00",
            "institution_name": "A Bank",
        })
        account_id = resp.json()["id"]

        # User B should not see it
        accounts_b = client.get("/accounts", headers=headers_b).json()
        account_ids_b = [a["id"] for a in accounts_b]
        assert account_id not in account_ids_b

    def test_user_cannot_see_other_users_transactions(self, client: httpx.Client, unique_suffix):
        headers_a = self._create_user(client, f"txn-a-{unique_suffix}")
        headers_b = self._create_user(client, f"txn-b-{unique_suffix}")

        # User A creates account + transaction
        acct = client.post("/accounts", headers=headers_a, json={
            "name": "A Checking", "type": "checking", "balance": "100.00",
            "institution_name": "A Bank"
        }).json()
        client.post("/transactions", headers=headers_a, json={
            "account_id": acct["id"],
            "amount": "50.00",
            "date": "2026-03-18",
            "description": "Private Purchase",
        })

        # User B's transactions should not include User A's
        txns_b = client.get("/transactions", headers=headers_b).json()
        descriptions = [t["description"] for t in txns_b["items"]]
        assert "Private Purchase" not in descriptions
