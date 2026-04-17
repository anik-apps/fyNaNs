import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.core.database import get_db
from src.models.savings_goal import SavingsGoal
from src.models.user import User
from src.routers.deps import get_current_user
from src.schemas.savings_goal import (
    ContributionResponse,
    GoalCreate,
    GoalDetailResponse,
    GoalReopen,
    GoalResponse,
    GoalStatus,
    GoalUpdate,
)
from src.services.savings_goal import (
    SavingsGoalError,
    compute_current_amount,
    load_goal,
    to_response,
    validate_linked_account,
)

router = APIRouter(prefix="/goals", tags=["goals"])


async def _load_or_404(
    db: AsyncSession, goal_id: uuid.UUID, user_id: uuid.UUID
) -> SavingsGoal:
    goal = await load_goal(db, goal_id, user_id)
    if goal is None:
        raise HTTPException(status_code=404, detail="Goal not found")
    return goal


@router.get("", response_model=list[GoalResponse])
async def list_goals(
    status: GoalStatus | None = GoalStatus.ACTIVE,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(SavingsGoal)
        .options(selectinload(SavingsGoal.linked_account))
        .where(SavingsGoal.user_id == user.id)
    )
    if status is not None:
        q = q.where(SavingsGoal.status == status.value)
    q = q.order_by(SavingsGoal.created_at.desc())
    goals = (await db.execute(q)).scalars().all()
    return [await to_response(db, g) for g in goals]


@router.post("", response_model=GoalResponse, status_code=201)
async def create_goal(
    req: GoalCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if req.linked_account_id is not None:
        try:
            await validate_linked_account(db, user.id, req.linked_account_id)
        except SavingsGoalError as e:
            raise HTTPException(status_code=e.status_code, detail=e.message) from None

    goal = SavingsGoal(
        user_id=user.id,
        name=req.name,
        target_amount=req.target_amount,
        target_date=req.target_date,
        linked_account_id=req.linked_account_id,
        notes=req.notes,
    )
    db.add(goal)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, "account already has an active goal") from None

    goal = await load_goal(db, goal.id, user.id)
    return await to_response(db, goal)


@router.get("/{goal_id}", response_model=GoalDetailResponse)
async def get_goal_detail(
    goal_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    goal = await _load_or_404(db, goal_id, user.id)
    base = await to_response(db, goal)
    contribs = sorted(
        goal.contributions, key=lambda c: c.contribution_date, reverse=True
    )[:30]
    return GoalDetailResponse(
        **base.model_dump(),
        notes=goal.notes,
        contributions=[ContributionResponse.model_validate(c) for c in contribs],
    )


@router.patch("/{goal_id}", response_model=GoalResponse)
async def patch_goal(
    goal_id: uuid.UUID,
    req: GoalUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    goal = await _load_or_404(db, goal_id, user.id)
    data = req.model_dump(exclude_unset=True)

    if "linked_account_id" in data and data["linked_account_id"] is not None:
        try:
            await validate_linked_account(
                db, user.id, data["linked_account_id"], exclude_goal_id=goal.id
            )
        except SavingsGoalError as e:
            raise HTTPException(status_code=e.status_code, detail=e.message) from None

    for k, v in data.items():
        setattr(goal, k, v)

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, "account already has an active goal") from None

    goal = await load_goal(db, goal.id, user.id)
    return await to_response(db, goal)


@router.delete("/{goal_id}")
async def delete_goal(
    goal_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    goal = await _load_or_404(db, goal_id, user.id)
    await db.delete(goal)
    await db.commit()
    return {"detail": "Goal deleted"}


@router.post("/{goal_id}/archive", response_model=GoalResponse)
async def archive_goal(
    goal_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    goal = await _load_or_404(db, goal_id, user.id)
    goal.status = GoalStatus.ARCHIVED.value
    await db.commit()
    goal = await load_goal(db, goal.id, user.id)
    return await to_response(db, goal)


@router.post("/{goal_id}/reopen", response_model=GoalResponse)
async def reopen_goal(
    goal_id: uuid.UUID,
    req: GoalReopen,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    goal = await _load_or_404(db, goal_id, user.id)
    if goal.status != GoalStatus.COMPLETED.value:
        raise HTTPException(400, "goal must be completed to reopen")

    current = await compute_current_amount(db, goal)
    if req.new_target_amount <= current:
        raise HTTPException(400, "new_target_amount must exceed current amount")

    goal.target_amount = req.new_target_amount
    goal.status = GoalStatus.ACTIVE.value
    goal.completed_at = None
    goal.celebrated_at = None
    await db.commit()
    goal = await load_goal(db, goal.id, user.id)
    return await to_response(db, goal)


@router.post("/{goal_id}/acknowledge", response_model=GoalResponse)
async def acknowledge_goal(
    goal_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    goal = await _load_or_404(db, goal_id, user.id)
    if goal.status == GoalStatus.COMPLETED.value and goal.celebrated_at is None:
        goal.celebrated_at = datetime.now(UTC)
        await db.commit()
        goal = await load_goal(db, goal.id, user.id)
    return await to_response(db, goal)
