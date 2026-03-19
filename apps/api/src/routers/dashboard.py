from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.user import User
from src.routers.deps import get_current_user, get_db
from src.schemas.dashboard import DashboardResponse
from src.services.dashboard import get_dashboard

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardResponse)
async def dashboard(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Aggregated dashboard view: net worth, balances, transactions, budgets, bills, spending."""
    return await get_dashboard(db, str(current_user.id))
