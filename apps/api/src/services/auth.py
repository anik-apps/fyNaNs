from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.security import hash_password, verify_password
from src.models.user import User
from src.models.user_settings import UserSettings


class AuthError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code


async def register_user(db: AsyncSession, email: str, password: str, name: str) -> User:
    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        raise AuthError("Email already registered", 409)

    user = User(
        email=email,
        password_hash=hash_password(password),
        name=name,
    )
    db.add(user)
    await db.flush()  # Populate user.id before creating settings

    # Create default settings
    user_settings = UserSettings(user_id=user.id)
    db.add(user_settings)

    await db.commit()
    await db.refresh(user)
    return user


async def authenticate_user(db: AsyncSession, email: str, password: str) -> User:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        raise AuthError("Invalid email or password", 401)

    if not user.password_hash:
        raise AuthError(
            "This account uses OAuth login. Please sign in with Google or Apple.", 401
        )

    if not verify_password(password, user.password_hash):
        raise AuthError("Invalid email or password", 401)

    return user
