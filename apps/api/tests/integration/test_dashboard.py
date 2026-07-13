"""Integration tests for the dashboard endpoint."""

import uuid
from datetime import date, timedelta
from decimal import Decimal

import httpx
import pytest


def _register_user(client: httpx.Client, prefix: str) -> dict:
    """Register a dedicated user and return auth headers."""
    email = f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"
    password = "HistTest123!"
    resp = client.post("/auth/register", json={
        "email": email, "password": password, "name": f"{prefix} user",
    })
    assert resp.status_code == 201, resp.text
    login = client.post("/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200, login.text
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def _system_category_ids(client: httpx.Client, headers: dict) -> dict:
    """Map of category name -> id (system + user categories)."""
    resp = client.get("/categories", headers=headers)
    assert resp.status_code == 200, resp.text
    return {c["name"]: c["id"] for c in resp.json()}


def _seed_txn(client, headers, account_id, txn_date, amount, category_id=None):
    resp = client.post("/transactions", headers=headers, json={
        "account_id": account_id,
        "amount": amount,
        "date": txn_date.isoformat(),
        "description": f"hist seed {amount} on {txn_date.isoformat()}",
        "category_id": category_id,
    })
    assert resp.status_code in (200, 201), resp.text


def _classify(amount: float, category_name: str | None) -> str:
    """Reference classification, mirroring the documented API behavior.

    Transfers are excluded entirely; income categories or negative amounts
    (Plaid sign convention: negative = money in) count as income; everything
    else counts as spending.
    """
    if category_name == "Transfer":
        return "skip"
    if category_name == "Income" or amount < 0:
        return "income"
    return "spending"


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

    def test_dashboard_spending_comparison_exact_totals(self, client: httpx.Client):
        """spending_comparison must count exactly the in-window expenses.

        Dedicated user. Current month: one categorized expense + one
        uncategorized positive (both count), plus a refund (negative,
        skipped), an income-category txn (skipped) and a transfer (skipped).
        Previous month: one expense on its last day (inclusive bound).
        A txn the day before the previous month must not count anywhere.
        """
        headers = _register_user(client, "spend-cmp")
        cats = _system_category_ids(client, headers)
        acct = client.post("/accounts", headers=headers, json={
            "name": "Spend Cmp Checking",
            "type": "checking",
            "balance": "500.00",
            "institution_name": "Spend Cmp Bank",
        }).json()

        today = date.today()
        month_start = today.replace(day=1)
        prev_month_end = month_start - timedelta(days=1)
        prev_month_start = prev_month_end.replace(day=1)

        seeds = [
            (month_start, "75.50", cats["Food & Drink"]),   # current: counts
            (today, "24.50", None),                          # current: counts (uncategorized)
            (today, "-20.00", None),                         # current: refund, skipped
            (month_start, "500.00", cats["Income"]),        # current: income, skipped
            (month_start, "300.00", cats["Transfer"]),      # current: transfer, skipped
            (prev_month_end, "40.00", cats["Food & Drink"]),  # previous: counts
            (prev_month_start - timedelta(days=1), "99.00", cats["Food & Drink"]),  # too old
        ]
        for txn_date, amount, cat_id in seeds:
            _seed_txn(client, headers, acct["id"], txn_date, amount, cat_id)

        resp = client.get("/dashboard", headers=headers)
        assert resp.status_code == 200
        sc = resp.json()["spending_comparison"]

        assert Decimal(str(sc["current_month_total"])) == Decimal("100.00")
        assert Decimal(str(sc["previous_month_total"])) == Decimal("40.00")
        assert Decimal(str(sc["difference"])) == Decimal("60.00")
        assert sc["percent_change"] == pytest.approx(150.0)


class TestNetWorthHistory:
    """Equivalence tests for GET /dashboard/net-worth-history.

    Pin the exact per-day deltas and running-balance walk so the
    implementation can be swapped without changing behavior.
    """

    @pytest.fixture(scope="class")
    def nw_setup(self, client: httpx.Client):
        headers = _register_user(client, "nw-hist")
        cats = _system_category_ids(client, headers)
        acct = client.post("/accounts", headers=headers, json={
            "name": "NW History Checking",
            "type": "checking",
            "balance": "1000.00",
            "institution_name": "NW Hist Bank",
        }).json()

        today = date.today()
        # Per-day deltas (working backwards from current balances):
        #   today-2: expense +50, income-cat -200, uncategorized negative -30,
        #            transfer excluded          => net delta -180
        #   today-5: expense +20, uncategorized positive +15 => net delta +35
        #   future/too-old txns must not affect any point.
        seeds = [
            (today - timedelta(days=2), "50.00", cats["Food & Drink"]),
            (today - timedelta(days=2), "200.00", cats["Income"]),
            (today - timedelta(days=2), "-30.00", None),
            (today - timedelta(days=2), "999.99", cats["Transfer"]),
            (today - timedelta(days=5), "20.00", cats["Food & Drink"]),
            (today - timedelta(days=5), "15.00", None),
            (today + timedelta(days=3), "77.00", cats["Food & Drink"]),
            (today - timedelta(days=100), "500.00", cats["Food & Drink"]),
        ]
        for txn_date, amount, cat_id in seeds:
            _seed_txn(client, headers, acct["id"], txn_date, amount, cat_id)

        return {"headers": headers, "today": today}

    def test_net_worth_history_1m_exact_daily_points(self, client: httpx.Client, nw_setup):
        headers, today = nw_setup["headers"], nw_setup["today"]

        resp = client.get("/dashboard/net-worth-history?period=1m", headers=headers)
        assert resp.status_code == 200
        data = resp.json()

        assert data["current_net_worth"] == pytest.approx(1000.00)

        points = data["points"]
        # Daily points: today + 30 previous days, oldest first.
        assert len(points) == 31
        dates = [p["date"] for p in points]
        assert dates == sorted(dates)
        assert dates[-1] == today.isoformat()
        assert dates[0] == (today - timedelta(days=30)).isoformat()

        by_date = {p["date"]: p["net_worth"] for p in points}
        for offset in range(0, 31):
            d = (today - timedelta(days=offset)).isoformat()
            if offset <= 2:
                expected = 1000.00  # after all seeded txns
            elif offset <= 5:
                expected = 820.00   # before today-2 txns (1000 - 180)
            else:
                expected = 855.00   # before today-5 txns (820 + 35)
            assert by_date[d] == pytest.approx(expected), f"offset {offset} ({d})"

    def test_net_worth_history_3m_exact_interval_points(self, client: httpx.Client, nw_setup):
        headers, today = nw_setup["headers"], nw_setup["today"]

        resp = client.get("/dashboard/net-worth-history?period=3m", headers=headers)
        assert resp.status_code == 200
        data = resp.json()

        assert data["current_net_worth"] == pytest.approx(1000.00)

        points = data["points"]
        # 3m: today + one point every 3 days over 90 days, oldest first.
        assert len(points) == 31
        expected_dates = sorted(
            [(today - timedelta(days=o)).isoformat() for o in range(3, 91, 3)] + [today.isoformat()]
        )
        assert [p["date"] for p in points] == expected_dates

        by_date = {p["date"]: p["net_worth"] for p in points}
        assert by_date[today.isoformat()] == pytest.approx(1000.00)
        assert by_date[(today - timedelta(days=3)).isoformat()] == pytest.approx(820.00)
        for offset in range(6, 91, 3):
            d = (today - timedelta(days=offset)).isoformat()
            assert by_date[d] == pytest.approx(855.00), f"offset {offset} ({d})"


class TestSpendingHistory:
    """Equivalence tests for GET /dashboard/spending-history."""

    @pytest.fixture(scope="class")
    def spend_setup(self, client: httpx.Client):
        headers = _register_user(client, "spend-hist")
        cats = _system_category_ids(client, headers)
        acct = client.post("/accounts", headers=headers, json={
            "name": "Spend History Checking",
            "type": "checking",
            "balance": "2000.00",
            "institution_name": "Spend Hist Bank",
        }).json()

        today = date.today()
        month_start = today.replace(day=1)
        prev_month_start = (month_start - timedelta(days=1)).replace(day=1)
        last_year_date = date(today.year - 1, 6, 15)

        # (date, amount, category name or None)
        seeds = [
            (month_start, "40.00", "Food & Drink"),   # current month spending
            (month_start, "100.00", "Income"),        # current month income (category)
            (month_start, "500.00", "Transfer"),      # excluded entirely
            (today, "-25.50", None),                  # income by sign (uncategorized)
            (today, "10.00", None),                   # spending (uncategorized)
            (prev_month_start, "80.25", "Food & Drink"),  # prev month spending
            (prev_month_start, "-60.00", "Income"),   # prev month income (abs)
            (last_year_date, "30.00", "Food & Drink"),  # last year spending
        ]
        for txn_date, amount, cat_name in seeds:
            _seed_txn(
                client, headers, acct["id"], txn_date, amount,
                cats[cat_name] if cat_name else None,
            )

        return {"headers": headers, "today": today, "seeds": seeds}

    @staticmethod
    def _expected_bucket_totals(seeds, bucket_key) -> dict:
        """Reference totals: {bucket: (spending, income)} using _classify."""
        totals: dict = {}
        for txn_date, amount, cat_name in seeds:
            amt = float(amount)
            kind = _classify(amt, cat_name)
            if kind == "skip":
                continue
            key = bucket_key(txn_date)
            spending, income = totals.get(key, (0.0, 0.0))
            if kind == "income":
                income += abs(amt)
            else:
                spending += abs(amt)
            totals[key] = (spending, income)
        return totals

    def test_spending_history_monthly_exact_totals(self, client: httpx.Client, spend_setup):
        headers, today, seeds = (
            spend_setup["headers"], spend_setup["today"], spend_setup["seeds"]
        )

        resp = client.get("/dashboard/spending-history?view=monthly&months=3", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["view"] == "monthly"

        points = data["points"]
        assert len(points) == 3

        # The three expected month starts, oldest first.
        month_starts = []
        for i in range(2, -1, -1):
            m, y = today.month - i, today.year
            while m <= 0:
                m += 12
                y -= 1
            month_starts.append(date(y, m, 1))

        expected = self._expected_bucket_totals(
            seeds, lambda d: d.replace(day=1),
        )
        for point, mstart in zip(points, month_starts, strict=False):
            spending, income = expected.get(mstart, (0.0, 0.0))
            assert point["label"] == mstart.strftime("%b %Y")
            assert point["period_start"] == mstart.isoformat()
            assert point["spending"] == pytest.approx(round(spending, 2)), point
            assert point["income"] == pytest.approx(round(income, 2)), point

    def test_spending_history_yearly_exact_totals(self, client: httpx.Client, spend_setup):
        headers, today, seeds = (
            spend_setup["headers"], spend_setup["today"], spend_setup["seeds"]
        )

        # months=24 -> 3 yearly buckets: [year-2, year-1, year]
        resp = client.get("/dashboard/spending-history?view=yearly&months=24", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["view"] == "yearly"

        points = data["points"]
        assert len(points) == 3

        years = [today.year - 2, today.year - 1, today.year]
        expected = self._expected_bucket_totals(seeds, lambda d: d.year)
        for point, year in zip(points, years, strict=False):
            spending, income = expected.get(year, (0.0, 0.0))
            assert point["label"] == str(year)
            assert point["period_start"] == date(year, 1, 1).isoformat()
            assert point["spending"] == pytest.approx(round(spending, 2)), point
            assert point["income"] == pytest.approx(round(income, 2)), point
