"""Integration tests for the dashboard endpoint."""

from decimal import Decimal

import httpx


class TestDashboard:
    def test_dashboard_unauthenticated(self, client: httpx.Client):
        """Dashboard requires authentication."""
        resp = client.get("/dashboard")
        assert resp.status_code in (401, 403)

    def test_dashboard_returns_200(self, client: httpx.Client, auth_headers):
        """Dashboard returns a valid response for an authenticated user."""
        resp = client.get("/dashboard", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()

        # Verify top-level structure
        assert "net_worth" in data
        assert "accounts_by_type" in data
        assert "recent_transactions" in data
        assert "top_budgets" in data
        assert "upcoming_bills" in data
        assert "spending_comparison" in data

    def test_dashboard_net_worth_structure(self, client: httpx.Client, auth_headers):
        """Net worth section has the expected fields."""
        resp = client.get("/dashboard", headers=auth_headers)
        data = resp.json()
        nw = data["net_worth"]
        assert "total_assets" in nw
        assert "total_liabilities" in nw
        assert "net_worth" in nw
        # net_worth = total_assets - total_liabilities
        assert Decimal(nw["net_worth"]) == Decimal(nw["total_assets"]) - Decimal(
            nw["total_liabilities"]
        )

    def test_dashboard_accounts_by_type_structure(self, client: httpx.Client, auth_headers):
        """Accounts by type has all expected account type keys."""
        resp = client.get("/dashboard", headers=auth_headers)
        data = resp.json()
        abt = data["accounts_by_type"]
        for key in ("checking", "savings", "credit", "loan", "investment"):
            assert key in abt
            assert isinstance(abt[key], list)

    def test_dashboard_recent_transactions_limit(self, client: httpx.Client, auth_headers):
        """Recent transactions should be at most 10 items."""
        resp = client.get("/dashboard", headers=auth_headers)
        data = resp.json()
        assert len(data["recent_transactions"]) <= 10

    def test_dashboard_spending_comparison_structure(self, client: httpx.Client, auth_headers):
        """Spending comparison has the expected fields."""
        resp = client.get("/dashboard", headers=auth_headers)
        data = resp.json()
        sc = data["spending_comparison"]
        assert "current_month_total" in sc
        assert "previous_month_total" in sc
        assert "difference" in sc
        assert "percent_change" in sc

    def test_dashboard_with_account_data(self, client: httpx.Client, auth_headers):
        """Create an account and verify it shows up in the dashboard."""
        # Create a manual account
        resp = client.post("/accounts", headers=auth_headers, json={
            "institution_name": "Dashboard Test Bank",
            "name": "Test Checking",
            "type": "checking",
            "balance": "5000.00",
            "currency": "USD",
            "is_manual": True,
        })
        assert resp.status_code == 201

        # Verify dashboard reflects the account
        dash_resp = client.get("/dashboard", headers=auth_headers)
        assert dash_resp.status_code == 200
        data = dash_resp.json()

        # Should have at least one checking account
        assert len(data["accounts_by_type"]["checking"]) >= 1

        # Net worth should include the balance
        assert Decimal(data["net_worth"]["total_assets"]) >= Decimal("5000.00")
