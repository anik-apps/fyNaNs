"""End-to-end integration: savings goals HTTP flow."""

from datetime import date, timedelta
from decimal import ROUND_FLOOR, Decimal

import httpx
from dateutil.relativedelta import relativedelta


def _months_between(start: date, end: date) -> int:
    """Mirror of the service's month count used for required_monthly."""
    rd = relativedelta(end, start)
    return max(1, rd.years * 12 + rd.months)


class TestSavingsGoalsFlow:
    def test_full_unlinked_flow(self, client: httpx.Client, auth_headers):
        r = client.post("/goals", headers=auth_headers, json={
            "name": "Trip", "target_amount": "1000.00",
        })
        assert r.status_code == 201, r.text
        gid = r.json()["id"]

        r1 = client.post(f"/goals/{gid}/contributions", headers=auth_headers,
            json={"contribution_date": "2026-01-15", "amount": "400"})
        assert r1.status_code == 201
        r2 = client.post(f"/goals/{gid}/contributions", headers=auth_headers,
            json={"contribution_date": "2026-02-15", "amount": "300"})
        assert r2.status_code == 201

        d = client.get(f"/goals/{gid}", headers=auth_headers)
        assert d.status_code == 200
        assert d.json()["progress_pct"] == 70
        assert len(d.json()["contributions"]) == 2

        arch = client.post(f"/goals/{gid}/archive", headers=auth_headers)
        assert arch.status_code == 200
        assert arch.json()["status"] == "archived"

    def test_dashboard_surfaces_top_goals(self, client, auth_headers):
        client.post("/goals", headers=auth_headers, json={
            "name": "D1", "target_amount": "100",
        })
        dash = client.get("/dashboard", headers=auth_headers)
        assert dash.status_code == 200
        data = dash.json()
        assert "top_goals" in data
        assert "active_goals_count" in data
        assert data["active_goals_count"] >= 1

    def test_list_goals_rolling_window_aggregates(self, client, auth_headers):
        """GET /goals values for a linked and an unlinked goal.

        Seeds contributions/transactions exactly ON the 30-day boundary
        (today - 30, included: date >= cutoff), inside the window, and just
        OUTSIDE it (today - 31, excluded). Targets are chosen relative to the
        month count so required_monthly is exactly 500.00; the expected
        30-day inflow of 400 then projects to 405.87/month -> "on_pace"
        (thresholds: behind < 375, ahead >= 550). Including the outside
        amounts would flip the pace to "ahead"; dropping the boundary date
        would flip it to "behind".
        """
        today = date.today()
        boundary = today - timedelta(days=30)   # exactly on cutoff: included
        outside = today - timedelta(days=31)    # one day past cutoff: excluded
        recent = today - timedelta(days=5)
        target_date = today + relativedelta(months=+6)
        months = _months_between(today, target_date)

        # --- Unlinked goal: current = sum of ALL contributions ------------
        unlinked_current = Decimal("1400.00")  # 300 + 100 (in window) + 1000 (outside)
        unlinked_target = unlinked_current + Decimal("500.00") * months
        r = client.post("/goals", headers=auth_headers, json={
            "name": "Window Unlinked",
            "target_amount": str(unlinked_target),
            "target_date": target_date.isoformat(),
        })
        assert r.status_code == 201, r.text
        unlinked_id = r.json()["id"]

        for contrib_date, amount in [
            (boundary, "300.00"),
            (recent, "100.00"),
            (outside, "1000.00"),
        ]:
            cr = client.post(
                f"/goals/{unlinked_id}/contributions", headers=auth_headers,
                json={"contribution_date": contrib_date.isoformat(), "amount": amount},
            )
            assert cr.status_code == 201, cr.text

        # --- Linked goal: current = account balance ------------------------
        acct = client.post("/accounts", headers=auth_headers, json={
            "name": "Goal Window Savings",
            "type": "savings",
            "balance": "2000.00",
            "institution_name": "Goal Window Bank",
        }).json()
        linked_current = Decimal("2000.00")
        linked_target = linked_current + Decimal("500.00") * months
        r = client.post("/goals", headers=auth_headers, json={
            "name": "Window Linked",
            "target_amount": str(linked_target),
            "target_date": target_date.isoformat(),
            "linked_account_id": acct["id"],
        })
        assert r.status_code == 201, r.text
        linked_id = r.json()["id"]

        # Inflows are negative amounts; the positive one is spending and the
        # outside one predates the rolling window — both must be excluded.
        for txn_date, amount in [
            (boundary, "-300.00"),
            (recent, "-100.00"),
            (outside, "-1000.00"),
            (recent, "50.00"),
        ]:
            tr = client.post("/transactions", headers=auth_headers, json={
                "account_id": acct["id"],
                "amount": amount,
                "date": txn_date.isoformat(),
                "description": f"goal window txn {amount}",
            })
            assert tr.status_code in (200, 201), tr.text

        # --- Assert list endpoint values -----------------------------------
        resp = client.get("/goals", headers=auth_headers)
        assert resp.status_code == 200
        goals = {g["id"]: g for g in resp.json()}

        unlinked = goals[unlinked_id]
        assert Decimal(unlinked["current_amount"]) == unlinked_current
        assert Decimal(unlinked["required_monthly"]) == Decimal("500.00")
        assert unlinked["pace_status"] == "on_pace"
        assert unlinked["linked_account"] is None
        expected_pct = int(
            (unlinked_current / unlinked_target * 100).to_integral_value(
                rounding=ROUND_FLOOR
            )
        )
        assert unlinked["progress_pct"] == expected_pct

        linked = goals[linked_id]
        assert Decimal(linked["current_amount"]) == linked_current
        assert Decimal(linked["required_monthly"]) == Decimal("500.00")
        assert linked["pace_status"] == "on_pace"
        assert linked["linked_account"]["id"] == acct["id"]
        expected_pct = int(
            (linked_current / linked_target * 100).to_integral_value(
                rounding=ROUND_FLOOR
            )
        )
        assert linked["progress_pct"] == expected_pct
