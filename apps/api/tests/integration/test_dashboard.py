"""Integration tests for the dashboard endpoint."""

import uuid
from datetime import date, timedelta
from decimal import Decimal

import httpx
import pytest


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
        # net_worth should approximately equal total_assets - total_liabilities.
        # Use abs() comparison to tolerate minor floating-point / rounding differences.
        expected = Decimal(nw["total_assets"]) - Decimal(nw["total_liabilities"])
        actual = Decimal(nw["net_worth"])
        assert abs(actual - expected) <= Decimal("0.02"), (
            f"net_worth mismatch: {actual} vs expected {expected}"
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

    def test_dashboard_top_budgets_exact_spend(self, client: httpx.Client):
        """top_budgets amount_spent must count exactly the in-window expenses.

        Uses a dedicated user so no other test's transactions pollute the
        totals. Seeds weekly/monthly/yearly budgets with transactions exactly
        inside each window (Monday of ISO week, 1st of month, Jan 1), exactly
        outside (Sunday before, last day of prev month, Dec 31 prev year),
        and an in-window negative refund that must be excluded.
        """
        # Dedicated user
        email = f"dash-budgets-{uuid.uuid4().hex[:8]}@example.com"
        password = "DashBudget123!"
        resp = client.post("/auth/register", json={
            "email": email, "password": password, "name": "Dash Budget User",
        })
        assert resp.status_code == 201, resp.text
        login = client.post("/auth/login", json={"email": email, "password": password})
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

        acct = client.post("/accounts", headers=headers, json={
            "name": "Dash Budget Checking",
            "type": "checking",
            "balance": "1000.00",
            "institution_name": "Dash Budget Bank",
        }).json()

        today = date.today()
        week_start = today - timedelta(days=today.weekday())
        month_start = today.replace(day=1)
        year_start = today.replace(month=1, day=1)

        plans = {
            "weekly": {
                "limit": Decimal("100.00"),   # -> ~50.3% spent
                "expected": Decimal("50.25"),
                "txns": [
                    (week_start, "50.25"),
                    (week_start - timedelta(days=1), "10.00"),  # outside
                ],
            },
            "monthly": {
                "limit": Decimal("125.00"),   # -> ~80.1% spent
                "expected": Decimal("100.10"),
                "txns": [
                    (month_start, "100.10"),
                    (month_start - timedelta(days=1), "20.00"),  # outside
                    (today, "-25.00"),  # refund in-window: excluded
                ],
            },
            "yearly": {
                "limit": Decimal("800.00"),   # -> ~25.0% spent
                "expected": Decimal("200.05"),
                "txns": [
                    (year_start, "200.05"),
                    (year_start - timedelta(days=1), "30.00"),  # outside
                ],
            },
        }

        for period, plan in plans.items():
            cat = client.post("/categories", headers=headers, json={
                "name": f"dash-{period}-cat",
                "icon": "wallet",
                "color": "#3366FF",
            }).json()
            plan["category_name"] = cat["name"]

            budget_resp = client.post("/budgets", headers=headers, json={
                "category_id": cat["id"],
                "amount_limit": str(plan["limit"]),
                "period": period,
            })
            assert budget_resp.status_code == 201, budget_resp.text

            for txn_date, amount in plan["txns"]:
                txn_resp = client.post("/transactions", headers=headers, json={
                    "account_id": acct["id"],
                    "amount": amount,
                    "date": txn_date.isoformat(),
                    "description": f"dash {period} txn {amount}",
                    "category_id": cat["id"],
                })
                assert txn_resp.status_code in (200, 201), txn_resp.text

        dash = client.get("/dashboard", headers=headers)
        assert dash.status_code == 200
        top_budgets = dash.json()["top_budgets"]
        assert len(top_budgets) == 3

        by_period = {b["period"]: b for b in top_budgets}
        for period, plan in plans.items():
            budget = by_period[period]
            assert budget["category_name"] == plan["category_name"]
            assert Decimal(str(budget["amount_spent"])) == plan["expected"], (
                f"{period} amount_spent mismatch: {budget['amount_spent']}"
            )
            assert Decimal(str(budget["amount_limit"])) == plan["limit"]
            expected_pct = float(plan["expected"] / plan["limit"] * 100)
            assert budget["percent_spent"] == pytest.approx(expected_pct, abs=0.06)

        # Ranked by percent spent: monthly (~80.1) > weekly (~50.3) > yearly (~25.0)
        assert [b["period"] for b in top_budgets] == ["monthly", "weekly", "yearly"]
