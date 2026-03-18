import io

import pytest
from httpx import AsyncClient


@pytest.fixture
async def auth_and_account(client: AsyncClient) -> tuple[dict, str]:
    await client.post("/api/auth/register", json={
        "email": "import@example.com",
        "password": "SecurePass123!",
        "name": "Import User",
    })
    login = await client.post("/api/auth/login", json={
        "email": "import@example.com",
        "password": "SecurePass123!",
    })
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    acct = await client.post("/api/accounts", headers=headers, json={
        "institution_name": "Import Bank",
        "name": "Checking",
        "type": "checking",
        "balance": "1000.00",
    })
    return headers, acct.json()["id"]


@pytest.mark.asyncio
async def test_import_csv(client: AsyncClient, auth_and_account):
    headers, account_id = auth_and_account

    csv_content = (
        "Date,Description,Amount\n"
        "2026-03-01,Grocery Store,45.67\n"
        "2026-03-02,Gas Station,30.00\n"
        "2026-03-03,Coffee Shop,5.50\n"
    )

    response = await client.post(
        f"/api/transactions/import?account_id={account_id}",
        headers=headers,
        files={"file": ("transactions.csv", io.BytesIO(csv_content.encode()), "text/csv")},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["imported"] == 3
    assert data["skipped_duplicates"] == 0
    assert data["errors"] == []


@pytest.mark.asyncio
async def test_import_csv_with_duplicates(client: AsyncClient, auth_and_account):
    headers, account_id = auth_and_account

    csv_content = (
        "Date,Description,Amount\n"
        "2026-03-10,Unique Purchase,100.00\n"
    )

    # First import
    await client.post(
        f"/api/transactions/import?account_id={account_id}",
        headers=headers,
        files={"file": ("transactions.csv", io.BytesIO(csv_content.encode()), "text/csv")},
    )

    # Second import (same data)
    response = await client.post(
        f"/api/transactions/import?account_id={account_id}",
        headers=headers,
        files={"file": ("transactions.csv", io.BytesIO(csv_content.encode()), "text/csv")},
    )
    data = response.json()
    assert data["imported"] == 0
    assert data["skipped_duplicates"] == 1


@pytest.mark.asyncio
async def test_import_csv_with_errors(client: AsyncClient, auth_and_account):
    headers, account_id = auth_and_account

    csv_content = (
        "Date,Description,Amount\n"
        "2026-03-01,Valid Purchase,25.00\n"
        "invalid-date,Bad Row,abc\n"
    )

    response = await client.post(
        f"/api/transactions/import?account_id={account_id}",
        headers=headers,
        files={"file": ("transactions.csv", io.BytesIO(csv_content.encode()), "text/csv")},
    )
    data = response.json()
    assert data["imported"] == 1
    assert len(data["errors"]) == 1
    assert data["errors"][0]["row"] == 2


@pytest.mark.asyncio
async def test_import_file_too_large(client: AsyncClient, auth_and_account):
    headers, account_id = auth_and_account

    # Create a file larger than 5MB
    large_content = "Date,Description,Amount\n" + "2026-03-01,Item,10.00\n" * 300000

    response = await client.post(
        f"/api/transactions/import?account_id={account_id}",
        headers=headers,
        files={"file": ("large.csv", io.BytesIO(large_content.encode()), "text/csv")},
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_import_ofx(client: AsyncClient, auth_and_account):
    """OFX import should parse and create transactions."""
    headers, account_id = auth_and_account

    # Minimal valid OFX content
    ofx_content = """OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<DTSERVER>20260315
<LANGUAGE>ENG
</SONRS>
</SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
<TRNUID>0
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<STMTRS>
<CURDEF>USD
<BANKACCTFROM>
<BANKID>123456789
<ACCTID>1234567890
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20260301
<DTEND>20260315
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260305
<TRNAMT>-42.50
<FITID>202603050001
<MEMO>OFX Grocery Store
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>"""

    response = await client.post(
        f"/api/transactions/import?account_id={account_id}",
        headers=headers,
        files={"file": ("transactions.ofx", io.BytesIO(ofx_content.encode()), "application/x-ofx")},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["imported"] >= 1
    assert data["errors"] == []
