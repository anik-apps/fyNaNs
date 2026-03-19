import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.models.notification import Notification
from src.models.user import User
from src.routers.deps import get_current_user
from src.schemas.notification import NotificationListResponse, NotificationResponse

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=NotificationListResponse)
async def list_notifications(
    cursor: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Get unread count
    unread_result = await db.execute(
        select(func.count())
        .select_from(Notification)
        .where(
            Notification.user_id == user.id,
            Notification.read_at.is_(None),
        )
    )
    unread_count = unread_result.scalar() or 0

    # Query notifications with cursor pagination
    query = select(Notification).where(Notification.user_id == user.id)

    if cursor:
        try:
            cursor_uuid = uuid.UUID(cursor)
            cursor_result = await db.execute(
                select(Notification).where(
                    Notification.id == cursor_uuid,
                    Notification.user_id == user.id,
                )
            )
            cursor_notif = cursor_result.scalar_one_or_none()
            if cursor_notif:
                query = query.where(
                    Notification.created_at < cursor_notif.created_at
                )
        except (ValueError, AttributeError):
            pass

    query = query.order_by(desc(Notification.created_at)).limit(limit + 1)
    result = await db.execute(query)
    notifications = list(result.scalars().all())

    next_cursor = None
    if len(notifications) > limit:
        notifications = notifications[:limit]
        next_cursor = str(notifications[-1].id)

    return NotificationListResponse(
        items=notifications,
        unread_count=unread_count,
        next_cursor=next_cursor,
    )


@router.patch("/{notification_id}", response_model=NotificationResponse)
async def mark_as_read(
    notification_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user.id,
        )
    )
    notif = result.scalar_one_or_none()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")

    notif.read_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(notif)
    return notif


@router.post("/read-all")
async def mark_all_as_read(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        update(Notification)
        .where(
            Notification.user_id == user.id,
            Notification.read_at.is_(None),
        )
        .values(read_at=datetime.now(UTC))
    )
    await db.commit()
    return {"detail": "All notifications marked as read"}
