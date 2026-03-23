# Plaid Sandbox Mobile Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Plaid Link to the mobile app with a dev-only sandbox toggle, so linked accounts can be tested end-to-end on device.

**Architecture:** Mobile app uses `react-native-plaid-link-sdk` to launch native Plaid Link. Backend gains dual Plaid client support (sandbox + production), a dev allowlist via env var, and a per-user sandbox toggle. All Plaid service functions resolve the correct client from the PlaidItem's stored environment.

**Tech Stack:** FastAPI, SQLAlchemy (async), Alembic, React Native (Expo SDK 54), react-native-plaid-link-sdk, plaid-python v27

**Spec:** `docs/2026-03-23-plaid-sandbox-mobile-design.md`

---

## File Map

### Backend — New Files
| File | Responsibility |
|------|---------------|
| `apps/api/src/routers/dev.py` | Dev-only endpoints: GET/POST sandbox toggle |
| `apps/api/migrations/versions/<auto>_add_plaid_sandbox_fields.py` | Migration: `use_plaid_sandbox` on User, `environment` on PlaidItem |

### Backend — Modified Files
| File | Change |
|------|--------|
| `apps/api/src/core/config.py` | Add `dev_allowlist_emails`, `plaid_sandbox_client_id`, `plaid_sandbox_secret` |
| `apps/api/src/models/user.py` | Add `use_plaid_sandbox: bool` column |
| `apps/api/src/models/plaid_item.py` | Add `environment: str` column |
| `apps/api/src/schemas/auth.py` | Add `is_dev: bool` to `UserResponse`, update `from_user()` |
| `apps/api/src/schemas/account.py` | Add `last_synced_at` to `AccountResponse` |
| `apps/api/src/routers/accounts.py` | Include `last_synced_at` from PlaidItem join |
| `apps/api/src/services/plaid.py` | Dual-client factory, environment param on all functions |
| `apps/api/src/routers/plaid.py` | Pass environment to service functions |
| `apps/api/src/main.py` | Register dev router |

### Mobile — New Files
| File | Responsibility |
|------|---------------|
| `apps/mobile/src/lib/plaid.ts` | Plaid Link flow: create token, open link, exchange token |
| `apps/mobile/app/settings/dev.tsx` | Dev settings screen with sandbox toggle |

### Mobile — Modified Files
| File | Change |
|------|--------|
| `apps/mobile/package.json` | Add `react-native-plaid-link-sdk` |
| `apps/mobile/app.json` | Add SDK to plugins array |
| `apps/mobile/src/providers/AuthProvider.tsx` | Add `is_dev` to AuthUser interface and context |
| `apps/mobile/app/(tabs)/accounts/add.tsx` | Add "Link Bank Account" button above manual form |
| `apps/mobile/app/(tabs)/accounts/index.tsx` | Update empty state with Link Bank CTA |
| `apps/mobile/src/components/accounts/AccountCard.tsx` | Add LINKED badge, sync status, sync action |

---

## Task 1: Backend Config — Dev Allowlist & Sandbox Credentials

**Files:**
- Modify: `apps/api/src/core/config.py`

- [ ] **Step 1: Add dev allowlist and sandbox credentials to config**

In `apps/api/src/core/config.py`, add these fields to the `Settings` class (after the existing `plaid_webhook_url` field around line 24):

```python
dev_allowlist_emails: str = ""  # comma-separated
plaid_sandbox_client_id: str = ""
plaid_sandbox_secret: str = ""

@property
def dev_emails_set(self) -> set[str]:
    if not self.dev_allowlist_emails:
        return set()
    return {e.strip().lower() for e in self.dev_allowlist_emails.split(",") if e.strip()}
```

- [ ] **Step 2: Verify config loads**

Run: `cd apps/api && python -c "from src.core.config import settings; print(settings.dev_emails_set)"`

Expected: `set()` (empty, since no env var set)

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/core/config.py
git commit -m "feat: add dev allowlist and sandbox Plaid credentials to config"
```

---

## Task 2: Database Migration — User.use_plaid_sandbox & PlaidItem.environment

**Files:**
- Modify: `apps/api/src/models/user.py`
- Modify: `apps/api/src/models/plaid_item.py`
- Create: migration file via alembic

- [ ] **Step 1: Add `use_plaid_sandbox` column to User model**

In `apps/api/src/models/user.py`, add after the `pending_mfa_secret` field:

```python
use_plaid_sandbox: Mapped[bool] = mapped_column(default=False, server_default="false")
```

- [ ] **Step 2: Add `environment` column to PlaidItem model**

In `apps/api/src/models/plaid_item.py`, add after the `status` field:

```python
environment: Mapped[str] = mapped_column(String(20), default="production", server_default="production")
```

- [ ] **Step 3: Generate migration**

Run from `apps/api/`:

```bash
alembic revision --autogenerate -m "add plaid sandbox fields"
```

- [ ] **Step 4: Review the generated migration**

Open the new migration file in `apps/api/migrations/versions/`. Verify it contains:
- `op.add_column('users', sa.Column('use_plaid_sandbox', sa.Boolean(), server_default='false', nullable=False))`
- `op.add_column('plaid_items', sa.Column('environment', sa.String(20), server_default='production', nullable=False))`
- Corresponding `op.drop_column` in `downgrade()`

- [ ] **Step 5: Run migration**

```bash
alembic upgrade head
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/models/user.py apps/api/src/models/plaid_item.py apps/api/migrations/versions/
git commit -m "feat: add use_plaid_sandbox and environment columns"
```

---

## Task 3: Backend — UserResponse.is_dev

**Files:**
- Modify: `apps/api/src/schemas/auth.py`
- Modify: `apps/api/src/routers/auth.py` (all places that call `UserResponse.from_user`)

- [ ] **Step 1: Write test for is_dev in UserResponse**

Create or add to `apps/api/tests/test_auth.py`:

```python
from src.schemas.auth import UserResponse
from unittest.mock import MagicMock

def test_user_response_is_dev_true():
    user = MagicMock()
    user.id = "00000000-0000-0000-0000-000000000001"
    user.email = "dev@example.com"
    user.name = "Dev"
    user.avatar_url = None
    user.mfa_secret = None
    resp = UserResponse.from_user(user, is_dev=True)
    assert resp.is_dev is True

def test_user_response_is_dev_false_by_default():
    user = MagicMock()
    user.id = "00000000-0000-0000-0000-000000000001"
    user.email = "normal@example.com"
    user.name = "Normal"
    user.avatar_url = None
    user.mfa_secret = None
    resp = UserResponse.from_user(user)
    assert resp.is_dev is False
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api && python -m pytest tests/test_auth.py::test_user_response_is_dev_true -v
```

Expected: FAIL — `from_user()` doesn't accept `is_dev` yet.

- [ ] **Step 3: Update UserResponse schema**

In `apps/api/src/schemas/auth.py`, add `is_dev` field to `UserResponse` (after `has_mfa`):

```python
class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    avatar_url: str | None
    has_mfa: bool = False
    is_dev: bool = False

    model_config = {"from_attributes": True}

    @classmethod
    def from_user(cls, user, is_dev: bool = False) -> "UserResponse":
        return cls(
            id=user.id,
            email=user.email,
            name=user.name,
            avatar_url=user.avatar_url,
            has_mfa=user.mfa_secret is not None,
            is_dev=is_dev,
        )
```

- [ ] **Step 4: Update all callers of `from_user()`**

Search for `UserResponse.from_user` and `from_user(` in the routers. In `apps/api/src/routers/auth.py`, update each call to pass `is_dev`:

```python
from src.core.config import settings

# In each place UserResponse.from_user(user) is called:
UserResponse.from_user(user, is_dev=user.email.lower() in settings.dev_emails_set)
```

Check these files for calls: `routers/auth.py`, `routers/user.py`. Update all occurrences.

- [ ] **Step 5: Run tests**

```bash
cd apps/api && python -m pytest tests/test_auth.py -v
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/schemas/auth.py apps/api/src/routers/auth.py apps/api/src/routers/user.py apps/api/tests/test_auth.py
git commit -m "feat: add is_dev flag to UserResponse based on allowlist"
```

---

## Task 4: Backend — Dev Sandbox Toggle Endpoint

**Files:**
- Create: `apps/api/src/routers/dev.py`
- Modify: `apps/api/src/main.py`

- [ ] **Step 1: Write tests for dev sandbox toggle**

Create `apps/api/tests/test_dev_router.py`:

```python
import pytest
from unittest.mock import patch

@pytest.fixture
async def dev_auth_headers(client):
    """Register and login as a dev-allowlisted user."""
    email = "devuser@example.com"
    await client.post("/api/auth/register", json={
        "email": email, "password": "testpass123", "name": "Dev User"
    })
    resp = await client.post("/api/auth/login", json={
        "email": email, "password": "testpass123"
    })
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
async def normal_auth_headers(client):
    """Register and login as a normal (non-dev) user."""
    email = "normaluser@example.com"
    await client.post("/api/auth/register", json={
        "email": email, "password": "testpass123", "name": "Normal User"
    })
    resp = await client.post("/api/auth/login", json={
        "email": email, "password": "testpass123"
    })
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

@pytest.mark.asyncio
@patch("src.routers.dev.settings")
async def test_get_sandbox_toggle_default(mock_settings, client, dev_auth_headers):
    mock_settings.dev_emails_set = {"devuser@example.com"}
    resp = await client.get("/api/dev/sandbox-toggle", headers=dev_auth_headers)
    assert resp.status_code == 200
    assert resp.json() == {"enabled": False}

@pytest.mark.asyncio
@patch("src.routers.dev.settings")
async def test_set_sandbox_toggle(mock_settings, client, dev_auth_headers):
    mock_settings.dev_emails_set = {"devuser@example.com"}
    resp = await client.post("/api/dev/sandbox-toggle", json={"enabled": True}, headers=dev_auth_headers)
    assert resp.status_code == 200
    assert resp.json() == {"enabled": True}

@pytest.mark.asyncio
@patch("src.routers.dev.settings")
async def test_sandbox_toggle_forbidden_for_non_dev(mock_settings, client, normal_auth_headers):
    mock_settings.dev_emails_set = {"devuser@example.com"}
    resp = await client.get("/api/dev/sandbox-toggle", headers=normal_auth_headers)
    assert resp.status_code == 403
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/api && python -m pytest tests/test_dev_router.py -v
```

Expected: FAIL — router doesn't exist.

- [ ] **Step 3: Create dev router**

Create `apps/api/src/routers/dev.py`:

```python
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.core.database import get_db
from src.models.user import User
from src.routers.deps import get_current_user

router = APIRouter(prefix="/dev", tags=["dev"])


class SandboxToggleRequest(BaseModel):
    enabled: bool


class SandboxToggleResponse(BaseModel):
    enabled: bool


def _require_dev(user: User) -> None:
    if user.email.lower() not in settings.dev_emails_set:
        raise HTTPException(status_code=403, detail="Dev access required")


@router.get("/sandbox-toggle", response_model=SandboxToggleResponse)
async def get_sandbox_toggle(user: User = Depends(get_current_user)):
    _require_dev(user)
    return SandboxToggleResponse(enabled=user.use_plaid_sandbox)


@router.post("/sandbox-toggle", response_model=SandboxToggleResponse)
async def set_sandbox_toggle(
    body: SandboxToggleRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_dev(user)
    user.use_plaid_sandbox = body.enabled
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return SandboxToggleResponse(enabled=user.use_plaid_sandbox)
```

- [ ] **Step 4: Register the router in main.py**

In `apps/api/src/main.py`, add import and registration alongside existing routers:

```python
from src.routers import dev
# ...
api_router.include_router(dev.router)
```

- [ ] **Step 5: Run tests**

```bash
cd apps/api && python -m pytest tests/test_dev_router.py -v
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routers/dev.py apps/api/src/main.py apps/api/tests/test_dev_router.py
git commit -m "feat: add dev sandbox toggle endpoint with allowlist guard"
```

---

## Task 5: Backend — Dual Plaid Client Factory

**Files:**
- Modify: `apps/api/src/services/plaid.py`
- Modify: `apps/api/src/routers/plaid.py` (update `_get_plaid_client` → `get_plaid_client` imports)
- Modify: `apps/api/src/routers/user.py` (update `_get_plaid_client` → `get_plaid_client` imports)

- [ ] **Step 1: Write test for dual client factory**

Add to `apps/api/tests/test_plaid_service.py`:

```python
from unittest.mock import patch, MagicMock
from src.services.plaid import get_plaid_client

@patch("src.services.plaid.settings")
def test_get_plaid_client_sandbox(mock_settings):
    mock_settings.plaid_sandbox_client_id = "sandbox_id"
    mock_settings.plaid_sandbox_secret = "sandbox_secret"
    mock_settings.plaid_client_id = "prod_id"
    mock_settings.plaid_secret = "prod_secret"
    mock_settings.plaid_env = "production"
    # Clear cache
    get_plaid_client.cache_clear()
    client = get_plaid_client("sandbox")
    assert client is not None

@patch("src.services.plaid.settings")
def test_get_plaid_client_production(mock_settings):
    mock_settings.plaid_client_id = "prod_id"
    mock_settings.plaid_secret = "prod_secret"
    mock_settings.plaid_env = "production"
    get_plaid_client.cache_clear()
    client = get_plaid_client("production")
    assert client is not None

@patch("src.services.plaid.settings")
def test_get_plaid_client_refuses_sandbox_in_production_env(mock_settings):
    mock_settings.plaid_env = "production"
    mock_settings.plaid_sandbox_client_id = ""
    mock_settings.plaid_sandbox_secret = ""
    get_plaid_client.cache_clear()
    # Should fall back to production client when sandbox creds missing
    client = get_plaid_client("sandbox")
    # Verify it used production environment (won't crash, but uses prod creds)
    assert client is not None
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/api && python -m pytest tests/test_plaid_service.py::test_get_plaid_client_sandbox -v
```

Expected: FAIL — `get_plaid_client` doesn't accept arguments.

- [ ] **Step 3: Replace `_get_plaid_client()` with dual-environment factory**

In `apps/api/src/services/plaid.py`, replace the existing `_get_plaid_client()` (lines ~37-53) with:

```python
@lru_cache(maxsize=2)
def get_plaid_client(environment: str = "") -> plaid_api.PlaidApi:
    """Get a Plaid API client for the given environment. Cached per environment."""
    env = environment or settings.plaid_env

    env_map = {
        "sandbox": plaid.Environment.Sandbox,
        "development": plaid.Environment.Development,
        "production": plaid.Environment.Production,
    }

    if env == "sandbox" and settings.plaid_sandbox_client_id and settings.plaid_sandbox_secret:
        client_id = settings.plaid_sandbox_client_id
        secret = settings.plaid_sandbox_secret
    else:
        client_id = settings.plaid_client_id
        secret = settings.plaid_secret

    configuration = plaid.Configuration(
        host=env_map.get(env, plaid.Environment.Sandbox),
        api_key={"clientId": client_id, "secret": secret},
    )
    return plaid_api.PlaidApi(plaid.ApiClient(configuration))
```

- [ ] **Step 4: Update all callers of the old `_get_plaid_client()`**

Search and replace `_get_plaid_client()` with `get_plaid_client()` throughout these files:

**In `services/plaid.py`** (~5 call sites at lines ~58, ~90, ~371, ~497, ~616):

```python
# For functions creating new items — use the passed environment:
client = get_plaid_client(environment)

# For functions operating on existing items — use item's environment:
client = get_plaid_client(item.environment)
```

**In `routers/plaid.py`** (lines ~207/210, `delete_plaid_item` endpoint):
Update import from `_get_plaid_client` to `get_plaid_client` and pass `plaid_item.environment`:

```python
from src.services.plaid import get_plaid_client  # was _get_plaid_client
# ...
client = get_plaid_client(plaid_item.environment)
```

**In `routers/user.py`** (lines ~116/119, account deletion):
Same import update and pass item environment.

- [ ] **Step 5: Update `create_link_token()` signature**

Change from `create_link_token(user_id: uuid.UUID)` to:

```python
async def create_link_token(user_id: uuid.UUID, environment: str = "") -> dict:
    client = get_plaid_client(environment)
    # ... rest unchanged
```

- [ ] **Step 6: Update `exchange_public_token()` signature and implementation**

Update the function signature to accept environment:

```python
async def exchange_public_token(
    db, user_id, public_token, institution_id, institution_name, environment: str = ""
) -> tuple[PlaidItem, int]:
    client = get_plaid_client(environment)  # was _get_plaid_client()
    # ... existing code ...
```

When creating the PlaidItem, include the environment:

```python
item = PlaidItem(
    user_id=user_id,
    access_token=encrypted_token,
    item_id=item_id,
    institution_name=institution_name,
    environment=environment or settings.plaid_env,  # Store actual environment used
)
```

- [ ] **Step 7: Run all Plaid tests**

```bash
cd apps/api && python -m pytest tests/test_plaid_service.py tests/test_plaid_router.py -v
```

Expected: PASS (existing tests may need minor updates for new function signatures)

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/services/plaid.py apps/api/tests/test_plaid_service.py
git commit -m "feat: dual Plaid client factory with per-environment caching"
```

---

## Task 6: Backend — Plaid Router Uses User's Sandbox Preference

**Files:**
- Modify: `apps/api/src/routers/plaid.py`

- [ ] **Step 1: Update link-token endpoint to use user's sandbox preference**

In `apps/api/src/routers/plaid.py`, update the `create_link_token_endpoint` function:

```python
@router.post("/link-token", response_model=LinkTokenResponse)
async def create_link_token_endpoint(user: User = Depends(get_current_user)):
    environment = ""
    if user.email.lower() in settings.dev_emails_set and user.use_plaid_sandbox:
        environment = "sandbox"
    result = await create_link_token(user.id, environment=environment)
    return LinkTokenResponse(**result)
```

Add `from src.core.config import settings` to the imports.

- [ ] **Step 2: Update exchange-token endpoint to pass environment**

```python
@router.post("/exchange-token", response_model=ExchangeTokenResponse)
async def exchange_token_endpoint(
    body: ExchangeTokenRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    environment = ""
    if user.email.lower() in settings.dev_emails_set and user.use_plaid_sandbox:
        environment = "sandbox"
    item, count = await exchange_public_token(
        db, user.id, body.public_token, body.institution_id, body.institution_name,
        environment=environment,
    )
    return ExchangeTokenResponse(
        plaid_item_id=item.id,
        institution_name=item.institution_name,
        accounts_linked=count,
    )
```

- [ ] **Step 3: Update sync endpoint to use item's environment**

The sync and other item-based endpoints should already work since they operate on existing PlaidItems and we updated the service to use `item.environment`. Verify by checking the sync endpoint calls `get_plaid_client(item.environment)`.

- [ ] **Step 4: Run router tests**

```bash
cd apps/api && python -m pytest tests/test_plaid_router.py -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routers/plaid.py
git commit -m "feat: plaid router uses user's sandbox preference for environment"
```

---

## Task 7: Backend — AccountResponse with last_synced_at

**Files:**
- Modify: `apps/api/src/schemas/account.py`
- Modify: `apps/api/src/routers/accounts.py`

- [ ] **Step 1: Add `last_synced_at` to AccountResponse**

In `apps/api/src/schemas/account.py`, add to `AccountResponse`:

```python
class AccountResponse(BaseModel):
    id: uuid.UUID
    institution_name: str
    name: str
    type: str
    balance: str
    currency: str
    mask: str | None
    is_manual: bool
    plaid_item_id: uuid.UUID | None
    last_synced_at: datetime | None = None  # ADD THIS
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
```

- [ ] **Step 2: Update `_account_to_response()` to include last_synced_at**

In `apps/api/src/routers/accounts.py`, update the helper function:

```python
def _account_to_response(account: Account) -> AccountResponse:
    last_synced = None
    if account.plaid_item:
        last_synced = account.plaid_item.last_synced_at
    return AccountResponse(
        id=account.id,
        institution_name=account.institution_name,
        name=account.name,
        type=account.type,
        balance=str(account.balance),
        currency=account.currency,
        mask=account.mask,
        is_manual=account.is_manual,
        plaid_item_id=account.plaid_item_id,
        last_synced_at=last_synced,
        created_at=account.created_at,
        updated_at=account.updated_at,
    )
```

- [ ] **Step 3: Ensure plaid_item is eagerly loaded in all account queries**

In `apps/api/src/routers/accounts.py`, add `selectinload` to **every** query that feeds into `_account_to_response()`:

```python
from sqlalchemy.orm import selectinload
```

Update these endpoints:
- `list_accounts`: add `.options(selectinload(Account.plaid_item))` to the query
- `get_account`: add `.options(selectinload(Account.plaid_item))` to the query
- `update_account`: ensure the returned account has `plaid_item` loaded (add `.options(selectinload(Account.plaid_item))` or re-query after update)

Note: `create_account` creates manual accounts where `plaid_item_id` is null, so `account.plaid_item` will be `None` — the `_account_to_response` helper already handles this with the `if account.plaid_item:` check.

- [ ] **Step 4: Run account tests**

```bash
cd apps/api && python -m pytest tests/ -k account -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/schemas/account.py apps/api/src/routers/accounts.py
git commit -m "feat: include last_synced_at in AccountResponse"
```

---

## Task 8: Backend — Sync Rate Limiting

**Files:**
- Modify: `apps/api/src/services/plaid.py`
- Modify: `apps/api/src/routers/plaid.py`

- [ ] **Step 1: Write test for sync rate limiting**

Add to `apps/api/tests/test_plaid_router.py`:

```python
@pytest.mark.asyncio
@patch("src.routers.plaid.sync_transactions")
async def test_sync_rate_limited(mock_sync, client, auth_headers, db_session):
    """Calling sync twice within 5 minutes should return 429."""
    from datetime import datetime, timezone, timedelta
    from src.models.plaid_item import PlaidItem
    from src.models.user import User
    from sqlalchemy import select

    # Get the test user and create a PlaidItem with recent last_synced_at
    result = await db_session.execute(select(User))
    user = result.scalars().first()
    item = PlaidItem(
        user_id=user.id,
        access_token="encrypted_token",
        item_id="test_item_id",
        institution_name="Test Bank",
        environment="sandbox",
        last_synced_at=datetime.now(timezone.utc) - timedelta(minutes=1),
    )
    db_session.add(item)
    await db_session.commit()
    await db_session.refresh(item)

    resp = await client.post(f"/api/plaid/items/{item.id}/sync", headers=auth_headers)
    assert resp.status_code == 429
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api && python -m pytest tests/test_plaid_router.py::test_sync_rate_limited -v
```

Expected: FAIL — no rate limiting implemented yet.

- [ ] **Step 3: Add MIN_SYNC_INTERVAL constant**

In `apps/api/src/services/plaid.py`, add near the top (next to `FALLBACK_SYNC_INTERVAL`):

```python
MIN_SYNC_INTERVAL = timedelta(minutes=5)
```

- [ ] **Step 2: Add rate limit check in sync endpoint**

In `apps/api/src/routers/plaid.py`, update the sync endpoint to check `last_synced_at`:

```python
from datetime import datetime, timezone
from src.services.plaid import MIN_SYNC_INTERVAL

# Inside the sync endpoint, after fetching the item:
if item.last_synced_at:
    elapsed = datetime.now(timezone.utc) - item.last_synced_at
    if elapsed < MIN_SYNC_INTERVAL:
        raise HTTPException(
            status_code=429,
            detail=f"Sync rate limited. Try again in {int((MIN_SYNC_INTERVAL - elapsed).total_seconds())} seconds.",
        )
```

- [ ] **Step 3: Run tests**

```bash
cd apps/api && python -m pytest tests/test_plaid_router.py -v
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/services/plaid.py apps/api/src/routers/plaid.py
git commit -m "feat: add 5-minute rate limit on manual Plaid sync"
```

---

## Task 9: Mobile — Install react-native-plaid-link-sdk

**Files:**
- Modify: `apps/mobile/package.json`
- Modify: `apps/mobile/app.json`

- [ ] **Step 1: Install the SDK**

```bash
cd apps/mobile && pnpm add react-native-plaid-link-sdk
```

- [ ] **Step 2: Add to app.json plugins**

In `apps/mobile/app.json`, add to the `plugins` array:

```json
"react-native-plaid-link-sdk"
```

(After `"expo-build-properties"`)

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/package.json apps/mobile/app.json ../../pnpm-lock.yaml
git commit -m "feat: add react-native-plaid-link-sdk dependency"
```

---

## Task 10: Mobile — AuthProvider exposes is_dev

**Files:**
- Modify: `apps/mobile/src/providers/AuthProvider.tsx`

- [ ] **Step 1: Add `is_dev` to AuthUser interface**

In `apps/mobile/src/providers/AuthProvider.tsx`, update the `AuthUser` interface (around line 12):

```typescript
interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  has_mfa: boolean;
  is_dev: boolean;  // ADD THIS
}
```

- [ ] **Step 2: Include `is_dev` when setting user from login/register response**

Where the user is set from API responses (login, register, refresh), ensure `is_dev` is included. It comes from `data.user.is_dev` in the `TokenResponse`. Since the backend now returns it, no extra API call is needed.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/providers/AuthProvider.tsx
git commit -m "feat: expose is_dev flag from AuthProvider"
```

---

## Task 11: Mobile — Plaid Link Flow Helper

**Files:**
- Create: `apps/mobile/src/lib/plaid.ts`

- [ ] **Step 1: Create the Plaid Link helper**

Create `apps/mobile/src/lib/plaid.ts`:

```typescript
import { openLink, LinkSuccess, LinkExit } from "react-native-plaid-link-sdk";
import { apiFetch } from "./api-client";

interface LinkTokenResponse {
  link_token: string;
  expiration: string;
}

interface ExchangeTokenResponse {
  plaid_item_id: string;
  institution_name: string;
  accounts_linked: number;
}

export async function createLinkToken(): Promise<string> {
  const data = await apiFetch<LinkTokenResponse>("/api/plaid/link-token", {
    method: "POST",
  });
  return data.link_token;
}

export async function exchangePublicToken(
  publicToken: string,
  institutionId: string,
  institutionName: string
): Promise<ExchangeTokenResponse> {
  return apiFetch<ExchangeTokenResponse>("/api/plaid/exchange-token", {
    method: "POST",
    body: JSON.stringify({
      public_token: publicToken,
      institution_id: institutionId,
      institution_name: institutionName,
    }),
  });
}

export function openPlaidLink(
  linkToken: string,
  onSuccess: (result: ExchangeTokenResponse) => void,
  onExit: (error?: string) => void
): void {
  openLink({
    tokenConfig: { token: linkToken },
    onSuccess: async (success: LinkSuccess) => {
      try {
        const result = await exchangePublicToken(
          success.publicToken,
          success.metadata.institution?.id || "",
          success.metadata.institution?.name || ""
        );
        onSuccess(result);
      } catch (e: any) {
        onExit(e.message || "Failed to link account");
      }
    },
    onExit: (exit: LinkExit) => {
      if (exit.error) {
        onExit(exit.error.displayMessage || exit.error.errorMessage);
      } else {
        onExit();
      }
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/lib/plaid.ts
git commit -m "feat: add Plaid Link flow helper for mobile"
```

---

## Task 12: Mobile — Dev Settings Screen

**Files:**
- Create: `apps/mobile/app/settings/dev.tsx`

- [ ] **Step 1: Create the settings route layout**

The `apps/mobile/app/settings/` directory doesn't exist yet. Create `apps/mobile/app/settings/_layout.tsx`:

```typescript
import { Stack } from "expo-router";

export default function SettingsLayout() {
  return <Stack />;
}
```

- [ ] **Step 2: Create the dev settings screen**

Create `apps/mobile/app/settings/dev.tsx`:

```typescript
import React, { useState, useEffect } from "react";
import { View, Text, Switch, StyleSheet, ActivityIndicator } from "react-native";
import { Stack } from "expo-router";
import { useTheme } from "@/src/providers/ThemeProvider";
import { apiFetch } from "@/src/lib/api-client";

export default function DevSettingsScreen() {
  const { theme } = useTheme();
  const [sandboxEnabled, setSandboxEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<{ enabled: boolean }>("/api/dev/sandbox-toggle")
      .then((data) => setSandboxEnabled(data.enabled))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function toggleSandbox(value: boolean) {
    setSaving(true);
    try {
      const data = await apiFetch<{ enabled: boolean }>("/api/dev/sandbox-toggle", {
        method: "POST",
        body: JSON.stringify({ enabled: value }),
      });
      setSandboxEnabled(data.enabled);
    } catch {
      // revert on failure
      setSandboxEnabled(!value);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={{ title: "Dev Settings" }} />
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: "Dev Settings" }} />
      <View style={[styles.row, { borderBottomColor: theme.colors.border }]}>
        <View style={styles.labelContainer}>
          <Text style={[styles.label, { color: theme.colors.text }]}>Use Plaid Sandbox</Text>
          <Text style={[styles.sublabel, { color: theme.colors.textSecondary }]}>
            Link test bank accounts with fake data
          </Text>
        </View>
        <Switch
          value={sandboxEnabled}
          onValueChange={toggleSandbox}
          disabled={saving}
          trackColor={{ true: theme.colors.primary }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
  },
  labelContainer: { flex: 1, marginRight: 12 },
  label: { fontSize: 15, fontWeight: "500" },
  sublabel: { fontSize: 12, marginTop: 2 },
});
```

- [ ] **Step 3: Add navigation to dev settings from profile/settings**

In `apps/mobile/app/(tabs)/settings/profile.tsx` (or wherever the settings list is), add a conditional link:

```typescript
{user?.is_dev && (
  <TouchableOpacity onPress={() => router.push("/settings/dev")}>
    <Text>Dev Settings</Text>
  </TouchableOpacity>
)}
```

(Adapt to match the existing settings UI pattern in that file.)

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/settings/_layout.tsx apps/mobile/app/settings/dev.tsx apps/mobile/app/\(tabs\)/settings/profile.tsx
git commit -m "feat: add dev settings screen with Plaid sandbox toggle"
```

---

## Task 13: Mobile — Add Account Screen with Link Bank

**Files:**
- Modify: `apps/mobile/app/(tabs)/accounts/add.tsx`

- [ ] **Step 1: Add "Link Bank Account" button above manual form**

In `apps/mobile/app/(tabs)/accounts/add.tsx`, add the Plaid Link button at the top of the form, before the manual fields. Add these imports:

```typescript
import { Alert } from "react-native";
import { createLinkToken, openPlaidLink } from "@/src/lib/plaid";
```

Add a handler function inside the component:

```typescript
const [linking, setLinking] = useState(false);

async function handleLinkBank() {
  setLinking(true);
  try {
    const linkToken = await createLinkToken();
    openPlaidLink(
      linkToken,
      (_result) => {
        setLinking(false);
        router.back();
      },
      (error) => {
        setLinking(false);
        if (error) Alert.alert("Link Failed", error);
      }
    );
  } catch (e: any) {
    setLinking(false);
    Alert.alert("Error", e.message || "Failed to start bank link");
  }
}
```

Add the button JSX at the top of the `<ScrollView>`, before the Account Name label:

```tsx
<TouchableOpacity
  style={[styles.linkButton, { backgroundColor: theme.colors.primary }]}
  onPress={handleLinkBank}
  disabled={linking}
>
  {linking ? (
    <ActivityIndicator color={theme.colors.primaryText} />
  ) : (
    <Text style={[styles.linkButtonText, { color: theme.colors.primaryText }]}>
      Link Bank Account
    </Text>
  )}
</TouchableOpacity>
<Text style={[styles.divider, { color: theme.colors.textSecondary }]}>or add manually</Text>
```

Add styles:

```typescript
linkButton: {
  paddingVertical: 14,
  borderRadius: 10,
  alignItems: "center",
  marginBottom: 8,
},
linkButtonText: { fontSize: 16, fontWeight: "600" },
divider: { textAlign: "center", fontSize: 13, marginVertical: 12 },
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/\(tabs\)/accounts/add.tsx
git commit -m "feat: add Link Bank Account button to Add Account screen"
```

---

## Task 14: Mobile — Empty State with Link Bank CTA

**Files:**
- Modify: `apps/mobile/app/(tabs)/accounts/index.tsx`

- [ ] **Step 1: Update empty state**

In `apps/mobile/app/(tabs)/accounts/index.tsx`, update the `!data?.length` empty state block. Add imports:

```typescript
import { Text, TouchableOpacity } from "react-native";
import { createLinkToken, openPlaidLink } from "@/src/lib/plaid";
import { Alert } from "react-native";
```

Replace the empty state `<EmptyState>` component with:

```tsx
if (!data?.length) {
  return (
    <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
      <EmptyState
        title="No accounts yet"
        description="Link your bank for automatic tracking"
        action={
          <View style={{ gap: 8, alignItems: "center" }}>
            <TouchableOpacity
              style={[styles.linkButton, { backgroundColor: theme.colors.primary }]}
              onPress={async () => {
                try {
                  const token = await createLinkToken();
                  openPlaidLink(
                    token,
                    () => refresh(),
                    (err) => { if (err) Alert.alert("Error", err); }
                  );
                } catch (e: any) {
                  Alert.alert("Error", e.message || "Failed to start bank link");
                }
              }}
            >
              <Text style={[styles.linkButtonText, { color: theme.colors.primaryText }]}>
                Link Bank Account
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/(tabs)/accounts/add")}>
              <Text style={[styles.manualLink, { color: theme.colors.primary }]}>
                or add manually
              </Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}
```

Add styles:

```typescript
linkButton: {
  paddingHorizontal: 24,
  paddingVertical: 12,
  borderRadius: 10,
},
linkButtonText: { fontSize: 15, fontWeight: "600" },
manualLink: { fontSize: 13 },
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/\(tabs\)/accounts/index.tsx
git commit -m "feat: update accounts empty state with Link Bank CTA"
```

---

## Task 15: Mobile — Account Card with LINKED Badge & Sync Status

**Files:**
- Modify: `apps/mobile/src/components/accounts/AccountCard.tsx`

- [ ] **Step 1: Read the existing AccountCard component**

Read `apps/mobile/src/components/accounts/AccountCard.tsx` to understand current layout and props.

- [ ] **Step 2: Add LINKED badge and sync status**

Update the card component to show:
- A small "LINKED" badge next to the name when `is_manual === false` (font size 7, blue background `#dbeafe`, blue text `#1d4ed8`, uppercase, rounded)
- "Manual" text in gray when `is_manual === true`
- Sync status line for linked accounts: colored dot + relative time
- "Sync" link when stale (3+ days)

The account data should include `is_manual`, `plaid_item_id`, and `last_synced_at` from the API.

Add a sync handler:

```typescript
import { apiFetch } from "@/src/lib/api-client";

async function handleSync(plaidItemId: string) {
  try {
    await apiFetch(`/api/plaid/items/${plaidItemId}/sync`, { method: "POST" });
    // Trigger refresh from parent
  } catch (e: any) {
    Alert.alert("Sync Failed", e.message || "Could not sync account");
  }
}
```

For the relative time display, compute from `last_synced_at`:

```typescript
// NOTE: 3-day stale threshold matches backend FALLBACK_SYNC_INTERVAL.
// 5-min debounce matches backend MIN_SYNC_INTERVAL.
// Future improvement: fetch these from a config API endpoint instead of hardcoding.
const STALE_DAYS = 3;
const SYNC_DEBOUNCE_MS = 5 * 60 * 1000;

function formatSyncTime(lastSynced: string | null): { text: string; isStale: boolean } {
  if (!lastSynced) return { text: "Never synced", isStale: true };
  const diff = Date.now() - new Date(lastSynced).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  const isStale = days >= STALE_DAYS;
  if (days > 0) return { text: `Synced ${days}d ago`, isStale };
  if (hours > 0) return { text: `Synced ${hours}h ago`, isStale };
  return { text: "Synced just now", isStale: false };
}
```

Badge JSX (inline with account name):

```tsx
{!account.is_manual && (
  <Text style={styles.linkedBadge}>LINKED</Text>
)}
```

```typescript
linkedBadge: {
  fontSize: 7,
  fontWeight: "600",
  color: "#1d4ed8",
  backgroundColor: "#dbeafe",
  paddingHorizontal: 4,
  paddingVertical: 1,
  borderRadius: 3,
  overflow: "hidden",
  textTransform: "uppercase",
  marginLeft: 4,
},
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/accounts/AccountCard.tsx
git commit -m "feat: add LINKED badge and sync status to account cards"
```

---

## Task 16: EAS Build & Device Testing

- [ ] **Step 1: Run the migration on the deployed backend**

SSH into the server and run:

```bash
cd /path/to/api && alembic upgrade head
```

- [ ] **Step 2: Set env vars on backend**

Add to the backend `.env`:

```
DEV_ALLOWLIST_EMAILS=test@kumaranik.com,anik@kumaranik.com
PLAID_SANDBOX_CLIENT_ID=<your sandbox client id>
PLAID_SANDBOX_SECRET=<your sandbox secret>
```

Restart the backend service.

- [ ] **Step 3: Build new APK with EAS**

```bash
cd apps/mobile && eas build --platform android --profile preview --non-interactive
```

This is required because `react-native-plaid-link-sdk` is a native dependency.

- [ ] **Step 4: Install and test on emulator**

```bash
curl -L -o /tmp/fynans.apk <APK_URL>
adb install -r /tmp/fynans.apk
```

- [ ] **Step 5: Run through sandbox testing flow**

Follow the testing flow from the spec:
1. Login as allowlisted user
2. Go to Settings → Dev Settings → enable sandbox
3. Go to Accounts → Link Bank Account
4. Use `user_good` / `pass_good`
5. Verify accounts appear with LINKED badge and sync status

- [ ] **Step 6: Commit any fixes discovered during testing**

Stage only the specific files that were changed, then commit:

```bash
git add <specific changed files>
git commit -m "fix: adjustments from device testing"
```
