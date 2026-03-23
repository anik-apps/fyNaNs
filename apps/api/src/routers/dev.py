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
