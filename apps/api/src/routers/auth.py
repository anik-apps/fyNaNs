import hashlib
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.core.database import get_db
from src.core.rate_limit import rate_limit_login, rate_limit_mfa_verify, rate_limit_password_reset
from src.core.security import create_mfa_pending_token
from src.models.refresh_token import RefreshToken
from src.models.user import User
from src.models.user_settings import UserSettings
from src.routers.deps import get_current_user
from src.schemas.auth import (
    LoginRequest,
    MFAConfirmRequest,
    MFAVerifyRequest,
    OAuthRequest,
    PasswordResetConfirm,
    PasswordResetRequest,
    PasswordSetRequest,
    RefreshRequest,
    RegisterRequest,
    SessionResponse,
    TokenResponse,
    UserResponse,
)
from src.services.auth import AuthError, authenticate_user, register_user
from src.services.token import create_token_pair, revoke_refresh_token, rotate_refresh_token

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_refresh_cookie(response: Response, token: str) -> None:
    """Set refresh token cookie with environment-appropriate settings."""
    response.set_cookie(
        key="refresh_token",
        value=token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        max_age=30 * 24 * 60 * 60,  # 30 days
        path="/",
    )


@router.post("/register", response_model=UserResponse, status_code=201)
async def register(request: RegisterRequest, db: AsyncSession = Depends(get_db)):
    try:
        user = await register_user(db, request.email, request.password, request.name)
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message) from None
    return UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        has_mfa=user.mfa_secret is not None,
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    request: LoginRequest,
    http_request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit_login),
):
    try:
        user = await authenticate_user(db, request.email, request.password)
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message) from None

    # If MFA is enabled, return a short-lived MFA token instead of full tokens
    if user.mfa_secret:
        mfa_token = create_mfa_pending_token(user.id)
        return TokenResponse(access_token=mfa_token, mfa_required=True)

    device_info = http_request.headers.get("user-agent", "unknown")
    access_token, refresh_token = await create_token_pair(db, user.id, device_info)

    _set_refresh_cookie(response, refresh_token)

    return TokenResponse(access_token=access_token)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    http_request: Request,
    response: Response,
    body: RefreshRequest | None = None,
    db: AsyncSession = Depends(get_db),
):
    # Try cookie first (web), then body (mobile)
    raw_token = http_request.cookies.get("refresh_token")
    if not raw_token and body:
        raw_token = body.refresh_token

    if not raw_token:
        raise HTTPException(status_code=401, detail="No refresh token provided")

    try:
        device_info = http_request.headers.get("user-agent", "unknown")
        access_token, new_refresh, _ = await rotate_refresh_token(db, raw_token, device_info)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e)) from None

    _set_refresh_cookie(response, new_refresh)

    return TokenResponse(access_token=access_token)


@router.post("/logout")
async def logout(
    http_request: Request,
    response: Response,
    body: RefreshRequest | None = None,
    db: AsyncSession = Depends(get_db),
):
    # Get token from cookie (web) or body (mobile)
    raw_token = http_request.cookies.get("refresh_token")
    if not raw_token and body:
        raw_token = body.refresh_token

    # Invalidate in DB if token was provided
    if raw_token:
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        await revoke_refresh_token(db, token_hash)

    # Clear cookie
    response.delete_cookie("refresh_token", path="/")
    return {"detail": "Logged out"}


# --- OAuth endpoint (Task 11) ---


@router.post("/oauth/{provider}", response_model=TokenResponse)
async def oauth_login(
    provider: str,
    request: OAuthRequest,
    http_request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    from src.models.oauth_account import OAuthAccount
    from src.services.oauth import OAuthError, verify_oauth_token

    try:
        oauth_info = await verify_oauth_token(provider, request.id_token)
    except OAuthError as e:
        raise HTTPException(status_code=400, detail=e.message) from None

    # Check if OAuth account exists
    result = await db.execute(
        select(OAuthAccount).where(
            OAuthAccount.provider == oauth_info["provider"],
            OAuthAccount.provider_id == oauth_info["provider_id"],
        )
    )
    oauth_account = result.scalar_one_or_none()

    if oauth_account:
        user_id = oauth_account.user_id
    else:
        # Check if user with this email exists (link accounts)
        # TODO: Security risk — linking OAuth to an existing account by email alone
        # does not verify ownership of the email on the existing account. A full fix
        # would require email-verification before linking. Out of scope for Plan 1.
        result = await db.execute(select(User).where(User.email == oauth_info["email"]))
        user = result.scalar_one_or_none()

        if not user:
            # Create new user
            user = User(email=oauth_info["email"], name=oauth_info["name"])
            db.add(user)
            await db.flush()
            settings_obj = UserSettings(user_id=user.id)
            db.add(settings_obj)

        # Create OAuth link
        oauth_acc = OAuthAccount(
            user_id=user.id,
            provider=oauth_info["provider"],
            provider_id=oauth_info["provider_id"],
            email=oauth_info["email"],
        )
        db.add(oauth_acc)
        await db.commit()
        user_id = user.id

    device_info = http_request.headers.get("user-agent", "unknown")
    access_token, refresh_token = await create_token_pair(db, user_id, device_info)

    _set_refresh_cookie(response, refresh_token)

    return TokenResponse(access_token=access_token)


# --- MFA endpoints (Task 12) ---


@router.post("/mfa/setup")
async def mfa_setup(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a TOTP secret, store it as pending, and return it.
    Does NOT enable MFA yet -- user must call /mfa/confirm with a valid code."""
    from src.core.security import encrypt_value
    from src.schemas.auth import MFASetupResponse
    from src.services.mfa import generate_mfa_secret, get_totp_uri

    secret = generate_mfa_secret()
    user.pending_mfa_secret = encrypt_value(secret)
    await db.commit()
    return MFASetupResponse(
        secret=secret,
        otpauth_uri=get_totp_uri(secret, user.email),
    )


@router.post("/mfa/confirm")
async def mfa_confirm(
    request: MFAConfirmRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Confirm MFA setup by providing a valid TOTP code. This activates MFA on the account."""
    from src.core.security import decrypt_value, encrypt_value
    from src.services.mfa import verify_totp

    if not user.pending_mfa_secret:
        raise HTTPException(status_code=400, detail="No pending MFA setup. Call /mfa/setup first.")

    pending_secret = decrypt_value(user.pending_mfa_secret)

    if not verify_totp(pending_secret, request.code):
        raise HTTPException(status_code=400, detail="Invalid code. Scan the QR code and try again.")

    user.mfa_secret = encrypt_value(pending_secret)
    user.pending_mfa_secret = None
    await db.commit()
    return {"detail": "MFA enabled successfully"}


@router.post("/mfa/verify", response_model=TokenResponse)
async def mfa_verify(
    mfa_request: MFAVerifyRequest,
    http_request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit_mfa_verify),
):
    """Verify MFA code during login flow or for sensitive action confirmation."""
    from src.core.security import (
        decode_access_token,
        decode_mfa_pending_token,
        decrypt_value,
    )
    from src.services.mfa import verify_totp

    # Try to get token from Authorization header
    auth_header = http_request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization token")

    token = auth_header.removeprefix("Bearer ")

    # Try as mfa_pending token first (login flow)
    try:
        payload = decode_mfa_pending_token(token)
        user_id = uuid.UUID(payload["sub"])
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user or not user.mfa_secret:
            raise HTTPException(status_code=401, detail="Invalid token")
    except ValueError:
        # Fall back to regular access token (authenticated verification)
        try:
            payload = decode_access_token(token)
            user_id = uuid.UUID(payload["sub"])
            result = await db.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()
            if not user or not user.mfa_secret:
                raise HTTPException(status_code=400, detail="MFA not set up")
        except ValueError:
            raise HTTPException(status_code=401, detail="Invalid token") from None

    decrypted_secret = decrypt_value(user.mfa_secret)

    if not verify_totp(decrypted_secret, mfa_request.code):
        raise HTTPException(status_code=401, detail="Invalid MFA code")

    # Issue full token pair
    device_info = http_request.headers.get("user-agent", "unknown")
    access_token, refresh_token = await create_token_pair(db, user.id, device_info)

    _set_refresh_cookie(response, refresh_token)

    return TokenResponse(access_token=access_token)


# --- Password endpoints (Task 13) ---


@router.post("/password/reset-request")
async def password_reset_request(
    request: PasswordResetRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit_password_reset),
):
    from src.core.security import create_password_reset_token
    from src.services.email import send_password_reset_email

    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalar_one_or_none()

    if user and user.password_hash:
        token = create_password_reset_token(user.id, user.password_hash)
        send_password_reset_email(user.email, token)

    # Always return 200 to not reveal if email exists
    return {"detail": "If that email is registered, a reset link has been sent"}


@router.post("/password/reset")
async def password_reset(
    request: PasswordResetConfirm,
    db: AsyncSession = Depends(get_db),
):
    from src.core.security import decode_password_reset_token, hash_password

    try:
        payload = decode_password_reset_token(request.token)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token") from None

    user_id = uuid.UUID(payload["sub"])
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=400, detail="Invalid token")

    # Verify password hasn't already been changed (prevents token reuse)
    if user.password_hash:
        current_fingerprint = hashlib.sha256(user.password_hash.encode()).hexdigest()[:16]
        if payload.get("pwh") != current_fingerprint:
            raise HTTPException(
                status_code=400, detail="Reset token already used or password was changed"
            )

    user.password_hash = hash_password(request.new_password)
    await db.commit()
    return {"detail": "Password reset successfully"}


@router.post("/password/set")
async def password_set(
    request: PasswordSetRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from src.core.security import hash_password

    if user.password_hash:
        raise HTTPException(status_code=400, detail="Password already set. Use reset instead.")

    user.password_hash = hash_password(request.new_password)
    await db.commit()
    return {"detail": "Password set successfully"}


# --- Session management (Task 14) ---


@router.get("/sessions", response_model=list[SessionResponse])
async def list_sessions(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(RefreshToken)
        .where(
            RefreshToken.user_id == user.id,
            RefreshToken.expires_at > func.now(),
        )
        .order_by(RefreshToken.created_at.desc())
    )
    return result.scalars().all()


@router.delete("/sessions/{session_id}")
async def revoke_session(
    session_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.id == session_id,
            RefreshToken.user_id == user.id,
        )
    )
    token = result.scalar_one_or_none()
    if not token:
        raise HTTPException(status_code=404, detail="Session not found")

    await db.delete(token)
    await db.commit()
    return {"detail": "Session revoked"}
