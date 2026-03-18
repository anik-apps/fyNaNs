import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.services.auth import AuthError, authenticate_user, register_user


@pytest.mark.asyncio
async def test_register_creates_user(db_session: AsyncSession):
    user = await register_user(db_session, "test@example.com", "SecurePass123!", "Test User")
    assert user.email == "test@example.com"
    assert user.name == "Test User"
    assert user.password_hash is not None
    assert user.password_hash != "SecurePass123!"  # Hashed


@pytest.mark.asyncio
async def test_register_duplicate_raises(db_session: AsyncSession):
    await register_user(db_session, "dupe@example.com", "SecurePass1!", "User")
    with pytest.raises(AuthError, match="already registered"):
        await register_user(db_session, "dupe@example.com", "SecurePass1!", "User")


@pytest.mark.asyncio
async def test_authenticate_success(db_session: AsyncSession):
    await register_user(db_session, "auth@example.com", "SecurePass123!", "User")
    user = await authenticate_user(db_session, "auth@example.com", "SecurePass123!")
    assert user.email == "auth@example.com"


@pytest.mark.asyncio
async def test_authenticate_wrong_password(db_session: AsyncSession):
    await register_user(db_session, "wrong@example.com", "SecurePass123!", "User")
    with pytest.raises(AuthError, match="Invalid email or password"):
        await authenticate_user(db_session, "wrong@example.com", "WrongPassword!")


@pytest.mark.asyncio
async def test_authenticate_oauth_user_no_password(db_session: AsyncSession):
    """OAuth-only user tries password login."""
    from src.models.user import User

    user = User(email="oauth@example.com", name="OAuth User", password_hash=None)
    db_session.add(user)
    await db_session.commit()
    with pytest.raises(AuthError, match="OAuth login"):
        await authenticate_user(db_session, "oauth@example.com", "anything")
