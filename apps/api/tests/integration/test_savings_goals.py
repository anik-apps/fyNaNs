"""End-to-end integration: savings goals HTTP flow."""

import httpx


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
